// v6.79.0 物資流通:需求導向生產(夠了就放慢)、作物進糧倉(工坊要用的先留)、工坊依需求換配方、精製建材可代替原料、
// 麵包糕點果醬當正餐、酒茶香水家具有人用、黃金鑄幣、商人帶作物與收加工品、60 天不會有成品無限堆積
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
    const fresh = (theme) => { w.townTheme = theme; w.townName = theme; w.rosterMode = 'scripted'; w.reset(); w.fullAgentMode = false; w.observerMode = true; };
    const SP = () => w.stockpile; const sp = { get: (r) => SP().get(r) }; const set = (r, n) => { SP().resources[r] = n; };
    const out = {};
    fresh('frontier');
    // 1) 需求導向
    set('furniture', 1000); out.dmFull = FLOW.jobDemand(w, 'carpenter'); set('furniture', 0); out.dmEmpty = FLOW.jobDemand(w, 'carpenter');
    set('stone', 5000); set('metal', 0); out.miner = FLOW.jobDemand(w, 'miner'); out.multiOut = FLOW.multiOut('miner');
    // 2) 作物進糧倉(沒有工坊時全部進)，工坊要用的先留
    set('wheat', 50); set('potato', 30); set('cotton', 20); set('cloth', 0); const f0 = sp.get('food'); w.flow = null; FLOW.daily(w);
    out.crop = { wheat: sp.get('wheat'), potato: sp.get('potato'), dFood: Math.round(sp.get('food') - f0), cotton: sp.get('cotton'), cloth: sp.get('cloth') };
    w.processing.builtFactories.bakery = { status: 'active', workers: [], warehouse: {}, recipe: null, productionProgress: 0 };
    set('wheat', 50); w.flow = null; w.flow = { notes: {}, lastDay: -1 }; FLOW.daily(w); out.reserve = sp.get('wheat');
    // 3) 工坊配方依需求
    set('plank', 100); set('hardwood', 0); set('wood', 200); out.recipe = FLOW.pickRecipe(w, FACTORIES.sawmill, {});
    set('plank', 100); set('hardwood', 100); out.idle = FLOW.pickRecipe(w, FACTORIES.sawmill, {});
    // 4) 精製建材代替原料(各留一點)
    set('wood', 0); set('plank', 30); set('hardwood', 0); out.canPay = FLOW.canPay(w, { wood: 30 }); out.cantPay = FLOW.canPay(w, { wood: 31 });
    FLOW.pay(w, { wood: 30 }, 'test'); out.plankLeft = sp.get('plank');
    set('brick', 20); set('stone', 0); out.brickKept = FLOW.canPay(w, { stone: 1 });
    // 5) 麵包糕點果醬當正餐
    set('bread', 10); set('pastry', 5); set('jam', 4); out.snack = FLOW.eatSnacks(w, 100); out.snackLeft = sp.get('bread') + sp.get('pastry') + sp.get('jam');
    // 6) 酒、茶、香水、黃金
    set('beer', 50); set('perfume', 10); set('gold', 8); const s0 = sp.get('silver'); w.flow = { notes: {}, lastDay: -1 }; FLOW.daily(w);
    out.used = { beer: 50 - sp.get('beer'), perfume: 10 - sp.get('perfume'), gold: 8 - sp.get('gold'), silver: Math.round(sp.get('silver') - s0) };
    // 7) 商人帶作物、收加工品
    const sells = MERCHANT_TYPES.flatMap(m => m.sells), buys = MERCHANT_TYPES.flatMap(m => m.buys);
    out.merchant = { sellsTea: sells.includes('tea') && sells.includes('grapes') && sells.includes('sugarcane'), buysWine: buys.includes('wine') && buys.includes('bread') && buys.includes('perfume'), noGold: !sells.includes('gold') };
    // 7b) v6.79.1 雜貨商賣稻米;收了小麥卻沒有麵包坊 → 麵包坊提案比較常出現;茶葉夠先做精製茶;金麥進糧倉
    out.rice = MERCHANT_TYPES.find(m => m.specialty === 'general').sells.includes('rice');
    w.processing.builtFactories = {}; set('wheat', 0); set('bread', 0); w.flow = { notes: {}, lastDay: -1 }; out.fitNo = FLOW.factoryFit(w, FACTORIES.bakery);
    const PM = w.proposals; if (w.research) w.research.isFactoryUnlocked = () => true; const bw = () => { PM.cooldown = {}; PM.items = []; const c = PM._candidates(w, w._absDay() + 100).find(c => c.key === 'factory:bakery'); return c ? c.weight : null; };
    out.bakeryW0 = bw();
    set('wheat', 12); FLOW.daily(w); out.wheatGone = sp.get('wheat'); out.fitYes = FLOW.factoryFit(w, FACTORIES.bakery); out.bakeryW = bw();
    set('tea', 8); set('herbs', 8); set('fine_tea', 0); set('herbal_tea', 0); out.tea = FLOW.pickRecipe(w, FACTORIES.tea_house, {});
    set('golden_wheat', 10); const g0 = sp.get('food'); w.flow.lastDay = -1; FLOW.daily(w); out.golden = { left: sp.get('golden_wheat'), dFood: Math.round(sp.get('food') - g0) };
    // 8) 跑 60 天:成品不會無限堆
    fresh('frontier'); let err = null; const d0 = w._absDay(); let peak = {};
    for (let i = 0; i < 62 * 96 && w._absDay() - d0 < 60; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; } if (i % 96 === 0) for (const k of ['clothing', 'furniture', 'tools', 'medicine']) peak[k] = Math.max(peak[k] || 0, sp.get(k)); if (i % 3000 === 0) await new Promise(r => setTimeout(r, 0)); }
    out.run = { err, peak, want: Object.fromEntries(['clothing', 'furniture', 'tools', 'medicine'].map(k => [k, Math.round(FLOW.want(w, k))])), wood: Math.round(sp.get('wood')), food: Math.round(sp.get('food')) };
    // 9) 存讀檔
    const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.saved = !!(w2.flow && w2.flow.notes);
    return out;
  });
  ok(r.dmFull <= 0.16 && r.dmEmpty === 1, '家具夠了木匠就放慢(15%)，缺貨就全力做', { full: r.dmFull, empty: r.dmEmpty });
  ok(r.miner === 1 && r.multiOut, '礦工：金屬缺就照做，石材與金屬各自看夠不夠', { miner: r.miner, multi: r.multiOut });
  ok(r.crop.wheat === 0 && r.crop.potato === 0 && r.crop.dFood >= 75 && r.crop.cotton === 0 && r.crop.cloth >= 10, '作物進糧倉、沒有紡織廠時棉花在家紡成布', r.crop);
  ok(r.reserve >= 15, '有麵包坊時小麥先留三天份', r.reserve);
  ok(r.recipe === 'hardwood' && r.idle === null, '鋸木廠做最缺的硬木；什麼都不缺就休息', { recipe: r.recipe, idle: r.idle });
  ok(r.canPay && !r.cantPay && r.plankLeft === 15, '木板可代替木材(1 換 2)，並留 15 塊給一定要用木板的建築', { can: r.canPay, cant: r.cantPay, left: r.plankLeft });
  ok(!r.brickKept, '磚塊保留量不拿去代替石材', r.brickKept);
  ok(r.snack >= 16 && r.snackLeft === 0, '麵包、糕點、果醬當正餐吃掉', { eaten: r.snack, left: r.snackLeft });
  ok(r.used.beer > 0 && r.used.perfume > 0 && r.used.gold === 5 && r.used.silver >= 100, '酒館喝酒、約會擦香水、黃金每天鑄 5 兩成銀幣', r.used);
  ok(r.merchant.sellsTea && r.merchant.buysWine && r.merchant.noGold, '異國商隊帶茶葉葡萄甘蔗、商人收酒麵包香水、不賣黃金(避免套利)', r.merchant);
  ok(r.rice, '雜貨商也賣稻米(農田 2 級以前就買得到)', r.rice);
  ok(!r.fitNo && r.fitYes && r.wheatGone === 0, '鎮上收了小麥(進糧倉後存量是 0)也記得有小麥 → 麵包坊算「有原料可用」', { no: r.fitNo, yes: r.fitYes, left: r.wheatGone });
  ok(r.bakeryW0 != null && r.bakeryW > r.bakeryW0 * 2, '有小麥沒麵包坊時，村民比較常提案開麵包坊', { before: r.bakeryW0, after: r.bakeryW });
  ok(r.tea === 'fine_tea', '茶葉夠時茶館先做精製茶', r.tea);
  ok(r.golden.left === 0 && r.golden.dFood >= 20, '金色小麥收成進糧倉(1 份抵 2 份糧食)', r.golden);
  const capOk = !r.run.err && Object.entries(r.run.peak).every(([k, v]) => v <= r.run.want[k] * 3 + 30);
  ok(capOk, '60 天：衣服、家具、工具、藥品都不會無限堆積', r.run);
  ok(r.saved, '存讀檔保留', r.saved);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
