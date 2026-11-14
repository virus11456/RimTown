// v9.27.0 決策核心批次 E（信仰與群眾行動）
// 祈禱、勸朋友改宗與改不改信、對鎮上新東西做點什麼（去用／推薦／抱怨／勸人／號召抗議）、跟不跟抗議與到場聲援、
// 拿錢拉被害慘的朋友一把、純人派帶隊搜捕、起意政變與加入政變、提案被否決後嘴硬與朋友給台階：改由本人決定，不再擲骰。
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
    const pool = adults0.filter(a => a !== holder && !String(a.agentId).startsWith('imm_'));
    const [A, B, C, D, E2, F, G, H] = pool; // A 主角、B 對手／仇人／東家、C 聽到壞話的人、G 記者
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const Dk = DARK.S(w); const El = w.election; const Rp = PRESS.S(w); const Fa = FAITH.S(w); const Mk = MARKET.S(w); const Wx = WAYS.S(w); const Cal = CALAMITY.S(w); const Th = THINGS.S(w); const Cr = CROWN.S(w); const Ms = MYTHSOC.S(w); const My = MYTH.S(w); const Cl = CLASS.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships.relationships?.[b.agentId]?.affinity || 0;
    const traits = (a, ts, vs) => { a.personality.traits = ts.slice(); a.personality.values = (vs || []).slice(); if (a.dark) a.dark.liar = false; };
    const _ad = w._absDay.bind(w); let DAY = null; w._absDay = () => (DAY == null ? _ad() : DAY); const d0 = () => w._absDay();
    const _pa = w.proposals._abs.bind(w.proposals); w.proposals._abs = (ww) => (DAY == null ? _pa(ww) : DAY);
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const TEST = [A, B, C, D, E2, F, G, H]; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const NEW = ['pray', 'preach', 'convert', 'thing', 'rally', 'rescue', 'hunt', 'plot', 'joinplot', 'rejected', 'step'];
    const tier0 = w.tierState.lv; const owners0 = { ...Mk.owners }; const jobs0 = {}; for (const a of all()) jobs0[a.agentId] = a.job?.key;
    for (const a of all()) if (a.job?.key === 'priest') a.job = new Job('farmer'); // 神職只留測試指定的那一位
    const sec = (who, re) => (Dk.secrets || []).filter(s => s.culprit === who.agentId && re.test(String(s.k))).length;
    const things0 = Object.keys(Th.list); const myth0 = JSON.parse(JSON.stringify(My.g || {}));
    const clean = () => {
      X.cool = {}; X.q = []; DAY = null; w.tierState.lv = tier0;
      for (const a of all()) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 50; a.moodModifier = 0; a.health = 100; a.thoughts = (a.thoughts || []).filter(x => (x.kind || x.type || x) !== 'hungry'); }
      for (const a of TEST) { traits(a, ['hardworking']); a.age = 30; for (const b of all()) if (a !== b) { rel(a, b, 0); rel(b, a, 0); } a.job = new Job('guard'); delete Cl.titles[a.agentId]; }
      Dk.secrets = []; Dk.wrongs = [];
      Fa.prayers = {}; for (const a of all()) Fa.of[a.agentId] = { rel: null, piety: 0 };
      for (const id of Object.keys(Th.list)) if (!things0.includes(id)) { delete Th.list[id]; delete Th.att[id]; delete Th.why[id]; } Th.victims = {}; Th.intent = {}; Th.silent = {}; Th.lastProtest = -99; Th.quit = {}; for (const T of Object.values(Th.list)) T.gone = true;
      Object.assign(Cr, { king: null, republic: false, plot: null, legit: 50, regent: null });
      Ms.hunts = []; Ms.grp = {}; My.g = JSON.parse(JSON.stringify(myth0));
      Wx.lastCasual = -99; Wx.face = {};
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const go = (a, key, id, ctx) => { const o = opt(a, key, id, ctx); return o ? o.run(w, a, ctx) : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const texts = {}; const keep = (name, key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };

    const R = Fa.rels[0]; const logs = (n = 40) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const thDay = (v) => { Th.lastDay = null; return v == null ? THINGS.daily(w) : fix(v, () => THINGS.daily(w)); };
    const thing = (owner) => { const T = THINGS.register(w, { kind: 'building', key: 'tb' + Math.floor(Math.random() * 1e6), name: ['測試館', 'Test Hall'], icon: '🏗️', facts: '測試用的新建築。', tags: { fun: 1 }, ttl: 45, owner: owner ? owner.agentId : null }); return T; };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), crowd: DECIDE.crowd === true, on: DECIDE.on(w) };

    // ---------- 2) 日子難過：祈禱 ----------
    clean(); { Fa.of[A.agentId] = { rel: R.id, piety: 60 }; A.mood = 20; const c1 = K.pray.when(w, A); keep('pray', 'pray', A);
      Fa.of[B.agentId] = { rel: R.id, piety: 60 }; Fa.of[C.agentId] = { rel: R.id, piety: 30 }; C.mood = 20;
      out.pray = { why: c1?.why, ids: ids(A, 'pray'), fine: K.pray.when(w, B), faint: K.pray.when(w, C) };
      const p60 = sc(A, 'pray', 'pray'); Fa.of[A.agentId].piety = 95; const p95 = sc(A, 'pray', 'pray'); Fa.of[A.agentId].piety = 60; out.pray.sc = { p60, p95, skip: sc(A, 'pray', 'skip') };
      Fa.lastDay = null; fix(0.01, () => FAITH.daily(w)); out.pray.untouched = !Fa.prayers[A.agentId]; Fa.of[A.agentId] = { rel: R.id, piety: 60 }; A.mood = 20;
      const res = go(A, 'pray', 'pray'); out.pray.run = { res: !!res, wish: !!Fa.prayers[A.agentId]?.wish, again: K.pray.when(w, A), log: /🙏/.test(logs()) };
    }

    // ---------- 3) 勸朋友信教、改不改信 ----------
    clean(); { Fa.of[A.agentId] = { rel: R.id, piety: 80 }; rel(A, B, 50); rel(B, A, 50); const c1 = K.preach.when(w, A); keep('preach', 'preach', A);
      Fa.of[C.agentId] = { rel: R.id, piety: 60 }; rel(C, B, 50);
      out.preach = { ctx: !!c1, ids: ids(A, 'preach'), mild: K.preach.when(w, C), zeal: FAITH.preachInfo(w, A)?.zeal };
      Fa.of[B.agentId] = { rel: R.id, piety: 40 }; out.preach.same = K.preach.when(w, A); Fa.of[B.agentId] = { rel: null, piety: 0 };
      const go0 = sc(A, 'preach', 'go:' + B.agentId); traits(A, ['shy']); const goShy = sc(A, 'preach', 'go:' + B.agentId); traits(A, ['hardworking']); out.preach.sc = { go0, goShy };
      Fa.lastDay = null; fix(0.01, () => FAITH.daily(w)); out.preach.untouched = !Fa.of[B.agentId].rel && X.q.length === 0; Fa.of[A.agentId] = { rel: R.id, piety: 80 }; Fa.of[B.agentId] = { rel: null, piety: 0 };
      const res = go(A, 'preach', 'go:' + B.agentId); const q = X.q.slice(); const cx = q[0]?.ctx; X.q = [];
      out.preach.run = { res: !!res, queued: q.length === 1 && q[0].kind === 'convert' && q[0].a === B.agentId, notYet: !Fa.of[B.agentId].rel };
      if (cx) { keep('convert', 'convert', B, cx); out.conv = { ids: ids(B, 'convert', cx), p: FAITH.convertInfo(w, B, cx)?.p };
        const yes0 = sc(B, 'convert', 'yes', cx); Fa.of[B.agentId] = { rel: 'RX', piety: 80 }; const yesDevout = sc(B, 'convert', 'yes', cx); keep('convertOld', 'convert', B, cx); Fa.of[B.agentId] = { rel: null, piety: 0 }; out.conv.sc = { yes0, yesDevout, no: sc(B, 'convert', 'no', cx) };
        go(B, 'convert', 'no', cx); const kept = !Fa.of[B.agentId].rel; const r2 = go(B, 'convert', 'yes', cx);
        out.conv.run = { kept, res: !!r2, rel: Fa.of[B.agentId].rel === R.id, piety: Fa.of[B.agentId].piety, after: ids(B, 'convert', cx) }; }
      // 接到流程：去勸 → 當下就問被勸的人
      Fa.of[B.agentId] = { rel: null, piety: 0 }; const p0 = (X.pick['convert.yes'] || 0) + (X.pick['convert.no'] || 0); fix(0.5, () => { go(A, 'preach', 'go:' + B.agentId); DECIDE.drain(w, X, d0()); }); out.preach.flow = (X.pick['convert.yes'] || 0) + (X.pick['convert.no'] || 0) - p0;
    }

    // ---------- 4) 鎮上有你看不慣的東西：勸自己人別去、帶頭號召抗議 ----------
    clean(); { let regs = [B.agentId]; THINGS.HOOKS.testhall = { regulars: () => regs }; const T = THINGS.register(w, { kind: 'testhall', key: 'th' + Math.floor(Math.random() * 1e6), name: ['測試館', 'Test Hall'], icon: '🏗️', facts: '測試用的新東西。', tags: { fun: 1 }, ttl: 45, owner: F.agentId }); const At = Th.att[T.id];
      const only3 = () => { for (const id of Object.keys(At)) if (id !== F.agentId) delete At[id]; }; /* 模擬會替其他村民形成看法，只留指定的人 */
      At[A.agentId] = 80; rel(A, B, 30); out.thing = { like: K.thing.when(w, A), owner: K.thing.when(w, F), none: K.thing.when(w, C) };
      // 日常閒聊（去用、推薦、抱怨）照舊由每天的流程處理
      const st0 = { ...Th.st }; DAY = _ad() + 1; thDay(0.01); out.thing.chat = Th.st.use - st0.use; only3();
      // 不喜歡、又有自己人常往那裡跑：可以去勸
      At[A.agentId] = -40; const c1 = K.thing.when(w, A); keep('thingPers', 'thing', A); out.thing.tid = c1?.tid === T.id; out.thing.persIds = ids(A, 'thing');
      At[A.agentId] = -15; out.thing.weak = K.thing.when(w, A); At[A.agentId] = -40;
      Th.silent[T.id + '|' + A.agentId] = d0(); out.thing.silent = K.thing.when(w, A); Th.silent = {};
      regs = []; out.thing.nothing = K.thing.when(w, A); regs = [B.agentId];
      const q0 = sc(A, 'thing', 'persuade'); traits(A, ['kind']); const qK = sc(A, 'thing', 'persuade'); traits(A, ['hardworking']); At[A.agentId] = -90; const q90 = sc(A, 'thing', 'persuade'); At[A.agentId] = -40;
      const pers0 = Th.st.pers || 0, ok0 = Th.st.persOk || 0; const r1 = go(A, 'thing', 'persuade'); out.thing.plan = { res: r1 === null, intent: Th.intent[T.id + '|' + A.agentId], again: K.thing.when(w, A) };
      DAY = _ad() + 2; thDay(0.01); out.thing.pers = { n: (Th.st.pers || 0) - pers0, ok: (Th.st.persOk || 0) - ok0, quit: THINGS.quitting(w, T.id, B), cleared: !Th.intent[T.id + '|' + A.agentId] }; only3(); Th.quit = {};
      // 夠討厭、鎮上也有夠多人討厭：多一個「號召抗議」
      At[A.agentId] = -80; At[C.agentId] = -60; At[D.agentId] = -50; keep('thingHate', 'thing', A); out.thing.hateIds = ids(A, 'thing'); regs = []; out.thing.noRegIds = ids(A, 'thing');
      const pr0 = sc(A, 'thing', 'protest'); traits(A, ['charismatic']); const prC = sc(A, 'thing', 'protest'); traits(A, ['shy']); const prS = sc(A, 'thing', 'protest'); traits(A, ['hardworking']); out.thing.sc = { q0, qK, q90, pr0, prC, prS };
      // 每天的流程不替他帶頭抗議
      const p0 = Th.st.prot; DAY = _ad() + 3; thDay(0.01); out.thing.untouched = !T.call && Th.st.prot === p0; only3(); At[A.agentId] = -80; At[C.agentId] = -60; At[D.agentId] = -50;
      // 號召抗議：貼告示 → 每個人自己決定跟不跟 → 隔天集合
      At[E2.agentId] = 70; At[G.agentId] = 60; At[H.agentId] = 55; rel(C, A, 40);
      go(A, 'thing', 'protest'); DAY = _ad() + 4; thDay(0.99); const q = X.q.slice(); X.q = [];
      const cC = q.find(x => x.a === C.agentId)?.ctx, cD = q.find(x => x.a === D.agentId)?.ctx, cE = q.find(x => x.a === E2.agentId)?.ctx, cG = q.find(x => x.a === G.agentId)?.ctx, cH = q.find(x => x.a === H.agentId)?.ctx;
      out.rally = { call: !!T.call && T.call.who.join() === A.agentId, notYet: Th.st.prot === p0, asked: q.filter(x => x.kind === 'rally').map(x => x.ctx.side).sort().join(), owner: q.some(x => x.a === F.agentId), noMore: ids(A, 'thing')?.includes('protest') || false };
      if (cC && cE) { keep('rallyCon', 'rally', C, cC); keep('rallyPro', 'rally', E2, cE); out.rally.ids = ids(C, 'rally', cC); out.rally.pC = THINGS.rallyInfo(w, C, cC)?.p; out.rally.pD = THINGS.rallyInfo(w, D, cD)?.p;
        out.rally.sc = { c: sc(C, 'rally', 'join', cC), d: sc(D, 'rally', 'join', cD) };
        go(C, 'rally', 'join', cC); go(D, 'rally', 'join', cD); go(E2, 'rally', 'join', cE); go(G, 'rally', 'join', cG); go(H, 'rally', 'join', cH);
        out.rally.joined = { who: T.call.who.length, fans: T.call.fans.length, again: ids(C, 'rally', cC) };
        DAY = _ad() + 5; thDay(0.99); out.rally.run = { n: T.protest?.n, counter: T.protest?.counter, prot: Th.st.prot - p0, gone: !T.call, late: THINGS.rallyInfo(w, B, { tid: T.id, side: 'con' }) }; }
      T.gone = true; DAY = null; delete THINGS.HOOKS.testhall; }

    // ---------- 5) 朋友被害慘了 ----------
    clean(); { const T = thing(null); Th.victims[B.agentId] = { id: T.id, day: d0() - 5, k: '', p: {} }; rel(A, B, 60); Bal[A.agentId] = 200; traits(A, ['kind']); const I = THINGS.rescueInfo(w, A); keep('rescue', 'rescue', A);
      Bal[C.agentId] = 30; rel(C, B, 60); Bal[D.agentId] = 200;
      out.rescue = { n: I?.n, ids: ids(A, 'rescue'), poor: K.rescue.when(w, C), stranger: K.rescue.when(w, D), self: K.rescue.when(w, B) };
      const gK = sc(A, 'rescue', 'give'); traits(A, ['greedy']); rel(A, B, 60); const gG = sc(A, 'rescue', 'give'); traits(A, ['kind']); out.rescue.sc = { gK, gG };
      thDay(0.01); out.rescue.untouched = !Th.victims[B.agentId].helped; Bal[A.agentId] = 200; Bal[B.agentId] = 30;
      let r1 = null; const c1 = conserved(() => { r1 = go(A, 'rescue', 'give'); }); out.rescue.run = { res: !!r1, paid: 200 - Bal[A.agentId], got: Bal[B.agentId] - 30, by: Th.victims[B.agentId].helped === A.agentId, cons: c1, after: K.rescue.when(w, A) };
    }

    // ---------- 6) 要不要帶隊搜捕 ----------
    clean(); { My.g[E2.agentId] = { k: 'wolf', d: 0 }; Ms.grp.pure = { members: [A.agentId, C.agentId, D.agentId], leader: A.agentId }; const cx = { cul: E2.agentId, kind: 'wolf', d: d0() };
      const I = MYTHSOC.huntInfo(w, A, cx); keep('hunt', 'hunt', A, cx); out.hunt = { n: I?.n, ids: ids(A, 'hunt', cx), member: MYTHSOC.huntInfo(w, C, cx), old: MYTHSOC.huntInfo(w, A, { cul: null, kind: 'wolf', d: d0() - 5 }) };
      const h0 = sc(A, 'hunt', 'hunt', cx); traits(A, ['kind']); const hK = sc(A, 'hunt', 'hunt', cx); traits(A, ['hardworking']); Ms.st.wrongful += 2; const hW = sc(A, 'hunt', 'hunt', cx); Ms.st.wrongful -= 2; out.hunt.sc = { h0, hK, hW };
      // 出事的那一刻：問帶頭的人，不擲骰
      (w.myth.inc || (w.myth.inc = [])).push([d0(), 'wolf', E2.agentId, false]); Ms.incDay = d0() - 1; Ms.lastDay = -1; const n0 = Ms.st.hunts; fix(0.99, () => MYTHSOC.daily(w)); const q = X.q.filter(x => x.kind === 'hunt'); X.q = [];
      out.hunt.asked = { q: q.length, who: q[0]?.a === A.agentId, noHunt: Ms.st.hunts === n0 };
      const pure = () => { Ms.grp.pure = { members: [A.agentId, C.agentId, D.agentId], leader: A.agentId }; Ms.hunts = []; }; pure(); /* 每天的流程會重組派系，先擺回來 */
      const res = fix(0.4, () => go(A, 'hunt', 'hunt', cx)); out.hunt.run = { res: !!res, n: Ms.st.hunts - n0, sus: Ms.hunts[0]?.sus === E2.agentId, lead: Ms.hunts[0]?.lead === A.agentId, open: MYTHSOC.huntInfo(w, A, cx) };
      DAY = null; w.myth.inc = (w.myth.inc || []).filter(x => x[2] !== E2.agentId); }

    // ---------- 7) 政變 ----------
    clean(); { w.tierState.lv = 3; Object.assign(Cr, { king: B.agentId, republic: false, legit: 20, plot: null }); Cl.titles[A.agentId] = { rank: 1 }; rel(A, B, -30);
      const I = CROWN.plotInfo(w, A); keep('plot', 'plot', A); out.plot = { legit: I?.legit, ids: ids(A, 'plot'), nobody: K.plot.when(w, C), king: K.plot.when(w, B) };
      Cr.legit = 50; out.plot.loved = K.plot.when(w, A); Cr.legit = 20;
      const p0 = sc(A, 'plot', 'plot'); traits(A, ['ambitious']); const pA = sc(A, 'plot', 'plot'); traits(A, ['hardworking']); out.plot.sc = { p0, pA };
      Cr.lastDay = null; fix(0.01, () => CROWN.daily(w)); out.plot.untouched = !Cr.plot; Object.assign(Cr, { king: B.agentId, republic: false, legit: 20, plot: null });
      const res = go(A, 'plot', 'plot'); out.plot.run = { res: !!res, leader: Cr.plot?.leader === A.agentId, n: Cr.plot?.members.length, sec: sec(A, /密謀推翻/), again: K.plot.when(w, A) };
      // 被拉的人自己決定
      rel(C, A, 40); rel(C, B, -20); rel(D, A, 40); rel(D, B, 20); const J = CROWN.joinInfo(w, C); keep('joinplot', 'joinplot', C);
      out.join = { n: J?.n, ids: ids(C, 'joinplot'), loyal: K.joinplot.when(w, D), leader: K.joinplot.when(w, A), king: K.joinplot.when(w, B) };
      const j0 = sc(C, 'joinplot', 'join'); rel(C, B, -80); const jHate = sc(C, 'joinplot', 'join'); rel(C, B, -20); out.join.sc = { j0, jHate };
      const m0 = Cr.plot.members.length; { const P = Cr.plot; P.ready = d0() + 9; Cr.lastDay = null; fix(0.99, () => CROWN.daily(w)); } out.join.untouched = !!Cr.plot && Cr.plot.members.length === m0;
      const r2 = go(C, 'joinplot', 'join'); out.join.run = { res: !!r2, n: Cr.plot?.members.length, in: Cr.plot?.members.includes(C.agentId), after: K.joinplot.when(w, C) };
      Object.assign(Cr, { king: null, plot: null }); w.tierState.lv = tier0; }

    // ---------- 8) 提案被大比數否決：嘴硬、給台階 ----------
    clean(); { rel(A, B, 50); rel(B, A, 40); traits(B, ['kind']); const votes = {}; for (const v of [C, D, E2, F, G]) votes[v.agentId] = 'against'; votes[B.agentId] = 'for';
      const p = { id: 'LR9', proposerId: A.agentId, proposerName: A.name, votes, result: '' }; const cx = { t: 'LR9', d: d0() }, cs = { a: A.agentId, t: 'LR9', d: d0() };
      const pk = () => (X.pick['rejected.quiet'] || 0) + (X.pick['rejected.casual'] || 0) + (X.pick['step.stay'] || 0) + (X.pick['step.step'] || 0); const p0 = pk(); const f0 = WAYS.faceOf(w, A);
      fix(0.5, () => WAYS.onRejected(w, p)); out.rej = { asked: pk() - p0, q: X.q.length, lost: f0 - WAYS.faceOf(w, A) >= 5 };
      WAYS.setFace(w, A, 40); Wx.lastCasual = -99; keep('rejected', 'rejected', A, cx); keep('step', 'step', B, cs); out.rej.ids = ids(A, 'rejected', cx); out.rej.sids = ids(B, 'step', cs);
      const c0 = sc(A, 'rejected', 'casual', cx); traits(A, ['stoic']); const cS = sc(A, 'rejected', 'casual', cx); traits(A, ['hardworking']); const s0 = sc(B, 'step', 'step', cs); traits(B, ['shy']); const sS = sc(B, 'step', 'step', cs); traits(B, ['kind']); out.rej.sc = { c0, cS, s0, sS };
      const r1 = go(A, 'rejected', 'casual', cx); out.rej.casual = { res: !!r1, log: /🎭/.test(logs(6)), last: Wx.lastCasual === d0(), again: ids(A, 'rejected', cx) };
      const face1 = WAYS.faceOf(w, A), a1 = aff(A, B); const r2 = go(B, 'step', 'step', cs); out.rej.step = { res: !!r2, face: WAYS.faceOf(w, A) - face1, aff: aff(A, B) - a1, owe: WAYS.owedTo(w, A, B) > 0 };
      // 小輸不問；過了兩天也不問
      X.q = []; const small = { id: 'LR8', proposerId: A.agentId, votes: { [C.agentId]: 'against', [B.agentId]: 'for', [D.agentId]: 'for' }, result: '' }; const p1 = pk(); fix(0.5, () => WAYS.onRejected(w, small)); out.rej.small = pk() - p1;
      out.rej.stale = WAYS.stepInfo(w, B, { a: A.agentId, t: 'x', d: d0() - 5 });
    }

    // ---------- 9) 接到每天的決策流程（AI 沒開） ----------
    clean(); { Fa.of[A.agentId] = { rel: R.id, piety: 95 }; A.mood = 20; only(A); others(A, ['pray']);
      fix(0.5, () => today()); const e = lastLog(A); out.rule = { kind: e?.kind, id: e?.id, ai: e?.ai, prayed: !!Fa.prayers[A.agentId] }; }

    // ---------- 10) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    clean(); w.fullAgentMode = true; { const T = thing(null); Th.victims[B.agentId] = { id: T.id, day: d0() - 5, k: '', p: {} }; rel(A, B, 60); Bal[A.agentId] = 200; only(A); others(A, ['rescue']); prompts = [];
      reply = (p) => /害慘|ruined by|badly hurt/i.test(p) ? [{ n: 1, pick: 'give', why: 'W-RES', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A); const pD = prompts.find(p => /害慘|ruined by|badly hurt/i.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, helped: Th.victims[B.agentId]?.helped === A.agentId, plan: DECIDE.view(w, A).plan, menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    // 朋友來勸改信：勸的當下就問 AI
    clean(); w.fullAgentMode = true; { Fa.of[A.agentId] = { rel: R.id, piety: 80 }; rel(A, B, 50); rel(B, A, 50); prompts = [];
      reply = () => [{ n: 1, pick: 'yes', why: 'W-CONV' }];
      FAITH.preachBy(w, A, B.agentId); DECIDE.drain(w, X, d0()); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(B);
      out.aiConv = { id: e?.id, ai: e?.ai, why: e?.why?.raw, asked: prompts.length, rel: Fa.of[B.agentId].rel === R.id }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 11) 存讀檔、跑幾天 ----------
    clean(); { const T = thing(F); Th.att[T.id][A.agentId] = -80; T.call = { d: d0(), org: A.agentId, who: [A.agentId, C.agentId], fans: [E2.agentId] }; Th.intent[T.id + '|' + B.agentId] = 'complain';
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); const T2 = w2.things?.list?.[T.id]; out.save = { call: T2?.call?.who?.length === 2 && T2?.call?.fans?.length === 1, intent: w2.things?.intent?.[T.id + '|' + B.agentId] === 'complain' }; delete T.call; }
    clean(); { for (const a of all()) if (jobs0[a.agentId]) a.job = new Job(jobs0[a.agentId]); for (const T of Object.values(Th.list)) if (things0.includes(T.id)) T.gone = false; const T = thing(F); for (const a of all()) { Bal[a.agentId] = 80; Fa.of[a.agentId] = { rel: R.id, piety: 30 + (a.name.length * 17) % 60 }; if (a !== F) Th.att[T.id][a.agentId] = ((a.name.charCodeAt(0) * 7) % 160) - 80; }
      let err = null; try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, q: X.q.length, picks: Object.fromEntries(Object.entries(X.pick).filter(([k]) => NEW.some(n => k.startsWith(n + '.')))) }; }
    w.tierState.lv = tier0;
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
  ok(r.kinds.all && r.kinds.crowd && r.kinds.on, L + '十一個選擇點都登記了，各系統都知道這些事交給本人', r.kinds);
  // 祈禱
  ok(r.pray.why === 'low' && r.pray.ids.join() === 'skip,pray' && !r.pray.fine && !r.pray.faint, L + '祈禱：只問日子難過、又夠虔誠的信徒', r.pray);
  ok(r.pray.sc.p95 > r.pray.sc.p60, L + '祈禱：越虔誠越會祈禱', r.pray.sc);
  ok(r.pray.untouched && r.pray.run.res && r.pray.run.wish && !r.pray.run.again && r.pray.run.log, L + '祈禱：每天的流程不再擲骰；本人決定祈禱就記下心願，幾天內不再問', r.pray.run);
  // 傳教
  ok(r.preach.ctx && r.preach.ids.join() === `no,go:${r.preach.ids[1]?.split(':')[1]}` && !r.preach.mild && !r.preach.same && r.preach.zeal > 0, L + '傳教：只問很虔誠、又有信別的（或不信）的好朋友的人', r.preach);
  ok(r.preach.sc.goShy < r.preach.sc.go0, L + '傳教：害羞的人比較不會去勸', r.preach.sc);
  ok(r.preach.untouched && r.preach.run.res && r.preach.run.queued && r.preach.run.notYet && r.preach.flow === 1, L + '傳教：每天的流程不再擲骰；本人決定去勸，被勸的人當下被問、還沒改信', r.preach);
  ok(r.conv && r.conv.ids.join() === 'no,yes' && r.conv.p > 0.4 && r.conv.sc.yes0 > r.conv.sc.yesDevout + 0.5, L + '改信：不信教的人比較容易被勸動，本來就很虔誠的人很難', r.conv);
  ok(r.conv && r.conv.run.kept && r.conv.run.res && r.conv.run.rel && r.conv.run.piety === 45 && !r.conv.run.after?.length, L + '改信：說不改就不改；決定改信就真的改（虔誠度從 45 開始），不會再問', r.conv?.run);
  // 新東西
  ok(!r.thing.like && !r.thing.owner && !r.thing.none && r.thing.chat >= 1, L + '新東西：喜歡的人、老闆、沒看法的人不問；去用、推薦、抱怨這些日常閒聊照舊由每天的流程處理', r.thing);
  ok(r.thing.tid && r.thing.persIds.join() === 'quiet,persuade' && !r.thing.weak && !r.thing.silent && !r.thing.nothing, L + '新東西：不喜歡、又有自己人常往那裡跑的人，可以決定要不要去勸；看法很淡、今天不敢講、沒事可做的人不問', r.thing);
  ok(r.thing.plan.res && r.thing.plan.intent === 'persuade' && !r.thing.plan.again && r.thing.pers.n === 1 && r.thing.pers.ok === 1 && r.thing.pers.quit && r.thing.pers.cleared, L + '新東西：本人決定去勸，隔天真的去勸；勸動了對方答應不再去', { plan: r.thing.plan, pers: r.thing.pers });
  ok(r.thing.hateIds.join() === 'quiet,persuade,protest' && r.thing.noRegIds.join() === 'quiet,protest', L + '新東西：夠討厭、鎮上也有夠多人討厭時，多一個「號召抗議」', { ids: r.thing.hateIds, noReg: r.thing.noRegIds });
  ok(r.thing.sc.qK > r.thing.sc.q0 && r.thing.sc.q90 > r.thing.sc.q0 && r.thing.sc.prC > r.thing.sc.pr0 && r.thing.sc.prS < r.thing.sc.pr0, L + '新東西：心軟的比較會去勸、越討厭越想做點什麼；有魅力的比較敢帶頭、害羞的不敢', r.thing.sc);
  ok(r.thing.untouched, L + '新東西：每天的流程不替人帶頭抗議', r.thing.untouched);
  // 抗議
  ok(r.rally.call && r.rally.notYet && r.rally.asked === 'con,con,pro,pro,pro' && !r.rally.owner && !r.rally.noMore, L + '號召抗議：帶頭的人貼告示，當天不集合；不喜歡的人被問跟不跟、喜歡的人被問要不要聲援，老闆不問', r.rally);
  ok(r.rally.ids?.join() === 'stay,join' && r.rally.pC > r.rally.pD && r.rally.sc.c > r.rally.sc.d, L + '號召抗議：越討厭、跟帶頭的人越熟，越會跟', r.rally);
  ok(r.rally.joined?.who === 3 && r.rally.joined.fans === 3 && !r.rally.joined.again?.length, L + '號召抗議：答應的人記在名單上（抗議的、聲援的分開），答應過不會再問', r.rally.joined);
  ok(r.rally.run?.n === 3 && r.rally.run.counter === 3 && r.rally.run.prot === 1 && r.rally.run.gone && !r.rally.run.late, L + '號召抗議：隔天到場三個人以上就成，聲援的也到場；集合完就不能再加入', r.rally.run);
  // 接濟
  ok(r.rescue.n > 0 && r.rescue.ids.join() === 'wait,give' && !r.rescue.poor && !r.rescue.stranger && !r.rescue.self, L + '接濟：只問跟受害的人交情好、手頭又有餘裕的人', r.rescue);
  ok(r.rescue.sc.gK > r.rescue.sc.gG + 0.4, L + '接濟：心軟的比較會幫、貪心的比較不會', r.rescue.sc);
  ok(r.rescue.untouched && r.rescue.run.res && r.rescue.run.paid === r.rescue.n && r.rescue.run.got === r.rescue.n && r.rescue.run.by && r.rescue.run.cons && !r.rescue.run.after, L + '接濟：每天的流程不再擲骰；本人決定拿錢，錢進受害的人口袋、銀幣守恆，幫過不會再問', r.rescue.run);
  // 搜捕
  ok(r.hunt.n === 3 && r.hunt.ids.join() === 'hold,hunt' && !r.hunt.member && !r.hunt.old, L + '搜捕：只問純人派帶頭的人；事情過了兩天就不問', r.hunt);
  ok(r.hunt.sc.hK < r.hunt.sc.h0 && r.hunt.sc.hW < r.hunt.sc.h0, L + '搜捕：心軟的比較不會動手；抓錯過人以後更猶豫', r.hunt.sc);
  ok(r.hunt.asked.q === 1 && r.hunt.asked.who && r.hunt.asked.noHunt, L + '搜捕：出事的當下問帶頭的人，不擲骰', r.hunt.asked);
  ok(r.hunt.run.res && r.hunt.run.n === 1 && r.hunt.run.sus && r.hunt.run.lead, L + '搜捕：本人決定帶隊就真的去抓（抓到誰仍然看運氣）', r.hunt.run);
  // 政變
  ok(r.plot.legit === 20 && r.plot.ids.join() === 'wait,plot' && !r.plot.nobody && !r.plot.king && !r.plot.loved, L + '政變：國王民心低時，只問鎮上最有聲望、又跟國王處不來的那個人', r.plot);
  ok(r.plot.sc.pA > r.plot.sc.p0, L + '政變：有野心的人比較會動手', r.plot.sc);
  ok(r.plot.untouched && r.plot.run.res && r.plot.run.leader && r.plot.run.n === 1 && r.plot.run.sec === 1 && !r.plot.run.again, L + '政變：每天的流程不再擲骰；本人決定動手才開始密謀，真相頁記著', r.plot.run);
  ok(r.join.n === 1 && r.join.ids.join() === 'refuse,join' && !r.join.loyal && !r.join.leader && !r.join.king && r.join.sc.jHate > r.join.sc.j0, L + '加入政變：只問跟主謀交好、又看國王不順眼的人；越討厭國王越會加入', r.join);
  ok(r.join.untouched && r.join.run.res && r.join.run.n === 2 && r.join.run.in && !r.join.run.after, L + '加入政變：每天的流程不再擲骰拉人；本人決定加入才算數', r.join);
  // 嘴硬、台階
  ok(r.rej.asked === 2 && r.rej.q === 0 && r.rej.lost && r.rej.ids.join() === 'quiet,casual' && r.rej.sids.join() === 'stay,step' && r.rej.small === 0 && !r.rej.stale, L + '提案被否決：大比數否決的當下問提案人和他最要好的朋友（不擲骰）；小輸不問', r.rej);
  ok(r.rej.sc.cS < r.rej.sc.c0 && r.rej.sc.sS < r.rej.sc.s0, L + '提案被否決：沉穩的人比較不嘴硬、害羞的朋友比較不會出面', r.rej.sc);
  ok(r.rej.casual.res && r.rej.casual.log && r.rej.casual.last && !r.rej.casual.again?.length && r.rej.step.res && r.rej.step.face === 10 && r.rej.step.aff === 6 && r.rej.step.owe, L + '提案被否決：本人決定嘴硬；朋友決定出面，提案人面子回來一點、記下這份人情', { casual: r.rej.casual, step: r.rej.step });
  // 流程
  ok(r.rule.kind === 'pray' && r.rule.id === 'pray' && r.rule.ai === 0 && r.rule.prayed, L + '接到每天的決策流程：AI 沒開時照個性決定（很虔誠的人日子難過就祈禱）', r.rule);
  ok(r.ai.id === 'give' && r.ai.ai === 1 && r.ai.why === 'W-RES' && r.ai.helped && r.ai.plan === 'N-NEXT' && r.ai.menu && r.ai.money, L + 'AI 版：由 AI 決定拿錢拉朋友一把並說理由', r.ai);
  ok(r.aiConv.id === 'yes' && r.aiConv.ai === 1 && r.aiConv.why === 'W-CONV' && r.aiConv.asked === 1 && r.aiConv.rel, L + 'AI 版：朋友來勸的當下就問 AI 改不改信', r.aiConv);
  if (!zh) ok(!r.ai.cjk, L + '英文版給 AI 的資料沒有中文', r.ai.bits);
  ok(r.save.call && r.save.intent, L + '存讀檔：號召中的抗議名單、打算要做的事都還在', r.save);
  ok(!r.days.err && r.days.q === 0, L + '有新東西、大家都信教，照常跑八天沒有錯誤', r.days);
  ok(Object.values(r.facts).every(v => typeof v === 'number' && v > 15), L + '每個選擇點都講得出事實', r.facts);
  if (!zh) ok(r.txt.length === 0, L + '英文版：標題、事實、選項、理由都有翻譯', r.txt.slice(0, 8));
  ok(errs.length === 0, L + '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
