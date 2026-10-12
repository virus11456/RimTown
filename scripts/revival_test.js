// 選跑:node scripts/revival_test.js   需本機 http://127.0.0.1:8126 服務 wordpress/,NODE_PATH 指到有 playwright 的 node_modules
// 衰敗 → 連續撐過兩季 → 復興;存讀檔;回顧有復興行;UI 有衰敗中提示
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const tr = w.trials; const o = {}; const events = [];
    const origEv = w.onTrialEvent; w.onTrialEvent = (k, ti, d) => { events.push(k); try { origEv?.(k, ti, d); } catch (e) { o.evErr = e.message; } }; const origEnd = w.onEndingEvent; o.origEndType = typeof origEnd; w.onEndingEvent = (k, ti, d) => { events.push('ending:' + k); try { origEnd?.(k, ti, d); } catch (e) { o.endErr = e.message; } };
    const run = (type, pass) => { tr.current = { type, seasonKey: tr._seasonKey(w), status: 'active', target: pass ? 0 : 999999, startAbsDay: 0, dueDay: 15 }; tr._resolve(w, true); };
    // two fails → decline
    run('famine', false); run('plague', false);
    o.declined = w.multiEnding.endingTriggered; o.failStreak = tr.failStreak;
    app.state = w.getState(); app.activeTab = 'quest'; app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
    o.blockDeclined = /衰敗中/.test(document.getElementById('sidebar-content')?.textContent || '');
    document.getElementById('ending-overlay')?.remove(); app._notifCardOpen = false; app._centerNotifQueue = []; const ov = document.getElementById('center-notification-overlay'); ov?.classList.add('hidden');
    // one pass → still declined, 1/2
    run('bandits', true); o.afterOne = { ending: w.multiEnding.endingTriggered, passStreak: tr.passStreak };
    // second pass → revived
    w.recap.start = w.recap._snap(w); // 季初快照在復興前
    app._lastCenterShownAt = 0; w.paused = false; run('pricewar', true); w.paused = true; await new Promise(r => setTimeout(r, 300)); o.afterTwo = { ending: w.multiEnding.endingTriggered, revivals: w.multiEnding.revivals, passStreak: tr.passStreak };
    o.events = events; o.centerCardShown = !!(document.getElementById('center-notification-overlay') && !document.getElementById('center-notification-overlay').classList.contains('hidden'));
    o.centerText = (document.getElementById('center-notification-card')?.textContent || '').slice(0, 60);
    o.endingShownFlag = app._endingShown; o.diag = { queue: (app._centerNotifQueue || []).length, busy: app._isPlayerBusy?.(), overlay: !!document.getElementById('center-notification-overlay'), lastCenter: app._lastCenterShownAt, paused: w.paused, notifOpen: app._notifCardOpen, hasHandler: typeof w.onEndingEvent };
    // recap line
    const s0 = w.recap.start; w.clock.season = s0.season === '春季' ? '夏季' : '春季'; w.clock.day = 1; w.recap.daily(w);
    const r = w.recap.last; o.recap = { revived: r.revived, grade: r.grade, hasLine: w.recap.lines(r).some(l => /復興/.test(l.text)) };
    // save/load
    const d = w.multiEnding.serialize(); const M = new (w.multiEnding.constructor)(); M.loadFrom(JSON.parse(JSON.stringify(d))); o.reload = { revivals: M.revivals, ending: M.endingTriggered };
    const td = tr.serialize(); const T = new (tr.constructor)(); T.loadFrom(JSON.parse(JSON.stringify(td))); o.reloadTr = { passStreak: T.passStreak };
    // later ending still possible
    o.canEndAgain = !w.multiEnding.endingTriggered;
    app.state = w.getState(); app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
    o.blockRevived = /復興過 1 次/.test(document.getElementById('sidebar-content')?.textContent || '');
    return o;
  });
  console.log(JSON.stringify(out, null, 1)); console.log('errors', errs); await browser.close();
})();
