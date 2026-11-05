// v6.57.0 房子跟著時代升級:新房子照當下時代、住戶出錢翻修(有錢人先)、3D 依等級重建、城市鋪石板路、王都鐘塔、存讀檔
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world, tm = app.tileMap; app._setPaused?.(true);
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const H = HOUSING.S(w); const era0 = w.research.currentEra(); const start = Object.values(H.lv);
    const out = { era0, startAll: start.every(x => x === Math.max(0, Math.min(2, era0 - 1))), homes: start.length };
    // 進入工坊時代:有錢的住戶翻修
    w.research.currentEra = () => 3; WALLET.S(w);
    const homes = {}; for (const a of npcs) { const h = HOUSING.houseOf(w, a); if (h) (homes[h] || (homes[h] = [])).push(a); }
    const ids = Object.keys(homes); const richHome = ids[0], poorHome = ids[1];
    for (const a of homes[richHome]) w.wallet.bal[a.agentId] = 1000; for (const a of homes[poorHome]) w.wallet.bal[a.agentId] = 0;
    const before = { rich: H.lv[richHome], poor: H.lv[poorHome] }; const sil = WALLET.get(w, homes[richHome][0]) + (homes[richHome][1] ? WALLET.get(w, homes[richHome][1]) : 0);
    const _r = Math.random; Math.random = () => 0.01; try { for (let i = 0; i < 6; i++) HOUSING.daily(w); } finally { Math.random = _r; }
    const sil2 = WALLET.get(w, homes[richHome][0]) + (homes[richHome][1] ? WALLET.get(w, homes[richHome][1]) : 0);
    out.rich = [before.rich, H.lv[richHome]]; out.poor = [before.poor, H.lv[poorHome]]; out.paid = sil - sil2;
    out.log = (w.messageLog || []).slice(-30).some(m => /🔨/.test(m.content || ''));
    // 3D:等級變了會重建、樣式簽章跟著變
    app.state = w.getState(); for (let i = 0; i < 3; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); }
    const sig1 = tm._styleSig; w.tierState.lv = 2; for (let i = 0; i < 3; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); } /* 低畫質每兩格才畫一次 */ const sig2 = tm._styleSig;
    out.sigChanged = sig1 !== sig2; out.tierLv = tm.tierLv; out.calls = tm.renderer.info.render.calls;
    // 存讀檔
    const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = JSON.stringify(w2.housing.lv) === JSON.stringify(H.lv); w2.reset(); out.reset = !w2.housing;
    return out;
  });
  ok(r.homes > 3 && r.startAll, '新房子照當下時代的樣式', r);
  ok(r.rich[1] === 2 && r.paid > 0, '有錢的住戶花錢翻修到磚造樓房', r);
  ok(r.poor[1] === r.poor[0], '沒錢的住戶房子維持舊樣', r);
  ok(r.log, '翻修有記在動態裡', r);
  ok(r.sigChanged && r.tierLv === 2, '等級／翻修有變時 3D 會重建', r);
  ok(r.calls < 200, '繪製次數維持在合理範圍（合併繪製）', r);
  ok(r.rt && r.reset, '翻修程度存讀檔保留、新城鎮重來', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
