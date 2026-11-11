// v9.23.1 作物停止生長＋加成相加不會變成負數
// 氣溫低於 0 度，或遇到極端氣候（暴風雨／暴風雪／熱浪／乾旱，或衝擊農業的天災）時，田裡的作物停止生長：種田的當天沒有收成，打魚打獵照舊；
// 有深井／灌溉的鎮乾旱時作物照長。
// 壞天氣＋天災＋負面政令（或貿易加成一路疊上去）加起來超過 100% 時，農夫／礦工的產量、研究點、商人的賣價與收購價以前會變成負的
// （農夫越種糧越少、賣東西給商人反而倒貼）。現在產量與研究點最多歸零、商人折扣最多打到四折、收購價最低四成。
// 驗：極端情況不出現負數、平常的數字沒有被動到、中英文
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  console.log(`— ${lang}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const sp = w.stockpile, C = w.council, W = w.weather, B = w.buildings, R = w.research;
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const names = (k) => new Set(npcs.filter(a => a.job?.key === k).map(a => a.name));
    const farmers = names('farmer'), miners = names('miner'); const grainers = new Set(npcs.filter(a => a.job?.key === 'farmer' && ECON.roleOf(w, a) === 'grain').map(a => a.name));
    { const fs = npcs.filter(a => a.job?.key === 'farmer'); if (!fs.some(a => ECON.roleOf(w, a) !== 'grain') && fs.length > 1) fs[fs.length - 1].foodRole = 'fish'; if (!fs.some(a => ECON.roleOf(w, a) === 'grain')) delete fs[0].foodRole, ECON.S(w).roles[fs[0].agentId] = 'grain'; grainers.clear(); for (const a of fs) if (ECON.roleOf(w, a) === 'grain') grainers.add(a.name); } // 確保兩種都有
    out.have = { farmers: farmers.size, grain: grainers.size, miners: miners.size, scholars: names('researcher').size };
    // 建築／科技的加成先固定住（各鎮開局不同），只留要驗的那一項
    const OV = { farm_bonus: 0, stone_efficiency: 0, research_bonus: 0, trade_bonus: 0, drought_resistance: 0 }; const _ge = B.getEffect; B.getEffect = function (k, d = 0) { return k in OV ? OV[k] : _ge.call(this, k, d); };
    if (w.harborFlags) w.harborFlags.granary = false; if (w.econ) w.econ.paperShort = false;
    for (const k of ['farm_bonus', 'mining_bonus', 'research_bonus', 'sell_bonus', 'buy_bonus']) w.news.activeModifiers[k] = 0; // 當天剛好有的新聞加成先歸零
    const decree = (k, v, n) => { const d = C._decreeDay(w); C.activeDecrees = (C.activeDecrees || []).filter(x => !/^t_/.test(x.id)); for (let i = 0; i < n; i++) C.activeDecrees.push({ id: 't_' + k + i, title: 'x', effects: { [k]: v }, expiresDay: d + 5 }); C._aggregateDecrees(w); };
    const wx = (cur, dis, temp = 15) => { W._temperature = temp; W.current = cur; W.activeDisaster = dis ? { type: 'blizzard_severe', name: 'x', desc: '', severity: 'major', daysLeft: 3, effects: { farm: -0.6, mood: -15 } } : null; };
    // 跑一次每日生產，記下農夫／礦工各加了多少、有沒有負的
    const day = () => { const neg = []; let farm = 0, mine = 0, grain = 0; const _a = sp.add; sp.add = function (r, n, tick, why, src) { if (!(n >= 0)) neg.push([r, n]); if (farmers.has(src) && r === 'food') { farm += n; if (grainers.has(src)) grain += n; } if (miners.has(src) && (r === 'stone' || r === 'metal')) mine += n; return _a.call(this, r, n, tick, why, src); };
      const food0 = sp.get('food'); try { sp.resources.food = 50; sp.resources.stone = 0; sp.resources.metal = 0; /* 存量低 → 需求導向不會把產量壓掉 */ processDailyProduction(w); } finally { sp.add = _a; sp.resources.food = Math.max(food0, 500); } return { neg, farm: Math.round(farm * 10) / 10, grain: Math.round(grain * 10) / 10, other: Math.round((farm - grain) * 10) / 10, stop: W.cropStop(w), mine: Math.round(mine * 10) / 10, stockOk: Object.values(sp.resources).every(v => v >= 0) }; };
    w.clock.season = '春季';
    wx('clear', false); decree('farm_bonus', 0, 0); out.normal = day();
    wx('rain', false); out.rain = day();
    // 作物停止生長
    w.clock.season = '冬季'; wx('cloudy', false, -3); out.cold = day();
    wx('cloudy', false, 0.4); out.zero = day(); // 顯示 0 度：還沒低於 0
    wx('snow', false, 3); out.snowWarm = day(); // 下雪但沒到零下：只是變慢
    w.clock.season = '夏季'; for (const k of ['storm', 'heatwave', 'drought']) { wx(k, false, 30); out['x_' + k] = day(); }
    OV.drought_resistance = 0.5; wx('drought', false, 30); out.droughtWell = day(); wx('heatwave', false, 30); out.heatWell = day();
    W.current = 'clear'; W.activeDisaster = { type: 'drought_severe', name: 'x', desc: '', severity: 'major', daysLeft: 3, effects: { farm: -0.3 } }; out.disDroughtWell = day(); OV.drought_resistance = 0; out.disDrought = day();
    W.activeDisaster = { type: 'caravan_raid', name: 'x', desc: '', severity: 'major', daysLeft: 3, effects: { mood: -12 } }; out.disRaid = day(); W.activeDisaster = null;
    w.clock.season = '冬季'; wx('blizzard', true, -15); out.blizzard = day(); out.blizzardMod = W.farmModifier; // 暴風雪 −50% ＋ 極端暴風雪 −60%
    // 狀態改變那天才講一次；存讀檔
    { const logs = []; const _l = w.logMessage; w.logMessage = function (ty, c, ...r) { if (/作物/.test(String(c)) || /[Cc]rops/.test(String(c))) logs.push(String(c)); return _l.call(this, ty, c, ...r); };
      const upd = (temp) => { const _u = W._updateEnvironment, _a = W._advanceWeather, _c = W._checkDisasterEscalation; W._updateEnvironment = () => { W._temperature = temp; }; W._advanceWeather = () => {}; W._checkDisasterEscalation = () => {}; try { W.dailyUpdate(w); } finally { W._updateEnvironment = _u; W._advanceWeather = _a; W._checkDisasterEscalation = _c; } };
      W.current = 'cloudy'; W.activeDisaster = null; W.disasterWarning = null; W._cropWas = null; upd(-4); upd(-5); const n1 = logs.length; upd(8); const n2 = logs.length; upd(9); out.logs = { n1, n2, n3: logs.length, first: logs[0], last: logs[logs.length - 1] };
      W._cropWas = 'cold'; const sv = W.serialize(); const W2 = new WeatherSystem(); W2.loadFrom(sv); out.saved = W2._cropWas; w.logMessage = _l; }
    w.clock.season = '春季'; wx('clear', false); decree('farm_bonus', -0.3, 5); out.decFarm = day();
    decree('mining_bonus', -0.3, 5); out.decMine = day();
    decree('mining_bonus', -0.3, 1); out.decMine1 = day();
    // 研究點
    decree('research_bonus', 0, 0); out.rpNormal = R._scholarPts(w);
    decree('research_bonus', -0.3, 5); out.rpNeg = R._scholarPts(w);
    decree('research_bonus', -0.3, 1); out.rpOne = R._scholarPts(w);
    // 商人的價格
    const rep0 = w.reputationSystem; w.reputationSystem = null; // 聲望折扣另外算，這裡只看疊加
    const prices = (n) => { const all = []; for (let i = 0; i < n; i++) { w.trade.merchant = null; w.trade._spawnMerchant(w); for (const o of w.trade.merchant.offers) all.push({ r: o.resource, p: o.price, buy: !!o.isBuying, k: o.price / (BASE_PRICES[o.resource] || 5) }); } return all; };
    const rng = (a) => ({ n: a.length, min: Math.round(Math.min(...a.map(x => x.k)) * 100) / 100, max: Math.round(Math.max(...a.map(x => x.k)) * 100) / 100, bad: a.filter(x => !(x.p > 0)).length });
    decree('sell_bonus', 0, 0); OV.trade_bonus = 0; { const a = prices(40); out.mNormal = { sell: rng(a.filter(x => !x.buy)), buy: rng(a.filter(x => x.buy)) }; }
    OV.trade_bonus = 1.65; { const a = prices(40); out.mTrade = { sell: rng(a.filter(x => !x.buy)), buy: rng(a.filter(x => x.buy)) }; } // 貿易加成疊到 165%（全部蓋滿的上限）
    OV.trade_bonus = 0; decree('sell_bonus', -0.3, 5); { const a = prices(40); out.mSellNeg = { buy: rng(a.filter(x => x.buy)) }; }
    // 真的賣一筆給商人：公庫的銀幣不能變少
    { w.trade.merchant = null; w.trade._spawnMerchant(w); const M = w.trade.merchant; const i = M.offers.findIndex(o => o.isBuying); const o = M.offers[i]; sp.resources[o.resource] = 100; const s0 = sp.get('silver'); const res = w.trade.executeTrade(i, 5, w); out.sale = { d: Math.round((sp.get('silver') - s0) * 10) / 10, err: res?.error || null, price: o.price }; }
    decree('sell_bonus', 0, 0); w.reputationSystem = rep0; B.getEffect = _ge;
    // 概況卡：天氣對農業的影響最多顯示 −100%
    w.clock.season = '冬季'; wx('cloudy', false, -3); app.state = w.getState(); { const h = app._icEnv(); const txt = h.replace(/<[^>]+>/g, ' '); out.cardCold = { stop: app.state.weather.cropStop, kpi: /停止|Halted/.test(txt), why: /0°C/.test(txt), cjk: /[\u4e00-\u9fff]/.test(txt) }; }
    wx('heatwave', false, 40); app.state = w.getState(); { const txt = app._icEnv().replace(/<[^>]+>/g, ' '); out.cardHot = { stop: app.state.weather.cropStop, why: /極端氣候|Extreme weather/.test(txt) }; }
    w.clock.season = '春季'; wx('rain', false, 14); app.state = w.getState(); { const h = app._icEnv(); out.cardRain = { stop: app.state.weather.cropStop, pct: (h.match(/\+20/) || [])[0] || null, halted: /停止|Halted/.test(h.replace(/<[^>]+>/g, ' ')) }; }
    w.clock.season = '冬季'; W.cropStop = () => null; wx('blizzard', true, -15); app.state = w.getState(); const html = app._icEnv(); delete W.cropStop; out.card = (html.match(/(-?\d+)\s*<small[^>]*>%/) || html.match(/([+-]\d+)[^<]{0,3}%/) || [])[1] || html.replace(/<[^>]+>/g, ' ').slice(0, 160);
    wx('clear', false);
    return out;
  });
  ok(r.have.farmers > 0 && r.have.miners > 0 && r.have.scholars > 0, '鎮上有農夫、礦工、研究員', r.have);
  ok(r.normal.farm > 0 && r.normal.mine > 0 && !r.normal.neg.length, '平常：農夫與礦工照常有產出', r.normal);
  ok(r.rain.farm > r.normal.farm * 0.95, '下雨：收成不比晴天差（加成照舊）', [r.rain.farm, r.normal.farm]);
  ok(r.blizzardMod < -1, '冬天暴風雪＋極端暴風雪：天氣的扣減超過 100%', r.blizzardMod);
  ok(r.blizzard.grain === 0 && r.blizzard.other >= 0 && !r.blizzard.neg.length && r.blizzard.stockOk, '這種天氣種田的沒有收成，也不會把存糧種掉', r.blizzard);
  ok(r.have.grain > 0 && r.have.grain < r.have.farmers, '農夫裡有種田的，也有打魚打獵的', r.have);
  ok(r.cold.stop === 'cold' && r.cold.grain === 0 && r.cold.other > 0, '氣溫 −3 度：作物停止生長（種田的沒收成），打魚打獵照舊', r.cold);
  ok(r.zero.stop === null && r.zero.grain > 0, '氣溫 0 度（還沒低於 0）：作物照長', r.zero);
  ok(r.snowWarm.stop === null && r.snowWarm.grain > 0, '下雪但沒到零下：只是長得慢，沒有停', r.snowWarm);
  for (const k of ['storm', 'heatwave', 'drought']) ok(r['x_' + k].stop === 'extreme' && r['x_' + k].grain === 0 && r['x_' + k].other > 0, `極端氣候（${k}）：作物停止生長`, r['x_' + k]);
  ok(r.droughtWell.stop === null && r.droughtWell.grain > 0, '有深井／灌溉的鎮：乾旱時作物照長', r.droughtWell);
  ok(r.heatWell.stop === 'extreme' && r.heatWell.grain === 0, '有深井也擋不住熱浪', r.heatWell);
  ok(r.disDrought.stop === 'extreme' && r.disDrought.grain === 0 && r.disDroughtWell.stop === null && r.disDroughtWell.grain > 0, '嚴重乾旱的天災：沒有深井作物就停，有深井照長', [r.disDrought, r.disDroughtWell]);
  ok(r.disRaid.stop === null && r.disRaid.grain > 0, '跟天氣無關的災難（商隊劫案）不影響作物', r.disRaid);
  ok(r.logs.n1 === 1 && r.logs.n2 === 2 && r.logs.n3 === 2 && /🥶/.test(r.logs.first) && /🌱/.test(r.logs.last), '停止／恢復生長各只在那天講一次', r.logs);
  ok(r.saved === 'cold', '存讀檔後記得作物正停著（不會重講）', r.saved);
  ok(r.cardCold.stop === 'cold' && r.cardCold.kpi && r.cardCold.why && (lang === 'zh' || !r.cardCold.cjk), '概況卡：零下時農業顯示「停止」並寫出原因', r.cardCold);
  ok(r.cardHot.stop === 'extreme' && r.cardHot.why, '概況卡：極端氣候時寫出原因', r.cardHot);
  ok(r.cardRain.stop === null && r.cardRain.pct === '+20' && !r.cardRain.halted, '概況卡：平常照舊顯示加成（下雨 +20%）', r.cardRain);
  ok(r.decFarm.stop === null && r.decFarm.farm === 0 && !r.decFarm.neg.length, '五道 −30% 農業政令疊起來：收成歸零、不會變負', r.decFarm);
  ok(r.decFarm.mine > 0, '農業政令不影響礦工', r.decFarm.mine);
  ok(r.decMine.mine === 0 && !r.decMine.neg.length && r.decMine.stockOk, '採礦的扣減超過 100%：產量歸零、不會變負', r.decMine);
  ok(r.decMine1.mine > 0 && r.decMine1.mine < r.normal.mine * 1.05, '只有一道 −30%：礦工照樣有產出，只是變少', [r.decMine1.mine, r.normal.mine]);
  ok(r.rpNormal > 0 && r.rpNeg === 0, '研究的扣減超過 100%：研究點歸零、不會倒扣', [r.rpNormal, r.rpNeg]);
  ok(Math.abs(r.rpOne - r.rpNormal * 0.7) < 0.01, '只有一道 −30%：研究點剛好是七成（平常的算法沒動）', [r.rpOne, r.rpNormal]);
  ok(r.mNormal.sell.min >= 1.15 && r.mNormal.sell.max <= 1.85 && r.mNormal.buy.min >= 0.45 && r.mNormal.buy.max <= 0.85, '沒有加成時商人的價格跟以前一樣（賣 1.2～1.8 倍、收 0.5～0.8 倍）', r.mNormal);
  ok(r.mTrade.sell.bad === 0 && r.mTrade.sell.min >= 0.4 && r.mTrade.sell.max <= 0.8, '貿易加成疊到 165%：商人賣價最多打到四折，不會免費或倒貼', r.mTrade.sell);
  ok(r.mTrade.buy.min > r.mNormal.buy.max, '貿易加成照樣讓商人收購價變高', [r.mTrade.buy, r.mNormal.buy]);
  ok(r.mSellNeg.buy.bad === 0 && r.mSellNeg.buy.min >= 0.15 && r.mSellNeg.buy.max <= 0.4, '賣價扣減超過 100%：收購價最低四成，不會變負', r.mSellNeg.buy);
  ok(!r.sale.err && r.sale.d > 0, '這時賣東西給商人，公庫的銀幣是增加的', r.sale);
  ok(String(r.card) === '-100', '概況卡：天氣對農業的影響最多顯示 −100%', r.card);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
