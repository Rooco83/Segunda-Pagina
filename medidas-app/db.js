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
    crearFoto: (proyectoId, blobOriginal) => {
      const f = {
        id: uid(), proyectoId, creado: Date.now(),
        blobOriginal,
        anotaciones: [],
        blobFinal: null,
        estadoDrive: 'local'   // local | pendiente | subiendo | subida | error
      };
      return tx('fotos', 'readwrite', st => st.add(f)).then(() => f);
    },
    guardarFoto: (f) => tx('fotos', 'readwrite', st => st.put(f)),
    borrarFoto: (id) => tx('fotos', 'readwrite', st => st.delete(id)),
    fotosPendientes: () => todos('fotos').then(fs =>
      fs.filter(f => f.estadoDrive === 'pendiente' || f.estadoDrive === 'error'))
  };
})();
