// v9.26.0 決策核心批次 D（陰暗面與選舉手段）
// 動公家的東西並推給別人、善意的謊言、選戰抹黑／空頭支票／買票／收買報社、聽到壞話要不要傳給當事人、
// 賣東西偷斤減兩、掌櫃揩油、神職私吞奉獻、私下不守自己贊成的規定、疫情規定下偷溜：改由本人決定，不再擲骰。
// 驗：選擇點都登記了、每日流程不再擲骰（沒有決策核心時仍照舊擲骰）、每個選項的結算、個性與處境不同分數不同、AI 版、銀幣守恆、存讀檔、中英文
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
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const Dk = DARK.S(w); const El = w.election; const Rp = PRESS.S(w); const Fa = FAITH.S(w); const Mk = MARKET.S(w); const Wx = WAYS.S(w); const Cal = CALAMITY.S(w);
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
    const NEW = ['pilfer', 'comfort', 'dirty', 'tattle', 'trade', 'skim', 'embezzle', 'twoface', 'sneak'];
    const noDark = (f) => { DECIDE.dark = false; try { return f(); } finally { DECIDE.dark = true; } }; // 沒有這一批決策核心時的行為(舊的擲骰)
    const tier0 = w.tierState.lv; const owners0 = { ...Mk.owners }; const jobs0 = {}; for (const a of all()) jobs0[a.agentId] = a.job?.key;
    for (const a of all()) if (a.job?.key === 'priest') a.job = new Job('farmer'); // 神職只留測試指定的那一位
    const sec = (who, re) => (Dk.secrets || []).filter(s => s.culprit === who.agentId && re.test(String(s.k))).length;
    const clean = () => {
      X.cool = {}; X.q = []; DAY = null; w.tierState.lv = tier0;
      for (const a of all()) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 50; a.moodModifier = 0; }
      for (const a of TEST) { traits(a, ['hardworking']); a.age = 30; for (const b of all()) if (a !== b) { rel(a, b, 0); rel(b, a, 0); } a.job = new Job('guard'); }
      Dk.secrets = []; Dk.wrongs = []; Dk.trade = {}; Dk.debts = [];
      w.stockpile.resources.tools = 5; w.stockpile.resources.food = 100;
      Object.assign(El, { active: false, phase: 'none', candidates: [], campaignDaysLeft: 0 }); Rp.elec = null; for (const P of Rp.papers) P.bribedBy = null;
      Mk.mgr = {}; Wx.hyp = []; Cal.cur = null;
      for (const R of Fa.rels) R.fund = 0;
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const go = (a, key, id, ctx) => { const o = opt(a, key, id, ctx); return o ? o.run(w, a, ctx) : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const texts = {}; const keep = (name, key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), dark: DECIDE.dark === true, on: DARK.byDark(w), off: noDark(() => DARK.byDark(w)) };

    // ---------- 2) 公家的東西 ----------
    clean(); { traits(A, ['lazy', 'gossip']); const c1 = K.pilfer.when(w, A); keep('pilferTool', 'pilfer', A);
      out.pilfer = { ctx: !!c1, food: c1?.food, ids: ids(A, 'pilfer'), honest: K.pilfer.when(w, B) };
      w.stockpile.resources.tools = 0; out.pilfer.empty = K.pilfer.when(w, A); w.stockpile.resources.tools = 5;
      // 每天的流程不再擲骰
      const t0 = w.stockpile.get('tools'); fix(0.01, () => DARK.daily(w)); out.pilfer.untouched = w.stockpile.get('tools') === t0 && sec(A, /弄的/) === 0;
      const res = go(A, 'pilfer', 'take'); out.pilfer.take = { res: !!res, tools: t0 - w.stockpile.get('tools'), sec: sec(A, /裝作不知道/), mood: A.moodModifier };
      // 有仇人：多一個「推給他」
      rel(A, B, -60); keep('pilferFoe', 'pilfer', A); out.pilfer.foeIds = ids(A, 'pilfer'); const blM = sc(A, 'pilfer', 'blame'), tkM = sc(A, 'pilfer', 'take');
      traits(A, ['lazy', 'charismatic']); const blN = sc(A, 'pilfer', 'blame'), tkN = sc(A, 'pilfer', 'take'); traits(A, ['lazy', 'gossip']);
      out.pilfer.sc = { blM, tkM, blN, tkN };
      const w0 = Dk.wrongs.length; const res2 = go(A, 'pilfer', 'blame'); out.pilfer.blame = { res: !!res2, sec: sec(A, /還推給/), wrong: Dk.wrongs.slice(w0).some(x => x.by === A.agentId && x.to === B.agentId), blamed: (B.thoughts || []).some(x => x.kind === 'wrongly_blamed') };
      // 貪吃的人拿的是糧食
      traits(A, ['glutton', 'gossip', 'jealous']); const f0 = w.stockpile.get('food'); keep('pilferFood', 'pilfer', A); go(A, 'pilfer', 'take'); out.pilfer.eat = { food: K.pilfer.when(w, A)?.food, n: f0 - w.stockpile.get('food') };
      // 沒有決策核心：照舊擲骰
      traits(A, ['lazy', 'gossip']); rel(A, B, 0); Dk.secrets = []; const t1 = w.stockpile.get('tools'); noDark(() => fix(0.01, () => DARK.daily(w))); out.pilfer.dice = t1 - w.stockpile.get('tools') >= 1 && sec(A, /弄的/) >= 1; }

    // ---------- 3) 朋友心情很差 ----------
    clean(); { traits(A, ['kind']); B.mood = 20; rel(A, B, 40); const c1 = K.comfort.when(w, A); keep('comfort', 'comfort', A);
      traits(C, ['hardworking']); rel(C, B, 40); out.comfort = { ctx: c1?.b === B.agentId, ids: ids(A, 'comfort'), notKind: K.comfort.when(w, C) };
      const lieK = sc(A, 'comfort', 'lie'), sitK = sc(A, 'comfort', 'sit'); traits(A, ['romantic']); const lieR = sc(A, 'comfort', 'lie'), sitR = sc(A, 'comfort', 'sit'); traits(A, ['kind']); out.comfort.sc = { lieK, sitK, lieR, sitR };
      fix(0.01, () => DARK.daily(w)); out.comfort.untouched = sec(A, /善意的謊言/) === 0; B.mood = 20; B.moodModifier = 0;
      const r1 = go(A, 'comfort', 'sit'); const m1 = B.moodModifier, s1 = sec(A, /善意的謊言/); const r2 = go(A, 'comfort', 'lie');
      out.comfort.run = { sit: !!r1, m1, s1, lie: !!r2, m2: B.moodModifier - m1, s2: sec(A, /善意的謊言/) };
      B.mood = 50; out.comfort.fine = K.comfort.when(w, A); B.mood = 20; Dk.secrets = [];
      noDark(() => fix(0.01, () => DARK.daily(w))); out.comfort.dice = sec(A, /善意的謊言/) >= 1; }

    // ---------- 4) 選戰怎麼打 ----------
    const camp = () => { Object.assign(El, { active: true, phase: 'campaign', candidates: [{ agentId: A.agentId, name: A.name }, { agentId: B.agentId, name: B.name }], campaignDaysLeft: 3 }); };
    clean(); { camp(); out.dirty = { honestIds: ids(A, 'dirty'), other: K.dirty.when(w, C) };
      traits(A, ['kind']); out.dirty.kind = K.dirty.when(w, A);
      traits(A, ['jealous', 'abrasive']); out.dirty.meanIds = ids(A, 'dirty'); keep('dirtyBase', 'dirty', A);
      // 有錢：可以買票；有報社：可以收買
      w.tierState.lv = 1; PRESS.S(w); const P = Rp.papers.find(x => x.st === 'town'); if (P) { P.journo = G.agentId; P.bribedBy = null; P.banned = false; }
      Bal[A.agentId] = 200; out.dirty.richIds = ids(A, 'dirty'); keep('dirtyRich', 'dirty', A);
      const smM = sc(A, 'dirty', 'smear:' + B.agentId), byM = sc(A, 'dirty', 'buy'); traits(A, ['gossip']); const smG = sc(A, 'dirty', 'smear:' + B.agentId), byG = sc(A, 'dirty', 'buy'); traits(A, ['jealous', 'abrasive']);
      out.dirty.sc = { smM, smG, byM, byG, clean: sc(A, 'dirty', 'clean') };
      // 每天的流程不再擲骰
      const before = Dk.secrets.length; const econ = w.econ || (w.econ = {}); const ps = econ.paperShort; econ.paperShort = false;
      fix(0.01, () => DARK.daily(w)); w.wallet.lastDay = null; fix(0.01, () => WALLET.daily(w)); Rp.lastDay = null; fix(0.01, () => PRESS.daily(w)); for (const a of all()) Bal[a.agentId] = 30; Bal[A.agentId] = 200;
      out.dirty.untouched = sec(A, /抹黑|空頭支票|買票|收買/) === 0 && !P?.bribedBy; Dk.secrets = [];
      // 抹黑
      const bAff = all().filter(v => v !== A && v !== B).reduce((s, v) => s + aff(v, B), 0); const r1 = go(A, 'dirty', 'smear:' + B.agentId);
      out.dirty.smear = { res: !!r1, sec: sec(A, /造謠抹黑/), drop: all().filter(v => v !== A && v !== B).reduce((s, v) => s + aff(v, B), 0) - bAff };
      // 空頭支票
      const aAff = all().filter(v => v !== A).reduce((s, v) => s + aff(v, A), 0); const r2 = go(A, 'dirty', 'hollow');
      out.dirty.hollow = { res: !!r2, sec: sec(A, /空頭支票/), up: all().filter(v => v !== A).reduce((s, v) => s + aff(v, A), 0) - aAff };
      // 買票
      let r3 = null; const c3 = conserved(() => { r3 = go(A, 'dirty', 'buy'); }); out.dirty.buy = { res: !!r3, paid: 200 - Bal[A.agentId], got: all().filter(v => v !== A && Bal[v.agentId] === 40).length, sec: sec(A, /買票/), cons: c3 };
      Bal[A.agentId] = 50; out.dirty.buyPoor = ids(A, 'dirty').includes('buy'); Bal[A.agentId] = 200; for (const a of all()) if (a !== A) Bal[a.agentId] = 30;
      // 收買報社：記者有原則就不收
      traits(G, ['perfectionist']); let r4 = null; const c4 = conserved(() => { r4 = go(A, 'dirty', 'press'); }); out.dirty.refuse = { res: !!r4, paid: 200 - Bal[A.agentId], by: P?.bribedBy || null, cons: c4, still: ids(A, 'dirty').includes('press') };
      traits(G, ['hardworking']); let r5 = null; const c5 = conserved(() => { r5 = go(A, 'dirty', 'press'); });
      out.dirty.press = { res: !!r5, paid: 200 - Bal[A.agentId], ed: Bal[G.agentId] - 30, by: P?.bribedBy === A.agentId, sec: sec(A, /收買/), cons: c5, again: ids(A, 'dirty').includes('press') };
      // 沒有決策核心：照舊擲骰
      Dk.secrets = []; Rp.elec = null; if (P) P.bribedBy = null; Bal[A.agentId] = 300;
      noDark(() => { fix(0.01, () => DARK.daily(w)); w.wallet.lastDay = null; fix(0.01, () => WALLET.daily(w)); Bal[A.agentId] = 300; Rp.lastDay = null; fix(0.01, () => PRESS.daily(w)); });
      out.dirty.dice = { smear: sec(A, /造謠抹黑/) >= 1, buy: sec(A, /買票/) >= 1, press: P?.bribedBy === A.agentId }; econ.paperShort = ps;
      // 競選結束就不問了
      El.phase = 'voting'; out.dirty.over = K.dirty.when(w, A); }

    // ---------- 5) 聽到有人說朋友的壞話 ----------
    clean(); { traits(C, ['kind']); rel(C, B, 60); const w0 = Dk.wrongs.length;
      fix(0.99, () => DARK.speak(w, A, C, B, 'dislike', false)); const q = X.q.slice(); const cx = q[0]?.ctx; X.q = [];
      out.tattle = { queued: q.length === 1 && q[0].kind === 'tattle' && q[0].a === C.agentId, noConfront: Dk.wrongs.length === w0, ids: cx ? ids(C, 'tattle', cx) : null, line: !!cx?.line };
      if (cx) { keep('tattle', 'tattle', C, cx); const tell = sc(C, 'tattle', 'tell', cx); rel(C, B, 30); const tellLow = sc(C, 'tattle', 'tell', cx); rel(C, B, 60); out.tattle.sc = { tell, tellLow, keep: sc(C, 'tattle', 'keep', cx) };
        const a0 = aff(B, A); const res = go(C, 'tattle', 'tell', cx); out.tattle.run = { res: !!res, wrong: Dk.wrongs.slice(w0).some(x => x.by === A.agentId && x.to === B.agentId), drop: aff(B, A) - a0 }; }
      // 聽的人跟被講的人不熟：不會有這件事
      X.q = []; rel(C, B, 0); fix(0.99, () => DARK.speak(w, A, C, B, 'dislike', false)); out.tattle.stranger = X.q.length; X.q = []; rel(C, B, 60);
      // 接到流程：講壞話的當下就問，照個性決定
      const p0 = (X.pick['tattle.tell'] || 0) + (X.pick['tattle.keep'] || 0); fix(0.5, () => { DARK.speak(w, A, C, B, 'dislike', false); DECIDE.drain(w, X, d0()); }); out.tattle.flow = (X.pick['tattle.tell'] || 0) + (X.pick['tattle.keep'] || 0) - p0;
      // 沒有決策核心：照舊擲骰
      X.q = []; const w1 = Dk.wrongs.length; noDark(() => fix(0.01, () => DARK.speak(w, A, C, B, 'dislike', false))); out.tattle.dice = X.q.length === 0 && Dk.wrongs.slice(w1).some(x => x.by === A.agentId && x.to === B.agentId); }

    // ---------- 6) 做生意的手法 ----------
    clean(); { A.job = new Job('trader'); traits(A, ['greedy', 'gossip']); B.job = new Job('trader'); traits(C, ['lazy', 'gossip']);
      const c1 = K.trade.when(w, A); keep('trade', 'trade', A); out.trade = { ctx: !!c1, ids: ids(A, 'trade'), honest: K.trade.when(w, B), notSeller: K.trade.when(w, C), def: DARK.shorting(w, A) };
      const sh = sc(A, 'trade', 'short'); traits(A, ['gossip']); const shN = sc(A, 'trade', 'short'); traits(A, ['greedy', 'gossip']); out.trade.sc = { sh, shN, fair: sc(A, 'trade', 'fair') };
      go(A, 'trade', 'short'); keep('tradeCur', 'trade', A); out.trade.set = { k: Dk.trade[A.agentId]?.k, on: DARK.shorting(w, A), cur: K.trade.when(w, A)?.cur };
      // 買賣糾紛：只留 A 一個賣家，看是不是真的坑人
      const saved = []; for (const a of all()) if (a !== A && ['trader', 'cook', 'blacksmith', 'tailor', 'carpenter', 'tavern', 'doctor'].includes(a.job?.key)) { saved.push([a, a.job]); a.job = new Job('guard'); }
      const dispute = () => { Dk.secrets = []; for (const a of all()) Bal[a.agentId] = 30; let c = false; c = conserved(() => fix(0.2, () => DARK.daily(w))); return { cheat: sec(A, /偷斤減兩/), gain: Bal[A.agentId] - 30, cons: c, mis: (Dk.mis || []).filter(m => m.kind === 'price' && m.b === A.agentId).length }; };
      Dk.mis = []; out.trade.short = dispute(); go(A, 'trade', 'fair'); Dk.mis = []; out.trade.fairRun = dispute(); out.trade.fairSet = Dk.trade[A.agentId]?.k;
      out.trade.dice = noDark(() => dispute()).cheat >= 1;
      for (const [a, j] of saved) a.job = j; }

    // ---------- 7) 掌櫃經手的帳 ----------
    clean(); { for (const k of Object.keys(Mk.owners)) delete Mk.owners[k]; Mk.owners.farm = B.agentId; Mk.mgr = { farm: A.agentId }; Mk.hist.farm = [[200, 0]]; Bal[B.agentId] = 100; traits(A, ['greedy']);
      const I = COMPETE.skimInfo(w, A); keep('skim', 'skim', A); out.skim = { amt: I?.amt, ids: ids(A, 'skim'), notMgr: K.skim.when(w, C) };
      traits(A, ['hardworking']); out.skim.plain = K.skim.when(w, A); traits(A, ['greedy']);
      const s0 = sc(A, 'skim', 'skim'); rel(A, B, 60); const sFriend = sc(A, 'skim', 'skim'); rel(A, B, 0); out.skim.sc = { s0, sFriend, clean: sc(A, 'skim', 'clean') };
      const st0 = { ...Mk.cst }; let r1 = null; const c1 = conserved(() => fix(0.99, () => { r1 = go(A, 'skim', 'skim'); }));
      out.skim.run = { res: !!r1, a: Bal[A.agentId] - 30, b: 100 - Bal[B.agentId], n: Mk.cst.skim - st0.skim, still: Mk.mgr.farm === A.agentId, cons: c1 };
      const a0 = aff(B, A); fix(0.01, () => go(A, 'skim', 'skim')); out.skim.caught = { n: Mk.cst.caught - st0.caught, fired: !Mk.mgr.farm, drop: aff(B, A) - a0, after: K.skim.when(w, A) };
      // 每週的流程：東家名下三家店，A 是其中一家的掌櫃
      const wk = (v) => { Mk.owners.farm = B.agentId; Mk.owners.kitchen = B.agentId; Mk.owners.timber = B.agentId; A.job = new Job('farmer'); Mk.mgr = { farm: A.agentId }; Mk.hist.farm = [[200, 0]]; Mk.hist.kitchen = [[900, 0]]; Mk.hist.timber = [[900, 0]]; Bal[B.agentId] = 500; const n0 = Mk.cst.skim; DAY = Math.floor(_ad() / 7) * 7 + 10; fix(v, () => COMPETE.manage(w, all(), DAY)); DAY = null; return { n: Mk.cst.skim - n0, mgr: Mk.mgr.farm || null }; };
      out.skim.weekly = wk(0.01); out.skim.dice = noDark(() => wk(0.01));
      for (const k of Object.keys(Mk.owners)) delete Mk.owners[k]; Object.assign(Mk.owners, owners0); Mk.mgr = {}; }

    // ---------- 8) 教團的奉獻箱 ----------
    clean(); { const R = Fa.rels[0]; A.job = new Job('priest'); Fa.of[A.agentId] = { rel: R.id, piety: 60 }; R.fund = 100; traits(A, ['greedy']);
      const I = FAITH.embezzleInfo(w, A); keep('embezzle', 'embezzle', A); out.emb = { fund: I?.fund, n: I?.n, ids: ids(A, 'embezzle'), lay: K.embezzle.when(w, C) };
      traits(A, ['ascetic']); out.emb.ascetic = K.embezzle.when(w, A); traits(A, ['greedy']); R.fund = 30; out.emb.small = K.embezzle.when(w, A); R.fund = 100;
      const tG = sc(A, 'embezzle', 'take'); traits(A, ['kind']); const tK = sc(A, 'embezzle', 'take'); traits(A, ['greedy']); out.emb.sc = { tG, tK, clean: sc(A, 'embezzle', 'clean') };
      const mine = () => { A.job = new Job('priest'); Fa.of[A.agentId] = { rel: R.id, piety: 60 }; R.fund = 100; Bal[A.agentId] = 30; }; // 教團每天的流程可能讓人改信，先擺回來
      Fa.lastDay = null; fix(0.01, () => FAITH.daily(w)); out.emb.untouched = sec(A, /私吞/) === 0; mine();
      let r1 = null; const c1 = conserved(() => { r1 = go(A, 'embezzle', 'take'); }); out.emb.run = { res: !!r1, fund: R.fund, got: Bal[A.agentId] - 30, sec: sec(A, /私吞/), cons: c1 };
      Dk.secrets = []; mine(); Fa.lastDay = null; noDark(() => fix(0.01, () => FAITH.daily(w))); out.emb.dice = sec(A, /私吞/) >= 1; }

    // ---------- 9) 自己贊成的規定 ----------
    clean(); { traits(A, ['greedy']); const law = { id: 'LH9', kind: 'steam_air', votes: { [A.agentId]: 'for' }, status: 'approved' }; const pol = { id: 'LH8', kind: 'policy', votes: { [A.agentId]: 'for' }, status: 'approved' };
      const p0 = (X.pick['twoface.keep'] || 0) + (X.pick['twoface.break'] || 0); fix(0.01, () => WAYS.onApproved(w, law)); // 以前骰到 0.01 一定會私下不守；現在是問他本人
      out.two = { asked: (X.pick['twoface.keep'] || 0) + (X.pick['twoface.break'] || 0) - p0, q: X.q.length };
      Wx.hyp = []; const cx = { k: 'steam_air', t: 'LH9' }, cp = { k: 'policy', t: 'LH8' }; keep('twoface', 'twoface', A, cx); keep('twofacePol', 'twoface', A, cp);
      out.two.ids = ids(A, 'twoface', cx); out.two.sc = { law: sc(A, 'twoface', 'break', cx), pol: sc(A, 'twoface', 'break', cp), keep: sc(A, 'twoface', 'keep', cx) }; traits(A, ['greedy', 'kind']); out.two.sc.lawK = sc(A, 'twoface', 'break', cx); traits(A, ['greedy']);
      const r1 = go(A, 'twoface', 'break', cx); out.two.run = { res: !!r1, hyp: Wx.hyp.length === 1 && Wx.hyp[0].a === A.agentId && Wx.hyp[0].k === 'steam_air' };
      out.two.cal = WAYS.twofaceInfo(w, A, { k: 'cal_close', t: 'x' }); out.two.honest = (() => { traits(B, ['hardworking']); X.q = []; fix(0.5, () => WAYS.onApproved(w, { id: 'LH7', kind: 'steam_air', votes: { [B.agentId]: 'for' } })); return X.q.length; })();
      Wx.hyp = []; noDark(() => fix(0.1, () => WAYS.onApproved(w, pol))); out.two.dice = Wx.hyp.length === 1; Wx.hyp = []; }

    // ---------- 10) 疫情的規定 ----------
    clean(); { const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
      const spec = { name: en ? 'Grey Cough' : '灰咳病', route: ['droplet', 'contact'], sym: ['cough', 'fever'], latency: 'short', speed: 'mid', length: 'mid', lethal: 'mid' };
      Cal.cur = null; Cal.coolTo = 0; Cal.power = 100; DAY = _ad(); CALAMITY.release(w, spec, H.agentId); const Xc = Cal.cur; const PW = PLAGUEWAYS;
      if (Xc) { Xc.st = {}; Xc.inf = 0; Xc.found = DAY; Xc.phase = 'found'; const p = PW.P(Xc); p.fear = -99; p.shame = -99;
        out.sneak = { none: K.sneak.when(w, A) }; Xc.ms.close = DAY - 30;
        traits(A, ['glutton', 'lazy'], ['自由']); Wx.rt[A.agentId] = { s: 'tavern', t: 'pm' }; traits(B, ['pessimist']); Wx.rt[B.agentId] = { s: 'park', t: 'pm' }; traits(C, ['hardworking'], ['自由']); Wx.rt[C.agentId] = { s: 'park', t: 'pm' };
        const I = PW.sneakInfo(w, A); keep('sneak', 'sneak', A); out.sneak.info = { k: I?.k, p: I?.p, tired: I?.tired, days: I?.days }; out.sneak.ids = ids(A, 'sneak'); out.sneak.careful = K.sneak.when(w, B); out.sneak.mild = !!K.sneak.when(w, C);
        out.sneak.sc = { a: sc(A, 'sneak', 'sneak'), c: sc(C, 'sneak', 'sneak'), obey: sc(A, 'sneak', 'obey') };
        // 每天的流程不再擲骰
        const n0 = p.sneak; fix(0.01, () => PW._t.sneakDaily(w, Xc, DAY)); out.sneak.untouched = p.sneak === n0 && !p.brk[A.agentId];
        // 投過贊成票的人決定溜：隔天真的溜，記成說一套做一套
        const pp = { id: 'LT926', kind: 'cal_close', createdDay: Xc.day, proposerId: D.agentId, votes: { [A.agentId]: 'for' }, why: {}, status: 'approved' }; w.proposals.items.push(pp); keep('sneakVoted', 'sneak', A);
        const r1 = go(A, 'sneak', 'sneak'); out.sneak.plan = { res: !!r1, go: !!p.go[A.agentId], notYet: !p.brk[A.agentId], again: K.sneak.when(w, A) };
        DAY += 1; fix(0.99, () => PW._t.sneakDaily(w, Xc, DAY)); out.sneak.run = { brk: p.brk[A.agentId] === DAY, n: p.sneak - n0, gone: !p.go[A.agentId], hyp: Wx.hyp.some(h => h.a === A.agentId && h.k === 'cal_close'), others: Object.keys(p.brk).length };
        // 存讀檔：打定主意要溜的人還記著
        p.go[C.agentId] = { k: 'close', d: DAY }; const sv = JSON.parse(JSON.stringify(w.serialize())); out.sneak.save = sv.calamity?.cur?.pw?.go?.[C.agentId]?.k === 'close'; p.go = {};
        // 沒有決策核心：照舊擲骰
        DAY += 1; const n1 = p.sneak; noDark(() => fix(0.01, () => PW._t.sneakDaily(w, Xc, DAY))); out.sneak.dice = p.sneak - n1;
        w.proposals.items = w.proposals.items.filter(x => x.id !== 'LT926'); }
      else out.sneak = { err: 'no plague' };
      Cal.cur = null; DAY = null; Wx.hyp = []; }

    // ---------- 11) 接到每天的決策流程（AI 沒開） ----------
    clean(); { A.job = new Job('trader'); traits(A, ['greedy', 'gossip']); only(A); others(A, ['trade']);
      fix(0.5, () => today()); const e = lastLog(A); out.rule = { kind: e?.kind, id: e?.id, ai: e?.ai, on: DARK.shorting(w, A) }; }

    // ---------- 12) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    clean(); w.fullAgentMode = true; { const R = Fa.rels[0]; A.job = new Job('priest'); Fa.of[A.agentId] = { rel: R.id, piety: 60 }; R.fund = 100; traits(A, ['greedy']); only(A); others(A, ['embezzle']); prompts = [];
      reply = (p) => /奉獻|offering/i.test(p) ? [{ n: 1, pick: 'take', why: 'W-EMB', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A); const pD = prompts.find(p => /奉獻|offering/i.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, fund: R.fund, plan: DECIDE.view(w, A).plan, menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    // 聽到壞話：講的當下就問 AI
    clean(); w.fullAgentMode = true; { traits(C, ['kind']); rel(C, B, 60); prompts = []; const w0 = Dk.wrongs.length;
      reply = () => [{ n: 1, pick: 'tell', why: 'W-TAT' }];
      fix(0.99, () => DARK.speak(w, A, C, B, 'dislike', false)); DECIDE.drain(w, X, d0()); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(C);
      out.aiTat = { id: e?.id, ai: e?.ai, why: e?.why?.raw, asked: prompts.length, confront: Dk.wrongs.slice(w0).some(x => x.by === A.agentId && x.to === B.agentId) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 13) 存讀檔、跑幾天 ----------
    clean(); { A.job = new Job('trader'); traits(A, ['greedy', 'gossip']); DARK.tradeSet(w, A, 'short');
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { trade: w2.dark?.trade?.[A.agentId]?.k === 'short' }; }
    clean(); { for (const a of all()) if (jobs0[a.agentId]) a.job = new Job(jobs0[a.agentId]); camp(); for (const a of all()) Bal[a.agentId] = 80; Bal[A.agentId] = 300; traits(A, ['jealous', 'abrasive']); El.campaignDaysLeft = 3;
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
  ok(r.kinds.all && r.kinds.dark && r.kinds.on && !r.kinds.off, L + '九個選擇點都登記了，各系統都知道這些事交給本人', r.kinds);
  // 公家的東西
  ok(r.pilfer.ctx && r.pilfer.food === false && r.pilfer.ids.join() === 'no,take' && !r.pilfer.honest && !r.pilfer.empty, L + '公家的東西：只問不老實又懶散／貪吃的人；老實人不問、倉庫空了也不問', r.pilfer);
  ok(r.pilfer.untouched && r.pilfer.take.res && r.pilfer.take.tools === 1 && r.pilfer.take.sec === 1 && r.pilfer.take.mood > 0, L + '公家的東西：每天的流程不再擲骰；本人決定硬來，工具少一件、真相頁記著是他', r.pilfer.take);
  ok(r.pilfer.foeIds.join() === 'no,take,blame' && r.pilfer.sc.blM > r.pilfer.sc.tkM && r.pilfer.sc.blN < r.pilfer.sc.tkN, L + '公家的東西：有仇人才多一個「推給他」；心眼壞的人比較想推、沒什麼惡意的人寧可裝作不知道', { ids: r.pilfer.foeIds, sc: r.pilfer.sc });
  ok(r.pilfer.blame.res && r.pilfer.blame.sec === 1 && r.pilfer.blame.wrong && r.pilfer.blame.blamed, L + '公家的東西：推給仇人，對方被冤枉、記下一筆恩怨', r.pilfer.blame);
  ok(r.pilfer.eat.food === true && r.pilfer.eat.n === 8, L + '公家的東西：貪吃的人拿的是糧食（少 8 份）', r.pilfer.eat);
  ok(r.pilfer.dice, L + '公家的東西：沒有決策核心時照舊擲骰', r.pilfer.dice);
  // 善意的謊
  ok(r.comfort.ctx && r.comfort.ids.join() === 'leave,sit,lie' && !r.comfort.notKind && !r.comfort.fine, L + '朋友心情很差：只問心軟或浪漫、而且真的有朋友心情很差的人；可以不打擾、陪他坐、說善意的謊', r.comfort);
  ok(r.comfort.sc.lieR > r.comfort.sc.lieK && r.comfort.sc.sitK > r.comfort.sc.sitR, L + '朋友心情很差：浪漫的人比較會說善意的謊，正直的人寧可陪著不說假話', r.comfort.sc);
  ok(r.comfort.untouched && r.comfort.run.sit && r.comfort.run.m1 === 2 && r.comfort.run.s1 === 0 && r.comfort.run.lie && r.comfort.run.m2 === 4 && r.comfort.run.s2 === 1, L + '朋友心情很差：每天的流程不再擲骰；陪他坐不算說謊，說善意的謊才記進真相頁', r.comfort.run);
  ok(r.comfort.dice, L + '朋友心情很差：沒有決策核心時照舊擲骰', r.comfort.dice);
  // 選戰
  ok(r.dirty.honestIds.join() === 'clean,hollow' && !r.dirty.other && !r.dirty.kind && r.dirty.meanIds.join() === `clean,smear:${r.dirty.meanIds[1]?.split(':')[1]},hollow`, L + '選戰：只問候選人；很老實的人不問、普通人只想過開支票、心眼壞的才想過抹黑', r.dirty);
  ok(r.dirty.richIds.includes('buy') && r.dirty.richIds.includes('press') && !r.dirty.buyPoor, L + '選戰：手上有錢才買得了票、收買得了報社', r.dirty.richIds);
  ok(r.dirty.sc.smM > r.dirty.sc.smG && r.dirty.sc.byM > r.dirty.sc.byG, L + '選戰：越有惡意越想抹黑、越不老實越想買票', r.dirty.sc);
  ok(r.dirty.untouched, L + '選戰：每天的流程不再擲骰替候選人抹黑、買票、收買報社', r.dirty.untouched);
  ok(r.dirty.smear.res && r.dirty.smear.sec === 1 && r.dirty.smear.drop === -12 && r.dirty.hollow.res && r.dirty.hollow.sec === 1 && r.dirty.hollow.up === 9, L + '選戰：本人決定抹黑（三個選民對對手印象變差）、開支票（三個選民對他印象變好），真相頁都記著', { smear: r.dirty.smear, hollow: r.dirty.hollow });
  ok(r.dirty.buy.res && r.dirty.buy.paid === 20 && r.dirty.buy.got === 2 && r.dirty.buy.sec === 2 && r.dirty.buy.cons, L + '選戰：本人決定買票，兩個手頭緊的人各拿 10 銀幣、銀幣守恆', r.dirty.buy);
  ok(r.dirty.refuse.res && r.dirty.refuse.paid === 0 && !r.dirty.refuse.by && r.dirty.refuse.cons && r.dirty.refuse.still, L + '選戰：有原則的記者不收錢（錢沒動，之後還可以再試）', r.dirty.refuse);
  ok(r.dirty.press.res && r.dirty.press.paid === 60 && r.dirty.press.ed === 60 && r.dirty.press.by && r.dirty.press.sec === 1 && r.dirty.press.cons && !r.dirty.press.again, L + '選戰：本人決定收買報社，60 銀幣進記者口袋、銀幣守恆；一次選舉只買得了一家', r.dirty.press);
  ok(r.dirty.dice.smear && r.dirty.dice.buy && r.dirty.dice.press && !r.dirty.over, L + '選戰：沒有決策核心時照舊擲骰；競選期過了就不問', { dice: r.dirty.dice, over: r.dirty.over });
  // 傳話
  ok(r.tattle.queued && r.tattle.noConfront && r.tattle.ids?.join() === 'keep,tell' && r.tattle.line && r.tattle.stranger === 0, L + '聽到壞話：替朋友說話的人當下被問要不要去告訴他（不再擲骰）；跟被講的人不熟就沒有這件事', r.tattle);
  ok(r.tattle.sc && r.tattle.sc.tell > r.tattle.sc.tellLow, L + '聽到壞話：跟被講的人交情越深越想去說', r.tattle.sc);
  ok(r.tattle.run?.res && r.tattle.run.wrong && r.tattle.run.drop === -12 && r.tattle.flow === 1, L + '聽到壞話：本人決定去說，當事人去對質、記下一筆恩怨；講壞話的當下就接到決策流程', { run: r.tattle.run, flow: r.tattle.flow });
  ok(r.tattle.dice, L + '聽到壞話：沒有決策核心時照舊擲骰', r.tattle.dice);
  // 做生意
  ok(r.trade.ctx && r.trade.ids.join() === 'fair,short' && !r.trade.honest && !r.trade.notSeller && !r.trade.def, L + '做生意的手法：只問不夠老實的賣家；還沒拿過主意的算老實做生意', r.trade);
  ok(r.trade.sc.sh > r.trade.sc.shN && r.trade.set.k === 'short' && r.trade.set.on && r.trade.set.cur === 'short', L + '做生意的手法：貪心的比較想動手腳；定下來就記著', { sc: r.trade.sc, set: r.trade.set });
  ok(r.trade.short.cheat === 1 && r.trade.short.gain >= 3 && r.trade.short.cons && r.trade.short.mis === 0, L + '做生意的手法：決定動手腳的賣家，買賣糾紛就是真的坑人（不擲骰），坑到的 3 銀幣從客人口袋到他口袋、銀幣守恆', r.trade.short);
  ok(r.trade.fairSet === 'fair' && r.trade.fairRun.cheat === 0 && r.trade.fairRun.mis === 1 && r.trade.fairRun.cons, L + '做生意的手法：改回老實做生意，吵起來就只是誤會', r.trade.fairRun);
  ok(r.trade.dice, L + '做生意的手法：沒有決策核心時照舊擲骰', r.trade.dice);
  // 掌櫃
  ok(r.skim.amt === 16 && r.skim.ids.join() === 'clean,skim' && !r.skim.notMgr && !r.skim.plain, L + '掌櫃的帳：只問貪心的掌櫃，撈得到的是這家店營收的 8%', r.skim);
  ok(r.skim.sc.sFriend < r.skim.sc.s0, L + '掌櫃的帳：跟東家交情好的比較不想動', r.skim.sc);
  ok(r.skim.run.res && r.skim.run.a === 16 && r.skim.run.b === 16 && r.skim.run.n === 1 && r.skim.run.still && r.skim.run.cons, L + '掌櫃的帳：本人決定挪錢，東家少 16、他多 16、銀幣守恆', r.skim.run);
  ok(r.skim.caught.n === 1 && r.skim.caught.fired && r.skim.caught.drop === -20 && !r.skim.caught.after, L + '掌櫃的帳：被查到當場丟差事（會不會被查到仍然是運氣）', r.skim.caught);
  ok(r.skim.weekly.n === 0 && r.skim.weekly.mgr && r.skim.dice.n === 1, L + '掌櫃的帳：每週的流程不再擲骰；沒有決策核心時照舊擲骰', { weekly: r.skim.weekly, dice: r.skim.dice });
  // 奉獻箱
  ok(r.emb.fund === 100 && r.emb.n === 30 && r.emb.ids.join() === 'clean,take' && !r.emb.lay && !r.emb.ascetic && !r.emb.small, L + '奉獻箱：只問管錢的神職；苦行的人不問、基金不到 40 也不問', r.emb);
  ok(r.emb.sc.tG > r.emb.sc.tK + 0.5, L + '奉獻箱：貪心的比較想拿、心軟老實的很不想', r.emb.sc);
  ok(r.emb.untouched && r.emb.run.res && r.emb.run.fund === 70 && r.emb.run.got === 30 && r.emb.run.sec === 1 && r.emb.run.cons, L + '奉獻箱：每天的流程不再擲骰；本人決定拿，基金少 30、他多 30、銀幣守恆', r.emb.run);
  ok(r.emb.dice, L + '奉獻箱：沒有決策核心時照舊擲骰', r.emb.dice);
  // 說一套做一套
  ok(r.two.asked === 1 && r.two.q === 0 && r.two.ids.join() === 'keep,break' && !r.two.cal && r.two.honest === 0, L + '自己贊成的規定：通過的當下問投了贊成、守起來不方便的人（不再擲骰）；疫情規定另外算', r.two);
  ok(r.two.sc.law > r.two.sc.pol && r.two.sc.lawK < r.two.sc.law, L + '自己贊成的規定：真的有限制的法律比一般政令更多人想私下不守；老實的人比較會守', r.two.sc);
  ok(r.two.run.res && r.two.run.hyp && r.two.dice, L + '自己贊成的規定：本人決定私下不守，真相頁記著；沒有決策核心時照舊擲骰', { run: r.two.run, dice: r.two.dice });
  // 疫情
  ok(!r.sneak.err && !r.sneak.none && r.sneak.info.k === 'close' && r.sneak.info.p === 0.25 && r.sneak.info.tired && r.sneak.ids.join() === 'obey,sneak' && !r.sneak.careful && r.sneak.mild, L + '疫情的規定：有規定才問；幾乎沒動過念頭的人（悲觀小心）不問', r.sneak);
  ok(r.sneak.sc.a > r.sneak.sc.c, L + '疫情的規定：愛熱鬧又懶散的酒館常客比一般人想溜', r.sneak.sc);
  ok(r.sneak.untouched && r.sneak.plan.res && r.sneak.plan.go && r.sneak.plan.notYet && !r.sneak.plan.again, L + '疫情的規定：每天的流程不再擲骰；本人決定要溜，先記著', r.sneak.plan);
  ok(r.sneak.run.brk && r.sneak.run.n === 1 && r.sneak.run.gone && r.sneak.run.hyp && r.sneak.run.others === 1 && r.sneak.save, L + '疫情的規定：隔天真的溜出去（只有他）；當初投贊成的記成說一套做一套；存讀檔記得', r.sneak.run);
  ok(r.sneak.dice > 0, L + '疫情的規定：沒有決策核心時照舊擲骰', r.sneak.dice);
  // 流程
  ok(r.rule.kind === 'trade' && r.rule.id === 'short' && r.rule.ai === 0 && r.rule.on, L + '接到每天的決策流程：AI 沒開時照個性決定（貪心又不老實的賣家選動手腳）', r.rule);
  ok(r.ai.id === 'take' && r.ai.ai === 1 && r.ai.why === 'W-EMB' && r.ai.fund === 70 && r.ai.plan === 'N-NEXT' && r.ai.menu && r.ai.money, L + 'AI 版：由 AI 決定拿奉獻箱的錢並說理由', r.ai);
  ok(r.aiTat.id === 'tell' && r.aiTat.ai === 1 && r.aiTat.why === 'W-TAT' && r.aiTat.asked === 1 && r.aiTat.confront, L + 'AI 版：聽到壞話的當下就問 AI 要不要去告訴當事人', r.aiTat);
  if (!zh) ok(!r.ai.cjk, L + '英文版給 AI 的資料沒有中文', r.ai.bits);
  ok(r.save.trade, L + '存讀檔：做生意的手法還在', r.save);
  ok(!r.days.err && r.days.q === 0, L + '競選期間照常跑八天沒有錯誤', r.days);
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
