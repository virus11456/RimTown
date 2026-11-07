// v6.93.0 工會:成立、會費、談判讓步、罷工(只有會員、沒工資、工賊照常上工)、罷工補貼、讓步／失敗、收買領袖與曝光下台、開除帶頭的人、
// 選舉偏好與推派候選人、AI 與詳情、經濟頁、存讀檔、解散退還基金;中英、桌機與 390px
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
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const w = app.world; w.observerMode = true; const Wl = WALLET.S(w); MARKET.S(w); const M = w.market; const U = UNION.S(w);
      const withR = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
      const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age || 30) >= 18);
      const d = w._absDay();
      // 場景:一個老闆擁有農莊,8 個農夫被壓薪到六成
      const boss = all[0]; boss.job = new Job('mayor'); boss.personality.traits = ['kind'];
      const workers = all.slice(1, 9); for (const a of workers) { a.job = new Job('farmer'); a.mood = 30; a.personality.traits = (a.personality.traits || []).filter(x => x !== 'greedy'); }
      for (const o of all.slice(9)) if (o.job?.key === 'farmer') o.job = new Job('guard');
      M.owners = M.owners || {}; for (const k of Object.keys(MARKET.SECTORS)) M.owners[k] = null; M.owners.farm = boss.agentId; M.pay.farm = 0.6;
      // 1) 組工會
      TIERS.S(w); w.tierState.lv = 1; U.on = false; withR(0.01, () => UNION.found(w, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead), d)); out.noUnionInTown = !U.on;
      w.tierState.lv = 2; withR(0.01, () => UNION.found(w, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead), d));
      out.founded = U.on && Object.keys(U.members).length >= 4 && !!w.agents[U.leader]; out.uname = U.name;
      for (const a of workers) U.members[a.agentId] = d; const L = w.agents[U.leader];
      // 2) 會費
      for (const a of workers) Wl.bal[a.agentId] = 50; const f0 = U.fund; UNION.dues(w); out.dues = U.fund > f0;
      // 3) 談判:心腸軟、賺錢的老闆讓步
      Wl.bal[boss.agentId] = 5000; M.hist.farm = [[500, 10]]; U.talks = {}; const p0 = M.pay.farm; withR(0.01, () => UNION.bargain(w, all, d)); out.deal = M.pay.farm > p0;
      // 4) 吝嗇老闆拒絕 → 工會罷工;只有會員罷工、沒工資
      M.pay.farm = 0.6; boss.personality.traits = ['greedy']; U.talks = {}; U.fund = 500; L.personality.traits = (L.personality.traits || []).filter(x => x !== 'greedy'); Wl.bal[L.agentId] = 100;
      const scab = workers[workers.length - 1]; delete U.members[scab.agentId];
      withR(0.9, () => UNION.bargain(w, all, d)); out.strike = !!U.strike.farm; out.memberIdle = UNION.idle(w, workers[1]) || UNION.idle(w, workers[2]); out.scabWorks = !UNION.idle(w, scab);
      const sm = workers.find(a => U.members[a.agentId] && a !== L) || workers[1]; const b0 = Wl.bal[sm.agentId], s0 = Wl.bal[scab.agentId]; MARKET.payroll(w, Wl, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead)); out.noPay = Wl.bal[sm.agentId] === b0; out.scabPaid = Wl.bal[scab.agentId] > s0;
      // 5) 罷工補貼 + 老闆撐不住讓步
      const sp0 = Wl.bal[sm.agentId], fd0 = U.fund; withR(0.01, () => UNION.strikeDay(w, d + 1)); out.strikePay = Wl.bal[sm.agentId] > sp0 && U.fund < fd0; out.won = !U.strike.farm && M.pay.farm > 0.6;
      // 6) 罷工失敗:基金見底
      M.pay.farm = 0.6; U.talks = {}; U.fund = 500; withR(0.9, () => UNION.bargain(w, all, d + 20)); U.fund = 0; const lost0 = U.lost; withR(0.99, () => UNION.strikeDay(w, d + 21)); out.lost = U.lost > lost0 && !U.strike.farm;
      // 7) 收買領袖(真相頁)
      M.pay.farm = 0.6; U.talks = {}; U.strike = {}; L.personality.traits = [...(L.personality.traits || []), 'greedy']; const lb0 = Wl.bal[L.agentId]; withR(0.3, () => UNION.bargain(w, all, d + 40));
      const sec = (DARK.S(w).secrets || []).find(x => x.kind === 'union_bribe' && x.culprit === L.agentId); out.bribe = !!sec && Wl.bal[L.agentId] > lb0;
      // 8) 收賄曝光 → 領袖被趕下台
      if (sec) sec.found = true; for (const a of workers) U.members[a.agentId] = d; delete U.members[scab.agentId]; UNION.membership(w, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead), d + 41); out.ousted = U.leader && U.leader !== L.agentId;
      // 9) 開除帶頭的人
      const L2 = w.agents[U.leader]; L2.personality.traits = (L2.personality.traits || []).filter(x => x !== 'greedy'); Wl.bal[L2.agentId] = 100; M.pay.farm = 0.6; U.talks = {}; U.strike = {}; U.fund = 0;
      withR(0.5, () => UNION.bargain(w, all, d + 60)); out.fired = Object.keys(U.firedUntil).length > 0 && Object.keys(U.firedUntil).some(id => UNION.idle(w, w.agents[id]));
      // 10) 選舉:會員投領袖、不投老闆;老闆不投工會領袖
      const voter = workers.find(a => U.members[a.agentId] && a.agentId !== U.leader); out.biasMember = UNION.bias(w, voter, U.leader); out.biasBossCand = UNION.bias(w, voter, boss.agentId); out.biasBoss = UNION.bias(w, boss, U.leader);
      // 11) 工會推領袖選鎮長
      try { const E = w.election; if (E) { E.active = false; withR(0.01, () => E._startElection(w)); out.unionCand = (E.candidates || []).some(c => c.agentId === U.leader && c.union); out.elecDbg = { c: (E.candidates || []).map(c => [c.agentId, !!c.union]), L: U.leader, m: Object.keys(U.members).length, res: E._residents(w).length, on: U.on, lv: TIERS.level(w) }; E.active = false; E.phase = null; } } catch (e) { out.elecErr = e.message; }
      // 12) AI、詳情、經濟頁
      const CE = Object.create(ConversationEngine.prototype); out.brief = (CE._agentBrief(w, voter, null).mem || []).join(' | '); out.bossBrief = (CE._agentBrief(w, boss, null).mem || []).join(' | ');
      const save = app.world; app.state = w.getState(); app.selectedAgent = voter.agentId; const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      try { app.renderAgentDetail(box); } catch (e) { out.detailErr = e.message; } const md = box.querySelector('.market-detail'); out.detail = md ? md.textContent.replace(/\s+/g, ' ') : ''; box.innerHTML = '';
      app._economySubTab = 'resources'; try { app.renderEconomy(box); } catch (e) { out.econErr = e.message; } const um = box.querySelector('.union-meta'); out.econ = um ? um.textContent.replace(/\s+/g, ' ') : ''; out.econOverflow = um ? um.scrollWidth > um.clientWidth + 2 : null; box.remove(); app.state = save.getState();
      // 13) 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = !!w2.union?.on && Object.keys(w2.union.members).length === Object.keys(U.members).length;
      // 14) 解散時基金分還給會員
      U.fund = 40; const mems = Object.keys(U.members).map(id => w.agents[id]); const tot0 = mems.reduce((s2, a) => s2 + Wl.bal[a.agentId], 0); M.owners.farm = null;
      UNION.membership(w, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead), d + 80); const tot1 = mems.reduce((s2, a) => s2 + Wl.bal[a.agentId], 0); out.dissolve = !U.on && U.fund === 0 && tot1 - tot0 > 39;
      // 15) 跑幾天沒錯
      try { const d0 = w._absDay(); for (let i = 0; i < 96 * 8 && w._absDay() - d0 < 8; i++) { w.paused = false; w.tick(); } w.paused = true; } catch (e) { out.err = e.message; }
      return out;
    });
    const zh = lang === 'zh';
    ok(r.noUnionInTown, '還是村莊、城鎮時不會有工會', r.noUnionInTown);
    ok(r.founded && (zh ? /工人聯合會/.test(r.uname) : /Union/.test(r.uname)), '被壓薪的工人一多，有人號召成立工會', { f: r.founded, n: r.uname });
    ok(r.dues, '會員每週繳會費存成罷工基金', r.dues);
    ok(r.deal, '工會找賺錢、心腸軟的老闆談，老闆讓步加薪', r.deal);
    ok(r.strike && r.memberIdle && r.scabWorks, '吝嗇老闆拒絕 → 工會罷工；只有會員罷工，沒入會的照常上工', { s: r.strike, m: r.memberIdle, sc: r.scabWorks });
    ok(r.noPay && r.scabPaid, '罷工的會員領不到工資，沒罷工的照領', { n: r.noPay, s: r.scabPaid });
    ok(r.strikePay && r.won, '罷工期間基金每天發補貼；老闆撐不住就讓步加薪', { p: r.strikePay, w: r.won });
    ok(r.lost, '基金見底 → 罷工失敗', r.lost);
    ok(r.bribe, '老闆私下收買貪心的工會領袖（真相頁看得到）', r.bribe);
    ok(r.ousted, '收賄曝光，會員把領袖趕下台、換人帶', r.ousted);
    ok(r.fired, '強硬的老闆開除帶頭的人（兩週沒工作）', r.fired);
    ok(r.biasMember > 0 && r.biasBossCand < 0 && r.biasBoss < 0, '選舉：會員投領袖、不投老闆；老闆不投工會領袖', { m: r.biasMember, b: r.biasBossCand, bb: r.biasBoss });
    ok(r.unionCand && !r.elecErr, '工會推領袖出來選鎮長', { c: r.unionCand, e: r.elecErr, d: r.elecDbg });
    ok(zh ? /工會/.test(r.brief) : /union/i.test(r.brief), 'AI 知道自己是工會會員', r.brief);
    ok(zh ? /工會/.test(r.bossBrief) : /union/i.test(r.bossBrief), '老闆的 AI 知道自己有多少工人入了會', r.bossBrief);
    ok(!r.detailErr && (zh ? /工會|開除/.test(r.detail) : /Union|Fired/i.test(r.detail)), '村民詳情的「生計」寫出工會身分', { d: r.detail, e: r.detailErr });
    ok(!r.econErr && (zh ? /會員/.test(r.econ) && /罷工基金/.test(r.econ) : /Members/.test(r.econ) && /Strike fund/.test(r.econ)), '經濟頁有工會（領袖、會員、基金、談成加薪、罷工失敗）', { t: r.econ, e: r.econErr });
    ok(r.econOverflow === false, '工會那行在這個寬度不會橫向溢出', r.econOverflow);
    ok(r.save, '存讀檔保留工會', r.save);
    ok(r.dissolve, '工會解散時基金分還給會員，錢不會消失', r.dissolve);
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
