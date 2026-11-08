// v6.74.0 擠兌紓困與債券:銀行家先自掏腰包、發債券、鎮長(規則／AI)決定紓困、鎮公所背債每天還、還不出加罰息、
// 債券到期付息或違約、平時準備金太低也發債、鎮長自己有存款會變成祕密、畫面(中英)、AI 知道鎮上欠債、存讀檔
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
      const logHas = (re, n = 40) => (w.messageLog || []).slice(-n).some(m => re.test(m.content || ''));
      const memHas = (a, re) => (a.memory.entries || []).slice(-8).some(m => re.test(m.text ? m.text() : m.content));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; let asked = null; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async (p) => { asked = p; return resp; }; return { restore: () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }, prompt: () => asked }; };
      const setAff = (a, b, v) => { const R = a.relationships.getOrCreate(b.agentId, b.name); R.affinity = v; };
      w.fullAgentMode = false; // 規則路徑;AI 路徑另外 stub
      let D = 401; const _ad = w._absDay; w._absDay = () => D; const out = {};
      const all = npcs(); const mayor = all.find(a => a.job?.key === 'mayor'); out.hasMayor = !!mayor;
      const rich = all.find(a => a !== mayor); const others = all.filter(a => a !== mayor && a !== rich);
      const savers = others.slice(0, 4), buyers = others.slice(4, 6), rest = others.slice(6);
      const step = (v = 0.01) => { D++; fix(v, () => { w.bank.lastDay = null; BANK.daily(w); }); };
      function fresh() {
        w.tierState.lv = 1; w.bank = null; for (const a of all) w.wallet.bal[a.agentId] = 0;
        w.wallet.bal[rich.agentId] = 800; rich.job.key = 'trader'; for (const a of others) if (a.job?.key === 'trader') a.job.key = 'farmer';
        D++; BANK.daily(w); const B = w.bank; B.reserve = 0;
        for (const a of savers) { w.wallet.bal[a.agentId] = 100; BANK.deposit(w, B, a, 100); }
        B.reserve = 20; w.wallet.bal[rich.agentId] = 50; mayor.personality.traits = ['kind']; setAff(mayor, rich, 0);
        w.stockpile.resources.silver = 1000; return B;
      }
      // A:銀行家自掏腰包 → 債券 → 規則紓困 → 撐過擠兌
      let B = fresh(); out.banker = B.banker === rich.agentId;
      for (const a of buyers) { w.wallet.bal[a.agentId] = 200; setAff(a, rich, 40); }
      BANK.startRun(w, B, D); step();
      out.inject = logHas(/掏出自己的|of their own/) && WALLET.get(w, rich) < 50;
      out.bonds = B.bonds.length === 2 && B.bonds.every(x => x.rate === 0.12 && x.due === x.issued + 30) && logHas(/發行債券|issued bonds/);
      out.bondMem = memHas(buyers[0], /債券|bonds/);
      out.bail = !!B.debt && B.debt.owed > 0 && B.lastBail?.yes && logHas(/決定紓困|decided on a bailout/);
      out.interest = B.debt && Math.abs(B.debt.owed - Math.round(B.debt.borrowed * 1.1)) <= 1;
      out.saverThanks = memHas(savers[0], /救了銀行|saved the bank/);
      for (let i = 0; i < 4; i++) step(0.99); out.survived = B.status === 'ok' && B.open && B.bonds.length === 2;
      // townBrief 與畫面
      out.townBrief = CE._townBrief(w); out.bondBrief = JSON.stringify(CE._agentBrief(w, buyers[0], null)); out.chip = BANK.chip(w, buyers[0]);
      app.state = w.getState(); let box = document.createElement('div'); document.body.appendChild(box); app.activeTab = 'industry'; app.renderEconomy(box); /* v7.3.0 搬到小鎮 › 產業 */ out.ui = box.querySelector('.pp-bank')?.innerText || ''; box.remove();
      // 債券到期:準備金夠 → 連本帶利;不夠 → 違約
      const bd = B.bonds[0]; const h = w.agents[bd.holder]; const c0 = WALLET.get(w, h); B.reserve = 1000; bd.due = D + 1; step(0.99);
      out.bondPaid = Math.round(WALLET.get(w, h) - c0) === Math.round(bd.n * 1.12) && !B.bonds.includes(bd);
      const bd2 = B.bonds[0]; bd2.due = D + 1; B.reserve = 3; step(0.99); out.bondDefault = B.defaults === 1 && logHas(/付不出|couldn't pay/);
      // 平時準備金太低也發債(利息 8%)
      for (const a of savers) { w.wallet.bal[a.agentId] = 100; BANK.deposit(w, B, a, 100); } for (const a of buyers) w.wallet.bal[a.agentId] = 200; B.reserve = 10; B.lastIssue = -99; step(0.01);
      out.normalBond = B.bonds.length > 0 && B.bonds.every(x => x.rate === 0.08);
      // 紓困債:每天還 3%;公庫沒錢加罰息;還清
      const o0 = B.debt.owed; w.stockpile.resources.silver = 1000; step(0.99); out.repay = B.debt.owed < o0 && B.debt.paid > 0;
      const o1 = B.debt.owed; w.stockpile.resources.silver = 0; step(0.99); out.late = B.debt.owed > o1 && B.debt.late === 1 && logHas(/還不出紓困債|couldn't make the bailout/);
      B.debt.owed = 2; w.stockpile.resources.silver = 100; step(0.99); out.paidOff = !B.debt && logHas(/還清|paid off/) && !!B.debtHist?.length;
      // 規則:已經背債就不再紓困
      B.debt = { owed: 300, borrowed: 270, paid: 0, since: D, late: 0 }; const rb = BANK.ruleBailout(w, B, mayor, 100); out.ruleNo = !rb.yes && /債|debt/.test(t(rb.why)); B.debt = null;
      // C:AI 決定紓困(提示詞有缺口與利息)
      B = fresh(); for (const a of others.slice(4)) w.wallet.bal[a.agentId] = 0;
      let s = stubAI({ bailout: true, why: '救人要緊' }); BANK.startRun(w, B, D); step();
      out.pending = B.run?.asked === 'pending' && logHas(/暫停營業|closed its doors/);
      await new Promise(r => setTimeout(r, 30)); s.restore();
      out.aiYes = B.lastBail?.yes && B.lastBail.why === '救人要緊' && !!B.debt; out.prompt = /紓困|bail/i.test(s.prompt() || '') && /JSON/.test(s.prompt() || '');
      // 鎮長自己有存款 → 真相頁祕密
      B = fresh(); w.wallet.bal[mayor.agentId] = 100; BANK.deposit(w, B, mayor, 80); B.reserve = 10; const n0 = (w.dark?.secrets || []).length;
      BANK.startRun(w, B, D); step(); out.secret = B.lastBail?.yes && (w.dark?.secrets || []).slice(n0).some(x => /紓困也救了自己的錢/.test(x.k));
      // B:AI 拒絕 → 倒閉,存戶怪鎮長
      B = fresh(); w.wallet.bal[rich.agentId] = 0; for (const a of savers) setAff(a, mayor, 0);
      s = stubAI({ bailout: false, why: '銀行家自己活該' }); BANK.startRun(w, B, D); step(); await new Promise(r => setTimeout(r, 30)); s.restore();
      out.aiNo = B.lastBail && !B.lastBail.yes && logHas(/拒絕紓困|refused to bail/);
      step(0.01); out.failed = B.status === 'failed' && !B.open;
      out.blame = (savers[0].relationships.relationships[mayor.agentId]?.affinity || 0) <= -10 && memHas(savers[0], /見死不救|left the bank to die/);
      // 存讀檔
      B.debt = { owed: 77, borrowed: 70, paid: 0, since: D, late: 0 }; B.bonds = [{ id: 'BDx', holder: buyers[0].agentId, n: 30, rate: 0.08, issued: D, due: D + 30 }];
      box = document.createElement('div'); document.body.appendChild(box); app.state = w.getState(); app.activeTab = 'industry'; app.renderEconomy(box); out.ui2 = box.querySelector('.pp-bank')?.innerText || ''; box.remove();
      w._absDay = _ad;
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.bank?.debt?.owed === 77 && w2.bank.bonds.length === 1; w2.reset(); out.reset = !w2.bank;
      return out;
    });
    ok(r.hasMayor && r.banker, '有鎮長、最有錢的商人當銀行家', r);
    ok(r.inject, '擠兌時銀行家先拿自己的錢補', r);
    ok(r.bonds && r.bondMem, '銀行家發行債券（擠兌時利息 12%、三十天到期），信任他的人買', r);
    ok(r.bail && r.interest && r.saverThanks, '還不夠就由鎮長紓困：向外地錢莊借錢，鎮公所背債（含一成利息），存戶感謝', r);
    ok(r.survived, '紓困後撐過擠兌，債券的錢鎖著領不走', r);
    ok(/紓困|bailing out/.test(r.townBrief), 'AI 知道鎮公所欠紓困債', r.townBrief.slice(-120));
    ok(/債券|bonds/.test(r.bondBrief) && /📜/.test(r.chip), 'AI 與角色卡知道自己買了債券', { b: r.bondBrief.slice(-100), c: r.chip });
    ok(/📜/.test(r.ui) && /🛟/.test(r.ui) && /🏛️/.test(r.ui), '產業頁顯示債券、紓困、鎮公所背債', r.ui);
    ok(r.bondPaid && r.bondDefault, '債券到期連本帶利付清；準備金不夠就違約', r);
    ok(r.normalBond, '平時準備金太低也會發債（利息 8%）', r);
    ok(r.repay && r.late && r.paidOff, '紓困債每天從公庫還，還不出加罰息，還清有紀錄', r);
    ok(r.ruleNo, '已經背債的鎮公所不再紓困', r);
    ok(r.pending && r.aiYes && r.prompt, '完整智能體模式由鎮長 AI 決定（等待時銀行暫停一天）', r);
    ok(r.secret, '鎮長自己有存款還紓困 → 真相頁祕密', r);
    ok(r.aiNo && r.failed && r.blame, '鎮長拒絕紓困 → 銀行倒閉，存戶怪鎮長', r);
    ok(/🏛️/.test(r.ui2) && (lang === 'zh' ? /鎮公所紓困債/.test(r.ui2) : /bailout debt/i.test(r.ui2)), '倒閉後產業頁仍顯示要還的債（' + lang + '）', r.ui2);
    ok(r.rt && r.reset, '紓困債與債券存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
