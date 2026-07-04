const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const CACHE_VERSION = 'dkut-hostel-v3';
const DATA_CACHE = 'dkut-hostel-data-v1';

const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'shared/css/theme.css',
  BASE_PATH + 'shared/js/config.js',
  BASE_PATH + 'shared/js/app.js',
  BASE_PATH + 'shared/js/layout.js',
  BASE_PATH + 'shared/js/firebase-init.js',
  BASE_PATH + 'shared/js/auth-state.js',
  BASE_PATH + 'shared/utils/security.js',
  BASE_PATH + 'shared/utils/helpers.js',
  BASE_PATH + 'shared/data/hostels.json',
  BASE_PATH + 'shared/data/hostels.mock.json',
  BASE_PATH + 'pages/home/index.html',
  BASE_PATH + 'pages/home/home.js',
  BASE_PATH + 'pages/hostel-details/index.html',
  BASE_PATH + 'pages/hostel-details/hostel-details.js',
  BASE_PATH + 'pages/locations/index.html',
  BASE_PATH + 'pages/locations/locations.js',
  BASE_PATH + 'pages/scam-reports/index.html',
  BASE_PATH + 'pages/scam-reports/scam-reports.js',
  BASE_PATH + 'pages/report-issue/index.html',
  BASE_PATH + 'pages/report-issue/report-issue.js',
  BASE_PATH + 'pages/login/index.html',
  BASE_PATH + 'pages/login/login.js',
  BASE_PATH + 'pages/signup/index.html',
  BASE_PATH + 'pages/signup/signup.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== DATA_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  if (url.hostname.includes('firebase') || url.hostname.includes('google') ||
      url.hostname.includes('googleapis') || url.hostname.includes('postimg') ||
      url.hostname.includes('dicebear') || url.hostname.includes('unsplash')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  if (url.pathname.includes('hostels.json')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(DATA_CACHE).then(c => c.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match(BASE_PATH + 'pages/home/index.html'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        return response;
      });
    })
  );
});
