// v9.8.1 手機聊天打字:聊天框貼在鍵盤正上方、不伸到狀態列底下、地圖不會從聊天框和鍵盤中間露出來;一般與 iPhone 主畫面 App(補 Home 條)兩種
// 鍵盤用假的 visualViewport 模擬(高度少 336px)。需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of ['web', 'ios-app']) {
    console.log(mode);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
    await page.addInitScript(({ jwt, mode }) => {
      localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); sessionStorage.setItem('rimtown_enter_now', '1');
      // 假鍵盤:聚焦聊天輸入框時 visualViewport 變矮 336px
      const et = new EventTarget(); const fake = { width: innerWidth, get height() { return innerHeight - (window.__kb || 0); }, offsetTop: 0, offsetLeft: 0, scale: 1, addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et), dispatchEvent: et.dispatchEvent.bind(et) };
      Object.defineProperty(window, 'visualViewport', { get: () => fake, configurable: true });
      if (mode === 'ios-app') document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('ios-standalone', 'ios-gapfix'));
    }, { jwt, mode });
    await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(1500);
    const before = await page.evaluate(async () => {
      const app = window.rimtownApp; const id = Object.keys(app.world.agents).find(k => !app.world.agents[k].isPlayer); app.startChatWith(id); app.renderSidebar?.(); await new Promise(r => setTimeout(r, 600));
      const sb = document.getElementById('rimtown-sidebar'); return { open: sb.classList.contains('chat-open'), bottom: Math.round(sb.getBoundingClientRect().bottom), h: innerHeight };
    });
    const r = await page.evaluate(async () => {
      const inp = document.getElementById('chat-input'); window.__kb = 336; inp.focus(); window.visualViewport.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 700));
      const sb = document.getElementById('rimtown-sidebar').getBoundingClientRect(); const ir = inp.getBoundingClientRect(); const kbTop = innerHeight - 336;
      const out = { kb: document.body.classList.contains('rt-kb-open'), sbTop: Math.round(sb.top), sbBottom: Math.round(sb.bottom), kbTop, inBottom: Math.round(ir.bottom), scrollY: scrollY };
      inp.blur(); window.__kb = 0; window.visualViewport.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 500));
      const sb2 = document.getElementById('rimtown-sidebar').getBoundingClientRect(); out.after = Math.round(sb2.bottom); out.vars = getComputedStyle(document.documentElement).getPropertyValue('--kb-b');
      return out;
    });
    ok(before.open, '點村民聊天打開聊天框', before);
    ok(r.kb && Math.abs(r.sbBottom - r.kbTop) <= 2, '鍵盤打開：聊天框貼在鍵盤正上方（中間不露出地圖）', r);
    ok(r.inBottom <= r.kbTop && r.sbTop >= 0 && r.scrollY === 0, '輸入框看得到、聊天框沒有被推到畫面外、頁面沒有往上捲', r);
    ok(Math.abs(r.after - before.bottom) <= 2 && !r.vars.trim(), '鍵盤收起：聊天框回到原本位置', { before, r });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
