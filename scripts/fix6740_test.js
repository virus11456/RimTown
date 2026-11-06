// v6.74.0 銀行 P2 回歸:(1) 審貸等待中存讀檔,之後大額貸款仍走 AI 審查(含舊存檔殘留的等待旗標)
// (2) 審貸等待中新建城鎮,舊回覆不會讓新鎮居民多出錢、也不寫日誌;(3) 紓困等待中存讀檔會重問;等太久改規則決定
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
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; WALLET.S(w);
      const tick = () => new Promise(r => setTimeout(r, 20));
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      let D = 501; const _ad = w._absDay; w._absDay = () => D; const out = {};
      // 讓 LLM 回覆由測試控制(走真的 _askJson,才測得到世代檢查)
      let release = null, calls = 0; const llm = { _canMakeRequest: () => true, generate: () => { calls++; return new Promise(res => { release = res; }); } };
      const setup = () => { const CE = w.conversationEngine; CE.llm = llm; CE.fullAgentOk = () => true; w.fullAgentMode = true; WALLET.S(w); TIERS.S(w); w.tierState.lv = 1; w.bank = null; const all = npcs().sort((x, y) => (x.job?.key === 'mayor') - (y.job?.key === 'mayor')); for (const a of all) w.wallet.bal[a.agentId] = 0; w.wallet.bal[all[0].agentId] = 900; all[0].job.key = 'trader'; for (const a of all.slice(1)) if (a.job?.key === 'trader') a.job.key = 'farmer'; D++; BANK.daily(w); const B = w.bank; B.reserve = 500; return { B, all }; };
      // (1) 審貸等待中存讀檔
      let { B, all } = setup(); const borrower = all[3];
      BANK.lend(w, B, borrower, 80, '周轉'); out.waiting = calls === 1 && !B.loans[borrower.agentId];
      const saved = JSON.parse(JSON.stringify(w.serialize())); out.flagNotSaved = !('_asking' in (saved.bank || {}));
      w.loadSave(saved); w.conversationEngine.llm = llm; w.conversationEngine.fullAgentOk = () => true; w.fullAgentMode = true;
      release('{"lend":true}'); await tick(); out.staleDropped = !w.bank.loans[borrower.agentId]; // 讀檔前的回覆作廢
      const b2 = w.agents[borrower.agentId]; const c0 = calls; BANK.lend(w, w.bank, b2, 80, '周轉'); out.askedAgain = calls === c0 + 1;
      release('{"lend":true}'); await tick(); out.loanAfterLoad = !!w.bank.loans[b2.agentId];
      // 舊存檔裡殘留的等待旗標
      const old = JSON.parse(JSON.stringify(w.serialize())); old.bank._asking = true; delete old.bank.loans[b2.agentId]; w.loadSave(old); w.conversationEngine.llm = llm; w.conversationEngine.fullAgentOk = () => true; w.fullAgentMode = true;
      const c1 = calls; BANK.lend(w, w.bank, w.agents[b2.agentId], 80, '周轉'); out.oldFlagCleared = calls === c1 + 1 && !('_asking' in w.bank); release('{"lend":true}'); await tick();
      // (2) 審貸等待中新建城鎮
      ({ B, all } = setup()); const p = all[4]; const id = p.agentId; BANK.lend(w, B, p, 80, '周轉');
      const logN = (w.messageLog || []).length; w._absDay = _ad; w.reset(); w._absDay = () => D; WALLET.S(w);
      const before = w.agents[id] ? WALLET.get(w, w.agents[id]) : null;
      release('{"lend":true}'); await tick(); await tick();
      const after = w.agents[id] ? WALLET.get(w, w.agents[id]) : null;
      out.noMoney = before === after; out.newTownNoLoan = !w.bank || !Object.keys(w.bank.loans || {}).length;
      out.noLog = !(w.messageLog || []).some(m => /貸款|loan/i.test(m.content || ''));
      // 拒絕的回覆也不寫進新城鎮的日誌
      ({ B, all } = setup()); BANK.lend(w, B, all[5], 80, '周轉'); w._absDay = _ad; w.reset(); w._absDay = () => D; release('{"lend":false,"why":"信用太差"}'); await tick();
      out.noRefuseLog = !(w.messageLog || []).some(m => /信用太差/.test(m.content || ''));
      // (3) 紓困等待中存讀檔 → 讀檔後重問(規則)
      ({ B, all } = setup()); const mayor = npcs().find(a => a.job?.key === 'mayor');
      for (const a of all.slice(5, 9)) { w.wallet.bal[a.agentId] = 100; BANK.deposit(w, B, a, 100); } B.reserve = 10; w.wallet.bal[all[0].agentId] = 0;
      BANK.startRun(w, B, D); D++; B.lastDay = null; BANK.daily(w); out.bailPending = B.run?.asked === 'pending';
      const s3 = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(s3); out.pendingCleared = w.bank.run && w.bank.run.asked === null;
      w.fullAgentMode = false; w.stockpile.resources.silver = 1000; mayor && (w.agents[mayor.agentId].personality.traits = ['kind']);
      D++; w.bank.lastDay = null; BANK.daily(w); out.reAsked = !!w.bank.lastBail && w.bank.run?.asked !== 'pending';
      release('{"bailout":false,"why":"x"}'); await tick();
      // 等太久(兩天沒回音)就照規則決定
      ({ B, all } = setup()); for (const a of all.slice(5, 9)) { w.wallet.bal[a.agentId] = 100; BANK.deposit(w, B, a, 100); } B.reserve = 10; w.wallet.bal[all[0].agentId] = 0;
      BANK.startRun(w, B, D); D++; B.lastDay = null; BANK.daily(w); const pend = B.run?.asked === 'pending';
      w.fullAgentMode = false; D += 2; B.lastDay = null; BANK.daily(w); out.timeout = pend && B.run?.asked !== 'pending' && !!B.lastBail;
      release('{"bailout":true,"why":"y"}'); await tick(); out.lateIgnored = B.lastBail?.why !== 'y';
      w._absDay = _ad;
      return out;
    });
    ok(r.waiting && r.flagNotSaved, '審貸等待旗標不會進存檔', r);
    ok(r.staleDropped, '讀檔前送出的審貸回覆作廢', r);
    ok(r.askedAgain && r.loanAfterLoad, '讀檔後大額貸款仍然走 AI 審查', r);
    ok(r.oldFlagCleared, '舊存檔殘留的等待旗標讀檔時清掉', r);
    ok(r.noMoney && r.newTownNoLoan && r.noLog, '審貸等待中新建城鎮：舊回覆不給新鎮居民錢、不留紀錄', r);
    ok(r.noRefuseLog, '舊的拒貸回覆也不寫進新城鎮', r);
    ok(r.bailPending && r.pendingCleared && r.reAsked, '紓困等待中存讀檔：讀檔後重新決定，不會卡住', r);
    ok(r.timeout && r.lateIgnored, '紓困兩天沒回音改照規則，遲到的回覆不再覆蓋', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
