// Unregister all old caches and take over immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Pass-through: no caching, always fetch from network
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
