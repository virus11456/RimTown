// v6.76.5 回歸:側欄每秒重畫時,展開的區塊不會自己收起來;手動收起的也維持收起;桌機與手機、中英
// v9.17／v9.18 起小鎮概況與物資頁改成資訊卡(app-cards.js 的 _ic):原料倉庫的「展開明細」<details> 變成卡片上的「展開詳細」按鈕,
//   開合狀態記在 app._icState()(展開詳細／整張卡收合存 localStorage,ⓘ 說明只記這一次開著的期間)。這支測試改成對著新的卡片檢查同一件事;
//   還在用 <details> 的地方(日報的「逐筆紀錄」)也照舊檢查,那邊靠 _snapDetails／_restoreDetails。
// v9.19.2 一併補上:ⓘ「怎麼算的」打開後,重畫也不會自己收起來。
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
    // 頁面裡共用的小工具:換分頁、讀卡片狀態、點卡片上的按鈕、照常跑幾秒並數側欄重畫幾次
    await page.evaluate((m) => {
      const app = window.rimtownApp;
      window.__go = (tab) => { if (m === 'mob') app._openKairoTab(tab); else { app.activeTab = tab; app._updateTabHighlight?.(app._mobileSubToMain?.[tab] || tab); } app.state = app.world.getState(); app.renderSidebar(); };
      window.__card = (id) => { const c = document.querySelector('#sidebar-content #ic-' + id); if (!c) return null; const shown = (sel) => { const e = c.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
        return { title: c.querySelector('.ic-tt')?.textContent.trim(), open: c.classList.contains('open') && shown('.ic-main'), btn: (c.querySelector('.ic-more .ic-more-o')?.textContent || '').trim(), more: shown('.ic-detail'), detail: (c.querySelector('.ic-detail')?.textContent || '').trim().slice(0, 60), info: shown('.ic-info'), hasInfo: !!c.querySelector('.ic-ibtn') }; };
      window.__tap = (id, action) => { document.querySelector(`#sidebar-content #ic-${id} [data-action="${action}"]`).click(); };
      window.__run = async (ms) => { let n = 0; const orig = app.renderSidebar.bind(app); app.renderSidebar = function () { n++; return orig(); }; app._setPaused?.(false); app.world.paused = false; app._setSpeed('5'); await new Promise(r => setTimeout(r, ms)); app._setPaused?.(true); app.renderSidebar = orig; app.renderSidebar(); return n; };
    }, mode);
    // 開「動態 → 物資」分頁。新開的鎮倉庫裡只有七種原料(直接看得到),放一點別的庫存進去才會有「展開詳細」
    await page.evaluate(() => { const app = window.rimtownApp, w = app.world; w.stockpile.add('wheat', 500, w.tickCount, 'test'); window.__go('econ-goods'); });
    await page.waitForTimeout(500);
    const card = (id) => page.evaluate((i) => window.__card(i), id);
    const tap = (id, action) => page.evaluate(([i, a]) => window.__tap(i, a), [id, action]);
    const redraw = () => page.evaluate(() => { const app = window.rimtownApp; app.renderSidebar(); app.renderSidebar(); });
    const f0 = await card('gd-raw');
    ok(!!f0 && /原料倉庫|Raw/i.test(f0.title) && /展開詳細|Show details/.test(f0.btn) && f0.open && !f0.more && f0.detail.length > 0, '原料倉庫有「展開詳細」且預設收起（其他庫存收在裡面，沒有不見）', f0);
    // 展開詳細;另外打開一張有 ⓘ 說明的卡(商店那張預設是收合的,先展開再點 ⓘ)
    await tap('gd-raw', 'ic-more');
    const s0 = await card('gd-shop'); if (s0 && !s0.open) await tap('gd-shop', 'ic-toggle'); await tap('gd-shop', 'ic-info');
    const s1 = await card('gd-shop');
    ok(!!s0 && s0.hasInfo && s1.open && s1.info, '點 ⓘ 會打開「怎麼算的」說明', { s0, s1 });
    // 照常跑遊戲(5x)幾秒,中間側欄會重畫好幾次
    const redraws = await page.evaluate(() => window.__run(5000));
    const f1 = await card('gd-raw'), s2 = await card('gd-shop');
    ok(redraws >= 2 && f1 && f1.open && f1.more, `跑了 5 秒、側欄重畫 ${redraws} 次後,「展開詳細」仍是打開的`, { redraws, f1 });
    ok(redraws >= 2 && s2 && s2.open && s2.info, `重畫 ${redraws} 次後,ⓘ 說明仍是打開的`, { redraws, s2 });
    // 手動收起後維持收起
    await tap('gd-raw', 'ic-more'); await tap('gd-shop', 'ic-info'); await redraw();
    const f2 = await card('gd-raw'), s3 = await card('gd-shop');
    ok(f2 && f2.open && !f2.more, '手動收起詳細後重畫也維持收起', f2);
    ok(s3 && s3.open && !s3.info, '按「知道了」收起說明後重畫也維持收起', s3);
    // 整張卡收合:重畫後維持收合,再點開也維持打開
    await tap('gd-raw', 'ic-toggle'); await redraw(); const f3 = await card('gd-raw');
    await tap('gd-raw', 'ic-toggle'); await redraw(); const f4 = await card('gd-raw');
    ok(f3 && !f3.open && f4 && f4.open, '整張卡收合／展開,重畫後都維持原樣', { f3, f4 });
    // 換分頁再回來:v9.17 起卡片會記得上次的開合(收合記憶),展開的還是展開、收起的還是收起
    await tap('gd-raw', 'ic-more'); await page.evaluate(() => { window.__go('residents'); window.__go('econ-goods'); }); const f5 = await card('gd-raw');
    await tap('gd-raw', 'ic-more'); await page.evaluate(() => { window.__go('residents'); window.__go('econ-goods'); }); const f6 = await card('gd-raw');
    ok(f5 && f5.more && f6 && !f6.more, '換到別的分頁再回來,卡片記得上次是展開還是收起', { f5, f6 });
    // 還在用 <details> 的區塊(日報的「逐筆紀錄」):重畫不會自己收起、手動收起維持收起、換分頁回來恢復預設收起
    await page.evaluate(() => window.__go('records'));
    const det = (set) => page.evaluate((v) => { const d = document.querySelector('#sidebar-content details.log-messages-section') || document.querySelector('#sidebar-content details'); if (!d) return null; if (v !== null) d.open = v; return { open: d.open, text: d.querySelector('summary').textContent.trim().slice(0, 30) }; }, set ?? null);
    const d0 = await det();
    await det(true); await redraw(); const d1 = await det();
    await det(false); await redraw(); const d2 = await det();
    await det(true); await page.evaluate(() => { window.__go('residents'); window.__go('records'); }); const d3 = await det();
    ok(d0 && !d0.open && d1 && d1.open && d2 && !d2.open && d3 && !d3.open, '<details> 區塊（逐筆紀錄）重畫不會自己收起,手動收起維持收起,換分頁回來恢復預設', { d0, d1, d2, d3 });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
