// v6.83.0 舊機制大掃除:觀察者模式不再有任何「要你動手」或「把你當成鎮上的人」的殘留
// 選舉沒有投票／參選、日報沒有表態按鈕、探險不能手動派、動態牆只看不按讚留言、村民不主動傳訊息、節慶不邀你也不累積對你的好感、
// 提案贊助寫提案人、聲望不公告「你」、旅人不升級、沒有每日登入獎勵、舊的待決卡收掉不跳、新居民不花公庫、親手成就不頒、
// 人際關係不列你、教學是觀察者口吻、個人委託不跑、事件徵詢與防災由首長、搬家由兩人;中英、桌機與 390px
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.removeItem('rimtown_login_date'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(1200);
    const r = await page.evaluate(async (mob) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; w.observerMode = true;
      document.querySelectorAll('.modal-overlay,.rt-modal').forEach(m => m.remove());
      const out = {}; const root = () => document.getElementById('rimtown-app') || document.body;
      const logs = () => (w.messageLog || []).map(m => w.logText ? w.logText(m) : (m.content || '')).join('\n');
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const player = Object.values(w.agents).find(a => a.isPlayer);
      const render = async (tab) => { app.state = w.getState(); app.activeTab = tab; if (mob && app._openKairoTab) { try { app._openKairoTab(tab === 'events' ? 'records' : tab); } catch (e) {} } app.activeTab = tab; app.renderSidebar(); await new Promise(r => setTimeout(r, 250)); return root().innerHTML; };
      // 1) 選舉:投票期沒有投票按鈕、競選期沒有參選
      const E = w.election; E.active = true; E.phase = 'voting'; E.votingDaysLeft = 2; E.candidates = npcs.slice(0, 2).map(a => ({ agentId: a.agentId, name: a.name, votes: 1, policyIcon: '📜', policyLabel: 'x', speech: 'hi' }));
      let h = await render('events'); out.voteBtn = /data-action="player-vote"/.test(h);
      E.phase = 'campaign'; E.campaignDaysLeft = 2; h = await render('events'); out.runBtn = /run-for-mayor|想自己選鎮長|Want to run/.test(h);
      E.active = false; E.phase = 'none'; E.candidates = [];
      // 2) 日報沒有表態按鈕
      h = await render('events'); out.newsReact = /data-action="news-react"/.test(h);
      // 3) 探險不能手動派
      w.exploration.discoveredZones = w.exploration.discoveredZones || {}; const zid = Object.keys(window.EXPLORATION_ZONES || {})[0] || 'forest'; w.exploration.discoveredZones[zid] = { timesExplored: 1 };
      h = await render('events'); out.sendExp = /data-action="send-expedition"/.test(h);
      // 4) 動態牆只看
      w.townFeed = w.townFeed || { posts: [] }; if (!w.townFeed.posts.length) w.townFeed.posts.push({ id: 'p1', authorId: npcs[0].agentId, authorName: npcs[0].name, text: '今天天氣真好', likes: [], comments: [], day: 1, time: '08:00' });
      const box = document.createElement('div'); document.body.appendChild(box); app.renderTownFeed(box, ''); out.feedBtns = !!box.querySelector('[data-action="feed-like"],[data-action="feed-comment"]'); box.remove();
      // 5) 一整天:村民不主動傳訊息、不跑個人委託
      const chat0 = JSON.stringify(w.chatHistory || {}).length; const d0 = w._absDay(); let n = 0;
      for (let i = 0; i < 96 * 2 && w._absDay() - d0 < 1; i++) { w.paused = false; w.tick(); n++; } w.paused = true;
      await new Promise(r => setTimeout(r, 300));
      const L = logs(); out.proactive = (w.messageLog || []).filter(m => m.type === 'player_chat').length; out.quests = /個人任務|personal quest/i.test(L);
      // 6) 節慶不累積對你的好感
      const affP = (a) => a.relationships?.relationships?.player?.affinity || 0; const before = npcs.map(affP).join();
      w.festivals._boostRelationships(w, 1); out.festAff = npcs.map(affP).join() === before;
      // 7) 提案贊助寫提案人
      const msg = (w.festivals.sponsorWindow && w.festivals.sponsorWindow(w)) ? w.festivals.sponsor(w, npcs[0].name)?.msg || '' : '(no window)';
      out.sponsor = msg; out.sponsorYou = /你贊助|You sponsored/.test(msg);
      // 8) 聲望升級不公告「你」
      const rs = w.reputationSystem; if (rs) { rs._lastEffectTier = 0; rs.reputation = 999; try { rs.addReputation(1, 'test', w); } catch (e) { try { rs.dailyUpdate(w); } catch (e2) {} } }
      out.repYou = /聲望提升！你現在是|Reputation up/.test(logs());
      // 9) 旅人不升級
      const xp0 = w.growth ? (w.growth.total || 0) : 0; w.growth?.addXp?.(500, 'test', w); out.xp = w.growth ? (w.growth.total || 0) - xp0 : 0;
      // 10) 沒有每日登入獎勵
      const s0 = w.stockpile.get('silver'); localStorage.removeItem('rimtown_login_date'); app._checkDailyReward(); out.reward = Math.round(w.stockpile.get('silver') - s0);
      // 11) 舊存檔的待決卡收掉、不跳視窗
      let shown = 0; const o1 = app._showDecisionCard, o2 = app._showHelpCard; app._showDecisionCard = () => shown++; app._showHelpCard = () => shown++;
      w.dailyDecision.pendingDecision = { title: 'x', dayKey: 'old', optionA: { label: 'A' }, optionB: { label: 'B' } }; if (w.npcHelp) w.npcHelp.pendingRequest = { npcName: 'x', tick: 0, optionA: { label: 'A' }, optionB: { label: 'B' } };
      app._shownDecisionId = null; app._shownHelpId = null; app._checkV4Notifications(); out.legacyPopup = shown;
      w._autoResolveStaleChoices(); out.legacyCleared = !w.dailyDecision.pendingDecision && !(w.npcHelp?.pendingRequest);
      app._showDecisionCard = o1; app._showHelpCard = o2;
      // 12) 迎來新居民不花公庫
      if (w.customNPC) { w.stockpile.resources.silver = 0; w.stockpile.resources.food = 0; out.canCreate = w.customNPC.canCreate(w); const res = w.customNPC.createCustomNPC({ name: '新來的阿和', gender: 'male', age: 28, job: 'farmer', traits: ['kind'], values: [] }, w); out.created = !!res?.success; out.newFace = /新面孔|newcomer/.test(logs()); }
      // 13) 親手成就不頒
      app._unlockAchievement('player_farmer'); out.ach = app._unlockedAchievements.has('player_farmer');
      // 14) 人際關係不列你
      if (player) { npcs[0].relationships.getOrCreate(player.agentId, player.name).modifyAffinity(30); }
      app.selectedAgent = npcs[0].agentId; h = await render('detail'); out.relYou = player ? h.includes(`>${player.name}<`) || h.includes(t(player.name) + '</') : false;
      // 15) 教學是觀察者口吻
      const tut = document.getElementById('tutorial-overlay')?.textContent || ''; out.tutOld = /管理者|你的選擇，將塑造|完成任務獲得獎勵|投票選出你支持|派遣探險隊探索|As the manager/.test(tut);
      // 16) 事件徵詢、防災由首長
      w.eventChoice.offerChoice({ name: '盜匪來襲', description: 'x', severity: 'major', threat_level: 1, effects: {} }, w); w.paused = false; w.tick(); w.paused = true;
      w.weather._offerPrepChoice(w, '洪水'); w.paused = false; w.tick(); w.paused = true;
      const L2 = logs(); out.askYou = /來徵詢你的意見|你需要決定如何防災|asks for your view/.test(L2); out.decided = !w.eventChoice.pendingEvent;
      return out;
    }, mob);
    ok(!r.voteBtn && !r.runBtn, '選舉：沒有投票按鈕，也沒有「想自己選鎮長」', { vote: r.voteBtn, run: r.runBtn });
    ok(!r.newsReact, '日報沒有「調查／支持／忽略」表態按鈕', r.newsReact);
    ok(!r.sendExp, '探險不能手動派（由村民提案）', r.sendExp);
    ok(!r.feedBtns, '動態牆只看，沒有按讚留言按鈕', r.feedBtns);
    ok(r.proactive === 0, '一整天村民沒有主動傳訊息給你', r.proactive);
    ok(!r.quests, '不跑找玩家幫忙的個人委託', r.quests);
    ok(r.festAff, '節慶不再累積村民對你的好感', r.festAff);
    ok(!r.sponsorYou, '提案贊助節慶寫提案人，不寫「你贊助」', r.sponsor);
    ok(!r.repYou, '聲望升級不公告「你現在是…」', r.repYou);
    ok(r.xp === 0, '旅人等級不再累積（不會提示去選天賦）', r.xp);
    ok(r.reward === 0, '沒有每日登入獎勵塞進公庫', r.reward);
    ok(r.legacyPopup === 0 && r.legacyCleared, '舊存檔的每日決策／求助卡不跳出來並會被收掉', { popup: r.legacyPopup, cleared: r.legacyCleared });
    if (r.canCreate !== undefined) ok(r.canCreate && r.created && r.newFace, '迎來新居民不花公庫（公庫 0 也可以），日誌寫新面孔搬進來', r);
    ok(!r.ach, '「親手種植」這類成就不頒給觀察者', r.ach);
    ok(!r.relYou, '村民的人際關係不列出你', r.relYou);
    ok(!r.tutOld, '教學說明是觀察者口吻（沒有「管理者」「投票選出你支持的」）', r.tutOld);
    ok(!r.askYou && r.decided, '事件徵詢與防災由首長，不寫「來徵詢你」「你需要決定」', r);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
