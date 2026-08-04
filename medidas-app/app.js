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
      card.innerHTML = `${thumb}<span><b>${escapar(p.nombre)}</b>
        <small>${fotos.length} foto${fotos.length === 1 ? '' : 's'} · ${fecha(p.creado)}</small></span>
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
        <span class="badge ${cls}">${txt}</span>`;
      instalarLongPress(card, () => Editor.abrir(f.id), () => menuFoto(f));
      g.appendChild(card);
    });
    mostrar('scr-proj');
  }

  function menuFoto(f) {
    hojaAcciones([
      { txt: 'Eliminar foto', icono: ICONOS.tacho, peligro: true, fn: async () => {
          await DB.borrarFoto(f.id);
          toast('Foto eliminada');
          abrirProyecto(f.proyectoId);
        } }
    ]);
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
    let ultima = null;
    for (const b of blobs) {
      ultima = await DB.crearFoto(proyectoId, b);
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

  /* ══════════ wiring ══════════ */
  function init() {
    $('btn-nuevo-proj').addEventListener('click', async () => {
      const nombre = await dialogo('Nombre del nuevo proyecto', '', 'ej: Casa Belgrano — Deck');
      if (!nombre) return;
      const p = await DB.crearProyecto(nombre);
      abrirProyecto(p.id);
    });

    $('btn-ajustes').addEventListener('click', () => { pintarAjustes(); mostrar('scr-ajustes'); });
    $('btn-aj-volver').addEventListener('click', irHome);
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
    GAuth.init().then(() => {
      refrescarSesion();
      if (GAuth.estaLogueado()) sincronizarYRefrescar();
    }).catch(() => {});

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
      // cuando una versión nueva toma el control, recargar UNA vez para verla
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        location.reload();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { mostrar, toast, dialogo, irHome, abrirProyecto, agregarFotos, alCambiarEstadoFoto };
})();
