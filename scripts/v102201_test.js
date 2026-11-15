// v10.2.2 本機放不下存檔時，安靜地換地方放（不再跳「本機空間不足」）
// 背景：每次存檔都存兩份，一份上雲端，一份留在這台裝置（下次開頁比較快、斷線時也還在）。
// 裝置上那份先試 localStorage（上限約 5MB），放不下改放 IndexedDB。大鎮的存檔本來就超過 5MB，
// 所以每次開頁都會跳一次「本機空間不足」，可是存檔完整、雲端照存、玩家什麼都不用做。
// 1) 放不進 localStorage：整份改放 IndexedDB、讀得回來，不跳通知
// 2) 改放的時候不把存檔再轉一次文字（存檔流程已經轉好了）
// 3) 之後的存檔差不多大：直接放 IndexedDB，不再先試一次注定失敗的 localStorage
// 4) 存檔明顯變小：會再試 localStorage
// 5) IndexedDB 也放不下、瘦身後還是放不下：才跳「只存雲端」的通知（照舊）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._showSeasonRecap = () => {}; app._gameAlert = () => {};
    const w = app.world; const out = {}; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const tid = app.currentTownId; const key = 'rimtown_town_' + tid;
    const notices = []; app._showCornerNotice = (o) => { notices.push(o?.title || ''); };
    // 假裝 localStorage 滿了：這座鎮的整份存檔一律寫不進去
    const orig = Storage.prototype.setItem; let lsTries = 0;
    Storage.prototype.setItem = function (k, v) { if (String(k) === key && String(v).length > 2000) { lsTries++; const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return orig.apply(this, arguments); };
    const _js = JSON.stringify; let bigStr = 0; JSON.stringify = function () { const s = _js.apply(this, arguments); if (typeof s === 'string' && s.length > 20000) bigStr++; return s; };
    const save = async () => { const data = w.serialize(); const str = _js(data); lsTries = 0; bigStr = 0; app._saveCurrentTown(undefined, data, str); await sleep(700); return { lsTries, bigStr, len: str.length, tick: data.tickCount }; };
    try {
      const a = await save(); const idb1 = await RTStore.get(tid); const back1 = await app._readLocalTown(tid);
      out.first = { ...a, idb: !!idb1, same: !!idb1 && idb1.length === a.len, lsGone: !localStorage.getItem(key), back: back1?.tickCount === a.tick, notices: notices.slice() };
      w.tickCount += 40; const b = await save(); const back2 = await app._readLocalTown(tid);
      out.second = { ...b, back: back2?.tickCount === b.tick, notices: notices.slice() };
      // 存檔明顯變小（少了一成以上）：再試一次 localStorage
      const big = app._lsTooBig; app._lsTooBig = { tid, len: Math.round(b.len * 1.2) }; const c = await save(); out.shrunk = { ...c, hadFlag: !!big };
      // IndexedDB 也不行、瘦身後還是寫不進去：只存雲端，這時才通知
      const _set = RTStore.set; RTStore.set = async () => undefined; app._lsTooBig = null; notices.length = 0; const d = await save(); RTStore.set = _set; out.cloudOnly = { notices: notices.slice(), flag: app._lsTooBig };
    } finally { Storage.prototype.setItem = orig; JSON.stringify = _js; }
    // 空間恢復後照常寫進 localStorage
    app._lsTooBig = null; app._saveCurrentTown(); await sleep(300); out.normal = { inLs: !!localStorage.getItem(key), idbGone: !(await RTStore.get(tid)) };
    return out;
  });
  const { first: a, second: b, shrunk: c, cloudOnly: d, normal: n } = r;
  ok(a.idb && a.same && a.lsGone && a.back, '放不進 localStorage：整份改放 IndexedDB（內容一字不差），讀得回來', a);
  ok(a.notices.length === 0, '改放的時候不跳「本機空間不足」的通知', a.notices);
  ok(a.bigStr === 0, '改放的時候不把存檔再轉一次文字', { bigStr: a.bigStr });
  ok(b.lsTries === 0 && b.bigStr === 0 && b.back && b.notices.length === 0, '下一次存檔差不多大：直接放 IndexedDB，不再試 localStorage、不再轉文字、不跳通知', b);
  ok(c.hadFlag && c.lsTries >= 1, '存檔比上次小一成以上：會再試一次 localStorage', c);
  ok(d.notices.length === 1 && /本機備份空間不足/.test(d.notices[0]), 'IndexedDB 也放不下、瘦身後還是放不下：才通知「改為只存雲端」（一次）', d);
  ok(d.flag == null, '只存雲端時不再記「直接放 IndexedDB」', d);
  ok(n.inLs && n.idbGone, '空間恢復後照常寫進 localStorage，IndexedDB 裡的舊副本清掉', n);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
