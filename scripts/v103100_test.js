// v10.3.1 換一台瀏覽器登入，不再把拿過的成就整批重傳
// 以前：這台瀏覽器沒有本機成就紀錄（新裝置、清過瀏覽器資料）時，開場會把雲端已經有的成就一個一個再 POST 一次 /api/achievements。
// 原因有兩個：(1) 伺服器回的清單是「成就代號 → 資料」的物件，前端當成陣列讀，讀取時出錯又沒報，雲端清單其實從來沒併進來；
//            (2) 就算讀對了，清單回來得比第一輪判定（開場 5 秒）慢時，那一輪還是會整批當成新解鎖上傳。
// 這支測試用一個假的雲端（成就存成跟伺服器一樣的物件）跑：
//  1) 第一台瀏覽器：把鎮調到第 13 年，拿到一批成就並傳上雲端
//  2) 換一台瀏覽器（本機沒有成就紀錄）：雲端已有的成就一個都不重傳（中文、英文各一次）
//  3) 清單回來得比第一輪判定慢：判定照常跑、不等；清單回來後只補傳清單裡沒有的
//  4) 清單讀不到（伺服器出錯）：成就照樣判定，這段時間拿到的照樣傳上去；第一輪不彈通知、之後的照彈
//  5) 沒登入：只用本機紀錄，不讀也不傳雲端
//  6) 舊格式（陣列）的清單也讀得懂
//  7) 清單一直不回來：等 15 秒就不等了，排著的照傳（不會卡著永遠不傳）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
// 測試用的假登入憑證（簽章是假的，只有這支測試的假雲端認得）
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// 假的雲端：存檔＋成就。成就照 api/achievements.js 的格式存成 { 代號: { unlocked_at, town_id } }
function cloud() {
  const C = { saves: {}, ach: {}, achGets: 0, achPosts: [], achDelay: 0, achFail: false, achShape: 'object' };
  C.route = async (r) => {
    const req = r.request(); const u = new URL(req.url()); const p = u.pathname.replace(/^\/api\//, ''); const J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }).catch(() => {}); // 頁面已經關掉的請求不管
    if (p === 'me') return J({ logged_in: true, user: { id: 1, username: 'tester' } });
    if (p === 'saves') return J({ saves: Object.values(C.saves).map(({ save_data, ...m }) => m) });
    if (p === 'save' && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); C.saves[b.town_id] = { town_id: b.town_id, town_name: b.town_name, tick_count: b.tick_count, season: b.season, year: b.year, day: b.day, population: b.population, town_theme: b.town_theme, origin: b.origin, world_id: b.world_id, updated_at: '2026-01-01 00:00:00', save_data: b.save_data }; return J({ success: true }); }
    if (p.startsWith('save/')) { const s = C.saves[p.slice(5)]; if (req.method() === 'GET') return s ? J({ save_data: s.save_data, tick_count: s.tick_count }) : J({ error: 'not_found' }, 404); return J({ success: true }); }
    if (p === 'achievements' || p === 'achievement') {
      if (req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); C.achPosts.push(b.key); if (!C.ach[b.key]) C.ach[b.key] = { unlocked_at: '2026-01-01 00:00:00', town_id: b.town_id || '' }; return J({ success: true }); }
      C.achGets++; const snap = JSON.parse(JSON.stringify(C.ach)); // 清單是請求到的那一刻的樣子
      if (C.achDelay) await sleep(C.achDelay);
      if (C.achFail) return J({ error: 'down' }, 500);
      return J({ achievements: C.achShape === 'array' ? Object.keys(snap).map(k => ({ achievement_key: k })) : snap });
    }
    return J({ saves: [], reply: '', settings: null });
  };
  return C;
}
// 一台「新的瀏覽器」：登入了，但本機沒有任何成就紀錄
async function ctxFor(browser, C, lang = 'zh') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route('**/api/**', C.route);
  await ctx.addInitScript(({ jwt, lang }) => { if (localStorage.getItem('__seed')) return; localStorage.setItem('__seed', '1'); localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  return ctx;
}
// 開遊戲頁：停住模擬（鎮的狀態不變，兩台瀏覽器判定出來的成就才會一樣），並數成就通知彈了幾次
const boot = async (page) => {
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {}; window.__toasts = 0; app._showAchievementToast = () => { window.__toasts++; }; });
};
// 等開場第一輪成就判定跑完（每 5 秒一輪，第一輪在開場後 5 秒）
const firstRound = (page) => page.waitForFunction(() => window.rimtownApp?._achNewOnce === true, null, { timeout: 30000 });
const have = (page) => page.evaluate(() => [...window.rimtownApp._unlockedAchievements]);
const count = (arr, k) => arr.filter(x => x === k).length;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const C = cloud();
  let K = []; // 第一台瀏覽器拿到、已經在雲端的成就

  // ---------- 1) 第一台瀏覽器：拿到一批成就 ----------
  console.log('第一台瀏覽器：拿到一批成就並傳上雲端');
  {
    const ctx = await ctxFor(browser, C); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page);
    const a = await page.evaluate(async () => { const app = window.rimtownApp; const w = app.world;
      w.clock.year = 13; w.tickCount += 5000; const res = w.stockpile?.resources || w.resources; if (res) res.silver = Math.max(res.silver || 0, 3000);
      app.state = w.getState(); app._checkAchievements(); app._checkAchievements();
      const saved = await app.saveGame(); app._saveCurrentTown?.(); await new Promise(r => setTimeout(r, 600));
      return { saved, id: app.currentTownId, year: app.state.clock?.year, local: JSON.parse(localStorage.getItem('rimtown_achievements') || '[]') }; });
    K = Object.keys(C.ach);
    ok(a.saved === true && !!C.saves[a.id] && a.year === 13, '第 13 年的鎮存上了雲端', { saved: a.saved, id: a.id, year: a.year });
    ok(K.length >= 5 && K.includes('survive_year') && K.includes('survive_100'), `拿到一批成就並傳上雲端（${K.length} 個）`, K);
    ok(K.every(k => count(C.achPosts, k) === 1) && a.local.length >= K.length, '每個成就各傳一次，本機也記下了', { posts: C.achPosts.length, local: a.local.length });
    ok(errs.length === 0, '沒有程式錯誤', errs);
    await ctx.close();
  }

  // ---------- 2) 換一台瀏覽器：雲端已有的不重傳 ----------
  for (const lang of ['zh', 'en']) {
    console.log(`換一台瀏覽器登入（${lang === 'zh' ? '中文' : '英文'}，本機沒有成就紀錄）`);
    C.achPosts.length = 0; C.achGets = 0;
    const ctx = await ctxFor(browser, C, lang); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page);
    const pre = await page.evaluate(() => ({ ls: localStorage.getItem('rimtown_achievements'), year: window.rimtownApp.world.clock.year }));
    await firstRound(page); await sleep(800);
    const mine = await have(page); const again = C.achPosts.filter(k => K.includes(k));
    ok(pre.ls === null && pre.year === 13, '開場時本機沒有成就紀錄，載回的是第 13 年的鎮', pre);
    ok(C.achGets === 1, '雲端成就清單讀了一次', C.achGets);
    ok(K.every(k => mine.includes(k)), '雲端清單裡的成就在這台瀏覽器上都是已解鎖', K.filter(k => !mine.includes(k)));
    ok(again.length === 0, `雲端已經有的 ${K.length} 個成就一個都沒有重傳`, again);
    ok(C.achPosts.length === 0, '這一輪沒有送出任何成就請求（鎮的狀態跟第一台一樣，沒有新成就）', C.achPosts);
    const t = await page.evaluate(() => window.__toasts); ok(t === 0, '開場沒有彈成就通知', t);
    ok(errs.length === 0, '沒有程式錯誤', errs);
    await ctx.close();
  }

  // ---------- 3) 清單回來得比第一輪判定慢 ----------
  console.log('雲端清單回來得比第一輪判定慢（9 秒）');
  {
    const gone = 'survive_year'; delete C.ach[gone]; // 假裝這一個當初沒傳成功，雲端清單裡沒有
    C.achPosts.length = 0; C.achGets = 0; C.achDelay = 9000;
    const ctx = await ctxFor(browser, C); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page); await firstRound(page);
    const mid = await have(page); const midPosts = C.achPosts.slice();
    ok(K.every(k => mid.includes(k)), '清單還沒回來，第一輪照常判定（不等清單）', K.filter(k => !mid.includes(k)));
    ok(midPosts.length === 0, '清單還沒回來時先不上傳', midPosts);
    await page.waitForFunction(() => window.rimtownApp._achUploadQueue == null, null, { timeout: 30000 }); await sleep(800);
    const again = C.achPosts.filter(k => K.includes(k) && k !== gone);
    ok(again.length === 0, '清單回來後，清單裡已經有的不重傳', again);
    ok(count(C.achPosts, gone) === 1 && !!C.ach[gone], '清單裡沒有的那一個補傳一次', C.achPosts);
    const t = await page.evaluate(() => window.__toasts); ok(t === 0, '第一輪拿到的不彈通知', t);
    ok(errs.length === 0, '沒有程式錯誤', errs);
    C.achDelay = 0; await ctx.close();
  }

  // ---------- 4) 清單讀不到 ----------
  console.log('雲端清單讀不到（伺服器出錯）');
  {
    C.achPosts.length = 0; C.achGets = 0; C.achFail = true;
    const ctx = await ctxFor(browser, C); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page); await firstRound(page); await sleep(800);
    const mine = await have(page);
    ok(K.every(k => mine.includes(k)), '清單讀不到，成就照樣判定', K.filter(k => !mine.includes(k)));
    ok(K.every(k => count(C.achPosts, k) === 1), '不知道雲端有哪些，這一輪拿到的各傳一次（伺服器重複的不會多記）', C.achPosts);
    const r = await page.evaluate(async () => { const app = window.rimtownApp; const t0 = window.__toasts, done = app._achFirstCheckDone;
      const key = Object.keys(ACHIEVEMENTS).find(k => !app._unlockedAchievements.has(k) && !['player', 'legacy'].includes(ACHIEVEMENTS[k].category));
      app._unlockAchievement(key); app._unlockAchievement(key); await new Promise(r => setTimeout(r, 500));
      return { t0, done, key, t1: window.__toasts }; });
    ok(r.done === true && r.t0 === 0, '第一輪拿到的不彈通知', r);
    ok(r.t1 === 1 && count(C.achPosts, r.key) === 1, '第一輪之後新拿到的：彈一次通知、立刻傳一次', { r, n: count(C.achPosts, r.key) });
    ok(errs.length === 0, '沒有程式錯誤', errs);

    // ---------- 5) 沒登入 ----------
    console.log('沒登入：只用本機紀錄');
    C.achFail = false; C.achPosts.length = 0; C.achGets = 0;
    const g = await page.evaluate(async () => { const app = window.rimtownApp; const was = app.auth.loggedIn; app.auth.loggedIn = false;
      localStorage.setItem('rimtown_achievements', JSON.stringify(['first_chat', 'builder'])); app._unlockedAchievements = new Set();
      await app._loadAchievementsFromCloud();
      const loaded = [...app._unlockedAchievements]; const queued = app._achUploadQueue != null;
      const key = Object.keys(ACHIEVEMENTS).find(k => !app._unlockedAchievements.has(k) && !['player', 'legacy'].includes(ACHIEVEMENTS[k].category));
      app._unlockAchievement(key); await new Promise(r => setTimeout(r, 500));
      const ls = JSON.parse(localStorage.getItem('rimtown_achievements') || '[]'); app.auth.loggedIn = was;
      return { loaded, queued, key, inLs: ls.includes(key) }; });
    ok(g.loaded.length === 2 && g.loaded.includes('first_chat') && g.loaded.includes('builder'), '讀到本機記的成就', g.loaded);
    ok(C.achGets === 0 && C.achPosts.length === 0 && !g.queued, '沒讀雲端清單、沒傳任何成就、也沒有排著等傳的', { gets: C.achGets, posts: C.achPosts, queued: g.queued });
    ok(g.inLs, '新拿到的成就記在本機', g);

    // ---------- 6) 舊格式（陣列） ----------
    console.log('舊格式（陣列）的清單');
    C.achShape = 'array'; C.ach = { first_chat: {}, rich: {}, builder: {} };
    const h = await page.evaluate(async () => { const app = window.rimtownApp; localStorage.removeItem('rimtown_achievements'); app._unlockedAchievements = new Set(); await app._loadAchievementsFromCloud(); return [...app._unlockedAchievements].sort(); });
    ok(h.join() === 'builder,first_chat,rich', '陣列格式的清單也併得進來', h);
    ok(errs.length === 0, '沒有程式錯誤', errs);

    // ---------- 7) 清單一直不回來 ----------
    console.log('雲端清單一直不回來（等 15 秒就不等了）');
    C.achShape = 'object'; C.ach = {}; C.achPosts.length = 0; C.achDelay = 40000;
    const key = await page.evaluate(() => { const app = window.rimtownApp; app._checkAchievements = () => {}; // 第 5、6 步把已解鎖清單換掉了，這一步只看排隊跟逾時，先停掉每 5 秒的判定，免得它又拿到別的
      app._loadAchievementsFromCloud();
      const key = Object.keys(ACHIEVEMENTS).find(k => !app._unlockedAchievements.has(k) && !['player', 'legacy'].includes(ACHIEVEMENTS[k].category)); app._unlockAchievement(key); return key; });
    await sleep(3000);
    const q0 = await page.evaluate(() => window.rimtownApp._achUploadQueue?.length);
    ok(C.achPosts.length === 0 && q0 === 1, '還在等清單：拿到的成就先排著', { posts: C.achPosts, q0 });
    await page.waitForFunction(() => window.rimtownApp._achUploadQueue == null, null, { timeout: 30000 }); await sleep(500);
    ok(count(C.achPosts, key) === 1 && C.achPosts.length === 1, '等了 15 秒清單沒回來：排著的照傳一次', C.achPosts);
    ok(errs.length === 0, '沒有程式錯誤', errs);
    await ctx.close();
  }

  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
