// v8.0.0 蒸汽煉金路線
// 科技樹（第四、五時代大家都能研究、第六時代專屬、蒸汽動力兩條路線共用）、門檻（齒輪工坊、煉金工坊、禁造人造人）、
// 村民傾向（礦工鐵匠工會偏蒸汽、醫生農夫怕煙）、很需要人手（職缺變多；發條人偶、人造人才搶工作）、
// 煤煙（累積、散掉、法律與科技減煙、肺病）、社會問題（小事、中事、大黑霧；金流守恆）、法律（提案、投票、執行、效果）、
// 賢者之石與提煉廠（只變貨物、不變銀幣）、災後反應、風氣跟地形、存讀檔、介面（科技分頁、首頁、3D 天空與飛艇；中英、桌機與 390px）
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[(Steam|Tech)\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = () => npcs().filter(a => (a.age ?? 30) >= 18);
      for (const a of npcs()) WALLET.get(w, a);
      let d0 = w._absDay(); const setDay = (n) => { d0 = n; w._absDay = () => n; }; const next = () => setDay(d0 + 1);
      const R = w.research, P = R.projects; const done = (p) => { p.status = 'complete'; p.progress = p.cost; }; const undo = (k) => { P[k].status = 'locked'; P[k].progress = 0; };
      const avail = () => R.getAvailable().map(p => p.key); const tierTo = (n) => { w.tierState.lv = n; };
      const addB = (k) => { if (!TECH.built(w, k)) w.buildings.completed.push({ buildingKey: k, name: BUILDING_TEMPLATES[k].name, level: 1 }); };
      const delB = (k) => { w.buildings.completed = w.buildings.completed.filter(b => b.buildingKey !== k); };
      const st = (e) => Object.values(P).filter(p => TECH.onPath(p.key, 'steam') && p.era === e).map(p => p.key);
      // 1) 科技樹與門檻
      out.tree = { s4: st(4).sort().join(','), s5: st(5).length, s6: st(6).sort().join(','), shared: TECH.onPath('steam_power', 'electro') && TECH.onPath('steam_power', 'steam'), excl: st(6).every(k => TECH.exclusive(k)), paths: TECH.PATH_KEYS().join(',') };
      for (const p of Object.values(P)) if ((p.era || 1) <= 3 && !p.path) done(p); R.refreshLocks(); w.tech = null; TECH.S(w); tierTo(1);
      out.open4 = { sp: avail().includes('steam_power') }; done(P.steam_power); done(P.chemistry); R.refreshLocks(); out.open4.n = avail().filter(k => st(4).includes(k)).length;
      for (const p of Object.values(P)) if ((p.era || 1) === 4 && !TECH.exclusive(p.key)) done(p); R.refreshLocks(); tierTo(2);
      out.open5 = { noGear: !avail().some(k => st(5).includes(k)) }; addB('gear_workshop'); out.open5.gear = avail().filter(k => st(5).includes(k)).length;
      for (const p of Object.values(P)) if (p.era === 5) done(p); R.refreshLocks(); tierTo(3);
      out.open6 = { none: !avail().some(k => st(6).includes(k)) }; TECH.choose(w, 'steam', null, true); R.refreshLocks();
      out.open6.steam = avail().filter(k => st(6).includes(k)).sort().join(','); out.open6.noRocket = !avail().includes('rocketry');
      addB('alchemy_lab'); out.open6.stone = avail().includes('philosopher_stone');
      // 2) 村民傾向:礦工、鐵匠、工會偏蒸汽;醫生、農夫、重視自然的怕煙
      const a0 = adults()[0]; const keep = { j: a0.job, v: a0.personality.values.slice(), t: a0.techStance, age: a0.age };
      const pf = (job, vals) => { a0.job = new Job(job); a0.personality.values = vals || []; a0.techStance = 'moderate'; a0.age = 35; return TECH.prefer(w, a0, 'steam'); };
      out.pref = { miner: pf('miner'), smith: pf('blacksmith'), doctor: pf('doctor'), farmer: pf('farmer'), nature: pf('carpenter', ['自然']), adv: pf('carpenter', ['冒險']) };
      const U = UNION.S(w); U.on = true; U.members = { [a0.agentId]: d0 }; out.pref.union = pf('carpenter') - (U.members = {}, pf('carpenter')); U.on = false;
      w.tech.mk[a0.agentId] = 'laid'; out.pref.laid = pf('tailor'); delete w.tech.mk[a0.agentId]; out.pref.notLaid = pf('tailor');
      a0.job = keep.j; a0.personality.values = keep.v; a0.techStance = keep.t; a0.age = keep.age;
      // 吸引力:工會強的小鎮比較想走蒸汽
      const ap0 = TECH.appeal(w, 'steam'); U.on = true; U.members = Object.fromEntries(adults().slice(0, Math.ceil(adults().length * 0.4)).map(a => [a.agentId, d0])); const ap1 = TECH.appeal(w, 'steam'); U.on = false; U.members = {};
      out.appeal = { ap0, ap1 };
      // 辯論:蒸汽是選項之一;投蒸汽的理由
      { const T = w.tech; T.path = null; w.proposals.items = w.proposals.items.filter(p => p.kind !== 'tech_path'); for (const p of Object.values(P)) if (TECH.exclusive(p.key)) { p.status = 'locked'; p.progress = 0; }
        T.lean = 'steam'; TECH.daily(w); const tp = w.proposals.items.find(p => p.kind === 'tech_path'); const m = adults().find(a => a.job?.key !== 'doctor') || adults()[1]; const jm = m.job; m.job = new Job('miner');
        const v = fix(0.5, () => TECH.voteRule(w, tp, m)); out.debate = { made: !!tp, steam: (tp?.opts || []).includes('steam'), pick: tp?.pick?.[m.agentId], why: tp?.why?.[m.agentId] || v.why, item: tp ? w.proposals.toItem(w, tp).options?.map(o => o.key).join(',') : '' };
        m.job = jm; w.proposals.items = w.proposals.items.filter(p => p.kind !== 'tech_path'); TECH.choose(w, 'steam', null, true); }
      // 3) 很需要人手:職缺變多;發條人偶、人造人才搶工作;禁造之後不再搶
      const jm = (k) => Math.round(TECH.jobMult(w, k) * 1000) / 1000;
      for (const k of ['clockwork_automaton', 'homunculus']) undo(k); for (const k of ['high_pressure', 'gear_works', 'steam_mech']) undo(k); const jb = { miner: jm('miner'), smith: jm('blacksmith') }; for (const k of ['high_pressure', 'gear_works', 'steam_mech']) done(P[k]);
      out.jobs = { miner: Math.round(jm('miner') / jb.miner * 1000) / 1000, smith: Math.round(jm('blacksmith') / jb.smith * 1000) / 1000, farmer: jm('farmer') };
      done(P.homunculus); out.jobs.farmerH = jm('farmer'); STEAM.S(w).homunban = 1; out.jobs.farmerBan = jm('farmer'); STEAM.S(w).homunban = 0; undo('homunculus');
      // 4) 煤煙:累積、散掉、法律與科技減煙、肺病
      const X = STEAM.S(w); X.smog = 0; X.lastDay = null; addB('refinery'); undo('smoke_filter'); const sm = []; for (let i = 0; i < 90; i++) { next(); STEAM.daily(w); } sm.push(Math.round(X.smog));
      const add0 = STEAM.smogAdd(w); w.tech.path = 'electro'; const addE = STEAM.smogAdd(w); w.tech.path = 'bio'; const addBio = STEAM.smogAdd(w); w.tech.path = 'steam'; X.air = 1; const addAir = STEAM.smogAdd(w); done(P.smoke_filter); const addF = STEAM.smogAdd(w); X.air = 0;
      for (const k of ['gear_workshop', 'refinery']) delB(k); undo('high_pressure'); undo('steam_mech'); const add1 = STEAM.smogAdd(w);
      for (let i = 0; i < 60; i++) { next(); STEAM.daily(w); } sm.push(Math.round(X.smog)); out.smog = { sm, add0, addE, addBio, addAir, addF, add1, lung: X.st.lung || 0 };
      done(P.high_pressure); done(P.steam_mech); addB('gear_workshop'); addB('refinery'); undo('smoke_filter');
      // 煙很濃時肺病變多(90 天)
      X.smog = 45; const L0 = X.st.lung || 0; const S45 = X.smog; for (let i = 0; i < 200; i++) { next(); X.smog = S45; X.lastDay = null; STEAM.daily(w); } out.smog.lungHigh = (X.st.lung || 0) - L0;
      X.smog = 5; const L1 = X.st.lung || 0; for (let i = 0; i < 200; i++) { next(); X.smog = 5; X.lastDay = null; STEAM.daily(w); } out.smog.lungLow = (X.st.lung || 0) - L1;
      // 5) 社會問題(小事、中事):都會發生、金流守恆
      addB('alchemy_lab'); addB('airship_dock'); done(P.homunculus); X.smog = 45; w.tech.inc = [];
      const kid = npcs().find(a => (a.age ?? 30) >= 9 && (a.age ?? 30) < 15) || npcs().slice().sort((x, y) => (x.age ?? 30) - (y.age ?? 30))[0]; if (kid) kid.age = 11;
      const flowed = () => MONEY.total(w) - (MONEY.S(w).pend || 0); /* 喪葬等記過帳的金流不算消失 */ const T0 = flowed(); const fired = {}; for (const e of STEAM.EVENTS) { if (e.lv === 'big') continue; try { fired[e.id] = !!(e.need(w) && TECH.fire(w, e)); } catch (x) { fired[e.id] = 'ERR ' + x.message; } }
      out.events = { fired, drift: Math.round((flowed() - T0) * 100) / 100, shock: AFTERMATH.S(w).cur.some(c => c.kind === 'boiler_burst' || c.kind === 'smog_week') };
      // 點金騙局:錢從投資的人轉到騙子(總數不變),一個月後拆穿
      const sc = X.scam; out.scam = { made: !!sc, sum: sc?.sum || 0 }; if (sc) { const T1 = MONEY.total(w); for (let i = 0; i < 31; i++) { next(); X.lastDay = null; STEAM.daily(w); } out.scam.over = !X.scam; out.scam.marked = sc.v.some(id => w.tech.mk[id] === 'scammed'); out.scam.drift = Math.round((MONEY.total(w) - T1) * 100) / 100; }
      // 工廠法讓燙傷少一半
      w.tech.inc = []; const scald = STEAM.EVENTS.find(e => e.id === 'scald'); X.factory = 0; let n0 = 0, n1 = 0; for (let i = 0; i < 40; i++) if (scald.run(w)) n0++; X.factory = 1; for (let i = 0; i < 40; i++) if (scald.run(w)) n1++; X.factory = 0; out.factory = { n0, n1 };
      // 6) 大黑霧:老人和肺不好的人先走、很多人咳、有錢的人搬走、文明倒退、推清潔空氣法、怪罪老闆
      { const old = adults().slice(-3); for (const a of old) a.age = 72; X.smog = 50; X.air = 0; X.lastGreat = -999; X.pendAir = null; const pop0 = npcs().length; const big = STEAM.EVENTS.find(e => e.id === 'great_smog');
        w.clock.season = '冬季'; const own = big.own(w); X.air = 1; const ownLaw = big.own(w); X.air = 0;
        const res = TECH.fire(w, big); out.great = { own, ownLaw, ok: !!res, dead: pop0 - npcs().length, sick: res?.p?.s || 0, pend: X.pendAir != null, shock: AFTERMATH.S(w).cur.some(c => c.kind === 'great_smog'), brief: w.conversationEngine._townBrief(w).includes(t('大黑霧')), smog: Math.round(X.smog) }; }
      // 7) 法律:提案、投票、執行、效果
      w.proposals.items = w.proposals.items.filter(p => !/^steam_/.test(p.kind)); X.pendAir = d0; X.pendFactory = d0; X.pendHomun = d0; X.lastDay = null; STEAM.daily(w);
      const props = w.proposals.items.filter(p => /^steam_/.test(p.kind)); out.laws = { props: props.map(p => p.kind).sort().join(',') };
      const own = adults().find(a => TECH.owner(w, a)); const doc = adults().find(a => a !== own && a.job?.key === 'doctor') || adults().find(a => a !== own);
      const jd = doc.job; doc.job = new Job('doctor'); out.laws.docAir = fix(0.5, () => STEAM.vote(w, { kind: 'steam_air' }, doc)).v; doc.job = jd;
      out.laws.ownAir = own ? fix(0.5, () => STEAM.vote(w, { kind: 'steam_air' }, own)).v : 'against';
      const bs0 = w.buildings.recomputeEffects(w).build_speed || 0;
      for (const p of props) { p.status = 'approved'; w.proposals._execute(w, p, d0); } const eff = w.buildings.recomputeEffects(w);
      out.laws.on = { air: !!X.air, factory: !!X.factory, ban: !!X.homunban, bs: Math.round(((eff.build_speed || 0) - bs0) * 100) / 100 };
      R.refreshLocks(); undo('homunculus'); R.refreshLocks(); out.laws.noHomun = !avail().includes('homunculus');
      // 8) 賢者之石、提煉廠:只變貨物,不變銀幣
      done(P.philosopher_stone); X.lastDay = null; w.stockpile.resources.stone = 50; const s0 = w.stockpile.get('steel') || 0, m0 = w.stockpile.get('metal') || 0, sv0 = MONEY.total(w); next(); STEAM.daily(w);
      out.stone = { stone: 50 - w.stockpile.get('stone'), steel: (w.stockpile.get('steel') || 0) - s0, metal: (w.stockpile.get('metal') || 0) - m0, silver: Math.round((MONEY.total(w) - sv0) * 100) / 100 };
      // 9) 風氣跟地形:礦山偏蒸汽、貿易要道沒有蒸汽
      { const cnt = { electro: 0, bio: 0, steam: 0 }; const per = {}; const B0 = ECON.baseOf; const keepL = w.tech.lean;
        for (const b of ['market', 'harbor', 'mountain', 'forest', 'frontier']) { ECON.baseOf = () => b; per[b] = { electro: 0, bio: 0, steam: 0 }; for (let i = 0; i < 600; i++) { w.tech.lean = null; const k = TECH.leanOf(w); cnt[k]++; per[b][k]++; } }
        ECON.baseOf = B0; w.tech.lean = keepL; out.lean = { cnt, mountain: per.mountain, market: per.market }; }
      // 10) 存讀檔;舊存檔(還沒選路線)的風氣重新抽一次
      { const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = { smog: Math.round(w2.tech?.steam?.smog ?? -1) === Math.round(X.smog), air: !!w2.tech?.steam?.air, path: w2.tech?.path };
        const old = JSON.parse(JSON.stringify(data)); old.tech.path = null; old.tech.lean = 'electro'; old.tech.v80 = 0; const w3 = new World(); w3.loadSave(old); out.save.reroll = w3.tech.lean == null && w3.tech.v80 === 1;
        const kept = JSON.parse(JSON.stringify(data)); kept.tech.lean = 'electro'; kept.tech.v80 = 0; const w4 = new World(); w4.loadSave(kept); out.save.kept = w4.tech.lean === 'electro'; TECH.W = w; }
      // 11) 3D:煙讓天空變暗、蓋了飛艇碼頭有飛艇
      X.smog = 50; app.state = w.getState(); try { app._updateTileMap?.(); } catch (e) {} const tm = app.tileMap; tm.smog = STEAM.sky(w); tm.airship = TECH.built(w, 'airship_dock');
      let bg0 = 0, bg1 = 0; try { const sv = tm.smog; tm.smog = 0; tm._updateLighting(); bg0 = tm.scene.background.r + tm.scene.background.g + tm.scene.background.b; tm.smog = sv; tm._updateLighting(); bg1 = tm.scene.background.r + tm.scene.background.g + tm.scene.background.b; tm._updateSky(0, 'clear', 1); } catch (e) { out.err3d = e.message; }
      out.sky = { smog: Math.round(tm.smog * 100) / 100, ship: !!tm._airship && tm._airship.visible, dark: bg1 < bg0 - 0.05 };
      // 12) 介面:科技分頁(三條路線、煤煙)、首頁
      const mobile = window.innerWidth <= 768; const openTab = async (tab) => { if (mobile) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); };
      const pane = () => (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body;
      app.state = w.getState(); await openTab('econ-tech'); const tt = pane().innerText;
      out.ui = { steam: /蒸汽煉金|Steam Alchemy/.test(tt), smog: /煤煙|Coal smoke/.test(tt), laws: /清潔空氣法|Clean Air Act/.test(tt), later: /之後的版本開放|later version/.test(tt), aether: /以太|Aether/.test(tt) };
      out.ui.cjk = (tt.match(/[一-鿿]+/g) || []).slice(0, 6); out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(tt); out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      return out;
    });
    const T = r.tree;
    ok(T.s4 === 'alchemy,gear_works,high_pressure,pneumatic_tubes,steam_power' && T.s5 === 5 && T.s6 === 'aether_engine,clockwork_automaton,floating_city,homunculus,philosopher_stone' && T.shared && T.excl && T.paths === 'electro,bio,steam', '科技樹：蒸汽（含共用的蒸汽動力）、煉金各五項、以太五項專屬', T);
    ok(r.open4.sp && r.open4.n === 4 && r.open5.noGear && r.open5.gear >= 4, '第四時代大家都能研究；第五時代煉金要齒輪工坊', { o4: r.open4, o5: r.open5 });
    ok(r.open6.none && r.open6.steam === 'aether_engine,clockwork_automaton' && r.open6.noRocket && r.open6.stone, '第六時代專屬：走蒸汽煉金才能研究；賢者之石要煉金工坊', r.open6);
    const p = r.pref;
    ok(p.miner > p.doctor + 2 && p.smith > p.farmer + 1.5 && p.adv > p.nature + 2 && p.union > 1 && p.laid > p.notLaid + 1, '村民傾向：礦工、鐵匠、想冒險的、工會、被機器裁過員的偏蒸汽；醫生、農夫、重視自然的怕煙', p);
    ok(r.appeal.ap1 > r.appeal.ap0 + 0.3, '工會強的小鎮比較想走蒸汽煉金', r.appeal);
    ok(r.debate.made && r.debate.steam && r.debate.pick === 'steam' && r.debate.why === 'steam_hands' && /steam/.test(r.debate.item), '路線大辯論多了蒸汽煉金；礦工投蒸汽，理由是「蒸汽要人手」', r.debate);
    ok(r.jobs.miner >= 1.2 && r.jobs.smith >= 1.2 && r.jobs.farmerH < r.jobs.farmer && r.jobs.farmerBan === r.jobs.farmer, '很需要人手：礦工、鐵匠職缺變多；人造人才搶農夫的工作，禁造之後不再搶', r.jobs);
    const sm = r.smog;
    ok(sm.sm[0] >= 40 && sm.add0 > sm.addBio && sm.addBio > sm.addE && sm.addAir < sm.add0 * 0.55 && sm.addF < sm.addAir && sm.sm[1] < sm.sm[0] / 2, '煤煙：鍋爐、工坊、提煉廠會累積煙（走蒸汽煉金的最多、走電子機械的最少）；清潔空氣法減半、濾煙塔再少；不再冒煙就慢慢散掉', sm);
    ok(sm.lungHigh >= 2 && sm.lungHigh > sm.lungLow, '煙很濃時，咳嗽得肺病的人變多', sm);
    const ev = r.events.fired;
    ok(Object.values(ev).filter(x => x === true).length >= 10 && !Object.values(ev).some(x => typeof x === 'string') && r.events.drift === 0 && r.events.shock, '蒸汽煉金的社會問題都會發生（燙傷、煤灰、咳嗽、送錯信、童工、臭煙、飛艇、鍋爐爆炸、黑霧、點金騙局、機甲失控、人造人要名字），銀幣守恆、村民有災後反應', r.events);
    ok(r.scam.made && r.scam.sum > 0 && r.scam.over && r.scam.marked && r.scam.drift === 0, '點金騙局：一個月後拆穿，被騙的人記住，銀幣守恆', r.scam);
    ok(r.factory.n1 < r.factory.n0 * 0.75, '工廠法：鍋爐燙傷變少', r.factory);
    const g = r.great;
    ok(g.own > 0 && g.ownLaw < g.own * 0.4 && g.ok && g.dead >= 1 && g.sick >= 2 && g.pend && g.shock && g.brief && g.smog < 50, '大黑霧：冬天煙濃才會發生（清潔空氣法降到三分之一）；有人罹難、很多人咳、推清潔空氣法、村民反應、AI 知道', g);
    ok(r.laws.props === 'steam_air,steam_factory,steam_homun' && r.laws.docAir === 'for' && r.laws.ownAir === 'against', '法律提案：清潔空氣法、工廠法、禁造人造人；醫生贊成清潔空氣法、老闆反對', r.laws);
    ok(r.laws.on.air && r.laws.on.factory && r.laws.on.ban && r.laws.on.bs <= -0.05 && r.laws.noHomun, '法律通過後生效：蓋東西慢一點；禁造之後不能再研究人造人', r.laws.on);
    ok(r.stone.stone >= 7 && r.stone.steel >= 1 && r.stone.metal >= 1 && r.stone.silver === 0, '賢者之石與提煉廠：石頭變成鋼和金屬，變不出銀幣', r.stone);
    const L = r.lean;
    ok(L.mountain.steam > L.mountain.electro && L.market.steam === 0 && L.cnt.electro > L.cnt.steam * 1.5 && L.cnt.steam > 400 && L.cnt.bio > 400, '風氣跟地形：礦山偏蒸汽煉金、貿易要道沒有；整體約電子 50%、蒸汽 25%、基因 25%', L);
    ok(r.save.smog && r.save.air && r.save.path === 'steam' && r.save.reroll && r.save.kept, '存讀檔：煤煙、法律、路線都存得住；還沒選路線的舊存檔重新抽風氣，選了的不動', r.save);
    ok(r.sky.smog > 0.5 && r.sky.ship && r.sky.dark && !r.err3d, '3D：煙越濃天空越暗；蓋了飛艇碼頭有飛艇在天上繞', { sky: r.sky, err: r.err3d });
    ok(r.ui.steam && r.ui.smog && r.ui.laws && !r.ui.later && r.ui.aether && !r.ui.undef && !r.ui.overflow, '介面：科技分頁有蒸汽煉金、煤煙、法律、以太時代；不再寫「之後的版本開放」', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文沒有中文', r.ui.cjk);
    // 首頁:科技路線段落介紹蒸汽煉金
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const lp = await page.evaluate(() => { const tx = document.body.innerText; return { steam: /蒸汽煉金|Steam Alchemy/.test(tx), smog: /大黑霧|Great Smog/.test(tx), later: /會在之後的版本開放|opens in a later version/.test(tx), v80: /v8\.0/.test(tx) }; });
    ok(lp.steam && lp.smog && !lp.later && lp.v80, '首頁：介紹蒸汽煉金、大黑霧，路線圖寫 v8.0', lp);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
