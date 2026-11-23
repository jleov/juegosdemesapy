// Service worker: permite instalar Carrera Guasu como app y jugar sin conexión contra bots.
const CACHE = 'karts-v18';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './peerjs.min.js', './three.min.js', './GLTFLoader.js', './modelos/jakare.glb', './modelos/kapi.glb', './modelos/tuka.glb', './modelos/jagua.glb', './modelos/kure.glb', './modelos/aguara.glb', './modelos/kai.glb', './modelos/lobope.glb', './vehiculos/jakare.glb', './vehiculos/kapi.glb', './vehiculos/tuka.glb', './vehiculos/jagua.glb', './vehiculos/kure.glb', './vehiculos/aguara.glb', './vehiculos/kai.glb', './vehiculos/lobope.glb', './pistas.js', './mundo.js', './karts3d.js', './carrera.js', './sala.js', './juego.js', './caras.js', './mando.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('karts-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.includes('/karts/')) return;
  // red primero, caché si no hay conexión
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
