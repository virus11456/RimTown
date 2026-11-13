// v9.9.0 民意與派系動員(建在「鎮上的新東西」上,不另開系統):沉默螺旋、貼告示號召、抗議與支持者到場、抵制店家、
// 逼首長表態、輿論翻轉、全鎮共識、派系為議題吵架、同派系看法靠攏、抗議跟著同派系動員;介面;舊系統簡化
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
      const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 14 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
      const P = all(); const X = THINGS.S(w); const out = {}; const rnd = Math.random; const T0 = () => w.tickCount;
      const logs = () => (w.messageLog || []).slice(-80).map(m => (m.k || '') + ' ' + (m.content || '') + ' ' + JSON.stringify(m.p || {})).join('\n');
      const mayor = w.proposals._mayor(w); const nonM = P.filter(a => a !== mayor);
      const owner = nonM[0]; const haters = nonM.slice(1, 11), fans = nonM.slice(11, 15), shy = nonM[15];
      for (const a of [owner, ...haters, ...fans, shy]) for (const b of [...haters, ...fans, shy]) if (a && b && a !== b) { const rr = a.relationships.getOrCreate(b.agentId, b.name); rr.affinity = 0; }
      THINGS.HOOKS.optest = { boycott: true };
      const T = THINGS.register(w, { kind: 'optest', key: 'den', name: ['測試賭坊', 'Test Den'], icon: '🎲', facts: '測試用', owner: owner.agentId, place: null, tags: { vice: 1 } });
      T.born = w._absDay() - 20;
      for (const a of haters) X.att[T.id][a.agentId] = -80; for (const a of fans) X.att[T.id][a.agentId] = 75; X.att[T.id][shy.agentId] = 40; if (mayor) X.att[T.id][mayor.agentId] = -10;
      // 1. 沉默螺旋:少數派又沒朋友撐腰,多半不說
      const cs = THINGS.camps(w, X, T); out.camps = cs;
      // 2. 抗議(強制討厭的人今天都想抗議)＋貼告示＋支持者到場＋抵制＋首長表態
      for (const a of haters) X.intent = Object.assign(X.intent || {}, { [T.id + '|' + a.agentId]: 'protest' });
      X.lastProtest = -99; delete T.protest; X.lastDay = null; X.att[T.id][mayor.agentId] = -10;
      Math.random = () => 0.1; try { THINGS.daily(w); } finally { Math.random = rnd; }
      // v9.27.0 跟不跟、要不要到場聲援由每個人自己決定，隔天才集合：這裡讓支持的人都答應到場，再跑隔天
      if (THINGS.byCrowd?.(w) && T.call) { for (const a of fans) THINGS.rallyBy(w, a, { tid: T.id, side: 'pro' }); DECIDE.S(w).q = []; T.call.d = w._absDay() - 1; X.lastDay = null; Math.random = () => 0.1; try { THINGS.daily(w); } finally { Math.random = rnd; } }
      const L = logs();
      out.protest = { n: T.protest?.n || 0, counter: T.protest?.counter || 0, notice: X.st.notice || 0, boycott: !!T.boycott, stance: T.stance?.side, silent: X.st.silent || 0,
        logNotice: /告示|notice board/i.test(L), logCounter: /聲援|counter|support/i.test(L), logBoycott: /抵制|boycott/i.test(L), logStance: /表態|首長|took a stand|leader/i.test(L) };
      out.shyMem = (shy.memory.entries || []).slice(-6).some(m => /不敢講|didn.t dare|keep quiet/i.test(JSON.stringify(m)));
      out.buy = { hater: THINGS.buyMult(w, T.id, haters[0]), fan: THINGS.buyMult(w, T.id, fans[0]) };
      out.gather = haters.filter(a => a._thingGo).length;
      // 1b. 沉默螺旋:另一件東西,只有她一個人喜歡、周圍都是討厭的人
      const T3 = THINGS.register(w, { kind: 'optest', key: 'quiet', name: ['測試告示牌', 'Test Sign'], icon: '🪧', facts: '測試用', place: null, tags: {} }); T3.born = w._absDay() - 5;
      haters.forEach(a => X.att[T3.id][a.agentId] = -50); X.att[T3.id][shy.agentId] = 40; const s0 = X.st.silent || 0;
      X.lastDay = null; Math.random = () => 0.05; try { THINGS.daily(w); } finally { Math.random = rnd; }
      out.silent = (X.st.silent || 0) - s0; out.shyMem2 = (shy.memory.entries || []).slice(-8).some(m => /不敢講|didn.t dare|keep quiet|not dare/i.test(JSON.stringify(m)));
      // 3. 輿論翻轉:原本多數支持,現在多數反對
      T.maj = 1; const f0 = X.st.flip || 0; X.lastDay = null; Math.random = () => 0.99; try { THINGS.daily(w); } finally { Math.random = rnd; }
      out.flip = (X.st.flip || 0) - f0; out.flipLog = /輿論翻轉|turned|flipped/i.test(logs());
      // 4. 全鎮共識:八成以上同一邊
      const T2 = THINGS.register(w, { kind: 'optest', key: 'park', name: ['測試公園', 'Test Park'], icon: '🌳', facts: '測試用', place: null, tags: { fun: 1 } }); T2.born = w._absDay() - 5;
      nonM.slice(1, 6).forEach(a => X.att[T2.id][a.agentId] = 60); nonM.slice(6, 11).forEach(a => X.att[T2.id][a.agentId] = -60); const c0 = X.st.consensus || 0;
      X.lastDay = null; Math.random = () => 0.99; try { THINGS.daily(w); } finally { Math.random = rnd; } /* 先吵過(兩邊各五人) */
      out.noEarly = (X.st.consensus || 0) - c0;
      nonM.slice(1, 11).forEach(a => X.att[T2.id][a.agentId] = 60); X.att[T2.id][nonM[11].agentId] = -50;
      const T4 = THINGS.register(w, { kind: 'optest', key: 'calm', name: ['測試水井', 'Test Well'], icon: '🪣', facts: '測試用', place: null, tags: {} }); T4.born = w._absDay() - 5; nonM.slice(1, 11).forEach(a => X.att[T4.id][a.agentId] = 60); /* 從沒爭議過 */
      X.lastDay = null; Math.random = () => 0.99; try { THINGS.daily(w); } finally { Math.random = rnd; }
      out.consensus = { n: (X.st.consensus || 0) - c0, side: T2.consensus, early: out.noEarly, calm: T4.consensus || 0 };
      // 5. 派系:兩個社團對同一件事看法相反就為它吵;同派系看法靠攏
      const FS = w.factions; const fa = new Faction('f_t1', 'scholars', haters[0].name), fb = new Faction('f_t2', 'drinking_pals', fans[0].name);
      haters.slice(0, 3).forEach(a => fa.addMember(a.agentId)); fans.slice(0, 3).forEach(a => fb.addMember(a.agentId)); FS.factions = { f_t1: fa, f_t2: fb };
      const iss = THINGS.splitIssue(w, fa.members, fb.members); out.split = iss ? iss.name : null;
      Math.random = () => 0.1; try { FS._tryFactionEvents(w); } finally { Math.random = rnd; }
      out.factionLog = /吵起來|argue|quarrel/i.test(logs());
      X.att[T.id][haters[0].agentId] = -100; X.att[T.id][haters[1].agentId] = -20; X.att[T.id][haters[2].agentId] = -60; const before = X.att[T.id][haters[1].agentId];
      X.lastDay = null; Math.random = () => 0.99; try { THINGS.daily(w); } finally { Math.random = rnd; }
      out.pull = { before, after: X.att[T.id][haters[1].agentId] };
      // 6. 介面:鎮況頁看得到抵制、首長表態、沉默的少數
      app.state = w.getState(); app._ppTab = 'town'; const box = document.createElement('div'); document.body.appendChild(box); app.renderProposals(box); out.ui = box.innerText; box.remove();
      // 7. 存讀檔
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.save = !!w2.things?.list?.[T.id]?.boycott && !!w2.things?.list?.[T.id]?.stance;
      return out;
    });
    console.log(JSON.stringify({ ...r, ui: r.ui.slice(0, 300) }));
    ok(r.camps.con >= 10 && r.camps.pro >= 4, '兩邊陣營算得出來（反對多、支持少）', r.camps);
    ok(r.protest.n >= 3 && r.protest.notice >= 1 && r.protest.logNotice, '帶頭的人先在公告欄貼告示號召，再到場抗議', r.protest);
    ok(r.protest.counter >= 3 && r.protest.logCounter, '支持的人也到場聲援：兩邊隔街對喊（分邊站）', r.protest);
    ok(r.protest.boycott && r.protest.logBoycott && r.buy.hater <= 0.2 && r.buy.fan >= 0.85, '有老闆的東西被抵制：討厭的人不去、支持的人照去', r.buy);
    ok(r.protest.stance !== undefined && r.protest.logStance, '吵到有人抗議，首長被逼出來表態', r.protest);
    ok(r.silent >= 1 && r.shyMem2, '沉默螺旋：少數派又沒朋友撐腰，不敢講出自己的看法', r);
    ok(r.gather >= 3, '抗議的人真的走到集合地點（地圖上看得到）', r.gather);
    ok(r.flip === 1 && r.flipLog, '輿論翻轉：原本多數支持、現在多數反對，會寫進日誌和日報', r);
    ok(r.consensus.n === 1 && r.consensus.side === 1 && r.consensus.early === 0, '吵過的事最後八成以上同一邊：全鎮共識', r.consensus);
    ok(r.consensus.calm === 0, '從沒爭議過的東西不算「共識」（不洗版）', r.consensus);
    ok(!!r.split && r.factionLog, '兩個派系對同一件事看法相反，就為那件事吵起來（不再是隨機吵架）', r);
    ok(r.pull.after < r.pull.before, '同派系的人看法慢慢靠攏', r.pull);
    ok(/抵制|boycott/i.test(r.ui) && /首長|leader/i.test(r.ui), '鎮況頁看得到抵制、首長表態', r.ui.slice(0, 200));
    ok(r.save, '存讀檔保留抵制與表態', r.save);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await page.context().close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
