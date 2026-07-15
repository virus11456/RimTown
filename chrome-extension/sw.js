// RimTown Service Worker - PWA Offline Support
const CACHE_NAME = 'rimtown-v3.7.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './i18n.js',
  './quest-system.js',
  './industry.js',
  './farm.js',
  './processing.js',
  './daily-news.js',
  './npc-events.js',
  './npc-quests.js',
  './custom-npc.js',
  './prosperity.js',
  './simulation.js',
  './tilemap.js',
  './app.js',
  './icons/icon48.png',
  './icons/icon128.png',
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app assets, network-first for API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls (LLM endpoints) always go to network
  if (url.hostname !== location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
