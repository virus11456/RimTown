// v11.11.0 窮與貪：窮到想偷、家人闖禍要錢、塞錢與收錢、買報社、下台以後做什麼
//   A) 偷不偷(steal)：動念的時機看天，動念之後忍著／偷某人／去借／去求救濟由本人決定；偷了之後抓不抓得到照舊看天
//   B) 家人闖了禍要錢(kinPay)：罰款付不出來、賭債到期，被問到的家人決定替他付清／付一半／這次不付（不付就問下一位）
//   C) 議會：提案人塞不塞、塞給誰(bribeVote)；議員收下改投／退回／告發(bribeTake)；還有人在想時表決延到隔天
//   D) 議員選舉買票：候選人走「選戰怎麼打」(dirty)，被找上的人收了照投／收了不照投／不收(bribeTake)
//   E) 反壟斷：老闆塞錢／不塞／公開反駁(trustFight)；被找上的人收不收(bribeTake)
//   F) 買報社(buyPaper)：前三有錢的人各自決定，第一個說要的買到
//   G) 選輸、任期結束、被罷免的首長：先照慣例當商人，再由本人決定之後做什麼(afterOffice)
//   共同：登記與額度、事實與選項、每個選項的後果、照個性的傾向、決策核心沒開時不發生、作廢、存讀檔、開 AI、英文題目沒有中文、錢守恆、放著跑 30 天
// 用法：BASE=http://localhost:8196/ node scripts/v111100_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8196/'; const LONG = +(process.env.LONG || 30);
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['steal', 'kinPay', 'bribeVote', 'trustFight', 'bribeTake', 'buyPaper'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { const x = m.text(); if (/\[(Order|Home|Civic|Assembly|Compete|Power|Money|Casino|Election|Repeal)\]/.test(x) || /\[Decide\] (run|options|ai) (steal|kinPay|bribeVote|trustFight|bribeTake|buyPaper|dirty|afterOffice)\b/.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 300)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async ({ KEYS, LONG }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 111 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); tick1(); out.on = DECIDE.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && a.currentLocation !== 'exploration');
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X0 = DECIDE.S(w); const KK = DECIDE.KINDS; const texts = []; const H = HOME.S(w); const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.concat('dirty', 'afterOffice', 'caught', 'asked').includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.concat('afterOffice', 'caught', 'asked').includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; a.moodModifier = 0; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const unpair = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married' || r.status === 'dating') { r.status = 'friend'; const o = w.agents[r.targetId]; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) r2.status = 'friend'; } };
    const orphan = (a) => { a._parentNames = []; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
    const wed = (a, b) => { unpair(a); unpair(b); const r1 = a.relationships.getOrCreate(b.agentId, b.name), r2 = b.relationships.getOrCreate(a.agentId, a.name); r1.status = 'married'; r2.status = 'married'; };
    const zeroAff = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) r.affinity = 0; };
    const pick = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    const marg = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id) === id || String(o.id).split(':')[0] === id); if (!me) return null; const others = ops.filter(o => o !== me).map(o => DECIDE.score(Ln, o)); return r3(DECIDE.score(Ln, me) - Math.max(...others)); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    const runOp = (K, a, ctx, id) => { const op = opOf(K, a, ctx, id); if (!op) return null; const res = op.run(w, a, ctx); DECIDE.record(w, X0, a, K, op, op.why || null, res, 'rule', day(), ctx); return res; };
    const collect = (K, a, ctx) => { try { texts.push(t(K.title), K.facts(w, a, ctx)); for (const o of K.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); } catch (e) { texts.push('ERR ' + e.message); } };
    const prompts = {}; const mkPrompt = (k, a, ctx, kind) => { try { const K = KK[kind || k]; const opts = K.options(w, a, ctx); if (!opts.length) { prompts[k] = 'ERR no options'; return; } prompts[k] = DECIDE.prompt(w, K, [{ a, ctx, opts }]); } catch (e) { prompts[k] = 'ERR ' + e.message; } };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const fixR = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = R0; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const memHas = (a, k) => (a.memory?.entries || []).some(e => e.k === k);
    const setJob = (a, k) => { try { a.job = new Job(k); } catch (e) {} };
    const has = (s, a) => s.includes(a.name) || s.includes(t(a.name)) || (typeof I18N !== 'undefined' && I18N.localizeNames ? s.includes(I18N.localizeNames(a.name, true)) : false);
    const clearQ = () => { X0.q.length = 0; };
    // 照個性那條路的比例：把鎮上每個大人的個性輪流套在同一個情境上，加上當天心情起伏（固定種子），看選到某幾項的比例
    let seedS = 12345; const rng = () => { seedS = (seedS * 1103515245 + 12345) & 0x7fffffff; return seedS / 0x7fffffff; };
    const rate = (K, a, ctx, okIds, N = 800) => { const pool = npcs().filter(x => (x.age ?? 30) >= 16); const keep = JSON.parse(JSON.stringify(a.personality)); let hit = 0, n = 0;
      try { for (let i = 0; i < N; i++) { const src = pool[i % pool.length]; a.personality.traits = (src.personality.traits || []).slice(); a.personality.values = (src.personality.values || []).slice(); const ops = K.options(w, a, ctx); if (ops.length < 2) continue; const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s2 = DECIDE.score(Ln, op) + (rng() - 0.5) * 1.8; if (s2 > bs) { bs = s2; best = op; } } n++; if (okIds.includes(String(best.id).split(':')[0])) hit++; } } finally { a.personality = Object.assign(a.personality, keep); }
      return n ? Math.round(hit / n * 1000) / 1000 : null; };
    const rates = {};
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    const used = new Set(); const curM = () => { try { return w.election?.currentMayor?.(w)?.agentId || null; } catch (e) { return null; } }; const free = (x) => !used.has(x.agentId) && x.job?.key !== 'mayor' && x.agentId !== curM() && w.crown?.king !== x.agentId && !(w.council?.members || []).includes(x.agentId); const take = (f) => { const a = adults().find(x => free(x) && (!f || f(x))) || adults().find(free); if (a) used.add(a.agentId); return a; };
    const mayorA = adults().find(a => a.job?.key === 'mayor'); if (mayorA) used.add(mayorA.agentId);
    out.pop = npcs().length;

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup || null, kind: KK[k].aiKind || null, title: t(KK[k].title) } : { k, missing: 1 });
    out.total = Object.keys(KK).length;

    // ============ A 偷不偷 ============
    const A = {}; { const Cv = CIVIC.S(w); const th = take(), far = take(), known = take(), foe = take(), lend = take();
      for (const x of [th, far, known, foe, lend]) { plain(x); orphan(x); unpair(x); }
      th.personality.traits = ['lazy']; zeroAff(th); for (const o of npcs()) if (o !== th) { const r = o.relationships?.relationships?.[th.agentId]; if (r) r.affinity = 0; }
      // 鎮上的有錢人都壓到 60 以下，只留這三位（測完再還回去）
      const back = []; for (const o of npcs()) if (![far, known, foe, lend].includes(o) && cash(o) >= 60) { back.push([o, cash(o)]); WALLET.take(w, o, cash(o) - 50); }
      const parked = back.reduce((s2, x) => s2 + (x[1] - 50), 0); w.stockpile.add('silver', parked, w.tickCount, 'test park');
      setCash(th, 2); setCash(far, 400); setCash(known, 300); setCash(foe, 250); setCash(lend, 55); setAff(th, known, 40); setAff(th, foe, -50); setAff(lend, th, 40); setAff(th, lend, 30);
      MARKET.S(w).hungry[th.agentId] = 3; Cv.tlog = [day(), day() - 1, day() - 2, day() - 3]; Cv.clog = [day(), day() - 2]; H.law.theft = 'harsh';
      const guards = npcs().filter(g => g.job?.key === 'guard' && !CIVIC.jailed(w, g)).length;
      const K = KK.steal; const c = { d: day() }; const f = K.facts(w, th, c); collect(K, th, c); mkPrompt('steal', th, c);
      A.facts = { cash: /你身上只剩 2 銀幣，已經 3 天沒吃飽了|You have only 2 silver left, and you have not eaten properly for 3 days/.test(f), far: has(f, far), known: has(f, known) && f.includes(t('有錢，你們認識')), foe: has(f, foe) && f.includes(t('有錢，跟你有過節')), guards: f.includes(`鎮上有 ${guards} 個守衛`) || f.includes(`The town has ${guards} guards`), recent: /最近兩週鎮上有 4 起竊案、抓到 2 個|there were 4 thefts and 2 people caught/.test(f), law: f.includes(fill('抓到了要把錢還回去，關 {d} 天（鎮上表決過，從重處罰）', { d: 5 })), lend: has(f, lend), relief: f.includes(t('也可以到鎮上開口求救濟')) || f.includes(fill('公庫還有 {s} 銀幣，也可以到鎮上開口求救濟（提案請公庫撥 20 銀幣，要大家投票）。', { s: Math.floor(w.stockpile.get('silver')) })) };
      const ops = K.options(w, th, c).map(o => String(o.id)); A.ids = { hold: ops.includes('hold'), far: ops.includes('take:' + far.agentId), known: ops.includes('take:' + known.agentId), foe: ops.includes('take:' + foe.agentId), borrow: ops.includes('borrow:' + lend.agentId), beg: ops.includes('beg'), n: ops.length };
      // 每個選項的後果
      const t0 = Cv.thefts; const v0 = cash(far); const L1 = leak(() => fixR(0.99, () => runOp(K, th, c, 'take:' + far.agentId)));
      A.uncaught = { took: r3(v0 - cash(far)), got: r3(cash(th) - 2), thefts: Cv.thefts - t0, secret: (w.dark?.secrets || []).some(s => s.culprit === th.agentId && !s.found && /偷了/.test(s.k)), vmem: memHas(far, '我的錢包少了 {n} 銀幣，不知道是誰偷的。'), tmem: memHas(th, '我偷了{v}的 {n} 銀幣，沒有人發現。心裡七上八下的。'), leak: L1.leak, res: tx(L1.ret) };
      setCash(th, 2); const nq = asked.length; const c0 = Cv.caught; const v1 = cash(known); const L2 = leak(() => fixR(0, () => runOp(K, th, c, 'take:' + known.agentId)));
      A.caught = { caught: Cv.caught - c0, guard: asked.slice(nq).some(e => e.kind === 'caught' && e.ctx?.th === th.agentId && e.ctx?.days >= 5), leak: L2.leak }; clearQ(); delete Cv.jail[th.agentId];
      setCash(th, 2); const nq2 = asked.length; const L3 = leak(() => runOp(K, th, c, 'borrow:' + lend.agentId)); A.borrow = { asked: asked.slice(nq2).some(e => e.kind === 'asked' && e.who === lend.agentId && e.ctx?.from === th.agentId), leak: L3.leak, moved: r3(cash(th) - 2) }; clearQ();
      const np = (w.proposals.items || []).length; const L4 = leak(() => runOp(K, th, c, 'beg')); const rp = (w.proposals.items || []).slice(np).find(p => p.kind === 'relief'); A.beg = { made: !!rp, ref: rp?.refKey === th.agentId, by: rp?.proposerId === th.agentId, cost: rp?.cost?.silver, leak: L4.leak, again: !opOf(K, th, c, 'beg') };
      const L5 = leak(() => runOp(K, th, c, 'hold')); A.hold = { leak: L5.leak, cash: cash(th) };
      // 傾向：餓很久、家裡有小孩、守衛少、罰得輕的人偷；老實、罰得重、守衛多的人忍
      if (rp) rp.status = 'rejected';
      const mHungry = (() => { H.law.theft = 'light'; MARKET.S(w).hungry[th.agentId] = 5; const kid = npcs().find(k => (k.age ?? 30) < 16); const pn = kid?._parentNames; if (kid) kid._parentNames = [th.name]; const m = marg(K, th, c, 'take:' + far.agentId); if (kid) kid._parentNames = pn; return m; })();
      const mHonest = (() => { H.law.theft = 'harsh'; MARKET.S(w).hungry[th.agentId] = 0; th.personality.traits = ['kind', 'stoic']; const m = marg(K, th, c, 'take:' + far.agentId); th.personality.traits = ['lazy']; return m; })();
      const pk = (() => { H.law.theft = 'normal'; th.personality.traits = ['lazy']; setAff(th, known, 90); const a1 = marg(K, th, c, 'take:' + known.agentId); setAff(th, known, 10); const a2 = marg(K, th, c, 'take:' + known.agentId); return { close: a1, loose: a2 }; })();
      A.lean = { mHungry, mHonest, pk, plain: steady(() => pick(K, th, c)) };
      H.law.theft = 'normal'; MARKET.S(w).hungry[th.agentId] = 1; setAff(th, known, 40); rates.steal = rate(K, th, c, ['take']);
      // 作廢：身上有了錢、被關、念頭過了一天以上、有錢人走了
      setCash(th, 30); A.void = { rich: K.options(w, th, c).length }; setCash(th, 2);
      Cv.jail[th.agentId] = day() + 3; A.void.jail = K.options(w, th, c).length; delete Cv.jail[th.agentId];
      A.void.old = K.options(w, th, { d: day() - 2 }).length;
      setCash(foe, 30); A.void.foeGone = !K.options(w, th, c).some(o => String(o.id) === 'take:' + foe.agentId); setCash(foe, 250);
      // 從竊案接進來：動念的時機看天，動了就問本人；決策核心沒開就沒人動念、也沒有竊案
      const T0 = CIVIC.TEMPT.base; CIVIC.TEMPT.base = 1; CIVIC.TEMPT.slum = 1; const na = asked.length; const th0 = Cv.thefts;
      try { fixR(0, () => CIVIC.crime(w, Cv, day())); } finally { CIVIC.TEMPT.base = T0; CIVIC.TEMPT.slum = 0.19; }
      const qq = asked.slice(na).filter(e => e.kind === 'steal'); A.crime = { asked: qq.length, th: qq.some(e => e.who === th.agentId) }; clearQ();
      for (const x of npcs()) delete Cv.jail[x.agentId];
      setCash(th, 2); const nb = asked.length; const th1 = Cv.thefts; CIVIC.TEMPT.base = 1; try { offDecide(() => fixR(0, () => CIVIC.crime(w, Cv, day()))); } finally { CIVIC.TEMPT.base = T0; }
      A.off = { asked: asked.slice(nb).filter(e => e.kind === 'steal').length, thefts: Cv.thefts - th1 };
      out.Ath = th.agentId;
      // 有錢人的錢還回去
      for (const [o, n] of back) { const take2 = n - cash(o); if (take2 > 0 && w.stockpile.consume('silver', take2, w.tickCount, 'test unpark')) WALLET.add(w, o, take2); }
      H.law.theft = 'normal'; }
    out.A = A;

    // ============ B 家人闖了禍要錢 ============
    const B = {}; { const a = take(), sp = take(), dad = take(); for (const x of [a, sp, dad]) { plain(x); orphan(x); unpair(x); } wed(a, sp); a._parentNames = [dad.name]; setAff(sp, a, 30); setAff(dad, a, 30);
      setCash(a, 0); setCash(sp, 300); setCash(dad, 120); delete (w.money.fines || {})[a.agentId];
      const n0 = asked.length; const tr0 = w.stockpile.get('silver'); const L0 = leak(() => MONEY.fine(w, a, 40, t('罰款'))); const q = asked.slice(n0).filter(e => e.kind === 'kinPay');
      B.ask = { n: q.length >= 1, first: q[0]?.who === sp.agentId, src: q[0]?.ctx?.src, amt: q[0]?.ctx?.n, leak: L0.leak };
      // 照個性那條路可能當場就付了：重新造一個還沒付的情境來看題目
      const F = MONEY.S(w).fines || (MONEY.S(w).fines = {}); const reset = (n) => { F[a.agentId] = { owed: n, since: day(), why: t('罰款'), paid: 0 }; setCash(sp, 300); setCash(dad, 120); }; reset(40);
      const K = KK.kinPay; const c = { of: a.agentId, src: 'fine', n: 40, q: [dad.agentId], d: day() }; const f = K.facts(w, sp, c); collect(K, sp, c); mkPrompt('kinPay', sp, c);
      B.facts = { who: has(f, a), n: f.includes('40'), m: f.includes('300'), tie: f.includes(t('是一家人')), labor: f.includes(t('罰款')) || f.includes('labour') || f.includes('勞役') }; B.ids = ids(K, sp, c).join();
      const tA = w.stockpile.get('silver'); const LA = leak(() => runOp(K, sp, c, 'all')); B.all = { owed: MONEY.owedOf(w, a), paid: r3(300 - cash(sp)), town: r3(w.stockpile.get('silver') - tA), leak: LA.leak, mem: memHas(a, '{h}替我付了 {n} 銀幣的{x}。') };
      reset(40); const LH = leak(() => runOp(K, sp, c, 'half')); B.half = { owed: MONEY.owedOf(w, a), paid: r3(300 - cash(sp)), leak: LH.leak };
      reset(40); const nn = asked.length; const af0 = a.relationships.getOrCreate(sp.agentId, sp.name).affinity; const LN = leak(() => runOp(K, sp, c, 'no')); B.no = { owed: MONEY.owedOf(w, a), dad: r3(120 - cash(dad)), paid: r3(300 - cash(sp)), next: asked.slice(nn).some(e => e.kind === 'kinPay' && e.who === dad.agentId), aff: r3(a.relationships.getOrCreate(sp.agentId, sp.name).affinity - af0), leak: LN.leak, mem: memHas(a, '{o}明明有錢，卻不肯幫我付{x}。') }; clearQ();
      // 錢不夠的家人不會被問；已經付清、去服勞役的作廢
      reset(40); setCash(sp, 30); B.poor = K.options(w, sp, c).length; setCash(sp, 300);
      delete F[a.agentId]; B.paid = K.options(w, sp, c).length; reset(40); F[a.agentId].labor = true; B.labor = K.options(w, sp, c).length; reset(40);
      B.old = K.options(w, sp, { ...c, d: day() - 5 }).length;
      // 傾向：心軟、重視家庭的付清；貪心、處不來的不付
      sp.personality.traits = ['kind']; sp.personality.values = ['家庭']; setAff(sp, a, 60); const pKind = steady(() => pick(K, sp, c)); sp.personality.traits = ['greedy']; sp.personality.values = []; setAff(sp, a, -60); const pMean = steady(() => pick(K, sp, c)); plain(sp); setAff(sp, a, 30);
      rates.kinFine = rate(K, sp, c, ['all', 'half']); rates.kinFineAll = rate(K, sp, c, ['all']);
      B.lean = { pKind, pMean, mKind: (() => { sp.personality.traits = ['kind']; setAff(sp, a, 60); const m = marg(K, sp, c, 'all'); plain(sp); return m; })(), mMean: (() => { sp.personality.traits = ['greedy']; setAff(sp, a, -60); const m = marg(K, sp, c, 'all'); plain(sp); setAff(sp, a, 30); return m; })() };
      // 賭債：錢從家人直接付給賭場老闆
      const own = take(); plain(own); const Cs = CASINO.S(w); const keepC = { open: Cs.open, owner: Cs.owner, name: Cs.name }; Cs.open = true; Cs.owner = own.agentId; Cs.name = Cs.name || ['測試賭場', 'Test House']; Cs.debt[a.agentId] = { n: 50, day: day() - 8 };
      const cg = { of: a.agentId, src: 'gamble', n: 50, q: [], d: day() }; const fg = K.facts(w, sp, cg); collect(K, sp, cg); mkPrompt('kinPayG', sp, cg, 'kinPay');
      const o0 = cash(own); const LG = leak(() => runOp(K, sp, cg, 'half')); B.gamble = { facts: fg.includes('50') && has(fg, a), own: r3(cash(own) - o0), debt: Cs.debt[a.agentId]?.n, leak: LG.leak };
      const LG2 = leak(() => runOp(K, sp, cg, 'all')); B.gamble.clear = !(Cs.debt[a.agentId]?.n > 0.5); B.gamble.own2 = r3(cash(own) - o0); B.gamble.leak2 = LG2.leak;
      // 從賭場討債接進來（每七天問一次）
      const dailyAsk = (D0) => { Cs.debt[a.agentId] = D0; setCash(a, 0); setCash(sp, 300); Cs.lastDay = null; const ng = asked.length; try { steady(() => CASINO.daily(w)); } catch (e) { B.gErr = String(e.message); } return asked.slice(ng).filter(e => e.kind === 'kinPay' && e.ctx?.src === 'gamble').length; };
      B.gamble.daily = dailyAsk({ n: 30, day: day() - 8 }) >= 1; B.gamble.again = dailyAsk({ n: 30, day: day() - 8, kd: day() - 3 }); B.gamble.kd = dailyAsk({ n: 30, day: day() - 8, kd: day() - 7 }) >= 1;
      delete Cs.debt[a.agentId]; Object.assign(Cs, keepC);
      // 決策核心沒開：家人不會被問，也不會被扣錢
      delete F[a.agentId]; setCash(sp, 300); const nf = asked.length; const LO = leak(() => offDecide(() => MONEY.fine(w, a, 20, t('罰款')))); B.off = { asked: asked.slice(nf).filter(e => e.kind === 'kinPay').length, sp: cash(sp), owed: MONEY.owedOf(w, a), leak: LO.leak };
      delete F[a.agentId]; unpair(a); a._parentNames = []; }
    out.B = B;

    // ============ C 議會的票 ============
    const C = {}; { const Cn = w.council || (w.council = {}); const keep = { f: Cn._formed, m: (Cn.members || []).slice() };
      const payer = take(), m1 = take(), m2 = take(), m3 = take(); for (const x of [payer, m1, m2, m3]) { plain(x); unpair(x); orphan(x); }
      payer.personality.traits = ['greedy']; m1.personality.traits = ['greedy']; m2.personality.traits = ['lazy']; m3.personality.traits = ['kind'];
      setCash(payer, 200); setCash(m1, 20); setCash(m2, 5); setCash(m3, 50); Cn._formed = true; Cn.members = [m1.agentId, m2.agentId, m3.agentId];
      const mkP = (id) => { const p = { id, n: 9000, kind: 'tax', key: 'tax:' + id, status: 'open', proposerId: payer.agentId, proposerName: payer.name, createdDay: day(), votes: {}, why: {}, tk: '加稅到 {n}%', tp: { n: 20 }, dk: '', dp: {}, cost: {}, category: 'economy', newTax: 0.2, dir: 'up' }; w.proposals.items.push(p); return p; };
      const p = mkP('LT91'); const K = KK.bribeVote; const n = { [m1.agentId]: 20, [m2.agentId]: 18 }; const c = { pid: p.id, d: day(), n };
      const f = K.facts(w, payer, c); collect(K, payer, c); mkPrompt('bribeVote', payer, c);
      C.facts = { title: f.includes(w.proposals.title(p)), m1: has(f, m1), m2: has(f, m2), notM3: !has(f, m3), cash: f.includes('200') }; C.ids = K.options(w, payer, c).map(o => String(o.id).split(':')[0]).join();
      // 塞給兩個：兩個議員各被問一次（錢還沒動）
      const nq = asked.length; const L1 = leak(() => runOp(K, payer, c, 'both')); C.both = { asked: asked.slice(nq).filter(e => e.kind === 'bribeTake' && e.ctx?.src === 'council').map(e => e.who).sort().join() === [m1.agentId, m2.agentId].sort().join(), moved: r3(200 - cash(payer)), leak: L1.leak }; clearQ();
      // 議員收下：錢從提案人到議員、表決時投贊成、記進秘密
      const KT = KK.bribeTake; const ct = { src: 'council', by: payer.agentId, pid: p.id, n: 20, d: day() }; const ft = KT.facts(w, m1, ct); collect(KT, m1, ct); mkPrompt('bribeTakeC', m1, ct, 'bribeTake');
      C.tfacts = { by: has(ft, payer), n: ft.includes('20'), title: ft.includes(w.proposals.title(p)), m: ft.includes('20') }; C.tids = ids(KT, m1, ct).join();
      const b0 = ASSEMBLY.R(w, m1.agentId).bribes; const LT = leak(() => runOp(KT, m1, ct, 'take')); const mv = ASSEMBLY.R(w, m1.agentId);
      C.take = { from: r3(200 - cash(payer)), to: r3(cash(m1) - 20), bribe: p._bribe?.[m1.agentId] === payer.agentId, rec: mv.bribes - b0, secret: (w.dark?.secrets || []).some(s => s.asm === 'bribe' && s.culprit === m1.agentId), log: logs().some(s => s.includes('🕵️') && has(s, payer)), leak: LT.leak };
      const ct2 = { ...ct, n: 18 }; setCash(payer, 200); const LB = leak(() => runOp(KT, m2, ct2, 'back')); C.back = { moved: r3(200 - cash(payer)), bribe: !!p._bribe?.[m2.agentId], mem: memHas(m2, '{b}私下想塞錢給我，要我在議會挺他，我退回去了。'), leak: LB.leak };
      const LR = leak(() => runOp(KT, m2, ct2, 'report')); C.report = { moved: r3(200 - cash(payer)), found: (w.dark?.secrets || []).some(s => s.kind === 'lobby' && s.culprit === payer.agentId && s.found), log: logs().some(s => s.includes('📣') && has(s, m2)), rep: (DARK.S(w).rep[payer.agentId]?.exposed || 0) >= 1, leak: LR.leak };
      // 表決：收了錢的議員投贊成
      const vote = ASSEMBLY.councilVote(w, p, day()); C.vote = { m1: vote?.votes?.[m1.agentId], why: vote?.why?.[m1.agentId] };
      // 傾向：老實的議員退回；窮又貪的收
      m3.personality.traits = ['kind', 'perfectionist']; const p3 = mkP('LT92'); const ct4 = { src: 'council', by: payer.agentId, pid: p3.id, n: 20, d: day() }; setCash(m1, 5); const pGreedy = steady(() => pick(KT, m1, ct4)); const pHonest = steady(() => pick(KT, m3, ct4));
      rates.bribeVote = rate(K, payer, { pid: p3.id, d: day(), n: { [m1.agentId]: 20, [m2.agentId]: 18 } }, ['give', 'both']); setCash(m1, 20); rates.bribeTakeC = rate(KT, m1, ct4, ['take']);
      C.lean = { pGreedy, pHonest, payer: steady(() => pick(K, payer, { pid: p3.id, d: day(), n: { [m1.agentId]: 20, [m2.agentId]: 18 } })) };
      // 作廢：表決已經過了、塞錢的人錢不夠了
      C.void = { voted: KT.options(w, m1, ct).length }; setCash(payer, 5); C.void.poor = KT.options(w, m1, ct4).length; setCash(payer, 200);
      // 從提案流程接進來：照個性當場決定的話，議會當天就表決；開 AI 等回話時延到隔天（在下面 AI 那一段）
      const p4 = mkP('LT93'); const nq4 = asked.length; const v4 = ASSEMBLY.councilVote(w, p4, day()); C.flow = { asked: asked.slice(nq4).some(e => e.kind === 'bribeVote' && e.who === payer.agentId), voted: !!v4 && !v4.wait, lob: !!p4._lob };
      const p5 = mkP('LT94'); const nq5 = asked.length; const v5 = offDecide(() => ASSEMBLY.councilVote(w, p5, day())); C.off = { asked: asked.slice(nq5).filter(e => e.kind === 'bribeVote').length, voted: !!v5 && !v5.wait, bribe: Object.keys(p5._bribe || {}).length };
      out.Cp = { payer: payer.agentId, m1: m1.agentId, m2: m2.agentId, m3: m3.agentId };
      for (const x of [p, p3, p4, p5]) x.status = 'rejected'; Cn._formed = keep.f; Cn.members = keep.m; }
    out.C = C;

    // ============ D 議員選舉買票 ============
    const D = {}; { const A2 = ASSEMBLY.S(w); const cand = take(), opp = take(), v1 = take(), v2 = take(); for (const x of [cand, opp, v1, v2]) { plain(x); unpair(x); }
      cand.personality.traits = ['lazy', 'jealous']; setCash(cand, 100); setCash(v1, 5); setCash(v2, 10); setAff(v1, cand, 0); setAff(v2, cand, 0);
      const E = A2.elec = { start: day(), year: w.clock.year, phase: 'campaign', left: 3, seats: 1, cands: [{ id: cand.agentId, name: cand.name, inc: false, pitch: '' }, { id: opp.agentId, name: opp.name, inc: false, pitch: '' }] };
      const K = KK.dirty; const cx = K.when(w, cand); const f = cx ? K.facts(w, cand, cx) : ''; if (cx) { collect(K, cand, cx); mkPrompt('dirtyC', cand, cx, 'dirty'); }
      D.facts = { ok: !!cx, opp: has(f, opp), cash: f.includes('100'), each: f.includes('6') }; D.ids = cx ? ids(K, cand, cx).join() : '';
      const nq = asked.length; const ns = seen.length; const L1 = leak(() => fixR(0.99, () => runOp(K, cand, cx, 'cbuy'))); const q = asked.slice(nq).filter(e => e.kind === 'bribeTake' && e.ctx?.src === 'cvote'); const acc = seen.slice(ns).filter(e => e.kind === 'bribeTake' && q.some(x => x.who === e.who) && /^(take|keep)$/.test(e.id)).length; D.buy = { asked: q.length >= 1 && q.length <= 3, moved: r3(100 - cash(cand)), want: 6 * acc, leak: L1.leak }; clearQ(); E.offer = {}; E.bought = {}; setCash(cand, 100); setCash(v1, 5); setCash(v2, 10);
      const KT = KK.bribeTake; const ct = { src: 'cvote', by: cand.agentId, n: 6, d: day(), e: E.start }; const ft = KT.facts(w, v1, ct); collect(KT, v1, ct); mkPrompt('bribeTakeV', v1, ct, 'bribeTake');
      D.tfacts = { by: has(ft, cand), n: ft.includes('6'), m: ft.includes('5') }; D.tids = ids(KT, v1, ct).join();
      const b0 = ASSEMBLY.R(w, cand.agentId).bought; const LT = leak(() => runOp(KT, v1, ct, 'take')); D.take = { from: r3(100 - cash(cand)), to: r3(cash(v1) - 5), bought: E.bought?.[v1.agentId] === cand.agentId, rec: ASSEMBLY.R(w, cand.agentId).bought - b0, secret: (w.dark?.secrets || []).some(s => s.asm === 'buy' && s.culprit === cand.agentId), leak: LT.leak };
      const LK = leak(() => runOp(KT, v2, ct, 'keep')); D.keep = { to: r3(cash(v2) - 10), bought: !!E.bought?.[v2.agentId], mem: memHas(v2, '{c}私下塞了 {n} 銀幣給我要我投他。錢我收了，票我照自己的意思投。'), leak: LK.leak };
      setCash(v2, 10); const c2 = cash(cand); const LR = leak(() => runOp(KT, v2, ct, 'refuse')); D.refuse = { moved: r3(c2 - cash(cand)), leak: LR.leak };
      // 收了照投的人開票時比較會投他
      // 傾向：窮的收，老實的不收
      setCash(v2, 10); rates.bribeTakeV = rate(KT, v2, ct, ['take', 'keep']);
      setCash(v2, 2); const pPoor = steady(() => pick(KT, v2, ct)); v2.personality.traits = ['kind', 'perfectionist']; setCash(v2, 40); const pHon = steady(() => pick(KT, v2, ct)); plain(v2); D.lean = { pPoor, pHon };
      // 作廢：開完票（選舉結束）、候選人錢不夠
      setCash(cand, 3); D.void = { poor: KT.options(w, v2, ct).length }; setCash(cand, 100); A2.elec = null; D.void.over = KT.options(w, v2, ct).length;
      D.voidBuy = offDecide(() => K.when(w, cand)) === null;
      // 決策核心沒開：候選人每天的拉票照舊，但不買票
      A2.elec = { ...E, bought: {}, offer: {} }; const b1 = ASSEMBLY.R(w, cand.agentId).bought; const c1 = cash(cand); offDecide(() => fixR(0, () => ASSEMBLY.campaign(w, A2.elec))); D.off = { bought: ASSEMBLY.R(w, cand.agentId).bought - b1, moved: r3(c1 - cash(cand)) };
      A2.elec = null;
      // 首長選舉也一樣：候選人決定塞錢，被找上的人自己決定收不收、投不投
      { const El = w.election; const keepE = { active: El.active, phase: El.phase, candidates: El.candidates, _offer: El._offer }; El.active = true; El.phase = 'campaign'; El.candidates = [{ agentId: cand.agentId, name: cand.name }, { agentId: opp.agentId, name: opp.name }]; El._offer = {};
        setCash(cand, 100); setCash(v1, 5); setCash(v2, 10); const nq3 = asked.length; const ns3 = seen.length; const L9 = leak(() => fixR(0.99, () => WALLET.voteBuyBy(w, cand))); const q3 = asked.slice(nq3).filter(e => e.kind === 'bribeTake' && e.ctx?.src === 'mvote'); const acc3 = seen.slice(ns3).filter(e => e.kind === 'bribeTake' && /^(take|keep)$/.test(e.id)).length;
        D.mayor = { asked: q3.length >= 1 && q3.length <= 2, moved: r3(100 - cash(cand)), want: 10 * acc3, leak: L9.leak }; clearQ(); El._offer = {}; setCash(cand, 100); setCash(v1, 5);
        const cm = { src: 'mvote', by: cand.agentId, n: 10, d: day() }; D.mayor.ids = ids(KT, v1, cm).join(); collect(KT, v1, cm); mkPrompt('bribeTakeM', v1, cm, 'bribeTake'); const LM = leak(() => runOp(KT, v1, cm, 'take')); D.mayor.take = { from: r3(100 - cash(cand)), to: r3(cash(v1) - 5), secret: (w.dark?.secrets || []).some(s2 => s2.k === '{c}私下塞錢給{v}買票' && s2.culprit === cand.agentId && s2.victim === v1.agentId), leak: LM.leak };
        Object.assign(El, keepE); D.mayor.void = KT.options(w, v1, cm).length; }
      }
    out.D = D;

    // ============ E 反壟斷 ============
    const E = {}; { const boss = take(), x1 = take(), x2 = take(), x3 = take(); for (const x of [boss, x1, x2, x3]) { plain(x); unpair(x); } boss.personality.traits = ['greedy']; setCash(boss, 300);
      const p = { id: 'LT95', n: 9001, kind: 'antitrust', key: 'antitrust:x', refKey: boss.agentId, status: 'open', proposerId: x3.agentId, proposerName: x3.name, createdDay: day(), votes: {}, why: {}, tk: '拆分{name}的產業', tp: { name: boss.name }, dk: '', dp: {}, cost: {}, category: 'economy' }; w.proposals.items.push(p);
      setCash(x1, 10); setCash(x2, 20); try { delete w.union?.members?.[x1.agentId]; delete w.union?.members?.[x2.agentId]; } catch (e) {}
      const nq = asked.length; COMPETE.lobby(w, day()); const q = asked.slice(nq).filter(e => e.kind === 'trustFight'); E.ask = { n: q.length, who: q[0]?.who === boss.agentId, t: (q[0]?.ctx?.t || []).length, again: (() => { const n1 = asked.length; COMPETE.lobby(w, day()); return asked.slice(n1).filter(e => e.kind === 'trustFight').length; })() };
      const PW0 = POWER.S(w); const resetE = () => { setCash(boss, 300); setCash(x1, 10); setCash(x2, 20); for (const x of npcs()) if (PW0.inf[x.agentId]) delete PW0.inf[x.agentId][boss.agentId]; p._lobR = null; }; resetE(); clearQ();
      const K = KK.trustFight; const c = { pid: p.id, d: day(), t: [x1.agentId, x2.agentId], n: [6, 7] }; const f = K.facts(w, boss, c); collect(K, boss, c); mkPrompt('trustFight', boss, c);
      E.facts = { title: f.includes(w.proposals.title(p)), x1: has(f, x1), x2: has(f, x2), sum: f.includes('13'), cash: f.includes('300') }; E.ids = ids(K, boss, c).join();
      const nq2 = asked.length; const ns2 = seen.length; const L1 = leak(() => fixR(0.99, () => runOp(K, boss, c, 'pay'))); const acc = seen.slice(ns2).filter(e => e.kind === 'bribeTake' && e.id === 'take').map(e => e.who === x1.agentId ? 6 : 7).reduce((a2, b2) => a2 + b2, 0); E.pay = { asked: asked.slice(nq2).filter(e => e.kind === 'bribeTake' && e.ctx?.src === 'trust').length, moved: r3(300 - cash(boss)), want: acc, leak: L1.leak }; clearQ(); resetE();
      const KT = KK.bribeTake; const ct = { src: 'trust', by: boss.agentId, pid: p.id, n: 6, d: day(), r: 77 }; const ft = KT.facts(w, x1, ct); collect(KT, x1, ct); mkPrompt('bribeTakeT', x1, ct, 'bribeTake'); E.tids = ids(KT, x1, ct).join(); E.tfacts = { by: has(ft, boss), title: ft.includes(w.proposals.title(p)) };
      const PW = POWER.S(w); const l0 = w.market.cst.lobby; const LT = leak(() => fixR(0.99, () => runOp(KT, x1, ct, 'take'))); E.take = { from: r3(300 - cash(boss)), to: r3(cash(x1) - 10), inf: (PW.inf[x1.agentId] || {})[boss.agentId] === 6, lobby: w.market.cst.lobby - l0, vote: CYCLE.antitrustVote(w, p, x1).why, leak: LT.leak };
      const LR = leak(() => runOp(KT, x2, ct, 'refuse')); E.refuse = { to: r3(cash(x2) - 20), inf: !!(PW.inf[x2.agentId] || {})[boss.agentId], leak: LR.leak };
      // 被報社揭發（看天）：這一輪收了的錢照收，可是人情不算
      const ex0 = w.market.cst.exposed; setCash(x2, 20); if (PW.inf[x2.agentId]) delete PW.inf[x2.agentId][boss.agentId]; const ct2 = { ...ct, r: 78 }; fixR(0, () => runOp(KT, x2, ct2, 'take')); E.exposed = { n: w.market.cst.exposed - ex0, inf: !!(PW.inf[x2.agentId] || {})[boss.agentId], got: r3(cash(x2) - 20) };
      // 公開反駁：喜歡他的人更喜歡、討厭他的人更討厭，一案一次
      const fan = x3; setAff(fan, boss, 20); const hater = take(); setAff(hater, boss, -40); const L3 = leak(() => runOp(K, boss, c, 'rebut')); E.rebut = { fan: fan.relationships.relationships[boss.agentId].affinity, hater: hater.relationships.relationships[boss.agentId].affinity, log: logs().some(s => s.includes('📣') && has(s, boss)), once: !opOf(K, boss, c, 'rebut'), leak: L3.leak };
      // 傾向：貪心的塞錢、心軟的不塞
      const p2 = { ...p, id: 'LT96', _rebut: 0, _lobR: null }; w.proposals.items.push(p2); const c2 = { ...c, pid: p2.id }; rates.trustFight = rate(K, boss, c2, ['pay']); rates.bribeTakeT = rate(KT, x1, { ...ct, pid: p2.id }, ['take']); const pGreedy = steady(() => pick(K, boss, c2)); boss.personality.traits = ['kind']; const pKind = steady(() => pick(K, boss, c2)); boss.personality.traits = ['greedy']; E.lean = { pGreedy, pKind };
      // 作廢：案子結束了
      p2.status = 'rejected'; E.void = K.options(w, boss, c2).length + KT.options(w, x1, { ...ct, pid: p2.id }).length;
      // 決策核心沒開：不遊說
      const p3 = { ...p, id: 'LT97', _lobAsk: 0, _lobbyDay: null }; w.proposals.items.push(p3); const nq3 = asked.length; const l1 = w.market.cst.lobby; offDecide(() => COMPETE.lobby(w, day() + 1)); E.off = { asked: asked.slice(nq3).filter(e => e.kind === 'trustFight').length, lobby: w.market.cst.lobby - l1 };
      for (const x of [p, p2, p3]) x.status = 'rejected'; }
    out.E = E;

    // ============ F 買報社 ============
    const F = {}; { const R = w.press; const Pf = R?.papers?.find(x => !['board', 'crown'].includes(x.st)); F.has = !!Pf;
      if (Pf) { const keepP = R.papers.map(x => [x, x.owner, x.banned]); for (const x of R.papers) { if (x !== Pf) x.owner = x.owner || 'nobody'; } Pf.owner = null; Pf.banned = false;
        const b1 = take(), b2 = take(), b3 = take(); for (const x of [b1, b2, b3]) { plain(x); } setCash(b1, 5000); setCash(b2, 4000); setCash(b3, 3000); for (const x of [b1, b2, b3]) { try { delete POWER.S(w).inf[x.agentId]; } catch (e) {} }
        const lv0 = TIERS.level(w); const nq = asked.length; fixR(0, () => POWER.buyPapers(w, day())); const q = asked.slice(nq).filter(e => e.kind === 'buyPaper'); F.ask = { n: q.length, top: [b1, b2, b3].every(x => q.some(e => e.who === x.agentId)), lv: lv0 };
        if (Pf.owner) { F.already = Pf.owner; Pf.owner = null; } clearQ(); setCash(b1, 5000); setCash(b2, 4000); setCash(b3, 3000);
        const K = KK.buyPaper; const c = { pid: Pf.id, d: day(), q: [b1.agentId, b2.agentId, b3.agentId] }; const f = K.facts(w, b1, c); collect(K, b1, c); mkPrompt('buyPaper', b1, c);
        F.facts = { paper: f.includes(t(Pf.name[0])) || f.includes(Pf.name[0]), price: f.includes('120'), cash: f.includes('5000'), others: has(f, b2) && has(f, b3) }; F.ids = ids(K, b1, c).join();
        const opB2 = opOf(K, b2, c, 'buy'); const tr0 = w.stockpile.get('silver'); const L1 = leak(() => runOp(K, b1, c, 'buy')); F.buy = { owner: Pf.owner === b1.agentId, paid: r3(5000 - cash(b1)), town: r3(w.stockpile.get('silver') - tr0), leak: L1.leak };
        const L2 = leak(() => opB2 ? opB2.run(w, b2, c) : null); F.late = { paid: r3(4000 - cash(b2)), owner: Pf.owner === b1.agentId, res: tx(L2.ret), leak: L2.leak, void: K.options(w, b3, c).length };
        Pf.owner = null; rates.buyPaper = rate(K, b1, c, ['buy']);
        Pf.owner = null; b1.personality.values = ['權力']; b1.personality.traits = ['ambitious']; const pPow = steady(() => pick(K, b1, c)); b1.personality.values = []; b1.personality.traits = ['thrifty']; const pThr = steady(() => pick(K, b1, c)); F.lean = { pPow, pThr };
        const nq2 = asked.length; offDecide(() => fixR(0, () => POWER.buyPapers(w, day()))); F.off = { asked: asked.slice(nq2).filter(e => e.kind === 'buyPaper').length, owner: Pf.owner };
        for (const [x, o, bn] of keepP) { x.owner = o; x.banned = bn; } } }
    out.F = F;

    // ============ G 下台以後做什麼 ============
    const G = {}; { const ex = take(); plain(ex); setJob(ex, 'mayor'); H.prev[ex.agentId] = 'blacksmith'; const nq = asked.length; HOME.outOfOffice(w, ex, 'lost'); const q = asked.slice(nq).filter(e => e.kind === 'afterOffice' && e.who === ex.agentId);
      G.lost = { asked: q.length === 1, why: q[0]?.ctx?.why, job: ex.job?.key !== 'mayor' }; const f = KK.afterOffice.facts(w, ex, { why: 'lost', d: day(), prev: 'blacksmith' }); G.facts = f.includes(t('選舉落敗')); collect(KK.afterOffice, ex, { why: 'term', d: day(), prev: 'blacksmith' });
      setJob(ex, 'mayor'); const nq2 = asked.length; offDecide(() => HOME.outOfOffice(w, ex, 'term')); G.off = { asked: asked.slice(nq2).filter(e => e.kind === 'afterOffice').length, job: ex.job?.key };
      const src = await (await fetch('sim-town.js')).text(); const src2 = await (await fetch('sim-repeal.js')).text(); const src3 = await (await fetch('sim-power.js')).text();
      G.src = { noRandom: !/fallbackJobs/.test(src), town: /HOME\.outOfOffice\(world, oldMayor, ran \? 'lost' : 'term'\)/.test(src), repeal: /HOME\.outOfOffice\(w, L, 'recall'\)/.test(src2), power: /HOME\.outOfOffice\(w, L, 'recall'\)/.test(src3) }; setJob(ex, 'farmer'); }
    out.G = G; out.rates = rates;

    // ============ 存讀檔 ============
    { const SV = {}; const p = { id: 'LT98', n: 9002, kind: 'tax', status: 'open', proposerId: out.Cp.payer, votes: {}, why: {}, tk: '加稅到 {n}%', tp: { n: 20 }, createdDay: day(), _lob: { d: day(), pp: 1, wait: 1 }, _bribe: {} }; w.proposals.items.push(p);
      ASSEMBLY.S(w).elec = { start: day(), year: w.clock.year, phase: 'campaign', left: 2, seats: 1, cands: [{ id: out.Cp.payer, name: w.agents[out.Cp.payer]?.name || '', inc: false, pitch: '' }], offer: { [out.Cp.m2]: out.Cp.payer }, bought: {} };
      const Fm = MONEY.S(w).fines || (MONEY.S(w).fines = {}); Fm[out.Ath] = { owed: 12, since: day(), why: t('罰款'), paid: 0, askedFamily: true };
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null; try { w2.loadSave(sv); w2.observerMode = true; } catch (e) { err = String(e.message); }
      const p2 = (w2.proposals?.items || []).find(x => x.id === 'LT98'); let opErr = null; try { const m = w2.agents[out.Cp.m1]; if (m) KK.bribeTake.options(w2, m, { src: 'council', by: out.Cp.payer, pid: 'LT98', n: 20, d: day() }); const th = w2.agents[out.Ath]; if (th) KK.steal.options(w2, th, { d: day() }); } catch (e) { opErr = String(e.message); }
      SV.save = { err, opErr, lob: p2?._lob?.wait === 1, offer: w2.assembly?.elec?.offer?.[out.Cp.m2] === out.Cp.payer, fine: w2.money?.fines?.[out.Ath]?.askedFamily === true };
      // 議會的表決最多延一次：前一天還在等人回話（被問的人走了、或存讀檔回來），今天照常表決
      { const Cn = w.council; const keep = { f: Cn._formed, m: (Cn.members || []).slice() }; Cn._formed = true; Cn.members = [out.Cp.m1, out.Cp.m2, out.Cp.m3].filter(id => w.agents[id]);
        const p9 = JSON.parse(JSON.stringify(p2 || p)); p9.id = 'LT89'; p9.status = 'open'; p9.kind = 'tax'; p9.council = undefined; p9._lob = { d: day() - 1, pp: 1, wait: 1 }; w.proposals.items.push(p9);
        const v9 = ASSEMBLY.councilVote(w, p9, day()); SV.once = { voted: !!v9 && !v9.wait && !!p9.council };
        const p8 = JSON.parse(JSON.stringify(p9)); p8.id = 'LT88'; p8.council = undefined; p8._lob = { d: day(), pp: 1, wait: 0 }; w.proposals.items.push(p8); const v8 = ASSEMBLY.councilVote(w, p8, day()); const v8b = ASSEMBLY.councilVote(w, p8, day() + 1); SV.once.today = !!v8?.wait; SV.once.next = !!v8b && !v8b.wait && !!p8.council;
        p9.status = 'rejected'; p8.status = 'rejected'; Cn._formed = keep.f; Cn.members = keep.m; }
      p.status = 'rejected'; ASSEMBLY.S(w).elec = null; delete Fm[out.Ath]; w2.reset?.(); out.SV = SV; }

    // ============ 開 AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const ps = []; let reply = []; ce._askJson = async (p) => { ps.push(String(p)); return reply; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { const th = w.agents[out.Ath]; const Cv = CIVIC.S(w); delete Cv.jail[th.agentId]; setCash(th, 2); X0._gAsked = {}; X0._kAsked = {}; X0._asked = 0; X0._cDay = day(); X0.lastDay = day();
        // 偷不偷：題目當場送出，採用它選的「去求救濟」與理由；用 order 那一組
        for (const p of w.proposals.items) if (p.kind === 'relief' && p.refKey === th.agentId) p.status = 'rejected'; w.proposals.cooldown['relief:' + th.agentId] = -999; w.proposals.proposerCooldown[th.agentId] = -999;
        reply = [{ n: 1, pick: 'beg', why: 'model reason 111', feel: 'shame' }]; const n0 = seen.length; DECIDE.askNow(w, [{ a: th, kind: 'steal', ctx: { d: day() } }]); const pending = !seen.slice(n0).some(e => e.kind === 'steal'); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(x => x.kind === 'steal'); o.steal = { pending, id: e?.id, src: e?.src, reason: e?.reason, group: X0._gAsked.order, relief: w.proposals.items.some(p => p.kind === 'relief' && p.refKey === th.agentId && p.status === 'open') };
        const p1 = ps.find(x => /hold＝/.test(x)) || ''; o.p1 = { codes: /hold＝/.test(p1) && /beg＝/.test(p1), cjk: /[一-鿿]/.test(p1), sample: (p1.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 議會：提案人還在想（等 AI）時，表決延到隔天；隔天不管想完沒有都照常表決
        const Cn = w.council; const keep = { f: Cn._formed, m: (Cn.members || []).slice() }; const payer = w.agents[out.Cp.payer], m1 = w.agents[out.Cp.m1], m2 = w.agents[out.Cp.m2], m3 = w.agents[out.Cp.m3];
        Cn._formed = true; Cn.members = [m1, m2, m3].filter(Boolean).map(x => x.agentId); payer.personality.traits = ['greedy']; m1.personality.traits = ['greedy']; m2.personality.traits = ['lazy']; setCash(payer, 200);
        const pp = { id: 'LT99', n: 9003, kind: 'tax', key: 'tax:LT99', status: 'open', proposerId: payer.agentId, proposerName: payer.name, createdDay: day(), votes: {}, why: {}, tk: '加稅到 {n}%', tp: { n: 20 }, dk: '', dp: {}, cost: {}, category: 'economy', newTax: 0.2, dir: 'up' }; w.proposals.items.push(pp);
        X0._gAsked = {}; X0._kAsked = {}; X0._asked = 0; let gate = null; const hold = new Promise(r2 => { gate = r2; }); ce._askJson = async (p) => { ps.push(String(p)); await hold; return [{ n: 1, pick: 'no', why: 'not today' }]; };
        const v1 = ASSEMBLY.councilVote(w, pp, day()); o.wait = { first: !!v1?.wait, noCouncil: !pp.council }; gate(); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20));
        const v2 = ASSEMBLY.councilVote(w, pp, day() + 1); o.wait.next = !!v2 && !v2.wait && !!pp.council; pp.status = 'rejected'; Cn._formed = keep.f; Cn.members = keep.m;
        ce._askJson = async (p) => { ps.push(String(p)); return reply; };
        // 額度：有人私下塞錢來（預設那一組）一天最多兩件問 AI，其餘當場照個性決定
        X0._gAsked = {}; X0._kAsked = {}; X0._asked = 0; reply = []; const A2 = ASSEMBLY.S(w); const cand = payer; A2.elec = { start: day(), year: w.clock.year, phase: 'campaign', left: 2, seats: 1, cands: [{ id: cand.agentId, name: cand.name, inc: false, pitch: '' }], offer: {}, bought: {} }; setCash(cand, 300);
        const vs = adults().filter(x => x !== cand && !used.has(x.agentId)).slice(0, 5); for (const v of vs) setCash(v, 5); const n1 = seen.length; DECIDE.askNow(w, vs.map(v => ({ a: v, kind: 'bribeTake', ctx: { src: 'cvote', by: cand.agentId, n: 6, d: day(), e: A2.elec.start } })));
        const ruled = seen.slice(n1).filter(x => x.kind === 'bribeTake' && x.src === 'rule').length; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.quota = { ai: X0._kAsked.bribeTake, ruled, total: seen.slice(n1).filter(x => x.kind === 'bribeTake').length, missed: X0.st.aiMiss };
        A2.elec = null; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }
    out.prompts = Object.fromEntries(Object.entries(prompts).map(([k, p]) => [k, { len: String(p).length, err: /^ERR/.test(p) ? p : null, cjk: /[一-鿿]/.test(p), sample: (String(p).match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] }]));

    // ============ 放著跑 ============
    { const errs0 = []; const tick = () => { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } }; const d0 = day(); const n0 = asked.length; const s0 = seen.length; MM.lastT = MONEY.total(w) - (MM.pend || 0);
      for (let i = 0; i < LONG; i++) { tick(); if (i % 10 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, Dd] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(Dd.other || 0);
      const per = {}; for (const e of asked.slice(n0)) per[e.kind] = (per[e.kind] || 0) + 1; const pk = {}; for (const e of seen.slice(s0)) pk[e.kind + '.' + e.id.split(':')[0]] = (pk[e.kind + '.' + e.id.split(':')[0]] || 0) + 1;
      out.run = { errs: errs0.slice(0, 3), days: day() - d0, kinds: per, picks: pk, other: Math.round(other * 100) / 100 }; }
    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-200).map(loc);
    out.texts = texts.filter(Boolean).map(loc);
    return out; }, { KEYS, LONG });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 60, `${tag} 決策核心開著，鎮上 ${r.pop} 人`, { on: r.on, pop: r.pop });
  { const g = Object.fromEntries(r.reg.map(x => [x.k, x]));
    ok(r.reg.every(x => !x.missing && x.scan === false && x.title), `${tag} 登記了六種新的選擇點，都由那一刻送進來（共 ${r.total} 種）`, r.reg);
    ok(g.steal.g === 'order' && g.steal.kind === 2 && g.buyPaper.g === 'order' && g.buyPaper.kind === 3 && g.bribeVote.g === 'civic' && g.bribeVote.kind === 1 && g.trustFight.g === 'civic' && g.trustFight.kind === 1 && !g.bribeTake.g && !g.kinPay.g, `${tag} 額度：偷不偷、買報社用 order（一天 8 件），塞錢給議員、反壟斷用 civic（一天 6 件），收錢與家人付錢用全鎮的 10 件`, r.reg); }
  { const A = r.A;
    ok(Object.values(A.facts).every(Boolean), `${tag} 偷不偷：事實裡有身上的錢、餓了幾天、守衛人數、最近兩週的竊案與被抓的、現在的罰則、每個人選與交情、可以借錢的人、可以求救濟`, A.facts);
    ok(A.ids.hold && A.ids.far && A.ids.known && A.ids.foe && A.ids.borrow && A.ids.beg && A.ids.n === 6, `${tag} 選項：忍著、偷三位人選（不熟的、認識的、有過節的）、去借、去求救濟`, A.ids);
    ok(A.uncaught.took === A.uncaught.got && A.uncaught.took >= 5 && A.uncaught.thefts === 1 && A.uncaught.secret && A.uncaught.vmem && A.uncaught.tmem && A.uncaught.leak === 0, `${tag} 偷了沒被抓：${A.uncaught.took} 銀幣從失主到小偷，成了秘密，失主只知道錢少了`, A.uncaught);
    ok(A.caught.caught === 1 && A.caught.guard && A.caught.leak === 0, `${tag} 偷了被抓：交給抓到人的守衛決定（罰則照現在的規定，關 5 天）`, A.caught);
    ok(A.borrow.asked && A.borrow.moved === 0 && A.borrow.leak === 0, `${tag} 去借：走原本「有人來借錢」，借不借由對方決定，錢還沒動`, A.borrow);
    ok(A.beg.made && A.beg.ref && A.beg.by && A.beg.cost === 20 && A.beg.again && A.beg.leak === 0, `${tag} 去求救濟：自己提出救濟提案（公庫撥 20 銀幣，大家投票）；已經提了就不會再提`, A.beg);
    ok(A.hold.leak === 0, `${tag} 忍著：什麼都沒發生`, A.hold);
    ok(A.lean.mHungry > A.lean.mHonest + 0.8 && A.lean.pk.loose > A.lean.pk.close + 0.5, `${tag} 照個性：餓得久、家裡有小孩、罰得輕的偏偷；老實、罰得重的偏忍；跟對方越好越下不了手`, A.lean);
    ok(A.void.rich === 0 && A.void.jail === 0 && A.void.old === 0 && A.void.foeGone, `${tag} 作廢：身上有了錢、被關、念頭過了兩天：沒有選項；有錢人的錢少了就不在人選裡`, A.void);
    ok(A.crime.asked >= 1 && A.crime.th, `${tag} 從竊案接進來：動了念頭的人被問（${A.crime.asked} 人）`, A.crime);
    ok(A.off.asked === 0 && A.off.thefts === 0, `${tag} 決策核心沒開：沒有人動念，也沒有竊案（不再替人擲骰）`, A.off); }
  { const B = r.B;
    ok(B.ask.n && B.ask.first && B.ask.src === 'fine' && B.ask.amt === 40 && B.ask.leak === 0, `${tag} 罰款付不出來：手頭最寬裕的家人先被問`, B.ask);
    ok(Object.values(B.facts).every(Boolean) && B.ids === 'all,half,no', `${tag} 事實裡有誰、欠多少、自己有多少、交情；選項：付清、付一半、這次不付`, { f: B.facts, ids: B.ids });
    ok(B.all.owed === 0 && B.all.paid === 40 && B.all.town === 40 && B.all.leak === 0 && B.all.mem && B.half.owed === 20 && B.half.paid === 20 && B.half.leak === 0, `${tag} 付清：40 銀幣從家人到公庫，欠款清掉；付一半：欠款剩 20`, { a: B.all, h: B.half });
    ok(Math.abs(B.no.owed - (40 - B.no.dad)) < 0.01 && B.no.paid === 0 && B.no.next && B.no.aff < 0 && B.no.mem && B.no.leak === 0, `${tag} 這次不付：沒有錢移動，換問下一位家人，兩邊感情變差`, B.no);
    ok(B.poor === 0 && B.paid === 0 && B.labor === 0 && B.old === 0, `${tag} 作廢：家人自己錢不夠、已經付清、去服勞役、事情過了好幾天`, { poor: B.poor, paid: B.paid, labor: B.labor, old: B.old });
    ok(B.lean.pKind === 'all' && B.lean.pMean === 'no' && B.lean.mKind > B.lean.mMean + 1, `${tag} 照個性：心軟、重視家庭、感情好的付清；貪心又處不來的不付`, B.lean);
    ok(B.gamble.facts && B.gamble.own === 25 && B.gamble.debt === 25 && B.gamble.leak === 0 && B.gamble.clear && B.gamble.own2 === 50 && B.gamble.leak2 === 0, `${tag} 賭債：錢從家人直接付給賭場老闆；付一半剩一半，付清就歸零（討債時銷帳）`, B.gamble);
    ok(B.gamble.daily && B.gamble.kd && B.gamble.again === 0 && !B.gErr, `${tag} 從賭場討債接進來：到期問家人，七天內不重複問`, { g: B.gamble, err: B.gErr });
    ok(B.off.asked === 0 && B.off.sp === 300 && B.off.owed === 20 && B.off.leak === 0, `${tag} 決策核心沒開：家人不會被問、不會被扣錢，罰款記成欠款`, B.off); }
  { const C = r.C;
    ok(Object.values(C.facts).every(Boolean) && C.ids === 'no,give,give,both', `${tag} 提案要送進議會：事實裡有提案、可能被說動的議員（老實的不在裡面）、自己的錢；選項：不塞、塞給某一位、兩個都塞`, { f: C.facts, ids: C.ids });
    ok(C.both.asked && C.both.moved === 0 && C.both.leak === 0, `${tag} 塞給兩個：兩位議員各被問一次，錢在收下之前不動`, C.both);
    ok(Object.values(C.tfacts).every(Boolean) && C.tids === 'take,back,report', `${tag} 議員：事實裡有誰塞的、為了哪一案、多少；選項：收下改投、退回、告發`, { f: C.tfacts, ids: C.tids });
    ok(C.take.from === 20 && C.take.to === 20 && C.take.bribe && C.take.rec === 1 && C.take.secret && C.take.log && C.take.leak === 0 && C.vote.m1 === 'for' && C.vote.why === 'bribe', `${tag} 收下：20 銀幣從提案人到議員（這一筆本身）、記進秘密與議事紀錄，表決時投贊成`, { t: C.take, v: C.vote });
    ok(C.back.moved === 0 && !C.back.bribe && C.back.mem && C.back.leak === 0, `${tag} 退回：沒有錢移動`, C.back);
    ok(C.report.moved === 0 && C.report.found && C.report.log && C.report.rep && C.report.leak === 0, `${tag} 告發：當眾說出來，真相大白、提案人名聲變差（陰險）`, C.report);
    ok(C.lean.pGreedy === 'take' && C.lean.pHonest !== 'take', `${tag} 照個性：貪心又缺錢的議員收；老實的不收`, C.lean);
    ok(C.void.voted === 0 && C.void.poor === 0, `${tag} 作廢：表決過了、塞錢的人錢不夠了`, C.void);
    ok(C.flow.asked && C.flow.voted && C.flow.lob, `${tag} 從提案流程接進來：送進議會前問提案人；照個性當場決定，議會當天照常表決`, C.flow);
    ok(C.off.asked === 0 && C.off.voted && C.off.bribe === 0, `${tag} 決策核心沒開：不問、沒有人塞錢，議會照常表決`, C.off); }
  { const D = r.D;
    ok(D.facts.ok && D.facts.opp && D.facts.cash && D.ids === 'clean,cbuy', `${tag} 議員選舉：不老實又有錢的候選人走「選戰怎麼打」；事實裡有對手、自己的錢；選項：正正當當、私下塞錢`, { f: D.facts, ids: D.ids });
    ok(D.buy.asked && D.buy.moved === D.buy.want && D.buy.leak === 0, `${tag} 私下塞錢：被找上的一到三個人各被問一次，錢只付給收下的人（${D.buy.want} 銀幣）`, D.buy);
    ok(Object.values(D.tfacts).every(Boolean) && D.tids === 'take,keep,refuse', `${tag} 被找上的人：事實裡有誰、多少、自己多缺錢；選項：收了照投、收了不照投、不收`, { f: D.tfacts, ids: D.tids });
    ok(D.take.from === 6 && D.take.to === 6 && D.take.bought && D.take.rec === 1 && D.take.secret && D.take.leak === 0, `${tag} 收了照投：6 銀幣從候選人到選民、開票時算他一份、記進秘密`, D.take);
    ok(D.keep.to === 6 && !D.keep.bought && D.keep.mem && D.keep.leak === 0 && D.refuse.moved === 0 && D.refuse.leak === 0, `${tag} 收了不照投：錢照收，票不算他的；不收：沒有錢移動`, { k: D.keep, r: D.refuse });
    ok(D.lean.pPoor === 'take' && D.lean.pHon === 'refuse', `${tag} 照個性：快吃不起飯的收；老實又不缺錢的不收`, D.lean);
    ok(D.void.poor === 0 && D.void.over === 0 && D.voidBuy, `${tag} 作廢：候選人錢不夠了、選舉結束了`, D.void);
    ok(D.off.bought === 0 && D.off.moved === 0, `${tag} 決策核心沒開：不買票`, D.off);
    ok(D.mayor && D.mayor.asked && D.mayor.moved === D.mayor.want && D.mayor.leak === 0 && D.mayor.ids === 'take,keep,refuse' && D.mayor.take.from === 10 && D.mayor.take.to === 10 && D.mayor.take.secret && D.mayor.take.leak === 0 && D.mayor.void === 0, `${tag} 首長選舉買票也一樣：被找上的人收了照投／收了不照投／不收；收下 10 銀幣、記進秘密（揭穿時照原本下台）；選舉結束後作廢`, D.mayor); }
  { const E = r.E;
    ok(E.ask.n === 1 && E.ask.who && E.ask.t >= 1 && E.ask.again === 0, `${tag} 反壟斷：被盯上的老闆被問（同一天不再問）`, E.ask);
    ok(Object.values(E.facts).every(Boolean) && E.ids === 'no,pay,rebut', `${tag} 事實裡有提案、找得到的兩個人、要花多少；選項：不塞、塞錢、公開反駁`, { f: E.facts, ids: E.ids });
    ok(E.pay.asked === 2 && E.pay.moved === E.pay.want && E.pay.leak === 0, `${tag} 塞錢：兩個人各被問一次，錢只付給收下的人（${E.pay.want} 銀幣）`, E.pay);
    ok(E.tids === 'take,refuse' && Object.values(E.tfacts).every(Boolean), `${tag} 被找上的人：選項收下、不收`, { ids: E.tids, f: E.tfacts });
    ok(E.take.from === 6 && E.take.to === 6 && E.take.inf && E.take.lobby === 1 && E.take.vote === 'donor' && E.take.leak === 0 && E.refuse.to === 0 && !E.refuse.inf && E.refuse.leak === 0, `${tag} 收下：錢從老闆到村民、欠他人情（投票時偏反對）；不收：沒有錢移動`, { t: E.take, r: E.refuse });
    ok(E.exposed.n === 1 && !E.exposed.inf && E.exposed.got === 6, `${tag} 被報社揭發（看天）：錢照收，人情不算`, E.exposed);
    ok(E.rebut.fan === 23 && E.rebut.hater === -42 && E.rebut.log && E.rebut.once && E.rebut.leak === 0, `${tag} 公開反駁：挺他的人更挺、討厭他的更討厭，一案只能一次`, E.rebut);
    ok(E.lean.pGreedy === 'pay' && E.lean.pKind !== 'pay', `${tag} 照個性：貪心的塞錢，心軟的不塞`, E.lean);
    ok(E.void === 0 && E.off.asked === 0 && E.off.lobby === 0, `${tag} 作廢：案子結束了；決策核心沒開：不遊說`, { v: E.void, off: E.off }); }
  { const F = r.F;
    ok(F.has && F.ask.n === 3 && F.ask.top, `${tag} 買報社：時機到了，前三有錢的人各被問`, F.ask);
    ok(Object.values(F.facts).every(Boolean) && F.ids === 'pass,buy', `${tag} 事實裡有報社、價錢、自己的錢、還有誰在打主意；選項：不買、買`, { f: F.facts, ids: F.ids });
    ok(F.buy.owner && F.buy.paid === 120 && F.buy.town === 120 && F.buy.leak === 0, `${tag} 買下：120 銀幣付給公庫，成了東家`, F.buy);
    ok(F.late.paid === 0 && F.late.owner && F.late.leak === 0 && F.late.void === 0 && /晚了一步|Too late/.test(F.late.res), `${tag} 第二個說要的晚了一步：沒有錢移動；第三位的題目作廢`, F.late);
    ok(F.lean.pPow === 'buy' && F.lean.pThr === 'pass', `${tag} 照個性：看重權力、有野心的買；節儉的不買`, F.lean);
    ok(F.off.asked === 0 && !F.off.owner, `${tag} 決策核心沒開：沒有人買`, F.off); }
  { const G = r.G;
    ok(G.lost.asked && G.lost.why === 'lost' && G.lost.job && G.facts, `${tag} 選輸的首長：先當商人，再問他之後做什麼（事實寫著選舉落敗）`, G);
    ok(G.off.asked === 0 && G.off.job === 'trader' && Object.values(G.src).every(Boolean), `${tag} 不再隨機改當農夫守衛商人研究員；選輸、任期結束、兩種罷免都走同一條（決策核心沒開就照慣例當商人）`, { off: G.off, src: G.src }); }
  { const R = r.rates; const P3 = (p) => 1 - Math.pow(1 - p, 3);
    console.log('    照個性的比例：' + JSON.stringify(R));
    ok(R.steal >= 0.4 && R.steal <= 0.85, `${tag} 偷不偷：動了念頭的人有 ${R.steal} 真的去偷（以前動念就是偷；動念的時機調高到 0.08，整體竊案同一量級）`, R);
    ok(R.kinFine >= 0.45 && R.kinFine <= 0.95, `${tag} 家人付罰款：${R.kinFine} 會付（付清 ${R.kinFineAll}；以前照好感 45%～90% 代繳）`, R);
    ok(R.bribeVote >= 0.3 && R.bribeVote <= 0.7, `${tag} 提案人塞錢：${R.bribeVote}（以前 50%）`, R);
    ok(R.bribeTakeC >= 0.6 && R.bribeTakeV >= 0.6 && R.bribeTakeT >= 0.6, `${tag} 收錢：議員 ${R.bribeTakeC}、選民 ${R.bribeTakeV}、反壟斷 ${R.bribeTakeT}（以前一定收）`, R);
    ok(R.trustFight >= 0.4 && R.trustFight <= 0.95, `${tag} 被盯上的老闆塞錢：${R.trustFight}（以前貪心的一定、其他 50%）`, R);
    ok(P3(R.buyPaper) >= 0.75, `${tag} 買報社：每人 ${R.buyPaper}，三個人裡至少一個買的機會約 ${Math.round(P3(R.buyPaper) * 100) / 100}（以前最有錢的一定買）`, R); }
  ok(r.SV.once && r.SV.once.voted && r.SV.once.today && r.SV.once.next, `${tag} 議會的表決最多延一次：當天還有人在想就等，隔天一定表決（讀檔回來、等的人不在了也一樣）`, r.SV.once);
  ok(!r.SV.save.err && !r.SV.save.opErr && r.SV.save.lob && r.SV.save.offer && r.SV.save.fine, `${tag} 存讀檔：議會等人回話、選舉的開價、罰款問過家人，都存得下來，讀回來照常問`, r.SV.save);
  { const M = r.mind;
    ok(M.aiOn && M.steal && M.steal.pending && M.steal.id === 'beg' && M.steal.src === 'ai' && M.steal.reason === 'model reason 111' && M.steal.group === 1 && M.steal.relief, `${tag} 開 AI：偷不偷的題目送出、等回話，採用它選的「去求救濟」與理由，用 order 那一組`, M.steal);
    ok(M.p1 && M.p1.codes && (zh || !M.p1.cjk), `${tag} 題目裡有選項代號${zh ? '' : '，英文題目裡沒有中文'}`, M.p1);
    ok(M.wait && M.wait.first && M.wait.noCouncil && M.wait.next, `${tag} 開 AI：提案人還在想時，議會的表決延到隔天；隔天照常表決`, M.wait);
    ok(M.quota && M.quota.ai === 2 && M.quota.ruled === 3 && M.quota.total === 5, `${tag} 額度：有人私下塞錢來一天最多兩件問 AI，其餘當場照個性決定`, M.quota); }
  { const P = r.prompts; const got = Object.keys(P);
    ok(got.length >= 10 && got.every(k => !P[k].err && P[k].len > 200), `${tag} ${got.length} 種題目都組得出來`, Object.fromEntries(got.map(k => [k, P[k].err || P[k].len])));
    ok(zh || got.every(k => !P[k].cjk), `${tag} 英文題目裡沒有中文（逐一檢查）`, zh ? null : got.filter(k => P[k].cjk).map(k => [k, P[k].sample])); }
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.days === +(process.env.LONG || 30) && Ru.other === 0, `${tag} 放著跑 ${Ru.days} 天：沒有錯誤、帳上沒有對不上的錢（問了：${JSON.stringify(Ru.kinds)}；選了：${JSON.stringify(Ru.picks)}）`, Ru); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 標題、事實、選項、理由、結果都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
