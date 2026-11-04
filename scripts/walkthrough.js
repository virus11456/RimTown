// v6.27.0 觀察者走一遍(3D):用 app 自己的遊戲迴圈真跑一季,在關鍵時刻截圖(早安卡/提案分頁與批准/聊天/考驗/季末回顧/事件卡/日報)。
// 用法:node scripts/walkthrough.js <zh|en> <desktop|mobile> <outdir> [theme] [seasons]   需本機 http://127.0.0.1:8126 服務 wordpress/,且能 require('playwright')。
// 選跑、不進發版檢查;看截圖找版面與文案問題。v6.11.0–v6.22.4 的玩家版(委託/意圖/押商隊/天賦)已隨觀察者沙盒移除。
const { chromium } = require('playwright');
const fs = require('fs');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const [lang = 'zh', vp = 'desktop', OUT = '/tmp/walk', THEME = '', SEASONS = '1'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(Object.assign(exe ? { executablePath: exe } : {}, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }));
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
      if (/"p"/.test(p)) return json({ reply: lang === 'en' ? '{"p":"I have watched this town long enough to know we need it."}' : '{"p":"這件事我想了很久，鎮上真的需要。"}' });
      return json({ reply: lang === 'en' ? 'Fair enough. Let us talk again tomorrow.' : '好吧，這事我記下了，明天再聊。' });
    }
    return json({});
  });
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await sleep(4000);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const clearBlockers = () => ev(() => { let n = 0; for (let i = 0; i < 6; i++) { const ov = document.getElementById('center-notification-overlay'); if (!ov || ov.classList.contains('hidden')) break; const b = ov.querySelector('.decision-btn') || ov.querySelector('.center-notif-dismiss'); if (b) b.click(); else ov.classList.add('hidden'); n++; } const tm = document.getElementById('town-modal'); if (tm && !tm.classList.contains('hidden')) { tm.classList.add('hidden'); n++; } return n; });
  const shot = async (name) => { if (!/13_card/.test(name)) { const n = await clearBlockers(); if (n) await sleep(250); } const f = `${OUT}/${lang}_${vp}_${name}.png`; await page.screenshot({ path: f }); shots.push(name); };
  const openTab = (tab) => ev((tab) => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab(tab); else { const b = document.querySelector(`.rt-sidebar-tabs > button[data-tab="${tab}"]`); if (b) b.click(); else { app.activeTab = tab; app.renderSidebar(); } } }, tab);
  const pause = (v) => ev((v) => { window.rimtownApp.world.paused = v; }, v);
  const status = () => ev(() => { const app = window.rimtownApp; const w = app.world; const ov = document.getElementById('center-notification-overlay'); const pd = w.proposals?.toDict?.(w); return { card: !!(ov && !ov.classList.contains('hidden')), cardTitle: (ov && !ov.classList.contains('hidden')) ? (ov.querySelector('.center-notif-title')?.textContent || '').slice(0, 30) : '', day: w.clock.day, season: w.clock.season, hour: w.clock.hour, trial: w.trials?.current?.type || null, recap: !!document.getElementById('season-recap'), mc: !!document.getElementById('morning-card'), ev: !!w.eventChoice?.pendingEvent, open: pd?.open?.length || 0, made: pd?.stats?.made || 0, done: pd?.stats?.done || 0, silver: w.stockpile.get('silver'), is3d: !!app.renderer3d, low: !!app.tileMap?.lowQuality }; });
  if (THEME) await ev((theme) => { const app = window.rimtownApp; const w = new World(); w.townTheme = theme; w.rosterMode = 'scripted'; w.reset(); app.world = w; app.state = w.getState(); app._updateHeaderTownName?.(w.townName); app._generateTileMapLayout(); app._visitorMailboxTick(); app.startSimulation(); app.render(); }, THEME);
  const boot = await ev(() => { const app = window.rimtownApp; const w = app.world; if (!app.llmClient) app.llmClient = new LLMClient('server', 'server'); w.conversationEngine = app._makeConversationEngine(); app._updateLLMStatus?.(); return { theme: w.townTheme, name: w.townName, day: w.clock.day, pop: Object.values(w.agents).filter(a => !a.isPlayer).length, paused: w.paused, observer: !!w.observerMode, is3d: !!app.renderer3d }; });
  console.log('boot', JSON.stringify(boot));
  await shot('00_start'); await sleep(2500); await shot('01_town');
  await ev(() => { const app = window.rimtownApp; app.simSpeed = 10; app.restartSimulation(); });
  const done = new Set(); let seasonsSeen = 0; let lastSeason = null; let cards = 0; let iters = 0; const season0 = (await status()).season; let lastDay = boot.day; let idle = 0; const t0 = Date.now(); let decided = 0;
  // 觀察者:每天早上看提案,批准第一件、否決票數最差的一件(其餘讓它三天自動定案)
  const decideBot = () => ev(() => { const app = window.rimtownApp; const w = app.world; const ps = w.proposals; if (!ps) return 0; const open = ps.open(); let n = 0; if (open[0]) { ps.decide(w, open[0].id, 'approve'); n++; } const worst = open.slice(1).sort((a, b) => (Object.values(a.votes).filter(v => v === 'for').length - Object.values(a.votes).filter(v => v === 'against').length) - (Object.values(b.votes).filter(v => v === 'for').length - Object.values(b.votes).filter(v => v === 'against').length))[0]; if (worst) { ps.decide(w, worst.id, 'reject'); n++; } app.state = w.getState(); if (app.activeTab === 'proposals') app.renderSidebar(); app._updateProposalBadge?.(); return n; });
  while (Date.now() - t0 < (+process.env.BUDGET || 240000)) {
    await sleep(250); const s = await status(); iters++;
    if (s.card) { cards++; if (cards <= 4) { await sleep(400); await shot(`13_card_${cards}`); console.log('card', cards, s.cardTitle); } await ev(() => { const ov = document.getElementById('center-notification-overlay'); const b = ov.querySelector('.decision-btn') || ov.querySelector('.center-notif-dismiss'); if (b) b.click(); else ov.classList.add('hidden'); }); }
    if (s.recap && !done.has('recap' + s.season)) { done.add('recap' + s.season); const sp = s.season === season0 ? '' : 's2_'; await sleep(600); await shot(sp + '09_recap'); await ev(() => { document.querySelector('[data-action="recap-close"]')?.click(); }); }
    if (s.ev && !done.has('event')) { done.add('event'); await sleep(500); await shot('12_event_choice'); }
    if (s.day !== lastDay) {
      lastDay = s.day; idle = 0; console.log('day', s.season, s.day, JSON.stringify(s), Math.round((Date.now() - t0) / 1000) + 's');
      await sleep(900); await shot(`d${s.season === season0 ? 1 : 2}-${String(s.day).padStart(2, '0')}_morning`);
      if (s.day >= 2 && s.open > 0) {
        await pause(true); await openTab('proposals'); await sleep(500);
        if (!done.has('proposals')) { done.add('proposals'); await shot('02_proposals'); }
        decided += await decideBot(); await sleep(400);
        if (!done.has('decided')) { done.add('decided'); await shot('02b_proposals_decided'); }
        await pause(false);
      }
      if (s.day === 3 && !done.has('chat')) { done.add('chat'); await pause(true);
        const info = await ev(() => { const app = window.rimtownApp; const id = Object.keys(app.world.agents).find(k => k !== 'player'); app.startChatWith(id); return id; });
        await sleep(500); await shot('03_chat');
        await ev((lang) => { const i = document.getElementById('chat-input'); i.value = lang === 'en' ? 'How is the town treating you these days?' : '最近鎮上過得怎麼樣？'; window.rimtownApp._sendFromInput(); }, lang);
        await sleep(3500); await shot('03b_chat_reply'); console.log('chat', JSON.stringify(info)); await pause(false); }
      if (s.day === 4 && !done.has('villagers')) { done.add('villagers'); await pause(true); await openTab('residents'); await sleep(500); await shot('04_villagers'); await openTab('records'); await sleep(500); await shot('04b_daily'); await openTab('economy'); await sleep(500); await shot('04c_town'); await pause(false); }
      if (s.day === 5 && !done.has('trial' + s.season)) { done.add('trial' + s.season); const sp = s.season === season0 ? '' : 's2_'; await sleep(1500); await shot(sp + '06_trial_notice'); }
      if (s.day === 8 && !done.has('night')) { done.add('night'); await ev(() => { const a = window.rimtownApp; a.state.clock.hour = 21; }); await sleep(600); await shot('07_night'); }
      if (s.season !== lastSeason) { lastSeason = s.season; seasonsSeen++; }
      if (seasonsSeen > +SEASONS && s.day >= 2) break;
    } else if (++idle > 120) { console.log('stalled at', JSON.stringify(s)); break; }
  }
  const fin = await status(); console.log('final', JSON.stringify(fin), 'decided', decided);
  console.log('chatCalls', chatCalls.length, JSON.stringify(chatCalls.slice(0, 4)));
  console.log('shots', shots.join(',')); console.log('errors', JSON.stringify(errs.slice(0, 10)));
  await browser.close();
})();
