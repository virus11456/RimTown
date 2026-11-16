// v10.9.0 神職由教團發薪：教團養得起幾位就幾位，神職多寡影響傳教快慢
//   1) 公庫不再發神職的薪水：發薪名單、公庫固定支出、「領公庫薪水的人」都不含神職；就業市場不替神職開缺也不裁
//   2) 養得起幾位：最近 14 天平均奉獻扣場所維護，加基金攤 90 天，除以一位神職一天的薪水；付得出半份薪水時留一位
//   3) 發薪：從教團基金出，所得稅進公庫，錢不多不少；基金不夠時照順序發，領不到一半的記一天
//   4) 每週檢討：超過養得起的人數，欠最久的先卸任、掌教最後；紀錄不滿七天不動；欠滿七天的走；只剩一位領得到半份的留著
//   5) 按立：養得起更多時，先找沒工作的虔誠信徒；沒有的話很虔誠的人有一半機會放下工作
//   6) 傳教快慢：沒有神職 0.5、一位 1、三位 1.6；勸人的意願與被勸的人改信的機會都照這個倍率
//   7) 信徒要不要奉獻時看得到教團養幾位神職、發不發得出薪水；發不出時比較願意奉獻；神職自己知道薪水是教團發的
//   8) 宗教一覽多一行；存讀檔；中英
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); w.fullAgentMode = false;
    const out = {}; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const W = WALLET.S(w); const F = FAITH.S(w); const C = CLERGY.S(w); const R = F.rels[0]; F.tax = false; W.tax = 0.1; W.minWage = 0;
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const near = (a, b, e = 0.02) => Math.abs(a - b) <= e; const r2 = (x) => Math.round(x * 100) / 100;
    w.stockpile.add('silver', 20000, w.tickCount, 'test');
    for (const a of npcs()) if (a.job?.key === 'priest') a.job = new Job('farmer');
    const pool = npcs().filter(a => (a.age || 30) >= 20 && a.job?.key !== 'mayor' && !MARKET.ownedBy(w, a.agentId).length);
    const [A, B, Cc, D, E, G, X, Y] = pool; const setB = (a, p) => { F.of[a.agentId] = { rel: R.id, piety: p }; };
    setB(A, 95); setB(B, 80); setB(Cc, 60); setB(D, 90); setB(E, 75); setB(Y, 60); F.of[X.agentId] = { rel: null, piety: 10 };
    for (const a of npcs()) if (![A, B, Cc, D, E, Y].includes(a) && F.of[a.agentId]) F.of[a.agentId].piety = Math.min(F.of[a.agentId].piety || 0, 50); // 其他人不夠虔誠，不會被按立
    const priest = (...xs) => { for (const a of xs) a.job = new Job('priest'); }; const lay = (...xs) => { for (const a of xs) if (a.job?.key === 'priest') a.job = new Job('farmer'); };
    priest(A, B, Cc); D.job = null; E.job = new Job('farmer'); G.job = new Job('guard'); X.job = new Job('farmer'); Y.job = new Job('farmer');
    F.heads = F.heads || {}; F.heads[R.id] = A.agentId;
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const ids = (xs) => xs.map(a => a.agentId); const isP = (a) => a.job?.key === 'priest';
    const std = CLERGY.std(w); const up = 0.3 + FAITH.believers(w, R).length * 0.03; const inc = (x, n = 14) => { C.inc[R.id] = Array(n).fill(x); };

    // 1) 公庫不發
    out.on = CLERGY.on(w); out.paidBy = CLERGY.paidBy(w, A) && !CLERGY.paidBy(w, G) && !CLERGY.paidBy(w, E);
    const st = TREASURY.staff(w); out.staff = { priest: st.some(isP), guard: st.includes(G) };
    R.fund = 0; bal(A, 0); bal(G, 0); let paid = 0; const _c = w.stockpile.consume; w.stockpile.consume = function (k, n, tk, why, ...rest) { const ok2 = _c.call(this, k, n, tk, why, ...rest); if (ok2 && k === 'silver' && why === t('發薪水')) paid += n; return ok2; };
    const expect = TREASURY.payroll(w); W.lastDay = null; WALLET.daily(w); w.stockpile.consume = _c;
    out.payday = { paid: r2(paid), expect: r2(expect), same: near(paid, expect, 0.2), guardGot: bal(G) > 0 };
    priest(A, B, Cc); const all = npcs(); const sl = LABOR.slots(w, all); out.slots = { priest: sl.priest, n: all.filter(isP).length };
    out.treView = !/神職|Priest/i.test(JSON.stringify(TREASURY.view(w).jobs || TREASURY.view(w)));

    // 2) 養得起幾位
    R.fund = 0; inc(up + 2.2 * std); const a2 = [CLERGY.cap(w, R), CLERGY.keep(w, R)];
    inc(up + 0.6 * std); const b2 = [CLERGY.cap(w, R), CLERGY.keep(w, R)];
    inc(up + 0.2 * std); const c2 = [CLERGY.cap(w, R), CLERGY.keep(w, R)];
    inc(up); R.fund = 90 * std * 1.5; const d2 = [CLERGY.cap(w, R), CLERGY.keep(w, R)];
    const rdy = CLERGY.ready(w, R); inc(5, 3); const notRdy = CLERGY.ready(w, R);
    out.cap = { a2, b2, c2, d2, rdy, notRdy, std: r2(std) };

    // 3) 發薪
    inc(up + 2.2 * std); R.fund = 100; C.owe = {}; for (const a of [A, B, Cc]) bal(a, 0);
    const wg = [A, B, Cc].map(a => CLERGY.wageOf(w, a)); const sum = r2(wg.reduce((s, x) => s + x, 0)); const tr0 = w.stockpile.get('silver'); const tot0 = MONEY.total(w);
    CLERGY.pay(w, C, F);
    out.pay = { wallets: [A, B, Cc].every((a, i) => near(bal(a), wg[i] * 0.9)), fund: near(R.fund, 100 - sum), tax: near(w.stockpile.get('silver') - tr0, sum * 0.1, 0.03), total: near(MONEY.total(w), tot0), owe: [A, B, Cc].every(a => (C.owe[a.agentId] || 0) === 0), wages: near(R.wages || 0, sum) };
    R.fund = r2(wg[0] + wg[1] * 0.4); for (const a of [A, B, Cc]) bal(a, 0); const tot1 = MONEY.total(w); CLERGY.pay(w, C, F);
    out.short = { a: near(bal(A), wg[0] * 0.9), b: near(bal(B), wg[1] * 0.4 * 0.9, 0.03), c: bal(Cc) === 0, owe: [C.owe[A.agentId] || 0, C.owe[B.agentId], C.owe[Cc.agentId]], fund: near(R.fund, 0), total: near(MONEY.total(w), tot1), flag: CLERGY.short(w, R) };
    CLERGY.pay(w, C, F); out.short.flag2 = CLERGY.short(w, R); out.short.mem = (Cc.memory?.memories || []).some(m => /奉獻箱是空的|offering box/.test(m.content || m.text || ''));

    // 4) 每週檢討
    const d = w._absDay(); const logN = () => (w.messageLog || []).filter(m => /⛪/.test(m.content || '')).length; const l0 = logN();
    inc(up + 2.2 * std); R.fund = 0; C.owe = { [Cc.agentId]: 3 }; CLERGY.review(w, C, F, d);
    out.rev = { cOut: !isP(Cc) && !Cc.job, jobless: w.labor?.jobless?.[Cc.agentId] === d, log: logN() === l0 + 1, stillBeliever: F.of[Cc.agentId].rel === R.id };
    CLERGY.review(w, C, F, d); out.rev.stable = isP(A) && isP(B) && !isP(D);
    inc(up + 0.2 * std); CLERGY.review(w, C, F, d); out.rev.headLast = isP(A) && !isP(B); CLERGY.review(w, C, F, d); out.rev.none = !isP(A);
    priest(A, B, Cc); inc(0, 3); R.fund = 0; C.owe = {}; CLERGY.review(w, C, F, d); out.rev.notReady = isP(A) && isP(B) && isP(Cc);
    lay(Cc); inc(up + 2.2 * std); C.owe = { [B.agentId]: 7 }; CLERGY.review(w, C, F, d); out.rev.late = isP(A) && !isP(B);
    inc(up + 0.6 * std); C.owe = { [A.agentId]: 9 }; CLERGY.review(w, C, F, d); out.rev.loneStays = isP(A);

    // 5) 按立
    inc(up + 3.3 * std); C.owe = {}; D.job = null; B.job = new Job('farmer'); Cc.job = new Job('farmer');
    CLERGY.review(w, C, F, d); out.ord = { idle: isP(D), jobless: w.labor?.jobless?.[D.agentId] == null };
    fix(0.9, () => CLERGY.review(w, C, F, d)); out.ord.weak = !isP(E) && !isP(B);
    F.of[E.agentId].piety = 90; fix(0.9, () => CLERGY.review(w, C, F, d)); out.ord.coin = !isP(E);
    fix(0.1, () => CLERGY.review(w, C, F, d)); out.ord.called = isP(E);
    CLERGY.review(w, C, F, d); out.ord.full = [A, D, E].every(isP) && npcs().filter(isP).length === 3;

    // 6) 傳教快慢
    C.owe = {}; const reach3 = CLERGY.reach(w, R); C.owe[D.agentId] = 3; const reach2 = CLERGY.reach(w, R); C.owe = {};
    F.of[Y.agentId].piety = 90; const rel = Y.relationships.getOrCreate(X.agentId, X.name); rel.affinity = 60;
    const z3 = FAITH.preachInfo(w, Y)?.zeal; const p3 = FAITH.convertInfo(w, X, { by: Y.agentId, rel: R.id })?.p;
    lay(D, E); const z1 = FAITH.preachInfo(w, Y)?.zeal; const p1 = FAITH.convertInfo(w, X, { by: Y.agentId, rel: R.id })?.p; const reach1 = CLERGY.reach(w, R);
    lay(A); const z0 = FAITH.preachInfo(w, Y)?.zeal; const p0 = FAITH.convertInfo(w, X, { by: Y.agentId, rel: R.id })?.p; const reach0 = CLERGY.reach(w, R);
    out.reach = { r: [reach0, reach1, reach2, reach3], z: [z0 / z1, z3 / z1], p: [p0 / p1, p3 / p1] };

    // 7) 信徒與神職本人看得到
    const none = CLERGY.titheLine(w, R); priest(A, B); C.owe = {}; const fine = CLERGY.titheLine(w, R); const K = DECIDE.KINDS.tithe; bal(Y, 100);
    const base0 = K.options(w, Y).find(o => o.id === 'small')?.base; const facts0 = K.facts(w, Y);
    C.owe[B.agentId] = 2; const bad = CLERGY.titheLine(w, R); const base1 = K.options(w, Y).find(o => o.id === 'small')?.base; const facts1 = K.facts(w, Y);
    out.tithe = { none, fine, bad, up: r2(base1 - base0), f0: facts0.includes(fine), f1: facts1.includes(bad), pay: /神職的薪水|clergy's pay/.test(facts0) };
    const me = CLERGY.describe(w, B); const led = JSON.stringify(DECIDE.ledger(w, B)); out.self = { me, inLedger: led.includes(me), other: CLERGY.describe(w, G) === '' };
    out.reserve = near(CLERGY.reserve(w, R), [A, B].reduce((s, a) => s + CLERGY.wageOf(w, a), 0) * 30, 0.05);

    // 每天：記奉獻、沒信仰的神職歸到教團、發薪
    C.owe = {}; R.got = 100; C.got[R.id] = 100; C.inc[R.id] = []; R.got = 107; priest(X); R.fund = 50; bal(A, 0); C.lastDay = null; CLERGY.daily(w);
    out.daily = { inc: C.inc[R.id].slice(), adopted: !!F.of[X.agentId].rel, paid: bal(A) > 0, once: (CLERGY.daily(w), C.inc[R.id].length === 1) };
    F.tax = true; R.got = 117; C.lastDay = null; CLERGY.daily(w); out.daily.taxed = C.inc[R.id][1]; F.tax = false; lay(X);

    // 8) 介面與存讀檔
    inc(up + 2.2 * std); C.owe = {}; const row = FAITH.view(w)[0].clergy; app.state = w.getState(); const html = app._townBlocks(app.state, ['faith']).faith || '';
    const box = document.createElement('div'); box.innerHTML = html; out.ui = { row, text: box.querySelector('.pp-clergy')?.innerText || '' };
    lay(A, B); out.ui.noneText = (() => { const b2 = document.createElement('div'); b2.innerHTML = app._townBlocks(w.getState(), ['faith']).faith || ''; return b2.querySelector('.pp-clergy')?.innerText || ''; })();
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { inc: (w2.clergy?.inc?.[R.id] || []).length === 14, st: w2.clergy?.st?.out >= 1 }; w2.reset(); out.save.reset = !w2.clergy;
    return out;
  });
  ok(r.on && r.paidBy, '神職的薪水歸教團管；守衛、農夫不受影響', r);
  ok(!r.staff.priest && r.staff.guard && r.payday.same && r.payday.guardGot, '公庫發薪名單與固定支出不含神職，發出去的錢等於名單上的薪水', [r.staff, r.payday]);
  ok(r.slots.priest === r.slots.n && r.treView, '就業市場不替神職開缺也不裁；公庫卡的公職名單沒有神職', [r.slots, r.treView]);
  ok(r.cap.a2[0] === 2 && r.cap.a2[1] === 2 && r.cap.b2[0] === 0 && r.cap.b2[1] === 1 && r.cap.c2[1] === 0 && r.cap.d2[0] === 1, '養得起幾位：奉獻扣維護加基金攤 90 天；付得出半份薪水時留一位', r.cap);
  ok(r.cap.rdy && !r.cap.notRdy, '奉獻紀錄滿七天才檢討', r.cap);
  ok(r.pay.wallets && r.pay.fund && r.pay.tax && r.pay.total && r.pay.owe && r.pay.wages, '發薪：基金付全額、神職拿稅後、所得稅進公庫，全鎮的錢一分不差', r.pay);
  ok(r.short.a && r.short.b && r.short.c && r.short.owe[0] === 0 && r.short.owe[1] === 1 && r.short.owe[2] === 1 && r.short.fund && r.short.total, '基金不夠：照順序發，領不到一半的記一天', r.short);
  ok(!r.short.flag && r.short.flag2, '連兩天發不出才算「發不出薪水」', r.short);
  ok(r.rev.cOut && r.rev.jobless && r.rev.log && r.rev.stillBeliever && r.rev.stable, '超過養得起的人數：欠最久的卸下神職去找工作，信仰不變；人數剛好就不動', r.rev);
  ok(r.rev.headLast && r.rev.none, '一位都養不起：一週走一位，掌教最後', r.rev);
  ok(r.rev.notReady && r.rev.late && r.rev.loneStays, '紀錄不滿七天不動；欠滿七天的走；只剩一位領得到半份的留著', r.rev);
  ok(r.ord.idle && r.ord.jobless && r.ord.weak && r.ord.coin && r.ord.called && r.ord.full, '養得起更多：先按立沒工作的虔誠信徒；沒有的話很虔誠的人有一半機會放下工作；滿了就停', r.ord);
  ok(r.reach.r[0] === 0.5 && r.reach.r[1] === 1 && Math.abs(r.reach.r[2] - 1.3) < 1e-9 && Math.abs(r.reach.r[3] - 1.6) < 1e-9, '傳教快慢：沒有神職 0.5、一位 1、兩位 1.3、三位 1.6（欠薪三天的不算）', r.reach);
  ok(Math.abs(r.reach.z[0] - 0.5) < 1e-6 && Math.abs(r.reach.z[1] - 1.6) < 1e-6 && Math.abs(r.reach.p[0] - 0.5) < 1e-6 && Math.abs(r.reach.p[1] - 1.6) < 1e-6, '勸人的意願與被勸的人改信的機會都照這個倍率', r.reach);
  ok(r.tithe.none && r.tithe.fine && r.tithe.bad && r.tithe.none !== r.tithe.fine && r.tithe.fine !== r.tithe.bad && r.tithe.f0 && r.tithe.f1 && r.tithe.pay, '要不要奉獻：看得到教團養幾位神職、發不發得出薪水', r.tithe);
  ok(r.tithe.up === 0.4, '教團發不出薪水時，信徒比較願意奉獻', r.tithe);
  ok(r.self.me && r.self.inLedger && r.self.other, '神職自己知道薪水是教團發的、欠了幾天', r.self);
  ok(r.reserve, '基金先留 30 天的神職薪水，超過的才拿去修建與濟貧', r.reserve);
  ok(r.daily.inc[0] === 7 && r.daily.adopted && r.daily.paid && r.daily.once && Math.abs(r.daily.taxed - 8.5) < 0.01, '每天：記下當天的奉獻（課了捐獻稅就記稅後）、沒信仰的神職歸到教團、發薪；一天只跑一次', r.daily);
  ok(r.ui.row && r.ui.row.n === 2 && r.ui.row.cap === 2 && (zh ? /神職 2 位/.test(r.ui.text) && /奉獻養得起 2 位/.test(r.ui.text) && /傳教快 30%/.test(r.ui.text) : /Clergy: 2/.test(r.ui.text) && /can support 2/.test(r.ui.text) && /30% faster/.test(r.ui.text)), '宗教一覽多一行：神職幾位、養得起幾位、傳教快慢', r.ui);
  ok(zh ? /神職 0 位/.test(r.ui.noneText) && /傳教慢一半/.test(r.ui.noneText) : /Clergy: 0/.test(r.ui.noneText) && /half as fast/.test(r.ui.noneText), '沒有神職時寫出傳教慢一半', r.ui.noneText);
  ok(zh ? !/[A-Za-z]{6,}/.test(r.ui.text) : !/[一-鿿]/.test(r.ui.text + r.tithe.fine + r.tithe.bad + r.tithe.none + r.self.me), '沒有漏翻', [r.ui.text, r.self.me]);
  ok(r.save.inc && r.save.st && r.save.reset, '存讀檔後紀錄還在，開新鎮清掉', r.save);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
