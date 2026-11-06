// v6.77.0 經濟細緻化:穀物／魚／肉依地形、靠水才能捕魚、鹽(靠海)、紙(木匠造,報社研究用)、工具影響效率、
// 原料保底依本地產出、房子翻修與城鎮升格要建材、各鎮專長與商隊、存讀檔、本鎮物產面板(中英)、AI 鎮況
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused(true); clearInterval(app.simInterval); app.simInterval = null; const out = {};
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const run = (days) => { const d0 = w._absDay(); let err = null; for (let i = 0; i < (days + 2) * 96 && w._absDay() - d0 < days; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; } } return err; };
      const fresh = (theme, name) => { w.townTheme = theme; w.townName = name; w.rosterMode = 'scripted'; w.reset(); w.fullAgentMode = false; w.observerMode = true; };
      // 1) 海港:有漁夫、曬鹽、醃漬;30 天不挨餓
      fresh('harbor', '海風鎮'); out.hErr = run(30);
      let V = ECON.view(w); out.harbor = { fish: V.roles.fish, fishTitle: npcs().filter(a => a.foodRole === 'fish').every(a => a.job.title === '漁夫'), fishPantry: V.pantry.fish > V.pantry.meat, salt: V.salt > 0, salted: V.salted, spec: V.spec, starve: (w.messageLog || []).some(m => /挨餓/.test(m.content || '')) };
      out.harborBrief = ECON.townBrief(w);
      // 存讀檔:角色與職稱套回去
      const blob = JSON.parse(JSON.stringify(w.serialize())); const fisher = npcs().find(a => a.foodRole === 'fish');
      w.loadSave(blob); const f2 = fisher && w.agents[fisher.agentId];
      out.load = { econ: !!w.econ, role: f2?.foodRole, title: f2?.job?.title, pantry: Math.round(ECON.view(w).pantry.fish) > 0 };
      // 舊存檔(沒有 econ)照常讀
      const old = JSON.parse(JSON.stringify(blob)); delete old.econ; delete old.stockpile.resources.salt; delete old.stockpile.resources.paper;
      out.oldLoad = !!w.loadSave(old) && !run(2);
      // 2) 礦山:不靠海不能曬鹽;得靠貿易買鹽
      fresh('mountain', '礦山鎮'); run(10); V = ECON.view(w);
      out.mountain = { salt: V.salt, canSalt: V.canSalt, badSalt: V.spec.bad.includes('鹽'), goodStone: V.spec.good.includes('石材') };
      // 3) 沒有河也沒有湖:不能捕魚,角色裡沒有漁夫
      fresh('frontier', '邊境鎮'); w.townMap.terrain = 'plains'; const L = w.townMap.locations; delete L.river; delete L.lake; delete L.cave; delete L.hill; ECON.assignRoles(w); V = ECON.view(w);
      out.noWater = { canFish: V.canFish, fish: V.roles.fish, mult: ECON.mult(w, 'fish') };
      // 4) 工具:沒工具效率 7 成;夠用 10 成;充裕 1.08
      const E = ECON.S(w); w.stockpile.resources.tools = 0; E.tf = null; const f0 = ECON.toolFactor(w); w.stockpile.resources.tools = 999; E.tf = null; const f2b = ECON.toolFactor(w);
      out.tools = { none: f0, plenty: f2b };
      // 同一個農夫:沒工具時產量較低
      const farmer = npcs().find(a => a.job?.key === 'farmer'); let prodNone = 0, prodPlenty = 0;
      if (farmer) { const _r = Math.random; Math.random = () => 0.5; try {
        const _nf = ECON.noteFood; let got = 0; ECON.noteFood = function (ww, a, amt) { if (a === farmer) got += amt; return _nf.apply(this, arguments); };
        const measure = (tools) => { w.stockpile.resources.tools = tools; E.tf = null; got = 0; processDailyProduction(w); return got; };
        prodNone = measure(0); prodPlenty = measure(999); ECON.noteFood = _nf;
      } finally { Math.random = _r; } }
      out.toolProd = { prodNone, prodPlenty };
      // 5) 原料保底:本地產的 40、其他 20
      out.floor = { wood: ECON.rawFloor(w, 'wood'), metal: ECON.rawFloor(w, 'metal') };
      // 6) 紙:缺紙時研究變慢
      w.stockpile.resources.paper = 0; E.lastDay = null; for (const a of npcs()) if (a.job?.key === 'carpenter') a.job.key = 'carpenter'; const carp = npcs().filter(a => a.job?.key === 'carpenter'); carp.forEach(a => a.job.key = 'cook'); ECON.daily(w); carp.forEach(a => a.job.key = 'carpenter');
      out.paperShort = ECON.view(w).paperShort;
      const R = w.research; if (!npcs().some(a => a.job?.key === 'researcher')) { const a0 = npcs().find(a => a.job?.key !== 'mayor'); a0.job = new Job('researcher'); }
      const cur = R.current || R.getAvailable?.()[0]?.key; if (!R.current && cur) R.startResearch(cur);
      const prog = () => { w.stockpile.resources.research_points = 0; return R.projects[R.current]?.progress || 0; };
      const _r2 = Math.random; Math.random = () => 0.5; let pShort = 0, pOk = 0;
      try { const p0 = prog(); R.dailyUpdate(w); pShort = prog() - p0; w.econ.paperShort = false; const p1 = prog(); R.dailyUpdate(w); pOk = prog() - p1; } finally { Math.random = _r2; }
      out.research = { pShort, pOk };
      // 7) 翻修要建材:鎮上沒木材石材就不翻修
      if (typeof HOUSING !== 'undefined' && typeof WALLET !== 'undefined') {
        HOUSING.S(w); const _era = w.research.currentEra; w.research.currentEra = () => 2; // 時代 2 才能翻修成木骨石屋
        WALLET.S(w); for (const a of npcs()) WALLET.add(w, a, 2000);
        w.stockpile.resources.wood = 0; w.stockpile.resources.stone = 0;
        const H = HOUSING.S ? HOUSING.S(w) : w.housing; const before = JSON.stringify(H?.lv || {});
        const _r3 = Math.random; Math.random = () => 0.1; try { for (let i = 0; i < 5; i++) HOUSING.daily(w); } finally { Math.random = _r3; }
        out.houseNoMat = JSON.stringify((HOUSING.S ? HOUSING.S(w) : w.housing)?.lv || {}) === before;
        w.stockpile.resources.wood = 500; w.stockpile.resources.stone = 500;
        Math.random = () => 0.1; try { for (let i = 0; i < 5; i++) HOUSING.daily(w); } finally { Math.random = _r3; }
        out.houseMat = { changed: JSON.stringify((HOUSING.S ? HOUSING.S(w) : w.housing)?.lv || {}) !== before, woodUsed: w.stockpile.get('wood') < 500 }; w.research.currentEra = _era;
      }
      // 8) 升格要建材:達標三天但缺料就等;補料後升格並扣料
      const T = TIERS.S(w); T.lv = 0; T.up = 0; const _met = TIERS.met; TIERS.met = () => 1;
      w.stockpile.resources.wood = 0; w.stockpile.resources.stone = 0;
      try { for (let i = 0; i < 4; i++) TIERS.daily(w); out.tierWait = { lv: T.lv, up: T.up, prog: !!TIERS.progress(w)?.mat }; w.stockpile.resources.wood = 100; w.stockpile.resources.stone = 100; w.stockpile.resources.furniture = 10; ['plank', 'hardwood', 'brick', 'marble', 'luxury_furniture'].forEach(k => { w.stockpile.resources[k] = 0; }); TIERS.daily(w); out.tierUp = { lv: T.lv, wood: w.stockpile.get('wood'), stone: w.stockpile.get('stone'), furniture: w.stockpile.get('furniture') }; } catch (e) { out.tierErr = e.message; } finally { TIERS.met = _met; }
      // 9) 生成城鎮:靠海的外銷鹽、內陸的進口鹽;名字不受影響(同種子兩次一樣)
      if (typeof TownGen !== 'undefined') { let harborSalt = true, inlandSalt = true, stable = true; for (let s = 1; s < 60; s++) { const c = TownGen.card(s * 7919); const c2 = TownGen.card(s * 7919); if (c.name !== c2.name) stable = false; if (c.base === 'harbor' && !c.exports.includes('salt')) harborSalt = false; if (c.base !== 'harbor' && !c.exports.includes('salt') && !c.imports.includes('salt')) inlandSalt = false; } out.gen = { harborSalt, inlandSalt, stable }; }
      // 10) 主題貿易:海港外銷鹽,其他鎮進口鹽
      out.trade = { harbor: TOWN_THEMES.harbor.exports[0], inland: ['frontier', 'mountain', 'forest', 'market'].every(k => TOWN_THEMES[k].imports.includes('salt')) };
      // 11) 面板
      fresh('harbor', '海風鎮'); run(3);
      app.state = w.getState(); app.activeTab = 'economy'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      const sec = document.querySelector('.ec-local'); out.panel = sec ? sec.innerText.replace(/\s+/g, ' ') : null;
      out.raw = !!document.querySelector('#sidebar-content')?.innerText.match(/鹽|Salt/);
      return out;
    });
    ok(!r.hErr && r.harbor.fish >= 1 && r.harbor.fishTitle && r.harbor.fishPantry, '海港有漁夫(職稱「漁夫」),存糧以魚為主', { err: r.hErr, ...r.harbor });
    ok(r.harbor.salt && r.harbor.salted && r.harbor.spec.good.includes('鹽') && r.harbor.spec.good.includes('魚'), '海港曬鹽、醃漬,擅長魚和鹽', r.harbor);
    ok(!r.harbor.starve, '30 天沒有挨餓', r.harbor.starve);
    ok(r.load.econ && r.load.role === 'fish' && r.load.title === '漁夫' && r.load.pantry, '存讀檔後漁夫的角色、職稱與存糧組成都在', r.load);
    ok(r.oldLoad, '舊存檔(沒有經濟資料、沒有鹽和紙)照常讀、照常跑', r.oldLoad);
    ok(r.mountain.salt === 0 && !r.mountain.canSalt && r.mountain.badSalt && r.mountain.goodStone, '礦山不靠海不能曬鹽,得靠貿易;擅長石材', r.mountain);
    ok(!r.noWater.canFish && r.noWater.fish === 0 && r.noWater.mult === 0, '沒有河也沒有湖的鎮不能捕魚', r.noWater);
    ok(r.tools.none === 0.7 && r.tools.plenty === 1.08, '工具:沒有 70%、充裕 108%', r.tools);
    ok(r.toolProd.prodPlenty > r.toolProd.prodNone && r.toolProd.prodNone > 0, '同樣的人,工具充裕時產量較高', r.toolProd);
    ok(r.floor.wood === 40 && r.floor.metal === 20, '原料保底:本地產的 40、得靠貿易的 20', r.floor);
    ok(r.paperShort && r.research.pShort < r.research.pOk, '缺紙時研究變慢', { paperShort: r.paperShort, ...r.research });
    ok(r.houseNoMat && r.houseMat?.changed && r.houseMat?.woodUsed, '翻修要用木材石材:沒料不翻修,有料才翻修並扣料', { no: r.houseNoMat, ...r.houseMat });
    ok(!r.tierErr && r.tierWait.lv === 0 && r.tierWait.prog && r.tierUp.lv === 1 && r.tierUp.wood === 40 && r.tierUp.stone === 40 && r.tierUp.furniture === 4, '升格要擴建鎮公所:缺料先等,補料後升格並扣 60 木 60 石 6 家具(v6.79.0)', { err: r.tierErr, ...r.tierWait, ...r.tierUp });
    ok(r.gen && r.gen.harborSalt && r.gen.inlandSalt && r.gen.stable, '生成城鎮:靠海的外銷鹽、內陸的進口鹽、同種子結果不變', r.gen);
    ok(r.trade.harbor === 'salt' && r.trade.inland, '海港商隊優先賣鹽,其他鎮都要進口鹽', r.trade);
    ok(/本鎮擅長|good at/.test(r.harborBrief) && /鹽|salt/i.test(r.harborBrief), 'AI 鎮況知道本鎮擅長什麼', r.harborBrief);
    const cjk = (s) => (s || '').match(/[一-鿿]{2,}/g) || [];
    ok(!!r.panel && (lang === 'zh' ? /本鎮物產/.test(r.panel) && /漁夫/.test(r.panel) : /Local produce/.test(r.panel) && /Fisher/.test(r.panel) && !cjk(r.panel).length), '「本鎮物產」面板正常' + (lang === 'en' ? '(英文沒有殘留中文)' : ''), r.panel);
    ok(r.raw, '原料倉庫列出鹽', r.raw);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
