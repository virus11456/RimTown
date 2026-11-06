// v6.76.5 回歸:側欄每秒重畫時,「原料倉庫 → 展開明細」等 <details> 不會自己收起來;手動收起的也維持收起;桌機與手機、中英
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const mode of ['desk', 'mob']) {
    console.log(lang, mode);
    const opt = mode === 'mob' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' };
    const ctx = await browser.newContext(opt); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    // 開「動態 → 小鎮」分頁,找到原料倉庫的「展開明細」
    await page.evaluate((m) => { const app = window.rimtownApp; if (m === 'mob') app._openKairoTab('economy'); else { app.activeTab = 'economy'; app._updateTabHighlight?.('economy'); app.renderSidebar(); } }, mode);
    await page.waitForTimeout(500);
    const find = () => page.evaluate(() => { const d = [...document.querySelectorAll('#sidebar-content details')].find(x => /展開明細|Show details|details/i.test(x.querySelector('summary')?.textContent || '')); return d ? { open: d.open, text: d.querySelector('summary').textContent.trim() } : null; });
    const f0 = await find();
    ok(!!f0 && !f0.open, '原料倉庫有「展開明細」且預設收起', f0);
    await page.evaluate(() => { const d = [...document.querySelectorAll('#sidebar-content details')].find(x => /展開明細|Show details|details/i.test(x.querySelector('summary')?.textContent || '')); d.querySelector('summary').click(); });
    // 照常跑遊戲(5x)幾秒,中間側欄會重畫好幾次
    const redraws = await page.evaluate(async () => { const app = window.rimtownApp; let n = 0; const orig = app.renderSidebar.bind(app); app.renderSidebar = function () { n++; return orig(); }; app._setPaused?.(false); app.world.paused = false; app._setSpeed('5'); await new Promise(r => setTimeout(r, 5000)); app.renderSidebar(); app.renderSidebar = orig; return n; });
    const f1 = await find();
    ok(redraws >= 2 && f1 && f1.open, `跑了 5 秒、側欄重畫 ${redraws} 次後,「展開明細」仍是打開的`, { redraws, f1 });
    // 手動收起後維持收起
    await page.evaluate(() => { const d = [...document.querySelectorAll('#sidebar-content details')].find(x => /展開明細|Show details|details/i.test(x.querySelector('summary')?.textContent || '')); d.querySelector('summary').click(); });
    await page.evaluate(() => { const app = window.rimtownApp; app.renderSidebar(); app.renderSidebar(); });
    const f2 = await find();
    ok(f2 && !f2.open, '手動收起後重畫也維持收起', f2);
    // 換分頁再回來不會殘留(回到預設收起)
    await page.evaluate(() => { const app = window.rimtownApp; const d = [...document.querySelectorAll('#sidebar-content details')].find(x => /展開明細|Show details|details/i.test(x.querySelector('summary')?.textContent || '')); d.open = true; app.activeTab = 'residents'; app.renderSidebar(); app.activeTab = 'economy'; app.renderSidebar(); });
    const f3 = await find();
    ok(f3 && !f3.open, '換到別的分頁再回來,恢復預設收起', f3);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
