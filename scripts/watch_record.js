// 事件追蹤紀錄器（chrome-extension/sim-watch.js）的錄製與受控比較。不連線、不呼叫 AI（全部走規則版）。
// 用法：
//   node scripts/watch_record.js record  <天數=120> <城鎮等級=3> <種子=7> <輸出.js>
//       固定亂數種子建一座城、跑 N 天，把事件追蹤板的資料寫成 tools/event-board/data/ 可以直接載入的 .js
//   node scripts/watch_record.js compare <天數=60>  <城鎮等級=3> <種子=7>
//       同一顆種子跑四次：不載入紀錄器（兩次，確認測試環境自己可重現）／載入但沒接上／載入並接上，比較存檔雜湊、亂數取用次數、tick、
//       記憶筆數、決策統計、AI 名額。四次必須完全相同（紀錄器不能影響模擬）。
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
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = new World(); app.world = w;
    let s = SEED >>> 0, calls = 0; Math.random = () => { calls++; s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let clk = 1700000000000; Date.now = () => (clk += 7); let pn = 1000; performance.now = () => (pn += 3); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed: SEED }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
    try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
    if (watch === 'on') WATCH.attach(w);
    // 整段同步跑完，中途不把控制權交還給瀏覽器。交還的話，畫面更新、計時器和非同步回呼會在不固定的時間點插進來取用亂數，
    // 同一顆種子每次跑出來就不一樣（實測過：連「不載入紀錄器」跑兩次都不同），比較就沒有意義。
    for (let d = 0; d < days; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const all = Object.values(w.agents).filter(a => !a.isPlayer);
    const out = { ver: RIMTOWN_APP_VERSION, tick: w.tickCount, day: w._absDay(), rng: calls, pop: all.filter(a => !a.isDead).length, tier: typeof TIERS !== 'undefined' ? TIERS.level(w) : null,
      mem: all.reduce((n, a) => n + (a.memory?.entries?.length || 0), 0), memText: all.map(a => (a.memory?.entries || []).length + ':' + (a.memory?.entries?.slice(-1)[0]?.tick ?? '')).join(','),
      decide: JSON.stringify(DECIDE.S(w).st) + JSON.stringify(DECIDE.S(w).pick), llmUsed: w.npcLlmUsedToday || 0, union: w.union ? { on: w.union.on, strikes: w.union.strikes, won: w.union.won, lost: w.union.lost, hist: (w.union.history || []).map(h => h.k).join(',') } : null,
      mstrikes: w.market?.strikes || 0, prot: w.things?.st?.prot || 0, save: JSON.stringify(w.serialize()) };
    if (watch === 'on') out.watch = WATCH.export(w, { seed: SEED, tier: TIER, days });
    out.hasWatchKey = Object.keys(w).filter(k => /watch/i.test(k)).length;
    return out;
  }, { TIER, SEED, days, watch });
  // 存檔裡有兩個欄位跟模擬無關、每次跑都不同（不載入紀錄器跑兩次也不同，實測過）：
  //   savedAt＝存檔當下的真實時間；housing.map＝誰住哪一棟，取決於頁面開機時畫面那一層先排好的房屋配置。
  // 比較時把這兩個欄位拿掉再算雜湊，並另外列出「拿掉之前有幾處不同、在哪裡」，不藏起來。
  const saveObj = JSON.parse(r.save); r.saveRaw = saveObj; const norm = JSON.parse(r.save); delete norm.savedAt; if (norm.housing) delete norm.housing.map;
  r.errs = errs; r.net = net; r.saveHash = crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex'); r.saveBytes = JSON.stringify(norm).length; r.memHash = crypto.createHash('sha256').update(r.memText).digest('hex').slice(0, 16); delete r.save; delete r.memText;
  await page.context().close(); return r;
}

