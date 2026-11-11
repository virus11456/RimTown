// v8.8.0 銀行拿存款放貸：想開店的人找不到合夥人就跟銀行借本錢；缺房時跟銀行借錢蓋出租屋；還款期 45 天、錢守恆、面板顯示
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`); const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); for (let k = 0; k < 96 * 2; k++) { w.paused = false; w.tick(); }
    const B = BANK.S(w); B.open = true; B.status = 'ok'; B.banker = B.banker || npcs()[0].agentId; B.reserve = 1000; B.dep = { [npcs()[1].agentId]: 600 }; B.loans = {};
    const logs = () => (w.messageLog || []).slice(-15).map(m => String(m.content || '')).join('\n');
    // 1) 開店:手上 20、找不到合夥人 → 跟銀行借
    const a = npcs().find(x => x.agentId !== B.banker && (x.age ?? 30) >= 20 && !BIZ.shopOf(w, x)); for (const o of npcs()) { o.relationships.getOrCreate(a.agentId, a.name).affinity = 0; }
    w.wallet.bal[a.agentId] = 20; const T0 = MONEY.total(w); const K0 = new Set(Object.keys(w.wallet.bal || {}));
    // 等店名 AI 的空檔可能剛好有人搬來（大人搬來會帶自己的積蓄，這是規則），比總額時不算新出現的錢包
    const totalOld = () => MONEY.total(w) - Object.entries(w.wallet.bal || {}).filter(([k]) => !K0.has(k)).reduce((x, [, v]) => x + (+v || 0), 0); const n0 = BIZ.S(w).shops.length; const d = w._absDay();
    const s = await BIZ.open(w, BIZ.S(w), a, d); const L = B.loans[a.agentId];
    out.shop = { opened: !!s && BIZ.S(w).shops.length === n0 + 1, loan: !!L, kind: L?.kind, due: L ? L.due - d : null, bizLent: B.bizLent, cons: Math.abs(totalOld() - T0) < 0.01, log: /借了.*開店|to open a shop/.test(logs()) };
    // 2) 已經有欠款的人不能再借;銀行沒錢可放也不借
    const b = npcs().find(x => x !== a && x.agentId !== B.banker && !BIZ.shopOf(w, x)); B.loans[b.agentId] = { owed: 10, principal: 10, rate: 0.1, day: d, due: d + 20 };
    out.noTwice = BIZ.bizLoan(w, b, 50, '開店') === 0; delete B.loans[b.agentId];
    const r0 = B.reserve; B.reserve = 10; out.noCash = BIZ.bizLoan(w, b, 50, '開店') === 0; B.reserve = r0;
    // 3) 蓋出租屋:缺房、沒有人自己出得起 → 有工作的人借錢蓋
    const E = ESTATE.S(w); const units0 = Object.keys(E.units).length;
    for (const u of Object.values(E.units)) u.occ = u.occ || 'x_' + u.id; // 房子都住滿
    E.homeless = { h1: 1, h2: 1 };
    for (const o of npcs()) w.wallet.bal[o.agentId] = Math.min(w.wallet.bal[o.agentId] || 0, 60); const c = npcs().find(x => x.job && (x.age ?? 30) >= 22 && !B.loans[x.agentId] && x.agentId !== a.agentId); w.wallet.bal[c.agentId] = 60;
    w.stockpile.add('wood', 50, w.tickCount, 't'); w.stockpile.add('stone', 50, w.tickCount, 't'); const T1 = MONEY.total(w);
    const R = Math.random; Math.random = () => 0.99; try { ESTATE.market(w, ESTATE.households(w)); } finally { Math.random = R; }
    const built = Object.values(E.units).filter(u => !u.occ || String(u.occ).startsWith('x_') === false).filter(u => u.built === w._absDay());
    const byLoan = Object.values(B.loans).some(L2 => L2.kind === 'biz' && L2 !== L);
    out.house = { built: Object.keys(E.units).length > units0, byLoan, cons: Math.abs(MONEY.total(w) - T1) < 0.01, log: /蓋一棟房子出租|build a house for rent/.test(logs()) };
    // 4) 還款:用手上的錢慢慢還,錢回到銀行準備金
    const res0 = B.reserve; w.wallet.bal[a.agentId] = 100; const owe0 = B.loans[a.agentId]?.owed; B.lastDay = -1; BANK.daily(w); out.repay = { paid: owe0 - (B.loans[a.agentId]?.owed ?? 0), reserveUp: B.reserve > res0 };
    // 5) 存讀檔
    const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = w2.bank?.loans?.[a.agentId]?.kind === 'biz' && w2.bank.bizLent === B.bizLent;
    // 6) 面板
    if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab('industry'); else { app.activeTab = 'industry'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300));
    out.panel = [...document.querySelectorAll('.pp-tier-line')].map(e => e.textContent).find(x => /創業與蓋房貸款|Business and building loans/.test(x)) || '';
    return out;
  });
  ok(r.shop.opened && r.shop.loan && r.shop.kind === 'biz', '找不到合夥人時跟銀行借本錢開店', r.shop);
  ok(r.shop.due >= 45 && r.shop.bizLent > 0, '創業貸款還款期 45 天，銀行記下累計放了多少', r.shop);
  ok(r.shop.cons, '開店借錢、付給工匠，全鎮的錢不多不少', r.shop);
  ok(r.shop.log, '日誌寫出跟銀行借錢開店', r.shop);
  ok(r.noTwice && r.noCash, '已經有欠款、或銀行沒錢可放時不借', { a: r.noTwice, b: r.noCash });
  ok(r.house.built && r.house.byLoan && r.house.log, '缺房又沒人出得起時，有工作的人跟銀行借錢蓋出租屋', r.house);
  ok(r.house.cons, '借錢蓋房，全鎮的錢不多不少', r.house);
  ok(r.repay.paid > 0 && r.repay.reserveUp, '用手上的錢慢慢還，錢回到銀行', r.repay);
  ok(r.save, '存讀檔後貸款種類與累計放款都在', r.save);
  ok(lang === 'en' ? /Business and building loans/.test(r.panel) && !/[一-鿿]/.test(r.panel) : /創業與蓋房貸款/.test(r.panel), '產業分頁的銀行欄顯示創業與蓋房貸款', r.panel);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 800 });
  await run(browser, 'en', { width: 390, height: 844 });
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
