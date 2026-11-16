// v11.0.0 市場與第四權（第一段）之一：老闆的經營手法——漲價、偷工減料、同行講好
//   1) 沒有人動手腳時，買賣照舊；公營的店不受影響
//   2) 漲價：客人多付、多的錢進老闆口袋（照樣繳營業稅）、全鎮的錢一分不差；客人記得是誰漲的
//   3) 偷工減料：留下該付給上游的錢；員工看得到；客人可能出事、體弱的會死；出事的人起疑
//   4) 有對手店：客人照兩家的價錢分；自己挑了店的照他挑的；錢進對的那一家
//   5) 抵制又沒有別家：衣服柴火不買、飯少吃
//   6) 同行講好：兩家都漲、對方知道；假裝答應的只有一家漲；一方降回去就破局
//   7) 老闆的決定與各種當事人的決定（選項、照個性的傾向、做了以後發生什麼）
//   8) 誰會被問；這一組有自己的每日 AI 額度；存讀檔；中英
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
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); w.fullAgentMode = false;
    const out = {}; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const W = WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); const MM = MONEY.S(w); DEALASK.S(w); W.tax = 0.1;
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const near = (a, b, e = 0.02) => Math.abs(a - b) <= e; const r2 = (x) => Math.round(x * 100) / 100;
    const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; fn(); return Math.round(((MONEY.total(w) - T0) - (MM.pend - P0)) * 1000) / 1000; };
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a.job?.key !== 'mayor');
    const [O1, O2, O3, FARM, C1, C2, C3, S1, S2, X1] = adults; for (const a of [O1, O2, O3, FARM, C1, C2, C3, S1, S2, X1]) { traits(a, []); bal(a, 200); }
    // 三家店各有東家、農莊有東家；食堂另有一家對手店
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; M.price = {};
    M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; M.owners.timber = O3.agentId; M.owners.farm = FARM.agentId;
    O1.job = new Job('trader'); O2.job = new Job('trader'); O3.job = new Job('trader'); FARM.job = new Job('farmer');
    for (const a of npcs()) if (a.job?.key === 'cook' || a.job?.key === 'tailor') a.job = new Job('farmer');
    S1.job = new Job('cook'); S2.job = new Job('cook'); X1.job = new Job('tailor'); C1.job = new Job('miner'); C2.job = new Job('miner'); C3.job = new Job('miner');
    const rivalOn = () => { M.rival.kitchen = { fid: 'RV1', owner: O2.agentId, since: w._absDay() - 30, price: 1, pay: 1, emp: { [S2.agentId]: 1 }, rev: 0, cost: 0, hist: [], loss: 0 }; };
    const d = w._absDay();

    // 1) 乾淨的時候照舊
    const q0 = DEAL.price(w, C1, 'clothes', 6); out.clean = { on: DEAL.on(w), p: q0.p, key: q0.key || null, firms: DEAL.firms(w).join(), mine: DEAL.firmsOf(w, O3.agentId).join() };
    delete M.owners.timber; out.clean.pub = DEAL.firms(w).join(); M.owners.timber = O3.agentId;

    // 2) 獨家漲價
    DEAL.setUp(w, 'textile', 0.3); const fh = DEAL.liveFact(w, 'textile', 'hike'); const q1 = DEAL.price(w, C1, 'clothes', 6);
    const o3 = bal(O3), f0 = bal(FARM), tr0 = w.stockpile.get('silver'); const lk1 = leak(() => { WALLET.take(w, C1, q1.p); DEAL.sale(w, C1, 'clothes', 6, q1); });
    out.hike = { p: q1.p, key: q1.key, open: !!fh?.open, owner: r2(bal(O3) - o3), farm: r2(bal(FARM) - f0), tax: r2(w.stockpile.get('silver') - tr0), leak: lk1, gain: DEAL.F(w, 'textile').gain, seen: D.seen[C1.agentId + '|textile'] === DEAL.F(w, 'textile').v,
      mem: (C1.memory?.entries || []).some(m => /貴了 30%|cost 30% more/.test(m.content || '')), aff: (C1.relationships.relationships[O3.agentId]?.affinity || 0) < 0, log: (w.messageLog || []).some(m => /🏷️/.test(m.content || '')) };
    const g1 = DEAL.F(w, 'textile').gain; WALLET.take(w, C1, q1.p); DEAL.sale(w, C1, 'clothes', 6, q1); out.hike.once = (C1.memory?.entries || []).filter(m => /貴了 30%|cost 30% more/.test(m.content || '')).length === 1 && near(DEAL.F(w, 'textile').gain, g1 + 1.8);
    DEAL.setUp(w, 'textile', 0); out.hike.back = fh.end != null && DEAL.price(w, C1, 'clothes', 6).key == null;

    // 3) 偷工減料（食堂，先沒有對手店）
    DEAL.setCut(w, 'kitchen', 2); const fc = DEAL.liveFact(w, 'kitchen', 'cut'); const q2 = DEAL.price(w, C2, 'meal', 3);
    const o1 = bal(O1), f1 = bal(FARM); const lk2 = fix(0.99, () => leak(() => { WALLET.take(w, C2, q2.p); DEAL.sale(w, C2, 'meal', 3, q2); }));
    out.cut = { p: q2.p, staff: Object.keys(fc.knows).sort().join() === [S1.agentId, S2.agentId].sort().join(), how: fc.knows[S1.agentId], owner: r2(bal(O1) - o1), farm: r2(bal(FARM) - f1), leak: lk2, gain: DEAL.F(w, 'kitchen').gain, noHarm: (fc.harm || 0) === 0 };
    D.newKnow = []; const a0 = (HEALTH.ails(w, C2) || []).length; fix(0, () => { WALLET.take(w, C2, 3); DEAL.sale(w, C2, 'meal', 3, q2); });
    out.cut.sick = { ail: (HEALTH.ails(w, C2) || []).length === a0 + 1, harm: fc.harm === 1, rec: D.harm.some(h => h.id === C2.agentId && h.sev === 2 && !h.dead), knows: fc.knows[C2.agentId] === 'victim', newKnow: D.newKnow.some(x => x[1] === C2.agentId), alive: !C2.isDead };
    const old = npcs().find(a => (a.age || 30) >= 5 && ![O1, O2, O3, FARM, C1, C2, C3, S1, S2, X1].includes(a) && a.job?.key !== 'mayor'); old.age = 72; bal(old, 50); const oid = old.agentId; const pop0 = npcs().length;
    fix(0, () => { WALLET.take(w, old, 3); DEAL.sale(w, old, 'meal', 3, DEAL.price(w, old, 'meal', 3)); });
    out.cut.dead = { gone: npcs().length === pop0 - 1 && !npcs().some(a => a.agentId === oid), fact: fc.dead === 1, list: (D.deaths || []).some(x => x.id === oid && x.key === 'kitchen'), st: D.st.dead === 1 };
    DEAL.setCut(w, 'timber', 1); out.cut.fuel = DEAL.price(w, C1, 'firewood', 1.5).p; DEAL.setCut(w, 'timber', 0);

    // 4) 對手店
    rivalOn(); const sh0 = DEAL.rivalShare(w, 'kitchen'); DEAL.setUp(w, 'kitchen', 0.5); const sh1 = DEAL.rivalShare(w, 'kitchen');
    DEAL.setPref(w, C3, 'kitchen', 'r'); const q3 = DEAL.price(w, C3, 'meal', 3); const o2 = bal(O2), rv0 = M.rival.kitchen.rev || 0; const lk3 = leak(() => { WALLET.take(w, C3, q3.p); DEAL.sale(w, C3, 'meal', 3, q3); });
    DEAL.setPref(w, C3, 'kitchen', 'i'); const q4 = DEAL.price(w, C3, 'meal', 3);
    out.rival = { firms: DEAL.firms(w).join(), sh0, sh1, key: q3.key, p: q3.p, owner2: r2(bal(O2) - o2), rev: r2((M.rival.kitchen.rev || 0) - rv0), leak: lk3, key4: q4.key, p4: q4.p, staffI: DEAL.staff(w, 'kitchen').map(a => a.agentId).join(), staffR: DEAL.staff(w, 'kitchen#r').map(a => a.agentId).join(), other: DEAL.other(w, 'kitchen') };
    delete D.pref[C3.agentId]; DEAL.countPref(w); let nr = 0; for (let i = 0; i < 400; i++) if (DEAL.choose(w, C3, 'kitchen') === 'kitchen#r') nr++; out.rival.draw = nr / 400;

    // 5) 抵制又沒有別家
    DEAL.setPref(w, C1, 'textile', 'none'); out.none = { clothes: !!DEAL.price(w, C1, 'clothes', 6).skip, fuelFree: !DEAL.price(w, C1, 'firewood', 1.5).skip };
    delete M.rival.kitchen; DEAL.setPref(w, C1, 'kitchen', 'none'); out.none.mealSkip = !!fix(0.1, () => DEAL.price(w, C1, 'meal', 3).skip); out.none.mealEat = !fix(0.9, () => DEAL.price(w, C1, 'meal', 3).skip); delete D.pref[C1.agentId]; DEAL.countPref(w);

    // 6) 同行講好
    rivalOn(); DEAL.setUp(w, 'kitchen', 0); DEAL.setCut(w, 'kitchen', 0); const pf = DEAL.pact(w, 'kitchen', false);
    out.pact = { both: DEAL.F(w, 'kitchen').up === 0.2 && DEAL.F(w, 'kitchen#r').up === 0.2, knows: pf.knows[O2.agentId] === 'party', tag: DEAL.F(w, 'kitchen').pact === pf.id && DEAL.F(w, 'kitchen#r').pact === pf.id };
    DEAL.setUp(w, 'kitchen#r', 0); out.pact.riv0 = DEAL.F(w, 'kitchen#r').pact == null; DEAL.setUp(w, 'kitchen', 0); D.lastDay = null; DEAL.daily(w); out.pact.broken = pf.end != null;
    const pf2 = DEAL.pact(w, 'kitchen', true); out.pact.fake = DEAL.F(w, 'kitchen').up === 0.2 && DEAL.F(w, 'kitchen#r').up === 0 && pf2.fake === true; DEAL.endPact(w, pf2, 't'); DEAL.setUp(w, 'kitchen', 0);

    // 7) 決定
    const K = DECIDE.KINDS; const ids = (k, a, c) => K[k].options(w, a, c).map(o => String(o.id).split(':')[0] === 'up' ? o.id : o.id); const opt = (k, a, c, id) => K[k].options(w, a, c).find(o => o.id === id); const q = () => DECIDE.S(w).q; const qHas = (kind, a) => q().some(x => x.kind === kind && x.a === a.agentId);
    out.run = { when: !!K.dealRun.when(w, O1) && !K.dealRun.when(w, C1), ids: ids('dealRun', O1).join(), facts: K.dealRun.facts(w, O1), group: ['dealRun', 'dealPact', 'dealCust', 'dealJoin', 'dealVictim', 'dealStaff', 'dealFaced'].every(k => K[k]?.aiGroup === 'deal'), budget: DECIDE.AI_GROUP.deal };
    traits(O1, ['greedy']); const bg = opt('dealRun', O1, null, 'up:0.2').base, cg = opt('dealRun', O1, null, 'cut:1').base; traits(O1, ['kind']); const bk = opt('dealRun', O1, null, 'up:0.2').base, ck = opt('dealRun', O1, null, 'cut:1').base; traits(O1, []);
    out.run.lean = bg > bk && cg > ck; opt('dealRun', O1, null, 'up:0.2').run(w, O1); out.run.up = DEAL.F(w, 'kitchen').up === 0.2; out.run.ids2 = ids('dealRun', O1).join();
    opt('dealRun', O1, null, 'cut:1').run(w, O1); out.run.cut = DEAL.F(w, 'kitchen').cut === 1; opt('dealRun', O1, null, 'fair').run(w, O1); out.run.fair = DEAL.F(w, 'kitchen').up === 0 && DEAL.F(w, 'kitchen').cut === 0;
    DECIDE.S(w).q.length = 0; opt('dealRun', O1, null, 'pact').run(w, O1); out.run.pactAsk = qHas('dealPact', O2);
    const pc = { key: 'kitchen', by: O1.agentId }; out.pactD = { ids: ids('dealPact', O2, pc).join(), wrong: K.dealPact.options(w, C1, pc).length === 0, facts: K.dealPact.facts(w, O2, pc) };
    opt('dealPact', O2, pc, 'yes').run(w, O2); out.pactD.yes = DEAL.F(w, 'kitchen#r').up === 0.2 && !!DEAL.F(w, 'kitchen').pact; out.run.noPact = !ids('dealRun', O1).includes('pact');
    const lp = DEAL.factOf(w, DEAL.F(w, 'kitchen').pact); DEAL.endPact(w, lp, 't'); DEAL.setUp(w, 'kitchen', 0); DEAL.setUp(w, 'kitchen#r', 0);
    w.press = w.press || { papers: [], reads: {}, n: 0 }; if (!w.press.papers.length) w.press.papers.push({ id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, stories: [] });
    const t0 = D.tips.length; opt('dealPact', O2, pc, 'tell').run(w, O2); out.pactD.tell = D.tips.length === t0 + 1 && D.facts.some(f => f.attempt && f.by === O1.agentId && f.end != null); w.press.papers.length = 0; // 先拿掉報社：下面要確認沒有報社時客人沒有「向報社投訴」這個選項
    // 客人
    DEAL.setUp(w, 'kitchen', 0.3); const fk = DEAL.liveFact(w, 'kitchen', 'hike'); const cc = { key: 'kitchen', fid: fk.id }; C1.relationships.getOrCreate(C2.agentId, C2.name).affinity = 60; C2.relationships.getOrCreate(C1.agentId, C1.name).affinity = 60;
    out.cust = { ids: ids('dealCust', C1, cc).join(), facts: K.dealCust.facts(w, C1, cc) };
    opt('dealCust', C1, cc, 'switch').run(w, C1); out.cust.sw = DEAL.prefOf(w, C1, 'kitchen')?.f === 'r'; const m0 = (C2.memory?.entries || []).length; opt('dealCust', C1, cc, 'gripe').run(w, C1); out.cust.gripe = (C2.memory?.entries || []).length === m0 + 1;
    DECIDE.S(w).q.length = 0; opt('dealCust', C1, cc, 'boycott').run(w, C1); out.cust.boy = D.boy.kitchen?.lead === C1.agentId && D.boy.kitchen.to === 'r' && qHas('dealJoin', C2) && !qHas('dealJoin', O1);
    const jc = { key: 'kitchen', lead: C1.agentId }; out.join = { ids: ids('dealJoin', C2, jc).join(), facts: K.dealJoin.facts(w, C2, jc) }; opt('dealJoin', C2, jc, 'join').run(w, C2); out.join.in = DEAL.prefOf(w, C2, 'kitchen')?.f === 'r' && D.boy.kitchen.n === 2 && DEALASK.boycotters(w, 'kitchen') === 2;
    out.join.ownerSees = /2/.test(K.dealRun.facts(w, O1)); const fairBoy = opt('dealRun', O1, null, 'fair').base; delete D.boy.kitchen; out.join.fairUp = fairBoy > opt('dealRun', O1, null, 'fair').base;
    w.press = w.press || { papers: [], reads: {}, n: 0 }; if (!w.press.papers.length) w.press.papers.push({ id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, stories: [] });
    const t1 = D.tips.length; opt('dealCust', C1, cc, 'tip').run(w, C1); out.cust.tip = D.tips.length === t1 + 1 && fk.tipped === 1;
    // 受害人、員工、老闆被找上門
    DEAL.setUp(w, 'kitchen', 0); DEAL.setCut(w, 'kitchen', 1); const f2 = DEAL.liveFact(w, 'kitchen', 'cut'); f2.harm = 3; DEAL.learn(w, f2, C2, 'victim'); const vc = { fid: f2.id };
    out.vic = { ids: ids('dealVictim', C2, vc).join(), facts: K.dealVictim.facts(w, C2, vc) }; DECIDE.S(w).q.length = 0; opt('dealVictim', C2, vc, 'confront').run(w, C2); out.vic.faced = qHas('dealFaced', O1);
    const r0 = D.reports.length; opt('dealVictim', C2, vc, 'report').run(w, C2); out.vic.report = D.reports.length === r0 + 1; opt('dealVictim', C2, vc, 'tell').run(w, C2); out.vic.told = f2.knows[C1.agentId] === 'told';
    out.staff = { ids: ids('dealStaff', S1, vc).join(), facts: K.dealStaff.facts(w, S1, vc) }; traits(S1, ['kind', 'perfectionist']); const tipH = opt('dealStaff', S1, vc, 'tip').base; traits(S1, ['lazy', 'gossip']); const tipL = opt('dealStaff', S1, vc, 'tip').base; traits(S1, []); out.staff.honest = tipH > tipL;
    DECIDE.S(w).q.length = 0; opt('dealStaff', S1, vc, 'hush').run(w, S1); const hq = q().find(x => x.kind === 'dealFaced'); out.staff.hushAsk = hq?.ctx?.type === 'hush' && hq.ctx.n >= 8;
    const hc = hq.ctx; out.faced = { ids: ids('dealFaced', O1, hc).join(), facts: K.dealFaced.facts(w, O1, hc) }; const s1 = bal(S1), tipB = opt('dealStaff', S1, vc, 'tip').base; opt('dealFaced', O1, hc, 'pay').run(w, O1);
    out.faced.paid = near(bal(S1), s1 + hc.n) && !ids('dealStaff', S1, vc).includes('hush') && opt('dealStaff', S1, vc, 'tip').base < tipB && /封口費|hush money/.test(K.dealStaff.facts(w, S1, vc));
    const cf = { fid: f2.id, by: C2.agentId, type: 'confront', n: 10 }; out.faced.ids2 = ids('dealFaced', O1, cf).join(); DECIDE.S(w).q.length = 0; opt('dealFaced', O1, cf, 'deny').run(w, O1); out.faced.deny = qHas('dealVictim', C2) && !ids('dealVictim', C2, vc).includes('confront') && /不認帳|denied/.test(K.dealVictim.facts(w, C2, vc));
    const c2 = bal(C2); opt('dealFaced', O1, cf, 'fix').run(w, O1); out.faced.fix = DEAL.F(w, 'kitchen').cut === 0 && near(bal(C2), c2 + 10) && f2.end != null;
    DEAL.setCut(w, 'kitchen', 2); const f3 = DEAL.liveFact(w, 'kitchen', 'cut'); const hc2 = { fid: f3.id, by: S1.agentId, type: 'hush', n: 10 }; DECIDE.S(w).q.length = 0; opt('dealFaced', O1, hc2, 'fire').run(w, O1); const exq = q().find(x => x.kind === 'dealStaff' && x.a === S1.agentId);
    out.faced.fire = !S1.job && exq?.ctx?.ex === true && !ids('dealStaff', S1, exq.ctx).includes('quit') && /開除|fired/.test(K.dealStaff.facts(w, S1, exq.ctx));
    S2.job = new Job('cook'); const sq = { fid: f3.id }; opt('dealStaff', S2, sq, 'quit').run(w, S2); out.staff.quit = !S2.job;

    // 8) 誰會被問
    S1.job = new Job('cook'); DECIDE.S(w).q.length = 0; D.asked = {}; D.newKnow = []; D.lastDay = null; DEAL.daily(w); out.ask = { staffNew: qHas('dealStaff', S1) };
    DEAL.setUp(w, 'textile', 0.2); const stx = DEAL.F(w, 'textile'); for (const a of [C1, C2, C3, X1, FARM]) D.seen[a.agentId + '|textile'] = stx.v; bal(C3, 5); DECIDE.S(w).q.length = 0; D.lastDay = null; DEAL.daily(w);
    const asked = q().filter(x => x.kind === 'dealCust'); out.ask.cust = asked.length; out.ask.poorFirst = asked[0]?.a === C3.agentId; D.lastDay = null; DEAL.daily(w); out.ask.next = q().filter(x => x.kind === 'dealCust').length; DECIDE.S(w).q.length = 0;
    // 換東家：手法結束
    M.owners.textile = FARM.agentId; D.lastDay = null; DEAL.daily(w); out.change = !D.f.textile && D.facts.filter(f => f.key === 'textile').every(f => f.end != null) && DEAL.F(w, 'textile').up === 0;
    // 整天的買賣一分不差（有人漲價、有人偷工）
    DEAL.setUp(w, 'kitchen', 0.2); DEAL.setUp(w, 'textile', 0.5); DEAL.setCut(w, 'textile', 1); rivalOn(); DEAL.setUp(w, 'kitchen#r', 0.1); for (const a of npcs()) if (bal(a) < 60) bal(a, 60);
    W.lastDay = null; const sp0 = W.stats.spent; out.dayLeak = fix(0.99, () => leak(() => WALLET.daily(w))); out.daySpent = W.stats.spent > sp0; out.dayGain = DEAL.F(w, 'kitchen').gain > 0;
    const v = DEAL.view(w); out.view = { firms: v.firms.length, facts: v.facts.length, names: v.firms.map(f => f.name).join() };
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { f: w2.deal?.f?.kitchen?.up === 0.2, facts: (w2.deal?.facts || []).length === D.facts.length, noTmp: !('newKnow' in (sv.deal || {})) }; w2.reset(); out.save.reset = !w2.deal;
    out.texts = [out.run.facts, out.pactD.facts, out.cust.facts, out.join.facts, out.vic.facts, out.staff.facts, out.faced.facts].join(' ‖ ');
    return out;
  });
  ok(r.clean.on && r.clean.p === 6 && r.clean.key === null && r.clean.firms === 'kitchen,textile,timber' && r.clean.mine === 'textile,timber' && r.clean.pub === 'kitchen,textile', '沒人動手腳時照舊；公營的店不算', r.clean);
  ok(r.hike.p === 7.8 && r.hike.key === 'textile' && r.hike.open && r.hike.owner === 5.98 && r.hike.farm === 1.42 && r.hike.leak === 0 && r.hike.gain === 1.8, '漲三成：客人付 7.8，多的 1.8 進老闆口袋（扣營業稅），上游照舊，一分不差', r.hike);
  ok(r.hike.seen && r.hike.mem && r.hike.aff && r.hike.log && r.hike.once && r.hike.back, '客人記得是誰漲的（每次調價只記一次），對老闆印象變差；調回原價就結束', r.hike);
  ok(r.cut.p === 3 && r.cut.staff && r.cut.how === 'staff' && r.cut.owner === 2.28 && r.cut.farm === 0.57 && r.cut.leak === 0 && r.cut.gain === 0.6 && r.cut.noHarm, '偷工減料：客人付一樣的錢，該給農莊的留下一半；員工看得到', r.cut);
  ok(r.cut.sick.ail && r.cut.sick.harm && r.cut.sick.rec && r.cut.sick.knows && r.cut.sick.newKnow && r.cut.sick.alive, '客人出重症：留下病、記一筆、開始起疑', r.cut.sick);
  ok(r.cut.dead.gone && r.cut.dead.fact && r.cut.dead.list && r.cut.dead.st, '體弱的人吃到會死，死因連到那家店', r.cut.dead);
  ok(r.cut.fuel === 1.65, '柴火偷工是濕柴充好柴：客人得多付一成', r.cut.fuel);
  ok(r.rival.firms.includes('kitchen#r') && r.rival.sh1 > r.rival.sh0 + 0.1 && r.rival.key === 'kitchen#r' && r.rival.p === 3 && r.rival.owner2 > 1.6 && r.rival.rev === 1.8 && r.rival.leak === 0 && r.rival.key4 === 'kitchen' && r.rival.p4 === 4.5, '有對手店：一家漲價客人往另一家流；挑了店的照他挑的付、錢進那一家', r.rival);
  ok(r.rival.other === 'kitchen#r' && r.rival.staffI && r.rival.staffR && r.rival.staffI !== r.rival.staffR && Math.abs(r.rival.draw - r.rival.sh1) < 0.1, '兩家的員工分開算；沒挑店的人照市占隨機去一家', r.rival);
  ok(r.none.clothes && r.none.fuelFree && r.none.mealSkip && r.none.mealEat, '抵制又沒有別家：衣服不買、飯有時少吃一頓；別的東西照買', r.none);
  ok(r.pact.both && r.pact.knows && r.pact.tag && r.pact.riv0 && r.pact.broken && r.pact.fake, '同行講好：兩家都漲、對方知道；有一家降回去就破局；假裝答應的只有一家漲', r.pact);
  ok(r.run.when && r.run.ids === 'keep,up:0.1,up:0.2,up:0.3,up:0.5,cut:1,cut:2,pact' && r.run.lean, '老闆每週的選項齊全；貪心的比較會漲價和偷工，心軟的比較不會', r.run);
  ok(r.run.up && r.run.ids2.startsWith('keep,fair,up:0.3') && r.run.cut && r.run.fair && r.run.pactAsk && r.run.noPact, '選了就生效：漲價、偷工、恢復原樣、去找同行；已經講好的不再提', r.run);
  ok(r.pactD.ids === 'no,yes,fake,tell' && r.pactD.wrong && r.pactD.yes && r.pactD.tell, '同行被找上：答應／拒絕／假裝／說出去（說出去會進報社線索）', r.pactD);
  ok(r.cust.ids === 'pay,switch,gripe,boycott' && r.cust.sw && r.cust.gripe && r.cust.boy && r.cust.tip, '客人：照買／換一家／抱怨／號召別買／向報社投訴，各自生效', r.cust);
  ok(r.join.ids === 'no,join' && r.join.in && r.join.ownerSees && r.join.fairUp, '有人響應抵制；老闆看得到有幾人不來，比較願意改回原價', r.join);
  ok(r.vic.ids === 'swallow,switch,tell,confront,tip,trial,report' && r.vic.faced && r.vic.report && r.vic.told, '起疑的受害人：算了／換店／告訴親近的人／找老闆理論／爆料／提案審判／告發', r.vic);
  ok(r.staff.ids === 'quiet,tell,tip,report,hush,quit' && r.staff.honest && r.staff.hushAsk && r.staff.quit, '員工：裝不知道／講出去／匿名爆料／告發／要封口費／辭職；老實的人比較會爆料', r.staff);
  ok(r.faced.ids === 'deny,pay,fire' && r.faced.paid, '封口費：老闆給了錢，員工之後比較不會說，也不能再要一次', r.faced);
  ok(r.faced.ids2 === 'deny,pay,fix' && r.faced.deny && r.faced.fix, '被找上門：不認帳（對方會更氣、再想一次）／賠錢／認錯改過', r.faced);
  ok(r.faced.fire, '開除開口要錢的員工：他丟了工作，還是知道內情', r.faced);
  ok(r.run.group && r.run.budget === 20, '這一組決定有自己的每日 AI 額度（20 件）', r.run);
  ok(r.ask.staffNew && r.ask.cust === 3 && r.ask.poorFirst && r.ask.next === 5, '誰會被問：剛知道內情的員工；發現變貴的客人每家店每天最多三位、手頭緊的先問', r.ask);
  ok(r.change, '店換了東家，原本的手法跟著結束', r.change);
  ok(r.dayLeak === 0 && r.daySpent && r.dayGain, '整天的買賣（有人漲價、有人偷工、有對手店）全鎮的錢一分不差', [r.dayLeak, r.daySpent, r.dayGain]);
  ok(r.view.firms === 4 && r.view.facts > 3 && r.save.f && r.save.facts && r.save.noTmp && r.save.reset, '畫面資料齊全；存讀檔後還在，開新鎮清掉', [r.view, r.save]);
  ok(zh ? !/\{[a-z]+\}/.test(r.texts) && /東家/.test(r.texts) : !/[一-鿿]/.test(r.texts) && !/\{[a-z]+\}/.test(r.texts), '題目沒有漏翻、沒有沒填的空格', r.texts.slice(0, 600));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
