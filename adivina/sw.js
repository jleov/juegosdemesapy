// El juego de esta carpeta ahora se llama ¿Mávapa? y está en ../mavapa/.
// Este service worker reemplaza al viejo: borra lo que había guardado y se da de baja solo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('adivina-')).map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({type:'window'}))
    .then(cs => cs.forEach(c => c.navigate(c.url))));   // recarga las pestañas abiertas: la página nueva las lleva al ¿Mávapa?
});
