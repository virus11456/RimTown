// v11.4.0 提案、投票、首長裁決不再擲骰（sim-proposals.js；三種事登記在 sim-decide-pol.js）
//   1) 登記了「要不要站出來提案」「這一案投贊成還是反對」「提案送到首長桌上」
//   2) 誰在意：他這行的事、他自己的事分數高；不相干的人低
//   3) 誰開口：提案人是在意那件事的人（連做 30 次都是），沒人在意的小事沒人提，急事有人提
//   4) 誰去投：跟自己有關的、熱心的人去投；不相干又不熱心的人不投；別的系統提的大事大家都投；理由夠強的人每次投的都一樣
//   5) 首長：沒人表態時看他自己的立場（連做 20 次都一樣），票數差不多才擱置
//   6) 提案與裁決記進本人「做過的決定」；開智能體時交給 AI 的是「在意的那個人」與「他在意的幾件事」
//   7) 放著跑 20 天沒有錯誤，有提案、有人投票
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Proposals\]|\[Decide\]/.test(x)) console.log('    console:', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; w.fullAgentMode = false; const PS = w.proposals; const out = {}; const R0 = Math.random;
    const npcs = () => PS._npcs(w); const day = () => PS._abs(w);
    for (let k = 0; k < 900 && !DECIDE.on(w); k++) { w.paused = false; w.tick(); } w.paused = true; out.on = DECIDE.on(w); // 決策核心要等錢包建好（第一天結算後）才算開著
    out.kinds = ['propose', 'vote', 'ruling'].map(k => DECIDE.KINDS[k] ? t(DECIDE.KINDS[k].title) : null);
    // 挑一個人數夠多的行業當「在意的人」
    const byJob = {}; for (const a of npcs()) if (a.job?.key && a.job.key !== 'mayor') (byJob[a.job.key] = byJob[a.job.key] || []).push(a);
    const J = Object.keys(byJob).sort((x, y) => byJob[y].length - byJob[x].length)[0]; const A = byJob[J][0]; const B = npcs().find(a => a.job?.key !== J && a.job?.key !== 'mayor');
    const mk = (key, weight, jobs, extra) => Object.assign({ kind: 'festival', key, weight, jobs: jobs || [], make: (a) => ({ kind: 'festival', key, tk: '辦一場市集', tp: {}, dk: '{who}提議辦一場市集。', dp: { who: a.name }, cost: {}, category: 'culture', jobBias: jobs || [] }) }, extra || {});
    const plain = (a) => { a._p0 = a._p0 || JSON.stringify(a.personality); a.personality.traits = []; a.personality.values = []; };
    const restore = () => { for (const a of npcs()) if (a._p0) { a.personality = JSON.parse(a._p0); delete a._p0; } };
    const fresh = () => { PS.items = PS.items.filter(p => p.status !== 'open' && p.status !== 'shelved'); PS.cooldown = {}; PS.proposerCooldown = {}; };
    // 2) 誰在意
    { for (const a of npcs()) plain(a); const c1 = mk('t:job', 1.3, [J]); const cSelf = mk('relief:' + B.agentId, 1.3, []);
      out.care = { mine: PS._careOf(w, A, c1), other: PS._careOf(w, B, c1), self: PS._careOf(w, B, cSelf), notSelf: PS._careOf(w, A, cSelf) }; }
    // 3) 誰開口
    { const c0 = PS._candidates; const cJob = mk('t:job', 1.3, [J]), cNone = mk('t:none', 0.8, []), cUrg = mk('t:urgent', 6, []);
      fresh(); PS._candidates = () => [cNone]; PS._generate(w, day()); out.quiet = PS.open().length;
      let hit = 0, made = 0; const whys = {}; for (let i = 0; i < 30; i++) { fresh(); PS._candidates = () => [cJob, cNone].filter(c => PS._cool(day(), c.key)); PS._generate(w, day()); const p = PS.open()[0]; if (p) { made++; if (w.agents[p.proposerId]?.job?.key === J && p.key === 't:job') hit++; whys[p.raiseWhy] = (whys[p.raiseWhy] || 0) + 1; } }
      out.speak = { made, hit, whys };
      fresh(); PS._candidates = () => [cUrg].filter(c => PS._cool(day(), c.key)); PS._generate(w, day()); const pu = PS.open()[0]; out.urgent = pu ? { key: pu.key, why: pu.raiseWhy } : null;
      let pj = 0; for (let i = 0; i < 20; i++) { PS.proposerCooldown = {}; const a = PS._proposer(w, day(), [J], null); if (a?.job?.key === J) pj++; } out.proposerJob = pj;
      Math.random = () => 0.5; PS.proposerCooldown = {}; byJob[J][1] && (byJob[J][1].personality.traits = ['charismatic']); const loud = PS._proposer(w, day(), [J], null); Math.random = R0; out.loud = byJob[J][1] ? loud === byJob[J][1] : true;
      // 6b) 開智能體：交給 AI 的是在意的那個人、他在意的事排最前
      const eng = w.conversationEngine; const e0 = { ok: eng.fullAgentOk, ch: eng.chooseProposal }; const fs0 = ProposalSystem.FREE_SHARE; let seen = null;
      fresh(); for (const a of npcs()) plain(a); PS._candidates = () => [cNone, cJob].filter(c => PS._cool(day(), c.key)); w.fullAgentMode = true; eng.fullAgentOk = () => true; eng.chooseProposal = async (ww, a, sums) => { seen = { job: a.job?.key, n: sums.length, first: sums[0]?.title }; return { choice: 1, pitch: 'because it is my trade' }; }; ProposalSystem.FREE_SHARE = 0;
      PS._generate(w, day()); await new Promise(r => setTimeout(r, 60)); const pa = PS.open()[0]; out.ai = { seen, key: pa?.key, job: w.agents[pa?.proposerId]?.job?.key, raiseAi: pa?.raiseAi };
      w.fullAgentMode = false; eng.fullAgentOk = e0.ok; eng.chooseProposal = e0.ch; ProposalSystem.FREE_SHARE = fs0;
      PS._advance(w, day()); const L = (DECIDE.S(w).log[pa?.proposerId] || []).filter(e => e.kind === 'propose').pop(); out.aiLog = L ? { ai: L.ai, what: Memory.render(L.what.k, L.what.p), why: L.why ? (L.why.raw || '') : '' } : null;
      PS._candidates = c0; }
    // 4) 誰去投
    { fresh(); for (const a of npcs()) plain(a); const P = { id: 'T1', kind: 'festival', key: 't:v', status: 'open', category: 'culture', jobBias: [J], proposerId: '__none', createdDay: day() - 1, votes: {}, why: {}, tk: '辦一場市集', tp: {} };
      for (const a of npcs()) if (a.relationships?.relationships) delete a.relationships.relationships['__none'];
      const C = npcs().find(a => a.job?.key !== J && a.job?.key !== 'mayor' && a !== B); C.personality.traits = ['hardworking'];
      out.now = { staked: PS._votesNow(w, P, A), idle: PS._votesNow(w, P, B), dutiful: PS._votesNow(w, P, C), big: PS._votesNow(w, Object.assign({}, P, { kind: 'some_big_law' }), B), stA: PS._stakeOf(w, P, A), stB: PS._stakeOf(w, P, B) };
      PS.items.push(P); PS._vote(w); const voted = Object.keys(P.votes); const pop = npcs().length;
      out.round = { n: voted.length, pop, A: !!P.votes[A.agentId], B: !!P.votes[B.agentId], C: !!P.votes[C.agentId], jobAll: byJob[J].every(a => P.votes[a.agentId]) };
      let same = 0; for (let i = 0; i < 40; i++) { P.votes = {}; P.why = {}; PS._ruleVote(w, P, A); if (P.votes[A.agentId] === 'for') same++; } out.steady = same; PS.items = PS.items.filter(p => p !== P); }
    // 5) 首長
    { const m = PS._mayor(w); out.hasMayor = !!m; if (m) { plain(m); const d0 = PS._decide; const acts = []; PS._decide = (ww, p, action) => { acts.push(action + ':' + p.mayorWhy); };
        const mkP = (proposerId, votes) => ({ id: 'T2', kind: 'festival', key: 't:m', status: 'open', category: 'culture', jobBias: [], proposerId, createdDay: day() - 2, votes: Object.assign({}, votes), why: {}, tk: '辦一場市集', tp: {}, cost: {} });
        const run = (p, final, n = 20) => { acts.length = 0; for (let i = 0; i < n; i++) { const q = JSON.parse(JSON.stringify(p)); PS._mayorRule(w, q, day(), final); } return [...new Set(acts)]; };
        const foe = B; m.relationships.relationships = m.relationships.relationships || {}; const r0 = m.relationships.relationships[foe.agentId]; m.relationships.relationships[foe.agentId] = Object.assign({}, r0, { affinity: -100 });
        const neutral = A; const rn = m.relationships.relationships[neutral.agentId]; m.relationships.relationships[neutral.agentId] = Object.assign({}, rn, { affinity: 0 });
        const V = (f, a) => { const v = {}; const ids = npcs().filter(x => x !== m).map(x => x.agentId); for (let i = 0; i < f; i++) v[ids[i]] = 'for'; for (let i = 0; i < a; i++) v[ids[f + i]] = 'against'; return v; };
        out.mayor = { own: run(mkP(m.agentId, {}), false), foe: run(mkP(foe.agentId, {}), false), none: run(mkP(neutral.agentId, {}), false), noneFinal: run(mkP(neutral.agentId, {}), true), tie: run(mkP(neutral.agentId, V(5, 5)), false), clear: run(mkP(neutral.agentId, V(6, 4)), false), big: run(mkP(neutral.agentId, V(9, 2)), false) };
        PS._decide = d0; m.relationships.relationships[foe.agentId] = r0; m.relationships.relationships[neutral.agentId] = rn; if (!r0) delete m.relationships.relationships[foe.agentId]; if (!rn) delete m.relationships.relationships[neutral.agentId];
        const L = (DECIDE.S(w).log[m.agentId] || []).filter(e => e.kind === 'ruling').pop(); out.ruleLog = L ? { id: L.id, ai: L.ai, what: Memory.render(L.what.k, L.what.p), why: L.why ? Memory.render(L.why.k, L.why.p || {}) : '' } : null; } }
    // 6) 照個性提的案也記進提案人的紀錄
    { restore(); fresh(); const before = PS.items.length; for (let i = 0; i < 6 && PS.items.length === before; i++) { PS._lastDay = -1; PS.daily(w); for (let k = 0; k < 400 && PS._abs(w) === PS._lastDay; k++) { w.paused = false; w.tick(); } w.paused = true; }
      const p = PS.items[PS.items.length - 1]; PS._advance(w, day() + 0); const L = p ? (DECIDE.S(w).log[p.proposerId] || []).filter(e => e.kind === 'propose').pop() : null; out.ruleLog2 = p ? { made: true, logged: !!L, what: L ? Memory.render(L.what.k, L.what.p) : '', dl: p._dl } : { made: false }; }
    // 7) 放著跑 20 天
    { const st0 = Object.assign({}, PS.stats); let turn = [], rul = {}; const seenP = new Set(); const errs0 = [];
      for (let i = 0; i < 20; i++) { const d0 = w._absDay(); try { for (let k = 0; k < 400 && w._absDay() === d0; k++) { w.paused = false; w.tick(); } } catch (e) { errs0.push(e.message); } w.paused = true;
        for (const p of PS.items) { if (seenP.has(p.id) || p.status === 'open') continue; seenP.add(p.id); if (p.mayorWhy) { const k = String(p.mayorWhy).startsWith('llm:') ? 'llm' : p.mayorWhy; rul[k] = (rul[k] || 0) + 1; } if (PROPOSAL_BASE_KINDS.has(p.kind) && p.createdDay >= day() - 20) turn.push(Object.keys(p.votes || {}).length / Math.max(1, npcs().length)); } await new Promise(r => setTimeout(r, 0)); }
      const pk = DECIDE.stats(w).pick || {}; out.run = { made: PS.stats.made - st0.made, turnout: turn.length ? Math.round(turn.reduce((s, x) => s + x, 0) / turn.length * 100) / 100 : null, n: turn.length, rul, raise: pk['propose.raise'] || 0, ruling: Object.keys(pk).filter(k => k.startsWith('ruling.')).reduce((s, k) => s + pk[k], 0), errs: errs0.slice(0, 3) }; }
    out.texts = [t('要不要站出來提案'), t('這一案投贊成還是反對'), t('提案送到首長桌上'), t('沒什麼人表態，鎮長自己也不看好'), t('沒什麼人表態，鎮長想再等等大家的意見'), t('這跟我這行有關'), t('鎮上這件事不能再拖'), t('總得有人開口'), t('在鎮上提了「{x}」'), t('「{x}」：我核准了')];
    return out; });
  const tag = `[${dev} ${lang}]`;
  ok(r.kinds.every(Boolean), `${tag} 登記了提案、投票、裁決三種事`, r.kinds);
  ok(r.care.mine[0] >= 2 && r.care.mine[1] === 'job' && r.care.other[0] === 0 && r.care.self[0] >= 3 && r.care.self[1] === 'self' && r.care.notSelf[0] < 3, `${tag} 誰在意：自己這行的事 2 分、自己的事 3 分、不相干的人 0 分`, r.care);
  ok(r.quiet === 0, `${tag} 沒人在意的小事，沒有人提`, r.quiet);
  ok(r.speak.made === 30 && r.speak.hit === 30 && r.speak.whys.job === 30, `${tag} 連做 30 次：提案的都是做那一行的人，提的都是他那行的事`, r.speak);
  ok(r.urgent && r.urgent.key === 't:urgent' && r.urgent.why === 'urgent', `${tag} 急事沒人特別在意也會有人站出來，理由是「不能再拖」`, r.urgent);
  ok(r.proposerJob === 20 && r.loud, `${tag} 其他系統找提案人：連做 20 次都是指定行業的人；條件相同時是最愛出聲的那個`, { job: r.proposerJob, loud: r.loud });
  ok(r.ai.seen && r.ai.seen.job === r.ai.job && r.ai.key === 't:job' && r.ai.raiseAi === 1, `${tag} 開智能體：問的是在意的那個人，他在意的事排第一`, r.ai);
  ok(r.aiLog && r.aiLog.ai === 1 && r.aiLog.why === 'because it is my trade' && (zh ? /提了/.test(r.aiLog.what) : /Proposed/.test(r.aiLog.what)), `${tag} AI 提的案記進提案人做過的決定，帶著他的理由`, r.aiLog);
  ok(r.now.staked && !r.now.idle && r.now.dutiful && r.now.big, `${tag} 誰去投：跟自己這行有關的去、熱心的人去、不相干又不熱心的不去；大事大家都去`, r.now);
  ok(r.round.A && !r.round.B && r.round.C && r.round.jobAll && r.round.n < r.round.pop, `${tag} 投一輪：那一行的人全投了，不相干的人沒投`, r.round);
  ok(r.steady === 40, `${tag} 理由夠強的人連投 40 次都是贊成（不會因為運氣翻盤）`, r.steady);
  if (r.hasMayor) {
    const one = (x, v) => x.length === 1 && x[0] === v;
    ok(one(r.mayor.own, 'approve:quiet') && one(r.mayor.foe, 'reject:quiet_no') && one(r.mayor.none, 'shelve:quiet_wait') && one(r.mayor.noneFinal, 'approve:quiet'), `${tag} 沒人表態時：首長自己提的核准、討厭的人提的否決、沒立場先等等、最後期限就拍板（各 20 次都一樣）`, r.mayor);
    ok(one(r.mayor.tie, 'shelve:wait') && one(r.mayor.clear, 'approve:majority') && one(r.mayor.big, 'approve:majority'), `${tag} 票數一樣多才擱置；六比四照多數（各 20 次都一樣）`, r.mayor);
    ok(r.ruleLog && r.ruleLog.id === 'approve' && r.ruleLog.ai === 0 && r.ruleLog.what && r.ruleLog.why, `${tag} 首長的裁決記進他做過的決定，帶著理由`, r.ruleLog);
    ok(zh || !/[一-鿿]/.test(r.ruleLog.what.replace(/["“”「」].*["“”「」]/, '') + r.ruleLog.why), `${tag} 裁決紀錄有英文`, r.ruleLog);
  }
  ok(r.ruleLog2.made && r.ruleLog2.logged && r.ruleLog2.dl === 1, `${tag} 照個性提的案也記進提案人做過的決定`, r.ruleLog2);
  ok(r.run.errs.length === 0 && r.run.made >= 6 && r.run.raise >= 6 && r.run.ruling >= 4, `${tag} 放著跑 20 天：有人提案、首長有裁決、沒有錯誤`, r.run);
  ok(r.run.turnout === null || (r.run.turnout >= 0.2 && r.run.turnout <= 0.98), `${tag} 20 天的日常提案平均有二成到九成八的人投票`, r.run);
  ok(zh || !r.texts.some(x => /[一-鿿]/.test(x)), `${tag} 新句子有英文`, r.texts);
  console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
