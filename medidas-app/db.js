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
      // una sola decodificación → proxy liviano (edición) + miniatura (galería)
      const [proxy, thumb] = await escalarVarios(blobOriginal, [
        { max: 1600, calidad: 0.82 },
        { max: 480, calidad: 0.72 }
      ]);
      const f = {
        id: uid(), proyectoId, creado: Date.now(),
        blobOriginal, proxy, thumb,
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

  /* Decodifica el blob UNA sola vez y devuelve varios tamaños (proxy + miniatura).
     Antes se decodificaba la foto entera dos veces (una por tamaño): en el celu,
     con fotos de 12 MP, eso agregaba varios segundos de "pantalla en negro" al
     sacar/importar. Ahora es una sola decodificación para todos los tamaños.
     Usa <img> (decoder del sistema): respeta la orientación EXIF y evita el bug
     de varios iPhone donde createImageBitmap devolvía la imagen en NEGRO. */
  async function escalarVarios(blob, medidas) {
    if (!blob) return medidas.map(() => null);
    let url = null;
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        url = URL.createObjectURL(blob);
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('decode'));
        im.src = url;
      });
      if (img.decode) { try { await img.decode(); } catch {} }
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih) throw new Error('vacia');
      const salidas = [];
      for (const m of medidas) {
        const escala = Math.min(1, m.max / Math.max(iw, ih));
        const w = Math.max(1, Math.round(iw * escala));
        const h = Math.max(1, Math.round(ih * escala));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Red de seguridad iOS: si se quedó sin memoria y no rasterizó, el lienzo
        // queda transparente → el JPEG saldría NEGRO. Lo detectamos por el alpha
        // y devolvemos la foto original (se ve bien) en vez de una copia negra.
        if (lienzoEnBlanco(ctx, w, h)) { salidas.push(blob); continue; }
        const out = await new Promise(res => cv.toBlob(res, 'image/jpeg', m.calidad));
        salidas.push(out || blob);
      }
      return salidas;
    } catch {
      return medidas.map(() => blob);   // si algo falla, no rompemos: dejamos el original
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  /* reduce un JPEG a maxLado (px del lado más largo) — un solo tamaño */
  async function escalar(blob, maxLado, calidad) {
    const [out] = await escalarVarios(blob, [{ max: maxLado, calidad }]);
    return out;
  }

  /* ¿el dibujo falló y quedó el lienzo transparente? (bug de memoria de iOS).
     Muestrea una grilla: si TODO el alpha es 0, no se rasterizó nada. Una foto
     realmente negra tendría alpha 255, así que no la confundimos con un fallo. */
  function lienzoEnBlanco(ctx, w, h) {
    try {
      const pasos = 5;
      for (let i = 1; i < pasos; i++) {
        for (let j = 1; j < pasos; j++) {
          const x = Math.floor(w * i / pasos), y = Math.floor(h * j / pasos);
          if (ctx.getImageData(x, y, 1, 1).data[3] !== 0) return false;
        }
      }
      return true;
    } catch {
      return false;   // ante la duda, no descartamos la copia
    }
  }
})();
