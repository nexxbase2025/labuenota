
const CACHE_NAME = 'la-buenota-radio-online-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './service-worker.js',
  './icono.webp',
  './ins.webp',
  './r1.webp',
  './r2.webp',
  './r3.webp',
  './r4.webp',
  './r5.webp',
  './r6.webp',
  './5m.webp',
  './what.webp',
  './tik.webp',
  './face.webp',
  './ivibra.webp', 
  './fondo1.webp'
];

/* INSTALACIÓN */
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ACTIVACIÓN */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Ignorar peticiones externas
  if (new URL(req.url).origin !== location.origin) return;

  // NO CACHEAR STREAMING (audio/video) → así el streaming siempre va directo
  if (req.destination === 'audio' || req.destination === 'video') return;

  event.respondWith(
    caches.match(req).then(cachedResponse => {
      const fetchPromise = fetch(req).then(networkResponse => {
        if (req.method === 'GET' && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => cachedResponse || caches.match('./'));

      return cachedResponse || fetchPromise;
    })
  );
});
