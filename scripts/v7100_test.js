// v7.1.0 貿易與關稅:私人商行進出口(本地價高於商人價＋關稅才進口、商人收購價高於本地價才出口)、鎮內金流守恆(只有付給／收自外地商人的錢跨出鎮界)、
// 關稅進公庫並擋下不划算的進口、關稅提案(本地生產者支持、商人與窮人反對)、通過生效、經濟頁、AI 簡報、存讀檔;中英、桌機與 390px
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
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; WALLET.S(w); PRICES.S(w); MARKET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const boss = npcs().find(a => a.job?.key === 'trader') || npcs()[1]; w.market.owners.trade = boss.agentId; WALLET.add(w, boss, 500);
      const inTown = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0);
      const mk = (offers) => { w.trade.merchant = { name: '測試商人', offers: offers.map(o => ({ ...o })), daysRemaining: 3, _v71: true }; };
      // 1) 進口:糧價 1.8 倍、商人賣 1.2 → 有賺就進;鎮內銀幣只少「付給商人」的錢,關稅進公庫
      w.prices.idx.food = 1.8; TRADE.S(w).tariff = 0.15; sp.resources.silver = 1000; const food0 = sp.get('food');
      mk([{ resource: 'food', amount: 20, price: 1.2, isBuying: false }]); const t0 = inTown(), tr0 = sp.get('silver'), b0 = WALLET.get(w, boss), duty0 = TRADE.S(w).duty;
      TRADE.privateTrade(w); const q = sp.get('food') - food0; const paidOut = Math.round(q * 1.2 * 100) / 100;
      out.imp = { qty: q, drift: Math.round((inTown() - (t0 - paidOut)) * 100) / 100, duty: Math.round((TRADE.S(w).duty - duty0) * 100) / 100, expDuty: Math.round(q * 1.2 * 0.15 * 100) / 100, bossGain: Math.round((WALLET.get(w, boss) - b0) * 100) / 100 };
      // 2) 關稅擋下不划算的進口:糧價 1.3、商人 1.2,課 15% 後不划算
      w.prices.idx.food = 1.3; mk([{ resource: 'food', amount: 20, price: 1.2, isBuying: false }]); const f1 = sp.get('food'); TRADE.privateTrade(w); out.blocked = sp.get('food') === f1;
      TRADE.S(w).tariff = 0; mk([{ resource: 'food', amount: 20, price: 1.0, isBuying: false }]); const f2 = sp.get('food'); TRADE.privateTrade(w); out.freeImp = sp.get('food') - f2;
      // 3) 出口:糧價 0.6、商人收 1.0 → 出口,外地的錢流進鎮上
      w.prices.idx.food = 0.6; sp.resources.food = 2000; mk([{ resource: 'food', amount: 20, price: 1.0, isBuying: true }]); const t1 = inTown(), f3 = sp.get('food'); TRADE.privateTrade(w); const qe = f3 - sp.get('food');
      out.exp = { qty: qe, drift: Math.round((inTown() - (t1 + qe * 1.0)) * 100) / 100 };
      // 4) 商行公營:不走私人路線
      delete w.market.owners.trade; mk([{ resource: 'food', amount: 20, price: 1.0, isBuying: true }]); out.publicSkip = TRADE.privateTrade(w) === false; w.market.owners.trade = boss.agentId;
      // 5) 關稅提案:便宜進口貨多 → 本地生產者提案;投票:農夫支持、商人反對;通過生效
      const X = TRADE.S(w); X.tariff = 0; X.lastProp = -99; const d = w._absDay(); X.hist = [[d, 1, 'food', 40, 120], [d, 1, 'wheat', 20, 60]]; w.prices.idx.food = 0.7;
      const P = w.proposals; P.items = P.items.filter(p => p.kind !== 'tariff'); TRADE.proposal(w); const pr = P.items.find(p => p.kind === 'tariff'); out.prop = pr ? { rate: pr.newRate, by: w.agents[pr.proposerId]?.job?.key } : null;
      const farmer = npcs().find(a => a.job?.key === 'farmer') || npcs()[2]; const vt = (a, rate) => { let f = 0; for (let i = 0; i < 40; i++) if (TRADE.vote(w, { kind: 'tariff', newRate: rate }, a).v === 'for') f++; return f; };
      if (farmer.job?.key !== 'farmer') farmer.job = new Job('farmer'); WALLET.add(w, farmer, 100);
      out.vote = { farmerFor: vt(farmer, 0.15), bossFor: vt(boss, 0.15), bossRepeal: vt(boss, 0) };
      out.set = TRADE.setTariff(w, 0.15); out.on = TRADE.S(w).tariff === 0.15;
      // 6) AI 簡報、存讀檔
      out.brief = /關稅|tariff/i.test(ConversationEngine.prototype._townBrief.call(Object.create(ConversationEngine.prototype), w));
      const json = JSON.stringify(w.serialize()); w.tradeX = null; w.loadSave(JSON.parse(json)); out.save = TRADE.S(w).tariff;
      return out;
    });
    ok(r.imp.qty >= 2 && Math.abs(r.imp.drift) <= 0.05, '私人商行進口：鎮內銀幣只少了付給外地商人的錢（守恆）', r.imp);
    ok(Math.abs(r.imp.duty - r.imp.expDuty) < 0.02 && r.imp.bossGain > 0, '進口課 15% 關稅進公庫，商行老闆賺差價', r.imp);
    ok(r.blocked && r.freeImp >= 2, '課了關稅就不划算的進口不會進來；沒有關稅才進口', { blocked: r.blocked, free: r.freeImp });
    ok(r.exp.qty >= 2 && Math.abs(r.exp.drift) <= 0.05, '出口：外地商人付的錢流進鎮上（守恆）', r.exp);
    ok(r.publicSkip, '商行公營時由公庫照舊直接交易', r.publicSkip);
    ok(!!r.prop && r.prop.rate === 0.15 && ['farmer', 'cook', 'tailor', 'carpenter'].includes(r.prop.by), '便宜進口貨一多，本地生產者提案課 15% 關稅', r.prop);
    ok(r.vote.farmerFor >= 30 && r.vote.bossFor <= 8 && r.vote.bossRepeal >= 30, '農夫支持關稅；商行老闆反對、支持取消', r.vote);
    ok(r.on && !!r.set, '提案通過後關稅生效', r.set);
    ok(r.brief && r.save === 0.15, 'AI 知道關稅；關稅存讀檔', { brief: r.brief, save: r.save });
    await page.evaluate(() => { const b = document.querySelector('[data-tab="economy"]'); if (b) b.click(); }); await page.waitForTimeout(600);
    const ui = await page.evaluate(() => { const s = document.querySelector('.trade-meta'); return s ? { txt: s.textContent, cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui, '經濟頁有進出口、順逆差與關稅', ui);
    if (lang === 'en' && ui) ok(!ui.cjk.length, '英文沒有中文', ui.cjk.slice(0, 5));
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
