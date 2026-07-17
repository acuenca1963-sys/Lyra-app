// lyra-app-v6/service-worker.js
const CACHE_NAME = 'lyra-app-v6-cache';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/firebase.js',
  './js/auth.js',
  './js/perros.js',
  './js/reservas.js',
  './js/training.js',
  './js/facturas.js',
  './js/whatsapp.js',
  './js/configuracion.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js',
  'https://raw.githubusercontent.com/acuenca1963-sys/Lyra-app/main/logo-lyra.png'
];

// Instalar Service Worker y cachear recursos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('️ Error cacheando:', err);
      })
  );
  self.skipWaiting();
});

// Activar Service Worker y limpiar cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones y servir desde caché si no hay red
self.addEventListener('fetch', (event) => {
  // No cachear peticiones a Firebase (siempre necesitan red)
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('graph.facebook.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, devolverlo
        if (response) {
          return response;
        }
        // Si no, hacer la petición a red
        return fetch(event.request).then((response) => {
          // Si la respuesta es válida, cachearla
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
      .catch(() => {
        // Si falla todo, mostrar página offline
        return caches.match('./index.html');
      })
  );
});