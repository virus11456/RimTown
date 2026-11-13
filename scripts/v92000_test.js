// v9.20.0 決策核心階段 2（人際）
// 借的錢還不還、要不要道歉、原不原諒、要不要報復、要不要在背後講壞話、冷戰誰先開口：改由本人決定，不再擲骰。
// 驗：七個選擇點都登記了、舊的擲骰不再跑、每個選項的結算、個性不同分數不同、AI 版（理由、連鎖到對方的回應、「其他」）、
//     「先不動」不洗版、銀幣守恆、中英文
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
    for (let d = 0; d < 3; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    w.fullAgentMode = false; app._fullAgentOn = () => w.fullAgentMode;
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const [A, B, C, E, F, G, H] = all; const TEST = [A, B, C, E, F, G, H];
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const D = DARK.S(w); const Y = WAYS.S(w); const K = DECIDE.KINDS;
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const aff = (a, b) => a.relationships.relationships[b.agentId]?.affinity || 0;
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const td = () => DARK.today(w); const d0 = () => w._absDay();
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => String(m.content || '')).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const kinds = (a) => (a.thoughts || []).map(x => x.kind);
    const clean = () => { D.wrongs = []; D.debts = []; D.spoke = {}; D.secrets = []; D.feuds = {}; D.rep = {}; Y.cold = {}; X.cool = {}; X.q = []; for (const a of all) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; }
      for (const a of TEST) { traits(a, ['hardworking']); a.thoughts = []; for (const b of TEST) if (a !== b) rel(a, b, 0); } if (w.infl) { w.infl.p = 1; w.infl.wage = 1; } };
    const sc = (a, key, id) => { const ctx = K[key].when(w, a); if (!ctx) return null; const op = K[key].options(w, a, ctx).find(o => o.id === id); return op ? DECIDE.score(DECIDE.lean(w, a), op) : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const steady = (a, key) => fix(0.5, () => DECIDE.ruleOnce(w, a, key, true));
    const drain = () => fix(0.5, () => DECIDE.drain(w, X, d0()));
    const wrong = (by, to, wt, age) => { DARK.wrong(w, by, to, wt, '在背後說{v}壞話', { v: to.name }); const x = D.wrongs[D.wrongs.length - 1]; x.day = td() - (age ?? 3); return x; };

    // ---------- 1) 登記、舊的擲骰不再跑 ----------
    out.kinds = { all: ['owe', 'sorry', 'forgive', 'grudge', 'vent', 'makeup', 'reached'].every(k => !!K[k]), soc: DECIDE.soc === true, on: DARK.byChoice(w), queued: K.forgive.scan === false && K.reached.scan === false, same: td() === d0() };
    clean(); { const x = wrong(A, B, 2, 3); traits(B, ['abrasive', 'jealous']); const n0 = (w.messageLog || []).length; fix(0.001, () => DARK.daily(w)); out.noDice = { tries: x.tries, revenged: !!x.revenged, log: /道歉|報復|報一箭/.test((w.messageLog || []).slice(n0).map(m => m.content).join('|')) }; }
    clean(); { rel(A, B, 50); rel(A, C, -80); fix(0.001, () => w.gossipNetwork.spreadGossip(A, B, w)); out.noGossipDice = { spoke: D.spoke[A.agentId], rep: D.rep[A.agentId]?.badmouth || 0 }; }

    // ---------- 2) 借的錢到期了 ----------
    const debt = (l, r, n, o) => { const d = Object.assign({ l: l.agentId, r: r.agentId, n, day: td() - 7, due: td(), cash: true }, o || {}); D.debts.push(d); return d; };
    clean(); { traits(A, ['kind', 'stoic']); Bal[A.agentId] = 50; const d = debt(B, A, 20); let e; const c = conserved(() => { e = steady(A, 'owe'); }); out.repay = { id: e?.id, done: d.done, a: Bal[A.agentId], b: Bal[B.agentId], cons: c }; }
    clean(); { traits(A, ['gossip', 'lazy', 'jealous', 'greedy']); rel(A, B, -20); Bal[A.agentId] = 50; const d = debt(B, A, 20); const e = steady(A, 'owe');
      out.dodge = { id: e?.id, done: d.done, a: Bal[A.agentId], wrong: D.wrongs.some(x => x.by === A.agentId && x.to === B.agentId), unpaid: kinds(B).includes('debt_unpaid'), secret: D.secrets.some(s => s.culprit === A.agentId && s.kind === 'cover'), honest: sc(B, 'owe', 'x') }; }
    clean(); { traits(A, ['kind']); traits(C, ['gossip', 'lazy', 'jealous', 'greedy']); Bal[A.agentId] = 50; Bal[C.agentId] = 50; debt(B, A, 20); debt(B, C, 20); out.oweScore = { kindRepay: sc(A, 'owe', 'repay'), kindDodge: sc(A, 'owe', 'dodge'), meanRepay: sc(C, 'owe', 'repay'), meanDodge: sc(C, 'owe', 'dodge') }; }
    clean(); { Bal[A.agentId] = 1; const d = debt(B, A, 20); const e = steady(A, 'owe'); const o1 = { id: e?.id, tries: d.tries, due: d.due - td(), done: !!d.done };
      d.due = td(); d.tries = 2; const only = K.owe.options(w, A, K.owe.when(w, A)).map(o => o.id); d.due = td() - 4; fix(0.99, () => DARK.daily(w)); out.broke = Object.assign(o1, { only, forced: d.done, wrong: D.wrongs.some(x => x.by === A.agentId && x.to === B.agentId) }); }
    clean(); { Bal[A.agentId] = 12; const d = debt(B, A, 20); const op = opt(A, 'owe', 'part'); let res; const c = conserved(() => { res = op?.run(w, A); }); out.part = { has: !!op, a: Bal[A.agentId], b: Bal[B.agentId], left: d.n, due: d.due - td(), done: !!d.done, cons: c }; }

    // ---------- 3) 道歉與原諒 ----------
    clean(); { wrong(A, B, 2); traits(A, ['kind']); const k = { say: sc(A, 'sorry', 'say'), skip: sc(A, 'sorry', 'skip'), deny: sc(A, 'sorry', 'deny') }; traits(A, ['abrasive', 'jealous']); const m = { say: sc(A, 'sorry', 'say'), deny: sc(A, 'sorry', 'deny') }; out.sorryScore = { k, m }; }
    clean(); { const x = wrong(A, B, 2); traits(A, ['kind']); traits(B, ['kind']); const e = steady(A, 'sorry'); const eb = lastLog(B);
      out.sorry = { id: e?.id, tries: x.tries, q: X.q.length, b: eb && { kind: eb.kind, id: eb.id }, forgiven: !!x.forgiven, th: kinds(A).includes('forgiven') && kinds(B).includes('forgave'), log: /原諒了他|forgave/.test(logs()), title: DECIDE.view(w, A).rows[0]?.kind, again: K.sorry.when(w, A) }; }
    clean(); { const x = wrong(A, B, 2); Bal[A.agentId] = 100; const op = opt(A, 'sorry', 'gift'); let c; fix(0.5, () => { c = conserved(() => op?.run(w, A)); }); const q = X.q[0]; out.gift = { has: !!op, a: Bal[A.agentId], b: Bal[B.agentId], cons: c, ctx: q && { kind: q.kind, gift: q.ctx.gift }, plain: sc(B, 'forgive', 'x') };
      const ctx0 = { id: x.id, by: A.agentId, gift: 0 }, ctx1 = { id: x.id, by: A.agentId, gift: 12 }; const L = DECIDE.lean(w, B); const s = (c2, id) => DECIDE.score(L, K.forgive.options(w, B, c2).find(o => o.id === id)); out.gift.up = s(ctx1, 'yes') > s(ctx0, 'yes'); }
    clean(); { const x = wrong(A, B, 3); const ctx = { id: x.id, by: A.agentId, gift: 0 }; const s = (id) => DECIDE.score(DECIDE.lean(w, B), K.forgive.options(w, B, ctx).find(o => o.id === id));
      traits(B, ['kind']); const k = { yes: s('yes'), no: s('no'), never: s('never') }; traits(B, ['jealous', 'abrasive']); const m = { yes: s('yes'), no: s('no'), never: s('never') };
      x.tries = 1; fix(0.5, () => K.forgive.options(w, B, ctx).find(o => o.id === 'never').run(w)); out.forgiveScore = { k, m, never: x.never && x.done, log: /不必再來往|come near me/.test(logs(5)), gone: K.forgive.options(w, B, ctx).length }; }
    clean(); { const x = wrong(A, B, 2); fix(0.5, () => opt(A, 'sorry', 'deny').run(w, A)); out.deny = { denied: x.denied, done: x.done, again: K.sorry.when(w, A) }; }

    // ---------- 4) 心裡有口氣（放下／當面說／報復） ----------
    clean(); { wrong(C, E, 2); traits(E, ['kind']); const k = { letgo: sc(E, 'grudge', 'letgo'), warn: sc(E, 'grudge', 'warn'), sab: sc(E, 'grudge', 'sabotage'), wait: sc(E, 'grudge', 'wait') }; traits(E, ['abrasive', 'jealous', 'gossip']); const m = { letgo: sc(E, 'grudge', 'letgo'), warn: sc(E, 'grudge', 'warn'), sab: sc(E, 'grudge', 'sabotage') }; out.grudgeScore = { k, m }; }
    clean(); { const x = wrong(C, E, 2); fix(0.5, () => opt(E, 'grudge', 'warn').run(w, E)); out.warn = { rev: x.revenged, th: kinds(E).includes('avenged'), counter: D.wrongs.some(y => y.by === E.agentId && y.to === C.agentId), feud: Object.values(D.feuds)[0]?.n, again: K.grudge.when(w, E), log: /小心|careful|warn/i.test(logs(5)) }; }
    clean(); { const x = wrong(C, E, 2); fix(0.5, () => opt(E, 'grudge', 'sabotage').run(w, E)); out.sab = { rev: x.revenged, secret: D.secrets.some(s => s.kind === 'sabotage' && s.culprit === E.agentId), ruined: kinds(C).includes('work_ruined') }; }
    clean(); { const x = wrong(C, E, 2); fix(0.5, () => opt(E, 'grudge', 'letgo').run(w, E)); out.letgo = { let: x.let, again: K.grudge.when(w, E), stillSorry: !!K.sorry.when(w, C) }; }
    clean(); { const x = wrong(C, E, 2); traits(C, ['kind']); let r1; fix(0.5, () => { r1 = opt(E, 'grudge', 'face').run(w, E); }); const o1 = { tries: x.tries, q: X.q[0]?.kind, faced: x.faced };
      clean(); const x2 = wrong(C, E, 2); traits(C, ['abrasive']); fix(0.5, () => opt(E, 'grudge', 'face').run(w, E)); out.face = { sorry: o1, fight: /吵了起來|row/.test(logs(5)), gone: !opt(E, 'grudge', 'face'), aff: aff(E, C) }; }

    // ---------- 5) 看某人不順眼（講不講壞話） ----------
    clean(); { rel(F, G, -80); rel(F, H, 95); const ctx = K.vent.when(w, F); traits(F, ['kind']); const k = { hold: sc(F, 'vent', 'hold'), tr: sc(F, 'vent', 'true'), lie: sc(F, 'vent', 'lie') }; traits(F, ['gossip', 'jealous', 'abrasive']); const m = { hold: sc(F, 'vent', 'hold'), tr: sc(F, 'vent', 'true'), lie: sc(F, 'vent', 'lie') };
      out.ventScore = { ctx: ctx && { foe: ctx.foe === G.agentId, l: ctx.l === H.agentId }, k, m }; }
    clean(); { rel(F, G, -80); rel(F, H, 95); const g0 = (w.gossipNetwork?.activeGossip || []).length; fix(0.5, () => opt(F, 'vent', 'true').run(w, F));
      out.vent = { rep: D.rep[F.agentId]?.badmouth, gossip: (w.gossipNetwork?.activeGossip || []).length - g0, spoke: D.spoke[F.agentId] === td(), again: K.vent.when(w, F), secret: D.secrets.length, log: /壞話|badmouth/i.test(logs(5)) };
      D.spoke = {}; fix(0.5, () => opt(F, 'vent', 'lie').run(w, F)); out.vent.lie = D.secrets.some(s => s.kind === 'slander' && s.culprit === F.agentId) && (D.rep[F.agentId]?.lies || 0) >= 1; }
    clean(); { rel(F, G, -80); rel(F, H, 95); traits(G, ['kind']); rel(G, F, 0); const a0 = aff(F, G); fix(0.5, () => opt(F, 'vent', 'direct').run(w, F)); const good = { up: aff(F, G) > a0, log: /把話說開，兩人談了很久|talked for a long time/.test(logs(5)) };
      clean(); rel(F, G, -80); rel(F, H, 95); traits(G, ['abrasive']); rel(G, F, -80); fix(0.5, () => opt(F, 'vent', 'direct').run(w, F)); out.direct = { good, bad: /又吵了起來|arguing again/.test(logs(5)) }; }
    // 「先不動」照個性推估時不寫進最近的決定（不然天天都是「放在心裡，不說」）
    clean(); { rel(F, G, -80); rel(F, H, 95); traits(F, ['kind']); const p0 = X.pick['vent.hold'] || 0; const e = steady(F, 'vent'); out.mute = { id: e?.id, logged: (X.log[F.agentId] || []).length, counted: (X.pick['vent.hold'] || 0) - p0 }; }

    // ---------- 6) 冷戰：誰先開口 ----------
    const cold = (a, b, o) => { const k = [a.agentId, b.agentId].sort().join('|'); Y.cold[k] = Object.assign({ d: d0() - 3, until: d0() + 10 }, o || {}); return Y.cold[k]; };
    clean(); { cold(A, B); rel(A, B, 20); rel(B, A, 20); traits(A, ['kind']); traits(B, ['kind']); const ctx = K.makeup.when(w, A); const s0 = { reach: sc(A, 'makeup', 'reach'), cut: sc(A, 'makeup', 'cut') }; const t0 = Y.st.thaw || 0;
      fix(0.5, () => opt(A, 'makeup', 'reach').run(w, A)); const q = X.q[0]?.kind; drain(); out.thaw = { ctx: ctx?.b === B.agentId, s0, q, off: !WAYS.coldWith(w, A, B), n: (Y.st.thaw || 0) - t0, b: lastLog(B)?.id, aff: aff(A, B), log: /先開口，.*點了點頭|spoke first/.test(logs(5)) }; }
    clean(); { const c = cold(A, B); rel(A, B, 20); rel(B, A, -80); traits(B, ['abrasive']); const f0 = WAYS.faceOf(w, A); fix(0.5, () => opt(A, 'makeup', 'reach').run(w, A)); drain();
      out.snub = { on: WAYS.coldWith(w, A, B), snub: c.snub, face: WAYS.faceOf(w, A) < f0, b: lastLog(B)?.id, aAgain: K.makeup.when(w, A), bCan: !!K.makeup.when(w, B) }; }
    clean(); { cold(A, B); const a0 = Y.st.apart || 0; fix(0.5, () => opt(A, 'makeup', 'cut').run(w, A)); out.cut = { off: !WAYS.coldWith(w, A, B), n: (Y.st.apart || 0) - a0 }; }
    // 沒人開口拖到最後：看兩人還剩多少情分，不擲骰（骰子給 0.99 以前一定「不再往來」、給 0.01 以前一定和好）
    clean(); { cold(A, B, { until: d0() }); rel(A, B, 0); rel(B, A, 0); const t0 = Y.st.thaw || 0; fix(0.99, () => WAYS.coldDaily(w)); const soft = (Y.st.thaw || 0) - t0;
      Y.cold = {}; cold(A, B, { until: d0() }); rel(A, B, -80); rel(B, A, -80); const a0 = Y.st.apart || 0; fix(0.01, () => WAYS.coldDaily(w)); out.coldEnd = { soft, hard: (Y.st.apart || 0) - a0 }; }

    // ---------- 7) AI 版：理由、連鎖到對方的回應、「其他」 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    // 只讓指定的人今天遇到事(其他人全部冷卻)，AI 的名額才不會被別人用掉
    const LATER = ['cashout', 'renovate', 'tithe', 'scheme', 'startup', 'sell', 'poach', 'leave', 'jobhop', 'apprentice', 'rivalshop', 'split', 'buyout', 'cook', 'syndicate', 'staffshare', 'bankrun', 'bond', 'habit', 'bespoke', 'gamble', 'gamedebt', 'opencasino', 'title', 'bribe', 'pilfer', 'comfort', 'dirty', 'trade', 'skim', 'embezzle', 'sneak']; // v9.22.0 之後才有的選擇點(開店、翻修…；v9.23.0 的搬離、跳槽、拜師、對手店、拆夥)：這裡驗的是人際，不讓它們搶先。漏列的話，指定的人當天偶爾會先遇到那件事(例如剛好有師傅可拜)，AI 被問的就不是這一題
    const only = (...keep) => { const ids = new Set(keep.map(a => a.agentId)); for (const a of all) { if (!ids.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; else for (const k of LATER) X.cool[a.agentId + '|' + k] = d0() + 9; } };
    clean(); w.fullAgentMode = true; { const x = wrong(A, B, 2); only(A, B); /* B 自己也有一件事在等 AI(心裡有口氣)：A 來道歉時，那件先擱下、改問這一件 */
      reply = (p) => /來跟你道歉|come to apologize to you/.test(p) ? [{ n: 1, pick: 'a', why: 'W-FORGIVE' }] : /還沒跟|not apologized/.test(p) ? [{ n: 1, pick: 'b', why: 'W-SORRY', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const ea = lastLog(A), eb = lastLog(B); const pS = prompts.find(p => /還沒跟|not apologized/.test(p)) || ''; const pF = prompts.find(p => /來跟你道歉|come to apologize to you/.test(p)) || '';
      out.ai = { a: ea && { id: ea.id, ai: ea.ai, why: ea.why?.raw }, b: eb && { kind: eb.kind, id: eb.id, ai: eb.ai, why: eb.why?.raw }, forgiven: !!x.forgiven, plan: DECIDE.view(w, A).plan, ledger: /【人際】|\[People\]|\[Relationships\]/.test(pS), fact: /壞話|badmouth/.test(pS), menu: /other＝/.test(pS), chained: !!pF, feed: /🧭/.test(logs()), cjk: /[一-鿿]/.test(pS + pF) }; }
    clean(); w.fullAgentMode = true; { wrong(C, E, 2); rel(E, C, -30); only(E); const a0 = aff(E, C); const f0 = X.st.free; prompts = [];
      reply = (p) => /沒有道歉|still have not apologized/.test(p) ? [{ n: 1, pick: 'z', why: 'W-FREE', do: 'DO-FREE', fx: [{ t: 'rel', to: C.name, d: 8 }] }] : null;
      today(); await DECIDE.flush(); const e = lastLog(E); out.free = { free: e?.free, up: aff(E, C) - a0, st: X.st.free - f0, log: /💭/.test(logs()) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 8) 跑幾天：不出錯、錢守恆 ----------
    clean(); { const t0 = T(), p0 = P0(); let err = null; try { for (let d = 0; d < 6; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e); } out.run = { err, pick: Object.keys(X.pick).filter(k => /^(owe|sorry|forgive|grudge|vent|makeup|reached)\./.test(k)).length }; }
    return out;
  });
  const gt = (a, b) => typeof a === 'number' && typeof b === 'number' && a > b;
  ok(r.kinds.all && r.kinds.soc && r.kinds.on && r.kinds.queued && r.kinds.same, '七個人際選擇點都登記了；「有人來道歉」「他先開口了」只在別人找上門時出現', r.kinds);
  ok(r.noDice.tries === 0 && !r.noDice.revenged && !r.noDice.log, '舊的擲骰不再跑：骰子給到一定會道歉、會報復的值，每日結算也不會替人決定', r.noDice);
  ok(r.noGossipDice.spoke === undefined && r.noGossipDice.rep === 0, '聊天時不再擲骰決定講不講壞話', r.noGossipDice);
  ok(r.repay.id === 'repay' && r.repay.done && r.repay.a === 30 && r.repay.b === 50 && r.repay.cons, '還錢：老實又有錢的人把錢還了（借的人 −20、出借的人 +20，銀幣守恆）', r.repay);
  ok(r.dodge.id === 'dodge' && r.dodge.done && r.dodge.a === 50 && r.dodge.wrong && r.dodge.unpaid && r.dodge.secret, '賴帳：不老實、跟對方又不熟的人有錢也拖著；對方記恨、多一個「其實有錢」的秘密', r.dodge);
  ok(gt(r.oweScore.kindRepay, r.oweScore.kindDodge) && gt(r.oweScore.meanDodge, r.oweScore.kindDodge) && gt(r.oweScore.kindRepay, r.oweScore.meanRepay), '同一筆債，個性不同分數不同（善良的人偏向還，貪心愛計較的人賴帳的念頭強得多）', r.oweScore);
  ok(r.broke.id === 'extend' && r.broke.tries === 1 && r.broke.due === 5 && !r.broke.done && r.broke.only.join() === 'dodge' && r.broke.forced && r.broke.wrong, '沒錢：先拜託寬限五天；寬限兩次還是沒錢，過期四天後算賴帳', r.broke);
  ok(r.part.has && r.part.a === 5 && r.part.b === 37 && r.part.left === 13 && r.part.due === 5 && !r.part.done && r.part.cons, '錢不夠可以先還一部分（還 7、還欠 13、再等五天）', r.part);
  ok(gt(r.sorryScore.k.say, r.sorryScore.k.skip) && gt(r.sorryScore.k.say, r.sorryScore.k.deny) && gt(r.sorryScore.m.deny, r.sorryScore.m.say), '道歉：善良的人傾向去道歉；難相處又愛計較的人傾向不認錯', r.sorryScore);
  ok(r.sorry.id === 'say' && r.sorry.tries === 1 && r.sorry.q === 0 && r.sorry.b?.kind === 'forgive' && r.sorry.b?.id === 'yes' && r.sorry.forgiven && r.sorry.th && r.sorry.log && !r.sorry.again, '道歉 → 對方自己決定 → 原諒（兩邊的心情、日誌都有）', r.sorry);
  ok(r.sorry.title === (zh ? '對不起某人' : 'Owing someone an apology'), '村民卡「最近的決定」看得到是遇到什麼事', r.sorry.title);
  ok(r.gift.has && r.gift.a === 88 && r.gift.b === 42 && r.gift.cons && r.gift.ctx?.kind === 'forgive' && r.gift.ctx?.gift === 12 && r.gift.up, '帶賠禮道歉：錢真的給對方（銀幣守恆），對方比較願意原諒', r.gift);
  ok(gt(r.forgiveScore.k.yes, r.forgiveScore.k.no) && gt(r.forgiveScore.m.no, r.forgiveScore.m.yes) && gt(r.forgiveScore.m.never, r.forgiveScore.k.never) && r.forgiveScore.never && r.forgiveScore.log && r.forgiveScore.gone === 0, '原不原諒看個性與事情大小；可以說「以後不必再來往」', r.forgiveScore);
  ok(r.deny.denied && r.deny.done && !r.deny.again, '不認錯：這件事他不會再去道歉', r.deny);
  ok(gt(r.grudgeScore.k.letgo, r.grudgeScore.k.warn) && gt(r.grudgeScore.k.wait, r.grudgeScore.k.sab) && gt(r.grudgeScore.m.warn, r.grudgeScore.m.letgo) && gt(r.grudgeScore.m.sab, r.grudgeScore.k.sab), '報復：善良的人傾向放下；記恨的人傾向報復', r.grudgeScore);
  ok(r.warn.rev && r.warn.th && r.warn.counter && r.warn.feud === 1 && !r.warn.again && r.warn.log, '到處提醒大家小心他：報了仇、對方多一筆帳（恩怨可以連載下去）', r.warn);
  ok(r.sab.rev && r.sab.secret && r.sab.ruined, '偷偷動他的東西：變成一個秘密（之後可能被拆穿）', r.sab);
  ok(r.letgo.let && !r.letgo.again && r.letgo.stillSorry, '放下：不再想著報復，但對方之後還是可以來道歉', r.letgo);
  ok(r.face.sorry.tries === 1 && r.face.sorry.q === 'forgive' && r.face.sorry.faced && r.face.fight && r.face.gone && r.face.aff < 0, '當面說清楚：對方心軟就當場道歉；對方難相處就吵起來（同一件事不會再去問第二次）', r.face);
  ok(r.ventScore.ctx?.foe && r.ventScore.ctx?.l && gt(r.ventScore.k.hold, r.ventScore.k.tr) && gt(r.ventScore.k.tr, r.ventScore.k.lie) && gt(r.ventScore.m.tr, r.ventScore.k.tr) && gt(r.ventScore.m.lie, r.ventScore.k.lie), '講不講壞話：找最要好的朋友說；善良的人傾向放在心裡，愛八卦又記恨的人傾向說、甚至加油添醋', r.ventScore);
  ok(r.vent.rep === 1 && r.vent.gossip === 1 && r.vent.spoke && !r.vent.again && r.vent.secret === 0 && r.vent.log && r.vent.lie, '說了：變成流言、算進名聲、一天只說一次；編造的會變成秘密', r.vent);
  ok(r.direct.good.up && r.direct.good.log && r.direct.bad, '直接去找他把話說開：談得成交情變好，談不攏又吵一架', r.direct);
  ok(r.mute.id === 'hold' && r.mute.logged === 0 && r.mute.counted === 1, '「放在心裡，不說」照個性推估時不寫進最近的決定（不洗版），但有算進統計', r.mute);
  ok(r.thaw.ctx && gt(r.thaw.s0.reach, r.thaw.s0.cut) && r.thaw.q === 'reached' && r.thaw.off && r.thaw.n === 1 && r.thaw.b === 'accept' && r.thaw.aff > 20 && r.thaw.log, '冷戰：一方先開口 → 對方自己決定 → 點頭和好', r.thaw);
  ok(r.snub.on && r.snub.snub === 1 && r.snub.face && r.snub.b === 'snub' && !r.snub.aAgain && r.snub.bCan, '先開口被當作沒看到：冷戰拖更久、丟了面子；之後換對方才能先開口', r.snub);
  ok(r.cut.off && r.cut.n === 1, '也可以乾脆不再往來', r.cut);
  ok(r.coldEnd.soft === 1 && r.coldEnd.hard === 1, '沒人開口拖到最後：看兩人還剩多少情分，不擲骰', r.coldEnd);
  ok(r.ai.a?.id === 'say' && r.ai.a?.ai === 1 && r.ai.a?.why === 'W-SORRY' && r.ai.b?.kind === 'forgive' && r.ai.b?.id === 'yes' && r.ai.b?.ai === 1 && r.ai.b?.why === 'W-FORGIVE' && r.ai.forgiven && r.ai.plan === 'N-NEXT' && r.ai.chained && r.ai.feed, 'AI 版：道歉的人由 AI 決定並說理由，接著被道歉的人也由 AI 決定', r.ai);
  ok(r.ai.ledger && r.ai.fact && r.ai.menu, 'AI 看得到帳本的【人際】、這件事的來龍去脈、選項和「其他」', { l: r.ai.ledger, f: r.ai.fact, m: r.ai.menu });
  if (!zh) ok(!r.ai.cjk, '英文版給 AI 的資料沒有中文', r.ai.cjk);
  ok(r.free.free === 1 && r.free.up === 8 && r.free.st === 1 && r.free.log, 'AI 可以選「其他」：自己想的做法用白名單效果落地（這裡是對那個人好一點）', r.free);
  ok(!r.run.err && r.run.pick >= 1, '接著跑六天：不出錯，人際的決定有在發生', r.run);
  ok(errs.length === 0, '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh'); await run(browser, 'en');
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
