// v9.18.0 全介面資訊改版：村民列表（一人一列＋篩選）、村民詳情（大數字＋近況／關係／能力／經歷分頁、重複紀錄合併）、
// 各分頁區塊可收合（記得住）、長串「·」拆成小格子、科技的已完成／還沒解鎖收成一行、成就篩選、已定案提案收成一行；
// 順手修的 bug：稅率提案顯示 [object Object]、地點顯示 river／town hall 代碼、日報「新村長(village chief)」、股東名字空白、設定勾選框排版
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(async (lang) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._showSeasonRecap = () => {};
    const w = app.world; w.observerMode = true; const out = {}; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const cjk = (s) => (String(s || '').match(/[一-鿿]{2,}/g) || []);
    try {
      for (let i = 0; i < 96 * 40; i++) { w.paused = false; w.tick(); }
      try { localStorage.removeItem('rimtown_pg'); } catch (e) {} app._pgS = null;
      document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await sleep(300);
      const go = async (tab, sub) => { if (sub) app._ppTab = sub; app.activeTab = tab; app.state = w.getState(); app.renderSidebar(); await sleep(120); };
      const click = (el) => { el?.click(); };
      // 村民列表
      await go('residents');
      const pop = Object.keys(w.agents).filter(id => !w.agents[id].isPlayer).length;
      out.res = { rows: document.querySelectorAll('.pg-row').length, pop: Object.keys(app.state.agents).filter(k => k !== 'player').length, chips: document.querySelectorAll('.pg-chips .pg-chip').length, avatars: document.querySelectorAll('.pg-row .pp-avatar').length, story: !!document.querySelector('#ic-res-story') };
      const workChip = document.querySelector('.pg-chip[data-val="work"], .pg-chip[data-val="sad"]');
      const want = workChip ? +(workChip.querySelector('b')?.textContent || 0) : -1; click(workChip); await sleep(120);
      out.res.filtered = { want, got: document.querySelectorAll('.pg-row').length, on: !!document.querySelector('.pg-chip.on[data-val="' + (workChip?.dataset.val) + '"]') };
      click(document.querySelector('.pg-chip[data-val="all"]')); await sleep(80);
      out.res.overflow = document.querySelector('.pg-wrap') ? document.querySelector('.pg-wrap').scrollWidth > document.querySelector('.pg-wrap').clientWidth + 2 : null;
      if (lang === 'en') out.res.leak = [...document.querySelectorAll('.pg-chip, #ic-res-story .ic-tt')].map(e => e.textContent).flatMap(cjk).slice(0, 5);
      // 村民詳情
      app.state = w.getState(); const aid = Object.keys(w.agents).find(k => !w.agents[k].isPlayer && app.state.agents[k]); const live = w.agents[aid];
      const memTxt = lang === 'en' ? 'I won the vote today.' : '今天我贏得了選舉。';
      for (let i = 0; i < 3; i++) live.memory?.add?.(w.tickCount, w.clock.timeStr, 'observation', memTxt, 5, []);
      app.selectedAgent = aid; await go('detail');
      const panel = document.querySelector('.detail-panel');
      out.dt = { tabs: [...document.querySelectorAll('.pg-tab')].map(b => b.dataset.val), kpis: document.querySelectorAll('.pg-dt-kpis .ic-kpi').length, onTab: document.querySelector('.pg-tab.on')?.dataset.val };
      const visible = () => [...panel.querySelectorAll('[data-dt]')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.dataset.dt);
      out.dt.vis0 = [...new Set(visible())];
      click(document.querySelector('.pg-tab[data-val="rel"]')); await sleep(60);
      out.dt.visRel = [...new Set(visible())];
      await go('detail'); out.dt.remember = document.querySelector('.pg-tab.on')?.dataset.val;
      click(document.querySelector('.pg-tab[data-val="now"]')); await sleep(40);
      const dupes = []; document.querySelectorAll('.detail-section').forEach(sec => { let prev = ''; sec.querySelectorAll(':scope > .memory-item').forEach(it => { const tx = (it.lastChild?.textContent || '').replace(/^\s*\d{1,2}:\d{2}\s*/, '').trim(); if (tx && tx === prev) dupes.push(tx); prev = tx; }); });
      out.dt.dupes = dupes.slice(0, 3); out.dt.merged = document.querySelectorAll('.pg-x').length;
      if (lang === 'en') out.dt.leak = [...document.querySelectorAll('.pg-tab, .pg-dt-kpis span')].map(e => e.textContent).flatMap(cjk).slice(0, 5);
      // 提案 › 鎮況:區塊收合、記得住
      await go('proposals', 'town');
      const blks = [...document.querySelectorAll('.pg-blk')];
      out.town = { n: blks.length, open: blks.filter(b => b.classList.contains('open')).length };
      const closed = blks.find(b => !b.classList.contains('open'));
      const key = closed?.dataset.pgb; click(closed?.querySelector('.pg-bh')); await sleep(40);
      out.town.opened = closed?.classList.contains('open');
      out.town.hiddenWhenClosed = (() => { const b = blks.find(x => !x.classList.contains('open')); if (!b) return null; const kid = [...b.children].find(c => !c.classList.contains('pg-bh')); return kid ? getComputedStyle(kid).display === 'none' : null; })();
      await go('proposals', 'town'); out.town.remember = !!([...document.querySelectorAll('.pg-blk')].find(b => b.dataset.pgb === key)?.classList.contains('open'));
      // 產業:長串「·」變小格子
      await go('industry'); out.dots = document.querySelectorAll('.pg-dots .pg-dot').length;
      // 科技:已完成／還沒解鎖收成一行
      await go('econ-tech');
      const folds = [...document.querySelectorAll('.pg-fold')]; const f0 = folds[0]; const k0 = f0?.dataset.val;
      const hiddenN = () => [...document.querySelectorAll('.pg-folded')].filter(n => n.dataset.fold === k0 && getComputedStyle(n).display === 'none').length;
      out.tech = { folds: folds.length, hidden0: hiddenN() }; click(f0); await sleep(40); out.tech.hidden1 = hiddenN();
      // 成就:篩選
      await go('achievements');
      out.ach = { chips: document.querySelectorAll('.achievements-panel .pg-chip').length, bars: document.querySelectorAll('.pg-achbar').length };
      click(document.querySelector('.pg-chip[data-val="on"]')); await sleep(80);
      out.ach.lockedShown = [...document.querySelectorAll('.ach-category:not(.ach-legacy) .ach-card.locked')].filter(c => getComputedStyle(c).display !== 'none').length;
      click(document.querySelector('.pg-chip[data-val="all"]')); await sleep(60);
      // 提案:已定案收成一行
      const P = w.proposals; const tax = { id: 'L999', n: 999, kind: 'tax', status: 'done', proposerId: aid, proposerName: live.name, title: lang === 'en' ? 'Tax change' : '調稅', votes: {}, why: {}, newTax: 0.08, createdDay: 1, resolvedDay: 2 };
      tax.result = CIVIC.applyTax(w, tax); P.items.push(tax);
      await go('proposals', 'props');
      const mini = document.querySelector('.pp-card.pg-mini'); out.pp = { minis: document.querySelectorAll('.pp-card.pg-mini').length, taxType: typeof tax.result, objObj: document.body.innerText.includes('[object Object]') };
      const pid = mini?.dataset.pid; click(mini?.querySelector('.pg-ppt')); await sleep(40);
      out.pp.opened = ![...document.querySelectorAll('.pp-card')].find(c => c.dataset.pid === pid)?.classList.contains('pg-mini');
      // 其他修正
      out.loc = { river: app._locationLabel('river'), hall: app._locationLabel('town_hall') };
      out.life = live.getLifestyleText(w);
      try { w.tierState = w.tierState || {}; const lv0 = w.tierState.lv; w.tierState.lv = 0; out.retitle = t('🏛️ {acting}的代理鎮長任期結束，由新鎮長{mayor}接手。'); w.tierState.lv = lv0; } catch (e) { out.retitle = 'ERR ' + e.message; }
      out.share = (() => { try { const k = Object.keys(w.market?.owners || {}).find(x => w.market.owners[x]); if (!k) return 'skip'; const M = SHARES.S(w); const real = M.shares[k]; M.shares[k] = Object.assign({}, SHARES.stakes(w, k), { ghost_xyz: 10 }); const row = SHARES.row(w, k); M.shares[k] = real; return row; } catch (e) { return 'ERR ' + e.message; } })();
      try { localStorage.setItem('rimtown_theme', 'day'); } catch (e) {} app._applyTheme(); out.theme = { day: !!document.querySelector('.theme-day'), stored: localStorage.getItem('rimtown_theme') };
      await go('settings'); out.theme.select = !!document.getElementById('settings-theme'); out.toggles = document.querySelectorAll('label.set-toggle input[type="checkbox"]').length;
      out.cbWidth = Math.max(0, ...[...document.querySelectorAll('label.set-toggle input[type="checkbox"]')].map(e => e.getBoundingClientRect().width));
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 700); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.res && r.res.rows === r.res.pop && r.res.avatars === r.res.rows && r.res.chips >= 2 && r.res.story, `${tag} 村民列表：一人一列（有頭像）、上方篩選鈕、八點檔收成一張卡`, r.res);
  ok(r.res && r.res.filtered && r.res.filtered.on && r.res.filtered.got === r.res.filtered.want, `${tag} 點篩選鈕只列符合的人，數字對得上`, r.res?.filtered);
  ok(r.res && r.res.overflow === false, `${tag} 村民列表手機寬度不會橫向捲動`, r.res?.overflow);
  ok(r.dt && r.dt.tabs.join() === 'now,rel,abl,life' && r.dt.kpis === 4 && r.dt.onTab === 'now', `${tag} 村民詳情：四個大數字、近況／關係／能力／經歷四個分頁`, r.dt);
  ok(r.dt && r.dt.vis0.join() === 'now' && r.dt.visRel.join() === 'rel' && r.dt.remember === 'rel', `${tag} 切分頁只顯示那一類，重畫後記得在哪一頁`, r.dt);
  ok(r.dt && !r.dt.dupes.length && r.dt.merged >= 1, `${tag} 重複的紀錄合併成「×N」`, { dupes: r.dt?.dupes, merged: r.dt?.merged });
  ok(r.town && r.town.n >= 4 && r.town.open < r.town.n && r.town.opened && r.town.hiddenWhenClosed && r.town.remember, `${tag} 鎮況每一區可以收合、收起只剩標題、重畫後記得`, r.town);
  ok(r.dots > 3, `${tag} 產業頁的長串「·」拆成小格子`, r.dots);
  ok(r.tech && r.tech.folds >= 1 && r.tech.hidden0 >= 2 && r.tech.hidden1 === 0, `${tag} 科技：已完成／還沒解鎖收成一行，點開才看`, r.tech);
  ok(r.ach && r.ach.chips === 3 && r.ach.bars >= 3 && r.ach.lockedShown === 0, `${tag} 成就：全部／已達成／還沒達成篩選＋每類進度條`, r.ach);
  ok(r.pp && r.pp.minis >= 1 && r.pp.opened, `${tag} 已定案的提案收成一行，點「看全文」展開`, r.pp);
  ok(r.pp && r.pp.taxType === 'string' && !r.pp.objObj, `${tag} 稅率提案的結果不再顯示 [object Object]`, r.pp);
  ok(r.loc && r.loc.river !== 'river' && !/town hall|town_hall/.test(r.loc.hall) && !/\btown hall\b/.test(r.life || ''), `${tag} 地點不再顯示 river、town hall 這種代碼`, { loc: r.loc, life: r.life });
  ok(typeof r.retitle === 'string' && r.retitle.includes('{mayor}') && !/village chief\)/i.test(r.retitle), `${tag} 稱號替換不會把 {mayor} 占位符換掉`, r.retitle);
  ok(r.share === 'skip' || (typeof r.share === 'string' && !/^\s*\d|・\s*\d|·\s*\d/.test(r.share)), `${tag} 股東名單不會出現沒有名字的一格`, r.share);
  ok(r.toggles >= 3 && r.cbWidth > 0 && r.cbWidth <= 24, `${tag} 設定的勾選框是小方框（不再撐滿半行）`, { n: r.toggles, w: r.cbWidth });
  ok(r.theme && !r.theme.day && !r.theme.stored && !r.theme.select, `${tag} 白底版本拿掉了：只有一套配色，設定沒有配色選項，舊的設定值清掉`, r.theme);
  if (lang === 'en') ok(r.res && !r.res.leak.length && r.dt && !r.dt.leak.length, `${tag} 英文介面的新按鈕沒有中文`, { res: r.res?.leak, dt: r.dt?.leak });
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
