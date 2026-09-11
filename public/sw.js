const CACHE_NAME = 'mgi-cyber-portal-v5.1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/qrcode.min.js',
  '/js/jsqr.min.js',
  '/js/api.js',
  '/js/studentApp.js',
  '/js/adminApp.js',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core app shell v5.0.0');
      return cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] Pre-caching err:', err));
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
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Bypass Service Worker entirely for backend APIs, uploads, and APK downloads
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.endsWith('.apk') ||
    url.pathname.includes('/apk') ||
    url.pathname.includes('/download/apk')
  ) {
    return;
  }

  // 2. Network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Match in cache, ignoring query strings (?v=...)
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;

        // Only return index.html for page navigation requests (NEVER for JS/CSS files)
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }

        return new Response('Network error occurred.', { status: 408, statusText: 'Request Timeout' });
      })
  );
});

