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

  /* ── cola de subida ── */
  async function subirFoto(foto, nombreProyecto, numero) {
    const folderId = await carpetaProyecto(nombreProyecto);
    const nombreArchivo = `${nombreProyecto} ${String(numero).padStart(3, '0')}.jpg`;
    const blob = foto.blobFinal || foto.blobOriginal;
    const r = await subirArchivo(nombreArchivo, blob, folderId, foto.driveFileId);
    return r;
  }

  async function procesarCola(alTerminarUna) {
    if (subiendo || !activo() || !navigator.onLine) return;
    subiendo = true;
    try {
      const pendientes = await DB.fotosPendientes();
      for (const foto of pendientes) {
        const proyecto = await DB.proyecto(foto.proyectoId);
        if (!proyecto) continue;
        const hermanas = await DB.fotosDe(foto.proyectoId);
        const numero = hermanas.findIndex(f => f.id === foto.id) + 1;
        foto.estadoDrive = 'subiendo';
        await DB.guardarFoto(foto);
        if (alTerminarUna) alTerminarUna(foto);
        try {
          const r = await subirFoto(foto, proyecto.nombre, numero);
          foto.driveFileId = r.id;
          foto.driveUrl = r.webViewLink || '';
          foto.estadoDrive = 'subida';
          // liberar la copia pesada del teléfono (queda miniatura + proxy + cotas)
          if (Ajustes.liberar) await DB.aligerarFoto(foto);
          else await DB.guardarFoto(foto);
        } catch (e) {
          foto.estadoDrive = 'error';
          await DB.guardarFoto(foto);
        }
        if (alTerminarUna) alTerminarUna(foto);
      }
    } finally {
      subiendo = false;
    }
  }

  return { probar, procesarCola, borrarProyectoEnDrive, descargar, activo };
})();

window.addEventListener('online', () => {
  Drive.procesarCola(window.App && App.alCambiarEstadoFoto);
});
