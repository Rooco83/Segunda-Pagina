/* Cotas Venue · drive.js — Google Drive API con el token de CADA usuario.
   Guarda en el Drive propio: Cotas Venue / <Proyecto> / Proyecto 001.jpg …
   scope drive.file: la app solo ve/gestiona los archivos y carpetas que
   ella misma crea (no toca el resto del Drive del usuario). */
'use strict';

const Ajustes = {
  leer() {
    try { return JSON.parse(localStorage.getItem('cv-ajustes')) || {}; }
    catch { return {}; }
  },
  guardar(cambios) {
    const a = Object.assign(this.leer(), cambios);
    localStorage.setItem('cv-ajustes', JSON.stringify(a));
    return a;
  },
  get unidad()  { return this.leer().unidad || 'm'; },
  get calidad() { return parseFloat(this.leer().calidad || '0.92'); },
  get marca()   { return !!this.leer().marca; },
  // por defecto, tras subir se libera la copia pesada del teléfono
  get liberar() { const v = this.leer().liberar; return v === undefined ? true : !!v; }
};

const Drive = (() => {
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const cache = {};          // "raiz" o "raiz/Proyecto" -> folderId
  let subiendo = false;

  const activo = () => GAuth.configurado() && GAuth.estaLogueado();

  async function req(url, opts = {}) {
    const tk = await GAuth.token();
    const r = await fetch(url, {
      ...opts,
      headers: { Authorization: 'Bearer ' + tk, ...(opts.headers || {}) }
    });
    if (!r.ok) {
      let detalle = 'HTTP ' + r.status;
      try { const j = await r.json(); if (j.error && j.error.message) detalle = j.error.message; } catch {}
      throw new Error(detalle);
    }
    return r;
  }

  /* ── carpetas ── */
  async function buscarCarpeta(nombre, parentId) {
    const nombreEsc = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    let q = `mimeType='application/vnd.google-apps.folder' and name='${nombreEsc}' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
    const j = await r.json();
    return j.files && j.files[0] ? j.files[0].id : null;
  }
  async function crearCarpeta(nombre, parentId) {
    const meta = { name: nombre, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) meta.parents = [parentId];
    const r = await req(`${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta)
    });
    return (await r.json()).id;
  }
  async function carpetaRaiz() {
    if (cache.raiz) return cache.raiz;
    const nombre = CV_CONFIG.carpetaRaiz;
    cache.raiz = (await buscarCarpeta(nombre, null)) || (await crearCarpeta(nombre, null));
    return cache.raiz;
  }
  async function carpetaProyecto(nombre) {
    const key = 'raiz/' + nombre;
    if (cache[key]) return cache[key];
    const raiz = await carpetaRaiz();
    cache[key] = (await buscarCarpeta(nombre, raiz)) || (await crearCarpeta(nombre, raiz));
    return cache[key];
  }

  /* ── subir / bajar / borrar ── */
  async function subirArchivo(nombreArchivo, blob, folderId, fileIdExistente) {
    const meta = { name: nombreArchivo };
    if (!fileIdExistente) meta.parents = [folderId];
    const boundary = 'cvb' + Math.random().toString(36).slice(2);
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) + `\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const body = new Blob([head, blob, tail], { type: 'multipart/related; boundary=' + boundary });
    const url = (fileIdExistente ? `${UPLOAD}/${fileIdExistente}` : UPLOAD) +
      '?uploadType=multipart&fields=id,webViewLink';
    const r = await req(url, {
      method: fileIdExistente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
    return await r.json();   // { id, webViewLink }
  }

  async function descargar(fileId) {
    const r = await req(`${API}/files/${fileId}?alt=media`);
    return await r.blob();
  }

  async function buscarArchivo(nombre, parentId) {
    const nombreEsc = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `name='${nombreEsc}' and '${parentId}' in parents and trashed=false`;
    const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
    const j = await r.json();
    return j.files && j.files[0] ? j.files[0].id : null;
  }
  async function carpetaDatos(folderProyectoId) {
    return (await buscarCarpeta('.datos', folderProyectoId)) || (await crearCarpeta('.datos', folderProyectoId));
  }
  async function subirJson(nombre, obj, parentId, fileIdExistente) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const meta = { name: nombre };
    if (!fileIdExistente) meta.parents = [parentId];
    const boundary = 'cvj' + Math.random().toString(36).slice(2);
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) + `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`;
    const body = new Blob([head, blob, `\r\n--${boundary}--`], { type: 'multipart/related; boundary=' + boundary });
    const url = (fileIdExistente ? `${UPLOAD}/${fileIdExistente}` : UPLOAD) + '?uploadType=multipart&fields=id';
    const r = await req(url, {
      method: fileIdExistente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body
    });
    return (await r.json()).id;
  }
  async function leerJson(fileId) {
    try { return JSON.parse(await (await descargar(fileId)).text()); } catch { return null; }
  }

  async function borrarProyectoEnDrive(nombre) {
    const raiz = await buscarCarpeta(CV_CONFIG.carpetaRaiz, null);
    if (!raiz) return;
    const id = await buscarCarpeta(nombre, raiz);
    if (!id) return;
    // a la papelera (recuperable), no borrado permanente
    await req(`${API}/files/${id}?fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true })
    });
    delete cache['raiz/' + nombre];
  }

  async function probar() {
    await carpetaRaiz();   // crea/verifica la carpeta matriz
    return { ok: true };
  }

  const necesitaSubir = f => f.estadoDrive !== 'subida' && f.estadoDrive !== 'subiendo';

  /* sube (o actualiza) un proyecto entero: fotos finales + originales + cotas.json */
  async function subirProyecto(proyecto, alTerminarUna) {
    const fotos = (await DB.fotosDe(proyecto.id));
    const hayCambios = fotos.some(necesitaSubir);
    if (!hayCambios && proyecto.driveCotasFileId) return;   // nada nuevo que subir

    const folderId = await carpetaProyecto(proyecto.nombre);
    const datosId = await carpetaDatos(folderId);
    proyecto.driveFolderId = folderId;
    proyecto.driveDatosId = datosId;

    fotos.forEach((f, i) => { if (!f.n) f.n = i + 1; });

    for (const foto of fotos) {
      if (!necesitaSubir(foto)) continue;
      if (!foto.blobFinal && !foto.driveFileId) continue;   // sin nada que subir
      foto.estadoDrive = 'subiendo';
      await DB.guardarFoto(foto);
      if (alTerminarUna) alTerminarUna(foto);
      try {
        const nn = String(foto.n).padStart(3, '0');
        if (foto.blobFinal) {
          const r = await subirArchivo(`${proyecto.nombre} ${nn}.jpg`, foto.blobFinal, folderId, foto.driveFileId);
          foto.driveFileId = r.id;
        }
        if (foto.blobOriginal && !foto.driveOrigId) {
          const ro = await subirArchivo(`${nn}.jpg`, foto.blobOriginal, datosId, null);
          foto.driveOrigId = ro.id;
        }
        foto.estadoDrive = 'subida';
        if (Ajustes.liberar) await DB.aligerarFoto(foto); else await DB.guardarFoto(foto);
      } catch (e) {
        foto.estadoDrive = 'error';
        await DB.guardarFoto(foto);
      }
      if (alTerminarUna) alTerminarUna(foto);
    }

    // reescribir cotas.json con TODAS las fotos del proyecto
    try {
      const finales = await DB.fotosDe(proyecto.id);
      const meta = { v: 1, nombre: proyecto.nombre, creado: proyecto.creado, fotos: [] };
      for (const f of finales) {
        meta.fotos.push({
          id: f.id, n: f.n || 0, creado: f.creado,
          anotaciones: f.anotaciones || [],
          driveFileId: f.driveFileId || null,
          driveOrigId: f.driveOrigId || null,
          thumbB64: f.thumb ? await DB.blobABase64(f.thumb) : null
        });
      }
      proyecto.driveCotasFileId = await subirJson('cotas.json', meta, datosId, proyecto.driveCotasFileId);
    } catch (e) { /* si falla el json, las fotos igual quedaron subidas */ }
    await DB.guardarProyecto(proyecto);
  }

  /* empuja TODO lo local que falte subir (se usa tras guardar o al volver la señal) */
  async function procesarCola(alTerminarUna) {
    if (subiendo || !activo() || !navigator.onLine) return;
    subiendo = true;
    try {
      const proyectos = await DB.todosProyectos();
      for (const p of proyectos) {
        try { await subirProyecto(p, alTerminarUna); } catch (e) {}
      }
    } finally { subiendo = false; }
  }

  /* trae de Drive los proyectos/fotos que no estén localmente */
  async function bajarDeDrive() {
    const raiz = await carpetaRaiz();
    // subcarpetas de la raíz = proyectos
    const q = `mimeType='application/vnd.google-apps.folder' and '${raiz}' in parents and trashed=false`;
    const r = await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&pageSize=1000`);
    const carpetas = (await r.json()).files || [];
    for (const carp of carpetas) {
      try {
        const datosId = await buscarCarpeta('.datos', carp.id);
        if (!datosId) continue;
        const cotasId = await buscarArchivo('cotas.json', datosId);
        if (!cotasId) continue;
        const meta = await leerJson(cotasId);
        if (!meta || !meta.fotos) continue;

        let proy = await DB.proyectoPorNombre(carp.name);
        if (!proy) proy = await DB.crearProyecto(carp.name);
        proy.driveFolderId = carp.id;
        proy.driveDatosId = datosId;
        proy.driveCotasFileId = cotasId;
        cache['raiz/' + carp.name] = carp.id;
        await DB.guardarProyecto(proy);

        for (const fm of meta.fotos) {
          const existe = await DB.foto(fm.id);
          if (existe) continue;              // ya está local: no piso ediciones locales
          await DB.crearFotoRemota(proy.id, fm);
        }
      } catch (e) { /* seguimos con el resto de los proyectos */ }
    }
  }

  /* sincronización completa al entrar: baja lo de Drive y sube lo local que falte */
  async function sincronizar(alTerminarUna) {
    if (!activo() || !navigator.onLine) return;
    try { await bajarDeDrive(); } catch (e) {}
    await procesarCola(alTerminarUna);
  }

  return {
    probar, procesarCola, sincronizar, subirProyecto,
    borrarProyectoEnDrive, descargar, activo
  };
})();

window.addEventListener('online', () => {
  Drive.procesarCola(window.App && App.alCambiarEstadoFoto);
});
