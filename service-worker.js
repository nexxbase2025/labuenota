
/* service-worker.js */
const CACHE_NAME = 'la-buenota-radio-online-v4'; // ⬅ sube versión
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
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

/* ACTIVACIÓN: limpia versiones viejas */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

/* FETCH */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar otros orígenes
  if (url.origin !== location.origin) return;

  // No cachear audio, video ni el app.js (para evitar JS viejo)
  if (req.destination === 'audio' || req.destination === 'video' || url.pathname.endsWith('/app.js') || url.pathname.endsWith('app.js')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Estrategia cache-then-network para lo demás
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(networkRes => {
        if (req.method === 'GET' && networkRes.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => cached || caches.match('./'));
      return cached || fetchPromise;
    })
  );
});

