// v6.42.0 鎮長選舉測試:外鎮訪客不能選、鎮長出遠門由代理、永久離開馬上補選、完整智能體由 AI 寫政見演說與投票、
// 前任出遠門回來不會變兩位鎮長、存檔往返、提案分頁選舉卡(390px)。需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, extra) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };
const POL = ['economy', 'welfare', 'culture', 'nature'];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const kinds = { campaign: 0, votes: 0 };
  await page.route('**/api/**', (route) => {
    const req = route.request(); const u = new URL(req.url()); const j = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/api/chat') {
      const p = JSON.parse(req.postData() || '{}').prompt || ''; let reply = '';
      if (p.includes('"policy":"方針代碼"')) { kinds.campaign++; const sec = p.split('【候選人】')[1] || ''; const n = (sec.match(/^\d+\. /gm) || []).length; reply = JSON.stringify(Array.from({ length: n }, (_, i) => ({ n: i + 1, policy: POL[i % 4], speech: `我會讓鎮上每一戶都吃得飽，第 ${i + 1} 件事就是修好水井。` }))); }
      else if (p.includes('"vote":候選人序號')) { kinds.votes++; const nc = ((p.split('【候選人】')[1] || '').split('【村民】')[0].match(/^\d+\. /gm) || []).length; const sec = p.split('【村民】')[1] || ''; const n = (sec.match(/^\d+\. /gm) || []).length; reply = JSON.stringify(Array.from({ length: n }, (_, i) => ({ n: i + 1, vote: i % 3 === 0 ? 2 : 1, why: i % 3 === 0 ? '她說要修水井，這才是實在的。' : '他平常最照顧大家，我信得過。' }))).replace(/"vote":2/g, nc >= 2 ? '"vote":2' : '"vote":1'); }
      return j({ reply });
    }
    if (u.pathname.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } });
    return j({});
  });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.election, null, { timeout: 40000 }); await page.waitForTimeout(1500);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  console.log('外鎮訪客與資格');
  let r = await ev(() => { const w = window.rimtownApp.world; window.rimtownApp._setPaused?.(true); const any = Object.values(w.agents).find(a => !a.isPlayer && a.job?.key !== 'mayor'); const v = Object.create(Object.getPrototypeOf(any)); Object.assign(v, any); v.agentId = 'visit_t1_x'; v.name = '外鎮客'; w.agents[v.agentId] = v; const res = w.election._residents(w); return { hasVisitor: res.some(a => a.agentId === 'visit_t1_x'), n: res.length, mayor: w.election._realMayor(w)?.name }; });
  ok(!r.hasVisitor && r.n > 5, '外鎮訪客不在參選／投票名單', r);
  await ev(() => { delete window.rimtownApp.world.agents['visit_t1_x']; });

  console.log('鎮長出遠門 → 代理');
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; const m = el._realMayor(w); w.events._sendAgentTravelling(w, m, '去市集城談生意', 3); el._checkMayor(w); const cur = el.currentMayor(w); return { mayor: m.name, acting: el.acting, cur: cur?.name, propMayor: w.proposals._mayor(w)?.name, active: el.active, nameOf: globalThis.mayorNameOf(w) }; });
  ok(r.acting && r.acting.reason === 'travel' && r.cur === r.acting.name && r.cur !== r.mayor, '出遠門時指定代理鎮長', r);
  ok(r.propMayor === r.acting.name && r.nameOf === r.acting.name, '提案裁決與提示詞用代理鎮長', r);
  ok(!r.active, '出遠門不辦補選', r);
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; const tr = w.events._travellingAgents.find(x => x.agentData.jobKey === 'mayor'); w.events._travellingAgents = w.events._travellingAgents.filter(x => x !== tr); w.events._returnAgent(w, tr); el._checkMayor(w); return { acting: el.acting, mayor: el._realMayor(w)?.name, back: tr.agentData.name }; });
  ok(!r.acting && r.mayor === r.back, '鎮長回來交還', r);

  console.log('鎮長永久離開 → 代理＋補選（完整智能體）');
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; w.fullAgentMode = true; const m = el._realMayor(w); w.leaveTown(m.agentId, '測試'); el._checkMayor(w); return { gone: m.name, acting: el.acting, active: el.active, by: el.byElection, phase: el.phase, cands: el.candidates.map(c => c.name) }; });
  ok(r.acting && r.acting.reason === 'gone', '沒有鎮長時指定代理', r);
  ok(r.active && r.by && r.phase === 'campaign' && r.cands.length >= 2 && !r.cands.includes(r.gone), '馬上開補選，離開的人不在名單', r);
  await wait(1500);
  r = await ev(() => { const el = window.rimtownApp.world.election; return el.candidates.map(c => ({ n: c.name, pol: c.policy, sp: c.speech, llm: !!c.llm })); });
  ok(r.every(c => c.llm && c.sp.includes('水井')) && new Set(r.map(c => c.pol)).size >= 2, 'AI 替候選人挑政見、寫演說', r);
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; for (let i = 0; i < 3; i++) el.dailyUpdate(w); return el.phase; });
  ok(r === 'voting', '競選三天後進入投票', r);
  await wait(2500);
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; return { votes: Object.keys(el.votes).length, why: Object.keys(el.voteWhy).length, residents: el._residents(w).length, q: el.quotes(w, el.candidates[0].agentId) }; });
  ok(r.votes === r.residents && r.why === r.votes, 'AI 決定全鎮選票並附理由', r);
  ok(r.q.length === 2 && r.q[0].who && r.q[0].why, '候選人支持者原話', r.q);
  // 提案分頁選舉卡(投票中)
  r = await ev(async () => { const app = window.rimtownApp; app.state = app.world.getState(); app.activeTab = 'proposals'; app.renderSidebar(); await new Promise(r => setTimeout(r, 200)); const c = document.querySelector('.el-card'); return { card: !!c, head: c?.querySelector('.el-head')?.textContent, speeches: document.querySelectorAll('.el-speech').length, quotes: document.querySelectorAll('.el-quote').length, acting: document.querySelector('.el-acting')?.textContent, wide: document.documentElement.scrollWidth > window.innerWidth }; });
  ok(r.card && /補選/.test(r.head) && r.speeches >= 2 && r.quotes >= 2 && /代理/.test(r.acting || '') && !r.wide, '提案分頁顯示補選卡、演說、支持者原話、代理鎮長', r);
  { const nav = await page.$$('text=提案'); for (const x of nav) { try { if (await x.isVisible()) { await x.click(); break; } } catch (e) {} } await wait(700); await page.evaluate(() => { document.querySelector('.el-card')?.scrollIntoView({ block: 'start' }); }); await wait(300); }
  await page.screenshot({ path: process.env.SHOT || '/tmp/election_card.png' });
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; let res = null; for (let i = 0; i < 2; i++) res = el.dailyUpdate(w) || res; const m = el._realMayor(w); const last = el.electionHistory[el.electionHistory.length - 1]; return { phase: el.phase, mayor: m?.name, winner: last?.winner?.name, by: last?.byElection, acting: el.acting, mayors: Object.values(w.agents).filter(a => a.job?.key === 'mayor').length, quotes: last?.candidates?.[0]?.quotes?.length }; });
  ok(r.phase === 'results' && r.mayor === r.winner && r.mayors === 1 && r.by === true, '補選結果：當選人成為唯一的鎮長', r);
  ok(!r.acting && r.quotes >= 1, '代理結束、歷史留下支持者原話', r);

  console.log('前任出遠門期間改選 → 回來不會兩位鎮長');
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; el.phase = 'none'; el.active = false; w.fullAgentMode = false; const m = el._realMayor(w); w.events._sendAgentTravelling(w, m, '探親', 3); el._checkMayor(w); el.triggerElection(w); for (let i = 0; i < 6; i++) el.dailyUpdate(w); const newM = el._realMayor(w); const tr = w.events._travellingAgents.find(x => x.agentData.agentId === m.agentId); w.events._travellingAgents = w.events._travellingAgents.filter(x => x !== tr); w.events._returnAgent(w, tr); el._checkMayor(w); return { old: m.name, newM: newM?.name, mayors: Object.values(w.agents).filter(a => a.job?.key === 'mayor').map(a => a.name), oldJob: w.agents[m.agentId]?.job?.key, acting: el.acting, ruleSpeech: el.candidates.every(c => !c.llm) }; });
  ok(r.newM && r.newM !== r.old && r.mayors.length === 1 && r.mayors[0] === r.newM && r.oldJob !== 'mayor', '回來的前任改做別的', r);
  ok(r.ruleSpeech && !r.acting, '關掉完整智能體時用規則版選舉', r);

  console.log('存檔往返');
  r = await ev(() => { const w = window.rimtownApp.world, el = w.election; el.acting = { agentId: 'x', name: '某人', reason: 'travel', mayorName: '甲' }; el.voteWhy = { a: '理由' }; el.byElection = true; const d = JSON.parse(JSON.stringify(el.toDict())); const n = new el.constructor(); n.loadFrom(d); el.acting = null; return { acting: n.acting?.name, why: n.voteWhy?.a, by: n.byElection }; });
  ok(r.acting === '某人' && r.why === '理由' && r.by === true, '代理、理由、補選旗標存檔往返', r);

  console.log('AI calls', JSON.stringify(kinds), 'errors', JSON.stringify(errs.slice(0, 5)));
  ok(kinds.campaign === 1 && kinds.votes >= 2, '選舉 AI 呼叫次數合理（演說 1 次、投票分批）', kinds);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); process.exit(fail ? 1 : 0);
})();
