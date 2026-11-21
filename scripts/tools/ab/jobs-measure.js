// v11.13.0「工作與求職」改前改後對照：BASE 上的版本，指定種子各跑 DAYS 天，結果一行一個寫進 OUT（已經有的種子跳過，可以接著跑）
// 用法：node jobs-measure.js BASE OUT seed1,seed2,...   （TIER=2 大鎮；DAYS=60）
const { chromium } = require('playwright');
const fs = require('fs');
const [BASE, OUT, SEEDS] = process.argv.slice(2); const DAYS = +(process.env.DAYS || 60); const TIER = +(process.env.TIER || 2);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).seed) : []);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const seed of SEEDS.split(',').map(Number)) {
    if (done.has(seed)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[(Decide|Jobs|Finance|Clergy|Boss|Union|Market|Money)\]/.test(x)) errs.push(x.slice(0, 300)); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 });
    const r = await page.evaluate(async ({ seed, DAYS, TIER }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed }); w.observerMode = true; w.fullAgentMode = false;
      const errs = []; const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; try { w.tick(); } catch (e) { errs.push(String(e.message).slice(0, 200)); } } w.paused = true; };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
      const d0 = w._absDay(); let unempDays = 0, lowDays = 0, overDays = 0; let strikeLog = 0, fizzle = 0, concede = 0, refuse = 0, sacked = 0, waits = 0, last = (w.messageLog || []).slice(-1)[0] || null;
      const gone = [], hungryInfo = {}; // 餓到離開或餓死的人：當時有沒有工作、身上多少錢、最近做過哪些決定（查「先不找工作」會不會把人餓走）
      for (let i = 0; i < DAYS; i++) { tick1();
        try { unempDays += LABOR.unemployed(w).length; } catch (e) {}
        try { for (const k of Object.keys(MARKET.SECTORS)) if (MARKET.ownerOf(w, k) && MARKET.payRate(w, k) <= 0.7) lowDays++; } catch (e) {}
        try { const v = LABOR.view(w); for (const j of v.jobs) overDays += Math.max(0, j.filled - j.slots); } catch (e) {}
        const Lg = w.messageLog || []; const from = last ? Lg.lastIndexOf(last) + 1 : 0; /* 日誌超過 800 筆會被截短重建：用上一筆的位置接著數 */ for (let j = from; j < Lg.length; j++) { const k = String(Lg[j].k || Lg[j].content || ''); if (k.startsWith('✊ {s}的')) strikeLog++; else if (k.startsWith('😶 ')) fizzle++; else if (k.startsWith('🤝 {o}讓步了')) concede++; else if (k.startsWith('😠 {o}不肯讓步')) refuse++; else if (k.startsWith('🚪 {o}不肯讓步')) sacked++; else if (k.startsWith('🪑')) waits++; else if (k.startsWith('🎒 {a}在鎮上活不下去') || k.startsWith('💀 {a}餓了')) gone.push(Object.assign({ how: k.startsWith('🎒') ? 'left' : 'starved', day: i }, hungryInfo[Lg[j].p?.a] || {})); }
        try { for (const a of npcs()) { const h = MARKET.isHungry(w, a); if (h >= 3) hungryInfo[a.name] = { age: a.age, job: a.job?.key || null, since: w.labor?.jobless?.[a.agentId] != null ? w._absDay() - w.labor.jobless[a.agentId] : null, cash: Math.round(WALLET.get(w, a)), h, dec: (w.decide?.log?.[a.agentId] || []).slice(-4).map(e => e.kind + '.' + String(e.id).split(':')[0]).join(' ') }; } } catch (e) {} last = Lg[Lg.length - 1] || last;
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); }
      let other = 0; for (const [k, D] of Object.entries(w.money?.days || {})) if (+k >= d0) other += Math.abs(D.other || 0);
      const all = npcs(); const adults = all.filter(a => (a.age ?? 30) >= 16); const jobs = {}; for (const a of adults) { const k = a.job?.key || 'none'; jobs[k] = (jobs[k] || 0) + 1; }
      const L = w.labor || {}; const M = w.market || {}; const pick = w.decide?.pick || {};
      return { seed, days: w._absDay() - d0, pop: all.length, adults: adults.length, unemp: (() => { try { return LABOR.unemployed(w).length; } catch (e) { return -1; } })(), unempAvg: Math.round(unempDays / DAYS * 100) / 100, overAvg: Math.round(overDays / DAYS * 100) / 100, lowAvg: Math.round(lowDays / DAYS * 100) / 100,
        jobs, hired: L.stats?.hired || 0, laidOff: L.stats?.laidOff || 0, switched: L.stats?.switched || 0, grads: L.stats?.grads || 0, strikes: M.strikes || 0, wildcat: strikeLog, fizzle, concede, refuse, sacked, waits, ustrikes: w.union?.strikes || 0, union: w.union?.on ? Object.keys(w.union.members || {}).length : 0,
        clergy: all.filter(a => a.job?.key === 'priest').length, clIn: w.clergy?.st?.in || 0, clOut: w.clergy?.st?.out || 0, left: M.left || 0, starved: M.deaths || 0,
        treasury: Math.round(w.stockpile.get('silver')), priv: Math.round(all.reduce((s, a) => s + WALLET.get(w, a), 0)), other: Math.round(other * 100) / 100, mood: Math.round(all.reduce((s, a) => s + (a.mood ?? 50), 0) / Math.max(1, all.length) * 10) / 10,
        errs: errs.slice(0, 3), gone, dec: L.dec || null, pick: Object.fromEntries(Object.entries(pick).filter(([k]) => /^(jobSeek|jobSwitch|pubCut|wildcat|wildcatEnd|ordain)\./.test(k))), dst: w.decide?.st || null };
    }, { seed, DAYS, TIER });
    r.pageErrs = errs.slice(0, 3); fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
