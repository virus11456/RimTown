// v11.8.0 派系、報社與治安裡的行為：要不要成立、加入、離開小團體，兩派怎麼往來，報社登不登、壓不壓、更不更正、轉不轉入地下，
//   守衛抓到小偷怎麼辦，襲擊來了首長怎麼應對，都由本人決定（選擇點登記在 sim-decide-order.js）
//   A) 小團體：出面的人拉不拉、被拉的人加不加入（至少兩個人答應才成立）、待不下去的人留下／淡出／退出、帶頭的人槓上／示好／不理、對方怎麼回、團體裡的摩擦
//   B) 報社：挖到醜聞照實登／壓下來／談條件（錢從當事人到主筆、記進秘密）／先查證；假消息登不登、登誰；被拆穿更正／裝沒事／再補一刀；國王查不查禁；被禁之後轉入地下／停刊／低頭；候選人塞錢收不收
//   C) 治安：抓到小偷關起來／只叫他還／放他一馬／收錢了事（錢與秘密）；趁亂搶糧倉、搶店也一樣；襲擊來了出去打／守在牆內／花錢消災／躲起來
//   共同：登記、用 order 那一組額度、事實裡的數字和交情對得上、交情與個性改變傾向、問不到的人走舊機率、一個人不會被重複問、存讀檔、
//         開 AI 時題目送出、回答被採用、英文題目沒有中文（十五種題目逐一組出來檢查）、放著跑 60 天沒有錯誤、錢對得上
// 用法：BASE=http://localhost:8182/ node scripts/v110800_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8182/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['facFound', 'facJoin', 'facLeave', 'facRival', 'facReply', 'facRow', 'pressScoop', 'pressHush', 'pressSmear', 'pressFix', 'pressBan', 'pressUnder', 'pressBuy', 'caught', 'raidCall'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Decide\]|\[Order\]|\[Press\]|\[Civic\]/.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 200)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async (KEYS) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 88 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); out.on = DECIDE.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const KK = DECIDE.KINDS; const X0 = DECIDE.S(w); const texts = []; const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const since = (n, k) => asked.slice(n).filter(e => !k || e.kind === k);
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const unfam = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married') { r.status = 'friend'; const o = w.agents[r.targetId]; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) r2.status = 'friend'; } a._parentNames = []; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
    const neutral = (list) => { for (const a of list) { plain(a); unfam(a); for (const b of list) if (a !== b) { setAff(a, b, 0); } } };
    const scoreOf = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id) === id || String(o.id).split(':')[0] === id); return me ? DECIDE.score(Ln, me) : null; };
    const pick = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    const marg = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id) === id || String(o.id).split(':')[0] === id); if (!me) return null; const others = ops.filter(o => o !== me).map(o => DECIDE.score(Ln, o)); return r3(DECIDE.score(Ln, me) - Math.max(...others)); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    const runOp = (K, a, ctx, id) => { const op = opOf(K, a, ctx, id); if (!op) return { none: true }; for (const x of [op.text, op.say, op.why]) texts.push(tx(x)); const res = op.run(w, a, ctx); return { res: tx(res) }; };
    const allTexts = (K, a, ctx) => { texts.push(K.facts(w, a, ctx)); for (const o of K.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); };
    const setJob = (a, k) => { try { a.job = new Job(k); } catch (e) {} };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const withR = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = R0; } };
    // 只記下「誰被問了」，不讓他當場照個性決定：要看的是問了誰、題目長怎樣，結算另外一項一項試
    const hold = (fn) => { const an = DECIDE.askNow; DECIDE.askNow = (w2, list) => { for (const x of (list || [])) if (x && x.a && KEYS.includes(x.kind)) asked.push({ kind: x.kind, who: x.a.agentId, ctx: x.ctx }); }; try { return fn(); } finally { DECIDE.askNow = an; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const prompts = {}; const mkPrompt = (k, a, ctx) => { try { const K = KK[k]; const opts = K.options(w, a, ctx); if (!opts.length) return; const p = DECIDE.prompt(w, K, [{ a, ctx, opts }]); prompts[k] = p; } catch (e) { prompts[k] = 'ERR ' + e.message; } };
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    const pool = npcs().filter(a => (a.age ?? 30) >= 20 && (a.age ?? 30) < 60 && a.job?.key !== 'guard' && a.job?.key !== 'mayor' && !w.isAway?.(a.agentId)).slice(0, 40);
    out.pop = npcs().length; out.pool = pool.length;
    const O = ORDER.S(w); const Fs = w.factions;

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup, kind: KK[k].aiKind, title: t(KK[k].title) } : { k, missing: 1 }); out.group = DECIDE.AI_GROUP.order;
    for (const k of KEYS) if (KK[k]) texts.push(t(KK[k].title));

    // ============ A) 小團體 ============
    // A1 成立：最有動機的人被問；出面之後被拉的人各自被問；至少兩個人答應才成立
    const A1 = {}; { Fs.factions = {}; O.pend = {}; O.fd = null; const [a, b, c, d] = pool.slice(0, 4); neutral([a, b, c, d]); a.personality.traits = ['charismatic']; a.personality.values = ['社群']; b.personality.traits = ['shy'];
      for (const x of [b, c, d]) { setAff(x, a, 70); setAff(a, x, 70); } setAff(b, c, 30); setAff(c, b, 30);
      const n0 = asked.length; hold(() => ORDER.found(w, Fs, 'scholars', [b, c, a, d])); const g0 = since(n0, 'facFound'); A1.ask = { n: g0.length, who: g0[0]?.who === a.agentId };
      O.pend = {}; Fs.factions = {}; O.fd = null; const ctx = { t: 'scholars', c: [b, c, a, d].map(x => x.agentId), d: day() };
      const f = KK.facFound.facts(w, a, ctx); allTexts(KK.facFound, a, ctx); A1.facts = { names: [b, c, d].every(x => f.includes(t(x.name)) || f.includes(x.name)), tie: f.includes(t('很要好')), group: f.includes(t('學者聯盟')), n: f.includes('0') };
      A1.ids = ids(KK.facFound, a, ctx);
      // 出面：被拉的三個人都被問；都答應 → 成立，帶頭的是出面的人
      const n1 = asked.length; const res = hold(() => runOp(KK.facFound, a, ctx, 'form')); const g1 = since(n1, 'facJoin');
      const jctx = g1[0]?.ctx; if (jctx) { const fj = KK.facJoin.facts(w, b, jctx); allTexts(KK.facJoin, b, jctx); mkPrompt('facJoin', b, jctx); A1.joinFacts = { by: fj.includes(t(a.name)) || fj.includes(a.name), tie: fj.includes(t('感情很好')) }; A1.joinIds = ids(KK.facJoin, b, jctx); }
      for (const e of g1) runOp(KK.facJoin, w.agents[e.who], e.ctx, 'join');
      const F = Object.values(Fs.factions).find(x => x.type === 'scholars'); A1.form = { asked: g1.length, distinct: new Set(g1.map(e => e.who)).size === g1.length, who: g1.every(e => [b, c, d].some(x => x.agentId === e.who)), made: !!F, founder: F?.founderName === a.name, members: F ? F.members.length : 0, res: res.res, pend: !O.pend.scholars };
      // 傾向：被拉的人跟出面的人很親的偏加入；處不來的不加入
      if (F) delete Fs.factions[F.id]; O.pend.scholars = { by: a.agentId, c: [b, c, d].map(x => x.agentId), yes: [a.agentId], no: [], d: day() };
      const jc = { t: 'scholars', by: a.agentId, d: day() }; setAff(c, a, 80); const mClose = marg(KK.facJoin, c, jc, 'join'); setAff(c, a, -60); c.personality.traits = ['shy']; const mFar = marg(KK.facJoin, c, jc, 'join'); const pFar = pick(KK.facJoin, c, jc); plain(c); setAff(c, a, 70);
      A1.leanJoin = { mClose, mFar, pFar };
      // 只有一個人答應：沒成立
      O.pend.scholars = { by: a.agentId, c: [b, c, d].map(x => x.agentId), yes: [a.agentId], no: [], d: day() };
      runOp(KK.facJoin, b, jc, 'join'); runOp(KK.facJoin, c, jc, 'no'); runOp(KK.facJoin, d, jc, 'no'); A1.fail = { made: Object.values(Fs.factions).some(x => x.type === 'scholars'), failed: (O.st.failed || 0) >= 1, log: logs().slice(-6).some(s => s.includes(t(a.name)) || s.includes(a.name)) };
      // 傾向：愛社交、有號召力的人比害羞的人想出面
      const mA = marg(KK.facFound, a, ctx, 'form'); const ctxB = { t: 'scholars', c: ctx.c, d: day() }; const mB = marg(KK.facFound, b, ctxB, 'form'); A1.leanFound = { charismatic: mA, shy: mB };
      // 同一天最多問三個人要不要出面
      Fs.factions = {}; O.pend = {}; O.fd = null; const n2 = asked.length; const types = ['work_buddies', 'drinking_pals', 'gossip_circle', 'romantics', 'troublemakers']; hold(() => { for (const ty of types) ORDER.found(w, Fs, ty, [b, c, a, d]); }); A1.cap = since(n2, 'facFound').length;
      // 決策核心沒開：照舊 20% 直接成立，不問
      Fs.factions = {}; O.pend = {}; const n3 = asked.length; const nf0 = Object.keys(Fs.factions).length; withR(0.01, () => offDecide(() => Fs._tryFormFactions(w))); A1.off = { asked: since(n3).length, made: Object.keys(Fs.factions).length - nf0 };
      Fs.factions = {}; O.pend = {}; }
    out.A1 = A1;

    // A2 待不下去：翻臉、團體跟家人作對；留下／淡出／公開退出；剩下的人不到兩個就散
    const A2 = {}; { const [a, b, c, d, e] = pool.slice(5, 10); neutral([a, b, c, d, e]); const F = Fs._formFaction(w, 'drinking_pals', [a, b, c]); const G = Fs._formFaction(w, 'gossip_circle', [d, e, pool[11]]);
      for (const x of [b, c]) { setAff(a, x, -70); } setAff(a, b, -80);
      const n0 = asked.length; hold(() => ORDER.leaveCheck(w, Fs, F, a, -75)); const g = since(n0, 'facLeave')[0]; A2.feudAsk = { asked: !!g, why: g?.ctx?.why };
      if (!F.hasMember(a.agentId)) F.addMember(a.agentId);
      const ctx = { f: F.id, why: 'feud', d: day() }; const f = KK.facLeave.facts(w, a, ctx); allTexts(KK.facLeave, a, ctx); A2.facts = { avg: f.includes('-75'), worst: f.includes(t(b.name)) || f.includes(b.name), n: f.includes('-80') }; A2.ids = ids(KK.facLeave, a, ctx);
      const l0 = logs().length; runOp(KK.facLeave, a, ctx, 'fade'); A2.fade = { gone: !F.hasMember(a.agentId), quiet: !logs().slice(l0).some(s => s.includes(t('酒友')) && (s.includes(t(a.name)) || s.includes(a.name))) };
      F.addMember(a.agentId); const l1 = logs().length; runOp(KK.facLeave, a, ctx, 'quit'); A2.quit = { gone: !F.hasMember(a.agentId), log: logs().slice(l1).some(s => s.includes(t(a.name)) || s.includes(a.name)), aff: aff2(b, a) };
      function aff2(x, y) { return x.relationships?.relationships?.[y.agentId]?.affinity || 0; }
      // 團體跟家人作對：家人在對頭那一派
      F.addMember(a.agentId); setAff(a, b, 10); setAff(a, c, 10); F.rivalFactionId = G.id; G.rivalFactionId = F.id; a._parentNames = [d.name];
      const n1 = asked.length; hold(() => ORDER.leaveCheck(w, Fs, F, a, 10)); const g1 = since(n1, 'facLeave')[0]; A2.kin = { asked: !!g1 && g1.ctx.why === 'kin', x: g1?.ctx?.x === d.agentId };
      if (!F.hasMember(a.agentId)) F.addMember(a.agentId);
      if (g1) { const fk = KK.facLeave.facts(w, a, g1.ctx); allTexts(KK.facLeave, a, g1.ctx); A2.kin.facts = (fk.includes(t(d.name)) || fk.includes(d.name)) && fk.includes(t('你的家人')); }
      const n2 = asked.length; hold(() => ORDER.leaveCheck(w, Fs, F, a, 10)); A2.kin.again = since(n2, 'facLeave').length; // 十二天內不再問
      // 傾向：害羞的偏淡出，刻薄的偏公開退出
      a.personality.traits = ['shy']; const sShy = [scoreOf(KK.facLeave, a, ctx, 'fade'), scoreOf(KK.facLeave, a, ctx, 'quit')]; a.personality.traits = ['abrasive']; const sAb = [scoreOf(KK.facLeave, a, ctx, 'fade'), scoreOf(KK.facLeave, a, ctx, 'quit')]; plain(a);
      A2.lean = { shyFade: sShy[0] > sShy[1], abQuit: sAb[1] > sAb[0] };
      // 散不散看人數：退到剩一個人就散
      const H = Fs._formFaction(w, 'night_owls', [b, c]); Fs._leaveFaction(w, H, b, 'quit'); Fs._cleanupDeadFactions(w); A2.dissolve = !Fs.factions[H.id];
      // 決策核心沒開：照舊 20% 退出，不問
      F.addMember(a.agentId); setAff(a, b, -90); setAff(a, c, -90); F.rivalFactionId = null; a._parentNames = []; const n3 = asked.length; withR(0.01, () => offDecide(() => Fs._updateCohesion(w))); A2.off = { asked: since(n3).length, left: !F.hasMember(a.agentId) };
      Fs.factions = {}; }
    out.A2 = A2;

    // A3 兩派碰上：帶頭的人槓上／示好／不理，對方帶頭的人怎麼回；團體裡的摩擦
    const A3 = {}; { const [a, b, c, d, e, f] = pool.slice(12, 18); neutral([a, b, c, d, e, f]); const F = Fs._formFaction(w, 'work_buddies', [a, b, c]); const G = Fs._formFaction(w, 'romantics', [d, e, f]);
      const n0 = asked.length; hold(() => ORDER.rival(w, Fs, F, G, null)); const g0 = since(n0, 'facRival')[0]; A3.ask = { who: g0?.who === a.agentId }; F.rivalFactionId = null; G.rivalFactionId = null; F.allyFactionId = null; G.allyFactionId = null;
      setAff(a, d, 70); const ctx = { a: F.id, b: G.id, iss: null, d: day() }; const fx = KK.facRival.facts(w, a, ctx); allTexts(KK.facRival, a, ctx); A3.facts = { lead: fx.includes(t(d.name)) || fx.includes(d.name), tie: fx.includes(t('感情很好')), n: fx.includes('3') }; A3.ids = ids(KK.facRival, a, ctx);
      // 槓上：兩派結怨，對方帶頭的被問
      const ab0 = (b.relationships.relationships[e.agentId]?.affinity || 0); const n1 = asked.length; hold(() => runOp(KK.facRival, a, ctx, 'clash')); const g1 = since(n1, 'facReply')[0];
      A3.clash = { rival: F.rivalFactionId === G.id && G.rivalFactionId === F.id, aff: (b.relationships.relationships[e.agentId]?.affinity || 0) < ab0, reply: g1?.who === d.agentId && g1?.ctx?.how === 'clash' };
      if (g1) { allTexts(KK.facReply, d, g1.ctx); A3.replyIds = ids(KK.facReply, d, g1.ctx); runOp(KK.facReply, d, g1.ctx, 'calm'); A3.calm = F.rivalFactionId === null && G.rivalFactionId === null; }
      // 示好：對方接受才合作；婉拒不合作
      const n2 = asked.length; hold(() => runOp(KK.facRival, a, ctx, 'befriend')); const g2 = since(n2, 'facReply')[0]; A3.befriend = { reply: g2?.ctx?.how === 'ally', noAllyYet: F.allyFactionId !== G.id };
      if (g2) { allTexts(KK.facReply, d, g2.ctx); A3.allyIds = ids(KK.facReply, d, g2.ctx); runOp(KK.facReply, d, g2.ctx, 'refuse'); A3.refuse = F.allyFactionId !== G.id; runOp(KK.facReply, d, g2.ctx, 'accept'); A3.accept = F.allyFactionId === G.id && G.allyFactionId === F.id; }
      // 傾向：兩邊感情好的偏示好；刻薄、兩邊有過節的偏槓上
      F.allyFactionId = null; G.allyFactionId = null; for (const x of [a, b, c]) for (const y of [d, e, f]) { setAff(x, y, 60); } const warm = [scoreOf(KK.facRival, a, ctx, 'befriend'), scoreOf(KK.facRival, a, ctx, 'clash')];
      for (const x of [a, b, c]) for (const y of [d, e, f]) { setAff(x, y, -60); } a.personality.traits = ['abrasive']; const cold = [scoreOf(KK.facRival, a, ctx, 'befriend'), scoreOf(KK.facRival, a, ctx, 'clash')]; plain(a);
      A3.lean = { warm: warm[0] > warm[1], cold: cold[1] > cold[0] };
      // 團體裡的摩擦：最受不了別人的那一位被問
      setAff(b, c, -80); setAff(a, b, 10); setAff(a, c, 10); setAff(c, b, 0); setAff(b, a, 10); setAff(c, a, 10); const n3 = asked.length; hold(() => ORDER.row(w, Fs, F)); const g3 = since(n3, 'facRow')[0]; A3.row = { who: g3?.who === b.agentId, x: g3?.ctx?.x === c.agentId };
      const rc = { f: F.id, x: c.agentId, d: day() }; const fr = KK.facRow.facts(w, b, rc); allTexts(KK.facRow, b, rc); A3.row.facts = fr.includes('-80') && (fr.includes(t(c.name)) || fr.includes(c.name)); A3.row.ids = ids(KK.facRow, b, rc);
      const coh0 = F.cohesion; runOp(KK.facRow, b, rc, 'call'); A3.row.call = F.cohesion < coh0; const bc0 = b.relationships.relationships[c.agentId].affinity; runOp(KK.facRow, b, rc, 'talk'); A3.row.talk = b.relationships.relationships[c.agentId].affinity > bc0;
      // 沒開：照舊擲骰
      const n4 = asked.length; withR(0.1, () => offDecide(() => Fs._tryFactionEvents(w))); A3.off = since(n4).length;
      mkPrompt('facRival', a, ctx); if (g1) mkPrompt('facReply', d, g1.ctx); mkPrompt('facRow', b, rc);
      Fs.factions = {}; }
    out.A3 = A3;
    // 其他小團體題目的英文檢查用（造好情境再組題目）
    { const [a, b, c, d] = pool.slice(0, 4); neutral([a, b, c, d]); Fs.factions = {}; O.pend = {}; const ctx = { t: 'scholars', c: [a, b, c, d].map(x => x.agentId), d: day() }; mkPrompt('facFound', a, ctx); O.pend = {};
      const F = Fs._formFaction(w, 'elders_council', [a, b, c]); setAff(a, b, -70); setAff(a, c, -70); mkPrompt('facLeave', a, { f: F.id, why: 'feud', d: day() }); Fs.factions = {}; }

    // ============ B) 報社 ============
    const E = w.election; const B = {};
    const R = PRESS.S(w); const P = R.papers.find(x => x.st === 'town') || R.papers.find(x => x.st !== 'board' && x.st !== 'crown'); const Pg = R.papers.find(x => x.st === 'gossip') || R.papers.find(x => x !== P && x.st !== 'board' && x.st !== 'crown');
    const [c1, c2, ed, ed2, x1] = pool.slice(20, 25); neutral([c1, c2, ed, ed2, x1]);
    const E0 = { active: E.active, phase: E.phase, candidates: E.candidates }; E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: c1.agentId, name: c1.name }, { agentId: c2.agentId, name: c2.name }];
    for (const Q of R.papers) { Q.owner = null; Q.banned = false; Q.underground = false; Q.closed = false; Q.bribedBy = null; } P.journo = ed.agentId; if (Pg) Pg.journo = ed2.agentId; P.cred = 60; PRESS.electionDay(w, R, E, day()); // 先讓選舉那一份狀態建起來
    B.papers = { P: !!P, Pg: !!Pg };
    // B1 挖到醜聞
    { const B1 = {}; const sec = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 17 } }); setCash(c1, 120); setAff(ed, c1, 70);
      const n0 = asked.length; hold(() => ORDER.scoop(w, P, sec)); B1.ask = { who: since(n0, 'pressScoop')[0]?.who === ed.agentId, seen: (sec.pseen || []).includes(P.id) };
      const sec2 = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 23 } });
      const ctx = { pid: P.id, sid: sec2.id, d: day() }; const f = KK.pressScoop.facts(w, ed, ctx); allTexts(KK.pressScoop, ed, ctx); mkPrompt('pressScoop', ed, ctx);
      B1.facts = { cand: f.includes(t(c1.name)) || f.includes(c1.name), what: f.includes('23'), tie: f.includes(t('感情很好')), cred: f.includes(String(Math.round(P.cred))), paper: f.includes(t(P.name[0])) };
      B1.ids = ids(KK.pressScoop, ed, ctx);
      // 壓下來：沒有見報、秘密沒被揭；這家報社不會再挖到同一件
      const s0 = P.stories.length; runOp(KK.pressScoop, ed, ctx, 'bury'); B1.bury = { printed: P.stories.length !== s0, found: sec2.found };
      // 照實登：見報、記恨、信譽 +5
      const cred0 = P.cred, af0 = c1.relationships.getOrCreate(ed.agentId, ed.name).affinity; runOp(KK.pressScoop, ed, ctx, 'print'); const st = P.stories[P.stories.length - 1];
      B1.print = { story: st?.kind === 'expose' && st?.cand === c1.agentId, found: sec2.found, cred: r3(P.cred - cred0), aff: r3(c1.relationships.relationships[ed.agentId].affinity - af0), hit: !!R.ord?.hit?.[c1.agentId] };
      // 上次得罪他的後果寫進事實
      const sec3 = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 31 } }); const ctx3 = { pid: P.id, sid: sec3.id, d: day() };
      const f3 = KK.pressScoop.facts(w, ed, ctx3); B1.last = f3.includes(String(Math.round(c1.relationships.relationships[ed.agentId].affinity)));
      // 談條件：當事人被問；付錢 → 錢從當事人到主筆（量這一筆），記進秘密，沒有見報
      const n1 = asked.length; hold(() => runOp(KK.pressScoop, ed, ctx3, 'deal')); const gh = since(n1, 'pressHush')[0]; B1.deal = { who: gh?.who === c1.agentId, n: gh?.ctx?.n };
      if (gh) { const fh = KK.pressHush.facts(w, c1, gh.ctx); allTexts(KK.pressHush, c1, gh.ctx); mkPrompt('pressHush', c1, gh.ctx); B1.hushFacts = (fh.includes(t(ed.name)) || fh.includes(ed.name)) && fh.includes(String(gh.ctx.n)) && fh.includes(String(Math.floor(cash(c1)))); B1.hushIds = ids(KK.pressHush, c1, gh.ctx);
        const cc0 = cash(c1), ce0 = cash(ed), s1 = P.stories.length, ns = (DARK.S(w).secrets || []).length; runOp(KK.pressHush, c1, gh.ctx, 'pay');
        const sx = (DARK.S(w).secrets || []).slice(ns).find(s => s.culprit === ed.agentId); B1.pay = { from: r3(cc0 - cash(c1)), to: r3(cash(ed) - ce0), n: gh.ctx.n, secret: !!sx && sx.victim === c1.agentId, printed: P.stories.length !== s1, found: sec3.found }; }
      // 不付：見報
      const sec4 = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 37 } }); const hc = { pid: P.id, sid: sec4.id, by: ed.agentId, n: 20, d: day() }; runOp(KK.pressHush, c1, hc, 'refuse'); B1.refuse = sec4.found;
      // 先查證：兩天後再問一次，這次沒有「先查證」，事實裡寫著查證過了
      const sec5 = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 41 } }); const ctx5 = { pid: P.id, sid: sec5.id, d: day() }; runOp(KK.pressScoop, ed, ctx5, 'verify');
      const v = O.ver.find(x => x.sid === sec5.id); B1.verify = { queued: !!v && v.at === day() + 2 }; if (v) v.at = day(); const n2 = asked.length; hold(() => ORDER.verDaily(w)); const gv = since(n2, 'pressScoop')[0]; B1.verify.again = gv?.ctx?.ver === 1 && gv?.ctx?.sid === sec5.id;
      const ctx6 = { pid: P.id, sid: DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 43 } }).id, d: day(), ver: 1 }; B1.verify.noVer = !ids(KK.pressScoop, ed, ctx6).includes('verify'); B1.verify.facts = KK.pressScoop.facts(w, ed, ctx6).includes(t('你已經查證過了，證據確實。'));
      // 傾向：一般人照實登；家人、很親的偏壓下來；完美主義的照登；貪心的想談條件
      setAff(ed, c1, 0); delete R.ord.hit[c1.agentId]; const pPlain = pick(KK.pressScoop, ed, ctx6); ed._parentNames = [c1.name]; const mFam = marg(KK.pressScoop, ed, ctx6, 'bury'); const mBuryPlain = (() => { ed._parentNames = []; return marg(KK.pressScoop, ed, ctx6, 'bury'); })();
      ed.personality.traits = ['greedy']; const mGreedy = marg(KK.pressScoop, ed, ctx6, 'deal'); plain(ed); const mDealPlain = marg(KK.pressScoop, ed, ctx6, 'deal');
      B1.lean = { plain: pPlain, fam: mFam > mBuryPlain + 0.8, greedy: mGreedy > mDealPlain + 0.4 };
      // 決策核心沒開：照舊直接登
      const sec7 = DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n: 47 } }); for (const s of DARK.S(w).secrets) if (s !== sec7 && s.culprit === c1.agentId) s.found = true;
      const n3 = asked.length; withR(0.01, () => offDecide(() => PRESS.electionDay(w, R, E, day()))); B1.off = { asked: since(n3).length, found: sec7.found };
      B.B1 = B1; }
    // B1b v11.8.0 先查證的那一件，選舉在這兩天內結束了：兩天後照樣再問（沒有「先查證」），事實照實寫選舉已經結束；登了就真的見報。被別人揭穿的才作廢，作廢時主筆記得
    { const V = {}; const mk = (n) => DARK.secret(w, { kind: 'scheme', culprit: c1.agentId, victim: x1.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: c1.name, v: x1.name, n } });
      const sec8 = mk(53); runOp(KK.pressScoop, ed, { pid: P.id, sid: sec8.id, d: day() }, 'verify'); const v8 = O.ver.find(x => x.sid === sec8.id); V.queued = !!v8;
      E.active = false; E.phase = 'none'; if (v8) v8.at = day();
      const n0 = asked.length; hold(() => ORDER.verDaily(w)); const g = since(n0, 'pressScoop').find(e => e.ctx.sid === sec8.id);
      V.asked = !!g && g.ctx.ver === 1; V.ids = g ? ids(KK.pressScoop, ed, g.ctx) : []; const f = g ? KK.pressScoop.facts(w, ed, g.ctx) : ''; if (g) { allTexts(KK.pressScoop, ed, g.ctx); mkPrompt('pressScoop', ed, g.ctx); }
      V.facts = { over: f.includes(t('沒有當選')) || f.includes(t('當選了')), noCampaign: !f.includes(fill('登出來，{c}的選情會受重傷，也會記恨你。', { c: c1.name })), checked: f.includes(t('你已經查證過了，證據確實。')) };
      const last0 = P.stories[P.stories.length - 1]; if (g) runOp(KK.pressScoop, ed, g.ctx, 'print'); const st = P.stories[P.stories.length - 1]; V.print = sec8.found && st !== last0 && st.kind === 'expose' && st.cand === c1.agentId;
      // 被別人揭穿了：不再問，主筆的記憶裡留一句
      const sec9 = mk(59); runOp(KK.pressScoop, ed, { pid: P.id, sid: sec9.id, d: day() }, 'verify'); const v9 = O.ver.find(x => x.sid === sec9.id); if (v9) v9.at = day(); sec9.found = true;
      const n1 = asked.length; hold(() => ORDER.verDaily(w)); V.void = { noAsk: !since(n1, 'pressScoop').some(e => e.ctx.sid === sec9.id), mem: (ed.memory.entries || []).slice(-5).some(e => String(e.content || '').includes(t('我查證到一半，事情已經被別人登出來了。'))), gone: !O.ver.some(x => x.sid === sec9.id) };
      // 談條件開出去之後選舉結束了：當事人照樣被問，事實寫著選舉已經結束
      const sec10 = mk(61); setCash(c1, 120); const hc = { pid: P.id, sid: sec10.id, by: ed.agentId, n: 20, d: day() }; V.hushIds = ids(KK.pressHush, c1, hc); const fh = KK.pressHush.facts(w, c1, hc); allTexts(KK.pressHush, c1, hc); V.hushFacts = fh.includes(t('沒有當選')) || fh.includes(t('當選了'));
      const c0 = cash(c1), e0 = cash(ed); runOp(KK.pressHush, c1, hc, 'pay'); V.hushPay = r3(c0 - cash(c1)) === 20 && r3(cash(ed) - e0) === 20 && !sec10.found;
      E.active = true; E.phase = 'campaign'; B.B1b = V; }
    // B2 抹黑
    if (Pg) { const B2 = {}; delete O.cool['sm|' + Pg.id]; Pg.bribedBy = null; Pg.stories = []; setAff(ed2, c1, 0); setAff(ed2, c2, -60);
      const n0 = asked.length; hold(() => ORDER.smearAsk(w, Pg, E.candidates)); B2.ask = since(n0, 'pressSmear')[0]?.who === ed2.agentId; const n1 = asked.length; hold(() => ORDER.smearAsk(w, Pg, E.candidates)); B2.cool = since(n1, 'pressSmear').length;
      const ctx = { pid: Pg.id, d: day() }; const f = KK.pressSmear.facts(w, ed2, ctx); allTexts(KK.pressSmear, ed2, ctx); mkPrompt('pressSmear', ed2, ctx); B2.facts = (f.includes(t(c1.name)) || f.includes(c1.name)) && (f.includes(t(c2.name)) || f.includes(c2.name)) && f.includes(t('之間有過節'));
      B2.ids = KK.pressSmear.options(w, ed2, ctx).map(o => String(o.id));
      B2.lean = { hate: scoreOf(KK.pressSmear, ed2, ctx, 'smear:' + c2.agentId) > scoreOf(KK.pressSmear, ed2, ctx, 'smear:' + c1.agentId) };
      ed2.personality.traits = ['kind', 'perfectionist']; B2.lean.honest = pick(KK.pressSmear, ed2, ctx) === 'no'; plain(ed2);
      const s0 = Pg.stories.length; runOp(KK.pressSmear, ed2, ctx, 'smear:' + c2.agentId); const st = Pg.stories[Pg.stories.length - 1]; B2.smear = { story: Pg.stories.length === s0 + 1 && st.kind === 'smear' && st.fake && st.cand === c2.agentId };
      // B3 被拆穿：更正／裝沒事／再補一刀
      const B3 = {}; const n2 = asked.length; hold(() => ORDER.fixAsk(w, Pg, st)); B3.ask = since(n2, 'pressFix')[0]?.who === ed2.agentId;
      st.fixed = false; st.corrected = false; const fc = { pid: Pg.id, sid: st.id, d: day() }; const ff = KK.pressFix.facts(w, ed2, fc); allTexts(KK.pressFix, ed2, fc); mkPrompt('pressFix', ed2, fc); B3.facts = (ff.includes(t(c2.name)) || ff.includes(c2.name)) && ff.includes(String(Math.round(Pg.cred))); B3.ids = ids(KK.pressFix, ed2, fc);
      Pg.cred = 50; runOp(KK.pressFix, ed2, fc, 'correct'); B3.correct = { corrected: st.corrected, cred: Pg.cred, story: Pg.stories[Pg.stories.length - 1].kind === 'correct' };
      st.corrected = false; st.fixed = false; Pg.cred = 50; runOp(KK.pressFix, ed2, fc, 'ignore'); B3.ignore = { corrected: st.corrected, fixed: st.fixed, cred: Pg.cred };
      st.corrected = false; st.fixed = false; Pg.cred = 50; const s1 = Pg.stories.length; runOp(KK.pressFix, ed2, fc, 'double'); B3.double = { more: Pg.stories.length === s1 + 1 && Pg.stories[Pg.stories.length - 1].fake, cred: Pg.cred };
      st.corrected = false; st.fixed = false; B3.lean = { plain: pick(KK.pressFix, ed2, fc) }; ed2.personality.traits = ['abrasive']; setAff(ed2, c2, -80); B3.lean.foe = marg(KK.pressFix, ed2, fc, 'double') > (() => { plain(ed2); setAff(ed2, c2, 0); return marg(KK.pressFix, ed2, fc, 'double'); })();
      // 決策核心沒開：照舊 30% 自動更正
      st.corrected = false; st.fixed = false; delete st.fixAsk; st.day = day() - 2; const n3 = asked.length; withR(0.01, () => offDecide(() => PRESS.electionDay(w, R, E, day()))); B3.off = { asked: since(n3).length, corrected: st.corrected };
      B.B2 = B2; B.B3 = B3; }
    // B4 查禁、B5 轉入地下
    { const B4 = {}; let k = (typeof CROWN !== 'undefined') ? CROWN.king(w) : null; CROWN.S(w); if (!k) { k = pool[26]; w.crown.king = k.agentId; } B4.king = !!k; w.crown.legit = 30; const Pp = Pg || P; Pp.banned = false; Pp.underground = false; Pp.closed = false; plain(k);
      const n0 = asked.length; hold(() => ORDER.banAsk(w, Pp, k)); B4.ask = since(n0, 'pressBan')[0]?.who === k.agentId;
      const bc = { pid: Pp.id, d: day() }; const fb = KK.pressBan.facts(w, k, bc); allTexts(KK.pressBan, k, bc); mkPrompt('pressBan', k, bc); B4.facts = fb.includes('30') && fb.includes(t(Pp.name[0])); B4.ids = ids(KK.pressBan, k, bc);
      k.personality.values = ['自由']; const mFree = marg(KK.pressBan, k, bc, 'ban'); k.personality.values = ['權力']; k.personality.traits = ['abrasive']; const mPow = marg(KK.pressBan, k, bc, 'ban'); plain(k); B4.lean = { free: mFree, power: mPow };
      runOp(KK.pressBan, k, bc, 'ban'); B4.ban = { banned: Pp.banned, legit: w.crown.legit };
      // 被禁之後：主筆被問；四天內不再問
      const ed3 = PRESS.editorOf(w, Pp); const n1 = asked.length; hold(() => ORDER.underAsk(w, Pp)); B4.under = { asked: since(n1, 'pressUnder')[0]?.who === ed3?.agentId }; const n2 = asked.length; hold(() => ORDER.underAsk(w, Pp)); B4.under.cool = since(n2, 'pressUnder').length;
      Pp.banned = true; Pp.underground = false; Pp.closed = false; const uc = { pid: Pp.id, d: day() }; allTexts(KK.pressUnder, ed3, uc); mkPrompt('pressUnder', ed3, uc); B4.under.ids = ids(KK.pressUnder, ed3, uc);
      const fu = KK.pressUnder.facts(w, ed3, uc); B4.under.facts = fu.includes(t(Pp.name[0])) && (fu.includes(t(k.name)) || fu.includes(k.name));
      runOp(KK.pressUnder, ed3, uc, 'under'); B4.under.under = Pp.underground; Pp.underground = false; runOp(KK.pressUnder, ed3, uc, 'close'); B4.under.close = Pp.closed; Pp.closed = false; const lg = w.crown.legit; runOp(KK.pressUnder, ed3, uc, 'bow'); B4.under.bow = !Pp.banned && Pp.tame === day() && w.crown.legit > lg;
      // 低頭改口的報社一個月內不再批評
      const n3 = asked.length; hold(() => withR(0.01, () => PRESS.weekday(w, R, day()))); B4.under.tame = !since(n3).some(e => e.kind === 'pressBan' && e.ctx.pid === Pp.id);
      // 沒開：照舊 35% 查禁
      Pp.tame = null; Pp.banned = false; const n4 = asked.length; withR(0.01, () => offDecide(() => PRESS.weekday(w, R, day()))); B4.off = { asked: since(n4).length, banned: Pp.banned };
      for (const Q of R.papers) { Q.banned = false; Q.underground = false; Q.closed = false; Q.tame = null; }
      B.B4 = B4; }
    // B6 候選人塞錢
    { const B6 = {}; for (const Q of R.papers) Q.bribedBy = null; R.elec.bribes = {}; setCash(c2, 300); plain(c2); const ed4 = [];
      const n0 = asked.length; const rb = hold(() => steady(() => PRESS.bribeBy(w, c2))); const gb = since(n0, 'pressBuy')[0]; B6.ask = { asked: !!rb?.asked, who: gb && gb.who === PRESS.editorOf(w, rb.P)?.agentId };
      if (gb) { const Q = rb.P; const e = w.agents[gb.who]; Q.bribedBy = null; const bc = gb.ctx; const fb = KK.pressBuy.facts(w, e, bc); allTexts(KK.pressBuy, e, bc); mkPrompt('pressBuy', e, bc); B6.facts = (fb.includes(t(c2.name)) || fb.includes(c2.name)) && fb.includes('60'); B6.ids = ids(KK.pressBuy, e, bc);
        const pc0 = cash(c2), pe0 = cash(e), ns = DARK.S(w).secrets.length; runOp(KK.pressBuy, e, bc, 'take'); const sx = DARK.S(w).secrets.slice(ns).find(s => s.culprit === c2.agentId); B6.take = { from: r3(pc0 - cash(c2)), to: r3(cash(e) - pe0), bought: Q.bribedBy === c2.agentId, secret: !!sx };
        Q.bribedBy = null; const pc1 = cash(c2); runOp(KK.pressBuy, e, bc, 'refuse'); B6.refuse = { money: r3(pc1 - cash(c2)), bought: !!Q.bribedBy };
        const s0 = Q.stories.length; runOp(KK.pressBuy, e, bc, 'expose'); B6.expose = Q.stories.length === s0 + 1 && Q.stories[Q.stories.length - 1].kind === 'expose';
        plain(e); const mPlain = marg(KK.pressBuy, e, bc, 'take'); e.personality.traits = ['perfectionist']; const pPerf = pick(KK.pressBuy, e, bc); plain(e); B6.lean = { plain: mPlain, perf: pPerf }; ed4.push(e); }
      // 沒開：照舊直接收
      for (const Q of R.papers) { Q.bribedBy = null; if (w.agents[Q.journo]) plain(w.agents[Q.journo]); } R.elec.bribes = {}; R.elec.ask = {}; const pc2 = cash(c2); const n1 = asked.length; const rb2 = withR(0.3, () => offDecide(() => PRESS.bribeBy(w, c2))); B6.off = { asked: since(n1).length, paid: rb2 && !rb2.refused ? r3(pc2 - cash(c2)) : 'refused' };
      B.B6 = B6; }
    E.active = E0.active; E.phase = E0.phase; E.candidates = E0.candidates;
    out.B = B;

    // ============ C) 治安 ============
    const C1 = {}; { const Cv = CIVIC.S(w); const [th, vic, g] = pool.slice(28, 31); neutral([th, vic, g]); const g2 = pool[31]; setJob(g, 'guard'); setCash(th, 2); setCash(vic, 200); setCash(g, 50);
      // 整個鎮只留這一位守衛在鎮上（誰剛好在場是運氣；這裡固定下來）
      const others = npcs().filter(x => x.job?.key === 'guard' && x !== g); const loc0 = others.map(x => [x, x.currentLocation]); for (const x of others) x.currentLocation = 'exploration';
      g.currentLocation = 'town_square'; const n0 = asked.length; const asked1 = hold(() => ORDER.caught(w, { src: 'theft', th: th.agentId, vic: vic.agentId, n: 20, days: 3, d: day(), c0: 2 })); const gc = since(n0, 'caught')[0]; C1.ask = { asked: asked1, who: gc?.who === g.agentId };
      for (const [x, l] of loc0) x.currentLocation = l;
      delete Cv.jail[th.agentId]; setCash(th, 22); setCash(vic, 180); Cv.tlog = [day(), day(), day() - 3];
      const ctx = { src: 'theft', th: th.agentId, vic: vic.agentId, n: 20, days: 3, d: day(), c0: 2, g: g.agentId }; setAff(g, th, 70);
      const f = KK.caught.facts(w, g, ctx); allTexts(KK.caught, g, ctx); mkPrompt('caught', g, ctx); C1.facts = { th: f.includes(t(th.name)) || f.includes(th.name), vic: f.includes(t(vic.name)) || f.includes(vic.name), n: f.includes('20'), tie: f.includes(t('感情很好')), recent: f.includes('3'), poor: f.includes('2'), days: f.includes('3') };
      C1.ids = ids(KK.caught, g, ctx);
      // 關起來：錢還給失主（量這一筆），關三天
      const t0 = cash(th), v0 = cash(vic); runOp(KK.caught, g, ctx, 'jail'); C1.jail = { back: r3(cash(vic) - v0), lost: r3(t0 - cash(th)), days: Cv.jail[th.agentId] - day() };
      delete Cv.jail[th.agentId]; setCash(th, 22); const t1 = cash(th), v1 = cash(vic); runOp(KK.caught, g, ctx, 'repay'); C1.repay = { back: r3(cash(vic) - v1), lost: r3(t1 - cash(th)), jail: !!Cv.jail[th.agentId] };
      setCash(th, 22); const t2 = cash(th), v2 = cash(vic), ns = DARK.S(w).secrets.length; runOp(KK.caught, g, ctx, 'spare'); C1.spare = { moved: r3(cash(vic) - v2) + r3(t2 - cash(th)), jail: !!Cv.jail[th.agentId], secret: DARK.S(w).secrets.slice(ns).some(s => s.culprit === th.agentId) };
      setCash(th, 22); const t3 = cash(th), gg = cash(g), ns2 = DARK.S(w).secrets.length; const want = Math.min(22, Math.max(3, Math.round(20 * 0.5))); runOp(KK.caught, g, ctx, 'bribe');
      C1.bribe = { paid: r3(t3 - cash(th)), got: r3(cash(g) - gg), want, jail: !!Cv.jail[th.agentId], secret: DARK.S(w).secrets.slice(ns2).some(s => s.culprit === g.agentId && s.victim === vic.agentId) };
      // 傾向：一般守衛照規矩關；小偷是自己家人的偏放；貪心的偏收錢；失主是自己家人的一定關
      setAff(g, th, 0); setCash(th, 22); const pPlain = pick(KK.caught, g, ctx); g._parentNames = [th.name]; const pFam = pick(KK.caught, g, ctx); const mJailFam = marg(KK.caught, g, ctx, 'jail'); g._parentNames = []; const mJailPlain = marg(KK.caught, g, ctx, 'jail');
      g.personality.traits = ['greedy']; g.personality.values = ['財富']; const mGreedy = marg(KK.caught, g, ctx, 'bribe'); plain(g); const mBribePlain = marg(KK.caught, g, ctx, 'bribe');
      g._parentNames = [vic.name]; const mVic = marg(KK.caught, g, ctx, 'jail'); g._parentNames = [];
      C1.lean = { plain: pPlain, fam: pFam, famLess: mJailFam < mJailPlain - 0.8, greedy: mGreedy > mBribePlain + 0.5, vic: mVic > mJailPlain };
      // 趁亂搶糧倉：叫他扛回去，糧倉的糧食加回來
      setCash(th, 1); const food0 = w.stockpile.get('food'); const gc2 = { src: 'grain', th: th.agentId, vic: null, n: 9, days: 2, d: day(), cause: '核災', g: g.agentId }; allTexts(KK.caught, g, gc2); C1.grainIds = ids(KK.caught, g, gc2); runOp(KK.caught, g, gc2, 'repay'); C1.grain = r3(w.stockpile.get('food') - food0);
      // 趁亂搶店：關起來，錢還給店主
      setCash(th, 30); const sv0 = cash(vic); const lc = { src: 'loot', th: th.agentId, vic: vic.agentId, n: 12, days: 3, d: day(), cause: '核災', g: g.agentId }; allTexts(KK.caught, g, lc); runOp(KK.caught, g, lc, 'jail'); C1.loot = { back: r3(cash(vic) - sv0), jail: Cv.jail[th.agentId] - day() };
      delete Cv.jail[th.agentId];
      // 從竊案那一段接進來：抓到了（看天）→ 抓到的守衛被問，每一件都有人問、不重複
      const thieves = pool.slice(32, 36); for (const x of thieves) { plain(x); x.personality.traits = ['lazy']; setCash(x, 1); } const rich = pool.slice(36, 40); for (const x of rich) setCash(x, 300);
      const n1 = asked.length; const c0 = Cv.caught; hold(() => withR(0.01, () => CIVIC.crime(w, Cv, day()))); const got = since(n1, 'caught'); C1.crime = { caught: Cv.caught - c0, asked: got.length, guards: got.every(e => w.agents[e.who]?.job?.key === 'guard' && e.who !== e.ctx.th), distinct: new Set(got.map(e => e.ctx.th)).size === got.length };
      for (const x of npcs()) delete Cv.jail[x.agentId];
      // 鎮上沒有守衛（問不到人）：照舊直接關
      const allG = npcs().filter(x => x.job?.key === 'guard'); const l2 = allG.map(x => [x, x.currentLocation]); for (const x of allG) x.currentLocation = 'exploration'; C1.noGuard = !hold(() => ORDER.caught(w, { src: 'theft', th: th.agentId, vic: vic.agentId, n: 5, days: 3, d: day() })); for (const [x, l] of l2) x.currentLocation = l;
      // 決策核心沒開：照舊一定關
      for (const x of thieves) setCash(x, 1); const n2 = asked.length; withR(0.01, () => offDecide(() => CIVIC.crime(w, Cv, day()))); C1.off = { asked: since(n2).length, jailed: thieves.filter(x => Cv.jail[x.agentId] > day()).length };
      for (const x of npcs()) delete Cv.jail[x.agentId]; }
    out.C1 = C1;

    // C2 襲擊
    const C2 = {}; { const ES = w.events; const L = pool[38]; plain(L); const cm0 = w.election.currentMayor; w.election.currentMayor = () => L; const sp = w.stockpile; if (sp.get('silver') < 2000) sp.add('silver', 2000 - sp.get('silver'), w.tickCount, 'test');
      const n0 = asked.length; const asked1 = hold(() => ORDER.raid(w, ES, 0)); const g0 = since(n0, 'raidCall')[0]; C2.ask = { asked: asked1, who: g0?.who === L.agentId };
      const ctx = { ri: 0, d: day() + 0 }; delete ORDER.S(w).raid; const rd = RAID_POOL[0]; const RS = ES.raidStrength(w, rd); const cost = ES.raidTribute(w, rd);
      const f = KK.raidCall.facts(w, L, ctx); allTexts(KK.raidCall, L, ctx); mkPrompt('raidCall', L, ctx); C2.facts = { g: f.includes(String(RS.guards.length)), thr: f.includes(String(RS.threat)), cost: f.includes(String(cost)), tr: f.includes(String(Math.floor(sp.get('silver')))) }; C2.ids = ids(KK.raidCall, L, ctx); { const best = Math.max(RS.guards.length * 2 + 2 + Math.round(RS.buildingDefense), Math.round(RS.guards.length * 1.6 + 2 + RS.buildingDefense * 1.5)); const want = best >= RS.threat * 1.3 ? '照這些數字，我們明顯比對方強。' : best * 1.3 <= RS.threat ? '照這些數字，對方明顯比我們強。' : '照這些數字，兩邊差不多。'; C2.judge = f.includes(t(want)) && ['照這些數字，我們明顯比對方強。', '照這些數字，對方明顯比我們強。', '照這些數字，兩邊差不多。'].filter(k => f.includes(t(k))).length === 1;
        // 打得贏、打不贏兩種情境各看一次強弱那一句
        const S1 = ES.raidStrength; ES.raidStrength = () => ({ guards: [], buildingDefense: 0, threat: 999 }); const fw = KK.raidCall.facts(w, L, ctx); ES.raidStrength = () => ({ guards: new Array(30).fill(L), buildingDefense: 20, threat: 5 }); const fs = KK.raidCall.facts(w, L, ctx); ES.raidStrength = S1; C2.judge2 = fw.includes(t('照這些數字，對方明顯比我們強。')) && fs.includes(t('照這些數字，我們明顯比對方強。'));
        // 公庫不夠付：那一句改說不夠付，選項裡也沒有花錢消災
        const T1 = ES.raidTribute; const trn = Math.floor(sp.get('silver')); ES.raidTribute = () => trn + 100; const fp = KK.raidCall.facts(w, L, ctx); C2.poor = { line: fp.includes(fill('公庫只有 {s} 銀幣，不夠付 {cost} 銀幣打發他們走。', { s: trn, cost: trn + 100 })), noLine: !fp.includes(fill('公庫有 {s} 銀幣，花 {cost} 銀幣可以打發他們走。', { s: trn, cost: trn + 100 })), noPay: !ids(KK.raidCall, L, ctx).includes('pay') }; texts.push(fp, fw, fs); ES.raidTribute = T1; }
      // 花錢消災：公庫少了那一筆，記到「事件」，帳上沒有對不上的錢
      const MM = MONEY.S(w); const day0 = String(day()); const oth0 = Math.abs(w.money?.days?.[day0]?.other || 0); const tr0 = sp.get('silver'); delete ORDER.S(w).raid; runOp(KK.raidCall, L, ctx, 'pay'); C2.pay = { paid: r3(tr0 - sp.get('silver')), cost, other: r3(Math.abs(w.money?.days?.[day0]?.other || 0) - oth0) };
      // 出去打：照原本的公式（守衛 ×2 ＋ 1～3 ＋ 工事）
      delete ORDER.S(w).raid; const fightR = steady(() => ES._raidOutcome(w, rd, 'fight', L)); C2.fight = { held: fightR.held, want: RS.guards.length * 2 + 2 + RS.buildingDefense >= RS.threat };
      // 打不贏的時候：守在牆內被搶的少三成、躲起來多三成，這兩種都沒人逃走
      const S0 = ES.raidStrength; ES.raidStrength = () => ({ guards: [], buildingDefense: 0, threat: 999 }); const loss = (mode) => { if (sp.get('food') < 5000) sp.add('food', 5000 - sp.get('food'), w.tickCount, 'test'); const f0 = sp.get('food'); const tv0 = (ES._travellingAgents || []).length; const r2 = withR(0.3, () => ES._raidOutcome(w, rd, mode, L)); return { held: r2.held, food: r3(f0 - sp.get('food')), fled: (ES._travellingAgents || []).length - tv0 }; };
      C2.loss = { fight: loss('fight'), wall: loss('wall'), hide: loss('hide') }; ES.raidStrength = S0;
      // 傾向：打得贏的時候出去打；打不贏、又膽小的偏花錢或躲
      const pStrong = pick(KK.raidCall, L, ctx); ES.raidStrength = () => ({ guards: [], buildingDefense: 0, threat: 999 }); L.personality.traits = ['neurotic', 'pessimist']; const pWeak = pick(KK.raidCall, L, ctx); const mFightWeak = marg(KK.raidCall, L, ctx, 'fight'); ES.raidStrength = S0; const mFightStrong = marg(KK.raidCall, L, ctx, 'fight'); plain(L);
      C2.lean = { strong: pStrong, weak: pWeak, less: mFightWeak < mFightStrong };
      // 一場襲擊只結算一次（同一題回來兩次，第二次沒有選項）
      delete ORDER.S(w).raid; runOp(KK.raidCall, L, ctx, 'fight'); C2.once = ids(KK.raidCall, L, ctx).length === 0;
      // 沒有首長也沒有守衛：照舊自動結算
      w.election.currentMayor = () => null; const allG = npcs().filter(x => x.job?.key === 'guard'); const l2 = allG.map(x => [x, x.currentLocation]); for (const x of allG) x.currentLocation = 'exploration'; C2.noLeader = !hold(() => ORDER.raid(w, ES, 0)); for (const [x, l] of l2) x.currentLocation = l; w.election.currentMayor = () => L;
      // 決策核心沒開：照舊
      const n1 = asked.length; offDecide(() => ES._triggerRaid(w)); C2.off = since(n1).length;
      w.election.currentMayor = cm0; }
    out.C2 = C2;

    // ============ 存讀檔 ============
    { const SV = {}; const [a, b, c] = pool.slice(0, 3); O.pend.scholars = { by: a.agentId, c: [b.agentId, c.agentId], yes: [a.agentId], no: [], d: day() }; O.ver = [{ pid: P.id, sid: 'S1', by: b.agentId, at: day() + 2 }]; O.cool['sm|' + P.id] = day() + 2;
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null; try { w2.loadSave(sv); w2.observerMode = true; } catch (e) { err = String(e.message); }
      SV.save = { err, pend: w2.order?.pend?.scholars?.by === a.agentId, ver: (w2.order?.ver || []).length === 1, cool: !!w2.order?.cool?.['sm|' + P.id] };
      const sv0 = JSON.parse(JSON.stringify(sv)); delete sv0.order; const w3 = new World(); let err3 = null; try { w3.loadSave(sv0); w3.observerMode = true; const O3 = ORDER.S(w3); ORDER.found(w3, w3.factions, 'scholars', [a, b, c].map(x => w3.agents[x.agentId]).filter(Boolean)); SV.old = { err: null, made: !!O3 }; } catch (e) { err3 = String(e.stack || e.message).slice(0, 200); }
      SV.old = Object.assign(SV.old || {}, { err: err3 }); w2.reset?.(); w3.reset?.(); O.pend = {}; O.ver = []; O.cool = {}; out.SV = SV; }

    // ============ AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const ps = []; ce._askJson = async (p) => { ps.push(String(p)); return [{ n: 1, pick: 'repay', why: 'model reason 88', feel: 'pity' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { const Cv = CIVIC.S(w); const [th, vic, g] = pool.slice(28, 31); setCash(th, 22); setCash(vic, 150); delete Cv.jail[th.agentId]; X0._gAsked = { order: 0 }; X0._kAsked = {}; X0._cDay = day(); X0.lastDay = day();
        const ctx = { src: 'theft', th: th.agentId, vic: vic.agentId, n: 20, days: 3, d: day(), c0: 2, g: g.agentId }; const n0 = seen.length; const v0 = cash(vic);
        DECIDE.askNow(w, [{ a: g, kind: 'caught', ctx }]); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(x => x.kind === 'caught'); o.ai = { pending, id: e?.id, src: e?.src, reason: e?.reason, back: r3(cash(vic) - v0), jail: !!Cv.jail[th.agentId], group: X0._gAsked.order };
        const p = ps.find(x => /repay＝/.test(x)) || ''; const gn = (() => { try { return LLM_LANG.get() === 'en' && I18N.localizeNames ? I18N.localizeNames(g.name, true) : g.name; } catch (e) { return g.name; } })(); /* 只數問這位守衛的題目：等回話的那幾毫秒裡，鎮上別的事也可能送題目出去 */ o.prompt = { n: ps.filter(x => /repay＝/.test(x) && x.includes(gn)).length, all: ps.length, codes: /jail＝/.test(p) && /repay＝/.test(p) && /spare＝/.test(p), facts: p.includes('20') };
        // 額度：同一種一天最多 aiKind 件，超過的當場照個性決定（不會沒下文）
        X0._gAsked = { order: 0 }; X0._kAsked = {}; ps.length = 0; const here = pool.filter(x => !w.isAway?.(x.agentId) && x.currentLocation !== 'exploration' && !(CIVIC.S(w).jail[x.agentId] > day()) && ![th, vic, g].includes(x)); const many = here.slice(0, 5); const gs = here.slice(5, 10); const n1 = seen.length; DECIDE.askNow(w, many.map((x, i) => { setCash(x, 25); return { a: gs[i], kind: 'caught', ctx: { src: 'theft', th: x.agentId, vic: vic.agentId, n: 5, days: 3, d: day(), g: gs[i].agentId } }; }));
        const ruled = seen.slice(n1).filter(x => x.kind === 'caught' && x.src === 'rule').length; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.quota = { kind: KK.caught.aiKind, ai: X0._kAsked.caught, ruled, total: seen.slice(n1).filter(x => x.kind === 'caught').length };
        for (const x of npcs()) delete Cv.jail[x.agentId]; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }
    // 十五種題目逐一組出來，看英文題目裡有沒有中文
    out.prompts = Object.fromEntries(Object.entries(prompts).map(([k, p]) => [k, { len: String(p).length, err: /^ERR/.test(p) ? p : null, cjk: /[一-鿿]/.test(p), sample: (String(p).match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] }]));

    // ============ 放著跑 60 天 ============
    { const errs0 = []; const tick = () => { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } }; const d0 = day(); const n0 = asked.length; const s0 = seen.length; const MM = MONEY.S(w); MM.lastT = MONEY.total(w) - (MM.pend || 0); // 前面造情境時直接改過身上的錢與公庫：從這裡重新起算
      for (let i = 0; i < 60; i++) { tick(); if (i % 10 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      const per = {}; for (const e of asked.slice(n0)) per[e.kind] = (per[e.kind] || 0) + 1; const dec = seen.slice(s0).length; const und = asked.slice(n0).length;
      out.run = { errs: errs0.slice(0, 3), days: day() - d0, kinds: per, decided: dec, asked: und, other: Math.round(other * 100) / 100 }; }
    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-150).map(loc);
    out.texts = texts.filter(Boolean).map(s => { try { return I18N.localizeNames ? I18N.localizeNames(s, true) : s; } catch (e) { return s; } });
    return out; }, KEYS);
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 80 && r.pool >= 40, `${tag} 決策核心開著，鎮上 ${r.pop} 人`, { on: r.on, pop: r.pop, pool: r.pool });
  ok(r.reg.every(x => !x.missing && x.scan === false && x.g === 'order' && x.kind >= 1 && x.title) && r.group === 8, `${tag} 登記了十五個選擇點：由那一刻送進來，用 order 那一組額度（一天 8 件），每種有自己的上限`, r.reg);
  { const A = r.A1;
    ok(A.ask.n === 1 && A.ask.who, `${tag} 成立小團體：湊得到人時，問其中最有動機的那一位（有號召力、看重鄰里）`, A.ask);
    ok(Object.values(A.facts).every(Boolean) && A.ids.join() === 'no,form', `${tag} 事實裡有團體名稱、每個人是誰與交情、自己參加了幾個；選項：不了、出面拉大家`, { f: A.facts, ids: A.ids });
    ok(A.form.asked === 3 && A.form.distinct && A.form.who && A.form.made && A.form.founder && A.form.members === 4 && A.form.pend, `${tag} 出面之後被拉的三個人各問一次，都答應就成立（${A.form.members} 人，帶頭的是出面的人）`, A.form);
    ok(A.joinFacts && A.joinFacts.by && A.joinFacts.tie && A.joinIds.join() === 'no,join', `${tag} 被拉的人：事實裡有誰來拉、跟他的交情；選項：婉拒、答應`, { f: A.joinFacts, ids: A.joinIds });
    ok(!A.fail.made && A.fail.failed && A.fail.log, `${tag} 只有一個人答應：沒成立，日誌寫著沒成`, A.fail);
    ok(A.leanJoin.mClose > A.leanJoin.mFar + 0.8 && A.leanJoin.pFar === 'no', `${tag} 照個性：跟出面的人很親的偏加入；處不來、害羞的不加入`, A.leanJoin);
    ok(A.leanFound.charismatic > A.leanFound.shy + 0.5, `${tag} 照個性：有號召力、看重鄰里的人比害羞的人想出面`, A.leanFound);
    ok(A.cap === 3, `${tag} 同一天最多問三個人要不要出面`, A.cap);
    ok(A.off.asked === 0 && A.off.made >= 1, `${tag} 決策核心沒開：照舊擲骰直接成立，不問`, A.off); }
  { const A = r.A2;
    ok(A.feudAsk.asked && A.feudAsk.why === 'feud' && Object.values(A.facts).every(Boolean) && A.ids.join() === 'stay,fade,quit', `${tag} 待不下去：跟團體裡的人翻臉的人被問；事實裡有平均好感、最受不了誰；選項：留下、淡出、公開退出`, { a: A.feudAsk, f: A.facts, ids: A.ids });
    ok(A.fade.gone && A.fade.quiet && A.quit.gone && A.quit.log, `${tag} 淡出：離開但不上日誌；公開退出：日誌寫著退出`, { fade: A.fade, quit: A.quit });
    ok(A.kin.asked && A.kin.x && A.kin.facts && A.kin.again === 0, `${tag} 團體跟自己的家人作對：被問，事實寫著家人在對頭那邊；十二天內不再問`, A.kin);
    ok(A.lean.shyFade && A.lean.abQuit, `${tag} 照個性：害羞的偏淡出，刻薄的偏公開退出`, A.lean);
    ok(A.dissolve, `${tag} 散不散看人數：剩一個人就散（不擲骰）`, A.dissolve);
    ok(A.off.asked === 0 && A.off.left, `${tag} 決策核心沒開：照舊擲骰退出，不問`, A.off); }
  { const A = r.A3;
    ok(A.ask.who && A.facts.lead && A.facts.tie && A.facts.n && A.ids.join() === 'ignore,clash,befriend', `${tag} 兩派碰上：帶頭的人被問；事實裡有對方帶頭的是誰、交情、兩邊人數；選項：不理、槓上、示好`, { a: A.ask, f: A.facts, ids: A.ids });
    ok(A.clash.rival && A.clash.aff && A.clash.reply && A.replyIds.join() === 'let,back,calm' && A.calm, `${tag} 槓上：兩派結怨、兩邊的人好感下降，對方帶頭的被問（不理、嗆回去、說開）；說開了就不再是死對頭`, { c: A.clash, ids: A.replyIds, calm: A.calm });
    ok(A.befriend.reply && A.befriend.noAllyYet && A.allyIds.join() === 'let,accept,refuse' && A.refuse && A.accept, `${tag} 示好：要對方接受才合作，婉拒就不合作`, { b: A.befriend, ids: A.allyIds, r: A.refuse, a: A.accept });
    ok(A.lean.warm && A.lean.cold, `${tag} 照個性：兩邊感情好的偏示好；刻薄、兩邊有過節的偏槓上`, A.lean);
    ok(A.row.who && A.row.x && A.row.facts && A.row.ids.join() === 'hold,call,talk' && A.row.call && A.row.talk, `${tag} 團體裡的摩擦：最受不了別人的那一位被問；當眾指責團結度下降，私下講開好感回升`, A.row);
    ok(A.off === 0, `${tag} 決策核心沒開：照舊擲骰，不問`, A.off); }
  { const B = r.B; const B1 = B.B1;
    ok(B.papers.P && B.papers.Pg, `${tag} 鎮上有中立報和八卦報`, B.papers);
    ok(B1.ask.who && B1.ask.seen && Object.values(B1.facts).every(Boolean) && B1.ids.join() === 'bury,print,deal,verify', `${tag} 挖到醜聞：主筆被問；事實裡有候選人、什麼事、交情、報社信譽；選項：壓下來、照實登、談條件、先查證`, { a: B1.ask, f: B1.facts, ids: B1.ids });
    ok(!B1.bury.printed && !B1.bury.found && B1.print.story && B1.print.found && B1.print.cred === 5 && B1.print.aff === -30 && B1.print.hit && B1.last, `${tag} 壓下來：沒見報；照實登：見報、信譽 +5、當事人記恨 30，下次事實裡寫著上次得罪他的後果`, { b: B1.bury, p: B1.print, last: B1.last });
    ok(B1.deal.who && B1.hushFacts && B1.hushIds.join() === 'refuse,pay' && B1.pay.from === B1.pay.n && B1.pay.to === B1.pay.n && B1.pay.secret && !B1.pay.printed && !B1.pay.found, `${tag} 談條件：當事人被問；付了 ${B1.pay?.n} 銀幣封口，錢從他到主筆（這一筆本身），記進主筆的秘密，沒見報`, { d: B1.deal, f: B1.hushFacts, ids: B1.hushIds, pay: B1.pay });
    ok(B1.refuse, `${tag} 不付：見報`, B1.refuse);
    ok(B1.verify.queued && B1.verify.again && B1.verify.noVer && B1.verify.facts, `${tag} 先查證：兩天後再問一次，這次沒有「先查證」，事實裡寫著查證過了`, B1.verify);
    ok(B1.lean.plain === 'print' && B1.lean.fam && B1.lean.greedy, `${tag} 照個性：一般主筆照實登；當事人是家人的偏壓下來；貪心的想談條件`, B1.lean);
    ok(B1.off.asked === 0 && B1.off.found, `${tag} 決策核心沒開：照舊直接登`, B1.off); }
  { const V = r.B.B1b;
    ok(V.queued && V.asked && V.ids.join() === 'bury,print,deal' && Object.values(V.facts).every(Boolean) && V.print, `${tag} 先查證之後選舉結束了：兩天後照樣再問（沒有「先查證」），事實寫著選舉已經結束、不再說會傷選情；選了照實登就真的見報`, V);
    ok(V.void.noAsk && V.void.mem && V.void.gone, `${tag} 查證到一半事情被別人揭穿：這一件作廢，主筆記得「查證到一半，被別人登出來了」`, V.void);
    ok(V.hushIds.join() === 'refuse,pay' && V.hushFacts && V.hushPay, `${tag} 談條件開出去之後選舉結束了：當事人照樣被問，事實寫著選舉已經結束；付了 20 銀幣照樣從他到主筆`, { ids: V.hushIds, f: V.hushFacts, pay: V.hushPay }); }
  { const B2 = r.B.B2, B3 = r.B.B3;
    ok(B2 && B2.ask && B2.cool === 0 && B2.facts && B2.ids[0] === 'no' && B2.ids.length === 3, `${tag} 假消息：八卦報的主筆被問（兩天內不再問）；事實裡有候選人和交情；選項：不登、登某位候選人`, B2);
    ok(B2.lean.hate && B2.lean.honest && B2.smear.story, `${tag} 照個性：跟主筆有過節的候選人比較會被抹黑；老實又完美主義的不登；登了就是一則假消息`, B2);
    ok(B3.ask && B3.facts && B3.ids.join() === 'correct,ignore,double', `${tag} 被拆穿：主筆被問；選項：更正、裝沒事、再補一刀`, B3);
    ok(B3.correct.corrected && B3.correct.cred === 30 && B3.correct.story && !B3.ignore.corrected && B3.ignore.fixed && B3.ignore.cred === 25 && B3.double.more && B3.double.cred === 20, `${tag} 更正：信譽照原本 −20 並登更正；裝沒事 −25；再補一刀又登一則、−30`, B3);
    ok(B3.lean.plain === 'correct' && B3.lean.foe, `${tag} 照個性：一般主筆更正；刻薄又跟對方有過節的偏再補一刀`, B3.lean);
    ok(B3.off.asked === 0 && B3.off.corrected, `${tag} 決策核心沒開：照舊自動更正`, B3.off); }
  { const B4 = r.B.B4;
    ok(B4.king && B4.ask && B4.facts && B4.ids.join() === 'let,ban', `${tag} 報社批評國王：國王被問；事實裡有民心、報社；選項：不管、查禁`, B4);
    ok(B4.lean.power > B4.lean.free + 0.6 && B4.ban.banned && B4.ban.legit === 25, `${tag} 照個性：看重權力的國王偏查禁，看重自由的不禁；查禁了民心照原本 −5`, { l: B4.lean, b: B4.ban });
    ok(B4.under.asked && B4.under.cool === 0 && B4.under.ids.join() === 'wait,under,close,bow' && B4.under.facts && B4.under.under && B4.under.close && B4.under.bow && B4.under.tame, `${tag} 被查禁：主筆被問（四天內不再問）；轉入地下、停刊、低頭改口都照做；低頭的報社一個月內不再批評`, B4.under);
    ok(B4.off.asked === 0 && B4.off.banned, `${tag} 決策核心沒開：照舊擲骰查禁`, B4.off); }
  { const B6 = r.B.B6;
    ok(B6.ask.asked && B6.ask.who && B6.facts && B6.ids.join() === 'refuse,take,expose', `${tag} 候選人塞錢：那家報社的主筆被問；選項：不收、收下、不收還登出來`, B6);
    ok(B6.take.from === 60 && B6.take.to === 60 && B6.take.bought && B6.take.secret && B6.refuse.money === 0 && !B6.refuse.bought && B6.expose, `${tag} 收下：60 銀幣從候選人到主筆（這一筆本身）、記進秘密；不收：沒有錢移動；不收還登出來：見報`, B6);
    ok(B6.lean.plain > 0 && B6.lean.perf !== 'take', `${tag} 照個性：一般主筆收（跟以前一樣）；完美主義的不收`, B6.lean);
    ok(B6.off.asked === 0 && B6.off.paid === 60, `${tag} 決策核心沒開：照舊直接收`, B6.off); }
  { const C = r.C1;
    ok(C.ask.asked && C.ask.who && Object.values(C.facts).every(Boolean) && C.ids.join() === 'jail,repay,spare,bribe', `${tag} 抓到小偷：抓到人的守衛被問；事實裡有小偷、失主、金額、交情、窮不窮、最近幾起、關幾天；選項：關、只叫他還、放他、收錢`, { a: C.ask, f: C.facts, ids: C.ids });
    ok(C.jail.back === 20 && C.jail.lost === 20 && C.jail.days === 3 && C.repay.back === 20 && C.repay.lost === 20 && !C.repay.jail, `${tag} 關起來：20 銀幣還給失主、關 3 天；只叫他還：一樣還錢、不關`, { j: C.jail, r: C.repay });
    ok(C.spare.moved === 0 && !C.spare.jail && C.spare.secret && C.bribe.paid === C.bribe.want && C.bribe.got === C.bribe.want && !C.bribe.jail && C.bribe.secret, `${tag} 放他一馬：沒有錢移動、成了秘密；收錢了事：${C.bribe.want} 銀幣從小偷到守衛（這一筆本身），記進守衛的秘密`, { s: C.spare, b: C.bribe });
    ok(C.lean.plain === 'jail' && C.lean.fam !== 'jail' && C.lean.famLess && C.lean.greedy && C.lean.vic, `${tag} 照個性：一般守衛照規矩關；小偷是家人的不關；貪心的偏收錢；失主是自己家人的更要關`, C.lean);
    ok(C.grainIds.join() === 'jail,repay,spare' && C.grain === 9 && C.loot.back === 12 && C.loot.jail === 3, `${tag} 趁亂搶糧倉：叫他扛回去，糧倉加回 9 份；趁亂搶店：關 3 天、錢還給店主`, { g: C.grainIds, n: C.grain, l: C.loot });
    ok(C.crime.caught > 0 && C.crime.asked === C.crime.caught && C.crime.guards && C.crime.distinct, `${tag} 從竊案接進來：抓到 ${C.crime.caught} 個，每一個都由抓到人的守衛決定，不重複`, C.crime);
    ok(C.noGuard && C.off.asked === 0 && C.off.jailed > 0, `${tag} 鎮上沒有守衛：問不到人，照舊；決策核心沒開：照舊一定關`, { ng: C.noGuard, off: C.off }); }
  { const C = r.C2;
    ok(C.ask.asked && C.ask.who && Object.values(C.facts).every(Boolean) && C.ids.join() === 'fight,wall,pay,hide', `${tag} 襲擊：首長被問；事實裡有守衛人數、對方強度、打發要多少、公庫多少；選項：出去打、守在牆內、花錢消災、躲起來`, { a: C.ask, f: C.facts, ids: C.ids });
    ok(C.judge && C.judge2, `${tag} 襲擊：數字後面有一句照數字算出來的強弱（明顯比對方強、差不多、對方明顯比較強，只有一句）`, { j: C.judge, j2: C.judge2 });
    ok(C.poor.line && C.poor.noLine && C.poor.noPay, `${tag} 襲擊：公庫不夠付時，題目說不夠付，選項裡也沒有花錢消災`, C.poor);
    ok(C.pay.paid === C.pay.cost && C.pay.other === 0 && C.fight.held === C.fight.want, `${tag} 花錢消災：公庫付出 ${C.pay.cost} 銀幣、帳上沒有對不上的錢；出去打：照原本的公式`, { p: C.pay, f: C.fight });
    ok(!C.loss.fight.held && !C.loss.wall.held && !C.loss.hide.held && C.loss.wall.food < C.loss.fight.food && C.loss.hide.food > C.loss.fight.food && C.loss.wall.fled === 0 && C.loss.hide.fled === 0, `${tag} 打不贏時：守在牆內被搶的少、躲起來被搶的多，這兩種都沒人逃走`, C.loss);
    ok(C.lean.strong === 'fight' && C.lean.weak !== 'fight' && C.lean.less, `${tag} 照個性：打得贏的時候出去打；打不贏又膽小的不打`, C.lean);
    ok(C.once && C.noLeader && C.off === 0, `${tag} 一場襲擊只結算一次；沒有首長也沒有守衛、決策核心沒開：照舊自動結算`, { once: C.once, nl: C.noLeader, off: C.off }); }
  ok(!r.SV.save.err && r.SV.save.pend && r.SV.save.ver && r.SV.save.cool, `${tag} 存讀檔：等人回話的小團體、要查證的醜聞、冷卻都還在`, r.SV.save);
  ok(!r.SV.old.err, `${tag} 舊存檔（沒有這一版的欄位）讀進來照常跑`, r.SV.old);
  { const M = r.mind;
    ok(M.aiOn && M.ai && M.ai.pending && M.ai.id === 'repay' && M.ai.src === 'ai' && M.ai.reason === 'model reason 88' && M.ai.back === 20 && !M.ai.jail && M.ai.group === 1, `${tag} 開 AI：題目當場送出、等回話，採用它選的「只叫他還」與理由，用 order 那一組的額度`, M.ai);
    ok(M.prompt && M.prompt.n === 1 && M.prompt.codes && M.prompt.facts, `${tag} 題目裡有事實與選項代號`, M.prompt);
    ok(M.quota && M.quota.ai === M.quota.kind && M.quota.ruled === 5 - M.quota.kind && M.quota.total === 5, `${tag} 同一種一天最多 ${M.quota?.kind} 件問 AI，其餘當場照個性決定`, M.quota); }
  { const P = r.prompts; const got = Object.keys(P);
    ok(KEYS.every(k => got.includes(k)) && got.every(k => !P[k].err && P[k].len > 200), `${tag} 十五種題目都組得出來`, { miss: KEYS.filter(k => !got.includes(k)), err: got.filter(k => P[k].err).map(k => [k, P[k].err]) });
    ok(zh || got.every(k => !P[k].cjk), `${tag} 英文題目裡沒有中文（十五種逐一檢查）`, zh ? null : got.filter(k => P[k].cjk).map(k => [k, P[k].sample])); }
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.days === 60 && Ru.other === 0 && Ru.asked > 0, `${tag} 放著跑 60 天：沒有錯誤、帳上沒有對不上的錢（問了 ${Ru.asked} 次：${JSON.stringify(Ru.kinds)}）`, Ru); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 標題、事實、選項、理由、結果都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
