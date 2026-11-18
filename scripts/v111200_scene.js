// v11.12.0 情境重現：公庫只夠 5～6 天、稅率 2%、每天小有結餘、三個監管職位空缺、銀行有錢的 116 人城，不開 AI 往後跑
// 用法：BASE=… node scripts/v111200_scene.js <mode> <seed> <days>
//   mode = free（照個性，各版本原本的做法）／always（首長每次能借就借）／never（首長從不借、也沒有人提借錢）
// 輸出一行 JSON（每 30 天一筆紀錄）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8197/';
const [mode, seedS, daysS] = process.argv.slice(2); const seed = +seedS || 1, days = +daysS || 60;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { const x = m.text(); if (/\[Fiscal\]|\[Decide\]|\[Bank\]|\[Office\]|\[Proposals\]/.test(x)) errs.push(x.slice(0, 200)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 });
  await page.addScriptTag({ path: __dirname + '/v111200_setup.js' });
  await page.evaluate(({ mode, seed }) => {
    const F0 = window.__fisc; const S = F0.setup(seed); const { w } = S; const R = window.__R = { mode, seed, d0: w._absDay(), ver: RIMTOWN_APP_VERSION, picks: [], taxSeat: null, back: null, short: 0, runs: 0, fails: 0, rec: [], props: {}, mayors: [S.M.agentId], recalls0: 0, bankNo: 0, maxAffDrop: 0 };
    try { R.recalls0 = POWER.S(w).stats?.recalls || 0; } catch (e) {}
    const has = typeof FISCAL.tightOptions === 'function';
    if (has && DECIDE.KINDS.fiscTight) { const K = DECIDE.KINDS.fiscTight; const o0 = K.options; K.options = (w2, a2, c2) => { const ops = o0.call(K, w2, a2, c2); if (mode === 'always') { const b = ops.find(o => o.id === 'bond'); return b ? [b] : ops; } if (mode === 'never') return ops.filter(o => o.id !== 'bond'); return ops; }; }
    if (mode !== 'free' && DECIDE.KINDS.mayorWeek) { const K = DECIDE.KINDS.mayorWeek; const o0 = K.options; K.options = (w2, a2, c2) => { const ops = o0.call(K, w2, a2, c2); if (mode === 'always') { const b = ops.find(o => o.id === 'bond'); return b ? [b] : ops; } return ops.filter(o => o.id !== 'bond'); }; }
    DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K?.key === 'fiscTight') R.picks.push(o.op.id); });
  }, { mode, seed });
  const step = (n) => page.evaluate((n) => { const F0 = window.__fisc; const R = window.__R; const w = window.rimtownApp.world;
    for (let i = 0; i < n; i++) {
      if (R.mode === 'never') FISCAL.S(w).last.fisc_bond = w._absDay(); // 從不借：連緊急那條也不提
      F0.tickDay(w); const d = w._absDay(); const k = d - R.d0;
      if (R.taxSeat == null && OFFICE.holder(w, 'tax')) R.taxSeat = k;
      if (R.back == null && !TREASURY.low(w)) R.back = k;
      { const sd = w.wallet.shortDay; if (sd != null && sd > R.d0 && !R['s' + sd]) { R['s' + sd] = 1; R.short++; } } // 發不出全薪的天數
      if (w.bank?.status === 'run' && !R['r' + w.bank.runDay]) { R['r' + w.bank.runDay] = 1; R.runs++; }
      for (const p of w.proposals.items) if (p.kind === 'fisc_bond' || p.kind === 'tax') { const key = p.kind + ':' + p.id; if (['done', 'rejected', 'expired', 'failed'].includes(p.status) && !R.props[key]) R.props[key] = p.status; }
      const M = w.election?._officeHolder?.(w); if (M && R.mayors[R.mayors.length - 1] !== M.agentId) R.mayors.push(M.agentId);
      if (k % 30 === 0) { const FV = FISCAL.view(w); const ad = F0.adults(w).filter(a => a !== M); const avg = M ? ad.reduce((s, a) => s + (a.relationships?.relationships?.[M.agentId]?.affinity || 0), 0) / Math.max(1, ad.length) : null; let rc = 0; try { rc = (POWER.S(w).stats?.recalls || 0) - R.recalls0; } catch (e) {}
        const pv = Object.entries(R.props); R.rec.push({ k, days: Math.round(TREASURY.days(w) * 10) / 10, silver: Math.round(w.stockpile.get('silver')), owed: Math.round(FV.bond?.owed || 0), lv: FV.burden ? FV.burden.name : null, uneasy: FV.uneasy ?? null, aff: avg == null ? null : Math.round(avg * 10) / 10, bondOk: pv.filter(([x, s]) => x.startsWith('fisc_bond') && s === 'done').length, bondNo: pv.filter(([x, s]) => x.startsWith('fisc_bond') && s !== 'done').length, taxOk: pv.filter(([x, s]) => x.startsWith('tax') && s === 'done').length, bankNo: FISCAL.S(w).st.bankNo || 0, short: R.short, runs: R.runs, fails: (w.bank?.history || []).length, mayors: R.mayors.length - 1, recalls: rc, tax: Math.round((w.wallet.tax || 0) * 100), miss: FISCAL.S(w).st.miss || 0, bonds: FISCAL.S(w).st.bonds || 0 }); }
    }
    return w._absDay() - R.d0; }, n);
  let done = 0; while (done < days) done = await step(Math.min(30, days - done));
  const out = await page.evaluate(() => { const R = window.__R; const w = window.rimtownApp.world; return { mode: R.mode, seed: R.seed, ver: R.ver, picks: R.picks.join(','), taxSeat: R.taxSeat, back: R.back, short: R.short, runs: R.runs, bonds: FISCAL.S(w).st.bonds || 0, other: window.__fisc.other(w, R.d0), rec: R.rec }; });
  out.errs = errs.slice(0, 3); out.base = BASE; out.days = days;
  console.log(JSON.stringify(out));
  await browser.close();
})().catch(e => { console.log(JSON.stringify({ error: String(e).slice(0, 300) })); process.exit(1); });
