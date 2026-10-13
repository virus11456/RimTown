// 選跑:node scripts/sponsor_test.js   v6.15.0 贊助節慶回歸(有斷言,失敗 exit 1;需本機 8126 服務 wordpress/ 與 NODE_PATH 指到有 playwright 的 node_modules)
// 前夕贊助:籌備 +50、聲望 +10、繁榮 +3、只能一次;節慶日心情 ×1.5、festivalLog.sponsored;節慶中贊助:心情 +8;窗口外不可贊助;存讀檔;經濟/事件分頁按鈕;早安卡列
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
      const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const o = {}; const fails = []; const ck = (c, m) => { if (!c) fails.push(m); };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const fest = FESTIVALS[w.clock.season]; w.stockpile.add('silver', 1000);
      // 窗口外
      w.clock.day = Math.max(1, fest.day - 3); o.closed = w.festivals.sponsor(w); ck(!o.closed.ok && !w.festivals.sponsorStatus(w).open, 'closed window');
      // 前夕
      w.clock.day = fest.day - 1; w.festivals.dailyUpdate(w); ck(!!w.festivals.activeQuest, 'quest announced');
      const st0 = w.festivals.sponsorStatus(w); ck(st0.open && st0.phase === 'eve' && !st0.sponsored && st0.can_afford, 'eve status');
      const s0 = w.stockpile.get('silver'); const rep0 = w.questSystem.reputation || 0; const qb0 = w.prosperity.questBonus || 0; const prog0 = w.festivals.activeQuest.progress; const mood0 = npcs()[0].moodModifier || 0;
      const r1 = w.festivals.sponsor(w); const r2 = w.festivals.sponsor(w);
      o.eve = { ok1: r1.ok, ok2: r2.ok, msg1: r1.msg, msg2: r2.msg, silver: s0 - w.stockpile.get('silver'), rep: (w.questSystem.reputation || 0) - rep0, qb: (w.prosperity.questBonus || 0) - qb0, prog: w.festivals.activeQuest.progress - prog0, mood: (npcs()[0].moodModifier || 0) - mood0, mem: npcs()[0].memory.entries.slice(-1)[0]?.content };
      ck(o.eve.ok1 && !o.eve.ok2 && o.eve.silver === 150 && o.eve.rep === 10 && o.eve.qb === 3 && o.eve.prog === 50 && o.eve.mood === 5, 'eve effects ' + JSON.stringify(o.eve));
      ck(w.festivals.sponsorStatus(w).sponsored, 'status sponsored');
      // 節慶日:心情 ×1.5
      const moodBefore = npcs()[0].moodModifier || 0; w.clock.day = fest.day; w.festivals.dailyUpdate(w);
      o.day = { mood: (npcs()[0].moodModifier || 0) - moodBefore, expect: Math.round(fest.effects.mood_all * 1.5), logged: w.festivals.festivalLog.slice(-1)[0]?.sponsored, mem: npcs()[0].memory.entries.slice(-1)[0]?.content, active: !!w.festivals.activeFestival };
      ck(o.day.mood >= o.day.expect && o.day.logged === true && o.day.active, 'festival day ' + JSON.stringify(o.day));
      ck(w.festivals.sponsorStatus(w).open && w.festivals.sponsorStatus(w).phase === 'active' && !w.festivals.sponsor(w).ok, 'no double sponsor during festival');
      // 存讀檔
      const save = JSON.parse(JSON.stringify(w.serialize())); const W = new World(); W.loadSave(save); o.reload = { sponsorship: W.festivals.sponsorship, logged: W.festivals.festivalLog.slice(-1)[0]?.sponsored }; ck(o.reload.sponsorship && o.reload.sponsorship.key === w.festivals._seasonKey(w) && o.reload.logged === true, 'reload');
      ck(!('sponsor_status' in save.festivals), 'serialize has no sponsor_status');
      // 節慶中贊助(另一個世界:直接進節慶日,不先贊助)
      const W2 = new World(); W2.loadSave(JSON.parse(JSON.stringify(save))); W2.festivals.sponsorship = null; W2.stockpile.add('silver', 500);
      const m2 = Object.values(W2.agents).filter(a => !a.isPlayer && !a.isDead)[0]; const mb = m2.moodModifier || 0; const ra = W2.festivals.sponsor(W2);
      o.active = { ok: ra.ok, msg: ra.msg, mood: (m2.moodModifier || 0) - mb, logged: W2.festivals.festivalLog.slice(-1)[0]?.sponsored }; ck(o.active.ok && o.active.mood === 8 && o.active.logged === true, 'active sponsor ' + JSON.stringify(o.active));
      // UI:經濟分頁(建設子頁)與事件分頁按鈕;前夕世界
      const W3 = new World(); W3.loadSave(JSON.parse(JSON.stringify(save))); W3.festivals.sponsorship = null; W3.festivals.activeFestival = null; W3.festivals._lastFestivalSeason = null; W3.festivals.activeQuest = null; W3.clock.day = fest.day - 1; W3.festivals.dailyUpdate(W3); W3.stockpile.add('silver', 500);
      app.world = W3; app.state = W3.getState(); app.activeTab = 'economy'; app._economySubTab = 'building'; app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
      const sc = document.getElementById('sidebar-content'); o.ui = { econBtn: !!sc.querySelector('[data-action="sponsor-festival"]'), econDisabled: sc.querySelector('[data-action="sponsor-festival"]')?.disabled, text: sc.querySelector('.festival-sponsor-row')?.textContent?.trim() };
      app.activeTab = 'events'; app.renderSidebar(); await new Promise(r => setTimeout(r, 100)); o.ui.eventsBtn = !!sc.querySelector('[data-action="sponsor-festival"]');
      ck(o.ui.econBtn && o.ui.econDisabled === false && o.ui.eventsBtn, 'ui buttons ' + JSON.stringify(o.ui));
      // 早安卡列
      try { app._showMorningCard(W3.requests, 1); await new Promise(r => setTimeout(r, 100)); } catch (e) { o.morningErr = String(e); }
      o.morning = document.getElementById('morning-card')?.textContent?.replace(/\s+/g, ' ').trim() || ''; ck(/150/.test(o.morning) && !o.morningErr, 'morning card row ' + o.morning + ' ' + (o.morningErr || '')); document.getElementById('morning-card')?.remove();
      // 點擊
      const sBefore = W3.stockpile.get('silver'); sc.querySelector('[data-action="sponsor-festival"]').click(); await new Promise(r => setTimeout(r, 150));
      o.click = { silverDelta: sBefore - W3.stockpile.get('silver'), toast: !!document.querySelector('#achv-toast-host .rt-toast'), btnAfter: sc.querySelector('[data-action="sponsor-festival"]'), sponsoredText: sc.querySelector('.festival-sponsor-row')?.textContent?.trim() };
      ck(o.click.silverDelta === 150 && o.click.toast && !o.click.btnAfter, 'click ' + JSON.stringify(o.click));
      ck(!/  /.test(o.eve.msg1 || '') && !/  /.test(o.active.msg || ''), 'no double spaces');
      o.fails = fails; return o;
    });
    console.log(lang, JSON.stringify(out)); if (out.fails.length) { console.log('FAIL', lang, out.fails); process.exitCode = 1; }
    await page.close();
  }
  console.log('errors', errs); if (errs.length) process.exitCode = 1; await browser.close();
})();
