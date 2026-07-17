// lyra-app-v6/service-worker.js
const CACHE_NAME = 'lyra-app-v6-cache-v2';

// Lista de archivos a cachear (Hemos quitado ./index.html porque está en la raíz, no en lyra-app-v6/)
const urlsToCache = [
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

// Instalar Service Worker (cachear archivos individualmente para evitar fallos por 404)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('✅ Cache abierto');
      
      // Cachear uno por uno. Si uno falla (404), no rompe la instalación de los demás
      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log('✅ Cacheado:', url);
          } else {
            console.warn('⚠️ Ignorado (no 200 OK):', url);
          }
        } catch (err) {
          console.warn('⚠️ No se pudo cachear (probablemente no existe aún):', url, err);
        }
      }
      
      return true;
    })
  );
  self.skipWaiting(); // Forzar la activación inmediata
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
  self.clients.claim(); // Tomar el control de las páginas inmediatamente
});

// Interceptar peticiones y servir desde caché si no hay red
self.addEventListener('fetch', (event) => {
  // No interceptar ni cachear peticiones a Firebase o Meta (siempre necesitan red y son dinámicas)
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('graph.facebook.com') ||
      event.request.url.includes('corsproxy.io')) {
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
          // Si la respuesta es válida, cachearla para el futuro
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
        // Si falla todo (sin red), mostrar página offline (opcional)
        return new Response('Sin conexión a internet', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});