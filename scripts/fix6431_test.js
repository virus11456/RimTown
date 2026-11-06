// v6.43.1 實測 6 項回歸:AI 冷卻、進階農業、木工施工、舊檔科技規則、英文記憶重新翻譯(手機選單另有 t_mhead 截圖檢查)
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (r) => { const u = r.request().url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); return j({ reply: '' }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.conversationEngine, null, { timeout: 40000 }); await page.waitForTimeout(1500);
    console.log(lang);
    if (lang === 'zh') {
      let r = await page.evaluate(() => { const w = window.rimtownApp.world, L = w.conversationEngine.llm; window.rimtownApp._setPaused?.(true); w.fullAgentMode = true;
        const now = Date.now(); L._requestTimestamps = []; L._rateLimitedUntil = now + 10000; L._rateLimitedLen = 10000;
        const short = { decide: w.conversationEngine.fullAgentOk(w), chat: L._canMakeRequest(true), bg: L._canMakeRequest(false) };
        L._rateLimitedUntil = now + 20000; L._rateLimitedLen = 60000; // 60 秒限流只剩 20 秒
        const long = { decide: w.conversationEngine.fullAgentOk(w), chat: L._canMakeRequest(true) };
        L._rateLimitedUntil = 0; const free = w.conversationEngine.fullAgentOk(w); return { short, long, free }; });
      ok(!r.short.decide && !r.short.chat && !r.short.bg, '10 秒冷卻期間決策與聊天都不放行', r.short);
      ok(!r.long.decide && r.long.chat, '60 秒限流最後 30 秒:玩家聊天可插隊、完整智能體決策不行', r.long);
      ok(r.free, '冷卻結束後放行', r);
      r = await page.evaluate(() => { const w = window.rimtownApp.world; const rs = Math.random; Math.random = () => 0.5;
        const food = () => w.stockpile.get('food'); const run = () => { w.stockpile.resources.food = 50; w.stockpile.resources.meals = 500; const f0 = food(); processDailyProduction(w); return food() - f0; }; // v6.79.0 起產量看需求，兩次都從同樣的存量開始
        w.buildings.recomputeEffects(w); const before = { eff: w.buildings.getEffect('farm_bonus', 0), gain: run() };
        w.research.projects.agriculture.status = 'complete'; w.buildings.recomputeEffects(w);
        const after = { eff: w.buildings.getEffect('farm_bonus', 0), gain: run() };
        Math.random = rs; return { before, after }; });
      ok(Math.abs(r.after.eff - 0.3) < 1e-9 && r.after.gain > r.before.gain * 1.15, '進階農業:農作加成 +30%,同條件產量提高', r);
      r = await page.evaluate(() => { const w = window.rimtownApp.world, b = w.buildings;
        const mk = () => ({ id: 'tst' + Math.random(), name: 't', status: 'building', workRequired: 9999, workDone: 0, effects: {} });
        const p1 = mk(); b.projects.push(p1); b.dailyConstruction(w); const g1 = p1.workDone; b.projects = b.projects.filter(x => x !== p1);
        w.research.projects.carpentry.status = 'complete'; b.recomputeEffects(w);
        const p2 = mk(); b.projects.push(p2); b.dailyConstruction(w); const g2 = p2.workDone; b.projects = b.projects.filter(x => x !== p2);
        return { g1, g2, speed: b.getEffect('build_speed', 0) }; });
      ok(r.g1 > 0 && Math.abs(r.speed - 0.1) < 1e-9 && r.g2 > r.g1 * 1.05, '木工:建造速度 +10%,每日施工進度提高', r);
      r = await page.evaluate(() => { const w = window.rimtownApp.world;
        const save = JSON.parse(JSON.stringify(w.serialize()));
        const rp = save.research.projects; rp.agriculture.status = 'complete'; rp.agriculture.effects = { farm_bonus: 9 }; // 舊檔的舊效果
        rp.architecture.cost = 1; rp.architecture.prerequisites = []; rp.architecture.status = 'researching'; rp.architecture.progress = 0.5; save.research.current = 'architecture';
        rp.metallurgy.status = 'locked'; rp.carpentry.status = 'locked';
        save.buildings.activeEffects = { farm_bonus: 5.6, build_speed: 3 }; // 舊檔累加壞掉的效果表
        w.loadSave(save);
        const a = w.research.projects.architecture;
        return { cost: a.cost, pre: a.prerequisites, status: a.status, progress: a.progress, current: w.research.current, farm: w.buildings.getEffect('farm_bonus', 0), build: w.buildings.getEffect('build_speed', 0), agriEff: w.research.projects.agriculture.effects };
      });
      ok(r.cost > 1 && r.pre.length >= 2 && r.status === 'locked' && r.current !== 'architecture' && r.progress === 0.5, '舊檔:成本與前置用新版、前置沒完成的研究鎖回去(進度保留)', r);
      ok(Math.abs(r.farm - 0.3) < 1e-9 && r.build === 0 && r.agriEff.farm_bonus === 1.3, '舊檔:效果表依建築＋研究重算,舊的錯誤累加被校正', r);
    } else {
      const r = await page.evaluate(() => { const w = window.rimtownApp.world; const a = Object.values(w.agents).find(x => !x.isPlayer);
        const real = I18N.dictReady; I18N.dictReady = () => false; a.memory.addT(w.tickCount, w.clock.timeStr, 'daily', '鎮上出了事：{name}——{desc}', { name: '旱災', desc: '一連幾天沒下雨，田裡的作物開始枯黃，水井見底。' }, 5, []);
        const e = a.memory.entries[a.memory.entries.length - 1]; const saved = I18N.t; const before = e.text();
        I18N.dictReady = real; const after = e.text(); return { before: before.slice(0, 40), after: after.slice(0, 60) }; });
      ok(/[A-Za-z]/.test(r.after) && !/鎮上出了事/.test(r.after), '英文:字典到了以後記憶改顯示英文', r);
    }
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
