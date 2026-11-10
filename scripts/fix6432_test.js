// v6.43.2 回歸:第一年秋季第 1 天會開選、競選與投票遇到 AI 冷卻隔天會再問、研究點每天最多用 10、研究空檔 2 天
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
const POL = ['economy', 'welfare', 'culture', 'nature'];
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const kinds = { campaign: 0, votes: 0 };
  await page.route('**/api/**', (route) => {
    const req = route.request(); const u = req.url(); const j = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/api/chat')) {
      const p = JSON.parse(req.postData() || '{}').prompt || ''; let reply = '';
      if (p.includes('"policy":"方針代碼"')) { kinds.campaign++; const n = ((p.split('【候選人】')[1] || '').match(/^\d+\. /gm) || []).length; reply = JSON.stringify(Array.from({ length: n }, (_, i) => ({ n: i + 1, policy: POL[i % 4], speech: '我會先修好水井，再蓋學校。' }))); }
      else if (p.includes('"vote":候選人序號')) { kinds.votes++; const n = ((p.split('【村民】')[1] || '').match(/^\d+\. /gm) || []).length; reply = JSON.stringify(Array.from({ length: n }, (_, i) => ({ n: i + 1, vote: 1 + (i % 2), why: '他平常最照顧大家。' }))); }
      return j({ reply });
    }
    if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); return j({});
  });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.election, null, { timeout: 40000 }); await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg); const wait = (ms) => page.waitForTimeout(ms);

  console.log('第一年秋季開選');
  let r = await ev(() => { const w = window.rimtownApp.world, el = w.election; window.rimtownApp._setPaused?.(true); w.fullAgentMode = false;
    el.active = false; el.phase = 'none'; el.lastElectionDay = 0; el.electionHistory = [];
    w.clock.year = 1; w.clock.season = '秋季'; w.clock.day = 1; el.dailyUpdate(w);
    const first = { active: el.active, phase: el.phase, abs: w._absDay() };
    for (let i = 0; i < 6; i++) el.dailyUpdate(w);
    const last = el.electionHistory[el.electionHistory.length - 1];
    el.active = false; el.phase = 'none'; el.dailyUpdate(w); // 同一天再跑一次:不能重複開
    return { first, done: el.electionHistory.length, lastDay: el.lastElectionDay, histDay: last?.day, again: el.active }; });
  ok(r.first.active && r.first.phase === 'campaign' && r.first.abs === 31, '第一年秋季第 1 天(絕對第 31 天)開始競選', r);
  ok(r.done === 1 && r.lastDay === 31 && r.histDay === 31 && !r.again, '選完記下絕對天數,同一年不會再開', r);

  console.log('競選遇到 AI 冷卻 → 隔天再問');
  r = await ev(async () => { const w = window.rimtownApp.world, el = w.election, L = w.conversationEngine.llm; w.fullAgentMode = true;
    el.active = false; el.phase = 'none'; L._requestTimestamps = []; L._rateLimitedUntil = Date.now() + 10000; L._rateLimitedLen = 10000;
    el.triggerElection(w); await new Promise(r => setTimeout(r, 300));
    const blocked = el.candidates.some(c => c.llm);
    L._rateLimitedUntil = 0; el.dailyUpdate(w); // 競選第 2 天
    for (let i = 0; i < 30 && !el.candidates.some(c => c.llm); i++) await new Promise(r => setTimeout(r, 100));
    return { blocked, after: el.candidates.filter(c => c.llm).length, n: el.candidates.length, phase: el.phase }; });
  ok(!r.blocked && r.after === r.n && r.phase === 'campaign', '冷卻中沒問到,隔天重試後候選人都有 AI 政見', r);
  ok(kinds.campaign === 1, '冷卻期間沒有送出請求,重試只送一次', kinds);

  console.log('投票遇到 AI 冷卻 → 開票前一天再問');
  r = await ev(async () => { const w = window.rimtownApp.world, el = w.election, L = w.conversationEngine.llm;
    L._requestTimestamps = []; L._rateLimitedUntil = Date.now() + 10000; L._rateLimitedLen = 10000;
    while (el.phase === 'campaign') el.dailyUpdate(w); // 進投票,第一輪被冷卻擋下
    await new Promise(r => setTimeout(r, 300));
    const firstWhy = Object.keys(el.voteWhy).length;
    L._rateLimitedUntil = 0; L._requestTimestamps = []; const rs = Math.random; Math.random = () => 0.99; // 規則版這天都先不投
    el.dailyUpdate(w); Math.random = rs;
    for (let i = 0; i < 40 && Object.keys(el._llmPending).length; i++) await new Promise(r => setTimeout(r, 100));
    const why = Object.keys(el.voteWhy).length, voters = el._residents(w).length;
    el.dailyUpdate(w); const last = el.electionHistory[el.electionHistory.length - 1];
    return { firstWhy, why, voters, phase: el.phase, total: last?.totalVotes, quotes: last?.candidates?.reduce((s, c) => s + (c.quotes?.length || 0), 0) }; });
  ok(r.firstWhy === 0 && r.why === r.voters, '第一輪被擋,第二輪全鎮都由 AI 投票並附理由', r);
  ok(r.phase === 'results' && r.total === r.voters && r.quotes > 0, '開票正常,結果帶村民的話', r);

  console.log('研究點與空檔');
  r = await ev(() => { const w = window.rimtownApp.world, R = w.research;
    const key = R.getAvailable()[0]?.key; R.current = null; R._idle = 0;
    R.dailyUpdate(w); const d1 = R.current; R.dailyUpdate(w); const d2 = R.current;
    w.stockpile.add?.('research_points', 50) ?? (w.stockpile.resources.research_points = (w.stockpile.resources.research_points || 0) + 50);
    const p = R.projects[R.current]; const p0 = p.progress, rp0 = w.stockpile.get('research_points');
    const cap = 40 + (w.buildings?.getEffect?.('research_cap', 0) || 0);
    R.dailyUpdate(w); return { key, d1, d2, cap, rp0, used: Math.round(rp0 - w.stockpile.get('research_points')) }; });
  ok(!r.d1 && !!r.d2, '沒人提研究時空 2 天就由學者自己挑', r);
  ok(r.used === Math.min(r.cap, r.rp0), '研究點每天最多用 40(v6.91.0 起;研究院再加)', r);
  console.log('天數換算一致:提案政令、新鎮長施政');
  r = await ev(() => { const w = window.rimtownApp.world, c = w.council, P = w.proposals;
    w.clock.year = 1; w.clock.season = '夏季'; w.clock.day = 3;
    c._formed = true; c.activeDecrees = [];
    P._addDecree(w, { id: 'L999', effects: { mood_modifier: 2 }, kind: 'policy', title: 'x' }, 15);
    const alive = []; for (let i = 0; i < 16; i++) { c.dailyUpdate(w); c.refreshDecrees(w); alive.push(c.activeDecrees.some(d => d.id === 'prop_L999') ? 1 : 0); w.clock.day++; if (w.clock.day > 15) { w.clock.day = 1; w.clock.season = '秋季'; } }
    // 舊檔:舊算法多 60 天的到期日會被扣回來
    w.clock.season = '夏季'; w.clock.day = 3; c.activeDecrees = [{ id: 'old', title: 'old', effects: {}, expiresDay: w._absDay() + 60 + 20 }]; c.refreshDecrees(w); /* v6.87.0 到期與校正搬到 refreshDecrees */
    const oldLeft = c.activeDecrees[0] ? c.activeDecrees[0].expiresDay - w._absDay() : null;
    // 新鎮長施政公告:隔天新聞更新後還在
    const el = w.election; w.news.bulletins = []; el.candidates = [{ name: 'A', agentId: 'a' }]; el._applyPolicyEffects('economy', w);
    w.news.dailyUpdate(w); const pol = w.news.bulletins.find(b => String(b.id).startsWith('election_policy_'));
    return { alive: alive.join(''), oldLeft, polLeft: pol ? pol.daysRemaining : null }; });
  ok(/^1{13,15}0+$/.test(r.alive), '提案政令照天數生效(以前隔天就被刪)', r);
  ok(r.oldLeft === 20, '舊檔多算 60 天的政令到期日被校正', r);
  ok(r.polLeft >= 29, '新鎮長施政公告隔天還在(30 天)', r);

  console.log('文字');
  r = await ev(() => { const w = window.rimtownApp.world; const a = Object.values(w.agents).find(x => !x.isPlayer); const prev = a.activity;
    a.activity = 'heading_home'; const l1 = a.activityLabel; a.activity = 'some_new_code'; const l2 = a.activityLabel; a.activity = prev;
    const html = window.rimtownApp._renderTownHeadlines ? '' : ''; return { l1, l2 }; });
  ok(r.l1 === '準備回家休息' && !/[a-z_]{4,}/.test(r.l2), '活動標籤不露出程式代碼', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
