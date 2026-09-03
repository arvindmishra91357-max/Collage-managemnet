const CACHE_NAME = 'mgi-cyber-portal-v4.7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css?v=4.7.0',
  '/js/qrcode.min.js?v=4.7.0',
  '/js/jsqr.min.js?v=4.7.0',
  '/js/api.js?v=4.7.0',
  '/js/studentApp.js?v=4.7.0',
  '/js/adminApp.js?v=4.7.0',
  '/js/app.js?v=4.7.0',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell v4.7.0');
      return cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] Caching non-fatal err:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network first for all requests to ensure mobile devices always get fresh responsive updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.url.includes('/api/')) {
            return new Response(JSON.stringify({
              success: false,
              offline: true,
              message: 'You are currently offline. Please check your internet connection.'
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return caches.match('/index.html');
        });
      })
  );
});
