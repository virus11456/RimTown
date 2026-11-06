// v6.80.1 手機底部選單:再點一次正在開的那顆就收起面板、看回村莊;面板拉高也不會把「返回」推出螢幕(iPhone 網址列);點別顆是切換;子分頁也算同一組;看村民詳情時點「村民」回列表;設定鈕也能收;收起後按鈕不亮
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world && document.querySelector('#kairo-bar'), null, { timeout: 60000 }); await page.waitForTimeout(2000);
    await page.evaluate(() => { window.rimtownApp._setPaused?.(true); document.querySelectorAll('.modal-overlay,.rt-modal').forEach(m => m.remove()); });
    const st = () => page.evaluate(() => { const c = document.getElementById('kairo-card'); const r = c?.getBoundingClientRect(); return { open: !!(c && !c.classList.contains('hidden') && r && r.height > 50), tab: window.rimtownApp.activeTab, lit: [...document.querySelectorAll('#kairo-bar button.active')].map(b => b.dataset.kairoTab || b.id) }; });
    const tap = async (sel) => { await page.locator(sel).first().click({ force: true }); await page.waitForTimeout(350); };
    const B = (k) => `#kairo-bar button[data-kairo-tab="${k}"]`;
    await tap(B('records')); const a1 = await st();
    await tap(B('records')); const a2 = await st();
    ok(a1.open && a1.tab === 'records' && a1.lit.includes('records'), '點「日報」打開面板、按鈕亮起', a1);
    ok(!a2.open && !a2.lit.length, '再點一次「日報」收起面板、看回村莊，按鈕不再亮', a2);
    await tap(B('economy')); await tap(B('residents')); const b1 = await st();
    ok(b1.open && b1.tab === 'residents' && b1.lit.join() === 'residents', '開著「動態」時點「村民」是切換，不是收起', b1);
    // 子分頁也算同一組
    await page.evaluate(() => { const a = window.rimtownApp; a.activeTab = 'relmap'; a._updateTabHighlight?.('relmap'); a.renderSidebar(); }); await page.waitForTimeout(300);
    await tap(B('residents')); const b2 = await st();
    ok(!b2.open, '在「村民」組的子分頁(關係網)再點「村民」也會收起', b2);
    // 看村民詳情時點「村民」→ 回列表
    await tap(B('residents'));
    await page.evaluate(() => { const a = window.rimtownApp; const id = Object.keys(a.world.agents).find(k => !a.world.agents[k].isPlayer); a.selectedAgent = id; a.activeTab = 'detail'; a._updateTabHighlight?.('detail'); a.renderSidebar(); }); await page.waitForTimeout(300);
    await tap(B('residents')); const c1 = await st();
    ok(c1.open && c1.tab === 'residents', '看村民詳情時點「村民」回到村民列表', c1);
    // 設定鈕
    await tap('#kairo-menu-btn'); const d1 = await st(); await tap('#kairo-menu-btn'); const d2 = await st();
    ok(d1.open && d1.tab === 'settings' && !d2.open && !d2.lit.length, '設定鈕：點一下打開、再點一下收起', { d1, d2 });
    // 返回鈕收起後按鈕不亮
    await tap(B('proposals')); await tap('#kairo-card-back'); const e1 = await st();
    ok(!e1.open && !e1.lit.length, '按「返回」收起後底部按鈕不再亮', e1);
    // 點地圖收起也一樣
    await tap(B('proposals')); await page.mouse.click(195, 200); await page.waitForTimeout(350); const f1 = await st();
    ok(!f1.open && !f1.lit.length, '點地圖收起面板後按鈕不再亮', f1);
    // v6.80.1 拉高(tall)也不會把標題列與「返回」推出螢幕(模擬 iPhone Safari:可見高度比 vh 小)
    await tap(B('records'));
    const hdrPos = () => page.evaluate(() => { const h = document.getElementById('kairo-card-header').getBoundingClientRect(), b = document.getElementById('kairo-card-back').getBoundingClientRect(), c = document.getElementById('kairo-card'); return { top: Math.round(h.top), backTop: Math.round(b.top), backBottom: Math.round(b.bottom), tall: c.classList.contains('tall'), cardH: Math.round(c.getBoundingClientRect().height) }; });
    await page.evaluate(() => document.getElementById('kairo-card').classList.add('tall')); await page.waitForTimeout(200); const g1 = await hdrPos();
    // iPhone Safari 的 86vh 是用「網址列收起時」的高度算的，比看得到的高:直接給卡片一個比畫面還高的高度
    await page.evaluate(() => { document.getElementById('kairo-card').style.height = Math.round(window.innerHeight * 1.1) + 'px'; }); await page.waitForTimeout(200); const g2 = await hdrPos();
    await page.evaluate(() => { document.getElementById('kairo-card').style.height = ''; });
    ok(g1.tall && g1.top >= 0 && g1.backTop >= 0, '拉高時標題列和「返回」都在畫面裡', g1);
    ok(g2.top >= 0 && g2.backTop >= 0, '可見高度比 vh 小(iPhone 網址列)時，拉高也不會把「返回」推出螢幕', g2);
    // 點「返回」真的回得去
    await tap('#kairo-card-back'); const g3 = await st();
    ok(!g3.open, '拉高後按「返回」能收起、看回村莊', g3);
    // 拖標題列往上拖到底也不會出界
    await tap(B('records')); await page.evaluate(() => document.getElementById('kairo-card').classList.remove('tall'));
    const hb = await page.locator('#kairo-card-header').boundingBox(); await page.mouse.move(hb.x + 40, hb.y + 10); await page.mouse.down(); await page.mouse.move(hb.x + 40, -200, { steps: 8 }); const g4 = await hdrPos(); await page.mouse.up(); await page.waitForTimeout(200); const g5 = await hdrPos();
    ok(g4.top >= 0 && g5.top >= 0 && g5.backTop >= 0, '把標題列往上拖到底也不會拖出螢幕', { during: g4, after: g5 });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
