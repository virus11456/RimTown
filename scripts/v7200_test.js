// v7.2.0 景氣循環、公共支出、反壟斷:景氣隨消費與衝擊移動(有上下限)、繁榮物價略漲／私人職缺多、公庫富裕公職多、公共工程付給本地承包商(守恆)、
// 公庫太多有人提案減稅、壟斷(三家以上)被提案拆分(工會支持、壟斷者與收過獻金的人反對)、拆分照市價賣(守恆;沒人買由公庫收購)、銀行放款隨景氣、AI 簡報、存讀檔、經濟頁
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
      const inTown = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0);
      // 1) 景氣:消費一直變多 → 往繁榮走;壞消息衝擊 → 往衰退走;都在 -1～1
      const C = CYCLE.S(w); C.c = 0; C.spent = []; C.shock = null; let day0 = w._absDay(); const _ad = w._absDay; let dd = 0; w._absDay = () => day0 + dd;
      for (let i = 0; i < 60; i++) { dd++; w.wallet.stats.spent = (w.wallet.stats.spent || 0) + 50 * Math.pow(1.04, i); C.lastDay = -1; CYCLE.daily(w); }
      out.boom = C.c;
      C.shock = { k: '傳出外地戰事，商人不敢上路', amt: -0.9, until: day0 + dd + 999 }; for (let i = 0; i < 60; i++) { dd++; w.wallet.stats.spent += 50; C.lastDay = -1; CYCLE.daily(w); }
      out.bust = C.c; out.bounded = C.c >= -1 && out.boom <= 1; w._absDay = _ad; C.shock = null;
      // 2) 景氣影響:物價目標、私人職缺;公庫富裕時公職多
      C.c = 0.9; const s1 = LABOR.slots(w); C.c = -0.9; const s0 = LABOR.slots(w); out.slots = { farmerBoom: s1.farmer, farmerBust: s0.farmer };
      w.prices.idx.food = 1; sp.resources.food = 9999; C.c = 0.9; w.prices.lastDay = -1; PRICES.daily(w); const pBoom = w.prices.idx.food; w.prices.idx.food = 1; C.c = -0.9; w.prices.lastDay = -1; PRICES.daily(w); const pBust = w.prices.idx.food; out.price = { pBoom, pBust };
      C.c = 0; sp.resources.silver = 100; const g0 = LABOR.slots(w).guard; sp.resources.silver = 99999; const g1 = LABOR.slots(w).guard; out.pub = { g0, g1 };
      // 3) 公共工程:公庫超過的部分撥給本地承包商,鎮內銀幣總數不變
      const pop = npcs().length; const ownersBefore = { ...w.market.owners }; ['timber', 'mine', 'forge'].forEach((k, i) => { w.market.owners[k] = npcs()[3 + i].agentId; }); sp.resources.silver = pop * 40 + 200 + 1000; const t0 = inTown(), s0b = sp.get('silver'); C.works = 0; CYCLE.publicWorks(w, C, pop);
      out.works = { spent: Math.round(s0b - sp.get('silver')), drift: Math.round((inTown() - t0) * 100) / 100, logged: C.works }; w.market.owners = ownersBefore;
      // 4) 公庫太多:有人提案減稅
      const P = w.proposals; P.items = P.items.filter(p => p.kind !== 'tax' && p.kind !== 'antitrust'); w.wallet.tax = 0.15; C.lastTaxProp = -99; sp.resources.silver = pop * 100;
      for (const a of npcs().slice(0, 4)) WALLET.add(w, a, 200);
      const _ad2 = w._absDay; w._absDay = () => 7 * 50 + 5; C.lastDay = -1; CYCLE.daily(w); w._absDay = _ad2;
      const tp = P.items.find(p => p.kind === 'tax'); out.taxProp = tp ? { dir: tp.dir, newTax: tp.newTax } : null;
      // 5) 反壟斷:一人擁有三家 → 有人提案;投票;拆分照市價(守恆)
      const mono = npcs().find(a => a.job?.key === 'trader') || npcs()[1]; for (const k of ['farm', 'kitchen', 'textile']) w.market.owners[k] = mono.agentId;
      C.lastProp = -99; P.items = P.items.filter(p => p.kind !== 'antitrust'); w._absDay = () => 7 * 60 + 5; C.lastDay = -1; CYCLE.daily(w); w._absDay = _ad2;
      const ap = P.items.find(p => p.kind === 'antitrust'); out.anti = ap ? { ref: ap.refKey === mono.agentId } : null;
      const worker = npcs().find(a => a.agentId !== mono.agentId && a.job && !MARKET.ownedBy(w, a.agentId).length); w.union = w.union || { on: true, members: {} }; w.union.on = true; w.union.members = w.union.members || {}; w.union.members[worker.agentId] = 1; WALLET.S(w).bal[worker.agentId] = 10;
      const pol = npcs().find(a => a !== worker && a !== mono && !MARKET.ownedBy(w, a.agentId).length); POWER.S(w).inf[pol.agentId] = { [mono.agentId]: 50 };
      const vt = (a) => { let f = 0; for (let i = 0; i < 40; i++) if (CYCLE.antitrustVote(w, { refKey: mono.agentId }, a).v === 'for') f++; return f; };
      out.vote = { worker: vt(worker), mono: vt(mono), pol: vt(pol) };
      const buyer = npcs().find(a => a !== mono && a !== worker && !MARKET.ownedBy(w, a.agentId).length && a !== pol); WALLET.S(w).bal[buyer.agentId] = 99999;
      const t1 = inTown(), m0 = WALLET.get(w, mono); const res = CYCLE.split(w, { refKey: mono.agentId }); out.split = { res: !!res, monoNow: MARKET.ownedBy(w, mono.agentId).length, monoGain: Math.round(WALLET.get(w, mono) - m0), drift: Math.round((inTown() - t1) * 100) / 100 };
      // 沒人買得起 → 公庫收購(守恆)
      for (const k of ['farm', 'kitchen', 'textile']) w.market.owners[k] = mono.agentId; for (const id of Object.keys(w.wallet.bal)) if (id !== mono.agentId) w.wallet.bal[id] = 1; sp.resources.silver = 99999;
      out.law = { on: !!w.cycle.law, can: (() => { const x = npcs().find(a => a !== mono); for (const k of ['forge', 'mine', 'timber']) w.market.owners[k] = x.agentId; const n = MARKET.ownedBy(w, x.agentId).length; for (const k of ['forge', 'mine', 'timber']) delete w.market.owners[k]; return n; })() };
      const t2 = inTown(); const res2 = CYCLE.split(w, { refKey: mono.agentId }); out.nat = { res: !!res2, drift: Math.round((inTown() - t2) * 100) / 100, pub: Object.values(w.market.owners).filter(x => x === mono.agentId).length };
      // 6) 銀行放款隨景氣
      const B = { reserve: 1000, loans: {}, rate: 0.08, deposits: {} }; const ln = npcs().find(a => a.job); let got = 0; const _add = WALLET.add; WALLET.add = function (ww, a, n) { if (a === ln) got = n; return _add.apply(this, arguments); };
      C.c = 0.9; try { BANK.lend(w, Object.assign(BANK.S(w), { reserve: 5000, loans: {} }), ln, 40, 'test'); } catch (e) {} const gb = got; got = 0; C.c = -0.9; try { BANK.lend(w, Object.assign(BANK.S(w), { reserve: 5000, loans: {} }), ln, 40, 'test'); } catch (e) {} WALLET.add = _add; out.bank = { boom: gb, bust: got };
      // 7) AI 簡報、存讀檔
      C.c = -0.5; out.brief = /景氣|economy|Economy/.test(ConversationEngine.prototype._townBrief.call(Object.create(ConversationEngine.prototype), w));
      const json = JSON.stringify(w.serialize()); w.cycle = null; w.loadSave(JSON.parse(json)); out.save = CYCLE.S(w).c;
      return out;
    });
    ok(r.boom > 0.3 && r.bust < -0.3 && r.bounded, '景氣：消費一直變多就繁榮，壞消息衝擊就衰退（在 -1～1 之間）', { boom: r.boom, bust: r.bust });
    ok(r.slots.farmerBoom > r.slots.farmerBust, '繁榮時私人產業職缺多、衰退時少', r.slots);
    ok(r.price.pBoom >= r.price.pBust, '繁榮時物價目標略高', r.price);
    ok(r.pub.g1 > r.pub.g0, '公庫很有錢時公職多開缺', r.pub);
    ok(r.works.spent > 20 && Math.abs(r.works.drift) <= 0.05 && r.works.logged >= r.works.spent, '公庫太多撥款做公共工程，錢付給本地承包商（守恆）', r.works);
    ok(!!r.taxProp && r.taxProp.dir === 'down' && r.taxProp.newTax < 0.15, '公庫存太多：有人提案減稅', r.taxProp);
    ok(!!r.anti && r.anti.ref, '有人擁有三家以上產業：有人提案拆分', r.anti);
    ok(r.vote.worker >= 30 && r.vote.mono === 0 && r.vote.pol <= 10, '工會會員支持拆分；壟斷者與收過他獻金的人反對', r.vote);
    ok(r.split.res && r.split.monoNow === 2 && r.split.monoGain > 0 && Math.abs(r.split.drift) <= 0.05, '拆分：最大的一家照市價賣給別人（守恆）', r.split);
    ok(r.law.on, '第一次拆分通過後反壟斷法生效', r.law);
    ok(r.nat.res && Math.abs(r.nat.drift) <= 0.05 && r.nat.pub === 2, '沒人買得起：公庫照市價收購改公營（守恆）', r.nat);
    ok(r.bank.boom > r.bank.bust && r.bank.bust > 0, '銀行繁榮時借得多、衰退時借得少', r.bank);
    ok(r.brief && Math.abs(r.save + 0.5) < 0.001, 'AI 知道景氣；景氣存讀檔', { brief: r.brief, save: r.save });
    await page.evaluate(() => { const b = document.querySelector('[data-tab="economy"]'); if (b) b.click(); }); await page.waitForTimeout(600);
    const ui = await page.evaluate(() => { const s = document.querySelector('.cycle-meta'); return s ? { txt: s.textContent, cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui, '經濟頁有景氣、公共工程、壟斷', ui);
    if (lang === 'en' && ui) ok(!ui.cjk.length, '英文沒有中文', ui.cjk.slice(0, 5));
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
