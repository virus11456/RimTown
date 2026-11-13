// v9.28.0 決策核心批次 F（感情與衝突）
// 告白與答不答應、求婚與答不答應、偷情、分手、離婚、當街跟死對頭吵、去鄰鎮作客：改由本人決定，不再擲骰。
// 驗：選擇點都登記了、每日流程不再擲骰（沒有決策核心時仍照舊擲骰）、每個選項的結算、個性與處境不同分數不同、AI 版、存讀檔、中英文
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
    const X = DECIDE.S(w); const K = DECIDE.KINDS;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const R = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
    const set = (a, b, o) => Object.assign(R(a, b), o);
    const traits = (a, ts, vs) => { a.personality.traits = ts.slice(); a.personality.values = (vs || []).slice(); };
    const d0 = () => w._absDay();
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const TEST = [A, B, C, D, E2, F, G, H]; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const NEW = ['confess', 'wooed', 'propose', 'proposed', 'affair', 'breakup', 'divorce', 'feud', 'visit'];
    const noLove = (f) => { DECIDE.love = false; try { return f(); } finally { DECIDE.love = true; } }; // 沒有這一批決策核心時的行為(舊的擲骰)
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const towns0 = w.otherTowns; const send0 = w.onSendVisitor;
    const clean = () => {
      X.cool = {}; X.q = []; w._feudCooldown = {};
      for (const a of all()) { delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 60; a.moodModifier = 0; }
      // 測試用的八個人：彼此、以及跟其他人都沒有感情狀態、沒有好惡
      for (const a of TEST) { traits(a, ['hardworking']); a.age = 30; for (const b of all()) if (a !== b) { for (const [x, y] of [[a, b], [b, a]]) { const r = x.relationships.relationships[y.agentId]; if (r) Object.assign(r, { affinity: 0, romanticInterest: 0, isCheating: false, statusSince: 0 }), r.status = null; } } }
      for (const a of all()) if (!TEST.includes(a)) for (const r of Object.values(a.relationships.relationships)) if (TEST.some(x => x.agentId === r.targetId)) { r.status = null; r.isCheating = false; r.romanticInterest = 0; }
      w.otherTowns = towns0; w.onSendVisitor = send0;
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const go = (a, key, id, ctx) => { const o = opt(a, key, id, ctx); return o ? o.run(w, a, ctx) : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const texts = {}; const keep = (name, key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const st = (a, b) => R(a, b).status;
    // 舊流程：每天的感情檢查（只看這一對）
    const relDay = (v) => fix(v, () => w._processRelationships());
    const crush = (a, b) => { set(a, b, { romanticInterest: 70, affinity: 50, interactionCount: 9 }); set(b, a, { romanticInterest: 70, affinity: 50, interactionCount: 9 }); };
    const couple = (a, b, s, ago) => { for (const [x, y] of [[a, b], [b, a]]) { const r = R(x, y); r.status = s; r.statusSince = w.tickCount - ago; } };

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), love: DECIDE.love === true, on: w._byLove(), off: noLove(() => w._byLove()) };

    // ---------- 2) 告白、答不答應 ----------
    clean(); { crush(A, B); const c1 = K.confess.when(w, A); keep('confess', 'confess', A);
      set(C, D, { romanticInterest: 70, affinity: 50 }); set(D, C, { romanticInterest: 10, affinity: 50 });
      out.conf = { ctx: c1?.b === B.agentId, ids: ids(A, 'confess'), oneSided: K.confess.when(w, C) };
      const g0 = sc(A, 'confess', 'go:' + B.agentId); traits(A, ['shy']); const gShy = sc(A, 'confess', 'go:' + B.agentId); traits(A, ['romantic']); const gRom = sc(A, 'confess', 'go:' + B.agentId); traits(A, ['hardworking']); out.conf.sc = { g0, gShy, gRom };
      relDay(0.01); out.conf.untouched = !st(A, B) && !st(B, A);
      const res = go(A, 'confess', 'go:' + B.agentId); const q = X.q.slice(); const cx = q[0]?.ctx; X.q = [];
      out.conf.run = { res: !!res, queued: q.length === 1 && q[0].kind === 'wooed' && q[0].a === B.agentId, notYet: !st(A, B) };
      if (cx) { keep('wooed', 'wooed', B, cx); out.woo = { ids: ids(B, 'wooed', cx) };
        const y0 = sc(B, 'wooed', 'yes', cx); set(B, A, { romanticInterest: 36 }); const yLow = sc(B, 'wooed', 'yes', cx); set(B, A, { romanticInterest: 70 }); out.woo.sc = { y0, yLow, no: sc(B, 'wooed', 'no', cx) };
        const m0 = A.moodModifier; go(B, 'wooed', 'no', cx); out.woo.no = { single: !st(A, B), sad: A.moodModifier < m0, ri: R(A, B).romanticInterest < 70, cool: (X.cool[A.agentId + '|confess'] || 0) >= d0() + 19, log: /💔/.test(logs(6)) };
        set(A, B, { romanticInterest: 70 }); const r2 = go(B, 'wooed', 'yes', cx); out.woo.yes = { res: !!r2, dating: st(A, B) === 'dating' && st(B, A) === 'dating', again: ids(B, 'wooed', cx), noMore: K.confess.when(w, A) }; }
      // 流程：告白的當下就問被告白的人
      clean(); crush(A, B); const p0 = (X.pick['wooed.yes'] || 0) + (X.pick['wooed.no'] || 0); fix(0.5, () => { go(A, 'confess', 'go:' + B.agentId); DECIDE.drain(w, X, d0()); }); out.conf.flow = (X.pick['wooed.yes'] || 0) + (X.pick['wooed.no'] || 0) - p0;
      // 沒有決策核心：照舊擲骰
      clean(); crush(A, B); noLove(() => relDay(0.01)); out.conf.dice = st(A, B) === 'dating'; }

    // ---------- 3) 求婚、答不答應 ----------
    clean(); { crush(A, B); couple(A, B, 'dating', 400); set(A, B, { affinity: 60, romanticInterest: 65 }); set(B, A, { affinity: 60, romanticInterest: 65 }); const c1 = K.propose.when(w, A); keep('propose', 'propose', A);
      out.prop = { ctx: c1?.b === B.agentId, ids: ids(A, 'propose') };
      couple(C, D, 'dating', 100); set(C, D, { affinity: 60, romanticInterest: 65 }); set(D, C, { affinity: 60, romanticInterest: 65 }); out.prop.young = K.propose.when(w, C);
      const p0 = sc(A, 'propose', 'propose'); traits(A, ['hardworking'], ['家庭']); const pFam = sc(A, 'propose', 'propose'); traits(A, ['hardworking'], ['自由']); const pFree = sc(A, 'propose', 'propose'); traits(A, ['hardworking']); out.prop.sc = { p0, pFam, pFree };
      relDay(0.01); out.prop.untouched = st(A, B) === 'dating';
      const res = go(A, 'propose', 'propose'); const q = X.q.slice(); const cx = q[0]?.ctx; X.q = [];
      out.prop.run = { res: !!res, queued: q.length === 1 && q[0].kind === 'proposed' && q[0].a === B.agentId, notYet: st(A, B) === 'dating' };
      if (cx) { keep('proposed', 'proposed', B, cx); out.pro = { ids: ids(B, 'proposed', cx) };
        go(B, 'proposed', 'later', cx); out.pro.later = { still: st(A, B) === 'dating', cool: (X.cool[A.agentId + '|propose'] || 0) >= d0() + 14, log: /💍/.test(logs(6)) };
        const r2 = go(B, 'proposed', 'yes', cx); out.pro.yes = { res: !!r2, married: st(A, B) === 'married' && st(B, A) === 'married', wedding: typeof CEREMONY === 'undefined' || JSON.stringify(w.ceremony || {}).includes(A.agentId) }; }
      clean(); crush(A, B); couple(A, B, 'dating', 400); set(A, B, { affinity: 60, romanticInterest: 65 }); set(B, A, { affinity: 60, romanticInterest: 65 }); noLove(() => relDay(0.01)); out.prop.dice = st(A, B) === 'married'; }

    // ---------- 4) 對別人動了心：偷情 ----------
    clean(); { couple(A, B, 'married', 900); set(A, B, { affinity: 10 }); set(B, A, { affinity: 30 }); set(A, C, { romanticInterest: 70, affinity: 50 }); set(C, A, { romanticInterest: 60, affinity: 40 });
      const c1 = K.affair.when(w, A); keep('affair', 'affair', A); out.aff = { ctx: !!c1, ids: ids(A, 'affair') };
      set(A, B, { affinity: 50 }); out.aff.happy = K.affair.when(w, A); traits(A, ['romantic']); out.aff.romantic = !!K.affair.when(w, A); traits(A, ['hardworking']); set(A, B, { affinity: 10 });
      const s0 = sc(A, 'affair', 'stay'); traits(A, ['kind']); const sKind = sc(A, 'affair', 'stay'); traits(A, ['hardworking']); out.aff.sc = { s0, sKind, go: sc(A, 'affair', 'go:' + C.agentId) };
      relDay(0.01); out.aff.untouched = !R(A, C).isCheating;
      const res = go(A, 'affair', 'go:' + C.agentId); out.aff.run = { res: !!res, cheat: R(A, C).isCheating && R(C, A).isCheating, still: st(A, B) === 'married', one: K.affair.when(w, A) };
      clean(); couple(A, B, 'married', 900); set(A, B, { affinity: 10 }); set(A, C, { romanticInterest: 70, affinity: 50 }); set(C, A, { romanticInterest: 60, affinity: 40 });
      const lo = A.agentId < B.agentId; noLove(() => relDay(0.01)); out.aff.dice = lo ? R(A, C).isCheating : null; }

    // ---------- 5) 感情淡了：分手 ----------
    clean(); { couple(A, B, 'dating', 200); set(A, B, { affinity: -20, romanticInterest: 30 }); set(B, A, { affinity: 10, romanticInterest: 30 });
      const c1 = K.breakup.when(w, A); keep('breakup', 'breakup', A); out.brk = { ctx: c1?.b === B.agentId, ids: ids(A, 'breakup'), fresh: (() => { couple(C, D, 'dating', 50); set(C, D, { affinity: -20 }); return K.breakup.when(w, C); })() };
      const b20 = sc(A, 'breakup', 'break'); set(A, B, { affinity: -60 }); const b60 = sc(A, 'breakup', 'break'); set(A, B, { affinity: -20 }); out.brk.sc = { b20, b60 };
      relDay(0.01); out.brk.untouched = st(A, B) === 'dating';
      const res = go(A, 'breakup', 'break'); out.brk.run = { res: !!res, ex: st(A, B) === 'ex' && st(B, A) === 'ex', log: /分手|broke up/i.test(logs(6)) };
      clean(); couple(A, B, 'dating', 200); set(A, B, { affinity: -20 }); set(B, A, { affinity: -20 }); noLove(() => relDay(0.01)); out.brk.dice = st(A, B) === 'ex'; }

    // ---------- 6) 婚姻走不下去：離婚 ----------
    clean(); { couple(A, B, 'married', 900); set(A, B, { affinity: -50 }); set(B, A, { affinity: -40 });
      const c1 = K.divorce.when(w, A); keep('divorce', 'divorce', A); out.div = { ctx: c1?.b === B.agentId, ids: ids(A, 'divorce') };
      set(B, A, { affinity: 0 }); out.div.oneSided = K.divorce.when(w, A); set(B, A, { affinity: -40 });
      const s0 = sc(A, 'divorce', 'stay'); const kid = all().find(k => !TEST.includes(k)); const kp = kid._parentNames, ka = kid.age; kid._parentNames = [A.name, B.name]; kid.age = 8;
      const sKid = sc(A, 'divorce', 'stay'); keep('divorceKid', 'divorce', A); kid._parentNames = kp; kid.age = ka; out.div.sc = { s0, sKid };
      relDay(0.01); out.div.untouched = st(A, B) === 'married';
      const res = go(A, 'divorce', 'divorce'); out.div.run = { res: !!res, ex: st(A, B) === 'ex' && st(B, A) === 'ex', log: /離婚|divorced/i.test(logs(6)) };
      clean(); couple(A, B, 'married', 900); set(A, B, { affinity: -50 }); set(B, A, { affinity: -50 }); noLove(() => relDay(0.01)); out.div.dice = st(A, B) === 'ex'; }

    // ---------- 7) 碰上死對頭：當街吵 ----------
    clean(); { set(A, B, { affinity: -50 }); set(B, A, { affinity: -50 }); set(A, C, { affinity: -40 }); set(C, A, { affinity: -40 });
      const c1 = K.feud.when(w, A); keep('feud', 'feud', A); out.feud = { ctx: c1?.b === B.agentId, ids: ids(A, 'feud'), mild: (() => { set(D, E2, { affinity: -50 }); set(E2, D, { affinity: -10 }); return K.feud.when(w, D); })() };
      const g0 = sc(A, 'feud', 'go:' + B.agentId); traits(A, ['abrasive']); const gAb = sc(A, 'feud', 'go:' + B.agentId); traits(A, ['stoic']); const gSt = sc(A, 'feud', 'go:' + B.agentId); traits(A, ['hardworking']); out.feud.sc = { g0, gAb, gSt };
      fix(0.01, () => w._processFeuds()); out.feud.untouched = !w._feudCooldown[[A.agentId, B.agentId].sort().join('|')];
      const a0 = R(A, B).affinity; const res = fix(0.9, () => go(A, 'feud', 'go:' + B.agentId)); out.feud.run = { res: !!res, worse: R(A, B).affinity < a0, log: /大吵|shouting match|row/i.test(logs(8)), cool: !K.feud.options(w, A, K.feud.when(w, A)).some(o => o.id === 'go:' + B.agentId) };
      clean(); set(A, B, { affinity: -50 }); set(B, A, { affinity: -50 }); noLove(() => fix(0.01, () => w._processFeuds())); out.feud.dice = !!w._feudCooldown[[A.agentId, B.agentId].sort().join('|')]; }

    // ---------- 8) 去鄰鎮作客（真的出門會把人移出鎮上，這裡把「送出門」換成記一筆） ----------
    clean(); { const sent = []; w.otherTowns = [{ id: 'tx1', name: 'Oakvale' }] /* 鎮名用不需翻譯的字，英文版才能檢查有沒有漏翻 */; const sv = w.sendVisitorTo; w.sendVisitorTo = (a, town, n) => { sent.push([a.agentId, town.id, n]); return true; };
      const cx = { town: 'tx1', stay: 3, again: 1 }; A.mood = 70; keep('visit', 'visit', A, cx);
      out.vis = { ids: ids(A, 'visit', cx), sad: (() => { B.mood = 20; return K.visit.options(w, B, cx).length; })(), closed: (() => { w.otherTowns[0].closed = true; const n = K.visit.options(w, A, cx).length; delete w.otherTowns[0].closed; return n; })() };
      const g0 = sc(A, 'visit', 'go', cx); traits(A, ['hardworking'], ['冒險']); const gAdv = sc(A, 'visit', 'go', cx); traits(A, ['hardworking']); out.vis.sc = { g0, gAdv };
      const vp = () => Object.entries(X.pick).filter(([k]) => /^visit\./.test(k)).reduce((s2, [, v]) => s2 + v, 0);
      X.q = []; const pk0 = vp(); fix(0.01, () => w._visitorDaily()); out.vis.flow = { asked: vp() - pk0, q: X.q.length }; sent.length = 0; X.q = [];
      go(A, 'visit', 'stay', cx); out.vis.stay = { again: X.q.length === 1 && X.q[0].kind === 'visit' && X.q[0].ctx.again === 0 && X.q[0].a !== A.agentId, sent: sent.length }; X.q = [];
      const res = go(A, 'visit', 'go', cx); out.vis.go = { res: !!res, sent: sent.length === 1 && sent[0][0] === A.agentId && sent[0][1] === 'tx1' && sent[0][2] === 3 };
      sent.length = 0; noLove(() => fix(0.01, () => w._visitorDaily())); out.vis.dice = sent.length === 1;
      w.sendVisitorTo = sv; w.otherTowns = towns0; }

    // ---------- 9) 接到每天的決策流程（AI 沒開） ----------
    clean(); { crush(A, B); traits(A, ['romantic', 'charismatic']); only(A); others(A, ['confess']);
      fix(0.5, () => today()); const e = lastLog(A); const eb = lastLog(B); out.rule = { kind: e?.kind, id: e?.id, ai: e?.ai, answered: eb?.kind, dating: st(A, B) === 'dating' }; }

    // ---------- 10) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    clean(); w.fullAgentMode = true; { couple(A, B, 'married', 900); set(A, B, { affinity: -50 }); set(B, A, { affinity: -40 }); only(A); others(A, ['divorce']); prompts = [];
      reply = (p) => /婚姻很糟|marriage is in a bad way|marriage/i.test(p) ? [{ n: 1, pick: 'stay', why: 'W-DIV', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(A); const pD = prompts.find(p => /婚姻很糟|marriage/i.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, still: st(A, B) === 'married', plan: DECIDE.view(w, A).plan, menu: /other＝/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; }
    // 被告白：告白的當下就問 AI
    clean(); w.fullAgentMode = true; { crush(A, B); prompts = [];
      reply = () => [{ n: 1, pick: 'no', why: 'W-WOO' }];
      fix(0.5, () => go(A, 'confess', 'go:' + B.agentId)); DECIDE.drain(w, X, d0()); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(B);
      out.aiWoo = { id: e?.id, ai: e?.ai, why: e?.why?.raw, asked: prompts.length, single: !st(A, B) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 11) 存讀檔、跑幾天 ----------
    clean(); { couple(A, B, 'dating', 200); X.cool[C.agentId + '|confess'] = d0() + 20;
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); const a2 = w2.agents[A.agentId];
      out.save = { dating: a2?.relationships?.relationships?.[B.agentId]?.status === 'dating', cool: DECIDE.S(w2).cool[C.agentId + '|confess'] === d0() + 20 }; }
    clean(); { for (const a of TEST) for (const b of TEST) if (a !== b) set(a, b, { affinity: ((a.name.charCodeAt(0) * 7 + b.name.length * 13) % 160) - 80, romanticInterest: (a.name.charCodeAt(0) * 3 + b.name.charCodeAt(0)) % 90, interactionCount: 9 });
      couple(C, D, 'married', 900); couple(E2, F, 'dating', 300);
      let err = null; try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, q: X.q.length, picks: Object.fromEntries(Object.entries(X.pick).filter(([k]) => NEW.some(n => k.startsWith(n + '.')))) }; }
    // 每個選擇點的標題、事實、選項文字在英文版都有翻譯
    out.txt = (() => { const bad = []; const cjk = (s) => /[一-鿿]/.test(String(s || '')); const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; if (!en) return bad;
      const say = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : (() => { let s = t(x.k); for (const [a, b] of Object.entries(x.p || {})) s = s.split('{' + a + '}').join(typeof b === 'object' ? say(b) : (typeof b === 'string' ? t(b) : b)); return s; })()) : (typeof x === 'string' ? t(x) : '');
      for (const k of NEW) if (cjk(t(K[k].title))) bad.push('title:' + k);
      for (const [name, v] of Object.entries(texts)) { if (v.err) { bad.push('err:' + name + ':' + v.err); continue; } if (cjk(I18N.localizeNames(String(v.fact || ''), true))) bad.push('fact:' + name + ':' + v.fact);
        for (const row of v.ops) for (const x of row) { const s = I18N.localizeNames(say(x), true); if (cjk(s)) bad.push('opt:' + name + ':' + s); } }
      // 結算時寫進日誌與記憶的新句子
      for (const k of ['💔 {agent}向{other}告白，被婉拒了。', '💍 {agent}向{other}求婚，對方說還沒準備好。', '我鼓起勇氣向{other}告白，被婉拒了。', '{agent}向我告白，我婉拒了。', '我向{other}求婚，對方說還沒準備好。', '{agent}向我求婚，我說還沒準備好。']) if (cjk(t(k).replace(/\{\w+\}/g, ''))) bad.push('log:' + k);
      return bad; })();
    out.facts = Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.err ? 'ERR ' + v.err : String(v.fact || '').length]));
    return out;
  });
  const L = `[${lang}] `;
  ok(r.kinds.all && r.kinds.love && r.kinds.on && !r.kinds.off, L + '九個選擇點都登記了，小鎮知道感情與衝突交給本人', r.kinds);
  // 告白
  ok(r.conf.ctx && r.conf.ids.join() === `wait,go:${r.conf.ids[1]?.split(':')[1]}` && !r.conf.oneSided, L + '告白：只問互相有意思的單身村民；單戀不問', r.conf);
  ok(r.conf.sc.gShy < r.conf.sc.g0 && r.conf.sc.gRom > r.conf.sc.g0, L + '告白：害羞的人比較不敢說，多情的人比較敢', r.conf.sc);
  ok(r.conf.untouched && r.conf.run.res && r.conf.run.queued && r.conf.run.notYet && r.conf.flow === 1, L + '告白：每天的流程不再擲骰；本人決定告白，被告白的人當下被問、還沒在一起', r.conf);
  ok(r.woo && r.woo.ids.join() === 'no,yes' && r.woo.sc.yLow < r.woo.sc.y0, L + '被告白：可以婉拒或答應；沒那麼心動的人比較會婉拒', r.woo);
  ok(r.woo && r.woo.no.single && r.woo.no.sad && r.woo.no.ri && r.woo.no.cool && r.woo.no.log, L + '被告白：婉拒的話告白的人難過、心冷了一點、二十天內不再開口', r.woo?.no);
  ok(r.woo && r.woo.yes.res && r.woo.yes.dating && !r.woo.yes.again?.length && !r.woo.yes.noMore, L + '被告白：答應就開始交往，不再問告白', r.woo?.yes);
  ok(r.conf.dice, L + '告白：沒有決策核心時照舊擲骰', r.conf.dice);
  // 求婚
  ok(r.prop.ctx && r.prop.ids.join() === 'wait,propose' && !r.prop.young, L + '求婚：只問交往夠久、感情夠好的人', r.prop);
  ok(r.prop.sc.pFam > r.prop.sc.p0 && r.prop.sc.pFree < r.prop.sc.p0, L + '求婚：重視家庭的人比較想結婚，重視自由的人比較不想', r.prop.sc);
  ok(r.prop.untouched && r.prop.run.res && r.prop.run.queued && r.prop.run.notYet, L + '求婚：每天的流程不再擲骰；本人決定求婚，另一半當下被問', r.prop);
  ok(r.pro && r.pro.ids.join() === 'later,yes' && r.pro.later.still && r.pro.later.cool && r.pro.later.log, L + '被求婚：說還沒準備好的話還是在交往，求婚的人十五天內不再開口', r.pro);
  ok(r.pro && r.pro.yes.res && r.pro.yes.married && r.pro.yes.wedding, L + '被求婚：答應就訂婚、排婚禮', r.pro?.yes);
  ok(r.prop.dice, L + '求婚：沒有決策核心時照舊擲骰', r.prop.dice);
  // 偷情
  ok(r.aff.ctx && r.aff.ids.join() === `stay,go:${r.aff.ids[1]?.split(':')[1]}` && !r.aff.happy && r.aff.romantic, L + '偷情：只問感情不好（或多情）又對彼此有意思的第三人', r.aff);
  ok(r.aff.sc.sKind > r.aff.sc.s0, L + '偷情：善良的人比較會守住現在的感情', r.aff.sc);
  ok(r.aff.untouched && r.aff.run.res && r.aff.run.cheat && r.aff.run.still && !r.aff.run.one, L + '偷情：每天的流程不再擲骰；本人決定就偷偷在一起（婚姻還在），一次只有一段', r.aff.run);
  ok(r.aff.dice !== false, L + '偷情：沒有決策核心時照舊擲骰', r.aff.dice);
  // 分手
  ok(r.brk.ctx && r.brk.ids.join() === 'stay,break' && !r.brk.fresh && r.brk.sc.b60 > r.brk.sc.b20, L + '分手：只問感情淡了的情侶；越僵越想分', r.brk);
  ok(r.brk.untouched && r.brk.run.res && r.brk.run.ex && r.brk.run.log && r.brk.dice, L + '分手：每天的流程不再擲骰；本人決定就分手；沒有決策核心時照舊擲骰', r.brk);
  // 離婚
  ok(r.div.ctx && r.div.ids.join() === 'stay,divorce' && !r.div.oneSided && r.div.sc.sKid > r.div.sc.s0, L + '離婚：只問兩邊都很糟的夫妻；有小孩的比較想撐下去', r.div);
  ok(r.div.untouched && r.div.run.res && r.div.run.ex && r.div.run.log && r.div.dice, L + '離婚：每天的流程不再擲骰；本人決定就離婚；沒有決策核心時照舊擲骰', r.div);
  // 對嗆
  ok(r.feud.ctx && r.feud.ids[0] === 'calm' && r.feud.ids.length === 3 && !r.feud.mild, L + '對嗆：只問互相仇視的兩個人（可以選跟誰吵）', r.feud);
  ok(r.feud.sc.gAb > r.feud.sc.g0 && r.feud.sc.gSt < r.feud.sc.g0, L + '對嗆：脾氣衝的人比較會吵，沉穩的人比較會忍', r.feud.sc);
  ok(r.feud.untouched && r.feud.run.res && r.feud.run.worse && r.feud.run.log && r.feud.run.cool && r.feud.dice, L + '對嗆：每天的流程不再擲骰；本人決定就當街吵、五天內不再跟同一人吵；沒有決策核心時照舊擲骰', r.feud);
  // 出訪
  ok(r.vis.ids.join() === 'stay,go' && r.vis.sad === 0 && r.vis.closed === 0 && r.vis.sc.gAdv > r.vis.sc.g0, L + '出訪：心情好的人被問要不要去；心情差或對方封路不問；愛冒險的人比較想去', r.vis);
  ok(r.vis.flow.asked === 1 && r.vis.stay.again && r.vis.stay.sent === 0 && r.vis.go.res && r.vis.go.sent && r.vis.dice, L + '出訪：每天的流程改成問一個人；不去就再問另一個；去就出門；沒有決策核心時照舊擲骰', r.vis);
  // 流程
  ok(r.rule.kind === 'confess' && r.rule.id.startsWith('go:') && r.rule.ai === 0 && r.rule.answered === 'wooed' && r.rule.dating, L + '接到每天的決策流程：AI 沒開時照個性決定（多情又有魅力的人會告白，對方當下回答）', r.rule);
  ok(r.ai.id === 'stay' && r.ai.ai === 1 && r.ai.why === 'W-DIV' && r.ai.still && r.ai.plan === 'N-NEXT' && r.ai.menu, L + 'AI 版：由 AI 決定婚姻要不要撐下去並說理由', r.ai);
  ok(r.aiWoo.id === 'no' && r.aiWoo.ai === 1 && r.aiWoo.why === 'W-WOO' && r.aiWoo.asked === 1 && r.aiWoo.single, L + 'AI 版：被告白的當下就問 AI 答不答應', r.aiWoo);
  if (!zh) ok(!r.ai.cjk, L + '英文版給 AI 的資料沒有中文', r.ai.bits);
  ok(r.save.dating && r.save.cool, L + '存讀檔：感情狀態、被拒絕後不再開口的天數都還在', r.save);
  ok(!r.days.err && r.days.q === 0, L + '大家有愛有恨，照常跑八天沒有錯誤', r.days);
  ok(Object.values(r.facts).every(v => typeof v === 'number' && v > 15), L + '每個選擇點都講得出事實', r.facts);
  if (!zh) ok(r.txt.length === 0, L + '英文版：標題、事實、選項、理由、新的日誌都有翻譯', r.txt.slice(0, 8));
  ok(errs.length === 0, L + '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
