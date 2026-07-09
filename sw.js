const CACHE_VERSION = 'frangain-pwa-v1';
const OFFLINE_URL = '/offline.html';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/whitepaper.html',
  '/how_to_buy.html',
  '/story-manifesto.html',
  '/contact.html',
  '/ecosystem/',
  '/ecosystem/index.html',
  '/ecosystem/login.html',
  '/ecosystem/register.html',
  '/ecosystem/dashboard.html',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/css/bootstrap.min.css',
  '/css/font-awesome.min.css',
  '/css/themify-icons.css',
  '/css/owl.carousel.css',
  '/css/style.css',
  '/js/jquery-3.2.1.min.js',
  '/js/owl.carousel.min.js',
  '/js/main.js',
  '/js/pwa.js',
  '/img/favicon.ico',
  '/img/frangain-icon.svg',
  '/img/pwa-icon-192.png',
  '/img/pwa-icon-512.png',
  '/img/Frangain.png',
  '/img/logo.png',
  '/img/hero-bg.png',
  '/img/page-info-bg.png'
];

function offlineApiResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'An internet connection is required for this FRANGAIN Ecosystem action.',
      errors: {}
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(
        CORE_ASSETS.map(function (asset) {
          return cache.add(asset).catch(function () {
            return null;
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return cacheName !== CACHE_VERSION;
          })
          .map(function (cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(function () {
        return offlineApiResponse();
      })
    );
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const responseCopy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cachedResponse) {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      const networkFetch = fetch(request)
        .then(function (response) {
          const responseCopy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(function () {
          return cachedResponse;
        });

      return cachedResponse || networkFetch;
    })
  );
});
