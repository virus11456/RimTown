// v11.14.0「房子」改前改後對照：BASE 上的版本，指定種子各跑 DAYS 天，結果一行一個寫進 OUT（已經有的種子跳過，可以接著跑）
// 用法：node scripts/tools/ab/house-measure.js BASE OUT seed1,seed2,...（RICH=1：每週收租前讓固定的十二個大人手上有 900 銀幣；DAYS 預設 60）
//       node scripts/tools/ab/house-cmp.js base.jsonl new.jsonl
const { chromium } = require('playwright');
const fs = require('fs');
const [BASE, OUT, SEEDS] = process.argv.slice(2); const DAYS = +(process.env.DAYS || 60); const RICH = +(process.env.RICH || 0); // RICH=1：每週收租前讓固定的十二個大人手上有 900 銀幣（模擬住久了、有人有錢的鎮），補進去的錢不算進「對不上的錢」
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).seed) : []);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const seed of SEEDS.split(',').map(Number)) {
    if (done.has(seed)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[(Decide|Estate|Order|Home|Civic|Money|Bank|Biz|Procure)\]/.test(x)) errs.push(x.slice(0, 300)); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 });
    const r = await page.evaluate(async ({ seed, DAYS, RICH }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed }); w.observerMode = true; w.fullAgentMode = false;
      const errs = []; const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; try { w.tick(); } catch (e) { errs.push(String(e.message).slice(0, 200)); } } w.paused = true; };
      const d0 = w._absDay(); let hlSum = 0, hlPeak = 0, svSum = 0, lodSum = 0, vacSum = 0, n = 0, bad = 0; const badEx = [];
      const check = () => { const E = w.estate; if (!E) return; const seen = {}; for (const u of Object.values(E.units)) { for (const hid of [u.occ, ...(u.lodgers || [])].filter(Boolean)) { seen[hid] = (seen[hid] || 0) + 1; if (E.home[hid] !== u.id) { bad++; if (badEx.length < 3) badEx.push('home-mismatch ' + hid); } } if (u.owner && !w.agents[u.owner] && !w.isAway?.(u.owner)) { bad++; if (badEx.length < 3) badEx.push('ghost-owner ' + u.id); } }
        for (const [hid, c] of Object.entries(seen)) if (c > 1) { bad++; if (badEx.length < 3) badEx.push('twice ' + hid); } for (const hid of Object.keys(E.home)) { if (E.homeless[hid] !== undefined) { bad++; if (badEx.length < 3) badEx.push('home+homeless ' + hid); } if (!E.units[E.home[hid]]) { bad++; if (badEx.length < 3) badEx.push('no-unit ' + hid); } } };
      const richOnes = RICH ? Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && (a.age ?? 30) >= 22).sort((x, y) => String(x.agentId) < String(y.agentId) ? -1 : 1).slice(0, 12) : []; let injected = 0;
      const topUp = () => { const M = MONEY.S(w); for (const a of richOnes) if (w.agents[a.agentId] === a && !a.isDead && WALLET.get(w, a) < 600) { const n = 900 - WALLET.get(w, a); WALLET.add(w, a, n); injected += n; if (typeof M.lastT === 'number') M.lastT += n; } };
      for (let i = 0; i < DAYS; i++) { if (RICH && w._absDay() % 7 === 6) topUp(); tick1(); const v = ESTATE.view(w); hlSum += v.homeless; hlPeak = Math.max(hlPeak, v.homeless); svSum += v.servants; lodSum += v.lodgers; vacSum += v.vacant; n++; check(); if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); }
      let other = 0; for (const [k, D] of Object.entries(w.money?.days || {})) if (+k >= d0) other += Math.abs(D.other || 0);
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
      const v = ESTATE.view(w); const E = w.estate; const us = Object.values(E.units); const owners = new Set(us.filter(u => u.owner).map(u => u.owner));
      const own = {}; for (const u of us) if (u.owner) own[u.owner] = (own[u.owner] || 0) + 1; const top = Math.max(0, ...Object.values(own));
      const pick = w.decide?.pick || {};
      return { seed, days: w._absDay() - d0, pop: npcs.length, hh: ESTATE.households(w).size, units: v.units, priv: us.filter(u => u.owner).length, pub: v.townOwned, vacant: v.vacant, lodgers: v.lodgers, homeless: v.homeless, homelessPeople: v.homelessPeople,
        hlAvg: Math.round(hlSum / n * 100) / 100, hlPeak, svAvg: Math.round(svSum / n * 100) / 100, lodAvg: Math.round(lodSum / n * 100) / 100, vacAvg: Math.round(vacSum / n * 100) / 100, servants: v.servants, landlords: v.landlords, owners: owners.size, topOwner: top, rent: v.rent,
        built: v.stats.built || 0, pubBuilt: v.stats.publicBuilt || 0, sold: v.stats.sold || 0, evicted: v.stats.evicted || 0, foreclosed: v.stats.foreclosed || 0, rentSum: Math.round(v.stats.rent || 0), ptax: Math.round(v.stats.ptax || 0),
        treasury: Math.round(w.stockpile.get('silver')), privSilver: Math.round(npcs.reduce((s, a) => s + WALLET.get(w, a), 0)), injected: Math.round(injected), bankLoans: Object.keys(w.bank?.loans || {}).length, other: Math.round(other * 100) / 100, bad, badEx,
        errs: errs.slice(0, 3), stats: v.stats, pick: Object.fromEntries(Object.entries(pick).filter(([k]) => /^(houseBuy|homeSell|buildRent|townHomes|hireHelp|helpOffer|pinch|landlord)\./.test(k))), dst: w.decide?.st || null };
    }, { seed, DAYS, RICH });
    r.pageErrs = errs.slice(0, 3); fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
