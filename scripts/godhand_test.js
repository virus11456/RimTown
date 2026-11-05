// v6.48.0 事件卡獨立介面:地圖上的 🃏 按鈕(不被擋、44px 以上)、抽屜開關(按鈕／E／Esc)、選卡、打出(張數減少、抽屜收起)、反應追蹤分頁、事件分頁入口、手機底部抽屜不超出畫面;中英、桌機與手機
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [dev, lang] of [['desktop', 'zh'], ['mobile', 'zh'], ['desktop', 'en'], ['mobile', 'en']]) {
    console.log(dev, lang);
    const opts = dev === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } };
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelectorAll('#achv-toast-host > *').forEach(e => e.remove()));
    const fab = await page.evaluate(() => { const f = document.getElementById('gh-fab'); if (!f) return null; const r = f.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { w: Math.round(r.width), h: Math.round(r.height), top: f === h || f.contains(h), txt: f.innerText.replace(/\s+/g, ' '), inView: r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0 }; });
    ok(fab && fab.top && fab.h >= 44 && fab.w >= 44 && fab.inView, '地圖上的 🃏 按鈕看得到、點得到、夠大', fab);
    ok(fab && /2\/2/.test(fab.txt), '按鈕顯示今天還能打 2/2', fab?.txt);
    await page.tap ? null : null;
    if (dev === 'mobile') await page.tap('#gh-fab'); else await page.click('#gh-fab');
    await page.waitForTimeout(400);
    const tray = await page.evaluate(() => { const t = document.getElementById('gh-tray'); const r = t.getBoundingClientRect(); return { open: !t.hidden && t.classList.contains('open'), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, vh: innerHeight, cards: t.querySelectorAll('.gh-card').length, sel: t.querySelector('.gh-card.sel')?.dataset.v, play: !!t.querySelector('.gh-play:not([disabled])') }; });
    ok(tray.open && tray.cards >= 20 && tray.sel && tray.play, '抽屜打開:有手牌、預選一張、可以打出', tray);
    ok(tray.top >= 0 && tray.bottom <= tray.vh && tray.left >= 0 && tray.right <= tray.vw, '抽屜沒有超出畫面', tray);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/gh_${dev}_${lang}.png` });
    // 選另一張卡
    const second = await page.evaluate(() => [...document.querySelectorAll('#gh-tray .gh-card:not(.blocked)')][3]?.dataset.v);
    await page.click(`#gh-tray .gh-card[data-v="${second}"]`); await page.waitForTimeout(200);
    const sel2 = await page.evaluate(() => ({ sel: document.querySelector('#gh-tray .gh-card.sel')?.dataset.v, name: document.querySelector('#gh-tray .gh-d-nm')?.innerText }));
    ok(sel2.sel === second && sel2.name, '點卡會換到那張的說明', sel2);
    // 篩選
    await page.click('#gh-tray [data-gh="filter"][data-v="fortune"]'); await page.waitForTimeout(150);
    const fl = await page.evaluate(() => [...document.querySelectorAll('#gh-tray .gh-card')].every(c => c.classList.contains('gh-fortune')));
    ok(fl, '分類篩選只顯示機運卡', fl);
    // 打出
    const cardId = await page.evaluate(() => document.querySelector('#gh-tray .gh-card.sel')?.dataset.v);
    await page.click('#gh-tray .gh-play'); await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ open: document.getElementById('gh-tray').classList.contains('open'), n: document.querySelector('#gh-fab .gh-fab-n')?.textContent, played: window.rimtownApp.world.eventCards.played.length }));
    ok(!after.open && /1\/2/.test(after.n) && after.played === 1, '打出後抽屜收起、按鈕變 1/2', { ...after, cardId });
    // 反應追蹤分頁
    await page.evaluate(() => window.rimtownApp._ghShow()); await page.waitForTimeout(300);
    await page.click('#gh-tray [data-gh="tab"][data-v="track"]'); await page.waitForTimeout(200);
    const tr = await page.evaluate(() => document.querySelectorAll('#gh-tray .gh-tr').length);
    ok(tr === 1, '反應追蹤分頁列出剛打的卡', tr);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/gh_track_${dev}_${lang}.png` });
    if (dev === 'desktop') {
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const c1 = await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'));
      await page.keyboard.press('e'); await page.waitForTimeout(300);
      const c2 = await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'));
      ok(!c1 && c2, '桌機:Esc 關閉、E 打開', { c1, c2 });
      await page.keyboard.press('Escape');
    } else { await page.click('#gh-tray [data-gh="close"]'); await page.waitForTimeout(300); ok(!(await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'))), '手機:✕ 關閉', {}); }
    // 事件分頁入口
    await page.evaluate(() => { const app = window.rimtownApp; app.activeTab = 'events'; app.renderSidebar?.(); });
    await page.waitForTimeout(300);
    const entry = await page.evaluate(() => ({ entry: !!document.querySelector('.gh-entry'), oldGrid: !!document.querySelector('.ec-grid') }));
    ok(entry.entry && !entry.oldGrid, '事件分頁改成入口按鈕(不再重複一份手牌)', entry);
    ok(!errs.length, `${dev} ${lang} 沒有頁面錯誤`, errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
