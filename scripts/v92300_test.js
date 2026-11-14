// v9.23.0 決策核心批次 A（生計與去留）
// 要不要搬離小鎮、跳槽、拜師學手藝、在對面開店、跟合夥人拆夥：改由本人決定，不再擲骰。
// 驗：五個選擇點都登記了、每日流程不再擲骰、每個選項的結算、個性與處境不同分數不同、AI 版、銀幣守恆、存讀檔、中英文
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
    const [A, B, C, D, E, F, G, H, Z1, Z2, Z3] = pool; // A 老闆、B 想開店的人／合夥人、C D G 工人、E 年輕人、F 師傅、H 過得很慘的人、Z 備用
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const M = MARKET.S(w); const P = w.proposals; const MBs = MOBILITY.S(w); const Bz = BIZ.S(w); COMPETE.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships.relationships[b.agentId]?.affinity || 0;
    const traits = (a, ts) => { a.personality.traits = ts.slice(); a.personality.values = []; };
    const d0 = () => w._absDay();
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const TEST = [A, B, C, D, E, F, G, H, Z1, Z2, Z3]; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const Kf = 'kitchen';
    const clean = () => {
      X.cool = {}; X.q = []; M.hungry = {}; P.issues = {}; P.issueLeaveDay = -99; MBs.ap = {}; MBs.done = {}; MBs.mst = {}; Bz.shops = [];
      for (const a of all()) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 50; if (a.job?.key === 'cook') a.job = new Job('guard'); }
      for (const a of TEST) { if (!w.agents[a.agentId]) continue; traits(a, ['hardworking']); a.age = 30; for (const b of TEST) if (a !== b && w.agents[b.agentId]) rel(a, b, 0); a.job = new Job('guard'); }
      for (const k of Object.keys(MARKET.SECTORS)) { delete M.owners[k]; delete M.shares[k]; delete M.rival[k]; M.good[k] = 0; }
      M.owners[Kf] = A.agentId; M.pay[Kf] = 1; M.price[Kf] = 1; M.hist[Kf] = Array.from({ length: 7 }, () => [60, 10]);
      for (const a of [C, D, G]) a.job = new Job('cook'); A.job = new Job('trader');
      if (w.mind?.amb) for (const a of TEST) delete w.mind.amb[a.agentId];
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const NEW = ['leave', 'jobhop', 'apprentice', 'rivalshop', 'split'];
    const texts = {}; const keep = (name, key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };
    const rival = (owner, pay) => { M.rival[Kf] = { fid: 'F9', owner: owner.agentId, since: d0(), price: 1, pay, emp: {}, rev: 0, cost: 0, hist: Array.from({ length: 7 }, () => [40, 10]), loss: 0 }; return M.rival[Kf]; };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), work: DECIDE.work === true, on: DECIDE.on(w), scan: NEW.every(k => K[k].scan !== false) };

    // ---------- 2) 對面那家工資比較高 ----------
    clean(); { const R = rival(B, 1.2); const ws = MARKET.workersOf(w, Kf, all());
      const c1 = K.jobhop.when(w, C); out.hop = { workers: [C, D, G].every(a => ws.includes(a)), ctx: !!c1, ids: ids(C, 'jobhop'), boss: K.jobhop.when(w, A), owner: K.jobhop.when(w, B), other: K.jobhop.when(w, E) }; keep('jobhop', 'jobhop', C);
      const stay = sc(C, 'jobhop', 'stay'), move = sc(C, 'jobhop', 'move'); rel(C, A, 60); const stayF = sc(C, 'jobhop', 'stay'); rel(C, A, 0); traits(C, ['hardworking', 'greedy']); const moveG = sc(C, 'jobhop', 'move'); traits(C, ['hardworking']);
      R.pay = 1.5; const moveBig = sc(C, 'jobhop', 'move'); R.pay = 1.05; const small = K.jobhop.when(w, C); R.pay = 1.2; out.hop.sc = { stay, move, stayF, moveG, moveBig, small };
      // 每週流程交給本人：骰子再順也沒有人被換過去
      fix(0.01, () => COMPETE.weekly(w, all(), d0())); out.hop.noDice = Object.keys(R.emp).length === 0;
      const p0 = M.cst.poach; const res = opt(C, 'jobhop', 'move').run(w, C); out.hop.done = { res: !!res, at: !!R.emp[C.agentId], n: M.cst.poach - p0, hopI: R.hopI, after: K.jobhop.when(w, C), log: /🔀/.test(logs(4)) };
      fix(0.99, () => COMPETE.weekly(w, all(), d0())); out.hop.raise = { pay: M.pay[Kf], cleared: R.hopI === undefined }; // 被挖走人、還在賺錢的老闆下次結算時加薪
    }

    // ---------- 3) 這一行很賺：要不要在對面開一家 ----------
    clean(); { traits(B, ['hardworking', 'greedy']); Bal[B.agentId] = 300; M.good[Kf] = 2;
      const c1 = K.rivalshop.when(w, B); const I = COMPETE.openInfo(w, B); out.shop = { ctx: !!c1, ids: ids(B, 'rivalshop'), cost: I?.cost, s: I?.s, boss: K.rivalshop.when(w, A) }; keep('rivalshop', 'rivalshop', B);
      const open = sc(B, 'rivalshop', 'open'), wait = sc(B, 'rivalshop', 'wait'); B.job = new Job('cook'); const same = sc(B, 'rivalshop', 'open'); B.job = new Job('guard');
      rel(B, A, 60); const friend = K.rivalshop.when(w, B); rel(B, A, 0); Bal[B.agentId] = 60; const poor = K.rivalshop.when(w, B); Bal[B.agentId] = 300; M.good[Kf] = 1; const early = K.rivalshop.when(w, B); M.good[Kf] = 2;
      traits(B, []); const plain = K.rivalshop.when(w, B); traits(B, ['hardworking', 'charismatic']); const mild = sc(B, 'rivalshop', 'open'); traits(B, ['hardworking', 'greedy']); out.shop.sc = { open, wait, same, mild, friend, poor, early, plain };
      // 每週流程交給本人：有人自己開得起，就等他拿主意
      fix(0.01, () => COMPETE.entry(w, all(), d0())); out.shop.noDice = !M.rival[Kf] && M.good[Kf] === 3;
      const b0 = Bal[B.agentId], af0 = aff(A, B); let res = null; const cons = conserved(() => { res = opt(B, 'rivalshop', 'open').run(w, B); }); const R = M.rival[Kf];
      out.shop.done = { res: !!res, owner: R?.owner === B.agentId, paid: Math.round(b0 - Bal[B.agentId]), cons, staff: Object.keys(R?.emp || {}).length, cold: aff(A, B) < af0, log: /🏪/.test(logs(5)), after: K.rivalshop.when(w, B), good: M.good[Kf] };
    }

    // ---------- 4) 要不要拜師學手藝 ----------
    clean(); { E.age = 22; E.job = new Job('farmer'); F.job = new Job('blacksmith'); MBs.mst.blacksmith = F.agentId; Bal[E.agentId] = 30; rel(F, E, 10);
      const c1 = K.apprentice.when(w, E); const I = MOBILITY.learnInfo(w, E); out.appr = { lv: CLASS.level(w, E), ctx: !!c1 && c1.m === F.agentId, ids: ids(E, 'apprentice'), fast: I?.fast, days: I?.days, fee: I?.fee }; keep('apprentice', 'apprentice', E);
      const learn = sc(E, 'apprentice', 'learn'), no = sc(E, 'apprentice', 'no'); traits(E, []); const plain = sc(E, 'apprentice', 'learn'); traits(E, ['lazy']); const lazy = sc(E, 'apprentice', 'learn'); traits(E, ['hardworking', 'creative']); const keen = sc(E, 'apprentice', 'learn'); traits(E, ['hardworking']);
      E.age = 40; const old = K.apprentice.when(w, E); E.age = 22; E.job = new Job('tailor'); const craft = K.apprentice.when(w, E); E.job = new Job('farmer');
      MBs.ap = { x1: { m: 'y1', k: 'cook', d0: d0() }, x2: { m: 'y2', k: 'cook', d0: d0() } }; const full = K.apprentice.when(w, E); MBs.ap = {};
      out.appr.sc = { learn, no, plain, lazy, keen, old, craft, full };
      const d7 = Math.ceil(d0() / 7) * 7; fix(0.01, () => MOBILITY.apprentice(w, all(), d7)); out.appr.noDice = !MBs.ap[E.agentId];
      const e0 = Bal[E.agentId], f0 = Bal[F.agentId]; let res = null; const cons = conserved(() => { res = opt(E, 'apprentice', 'learn').run(w, E); });
      out.appr.done = { res: !!res, ap: MBs.ap[E.agentId]?.m === F.agentId, k: MBs.ap[E.agentId]?.k, paid: e0 - Bal[E.agentId], got: Bal[F.agentId] - f0, cons, log: /🧑‍🏫/.test(logs(4)), after: K.apprentice.when(w, E) };
    }

    // ---------- 5) 合夥的店不賺錢 ----------
    clean(); { try { I18N.registerName('測試小店', 'Test Shop'); } catch (e) {}
      const mk = (last) => ({ id: 's' + Math.random(), owner: A.agentId, partner: B.agentId, name: ['測試小店', 'Test Shop'], type: 'stall', price: 3, till: 0, week: 2, last, profit: 0, lossDays: 0 });
      const s = mk(2); Bz.shops = [s];
      out.split = { owner: !!K.split.when(w, A), partner: !!K.split.when(w, B), ids: ids(B, 'split'), other: K.split.when(w, C) }; keep('split', 'split', B); keep('splitOwner', 'split', A);
      const stay = sc(B, 'split', 'stay'), sp = sc(B, 'split', 'split'); traits(B, ['hardworking', 'jealous']); const jealous = sc(B, 'split', 'split'); traits(A, ['lazy']); const lazyO = sc(B, 'split', 'split'); traits(A, ['hardworking']); traits(B, ['hardworking']);
      rel(B, A, 60); const stayF = sc(B, 'split', 'stay'); rel(B, A, 0); s.last = 20; const good = K.split.when(w, B); delete s.last; const fresh = K.split.when(w, B); s.last = 2;
      out.split.sc = { stay, sp, jealous, lazyO, stayF, good, fresh };
      // 每週流程交給本人：愛計較、骰子再順也不會自動拆夥；順便記下這一週賺多少
      traits(B, ['hardworking', 'jealous']); s.week = 3; fix(0.01, () => BIZ.weekly(w, s)); out.split.noDice = s.partner === B.agentId && s.last === 3 && s.week === 0;
      const af0 = aff(B, A); const res = opt(B, 'split', 'split').run(w, B); out.split.done = { res: !!res, gone: s.partner === null, flag: s.split === true, cold: aff(B, A) === af0 - 20, log: /💢/.test(logs(4)), after: K.split.when(w, B) };
      Bz.shops = []; }

    // ---------- 6) 想不想離開這個鎮：餓到活不下去 ----------
    clean(); { M.hungry[H.agentId] = 8;
      const c1 = K.leave.when(w, H); out.starve = { ctx: c1, ids: ids(H, 'leave'), fed: K.leave.when(w, E) }; keep('leaveStarve', 'leave', H);
      const stay = sc(H, 'leave', 'stay'), go = sc(H, 'leave', 'go'); M.hungry[H.agentId] = 12; const goLong = sc(H, 'leave', 'go'); M.hungry[H.agentId] = 8;
      for (const o of [A, B, C, D]) rel(H, o, 60); const stayF = sc(H, 'leave', 'stay'); for (const o of [A, B, C, D]) rel(H, o, 0); H.mood = 10; const goSad = sc(H, 'leave', 'go'); H.mood = 50; M.hungry[H.agentId] = 6; const notYet = K.leave.when(w, H); M.hungry[H.agentId] = 8;
      out.starve.sc = { stay, go, goLong, stayF, goSad, notYet };
      // 每日流程交給本人：骰子落在「會離鄉」的值也不走(0.045：不會餓死、會離鄉)
      const n0 = Object.keys(w.agents).length; fix(0.045, () => MARKET.hunger(w, all())); out.starve.noDice = !!w.agents[H.agentId] && Object.keys(w.agents).length === n0;
      const l0 = M.left || 0; const res = opt(H, 'leave', 'go').run(w, H); out.starve.done = { res: !!res, gone: !w.agents[H.agentId], left: (M.left || 0) - l0, log: /🎒/.test(logs(5)) };
      M.hungry = {}; }

    // ---------- 7) 想不想離開這個鎮：鎮上的事拖著沒人管 ----------
    clean(); { const day = P._abs(w); const issue = (key, extra) => { P.issues = { [key]: Object.assign({ key, k: '存糧不夠', p: {}, sev: 3, idle: 6, since: day - 6 }, extra || {}) }; };
      for (const a of all()) a.mood = 60; C.mood = 5; D.mood = 6; G.mood = 7; E.mood = 8; // 心情最差的三個：C D G
      issue('food'); const cF = K.leave.when(w, C); keep('leaveFood', 'leave', C);
      out.town = { food: cF, third: K.leave.when(w, G), fourth: K.leave.when(w, E), happy: K.leave.when(w, A), ids: ids(C, 'leave') };
      issue('food', { sev: 2 }); out.town.mild = K.leave.when(w, C); issue('food', { idle: 3 }); out.town.early = K.leave.when(w, C); issue('food', { by: 'L1' }); out.town.handled = K.leave.when(w, C);
      issue('gloom'); out.town.gloom = K.leave.when(w, C); keep('leaveGloom', 'leave', C);
      issue('misery:' + E.agentId, { who: [E.agentId], idle: 7 }); out.town.misery = K.leave.when(w, E); out.town.miseryOther = K.leave.when(w, A); keep('leaveMisery', 'leave', E);
      issue('misery:' + E.agentId, { who: [E.agentId], idle: 5 }); out.town.miseryEarly = K.leave.when(w, E);
      issue('food'); const goFood = sc(C, 'leave', 'go'); issue('gloom'); const goGloom = sc(C, 'leave', 'go'); issue('misery:' + C.agentId, { who: [C.agentId], idle: 7 }); const goMis = sc(C, 'leave', 'go'); out.town.sc = { goFood, goGloom, goMis };
      issue('food'); const hd = w.election._officeHolder(w); if (hd) { const m0 = hd.mood; hd.mood = 1; out.town.holder = hd.job?.key === 'mayor' ? K.leave.when(w, hd) : null; hd.mood = m0; } else out.town.holder = null;
      const res = opt(C, 'leave', 'go').run(w, C); out.town.done = { res: !!res, gone: !w.agents[C.agentId], day: P.issueLeaveDay === day, next: K.leave.when(w, D) }; // 三天內已經有人為這種事走了：其他人先不走
      P.issues = {}; }
    // 急事的每日流程：真的缺糧拖了幾天，也沒有人被擲骰送走
    clean(); { const sp = w.stockpile; const keepRes = Object.assign({}, sp.resources); for (const r of ['food', 'meals', 'bread', 'grain', 'fish', 'meat']) if (r in sp.resources) sp.resources[r] = 0; sp.resources.food = 2;
      const items0 = P.items; P.items = P.items.filter(p => p.status !== 'open'); const gen0 = P._generate; P._generate = () => {};
      for (const a of all()) a.mood = 60; let day = P._abs(w) + 50; const n0 = Object.keys(w.agents).length;
      const runDay = () => { day++; for (const a of all()) a.mood = 60; D.mood = 5; fix(0.01, () => TOWN_ISSUES.daily(w, P, day)); };
      for (let i = 0; i < 8; i++) runDay(); const fd = P.issues.food;
      out.daily = { issue: !!fd, sev: fd?.sev, idle: fd?.idle, same: Object.keys(w.agents).length === n0 };
      Object.assign(sp.resources, keepRes); P.items = items0; P._generate = gen0; P.issues = {}; }

    // ---------- 8) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    clean(); w.fullAgentMode = true; { const R = rival(B, 1.2); rel(G, A, 80); only(G); others(G, ['jobhop']); prompts = [];
      reply = (p) => /行情的|going wage/.test(p) ? [{ n: 1, pick: 'b', why: 'W-PAY', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(G); const pD = prompts.find(p => /行情的|going wage/.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, at: !!R.emp[G.agentId], plan: DECIDE.view(w, G).plan, feed: /🧭/.test(logs(8)), menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 9) 存讀檔、跑幾天 ----------
    clean(); { const R = rival(B, 1.2); R.hopI = 2; Bz.shops = [{ id: 's9', owner: A.agentId, partner: B.agentId, name: ['測試小店', 'Test Shop'], type: 'stall', price: 3, till: 0, week: 1, last: 2, profit: 0, lossDays: 0 }]; P.issueLeaveDay = 77;
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { hop: w2.market?.rival?.[Kf]?.hopI === 2, last: w2.biz?.shops?.[0]?.last === 2 }; Bz.shops = []; }
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
  ok(r.kinds.all && r.kinds.work && r.kinds.on && r.kinds.scan, '五個選擇點都登記了', r.kinds);
  // 跳槽
  ok(r.hop.workers && r.hop.ctx && r.hop.ids?.join() === 'stay,move' && r.hop.boss === null && r.hop.owner === null && r.hop.other === null && r.hop.sc.small === null && r.hop.noDice, '對面工資高一成以上，工人才會遇到「要不要換過去」；兩邊老闆、不在這一行的人不會；每週流程不再擲骰', r.hop);
  ok(gt(r.hop.sc.stayF, r.hop.sc.stay) && gt(r.hop.sc.moveG, r.hop.sc.move) && gt(r.hop.sc.moveBig, r.hop.sc.move) && gt(r.hop.sc.stay, r.hop.sc.move), '跟老闆交情好的想留；貪心的、工資差得多的想走；一般人多半留著', r.hop.sc);
  ok(r.hop.done.res && r.hop.done.at && r.hop.done.n === 1 && r.hop.done.hopI === 1 && r.hop.done.after === null && r.hop.done.log, '決定換過去：真的換到對面那一家，工資不再比別人低就不會再想', r.hop.done);
  ok(r.hop.raise.pay === 1.05 && r.hop.raise.cleared, '被挖走人的老闆下次結算時加薪', r.hop.raise);
  // 開對手店
  ok(r.shop.ctx && r.shop.ids?.join() === 'wait,open' && r.shop.cost === 54 && r.shop.boss === null && r.shop.sc.friend === null && r.shop.sc.poor === null && r.shop.sc.early === null && r.shop.sc.plain === null && r.shop.noDice, '這一行連兩週好賺、出得起本錢、有那個心的人才會遇到；跟老闆交情好的不會去搶；每週流程不再擲骰', r.shop);
  ok(gt(r.shop.sc.same, r.shop.sc.open) && gt(r.shop.sc.open, r.shop.sc.mild) && gt(r.shop.sc.wait, r.shop.sc.mild), '本來就做這一行的、貪心的更想開；沒那麼想賺的多半再看看', r.shop.sc);
  ok(r.shop.done.res && r.shop.done.owner && r.shop.done.paid === 54 && r.shop.done.cons && r.shop.done.staff >= 1 && r.shop.done.cold && r.shop.done.log && r.shop.done.after === null && r.shop.done.good === 0, '決定開：本錢付出去、挖走一部分工人、老闆記恨（銀幣守恆）', r.shop.done);
  // 拜師
  ok(r.appr.ctx && r.appr.ids?.join() === 'no,learn' && r.appr.fast && r.appr.days === 20 && r.appr.sc.old === null && r.appr.sc.craft === null && r.appr.sc.full === null && r.appr.noDice, '沒什麼出路的年輕人、鎮上有師傅肯收時才會遇到；年紀大的、已經是工匠的、師傅收滿了不會；每日流程不再擲骰', r.appr);
  ok(gt(r.appr.sc.keen, r.appr.sc.learn) && gt(r.appr.sc.learn, r.appr.sc.plain) && gt(r.appr.sc.plain, r.appr.sc.lazy) && gt(r.appr.sc.no, r.appr.sc.learn), '勤勞、有創意的比較想學；懶的不想；一般人多半照現在這樣過', r.appr.sc);
  ok(r.appr.done.res && r.appr.done.ap && r.appr.done.k === 'blacksmith' && r.appr.done.paid === r.appr.fee && r.appr.done.got === r.appr.fee && r.appr.done.cons && r.appr.done.log && r.appr.done.after === null, '決定拜師：拜師禮付給師傅、開始當學徒（銀幣守恆）', r.appr.done);
  // 拆夥
  ok(r.split.owner && r.split.partner && r.split.ids?.join() === 'stay,split' && r.split.other === null && r.split.sc.good === null && r.split.sc.fresh === null && r.split.noDice, '合夥的店上週賺不到 5 銀幣，老闆和合夥人都會遇到；生意好、剛開張還沒滿一週不會；每週流程不再擲骰', r.split);
  ok(gt(r.split.sc.jealous, r.split.sc.sp) && gt(r.split.sc.lazyO, r.split.sc.jealous) && gt(r.split.sc.stayF, r.split.sc.stay) && gt(r.split.sc.stay, r.split.sc.sp), '愛計較的、對方偷懶的想拆；交情好的願意撐；一般人多半再撐一陣子', r.split.sc);
  ok(r.split.done.res && r.split.done.gone && r.split.done.flag && r.split.done.cold && r.split.done.log && r.split.done.after === null, '決定拆夥：店由老闆自己開下去，兩人翻臉', r.split.done);
  // 搬走：餓
  ok(r.starve.ctx?.key === 'starve' && r.starve.ids?.join() === 'stay,go' && r.starve.fed === null && r.starve.sc.notYet === null && r.starve.noDice, '餓了七天以上的人才會想「要不要離鄉」；每日流程不再擲骰', r.starve);
  ok(gt(r.starve.sc.goLong, r.starve.sc.go) && gt(r.starve.sc.stayF, r.starve.sc.stay) && gt(r.starve.sc.goSad, r.starve.sc.go), '餓得越久越想走；朋友多的想留；心情差的更想走', r.starve.sc);
  ok(r.starve.done.res && r.starve.done.gone && r.starve.done.left === 1 && r.starve.done.log, '決定走：真的搬離這個鎮', r.starve.done);
  // 搬走：鎮上的事
  ok(r.town.food?.key === 'food' && r.town.third?.key === 'food' && r.town.fourth === null && r.town.happy === null && r.town.ids?.join() === 'stay,go' && r.town.mild === null && r.town.early === null && r.town.handled === null, '缺糧嚴重、拖了五天沒人管：心情最差的三個人會想走；不嚴重、才剛發生、已經有人提案處理就不會', r.town);
  ok(r.town.gloom?.key === 'gloom' && r.town.misery?.key === 'misery' && r.town.miseryOther === null && r.town.miseryEarly === null && r.town.holder === null, '氣氛太差也一樣；自己過得很慘、七天沒人關心的是本人；鎮長不會走', r.town);
  ok(gt(r.town.sc.goMis, r.town.sc.goFood) && gt(r.town.sc.goFood, r.town.sc.goGloom), '沒人在乎最讓人想走，其次是沒飯吃，再來是氣氛差', r.town.sc);
  ok(r.town.done.res && r.town.done.gone && r.town.done.day && r.town.done.next === null, '決定走：搬離這個鎮；三天內已經有人為這種事走了，其他人先不走', r.town.done);
  ok(r.daily.issue && r.daily.sev >= 3 && r.daily.idle >= 5 && r.daily.same, '真的缺糧拖了八天：沒有人被擲骰送走', r.daily);
  // AI
  ok(r.ai.id === 'move' && r.ai.ai === 1 && r.ai.why === 'W-PAY' && r.ai.at && r.ai.plan === 'N-NEXT' && r.ai.feed && r.ai.menu && r.ai.money, 'AI 版：工人由 AI 決定跳槽並說理由（就算他跟老闆交情很好）', r.ai);
  if (!zh) ok(!r.ai.cjk, '英文版給 AI 的資料沒有中文', r.ai.bits);
  if (!zh) ok(r.txt.length === 0, '英文版：選擇點的標題、事實、選項都有翻譯', r.txt.slice(0, 6));
  ok(Object.keys(r.facts).length === 9 && Object.values(r.facts).every(v => typeof v === 'number' && v > 20), '每個選擇點都講得出這個人遇到的事', r.facts);
  ok(r.save.hop && r.save.last, '存讀檔：這一週誰換過去、店上週賺多少都留著', r.save);
  ok(!r.days.err && r.days.q === 0, '連跑八天沒有錯誤，沒有卡住的事', r.days);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
// v9.23.0 電腦版側欄的資訊卡比手機窄：大數字後面跟著容量（26,212/400）也要完整顯示，不能被截成「26.2…」
async function kpi(browser) {
  console.log('— 資訊卡大數字（電腦版側欄、手機）');
  for (const [W, H, mob] of [[1280, 800, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const out = {};
      const show = async (food) => { w.stockpile.resources.food = food; w.stockpile.resources.silver = 1937; app.state = w.getState(); app._openKairoTab('economy'); await new Promise(r => setTimeout(r, 350));
        const card = document.getElementById('ic-keyres'); if (card && !card.classList.contains('open')) { card.querySelector('.ic-hd').click(); await new Promise(r => setTimeout(r, 250)); }
        const bs = [...card.querySelectorAll('.ic-kpi b')]; const all = [...document.querySelectorAll('.ic-card .ic-kpi b')].filter(b => b.clientWidth > 0);
        return { txt: bs.map(b => b.textContent), cut: bs.filter(b => b.scrollWidth > b.clientWidth + 1).length, allCut: all.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent), wide: card.scrollWidth > card.clientWidth + 1 }; };
      out.a = await show(26212); out.b = await show(1299890); out.c = await show(300); return out; });
    ok(r.a.txt[0] === '26,212/400' && r.a.cut === 0 && r.a.allCut.length === 0 && !r.a.wide, `${W}px：食物 26,212、容量 400 完整顯示，沒有被截掉`, r.a);
    ok(r.b.cut === 0 && !r.b.wide && /^(1,299,890|1\.3M)\/400$/.test(r.b.txt[0]), `${W}px：數字大到放不下才改縮寫（1.3M/400），一樣不被截掉`, r.b);
    ok(r.c.txt[0] === '300/400' && r.c.cut === 0 && !r.c.wide, `${W}px：小數字照舊`, r.c);
    ok(errs.length === 0, `${W}px：沒有頁面錯誤`, errs.slice(0, 3));
    await ctx.close();
  }
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  await kpi(browser);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
