const FRANGAIN_CACHE = 'frangain-pwa-2026-07-16';
const FRANGAIN_CACHE_PREFIX = 'frangain-pwa-';
const OFFLINE_PAGE = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_PAGE,
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
  '/img/Frangain.png',
  '/img/favicon.ico',
  '/img/hero-bg.png',
  '/img/page-info-bg.png'
];
const STATIC_FILE_PATTERN = /\.(?:css|js|png|jpg|jpeg|svg|ico|webp|gif|woff2?|ttf|eot|otf)$/i;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isStaticRequest(url) {
  return STATIC_FILE_PATTERN.test(url.pathname);
}

function jsonOfflineResponse() {
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

function canCache(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default');
}

function writeToCache(request, response) {
  if (!canCache(response)) {
    return Promise.resolve();
  }

  return caches.open(FRANGAIN_CACHE).then(function (cache) {
    return cache.put(request, response.clone());
  });
}

function networkFirst(request) {
  return fetch(request, { cache: 'no-store' })
    .then(function (response) {
      return writeToCache(request, response).then(function () {
        return response;
      });
    })
    .catch(function () {
      return caches.match(request).then(function (cachedResponse) {
        return cachedResponse || caches.match(OFFLINE_PAGE);
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cachedResponse) {
    const networkResponse = fetch(request)
      .then(function (response) {
        return writeToCache(request, response).then(function () {
          return response;
        });
      })
      .catch(function () {
        return cachedResponse;
      });

    return cachedResponse || networkResponse;
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(FRANGAIN_CACHE).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
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
            return cacheName.startsWith(FRANGAIN_CACHE_PREFIX) && cacheName !== FRANGAIN_CACHE;
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
  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(function () {
        return jsonOfflineResponse();
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

  if (isStaticRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
