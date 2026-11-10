// v9.9.1 三項整理:罷工合一(工會過半的行交給工會)、國王民心⇄村民對國王的看法、新開的店也能被提案勒令歇業
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const out = {}; const rnd = Math.random; const d = w._absDay();
    // A. 罷工合一
    const M = MARKET.S(w); const k = 'farm'; const jobKey = Object.keys(MARKET.JOB2S).find(j => MARKET.JOB2S[j] === k);
    const boss = all[0]; const ws = all.slice(1, 7); for (const a of ws) { a.job = Object.assign({}, a.job || {}, { key: jobKey }); a.mood = 30; }
    M.owners[k] = boss.agentId; M.pay[k] = 0.5; M.low = { [k]: d - 30 }; M.strike = {};
    const ws0 = MARKET.workersOf(w, k, all).filter(a => a.agentId !== boss.agentId);
    const U = UNION.S(w); U.on = false; Math.random = () => 0.1; try { MARKET.unrest(w, all, d); } finally { Math.random = rnd; }
    out.noUnion = !!M.strike[k] && M.strike[k] >= d;
    M.strike = {}; U.on = true; U.members = {}; for (const a of ws0) U.members[a.agentId] = d; Math.random = () => 0.1; try { MARKET.unrest(w, all, d); } finally { Math.random = rnd; }
    out.withUnion = !!M.strike[k]; out.wsN = ws0.length;
    M.strike = {}; U.members = {}; U.members[ws0[0].agentId] = d; Math.random = () => 0.1; try { MARKET.unrest(w, all, d); } finally { Math.random = rnd; }
    out.minority = !!M.strike[k]; U.on = false; U.members = {};
    // B. 國王民心 ⇄ 村民看法
    const MI = MIND.S(w); const C = CROWN.S ? CROWN.S(w) : (w.crown || (w.crown = {})); const kingA = all[8];
    const legit = (opv) => { for (const a of all) if (MI.op[a.agentId]) MI.op[a.agentId].king = opv; C.legit = 50; for (const a of all) a.mood = 50; CROWN.legitimacy(w, C, kingA); return C.legit; };
    out.lo = legit(-2); out.hi = legit(2);
    for (const a of all) if (MI.op[a.agentId]) MI.op[a.agentId].king = 0; C.legit = 90; const before = MI.op[all[2].agentId].king; for (let i = 0; i < 30; i++) CROWN.legitimacy(w, C, kingA); out.opUp = { before, after: MI.op[all[2].agentId].king };
    // C. 新開的店能被提案勒令歇業
    const B = BIZ.S(w); const owner = all[10]; const sh = { id: 'sx1', type: 'bakery', name: ['測試麵包坊', 'Test Bakery'], owner: owner.agentId, price: 3, till: 0, week: 0, profit: 0, lossDays: 0, closed: false };
    B.shops.push(sh); const T = THINGS.register(w, { kind: 'shop', key: 'sx1', name: sh.name, icon: '🏪', facts: '測試', owner: owner.agentId, tags: { money: 0.5 } });
    out.hasBan = typeof THINGS.HOOKS.shop?.ban === 'function'; out.alive = THINGS.HOOKS.shop.alive(w, T);
    const res = THINGS.enact(w, { thing: T.id }); out.closed = sh.closed === true; out.res = res; out.gone = !!THINGS.get(w, T.id)?.gone;
    out.log = (w.messageLog || []).slice(-10).some(m => /歇業/.test((m.k || '') + (m.content || '')));
    out.aliveAfter = THINGS.HOOKS.shop.alive(w, T);
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.noUnion, '沒有工會時：工資被壓太久，工人照舊自發罷工', r);
  ok(!r.withUnion, '工會在、那一行過半是會員：不再自發罷工，交給工會談判（不會兩套罷工同時發生）', r);
  ok(r.minority, '工會會員只有少數的那一行：還是可能自發罷工', r);
  ok(r.hi > r.lo + 0.5, '村民普遍喜歡國王時民心漲得比較快、討厭時掉得比較快', { lo: r.lo, hi: r.hi });
  ok(r.opUp.after > r.opUp.before, '國王民心高，村民對國王的看法也會慢慢變好', r.opUp);
  ok(r.hasBan && r.alive && r.closed && r.gone && r.log && !r.aliveAfter, '新開的店被投票禁止：真的勒令歇業、日誌寫出來', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
