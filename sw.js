/* DKUT HOSTELS — SERVICE WORKER (hostel/) */

const CACHE_VERSION = 'dkut-hostel-v2';
const DATA_CACHE = 'dkut-hostel-data-v1';

const STATIC_ASSETS = [
  '/hostel/',
  '/hostel/index.html',
  '/hostel/manifest.json',
  '/hostel/shared/css/theme.css',
  '/hostel/shared/js/config.js',
  '/hostel/shared/js/app.js',
  '/hostel/shared/js/layout.js',
  '/hostel/shared/js/firebase-init.js',
  '/hostel/shared/js/auth-state.js',
  '/hostel/shared/utils/security.js',
  '/hostel/shared/utils/helpers.js',
  '/hostel/shared/data/hostels.json',
  '/hostel/shared/data/hostels.mock.json',
  '/hostel/pages/home/index.html',
  '/hostel/pages/home/home.js',
  '/hostel/pages/hostel-details/index.html',
  '/hostel/pages/hostel-details/hostel-details.js',
  '/hostel/pages/locations/index.html',
  '/hostel/pages/locations/locations.js',
  '/hostel/pages/scam-reports/index.html',
  '/hostel/pages/scam-reports/scam-reports.js',
  '/hostel/pages/report-issue/index.html',
  '/hostel/pages/report-issue/report-issue.js',
  '/hostel/pages/login/index.html',
  '/hostel/pages/login/login.js',
  '/hostel/pages/signup/index.html',
  '/hostel/pages/signup/signup.js',
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
        caches.match(event.request).then(cached => cached || caches.match('/hostel/pages/home/index.html'))
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
