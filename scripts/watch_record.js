// 事件追蹤紀錄器（chrome-extension/sim-watch.js）的錄製與受控比較。不連線、不呼叫 AI（全部走規則版）。
// 用法：
//   node scripts/watch_record.js record  <天數=120> <城鎮等級=3> <種子=7> <輸出.js>
//       固定亂數種子建一座城、跑 N 天，把事件追蹤板的資料寫成 tools/event-board/data/ 可以直接載入的 .js
//   node scripts/watch_record.js trace   <天數>     <城鎮等級=3> <種子=7> [none|loaded|on]   只跑一次，印出亂數取用次數與存檔雜湊
//   node scripts/watch_record.js repro   <天數>     <城鎮等級=3> <種子=7> [none|loaded|on]
//       同一種設定跑兩次，確認測試環境自己可以重現；不一樣時印出從第幾天開始分岔
//   node scripts/watch_record.js compare <天數=60>  <城鎮等級=3> <種子=7>
//       同一顆種子跑四次：不載入紀錄器（兩次，確認測試環境自己可重現）／載入但沒接上／載入並接上，比較整份存檔的雜湊
//       （不排除任何欄位）、亂數取用次數、tick、記憶筆數、決策統計、AI 名額。四次必須完全相同（紀錄器不能影響模擬）。
//       基準（不載入跑兩次）不一樣的話直接判定失敗：環境不可重現時，後面的比較沒有意義。
// 需要本機 8126 服務 chrome-extension/：  python3 -m http.server 8126 -d chrome-extension
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const MODE = process.argv[2] || 'record'; const DAYS = +(process.argv[3] || (MODE === 'record' ? 120 : 60)), TIER = +(process.argv[4] || 3), SEED = +(process.argv[5] || 7);
const OUT = process.argv[6] || path.join(__dirname, '..', 'tools', 'event-board', 'data', `real-t${TIER}-s${SEED}-d${DAYS}.js`);
const BASE = process.env.BASE || 'http://localhost:8126/';
const WATCH_SRC = path.join(__dirname, '..', 'chrome-extension', 'sim-watch.js');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

