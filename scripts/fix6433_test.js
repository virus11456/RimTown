// v6.43.3 選舉回歸:候選人離鎮不能當選(也不會撤掉原鎮長)、鎮長探險要指派代理、等 AI 時離鎮的選民不計票
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(); const u = req.url(); const j = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/api/chat')) {
      const p = JSON.parse(req.postData() || '{}').prompt || ''; let reply = '';
      if (p.includes('"vote":候選人序號')) { await new Promise(r => setTimeout(r, 1500)); const n = ((p.split('【村民】')[1] || '').match(/^\d+\. /gm) || []).length; reply = JSON.stringify(Array.from({ length: n }, (_, i) => ({ n: i + 1, vote: 1, why: '他最照顧大家。' }))); }
      return j({ reply });
    }
    if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); return j({});
  });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.election, null, { timeout: 40000 }); await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  console.log('1. 候選人開票前離鎮');
  let r = await ev(() => { const w = window.rimtownApp.world, el = w.election; window.rimtownApp._setPaused?.(true); w.fullAgentMode = false;
    const mayor0 = el._realMayor(w); el.active = false; el.phase = 'none'; el.triggerElection(w);
    while (el.phase === 'campaign') el.dailyUpdate(w);
    const cands = el.candidates.filter(c => c.agentId !== mayor0.agentId); const top = cands[0];
    // 讓 top 拿到全部票,再讓他出遠門
    el.votes = {}; for (const a of el._residents(w)) el.votes[a.agentId] = top.agentId;
    w.events._sendAgentTravelling(w, w.agents[top.agentId], '探親', 3);
    el.votingDaysLeft = 1; el.dailyUpdate(w);
    const last = el.electionHistory[el.electionHistory.length - 1]; const m = el._realMayor(w);
    return { top: top.name, winner: last?.winner?.name, mayor: m?.name, mayorsInTown: Object.values(w.agents).filter(a => a.job?.key === 'mayor').length, inCands: last?.candidates?.some(c => c.agentId === top.agentId), total: last?.totalVotes }; });
  ok(r.winner && r.winner !== r.top && !r.inCands, '離鎮的候選人失去資格,由在鎮上的人當選', r);
  ok(r.mayor === r.winner && r.mayorsInTown === 1, '當下有正式鎮長(就是當選人)', r);

  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; const mayor0 = el._realMayor(w);
    el.phase = 'none'; el.active = false; el.triggerElection(w); while (el.phase === 'campaign') el.dailyUpdate(w);
    const others = el.candidates.filter(c => c.agentId !== mayor0.agentId);
    for (const c of others) w.events._sendAgentTravelling(w, w.agents[c.agentId], '探親', 3);
    const mayorWasCand = el.candidates.some(c => c.agentId === mayor0.agentId);
    if (mayorWasCand) el.candidates = el.candidates.filter(c => c.agentId !== mayor0.agentId); // 只剩離鎮的候選人
    el.votingDaysLeft = 1; el.dailyUpdate(w);
    const m = el._realMayor(w); return { mayor0: mayor0.name, mayor: m?.name, job: w.agents[mayor0.agentId]?.job?.key, phase: el.phase, active: el.active }; });
  ok(r.mayor === r.mayor0 && r.job === 'mayor' && !r.active, '候選人全都不在鎮上:選舉作廢,原鎮長留任', r);
  // 把出遠門的人都叫回來
  await ev(() => { const w = window.rimtownApp.world; for (const tr of (w.events._travellingAgents || []).slice()) { w.events._travellingAgents = w.events._travellingAgents.filter(x => x !== tr); w.events._returnAgent(w, tr); } w.election._checkMayor(w); });

  console.log('2. 鎮長去探險');
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; const m = el._realMayor(w); el.acting = null; el.phase = 'none'; el.active = false;
    const loc = m.currentLocation; m.currentLocation = 'exploration'; m.activity = 'exploring';
    el._checkMayor(w); const acting = el.acting ? { ...el.acting } : null; const cur = el.currentMayor(w); const startedBy = el.active;
    const decider = w.proposals._mayor(w);
    m.currentLocation = loc; m.activity = 'idle'; el._checkMayor(w);
    return { mayor: m.name, acting, cur: cur?.name, decider: decider?.name, startedBy, after: el.acting, back: el.currentMayor(w)?.name }; });
  ok(r.acting && r.acting.reason === 'explore' && r.acting.mayorId && r.cur === r.acting.name && r.cur !== r.mayor, '探險時指派代理鎮長,由代理拍板', r);
  ok(r.decider === r.acting?.name && !r.startedBy, '提案裁決找代理,而且不會開補選', r);
  ok(!r.after && r.back === r.mayor, '探險回來交還', r);
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; const m = el._realMayor(w); el.acting = null;
    const loc = m.currentLocation; m.currentLocation = 'exploration'; m.activity = 'exploring';
    // 白天臨時出發:不跑每日檢查,直接問「現在誰拍板」
    const d1 = w.proposals._mayor(w); const a1 = el.acting ? { ...el.acting } : null;
    // 代理人自己也去探險
    const ag = w.agents[a1?.agentId]; const aloc = ag?.currentLocation; if (ag) { ag.currentLocation = 'exploration'; ag.activity = 'exploring'; }
    const d2 = el.currentMayor(w); const a2 = el.acting ? { ...el.acting } : null;
    if (ag) { ag.currentLocation = aloc; ag.activity = 'idle'; } m.currentLocation = loc; m.activity = 'idle'; el._checkMayor(w);
    return { mayor: m.name, d1: d1?.name, a1: a1?.name, d2: d2?.name, a2: a2?.name, a2explore: a2?.reason, after: el.acting, back: el.currentMayor(w)?.name }; });
  ok(r.d1 && r.d1 === r.a1 && r.d1 !== r.mayor, '鎮長白天臨時去探險:當下就由代理拍板,不用等隔天', r);
  ok(r.d2 && r.d2 === r.a2 && r.a2 !== r.a1 && r.a2explore === 'explore', '代理人自己也去探險:換另一位在鎮上的人代理', r);
  ok(!r.after && r.back === r.mayor, '兩人回來後交還正式鎮長', r);

  console.log('3. 等 AI 回覆時選民離鎮');
  r = await ev(async () => { const w = window.rimtownApp.world, el = w.election, L = w.conversationEngine.llm; w.fullAgentMode = true; L._rateLimitedUntil = 0; L._requestTimestamps = [];
    el.phase = 'none'; el.active = false; w.fullAgentMode = false; el.triggerElection(w); while (el.phase === 'campaign') el.dailyUpdate(w); w.fullAgentMode = true;
    el.votes = {}; el.voteWhy = {}; el._llmPending = {};
    const p = el._voteLLMAll(w); await new Promise(r => setTimeout(r, 300));
    const pending = Object.keys(el._llmPending); const candIds = new Set(el.candidates.map(c => c.agentId));
    const leaverId = pending.find(id => !candIds.has(id) && w.agents[id]?.job?.key !== 'mayor'); const leaver = w.agents[leaverId];
    w.events._sendAgentTravelling(w, leaver, '探親', 3);
    await p;
    return { pending: pending.length, leaver: leaver?.name, counted: !!el.votes[leaverId], why: !!el.voteWhy[leaverId], others: Object.keys(el.votes).length }; });
  ok(r.pending > 2 && r.leaver && !r.counted && !r.why && r.others >= r.pending - 1, '回覆到的時候人已經離鎮:不計票、也不記理由', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();

  console.log('4. 手機畫質與標籤更新');
  for (const [label, init] of [['舊的自動降級紀錄', { q: 'low' }], ['玩家親手選低畫質', { q: 'low', by: 'user' }]]) {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const mp = await mctx.newPage(); const merrs = [];
    mp.on('pageerror', e => merrs.push(e.message));
    await mp.route('**/api/**', (rt) => { const u = rt.request().url(); const j = (o) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); return j({ reply: '' }); });
    await mp.addInitScript(({ jwt, init }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', init.q); if (init.by) localStorage.setItem('rimtown_3d_q_by', init.by); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, init });
    await mp.goto(BASE, { waitUntil: 'load' }); await mp.waitForFunction(() => window.rimtownApp?.tileMap?.renderer, null, { timeout: 40000 }); await mp.waitForTimeout(2500);
    r = await mp.evaluate(async () => { const tm = window.rimtownApp.tileMap; const low0 = tm.lowQuality, lock0 = tm.lockQuality;
      if (!tm.lowQuality) tm.setLowQuality(true, true); // 模擬自動降級
      const stored = localStorage.getItem('rimtown_3d_quality'), by = localStorage.getItem('rimtown_3d_q_by');
      // 鏡頭持續轉動 2 秒:每畫一幀標籤都要跟著更新
      let renders = 0, ovs = 0; const R = tm.renderer.render.bind(tm.renderer); tm.renderer.render = (...a) => { renders++; return R(...a); };
      const U = tm._updateOverlays.bind(tm); tm._updateOverlays = (...a) => { ovs++; return U(...a); };
      tm._lastInputAt = Date.now(); const t0 = performance.now(); await new Promise(res => { const f = () => { tm.yaw += 0.01; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      const moving = { renders, ovs }; renders = 0; ovs = 0;
      await new Promise(res => setTimeout(res, 1500)); // 鏡頭靜止
      return { low0, lock0, stored, by, moving, still: { renders, ovs } }; });
    if (label === '舊的自動降級紀錄') {
      ok(!r.low0 && !r.lock0, '舊的自動降級紀錄不再把手機鎖在低畫質', r);
      ok(r.stored === 'low' && r.by !== 'user', '這次自動降級不寫成玩家設定(只在這次有效)', r);
    } else ok(r.low0 && r.lock0, '玩家親手選的低畫質照舊鎖定', r);
    ok(r.moving.renders > 5 && r.moving.ovs >= r.moving.renders - 1, `${label}:鏡頭轉動時每幀都更新標籤`, r.moving);
    ok(r.still.ovs < r.still.renders, `${label}:鏡頭靜止時照舊省著更新`, r.still);
    ok(!merrs.length, label + ' 沒有頁面錯誤', merrs.slice(0, 3));
    await mctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
