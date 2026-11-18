// 表決通過的最低工資要跟著存檔走（sim-wallet.js 的 serialize／loadSave）
//   以前存檔的 wallet 只存 bal、tax、unpaid、lastDay、stats、habit，沒有 minWage 與 minWageDay：
//   讀檔後最低工資不見了，發薪照市價走（WALLET.netOf、MARKET.payroll 讀 W.minWage），廢除規定那邊（sim-repeal.js）也當它從來沒立過。
//   A) 提案通過 → 存檔 → 讀檔：最低工資與開始的那一天都在；低薪的人扣稅後還是領得到下限；「現行規定」看得到這一條、實施幾天照算
//   B) 廢除之後存讀檔：還是廢除的；再恢復之後存讀檔：又有了
//   C) 舊存檔（沒有這兩欄）照樣讀得進來：當作還沒立最低工資，錢包都在，接著跑一天沒有錯誤
// 用法：BASE=http://localhost:8126/ node scripts/minwage_save_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  // /api/** 全部攔下來，不會真的去問 AI
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    const day = () => w._absDay(); const tick1 = () => { const d0 = day(); for (let j = 0; j < 400 && day() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    const trip = (x) => JSON.parse(JSON.stringify(x.serialize())); const LAW = REPEAL.LAWS.minwage;
    const npcs = (x) => Object.values(x.agents).filter(a => !a.isPlayer && !a.isDead);
    // 村民自己也會提最低工資案（剛開局那幾天可能已經有人提了）：拿掉並擋住，這支測試只看存讀檔，不要中途被鎮上自己表決改掉
    const quiet = () => { const P = w.proposals; P.items = (P.items || []).filter(q => q.kind !== 'minwage'); P.cooldown.minwage = day(); };
    tick1(); tick1(); const W = WALLET.S(w); W.tax = 0.3; W.minWage = 0; W.minWageDay = null; quiet(); // 稅重一點：照市價扣完稅一定有人低於下限
    // 照市價領不到下限的人（讀檔後拿同一個人來比）
    const low = npcs(w).filter(a => WALLET.wageOf(a) > 0).sort((a, b) => WALLET.wageOf(a) - WALLET.wageOf(b))[0];
    out.low = { job: low?.job?.key, market: low ? WALLET.netOf(W, low) : null };
    // A) 走真的提案執行那條路讓最低工資通過
    const d0 = day(); const p = { id: 'T-1', kind: 'minwage', key: 'minwage', status: 'approved', proposerName: low?.name || 'x', votes: {}, why: {}, cost: {}, category: 'welfare' };
    w.proposals._execute(w, p, d0);
    out.enact = { status: p.status, minWage: W.minWage, minWageDay: W.minWageDay, d0, on: LAW.on(w), net: low ? WALLET.netOf(W, low) : null };
    tick1(); const mw = w.wallet.minWage; // 過一天再存：開始的那一天跟存檔當天不是同一天
    const data = trip(w); out.saved = { minWage: data.wallet?.minWage, minWageDay: data.wallet?.minWageDay, mw };
    const w2 = new World(); const ok2 = w2.loadSave(JSON.parse(JSON.stringify(data))); const low2 = low && w2.agents[low.agentId];
    out.load = { ok: !!ok2, minWage: w2.wallet?.minWage, minWageDay: w2.wallet?.minWageDay, on: LAW.on(w2), since: LAW.since(w2), net: low2 ? WALLET.netOf(w2.wallet, low2) : null, tax: w2.wallet?.tax };
    // B) 廢除 → 存讀檔；恢復 → 存讀檔
    LAW.off(w); const w3 = new World(); w3.loadSave(trip(w)); out.off = { on: LAW.on(w3), minWage: w3.wallet?.minWage, since: LAW.since(w3) };
    LAW.set(w); const w4 = new World(); w4.loadSave(trip(w)); out.back = { on: LAW.on(w4), minWage: w4.wallet?.minWage, since: LAW.since(w4), day: day() };
    // C) 舊存檔：wallet 裡沒有這兩欄
    const old = JSON.parse(JSON.stringify(data)); delete old.wallet.minWage; delete old.wallet.minWageDay;
    const w5 = new World(); const ok5 = w5.loadSave(JSON.parse(JSON.stringify(old))); const low5 = low && w5.agents[low.agentId];
    out.old = { ok: !!ok5, bal: Object.keys(w5.wallet?.bal || {}).length, bal0: Object.keys(data.wallet.bal).length, tax: w5.wallet?.tax, minWage: w5.wallet?.minWage, on: LAW.on(w5), since: LAW.since(w5), net: low5 ? WALLET.netOf(w5.wallet, low5) : null };
    // 讀進正在跑的那個世界（遊戲真的讀檔時走的路），再跑一天：舊存檔沒有錯誤；新存檔的最低工資跑過發薪日還在
    try { const okA = w.loadSave(JSON.parse(JSON.stringify(old))); quiet(); tick1(); out.oldRun = { ok: !!okA, on: LAW.on(w), err: null }; } catch (e) { out.oldRun = { err: String(e) }; }
    try { const okB = w.loadSave(JSON.parse(JSON.stringify(data))); quiet(); tick1(); const again = trip(w); out.run = { ok: !!okB, minWage: w.wallet?.minWage, minWageDay: w.wallet?.minWageDay, on: LAW.on(w), saved: again.wallet?.minWage, err: null }; } catch (e) { out.run = { err: String(e) }; }
    return out;
  });
  console.log('A) 通過 → 存檔 → 讀檔');
  ok(r.low.market != null && r.low.market < 4.5, '測試前提：有人照市價扣完稅領不到最低工資', r.low);
  ok(r.enact.status === 'done' && r.enact.minWage > 0 && r.enact.minWageDay === r.enact.d0 && r.enact.on && r.enact.net === r.enact.minWage, '最低工資提案通過後生效，低薪的人領得到下限', r.enact);
  ok(r.saved.minWage === r.saved.mw && r.saved.minWage > 0 && r.saved.minWageDay === r.enact.d0, '存檔裡有最低工資與開始的那一天', r.saved);
  ok(r.load.ok && r.load.minWage === r.saved.mw && r.load.minWageDay === r.enact.d0, '讀檔後最低工資與開始的那一天都在', r.load);
  ok(r.load.net === r.saved.mw && r.load.net > r.low.market, '讀檔後低薪的人扣稅後還是領得到下限', { load: r.load, low: r.low });
  ok(r.load.on === true && r.load.since === r.enact.d0, '讀檔後「現行規定」還看得到最低工資，從哪一天開始也對', r.load);
  ok(r.run.err === null && r.run.ok && r.run.minWage >= r.saved.mw && r.run.minWageDay === r.enact.d0 && r.run.on && r.run.saved === r.run.minWage, '讀檔後再跑一天，最低工資還在，再存一次也有', r.run);
  console.log('B) 廢除與恢復');
  ok(r.off.on === false && !r.off.minWage && r.off.since === null, '廢除之後存讀檔，還是廢除的', r.off);
  ok(r.back.on === true && r.back.minWage > 0 && r.back.since === r.back.day, '恢復之後存讀檔，最低工資又有了', r.back);
  console.log('C) 舊存檔');
  ok(r.old.ok && r.old.bal === r.old.bal0 && r.old.bal > 0 && r.old.tax === 0.3, '沒有這兩欄的舊存檔讀得進來，錢包與稅率都在', r.old);
  ok(!r.old.minWage && r.old.on === false && r.old.since === null && r.old.net === r.low.market, '舊存檔當作還沒立最低工資，工資照市價', r.old);
  ok(r.oldRun.err === null && r.oldRun.ok && r.oldRun.on === false, '舊存檔讀進來再跑一天沒有出錯', r.oldRun);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close(); await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
