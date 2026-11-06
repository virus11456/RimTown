// v6.44.1 回歸:小手機橫放(568×320)帳號選單不超出畫面、登出點得到;clipText 不切開附加符號、印度語系、分解韓文字母、emoji
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
    // 1) 568×320 走真的路徑:☰ → 帳號
    await page.tap('#mobile-btn-menu'); await page.waitForTimeout(300); await page.tap('#mobile-btn-account'); await page.waitForTimeout(400);
    const r = await page.evaluate(() => { const p = document.getElementById('account-menu-popup'); if (!p) return null; const b = p.getBoundingClientRect(); return [...p.querySelectorAll('button')].map(e => { e.scrollIntoView({ block: 'nearest' }); const l = e.getBoundingClientRect(); const h = document.elementFromPoint(l.x + l.width / 2, l.y + l.height / 2); return { a: e.dataset.action, top: Math.round(b.top), bottom: Math.round(Math.max(b.bottom, l.bottom)), vh: innerHeight, hit: h === e || e.contains(h) }; }); });
    ok(r && r.every(x => x.bottom <= x.vh && x.top >= 0), '568×320 帳號選單沒有超出畫面', r);
    ok(r && r.every(x => x.hit), '568×320 每個選項(含登出)都點得到', r);
    // 2) clipText
    const bad = await page.evaluate(() => { const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); const out = [];
      const cases = ['abcdéfgh', 'ééééé', 'क्षत्रियक्षत्रिय', 'नमस्तेनमस्ते', 'তোমারতোমার', 'ไม่ได้ไม่ได้', '한글한글', '각각각각', 'a᪰b᷀c⃐d︠eeee', 'がががが', '👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', '🇹🇼🇯🇵🇺🇸🇹🇼', '👍🏽👍🏽👍🏽👍🏽', '1️⃣2️⃣3️⃣4️⃣', '中文字串測試一下好了'];
      for (const c of cases) { const g = [...seg.segment(c)].map(x => x.segment); for (let n = 1; n < 14; n++) { const r = clipText(c, n); const body = r.endsWith('…') ? r.slice(0, -1) : r; let acc = '', good = body === c; if (!good) for (const x of ['', ...g]) { acc += x; if (acc === body) { good = true; break; } } if (!good || /[्্]$/.test(body)) out.push([c, n, r]); } } return out; });
    ok(!bad.length, 'clipText 不切開附加符號／印度語系／韓文字母／emoji', bad.slice(0, 5));
    // 登出會重新載入頁面,放在最後,免得後面的 evaluate 撞上導覽
    await page.tap('[data-action="auth-logout"]').catch(e => errs.push('tap logout ' + e.message));
    await page.waitForLoadState('load').catch(() => {});
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
