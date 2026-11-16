// v11.5.0 公庫的採購計畫（sim-procure.js；兩種事登記在 sim-decide-pol.js）
//   1) 登記了「公庫這週怎麼用」「這趟買賣什麼」，另有自己的每日額度（一天 6 件）
//   2) 選項照當下的處境列：平常是照平常備／只備最要緊的／不買；夠格升格才有「為升格備料」；發不出薪水、升格卡在科技各有自己的選項；給首長看的事實有庫存、用量、價錢、公庫、升格還缺什麼、等料的提案
//   3) 首長的計畫決定買什麼：照平常備＝每樣補到平常的量；只備最要緊的＝只補在用的、沒人用的不補；不買＝一毛都不花
//   4) 保留的料：工匠、取暖、賣貨都拿不到；別的提案不能算成自己的；升格時用掉；已經向外地訂的不用再從庫存留
//   5) 沒有人拿過主意 → 提早問首長；計畫沒顧到的料見底 → 提早問首長、也變成村民可以提的案（在意的人是用那樣料的那一行）；沒有首長時不會偷偷補
//   6) 這趟買賣：選項照行商的貨與價錢列；買貨不超過計畫的預算（公庫留 50、每週上限）；可以不做；價錢很差時照個性會不做；商隊換不換、私人商行做不做也一樣；問人的時候不會把別的系統排著的事提早處理掉
//   7) 開智能體：記下 AI 選的那一項與理由，用的是自己那一組的額度；沒開：照個性選（省的人只備最要緊的，心軟的人先發工資最低的）
//   8) 銀幣守恆：每一條新的路，全鎮的錢變多少，帳上就記多少；發薪先後不同，付出去的錢一樣多
//   9) 舊存檔沒有計畫：買的東西跟以前的規則一樣；存讀檔帶著計畫與保留的料
//  10) 首長請學者先顧升格要的科技：學者自己挑的時候會先挑那個時代的
//  11) 放著跑 20 天沒有錯誤，兩種事都有人決定，帳上沒有對不上的錢
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8175
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8175/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Procure\]|\[Decide\]|\[Proposals\]/.test(x)) console.log('    console:', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html' + (process.env.DBG ? '?dbg=1' : ''), { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; window.__dbg = /dbg=1/.test(location.search); app._fullAgentOn = () => false; w.fullAgentMode = false; const out = {}; const R0 = Math.random; const sp = w.stockpile; const PS = w.proposals; // 真的不開 AI（app 會照設定把完整智能體模式開回來）
    for (let k = 0; k < 900 && !DECIDE.on(w); k++) { w.paused = false; w.tick(); } w.paused = true; out.on = DECIDE.on(w) && PROCURE.on(w);
    const day = () => w._absDay(); const set = (k, n) => { sp.resources[k] = n; }; const get = (k) => sp.get(k); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const M = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = M.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (M.pend - P0)), moved: r3(MONEY.total(w) - T0), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const K1 = DECIDE.KINDS.mayorWeek, K2 = DECIDE.KINDS.tradeRun; const X = DECIDE.S(w);
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && (o.K.key === 'mayorWeek' || o.K.key === 'tradeRun')) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, topic: o.ctx?.topic || o.ctx?.t || '', why: (o.ctx?.why || []).slice(), reason: tx(o.why), res: tx(o.res) }); });
    const head = PROCURE.headOf(w); out.head = !!head; if (!head) return out;
    const plain = (a) => { a._p0 = a._p0 || JSON.stringify(a.personality); a.personality.traits = []; a.personality.values = []; }; const restore = (a) => { if (a._p0) { a.personality = JSON.parse(a._p0); delete a._p0; } };
    const fresh = () => { w.procure = null; sp.hold = null; sp.reserved = {}; sp.transit = {}; return PROCURE.S(w); };
    const ask = (a, kind, c) => { const n0 = seen.length; DECIDE.enqueue(w, a, kind, c); DECIDE.drain(w, X, day()); return seen.slice(n0).pop() || null; };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const T = TIERS.S(w); const met0 = TIERS.met, tb0 = TIERS.techBlock; const lv0 = T.lv; const qualify = (yes) => { if (yes) { TIERS.met = () => T.lv + 1; T.up = TIERS.UP_DAYS; } else { TIERS.met = met0; T.up = 0; } };
    const own0 = MARKET.ownerOf; const noOwner = () => { MARKET.ownerOf = (ww, k) => (k === 'trade' ? null : own0(ww, k)); }; noOwner();
    const RAWS = PROCURE.RAWS; const names = (a) => { try { return typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(a, true) : a; } catch (e) { return a; } };
    const texts = []; const optIds = (K, a, c) => { const os = K.options(w, a, c); for (const o of os) texts.push(tx(o.text), tx(o.say || ''), tx(o.why || '')); return os.map(o => String(o.id)); };

    // 1) 登記
    out.reg = { titles: [K1 && t(K1.title), K2 && t(K2.title)], group: [K1?.aiGroup, K2?.aiGroup], scan: [K1?.scan, K2?.scan], quota: DECIDE.AI_GROUP.civic, deal: DECIDE.AI_GROUP.deal, max: DECIDE.AI_MAX };

    // 2) 選項照處境列
    { fresh(); qualify(false); for (const k of RAWS) set(k, 100); set('food', 800); set('meals', 200); set('silver', 5000); set('tools', 50); set('medicine', 50); set('furniture', 0); set('clothing', 0);
      const c = { topic: 'stock', why: ['week'], d: day() }; const base = optIds(K1, head, c); const f0 = K1.facts(w, head, c); texts.push(f0); const useWood = PROCURE.useOf(w, 'wood');
      qualify(true); set('wood', 5); const mat = ECON.tierMat(T.lv + 1); const withTier = optIds(K1, head, c); const tOpt = K1.options(w, head, c).find(o => o.id === 'tier'); const f1 = K1.facts(w, head, c); texts.push(f1);
      const fake = { id: 'L998', n: 998, kind: 'build', key: 'build:test', status: 'approved', approvedDay: day(), cost: { wood: 9999 }, votes: {}, proposerId: '__none', proposerName: 'x', tk: '在鎮上蓋{name}', tp: { name: '穀倉' } }; PS.items.push(fake); const f2 = K1.facts(w, head, c); PS.items = PS.items.filter(x => x !== fake); texts.push(f2);
      qualify(false); set('wood', 100);
      const cp = { topic: 'pay', why: ['broke'], d: day() }; set('stone', 0); set('metal', 0); set('clothing', 0); set('furniture', 0); set('tools', 0); set('medicine', 0); set('meals', 0); set('food', 0); set('paper', 0); const payNo = optIds(K1, head, cp);
      set('stone', 1000); const payYes = optIds(K1, head, cp); const fp = K1.facts(w, head, cp); texts.push(fp); const sellOpt = K1.options(w, head, cp).find(o => o.id === 'sell');
      TIERS.techBlock = () => ({ era: 4, need: 4, done: 1 }); const ct = { topic: 'tech', why: ['tierTech'], d: day() }; const tech = optIds(K1, head, ct); const ft = K1.facts(w, head, ct); texts.push(ft); TIERS.techBlock = tb0;
      const stale = K1.options(w, head, { topic: 'stock', why: ['week'], d: day() - 5 }).length; const notHead = K1.options(w, npcs().find(a => a !== head), c).length;
      out.opts = { base, withTier, tierText: tOpt ? tx(tOpt.text) : '', matWood: mat.wood, payNo, payYes, sellN: sellOpt ? sellOpt.text.p.n : 0, tech, stale, notHead,
        facts: { silver: /5000/.test(f0), wood: useWood > 0 && f0.includes(t('木材')) && f0.includes(fill('一天用 {n}', { n: useWood })) && f0.includes(fill('夠 {n} 天', { n: Math.floor(100 / useWood) })), price: f0.includes(fill('買一份 {n} 銀幣', { n: 3 })), noTier: !f0.includes(t('擴建')) && !/town hall/.test(f0), tier: f1.includes(String(mat.stone)) && /擴建|extending the town hall/.test(f1), wait: f2.includes('L998') && f2.length > f1.length, pay: !!sellOpt && fp.includes(String(sellOpt.text.p.n)), tech: /4/.test(ft) && /1/.test(ft) && ft.length > 20 } };
      set('food', 800); set('meals', 200); set('tools', 50); set('medicine', 50); set('stone', 100); set('metal', 100); }

    // 3) 首長的計畫決定買什麼
    { qualify(false); const zero = () => { for (const k of RAWS) set(k, 0); set('silver', 3000); set('food', 800); set('meals', 200); set('tools', 50); set('medicine', 50); }; const snap = () => Object.fromEntries(RAWS.map(k => [k, Math.round(get(k) * 10) / 10]));
      const floors = Object.fromEntries(RAWS.map(k => [k, ECON.rawFloor(w, k)])); const use = Object.fromEntries(RAWS.map(k => [k, PROCURE.useOf(w, k)]));
      const res = {}; for (const mode of ['usual', 'lean', 'save']) { fresh(); zero(); const L = leak(() => PROCURE.setPlan(w, head, mode)); res[mode] = { got: snap(), spent: Math.round((3000 - get('silver')) * 10) / 10, leak: L.leak, moved: L.moved, cap: PROCURE.S(w).cap }; }
      const leanWant = Object.fromEntries(RAWS.map(k => [k, use[k] > 0.05 ? Math.min(floors[k], Math.max(10, Math.ceil(use[k] * 2))) : 0]));
      const cost = (o) => Math.round(RAWS.reduce((s, k) => s + Math.round(o[k] * PROCURE.IMPORT_PRICE[k] * 10) / 10, 0) * 10) / 10;
      out.plan = { floors, use, leanWant, res, usualCost: cost(floors), leanCost: cost(leanWant), log: (w.messageLog || []).slice(-40).some(m => String(m.content || '').includes('📦')) }; }

    // 4) 保留的料
    { fresh(); qualify(true); const mat = ECON.tierMat(T.lv + 1); for (const k of Object.keys(mat)) set(k, 0); set('silver', 5000); const f0 = ECON.rawFloor(w, 'wood');
      const L = leak(() => PROCURE.setPlan(w, head, 'tier')); const P = PROCURE.S(w);
      const o = { mat, hold: Object.assign({}, sp.hold || {}), mode: P.mode, wood: get('wood'), stone: get('stone'), furn: get('furniture'), floorWood: f0, leak: L.leak, free: sp.free('wood'), locked: sp.locked('wood') };
      // 工匠與取暖動不了保留的料：把木材設成剛好等於保留的量，冬天跑一天的生產
      const season0 = w.clock.season; w.clock.season = '冬季'; set('wood', mat.wood); set('furniture', mat.furniture); P.lastDay = day(); const log0 = (w.messageLog || []).length; const carp = npcs().filter(a => a.job?.key === 'carpenter').length;
      const direct = { consume: sp.consume('wood', 1, w.tickCount, 'test'), has: sp.has('wood', 1), free: sp.free('wood'), afford: sp.canAfford({ wood: 1 }) };
      processDailyProduction(w); w.clock.season = season0;
      const logs = (w.messageLog || []).slice(log0).map(m => String(m.content || '')); o.day = { carp, wood: get('wood'), furn: get('furniture'), cold: logs.some(x => x.includes(t('木材不夠取暖！'))), direct };
      // 別的提案不能算成自己的；升格案可以
      set('wood', mat.wood); o.short = { build: PS._shortfall(w, { kind: 'build', cost: { wood: 10 } }), tier: PS._shortfall(w, { kind: 'tier_up', cost: { wood: mat.wood } }) };
      // 賣貨也賣不到保留的
      set('furniture', mat.furniture + 200); const sur = MONEY.surplusList(w).find(x => x.r === 'furniture'); o.sur = sur ? sur.extra : 0; o.surWant = Math.floor(200 - MONEY.floorsKept(w).furniture);
      // 升格用掉保留的料
      for (const k of Object.keys(mat)) set(k, mat[k]); const pr = TIERS.progress(w); o.lack = Object.keys(pr.matLack || {}).length; const lvA = T.lv; const pro = TIERS.promote(w); o.promote = { ok: !!pro.ok, lv: T.lv - lvA, left: Object.fromEntries(Object.keys(mat).map(k => [k, get(k)])) };
      qualify(false); PROCURE.sync(w); o.after = { hold: sp.hold, mode: PROCURE.S(w).mode };
      // 已批准提案保留的：工匠拿不到；已經向外地訂、還在路上的那一部分不用從庫存留
      fresh(); set('wood', 30); sp.reserved = { wood: 30 }; sp.transit = {}; const a1 = sp.consume('wood', 5, w.tickCount, 'test'); sp.transit = { wood: 30 }; const a2 = sp.consume('wood', 5, w.tickCount, 'test'); sp.reserved = {}; sp.transit = {};
      const pA = { id: 'L997', n: 997, kind: 'build', key: 'build:t2', status: 'approved', approvedDay: day(), cost: { wood: 40 }, votes: {}, proposerId: '__none', proposerName: 'x', tk: '在鎮上蓋{name}', tp: { name: '穀倉' }, order: { day: day() + 2, items: { wood: 25 }, paid: 60 } };
      PS.items.push(pA); PS._reserveAll(w); o.res = { blocked: a1 === false, transitOk: a2 === true, reserved: sp.reserved.wood, transit: sp.transit.wood, locked: sp.locked('wood'), view: PROCURE.view(w).reserved.wood }; PS.items = PS.items.filter(x => x !== pA); PS._reserveAll(w);
      out.hold = o; }

    // 5) 沒有人拿過主意／計畫沒顧到
    { fresh(); qualify(false); for (const k of RAWS) set(k, 100); set('silver', 3000); set('food', 800); set('meals', 200); const d = day(); if (w.wallet) w.wallet.shortDay = -99;
      const n0 = seen.length; PROCURE.daily(w); const first = seen.slice(n0).pop(); const P = PROCURE.S(w); const o = { first, dflt: P.dflt, asks: P.st.asks };
      // 計畫是「不買」，木材用完了 → 提早問首長；照個性不會再選不買
      P.mode = 'save'; P.hold = null; P.cap = null; P.d = d; P.dflt = 0; set('wood', 0); P.lastDay = null; P.lastAsk = null; P.pend = null; P.urg = {};
      const n1 = seen.length; const r1 = steady(() => { plain(head); try { PROCURE.daily(w); } finally { restore(head); } }); const second = seen.slice(n1).pop();
      o.out = { second, mode: PROCURE.S(w).mode, wood: Math.round(get('wood')), miss: Object.keys(PROCURE.S(w).miss) };
      // 也變成村民可以提的案；最在意的是用木材的那一行
      const P2 = PROCURE.S(w); P2.mode = 'save'; P2.cap = null; set('wood', 0); PROCURE.watch(w); PS.cooldown = {}; PS.items = PS.items.filter(x => x.key !== 'market:buy:wood');
      const cs = PS._candidates(w, d); const cand = cs.find(x => x.key === 'market:buy:wood'); const carp = npcs().find(a => a.job?.key === 'carpenter'); const other = npcs().find(a => !['carpenter', 'blacksmith', 'trader', 'mayor'].includes(a.job?.key));
      if (carp) plain(carp); if (other) plain(other); o.cand = cand ? { weight: cand.weight, jobs: cand.jobs, care: carp ? PS._careOf(w, carp, cand) : null, careOther: other ? PS._careOf(w, other, cand) : null } : null; if (carp) restore(carp); if (other) restore(other);
      if (cand && carp) { const p = PS._createWith(w, d, cand, carp); const s0 = get('silver'), w0 = get('wood'); const L = leak(() => { PS._decide(w, p, 'approve', 'observer'); PS._execute(w, p, d + 1); }); o.prop = { kind: p.kind, side: p.side, status: p.status, wood: get('wood') - w0, paid: s0 - get('silver'), qty: p.qty, cost: p.cost.silver, leak: L.leak }; PS.items = PS.items.filter(x => x !== p); PS._reserveAll(w); }
      // 計畫要買、但公庫的錢不夠：也提早問首長（先發誰、賣貨、借錢那一題），不會憑空補
      { const P3 = PROCURE.S(w); P3.mode = 'usual'; P3.dflt = 0; P3.d = d; P3.cap = null; P3.hold = null; P3.noCash = null; P3.lastDay = null; P3.lastAsk = null; P3.pend = null; P3.urg = {}; P3.miss = {}; PROCURE.sync(w); for (const k of RAWS) set(k, 100); set('wood', 0); set('silver', 40); if (w.wallet) w.wallet.shortDay = -99; const n3 = seen.length; PROCURE.daily(w); const e3 = seen.slice(n3).pop();
        o.broke = { e: e3, noCash: P3.noCash === d, wood: Math.round(get('wood')), silver: Math.round(get('silver')), mayorAsks: seen.slice(n3).filter(x => x.kind === 'mayorWeek').length }; set('silver', 3000); }
      // 沒有首長：不問、也不會偷偷補
      const m0 = PS._mayor, e0 = w.election.currentMayor; PS._mayor = () => null; w.election.currentMayor = () => null;
      P2.mode = 'save'; set('wood', 0); P2.lastDay = null; P2.lastAsk = null; P2.pend = null; P2.urg = {}; PS.cooldown = {}; const n2 = seen.length; const s2 = get('silver'); PROCURE.daily(w);
      o.noHead = { head: PROCURE.headOf(w), asked: seen.length - n2, wood: get('wood'), spent: s2 - get('silver'), cand: PS._candidates(w, d).some(x => x.key === 'market:buy:wood') };
      PS._mayor = m0; w.election.currentMayor = e0; out.none = o; }

    // 6) 這趟買賣
    { fresh(); qualify(false); const P = PROCURE.S(w); P.mode = 'usual'; P.dflt = 0; P.d = day(); const dealer = PROCURE.dealerOf(w); const o = { role: dealer?.role }; const D = dealer.a; plain(D);
      const mk = (offers) => { w.trade.merchant = { name: 'Tester', specialty: 'general', daysRemaining: 3, offers: offers.map(x => Object.assign({}, x)) }; return w.trade.merchant; };
      const WOOD = { resource: 'wood', amount: 40, price: 2, isBuying: false }, MEALS = { resource: 'meals', amount: 40, price: 2, isBuying: true };
      const keepMeals = w.autonomy._keepOf(w, 'meals'); const base = () => { for (const k of RAWS) set(k, 100); set('wood', 0); set('meals', keepMeals + 100); set('food', 800); set('tools', 50); set('medicine', 50); set('furniture', 0); set('clothing', 0); };
      const c = () => ({ t: 'm', m: 'Tester', role: 'trader', d: day() });
      // 選項照行商的貨列
      base(); set('silver', 5000); mk([WOOD, MEALS]); o.ids = optIds(K2, D, c()); texts.push(K2.facts(w, D, c()));
      mk([MEALS]); o.idsSell = optIds(K2, D, c()); P.mode = 'save'; mk([WOOD, MEALS]); o.idsSave = optIds(K2, D, c()); P.mode = 'usual';
      // 預算：公庫留 50
      base(); set('silver', 50 + 21); mk([WOOD, MEALS]); o.avail = PROCURE.avail(w); let L = leak(() => K2.options(w, D, c()).find(x => x.id === 'buy').run(w, D)); o.buy = { wood: get('wood'), silver: get('silver'), leak: L.leak, moved: L.moved, run: w.trade.merchant._run?.mode, meals: get('meals') - (keepMeals + 100) };
      // 預算：每週上限
      base(); set('silver', 5000); P.mode = 'lean'; P.cap = 30; P.wk = { d0: day(), n: 24 }; mk([WOOD, MEALS]); o.availCap = PROCURE.avail(w); L = leak(() => K2.options(w, D, c()).find(x => x.id === 'buy').run(w, D)); o.cap = { wood: get('wood'), spent: 5000 - get('silver'), week: P.wk.n, leak: L.leak }; P.mode = 'usual'; P.cap = null; P.wk = { d0: day(), n: 0 };
      // 照計畫買賣：先賣再買
      base(); set('silver', 5000); mk([WOOD, MEALS]); const hist0 = (w.trade.tradeHistory || []).length; L = leak(() => K2.options(w, D, c()).find(x => x.id === 'deal').run(w, D)); o.deal = { wood: get('wood'), floor: Math.max(ECON.rawFloor(w, 'wood'), Math.ceil(w.autonomy._lowOf(w, 'wood') * 1.5)), meals: get('meals') - (keepMeals + 100), silver: get('silver') - 5000, leak: L.leak, who: (w.trade.tradeHistory || []).slice(hist0).pop()?.who === D.name };
      // 可以不做
      base(); set('silver', 5000); const m3 = mk([WOOD, MEALS]); L = leak(() => K2.options(w, D, c()).find(x => x.id === 'refuse').run(w, D)); const afterRef = { wood: get('wood'), silver: get('silver'), run: m3._run?.mode }; PROCURE.merchantDay(w); o.refuse = Object.assign(afterRef, { wood2: get('wood'), again: K2.options(w, D, c()).length, leak: L.leak });
      // 照個性：價錢很差就不做，價錢好就賣
      base(); set('silver', 5000); mk([{ resource: 'meals', amount: 40, price: 0.5, isBuying: true }]); o.bad = steady(() => ask(D, 'tradeRun', c()))?.id;
      base(); set('silver', 5000); mk([{ resource: 'meals', amount: 40, price: 2.2, isBuying: true }]); o.good = steady(() => ask(D, 'tradeRun', c()))?.id;
      // 行商在鎮上的那一天：整條路（含原本的包裝）都記了帳；談的人是出面的那位
      base(); set('silver', 5000); const m5 = mk([WOOD, MEALS]); const n5 = seen.length; L = leak(() => steady(() => w.autonomy._merchant(w))); const e5 = seen.slice(n5).pop(); o.dayRun = { asked: m5._asked === day(), kind: e5?.kind, who: e5?.who === D.agentId, run: m5._run?.mode, leak: L.leak };
      // 跨鎮商隊
      base(); set('stone', 200); set('cloth', 30); const off = () => ({ town: 'Riverside', key: 'harbor', give: 'stone', recv: 'cloth', giveAmt: 10, mk: 0, rt: 0, d: day() });
      const cc = { t: 'c', o: off(), role: 'trader', d: day() }; o.cIds = optIds(K2, D, cc); texts.push(K2.facts(w, D, cc)); L = leak(() => K2.options(w, D, cc).find(x => x.id === 'swap').run(w, D)); o.swap = { stone: get('stone') - 200, cloth: get('cloth') - 30, leak: L.leak, again: K2.options(w, D, cc).length };
      const c2 = { t: 'c', o: off(), role: 'trader', d: day() }; K2.options(w, D, c2).find(x => x.id === 'refuse').run(w, D); o.cRefuse = { stone: get('stone') - 190, cloth: get('cloth') - 40 };
      set('stone', 200); const n6 = seen.length; const asked = PROCURE.caravanAsk(w, off()); o.cAsk = { asked, kind: seen.slice(n6).pop()?.kind };
      // 問人的時候，別的系統排在決策佇列裡、還沒輪到的事不會被提早處理掉
      { set('stone', 200); const later = { a: D.agentId, kind: '__someone_elses_turn', ctx: { x: 1 } }; X.q.push(later); PROCURE.caravanAsk(w, off()); o.queue = { kept: X.q.includes(later), first: X.q[0] === later }; X.q.splice(X.q.indexOf(later), 1); }
      // 保留的料不拿去換
      set('stone', 200); sp.hold = { stone: 200 }; o.cHeld = K2.options(w, D, { t: 'c', o: off(), role: 'trader', d: day() }).length; sp.hold = { stone: 195 }; K2.options(w, D, { t: 'c', o: off(), role: 'trader', d: day() }).find(x => x.id === 'swap').run(w, D); o.cHeldPart = get('stone'); sp.hold = null;
      // 私人商行：做不做由東家決定；公庫收進口貨的錢不超過計畫的預算
      const boss = npcs().find(a => a.job?.key === 'trader') || D; MARKET.ownerOf = (ww, k) => (k === 'trade' ? boss.agentId : own0(ww, k)); const cash0 = WALLET.get(w, boss); WALLET.add(w, boss, 500);
      base(); set('herbs', 0); set('silver', 50 + 63); mk([{ resource: 'herbs', amount: 20, price: 2, isBuying: false }]); const dl = PROCURE.dealerOf(w); const ch = { t: 'm', m: 'Tester', role: 'owner', d: day() };
      o.house = { role: dl?.role, who: dl?.a === boss, ids: optIds(K2, boss, ch) }; texts.push(K2.facts(w, boss, ch)); const loc = TRADE.localPrice(w, 'herbs'); const b0 = WALLET.get(w, boss);
      L = leak(() => K2.options(w, boss, ch).find(x => x.id === 'house').run(w, boss)); const q = get('herbs'); o.house.run = { herbs: q, loc, rate: TRADE.tariff(w), treasury: Math.round((113 - get('silver')) * 100) / 100, boss: Math.round((WALLET.get(w, boss) - b0) * 100) / 100, leak: L.leak, moved: L.moved };
      PROCURE.S(w).mode = 'save'; mk([{ resource: 'herbs', amount: 20, price: 2, isBuying: false }]); set('herbs', 0); o.house.save = K2.options(w, boss, ch).length; PROCURE.S(w).mode = 'usual';
      WALLET.take(w, boss, Math.max(0, WALLET.get(w, boss) - cash0)); noOwner(); restore(D); w.trade.merchant = null; out.trade = o; }

    // 7) 開智能體／照個性
    { fresh(); qualify(false); for (const k of RAWS) set(k, 100); set('food', 800); set('meals', 200); set('tools', 50); set('medicine', 50); const fx = Math.max(1, TREASURY.fixed(w)); set('silver', Math.round(fx * 40) + 500);
      const P = PROCURE.S(w); const c = () => ({ topic: 'stock', why: ['week'], d: day() }); const o = { days: Math.floor(TREASURY.days(w)) };
      plain(head); o.plainPick = steady(() => ask(head, 'mayorWeek', c())); head.personality.traits = ['thrifty', 'ascetic', 'neurotic', 'pessimist']; o.frugalPick = steady(() => ask(head, 'mayorWeek', c()));
      for (const k of ['stone', 'metal', 'clothing', 'furniture', 'tools', 'medicine', 'meals', 'food', 'paper']) set(k, 0); const cp = () => ({ topic: 'pay', why: ['broke'], d: day() });
      head.personality.traits = []; o.payPlain = steady(() => ask(head, 'mayorWeek', cp()))?.id; head.personality.traits = ['kind', 'generous']; o.payKind = steady(() => ask(head, 'mayorWeek', cp()))?.id; restore(head);
      set('food', 800); set('meals', 200); set('tools', 50); set('medicine', 50); set('stone', 100); set('metal', 100);
      // AI：假的模型回「只備最要緊的」和它的理由
      const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; let pick = 'lean';
      ce._askJson = async (prompt) => { prompts.push(String(prompt)); return [{ n: 1, pick, why: 'model reason 42', feel: 'careful' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { X.lastDay = day(); X._asked = X._asked || 0; X._kAsked = {}; X._gAsked = {}; const a0n = X._asked; fresh().mode = 'usual'; const n0 = seen.length;
        DECIDE.enqueue(w, head, 'mayorWeek', c()); DECIDE.drain(w, X, day()); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).pop(); const lg = (X.log[head.agentId] || []).filter(x => x.kind === 'mayorWeek').pop();
        o.ai = { pending, e, mode: PROCURE.S(w).mode, civic: X._gAsked.civic, town: X._asked - a0n, lg: lg ? { id: lg.id, ai: lg.ai, why: lg.why?.raw } : null, prompt: prompts.length ? { facts: prompts[0].includes(t('公庫現在 {s} 銀幣').split('{s}')[0] || '###') || /treasury holds/i.test(prompts[0]), code: /usual＝/.test(prompts[0]) && /lean＝/.test(prompts[0]) && /save＝/.test(prompts[0]) } : null };
        // 這趟買賣也一樣：AI 說不做
        pick = 'refuse'; const D = PROCURE.dealerOf(w).a; set('wood', 0); set('silver', 5000); const m = w.trade.merchant = { name: 'Tester', specialty: 'general', daysRemaining: 3, offers: [{ resource: 'wood', amount: 40, price: 2, isBuying: false }] }; const n1 = seen.length;
        PROCURE.merchantDay(w); const wait = !m._run && m._asked === day(); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); const e2 = seen.slice(n1).pop();
        o.ai2 = { wait, e: e2, run: m._run?.mode, wood: get('wood'), civic: X._gAsked.civic }; w.trade.merchant = null; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }

    // 8) 發薪先後：付出去的錢一樣多，先後不同
    { fresh(); const P = PROCURE.S(w); const W = WALLET.S(w); const all = npcs(); const pub = TREASURY.staff(w).filter(a => !(typeof DAY !== 'undefined' && DAY.noPay(w, a))); const care = pub.filter(a => a.job.key === 'guard' || a.job.key === 'doctor'); const rest = pub.filter(a => !care.includes(a));
      const o = { pub: pub.length, care: care.length }; const net = TREASURY.payroll(w);
      const pay = (how) => { P.pay = how; set('silver', Math.round(net * 0.5 * 100) / 100); const b0 = new Map(pub.map(a => [a.agentId, WALLET.get(w, a)])); const T0 = MONEY.total(w), P0 = M.pend; WALLET.payday(w, W, all); const got = (xs) => xs.reduce((s, a) => s + WALLET.get(w, a) - b0.get(a.agentId), 0); return { care: Math.round(got(care) * 100) / 100, rest: Math.round(got(rest) * 100) / 100, left: Math.round(get('silver') * 100) / 100, leak: r3((MONEY.total(w) - T0) - (M.pend - P0)), moved: r3(MONEY.total(w) - T0), unpaid: W.unpaid }; };
      o.even = pay('even'); o.careFirst = pay('care'); o.low = pay('low'); o.net = Math.round(net * 100) / 100; P.pay = 'even'; W.unpaid = 0; out.pay = o; }

    // 10) 首長請學者先顧升格要的科技
    { fresh(); const P = PROCURE.S(w); const R = w.research; const av = R.getAvailable(); const late = av.slice().sort((a, b) => (b.era || 1) - (a.era || 1))[0]; const early = av.slice().sort((a, b) => (a.era || 1) - (b.era || 1))[0];
      const o = { n: av.length, eras: [early?.era || 1, late?.era || 1] }; const ga = R.getAvailable; const path0 = w.tech?.path;
      // 兩個題目：自己路線的第五時代、別條路線的第四時代。平常學者先顧自己的路線；首長交代之後先挑第四時代的那一項（升格算的是第四時代研究完幾項）
      const tree = RESEARCH_TREE; const mine = { key: '__mine', name: 'Mine', era: 5 }, theirs = { key: '__theirs', name: 'Theirs', era: 4 }; tree.__mine = { era: 5, path: 'pA' }; tree.__theirs = { era: 4, path: 'pB' }; R.getAvailable = () => [mine, theirs]; TECH.S(w).path = 'pA';
      const count = () => { let n = 0; for (let i = 0; i < 20; i++) if (TECH.autoPick(R, w)?.key === '__theirs') n++; return n; };
      TIERS.techBlock = () => ({ era: 4, need: 4, done: 1 }); P.tech = null; o.before = count(); o.wBefore = TECH.pickWeight(w, theirs);
      const e = steady(() => { plain(head); try { return ask(head, 'mayorWeek', { topic: 'tech', why: ['tierTech'], d: day() }); } finally { restore(head); } }); o.pick = e?.id; o.tech = PROCURE.S(w).tech?.era; o.after = count(); o.wAfter = TECH.pickWeight(w, theirs);
      TIERS.techBlock = () => null; o.cleared = PROCURE.techAsk(w) === null && count() === 0;
      TIERS.techBlock = tb0; R.getAvailable = ga; delete tree.__mine; delete tree.__theirs; if (w.tech) w.tech.path = path0; out.tech = o; }

    // 9) 舊存檔
    { fresh(); qualify(false); for (const k of RAWS) set(k, 3); set('silver', 3000); set('food', 800); set('meals', 200); set('tools', 50); set('medicine', 50);
      const P = PROCURE.S(w); const o = { dflt: P.dflt, mode: P.mode }; const old = {}; let silver = 3000; for (const k of RAWS) { let gap = ECON.rawFloor(w, k) - 3; const unit = PROCURE.IMPORT_PRICE[k]; const afford = Math.floor(Math.max(0, silver - 50) / unit); gap = Math.min(gap, afford); if (gap > 0) { silver -= Math.round(gap * unit * 10) / 10; old[k] = 3 + gap; } else old[k] = 3; }
      PROCURE.exec(w); o.same = RAWS.every(k => Math.abs(get(k) - old[k]) < 1e-6) && Math.abs(get('silver') - silver) < 0.11; o.got = Object.fromEntries(RAWS.map(k => [k, get(k)])); o.old = old;
      // 糧食、藥、工具照以前商店補貨的量
      set('food', 10); set('tools', 0); const pop = npcs().length; const s1 = get('silver'); PROCURE.exec(w); o.shop = { food: get('food'), wantFood: Math.max(60, Math.round(pop * 4)), tools: get('tools') };
      const sv0 = JSON.parse(JSON.stringify(w.serialize())); delete sv0.procure; const wA = new World(); wA.loadSave(sv0); o.load = { procure: wA.procure, hold: wA.stockpile.hold, mode: PROCURE.S(wA).mode, dflt: PROCURE.S(wA).dflt }; wA.reset?.();
      P.mode = 'lean'; P.cap = 123; P.dflt = 0; P.hold = { wood: 5 }; P.holdLv = T.lv + 1; P.pay = 'care'; const sv1 = JSON.parse(JSON.stringify(w.serialize())); const wB = new World(); wB.loadSave(sv1); o.round = { mode: wB.procure?.mode, cap: wB.procure?.cap, pay: wB.procure?.pay, hold: wB.stockpile.hold?.wood, locked: wB.stockpile.locked('wood') }; wB.reset?.();
      out.save = o; fresh(); }

    // 介面：原料倉庫那張卡寫出這週的採購與保留的料
    { const P = PROCURE.S(w); P.mode = 'tier'; P.dflt = 0; P.by = head.agentId; P.byName = head.name; P.d = day(); P.hold = { wood: 60, stone: 60 }; P.holdLv = T.lv + 1; sp.hold = Object.assign({}, P.hold); const V = PROCURE.view(w);
      out.ui = { plan: PROCURE.planText(w), hold: V.hold, brief: PROCURE.brief(w, head), briefOther: PROCURE.brief(w, npcs().find(a => a !== head && a.job?.key !== 'trader')) }; texts.push(out.ui.plan, out.ui.brief);
      try { sp.reserved = { wood: 40 }; sp.transit = {}; const box = document.createElement('div'); const tab0 = app.activeTab; app.activeTab = 'econ-goods'; if (!app.state && w.toDict) app.state = w.toDict(); app.renderEconomy(box); app.activeTab = tab0;
        out.ui.dom = { plan: (box.querySelector('.pg-plan')?.textContent || ''), holds: [...box.querySelectorAll('.pg-hold')].map(e => e.textContent) }; texts.push(names(out.ui.dom.plan), ...out.ui.dom.holds); } catch (e) { out.ui.dom = { err: String(e.message) }; }
      fresh(); }

    // 11) 放著跑 20 天
    { MARKET.ownerOf = own0; TIERS.met = met0; T.up = 0; fresh(); for (const k of RAWS) set(k, 60); set('silver', 1500); set('food', 800); set('meals', 200); const errs0 = []; const n0 = seen.length; const d0 = day();
      M.lastT = MONEY.total(w) - M.pend; delete (M.days[d0] || {}).other; // 前面為了測試直接改過庫存與公庫：從這裡重新起算，只看接下來 20 天的帳
      const fser = []; for (let i = 0; i < 20; i++) { fser.push(Math.round(get('food')) + '/' + Math.round(get('meals')) + '/' + npcs().filter(a => a.job?.key === 'farmer').length + '/' + w.clock.season); const dd = w._absDay(); try { for (let k = 0; k < 400 && w._absDay() === dd; k++) { w.paused = false; w.tick(); } } catch (e) { errs0.push(String(e.message)); } w.paused = true; await new Promise(r2 => setTimeout(r2, 0)); }
      const got = seen.slice(n0); let other = 0; for (const [k, D] of Object.entries(w.money?.days || {})) if (+k >= d0) other += Math.abs(D.other || 0);
      out.run = { errs: errs0.slice(0, 3), mayor: got.filter(x => x.kind === 'mayorWeek').length, trade: got.filter(x => x.kind === 'tradeRun').length, picks: got.reduce((m, x) => { m[x.kind + '.' + x.id] = (m[x.kind + '.' + x.id] || 0) + 1; return m; }, {}), other: Math.round(other * 100) / 100, fser: window.__dbg ? fser : undefined, flog: window.__dbg ? (w.messageLog || []).filter(m => (m.d || 0) >= d0 && /糧|食物|food|Food|granar|famine/.test(String(m.content || ''))).slice(0, 12).map(m => 'd' + ((m.d || 0) - d0) + ' ' + String(m.content).slice(0, 80)) : undefined, plan: PROCURE.view(w).mode, dflt: PROCURE.view(w).dflt, silver: Math.round(get('silver')), wood: Math.round(get('wood')), food: Math.round(get('food')) }; }
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(0, 60);
    out.texts = texts.filter(Boolean).map(names);
    out.keys = [t('公庫這週怎麼用'), t('這趟買賣什麼'), t('照平常的量備貨'), t('只備最要緊的'), t('為升格備料'), t('這週不買，把錢存下來'), t('大家照同一個比例少領'), t('先發守衛和醫生'), t('先發工資最低的人'), t('公庫備貨'), t('公庫這週的採購'), t('首長為升格保留，平常不能動用'), t('已批准的提案保留，平常不能動用'), t('📦 {a}定了公庫這週的採購：{x}。'), t('🔒 {a}把{m}留給鎮公所擴建，木匠和取暖都不能動這一批。'), t('🧭 {a}看了商人{m}的貨和價錢，這趟沒有跟他做生意。'), t('🐪 {town}的商隊來了，{a}看了看，沒有換貨。'), t('🔬 首長請學者先顧升格要的科技，學者們選了「{p}」開始研究。'), t('🛒 公庫照採購計畫補了{item} {n} 份（{cost} 銀幣）。'), t('💸 {a}交代：公庫發不出全薪的時候，{x}。')];
    return out; });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.head, `${tag} 決策核心與採購計畫都開著，鎮上有首長`, { on: r.on, head: r.head });
  if (!r.head) { await ctx.close(); return; }
  // 1
  ok(r.reg.titles.every(Boolean) && r.reg.group.join() === 'civic,civic' && r.reg.scan.join() === 'false,false', `${tag} 登記了「公庫這週怎麼用」「這趟買賣什麼」，歸在公家的事那一組，由事件送進來、不是每天掃`, r.reg);
  ok(r.reg.quota === 6 && r.reg.deal === 20 && r.reg.max === 10, `${tag} 公家的事另有一天 6 件的額度，全鎮的 10 件與市場的 20 件不變`, r.reg);
  // 2
  { const O = r.opts;
    ok(O.base.join() === 'usual,lean,save' && O.withTier.join() === 'usual,lean,tier,save', `${tag} 平常三個選項；夠格升格才多一個「為升格備料」`, { base: O.base, tier: O.withTier });
    ok(O.tierText.includes(String(O.matWood)) && /\d/.test(O.tierText), `${tag} 「為升格備料」寫出要保留哪些料、還缺多少、大約多少錢`, O.tierText);
    ok(O.payNo.join() === 'even,care,low,stop' && O.payYes.includes('sell') && O.sellN >= 30, `${tag} 發不出薪水：先發誰、這週先不買；倉裡有多的貨才有「賣到外地」`, { no: O.payNo, yes: O.payYes, n: O.sellN });
    ok(O.tech.join() === 'ask,leave', `${tag} 升格卡在科技：請學者先顧／讓學者自己排`, O.tech);
    ok(O.stale === 0 && O.notHead === 0, `${tag} 過期的問題、不是首長的人，沒有選項`, { stale: O.stale, notHead: O.notHead });
    ok(O.facts.silver && O.facts.wood && O.facts.price && O.facts.noTier && O.facts.tier && O.facts.wait && O.facts.pay && O.facts.tech, `${tag} 給首長看的事實：公庫、每樣存多少與一天用多少、價錢、升格要的料、等料的提案`, O.facts); }
  // 3
  { const P = r.plan; const same = (a, b) => Object.keys(b).every(k => Math.abs(a[k] - b[k]) < 0.01);
    ok(same(P.res.usual.got, P.floors) && Math.abs(P.res.usual.spent - P.usualCost) < 0.11, `${tag} 照平常的量備：五種原料各補到平常的量，花的錢對得上`, { got: P.res.usual.got, floors: P.floors, spent: P.res.usual.spent, cost: P.usualCost });
    ok(same(P.res.lean.got, P.leanWant) && P.res.lean.got.stone === 0 && P.res.lean.spent < P.res.usual.spent && Math.abs(P.res.lean.spent - P.leanCost) < 0.11 && P.res.lean.cap > 0, `${tag} 只備最要緊的：只補在用的料（各兩天份），沒人用的石材不補，花得比較少，有每週上限`, { got: P.res.lean.got, want: P.leanWant, use: P.use, spent: P.res.lean.spent, cap: P.res.lean.cap });
    ok(Object.values(P.res.save.got).every(v => v === 0) && P.res.save.spent === 0, `${tag} 這週不買：一樣都沒買、一毛都沒花`, P.res.save);
    ok(P.res.usual.leak === 0 && P.res.lean.leak === 0 && P.res.save.leak === 0 && Math.abs(P.res.usual.moved + P.res.usual.spent) < 0.01, `${tag} 買料的銀幣流出鎮外，帳上記的一樣多（銀幣守恆）`, { u: P.res.usual, l: P.res.lean });
    ok(P.log, `${tag} 首長定了採購，日誌看得到`, P.log); }
  // 4
  { const H = r.hold; const mat = H.mat;
    ok(H.mode === 'tier' && Object.keys(mat).every(k => H.hold[k] === mat[k]) && H.wood >= mat.wood + H.floorWood - 0.01 && H.stone >= mat.stone && H.furn >= mat.furniture && H.leak === 0, `${tag} 為升格備料：料保留下來，缺的由公庫買齊（木材＝保留的＋平常的量），帳對得上`, { hold: H.hold, wood: H.wood, stone: H.stone, furn: H.furn, floor: H.floorWood, leak: H.leak });
    ok(H.locked === mat.wood && Math.abs(H.free - (H.wood - mat.wood)) < 0.01, `${tag} 保留的量算鎖住，拿得到的只有超過的那一部分`, { locked: H.locked, free: H.free });
    ok(H.day.direct.consume === false && H.day.direct.has === false && H.day.direct.free === 0 && H.day.direct.afford === false, `${tag} 庫存剛好等於保留的量時：誰都拿不到、別的工程也算不夠`, H.day.direct);
    ok(H.day.wood >= mat.wood && H.day.furn >= mat.furniture && H.day.cold, `${tag} 冬天跑一天的生產：木匠和取暖都沒動到保留的木材（取暖因此不夠），家具也沒少`, H.day);
    ok(H.short.build.wood === 10 && !H.short.tier.wood, `${tag} 別的提案不能把保留的料算成自己的；升格案可以`, H.short);
    ok(H.sur === H.surWant && H.surWant > 0, `${tag} 賣貨時保留的家具不算多出來的（多出來的＝庫存－該留的－保留的）`, { sur: H.sur, want: H.surWant });
    ok(H.lack === 0 && H.promote.ok && H.promote.lv === 1 && Object.values(H.promote.left).every(v => v === 0), `${tag} 升格：算料時把保留的算進去，升格時剛好把它用掉`, H.promote);
    ok(H.after.hold === null && H.after.mode === 'usual', `${tag} 升格之後不再保留，採購回到照平常的量`, H.after);
    ok(H.res.blocked && H.res.transitOk && H.res.reserved === 40 && H.res.transit === 25 && H.res.locked === 15 && H.res.view === 15, `${tag} 已批准提案保留的料工匠拿不到；已經向外地訂、還在路上的那一部分不用從庫存留`, H.res); }
  // 5
  { const N = r.none;
    ok(N.first && N.first.kind === 'mayorWeek' && N.first.topic === 'stock' && N.first.why.includes('noplan') && N.first.src === 'rule' && !N.dflt, `${tag} 還沒有人拿過主意：當天就去問首長，他定了之後不再是老規矩`, { first: N.first, dflt: N.dflt });
    ok(N.out.second && N.out.second.why.includes('out:wood') && N.out.second.id !== 'save' && N.out.mode !== 'save' && N.out.wood > 0, `${tag} 計畫是不買、木材用完了：提早問首長；他照個性不會再選不買，木材補回來了`, N.out);
    ok(N.cand && N.cand.weight >= 4 && N.cand.jobs.includes('carpenter') && N.cand.care && N.cand.care[0] >= 2 && N.cand.care[1] === 'job' && (!N.cand.careOther || N.cand.careOther[0] < N.cand.care[0]), `${tag} 也變成村民可以提的案（進一批木材），份量算急事；最在意的是用木材的那一行`, N.cand);
    ok(N.prop && N.prop.kind === 'market' && N.prop.side === 'buy' && N.prop.status === 'done' && N.prop.wood === N.prop.qty && N.prop.paid <= N.prop.cost + 0.01 && N.prop.leak === 0, `${tag} 這個案通過之後真的買進來，錢從公庫付、帳對得上`, N.prop);
    ok(N.broke.e && N.broke.e.kind === 'mayorWeek' && N.broke.e.topic === 'pay' && N.broke.e.why.includes('broke') && N.broke.noCash && N.broke.mayorAsks === 1 && (N.broke.wood === 0 || N.broke.e.id === 'sell'), `${tag} 計畫要買木材、公庫只有 40：買不起就記下來，當天問首長錢的事（除非他選賣貨換到錢，木材還是 0）`, N.broke);
    ok(N.noHead.head === null && N.noHead.asked === 0 && N.noHead.wood === 0 && N.noHead.spent === 0 && N.noHead.cand, `${tag} 沒有首長的時候：沒有人被問、也不會偷偷補，缺口仍然是村民可以提的案`, N.noHead); }
  // 6
  { const Tr = r.trade;
    ok(Tr.ids.join() === 'deal,sell,buy,clear,refuse' && Tr.idsSell.includes('sell') && !Tr.idsSell.includes('buy') && !Tr.idsSell.includes('deal') && !Tr.idsSave.includes('buy') && !Tr.idsSave.includes('deal') && Tr.idsSave.includes('refuse'), `${tag} 這趟買賣的選項照行商的貨列；首長說這週不買的時候沒有「買」的選項`, { all: Tr.ids, sell: Tr.idsSell, save: Tr.idsSave });
    ok(Tr.avail === 21 && Tr.buy.wood === 10 && Math.abs(Tr.buy.silver - 51) < 0.01 && Tr.buy.meals === 0 && Tr.buy.run === 'buy' && Tr.buy.leak === 0 && Tr.buy.moved === -20, `${tag} 買貨不超過計畫的預算：公庫 71、要留 50，只買得起 10 份（每份 2），沒有多花`, Tr);
    ok(Tr.availCap === 6 && Tr.cap.wood === 3 && Tr.cap.spent === 6 && Tr.cap.week === 30 && Tr.cap.leak === 0, `${tag} 計畫有每週上限時：這週已經花了 24、上限 30，只再買 6 銀幣的貨`, Tr.cap);
    ok(Tr.deal.meals === -25 && Tr.deal.wood === Tr.deal.floor && Math.abs(Tr.deal.silver - (50 - Tr.deal.floor * 2)) < 0.01 && Tr.deal.leak === 0 && Tr.deal.who, `${tag} 照計畫買賣：多出來的餐食賣一半（最多 25 份）、木材買到平常的量，成交紀錄記的是出面談的人`, Tr.deal);
    ok(Tr.refuse.run === 'refuse' && Tr.refuse.wood === 0 && Tr.refuse.silver === 5000 && Tr.refuse.wood2 === 0 && Tr.refuse.again === 0 && Tr.refuse.leak === 0, `${tag} 可以不做：什麼都沒買賣，這位行商待著的幾天也不會再自動成交`, Tr.refuse);
    ok(Tr.bad === 'refuse' && Tr.good === 'sell', `${tag} 照個性：收購價只有行情的兩成時不做，價錢好就賣`, { bad: Tr.bad, good: Tr.good });
    ok(Tr.dayRun.asked && Tr.dayRun.kind === 'tradeRun' && Tr.dayRun.who && Tr.dayRun.run && Tr.dayRun.leak === 0, `${tag} 行商在鎮上的那一天：去問出面談的人、照他說的做，帳對得上`, Tr.dayRun);
    ok(Tr.cIds.join() === 'swap,half,refuse' && Tr.swap.stone === -10 && Tr.swap.cloth === 10 && Tr.swap.leak === 0 && Tr.swap.again === 0, `${tag} 跨鎮商隊：照換／換一半／不換；換了就是 10 份換 10 份，同一隊不會換兩次`, { ids: Tr.cIds, swap: Tr.swap });
    ok(Tr.cRefuse.stone === 0 && Tr.cRefuse.cloth === 0 && Tr.cAsk.asked === true && Tr.cAsk.kind === 'tradeRun' && Tr.cHeld === 0 && Tr.cHeldPart === 195, `${tag} 商隊可以不換；商隊到了會去問人；保留的料不拿去換（全保留就不換，保留 195 份就只拿多出來的 5 份去換）`, { ref: Tr.cRefuse, ask: Tr.cAsk, held: Tr.cHeld, part: Tr.cHeldPart });
    ok(Tr.queue && Tr.queue.kept && Tr.queue.first, `${tag} 去問人的時候，別的系統排著等處理的事原樣留在佇列裡（不會被提早決定）`, Tr.queue);
    const H = Tr.house; const q = H.run.herbs;
    ok(H.role === 'owner' && H.who && H.ids.join() === 'house,refuse' && q >= 2 && q * H.run.loc <= 63.01 && Math.abs(H.run.treasury - (q * H.run.loc - q * 2 * H.run.rate)) < 0.03 && Math.abs(H.run.boss - (q * H.run.loc - q * 2 * (1 + H.run.rate))) < 0.03 && H.run.leak === 0 && Math.abs(H.run.moved + q * 2) < 0.03 && H.save === 0, `${tag} 私人商行：由東家決定做不做；公庫收進口貨花的錢不超過計畫的預算（63），首長說不買就做不成；流出鎮外的只有付給行商的貨款`, H); }
  // 7
  { const Mi = r.mind;
    ok(Mi.days >= 10 && Mi.plainPick && Mi.plainPick.id === 'usual' && Mi.plainPick.src === 'rule' && Mi.frugalPick && Mi.frugalPick.id === 'lean', `${tag} 照個性：同樣的處境，一般的首長照平常備，節儉又容易操心的首長只備最要緊的`, { days: Mi.days, plain: Mi.plainPick, frugal: Mi.frugalPick });
    ok(Mi.payPlain !== 'low' && Mi.payKind === 'low', `${tag} 照個性：心軟大方的首長先發工資最低的人，一般的首長不會`, { plain: Mi.payPlain, kind: Mi.payKind });
    ok(Mi.aiOn && Mi.ai && Mi.ai.pending && Mi.ai.e && Mi.ai.e.id === 'lean' && Mi.ai.e.src === 'ai' && Mi.ai.e.reason === 'model reason 42' && Mi.ai.mode === 'lean' && Mi.ai.lg && Mi.ai.lg.id === 'lean' && Mi.ai.lg.ai === 1 && Mi.ai.lg.why === 'model reason 42', `${tag} 開智能體：等 AI 回話，記下它選的「只備最要緊的」和它說的理由，計畫跟著改`, Mi.ai);
    ok(Mi.ai && Mi.ai.civic === 1 && Mi.ai.town === 0 && Mi.ai.prompt && Mi.ai.prompt.facts && Mi.ai.prompt.code, `${tag} 問 AI 用的是公家的事那一組的額度（全鎮的 10 件沒少），題目裡有事實與選項代號`, Mi.ai);
    ok(Mi.ai2 && Mi.ai2.wait && Mi.ai2.e && Mi.ai2.e.kind === 'tradeRun' && Mi.ai2.e.id === 'refuse' && Mi.ai2.e.src === 'ai' && Mi.ai2.run === 'refuse' && Mi.ai2.wood === 0 && Mi.ai2.civic === 2, `${tag} 這趟買賣也一樣：AI 回話之前不成交，它說不做就沒有成交`, Mi.ai2); }
  // 8
  { const Pm = r.pay; const half = Math.round(Pm.net * 0.5 * 100) / 100; const tot = (x) => Math.round((x.care + x.rest) * 100) / 100;
    ok(Pm.pub >= 3 && Pm.care >= 1, `${tag} 鎮上有領公庫薪水的人，其中有守衛或醫生`, { pub: Pm.pub, care: Pm.care });
    ok([Pm.even, Pm.careFirst, Pm.low].every(x => x.leak === 0 && x.moved === 0 && Math.abs(tot(x) - (half - x.left)) < 0.05 && x.left <= 0.055 * Pm.pub + 0.01), `${tag} 公庫只夠發一半：三種發法都把公庫發完（頂多每人剩 5 分錢的零頭，這是原本平分的算法留的），大家領到的加起來等於公庫付出去的，全鎮的錢沒有變（銀幣守恆）`, { even: Pm.even, care: Pm.careFirst, low: Pm.low, half });
    ok(Pm.careFirst.care > Pm.even.care + 0.5 && Pm.careFirst.rest < Pm.even.rest - 0.5 && Pm.careFirst.unpaid < Pm.even.unpaid, `${tag} 先發守衛和醫生：他們領得比照比例多，其他人領得少`, { even: Pm.even, care: Pm.careFirst }); }
  // 10
  { const Te = r.tech;
    ok(Te.before === 0 && Te.pick === 'ask' && Te.tech === 4 && Te.after === 20 && Te.wAfter > Te.wBefore && Te.cleared, `${tag} 首長請學者先顧升格要的科技：學者自己挑的 20 次都先挑那一項（以前 0 次），提案也比較會提；升格不卡科技之後就不算數`, Te); }
  // 9
  { const S = r.save;
    ok(S.dflt === 1 && S.mode === 'usual' && S.same, `${tag} 沒有計畫的鎮（舊存檔）：買的原料跟以前每天進口的規則一模一樣`, { got: S.got, old: S.old });
    ok(S.shop.food === S.shop.wantFood && S.shop.tools === 5, `${tag} 糧食、工具照以前商店補貨的量（糧食補到每人 4 份、工具補到 5）`, S.shop);
    ok(S.load.procure === null && S.load.hold === null && S.load.mode === 'usual' && S.load.dflt === 1, `${tag} 讀沒有計畫的舊存檔：不會出錯，先照老規矩`, S.load);
    ok(S.round.mode === 'lean' && S.round.cap === 123 && S.round.pay === 'care' && S.round.hold === 5 && S.round.locked === 5, `${tag} 存讀檔帶著計畫、發薪的先後與保留的料`, S.round); }
  ok(r.ui.plan && r.ui.hold && r.ui.hold.wood === 60 && r.ui.brief && r.ui.briefOther === '', `${tag} 帳本：首長的帳本寫得出這週的採購與保留的料；不相干的人的帳本沒有這一句`, r.ui);
  ok(r.ui.dom && !r.ui.dom.err && r.ui.dom.plan.length > 8 && r.ui.dom.holds.length === 2 && /60/.test(r.ui.dom.holds[0]) && /40/.test(r.ui.dom.holds[1]), `${tag} 介面：原料倉庫那張卡寫出這週的採購是誰定的、首長為升格保留的料、已批准提案保留的料`, r.ui.dom);
  // 11
  ok(r.run.errs.length === 0 && r.run.mayor >= 2 && r.run.other === 0 && !r.run.dflt, `${tag} 放著跑 20 天：首長每週拿主意、沒有錯誤、帳上沒有對不上的錢`, r.run);
  ok(zh || (!r.keys.some(cjk) && !r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 新句子、給首長與商人看的事實、選項、理由與結果都有英文`, zh ? null : { keys: r.keys.filter(cjk), texts: r.texts.filter(cjk).slice(0, 4), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
