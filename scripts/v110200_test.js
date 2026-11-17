// v11.2.0 一天怎麼過由本人決定（sim-day.js）
//   1) 六個選擇點都登記在決策核心，另有自己的 AI 名額
//   2) 沒有理由的人不會被問，照常上工；宿醉、約好翹班的人才會被問，選項與題目中英都有
//   3) 晚到：上工時間人還在家裡睡，兩個鐘頭後才到工作地點
//   4) 翹班：上工時間人不在工作地點；隔天結算沒有產出、沒有工資；東家會處理（算了／訓／扣工資／開除）
//   5) 扣工資的錢從夥計到東家，一分不差；開除要第三次以後才有這個選項
//   6) 去酒館：錢付出去、全鎮的錢不多不少；喝到關門 → 過半夜還在酒館 → 隔天宿醉、成為不想上工的理由
//   7) 裝病請假在外面被東家看到：被拆穿
//   8) 約好一起翹班：兩個都來 → 交情變好；一個沒來 → 等的人記恨
//   9) 清晨排行程時 AI 可以順便決定去不去上工
//  10) 存檔讀檔不丟、同一天讀檔不會把今天當成昨天；沒開觀察者模式時完全不介入
//  11) 放著跑 20 天：出勤九成以上、有人喝酒、沒有錯誤
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
      const fresh = (seed) => { w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 1, { seed }); WALLET.S(w); DAY.S(w); };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const pinned = []; const pin = (...as) => { pinned.length = 0; pinned.push(...as); };
      let keepCalm = true; const step = () => { if (keepCalm) { try { if (w.festivals) w.festivals.activeFestival = null; } catch (e) {} } for (const a of pinned) { a.needs.hunger = 90; a.needs.rest = 70; a.mood = 60; } w.paused = false; w.tick(); };
      const toHour = (h) => { let g = 0; do { step(); } while (!(w.clock.hour === h && w.clock.minute === 0) && g++ < 300); };
      const X = () => DAY.S(w); const calm = () => { try { if (w.festivals) w.festivals.activeFestival = null; } catch (e) {} };
      const SPOTS = ['park', 'town_square', 'forest', 'tavern', 'library'];
      const pick2 = () => { const c = npcs().filter(a => a.job && DAY.works(w, a) && DAY.bossOf(w, a) && a.job.workHours[0] >= 6 && a.job.workHours[1] <= 20 && !SPOTS.includes(a.job.workplace) && !a.personality.traits.includes('night_owl') && !a.personality.traits.includes('early_bird') && !a.personality.traits.includes('lazy') && (a.age ?? 30) >= 18 && !Object.values(w.market?.owners || {}).includes(a.agentId) && !Object.values(w.market?.rival || {}).some(R => R && R.owner === a.agentId) && !DAY.reasons(w, a).some(x => x.k === 'sour' || x.k === 'ill' || x.k === 'grief'));
        for (const a of c) { const b = c.find(o => o !== a && o.job.key === a.job.key && DAY.bossOf(w, o) === DAY.bossOf(w, a)); if (b) return [a, b]; } return [c[0], c[1]]; };
      const hold = (a, o) => { X().t[a.agentId] = Object.assign({ wq: 1, eq: 1 }, o || {}); };
      const money = () => Math.round((npcs().reduce((s, a) => s + WALLET.get(w, a), 0) + (w.stockpile.get('silver') || 0)) * 100) / 100;

      // 1) 登記
      const KS = ['workday', 'evening', 'lastcall', 'planout', 'outing', 'noshow'];
      out.kinds = KS.map(k => { const K = DECIDE.KINDS[k]; return !!K && K.scan === false && K.aiGroup === 'day'; }); out.group = DECIDE.AI_GROUP.day;

      // 2) 有理由才問
      fresh(7); calm(); let [A, B] = pick2(); pin(A, B); toHour(0); calm(); const ws = A.job.workHours[0], we = A.job.workHours[1];
      out.noReason = DAY.reasons(w, A).map(x => x.k); toHour(ws); out.autoGo = X().t[A.agentId]?.work;
      toHour(0); calm(); X().hang[A.agentId] = { d: X().d, lv: 2 }; const why = DAY.reasons(w, A).map(x => x.k); out.hangWhy = why;
      const Kw = DECIDE.KINDS.workday; const ctxW = { d: w._absDay(), why, ws }; const opts = Kw.options(w, A, ctxW); out.optIds = opts.map(o => o.id);
      const txt = (x) => (x && typeof x === 'object') ? (x.raw != null ? x.raw : Object.entries(x.p || {}).reduce((s, [k, v]) => s.split('{' + k + '}').join(typeof v === 'string' ? t(v) : v), t(x.k))) : t(x);
      out.facts = Kw.facts(w, A, ctxW); out.optText = opts.map(o => txt(o.text)); out.cjkW = cjk(out.facts) || out.optText.some(cjk);
      { const Ln = { safe: 1, joy: 1, bond: 1, face: 1, gain: 1 }; const sc = Object.fromEntries(opts.map(o => [o.id, DECIDE.score(Ln, o)])); out.hangScore = sc; }

      // 3) 晚到
      hold(A); hold(B, { work: 'go', eve: 'free' }); const R = Math.random; Math.random = () => 0.99; DAY.setWork(w, A, 'late', ctxW); Math.random = R;
      toHour(ws); out.lateAtWs = { act: A.activity, home: A.currentLocation === A.homeLocation, why: A.activityReason() }; toHour(ws + 3); out.lateAfter = { act: A.activity, atWork: A.currentLocation === A.job.workplace };

      // 4) 翹班 → 隔天沒產出沒工資；東家處理
      toHour(0); calm(); hold(A, { eve: 'free' }); hold(B, { work: 'go', eve: 'free' }); delete X().hang[A.agentId]; DAY.setWork(w, A, 'skip', { why: ['lazy'] }); X().t[A.agentId].spot = 'park'; X().t[A.agentId].bed = 0;
      toHour(ws + 1); out.skipAt = { loc: A.currentLocation, atWork: A.currentLocation === A.job.workplace, why: A.activityReason(), cjk: cjk(A.activityReason()) };
      toHour(ws + 3); out.bossDid = X().t[A.agentId].boss || null; out.bossNow = !!DAY.bossOf(w, A) && DAY.works(w, A); out.strikes = DAY.strikes(w, A); out.bAtWork = B.currentLocation === B.job.workplace;
      toHour(23); for (let i = 0; i < 3; i++) step(); { const bs = DAY.bossOf(w, B); if (bs) WALLET.add(w, bs, 300); w.stockpile.add('silver', 300, w.tickCount, 'test'); } // 東家與公庫都付得出工資，才比得出差別
      const cA = WALLET.get(w, A), cB = WALLET.get(w, B); step();
      out.afterSkip = { mult: DAY.workMult(w, A), noPay: DAY.noPay(w, A), multB: DAY.workMult(w, B), noPayB: DAY.noPay(w, B), dA: Math.round((WALLET.get(w, A) - cA) * 100) / 100, dB: Math.round((WALLET.get(w, B) - cB) * 100) / 100, sameJob: A.job?.key === B.job?.key, wage: WALLET.wageOf(B) };
      // 發薪單獨再跑一次（同一份昨天的出勤）：這一步只有東家付工資，不會混到買東西、還錢
      { const bs = DAY.bossOf(w, B); if (bs) WALLET.add(w, bs, 300); const a1 = WALLET.get(w, A), b1 = WALLET.get(w, B); MARKET.payroll(w, w.wallet, npcs()); const own = (x) => Object.values(w.market?.owners || {}).includes(x.agentId) || Object.values(w.market?.rival || {}).some(R => R && R.owner === x.agentId); out.payroll = { priv: MARKET.privatePaid(w, B) && MARKET.privatePaid(w, A) && !own(A) && !own(B), // 這幾天裡當上東家的人自己在付工資，不比
         a: Math.round((WALLET.get(w, A) - a1) * 100) / 100, b: Math.round((WALLET.get(w, B) - b1) * 100) / 100 }; }

      // 5) 東家的處理：扣工資一分不差；第三次才能開除
      fresh(11); calm(); [A, B] = pick2(); pin(A, B); toHour(0); calm(); const boss = DAY.bossOf(w, A); WALLET.add(w, A, 40);
      const Kn = DECIDE.KINDS.noshow; out.fire1 = Kn.options(w, boss, { x: A.agentId, n: 1 }).map(o => o.id); out.fire3 = Kn.options(w, boss, { x: A.agentId, n: 3 }).map(o => o.id); out.nsFacts = Kn.facts(w, boss, { x: A.agentId, n: 2, lie: 1 }); out.cjkN = cjk(out.nsFacts);
      { const a0 = WALLET.get(w, A), b0 = WALLET.get(w, boss), m0 = money(); DAY.punish(w, boss, A, 'dock', {}); out.dock = { a: Math.round((a0 - WALLET.get(w, A)) * 100) / 100, b: Math.round((WALLET.get(w, boss) - b0) * 100) / 100, m: Math.round((money() - m0) * 100) / 100, warned: X().warn[A.agentId] != null }; }
      { const title = A.job.title; DAY.punish(w, boss, A, 'fire', {}); out.fire = { job: A.job, had: !!title, jobless: typeof LABOR !== 'undefined' ? LABOR.S(w).jobless[A.agentId] != null : true }; }

      // 6) 酒館：付錢、守恆、喝到關門、半夜還在、隔天宿醉
      fresh(13); calm(); [A, B] = pick2(); pin(A, B); toHour(0); calm(); WALLET.add(w, A, 60); hold(A, { work: 'go' }); hold(B, { work: 'go', eve: 'free' });
      { const m0 = money(), a0 = WALLET.get(w, A); const res = DAY.setEve(w, A, 'drink'); out.drink = { res: !!res, paid: Math.round((a0 - WALLET.get(w, A)) * 100) / 100, cups: X().t[A.agentId].cups, m: Math.round((money() - m0) * 100) / 100, eve: X().t[A.agentId].eve }; }
      toHour(20); out.at20 = { loc: A.currentLocation, act: A.activity };
      { const m0 = money(); DAY.setLast(w, A, 'close', { round: 1 }); out.close = { until: X().t[A.agentId].until, cups: X().t[A.agentId].cups, m: Math.round((money() - m0) * 100) / 100 }; }
      X().t[A.agentId].l1 = 1; X().t[A.agentId].l2 = 1; toHour(23); out.at23 = A.currentLocation; toHour(0); step(); out.at0 = { loc: A.currentLocation, act: A.activity, why: A.activityReason() };
      out.hang = DAY.hangOf(w, A); out.hangReason = DAY.reasons(w, A).map(x => x.k); out.line = DAY.line(w, A); out.cjkL = cjk(out.line);
      toHour(3); out.at3 = { act: A.activity, home: A.currentLocation === A.homeLocation };

      // 7) 裝病被東家看到
      fresh(17); calm(); [A, B] = pick2(); pin(A, B); toHour(0); calm(); const boss2 = DAY.bossOf(w, A); hold(A, { eve: 'free' }); DAY.setWork(w, A, 'sick', { why: ['lazy'] }); X().t[A.agentId].spot = 'park'; X().t[A.agentId].homeTill = 0; X().t[A.agentId].bed = 0;
      const ws2 = A.job.workHours[0]; toHour(ws2 + 1); out.sickLoc = A.currentLocation; boss2.currentLocation = 'park'; boss2._locationStayRemaining = 99; boss2.activity = 'wandering';
      { let g = 0; while (!X().t[A.agentId].seen && g++ < 12) { boss2.currentLocation = 'park'; step(); boss2.currentLocation = 'park'; } }
      out.caught = { seen: !!X().t[A.agentId].seen, st: X().st.caught, boss: X().t[A.agentId].boss || null, strikes: DAY.strikes(w, A) };

      // 8) 約好一起翹班
      fresh(19); calm(); [A, B] = pick2(); pin(A, B); toHour(12); const af0 = A.relationships.getOrCreate(B.agentId, B.name).affinity;
      DAY.setPact(w, A, B, 'park'); toHour(0); calm(); out.pactWhy = DAY.reasons(w, A).map(x => x.k); hold(A, { eve: 'free' }); hold(B, { eve: 'free' }); DAY.setWork(w, A, 'skip', { why: ['pact'] }); DAY.setWork(w, B, 'skip', { why: ['pact'] });
      toHour(10); out.together = { a: A.currentLocation, b: B.currentLocation }; for (let hh = 11; hh <= 12 && !(out.together.a === 'park' && out.together.b === 'park'); hh++) { toHour(hh); out.together = { a: A.currentLocation, b: B.currentLocation, at: hh }; } /* 其中一個可能先補眠或先吃飯，十點還沒到：中午前到齊就算 */ toHour(13); out.kept = { st: X().st.pactKept, up: A.relationships.getOrCreate(B.agentId, B.name).affinity - af0, mem: A.memory.entries.slice(-40).some(e => /玩得很痛快|great time/.test(e.content || '')) };
      toHour(15); DAY.setPact(w, A, B, 'park'); toHour(0); calm(); hold(A, { eve: 'free' }); hold(B, { eve: 'free' }); const af1 = A.relationships.getOrCreate(B.agentId, B.name).affinity; const br0 = X().st.pactBroken; DAY.setWork(w, A, 'skip', { why: ['pact'] }); X().t[B.agentId].work = 'go';
      toHour(13); out.broken = { st: X().st.pactBroken - br0, down: A.relationships.getOrCreate(B.agentId, B.name).affinity - af1, mem: A.memory.entries.slice(-40).some(e => /等了半天|waited alone/.test(e.content || '')), away: !w.agents[A.agentId] || !w.agents[B.agentId] || !!w.isAway?.(A.agentId) || !!w.isAway?.(B.agentId) }; // 其中一個剛好出遠門：這一題不成立

      // 9) 排行程時決定
      fresh(23); calm(); [A, B] = pick2(); pin(A, B); toHour(0); calm(); X().hang[A.agentId] = { d: X().d, lv: 2 }; delete X().hang[B.agentId]; delete X().pact[B.agentId]; out.planAsk = DAY.planAsk(w, A); out.planAskNone = DAY.planAsk(w, B); out.bWhy = DAY.reasons(w, B).map(x => x.k);
      X().t[A.agentId] = { eq: 1 }; out.fromPlan = DAY.fromPlan(w, A, 'leave'); out.planWork = X().t[A.agentId].work; out.planLog = (DECIDE.S(w).log[A.agentId] || []).slice(-1)[0] || null; out.fromPlanBad = DAY.fromPlan(w, B, 'dance');

      // 10) 存讀檔、關掉時不介入
      { const d = w.serialize(); out.saved = !!d.dayx && d.dayx.t?.[A.agentId]?.work === 'leave'; const tBefore = JSON.stringify(X().t[A.agentId]); w.loadSave(JSON.parse(JSON.stringify(d))); w.observerMode = true; DAY.roll(w); out.loaded = JSON.stringify(DAY.S(w).t[A.agentId]) === tBefore; }
      { const a = Object.values(w.agents).find(x => !x.isPlayer && x.job && !x.isDead); const X0 = DAY.S(w); const t0 = X0.t[a.agentId]; const h0 = w.clock.hour; const n0 = [a.needs.hunger, a.needs.rest]; a.needs.hunger = 80; a.needs.rest = 80; w.clock.hour = 20; X0.t[a.agentId] = { eve: 'drink', until: 23, e0: 18 };
        DAY.steer(w, a); const plain = a._dayLoc; a._thingGo = { place: 'park', from: w.tickCount - 1, until: w.tickCount + 8 }; DAY.steer(w, a); const appt = a._dayLoc; delete a._thingGo; a._ceremony = { loc: 'town_square', act: 'socializing' }; DAY.steer(w, a); const cere = a._dayLoc; delete a._ceremony;
        out.keep = { plain, appt, cere }; w.clock.hour = h0; a.needs.hunger = n0[0]; a.needs.rest = n0[1]; if (t0) X0.t[a.agentId] = t0; else delete X0.t[a.agentId]; }
      { const a = Object.values(w.agents).find(x => !x.isPlayer && x.job); w.observerMode = false; a._dayLoc = 'x'; DAY.steer(w, a); out.off = { loc: a._dayLoc, mult: DAY.workMult(w, a), noPay: DAY.noPay(w, a) }; w.observerMode = true; }

      // 12) 打架：動手是本人選的；還手或退開；重傷躺診所、不能上工；兩套舊的擲骰關掉
      fresh(31); calm(); [A, B] = pick2(); pin(A, B); toHour(10); const rAB = A.relationships.getOrCreate(B.agentId, B.name), rBA = B.relationships.getOrCreate(A.agentId, A.name);
      rAB.affinity = -30; rBA.affinity = -30; const Kf = DECIDE.KINDS.feud; out.hitMild = (Kf.options(w, A, Kf.when(w, A)) || []).map(o => String(o.id).split(':')[0]);
      rAB.affinity = -70; rBA.affinity = -70; { const os = Kf.options(w, A, Kf.when(w, A)) || []; out.hitHate = os.map(o => String(o.id).split(':')[0]); const hit = os.find(o => String(o.id).startsWith('hit:')), calmO = os[0]; out.hitGap = hit ? Math.round((calmO.base - hit.base) * 100) / 100 : null; out.hitText = hit ? txt(hit.text) : ''; }
      { const f0 = HEALTH.S(w).st.fights || 0; let n0 = (w.npcEvents?.incidentLog || []).filter(x => x.type === 'fight').length; const R0 = Math.random; Math.random = () => 0.001; try { HEALTH.daily?.(w); w.npcEvents?._checkFights?.(w); } catch (e) {} Math.random = R0; out.oldOff = { f: (HEALTH.S(w).st.fights || 0) - f0, n: (w.npcEvents?.incidentLog || []).filter(x => x.type === 'fight').length - n0 }; }
      { const Ks = DECIDE.KINDS.struck; const os = Ks.options(w, B, { by: A.agentId }); out.struckIds = os.map(o => o.id); out.struckFacts = Ks.facts(w, B, { by: A.agentId, drunk: 1 }); out.cjkS = cjk(out.struckFacts);
        const R0 = Math.random; Math.random = () => 0.2; A.currentLocation = B.currentLocation; const x = DAY.brawl(w, A, B, false); Math.random = R0;
        out.cover = { loser: x.loser === B, sev: x.sev, hosp: B.status === 'hospitalized', ails: (HEALTH.ails(w, B) || []).length, st: X().st.brawl, aff: rBA.affinity }; }
      B.status = 'normal'; DAY.hospitalize(w, B); for (let i = 0; i < 6; i++) { B.needs.hunger = 90; step(); } out.inClinic = { loc: B.currentLocation, act: B.activity, why: B.activityReason(), works: DAY.works(w, B), cjk: cjk(B.activityReason()) };
      { const Kd = DECIDE.KINDS.drunkrow; A.currentLocation = 'tavern'; B.status = 'normal'; B.currentLocation = 'tavern'; X().t[A.agentId] = Object.assign(X().t[A.agentId] || {}, { eve: 'drink', cups: 6 }); const os = Kd.options(w, A, { d: w._absDay(), o: B.agentId }); out.rowIds = os.map(o => o.id); out.rowFacts = Kd.facts(w, A, { o: B.agentId }); out.cjkR = cjk(out.rowFacts) || os.some(o => cjk(txt(o.text))); }

      // 11) 放著跑 20 天
      fresh(29); pin(); keepCalm = false; let at = 0, tot = 0; const m0 = money();
      for (let i = 0; i < 20 * 96; i++) { w.paused = false; w.tick(); if (w.clock.minute === 0 && w.clock.hour === 11) { const wk = npcs().filter(a => a.job && a.job.workHours[0] <= 11 && a.job.workHours[1] > 11); tot += wk.length; at += wk.filter(a => a.currentLocation === a.job.workplace).length; } if (i % 480 === 479) await new Promise(r2 => setTimeout(r2, 5)); }
      out.run = { at, tot, st: DAY.view(w).st, pick: Object.fromEntries(Object.entries(DECIDE.stats(w).pick).filter(([k]) => /^(workday|evening|lastcall|planout|outing|noshow)\./.test(k))) };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  });
  const tag = `[${lang}]`; if (r.err) console.log(r.err);
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.kinds && r.kinds.every(Boolean) && r.group === 12, `${tag} 六個選擇點都登記了，日常另有一天 12 件的 AI 名額`, { k: r.kinds, g: r.group });
  ok(r.noReason && r.noReason.length === 0 && r.autoGo === 'go', `${tag} 沒有理由的人不會被問，照常上工`, { why: r.noReason, w: r.autoGo });
  ok(r.hangWhy && r.hangWhy.includes('hang2'), `${tag} 宿醉成為不想上工的理由`, r.hangWhy);
  ok(r.optIds && ['go', 'late', 'leave', 'sick', 'skip'].every(k => r.optIds.includes(k)), `${tag} 選項：照常、晚到、請假、裝病、不說一聲不去`, r.optIds);
  ok(zh ? /頭痛/.test(r.facts) : !r.cjkW, `${tag} 題目與選項是${zh ? '中' : '英'}文`, { f: r.facts, o: r.optText });
  ok(r.hangScore && r.hangScore.late > r.hangScore.skip && r.hangScore.go > r.hangScore.skip, `${tag} 一般人宿醉時：晚到與硬撐都比直接翹班有把握`, r.hangScore);
  ok(r.lateAtWs && r.lateAtWs.act === 'sleeping' && r.lateAtWs.home, `${tag} 晚到：上工時間人還在家裡睡`, r.lateAtWs);
  ok(r.lateAfter && r.lateAfter.atWork, `${tag} 晚到：之後人到了工作地點`, r.lateAfter);
  ok(r.skipAt && !r.skipAt.atWork && r.skipAt.loc === 'park' && (zh ? r.skipAt.why === '翹班' : !r.skipAt.cjk), `${tag} 翹班：上工時間人在公園，不在工作地點`, r.skipAt);
  ok((['let', 'scold', 'dock', 'fire'].includes(r.bossDid) || !r.bossNow) && r.strikes === 1 && r.bAtWork, `${tag} 東家兩個鐘頭後發現並處理；同事照常在工作地點`, { b: r.bossDid, n: r.strikes, bw: r.bAtWork });
  ok(r.afterSkip && r.afterSkip.mult === 0 && r.afterSkip.noPay === true && r.afterSkip.multB === 1 && r.afterSkip.noPayB === false, `${tag} 隔天結算：翹班的人沒有產出、沒有工資，有去的人照常`, r.afterSkip);
  ok(r.payroll && (!r.payroll.priv || (r.payroll.a === 0 && r.payroll.b > 0)), `${tag} 東家發薪：有去的人領到工資，翹班的人沒有`, r.payroll);
  ok(r.fire1 && !r.fire1.includes('fire') && r.fire3.includes('fire') && ['let', 'scold', 'dock'].every(k => r.fire1.includes(k)), `${tag} 東家的選項：算了、訓、扣工資；第三次以後才有開除`, { one: r.fire1, three: r.fire3 });
  ok(zh ? /請了假/.test(r.nsFacts) : !r.cjkN, `${tag} 東家的題目是${zh ? '中' : '英'}文`, r.nsFacts);
  ok(r.dock && r.dock.a > 0 && r.dock.a === r.dock.b && r.dock.m === 0 && r.dock.warned, `${tag} 扣工資：錢從夥計到東家，一分不差，並留下警告`, r.dock);
  ok(r.fire && r.fire.job === null && r.fire.jobless, `${tag} 開除：真的丟了工作`, r.fire);
  ok(r.drink && r.drink.res && r.drink.paid > 0 && r.drink.cups === 2 && r.drink.m === 0, `${tag} 去酒館：付了兩杯的錢，全鎮的錢不多不少`, r.drink);
  ok(r.at20 && r.at20.loc === 'tavern', `${tag} 晚上八點人在酒館`, r.at20);
  ok(r.close && r.close.until === 25 && r.close.cups === 6 && r.close.m === 0, `${tag} 喝到關門：又付了四杯，錢守恆`, r.close);
  ok(r.at23 === 'tavern' && r.at0 && r.at0.loc === 'tavern', `${tag} 十一點、過了半夜都還在酒館（別人已經回家睡了）`, { a: r.at23, b: r.at0 });
  ok(r.at3 && r.at3.act === 'sleeping' && r.at3.home, `${tag} 凌晨三點已經回家睡了`, r.at3);
  ok(r.hang === 2 && r.hangReason.includes('hang2') && (zh ? /宿醉/.test(r.line) : !r.cjkL), `${tag} 隔天宿醉，成為不想上工的理由，帳本上也寫著`, { h: r.hang, why: r.hangReason, line: r.line });
  ok(r.sickLoc === 'park' && r.caught && r.caught.seen && r.caught.st >= 1 && r.caught.strikes === 1, `${tag} 裝病請假在公園被看到：被拆穿、記一次`, { loc: r.sickLoc, c: r.caught });
  ok(r.caught && ['let', 'scold', 'dock', 'fire'].includes(r.caught.boss), `${tag} 被拆穿後東家會處理`, r.caught);
  ok(r.pactWhy && r.pactWhy.includes('pact'), `${tag} 約好翹班，隔天成為不想上工的理由`, r.pactWhy);
  ok(r.together && r.together.a === 'park' && r.together.b === 'park' && r.kept.st >= 1 && r.kept.mem, `${tag} 兩個都來：一起在公園，交情變好`, { t: r.together, k: r.kept });
  ok(r.broken && (r.broken.away || (r.broken.st >= 1 && r.broken.mem)), `${tag} 一個沒來：等的人記在心裡`, r.broken);
  ok(r.planAsk && /"work"/.test(r.planAsk) && (r.planAskNone === '') === (r.bWhy.length === 0) && (zh || !/[一-鿿]/.test(r.planAsk)), `${tag} 清晨排行程：有理由的人題目多一段，沒理由的人沒有`, { a: r.planAsk, b: r.planAskNone });
  ok(r.fromPlan === true && r.planWork === 'leave' && r.planLog && r.planLog.kind === 'workday' && r.planLog.ai === 1 && r.fromPlanBad === false, `${tag} AI 在行程裡寫請假就真的請假，並記成 AI 的決定；亂寫的不採用`, { f: r.fromPlan, w: r.planWork, l: r.planLog, bad: r.fromPlanBad });
  ok(r.saved && r.loaded, `${tag} 存檔讀檔不丟，同一天讀檔不會把今天當成昨天`, { s: r.saved, l: r.loaded });
  ok(r.off && r.off.loc === null && r.off.mult === 1 && r.off.noPay === false, `${tag} 沒開觀察者模式時不介入`, r.off);
  ok(r.keep && r.keep.plain === 'tavern' && r.keep.appt === null && r.keep.cere === null, `${tag} 今晚本來要去酒館，但已經約好去別處、或正在參加典禮的人照原本的安排`, r.keep);
  ok(r.run && r.run.tot > 100 && r.run.at / r.run.tot >= 0.82 && ((r.run.st.leave || 0) + (r.run.st.sick || 0) + (r.run.st.skip || 0)) / r.run.tot <= 0.08, `${tag} 跑 20 天：上午十一點八成以上的人在工作地點（沒有這個功能時是九成一到九成六），整天沒去的不到 8%`, r.run && { at: r.run.at, tot: r.run.tot, off: (r.run.st.leave || 0) + (r.run.st.sick || 0) + (r.run.st.skip || 0) });
  ok(r.run && (r.run.st.drink || 0) > 0 && Object.keys(r.run.pick).some(k => k.startsWith('evening.')), `${tag} 跑 20 天：有人去酒館、每晚都有人在拿主意`, r.run && r.run.st);
  ok(r.hitMild && !r.hitMild.includes('hit') && r.hitHate.includes('hit') && r.hitGap > 0, `${tag} 碰上死對頭：恨到 -55 以下才多一個「動手」，而且比忍著難選`, { mild: r.hitMild, hate: r.hitHate, gap: r.hitGap, t: r.hitText });
  ok(r.oldOff && r.oldOff.f === 0 && r.oldOff.n === 0, `${tag} 兩套擲骰的打架都關掉了（把骰子灌到一定會打也不打）`, r.oldOff);
  ok(r.struckIds && r.struckIds.join() === 'back,cover' && (zh ? /動手/.test(r.struckFacts) : !r.cjkS), `${tag} 被打的人自己選：還手或退開`, { ids: r.struckIds, f: r.struckFacts });
  ok(r.cover && r.cover.loser && r.cover.ails > 0 && r.cover.st === 1 && r.cover.aff <= -85, `${tag} 沒還手：只有被打的人受傷，更恨對方`, r.cover);
  ok(r.inClinic && r.inClinic.act === 'sleeping' && r.inClinic.works === false && (zh ? /診所/.test(r.inClinic.why) : !r.inClinic.cjk), `${tag} 重傷的人真的躺著養傷，不算該上工的人`, r.inClinic);
  ok(r.rowIds && r.rowIds.join() === 'ignore,taunt,hit' && (zh || !r.cjkR), `${tag} 喝多了死對頭在旁邊：不理、嗆他、動手`, { ids: r.rowIds, f: r.rowFacts });
  if (r.run) console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
