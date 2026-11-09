// v6.48.0 事件卡獨立介面:地圖上的 🃏 按鈕(不被擋、44px 以上)、抽屜開關(按鈕／E／Esc)、選卡、打出(張數減少、抽屜收起)、反應追蹤分頁、事件分頁入口、手機底部抽屜不超出畫面;中英、桌機與手機
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
    const fab = await page.evaluate(() => { const f = document.getElementById('gh-fab'); if (!f) return null; const r = f.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { max: EventCardSystem.MAX_PER_DAY, w: Math.round(r.width), h: Math.round(r.height), top: f === h || f.contains(h), txt: f.innerText.replace(/\s+/g, ' '), inView: r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0 }; });
    ok(fab && fab.top && fab.h >= 44 && fab.w >= 44 && fab.inView, '地圖上的 🃏 按鈕看得到、點得到、夠大', fab);
    ok(fab && new RegExp(fab.max + '/' + fab.max).test(fab.txt), '按鈕顯示今天還能打幾張（全部）', fab);
    await page.tap ? null : null;
    if (dev === 'mobile') await page.tap('#gh-fab'); else await page.click('#gh-fab');
    await page.waitForTimeout(400);
    // v6.50.0 第一次打開先看到說明頁;「知道了」回到手牌,? 可以再打開
    const intro = await page.evaluate(() => ({ intro: !!document.querySelector('#gh-tray .gh-intro'), cards: document.querySelectorAll('#gh-tray .gh-card').length }));
    ok(intro.intro && intro.cards === 0, '第一次打開先看到「事件卡是什麼？」說明', intro);
    if (dev === 'mobile') await page.tap('#gh-tray .gh-intro-ok'); else await page.click('#gh-tray .gh-intro-ok');
    await page.waitForTimeout(200);
    if (dev === 'mobile') await page.tap('#gh-tray .gh-help'); else await page.click('#gh-tray .gh-help');
    await page.waitForTimeout(150);
    const intro2 = await page.evaluate(() => !!document.querySelector('#gh-tray .gh-intro'));
    if (dev === 'mobile') await page.tap('#gh-tray .gh-help'); else await page.click('#gh-tray .gh-help');
    await page.waitForTimeout(150);
    const intro3 = await page.evaluate(() => ({ intro: !!document.querySelector('#gh-tray .gh-intro'), seen: localStorage.getItem('rimtown_gh_intro') }));
    ok(intro2 && !intro3.intro && intro3.seen === '1', '按 ? 可以再看說明,再按一次收起;看過就記住', { intro2, intro3 });
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
    const mx = await page.evaluate(() => EventCardSystem.MAX_PER_DAY); ok(!after.open && after.n === `${mx - 1}/${mx}` && after.played === 1, '打出後抽屜收起、按鈕少一張', { ...after, cardId });
    // 反應追蹤分頁
    await page.evaluate(() => window.rimtownApp._ghShow()); await page.waitForTimeout(300);
    await page.click('#gh-tray [data-gh="tab"][data-v="track"]'); await page.waitForTimeout(200);
    const tr = await page.evaluate(() => document.querySelectorAll('#gh-tray .gh-tr').length);
    ok(tr === 1, '反應追蹤分頁列出剛打的卡', tr);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/gh_track_${dev}_${lang}.png` });
    if (dev === 'desktop') {
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const c1 = await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'));
      await page.keyboard.press('e'); await page.waitForFunction(() => document.getElementById('gh-tray').classList.contains('open'), null, { timeout: 2000 }).catch(() => {}); // 打開動畫在下一個畫格才加 open,3D 忙的時候會晚於 300ms
      const c2 = await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'));
      ok(!c1 && c2, '桌機:Esc 關閉、E 打開', { c1, c2 });
      await page.keyboard.press('Escape');
    } else { await page.click('#gh-tray [data-gh="close"]'); await page.waitForTimeout(300); ok(!(await page.evaluate(() => document.getElementById('gh-tray').classList.contains('open'))), '手機:✕ 關閉', {}); }
    // v6.50.1 關掉的抽屜不能再擋住底下的按鈕(村民卡的交談／詳情點不到)
    { await page.evaluate(() => { const app = window.rimtownApp; if (app._ghOpen) app._ghHide(); }); await page.waitForTimeout(350);
      await page.evaluate(() => { const app = window.rimtownApp; const id = Object.keys(app.state.agents).find(k => k !== 'player'); app._showNpcCard(id); }); await page.waitForTimeout(600); // 等卡片滑入動畫結束
      const g = await page.evaluate(() => { const app = window.rimtownApp; document.querySelectorAll('#achv-toast-host > *').forEach(e => e.remove()); // 剛好跳出的通知不算(這裡只測抽屜)
        const tr = document.getElementById('gh-tray'); const out = [...document.querySelectorAll('#npc-quick-card button')].map(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return (el === b || b.contains(el)) ? true : String(el?.id || el?.className || el?.tagName).slice(0, 40) + '@' + Math.round(r.y) + '|' + (el?.textContent||'').trim().slice(0,12) + '|' + (el?.closest('[id]')?.id || '') + '|b:' + b.textContent.trim().slice(0,6); });
        app._hideNpcCard?.(); return { display: getComputedStyle(tr).display, ok: out.length > 0 && out.every(x => x === true), n: out.length, out, vh: innerHeight }; });
      ok(g.display === 'none' && g.ok, '關掉事件卡後,村民卡的按鈕都點得到(抽屜不會隱形擋住)', g); }
    // 事件分頁入口
    await page.evaluate(() => { const app = window.rimtownApp; app.activeTab = 'events'; app.renderSidebar?.(); });
    await page.waitForTimeout(300);
    const entry = await page.evaluate(() => ({ fab: !!document.querySelector('#gh-fab, .gh-fab, [data-action="gh-open"]'), oldGrid: !!document.querySelector('#sidebar-content .ec-grid, #kairo-card-body .ec-grid') }));
    ok(entry.fab && !entry.oldGrid, '事件卡只在地圖上的 🃏 按鈕（v7.3.0 舊事件分頁併入消息，不再重複一份手牌）', entry);
    ok(!errs.length, `${dev} ${lang} 沒有頁面錯誤`, errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
