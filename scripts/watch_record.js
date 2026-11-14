// 事件追蹤紀錄器（chrome-extension/sim-watch.js）的錄製與受控比較。不連線、不呼叫 AI（全部走規則版）。
// 用法：
//   node scripts/watch_record.js record  <天數=120> <城鎮等級=3> <種子=7> <輸出.js>
//       固定亂數種子建一座城、跑 N 天，把事件追蹤板的資料寫成 tools/event-board/data/ 可以直接載入的 .js
//   node scripts/watch_record.js compare <天數=60>  <城鎮等級=3> <種子=7>
//       同一顆種子跑三次：不載入紀錄器／載入但沒接上／載入並接上，比較存檔雜湊、亂數取用次數、tick、
//       記憶筆數、決策統計、AI 名額。三次必須完全相同（紀錄器不能影響模擬）。
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
    for (let d = 0; d < days; d++) { for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } if (d % 10 === 9) await new Promise(r => setTimeout(r, 0)); }
    const all = Object.values(w.agents).filter(a => !a.isPlayer);
    const out = { ver: RIMTOWN_APP_VERSION, tick: w.tickCount, day: w._absDay(), rng: calls, pop: all.filter(a => !a.isDead).length, tier: typeof TIERS !== 'undefined' ? TIERS.level(w) : null,
      mem: all.reduce((n, a) => n + (a.memory?.entries?.length || 0), 0), memText: all.map(a => (a.memory?.entries || []).length + ':' + (a.memory?.entries?.slice(-1)[0]?.tick ?? '')).join(','),
      decide: JSON.stringify(DECIDE.S(w).st) + JSON.stringify(DECIDE.S(w).pick), llmUsed: w.npcLlmUsedToday || 0, union: w.union ? { on: w.union.on, strikes: w.union.strikes, won: w.union.won, lost: w.union.lost, hist: (w.union.history || []).map(h => h.k).join(',') } : null,
      mstrikes: w.market?.strikes || 0, prot: w.things?.st?.prot || 0, save: JSON.stringify(w.serialize()) };
    if (watch === 'on') out.watch = WATCH.export(w, { seed: SEED, tier: TIER, days });
    out.hasWatchKey = Object.keys(w).filter(k => /watch/i.test(k)).length;
    return out;
  }, { TIER, SEED, days, watch });
  r.errs = errs; r.net = net; r.saveHash = crypto.createHash('sha256').update(r.save).digest('hex'); r.saveBytes = r.save.length; r.memHash = crypto.createHash('sha256').update(r.memText).digest('hex').slice(0, 16); delete r.save; delete r.memText;
  await page.context().close(); return r;
}

(async () => {
  const browser = await chromium.launch();
  if (MODE === 'compare') {
    const rows = {}; for (const m of ['none', 'loaded', 'on']) { rows[m] = await run(browser, m, DAYS); delete rows[m].watch; }
    const keys = ['tick', 'day', 'rng', 'pop', 'mem', 'memHash', 'decide', 'llmUsed', 'saveHash', 'saveBytes', 'net']; let ok = true;
    for (const k of keys) { const v = ['none', 'loaded', 'on'].map(m => JSON.stringify(rows[m][k])); const same = v[0] === v[1] && v[1] === v[2]; if (!same) ok = false; console.log((same ? 'SAME ' : 'DIFF ') + k.padEnd(10) + ' ' + (k === 'decide' ? crypto.createHash('sha256').update(v[0]).digest('hex').slice(0, 12) : v[0].slice(0, 70)) + (same ? '' : '  | ' + v[1].slice(0, 40) + ' | ' + v[2].slice(0, 40))); }
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
