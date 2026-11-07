// v6.86.0 典禮:葬禮(配偶主辦、兩天後在墓園、認識的人走去送行、悼詞、記憶、沒來的至親過意不去、墓碑記送行人數、沒交情也有人送)、
// 名人過世的公費葬禮提案(家屬／議員提、通過後改成全鎮送行)、忌日祭拜;婚禮(決定結婚後訂婚期、當天賓客到廣場、好友致詞、禮金、前任鬧場)、
// 結婚不再一次辦完;地點卡顯示典禮;存讀檔;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      w.reset(); w.observerMode = true;
      const out = {}; const logs = () => (w.messageLog || []).map(m => w.logText ? w.logText(m) : (m.content || ''));
      const step = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } w.paused = true; };
      const alive = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const mayor = w.election._officeHolder(w);
      // ---- 葬禮:有配偶的人過世
      const pool = alive().filter(a => a !== mayor);
      const d = pool[0], spouse = pool[1], friends = pool.slice(2, 7), absent = pool[7];
      const rs = spouse.relationships.getOrCreate(d.agentId, d.name), rd = d.relationships.getOrCreate(spouse.agentId, spouse.name); rs.status = 'married'; rd.status = 'married'; rs.affinity = 90;
      for (const f of friends) f.relationships.getOrCreate(d.agentId, d.name).affinity = 60;
      absent.relationships.getOrCreate(d.agentId, d.name).affinity = 80; // 好友,但當天出遠門
      w.lifecycle._killNpc(w, d);
      const c = w.ceremony.list.find(x => x.of === d.agentId);
      out.plan = { host: c?.host === spouse.agentId, loc: c?.loc, inDays: c ? c.day - w._absDay() : null, log: logs().filter(x => /⚱️/.test(x)).slice(-1)[0] || '' };
      // 讓好友出遠門(從鎮上移除)
      const absentAgent = w.agents[absent.agentId]; delete w.agents[absent.agentId];
      let atGrave = 0; for (let i = 0; i < 96 * 4 && c.status !== 'held'; i++) { step(1); if (c.status === 'ongoing') atGrave = Math.max(atGrave, Object.values(w.agents).filter(a => a._ceremony?.id === c.id && a.targetLocation === 'graveyard').length); }
      w.agents[absent.agentId] = absentAgent;
      out.held = { status: c.status, guests: (c.guests || []).length, atGrave, speaker: c.speaker, spouseCame: (c.guests || []).includes(spouse.agentId), speech: c.speech };
      const mtxt = (a) => (a.memory?.entries || []).map(e => (typeof Memory !== 'undefined' && Memory.render) ? Memory.render(e.k || e.key, e.p || e.params) || e.content : e.content).join('|');
      out.memSpouse = /葬禮|funeral/.test(mtxt(spouse)); out.farewell = (w.lifecycle.graveyard.slice().reverse().find(g => g.name === d.name) || {}).farewell;
      out.cleared = Object.values(w.agents).filter(a => a._ceremony).length;
      out.heldLog = logs().filter(x => /⚱️/.test(x)).slice(-1)[0] || '';
      // 沒交情也有人送
      const lonely = alive().find(a => a !== mayor && a !== spouse && !friends.includes(a));
      for (const o of alive()) { const r = o.relationships.relationships[lonely.agentId]; if (r) r.affinity = 0; }
      w.lifecycle._killNpc(w, lonely); const c2 = w.ceremony.list.find(x => x.of === lonely.agentId);
      for (let i = 0; i < 96 * 4 && c2.status !== 'held'; i++) step(1); out.lonelyGuests = (c2.guests || []).length;
      // ---- 公費葬禮:現任首長過世
      for (const f of alive().filter(a => a !== mayor).slice(0, 2)) f.relationships.getOrCreate(mayor.agentId, mayor.name).affinity = 60; // 首長的朋友
      TIERS.track(w); w.lifecycle._killNpc(w, mayor); const c3 = w.ceremony.list.find(x => x.of === mayor.agentId);
      const ps = w.proposals; const day = ps._abs(w); const cand = (ps._candidates(w, day) || []).find(x => x.kind === 'funeral');
      out.pubCand = !!cand;
      if (cand) { const pr = ps._create(w, day, cand); out.pubTitle = pr ? ps.title(pr) : ''; out.pubProposerOk = pr ? (c3.family.concat(c3.close).includes(pr.proposerId) || (w.council?.members || []).includes(pr.proposerId) || w.agents[pr.proposerId]?.job?.key === 'priest' || (w.agents[pr.proposerId]?.relationships?.relationships?.[mayor.agentId]?.affinity || 0) > 30) : false;
        w.stockpile.resources.silver = 999; if (pr) ps._decide(w, pr, 'approve', 'mayor'); out.pub = { status: pr?.status, scale: c3.scale, public: c3.public }; }
      // ---- 忌日:隔年同一天
      const before = (w.ceremony.anniv || []).length; const x = w.ceremony.anniv.find(a => a.name === d.name);
      if (x) { const si = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season); x.doy = Math.max(0, si) * 15 + w.clock.day; x.year = w.clock.year - 1; w.ceremony.lastDay = null; spouse._mourningTargets = []; CEREMONY.tick(w); }
      out.anniv = { n: before, mourn: (spouse._mourningTargets || []).some(m => m.name === d.name), log: logs().filter(l => /忌日|anniversary/.test(l)).slice(-1)[0] || '' };
      // ---- 婚禮
      const [A, B] = alive().slice(0, 2); const guests = alive().slice(2, 8);
      for (const g of guests) { g.relationships.getOrCreate(A.agentId, A.name).affinity = 60; if (typeof WALLET !== 'undefined') WALLET.add(w, g, 50); }
      const foe = alive()[9]; const rf = foe.relationships.getOrCreate(A.agentId, A.name); rf.status = 'ex'; rf.affinity = -50;
      const wbefore = typeof WALLET !== 'undefined' ? WALLET.get(w, A) + WALLET.get(w, B) : 0;
      const wc = CEREMONY.planWedding(w, A, B); out.wedPlan = { inDays: wc ? wc.day - w._absDay() : null, log: logs().filter(l => /💍/.test(l)).slice(-1)[0] || '' };
      const orig = Math.random; let atSquare = 0;
      for (let i = 0; i < 96 * 7 && wc.status !== 'held'; i++) { if (wc.status === 'ongoing' && w.clock.hour >= CEREMONY.WED_END - 1) Math.random = () => 0.01; step(1); Math.random = orig; if (wc.status === 'ongoing') atSquare = Math.max(atSquare, Object.values(w.agents).filter(a => a._ceremony?.id === wc.id && a.targetLocation === wc.loc).length); }
      Math.random = orig;
      out.wed = { status: wc.status, guests: (wc.guests || []).length, atSquare, gifts: wc.gifts, speaker: wc.speaker, scene: wc.scene || '', moneyUp: (typeof WALLET !== 'undefined' ? WALLET.get(w, A) + WALLET.get(w, B) : 0) > wbefore - 40, log: logs().filter(l => /💒/.test(l)).slice(-1)[0] || '' };
      // 結婚不再一次辦完(原始碼)
      out.noInstant = /CEREMONY\.planWedding/.test(World.prototype.tick.toString() + Object.getOwnPropertyNames(World.prototype).map(k => { try { return String(World.prototype[k]); } catch (e) { return ''; } }).join('\n'));
      // 地點卡
      const c4 = CEREMONY.onDeath(w, alive()[3], { spouses: [] }); app.state = w.getState(); app._showLocationCard('graveyard');
      const card = document.getElementById('loc-quick-card'); out.card = card ? card.textContent.replace(/\s+/g, ' ').slice(0, 260) : ''; out.cardOverflow = card ? card.scrollWidth > card.clientWidth + 2 : null; app._hideNpcCard?.();
      // 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.saved = (w2.ceremony?.list || []).length === w.ceremony.list.length && (w2.ceremony?.anniv || []).length === w.ceremony.anniv.length;
      return out;
    });
    const zh = lang === 'zh';
    ok(r.plan.host && r.plan.loc === 'graveyard' && r.plan.inDays === 2, '配偶主辦葬禮，兩天後在墓園', r.plan);
    ok(zh ? /安排了葬禮/.test(r.plan.log) && / 點/.test(r.plan.log) : /arranged a funeral/.test(r.plan.log), '日誌寫誰安排、何時何地', r.plan.log);
    ok(r.held.status === 'held' && r.held.guests >= 5 && r.held.atGrave >= 3 && r.held.spouseCame, '當天認識的人走去墓園送行', r.held);
    ok(!!r.held.speaker && !!r.held.speech, '有人致悼詞', r.held);
    ok(r.memSpouse && r.farewell >= 5 && r.cleared === 0, '送行的人記得、墓碑記下送行人數、結束後大家回到日常', { m: r.memSpouse, f: r.farewell, c: r.cleared });
    ok(zh ? /人到場送行/.test(r.heldLog) : /came to say goodbye/.test(r.heldLog), '葬禮辦完的日誌', r.heldLog);
    ok(r.lonelyGuests >= 3, '沒什麼交情的人過世，也有首長、神職或鄰居來送', r.lonelyGuests);
    ok(r.pubCand && r.pubProposerOk && (zh ? /公費/.test(r.pubTitle) : /public funeral/i.test(r.pubTitle)), '首長過世：家屬、議員、神職或有交情的人提案公費辦隆重葬禮', { c: r.pubCand, p: r.pubProposerOk, t: r.pubTitle });
    ok(r.pub && r.pub.scale === 3 && r.pub.public === 1, '提案通過後改成全鎮送行', r.pub);
    ok(r.anniv.n >= 2 && r.anniv.mourn && (zh ? /忌日/.test(r.anniv.log) : /anniversary/.test(r.anniv.log)), '隔年忌日家屬回墓園祭拜', r.anniv);
    ok(r.wedPlan.inDays >= 3 && r.wedPlan.inDays <= 5 && (zh ? /婚期訂在/.test(r.wedPlan.log) : /wedding is set/.test(r.wedPlan.log)), '決定結婚後訂 3～5 天後的婚期', r.wedPlan);
    ok(r.wed.status === 'held' && r.wed.guests >= 6 && r.wed.atSquare >= 4, '婚禮當天賓客聚到會場', r.wed);
    ok(r.wed.gifts > 0 && r.wed.moneyUp && !!r.wed.speaker, '好友致詞、賓客包禮金', r.wed);
    ok(!!r.wed.scene, '前任可能來鬧場', r.wed.scene);
    ok(zh ? /禮金/.test(r.wed.log) : /in gifts/.test(r.wed.log), '婚禮辦完的日誌', r.wed.log);
    ok(r.noInstant, '結婚改成訂婚期（不再一次辦完）', r.noInstant);
    ok((zh ? /典禮/.test(r.card) : /Ceremonies/.test(r.card)) && r.cardOverflow === false, '墓園卡顯示即將舉行的葬禮、不溢出', { c: r.card, o: r.cardOverflow });
    ok(r.saved, '存讀檔保留典禮與忌日', r.saved);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
