// v6.43.6 回歸:鎮長用 AI 裁決提案時存檔,讀檔後提案不能永遠卡住;同一局回覆遲遲不來,隔天也照常裁決
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
  await page.route('**/api/**', (r) => { const u = r.request().url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); return j({ reply: '' }); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.proposals, null, { timeout: 40000 }); await page.waitForTimeout(1500);

  // 準備:4 件到期的提案,鎮長 AI 裁決永遠不回(模擬回覆途中存檔／關頁)
  const setup = () => page.evaluate(() => { const w = window.rimtownApp.world, P = w.proposals; window.rimtownApp._setPaused?.(true);
    w.fullAgentMode = true; w.conversationEngine.decideMayor = () => new Promise(() => {}); w.conversationEngine.decideVotes = async () => null;
    const day = P._abs(w); P.items = []; P._lastDay = -1;
    const npcs = P._npcs(w);
    for (let i = 0; i < 4; i++) P.items.push({ id: 'L9' + i, kind: 'policy', key: 'x' + i, title: '測試提案' + i, status: 'open', createdDay: day - 5, proposerId: npcs[i].agentId, proposerName: npcs[i].name, votes: {}, why: {}, effects: { mood_modifier: 1 } });
    P._advance(w, day); return { day, ruling: P.items.filter(p => p._ruling).length }; });

  console.log('存檔當下鎮長正在用 AI 裁決');
  let r0 = await setup();
  let r = await page.evaluate(async (r0) => { const w = window.rimtownApp.world, P = w.proposals;
    const blob = JSON.parse(JSON.stringify(w.serialize())); const savedRuling = (blob.proposals.items || []).filter(p => p._ruling).length;
    w.loadSave(blob); const P2 = w.proposals; w.conversationEngine.decideMayor = async () => null; // 讀檔後 AI 正常(或關掉)
    const afterLoad = P2.items.filter(p => p._ruling).length;
    P2._advance(w, r0.day); await new Promise(res => setTimeout(res, 100)); const decided = P2.items.filter(p => p.status !== 'open').length;
    return { savedRuling, afterLoad, decided, statuses: P2.items.map(p => p.status) }; }, r0);
  ok(r0.ruling === 4 && r.savedRuling === 4, '前提:4 件提案在存檔當下都在等 AI 裁決', { r0, r });
  ok(r.afterLoad === 0 && r.decided === 4, '讀檔後不再卡住,當天就裁決', r);

  console.log('同一局 AI 回覆遲遲不來');
  r0 = await setup();
  r = await page.evaluate(async (r0) => { const w = window.rimtownApp.world, P = w.proposals;
    P._advance(w, r0.day); const sameDay = P.items.filter(p => p.status !== 'open').length; // 同一天繼續等
    w.conversationEngine.decideMayor = async () => null;
    P._advance(w, r0.day + 1); await new Promise(res => setTimeout(res, 100)); const nextDay = P.items.filter(p => p.status !== 'open').length;
    return { sameDay, nextDay, ruling: P.items.filter(p => p._ruling).length }; }, r0);
  ok(r.sameDay === 0, '同一天照舊等 AI 回覆', r);
  ok(r.nextDay === 4 && r.ruling === 0, '隔天還沒回就照規則裁決', r);

  console.log('跨日改用規則後,遲到的舊 AI 回覆');
  r = await page.evaluate(async () => { const w = window.rimtownApp.world, P = w.proposals, E = w.conversationEngine; window.rimtownApp._setPaused?.(true);
    w.fullAgentMode = true; E.decideVotes = async () => null;
    const day = P._abs(w); const npc = P._npcs(w)[0];
    const p = { id: 'L980', kind: 'policy', key: 'race', title: '競態', status: 'open', createdDay: day - 5, proposerId: npc.agentId, proposerName: npc.name, votes: {}, why: {}, effects: { mood_modifier: 1 } };
    P.items = [p]; P._lastDay = -1;
    // 第 1 天:AI 開始想(回覆被我們攔住,稍後才放)
    const pending = []; let calls = 0; E.decideMayor = () => { calls++; return new Promise(res => pending.push(res)); };
    P._advance(w, day); const t1 = p._rulingTicket;
    // 第 2 天:還沒回 → 規則裁決;讓規則選擇擱置
    const rs = Math.random; Math.random = () => 0.9; P._advance(w, day + 1); Math.random = rs; const afterRule = p.status;
    // 第 3 天之後(擱置滿 3 天)鎮長重新裁決,開新一輪 AI
    const dbg = { shelvedDay: p.shelvedDay, llmRuledDay: p._llmRuledDay, day }; P._advance(w, day + 4); const t2 = p._rulingTicket, ruling2 = p._ruling; dbg.after4 = { status: p.status, ruling: p._ruling, llm: p._llmRuledDay, calls };
    // 舊回覆這時才到:想把它改成「批准」
    pending[0]({ action: 'approve', why: '舊回覆' }); await new Promise(r => setTimeout(r, 50));
    const afterLate = { status: p.status, ruling: p._ruling, why: p.mayorWhy };
    // 新一輪照常:同一天不會重複送出請求
    P._advance(w, day + 4); const callsSameDay = calls;
    if (pending[1]) pending[1]({ action: 'reject', why: '新回覆' }); await new Promise(r => setTimeout(r, 50));
    return { dbg, t1, t2, afterRule, ruling2, afterLate, callsSameDay, final: { status: p.status, why: p.mayorWhy, ruling: p._ruling } }; });
  ok(r.afterRule === 'shelved' && r.ruling2 && r.t2 > r.t1, '前提:規則先擱置,之後開了新一輪 AI 裁決', r);
  ok(r.afterLate.status === 'shelved' && r.afterLate.ruling === true && !/舊回覆/.test(r.afterLate.why || ''), '遲到的舊回覆不能改寫結果,也不會清掉新一輪的等待旗標', r.afterLate);
  ok(r.callsSameDay === 2, '同一天不會重複送出請求', r);
  ok(r.final.status === 'rejected' && /新回覆/.test(r.final.why || '') && !r.final.ruling, '新一輪的回覆照常生效', r.final);

  console.log('快轉多天、AI 一直沒回(中間不讓出執行緒)');
  r0 = await setup();
  r = await page.evaluate((r0) => { const w = window.rimtownApp.world, P = w.proposals; w.conversationEngine.decideMayor = () => new Promise(() => {});
    for (let i = 1; i <= 3; i++) P._advance(w, r0.day + i);
    return { decided: P.items.filter(p => p.status !== 'open').length, auto: P.stats.auto }; }, r0);
  ok(r.decided === 4, '隔天直接照規則裁決,不會每天重問 AI 又卡住', r);

  console.log('全鎮不會因此停止提案');
  r = await page.evaluate(() => { const w = window.rimtownApp.world, P = w.proposals; const before = P.items.length;
    w.conversationEngine.decideMayor = async () => null; w.fullAgentMode = false;
    let d = P._abs(w) + 2; for (let i = 0; i < 8; i++) { P._lastDay = -1; P._generate(w, d + i); P._advance(w, d + i); }
    return { before, after: P.items.length, open: P.open().length }; });
  ok(r.after > r.before, '裁決後空出名額,村民繼續提新案', r);
  console.log('選舉卡代理提示');
  r = await page.evaluate(() => { const app = window.rimtownApp, w = app.world, el = w.election; el.acting = null; el.active = false; el.phase = 'none';
    const m = el._realMayor(w); const loc = m.currentLocation;
    const card = () => { app.state = w.getState(); const d = document.createElement('div'); d.innerHTML = app._electionCardHtml(); return (d.querySelector('.el-acting')?.textContent || '').trim(); };
    m.currentLocation = 'exploration'; m.activity = 'exploring'; el._checkMayor(w); const exploring = card();
    m.currentLocation = loc; m.activity = 'idle'; const stale = card(); // 還沒跑每日檢查,state 也是舊的
    // 探險隊回來的流程會馬上重新檢查
    w.exploration.activeExpeditions = [{ id: 'exp_t', agentIds: [m.agentId], agentNames: [m.name], returnTick: w.tickCount - 1, zoneId: 'x' }];
    try { w.exploration.dailyUpdate ? null : null; } catch (e) {}
    el._checkMayor(w); const back = card();
    return { exploring, stale, back, acting: el.acting }; });
  ok(/探險/.test(r.exploring) && !/補選/.test(r.exploring), '鎮長去探險:提示寫探險、不寫補選', r);
  ok(r.stale === '' && r.back === '' && !r.acting, '鎮長回到鎮上:提示馬上消失', r);

  console.log('共享記憶截斷不切壞 emoji');
  r = await page.evaluate(() => { const w = window.rimtownApp.world; const a = Object.values(w.agents).find(x => !x.isPlayer); const b = Object.values(w.agents).find(x => !x.isPlayer && x !== a);
    const rel = a.relationships.getOrCreate(b.agentId, b.name); rel.sharedMemories = [];
    const long = '一起在泉水噴泉看星星'.repeat(9) + '😀🌟👨‍👩‍👧' + '結尾'; // 剛好在 emoji 上被截
    const cut = '😀'.repeat(60) + 'x';
    rel.addSharedMemory(long); rel.addSharedMemory(cut);
    const blob = JSON.parse(JSON.stringify(w.serialize()));
    const saved = blob.agents ? (Array.isArray(blob.agents) ? blob.agents : Object.values(blob.agents)).find(x => x.id === a.agentId).relationships[b.agentId].sharedMemories : [];
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    // 舊版切壞的存檔:讀檔要清掉半個字
    const savedObj = (Array.isArray(blob.agents) ? blob.agents : Object.values(blob.agents)).find(x => x.id === a.agentId).relationships[b.agentId];
    savedObj.sharedMemories = ['abc' + '😀'.slice(0, 1), '😀'.slice(1) + 'def'];
    w.loadSave(blob); const after = w.agents[a.agentId].relationships.relationships[b.agentId].sharedMemories;
    return { saved, savedBroken: saved.some(x => lone.test(x)), lens: saved.map(x => Array.from(x).length), after, afterBroken: after.some(x => lone.test(x)) }; });
  ok(!r.savedBroken && r.lens.every(n => n <= 100), '存檔截斷後沒有半個 emoji', { lens: r.lens, broken: r.savedBroken });
  ok(!r.afterBroken && r.after[0] === 'abc' && r.after[1] === 'def', '舊存檔切壞的 emoji 讀檔時清掉', r.after);
  console.log('存檔省略可推回的欄位,讀檔後完全一樣');
  r = await page.evaluate(() => { const w = window.rimtownApp.world; window.rimtownApp._setPaused?.(true);
    for (let i = 0; i < 300; i++) { w.paused = false; w.tick(); } w.paused = true;
    const r1 = (x) => Math.round((x || 0) * 10) / 10; // v9.10.2 存檔的關係數字只留一位小數、閒聊記憶只存最近 15 則:比對存檔真正保證的部分
    const snap = () => Object.values(w.agents).filter(a => !a.isPlayer).map(a => ({ id: a.agentId, mem: a.memory.entries.filter(m => m.category !== 'conversation').map(m => `${m.tick}|${m.timeStr}|${m.category}`).join('\n'), rel: JSON.stringify(Object.values(a.relationships.relationships).map(r => [r.targetId, r1(r.affinity), r1(r.trust), r1(r.romanticInterest), r.status || null, r.statusSince || 0, !!r.isCheating, !!r.isFeud])) }));
    // 一筆時間被「跳過」的記憶(推不回來):要照存
    const a0 = Object.values(w.agents).find(a => !a.isPlayer); a0.memory.add(w.tickCount, '第 9 年冬季 第 9 天 09:09', 'daily', '時間對不上的記憶', 3, []);
    const before = snap(); const blob = JSON.parse(JSON.stringify(w.serialize()));
    const ags = Array.isArray(blob.agents) ? blob.agents : Object.values(blob.agents);
    const mems = ags.flatMap(a => a.memory || []); const withTs = mems.filter(m => 'timeStr' in m).length;
    const odd = mems.find(m => m.timeStr === '第 9 年冬季 第 9 天 09:09');
    w.loadSave(blob); const after = snap();
    const diff = before.filter((b, i) => b.mem !== after[i]?.mem || b.rel !== after[i]?.rel).map(b => b.id);
    return { mems: mems.length, withTs, odd: !!odd, diff, kept: mems.filter(m => 'timeStr' in m).slice(0, 4).map(m => m.tick + ' ' + m.timeStr + ' ' + m.category), now: w.tickCount + ' ' + w.clock.timeStr }; });
  ok(r.withTs <= r.mems * 0.03 && r.odd, '記憶時間字串只存推不回來的那幾筆(開局家族記憶、時間跳過的)', r);
  ok(r.diff.length === 0, '存讀檔後記憶時間與關係欄位完全一致', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
