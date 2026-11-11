// v6.76.4 設定頁 AI 區塊版面:勾選框不被撐滿、標題同一行、條列卡片、額度依伺服器實際回報(不再寫死 300 則)、
// 稱號不重複(村長（村長）)、桌機與手機都沒有橫向溢出
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
    await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); TIERS.S(app.world).lv = 0; document.querySelectorAll('.rt-toast').forEach(e => e.remove()); });
    if (mode === 'mob') await page.click('#kairo-menu-btn'); else await page.click('#btn-settings');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const card = document.querySelector('.set-toggle-card'); if (!card) return { missing: true };
      const cbEl = document.getElementById('settings-fullagent'); const cb = (cbEl.closest('.set-switch') || cbEl).getBoundingClientRect() /* v9.18.0 勾選框改成開關 */, tt = card.querySelector('.set-toggle-title').getBoundingClientRect();
      const root = document.querySelector('.set-card')?.closest('.econ-section') || document.body; const txt = root.innerText;
      return { cbW: Math.round(cb.width), sameLine: Math.abs((cb.top + cb.bottom) / 2 - (tt.top + tt.bottom) / 2) < 10, titleW: Math.round(tt.width), titleH: Math.round(tt.height),
        lists: document.querySelectorAll('.set-list li').length, txt: txt.replace(/\s+/g, ' ').slice(0, 900), overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    ok(!r.missing && r.cbW <= 48 && r.sameLine && r.titleH < 30, '完整智能體:開關正常大小,跟標題同一行、標題不被擠成兩行', r);
    ok(r.lists >= 3, 'AI 狀態改成條列', r.lists);
    ok(!/300 則|300 per day|300 a day/.test(r.txt), '不再寫死每日 300 則', r.txt.slice(0, 200));
    ok(lang === 'zh' ? /沒有每日次數上限/.test(r.txt) : /No daily limit/.test(r.txt), '沒有上限時寫「沒有每日次數上限」', r.txt.slice(0, 200));
    ok(!/村長（村長）|鎮長（鎮長）|村長（鎮長）|\(village chief\)|village chief's \(/.test(r.txt), '稱號不重複', r.txt.slice(0, 400));
    ok(!r.overflowX, '沒有橫向溢出', r.overflowX);
    // 伺服器回報有上限時改顯示剩餘額度
    const q = await page.evaluate(() => { const app = window.rimtownApp; app.llmClient._quota = { remaining: 120, limit: 300, day: new Date().toISOString().slice(0, 10) }; if (window.innerWidth <= 768) app._openKairoTab('settings'); else app.renderSidebar(); const t2 = (document.querySelector('.set-card')?.innerText || ''); delete app.llmClient._quota; return t2.replace(/\s+/g, ' '); });
    ok(lang === 'zh' ? /剩 120／300 則/.test(q) : /120 of 300 left/.test(q), '有上限時顯示今天剩多少', q);
    // 教學與提案頁空白說明(村莊等級)也不重複稱號
    const tx = await page.evaluate(() => { const s4 = document.querySelector('.tutorial-step[data-step="4"]')?.textContent || ''; const app = window.rimtownApp; const box = document.createElement('div'); const st = app.state; app.state = Object.assign({}, st, { proposals: null }); try { app.renderProposals(box); } catch (e) {} app.state = st; return (s4 + ' | ' + box.innerText).replace(/\s+/g, ' '); });
    ok(!/村長（村長）|村長（鎮長）|\(village chief\)|\(mayor\)/.test(tx), '教學與提案頁也不重複稱號', tx.slice(0, 300));
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
