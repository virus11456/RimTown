// v6.82.2 首頁與遊戲分頁＋首頁瘦身:首頁(/)不載遊戲(沒有世界、沒有 three.js／模擬)、星空動畫只動圖層透明度(不重畫)、
// 捲出畫面暫停、更新紀錄捲到附近才載;登入後進 /town(town.html)、遊戲頁有載入畫面且準備好就收起;
// 沒登入開遊戲頁會回首頁、已登入在首頁按「繼續遊戲」進遊戲、剛登入(enter_now)直接進遊戲、遊戲裡登出回首頁;中英、桌機與 390px
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const api = (page, state) => page.route('**/api/**', r => {
  const u = r.request().url();
  if (u.includes('/api/login')) { state.loggedIn = true; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nonce: jwt, user: { id: 1, username: 'tester' } }) }); }
  if (u.includes('/api/logout')) { state.loggedIn = false; return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
  if (u.includes('/api/me')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.loggedIn ? { logged_in: true, user: { id: 1, username: 'tester' } } : { logged_in: false }) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saves: [], reply: '' }) });
});
const prep = (lang, opts = {}) => ({ lang, jwt: opts.jwt ? jwt : '', enter: !!opts.enter });
const init = ({ lang, jwt, enter }) => {
  if (sessionStorage.getItem('__inited')) return; sessionStorage.setItem('__inited', '1');
  localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0');
  if (jwt) localStorage.setItem('rimtown_jwt', jwt); else localStorage.removeItem('rimtown_jwt');
  if (enter) sessionStorage.setItem('rimtown_enter_now', '1');
};
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const mk = async (opts) => { const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); const st = { loggedIn: !!opts.jwt }; await api(page, st); await page.addInitScript(init, prep(lang, opts)); const urls = []; page.on('request', r => urls.push(r.url())); return { ctx, page, errs, urls }; };
    // 1) 沒登入開首頁:不載遊戲
    {
      const { ctx, page, errs, urls } = await mk({});
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ landing: !!document.querySelector('#landing:not(.hidden) .lp-hero'), world: !!window.rimtownApp, scripts: document.scripts.length, anims: document.getAnimations().map(a => a.effect?.target?.tagName?.toLowerCase()), regBtn: !!document.getElementById('landing-register') }));
      const heavy = urls.filter(u => /three\.min\.js|simulation\.js|town3d\.js|sim-conversation\.js|changelog\.js/.test(u)).map(u => u.split('/').pop().split('?')[0]);
      ok(r.landing && r.regBtn && !r.world, '首頁顯示介紹與註冊／登入，沒有建立遊戲世界', r);
      ok(!heavy.length && r.scripts <= 12, '首頁沒有下載 3D、模擬或更新紀錄', { heavy, scripts: r.scripts });
      ok(r.anims.length > 0 && r.anims.every(t => t === 'svg'), '星空動畫只動整層圖層（不是 SVG 裡的每顆星）', r.anims);
      // 捲出畫面暫停
      const off = await page.evaluate(async () => { const l = document.getElementById('landing'); l.scrollTop = l.scrollHeight; await new Promise(r => setTimeout(r, 400)); const h = document.querySelector('.lp-hero'); return { off: h.classList.contains('lp-off'), state: getComputedStyle(document.querySelector('.lp-sky-l')).animationPlayState }; });
      ok(off.off && off.state === 'paused', '主視覺捲出畫面就暫停動畫', off);
      await page.waitForTimeout(1500);
      const log = await page.evaluate(() => ({ items: document.querySelectorAll('#landing-log .landing-log-item').length, loaded: typeof RIMTOWN_CHANGELOG !== 'undefined' }));
      ok(log.loaded && log.items >= 5, '捲到更新紀錄附近才載入並顯示', log);
      // 繪製量:動畫跑著時幾乎不重畫
      const cdp = await ctx.newCDPSession(page); await page.evaluate(() => { document.getElementById('landing').scrollTop = 0; }); await page.waitForTimeout(500);
      const ev = []; cdp.on('Tracing.dataCollected', d => ev.push(...d.value)); await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' }); await page.waitForTimeout(3000);
      const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
      const paints = ev.filter(e => e.name === 'Paint').length;
      ok(paints < 20, '首頁動畫播放 3 秒幾乎沒有重新繪製', paints);
      // 登入 → 進遊戲頁
      await page.evaluate(() => document.getElementById('landing-login').click()); await page.waitForTimeout(300);
      await page.fill('#auth-login-user', 'tester'); await page.fill('#auth-login-pass', 'pw'); await page.click('#auth-login-btn');
      await page.waitForFunction(() => window.rimtownApp?.world && window.rimtownApp._initReady && !document.getElementById('town-loading'), null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(300);
      const g = await page.evaluate(() => ({ path: location.pathname, loading: !!document.getElementById('town-loading'), landingShown: !!document.querySelector('#landing:not(.hidden)') }));
      ok(/town(\.html)?$/.test(g.path) && !g.loading && !g.landingShown, '登入後進到遊戲頁，載入畫面收起、不再出現首頁', g);
      // 遊戲裡登出 → 回首頁
      await page.evaluate(() => window.rimtownApp._doLogout()); await page.waitForFunction(() => !window.rimtownApp && document.querySelector('#landing:not(.hidden) .lp-hero'), null, { timeout: 30000 }).catch(() => {});
      const lo = await page.evaluate(() => ({ path: location.pathname, landing: !!document.querySelector('#landing:not(.hidden)'), world: !!window.rimtownApp }));
      ok(/\/(index\.html)?$/.test(lo.path) && lo.landing && !lo.world, '遊戲裡登出回到首頁', lo);
      ok(!errs.length, '沒有頁面錯誤（首頁→登入→遊戲→登出）', errs.slice(0, 3));
      await ctx.close();
    }
    // 2) 沒登入直接開遊戲頁 → 回首頁
    {
      const { ctx, page, errs } = await mk({});
      await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForTimeout(2500);
      const r = await page.evaluate(() => ({ path: location.pathname, landing: !!document.querySelector('#landing:not(.hidden)') }));
      ok(/\/(index\.html)?$/.test(r.path) && r.landing, '沒登入開遊戲頁會回到首頁', r);
      await ctx.close();
    }
    // 3) 已登入開首頁:顯示「繼續遊戲」，按下去進遊戲;遊戲頁有載入畫面
    {
      const { ctx, page, errs } = await mk({ jwt: true });
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1200);
      const r = await page.evaluate(() => { const b = document.getElementById('landing-continue'); return { btn: !!b, disabled: b?.disabled, text: b?.textContent || '', world: !!window.rimtownApp }; });
      ok(r.btn && !r.disabled && !r.world, '已登入：首頁顯示可以按的「繼續遊戲」，還沒載入遊戲', r);
      let sawLoading = false; page.on('framenavigated', () => {});
      await Promise.all([page.waitForURL(/town(\.html)?$/, { timeout: 30000 }), page.evaluate(() => document.getElementById('landing-continue').click())]);
      sawLoading = await page.evaluate(() => { const e = document.getElementById('town-loading'); return !!e || !!window.rimtownApp?._initReady; });
      const total = await page.evaluate(() => ({ data: +(document.getElementById('town-loading')?.getAttribute('data-total') || 0), scripts: [...document.querySelectorAll('script[src]')].filter(x => !/i18n-en|changelog/.test(x.getAttribute('src'))).length }));
      await page.waitForFunction(() => window.rimtownApp?._initReady && !document.getElementById('town-loading'), null, { timeout: 60000 });
      ok(sawLoading, '進遊戲頁時先看到載入畫面', sawLoading);
      ok(!total.data || total.data === total.scripts, '載入畫面的進度總數與遊戲頁腳本數一致', total);
      ok(!errs.length, '沒有頁面錯誤（繼續遊戲）', errs.slice(0, 3));
      await ctx.close();
    }
    // 4) 剛登入(enter_now)開首頁 → 直接進遊戲
    {
      const { ctx, page, errs } = await mk({ jwt: true, enter: true });
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 });
      ok(/town(\.html)?$/.test(new URL(page.url()).pathname), '剛登入／註冊完直接進遊戲頁', page.url());
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
