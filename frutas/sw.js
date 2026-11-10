// Service worker de Yva Rape: permite instalar el juego como app y jugarlo sin conexión.
const CACHE = 'frutas-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './arte.js', './niveles.js', './juego.js', '../inicio.js', '../chat/filtro.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('frutas-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !(url.pathname.includes('/frutas/') || url.pathname.endsWith('/inicio.js') || url.pathname.endsWith('/chat/filtro.js'))) return;
  // red primero, caché si no hay conexión
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