(async () => {
  const browser = await chromium.launch();
  if (MODE === 'compare') {
    const rows = {}; for (const m of ['none', 'none2', 'loaded', 'on']) { rows[m] = await run(browser, m === 'none2' ? 'none' : m, DAYS); delete rows[m].watch; }
    const keys = ['tick', 'day', 'rng', 'pop', 'mem', 'memHash', 'decide', 'llmUsed', 'saveHash', 'saveBytes']; let ok = true; // net（開機時遊戲自己發的 /api/chat，本機攔下）另外印，不列入比較
    // 先確認測試環境自己可重現：不載入紀錄器跑兩次要完全相同，否則下面的比較不能算數
    const repro = keys.every(k => JSON.stringify(rows.none[k]) === JSON.stringify(rows.none2[k])); console.log((repro ? 'SAME ' : 'DIFF ') + '基準重跑  不載入紀錄器跑兩次' + (repro ? '完全相同' : '就不一樣：測試環境不可重現，以下比較不能算數')); if (!repro) ok = false;
    for (const k of keys) { const v = ['none', 'loaded', 'on'].map(m => JSON.stringify(rows[m][k])); const same = v[0] === v[1] && v[1] === v[2]; if (!same) ok = false; console.log((same ? 'SAME ' : 'DIFF ') + k.padEnd(10) + ' ' + (k === 'decide' ? crypto.createHash('sha256').update(v[0]).digest('hex').slice(0, 12) : v[0].slice(0, 70)) + (same ? '' : '  | ' + v[1].slice(0, 40) + ' | ' + v[2].slice(0, 40))); }
    // 值不同記路徑；值都一樣但鍵的先後順序不同，記成「路徑 (順序)」。順序不同代表有東西被提早建立，也算影響
    const diffPaths = (x, y) => { const out = []; (function d(a, b, p) { if (out.length > 5000) return; if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (a !== b) out.push(p); return; } const ka = Object.keys(a), kb = Object.keys(b); if (ka.length === kb.length && ka.join('\u0001') !== kb.join('\u0001') && ka.slice().sort().join('\u0001') === kb.slice().sort().join('\u0001')) out.push(p + ' (順序)'); for (const k of new Set([...ka, ...kb])) d(a[k], b[k], p + '.' + k); })(x, y, ''); return out; };
    const volatile = (p) => p === '.savedAt' || p.startsWith('.housing.map');
    for (const m of ['none2', 'loaded', 'on']) { const dp = diffPaths(rows.none.saveRaw, rows[m].saveRaw); const other = dp.filter(p => !volatile(p)); if (other.length) ok = false;
      console.log(`存檔逐欄比較 none vs ${m}：savedAt 與 housing.map 不同 ${dp.length - other.length} 處（跟模擬無關，基準重跑也會不同）；其他欄位不同 ${other.length} 處` + (other.length ? '  例：' + other.slice(0, 5).join(' ') : '')); }
    console.log(`errors none/loaded/on: ${rows.none.errs.length}/${rows.loaded.errs.length}/${rows.on.errs.length}; world keys named watch: ${rows.on.hasWatchKey}; AI requests: ${rows.on.net}`);
    console.log(ok && !rows.on.hasWatchKey ? `PASS  紀錄器開關前後完全相同（等級 ${TIER}、種子 ${SEED}、${DAYS} 天）` : 'FAIL  紀錄器影響了模擬');
    await browser.close(); process.exit(ok ? 0 : 1);
  }
  const r = await run(browser, 'on', DAYS); await browser.close();
  const W = r.watch; W.meta.label = `真實遊戲紀錄：等級 ${TIER}、種子 ${SEED}、${DAYS} 天（AI 關閉，規則版）`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, '// 由 scripts/watch_record.js 產生的真實遊戲紀錄（不是展示資料）。不要手改。\n(window.RIMTOWN_EVENT_DATA = window.RIMTOWN_EVENT_DATA || []).push(' + JSON.stringify(W) + ');\n');
  const by = {}; for (const T of W.threads) { const k = T.type + ':' + (T.outcome?.code || T.stage); by[k] = (by[k] || 0) + 1; }
  console.log(JSON.stringify({ ver: r.ver, day: r.day, pop: r.pop, tierLevel: r.tier, union: r.union, marketStrikes: r.mstrikes, protests: r.prot, threads: W.threads.length, by, errors: W.meta.errors, pageErrors: r.errs.slice(0, 3), aiRequests: r.net, out: path.relative(process.cwd(), OUT), kb: Math.round(fs.statSync(OUT).size / 1024) }, null, 1));
})();
