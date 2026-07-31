/* Cotas Venue · db.js — IndexedDB: proyectos y fotos (con blobs) */
'use strict';

const DB = (() => {
  const NOMBRE = 'cotas-venue';
  const VERSION = 1;
  let db = null;

  function abrir() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('proyectos')) {
          d.createObjectStore('proyectos', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('fotos')) {
          const st = d.createObjectStore('fotos', { keyPath: 'id' });
          st.createIndex('porProyecto', 'proyectoId');
        }
      };
      req.onsuccess = () => { db = req.result; res(db); };
      req.onerror = () => rej(req.error);
    });
  }

  function tx(store, modo, fn) {
    return abrir().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, modo);
      const resultado = fn(t.objectStore(store));
      t.oncomplete = () => res(resultado && 'result' in resultado ? resultado.result : undefined);
      t.onerror = () => rej(t.error);
    }));
  }

  function todos(store, indice, clave) {
    return abrir().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, 'readonly');
      const st = t.objectStore(store);
      const fuente = indice ? st.index(indice) : st;
      const req = clave !== undefined ? fuente.getAll(clave) : fuente.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return {
    uid,

    /* ── proyectos ── */
    proyectos: () => todos('proyectos').then(ps => ps.sort((a, b) => b.creado - a.creado)),
    proyecto: (id) => abrir().then(d => new Promise((res, rej) => {
      const req = d.transaction('proyectos', 'readonly').objectStore('proyectos').get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    })),
    crearProyecto: (nombre) => {
      const p = { id: uid(), nombre, creado: Date.now() };
      return tx('proyectos', 'readwrite', st => st.add(p)).then(() => p);
    },
    guardarProyecto: (p) => tx('proyectos', 'readwrite', st => st.put(p)),
    borrarProyecto: async (id) => {
      const fotos = await todos('fotos', 'porProyecto', id);
      await tx('fotos', 'readwrite', st => { fotos.forEach(f => st.delete(f.id)); });
      await tx('proyectos', 'readwrite', st => st.delete(id));
    },

    /* ── fotos ── */
    fotosDe: (proyectoId) => todos('fotos', 'porProyecto', proyectoId)
      .then(fs => fs.sort((a, b) => a.creado - b.creado)),
    foto: (id) => abrir().then(d => new Promise((res, rej) => {
      const req = d.transaction('fotos', 'readonly').objectStore('fotos').get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    })),
    crearFoto: async (proyectoId, blobOriginal) => {
      const f = {
        id: uid(), proyectoId, creado: Date.now(),
        blobOriginal,
        proxy: await escalar(blobOriginal, 1600, 0.82),   // copia liviana editable
        thumb: await escalar(blobOriginal, 480, 0.72),    // miniatura de la galería
        anotaciones: [],
        blobFinal: null,
        driveFileId: null,
        driveUrl: '',
        estadoDrive: 'local'   // local | pendiente | subiendo | subida | error
      };
      return tx('fotos', 'readwrite', st => st.add(f)).then(() => f);
    },
    guardarFoto: (f) => tx('fotos', 'readwrite', st => st.put(f)),
    /* tras subir a Drive: suelta las copias pesadas, deja miniatura + proxy + cotas */
    aligerarFoto: async (f) => {
      if (!f.proxy && f.blobOriginal) f.proxy = await escalar(f.blobOriginal, 1600, 0.82);
      if (!f.thumb) f.thumb = await escalar(f.blobFinal || f.blobOriginal, 480, 0.72);
      f.blobOriginal = null;
      f.blobFinal = null;
      return tx('fotos', 'readwrite', st => st.put(f));
    },
    borrarFoto: (id) => tx('fotos', 'readwrite', st => st.delete(id)),
    fotosPendientes: () => todos('fotos').then(fs =>
      fs.filter(f => f.estadoDrive === 'pendiente' || f.estadoDrive === 'error')),

    /* busca un proyecto por nombre (para juntar local + Drive al sincronizar) */
    proyectoPorNombre: (nombre) => todos('proyectos').then(ps =>
      ps.find(p => p.nombre === nombre) || null),

    /* crea una foto ya "traída de Drive" (sin imágenes locales; se bajan al abrir) */
    crearFotoRemota: (proyectoId, datos) => {
      const f = Object.assign({
        id: datos.id || uid(), proyectoId, creado: datos.creado || Date.now(),
        blobOriginal: null, proxy: null, thumb: null, blobFinal: null,
        anotaciones: datos.anotaciones || [],
        n: datos.n || 0,
        driveFileId: datos.driveFileId || null,   // JPG final en Drive
        driveOrigId: datos.driveOrigId || null,   // original sin anotar en .datos
        estadoDrive: 'subida'
      }, {});
      if (datos.thumbB64) f.thumb = dataURLaBlob('data:image/jpeg;base64,' + datos.thumbB64);
      return tx('fotos', 'readwrite', st => st.add(f)).then(() => f);
    },

    escalar,          // reduce un blob a maxLado (px)
    blobABase64,      // blob -> base64 (sin encabezado)
    todosProyectos: () => todos('proyectos'),
    todasFotos: () => todos('fotos')
  };

  function dataURLaBlob(dataURL) {
    const [cab, b64] = dataURL.split(',');
    const mime = (cab.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function blobABase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  /* reduce un JPEG a maxLado (px del lado más largo) */
  async function escalar(blob, maxLado, calidad) {
    if (!blob) return null;
    try {
      const bmp = await crearBitmap(blob);
      const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return await new Promise(res => cv.toBlob(res, 'image/jpeg', calidad));
    } catch {
      return blob;   // si algo falla, no rompemos: dejamos el original
    }
  }
  function crearBitmap(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise((res, rej) => {
      const img = new Image();
      const u = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(u); res(img); };
      img.onerror = rej;
      img.src = u;
    });
  }
})();
