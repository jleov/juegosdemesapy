// Service worker de la portada: permite instalar "Juegos de Mesa Digital PY" como app.
// Solo atiende la portada; el Banquero y la Lotería tienen el suyo propio.
const CACHE = 'portal-v3';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('portal-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const base = new URL('./', self.registration.scope).pathname;
  const enPortada = url.pathname === base || FILES.some(f => url.pathname === new URL(f, self.registration.scope).pathname);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !enPortada) return;
  // red primero, caché si no hay conexión
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
