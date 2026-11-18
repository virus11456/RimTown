// 兩個網址各跑一次固定種子（亂數、時鐘、住哪一棟都固定），比世界狀態。用法：A=url B=url node ab.js <tier> <days> <seed>
const { chromium } = require('playwright'); const crypto = require('crypto');
const tier = +(process.argv[2] || 2), days = +(process.argv[3] || 5), seed = +(process.argv[4] || 20261116);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: 2000000000 }) + '.sig';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
async function one(browser, base) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(base + 'town.html', { waitUntil: 'load', timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 }); await page.waitForTimeout(600);
  const r = await page.evaluate(({ tier, days, seed, STEP, DUMP, NORM }) => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showSeasonRecap = () => {};
    let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t2 = Math.imul(a ^ (a >>> 15), 1 | a); t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2; return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296; };
    let fake = 1790000000000; Date.now = () => (fake += 7);
    w.reset(); w.observerMode = true; ORIGIN.seed(w, tier, { seed }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false;
    try { app._visitorMailboxTick(); } catch (e) {}
    if (app.tileMap && !window.__NOHOUSEFIX) app.tileMap.getAgentHouseId = () => null;
    const hs = [];
    for (let i = 0; i < 96 * days; i++) { w.paused = false; if (STEP) app._simStep(); else w.tick(); if ((i + 1) % 96 === 0) { const all = w.serialize(); delete all.savedAt; delete all.uiUnlock; if (NORM && all.biz && Array.isArray(all.biz.fronts)) all.biz = { ...all.biz, fronts: all.biz.fronts.map(f => ({ ...f, x: 0, y: 0, r: 0, face: 0 })) }; const j = JSON.stringify(all).replace(/election_policy_\d+/g, 'election_policy_#').replace(/"pc\d{13}"/g, '"pc#"'); let h = 0x811c9dc5; for (let q = 0; q < j.length; q++) { h ^= j.charCodeAt(q); h = Math.imul(h, 0x01000193) >>> 0; } hs.push(h.toString(16) + ':' + j.length); if (hs.length - 1 === DUMP) window.__dump = j; } }
    return { hs, dump: window.__dump || '', n: Object.values(w.agents).filter(x => !x.isDead).length, day: w._absDay() };
  }, { tier, days, seed, STEP: process.env.STEP === '1', DUMP: +(process.env.DUMP ?? -1), NORM: process.env.NORM === '1' });
  await page.close(); return r;
}
function diff(a, b, path, out) {
  if (out.length >= 30) return;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) { out.push(path + ' : ' + JSON.stringify(a)?.slice(0, 150) + ' <> ' + JSON.stringify(b)?.slice(0, 150)); return; }
  if (a && typeof a === 'object') { const ka = Object.keys(a), kb = Object.keys(b); if (ka.join() !== kb.join() && ka.length === kb.length && ka.every(k => k in b)) out.push(path + ' : 欄位順序不同'); for (const k of new Set([...ka, ...kb])) diff(a[k], b[k], path + '.' + k, out); return; }
  if (a !== b) out.push(path + ' : ' + JSON.stringify(a)?.slice(0, 150) + ' <> ' + JSON.stringify(b)?.slice(0, 150));
}
(async () => {
  const browser = await chromium.launch(); const A = await one(browser, process.env.A); const B = await one(browser, process.env.B);
  let first = -1; for (let i = 0; i < A.hs.length; i++) if (A.hs[i] !== B.hs[i]) { first = i; break; }
  const res = { tier, days, seed, popA: A.n, popB: B.n, endA: sha(A.hs[A.hs.length - 1]), endB: sha(B.hs[B.hs.length - 1]), same: first < 0, firstDiffDay: first };
  if (first >= 0) { res.hashA = A.hs[first]; res.hashB = B.hs[first]; }
  if (A.dump && B.dump) { const out = []; diff(JSON.parse(A.dump), JSON.parse(B.dump), '', out); res.dumpDiff = out; }
  console.log(JSON.stringify(res)); await browser.close();
})();
