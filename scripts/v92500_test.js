// v9.25.0 決策核心批次 C（花錢與享樂）
// 平常怎麼花錢（買點好東西、表演賞錢）、找名匠訂做、痛快花一筆、去不去賭場與押多少、借錢翻本、賭債還不出來、輸到一無所有、
// 要不要開賭場、買不買爵位、等移植塞不塞紅包、提案的錢誰出：改由本人決定，不再擲骰。
// 驗：選擇點都登記了、每日流程不再擲骰、每個選項的結算、個性與處境不同分數不同、AI 版、銀幣守恆、存讀檔、中英文
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  console.log(`— ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const ce = w.conversationEngine;
    for (let d = 0; d < 2; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    w.fullAgentMode = false; app._fullAgentOn = () => w.fullAgentMode;
    const holder = w.election._officeHolder(w);
    const adults0 = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const pool = adults0.filter(a => a !== holder && !String(a.agentId).startsWith('imm_') && a.job?.key !== 'priest');
    const [A, B, C, D, E, F, G, H] = pool; // A 主角、F 賭場老闆／名匠、G 醫生、E 表演的人
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const Wl = w.wallet; const Cs = CASINO.S(w); const Mb = MOBILITY.S(w); const Cl = CLASS.S(w); const Hh = HEALTH.S(w); const Sp = SPEND.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); a.personality.values = []; if (a.dark) a.dark.liar = false; };
    const _ad = w._absDay.bind(w); let DAY = null; w._absDay = () => (DAY == null ? _ad() : DAY); const d0 = () => w._absDay();
    const _pa = w.proposals._abs.bind(w.proposals); w.proposals._abs = (ww) => (DAY == null ? _pa(ww) : DAY);
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const TEST = [A, B, C, D, E, F, G, H]; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const NEW = ['habit', 'bespoke', 'gamble', 'gamedebt', 'ruined', 'opencasino', 'title', 'bribe', 'fund'];
    const left = []; const _leave = w.leaveTown; w.leaveTown = (id) => { left.push(id); return true; }; // 測試裡不真的讓人離開
    const tier0 = w.tierState.lv;
    const clean = () => {
      X.cool = {}; X.q = []; DAY = null; left.length = 0; w.tierState.lv = tier0;
      for (const a of all()) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 50; }
      for (const a of TEST) { traits(a, ['hardworking']); a.age = 30; for (const b of TEST) if (a !== b) rel(a, b, 0); a.job = new Job('guard'); }
      Wl.habit = {};
      Object.assign(Cs, { open: false, owner: null, name: null, ban: false, debt: {}, streak: {}, lost: {}, v: {}, today: null, net: [], thing: null, dealer: null, lastDay: null });
      Mb.mst = {}; Mb.cm = {}; for (const a of TEST) Mb.o[a.agentId] = 1;
      for (const a of all()) delete Cl.titles[a.agentId]; for (const a of TEST) Cl.lv[a.agentId] = 1;
      Hh.q = []; Hh.bank = [];
      if (w.bank) Object.assign(w.bank, { open: false });
    };
    const casino = () => { Object.assign(Cs, { open: true, owner: F.agentId, name: ['金滿堂', 'Golden Hall'] }); Bal[F.agentId] = 500; };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const go = (a, key, id, ctx) => { const o = opt(a, key, id, ctx); return o ? o.run(w, a, ctx) : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const texts = {}; const keep = (name, key, a, ctx, only) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).filter(o => !only || only.includes(o.id)).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), fun: DECIDE.fun === true, on: DECIDE.on(w), spare: !!K.spare?._fun };

    // ---------- 2) 平常怎麼花錢 ----------
    clean(); { Bal[A.agentId] = 200; Bal[B.agentId] = 50; const c1 = K.habit.when(w, A); keep('habit', 'habit', A);
      out.habit = { ctx: !!c1, ids: ids(A, 'habit'), poor: K.habit.when(w, B), def: WALLET.habitOf(w, A) };
      const fr = sc(A, 'habit', 'frugal'), ind = sc(A, 'habit', 'indulge'); traits(A, ['greedy']); const frG = sc(A, 'habit', 'frugal'), defG = WALLET.habitOf(w, A); traits(A, ['glutton']); const indG = sc(A, 'habit', 'indulge'); traits(A, ['hardworking']);
      out.habit.sc = { fr, ind, frG, indG, defG };
      const res = go(A, 'habit', 'indulge'); const set = Wl.habit[A.agentId]; const again = K.habit.when(w, A);
      Bal[A.agentId] = 450; const richer = !!K.habit.when(w, A); keep('habitCur', 'habit', A); Bal[A.agentId] = 200; DAY = _ad() + 31; const later = !!K.habit.when(w, A); DAY = null;
      out.habit.run = { res, k: set?.k, c: set?.c, again, richer, later, now: WALLET.habitOf(w, A) };
      // 買點好東西：照習慣幾天花一次（不擲骰）。只讓 A 手頭有餘裕，數 14 天裡花了幾次
      const _sale = MARKET.sale; let lux = 0; MARKET.sale = function (ww, k, n) { if (k === 'luxury') lux++; return _sale.apply(this, arguments); };
      const days = (k, v, fn) => { lux = 0; const base = _ad() + 40; for (let i = 0; i < 14; i++) { DAY = base + i; for (const a of all()) Bal[a.agentId] = 30; Bal[A.agentId] = 200; if (k) Wl.habit[A.agentId] = { k, d: DAY, c: 200 }; Wl.lastDay = null; fn(() => fix(v, () => WALLET.daily(w))); } DAY = null; return lux; };
      const same = (f) => f();
      out.habit.lux = { indulge: days('indulge', 0.99, same), normal: days('normal', 0.99, same), frugal: days('frugal', 0.99, same) };
      MARKET.sale = _sale; }

    // ---------- 3) 看表演給不給賞錢 ----------
    clean(); { traits(E, ['creative']); for (const a of all()) if (a !== E) { Wl.habit[a.agentId] = { k: 'frugal', d: d0(), c: 30 }; if (!TEST.includes(a)) Bal[a.agentId] = 300; }
      for (const a of [A, B, C, D]) Bal[a.agentId] = 100; Wl.habit[A.agentId].k = 'indulge'; Wl.habit[C.agentId].k = 'normal'; Wl.habit[D.agentId].k = 'normal'; rel(C, E, 30); rel(D, E, 0);
      out.tips = { a: SPEND.tips(w, A, E), b: SPEND.tips(w, B, E), c: SPEND.tips(w, C, E), d: SPEND.tips(w, D, E) };
      const b0 = TEST.map(a => Bal[a.agentId]); const n0 = Sp.st.showN || 0; Sp.lastDay = null; const cons = conserved(() => fix(0.01, () => SPEND.daily(w))); const df = TEST.map((a, i) => Math.round((Bal[a.agentId] - b0[i]) * 100) / 100);
      out.tips.run = { show: (Sp.st.showN || 0) - n0, a: df[0] < 0, b: df[1] === 0, c: df[2] < 0, d: df[3] === 0, e: df[4] > 0, cons }; }

    // ---------- 4) 找名匠訂做、痛快花一筆（手上有閒錢多兩個選項） ----------
    clean(); { F.job = new Job('blacksmith'); Mb.mst.blacksmith = F.agentId; Bal[A.agentId] = 300; const low = MOBILITY.commInfo(w, A); Cl.lv[A.agentId] = 3;
      const I = MOBILITY.commInfo(w, A); const cS = K.bespoke.when(w, A); const idS = ids(A, 'bespoke'); keep('bespoke', 'bespoke', A); const idSp = ids(A, 'spare') || [];
      rel(A, F, 60); const ordF = sc(A, 'bespoke', 'order'); rel(A, F, 0); const ord = sc(A, 'bespoke', 'order'); traits(A, ['ascetic']); const passA = sc(A, 'bespoke', 'pass'); traits(A, ['hardworking']); const pass = sc(A, 'bespoke', 'pass');
      const c0 = Mb.st.comm || 0; DAY = 3 + 7 * Math.ceil(_ad() / 7 + 1); fix(0.01, () => MOBILITY.masters(w, all(), DAY)); DAY = null; Mb.mst.blacksmith = F.agentId; const untouchedC = (Mb.st.comm || 0) === c0 && Bal[A.agentId] === 300; // 交給本人：每週的流程不再替有錢人下訂
      out.comm = { low, m: I?.m === F, fee: I?.fee, opt: (idS || []).join() === 'pass,order', master: K.bespoke.when(w, F), spree0: idSp.includes('spree'), sc: { ord, ordF, pass, passA }, untouched: untouchedC };
      const f0 = Bal[F.agentId], n0 = Mb.st.comm || 0; let res = null; const cons = conserved(() => { res = go(A, 'bespoke', 'order'); });
      out.comm.run = { res: res?.k, paid: Math.round(300 - Bal[A.agentId]), got: Math.round(Bal[F.agentId] - f0), n: (Mb.st.comm || 0) - n0, cons, again: MOBILITY.commInfo(w, A), log: /名匠|master/i.test(logs(6)) };
      // 痛快花一筆：出身好、手頭寬、又懶散愛玩的人才有
      Mb.o[A.agentId] = 3; traits(A, ['lazy']); Bal[A.agentId] = 300; const S1 = MOBILITY.spreeInfo(w, A); const c2 = K.spare.when(w, A); const id2 = ids(A, 'spare'); texts.spree = { fact: K.spare.facts(w, A, c2), ops: K.spare.options(w, A, c2).filter(o => o.id === 'spree').map(o => [o.text, o.say, o.why]) };
      traits(A, ['lazy', 'hardworking']); const hard = MOBILITY.spreeInfo(w, A); traits(A, ['lazy']);
      const s0 = Mb.st.spree || 0; const untouched = typeof MOBILITY.spree === 'undefined' && (Mb.st.spree || 0) === s0 && Bal[A.agentId] === 300; // 交給本人：每三天替人揮霍的流程已經拿掉
      let r2 = null; const cons2 = conserved(() => { r2 = go(A, 'spare', 'spree', c2); });
      out.spree = { n: S1?.n, opt: id2.includes('spree'), hard, untouched, res: r2?.k, paid: Math.round(300 - Bal[A.agentId]), cons: cons2, st: (Mb.st.spree || 0) - s0 }; }

    // ---------- 5) 今晚要不要去賭場 ----------
    clean(); { const closed = K.gamble.when(w, A); casino(); Bal[A.agentId] = 100; const c1 = K.gamble.when(w, A); keep('gamble', 'gamble', A);
      Bal[B.agentId] = 3; const px = INFL.p(w);
      out.gam = { closed, ctx: !!c1, ids: ids(A, 'gamble'), owner: K.gamble.when(w, F), broke: K.gamble.when(w, B) };
      const skip = sc(A, 'gamble', 'skip'), small = sc(A, 'gamble', 'small'), big = sc(A, 'gamble', 'big'); traits(A, ['greedy']); const smallG = sc(A, 'gamble', 'small'); traits(A, ['ascetic']); const skipA = sc(A, 'gamble', 'skip'); traits(A, ['hardworking']);
      Cs.streak[A.agentId] = 2; const bigS = sc(A, 'gamble', 'big'), idsS = ids(A, 'gamble'), skipS = sc(A, 'gamble', 'skip'); keep('gambleStreak', 'gamble', A); Cs.streak[A.agentId] = 0;
      out.gam.sc = { skip, small, big, smallG, skipA, bigS, skipS, idsS };
      // 每天的流程交給本人：骰子再順也沒有人自己走進賭場
      const v0 = Cs.st.visits; Cs.lastDay = null; fix(0.01, () => CASINO.daily(w)); const untouched = Cs.st.visits === v0 && Bal[A.agentId] === 100;
      const f0 = Bal[F.agentId]; let r1 = null; const cons1 = conserved(() => { r1 = fix(0.99, () => go(A, 'gamble', 'small')); }); // 0.99：輸
      const lose = { res: r1?.k, a: Math.round(100 - Bal[A.agentId]), f: Math.round(Bal[F.agentId] - f0), streak: Cs.streak[A.agentId], today: Cs.today?.n, visits: Cs.st.visits - v0 };
      Bal[A.agentId] = 100; const f1 = Bal[F.agentId]; let r2 = null; const cons2 = conserved(() => { r2 = fix(0.1, () => go(A, 'gamble', 'big')); }); // 0.1：贏（沒中大獎）
      const win = { res: r2?.k, a: Math.round(Bal[A.agentId] - 100), f: Math.round(f1 - Bal[F.agentId]), streak: Cs.streak[A.agentId] };
      out.gam.run = { untouched, lose, win, cons1, cons2 };
      // 連輸又沒錢：可以跟莊家賒、跟銀行借
      Cs.streak[A.agentId] = 2; Bal[A.agentId] = 3; const idC = ids(A, 'gamble'); keep('gambleBroke', 'gamble', A);
      let r3 = null; const cons3 = conserved(() => { r3 = fix(0.99, () => go(A, 'gamble', 'credit')); });
      out.gam.credit = { ids: idC, res: r3?.k, debt: Cs.debt[A.agentId]?.n, due: Cs.debt[A.agentId]?.day === d0(), left: Math.round(Bal[A.agentId]), cons: cons3, again: ids(A, 'gamble')?.includes('credit') || false };
      // 每天結帳：今天累積的輸贏進帳本，再重新開始記
      const net0 = Cs.net.length; const tn = Cs.today?.n; Cs.lastDay = null; fix(0.99, () => CASINO.daily(w)); out.gam.close = { tn, pushed: Cs.net.length - net0, reset: Cs.today?.n === 0 }; }

    // ---------- 6) 賭債拖了三週還不出來 ----------
    clean(); { casino(); for (const a of all()) if (a !== F) Bal[a.agentId] = 20; Cs.debt[A.agentId] = { n: 20, day: d0() - 10 }; Bal[A.agentId] = 0; const early = K.gamedebt.when(w, A); Cs.debt[A.agentId].day = d0() - 22; Bal[B.agentId] = 80;
      const c1 = K.gamedebt.when(w, A); keep('gamedebt', 'gamedebt', A);
      out.debt = { early, ctx: !!c1, ids: ids(A, 'gamedebt'), other: K.gamedebt.when(w, B) };
      const steal = sc(A, 'gamedebt', 'steal'); traits(A, ['kind']); const stealK = sc(A, 'gamedebt', 'steal'); traits(A, ['hardworking']);
      out.debt.sc = { steal, stealK };
      // 每天的流程交給本人：骰子再順也不會自己去偷、自己跑路
      const th0 = Cs.st.theft, fl0 = Cs.st.fled; Cs.lastDay = null; fix(0.01, () => CASINO.daily(w)); const untouched = Cs.st.theft === th0 && Cs.st.fled === fl0 && left.length === 0 && !!Cs.debt[A.agentId];
      const f0 = Bal[F.agentId], b0 = Bal[B.agentId]; let res = null; const cons = conserved(() => { res = go(A, 'gamedebt', 'steal'); });
      out.debt.steal = { untouched, res: res?.k, mark: Math.round(b0 - Bal[B.agentId]), own: Math.round(Bal[F.agentId] - f0), cleared: !Cs.debt[A.agentId], theft: Cs.st.theft - th0, cons, secret: (w.dark?.secrets || []).slice(-1)[0]?.culprit === A.agentId };
      Cs.debt[A.agentId] = { n: 20, day: d0() - 22 }; const r2 = go(A, 'gamedebt', 'flee'); out.debt.flee = { res: r2?.k, left: left.includes(A.agentId), cleared: !Cs.debt[A.agentId], fled: Cs.st.fled - fl0 }; }

    // ---------- 7) 在賭場輸到一無所有 ----------
    clean(); { casino(); Bal[A.agentId] = 10; Cs.streak[A.agentId] = 2; Cs.lost[A.agentId] = [[d0(), 60]];
      const ru0 = Cs.st.ruin; fix(0.99, () => go(A, 'gamble', 'all')); const q = X.q.find(x => x.a === A.agentId && x.kind === 'ruined');
      out.ruin = { ruin: Cs.st.ruin - ru0, asked: !!q, noDice: left.length === 0, tot: q?.ctx?.tot };
      const cx = { tot: 70, owes: false }; texts.ruined = { fact: K.ruined.facts(w, A, cx), ops: K.ruined.options(w, A, cx).map(o => [o.text, o.say, o.why]) }; texts.ruinedOwes = { fact: K.ruined.facts(w, A, { tot: 70, owes: true }), ops: [] };
      const flee = sc(A, 'ruined', 'flee', cx), fleeO = sc(A, 'ruined', 'flee', { tot: 70, owes: true }), stay = sc(A, 'ruined', 'stay', cx);
      X.q = []; const res = go(A, 'ruined', 'flee', cx);
      out.ruin.opt = { ids: K.ruined.options(w, A, cx).map(o => o.id), flee, fleeO, stay, res: res?.k, left: left.includes(A.agentId) }; }

    // ---------- 8) 要不要開賭場 ----------
    clean(); { Bal[A.agentId] = 400; traits(A, ['greedy']); const village = K.opencasino.when(w, A); w.tierState.lv = 1; const young = K.opencasino.when(w, A); DAY = _ad() + 30;
      const c1 = K.opencasino.when(w, A); keep('opencasino', 'opencasino', A); Bal[B.agentId] = 300; traits(B, ['greedy']);
      out.open = { village, young, ctx: !!c1, ids: ids(A, 'opencasino'), second: K.opencasino.when(w, B) };
      const open = sc(A, 'opencasino', 'open'); traits(A, ['greedy', 'ambitious']); const openA = sc(A, 'opencasino', 'open'); traits(A, ['greedy', 'kind']); const passK = sc(A, 'opencasino', 'pass'); traits(A, ['greedy']); const pass = sc(A, 'opencasino', 'pass');
      out.open.sc = { open, openA, pass, passK };
      Cs.lastDay = null; fix(0.01, () => CASINO.daily(w)); const untouched = !Cs.open; // 交給本人：骰子再順也沒有人自己開賭場
      let res = null; const cons = conserved(() => { res = go(A, 'opencasino', 'open'); });
      out.open.run = { untouched, res: res?.k, open: Cs.open, owner: Cs.owner === A.agentId, paid: Math.round(400 - Bal[A.agentId]), cons, after: K.opencasino.when(w, A), log: /賭場|gambling/i.test(logs(6)) };
      try { if (Cs.thing && typeof THINGS !== 'undefined') THINGS.retire(w, Cs.thing); } catch (e) {} }

    // ---------- 9) 要不要花錢買爵位 ----------
    clean(); { Bal[A.agentId] = 500; const town = K.title.when(w, A); w.tierState.lv = 2; const c1 = K.title.when(w, A); keep('title', 'title', A);
      out.title = { town, ctx: !!c1, ids: ids(A, 'title'), poor: K.title.when(w, B), price: CLASS.BUY_PRICE };
      const buy = sc(A, 'title', 'buy'); traits(A, ['ambitious']); const buyA = sc(A, 'title', 'buy'); traits(A, ['ascetic']); const passA = sc(A, 'title', 'pass'); traits(A, ['hardworking']); const pass = sc(A, 'title', 'pass');
      Cl.titles[C.agentId] = { rank: 0, since: d0(), how: 'grant' }; keep('titleNobles', 'title', A);
      out.title.sc = { buy, buyA, pass, passA };
      Cl.lastGrant = d0(); fix(0.01, () => CLASS.daily(w)); const untouched = !Cl.titles[A.agentId] && Bal[A.agentId] === 500; // 交給本人：骰子再順也不會自己買
      const s0 = w.stockpile.get('silver'); let res = null; const cons = conserved(() => { res = go(A, 'title', 'buy'); });
      out.title.run = { untouched, res: res?.k, bought: !!Cl.titles[A.agentId]?.bought, paid: Math.round(500 - Bal[A.agentId]), town: Math.round(w.stockpile.get('silver') - s0), cons, after: K.title.when(w, A), snub: (C.relationships.relationships[A.agentId]?.affinity || 0) < 0 }; }

    // ---------- 10) 等移植，要不要塞紅包插隊 ----------
    clean(); { G.job = new Job('doctor'); Hh.q = [{ id: B.agentId, p: 'c', d: d0() }, { id: A.agentId, p: 'c', d: d0() }]; HEALTH.setPart(w, A, 'c', 20); HEALTH.setPart(w, B, 'c', 20); Bal[A.agentId] = 400;
      const c1 = K.bribe.when(w, A); keep('bribe', 'bribe', A); traits(G, ['kind']); const kindDoc = K.bribe.when(w, A); traits(G, ['hardworking']);
      Bal[A.agentId] = 100; const poor = K.bribe.when(w, A); Bal[A.agentId] = 400;
      out.bribe = { ctx: !!c1, pos: c1?.pos, ids: ids(A, 'bribe'), first: K.bribe.when(w, B), kindDoc, poor };
      const wait = sc(A, 'bribe', 'wait'), br = sc(A, 'bribe', 'bribe'); traits(A, ['kind']); const waitK = sc(A, 'bribe', 'wait'); traits(A, ['hardworking']); HEALTH.setPart(w, A, 'c', 10); const brBad = sc(A, 'bribe', 'bribe'); HEALTH.setPart(w, A, 'c', 20);
      out.bribe.sc = { wait, br, waitK, brBad };
      const n0 = Hh.st.bribes; const g0 = Bal[G.agentId]; let res = null; const cons = conserved(() => { res = fix(0.99, () => go(A, 'bribe', 'bribe')); });
      out.bribe.run = { res: res?.k, paid: Math.round(400 - Bal[A.agentId]), doc: Math.round(Bal[G.agentId] - g0), front: Hh.q[0]?.id === A.agentId, n: Hh.st.bribes - n0, cons, after: K.bribe.when(w, A) }; }

    // ---------- 11) 提案的錢誰出 ----------
    clean(); { const ps = { _cost: () => ({ silver: 60 }) }; const mk = (id, fund) => { const p = { id, n: 900, status: 'open', proposerId: A.agentId, proposerName: A.name, createdDay: d0(), votes: {}, why: {}, key: 'festival', fund }; w.proposals.items.push(p); return p; };
      for (const a of all()) if (!TEST.includes(a)) Bal[a.agentId] = 10; // 只讓 B、C 當會出錢的朋友
      Bal[A.agentId] = 30; const poor = WALLET.decideFund(w, ps, { proposerId: A.agentId }); Bal[A.agentId] = 100;
      const f1 = fix(0.01, () => WALLET.decideFund(w, ps, { proposerId: A.agentId })); // 交給本人：骰子再順也不會直接變成自掏腰包
      Bal[B.agentId] = 100; Bal[C.agentId] = 100; rel(B, A, 50); rel(C, A, 40); const f2 = WALLET.decideFund(w, ps, { proposerId: A.agentId });
      out.fund = { poor: poor && !poor.ask && poor.by, ask: f1?.ask === true && f1.by === 'town', crowd: f2?.ask === true && f2.by === 'crowd' && Object.keys(f2.altPledges || {}).length >= 2 };
      const p = mk('L900', f2); const cx = { pid: 'L900' }; const I = WALLET.fundInfo(w, A, 'L900'); texts.fund = { fact: K.fund.facts(w, A, cx), ops: K.fund.options(w, A, cx).map(o => [o.text, o.say, o.why]) };
      const self = sc(A, 'fund', 'self', cx); traits(A, ['kind']); const selfK = sc(A, 'fund', 'self', cx); traits(A, ['greedy']); const selfG = sc(A, 'fund', 'self', cx); traits(A, ['hardworking']);
      out.fund.opt = { ids: K.fund.options(w, A, cx).map(o => o.id), cost: I?.cost, crowd: I?.crowd.length, self, selfK, selfG, other: WALLET.fundInfo(w, B, 'L900') };
      const res = go(A, 'fund', 'self', cx); out.fund.run = { res: res?.k, by: p.fund.by, mine: p.fund.pledges?.[A.agentId], again: WALLET.fundInfo(w, A, 'L900'), text: WALLET.fundText(w, p) };
      const p2 = mk('L901', JSON.parse(JSON.stringify(f2))); go(A, 'fund', 'crowd', { pid: 'L901' }); const p3 = mk('L902', JSON.parse(JSON.stringify(f2))); go(A, 'fund', 'town', { pid: 'L902' });
      out.fund.more = { crowd: p2.fund.by === 'crowd' && Object.keys(p2.fund.pledges).length >= 2, town: p3.fund.by === 'town' && !p3.fund.ask };
      // 批准時照他選的收錢
      const s0 = w.stockpile.get('silver'); const cons = conserved(() => WALLET.collect(w, p)); out.fund.collect = { paid: Math.round(100 - Bal[A.agentId]), want: 60, town: Math.round(w.stockpile.get('silver') - s0), cons };
      w.proposals.items = w.proposals.items.filter(x => !['L900', 'L901', 'L902'].includes(x.id)); }

    // ---------- 12) 接到每天的決策流程（傾向版） ----------
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    clean(); { Bal[A.agentId] = 200; traits(A, ['glutton', 'optimist']); only(A); others(A, ['habit']);
      fix(0.5, () => today()); const e = lastLog(A); out.rule = { kind: e?.kind, id: e?.id, ai: e?.ai, habit: Wl.habit[A.agentId]?.k }; }

    // ---------- 13) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    clean(); w.fullAgentMode = true; { w.tierState.lv = 2; Bal[A.agentId] = 500; only(A); others(A, ['title']); prompts = [];
      reply = (p) => /買一個騎士頭銜|buy a knighthood/.test(p) ? [{ n: 1, pick: 'buy', why: 'W-TITLE', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A); const pD = prompts.find(p => /買一個騎士頭銜|buy a knighthood/.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, bought: !!Cl.titles[A.agentId]?.bought, plan: DECIDE.view(w, A).plan, menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    // 提案的錢誰出：提案的當下就問 AI
    clean(); w.fullAgentMode = true; { Bal[A.agentId] = 100; const f = { by: 'town', value: 40, ask: true, alt: 'town' }; const p = { id: 'L903', n: 903, status: 'open', proposerId: A.agentId, proposerName: A.name, createdDay: d0(), votes: {}, why: {}, key: 'festival', fund: f }; w.proposals.items.push(p); prompts = [];
      reply = (pp) => /L903/.test(pp) ? [{ n: 1, pick: 'self', why: 'W-FUND' }] : null;
      DECIDE.enqueue(w, A, 'fund', { pid: 'L903' }); DECIDE.drain(w, X, d0()); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A);
      out.aiFund = { id: e?.id, ai: e?.ai, why: e?.why?.raw, by: p.fund.by, asked: prompts.some(pp => /L903/.test(pp)) }; w.proposals.items = w.proposals.items.filter(x => x.id !== 'L903'); }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 14) 存讀檔、跑幾天 ----------
    clean(); { casino(); Wl.habit[A.agentId] = { k: 'indulge', d: d0(), c: 200 }; Cs.today = { n: 3, net: 12 }; Cs.debt[A.agentId] = { n: 20, day: d0() }; Mb.cm[F.agentId] = d0();
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { habit: w2.wallet?.habit?.[A.agentId]?.k === 'indulge', today: w2.casino?.today?.n === 3, debt: w2.casino?.debt?.[A.agentId]?.n === 20, cb: w2.mobility?.cm?.[F.agentId] === d0() }; }
    clean(); { casino(); w.tierState.lv = 2; for (const a of all()) Bal[a.agentId] = 150; Bal[F.agentId] = 600; let err = null; try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, q: X.q.length, visits: Cs.st.visits, habits: Object.keys(Wl.habit).length, picks: Object.fromEntries(Object.entries(X.pick).filter(([k]) => /^(habit|bespoke|gamble|title|opencasino|gamedebt|bribe|fund)\./.test(k))) }; }
    w.leaveTown = _leave; w.tierState.lv = tier0;
    // 每個選擇點的標題、事實、選項文字在英文版都有翻譯
    out.txt = (() => { const bad = []; const cjk = (s) => /[一-鿿]/.test(String(s || '')); const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; if (!en) return bad;
      const say = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : (() => { let s = t(x.k); for (const [a, b] of Object.entries(x.p || {})) s = s.split('{' + a + '}').join(typeof b === 'object' ? say(b) : (typeof b === 'string' ? t(b) : b)); return s; })()) : (typeof x === 'string' ? t(x) : '');
      for (const k of NEW) if (cjk(t(K[k].title))) bad.push('title:' + k);
      for (const [name, v] of Object.entries(texts)) { if (v.err) { bad.push('err:' + name + ':' + v.err); continue; } if (cjk(I18N.localizeNames(String(v.fact || ''), true))) bad.push('fact:' + name + ':' + v.fact);
        for (const row of v.ops) for (const x of row) { const s = I18N.localizeNames(say(x), true); if (cjk(s)) bad.push('opt:' + name + ':' + s); } }
      return bad; })();
    out.facts = Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.err ? 'ERR ' + v.err : String(v.fact || '').length]));
    return out;
  });
  const L = `[${lang}] `;
  ok(r.kinds.all && r.kinds.fun && r.kinds.on && r.kinds.spare, L + '九個選擇點都登記了，錢包、花錢、賭場、名匠、階層、醫療六個系統都知道這些事交給本人', r.kinds);
  // 習慣
  ok(r.habit.ctx && r.habit.ids.join() === 'frugal,normal,indulge' && !r.habit.poor && r.habit.def === 'normal', L + '花錢習慣：只問手頭有餘裕的人，三種習慣可以選；還沒拿過主意的人算普通', r.habit);
  ok(r.habit.sc.frG > r.habit.sc.fr && r.habit.sc.indG > r.habit.sc.ind && r.habit.sc.defG === 'frugal', L + '花錢習慣：貪心的比較想省、愛吃的比較想享受', r.habit.sc);
  ok(r.habit.run.k === 'indulge' && r.habit.run.c === 200 && !r.habit.run.again && r.habit.run.richer && r.habit.run.later && r.habit.run.now === 'indulge', L + '花錢習慣：定下來以後一個月內不再問；身家多了一倍或過了一個月才重新想', r.habit.run);
  ok(r.habit.lux.indulge === 14 && r.habit.lux.normal === 7 && r.habit.lux.frugal === 2, L + '買點好東西：照習慣花（不擲骰）——想買就買的天天花、普通的兩天一次、省的一週一次', r.habit.lux);
  // 賞錢
  ok(r.tips.a && !r.tips.b && r.tips.c && !r.tips.d, L + '賞錢：想買就買的人都給、普通的人只給熟人、省的人不給', r.tips);
  ok(r.tips.run.show === 1 && r.tips.run.a && r.tips.run.b && r.tips.run.c && r.tips.run.d && r.tips.run.e && r.tips.run.cons, L + '賞錢：表演當天照習慣給（不擲骰），錢進表演的人口袋、銀幣守恆', r.tips.run);
  // 名匠、揮霍
  ok(!r.comm.low && r.comm.m && r.comm.fee > 0 && r.comm.opt && !r.comm.master && !r.comm.spree0, L + '名匠訂做：只問有錢、算得上工匠商人以上的人；名匠自己不問', r.comm);
  ok(r.comm.sc.ordF > r.comm.sc.ord && r.comm.sc.passA > r.comm.sc.pass && r.comm.untouched, L + '名匠訂做：跟名匠交情好的比較想訂、克己的比較不想；每週的流程不再擲骰替人下訂', r.comm);
  ok(r.comm.run.res && r.comm.run.paid === r.comm.fee && r.comm.run.got >= r.comm.fee - 5 && r.comm.run.n === 1 && r.comm.run.cons && !r.comm.run.again && r.comm.run.log, L + '名匠訂做：本人決定訂做，錢付給名匠、銀幣守恆；一位名匠一週只接一件', r.comm.run);
  ok(r.spree.n === 54 && r.spree.opt && !r.spree.hard && r.spree.untouched && r.spree.res && r.spree.paid === 54 && r.spree.cons && r.spree.st === 1, L + '揮霍：出身好、手頭寬、懶散愛玩的人多一個「痛快花一筆」；每三天的流程不再擲骰；本人決定才花，銀幣守恆', r.spree);
  // 賭場
  ok(!r.gam.closed && r.gam.ctx && r.gam.ids.join() === 'skip,small,big' && !r.gam.owner && !r.gam.broke, L + '賭場：開著才問；可以不去、小玩、押大的；老闆自己和沒錢的人不問', r.gam);
  ok(r.gam.sc.smallG > r.gam.sc.small && r.gam.sc.skipA > r.gam.sc.skip && r.gam.sc.bigS > r.gam.sc.big && r.gam.sc.skipS < r.gam.sc.skip && r.gam.sc.idsS.includes('all'), L + '賭場：貪心的比較想去、克己的比較不想；連輸以後更想押大的、多一個「全押翻本」', r.gam.sc);
  ok(r.gam.run.untouched && r.gam.run.lose.res && r.gam.run.lose.a === 12 && r.gam.run.lose.f >= 10 && r.gam.run.lose.streak === 1 && r.gam.run.lose.today === 1 && r.gam.run.lose.visits === 1 && r.gam.run.cons1, L + '賭場：每天的流程不再擲骰；本人決定小玩一把，輸的錢進莊家口袋、銀幣守恆', r.gam.run);
  ok(r.gam.run.win.res && r.gam.run.win.a === 35 && r.gam.run.win.f === 35 && r.gam.run.win.streak === 0 && r.gam.run.cons2, L + '賭場：押大的贏了，莊家照數賠、銀幣守恆', r.gam.run.win);
  ok(r.gam.credit.ids.includes('credit') && r.gam.credit.res && r.gam.credit.debt === 20 && r.gam.credit.due && r.gam.credit.cons && !r.gam.credit.again, L + '賭場：連輸又沒錢的人可以跟莊家賒帳（記成賭債，一次只能欠一筆）', r.gam.credit);
  ok(r.gam.close.pushed === 1 && r.gam.close.reset, L + '賭場：每天結帳把大家自己來賭的輸贏記進帳本，再重新開始記', r.gam.close);
  // 賭債
  ok(!r.debt.early && r.debt.ctx && r.debt.ids.join() === 'hide,steal,flee' && !r.debt.other && r.debt.sc.stealK < r.debt.sc.steal - 1, L + '賭債：拖了三週才問，可以繼續躲、去偷、跑路；心軟的人很不想偷', r.debt);
  ok(r.debt.steal.untouched && r.debt.steal.res && r.debt.steal.mark === 20 && r.debt.steal.own === 20 && r.debt.steal.cleared && r.debt.steal.theft === 1 && r.debt.steal.cons && r.debt.steal.secret, L + '賭債：每天的流程不再擲骰；本人決定去偷，偷來的錢還給莊家、記成祕密、銀幣守恆', r.debt.steal);
  ok(r.debt.flee.res && r.debt.flee.left && r.debt.flee.cleared && r.debt.flee.fled === 1, L + '賭債：本人決定跑路就離開小鎮', r.debt.flee);
  // 輸光
  ok(r.ruin.ruin === 1 && r.ruin.asked && r.ruin.noDice && r.ruin.tot > 0 && r.ruin.opt.ids.join() === 'stay,flee' && r.ruin.opt.fleeO > r.ruin.opt.flee + 1 && r.ruin.opt.stay > r.ruin.opt.flee && r.ruin.opt.res && r.ruin.opt.left, L + '輸到一無所有：不再擲骰決定跑不跑，改問本人（還欠銀行錢的比較想走）', r.ruin);
  // 開賭場
  ok(!r.open.village && !r.open.young && r.open.ctx && r.open.ids.join() === 'pass,open' && !r.open.second, L + '開賭場：城鎮以上、建鎮二十天後，只問最有條件開的那個人', r.open);
  ok(r.open.sc.openA > r.open.sc.open && r.open.sc.passK > r.open.sc.pass, L + '開賭場：有企圖心的比較想開、心軟的比較不想', r.open.sc);
  ok(r.open.run.untouched && r.open.run.res && r.open.run.open && r.open.run.owner && r.open.run.paid > 0 && r.open.run.cons && !r.open.run.after && r.open.run.log, L + '開賭場：每天的流程不再擲骰；本人決定開，本錢付出去、銀幣守恆', r.open.run);
  // 爵位
  ok(!r.title.town && r.title.ctx && r.title.ids.join() === 'pass,buy' && !r.title.poor, L + '買爵位：城市以上、錢夠的人才問', r.title);
  ok(r.title.sc.buyA > r.title.sc.buy && r.title.sc.passA > r.title.sc.pass, L + '買爵位：有企圖心的比較想買、克己的比較不想', r.title.sc);
  ok(r.title.run.untouched && r.title.run.res && r.title.run.bought && r.title.run.paid === r.title.price && r.title.run.town === r.title.price && r.title.run.cons && !r.title.run.after && r.title.run.snub, L + '買爵位：每天的流程不再擲骰；本人決定買，錢進公庫、受封的貴族看不起他、銀幣守恆', r.title.run);
  // 紅包
  ok(r.bribe.ctx && r.bribe.pos === 2 && r.bribe.ids.join() === 'wait,bribe' && !r.bribe.first && !r.bribe.kindDoc && !r.bribe.poor, L + '塞紅包：只問排在後面、出得起的人；排第一的不問、醫生心軟就沒這條路', r.bribe);
  ok(r.bribe.sc.waitK > r.bribe.sc.wait && r.bribe.sc.brBad > r.bribe.sc.br, L + '塞紅包：心軟的比較願意等、病得越重越想插隊', r.bribe.sc);
  ok(r.bribe.run.res && r.bribe.run.paid === 80 && r.bribe.run.doc === 80 && r.bribe.run.front && r.bribe.run.n === 1 && r.bribe.run.cons && !r.bribe.run.after, L + '塞紅包：本人決定塞，錢進醫生口袋、排到最前面、銀幣守恆', r.bribe.run);
  // 提案出資
  ok(r.fund.poor === 'town' && r.fund.ask && r.fund.crowd, L + '提案出資：自己出得起時不再擲骰，先照「湊錢／公庫」記著、等本人拿主意；出不起的不問', r.fund);
  ok(r.fund.opt.ids.join() === 'self,crowd,town' && r.fund.opt.cost === 60 && r.fund.opt.crowd === 1 && r.fund.opt.selfK > r.fund.opt.self && r.fund.opt.selfG < r.fund.opt.self && !r.fund.opt.other, L + '提案出資：可以自己出、找朋友湊、讓公庫出；心軟的比較願意自己出、貪心的比較不願意；只問提案人', r.fund.opt);
  ok(r.fund.run.by === 'self' && r.fund.run.mine === 60 && !r.fund.run.again && /60/.test(r.fund.run.text) && r.fund.more.crowd && r.fund.more.town, L + '提案出資：本人選了就照他選的記（自己出／朋友湊／公庫），不會再問第二次', { run: r.fund.run, more: r.fund.more });
  ok(r.fund.collect.paid === 60 && r.fund.collect.town === 60 && r.fund.collect.cons, L + '提案出資：批准時照他選的收錢，銀幣守恆', r.fund.collect);
  // 流程
  ok(r.rule.kind === 'habit' && r.rule.id === 'indulge' && r.rule.ai === 0 && r.rule.habit === 'indulge', L + '接到每天的決策流程：AI 沒開時照個性決定（愛吃又樂觀的人選想買就買）', r.rule);
  ok(r.ai.id === 'buy' && r.ai.ai === 1 && r.ai.why === 'W-TITLE' && r.ai.bought && r.ai.plan === 'N-NEXT' && r.ai.menu && r.ai.money, L + 'AI 版：由 AI 決定買爵位並說理由', r.ai);
  ok(r.aiFund.id === 'self' && r.aiFund.ai === 1 && r.aiFund.why === 'W-FUND' && r.aiFund.by === 'self' && r.aiFund.asked, L + 'AI 版：提案的當下就問 AI 錢誰出', r.aiFund);
  if (!zh) ok(!r.ai.cjk, L + '英文版給 AI 的資料沒有中文', r.ai.bits);
  ok(r.save.habit && r.save.today && r.save.debt && r.save.cb, L + '存讀檔：花錢習慣、賭場今天的帳、賭債、訂做紀錄都還在', r.save);
  ok(!r.days.err, L + '賭場開著照常跑八天沒有錯誤', r.days);
  ok(Object.values(r.facts).every(v => typeof v === 'number' && v > 15), L + '每個選擇點都講得出事實', r.facts);
  if (!zh) ok(r.txt.length === 0, L + '英文版：標題、事實、選項、理由都有翻譯', r.txt.slice(0, 6));
  ok(errs.length === 0, L + '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
