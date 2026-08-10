// lyra-app-v6/service-worker.js
const CACHE_NAME = 'lyra-app-v6-cache-v4'; // v4: Network-First para JS

// Archivos a cachear (SIN index.html ni auth.js - esos siempre se descargan frescos)
const urlsToCache = [
  './css/styles.css',
  './js/firebase.js',
  './js/perros.js',
  './js/reservas.js',
  './js/training.js',
  './js/facturas.js',
  './js/whatsapp.js',
  './js/configuracion.js',
  './js/empleados.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js',
  'https://raw.githubusercontent.com/acuenca1963-sys/Lyra-app/main/logo-lyra.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('✅ Cache v4 abierto');
      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log('✅ Cacheado:', url);
          }
        } catch (err) {
          console.warn('⚠️ Ignorado:', url);
        }
      }
      return true;
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  // NUNCA cachear estas URLs críticas (siempre desde la red)
  const url = event.request.url;
  
    // 🚨 LISTA NEGRO: URLs que NUNCA deben pasar por caché del Service Worker
  const urlEsCritica = 
      url.includes('firebaseio.com') || 
      url.includes('firestore.googleapis.com') ||  // Firestore en tiempo real
      url.includes('securetoken.googleapis.com') || // Tokens Firebase Auth
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('graph.facebook.com') ||
      url.includes('corsproxy.io') ||
      url.endsWith('index.html') ||
      url.endsWith('auth.js') ||
      url.endsWith('empleados.js') ||
      url.includes('/Listen/channel') ||  // Canal de escucha Firestore
      url.includes('/rpc');  // Llamadas RPC de Firestore
      
    if (urlEsCritica) {
    // 🔇 PASSTHROUGH: El SW no toca estas URLs. El navegador las gestiona directamente.
    // Esto evita errores falsos en consola cuando Firebase reconecta o el token expira.
    event.respondWith(fetch(event.request));
    return;
  }

    // 🚨 NETWORK-FIRST PARA ARCHIVOS JS (Arregla el bug en móvil)
  if (url.endsWith('.js') || url.includes('.js?')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la red funciona, actualizamos caché y devolvemos versión fresca
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red (offline), servimos desde caché
          return caches.match(event.request).then((response) => {
            return response || new Response('Sin conexión JS', { status: 503 });
          });
        })
    );
    return;
  }

  // Para el resto (imágenes, CSS), caché normal
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      return new Response('Sin conexión', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});