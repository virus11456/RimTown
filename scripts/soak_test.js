#!/usr/bin/env node
// v5.96.0 核心玩法迴圈浸泡測試(選跑;需要 playwright 與本機 http server):
//   cd wordpress && python3 -m http.server 8126 &  ;  node scripts/soak_test.js [http://127.0.0.1:8126] [days=35] [theme=frontier]
// 用真正的 world.tick() 跑 N 天,每天像玩家一樣做委託/押商隊/聊天意圖/選天賦,每 10 天存檔讀檔接著跑;
// 檢查:無 page error、物資皆有限數、委託板/考驗/成長/商隊都有在動、getState 可序列化、讀檔後能繼續。
const BASE = process.argv[2] || 'http://127.0.0.1:8126';
const DAYS = parseInt(process.argv[3] || '35', 10);
const THEME = process.argv[4] || 'frontier';
const MODE = process.argv[5] || 'full'; // v6.2.0 full=機器人全做(上限) / casual=每天最多 2 件委託、不作弊補貨、4 天一趟商隊、1 次對話 / idle=只看不玩(觀察者)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('playwright 未安裝:npm i playwright@1 後再跑'); process.exit(0); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const consoleErrs = []; page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)); });
  await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); if (u.includes('/api/chat')) return json({ error: 'mock' }, 500); return json({}); });
  await page.addInitScript(({ jwt }) => { try { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); } catch (e) {} }, { jwt });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rimtownApp && typeof World === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const t0 = Date.now();
  const r = await page.evaluate(async ({ DAYS, THEME, MODE }) => {
    const app = window.rimtownApp; const out = { days: 0, errors: [], warn: [] };
    const NAMES = { frontier: '邊境鎮', harbor: '海風鎮', mountain: '礦山鎮', forest: '林間村', market: '市集城' };
    let w = new World(); w.townTheme = THEME; w.townName = NAMES[THEME]; w.rosterMode = 'scripted'; w.reset();
    app.world = w; app.currentTownId = 'soak'; app.state = w.getState(); app._generateTileMapLayout(); app._visitorMailboxTick();
    w.otherTowns = [{ id: 'o1', name: THEME === 'market' ? '礦山鎮' : '市集城' }, { id: 'o2', name: THEME === 'harbor' ? '礦山鎮' : '海風鎮' }];
    w.paused = false;
    const start = { silver: w.stockpile.get('silver') || 0, pop: Object.values(w.agents).filter(a => !a.isPlayer).length };
    const stats = { requestsDone: 0, caravans: 0, chats: 0, perks: 0, trialsSeen: new Set(), maxLevel: 1, visitorsSeen: 0, roundTrips: 0 };
    const finite = (o) => Object.values(o || {}).every(v => typeof v !== 'number' || Number.isFinite(v));
    const RES = ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'tools', 'silver'];
    const playDay = (d) => {
      const P = w.agents.player; const rb = w.requests;
      if (MODE === 'idle') { stats.maxLevel = Math.max(stats.maxLevel, w.growth?.level || 1); if (w.trials?.current) stats.trialsSeen.add(w.trials.current.type); return; }
      // 委託:full 能做的都做;casual 每天最多 2 件、不作弊補貨
      let budget = MODE === 'casual' ? 2 : 99;
      for (const rq of (rb?.board || [])) {
        if (rq.status !== 'open') continue; if (budget <= 0) break;
        if (MODE === 'casual' && rq.type === 'deliver' && (w.stockpile.get(rq.res) || 0) < rq.amount) continue;
        budget--;
        const npc = w.agents[rq.npcId]; if (!npc) continue;
        if (rq.type === 'visit') rb.onChat(rq.npcId, w);
        else if (rq.type === 'gift') rb.onGift(rq.npcId, w);
        else if (rq.type === 'fetch') { rb.onVisit(rq.loc, w); P.currentLocation = npc.currentLocation; const r = rb.act(rq.id, w); if (r.ok) stats.requestsDone++; }
        else if (rq.type === 'deliver') { P.currentLocation = npc.currentLocation; if ((w.stockpile.get(rq.res) || 0) < rq.amount) w.stockpile.add(rq.res, rq.amount); const r = rb.act(rq.id, w); if (r.ok) stats.requestsDone++; }
        else if (rq.type === 'mediate') { rb.onChat(rq.npcId, w); rb.onChat(rq.otherId, w); P.currentLocation = npc.currentLocation; const r = rb.act(rq.id, w); if (r.ok) stats.requestsDone++; }
      }
      stats.requestsDone += (rb?.board || []).filter(r => r.status === 'done' && r.type !== 'fetch' && r.type !== 'deliver' && r.type !== 'mediate').length;
      // 押商隊
      if (!w.playerCaravan?.active && (MODE !== 'casual' || d % 4 === 0)) { const res = RES.find(r => r !== 'silver' && (w.stockpile.get(r) || 0) >= 30); if (res) { const g = w.availableGuards()[0]; const r = w.launchPlayerCaravan({ toTownId: 'o1', toTownName: w.otherTowns[0].name, toTheme: typeof themeKeyOfTownName === 'function' ? themeKeyOfTownName(w.otherTowns[0].name) : 'market', res, amount: 20, guardId: Math.random() < 0.5 && g ? g.agentId : null, route: Math.random() < 0.5 ? 'road' : 'mountain' }); if (r.ok) stats.caravans++; } }
      // 聊天意圖(直接套後果)
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer); const keys = ['comfort', 'gossip', 'persuade', 'mediate', 'flirt', 'request', 'help', 'bargain'];
      for (let i = 0; i < (MODE === 'casual' ? 1 : 2) && npcs.length; i++) { const npc = npcs[Math.floor(Math.random() * npcs.length)]; const k = keys[Math.floor(Math.random() * keys.length)]; const o = w.chatOdds(npc, k); app._applyChatIntent(npc, P, k, { ok: Math.random() < o.p, p: o.p }); stats.chats++; }
      // v6.2.0 為本季考驗出力(像玩家會做的事):糧荒→跟務農/廚子求助;瘟疫→跟醫生/學者/牧師求助;匪患→蓋訓練場/瞭望塔;壓價→押商隊(上面已做)
      const tr = w.trials?.current; if (tr && tr.status === 'active') {
        const K = MODE === 'casual' ? 1 : 3; const dayKey = `${w.clock.year}-${w.clock.season}-${w.clock.day}`;
        const askJobs = tr.type === 'famine' ? (a) => !['miner', 'blacksmith', 'carpenter', 'doctor', 'researcher', 'priest', 'tailor', 'trader', 'guard', 'mayor'].includes(a.job?.key) : tr.type === 'plague' ? (a) => ['doctor', 'researcher', 'priest'].includes(a.job?.key) : null;
        if (askJobs) { const cands = npcs.filter(a => askJobs(a) && a._lastHelpDay !== dayKey).slice(0, K); for (const npc of cands) { const o = w.chatOdds(npc, 'help'); app._applyChatIntent(npc, P, 'help', { ok: Math.random() < o.p, p: o.p }); stats.chats++; } }
        if (tr.type === 'bandits' && w.trials.value('bandits', w) < tr.target) { for (const key of ['training_ground', 'watchtower']) { const tpl = BUILDING_TEMPLATES[key]; if (!tpl || w.buildings.projects.some(p => p.key === key) || w.buildings.completed.includes(key)) continue; if (Object.entries(tpl.costs).every(([r, n]) => (w.stockpile.get(r) || 0) >= n)) { try { w.buildings.startProject(key, w, { x: 10, y: 10 }); stats.built = (stats.built || 0) + 1; } catch (e) {} break; } } }
      }
      // 選天賦
      while (w.growth?.pending?.length) { w.growth.choose(w.growth.pending[0], w); stats.perks++; }
      stats.maxLevel = Math.max(stats.maxLevel, w.growth?.level || 1);
      if (w.trials?.current) stats.trialsSeen.add(w.trials.current.type);
      stats.visitorsSeen += Object.keys(w.visitors || {}).length;
    };
    for (let d = 0; d < DAYS; d++) {
      for (let k = 0; k < 96; k++) { try { w.tick(); } catch (e) { out.errors.push(`day${d} tick: ${e.message}`); break; } }
      try { playDay(d); } catch (e) { out.errors.push(`day${d} play: ${e.message}`); }
      try {
        app.state = w.getState(); JSON.stringify(app.state);
        for (const fn of ['renderQuest', 'renderEconomy', 'renderNewspaper']) { const div = document.createElement('div'); app[fn](div); }
        app.selectedAgent = Object.keys(w.agents).find(k => k !== 'player'); const dd = document.createElement('div'); app.renderAgentDetail(dd);
        app._updateQuestGuidance();
      } catch (e) { out.errors.push(`day${d} render: ${e.message}`); }
      for (const r of RES) { const v = w.stockpile.get(r); if (!Number.isFinite(v) || v < 0) out.errors.push(`day${d} stock ${r}=${v}`); }
      if (!finite(w.requests?.ap) || !finite(w.growth ? { xp: w.growth.xp, level: w.growth.level } : {})) out.errors.push(`day${d} non-finite state`);
      if (Object.values(w.agents).filter(a => !a.isPlayer).length < 5) out.errors.push(`day${d} population collapsed`);
      if ((d + 1) % 10 === 0) { // 存檔讀檔接著跑
        try { const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob); w2.paused = false; app.world = w2; w = w2; app._visitorMailboxTick(); w.otherTowns = blob.otherTowns || w.otherTowns || [{ id: 'o1', name: '市集城' }]; stats.roundTrips++; } catch (e) { out.errors.push(`day${d} roundtrip: ${e.message}`); }
      }
      out.days = d + 1;
    }
    out.stats = { ...stats, trialsSeen: [...stats.trialsSeen], trialHistory: w.trials?.history?.length || 0, recaps: w.recap?.history?.length || 0, saveBytes: JSON.stringify(w.serialize()).length, stateBytes: JSON.stringify(w.getState()).length, recapGrades: (w.recap?.history || []).map(h => h.grade), trials: (w.trials?.history || []).map(h => `${h.type}:${h.status}:${h.value}/${h.target}`), silver: [start.silver, w.stockpile.get('silver') || 0], pop: [start.pop, Object.values(w.agents).filter(a => !a.isPlayer).length], reqExpired: w.requests?.stats?.failed || 0, movedOut: (w.movedOut || []).length, mode: MODE, perksOwned: w.growth?.perks?.length || 0, level: w.growth?.level, caravanHistory: w.playerCaravan?.history?.length || 0, requestsStats: w.requests?.stats, movedOut: (w.movedOut || []).length, population: Object.values(w.agents).filter(a => !a.isPlayer).length, prosperity: w.prosperity?.prosperity, clock: `${w.clock.year}-${w.clock.season}-${w.clock.day}`, ending: w.multiEnding?.endingTriggered || null };
    return out;
  }, { DAYS, THEME, MODE });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[soak ${THEME}] ${r.days} days in ${secs}s`);
  console.log(JSON.stringify(r.stats));
  let failed = 0;
  const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failed++; };
  check(r.days === DAYS, `跑滿 ${DAYS} 天`);
  check(r.errors.length === 0, `無模擬/渲染/狀態錯誤 ${JSON.stringify(r.errors.slice(0, 5))}`);
  check(errs.length === 0, `無 page error ${JSON.stringify(errs.slice(0, 3))}`);
  if (MODE !== 'idle') check(r.stats.requestsStats && r.stats.requestsStats.done > 0, `委託有完成 (${r.stats.requestsStats?.done})`);
  if (MODE !== 'idle') check(r.stats.caravanHistory > 0, `商隊有回報 (${r.stats.caravanHistory})`);
  check(r.stats.trialHistory > 0 || r.stats.trialsSeen.length > 0, `季度考驗有公布/結算 (${r.stats.trialHistory})`);
  if (MODE !== 'idle') check(r.stats.level > 1, `旅人有升級 (Lv.${r.stats.level})`);
  check(DAYS < 16 || r.stats.recaps >= Math.floor((DAYS - 1) / 15), `季末回顧有結算 (${r.stats.recaps} 季：${(r.stats.recapGrades || []).join(' ')})`); // v5.98.0
  check(r.stats.roundTrips >= Math.floor(DAYS / 10), `存檔讀檔接著跑 ${r.stats.roundTrips} 次`);
  check(r.stats.population >= 5, `人口 ${r.stats.population}`);
  check(r.stats.saveBytes < 1500000, `存檔體積 ${(r.stats.saveBytes / 1024).toFixed(0)} KB（getState ${(r.stats.stateBytes / 1024).toFixed(0)} KB；手機 localStorage 約 5MB）`); // v5.99.0 B12
  if (consoleErrs.length) console.log('  (console errors)', consoleErrs.slice(0, 5));
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL OK'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
