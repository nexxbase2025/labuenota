
/* service-worker.js */
const CACHE_NAME = 'radio-max-v3'; // Cambia versión si modificas recursos
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
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ACTIVACIÓN */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Ignorar peticiones externas (de otro dominio)
  if (new URL(req.url).origin !== location.origin) return;

  // No cachear audio y video (streaming)
  if (req.destination === 'audio' || req.destination === 'video') return;

  event.respondWith(
    caches.match(req).then(cachedResponse => {
      // Inicia la petición a la red
      const fetchPromise = fetch(req).then(networkResponse => {
        // Solo cachear GET con respuesta exitosa
        if (req.method === 'GET' && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red, devolver la cache si existe o la página de inicio
        return cachedResponse || caches.match('./');
      });

      // Devuelve primero el cache (rápido) y luego actualiza cache en segundo plano
      return cachedResponse || fetchPromise;
    })
  );
});