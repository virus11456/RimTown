// v8.9.0 錢的去處：通貨膨脹（物價水準、工資落後、調薪提案）、更多花錢的地方（看戲、宴客、畫像、外地旅遊、外地讀書）、公共建設承包（競標、偷工減料、出事）、銀幣守恆、存讀檔、介面
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
    const tick = (n) => { for (let k = 0; k < n; k++) { w.paused = false; w.tick(); } };
    tick(96 * 14); // 讓錢包、基準開始
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16);
    const T = () => MONEY.total(w); const P0 = () => MONEY.S(w).pend; const B = w.wallet.bal;
    const logs = () => (w.messageLog || []).slice(-30).map(m => String(m.content || '')).join('\n');
    const fix = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    // ---------- 1) 通膨 ----------
    const I = INFL.S(w); out.base = I.base;
    I.p = 1; I.wage = 1; I.band = 0; I.lastRaise = -99; for (const a of npcs()) B[a.agentId] = (I.base || 40) * 8;
    for (let k = 0; k < 40; k++) { I.lastDay = -1; INFL.daily(w); }
    out.infl = { p: I.p, wage: I.wage, lag: I.p > I.wage + 0.05, idx: WALLET.wageIdx() === I.wage, log: /東西越來越貴|getting pricier/.test(logs()) };
    // 生活開銷跟著物價:三餐錢 = 3 × 存貨指數 × 物價水準
    { const a = npcs()[0]; B[a.agentId] = 500; const px = (typeof PRICES !== 'undefined' && w.prices ? PRICES.idx(w, 'food') : 1); const before = B[a.agentId]; const exp = Math.round(3 * px * I.p * 100) / 100; const _sale = MARKET.sale; let paid = 0; MARKET.sale = function (ww, kind, n) { if (kind === 'meal') paid = Math.max(paid, n); return _sale.apply(this, arguments); };
      try { WALLET.S(w).lastDay = -1; fix(0.99, () => WALLET.daily(w)); } finally { MARKET.sale = _sale; } out.meal = { paid, exp, ok: Math.abs(paid - exp) < 0.02 }; }
    // 工資照工資指數發
    { const a = npcs().find(x => WALLET.WAGE[x.job?.key]); out.wageOf = Math.abs(WALLET.wageOf(a) - WALLET.WAGE[a.job.key] * (a._wageMult || 1) * (a._edu ? 1.15 : 1) * I.wage) < 0.001; }
    // 調薪提案:落後一成二以上,工人提;工人贊成、老闆反對;通過後補上八成差距
    I.p = 1.6; I.wage = 1.2; I.lastRaise = -99; w.proposals.items = (w.proposals.items || []).filter(q => q.kind !== 'infl_raise'); I.lastDay = -1; INFL.daily(w);
    const pr = (w.proposals.items || []).find(q => q.kind === 'infl_raise');
    out.raise = { prop: !!pr };
    if (pr) { const worker = npcs().find(a => WALLET.WAGE[a.job?.key] && !MARKET.ownedBy(w, a.agentId).length); const bossId = Object.values(w.market.owners || {}).find(Boolean); const boss = w.agents[bossId];
      let wf = 0, bf = 0; for (let k = 0; k < 20; k++) { if (worker) { B[worker.agentId] = 10; delete pr.votes[worker.agentId]; w.proposals._ruleVote(w, pr, worker); if (pr.votes[worker.agentId] === 'for') wf++; } if (boss) { B[boss.agentId] = 500; delete pr.votes[boss.agentId]; w.proposals._ruleVote(w, pr, boss); if (pr.votes[boss.agentId] === 'for') bf++; } }
      out.raise.votes = { wf, bf, boss: !!boss }; const w0 = I.wage; pr.status = 'approved'; w.proposals._execute(w, pr, w._absDay()); out.raise.after = I.wage; out.raise.ok = Math.abs(I.wage - (w0 + (I.p - w0) * 0.8)) < 0.002; }
    out.brief = INFL.brief(w);
    // ---------- 2) 花錢的地方 ----------
    I.p = 1; I.wage = 1; INFL.sync(w); const X = SPEND.S(w);
    const all = npcs(); for (const a of all) B[a.agentId] = 30;
    const perf = all[0]; perf.personality.traits = ['creative']; const rich = all[1]; rich.personality.traits = ['generous']; B[rich.agentId] = 400;
    for (const o of all.slice(2, 6)) { rich.relationships.getOrCreate(o.agentId, o.name).affinity = 60; }
    for (const a of all.slice(2)) a.personality.traits = (a.personality.traits || []).filter(x => x !== 'creative' && x !== 'charismatic');
    const st0 = { ...X.st };
    out.spendCons = conserved(() => fix(0.001, () => { X.lastDay = -1; SPEND.daily(w); }));
    out.spend = { show: (X.st.showN || 0) > (st0.showN || 0), feast: (X.st.feastN || 0) > (st0.feastN || 0), art: (X.st.artN || 0) > (st0.artN || 0), trip: (X.st.tripN || 0) > (st0.tripN || 0), travelFlow: (MONEY.S(w).days[w._absDay()]?.travel || 0) < 0, perfGot: B[perf.agentId] > 30, logs: ['🎭', '🍷', '🖼️', '🧳'].filter(s => logs().includes(s)) };
    // 外地讀書:家裡繳學費(流出鎮外),每 30 天再繳一次,繳不出就輟學;讀完長大工資高一成五
    const kid = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 8 && (a.age ?? 30) < 16) || (() => { const k = all[7]; k.age = 12; return k; })();
    const parent = all.find(a => a !== kid && a !== perf && a !== rich && (a.age ?? 30) >= 18); kid._parentNames = [parent.name]; parent.personality.values = ['知識']; B[parent.agentId] = 300;
    delete X.school[kid.agentId]; delete X.edu[kid.agentId]; if (X.drop) delete X.drop[kid.agentId];
    for (const o of all) if (o !== parent && (o.age ?? 30) >= 18) B[o.agentId] = Math.min(B[o.agentId] || 0, 20);
    const sc0 = X.st.feeN || 0; out.schoolCons = conserved(() => fix(0.001, () => { X.lastDay = -1; SPEND.daily(w); }));
    out.school = { went: X.school[kid.agentId] != null, feeN: (X.st.feeN || 0) - sc0, flow: (MONEY.S(w).days[w._absDay()]?.school || 0) < 0 };
    X.paid[kid.agentId] = w._absDay() - 31; const b1 = B[parent.agentId]; fix(0.99, () => { X.lastDay = -1; SPEND.daily(w); }); out.school.again = B[parent.agentId] < b1 - 20;
    X.paid[kid.agentId] = w._absDay() - 31; for (const o of Object.values(w.agents)) if (B[o.agentId] != null) B[o.agentId] = Math.min(B[o.agentId], 5); fix(0.99, () => { X.lastDay = -1; SPEND.daily(w); }); out.school.drop = !!X.drop?.[kid.agentId];
    // 讀完:另一個孩子成年時拿到 _edu
    { const k2 = all[8]; X.school[k2.agentId] = w._absDay() - 200; delete X.edu[k2.agentId]; if (X.drop) delete X.drop[k2.agentId]; k2.age = 16; fix(0.99, () => { X.lastDay = -1; SPEND.daily(w); }); out.edu = { flag: !!k2._edu, wage: WALLET.WAGE[k2.job?.key] ? Math.abs(WALLET.wageOf(k2) - WALLET.WAGE[k2.job.key] * (k2._wageMult || 1) * 1.15 * WALLET.wageIdx()) < 0.001 : true, brief: SPEND.brief(w, k2) }; }
    // ---------- 3) 公共建設承包 ----------
    const C = CYCLE.S(w); const K = WORKS.S(w); K.ban = {};
    const trades = all.filter(a => ['carpenter', 'miner', 'blacksmith'].includes(a.job?.key)); out.trades = trades.length;
    for (const a of all) B[a.agentId] = 30; w.stockpile.resources.silver = 5000;
    const crook = trades[0]; if (crook) { crook.personality.traits = ['greedy']; }
    for (const a of trades.slice(1)) a.personality.traits = (a.personality.traits || []).filter(x => x !== 'greedy');
    const parts = [['timber', 0.4], ['mine', 0.3], ['forge', 0.3]].map(([k, f]) => [k, f * (MARKET.workersOf(w, k, all).length ? 1 : 0)]); const tot = parts.reduce((s, [, f]) => s + f, 0) || 1;
    const n0 = K.st.n; let won = null; const tCons = conserved(() => { won = fix(0.3, () => WORKS.tender(w, 200, parts, tot, all, C)); });
    const job = K.list[K.list.length - 1];
    out.tender = { won, cons: tCons, n: K.st.n - n0, by: job?.byName, margin: job?.margin, kind: job?.name, log: /標下了工程|won the contract/.test(logs()) };
    // 貪心的人偷工減料 → 品質差;過一陣子出事 → 賠錢、三個月不准標、名聲變差
    if (crook && job) { job.by = crook.agentId; job.byName = crook.name; job.q = 'poor'; job.skim = 24; job.fell = false; job.d = w._absDay() - 20; B[crook.agentId] = 200;
      const c0 = B[crook.agentId]; const fCons = conserved(() => fix(0.001, () => { K.lastDay = -1; WORKS.daily(w); }));
      out.fall = { fell: job.fell, fined: B[crook.agentId] < c0, ban: (K.ban[crook.agentId] || 0) > w._absDay(), cons: fCons, log: /出事了|failed:/.test(logs()) };
      const n1 = K.st.n; const others = all.filter(a => a !== crook); fix(0.3, () => WORKS.tender(w, 200, parts, tot, [crook, ...others], C)); out.fall.banned = K.list[K.list.length - 1].by !== crook.agentId || K.st.n === n1; }
    // 公庫錢多:CYCLE 的公共工程直接走承包
    { w.stockpile.resources.silver = 6000; const n2 = K.st.n; CYCLE.publicWorks(w, C, npcs().length); out.viaCycle = K.st.n > n2; }
    out.wbrief = WORKS.brief(w, w.agents[K.list[K.list.length - 1].by]);
    // ---------- 存讀檔 ----------
    { const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = !!w2.infl && w2.infl.p === w.infl.p && !!w2.spend && Object.keys(w2.spend.school).length === Object.keys(X.school).length && (w2.cycle?.wk?.list?.length || 0) === K.list.length; }
    // ---------- 長跑守恆:20 天 ----------
    { const M = MONEY.S(w); M.lastT = MONEY.total(w); M.pend = 0; const d0 = w._absDay(); for (const k of Object.keys(M.days)) if (+k >= d0) delete M.days[k].other; /* 上面測試直接改了錢包和公庫,先把帳本基準重設 */ tick(96 * 20); const D = MONEY.S(w).days; out.other = Math.round(Object.entries(D).filter(([k]) => +k > d0).reduce((x, [, v]) => x + (v.other || 0), 0) * 100) / 100; }
    // ---------- 介面 ----------
    I.p = 1.4; I.wage = 1.2;
    if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300));
    const sec = document.querySelector('.price-section'); out.ui = { infl: sec?.querySelector('.infl-meta')?.textContent || '', spend: sec?.querySelector('.spend-meta')?.textContent || '', works: sec?.querySelector('.works-meta')?.textContent || '' };
    return out;
  });
  const en = lang === 'en';
  ok(r.base > 0, '開局兩週後記下每人平均的錢當作物價基準', r.base);
  ok(r.infl.p > 1.3 && r.infl.lag && r.infl.idx, '大家錢變多 → 物價水準上升，工資跟著漲但比物價慢', r.infl);
  ok(r.infl.log, '物價跨過門檻時日誌報「東西越來越貴」', r.infl);
  ok(r.meal.ok, '三餐的錢照物價水準付', r.meal);
  ok(r.wageOf, '工資照工資指數發', r.wageOf);
  ok(r.raise.prop, '工資落後物價一成二以上，有人提「工資跟上物價」', r.raise);
  ok(r.raise.votes && r.raise.votes.wf >= 14 && (!r.raise.votes.boss || r.raise.votes.bf <= 6), '工人多半贊成、老闆多半反對', r.raise.votes);
  ok(r.raise.ok, '通過後工資補上八成差距', r.raise);
  ok(/物價|prices/i.test(r.brief), 'AI 知道物價變貴了', r.brief);
  ok(r.spend.show && r.spend.perfGot, '看戲說書：觀眾丟賞錢給表演的人', r.spend);
  ok(r.spend.feast && r.spend.art, '有錢人宴客、請畫師畫像', r.spend);
  ok(r.spend.trip && r.spend.travelFlow, '有錢人去外地旅遊，花的錢記到「去外地旅遊」', r.spend);
  ok(r.spendCons, '花錢之後全鎮的錢＝原本的錢－記帳流出的錢', r.spendCons);
  ok(r.spend.logs.length >= 3, '日誌寫出看戲、宴客、畫像、旅遊', r.spend.logs);
  ok(r.school.went && r.school.flow && r.schoolCons, '家裡出學費送孩子去外地讀書（記帳流出）', r.school);
  ok(r.school.again, '讀書期間每 30 天再繳一次學費', r.school);
  ok(r.school.drop, '繳不出學費就輟學回家', r.school);
  ok(r.edu.flag && r.edu.wage && r.edu.brief, '讀完書長大的人工資高一成五，AI 也知道', r.edu);
  ok(r.trades >= 2 && r.tender.won && r.tender.n === 1 && r.tender.margin > 0, '公庫撥款蓋公共建設，工匠競標，得標的人賺差價', { t: r.trades, ...r.tender });
  ok(r.tender.cons && r.tender.log, '承包的錢全部付給承包商、工人和木作坊礦場鐵匠，不多不少', r.tender);
  ok(r.fall && r.fall.fell && r.fall.fined && r.fall.ban && r.fall.cons, '偷工減料的工程出事：承包商賠錢、三個月不准標', r.fall);
  ok(r.fall && r.fall.banned, '被禁的人標不到下一件工程', r.fall);
  ok(r.viaCycle, '公庫錢多時，景氣系統的公共工程走承包', r.viaCycle);
  ok(!!r.wbrief, 'AI 知道自己包過工程', r.wbrief);
  ok(r.save, '存讀檔後物價、讀書、工程紀錄都在', r.save);
  ok(Math.abs(r.other) < 3, '跑 20 天，不明來源的銀幣幾乎為零', r.other);
  ok(/1\.40/.test(r.ui.infl) && (en ? /Price level/.test(r.ui.infl) : /物價水準/.test(r.ui.infl)), '物價與就業區塊顯示物價水準與工資', r.ui.infl);
  ok(r.ui.works && r.ui.spend, '顯示花錢的去處與承包工程', r.ui);
  if (en) ok(![r.ui.infl, r.ui.spend].some(s => /[一-鿿]/.test(s)), '英文介面沒有中文', r.ui);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 800 });
  await run(browser, 'en', { width: 390, height: 844 });
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
