// v11.12.0 煙霧測試：首長真的會被問、借錢那條路走得完（開發用，完整測試在 v111200_test.js）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8197/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message)); page.on('console', m => { const x = m.text(); if (/\[Fiscal\]|\[Decide\]|\[Bank\]|\[Office\]/.test(x)) console.log('console', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 });
  await page.addScriptTag({ path: __dirname + '/v111200_setup.js' });
  const r = await page.evaluate(() => {
    const S = window.__fisc.setup(7); const { w, M, BK } = S; const out = { on: DECIDE.on(w), mayor: !!M, banker: !!BK, view: TREASURY.view(w).days, low: TREASURY.low(w), canHire: FISCAL.canHire(w), blocked: FISCAL.blocked(w) };
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && (o.K.key === 'fiscTight' || o.K.key === 'bankDesk')) seen.push(o.K.key + ':' + o.op.id); });
    const c = FISCAL.tightDaily(w); out.asked = !!c; out.dec = FISCAL.view(w).tight?.dec; out.seen = seen.slice();
    out.facts = c ? DECIDE.KINDS.fiscTight.facts(w, M, c) : '';
    // 再問一次並直接選借錢
    const X = FISCAL.TT(w); X.last = -99; X.dec = null; X.pend = null; const c2 = FISCAL.tightDaily.call(null, w);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const r2 = await page.evaluate(() => {
    const S = window.__fisc.setup(8); const { w, M, BK } = S; const X = FISCAL.TT(w); const ctx = { d: w._absDay(), tok: 99 }; X.pend = { d: ctx.d, tok: 99, by: M.agentId };
    const ops = FISCAL.tightOptions(w, M, ctx); const out = { ids: ops.map(o => o.id) }; const bond = ops.find(o => o.id === 'bond'); out.bankFacts = '';
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K.key === 'bankDesk') seen.push(o.op.id); });
    const s0 = w.stockpile.get('silver'); out.res = bond ? bond.run(w, M) : null; out.bank = seen; const p = w.proposals.items.find(x => x.kind === 'fisc_bond' && x.status === 'open'); out.prop = p ? { amt: p.amt, desc: w.proposals._fill(p.dk, p.dp) } : null;
    if (p) { w.proposals._decide(w, p, 'approve', 'mayor'); out.after = { st: p.status, silver: Math.round(w.stockpile.get('silver') - s0), bond: FISCAL.view(w).bond, burden: FISCAL.burden(w) }; }
    return out;
  });
  console.log(JSON.stringify(r2, null, 1));
  await browser.close();
})();
