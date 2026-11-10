// 錢不會憑空多出或消失:月報的「其他」每天都是 0(MONEY 帳本守恆回歸測試)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
// 用法:node scripts/money_conservation_test.js [天數=400]
// 1. 個別修正:每一段呼叫前後比對全鎮的錢(MONEY.total)與有記帳的流量(MONEY 的 pend),兩者要一致
// 2. 真正的遊戲迴圈跑幾百天:每一格都比對「全鎮的錢變化」與「這一格記進月報的流量」,每天結帳的「其他」都要是 0
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
const DAYS = +(process.argv[2] || process.env.DAYS || 400);
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);

  // ---------- 1. 個別修正 ----------
  const u = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false;
    for (let i = 0; i < 96 * 3; i++) { w.paused = false; w.tick(); }
    const r2 = (n) => Math.round(n * 100) / 100, sp = w.stockpile, M = MONEY.S(w);
    // 一段程式前後:全鎮的錢變化減掉有記帳的流量(不能剛好碰到每天結帳)
    const leak = (fn) => { const T0 = MONEY.total(w), P0 = M.pend, C0 = M.lastClose; fn(); if (M.lastClose !== C0) return 'closed'; return Math.round(((MONEY.total(w) - T0) - (M.pend - P0)) * 1000) / 1000; };
    const out = {}; const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    // 沒有付款人就不能扣款(以前回 true,配上一筆 add 就憑空生錢)
    out.takeNull = [WALLET.take(w, null, 5), WALLET.take(w, undefined, 5), WALLET.take(w, null, 0)];
    out.payNull = leak(() => { WALLET.pay(w, null, P[0], 25, 'test'); });
    // 工坊交訂單:外地付的貨款記進「工廠產品外銷」
    { const pr = w.processing; pr.builtFactories.__t = { warehouse: { 測試貨: 10 } }; pr.orders.push({ id: 'order_t', product: '測試貨', amount: 5, reward: 30, factoryKey: '__t', status: 'active' });
      const f0 = (M.days[w._absDay()] || {}).factory || 0; let res = null; out.order = leak(() => { res = pr.fulfillOrder('order_t', w); });
      out.orderOk = !!res?.ok; out.orderFlow = r2(((M.days[w._absDay()] || {}).factory || 0) - f0); delete pr.builtFactories.__t; pr.orders = pr.orders.filter(o => o.id !== 'order_t'); }
    // 黃金鑄成銀幣:記進「黃金鑄成銀幣」
    { sp.add('gold', 3, w.tickCount, 'test'); const g0 = sp.get('gold'), m0 = (M.days[w._absDay()] || {}).mint || 0;
      if (w.flow) w.flow.lastDay = -1; // FLOW 一天只跑一次
      out.mint = leak(() => FLOW.daily(w)); out.minted = g0 - sp.get('gold'); out.mintFlow = r2(((M.days[w._absDay()] || {}).mint || 0) - m0); out.mintLabel = MONEY.CAT.mint; out.mintIn = MONEY.IN.includes('mint'); }
    // 加班津貼付給加班的人(以前從公庫扣掉就消失)
    { const old = { ...w.workPolicy }; for (const k of ['meals', 'tools', 'clothing', 'medicine', 'furniture']) w.workPolicy[k] = 'extra'; sp.add('silver', 500, w.tickCount, 'test');
      out.overtime = leak(() => processDailyProduction(w)); w.workPolicy = old; }
    // 銀行倒閉:準備金的零頭與沒有銀行家時剩下的錢都有去處
    { const B = BANK.S(w); const keep = JSON.parse(JSON.stringify(B)); const a = P[1];
      Object.assign(B, { open: true, status: 'run', banker: 'nobody_here', dep: { [a.agentId]: 40 }, reserve: 12.37, loans: {}, bonds: [], history: B.history || [] });
      out.bankFail = leak(() => BANK.fail(w, B, w._absDay())); out.bankReserve = B.reserve;
      Object.assign(B, { open: true, status: 'run', banker: P[2].agentId, dep: { [a.agentId]: 40 }, reserve: 25.68 });
      out.bankFail2 = leak(() => BANK.fail(w, B, w._absDay()));
      for (const k of Object.keys(B)) delete B[k]; Object.assign(B, keep); }
    // 搬走的人領走存款:準備金是負的也不會被拉回 0
    { const B = BANK.S(w); const keep = JSON.parse(JSON.stringify(B)); Object.assign(B, { open: true, status: 'ok', banker: P[2].agentId, dep: { gone_x: 30 }, reserve: -5, loans: {}, bonds: [], lastDay: -1 });
      out.bankGone = leak(() => BANK.daily(w)); for (const k of Object.keys(B)) delete B[k]; Object.assign(B, keep); }
    // 宗教基金太多:修建與救濟三份加起來剛好是拿出來的錢(以前各自四捨五入,差一兩分)
    { const F = FAITH.S(w); const R = F.rels?.[0]; out.faith = [];
      if (R) { const keep = R.fund; for (const n of [1234.56, 999.99, 431.13, 2718.28, 777.77, 1500.01, 333.33, 868.69]) { R.fund = n; F.lastDay = -1; out.faith.push(leak(() => FAITH.daily(w))); } R.fund = keep; } }
    // 過世的人欠銀行的錢比遺產多:遺產全拿去還貸款,錢包也要清掉(以前錢包留著,同一筆錢又進了銀行準備金)
    { const B = BANK.S(w); const a = P.find(x => !w.myth?.g?.[x.agentId]) || P[3]; const id = a.agentId; const have = WALLET.get(w, a); if (have > 0) WALLET.take(w, a, have); WALLET.add(w, a, 20);
      if (B.dep) delete B.dep[id]; B.loans[id] = { owed: 30, principal: 28, rate: 0.08, day: w._absDay(), due: w._absDay() + 20, why: 'test' };
      out.deathLoan = leak(() => w.lifecycle._killNpc(w, a)); out.deathBal = w.wallet.bal[id]; out.deathOwed = B.loans[id]?.owed; out.dead = !w.agents[id]; }
    // 同業競爭(每週一次,剛好在跨午夜那一格):只留一個產業來測,用完整個 market 還原
    { const Mk = MARKET, Q = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18), d = w._absDay();
      const k = Object.keys(Mk.SECTORS).find(s => Mk.workersOf(w, s).length >= 3); const [o, rv, p1, p2] = Q.slice(-4);
      const keepMk = JSON.parse(JSON.stringify(w.market)), SECT = Mk.SECTORS, canBuy = Mk.canBuy, partner = INVEST.partner, away = w.isAway, ownAway = Object.prototype.hasOwnProperty.call(w, 'isAway'), rnd = Math.random;
      const restore = () => { for (const x of Object.keys(w.market)) delete w.market[x]; Object.assign(w.market, keepMk); Mk.SECTORS = SECT; Mk.canBuy = canBuy; INVEST.partner = partner; if (ownAway) w.isAway = away; else delete w.isAway; Math.random = rnd; };
      try {
        Mk.SECTORS = { [k]: SECT[k] }; const M = COMPETE.S(w);
        // 合夥湊到的本錢比開店成本少 0.3(INVEST.partner 允許差 0.5 以內):裝修錢照實際湊到的付(以前照成本付,多出 0.3)
        M.owners[k] = o.agentId; delete M.rival[k]; M.good[k] = 5; M.hist[k] = [[1000, 0]]; Math.random = () => 0.1; Mk.canBuy = () => false;
        WALLET.add(w, p1, 500); WALLET.add(w, p2, 500);
        INVEST.partner = (w, all, kk, cost) => { const x = Math.round(cost * 0.6 * 100) / 100, y = Math.round((cost - 0.3 - x) * 100) / 100; WALLET.take(w, p1, x); WALLET.take(w, p2, y); return { lead: p1, parts: [[p1, x], [p2, y]] }; };
        out.coopOpen = leak(() => COMPETE.entry(w, Q, d)); out.coopOpened = !!M.rival[k]; INVEST.partner = partner; Math.random = rnd;
        // 原本那家的老闆出遠門(還算在鎮上,但 w.agents 找不到人):不能被併購(以前照樣從對手扣錢,錢卻付不到老闆手上,整筆消失)
        M.owners[k] = 'away_t'; w.isAway = (id) => id === 'away_t' || away.call(w, id); w.wallet.bal.away_t = 0; WALLET.add(w, rv, 2000);
        M.rival[k] = { fid: 'Ft', owner: rv.agentId, since: d, price: 1, pay: 1, emp: {}, rev: 0, cost: 0, hist: [[100, 0]], loss: 0 }; M.loss[k] = 5; M.hist[k] = [[0, 50]];
        out.mergeAway = leak(() => COMPETE.weekly(w, Q, d)); out.mergeAwayKept = !!M.rival[k] && M.owners[k] === 'away_t'; delete w.wallet.bal.away_t;
      } finally { restore(); } }
    // 看病:身上只差 1 分(湊到只差 1 分就算付清),醫生與公庫照實際收到的錢分(以前照全額分,憑空多出 1 分)
    { const Q = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const [pt, doc] = Q.slice(-2); const have = WALLET.get(w, pt); if (have > 0) WALLET.take(w, pt, have); WALLET.add(w, pt, 4.99);
      const bio = w.tech?.bio?.price; if (bio) w.tech.bio.price = false; let res = null; out.medPay = leak(() => { res = HEALTH.pay(w, pt, 5, 'test', doc); }); out.medOk = !!res?.ok; if (bio) w.tech.bio.price = bio; }
    // 上面放進去的測試用銀幣沒有記帳:重新對帳,從現在開始算
    M.lastT = MONEY.total(w) - M.pend; delete (M.days[w._absDay()] || {}).other;
    return out;
  });
  console.log('個別修正');
  ok(u.takeNull[0] === false && u.takeNull[1] === false && u.takeNull[2] === true, 'WALLET.take 沒有付款人就扣不到錢(金額是 0 才算成功)', u.takeNull);
  ok(u.payNull === 0, 'WALLET.pay 沒有付款人:全鎮的錢不變', u.payNull);
  ok(u.orderOk && u.order === 0 && u.orderFlow === 30, '工坊交訂單:30 銀幣貨款記進「工廠產品外銷」', u);
  ok(u.minted >= 1 && u.mint === 0 && u.mintFlow === u.minted * 20 && u.mintIn && u.mintLabel, '黃金鑄成銀幣:記進月報的流入', u);
  ok(u.overtime === 0, '加班津貼付給加班的人,全鎮的錢不變', u.overtime);
  ok(u.bankFail === 0 && u.bankReserve === 0, '銀行倒閉、銀行家不在:剩下的準備金進公庫', [u.bankFail, u.bankReserve]);
  ok(u.bankFail2 === 0, '銀行倒閉:準備金的零頭給銀行家', u.bankFail2);
  ok(u.bankGone === 0, '搬走的人領存款:負的準備金不會被拉回 0', u.bankGone);
  ok(u.dead && u.deathLoan === 0 && u.deathBal === undefined && u.deathOwed === 10, '過世時遺產剛好被貸款扣光:錢包清掉,全鎮的錢不變', u);
  ok(u.faith.length && u.faith.every(x => x === 0), '宗教基金太多:修建與救濟分到的錢加起來一分不差', u.faith);
  ok(u.coopOpened && u.coopOpen === 0, '合夥開店湊的錢比本錢少幾角:裝修錢照實際湊到的付,全鎮的錢不變', [u.coopOpened, u.coopOpen]);
  ok(u.mergeAwayKept && u.mergeAway === 0, '原本那家的老闆出遠門:不會被併購,全鎮的錢不變', [u.mergeAwayKept, u.mergeAway]);
  ok(u.medOk && u.medPay === 0, '看病錢只差 1 分也算付清:醫生與公庫照實際收到的分,全鎮的錢不變', [u.medOk, u.medPay]);

  // ---------- 2. 真正的遊戲迴圈跑幾百天 ----------
  await page.evaluate(() => {
    const w = window.rimtownApp.world;
    const daySums = () => { const o = {}; const D = w.money?.days || {}; for (const k in D) { let s = 0; for (const c in D[k]) if (c !== 'other') s += D[k][c]; o[k] = s; } return o; };
    // 這一格記進月報的流量:每天的帳本加總變化(結帳會刪掉兩個月前的帳,刪掉的那天不算)
    const tracked = (a, b) => { let s = 0; for (const k in b) s += b[k] - (a[k] || 0); return s; };
    const X = window.__mc = { ticks: [], others: {}, seen: new Set(), first: null };
    X.step = (n) => {
      for (let i = 0; i < n; i++) {
        const M = MONEY.S(w), T0 = MONEY.total(w), D0 = daySums(), at = `${w._absDay()} ${w.clock.hour}:${String(w.clock.minute).padStart(2, '0')}`, armed = typeof M.lastT === 'number';
        w.paused = false; w.tick();
        const un = (MONEY.total(w) - T0) - tracked(D0, daySums());
        if (armed && Math.abs(un) > 0.01 && X.ticks.length < 30) X.ticks.push({ at, un: Math.round(un * 100) / 100 });
        if (X.first == null && typeof M.lastClose === 'number') X.first = M.lastClose;
        const d = w._absDay(); for (const k of Object.keys(M.days)) if (+k < d && !X.seen.has(k)) { X.seen.add(k); if (M.days[k].other) X.others[k] = M.days[k].other; }
      }
    };
  });
  const t0 = Date.now();
  for (let d = 0; d < DAYS; d += 20) {
    const n = Math.min(20, DAYS - d);
    await page.evaluate((n) => window.__mc.step(n * 96), n);
    if ((d + n) % 100 === 0 || d + n === DAYS) process.stderr.write(`  day ${d + n} ${Math.round((Date.now() - t0) / 1000)}s\n`);
  }
  const L = await page.evaluate(() => { const X = window.__mc, w = window.rimtownApp.world; return { ticks: X.ticks, others: X.others, closed: X.seen.size, first: X.first, total: Math.round(MONEY.total(w)), pop: Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length }; });
  console.log(`遊戲迴圈 ${DAYS} 天(結帳 ${L.closed} 天,最後全鎮 ${L.total} 銀幣、${L.pop} 人)`);
  ok(L.closed >= DAYS - 3, '每天都有結帳', L.closed);
  ok(!Object.keys(L.others).length, '每天結帳的「其他」都是 0', L.others);
  ok(!L.ticks.length, '每一格全鎮的錢變化都記進了月報', L.ticks);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 5));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
