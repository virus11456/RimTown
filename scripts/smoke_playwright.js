#!/usr/bin/env node
// v5.81.0 發版前的瀏覽器冒煙測試(選跑;需要 playwright 與本機 http server):
//   cd wordpress && python3 -m http.server 8126 &      # 先起本機站
//   npm i playwright@1 (一次) ;  node scripts/smoke_playwright.js [http://127.0.0.1:8126]
// 檢查:五種主題世界都能生成與產圖、英文介面地圖標籤/名牌無中文、鄰鎮生成不重複、住房分配、商隊交易、無 page error。
const BASE = process.argv[2] || 'http://127.0.0.1:8126';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('playwright 未安裝:npm i playwright@1 後再跑'); process.exit(0); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const THEMES = { harbor: '海風鎮', mountain: '礦山鎮', forest: '林間村', market: '市集城' };
(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let failed = 0;
  const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failed++; };
  for (const ui of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (route) => {
      const u = route.request().url(); const m = route.request().method();
      const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false });
      if (u.includes('/api/saves')) return json({ saves: [] });
      if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404);
      if (u.includes('/api/settings')) return json({ settings: {} });
      if (u.includes('/api/achievements')) return json({ achievements: [] });
      if (u.includes('/api/chat')) return json({ error: 'mock' }, 500);
      return json({});
    });
    await page.addInitScript(({ jwt, ui }) => { try { localStorage.setItem('rimtown-lang', ui); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); } catch (e) {} }, { jwt, ui });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);
    console.log(`[ui=${ui}]`);
    const r = await page.evaluate(async ({ THEMES }) => {
      const app = window.rimtownApp; const out = { themes: {} };
      const count = (w) => Object.values(w.agents).filter(a => !a.isPlayer).length;
      app._visitorMailboxTick();
      out.frontier = { npcs: count(app.world), theme: app.world.townTheme };
      app._syncHousing(); out.frontierHouses = Object.keys(app.tileMap._houseSubZones).length;
      for (const [theme, name] of Object.entries(THEMES)) {
        await app._ensureNeighborTown(theme);
        const w = new World(); w.townTheme = theme; w.townName = name; w.rosterMode = 'scripted'; w.reset();
        app.world = w; app.state = w.getState(); app._generateTileMapLayout(); app.tileMap.agentPositions = {}; app.world.paused = true; app._syncHousing();
        const tm = app.tileMap;
        out.themes[theme] = { npcs: count(w), mapTheme: tm.themeKey, houses: Object.keys(tm._houseSubZones).length, labelsCjk: (I18N.getLang() === 'en') ? Object.values(tm.labelPositions).map(l => I18N.t(l.name)).filter(n => /[一-鿿]/.test(n)).length : 0 };
      }
      const list = JSON.parse(localStorage.getItem('rimtown_town_list') || '[]');
      out.townListNames = list.map(t => t.name);
      // caravan on the last world
      app._visitorMailboxTick(); // 重新掛 onCaravan 到目前世界
      const w = app.world; w.otherTowns = [{ id: 't1', name: '邊境鎮' }]; w.lastCaravanDay = null;
      const before = w.stockpile.get('silver') + w.stockpile.get('wood') + w.stockpile.get('stone') + w.stockpile.get('food') + w.stockpile.get('cloth');
      w._caravanDaily();
      out.caravan = { traded: !!w.lastCaravanDay, anim: !!app.tileMap._caravanAnim };
      return out;
    }, { THEMES });
    check(r.frontier.npcs === 25 && r.frontier.theme === 'frontier', `邊境鎮 25 人 (got ${r.frontier.npcs})`);
    check(r.frontierHouses >= 18, `邊境鎮住房 ≥18 (got ${r.frontierHouses})`);
    for (const [theme, v] of Object.entries(r.themes)) {
      check(v.mapTheme === theme && v.npcs >= 15, `${theme}: 版面=${v.mapTheme} 人口=${v.npcs} 住房=${v.houses}`);
      if (ui === 'en') check(v.labelsCjk === 0, `${theme}: 英文介面地名標籤無中文 (${v.labelsCjk})`);
    }
    check(new Set(r.townListNames).size === r.townListNames.length && r.townListNames.length === 4, `鄰鎮各生成一次: ${r.townListNames.join('/')}`);
    check(r.caravan.traded && r.caravan.anim, '跨鎮商隊交易+動畫');
    check(errs.length === 0, `無 page error ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? `FAILED: ${failed}` : 'ALL OK');
  process.exit(failed ? 1 : 0);
})();
