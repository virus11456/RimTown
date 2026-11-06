// v6.76.7 回歸:城鎮列表(登入):被誤標成「自己建的」鄰鎮回到鄰鎮區;同名鄰鎮與比雲端舊的本機副本收進「重複與舊的本機備份」,每座鎮只列一筆;
// 只在本機、雲端沒有同名的鎮自動補傳雲端;存檔時更正誤標的來源。不會自動刪除任何存檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    // 截圖裡的雲端存檔:邊境鎮(自己的)、礦山鎮(目前,被標成 user)、海風鎮兩座(都被標成 user,一座第 9 天一座第 1 天)、林間村(鄰鎮)
    const cloud = [
      { town_id: 'town_front', town_name: '邊境鎮', town_theme: 'frontier', origin: 'user', season: '秋季', year: 2, day: 12, population: 22, updated_at: '2026-11-06T03:15:44Z' },
      { town_id: 'town_mine', town_name: '礦山鎮', town_theme: 'mountain', origin: 'user', season: '春季', year: 1, day: 7, population: 16, updated_at: '2026-11-06T03:30:26Z' },
      { town_id: 'town_harb9', town_name: '海風鎮', town_theme: 'harbor', origin: 'user', season: '春季', year: 1, day: 9, population: 14, updated_at: '2026-11-06T03:25:13Z' },
      { town_id: 'town_harb1', town_name: '海風鎮', town_theme: 'harbor', origin: 'user', season: '春季', year: 1, day: 1, population: 18, updated_at: '2026-11-04T09:24:47Z' },
      { town_id: 'town_forest', town_name: '林間村', town_theme: 'forest', origin: 'neighbor', season: '春季', year: 1, day: 1, population: 16, updated_at: '2026-11-04T01:26:51Z' },
    ];
    const posted = [];
    await page.route('**/api/**', r => { const req = r.request(); const u = req.url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } });
      if (u.includes('/api/save') && req.method() === 'POST') { try { const b = JSON.parse(req.postData() || '{}'); posted.push({ id: b.town_id, name: b.town_name, origin: b.origin }); } catch (e) {} return j({ success: true }); }
      if (/\/api\/saves?(\?|$)/.test(u) && req.method() === 'GET') return j({ saves: cloud });
      return j({ saves: [], reply: '' }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
      const blob = w.serialize();
      // 本機:八月的舊邊境鎮副本(不同 id、進度較少)、一座只在本機的自建鎮
      const old = JSON.parse(JSON.stringify(blob)); old.townName = '邊境鎮'; old.clock = Object.assign({}, old.clock, { season: '夏季', year: 2, day: 9 });
      const solo = JSON.parse(JSON.stringify(blob)); solo.townName = '小石村';
      await app._writeOtherTown('town_oldfront', old); await app._writeOtherTown('town_solo', solo);
      const L = app._getTownList().filter(x => !['town_oldfront', 'town_solo', 'town_front', 'town_mine', 'town_harb9', 'town_harb1', 'town_forest'].includes(x.id));
      L.push({ id: 'town_oldfront', name: '邊境鎮', theme: 'frontier', origin: 'user', season: '夏季', year: 2, day: 9, population: 20, savedAt: '2026-08-18T07:25:29Z', world: 'w0' });
      L.push({ id: 'town_solo', name: '小石村', theme: 'frontier', origin: 'user', season: '春季', year: 1, day: 3, population: 12, savedAt: '2026-11-05T07:25:29Z', world: 'w0' });
      app._saveTownList(L);
      app.currentTownId = 'town_mine';
      const box = document.createElement('div'); document.body.appendChild(box);
      await app._renderCloudTownList(box);
      for (let i = 0; i < 40 && app._syncingLocal !== false; i++) await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 300));
      const secs = {}; let cur = null;
      for (const el of box.querySelectorAll('h4.town-section, .town-item, details.town-fold > summary')) {
        if (el.matches('h4.town-section')) { cur = el.textContent.replace(/\s*\d+\s*$/, '').trim(); secs[cur] = []; continue; }
        if (el.matches('summary')) { cur = 'FOLD'; secs[cur] = []; continue; }
        const inFold = !!el.closest('details.town-fold'); const key = inFold ? 'FOLD' : cur;
        (secs[key] = secs[key] || []).push(el.querySelector('.town-name')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160));
      }
      // 存檔時更正來源:礦山鎮(列表條目寫 user)存檔後變成 neighbor
      const L2 = app._getTownList(); const em = L2.find(x => x.id === 'town_mine'); if (em) em.origin = 'user'; else L2.push({ id: 'town_mine', name: '礦山鎮', theme: 'mountain', origin: 'user' }); app._saveTownList(L2);
      w.townTheme = 'mountain'; w.townName = '礦山鎮'; app._saveCurrentTown();
      const origin = app._getTownList().find(x => x.id === 'town_mine')?.origin;
      // 自己的邊境主題鎮存檔仍是 user
      w.townTheme = 'frontier'; w.townName = '邊境鎮'; app.currentTownId = 'town_front'; app._saveCurrentTown();
      const originUser = app._getTownList().find(x => x.id === 'town_front')?.origin;
      return { secs, origin, originUser, stillLocal: { old: app._hasLocalTown('town_oldfront'), solo: app._hasLocalTown('town_solo') } };
    });
    const keys = Object.keys(r.secs); const mineK = keys.find(k => /我的城鎮|My towns/.test(k)); const nbK = keys.find(k => /鄰鎮|Neighbo/.test(k));
    const mine = r.secs[mineK] || [], nb = r.secs[nbK] || [], fold = r.secs.FOLD || [];
    const has = (arr, re) => arr.some(x => re.test(x));
    ok(mine.length === 2 && has(mine, /邊境鎮|Frontier/) && has(mine, /小石村/), '「我的城鎮」只剩自己的邊境鎮和只在本機的小石村', { mine });
    ok(nb.length === 3 && has(nb, /礦山鎮|Mine Ridge/) && has(nb, /林間村|Greenwood/) && nb.filter(x => /海風鎮|Seabreeze/.test(x)).length === 1, '被誤標的礦山鎮、海風鎮回到鄰鎮區,海風鎮只列一座', { nb });
    ok(fold.length === 2 && has(fold, /海風鎮|Seabreeze/) && has(fold, /邊境鎮|Frontier/) && fold.some(x => /舊的本機備份|Old local backup/.test(x)), '多出來的海風鎮與八月的舊本機副本收進「重複與舊的本機備份」', { fold });
    ok(posted.some(p => p.id === 'town_solo') && !posted.some(p => p.id === 'town_oldfront'), '只在本機的小石村自動補傳雲端;舊的同名副本不傳', posted);
    ok(r.stillLocal.old && r.stillLocal.solo, '不會自動刪除本機存檔', r.stillLocal);
    ok(r.origin === 'neighbor' && r.originUser === 'user', '存檔時更正來源:礦山鎮→鄰鎮,自己的邊境鎮仍是自建', { origin: r.origin, originUser: r.originUser });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
