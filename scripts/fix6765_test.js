// v6.76.5 回歸:側欄每秒重畫時,「原料倉庫」的詳細內容不會自己收起來;手動收起的也維持收起;桌機與手機、中英
// v9.18.0 起原料倉庫改成資訊卡:「展開詳細」是卡片底下的按鈕(aria-expanded),展開狀態會被記住(換分頁回來也維持)——測試跟著改
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
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(2500);
    // 開「動態 → 小鎮」分頁,找到原料倉庫的「展開明細」
    await page.evaluate((m) => { const app = window.rimtownApp; if (m === 'mob') app._openKairoTab('econ-goods'); else { app.activeTab = 'econ-goods'; app._updateTabHighlight?.('economy'); app.renderSidebar(); } }, mode);
    await page.waitForTimeout(500);
    const find = () => page.evaluate(() => { const b = document.querySelector('#sidebar-content .ic-more[data-val="gd-raw"]'); const card = b?.closest('.ic-card'); const det = card?.querySelector('.ic-detail'); return b ? { open: b.getAttribute('aria-expanded') === 'true', shown: !!det && getComputedStyle(det).display !== 'none', text: b.textContent.trim().slice(0, 30) } : null; });
    const toggle = () => page.evaluate(() => document.querySelector('#sidebar-content .ic-more[data-val="gd-raw"]').click());
    // 剛開局倉庫裡只有七種原料,沒有「其他庫存」就不會有展開鈕——先放一點小麥進去
    const seeded = await page.evaluate(() => { const app = window.rimtownApp; const res = app.world.stockpile?.resources; if (!res) return false; res.wheat = Math.max(res.wheat || 0, 12); const S = app._icState(); delete S.more['gd-raw']; app.state = app.world.getState ? app.world.getState() : app.state; app.renderSidebar(); return true; });
    if (!seeded) console.log('  (找不到倉庫資料)');
    const f0 = await find();
    ok(!!f0 && !f0.open && !f0.shown, '原料倉庫有「展開詳細」且預設收起', f0);
    await toggle();
    // 照常跑遊戲(5x)幾秒,中間側欄會重畫好幾次
    const redraws = await page.evaluate(async () => { const app = window.rimtownApp; let n = 0; const orig = app.renderSidebar.bind(app); app.renderSidebar = function () { n++; return orig(); }; app._setPaused?.(false); app.world.paused = false; app._setSpeed('5'); await new Promise(r => setTimeout(r, 5000)); app.renderSidebar(); app.renderSidebar = orig; return n; });
    const f1 = await find();
    ok(redraws >= 2 && f1 && f1.open && f1.shown, `跑了 5 秒、側欄重畫 ${redraws} 次後,詳細內容仍是打開的`, { redraws, f1 });
    // 手動收起後維持收起
    await toggle();
    await page.evaluate(() => { const app = window.rimtownApp; app.renderSidebar(); app.renderSidebar(); });
    const f2 = await find();
    ok(f2 && !f2.open && !f2.shown, '手動收起後重畫也維持收起', f2);
    // 換分頁再回來不會殘留(回到預設收起)
    await toggle(); await page.evaluate(() => { const app = window.rimtownApp; app.activeTab = 'residents'; app.renderSidebar(); app.activeTab = 'econ-goods'; app.renderSidebar(); });
    const f3 = await find();
    ok(f3 && f3.open && f3.shown, '展開後換到別的分頁再回來,還是展開的(v9.17.0 起資訊卡會記住)', f3);
    await toggle();
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
