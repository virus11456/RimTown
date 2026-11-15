// v10.1.1 已定案提案的蓋章大小一致
// 以前：收合的提案卡裡，章本來要縮成 0.62 倍。但「這次開頁第一次看到」的章會播蓋章動畫，
// 動畫最後一格寫死原尺寸、播完還留在元素上，蓋過了縮小的設定，所以那幾顆章一直是大的、壓到文字；
// 等提案頁下一次重畫，章不再算新的，又縮回去。看起來就是忽大忽小。
// 1) 第一次看到（會播動畫）播完後，收合卡片裡每顆章一樣大，而且是縮小的尺寸
// 2) 提案頁重畫後大小不變；新蓋的章跟舊的一樣大
// 3) 展開的卡片章是原尺寸，收回去又變回小的
// 4) 動畫播完不留在元素上；中文、英文、手機、電腦都一樣
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; const out = {}; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const P = w.proposals; const A = Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead);
    const make = (n) => { let guard = 0; while (P.items.filter(x => x.status === 'open').length < n && guard++ < 40) { const cs = P._candidates(w, P._abs(w)); if (!cs.length) break; P._createWith(w, P._abs(w), cs[guard % cs.length], A[guard % A.length]); } return P.items.filter(x => x.status === 'open'); };
    const decide = (n, how) => { const op = make(n); op.slice(0, n).forEach((p, i) => P._decide(w, p, how[i % how.length], 'mayor')); };
    try { localStorage.removeItem('rimtown_pg'); } catch (e) {} app._pgS = null; app._stampSeen = null;
    document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await sleep(300);
    // 等蓋章動畫真的播完（軟體繪圖很慢時，動畫會晚開始，不能只等固定時間）
    const settle = async () => { const t0 = performance.now(); while (performance.now() - t0 < 25000) { const an = [...document.querySelectorAll('.pp-stamp')].flatMap(s => s.getAnimations()); if (an.every(x => x.playState === 'finished')) break; await sleep(100); } await sleep(120); };
    const go = async () => { app._ppTab = 'props'; app.activeTab = 'proposals'; app.state = w.getState(); app.renderSidebar(); await sleep(60); };
    const stamps = () => [...document.querySelectorAll('.pp-card.pp-stamped')].filter(c => c.offsetParent).map(c => { const s = c.querySelector('.pp-stamp'); const r = s.getBoundingClientRect(), k = c.getBoundingClientRect(); const cs = getComputedStyle(s);
      return { id: c.dataset.pid, mini: c.classList.contains('pg-mini'), fresh: s.classList.contains('pp-stamp-new'), w: Math.round(r.width), h: Math.round(r.height), layout: s.offsetWidth, scale: +(r.width / s.offsetWidth).toFixed(2), inCard: r.left >= k.left - 1 && r.right <= k.right + 1 && r.top >= k.top - 1, anim: s.getAnimations().length, tf: cs.transform }; });
    decide(4, ['approve', 'reject', 'approve', 'reject']); await go();
    out.first0 = stamps().map(s => s.fresh); await settle();
    out.first = stamps();
    // 再定案一件：提案頁內容變了會重畫，舊的章不再算新的
    decide(1, ['approve']); await go(); await settle(); out.second = stamps();
    // 展開一張再收回去
    const c0 = [...document.querySelectorAll('.pp-card.pp-stamped.pg-mini')].find(c => c.offsetParent); const pid = c0?.dataset.pid; c0?.querySelector('.pg-ppt')?.click(); await sleep(200);
    out.opened = stamps().find(s => s.id === pid); [...document.querySelectorAll('.pp-card')].find(c => c.dataset.pid === pid)?.querySelector('.pg-ppt')?.click(); await sleep(200); out.closed = stamps().find(s => s.id === pid);
    out.hs = document.documentElement.scrollWidth > innerWidth + 1;
    return out;
  });
  const mini1 = r.first.filter(s => s.mini), mini2 = r.second.filter(s => s.mini); const ws = (L) => L.map(s => s.w);
  const spread = (L) => L.length ? Math.max(...ws(L)) - Math.min(...ws(L)) : 99;
  ok(r.first0.length >= 4 && r.first0.every(Boolean) && mini1.length >= 4, '這次開頁第一次看到的章都算新的（會播蓋章動畫），已定案的卡片預設收合', { fresh: r.first0, minis: mini1.length });
  ok(mini1.every(s => s.scale > 0.5 && s.scale < 0.9) && spread(mini1) <= 2, '動畫播完後，收合卡片裡的章都是縮小的尺寸，每顆一樣大', mini1.map(s => [s.id, s.w, s.scale]));
  ok(mini1.every(s => s.inCard), '章沒有超出卡片', mini1.map(s => [s.id, s.inCard]));
  ok(mini1.every(s => s.anim === 0), '動畫播完不留在元素上', mini1.map(s => [s.id, s.anim]));
  ok(mini2.length >= 5 && spread(mini2) <= 2 && Math.abs(Math.max(...ws(mini2)) - Math.max(...ws(mini1))) <= 2, '再定案一件、提案頁重畫後：舊的章大小沒變，新蓋的章跟舊的一樣大', { before: ws(mini1), after: mini2.map(s => [s.id, s.w, s.fresh]) });
  ok(r.opened && !r.opened.mini && r.opened.scale > 1.0 && r.closed && r.closed.mini && Math.abs(r.closed.w - Math.max(...ws(mini2))) <= 2, '展開的卡片章是原尺寸，收回去又變回跟其他一樣小', { opened: r.opened && [r.opened.w, r.opened.scale], closed: r.closed && [r.closed.w, r.closed.scale] });
  ok(!r.hs && errs.length === 0, '沒有橫向捲動、沒有頁面錯誤', { hs: r.hs, errs: errs.slice(0, 3) });
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'zh'); await run(browser, 'mobile', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
