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
  const out = await page.evaluate(({ tier, days }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
    let s = +(new URLSearchParams(location.search).get('rs') || 7); Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    w.reset(); w.observerMode = true; ORIGIN.seed(w, tier, { seed: +(new URLSearchParams(location.search).get('os') || 22) }); w.observerMode = true; w.fullAgentMode = false; try { WALLET.S(w); } catch (e) {}
    const dayT = [], norm = []; let lastDay = w.clock?.day ?? w.day;
    for (let i = 0; i < 96 * days; i++) { w.paused = false; const t0 = performance.now(); w.tick(); const dt = performance.now() - t0; const d = w.clock?.day ?? w.day; if (d !== lastDay) { dayT.push(dt); lastDay = d; } else norm.push(dt); }
    const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return +(b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0).toFixed(1); };
    return { pop: Object.values(w.agents).filter(a => !a.isDead).length, days: dayT.length, dayMed: q(dayT, 0.5), dayP90: q(dayT, 0.9), dayMax: q(dayT, 0.999), normMed: q(norm, 0.5), normP99: q(norm, 0.99), normMax: q(norm, 0.9999), over200: dayT.filter(x => x > 200).length + norm.filter(x => x > 200).length };
  }, { tier, days });
  console.log(JSON.stringify(out)); await browser.close();
})();
