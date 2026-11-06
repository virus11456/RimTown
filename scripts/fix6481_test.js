// v6.48.1 回歸:存檔空間不足時重試首次造訪不會累積沒有存檔的同名城鎮;合併別台裝置的城鎮紀錄後相連城鎮不超過 10 座;帳號選單開著旋轉螢幕不會被切掉
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    let cloudDown = true;
    await page.route('**/api/**', r => { const req = r.request(); const u = req.url(); const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } });
      if (u.includes('/api/save') && req.method() === 'POST') return cloudDown ? j({ error: 'down' }, 500) : j({ success: true });
      return j({ saves: [], reply: '' }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1');
      for (const k of ['rimtown_harbor_unlocked', 'rimtown_mountain_unlocked', 'rimtown_forest_unlocked', 'rimtown_market_unlocked']) localStorage.setItem(k, '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    // 1) 存檔空間不足時重試
    const r1 = await page.evaluate(async () => {
      const app = window.rimtownApp; app._gameAlert = () => {}; app._coachTravelTo = () => {};
      const c = app._discoverGenTown('merchant'); const seed = c.seed;
      const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('rimtown_town_') && String(v).length > 20000) throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); };
      for (let i = 0; i < 3; i++) await app._visitGenTown(seed);
      const failed = app._getTownList().filter(tw => tw.name === c.name).length;
      Storage.prototype.setItem = orig;
      // 舊版留下的兩筆空殼也要清掉
      const L = app._getTownList(); L.push({ id: 'ghost1', name: c.name, theme: c.key, origin: 'generated' }, { id: 'ghost2', name: c.name, theme: c.key, origin: 'generated' }); app._saveTownList(L);
      await app._visitGenTown(seed);
      const okList = app._getTownList().filter(tw => tw.name === c.name);
      return { failed, after: okList.length, hasSave: okList.every(tw => !!localStorage.getItem('rimtown_town_' + tw.id)), townId: TownGen.cards().find(x => x.seed === seed).townId };
    });
    ok(r1.failed === 0, '空間不足時重試三次,城鎮列表沒有多出空殼', r1);
    ok(r1.after === 1 && r1.hasSave && r1.townId, '有空間後只留一座、而且有存檔(舊空殼一起清掉)', r1);
    // 2) 合併別台裝置的紀錄
    const r2 = await page.evaluate(() => {
      const app = window.rimtownApp; for (let i = 0; i < 6; i++) app._discoverGenTown('merchant');
      const before = TownGen.liveCount();
      const other = { base: 'u:tester', n: 40, list: [] };
      for (let i = 0; i < 4; i++) other.list.push({ seed: TownGen.hash('other-device:' + i) || 1, found: 50 + i, via: 'rumor', by: '', r: 1, id: null });
      TownGen.mergeCompact(other);
      return { before, after: TownGen.liveCount(), cards: TownGen.cards().length };
    });
    ok(r2.cards >= 10 && r2.after >= r2.before && r2.after >= r2.cards, 'v6.76.0 合併別台裝置的城鎮紀錄後,探索過的城鎮全部保留可達(不再降回只有傳聞)', r2);
    // 3) 帳號選單開著旋轉螢幕
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.rimtownApp._showAccountMenu()); await page.waitForTimeout(250);
    const fits = async () => page.evaluate(() => { const p = document.getElementById('account-menu-popup'); if (!p) return null; const b = p.getBoundingClientRect(); const lo = p.querySelector('[data-action="auth-logout"]'); lo.scrollIntoView({ block: 'nearest' }); const l = lo.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), logout: Math.round(l.bottom), vh: innerHeight }; });
    const p1 = await fits();
    await page.setViewportSize({ width: 568, height: 320 }); await page.waitForTimeout(400); let p2 = await fits(); for (let i = 0; i < 8 && !(p2 && p2.bottom <= p2.vh && p2.top >= 0 && p2.logout <= p2.vh); i++) { await page.waitForTimeout(200); p2 = await fits(); } // 轉向後選單重新定位,機器忙時會晚一點
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); const p3 = await fits();
    ok(p1 && p1.bottom <= p1.vh, '直向:選單在畫面內', p1);
    ok(p2 && p2.bottom <= p2.vh && p2.top >= 0 && p2.logout <= p2.vh, '開著選單轉成橫向(568×320):不被切掉、登出看得到', p2);
    ok(p3 && p3.top >= 50 && p3.bottom <= p3.vh, '轉回直向:回到原本位置', p3);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
