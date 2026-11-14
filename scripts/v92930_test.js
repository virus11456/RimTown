// v9.29.3 按鈕按了沒反應：按下到放開之間，程式剛好重畫了那一塊（鎮上有事時會直接重畫面板或手牌），按著的按鈕被換掉，瀏覽器就不送出點擊。
// 這支測試用真的滑鼠／手指按下、在中間硬插一次重畫、再放開，看點擊有沒有送到；並用關掉保護的對照組證明問題真的存在。
// 用法：node scripts/v92930_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 500) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function open(browser, vp, touch) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block', hasTouch: !!touch })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {}; app._showSeasonRecap = () => {};
    w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false; for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); } app.state = w.getState();
    window.__clk = []; document.addEventListener('click', (e) => { const b = e.target.closest?.('button,summary,[data-action],[data-gh]'); window.__clk.push({ hit: !!b, mark: b?.dataset?.probe || '' }); }, true);
    document.querySelectorAll('#season-recap,.rt-modal-overlay').forEach(x => x.remove()); });
  return { page, errs };
}
// 找 root 裡第一顆看得到、真的點得到的按鈕，做記號，回傳中心點
const pickBtn = ({ sel, mark }) => { const root = document.querySelector(sel); if (!root) return null; for (const b of root.querySelectorAll('button:not([disabled]),summary')) { const r = b.getBoundingClientRect(); if (r.width < 12 || r.height < 12 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); if (top && (top === b || b.contains(top))) { b.dataset.probe = mark; window.__probe = b; return { x, y, text: b.textContent.trim().slice(0, 12) }; } } return null; };
(async () => {
  const browser = await chromium.launch();
  { // ===== 桌機：滑鼠 =====
    const { page, errs } = await open(browser, { width: 1280, height: 800 });
    const wired = await page.evaluate(() => ({ defer: typeof window.rimtownApp._pressDefer, ver: window.RIMTOWN_APP_VERSION || (typeof RIMTOWN_APP_VERSION !== 'undefined' ? RIMTOWN_APP_VERSION : '') })); ok(wired.defer === 'function', '有「按著的時候先不重畫」的保護', wired);
    // 面板：按下 → 程式直接重畫 → 放開
    const trial = async (mark, off, sel, redraw) => {
      await page.evaluate(({ off }) => { const app = window.rimtownApp; app._pressOff = off; app._pressMax = 600000; app._pressEl = null; app._pressQ = null; window.__clk.length = 0; }, { off }); // 測試機很忙時幾十毫秒的等待會被拖成好幾秒，這幾項不看上限
      const pt = await page.evaluate(pickBtn, { sel, mark }); if (!pt) return { noBtn: true };
      await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.waitForTimeout(60);
      const mid = await page.evaluate((redraw) => { const app = window.rimtownApp; if (redraw === 'gh') app._ghRefresh(); else app.renderSidebar(); return { alive: document.contains(window.__probe), queued: Object.keys(app._pressQ || {}) }; }, redraw);
      await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(120);
      const after = await page.evaluate((mark) => ({ clicks: window.__clk.slice(), got: window.__clk.some(c => c.hit && c.mark === mark), queued: Object.keys(window.rimtownApp._pressQ || {}), pressEl: !!window.rimtownApp._pressEl }), mark);
      return { pt, mid, after };
    };
    await page.evaluate(() => { const app = window.rimtownApp; app._goTab('economy'); });
    const A0 = await trial('a0', true, '#sidebar-content > div:last-child', 'sb'); ok(A0.mid && !A0.mid.alive && !A0.after.got, '對照組（保護關掉）：按著時面板重畫，按鈕被換掉，點擊真的不見了', A0);
    const A1 = await trial('a1', false, '#sidebar-content > div:last-child', 'sb'); ok(A1.mid && A1.mid.alive && A1.mid.queued.includes('sidebar') && A1.after.got, '保護開著：按著時面板先不重畫，點擊送到原本那顆按鈕', A1);
    ok(A1.after && A1.after.queued.length === 0 && !A1.after.pressEl, '放開後補畫，沒有東西卡在佇列裡', A1.after);
    const redrawn = await page.evaluate(() => !document.contains(window.__probe) || !window.__probe.dataset.probe || document.querySelectorAll('[data-probe="a1"]').length <= 1); ok(redrawn, '補畫之後面板是新的內容');
    for (const tab of ['residents', 'proposals', 'records']) { await page.evaluate((tab) => window.rimtownApp._goTab(tab), tab); const r = await trial('t_' + tab, false, '#sidebar-content', 'sb'); ok(r.noBtn || r.after.got, `「${tab}」分頁：按著時重畫，點擊不會不見`, r.noBtn ? 'no button' : r.after); }
    // 手牌
    await page.evaluate(() => { const app = window.rimtownApp; app._ghToggle(true); }); await page.waitForTimeout(300);
    const G0 = await trial('g0', true, '#gh-tray', 'gh'); const G1 = await trial('g1', false, '#gh-tray', 'gh');
    ok(G0.noBtn || (!G0.mid.alive && !G0.after.got), '對照組（保護關掉）：按著時手牌重畫，點擊不見', G0.noBtn ? 'no button' : G0);
    ok(!G1.noBtn && G1.mid.alive && G1.after.got, '保護開著：按著手牌裡的按鈕時先不重畫，點擊送到', G1);
    await page.evaluate(() => window.rimtownApp._ghToggle(false));
    // 按鈕自己的處理要重畫：馬上畫，不會被擋
    const self = await page.evaluate(async () => { const app = window.rimtownApp; app._pressOff = false; app._goTab('economy'); const b = document.querySelector('[data-action="mobile-group-tab"][data-val="econ-goods"]'); if (!b) return { none: true }; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!self.none) { await page.mouse.click(self.x, self.y); const now = await page.evaluate(() => ({ tab: window.rimtownApp.activeTab, on: document.querySelector('[data-action="mobile-group-tab"].on')?.dataset.val })); ok(now.tab === 'econ-goods' && now.on === 'econ-goods', '點子分頁：當下就換頁（按鈕自己觸發的重畫不會被延後）', now); }
    // 按著不放超過 3 秒：不再等
    await page.evaluate(() => { window.rimtownApp._pressMax = 0; window.rimtownApp._goTab('economy'); }); const pt = await page.evaluate(pickBtn, { sel: '#sidebar-content > div:last-child', mark: 'long' });
    await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.waitForTimeout(3300); const long = await page.evaluate(() => { window.rimtownApp.renderSidebar(); return document.contains(window.__probe); }); await page.mouse.up(); ok(long === false, '按著超過 3 秒就不再擋重畫（不會整塊卡住不更新）');
    // 按在地圖上：不影響面板重畫
    await page.waitForTimeout(500); await page.evaluate(() => { window.rimtownApp._goTab('economy'); }); await page.evaluate(pickBtn, { sel: '#sidebar-content > div:last-child', mark: 'map' });
    await page.mouse.move(300, 400); await page.mouse.down(); const mapP = await page.evaluate(() => { window.rimtownApp.renderSidebar(); return document.contains(window.__probe); }); await page.mouse.up(); ok(mapP === false, '按在地圖上的時候，面板照常重畫');
    // 遊戲照常跑 5 倍速：連按 30 次，每次都要送到
    await page.waitForTimeout(500); await page.evaluate(() => { const app = window.rimtownApp; app._goTab('proposals'); app._setSpeed(5); app._setPaused?.(false); app.world.paused = false; if (!app.simInterval) app.startSimulation(); app._pressMax = 600000; const _t = app.world.tick.bind(app.world); let n = 0; app.world.tick = function () { const r = _t(); if (++n % 2 === 0) { try { app.renderSidebar(); } catch (e) {} } return r; }; }); // 模擬「鎮上常常有事」：每兩格就有程式直接重畫
    let sent = 0, got = 0; for (let i = 0; i < 30; i++) { const p = await page.evaluate(pickBtn, { sel: '#sidebar-content', mark: 'live' + i }); if (!p) continue; await page.evaluate(() => { window.__clk.length = 0; }); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(90 + (i % 5) * 40); await page.mouse.up(); await page.waitForTimeout(60); sent++; if (await page.evaluate((m) => window.__clk.some(c => c.hit && c.mark === m), 'live' + i)) got++; await page.waitForTimeout(150); }
    ok(sent >= 20 && got === sent, `5 倍速、常常有事的時候連按 ${sent} 次，${got} 次送到`, { sent, got });
    ok(errs.length === 0, '桌機沒有程式錯誤', errs.slice(0, 3)); await page.close();
  }
  { // ===== 手機：手指 =====
    const { page, errs } = await open(browser, { width: 390, height: 844 }, true); const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => { const app = window.rimtownApp; app._kairoCardOpen = true; if (app._openKairoTab) app._openKairoTab('economy'); else app._goTab('economy'); }); await page.waitForTimeout(400);
    const tap = async (mark, off) => {
      await page.evaluate(({ off }) => { const app = window.rimtownApp; app._pressOff = off; app._pressMax = 600000; app._pressEl = null; app._pressQ = null; window.__clk.length = 0; }, { off });
      const pt = await page.evaluate(pickBtn, { sel: '#sidebar-content > div:last-child', mark }); if (!pt) return { noBtn: true };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(pt.x), y: Math.round(pt.y) }] }); await page.waitForTimeout(60);
      const alive = await page.evaluate(() => { window.rimtownApp.renderSidebar(); return document.contains(window.__probe); });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(450);
      return { alive, got: await page.evaluate((m) => window.__clk.some(c => c.hit && c.mark === m), mark) };
    };
    const M0 = await tap('m0', true), M1 = await tap('m1', false);
    ok(M0.noBtn || (!M0.alive && !M0.got), '手機對照組（保護關掉）：手指按著時重畫，點擊不見', M0);
    ok(!M1.noBtn && M1.alive && M1.got, '手機：手指按著時先不重畫，點擊送到', M1);
    ok(errs.length === 0, '手機沒有程式錯誤', errs.slice(0, 3)); await page.close();
  }
  await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
