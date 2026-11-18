// 量換日那一格與平常一格各花多久（不開 AI），用來比兩個版本。用法：BASE=... node tickcost.js <tier> <days>
const { chromium } = require('playwright');
const BASE = process.env.BASE; const tier = +(process.argv[2] || 3), days = +(process.argv[3] || 30);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html?rs=' + (process.env.RS || 7) + '&os=' + (process.env.OS || 22), { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  const out = await page.evaluate(({ tier, days }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
    let s = +(new URLSearchParams(location.search).get('rs') || 7); Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    w.reset(); w.observerMode = true; ORIGIN.seed(w, tier, { seed: +(new URLSearchParams(location.search).get('os') || 22) }); w.observerMode = true; w.fullAgentMode = false; try { WALLET.S(w); } catch (e) {}
    const dayT = [], norm = []; let lastDay = w.clock?.day ?? w.day;
    for (let i = 0; i < 96 * days; i++) { w.paused = false; const t0 = performance.now(); w.tick(); const dt = performance.now() - t0; const d = w.clock?.day ?? w.day; if (d !== lastDay) { dayT.push(dt); lastDay = d; } else norm.push(dt); }
    const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return +(b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0).toFixed(1); };
    return { pop: Object.values(w.agents).filter(a => !a.isDead).length, days: dayT.length, dayMed: q(dayT, 0.5), dayP90: q(dayT, 0.9), dayMax: q(dayT, 0.999), normMed: q(norm, 0.5), normP99: q(norm, 0.99), normMax: q(norm, 0.9999), over200: dayT.filter(x => x > 200).length + norm.filter(x => x > 200).length };
  }, { tier, days });
  const { profile } = await cdp.send('Profiler.stop'); const byId = new Map(profile.nodes.map(n => [n.id, n])); const self = new Map(); const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { self.set(id, (self.get(id) || 0) + (dt[i] || 0) / 1000); });
  const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const nm = (n) => (n.callFrame.functionName || '(anon)') + '@' + (n.callFrame.url.split('/').pop() || '') + ':' + (n.callFrame.lineNumber + 1);
  const agg = new Map(); const tot = new Map(); const callers = new Map(); const TG = (process.env.TARGET || '').split(',').filter(Boolean); const UN = process.env.UNDER || ''; const under = new Map(); const underTot = new Map();
  for (const [id, ms] of self) { const n = byId.get(id); const k = nm(n); agg.set(k, (agg.get(k) || 0) + ms);
    const seen = new Set(); let p = id; const chain = []; while (p) { const pn = byId.get(p); chain.push(nm(pn)); p = parent.get(p); }
    for (const c of chain) { if (seen.has(c)) continue; seen.add(c); tot.set(c, (tot.get(c) || 0) + ms); }
    if (UN) { const i = chain.findIndex(c => c.startsWith(UN)); if (i >= 0) { under.set(chain[0], (under.get(chain[0]) || 0) + ms); const s2 = new Set(); for (const c of chain.slice(0, i)) { if (s2.has(c)) continue; s2.add(c); underTot.set(c, (underTot.get(c) || 0) + ms); } } }
    for (const t of TG) { const i = chain.findIndex(c => c.startsWith(t)); if (i < 0) continue; const inS = chain.some(c => c.startsWith('run@simulation.js')) ? '[SCAN] ' : '[----] '; const key = inS + t + ' <= ' + chain.slice(i + 1, i + 1 + (+process.env.DEPTH || 2)).join(' < '); callers.set(key, (callers.get(key) || 0) + ms); }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => Math.round(v) + ' ' + k);
  console.log(JSON.stringify({ out, self: top(agg, +(process.env.N || 30)), total: top(tot, +(process.env.NT || 40)), callers: top(callers, 40), underSelf: top(under, 30), underTotal: top(underTot, 40) }, null, 1)); await browser.close();
})();
