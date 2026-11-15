// v10.3.0 存檔只放雲端
// 以前每次存檔存兩份：一份上雲端，一份留在這台裝置（localStorage／IndexedDB）。現在裝置上不留存檔，載入一律讀雲端。
// 這支測試用一個假的雲端（記在測試程式裡）跑完整流程：
//  1) 新帳號：存檔上雲端，裝置上沒有任何存檔副本
//  2) 重新整理：從雲端載回來，進度一樣；沒存上雲端的進度會倒退到上一次雲端存檔（這是只放雲端的代價）
//  3) 舊版留在裝置上的副本：比雲端新就補傳雲端再清掉；不比雲端新就直接清掉；其他鎮的副本在背景清理，雲端沒有的先補傳
//  4) 開機時雲端讀不到：顯示「讀不到雲端存檔」請玩家重試，不開新鎮、不寫任何東西
//  5) 玩到一半雲端存不上：通知一次、之後不重複、恢復時再說一聲；存不上去時不讓切鎮
//  6) 切到背景：有新進度就立刻存雲端；沒有新進度、或半分鐘內才存過就不傳
//  7) 兩座鎮互相切換：都走雲端，裝置上不留副本
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
// 假的雲端
function cloud() {
  const C = { saves: {}, down: false, saveFail: false, log: [], posts: 0, gets: 0 };
  C.route = async (r) => {
    const req = r.request(); const u = new URL(req.url()); const p = u.pathname.replace(/^\/api\//, ''); const J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'me') return J({ logged_in: true, user: { id: 1, username: 'tester' } });
    if (p === 'saves') { if (C.down) return J({ error: 'down' }, 500); return J({ saves: Object.values(C.saves).map(({ save_data, ...m }) => m) }); }
    if (p === 'save' && req.method() === 'POST') { C.posts++; const b = JSON.parse(req.postData() || '{}'); C.log.push(['POST', b.town_id, b.tick_count]); if (C.down || C.saveFail) return J({ error: 'down' }, 500);
      const old = C.saves[b.town_id]; if (old && !b.force && Number(b.tick_count) < Number(old.tick_count)) return J({ success: true, stale: true });
      C.saves[b.town_id] = { town_id: b.town_id, town_name: b.town_name, tick_count: b.tick_count, season: b.season, year: b.year, day: b.day, population: b.population, town_theme: b.town_theme, origin: b.origin, world_id: b.world_id, updated_at: '2026-01-01 00:00:00', save_data: b.save_data }; return J({ success: true }); }
    if (p.startsWith('save/')) { const id = p.slice(5); if (req.method() === 'GET') { C.gets++; C.log.push(['GET', id]); if (C.down) return J({ error: 'down' }, 500); const s = C.saves[id]; return s ? J({ save_data: s.save_data, tick_count: s.tick_count }) : J({ error: 'not_found' }, 404); } return J({ success: true }); }
    return J({ saves: [], reply: '', settings: null });
  };
  return C;
}
const boot = async (page, wantReady = true) => { await page.goto(BASE + 'town.html', { timeout: 90000 }); if (wantReady) await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400); };
// 這台裝置上留著的存檔副本（不算城鎮列表、聊天封存）
const deviceSaves = (page) => page.evaluate(async () => { const ls = Object.keys(localStorage).filter(k => /^rimtown_town_/.test(k) && k !== 'rimtown_town_list' && !k.endsWith('_archives')); const marks = Object.keys(localStorage).filter(k => /^rimtown_(lt|synced)_/.test(k)); let idb = []; try { idb = (await RTStore.keys()) || []; } catch (e) {} return { ls, marks, idb }; });
const quiet = (page) => page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = (m) => { (window.__alerts = window.__alerts || []).push(String(m)); }; window.__notices = []; app._showCornerNotice = (o) => { window.__notices.push(o?.title || ''); }; });
async function ctxFor(browser, C, lang = 'zh') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route('**/api/**', C.route);
  await ctx.addInitScript(({ jwt, lang }) => { if (localStorage.getItem('__seed')) return; localStorage.setItem('__seed', '1'); localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  return ctx;
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- 1、2) 新帳號 → 存檔 → 重新整理 ----------
  console.log('新帳號、存檔、重新整理');
  {
    const C = cloud(); const ctx = await ctxFor(browser, C); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page); await quiet(page);
    const a = await page.evaluate(async () => { const app = window.rimtownApp; app.world.tickCount += 300; const r = await app.saveGame(); app._saveCurrentTown(); return { r, id: app.currentTownId, tick: app.world.tickCount, name: app.world.townName }; });
    const d1 = await deviceSaves(page);
    ok(a.r === true && C.saves[a.id] && Number(C.saves[a.id].tick_count) === a.tick, '存檔上了雲端（進度一致）', { r: a.r, cloud: C.saves[a.id]?.tick_count, tick: a.tick });
    ok(d1.ls.length === 0 && d1.idb.length === 0 && d1.marks.length === 0, '裝置上沒有任何存檔副本（localStorage、IndexedDB 都沒有）', d1);
    // 再走 120 格、不存，直接重新整理
    await page.evaluate(() => { window.rimtownApp.world.tickCount += 120; });
    C.gets = 0; await boot(page); await quiet(page);
    const b = await page.evaluate(() => ({ id: window.rimtownApp.currentTownId, tick: window.rimtownApp.world.tickCount, pop: Object.keys(window.rimtownApp.world.agents).length }));
    ok(b.id === a.id && b.tick === a.tick && C.gets === 1, '重新整理：從雲端載回同一座鎮、同樣的進度（下載一次）', { b, want: a.tick, gets: C.gets });
    ok(b.tick === a.tick, '沒存上雲端的那 120 格不見了：倒退到上一次雲端存檔（只放雲端的代價）', b);
    const d2 = await deviceSaves(page); ok(d2.ls.length === 0 && d2.idb.length === 0, '重新整理後裝置上還是沒有存檔副本', d2);
    // ---------- 6) 切到背景 ----------
    const h = await page.evaluate(async () => { const app = window.rimtownApp; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const fire = async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); await sleep(900); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); };
      const out = {}; app._lastExitFlushTick = -1; await fire(); out.t0 = app.world.tickCount; // 沒有新進度
      app.world.tickCount += 50; app._lastCloudSaveAt = Date.now(); await fire(); out.t1 = app.world.tickCount; // 半分鐘內才存過
      app._lastCloudSaveAt = Date.now() - 60000; await fire(); out.t2 = app.world.tickCount; return out; });
    const posts = C.log.filter(x => x[0] === 'POST');
    ok(posts.filter(x => x[2] === h.t0).length === 1, '切到背景但沒有新進度：不重傳', posts);
    ok(Number(C.saves[a.id].tick_count) === h.t2 && posts.filter(x => x[2] === h.t2).length === 1, '切到背景且有新進度（距上次存檔超過半分鐘）：立刻存上雲端，只傳一次', { cloud: C.saves[a.id].tick_count, t2: h.t2, posts });
    // ---------- 5) 雲端存不上 ----------
    C.saveFail = true;
    const f = await page.evaluate(async () => { const app = window.rimtownApp; window.__notices.length = 0; app.world.tickCount += 30; const r1 = await app.saveGame(); app.world.tickCount += 30; const r2 = await app.saveGame(); const n1 = window.__notices.slice();
      const before = app.currentTownId; window.__alerts = []; await app.switchTown('town_other'); return { r1, r2, n1, stayed: app.currentTownId === before, alerts: window.__alerts.slice(), failed: app._cloudSaveFailed }; });
    ok(f.r1 === false && f.r2 === false && f.n1.length === 1 && /雲端存檔失敗/.test(f.n1[0]), '雲端存不上：回報沒存好，通知只跳一次', f);
    ok(f.stayed && f.alerts.length === 1 && /先不切換/.test(f.alerts[0]), '存不上去時不讓切鎮（不然還沒上傳的進度就沒了）', f);
    C.saveFail = false;
    const g = await page.evaluate(async () => { const app = window.rimtownApp; window.__notices.length = 0; const r = await app.saveGame(); return { r, n: window.__notices.slice(), failed: app._cloudSaveFailed, tick: app.world.tickCount }; });
    ok(g.r === true && g.n.length === 1 && /恢復/.test(g.n[0]) && !g.failed && Number(C.saves[a.id].tick_count) === g.tick, '雲端恢復：存上去了，再通知一次', g);
    // ---------- 7) 兩座鎮互相切換 ----------
    const other = await page.evaluate(() => { const w2 = new World(); w2.townTheme = 'harbor'; w2.townName = '海風鎮'; w2.reset(); w2.tickCount = 777; return { blob: JSON.stringify(w2.serialize()), pop: Object.keys(w2.agents).length }; });
    C.saves.town_other = { town_id: 'town_other', town_name: '海風鎮', tick_count: 777, season: '春季', year: 1, day: 1, population: other.pop, town_theme: 'harbor', origin: 'neighbor', updated_at: '2026-01-01 00:00:00', save_data: other.blob };
    C.log.length = 0;
    const s = await page.evaluate(async () => { const app = window.rimtownApp; app.world.tickCount += 20; const from = { id: app.currentTownId, tick: app.world.tickCount }; await app.switchTown('town_other'); await new Promise(r => setTimeout(r, 300)); return { from, now: app.currentTownId, tick: app.world.tickCount, name: app.world.townName }; });
    const d3 = await deviceSaves(page);
    ok(s.now === 'town_other' && s.tick === 777 && Number(C.saves[s.from.id].tick_count) === s.from.tick, '切鎮：原本那座先存上雲端，目的地從雲端載入', { s, cloudFrom: C.saves[s.from.id].tick_count });
    ok(C.log.filter(x => x[0] === 'POST' && x[1] === 'town_other').length === 0, '剛從雲端載來的鎮不會馬上再整份傳回去', C.log);
    ok(d3.ls.length === 0 && d3.idb.length === 0, '切鎮後裝置上沒有任何存檔副本', d3);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  // ---------- 3) 舊版留在裝置上的副本 ----------
  console.log('舊版留在裝置上的副本');
  for (const mode of ['ahead', 'same']) {
    const C = cloud(); const ctx = await ctxFor(browser, C); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page); await quiet(page);
    // 先做出一座雲端有存檔的鎮，再照舊版的樣子在裝置上放副本
    const a = await page.evaluate(async (mode) => { const app = window.rimtownApp; app.world.tickCount = 1000; await app.saveGame(); const id = app.currentTownId; const cloudTick = 1000;
      app.world.tickCount = mode === 'ahead' ? 1200 : 1000; const blob = JSON.stringify(app.world.serialize());
      localStorage.setItem('rimtown_town_' + id, blob); localStorage.setItem('rimtown_lt_' + id, String(app.world.tickCount)); localStorage.setItem('rimtown_synced_' + id, String(cloudTick)); localStorage.setItem('rimtown_last_town', id);
      // 其他鎮的舊副本（IndexedDB）：雲端有的、雲端沒有的、雲端沒有但跟雲端另一座同名的
      const mk = (name, tick) => { const w2 = new World(); w2.townTheme = 'harbor'; w2.townName = name; w2.reset(); w2.tickCount = tick; return JSON.stringify(w2.serialize()); };
      window.__mk = { has: mk('海風鎮', 500), only: mk('礦山鎮', 640), dup: mk('海風鎮', 30) };
      await RTStore.set('town_has', window.__mk.has); await RTStore.set('town_only', window.__mk.only); await RTStore.set('town_dup', window.__mk.dup);
      const list = app._getTownList(); list.push({ id: 'town_has', name: '海風鎮', theme: 'harbor', origin: 'neighbor', season: '春季', year: 1, day: 6 }, { id: 'town_only', name: '礦山鎮', theme: 'mountain', origin: 'neighbor', season: '春季', year: 1, day: 7 }, { id: 'town_dup', name: '海風鎮', theme: 'harbor', origin: 'neighbor', season: '春季', year: 1, day: 3 }); // 都有進度(不是第 1 天的空殼,那種開機時本來就會清) app._saveTownList(list);
      return { id, has: window.__mk.has }; }, mode);
    C.saves.town_has = { town_id: 'town_has', town_name: '海風鎮', tick_count: 500, season: '春季', year: 1, day: 1, population: 20, updated_at: '2026-01-01 00:00:00', save_data: a.has };
    C.log.length = 0; C.gets = 0;
    await boot(page); await quiet(page);
    await page.waitForFunction((id) => !localStorage.getItem('rimtown_town_' + id), a.id, { timeout: 20000 }).catch(() => {});
    const b = await page.evaluate(async () => { const app = window.rimtownApp; const n = await app._purgeDeviceSaves(app._cloudSaves); return { tick: app.world.tickCount, purged: n }; });
    await page.waitForTimeout(300);
    const d = await deviceSaves(page);
    if (mode === 'ahead') {
      ok(b.tick === 1200 && Number(C.saves[a.id].tick_count) === 1200, '裝置上的舊副本比雲端新（這台最後存的、雲端沒被別台動過）：用它，並補傳雲端', { tick: b.tick, cloud: C.saves[a.id].tick_count });
    } else {
      ok(b.tick === 1000 && C.log.filter(x => x[0] === 'POST' && x[1] === a.id).length === 0, '裝置上的舊副本不比雲端新：不必補傳', { tick: b.tick, log: C.log });
    }
    ok(!d.ls.includes('rimtown_town_' + a.id) && !d.marks.some(k => k.endsWith(a.id)), '目前這座鎮留在裝置上的舊副本清掉了', d);
    ok(!d.idb.includes('town_has'), '其他鎮的舊副本：雲端已經有同樣的進度，直接清掉', d.idb);
    ok(!d.idb.includes('town_only') && C.saves.town_only && Number(C.saves.town_only.tick_count) === 640, '其他鎮的舊副本：雲端沒有的先補傳雲端，傳成功才清掉', { idb: d.idb, cloud: C.saves.town_only?.tick_count });
    ok(d.idb.includes('town_dup') && !C.saves.town_dup, '雲端沒有、但跟雲端另一座同名的舊副本：不傳也不清，留給玩家在城鎮列表決定', { idb: d.idb });
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  // ---------- 4) 開機時雲端讀不到 ----------
  console.log('開機時雲端讀不到');
  for (const lang of ['zh', 'en']) {
    const C = cloud(); const ctx = await ctxFor(browser, C, lang); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page); await quiet(page);
    const a = await page.evaluate(async () => { const app = window.rimtownApp; app.world.tickCount = 900; await app.saveGame(); return { id: app.currentTownId }; });
    C.down = true; C.log.length = 0;
    await boot(page, false);
    await page.waitForSelector('#rt-cloud-down', { timeout: 60000 }).catch(() => {});
    const r = await page.evaluate(() => { const el = document.getElementById('rt-cloud-down'); const b = el?.querySelector('#rt-cd-retry'); const bb = b?.getBoundingClientRect(); return { shown: !!el, title: el?.querySelector('h2')?.textContent || '', desc: el?.querySelector('p')?.textContent || '', btn: b?.textContent || '', btnH: Math.round(bb?.height || 0), ready: !!window.rimtownApp?._initReady, id: window.rimtownApp?.currentTownId || null, hs: document.documentElement.scrollWidth > innerWidth + 1, loading: !!document.querySelector('#rt-loading:not([hidden])') && getComputedStyle(document.querySelector('#rt-loading')).display !== 'none' }; });
    ok(r.shown && (lang === 'zh' ? /讀不到雲端存檔/.test(r.title) && /再試一次/.test(r.btn) : /cloud save/i.test(r.title) && /try again/i.test(r.btn) && !/[一-鿿]/.test(r.title + r.desc + r.btn)), `雲端讀不到：顯示說明與「再試一次」（${lang}）`, r);
    ok(r.btnH >= 44 && !r.hs, '按鈕夠大好按、沒有橫向捲動', r);
    ok(C.log.filter(x => x[0] === 'POST').length === 0 && Number(C.saves[a.id].tick_count) === 900, '沒有開新鎮、沒有往雲端寫任何東西，原本的存檔原封不動', { log: C.log, cloud: C.saves[a.id]?.tick_count });
    // 雲端恢復後按「再試一次」
    C.down = false; await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.click('#rt-cd-retry')]);
    await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }).catch(() => {});
    const b = await page.evaluate(() => ({ id: window.rimtownApp?.currentTownId, tick: window.rimtownApp?.world?.tickCount, shown: !!document.getElementById('rt-cloud-down') }));
    ok(b.id === a.id && b.tick === 900 && !b.shown, '雲端恢復後按「再試一次」：載回原本的鎮與進度', b);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
