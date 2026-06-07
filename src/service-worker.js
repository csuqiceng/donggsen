const CACHE_NAME = 'fitness-island-static-v11';

const NETWORK_FIRST_PATHS = [
  '/app.js',
  '/styles.css',
  '/plan.json',
  '/manifest.webmanifest'
];

const CACHE_FIRST_EXTENSIONS = [
  'svg',
  'png',
  'webp',
  'jpg',
  'jpeg',
  'gif',
  'woff',
  'woff2'
];

const STATIC_ASSETS = [
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/animal-island/home-bg.webp',
  './assets/animal-island/animal-icon.png',
  './assets/animal-island/footer-sea.svg',
  './assets/acnh-avatars/alfonso.png',
  './assets/acnh-avatars/rosie.png',
  './assets/acnh-avatars/gulliver.png',
  './assets/acnh-avatars/isabelle.png',
  './assets/acnh-avatars/tom-nook.png',
  './assets/acnh-avatars/timmy-tommy.png',
  './assets/nav-icons/today.svg',
  './assets/nav-icons/island.svg',
  './assets/nav-icons/bag.svg',
  './assets/nav-icons/collection.svg',
  './assets/nav-icons/gift.svg',
  './assets/nav-icons/contribution.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (NETWORK_FIRST_PATHS.some(path => url.pathname.endsWith(path))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  const ext = url.pathname.split('.').pop().toLowerCase();
  if (CACHE_FIRST_EXTENSIONS.includes(ext)) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}
