// RimTown Service Worker - PWA Offline Support
const CACHE_NAME = 'rimtown-v8.5.1';
// v6.82.2 首頁(/)與遊戲(/town)分頁。Vercel 開了 cleanUrls,index.html／town.html 會轉址到 / 與 /town,
// 轉址回應不能拿來回應頁面導覽,所以清單只放 './',遊戲頁另外試著快取 './town'(本機沒有乾淨網址就略過)
const ASSETS_TO_CACHE = [
  './',
  './style.css',
  './style-observer.css',
  './pwa-manifest.json',
  './s2t.js',
  './changelog.js',
  './i18n.js',
  './i18n-en.js',
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
  './sim-agent.js',
  './sim-conversation.js',
  './sim-town.js',
  './sim-economy.js',
  './sim-society.js',
  './sim-proposals.js',
  './sim-autonomy.js',
  './sim-events.js',
  './simulation.js',
  './sim-systems.js',
  './sim-ideas.js',
  './sim-towngen.js',
  './sim-freeprop.js',
  './sim-issues.js',
  './sim-pets.js',
  './sim-dark.js',
  './sim-wallet.js',
  './sim-crowd.js',
  './sim-tiers.js',
  './sim-housing.js',
  './sim-econ.js',
  './sim-flow.js',
  './sim-episode.js',
  './sim-class.js',
  './sim-traveler.js',
  './sim-crown.js',
  './sim-faith.js',
  './sim-faith2.js',
  './sim-tidings.js',
  './sim-press.js',
  './sim-bank.js',
  './sim-goods.js',
  './sim-diplo.js',
  './sim-civic.js',
  './sim-mind.js',
  './sim-politics.js',
  './sim-biz.js',
  './sim-culture.js',
  './sim-dream.js',
  './sim-legacy.js',
  './sim-assembly.js',
  './sim-ceremony.js',
  './sim-social.js',
  './sim-market.js',
  './sim-estate.js',
  './sim-look.js',
  './sim-union.js',
  './sim-power.js',
  './sim-finance.js',
  './sim-health.js',
  './sim-myth.js',
  './sim-myth2.js',
  './sim-money.js',
  './sim-tech.js',
  './sim-bio.js',
  './sim-calamity.js',
  './sim-aftermath.js',
  './sim-steam.js',
  './sim-ways.js',
  './sim-plague-ways.js',
  './sim-godbook.js',
  './sim-worldcal.js',
  './villager3d.js',
  './landing-3d.js',
  './tilemap.js',
  './vendor/three.min.js',
  './town3d.js',
  './app.js',
  './app-landing.js',
  './app-notify.js',
  './app-achievements.js',
  './app-loop.js',
  './app-towngen.js',
  './app-godhand.js',
  './app-towns.js',
  './app-chat.js',
  './app-mobile.js',
  './app-panels.js',
  './app-economy.js',
  './app-records.js',
  './icons/icon48.png',
  './icons/icon128.png',
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE).then(() => cache.add('./town').catch(() => {})))
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
        if (response.ok && !response.redirected) { // v6.82.2 轉址過的回應不快取(拿來回應導覽會失敗)
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
