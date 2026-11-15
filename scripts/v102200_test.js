// v10.2.2 往來分頁的卡片：「地點／時間／花費」排成同一排
// 以前：這一行是用「·」接起來的字，通用的排版程式把它拆開，時間獨佔一整列，花費變成一格大數字（數字在上、💰 在下），
// 一行資訊佔了三列。現在三項各是一個小標籤，排在同一排；真的放不下才換行。
// 1) 企劃卡：地點、時間、花費在同一排，花費跟其他標籤一樣高，不再是大數字格
// 2) 沒有花費時只有兩個標籤；「走漏風聲了」也是同一排的標籤
// 3) 公告卡的價錢／地點／時間／對應企劃一樣處理
// 4) 很長的地名不會把卡片撐破；沒有橫向捲動；中文、英文、手機、電腦都一樣
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
    const w = app.world; w.observerMode = true; const A = Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead); const d = w._absDay(); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // 版面測試：卡片內容直接給定（企劃與公告怎麼產生由 v93300、v101000 測）
    const mk = (i, o) => Object.assign({ id: 'P01' + i, d0: d, stage: 'recruit', stageName: t('找人中'), secret: true, icon: '🗡️', toneName: t('算計'), title: 'T' + i, by: A[0].agentId, byName: A[0].name, here: true, target: A[1].agentId, targetName: A[1].name, ai: true, why: 'W', placeName: t('石造神殿'), when: d + 1, hour: 20, cost: 12, warned: false, ask: [{ s: 'no', id: A[2].agentId, name: A[2].name, label: t('推掉') }] }, o);
    SCHEME.view = () => [mk(1, {}), mk(2, { cost: 0 }), mk(3, { cost: 1250, warned: true, placeName: '老橡樹下的露天市集廣場旁邊那條很長很長的巷子最裡面那一間沒有招牌的小店' })];
    SCHEME.stats = () => ({ live: 3, all: 3 });
    const bv = BOARD.view.bind(BOARD); const B0 = { id: 'B018', d0: d, kind: 'sell', kindName: t('賣東西'), icon: '🏷️', stage: 'open', stageName: t('等回應'), by: A[3].agentId, byName: A[3].name, here: true, ai: true, text: 'X', showPrice: true, price: 35, meet: true, placeName: t('市集廣場'), when: d + 1, hour: 18, sid: 'P012', re: [], hops: [] };
    BOARD.view = (ww, n, k) => { let L = []; try { L = bv(ww, n, k) || []; } catch (e) {} return [B0, ...L]; };
    document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await sleep(300);
    app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'mail'; app._bdOnly = null; app.renderSidebar(); await sleep(300);
    const row = (pid) => { const c = [...document.querySelectorAll('.sk-card')].find(x => x.querySelector('.sk-id')?.textContent === pid); const e = c?.querySelector('.sk-plan'); if (!e) return null; const cb = c.getBoundingClientRect(), eb = e.getBoundingClientRect();
      const kids = [...e.children].map(k => { const b = k.getBoundingClientRect(); return { t: k.textContent.trim(), top: Math.round(b.top), h: Math.round(b.height), right: b.right }; });
      return { n: kids.length, lines: new Set(kids.map(k => k.top)).size, hs: kids.map(k => k.h), texts: kids.map(k => k.t), big: !!e.querySelector('.pg-st, .pg-stg, .pg-dot'), dots: e.classList.contains('pg-dots'), inCard: eb.right <= cb.right + 1 && kids.every(k => k.right <= cb.right + 1), rowH: Math.round(eb.height) }; };
    return { a: row('P011'), b: row('P012'), c: row('P013'), s: row('B018'), hs: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  const { a, b, c, s } = r;
  ok(a && a.n === 3 && a.lines === 1 && /📍/.test(a.texts[0]) && /20:00/.test(a.texts[1]) && /💰\s*12/.test(a.texts[2]), '企劃卡：地點、時間、花費三個標籤在同一排', a);
  ok(a && !a.big && !a.dots && new Set(a.hs).size === 1 && a.rowH <= a.hs[0] + 2, '花費跟其他標籤一樣高，不再被拆成大數字格', a);
  ok(b && b.n === 2 && b.lines === 1 && !b.texts.some(x => /💰/.test(x)), '沒有花費時只有地點和時間兩個標籤', b);
  ok(c && c.n === 4 && c.inCard && !c.big && /⚠️/.test(c.texts[3]), '地名很長、又走漏風聲：標籤不超出卡片（放不下才換行）', c);
  ok(s && s.n === 4 && !s.big && !s.dots && s.inCard && new Set(s.hs).size === 1 && /💰\s*35/.test(s.texts[0]) && /P012/.test(s.texts[3]) && s.lines <= (dev === 'mobile' && lang === 'zh' ? 1 : 2), '公告卡：價錢、地點、時間、對應的企劃也是一樣的小標籤（四個標籤在窄的側欄放不下才換行）', s);
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
