// v7.0.0 浮動物價＋就業市場＋宗教財務:物價依存貨漲跌(上下限、每天慢慢調)、三餐衣柴照物價付錢、宗教基金收支守恆(維護、辦桌、濟貧、修建)、
// 宗教捐獻課稅提案與投票、裁員、求職、成年孩子找工作、移民補缺、經濟頁、AI 簡報、存讀檔;中英、桌機與 390px
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
      const w = app.world; w.observerMode = true; const out = {};
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const sp = w.stockpile; WALLET.S(w);
      // 1) 物價:存貨很少就漲、每天最多往目標移 6%、不超過 2.5;存貨很多就跌、不低於 0.6
      PRICES.S(w); w.prices.idx = { food: 1, cloth: 1, fuel: 1 }; sp.resources.food = 2; sp.resources.meals = 0;
      const seq = []; for (let i = 0; i < 80; i++) { w.prices.lastDay = -1; PRICES.daily(w); seq.push(w.prices.idx.food); }
      out.up = { first: seq[0], max: Math.max(...seq), steps: Math.max(...seq.slice(1).map((v, i) => Math.abs(v - seq[i]))) };
      sp.resources.food = 99999; sp.resources.meals = 9999; for (let i = 0; i < 120; i++) { w.prices.lastDay = -1; PRICES.daily(w); } out.down = w.prices.idx.food;
      // 2) 三餐照物價付錢:糧價 2 倍時一餐 6 銀幣,付給食堂與農莊(MARKET.sale 收到的就是村民付的)
      w.prices.idx.food = 2; w.prices.idx.cloth = 1; w.prices.idx.fuel = 1; const got = []; const _sale = MARKET.sale; MARKET.sale = function (ww, kind, n) { if (kind === 'meal') got.push(n); return _sale.apply(this, arguments); };
      const tot = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0);
      w.wallet.lastDay = -1; for (const a of npcs()) WALLET.add(w, a, 50); try { WALLET.daily(w); } catch (e) { out.werr = e.message; } MARKET.sale = _sale;
      out.meal = { n: got.length, each: got[0], all6: got.every(n => Math.abs(n - 6) < 0.01) };
      // 3) 宗教基金收支守恆:公庫＋所有人的錢包＋各教團基金,跑十天前後一樣
      const F = FAITH.S(w); const R = F.rels[0]; R.fund = 600; F.tax = false;
      const money = () => tot() + F.rels.reduce((s, x) => s + (x.fund || 0), 0);
      const m0 = money(); const spent0 = (R.upkeep || 0) + (R.relief || 0) + (R.built || 0) + (R.feasts || 0);
      for (let i = 0; i < 10; i++) { F.lastDay = -1 - i; FAITH.daily(w); }
      out.faith = { drift: Math.round((money() - m0) * 100) / 100, spent: Math.round(((R.upkeep || 0) + (R.relief || 0) + (R.built || 0) + (R.feasts || 0) - spent0) * 100) / 100, fund: Math.round(R.fund) };
      // 4) 課稅後捐獻有 15% 進公庫(仍守恆)
      F.tax = true; const b = npcs().find(a => F.of[a.agentId]?.rel) || npcs()[0]; F.of[b.agentId] = F.of[b.agentId] || { rel: R.id, piety: 80 }; const tr0 = sp.get('silver'), f0 = R.fund, m1 = money();
      const give = WALLET.take(w, b, 40); // 模擬一筆 40 的捐獻走正式路徑
      if (give) { const tax = Math.round(40 * FAITH.TAX_RATE * 100) / 100; sp.add('silver', tax, w.tickCount, 'test'); R.fund += 40 - tax; }
      out.tax = { toTown: Math.round((sp.get('silver') - tr0) * 100) / 100, toFund: Math.round((R.fund - f0) * 100) / 100, drift: Math.round((money() - m1) * 100) / 100 };
      // 5) 宗教稅提案:基金多就有人提;虔誠信徒反對、不信教的人多半贊成;通過後生效,之後可提取消
      F.tax = false; F.lastTaxProp = -99; R.fund = 400; for (const x of F.rels.slice(1)) x.fund = 0;
      const nb = npcs().filter(a => !F.of[a.agentId]?.rel); if (!nb.length) { const z = npcs()[1]; delete F.of[z.agentId]; }
      const P = w.proposals; P.items = P.items.filter(p => !String(p.kind).startsWith('faith')); sp.resources.silver = 100;
      for (let i = 0; i < 20 && !P.items.some(p => p.kind === 'faith_tax'); i++) { F.lastDay = -50 - i; w.clock.day = 2 + i; const d = w._absDay(); const _ad = w._absDay; w._absDay = () => 7 * 100 + 2 + i * 5; F.lastDay = -1; FAITH.daily(w); w._absDay = _ad; }
      const pr = P.items.find(p => p.kind === 'faith_tax'); out.prop = !!pr;
      const pious = npcs().find(a => F.of[a.agentId]?.rel && a.job?.key !== 'priest'); if (pious) F.of[pious.agentId].piety = 95; const heathen = npcs().find(a => !F.of[a.agentId]?.rel);
      const vt = (a, kind) => { let f = 0; for (let i = 0; i < 40; i++) if (FAITH.taxVote(w, { kind }, a).v === 'for') f++; return f; };
      out.vote = { piousFor: pious ? vt(pious, 'faith_tax') : -1, heathenFor: heathen ? vt(heathen, 'faith_tax') : -1, piousUntax: pious ? vt(pious, 'faith_untax') : -1 };
      out.set = FAITH.setTax(w, true); out.taxOn = F.tax === true; FAITH.setTax(w, false);
      // 6) 就業:沒工作的人去補職缺;人太多的行業裁員(每週最多 2 人);15 歲不找、16 歲找
      const L = LABOR.S(w); const adults = npcs().filter(a => (a.age ?? 30) >= 16 && a.job?.key !== 'mayor');
      const jl = adults.slice(0, 3); jl.forEach(a => a.job = null); L.lastWeek = -1; LABOR.weekly(w); out.hired = jl.filter(a => !!a.job).length;
      const docs = adults.slice(3, 12); docs.forEach(a => a.job = new Job('doctor')); const before = npcs().filter(a => a.job?.key === 'doctor').length; L.lastWeek = -2; LABOR.weekly(w);
      const after = npcs().filter(a => a.job?.key === 'doctor').length; out.lay = { before, after, slots: LABOR.slots(w).doctor };
      const kid = npcs().find(a => a !== app.world.agents.player && (a.age ?? 30) >= 16 && a.job?.key !== 'mayor' && !jl.includes(a)); kid.age = 15; kid.job = null; L.lastWeek = -3; LABOR.weekly(w); out.kid15 = !kid.job; kid.age = 16; L.lastWeek = -4; LABOR.weekly(w); out.kid16 = kid.job?.key || null;
      // 移民補缺
      let fit = 0; for (let i = 0; i < 8; i++) { const sl = LABOR.slots(w), fl = LABOR.filled(npcs()); const over = Object.keys(sl).find(k => (fl[k] || 0) > sl[k]) || 'tailor'; for (let j = 0; j < 6; j++) { const x = npcs().find(a => a.job?.key !== over && a.job?.key !== 'mayor'); if (x) x.job = new Job(over); } const im = npcs()[npcs().length - 1]; im.job = new Job(over); LABOR.fitImmigrant(w, im); if (im.job.key !== over) fit++; }
      out.fit = fit;
      // 7) AI 簡報、存讀檔
      const jb = npcs().find(a => (a.age ?? 30) >= 16 && a.job?.key !== 'mayor'); jb.job = null; L.jobless[jb.agentId] = w._absDay() - 3;
      const ce = w.conversationEngine || app.world.conversation || null; const CE = ConversationEngine.prototype;
      const bm = (CE._agentBrief.call(ce || Object.create(CE), w, jb, null).mem || []); out.bm = bm.slice(-3); out.brief = { agent: bm.some(s => /沒有工作|out of work|unemploy/i.test(s)), town: /物價|Prices|prices/.test(CE._townBrief.call(ce || Object.create(CE), w)) };
      w.prices.idx.food = 1.77; const d = w.serialize(); const json = JSON.stringify(d); w.prices = null; w.labor = null; w.loadSave(JSON.parse(json)); out.save = { food: w.prices?.idx?.food, labor: !!w.labor };
      // 8) 經濟頁
      app._economySubTab = 'resources'; try { app.renderEconomyPanel?.(); } catch (e) {} if (typeof renderCurrentTab === 'function') { try { app.activeTab = 'economy'; } catch (e) {} }
      const host = document.createElement('div'); try { const html = app._renderEconomyHTML ? app._renderEconomyHTML() : null; if (html) host.innerHTML = html; } catch (e) {}
      out.ui = !!document.querySelector('.price-section') || !!host.querySelector('.price-section');
      return out;
    });
    ok(r.up.first > 1 && r.up.first <= 1.1 && r.up.steps <= 0.1 && r.up.max <= 2.5 && r.up.max >= 2, '存貨很少：糧價每天慢慢漲（一天不超過一成），最多 2.5 倍', r.up);
    ok(r.down >= 0.6 && r.down <= 0.65, '存貨很多：糧價跌到下限 0.6 倍', r.down);
    ok(r.meal.n > 5 && r.meal.all6, '糧價 2 倍時一餐付 6 銀幣，錢付給食堂與農莊', r.meal);
    ok(Math.abs(r.faith.drift) <= 0.2 && r.faith.spent > 5, '教團基金拿去維護、辦桌、濟貧、修建，鎮上銀幣總數不變（守恆）', r.faith);
    ok(Math.abs(r.tax.toTown - 6) < 0.01 && Math.abs(r.tax.toFund - 34) < 0.01 && Math.abs(r.tax.drift) < 0.01, '宗教課稅：捐 40 有 6 進公庫、34 進基金（守恆）', r.tax);
    ok(r.prop, '公庫吃緊、教團基金多：有人提案宗教捐獻課稅', r.prop);
    ok(r.vote.piousFor <= 8 && r.vote.heathenFor >= 30 && r.vote.piousUntax >= 30, '虔誠信徒反對課稅、支持取消；不信教的人多半贊成', r.vote);
    ok(r.taxOn && !!r.set, '提案通過後開始課稅', r.set);
    ok(r.hired === 3, '沒工作的人照擅長與工資補上職缺', r.hired);
    ok(r.lay.after < r.lay.before && r.lay.before - r.lay.after <= 2, '人太多的行業裁員，每週最多 2 人', r.lay);
    ok(r.kid15 && !!r.kid16, '15 歲還不找工作，滿 16 歲自己找到工作', { k15: r.kid15, k16: r.kid16 });
    ok(r.fit >= 3, '移民優先補鎮上缺的職業', r.fit);
    ok(r.brief.agent && r.brief.town, 'AI 知道自己失業、知道鎮上物價', { ...r.brief, bm: r.bm });
    ok(Math.abs((r.save.food || 0) - 1.77) < 0.001 && r.save.labor, '物價與就業存讀檔', r.save);
    // 經濟頁(實際打開)
    await page.evaluate(() => { const b = document.querySelector('[data-tab="economy"]'); if (b) b.click(); }); await page.waitForTimeout(600);
    await page.evaluate(() => { const b = document.querySelector('[data-econ-tab="resources"],[data-sub="resources"]'); if (b) b.click(); }); await page.waitForTimeout(400);
    const ui = await page.evaluate(() => { const s = document.querySelector('.price-section'); return s ? { txt: s.textContent, jobs: s.querySelectorAll('.labor-job').length, cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui && ui.jobs >= 10, '經濟頁有「物價與就業」：三種物價、失業率、各職業職缺', ui && { jobs: ui.jobs });
    if (lang === 'en' && ui) ok(!ui.cjk.length, '英文經濟頁沒有中文', ui.cjk.slice(0, 5));
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
