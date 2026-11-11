// v7.3.0 面板統一與整合:所有分頁用提案分頁的膠囊子分頁＋一行說明、小鎮只剩一層子分頁(概況／物資／建設／產業)、
// 舊「事件」拆開(天氣節慶→概況、新聞事件→日報消息、AI 日報→日報、出生墓園→年表)、鎮況只留政治民生(急事最上面)、
// 本鎮公告不再露出 undefined／REMOTE／英文副標、外地消息不重複、手機面板開著時角落通知不蓋分頁(中英、桌機與 390px)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    await page.evaluate(async () => { const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showModal = () => {};
      const d0 = w._absDay(); for (let i = 0; i < 96 * 32; i++) { w.paused = false; try { w.tick(); } catch (e) {} if (w._absDay() - d0 >= 30) break; if (i % 960 === 0) await new Promise(r => setTimeout(r, 0)); }
      w.paused = true; document.getElementById('season-recap')?.remove();
      // 放一則外地公告和一則缺欄位的本鎮公告,確認畫面不會露出 undefined／REMOTE
      w.news?.bulletins?.push?.({ headline: '測試外地新聞', headline_en: 'Remote test', category: 'remote', severity: 'info', days_remaining: 2 }, { headline: '測試本鎮公告', headline_en: 'Local test', category: 'political', severity: 'good', days_remaining: 3 });
      app.state = w.getState(); });
    const open = async (tab) => { await page.evaluate((tab) => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab(tab); else { const main = app._mobileSubToMain?.[tab] || tab; document.querySelector(`.rt-sidebar-tabs > button[data-tab="${main}"]`)?.click(); app.activeTab = tab; app.renderSidebar(); } }, tab); await page.waitForTimeout(350); };
    const body = () => page.evaluate(() => { const c = window.innerWidth <= 768 ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content'); return { html: c.innerHTML, text: c.textContent, /* v9.18.0 區塊可收合,收起的內容 innerText 看不到 */ bars: c.querySelectorAll('.sub-tab-bar').length, tabs: [...c.querySelectorAll('.sub-tab-bar.pp-tabs .pp-tab')].map(b => b.textContent.trim()), on: c.querySelector('.sub-tab-bar.pp-tabs .pp-tab.on')?.textContent.trim() || '', hint: c.querySelector('.pp-tabhint')?.textContent.trim() || '', radius: (() => { const s = c.querySelector('.econ-section, .news-section, .pp-issues, .ic-card'); return s ? getComputedStyle(s).borderRadius : ''; /* v9.17.0 概況改成資訊卡 */ })() }; });
    const cjk = (s) => (s.match(/[一-鿿]{2,}/g) || []);
    // 1) 小鎮:一層子分頁、膠囊樣式、說明、概況有天氣與繁榮度
    await open('economy'); let b = await body();
    ok(b.tabs.length === 5 && b.bars === 1 && b.hint && ['12px', '14px'].includes(b.radius), '小鎮只剩一層子分頁（概況／物資／建設／科技／產業；v7.8.0 科技從建設分出來），跟提案分頁同款膠囊＋說明＋圓角卡片', { tabs: b.tabs, bars: b.bars, hint: b.hint, r: b.radius });
    ok((/weather-section/.test(b.html) || /ic-env/.test(b.html)) && (/econ-section/.test(b.html) || /ic-pros/.test(b.html)), '概況有天氣（從舊事件分頁搬來）與繁榮度', null);
    if (lang === 'en') ok(!cjk(b.tabs.join(' ') + b.hint).length, '英文子分頁與說明沒有中文', b.tabs);
    await open('econ-goods'); b = await body(); ok(b.on.includes(lang === 'en' ? 'Goods' : '物資') && /原料倉庫|Raw materials|📦/.test(b.text), '物資頁：倉庫、加工、交易、商店', b.on);
    await open('econ-build'); b = await body(); ok(/🔬/.test(b.text) && b.bars === 1, '建設頁：建築與研究（不再有第二層分頁）', b.bars);
    await open('industry'); b = await body(); ok(/market-section/.test(b.html) && /pp-bank/.test(b.html), '產業頁：產業與老闆、店、銀行、產業等級與農場', null);
    // 2) 日報:四個子分頁;日報有 AI 日報摺疊;消息有本鎮公告與外地消息,不露出 undefined／REMOTE
    await open('records'); b = await body();
    ok(b.tabs.length === 4 && b.hint, '日報分頁：日報／消息／年表／成就', b.tabs);
    await open('news'); b = await body();
    ok(/測試本鎮公告|Local test/.test(b.text) && !/測試外地新聞|Remote test/.test(b.text) && !/undefined|REMOTE/.test(b.text), '消息：本鎮公告只列本鎮的、不露出 undefined 與 REMOTE（外地的走外地消息）', b.text.slice(0, 200));
    ok(/pp-tidings/.test(b.html), '消息：外地消息、外交、報社從鎮況搬來', null);
    if (lang === 'zh') ok(!/Local test/.test(b.text), '中文不再顯示英文副標', null);
    await open('events'); b = await body(); ok(/pp-tidings|本鎮公告|Town notices/.test(b.html), '舊「事件」分頁鍵會打開消息', null);
    await open('quest'); await page.waitForTimeout(400); b = await body(); ok(/econ-section/.test(b.html) && b.on.includes(lang === 'en' ? 'Timeline' : '年表') || /📚/.test(b.text), '年表：季回顧、鎮史文化珍品、出生墓園、編年史', b.on);
    // 3) 鎮況:急事最上面;鎮史／文化／珍品／店／銀行／報社／外交／外地消息不在這裡
    await page.evaluate(() => { window.rimtownApp._ppTab = 'town'; }); await open('proposals'); b = await body();
    const moved = ['pp-legacy', 'pp-culture', 'pp-goods', 'pp-biz', 'pp-bank', 'pp-press', 'pp-diplo', 'pp-tidings'].filter(k => b.html.includes(k));
    ok(!moved.length, '鎮況只留政治與民生（鎮史文化珍品→年表、店銀行→產業、報社外交外地消息→消息）', moved);
    const order = await page.evaluate(() => { const c = window.innerWidth <= 768 ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content'); const h = [...c.querySelectorAll('.proposals-panel > .pp-issues')]; return h.length ? h[0].className : ''; });
    ok(!order || !/pp-tier/.test(order) || !(await page.evaluate(() => (window.rimtownApp.state.proposals?.issues || []).length)), '鎮上有急事時排在最上面', order);
    await page.evaluate(() => { window.rimtownApp._ppTab = 'props'; });
    // 4) 手機:面板開著時角落通知先排隊,不蓋住分頁
    if (mob) {
      const r = await page.evaluate(() => { const app = window.rimtownApp; app._openKairoTab('economy'); const host = app._toastHost(); const before = host.querySelectorAll('.rt-toast:not(.morning)').length; app._showCornerNotice({ icon: '🔔', title: 'x', name: 'y', desc: 'z' }); return { before, after: host.querySelectorAll('.rt-toast:not(.morning)').length }; });
      ok(r.after === r.before, '手機面板開著時角落通知不會蓋在分頁上', r);
    }
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
