// Service worker mÃ­nimo: permite instalar el juego como app en Android.
// Guarda el juego en cachÃ© para que abra rÃ¡pido; la partida en lÃ­nea siempre necesita internet.
const CACHE = 'banquero-v18';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './peerjs.min.js', './dados.mp3', './contadora.mp3', './caja.mp3', './musica.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('banquero-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // red primero, cachÃ© si no hay conexiÃ³n
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
