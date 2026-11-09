// v9.1.2 手機側欄點擊不會被每秒重畫吃掉：手指按著時自動重畫先暫停；分頁列沒變就沿用原本的按鈕（例：科技頁點「產業」沒反應）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await p.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt });
    await p.goto(BASE + 'town.html'); await p.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => { const app = window.rimtownApp; app._openKairoTab?.('economy'); });
    await p.waitForTimeout(600);
    await p.evaluate(() => { const app = window.rimtownApp; app.activeTab = 'econ-tech'; app.renderSidebar(); });
    await p.waitForTimeout(300);
    const vis = (v) => `[...document.querySelectorAll('[data-action="mobile-group-tab"][data-val="${v}"]')].find(e => e.getBoundingClientRect().width > 0)`;
    // 1) 手指按著「產業」時，每秒的自動重畫不會把按鈕換掉；放開後點擊有效
    const r1 = await p.evaluate((sel) => { const app = window.rimtownApp; const btn = eval(sel); if (!btn) return { none: true };
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      app._sidebarAt = 0; app.render(); const still = btn.isConnected; // 模擬按著時剛好輪到每秒重畫
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); btn.click();
      return { still, tab: app.activeTab }; }, vis('industry'));
    ok(r1.still && r1.tab === 'industry', '按著時剛好輪到重畫：按鈕還在，放開後切到「產業」', r1);
    // 2) 分頁列沒變時，就算側欄被強制重畫，分頁按鈕也沿用同一個（點擊不會落空）
    await p.waitForTimeout(800);
    const r2 = await p.evaluate((sel) => { const app = window.rimtownApp; const btn = eval(sel); app.renderSidebar(); app.renderSidebar(); return { same: btn.isConnected && btn === eval(sel), content: (document.getElementById('sidebar-content').textContent || '').length }; }, vis('econ-tech'));
    ok(r2.same && r2.content > 200, '分頁列沒變就沿用原本的按鈕、下面的內容照常更新', r2);
    // 3) 換分頁時分頁列會換成新的（選中的那顆亮起來）
    const r3 = await p.evaluate((sel) => { const app = window.rimtownApp; eval(sel).click(); const on = [...document.querySelectorAll('.sub-tab-bar .pp-tab.on')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.dataset.val); return { tab: app.activeTab, on }; }, vis('econ-goods'));
    ok(r3.tab === 'econ-goods' && r3.on.length === 1 && r3.on[0] === 'econ-goods', '換分頁時選中的那顆亮起來', r3);
    // 4) 放開一段時間後，自動重畫恢復
    await p.waitForTimeout(1200);
    const r4 = await p.evaluate(() => { const app = window.rimtownApp; const before = app._sidebarAt; app._sidebarAt = 0; app.render(); return { ran: app._sidebarAt > 0 }; });
    ok(r4.ran, '放開之後每秒自動重畫照常', r4);
    // 5) 真的用手指點（觸控）也有效
    await p.evaluate((sel) => eval(sel).scrollIntoView({ block: 'nearest' }), vis('industry'));
    const box = await p.evaluate((sel) => { const r = eval(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, vis('industry'));
    await p.touchscreen.tap(box.x, box.y); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.rimtownApp.activeTab) === 'industry', '手指點「產業」切得過去', box);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
