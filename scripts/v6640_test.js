// v6.64.0 銀行:城鎮才開、銀行家、存款與利息、借款與還款、翻修借錢、呆帳、利率(規則／AI)、謠言擠兌、撐過或倒閉、AI 知道自己的存款與欠款、畫面、存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      let D = 301; const _ad = w._absDay; w._absDay = () => D; const out = {};
      w.tierState.lv = 0; w.bank = null; BANK.daily(w); out.villageClosed = !w.bank.open;
      w.tierState.lv = 1; const all = npcs(); const rich = all[0]; w.wallet.bal[rich.agentId] = 600; rich.job.key = 'trader'; for (const a of all.slice(1)) if (a.job?.key === 'trader') a.job.key = 'farmer';
      D++; BANK.daily(w); const B = w.bank; out.open = B.open && B.banker === rich.agentId && logHas(/銀行|bank/i); out.seed = B.reserve > 0;
      // 存款
      const saver = all[1]; saver.personality.traits = [...saver.personality.traits, 'stoic']; w.wallet.bal[saver.agentId] = 300;
      D++; fix(0.01, () => { B.lastDay = null; BANK.daily(w); }); out.deposit = (B.dep[saver.agentId] || 0) > 0 && WALLET.get(w, saver) < 300;
      // 利息(第 7 的倍數天)
      const dv0 = B.dep[saver.agentId]; B.earned = (B.earned || 0) + 50; /* v6.90 存款利息由放款賺到的利息支付 */ D = 308; fix(0.99, () => { B.lastDay = null; BANK.daily(w); }); out.interest = B.dep[saver.agentId] > dv0;
      // 借款與還款
      const poor = all[2]; w.wallet.bal[poor.agentId] = 0; D++; fix(0.01, () => { B.lastDay = null; BANK.daily(w); });
      out.loan = !!B.loans[poor.agentId] && WALLET.get(w, poor) > 0; const owed0 = B.loans[poor.agentId]?.owed || 0;
      w.wallet.bal[poor.agentId] = 100; D++; fix(0.99, () => { B.lastDay = null; BANK.daily(w); }); out.repay = !B.loans[poor.agentId] || B.loans[poor.agentId].owed < owed0;
      // 呆帳
      const deadbeat = all[3]; delete B.loans[deadbeat.agentId]; B.reserve += 100; BANK.lend(w, B, deadbeat, 20, '周轉'); B.loans[deadbeat.agentId].due = D - 20; w.wallet.bal[deadbeat.agentId] = 0;
      D++; fix(0.99, () => { B.lastDay = null; BANK.daily(w); }); out.bad = !B.loans[deadbeat.agentId] && B.bad > 0 && logHas(/呆帳|bad debt/);
      // 利率(AI)
      const _fa = w.fullAgentMode, _ok = CE.fullAgentOk, _aj = CE._askJson; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => ({ rate: 15, why: '風險變高了' });
      await BANK.setRate(w, B); out.aiRate = Math.round(B.rate * 100) === 15 && B.rateWhy === '風險變高了';
      w.fullAgentMode = _fa; CE.fullAgentOk = _ok; CE._askJson = _aj;
      // 畫面與 AI
      out.brief = JSON.stringify(CE._agentBrief(w, saver, null)); out.chip = BANK.chip(w, saver);
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-bank')?.innerText || ''; box.remove();
      // 擠兌撐過
      const keep = JSON.parse(JSON.stringify(B)); B.reserve += 5000; BANK.startRun(w, B, D); out.run = B.status === 'run' && logHas(/擠|withdraw/i);
      for (let i = 0; i < 4; i++) { D++; fix(0.01, () => { B.lastDay = null; BANK.daily(w); }); } out.survived = B.status === 'ok' && B.open;
      // 擠兌倒閉:準備金不夠
      for (const a of all.slice(4, 8)) { w.wallet.bal[a.agentId] = 200; BANK.deposit(w, B, a, 100); } B.reserve = 30; BANK.startRun(w, B, D); B.run.injected = -1; B.run.bonds = -1; B.run.asked = 'no'; // v6.74.0 沒人救(銀行家、債券、紓困都沒有)
      D++; fix(0.01, () => { B.lastDay = null; BANK.daily(w); }); out.failed = B.status === 'failed' && !B.open && logHas(/倒閉|collapsed/);
      out.angry = (all[5].memory.entries || []).slice(-6).some(m => /銀行倒了|bank failed/.test(m.text ? m.text() : m.content));
      w._absDay = _ad;
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.bank?.status === 'failed'; w2.reset(); out.reset = !w2.bank;
      return out;
    });
    ok(r.villageClosed, '村莊沒有銀行', r);
    ok(r.open && r.seed, '升格城鎮後最有錢的商人開銀行、出本錢', r);
    ok(r.deposit && r.interest, '謹慎的人把錢存進銀行，每七天有利息', r);
    ok(r.loan && r.repay, '手頭緊的人借錢周轉，之後從收入還款', r);
    ok(r.bad, '逾期還不出來變呆帳', r);
    ok(r.aiRate, '完整智能體模式由銀行家 AI 決定利率', r);
    ok(/銀行|Bank/.test(r.brief) && /🏦/.test(r.chip), 'AI 與角色卡知道自己的存款與欠款', { b: r.brief.slice(-120), c: r.chip });
    ok(/🏦/.test(r.ui) && /利率|rate/.test(r.ui), '鎮況頁有銀行狀況', r.ui);
    ok(r.run && r.survived, '謠言引發擠兌，準備金夠就撐得過', r);
    ok(r.failed && r.angry, '準備金不夠就倒閉，存戶血本無歸', r);
    ok(r.rt && r.reset, '銀行存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
