// v11.0.0 市場與第四權（第一段）之五：出人命之後——死因怎麼連到店、人群、暴動
//   1) 只有一個人死、沒人知道原因：不會鬧，30 天後就過去了
//   2) 死因連到店的四條路：醫生說了（他自己決定）、報上登出來、家屬本來就知道、同一家接連出事
//   3) 連上之後：家屬對東家的好感大降、接上災後反應、問東家與相關的人；有葬禮就等到出殯那天
//   4) 相關的人：守靈／到店門口／砸店／算帳／要賠命錢／提案審判／勸大家冷靜
//   5) 東家：躲／道歉賠錢／逃／雇人守店／怪夥計／找首長
//   6) 人到齊那天：衛兵隊長擋／不管／加入；首長抓人／鎮壓／安撫／躲
//   7) 結果是真的：店被砸停業修理、錢櫃被搶（錢到搶的人手上）、東家被打傷或打死；錢一分不差
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
    WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); DEALASK.S(w); PRESS.S(w); const PW = POWER.S(w); const MM = MONEY.S(w); const sp = w.stockpile; const P = w.proposals; try { CIVIC.S(w); } catch (e) {}
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
    const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; fn(); return Math.round(((MONEY.total(w) - T0) - (MM.pend - P0)) * 1000) / 1000; };
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const like = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; }; const liking = (a, b) => a.relationships.getOrCreate(b.agentId, b.name).affinity;
    const MY = w.election.currentMayor(w); const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a !== MY);
    const [O1, O3, S1, DOC, GD, GD2, K1, K2, K3, F1, F2, F3, F4, J] = adults; const cast = [O1, O3, S1, DOC, GD, GD2, K1, K2, K3, F1, F2, F3, F4, J, MY];
    for (const a of npcs()) if (['guard', 'doctor', 'cook', 'tailor', 'carpenter'].includes(a.job?.key)) a.job = new Job('farmer');
    for (const a of npcs()) { if (a !== GD) like(GD, a, 0); if (a !== DOC) like(DOC, a, 0); }
    for (const a of cast) { traits(a, []); bal(a, 200); for (const b of cast) if (a !== b) like(a, b, 0); if (a !== MY) a.job = new Job('farmer'); }
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; O1.job = new Job('trader'); O3.job = new Job('trader'); S1.job = new Job('cook'); DOC.job = new Job('doctor');
    const P1 = { id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, owner: null, journo: J.agentId, stories: [], fame: 0 }; I18N.registerName('鎮報', 'Town Paper'); I18N.registerName('老周', 'Old Zhou'); I18N.registerName('阿滿', 'Ah Man'); w.press.papers = [P1]; w.press.reads = {}; PW.inf = {}; PW.scandal = {};
    w.deallaw = null; w.office = null; w.tips = null; w.unrest = null; w.camps = null; w.riot = null; D.reports = []; D.tips = []; D.harm = []; D.deaths = []; if (w.ceremony) w.ceremony.list = (w.ceremony.list || []).filter(c => c.kind !== 'funeral');
    const R = RIOT.S(w); const U = UNREST.S(w); const L = DEALLAW.S(w); sp.resources.silver = 5000;
    const K = DECIDE.KINDS; const ids = (k, a, c) => K[k].options(w, a, c).map(o => o.id); const opt = (k, a, c, id) => K[k].options(w, a, c).find(o => o.id === id); const q = () => DECIDE.S(w).q; const qGet = (kind, a) => q().find(x => x.kind === kind && x.a === a.agentId); const qClear = () => { q().length = 0; };
    const _abs = w._absDay.bind(w); let now = _abs(); w._absDay = () => now; const _dr = DECIDE.drain; DECIDE.drain = () => {}; const go = () => { R.lastDay = null; RIOT.daily(w); };
    const cut = (key) => { DEAL.setCut(w, key, 0); DEAL.setCut(w, key, 2); const f = DEAL.liveFact(w, key, 'cut'); DEAL.F(w, key).gain = 40; return f; };
    const death = (key, f, name, kin) => { const dd = { id: 'dead_' + name + '_' + now, name, key, kind: 'meal', d: now, fid: f.id, cause: '食物中毒', linked: false, kin: kin.map(a => a.agentId) }; D.deaths.push(dd); f.dead = (f.dead || 0) + 1; return dd; };
    const cc = { key: 'kitchen' };

    // 0) 家人與最親近的人
    like(F1, K1, 80); out.kin = { close: RIOT.kinIds(w, K1).includes(F1.agentId), notSelf: !RIOT.kinIds(w, K1).includes(K1.agentId) }; like(F1, K1, 0);
    // 1) 一個人死、沒人知道原因
    let f1 = cut('kitchen'); DOC.job = new Job('farmer'); const d1 = death('kitchen', f1, '老周', [K1, K2]); qClear(); go(); let C = R.cases.kitchen;
    out.one = { made: !!C && C.stage === 'grief' && C.dead.length === 1 && R.st.deaths === 1, noAsk: q().length === 0 }; for (let i = 0; i < 5; i++) { now += 1; go(); } out.one.still = C.stage === 'grief' && C.who.length === 0; now += 30; go(); out.one.over = C.stage === 'after' && C.out === 'unknown' && R.hist.length === 1 && R.st.riots === 0;
    // 2) 醫生看出來了
    now += 40; go(); DOC.job = new Job('doctor'); f1 = cut('kitchen'); const d2 = death('kitchen', f1, '老周', [K1, K2]); qClear(); go(); C = R.cases.kitchen;
    out.doc = { asked: !!qGet('riotDoctor', DOC), ids: ids('riotDoctor', DOC, cc).join(), facts: K.riotDoctor.facts(w, DOC, cc), notDoc: K.riotDoctor.options(w, F1, cc).length === 0 }; const bd0 = opt('riotDoctor', DOC, cc, 'family').base; like(DOC, O1, 60); out.doc.friend = opt('riotDoctor', DOC, cc, 'family').base < bd0; like(DOC, O1, 0);
    const t0 = D.tips.length; opt('riotDoctor', DOC, cc, 'paper').run(w, DOC); out.doc.paper = D.tips.length === t0 + 1 && D.tips[D.tips.length - 1].anon === true; opt('riotDoctor', DOC, cc, 'quiet').run(w, DOC); go(); out.doc.quiet = C.stage === 'grief';
    // 3) 連上了
    like(K1, O1, 10); for (const a of [F1, F2]) D.harm.push({ id: a.agentId, name: a.name, key: 'kitchen', kind: 'meal', d: now, sev: 1, fid: f1.id }); opt('riotDoctor', DOC, cc, 'family').run(w, DOC); qClear(); go();
    out.link = { stage: C.stage === 'anger' && C.how === 'doctor' && C.linkedD === now && R.st.linked === 1, hate: liking(K1, O1) === -20, knows: f1.knows[K1.agentId] === 'victim', shock: (AFTERMATH.S(w).cur || []).some(x => x.kind === 'shopdeath'), owner: !!qGet('riotOwner', O1), asked: [K1, K2, F1, F2].every(a => !!qGet('riotAct', a)) && !qGet('riotAct', O1) && !qGet('riotAct', F4), day: C.day === now + 1 && !C.funeral, marked: d2.linked === true, mem: (K1.memory?.entries || []).some(m => /老周|Old Zhou/.test(m.content || '')) };
    // 4) 相關的人
    out.act = { kin: ids('riotAct', K1, cc).join(), hurt: ids('riotAct', F1, cc).join(), facts: K.riotAct.facts(w, K1, cc), factsHurt: K.riotAct.facts(w, F1, cc), notAsked: K.riotAct.options(w, F4, cc).length === 0 };
    const bg = (a) => opt('riotAct', a, cc, 'gather').base; out.act.kinMore = bg(K1) > bg(F1); const bs0 = opt('riotAct', K1, cc, 'smash').base; traits(K1, ['abrasive']); out.act.hot = opt('riotAct', K1, cc, 'smash').base > bs0; traits(K1, ['kind']); out.act.soft = opt('riotAct', K1, cc, 'smash').base < bs0; traits(K1, []);
    // 5) 東家
    out.owner = { ids: ids('riotOwner', O1, cc).join(), facts: K.riotOwner.facts(w, O1, cc), notOwner: K.riotOwner.options(w, F1, cc).length === 0 }; const bo0 = opt('riotOwner', O1, cc, 'sorry').base; traits(O1, ['kind']); out.owner.soft = opt('riotOwner', O1, cc, 'sorry').base > bo0; traits(O1, ['greedy']); out.owner.hard = opt('riotOwner', O1, cc, 'sorry').base < bo0 && opt('riotOwner', O1, cc, 'blame').base > -9; traits(O1, []);
    PW.inf[MY.agentId] = { [O1.agentId]: 40 }; const bp1 = opt('riotOwner', O1, cc, 'protect').base; delete PW.inf[MY.agentId]; out.owner.donor = bp1 > opt('riotOwner', O1, cc, 'protect').base;
    // 道歉賠錢：家屬拿到錢、做法改回來、大家氣消了大半
    const gB = bg(K1); bal(K1, 50); bal(K2, 50); bal(O1, 200); const lkS = leak(() => opt('riotOwner', O1, cc, 'sorry').run(w, O1)); out.sorry = { owner: C.owner === 'sorry', paid: near(bal(K1), 90) && near(bal(K2), 90) && near(bal(O1), 120), leak: lkS, fixed: DEAL.F(w, 'kitchen').cut === 0, less: bg(K1) < gB, once: K.riotOwner.options(w, O1, cc).length === 0, st: R.st.sorry === 1 };
    opt('riotAct', K1, cc, 'pay').run(w, K1); out.sorry.claim = C.claims.includes(K1.agentId) && !ids('riotAct', K1, cc).includes('pay'); now += 1; qClear(); go(); out.sorry.quiet = C.stage === 'after' && C.out === 'quiet' && R.st.riots === 0;
    // 另外三條路：報上登出來、家屬本來就知道、接連出事
    const fresh = (key, n, kin) => { now += 40; go(); delete R.cases[key]; const f = cut(key); D.harm.length = 0; const ds = []; for (let i = 0; i < n; i++) ds.push(death(key, f, i ? '阿滿' : '老周', kin)); qClear(); return { f, ds }; };
    let X = fresh('kitchen', 1, [K1, K2]); DOC.job = new Job('farmer'); X.ds[0].linked = true; go(); out.paths = { paper: R.cases.kitchen.how === 'paper' };
    X = fresh('kitchen', 1, [K1, K2]); DEAL.learn(w, X.f, K2, 'told'); go(); out.paths.kin = R.cases.kitchen.how === 'kin';
    X = fresh('kitchen', 2, [K1, K2]); fix(0.99, () => go()); out.paths.notYet = R.cases.kitchen.stage === 'grief'; now += 1; fix(0, () => go()); out.paths.pattern = R.cases.kitchen.how === 'pattern';
    // 有葬禮：等到出殯那天
    X = fresh('kitchen', 1, [K1, K2, K3]); w.ceremony = w.ceremony || { list: [], anniv: [], n: 0 }; w.ceremony.list.push({ id: 'CX', kind: 'funeral', of: X.ds[0].id, name: '老周', day: now + 2, status: 'planned', family: [], close: [] }); X.ds[0].linked = true; go(); C = R.cases.kitchen; out.funeral = { day: C.day === now + 2 && C.funeral === true, facts: K.riotAct.facts(w, K1, cc) };

    // 6) 人到齊那天
    for (const a of [F1, F2, F3]) { D.harm.push({ id: a.agentId, name: a.name, key: 'kitchen', kind: 'meal', d: now, sev: 1, fid: X.f.id }); } RIOT.ask(w, C);
    opt('riotAct', K1, cc, 'smash').run(w, K1); opt('riotAct', K2, cc, 'beat').run(w, K2); opt('riotAct', K3, cc, 'gather').run(w, K3); opt('riotAct', F1, cc, 'gather').run(w, F1); out.act.joined = C.who.length === 4 && K.riotAct.options(w, K1, cc).length === 0; opt('riotAct', F2, cc, 'calm').run(w, F2); out.act.calm = C.calm === 1;
    const tr0 = (P.items || []).filter(p => p.kind === 'deal_trial').length; opt('riotAct', F3, cc, 'trial').run(w, F3); out.act.trial = (P.items || []).filter(p => p.kind === 'deal_trial').length === tr0 + 1;
    opt('riotOwner', O1, cc, 'hide').run(w, O1); now += 1; qClear(); go(); out.wait = C.stage === 'anger'; GD.job = new Job('guard'); GD2.job = new Job('guard'); GD.age = 50; GD2.age = 25; now += 1; qClear(); go();
    out.riot = { on: C.stage === 'riot' && R.st.riots === 1, go: [K1, K2, K3, F1].every(a => a._thingGo?.why === 'protest'), guard: !!qGet('riotGuard', GD) && !qGet('riotGuard', GD2), mayor: !!qGet('riotMayor', MY) };
    out.guard = { ids: ids('riotGuard', GD, cc).join(), facts: K.riotGuard.facts(w, GD, cc), notGuard: K.riotGuard.options(w, F4, cc).length === 0 }; const bb0 = opt('riotGuard', GD, cc, 'block').base; like(GD, K1, 60); like(GD, K2, 60); out.guard.kin = opt('riotGuard', GD, cc, 'block').base < bb0 && ids('riotGuard', GD, cc).includes('join'); like(GD, K1, 0); like(GD, K2, 0);
    out.mayor = { ids: ids('riotMayor', MY, cc).join(), facts: K.riotMayor.facts(w, MY, cc), notMayor: K.riotMayor.options(w, F4, cc).length === 0 }; const ba0 = opt('riotMayor', MY, cc, 'arrest').base, bsup0 = opt('riotMayor', MY, cc, 'suppress').base; PW.inf[MY.agentId] = { [O1.agentId]: 40 }; out.mayor.donor = opt('riotMayor', MY, cc, 'arrest').base < ba0 && opt('riotMayor', MY, cc, 'suppress').base > bsup0; delete PW.inf[MY.agentId];
    // 7) 結果：衛兵不管、首長躲著 → 店被砸
    opt('riotGuard', GD, cc, 'aside').run(w, GD); opt('riotMayor', MY, cc, 'hide').run(w, MY); const CP = npcs().find(a => !cast.includes(a) && (a.age || 30) >= 20); CP.job = new Job('carpenter'); bal(CP, 0); bal(O1, 200); bal(K1, 10); const hb = HEALTH.body(w, O1).h; now += 1; let lkW = 0; fix(0.99, () => { lkW = leak(() => go()); });
    out.wreck = { out: C.stage === 'after' && C.out === 'wrecked', closed: DEALLAW.closedNow(w, 'kitchen') && DEALLAW.S(w).closed.kitchen === now + RIOT.WRECK_DAYS, repair: near(bal(CP), 30), loot: bal(K1) > 10, owner: bal(O1) < 170, beaten: C.beaten === true && HEALTH.body(w, O1).h < hb && !C.killed, leak: lkW, calm: true, st: R.st.wrecked === 1 && R.st.beaten === 1, angry: U.angry[K1.agentId]?.why === 'death' && U.angry[K1.agentId].at === MY.agentId, hist: R.hist[R.hist.length - 1].out === 'wrecked', lawGap: DEALLAW.okNow(w, 'deal_check', true) };
    // 直接擺出情況算結果
    const mk = (o) => { delete R.cases.kitchen; delete DEALLAW.S(w).closed.kitchen; const f = cut('kitchen'); const dd = death('kitchen', f, '老周', [K1, K2]); dd.rx = 1; const C2 = RIOT.caseFor(w, 'kitchen', dd); C2.dead.push({ id: dd.id, name: dd.name, d: now, kin: dd.kin }); C2.fid = f.id; C2.linkedD = now - 1; C2.stage = 'riot'; C2.day = now - 1; C2.who = [{ id: K1.agentId, act: 'smash' }, { id: K2.agentId, act: 'smash' }, { id: K3.agentId, act: 'beat' }, { id: F1.agentId, act: 'gather' }]; Object.assign(C2, o); bal(O1, 200); fix(0.99, () => RIOT.resolve(w, C2)); return C2; };
    out.res = { block: mk({ guard: 'block' }).out, arrest: mk({ mayor: 'arrest' }).out, sorry: mk({ owner: 'sorry' }).out, hired: mk({ hired: 3 }).out, calm: mk({ calm: 3 }).out, none: mk({}).out, join: mk({ guard: 'join', who: [{ id: K1.agentId, act: 'gather' }, { id: K2.agentId, act: 'gather' }, { id: K3.agentId, act: 'gather' }] }).out, peace: mk({ who: [{ id: K1.agentId, act: 'gather' }, { id: K2.agentId, act: 'gather' }, { id: K3.agentId, act: 'gather' }] }).out };
    // 首長當場抓人、出面安撫；衛兵擋住
    for (const p of (P.items || [])) if (p.kind === 'deal_trial' && p.status === 'open') p.status = 'rejected';
    delete R.cases.kitchen; delete DEALLAW.S(w).closed.kitchen; let f9 = cut('kitchen'); let d9 = death('kitchen', f9, '老周', [K1, K2]); d9.linked = true; qClear(); go(); C = R.cases.kitchen; for (const a of [K1, K2]) opt('riotAct', a, cc, 'gather').run(w, a); C.who.push({ id: K3.agentId, act: 'smash' }); now += 1; qClear(); go();
    opt('riotGuard', GD, cc, 'block').run(w, GD); const lm = liking(K1, MY); opt('riotMayor', MY, cc, 'arrest').run(w, MY); out.arrest = { jail: (w.civic?.jail?.[O1.agentId] || 0) === now + 3, trial: (P.items || []).some(p => p.kind === 'deal_trial' && p.fid === f9.id), liked: liking(K1, MY) > lm, mayor: C.mayor === 'arrest' && C.guard === 'block', once: K.riotMayor.options(w, MY, cc).length === 0 && K.riotGuard.options(w, GD, cc).length === 0, st: R.st.arrests === 1 }; now += 1; go(); out.arrest.held = C.out === 'held';
    delete R.cases.kitchen; f9 = cut('kitchen'); d9 = death('kitchen', f9, '老周', [K1, K2]); d9.linked = true; qClear(); go(); C = R.cases.kitchen; for (const a of [K1, K2]) opt('riotAct', a, cc, 'gather').run(w, a); C.who.push({ id: K3.agentId, act: 'gather' }); now += 1; go(); DEALLAW.S(w).check = 0; DEALLAW.S(w).last = {}; for (const p of (P.items || [])) if (DEALLAW.LAWS.includes(p.kind) && p.status === 'open') p.status = 'rejected';
    opt('riotMayor', MY, cc, 'calm').run(w, MY); out.calm = C.mayor === 'calm' && (P.items || []).some(p => DEALLAW.LAWS.includes(p.kind) && p.proposerId === MY.agentId && p.status === 'open');
    // 雇人守店、怪夥計、逃走、被打死（用布莊）
    const tc = { key: 'textile' }; let ft = cut('textile'); let dt = death('textile', ft, '阿滿', [K1, K2]); dt.linked = true; qClear(); go(); let CT = R.cases.textile; const X1 = npcs().find(a => !cast.includes(a) && a !== CP && (a.age || 30) >= 20); X1.job = new Job('tailor');
    out.owner2 = { ids: ids('riotOwner', O3, tc).join() }; bal(O3, 200); const lkH = leak(() => opt('riotOwner', O3, tc, 'hire').run(w, O3)); out.owner2.hire = CT.hired === 2 && near(bal(O3), 180) && lkH === 0 && CT.owner === 'guarded';
    CT.owner = null; opt('riotOwner', O3, tc, 'blame').run(w, O3); out.owner2.blame = CT.owner === 'blamed' && CT.blamed === X1.agentId && liking(X1, O3) <= -40 && ft.knows[X1.agentId] === 'staff';
    CT.owner = null; opt('riotOwner', O3, tc, 'protect').run(w, O3); out.owner2.protect = CT.begged === true; CT.owner = null; opt('riotOwner', O3, tc, 'flee').run(w, O3); CT.who = [K1, K2, K3].map(a => ({ id: a.agentId, act: 'gather' })); now += 1; const pop0 = npcs().length; go(); out.owner2.flee = !npcs().includes(O3) && npcs().length === pop0 - 1 && R.st.fled === 1;
    // 被打死
    delete R.cases.kitchen; delete DEALLAW.S(w).closed.kitchen; const fk = cut('kitchen'); const dk = death('kitchen', fk, '老周', [K1, K2, K3]); dk.rx = 1; const CK = RIOT.caseFor(w, 'kitchen', dk); CK.dead.push({ id: dk.id, name: dk.name, d: now, kin: dk.kin }); CK.fid = fk.id; CK.linkedD = now - 1; CK.stage = 'riot'; CK.day = now - 1; CK.who = [K1, K2, K3].map(a => ({ id: a.agentId, act: 'beat' })); delete w.civic.jail[O1.agentId]; bal(O1, 100); const pop1 = npcs().length; let lkK = 0; fix(0, () => { lkK = leak(() => RIOT.resolve(w, CK)); });
    out.killed = { dead: CK.killed === true && !npcs().includes(O1) && npcs().length === pop1 - 1, st: R.st.killed === 1, leak: lkK };
    // 畫面資料、存讀檔
    const rv = RIOT.view(w); out.view = { hist: rv.hist.length, log: rv.hist.map(h => h.shop + '｜' + h.out + '：' + h.log.map(l => l.text).join('／')).join(' ‖ '), cur: rv.cur.length, cats: TREASURY.catOf('in', t('店面修理')) };
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { riot: (w2.riot?.hist || []).length === R.hist.length }; w2.reset(); out.save.reset = !w2.riot;
    out.texts = [out.doc.facts, out.act.facts, out.act.factsHurt, out.owner.facts, out.funeral.facts, out.guard.facts, out.mayor.facts, out.view.log].join(' ‖ ');
    w._absDay = _abs; DECIDE.drain = _dr;
    return out;
  });
  ok(r.kin.close && r.kin.notSelf, '死者的家人與最親近的朋友算在一起', r.kin);
  ok(r.one.made && r.one.noAsk && r.one.still && r.one.over, '只有一個人死、沒人知道原因：不會鬧，30 天後就過去了', r.one);
  ok(r.doc.asked && r.doc.ids === 'quiet,family,paper' && r.doc.notDoc && r.doc.friend && r.doc.paper && r.doc.quiet, '醫生看得出死因，自己決定：不說／告訴家屬／不具名告訴報社；跟東家有交情就比較不會說', r.doc);
  ok(r.link.stage && r.link.hate && r.link.knows && r.link.shock && r.link.marked && r.link.mem, '醫生告訴家屬：死因連到店，家屬對東家的好感大降，接上災後反應', r.link);
  ok(r.link.owner && r.link.asked && r.link.day, '連上之後問東家、家屬、在這家出過事的人；沒有葬禮就隔天到場', r.link);
  ok(r.paths.paper && r.paths.kin && r.paths.notYet && r.paths.pattern, '另外三條路：報上登出來、家屬本來就知道這家店有問題、同一家接連出事（不是一定會起疑）', r.paths);
  ok(r.funeral.day, '有還沒辦的葬禮：等到出殯那天，隊伍直接走過去', r.funeral);
  ok(r.act.kin === 'mourn,gather,smash,beat,pay,trial' && r.act.hurt === 'mourn,gather,trial,calm' && r.act.notAsked, '家屬：守靈／到店門口／砸店／算帳／要賠命錢／提案審判；只是出過事的人不會砸店打人，可以勸大家冷靜', r.act);
  ok(r.act.kinMore && r.act.hot && r.act.soft && r.act.joined && r.act.calm && r.act.trial, '家屬比別人更會去；脾氣衝的比較會砸、心軟的比較不會；說了要去就算一個', r.act);
  ok(r.owner.ids === 'hide,sorry,flee,hire,blame,protect' && r.owner.notOwner && r.owner.soft && r.owner.hard && r.owner.donor, '東家：躲／道歉賠錢／逃／雇人守店／怪夥計／找首長；心軟的比較會道歉，給過首長錢的比較會去求保護', r.owner);
  ok(r.sorry.owner && r.sorry.paid && r.sorry.leak === 0 && r.sorry.fixed && r.sorry.less && r.sorry.once && r.sorry.st, '道歉賠錢：每位家屬拿到 40（錢一分不差）、做法改回來、大家比較不會去鬧', r.sorry);
  ok(r.sorry.claim && r.sorry.quiet, '東家賠了錢，到場的人不夠：沒有鬧起來', r.sorry);
  ok(r.wait && r.riot.on && r.riot.go && r.riot.guard && r.riot.mayor, '出殯那天人到齊：真的走到店門口，衛兵隊長與首長各自要決定', [r.wait, r.riot]);
  ok(r.guard.ids === 'block,aside' && r.guard.notGuard && r.guard.kin, '衛兵隊長：擋在門口／站到一邊；人群裡有親友就比較不想擋，還可能加入', r.guard);
  ok(r.mayor.ids === 'hide,arrest,suppress,calm' && r.mayor.notMayor && r.mayor.donor, '首長：躲／當場抓人／叫衛兵鎮壓／出面安撫；收過東家錢的比較不會抓人、比較會鎮壓', r.mayor);
  ok(r.wreck.out && r.wreck.closed && r.wreck.repair && r.wreck.loot && r.wreck.owner && r.wreck.beaten && r.wreck.st && r.wreck.hist, '沒人擋：店被砸、要修理 7 天、修理費付給木匠、錢櫃的錢到搶的人手上、東家被打傷', r.wreck);
  ok(r.wreck.leak === 0, '砸店那天全鎮的錢一分不差', r.wreck.leak);
  ok(r.wreck.angry && r.wreck.lawGap, '首長躲著：家屬的氣轉到首長身上；出過人命之後可以馬上提品質檢查', r.wreck);
  ok(r.res.none === 'wrecked' && r.res.block === 'held' && r.res.arrest === 'held' && r.res.sorry === 'held' && r.res.hired === 'held' && r.res.calm === 'held' && r.res.peace === 'held' && r.res.join === 'wrecked', '衛兵擋住、首長抓人、東家道歉、雇人守店、有人勸住：都擋得下來；衛兵站到人群裡就擋不住', r.res);
  ok(r.arrest.jail && r.arrest.trial && r.arrest.liked && r.arrest.mayor && r.arrest.once && r.arrest.st && r.arrest.held, '首長當場抓人：東家被關三天、交付審判，人群散了', r.arrest);
  ok(r.calm, '首長出面安撫：答應立規定，而且真的提了', r.calm);
  ok(r.owner2.hire && r.owner2.blame && r.owner2.protect && r.owner2.flee, '東家雇人守店（錢真的付出去）、怪到夥計頭上（夥計記恨）、求首長保護、連夜逃走（真的離開）', r.owner2);
  ok(r.killed.dead && r.killed.st && r.killed.leak === 0, '找東家算帳的人夠多又沒人擋：東家可能被打死', r.killed);
  ok(r.view.hist >= 8 && r.view.cats === 'fee' && r.save.riot && r.save.reset, '畫面資料齊全；存讀檔後還在，開新鎮清掉', [r.view.hist, r.view.cats, r.save]);
  ok(zh ? !/\{[a-z]+\}/.test(r.texts) && /老周/.test(r.texts) : !/[一-鿿]/.test(r.texts) && !/\{[a-z]+\}/.test(r.texts) && /Old Zhou/.test(r.texts), '題目與紀錄沒有漏翻、沒有沒填的空格', (zh ? r.texts.match(/\{[a-z]+\}/g) : r.texts.match(/[一-鿿]+|\{[a-z]+\}/g)) || r.texts.slice(0, 300));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
