/* Cotas Venue · sw.js — auto-curativo:
   al activarse borra TODAS las cachés viejas y recarga las pestañas, así ningún
   teléfono queda pegado a una versión anterior. Después, red primero (siempre lo
   último cuando hay señal) + caché de respaldo para andar sin señal. */
'use strict';

const CACHE = 'cv-rt-4';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // borrar cualquier caché anterior (precache v1..v8, etc.)
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();   // la página se recarga sola vía 'controllerchange'
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const resp = await fetch(e.request);          // red primero (lo último)
      const c = await caches.open(CACHE);
      c.put(e.request, resp.clone()).catch(() => {});
      return resp;
    } catch (_) {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      return cached || Response.error();            // respaldo offline
    }
  })());
});
