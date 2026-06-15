// SmartGrid Monitor — service worker v21
// Strategy:
//   * App shell (HTML/icons/manifest) → CACHE FIRST, falling back to network.
//     This makes the app open instantly and work even when offline.
//   * API requests (Sheety) → NETWORK ONLY. We never cache API responses
//     because they must be fresh (live account data).
//
// On every page load, the SW also tries to refresh the cached shell in the
// background so updates roll out without manual cache clear.

const CACHE_NAME = 'sg-monitor-v21';
const SHELL_ASSETS = [
  './',
  './SmartGrid_Dashboard_v21.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  // Pre-cache the app shell on first install
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete old caches from previous versions so we don't leak storage
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Sheety API → always network (live data, never serve stale)
  if (url.hostname.endsWith('sheety.co')) {
    return; // let the browser handle it normally, no SW interception
  }

  // Same-origin requests (the app shell) → cache-first with background refresh
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkRes) => {
          // Refresh the cache in the background so the next visit gets latest
          if (networkRes && networkRes.ok && event.request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkRes.clone()));
          }
          return networkRes;
        }).catch(() => cached); // offline → return cached if we have it

        return cached || fetchPromise;
      })
    );
  }
});
