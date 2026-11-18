// v11.3.0 空閒做什麼、去哪、找誰聊、約人可以拒絕：照個性與當下狀況，不擲骰（sim-day.js）
//   1) 去哪：害羞愛看書的人偏圖書館、朋友在哪就想去哪、仇人在的地方避開、天氣差不往外跑、行程上寫的地方優先；挑定後一陣子不換
//   2) 人真的去了挑的地方
//   3) 找誰聊：先找最要好的，聊過的往後排
//   4) 約人：對方很累就說改天（不會被硬拉走）；交情好又有精神就答應，兩個人去同一個地方待上一陣子；兩天內不重複約
//   5) 聊僵：兩個和氣又要好的人不會無故鬧僵；刻薄、心情差、宿醉的仇人會，而且同一對一天最多一次
//   6) 心動：浪漫的人聊得來會心動，隔幾天才會再有；交情不夠、性子也不特別合的不會
//   7) 沒開觀察者模式時照舊；放著跑 10 天沒有錯誤
//   8) 糧倉容量跟著城鎮等級；9) 其他寫死的數字也跟著規模長（30 人的村莊照舊、118 人的城市變大）：原料保底、多出來才賣的線、堆太多放慢、宴席與被搶的糧食、來襲強度、提案上限、拿藥人數、擠兌門檻
//   10) 夠格升格但建材不夠：升格案照樣提、通過後公庫買齊再升格，建材只付一次
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const out = {}; try {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerToast = () => {};
      const w = app.world; const cjk = (s) => /[一-鿿]/.test(String(s || ''));
      const fresh = (seed) => { w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 1, { seed }); WALLET.S(w); DAY.S(w); try { if (w.weather) w.weather.moodModifier = 0; } catch (e) {} };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
      const setT = (a, ...tr) => { a.personality.traits = tr; }; const rel = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
      const clearRel = (a) => { for (const id of Object.keys(a.relationships.relationships)) a.relationships.relationships[id].affinity = 0; };
      const R0 = Math.random; const fix = (v) => { Math.random = () => v; }; const unfix = () => { Math.random = R0; };
      fresh(7); const [A, B, C, D] = npcs().filter(a => !a.personality.traits.includes('night_owl')); for (const x of [A, B, C, D]) { clearRel(x); x.needs.social = 60; x.needs.recreation = 60; x.needs.rest = 80; x.mood = 60; x.activity = 'wandering'; x.dailyPlan = null; }
      // 1) 去哪
      const PL = ['library', 'park', 'chapel'].find(k => !w.townMap?.locations || w.townMap.locations[k]) || 'park'; out.PL = PL; // 行程要去的地方：挑這個鎮真的有的
      setT(A, 'shy', 'curious'); B.currentLocation = 'x1'; C.currentLocation = 'x2'; D.currentLocation = 'x3'; const c0 = DAY.freeCtx(w, A);
      out.shy = { lib: DAY.freeScore(w, A, 'recreation', 'library', c0), tav: DAY.freeScore(w, A, 'socializing', 'tavern', c0) };
      setT(A); rel(A, B).affinity = 60; rel(A, C).affinity = 60; B.currentLocation = 'park'; C.currentLocation = 'park'; B.activity = 'wandering'; C.activity = 'wandering';
      { const c = DAY.freeCtx(w, A); out.friend = { park: DAY.freeScore(w, A, 'socializing', 'park', c), sq: DAY.freeScore(w, A, 'socializing', 'town_square', c), n: c.friends.park }; }
      rel(A, D).affinity = -60; D.currentLocation = 'tavern'; D.activity = 'wandering'; { const c = DAY.freeCtx(w, A); out.foe = { tav: DAY.freeScore(w, A, 'socializing', 'tavern', c), sq: DAY.freeScore(w, A, 'socializing', 'town_square', c), n: c.foes.tavern }; }
      { const c = DAY.freeCtx(w, A); c.bad = true; c.friends = {}; c.foes = {}; out.rain = { park: DAY.freeScore(w, A, 'wandering', 'park', c), home: DAY.freeScore(w, A, 'wandering', 'home', c) }; }
      A.dailyPlan = { key: `${w.clock.year}-${w.clock.season}-${w.clock.day}`, llm: true, goals: [], blocks: [{ time: '00:00', text: zhText(), steps: [] }] }; function zhText() { const en = typeof LLM_LANG !== 'undefined' && LLM_LANG.get && LLM_LANG.get() === 'en'; return { library: en ? 'Read at the library all day' : '整天待在圖書館看書', park: en ? 'Take a long walk in the park' : '去公園散步一整天', chapel: en ? 'Pray at the chapel' : '去禮拜堂祈禱' }[PL]; }
      rel(A, B).affinity = 0; rel(A, C).affinity = 0; rel(A, D).affinity = 0; out.planLoc = DAY.freeCtx(w, A).planLoc; fix(0.5); A._free = null; const p1 = DAY.freePick(w, A, false); const p2 = DAY.freePick(w, A, false); unfix(); out.pick = { loc: p1 && p1.loc, same: p1 === p2, led: DAY.S(w).st.planLed, top: (() => { const c = DAY.freeCtx(w, A); return [['socializing', 'tavern'], ['recreation', 'library'], ['socializing', 'town_square'], ['socializing', 'chapel'], ['socializing', 'home']].map(([x, y]) => y + ':' + Math.round(DAY.freeScore(w, A, x, y, c) * 100) / 100).join(' ') + ' habit=' + c.habit + ' piety=' + c.piety + ' fr=' + JSON.stringify(c.friends); })() };
      // 2) 人真的去了
      { let h = 0; while (!(w.clock.hour === 19 && w.clock.minute === 0) && h++ < 200) { w.paused = false; w.tick(); } A.dailyPlan = { key: `${w.clock.year}-${w.clock.season}-${w.clock.day}`, llm: true, goals: [], blocks: [{ time: '00:00', text: zhText(), steps: [] }] };
        DAY.S(w).t[A.agentId] = { wq: 1, eq: 1, eve: 'free', work: 'go' }; let at = 0, n = 0; for (let i = 0; i < 4; i++) { A.needs.hunger = 90; A.needs.rest = 80; A.needs.social = 60; A.needs.recreation = 60; A._pendingHangout = null; A._hangHold = null; w.paused = false; w.tick(); n++; if (A.currentLocation === PL) at++; } out.goes = { at, n, act: A.activity, hour: w.clock.hour }; }
      // 3) 找誰聊
      fresh(9); { const [a, b, c, d] = npcs(); for (const x of [a, b, c, d]) clearRel(x); rel(a, b).affinity = 70; rel(a, c).affinity = 20; rel(a, d).affinity = -40; fix(0.5); const seq = []; for (let i = 0; i < 4; i++) seq.push(DAY.pickTalk(w, a, [b, c, d]).agentId); unfix(); out.talk = { first: seq[0] === b.agentId, hasC: seq.includes(c.agentId), noD: !seq.includes(d.agentId), seq: seq.map(x => x === b.agentId ? 'b' : x === c.agentId ? 'c' : 'd').join('') }; }
      // 4) 約人
      fresh(11); { const [a, b] = npcs(); clearRel(a); clearRel(b); rel(a, b).affinity = 60; rel(b, a).affinity = 60; a.needs.social = 40; a.needs.rest = 80; b.needs.social = 60; b.needs.rest = 20; a._pendingHangout = b._pendingHangout = null; a._hangHold = b._hangHold = null;
        const no = DAY.invite(w, a, b); out.inviteNo = { r: no, pend: !!b._pendingHangout, st: DAY.S(w).st.inviteNo, mem: /改天|another day/.test((a.memory.entries.slice(-1)[0] || {}).content || '') };
        const again = DAY.invite(w, a, b); out.inviteCool = again;
        DAY.S(w).inv = {}; b.needs.rest = 80; const yes = DAY.invite(w, a, b); out.inviteYes = { r: yes, same: !!a._pendingHangout && a._pendingHangout.location === b._pendingHangout?.location, spot: a._pendingHangout?.location, st: DAY.S(w).st.invite };
        const R1 = Math.random; let calls = 0; Math.random = () => { calls++; return R1(); }; DAY.S(w).inv = {}; a._pendingHangout = b._pendingHangout = null; DAY.invite(w, a, b); Math.random = R1; out.inviteDice = calls; }
      // 5) 聊僵
      fresh(13); { const [a, b] = npcs(); setT(a, 'kind'); setT(b, 'kind'); clearRel(a); clearRel(b); rel(a, b).affinity = 60; rel(b, a).affinity = 60; a.mood = b.mood = 70; a.needs.hunger = b.needs.hunger = 80; a.needs.rest = b.needs.rest = 80; let n = 0; for (let i = 0; i < 60; i++) { DAY.S(w).t = {}; if (DAY.sours(w, a, b)) n++; } out.sourKind = n;
        setT(a, 'abrasive'); setT(b, 'shy'); rel(a, b).affinity = -40; rel(b, a).affinity = -40; a.mood = b.mood = 20; DAY.S(w).hang[a.agentId] = { d: DAY.S(w).d, lv: 2 }; let m = 0; for (let i = 0; i < 60; i++) { DAY.S(w).t = {}; if (DAY.sours(w, a, b)) m++; } out.sourBad = m; DAY.S(w).t = {}; const s1 = DAY.sours(w, a, b), s2 = DAY.sours(w, a, b); out.sourOnce = { s1, s2 }; }
      // 6) 心動
      fresh(15); { const [a, b, c] = npcs(); setT(a, 'romantic'); setT(b); setT(c); clearRel(a); clearRel(b); clearRel(c); rel(a, b).affinity = 30; rel(b, a).affinity = 30; out.spark = { first: DAY.sparks(w, a, b), again: DAY.sparks(w, a, b) }; setT(a); rel(b, c).affinity = 10; rel(c, b).affinity = 10; out.sparkNo = DAY.sparks(w, b, c); rel(b, c).affinity = 50; rel(c, b).affinity = 50; out.sparkClose = DAY.sparks(w, b, c); }
      // 8) 糧倉：跟著城鎮等級長大、畫面與結算用同一個數字、爆倉越多越有人提議賣、種田的放慢
      fresh(21); { const T0 = TIERS.S(w); const lv0 = T0.lv || 0; const sb = w.buildings.getEffect('storage_bonus', 0) || 0, fc = w.buildings.getEffect('food_capacity', 0) || 0;
        T0.lv = 0; const c0 = foodCapOf(w); T0.lv = 2; const c2 = foodCapOf(w); const raw2 = foodCapOf(w, true); out.cap = { c0, c2, exp0: Math.round((400 + fc) * (1 + sb)), exp2: Math.round((2400 + fc) * (1 + sb)), raw2, expRaw: 2400 + fc };
        out.spoil = { r: foodSpoilRate(w), exp: 0.05 * Math.max(0, 1 + (w.buildings.getEffect('food_decay', 0) || 0)) * (typeof ECON !== 'undefined' ? ECON.saltDecay(w) : 1) };
        const day = w._absDay(); const wt = (n) => { w.stockpile.resources.food = n; w.proposals.cooldown = {}; const c = (w.proposals._candidates(w, day + 50 + Math.round(n / 100)) || []).find(x => x.key === 'market:sell:food'); return c ? Math.round(c.weight * 100) / 100 : null; };
        out.sellW = { under: wt(Math.round(c2 * 0.8)), little: wt(Math.round(c2 * 1.2)), huge: wt(c2 * 12) };
        w.stockpile.resources.food = Math.round(FLOW.want(w, 'food') * 2); const d2 = FLOW.demandMult(w, 'food'); w.stockpile.resources.food = Math.round(FLOW.want(w, 'food') * 3.5); const d3 = FLOW.demandMult(w, 'food'); out.slow = { d2, d3 };
        // 賣餘糧這一案：投票的人看得到倉庫滿出來；滿出來的鎮不會抽到糧荒，也不會有人提加班下田
        { const cap = foodCapOf(w); const voter = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead && !a.away); const P = { kind: 'market', side: 'sell', refKey: 'food', category: 'economy', votes: {}, proposerId: '__none' };
          w.stockpile.resources.food = Math.round(cap * 0.8); const g0 = w.proposals._glutOf(w, P); w.stockpile.resources.food = Math.round(cap * 4); const g1 = w.proposals._glutOf(w, P);
          let yes = 0; const R0 = Math.random; Math.random = () => 0.5; try { for (const a of Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).slice(0, 30)) { P.votes = {}; P.why = {}; w.proposals._ruleVote(w, P, a); if (P.votes[a.agentId] === 'for') yes++; } } finally { Math.random = R0; }
          const picks = {}; const lt0 = w.trials.lastType; w.trials.lastType = null; for (let i = 0; i < 200; i++) { const k = w.trials._pick(w); picks[k] = (picks[k] || 0) + 1; }
          const tc0 = w.trials.current; w.trials.current = { type: 'famine', status: 'active' }; w.proposals.cooldown = {}; const fullCand = (w.proposals._candidates(w, day + 400) || []).some(x => x.key === 'trial:famine');
          w.stockpile.resources.food = Math.round(cap * 0.3); w.proposals.cooldown = {}; const lowCand = (w.proposals._candidates(w, day + 401) || []).some(x => x.key === 'trial:famine'); let lowPick = 0; for (let i = 0; i < 200; i++) if (w.trials._pick(w) === 'famine') lowPick++;
          w.trials.current = tc0; w.trials.lastType = lt0; out.glut = { g0, g1, yes, n: Math.min(30, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length), famineFull: picks.famine || 0, fullCand, lowCand, lowPick, whyText: t('堆著也是放到壞') }; }
        out.spoilText = [t('超過糧倉容量，多出來的每天壞掉 {p}%'), t('超過糧倉容量，冷藏得好，暫時不會壞')]; T0.lv = lv0; }
      // 9) 跟著規模長的數字：30 人的村莊照舊，118 人的城市變大（原料保底、多出來才賣的線、堆太多放慢、宴席與被搶的糧食、來襲強度、提案上限、拿藥人數、擠兌門檻）
      fresh(23); { const T0 = TIERS.S(w); const lv0 = T0.lv || 0; const E = w.events; const live = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const set = (k, n) => { w.stockpile.resources[k] = n; };
        const sizeTo = (n) => { let g = 0; while (live().length < n && g++ < 400) { try { E._spawnImmigrant(w); w.tickCount++; } catch (e) { break; } } for (const a of live().slice(n)) delete w.agents[a.agentId]; };
        const snap = () => { const o = { pop: live().length, lv: TIERS.S(w).lv }; const day = w._absDay(); const P = w.proposals; const pn = P._npcs(w).length; o.pn = pn;
          const loc = ECON.localRaws(w); o.raw = {}; for (const k of ['wood', 'metal', 'herbs', 'stone']) o.raw[k] = { v: ECON.rawFloor(w, k), base: loc.has(k) ? 40 : 20 };
          o.want = { stone: FLOW.want(w, 'stone'), furniture: FLOW.want(w, 'furniture'), clothing: FLOW.want(w, 'clothing') };
          o.line = { stone: FLOW.keepLine(w, 'stone', 250), paper: FLOW.keepLine(w, 'paper', 250) };
          const sellAt = (n) => { set('stone', n); P.cooldown = {}; return (P._candidates(w, day + 900) || []).some(x => x.key === 'market:sell:stone'); }; o.sell = { at600: sellAt(600), at1100: sellAt(1100) };
          set('stone', 1100); o.glut = Math.round(P._glutOf(w, { kind: 'market', side: 'sell', refKey: 'stone' }) * 100) / 100;
          { const keep = {}; const many = ['stone', 'wood', 'metal', 'cloth', 'herbs', 'tools']; for (const k of many) { keep[k] = w.stockpile.get(k); set(k, 4000 + many.indexOf(k) * 500); } P.cooldown = {}; const sl = (P._candidates(w, day + 901) || []).filter(x => String(x.key).startsWith('market:sell:')); o.manyGlut = { n: sl.length, high: sl.filter(x => x.weight > 1.4).map(x => x.key.split(':')[2]).sort(), top2: sl.slice().sort((x, y) => (y.glut || 0) - (x.glut || 0)).slice(0, 2).map(x => x.key.split(':')[2]).sort() }; for (const k of many) set(k, keep[k]); P.cooldown = {}; }
          { const F0 = MONEY.floors(w), F1 = MONEY.floorsKept(w); o.floor = { stone0: F0.stone, stone: F1.stone, furn0: F0.furniture, furn: F1.furniture, foodSame: F0.food === F1.food }; set('stone', 600); const rs0 = w.stockpile.reserved; w.stockpile.reserved = {}; const g = MONEY.surplusList(w).find(x => x.r === 'stone'); w.stockpile.reserved = rs0; o.floor.extra = g ? g.extra : 0; }
          try { for (const k of ['beer', 'wine', 'furniture', 'bread']) set(k, 0); set('clothing', 90); set('silver', 500); w.autonomy._shop(w); o.shop = Math.round(w.stockpile.get('clothing')); } catch (e) { o.shop = 'err ' + e.message; }
          try { set('clothing', 90); const m0 = w.trade.merchant; w.trade.merchant = { name: 'T', offers: [{ resource: 'clothing', amount: 30, price: 5, isBuying: true }] }; const R1 = Math.random; Math.random = () => 0.9; try { if (typeof PROCURE !== 'undefined') PROCURE.dealMerchant(w, 'sell', null); else w.autonomy._merchant(w); /* v11.5.0 這趟賣不賣改由出面談的人決定（tradeRun）；這裡量的是他選「多出來的賣一半」時的算術，留多少的那條線沒變 */ } finally { Math.random = R1; } o.merch = Math.round(w.stockpile.get('clothing')); w.trade.merchant = m0; } catch (e) { o.merch = 'err ' + e.message; }
          { const T = FLOW.want(w, 'stone'); set('stone', T * 2); const d2 = FLOW.demandMult(w, 'stone'); set('stone', T * 3.5); const d3 = FLOW.demandMult(w, 'stone'); set('stone', T * 0.5); o.dm = { d2, d3, low: FLOW.demandMult(w, 'stone') }; }
          { const m0 = live().map(a => [a, a.mood]); for (const a of live()) a.mood = 40; const feastAt = (n) => { set('food', n); P.cooldown = {}; const c = (P._candidates(w, day + 901) || []).find(x => x.key === 'feast'); return c ? c.make(live()[0]) : null; };
            const big = feastAt(50000); o.feast = { cost: big && big.cost.food, n: big && big.dp.n, text: big ? P._fill(big.dk, big.dp) : '', exp: Math.max(40, Math.round(40 * pn / 30)), lowOk: !!feastAt(Math.max(120, Math.max(40, Math.round(40 * pn / 30)) * 3)), lowNo: !feastAt(Math.max(120, Math.max(40, Math.round(40 * pn / 30)) * 3) - 1) };
            try { set('food', 5000); const p = { id: 'L900', n: 900, kind: 'feast', key: 'feast', status: 'approved', approvedDay: day, cost: { food: big.cost.food }, votes: {}, proposerId: '__none', proposerName: 'x', tk: '辦一桌全鎮的宴席', tp: {} }; P.items.push(p); P._execute(w, p, day); o.feast.ate = Math.round(5000 - w.stockpile.get('food')); P.items = P.items.filter(x => x !== p); w.stockpile.reserved = {}; } catch (e) { o.feast.ate = 'err ' + e.message; }
            for (const [a, m] of m0) a.mood = m; }
          { const jobs0 = live().map(a => [a, a.job]); const bd = (w.buildings.getEffect('defense_bonus', 0) || 0) + (w.news ? (w.news.getModifier('defense_bonus', 0) || 0) : 0); const mult = [1, 2, 4, 6][TIERS.S(w).lv] || 1; const gWin = Math.max(0, Math.ceil((4 * mult - 2 - bd) / 2));
            const raid = (G) => { let i = 0; for (const a of live()) { if (i < G) { a.job = new Job('guard'); i++; } else if (a.job && a.job.key === 'guard') a.job = new Job('farmer'); } set('food', 5000); set('silver', 500); const R1 = Math.random, on0 = DECIDE.on; Math.random = () => 0.6; DECIDE.on = () => false; /* v11.8.0 首長現在會被問怎麼應對（可能花錢或躲起來）；這裡量的是「出去打」本身的公式，照原本那條路結算 */ try { E._triggerRaid(w); } finally { Math.random = R1; DECIDE.on = on0; } return Math.round(5000 - w.stockpile.get('food')); };
            o.raid = { bd, gWin, win: raid(gWin), lose: gWin > 0 ? raid(gWin - 1) : raid(0), exp: Math.max(22, Math.round(22 * live().length / 30)) }; for (const [a, j] of jobs0) a.job = j; }
          { const lvNow = TIERS.S(w).lv; o.maxOpen = [0, 1, 2, 3].map(l => { TIERS.S(w).lv = l; return P._maxOpen(w); }); TIERS.S(w).lv = lvNow; o.maxStatic = ProposalSystem.MAX_OPEN;
            try { const keepItems = P.items; const fake = [1, 2, 3, 4].map(i => ({ id: 'F' + i, key: 'fake' + i, status: 'open', votes: {} })); P.items = fake.slice(); P.cooldown = {}; set('food', 300); const R1 = Math.random; Math.random = () => 0.5; try { P._generate(w, day + 902); } finally { Math.random = R1; } o.genOpen = P.open().length; P.items = keepItems; } catch (e) { o.genOpen = 'err ' + e.message; } }
          { const all = live(); const jobs0 = all.map(a => [a, a.job]); const mood0 = all.map(a => [a, a.mood]); const D = TIERS.S(w).lv >= 2 ? 5 : 2; let i = 0; for (const a of all) { if (i < D) { a.job = new Job('doctor'); i++; } else if (a.job && a.job.key === 'doctor') a.job = new Job('farmer'); a.mood = 60; }
            const sad = all.slice(-10); sad.forEach((a, k) => { a.mood = 14 - k; }); const len0 = new Map(sad.map(a => [a.agentId, a.memory.entries.length])); set('medicine', 50); const str = t('去找醫生拿了藥，人舒服多了。');
            try { processDailyProduction(w); o.med = { D, got: sad.filter(a => a.memory.entries.slice(len0.get(a.agentId)).some(e => e.content === str)).map((a) => 14 - sad.indexOf(a)).sort((x, y) => x - y) }; } catch (e) { o.med = 'err ' + e.message; }
            for (const [a, j] of jobs0) a.job = j; for (const [a, m] of mood0) a.mood = m; }
          return o; };
        sizeTo(30); T0.lv = 0; out.scaleV = snap(); sizeTo(118); T0.lv = 2; out.scaleC = snap(); T0.lv = lv0;
        out.bankLine = [BANK.badLine({ dep: { a: 300, b: 500 } }), BANK.badLine({ dep: { a: 3000 } })]; }
      // 10) 夠格升格但建材不夠：升格案照樣提得出來，通過後公庫把缺的買齊再升格（建材只付一次）；建材本來就夠的照舊；公庫沒錢就寫明原因作罷
      { const tierCase = async (seed, wood, silver, mode) => { fresh(seed); const T = TIERS.S(w); const met0 = TIERS.met; TIERS.met = () => 3; const o = { wood0: wood }; try {
          T.lv = 2; T.up = 3; T.readySince = null; const P = w.proposals; P.items = []; P.cooldown = {}; const day = w._absDay(); const sp = w.stockpile; const set = (k, n) => { sp.resources[k] = n; };
          for (const k of ['hardwood', 'plank', 'marble', 'brick', 'steel', 'luxury_furniture']) set(k, 0); set('wood', wood); set('stone', 500); set('metal', 100); set('furniture', 50); set('silver', silver); sp.reserved = {}; if (w.trade) w.trade.merchant = null;
          o.mat = ECON.tierMat(3); o.ready = TIERS.ready(w); const cs = P._candidates(w, day) || []; const cand = cs.find(x => x.key === 'tier_up'); o.cand = !!cand; o.buyBefore = cs.some(x => String(x.key).startsWith('market:buy:tier:')); if (!cand) return o;
          const a = Object.values(w.agents).find(x => !x.isPlayer && !x.isDead); const p = P._createWith(w, day, cand, a); o.cost = p.cost; o.desc = P.desc(p); o.est = p.buyEst || 0; o.weigh = P._silverCost(p);
          if (mode === 'mayor') { const m = P._mayor(w); o.hasMayor = !!m; w.fullAgentMode = false; P._mayorRule(w, p, day, true); o.status = p.status; o.why = p.mayorWhy; o.whyText = P.mayorWhyText(p); o.lv = T.lv; o.silver = sp.get('silver'); return o; } o.buyWhileOpen = (P._candidates(w, day) || []).some(x => String(x.key).startsWith('market:buy:tier:'));
          const get = () => ({ silver: Math.round(sp.get('silver') * 10) / 10, wood: Math.round(sp.get('wood') * 10) / 10, stone: sp.get('stone'), metal: sp.get('metal'), furniture: sp.get('furniture') }); const s0 = get(); const log0 = (w.messageLog || []).length; const h0 = sp.history.length;
          P.decide(w, p.id, 'approve'); o.afterApprove = { status: p.status, lv: T.lv, order: p.order ? { items: p.order.items, paid: p.order.paid, in: p.order.day - day } : null, spent: Math.round((s0.silver - sp.get('silver')) * 10) / 10, reservedWood: (sp.reserved || {}).wood || 0, again: (P._candidates(w, day + 11) || []).some(x => x.key === 'tier_up') };
          o.prepLog = (w.messageLog || []).slice(log0).map(m => String(m.content || (m.k ? t(m.k) : ''))).filter(x => /備料|gathering materials/.test(x)).length;
          let days = 0;
          if (mode === 'ticks') { const d0 = w._absDay(); let n = 0; while (T.lv < 3 && w._absDay() - d0 < 6 && n++ < 700) { w.paused = false; w.tick(); if (n % 240 === 0) await new Promise(r2 => setTimeout(r2, 5)); } days = w._absDay() - d0; }
          else { while (p.status === 'approved' && days < 20) { days++; P._execute(w, p, day + days); } }
          const s1 = get(); o.days = days; o.lv = T.lv; o.status = p.status; o.result = t(p.result || ''); o.leftOrder = !!p.order; o.d = { silver: Math.round((s0.silver - s1.silver) * 10) / 10, wood: Math.round((s1.wood - s0.wood) * 10) / 10, stone: s0.stone - s1.stone, metal: s0.metal - s1.metal, furniture: s0.furniture - s1.furniture }; o.reservedAfter = Object.keys(sp.reserved || {}).length;
          if (mode !== 'ticks') { const hs = sp.history.slice(h0).filter(e => e.resource === 'silver'); const outs = hs.filter(e => e.amount < 0); o.pay = { n: outs.length, sum: Math.round(-outs.reduce((x, e) => x + e.amount, 0) * 10) / 10, back: Math.round(hs.filter(e => e.amount > 0).reduce((x, e) => x + e.amount, 0) * 10) / 10, backWhy: [...new Set(hs.filter(e => e.amount > 0).map(e => e.reason))] }; }
        } catch (e) { o.err = String(e && e.stack || e).slice(0, 400); } finally { TIERS.met = met0; } return o; };
        out.tierShort = await tierCase(31, 8, 3000, 'step'); out.tierHave = await tierCase(31, 300, 3000, 'step'); out.tierPoor = await tierCase(31, 8, 100, 'step'); out.tierMayor = await tierCase(31, 8, 100, 'mayor'); out.tierRun = await tierCase(33, 8, 3000, 'ticks'); }
      // 7) 關掉時照舊；放著跑
      fresh(17); w.observerMode = false; { const a = npcs()[0]; a.activity = 'wandering'; a._dayLoc = 'x'; DAY.steer(w, a); out.off = a._dayLoc; } w.observerMode = true;
      for (let i = 0; i < 10 * 96; i++) { w.paused = false; w.tick(); if (i % 480 === 479) await new Promise(r2 => setTimeout(r2, 5)); } out.run = DAY.view(w).st; out.en = [t('跟朋友約好了'), t('想約{b}出去走走，他說改天。')];
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  });
  const tag = `[${lang}]`; if (r.err) console.log(r.err);
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.shy && r.shy.lib > r.shy.tav, `${tag} 害羞又愛看書的人：圖書館比酒館有吸引力`, r.shy);
  ok(r.friend && r.friend.n === 2 && r.friend.park > r.friend.sq, `${tag} 兩個好朋友在公園：公園比廣場想去`, r.friend);
  ok(r.foe && r.foe.n === 1 && r.foe.tav < r.foe.sq, `${tag} 仇人在酒館：避開酒館`, r.foe);
  ok(r.rain && r.rain.home > r.rain.park, `${tag} 天氣差：待在家比去公園好`, r.rain);
  ok(r.planLoc === r.PL && r.pick && r.pick.loc === r.PL && r.pick.same && r.pick.led >= 1, `${tag} 今天行程寫了要去的地方（${r.PL}）：就去那裡，挑定後這一陣子不換`, { p: r.planLoc, k: r.pick });
  ok(r.goes && r.goes.at >= 3, `${tag} 人真的在那個地方（四刻鐘裡至少三刻）`, r.goes);
  ok(r.talk && r.talk.first && r.talk.hasC && r.talk.noD, `${tag} 找誰聊：先找最要好的，聊過換別人，不去找仇人`, r.talk);
  ok(r.inviteNo && r.inviteNo.r === false && !r.inviteNo.pend && r.inviteNo.st === 1 && r.inviteNo.mem, `${tag} 對方很累：說改天，不會被硬拉走`, r.inviteNo);
  ok(r.inviteCool === false, `${tag} 剛被婉拒，兩天內不再約同一個人`, r.inviteCool);
  ok(r.inviteYes && r.inviteYes.r === true && r.inviteYes.same && r.inviteYes.st === 1, `${tag} 對方有精神、交情好：答應，兩個人約在同一個地方`, r.inviteYes);
  ok(r.inviteDice === 0, `${tag} 約人與答不答應都不擲骰`, r.inviteDice);
  ok(r.sourKind === 0 && r.sourBad >= 55 && r.sourOnce.s1 === true && r.sourOnce.s2 === false, `${tag} 和氣的好朋友 60 次都沒鬧僵；刻薄、心情差、宿醉的仇人幾乎每次都僵；同一對一天最多一次`, { kind: r.sourKind, bad: r.sourBad, once: r.sourOnce });
  ok(r.spark && r.spark.first === 2 && r.spark.again === 0 && r.sparkNo === 0 && r.sparkClose === 1, `${tag} 心動：浪漫的人 2 點、隔幾天才再有；交情不夠的沒有；交情夠的 1 點`, { s: r.spark, no: r.sparkNo, close: r.sparkClose });
  ok(r.off === null || r.off === 'x' ? r.off === null : false, `${tag} 沒開觀察者模式時不介入`, r.off);
  ok(r.run && r.run.free > 100 && (r.run.invite + r.run.inviteNo) > 0 && r.run.chat > 0, `${tag} 跑 10 天：空閒的選擇、約人、聊天都在發生`, r.run);
  ok(zh || !r.en.some(x => /[一-鿿]/.test(x)), `${tag} 新句子有英文`, r.en);
  ok(r.cap && r.cap.c0 === r.cap.exp0 && r.cap.c2 === r.cap.exp2 && r.cap.raw2 === r.cap.expRaw && r.cap.c2 > r.cap.c0 + 1999, `${tag} 糧倉容量：城市比村莊多 2000（再乘上儲存加成）`, r.cap);
  ok(r.spoil && Math.abs(r.spoil.r - r.spoil.exp) < 1e-9, `${tag} 腐壞比例跟結算用的是同一個數字`, r.spoil);
  ok(r.sellW && r.sellW.under === null && r.sellW.little > 1.4 && r.sellW.little < 2 && r.sellW.huge === 5, `${tag} 沒爆倉不會有人提賣糧；多一點點時權重略高；爆十幾倍時權重拉到最高`, r.sellW);
  ok(r.slow && r.slow.d2 === 0.35 && r.slow.d3 === 0.1, `${tag} 存糧是目標的兩倍時照做三成五，三倍以上降到一成`, r.slow);
  ok(zh || !r.spoilText.some(x => /[\u4e00-\u9fff]/.test(x)), `${tag} 腐壞提示有英文`, r.spoilText);
  ok(r.glut && r.glut.g0 === 0 && Math.abs(r.glut.g1 - 3) < 0.01, `${tag} 賣餘糧：沒超過容量算 0，四倍容量算超出 3 倍`, r.glut);
  ok(r.glut && r.glut.yes >= r.glut.n * 0.8, `${tag} 倉庫滿到四倍時，照個性投票的人八成以上贊成賣掉`, r.glut);
  ok(r.glut && r.glut.famineFull === 0 && r.glut.lowPick > 0, `${tag} 糧倉滿出來的鎮抽不到糧荒；存糧少的鎮抽得到`, r.glut);
  ok(r.glut && r.glut.fullCand === false && r.glut.lowCand === true, `${tag} 糧荒考驗當前但糧倉滿出來時沒人提加班下田；存糧少時有`, r.glut);
  ok(zh || !/[\u4e00-\u9fff]/.test(r.glut.whyText), `${tag} 投票理由有英文`, r.glut.whyText);
  { const V = r.scaleV || {}, C = r.scaleC || {}; const rawOk = (S, f) => S.raw && Object.entries(S.raw).every(([k, x]) => x.v === f(k, x.base));
    ok(V.pop === 30 && C.pop === 118 && V.lv === 0 && C.lv === 2, `${tag} 規模測試：30 人的村莊與 118 人的城市`, { v: [V.pop, V.lv], c: [C.pop, C.lv] });
    ok(rawOk(V, (k, b) => b) && rawOk(C, (k, b) => b + Math.round(88 * ({ wood: 1.25, metal: 0.3, herbs: 0.17 }[k] || 0))) && C.raw.wood.v >= 130, `${tag} 原料保底：村莊照舊 40／20，城市木材多 110（兩天的用量）、石材不變`, { v: V.raw, c: C.raw });
    ok(V.line && V.line.stone === 250 && C.line.stone === Math.ceil(C.want.stone * 1.2) && C.line.stone > 1000 && C.line.paper === 250, `${tag} 多出來才賣的線：村莊照舊 250，城市的石材是目標量的 1.2 倍；目標量小的東西不變`, { v: V.line, c: C.line, want: C.want });
    ok(V.sell && V.sell.at600 === true && C.sell.at600 === false && C.sell.at1100 === true, `${tag} 石材 600 份：村莊有人提議賣，城市還沒備夠不提；1100 份城市才提`, { v: V.sell, c: C.sell });
    ok(Math.abs(V.glut - 3.4) < 0.01 && C.glut < 0.1, `${tag} 石材 1100 份：村莊算超出 3.4 倍，城市只超出一點點`, { v: V.glut, c: C.glut });
    ok(V.manyGlut && V.manyGlut.n >= 6 && V.manyGlut.high.length === 2 && V.manyGlut.high.join() === V.manyGlut.top2.join() && C.manyGlut && C.manyGlut.high.length === 2, `${tag} 六樣東西同時堆太多：只有最嚴重的兩樣排到前面，其餘照平常的份量（別的事不會全被擠到後面）`, { v: V.manyGlut, c: C.manyGlut });
    ok(V.floor && V.floor.stone === V.floor.stone0 && V.floor.furn === 8 && V.floor.extra === 600 - V.floor.stone0 && V.floor.foodSame && C.floor.stone === C.line.stone && C.floor.furn === Math.ceil(C.want.furniture * 1.2) && C.floor.furn > 60 && C.floor.extra === 0 && C.floor.foodSame, `${tag} 出口要留的量：村莊照舊（家具 8），城市留到目標量的 1.2 倍（石材 600 份一份也不賣）；糧食不動`, { v: V.floor, c: C.floor });
    ok(V.shop === 84 && C.shop === 90, `${tag} 衣物 90 份：村莊照舊拿 6 份去商店賣，城市還沒備夠不賣`, { v: V.shop, c: C.shop });
    ok(V.merch === 70 && C.merch === 90, `${tag} 行商來收衣物：村莊照舊賣 20 份，城市留著不賣`, { v: V.merch, c: C.merch });
    ok(V.dm && V.dm.d2 === 0.15 && V.dm.d3 === 0.05 && V.dm.low === 1 && C.dm.d2 === 0.15 && C.dm.d3 === 0.05, `${tag} 石材是目標的兩倍時照做一成五，三倍以上降到半成，不夠時全力做`, { v: V.dm, c: C.dm });
    ok(V.feast && V.feast.cost === 40 && V.feast.ate === 40 && V.feast.lowOk && V.feast.lowNo && C.feast.cost === C.feast.exp && C.feast.cost === 157 && C.feast.ate === 157 && C.feast.lowOk && C.feast.lowNo && C.feast.text.includes('157'), `${tag} 宴席：村莊照舊 40 份食物（存糧 120 才提），城市 157 份（存糧 471 才提），真的吃掉這麼多`, { v: V.feast, c: C.feast });
    ok(zh ? /想用 157 份食物/.test(C.feast.text) : /turn 157 food/.test(C.feast.text), `${tag} 宴席說明寫的是真正的份量，也有英文`, C.feast.text);
    ok(V.raid && V.raid.gWin === Math.max(0, Math.ceil((2 - V.raid.bd) / 2)) && V.raid.win === 0 && (V.raid.gWin === 0 || V.raid.lose === 22) && C.raid.gWin === Math.max(0, Math.ceil((14 - C.raid.bd) / 2)) && C.raid.win === 0 && C.raid.lose === 87 && C.raid.gWin > V.raid.gWin, `${tag} 掠奪者來襲：村莊照舊一個守衛就擋得住、輸了被搶 22 份糧；城市要七個守衛，輸了被搶 87 份`, { v: V.raid, c: C.raid });
    ok(V.maxOpen && V.maxOpen.join() === '4,5,6,7' && V.maxStatic === 4 && V.genOpen === 4 && C.genOpen >= 5 && C.genOpen <= 6, `${tag} 同時開著的提案上限：村莊 4、城鎮 5、城市 6、王都 7；已有 4 案時村莊不再開新案，城市還會開`, { m: V.maxOpen, v: V.genOpen, c: C.genOpen });
    ok(V.med && V.med.got && V.med.got.join() === '5,6,7' && C.med.got && C.med.got.join() === '5,6,7,8,9,10,11,12', `${tag} 心情低落去拿藥：村莊（兩位醫生）照舊 3 人，城市（五位醫生）8 人，都是心情最差的先看`, { v: V.med, c: C.med });
    ok(r.bankLine && r.bankLine[0] === 40 && r.bankLine[1] === 150, `${tag} 擠兌的呆帳門檻：存款 800 照舊 40，存款 3000 是 150`, r.bankLine); }
  { const S = r.tierShort || {}, H = r.tierHave || {}, Q = r.tierPoor || {}, R = r.tierRun || {}; const A = S.afterApprove || {}; const paid = A.order ? A.order.paid : -1; const got = A.order ? (A.order.items.wood || 0) : 0;
    ok(!S.err && S.ready && S.cand && S.cost && S.cost.wood === 150 && S.cost.stone === 220 && S.cost.metal === 40 && S.cost.furniture === 15 && S.est === 435 && S.weigh === 435 && (zh ? /還缺.*142.*大約要花 435 銀幣/.test(S.desc) : /short of .*142.*about 435 silver/.test(S.desc)), `${tag} 夠格當王都、木材只有 8：升格案照樣提得出來，建材列成這一案的成本，說明寫明缺木材 142、公庫大約要花 435 銀幣`, { e: S.err, ready: S.ready, cand: S.cand, cost: S.cost, est: S.est, desc: S.desc });
    ok(S.buyBefore === true && S.buyWhileOpen === false && A.again === false, `${tag} 升格案在表決或備料時，不再另外提「為升格進一批」，也不會再提第二個升格案`, { before: S.buyBefore, open: S.buyWhileOpen, again: A.again });
    ok(A.status === 'approved' && A.lv === 2 && A.order && got >= 142 && A.order.in >= 2 && A.order.in <= 3 && paid === S.est && S.prepLog >= 1, `${tag} 通過之後公庫才去買：向外地訂了缺的木材（2～3 天到）、花的錢跟提案上寫的一樣、建材先保留、日誌寫鎮公所開始備料`, { a: A, log: S.prepLog });
    ok(S.lv === 3 && S.status === 'done' && S.days >= 2 && S.days <= 3 && !S.leftOrder && S.reservedAfter === 0, `${tag} 貨到的那天就升格成王都（三天內），不再保留建材`, { lv: S.lv, st: S.status, days: S.days, res: S.result });
    ok(S.d && S.pay && S.pay.n === 1 && S.pay.sum === paid && S.pay.backWhy.length <= 1 && Math.abs(S.d.silver - (paid - S.pay.back)) < 0.11 && S.d.wood === got - 150 && S.d.stone === 220 && S.d.metal === 40 && S.d.furniture === 15, `${tag} 帳對得起來：公庫只付訂貨那一筆（其中付給本地公營承包商的工程款照舊回到公庫），木材＝訂來的－150，石材 220、金屬 40、家具 15 各只扣一次`, { d: S.d, pay: S.pay, paid, got });
    ok(!H.err && H.cand && H.cost && Object.keys(H.cost).length === 0 && H.buyBefore === false && H.est === 0 && H.weigh === 0 && H.afterApprove.lv === 3 && H.status === 'done' && H.afterApprove.order === null && H.pay.n === 0 && H.d.silver === 0 && H.d.wood === -150 && H.d.stone === 220 && H.d.metal === 40 && H.d.furniture === 15 && (zh ? !/由公庫/.test(H.desc) : !/treasury will buy/.test(H.desc)), `${tag} 建材本來就夠的照舊：提案不帶成本、通過當天就升格、不花銀幣、建材扣一次`, { e: H.err, cost: H.cost, a: H.afterApprove, st: H.status, d: H.d });
    ok(!Q.err && Q.cand && Q.afterApprove.order === null && Q.lv === 2 && Q.status === 'failed' && Q.days <= 9 && Q.prepLog === 0 && Q.pay.n === 0 && Q.d.silver === 0 && Q.d.wood === 0 && Q.d.stone === 0 && (zh ? /公庫的錢也不夠買/.test(Q.result) : !/[一-鿿]/.test(Q.result)), `${tag} 公庫買不起：等一週後寫明缺什麼作罷，沒升格、錢和建材都沒動`, { e: Q.err, a: Q.afterApprove, lv: Q.lv, st: Q.status, days: Q.days, res: Q.result, d: Q.d });
    { const M = r.tierMayor || {}; ok(!M.err && M.cand && M.weigh === 435 && M.lv === 2 && M.silver === 100 && (M.hasMayor ? (M.status === 'rejected' && M.why === 'cost') : true), `${tag} 公庫只有 100、買料要 435：照規則裁決的首長會因為花費否決（投票與裁決掂量的花費含買料的估價），沒有自動買料`, M); }
    ok(!R.err && R.cand && R.lv === 3 && R.status === 'done' && R.days <= 4, `${tag} 真的放著跑：通過後四天內升格成王都`, { e: R.err, lv: R.lv, st: R.status, days: R.days, a: R.afterApprove }); }
  if (r.run) console.log('   ', JSON.stringify(r.run));
  if (process.env.SHOW) console.log('   ', JSON.stringify({ v: r.scaleV, c: r.scaleC, tier: [r.tierShort, r.tierHave, r.tierPoor, r.tierMayor, r.tierRun] }));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
