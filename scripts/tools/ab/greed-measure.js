// 改前改後對照：BASE 上的版本，指定種子各跑 DAYS 天，結果一行一個寫進 OUT（已經有的種子跳過，可以接著跑）
// 用法：node measure.js BASE OUT seed1,seed2,...
const { chromium } = require('playwright');
const fs = require('fs');
const [BASE, OUT, SEEDS] = process.argv.slice(2); const DAYS = +(process.env.DAYS || 60);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).seed) : []);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const seed of SEEDS.split(',').map(Number)) {
    if (done.has(seed)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[(Decide|Order|Home|Civic|Assembly|Compete|Power|Money|Casino|Election|Repeal|Dark)\]/.test(x)) errs.push(x.slice(0, 300)); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 });
    const r = await page.evaluate(async ({ seed, DAYS }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed }); w.observerMode = true; w.fullAgentMode = false;
      const errs = []; const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; try { w.tick(); } catch (e) { errs.push(String(e.message).slice(0, 200)); } } w.paused = true; };
      let mayorBuy = 0; const vb = WALLET.voteBuyBy; WALLET.voteBuyBy = function (...a) { const r = vb.apply(this, a); if (Array.isArray(r)) mayorBuy += r.length; return r; };
      const jailSeen = {}; let jails = 0; const d0 = w._absDay(); const MM = MONEY.S(w);
      for (let i = 0; i < DAYS; i++) { tick1(); const d = w._absDay(); for (const [id, u] of Object.entries(w.civic?.jail || {})) if (u > d && jailSeen[id] !== u) { jailSeen[id] = u; jails++; } if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); }
      let other = 0; for (const [k, D] of Object.entries(w.money?.days || {})) if (+k >= d0) other += Math.abs(D.other || 0);
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
      const rec = Object.values(w.assembly?.rec || {}); const C = w.civic || {};
      const st = w.decide?.st || {}; const pick = w.decide?.pick || {};
      return { seed, days: w._absDay() - d0, thefts: C.thefts || 0, caught: C.caught || 0, jails, bribes: rec.reduce((s, r) => s + (r.bribes || 0), 0), cbuy: rec.reduce((s, r) => s + (r.bought || 0), 0), mbuy: mayorBuy,
        lobby: w.market?.cst?.lobby || 0, papers: w.power?.stats?.bought || 0, pop: npcs.length, treasury: Math.round(w.stockpile.get('silver')), priv: Math.round(npcs.reduce((s, a) => s + WALLET.get(w, a), 0)), other: Math.round(other * 100) / 100,
        errs: errs.slice(0, 3), pick: Object.fromEntries(Object.entries(pick).filter(([k]) => /^(steal|kinPay|bribeVote|bribeTake|trustFight|buyPaper|dirty|afterOffice)\./.test(k))), famPaid: Math.round(w.money?.st?.famPaid || 0), ost: w.order?.st || null, hst: w.home?.st || null, dst: w.decide?.st || null };
    }, { seed, DAYS });
    r.pageErrs = errs.slice(0, 3); fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
