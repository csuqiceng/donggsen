const CACHE_NAME = 'fitness-island-static-v4';
const STATIC_ASSETS = [
  './styles.css?v=20260606-sync18',
  './app.js?v=20260606-sync18',
  './plan.json',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/animal-island/home-bg.webp',
  './assets/animal-island/animal-icon.png',
  './assets/animal-island/footer-sea.svg',
  './assets/acnh-avatars/alfonso.png',
  './assets/acnh-avatars/rosie.png',
  './assets/acnh-avatars/gulliver.png',
  './assets/acnh-avatars/tom-nook.png',
  './assets/acnh-avatars/timmy-tommy.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
