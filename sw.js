const BASE_PATH = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const CACHE_VERSION = 'dkut-hostel-v9';
const DATA_CACHE = 'dkut-hostel-data-v4';
const IMAGE_CACHE = 'dkut-hostel-images-v1';

const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'shared/css/theme.min.css',
  BASE_PATH + 'shared/js/config.js',
  BASE_PATH + 'shared/js/app.js',
  BASE_PATH + 'shared/js/layout.js',
  BASE_PATH + 'shared/js/firebase-init.js',
  BASE_PATH + 'shared/js/auth-state.js',
  BASE_PATH + 'shared/utils/security.js',
  BASE_PATH + 'shared/utils/helpers.js',
  BASE_PATH + 'shared/data/hostels.json',
  BASE_PATH + 'shared/data/services.json',
  BASE_PATH + 'backups/latest_hostels.json',
  BASE_PATH + 'backups/latest_services.json',
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
  BASE_PATH + 'pages/services/index.html',
  BASE_PATH + 'pages/services/services.js',
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
      Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== DATA_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // 1. Image Caching Strategy (Cache First with Background Refresh) for postimg / unsplash / cdn images
  if (url.hostname.includes('postimg') || url.hostname.includes('unsplash') ||
      url.hostname.includes('dicebear') || url.hostname.includes('imgbb') ||
      url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        if (cached) {
          // Serve from image cache instantly, refresh in background
          event.waitUntil(fetchPromise);
          return cached;
        }

        const networkRes = await fetchPromise;
        if (networkRes) return networkRes;
        
        // Return 503 or empty response if network failed and no cached image
        return new Response('', { status: 503, statusText: 'Image unavailable offline' });
      })
    );
    return;
  }

  // 2. Data JSON Strategy (Network with 2.5s Timeout -> Fallback to Cache)
  if (url.pathname.includes('hostels.json') || url.pathname.includes('services.json')) {
    event.respondWith(
      new Promise(resolve => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          caches.open(DATA_CACHE).then(c => c.match(event.request)).then(cached => {
            if (cached) resolve(cached);
          });
        }, 2500);

        fetch(event.request, { cache: 'no-cache' }).then(response => {
          clearTimeout(timer);
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then(c => c.put(event.request, clone));
            if (!timedOut) resolve(response);
          } else {
            caches.open(DATA_CACHE).then(c => c.match(event.request)).then(cached => {
              if (!timedOut) resolve(cached || response);
            });
          }
        }).catch(() => {
          clearTimeout(timer);
          caches.open(DATA_CACHE).then(c => c.match(event.request)).then(cached => {
            resolve(cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
          });
        });
      })
    );
    return;
  }

  // 3. Navigation HTML pages
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

  // 4. Other static assets (Stale While Revalidate)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});
