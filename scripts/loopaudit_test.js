// 閉環健檢(量測,不是回歸測試):真正的遊戲迴圈跑 N 天,每 30 天記一次
// - 世界狀態裡所有數字(各系統的 stats、清單長度、名冊人數)→ 一整年都沒動的就是卡住的環
// - 日誌:每種訊息每個月出現幾次
// - 村民:人口、貧富差距(吉尼)、前一成的人占多少錢、階層分布、產業有幾個老闆、心情
// 用法:node scripts/loopaudit_test.js [天數=360] [輸出檔=/tmp/loopaudit.json]
const { chromium } = require('playwright');
const fs = require('fs');
const DAYS = +(process.argv[2] || 360), OUT = process.argv[3] || '/tmp/loopaudit.json';
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = [], warns = {}; page.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') { const k = m.text().slice(0, 70); warns[k] = (warns[k] || 0) + 1; } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(800);
  await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false;
    const A = window.__la = { month: 0, logs: [{}], seen: new Set(), money: [{}] };
    const lg = w.logMessage;
    w.logMessage = function (type, content, ...rest) { const k = rest[2] || ('#' + String(content).replace(/[0-9.]+/g, 'N').slice(0, 26)); const L = A.logs[A.month]; L[k] = (L[k] || 0) + 1; return lg.call(this, type, content, ...rest); };
    const SKIP = new Set(['agents', 'tilemap', 'grid', 'pathCache', 'logs', 'eventLog', 'chatHistory', '_destCache', 'buildings', 'locations', 'tiles', 'map']);
    A.snap = () => {
      const out = {};
      const walk = (o, p, d) => {
        if (o == null || d > 3) return;
        if (Array.isArray(o)) { out[p + '#'] = o.length; return; }
        if (typeof o !== 'object') return;
        if (o instanceof Map || o instanceof Set) { out[p + '#'] = o.size; return; }
        const ks = Object.keys(o);
        if (ks.length > 60) { out[p + '#'] = ks.length; return; }
        for (const k of ks) {
          const v = o[k], q = p ? p + '.' + k : k;
          if (typeof v === 'number' && isFinite(v)) out[q] = Math.round(v * 100) / 100;
          else if (typeof v === 'boolean') out[q] = v ? 1 : 0;
          else if (v && typeof v === 'object') walk(v, q, d + 1);
        }
      };
      for (const k of Object.keys(w)) if (!SKIP.has(k) && w[k] && typeof w[k] === 'object' && typeof w[k] !== 'function') walk(w[k], k, 1);
      try { for (const k of ['food', 'wood', 'stone', 'silver', 'tools', 'cloth', 'paper', 'iron', 'grain', 'fish', 'meat']) out['stock.' + k] = Math.round(w.stockpile.get(k) || 0); } catch (e) {}
      return out;
    };
    A.people = () => {
      const ns = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const ad = ns.filter(a => (a.age ?? 30) >= 16);
      let bal = []; try { bal = ad.map(a => WALLET.get(w, a)).sort((x, y) => x - y); } catch (e) {}
      const sum = bal.reduce((s, x) => s + x, 0) || 1; let g = 0; bal.forEach((x, i) => { g += (2 * (i + 1) - bal.length - 1) * x; }); const gini = bal.length ? g / (bal.length * sum) : 0;
      const top = bal.slice(Math.floor(bal.length * 0.9)).reduce((s, x) => s + x, 0) / sum;
      const cls = {}; try { for (const a of ad) { const c = CLASS.level(w, a); cls[c] = (cls[c] || 0) + 1; } } catch (e) {}
      const jobs = {}; for (const a of ad) { const j = a.job?.key || 'none'; jobs[j] = (jobs[j] || 0) + 1; }
      const aff = { n: 0, sum: 0, friend: 0, foe: 0 }; const rel = {}; for (const a of ns) for (const r of Object.values(a.relationships?.relationships || {})) { aff.n++; aff.sum += r.affinity || 0; if ((r.affinity || 0) >= 50) aff.friend++; if ((r.affinity || 0) <= -30) aff.foe++; const t = r.status || 'none'; rel[t] = (rel[t] || 0) + 1; }
      let owners = null; try { const own = new Set(); const O = w.market?.owners || {}; for (const v of Object.values(O)) if (v) own.add(v); owners = { owners: own.size, sectors: Object.values(O).filter(Boolean).length, shops: (w.biz?.shops || []).length }; } catch (e) {}
      let rich = []; try { rich = ad.map(a => ({ n: a.name, j: a.job?.key, b: Math.round(WALLET.get(w, a)), own: (typeof MARKET !== 'undefined' ? MARKET.ownedBy(w, a.agentId) : []).join(','), age: a.age })).sort((x, y) => y.b - x.b).slice(0, 3); } catch (e) {}
      let pots = {}; try { pots = { treasury: Math.round(w.stockpile.get('silver')), bank: Math.round(+w.bank?.reserve || 0), union: Math.round(+w.union?.fund || 0), faith: Math.round((w.faith?.rels || []).reduce((s, R) => s + (+R.fund || 0), 0)), wallets: Math.round(sum) }; } catch (e) {}
      return { aff: { avg: +(aff.sum / Math.max(1, aff.n)).toFixed(1), friend: aff.friend, foe: aff.foe }, rich, pots, pop: ns.length, adults: ad.length, kids: ns.length - ad.length, mood: Math.round(ns.reduce((s, a) => s + (a.mood || 50), 0) / Math.max(1, ns.length)), gini: +gini.toFixed(3), top10: +top.toFixed(3), wealth: Math.round(sum), median: Math.round(bal[bal.length >> 1] || 0), poor: bal.filter(x => x < 5).length, cls, jobs, rel, owners };
    };
    A.monthMoney = () => { const out = {}; try { const D = MONEY.S(w).days || {}; const cur = w._absDay(); for (const k of Object.keys(D)) if (+k < cur && !A.seen.has(k)) { A.seen.add(k); for (const [c, v] of Object.entries(D[k])) out[c] = Math.round(((out[c] || 0) + v) * 100) / 100; } } catch (e) {} return out; };
    A.snaps = [A.snap()]; A.ppl = [A.people()]; A.pk = [{}];
    const PS = ProposalSystem.prototype, ex = PS._execute;
    PS._execute = function (...args) { const tot = () => { let s = (w.stockpile?.resources?.silver || 0) + (+w.bank?.reserve || 0) + (+w.union?.fund || 0); for (const k in (w.wallet?.bal || {})) s += +w.wallet.bal[k] || 0; for (const R of (w.faith?.rels || [])) s += +R.fund || 0; return s; }; const p = args.find(x => x && x.kind) || {}; const b = tot(); const r = ex.apply(this, args); const d = tot() - b; if (Math.abs(d) > 0.5) { const K = A.pk[A.month] = A.pk[A.month] || {}; const k = (p.kind || '?') + ':' + String(p.title || p.label || '').slice(0, 18); K[k] = Math.round((K[k] || 0) + d); } return r; };
  });
  const t0 = Date.now();
  for (let d = 0; d < DAYS; d += 30) {
    const n = Math.min(30, DAYS - d);
    await page.evaluate((n) => { const w = window.rimtownApp.world, A = window.__la; for (let d = 0; d < n; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } A.money[A.month] = A.monthMoney(); A.snaps.push(A.snap()); A.ppl.push(A.people()); A.month++; A.logs.push({}); A.money.push({}); A.pk.push({}); }, n);
    process.stderr.write(`day ${d + n} ${Math.round((Date.now() - t0) / 1000)}s\n`);
  }
  const r = await page.evaluate(() => { const w = window.rimtownApp.world, A = window.__la; let tier = null; try { tier = TIERS.level(w); } catch (e) {} return { town: w.townName || w.name, tier, snaps: A.snaps, ppl: A.ppl, logs: A.logs.slice(0, A.month), money: A.money.slice(0, A.month), pk: A.pk.slice(0, A.month) }; });
  r.errs = errs.slice(0, 20); r.warns = Object.entries(warns).sort((a, b) => b[1] - a[1]).slice(0, 30); r.days = DAYS; r.sec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(OUT, JSON.stringify(r));
  console.log(`wrote ${OUT}: ${r.snaps.length} snaps, ${r.errs.length} errs, ${r.sec}s`);
  await browser.close();
})();