// watch: 'none' 不載入、'loaded' 載入但不接上、'on' 載入並接上
async function run(browser, watch, days) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); let net = 0;
  await page.route('**/api/**', r => { if (/\/api\/chat/.test(r.request().url())) net++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  if (watch !== 'none') await page.addScriptTag({ content: fs.readFileSync(WATCH_SRC, 'utf8') });
  const r = await page.evaluate(async ({ TIER, SEED, days, watch }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    // 頁面開機到這裡之間，開機那座隨機小鎮已經照真實時間跑了幾格（跑幾格看機器當時多忙），可能在瀏覽器儲存空間寫了東西
    // （發現過的鄰鎮登記簿、解鎖紀錄、自動存檔）。模擬會讀這些，所以先清到只剩測試自己設的那幾個鍵，並記下清掉了什麼
    const boot = { ticks: app.world?.tickCount ?? null, removed: [] };
    { const keep = new Set(['rimtown-lang', 'rimtown_jwt', 'rimtown_tutorial_done', 'rimtown_invite_ok', 'rimtown_gh_intro', 'rimtown_ui_all', 'rimtown_3d_quality']); for (const k of Object.keys(localStorage)) if (!keep.has(k)) { boot.removed.push(k); localStorage.removeItem(k); } try { sessionStorage.clear(); } catch (e) {} }
    const w = new World(); app.world = w;
    let s = SEED >>> 0, calls = 0; Math.random = () => { calls++; s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // 時間也固定：Date.now() 與 new Date() 都走同一個假時鐘（存檔的 savedAt 用的是 new Date()，只換 Date.now 的話每次跑都不同）
    let clk = 1700000000000; const RealDate = Date; class FixedDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(clk += 7); } static now() { return (clk += 7); } } window.Date = FixedDate;
    let pn = 1000; performance.now = () => (pn += 3); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    // 誰住哪一棟（housing.map）是照「地圖上有哪些房子、誰先被問到」分的。頁面開機時那座隨機小鎮畫好的房子還留在地圖層，
    // 不清掉的話新鎮的人會被分進上一座鎮的房子，每次開機都不同。這裡回到「地圖還沒畫」的狀態，等下面重畫後才分房。
    if (app.tileMap) { app.tileMap._houseSubZones = {}; app.tileMap._agentHouseMap = {}; app.tileMap._extraHouseCount = 0; app.tileMap.agentPartners = {}; }
    w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed: SEED }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
    try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
    // 夫妻同住的對照表平常是畫面更新時交給地圖層的；這裡整段同步跑、不更新畫面，所以照同一套規則先算好交過去
    try { const byN = {}; const ns = Object.values(w.agents).filter(a => !a.isPlayer); for (const a of ns) byN[a.name] = a.agentId; const partners = {}; for (const a of ns) { const sp = a.relationships?.getSpouse?.(); const pid = sp ? byN[sp.targetName] : null; if (pid && pid !== a.agentId) partners[a.agentId] = pid; } if (app.tileMap) app.tileMap.agentPartners = partners; } catch (e) {}
    if (watch === 'on') WATCH.attach(w);
    // 整段同步跑完，中途不把控制權交還給瀏覽器。交還的話，畫面更新、計時器和非同步回呼會在不固定的時間點插進來取用亂數，
    // 同一顆種子每次跑出來就不一樣（實測過：連「不載入紀錄器」跑兩次都不同），比較就沒有意義。
    const rngDay = []; // 每天結束時亂數一共被取用了幾次：兩次跑的結果不一樣時，用來找是從哪一天開始分岔
    for (let d = 0; d < days; d++) { for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } rngDay.push(calls); }
    const all = Object.values(w.agents).filter(a => !a.isPlayer);
    const out = { ver: RIMTOWN_APP_VERSION, tick: w.tickCount, day: w._absDay(), rng: calls, pop: all.filter(a => !a.isDead).length, tier: typeof TIERS !== 'undefined' ? TIERS.level(w) : null,
      mem: all.reduce((n, a) => n + (a.memory?.entries?.length || 0), 0), memText: all.map(a => (a.memory?.entries || []).length + ':' + (a.memory?.entries?.slice(-1)[0]?.tick ?? '')).join(','),
      decide: JSON.stringify(DECIDE.S(w).st) + JSON.stringify(DECIDE.S(w).pick), llmUsed: w.npcLlmUsedToday || 0, union: w.union ? { on: w.union.on, strikes: w.union.strikes, won: w.union.won, lost: w.union.lost, hist: (w.union.history || []).map(h => h.k).join(',') } : null,
      mstrikes: w.market?.strikes || 0, prot: w.things?.st?.prot || 0, houses: Object.keys(w.housing?.map || {}).length + ' 人分到 ' + new Set(Object.values(w.housing?.map || {})).size + ' 棟', save: JSON.stringify(w.serialize()) };
    out.rngDay = rngDay; out.boot = boot; out.lsAfter = Object.keys(localStorage).sort().join(',');
    if (watch === 'on') out.watch = WATCH.export(w, { seed: SEED, tier: TIER, days });
    out.hasWatchKey = Object.keys(w).filter(k => /watch/i.test(k)).length;
    return out;
  }, { TIER, SEED, days, watch });
  // 存檔整份拿來算雜湊，不拿掉任何欄位（鍵的先後順序也算在內）。
  // 以前 savedAt 與 housing.map 每次跑都不同，所以被排除在比較之外；現在上面把時間與房屋配置都固定了，不需要排除。
  r.saveRaw = JSON.parse(r.save);
  r.errs = errs; r.net = net; r.saveHash = crypto.createHash('sha256').update(r.save).digest('hex'); r.saveBytes = r.save.length; r.memHash = crypto.createHash('sha256').update(r.memText).digest('hex').slice(0, 16); delete r.save; delete r.memText;
  await page.context().close(); return r;
}

