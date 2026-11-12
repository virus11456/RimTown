// v9.23.4 iPhone 的瀏覽器分頁版自己一套版面規則,跟主畫面 App 分開:
//   分頁版:高度用真正看得到的範圍(visualViewport)、整頁被推上去會捲回來、鍵盤開著不跟著縮;
//   主畫面 App:照舊走 ios-standalone 那套,不受分頁版規則影響;
//   Android 手機:兩套都不套。
// iOS 26 Safari「100dvh 比看得到的範圍高」用假的 visualViewport 模擬(高度少 52px)。真機行為這裡測不到。
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const SHORT = 52; // 看得到的範圍比版面矮多少
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of ['ios-tab', 'ios-app', 'android']) {
    console.log(mode);
    const ctx = await browser.newContext({ ...(mode === 'android' ? devices['Pixel 7'] : devices['iPhone 13']), serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
    await page.addInitScript(({ jwt, mode, SHORT }) => {
      localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); sessionStorage.setItem('rimtown_enter_now', '1');
      const et = new EventTarget(); window.__short = mode === 'ios-tab' ? SHORT : 0; window.__kb = 0;
      const fake = { width: innerWidth, get height() { return innerHeight - window.__short - window.__kb; }, offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1, addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et), dispatchEvent: et.dispatchEvent.bind(et) };
      Object.defineProperty(window, 'visualViewport', { get: () => fake, configurable: true });
      if (mode === 'ios-app') Object.defineProperty(window.navigator, 'standalone', { get: () => true, configurable: true });
    }, { jwt, mode, SHORT });
    await page.goto(BASE + 'town.html' + (mode === 'ios-tab' ? '?vp=1' : '')); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(1800);
    const r = await page.evaluate(async () => {
      const root = document.documentElement; const wait = (ms) => new Promise(r => setTimeout(r, ms)); const rect = (q) => { const x = document.querySelector(q)?.getBoundingClientRect(); return x ? { top: Math.round(x.top), bottom: Math.round(x.bottom), h: Math.round(x.height) } : null; };
      const out = { cls: [...root.classList].filter(c => c.startsWith('ios-')), webH: root.style.getPropertyValue('--web-h'), inner: innerHeight, vis: Math.round(visualViewport.height), container: rect('.rimtown-container'), header: rect('.mobile-header'), bar: rect('#kairo-bar'), diag: !!document.getElementById('vp-diag'), diagText: document.getElementById('vp-diag')?.textContent || '' };
      document.getElementById('vp-diag')?.remove();
      // 整頁被推上去(Safari 讓太高的頁面可以捲):應該自己捲回來
      root.style.overflow = 'visible'; const sp = document.createElement('div'); sp.style.cssText = 'height:300px'; document.body.appendChild(sp); document.body.style.setProperty('overflow', 'visible', 'important'); document.body.style.setProperty('height', 'auto', 'important');
      root.style.setProperty('overflow', 'visible', 'important'); window.scrollTo(0, 40); await wait(50); out.scrolledTo = Math.round(scrollY); window.dispatchEvent(new Event('scroll')); await wait(120); out.scrollAfter = Math.round(scrollY);
      sp.remove(); document.body.style.removeProperty('overflow'); document.body.style.removeProperty('height'); root.style.removeProperty('overflow'); window.scrollTo(0, 0);
      // 鍵盤打開(看得到的範圍少 336px):版面高度不跟著縮
      const app = window.rimtownApp; const id = Object.keys(app.world.agents).find(k => !app.world.agents[k].isPlayer); app.startChatWith(id); app.renderSidebar?.(); await wait(500);
      const inp = document.getElementById('chat-input'); window.__kb = 336; inp.focus(); visualViewport.dispatchEvent(new Event('resize')); await wait(500);
      out.kbWebH = root.style.getPropertyValue('--web-h'); out.kbContainer = rect('.rimtown-container');
      inp.blur(); window.__kb = 0; visualViewport.dispatchEvent(new Event('resize')); await wait(600);
      out.afterWebH = root.style.getPropertyValue('--web-h'); out.afterContainer = rect('.rimtown-container');
      return out;
    });
    if (mode === 'ios-tab') {
      ok(r.cls.includes('ios-browser') && !r.cls.includes('ios-standalone'), 'iPhone 瀏覽器分頁：套分頁版規則，不套主畫面 App 那套', r.cls);
      ok(r.webH === (r.vis + 'px') && r.container.h === r.vis && r.container.top === 0, '版面高度＝真正看得到的範圍（比 100dvh 矮 52px 時跟著矮），從最上面開始', { webH: r.webH, vis: r.vis, inner: r.inner, container: r.container });
      ok(r.header && r.header.top === 0 && r.bar && r.bar.bottom <= r.vis && r.bar.bottom >= r.vis - 2, '鎮名那一列在最上面、底部分頁列剛好貼在看得到的範圍底部', { header: r.header, bar: r.bar, vis: r.vis });
      ok(r.scrolledTo > 0 && r.scrollAfter === 0, '整頁被推上去：自己捲回來', { to: r.scrolledTo, after: r.scrollAfter });
      ok(r.kbWebH === r.webH && r.kbContainer.h === r.container.h, '鍵盤打開：版面高度不跟著縮', { kb: r.kbWebH, c: r.kbContainer });
      ok(r.afterWebH === r.webH && r.afterContainer.h === r.container.h, '鍵盤收起：高度照舊', { a: r.afterWebH, c: r.afterContainer });
      ok(r.diag && /visualViewport/.test(r.diagText) && /scrollY/.test(r.diagText) && /--web-h/.test(r.diagText), '網址加 ?vp=1：顯示量到的數字（排查用）', r.diagText.slice(0, 200));
    } else if (mode === 'ios-app') {
      ok(r.cls.includes('ios-standalone') && !r.cls.includes('ios-browser') && !r.webH, 'iPhone 主畫面 App：照舊走主畫面 App 那套，不套分頁版規則', { cls: r.cls, webH: r.webH });
      ok(r.container.top === 0 && r.container.h >= r.inner, '主畫面 App 的版面高度不受分頁版影響', { c: r.container, inner: r.inner });
    } else {
      ok(!r.cls.length && !r.webH && r.container.h === r.inner, 'Android 手機：兩套 iPhone 規則都不套，高度照舊', { cls: r.cls, webH: r.webH, c: r.container, inner: r.inner });
      ok(r.scrolledTo === 0 || r.scrollAfter === r.scrolledTo, 'Android 手機：不動頁面捲動', { to: r.scrolledTo, after: r.scrollAfter });
    }
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
