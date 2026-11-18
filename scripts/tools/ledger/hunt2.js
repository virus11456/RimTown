// 抓「讀檔後第一次結帳」的對不上：每天 6:00 存檔讀檔，下一次換日那一格把每一筆錢的變動記下來（含呼叫堆疊）
// 用法：BASE=http://localhost:8194/ node hunt.js <輪數> <out.json> [熱身天數=40] [每輪取樣天數=50]
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8194/'; const N = +(process.argv[2] || 1); const OUT = process.argv[3]; const WARM = +(process.argv[4] || 40); const SAMP = +(process.argv[5] || 50);
const PROG = OUT + '.progress';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig'; const host = new URL(BASE).host;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { rounds: [], hits: [] };
  try {
  for (let run = res.rounds.length; run < N; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== host) return r.abort(); if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }); return r.continue(); });
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 }); await page.waitForTimeout(500);
    await page.evaluate(() => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const w = app.world; w.reset(); w.observerMode = true; ORIGIN.seed(w, 1, { seed: 9202 }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false;
      const r2 = (n) => Math.round(n * 100) / 100;
      const X = window.__h = { hits: [], samples: 0, log: null };
      const stk = () => String(new Error().stack).split('\n').slice(3, 11).map(s => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < ');
      const unrec = () => { const M = w.money; return typeof M?.lastT === 'number' ? r2(MONEY.total(w) - M.lastT - M.pend) : null; };
      const push = (kind, key, before, after) => { if (!X.log) return; const u = unrec(); const last = X.log.length ? X.log[X.log.length - 1].u : X.u0; X.log.push({ kind, key, d: r2((+after || 0) - (+before || 0)), u, du: (u != null && last != null) ? r2(u - last) : null, s: stk() }); };
      const _md = MONEY.daily; MONEY.daily = function (w2, ...a) { if (X.log && w2 === w) push('DAILY_START', '', 0, 0); const r = _md.call(this, w2, ...a); if (X.log && w2 === w) { X.closedOther = w.money?.days?.[w._absDay()]?.other || 0; X.log.push({ kind: 'CLOSE', other: X.closedOther, u: 0 }); } return r; };
      const arm = () => {
        X.log = []; X.u0 = unrec(); X.restore = [];
        const W = w.wallet; if (W && W.bal) { const raw = W.bal; W.bal = new Proxy(raw, { set(t, k, v) { const b = t[k]; t[k] = v; if (typeof k === 'string' && Math.abs((+v || 0) - (+b || 0)) > 1e-9 || b === undefined) push('bal', k, b, v); return true; }, deleteProperty(t, k) { const b = t[k]; delete t[k]; push('bal-del', k, b, 0); return true; } }); X.restore.push(() => { if (w.wallet && w.wallet.bal && w.wallet.bal !== raw) { const cur = w.wallet.bal; w.wallet.bal = raw; } }); }
        const SP = w.stockpile; if (SP && SP.resources) { const raw = SP.resources; SP.resources = new Proxy(raw, { set(t, k, v) { const b = t[k]; t[k] = v; if (k === 'silver' && Math.abs((+v || 0) - (+b || 0)) > 1e-9) push('silver', k, b, v); return true; } }); X.restore.push(() => { if (SP.resources !== raw) SP.resources = raw; }); }
        const M = w.money; if (M) { let p = M.pend; Object.defineProperty(M, 'pend', { configurable: true, enumerable: true, get: () => p, set: (v) => { const b = p; p = v; if (Math.abs(v - b) > 1e-9 && !X._closing) push('pend', '', b, v); } }); X.restore.push(() => { const v = p; delete M.pend; M.pend = v; }); }
        const watchNum = (obj, f, name) => { if (!obj || typeof obj[f] !== 'number') return; let v0 = obj[f]; Object.defineProperty(obj, f, { configurable: true, enumerable: true, get: () => v0, set: (v) => { const b = v0; v0 = v; if (Math.abs(v - b) > 1e-9) push(name, f, b, v); } }); X.restore.push(() => { const v = v0; delete obj[f]; obj[f] = v; }); };
        watchNum(w.bank, 'reserve', 'bank'); watchNum(w.union, 'fund', 'union'); for (const R of (w.faith?.rels || [])) watchNum(R, 'fund', 'faith:' + (R.id || ''));
      };
      const disarm = () => { for (const f of (X.restore || []).reverse()) try { f(); } catch (e) {} X.restore = []; const L = X.log; X.log = null; return L; };
      X.saveLoad = () => { const data = JSON.parse(JSON.stringify(w.serialize())); const ok = w.loadSave(data); w.observerMode = true; w.fullAgentMode = false; return ok; };
      // 跑到下一次換日；換日那一格開記錄
      X.toNextDayAll = () => { const ticks = []; let guard = 0; const uL = unrec(); X.uAfterLoad = uL; while (guard++ < 200) {
        const pre = w.clock.hour === 23 && w.clock.minute === 45; const at = w.clock.hour + ':' + w.clock.minute; arm(); const ub = X.u0; const dBefore = w._absDay(); w.paused = false; w.tick(); const L = disarm(); const ua = unrec();
        const moves = L.filter(e => e.du && Math.abs(e.du) > 0.005);
        if (pre) { X.samples++; const other = w.money?.days?.[w._absDay()]?.other || 0; if (Math.abs(other) > 0.01) X.hits.push({ day: w._absDay(), other, uSave: X.uSave, uAfterLoad: uL, uPreClose: ub, steps: ticks, closeMoves: moves.slice(0, 60) }); }
        else if (ub != null && ua != null && Math.abs(ua - ub) > 0.005) { const net = r2(ua - ub); const ag = {}; for (const m of moves) { const k = m.kind + ' ' + m.s.split(' < ').slice(1, 4).join(' < '); ag[k] = r2((ag[k] || 0) + m.du); } ticks.push({ at, ub, ua, net, agg: Object.entries(ag).filter(x => Math.abs(x[1]) > 0.005), moves: moves.length > 80 ? moves.filter(m => Math.abs(m.du) > 1).slice(0, 80) : moves }); }
        if (w._absDay() !== dBefore) return; } };
      X.toNextDay = (instrument) => { const d0 = w._absDay(); let guard = 0; while (guard++ < 200) {
        const pre = w.clock.hour === 23 && w.clock.minute === 45; if (pre && instrument) arm();
        const dBefore = w._absDay(); w.paused = false; w.tick();
        if (pre && instrument) { const L = disarm(); X.samples++; const other = w.money?.days?.[w._absDay()]?.other || 0;
          if (Math.abs(other) > 0.01) { const moves = L.filter(e => e.du && Math.abs(e.du) > 0.005); X.hits.push({ day: w._absDay(), other, u0: X.u0, moves, closeIdx: L.findIndex(e => e.kind === 'CLOSE'), around: L.slice(Math.max(0, L.findIndex(e => e.kind === 'CLOSE') - 3), L.findIndex(e => e.kind === 'CLOSE') + 3), nLog: L.length }); }
        }
        if (w._absDay() !== dBefore) return; } };
      X.toHour = (h) => { let g = 0; while (w.clock.hour !== h && g++ < 200) { w.paused = false; w.tick(); } };
      X.warm = (days) => { for (let i = 0; i < days; i++) X.toNextDay(false); X.toHour(6); };
    });
    for (let d = 0; d < WARM; d += 10) await page.evaluate((k) => window.__h.warm(k), Math.min(10, WARM - d));
    for (let d = 0; d < SAMP; d++) await page.evaluate(() => { const X = window.__h; const w0 = () => window.rimtownApp.world; X.uSave = (typeof w0().money?.lastT === 'number') ? Math.round((MONEY.total(w0()) - w0().money.lastT - w0().money.pend) * 100) / 100 : null; X.saveLoad(); X.toNextDayAll(); X.toHour(6); });
    const R = await page.evaluate(() => ({ samples: window.__h.samples, hits: window.__h.hits }));
    res.rounds.push({ run, samples: R.samples, nHits: R.hits.length, errs: errs.slice(0, 5) }); for (const h of R.hits) res.hits.push(Object.assign({ run }, h));
    fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
    fs.appendFileSync(PROG, `run ${run}: samples ${R.samples} hits ${R.hits.length} ${JSON.stringify(R.hits.map(h => [h.day, h.other]))} errs ${errs.length}\n`);
    await ctx.close();
  }
  } finally { await browser.close(); fs.appendFileSync(PROG, 'DONE\n'); }
})();
