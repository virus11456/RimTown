// v11.13.0 工作與求職：求職、改行、公家的裁員、沒有工會的罷工與東家的回應、當不當神職
//   A) 沒有工作，鎮上有缺(jobSeek)：去做最做得來的／去做工資最高的／這禮拜先不找／拜師；職缺是共用的，前面的人接走就沒了
//   B) 這一行人太多，別行缺人(jobSwitch)：留在原本這一行／改行
//   C) 公家的行業人太多(pubCut)：首長決定這禮拜不裁人，或請某某另外找工作
//   D) 工資被壓，同行說要罷工(wildcat)：站出來罷工／再忍一忍／去加入工會；一半以上站出來才罷得成，只有站出來的人不上工、沒工資
//   E) 罷工的人回來上工了(wildcatEnd)：東家讓步加薪／不讓步／不讓步還開除帶頭的
//   F) 教團想請你當神職(ordain)：去當神職／不去
//   共同：登記與額度、事實與選項、每個選項的後果、錢守恆、照個性的傾向與比例、不帶「交給本人」時跟舊版一模一樣（拿 v11.12.2 的原始碼在同一個狀態上對跑）、
//         作廢、存讀檔、開 AI、英文題目沒有中文、放著跑 30 天
// 用法：BASE=http://localhost:8198/ node scripts/v111300_test.js（需要本機伺服器服務 chrome-extension/）
//   OLD_REF：拿來對跑的舊版（預設 v11.12.2 的提交）；這個提交在本機的 git 歷史裡找不到時，對跑那三項會標成「略過」並算失敗以外的提示
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8198/'; const LONG = +(process.env.LONG || 30); const OLD_REF = process.env.OLD_REF || '23beca1';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['jobSeek', 'jobSwitch', 'pubCut', 'wildcat', 'wildcatEnd', 'ordain'];
// 舊版的三個模組（只取 const X = (() => { … })(); 那一塊，不含後面掛到每日流程的部分）
const OLD = (() => { const out = {}; const cut = (src, name) => { const a = src.indexOf(`const ${name} = (() => {`); const b = src.indexOf('\n})();', a); return a >= 0 && b > a ? src.slice(a, b + 6) : null; };
  try { const show = (f) => execFileSync('git', ['show', `${OLD_REF}:chrome-extension/${f}`], { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    out.LABOR = cut(show('sim-finance.js'), 'LABOR'); out.MARKET = cut(show('sim-market.js'), 'MARKET'); out.CLERGY = cut(show('sim-clergy.js'), 'CLERGY'); } catch (e) { out.err = String(e.message).slice(0, 120); }
  return out; })();
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { const x = m.text(); if (/\[(Jobs|Finance|Clergy|Boss|Union|Market|Money)\]/.test(x) || /\[Decide\] (run|options|ai|past) /.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 300)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async ({ KEYS, LONG, OLD }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 113 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); tick1(); out.on = DECIDE.on(w) && JOBS.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && a.currentLocation !== 'exploration');
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X0 = DECIDE.S(w); const KK = DECIDE.KINDS; const texts = []; const logs = () => (w.messageLog || []).map(m => String(m.k || m.content || '')); const trimLog = () => { w.messageLog = (w.messageLog || []).slice(-20); }; // 日誌超過 800 筆會被截短重建，每一段開頭先收短，才能用位置切出「這一段新增的」
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; a.moodModifier = 0; a.mood = 55; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
    const unpair = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married' || r.status === 'dating') { r.status = 'friend'; const o = w.agents[r.targetId]; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) r2.status = 'friend'; } };
    const orphan = (a) => { a._parentNames = []; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
    const zeroAff = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) r.affinity = 0; for (const o of npcs()) { const r = o.relationships?.relationships?.[a.agentId]; if (r) r.affinity = 0; } };
    const lone = (a) => { plain(a); orphan(a); unpair(a); zeroAff(a); };
    const scoreOf = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); return ops.map(op => [String(op.id).split(':')[0], String(op.id), DECIDE.score(Ln, op)]); };
    const pick = (K, a, ctx) => { let best = null, bs = -1e9; for (const [h, , s] of scoreOf(K, a, ctx)) if (s > bs) { bs = s; best = h; } return best; };
    const marg = (K, a, ctx, id) => { const S = scoreOf(K, a, ctx); const me = S.find(o => o[1] === id || o[0] === id); if (!me) return null; return r3(me[2] - Math.max(...S.filter(o => o !== me).map(o => o[2]))); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    const runOp = (K, a, ctx, id) => { const op = opOf(K, a, ctx, id); if (!op) return null; const res = op.run(w, a, ctx); DECIDE.record(w, X0, a, K, op, op.why || null, res, 'rule', day(), ctx); return res; };
    const collect = (K, a, ctx) => { try { texts.push(t(K.title), K.facts(w, a, ctx)); for (const o of K.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); } catch (e) { texts.push('ERR ' + e.message); } };
    const prompts = {}; const mkPrompt = (k, a, ctx) => { try { const K = KK[k]; const opts = K.options(w, a, ctx); if (!opts.length) { prompts[k] = 'ERR no options'; return; } prompts[k] = DECIDE.prompt(w, K, [{ a, ctx, opts }]); } catch (e) { prompts[k] = 'ERR ' + e.message; } };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const fixR = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = R0; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const memHas = (a, k) => (a.memory?.entries || []).some(e => e.k === k);
    const setJob = (a, k) => { a.job = k ? new Job(k) : null; };
    const has = (s, a) => s.includes(a.name) || s.includes(t(a.name)) || (typeof I18N !== 'undefined' && I18N.localizeNames ? s.includes(I18N.localizeNames(a.name, true)) : false);
    const jobT = (k) => t(JOB_DEFINITIONS[k].title); const clearQ = () => { X0.q.length = 0; };
    const setSkill = (a, k, lv, passion) => { const s = a.skills.get(LABOR.PRIMARY[k]); s.xp = xpForLevel(lv); s.passion = passion || '無'; };
    const noSkill = (a) => { for (const s of Object.values(a.skills.skills)) { s.xp = 0; s.passion = '無'; } };
    // 照個性那條路的比例：把鎮上每個大人的個性輪流套在同一個情境上，加上當天心情起伏（固定種子），看選到某幾項的比例
    let seedS = 12345; const rng = () => { seedS = (seedS * 1103515245 + 12345) & 0x7fffffff; return seedS / 0x7fffffff; };
    const pool0 = npcs().filter(x => (x.age ?? 30) >= 16).map(x => ({ t: (x.personality.traits || []).slice(), v: (x.personality.values || []).slice() }));
    const draw = (K, a, ctx) => { const ops = K.options(w, a, ctx); if (ops.length < 2) return null; const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s2 = DECIDE.score(Ln, op) + (rng() - 0.5) * 1.8; if (s2 > bs) { bs = s2; best = op; } } return String(best.id).split(':')[0]; };
    const rate = (K, a, ctx, okIds, N = 800, force) => { const keep = JSON.parse(JSON.stringify(a.personality)); let hit = 0, n = 0;
      try { for (let i = 0; i < N; i++) { const src = pool0[i % pool0.length]; a.personality.traits = (force || []).concat(src.t.filter(x => !(force || []).includes(x))); a.personality.values = src.v.slice(); const got = draw(K, a, ctx); if (got == null) continue; n++; if (okIds.includes(got)) hit++; } } finally { Object.assign(a.personality, keep); }
      return n ? Math.round(hit / n * 1000) / 1000 : null; };
    const rates = {};
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    const used = new Set(); const curM = () => { try { return JOBS.headOf(w)?.agentId || w.election?.currentMayor?.(w)?.agentId || null; } catch (e) { return null; } };
    const isOwner = (x) => MARKET.ownedBy(w, x.agentId).length > 0 || Object.values(MARKET.S(w).rival || {}).some(R => R && R.owner === x.agentId);
    const free = (x) => !used.has(x.agentId) && x.job?.key !== 'mayor' && x.agentId !== curM() && w.crown?.king !== x.agentId && !isOwner(x) && w.union?.leader !== x.agentId;
    const take = (f) => { const a = adults().find(x => free(x) && (!f || f(x))) || adults().find(free); if (a) used.add(a.agentId); return a; };
    const head = JOBS.headOf(w); if (head) used.add(head.agentId);
    out.pop = npcs().length; out.head = !!head;
    const L = LABOR.S(w); const M = MARKET.S(w); const realOpen = LABOR.openNow;
    // 名額由測試指定（沒指定的行業：名額＝現在的人數，沒有缺也不嫌多）；人數照實數
    const slotStub = (spec) => { LABOR.openNow = (w2) => { const r = realOpen(w2); for (const k of Object.keys(LABOR.RATIO)) { r.sl[k] = spec[k] != null ? (typeof spec[k] === 'function' ? spec[k](r.fl[k] || 0) : spec[k]) : (r.fl[k] || 0); r.open[k] = r.sl[k] - (r.fl[k] || 0); } return r; }; };
    const slotReal = () => { LABOR.openNow = realOpen; };
    const count = (k) => npcs().filter(a => a.job?.key === k && !w.isAway?.(a.agentId)).length;

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup || null, kind: KK[k].aiKind || null, title: t(KK[k].title) } : { k, missing: 1 });
    out.total = Object.keys(KK).length; out.groups = { jobs: DECIDE.AI_GROUP.jobs, work: DECIDE.AI_GROUP.work, civic: DECIDE.AI_GROUP.civic, flag: DECIDE.jobs === true };

    // ============ A 沒有工作，鎮上有缺 ============
    const A = {}; { trimLog(); const K = KK.jobSeek; const s1 = take(), s2 = take(), s3 = take(), s4 = take(); for (const x of [s1, s2, s3, s4]) { lone(x); noSkill(x); x.age = 40; setJob(x, null); delete L.jobless[x.agentId]; setCash(x, 30); }
      setSkill(s1, 'farmer', 12); setSkill(s2, 'farmer', 8); setSkill(s3, 'farmer', 6); setSkill(s4, 'farmer', 4); L.jobless[s1.agentId] = day() - 9;
      const nF = count('farmer'), nD = count('doctor'); slotStub({ farmer: nF + 2, doctor: nD + 1 }); const c = { d: day() };
      const f = K.facts(w, s1, c); collect(K, s1, c); mkPrompt('jobSeek', s1, c); const pF = LABOR.payOf(w, 'farmer'), pD = LABOR.payOf(w, 'doctor');
      A.facts = { since: /已經 9 天沒有工作|out of work for 9 days/.test(f), farmer: f.includes(jobT('farmer')), doctor: f.includes(jobT('doctor')), open: f.includes(fill('{j}（缺 {n} 人，一天大約 {p} 銀幣）', { j: jobT('farmer'), n: 2, p: pF })) && f.includes(fill('{j}（缺 {n} 人，一天大約 {p} 銀幣）', { j: jobT('doctor'), n: 1, p: pD })),
        fit: f.includes(t('很拿手')), top: f.includes(fill('工資最高的是{j}，一天大約 {p} 銀幣；這一行你{w}。', { j: jobT('doctor'), p: pD, w: t('沒做過') })), cash: /30/.test(f), pay: pD > pF };
      A.ids = K.options(w, s1, c).map(o => String(o.id)).join();
      // 每個選項的後果
      const h0 = L.stats.hired; const n0 = logs().length; const L1 = leak(() => runOp(K, s1, c, 'fit')); A.fit = { job: s1.job?.key, hired: L.stats.hired - h0, jobless: L.jobless[s1.agentId] == null, mem: memHas(s1, '總算找到工作了，以後當{j}。'), log: logs().slice(n0).some(x => x.startsWith('💼')), left: LABOR.openNow(w).open.farmer, leak: L1.leak, res: tx(L1.ret) };
      const L2 = leak(() => runOp(K, s2, c, 'pay')); A.pay = { job: s2.job?.key, left: LABOR.openNow(w).open.doctor, leak: L2.leak, again: K.options(w, s2, c).length };
      const n1 = logs().length; const L3 = leak(() => runOp(K, s3, c, 'wait')); A.wait = { job: s3.job?.key || null, since: L.jobless[s3.agentId] === day(), mem: memHas(s3, '這禮拜我沒有去找工作，想再看看。'), log: logs().slice(n1).some(x => x.startsWith('🪑')), sad: (s3.thoughts || []).some?.(x => x.kind === 'jobless') || false, leak: L3.leak, still: K.options(w, s3, c).length > 0 };
      // 晚了一步：選項列好之後缺被別人補走
      const opLate = opOf(K, s3, c, 'fit'); setJob(s4, 'farmer'); const lateLeft = LABOR.openNow(w).open.farmer; const LL = leak(() => opLate.run(w, s3, c)); A.late = { left: lateLeft, job: s3.job?.key || null, res: tx(LL.ret), leak: LL.leak }; setJob(s4, null);
      // 作廢：事情過了三天、已經有工作、鎮上沒有缺
      A.void = { old: K.options(w, s3, { d: day() - 3 }).length, hasJob: K.options(w, s1, c).length }; slotStub({}); A.void.none = K.options(w, s3, c).length;
      // 拜師：有師傅肯收才有這一項
      { const li = MOBILITY.learnInfo, lb = MOBILITY.learnBy; let called = 0; const m = take(); slotStub({ farmer: (n) => n + 2 });
        MOBILITY.learnInfo = (w2, a2) => (a2 === s3 ? { m, job: JOB_DEFINITIONS.carpenter.title, fast: false, days: 30, fee: 3 } : li(w2, a2)); MOBILITY.learnBy = (w2, a2) => { called++; return { m: m.agentId }; };
        try { const f2 = K.facts(w, s3, c); collect(K, s3, c); A.learn = { ids: ids(K, s3, c).join(), fact: has(f2, m) && f2.includes('30'), res: tx(runOp(K, s3, c, 'learn')), called, job: s3.job?.key || null }; } finally { MOBILITY.learnInfo = li; MOBILITY.learnBy = lb; } }
      // 傾向：窮、家裡有小孩的趕快找；懶、有積蓄的可以等；看重錢的挑工資高的
      for (const x of [s3, s4]) { setJob(x, null); lone(x); } slotStub({ farmer: (n) => n + 2, doctor: (n) => n + 1 });
      const mWaitRich = (() => { s3.personality.traits = ['lazy']; setCash(s3, 500); const m = marg(K, s3, c, 'wait'); return m; })();
      const mWaitPoor = (() => { s3.personality.traits = ['hardworking']; setCash(s3, 2); MARKET.S(w).hungry[s3.agentId] = 3; const m = marg(K, s3, c, 'wait'); delete MARKET.S(w).hungry[s3.agentId]; return m; })();
      const mPayGreedy = (() => { s3.personality.traits = ['greedy']; s3.personality.values = ['財富']; setCash(s3, 30); return marg(K, s3, c, 'pay'); })();
      const mPayPlain = (() => { plain(s3); return marg(K, s3, c, 'pay'); })();
      const mPayCant = (() => { plain(s3); const sk = s3.skills.get(LABOR.PRIMARY.doctor); sk.passion = '無能'; const m = marg(K, s3, c, 'pay'); sk.passion = '無'; return m; })();
      A.lean = { mWaitRich, mWaitPoor, mPayGreedy, mPayPlain, mPayCant, plain: steady(() => pick(K, s3, c)) };
      plain(s3); setCash(s3, 30); rates.seekTake = rate(K, s3, c, ['fit', 'pay']); rates.seekPay = rate(K, s3, c, ['pay']); rates.seekWait = rate(K, s3, c, ['wait']);
      // 職缺是共用的：照順序問，前面的人接走就沒了；輪到的人沒有缺就是找不到工作
      for (const x of [s1, s2, s3, s4]) { setJob(x, null); lone(x); delete L.jobless[x.agentId]; setCash(x, 30); } const nF2 = count('farmer'); slotStub({ farmer: nF2 + 2 });
      const na = asked.length; const ns = seen.length; const LS = leak(() => steady(() => JOBS.seek(w, [s1, s2, s3, s4], day())));
      A.order = { asked: asked.slice(na).filter(e => e.kind === 'jobSeek').map(e => e.who).join() === [s1, s2].map(x => x.agentId).join(), jobs: [s1, s2, s3, s4].map(x => x.job?.key || '-').join(), ruled: seen.slice(ns).filter(e => e.kind === 'jobSeek' && e.src === 'rule').length, s3since: L.jobless[s3.agentId] === day(), leak: LS.leak };
      // 人不在鎮上：這禮拜不問
      setJob(s1, null); s1.currentLocation = 'exploration'; const nb = asked.length; JOBS.seek(w, [s1], day()); A.away = { asked: asked.slice(nb).length, job: s1.job?.key || null }; s1.currentLocation = 'town_square';
      slotReal(); out.Aids = [s1, s2, s3, s4].map(x => x.agentId); for (const x of [s1, s2, s3, s4]) if (!x.job) setJob(x, 'farmer'); }
    out.A = A;

    // ============ B 這一行人太多，別行缺人 ============
    const B = {}; { trimLog(); const K = KK.jobSwitch; const a = take(), b = take(); for (const x of [a, b]) { lone(x); noSkill(x); setJob(x, 'trader'); setCash(x, 40); } setSkill(a, 'trader', 5); setSkill(a, 'miner', 7);
      const nT = count('trader'), nM = count('miner'); slotStub({ trader: nT - 3, miner: nM + 2 }); const c = { from: 'trader', to: 'miner', d: day() };
      const f = K.facts(w, a, c); collect(K, a, c); mkPrompt('jobSwitch', a, c);
      B.facts = { from: f.includes(jobT('trader')), to: f.includes(jobT('miner')), n: f.includes(String(nT)) && f.includes(String(nT - 3)), need: /2/.test(f), risk: f.includes(t('，人多到隨時可能裁人')), pay: f.includes(String(LABOR.payOf(w, 'trader'))) && f.includes(String(LABOR.payOf(w, 'miner'))), sk: f.includes(t('做得來')) && f.includes(t('做得不錯')) };
      B.ids = ids(K, a, c).join();
      const s0 = L.stats.switched; const n0 = logs().length; const L1 = leak(() => runOp(K, a, c, 'move')); B.move = { job: a.job?.key, sw: L.stats.switched - s0, mem: memHas(a, '做{a}的人太多了，我改行當{b}。'), log: logs().slice(n0).some(x => x.startsWith('🔁')), leak: L1.leak, again: K.options(w, a, c).length };
      const L2 = leak(() => runOp(K, b, c, 'stay')); B.stay = { job: b.job?.key, leak: L2.leak };
      // 傾向：新的一行比較拿手、工資比較高的肯換；對現在這門手藝很投入的不換；天生做不來的不換
      setSkill(b, 'miner', 12); const mGood = marg(K, b, c, 'move'); noSkill(b); setSkill(b, 'trader', 10, '狂熱'); const mLove = marg(K, b, c, 'move'); noSkill(b); b.skills.get(LABOR.PRIMARY.miner).passion = '無能'; const mCant = marg(K, b, c, 'move'); noSkill(b);
      B.lean = { mGood, mLove, mCant }; rates.switchMove = rate(K, b, c, ['move']);
      // 作廢：缺被補走了、這一行已經不嫌多、自己換了工作、事情過了三天
      const opM = opOf(K, b, c, 'move'); slotStub({ trader: nT - 3, miner: (n) => n }); const LL = leak(() => opM.run(w, b, c)); B.void = { gone: K.options(w, b, c).length, late: tx(LL.ret), lateJob: b.job?.key, leak: LL.leak };
      slotStub({ trader: (n) => n, miner: (n) => n + 2 }); B.void.notOver = K.options(w, b, c).length; slotStub({ trader: nT - 3, miner: (n) => n + 2 }); B.void.old = K.options(w, b, { ...c, d: day() - 3 }).length; setJob(b, 'cook'); B.void.moved = K.options(w, b, c).length; setJob(b, 'trader');
      const na = asked.length; const b2 = take(); lone(b2); setJob(b2, 'trader'); steady(() => JOBS.switchAsk(w, [b, b2], 'trader', 'miner', day())); B.ask = asked.slice(na).filter(e => e.kind === 'jobSwitch').length;
      slotReal(); }
    out.B = B;

    // ============ C 公家的行業人太多：首長決定 ============
    const C = {}; if (head) { trimLog(); const K = KK.pubCut; plain(head); const g1 = take(), g2 = take(), g3 = take(), foe = take(); const mine = [g1, g2, g3, foe];
      for (const x of mine) { lone(x); noSkill(x); setJob(x, 'guard'); setCash(x, 25); } setSkill(g1, 'guard', 0); setSkill(g2, 'guard', 1); setSkill(g3, 'guard', 15); setSkill(foe, 'guard', 14); setAff(head, foe, -40); setAff(head, g1, 5);
      for (const x of npcs()) if (x.job?.key === 'guard' && !mine.includes(x)) { const s = x.skills.get(LABOR.PRIMARY.guard); if (s.level < 3) s.xp = xpForLevel(5); if (s.isIncapable) s.passion = '無'; }
      const nG = count('guard'); slotStub({ guard: nG - 4 }); const B0 = MARKET.S(w).boss; if (B0) B0.cut = { wk: -1, n: 0 }; const c = { k: 'guard', d: day() };
      const f = K.facts(w, head, c); collect(K, head, c); mkPrompt('pubCut', head, c);
      C.facts = { job: f.includes(jobT('guard')), n: f.includes(String(nG)) && f.includes(String(nG - 4)), over: /多了 4 人|4 too many/.test(f), pub: f.includes(fill('這是公職，工資由公庫發，一人一天大約 {p} 銀幣。', { p: LABOR.payOf(w, 'guard') })), silver: f.includes(String(Math.floor(w.stockpile.get('silver')))), g1: has(f, g1), g2: has(f, g2), foe: has(f, foe), g3: !has(f, g3), tie: f.includes(t('處不來')), week: /已經裁了 0 人|0 people have been let go/.test(f) };
      C.ids = K.options(w, head, c).map(o => String(o.id)).join() === ['keep', 'cut:' + g1.agentId, 'cut:' + g2.agentId, 'cut:' + foe.agentId].join();
      const l0 = L.stats.laidOff; const n0 = logs().length; const a0 = aff(g1, head); const L1 = leak(() => runOp(K, head, c, 'cut:' + g1.agentId));
      C.cut = { job: g1.job?.key || null, since: L.jobless[g1.agentId] === day(), laid: L.stats.laidOff - l0, week: BOSS.cutsThisWeek(w), aff: r3(aff(g1, head) - a0), mem: memHas(g1, '{j}的人太多了，{h}決定把我裁掉，得重新找工作。') && memHas(head, '{j}的人太多了，我請{a}另外找工作。'), log: logs().slice(n0).some(x => x.startsWith('📉 {j}的人手過剩，{h}決定')), leak: L1.leak };
      const L2 = leak(() => runOp(K, head, c, 'keep')); C.keep = { leak: L2.leak, laid: L.stats.laidOff - l0 };
      // 傾向：公庫吃緊、節儉的首長裁；心軟、跟大家交情好的不裁；有過節的那一位比朋友容易被請走
      const low0 = TREASURY.low; setJob(g1, 'guard'); if (B0) B0.cut = { wk: -1, n: 0 }; slotStub({ guard: count('guard') - 4 });
      head.personality.traits = ['kind', 'generous']; for (const x of [g1, g2, foe]) setAff(head, x, 80); const pKind = steady(() => pick(K, head, c)); const mKeepKind = marg(K, head, c, 'keep');
      head.personality.traits = ['thrifty']; for (const x of [g1, g2]) setAff(head, x, 0); setAff(head, foe, -40); TREASURY.low = () => true; const pTight = steady(() => pick(K, head, c)); const mKeepTight = marg(K, head, c, 'keep'); TREASURY.low = low0;
      plain(head); const sc = () => scoreOf(K, head, c).find(o => o[1] === 'cut:' + g1.agentId)?.[2]; setAff(head, g1, 90); const friend = r3(sc()); setAff(head, g1, -40); const hated = r3(sc()); C.lean = { pKind, pTight, mKeepKind, mKeepTight, friend, foe: hated }; setAff(head, g1, 0);
      rates.pubCutFoe = rate(K, head, c, ['cut']); setAff(head, foe, 0); { const n = count('guard'); let x = 2; while (!LABOR.overfull(n, n - x)) x++; slotStub({ guard: n - x }); C.minOver = x; } rates.pubCut = rate(K, head, c, ['cut']); setAff(head, foe, -40);
      // 作廢：不是首長、這一行已經不嫌多、這週已經裁了兩個、有東家的行業、事情過了三天
      C.void = { notHead: K.options(w, g2, c).length, old: K.options(w, head, { ...c, d: day() - 3 }).length }; if (B0) B0.cut = { wk: Math.floor(day() / 7), n: 2 }; C.void.two = K.options(w, head, c).length; if (B0) B0.cut = { wk: -1, n: 0 };
      slotStub({ guard: (n) => n }); C.void.fine = K.options(w, head, c).length; slotStub({ guard: (n) => n - 4, tailor: (n) => n - 4 });
      { const own0 = M.owners.textile; const bossT = take(); M.owners.textile = bossT.agentId; C.void.private = K.options(w, head, { k: 'tailor', d: day() }).length; C.void.pubJob = JOBS.publicJob(w, 'tailor') === false && JOBS.publicJob(w, 'guard') === true; if (own0) M.owners.textile = own0; else delete M.owners.textile; }
      slotReal();
      // 從每週流程接進來：真的名額。守衛多到要裁人時問首長；首長不在鎮上，或不帶「交給本人」，照原本的規則裁最生疏的那一位
      const more = []; const mk = () => { for (const x of more) setJob(x, 'guard'); for (const x of mine) setJob(x, 'guard'); if (B0) { B0.cut = { wk: -1, n: 0 }; B0.took = {}; } L.lastWeek = null; };
      { let guard = 0; while (guard++ < 40) { const O = LABOR.openNow(w); const ex = (k2) => (O.fl[k2] || 0) - O.sl[k2]; const top = Object.keys(LABOR.RATIO).filter(k2 => k2 !== 'guard').sort((x, y) => ex(y) - ex(x))[0]; if (LABOR.overfull(O.fl.guard || 0, O.sl.guard) && ex('guard') >= ex(top) + 2) break; const x = take(y => y.job?.key === top) || take(); if (!x) break; lone(x); noSkill(x); setSkill(x, 'guard', 9); setJob(x, 'guard'); more.push(x); } }
      mk(); const na = asked.length; const l1 = L.stats.laidOff; steady(() => LABOR.weekly(w, true)); const q1 = asked.slice(na).filter(e => e.kind === 'pubCut');
      C.flow = { asked: q1.length >= 1 && q1.length <= 2, who: q1.every(e => e.who === head.agentId), guard: q1.some(e => e.ctx?.k === 'guard'), over: more.length };
      mk(); const nb = asked.length; const loc0 = head.currentLocation; const fh = FISCAL.headOf; head.currentLocation = 'exploration'; const noHead = JOBS.headOf(w) !== head; FISCAL.headOf = () => null; const l2 = L.stats.laidOff; steady(() => LABOR.weekly(w, true)); FISCAL.headOf = fh; head.currentLocation = loc0;
      C.away = { asked: asked.slice(nb).filter(e => e.kind === 'pubCut').length, g1: g1.job?.key || null, laid: L.stats.laidOff - l2, noHead };
      mk(); const nc = asked.length; const l3 = L.stats.laidOff; const n3 = logs().length; steady(() => LABOR.weekly(w)); C.off = { asked: asked.slice(nc).length, g1: g1.job?.key || null, laid: L.stats.laidOff - l3, log: logs().slice(n3).some(x => x === '📉 {j}的人手過剩，{a}被裁員了。'), mem: memHas(g1, '{j}的人太多了，我被裁掉了，得重新找工作。') };
      mk(); const nd = asked.length; offDecide(() => steady(() => LABOR.weekly(w, true))); C.off2 = { asked: asked.slice(nd).length, g1: g1.job?.key || null };
      for (const x of more.concat(mine)) setJob(x, 'farmer'); if (B0) B0.cut = { wk: -1, n: 0 }; clearQ(); }
    out.C = C;

    // ============ D 工資被壓，同行說要罷工 ============
    const D = {}; { trimLog(); const K = KK.wildcat; const k = 'forge'; const boss = take(); const ws = [take(), take(), take(), take(), take()]; const U = UNION.S(w); const uOn0 = U.on; U.on = false;
      lone(boss); for (const x of npcs()) if (x.job?.key === 'blacksmith') setJob(x, 'miner'); const own0 = M.owners[k]; M.owners[k] = boss.agentId; if (M.rival) delete M.rival[k]; setJob(boss, 'blacksmith'); setCash(boss, 2000);
      const reset = () => { for (const x of ws) { lone(x); setJob(x, 'blacksmith'); x.mood = 20; x.moodModifier = -40; setCash(x, 30); } M.pay[k] = 0.6; M.low = M.low || {}; M.low[k] = day() - 25; M.strike = {}; if (M.strikers) delete M.strikers[k]; if (M.walk) delete M.walk[k]; if (M.endQ) delete M.endQ[k]; };
      reset(); const moodOf = () => ws.reduce((s, x) => s + (x.mood || 50), 0) / ws.length; D.mood = moodOf();
      // 題目與選項（先造一個「正在問」的情境）
      M.walk = M.walk || {}; M.walk[k] = { d: day(), n: 5, yes: [], no: [] }; const c = { k, d: day() }; const f = K.facts(w, ws[0], c); collect(K, ws[0], c); mkPrompt('wildcat', ws[0], c); const pay = LABOR.payOf(w, 'blacksmith');
      D.facts = { boss: has(f, boss), sec: f.includes(MARKET.name(k)), rate: /60%/.test(f), days: /已經 25 天了|for 25 days now/.test(f), pay: f.includes(String(pay)) && f.includes(String(Math.round(pay / 0.6 * 10) / 10)), m: /5 個工人|The 5 workers/.test(f), q: /要有 3 個人站出來|takes 3 people/.test(f), cash: /30/.test(f) };
      D.ids = ids(K, ws[0], c).join();
      U.on = true; U.name = U.name || 'Union'; U.members = {}; U.leader = ws[4].agentId; U.members[ws[4].agentId] = day(); D.idsU = ids(K, ws[0], c).join(); collect(K, ws[0], c); const LU = leak(() => runOp(K, ws[0], c, 'union')); D.union = { member: !!U.members[ws[0].agentId], no: M.walk[k].no.includes(ws[0].agentId), again: K.options(w, ws[0], c).length, leak: LU.leak }; U.on = false; U.members = {}; U.leader = null;
      // 傾向：工資壓得越低、越久、心情越差的越想罷；跟東家交情好、手頭很緊的忍
      M.walk[k] = { d: day(), n: 5, yes: [], no: [] }; const mBad = marg(K, ws[1], c, 'out'); setAff(ws[1], boss, 90); const mFriend = marg(K, ws[1], c, 'out'); setAff(ws[1], boss, 0); setCash(ws[1], 2); const mPoor = marg(K, ws[1], c, 'out'); setCash(ws[1], 30);
      M.pay[k] = 0.7; M.low[k] = day() - 1; ws[1].mood = 70; ws[1].moodModifier = 20; const mMild = marg(K, ws[1], c, 'out'); D.lean = { mBad, mFriend, mPoor, mMild };
      M.pay[k] = 0.65; M.low[k] = day() - 22; ws[1].mood = 45; ws[1].moodModifier = 0; plain(ws[1]); rates.wildOut = rate(K, ws[1], c, ['out']);
      // 六個人裡要三個站出來：照個性那條路，罷得成的機會（每次抽六種個性）
      { let hit = 0; const N = 400; const keep = JSON.parse(JSON.stringify(ws[1].personality)); for (let i = 0; i < N; i++) { let yes = 0; for (let j = 0; j < 6; j++) { const src = pool0[Math.floor(rng() * pool0.length)]; ws[1].personality.traits = src.t.slice(); ws[1].personality.values = src.v.slice(); if (draw(K, ws[1], c) === 'out') yes++; } if (yes >= 3) hit++; } Object.assign(ws[1].personality, keep); rates.wildStart = Math.round(hit / N * 1000) / 1000; }
      // 作廢：東家已經加薪、已經表過態、事情過了兩天
      M.pay[k] = 0.8; D.void = { raised: K.options(w, ws[1], c).length }; M.pay[k] = 0.6; M.walk[k].yes.push(ws[1].agentId); D.void.voted = K.options(w, ws[1], c).length; M.walk[k].yes.length = 0; D.void.old = K.options(w, ws[1], { k, d: day() - 2 }).length;
      // 從每週流程接進來：五個人都被問；都站出來 → 罷工兩天，只有站出來的人不上工
      reset(); const na = asked.length; const st0 = M.strikes || 0; const n0 = logs().length; const LW = leak(() => steady(() => MARKET.unrest(w, npcs(), day(), true)));
      const lead = w.agents[M.walk?.[k]?.lead]; D.all = { asked: asked.slice(na).filter(e => e.kind === 'wildcat').length, strike: M.strike[k] === day() + 2, n: (M.strikers?.[k] || []).length, strikes: (M.strikes || 0) - st0, on: ws.every(x => MARKET.onStrike(w, x)), boss: MARKET.onStrike(w, boss), lead: !!lead && ws.includes(lead), log: logs().slice(n0).some(x => x.startsWith('✊ {s}的 {m} 個工人裡有 {n} 個罷工了')), mem: memHas(ws[0], '我們{s}的人一起罷工，工資再這樣壓下去活不下去。'), leak: LW.leak };
      // 三個站出來、兩個照常上工：罷得成；照常上工的人領得到工資，站出來的人沒有
      reset(); for (const x of ws.slice(3)) { setAff(x, boss, 95); setCash(x, 2); } steady(() => MARKET.unrest(w, npcs(), day(), true)); const Wl = WALLET.S(w); const before = ws.map(cash); const b0 = cash(boss); const LP = leak(() => MARKET.payroll(w, Wl, npcs())); const got = ws.map((x, i) => r3(cash(x) - before[i]));
      D.part = { strike: M.strike[k] === day() + 2, outs: (M.strikers?.[k] || []).length, on: ws.map(x => MARKET.onStrike(w, x) ? 1 : 0).join(''), paid: got.slice(0, 3).every(x => x === 0) && got.slice(3).every(x => x > 0), boss: r3(b0 - cash(boss)) > 0, leak: LP.leak, no: (M.walk[k].no || []).length };
      // 只有一個站出來：罷不成，照常上工
      reset(); for (const x of ws.slice(1)) { setAff(x, boss, 95); setCash(x, 2); } const n1 = logs().length; steady(() => MARKET.unrest(w, npcs(), day(), true)); D.fizzle = { strike: M.strike[k] == null, yes: (M.walk[k].yes || []).length, log: logs().slice(n1).some(x => x.startsWith('😶')), mem: memHas(ws[0], '我想罷工，可是站出來的人不夠，只好算了。'), on: ws.some(x => MARKET.onStrike(w, x)) };
      // 不帶「交給本人」：照舊擲骰（整行一起罷工，沒有人被問）
      reset(); const nb = asked.length; fixR(0.9, () => MARKET.unrest(w, npcs(), day())); const noStrike = M.strike[k] == null; fixR(0.1, () => MARKET.unrest(w, npcs(), day()));
      D.off = { asked: asked.slice(nb).length, high: noStrike, low: M.strike[k] === day() + 2, all: ws.every(x => MARKET.onStrike(w, x)), list: !M.strikers?.[k] };
      // 心情不差、壓得還不久：不會問
      reset(); for (const x of ws) { x.mood = 70; x.moodModifier = 20; } M.low[k] = day() - 3; const nc = asked.length; steady(() => MARKET.unrest(w, npcs(), day(), true)); D.calm = { asked: asked.slice(nc).length, mood: moodOf() };
      out.Dk = { k, boss: boss.agentId, ws: ws.map(x => x.agentId), own0: own0 || null, uOn0 }; D.reset = reset; }
    out.D = Object.assign({}, D, { reset: undefined });

    // ============ E 罷工的人回來上工了：東家讓不讓 ============
    const E = {}; { trimLog(); const K = KK.wildcatEnd; const { k } = out.Dk; const boss = w.agents[out.Dk.boss]; const ws = out.Dk.ws.map(id => w.agents[id]); const reset = D.reset;
      const strike = () => { reset(); plain(boss); setCash(boss, 2000); steady(() => MARKET.unrest(w, npcs(), day(), true)); const until = M.strike[k]; M.endQ = M.endQ || {}; M.endQ[k] = { d: day(), until }; return { k, d: day(), until }; };
      let c = strike(); const lead = w.agents[M.walk[k].lead]; setAff(boss, lead, -30); const f = K.facts(w, boss, c); collect(K, boss, c); mkPrompt('wildcatEnd', boss, c);
      E.facts = { sec: f.includes(MARKET.name(k)), n: /5 個工人|5 workers/.test(f), lead: has(f, lead) && f.includes(t('處不來')), rate: /60%/.test(f), want: /75%/.test(f), cash: /2000/.test(f), cost: /多付 \d+ 銀幣|about \d+ silver more/.test(f) };
      E.ids = ids(K, boss, c).join();
      const n0 = logs().length; const L1 = leak(() => runOp(K, boss, c, 'give')); E.give = { pay: M.pay[k], log: logs().slice(n0).some(x => x.startsWith('🤝 {o}讓步了')), mem: memHas(ws[0], '罷工有用，{o}讓步加薪了。') && memHas(boss, '工人罷工兩天，我讓步把{s}的工資調高了。'), done: K.options(w, boss, c).length, leak: L1.leak };
      c = strike(); const a0 = aff(ws[0], boss); const n1 = logs().length; const L2 = leak(() => runOp(K, boss, c, 'hold')); E.hold = { pay: M.pay[k], log: logs().slice(n1).some(x => x.startsWith('😠 {o}不肯讓步')), aff: r3(aff(ws[0], boss) - a0), mem: memHas(ws[0], '罷了兩天工，{o}還是不肯加薪。'), leak: L2.leak };
      c = strike(); const ld = w.agents[M.walk[k].lead]; const other = ws.find(x => x !== ld); const l0 = L.stats.laidOff; const a1 = aff(ld, boss), a2 = aff(other, boss); const n2 = logs().length; const L3 = leak(() => runOp(K, boss, c, 'fire'));
      E.fire = { job: ld.job?.key || null, since: L.jobless[ld.agentId] === day(), laid: L.stats.laidOff - l0, pay: M.pay[k], aff: r3(aff(ld, boss) - a1), others: r3(aff(other, boss) - a2), log: logs().slice(n2).some(x => x.startsWith('🚪 {o}不肯讓步')), mem: memHas(ld, '{o}因為我帶頭罷工，把我開除了。'), leak: L3.leak };
      // 傾向：心軟的讓；貪心、暴躁又跟帶頭的處不來的不讓，甚至開除
      c = strike(); const ld2 = w.agents[M.walk[k].lead]; boss.personality.traits = ['kind']; const pKind = steady(() => pick(K, boss, c)); boss.personality.traits = ['greedy', 'abrasive']; setAff(boss, ld2, -60); const pMean = steady(() => pick(K, boss, c)); const mGiveMean = marg(K, boss, c, 'give');
      plain(boss); setAff(boss, ld2, 0); const mGivePlain = marg(K, boss, c, 'give'); E.lean = { pKind, pMean, mGiveMean, mGivePlain };
      rates.endGive = rate(K, boss, c, ['give']); rates.endGiveGreedy = rate(K, boss, c, ['give'], 800, ['greedy']); rates.endFire = rate(K, boss, c, ['fire']);
      // 作廢：已經回答過、店換了東家、事情過了三天
      E.void = { old: K.options(w, boss, { ...c, d: day() - 3 }).length, other: K.options(w, ws[0], c).length };
      // 從每天的流程接進來：罷工結束隔天問東家；東家不在鎮上，或不帶「交給本人」，照原本的規則
      c = strike(); delete M.endQ[k]; const na = asked.length; steady(() => MARKET.endStrikes(w, npcs(), c.until + 1, true)); const q = asked.slice(na).filter(e => e.kind === 'wildcatEnd'); E.flow = { asked: q.length === 1 && q[0].who === boss.agentId, done: !!M.endQ?.[k]?.done };
      c = strike(); delete M.endQ[k]; const nb = asked.length; boss.currentLocation = 'exploration'; fixR(0.9, () => MARKET.endStrikes(w, npcs(), c.until + 1, true)); boss.currentLocation = 'town_square'; E.away = { asked: asked.slice(nb).length, pay: M.pay[k] };
      c = strike(); delete M.endQ[k]; const nc = asked.length; boss.personality.traits = ['greedy']; fixR(0.9, () => MARKET.endStrikes(w, npcs(), c.until + 1)); const payHi = M.pay[k]; M.pay[k] = 0.6; fixR(0.1, () => MARKET.endStrikes(w, npcs(), c.until + 1)); E.off = { asked: asked.slice(nc).length, hi: payHi, lo: M.pay[k] }; plain(boss);
      // 收尾：把這一行還回去
      reset(); M.pay[k] = 1; delete M.low[k]; M.strike = {}; delete M.walk[k]; if (M.endQ) delete M.endQ[k]; if (M.strikers) delete M.strikers[k]; for (const x of ws.concat(boss)) setJob(x, 'farmer'); if (out.Dk.own0) M.owners[k] = out.Dk.own0; else delete M.owners[k]; UNION.S(w).on = out.Dk.uOn0; clearQ(); }
    out.E = E;

    // ============ F 教團想請你當神職 ============
    const F = {}; { trimLog(); const K = KK.ordain; const Fa = FAITH.S(w); const Cc = CLERGY.S(w); const R = Fa.rels[0]; F.has = !!R && CLERGY.on(w);
      if (F.has) { const p1 = take(), p2 = take(), e1 = take(); for (const x of npcs()) { if (x.job?.key === 'priest') setJob(x, 'farmer'); const fx = Fa.of[x.agentId]; if (fx && fx.rel === R.id && (fx.piety || 0) >= 65) fx.piety = 60; }
        for (const x of [p1, p2, e1]) { lone(x); setCash(x, 30); x.age = 35; } setJob(p1, null); setJob(p2, null); setJob(e1, 'blacksmith'); Fa.of[p1.agentId] = { rel: R.id, piety: 96 }; Fa.of[p2.agentId] = { rel: R.id, piety: 92 }; Fa.of[e1.agentId] = { rel: R.id, piety: 90 };
        Cc.inc[R.id] = Array(14).fill(200); Cc.no = {}; Cc.ask = {}; L.jobless[p1.agentId] = day() - 5; const c = { r: R.id, d: day() }; F.cap = CLERGY.cap(w, R);
        const f = K.facts(w, p1, c); collect(K, p1, c); mkPrompt('ordain', p1, c); const rn = I18N.getLang?.() === 'en' ? (R.name[1] || R.name[0]) : R.name[0];
        F.facts = { rel: f.includes(rn), piety: /96/.test(f), pay: f.includes(String(LABOR.payOf(w, 'priest'))), idle: /已經 5 天沒有工作|out of work for 5 days/.test(f), cash: /30/.test(f) }; F.ids = ids(K, p1, c).join();
        const f2 = K.facts(w, e1, c); collect(K, e1, c); F.factsE = { job: f2.includes(jobT('blacksmith')), pay: f2.includes(String(LABOR.payOf(w, 'blacksmith'))), quit: f2.includes(t('留在原本的工作')) || /放下這份工作|giving that job up/.test(f2) };
        const in0 = Cc.st.in; const n0 = logs().length; const L1 = leak(() => runOp(K, p1, c, 'yes')); F.yes = { job: p1.job?.key, in: Cc.st.in - in0, jobless: L.jobless[p1.agentId] == null, mem: memHas(p1, '{r}的奉獻養得起多一位神職，我去當神職了。'), log: logs().slice(n0).some(x => x.startsWith('⛪ {r}的奉獻夠養多一位神職')), again: K.options(w, p1, c).length, leak: L1.leak };
        const n1 = logs().length; const L2 = leak(() => runOp(K, p2, c, 'no')); F.no = { job: p2.job?.key || null, until: Cc.no[p2.agentId] === day() + 28, mem: memHas(p2, '{r}想請我當神職，我沒有答應。'), log: logs().slice(n1).some(x => x.startsWith('⛪ {r}想請{a}當神職')), again: K.options(w, p2, c).length, leak: L2.leak };
        // 有工作的人：答應就放下原本的工作
        const L3 = leak(() => runOp(K, e1, c, 'yes')); F.quit = { job: e1.job?.key, mem: memHas(e1, '{r}的奉獻養得起多一位神職，我放下原本的工作，去服事{r}。'), leak: L3.leak };
        // 傾向：越虔誠、不看重錢的越肯去；貪心、原本工資高、對手藝很投入的留下；教團薪水發不齊的時候比較不肯
        setJob(e1, 'blacksmith'); e1.personality.traits = ['ascetic']; Fa.of[e1.agentId].piety = 100; const mYesDevout = marg(K, e1, c, 'yes'); e1.personality.traits = ['greedy']; e1.personality.values = ['財富']; Fa.of[e1.agentId].piety = 86; setSkill(e1, 'blacksmith', 12, '狂熱'); const mYesGreedy = marg(K, e1, c, 'yes');
        plain(e1); noSkill(e1); Fa.of[e1.agentId].piety = 90; const mEmp = marg(K, e1, c, 'yes'); setJob(p2, null); delete Cc.no[p2.agentId]; plain(p2); const mIdle = marg(K, p2, c, 'yes'); F.lean = { mYesDevout, mYesGreedy, mEmp, mIdle };
        rates.ordIdle = rate(K, p2, c, ['yes']); rates.ordEmp = rate(K, e1, c, ['yes']);
        // 作廢：教團養不起了、婉拒過、已經是神職、不夠虔誠的在職者、事情過了三天
        F.void = { old: K.options(w, p2, { ...c, d: day() - 3 }).length }; Cc.inc[R.id] = Array(14).fill(0); const f0 = R.fund; R.fund = 0; F.void.cap = K.options(w, p2, c).length; Cc.inc[R.id] = Array(14).fill(200); R.fund = f0; Fa.of[e1.agentId].piety = 80; F.void.weak = K.options(w, e1, c).length; Fa.of[e1.agentId].piety = 90;
        // 從每週檢討接進來：最虔誠、沒工作的先被問；婉拒了就換問下一位；不帶「交給本人」照舊（沒工作的直接變神職、有工作的擲 50%）
        setJob(p1, null); setJob(p2, null); setJob(e1, 'blacksmith'); Cc.no = {}; Cc.ask = {}; const na = asked.length; steady(() => CLERGY.review(w, Cc, Fa, day(), true)); const q = asked.slice(na).filter(e => e.kind === 'ordain'); F.flow = { first: q[0]?.who === p1.agentId, n: q.length, p1: p1.job?.key || null };
        setJob(p1, null); setJob(p2, null); Cc.no = { [p1.agentId]: day() + 20 }; Cc.ask = {}; const nb = asked.length; steady(() => CLERGY.review(w, Cc, Fa, day(), true)); const q2 = asked.slice(nb).filter(e => e.kind === 'ordain'); F.next = { who: q2[0]?.who === p2.agentId, p1asked: q2.some(e => e.who === p1.agentId) };
        setJob(p1, null); setJob(p2, 'farmer'); Fa.of[p2.agentId].piety = 60; Cc.no = {}; Cc.ask = {}; const nc = asked.length; CLERGY.review(w, Cc, Fa, day()); F.off = { asked: asked.slice(nc).length, p1: p1.job?.key };
        setJob(p1, 'farmer'); Fa.of[p1.agentId].piety = 60; fixR(0.9, () => CLERGY.review(w, Cc, Fa, day())); const hi = e1.job?.key; fixR(0.1, () => CLERGY.review(w, Cc, Fa, day())); F.off.hi = hi; F.off.lo = e1.job?.key;
        for (const x of [p1, p2, e1]) { setJob(x, 'farmer'); Fa.of[x.agentId].piety = 60; } Cc.no = {}; Cc.ask = {}; clearQ(); } }
    out.F = F; out.rates = rates;

    // ============ 不帶「交給本人」時跟舊版一模一樣：拿舊版的原始碼在同一個狀態上對跑 ============
    const G = { err: OLD.err || null };
    if (OLD.LABOR && OLD.MARKET && OLD.CLERGY) { try { trimLog();
      const load = (src, name) => new Function(src + '; return ' + name + ';')(); const OL = load(OLD.LABOR, 'LABOR'), OM = load(OLD.MARKET, 'MARKET'), OC = load(OLD.CLERGY, 'CLERGY');
      const seeded = (seed, fn) => { let s = seed; Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; try { return fn(); } finally { Math.random = R0; } };
      const snap = () => ({ jobs: npcs().map(a => [a, a.job]), labor: JSON.stringify(w.labor), market: JSON.stringify(w.market), clergy: JSON.stringify(w.clergy), union: JSON.stringify(w.union), mems: npcs().map(a => [a, (a.memory?.entries || []).length]), log: (w.messageLog || []).length, rel: npcs().map(a => [a, JSON.stringify(Object.fromEntries(Object.entries(a.relationships?.relationships || {}).map(([id, r]) => [id, r.affinity])))]) });
      const restore = (S) => { for (const [a, j] of S.jobs) a.job = j; w.labor = JSON.parse(S.labor); w.market = JSON.parse(S.market); w.clergy = JSON.parse(S.clergy); w.union = JSON.parse(S.union); for (const [a, n] of S.mems) if (a.memory?.entries) a.memory.entries.length = Math.min(a.memory.entries.length, n); if (w.messageLog) w.messageLog.length = Math.min(w.messageLog.length, S.log); for (const [a, js] of S.rel) { const o = JSON.parse(js); for (const [id, v] of Object.entries(o)) if (a.relationships.relationships[id]) a.relationships.relationships[id].affinity = v; } };
      const state = (S) => JSON.stringify({ jobs: npcs().map(a => a.job?.key || '-'), labor: w.labor, strike: w.market.strike, pay: w.market.pay, low: w.market.low, strikes: w.market.strikes, cst: w.clergy?.st, owe: w.clergy?.owe, logs: (w.messageLog || []).slice(S.log).map(m => String(m.content || m.k || '')), mems: npcs().map(a => (a.memory?.entries || []).length), aff: npcs().map(a => Object.values(a.relationships?.relationships || {}).reduce((s, r) => s + (r.affinity || 0), 0)) });
      const same = (prep, oldFn, newFn, seeds) => { let n = 0, bad = 0, moved = 0; for (const seed of seeds) { prep(seed); const S = snap(); const before = state(S); seeded(seed, oldFn); const a = state(S); restore(S); seeded(seed, newFn); const b = state(S); restore(S); n++; if (a !== b) bad++; if (a !== before) moved++; } return { n, bad, moved }; };
      const people = adults().filter(x => free(x)); const seeds = [11, 22, 33, 44, 55, 66];
      // 每週的裁員、求職、轉行：每次先讓幾個人失業、把幾個人塞進同一行
      G.labor = same((seed) => { const P = people.slice(seed % 7, seed % 7 + 14); P.slice(0, 5).forEach(a => { a.job = null; }); P.slice(5, 14).forEach(a => { a.job = new Job(['guard', 'doctor', 'trader'][seed % 3]); }); w.labor.lastWeek = null; if (w.market.boss) { w.market.boss.cut = { wk: -1, n: 0 }; w.market.boss.took = {}; } },
        () => OL.weekly(w), () => LABOR.weekly(w), seeds);
      // 決策核心沒開、但每日流程帶了「交給本人」：一樣走舊路
      G.laborOff = same((seed) => { const P = people.slice(seed % 5, seed % 5 + 12); P.slice(0, 4).forEach(a => { a.job = null; }); P.slice(4, 12).forEach(a => { a.job = new Job(['researcher', 'cook'][seed % 2]); }); w.labor.lastWeek = null; if (w.market.boss) { w.market.boss.cut = { wk: -1, n: 0 }; w.market.boss.took = {}; } },
        () => OL.weekly(w), () => offDecide(() => LABOR.weekly(w, true)), seeds);
      // 罷工與東家的回應
      const ks = Object.keys(MARKET.SECTORS); const P2 = people.slice(0, 12); const bossX = P2[0];
      const prepM = (seed) => { const k = 'timber'; for (const x of npcs()) if (x.job?.key === 'carpenter') x.job = new Job('farmer'); w.market.owners[k] = bossX.agentId; if (w.market.rival) delete w.market.rival[k]; P2.slice(1, 8).forEach(a => { a.job = new Job('carpenter'); a.mood = 25; }); bossX.personality.traits = seed % 2 ? ['greedy'] : []; w.market.pay[k] = 0.6; w.market.low = w.market.low || {}; w.market.low[k] = day() - 30; w.market.strike = {}; if (w.union) w.union.on = false; };
      G.unrest = same(prepM, () => OM.unrest(w, npcs(), day()), () => MARKET.unrest(w, npcs(), day()), seeds);
      G.endStrikes = same((seed) => { prepM(seed); w.market.strike.timber = day() - 1; }, () => OM.endStrikes(w, npcs(), day()), () => MARKET.endStrikes(w, npcs(), day()), seeds);
      // 神職的每週檢討
      const Fa = FAITH.S(w); const R = Fa.rels[0];
      if (R) G.clergy = same((seed) => { const P = people.slice(12, 18); for (const x of npcs()) { if (x.job?.key === 'priest') x.job = new Job('farmer'); const fx = Fa.of[x.agentId]; if (fx && fx.rel === R.id && (fx.piety || 0) >= 65) fx.piety = 60; } P.forEach((a, i) => { Fa.of[a.agentId] = { rel: R.id, piety: 86 + i }; a.job = (seed % 2 && i === 5) ? null : new Job('blacksmith'); }); w.clergy.inc[R.id] = Array(14).fill(40); },
        () => OC.review(w, CLERGY.S(w), Fa, day()), () => CLERGY.review(w, CLERGY.S(w), Fa, day()), seeds);
      for (const x of npcs()) { if (!x.job && (x.age ?? 30) >= 16) x.job = new Job('farmer'); }
    } catch (e) { G.err = String(e.stack || e.message).slice(0, 400); } }
    out.G = G;

    // ============ 存讀檔 ============
    { const SV = {}; const k = 'mine'; const M = MARKET.S(w), L = LABOR.S(w); M.walk = M.walk || {}; M.walk[k] = { d: day(), n: 4, yes: ['x1'], no: ['x2'], on: 1, lead: 'x1' }; M.strikers = M.strikers || {}; M.strikers[k] = ['x1']; M.endQ = M.endQ || {}; M.endQ[k] = { d: day(), until: day() + 1 }; const Cc = CLERGY.S(w); Cc.no = { someone: day() + 9 }; L.dec = L.dec || {}; L.dec.test = 7;
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null; try { w2.loadSave(sv); w2.observerMode = true; } catch (e) { err = String(e.message); }
      let opErr = null; try { const a = Object.values(w2.agents).find(x => !x.isPlayer && !x.isDead); for (const kk of KEYS) KK[kk].options(w2, a, { d: day(), k, r: 'R1', from: 'farmer', to: 'miner', until: day() + 1 }); } catch (e) { opErr = String(e.message); }
      SV.save = { err, opErr, walk: w2.market?.walk?.[k]?.lead === 'x1', strikers: (w2.market?.strikers?.[k] || [])[0] === 'x1', endQ: w2.market?.endQ?.[k]?.until === day() + 1, no: w2.clergy?.no?.someone === day() + 9, dec: w2.labor?.dec?.test === 7 };
      delete M.walk[k]; delete M.strikers[k]; delete M.endQ[k]; Cc.no = {}; w2.reset?.(); out.SV = SV; }

    // ============ 開 AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const ps = []; let reply = []; ce._askJson = async (p) => { ps.push(String(p)); return reply; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { const S5 = out.Aids.map(id => w.agents[id]).concat([take()]).filter(Boolean).slice(0, 5); for (const x of S5) { lone(x); setJob(x, null); setCash(x, 30); x.age = 40; }
        const zero = () => { X0._gAsked = {}; X0._kAsked = {}; X0._asked = 0; X0._cDay = day(); X0.lastDay = day(); }; zero(); slotStub({ farmer: (n) => n + 3, doctor: (n) => n + 1 });
        // 求職：題目當場送出，採用它選的「先不找」與理由；用 jobs 那一組
        reply = [{ n: 1, pick: 'wait', why: 'model reason 113', feel: 'tired' }]; const n0 = seen.length; DECIDE.askNow(w, [{ a: S5[0], kind: 'jobSeek', ctx: { d: day() } }]); const pending = !seen.slice(n0).some(e => e.kind === 'jobSeek'); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(x => x.kind === 'jobSeek'); o.seek = { pending, id: e?.id, src: e?.src, reason: e?.reason, group: X0._gAsked.jobs, job: S5[0].job?.key || null };
        const p1 = ps.find(x => /wait＝/.test(x)) || ''; o.p1 = { codes: /fit:[a-z]+＝/.test(p1) && /wait＝/.test(p1), cjk: /[一-鿿]/.test(p1), sample: (p1.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 代號只抄了前半（fit）也對得上；回話時那個缺還在才接得到
        zero(); reply = [{ n: 1, pick: 'fit', why: 'steady work' }]; const n1 = seen.length; DECIDE.askNow(w, [{ a: S5[0], kind: 'jobSeek', ctx: { d: day() } }]); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); const e1 = seen.slice(n1).find(x => x.kind === 'jobSeek'); o.fit = { src: e1?.src, id: (e1?.id || '').split(':')[0], job: !!S5[0].job };
        // 額度：同一類一天最多三件問 AI，其餘當場照個性決定（職缺照樣一個一個扣）
        zero(); setJob(S5[0], null); reply = []; const n2 = seen.length; steady(() => JOBS.seek(w, S5, day())); const ruled = seen.slice(n2).filter(x => x.kind === 'jobSeek' && x.src === 'rule').length; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.quota = { ai: X0._kAsked.jobSeek, ruled, total: seen.slice(n2).filter(x => x.kind === 'jobSeek').length, group: X0._gAsked.jobs };
        // 首長裁人用公家那一組
        if (head) { zero(); for (const x of S5) { setJob(x, 'guard'); noSkill(x); } slotStub({ guard: (n) => n - 4 }); const B0 = MARKET.S(w).boss; if (B0) B0.cut = { wk: -1, n: 0 }; reply = [{ n: 1, pick: 'keep', why: 'not this week' }]; const n3 = seen.length; JOBS.cutAsk(w, head, 'guard', day()); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); const e3 = seen.slice(n3).find(x => x.kind === 'pubCut'); o.cut = { src: e3?.src, id: e3?.id, civic: X0._gAsked.civic, jobs: X0._gAsked.jobs || 0 }; }
        slotReal(); for (const x of S5) setJob(x, 'farmer'); }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }
    out.prompts = Object.fromEntries(Object.entries(prompts).map(([k, p]) => [k, { len: String(p).length, err: /^ERR/.test(p) ? p : null, cjk: /[一-鿿]/.test(p), sample: (String(p).match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] }]));

    // ============ 放著跑 ============
    { const errs0 = []; const tick = () => { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } }; const d0 = day(); const n0 = asked.length; const s0 = seen.length; MM.lastT = MONEY.total(w) - (MM.pend || 0);
      for (let i = 0; i < LONG; i++) { tick(); if (i % 10 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, Dd] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(Dd.other || 0);
      const per = {}; for (const e of asked.slice(n0)) per[e.kind] = (per[e.kind] || 0) + 1; const pk = {}; for (const e of seen.slice(s0)) pk[e.kind + '.' + e.id.split(':')[0]] = (pk[e.kind + '.' + e.id.split(':')[0]] || 0) + 1;
      out.run = { errs: errs0.slice(0, 3), days: day() - d0, kinds: per, picks: pk, other: Math.round(other * 100) / 100, unemp: LABOR.unemployed(w).length }; }
    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-300).map(loc);
    out.texts = texts.filter(Boolean).map(loc);
    out.logTexts = (w.messageLog || []).filter(m => /^(💼|🎓|🔁|📉|🪑|✊|😶|🤝|😠|🚪|⛪)/.test(String(m.k || m.content || ''))).slice(-200).map(m => loc(String(m.content || '')));
    return out; }, { KEYS, LONG, OLD });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 60 && r.head, `${tag} 決策核心開著，鎮上 ${r.pop} 人，首長在鎮上`, { on: r.on, pop: r.pop, head: r.head });
  { const g = Object.fromEntries(r.reg.map(x => [x.k, x]));
    ok(r.reg.every(x => !x.missing && x.scan === false && x.title) && r.total === 187, `${tag} 登記了六種新的選擇點，都由那一刻送進來（共 ${r.total} 種）`, r.reg);
    ok(g.jobSeek.g === 'jobs' && g.jobSeek.kind === 3 && g.jobSwitch.g === 'jobs' && g.wildcat.g === 'jobs' && g.wildcat.kind === 3 && g.wildcatEnd.g === 'jobs' && g.ordain.g === 'jobs' && g.pubCut.g === 'civic' && g.pubCut.kind === 2 && r.groups.jobs === 8 && r.groups.work === 6 && r.groups.civic === 6 && r.groups.flag, `${tag} 額度：求職、改行、罷工、東家回應、神職用自己的一組 jobs（一天 8 件），首長裁人用 civic（一天 6 件）；原本各組的數字沒動`, { reg: r.reg, groups: r.groups }); }
  { const A = r.A;
    ok(Object.values(A.facts).every(Boolean), `${tag} 求職：事實裡有失業幾天、每個缺人的行業（缺幾人、工資）、最做得來的那一行與手藝、工資最高的那一行、身上的錢`, A.facts);
    ok(/^fit:farmer,pay:doctor,wait$/.test(A.ids), `${tag} 選項：去做最做得來的、去做工資最高的、這禮拜先不找`, A.ids);
    ok(A.fit.job === 'farmer' && A.fit.hired === 1 && A.fit.jobless && A.fit.mem && A.fit.log && A.fit.left === 1 && A.fit.leak === 0, `${tag} 去做最做得來的：當上農夫，那一行的缺少一個，日誌與記憶照原本的寫`, A.fit);
    ok(A.pay.job === 'doctor' && A.pay.left === 0 && A.pay.again === 0 && A.pay.leak === 0, `${tag} 去做工資最高的：當上醫生；有了工作，這一題就作廢`, A.pay);
    ok(A.wait.job === null && A.wait.since && A.wait.mem && A.wait.log && !A.wait.sad && A.wait.still && A.wait.leak === 0, `${tag} 先不找：還是沒有工作（從今天算失業），看得到日誌與記憶，不算「找不到工作」`, A.wait);
    ok(A.late.left === 0 && A.late.job === null && /晚了一步|Too late/.test(A.late.res) && A.late.leak === 0, `${tag} 晚了一步：想好的時候缺已經被補走，沒有工作也不會超收`, A.late);
    ok(A.void.old === 0 && A.void.hasJob === 0 && A.void.none === 0, `${tag} 作廢：事情過了三天、已經有工作、鎮上沒有缺`, A.void);
    ok(A.learn.ids === 'fit,wait,learn' && A.learn.fact && A.learn.called === 1 && A.learn.job === null && /30/.test(A.learn.res), `${tag} 有師傅肯收時多一項「拜師」：走原本的拜師，學的這段時間沒有工作`, A.learn);
    ok(A.lean.mWaitRich > A.lean.mWaitPoor + 1 && A.lean.mPayGreedy > A.lean.mPayPlain + 0.3 && A.lean.mPayCant < A.lean.mPayPlain - 1 && A.lean.plain === 'fit', `${tag} 照個性：懶又有積蓄的可以等，又窮又餓的不等；看重錢的挑工資高的；天生做不來的那一行不去`, A.lean);
    ok(A.order.asked && A.order.jobs === 'farmer,farmer,-,-' && A.order.ruled === 2 && A.order.s3since && A.order.leak === 0, `${tag} 職缺是共用的：兩個缺、四個人，照順序問，前兩個接走，後兩個沒有缺（找不到工作）`, A.order);
    ok(A.away.asked === 0 && A.away.job === null, `${tag} 人出去探險：這禮拜不問，回來再找`, A.away); }
  { const B = r.B;
    ok(Object.values(B.facts).every(Boolean) && B.ids === 'stay,move', `${tag} 改行：事實裡有兩行的人數與名額、會不會裁人、兩邊的手藝與工資；選項：留下、改行`, { f: B.facts, ids: B.ids });
    ok(B.move.job === 'miner' && B.move.sw === 1 && B.move.mem && B.move.log && B.move.again === 0 && B.move.leak === 0 && B.stay.job === 'trader' && B.stay.leak === 0, `${tag} 改行：換成礦工，日誌與記憶照原本的寫；留下：什麼都沒變`, { m: B.move, s: B.stay });
    ok(B.lean.mGood > B.lean.mLove + 0.6 && B.lean.mCant < -0.8, `${tag} 照個性：新的一行比較拿手的肯換；對現在這門手藝很投入的不換；天生做不來的不換`, B.lean);
    ok(B.void.gone === 0 && /晚了一步|Too late/.test(B.void.late) && B.void.lateJob === 'trader' && B.void.leak === 0 && B.void.notOver === 0 && B.void.old === 0 && B.void.moved === 0, `${tag} 作廢：缺被補走（想好了也換不成）、這一行已經不嫌多、自己換了工作、事情過了三天`, B.void);
    ok(B.ask === 2, `${tag} 最適合新工作的兩個人各被問一次`, B.ask); }
  { const C = r.C;
    ok(Object.values(C.facts).every(Boolean) && C.ids, `${tag} 首長裁人：事實裡有這一行的人數與名額、公庫發的工資、公庫的錢、可以請走的人（最生疏的兩位加上跟首長有過節的）與交情、這週已經裁了幾人`, { f: C.facts, ids: C.ids });
    ok(C.cut.job === null && C.cut.since && C.cut.laid === 1 && C.cut.week === 1 && C.cut.aff === -6 && C.cut.mem && C.cut.log && C.cut.leak === 0, `${tag} 請某人另外找工作：他沒了工作、記得是首長決定的（好感 -6），算進這週的裁員人數`, C.cut);
    ok(C.keep.leak === 0 && C.keep.laid === 1, `${tag} 這禮拜不裁人：什麼都沒發生`, C.keep);
    ok(C.lean.pKind === 'keep' && C.lean.pTight === 'cut' && C.lean.mKeepKind > C.lean.mKeepTight + 1 && C.lean.foe > C.lean.friend + 0.6, `${tag} 照個性：心軟、跟大家交情好的首長不裁；公庫吃緊、節儉的裁；有過節的比朋友容易被請走`, C.lean);
    ok(C.void.notHead === 0 && C.void.old === 0 && C.void.two === 0 && C.void.fine === 0 && C.void.private === 0 && C.void.pubJob, `${tag} 作廢：不是首長、事情過了三天、這週已經裁了兩個、這一行不嫌多了；有東家的行業不歸首長管`, C.void);
    ok(C.flow.asked && C.flow.who && C.flow.guard, `${tag} 從每週流程接進來：公職人太多時問首長（一週最多問兩行）`, C.flow);
    ok(C.away.asked === 0 && C.away.laid >= 1 && C.away.noHead && C.away.g1 !== 'guard', `${tag} 首長不在鎮上：照原本的規則裁`, C.away);
    ok(C.off.asked === 0 && C.off.laid >= 1 && C.off.log && C.off.mem && C.off.g1 !== 'guard' && C.off2.asked === 0 && C.off2.g1 !== 'guard', `${tag} 不帶「交給本人」或決策核心沒開：沒有人被問，照原本的規則裁（日誌也是原本那一句）`, { off: C.off, off2: C.off2 }); }
  { const D = r.D;
    ok(Object.values(D.facts).every(Boolean) && D.ids === 'out,bear' && D.idsU === 'out,bear,union', `${tag} 罷工：事實裡有東家、工資壓到幾成、壓了幾天、自己領多少與行情、幾個人、要幾個人站出來、身上的錢；選項：站出來、再忍一忍；鎮上有工會時多一項「去加入工會」`, { f: D.facts, ids: D.ids, u: D.idsU });
    ok(D.union.member && D.union.no && D.union.again === 0 && D.union.leak === 0, `${tag} 去加入工會：成了會員，這次不罷工`, D.union);
    ok(D.lean.mBad > D.lean.mFriend + 0.4 && D.lean.mBad > D.lean.mPoor + 0.2 && D.lean.mBad > D.lean.mMild + 0.5, `${tag} 照個性：壓得低、壓得久、心情差的想罷；跟東家交情好、手頭很緊的忍`, D.lean);
    ok(D.void.raised === 0 && D.void.voted === 0 && D.void.old === 0, `${tag} 作廢：東家已經加薪、已經表過態、事情過了兩天`, D.void);
    ok(D.all.asked === 5 && D.all.strike && D.all.n === 5 && D.all.strikes === 1 && D.all.on && !D.all.boss && D.all.lead && D.all.log && D.all.mem && D.all.leak === 0, `${tag} 從每週流程接進來：五個工人都被問；都站出來，罷工兩天，記下帶頭的人`, D.all);
    ok(D.part.strike && D.part.outs === 3 && D.part.on === '11100' && D.part.paid && D.part.boss && D.part.no === 2 && D.part.leak === 0, `${tag} 三個站出來、兩個照常上工：罷得成；只有站出來的人不上工、沒工資，照常上工的領得到`, D.part);
    ok(D.fizzle.strike && D.fizzle.yes === 1 && D.fizzle.log && D.fizzle.mem && !D.fizzle.on, `${tag} 只有一個人站出來：罷不成，大家照常上工，日誌看得到`, D.fizzle);
    ok(D.calm.asked === 0, `${tag} 心情不差、壓得還不久：沒有人提罷工`, D.calm);
    ok(D.off.asked === 0 && D.off.high && D.off.low && D.off.all && D.off.list, `${tag} 不帶「交給本人」：照舊擲骰（擲到才罷，整行一起，沒有人被問）`, D.off); }
  { const E = r.E;
    ok(Object.values(E.facts).every(Boolean) && E.ids === 'give,hold,fire', `${tag} 東家：事實裡有幾個人罷工、帶頭的人與交情、現在的工資、讓步要調到多少與一週多付多少、身上的錢；選項：讓步、不讓步、開除帶頭的`, { f: E.facts, ids: E.ids });
    ok(E.give.pay === 0.75 && E.give.log && E.give.mem && E.give.done === 0 && E.give.leak === 0, `${tag} 讓步：工資從 60% 調到 75%，日誌照原本的寫；回答過就作廢`, E.give);
    ok(E.hold.pay === 0.6 && E.hold.log && E.hold.aff === -4 && E.hold.mem && E.hold.leak === 0, `${tag} 不讓步：工資照舊，罷工的人對東家的好感變差`, E.hold);
    ok(E.fire.job === null && E.fire.since && E.fire.laid === 1 && E.fire.pay === 0.6 && E.fire.aff === -25 && E.fire.others === -8 && E.fire.log && E.fire.mem && E.fire.leak === 0, `${tag} 開除帶頭的：他沒了工作，其他罷工的人也記在心裡，工資照舊`, E.fire);
    ok(E.lean.pKind === 'give' && E.lean.pMean !== 'give' && E.lean.mGivePlain > E.lean.mGiveMean + 0.8, `${tag} 照個性：心軟的讓步；貪心、暴躁又跟帶頭的處不來的不讓`, E.lean);
    ok(E.void.old === 0 && E.void.other === 0, `${tag} 作廢：事情過了三天；不是東家的人沒有這一題`, E.void);
    ok(E.flow.asked && E.flow.done, `${tag} 從每天的流程接進來：罷工結束隔天問東家`, E.flow);
    ok(E.away.asked === 0 && E.away.pay === 0.75, `${tag} 東家不在鎮上：照原本的規則（不貪心的讓步）`, E.away);
    ok(E.off.asked === 0 && E.off.hi === 0.6 && E.off.lo === 0.75, `${tag} 不帶「交給本人」：照舊（貪心的東家擲骰，擲到才讓）`, E.off); }
  { const F = r.F;
    ok(F.has && F.cap >= 3, `${tag} 鎮上有教團，養得起神職`, { has: F.has, cap: F.cap });
    if (F.has) {
      ok(Object.values(F.facts).every(Boolean) && F.ids === 'yes,no' && Object.values(F.factsE).every(Boolean), `${tag} 神職：事實裡有教團、虔誠度、神職的薪水、自己失業幾天或現在的工作與工資；選項：去、不去`, { f: F.facts, e: F.factsE, ids: F.ids });
      ok(F.yes.job === 'priest' && F.yes.in === 1 && F.yes.jobless && F.yes.mem && F.yes.log && F.yes.again === 0 && F.yes.leak === 0, `${tag} 去當神職：照原本的結算（日誌、記憶、不再算失業）`, F.yes);
      ok(F.no.job === null && F.no.until && F.no.mem && F.no.log && F.no.again === 0 && F.no.leak === 0, `${tag} 不去：四週內不再問他，日誌看得到`, F.no);
      ok(F.quit.job === 'priest' && F.quit.mem && F.quit.leak === 0, `${tag} 有工作的人答應：放下原本的工作`, F.quit);
      ok(F.lean.mYesDevout > F.lean.mYesGreedy + 1 && F.lean.mIdle > F.lean.mEmp + 0.4, `${tag} 照個性：很虔誠、不看重錢的肯去；貪心、對手藝很投入的留下；沒工作的比有工作的肯去`, F.lean);
      ok(F.void.old === 0 && F.void.cap === 0 && F.void.weak === 0, `${tag} 作廢：事情過了三天、教團養不起了、在職而不夠虔誠`, F.void);
      ok(F.flow.first && F.flow.n >= 1 && F.next.who && !F.next.p1asked, `${tag} 從每週檢討接進來：最虔誠、沒工作的先被問；婉拒過的不再問，換下一位`, { flow: F.flow, next: F.next });
      ok(F.off.asked === 0 && F.off.p1 === 'priest' && F.off.hi === 'blacksmith' && F.off.lo === 'priest', `${tag} 不帶「交給本人」：照舊（沒工作的直接變神職；有工作的擲骰）`, F.off); } }
  { const G = r.G;
    if (!OLD.LABOR || !OLD.MARKET || !OLD.CLERGY) console.log(`  （略過）${tag} 找不到舊版原始碼 ${OLD_REF}（${OLD.err || '沒有這個提交'}），沒有做新舊對跑`);
    else {
      ok(!G.err && G.labor && G.labor.n === 6 && G.labor.bad === 0 && G.labor.moved === 6, `${tag} 每週的裁員、求職、轉行，不帶「交給本人」時跟 v11.12.2 逐項相同（同一個狀態、同一串亂數對跑 ${G.labor?.n} 次，每次都真的有變動）`, G);
      ok(!G.err && G.laborOff && G.laborOff.bad === 0 && G.laborOff.moved === 6, `${tag} 決策核心沒開時（每日流程照樣帶「交給本人」）也跟 v11.12.2 逐項相同`, G.laborOff);
      ok(!G.err && G.unrest && G.unrest.bad === 0 && G.unrest.moved >= 2 && G.endStrikes && G.endStrikes.bad === 0 && G.endStrikes.moved >= 3, `${tag} 罷工與東家的回應，不帶「交給本人」時跟 v11.12.2 逐項相同`, { u: G.unrest, e: G.endStrikes });
      ok(!G.err && G.clergy && G.clergy.bad === 0 && G.clergy.moved >= 2, `${tag} 神職的每週檢討，不帶「交給本人」時跟 v11.12.2 逐項相同`, G.clergy); } }
  { const R = r.rates;
    console.log('    照個性的比例：' + JSON.stringify(R));
    ok(R.seekTake >= 0.8 && R.seekTake <= 0.98 && R.seekWait >= 0.02 && R.seekWait <= 0.2 && R.seekPay >= 0.1 && R.seekPay <= 0.45, `${tag} 求職：${R.seekTake} 接工作（其中挑工資高的 ${R.seekPay}）、${R.seekWait} 先不找（以前一定接；挑哪個照擅長加工資）`, R);
    ok(R.switchMove >= 0.35 && R.switchMove <= 0.9, `${tag} 改行：被問到的人 ${R.switchMove} 會換（以前最適合的那一位一定被轉走；現在問兩位，平均還是一週一位左右）`, R);
    ok(R.pubCut >= 0.5 && R.pubCut <= 0.93 && R.pubCutFoe > R.pubCut, `${tag} 首長裁人：${R.pubCut} 會裁（人數剛好多到要裁、跟人選沒有恩怨時；多了四個人、名單上有跟他過不去的人時 ${R.pubCutFoe}。以前一定裁）`, R);
    ok(R.wildOut >= 0.4 && R.wildOut <= 0.75 && R.wildStart >= 0.35 && R.wildStart <= 0.9, `${tag} 罷工：每個工人 ${R.wildOut} 站出來；六個人裡湊得到三個的機會 ${R.wildStart}（以前擲 50%）`, R);
    ok(R.endGive >= 0.55 && R.endGive <= 0.9 && R.endGiveGreedy >= 0.2 && R.endGiveGreedy <= 0.6 && R.endGiveGreedy < R.endGive - 0.15 && R.endFire <= 0.2, `${tag} 東家讓步：${R.endGive}（貪心的 ${R.endGiveGreedy}；開除帶頭的 ${R.endFire}。以前不貪心一定讓、貪心 40%）`, R);
    ok(R.ordIdle >= 0.7 && R.ordIdle <= 0.97 && R.ordEmp >= 0.3 && R.ordEmp <= 0.7, `${tag} 神職：沒工作的 ${R.ordIdle} 答應（以前一定去），有工作的 ${R.ordEmp}（以前 50%）`, R); }
  ok(!r.SV.save.err && !r.SV.save.opErr && Object.values(r.SV.save).slice(2).every(Boolean), `${tag} 存讀檔：罷工的表態、站出來的名單、等東家回話、婉拒當神職的冷卻，都存得下來，讀回來照常問`, r.SV.save);
  { const Mi = r.mind;
    ok(Mi.aiOn && Mi.seek && Mi.seek.pending && Mi.seek.id === 'wait' && Mi.seek.src === 'ai' && Mi.seek.reason === 'model reason 113' && Mi.seek.group === 1 && Mi.seek.job === null, `${tag} 開 AI：求職的題目送出、等回話，採用它選的「先不找」與理由，用 jobs 那一組`, Mi.seek);
    ok(Mi.p1 && Mi.p1.codes && (zh || !Mi.p1.cjk), `${tag} 題目裡有選項代號${zh ? '' : '，英文題目裡沒有中文'}`, Mi.p1);
    ok(Mi.fit && Mi.fit.src === 'ai' && Mi.fit.id === 'fit' && Mi.fit.job, `${tag} 開 AI：代號只抄前半（fit）也對得上，接到工作`, Mi.fit);
    ok(Mi.quota && Mi.quota.ai === 3 && Mi.quota.ruled === 2 && Mi.quota.total === 5 && Mi.quota.group === 3, `${tag} 額度：求職一天最多三件問 AI，其餘當場照個性決定`, Mi.quota);
    ok(Mi.cut && Mi.cut.src === 'ai' && Mi.cut.id === 'keep' && Mi.cut.civic === 1 && Mi.cut.jobs === 0, `${tag} 開 AI：首長裁人用公家那一組（civic）`, Mi.cut); }
  { const P = r.prompts; const got = Object.keys(P);
    ok(got.length === 6 && got.every(k => !P[k].err && P[k].len > 200), `${tag} 六種題目都組得出來`, Object.fromEntries(got.map(k => [k, P[k].err || P[k].len])));
    ok(zh || got.every(k => !P[k].cjk), `${tag} 英文題目裡沒有中文（逐一檢查）`, zh ? null : got.filter(k => P[k].cjk).map(k => [k, P[k].sample])); }
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.days === LONG && Ru.other === 0, `${tag} 放著跑 ${Ru.days} 天：沒有錯誤、帳上沒有對不上的錢（問了：${JSON.stringify(Ru.kinds)}；選了：${JSON.stringify(Ru.picks)}；最後失業 ${Ru.unemp} 人）`, Ru); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk) && !r.logTexts.some(cjk)), `${tag} 標題、事實、選項、理由、結果、日誌都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4), logs: r.logTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  if (process.env.DUMP) console.log('---- 題目與選項的文字 ----\n' + [...new Set(r.texts)].join('\n') + '\n---- 日誌 ----\n' + [...new Set(r.logTexts)].slice(-40).join('\n')); // DUMP=1：把文字印出來人工看
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
