// v11.2.1 「按鈕按了沒反應」：其實是畫面卡住。換日那一格要算半秒到好幾秒，期間按的每一下都排隊，卡完一口氣全送出來（面板開了又關）。
//   A) 換日那一格：鎮上的事件回呼不再各自重讀狀態＋重畫面板，整格跑完只畫一次
//   B) 面板每秒自動重畫：內容一模一樣就不換；畫一次太久就放慢，快了再回來；按著的時候照樣不重畫
//   C) 卡住時排隊的點擊：第一下生效，擠在後面的丟掉；平常的連點不受影響
//   D) 手機聊天抽屜：底部狀態帶不再蓋住「歷史對話」「立即存檔」的下半截
//   E) 正按著的角落通知不會被新通知擠掉，按鈕照樣有用，新通知放開後才出來
//   F) 換日的計算只是不重複算：同一個種子跑 5 天，世界狀態跟關掉最佳化（window.RIMTOWN_NO_TICK_OPT）時一模一樣
// 用法：BASE=http://localhost:8126/ node scripts/v110210_test.js [mobile|desktop]     需要本機服務 chrome-extension/
const { chromium } = require('playwright'); const crypto = require('crypto');
const BASE = process.env.BASE || 'http://localhost:8126/'; const ONLY = process.argv[2] || ''; const PARTS = (process.env.PARTS || 'ABCDEF').toUpperCase(); // PARTS=CE 只跑其中幾段（除錯用）
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 700) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
async function open(browser, mobile, noOpt) {
  const page = await (await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, serviceWorkers: 'block', hasTouch: !!mobile })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, noOpt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); if (noOpt) window.RIMTOWN_NO_TICK_OPT = true; }, { jwt, noOpt: !!noOpt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load', timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 }); await page.waitForTimeout(600);
  await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showSeasonRecap = () => {}; document.querySelectorAll('#season-recap,.rt-modal-overlay').forEach(x => x.remove()); });
  return { page, errs };
}
// 固定種子的城鎮跑幾天（亂數、時間都固定），回傳世界狀態的文字。換日那一格走主迴圈的一步（app._simStep）
const seededRun = ({ seed, days }) => {
  const app = window.rimtownApp, w = app.world; let a = seed >>> 0; const R = Math.random, DN = Date.now;
  Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t2 = Math.imul(a ^ (a >>> 15), 1 | a); t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2; return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296; };
  let fake = 1790000000000; Date.now = () => (fake += 7);
  try {
    w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false;
    try { app._visitorMailboxTick(); } catch (e) {} // 把畫面的回呼接上這個世界
    if (app.tileMap) app.tileMap.getAgentHouseId = () => null; // 誰住哪一棟原本看地圖畫到哪（每次開頁不一樣）；固定成「住在自己那一區」，兩邊才比得起來
    const s0 = Object.assign({}, SCAN.stat);
    for (let i = 0; i < 96 * days; i++) { w.paused = false; app._simStep(); }
    const ag = Object.values(w.agents).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId)));
    const core = { tick: w.tickCount, stock: w.stockpile.resources, people: ag.map(x => [x.agentId, x.name, w.wallet?.bal?.[x.agentId], x.mood, x.moodModifier, x.job?.key || '', x.currentLocation, x.activity]), proposals: w.proposals.serialize ? w.proposals.serialize() : w.proposals.items };
    const all = w.serialize(); delete all.savedAt; delete all.uiUnlock; // 存檔時間、介面解鎖進度不是世界的狀態
    return { core: JSON.stringify(core), all: JSON.stringify(all).replace(/election_policy_\d+/g, 'election_policy_#').replace(/"pc\d{13}"/g, '"pc#"'), n: ag.length, day: w._absDay(), hits: SCAN.stat.hits - s0.hits, runs: SCAN.stat.runs - s0.runs, props: w.proposals.items.length, off: SCAN.off() };
  } finally { Math.random = R; Date.now = DN; }
};
async function run(browser, mobile) {
  const dev = mobile ? '手機' : '桌機'; console.log(`\n===== ${dev} =====`);
  const { page, errs } = await open(browser, mobile); const cdp = await page.context().newCDPSession(page);
  const go = (tab) => page.evaluate((tab) => { const app = window.rimtownApp; if (window.innerWidth <= 768 && app._openKairoTab) { app._kairoCardOpen = true; app._openKairoTab(tab); } else app._goTab(tab); }, tab);
  const down = async (pt) => { if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(pt.x), y: Math.round(pt.y) }] }); else { await page.mouse.move(pt.x, pt.y); await page.mouse.down(); } };
  const up = async () => { if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up(); };

  // ===== A. 換日那一格只畫一次 =====
  if (PARTS.includes('A')) {
  await page.evaluate(() => { const app = window.rimtownApp, w = app.world; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 22, pop: 110 }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false; try { app._visitorMailboxTick(); } catch (e) {} app.state = w.getState(); });
  await go('proposals');
  const A = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world; const cnt = { gs: 0, sb: 0, req: 0 };
    const gs0 = w.getState; w.getState = function () { cnt.gs++; return gs0.apply(this, arguments); }; const sb0 = app.renderSidebar; app.renderSidebar = function () { cnt.sb++; return sb0.apply(this, arguments); }; const fr0 = app._freshen; app._freshen = function (r) { if (this._inTick && r !== false) cnt.req++; return fr0.apply(this, arguments); };
    const days = (n, step) => { const rows = []; for (let i = 0; i < 96 * n; i++) { w.paused = false; const d0 = w._absDay(), c0 = Object.assign({}, cnt); step(); if (w._absDay() !== d0) rows.push({ gs: cnt.gs - c0.gs, sb: cnt.sb - c0.sb, req: cnt.req - c0.req }); } return rows; };
    const now = days(4, () => app._simStep());
    const old = days(3, () => { w.tick(); app.state = w.getState(); app._updateBGMPhase(); app.render(); }); // v11.2.0 以前主迴圈的寫法：不告訴回呼「這一格還在跑」
    w.getState = gs0; app.renderSidebar = sb0; app._freshen = fr0; return { now, old, step: typeof app._simStep, inTick: app._inTick };
  });
  ok(A.step === 'function' && A.now.length === 4 && A.now.every(r => r.gs === 1 && r.sb <= 1), `${dev}：換日那一格只重讀一次狀態、面板最多重畫一次`, A.now);
  ok(A.now.reduce((s, r) => s + r.req, 0) >= 2, `${dev}：那幾天鎮上確實有事要求重畫（提案、考驗…），都併成格子跑完後的那一次`, A.now);
  ok(A.old.some(r => r.gs >= 3), `${dev}：對照組（回呼不知道格子還在跑，照舊馬上重讀＋重畫）：同樣的換日一格重讀狀態好幾次`, A.old);
  ok(A.inTick === false, `${dev}：格子跑完，「還在跑」的記號有放掉（之後按按鈕照舊馬上更新）`, A.inTick);
  } else await page.evaluate(() => { const app = window.rimtownApp, w = app.world; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; app._fullAgentOn = () => false; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } app.state = w.getState(); });

  // ===== B. 自動重畫：一樣就不換、太慢就放慢 =====
  if (PARTS.includes('B')) {
  await go('econ-goods');
  const B = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world; const content = document.getElementById('sidebar-content'); const o = {};
    app.state = w.getState(); app._autoSidebar(); const n1 = content.lastElementChild; n1.dataset.keep = '1'; const s1 = app._sbSame || 0;
    app._autoSidebar(); o.kept = content.lastElementChild === n1 && content.lastElementChild.dataset.keep === '1'; o.counted = (app._sbSame || 0) - s1;
    w.stockpile.add('wood', 7777, w.tickCount, 'test'); app.state = w.getState(); app._autoSidebar(); o.swapped = content.lastElementChild !== n1 && content.lastElementChild._genHtml !== n1._genHtml; // 內容變了：換新的
    const n2 = content.lastElementChild; app.renderSidebar(); o.explicit = content.lastElementChild !== n2; // 明確操作（按鈕）：一律重畫
    window.RIMTOWN_NO_SB_SKIP = true; app._autoSidebar(); const n3 = content.lastElementChild; app._autoSidebar(); o.ctrl = content.lastElementChild !== n3; window.RIMTOWN_NO_SB_SKIP = false; // 對照：關掉比對就每次都換
    return o;
  });
  ok(B.kept && B.counted === 1, `${dev}：自動重畫時內容一模一樣，畫面上的節點原封不動`, B);
  ok(B.swapped, `${dev}：內容變了（倉庫多了木材）就換成新的`, B);
  ok(B.explicit && B.ctrl, `${dev}：按鈕觸發的重畫照舊每次都畫；對照組（關掉比對）每次都換`, B);
  await go('proposals');
  const B2 = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world; const content = document.getElementById('sidebar-content'); const o = {};
    app.state = w.getState(); app._autoSidebar(); const p1 = content.firstElementChild; p1.dataset.keep = '1'; app._autoSidebar(); o.kept = content.firstElementChild === p1 && p1.dataset.keep === '1';
    // 太慢就放慢：把畫面板弄成要 70 毫秒
    const rs = app.renderSidebar; let called = 0; app.renderSidebar = function () { called++; const t0 = performance.now(); while (performance.now() - t0 < 70); return rs.apply(this, arguments); };
    app._autoSidebar(); o.slowEvery = app._sbEvery; called = 0; app._sbHoldUntil = 0; app._sidebarAt = Date.now() - 1500; app.render(); o.waitWhenSlow = called === 0; app._sidebarAt = Date.now() - 2600; app.render(); o.runsAt2500 = called === 1;
    app.renderSidebar = function () { called++; return rs.apply(this, arguments); }; app._sidebarAt = Date.now() - 2600; app.render(); o.fastEvery = app._sbEvery; called = 0; app._sidebarAt = Date.now() - 1200; app.render(); o.backTo1s = called === 1;
    app.renderSidebar = rs; return o;
  });
  ok(B2.kept, `${dev}：提案面板（沒有子分頁列，自己有比對）內容沒變時照舊不重畫`, B2);
  ok(B2.slowEvery === 2500 && B2.waitWhenSlow && B2.runsAt2500, `${dev}：畫一次超過 50 毫秒 → 放慢成 2.5 秒一次`, B2);
  ok(B2.fastEvery === 0 && B2.backTo1s, `${dev}：畫得快了 → 回到每秒一次`, B2);
  { // 按著面板裡的按鈕時，自動重畫照樣先不畫（v9.29.3 的保護還在）
    await go('economy'); await page.waitForTimeout(200);
    const pt = await page.evaluate(() => { const app = window.rimtownApp; app._pressOff = false; app._pressMax = 600000; app._pressEl = null; app._pressQ = null; window.__hit = 0; for (const b of document.querySelectorAll('#sidebar-content > div:last-child button:not([disabled]), #sidebar-content > div:last-child summary')) { const r = b.getBoundingClientRect(); if (r.width < 12 || r.height < 12 || r.top < 0 || r.bottom > innerHeight) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); if (top && (top === b || b.contains(top))) { window.__pb = b; b.addEventListener('click', () => { window.__hit++; }, true); return { x, y }; } } return null; });
    if (!pt) ok(false, `${dev}：面板裡找不到可以按的按鈕`);
    else { await down(pt); await page.waitForTimeout(80); const mid = await page.evaluate(() => { const app = window.rimtownApp; app.world.stockpile.add('wood', 1, 0, 'test'); app.state = app.world.getState(); app._autoSidebar(); return { alive: document.contains(window.__pb), queued: Object.keys(app._pressQ || {}) }; }); await up(); await page.waitForTimeout(mobile ? 500 : 200);
      const hit = await page.evaluate(() => ({ hit: window.__hit, queued: Object.keys(window.rimtownApp._pressQ || {}) })); ok(mid.alive && mid.queued.includes('sidebar') && hit.hit === 1 && hit.queued.length === 0, `${dev}：按著面板按鈕時自動重畫先不畫，點擊送到，放開後補畫`, { mid, hit }); }
    await page.evaluate(() => { window.rimtownApp._pressMax = 0; });
  }
  }

  // ===== D. 手機聊天抽屜底下的按鈕不被狀態帶蓋住 =====
  if (mobile && PARTS.includes('D')) {
    await page.evaluate(() => { const app = window.rimtownApp; app._dismissKairoPanels?.(); app.chatTarget = null; app._viewingArchive = null; app.activeTab = 'chat'; app._updateTabHighlight('chat'); app.renderSidebar(); }); await page.waitForTimeout(500);
    const probe = () => page.evaluate(() => { const el = document.getElementById('sidebar-content'); for (const s of [el, el?.parentElement, ...(el ? el.querySelectorAll('*') : [])]) { if (s && s.scrollHeight - s.clientHeight > 20) s.scrollTop = s.scrollHeight; }
      const st = document.getElementById('kairo-status'); const o = { status: !!st && getComputedStyle(st).display !== 'none', btns: [] };
      for (const b of document.querySelectorAll('.btn-archive-view, .btn-archive-save')) { const r = b.getBoundingClientRect(); if (!r.width) continue; const x = r.left + r.width / 2; const at = (y) => { const e = document.elementFromPoint(x, y); return !!e && (e === b || b.contains(e)); }; o.btns.push({ text: b.textContent.trim(), x, low: r.bottom - 4, mid: at(r.top + r.height / 2), lower: at(r.bottom - 4), inView: r.bottom <= innerHeight }); } return o; });
    const D = await probe(); ok(D.btns.length >= 2 && D.btns.every(b => b.inView && b.mid && b.lower) && !D.status, '手機：聊天抽屜開著時，「歷史對話」「立即存檔」的下半截按到的是按鈕本身（狀態帶收起來了）', D);
    await page.addStyleTag({ content: '#kairo-status#kairo-status{display:flex !important}' }).then(h => h.evaluate(n => { n.id = 'tapfix-ctrl'; })); const D0 = await probe(); await page.evaluate(() => document.getElementById('tapfix-ctrl')?.remove());
    ok(D0.status && D0.btns.some(b => !b.lower), '手機對照組（硬把狀態帶顯示出來）：按鈕下半截被狀態帶蓋住', D0);
    const b0 = D.btns.find(b => /歷史/.test(b.text)) || D.btns[0]; if (b0) { await page.evaluate(() => { window.rimtownApp._pressMax = 3000; }); await page.touchscreen.tap(b0.x, b0.low); await page.waitForTimeout(500); const tab = await page.evaluate(() => ({ tab: window.rimtownApp.activeTab, card: !document.getElementById('kairo-card')?.classList.contains('hidden') })); ok(tab.tab === 'chat-archives', '手機：真的用手指點「歷史對話」的下緣 → 進歷史對話，不是跳去小鎮面板', tab); }
    const D2 = await page.evaluate(() => { window.rimtownApp._dismissKairoPanels?.(); const st = document.getElementById('kairo-status'); return !!st && getComputedStyle(st).display !== 'none'; }); ok(D2, '手機：抽屜收起來以後狀態帶回來');
  }

  // ===== E. 正按著的角落通知不被擠掉 =====
  if (PARTS.includes('E')) {
    const cap = mobile ? 1 : 2;
    const setup = (off) => page.evaluate(({ cap, off }) => { const app = window.rimtownApp; app._dismissKairoPanels?.(); document.querySelectorAll('#npc-quick-card, #loc-quick-card').forEach(c => c.classList.add('hidden')); document.querySelectorAll('#achv-toast-host .rt-toast').forEach(e => e.remove()); clearInterval(app._cornerHoldTimer); app._cornerHoldTimer = null; app._cornerHold = [];
      app._pressOff = off; app._pressMax = 600000; app._pressEl = null; app._pressQ = null; window.__went = []; app._goLook = (g) => { window.__went.push(g.locId || g.agentId); }; app._autoCamEnabled = () => false;
      if (!app.__scn) { app.__scn = app._showCornerNotice; app._showCornerNotice = function (o) { if (o && o.__test) return app.__scn.call(this, o); }; } // 這一段只放測試自己的通知進來（遊戲自己隨時會冒通知，位置會被擠動）
      for (let i = 0; i < cap; i++) app._showCornerNotice({ __test: 1, icon: '🔔', title: '舊通知 ' + (i + 1), name: '', desc: '測試', go: { locId: 'OLD' + (i + 1) } }); }, { cap, off });
    const where = () => page.evaluate(() => { const app = window.rimtownApp; const el = document.querySelector('#achv-toast-host .rt-toast:not(.morning):not(.rt-more)'); window.__t0 = el; const b = el?.querySelector('.rt-toast-go'); if (!b) return null; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, hittable: !!top && (top === b || b.contains(top)), modal: app._modalOpen() }; });
    const press = async (off) => { await setup(off); await page.waitForTimeout(600); /* 通知滑進來的動畫跑完再量位置 */ const pt = await where(); if (!pt || !pt.hittable) return { pt }; await down(pt); await page.waitForTimeout(80);
      const mid = await page.evaluate(() => { const app = window.rimtownApp; const dz = (e) => e ? e.tagName + '.' + String(e.className || '').slice(0, 30) + ':' + (e.textContent || '').trim().slice(0, 14) : null; const pe = app._pressEl; const d = { pe: dz(pe), inToast: !!pe && !!window.__t0 && window.__t0.contains(pe), n: document.querySelectorAll('#achv-toast-host .rt-toast').length };
        app._showCornerNotice({ __test: 1, icon: '🆕', title: '新通知', name: '', desc: '測試', go: { locId: 'NEW' } }); return { ...d, alive: document.contains(window.__t0), held: (app._cornerHold || []).length, shownNew: [...document.querySelectorAll('#achv-toast-host .rt-toast')].some(e => /新通知/.test(e.textContent)) }; });
      await up(); await page.waitForTimeout(mobile ? 500 : 200); const went = await page.evaluate(() => window.__went.slice()); return { pt, mid, went }; };
    const E1 = await press(false);
    ok(E1.mid && E1.mid.alive && E1.mid.held === 1 && !E1.mid.shownNew, `${dev}：正按著一張通知時來了新通知 → 按著的那張留著，新的先排隊`, E1);
    ok(E1.went && E1.went.length === 1 && E1.went[0] === 'OLD1', `${dev}：放開後「去看」照樣有用，去的是按下去的那一則`, E1.went);
    // 排隊的通知要等沒有大視窗擋著才出來（原本就是這樣）：測試裡把可能擋路的視窗收掉
    let late = false, why = null; for (let i = 0; i < 24 && !late; i++) { await page.waitForTimeout(250); why = await page.evaluate(() => { const app = window.rimtownApp; document.getElementById('center-notification-overlay')?.classList.add('hidden'); document.querySelectorAll('#season-recap').forEach(e => e.remove()); document.querySelectorAll('#npc-quick-card, #loc-quick-card').forEach(c => c.classList.add('hidden')); app._dismissKairoPanels?.(); return { shown: [...document.querySelectorAll('#achv-toast-host .rt-toast')].some(e => /新通知/.test(e.textContent)), modal: app._modalOpen(), hold: (app._cornerHold || []).length, timer: !!app._cornerHoldTimer, pe: !!app._pressEl }; }); late = why.shown; } ok(late, `${dev}：放開以後，排隊的新通知自己出來`, why);
    const E0 = await press(true);
    ok(E0.mid && !E0.mid.alive && !(E0.went || []).includes('OLD1'), `${dev}：對照組（保護關掉）：按著的那張被擠掉，「去看」沒有去到按下去的那一則`, E0);
    await page.evaluate(() => { const app = window.rimtownApp; app._pressOff = false; app._pressMax = 0; document.querySelectorAll('#achv-toast-host .rt-toast').forEach(e => e.remove()); if (app.__scn) { app._showCornerNotice = app.__scn; app.__scn = null; } });
  }

  // ===== C. 卡住時排隊的點擊 =====
  if (PARTS.includes('C')) {
    const pt = await page.evaluate(() => { const app = window.rimtownApp; app._dismissKairoPanels?.(); app._pressMax = 3000; const b = document.createElement('button'); b.id = 'tapfix-probe'; b.type = 'button'; b.textContent = '測試鈕'; b.style.cssText = 'position:fixed;left:20px;top:140px;z-index:99999;width:140px;height:48px'; b.addEventListener('click', () => { window.__n++; window.__waits.push(Math.round(performance.now() - window.__lastTs)); }); document.addEventListener('click', (e) => { window.__lastTs = e.timeStamp; }, true); document.body.appendChild(b); window.__n = 0; window.__waits = []; return { x: 90, y: 164, wired: typeof app._wireStaleClicks }; });
    await page.waitForTimeout(600); // 前面幾項才剛真的按過：隔開，這一串的第一下前面沒有「剛放行的點擊」
    const C1 = await page.evaluate(() => { const app = window.rimtownApp, b = document.getElementById('tapfix-probe'); const fire = (ago) => { const e = new MouseEvent('click', { bubbles: true, cancelable: true, view: window }); if (ago) Object.defineProperty(e, 'timeStamp', { value: performance.now() - ago }); b.dispatchEvent(e); return e.defaultPrevented; };
      const o = {}; window.__n = 0; const d0 = app._staleDropped || 0; const pv = []; for (let i = 0; i < 6; i++) pv.push(fire(2600 - i * 300)); o.burst = window.__n; o.dropped = (app._staleDropped || 0) - d0; o.prevented = pv;
      window.__n = 0; fire(0); fire(0); fire(0); o.fresh = window.__n; // 剛放行過一下，緊接著的「不排隊」點擊照樣生效
      app._staleOff = true; window.__n = 0; for (let i = 0; i < 6; i++) fire(2600 - i * 300); o.ctrl = window.__n; app._staleOff = false; return o; });
    ok(pt.wired === 'function' && C1.burst === 1 && C1.dropped === 5 && C1.prevented[0] === false && C1.prevented.slice(1).every(Boolean), `${dev}：一串排隊很久才輪到的點擊（事件時間是 1～2.6 秒前）只有第一下生效`, C1);
    ok(C1.fresh === 3, `${dev}：不排隊的點擊（事件一來就處理）連三下都生效`, C1);
    ok(C1.ctrl === 6, `${dev}：對照組（攔截關掉）：六下全部執行`, C1);
    await page.waitForTimeout(500); const C5 = await page.evaluate(() => { const b = document.getElementById('tapfix-probe'); const fire = (ago) => { const e = new MouseEvent('click', { bubbles: true, cancelable: true, view: window }); if (ago) Object.defineProperty(e, 'timeStamp', { value: performance.now() - ago }); b.dispatchEvent(e); };
      window.__n = 0; fire(2000); const first = window.__n; fire(250); const tail = window.__n - first; fire(0); return { first, tail, fresh: window.__n - first - tail }; });
    ok(C5.first === 1 && C5.tail === 0 && C5.fresh === 1, `${dev}：卡完那一刻：排很久的第一下生效，緊跟著只排了 0.25 秒的那一下算同一堆（丟掉），真的剛按的那一下照常生效`, C5);
    await page.waitForTimeout(500); const C2 = await page.evaluate(() => { const b = document.getElementById('tapfix-probe'); window.__n = 0; const e = new MouseEvent('click', { bubbles: true, cancelable: true, view: window }); Object.defineProperty(e, 'timeStamp', { value: performance.now() - 3000 }); b.dispatchEvent(e); return window.__n; }); ok(C2 === 1, `${dev}：卡住之後單獨的一下（前面沒有剛放行的）照常生效`, C2);
    // 真的卡住：主執行緒忙 2.5 秒，期間真的按 4 下
    // （先把 3D 畫面停掉：這台測試機用軟體算 3D，一張畫面要算幾百毫秒，連平常的點擊都會排隊；真的手機不會）
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__n = 0; window.__waits = []; setTimeout(() => { const t0 = performance.now(); while (performance.now() - t0 < 2500); }, 30); }); await page.waitForTimeout(250);
    const pend = []; for (let i = 0; i < 4; i++) { pend.push(cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }).catch(() => {})); await new Promise(r => setTimeout(r, 60)); pend.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }).catch(() => {})); await new Promise(r => setTimeout(r, 190)); }
    await Promise.all(pend); await page.waitForTimeout(800); const C3 = await page.evaluate(() => ({ n: window.__n, waits: window.__waits, dropped: window.rimtownApp._staleDropped })); ok(C3.n === 1 && C3.waits[0] > 350, `${dev}：畫面真的卡住 2.5 秒、期間按了 4 下 → 卡完只執行第一下（等了 ${C3.waits[0]} 毫秒）`, C3);
    // 平常的快速連點：真的按兩下
    await page.waitForTimeout(600); await page.evaluate(() => { window.__n = 0; window.__waits = []; });
    if (mobile) { await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(120); await page.touchscreen.tap(pt.x, pt.y); } else { await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(120); await page.mouse.click(pt.x, pt.y); }
    await page.waitForTimeout(500); const C4 = await page.evaluate(() => ({ n: window.__n, waits: window.__waits })); ok(C4.n === 2, `${dev}：平常快速連點兩下（${mobile ? '手指' : '滑鼠'}），兩下都生效（各等了 ${C4.waits.join('、')} 毫秒）`, C4);
  }
  ok(errs.length === 0, `${dev}：沒有程式錯誤`, errs.slice(0, 3)); await page.close();

  // ===== F. 換日的計算結果跟關掉最佳化時一模一樣 =====
  if (PARTS.includes('F')) {
    const one = async (noOpt) => { const { page, errs } = await open(browser, mobile, noOpt); const r = await page.evaluate(seededRun, { seed: 20261116, days: 5 }); await page.close(); return { ...r, errs }; };
    const off = await one(true), on = await one(false);
    ok(off.off === true && off.hits === 0 && on.off === false && on.hits > 100 && on.runs >= 5, `${dev}：最佳化那一頁真的有省（省了 ${on.hits} 次重算），對照那一頁完全沒省`, { on: { hits: on.hits, runs: on.runs, off: on.off }, off: { hits: off.hits, runs: off.runs, off: off.off } });
    ok(on.day === off.day && on.n === off.n && on.n > 30 && on.props > 0, `${dev}：兩邊都跑了 5 天（${on.n} 人、${on.props} 件提案）`, { on: [on.day, on.n, on.props], off: [off.day, off.n, off.props] });
    ok(sha(on.core) === sha(off.core), `${dev}：倉庫、每個人的錢／心情／工作／位置、提案：兩邊一模一樣（${sha(on.core)}）`, { on: sha(on.core), off: sha(off.core) });
    ok(sha(on.all) === sha(off.all), `${dev}：整份存檔內容（${Math.round(on.all.length / 1024)} KB）兩邊一模一樣（${sha(on.all)}）`, { on: sha(on.all), off: sha(off.all), len: [on.all.length, off.all.length] });
    ok(on.errs.length === 0 && off.errs.length === 0, `${dev}：跑 5 天沒有程式錯誤`, [...on.errs, ...off.errs].slice(0, 3));
  }
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (ONLY !== 'mobile') await run(browser, false);
  if (ONLY !== 'desktop') await run(browser, true);
  await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
