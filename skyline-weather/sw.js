// Skyline — service worker
// Caches the app shell (HTML/CSS/JS) so the interface loads instantly on
// repeat visits and works offline. Live weather/API requests are left
// alone (network-only) since forecast data must always be fresh.

const CACHE_NAME = 'skyline-shell-v1';
const APP_SHELL = ['./', './index.html', './styles.css', './script.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only manage caching for our own same-origin app-shell files.
  // Weather/geocoding/air-quality API calls go straight to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
