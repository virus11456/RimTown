// v6.11.0 新手走一遍:用 app 自己的遊戲迴圈真跑一季,在關鍵時刻截圖(早安卡/委託板/意圖判定/馬車站/考驗/選天賦/委託鏈/季末回顧/事件卡)。
// 用法:node scripts/walkthrough.js <zh|en> <desktop|mobile> <outdir> [theme] [seasons]   需本機 http://127.0.0.1:8126 服務 wordpress/,且 NODE_PATH 指到有 playwright 的 node_modules。
// 選跑、不進發版檢查;看截圖找版面與文案問題(v6.11.0 就是這樣抓到通知蓋側欄、回顧漏考驗、手機橫幅擠成一條)。
// node walk_test.js <lang> <desktop|mobile> <outdir>
const { chromium } = require('playwright');
const fs = require('fs');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const [lang = 'zh', vp = 'desktop', OUT = '/tmp/walk', THEME = '', SEASONS = '1'] = process.argv.slice(2); // 第 4 參數主題(harbor/mountain/forest/market),第 5 參數跑幾季
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const errs = []; const chatCalls = []; const shots = [];
  const ctx = await browser.newContext(vp === 'mobile' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/api/**', (route) => {
    const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false });
    if (u.includes('/api/saves')) return json({ saves: [] });
    if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404);
    if (u.includes('/api/settings')) return json({ settings: {} });
    if (u.includes('/api/chat')) {
      let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      const p = b.prompt || ''; chatCalls.push(p.slice(0, 80));
      if (/JSON/.test(p) && /"s"/.test(p)) return json({ reply: lang === 'en' ? '{"s":1,"r":"honest and warm"}' : '{"s":1,"r":"誠懇，也顧到對方面子"}' });
      if (/"q"/.test(p)) return json({ reply: lang === 'en' ? '{"q":["I have kept this for years.","Read it for me, I cannot.","I should dress properly.","Thank you, I owe you this trip."]}' : '{"q":["那封信……我放了十年了。","你念，我聽，我怕自己念不下去。","總得穿得體面些去見她。","謝謝你，這一趟我欠你的。"]}' });
      return json({ reply: lang === 'en' ? 'Fair enough. Let us talk again tomorrow.' : '好吧，這事我記下了，明天再聊。' });
    }
    return json({});
  });
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await sleep(3500);
  const clearBlockers = () => ev(() => { let n = 0; for (let i = 0; i < 6; i++) { const ov = document.getElementById('center-notification-overlay'); if (!ov || ov.classList.contains('hidden')) break; const b = ov.querySelector('.decision-btn') || ov.querySelector('.center-notif-dismiss'); if (b) b.click(); else ov.classList.add('hidden'); n++; } const tm = document.getElementById('town-modal'); if (tm && !tm.classList.contains('hidden')) { tm.classList.add('hidden'); n++; } return n; });
  const shot = async (name) => { if (!/13_card/.test(name)) { const n = await clearBlockers(); if (n) await sleep(250); } const f = `${OUT}/${lang}_${vp}_${name}.png`; await page.screenshot({ path: f }); shots.push(name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const openQuest = () => ev((vp) => { const app = window.rimtownApp; if (vp === 'mobile') app._openKairoTab('quest'); else { const b = document.querySelector('[data-tab="quest"]'); if (b) b.click(); else { app.activeTab = 'quest'; app.renderSidebar(); } } }, vp);
  const pause = (v) => ev((v) => { window.rimtownApp.world.paused = v; }, v);
  const status = () => ev(() => { const app = window.rimtownApp; const w = app.world; const ov = document.getElementById('center-notification-overlay'); return { card: !!(ov && !ov.classList.contains('hidden')), cardTitle: (ov && !ov.classList.contains('hidden')) ? (ov.querySelector('.center-notif-title')?.textContent || '').slice(0, 30) : '', day: w.clock.day, season: w.clock.season, hour: w.clock.hour, pending: w.growth?.pending?.length || 0, trial: w.trials?.current?.type || null, chain: w.requests?.chain?.key || null, recap: !!document.getElementById('season-recap'), mc: !!document.getElementById('morning-card'), guide: !!document.querySelector('.firstday-guide'), ev: !!w.eventChoice?.pendingEvent, open: w.requests?.openCount?.() || 0, ap: w.requests?.ap?.left, lvl: w.growth?.level, silver: w.stockpile.get('silver') }; });
  // 起手：確認是全新邊境鎮，接上 AI
  if (THEME) await ev((theme) => { const app = window.rimtownApp; const w = new World(); w.townTheme = theme; w.rosterMode = 'scripted'; w.reset(); app.world = w; app.state = w.getState(); app._updateHeaderTownName?.(w.townName); app._generateTileMapLayout(); app._visitorMailboxTick(); app.startSimulation(); app.render(); }, THEME);
  const boot = await ev(() => { const app = window.rimtownApp; const w = app.world; if (!app.llmClient) app.llmClient = new LLMClient('server', 'server'); w.conversationEngine = app._makeConversationEngine(); app._updateLLMStatus?.(); return { theme: w.townTheme, name: w.townName, day: w.clock.day, pop: Object.values(w.agents).filter(a => !a.isPlayer).length, paused: w.paused, landing: !!document.querySelector('.landing:not(.hidden)') }; });
  console.log('boot', JSON.stringify(boot));
  await shot('00_start'); await sleep(2500); await shot('01_firstday');
  await ev(() => { const app = window.rimtownApp; app.simSpeed = 10; app.restartSimulation(); });
  const done = new Set(); let seasonsSeen = 0; let lastSeason = null; let cards = 0; let iters = 0; const season0 = (await status()).season; let lastDay = boot.day; let idle = 0; const t0 = Date.now();
  const playBot = () => ev(() => { // 像玩家一樣完成兩件委託（讓委託鏈有機會開）
    const app = window.rimtownApp; const w = app.world; const rb = w.requests; const P = w.agents.player; let n = 0;
    for (const rq of rb.board) { if (rq.status !== 'open' || n >= 2) continue; const npc = w.agents[rq.npcId]; if (!npc) continue; n++;
      if (rq.type === 'visit') rb.onChat(rq.npcId, w); else if (rq.type === 'gift') rb.onGift(rq.npcId, w);
      else if (rq.type === 'deliver') { P.currentLocation = npc.currentLocation; if ((w.stockpile.get(rq.res) || 0) < rq.amount) w.stockpile.add(rq.res, rq.amount); rb.act(rq.id, w); }
      else if (rq.type === 'fetch') { rb.onVisit(rq.loc, w); P.currentLocation = npc.currentLocation; rb.act(rq.id, w); }
      else if (rq.type === 'mediate') { rb.onChat(rq.npcId, w); rb.onChat(rq.otherId, w); P.currentLocation = npc.currentLocation; rb.act(rq.id, w); }
      const rel = npc.relationships.getOrCreate('player', 'P'); rel.affinity = Math.max(rel.affinity, 20);
    }
    const tr = w.trials?.current; if (tr && tr.status === 'active' && tr.type === 'bandits') { for (const key of ['training_ground', 'watchtower']) { const tpl = BUILDING_TEMPLATES[key]; if (!tpl || w.buildings.projects.some(p => p.key === key) || w.buildings.completed.includes(key)) continue; if (Object.entries(tpl.costs).every(([r, k]) => (w.stockpile.get(r) || 0) >= k)) { try { w.buildings.startProject(key, w, { x: 10, y: 10 }); } catch (e) {} } } }
    w.growth.addXp(18, 'request', w); return n; });
  while (Date.now() - t0 < (+process.env.BUDGET || 240000)) {
    await sleep(250); const s = await status(); iters++;
    if (s.card) { cards++; if (cards <= 4) { await sleep(400); await shot(`13_card_${cards}`); console.log('card', cards, s.cardTitle); } await ev(() => { const ov = document.getElementById('center-notification-overlay'); const b = ov.querySelector('.decision-btn') || ov.querySelector('.center-notif-dismiss'); if (b) b.click(); else { ov.classList.add('hidden'); window.rimtownApp._notifCardOpen = false; window.rimtownApp.world.paused = false; } }); await sleep(300); continue; }
    if (s.recap && !done.has('recap' + s.season)) { done.add('recap' + s.season); const sp = s.season === season0 ? '' : 's2_'; await sleep(600); await shot(sp + '09_recap'); const go = await ev(() => { const b = document.querySelector('#season-recap [data-action="recap-go"]'); if (!b) return null; const v = b.dataset.val; b.click(); return v; }); console.log('recap-go', go); await sleep(900); await shot(sp + '10_recap_go'); await ev(() => { document.getElementById('season-recap')?.remove(); document.getElementById('caravan-dialog')?.remove(); }); }
    if (s.pending && !done.has('perk')) { done.add('perk'); await pause(true); await openQuest(); await sleep(500); await shot('08_perk_offer'); await ev(() => { const b = document.querySelector('[data-action="perk-pick"]'); if (b) b.click(); }); await sleep(500); await shot('08b_perk_picked'); await pause(false); }
    if (s.chain && !done.has('chain')) { done.add('chain'); await sleep(2500); await pause(true); await openQuest(); await sleep(500); await shot('11_chain_board'); await pause(false); }
    if (s.ev && !done.has('event')) { done.add('event'); await sleep(500); await shot('12_event_choice'); }
    if (s.day !== lastDay) {
      lastDay = s.day; idle = 0; console.log('day', s.season, s.day, JSON.stringify(s), Math.round((Date.now() - t0) / 1000) + 's');
      await sleep(900); await shot(`d${s.season === season0 ? 1 : 2}-${String(s.day).padStart(2, '0')}_morning`);
      if (s.day === 2 && !done.has('board')) { done.add('board'); await pause(true); await openQuest(); await sleep(500); await shot('02_board');
        const info = await ev(() => { const app = window.rimtownApp; const rq = app.world.requests.board.find(r => r.status === 'open'); if (!rq) return null; app.chatTarget = rq.npcId; app.activeTab = 'chat'; if (window.innerWidth < 700) app._openKairoTab('chat'); else app.renderSidebar(); return { type: rq.type, npc: rq.npcId }; });
        await sleep(500); await shot('03_chat');
        await ev(() => { const b = document.querySelector('.chat-intent-btn[data-val="persuade"]') || document.querySelector('.chat-intent-btn'); b?.click(); }); await sleep(400); await shot('03b_intent_armed');
        await ev((lang) => { const i = document.getElementById('chat-input'); i.value = lang === 'en' ? 'I know you care about the kids here; this helps them most.' : '我知道你最在乎鎮上的孩子，這件事對他們最好。'; window.rimtownApp._sendFromInput(); }, lang); await sleep(3500); await shot('04_judged');
        console.log('chat', JSON.stringify(info)); await pause(false); }
      if (s.day === 3 && !done.has('caravan')) { done.add('caravan'); await pause(true); await ev(() => window.rimtownApp._showCaravanDialog()); await sleep(500); await shot('05_caravan');
        const r = await ev(() => { const d = document.getElementById('caravan-dialog'); const btn = d?.querySelector('.pc-go'); if (!btn) return 'no-go:' + (d?.textContent || '').slice(0, 60); const txt = btn?.textContent; btn?.click(); return txt; }); console.log('caravan launch btn', r, 'otherTowns', await ev(() => JSON.stringify((window.rimtownApp.world.otherTowns || []).map(x => x.name)) + ' list=' + JSON.stringify(window.rimtownApp._getTownList().map(x => x.name)))); await sleep(600); await shot('05b_caravan_after'); await ev(() => document.getElementById('caravan-dialog')?.remove()); await pause(false); }
      if (s.day === 9 && !done.has('towns9')) { done.add('towns9'); console.log('day9 otherTowns', await ev(() => JSON.stringify((window.rimtownApp.world.otherTowns || []).map(x => x.name)) + ' list=' + JSON.stringify(window.rimtownApp._getTownList().map(x => x.name)))); }
      if (s.day === 5 && !done.has('trial' + s.season)) { done.add('trial' + s.season); const sp = s.season === season0 ? '' : 's2_'; await sleep(1500); await shot(sp + '06_trial_notice'); await pause(true); await openQuest(); await sleep(500); await shot(sp + '07_trial_block'); await pause(false); }
      if (s.day >= 2) { const n = await playBot(); if (s.day === 2) console.log('bot did', n); }
      if (s.day >= 3 && !done.has('caravan_go')) { const can = await ev(() => { const w = window.rimtownApp.world; return !!(w.otherTowns && w.otherTowns.length) && !w.playerCaravan?.active && ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'tools'].some(r => (w.stockpile.get(r) || 0) >= 10); });
        if (can) { done.add('caravan_go'); await pause(true); await ev(() => window.rimtownApp._showCaravanDialog()); await sleep(500); await shot('05c_caravan_ready'); const r = await ev(() => { const d = document.getElementById('caravan-dialog'); const b = d?.querySelector('.pc-go'); const q = d?.querySelector('#pc-quote')?.textContent; b?.click(); return { quote: (q || '').slice(0, 80), active: !!window.rimtownApp.world.playerCaravan?.active }; }); console.log('caravan launched', JSON.stringify(r)); await sleep(500); await shot('05d_caravan_launched'); await ev(() => document.getElementById('caravan-dialog')?.remove()); await pause(false); } }
      if (s.season !== lastSeason) { lastSeason = s.season; seasonsSeen++; }
      if (seasonsSeen > +SEASONS && s.day >= 2) break; // 跑完指定季數,下一季第 2 天收工
    } else if (++idle > 120) { console.log('stalled at', JSON.stringify(s)); break; }
  }
  const fin = await status(); console.log('final', JSON.stringify(fin));
  console.log('chatCalls', chatCalls.length, JSON.stringify(chatCalls.slice(0, 6)));
  console.log('shots', shots.join(',')); console.log('errors', JSON.stringify(errs.slice(0, 10)));
  await browser.close();
})();
