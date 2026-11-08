// v7.7.2 罰款付不出來:家人代繳(感情好才願意,拒絕的話關係變差)、欠款從工資分期扣(手頭寬裕就扣清)、
// 欠兩週改服公共勞役(要服之前家人還有最後一次機會;服勞役沒工資、做工抵債)、大赦一筆勾銷、判決罰款走新流程、
// 村民卡顯示欠多少／服勞役、AI 簡報、存讀檔、全程銀幣守恆(中英、桌機與 390px)
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; WALLET.S(w); MARKET.S(w); DARK.S(w); const R0 = Math.random;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = npcs().filter(a => (a.age ?? 30) >= 18);
      const T = () => MONEY.total(w); const bal = (a) => Math.round(WALLET.get(w, a) * 100) / 100; const setBal = (a, n) => { w.wallet.bal[a.agentId] = n; };
      const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const F = () => MONEY.S(w).fines || {}; let drift = 0; const M_ = (f) => { const t0 = T(); const r = f(); drift += T() - t0; return r; }; /* 只量罰款相關動作前後的總數 */ const clearFam = (a) => { a._parentNames = []; for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married') r.status = null; };
      const [A, B, C, D, E] = adults; for (const x of [A, B, C, D, E]) clearFam(x); const T0 = T();
      // 1) 付得起:當場付清,進公庫
      setBal(A, 100); let s0 = w.stockpile.get('silver'); const r1 = M_(() => MONEY.fine(w, A, 30, t('罰款')));
      out.full = { paid: r1.paid, owed: r1.owed, tre: Math.round(w.stockpile.get('silver') - s0), noDebt: !F()[A.agentId] };
      // 2) 付不起、沒有家人:付多少算多少,剩下記欠款;村民卡與 AI 簡報看得到
      setBal(B, 10); const r2 = M_(() => MONEY.fine(w, B, 30, t('罰款')));
      out.part = { paid: r2.paid, owed: r2.owed, debt: MONEY.owedOf(w, B), chip: MONEY.fineChip(w, B), brief: MONEY.fineBrief(w, B) };
      // 3) 工資分期扣三成;手頭寬裕就一次扣清(留 30 過日子)
      B.job = new Job('farmer'); setBal(B, 5); const d0 = MONEY.owedOf(w, B); M_(() => MONEY.finesDaily(w)); const step = Math.round((d0 - MONEY.owedOf(w, B)) * 100) / 100;
      setBal(B, 200); M_(() => MONEY.finesDaily(w)); out.garnish = { step, expect: Math.round(WALLET.wageOf(B) * 0.3 * 100) / 100, clearedWhenRich: !F()[B.agentId], left: bal(B) };
      // 4) 家人代繳:感情好的配偶有錢就幫忙付
      const sp = B; clearFam(C); C.relationships.getOrCreate(sp.agentId, sp.name).status = 'married'; sp.relationships.getOrCreate(C.agentId, C.name).status = 'married'; sp.relationships.getOrCreate(C.agentId, C.name).affinity = 90;
      setBal(C, 0); setBal(sp, 500); const spB = bal(sp); M_(() => fix(0.01, () => MONEY.fine(w, C, 30, t('罰款'))));
      out.famPay = { spousePaid: Math.round((spB - bal(sp)) * 100) / 100, noDebt: !F()[C.agentId] };
      // 5) 家人不肯幫:關係變差,欠款照記
      const aff0 = C.relationships.getOrCreate(sp.agentId, sp.name).affinity; setBal(sp, 500); M_(() => fix(0.99, () => MONEY.fine(w, C, 30, t('罰款'))));
      out.famNo = { affDrop: Math.round(aff0 - C.relationships.getOrCreate(sp.agentId, sp.name).affinity), debt: MONEY.owedOf(w, C), spouseKept: bal(sp) === 500 };
      // 6) 欠兩週:家人最後一次機會(這次也拒絕) → 改服勞役;服勞役沒工資,每天做工抵 6 銀幣,抵完就結束
      setBal(C, 0); C.job = new Job('guard'); F()[C.agentId].since = w._absDay() - 14; fix(0.99, () => MONEY.finesDaily(w));
      const lab = (w.dark.labor || []).find(x => x.id === C.agentId);
      out.labor = { started: !!lab, asked: !!F()[C.agentId]?.askedFamily, inLabor: MONEY.inLabor(w, C), set: MONEY.laborSet(w).has(C.agentId), chip: MONEY.fineChip(w, C), brief: MONEY.fineBrief(w, C), owed: MONEY.owedOf(w, C) };
      // 服勞役那天公庫不發他薪水(同職業的人照領)
      clearFam(D); D.job = new Job('guard'); w.stockpile.resources.silver = Math.max(w.stockpile.get('silver'), 2000); setBal(sp, 0); setBal(C, 50); setBal(D, 50); const cB = bal(C), dB = bal(D); out.labor.net = Math.round(WALLET.netOf(WALLET.S(w), D) * 100) / 100;
      WALLET.daily ? (WALLET.S(w).lastDay = -1, WALLET.daily(w)) : null; out.labor.wageC = Math.round((bal(C) - cB) * 100) / 100; out.labor.wageD = Math.round((bal(D) - dB) * 100) / 100;
      let n = 0; while (F()[C.agentId] && n++ < 15) MONEY.finesDaily(w); out.labor.workedOff = !F()[C.agentId] && n <= 6;
      // 7) 大赦:勞役名單被清掉 → 欠款一筆勾銷
      setBal(D, 0); MONEY.fine(w, D, 30, t('罰款')); F()[D.agentId].since = w._absDay() - 14; fix(0.99, () => MONEY.finesDaily(w)); const wasLabor = MONEY.inLabor(w, D);
      w.dark.labor = []; MONEY.finesDaily(w); out.amnesty = { wasLabor, forgiven: !F()[D.agentId] };
      // 8) 判決罰款走新流程(被告沒錢 → 欠款)
      setBal(E, 0); clearFam(E); DARK.punish(w, w.proposals, { pen: 'fine', culprit: E.agentId, victim: A.agentId }); out.verdict = { debt: MONEY.owedOf(w, E) };
      // 9) 存讀檔
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { debt: w2.money?.fines?.[E.agentId]?.owed };
      // 10) 銀幣守恆:罰款、分期、家人代繳都只是在錢包與公庫之間移動(勞役抵的是欠款,不是錢)
      out.money = { drift: Math.round(drift * 100) / 100 };
      // 11) 村民卡顯示
      app.state = w.getState(); app._showNpcCard(E.agentId); await new Promise(r => setTimeout(r, 300));
      const card = document.getElementById('npc-quick-card'); out.card = { chip: [...card.querySelectorAll('.nqc-chip')].map(c => c.textContent).find(x => /⚖️/.test(x)) || '' };
      return out;
    });
    ok(r.full.paid === 30 && r.full.owed === 0 && r.full.tre === 30 && r.full.noDebt, '付得起：當場付清，進公庫', r.full);
    ok(r.part.paid === 10 && r.part.owed === 20 && r.part.debt === 20 && /20/.test(r.part.chip) && /20/.test(r.part.brief), '付不起：付多少算多少，剩下記成欠款（村民卡與 AI 簡報看得到）', r.part);
    ok(Math.abs(r.garnish.step - r.garnish.expect) < 0.02 && r.garnish.clearedWhenRich && r.garnish.left >= 30, '欠款每天從工資扣三成；手頭寬裕就一次扣清（留 30 過日子）', r.garnish);
    ok(r.famPay.spousePaid === 30 && r.famPay.noDebt, '家人代繳：感情好的配偶有錢就幫忙付', r.famPay);
    ok(r.famNo.affDrop >= 8 && r.famNo.debt === 30 && r.famNo.spouseKept, '家人不肯幫：關係變差，欠款照記', r.famNo);
    ok(r.labor.started && r.labor.asked && r.labor.inLabor && r.labor.set && /⛏️/.test(r.labor.chip) && r.labor.brief.length > 3, '欠兩週還不完：家人有最後一次機會，不幫就改服公共勞役', r.labor);
    ok(r.labor.wageC <= 0 && Math.abs((r.labor.wageD - r.labor.wageC) - r.labor.net) <= 6.5 && r.labor.workedOff, '服勞役那幾天沒有工資（同職業的人照領），做工抵債，抵完就結束', r.labor);
    ok(r.amnesty.wasLabor && r.amnesty.forgiven, '大赦清掉勞役，欠款一筆勾銷', r.amnesty);
    ok(r.verdict.debt === 30 && r.save.debt === 30, '判決罰款付不出也記成欠款；存讀檔保留', { v: r.verdict, s: r.save });
    ok(Math.abs(r.money.drift) < 0.01, '罰款、分期、家人代繳全程銀幣守恆', r.money);
    ok(/30/.test(r.card.chip) && (lang === 'zh' ? /欠公庫罰款/.test(r.card.chip) : /fines/.test(r.card.chip) && !/[一-鿿]/.test(r.card.chip)), '村民卡顯示欠多少（英文沒有中文）', r.card);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
