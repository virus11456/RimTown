// 選跑:node scripts/donate_test.js   v6.14.0 捐建/捐款回歸(需本機 8126 服務 wordpress/ 與 NODE_PATH 指到有 playwright 的 node_modules)
// v6.14.0 捐建/捐款:工程進度 +20%、每天一次;鎮公所每天三次、繁榮/心情/聲望;存讀檔;經濟分頁按鈕可點
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(lang + ':' + e.message));
    await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    const out = await page.evaluate(async () => {
      const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const o = {};
      w.stockpile.add('silver', 1000); for (const [k, n] of Object.entries(BUILDING_TEMPLATES.training_ground.costs)) w.stockpile.add(k, n);
      const p = w.buildings.startProject('training_ground', w, { x: 10, y: 10 }); o.started = !!p;
      const s0 = w.stockpile.get('silver'); const r1 = w.buildings.fund(p.id, w); const r2 = w.buildings.fund(p.id, w);
      o.fund = { ok1: r1.ok, pct1: r1.pct, ok2: r2.ok, msg2: r2.msg, silverSpent: s0 - w.stockpile.get('silver'), workDone: p.workDone, expect: Math.ceil(p.workRequired * 0.2) };
      const qb0 = w.prosperity.questBonus || 0; const rep0 = w.questSystem.reputation || 0; const mood0 = Object.values(w.agents).find(a => !a.isPlayer).moodModifier || 0;
      const ds = [1, 2, 3, 4].map(() => w.buildings.donate(w).ok);
      o.donate = { oks: ds, left: w.buildings.donationsLeft(w), qbDelta: (w.prosperity.questBonus || 0) - qb0, repDelta: (w.questSystem.reputation || 0) - rep0, moodDelta: (Object.values(w.agents).find(a => !a.isPlayer).moodModifier || 0) - mood0, total: w.buildings.donations.total };
      // next day resets
      w.clock.day += 1; o.nextDay = { left: w.buildings.donationsLeft(w), fundOk: w.buildings.fund(p.id, w).ok }; w.clock.day -= 1;
      // save/load
      const save = JSON.parse(JSON.stringify(w.serialize())); const W = new World(); W.loadSave(save); o.reload = { donations: W.buildings.donations, fundedDay: W.buildings.projects[0]?.fundedDay, funded: W.buildings.projects[0]?.funded };
      // UI: economy tab, building subtab
      app.state = w.getState(); app.activeTab = 'economy'; app._economySubTab = 'building'; app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
      const sc = document.getElementById('sidebar-content'); o.ui = { fundBtn: !!sc.querySelector('[data-action="fund-project"]'), fundDisabled: sc.querySelector('[data-action="fund-project"]')?.disabled, donateBtn: !!sc.querySelector('[data-action="donate-town"]'), donateDisabled: sc.querySelector('[data-action="donate-town"]')?.disabled, donateText: sc.querySelector('[data-action="donate-town"]')?.textContent, fundText: sc.querySelector('[data-action="fund-project"]')?.textContent };
      // click path on a fresh day
      w.clock.day += 1; app.state = w.getState(); app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
      const sBefore = w.stockpile.get('silver'); sc.querySelector('[data-action="donate-town"]').click(); await new Promise(r => setTimeout(r, 150));
      o.click = { silverDelta: sBefore - w.stockpile.get('silver'), toast: !!document.querySelector('#achv-toast-host .rt-toast') };
      return o;
    });
    console.log(lang, JSON.stringify(out));
    await page.close();
  }
  console.log('errors', errs); await browser.close();
})();
