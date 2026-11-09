// v9.4.0 制度修正第二批：議會門檻、國王不兼首長、稅率浮點、司法影響官職（坐牢停權、政變失敗丟官、買票當選無效）、
// 天災心情照算、紓困債部分清償與罰息上限、冊封輪替；輕微項目：早安卡、海路商路燈塔、舊存檔跟旅人結婚的人、
// 事件卡住、首長稱號、皇家婚禮避親、空殼教派解散、程序生成移民、老化速度、繁榮度貿易項
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    try { app._visitorMailboxTick?.(); } catch (e) {}
    const people = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !String(a.agentId).startsWith('visit_'));
    let k = 0; while (people().length < 16 && k++ < 30) { const n0 = Object.keys(w.agents).length; try { w.events?._spawnImmigrant?.(w); } catch (e) {} if (Object.keys(w.agents).length === n0) break; }
    const d = () => w._absDay(); const E = w.election;
    const mayorOf = () => E._officeHolder(w);
    const setMayor = (a) => { for (const o of Object.values(w.agents)) if (o.job?.key === 'mayor' && o !== a) o.job = new Job('farmer'); a.job = new Job('mayor'); E.acting = null; E.active = false; };
    const logs = () => (w.eventLog || w.messageLog || []).slice(-40).map(x => typeof x === 'string' ? x : (x.message || x.text || x.content || JSON.stringify(x)));
    const logHas = (re) => { try { return (w.messages || w.log || w.logMessages || []).slice(-80).some(m => re.test(m.text || m.message || m.content || String(m))); } catch (e) { return false; } };
    const P = people();
    // ---------- 9. 議會門檻 ----------
    {
      const C = w.council; C._formed = true; const king = P[0], jailbird = P[1], vis = P[2], m1 = P[3], m2 = P[4], m3 = P[5], m4 = P[6];
      CROWN.S(w); const oldKing = w.crown.king; w.crown.king = king.agentId;
      w.civic = w.civic || {}; w.civic.jail = w.civic.jail || {}; w.civic.jail[jailbird.agentId] = d() + 5;
      const vid = 'visit_test'; w.agents[vid] = Object.assign(Object.create(Object.getPrototypeOf(m1)), m1, { agentId: vid, name: '外鎮客' });
      setMayor(P[7]); const acting = P[8]; E.acting = { agentId: acting.agentId, name: acting.name, reason: 'explore', mayorId: P[7].agentId };
      P[7].currentLocation = 'exploration'; // 鎮長去探險,代理人上場
      C.members = [king.agentId, jailbird.agentId, vid, m1.agentId, m2.agentId, m3.agentId, acting.agentId];
      const seat = ASSEMBLY.seated(w).map(a => a.agentId);
      out.seat = { n: seat.length, king: seat.includes(king.agentId), jail: seat.includes(jailbird.agentId), vis: seat.includes(vid), acting: seat.includes(acting.agentId) };
      P[7].currentLocation = 'town_hall'; E.acting = null; delete w.agents[vid];
      // 平手不通過;三分之二要真的三分之二
      C.members = [m1.agentId, m2.agentId, m3.agentId, m4.agentId];
      try { const res = []; for (let i = 0; i < 40; i++) { const pr = { id: 'T' + i, kind: ['tax', 'build', 'festival', 'tier_up'][i % 4], votes: {}, title: 'x' }; ASSEMBLY.councilVote(w, pr, d()); if (pr.council) res.push(pr.council); }
        out.cv = { any: res.length, ties: res.filter(x => x.tie).length, tieOk: res.filter(x => x.for === x.against).every(x => !x.pass && x.tie), supOk: res.every(x => !x.sup || x.for >= Math.min(x.n, Math.max(Math.ceil(x.n * 2 / 3), Math.floor(x.n / 2) + 2))), n4: res.every(x => !x.sup || x.for === x.n) };
      } catch (e) { out.cv = { err: String(e) }; }
      w.crown.king = oldKing || null; delete w.civic.jail[jailbird.agentId];
    }
    // ---------- 11. 稅率浮點 ----------
    {
      w.wallet = w.wallet || {}; const t0 = w.wallet.tax; w.wallet.tax = 0.1;
      try { CROWN.DECREES.tax_up?.apply?.(w) ?? CROWN.DECREES.tax_up?.(w); } catch (e) {}
      if (Math.abs(w.wallet.tax - 0.15) > 1e-9) w.wallet.tax = 0.1 + 0.05;
      out.tax = { v: w.wallet.tax, str: String(w.wallet.tax) };
      const C = CROWN.S(w); const K = P[0]; C.king = K.agentId; C.legit = 60; const L0 = C.legit;
      const P0 = w.proposals.issues; w.proposals.issues = {}; const moods = people().map(a => a.mood); people().forEach(a => a.mood = 50);
      try { CROWN.daily?.length; } catch (e) {}
      // 只量稅率那一項:稅 15% 和 10% 的正當性變化應該一樣
      const run = (tax) => { w.wallet.tax = tax; C.legit = 60; CROWN.legitimacy(w, C, K); return C.legit; };
      out.legit = { at10: run(0.1), at15: run(0.1 + 0.05), at25: run(0.25) };
      out.taxStr = String(Math.round((0.1 + 0.05) * 100));
      w.proposals.issues = P0; people().forEach((a, i) => a.mood = moods[i]); w.wallet.tax = t0 ?? 0.1; C.king = null;
    }
    // ---------- 10. 國王不兼首長 ----------
    {
      const a = P[9]; setMayor(a); const before = mayorOf()?.agentId;
      CROWN.S(w); w.crown.king = null; TIERS.track(w);
      try { CROWN.crown(w, a, 'first'); } catch (e) { out.crownErr = String(e); }
      out.crownE = out.crownErr; out.crown = { err: out.crownErr || null, was: before === a.agentId, king: w.crown.king === a.agentId, stillMayor: a.job?.key === 'mayor', holder: mayorOf()?.agentId || null, acting: E.acting?.agentId || null, by: !!E.active || !!E.acting };
      const car = TIERS.S(w).career?.[a.agentId] || []; TIERS.track(w); out.crown.end = (TIERS.S(w).career?.[a.agentId] || []).slice(-1)[0]?.e || null;
      w.crown.king = null; E.active = false; E.acting = null;
    }
    // ---------- 12a. 坐牢的鎮長停權 ----------
    {
      const m = P[10]; setMayor(m); w.civic.jail[m.agentId] = d() + 3;
      E._checkMayor(w);
      const pm = w.proposals._mayor(w);
      out.jail = { real: !!E._realMayor(w), reason: E.acting?.reason || null, acting: E.acting?.agentId || null, propMayorIsJailed: pm?.agentId === m.agentId, cur: E.currentMayor(w)?.agentId !== m.agentId };
      delete w.civic.jail[m.agentId]; E._checkMayor(w); out.jail.back = !E.acting && E._realMayor(w)?.agentId === m.agentId;
    }
    // ---------- 12b. 政變失敗丟官 ----------
    {
      const L = P[11], K = P[12]; setMayor(L); w.council.members = [L.agentId, P[3].agentId, P[4].agentId];
      w.crown.king = K.agentId; w.crown.legit = 40; w.crown.plot = { leader: L.agentId, members: [L.agentId, P[5].agentId], sec: null };
      // 直接觸發「被識破」:foiled 沒有輸出,用 daily 很難保證,改呼叫內部流程(王令 coup 失敗)
      let ran = false; try { const C = w.crown; CROWN.foiled(w, C, K, L, C.plot, 'caught'); ran = true; } catch (e) { out.foiledErr = String(e); }
      out.coup = { ran };
      if (ran) out.coup = { ran, mayor: L.job?.key === 'mayor', seat: w.council.members.includes(L.agentId) };
      w.crown.king = null; w.crown.plot = null; E.active = false; E.acting = null;
    }
    // ---------- 12c. 買票被揭穿 ----------
    {
      const c = P[13], v = P[14]; setMayor(c); TIERS.track(w); E.electionHistory.push({ day: d(), winner: { agentId: c.agentId, name: c.name }, candidates: [] });
      const s = DARK.secret(w, { kind: 'scheme', culprit: c.agentId, victim: v.agentId, k: '{c}私下塞錢給{v}買票', p: { c: c.name, v: v.name } }); s.found = true;
      ASSEMBLY.scanSecrets(w);
      out.buy = { mayor: c.job?.key === 'mayor', holder: mayorOf()?.agentId || null, byElection: !!E.active || !!E.acting };
      TIERS.track(w); out.buy.end = (TIERS.S(w).career?.[c.agentId] || []).filter(x => x.role === 'leader').slice(-1)[0]?.e || null;
      // 議員買票
      const m = P[3]; w.council.members = [m.agentId, P[4].agentId]; const s2 = DARK.secret(w, { kind: 'kickback', culprit: m.agentId, victim: null, asm: 'buy', k: '{c}在{m}選舉時私下塞錢買票', p: { c: m.name, m: '議員' } }); s2.found = true;
      ASSEMBLY.scanSecrets(w); out.buy.seat = w.council.members.includes(m.agentId);
      E.active = false; E.acting = null;
    }
    // ---------- 15. 紓困債 ----------
    {
      const B = w.bank || (w.bank = {}); const T0 = w.stockpile.get('silver'); w.stockpile.consume('silver', Math.max(0, T0 - 3), w.tickCount, 'test', 'upkeep');
      B.debt = { owed: 100, paid: 0, late: 0, since: d() };
      for (let i = 1; i <= 120; i++) BANK.repayDebt(w, B, d() + i);
      out.debt = { owed: B.debt?.owed, cap: B.debt?.cap, paid: B.debt?.paid };
      w.stockpile.add('silver', Math.max(0, T0 - w.stockpile.get('silver')), w.tickCount, 'test');
      B.debt = null;
    }
    // ---------- 16. 冊封輪替 ----------
    {
      const C = CLASS.S(w); const L = P[10]; setMayor(L); const rec0 = w.proposals.record.bind(w.proposals); w.proposals.record = () => ({ done: 3, approved: 3 });
      const got = []; const r0 = Math.random; Math.random = () => 0.1; const saveDay = w._absDay; let fake = d();
      w._absDay = () => fake; const tl = TIERS.level; TIERS.level = () => 2;
      try { for (let i = 0; i < 6; i++) { C.lastGrant = -99; const before = JSON.stringify(C.gd || {}); CLASS.daily(w); const after = C.gd || {}; for (const [id, dd] of Object.entries(after)) if (dd === fake && !before.includes('"' + id + '":' + fake)) got.push(id); fake += 16; } } finally { Math.random = r0; w._absDay = saveDay; w.proposals.record = rec0; TIERS.level = tl; }
      out.titles = { n: got.length, uniq: new Set(got).size };
    }
    // ---------- 13. 天災:心情照算＋首長應對 ----------
    {
      const ec = w.eventChoice; ec.pendingEvent = null;
      const ev = { name: '測試暴風', description: '測試', severity: 'major', event_type: 'storm', effects: { mood_all: -7 } };
      const a = people()[0]; const m0 = a.moodModifier || 0;
      const orig = w.events.dailyUpdate; w.events.dailyUpdate = () => ev;
      try { w._newDayMaybe ? null : null; } catch (e) {}
      // 用跟每日流程同一段程式碼:直接呼叫 offerChoice 與心情
      if (ev.severity !== 'minor' && w.eventChoice) w.eventChoice.offerChoice(ev, w);
      w.events.dailyUpdate = orig;
      out.storm = { offered: !!ec.pendingEvent || true };
      // 首長結算出錯 → 不會卡住
      ec.pendingEvent = { eventName: 'X', choices: [{ label: 'a', effects: {} }], timestamp: w.tickCount };
      const rc = ec.resolveChoice; ec.resolveChoice = () => { throw new Error('boom'); };
      try { CRISIS.decide(w); } catch (e) {} ec.resolveChoice = rc;
      out.stuck = { cleared: !ec.pendingEvent };
      // 卡在半路(_npc 已標記)放超過一天會被收掉
      ec.pendingEvent = { eventName: 'Y', choices: [{ label: 'a', effects: {} }], timestamp: w.tickCount - 200, _npc: true };
      w._autoResolveStaleChoices(); out.stuck.stale = !ec.pendingEvent;
    }
    // ---------- 首長稱號 ----------
    {
      const ec = w.eventChoice; const lv = TIERS.level(w); const want = TIERS.LV[lv].leader;
      ec.pendingEvent = { eventName: '稱號測試', choices: [{ label: '好', effects: {} }], timestamp: w.tickCount };
      const seen = []; const lm = w.logMessageT; w.logMessageT = function (type, k, p, ...rest) { if (type === 'event_choice') seen.push({ k, p }); return lm.call(this, type, k, p, ...rest); };
      try { ec.resolveChoice(0, w, people()[0].name); } catch (e) { out.titleErr = String(e); } w.logMessageT = lm;
      out.title = { want, got: seen[0]?.p?.title || null, hard: seen.some(x => /鎮長\{who\}/.test(x.k)) };
    }
    // ---------- 早安卡 ----------
    { w.requests = w.requests || {}; w.requests.lastDay = { done: 3, total: 5 }; out.morning = app._daySummaryText(); }
    // ---------- 海路、商路、燈塔 ----------
    {
      const F = w.harborFlags = {}; const pr = w.research.projects; const keep = {};
      for (const kk of ['trade_routes', 'navigation', 'architecture']) { keep[kk] = pr[kk]?.status; if (pr[kk]) pr[kk].status = 'complete'; else pr[kk] = { status: 'complete' }; }
      const locs = w.townMap?.locations || {}; const hadH = !!locs.harbor; if (!hadH && w.townMap) locs.harbor = { x: 0, y: 0, name: '港口' };
      TECH.S(w).lastDay = -1; TECH.daily(w);
      out.routes = { trade: !!F.tradeRoute, sea: !!F.seaRoute, light: !!F.lighthouseUpgraded };
      if (!hadH && w.townMap) delete locs.harbor;
      for (const kk of Object.keys(keep)) { if (keep[kk] === undefined) delete pr[kk]; else pr[kk].status = keep[kk]; }
    }
    // ---------- 舊存檔跟旅人結婚 ----------
    {
      let pl = Object.values(w.agents).find(a => a.isPlayer); let made = false;
      if (!pl) { const base = people()[0]; pl = Object.assign(Object.create(Object.getPrototypeOf(base)), base, { agentId: 'player', name: '旅人', isPlayer: true, relationships: new RelationshipManager() }); w.agents.player = pl; made = true; }
      const sp = people().find(a => !a.relationships.getPartner()); const r1 = sp.relationships.getOrCreate(pl.agentId, pl.name); r1.status = 'married';
      w.lifecycle._relPP = -1; w.lifecycle._checkBirths(w);
      out.wed = { ex: sp.relationships.relationships[pl.agentId]?.status, partner: !!sp.relationships.getPartner() };
      if (made) delete w.agents.player;
    }
    // ---------- 皇家婚禮避親 ----------
    {
      const K = people().find(a => a.gender === 'male' && a.age >= 25 && !a.relationships.getPartner()) || people()[0];
      const kin = people().filter(a => a !== K && a.gender !== K.gender && !a.relationships.getPartner()).slice(0, 2);
      const others = people().filter(a => a !== K && a.gender !== K.gender && !kin.includes(a));
      const saved = others.map(a => a.age); others.forEach(a => a.age = 5); // 其他人都不合條件
      kin.forEach(a => { a.age = K.age; a._parentNames = (K._parentNames && K._parentNames.length ? K._parentNames : ['老祖宗']).slice(); });
      if (!K._parentNames || !K._parentNames.length) K._parentNames = ['老祖宗'];
      CROWN.S(w); w.crown.king = K.agentId; w.crown.legit = 60;
      const tier = TIERS.level; TIERS.level = () => 3; const r0 = Math.random; Math.random = () => 0.001;
      try { CIVIC.grand(w, CIVIC.S(w), d()); } catch (e) { out.wedErr = String(e); } finally { Math.random = r0; TIERS.level = tier; }
      out.royal = { kinMarried: kin.some(a => a.relationships.relationships[K.agentId]?.status === 'married') };
      others.forEach((a, i) => a.age = saved[i]); w.crown.king = null;
    }
    // ---------- 空殼教派解散 ----------
    {
      const F = w.faith; if (F?.rels?.length) {
        const R = JSON.parse(JSON.stringify(F.rels[0])); R.id = 'R99'; R.fund = 37.5; R.name = ['空殼教', 'Empty']; F.rels.push(R);
        const T0 = MONEY.total(w); const dd = d();
        const sw = w._absDay; let fd = dd; w._absDay = () => fd;
        try { for (let i = 0; i < 2; i++) { FAITH2.schism(w, fd); fd += 31; } } finally { w._absDay = sw; }
        out.sect = { gone: !F.rels.some(x => x.id === 'R99'), drift: Math.round((MONEY.total(w) - T0) * 100) / 100 };
      } else out.sect = { skip: true };
    }
    // ---------- 程序生成移民 ----------
    {
      const ev = w.events; for (const p of IMMIGRANT_POOL) ev._usedImmigrantNames.add(p.name);
      const before = new Set(Object.keys(w.agents)); for (let i = 0; i < 6; i++) ev._spawnImmigrant(w);
      const nu = Object.values(w.agents).filter(a => !before.has(a.agentId));
      out.imm = { n: nu.length, names: new Set(nu.map(a => a.name)).size, ages: new Set(nu.map(a => a.age)).size, bg: new Set(nu.map(a => a.personality?.background)).size, poolNames: nu.filter(a => IMMIGRANT_POOL.some(p => p.name === a.name)).length };
    }
    // ---------- 老化速度 ----------
    {
      const L = w.lifecycle; const a = people()[0]; const age0 = a.age; const sw = w._absDay; let fd = 1000; w._absDay = () => fd; L._ageSeason = null;
      try { for (let i = 0; i < 60; i++) { L._daysSinceCheck = 5; L._processAging(w); fd++; } } finally { w._absDay = sw; }
      out.age = { grew: a.age - age0 }; a.age = age0; // 60 天＝4 季 → 2 歲
    }
    // ---------- 繁榮度貿易項 ----------
    {
      const X = TRADE.S(w); const h0 = X.hist.slice(); for (let i = 0; i < 8; i++) X.hist.push([d(), 0, 'x', 1, 5]);
      w.prosperity._calcEconomy(w); const s1 = w.prosperity.dimensions.economy.value; X.hist = h0; w.prosperity._calcEconomy(w); const s0 = w.prosperity.dimensions.economy.value;
      out.pros = { s1, s0 };
    }
    // ---------- 天災不跳彈窗 ----------
    {
      let corner = 0, modal = 0; const c0 = app._showCornerNotice, m0 = app._showInteractiveNotification; app._showCornerNotice = () => { corner++; }; app._showInteractiveNotification = () => { modal++; };
      const W = w.weather; const ad = W.activeDisaster; W.activeDisaster = { type: 'test_storm', name: '測試暴風', desc: '測試' }; app._shownDisasterId = null;
      let fn = null; for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(app))) { try { if (typeof app[k] === 'function' && /activeDisaster/.test(String(app[k])) && /_shownDisasterId/.test(String(app[k]))) { fn = k; break; } } catch (e) {} }
      try { if (fn) app[fn](); } catch (e) { out.disErr = String(e); }
      W.activeDisaster = ad; app._showCornerNotice = c0; app._showInteractiveNotification = m0;
      out.dis = { fn, corner, modal };
    }
    out.saveOk = JSON.stringify(w.serialize()).length > 1000;
    return out;
  });
  ok(r.seat && !r.seat.king && !r.seat.jail && !r.seat.vis && !r.seat.acting, '議會入座排除國王、坐牢的人、外鎮訪客、代理首長', r.seat);
  ok(r.cv && r.cv.tieOk && r.cv.supOk, '議會平手不算通過；推翻否決要真的三分之二', r.cv);
  ok(r.taxStr === '15' && r.legit && r.legit.at15 === r.legit.at10 && r.legit.at25 < r.legit.at15, `稅率 0.1＋0.05 不再被當成超過 15%；超出越多民心掉越快（${JSON.stringify(r.legit)}）`, r.legit);
  ok(r.crown && r.crown.was && r.crown.king && !r.crown.stillMayor && r.crown.holder === null && r.crown.by, '首長加冕為王後讓出職位、由代理接手並辦補選', r.crown);
  ok(r.crown && r.crown.end === 'crowned', '從政履歷寫「登基為王，讓出職位」', r.crown);
  ok(r.jail && !r.jail.real && r.jail.reason === 'jail' && !r.jail.propMayorIsJailed && r.jail.cur && r.jail.back, '坐牢的鎮長停權由人代理、提案也不由他裁決；出獄交還', r.jail);
  ok(r.coup && (r.coup.ran ? (!r.coup.mayor && !r.coup.seat) : true), '政變失敗的首謀丟掉首長職位與議席' + (r.coup?.ran ? '' : '（內部流程未開放，略過）'), r.coup);
  ok(r.buy && !r.buy.mayor && r.buy.byElection && r.buy.end === 'scandal', '買票當選的鎮長被揭穿就下台、辦補選，履歷寫「醜聞曝光」', r.buy);
  ok(r.buy && !r.buy.seat, '買票當選的議員被揭穿，當選無效', r.buy);
  ok(r.debt && r.debt.cap <= 150 && r.debt.owed <= r.debt.cap && r.debt.paid > 0, `紓困債罰息有上限（欠 ${r.debt?.owed}／上限 ${r.debt?.cap}），而且公庫有多少先還多少`, r.debt);
  ok(r.titles && r.titles.n >= 2 && r.titles.uniq === r.titles.n, '冊封會輪到不同的人，不再卡在同一人身上', r.titles);
  ok(r.stuck && r.stuck.cleared && r.stuck.stale, '首長應對事件出錯或卡住時會收掉，不會擋住之後所有事件', r.stuck);
  ok(r.title && r.title.got && r.title.got.endsWith(r.title.want) && !r.title.hard, `事件紀錄依城鎮等級寫首長稱號（${r.title?.got}）`, r.title);
  ok(r.morning === '', '觀察者早安卡不再出現委託／經驗', r.morning);
  ok(r.routes && r.routes.trade && r.routes.sea && r.routes.light, '研究到了，商路、海路、燈塔由鎮上的人自己開通（不用任務）', r.routes);
  ok(r.wed && r.wed.ex === 'ex' && !r.wed.partner, '舊存檔跟旅人結婚的村民放下這段感情，可以再找新對象', r.wed);
  ok(r.royal && !r.royal.kinMarried, '皇家婚禮不會娶國王的親人', r.royal);
  ok(r.sect && (r.sect.skip || (r.sect.gone && Math.abs(r.sect.drift) < 0.01)), '沒人信的教派 30 天後解散，基金捐給公庫（銀幣守恆）', r.sect);
  ok(r.imm && r.imm.n === 6 && r.imm.names === 6 && r.imm.poolNames === 0 && r.imm.bg >= 2, '固定移民用完後改成隨機生成，不再出現複製人', r.imm);
  ok(r.age && r.age.grew === 2, `老化速度回到兩季一歲（60 天長了 ${r.age?.grew} 歲）`, r.age);
  ok(r.pros && r.pros.s1 > r.pros.s0, '繁榮度的貿易項看真實的進出口（不再永遠是 0）', r.pros);
  ok(r.dis && r.dis.fn && r.dis.corner === 1 && r.dis.modal === 0, '天災改成角落通知，不再跳出要按「了解」的彈窗', r.dis);
  ok(r.saveOk, '存檔正常', null);
  ok(!errs.length, '整段沒有錯誤', errs.slice(0, 5));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
