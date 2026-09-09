// RimTown Service Worker - PWA Offline Support
const CACHE_NAME = 'rimtown-v5.68.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './pwa-manifest.json',
  './s2t.js',
  './changelog.js',
  './i18n.js',
  './chiptune.js',
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
  // v5.64.1 同網域 /api/ 也一律走網路、絕不快取:原本 cache-first 會把第一次抓到的
  // 雲端存檔清單/存檔內容一直用到下次改版(換 CACHE_NAME)才更新——玩家看到的
  // 「進度不見/改版才變」正是這個。非 GET 請求同樣不進快取。
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
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
