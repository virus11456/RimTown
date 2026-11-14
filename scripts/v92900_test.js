// v9.29.0 官網首頁重新設計(主軸:完全智能體)
// 1) 首屏:標題、3D 小鎮、決定卡會輪播;沒有 WebGL 時改放實際畫面;偏好減少動態時只畫一格、內容全部看得到
// 2) 寫的數字跟程式一致:75 個選擇點(十類)、AI 一天 10 件／一次 5 件／同類 2 件／留 2 件
// 3) 「從一個人到整個世界」:捲動帶動鏡頭,七個點可以跳
// 4) 原本的內容都還在(七章、20 個主題、城鎮四級、常見問題、路線圖、村民的大腦),並補上新功能
// 5) 文字乾淨(沒有表情符號當圖示、沒有破折號);手機不會橫向捲動;中英文都沒有頁面錯誤
// 6) 首頁的程式只在首頁載入:遊戲頁不載 landing-page.js
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/';
const ROOT = process.env.LP_ROOT || path.join(__dirname, '..', 'chrome-extension');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (browser, o = {}) => {
  const ctx = await browser.newContext(o.mobile ? { ...devices['iPhone 13'], serviceWorkers: 'block', reducedMotion: o.reduce ? 'reduce' : 'no-preference' } : { viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logged_in: false }) }));
  await page.addInitScript(({ lang, nogl }) => { localStorage.setItem('rimtown-lang', lang); if (nogl) { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; } }, { lang: o.lang || 'zh', nogl: !!o.nogl });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await page.waitForSelector('.lp-title', { timeout: 30000 });
  return { ctx, page, errs };
};
(async () => {
  const browser = await chromium.launch({ args: GL });

  // ---------- 檔案 ----------
  console.log('— 檔案');
  { const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
    const idx = rd('index.html'), town = rd('town.html'), sw = rd('sw.js'), al = rd('app-landing.js'), lp = rd('landing-page.js'), css = rd('style.css');
    ok(/landing-page\.js/.test(idx) && /landing\.css/.test(idx) && /landing-3d\.js/.test(idx), '首頁載入 landing-page.js、landing.css、landing-3d.js');
    ok(!/landing-page\.js/.test(town) && !/landing\.css/.test(town) && !/landing-3d\.js/.test(town), '遊戲頁不載首頁的程式與樣式');
    ok(/'\.\/landing-page\.js'/.test(sw) && /'\.\/landing\.css'/.test(sw), '離線快取清單有 landing-page.js 與 landing.css');
    ok(!/_renderLanding\(\) \{/.test(al) && /_openAuth\(tab\)/.test(al) && /_enterGame\(\)/.test(al), 'app-landing.js 只留顯示／隱藏、進入遊戲、登入視窗');
    ok(!/\.lp-[a-z]/.test(css), 'style.css 不再帶首頁專用的樣式');
    const em = [...lp.matchAll(/\p{Extended_Pictographic}/gu)].length, dash = [...lp.matchAll(/[—–]/g)].length;
    ok(em === 0 && dash === 0, '首頁文案沒有表情符號、沒有破折號', { em, dash });
    const kinds = fs.readdirSync(ROOT).filter(f => /^sim-decide.*\.js$/.test(f)).reduce((n, f) => n + (rd(f).match(/DECIDE\.kind\('/g) || []).length, 0);
    const titles = fs.readdirSync(ROOT).filter(f => /^sim-decide.*\.js$/.test(f)).flatMap(f => [...rd(f).matchAll(/title: *'([^']*)'/g)].map(m => m[1]));
    const sd = rd('sim-decide.js'); const num = (k) => +(sd.match(new RegExp('\\b' + k + ' = (\\d+)')) || [])[1];
    global.FACT = { kinds, titles, max: num('AI_MAX'), batch: num('BATCH'), kind: num('AI_KIND'), reserve: num('AI_RESERVE') };
    ok(kinds === 75 && titles.length === 75, '程式裡登記了 75 個選擇點', { kinds, titles: titles.length });
  }

  // ---------- 桌機・中文 ----------
  console.log('— 桌機（中文）');
  { const { ctx, page, errs } = await open(browser, { lang: 'zh' });
    const r0 = await page.evaluate(() => ({ h1: document.querySelector('.lp-title').textContent, tag: document.querySelector('.lp-tagline').textContent, cta: !!document.querySelector('#landing-register') && !!document.querySelector('#landing-login'), ph: !!document.querySelector('.lp-stage-ph .lp-dc') || !!document.querySelector('.lp-stage-canvas') }));
    ok(/每個人都自己拿主意/.test(r0.h1) && /AI 村民/.test(r0.tag) && r0.cta, '首屏標題講「每個人都自己拿主意」，有註冊與登入', r0);
    ok(r0.ph, '3D 還沒載好之前，先顯示一張決定卡');
    await page.waitForSelector('#lp-stage.lp-stage-live .lp-stage-canvas', { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#lp-stage > .lp-dc.on .lp-dc-name'), null, { timeout: 15000 });
    const d1 = await page.evaluate(() => ({ name: document.querySelector('#lp-stage > .lp-dc .lp-dc-name').textContent, opts: document.querySelectorAll('#lp-stage > .lp-dc .lp-dc-opts li').length, pick: document.querySelectorAll('#lp-stage > .lp-dc .lp-dc-opts li.pick').length, n: LANDING3D.DECISIONS.length, folks: LANDING3D.hero.impl.folks.length }));
    ok(d1.name && d1.opts >= 2 && d1.pick === 1 && d1.n >= 5 && d1.folks === 8, '3D 小鎮載入，決定卡顯示誰、有哪些選項、選了哪一個', d1);
    await page.waitForFunction((n) => { const el = document.querySelector('#lp-stage > .lp-dc.on .lp-dc-name'); return el && el.textContent !== n; }, d1.name, { timeout: 30000 });
    const d2 = await page.evaluate(() => ({ name: document.querySelector('#lp-stage > .lp-dc .lp-dc-name').textContent, tag: document.querySelector('.lp-tag').textContent, moving: LANDING3D.hero.impl.folks.some(f => Math.hypot(f.tx - f.m.position.x, f.tz - f.m.position.z) > 0.2 || f.walk > 0) }));
    ok(d2.name !== d1.name && d2.tag && d2.moving, '決定會輪播，換下一位村民；村民會走動', d2);
    // 數字跟程式一致
    const F = global.FACT;
    const k = await page.evaluate(() => ({ groups: document.querySelectorAll('.lp-kind').length, tags: [...document.querySelectorAll('.lp-kind-tags li')].map(x => x.textContent), h2: document.querySelector('#landing-kinds h2').textContent, ai: document.querySelector('#landing-ai').textContent, stat: document.querySelector('.lp-stats li b').textContent }));
    ok(k.groups === 10 && k.tags.length === F.kinds && F.titles.every(x => k.tags.includes(x)) && k.h2.includes(String(F.kinds)) && k.stat === String(F.kinds), '「自己決定的事」列出十類、75 個處境，跟程式登記的一樣', { groups: k.groups, tags: k.tags.length, miss: F.titles.filter(x => !k.tags.includes(x)).slice(0, 3) });
    ok(k.ai.includes(`最多把 ${F.max} 件事`) && k.ai.includes(`一次問 ${F.batch} 件`) && k.ai.includes(`${F.reserve} 個名額留給`) && k.ai.includes(`最多問 ${F.kind} 件`) && /沒有開關/.test(k.ai) && /金鑰只放在伺服器/.test(k.ai), 'AI 那一段的數字（10／5／2／2）跟程式一致，並寫明決策核心沒有開關', F);
    // 一個決定是怎麼來的
    const fl = await page.evaluate(async () => { const el = document.getElementById('landing'); document.querySelector('#lp-flow').scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 300)); const f = document.querySelector('#lp-flow'); const steps = [...f.querySelectorAll('.lp-step')], rows = [...f.querySelectorAll('.lp-rec-row')]; steps[3].querySelector('button').click(); const a = { on: steps.findIndex(s => s.classList.contains('on')), row: rows.findIndex(s => s.classList.contains('on')), pressed: steps[3].querySelector('button').getAttribute('aria-pressed') }; await new Promise(r => setTimeout(r, 4500)); return { ...a, stays: steps.findIndex(s => s.classList.contains('on')), n: steps.length, rows: rows.length, quote: f.querySelector('blockquote')?.textContent || '', ba: document.querySelectorAll('.lp-ba > div').length, picks: document.querySelectorAll('.lp-picks li').length }; });
    ok(fl.n === 5 && fl.rows === 5 && fl.on === 3 && fl.row === 3 && fl.pressed === 'true' && fl.stays === 3, '五個步驟對應一筆實測紀錄；點了某一步就停在那一步', fl);
    ok(/梁貝兒/.test(fl.quote) && fl.ba === 2 && fl.picks === 3, '保留「以前／現在」對照與「三個人三種選擇」', fl);
    // 從一個人到整個世界
    const sc = await page.evaluate(async () => { const steps = [...document.querySelectorAll('.lp-scale-step')], dots = [...document.querySelectorAll('[data-lp-scale]')]; steps[4].scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 2500)); const a = { on: dots.findIndex(d => d.classList.contains('on')), stepOn: steps.findIndex(s => s.classList.contains('on')), live: !!document.querySelector('#lp-scale-stage.lp-stage-live .lp-scale-canvas'), p: LANDING3D.scale?.impl?.p, cam: LANDING3D.scale?.cam?.position?.y }; dots[1].click(); for (let i = 0; i < 60 && Math.abs((LANDING3D.scale?.impl?.p ?? 9) - 1) > 0.2; i++) await new Promise(r => setTimeout(r, 400)); /* 平滑捲動在沒有顯示卡的測試機上很慢,等它到位 */ return { ...a, n: steps.length, dots: dots.length, after: dots.findIndex(d => d.classList.contains('on')), p2: LANDING3D.scale?.impl?.p, cam2: LANDING3D.scale?.cam?.position?.y, views: LANDING3D.VIEWS.length }; });
    ok(sc.n === 7 && sc.dots === 7 && sc.views === 7 && sc.live && sc.on === 4 && sc.stepOn === 4 && Math.abs(sc.p - 4) < 0.3, '捲到第五個尺度，鏡頭與右邊的點都跟上', sc);
    ok(sc.after === 1 && Math.abs(sc.p2 - 1) < 0.3 && sc.cam2 < sc.cam - 3, '點第二個點，鏡頭拉回近處', sc);
    // 原本的內容都還在
    const c = await page.evaluate(() => { const q = (s) => document.querySelectorAll(s).length; const txt = document.querySelector('#landing-features').textContent;
      const t0 = document.querySelector('#lp-people'); t0.open = true;
      return { ch: q('.lp-chapter'), topics: q('.lp-topic'), ids: ['people', 'health', 'politics', 'money', 'casino', 'shares', 'union', 'power', 'growth', 'path', 'doom', 'aftermath', 'ways', 'myth', 'aether', 'lab', 'culture', 'world', 'watch', 'god'].filter(id => !document.querySelector('#lp-' + id)), sums: q('.lp-topic-sum'), pts: q('.lp-topic .lp-points > div'), logs: q('.lp-topic .lp-log li'), tiers: q('.lp-tiers li'), reqs: q('.lp-tier-req'), bridges: q('.lp-ch-bridge'), chnav: q('.lp-chnav a'), pillars: q('.lp-pillar'), chain: q('.lp-chain li'), chainTags: q('.lp-chain-tag'), faq: q('.lp-faq details'), rmDone: document.querySelector('.lp-rm-done')?.textContent || '', rmNext: document.querySelector('.lp-rm-next')?.textContent || '', brain: q('#landing-brain .landing-step'), cards: q('#landing-brain .landing-card'), tech: !!document.querySelector('#landing-tech'), final: !!document.querySelector('.lp-final [data-lp-go="register"]'), stats: q('.lp-stats li'),
        added: ['寵物', '流行與習俗', '傳說與迷信', '鎮上在談什麼', '階層流動', '技能慢慢練', '通貨膨脹', '鎮上的新東西', '對手鎮', '世界史詩', '寫一句話，讓它發生'].filter(x => !txt.includes(x)), svg: q('.lp-topic-ic svg'), peopleOpen: !!t0.querySelector('.lp-points') && t0.querySelector('.lp-topic-body').offsetHeight > 40 }; });
    ok(c.ch === 7 && c.topics === 20 && c.ids.length === 0 && c.sums === 20 && c.bridges === 7 && c.chnav === 7, '七章、20 個主題都在，章節列可以跳', c);
    ok(c.pts >= 60 + 11 && c.logs >= 50 && c.peopleOpen && c.svg === 20, '每個主題點開有重點與「遊戲裡你會看到」的紀錄；圖示是線條圖', { pts: c.pts, logs: c.logs, svg: c.svg });
    ok(c.added.length === 0, '補上了原本沒寫的功能（寵物、流行、傳說、話題、階層流動、技能、通膨、新東西、對手鎮、世界史詩、寫一句話）', c.added);
    ok(c.tiers === 4 && c.reqs >= 9 && c.pillars === 3 && c.chain === 6 && c.chainTags === 6 && c.stats === 7, '城鎮四級、三個重點、「一件事怎麼牽動整個鎮」、規模數字都在', c);
    ok(c.faq >= 11 && /v9\.28/.test(c.rmDone) && !/擲骰繼續交給本人/.test(c.rmNext) && c.brain === 8 && c.cards >= 4 && c.tech && c.final, '常見問題、路線圖（已更新）、村民的大腦、技術細節、結尾按鈕都在', { faq: c.faq, brain: c.brain, cards: c.cards });
    // 捲到底:每一段都會顯示(不會留白)、更新紀錄會載入
    const end = await page.evaluate(async () => { const el = document.getElementById('landing'); for (let y = 0; y < el.scrollHeight; y += 600) { el.scrollTop = y; await new Promise(r => setTimeout(r, 40)); } el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 1500)); return { hidden: [...document.querySelectorAll('.lp-rv:not(.in)')].length, rv: document.querySelectorAll('.lp-rv').length, log: document.querySelectorAll('.landing-log-item').length, solid: document.querySelector('.lp-top').classList.contains('solid') }; });
    ok(end.rv > 20 && end.hidden === 0 && end.log >= 3 && end.solid, '一路捲到底，每一段都顯示出來，更新紀錄載入', end);
    // 可見文字乾淨(更新紀錄是歷史紀錄,不算)
    const clean = await page.evaluate(() => { const c = document.querySelector('.lp').cloneNode(true); c.querySelector('#landing-updates')?.remove(); const s = c.textContent; return { em: (s.match(/\p{Extended_Pictographic}/gu) || []).slice(0, 5), dash: (s.match(/[—–]/g) || []).length }; });
    ok(clean.em.length === 0 && clean.dash === 0, '頁面上的字沒有表情符號、沒有破折號（更新紀錄除外）', clean);
    // 換語言
    await page.evaluate(() => { document.getElementById('landing').scrollTop = 0; document.querySelector('.landing-lang [data-lang="en"]').click(); });
    await page.waitForFunction(() => /makes up their own mind/.test(document.querySelector('.lp-title')?.textContent || ''), null, { timeout: 10000 });
    await page.waitForSelector('#lp-stage.lp-stage-live .lp-stage-canvas', { timeout: 30000 });
    const en = await page.evaluate(() => { const c = document.querySelector('.lp').cloneNode(true); c.querySelector('#landing-updates')?.remove(); c.querySelector('.landing-lang')?.remove(); c.querySelectorAll('.lp-badges, #landing-brain').forEach(x => x.remove()); const zh = (c.textContent.match(/[一-鿿]{2,}/g) || []).filter(x => x !== '中文') /* 常見問題裡提到右上角的「中文／English」切換 */; return { zh: zh.slice(0, 6), tags: document.querySelectorAll('.lp-kind-tags li').length, canv: document.querySelectorAll('.lp-stage-canvas').length }; });
    ok(en.zh.length === 0 && en.tags === 75 && en.canv === 1, '切到英文：整頁換成英文，3D 重新掛上（只有一個畫布）', en);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }

  // ---------- 手機 ----------
  console.log('— 手機');
  for (const lang of ['zh', 'en']) {
    const { ctx, page, errs } = await open(browser, { lang, mobile: true });
    await page.waitForSelector('#lp-stage.lp-stage-live .lp-stage-canvas', { timeout: 30000 }); await page.waitForTimeout(800);
    const m = await page.evaluate(async () => { const el = document.getElementById('landing'); const out = { sw0: el.scrollWidth, cw: el.clientWidth, title: document.querySelector('.lp-title').getBoundingClientRect().bottom, stageTop: document.querySelector('#lp-stage').getBoundingClientRect().top, vh: window.innerHeight, card: getComputedStyle(document.querySelector('#lp-stage > .lp-dc')).position, cta: document.querySelector('.lp-top-cta').getBoundingClientRect().height, btn: document.querySelector('#landing-register').getBoundingClientRect().height, links: getComputedStyle(document.querySelector('.lp-top-links')).display };
      let wide = 0; for (let y = 0; y < el.scrollHeight; y += 700) { el.scrollTop = y; await new Promise(r => setTimeout(r, 30)); wide = Math.max(wide, el.scrollWidth, document.documentElement.scrollWidth); } out.wide = wide;
      const over = [...document.querySelectorAll('.lp *')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.right > el.clientWidth + 2 && !x.closest('.lp-chnav, .landing-table-wrap, .lp-scale-stage, .lp-stage') && getComputedStyle(x).position !== 'fixed'; }).slice(0, 3).map(x => x.className || x.tagName); out.over = over; return out; });
    ok(m.wide <= m.cw + 1 && m.over.length === 0, `${lang} 手機：不會橫向捲動，沒有東西超出畫面`, m);
    ok(m.title < m.stageTop + 4 && m.stageTop < m.vh && m.card !== 'absolute' && m.links === 'none', `${lang} 手機：標題在上、3D 小鎮在第一屏、決定卡放在小鎮下面`, m);
    ok(m.cta >= 40 && m.btn >= 44, `${lang} 手機：按鈕夠大好按`, { cta: m.cta, btn: m.btn });
    ok(errs.length === 0, `${lang} 手機：沒有頁面錯誤`, errs.slice(0, 3));
    await ctx.close();
  }

  // ---------- 偏好減少動態 ----------
  console.log('— 減少動態與沒有 WebGL');
  { const { ctx, page, errs } = await open(browser, { lang: 'zh', reduce: true });
    await page.waitForSelector('#lp-stage.lp-stage-live .lp-stage-canvas', { timeout: 30000 }); await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => { const f0 = LANDING3D.hero.frame; await new Promise(r => setTimeout(r, 1200)); const card = document.querySelector('#lp-stage > .lp-dc'); return { frames: LANDING3D.hero.frame - f0, card: card?.className || '', why: card ? getComputedStyle(card.querySelector('.lp-dc-why')).opacity : '', rv: document.querySelectorAll('.lp-rv:not(.in)').length, stat: document.querySelector('#landing-scale').classList.contains('is-static'), pin: getComputedStyle(document.querySelector('.lp-scale-pin')).position, flowAll: document.querySelector('#lp-flow').classList.contains('all'), rows: [...document.querySelectorAll('.lp-rec-row')].map(x => getComputedStyle(x).opacity).join(',') }; });
    ok(r.frames === 0 && /p5/.test(r.card) && r.why === '1', '偏好減少動態：3D 只畫一格，決定卡直接顯示完整內容', r);
    ok(r.rv === 0 && r.stat && r.pin !== 'sticky' && r.flowAll && !/0\.3/.test(r.rows), '偏好減少動態：不淡入、不釘住畫面，五個步驟一次都看得到', r);
    ok(errs.length === 0, '偏好減少動態：沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  { const { ctx, page, errs } = await open(browser, { lang: 'zh', nogl: true });
    await page.waitForSelector('#lp-stage.lp-stage-fallback img', { timeout: 30000 });
    const r = await page.evaluate(async () => { document.querySelectorAll('.lp-scale-step')[2].scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 2500)); return { img: document.querySelector('#lp-stage img')?.getAttribute('src') || '', scale: document.querySelector('#lp-scale-stage').className, card: getComputedStyle(document.querySelector('.lp-scale-step.on .lp-scale-card')).opacity, h1: document.querySelector('.lp-title').textContent.length }; });
    ok(/img\/landing\/proposals-zh\.jpg/.test(r.img) && /lp-stage-fallback/.test(r.scale) && +r.card > 0.9 && r.h1 > 5, '沒有 WebGL：首屏改放實際畫面，七個尺度照樣能讀', r);
    ok(errs.length === 0, '沒有 WebGL：沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }

  // ---------- 遊戲頁不受影響 ----------
  console.log('— 遊戲頁');
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, ''); const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(800);
    const g = await page.evaluate(() => ({ render: typeof window.rimtownApp._renderLanding, open: typeof window.rimtownApp._openAuth, tut: typeof window.rimtownApp.setupTutorial, l3d: typeof LANDING3D, hid: document.getElementById('landing')?.classList.contains('hidden'), css: [...document.styleSheets].some(s => /landing\.css/.test(s.href || '')) }));
    ok(g.render === 'undefined' && g.open === 'function' && g.tut === 'function' && g.l3d === 'undefined' && g.hid && !g.css, '遊戲頁照常開，沒有載入首頁的程式與樣式', g);
    ok(errs.length === 0, '遊戲頁沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
