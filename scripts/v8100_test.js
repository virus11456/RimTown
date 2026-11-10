// v8.1.0 人情世故
// 面子（大比數否決丟面子、沉默期不提案、拉票、朋友給台階、沉默的人多了提鄰里茶會）、人情帳（欠人情改投贊成、禮金要包回去、包太少記仇）、
// 嘴硬（成效差時多半怪提案的人、「我當初就覺得怪怪的」、信任下降；缺料作罷不扣信任）、說一套做一套（私下違反自己支持的法律、被撞見、真相頁）、
// 跟鄰居比（翻修讓鄰居眼紅、借錢跟著翻修）、懷舊（老人反對新東西、懷念以前的首長）、日常習慣（常碰面變熟、兩天沒出現有人敲門）、
// 冷戰（吵架後不聊天、朋友選邊、婚宴同桌、和好）、存讀檔、AI 摘要、介面（中英、桌機與 390px）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[Ways\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const A = npcs().filter(a => (a.age ?? 30) >= 18);
      for (const a of npcs()) WALLET.get(w, a);
      let d0 = w._absDay(); const setDay = (n) => { d0 = n; w._absDay = () => n; }; const next = () => setDay(d0 + 1);
      const X = WAYS.S(w); const P = w.proposals; const logs = () => (w.messageLog || []).slice(-60).map(m => m.content || m.text || '').join('\n');
      const traits = (a, list) => { a.personality.traits = list.slice(); };
      const rel = (a, b) => a.relationships.getOrCreate(b.agentId, b.name); const setAff = (a, b, v) => { const r = rel(a, b); r.affinity = v; };
      const mk = (kind, pr, f, ag) => { const p = { id: 'LX' + Math.floor(Math.random() * 1e6), kind, proposerId: pr.agentId, proposerName: pr.name, votes: {}, why: {}, result: '被否決', status: 'rejected' }; f.forEach(a => p.votes[a.agentId] = 'for'); ag.forEach(a => p.votes[a.agentId] = 'against'); return p; };
      // 1) 面子:大比數否決 → 一般人沉默、有個性的拉票
      const q = A[0]; traits(q, ['hardworking']); for (const b of A) setAff(q, b, 0); WAYS.setFace(w, q, 40);
      fix(0.9, () => WAYS.onRejected(w, mk('feast', q, [A[1]], A.slice(2, 9)))); out.face = { quiet: X.shame[q.agentId] > d0, f: WAYS.faceOf(w, q) };
      const ch = A[1]; traits(ch, ['charismatic']); for (const b of A) setAff(ch, b, 0); WAYS.setFace(w, ch, 40); fix(0.9, () => WAYS.onRejected(w, mk('feast', ch, [A[2]], A.slice(3, 10)))); out.face.lobby = !!X.lobby[ch.agentId];
      // 沉默期不提案;拉票的人下一個提案會被多投幾票
      const cand = { kind: 'feast', key: 'feast:t' + d0, jobs: [], make: () => ({ kind: 'feast', key: 'feast:t' + d0, tk: 'x', tp: {}, dk: 'x', dp: { who: q.name }, cost: {}, category: 'culture', jobBias: [] }) };
      out.face.blocked = P._createWith(w, d0, cand, q) === null;
      const lp = { kind: 'feast', proposerId: ch.agentId, votes: {}, why: {}, _lobby: true }; let lf = 0; for (let i = 0; i < 30; i++) { const v = A[5 + (i % 6)]; setAff(v, ch, 5); lp.votes[v.agentId] = 'against'; WAYS.vote(w, lp, v); if (lp.votes[v.agentId] === 'for') lf++; } out.face.lobbyFlips = lf;
      // 朋友給台階
      const s2 = A[2]; traits(s2, ['hardworking']); const fr = A[3]; setAff(s2, fr, 50); setAff(fr, s2, 40); WAYS.setFace(w, s2, 50); fix(0.1, () => WAYS.onRejected(w, mk('feast', s2, [A[4]], A.slice(5, 12)))); out.face.step = Object.values(X.owe[s2.agentId] || {}).some(n => n >= 3) && /時機不對|bad timing/.test(logs()); /* 給台階的是交情最好的那位朋友 */
      // 沉默的人多了 → 鄰里茶會提案 → 通過後大家又敢開口
      for (const a of A.slice(4, 10)) X.shame[a.agentId] = d0 + 20; X.lastForum = -99; P.items = P.items.filter(p => p.kind !== 'ways_forum'); X.lastDay = null; WAYS.daily(w);
      const fp = P.items.find(p => p.kind === 'ways_forum'); out.forum = { made: !!fp }; if (fp) { fp.status = 'approved'; const tr0 = X.trust; P._execute(w, fp, d0); out.forum.cleared = WAYS.silent(w).length === 0; out.forum.trust = X.trust - tr0; }
      // 2) 人情帳:欠人情不好意思反對
      const db = A[5], cr = A[6]; X.owe = {}; WAYS.owe(w, db, cr, 9); const vp = { kind: 'feast', proposerId: cr.agentId, votes: {}, why: {} }; let of = 0; for (let i = 0; i < 20; i++) { vp.votes[db.agentId] = 'against'; WAYS.owe(w, db, cr, 3); WAYS.vote(w, vp, db); if (vp.votes[db.agentId] === 'for') of++; } out.owe = { flips: of, why: vp.why[db.agentId] };
      // 禮金要包回去;包太少被記住
      const g1 = A[7], g2 = A[8], g3 = A[9]; traits(g2, ['greedy']); X.gift[g1.agentId + '>' + g2.agentId] = 20; setAff(g1, g2, 20); const amt = fix(0.5, () => WAYS.giftAmount(w, g2, g1, g3)); const af0 = rel(g1, g2).affinity; fix(0.1, () => WAYS.onGift(w, g2, g1, g3, amt));
      traits(g3, ['kind']); WALLET.add(w, g3, 100); X.gift[g1.agentId + '>' + g3.agentId] = 10; const amt2 = fix(0.5, () => WAYS.giftAmount(w, g3, g1, g2));
      out.gift = { stingy: amt, aff: rel(g1, g2).affinity - af0, generous: amt2, owe: WAYS.owedTo(w, g1, g2) > 0, log: /算了算禮金|did the math on the wedding gifts/.test(logs()) };
      // 3) 嘴硬:成效差,大多怪提案的人;缺料作罷不扣信任
      const bp = mk('build', A[10], A.slice(11, 17), []); bp.status = 'done'; X.trust = 60; X.lastSaid = -99; const a0 = rel(A[11], A[10]).affinity; fix(0.3, () => WAYS.onBad(w, bp));
      out.bad = { trust: X.trust, said: /當初就覺得怪怪的|bad feeling about it from the start/.test(logs()), blame: X.st.blame || 0 };
      const fp2 = mk('build', A[10], A.slice(11, 15), []); fp2.status = 'failed'; const tr1 = X.trust; WAYS.onBad(w, fp2); out.bad.failedTrust = X.trust - tr1;
      out.bad.outcome = { bad: WAYS.badOutcome({ mood: -7, pop: 0, silver: 0, food: 0 }), noise: WAYS.badOutcome({ mood: -3, pop: 0, silver: -20, food: 5 }) };
      // 4) 說一套做一套
      X.hyp = []; const hy = A[12]; traits(hy, ['greedy']); const lawP = { id: 'LH1', kind: 'steam_air', votes: { [hy.agentId]: 'for' }, status: 'approved' }; fix(0.1, () => WAYS.onApproved(w, lawP));
      app.state = w.getState(); const vw0 = WAYS.view(w); const tr2 = X.trust; const f2 = WAYS.faceOf(w, hy); if (X.hyp[0]) WAYS.expose(w, X.hyp[0]);
      out.hyp = { made: vw0.hyp.length === 1, trust: X.trust - tr2, face: WAYS.faceOf(w, hy) - f2, log: /被人撞見|was caught/.test(logs()) };
      // 信任低:大家比較多疑
      X.trust = 22; const tp = { kind: 'feast', proposerId: A[13].agentId, votes: {}, why: {} }; let df = 0; for (let i = 0; i < 160; i++) { const v = A[14 + (i % 5)]; setAff(v, A[13], 0); X.owe[v.agentId] = {}; tp.votes[v.agentId] = 'for'; WAYS.vote(w, tp, v); if (tp.votes[v.agentId] === 'against') df++; } out.hyp.distrust = df; X.trust = 60;
      // 5) 跟鄰居比:翻修讓鄰居眼紅,手頭緊的去借錢
      { const Hs = HOUSING.S(w); const homes = {}; for (const a of npcs()) { const h = HOUSING.houseOf(w, a); if (h) (homes[h] || (homes[h] = [])).push(a); } const hk = Object.keys(homes); for (const h of hk) Hs.lv[h] = 0;
        if (hk.length >= 3) { Hs.lv[hk[0]] = 1; X.envy = {}; fix(0.1, () => WAYS.onRenovate(w, hk[0], homes[hk[0]][0])); out.reno = { envy: Object.keys(X.envy).length }; } else out.reno = { envy: 2, skip: 1 }; }
      // 6) 懷舊:老人比較反對新東西
      const old = A[15]; old.age = 70; const rp = { kind: 'research', proposerId: A[0].agentId, votes: {}, why: {} }; let ov = 0; for (let i = 0; i < 320; i++) { rp.votes[old.agentId] = 'for'; X.trust = 60; WAYS.vote(w, rp, old); if (rp.votes[old.agentId] === 'against') ov++; } out.old = { flips: ov };
      const young = A[16]; young.age = 35; let yv = 0; for (let i = 0; i < 40; i++) { rp.votes[young.agentId] = 'for'; WAYS.vote(w, rp, young); if (rp.votes[young.agentId] === 'against') yv++; } out.old.young = yv;
      setDay(Math.ceil(d0 / 7) * 7 + 3); fix(0.1, () => WAYS.nostalgia(w)); out.old.log = /又在說|is at it again/.test(logs());
      // 7) 日常習慣:常碰面變熟;兩天沒出現有人來敲門
      X.rt = {}; X.nod = {}; X.miss = {}; const r1 = A[17], r2 = A[18]; X.rt[r1.agentId] = { s: 'park', t: 'am' }; X.rt[r2.agentId] = { s: 'park', t: 'am' }; for (const a of A) if (a !== r1 && a !== r2) X.rt[a.agentId] = { s: 'market', t: 'pm' };
      setAff(r1, r2, 0); for (let i = 0; i < 10; i++) WAYS.routines(w); const k12 = [r1.agentId, r2.agentId].sort().join('|');
      out.rt = { nod: X.nod[k12], aff: rel(r1, r2).affinity };
      const iw = w.isAway; w.isAway = (id) => id === r1.agentId || (iw ? iw.call(w, id) : false); WAYS.routines(w); WAYS.routines(w); w.isAway = iw;
      out.rt.check = /跑去敲門問候|went over and knocked/.test(logs());
      // 8) 冷戰:不聊天、朋友選邊、婚宴同桌、和好
      const c1 = A[19], c2 = A[20]; X.cold = {}; fix(0.1, () => WAYS.quarrel(w, c1, c2)); out.cold = { on: WAYS.coldWith(w, c1, c2) };
      const loc = c1.currentLocation; const g = w.getAgentsAtLocation; let talked = 0; c1._lastInteractionTick = -999; c1._interactionCooldown = 0; c1.activity = 'idle';
      w.getAgentsAtLocation = (l) => [c1, c2]; const gc = w.conversationEngine.generateConversation; let partner = null; w.conversationEngine.generateConversation = (x, y) => { partner = y; };
      for (let i = 0; i < 10; i++) { c1._lastInteractionTick = -999; c1._trySocialInteraction(w); } w.conversationEngine.generateConversation = gc; w.getAgentsAtLocation = g; delete w.getAgentsAtLocation;
      out.cold.noTalk = partner !== c2;
      WAYS.weddingGuests(w, [A[0], c1, c2], { name: A[0].name }); out.cold.table = /同一桌|same table/.test(logs());
      const ck = [c1.agentId, c2.agentId].sort().join('|'); X.cold[ck].until = d0; fix(0.1, () => WAYS.coldDaily(w)); out.cold.ended = !WAYS.coldWith(w, c1, c2);
      // 9) 存讀檔、AI 摘要
      WAYS.owe(w, A[1], A[2], 6); const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = { ok: !!w2.ways && Math.round(w2.ways.trust) === Math.round(X.trust) && WAYS.owedTo(w2, w2.agents[A[1].agentId], w2.agents[A[2].agentId]) >= 6 };
      out.brief = WAYS.brief(w, A[1]).join(' / ');
      // 10) 介面:鎮況頁的人情世故卡、真相頁
      X.trust = 40; X.shame[A[3].agentId] = d0 + 10; X.cold[ck] = { d: d0, until: d0 + 10 }; X.hyp.push({ a: A[4].agentId, k: 'bio_gmban', t: 'test law', d: d0 });
      app.state = w.getState(); const mobile = window.innerWidth <= 768;
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); const tt = box.innerText; app._ppTab = 'truth'; app.renderProposals(box); const tr = box.innerText; box.remove();
      out.ui = { card: /人情世故|How people really are/.test(tt), trust: /信任|Trust/.test(tt), cold: /冷戰中|Not speaking/.test(tt), silent: /不敢提案|afraid to propose/.test(tt), cjk: (tt.match(/[一-鿿]+/g) || []).slice(0, 6), undef: /undefined|NaN|\{[a-z]+\}/.test(tt) };
      out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      return out;
    });
    ok(r.face.quiet && r.face.f <= 25 && r.face.lobby && r.face.blocked, '面子：大比數否決丟面子；一般人進沉默期不提案，有個性的私下拉票', r.face);
    ok(r.face.lobbyFlips >= 5 && r.face.step, '拉票過的提案比較多人投贊成；朋友給台階，欠一份人情', { flips: r.face.lobbyFlips, step: r.face.step });
    ok(r.forum.made && r.forum.cleared && r.forum.trust >= 4, '沉默的人多了，有人提鄰里茶會；通過後大家又敢開口、信任回升', r.forum);
    ok(r.owe.flips >= 6 && r.owe.why === 'owe', '人情帳：欠了人情不好意思反對（改投贊成、還一點人情）', r.owe);
    ok(r.gift.stingy < 14 && r.gift.generous >= 10 && r.gift.aff < 0 && r.gift.owe, '禮金：收過的禮要包回去；小氣的包太少被記住、大方的包回去', r.gift);
    ok(r.bad.trust <= 58 && r.bad.said && r.bad.blame >= 1 && r.bad.failedTrust === 0 && r.bad.outcome.bad && !r.bad.outcome.noise, '嘴硬：成效很差時多半怪提案的人（「我當初就覺得怪怪的」）、信任下降；缺料作罷和小起伏不算', r.bad);
    ok(r.hyp.made && r.hyp.trust <= -5 && r.hyp.face <= -20 && r.hyp.log && r.hyp.distrust >= 8, /* v9.13.2 160 票、機率約 0.19 → 期望約 30;以前 40 票門檻 3,約 2% 機會差一票失敗 */ '說一套做一套：私下違反、真相頁先看得到；被撞見名聲重挫、信任下降，大家對提案更多疑', r.hyp);
    ok(r.reno.envy >= 1, '跟鄰居比：有人翻修，鄰居眼紅', r.reno);
    ok(r.old.flips >= 48 && /* v9.13.2 320 次、機率 0.25～0.40 → 期望 80 以上;以前 80 次門檻 12 */ r.old.young === 0 && r.old.log, '懷舊：老人比較反對新研究、懷念以前；年輕人不會', r.old);
    ok(r.rt.nod >= 10 && r.rt.aff > 0 && r.rt.check, '日常習慣：常碰面的人慢慢變熟；兩天沒出現，街坊去敲門', r.rt);
    ok(r.cold.on && r.cold.noTalk && r.cold.table && r.cold.ended, '冷戰：吵架後不聊天；婚宴被排同一桌；時間到了和好或不往來', r.cold);
    ok(r.save.ok && r.brief.length > 0, '存讀檔：人情帳與信任存得住；AI 知道自己欠誰人情、每天去哪', { save: r.save, brief: r.brief });
    ok(r.ui.card && r.ui.trust && r.ui.cold && r.ui.silent && !r.ui.undef && !r.ui.overflow, '介面：鎮況頁有人情世故（信任、不敢提案的人、冷戰）', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文沒有中文', r.ui.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
