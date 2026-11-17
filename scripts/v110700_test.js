// v11.7.0 災難裡的人：疫情、喪屍危機、末日災厄、災後反應裡，每個人怎麼做由本人決定（選擇點登記在 sim-decide-calam.js）
//   A) 疫情：怕的人待不待在家、送不送飯、打不打疫苗（排隊上限）、賣不賣假藥與買不買、退不退錢、道不道歉、認不認錯、有錢人走不走
//   B) 喪屍：被咬的人去不去診所、家人瞞不瞞（瞞著的兩天後在家裡變喪屍）、獵人下不下手、家人擋不擋
//   C) 末日：將至時有錢人走不走、帶誰走、花錢買避難位子（錢進公庫，死的時候排在後面）；大災之後誰走；一個人一場最多問兩次
//   D) 災後反應接進決策核心：選項就是原本那十種反應，傾向分數是原本的分數乘 1.5，結算照原本
//   共同：登記、用 calam 那一組額度、事實裡的數字和交情對得上、交情與個性改變傾向、問不到的人（決策核心沒開）走舊機率、
//         一個人不會被重複問、存讀檔（含災難進行到一半、舊存檔）、開 AI 時題目送出、回答被採用、英文題目沒有中文、整場疫情與整場喪屍危機跑完沒有錯誤、錢守恆
// 用法：BASE=http://localhost:8181/ node scripts/v110700_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8181/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['calStay', 'calFood', 'calVax', 'calPanSell', 'calPanBuy', 'calRefund', 'calSorry', 'calStub', 'calFlee', 'zbBit', 'zbHide', 'zbHunt', 'zbGuard', 'crisis'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Decide\]|\[PlagueWays\]|\[Calamity\]|\[WorldCal\]|\[Aftermath\]/.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 200)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async (KEYS) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 77 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); out.on = DECIDE.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && a.currentLocation !== 'exploration');
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X0 = DECIDE.S(w); const KK = DECIDE.KINDS; const texts = []; const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const marry = (a, b) => { a.relationships.getOrCreate(b.agentId, b.name).status = 'married'; b.relationships.getOrCreate(a.agentId, a.name).status = 'married'; };
    const unmarry = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married') { r.status = 'friend'; const o = w.agents[r.targetId]; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) r2.status = 'friend'; } a._parentNames = []; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
    // 照個性、不加當天的心情起伏：最高分的那一項
    const pick = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    const marg = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id).split(':')[0] === id); if (!me) return null; const others = ops.filter(o => o !== me).map(o => DECIDE.score(Ln, o)); return r3(DECIDE.score(Ln, me) - Math.max(...others)); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id).split(':')[0] === id);
    const setJob = (a, k) => { try { a.job = new Job(k); } catch (e) {} }; // 用遊戲本身的 Job（假的物件少了技能清單，之後每天的流程會出錯）
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    out.pop = npcs().length;

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup, kind: KK[k].aiKind, title: t(KK[k].title) } : { k, missing: 1 }); out.group = DECIDE.AI_GROUP.calam;
    for (const k of KEYS) if (KK[k]) texts.push(t(KK[k].title));

    // ============ A) 疫情 ============
    const PW = PLAGUEWAYS; const C = CALAMITY;
    w.calamity = null; C.S(w); const pool = adults().filter(a => a.job?.key !== 'doctor');
    const zero = pool[0]; const rel = C.release(w, { route: ['droplet', 'contact'], sym: ['cough'], speed: 'mid', lethal: 'low', length: 'long', latency: 'mid' }, zero.agentId, { natural: 1 }); const X = w.calamity.cur; out.rel = rel.ok;
    const sick = (a, n = 6) => { X.st[a.agentId] = { s: 'I', d: day() - 2, on: day() - 2, end: day() + n }; };
    const heal = (a) => { delete X.st[a.agentId]; };
    X.found = day() - 3; X.phase = 'panic'; X.died = 2; const P0 = PW.P(X);
    // A1 怕的人待不待在家
    const A1 = {}; { const a = pool[1], sp = pool[2], b = pool[3]; for (const x of [a, sp, b]) { heal(x); plain(x); unmarry(x); } marry(a, sp); a.personality.traits = ['pessimist']; sick(sp); setCash(a, 12); if (!a.job || a.job.key === 'mayor') setJob(a, 'farmer');
      for (const x of pool.slice(4, 8)) sick(x); const I = PW.stayInfo(w, a); const f = KK.calStay.facts(w, a, { d: day() }); texts.push(f);
      const nI = Object.values(X.st).filter(x => x.s === 'I').length;
      A1.facts = { sick: f.includes(String(nI)), died: f.includes('2'), fam: f.includes(t(sp.name)) || f.includes(sp.name), cash: f.includes('12'), wage: f.includes(t('你身上只有 {c} 銀幣，沒什麼積蓄，幾天不上工就沒飯吃。').split('{c}')[1].slice(0, 6)) };
      A1.ids0 = ids(KK.calStay, a, { d: day() }); for (const o of KK.calStay.options(w, a, { d: day() })) texts.push(tx(o.text), tx(o.say), tx(o.why));
      heal(sp); A1.ids1 = ids(KK.calStay, a, { d: day() }); // 家人沒病、沒在家：可以帶家人一起躲
      const c0 = P0.stay; const r1 = opOf(KK.calStay, a, { d: day() }, 'fam').run(w, a, { d: day() }); A1.fam = { home: P0.home[a.agentId] > day() && P0.home[sp.agentId] > day(), n: P0.stay - c0, absent: WAYS.ABSENT.some(f2 => f2(w, a)), res: tx(r1) };
      delete P0.home[a.agentId]; delete P0.home[sp.agentId]; opOf(KK.calStay, b, { d: day() }, 'stay')?.run(w, b, { d: day() }); A1.solo = { b: P0.home[b.agentId] > day(), sp: !(P0.home[sp.agentId] > day()) }; delete P0.home[b.agentId];
      // 傾向：怕的、家裡死過人的偏躲；靠工錢過活、勤快的偏出門
      setCash(a, 300); a.personality.traits = ['pessimist', 'neurotic']; (X.bereaved = X.bereaved || []).push(a.agentId); const pScared = pick(KK.calStay, a, { d: day() });
      X.bereaved = X.bereaved.filter(id => id !== a.agentId); setCash(a, 5); a.personality.traits = ['pessimist', 'hardworking', 'optimist']; const pBrave = pick(KK.calStay, a, { d: day() });
      A1.lean = { scared: pScared, brave: pBrave };
      // 誰會被問：只有怕的人（悲觀、老人、家裡死過人），一天最多八個，四天內不再問
      for (const x of adults()) { delete P0.home[x.agentId]; } for (const k of Object.keys(P0.ask)) delete P0.ask[k];
      const n0 = asked.length; PW._t.stayDaily(w, X, day()); const got = asked.slice(n0).filter(e => e.kind === 'calStay'); const okWho = got.every(e => { const x = w.agents[e.who]; return (x.personality.traits || []).includes('pessimist') || (x.age ?? 30) >= 60 || (X.bereaved || []).includes(x.agentId); });
      const n1 = asked.length; PW._t.stayDaily(w, X, day()); const again = asked.slice(n1).filter(e => e.kind === 'calStay' && got.some(g => g.who === e.who)).length;
      A1.ask = { n: got.length, okWho, max8: got.length <= 8, again, distinct: new Set(got.map(e => e.who)).size === got.length };
      // 決策核心沒開：照舊每天擲骰
      for (const x of adults()) delete P0.home[x.agentId]; const n2 = asked.length; Math.random = () => 0.01; try { offDecide(() => PW._t.stayDaily(w, X, day() + 1)); } finally { Math.random = R0; } A1.off = { asked: asked.length - n2, home: Object.keys(P0.home).length };
      for (const x of adults()) delete P0.home[x.agentId]; heal(sp); for (const x of pool.slice(4, 8)) heal(x); }
    out.A1 = A1;

    // A2 送飯
    const A2 = {}; { const s = pool[9], b = pool[10], c = pool[11], e = pool[12]; for (const x of [s, b, c, e]) { plain(x); unmarry(x); heal(x); delete P0.home[x.agentId]; } for (const x of adults()) if (x !== b) { setAff(x, s, 0); } setAff(b, s, 70); setAff(s, b, 40); setAff(b, c, 50); setAff(c, s, 10);
      sick(s); for (const k of Object.keys(P0.ask)) delete P0.ask[k]; P0.feed = {}; const n0 = asked.length; Math.random = () => 0.3; try { PW._t.foodDaily(w, X, day()); } finally { Math.random = R0; }
      const a0 = asked.slice(n0).find(e => e.kind === 'calFood' && e.ctx?.s === s.agentId); A2.thought = { asked: !!a0, who: a0?.who === b.agentId };
      // 事實與選項只看，結算另外測（剛剛那一題已經照個性決定了，先清掉）
      P0.feed = {}; const ctx = { s: s.agentId, d: day() }; const f = KK.calFood.facts(w, b, ctx); texts.push(f);
      A2.facts = { name: f.includes(t(s.name)) || f.includes(s.name), days: f.includes('3'), tie: f.includes(t('感情很好')), died: f.includes('2') };
      A2.ids = ids(KK.calFood, b, ctx); for (const o of KK.calFood.options(w, b, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      setAff(b, s, -40); A2.idsCold = ids(KK.calFood, b, ctx); setAff(b, s, 70);
      // 送：病人欠一份人情、好感上升，接下來兩天自動送
      const f0 = P0.food, af0 = s.relationships.relationships[b.agentId].affinity; opOf(KK.calFood, b, ctx, 'give').run(w, b, ctx);
      A2.give = { fed: P0.food - f0, feed: P0.feed[s.agentId]?.by === b.agentId, owe: !!(WAYS.S(w).owe?.[s.agentId]?.[b.agentId]), aff: s.relationships.relationships[b.agentId].affinity > af0, again: KK.calFood.options(w, b, ctx).length };
      const f1 = P0.food; PW._t.foodDaily(w, X, day() + 1); A2.give.next = P0.food - f1; PW._t.foodDaily(w, X, day() + 3); A2.give.stop = !P0.feed[s.agentId];
      // 不敢去：病人記得
      P0.feed = {}; const af1 = s.relationships.relationships[b.agentId].affinity; opOf(KK.calFood, b, ctx, 'afraid').run(w, b, ctx); A2.afraid = { aff: s.relationships.relationships[b.agentId].affinity < af1, mem: (s.memory.entries || []).some(m => /一次都沒來過|never came once/.test(m.content || (m.k ? Memory.render(m.k, m.p || {}) : ''))) };
      // 託別人送：被託的人被問（題目裡寫著誰託的）
      const n1 = asked.length; opOf(KK.calFood, b, ctx, 'pass').run(w, b, ctx); const pa = asked.slice(n1).find(e => e.kind === 'calFood'); P0.feed = {}; A2.pass = { who: pa?.who === c.agentId, via: pa?.ctx?.via === b.agentId, factsVia: pa ? KK.calFood.facts(w, c, pa.ctx).includes(t(b.name)) || KK.calFood.facts(w, c, pa.ctx).includes(b.name) : false, noPass: pa ? !ids(KK.calFood, c, pa.ctx).includes('pass') : false };
      P0.feed = {};
      // 傾向：心腸好又很親的送；悲觀、跟他不熟的不敢
      b.personality.traits = ['kind']; b.personality.values = ['社群']; setAff(b, s, 80); X.ms.quar = day(); const pKind = pick(KK.calFood, b, ctx); const mKind = marg(KK.calFood, b, ctx, 'give'); plain(b); b.personality.traits = ['pessimist', 'neurotic']; setAff(b, s, 25); const pScared = pick(KK.calFood, b, ctx); const mScared = marg(KK.calFood, b, ctx, 'give'); delete X.ms.quar; A2.lean = { kind: pKind, scared: pScared, mKind, mScared };
      // 沒開：照舊
      for (const k of Object.keys(P0.ask)) delete P0.ask[k]; plain(b); setAff(b, s, 70); const n2 = asked.length; const f2 = P0.food; Math.random = () => 0.01; try { offDecide(() => PW._t.foodDaily(w, X, day())); } finally { Math.random = R0; } A2.off = { asked: asked.length - n2, fed: P0.food - f2 };
      P0.feed = {}; heal(s); }
    out.A2 = A2;

    // A3 疫苗：去打／再等等／不打；醫生一天打得完的人數照舊，想打的排隊
    const A3 = {}; { X.vax = { p: 100, need: 100, done: day() - 1 }; X.vx = {}; X.vq = []; X.va = {}; const all = npcs(); for (const a of all) heal(a);
      const elig = all.filter(a => !X.st[a.agentId]).length; const cap = Math.max(1, Math.round(elig * 0.3)); const n0 = asked.length; const d0 = day();
      PW._t.vaxDaily(w, X, d0); const got = asked.slice(n0).filter(e => e.kind === 'calVax'); const shots1 = Object.keys(X.vx).length;
      A3.day1 = { asked: got.length, cap, max: got.length <= cap + 5, shots: shots1, capOk: shots1 <= cap, queue: X.vq.length, distinct: new Set(got.map(e => e.who)).size === got.length };
      const n1 = asked.length; PW._t.vaxDaily(w, X, d0); A3.sameDay = asked.slice(n1).filter(e => e.kind === 'calVax' && got.some(g => g.who === e.who)).length; // 同一天不會再問同一個人
      // 事實：疫苗、已經打了幾個、排隊、上限、家人
      const a = all.find(x => (x.age ?? 30) >= 18 && !X.vx[x.agentId] && !X.vq.includes(x.agentId) && x.job?.key !== 'doctor') || all.find(x => (x.age ?? 30) >= 18 && x.job?.key !== 'doctor'); delete X.vx[a.agentId]; X.vq = X.vq.filter(id => id !== a.agentId); X.va[a.agentId] = { n: 1, at: d0 }; plain(a);
      const f = KK.calVax.facts(w, a, { d: d0 }); texts.push(f); const v = Object.keys(X.vx).length; A3.facts = { shots: f.includes(String(v)), cap: f.includes(String(PW.vaxInfo(w, a).cap)), queue: f.includes(String(X.vq.length)) };
      A3.ids = ids(KK.calVax, a, { d: d0 }); for (const o of KK.calVax.options(w, a, { d: d0 })) texts.push(tx(o.text), tx(o.say), tx(o.why));
      // 傾向：很虔誠的、不信醫生的偏不打；家裡死過人的偏去打
      const F0 = { relOf: FAITH.relOf, pietyOf: FAITH.pietyOf }; FAITH.relOf = () => 'x'; FAITH.pietyOf = () => 85; const wf = w.faith; w.faith = w.faith || {};
      let pDevout; try { pDevout = marg(KK.calVax, a, { d: d0 }, 'no'); } finally { FAITH.relOf = F0.relOf; FAITH.pietyOf = F0.pietyOf; w.faith = wf; }
      const doc = npcs().find(x => x.job?.key === 'doctor'); let pDistrust = null; if (doc) { setAff(a, doc, -40); a.personality.values = ['自由']; pDistrust = marg(KK.calVax, a, { d: d0 }, 'go'); setAff(a, doc, 0); plain(a); }
      (X.bereaved = X.bereaved || []).push(a.agentId); const pLost = marg(KK.calVax, a, { d: d0 }, 'go'); X.bereaved = X.bereaved.filter(id => id !== a.agentId); const pPlain = pick(KK.calVax, a, { d: d0 }); const mNo = marg(KK.calVax, a, { d: d0 }, 'no'), mGo = marg(KK.calVax, a, { d: d0 }, 'go');
      A3.lean = { devout: pDevout, distrust: pDistrust, lost: pLost, plain: pPlain, mNo, mGo };
      // 再等等：三天後再問，最多問三次；不打的不再問
      opOf(KK.calVax, a, { d: d0 }, 'wait').run(w, a, { d: d0 }); A3.wait = { at: X.va[a.agentId].at === d0 + 3 }; X.va[a.agentId].n = 3; A3.wait.lastNoWait = !ids(KK.calVax, a, { d: d0 }).includes('wait');
      const b = all.find(x => x !== a && (x.age ?? 30) >= 18 && !X.vx[x.agentId] && !X.vq.includes(x.agentId)); if (b) { X.va[b.agentId] = { n: 1, at: d0 }; opOf(KK.calVax, b, { d: d0 }, 'no').run(w, b, { d: d0 }); const n2 = asked.length; PW._t.vaxDaily(w, X, d0 + 5); A3.no = { never: !asked.slice(n2).some(e => e.who === b.agentId), notShot: !X.vx[b.agentId] }; }
      // 去打：排進隊伍，孩子一起
      const go = opOf(KK.calVax, a, { d: d0 }, 'go'); X.va[a.agentId].n = 1; go.run(w, a, { d: d0 }); A3.go = { queued: X.vq.includes(a.agentId) };
      // 排隊上限：想打的人比醫生打得完的多，一天只打得完 cap 個
      X.vx = {}; X.vq = all.filter(x => !X.st[x.agentId]).map(x => x.agentId); X.va = {}; for (const x of all) X.va[x.agentId] = { n: 1, at: null }; const capN = Math.max(1, Math.round(all.filter(x => !X.st[x.agentId]).length * 0.3)); PW._t.vaxDaily(w, X, d0 + 6); A3.queueCap = { shots: Object.keys(X.vx).length, cap: capN, left: X.vq.length };
      // 沒開：疫苗那一段不歸本人決定，sim-calamity.js 照原本每天三成
      A3.off = offDecide(() => C.H.vax(w, X, d0 + 7)) === false; A3.on = C.H.vax(w, X, d0 + 7) === true;
      X.vax = null; X.vx = {}; X.vq = []; X.va = {}; }
    out.A3 = A3;

    // A4 萬靈藥：有動機的人自己決定賣不賣，買的人自己決定買不買；錢只在人之間移動
    const A4 = {}; { X.phase = 'panic'; P0.pan = null; const s = pool[14]; plain(s); s.personality.traits = ['greedy', 'charismatic', 'gossip', 'lazy']; setCash(s, 60); heal(s); for (const k of Object.keys(P0.ask)) delete P0.ask[k]; w.calamity.sold = []; w.calamity.burned = [];
      const others = adults().filter(x => x !== s); for (const x of others) { if ((x.personality.traits || []).includes('greedy')) x.personality.traits = x.personality.traits.filter(t2 => t2 !== 'greedy'); }
      const n0 = asked.length; PW._t.panaceaDaily(w, X, day()); const sa = asked.slice(n0).filter(e => e.kind === 'calPanSell'); A4.seller = { n: sa.length, who: sa[0]?.who === s.agentId };
      P0.pan = null; const f = KK.calPanSell.facts(w, s, { d: day() }); texts.push(f); A4.sellIds = ids(KK.calPanSell, s, { d: day() }); for (const o of KK.calPanSell.options(w, s, { d: day() })) texts.push(tx(o.text), tx(o.say), tx(o.why));
      A4.leanSell = { greedy: marg(KK.calPanSell, s, { d: day() }, 'sell') }; s.personality.traits = ['kind']; A4.leanSell.kind = marg(KK.calPanSell, s, { d: day() }, 'sell'); s.personality.traits = ['greedy'];
      // 擺攤：最可能買的八個人被問，買的人把錢付給賣的人
      const buyers = others.slice(0, 12); for (const b of buyers) { setCash(b, 60); plain(b); } buyers[0].personality.traits = ['pessimist']; buyers[0].age = 70; setAff(buyers[0], s, 40);
      const n1 = asked.length; setCash(s, 60); const L = leak(() => opOf(KK.calPanSell, s, { d: day() }, 'sell').run(w, s, { d: day() })); const ba = asked.slice(n1).filter(e => e.kind === 'calPanBuy');
      const pn = P0.pan; A4.open = { pan: !!pn, open: pn?.open, asked: ba.length, max8: ba.length <= 8, bought: pn?.b.length, sum: pn?.sum, leak: L.leak, sellerGot: r3(cash(s) - 60) === pn?.sum };
      for (const b of others.filter(x => !P0.pan.b.some(([id]) => id === x.agentId) && cash(x) >= 25).slice(0, 2)) PW.panBuy(w, b, { s: s.agentId, d: day() }); // 確定有兩個人買（隔天才收得了攤、才拆穿得了）
      const bf = ba[0] ? KK.calPanBuy.facts(w, w.agents[ba[0].who], ba[0].ctx) : ''; texts.push(bf);
      // 傾向：怕的老人偏買，看重知識的不買
      const bctx = { s: s.agentId, d: day() }; const bq = others.find(x => !pn.b.some(([id]) => id === x.agentId) && cash(x) >= 20); if (bq) { plain(bq); bq.personality.traits = ['pessimist', 'neurotic']; bq.age = 66; (X.bereaved = X.bereaved || []).push(bq.agentId); A4.leanBuy = { scared: marg(KK.calPanBuy, bq, bctx, 'buy') }; X.bereaved = X.bereaved.filter(id => id !== bq.agentId); plain(bq); bq.age = 30; bq.personality.values = ['知識']; A4.leanBuy.wise = marg(KK.calPanBuy, bq, bctx, 'buy'); plain(bq); for (const o of KK.calPanBuy.options(w, bq, bctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); }
      // 隔天收攤：買的人夠多就照原本記一筆
      const lg0 = logs().length; PW._t.panaceaDaily(w, X, day() + 1); A4.close = { open: P0.pan?.open, kept: !!P0.pan, log: logs().slice(lg0).some(x => /掏錢買了|paid for it|bought/.test(x)) };
      // 被拆穿：問賣的人退不退錢
      if (P0.pan && P0.pan.b.length) { const hit = w.agents[P0.pan.b[0][0]]; sick(hit); const n2 = asked.length; PW._t.panaceaCheck(w, X, day() + 2, false); const ra = asked.slice(n2).find(e => e.kind === 'calRefund');
        A4.exposed = { exp: P0.pan.exp > 0, asked: ra?.who === s.agentId }; if (ra) { const rf = KK.calRefund.facts(w, s, ra.ctx); texts.push(rf); A4.refundIds = ids(KK.calRefund, s, ra.ctx); for (const o of KK.calRefund.options(w, s, ra.ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
          const paid = ra.ctx.b.reduce((x, y) => x + y[1], 0); setCash(s, 300); const c0 = cash(s); const L2 = leak(() => opOf(KK.calRefund, s, ra.ctx, 'all').run(w, s, ra.ctx)); A4.refund = { back: r3(c0 - cash(s)), paid, leak: L2.leak };
          setCash(s, 100); const c1 = cash(s); const L3 = leak(() => opOf(KK.calRefund, s, ra.ctx, 'half').run(w, s, ra.ctx)); A4.half = { back: r3(c1 - cash(s)), leak: L3.leak };
          const q0 = Object.keys(WAYS.S(w).cold || {}).length; opOf(KK.calRefund, s, ra.ctx, 'no').run(w, s, ra.ctx); A4.no = { quarrel: Object.keys(WAYS.S(w).cold || {}).length >= q0 };
          s.personality.traits = ['kind']; A4.leanRefund = { kind: marg(KK.calRefund, s, ra.ctx, 'all') }; s.personality.traits = ['greedy', 'abrasive']; A4.leanRefund.greedy = marg(KK.calRefund, s, ra.ctx, 'all'); } heal(hit); }
      // 買的人太少：收攤，錢退回去
      P0.pan = null; s.personality.traits = ['greedy']; setCash(s, 60); const fewB = others.slice(0, 1); for (const x of adults()) P0.ask['pn' + x.agentId] = day(); setCash(fewB[0], 50); const L4 = leak(() => { P0.pan = { s: s.agentId, b: [], sum: 0, d: day() - 1, nm: '萬靈藥', steam: 0, exp: 0, open: 1 }; const b0 = fewB[0]; PW.panBuy(w, b0, { s: s.agentId, d: day() }); PW._t.panaceaDaily(w, X, day()); return cash(b0); }); A4.few = { gone: !P0.pan || P0.pan.s !== s.agentId || !P0.pan.open, refunded: L4.ret === 50, leak: L4.leak };
      P0.pan = null; }
    out.A4 = A4;

    // A5 嘴硬與道歉
    const A5 = {}; { const prop = pool[16]; const ag = pool[17]; plain(ag); const pr = { id: 'tp1', kind: 'cal_quar', status: 'rejected', createdDay: X.day, proposerId: prop.agentId, votes: { [ag.agentId]: 'against' } }; (w.proposals.items = w.proposals.items || []).push(pr); P0.deaths = [X.day + 1, X.day + 2, X.day + 3]; delete P0.said.tp1;
      const n0 = asked.length; PW._t.stubDaily(w, X, day()); const sa = asked.slice(n0).find(e => e.kind === 'calStub'); A5.stub = { asked: sa?.who === ag.agentId }; if (sa) { const f = KK.calStub.facts(w, ag, sa.ctx); texts.push(f); A5.stub.facts = f.includes('3'); A5.stub.ids = ids(KK.calStub, ag, sa.ctx); for (const o of KK.calStub.options(w, ag, sa.ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
        ag.personality.traits = ['kind']; A5.stub.kind = pick(KK.calStub, ag, sa.ctx); ag.personality.traits = ['jealous', 'lazy', 'gossip']; A5.stub.liar = pick(KK.calStub, ag, sa.ctx); plain(ag); const a0 = P0.admit; opOf(KK.calStub, ag, sa.ctx, 'admit').run(w, ag, sa.ctx); A5.stub.admit = P0.admit - a0; }
      w.proposals.items = w.proposals.items.filter(p => p !== pr);
      // 道歉：疫情過去時，怪過他的人（最怪他的一位、怪得最輕的兩位）各自決定
      const sc = pool[18]; X.scape = sc.agentId; const bl = adults().filter(x => x !== sc).slice(0, 6); for (const x of adults()) if (x !== sc) setAff(x, sc, 5); bl.forEach((x, i) => { plain(x); setAff(x, sc, -10 - i * 8); });
      const end = C.H.end.find(fn => String(fn).includes('怪罪與平反') || String(fn).includes('blamers')); const n1 = asked.length; const rec = {}; try { end(w, X, rec); } catch (e) { A5.endErr = String(e.message); }
      const so = asked.slice(n1).filter(e => e.kind === 'calSorry'); A5.sorry = { n: so.length, most: so.some(e => e.who === bl[bl.length - 1].agentId), least: so.some(e => e.who === bl[0].agentId), distinct: new Set(so.map(e => e.who)).size === so.length };
      const ctx = { sc: sc.agentId, n: X.spec.name, d: day() }; const f = KK.calSorry.facts(w, bl[0], ctx); texts.push(f); A5.sorry.facts = f.includes(String(Math.round(bl[0].relationships.relationships[sc.agentId].affinity))); A5.sorry.ids = ids(KK.calSorry, bl[0], ctx); for (const o of KK.calSorry.options(w, bl[0], ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      const af0 = sc.relationships.getOrCreate(bl[0].agentId, bl[0].name).affinity; opOf(KK.calSorry, bl[0], ctx, 'sorry').run(w, bl[0], ctx); A5.sorry.done = sc.relationships.relationships[bl[0].agentId].affinity > af0;
      bl[1].personality.traits = ['kind']; setAff(bl[1], sc, -5); A5.sorry.kind = marg(KK.calSorry, bl[1], ctx, 'sorry'); A5.sorry.kindStill = marg(KK.calSorry, bl[1], ctx, 'still'); bl[1].personality.traits = ['abrasive', 'jealous']; setAff(bl[1], sc, -50); A5.sorry.abrasive = marg(KK.calSorry, bl[1], ctx, 'sorry'); A5.sorry.abStill = marg(KK.calSorry, bl[1], ctx, 'still');
      X.scape = null; for (const x of bl) plain(x); }
    out.A5 = A5;

    // A6 有錢人走不走（恐慌期）
    const A6 = {}; { const rich = adults().slice(20, 26); for (const x of rich) { setCash(x, 500); plain(x); heal(x); } for (const k of Object.keys(P0.ask)) delete P0.ask[k]; const n0 = asked.length; PW._t.fleeAsk(w, X, day(), rich); const fa = asked.slice(n0).filter(e => e.kind === 'calFlee');
      A6.ask = { n: fa.length, max3: fa.length <= 3, rich: fa.every(e => rich.some(x => x.agentId === e.who)) }; const n1 = asked.length; PW._t.fleeAsk(w, X, day(), rich); A6.ask.again = asked.slice(n1).filter(e => e.kind === 'calFlee' && fa.some(g => g.who === e.who)).length;
      const left = rich.filter(x => w.agents[x.agentId] && !fa.some(e => e.who === x.agentId)); const a = left[0]; const ctx = { src: 'plague', t: 'plague', d: day(), q: 0.3 }; const f = KK.calFlee.facts(w, a, ctx); texts.push(f); A6.facts = f.includes(String(Math.floor(cash(a)))); A6.f = f.slice(0, 160); A6.ids = ids(KK.calFlee, a, ctx); for (const o of KK.calFlee.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      const fl0 = X.fled; const L = leak(() => opOf(KK.calFlee, a, ctx, 'go').run(w, a, ctx)); A6.go = { gone: !w.agents[a.agentId], fled: X.fled - fl0 };
      const b = left[1]; b.personality.traits = ['pessimist', 'neurotic']; A6.lean = { scared: marg(KK.calFlee, b, ctx, 'stay') }; b.personality.traits = ['brave']; b.personality.values = ['傳統']; A6.lean.brave = marg(KK.calFlee, b, ctx, 'stay'); plain(b); }
    out.A6 = A6;

    // A7 存讀檔：疫情進行到一半（有人答應送飯、有人在排隊打疫苗）；舊存檔沒有這一版的欄位
    const A7 = {}; { const s = pool[9], b = pool[10]; sick(s); P0.feed = { [s.agentId]: { by: b.agentId, until: day() + 2, last: null } }; X.vax = { p: 100, need: 100, done: day() - 1 }; X.vq = [pool[11].agentId]; X.va = { [pool[11].agentId]: { n: 1, at: null } };
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null; try { w2.loadSave(sv); w2.observerMode = true; } catch (e) { err = String(e.message); }
      const Y = w2.calamity?.cur; A7.save = { err, feed: Y?.pw?.feed?.[s.agentId]?.by === b.agentId, vq: (Y?.vq || []).includes(pool[11].agentId), va: !!Y?.va?.[pool[11].agentId] };
      const sv0 = JSON.parse(JSON.stringify(sv)); const Z = sv0.calamity.cur; delete Z.pw.ask; delete Z.pw.feed; delete Z.vq; delete Z.va; delete Z.pw.foodNo; delete Z.pw.vaxNo; if (sv0.crisis) delete sv0.crisis.aiq;
      const w3 = new World(); let err3 = null; try { w3.loadSave(sv0); w3.observerMode = true; const Y3 = w3.calamity.cur; const d3 = w3._absDay(); PW._t.stayDaily(w3, Y3, d3); PW._t.foodDaily(w3, Y3, d3); PW._t.vaxDaily(w3, Y3, d3); PW._t.panaceaDaily(w3, Y3, d3); AFTERMATH.daily(w3); } catch (e) { err3 = String(e.stack || e.message).slice(0, 200); }
      A7.old = { err: err3, ask: !!w3.calamity?.cur?.pw?.ask, feed: !!w3.calamity?.cur?.pw?.feed }; w2.reset?.(); w3.reset?.(); P0.feed = {}; heal(s); X.vax = null; X.vq = []; X.va = {}; }
    out.A7 = A7;
    w.calamity.cur = null;

    // ============ B) 喪屍 ============
    const WC = WORLDCAL; w.tech = w.tech || {}; TECH.S(w); w.tech.path = 'bio'; w.worldcal = null; WC.S(w); const c = WC.begin(w, 'zombie', 'nature'); c.ph = 'after'; c.pd = day(); c.prog = 40; c.fast = 1;
    const zp = adults(); const zb = c.zb = { ids: [], bit: {}, st: { turned: 0, bitten: 0, killed: 0, hid: 0, cured: 0 } };
    const B1 = {}; { const v = zp[0], f = zp[1], kid = zp[2]; for (const x of [v, f, kid]) { plain(x); unmarry(x); } marry(v, f); setAff(f, v, 70); setAff(v, f, 70); kid._parentNames = [f.name]; kid.age = 10;
      zb.bit[v.agentId] = day(); const ctx = { z: null, d: day() }; const fb = KK.zbBit.facts(w, v, ctx); texts.push(fb); B1.bitFacts = { cure: fb.includes('40'), fam: fb.includes(t(f.name)) || fb.includes(f.name) }; B1.bitIds = ids(KK.zbBit, v, ctx); for (const o of KK.zbBit.options(w, v, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      v.personality.traits = ['brave', 'kind']; B1.bitLean = { brave: marg(KK.zbBit, v, ctx, 'clinic') }; v.personality.traits = ['neurotic']; B1.bitLean.scared = marg(KK.zbBit, v, ctx, 'clinic'); plain(v);
      // 回家：最親的家人被問
      const n0 = asked.length; opOf(KK.zbBit, v, ctx, 'home').run(w, v, ctx); DECIDE.drain(w, X0, day()); const ha = asked.slice(n0).find(e => e.kind === 'zbHide'); B1.home = { asked: ha?.who === f.agentId };
      delete (zb.how || {})[v.agentId]; const hctx = { v: v.agentId, d: day() }; const fh = KK.zbHide.facts(w, f, hctx); texts.push(fh); B1.hideFacts = { name: fh.includes(t(v.name)) || fh.includes(v.name), tie: fh.includes(t('是一家人')), kid: fh.includes(t(kid.name)) || fh.includes(kid.name) }; B1.hideIds = ids(KK.zbHide, f, hctx); for (const o of KK.zbHide.options(w, f, hctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      // 傾向：很親、不信守衛的瞞；守規矩、家裡有小孩的不瞞
      const g = zp.find(x => x.job?.key === 'guard') || zp[5]; if (g.job?.key !== 'guard') setJob(g, 'guard'); setAff(f, g, -40); f.personality.values = ['自由']; kid._parentNames = []; setAff(f, v, 95); B1.hideLean = { close: marg(KK.zbHide, f, hctx, 'hide'), closePick: pick(KK.zbHide, f, hctx) };
      setAff(f, g, 30); f.personality.values = ['傳統']; f.personality.traits = ['perfectionist']; kid._parentNames = [f.name]; setAff(f, v, 30); B1.hideLean.rules = marg(KK.zbHide, f, hctx, 'hide'); B1.hideLean.rulesPick = pick(KK.zbHide, f, hctx); plain(f); setAff(f, v, 70);
      // 瞞著：兩天後在家裡變成喪屍
      const hid0 = zb.st.hid; opOf(KK.zbHide, f, hctx, 'hide').run(w, f, hctx); const hid = zb.st.hid - hid0; zb.bit[v.agentId] = day() - 2; const lg0 = logs().length; const R1 = Math.random; Math.random = () => 0.99; try { WC._t.zombieDaily(w, c); } finally { Math.random = R1; }
      B1.turn = { hid, zombie: zb.ids.includes(v.agentId), log: logs().slice(lg0).some(x => /在自己家裡睜開眼睛|opened their eyes at home/.test(x)), how: !(zb.how || {})[v.agentId] };
      // 去診所
      const v2 = zp[3]; plain(v2); unmarry(v2); marry(v2, zp[4]); zb.bit[v2.agentId] = day(); const iso0 = zb.st.iso || 0; const L = opOf(KK.zbHide, zp[4], { v: v2.agentId, d: day() }, 'clinic').run(w, zp[4], { v: v2.agentId, d: day() }); B1.clinic = { iso: (zb.st.iso || 0) - iso0 === 1, how: zb.how[v2.agentId] === 'iso' };
      delete zb.bit[v2.agentId]; delete zb.how[v2.agentId]; }
    out.B1 = B1;
    // B2 獵人下不下手、家人擋不擋
    const B2 = {}; { const z = zb.ids[0] ? w.agents[zb.ids[0]] : null; const f = zp[1]; const h = zp.slice(11).find(x => x !== f && x.agentId !== z?.agentId && (x.age ?? 30) >= 18 && !WC.kinZ(w, z).includes(x)); plain(h); c.prog = 40; if (h.job?.key !== 'guard') setJob(h, 'guard');
      const ctx = { z: z.agentId, d: day() }; setAff(h, z, 0); const fh = KK.zbHunt.facts(w, h, ctx); texts.push(fh); B2.facts = { name: fh.includes(t(z.name)) || fh.includes(z.name), cure: fh.includes('40'), fam: fh.includes(t(f.name)) || fh.includes(f.name), tie: fh.includes(t('只是普通交情')) };
      B2.ids = ids(KK.zbHunt, h, ctx); for (const o of KK.zbHunt.options(w, h, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      B2.lean = { stranger: pick(KK.zbHunt, h, ctx), mS: marg(KK.zbHunt, h, ctx, 'kill') }; setAff(h, z, 85); B2.lean.friend = pick(KK.zbHunt, h, ctx); B2.lean.mF = marg(KK.zbHunt, h, ctx, 'kill'); setAff(h, z, 0); c.prog = 97; B2.lean.mSoon = marg(KK.zbHunt, h, ctx, 'kill'); c.prog = 40;
      // 動手 → 家人被問
      for (const id of Object.keys(zb.bit)) delete zb.bit[id]; const n1 = asked.length; opOf(KK.zbHunt, h, ctx, 'kill').run(w, h, ctx); DECIDE.drain(w, X0, day()); const ga = asked.slice(n1).find(e => e.kind === 'zbGuard');
      // 剛剛被照個性決定了一次（擋或不擋），換一隻喪屍測結算
      B2.guardAsked = { who: ga?.who === f.agentId };
      const z2 = zp[6]; plain(z2); unmarry(z2); const f2 = zp[7]; plain(f2); unmarry(f2); marry(z2, f2); WC._t.zTurn(w, c, z2, true); const gctx = { z: z2.agentId, h: h.agentId, d: day() }; const fg = KK.zbGuard.facts(w, f2, gctx); texts.push(fg); B2.guardFacts = { h: fg.includes(t(h.name)) || fg.includes(h.name), cure: fg.includes('40') }; B2.guardIds = ids(KK.zbGuard, f2, gctx); for (const o of KK.zbGuard.options(w, f2, gctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      const b0 = zb.st.block || 0; opOf(KK.zbGuard, f2, gctx, 'block').run(w, f2, gctx); B2.block = { alive: zb.ids.includes(z2.agentId) && !z2.isDead, n: (zb.st.block || 0) - b0, aff: (f2.relationships.relationships[h.agentId]?.affinity || 0) < 0 };
      f2.personality.traits = ['brave']; setAff(f2, z2, 90); B2.guardLean = { brave: marg(KK.zbGuard, f2, gctx, 'block') }; f2.personality.traits = ['neurotic']; setAff(f2, z2, 20); B2.guardLean.timid = marg(KK.zbGuard, f2, gctx, 'block'); plain(f2);
      const k0 = zb.st.killed; opOf(KK.zbGuard, f2, gctx, 'away').run(w, f2, gctx); B2.away = { killed: zb.st.killed - k0, dead: !!z2.isDead || !w.agents[z2.agentId] || w.agents[z2.agentId].isDead };
      // 下不了手、趕到墓園：不殺
      const z3 = zp[8]; plain(z3); unmarry(z3); WC._t.zTurn(w, c, z3, true); const k1 = zb.st.killed; opOf(KK.zbHunt, h, { z: z3.agentId, d: day() }, 'cant').run(w, h, { z: z3.agentId, d: day() }); opOf(KK.zbHunt, h, { z: z3.agentId, d: day() }, 'drive').run(w, h, { z: z3.agentId, d: day() }); B2.spare = { alive: zb.ids.includes(z3.agentId), killed: zb.st.killed - k1, spare: zb.st.spare, drive: zb.st.drive };
      // 今天輪不輪到、輪到誰看天；輪到了問那位獵人
      const R1 = Math.random; const n0 = asked.length; Math.random = () => 0.01; try { WC._t.zombieDaily(w, c); } finally { Math.random = R1; } const hu = asked.slice(n0).find(e => e.kind === 'zbHunt'); B2.turn = { asked: !!hu, guard: hu ? (w.agents[hu.who].job?.key === 'guard' || (w.agents[hu.who].personality.traits || []).includes('brave')) : false };
      // 沒開：照舊（家人 50% 擋、40% 瞞）
      const v4 = zp[9], f4 = zp[10]; plain(v4); unmarry(v4); marry(v4, f4); const hid0 = zb.st.hid; const n2 = asked.length; const ppl0 = zb.ids.slice(); const R2 = Math.random; Math.random = () => 0.05; try { offDecide(() => WC._t.zombieDaily(w, c)); } finally { Math.random = R2; } B2.off = { asked: asked.slice(n2).filter(e => /^zb/.test(e.kind)).length, hid: zb.st.hid - hid0 >= 0 }; }
    out.B2 = B2;
    // B3 存讀檔：喪屍危機進行到一半（有人被咬、瞞著）
    { zb.how = zb.how || {}; const vv = adults().find(x => !zb.ids.includes(x.agentId)); zb.bit[vv.agentId] = day(); zb.how[vv.agentId] = 'hide'; c.bunk = { [vv.agentId]: 1 }; c.asked = { [vv.agentId]: 1 };
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null; try { w2.loadSave(sv); w2.observerMode = true; WC._t.zombieDaily(w2, w2.worldcal.cur); } catch (e) { err = String(e.message); } const c2 = w2.worldcal?.cur;
      out.B3 = { err, how: c2?.zb?.how?.[vv.agentId] === 'hide' || (c2?.zb?.ids || []).includes(vv.agentId), bunk: !!c2?.bunk?.[vv.agentId] };
      const sv0 = JSON.parse(JSON.stringify(sv)); delete sv0.worldcal.cur.zb.how; delete sv0.worldcal.cur.bunk; delete sv0.worldcal.cur.asked; delete sv0.worldcal.cur.zb.st.iso; const w3 = new World(); let e3 = null; try { w3.loadSave(sv0); w3.observerMode = true; WC._t.zombieDaily(w3, w3.worldcal.cur); } catch (e) { e3 = String(e.message); } out.B3.old = e3; w2.reset?.(); w3.reset?.(); }
    w.worldcal.cur = null;

    // ============ C) 末日災厄：去留與自保 ============
    const C1 = {}; { const c3 = WC.begin(w, 'nukewar', 'nature'); const rich = adults().slice(0, 40).sort((x, y) => cash(y) - cash(x)); for (const x of rich.slice(0, 5)) { setCash(x, 400); plain(x); x.personality.traits = ['pessimist']; } c3.warn = []; c3.deny = [];
      const n0 = asked.length; WC._t.onEnter(w, c3, 'rumor'); const ea = asked.slice(n0).filter(e => e.kind === 'calFlee'); C1.early = { n: ea.length, max3: ea.length <= 3, t: ea.every(e => e.ctx?.t === 'early') };
      const avail = rich.slice(0, 5).filter(x => w.agents[x.agentId] && !ea.some(e => e.who === x.agentId)); const a = avail[0]; const ctx = { src: 'wc', t: 'early', d: day(), q: 0.4 }; c3.bunk = {}; const f = KK.calFlee.facts(w, a, ctx); texts.push(f); C1.facts = f.includes('400') || f.includes(String(Math.floor(cash(a)))); C1.dbg = { cash: cash(a), kin: WC.kin(w, a).length, bunk: !!c3.bunk[a.agentId], t: c3.kind }; C1.ids = ids(KK.calFlee, a, ctx); for (const o of KK.calFlee.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      // 買避難位子：錢付給公庫，大災死人時排在後面
      const t0 = w.stockpile.get('silver'); const c0 = cash(a); const L = leak(() => opOf(KK.calFlee, a, ctx, 'bunk')?.run(w, a, ctx)); C1.bunk = { paid: r3(c0 - cash(a)), tres: r3(w.stockpile.get('silver') - t0), leak: L.leak, marked: !!c3.bunk[a.agentId] };
      let deadA = 0; for (let i = 0; i < 20; i++) { const n = 8; const killed = []; const _k = w.lifecycle._killNpc; w.lifecycle._killNpc = (w4, x) => killed.push(x); try { WC._t.kill(w, n, 'x'); } finally { w.lifecycle._killNpc = _k; } if (killed.includes(a)) deadA++; } C1.bunk.last = deadA === 0;
      // 帶朋友走（不是家人的人）
      const b = avail[1] || avail[0]; unmarry(b); const fr = adults().find(x => x !== b && !WC.kin(w, b).includes(x) && x !== a); setAff(b, fr, 70); setAff(fr, b, 70); C1.friend = ids(KK.calFlee, b, ctx).includes('friend'); const left0 = c3.left; opOf(KK.calFlee, b, ctx, 'friend')?.run(w, b, ctx); C1.friendGo = { b: !w.agents[b.agentId], fr: !w.agents[fr.agentId], left: c3.left - left0 };
      // 一個人一場最多問兩次
      const q = rich[2]; c3.asked[q.agentId] = 2; const n1 = asked.length; WC._t.goAsk(w, c3, [q], 1, 'after'); C1.cap = asked.slice(n1).filter(e => e.who === q.agentId).length;
      // 大災之後：問 cnt÷0.45 個人，走不走由本人決定；照個性算的當場算進人數
      const top = adults().slice(0, 30); for (const x of top) delete c3.asked[x.agentId]; const n2 = asked.length; const gone = WC._t.goAsk(w, c3, top, 5, 'after'); const ga = asked.slice(n2).filter(e => e.kind === 'calFlee');
      C1.after = { asked: ga.length, want: Math.round(5 / 0.45), gone: gone.length, allAfter: ga.every(e => e.ctx.t === 'after') };
      // 沒開：照舊挑人走
      w.worldcal.cur = null; }
    out.C1 = C1;

    // ============ D) 災後反應 ============
    const D1 = {}; { w.crisis = null; const Cr = AFTERMATH.S(w); const vic = adults().slice(3, 5); const cr = AFTERMATH.shock(w, { kind: 'epidemic', sev: 3, cause: '疫情', who: vic }); const a = adults().find(x => !vic.includes(x)); plain(a);
      const ch = AFTERMATH.choices(w, a, { cr: cr.id, d: day() }); const sc = AFTERMATH.scores(w, a, cr, day()); D1.scale = ch.list.every(x => Math.abs(x.s - Math.round(sc[x.r] * 1.5 * 1000) / 1000) < 1e-6) && Math.abs(ch.none - sc.none * 1.5) < 1e-3;
      const f = KK.crisis.facts(w, a, { cr: cr.id, d: day() }); texts.push(f); D1.facts = f.includes(t('疫情')) && f.includes(String(Math.floor(cash(a))));
      D1.ids = ids(KK.crisis, a, { cr: cr.id, d: day() }); for (const o of KK.crisis.options(w, a, { cr: cr.id, d: day() })) texts.push(tx(o.text), tx(o.say), tx(o.why));
      // 每天：有反應的人被問（壓力大的先），結算照原本（cr.n、做過的事）
      for (const x of adults()) Cr.stress[x.agentId] = 90; Cr.did = {}; Cr.lastDay = null; const n0 = seen.length, a0 = asked.length; AFTERMATH.daily(w); const got = asked.slice(a0).filter(e => e.kind === 'crisis'); const dec = seen.slice(n0).filter(e => e.kind === 'crisis');
      D1.daily = { asked: got.length, decided: dec.length, acted: Object.values(cr.n).reduce((s, v) => s + v, 0), did: Object.keys(Cr.did).length, inLog: dec.filter(e => e.id !== 'none').every(e => (X0.log[e.who] || []).some(L => L.kind === 'crisis')) };
      Cr.lastDay = null; const did0 = Object.keys(Cr.did); const a1 = asked.length; AFTERMATH.daily(w); D1.again = asked.slice(a1).filter(e => e.kind === 'crisis' && did0.includes(e.who)).length; // 兩天內做過的不再問
      // 沒開：照原本自己算
      Cr.lastDay = null; Cr.did = {}; const a2 = asked.length; const s0 = Object.values(cr.n).reduce((s, v) => s + v, 0); offDecide(() => AFTERMATH.daily(w)); D1.off = { asked: asked.length - a2, acted: Object.values(cr.n).reduce((s, v) => s + v, 0) - s0 };
      w.crisis = null; }
    out.D1 = D1;

    // ============ AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; ce._askJson = async (p) => { prompts.push(String(p)); return [{ n: 1, pick: 'stay', why: 'model reason 71', feel: 'fear' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { w.calamity.cur = null; C.release(w, { route: ['droplet'], sym: ['cough'], speed: 'mid', lethal: 'low', length: 'long' }, pool[0].agentId, { natural: 1 }); const X2 = w.calamity.cur; X2.found = day() - 3; X2.phase = 'panic'; X2.died = 1;
        const a = adults().find(x => x !== pool[0] && !X2.st[x.agentId] && PLAGUEWAYS.stayInfo(w, x)); plain(a); a.personality.traits = ['pessimist']; X0._gAsked = { calam: 0 }; X0._kAsked = {}; X0._cDay = day(); X0.lastDay = day();
        const n0 = seen.length; DECIDE.askNow(w, [{ a, kind: 'calStay', ctx: { d: day() } }]); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(x => x.kind === 'calStay'); o.ai = { pending, id: e?.id, src: e?.src, reason: e?.reason, home: PLAGUEWAYS.P(X2).home[a.agentId] > day(), group: X0._gAsked.calam };
        const p = prompts.find(x => /stay＝/.test(x)) || ''; const i0 = p.indexOf(t('【遇到的事】')); const part = i0 >= 0 ? p.slice(i0) : p; o.prompt = { n: prompts.filter(x => /stay＝/.test(x)).length, codes: /stay＝/.test(p) && /go＝/.test(p), facts: part.includes('1'), cjk: /[一-鿿]/.test(p), sample: (p.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 額度：同一種一天最多 aiKind 件，超過的照個性決定（不會沒下文）
        const many = adults().filter(x => !X2.st[x.agentId]).slice(2, 7); for (const x of many) plain(x); X0._gAsked = { calam: 0 }; X0._kAsked = {}; prompts.length = 0; const n1 = seen.length; DECIDE.askNow(w, many.map(x => ({ a: x, kind: 'calStay', ctx: { d: day() } }))); const ruled = seen.slice(n1).filter(x => x.kind === 'calStay' && x.src === 'rule').length; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.quota = { kind: KK.calStay.aiKind, ai: X0._kAsked.calStay, ruled };
        w.calamity.cur = null; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }

    // ============ 整場疫情、整場喪屍危機 ============
    { const errs0 = []; const tick = () => { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } }; const d0 = day(); MM.lastT = MONEY.total(w) - MM.pend; const n0 = seen.length;
      w.calamity.cur = null; w.calamity.coolTo = 0; w.worldcal = null; C.release(w, { route: ['droplet', 'contact'], sym: ['cough', 'fever'], speed: 'fast', lethal: 'mid', length: 'mid' }, pool[2].agentId, { natural: 1 });
      let g = 0; while (w.calamity.cur && g++ < 90) { const Y = w.calamity.cur; if (Y.found && !Y.vax) Y.vax = { p: 0, need: 60, done: 0 }; tick(); await new Promise(r2 => setTimeout(r2, 0)); }
      const plague = { days: g, ended: !w.calamity.cur, kinds: [...new Set(seen.slice(n0).map(e => e.kind))] };
      const n1 = seen.length; w.tech.path = 'bio'; WC.S(w); const cz = WC.begin(w, 'zombie', 'lab'); let z = 0; while (w.worldcal.cur && z++ < 120) { tick(); await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      out.run = { errs: errs0.slice(0, 3), plague, zombie: { days: z, ended: !w.worldcal.cur, kinds: [...new Set(seen.slice(n1).map(e => e.kind))], st: cz.zst || null }, other: Math.round(other * 100) / 100 }; }
    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-120).map(loc);
    out.texts = texts.filter(Boolean).map(s => { try { return I18N.localizeNames ? I18N.localizeNames(s, true) : s; } catch (e) { return s; } });
    out.lastLogs = logs().slice(-30);
    return out; }, KEYS);
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 30, `${tag} 決策核心開著，鎮上 ${r.pop} 人`, { on: r.on, pop: r.pop });
  ok(r.reg.every(x => !x.missing && x.scan === false && x.g === 'calam' && x.kind >= 1 && x.title) && r.group === 12, `${tag} 登記了十四個選擇點：由那一刻送進來，用 calam 那一組額度（一天 12 件），每種有自己的上限`, r.reg);
  // A1
  { const A = r.A1;
    ok(Object.values(A.facts).every(Boolean), `${tag} 待不待在家：事實裡有幾個人病著、死了幾個、家裡誰在病、身上的錢、靠不靠工錢吃飯`, A.facts);
    ok(A.ids0.join() === 'go,stay' && A.ids1.join() === 'go,stay,fam', `${tag} 選項：照常出門、待在家；家人沒病又沒躲著時多一個「帶家人一起躲」`, { a: A.ids0, b: A.ids1 });
    ok(A.fam.home && A.fam.n === 2 && A.fam.absent && A.solo.b && A.solo.sp, `${tag} 選了之後真的待在家（帶家人的連家人一起），固定碰面的地方少了他`, { fam: A.fam, solo: A.solo });
    ok(A.lean.scared !== 'go' && A.lean.brave === 'go', `${tag} 照個性：又怕又有積蓄、家裡死過人的躲；靠工錢過活、勤快樂觀的照常出門`, A.lean);
    ok(A.ask.okWho && A.ask.max8 && A.ask.again === 0 && A.ask.distinct, `${tag} 只問怕的人（悲觀、老人、家裡死過人），一天最多八個（這次 ${A.ask.n} 個），同一天不再問同一個人`, A.ask);
    ok(A.off.asked === 0 && A.off.home > 0, `${tag} 決策核心沒開：不問，照舊每天擲骰`, A.off); }
  // A2
  { const A = r.A2;
    ok(A.thought.asked && A.thought.who, `${tag} 送飯：病人身邊交情最好的那一位被想到、被問`, A.thought);
    ok(Object.values(A.facts).every(Boolean), `${tag} 事實裡有病人是誰、病了幾天、跟他的交情、鎮上死了幾個`, A.facts);
    ok(A.ids.includes('give') && A.ids.includes('afraid') && A.ids.includes('pass') && !A.ids.includes('cold') && A.idsCold.includes('cold'), `${tag} 選項：送到門口、不敢去、託別人送；有過節的才有「不想理」`, { ids: A.ids, cold: A.idsCold });
    ok(A.give.fed === 1 && A.give.feed && A.give.owe && A.give.aff && A.give.again === 0 && A.give.next === 1 && A.give.stop, `${tag} 送了：病人欠一份人情、好感上升，隔天自動再送一次，到期就停`, A.give);
    ok(A.afraid.aff && A.afraid.mem, `${tag} 不敢去：病人記得`, A.afraid);
    ok(A.pass.who && A.pass.via && A.pass.factsVia && A.pass.noPass, `${tag} 託別人送：被託的人被問，題目裡寫著誰託的，不能再轉託`, A.pass);
    ok(A.lean.kind === 'give' && A.lean.scared !== 'give' && A.lean.mKind > A.lean.mScared, `${tag} 照個性（隔離期間）：心腸好、看重鄰里又很親的送，悲觀膽小的不送`, A.lean);
    ok(A.off.asked === 0 && A.off.fed >= 1, `${tag} 決策核心沒開：照舊擲骰找人送`, A.off); }
  // A3
  { const A = r.A3;
    ok(A.day1.asked > 0 && A.day1.max && A.day1.capOk && A.day1.distinct && A.sameDay === 0, `${tag} 疫苗：一天問的人不超過「打得完的人數＋5」（${A.day1.asked}/${A.day1.cap}），打的不超過上限（${A.day1.shots}），同一天不再問同一個人`, A.day1);
    ok(Object.values(A.facts).every(Boolean), `${tag} 事實裡有已經打了幾個、醫生一天打得了幾個、排隊幾個`, A.facts);
    ok(A.ids.join() === 'go,wait,no', `${tag} 選項：去打、再等等、不打`, A.ids);
    ok(A.lean.devout > A.lean.mNo + 0.8 && A.lean.distrust < A.lean.mGo && A.lean.lost > A.lean.mGo && A.lean.plain === 'go', `${tag} 照個性：很虔誠的不打、不信醫生的不急著打，家裡死過人的去打`, A.lean);
    ok(A.wait.at && A.wait.lastNoWait && A.no && A.no.never && A.no.notShot && A.go.queued, `${tag} 再等等的三天後再問（問到第三次就沒有「再等等」）；不打的不再問；去打的排進隊伍`, { wait: A.wait, no: A.no, go: A.go });
    ok(A.queueCap.shots === A.queueCap.cap && A.queueCap.left > 0, `${tag} 想打的人比打得完的多：一天只打 ${A.queueCap.cap} 個，其他的繼續排`, A.queueCap);
    ok(A.off && A.on, `${tag} 決策核心沒開：交回 sim-calamity.js 原本的每天三成自動打到`, { off: A.off, on: A.on }); }
  // A4
  { const A = r.A4;
    ok(A.seller.n === 1 && A.seller.who, `${tag} 萬靈藥：每天問一個最有動機的人（貪心）`, A.seller);
    ok(A.sellIds.join() === 'no,sell' && A.leanSell.greedy > A.leanSell.kind + 0.5, `${tag} 賣不賣：貪心的比心腸好的想賣得多（以前每天 12%，大多數時候不賣）`, { ids: A.sellIds, lean: A.leanSell });
    ok(A.open.pan && A.open.open && A.open.asked > 0 && A.open.max8 && A.open.sellerGot && A.open.leak === 0, `${tag} 擺攤：最可能買的人被問（${A.open.asked} 個），買的人付錢給賣的人（${A.open.bought} 個、${A.open.sum} 銀幣），錢守恆`, A.open);
    ok(A.leanBuy && A.leanBuy.scared > 0 && A.leanBuy.wise < 0, `${tag} 買不買：怕的老人買，看重知識的不買`, A.leanBuy);
    ok(A.few.gone && A.few.refunded && A.few.leak === 0, `${tag} 擺了一天沒什麼人買：收攤、錢退回去`, A.few);
    if (A.exposed) { ok(A.exposed.exp && A.exposed.asked && A.refundIds.join() === 'all,half,no', `${tag} 被拆穿：問賣的人退不退錢（全退、退一半、不退）`, { e: A.exposed, ids: A.refundIds });
      ok(A.refund.back === A.refund.paid && A.refund.leak === 0 && A.half.back > 0 && A.half.leak === 0 && A.no.quarrel, `${tag} 全退退回 ${A.refund.paid} 銀幣、退一半、不退就跟買的人吵起來；錢守恆`, { r: A.refund, h: A.half, n: A.no });
      ok(A.leanRefund.kind > 0 && A.leanRefund.greedy < 0, `${tag} 照個性：心腸好的全退，貪心刻薄的不退`, A.leanRefund); }
    else ok(false, `${tag} 萬靈藥被拆穿的情境沒有造出來`, A); }
  // A5
  { const A = r.A5;
    ok(A.stub.asked && A.stub.facts && A.stub.ids.join() === 'admit,stub,quiet' && A.stub.kind === 'admit' && A.stub.liar === 'stub' && A.stub.admit === 1, `${tag} 否決防疫之後死了人：被追問的人自己決定認錯、嘴硬或不說話（心腸好的認錯、不老實的嘴硬）`, A.stub);
    ok(!A.endErr && A.sorry.n >= 2 && A.sorry.n <= 3 && A.sorry.most && A.sorry.least && A.sorry.distinct && A.sorry.facts && A.sorry.ids.join() === 'sorry,quiet,still' && A.sorry.done, `${tag} 疫情過去：怪過他的人（最怪的一位、怪得最輕的兩位）被問，道歉了好感回升`, A.sorry);
    ok(A.sorry.kind > A.sorry.abrasive && A.sorry.abStill > A.sorry.kindStill, `${tag} 照個性：心腸好、怪得輕的道歉；刻薄、怪得深的照樣怪`, A.sorry); }
  // A6
  { const A = r.A6;
    ok(A.ask.n >= 1 && A.ask.max3 && A.ask.rich && A.ask.again === 0, `${tag} 恐慌期有錢人走不走：一天最多問三個，六天內不再問`, A.ask);
    ok(A.facts && A.ids.includes('stay') && A.ids.includes('go') && A.go.gone && A.go.fled === 1, `${tag} 選了走就真的離開，算進逃走的人數`, { ids: A.ids, go: A.go, f: A.f });
    ok(A.lean.brave > A.lean.scared && A.lean.brave > 0, `${tag} 照個性：又悲觀又神經質的走，勇敢、念舊的留下`, A.lean); }
  // A7
  ok(!r.A7.save.err && r.A7.save.feed && r.A7.save.vq && r.A7.save.va, `${tag} 存讀檔：疫情進行到一半，答應送飯的、排隊打疫苗的都還在`, r.A7.save);
  ok(!r.A7.old.err && r.A7.old.ask && r.A7.old.feed, `${tag} 舊存檔（沒有這一版的欄位）讀進來照常跑`, r.A7.old);
  // B
  { const B = r.B1;
    ok(B.bitFacts.cure && B.bitFacts.fam && B.bitIds.join() === 'clinic,home', `${tag} 被咬的人：事實裡有解藥進度、家人；可以自己去診所或回家說`, { f: B.bitFacts, ids: B.bitIds });
    ok(B.bitLean.brave > B.bitLean.scared + 0.5, `${tag} 照個性：勇敢心軟的自己去診所，膽小的回家`, B.bitLean);
    ok(B.home.asked && B.hideFacts.name && B.hideFacts.tie && B.hideFacts.kid && B.hideIds.join() === 'hide,clinic,tie', `${tag} 回家：最親的家人被問，事實裡有交情和家裡的小孩；選項是瞞著、帶去診所、綁在家裡`, { h: B.home, f: B.hideFacts, ids: B.hideIds });
    ok(B.hideLean.closePick === 'hide' && B.hideLean.rulesPick !== 'hide' && B.hideLean.close > B.hideLean.rules, `${tag} 照個性：很親、不信守衛的瞞；守規矩、怕家裡小孩被咬的不瞞`, B.hideLean);
    ok(B.turn.hid === 1 && B.turn.zombie && B.turn.log && B.turn.how && B.clinic.iso && B.clinic.how, `${tag} 瞞著的兩天後在家裡變成喪屍（日誌寫在家裡）；帶去診所的記成隔離`, { t: B.turn, c: B.clinic }); }
  { const B = r.B2;
    ok(B.facts.name && B.facts.cure && B.facts.fam && B.facts.tie && B.ids.join() === 'kill,cant,drive', `${tag} 獵人：事實裡有這個喪屍生前是誰、交情、家人、解藥進度；選項動手、下不了手、趕到墓園`, { f: B.facts, ids: B.ids });
    ok(B.lean.stranger === 'kill' && B.lean.friend !== 'kill' && B.lean.mSoon < B.lean.mS, `${tag} 照個性：不熟的動手；生前很要好的、解藥快好了的下不了手`, B.lean);
    ok(B.turn.asked && B.turn.guard, `${tag} 今天輪不輪到、輪到誰照舊看天；輪到的守衛或勇敢的人被問`, B.turn);
    ok(B.guardAsked.who && B.guardFacts.h && B.guardFacts.cure && B.guardIds.join() === 'block,away,beg', `${tag} 動手前家人被問：衝出去擋、轉過頭、求他再等`, { g: B.guardAsked, f: B.guardFacts, ids: B.guardIds });
    ok(B.block.alive && B.block.n === 1 && B.block.aff && B.away.killed === 1 && B.away.dead, `${tag} 擋了：獵人放下斧頭（照原本）；轉過頭：照原本清剿`, { b: B.block, a: B.away });
    ok(B.guardLean.brave > 0 && B.guardLean.timid < 0, `${tag} 照個性：勇敢又很親的擋，膽小又不親的轉過頭`, B.guardLean);
    ok(B.spare.alive && B.spare.killed === 0 && B.spare.spare >= 1 && B.spare.drive >= 1, `${tag} 下不了手、趕到墓園：喪屍沒有被殺`, B.spare);
    ok(B.off.asked === 0, `${tag} 決策核心沒開：不問，照舊 40% 瞞、50% 擋`, B.off); }
  ok(!r.B3.err && r.B3.how && r.B3.bunk && !r.B3.old, `${tag} 存讀檔：喪屍危機進行到一半（被咬、瞞著、買了避難位子）讀回來照常跑；舊存檔也可以`, r.B3);
  // C
  { const Cc = r.C1;
    ok(Cc.early.n >= 1 && Cc.early.max3 && Cc.early.t, `${tag} 末日將至：最有錢又膽小的三個人被問要不要走`, Cc.early);
    ok(Cc.facts && ['stay', 'go', 'bunk'].every(x => Cc.ids.includes(x)), `${tag} 選項有留下、走、花錢買避難位子`, { ids: Cc.ids, dbg: Cc.dbg });
    ok(Cc.bunk.paid > 0 && Cc.bunk.paid === Cc.bunk.tres && Cc.bunk.leak === 0 && Cc.bunk.marked && Cc.bunk.last, `${tag} 買避難位子：${Cc.bunk.paid} 銀幣進公庫，死人的時候排在最後`, Cc.bunk);
    ok(Cc.friend && Cc.friendGo.b && Cc.friendGo.fr && Cc.friendGo.left === 2, `${tag} 可以帶走不是家人的好朋友，兩個人都算搬走`, Cc);
    ok(Cc.cap === 0, `${tag} 一個人一場災厄最多被問兩次`, Cc.cap);
    ok(Cc.after.asked === Cc.after.want && Cc.after.allAfter && Cc.after.gone >= 0, `${tag} 大災之後：從同一群人裡問 ${Cc.after.want} 個（以前直接挑 5 個走），這次走了 ${Cc.after.gone} 個`, Cc.after); }
  // D
  { const D = r.D1;
    ok(D.scale, `${tag} 災後反應：選項的傾向分數就是原本的分數乘 1.5（照個性推估時選到每一種的機率跟以前一樣）`, D);
    ok(D.facts && D.ids.includes('none') && D.ids.length >= 5, `${tag} 事實裡有出了什麼事、身上的錢；選項是做得到的反應加照常過日子`, D.ids);
    ok(D.daily.asked > 0 && D.daily.decided === D.daily.asked && D.daily.acted > 0 && D.daily.inLog, `${tag} 每天：有反應的人被問（${D.daily.asked} 人），結算照原本，做過的決定寫進本人的紀錄`, D.daily);
    ok(D.again === 0, `${tag} 兩天內做過的不再問`, D.again);
    ok(D.off.asked === 0 && D.off.acted >= 0, `${tag} 決策核心沒開：照原本自己算分`, D.off); }
  // AI
  { const M = r.mind;
    ok(M.aiOn && M.ai && M.ai.pending && M.ai.id === 'stay' && M.ai.src === 'ai' && M.ai.reason === 'model reason 71' && M.ai.home && M.ai.group === 1, `${tag} 開 AI：題目當場送出、等回話，採用它選的「待在家」與理由，用 calam 那一組的額度`, M.ai);
    ok(M.prompt && M.prompt.n === 1 && M.prompt.codes && M.prompt.facts, `${tag} 題目裡有事實與選項代號`, M.prompt);
    ok(zh || (M.prompt && !M.prompt.cjk), `${tag} 英文題目裡沒有中文`, zh ? null : M.prompt);
    ok(M.quota && M.quota.ai === M.quota.kind && M.quota.ruled === 5 - M.quota.kind, `${tag} 同一種一天最多 ${M.quota?.kind} 件問 AI，其餘當場照個性決定`, M.quota); }
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.plague.ended && Ru.zombie.ended && Ru.other === 0, `${tag} 整場疫情（${Ru.plague.days} 天）與整場喪屍危機（${Ru.zombie.days} 天）跑完：沒有錯誤、帳上沒有對不上的錢`, Ru);
    console.log('   ', JSON.stringify(Ru)); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 標題、事實、選項、理由、結果都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
