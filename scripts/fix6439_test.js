// v6.43.9 回歸:手機 ☰ 選單在有通知時也點得到;上傳雲端成功／失敗／雲端較新都要有看得到的提示;載入雲端存檔有提示;英文單複數
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    let mode = 'ok', stored = null;
    await page.route('**/api/**', (r) => { const req = r.request(); const p = new URL(req.url()).pathname.replace(/^\/api\//, ''); const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
      if (p === 'me') return j({ logged_in: true, user: { id: 1, username: 'tester' } });
      if (p === 'save' && req.method() === 'POST') { if (mode === 'fail') return j({ error: 'down' }, 500); if (mode === 'stale') return j({ success: true, stale: true }); stored = JSON.parse(req.postData()); return j({ success: true }); }
      if (p === 'saves') return j({ saves: stored ? [{ town_id: stored.town_id, town_name: stored.town_name, season: stored.season, year: stored.year, day: stored.day, population: stored.population, updated_at: new Date().toISOString() }] : [] });
      if (p.startsWith('save/')) return j({ save_data: stored.save_data });
      return j({ reply: '' }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    // 1) 有通知時打開 ☰,三個按鈕都點得到、夠高
    await page.evaluate(() => window.rimtownApp._showCornerNotice({ icon: '🎁', title: 'T', name: 'N', desc: 'D' }));
    await page.tap('#mobile-btn-menu'); await page.waitForTimeout(400);
    let r = await page.evaluate(() => ['mobile-save', 'mobile-btn-settings', 'mobile-btn-account'].map(id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); const pts = [[.5, .5], [.15, .5], [.85, .5], [.5, .15], [.5, .85]]; return { id, h: Math.round(b.height), allOk: pts.every(([fx, fy]) => { const h = document.elementFromPoint(b.x + b.width * fx, b.y + b.height * fy); return h === e || e.contains(h); }) }; }));
    ok(r.every(x => x.allOk), '有通知時 ☰ 選單的儲存／設定／帳號都點得到', r);
    ok(r.every(x => x.h >= 44), '選單按鈕至少 44px 高', r.map(x => x.h));
    await page.tap('#mobile-btn-account'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !!document.getElementById('account-menu-popup')), '有通知時按帳號照樣打開帳號選單', {});
    await page.evaluate(() => { document.getElementById('account-menu-popup')?.remove(); document.querySelectorAll('#achv-toast-host > *').forEach(e => e.remove()); });
    // 2) 上傳雲端三種結果都要看得到
    const feedback = () => page.evaluate(() => [...document.querySelectorAll('#achv-toast-host > *, #game-dialog:not(.hidden) .modal-content, #game-dialog:not(.hidden)')].filter(e => e.getBoundingClientRect().height > 0).slice(0, 3).map(e => e.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    const upload = async (m) => { mode = m; await page.evaluate(() => { document.querySelectorAll('#achv-toast-host > *').forEach(e => e.remove()); const gd = document.getElementById('game-dialog'); if (gd && !gd.classList.contains('hidden')) { (gd.querySelector('button') || gd).click(); gd.classList.add('hidden'); } }); await page.tap('#mobile-btn-menu'); await page.waitForTimeout(300); await page.tap('#mobile-btn-account'); await page.waitForTimeout(300); await page.tap('[data-action="cloud-sync-up"]'); await page.waitForTimeout(1200); return feedback(); };
    await upload('ok'); // 第一次會跳「雲端玩家」成就,先消化掉
    const fOk = await upload('ok'), fFail = await upload('fail'), fStale = await upload('stale');
    const W = lang === 'zh' ? { ok: /已上傳到雲端/, fail: /上傳到雲端失敗/, stale: /雲端已有較新的進度/ } : { ok: /Uploaded to the cloud/, fail: /Upload to the cloud failed/, stale: /Cloud has newer progress/ };
    ok(W.ok.test(fOk), '上傳成功有提示(不靠首次成就)', fOk);
    ok(W.fail.test(fFail), '上傳失敗有提示', fFail);
    ok(W.stale.test(fStale), '雲端已有較新進度有提示', fStale);
    // 3) 從雲端載入存檔有提示
    mode = 'ok'; await page.evaluate(() => document.querySelectorAll('#achv-toast-host > *, .game-dialog').forEach(e => e.remove()));
    await page.tap('#mobile-btn-menu'); await page.waitForTimeout(300); await page.tap('#mobile-btn-account'); await page.waitForTimeout(300); await page.tap('[data-action="cloud-sync-down"]'); await page.waitForTimeout(1000);
    await page.tap('[data-action="load-cloud-save"]'); await page.waitForTimeout(1500);
    const fLoad = await feedback(); ok((lang === 'zh' ? /已從雲端載入存檔/ : /Loaded save from cloud/).test(fLoad), '從雲端載入後有提示', fLoad);
    // 4) 英文單複數
    if (lang === 'en') { r = await page.evaluate(() => [t('連續登入 1 天'), t('連續登入 {n} 天').replace('{n}', 3)]); ok(r[0] === 'Login streak: 1 day' && r[1] === 'Login streak: 3 days', '連續登入單複數', r); }
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
