// v9.19.1 產業頁改成資訊卡＋科技頁底部（支持與反對、發明名人堂）
// 以前：「產業與老闆」一長串字被拆成沒有說明的數字格；農田掉在卡片外面；工廠配方是空的；革新派／保守派是一整面名字
// 現在：一件事一張資訊卡，每個數字都有說明，細項收進「展開詳細」；資料一項不少
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [lang, W, H] of [['zh', 390, 844], ['en', 390, 844], ['zh', 1280, 860]]) {
    console.log(`${lang} ${W}px`); const zh = lang === 'zh'; const mob = W < 700;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    // 一座有產業、工廠、農場、銀行、發明的城鎮
    const want = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
      const st = document.createElement('style'); st.textContent = '#season-recap{display:none!important}'; document.head.appendChild(st);
      w.rosterMode = 'scripted'; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 101 }); app.state = w.getState(); app._generateTileMapLayout?.(); app._syncHousing?.();
      for (let i = 0; i < 96 * 9; i++) { w.paused = false; w.tick(); } w.paused = true;
      const A = Object.values(w.agents).filter(a => !a.isPlayer); const ids = A.map(a => a.agentId), names = A.map(a => a.name);
      const IS = w.ideaSystem; const techs = Object.keys(w.research?.projects || {}); IS.inventions = IS.inventions || [];
      for (let i = 0; i < 11; i++) IS.inventions.push({ by: names[i * 3 % names.length], thing: ['輪作法', '哨笛', '星盤', '算盤', '新式犁', '風箱'][i % 6], tech: techs[i % techs.length], disputedBy: i === 2 ? names[5] : null });
      const I = w.industry; I.maxIndustries = 5; for (const k of ['farming', 'lumber']) if (!I.industries[k]) I.industries[k] = { key: k, level: 1, workers: ids.slice(0, 2), dailyOutput: k === 'farming' ? { food: 6.4 } : { wood: 3 } }; I._updateSynergies?.();
      w.farm.dailyUpdate(w); const crops = Object.keys(CROPS); w.farm.plots.forEach((pl, i) => { if (i === 2) return; pl.state = i === 3 ? 'ready' : 'growing'; pl.crop = crops[i % crops.length]; pl.growthProgress = 37; pl.waterLevel = i === 1 ? 12 : 76; pl.fertilized = i === 0; });
      w.farm.harvestLog = [1, 2, 3].map(i => ({ cropName: '玉米', amount: 10 + i, quality: '普通', season: '夏季', day: i }));
      const P = w.processing; P.builtFactories = { brewery: { key: 'brewery', status: 'active', buildProgress: 4, buildRequired: 4, recipe: 'beer', productionProgress: 1, workers: [ids[4]], warehouse: { beer: 12 } }, bakery: { key: 'bakery', status: 'building', buildProgress: 2, buildRequired: 5, recipe: null, productionProgress: 0, workers: [], warehouse: {} } };
      P.orders = [{ id: 'o1', description: 'ORDER-X', reward: 120, daysLeft: 3, status: 'active' }];
      w.market.hungry = { [ids[7]]: 2 }; // 一個人今天沒飯吃 → 上面要有提醒
      app.state = w.getState();
      const fx = IS.factions(w); const T = (x) => (typeof t === 'function' ? t(x) : x);
      return { firms: MARKET.view(w).map(r => r.name), plots: w.farm.plots.length, gini: String(MARKET.gini(w)), inv: IS.inventions.length, fx: { p: fx.progressive.length, m: fx.moderate.length, c: fx.conservative.length, names: fx.progressive.concat(fx.conservative).map(T) },
        inds: Object.keys(I.industries).map(k => INDUSTRIES[k].name), banker: (typeof BANK !== 'undefined' && w.bank) ? BANK.view(w).banker : null, worker: T(w.agents[ids[4]].name), recipe: FACTORIES.brewery.recipes[0].label };
    });
    const open = async (tab) => { await page.evaluate((tab) => { const app = window.rimtownApp; app.state = app.world.getState(); app._openKairoTab ? app._openKairoTab(tab) : (app.activeTab = tab, app.renderSidebar()); }, tab); await page.waitForTimeout(500); };
    // ---------- 產業頁 ----------
    await open('industry');
    const r = await page.evaluate(() => {
      const root = document.querySelector('.pg-ind'); if (!root) return { none: true, html: (document.getElementById('sidebar-content')?.innerHTML || '').slice(0, 200) };
      const sc = document.getElementById('sidebar-content');
      const vis = (e) => !!e.offsetParent; const q = (s) => [...root.querySelectorAll(s)];
      const farm = document.getElementById('ic-ind-farm');
      const out = { ids: q('.ic-card').map(c => c.id), legacy: sc.querySelectorAll('.econ-section, .pg-dots, .pg-st').length, brief: !!root.querySelector('.ic-brief .ic-brief-row'),
        firms: q('.market-row').length, firmNums: q('.market-row').map(x => [...x.querySelectorAll('.pg-nums > span')].map(s => [s.querySelector('b')?.textContent.trim(), s.querySelector('i')?.textContent.trim()])),
        bare: q('.pg-nums > span, .ic-kpi, .ic-grid > .ic-g').filter(x => !(x.querySelector('i, span')?.textContent || '').trim()).length,
        plotsIn: farm ? farm.querySelectorAll('.pg-plot').length : -1, plotsOut: sc.querySelectorAll('.pg-plot').length - (farm ? farm.querySelectorAll('.pg-plot').length : 0),
        bars: farm ? farm.querySelectorAll('.pg-plot .ic-bar').length : 0, lowWater: farm ? farm.querySelectorAll('.pg-water.low').length : 0, farmAlert: !!farm?.querySelector('.ic-alert'),
        recipeOn: (root.querySelector('#ic-ind-fac .pg-on')?.textContent || '').trim(), facText: document.getElementById('ic-ind-fac')?.textContent || '', building: !!root.querySelector('#ic-ind-fac .pg-fac2 .ic-bar'),
        all: root.textContent, lifeText: document.getElementById('ic-ind-life')?.textContent || '' };
      // 農場收起來以後,農田要跟著收起來(以前掉在卡片外面,收不掉)
      const hd = farm?.querySelector('.ic-hd'); if (farm && !farm.classList.contains('open')) hd.click(); out.plotsShown = farm ? [...farm.querySelectorAll('.pg-plot')].filter(vis).length : -1; hd?.click(); out.plotsHidden = farm ? [...farm.querySelectorAll('.pg-plot')].filter(vis).length : -1;
      // 全部展開以後量有沒有東西超出去
      root.querySelectorAll('.ic-card:not(.open) .ic-hd').forEach(h => h.click()); root.querySelectorAll('.ic-card:not(.more) .ic-more').forEach(h => h.click());
      const rr = root.getBoundingClientRect();
      out.over = q('.pg-firm, .ic-kpi, .ic-g, .ic-pill, .ic-row, .pg-nums, .pg-stage, .ic-chip').filter(vis).filter(e => { const b = e.getBoundingClientRect(); return b.right > rr.right + 1 || b.left < rr.left - 1; }).map(e => e.className).slice(0, 5);
      out.small = q('i, span, b, small, div').filter(vis).filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => e.className || e.tagName).slice(0, 5);
      out.hscroll = document.documentElement.scrollWidth > innerWidth + 1 || sc.scrollWidth > sc.clientWidth + 1;
      out.cjk = (root.innerText.match(/[一-鿿]{2,}/g) || []).slice(0, 8); out.undef = /undefined|NaN|\{[a-z]+\}|\[object/.test(root.innerText);
      return out;
    });
    if (r.none) { ok(false, '產業頁有畫出資訊卡', r.html); await ctx.close(); continue; }
    ok(['ic-ind-biz', 'ic-ind-fac', 'ic-ind-base', 'ic-ind-farm', 'ic-ind-life'].every(id => r.ids.includes(id)), '產業頁是一張一張的資訊卡（產業與老闆、工廠、基礎產業、農場、貧富與住房…）', r.ids);
    ok(r.legacy === 0, '沒有舊式的區塊，也沒有被自動拆開、沒標題的數字格', r.legacy);
    ok(r.firms === want.firms.length && r.firmNums.every(n => n.length === 4 && n.every(x => x[0] !== '' && x[1])), '每家產業一格，四個數字都有說明（人數／工資水準／七天營收／七天薪水）', r.firmNums[0]);
    ok(r.bare === 0, '整頁沒有不帶說明的數字', r.bare);
    ok(want.firms.every(n => r.all.includes(n)) && want.inds.every(n => r.all.includes(n)), '每家產業、每個基礎產業的名字都在', null);
    ok(r.plotsIn === want.plots && r.plotsOut === 0, '農田全部在「農場」卡片裡面（以前掉在外面）', { in: r.plotsIn, out: r.plotsOut, want: want.plots });
    ok(r.plotsShown === want.plots && r.plotsHidden === 0, '收起農場，農田跟著收起來', { shown: r.plotsShown, hidden: r.plotsHidden });
    ok(r.bars >= 2 && r.lowWater === 1 && r.farmAlert, '農田有進度條與水分條；快沒水的田標紅、卡片上有提醒', { bars: r.bars, low: r.lowWater, alert: r.farmAlert });
    ok(r.recipeOn.includes(want.recipe) && r.facText.includes(want.worker) && r.facText.includes('ORDER-X') && r.building, '工廠：看得到現在用哪個配方（以前是空的）、工人、訂單，建造中的有進度條', { on: r.recipeOn, want: want.recipe });
    ok(r.lifeText.includes(want.gini) && (zh ? /吉尼/.test(r.lifeText) && /無家可歸/.test(r.lifeText) && /房東/.test(r.lifeText) : /Gini/.test(r.lifeText) && /Homeless/i.test(r.lifeText) && /Landlords/.test(r.lifeText)), '貧富與住房：吉尼係數、沒飯吃、無家可歸、房屋數字', r.lifeText.slice(0, 120));
    ok(r.brief, '有人沒飯吃時，最上面有「今天要注意」', r.brief);
    if (want.banker) ok(r.all.includes(want.banker), '銀行卡片有銀行家', want.banker);
    ok(r.all.includes('×11') && r.all.includes('×13'), '收穫紀錄都在（收在「展開詳細」）', null);
    ok(r.over.length === 0 && !r.hscroll, '全部展開後沒有東西超出畫面、沒有橫向捲動', { over: r.over, h: r.hscroll });
    ok(r.small.length === 0, '字不小於 11px', r.small);
    ok(!r.undef, '沒有 undefined／NaN／沒代換的 {x}', null);
    if (!zh) ok(r.cjk.length === 0, '英文版沒有殘留中文', r.cjk);
    // ---------- 科技頁底部 ----------
    await open('econ-tech');
    const tc = await page.evaluate(() => {
      const fx = document.getElementById('ic-tc-fx'), inv = document.getElementById('ic-tc-inv'); if (!fx || !inv) return { none: true };
      const sc = document.getElementById('sidebar-content');
      const kp = [...fx.querySelectorAll('.ic-kpi b')].map(b => parseInt(b.textContent, 10));
      const out = { kp, split: fx.querySelectorAll('.pg-split i').length, fxText: fx.textContent, invN: inv.querySelectorAll('.pg-inv').length, legacy: [...sc.querySelectorAll('.tech-era-head')].filter(h => /支持與反對|名人堂|For and against|Hall of/.test(h.textContent)).length,
        bodyPills: fx.querySelectorAll('.ic-body .ic-pill').length, defOpen: fx.classList.contains('open') };
      [fx, inv].forEach(c => { if (!c.classList.contains('open')) c.querySelector('.ic-hd').click(); c.querySelector('.ic-more')?.click(); });
      const rr = sc.getBoundingClientRect(); out.over = [...fx.querySelectorAll('.ic-pill, .ic-kpi'), ...inv.querySelectorAll('.pg-firm, .ic-pill')].filter(e => e.offsetParent).filter(e => { const b = e.getBoundingClientRect(); return b.right > rr.right + 1; }).length;
      out.cjk = ((fx.innerText + inv.innerText).match(/[一-鿿]{2,}/g) || []).slice(0, 6);
      return out;
    });
    ok(!tc.none && tc.legacy === 0, '科技頁：支持與反對、發明名人堂改成資訊卡（不再是一整段字）', tc);
    if (!tc.none) {
      ok(tc.kp[0] === want.fx.p && tc.kp[1] === want.fx.m && tc.kp[2] === want.fx.c && tc.split === 3, '三派人數是大數字，上面有比例條', { kp: tc.kp, want: want.fx });
      ok(want.fx.names.every(n => tc.fxText.includes(n)), '革新派、保守派每個人的名字都還在（多的收在「展開詳細」）', null);
      ok(tc.bodyPills <= 18, '卡片上只先列前幾位，不會一整面名字', tc.bodyPills);
      ok(tc.invN === want.inv, '發明名人堂每一項都在（以前只看得到最近 8 項）', { n: tc.invN, want: want.inv });
      ok(tc.over === 0, '沒有東西超出畫面', tc.over);
      if (!zh) ok(tc.cjk.length === 0, '英文版沒有殘留中文', tc.cjk);
    }
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
