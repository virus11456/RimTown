// v8.8.0 漸進解鎖：一開始只看得到基本分頁，隨著天數、時代與小鎮發生的事慢慢解鎖，解鎖時角落跳提示
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`);
  const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.removeItem('rimtown_ui_all'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const out = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const SEAS = ['春季', '夏季', '秋季', '冬季'];
    const setDay = (n) => { const si = Math.floor((n - 1) / 15); w.clock.year = 1 + Math.floor(si / 4); w.clock.season = SEAS[si % 4]; w.clock.day = n - si * 15; };
    const notes = []; const _cn = app._showCornerNotice; app._showCornerNotice = function (o) { notes.push(o); };
    const subTabs = async (tab) => { if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await sleep(150); return [...document.querySelectorAll('#sidebar-content .sub-tab-bar [data-val]')].map(b => b.dataset.val); };
    // 開局:清乾淨,第 1 天、沒有建設、沒打過牌
    w.uiUnlock = null; app._uiLastDay = null; setDay(1); w.buildings.projects = []; if (w.eventCards) { w.eventCards.stats.played = 0; w.eventCards.played = []; }
    if (w.calamity) { w.calamity.cur = null; w.calamity.hist = []; } if (w.worldcal) { w.worldcal.cur = null; w.worldcal.hist = []; }
    app._uiCheck(); out.d1 = Object.keys(w.uiUnlock).filter(k => !k.startsWith('__'));
    out.townTabs = await subTabs('economy'); out.resTabs = await subTabs('residents');
    app.activeTab = 'proposals'; app._ppTab = 'props'; app.renderSidebar(); await sleep(150);
    out.ppTabs = [...document.querySelectorAll('#sidebar-content .proposals-panel .pp-tabs button')].map(b => b.dataset.val || b.getAttribute('data-pp') || b.textContent.trim());
    out.notes1 = notes.length;
    // 一天一天往前:記錄每個分頁在第幾天解鎖
    const at = {}; for (let d = 2; d <= 29; d++) { setDay(d); const before = new Set(Object.keys(w.uiUnlock)); app._uiCheck(); for (const k of Object.keys(w.uiUnlock)) if (!before.has(k)) at[k] = d; }
    out.at = at; out.notes = notes.map(n => ({ t: n.title, n: n.name, d: n.desc }));
    out.townTabs2 = await subTabs('economy'); out.resTabs2 = await subTabs('residents');
    app.activeTab = 'proposals'; app.renderSidebar(); await sleep(150);
    out.ppTabs2 = document.querySelectorAll('#sidebar-content .proposals-panel .pp-tabs button').length;
    out.trackBefore = w.uiUnlock['gh-track'];
    // 打出第一張牌 → 反應追蹤
    w.eventCards.stats.played = 1; app._uiLastDay = null; const n0 = notes.length; app._uiCheck(); out.track = w.uiUnlock['gh-track']; out.trackNote = notes.slice(n0).map(n => n.name);
    // 同一天再叫一次不會重複跳
    const n1 = notes.length; app._uiCheck(); app.renderSidebar(); out.dup = notes.length - n1;
    // 科技提早解鎖:完成一項研究(開局之後)
    w.uiUnlock = null; app._uiLastDay = null; setDay(1); app._uiCheck(); const R = w.research; const av = R.getAvailable?.() || []; if (av[0]) { R.projects[av[0].key].status = 'complete'; }
    app._uiLastDay = null; app._uiCheck(); out.techEarly = w.uiUnlock['econ-tech']; if (av[0]) R.projects[av[0].key].status = 'available';
    // 存檔 / 重設
    const ser = w.serialize(); out.serKeep = !!(ser.uiUnlock && ser.uiUnlock['econ-tech'] != null);
    // 舊存檔(第 35 天、沒有 uiUnlock):全部打開、不跳提示
    w.uiUnlock = null; app._uiLastDay = null; setDay(35); const n2 = notes.length; app._uiCheck(); out.old = { all: (window.UI_UNLOCKS || []).every(u => w.uiUnlock[u.key] != null), notes: notes.length - n2 };
    // 熟手開關:全部看得到
    w.uiUnlock = null; app._uiLastDay = null; setDay(1); app._uiCheck(); localStorage.setItem('rimtown_ui_all', '1'); out.allOn = (window.UI_UNLOCKS || []).every(u => app._uiOn(u.key)); out.allTabs = await subTabs('economy');
    localStorage.removeItem('rimtown_ui_all');
    // 設定頁:開關＋還沒解鎖清單
    if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab('settings'); else { app.activeTab = 'settings'; app.renderSidebar(); } await sleep(150);
    const cb = document.getElementById('settings-uiall'); out.cb = !!cb; out.cbText = cb ? cb.closest('.setting-group').textContent.replace(/\s+/g, ' ').trim() : '';
    // 點下開關後分頁立刻出現
    if (cb) { cb.click(); await sleep(150); } out.cbSet = localStorage.getItem('rimtown_ui_all'); out.afterCb = await subTabs('economy'); localStorage.removeItem('rimtown_ui_all');
    // 目前所在分頁沒解鎖也要顯示(例如從別處直接跳過去)
    out.curShown = (await subTabs('industry')).includes('industry');
    // 觀察者模式關掉(舊玩法)時全部看得到
    const om = app.observerMode; app.observerMode = false; out.nonObs = app._uiOn('industry'); app.observerMode = om;
    w.reset?.call && false; // 不真的重設世界
    app._showCornerNotice = _cn;
    // 真的跳一次角落提示(畫面上看得到)
    w.uiUnlock = null; app._uiLastDay = null; setDay(1); app._uiCheck(); setDay(2); app._uiCheck(); await sleep(300);
    out.cornerDom = [...document.querySelectorAll('.rt-toast')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).concat((app._cornerHold || []).map(o => o.title + ' (queued)')).filter(x => /解鎖|unlock/i.test(x)).slice(0, 2);
    return out;
  });
  const T = (zh, en) => lang === 'en' ? en : zh;
  ok(r.d1.length === 0, '第 1 天什麼都還沒解鎖', r.d1);
  ok(r.townTabs.includes('economy') && r.townTabs.includes('econ-goods') && !r.townTabs.includes('econ-tech') && !r.townTabs.includes('industry') && !r.townTabs.includes('econ-build'), '小鎮分頁一開始只有概況、物資', r.townTabs);
  ok(r.resTabs.includes('residents') && r.resTabs.includes('chat') && !r.resTabs.includes('relmap'), '村民分頁一開始只有村民、聊天', r.resTabs);
  ok(r.ppTabs.length === 1, '提案頁一開始只有「提案」，沒有鎮況和真相', r.ppTabs);
  ok(r.notes1 === 0, '開局不跳解鎖提示', r.notes1);
  const a = r.at; const exp = { 'econ-build': 2, 'econ-tech': 4, relmap: 6, 'pp-town': 8, 'pp-truth': 15, industry: 20, 'gh-lab': 28 };
  for (const [k, d] of Object.entries(exp)) ok(a[k] === d, `${k} 在第 ${d} 天解鎖`, a[k]);
  ok(!('gh-track' in a), '沒打過牌，反應追蹤不會只因為時間到就解鎖', a['gh-track']);
  ok(r.notes.length === 7 && r.notes.every(n => n.t === T('解鎖了新分頁', 'New tab unlocked') && n.d && n.n), '每次解鎖都跳一則角落提示（標題、分頁名、說明）', r.notes.slice(0, 2));
  if (lang === 'en') ok(r.notes.every(n => !/[一-鿿]/.test(n.d + n.n)), '英文版的解鎖提示沒有中文', r.notes.filter(n => /[一-鿿]/.test(n.d + n.n)));
  ok(['econ-build', 'econ-tech', 'industry'].every(k => r.townTabs2.includes(k)) && r.resTabs2.includes('relmap'), '解鎖後分頁出現在分頁列', { t: r.townTabs2, r: r.resTabs2 });
  ok(r.ppTabs2 === 3, '解鎖後提案頁有提案、鎮況、真相三個子分頁', r.ppTabs2);
  ok(r.trackBefore == null && r.track != null && r.trackNote.length === 1, '打出第一張牌後解鎖反應追蹤，跳一次提示', { b: r.trackBefore, a: r.track, n: r.trackNote });
  ok(r.dup === 0, '同一天不會重複跳提示', r.dup);
  ok(r.techEarly === 1, '第 1 天就完成研究 → 科技分頁提早解鎖', r.techEarly);
  ok(r.serKeep, '存檔會帶著解鎖狀態', r.serKeep);
  ok(r.old.all && r.old.notes === 0, '玩超過 30 天的舊存檔直接全部打開、不跳提示', r.old);
  ok(r.allOn && r.allTabs.includes('industry') && r.allTabs.includes('econ-tech'), '勾「一開始就顯示全部功能」→ 全部看得到', r.allTabs);
  ok(r.cb && r.cbText.includes(T('還沒解鎖', 'Not yet unlocked')), '設定頁有開關，並列出還沒解鎖的分頁', r.cbText.slice(0, 160));
  ok(r.cbSet === '1' && r.afterCb.includes('industry'), '在設定頁勾開關，分頁立刻出現', { s: r.cbSet, t: r.afterCb });
  ok(r.curShown, '目前所在的分頁就算還沒解鎖也照樣顯示', r.curShown);
  ok(r.nonObs, '非觀察者模式不鎖分頁', r.nonObs);
  ok(r.cornerDom.length >= 1, '畫面上真的出現「解鎖了新分頁」角落卡', r.cornerDom);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 800 });
  await run(browser, 'en', { width: 390, height: 844 });
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
