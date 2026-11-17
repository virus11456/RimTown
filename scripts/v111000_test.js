// v11.10.0 戲劇導演只安排場合，不改心（simulation.js 的 _dirArrange／_dirSet／_directorTick；選擇點 spark、heartache 在 sim-decide-love.js，stir 在 sim-decide-soc.js）
//   A) 三種安排（相遇、舊帳被提起、看見心上人跟別人在一起）都真的把人湊到同一個地方：約好時間地點、人走過去、日誌與記憶寫著在哪裡碰到誰
//   B) 導演不再直接改心動與好感：安排的那一刻、碰面的那一刻數值都沒變，只有當事人選了才變
//   C) 每個選項選了之後數值與後續照做；接到現有選擇點的路（告白、寫信、冷戰後誰先開口、道歉、講壞話）走得通
//   D) 兩個人可以選得不一樣；交情與個性會改變傾向
//   E) 決策核心沒開：走舊路徑直接改數值；節奏（連續 4 天沒有名場面、距上次 3 天以上）照舊
//   F) 心動突然加深、單戀撞見、發現情敵（_processRelationships）：什麼時候遇上照舊看天，怎麼反應由本人決定；沒開照舊
//   G) 存讀檔（安排到一半）、舊存檔；開 AI 時題目送出、回答被採用、英文題目沒有中文；導演的紀錄在「真相」頁看得到；放著跑 120 天沒有錯誤
// 用法：BASE=http://localhost:8187/ node scripts/v111000_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8181/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['spark', 'heartache', 'stir'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Decide\]|\[Director\]|\[Love\]|director error/.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 200)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async (KEYS) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 77 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random; const SH0 = window.shuffle;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); out.on = DECIDE.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && a.currentLocation !== 'exploration');
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const KK = DECIDE.KINDS; const texts = []; const memText = (e) => e.content || (e.k ? Memory.render(e.k, e.p || {}) : '');
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id).split(':')[0], src: o.src, reason: tx(o.why), res: tx(o.res), ctx: o.ctx }); if (ev === 'asked') asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; };
    const R = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
    const setAff = (a, b, v) => { R(a, b).affinity = v; }; const setRI = (a, b, v) => { R(a, b).romanticInterest = v; }; const aff = (a, b) => a.relationships.relationships[b.agentId]?.affinity || 0; const ri = (a, b) => a.relationships.relationships[b.agentId]?.romanticInterest || 0;
    const single = (a) => { for (const r of Object.values(a.relationships.relationships)) if (r.status) { const o = w.agents[r.targetId]; r.status = null; r.isCheating = false; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) { r2.status = null; r2.isCheating = false; } } };
    const date = (a, b) => { single(a); single(b); R(a, b).status = 'dating'; R(b, a).status = 'dating'; R(a, b).statusSince = w.tickCount; R(b, a).statusSince = w.tickCount; setAff(a, b, 60); setAff(b, a, 60); };
    const flat = (a) => { for (const r of Object.values(a.relationships.relationships)) { if ((r.affinity || 0) >= 18 || (r.affinity || 0) <= -18) r.affinity = 0; if ((r.romanticInterest || 0) >= 20) r.romanticInterest = 0; r.isFeud = false; } };
    const pick = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    const marg = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id).split(':')[0] === id); if (!me) return null; const others = ops.filter(o => o !== me).map(o => DECIDE.score(Ln, o)); return r3(DECIDE.score(Ln, me) - Math.max(...others)); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id).split(':')[0] === id);
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const has = (s, a) => { s = String(s); return s.includes(a.name) || s.includes(t(a.name)) || (I18N.localizeNames ? s.includes(I18N.localizeNames(a.name, true)) : false); };
    const logs = () => (w.messageLog || []).map(m => String(m.content || (m.k ? World.logText(m) : '')));
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; a._ceremony = null; }
    out.pop = npcs().length;
    // 導演現在可以出手：最近沒有名場面、上次出手很久以前
    const quiet = () => { w.dramaArchive = []; w._townFoundedDay = day() - 10; w._directorLastDay = -99; };
    // 讓導演照我們要的順序挑：先試哪一種手法、誰排第一個（導演用的是遊戲裡的 shuffle）
    const order = (strat, first) => { window.shuffle = (arr) => { const a = arr.slice(); if (a.includes('crush')) return [strat, ...a.filter(s => s !== strat)]; const i = first ? a.findIndex(o => o === first || o?.agentId === first) : -1; if (i > 0) a.unshift(...a.splice(i, 1)); return a; }; };
    const unorder = () => { window.shuffle = SH0; };
    // 走到某一天的早上八點（導演在半夜出手；測試裡手動叫它，要在傍晚之前）
    const toMorning = () => { let g = 0; while ((w.clock.hour < 7 || w.clock.hour >= 9) && g++ < 200) { w.paused = false; w.tick(); } w.paused = true; };
    const D = () => w._dirS();
    const people = adults().filter(a => a.job?.key !== 'mayor');
    const P = people.slice(0, 12); for (const a of P) { plain(a); single(a); flat(a); }
    // 不要有共同好友（相遇那一種先測「剛好都去同一個地方」）
    const noVia = (x, y) => { for (const o of npcs()) if (o !== x && o !== y) { if (aff(o, x) >= 30) setAff(o, x, 10); if (aff(o, y) >= 30) setAff(o, y, 10); } };
    const snap = (pairs) => pairs.map(([a, b]) => [r3(aff(a, b)), r3(ri(a, b))]);
    // 碰面的那一刻：把人放到地點上，只跑導演每格的檢查（不跑整格，別的系統不會在中間改數值）；決策核心的提問先攔下來
    const meetNow = (sc) => { const cap = []; const an = DECIDE.askNow; DECIDE.askNow = (w2, list) => { cap.push(...list); }; try { for (const id of sc.who) w.agents[id].currentLocation = sc.place; sc.from = w.tickCount - 2; w._directorTick(); } finally { DECIDE.askNow = an; } return cap; };

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup || null, kind: KK[k].aiKind, title: t(KK[k].title) } : { k, missing: 1 });
    for (const k of KEYS) if (KK[k]) texts.push(t(KK[k].title));

    // ============ A1 相遇：剛好都去同一個地方 ============
    toMorning();
    const A1 = {}; { const [x, y] = P; flat(x); flat(y); x.personality.traits = ['romantic', 'charismatic']; y.personality.traits = ['abrasive', 'shy', 'jealous']; setAff(x, y, 60); setAff(y, x, 0); setRI(x, y, 5); setRI(y, x, 0); noVia(x, y);
      quiet(); order('crush', x.agentId); const n0 = D().log.length; const s0 = snap([[x, y], [y, x]]); let sc; try { w._dramaDirector(); } finally { unorder(); } sc = D().cur;
      A1.set = { made: D().log.length === n0 + 1, kind: sc?.kind, who: sc ? sc.who.join() === [x.agentId, y.agentId].join() : false, stage: sc?.stage, via: sc?.via, place: sc?.place, same: JSON.stringify(snap([[x, y], [y, x]])) === JSON.stringify(s0), go: x._thingGo?.id === sc?.id && y._thingGo?.id === sc?.id && x._thingGo.place === sc.place, last: w._directorLastDay === day(), st: D().st.crush };
      // 碰面那一刻數值也沒變，兩個人都被問
      const s1 = snap([[x, y], [y, x]]); const cap = meetNow(sc); A1.meet = { stage: sc.stage, same: JSON.stringify(snap([[x, y], [y, x]])) === JSON.stringify(s1), asked: cap.map(q => q.kind + ':' + (q.a === x ? 'x' : q.a === y ? 'y' : '?')).join(), sid: cap.every(q => q.ctx.sid === sc.id), log: logs().slice(-5).some(s => has(s, x) && has(s, y) && s.includes(locName(w, sc.place))), memX: (x.memory.entries || []).slice(-3).some(e => memText(e).includes(locName(w, sc.place)) && has(memText(e), y)) };
      for (const q of cap) { const f = KK.spark.facts(w, q.a, q.ctx); texts.push(f); for (const o of KK.spark.options(w, q.a, q.ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); }
      A1.facts = (() => { const f = KK.spark.facts(w, x, cap[0].ctx); return { place: f.includes(locName(w, sc.place)), name: f.includes(t(y.name)) || f.includes(y.name), aff: f.includes('60'), single: f.includes(t('你們兩個都還單身。')) }; })();
      A1.ids = ids(KK.spark, x, cap[0].ctx); A1.idsY = ids(KK.spark, y, cap[1].ctx);
      // 照個性決定（不加當天的心情起伏）：兩個人選得不一樣
      const r0x = ri(x, y), r0y = ri(y, x), ay0 = aff(y, x); const n1 = seen.length; steady(() => DECIDE.askNow(w, cap)); const got = seen.slice(n1).filter(e => e.kind === 'spark');
      A1.pick = { x: got.find(e => e.who === x.agentId)?.id, y: got.find(e => e.who === y.agentId)?.id, src: got.every(e => e.src === 'rule'), dRx: r3(ri(x, y) - r0x), dRy: r3(ri(y, x) - r0y), dAy: r3(aff(y, x) - ay0), picks: Object.keys(sc.picks).length, view: w.directorView()[0]?.picks?.length };
      A1.x = x.agentId; A1.y = y.agentId; }
    out.A1 = A1;

    // ============ A2 相遇：共同的朋友約兩人吃飯；真的走過去（整格跑） ============
    const A2 = {}; { const [, , x, y, c] = P; toMorning(); flat(x); flat(y); flat(c); setAff(x, y, 30); setAff(y, x, 30); setRI(x, y, 0); setRI(y, x, 0); noVia(x, y); for (const [p, q] of [[c, x], [c, y], [x, c], [y, c]]) setAff(p, q, 50); date(c, P[5]); /* 朋友自己有伴：才不會被導演當成「合得來的單身」挑去跟 x 湊對 */
      quiet(); order('crush', x.agentId); let sc; try { w._dramaDirector(); } finally { unorder(); } sc = D().cur; A2.set = { via: sc?.via === c.agentId, place: sc?.place, kind: sc?.kind, log: logs().slice(-4).some(s => has(s, c) && s.includes(locName(w, sc.place))), cGo: c._thingGo?.id === sc?.id };
      // 整格跑到碰面：人真的在那個地方
      let at = null, g = 0; const n0 = seen.length; while (sc.stage === 'set' && g++ < 300) { w.paused = false; w.tick(); if (sc.stage === 'met' && !at) at = { x: x.currentLocation, y: y.currentLocation, h: w.clock.hour, c: c.currentLocation }; } w.paused = true;
      A2.walk = { stage: sc.stage, at, place: sc.place, inWin: at ? at.h >= 18 && at.h < 21 : false, log: logs().slice(-40).some(s => has(s, c) && has(s, x) && has(s, y)), decided: seen.slice(n0).filter(e => e.kind === 'spark' && (e.who === x.agentId || e.who === y.agentId)).length, dbg: seen.slice(n0).filter(e => e.kind === 'spark').map(e => e.who + ':' + e.id + ':' + (e.ctx?.sid || '')).join(), ids: [x.agentId, y.agentId].join(), picks: Object.keys(sc.picks).length };
      A2.facts = KK.spark.facts(w, x, { sid: sc.id, b: y.agentId, via: c.agentId, place: sc.place }); texts.push(A2.facts); A2.factsVia = has(A2.facts, c) || A2.facts.includes(c.name); }
    out.A2 = A2;

    // ============ A3 舊帳被提起 ============
    const A3 = {}; { const [, , , , , x, y] = P; toMorning(); flat(x); flat(y); x.personality.traits = ['abrasive', 'neurotic']; y.personality.traits = ['stoic', 'kind']; setAff(x, y, -25); setAff(y, x, -20);
      quiet(); order('grudge', x.agentId); const s0 = snap([[x, y], [y, x]]); let sc; try { w._dramaDirector(); } finally { unorder(); } sc = D().cur;
      A3.set = { kind: sc?.kind, who: sc ? sc.who.join() === [x.agentId, y.agentId].join() : false, same: JSON.stringify(snap([[x, y], [y, x]])) === JSON.stringify(s0), go: x._thingGo?.id === sc?.id && y._thingGo?.id === sc?.id };
      const s1 = snap([[x, y], [y, x]]); const cap = meetNow(sc); A3.meet = { stage: sc.stage, same: JSON.stringify(snap([[x, y], [y, x]])) === JSON.stringify(s1), asked: cap.map(q => q.kind + ':' + (q.a === x ? 'x' : 'y')).join(), memX: (x.memory.entries || []).slice(-3).some(e => memText(e).includes(locName(w, sc.place))) };
      for (const q of cap) { texts.push(KK.stir.facts(w, q.a, q.ctx)); for (const o of KK.stir.options(w, q.a, q.ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); }
      A3.facts = (() => { const f = KK.stir.facts(w, x, cap[0].ctx); return { place: f.includes(locName(w, sc.place)), f: f.includes('-25'), g: f.includes('-20') }; })(); A3.ids = ids(KK.stir, x, cap[0].ctx);
      const ax0 = aff(x, y), ay0 = aff(y, x); const n1 = seen.length; steady(() => DECIDE.askNow(w, cap)); const got = seen.slice(n1).filter(e => e.kind === 'stir');
      A3.pick = { x: got.find(e => e.who === x.agentId)?.id, y: got.find(e => e.who === y.agentId)?.id, dx: r3(aff(x, y) - ax0), dy: r3(aff(y, x) - ay0), cold: WAYS.coldWith(w, x, y), fought: sc.fought === x.agentId };
      // 對方也選吵：這一場只吵一次，他只是更氣
      const ax1 = aff(y, x); const rr = opOf(KK.stir, y, cap[1].ctx, 'fight').run(w, y, cap[1].ctx); A3.second = { d: r3(aff(y, x) - ax1), res: tx(rr) };
      A3.x = x.agentId; A3.y = y.agentId; }
    out.A3 = A3;

    // ============ A4 看見心上人跟別人在一起 ============
    const A4 = {}; { const [, , , , , , , c, b, rv] = P; toMorning(); flat(c); date(b, rv); c.personality.traits = ['jealous', 'neurotic']; setRI(c, b, 50); setAff(c, b, 30); setAff(c, rv, 0);
      quiet(); order('jealousy', c.agentId); const s0 = snap([[c, b], [c, rv]]); let sc; try { w._dramaDirector(); } finally { unorder(); } sc = D().cur;
      A4.set = { kind: sc?.kind, who: sc ? sc.who.join() === [c.agentId, b.agentId, rv.agentId].join() : false, same: JSON.stringify(snap([[c, b], [c, rv]])) === JSON.stringify(s0), go: [c, b, rv].every(o => o._thingGo?.id === sc?.id) };
      const s1 = snap([[c, b], [c, rv]]); const cap = meetNow(sc); A4.meet = { stage: sc.stage, same: JSON.stringify(snap([[c, b], [c, rv]])) === JSON.stringify(s1), asked: cap.map(q => q.kind).join(), log: logs().slice(-4).some(s => has(s, c) && has(s, b) && has(s, rv)), mem: (c.memory.entries || []).slice(-3).some(e => has(memText(e), rv) && memText(e).includes(locName(w, sc.place))) };
      texts.push(KK.heartache.facts(w, c, cap[0].ctx)); for (const o of KK.heartache.options(w, c, cap[0].ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why));
      A4.facts = (() => { const f = KK.heartache.facts(w, c, cap[0].ctx); return { place: f.includes(locName(w, sc.place)), b: f.includes(t(b.name)) || f.includes(b.name), dating: f.includes(fill('{b}和{r}正在交往。', { b: b.name, r: rv.name })), ri: f.includes('50') }; })();
      A4.ids = ids(KK.heartache, c, cap[0].ctx);
      const r0 = ri(c, b), a0 = aff(c, rv); const n1 = seen.length; steady(() => DECIDE.askNow(w, cap)); const e = seen.slice(n1).find(x => x.kind === 'heartache');
      A4.pick = { id: e?.id, dR: r3(ri(c, b) - r0), dA: r3(aff(c, rv) - a0), view: w.directorView()[0]?.picks?.[0]?.what ? 1 : 0 };
      A4.c = c.agentId; A4.b = b.agentId; A4.rv = rv.agentId; }
    out.A4 = A4;

    // ============ C 每個選項：數值與後續 ============
    const C = {}; { const [x, y] = [w.agents[A1.x], w.agents[A1.y]]; const ctx = { sid: 'T', b: y.agentId, place: 'tavern' };
      const run1 = (K, a, c2, id) => { const op = opOf(K, a, c2, id); if (!op) return { missing: id }; const n0 = asked.length; const res = op.run(w, a, c2); return { res: tx(res), asked: asked.slice(n0).map(q => q.kind + ':' + q.who) }; };
      // spark：覺得不錯（心動 +12～17）、普通朋友（好感 +2，心動不動）、不自在（好感 -3）
      let r0 = ri(x, y), a0 = aff(x, y); run1(KK.spark, x, ctx, 'warm'); C.warm = r3(ri(x, y) - r0);
      r0 = ri(x, y); a0 = aff(x, y); run1(KK.spark, x, ctx, 'friend'); C.friend = { r: r3(ri(x, y) - r0), a: r3(aff(x, y) - a0) };
      r0 = ri(x, y); a0 = aff(x, y); run1(KK.spark, x, ctx, 'awk'); C.awk = { r: r3(ri(x, y) - r0), a: r3(aff(x, y) - a0) };
      // 再約他：還不夠格告白 → 寫信約見面，對方自己決定去不去
      setRI(y, x, 0); setAff(x, y, 50); r0 = ri(x, y); const B0 = BOARD.S(w).list.length; const g1 = run1(KK.spark, x, ctx, 'again'); const L = BOARD.S(w).list.slice(B0).find(B => B.kind === 'letter' && B.by === x.agentId && B.to === y.agentId);
      DECIDE.drain(w, DECIDE.S(w), day()); C.again1 = { r: r3(ri(x, y) - r0), letter: !!L, want: L?.want, asked: g1.asked.includes('letterGot:' + y.agentId), answered: L ? L.re.some(q => q.id === y.agentId && q.s !== 'asked') : false };
      // 夠格告白：接到告白（confess）
      setRI(x, y, 60); setAff(x, y, 50); setRI(y, x, 45); setAff(y, x, 40); const okC = w.confessCands(x).some(q => q.b === y); const g2 = run1(KK.spark, x, ctx, 'again'); const n2 = seen.length; DECIDE.drain(w, DECIDE.S(w), day()); C.again2 = { cands: okC, asked: g2.asked.includes('confess:' + x.agentId), decided: seen.slice(n2).some(e => e.kind === 'confess' && e.who === x.agentId) };
      single(x); single(y); setRI(x, y, 5); setRI(y, x, 0); setAff(x, y, 60); setAff(y, x, 0);
      // 沒什麼交情、也沒心動的：沒有「再約他」
      setAff(x, y, 20); setRI(x, y, 0); C.noAgain = !ids(KK.spark, x, ctx).includes('again'); setAff(x, y, 60);
      // heartache
      const c = w.agents[A4.c], b = w.agents[A4.b], rv = w.agents[A4.rv]; const hc = { sid: 'T', b: b.agentId, r: rv.agentId, place: 'park' };
      setRI(c, b, 50); r0 = ri(c, b); run1(KK.heartache, c, hc, 'bless'); C.bless = r3(ri(c, b) - r0);
      setRI(c, b, 50); setAff(c, rv, 0); r0 = ri(c, b); a0 = aff(c, rv); run1(KK.heartache, c, hc, 'pine'); C.pine = { r: r3(ri(c, b) - r0), a: r3(aff(c, rv) - a0) };
      const ab0 = aff(c, b); a0 = aff(c, rv); run1(KK.heartache, c, hc, 'avoid'); C.avoid = { b: r3(aff(c, b) - ab0), r: r3(aff(c, rv) - a0) };
      const B1 = BOARD.S(w).list.length; const g3 = run1(KK.heartache, c, hc, 'tell'); const L2 = BOARD.S(w).list.slice(B1).find(B => B.kind === 'letter' && B.by === c.agentId && B.to === b.agentId); C.tell = { letter: !!L2, want: L2?.want, asked: g3.asked.includes('letterGot:' + b.agentId) };
      // 搞破壞：只有個性陰暗的才有；說了就照原本的講壞話（流言、聽的人怎麼想）
      c.personality.traits = ['kind']; C.spoilKind = ids(KK.heartache, c, hc).includes('spoil'); c.personality.traits = ['jealous', 'abrasive'];
      C.spoilDark = ids(KK.heartache, c, hc).includes('spoil'); const G0 = w.gossipNetwork.activeGossip.length; if (C.spoilDark) { delete DARK.S(w).spoke[c.agentId]; run1(KK.heartache, c, hc, 'spoil'); } C.spoil = { spoke: DARK.S(w).spoke[c.agentId] === DARK.today(w), gossip: w.gossipNetwork.activeGossip.slice(G0).some(g => g.about === rv.name && g.source === c.name) };
      c.personality.traits = ['jealous', 'neurotic'];
      // 心上人已經跟別人分了：不再問
      // stir
      const sx = w.agents[A3.x], sy = w.agents[A3.y]; const sc0 = { sid: null, b: sy.agentId, place: 'tavern' };
      WAYS.S(w).cold = {}; setAff(sx, sy, -25); setAff(sy, sx, -20); a0 = aff(sx, sy); const ay0 = aff(sy, sx); steady(() => run1(KK.stir, sx, sc0, 'fight')); /* 吵完會不會冷戰照原本（WAYS.quarrel 六成），這裡固定成會 */ C.fight = { a: r3(aff(sx, sy) - a0), b: r3(aff(sy, sx) - ay0), cold: WAYS.coldWith(w, sx, sy) };
      // 冷戰中「把話講開」= 先開口，對方決定理不理（reached）
      C.mendCold = { text: tx(opOf(KK.stir, sx, sc0, 'mend').text) }; const g4 = run1(KK.stir, sx, sc0, 'mend'); C.mendCold.asked = g4.asked.includes('reached:' + sy.agentId);
      // 欠他一個道歉：去道歉，對方決定原不原諒（forgive）
      WAYS.S(w).cold = {}; DARK.S(w).wrongs.push({ id: 9901, by: sx.agentId, to: sy.agentId, w: 2, day: DARK.today(w) - 3, tries: 0, k: '報復{v}', p: { v: sy.name } }); const g5 = run1(KK.stir, sx, sc0, 'mend'); C.mendSorry = { asked: g5.asked.includes('forgive:' + sy.agentId) };
      DARK.S(w).wrongs = DARK.S(w).wrongs.filter(x2 => x2.id !== 9901);
      // 都沒有：直接找他談（談得攏談不攏看兩個人）
      a0 = aff(sx, sy); const g6 = run1(KK.stir, sx, sc0, 'mend'); C.mendTalk = { res: g6.res, changed: aff(sx, sy) !== a0 };
      // 背後抱怨：照原本的講壞話
      const fr = npcs().find(o => o !== sx && o !== sy && (o.age ?? 30) >= 18 && !w.isAway(o.agentId)); setAff(sx, fr, 40); delete DARK.S(w).spoke[sx.agentId]; const hasVent = ids(KK.stir, sx, sc0).includes('vent'); if (hasVent) run1(KK.stir, sx, sc0, 'vent'); C.vent = { has: hasVent, spoke: DARK.S(w).spoke[sx.agentId] === DARK.today(w) };
      // 情敵那一種：較勁（只有自己這一邊變冷）、放下
      const o = w.agents[A1.x]; const rc = { b: sy.agentId, o: o.agentId, src: 'rival' }; setAff(sx, sy, 0); setRI(sx, o, 50); C.rivalIds = ids(KK.stir, sx, rc); texts.push(KK.stir.facts(w, sx, rc)); for (const op of KK.stir.options(w, sx, rc)) texts.push(tx(op.text), tx(op.say), tx(op.why));
      a0 = aff(sx, sy); const ab = aff(sy, sx); run1(KK.stir, sx, rc, 'fight'); C.rival = { a: r3(aff(sx, sy) - a0), other: r3(aff(sy, sx) - ab) };
      r0 = ri(sx, o); run1(KK.stir, sx, rc, 'yield'); C.yieldR = r3(ri(sx, o) - r0); setRI(sx, o, 0); }
    out.C = C;

    // ============ D 傾向：交情與個性 ============
    const Dd = {}; { const [x, y] = [w.agents[A1.x], w.agents[A1.y]]; const ctx = { b: y.agentId, place: 'tavern' }; single(x); single(y);
      x.personality.traits = ['romantic']; setAff(x, y, 70); setRI(x, y, 5); Dd.warmClose = marg(KK.spark, x, ctx, 'warm');
      x.personality.traits = ['abrasive', 'shy']; setAff(x, y, 21); Dd.warmFar = marg(KK.spark, x, ctx, 'warm'); Dd.awkFar = pick(KK.spark, x, ctx);
      const c = w.agents[A4.c], b = w.agents[A4.b], rv = w.agents[A4.rv]; const hc = { b: b.agentId, r: rv.agentId, place: 'park' }; setRI(c, b, 50);
      c.personality.traits = ['jealous', 'neurotic']; Dd.pineJ = marg(KK.heartache, c, hc, 'pine'); c.personality.traits = ['kind', 'stoic']; Dd.pineK = marg(KK.heartache, c, hc, 'pine'); Dd.kindPick = pick(KK.heartache, c, hc);
      const sx = w.agents[A3.x], sy = w.agents[A3.y]; const sc0 = { b: sy.agentId, place: 'tavern' }; setAff(sx, sy, -25); setAff(sy, sx, -20); WAYS.S(w).cold = {};
      sx.personality.traits = ['abrasive']; Dd.fightA = marg(KK.stir, sx, sc0, 'fight'); sx.personality.traits = ['kind', 'stoic']; Dd.fightK = marg(KK.stir, sx, sc0, 'fight'); Dd.mendK = marg(KK.stir, sx, sc0, 'mend');
      setAff(sy, sx, 40); Dd.mendWarm = marg(KK.stir, sx, sc0, 'mend'); setAff(sy, sx, -20); }
    out.D = Dd;

    // ============ E 沒開決策核心：舊路徑；節奏照舊 ============
    const E = {}; { const [, , , , , , , , , , x, y] = P; plain(x); plain(y); single(x); single(y); flat(x); flat(y); setAff(x, y, 30); setRI(x, y, 5); noVia(x, y);
      quiet(); order('crush', x.agentId); const cur0 = D().cur; const n0 = D().log.length; const r0 = ri(x, y); try { offDecide(() => w._dramaDirector()); } finally { unorder(); }
      E.old = { dR: r3(ri(x, y) - r0), noScene: D().log.length === n0, mem: (x.memory.entries || []).slice(-2).some(e => e.k === '奇怪...最近看{targetName}的眼神,好像跟以前不一樣了。'), last: w._directorLastDay === day() };
      setAff(x, y, -25); setAff(y, x, -10); quiet(); order('grudge', x.agentId); const a0 = aff(x, y), b0 = aff(y, x); try { offDecide(() => w._dramaDirector()); } finally { unorder(); } E.oldGrudge = { a: r3(aff(x, y) - a0), b: r3(aff(y, x) - b0) };
      // 節奏：最近 3 天內有名場面、或導演 2 天前才出過手 → 不出手；4 天沒有名場面、3 天前出過手 → 出手
      setAff(x, y, 30); setRI(x, y, 5); setAff(y, x, 0);
      const tryOnce = (sceneAgo, lastAgo) => { w.dramaArchive = sceneAgo == null ? [] : [{ year: w.clock.year, season: w.clock.season, day: w.clock.day - sceneAgo, kind: 'feud' }]; w._townFoundedDay = day() - 10; w._directorLastDay = lastAgo == null ? -99 : day() - lastAgo; D().cur = null; const n = D().log.length; order('crush', x.agentId); try { w._dramaDirector(); } finally { unorder(); } const did = D().log.length > n; if (did) { D().cur = null; } return did; };
      E.pace = { scene3: tryOnce(3, null), scene4: tryOnce(4, null), last2: tryOnce(null, 2), last3: tryOnce(null, 3) }; for (const id of [x.agentId, y.agentId]) { const a = w.agents[id]; delete a._thingGo; delete a._thingAt; }
      w.dramaArchive = []; D().cur = null; }
    out.E = E;

    // ============ F 心動突然加深、單戀撞見、發現情敵 ============
    const F = {}; { const pp = P.slice(0, 6).sort((p, q) => (p.agentId < q.agentId ? -1 : 1)); const [a, o, z] = pp; for (const p of [a, o, z]) { single(p); plain(p); flat(p); }
      a.personality.traits = ['romantic']; o.personality.traits = ['romantic']; const ra = R(a, o); ra.affinity = 50; ra.romanticInterest = 20; ra.interactionCount = 6; ra.lastInteractionTick = w.tickCount; R(o, a).affinity = 40; R(o, a).lastInteractionTick = w.tickCount;
      const roll = (fn) => { Math.random = () => 0.01; try { return fn(); } finally { Math.random = R0; } };
      const n0 = asked.length; const r0 = ri(a, o); roll(() => w._processRelationships()); const sp = asked.slice(n0).find(q => q.kind === 'spark' && q.who === a.agentId); F.spark = { asked: !!sp, src: sp?.ctx?.src, decided: seen.some(e => e.kind === 'spark' && e.who === a.agentId && e.ctx?.src === 'self') };
      // 心上人有伴：撞見（heartache，來意 self）
      date(o, z); ra.romanticInterest = 50; ra.affinity = 40; R(a, z).affinity = 0; const n1 = asked.length; roll(() => w._processRelationships()); const ha = asked.slice(n1).find(q => q.kind === 'heartache' && q.who === a.agentId); F.heart = { asked: !!ha, src: ha?.ctx?.src, r: ha?.ctx?.r === z.agentId };
      // 心上人單身、另一個人也喜歡他：兩個人各自被問（stir，來意 rival）
      single(o); R(z, o).romanticInterest = 50; R(z, o).affinity = 30; const n2 = asked.length; roll(() => w._processRelationships()); const rvA = asked.slice(n2).filter(q => q.kind === 'stir' && q.ctx?.src === 'rival'); F.rival = { n: rvA.length, both: rvA.some(q => q.who === a.agentId) && rvA.some(q => q.who === z.agentId), o: rvA.filter(q => q.who === a.agentId || q.who === z.agentId).every(q => q.ctx.o === o.agentId) };
      // 沒開：照舊直接改（不問）
      R(z, o).romanticInterest = 0; ra.romanticInterest = 20; ra.affinity = 50; const n3 = asked.length; const r1 = ri(a, o); roll(() => offDecide(() => w._processRelationships())); F.off = { asked: asked.slice(n3).filter(q => KEYS.includes(q.kind)).length, dR: r3(ri(a, o) - r1) };
      ra.romanticInterest = 0; for (const p of [a, o, z]) flat(p); }
    out.F = F;

    // ============ G1 存讀檔：安排到一半 ============
    const G1 = {}; { const [x, y] = [w.agents[A1.x], w.agents[A1.y]]; toMorning(); single(x); single(y); flat(x); flat(y); plain(x); plain(y); setAff(x, y, 40); setRI(x, y, 5); noVia(x, y);
      quiet(); order('crush', x.agentId); try { w._dramaDirector(); } finally { unorder(); } const id0 = D().cur?.id; const last0 = w._directorLastDay;
      try { const data = JSON.parse(JSON.stringify(w.serialize())); const ok1 = w.loadSave(data); const sc = w.director?.cur; G1.load = { ok: ok1, id: sc?.id === id0, stage: sc?.stage, last: w._directorLastDay === last0, pend: !!w._dirLoadPending };
        let g = 0; while (w.director.cur && w.director.cur.stage === 'set' && g++ < 300) { w.paused = false; w.tick(); } w.paused = true; const s2 = w.director.log.find(s => s.id === id0); G1.after = { stage: s2?.stage, picks: s2 ? Object.keys(s2.picks).length : 0 };
        // 舊存檔：沒有 director 欄位
        const old = JSON.parse(JSON.stringify(w.serialize())); delete old.director; const ok2 = w.loadSave(old); quiet(); const n = w._dirS().log.length; w._dramaDirector(); G1.old = { ok: ok2, fresh: !!w.director, acted: w._dirS().log.length >= n, err: null };
        if (w.director?.cur) { const c2 = w.director.cur; for (const id2 of c2.who) { const a = w.agents[id2]; if (a) { delete a._thingGo; delete a._thingAt; } } w.director.cur = null; }
      } catch (e) { G1.err = String(e.stack || e).slice(0, 300); } }
    out.G1 = G1;

    // ============ G2 開 AI：題目送出、回答被採用、英文題目沒有中文 ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; ce._askJson = async (p) => { prompts.push(String(p)); return [{ n: 1, pick: 'warm', why: 'model reason 88', feel: 'warm' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { const x = w.agents[A1.x], y = w.agents[A1.y]; single(x); single(y); setAff(x, y, 40); setRI(x, y, 5); const X0 = DECIDE.S(w); X0._asked = 0; X0._kAsked = {}; X0._gAsked = {}; X0._cDay = day(); X0.lastDay = day();
        const sc = { id: 'DAI', kind: 'meet', d: day(), who: [x.agentId, y.agentId], nm: [x.name, y.name], place: 'tavern', stage: 'met', ask: [x.agentId], picks: {}, tries: 1 }; w._dirS().log.push(sc);
        const r0 = ri(x, y); const n0 = seen.length; DECIDE.askNow(w, [{ a: x, kind: 'spark', ctx: { sid: 'DAI', b: y.agentId, place: 'tavern', d: day() } }]); const pending = seen.length === n0 && !!sc.picks[x.agentId]?.wait;
        await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(q => q.kind === 'spark'); o.ai = { pending, id: e?.id, src: e?.src, reason: e?.reason, dR: r3(ri(x, y) - r0), pick: sc.picks[x.agentId]?.id, ai: sc.picks[x.agentId]?.ai, quota: X0._asked, kind: X0._kAsked.spark };
        const p = prompts.find(q => /warm＝/.test(q)) || ''; o.prompt = { n: prompts.length, codes: /warm＝/.test(p) && /friend＝/.test(p) && /awk＝/.test(p), facts: p.includes(locName(w, 'tavern')), cjk: /[一-鿿]/.test(p), sample: (p.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 其他兩種也送得出去，英文題目同樣沒有中文
        const c = w.agents[A4.c], b = w.agents[A4.b], rv = w.agents[A4.rv]; date(b, rv); setRI(c, b, 50); const sx = w.agents[A3.x], sy = w.agents[A3.y]; setAff(sx, sy, -25); X0._asked = 0; X0._kAsked = {}; prompts.length = 0;
        ce._askJson = async (p2) => { prompts.push(String(p2)); return [{ n: 1, pick: /pine＝/.test(p2) ? 'bless' : 'hold', why: 'model reason 89' }]; };
        DECIDE.askNow(w, [{ a: c, kind: 'heartache', ctx: { b: b.agentId, r: rv.agentId, place: 'park', d: day() } }, { a: sx, kind: 'stir', ctx: { b: sy.agentId, place: 'tavern', d: day() } }]); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.more = { n: prompts.length, kinds: [/pine＝/.test(prompts.join()), /fight＝/.test(prompts.join())], cjk: prompts.some(q => /[一-鿿]/.test(q)), got: seen.slice(-4).filter(q => q.src === 'ai' && (q.kind === 'heartache' || q.kind === 'stir')).map(q => q.kind + ':' + q.id).join() }; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }

    // ============ G3 「真相」頁看得到導演的紀錄 ============
    { const box = document.createElement('div'); document.body.appendChild(box); app.state = w.getState(); app._ppTab = 'truth'; let html = ''; try { app.renderProposals(box); html = box.querySelector('.pp-director')?.textContent || ''; } catch (e) { html = 'ERR ' + e.message; } box.remove();
      const x = w.agents[A1.x], y = w.agents[A1.y]; out.truth = { has: html.length > 0, names: html.includes(t(x.name)) || html.includes(I18N.localizeNames ? I18N.localizeNames(x.name, true) : x.name), head: html.includes(t('導演安排的場合')), met: html.includes(t('碰上了')), cjk: /[一-鿿]/.test(html.split('').filter((ch, i, s) => true).join('').replace(/[一-鿿]+(?=)/g, (m) => (npcs().some(a => a.name.includes(m)) ? '' : m))), sample: html.slice(0, 200) }; }

    // ============ G4 放著跑 120 天 ============
    { const errs0 = []; const st0 = JSON.stringify(D().st); const n0 = seen.length; const t0 = Date.now();
      for (let d = 0; d < 120; d++) { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } if (d % 5 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      const st = D().st; out.run = { errs: errs0.slice(0, 3), st0, st, arranged: st.crush + st.grudge + st.jealousy, met: st.met, miss: st.miss, kinds: KEYS.map(k => seen.slice(n0).filter(e => e.kind === k).length), ms: Date.now() - t0, pop: npcs().length }; }

    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.texts = texts.filter(Boolean).map(loc); out.seenTexts = seen.filter(e => KEYS.includes(e.kind)).map(e => loc(e.reason + ' ' + e.res)).slice(-80);
    return out; }, KEYS);
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 30, `${tag} 決策核心開著，鎮上 ${r.pop} 人`, { on: r.on, pop: r.pop });
  ok(r.reg.every(x => !x.missing && x.scan === false && !x.g && x.kind === 2 && x.title), `${tag} 登記了三個選擇點：由那一刻送進來，用預設的額度，同一種一天最多兩件問 AI`, r.reg);
  { const A = r.A1;
    ok(A.set.made && A.set.kind === 'meet' && A.set.who && A.set.stage === 'set' && !A.set.via && A.set.go && A.set.last && A.set.st >= 1, `${tag} 相遇：導演只約好兩個人今天傍晚都去${A.set.place}（地圖上會走過去），記下這一次出手`, A.set);
    ok(A.set.same, `${tag} 安排的那一刻：心動、好感都沒變`, A.set);
    ok(A.meet.stage === 'met' && A.meet.same && A.meet.asked === 'spark:x,spark:y' && A.meet.sid && A.meet.log && A.meet.memX, `${tag} 兩人都到了就算碰上：日誌與記憶寫著在哪裡碰到誰，兩個人各自被問；碰面的那一刻數值也沒變`, A.meet);
    ok(Object.values(A.facts).every(Boolean), `${tag} 題目裡有在哪裡碰到、碰到誰、交情、兩個人都單身`, A.facts);
    ok(A.ids.join() === 'warm,friend,awk,again' && A.idsY.join() === 'warm,friend,awk', `${tag} 選項：覺得不錯想多認識、普通朋友、有點不自在；已經有點好感的多一個「再約他」`, { x: A.ids, y: A.idsY });
    ok(A.pick.x !== A.pick.y && ['warm', 'again'].includes(A.pick.x) && A.pick.y !== 'warm' && A.pick.src && A.pick.dRx >= 12 && A.pick.dRx <= 17 && A.pick.dRy === 0 && A.pick.picks === 2 && A.pick.view === 2, `${tag} 兩個人選得不一樣：${A.pick.x}／${A.pick.y}；心動只在覺得對方不錯的那個人身上加（+${A.pick.dRx}），另一個人的心動沒動`, A.pick); }
  { const A = r.A2;
    ok(A.set.via && A.set.kind === 'meet' && A.set.log && A.set.cGo, `${tag} 相遇的另一種：兩人共同的好朋友約他們一起去${A.set.place}吃飯（日誌看得到，朋友也一起去）`, A.set);
    ok(A.walk.stage === 'met' && A.walk.at && A.walk.at.x === A.walk.place && A.walk.at.y === A.walk.place && A.walk.inWin && A.walk.log && A.walk.decided === 2 && A.walk.picks === 2, `${tag} 整格跑：傍晚 ${A.walk.at?.h} 點兩個人真的都在${A.walk.place}，碰上之後各自決定`, A.walk);
    ok(A.factsVia, `${tag} 題目裡寫著是誰約的`, A.facts); }
  { const A = r.A3;
    ok(A.set.kind === 'stir' && A.set.who && A.set.same && A.set.go, `${tag} 舊帳被提起：導演只讓兩個處不來的人傍晚去同一個地方，好感沒變`, A.set);
    ok(A.meet.stage === 'met' && A.meet.same && A.meet.asked === 'stir:x,stir:y' && A.meet.memX, `${tag} 碰上了：被觸動的人被問；對方也看他不順眼，一樣被問；碰面那一刻好感沒變`, A.meet);
    ok(Object.values(A.facts).every(Boolean) && A.ids.slice(0, 3).join() === 'hold,fight,mend' && A.ids.every(i => ['hold', 'fight', 'mend', 'vent'].includes(i)), `${tag} 題目裡有地點、雙方的好感；選項：忍下來、當面再吵一次、趁這次把話講開、（有能說話的朋友時）回頭跟朋友抱怨`, { f: A.facts, ids: A.ids });
    ok(A.pick.x === 'fight' && A.pick.y === 'hold' && A.pick.dx <= -6 && A.pick.dx >= -10 && A.pick.dy === -4 && A.pick.cold && A.pick.fought, `${tag} 刻薄的那個當面吵（自己 ${A.pick.dx}、對方被吵 ${A.pick.dy}，吵完冷戰），穩重心軟的那個忍下來`, A.pick);
    ok(A.second.d === -3, `${tag} 對方也選吵：這一場只吵一次，他只是更氣（-3）`, A.second); }
  { const A = r.A4;
    ok(A.set.kind === 'see' && A.set.who && A.set.same && A.set.go, `${tag} 看見心上人跟別人在一起：導演讓那一對和他傍晚去同一個地方，數值沒變`, A.set);
    ok(A.meet.stage === 'met' && A.meet.same && A.meet.asked === 'heartache' && A.meet.log && A.meet.mem, `${tag} 碰上了：日誌與記憶寫著在哪裡看見誰和誰，他被問；數值沒變`, A.meet);
    ok(Object.values(A.facts).every(Boolean) && ['bless', 'pine', 'avoid', 'tell', 'spoil'].every(x => A.ids.includes(x)), `${tag} 題目裡有地點、那兩個人正在交往、心動多少；選項：祝福放下、更放不下、疏遠、寫信說清楚、（個性陰暗的）搞破壞`, { f: A.facts, ids: A.ids });
    ok(A.pick.id === 'pine' && A.pick.dR === 8 && A.pick.dA <= -5 && A.pick.dA >= -9 && A.pick.view, `${tag} 愛吃醋又神經質的：更放不下（心動 +8、對情敵 ${A.pick.dA}）`, A.pick); }
  { const C = r.C;
    ok(C.warm >= 12 && C.warm <= 17 && C.friend.r === 0 && C.friend.a === 2 && C.awk.r === 0 && C.awk.a === -3, `${tag} 相遇的選項：覺得不錯 心動 +${C.warm}；普通朋友 好感 +2；不自在 好感 -3`, C);
    ok(C.again1.r >= 12 && C.again1.letter && C.again1.want === 'meet' && C.again1.asked && C.again1.answered, `${tag} 再約他（還不夠格告白）：寫信約他再見一面，對方收到信自己決定`, C.again1);
    ok(C.again2.cands && C.again2.asked && C.again2.decided, `${tag} 再約他（夠格告白）：接到「心動的人」要不要告白`, C.again2);
    ok(C.noAgain, `${tag} 沒什麼交情也沒心動的：沒有「再約他」`, C.noAgain);
    ok(C.bless <= -4 && C.bless >= -7 && C.pine.r === 8 && C.pine.a <= -5 && C.avoid.b === -4 && C.avoid.r === -4, `${tag} 看見心上人的選項：放下 心動 ${C.bless}；更放不下 心動 +8、對情敵 ${C.pine.a}；疏遠 兩人各 -4`, C);
    ok(C.tell.letter && C.tell.want === 'love' && C.tell.asked, `${tag} 說清楚：寫表白信，對方自己決定怎麼回（心上人有伴，當面告白輪不到）`, C.tell);
    ok(!C.spoilKind && C.spoilDark && C.spoil.spoke && C.spoil.gossip, `${tag} 搞破壞只有個性陰暗的才有，說了就照原本的講壞話（流言傳出去）`, C.spoil);
    ok(C.fight.a <= -6 && C.fight.a >= -10 && C.fight.b === -4 && C.fight.cold, `${tag} 舊帳的選項：當面吵 自己 ${C.fight.a}、對方 -4，吵完冷戰（會不會冷戰照原本的六成；之後誰先開口照 makeup、reached）`, C.fight);
    ok(C.mendCold.asked && C.mendSorry.asked && C.mendTalk.res && C.vent.has && C.vent.spoke, `${tag} 把話講開：冷戰中就先開口（對方決定理不理）、欠他道歉就去道歉（對方決定原不原諒）、不然直接找他談；背後抱怨照原本的講壞話`, { c: C.mendCold, s: C.mendSorry, t: C.mendTalk, v: C.vent });
    ok(C.rivalIds.includes('yield') && C.rival.a <= -8 && C.rival.other === 0 && C.yieldR <= -10, `${tag} 情敵那一種：較勁只有自己這一邊變冷（${C.rival.a}），對方不受影響；也可以放下（心動 ${C.yieldR}）`, { ids: C.rivalIds, r: C.rival, y: C.yieldR }); }
  { const Dd = r.D;
    ok(Dd.warmClose > Dd.warmFar + 0.3 && Dd.awkFar !== 'warm', `${tag} 照交情與個性：浪漫又很要好的偏「覺得不錯」，刻薄害羞又不熟的不會`, Dd);
    ok(Dd.pineJ > Dd.pineK + 0.5 && Dd.kindPick !== 'pine', `${tag} 照個性：愛吃醋的放不下，心軟穩重的不會`, Dd);
    ok(Dd.fightA > Dd.fightK + 0.5 && Dd.mendWarm > Dd.mendK, `${tag} 照個性與交情：刻薄的想吵，心軟穩重的不會；對方對他還有好感時比較想講開`, Dd); }
  { const E = r.E;
    ok(E.old.dR >= 12 && E.old.dR <= 17 && E.old.noScene && E.old.mem && E.old.last && E.oldGrudge.a <= -6 && E.oldGrudge.b <= -6, `${tag} 決策核心沒開：走舊路徑，導演直接改心動（+${E.old.dR}）與雙方好感，不安排場合`, E);
    ok(!E.pace.scene3 && E.pace.scene4 && !E.pace.last2 && E.pace.last3, `${tag} 節奏照舊：連續 4 天沒有名場面、距上次出手 3 天以上才出手`, E.pace); }
  { const F = r.F;
    ok(F.spark.asked && F.spark.src === 'self' && F.spark.decided, `${tag} 心動突然加深的那一刻（照舊看天）：本人決定怎麼看待對方`, F.spark);
    ok(F.heart.asked && F.heart.src === 'self' && F.heart.r, `${tag} 單戀的人撞見心上人和另一半：本人決定怎麼辦`, F.heart);
    ok(F.rival.both && F.rival.o, `${tag} 發現有人跟你喜歡同一個人：兩個人各自決定要不要較勁`, F.rival);
    ok(F.off.asked === 0 && F.off.dR > 0, `${tag} 決策核心沒開：照舊直接改數值、不問`, F.off); }
  ok(!r.G1.err && r.G1.load.ok && r.G1.load.id && r.G1.load.stage === 'set' && r.G1.load.last && r.G1.load.pend && r.G1.after.stage === 'met' && r.G1.after.picks === 2, `${tag} 存讀檔：安排到一半讀回來，傍晚照樣碰上、兩個人照樣決定；導演上次出手的日子也存著`, r.G1);
  ok(!r.G1.err && r.G1.old.ok && r.G1.old.fresh, `${tag} 舊存檔（沒有導演的紀錄）讀進來照常出手`, r.G1.old);
  { const M = r.mind;
    ok(M.aiOn && M.ai && M.ai.pending && M.ai.id === 'warm' && M.ai.src === 'ai' && M.ai.reason === 'model reason 88' && M.ai.dR >= 12 && M.ai.pick === 'warm' && M.ai.ai === 1 && M.ai.quota === 1 && M.ai.kind === 1, `${tag} 開 AI：題目送出、等回話（紀錄上寫還在想），採用它選的與理由，用預設的額度`, M.ai);
    ok(M.prompt && M.prompt.codes && M.prompt.facts, `${tag} 題目裡有地點與選項代號`, M.prompt);
    ok(M.more && M.more.kinds.every(Boolean) && M.more.got.includes('heartache:bless') && M.more.got.includes('stir:hold'), `${tag} 另外兩種也送得出去、回答被採用`, M.more);
    ok(zh || (M.prompt && !M.prompt.cjk && M.more && !M.more.cjk), `${tag} 英文題目裡沒有中文`, zh ? null : { p: M.prompt, m: M.more }); }
  ok(r.truth.has && r.truth.head && r.truth.met && r.truth.names, `${tag} 「真相」頁有一區「導演安排的場合」：安排了誰、在哪裡、碰上了沒、各自怎麼選`, r.truth);
  ok(zh || !r.truth.cjk, `${tag} 「真相」頁那一區英文模式沒有中文`, r.truth);
  { const Ru = r.run; ok(Ru.errs.length === 0 && Ru.arranged >= 1, `${tag} 放著跑 120 天：沒有錯誤；導演安排了 ${Ru.arranged} 次、碰上 ${Ru.met} 次、沒碰上 ${Ru.miss} 次（${Math.round(Ru.ms / 1000)} 秒）`, Ru); console.log('   ', JSON.stringify(Ru)); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 標題、題目、選項、理由、結果都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
