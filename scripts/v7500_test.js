// v7.5.0 神話基因:第六時代門檻(王都＋基因實驗室)、編輯付費守恆、八種基因的好處(工作／走路／睡眠／壽命／醫術)、副作用(狼人、吸血鬼、失火)、
// 冥王之血復活、驅逐提案、禁止提案與地下診所罰款(守恆)、遺傳、3D 外觀、存讀檔、村民卡與概況卡(中英、桌機與 390px)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; WALLET.S(w); HEALTH.S(w); const M = MYTH.S(w); const R0 = Math.random; const lv0 = TIERS.level;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const all = npcs();
      const inTown = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0);
      const P = w.research.projects; const set = (a, n) => { w.wallet.bal[a.agentId] = n; };
      // 1) 門檻:第六時代要王都;神話基因譜還要基因實驗室;基因實驗室只有王都能蓋
      for (const p of Object.values(P)) if (p.era <= 5) p.status = 'complete'; TECH.choose(w, 'bio', null, true); w.research.refreshLocks(); /* v7.9.0 第六時代是基因生物專屬 */
      w.buildings.completed.push({ buildingKey: 'institute', name: BUILDING_TEMPLATES.institute.name, level: 1 });
      TIERS.level = () => 2; const av2 = w.research.getAvailable().map(p => p.key); const cb2 = HEALTH.canBuild(w, 'gene_lab');
      TIERS.level = () => 3; const av3 = w.research.getAvailable().map(p => p.key); const cb3 = HEALTH.canBuild(w, 'gene_lab');
      P.gene_editing.status = 'complete'; w.research.refreshLocks(); const avNoLab = w.research.getAvailable().some(p => p.key === 'myth_genome');
      w.buildings.completed.push({ buildingKey: 'gene_lab', name: BUILDING_TEMPLATES.gene_lab.name, level: 1 }); const avLab = w.research.getAvailable().some(p => p.key === 'myth_genome');
      out.gate = { genes: MYTH.KEYS.length, era6: !!RESEARCH_ERAS[6], tier2: !av2.includes('gene_editing') && !cb2, tier3: av3.includes('gene_editing') && cb3, noLab: !avNoLab, lab: avLab };
      P.myth_genome.status = 'complete'; out.gate.open = MYTH.open(w);
      // 2) 編輯付費:主持學者一半、公庫一半,守恆
      const [A, B, C, D, E, F, G2] = all; const sci = all.find(a => a.job?.key === 'researcher' && a !== A) || all[7]; if (sci.job?.key !== 'researcher') sci.job = new Job('researcher');
      set(A, 3000); const resSum = () => all.filter(a => a !== A && a.job?.key === 'researcher').reduce((s2, a) => s2 + WALLET.get(w, a), 0); const t0 = inTown(), s0 = sp.get('silver'), sc0 = resSum(); Math.random = () => 0.99; const res = MYTH.edit(w, A, 'wolf'); Math.random = R0;
      out.edit = { res, gene: MYTH.geneOf(w, A), paid: 3000 - WALLET.get(w, A), sci: Math.round(resSum() - sc0), tre: Math.round(sp.get('silver') - s0), drift: Math.round((inTown() - t0) * 100) / 100 };
      // 3) 好處
      A.job = new Job('guard'); const base = HEALTH.workMult(w, B); B.job = new Job('guard');
      out.fx = { wolfWork: HEALTH.workMult(w, A) / Math.max(0.01, HEALTH.workMult(w, B)), wolfSpeed: HEALTH.speed(A.agentId) };
      M.g[C.agentId] = { k: 'owl', d: 0 }; out.fx.owlSleep = HEALTH.sleepMult(w, C); HEALTH.hurt(w, C, 'e', 30); out.fx.owlEye = HEALTH.body(w, C).e;
      M.g[D.agentId] = { k: 'night', d: 0, bite: 0 }; out.fx.nightDeath = HEALTH.deathMult(w, D);
      M.g[E.agentId] = { k: 'sun', d: 0 }; out.fx.sunDoc = HEALTH.successRate(w, { age: 30 }, E, 2) - HEALTH.successRate(w, { age: 30 }, F, 2);
      M.g[F.agentId] = { k: 'giant', d: 0 }; F.job = new Job('carpenter'); out.fx.giant = MYTH.workMult(w, F);
      // 4) 狼人:滿月夜咬人
      const ad = w._absDay; w._absDay = () => 7 * 1 + 15 * 10; M.lastDay = -1; HEALTH.S(w).a = {}; Math.random = (() => { let i = 0; return () => (i++ % 3 === 2 ? 0.1 : 0.05); })();
      const a0 = M.st.attacks; MYTH.daily(w); Math.random = R0; out.wolf = { attacks: M.st.attacks - a0, hurt: Object.keys(HEALTH.S(w).a).length };
      // 5) 吸血鬼:隔一週要吸血
      M.g[D.agentId].bite = w._absDay() - 8; M.lastDay = -1; const b0 = M.st.bites; Math.random = () => 0.5; MYTH.daily(w); Math.random = R0; out.vamp = { bites: M.st.bites - b0 };
      // 6) 不死鳥:傷自己好
      M.g[G2.agentId] = { k: 'phoenix', d: 0 }; HEALTH.addAil(w, G2, { p: 'h', k: 'injury', s: 2, dmg: 20 }, '打架'); M.lastDay = -1; Math.random = () => 0.99; MYTH.daily(w); Math.random = R0;
      out.phoenix = { ails: HEALTH.ails(w, G2).filter(x => x.k === 'injury').length };
      w._absDay = ad;
      // 7) 冥王之血:死一次會活回來,第二次就真的走了
      const Hd = all[8]; M.g[Hd.agentId] = { k: 'hades', d: 0 }; Math.random = () => 0.1; w.lifecycle._killNpc(w, Hd); const alive1 = !Hd.isDead; w.lifecycle._killNpc(w, Hd); Math.random = R0; out.hades = { alive1, dead2: !!Hd.isDead || !w.agents[Hd.agentId] || Hd.isDead };
      // 8) 驅逐提案:同一個神裔被認出來傷人兩次
      const d = w._absDay(); M.inc = [[d, 'wolf', A.agentId, 1], [d, 'wolf', A.agentId, 1]]; M.lastExile = -99; w.proposals.items = w.proposals.items.filter(p => !['myth_exile', 'gene_ban'].includes(p.kind)); M.lastDay = -1;
      Math.random = () => 0.99; MYTH.daily(w); Math.random = R0; const ex = w.proposals.items.find(p => p.kind === 'myth_exile');
      out.exile = { prop: !!ex, ref: ex?.refKey === A.agentId }; if (ex) { MYTH.exile(w, ex); const _ff = (id) => { if (typeof EXILE === 'undefined' || !EXILE.pendingOf(w, id)) return false; EXILE.S(w).pending[id].until = w._absDay(); EXILE.S(w).lastDay = null; EXILE.daily(w); return true; }; out.exile.grace = !!w.agents[A.agentId] && _ff(A.agentId); out.exile.gone = !w.agents[A.agentId] || w.agents[A.agentId].isDead || !!w.agents[A.agentId]._leftTown || !npcs().includes(A); }
      // 9) 禁止提案,禁了以後只剩地下診所(貴一半,被抓罰款進公庫)
      M.inc.push([d, 'night', D.agentId, 1]); M.lastBan = -99; M.lastDay = -1; Math.random = () => 0.99; MYTH.daily(w); Math.random = R0; const bp = w.proposals.items.find(p => p.kind === 'gene_ban'); out.ban = { prop: !!bp };
      MYTH.ban(w); const U = all[9]; set(U, 5000); const u0 = inTown(); Math.random = (() => { let i = 0; return () => (i++ === 0 ? 0.5 : 0.1); })(); const ur = MYTH.edit(w, U, 'giant'); Math.random = R0;
      out.ban.under = { res: ur, paid: 5000 - WALLET.get(w, U), fined: M.st.fined, drift: Math.round((inTown() - u0) * 100) / 100 };
      // 10) 遺傳
      const kid = all[10]; kid.age = 0; kid._parentNames = [D.name]; delete M.g[kid.agentId]; M.seen = {}; M.lastDay = -1; Math.random = () => 0.3; MYTH.daily(w); Math.random = R0; out.heir = MYTH.geneOf(w, kid);
      // 11) 外觀:3D 帶基因;巨人比較大
      const lk = LOOK.of(w, F); out.look = { gn: lk?.gn, sig: LOOK.sig(lk).includes('giant') };
      const mk = (gn) => VILLAGER3D.build({ aid: 'x', agent: { name: 'x', appear: { b: 'a', cls: 1, gn } }, pos: { job: 'farmer', gender: 'male' } }); out.look.scale = mk('giant').scale.x / mk('').scale.x;
      // 12) 存讀檔
      const data = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data))); out.save = { g: Object.keys(w2.myth?.g || {}).length, ban: w2.myth?.ban };
      out.brief = MYTH.brief(w, D); TIERS.level = lv0;
      app.state = w.getState(); app.selectedAgent = D.agentId;
      return out;
    });
    ok(r.gate.genes === 8 && r.gate.era6 && r.gate.tier2 && r.gate.tier3 && r.gate.noLab && r.gate.lab && r.gate.open, '第六時代：要王都才研究得了、才蓋得了基因實驗室；神話基因譜要有實驗室', r.gate);
    ok(r.edit.res === 'ok' && r.edit.gene === 'wolf' && r.edit.paid === 900 && r.edit.sci === 450 && r.edit.tre === 450 && r.edit.drift === 0, '基因編輯：付 900，學者一半、公庫一半（守恆）', r.edit);
    ok(r.fx.wolfWork > 1.4 && Math.abs(r.fx.wolfSpeed - 1.4) < 0.01 && r.fx.owlSleep < 0.7 && r.fx.owlEye === 100 && r.fx.nightDeath <= 0.21 && r.fx.sunDoc >= 0.15 && r.fx.giant === 2, '好處：狼守衛更強走更快、梟瞳眼不退化但睡不好、夜之血不老、太陽神醫術、巨人力氣', r.fx);
    ok(r.wolf.attacks >= 1 && r.wolf.hurt >= 1, '滿月夜狼人咬傷人', r.wolf);
    ok(r.vamp.bites >= 1, '吸血鬼隔一週要吸血', r.vamp);
    ok(r.phoenix.ails === 0, '不死鳥之血：傷會自己好', r.phoenix);
    ok(r.hades.alive1 && r.hades.dead2, '冥王之血：死了活回來一次，第二次就真的走了', r.hades);
    ok(r.exile.prop && r.exile.ref && r.exile.grace && r.exile.gone, '同一個神裔被認出來傷人兩次：有人提案驅逐，通過就離開小鎮', r.exile);
    ok(r.ban.prop && r.ban.under.res === 'ok' && r.ban.under.paid >= 1200 && r.ban.under.fined >= 1 && r.ban.under.drift === 0, '出事多了有人提案禁止；禁了只剩地下診所（貴一半、被抓罰款，守恆）', r.ban);
    ok(!!r.heir, '神裔的孩子會遺傳基因', r.heir);
    ok(r.look.gn === 'giant' && r.look.sig && r.look.scale > 1.25, '3D 外觀帶基因（巨人比較大）', r.look);
    ok(r.save.g >= 3 && r.save.ban === true, '神話基因存讀檔', r.save);
    ok(/神裔|god-blooded/i.test(r.brief), 'AI 知道自己是神裔', r.brief);
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('detail'); else { app.activeTab = 'detail'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui1 = await page.evaluate(() => { const s = document.querySelector('.hb-gene'); return s ? { txt: s.textContent, cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui1, '村民卡顯示神裔基因的好處與副作用', ui1);
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui2 = await page.evaluate(() => { const s = document.querySelector('.myth-section'); return s ? { txt: s.textContent.slice(0, 160), cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []), over: s.scrollWidth > s.clientWidth + 2 } : null; });
    ok(!!ui2 && !ui2.over, '小鎮概況有神話基因卡', ui2);
    if (lang === 'en') ok(ui1 && ui2 && !ui1.cjk.length && !ui2.cjk.length, '英文沒有中文', { a: ui1?.cjk, b: ui2?.cjk });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
