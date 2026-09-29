/* Cotas Venue · app.js — navegación, proyectos, galería y ajustes */
'use strict';

const App = (() => {
  const $ = id => document.getElementById(id);
  let proyectoActual = null;
  const urlsVivas = [];   // object URLs de miniaturas, se liberan al re-render

  /* ══════════ navegación ══════════ */
  function mostrar(idPantalla) {
    document.querySelectorAll('.screen').forEach(s =>
      s.classList.toggle('oculto', s.id !== idPantalla));
  }

  /* ══════════ overlays ══════════ */
  function toast(msj, ms = 2600) {
    const t = $('toast');
    t.textContent = msj;
    t.classList.remove('oculto');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('oculto'), ms);
  }
  function ocultarToast() {
    const t = $('toast');
    clearTimeout(t._timer);
    t.classList.add('oculto');
  }

  /* diálogo flexible:
     cfg = { titulo, mensaje?, input? (bool, def true), valor?, placeholder?,
             check?: {txt, def}, okTxt?, peligro? }
     resuelve { ok, valor, check } */
  function mostrarDialogo(cfg) {
    return new Promise(res => {
      const inp = $('dlg-input'), chkRow = $('dlg-check-row'), chk = $('dlg-check'), msg = $('dlg-msg');
      const conInput = cfg.input !== false;

      $('velo').classList.remove('oculto');
      $('hoja').classList.add('oculto');
      $('dialogo').classList.remove('oculto');
      $('dlg-titulo').textContent = cfg.titulo;

      msg.classList.toggle('oculto', !cfg.mensaje);
      if (cfg.mensaje) msg.textContent = cfg.mensaje;

      inp.classList.toggle('oculto', !conInput);
      if (conInput) {
        inp.value = cfg.valor || '';
        inp.placeholder = cfg.placeholder || '';
        setTimeout(() => { inp.focus(); inp.select(); }, 60);
      }

      chkRow.classList.toggle('oculto', !cfg.check);
      if (cfg.check) { $('dlg-check-txt').textContent = cfg.check.txt; chk.checked = !!cfg.check.def; }

      const ok = $('dlg-ok');
      ok.textContent = cfg.okTxt || 'Aceptar';
      ok.classList.toggle('btn-peligro', !!cfg.peligro);
      ok.classList.toggle('btn-navy', !cfg.peligro);

      const fin = (aceptado) => {
        $('velo').classList.add('oculto');
        $('dialogo').classList.add('oculto');
        ok.classList.remove('btn-peligro'); ok.classList.add('btn-navy'); ok.textContent = 'Aceptar';
        ok.onclick = $('dlg-cancelar').onclick = inp.onkeydown = $('velo').onclick = null;
        res({ ok: aceptado, valor: inp.value.trim(), check: chk.checked });
      };
      ok.onclick = () => fin(true);
      $('dlg-cancelar').onclick = () => fin(false);
      inp.onkeydown = e => { if (e.key === 'Enter' && conInput) fin(true); };
      $('velo').onclick = e => { if (e.target === $('velo')) fin(false); };
    });
  }

  /* atajo para pedir un texto: devuelve el valor o null si cancela */
  async function dialogo(titulo, valor = '', placeholder = '') {
    const r = await mostrarDialogo({ titulo, valor, placeholder, input: true });
    return r.ok ? r.valor : null;
  }

  /* flujo de borrado de proyecto, con opción de borrar también en Drive */
  async function borrarProyectoFlujo(p, despues) {
    const fotos = await DB.fotosDe(p.id);
    const sincronizado = fotos.some(f => f.estadoDrive === 'subida');
    const cfg = {
      titulo: 'Eliminar proyecto',
      mensaje: `Se va a eliminar «${p.nombre}» y sus ${fotos.length} foto${fotos.length === 1 ? '' : 's'} de la app.`,
      input: false,
      okTxt: 'Eliminar',
      peligro: true
    };
    if (Drive.activo()) {
      cfg.check = {
        txt: `Borrar también la carpeta «${p.nombre}» de tu Drive (si no, queda guardada ahí)`,
        def: sincronizado
      };
    }
    const r = await mostrarDialogo(cfg);
    if (!r.ok) return;

    await DB.borrarProyecto(p.id);
    if (r.check && Drive.activo()) {
      try {
        await Drive.borrarProyectoEnDrive(p.nombre);
        toast('Proyecto eliminado de la app y de Drive');
      } catch (e) {
        toast('Borrado de la app; en Drive no se pudo: ' + e.message, 4600);
      }
    } else {
      toast('Proyecto eliminado de la app');
    }
    despues();
  }

  /* hoja de acciones: opciones = [{txt, icono?, peligro?, fn}] */
  function hojaAcciones(opciones) {
    const h = $('hoja');
    h.innerHTML = '';
    opciones.forEach(o => {
      const b = document.createElement('button');
      if (o.peligro) b.classList.add('peligro');
      b.innerHTML = (o.icono || '') + o.txt;
      b.onclick = () => { cerrarHoja(); o.fn(); };
      h.appendChild(b);
    });
    $('velo').classList.remove('oculto');
    $('dialogo').classList.add('oculto');
    h.classList.remove('oculto');
    $('velo').onclick = e => { if (e.target === $('velo')) cerrarHoja(); };
  }
  function cerrarHoja() {
    $('velo').classList.add('oculto');
    $('hoja').classList.add('oculto');
    $('velo').onclick = null;
  }

  function liberarUrls() {
    while (urlsVivas.length) URL.revokeObjectURL(urlsVivas.pop());
  }
  function urlDe(blob) {
    const u = URL.createObjectURL(blob);
    urlsVivas.push(u);
    return u;
  }

  /* ══════════ pantalla: bienvenida ══════════ */
  const ICONOS = {
    lapiz: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z"/></svg>',
    tacho: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    nube: '<svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 1 1 .8-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7zM12 9v6M9 12l3-3 3 3"/></svg>'
  };

  async function irHome() {
    liberarUrls();
    const proyectos = await DB.proyectos();
    const cont = $('lista-proyectos');
    cont.innerHTML = '';
    if (!proyectos.length) {
      cont.innerHTML = '<p class="vacio">Todavía no hay proyectos.<br>Creá el primero con el botón de arriba.</p>';
    }
    for (const p of proyectos) {
      const fotos = await DB.fotosDe(p.id);
      const card = document.createElement('button');
      card.className = 'proj-card';
      const ultima = fotos[fotos.length - 1];
      const blobUlt = ultima && (ultima.thumb || ultima.blobFinal || ultima.blobOriginal);
      const thumb = blobUlt
        ? `<img class="proj-thumb" src="${urlDe(blobUlt)}" alt="">`
        : `<span class="proj-thumb">${p.nombre.charAt(0).toUpperCase()}</span>`;
      const enDrive = !!p.driveFolderId;
      const badge = enDrive
        ? '<span class="proj-badge drive">☁️ En tu Drive</span>'
        : '<span class="proj-badge local">📱 Solo en este teléfono</span>';
      card.innerHTML = `${thumb}<span class="proj-info"><b>${escapar(p.nombre)}</b>
        <small>${fotos.length} foto${fotos.length === 1 ? '' : 's'} · ${fecha(p.creado)}</small>
        ${badge}</span>
        <span class="chev">›</span>`;
      instalarLongPress(card, () => abrirProyecto(p.id), () => menuProyecto(p));
      cont.appendChild(card);
    }
    mostrar('scr-home');
  }

  function menuProyecto(p) {
    hojaAcciones([
      { txt: 'Renombrar proyecto', icono: ICONOS.lapiz, fn: async () => {
          const nombre = await dialogo('Nombre del proyecto', p.nombre);
          if (!nombre) return;
          p.nombre = nombre;
          await DB.guardarProyecto(p);
          irHome();
        } },
      { txt: 'Eliminar proyecto y sus fotos', icono: ICONOS.tacho, peligro: true,
        fn: () => borrarProyectoFlujo(p, irHome) }
    ]);
  }

  /* tap corto = alTocar · mantener apretado = alMantener (y el tap se suprime) */
  function instalarLongPress(el, alTocar, alMantener) {
    let timer = null, mantuvo = false;
    el.addEventListener('pointerdown', () => {
      mantuvo = false;
      timer = setTimeout(() => { mantuvo = true; alMantener(); }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
      el.addEventListener(evt, () => clearTimeout(timer)));
    el.addEventListener('click', () => { if (!mantuvo) alTocar(); });
  }

  function escapar(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function fecha(ts) {
    const d = new Date(ts), hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return 'hoy';
    hoy.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'ayer';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  /* ══════════ pantalla: proyecto ══════════ */
  const BADGES = {
    local:     ['b-local', 'en el teléfono'],
    pendiente: ['b-pend', '· pendiente'],
    subiendo:  ['b-pend', '↑ subiendo…'],
    subida:    ['b-ok', '✓ Drive'],
    error:     ['b-error', '! reintentar']
  };

  async function abrirProyecto(id) {
    const p = await DB.proyecto(id);
    if (!p) { irHome(); return; }
    proyectoActual = p;
    liberarUrls();
    $('proj-nombre').textContent = p.nombre;
    const fotos = await DB.fotosDe(id);
    const subidas = fotos.filter(f => f.estadoDrive === 'subida').length;
    $('proj-meta').textContent =
      `${fotos.length} foto${fotos.length === 1 ? '' : 's'}` +
      (subidas ? ` · ${subidas} en Drive` : '');

    const g = $('grilla-fotos');
    g.innerHTML = '';
    fotoSel = null;
    if (!fotos.length) {
      g.innerHTML = '<p class="vacio">Sin fotos todavía.<br>Sacá una o importala de tu galería.</p>';
    }
    fotos.forEach(f => {
      const card = document.createElement('button');
      card.className = 'foto-card';
      card.dataset.fotoId = f.id;
      const [cls, txt] = BADGES[f.estadoDrive] || BADGES.local;
      const blobF = f.thumb || f.blobFinal || f.blobOriginal;
      card.innerHTML = `${blobF ? `<img src="${urlDe(blobF)}" alt="">` : ''}
        <span class="badge ${cls}">${txt}</span>
        <span class="fcheck"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span>`;
      card.addEventListener('click', () => toggleSeleccion(f, card));
      g.appendChild(card);
    });
    actualizarBarraFoto();
    mostrar('scr-proj');
  }

  /* ── selección de foto en la galería (un toque) + barra de 4 acciones ── */
  let fotoSel = null;
  function toggleSeleccion(f, card) {
    if (fotoSel && fotoSel.id === f.id) { deseleccionarFoto(); return; }
    fotoSel = f;
    document.querySelectorAll('#grilla-fotos .foto-card.sel').forEach(c => c.classList.remove('sel'));
    card.classList.add('sel');
    actualizarBarraFoto();
  }
  function deseleccionarFoto() {
    fotoSel = null;
    document.querySelectorAll('#grilla-fotos .foto-card.sel').forEach(c => c.classList.remove('sel'));
    actualizarBarraFoto();
  }
  function actualizarBarraFoto() {
    const hay = !!fotoSel;
    $('foto-acciones').classList.toggle('oculto', !hay);
    const footer = document.querySelector('#scr-proj .proj-acciones');
    if (footer) footer.classList.toggle('oculto', hay);
  }

  /* mejor blob disponible de una foto para compartir/descargar (JPG final) */
  async function blobParaSalida(f) {
    if (f.blobFinal) return f.blobFinal;
    if (f.driveFileId && Drive.activo()) { try { return await Drive.descargar(f.driveFileId); } catch {} }
    return f.blobOriginal || f.proxy || f.thumb || null;
  }
  function descargarBlob(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function compartirFoto(f) {
    const blob = await blobParaSalida(f);
    if (!blob) { toast('No se pudo preparar la imagen'); return; }
    const nombre = (proyectoActual ? proyectoActual.nombre : 'foto') + '.jpg';
    const file = new File([blob], nombre, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: proyectoActual ? proyectoActual.nombre : 'Cotas Venue' }); } catch {}
    } else { descargarBlob(blob, nombre); toast('Imagen descargada'); }
  }
  async function descargarFoto(f) {
    const blob = await blobParaSalida(f);
    if (!blob) { toast('No se pudo preparar la imagen'); return; }
    descargarBlob(blob, (proyectoActual ? proyectoActual.nombre : 'foto') + '.jpg');
    toast('Imagen descargada');
  }
  async function eliminarFotoSel() {
    const f = fotoSel;
    if (!f) return;
    const enDrive = !!(f.driveFileId || f.driveOrigId);
    const r = await mostrarDialogo({
      titulo: 'Eliminar foto',
      mensaje: enDrive ? 'Se elimina de la app y de tu Drive.' : 'Se elimina de la app.',
      input: false, okTxt: 'Eliminar', peligro: true
    });
    if (!r.ok) return;
    await DB.borrarFoto(f.id);
    if (enDrive && Drive.activo() && proyectoActual) { try { await Drive.borrarFotoEnDrive(proyectoActual, f); } catch {} }
    fotoSel = null;
    toast('Foto eliminada');
    abrirProyecto(proyectoActual.id);
  }

  /* actualiza el badge de una foto sin re-armar la grilla (lo usa la cola de Drive) */
  function alCambiarEstadoFoto(f) {
    const card = document.querySelector(`.foto-card[data-foto-id="${f.id}"]`);
    if (card) {
      const [cls, txt] = BADGES[f.estadoDrive] || BADGES.local;
      const b = card.querySelector('.badge');
      b.className = 'badge ' + cls;
      b.textContent = txt;
    }
    if (f.estadoDrive === 'error') toast('No se pudo subir a Drive — se reintenta al volver la señal');
  }

  /* agrega fotos (blobs/Files) al proyecto; si abrirEditor, abre la última */
  async function agregarFotos(proyectoId, blobs, abrirEditor = false) {
    // aviso mientras se procesa (así los segundos de armado no se ven "en negro")
    toast(blobs.length > 1 ? 'Procesando fotos…' : 'Procesando foto…', 15000);
    let ultima = null;
    try {
      for (const b of blobs) {
        ultima = await DB.crearFoto(proyectoId, b);
      }
    } finally {
      ocultarToast();
    }
    if (abrirEditor && ultima) Editor.abrir(ultima.id);
    else abrirProyecto(proyectoId);
  }

  /* ══════════ ajustes / sesión ══════════ */
  function pintarAjustes() {
    const a = Ajustes.leer();
    $('aj-calidad').value = a.calidad || '0.92';
    $('aj-marca').checked = !!a.marca;
    $('aj-liberar').checked = Ajustes.liberar;
    document.querySelectorAll('#aj-unidades button').forEach(b =>
      b.classList.toggle('sel', b.dataset.u === Ajustes.unidad));
    refrescarSesion();
  }

  /* refleja el estado de login en Ajustes y en el banner del home */
  function refrescarSesion() {
    const configurado = GAuth.configurado();
    const logueado = configurado && GAuth.estaLogueado();
    const u = GAuth.getUsuario();

    // Ajustes
    $('aj-sin-config').classList.toggle('oculto', configurado);
    $('aj-sin-sesion').classList.toggle('oculto', !configurado || logueado);
    $('aj-con-sesion').classList.toggle('oculto', !logueado);
    if (logueado && u) {
      $('aj-user-name').textContent = u.name || '';
      $('aj-user-mail').textContent = u.email || '';
      if (u.picture) $('aj-user-pic').src = u.picture;
    }

    // banner del home
    $('home-signin').classList.toggle('oculto', !configurado || logueado);
    const bc = $('home-cuenta');
    bc.classList.toggle('oculto', !logueado);
    if (logueado && u) {
      $('home-cuenta-mail').textContent = u.email || '';
      if (u.picture) $('home-cuenta-pic').src = u.picture;
    }
  }

  /* muestra la versión publicada en Ajustes (formato v1.x.y que ve la gente).
     Es distinta del "build" interno, que solo sirve para la auto-actualización. */
  function mostrarVersion() {
    const el = $('aj-version');
    if (!el) return;
    const pintar = (v) => { if (v) el.textContent = 'Cotas Venue · v' + v; };
    try { pintar(localStorage.getItem('cv-version')); } catch {}   // se ve aun sin señal
    fetch('version.json?_=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const v = d.version || (d.build ? '1.' + d.build : null);
        if (v) { pintar(v); try { localStorage.setItem('cv-version', v); } catch {} }
      })
      .catch(() => {});
  }

  async function entrarGoogle(btn) {
    if (!GAuth.configurado()) { toast('Falta configurar el Client ID de Google'); return; }
    const txt = btn && btn.textContent;
    try {
      await GAuth.entrar();
      toast('✓ Entraste con Google');
      sincronizarYRefrescar();
    } catch (e) {
      toast('No se pudo entrar: ' + (e.message || e), 4000);
    }
    if (btn && txt) btn.textContent = txt;
  }

  /* baja de Drive lo que falte + sube lo local, y refresca la pantalla */
  async function sincronizarYRefrescar() {
    if (!Drive.activo()) return;
    toast('Sincronizando con tu Drive…', 60000);
    try { await Drive.sincronizar(alCambiarEstadoFoto); } catch (e) {}
    toast('✓ Sincronizado', 1800);
    const homeVisible = !document.getElementById('scr-home').classList.contains('oculto');
    const projVisible = !document.getElementById('scr-proj').classList.contains('oculto');
    if (homeVisible) irHome();
    else if (projVisible && proyectoActual) abrirProyecto(proyectoActual.id);
  }

  /* ══════════ novedades / historial de versiones ══════════ */
  const NOVEDADES = [
    { v: '5', titulo: 'Interfaz más prolija y fotos con selección', fecha: 'Septiembre 2026', items: [
      'Interfaz más compacta: herramientas arriba, botones más chicos, y las opciones de la cota en dos filas. Girar/Fijar eje quedaron como botones de ícono.',
      'La cajita del valor se conecta con una línea fina anclada al medio de la cota, y la podés mover a donde quieras sin que quede desprolijo.',
      'En un proyecto, tocás una foto para seleccionarla (tilde verde) y aparecen 4 botones: Editar, Compartir, Descargar y Eliminar. Sin el menú del teléfono.'
    ] },
    { v: '4', titulo: 'Cámara del teléfono, sin recortes', fecha: 'Septiembre 2026', items: [
      'Ahora al sacar la foto se abre la cámara propia de tu teléfono, con toda su calidad y opciones. Sacás la foto ahí y vuelve sola a la app.',
      'Se respeta la foto tal cual la sacaste: ya no se recorta ni se achica de más.',
      'El modo horizontal se rediseñó: la foto ocupa casi toda la pantalla, con las acciones flotando arriba y las opciones en una tira fina. Más lugar para trabajar.'
    ] },
    { v: '3', titulo: 'Horizontal, girar imagen y valores más fáciles', fecha: 'Septiembre 2026', items: [
      'La app ahora gira con el teléfono: podés editar en horizontal, con las herramientas al costado y la foto más grande.',
      'Botón para girar la imagen 90° en el editor: si la sacaste de costado, la enderezás cuando quieras.',
      'El valor de la cota se escribe en un recuadro de la barra: lo tocás y ponés la medida. La cajita sobre la foto ahora es solo para moverla (manteniéndola presionada).',
      'Cada proyecto muestra si está guardado «en tu Drive» o «solo en este teléfono».'
    ] },
    { v: '2', titulo: 'Más rápida y sin volver a iniciar sesión', fecha: 'Agosto 2026', items: [
      'Se arregló que algunas fotos salieran en negro al sacarlas o importarlas.',
      'Sacar e importar fotos es más rápido (ya no queda unos segundos en negro).',
      'La sesión se guarda: no te pide iniciar sesión cada vez que abrís la app.',
      'La app se actualiza sola: con el mismo link, siempre tenés la última versión.'
    ] },
    { v: '1', titulo: 'Cotas Venue 1.0 — la base', fecha: '2026', items: [
      'Sacá o importá fotos organizadas por proyecto.',
      'Marcales cotas, flechas, curvas, ángulos, textos, marcos y óvalos.',
      'Elegí color, unidad (m, cm, mm), grosor de línea y tamaño del texto.',
      'Guardá el JPG final y subilo a tu propio Drive, ordenado por proyecto.'
    ] }
  ];
  const NOV_VER = NOVEDADES[0].v;

  function renderNovedades() {
    $('nov-cuerpo').innerHTML = NOVEDADES.map(n => `
      <div class="card nov-item">
        <div class="nov-cab"><b>${escapar(n.titulo)}</b><small>${escapar(n.fecha)}</small></div>
        <ul>${n.items.map(i => `<li>${escapar(i)}</li>`).join('')}</ul>
      </div>`).join('');
  }
  function abrirNovedades() {
    renderNovedades();
    try { localStorage.setItem('cv-novedades-visto', NOV_VER); } catch {}
    mostrar('scr-novedades');
  }
  async function avisarNovedades() {
    const r = await mostrarDialogo({
      titulo: '✨ Novedades',
      mensaje: 'Actualizamos la app con varias mejoras. ¿Querés ver qué cambió? (después lo tenés siempre en Ajustes).',
      input: false, okTxt: 'Ver novedades'
    });
    try { localStorage.setItem('cv-novedades-visto', NOV_VER); } catch {}
    if (r.ok) abrirNovedades();
  }
  /* aviso una sola vez por versión: se muestra hasta que la persona lo ve */
  function chequearNovedades() {
    try {
      if (localStorage.getItem('cv-novedades-visto') !== NOV_VER) setTimeout(avisarNovedades, 900);
    } catch {}
  }

  /* ══════════ wiring ══════════ */
  function init() {
    $('btn-nuevo-proj').addEventListener('click', async () => {
      const nombre = await dialogo('Nombre del nuevo proyecto', '', 'ej: Casa Belgrano — Deck');
      if (!nombre) return;
      const p = await DB.crearProyecto(nombre);
      // Aviso (una sola vez): sin sesión el proyecto queda solo en el teléfono.
      if (!GAuth.estaLogueado() && !localStorage.getItem('cv-aviso-local')) {
        localStorage.setItem('cv-aviso-local', '1');
        const r = await mostrarDialogo({
          titulo: 'Proyecto guardado en este teléfono 📱',
          mensaje: 'Podés trabajar igual. Pero para respaldarlo en tu Drive y no perderlo si cambiás de teléfono, iniciá sesión con Google. Cuando entres, se sube solo.',
          input: false, okTxt: 'Entrar con Google'
        });
        if (r.ok) { entrarGoogle(); return; }
      }
      abrirProyecto(p.id);
    });

    $('btn-ajustes').addEventListener('click', () => { pintarAjustes(); mostrar('scr-ajustes'); });
    $('btn-aj-volver').addEventListener('click', irHome);
    $('aj-novedades').addEventListener('click', abrirNovedades);
    $('btn-nov-volver').addEventListener('click', () => { pintarAjustes(); mostrar('scr-ajustes'); });
    $('btn-proj-volver').addEventListener('click', irHome);

    $('btn-proj-menu').addEventListener('click', () => {
      const p = proyectoActual;
      if (!p) return;
      hojaAcciones([
        { txt: 'Subir pendientes a Drive', icono: ICONOS.nube, fn: async () => {
            if (!Drive.activo()) { toast('Primero entrá con Google en Ajustes'); return; }
            const pend = await DB.fotosPendientes();
            if (!pend.length) { toast('No hay fotos pendientes'); return; }
            toast(`Subiendo ${pend.length}…`);
            await Drive.procesarCola(alCambiarEstadoFoto);
            abrirProyecto(p.id);
          } },
        { txt: 'Renombrar proyecto', icono: ICONOS.lapiz, fn: async () => {
            const nombre = await dialogo('Nombre del proyecto', p.nombre);
            if (!nombre) return;
            p.nombre = nombre;
            await DB.guardarProyecto(p);
            abrirProyecto(p.id);
          } },
        { txt: 'Eliminar proyecto y sus fotos', icono: ICONOS.tacho, peligro: true,
          fn: () => borrarProyectoFlujo(p, irHome) }
      ]);
    });

    $('btn-importar').addEventListener('click', () => $('input-importar').click());
    $('input-importar').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (files.length && proyectoActual) {
        await agregarFotos(proyectoActual.id, files, files.length === 1);
      }
    });

    $('btn-sacar').addEventListener('click', () => Camara.abrir(proyectoActual.id));

    /* foto seleccionada: 4 acciones */
    $('acc-editar').addEventListener('click', () => { if (fotoSel) { const id = fotoSel.id; deseleccionarFoto(); Editor.abrir(id); } });
    $('acc-compartir').addEventListener('click', () => { if (fotoSel) compartirFoto(fotoSel); });
    $('acc-descargar').addEventListener('click', () => { if (fotoSel) descargarFoto(fotoSel); });
    $('acc-eliminar').addEventListener('click', () => eliminarFotoSel());
    // sin menú nativo del teléfono al mantener presionada una miniatura
    $('grilla-fotos').addEventListener('contextmenu', e => e.preventDefault());

    /* ajustes */
    $('aj-calidad').addEventListener('change', () => Ajustes.guardar({ calidad: $('aj-calidad').value }));
    $('aj-marca').addEventListener('change', () => Ajustes.guardar({ marca: $('aj-marca').checked }));
    $('aj-liberar').addEventListener('change', () => Ajustes.guardar({ liberar: $('aj-liberar').checked }));
    document.querySelectorAll('#aj-unidades button').forEach(b =>
      b.addEventListener('click', () => {
        Ajustes.guardar({ unidad: b.dataset.u });
        pintarAjustes();
      }));

    /* sesión de Google (los clics de "entrar" deben salir directo del gesto) */
    $('aj-entrar').addEventListener('click', () => entrarGoogle($('aj-entrar')));
    $('home-signin').addEventListener('click', () => entrarGoogle($('home-signin')));
    $('aj-salir').addEventListener('click', () => {
      GAuth.salir();
      toast('Cerraste sesión');
    });
    GAuth.alCambiar(() => {
      refrescarSesion();
      if (!document.getElementById('scr-home').classList.contains('oculto')) irHome();
    });

    Editor.init();
    Camara.init();
    irHome();
    refrescarSesion();
    mostrarVersion();
    chequearNovedades();
    GAuth.init().then(() => {
      refrescarSesion();
      if (GAuth.estaLogueado()) sincronizarYRefrescar();
    }).catch(() => {});

    if ('serviceWorker' in navigator) {
      const habiaControlador = !!navigator.serviceWorker.controller;
      let recargando = false;
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.update();                                   // buscar versión nueva ya
        setInterval(() => reg.update(), 60 * 60 * 1000); // y cada tanto
      }).catch(() => {});
      // cuando una versión nueva toma el control, recargar UNA vez para verla
      // (en la 1ra instalación no hay que recargar: no había controlador)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!habiaControlador || recargando) return;
        recargando = true;
        location.reload();
      });
      // al volver la app al primer plano (clave en móvil/PWA), re-chequear
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { mostrar, toast, dialogo, irHome, abrirProyecto, agregarFotos, alCambiarEstadoFoto };
})();
