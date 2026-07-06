/* Cotas Venue · sw.js — cache para funcionar offline */
'use strict';

const CACHE = 'cotas-venue-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'db.js',
  'drive.js',
  'editor.js',
  'camara.js',
  'manifest.webmanifest',
  'venue-logo.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* red primero para los archivos de la app (así llegan las actualizaciones),
   caché como respaldo cuando no hay señal */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
