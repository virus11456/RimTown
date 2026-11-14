// v9.21.0 決策核心階段 3（政治）
// 帶頭組工會、加入、退出、跟不跟罷工、老闆答不答應加薪、捐不捐政治獻金、收不收、要不要出來選、立場隨處境改變：改由本人決定，不再擲骰。
// 驗：九個選擇點都登記了、每日流程不再擲骰、每個選項的結算、個性與處境不同分數不同、
//     連鎖（工會來談 → 老闆回答 → 罷工 → 會員跟不跟；金主開口 → 政治人物收不收）、說要選的人真的成為候選人、AI 版、銀幣守恆、存讀檔、中英文
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
    const E = w.election; const holder = E._officeHolder(w);
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const pool = all.filter(a => a !== holder && !String(a.agentId).startsWith('imm_'));
    const boss = pool[0], workers = pool.slice(1, 9), [W1, W2, W3, W4, W5] = workers; const R = pool[9], Z = pool[10], Y = pool[11], Q = pool[12];
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; MARKET.S(w); const M = w.market; const U = UNION.S(w); const P = POWER.S(w); TIERS.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships.relationships[b.agentId]?.affinity || 0;
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const d0 = () => w._absDay();
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const mems = (a, n = 6) => (a.memory?.entries || []).slice(-n).map(e => e.content).join('|');
    const TEST = [boss, holder, ...pool.slice(1, 13)];
    const clean = () => {
      Object.assign(U, { on: false, name: '', leader: null, members: {}, fund: 0, talks: {}, strike: {}, firedUntil: {}, sour: {}, ask: {}, won: 0, lost: 0, bribed: 0, fired: 0, raises: 0, strikes: 0, history: [] });
      P.inf = {}; P.camp = {}; P.scandal = {}; P.secretDay = {}; X.cool = {}; X.q = []; X.run = {}; if (w.dark) w.dark.secrets = [];
      for (const a of all) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; }
      for (const a of TEST) { traits(a, ['hardworking']); a.personality.values = []; a.mood = 50; a._mourningTargets = []; for (const b of TEST) if (a !== b) rel(a, b, 0); }
      boss.job = new Job('trader'); for (const a of workers) a.job = new Job('farmer'); for (const o of all) if (!workers.includes(o) && o.job?.key === 'farmer') o.job = new Job('guard');
      for (const o of [R, Z, Y, Q]) if (!o.job || o.job.key === 'unemployed') o.job = new Job('guard');
      M.owners = M.owners || {}; for (const k of Object.keys(MARKET.SECTORS)) M.owners[k] = null; M.owners.farm = boss.agentId; M.pay.farm = 0.6; M.hist = M.hist || {}; M.hist.farm = [[500, 10]]; M.hungry = {};
      w.tierState.lv = 2; if (w.infl) { w.infl.p = 1; w.infl.wage = 1; }
      E.active = false; E.phase = 'none'; E.candidates = [];
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const steady = (a, key) => fix(0.5, () => DECIDE.ruleOnce(w, a, key, true));
    const drain = () => fix(0.5, () => DECIDE.drain(w, X, d0()));
    const union = (lead, members) => { U.on = true; U.name = 'TESTU'; U.leader = lead.agentId; U.members = {}; for (const a of members) U.members[a.agentId] = d0(); };
    const NEW = ['organize', 'union', 'unionout', 'strike', 'demand', 'donate', 'gift', 'run', 'rethink'];

    // ---------- 1) 登記、每日流程不再擲骰 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), pol: DECIDE.pol === true, on: DECIDE.on(w), queued: ['strike', 'demand', 'gift'].every(k => K[k].scan === false) && ['organize', 'union', 'unionout', 'donate', 'run', 'rethink'].every(k => K[k].scan !== false) };
    clean(); { // 骰子給到「一定會組工會、一定會捐錢」的值:每日流程也不會替人決定
      const od = w._absDay; const g0 = P.stats.gifts; Bal[R.agentId] = 900;
      w._absDay = () => 703; U.lastDay = -1; fix(0.001, () => UNION.daily(w)); const noFound = !U.on;
      w._absDay = () => 705; P.lastDay = -1; fix(0.001, () => POWER.daily(w)); const noGift = P.stats.gifts === g0;
      w._absDay = od; U.lastDay = -1; P.lastDay = -1;
      out.noDice = { noFound, noGift, src: !/found\(/.test(String(UNION.daily)) && typeof UNION.found === 'undefined' && typeof POWER.donations === 'undefined' }; }

    // ---------- 2) 帶頭組工會 ----------
    clean(); { traits(W1, ['charismatic']); traits(W2, ['shy']);
      out.org = { can: UNION.canOrganize(w, W1), ids: ids(W1, 'organize'), lead: sc(W1, 'organize', 'lead'), wait: sc(W1, 'organize', 'wait'), shyLead: sc(W2, 'organize', 'lead') ?? -9, plainLead: sc(workers.find(x => x !== W1 && x !== W2 && UNION.canOrganize(w, x)), 'organize', 'lead'), fact: K.organize.facts(w, W1, K.organize.when(w, W1)) };
      w.tierState.lv = 1; out.org.village = UNION.canOrganize(w, W1); w.tierState.lv = 2; M.pay.farm = 1; out.org.paid = UNION.canOrganize(w, W1); M.pay.farm = 0.6;
      const e = steady(W1, 'organize'); out.org.done = { id: e?.id, on: U.on, leader: U.leader === W1.agentId, n: Object.keys(U.members).length, log: /✊/.test(logs(6)), mem: mems(W1), again: K.organize.when(w, W3) }; }

    // ---------- 3) 加入、退出 ----------
    clean(); { union(W1, [W1]); rel(W2, W1, 50); rel(W3, boss, 80); traits(W3, ['greedy']);
      out.join = { ids: ids(W2, 'union'), friend: sc(W2, 'union', 'join'), friendNo: sc(W2, 'union', 'no'), bossPal: sc(W3, 'union', 'join'), bossPalNo: sc(W3, 'union', 'no'), member: K.union.when(w, W1), fact: K.union.facts(w, W2, K.union.when(w, W2)) };
      M.pay.farm = 1; out.join.paidJoin = sc(W4, 'union', 'join'); M.pay.farm = 0.6; out.join.squeezedJoin = sc(W4, 'union', 'join');
      const e = steady(W2, 'union'); const e3 = steady(W3, 'union'); out.join.done = { id: e?.id, in: !!U.members[W2.agentId], up: aff(W2, W1) > 50, pal: e3?.id, palIn: !!U.members[W3.agentId], palLogged: !!lastLog(W3) }; }
    clean(); { union(W1, [W1, W2, W3, W4]); out.quit = { squeezed: K.unionout.when(w, W2), leader: K.unionout.when(w, W1) };
      M.pay.farm = 1; W2.mood = 70; W3.mood = 70; traits(W3, ['greedy']); Bal[W3.agentId] = 3; out.quit.fine = K.unionout.when(w, W2); out.quit.fineQuit = sc(W2, 'unionout', 'quit'); out.quit.fineStay = sc(W2, 'unionout', 'stay'); out.quit.greedyQuit = sc(W3, 'unionout', 'quit');
      U.sour[W4.agentId] = d0(); W4.mood = 40; out.quit.lost = K.unionout.when(w, W4); out.quit.lostQuit = sc(W4, 'unionout', 'quit');
      const op = opt(W4, 'unionout', 'quit'); const res = op.run(w, W4); out.quit.done = { out: !U.members[W4.agentId], sour: U.sour[W4.agentId] === undefined, mem: mems(W4, 2), res: !!res };
      opt(W2, 'unionout', 'stay').run(w, W2); out.quit.stay = !!U.members[W2.agentId]; }

    // ---------- 4) 工會來談 → 老闆自己回答 ----------
    const talk = () => { U.talks = {}; U.ask = {}; X.q = []; fix(0.5, () => UNION.bargain(w, all, d0())); };
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 5000; Bal[W1.agentId] = 100; const p0 = M.pay.farm; talk();
      out.ask = { asked: U.ask.farm != null, q: X.q.filter(q => q.kind === 'demand' && q.a === boss.agentId).length, same: M.pay.farm === p0, log: /📣/.test(logs(4)), ids: ids(boss, 'demand', { k: 'farm' }), fact: K.demand.facts(w, boss, { k: 'farm' }) };
      const C = { k: 'farm' }; out.ask.plain = { yes: sc(boss, 'demand', 'yes', C), no: sc(boss, 'demand', 'no', C), fire: sc(boss, 'demand', 'fire', C), bribe: sc(boss, 'demand', 'bribe', C) };
      traits(boss, ['kind']); out.ask.kind = { yes: sc(boss, 'demand', 'yes', C), no: sc(boss, 'demand', 'no', C), fire: sc(boss, 'demand', 'fire', C) };
      traits(boss, ['greedy']); out.ask.greedy = { yes: sc(boss, 'demand', 'yes', C), no: sc(boss, 'demand', 'no', C) };
      traits(boss, ['abrasive']); out.ask.rough = { fire: sc(boss, 'demand', 'fire', C) };
      traits(boss, ['hardworking']); M.hist.farm = [[10, 400]]; out.ask.loss = { yes: sc(boss, 'demand', 'yes', C), no: sc(boss, 'demand', 'no', C) }; M.hist.farm = [[500, 10]];
      Bal[boss.agentId] = 40; out.ask.poorIds = ids(boss, 'demand', C); Bal[boss.agentId] = 5000;
      // 心腸軟的老闆:照個性決定 → 答應
      traits(boss, ['kind']); const won0 = U.won; drain(); const e = lastLog(boss); out.deal = { id: e?.id, kind: e?.kind, pay: M.pay.farm, won: U.won - won0, cleared: U.ask.farm == null, log: /🤝/.test(logs(6)), q: X.q.length }; }
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 5000; Bal[W1.agentId] = 100; traits(boss, ['greedy']); talk(); // 吝嗇老闆不答應 → 罷工,會員各自決定跟不跟
      Bal[W5.agentId] = 2; rel(W5, boss, 70); traits(W5, ['greedy']); const cons = conserved(() => drain()); const e = lastLog(boss); const s = U.strike.farm;
      out.strike = { id: e?.id, on: !!s, n: s ? s.members.length : 0, leaderIn: !!s?.members.includes(W1.agentId), w2: lastLog(W2)?.id, w5: lastLog(W5)?.id, w5Out: s ? !s.members.includes(W5.agentId) : null, w5Member: !!U.members[W5.agentId], w5Idle: UNION.idle(w, W5), w2Idle: UNION.idle(w, W2), log: /🚶/.test(logs(12)), cons, q: X.q.length, leaderCold: aff(W1, W5) < 0 };
      out.strike.sc = { out: sc(W2, 'strike', 'out', { k: 'farm' }), work: sc(W2, 'strike', 'work', { k: 'farm' }) }; }
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 500; traits(W1, ['greedy']); Bal[W1.agentId] = 5; talk(); // 想拿錢擺平:看重錢的領袖收下
      const b0 = Bal[boss.agentId], l0 = Bal[W1.agentId]; let res = null; const cons = conserved(() => { res = opt(boss, 'demand', 'bribe', { k: 'farm' }).run(w, boss); });
      out.bribe = { took: Bal[W1.agentId] - l0, paid: b0 - Bal[boss.agentId], secret: (w.dark?.secrets || []).some(x => x.kind === 'union_bribe'), strike: !!U.strike.farm, cons, res: !!res, later: U.talks.farm > d0() + 20 }; }
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 500; Bal[W1.agentId] = 100; talk(); // 不貪又不缺錢的領袖把錢退回去 → 罷工
      const b0 = Bal[boss.agentId]; opt(boss, 'demand', 'bribe', { k: 'farm' }).run(w, boss); out.bribeNo = { paid: b0 - Bal[boss.agentId], strike: !!U.strike.farm, cold: aff(W1, boss) < 0, mem: mems(W1, 3) }; }
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 500; talk(); opt(boss, 'demand', 'fire', { k: 'farm' }).run(w, boss); out.fire = { fired: Object.keys(U.firedUntil).length, strike: !!U.strike.farm, log: /🚪/.test(logs(8)) }; }
    clean(); { union(W1, workers); U.fund = 0; Bal[boss.agentId] = 500; talk(); opt(boss, 'demand', 'no', { k: 'farm' }).run(w, boss); out.broke = { strike: !!U.strike.farm, log: /😠/.test(logs(6)) }; }
    clean(); { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 500; talk(); X.q = []; U.ask.farm = d0() - 3; U.lastDay = -1; fix(0.5, () => UNION.daily(w)); out.timeout = { cleared: U.ask.farm == null, strike: !!U.strike.farm }; // 老闆三天沒回話:當作不答應
      U.ask = {}; out.stale = (ids(boss, 'demand', { k: 'farm' }) || []).length; }

    // ---------- 5) 政治獻金 ----------
    clean(); { Bal[R.agentId] = 900; Bal[Z.agentId] = 20; const n = POWER.giftSize(w, R);
      out.don = { can: POWER.canDonate(w, R), poor: POWER.canDonate(w, Z), ctx: K.donate.when(w, R), holderCant: K.donate.when(w, holder), poorCant: K.donate.when(w, Z), ids: ids(R, 'donate'), skip: sc(R, 'donate', 'skip'), power: sc(R, 'donate', 'power'), n, fact: K.donate.facts(w, R, K.donate.when(w, R)) };
      traits(R, ['greedy']); out.don.greedy = sc(R, 'donate', 'power'); traits(R, ['hardworking']);
      w.tierState.lv = 0; out.don.village = K.donate.when(w, R); w.tierState.lv = 2;
      const r0 = Bal[R.agentId], h0 = Bal[holder.agentId]; const res = opt(R, 'donate', 'power').run(w, R);
      out.don.offer = { res: !!res, q: X.q.filter(q => q.kind === 'gift' && q.a === holder.agentId && q.ctx.dn === R.agentId && q.ctx.n === n).length, held: Bal[R.agentId] === r0 && Bal[holder.agentId] === h0 };
      const C = X.q.find(q => q.kind === 'gift').ctx; out.don.giftIds = ids(holder, 'gift', C); out.don.giftFact = K.gift.facts(w, holder, C);
      out.don.plain = { take: sc(holder, 'gift', 'take', C), back: sc(holder, 'gift', 'back', C) };
      traits(holder, ['kind']); out.don.kind = { take: sc(holder, 'gift', 'take', C), back: sc(holder, 'gift', 'back', C) };
      traits(holder, ['greedy']); out.don.greedyPol = { take: sc(holder, 'gift', 'take', C), back: sc(holder, 'gift', 'back', C) };
      const cons = conserved(() => drain()); const e = lastLog(holder);
      out.don.take = { id: e?.id, kind: e?.kind, moved: Math.round(Bal[holder.agentId] - h0), paid: Math.round(r0 - Bal[R.agentId]), inf: P.inf[holder.agentId]?.[R.agentId] || 0, owed: POWER.owed(w, holder), secret: (w.dark?.secrets || []).some(x => x.kind === 'donation'), warm: aff(holder, R) > 0, cons, q: X.q.length }; }
    clean(); { Bal[R.agentId] = 900; traits(holder, ['kind']); const f0 = P.stats.refused; opt(R, 'donate', 'power').run(w, R); const r0 = Bal[R.agentId]; drain(); const e = lastLog(holder);
      out.don.back = { id: e?.id, refused: P.stats.refused - f0, same: Bal[R.agentId] === r0, inf: P.inf[holder.agentId]?.[R.agentId] || 0, mem: mems(R, 3) }; }
    clean(); { Bal[R.agentId] = 900; E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: Z.agentId, name: Z.name, votes: 3 }, { agentId: Y.agentId, name: Y.name, votes: 9 }];
      const c = K.donate.when(w, R); traits(Y, ['greedy']); opt(R, 'donate', 'power', c).run(w, R); drain();
      out.don.camp = { camp: c?.camp, top: c?.t1 === Y.agentId, cand: K.donate.when(w, Y), raised: P.camp[Y.agentId] || 0 }; E.active = false; E.phase = 'none'; E.candidates = []; }

    // ---------- 6) 要不要出來選 ----------
    const clock = { s: w.clock.season, d: w.clock.day }; const amb = MIND.S(w).amb; const ambSave = JSON.parse(JSON.stringify(amb));
    const summer = () => { w.clock.season = '夏季'; w.clock.day = 13; };
    clean(); { for (const a of all) { delete amb[a.agentId]; if (!TEST.includes(a)) { traits(a, ['shy']); a.mood = 40; } }
      w.tierState.lv = 0; // 村莊：誰都可以選
      w.clock.season = '春季'; w.clock.day = 13; amb[Z.agentId] = { key: 'leader', since: 0 }; traits(Z, ['charismatic']); traits(Q, ['charismatic']); traits(Y, ['charismatic']);
      out.run = { spring: K.run.when(w, Z) }; summer(); out.run.early = (() => { w.clock.day = 9; const x = K.run.when(w, Z); w.clock.day = 13; return x; })();
      const cz = K.run.when(w, Z); out.run.ctx = cz; out.run.ids = ids(Z, 'run'); out.run.fact = K.run.facts(w, Z, cz);
      out.run.amb = { yes: sc(Z, 'run', 'yes'), no: sc(Z, 'run', 'no') }; out.run.plain = { yes: sc(Q, 'run', 'yes'), no: sc(Q, 'run', 'no') }; out.run.holder = { asked: !!K.run.when(w, holder), yes: sc(holder, 'run', 'yes'), noMute: opt(holder, 'run', 'no')?.mute };
      E.active = true; out.run.during = K.run.when(w, Z); E.active = false;
      const e = steady(Z, 'run'); out.run.said = { id: e?.id, will: DECIDE.runIntent(w)[Z.agentId], log: /📣/.test(logs(4)), mem: mems(Z, 2), again: K.run.when(w, Z) };
      opt(Y, 'run', 'yes').run(w, Y); const lg0 = (w.messageLog || []).length; opt(Q, 'run', 'no').run(w, Q); out.run.quiet = (w.messageLog || []).length === lg0 && DECIDE.runIntent(w)[Q.agentId] === -1;
      // 開選：說要選的兩個人就是候選人；說不選的 Q（本錢其實很高）不在裡面
      fix(0.99, () => E._startElection(w)); const c1 = E.candidates.map(c => c.agentId);
      out.run.start = { n: c1.length, z: c1.includes(Z.agentId), y: c1.includes(Y.agentId), q: c1.includes(Q.agentId) }; E.active = false; E.phase = 'none'; E.candidates = [];
      // 只有一個人說要選：他一定在，其餘照聲望補，說不選的還是不在
      X.run = {}; opt(Z, 'run', 'yes').run(w, Z); opt(Q, 'run', 'no').run(w, Q); fix(0.5, () => E._startElection(w)); const c2 = E.candidates.map(c => c.agentId);
      out.run.one = { n: c2.length, z: c2.includes(Z.agentId), q: c2.includes(Q.agentId) }; E.active = false; E.phase = 'none'; E.candidates = [];
      // 補選來不及問：不看意願
      fix(0.5, () => E._startElection(w, { byElection: true })); out.run.by = E.candidates.some(c => c.agentId === Q.agentId) || E.candidates.length >= 2; E.active = false; E.phase = 'none'; E.candidates = [];
      // 超過十天的不算
      X.run[Z.agentId].d = d0() - 11; out.run.expired = DECIDE.runIntent(w)[Z.agentId] === undefined;
      // 工會領袖不再擲 60%：他沒說要選，就不會被硬塞進候選人
      X.run = {}; union(W1, workers); traits(W1, ['shy']); W1.mood = 30; fix(0.01, () => E._startElection(w)); out.run.unionNoDice = !E.candidates.some(c => c.agentId === W1.agentId); E.active = false; E.phase = 'none'; E.candidates = [];
      w.clock.season = clock.s; w.clock.day = clock.d; for (const k of Object.keys(amb)) delete amb[k]; Object.assign(amb, ambSave); }

    // ---------- 7) 立場隨處境改變 ----------
    clean(); { const op0 = MIND.S(w).op; const setOp = (a, o) => { op0[a.agentId] = Object.assign({ tax: 0, king: 0, faith: 0, tech: 0, out: 0 }, o); };
      for (const a of [R, Z, Y, Q]) { setOp(a, {}); Bal[a.agentId] = 60; }
      out.re = { none: K.rethink.when(w, R) };
      Bal[Z.agentId] = 3; out.re.poor = DECIDE.polPushes(w, Z).map(p => p.k + (p.dir > 0 ? '+' : '-'));
      M.hungry[Y.agentId] = 3; Bal[Y.agentId] = 3; out.re.hungry = DECIDE.polPushes(w, Y).map(p => p.k + (p.dir > 0 ? '+' : '-'));
      Q._mourningTargets = [{ name: 'x', deathTick: 1, isFamily: true }]; out.re.grief = DECIDE.polPushes(w, Q).map(p => p.k + (p.dir > 0 ? '+' : '-'));
      R.job = null; out.re.jobless = DECIDE.polPushes(w, R).map(p => p.k + (p.dir > 0 ? '+' : '-')); R.job = new Job('guard');
      out.re.ids = ids(Z, 'rethink'); out.re.fact = K.rethink.facts(w, Z, K.rethink.when(w, Z)); out.re.sc = { keep: sc(Z, 'rethink', 'keep'), shift: sc(Z, 'rethink', 'tax-') };
      const t0 = MIND.opOf(w, Z).tax; const op = opt(Z, 'rethink', 'tax-'); out.re.text = DECIDE.view ? (typeof op.text === 'object' ? op.text.k : op.text) : ''; op.run(w, Z); out.re.shift = { d: Math.round((MIND.opOf(w, Z).tax - t0) * 100) / 100, mem: mems(Z, 2) };
      setOp(Z, { tax: -1.3 }); out.re.capped = DECIDE.polPushes(w, Z).some(p => p.k === 'tax'); // 已經很反感了：不會再往同一邊推
      setOp(Z, { tax: 0 }); for (const r2 of Object.values(Z.relationships.relationships)) r2.affinity = 0; const t1 = MIND.opOf(w, Z).tax; MIND.drift(w, MIND.S(w)); out.re.noAuto = MIND.opOf(w, Z).tax === t1; // 窮人不再天天自動多討厭一點稅
      const e = steady(Y, 'rethink'); out.re.ruled = { id: e?.id || null, tax: MIND.opOf(w, Y).tax }; }

    // ---------- 8) AI 版：理由、連鎖 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keep) => { const s = new Set(keep.map(a => a.agentId)); for (const a of all) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    clean(); w.fullAgentMode = true; { union(W1, workers); U.fund = 500; Bal[boss.agentId] = 5000; Bal[W1.agentId] = 100; U.talks = {}; fix(0.5, () => UNION.bargain(w, all, d0())); only(boss); others(boss, ['demand']); prompts = [];
      reply = (p) => /來談|come to negotiate/.test(p) ? [{ n: 1, pick: 'a', why: 'W-DEAL', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(boss); const pD = prompts.find(p => /來談|come to negotiate/.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, pay: M.pay.farm, plan: DECIDE.view(w, boss).plan, feed: /🧭/.test(logs(8)), menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    clean(); w.fullAgentMode = true; { Bal[R.agentId] = 900; only(R, holder); others(R, ['donate']); others(holder, ['gift']); prompts = []; const h0 = Bal[holder.agentId];
      reply = (p) => /私下拿了|privately brought/.test(p) ? [{ n: 1, pick: 'b', why: 'W-BACK' }] : /捐了錢|your voice carries/.test(p) ? [{ n: 1, pick: 'b', why: 'W-GIVE' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const er = lastLog(R), eh = lastLog(holder); const pG = prompts.find(p => /私下拿了|privately brought/.test(p)) || '';
      out.ai2 = { r: er && { id: er.id, ai: er.ai, why: er.why?.raw }, h: eh && { kind: eh.kind, id: eh.id, ai: eh.ai, why: eh.why?.raw }, same: Bal[holder.agentId] === h0, chained: !!pG, n: prompts.length, cjk: /[一-鿿]/.test(prompts.join('\n')), bits: (prompts.join('\n').match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 9) 存讀檔、跑幾天 ----------
    clean(); { union(W1, workers); U.sour[W2.agentId] = d0(); U.ask.farm = d0(); X.run[Z.agentId] = { d: d0(), y: 1 };
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { run: w2.decide?.run?.[Z.agentId]?.y === 1, sour: w2.union?.sour?.[W2.agentId] != null, ask: w2.union?.ask?.farm != null }; }
    clean(); { let err = null; const t0 = T(), p0 = P0(); try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, pick: Object.keys(X.pick).filter(k => new RegExp('^(' + NEW.join('|') + ')\\.').test(k)), union: U.on, members: Object.keys(U.members).length, q: X.q.length }; }
    // 每個選擇點的標題、事實、選項文字在英文版都有翻譯
    out.txt = (() => { const bad = []; const cjk = (s) => /[一-鿿]/.test(String(s || '')); const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; if (!en) return bad;
      const say = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : (() => { let s = t(x.k); for (const [a, b] of Object.entries(x.p || {})) s = s.split('{' + a + '}').join(typeof b === 'object' ? say(b) : (typeof b === 'string' ? t(b) : b)); return s; })()) : (typeof x === 'string' ? t(x) : '');
      for (const k of NEW) if (cjk(t(K[k].title))) bad.push('title:' + k);
      for (const [name, s] of Object.entries({ org: out.org?.fact, join: out.join?.fact, ask: out.ask?.fact, don: out.don?.fact, gift: out.don?.giftFact, run: out.run?.fact, re: out.re?.fact })) if (cjk(I18N.localizeNames(String(s || ''), true))) bad.push('fact:' + name + ':' + s);
      return bad; })();
    return out;
  });
  const gt = (a, b) => typeof a === 'number' && typeof b === 'number' && a > b;
  ok(r.kinds.all && r.kinds.pol && r.kinds.on && r.kinds.queued, '九個政治選擇點都登記了；「工會宣布罷工」「工會來談加薪」「有人送政治獻金來」只在別人找上門時出現', r.kinds);
  ok(r.noDice.noFound && r.noDice.noGift && r.noDice.src, '每日流程不再擲骰：骰子給到一定會組工會、一定會捐錢的值，也不會替人決定', r.noDice);
  // 組工會
  ok(r.org.can >= 4 && r.org.ids.join() === 'wait,lead', '工資被壓、四個人以上不滿：最適合帶頭的幾個人會遇到「要不要帶頭」', r.org);
  ok(r.org.village === 0 && r.org.paid === 0, '村莊、城鎮組不起工會；工資照常發的時候沒有這件事', { village: r.org.village, paid: r.org.paid });
  ok(gt(r.org.lead, r.org.wait) && gt(r.org.lead, r.org.plainLead) && gt(r.org.plainLead, r.org.shyLead), '有號召力的人願意出頭，害羞的人不願意（分數不同）', r.org);
  ok(r.org.done.id === 'lead' && r.org.done.on && r.org.done.leader && r.org.done.n === 1 && r.org.done.log && !r.org.done.again, '帶頭的人成立工會，自己是領袖；其他人之後各自決定要不要加入', r.org.done);
  // 加入、退出
  ok(r.join.ids.join() === 'no,join' && r.join.member === null, '沒加入的工人會遇到「要不要加入」，已經是會員的不會', r.join);
  ok(gt(r.join.friend, r.join.friendNo) && gt(r.join.bossPalNo, r.join.bossPal) && gt(r.join.squeezedJoin, r.join.paidJoin), '跟領袖有交情的想加入、跟老闆交情好的不想；工資被壓的比工資照發的想加入', r.join);
  ok(r.join.done.id === 'join' && r.join.done.in && r.join.done.up && r.join.done.pal === 'no' && !r.join.done.palIn && !r.join.done.palLogged, '加入的人成了會員；不加入的人不寫進決定紀錄（不洗版）', r.join.done);
  ok(r.quit.squeezed === null && r.quit.leader === null && r.quit.fine?.why === 'fine' && r.quit.lost?.why === 'lost', '工資還被壓著的會員、領袖本人不會想退；日子過得去或罷工輸了才會想', r.quit);
  ok(gt(r.quit.fineStay, r.quit.fineQuit) && gt(r.quit.greedyQuit, r.quit.fineQuit) && gt(r.quit.lostQuit, r.quit.fineQuit), '多數人留著；貪心又缺錢的、剛輸了罷工的比較想退', r.quit);
  ok(r.quit.done.out && r.quit.done.sour && r.quit.done.res && r.quit.stay, '退出的人不再是會員；留下的人還在', r.quit.done);
  // 老闆回答
  ok(r.ask.asked && r.ask.q === 1 && r.ask.same && r.ask.log && r.ask.ids.join() === 'yes,no,bribe,fire', '工會來談：先不擲骰，交給老闆（答應／不答應／塞錢／開除帶頭的）；工資先不動', r.ask);
  ok(gt(r.ask.kind.yes, r.ask.kind.no) && gt(r.ask.greedy.no, r.ask.greedy.yes) && gt(r.ask.plain.yes, r.ask.loss.yes) && gt(r.ask.loss.no, r.ask.loss.yes), '心腸軟的老闆偏向答應、吝嗇的不答應；店在虧錢時更不肯', r.ask);
  ok(gt(r.ask.rough.fire, r.ask.plain.fire) && gt(r.ask.plain.fire, r.ask.kind.fire) && gt(r.ask.plain.no, r.ask.plain.fire), '脾氣差的老闆才會想開除帶頭的人；一般老闆不會', r.ask);
  ok(!r.ask.poorIds.includes('bribe'), '手上不到 60 銀幣的老闆沒有「塞錢」這個選項', r.ask.poorIds);
  ok(r.deal.id === 'yes' && r.deal.kind === 'demand' && r.deal.pay === 0.7 && r.deal.won === 1 && r.deal.cleared && r.deal.log, '老闆答應：工資調高、工會記一次成功', r.deal);
  ok(r.strike.id === 'no' && r.strike.on && r.strike.leaderIn && r.strike.cons, '老闆不答應、工會的錢夠：發動罷工（銀幣守恆）', r.strike);
  ok(r.strike.w2 === 'out' && r.strike.w2Idle && r.strike.w5 === 'work' && r.strike.w5Out && !r.strike.w5Member && !r.strike.w5Idle && r.strike.log && r.strike.leaderCold && r.strike.q === 0, '會員各自決定：一般會員跟著罷工；缺錢、看重錢又跟老闆交情好的照常上工、退出工會、被記恨', r.strike);
  ok(gt(r.strike.sc.out, r.strike.sc.work), '一般會員跟著罷工的分數高得多', r.strike.sc);
  ok(r.bribe.took === 30 && r.bribe.paid === 30 && r.bribe.secret && !r.bribe.strike && r.bribe.cons && r.bribe.later, '塞錢：看重錢的領袖收下 30 銀幣（老闆 −30、領袖 +30），真相頁多一個秘密，一個月不再談', r.bribe);
  ok(r.bribeNo.paid === 0 && r.bribeNo.strike && r.bribeNo.cold, '塞錢：不貪又不缺錢的領袖把錢退回去，照樣罷工，對老闆更反感', r.bribeNo);
  ok(r.fire.fired === 1 && r.fire.strike && r.fire.log, '開除帶頭的人：那個人兩週沒工作，工會發動罷工', r.fire);
  ok(!r.broke.strike && r.broke.log, '老闆不答應、工會的錢不夠：罷工不成', r.broke);
  ok(r.timeout.cleared && r.timeout.strike && r.stale === 0, '老闆三天沒回話當作不答應；已經處理掉的要求不會再問一次', { timeout: r.timeout, stale: r.stale });
  // 政治獻金
  ok(r.don.can && !r.don.poor && r.don.ctx && r.don.holderCant === null && r.don.poorCant === null && r.don.village === null, '有錢人才會遇到「要不要捐」；政治人物自己、手頭不寬的人、村莊都沒有這件事', r.don);
  ok(r.don.ids[0] === 'skip' && r.don.ids.includes('power') && gt(r.don.greedy, r.don.power), '可以不捐，也可以捐給掌權的人；貪心的人更想花錢買影響力', r.don);
  ok(r.don.offer.res && r.don.offer.q === 1 && r.don.offer.held, '決定捐：先問對方收不收，錢還沒動', r.don.offer);
  ok(r.don.giftIds.join() === 'take,back' && gt(r.don.plain.take, r.don.plain.back) && gt(r.don.kind.back, r.don.kind.take) && gt(r.don.greedyPol.take, r.don.plain.take), '政治人物自己決定：一般人多半收下，心腸軟不貪的偏向退回，貪心的一定收', r.don);
  ok(r.don.take.id === 'take' && r.don.take.kind === 'gift' && r.don.take.moved === r.don.n && r.don.take.paid === r.don.n && r.don.take.inf === r.don.n && r.don.take.secret && r.don.take.warm && r.don.take.cons && r.don.take.q === 0, '收下：錢真的過手、記成人情、真相頁多一筆私下的錢（銀幣守恆）', r.don.take);
  ok(r.don.back.id === 'back' && r.don.back.refused === 1 && r.don.back.same && r.don.back.inf === 0, '退回：金主的錢一塊沒少，沒有人情', r.don.back);
  ok(r.don.camp.camp === 1 && r.don.camp.top && r.don.camp.cand === null && r.don.camp.raised > 0, '選舉期間押聲勢最好的候選人，記成競選經費；候選人自己不會遇到「要不要捐」', r.don.camp);
  // 參選
  ok(r.run.spring === null && r.run.early === null && r.run.during === null && r.run.ctx && r.run.ids.join() === 'no,yes', '只有選前幾天、還沒開選時才會問「要不要出來選」', r.run);
  ok(gt(r.run.amb.yes, r.run.amb.no) && gt(r.run.amb.yes, r.run.plain.yes) && r.run.holder.asked && r.run.holder.noMute === false, '一直想當首長的人想選；現任一定會被問到，他說不選是件大事（會記下來）', r.run);
  ok(r.run.said.id === 'yes' && r.run.said.will === 1 && r.run.said.log && r.run.said.again === null && r.run.quiet, '說要選的人公開表態；說不選的人不洗版', r.run.said);
  ok(r.run.start.n === 2 && r.run.start.z && r.run.start.y && !r.run.start.q, '開選：說要選的兩個人就是候選人，說不選的人不在（就算他本錢最高）', r.run.start);
  ok(r.run.one.z && !r.run.one.q && r.run.one.n >= 2, '只有一個人說要選：他一定在，其餘照聲望補，說不選的還是不在', r.run.one);
  ok(r.run.by && r.run.expired && r.run.unionNoDice, '補選照舊；十天前的表態不算；工會領袖不再擲骰被推出來', { by: r.run.by, expired: r.run.expired, union: r.run.unionNoDice });
  // 立場
  ok(r.re.none === null && r.re.poor.includes('tax-') && r.re.hungry.includes('tax+') && r.re.grief.includes('faith+') && r.re.jobless.includes('out-'), '處境會推著想法走：手頭緊的討厭稅、吃不飽的希望公庫有錢、喪親的靠向信仰、沒工作的排外；日子平順的人沒有這件事', r.re);
  ok(r.re.ids[0] === 'keep' && r.re.ids.includes('tax-') && r.re.shift.d === -0.6, '可以想法沒變，也可以對稅更反感（立場 −0.6）', r.re);
  ok(!r.re.capped && r.re.noAuto, '已經很反感的不會再被往同一邊推；窮人的立場不再每天自動變', { capped: r.re.capped, noAuto: r.re.noAuto });
  // AI
  ok(r.ai.id === 'yes' && r.ai.ai === 1 && r.ai.why === 'W-DEAL' && r.ai.pay === 0.7 && r.ai.plan === 'N-NEXT' && r.ai.feed && r.ai.menu && r.ai.money, 'AI 版：老闆由 AI 決定答應加薪並說理由，工資真的調高', r.ai);
  ok(r.ai2.r?.id === 'power' && r.ai2.r?.ai === 1 && r.ai2.r?.why === 'W-GIVE' && r.ai2.h?.kind === 'gift' && r.ai2.h?.id === 'back' && r.ai2.h?.ai === 1 && r.ai2.h?.why === 'W-BACK' && r.ai2.same && r.ai2.chained, 'AI 版：金主由 AI 決定捐，接著政治人物也由 AI 決定退回', r.ai2);
  if (!zh) ok(!r.ai.cjk && !r.ai2.cjk, '英文版給 AI 的資料沒有中文', { a: r.ai.bits, b: r.ai2.bits });
  if (!zh) ok(r.txt.length === 0, '英文版：選擇點的標題與事實都有翻譯', r.txt.slice(0, 6));
  ok(r.save.run && r.save.sour && r.save.ask, '存讀檔：誰說要選、誰剛輸了罷工、還在等老闆回話的要求都留著', r.save);
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
