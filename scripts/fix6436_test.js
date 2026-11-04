// v6.43.6 回歸:鎮長用 AI 裁決提案時存檔,讀檔後提案不能永遠卡住;同一局回覆遲遲不來,隔天也照常裁決
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
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

  console.log('全鎮不會因此停止提案');
  r = await page.evaluate(() => { const w = window.rimtownApp.world, P = w.proposals; const before = P.items.length;
    w.conversationEngine.decideMayor = async () => null; w.fullAgentMode = false;
    let d = P._abs(w) + 2; for (let i = 0; i < 8; i++) { P._lastDay = -1; P._generate(w, d + i); P._advance(w, d + i); }
    return { before, after: P.items.length, open: P.open().length }; });
  ok(r.after > r.before, '裁決後空出名額,村民繼續提新案', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
