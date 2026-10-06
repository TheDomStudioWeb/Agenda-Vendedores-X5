const CACHE_NAME = 'x5-os-v1';
const urlsToCache = [
  './',
  './index.html',
  './simulador.html',
  './x5check.html',
  './dni.html',
  './unificador.html',
  './crm.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});