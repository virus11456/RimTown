// 玩法健檢(不是回歸測試,是量測):真正的遊戲迴圈跑 N 天,統計
// - 日誌:每種訊息每天出現幾次(洗版)、英文模式下還是中文的訊息(漏翻)
// - 提案:各種類提出／通過／完成次數,從沒出現過的種類
// - 新系統:人生劇本前進／結局、鎮上話題變熱／被擠下去
// - 人口、心情、出生死亡移民、錢的來路不明、主控台警告
// 用法:node scripts/playaudit_test.js [天數=90] [zh|en]
const { chromium } = require('playwright');
const DAYS = +(process.argv[2] || 90), LANG = process.argv[3] || 'zh';
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = [], warns = {}; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') { const k = m.text().slice(0, 60); warns[k] = (warns[k] || 0) + 1; } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, LANG }) => { localStorage.setItem('rimtown-lang', LANG); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, LANG });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(800);
  if (LANG === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  const r = await page.evaluate(async (DAYS) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; try { app._visitorMailboxTick?.(); } catch (e) {}
    const cjk = /[一-鿿]/; const en = I18N.getLang() === 'en';
    const byKey = {}, byType = {}, cjkKeys = {};
    const lm = w.logMessageT, lg = w.logMessage;
    w.logMessage = function (type, content, ...rest) { byType[type] = (byType[type] || 0) + 1; const k = rest[2]; const key = k || ('#' + String(content).replace(/[0-9]+/g, 'N').slice(0, 30)); byKey[key] = (byKey[key] || 0) + 1; if (en && cjk.test(String(content))) cjkKeys[key] = String(content).slice(0, 90); return lg.call(this, type, content, ...rest); };
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const pop0 = npcs().length, born0 = (w.lifecycle?.births || []).length, dead0 = (w.lifecycle?.graveyard || []).length;
    const moods = [], pops = []; let other = 0; const seen = new Set();
    const t0 = performance.now();
    for (let d = 0; d < DAYS; d++) {
      for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      const ns = npcs(); pops.push(ns.length); moods.push(Math.round(ns.reduce((s, a) => s + (a.mood || 50), 0) / Math.max(1, ns.length)));
      try { const D = MONEY.S(w).days || {}; const cur = w._absDay(); for (const k of Object.keys(D)) if (+k < cur && !seen.has(k)) { seen.add(k); other += +(D[k].other || 0); } } catch (e) {}
    }
    const ms = Math.round(performance.now() - t0);
    // 提案
    const kinds = {}; for (const p of (w.proposals?.items || []).concat(w.proposals?.history || [])) { const k = p.kind || '?'; const x = kinds[k] || (kinds[k] = { made: 0, ok: 0, done: 0 }); x.made++; if (/approved|done|executing|passed/.test(p.status)) x.ok++; if (p.status === 'done') x.done++; }
    // 人生劇本
    const M = w.mind || {}; const arcs = { active: 0, st: {}, ends: {} };
    for (const A of Object.values(M.amb || {})) { arcs.active++; arcs.st[A.st || 0] = (arcs.st[A.st || 0] || 0) + 1; }
    for (const arr of Object.values(M.story || {})) for (const s of arr) arcs.ends[s.end] = (arcs.ends[s.end] || 0) + 1;
    const B = w.buzz || { items: [], hist: [] };
    const top = Object.entries(byKey).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => [k.slice(0, 50), +(n / DAYS).toFixed(2)]);
    return {
      days: DAYS, ms, pop: [pop0, pops[pops.length - 1], Math.min(...pops), Math.max(...pops)], mood: [moods[0], moods[moods.length >> 1], moods[moods.length - 1], Math.min(...moods)],
      births: (w.lifecycle?.births || []).length - born0, deaths: (w.lifecycle?.graveyard || []).length - dead0,
      other: Math.round(other * 100) / 100, byType, top, cjk: Object.entries(cjkKeys).slice(0, 40), cjkN: Object.keys(cjkKeys).length,
      kinds, arcs, buzz: { live: B.items.length, hist: B.hist.length, hot: Object.keys(byKey).filter(k => /全鎮都在談/.test(k)).reduce((s, k) => s + byKey[k], 0), crowd: Object.keys(byKey).filter(k => /漸漸沒人提了/.test(k)).reduce((s, k) => s + byKey[k], 0) },
      tier: TIERS.level(w), era: Math.max(0, ...Object.entries(w.research?.projects || {}).filter(([, p]) => p.status === 'complete').map(([k]) => (typeof RESEARCH_TREE !== 'undefined' && RESEARCH_TREE[k]?.era) || 0)),
      silver: Math.round(w.stockpile.get('silver')), food: Math.round(w.stockpile.get('food')), save: JSON.stringify(w.serialize()).length,
    };
  }, DAYS);
  r.errs = errs.slice(0, 8); r.warns = Object.entries(warns).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
