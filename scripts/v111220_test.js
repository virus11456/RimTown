// v11.12.2 基礎產業的「工人」照實算＋田不再因為輪作整季空著
//   1) 產業分頁「基礎產業」每一行的工人：以前讀 data.workers（從來沒填過）永遠顯示 0；產出其實是看鎮上有幾個人做這一行。現在照實算，並寫出存量夠了放慢到幾成
//   2) 農夫種田的輪作：以前「不種上一季那一種」是硬規定，剩下的作物都不值得種時田就空著。現在是偏好：換別的都不值得種，就照樣種鎮上要的那一種
//   用法：BASE=http://localhost:8193/ node scripts/v111220_test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8193/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
async function run(browser, lang) {
  console.log(lang); const L = `[${lang}] `;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 3, { seed: 9 }); const out = {};
    for (let i = 0; i < 3; i++) { const d0 = w._absDay(); let k = 0; while (w._absDay() === d0 && k < 400) { w.paused = false; w.tick(); k++; } }
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    for (const k of Object.keys(INDUSTRIES)) if (!w.industry.industries[k]) w.industry.industries[k] = { key: k, level: 1, workers: [], dailyOutput: {} };
    const cards = () => { app.state = w.getState(); const d = document.createElement('div'); d.innerHTML = app._indBase(true); return [...d.querySelectorAll('.pg-firm')].map(x => x.innerText.replace(/\s+/g, ' ')); };
    const haveOf = (k) => npcs().filter(a => a.job?.key === INDUSTRIES[k].npcJob && (!a.status || a.status === 'normal')).length; const needOf = (k) => INDUSTRIES[k].levels.find(l => l.lv === w.industry.industries[k].level).workers;
    // 一、工人數照實算
    const keys = Object.keys(w.industry.industries); const c1 = cards(); out.show = keys.map((k, i) => ({ k, have: haveOf(k), need: needOf(k), text: c1[i] }));
    // 沒有人做這一行：顯示 0，並寫出只剩三成
    const farmers = npcs().filter(a => a.job?.key === 'farmer'); const keep = farmers.map(a => a.job); for (const a of farmers) a.job = new Job('cook'); const c2 = cards(); out.noFarmer = c2[keys.indexOf('farming')]; farmers.forEach((a, i) => { a.job = keep[i]; });
    // 存量很多：寫出放慢到幾成；存量很少：不寫
    const f0 = w.stockpile.get('food'); w.stockpile.add('food', 90000, w.tickCount, 'test'); out.slowPct = Math.round(FLOW.demandMult(w, 'food') * 100); out.slow = cards()[keys.indexOf('farming')]; w.stockpile.consume('food', w.stockpile.get('food') - 5, w.tickCount, 'test'); out.fastPct = Math.round(FLOW.demandMult(w, 'food') * 100); out.fast = cards()[keys.indexOf('farming')]; w.stockpile.add('food', f0, w.tickCount, 'test');
    // 二、輪作是偏好
    w.farm.dailyUpdate(w); const R0 = Math.random, cs0 = FLOW.cropScore; w.clock.season = '春季'; if (w.stockpile.get('silver') < 300) w.stockpile.add('silver', 300, w.tickCount, 'test');
    const reset = () => { for (const p of w.farm.plots) { p.state = 'tilled'; p.crop = null; p.lastCrop = 'wheat'; p.growthProgress = 0; } };
    const go = (score) => { reset(); FLOW.cropScore = (w2, c) => score[c.key] ?? 0.05; Math.random = () => 0.1; try { w.autonomy._farm(w); } finally { Math.random = R0; FLOW.cropScore = cs0; } return w.farm.plots.map(p => p.state === 'growing' ? p.crop : p.state); };
    out.plots = w.farm.plots.length; out.onlyWheat = go({ wheat: 1.7, potato: 0.1 }); out.potatoOk = go({ wheat: 1.7, potato: 0.5 }); out.nothing = go({ wheat: 0.1, potato: 0.1 });
    return out; });
  ok(r.show.length >= 4 && r.show.every(x => x.text.includes(`${Math.min(x.have, x.need)}/${x.need}`)), L + '基礎產業的工人數＝鎮上做這一行的人（最多算到做滿）', r.show.map(x => [x.k, x.have, x.need, x.text.slice(0, 60)]));
  ok(r.show.filter(x => x.have > x.need).every(x => x.text.includes(String(x.have))) && r.show.some(x => x.have > x.need), L + '做這一行的人比需要的多：把實際人數寫出來', r.show.map(x => [x.k, x.have, x.need]));
  ok(/0\/\d/.test(r.noFarmer) && /三成|30%/.test(r.noFarmer), L + '沒有人做這一行：顯示 0，並寫出只剩三成產出', r.noFarmer);
  ok(r.slowPct < 95 && r.slow.includes(r.slowPct + '%') && r.fastPct >= 95 && !/少做一點|slowed/.test(r.fast), L + `存量夠了寫出放慢到幾成（${r.slowPct}%），存量少就不寫`, [r.slow.slice(0, 120), r.fast.slice(0, 120)]);
  ok(r.plots >= 4 && r.onlyWheat.every(x => x === 'wheat'), L + '上一季種小麥、這一季只有小麥值得種：照樣種小麥（以前整季空著）', r.onlyWheat);
  ok(r.potatoOk.every(x => x === 'potato'), L + '換別的也值得種：照舊輪作，改種別的', r.potatoOk);
  ok(r.nothing.every(x => x === 'tilled'), L + '什麼都不缺：照舊休耕，省種子錢', r.nothing);
  ok(errs.length === 0, L + '沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); for (const lang of ['zh', 'en']) await run(browser, lang); await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
