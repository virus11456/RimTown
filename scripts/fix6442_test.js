// v6.44.2 回歸:睡前一小時待在家(不再 21:30 出門吃飯、22:00 頂著 zzz 走回家);馬車站文字看得清楚、鄰鎮名依語言顯示
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
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    // 1) 馬車站
    const c = await page.evaluate(() => { const app = window.rimtownApp; app.world.otherTowns = [{ id: 'a', name: 'Seabreeze Harbor' }, { id: 'b', name: '礦山鎮' }, { id: 'c', name: '我的小鎮' }];
      app._showCoachDialog(); const d = document.getElementById('coach-dialog'); const lum = (s) => { const m = s.match(/\d+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const r = { title: lum(getComputedStyle(d.querySelector('span')).color), btn: lum(getComputedStyle(d.querySelector('.coach-go')).color), texts: [...d.querySelectorAll('.coach-go span')].map(s => s.textContent) }; d.remove(); return r; });
    ok(c.title > 0.6 && c.btn > 0.6, '馬車站標題與按鈕是淺色字(夜色面板)', c);
    ok(lang === 'zh' ? c.texts[0] === '前往 海風鎮' && c.texts[1] === '前往 礦山鎮' : /Seabreeze Harbor$/.test(c.texts[0]) && /Mine Ridge$/.test(c.texts[1]) && !/ {2}/.test(c.texts[0]), '鄰鎮名依語言顯示', c.texts);
    ok(c.texts[2].endsWith('我的小鎮'), '自訂鎮名照原樣', c.texts);
    // 2) 作息:21:00～次日 05:00,非夜貓子不在外面;22:00 後睡著的人都在家
    const s = await page.evaluate(() => { const app = window.rimtownApp, w = app.world; app._setPaused?.(true); const step = () => { w.paused = false; w.tick(); w.paused = true; };
      const bad = []; for (let d = 0; d < 3; d++) { let g = 0; while (!(w.clock.hour === 21 && w.clock.minute === 0) && g++ < 200) step();
        for (let i = 0; i < 32; i++) { step(); const h = w.clock.hour; for (const a of Object.values(w.agents)) { if (a.isDead || a.isPlayer || a.personality.traits.includes('night_owl')) continue; if ((a.needs?.rest ?? 0) >= 80) continue; // 睡飽還醒著的人本來就可能夜遊
          if (a.currentLocation !== a.homeLocation && !a._exploring && !a.isTraveling && !a.traveling) bad.push(`${w.clock.hour}:${w.clock.minute} ${a.name} ${a.activity}@${a.currentLocation}`); } } }
      return bad; });
    ok(s.length <= 3, '睡前一小時到天亮,一般村民待在家', s.slice(0, 6));
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