(async () => {
  // 預設關掉瀏覽器的最佳化編譯器（TurboFan、Maglev），只留直譯器與基準編譯器。
  // 原因（實測）：遊戲有些計算在「最佳化過」與「沒最佳化過」的程式碼裡結果有極小差異，而哪一段程式什麼時候被最佳化，
  // 取決於整個頁面跑過哪些程式。於是任何跟遊戲無關的程式（紀錄器、量測用的外殼，甚至一行純字串處理）都會讓同一顆種子
  // 在大約第 150 天之後走向不同。關掉最佳化之後，不載入與接上紀錄器跑 151 天的存檔完全相同。
  // 要用一般模式跑：WATCH_JIT=1 node scripts/watch_record.js ...
  const JIT = process.env.WATCH_JIT === '1'; const browser = await chromium.launch(JIT ? {} : { args: ['--js-flags=--no-turbofan --no-maglev'] });
  console.log(JIT ? '引擎：一般模式（有最佳化編譯器；長時間的結果會被無關的程式影響）' : '引擎：關掉最佳化編譯器（結果不受無關的程式影響，但比較慢）');
  if (MODE === 'compare') {
    const rows = {}; for (const m of ['none', 'none2', 'loaded', 'on']) { rows[m] = await run(browser, m === 'none2' ? 'none' : m, DAYS); delete rows[m].watch; }
    const keys = ['tick', 'day', 'rng', 'pop', 'mem', 'memHash', 'decide', 'llmUsed', 'houses', 'saveHash', 'saveBytes']; let ok = true; // net（開機時遊戲自己發的 /api/chat，本機攔下）另外印，不列入比較
    // 先確認測試環境自己可重現：不載入紀錄器跑兩次要完全相同，否則下面的比較不能算數
    const repro = keys.every(k => JSON.stringify(rows.none[k]) === JSON.stringify(rows.none2[k])); console.log((repro ? 'SAME ' : 'DIFF ') + '基準重跑  不載入紀錄器跑兩次' + (repro ? '完全相同' : '就不一樣：測試環境不可重現，以下比較不能算數')); if (!repro) ok = false;
    for (const k of keys) { const v = ['none', 'loaded', 'on'].map(m => JSON.stringify(rows[m][k])); const same = v[0] === v[1] && v[1] === v[2]; if (!same) ok = false; console.log((same ? 'SAME ' : 'DIFF ') + k.padEnd(10) + ' ' + (k === 'decide' ? crypto.createHash('sha256').update(v[0]).digest('hex').slice(0, 12) : v[0].slice(0, 70)) + (same ? '' : '  | ' + v[1].slice(0, 40) + ' | ' + v[2].slice(0, 40))); }
    // 值不同記路徑；值都一樣但鍵的先後順序不同，記成「路徑 (順序)」。順序不同代表有東西被提早建立，也算影響
    const diffPaths = (x, y) => { const out = []; (function d(a, b, p) { if (out.length > 5000) return; if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (a !== b) out.push(p); return; } const ka = Object.keys(a), kb = Object.keys(b); if (ka.length === kb.length && ka.join('\u0001') !== kb.join('\u0001') && ka.slice().sort().join('\u0001') === kb.slice().sort().join('\u0001')) out.push(p + ' (順序)'); for (const k of new Set([...ka, ...kb])) d(a[k], b[k], p + '.' + k); })(x, y, ''); return out; };
    for (const m of ['none2', 'loaded', 'on']) { const dp = diffPaths(rows.none.saveRaw, rows[m].saveRaw); if (dp.length) ok = false;
      console.log(`存檔逐欄比較 none vs ${m}（整份存檔，沒有排除任何欄位）：不同 ${dp.length} 處` + (dp.length ? '  例：' + dp.slice(0, 8).join(' ') : '')); }
    for (const m of ['none2', 'loaded', 'on']) { const i = rows.none.rngDay.findIndex((v, j) => v !== rows[m].rngDay[j]); if (i >= 0) console.log(`亂數取用次數 none vs ${m}：第 ${i + 1} 天開始不同（${rows.none.rngDay[i]} 對 ${rows[m].rngDay[i]}）`); }
    if (!repro) console.log('基準不可重現時，下面的 PASS／FAIL 不能當成紀錄器有沒有影響模擬的證據。');
    for (const m of ['none', 'none2', 'loaded', 'on']) console.log(`開機狀態 ${m}：開機那座鎮跑了 ${rows[m].boot.ticks} 格；清掉的儲存鍵 ${rows[m].boot.removed.length} 個` + (rows[m].boot.removed.length ? '（' + rows[m].boot.removed.slice(0, 6).join('、') + '）' : ''));
    { const v = ['none', 'none2', 'loaded', 'on'].map(m => rows[m].lsAfter); const same = v.every(x => x === v[0]); if (!same) ok = false; console.log((same ? 'SAME ' : 'DIFF ') + '跑完後瀏覽器儲存空間的鍵' + (same ? '' : '  ' + v.map(x => x.slice(0, 80)).join(' | '))); }
    console.log(`errors none/loaded/on: ${rows.none.errs.length}/${rows.loaded.errs.length}/${rows.on.errs.length}; world keys named watch: ${rows.on.hasWatchKey}; AI requests: ${rows.on.net}`);
    console.log(ok && !rows.on.hasWatchKey ? `PASS  紀錄器開關前後完全相同（等級 ${TIER}、種子 ${SEED}、${DAYS} 天）` : 'FAIL  紀錄器影響了模擬');
    await browser.close(); process.exit(ok ? 0 : 1);
  }
  if (MODE === 'trace') { // 只跑一次，印出每天結束時亂數取用的次數與存檔雜湊。用來在不同設定之間對照（例如 WATCH_JIT=1 與預設）
    const kind = process.argv[6] || 'none'; const a = await run(browser, kind, DAYS); await browser.close(); console.log(JSON.stringify({ kind, days: DAYS, jit: JIT, rng: a.rng, saveHash: a.saveHash.slice(0, 16), rngDayLast: a.rngDay.slice(-3) })); process.exit(0); }
  if (MODE === 'repro') { // 只確認測試環境自己可不可以重現：同一種設定跑兩次（預設不載入紀錄器；第七個參數可指定 none／loaded／on）
    const kind = process.argv[6] || 'none'; const a = await run(browser, kind, DAYS), b = await run(browser, kind, DAYS); await browser.close();
    const i = a.rngDay.findIndex((v, j) => v !== b.rngDay[j]); const same = a.saveHash === b.saveHash && i < 0;
    console.log(JSON.stringify({ kind, days: DAYS, same, firstDiffDay: i < 0 ? null : i + 1, rng: [a.rng, b.rng], boot: [a.boot, b.boot], saveHash: [a.saveHash.slice(0, 12), b.saveHash.slice(0, 12)] }));
    if (!same) { const out = []; (function d(x, y, p) { if (out.length > 40) return; if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') { if (x !== y) out.push(p); return; } for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) d(x[k], y[k], p + '.' + k); })(a.saveRaw, b.saveRaw, ''); console.log('存檔不同的欄位（前 40 個）：' + out.join(' ')); }
    process.exit(same ? 0 : 1); }
  const r = await run(browser, 'on', DAYS); await browser.close();
  const W = r.watch; W.meta.label = `真實遊戲紀錄：等級 ${TIER}、種子 ${SEED}、${DAYS} 天（AI 關閉，規則版）`; W.meta.jit = JIT;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, '// 由 scripts/watch_record.js 產生的真實遊戲紀錄（不是展示資料）。不要手改。\n(window.RIMTOWN_EVENT_DATA = window.RIMTOWN_EVENT_DATA || []).push(' + JSON.stringify(W) + ');\n');
  const by = {}; for (const T of W.threads) { const k = T.type + ':' + (T.outcome?.code || T.stage); by[k] = (by[k] || 0) + 1; }
  console.log(JSON.stringify({ ver: r.ver, day: r.day, pop: r.pop, tierLevel: r.tier, union: r.union, marketStrikes: r.mstrikes, protests: r.prot, threads: W.threads.length, by, errors: W.meta.errors, pageErrors: r.errs.slice(0, 3), aiRequests: r.net, out: path.relative(process.cwd(), OUT), kb: Math.round(fs.statSync(OUT).size / 1024) }, null, 1));
})();
