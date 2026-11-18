// 重現「存檔讀檔之後帳上對不上」：鎮（等級 1）跑 60 天 → 存檔讀檔（同一個世界，跟量測一樣）→ 再跑 20 天
// 記：讀檔前後全鎮的錢（分項、每個錢包）有沒有變；讀檔後每一格「全鎮的錢變化 − 記進月報的流量」，對不上的那一格前後發生了什麼
// 用法：BASE=http://localhost:8188/ node repro34.js <次數> <out.json> [種子起點=9202]
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8188/'; const N = +(process.argv[2] || 1); const OUT = process.argv[3]; const SEED0 = +(process.argv[4] || 9202);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig'; const host = new URL(BASE).host;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  try {
  for (let run = res.length; run < N; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== host) return r.abort(); if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }); return r.continue(); });
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 }); await page.waitForTimeout(500);
    const seed = SEED0 + (run % 2 ? 0 : 0) + Math.floor(run / 2) * 0; // 跟量測同一個種子（亂數本身沒有種子，每次結果不同）
    await page.evaluate(({ seed }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const w = app.world; w.reset(); w.observerMode = true; ORIGIN.seed(w, 1, { seed }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false;
      const daySums = () => { const o = {}; const D = w.money?.days || {}; for (const k in D) { let s = 0; for (const c in D[k]) if (c !== 'other') s += D[k][c]; o[k] = s; } return o; };
      const tracked = (a, b) => { let s = 0; for (const k in b) s += b[k] - (a[k] || 0); return s; };
      const X = window.__r = { ticks: [], others: {}, seen: new Set(), ev: {}, jumps: [] };
      const ids = () => new Set(Object.keys(w.agents).filter(id => !w.agents[id].isPlayer && !w.agents[id].isDead));
      X.step = (n, watch) => { for (let i = 0; i < n; i++) {
        const M = MONEY.S(w); const T0 = MONEY.total(w), D0 = watch ? daySums() : null; const before = watch ? ids() : null; const at = `${w._absDay()} ${w.clock.hour}:${String(w.clock.minute).padStart(2, '0')}`; const armed = typeof M.lastT === 'number';
        const away0 = watch ? JSON.stringify((w.events?._travellingAgents || []).map(t => t?.agentData?.agentId)) : '';
        const j0 = typeof M.lastT === 'number' ? MONEY.total(w) - (M.lastT + M.pend) : null; const lc0 = M.lastClose; const shops0 = watch ? JSON.stringify((w.biz?.shops || []).map(s => [s.id, s.owner, !!s.closed])) : '';
        const tickStart = watch ? snapC() : null; X.watch = watch; X.atClose = null; const oth0 = JSON.stringify(Object.fromEntries(Object.entries(M.days).map(([k, v]) => [k, v.other || 0])));
        w.paused = false; w.tick();
        if (watch && X.atClose && JSON.stringify(Object.fromEntries(Object.entries(MONEY.S(w).days).map(([k, v]) => [k, v.other || 0]))) !== oth0 && X.diag.length < 5) { const A = tickStart, B = X.atClose; const r2 = (n) => Math.round(n * 100) / 100; const wd = []; for (const k of new Set([...Object.keys(A.bal), ...Object.keys(B.bal)])) { const dv = (B.bal[k] || 0) - (A.bal[k] || 0); if (Math.abs(dv) > 0.01) wd.push([k, r2(A.bal[k] ?? NaN), r2(B.bal[k] ?? NaN), !!w.agents[k], !!w.isAway?.(k)]); } X.diag.push({ at, silver: r2(B.silver - A.silver), reserve: r2(B.reserve - A.reserve), union: r2(B.union - A.union), faith: r2(B.faith - A.faith), pendDelta: r2(B.pend - A.pend), tracked: r2(tracked(A.days, B.days)), wallets: wd.slice(0, 15) }); }
        if (watch) { const M2 = MONEY.S(w); const j1 = typeof M2.lastT === 'number' ? MONEY.total(w) - (M2.lastT + M2.pend) : null;
          if (j0 != null && j1 != null && M2.lastClose === lc0 && Math.abs(j1 - j0) > 0.01 && X.jumps.length < 40) X.jumps.push({ at, dj: Math.round((j1 - j0) * 100) / 100 });
          const aft = ids(); const gone = [...before].filter(x => !aft.has(x)), came = [...aft].filter(x => !before.has(x)); const dd = w._absDay();
          if (gone.length || came.length) (X.ev[dd] = X.ev[dd] || []).push({ at, gone: gone.map(x => [x, w.agents[x]?.isDead ? 'dead' : (w.isAway?.(x) ? 'away' : 'left')]), came: came.map(x => [x, before.size]) });
          const shops1 = JSON.stringify((w.biz?.shops || []).map(s => [s.id, s.owner, !!s.closed])); if (shops1 !== shops0) (X.ev[dd] = X.ev[dd] || []).push({ at, shops: true });
        }
        if (watch) { const un = (MONEY.total(w) - T0) - tracked(D0, daySums()); const after = ids();
          if (armed && Math.abs(un) > 0.01 && X.ticks.length < 40) X.ticks.push({ at, un: Math.round(un * 100) / 100, gone: [...before].filter(x => !after.has(x)).map(x => [x, w.agents[x]?.isDead ? 'dead' : (w.isAway?.(x) ? 'away' : 'left')]), came: [...after].filter(x => !before.has(x)), away: away0 !== JSON.stringify((w.events?._travellingAgents || []).map(t => t?.agentData?.agentId)) }); }
        const d = w._absDay(); for (const k of Object.keys(M.days)) if (+k < d && !X.seen.has(k)) { X.seen.add(k); if (M.days[k].other) X.others[k] = M.days[k].other; }
      } };
      // 一天裡發生了什麼（給對帳用）：出遠門回來、過世、搬走、店倒或易手
      X.log0 = 0; X.diag = [];
      const snapC = () => { const r2 = (n) => Math.round(n * 100) / 100; const b = {}; for (const [k, v] of Object.entries(w.wallet?.bal || {})) b[k] = +v || 0; return { silver: +(w.stockpile?.resources?.silver || 0), reserve: +(w.bank?.reserve || 0), union: +(w.union?.fund || 0), faith: (w.faith?.rels || []).reduce((s2, R) => s2 + (+R.fund || 0), 0), bal: b, pend: w.money?.pend || 0, days: daySums() }; };
      X.snapC = snapC; const _md = MONEY.daily; MONEY.daily = function (w2, ...a) { if (X.watch && w2 === w) X.atClose = snapC(); return _md.call(this, w2, ...a); };
    }, { seed });
    for (let d = 0; d < 60; d += 10) await page.evaluate((d) => window.__r.step(960, d >= 50), d);
    const L = await page.evaluate(() => {
      const w = window.rimtownApp.world; const r2 = (n) => Math.round(n * 100) / 100;
      const parts = () => ({ total: r2(MONEY.total(w)), silver: r2(w.stockpile?.resources?.silver || 0), reserve: r2(+w.bank?.reserve || 0), union: r2(+w.union?.fund || 0), faith: r2((w.faith?.rels || []).reduce((s, R) => s + (+R.fund || 0), 0)), wallets: r2(Object.values(w.wallet?.bal || {}).reduce((s, v) => s + (+v || 0), 0)), nWallet: Object.keys(w.wallet?.bal || {}).length });
      const p0 = parts(); const bal0 = Object.assign({}, w.wallet?.bal || {}); const M0 = { lastT: w.money?.lastT, pend: w.money?.pend, lastClose: w.money?.lastClose }; const day0 = w._absDay(); const clock0 = `${w.clock.hour}:${w.clock.minute}`;
      const data = JSON.parse(JSON.stringify(w.serialize())); const ok = w.loadSave(data); w.observerMode = true; w.fullAgentMode = false;
      const p1 = parts(); const bal1 = w.wallet?.bal || {}; const diffs = []; for (const k of new Set([...Object.keys(bal0), ...Object.keys(bal1)])) { const a = +bal0[k] || 0, b = +bal1[k] || 0; if (Math.abs(a - b) > 0.01) diffs.push([k, r2(a), r2(b), !!w.agents[k], !!w.isAway?.(k)]); }
      const M1 = { lastT: w.money?.lastT, pend: w.money?.pend, lastClose: w.money?.lastClose };
      window.__r.preOthers = Object.assign({}, window.__r.others); window.__r.preJumps = window.__r.jumps.slice(); window.__r.preTicks = window.__r.ticks.slice(); window.__r.jumps = []; window.__r.ticks = []; window.__r.others = {}; window.__r.seen = new Set(Object.keys(w.money?.days || {}).filter(k => +k < w._absDay()));
      return { pre: { others: window.__r.preOthers, jumps: window.__r.preJumps, ticks: window.__r.preTicks }, ok: !!ok, day0, clock0, p0, p1, diffs: diffs.slice(0, 20), M0, M1, awayN: (w.events?._travellingAgents || []).map(t => t?.agentData?.agentId).length };
    });
    for (let d = 0; d < 20; d += 5) await page.evaluate(() => window.__r.step(480, true));
    const R = await page.evaluate(() => { const X = window.__r; const ev = {}; for (const k of Object.keys(X.others)) for (const dd of [+k - 1, +k]) if (X.ev[dd]) ev[dd] = X.ev[dd]; return { diag: X.diag, ticks: X.ticks, others: X.others, jumps: X.jumps, ev, evDays: Object.keys(X.ev).length }; });
    res.push({ run, seed, load: L, after: R, errs: errs.slice(0, 5) }); fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
    process.stderr.write(`run ${run}: day0 ${L.day0} ${L.clock0} loadDiff ${Math.round((L.p1.total - L.p0.total) * 100) / 100} pre ${JSON.stringify(L.pre)} | others ${JSON.stringify(R.others)} ticks ${R.ticks.length} jumps ${JSON.stringify(R.jumps.slice(0, 5))}\n`);
    await ctx.close();
  }
  } finally { await browser.close(); }
})();
