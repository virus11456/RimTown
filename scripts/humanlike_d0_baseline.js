// 擬人化智能體 D0 基準量測（只記錄，不改遊戲行為）
// 對應設計文件 DESIGN_HUMANLIKE_AGENT.md 第 23 節「階段 D0：核對與基準」。
// 固定亂數種子建一座城、跑 N 天（AI 關著，全部走規則版），記下：
//   1. 決策核心：每個選擇點各選項被選幾次、最常見選項的占比、同一人同一件事是否每次都選一樣
//   2. 關係：好感、信任、心動的分布隨時間怎麼變（看會不會全鎮慢慢變成好友）
//   3. 記憶：每天新增幾筆、因容量上限被刪幾筆（分重要度）、因分類上限被刪幾筆、被其他機制（大人口裁切等）刪幾筆
//   4. 想法（THOUGHT）：各種想法被加了幾次；心情分布
//   5. 重要人物：名單大小、記憶上限差異
// 用法：node scripts/humanlike_d0_baseline.js [天數=120] [城鎮等級=2] [種子=22] [輸出=/tmp/d0.json] [跟拍=none|<村民序號>]
//   跟拍：在同一顆種子下指定一位一般村民當「玩家正在看的人」，用來量鏡頭會不會改變他的記憶與決定（設計文件 T19）
// 需要本機 8126 服務 chrome-extension/
const { chromium } = require('playwright');
const fs = require('fs');
const DAYS = +(process.argv[2] || 120), TIER = +(process.argv[3] || 2), SEED = +(process.argv[4] || 22), OUT = process.argv[5] || '/tmp/d0.json', FOLLOW = process.argv[6] || 'none';
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  await page.evaluate(({ TIER, SEED, FOLLOW }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); const w = new World(); app.world = w;
    let s = SEED >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let clk = 1700000000000; Date.now = () => (clk += 7); let pn = 1000; performance.now = () => (pn += 3); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed: SEED }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
    try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
    const M = window.__d0 = { mem: { add: 0, capDrop: [0, 0, 0], catDrop: {}, other: 0 }, thoughts: {}, snaps: [], follow: null };
    // 跟拍：挑一位非重要人物（照名冊排序的第 N 位），當成玩家選中的人
    if (FOLLOW !== 'none') { const list = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId))); const a = list[+FOLLOW % list.length]; app.selectedAgent = a.agentId; M.follow = a.agentId; }
    // 記憶：包住 Memory.add，量容量上限與分類上限各刪了什麼（只計數，不改邏輯）
    const P = Memory.prototype, add0 = P.add;
    P.add = function (...args) {
      const before = this.entries.slice(); const r = add0.apply(this, args); M.mem.add++;
      if (before.length + 1 > this.entries.length) { const keep = new Set(this.entries); for (const e of before) if (!keep.has(e)) { const imp = e.importance || 0; const cat = e.category; const capCut = before.length + 1 > this.capacity && before.indexOf(e) < before.length + 1 - this.capacity; if (capCut) M.mem.capDrop[imp >= 7 ? 2 : imp >= 4 ? 1 : 0]++; else M.mem.catDrop[cat] = (M.mem.catDrop[cat] || 0) + 1; } }
      return r;
    };
    // 想法：包住 addThought 計數
    try { const A = Agent.prototype, at0 = A.addThought; A.addThought = function (kind, ...rest) { M.thoughts[kind] = (M.thoughts[kind] || 0) + 1; return at0.call(this, kind, ...rest); }; } catch (e) {}
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    M.memTotal = () => npcs().reduce((s, a) => s + (a.memory?.entries?.length || 0), 0);
    M.snap = (d) => {
      const ns = npcs(); const aff = [], tru = [], rom = [];
      for (const a of ns) for (const r of Object.values(a.relationships?.relationships || {})) { aff.push(r.affinity || 0); tru.push(r.trust || 0); rom.push(r.romanticInterest || 0); }
      const q = (arr, p) => { if (!arr.length) return null; const s2 = arr.slice().sort((x, y) => x - y); return s2[Math.min(s2.length - 1, Math.floor(p * s2.length))]; };
      const share = (arr, f) => arr.length ? Math.round(arr.filter(f).length / arr.length * 1000) / 10 : 0;
      const moods = ns.map(a => a.mood ?? 50);
      let N = new Set(); try { N = CROWD.notable(w); } catch (e) {}
      const memN = ns.filter(a => N.has(a.agentId)).map(a => a.memory?.entries?.length || 0), memO = ns.filter(a => !N.has(a.agentId)).map(a => a.memory?.entries?.length || 0);
      const avg = (arr) => arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length * 10) / 10 : null;
      const F = M.follow && w.agents[M.follow]; const fol = F ? { notable: N.has(F.agentId), mem: F.memory?.entries?.length || 0, imp7: (F.memory?.entries || []).filter(e => (e.importance || 0) >= 7).length, rels: Object.keys(F.relationships?.relationships || {}).length, decisions: (w.decide?.log?.[F.agentId] || []).map(e => e.kind + ':' + e.id).join(' ') } : null;
      return { day: d, pop: ns.length, rels: aff.length,
        affinity: { mean: avg(aff), p10: q(aff, 0.1), p50: q(aff, 0.5), p90: q(aff, 0.9), closeFriend: share(aff, x => x >= 61), friend: share(aff, x => x >= 21 && x < 61), neutral: share(aff, x => x > -20 && x < 21), rival: share(aff, x => x <= -20 && x > -60), enemy: share(aff, x => x <= -60) },
        trust: { mean: avg(tru), p10: q(tru, 0.1), p90: q(tru, 0.9) }, crush: share(rom, x => x > 50),
        likeButDistrust: (() => { let n = 0, m = 0; for (const a of ns) for (const r of Object.values(a.relationships?.relationships || {})) { if ((r.affinity || 0) >= 21) { m++; if ((r.trust || 0) < 0) n++; } } return m ? Math.round(n / m * 1000) / 10 : 0; })(),
        mood: { mean: avg(moods), p10: q(moods, 0.1), p90: q(moods, 0.9) },
        notable: N.size, memNotable: avg(memN), memOrdinary: avg(memO), memTotal: M.memTotal(), follow: fol };
    };
    M.snaps.push(M.snap(0)); M.lastTotal = M.memTotal(); M.lastAdd = 0; M.lastCut = 0;
  }, { TIER, SEED, FOLLOW });
  const t0 = Date.now();
  for (let d = 0; d < DAYS; d += 10) {
    const n = Math.min(10, DAYS - d);
    await page.evaluate(({ n, d }) => { const w = window.rimtownApp.world, M = window.__d0;
      for (let k = 0; k < n; k++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      // 其他機制刪掉的記憶 = 上次總數 + 這段新增 − 容量／分類上限刪的 − 現在總數
      const cut = M.mem.capDrop.reduce((x, y) => x + y, 0) + Object.values(M.mem.catDrop).reduce((x, y) => x + y, 0);
      const now = M.memTotal(); M.mem.other += Math.max(0, M.lastTotal + (M.mem.add - M.lastAdd) - (cut - M.lastCut) - now); M.lastTotal = now; M.lastAdd = M.mem.add; M.lastCut = cut;
      M.snaps.push(M.snap(d + n)); }, { n, d });
    process.stderr.write(`day ${d + n} ${Math.round((Date.now() - t0) / 1000)}s\n`);
  }
  const r = await page.evaluate(() => { const w = window.rimtownApp.world, M = window.__d0, X = w.decide || {};
    // 決策：每個選擇點各選項次數、最常見選項占比
    const byKind = {}; for (const [k, v] of Object.entries(X.pick || {})) { const [kind, opt] = k.split('.'); (byKind[kind] = byKind[kind] || {})[opt] = v; }
    const kinds = Object.entries(byKind).map(([kind, o]) => { const tot = Object.values(o).reduce((x, y) => x + y, 0); const top = Object.entries(o).sort((x, y) => y[1] - x[1])[0]; return { kind, total: tot, options: Object.keys(o).length, top: top[0], topShare: Math.round(top[1] / tot * 1000) / 10, dist: o }; }).sort((x, y) => y.total - x.total);
    // 同一人同一件事：紀錄裡同一人同一個選擇點出現兩次以上時，選的是否一樣（紀錄每人只留最近 5 筆，只能看近期）
    let same = 0, pairs = 0; for (const L of Object.values(X.log || {})) { const g = {}; for (const e of L) (g[e.kind] = g[e.kind] || []).push(e.id.split(':')[0]); for (const ids of Object.values(g)) for (let i = 1; i < ids.length; i++) { pairs++; if (ids[i] === ids[i - 1]) same++; } }
    return { town: w.townName, kinds, st: X.st, repeat: { pairs, same }, mem: M.mem, thoughts: M.thoughts, snaps: M.snaps, follow: M.follow };
  });
  r.days = DAYS; r.tier = TIER; r.seed = SEED; r.followArg = FOLLOW; r.errs = errs.slice(0, 10); r.sec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(OUT, JSON.stringify(r, null, 1));
  console.log(`wrote ${OUT}: ${r.kinds.length} kinds, pop ${r.snaps[r.snaps.length - 1].pop}, ${r.errs.length} errs, ${r.sec}s`);
  await browser.close();
})();
