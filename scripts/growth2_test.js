// 選跑:node scripts/growth2_test.js   需本機 http://127.0.0.1:8126 服務 wordpress/,NODE_PATH 指到有 playwright 的 node_modules
// 天賦學完後升級 → 屬性 +1、pendingLevels 不累積、存讀檔保留 extra
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const app = window.rimtownApp; const w = app.world; w.paused = true; const g = w.growth; const o = {};
    // learn all perks
    while (Object.keys(GROWTH_PERKS).some(k => !g.has(k))) { g.addXp(g.xpToNext(), 'test', w); if (g.pending) g.choose(g.pending[0], w); }
    o.perks = g.perks.length; o.levelBefore = g.level; o.pendingBefore = g.pendingLevels();
    const events = []; w.onGrowthEvent = (k, v) => events.push(k + ':' + v);
    const before = { ...g.attrBonus() };
    g.addXp(g.xpToNext(), 'test', w); g.addXp(g.xpToNext(), 'test', w);
    const after = g.attrBonus();
    o.levelAfter = g.level; o.pendingAfter = g.pendingLevels(); o.pendingList = g.pending; o.events = events;
    o.gain = Object.keys(after).reduce((a, k) => a + after[k] - before[k], 0);
    o.lastLog = (w.messageLog || []).slice(-1)[0]?.text?.slice(0, 40);
    // boundary: 9 perks learned, last one pending, two more levels before choosing → after choosing, surplus level becomes an attribute (no lost level)
    const g2 = new (g.constructor)(); const all = Object.keys(GROWTH_PERKS); for (const k of all.slice(0, 9)) { g2.addXp(g2.xpToNext(), 't', w); g2.choose(g2.pending[0], w); }
    g2.addXp(g2.xpToNext(), 't', w); g2.addXp(g2.xpToNext(), 't', w); // level 11 → 12 while last perk pending
    o.boundary = { pendingBefore: g2.pendingLevels(), unspentBefore: g2.unspent };
    g2.choose(g2.pending[0], w);
    const extraSum = Object.values(g2.extra).reduce((a, b) => a + b, 0);
    o.boundary.after = { perks: g2.perks.length, level: g2.level, extraSum, unspent: g2.unspent, pending: g2.pending, pendingLevels: g2.pendingLevels() };
    // legacy save: Lv.14 with all 10 perks and no unspent/extra → migrates 3 surplus levels into attributes
    const G3 = new (g.constructor)(); G3.loadFrom({ xp: 0, level: 14, perks: all.slice(), pending: null, log: [], total: 0 });
    o.legacy = { extraSum: Object.values(G3.extra).reduce((a, b) => a + b, 0), unspent: G3.unspent, pendingLevels: G3.pendingLevels() };
    // save/load keeps extra
    const d = g.serialize(); const G = new (g.constructor)(); G.loadFrom(JSON.parse(JSON.stringify(d))); o.reload = { extra: G.extra, pendingLevels: G.pendingLevels(), bonusSum: Object.values(G.attrBonus()).reduce((a, b) => a + b, 0) };
    // chatOdds still works with extra attrs
    const npc = Object.values(w.agents).find(a => !a.isPlayer); o.odds = w.chatOdds(npc, 'persuade').p;
    o.guideHidden = document.getElementById('quest-guidance')?.classList.contains('hidden'); o.firstDay = app._firstDayActive();
    return o;
  });
  console.log(JSON.stringify(out, null, 1)); console.log('errors', errs); await browser.close();
})();
