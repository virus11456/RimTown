// v6.45.0 種子隨機城鎮:同種子同鎮、1000 鎮分布夠散、發現上限(活著 10 個)、馬車初次造訪建存檔、存讀檔、城鎮列表、中英鎮名
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const fs = require('fs');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  console.log('node');
  { // 純生成器
    global.t = x => x; global.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
    global.TOWN_THEMES = { frontier: { townName: '邊境鎮' } }; global.TOWN_NAME_THEME = [];
    eval(fs.readFileSync('chrome-extension/sim-towngen.js', 'utf8').replace('const TownGen', 'global.TownGen'));
    const a = TownGen.card(12345), b = TownGen.card(12345);
    ok(JSON.stringify(a) === JSON.stringify(b), '同一個種子永遠產生同一個鎮', {});
    const all = []; for (let i = 0; i < 1000; i++) all.push(TownGen.card(TownGen.hash('p:' + i + ':0') || 1));
    const uniq = (k) => new Set(all.map(c => c[k])).size;
    ok(uniq('base') === 5 && uniq('temper') === 6 && uniq('policy') === 6 && uniq('era') === 3 && uniq('wealth') === 3, '1000 鎮涵蓋所有底圖／民風／政治／時代／貧富', { base: uniq('base'), temper: uniq('temper'), policy: uniq('policy'), era: uniq('era') });
    const pops = all.map(c => c.pop); ok(Math.min(...pops) === 8 && Math.max(...pops) === 30, '人口 8～30', [Math.min(...pops), Math.max(...pops)]);
    ok(new Set(all.map(c => c.name)).size > 700, '鎮名夠多樣(1000 抽超過 700 種)', new Set(all.map(c => c.name)).size);
    const mine = []; for (let i = 0; i < 30; i++) { const c = TownGen.discover('alice', { day: i }); if (c) mine.push(c); }
    ok(new Set(mine.map(c => c.name)).size === mine.length, '同一玩家發現的鎮不撞名', mine.map(c => c.name));
    let simPairs = 0; for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (TownGen.similar(mine[i], mine[j])) simPairs++;
    ok(simPairs === 0, '同一玩家發現的鎮彼此不太像', simPairs);
    ok(mine.every(c => TownGen.stockOf ? true : true) && TownGen.register(mine[0]).stockpile.food >= 60 + mine[0].pop * 6, '開局糧食夠撐', TownGen.register(mine[0]).stockpile.food);
  }
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const cloud = {};
    await page.route('**/api/**', r => { const req = r.request(); const p = new URL(req.url()).pathname.replace(/^\/api\//, ''); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (p === 'me') return j({ logged_in: true, user: { id: 1, username: 'tester' } });
      if (p === 'save' && req.method() === 'POST') { const b = JSON.parse(req.postData()); cloud[b.town_id] = b; return j({ success: true }); }
      if (p === 'saves') return j({ saves: Object.values(cloud).map(b => ({ town_id: b.town_id, town_name: b.town_name, town_theme: b.town_theme, origin: b.origin, season: b.season, year: b.year, day: b.day, population: b.population, updated_at: new Date().toISOString() })) });
      if (p.startsWith('save/')) { const id = decodeURIComponent(p.slice(5)); return j({ save_data: cloud[id]?.save_data || null }); }
      return j({ reply: '' }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1');
      for (const k of ['rimtown_harbor_unlocked', 'rimtown_mountain_unlocked', 'rimtown_forest_unlocked', 'rimtown_market_unlocked']) localStorage.setItem(k, '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const d = await page.evaluate(() => { const app = window.rimtownApp; const out = []; for (let i = 0; i < 7; i++) out.push(app._discoverGenTown(i ? 'merchant' : 'expedition', '張豪')); return { reach: out.filter(c => c && c.reachable).length, far: out.filter(c => c && !c.reachable).length, live: TownGen.liveCount() }; });
    ok(d.reach === 5 && d.far === 2 && d.live === 10, '活著的鎮最多 10 個(含邊境鎮與四鄰鎮),其餘只留城鎮卡', d);
    const nw = await page.evaluate(() => { const app = window.rimtownApp; for (let i = 0; i < 30; i++) { app._genDayKey = 'x' + i; app._genTownTick(); } return TownGen.cards().filter(c => c.state && c.state.news.length).length; });
    ok(nw >= 3, '城鎮卡會在背景發展、有傳聞', nw);
    const coach = await page.evaluate(() => { const app = window.rimtownApp; app._showCoachDialog(); const dd = document.getElementById('coach-dialog'); const x = [...dd.querySelectorAll('.coach-go span')].map(s => s.textContent); dd.remove(); return x; });
    ok(coach.filter(x => /初次造訪|first visit/.test(x)).length === 5, '馬車站列出 5 個可初次造訪的鎮', coach);
    const seed = await page.evaluate(() => TownGen.cards()[0].seed);
    await page.evaluate((s) => window.rimtownApp._visitGenTown(s), seed); await page.waitForTimeout(6500);
    const v = await page.evaluate(() => { const app = window.rimtownApp, w = app.world; const c = TownGen.cards()[0]; return { theme: w.townTheme, key: c.key, name: w.townName, cname: c.name, n: Object.values(w.agents).filter(a => !a.isPlayer).length, pop: c.pop, tid: c.townId, cur: app.currentTownId, culture: !!w.townCulture, base: app.tileMap.themeKey, cbase: c.base, roof: (app.tileMap.roofPalette || []).length, tech: Object.values(w.research.projects).filter(p => p.status === 'complete').length, ctech: c.techDone.length, title: app._townDisplayName(w.townName, w.townTheme), en: c.nameEn }; });
    ok(v.theme === v.key && v.name === v.cname && v.cur === v.tid, '初次造訪:建好存檔並抵達', v);
    ok(v.n === v.pop && v.culture && v.base === v.cbase && v.roof === 6 && v.tech === v.ctech, '人口、民風、底圖、屋頂、科技都照城鎮卡', v);
    ok(lang === 'zh' ? v.title === v.cname : v.title === v.en, '鎮名依語言顯示', v.title);
    const re = await page.evaluate(() => { const blob = JSON.parse(JSON.stringify(window.rimtownApp.world.serialize())); const w2 = new World(); const okk = w2.loadSave(blob); return { okk: !!okk, theme: w2.townTheme, seed: w2.genSeed, reg: !!blob.genRegistry }; });
    ok(re.okk && /^g/.test(re.theme) && re.seed && re.reg, '存檔→讀檔還是同一座種子鎮', re);
    await page.evaluate(() => window.rimtownApp.showTownManager()); await page.waitForTimeout(1500);
    const list = await page.evaluate(() => document.getElementById('town-list-content')?.innerText || '');
    ok(/遠方城鎮|Distant towns/.test(list) && (list.match(/只有傳聞|Rumours only/g) || []).length === 2, '城鎮列表有「遠方城鎮」,2 座只有傳聞', list.slice(-300));
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
