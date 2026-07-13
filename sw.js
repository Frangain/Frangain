const CACHE_VERSION = 'frangain-pwa-v2';
const CACHE_PREFIX = 'frangain-pwa-';
const OFFLINE_URL = '/offline.html';
const APP_SHELL_ASSETS = [
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
const HTML_CONTENT_TYPE = 'text/html';
const STATIC_ASSET_EXTENSIONS = [
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.ico',
  '.webp',
  '.gif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf'
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

function isSuccessfulResponse(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default');
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes(HTML_CONTENT_TYPE);
}

function isStaticAsset(pathname) {
  return STATIC_ASSET_EXTENSIONS.some(function (extension) {
    return pathname.endsWith(extension);
  });
}

function fetchFresh(request) {
  return fetch(request, { cache: 'reload' });
}

function cacheResponse(request, response) {
  if (!isSuccessfulResponse(response)) {
    return Promise.resolve();
  }

  return caches.open(CACHE_VERSION).then(function (cache) {
    return cache.put(request, response.clone());
  });
}

function networkFirst(request) {
  return fetchFresh(request)
    .then(function (response) {
      return cacheResponse(request, response).then(function () {
        return response;
      });
    })
    .catch(function () {
      return caches.match(request).then(function (cachedResponse) {
        return cachedResponse || caches.match(OFFLINE_URL);
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cachedResponse) {
    const networkFetch = fetchFresh(request)
      .then(function (response) {
        return cacheResponse(request, response).then(function () {
          return response;
        });
      })
      .catch(function () {
        return cachedResponse;
      });

    return cachedResponse || networkFetch;
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(
        APP_SHELL_ASSETS.map(function (asset) {
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
            return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_VERSION;
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

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(requestUrl.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
