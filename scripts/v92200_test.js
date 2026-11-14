// v9.22.0 決策核心階段 4（自己的事）
// 當家賣不賣股份、股東退不退股、要不要翻修房子（自己出錢或借錢）、要不要奉獻、記恨的人要不要動手、要不要開店、被挖角走不走：改由本人決定，不再擲骰。
// 驗：七個選擇點都登記了、每日流程不再擲骰、每個選項的結算、個性與處境不同分數不同、
//     連鎖（有人來談入股 → 當家回答；對手鎮來挖角 → 本人回答）、新科技的態度兩邊一致、AI 版、銀幣守恆、存讀檔、中英文
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
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const pool = all.filter(a => a !== holder && !String(a.agentId).startsWith('imm_') && a.job?.key !== 'priest');
    const [A, B, C, D, E, F, G, H] = pool; // A 當家、B 來談入股的人、C 眼紅的人、D 小股東
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const M = MARKET.S(w); const SX = SHARES.S(w).sh; const IV = INVEST.S(w); const BK = BANK.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships.relationships[b.agentId]?.affinity || 0;
    const traits = (a, ts) => { a.personality.traits = ts.slice(); a.personality.values = []; };
    const d0 = () => w._absDay();
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const mems = (a, n = 6) => (a.memory?.entries || []).slice(-n).map(e => e.content).join('|');
    const TEST = [A, B, C, D, E, F, G, H];
    const Kf = 'kitchen';
    const clean = () => {
      X.cool = {}; X.q = []; IV.ask = {}; IV.low = {}; SX.ask = {}; if (w.dark) { w.dark.secrets = []; w.dark.cool = {}; }
      for (const a of all) { Bal[a.agentId] = 5; delete X.log[a.agentId]; delete X.plan[a.agentId]; delete BK.dep[a.agentId]; delete BK.loans[a.agentId]; }
      for (const a of TEST) { traits(a, ['hardworking']); a.mood = 50; for (const b of TEST) if (a !== b) rel(a, b, 0); if (!a.job || a.job.key === 'unemployed' || a.job.key === 'mayor') a.job = new Job('guard'); }
      for (const k of Object.keys(MARKET.SECTORS)) { delete M.owners[k]; delete M.shares[k]; if (M.rival) delete M.rival[k]; }
      M.owners[Kf] = A.agentId; M.shares[Kf] = { [A.agentId]: 100 }; M.hist[Kf] = Array.from({ length: 7 }, () => [60, 10]);
      BK.open = true; BK.status = 'ok'; BK.depRate = 0.01; IV.bankY = 0.01; BK.reserve = 2000;
      if (w.mind?.amb) for (const a of TEST) delete w.mind.amb[a.agentId];
      if (w.biz) w.biz.shops = [];
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const drain = () => fix(0.5, () => DECIDE.drain(w, X, d0()));
    const NEW = ['sell', 'cashout', 'renovate', 'tithe', 'scheme', 'startup', 'poach'];
    const texts = {}; const keep = (key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[key] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[key] = { err: String(e) }; } };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), life: DECIDE.life === true, on: DECIDE.on(w), queued: ['sell', 'poach'].every(k => K[k].scan === false) && ['cashout', 'renovate', 'tithe', 'scheme', 'startup'].every(k => K[k].scan !== false) };

    // ---------- 2) 有人來談入股 → 當家自己決定 ----------
    clean(); { Bal[B.agentId] = 800; const q = INVEST.quotes(w, B).find(x => x.k === Kf);
      const r1 = fix(0.01, () => INVEST.buy(w, B, Kf, true)); // 骰子給到「一定賣」的值：也不會替當家決定
      const C1 = (X.q.find(x => x.kind === 'sell') || {}).ctx;
      out.ask = { quote: !!q, asked: r1.asked === true, ok: r1.ok, stake: SHARES.pctOf(w, Kf, B.agentId), q: X.q.filter(x => x.kind === 'sell' && x.a === A.agentId).length, pending: !!IV.ask[Kf], busy: INVEST.buy(w, C, Kf, true).busy === true || !INVEST.quotes(w, C).length, ids: C1 && ids(A, 'sell', C1) };
      keep('sell', A, C1);
      const base = { yes: sc(A, 'sell', 'yes', C1), no: sc(A, 'sell', 'no', C1) };
      traits(A, ['hardworking', 'greedy']); const greedy = sc(A, 'sell', 'yes', C1); traits(A, ['hardworking', 'stubborn']); const stubNo = sc(A, 'sell', 'no', C1); traits(A, ['hardworking']);
      rel(A, B, 60); const friend = sc(A, 'sell', 'yes', C1); rel(A, B, -60); const foe = sc(A, 'sell', 'yes', C1); rel(A, B, 0);
      Bal[A.agentId] = 5; const broke = sc(A, 'sell', 'yes', C1); Bal[A.agentId] = 100; const rich = sc(A, 'sell', 'yes', C1);
      out.sellSc = { base, greedy, stubNo, friend, foe, broke, rich };
      // 貪心的當家：賣
      traits(A, ['hardworking', 'greedy']); const q2 = INVEST.askInfo(w, Kf)?.q; /* 貪心的當家開價比較高，同樣的預算買到的比例比較少 */ const a0 = Bal[A.agentId], b0 = Bal[B.agentId]; const cons = conserved(() => drain());
      out.sold = { id: lastLog(A)?.id, kind: lastLog(A)?.kind, stake: SHARES.pctOf(w, Kf, B.agentId), boss: SHARES.pctOf(w, Kf, A.agentId), got: Math.round(Bal[A.agentId] - a0), paid: Math.round(b0 - Bal[B.agentId]), price: q2?.price, p: q2?.p, dearer: q2 && q && q2.price / q2.p > q.price / q.p, cons, log: /📊/.test(logs(6)), pending: !!IV.ask[Kf], still: M.owners[Kf] === A.agentId };
    }
    clean(); { Bal[B.agentId] = 800; Bal[A.agentId] = 100; traits(A, ['hardworking', 'stubborn']); const af0 = aff(B, A); INVEST.buy(w, B, Kf, true); const b0 = Bal[B.agentId]; drain();
      out.refused = { id: lastLog(A)?.id, stake: SHARES.pctOf(w, Kf, B.agentId), same: Bal[B.agentId] === b0, cold: aff(B, A) < af0, log: /🙅/.test(logs(6)), pending: !!IV.ask[Kf] }; }
    clean(); { Bal[B.agentId] = 800; traits(A, ['hardworking', 'greedy']); INVEST.buy(w, B, Kf, true); Bal[B.agentId] = 3; const s0 = JSON.stringify(M.shares[Kf]); drain(); // 等的這段時間買的人錢花掉了
      out.gone = { same: JSON.stringify(M.shares[Kf]) === s0, pending: !!IV.ask[Kf], log: !!lastLog(A) };
      IV.ask[Kf] = { by: C.agentId, d: d0() - 5 }; Bal[B.agentId] = 800; out.gone.expired = INVEST.buy(w, B, Kf, true).asked === true && IV.ask[Kf].by === B.agentId; } // 三天沒下文的舊邀約不擋路
    // 沒說要問當家（例如當家不在鎮上）：當場談成或被回絕
    clean(); { Bal[B.agentId] = 800; const r2 = fix(0.01, () => INVEST.buy(w, B, Kf)); out.direct = { ok: r2.ok === true, stake: SHARES.pctOf(w, Kf, B.agentId), q: X.q.length }; }
    // 眼紅入股：每週流程只記下「有人來談」，當家決定
    clean(); { traits(C, ['hardworking', 'jealous']); Bal[C.agentId] = 2000; Bal[A.agentId] = 100; M.hist[Kf] = Array.from({ length: 7 }, () => [80, 10]);
      fix(0.1, () => SHARES.weekly(w, all, d0())); const C2 = (X.q.find(x => x.kind === 'sell' && x.ctx.src === 'envy') || {}).ctx;
      out.envy = { asked: !!SX.ask[Kf], by: SX.ask[Kf]?.by === C.agentId, stake: SHARES.pctOf(w, Kf, C.agentId), ctx: !!C2, ids: C2 && ids(A, 'sell', C2) };
      if (C2) { texts.sellEnvy = { fact: K.sell.facts(w, A, C2), ops: [] }; traits(A, ['hardworking', 'greedy']); const c0 = Bal[C.agentId]; const cons = conserved(() => drain()); out.envy.sold = { id: lastLog(A)?.id, stake: SHARES.pctOf(w, Kf, C.agentId), paid: Math.round(c0 - Bal[C.agentId]), cons, log: /📈/.test(logs(6)), pending: !!SX.ask[Kf] }; } }

    // ---------- 3) 股份分紅不如銀行 → 股東自己決定退不退 ----------
    clean(); { M.shares[Kf] = { [A.agentId]: 70, [D.agentId]: 30 }; M.hist[Kf] = Array.from({ length: 7 }, () => [10, 10]); IV.bankY = 0.03; Bal[A.agentId] = 900;
      for (let i = 0; i < 3; i++) fix(0.1, () => INVEST.cashOuts(w, all, d0())); // 只記週數
      const c1 = K.cashout.when(w, D); out.out = { weeks: IV.low[Kf + '|' + D.agentId], stake: SHARES.pctOf(w, Kf, D.agentId), ctx: c1, boss: K.cashout.when(w, A), ids: ids(D, 'cashout') }; keep('cashout', D);
      const k3 = sc(D, 'cashout', 'keep'), o3 = sc(D, 'cashout', 'out'); IV.low[Kf + '|' + D.agentId] = 6; const o6 = sc(D, 'cashout', 'out'); rel(D, A, 60); const kf = sc(D, 'cashout', 'keep'); rel(D, A, 0);
      out.out.sc = { k3, o3, o6, kf }; IV.low[Kf + '|' + D.agentId] = 2; out.out.early = K.cashout.when(w, D); IV.low[Kf + '|' + D.agentId] = 4;
      const dep0 = BK.dep[D.agentId] || 0; let res = null; const cons = conserved(() => { res = opt(D, 'cashout', 'out').run(w, D); });
      out.out.done = { stake: SHARES.pctOf(w, Kf, D.agentId), boss: SHARES.pctOf(w, Kf, A.agentId), dep: Math.round((BK.dep[D.agentId] || 0) - dep0) > 0, cons, res: !!res, log: /🏦/.test(logs(5)), after: K.cashout.when(w, D) }; }

    // ---------- 4) 家裡的房子舊了 ----------
    const _era = w.research.currentEra; w.research.currentEra = () => 3; const Hs = HOUSING.S(w); const home = HOUSING.houseOf(w, E); const mates = all.filter(o => HOUSING.houseOf(w, o) === home);
    const stock = () => { for (const k of ['wood', 'stone', 'planks', 'bricks']) try { w.stockpile.add(k, 800, w.tickCount, 'test'); } catch (e) {} };
    const cost = HOUSING.COST[1];
    clean(); stock(); { Hs.lv[home] = 0; for (const o of mates) Bal[o.agentId] = 1; BK.open = false;
      Bal[E.agentId] = 30; const poor = K.renovate.when(w, E); // 錢不夠、銀行沒開：沒有這件事
      Bal[E.agentId] = cost * 2; const c1 = K.renovate.when(w, E); out.reno = { poor, ctx: !!c1, ids: ids(E, 'renovate'), other: mates.length > 1 ? K.renovate.when(w, mates.find(o => o !== E)) : null }; keep('renovate', E);
      const pay = sc(E, 'renovate', 'pay'), wait = sc(E, 'renovate', 'wait'); Bal[E.agentId] = cost * 1.2; const tight = sc(E, 'renovate', 'pay'); Bal[E.agentId] = cost * 2;
      traits(E, ['hardworking', 'ascetic']); const asc = sc(E, 'renovate', 'pay'); traits(E, ['hardworking']); WAYS.S(w).envy[home] = d0(); const envy = sc(E, 'renovate', 'pay'); delete WAYS.S(w).envy[home];
      out.reno.sc = { pay, wait, tight, asc, envy };
      // 每日流程交給本人：有錢也不會自動翻修
      fix(0.01, () => HOUSING.daily(w)); out.reno.noDice = Hs.lv[home] === 0;
      const r0 = WAYS.S(w).reno.length, c0 = Bal[E.agentId]; let res = null; const cons = conserved(() => { res = opt(E, 'renovate', 'pay').run(w, E); });
      out.reno.done = { lv: Hs.lv[home], paid: Math.round(c0 - Bal[E.agentId]), cost, cons, res: !!res, log: /🔨/.test(logs(5)), envyHook: WAYS.S(w).reno.length === r0 + 1, after: K.renovate.when(w, E) && Hs.lv[home] < HOUSING.maxLv(w) }; }
    clean(); stock(); { Hs.lv[home] = 0; for (const o of mates) Bal[o.agentId] = 1; Bal[E.agentId] = 20; // 手頭不夠：只能借
      out.loan = { ids: ids(E, 'renovate') }; texts.renoLoan = { fact: K.renovate.facts(w, E, K.renovate.when(w, E)), ops: K.renovate.options(w, E, K.renovate.when(w, E)).map(o => [o.text, o.say, o.why]) };
      const plain = sc(E, 'renovate', 'loan'); WAYS.S(w).envy[home] = d0(); const envy = sc(E, 'renovate', 'loan'); traits(E, ['hardworking', 'ascetic']); const asc = sc(E, 'renovate', 'loan'); traits(E, ['hardworking']);
      out.loan.sc = { plain, envy, asc, wait: sc(E, 'renovate', 'wait') };
      let res = null; const cons = conserved(() => { res = opt(E, 'renovate', 'loan').run(w, E); });
      out.loan.done = { lv: Hs.lv[home], debt: !!BK.loans[E.agentId], why: BK.loans[E.agentId]?.why, cons, res: !!res, envyGone: WAYS.S(w).envy[home] === undefined, log: /🏦/.test(logs(6)) };
      delete BK.loans[E.agentId]; Hs.lv[home] = 0; Bal[E.agentId] = 20; BK.loans[E.agentId] = { owed: 10, principal: 10, rate: 0.1, day: d0(), due: d0() + 20 }; out.loan.inDebt = K.renovate.when(w, E); delete BK.loans[E.agentId]; }
    clean(); { Hs.lv[home] = 0; for (const o of mates) Bal[o.agentId] = 1; Bal[E.agentId] = cost * 2; const sp = w.stockpile; const keepRes = {}; for (const k of Object.keys(sp.resources || {})) { if (k !== 'silver' && k !== 'food') { keepRes[k] = sp.resources[k]; sp.resources[k] = 0; } }
      out.noMat = { lack: !!HOUSING.info(w, E)?.lack, ctx: K.renovate.when(w, E) }; for (const k of Object.keys(keepRes)) sp.resources[k] = keepRes[k]; }
    // 銀行與「跟鄰居比」的每日流程不再替人借錢翻修
    out.renoSrc = { bank: !/HOUSING\.(houseOf|renovateBy|COST)/.test(BANK.daily.toString()), ways: !/envyBorrow\(/.test(WAYS.daily.toString()) };
    w.research.currentEra = _era;

    // ---------- 5) 要不要奉獻 ----------
    const Fa = FAITH.S(w); const Rl = Fa.rels[0]; const sk0 = Rl?.sk;
    clean(); if (Rl) { Rl.sk = FAITH.KEYS.find(k => k !== 'sheng'); /* 換成不是「每七天什一」的教，免得教規的什一混進來 */ Fa.of[F.agentId] = { rel: Rl.id, piety: 80 };
      Bal[F.agentId] = 10; const poor = K.tithe.when(w, F); Bal[F.agentId] = 100; Fa.of[F.agentId].piety = 30; const cold = K.tithe.when(w, F); Fa.of[F.agentId].piety = 80;
      out.tithe = { poor, cold, ids: ids(F, 'tithe') }; keep('tithe', F);
      const s80 = sc(F, 'tithe', 'small'), skip = sc(F, 'tithe', 'skip'); Fa.of[F.agentId].piety = 50; const s50 = sc(F, 'tithe', 'small'); Fa.of[F.agentId].piety = 80;
      Bal[F.agentId] = 400; const idsRich = ids(F, 'tithe'); const big = sc(F, 'tithe', 'big'); traits(F, ['hardworking', 'greedy']); const bigG = sc(F, 'tithe', 'big'), skipG = sc(F, 'tithe', 'skip'); traits(F, ['hardworking']);
      out.tithe.sc = { s80, s50, skip, big, bigG, skipG, idsRich };
      // 每日流程交給本人：虔誠又有錢也不會自動奉獻
      { const g0 = Rl.got || 0, c0 = Bal[F.agentId]; Fa.lastDay = -1; fix(0.01, () => FAITH.daily(w)); out.tithe.noDice = Bal[F.agentId] === c0 && (Rl.big || 0) === (Rl.big || 0) && Math.round((Rl.got || 0) - g0) === 0; }
      Bal[F.agentId] = 100; { const g0 = Rl.got || 0, c0 = Bal[F.agentId]; let res = null; const cons = conserved(() => { res = opt(F, 'tithe', 'small').run(w, F); }); out.tithe.small = { paid: c0 - Bal[F.agentId], got: Math.round(((Rl.got || 0) - g0) * 100) / 100, cons, res: !!res, mem: /奉獻|gave/.test(mems(F, 3)) }; }
      Bal[F.agentId] = 400; { const g0 = Rl.got || 0, b0 = Rl.big || 0, c0 = Bal[F.agentId]; let res = null; const cons = conserved(() => { res = fix(0.9, () => opt(F, 'tithe', 'big').run(w, F)); }); out.tithe.big = { paid: c0 - Bal[F.agentId], got: Math.round((Rl.got || 0) - g0), n: (Rl.big || 0) - b0, cons, res: !!res, log: /🙏/.test(logs(4)) }; }
      Rl.sk = sk0; } else out.tithe = { skip: true };

    // ---------- 6) 跟某人結怨很深 ----------
    clean(); { traits(G, ['jealous', 'abrasive']); rel(G, H, -70); for (const o of all) if (o !== H && o !== G) rel(G, o, 10);
      const c1 = K.scheme.when(w, G); out.scheme = { ctx: c1 && c1.v === H.agentId, ids: ids(G, 'scheme') }; keep('scheme', G);
      const hot = sc(G, 'scheme', 'sabotage'), hold = sc(G, 'scheme', 'hold'); traits(G, ['jealous']); const mild = sc(G, 'scheme', 'sabotage'); traits(G, ['hardworking', 'kind']); const kind = K.scheme.when(w, G); traits(G, ['jealous', 'abrasive']);
      rel(G, H, -40); const shallow = K.scheme.when(w, G); rel(G, H, -90); const deep = sc(G, 'scheme', 'sabotage'); rel(G, H, -70);
      out.scheme.sc = { hot, hold, mild, kind, shallow, deep, frame: sc(G, 'scheme', 'frame') };
      // 每日流程交給本人：惡意再深、骰子再順也不會自動動手
      w.proposals._darkDay = -1; fix(0.01, () => DARK.daily(w)); out.scheme.noDice = (w.dark.secrets || []).filter(s => s.stage === 'plan').length === 0;
      const res = opt(G, 'scheme', 'sabotage').run(w, G); const s1 = (w.dark.secrets || []).find(s => s.stage === 'plan');
      out.scheme.done = { res: !!res, plan: !!s1 && s1.kind === 'sabotage' && s1.culprit === G.agentId && s1.victim === H.agentId, log: /🕵️/.test(logs(4)), cool: K.scheme.when(w, G) };
      if (s1) { s1.day = d0() - 2; fix(0.99, () => DARK.daily(w)); out.scheme.acted = s1.stage === 'done'; } // 籌劃一兩天後照舊動手
    }

    // ---------- 7) 想不想自己開店 ----------
    clean(); { const Bz = BIZ.S(w); traits(B, ['hardworking', 'creative']); Bal[B.agentId] = 100;
      out.shop = { ctx: !!K.startup.when(w, B), ids: ids(B, 'startup'), mayor: K.startup.when(w, holder) }; keep('startup', B);
      const open = sc(B, 'startup', 'open'), wait = sc(B, 'startup', 'wait'); MIND.S(w).amb[B.agentId] = { key: 'rich', since: d0() }; const rich = sc(B, 'startup', 'open'); delete MIND.S(w).amb[B.agentId];
      traits(B, []); const plain = K.startup.when(w, B); traits(B, ['hardworking', 'creative']); out.shop.sc = { open, wait, rich, plain };
      Bz.lastDay = -1; fix(0.01, () => BIZ.daily(w)); out.shop.noDice = Bz.shops.length === 0;
      const c0 = Bal[B.agentId]; let res = null; const cons = conserved(() => { res = opt(B, 'startup', 'open').run(w, B); });
      out.shop.done = { n: Bz.shops.length, owner: Bz.shops[0]?.owner === B.agentId, paid: Math.round(c0 - Bal[B.agentId]), cons, res: !!res, again: K.startup.when(w, B) };
      const cap = Math.max(2, Math.floor(Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length / 6)); traits(C, ['hardworking', 'creative']); Bal[C.agentId] = 100; const before = !!K.startup.when(w, C);
      while (Bz.shops.length < cap) Bz.shops.push({ owner: 'x' + Bz.shops.length, name: ['測', 'T'], type: 'stall' }); out.shop.full = { before, after: K.startup.when(w, C) };
      Bz.shops = []; }

    // ---------- 8) 別鎮開高薪來挖角 ----------
    clean(); { const V = RIVAL.S(w); const p = RIVAL.ensure(w); for (const o of all) for (const s of Object.values(o.skills?.skills || {})) s.xp = 0; H.skills.skills['工藝'].xp = 9000; H.age = 30;
      const n0 = Object.keys(w.agents).length; const ok1 = RIVAL.event(w, 'talent'); const q = X.q.find(x => x.kind === 'poach');
      out.poach = { place: !!p, ok: ok1 === 'talent', q: !!q && q.a === H.agentId, same: Object.keys(w.agents).length === n0, asked: V.st.asked >= 1, ids: q && ids(H, 'poach', q.ctx) };
      if (q) { keep('poach', H, q.ctx); const C3 = q.ctx; const stay = sc(H, 'poach', 'stay', C3), go = sc(H, 'poach', 'go', C3);
        traits(H, ['hardworking', 'greedy']); const goG = sc(H, 'poach', 'go', C3); traits(H, ['hardworking']); for (const o of [A, B, C, D]) rel(H, o, 60); const stayF = sc(H, 'poach', 'stay', C3); for (const o of [A, B, C, D]) rel(H, o, 0);
        H.mood = 20; const staySad = sc(H, 'poach', 'stay', C3); H.mood = 50; out.poach.sc = { stay, go, goG, stayF, staySad };
        // 留下
        const k0 = V.st.kept; X.q = [q]; for (const o of [A, B, C, D]) rel(H, o, 60); H.mood = 80; drain(); out.poach.kept = { id: lastLog(H)?.id, here: !!w.agents[H.agentId], st: V.st.kept - k0, mem: mems(H, 4).length > 0, log: /🙅/.test(logs(5)) };
        // 走：貪心、沒什麼朋友、心情差
        for (const o of [A, B, C, D]) rel(H, o, 0); traits(H, ['hardworking', 'greedy']); H.mood = 20; const l0 = V.st.lost; X.q = [{ a: H.agentId, kind: 'poach', ctx: C3 }]; drain();
        out.poach.left = { gone: !w.agents[H.agentId], st: V.st.lost - l0, log: /💼/.test(logs(6)) }; }
    }

    // ---------- 9) 新科技的態度：兩邊一致 ----------
    { const I = w.ideaSystem; const a = A; const op = MIND.S(w).op[a.agentId]; const keepOp = op.tech; const keepIdeas = JSON.parse(JSON.stringify(I.ideas));
      I.ideas = { t1: { a: [a.agentId], r: [] }, t2: { a: [a.agentId], r: [] }, t3: { a: [a.agentId], r: [] } }; const o0 = I.openness(w, a, '');
      op.tech = 0; const s0 = I.stance(w, a); op.tech = 2; const s2 = I.stance(w, a); const up = I.stanceLabel(w, a); op.tech = -2; const down = I.stanceLabel(w, a);
      I.ideas = { t1: { a: [], r: [a.agentId] }, t2: { a: [], r: [a.agentId] }, t3: { a: [], r: [a.agentId] } }; op.tech = 2; const cons2 = I.stanceLabel(w, a); op.tech = -2; const cons = I.stanceLabel(w, a);
      op.tech = 0; I._lean(w, a, 0.2); const leanUp = op.tech; I._lean(w, a, -0.25); const leanDown = op.tech;
      out.tech = { diff: Math.round((s2 - s0) * 100) / 100, up, down, cons, cons2, leanUp, leanDown: Math.round(leanDown * 100) / 100 }; I.ideas = keepIdeas; op.tech = keepOp; }

    // ---------- 10) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    clean(); w.fullAgentMode = true; { Bal[B.agentId] = 800; traits(A, ['hardworking', 'greedy']); INVEST.buy(w, B, Kf, true); only(A); others(A, ['sell']); prompts = [];
      reply = (p) => /想出|is offering/.test(p) ? [{ n: 1, pick: 'b', why: 'W-KEEP', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A); const pD = prompts.find(p => /想出|is offering/.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, stake: SHARES.pctOf(w, Kf, B.agentId), plan: DECIDE.view(w, A).plan, feed: /🧭/.test(logs(8)), menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    w.research.currentEra = () => 3;
    clean(); stock(); w.fullAgentMode = true; { Hs.lv[home] = 0; for (const o of mates) Bal[o.agentId] = 1; Bal[E.agentId] = cost * 2; only(E); others(E, ['renovate']); prompts = [];
      reply = (p) => /翻修要|Rebuilding costs/.test(p) ? [{ n: 1, pick: 'b', why: 'W-HOME' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(E); const pR = prompts.find(p => /翻修要|Rebuilding costs/.test(p)) || '';
      out.ai2 = { id: e?.id, ai: e?.ai, why: e?.why?.raw, lv: Hs.lv[home], asked: !!pR, cjk: /[一-鿿]/.test(pR), bits: (pR.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    w.research.currentEra = _era;
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 11) 存讀檔、跑幾天 ----------
    clean(); { Bal[B.agentId] = 800; INVEST.buy(w, B, Kf, true); SX.ask.farm = { by: C.agentId, pct: 20, price: 50, d: d0() };
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { inv: w2.market?.inv?.ask?.[Kf]?.by === B.agentId, envy: w2.market?.sh?.ask?.farm?.by === C.agentId, q: (w2.decide?.q || []).some(x => x.kind === 'sell') }; }
    clean(); { let err = null; try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, pick: Object.keys(X.pick).filter(k => new RegExp('^(' + NEW.join('|') + ')\\.').test(k)), q: X.q.length }; }
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
  const gt = (a, b) => typeof a === 'number' && typeof b === 'number' && a > b;
  // 登記
  ok(r.kinds.all && r.kinds.life && r.kinds.on && r.kinds.queued, '七個選擇點都登記了；賣股份、被挖角是「別人找上門」才會遇到', r.kinds);
  // 股份：賣不賣
  ok(r.ask.quote && r.ask.asked && r.ask.ok === false && r.ask.stake === 0 && r.ask.q === 1 && r.ask.pending && r.ask.busy && r.ask.ids?.join() === 'yes,no', '有人拿存款來談入股：不擲骰，先記下來等當家回話（同一家同時只談一個）', r.ask);
  ok(gt(r.sellSc.greedy, r.sellSc.base.yes) && gt(r.sellSc.stubNo, r.sellSc.base.no) && gt(r.sellSc.friend, r.sellSc.base.yes) && gt(r.sellSc.base.yes, r.sellSc.foe) && gt(r.sellSc.broke, r.sellSc.rich), '賣不賣看當家自己：貪心、缺錢的爽快；固執的不肯；交情好的好說話', r.sellSc);
  ok(r.sold.id === 'yes' && r.sold.kind === 'sell' && r.sold.stake === r.sold.p && r.sold.boss === 100 - r.sold.p && r.sold.got === r.sold.price && r.sold.paid === r.sold.price && r.sold.dearer && r.sold.cons && r.sold.log && !r.sold.pending && r.sold.still, '當家答應：股份和錢真的過手，他還是當家（銀幣守恆）', r.sold);
  ok(r.refused.id === 'no' && r.refused.stake === 0 && r.refused.same && r.refused.cold && r.refused.log && !r.refused.pending, '當家回絕：錢一塊沒動，來談的人對他冷了一點', r.refused);
  ok(r.gone.same && !r.gone.pending && r.gone.expired, '等回話時買的人錢不夠了：不成交；三天沒下文的邀約不擋別人', r.gone);
  ok(r.direct.ok && r.direct.stake > 0 && r.direct.q === 0, '沒說要問當家時（例如當家不在鎮上）：當場談成', r.direct);
  ok(r.envy.asked && r.envy.by && r.envy.stake === 0 && r.envy.ctx && r.envy.ids?.join() === 'yes,no' && r.envy.sold?.id === 'yes' && r.envy.sold.stake > 0 && r.envy.sold.paid > 0 && r.envy.sold.cons && r.envy.sold.log && !r.envy.sold.pending, '眼紅入股：每週流程只記下有人來談，當家答應才成交（銀幣守恆）', r.envy);
  // 退股
  ok(r.out.weeks === 3 && r.out.stake === 30 && r.out.ctx && r.out.boss === null && r.out.ids?.join() === 'keep,out' && r.out.early === null, '分紅連三週不如銀行：只記週數，不替股東賣；不到三週、當家自己都不會遇到', r.out);
  ok(gt(r.out.sc.o6, r.out.sc.o3) && gt(r.out.sc.kf, r.out.sc.k3), '拖得越久越想退；跟當家交情好的比較願意等', r.out.sc);
  ok(r.out.done.stake === 0 && r.out.done.boss === 100 && r.out.done.dep && r.out.done.cons && r.out.done.res && r.out.done.log && r.out.done.after === null, '決定退股：股份賣回給當家、錢存進銀行（銀幣守恆）', r.out.done);
  // 翻修
  ok(r.reno.poor === null && r.reno.ctx && r.reno.ids?.join() === 'wait,pay' && r.reno.other === null && r.reno.noDice, '房子舊了：錢不夠又借不到的人沒有這件事；家裡最有錢的人作主；每日流程不再擲骰', r.reno);
  ok(gt(r.reno.sc.pay, r.reno.sc.tight) && gt(r.reno.sc.pay, r.reno.sc.asc) && gt(r.reno.sc.envy, r.reno.sc.pay), '越寬裕越想翻修；清心寡欲的人不想；看到鄰居翻修的人更想', r.reno.sc);
  ok(r.reno.done.lv === 1 && r.reno.done.paid === r.reno.done.cost && r.reno.done.cons && r.reno.done.res && r.reno.done.log && r.reno.done.envyHook, '決定翻修：付錢、房子升一級、鄰居看得到（銀幣守恆）', r.reno.done);
  ok(r.loan.ids?.join() === 'wait,loan' && gt(r.loan.sc.envy, r.loan.sc.plain) && gt(r.loan.sc.plain, r.loan.sc.asc) && gt(r.loan.sc.wait, r.loan.sc.plain), '手頭不夠只能借：多半先不借；眼紅鄰居的人比較敢借', r.loan);
  ok(r.loan.done.lv === 1 && r.loan.done.debt && r.loan.done.cons && r.loan.done.res && r.loan.done.envyGone && r.loan.done.log && r.loan.inDebt === null, '決定借錢翻修：欠銀行一筆、房子翻修好；已經欠銀行錢的人不能再借', r.loan);
  ok(r.noMat.lack && r.noMat.ctx === null, '鎮上建材不夠：沒有這件事', r.noMat);
  ok(r.renoSrc.bank && r.renoSrc.ways, '銀行、「跟鄰居比」的每日流程不再替人借錢翻修', r.renoSrc);
  // 奉獻
  if (!r.tithe.skip) {
    ok(r.tithe.poor === null && r.tithe.cold === null && r.tithe.ids?.join() === 'skip,small' && r.tithe.sc.idsRich?.join() === 'skip,small,big' && r.tithe.noDice, '奉獻：手頭緊、不虔誠的人沒有這件事；有錢的多一個「大筆捐獻」；每日流程不再擲骰', r.tithe);
    ok(gt(r.tithe.sc.s80, r.tithe.sc.s50) && gt(r.tithe.sc.s80, r.tithe.sc.skip) && gt(r.tithe.sc.big, r.tithe.sc.bigG) && gt(r.tithe.sc.skipG, r.tithe.sc.skip), '越虔誠越願意奉獻；貪心的人捨不得', r.tithe.sc);
    ok(r.tithe.small.paid === 2 && r.tithe.small.got === 2 && r.tithe.small.cons && r.tithe.small.res && r.tithe.small.mem, '隨手奉獻：錢進了教團基金（銀幣守恆）', r.tithe.small);
    ok(r.tithe.big.paid === 32 && r.tithe.big.got === 32 && r.tithe.big.n === 1 && r.tithe.big.cons && r.tithe.big.res && r.tithe.big.log, '大筆捐獻：大家都看見（銀幣守恆）', r.tithe.big);
  }
  // 陰謀
  ok(r.scheme.ctx && r.scheme.ids?.[0] === 'hold' && r.scheme.ids.includes('frame') && r.scheme.ids.includes('sabotage') && r.scheme.noDice, '結怨很深：可以忍、可以栽贓、可以破壞；每日流程不再擲骰', r.scheme);
  ok(gt(r.scheme.sc.hot, r.scheme.sc.mild) && gt(r.scheme.sc.deep, r.scheme.sc.hot) && gt(r.scheme.sc.hot, r.scheme.sc.frame) && r.scheme.sc.kind === null && r.scheme.sc.shallow === null, '心眼越壞、怨越深越想動手；善良的人、怨不深的人沒有這件事', r.scheme.sc);
  ok(r.scheme.done.res && r.scheme.done.plan && r.scheme.done.log && r.scheme.done.cool === null && r.scheme.acted, '決定動手：開始籌劃，一兩天後照舊動手；二十天內不會再想下一次', { ...r.scheme.done, acted: r.scheme.acted });
  // 開店
  ok(r.shop.ctx && r.shop.ids?.join() === 'wait,open' && r.shop.mayor === null && r.shop.sc.plain === null && r.shop.noDice, '想不想開店：有本錢、有那個心的人才會遇到；每日流程不再擲骰', r.shop);
  ok(gt(r.shop.sc.rich, r.shop.sc.open) && gt(r.shop.sc.wait, r.shop.sc.open), '一心想致富的人比較想開；一般人多半再想想', r.shop.sc);
  ok(r.shop.done.n === 1 && r.shop.done.owner && r.shop.done.paid === 60 && r.shop.done.cons && r.shop.done.res && r.shop.done.again === null, '決定開店：本錢付出去、店真的開了（銀幣守恆）；已經有店的人不會再遇到', r.shop.done);
  ok(r.shop.full.before && r.shop.full.after === null, '鎮上的店滿了就沒有這件事', r.shop.full);
  // 挖角
  ok(r.poach.place && r.poach.ok && r.poach.q && r.poach.same && r.poach.asked && r.poach.ids?.join() === 'stay,go', '對手鎮來挖角：不擲骰，先問本人', r.poach);
  ok(gt(r.poach.sc.goG, r.poach.sc.go) && gt(r.poach.sc.stayF, r.poach.sc.stay) && gt(r.poach.sc.stay, r.poach.sc.staySad), '貪心的想走；朋友多的想留；日子過得悶的比較留不住', r.poach.sc);
  ok(r.poach.kept?.id === 'stay' && r.poach.kept.here && r.poach.kept.st === 1 && r.poach.kept.log, '決定留下：人還在，鎮上知道他婉拒了', r.poach.kept);
  ok(r.poach.left?.gone && r.poach.left.st === 1 && r.poach.left.log, '決定走：真的搬離這個鎮', r.poach.left);
  // 新科技的態度
  ok(r.tech.diff === 1 && r.tech.up === 'progressive' && r.tech.down === 'moderate' && r.tech.cons === 'conservative' && r.tech.cons2 === 'moderate' && r.tech.leanUp === 0.2 && r.tech.leanDown === -0.05, '新科技的態度只有一份：立場算進革新／保守；兩邊相反時算中間；接受或抗拒新觀念會推動立場', r.tech);
  // AI
  ok(r.ai.id === 'no' && r.ai.ai === 1 && r.ai.why === 'W-KEEP' && r.ai.stake === 0 && r.ai.plan === 'N-NEXT' && r.ai.feed && r.ai.menu && r.ai.money, 'AI 版：當家由 AI 決定不賣並說理由（就算他貪心）', r.ai);
  ok(r.ai2.id === 'pay' && r.ai2.ai === 1 && r.ai2.why === 'W-HOME' && r.ai2.lv === 1 && r.ai2.asked, 'AI 版：住戶由 AI 決定翻修，房子真的翻修好', r.ai2);
  if (!zh) ok(!r.ai.cjk && !r.ai2.cjk, '英文版給 AI 的資料沒有中文', { a: r.ai.bits, b: r.ai2.bits });
  if (!zh) ok(r.txt.length === 0, '英文版：選擇點的標題、事實、選項都有翻譯', r.txt.slice(0, 6));
  ok(Object.values(r.facts).every(v => typeof v === 'number' && v > 20), '每個選擇點都講得出這個人遇到的事', r.facts);
  ok(r.save.inv && r.save.envy && r.save.q, '存讀檔：還在等當家回話的入股邀約都留著', r.save);
  ok(!r.days.err && r.days.q === 0, '連跑八天沒有錯誤，沒有卡住的事', r.days);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
