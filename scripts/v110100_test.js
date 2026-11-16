// v11.1.0 開哪一種店由本人挑；硬木與大理石用在門面建築
//   1) 他能開哪幾種：拿手的排第一、本行對應的店、有創意的人可以開畫坊、不需要手藝的三種；最多四種
//   2) 題目寫出鎮上各種店有幾家、哪幾種還沒人開
//   3) 選項：再想想、他能開的每一種（代號都帶店種，拿手的排第一）；同一種越多越沒把握、還沒人開的多一點
//   4) 選了別種就真的開那一種，本錢照付、全鎮的錢不多不少；他開不了的種類不會被硬開
//   5) 照個性決定時：鎮上滿是畫坊與古玩鋪，新開的店會散到別種去
//   6) 五棟門面建築直接要硬木或大理石：蓋的時候真的用掉；鎮上沒有也照樣提得出來（向外地訂）
//   7) 中英
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 2, { seed: 21 });
    const out = {}; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const K = DECIDE.KINDS, BZ = BIZ.S(w); const tr = (a, list) => { a.personality.traits = list.slice(); };
    const adults = npcs().filter(a => (a.age || 30) >= 22 && a.job?.key !== 'mayor'); const byJob = (j) => adults.filter(a => a.job?.key === j);
    const Wl = WALLET.S(w); MONEY.S(w); const cash = (a, n) => { Wl.bal[a.agentId] = n; }; const clear = () => { BZ.shops = []; };
    const put = (type, n) => { for (let i = 0; i < n; i++) BZ.shops.push({ id: 'T' + BZ.shops.length, owner: 'x' + BZ.shops.length, name: ['測', 'T'], type, profit: 0, price: 3 }); };
    const sc = (a, id) => { const c = K.startup.when(w, a); if (!c) return null; const op = K.startup.options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const ids = (a) => { const c = K.startup.when(w, a); return c ? K.startup.options(w, a, c).map(o => o.id) : null; };
    const trader = byJob('trader')[0], cook = byJob('cook')[0], farmer = byJob('farmer')[0], doctor = byJob('doctor')[0], smith = byJob('blacksmith')[0];
    for (const a of [trader, cook, farmer, doctor, smith]) { cash(a, 300); tr(a, ['hardworking']); }

    // 1) 他能開哪幾種
    clear();
    { tr(trader, ['hardworking', 'creative']); const kc = BIZ.kindsFor(w, trader); tr(trader, ['hardworking']); const kt = BIZ.kindsFor(w, trader);
      const kd = BIZ.kindsFor(w, doctor), kk = BIZ.kindsFor(w, cook), kf = BIZ.kindsFor(w, farmer), ks = BIZ.kindsFor(w, smith);
      out.kinds = { creative: kc.map(x => x.key), creativeOwn: kc[0].own && kc[0].key === BIZ.typeFor(Object.assign(Object.create(trader), { personality: { traits: ['creative'] } })), trader: kt.map(x => x.key), doctor: kd.map(x => x.key), cook: kk.map(x => x.key), farmer: kf.map(x => x.key), smith: ks.map(x => x.key),
        max4: [kc, kt, kd, kk, kf, ks].every(l => l.length >= 3 && l.length <= 4 && new Set(l.map(x => x.key)).size === l.length), firstOwn: [kc, kt, kd, kk, kf, ks].every(l => l[0].own && l.slice(1).every(x => !x.own)), natF: BIZ.typeFor(farmer) };
      // 鎮上少的排前面
      put('inn', 3); const kd2 = BIZ.kindsFor(w, doctor); out.kinds.sorted = kd2.map(x => x.key + ':' + x.n); clear(); }

    // 2) 題目
    { put('studio', 5); put('curio', 4); put('apothecary', 1); const f = K.startup.facts(w, cook); out.facts = { text: f, raw: /\{\w+\}/.test(f) }; out.counts = BIZ.countOf(w);
      BZ.shops.push({ id: 'L', owner: 'xl', name: ['舊', 'Old'], type: 'stall' }); out.legacy = BIZ.countOf(w).curio; BZ.shops.pop(); }

    // 3) 選項與把握
    { tr(trader, ['hardworking', 'creative']); out.ids = ids(trader); const own = BIZ.kindsFor(w, trader); out.ownKey = own[0].key;
      out.sc = { wait: sc(trader, 'wait'), open: sc(trader, 'open_' + own[0].key), others: Object.fromEntries(own.slice(1).map(x => [x.key + ':' + x.n, sc(trader, 'open_' + x.key)])) };
      clear(); out.sc0 = { open: sc(trader, 'open_' + BIZ.kindsFor(w, trader)[0].key), others: BIZ.kindsFor(w, trader).slice(1).map(x => sc(trader, 'open_' + x.key)) }; // 鎮上一家店都沒有：拿手的最有把握
      const c = K.startup.when(w, trader); out.optText = K.startup.options(w, trader, c).map(o => (typeof o.text === 'string' ? t(o.text) : t(o.text.k).replace('{ty}', t(o.text.p.ty))) + '｜' + t(o.why)); tr(trader, ['hardworking']); }

    // 4) 選了別種就真的開那一種
    { clear(); put('curio', 4); const a = trader; const other = BIZ.kindsFor(w, a).find(x => !x.own); const c0 = WALLET.get(w, a), T0 = MONEY.total(w);
      const c = K.startup.when(w, a); const res = K.startup.options(w, a, c).find(o => o.id === 'open_' + other.key).run(w, a); const sh = BIZ.shopOf(w, a);
      out.pick = { want: other.key, got: sh?.type, paid: Math.round(c0 - WALLET.get(w, a)), leak: Math.round((MONEY.total(w) - T0) * 100) / 100, res: !!res, again: K.startup.when(w, a) };
      // 開不了的種類（農夫開藥鋪）照他拿手的開
      const r2 = BIZ.startTry(w, farmer, 'apothecary'); out.bad = { type: r2.shop?.type, nat: BIZ.typeFor(farmer) };
      // 沒指定種類：照舊開拿手的
      const r3 = BIZ.startTry(w, cook); out.plain = { type: r3.shop?.type, nat: BIZ.typeFor(cook) }; }

    // 5) 照個性決定：鎮上滿是畫坊與古玩鋪
    { clear(); put('studio', 4); put('curio', 4); const pool = adults.filter(a => !BIZ.shopOf(w, a)).slice(0, 30); const tally = {}; const _r = Math.random; let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      try { for (const a of pool) { cash(a, 300); tr(a, ['hardworking', 'creative']); const c = K.startup.when(w, a); if (!c) continue; const L = DECIDE.lean(w, a);
          for (let i = 0; i < 20; i++) { let best = null, bs = -1e9; for (const o of K.startup.options(w, a, c)) { const s = DECIDE.score(L, o) + (Math.random() - 0.5) * 1.8; if (s > bs) { bs = s; best = o; } }
            const k = best.id === 'wait' ? 'wait' : best.id.slice(5); tally[k] = (tally[k] || 0) + 1; } } } finally { Math.random = _r; }
      out.spread = tally; }

    // 6) 門面建築的硬木與大理石
    { const B = BUILDING_TEMPLATES; out.bcost = Object.fromEntries(['council_hall', 'theater', 'bank', 'observatory', 'statue_plaza'].map(k => [k, B[k].costs]));
      for (const p of Object.values(w.research.projects)) { p.status = 'complete'; p.progress = p.cost; } w.research.refreshLocks?.(); const BM = w.buildings; BM.completed = BM.completed.filter(x => !out.bcost[x.buildingKey]); BM.projects = [];
      const sp = w.stockpile; const used = {};
      for (const key of Object.keys(out.bcost)) { for (const k of Object.keys(DEFAULT_STOCKPILE)) sp.resources[k] = 500; const h0 = sp.get('hardwood'), m0 = sp.get('marble'); const p = BM.startProject(key, w); let n = 0; while (BM.projects.some(x => x.buildingKey === key) && n++ < 80) BM.dailyConstruction(w);
        used[key] = { started: !!p, done: BM.completed.some(x => x.buildingKey === key), hardwood: h0 - sp.get('hardwood'), marble: m0 - sp.get('marble') }; }
      out.used = used;
      // 鎮上一塊硬木、大理石都沒有：材料還是「拿得到」（向外地訂），點子照樣提得出來
      sp.resources.hardwood = 0; sp.resources.marble = 0; out.obtain = Object.keys(out.bcost).every(k => w.proposals._obtainable(w, B[k].costs)); out.price = [BASE_PRICES.hardwood, BASE_PRICES.marble]; }
    return out;
  });
  const cjk = /[一-鿿]/;
  // 1
  ok(r.kinds.max4 && r.kinds.firstOwn, '每個人能開三到四種店，拿手的排第一、不重複', r.kinds);
  ok(r.kinds.creative[0] === 'studio' && r.kinds.creative.includes('curio') && r.kinds.trader[0] === 'curio' && !r.kinds.trader.includes('studio'), '有創意的商人：畫坊最拿手、古玩鋪也能開；沒創意的商人不能開畫坊', [r.kinds.creative, r.kinds.trader]);
  ok(r.kinds.doctor[0] === 'apothecary' && r.kinds.cook[0] === 'teahouse' && r.kinds.smith[0] === 'jeweler' && !r.kinds.farmer.includes('apothecary') && !r.kinds.farmer.includes('jeweler'), '醫生開藥鋪、廚師開茶館、鐵匠開首飾鋪；農夫開不了要手藝的店', r.kinds);
  ok(r.kinds.sorted[r.kinds.sorted.length - 1].startsWith('inn:3') || r.kinds.sorted.findIndex(x => x.startsWith('inn')) > r.kinds.sorted.findIndex(x => /^(teahouse|curio):0/.test(x)), '不需要手藝的三種裡，鎮上少的排前面', r.kinds.sorted);
  // 2
  ok(!r.facts.raw && /5/.test(r.facts.text) && /4/.test(r.facts.text) && (zh ? /畫坊 5/.test(r.facts.text) && /古玩鋪 4/.test(r.facts.text) && /還沒有人開的：/.test(r.facts.text) && /小酒館/.test(r.facts.text) && /繡坊/.test(r.facts.text) : /Studio 5/.test(r.facts.text) && /Curio shop 4/.test(r.facts.text) && /Tavern/.test(r.facts.text) && !cjk.test(r.facts.text)), '題目寫出鎮上各種店有幾家、哪幾種還沒人開', r.facts.text);
  ok(r.counts.studio === 5 && r.counts.curio === 4 && r.counts.apothecary === 1 && r.counts.inn === 0 && r.legacy === 5, '各種店的家數算得對（舊存檔的雜貨攤算古玩鋪）', [r.counts, r.legacy]);
  // 3
  ok(r.ids[0] === 'wait' && r.ids[1] === 'open_' + r.ownKey && r.ids.length >= 4 && r.ids.slice(1).every(x => x.startsWith('open_')) && new Set(r.ids).size === r.ids.length, '選項：再想想、他能開的每一種；代號都帶店種、拿手的排第一', r.ids);
  { const o = r.sc.others; const none = Object.entries(o).filter(([k]) => k.endsWith(':0')).map(([, v]) => v), many = Object.entries(o).filter(([k]) => !k.endsWith(':0')).map(([, v]) => v);
    ok(r.ownKey === 'studio' && none.length >= 1 && none.every(v => v > r.sc.open) && many.every(v => v < Math.max(...none)), '鎮上已經五家畫坊：還沒人開的那幾種比畫坊更有把握', r.sc);
    ok(r.sc0.others.every(v => v < r.sc0.open), '鎮上一家店都沒有：拿手的那一種最有把握', r.sc0); }
  ok(r.optText.every(x => !/\{\w+\}/.test(x) && (zh || !cjk.test(x))), '選項文字與理由都填得完整' + (zh ? '' : '（英文）'), r.optText);
  // 4
  ok(r.pick.got === r.pick.want && r.pick.res && r.pick.again === null, '選了別種就真的開那一種，開了之後不再被問', r.pick);
  ok(r.pick.paid === 60 && Math.abs(r.pick.leak) < 0.01, '本錢 60 照付，全鎮的錢不多不少', r.pick);
  ok(r.bad.type === r.bad.nat && r.plain.type === r.plain.nat, '他開不了的種類照他拿手的開；沒指定也照舊', [r.bad, r.plain]);
  // 5
  { const s = r.spread, opened = Object.entries(s).filter(([k]) => k !== 'wait').reduce((n, [, v]) => n + v, 0), dom = (s.studio || 0) + (s.curio || 0);
    ok(opened >= 30 && dom / opened < 0.5 && Object.keys(s).filter(k => k !== 'wait' && k !== 'studio' && k !== 'curio').length >= 2, `鎮上滿是畫坊與古玩鋪時，新開的店有一半以上散到別種（${opened} 次裡 ${opened - dom} 次）`, s); }
  // 6
  ok(r.bcost.council_hall.hardwood > 0 && r.bcost.theater.hardwood > 0 && r.bcost.bank.marble > 0 && r.bcost.observatory.marble > 0 && r.bcost.statue_plaza.marble > 0, '議事廳、劇場要硬木；銀行、天文台、雕像廣場要大理石', r.bcost);
  ok(Object.entries(r.used).every(([k, u]) => u.started && u.done && u.hardwood === (r.bcost[k].hardwood || 0) && u.marble === (r.bcost[k].marble || 0)), '蓋的時候硬木與大理石真的用掉，五棟都蓋得完', r.used);
  ok(r.obtain && r.price.every(p => p > 0), '鎮上沒有硬木大理石時材料仍然訂得到，點子照樣提得出來', [r.obtain, r.price]);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
