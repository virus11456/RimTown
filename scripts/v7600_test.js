// v7.6.0 神裔社會:看法(個性、家人)、純人派／神裔會與派系投票、講壞話、宗教(褻瀆派逐出教門、新神教)、
// 婚禮反對與缺席、混血減半、獵人隊(抓錯→冤案→審判;平權令下只能交給守衛)、報紙恐慌／平反、選舉加減分、
// 照基因挑工作與歧視辭退、夜班津貼(守恆)、神裔世家算士紳、平權令提案與執行、審判罰款守恆、存讀檔、AI 摘要、村民卡與概況卡
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
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; WALLET.S(w); HEALTH.S(w); const M = MYTH.S(w); const X = MYTHSOC.S(w); const R0 = Math.random;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const all = npcs(); const adults = all.filter(a => (a.age ?? 30) >= 18);
      const inTown = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0);
      const fix = (v, f) => { Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = R0; } };
      const run = (v) => fix(v, () => { X.lastDay = -1; MYTHSOC.daily(w); });
      const kinds = (a) => (a.thoughts || []).map(x => x.kind);
      const [C1, C2, C3, P1, P2, P3, P4, N1, N2, N3, K] = adults;
      for (const a of [C1, C2, C3, P1, P2, P3, P4, N1, N2, N3]) { a._parentNames = []; }
      M.g[C1.agentId] = { k: 'owl', d: 0 }; M.g[C2.agentId] = { k: 'giant', d: 0 }; M.g[C3.agentId] = { k: 'night', d: 0, bite: 99999 };
      // 1) 看法:家裡有神裔的人比較能接受(+40)
      N1._parentNames = [C1.name]; const fam = fix(0.5, () => MYTHSOC.initAtt(w, N1, [C1]) - MYTHSOC.initAtt(w, N1, []));
      run(0.99); out.att = { fam, all: all.filter(a => !MYTH.geneOf(w, a)).every(a => typeof X.att[a.agentId] === 'number'), carrier: MYTHSOC.att(w, C1) };
      N1._parentNames = [];
      // 2) 派系:怕神裔的 4 人 → 純人派;3 個神裔＋支持者 → 神裔會
      for (const a of [P1, P2, P3, P4]) X.att[a.agentId] = -80; X.att[N2.agentId] = 80; X.att[N1.agentId] = 0; X.att[N3.agentId] = 0;
      run(0.99); const G = X.grp;
      out.grp = { pure: !!G.pure && [P1, P2, P3, P4].every(a => G.pure.members.includes(a.agentId)), pl: G.pure && G.pure.members.includes(G.pure.leader), guild: !!G.guild && [C1, C2, C3, N2].every(a => G.guild.members.includes(a.agentId)), gl: G.guild && [C1, C2, C3].some(a => a.agentId === G.guild.leader) };
      out.gv = { banPure: MYTHSOC.groupVote(w, { kind: 'gene_ban' }, P1), banGuild: MYTHSOC.groupVote(w, { kind: 'gene_ban' }, C1), same: MYTHSOC.groupVote(w, { kind: 'build', proposerId: P1.agentId }, P2), other: MYTHSOC.groupVote(w, { kind: 'build', proposerId: P1.agentId }, C2) };
      // 3) 純人派講壞話
      const bm0 = X.st.badmouth; for (let i = 0; i < 3; i++) run(0.1); out.badmouth = X.st.badmouth - bm0;
      for (const a of [P1, P2, P3, P4]) X.att[a.agentId] = -80; X.att[N2.agentId] = 80;
      // 4) 宗教:褻瀆派領袖把神裔逐出教門;被排擠的神裔創立新神教
      FAITH.S(w); const F = w.faith; F.rels = F.rels.filter(R => !R.myth).slice(0, 3); const R1 = F.rels[0]; X.rel[R1.id] = 'blas'; F.heads = F.heads || {};
      F.of[N3.agentId] = { rel: R1.id, piety: 95 }; F.heads[R1.id] = N3.agentId; F.of[C1.agentId] = { rel: R1.id, piety: 70 }; const oc0 = X.st.outcast;
      run(0.01); const cult = F.rels.find(R => R.myth);
      out.faith = { outcast: X.st.outcast - oc0, castThought: kinds(C1).includes('myth_cast_out'), cult: !!cult, saint: cult?.saint === C1.agentId, head: cult && F.heads[cult.id] === C1.agentId, inCult: cult && F.of[C1.agentId]?.rel === cult.id, stance: MYTHSOC.stanceOf(w, cult), blas: MYTHSOC.stanceOf(w, R1) };
      for (const a of [P1, P2, P3, P4]) X.att[a.agentId] = -80; X.att[N2.agentId] = 80;
      // 5) 婚禮:神裔娶一般人,怕神裔的家人反對、不來
      N2._parentNames = [P3.name]; CEREMONY.S(w).list = CEREMONY.S(w).list.filter(c => ![C2.agentId, N2.agentId].includes(c.a) && ![C2.agentId, N2.agentId].includes(c.b));
      const wed = CEREMONY.planWedding(w, C2, N2); const guests = wed ? CEREMONY.guestsFor(w, wed) : [];
      out.wed = { made: !!wed, mixed: wed?.mixed, boy: (wed?.boycott || []).includes(P3.agentId), absent: !guests.includes(P3), thought: kinds(C2).includes('wed_boycott') };
      N2._parentNames = [];
      // 6) 混血:爸媽只有一個是神裔 → 好處只有一半
      K.age = 0; K._parentNames = [C2.name, P4.name]; M.g[K.agentId] = { k: 'giant', d: 0, born: 1 }; run(0.99); K.job = new Job('carpenter');
      out.half = { half: !!M.g[K.agentId].half, work: MYTH.workMult(w, K), full: MYTH.workMult(w, Object.assign(Object.create(Object.getPrototypeOf(C2)), C2, { job: new Job('carpenter') })) };
      // 7) 獵人隊抓錯人 → 冤案 → 審判帶頭的人
      for (const a of [P1, P2, P3, P4]) X.att[a.agentId] = -80; run(0.99);
      const hunters = (X.grp.pure?.members || []).slice(0, 4).map(id => w.agents[id]); for (const h of hunters) { const rr = h.relationships.getOrCreate(N1.agentId, N1.name); rr.affinity = -100; }
      X.hunts = []; const d = w._absDay(); HEALTH.S(w).a[N1.agentId] = [];
      const h1 = fix(0.55, () => MYTHSOC.hunt(w, X, d, npcs(), C3, 'night'));
      out.hunt = { made: !!h1, wrong: h1 && !h1.right && h1.sus === N1.agentId, beat: h1?.beat, hurt: HEALTH.ails(w, N1).some(x => x.k === 'injury'), hated: kinds(N1).includes('myth_hated') };
      w.proposals.items = w.proposals.items.filter(p => p.kind !== 'verdict'); const lead = w.agents[h1?.lead]; h1 && (h1.reveal = d); const wr0 = X.st.wrongful; const n1a = MYTHSOC.att(w, N3);
      fix(0.99, () => MYTHSOC.reveal(w, X, d, npcs()));
      const vp = w.proposals.items.find(p => p.kind === 'verdict' && p.culprit === lead?.agentId);
      out.reveal = { wrongful: X.st.wrongful - wr0, flag: !!h1?.wrong, verdict: !!vp, exposed: (M.inc || []).some(x => x[2] === C3.agentId && x[3]), sympathy: MYTHSOC.att(w, N3) > n1a, vind: kinds(N1).includes('vindicated') };
      // 審判罰款從被告錢包出(守恆)
      if (vp) { vp.pen = 'fine'; w.wallet.bal[lead.agentId] = 50; const t0 = inTown(), s0 = sp.get('silver'); DARK.punish(w, w.proposals, vp); out.fine = { paid: 50 - WALLET.get(w, lead), tre: Math.round(sp.get('silver') - s0), drift: Math.round((inTown() - t0) * 100) / 100 }; }
      // 8) 平權令下抓對人:只能交給守衛,不能私刑
      X.rights = true; X.hunts = []; const c0 = X.st.caught; const h2 = fix(0.1, () => MYTHSOC.hunt(w, X, d, npcs(), C3, 'night')); out.hunt2 = { right: !!h2?.right, beat: h2?.beat, caught: X.st.caught - c0 }; X.rights = false;
      // 9) 報紙:八卦報炒恐慌、革新報平反,讀者看法跟著變
      PRESS.S(w); const mk = (id, st, jo) => ({ id, st, name: [id === 'PG' ? '測試閒話報' : '測試新報', id], cred: 60, owner: null, journo: jo.agentId, bribedBy: null, banned: false, underground: false, stories: [], fame: 0 });
      w.press.papers = w.press.papers.filter(P => !['PG', 'PP'].includes(P.id)).concat([mk('PG', 'gossip', P1), mk('PP', 'prog', N2)]); w.press.reads[N3.agentId] = 'PG'; w.press.reads[N1.agentId] = 'PP'; X.pd = {};
      X.att[N3.agentId] = 0; X.att[N1.agentId] = 0;
      const pn = fix(0.1, () => MYTHSOC.press(w, X, 'panic', '神裔又出事了！{a}身上的{g}害人受傷，晚上最好別出門', { a: C3.name, g: '夜之血' }, npcs()));
      const pf = fix(0.1, () => MYTHSOC.press(w, X, 'fair', '冤案！{s}被純人派當成怪物毒打，真兇另有其人', { s: N1.name }, npcs()));
      out.press = { pn, pf, fear: MYTHSOC.att(w, N3), fair: MYTHSOC.att(w, N1), story: w.press.papers.find(P => P.id === 'PG').stories.some(s => s.kind === 'myth_panic') };
      // 10) 選舉:怕神裔的人不投神裔,純人派候選人拿怕神裔的票
      out.elec = { fearVsCarrier: MYTHSOC.bias(w, P1, C1.agentId), allyVsCarrier: MYTHSOC.bias(w, N2, C1.agentId), fearVsPure: MYTHSOC.bias(w, P2, P1.agentId) };
      // 11) 照基因挑工作;怕神裔的老闆會刷掉神裔;平權令後不行
      X.rights = true; /* 先量基因本身(平權令下老闆不能偏心) */ const fitR = HEALTH.jobFit(C1, 'researcher') / HEALTH.jobFit(N3, 'researcher'), fitG = HEALTH.jobFit(C3, 'guard') / HEALTH.jobFit(N3, 'guard'), fitF = HEALTH.jobFit(C3, 'farmer') / HEALTH.jobFit(N3, 'farmer'); X.rights = false;
      MARKET.S(w); const sec = MARKET.JOB2S.carpenter; const own0 = MARKET.S(w).owners[sec];
      MARKET.S(w).owners[sec] = P1.agentId; const disc = HEALTH.jobFit(C2, 'carpenter') / HEALTH.jobFit(N3, 'carpenter'); X.rights = true; const fair = HEALTH.jobFit(C2, 'carpenter') / HEALTH.jobFit(N3, 'carpenter'); X.rights = false;
      MARKET.S(w).owners[sec] = C1.agentId; const pal = HEALTH.jobFit(C2, 'carpenter') / HEALTH.jobFit(N3, 'carpenter');
      out.fit = { fitR, fitG, fitF, disc, fair, pal };
      // 12) 被怕神裔的老闆辭退
      MARKET.S(w).owners[sec] = P1.agentId; X.jobs[C2.agentId] = 'carpenter'; const job2 = C2.job; C2.job = null; const f0 = X.st.fired; run(0.99); out.fired = { n: X.st.fired - f0, thought: kinds(C2).includes('myth_hated') }; C2.job = job2; MARKET.S(w).owners[sec] = own0;
      // 13) 夜班津貼:公庫 → 守夜吸血鬼的錢包(守恆)
      C3.job = new Job('guard'); sp.resources.silver = Math.max(500, sp.get('silver')); const t1 = inTown(), s1 = sp.get('silver'), wc = WALLET.get(w, C3); run(0.99);
      out.night = { got: Math.round((WALLET.get(w, C3) - wc) * 100) / 100, tre: Math.round((sp.get('silver') - s1) * 100) / 100, drift: Math.round((inTown() - t1) * 100) / 100 };
      // 14) 神裔世家算士紳
      w.wallet.bal[K.agentId] = 150; K.age = 20; out.elite = { elite: MYTHSOC.elite(w, K), lv: CLASS.compute(w, K) };
      // 15) 平權令提案、投票、執行
      w.proposals.items = w.proposals.items.filter(p => !['gene_rights', 'gene_unban'].includes(p.kind)); X.lastRights = -99; run(0.99);
      const rp = w.proposals.items.find(p => p.kind === 'gene_rights');
      out.rights = { prop: !!rp, by: rp && rp.proposerId === X.grp.guild?.leader, vC: rp && MYTHSOC.vote(w, rp, C1).v, vP: rp && fix(0.5, () => MYTHSOC.vote(w, rp, P1).v) };
      if (rp) { rp.status = 'approved'; w.proposals._execute(w, rp, d); out.rights.done = !!X.rights; }
      // 16) 解除禁令提案
      M.ban = true; X.banSince = null; X.lastUnban = -99; run(0.99); const early = w.proposals.items.some(p => p.kind === 'gene_unban'); X.banSince = d - 31; X.lastUnban = -99; run(0.99); const up = w.proposals.items.find(p => p.kind === 'gene_unban'); out.unban = { early, prop: !!up }; if (up) { up.status = 'approved'; w.proposals._execute(w, up, d); out.unban.lifted = !M.ban; }
      // 17) 跑幾天不會出錯
      let err = null; try { for (let i = 0; i < 6; i++) { X.lastDay = -1; M.lastDay = -1; w.proposals.daily(w); } } catch (e) { err = String(e); } out.days = err;
      // 18) 存讀檔、AI 摘要
      const data = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data))); out.save = { att: Object.keys(w2.mythsoc?.att || {}).length, pure: !!w2.mythsoc?.grp?.pure, rights: w2.mythsoc?.rights, hunts: (w2.mythsoc?.hunts || []).length };
      out.brief = MYTHSOC.brief(w, P1); out.brief2 = MYTHSOC.brief(w, K); out.town = MYTHSOC.townBrief(w);
      app.state = w.getState(); app.selectedAgent = P1.agentId;
      return out;
    });
    ok(r.att.fam === 40 && r.att.all && r.att.carrier === 100, '看法：每個人都有看法，家裡有神裔的人比較能接受', r.att);
    ok(r.grp.pure && r.grp.pl && r.grp.guild && r.grp.gl, '怕神裔的人組純人派、神裔抱團成神裔會', r.grp);
    ok(r.gv.banPure === 'for' && r.gv.banGuild === 'against' && r.gv.same === 'for' && r.gv.other === 'against', '派系投票：純人派支持禁令、神裔會反對；同派系的提案一起挺', r.gv);
    ok(r.badmouth >= 1, '純人派在背後講神裔壞話', r.badmouth);
    ok(r.faith.outcast >= 1 && r.faith.castThought && r.faith.blas === 'blas', '褻瀆派的宗教領袖把神裔逐出教門', r.faith);
    ok(r.faith.cult && r.faith.saint && r.faith.head && r.faith.inCult && r.faith.stance === 'chosen', '被排擠的神裔創立崇拜神裔的新神教', r.faith);
    ok(r.wed.made && r.wed.mixed && r.wed.boy && r.wed.absent && r.wed.thought, '神裔跟一般人結婚：怕神裔的家人反對、不來婚禮', r.wed);
    ok(r.half.half && Math.abs(r.half.work - 1.5) < 0.01 && r.half.full === 2, '混血神裔：好處只有一半', r.half);
    ok(r.hunt.made && r.hunt.wrong && r.hunt.beat && r.hunt.hurt && r.hunt.hated, '出事又不知道是誰：獵人隊抓錯人、把人打傷', r.hunt);
    ok(r.reveal.wrongful === 1 && r.reveal.flag && r.reveal.verdict && r.reveal.exposed && r.reveal.sympathy && r.reveal.vind, '冤案揭曉：真兇曝光、大家同情、帶頭的人被提案審判', r.reveal);
    ok(r.fine && r.fine.paid === 30 && r.fine.tre === 30 && r.fine.drift === 0, '審判罰款從被告錢包出（守恆）', r.fine);
    ok(r.hunt2.right && r.hunt2.beat === false && r.hunt2.caught === 1, '平權令下抓對人：交給守衛，不能私刑', r.hunt2);
    ok(r.press.pn >= 1 && r.press.pf >= 1 && r.press.fear < 0 && r.press.fair > 0 && r.press.story, '八卦報炒作恐慌、革新報替神裔平反，讀者看法跟著變', r.press);
    ok(r.elec.fearVsCarrier < -5 && r.elec.allyVsCarrier > 5 && r.elec.fearVsPure > 5, '選舉：怕神裔的人不投神裔、投純人派', r.elec);
    ok(Math.abs(r.fit.fitR - 1.8) < 0.01 && Math.abs(r.fit.fitG - 1.6) < 0.01 && Math.abs(r.fit.fitF - 0.75) < 0.01, '照基因挑工作：夜梟當學者、吸血鬼守夜、吸血鬼白天做粗活不行', r.fit);
    ok(Math.abs(r.fit.disc - 0.48) < 0.01 && Math.abs(r.fit.fair - 1.6) < 0.01 && Math.abs(r.fit.pal - 2.08) < 0.01, '怕神裔的老闆刷掉神裔、神裔老闆偏好神裔；平權令後不准歧視', r.fit);
    ok(r.fired.n === 1 && r.fired.thought, '被怕神裔的老闆辭退會記下來', r.fired);
    ok(r.night.got === 3 && r.night.tre === -3 && r.night.drift === 0, '守夜的吸血鬼領公庫的夜班津貼（守恆）', r.night);
    ok(r.elite.elite && r.elite.lv >= 3, '天生帶著基因又有錢的神裔世家算士紳', r.elite);
    ok(r.rights.prop && r.rights.by && r.rights.vC === 'for' && r.rights.vP === 'against' && r.rights.done, '神裔會提案平權令，神裔贊成、純人派反對，通過後生效', r.rights);
    ok(!r.unban.early && r.unban.prop && r.unban.lifted, '禁令滿一個月後，神裔會提案解除基因禁令', r.unban);
    ok(!r.days, '跑幾天沒有錯誤', r.days);
    ok(r.save.att > 3 && r.save.pure && r.save.rights === true && r.save.hunts >= 1, '神裔社會存讀檔', r.save);
    ok(/純人派|Pure Blood/.test(r.brief) && /混血|half god-blooded/.test(r.brief2) && /純人派|Pure Blood/.test(r.town), 'AI 知道自己的立場、派系、混血', { b: r.brief, b2: r.brief2, t: r.town });
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('detail'); else { app.activeTab = 'detail'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui1 = await page.evaluate(() => { const s = [...document.querySelectorAll('.hb-tag.myth')]; return s.length ? { txt: s.map(x => x.textContent).join(' | '), cjk: s.flatMap(x => x.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui1 && /純人派|Pure Blood/.test(ui1.txt), '村民卡顯示對神裔的看法與派系', ui1);
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui2 = await page.evaluate(() => { const s = document.querySelector('.myth-section .ms-block'); const sec = document.querySelector('.myth-section'); return s ? { txt: s.textContent.slice(0, 200), cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []).filter(x => !/測試/.test(x)), over: sec.scrollWidth > sec.clientWidth + 2, bar: !!s.querySelector('.ms-bar') } : null; });
    ok(!!ui2 && ui2.bar && !ui2.over, '小鎮概況的神話基因卡有神裔社會（看法、派系、宗教、階級、獵人隊）', ui2);
    if (lang === 'en') ok(ui1 && ui2 && !ui1.cjk.length && !ui2.cjk.length, '英文沒有中文', { a: ui1?.cjk, b: ui2?.cjk });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
