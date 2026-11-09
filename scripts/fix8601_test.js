// v8.6.1 研究進度不會卡在超過 100%：發明家靈光加進度後立刻完成；疫苗賽跑暫停研究時，滿了的也會完成；介面最多顯示 100%
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const R = w.research; const out = {};
    const startAny = () => { const av = R.getAvailable(); R.startResearch(av[0].key); return R.projects[R.current]; };
    // 1) 發明家靈光:90% 再加 15% → 立刻完成
    let p = startAny(); p.progress = Math.round(p.cost * 0.9); const k1 = p.key;
    const inv = Object.values(w.agents).find(a => !a.isPlayer && a.job); const IS = w.ideaSystem; const R0 = Math.random;
    if (IS && inv) { const jk0 = inv.job.key; inv.job.key = 'researcher'; IS.lastInventDay = -999; Math.random = () => 0; try { IS._invent(w, [inv]); } catch (e) { out.err = e.message; } Math.random = R0; inv.job.key = jk0; }
    out.flash = { status: R.projects[k1].status, cur: R.current, pct: Math.round(R.projects[k1].progress / R.projects[k1].cost * 100) };
    // 2) 疫苗賽跑中研究暫停,但已經滿了的要完成
    p = startAny(); const k2 = p.key; p.progress = p.cost + 50; w.calamity = w.calamity || {}; const oldCur = w.calamity.cur; w.calamity.cur = { ...(oldCur || {}), vax: { done: false } };
    R.dailyUpdate(w); out.vax = { status: R.projects[k2].status, cur: R.current, prog: R.projects[k2].progress === R.projects[k2].cost }; w.calamity.cur = oldCur;
    // 3) 舊存檔卡在 101%:沒有研究點、沒有研究員也會完成
    p = startAny(); const k3 = p.key; p.progress = Math.round(p.cost * 1.01); const rp = w.stockpile.get('research_points'); if (rp > 0) w.stockpile.consume('research_points', rp, w.tickCount, 'test'); const _sp = R._scholarPts; R._scholarPts = () => 0; R._carry = 0;
    R.dailyUpdate(w); R._scholarPts = _sp; out.old = { status: R.projects[k3].status };
    // 4) 介面最多 100%
    p = startAny(); p.progress = p.cost * 1.2; app.state = w.getState(); const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('econ-tech'); else { app.activeTab = 'econ-tech'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
    out.ui = [...document.querySelectorAll('.research-current .progress-text')].map(e => e.textContent);
    return out;
  });
  ok(r.flash.status === 'complete' && r.flash.pct === 100, '發明家靈光把進度加過頭時，研究立刻完成（不會停在 105%）', r.flash);
  ok(r.vax.status === 'complete' && r.vax.prog, '疫苗賽跑暫停研究時，已經做滿的研究還是會完成', r.vax);
  ok(r.old.status === 'complete', '舊存檔卡在 101% 的研究，隔天就完成（就算沒有研究點）', r.old);
  ok(r.ui.length && r.ui.every(x => parseInt(x) <= 100), '介面上的研究進度最多顯示 100%', r.ui);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
