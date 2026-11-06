// v6.43.8 回歸:手機／桌機按「帳號」要看得到選單(以前沒有樣式,被 3D 地圖蓋住)、選項能用、點外面會關;沒登入則打開登入視窗
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const visibleOnTop = (sel) => { const e = document.querySelector(sel); if (!e) return { found: false }; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(24, r.height / 2));
  return { found: true, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, onTop: !!hit && e.contains(hit), pos: cs.position }; };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [label, dev, loggedIn] of [['手機登入', devices['iPhone 13'], true], ['手機訪客', devices['iPhone 13'], false], ['桌機登入', { viewport: { width: 1280, height: 800 } }, true]]) {
    console.log(label);
    const ctx = await browser.newContext({ ...dev, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (r) => { const u = r.request().url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); if (u.includes('/api/saves')) return j({ saves: [] }); return j({ reply: '' }); });
    await page.addInitScript(({ jwt, loggedIn }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, loggedIn });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const mobile = label.startsWith('手機');
    if (!loggedIn) await page.evaluate(() => { const a = window.rimtownApp.auth; Object.defineProperty(a, 'loggedIn', { get: () => false, configurable: true }); }); // 進遊戲後登入過期／被登出
    const open = async () => { if (mobile) { await page.tap('#mobile-btn-menu'); await page.waitForTimeout(300); await page.tap('#mobile-btn-account'); } else await page.click('#btn-account'); await page.waitForTimeout(400); };
    await open();
    if (loggedIn) {
      let r = await page.evaluate(visibleOnTop, '#account-menu-popup');
      ok(r.found && r.inView && r.onTop && r.pos === 'fixed' && r.h > 150, '按帳號後選單完整顯示在畫面上、不被地圖蓋住', r);
      r = await page.evaluate(() => [...document.querySelectorAll('#account-menu-popup button')].map(b => Math.round(b.getBoundingClientRect().height)));
      ok(r.length === 4 && r.every(h => h >= 44), '四個選項、每個都至少 44px 好點', r);
      if (mobile) await page.tap('#account-menu-popup [data-action="show-achievements"]'); else await page.click('#account-menu-popup [data-action="show-achievements"]');
      await page.waitForTimeout(500);
      r = await page.evaluate(() => { const panel = document.querySelector('.achievements-panel'); const b = panel?.getBoundingClientRect(); const hit = b ? document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(20, b.height / 2)) : null; return { achievements: !!panel && b.width > 0 && b.height > 0 && b.top < innerHeight && b.bottom > 0 && !!hit && panel.contains(hit), popupGone: !document.getElementById('account-menu-popup'), tab: window.rimtownApp.activeTab }; });
      ok(r.achievements && r.popupGone, '點「成就」會打開成就面板(手機打開抽屜)、選單收起', r);
      await page.evaluate(() => { try { window.rimtownApp._dismissKairoPanels?.(); } catch (e) {} });
      await open(); const before = await page.evaluate(() => !!document.getElementById('account-menu-popup'));
      if (mobile) await page.tap('.rimtown-container', { position: { x: 200, y: 600 } }); else await page.mouse.click(400, 600);
      await page.waitForTimeout(300); const after = await page.evaluate(() => !!document.getElementById('account-menu-popup'));
      ok(before && !after, '點選單外面會關掉', { before, after });
      await open(); await open(); const toggled = await page.evaluate(() => !!document.getElementById('account-menu-popup'));
      ok(!toggled, '再按一次帳號會收起選單', { toggled });
    } else {
      const r = await page.evaluate(() => { const m = document.getElementById('auth-modal'); return { open: m && !m.classList.contains('hidden'), ...(m ? (() => { const b = m.querySelector('.modal-content')?.getBoundingClientRect(); return b ? { inView: b.top >= -1 && b.left >= -1 && b.right <= innerWidth + 1 } : {}; })() : {}) }; });
      ok(r.open && r.inView !== false, '沒登入:按帳號打開登入視窗', r);
    }
    ok(!errs.length, label + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
