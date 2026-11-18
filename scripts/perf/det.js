// 同一版、同樣種子、凍結時鐘，開兩個獨立頁面各跑 N 天，每天換日後存一份 serialize()，找出第一個不同的地方
const { chromium } = require('playwright');
const BASE = process.env.BASE; const tier = +(process.argv[2] || 2), days = +(process.argv[3] || 4);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: 2000000000 }) + '.sig';
async function once(browser) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, FREEZE }) => {
    localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low');
    if (FREEZE) { const T = 1767225600000; const D = Date; const F = function (...a) { return a.length ? new D(...a) : new D(T); }; F.now = () => T; F.UTC = D.UTC; F.parse = D.parse; F.prototype = D.prototype; window.Date = F; }
  }, { jwt, FREEZE: process.env.FREEZE !== '0' });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  if (process.env.WAIT === '1' || process.env.WAIT === '3') { if (process.env.WAIT === '1') await page.waitForTimeout(600); await page.evaluate(() => { const app = window.rimtownApp; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; }); }
  return await page.evaluate(({ tier, days, MODE, HOUSEFIX, TICK, WAIT }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
    let s = 7; const rng = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__rngN = 0; window.__stk = null; Math.random = () => { window.__rngN++; if (window.__stk) window.__stk.push(new Error().stack.split('\n').slice(2, 6).map(x => x.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < ')); return rng(); };
    w.reset(); w.observerMode = true; ORIGIN.seed(w, tier, { seed: 22 }); if (WAIT) { try { app._visitorMailboxTick(); } catch (e) {} } if (HOUSEFIX && app.tileMap) app.tileMap.getAgentHouseId = () => null; w.observerMode = true; w.fullAgentMode = false; try { WALLET.S(w); } catch (e) {}
    const snaps = []; let lastDay = w.clock?.day; const rn = [];
    snaps.push(JSON.stringify(w.serialize())); rn.push(window.__rngN);
    const per = []; let stks = null; if (WAIT) {} for (let i = 0; i < 96 * days; i++) { w.paused = false; if (i === TICK) window.__stk = []; const n0 = window.__rngN; w.tick(); per.push(window.__rngN - n0); if (i === TICK) { stks = window.__stk; window.__stk = null; } if (w.clock.day !== lastDay) { lastDay = w.clock.day; snaps.push(JSON.stringify(w.serialize())); rn.push(window.__rngN); } if (MODE === 'tickrng' && i < 200) rn.push('t' + window.__rngN); }
    return { snaps, rn, per, stks };
  }, { tier, days, MODE: process.env.MODE || '', HOUSEFIX: process.env.HOUSEFIX === '1', TICK: +(process.env.TICK ?? -1), WAIT: process.env.WAIT === '1' || process.env.WAIT === '2' });
}
function diff(a, b, path, out) {
  if (out.length >= 25) return;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) { out.push(path + ' : ' + JSON.stringify(a)?.slice(0, 120) + ' <> ' + JSON.stringify(b)?.slice(0, 120)); return; }
  if (a && typeof a === 'object') { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const ka = Object.keys(a).join(','), kb = Object.keys(b).join(','); if (ka !== kb && new Set(Object.keys(a)).size === new Set(Object.keys(b)).size && [...ks].every(k => k in a && k in b)) out.push(path + ' : 欄位順序不同'); for (const k of ks) diff(a[k], b[k], path + '.' + k, out); return; }
  if (a !== b) out.push(path + ' : ' + JSON.stringify(a)?.slice(0, 120) + ' <> ' + JSON.stringify(b)?.slice(0, 120));
}
(async () => {
  const browser = await chromium.launch(); const A = await once(browser); const B = await once(browser);
  console.log('rng counts A', A.rn.slice(0, 40).join(' ')); console.log('rng counts B', B.rn.slice(0, 40).join(' '));
  { let t = -1; for (let i = 0; i < A.per.length; i++) if (A.per[i] !== B.per[i]) { t = i; break; } console.log('first tick with different rng count', t, t >= 0 ? [A.per[t], B.per[t]] : ''); if (A.stks && B.stks) { let j = 0; while (j < A.stks.length && A.stks[j] === B.stks[j]) j++; console.log('first different random call #' + j + ' of', A.stks.length, B.stks.length); console.log('A:', A.stks.slice(Math.max(0, j - 2), j + 3).join('\n   ')); console.log('B:', B.stks.slice(Math.max(0, j - 2), j + 3).join('\n   ')); } }
  for (let i = 0; i < A.snaps.length; i++) { const same = A.snaps[i] === B.snaps[i]; console.log('day', i, same ? 'same' : 'DIFF', A.snaps[i].length, B.snaps[i].length); if (!same) { const out = []; const x = JSON.parse(A.snaps[i]), y = JSON.parse(B.snaps[i]); delete x.savedAt; delete y.savedAt; diff(x, y, '', out); console.log(out.join('\n')); if (process.env.ALL !== '1') break; } }
  await browser.close();
})();
