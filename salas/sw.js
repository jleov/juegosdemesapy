// Service worker de las Salas de Voz: permite instalarlas como app.
// Siempre busca primero la versión nueva en internet; la copia guardada es solo para abrir sin conexión.
// No toca /api/ ni otros sitios (Deepgram, PeerJS, traductor).
const CACHE = 'salas-v3';
const FILES = ['./', './index.html', './app.js', './manifest.json', './icon-192.png', './icon-512.png',
  './vendor/peerjs.min.js', './vendor/ns.js', './vendor/rnnoise-worklet.js', './vendor/rnnoise.wasm', './vendor/rnnoise_simd.wasm', '../ice.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('salas-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
