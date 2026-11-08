// v7.9.0 基因生物路線＋路線大辯論＋災後反應＋城鎮科技軟綁定
// 科技樹（第四、五時代大家都能研究、第六時代專屬）、多選一辯論（村民各投自己想走的、維持傳統、勝者）、
// 基因生物的社會問題（金流守恆）、法律提案與執行、實驗室外洩（自動疫情、不花神力）、
// 災後反應（群體傳染、搶劫門檻、旁觀者效應、金流守恆、抗議把提案提早）、城鎮升級要科技／剛升格不降級、
// 舊存檔（v7.8 自動判定的電子機械空出來）、存讀檔、介面（科技分頁、提案卡多選一；中英、桌機與 390px）
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
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = () => npcs().filter(a => (a.age ?? 30) >= 18);
      for (const a of npcs()) WALLET.get(w, a);
      let d0 = w._absDay(); const setDay = (n) => { d0 = n; w._absDay = () => n; }; const next = () => setDay(d0 + 1);
      const R = w.research, P = R.projects; const done = (p) => { p.status = 'complete'; p.progress = p.cost; };
      const avail = () => R.getAvailable().map(p => p.key); const tierTo = (n) => { w.tierState.lv = n; };
      // 1) 科技樹:第四、五時代大家都能研究,第六時代專屬
      const exc = Object.values(P).filter(p => TECH.exclusive(p.key)); const bio = (e) => Object.values(P).filter(p => TECH.onPath(p.key, 'bio') && p.era === e).map(p => p.key);
      out.tree = { bio4: bio(4).length, bio5: bio(5).length, bio6: bio(6).length, excBio: exc.filter(p => TECH.onPath(p.key, 'bio')).map(p => p.key).sort().join(','), excEl: exc.filter(p => TECH.onPath(p.key, 'electro')).map(p => p.key).sort().join(','), bldg: ['breeding_farm', 'pharma_works', 'seed_vault'].every(k => BUILDING_TEMPLATES[k]), micro: P.microbiology.prerequisites.join(','), nuke: P.nuclear_weapons.prerequisites.slice().sort().join(',') };
      for (const p of Object.values(P)) if ((p.era || 1) <= 3 && !p.path) done(p); R.refreshLocks(); w.tech = null; TECH.S(w);
      tierTo(1); out.open4 = { bio: avail().filter(k => bio(4).includes(k)).length, el: avail().includes('steam_power'), path: TECH.pathOf(w) };
      for (const p of Object.values(P)) if ((p.era || 1) === 4 && !TECH.exclusive(p.key)) done(p); R.refreshLocks();
      tierTo(2); out.open5 = { noInst: !avail().includes('microbiology'), elec: avail().includes('electricity') };
      w.buildings.completed.push({ buildingKey: 'institute', name: BUILDING_TEMPLATES.institute.name, level: 1 }); tierTo(2); out.open5.inst = avail().includes('microbiology');
      for (const p of Object.values(P)) if (p.era === 5) done(p); R.refreshLocks(); tierTo(3);
      out.open6 = { none: !avail().some(k => TECH.exclusive(k)) }; TECH.choose(w, 'electro', null, true); R.refreshLocks(); out.open6.el = avail().includes('rocketry') && !avail().includes('gene_editing');
      w.tech.path = null; TECH.choose(w, 'bio', null, true); R.refreshLocks(); out.open6.bio = avail().includes('gene_editing') && !avail().includes('rocketry'); out.open6.cost = P.rocketry.cost === RESEARCH_TREE.rocketry.cost;
      // 2) 路線大辯論:多選一
      w.tech = null; TECH.S(w); for (const p of Object.values(P)) if ((p.era || 1) >= 4) { p.status = 'locked'; p.progress = 0; } R.refreshLocks(); w.proposals.items = w.proposals.items.filter(p => p.kind !== 'tech_path');
      TECH.daily(w); const tp = w.proposals.items.find(p => p.kind === 'tech_path'); w.tech.lean = 'none'; /* 先拿掉小鎮風氣,只看個人傾向 */
      const doc = adults().find(a => a.job?.key === 'doctor') || adults()[1]; const rs = adults().find(a => a.job?.key === 'researcher' && a !== doc) || adults()[2]; const keepD = { j: doc.job, s: doc.techStance }, keepR = { j: rs.job, s: rs.techStance };
      doc.job = new Job('doctor'); doc.age = 60; doc.techStance = 'moderate'; rs.job = new Job('researcher'); rs.techStance = 'progressive'; rs.age = 25;
      const vd = fix(0.5, () => TECH.voteRule(w, tp, doc)), vr = fix(0.5, () => TECH.voteRule(w, tp, rs));
      out.debate = { made: !!tp, opts: tp?.opts?.slice().sort().join(','), title: tp ? w.proposals.title(tp) : '', doc: tp.pick?.[doc.agentId], rs: tp.pick?.[rs.agentId], dv: vd.v, rv: vr.v };
      doc.job = keepD.j; doc.techStance = keepD.s; rs.job = keepR.j; rs.techStance = keepR.s;
      tp.votes = {}; tp.pick = {}; const ids = adults().map(a => a.agentId); ids.forEach((id, i) => { if (i % 4 === 3) tp.votes[id] = 'against'; else { tp.votes[id] = 'for'; tp.pick[id] = i % 4 === 0 ? 'electro' : 'bio'; } });
      const tl = TECH.tally(tp); out.debate.tally = tl; out.debate.winner = TECH.winnerOf(w, tp);
      tp.status = 'approved'; w.proposals._execute(w, tp, w._absDay()); out.debate.path = w.tech.path; out.debate.item = w.proposals.toItem(w, tp).options?.length;
      // 風氣:電子機械 2、基因生物 1 的權重
      { const cnt = { electro: 0, bio: 0, steam: 0 }; const B0 = ECON.baseOf; const per = {}; for (const b of ['market', 'harbor', 'mountain', 'forest', 'frontier']) { ECON.baseOf = () => b; per[b] = { electro: 0, bio: 0, steam: 0 }; for (let i = 0; i < 300; i++) { w.tech.lean = null; const k = TECH.leanOf(w); cnt[k]++; per[b][k]++; } } ECON.baseOf = B0; out.lean = cnt; out.leanPer = per; w.tech.lean = 'none'; }
      // 維持傳統 → 30 天後再辯論
      w.tech = null; TECH.S(w); w.proposals.items = w.proposals.items.filter(p => p.kind !== 'tech_path'); TECH.daily(w); const tp2 = w.proposals.items.find(p => p.kind === 'tech_path'); tp2.status = 'rejected'; w.tech.lastDay = null; next(); TECH.daily(w);
      const n2 = w.proposals.items.filter(p => p.kind === 'tech_path').length; for (let i = 0; i < 12; i++) { next(); w.tech.lastDay = null; TECH.daily(w); }
      out.keep = { path: w.tech.path, wait: w.tech.nextDebate - d0, again: w.proposals.items.filter(p => p.kind === 'tech_path').length > n2 };
      // 3) 基因生物的社會問題(金流守恆)、法律
      w.tech = null; TECH.S(w); for (const p of Object.values(P)) if ((p.era || 1) <= 5) done(p); R.refreshLocks(); TECH.choose(w, 'bio', null, true);
      for (const k of ['pharma_works', 'breeding_farm']) w.buildings.completed.push({ buildingKey: k, name: BUILDING_TEMPLATES[k].name, level: 1 });
      const T0 = MONEY.total(w); const fired = {}; for (const e of BIO.EVENTS) { if (e.lv === 'big') continue; try { fired[e.id] = !!(e.need(w) && TECH.fire(w, e)); } catch (x) { fired[e.id] = 'ERR ' + x.message; } }
      out.events = { fired, drift: Math.round((MONEY.total(w) - T0) * 100) / 100 };
      w.wallet.bal = w.wallet.bal || {}; const sick = adults()[3]; const T1 = MONEY.total(w); const hp = HEALTH.pay(w, sick, 20, 'test', adults().find(a => a.job?.key === 'doctor')); w.tech.bio.price = 1; const T2 = MONEY.total(w); HEALTH.pay(w, sick, 20, 'test', adults().find(a => a.job?.key === 'doctor')); w.tech.bio.price = 0;
      out.price = { drift: Math.round((MONEY.total(w) - T1) * 100) / 100 };
      const B = BIO.S(w); B.risk = 2; B.lastLaw = -99; w.proposals.items = w.proposals.items.filter(p => !/^bio_/.test(p.kind)); BIO.daily(w); B.pendHalt = d0; B.pendPrice = d0; BIO.daily(w);
      out.laws = { props: w.proposals.items.filter(p => /^bio_/.test(p.kind)).map(p => p.kind).sort().join(',') };
      const vic = adults()[4]; w.tech.mk[vic.agentId] = 'leak0'; const rsr = adults().find(a => a.job?.key === 'researcher') || adults()[5];
      out.laws.vHalt = fix(0.5, () => BIO.vote(w, { kind: 'bio_halt' }, vic)).v; const jr = rsr.job; rsr.job = new Job('researcher'); out.laws.rHalt = fix(0.5, () => BIO.vote(w, { kind: 'bio_halt' }, rsr)).v; rsr.job = jr;
      for (const k of ['bio_safety', 'bio_gmban', 'bio_halt']) BIO.setLaw(w, k); w.buildings.recomputeEffects(w); R.refreshLocks();
      out.laws.halt = !avail().some(k => TECH.onPath(k, 'bio') && P[k].era === 6); out.laws.safe = BIO.EVENTS.find(e => e.id === 'lableak').own(w) <= 0.03 / 60 * 0.34 * B.risk + 1e-9;
      // 4) 實驗室外洩:自動疫情(不花神力)→ 災後反應
      for (const k of ['bio_safety', 'bio_gmban', 'bio_halt']) delete B[k === 'bio_safety' ? 'law' : k === 'bio_gmban' ? 'gmban' : 'halt']; CALAMITY.S(w).cur = null; const pw = CALAMITY.S(w).power;
      const lr = TECH.fire(w, BIO.EVENTS.find(e => e.id === 'lableak')); const X = CALAMITY.S(w).cur;
      out.leak = { ok: !!lr, natural: X?.natural, power: CALAMITY.S(w).power === pw, shock: AFTERMATH.S(w).cur.some(c => c.kind === 'lableak') };
      // 5) 災後反應:群體傳染、搶劫門檻、旁觀者效應、金流守恆
      const AF = AFTERMATH; const C = AF.S(w); const a1 = adults()[6]; const fr = adults().filter(b => b !== a1).slice(0, 4);
      SOCIAL.circleOf = ((orig) => (ww, a, id) => (a === a1 && fr.some(b => b.agentId === id)) ? 1 : orig(ww, a, id))(SOCIAL.circleOf);
      const cr = AF.shock(w, { kind: 'meltdown', sev: 3, who: [adults()[7]] }); const base = fix(0.5, () => AF.scores(w, a1, cr, d0)).protest;
      for (const b of fr) C.did[b.agentId] = [d0, 'protest', cr.id]; const peer = fix(0.5, () => AF.scores(w, a1, cr, d0)).protest; for (const b of fr) delete C.did[b.agentId];
      const honest = adults()[8]; honest.__h = 1; const DH = DARK.honesty; DARK.honesty = (a) => a.__h ? 4.5 : DH(a); WALLET.take(w, honest, Math.max(0, WALLET.get(w, honest) - 2)); w.wallet.bal[adults()[0].agentId] += 0; const thrH = AF.lootThr(w, honest); DARK.honesty = DH;
      const vol0 = fix(0.5, () => AF.scores(w, a1, cr, d0)).volunteer; cr.n.volunteer = 6; const vol1 = fix(0.5, () => AF.scores(w, a1, cr, d0)).volunteer; cr.n.volunteer = 0;
      out.group = { base, peer, thrH, vol0, vol1 };
      const T3 = MONEY.total(w); for (let i = 0; i < 9; i++) { next(); AF.daily(w); } out.group.drift = Math.round((MONEY.total(w) - T3) * 100) / 100; out.group.acts = Object.values(C.st).reduce((x, y) => x + y, 0); out.group.hist = C.hist.length;
      // 完整智能體模式:壓力最大的 8 人整批交給 AI(一天一次);AI 沒回應就照規則
      { const ce = w.conversationEngine; const _fa = w.fullAgentMode, _ok = ce.fullAgentOk, _aj = ce._askJson; let asked = '', calls = 0;
        w.fullAgentMode = true; ce.fullAgentOk = () => true; ce._askJson = async (p) => { asked = p; calls++; return [{ i: 1, r: 'protest', line: '要給個交代' }, { i: 2, r: 'protest', line: '不能再這樣' }, { i: 3, r: 'none' }]; };
        w.crisis = null; AF.shock(w, { kind: 'meltdown', sev: 3, who: [adults()[9]] }); next(); AF.daily(w); await new Promise(r => setTimeout(r, 80)); const C2 = AF.S(w);
        const rows = asked.split('\n').filter(l => /^\d+\. /.test(l)).length; const lg = (w.messageLog || []).slice(-40).map(m => m.content || '').join('\n');
        ce._askJson = async () => { throw new Error('x'); }; w.crisis = null; AF.shock(w, { kind: 'meltdown', sev: 3, who: [adults()[9]] }); next(); AF.daily(w); await new Promise(r => setTimeout(r, 50)); next(); AF.daily(w); const fb = Object.values(AF.S(w).st).reduce((x, y) => x + y, 0);
        w.fullAgentMode = _fa; ce.fullAgentOk = _ok; ce._askJson = _aj; out.ai = { calls, rows, acts: C2.st.aiActs || 0, said: /要給個交代|不能再這樣|demand answers/.test(lg), fallback: fb }; }
      w.crisis = null;
      // 抗議三人以上:相關提案提早(核災→廢核)
      w.tech.pendAbandon = null; const cr2 = AF.shock(w, { kind: 'meltdown', sev: 3, who: [] }); for (const b of adults().slice(0, 3)) AF.act(w, b, 'protest', cr2); out.group.pend = w.tech.pendAbandon === w._absDay();
      // 6) 城鎮跟科技軟綁定:人口夠但科技不夠不能升;剛升格不降級
      const TS = TIERS.S(w); const met0 = TIERS.met; TIERS.met = () => 3; for (const p of Object.values(P)) if ((p.era || 1) >= 4 && p.key !== 'refine') { p.status = 'locked'; p.progress = 0; } tierTo(1); TS.up = 0; TS.since = d0 - 100;
      for (let i = 0; i < 4; i++) { next(); TIERS.daily(w); } const lvA = TS.readySince == null ? TS.lv : 'ready';
      for (const p of Object.values(P)) if ((p.era || 1) === 4) done(p); for (let i = 0; i < 4; i++) { next(); TIERS.daily(w); } const lvB = TS.readySince != null ? 2 : TS.lv; /* 夠格了(接著要提案、備料) */
      TIERS.met = () => 1; tierTo(2); TS.since = d0; TS.down = 0; for (let i = 0; i < 15; i++) { next(); TIERS.daily(w); } const lvC = TS.lv; TIERS.met = met0;
      out.tier = { lvA, lvB, lvC, cap: TIERS.techCap(w) };
      // 7) 舊存檔:v7.8 自動判定的電子機械(沒投過票、沒研究專屬科技)空出來
      w.tech = { path: 'electro', since: 3, yes: 0, no: 0, tries: 0 }; for (const p of Object.values(P)) if (TECH.exclusive(p.key)) { p.status = 'locked'; p.progress = 0; } const data = w.serialize(); delete data.tech.v79; const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data)));
      out.old = { path: w2.tech?.path || null };
      w.tech = { path: 'electro', since: 3, yes: 9, no: 4, tries: 0, bio: { law: 5 } }; const d3 = w.serialize(); const w3 = new World(); w3.loadSave(JSON.parse(JSON.stringify(d3))); out.old.kept = w3.tech?.path; out.old.bio = w3.tech?.bio?.law; out.old.crisis = !!w3.crisis;
      // 8) 介面:科技分頁、提案卡多選一
      w.tech = null; TECH.S(w); w.proposals.items = w.proposals.items.filter(p => p.kind !== 'tech_path'); for (const p of Object.values(P)) if ((p.era || 1) >= 4) { p.status = 'locked'; p.progress = 0; } R.refreshLocks(); TECH.daily(w);
      const tp3 = w.proposals.items.find(p => p.kind === 'tech_path'); for (const a of adults()) w.proposals._ruleVote(w, tp3, a);
      app.state = w.getState(); const mobile = window.innerWidth <= 768;
      const openTab = async (tab) => { if (mobile) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); };
      const pane = () => (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body;
      await openTab('econ-tech'); const tt = pane().innerText;
      out.ui = { paths: /基因生物|Genetic biology|Bio/.test(tt) && /電子機械|Electro/.test(tt), excl: /專屬|Exclusive/.test(tt), lab: !!document.querySelector('[data-gh="tab"][data-v="lab"]') };
      await openTab('proposals'); await new Promise(r => setTimeout(r, 200)); const card = [...document.querySelectorAll('.pp-opts')]; out.ui.opts = card.length; out.ui.optRows = card[0]?.querySelectorAll('.pp-opt').length || 0;
      const txt = tt + '\n' + (card[0]?.innerText || ''); out.ui.cjk = (txt.match(/[一-鿿]+/g) || []).slice(0, 6); out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(txt); out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      return out;
    });
    const T = r.tree;
    ok(T.bio4 === 5 && T.bio5 === 7 && T.bio6 === 5 && T.excBio === 'gene_editing,gene_stabilizer,life_extension,myth_genome,synthetic_life' && T.excEl === 'ai_agent,nuclear_weapons,quantum_computer,rocketry,satellite,space_station' && T.bldg && T.micro === 'pharmacology,epidemiology' && T.nuke === 'nuclear_fission,rocketry', '科技樹：基因生物育種 5、生技 7、基因 5；第六時代專屬（電子機械 6、基因生物 5）；核子武器要火箭＋核分裂；三種新建築', T);
    ok(r.open4.bio >= 2 && r.open4.el && !r.open4.path, '還沒選路線，兩條路線的第四時代都能研究', r.open4);
    ok(r.open5.noInst && r.open5.elec && r.open5.inst, '第五時代：生技要研究院，電力不用；大家都能研究', r.open5);
    ok(r.open6.none && r.open6.el && r.open6.bio && r.open6.cost, '第六時代專屬：沒選路線都不能研究；電子機械只有火箭、基因生物只有基因編輯；基礎科技原價', r.open6);
    ok(r.debate.made && /bio/.test(r.debate.opts) && /electro/.test(r.debate.opts) /* v8.0.0 蒸汽煉金也可能在選項裡 */ && r.debate.doc === 'bio' && r.debate.rs === 'electro' && r.debate.dv === 'for' && r.debate.rv === 'for', '路線大辯論多選一：老醫生投基因生物、年輕研究員投電子機械', r.debate);
    ok(r.debate.winner === 'bio' && r.debate.path === 'bio' && r.debate.tally.keep > 0 && r.debate.item >= 3, '得票最多的路線勝出；提案卡列出每個選項的票數', r.debate);
    ok(r.lean.electro > r.lean.bio * 1.5 && r.lean.electro < r.lean.bio * 2.6 && r.leanPer.market.electro > 240 && r.leanPer.forest.bio > 150 && r.leanPer.frontier.bio > 120 && r.leanPer.mountain.steam > r.leanPer.mountain.electro /* v8.0.0 森林:電子 .2／蒸汽 .2／基因 .6 */, '小鎮風氣跟地形走：貿易要道多半電子機械、森林與農地偏基因生物；整體約三分之二比三分之一（蒸汽煉金上線後約 50／25／25）', { all: r.lean, per: r.leanPer });
    ok(!r.keep.path && r.keep.wait >= 15 && !r.keep.again, '否決＝維持傳統：不強制，30 天後才再辯論', r.keep);
    ok(Object.values(r.events.fired).filter(x => x === true).length >= 7 && !Object.values(r.events.fired).some(x => typeof x === 'string') && r.events.drift === 0, '基因生物的社會問題都會發生（藥廠排污、實驗羊、基因歧視、騙子…），銀幣守恆', r.events);
    ok(r.price.drift === 0, '藥價管制：看診少付，銀幣守恆', r.price);
    ok(['bio_halt', 'bio_price', 'bio_safety'].every(k => r.laws.props.split(',').includes(k)) && r.laws.vHalt === 'for' && r.laws.rHalt === 'against' && r.laws.halt && r.laws.safe, '法律：生物安全法、藥價管制、停止人體實驗會被提出；受害者支持停止實驗、研究員反對；第六時代停擺；外洩機率降到三分之一', r.laws);
    ok(r.leak.ok && r.leak.natural && r.leak.power && r.leak.shock, '實驗室外洩：自動跑一場疫情、不花神力，村民開始反應', r.leak);
    ok(r.group.peer > r.group.base + 1 && r.group.thrH >= 0.5 && r.group.vol1 < r.group.vol0, '群體動力學：好朋友都去抗議自己也更想去；老實人的搶劫門檻高；已經很多人幫忙時出手意願下降', r.group);
    ok(r.group.drift === 0 && r.group.acts > 3 && r.group.hist >= 1 && r.group.pend, '災後反應金流守恆、會有人反應、結束後有總結；抗議三人以上把廢核提早推上議程', r.group);
    ok(r.ai.calls === 1 && r.ai.rows >= 3 && r.ai.rows <= 8 && r.ai.acts >= 2 && r.ai.said && r.ai.fallback > 0, '完整智能體模式：出大事那天壓力最大的人整批交給 AI（一次請求、最多 8 人、照 AI 的選擇和台詞反應）；AI 沒回應就照規則', r.ai);
    ok(r.tier.lvA === 1 && r.tier.lvB === 2 && r.tier.lvC === 2, '城鎮跟科技軟綁定：科技不夠不能升城市；剛升格的 60 天內不降級', r.tier);
    ok(!r.old.path && r.old.kept === 'electro' && r.old.bio === 5, '舊存檔：v7.8 自動判定的電子機械空出來讓大家辯論；投票選的保留；基因生物的法律存得住', r.old);
    ok(r.ui.paths && r.ui.excl && r.ui.opts >= 1 && r.ui.optRows >= 3 && !r.ui.undef && !r.ui.overflow, '介面：科技分頁兩條路線、專屬標示；提案卡多選一', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文沒有中文', r.ui.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
