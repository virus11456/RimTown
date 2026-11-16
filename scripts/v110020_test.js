// v11.0.0 市場與第四權（第一段）之三：三條管店家的規定、審判、管店家的公職
//   1) 沒開智能體時什麼情況會有人提：漲了三成以上滿七天、一個月三人出事、兩家講好的事傳開
//   2) 三條規定：投票理由（東家反對、手頭緊的贊成）、城鎮以上算大事、通過後登記成可廢除的規定
//   3) 規定怎麼影響東家：違反上限的選項有標示且比較不會選；有上限時比較想偷工；有抽查時比較不敢偷工；禁止講好時比較不敢找同行
//   4) 審判：退錢、交出一半不當所得、出人命多罰並勒令歇業 14 天由公所代管；錢一分不差
//   5) 公職：城鎮才有、首長提名（能幹的／朋友／金主）、議會同意、津貼算進公庫固定支出、任期跟著首長
//   6) 每週查誰、查到之後：照罰／收錢／警告／壓著／往上報；沒有官員時首長自己決定
//   7) 告發沒有下文：算了／跟報社說／到處講；記者查到官員收錢；上報後首長撤不撤
//   8) 畫面資料、存讀檔、中英
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
    WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); DEALASK.S(w); PRESS.S(w); const PW = POWER.S(w); const MM = MONEY.S(w); const sp = w.stockpile; const P = w.proposals;
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const r2 = (x) => Math.round(x * 100) / 100; const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
    const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; fn(); return Math.round(((MONEY.total(w) - T0) - (MM.pend - P0)) * 1000) / 1000; };
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const like = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const MY = w.election.currentMayor(w); const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a !== MY);
    const [O1, O2, O3, OFF, FR, DN, J, C1, C2, C3, S1, X1] = adults; const cast = [O1, O2, O3, OFF, FR, DN, J, C1, C2, C3, S1, X1, MY];
    for (const a of cast) { traits(a, []); bal(a, 200); for (const b of cast) if (a !== b) like(a, b, 0); }
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; M.price = {}; M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; O1.job = new Job('trader'); O2.job = new Job('trader'); O3.job = new Job('trader');
    for (const a of npcs()) if (a.job?.key === 'cook' || a.job?.key === 'tailor') a.job = new Job('farmer'); S1.job = new Job('cook'); for (const a of [OFF, FR, DN, J, C1, C2, C3, X1]) a.job = new Job('farmer');
    const rivalOn = () => { M.rival.kitchen = { fid: 'RV1', owner: O2.agentId, since: w._absDay() - 30, price: 1, pay: 1, emp: {}, rev: 0, cost: 0, hist: [], loss: 0 }; };
    const P1 = { id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, owner: null, journo: J.agentId, stories: [], fame: 0 }; I18N.registerName('鎮報', 'Town Paper'); w.press.papers = [P1]; w.press.reads = {}; for (const a of [C1, C2, C3, S1, X1, FR]) w.press.reads[a.agentId] = 'P1'; PW.inf = {}; PW.scandal = PW.scandal || {};
    w.deallaw = null; w.office = null; w.tips = null; D.reports = []; D.tips = []; D.harm = []; const L = DEALLAW.S(w); const T = TIPS.S(w);
    const K = DECIDE.KINDS; const ids = (k, a, c) => K[k].options(w, a, c).map(o => o.id); const opt = (k, a, c, id) => K[k].options(w, a, c).find(o => o.id === id); const q = () => DECIDE.S(w).q; const qGet = (kind, a) => q().find(x => x.kind === kind && x.a === a.agentId); const qClear = () => { q().length = 0; };
    const vt = (p, a) => { delete p.votes[a.agentId]; P._ruleVote(w, p, a); return { v: p.votes[a.agentId], why: p.why?.[a.agentId] }; };
    const passIt = (p) => { P._decide(w, p, 'approve', 'mayor'); if (p.status === 'approved') P._execute(w, p, w._absDay()); return p.status; };
    const openOf = (kind) => (P.items || []).find(p => p.kind === kind && p.status === 'open');
    const _abs = w._absDay.bind(w); const d0 = _abs(); const _dr = DECIDE.drain; const lv0 = TIERS.S(w).lv; const setLv = (v) => { TIERS.S(w).lv = v; if (w.tierState) w.tierState.lv = v; };
    setLv(1); sp.resources.silver = 5000;

    // 0) 還沒有規定時，東家各個選項的傾向（之後拿來比）
    rivalOn(); const base0 = { up: opt('dealRun', O1, null, 'up:0.3').base, up1: opt('dealRun', O1, null, 'up:0.1').base, cut: opt('dealRun', O1, null, 'cut:1').base, pact: opt('dealRun', O1, null, 'pact').base, text: K.dealRun.options(w, O1, null).map(o => (typeof o.text === 'string' ? t(o.text) : Memory.render(o.text.k, o.text.p))).join('｜'), facts: K.dealRun.facts(w, O1, null) };

    const ppA = DEALLAW.promptParts(w); const pai = DEALLAW.fromAI(w, C1, { effects: [{ type: 'deal', key: 'deal_check' }] }); out.ai = { ctx: ppA.ctx + ppA.fx, all: ['deal_cap', 'deal_check', 'deal_cartel'].every(k => ppA.ctx.includes(k)), made: pai?.kind === 'deal_check' && pai.proposerId === C1.agentId }; if (pai) pai.status = 'rejected'; L.last = {};
    // 1) 沒開智能體：什麼情況會有人提
    const dd = d0 + ((1 - d0 % 3) + 3) % 3; w._absDay = () => dd; const d = dd;
    DEAL.setUp(w, 'textile', 0.3); const fh = DEAL.liveFact(w, 'textile', 'hike'); fh.d = d - 8; D.seen[C1.agentId + '|textile'] = DEAL.F(w, 'textile').v; bal(C1, 12);
    for (const a of [C1, C2, C3]) D.harm.push({ id: a.agentId, name: a.name, key: 'kitchen', kind: 'meal', d, sev: 1 });
    const fp = DEAL.fact(w, { kind: 'pact', key: 'kitchen', k: 'kitchen', by: O1.agentId, with: O2.agentId, lv: 0.2, end: d }); DEAL.learn(w, fp, O2, 'party'); DEAL.learn(w, fp, C2, 'heard'); DEAL.learn(w, fp, C3, 'heard');
    out.rule = { none: !openOf('deal_cap') }; L.lastDay = null; DEALLAW.daily(w); const pc = openOf('deal_cap'); L.lastDay = null; DEALLAW.daily(w); const pq = openOf('deal_check'); L.lastDay = null; DEALLAW.daily(w); const pk = openOf('deal_cartel'); L.lastDay = null; DEALLAW.daily(w);
    out.rule.cap = !!pc && pc.proposerId === C1.agentId; out.rule.check = !!pq && pq.proposerId === C1.agentId; out.rule.cartel = !!pk && pk.proposerId === C2.agentId; out.rule.once = (P.items || []).filter(p => DEALLAW.LAWS.includes(p.kind) && p.status === 'open').length === 3;
    out.rule.text = [pc, pq, pk].filter(Boolean).map(p => P.title(p) + '：' + P._fill(p.dk, p.dp)).join(' ‖ '); out.rule.again = DEALLAW.propose(w, 'deal_cap', C2, '') === null;
    w.fullAgentMode = true; L.lastDay = null; const n0 = (P.items || []).length; DEALLAW.daily(w); out.rule.agentOff = (P.items || []).length === n0; w.fullAgentMode = false;

    // 2) 投票、大事、通過
    bal(C2, 10); bal(C3, 200); traits(C3, ['kind']);
    out.vote = { boss: vt(pc, O1), poor: vt(pc, C2), mine: vt(pc, C1), hurt: vt(pq, C3), fair: fix(0, () => vt(pk, X1)), free: fix(0.99, () => vt(pk, X1)), major: ASSEMBLY.isMajor(w, pc) && ASSEMBLY.isMajor(w, pq) && ASSEMBLY.isMajor(w, pk) };
    PW.inf[MY.agentId] = { [O1.agentId]: 40 }; out.sway = { law: DEALLAW.sway(w, MY, pc), other: DEALLAW.sway(w, MY, { kind: 'build' }), none: DEALLAW.sway(w, C1, pc) }; delete PW.inf[MY.agentId];
    const cutNone = base0.cut; out.cap = { st: passIt(pc), on: DEALLAW.lawOn(w, 'deal_cap'), live: REPEAL.view(w).live.some(x => x.id === 'deal_cap'), noRe: !DEALLAW.okNow(w, 'deal_cap') };
    const up3 = opt('dealRun', O1, null, 'up:0.3'); out.cap.lower = up3.base < base0.up; out.cap.same = near(opt('dealRun', O1, null, 'up:0.1').base, base0.up1, 1e-6); out.cap.mark = Memory.render(up3.text.k, up3.text.p); out.cap.cutMore = opt('dealRun', O1, null, 'cut:1').base > cutNone; const cutCap = opt('dealRun', O1, null, 'cut:1').base;
    out.cap.facts = K.dealRun.facts(w, O1, null); DEAL.setUp(w, 'kitchen', 0.3); out.cap.ill = DEALLAW.illegal(w, 'kitchen').hike; DEAL.setUp(w, 'kitchen', 0.1); out.cap.legal = !DEALLAW.illegal(w, 'kitchen').hike; DEAL.setUp(w, 'kitchen', 0);
    // 智能體發想提案：題目裡看得到還沒有的規定；提得出來
    out.ai.left = DEALLAW.promptParts(w).ctx === ''; out.ai.bad = DEALLAW.fromAI(w, C1, { effects: [{ type: 'deal', key: 'nope' }] }) === null; out.ai.dup = DEALLAW.fromAI(w, C1, { effects: [{ type: 'deal', key: 'deal_check' }] }) === null;
    out.check = { st: passIt(pq), on: DEALLAW.lawOn(w, 'deal_check'), cutLess: opt('dealRun', O1, null, 'cut:1').base < cutCap };
    out.cartel = { st: passIt(pk), on: DEALLAW.lawOn(w, 'deal_cartel'), pactLess: opt('dealRun', O1, null, 'pact').base < base0.pact };
    const rp0 = D.reports.length; opt('dealPact', O2, { key: 'kitchen', by: O1.agentId }, 'tell').run(w, O2); const fa = D.facts.find(f => f.attempt && f.by === O1.agentId && f.leniency); out.cartel.leniency = fa?.leniency === O2.agentId && D.reports.length === rp0 + 1 && D.reports[D.reports.length - 1].by === O2.agentId;
    out.lawView = DEALLAW.view(w).laws.map(x => x.name + (x.on ? '✓' : '')).join('｜'); D.reports.length = 0; D.tips.length = 0; T.box.length = 0;

    // 5) 公職：城鎮才有；首長提名；議會同意
    setLv(0); out.office = { village: OFFICE.wanted(w).length === 0 }; setLv(2); out.office.city = OFFICE.wanted(w).join() === 'market,tax,health' && OFFICE.full(w); const payFull = OFFICE.stipend(w); setLv(1); out.office.town = OFFICE.wanted(w).join() === 'market,tax' && !OFFICE.full(w); out.office.pay = OFFICE.stipend(w) < payFull;
    DECIDE.drain = () => {}; qClear(); w.office = null; const O = OFFICE.S(w); O.lastDay = null; OFFICE.daily(w); out.office.ask = q().filter(x => x.kind === 'officeNominate' && x.a === MY.agentId).map(x => x.ctx.post).join(); O.lastDay = null; qClear(); OFFICE.daily(w); out.office.gap = !qGet('officeNominate', MY);
    for (const a of npcs()) if (a !== MY) like(MY, a, 0); if (w.council?.members) w.council.members = w.council.members.filter(id => id !== OFF.agentId);
    traits(OFF, ['perfectionist', 'kind']); like(MY, FR, 60); PW.inf[MY.agentId] = { [DN.agentId]: 50 }; const cs = OFFICE.candidates(w, MY, 'market'); out.nom = { tags: cs.map(x => x.tag).join(), friend: cs.some(x => x.tag === 'friend' && x.a === FR), donor: cs.some(x => x.tag === 'donor' && x.a === DN), ids: ids('officeNominate', MY, { post: 'market' }).map(x => x.split(':')[0]).join(), notMayor: K.officeNominate.options(w, C1, { post: 'market' }).length === 0, facts: K.officeNominate.facts(w, MY, { post: 'market' }) };
    const bd0 = opt('officeNominate', MY, { post: 'market' }, 'pick:' + DN.agentId).base; traits(MY, ['greedy']); out.nom.greedy = opt('officeNominate', MY, { post: 'market' }, 'pick:' + DN.agentId).base > bd0; traits(MY, []);
    const pa = OFFICE.nominate(w, MY, 'market', OFF); out.nom.made = !!pa && pa.kind === 'office_appoint' && pa.post === 'market' && pa.cand === OFF.agentId; out.nom.major = ASSEMBLY.isMajor(w, pa); out.nom.noDouble = !OFFICE.candidates(w, MY, 'tax').some(x => x.a === OFF); out.nom.text = P.title(pa) + '：' + P._fill(pa.dk, pa.dp);
    like(C1, OFF, 50); like(C2, OFF, -40); out.nom.votes = { mine: vt(pa, MY), me: vt(pa, OFF), like: vt(pa, C1), dis: vt(pa, C2) };
    const po = OFFICE.nominate(w, MY, 'tax', DN); out.nom.sway = OFFICE.sway(w, MY, po) > 0 && OFFICE.sway(w, MY, pa) === 0 && OFFICE.sway(w, MY, pc) === null; const pconf = { kind: 'office_appoint', post: 'market', cand: O3.agentId, proposerId: MY.agentId, votes: {}, why: {} }; out.nom.conflict = fix(0, () => OFFICE.vote(w, pconf, X1)).why === 'office_conflict'; po.status = 'rejected';
    const pay0 = TREASURY.payroll(w); out.seat = { st: passIt(pa), holder: OFFICE.holder(w, 'market') === OFF, post: OFFICE.postOf(w, OFF), badge: TIERS.badge(w, OFF)?.cls === 'official', badgeText: TIERS.badge(w, OFF)?.text || '', payroll: near(TREASURY.payroll(w) - pay0, OFFICE.stipend(w)), mem: (OFF.memory?.entries || []).some(m => /市場管理員|Market Warden/.test(m.content || '')) };
    const b0 = bal(OFF), s0 = sp.get('silver'); O.lastDay = null; qClear(); const lkPay = leak(() => OFFICE.daily(w)); out.seat.paid = near(bal(OFF) - b0, OFFICE.stipend(w)) && near(s0 - sp.get('silver'), OFFICE.stipend(w)) && lkPay === 0;
    sp.resources.silver = 0; O.lastDay = null; OFFICE.daily(w); out.seat.owe = O.posts.market.owe === 1; sp.resources.silver = 5000; qClear();

    // 6) 每週查誰、查到之後
    DEAL.setCut(w, 'textile', 1); const ft = DEAL.liveFact(w, 'textile', 'cut'); DEAL.F(w, 'textile').gain = 40; DEALASK.report(w, C1, ft);
    const tg = OFFICE.targets(w, OFF, 'market'); const tx = tg.find(x => x.key === 'textile'); out.work = { tgt: !!tx && tx.rep === 1 && tx.ill === true, ids: ids('officeWork', OFF, { post: 'market', left: 1 }).join(), notMine: K.officeWork.options(w, C1, { post: 'market', left: 1 }).length === 0, facts: K.officeWork.facts(w, OFF, { post: 'market', left: 1 }) };
    const bw0 = opt('officeWork', OFF, { post: 'market', left: 1 }, 'go:textile').base; like(OFF, O3, 60); out.work.friend = opt('officeWork', OFF, { post: 'market', left: 1 }, 'go:textile').base < bw0; like(OFF, O3, 0);
    DEAL.setUp(w, 'textile', 0); DEAL.setCut(w, 'textile', 0); DEAL.setCut(w, 'textile', 1); const ft2 = DEAL.liveFact(w, 'textile', 'cut'); DEAL.F(w, 'textile').gain = 40; D.reports.length = 0; DEALASK.report(w, C1, ft2);
    const tgt = () => OFFICE.targets(w, OFF, 'market').find(x => x.key === 'textile');
    out.work.miss = fix(0.99, () => OFFICE.inspect(w, OFF, 'market', tgt())) === null && D.reports[0].st === 'checked'; D.reports[0].st = 'new'; qClear();
    const fc1 = fix(0, () => OFFICE.inspect(w, OFF, 'market', tgt())); out.found = { hit: !!fc1 && fc1.what.join() === 'cut' && fc1.n >= 10, asked: !!qGet('officeFound', OFF), ids: ids('officeFound', OFF, fc1).join(), facts: K.officeFound.facts(w, OFF, fc1), notMine: K.officeFound.options(w, C1, fc1).length === 0 };
    traits(OFF, []); const bb0 = opt('officeFound', OFF, fc1, 'bribe').base; traits(OFF, ['greedy']); out.found.greedy = opt('officeFound', OFF, fc1, 'bribe').base > bb0; traits(OFF, ['perfectionist', 'kind']); out.found.honest = opt('officeFound', OFF, fc1, 'bribe').base < bb0; traits(OFF, []);
    // 收錢了事
    const o3a = bal(O3), ofa = bal(OFF); qClear(); const lkB = leak(() => opt('officeFound', OFF, fc1, 'bribe').run(w, OFF)); const fb = D.facts.find(f => f.kind === 'bribe' && f.by === O3.agentId && f.with === OFF.agentId);
    out.graft = { paid: bal(O3) < o3a && near(o3a - bal(O3), bal(OFF) - ofa), leak: lkB, fact: !!fb && fb.knows[OFF.agentId] === 'party', still: DEAL.F(w, 'textile').cut === 1, snub: D.reports[0].st === 'snubbed' && !!qGet('reportSnub', C1), guess: fb?.knows[C1.agentId] === 'guess', text: fb ? Memory.render(DEALASK.factText(w, fb).k, DEALASK.factText(w, fb).p) : '' };
    // 7) 告發沒有下文
    const sc = qGet('reportSnub', C1).ctx; out.snub = { ids: ids('reportSnub', C1, sc).join(), facts: K.reportSnub.facts(w, C1, sc) }; w.press.papers = []; out.snub.noPaper = !ids('reportSnub', C1, sc).includes('paper'); w.press.papers = [P1];
    for (const a of npcs()) if (a !== C1) like(C1, a, 0); like(C1, X1, 50); opt('reportSnub', C1, sc, 'talk').run(w, C1); out.snub.talk = fb.knows[X1.agentId] === 'heard'; opt('reportSnub', C1, sc, 'paper').run(w, C1); const xs = T.box.find(y => y.type === 'shield' && y.cover === fb.id); out.snub.paper = !!xs && xs.about === OFF.agentId && xs.by === C1.agentId; opt('reportSnub', C1, sc, 'paper').run(w, C1); out.snub.once = T.box.filter(y => y.cover === fb.id).length === 1;
    // 記者查證：去問知情的人（當事的東家也問得到），查到是收了錢
    const C = TIPS.start(w, P1, J, xs, false); out.dig = { rumor: TIPS.level(C) === 0, tip: Memory.render(TIPS.tipText(w, xs).k, TIPS.tipText(w, xs).p) }; const tc = { pid: 'P1', tid: xs.id };
    out.dig.ids = ids('tipAsked', O3, tc).join(); out.dig.facts = K.tipAsked.facts(w, O3, tc); out.dig.notTarget = K.tipAsked.options(w, OFF, tc).length === 0; opt('tipAsked', C1, tc, 'talk').run(w, C1); opt('tipAsked', O3, tc, 'anon').run(w, O3); out.dig.witness = TIPS.level(C) === 1;
    T.lastDay = null; qClear(); TIPS.daily(w); out.dig.auto = !qGet('tipAsked', OFF) && Object.keys(C.asked).length >= 1;
    qClear(); const sc0 = PW.scandal[OFF.agentId] || 0; const aff0 = C2.relationships.getOrCreate(OFF.agentId, OFF.name).affinity; fix(0, () => TIPS.print(w, P1, J, C, false));
    out.expose = { pub: !!fb.pub, scandal: (PW.scandal[OFF.agentId] || 0) === sc0 + 1, aff: C2.relationships.getOrCreate(OFF.agentId, OFF.name).affinity < aff0, read: fb.knows[C2.agentId] === 'read', asked: !!qGet('officeScandal', MY), done: TIPS.view(w).done.map(z => z.text + '：' + z.log.map(l => l.text).join('／')).join(' ‖ ') };
    const zc = qGet('officeScandal', MY).ctx; out.scandal = { ids: ids('officeScandal', MY, zc).join(), facts: K.officeScandal.facts(w, MY, zc), paid: zc.paid === true, notMayor: K.officeScandal.options(w, C1, zc).length === 0 };
    const bf0 = opt('officeScandal', MY, zc, 'fire').base; like(MY, OFF, 60); out.scandal.friend = opt('officeScandal', MY, zc, 'fire').base < bf0; like(MY, OFF, 0);
    const am0 = C2.relationships.getOrCreate(MY.agentId, MY.name).affinity; fix(0, () => opt('officeScandal', MY, zc, 'keep').run(w, MY)); out.scandal.keep = OFFICE.holder(w, 'market') === OFF && C2.relationships.getOrCreate(MY.agentId, MY.name).affinity < am0 && O.st.kept === 1;
    // 壓著、往上報、首長擱下、照罰
    D.reports.length = 0; DEALASK.report(w, C2, ft2); qClear(); const fc2 = fix(0, () => OFFICE.inspect(w, OFF, 'market', tgt())); opt('officeFound', OFF, fc2, 'sit').run(w, OFF); const fcv = D.facts.find(f => f.kind === 'cover' && f.by === OFF.agentId && f.with === O3.agentId); out.sit = { fact: !!fcv, snub: !!qGet('reportSnub', C2), st: O.st.sat === 1 };
    qClear(); opt('officeFound', OFF, fc2, 'warn').run(w, OFF); out.warn = O.st.warned === 1 && DEAL.F(w, 'textile').caught === d && (O3.memory?.entries || []).length > 0;
    qClear(); opt('officeFound', OFF, fc2, 'up').run(w, OFF); const hc = qGet('headCase', MY)?.ctx; out.up = { asked: !!hc && !!hc.found, ids: hc ? ids('headCase', MY, hc).join() : '', facts: hc ? K.headCase.facts(w, MY, hc) : '', notMayor: hc ? K.headCase.options(w, C1, hc).length === 0 : false };
    PW.inf[MY.agentId] = { [O3.agentId]: 60 }; const bs1 = opt('headCase', MY, hc, 'shelve').base; delete PW.inf[MY.agentId]; out.up.donor = bs1 > opt('headCase', MY, hc, 'shelve').base; PW.inf[MY.agentId] = { [DN.agentId]: 50 };
    opt('headCase', MY, hc, 'shelve').run(w, MY); const fmv = D.facts.find(f => f.kind === 'cover' && f.by === MY.agentId && f.with === O3.agentId); out.up.shelve = !!fmv && fmv.knows[OFF.agentId] === 'party' && (OFF.memory?.entries || []).some(m => /別管|leave it alone/.test(m.content || ''));
    bal(O3, 200); const s1 = sp.get('silver'), o3b = bal(O3); const lkF = leak(() => opt('officeFound', OFF, fc2, 'fine').run(w, OFF)); out.fine = { paid: near(o3b - bal(O3), fc2.n) && near(sp.get('silver') - s1, fc2.n), leak: lkF, fixed: DEAL.F(w, 'textile').cut === 0, pub: !!ft2.pub, st: O.st.fined >= fc2.n };
    // 上報後首長撤掉
    opt('officeScandal', MY, zc, 'fire').run(w, MY); out.scandal.fire = !OFFICE.holder(w, 'market') && TIERS.badge(w, OFF)?.cls !== 'official' && O.st.fired === 1;
    // 沒有官員管：告發落到首長頭上
    DEAL.setCut(w, 'textile', 1); const ft3 = DEAL.liveFact(w, 'textile', 'cut'); DEAL.F(w, 'textile').gain = 30; D.reports.length = 0; DEALASK.report(w, C3, ft3); O.lastNom = { market: d, tax: d }; O.lastDay = null; qClear(); OFFICE.daily(w); const hc2 = qGet('headCase', MY)?.ctx;
    out.head = { asked: !!hc2 && hc2.fid === ft3.id && hc2.rby === C3.agentId && D.reports[0].st === 'head', ids: hc2 ? ids('headCase', MY, hc2).join() : '', facts: hc2 ? K.headCase.facts(w, MY, hc2) : '' };
    qClear(); opt('headCase', MY, hc2, 'no').run(w, MY); const fno = D.facts.filter(f => f.kind === 'cover' && f.by === MY.agentId).pop(); out.head.no = D.reports[0].st === 'snubbed' && !!qGet('reportSnub', C3) && qGet('reportSnub', C3).ctx.how === 'no' && fno?.knows[C3.agentId] === 'guess'; out.head.snubFacts = K.reportSnub.facts(w, C3, qGet('reportSnub', C3).ctx);
    D.reports.length = 0; DEALASK.report(w, C1, ft3); const hc3 = { fid: ft3.id, rby: C1.agentId }; bal(O3, 200); const s2 = sp.get('silver'); fix(0, () => opt('headCase', MY, hc3, 'look').run(w, MY)); out.head.look = sp.get('silver') > s2 && DEAL.F(w, 'textile').cut === 0 && D.reports[0].st === 'checked';
    // 稅務員；任期跟著首長
    passIt(OFFICE.nominate(w, MY, 'tax', FR)); traits(O1, ['greedy']); const tt = OFFICE.targets(w, FR, 'tax'); const t1 = tt.find(x => x.o === O1); qClear(); const ftx = fix(0, () => OFFICE.inspect(w, FR, 'tax', t1)); traits(O1, []); out.tax = { seat: OFFICE.holder(w, 'tax') === FR, tgt: tt.length >= 2 && !!t1, found: !!ftx && ftx.what.join() === 'tax' && ftx.n >= 8, text: ftx ? K.officeFound.facts(w, FR, ftx) : '' };
    O.mayor = 'someone-else'; O.lastDay = null; qClear(); OFFICE.daily(w); out.tax.term = !OFFICE.holder(w, 'tax') && O.mayor === MY.agentId;

    // 4) 審判
    M.rival = {}; DEAL.setUp(w, 'kitchen', 0); DEAL.setCut(w, 'kitchen', 2); const fk = DEAL.liveFact(w, 'kitchen', 'cut'); fk.harm = 3; fk.dead = 1; DEAL.F(w, 'kitchen').gain = 40; for (const h of D.harm) h.fid = fk.id; for (const a of [C1, C2, C3]) DEAL.learn(w, fk, a, 'victim');
    out.trialOpt = { vic: ids('dealVictim', C1, { fid: fk.id, key: 'kitchen', kind: 'meal' }).includes('trial') };
    const pt = DEALLAW.trial(w, fk, C1); out.trial = { made: !!pt && pt.kind === 'deal_trial' && pt.pen === 'close' && pt.accused === O1.agentId, once: DEALLAW.trial(w, fk, C2) === null, major: ASSEMBLY.isMajor(w, pt), text: P.title(pt) + '：' + P._fill(pt.dk, pt.dp) };
    like(S1, O1, 60); out.trial.votes = { me: vt(pt, O1), hurt: vt(pt, C2), friend: vt(pt, S1), boss: fix(0, () => vt(pt, O3)), mine: vt(pt, C1) }; PW.inf[MY.agentId] = { [O1.agentId]: 40 }; out.trial.sway = DEALLAW.sway(w, MY, pt) < DEALLAW.sway(w, MY, pc); delete PW.inf[MY.agentId];
    for (const a of [C1, C2, C3]) bal(a, 50); bal(O1, 200); const s3 = sp.get('silver'); const lkT = leak(() => { out.trial.st = passIt(pt); });
    out.trial.refund = [C1, C2, C3].every(a => near(bal(a), 60)); out.trial.take = near(sp.get('silver') - s3, 50) && near(bal(O1), 200 - 30 - 50); out.trial.leak = lkT; out.trial.fixed = DEAL.F(w, 'kitchen').cut === 0 && fk.end != null && !!fk.judged; out.trial.closed = DEALLAW.closedNow(w, 'kitchen') && DEALLAW.view(w).closed.length === 1 && DEALLAW.view(w).closed[0].left === DEALLAW.CLOSE_DAYS;
    // 歇業期間：公所代管，照原價賣，錢進公庫；東家不能動價錢
    const run9 = ids('dealRun', O1, null); out.shut = { run: !run9.some(x => /^up:|^cut:|^pact/.test(x)), facts: K.dealRun.facts(w, O1, null) }; const q9 = DEAL.price(w, C1, 'meal', 3); const s4 = sp.get('silver'), o1b = bal(O1); const lkS = leak(() => { WALLET.take(w, C1, q9.p); DEAL.sale(w, C1, 'meal', 3, q9); });
    out.shut.price = q9.p === 3 && q9.key === 'kitchen'; out.shut.toHall = sp.get('silver') > s4 && bal(O1) === o1b; out.shut.leak = lkS; rivalOn(); out.shut.other = DEAL.choose(w, C2, 'kitchen') === 'kitchen#r'; M.rival = {};
    w._absDay = () => dd + DEALLAW.CLOSE_DAYS + 1; L.lastDay = null; DEALLAW.daily(w); out.shut.back = !DEALLAW.closedNow(w, 'kitchen') && DEALLAW.view(w).closed.length === 0; w._absDay = () => dd;
    // 沒出人命的審判：退錢、罰沒，不歇業
    DEAL.setCut(w, 'textile', 1); const fz = DEAL.liveFact(w, 'textile', 'cut'); fz.harm = 1; D.harm.push({ id: X1.agentId, name: X1.name, key: 'textile', kind: 'clothes', d, sev: 1, fid: fz.id }); const pt2 = DEALLAW.trial(w, fz, X1); passIt(pt2); out.trial.light = pt2.pen === 'refund' && !DEALLAW.closedNow(w, 'textile') && DEAL.F(w, 'textile').cut === 0;

    // 8) 畫面資料、存讀檔
    setLv(2); const ov = OFFICE.view(w); const lv = DEALLAW.view(w); out.view = { posts: ov.wanted.map(x => x.icon + x.name + '：' + x.duty).join('｜'), recs: ov.recs.map(x => x.text).join('／'), n: ov.recs.length, laws: lv.laws.length, st: lv.st.trials >= 2 && lv.st.refunds >= 30 && lv.st.taken >= 50 && lv.st.closures === 1, cats: [TREASURY.catOf('out', t('公職津貼')), TREASURY.catOf('in', t('罰款與沒收')), TREASURY.catOf('in', t('代管店面的收入'))].join() };
    setLv(1); passIt(OFFICE.nominate(w, MY, 'market', OFF)); const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { office: w2.office?.posts?.market?.id === OFF.agentId, law: !!w2.deallaw?.cap && !!w2.deallaw?.check && !!w2.deallaw?.cartel }; w2.reset(); out.save.reset = !w2.office && !w2.deallaw;
    out.kinds = ['deal_cap', 'deal_check', 'deal_cartel', 'deal_trial', 'office_appoint'].map(k => PROPOSAL_KINDS[k]?.icon + t(PROPOSAL_KINDS[k]?.label || '')).join('｜'); out.whys = Object.keys(VOTE_WHY).filter(k => /^deal_|^office_/.test(k)).map(k => t(VOTE_WHY[k])).join('｜');
    out.texts = [base0.facts, out.rule.text, out.cap.facts, out.cap.mark, out.ai.ctx, out.lawView, out.nom.facts, out.nom.text, out.seat.badgeText, out.work.facts, out.found.facts, out.graft.text, out.snub.facts, out.dig.tip, out.dig.facts, out.expose.done, out.scandal.facts, out.up.facts, out.head.facts, out.head.snubFacts, out.tax.text, out.trial.text, out.shut.facts, out.view.posts, out.view.recs, out.kinds, out.whys].join(' ‖ ');
    w._absDay = _abs; DECIDE.drain = _dr; setLv(lv0);
    return out;
  });
  ok(r.rule.none && r.rule.cap && r.rule.check && r.rule.cartel && r.rule.once && r.rule.again, '沒開智能體：漲三成滿七天有人提價格上限、一個月三人出事有人提品質檢查、講好的事傳開有人提禁止；同一條不會重複提', r.rule);
  ok(r.rule.agentOff, '開了完整智能體：規則不自動成案，交給村民自己提', r.rule.agentOff);
  ok(r.vote.boss.v === 'against' && r.vote.boss.why === 'deal_boss' && r.vote.poor.v === 'for' && r.vote.poor.why === 'deal_poor' && r.vote.mine.why === 'deal_mine' && r.vote.hurt.why === 'deal_hurt' && r.vote.fair.v === 'for' && r.vote.free.v === 'against', '投票：東家反對、手頭緊的贊成上限、出過事的贊成檢查、其他人看個性', r.vote);
  ok(r.vote.major && r.sway.law < 0 && r.sway.other === null && r.sway.none === 0, '城鎮以上算大事要過議會；收過東家錢的官員審這類案子偏向東家', [r.vote.major, r.sway]);
  ok(r.cap.st === 'approved' || r.cap.on, '價格上限通過', r.cap.st); ok(r.cap.on && r.cap.live && r.cap.noRe, '通過後登記成鎮上的規定，可以再表決廢除；不會重複立', r.cap);
  ok(r.cap.lower && r.cap.same && (zh ? /違反價格上限/.test(r.cap.mark) : /breaks the price cap/.test(r.cap.mark)) && r.cap.ill && r.cap.legal, '有上限以後：超過的選項有標示而且比較不會選，上限以內的不受影響；漲三成算違法、一成不算', r.cap);
  ok(r.cap.cutMore && r.check.on && r.check.cutLess, '有上限時比較想靠偷工補回來；有抽查以後比較不敢偷工', [r.cap.cutMore, r.check]);
  ok(r.cartel.on && r.cartel.pactLess && r.cartel.leniency, '禁止講好以後：比較不敢找同行；被找上的人說出去等於告發，而且自己不罰', r.cartel);
  ok(r.ai.all && r.ai.made && r.ai.left && r.ai.bad && r.ai.dup, '智能體發想提案：題目列出還沒有的規定、提得出來；已經有或在表決的不再列；亂填的代碼不成案', r.ai);
  ok(r.office.village && r.office.town && r.office.city && r.office.pay, '村莊沒有管店家的官；城鎮有市場管理員與稅務員（兼任）；城市多一位衛生稽查員（專任、津貼較高）', r.office);
  ok(r.office.ask === 'market,tax' && r.office.gap, '有缺就問首長要提名誰；同一個缺十天內不重問', r.office);
  ok(r.nom.friend && r.nom.donor && /able/.test(r.nom.tags) && r.nom.ids.startsWith('none,pick') && r.nom.notMayor && r.nom.greedy, '首長的人選：做事認真的、自己的朋友、給過他錢的；貪心的首長比較會提金主', r.nom);
  ok(r.nom.made && r.nom.major && r.nom.votes.mine.why === 'office_mine' && r.nom.votes.me.why === 'office_me' && r.nom.votes.like.v === 'for' && r.nom.votes.dis.v === 'against' && r.nom.sway && r.nom.conflict && r.nom.noDouble, '提名開成提案、算大事；正在表決的人不會同時被提去別的職位；投票看跟被提名人的交情；金主被提名時收過錢的人偏向他；自己開店的人來管店有人反對', r.nom);
  ok(r.seat.holder && r.seat.post === 'market' && r.seat.badge && r.seat.payroll && r.seat.mem, '通過就上任：掛上官職、津貼算進公庫的固定支出', r.seat);
  ok(r.seat.paid && r.seat.owe, '每天從公庫發津貼（錢一分不差）；公庫沒錢就記欠', r.seat);
  ok(r.work.tgt && r.work.ids.startsWith('skip,go:textile') && r.work.notMine && r.work.friend, '每週查誰：有人告發的、價錢超過上限的排前面；可以不查；是朋友就比較不想查', r.work);
  ok(r.work.miss && r.found.hit && r.found.asked, '去查不一定查得到；查到了由他自己決定怎麼辦', [r.work.miss, r.found]);
  ok(r.found.ids === 'fine,bribe,warn,sit,up' && r.found.notMine && r.found.greedy && r.found.honest, '查到之後：照罰／暗示花錢了事／私下警告／壓著／交給首長；貪心的比較會收、老實的幾乎不收', r.found);
  ok(r.graft.paid && r.graft.leak === 0 && r.graft.fact && r.graft.still && r.graft.snub && r.graft.guess, '收錢了事：錢真的過手、店照舊偷工、記成一件有人知道的事；告發的人發現沒有下文', r.graft);
  ok(r.snub.ids === 'drop,paper,talk' && r.snub.noPaper && r.snub.talk && r.snub.paper && r.snub.once, '告發沒有下文：算了／跟報社說（沒有報社就沒這條路）／到處講', r.snub);
  ok(r.dig.rumor && r.dig.ids === 'no,talk,anon,money' && r.dig.notTarget && r.dig.witness && r.dig.auto, '記者查官員：一開始只有傳聞；告發的人與塞錢的東家都問得到，被查的官員不會被當成證人', r.dig);
  ok(r.expose.pub && r.expose.scandal && r.expose.aff && r.expose.read && r.expose.asked && r.scandal.paid, '查到是收了錢才不辦：登出來，讀者對他印象變差、多一筆醜聞；提名他的首長要決定留不留', r.expose);
  ok(r.scandal.ids === 'fire,keep' && r.scandal.notMayor && r.scandal.friend && r.scandal.keep && r.scandal.fire, '首長可以留任（讀者不以為然）或撤掉；是朋友就比較不想撤', r.scandal);
  ok(r.sit.fact && r.sit.snub && r.sit.st && r.warn, '壓著不辦也記成一件事、告發的人一樣會發現；私下警告不罰', [r.sit, r.warn]);
  ok(r.up.asked && r.up.ids === 'fine,shelve,trial' && r.up.notMayor && r.up.donor && r.up.shelve, '往上報：首長可以照罰、擱下（收過這位東家的錢就比較會擱）、交付審判；擱下的事報上去的官員知道', r.up);
  ok(r.fine.paid && r.fine.leak === 0 && r.fine.fixed && r.fine.pub && r.fine.st, '照規定罰：罰款進公庫（錢一分不差）、偷工的做法改回來、公告', r.fine);
  ok(r.head.asked && r.head.ids === 'look,no' && r.head.no && r.head.look, '沒有官員管的告發落到首長頭上：親自去查，或說沒有證據不查（告發的人會記得）', r.head);
  ok(r.tax.seat && r.tax.tgt && r.tax.found && r.tax.term, '稅務員查東家的帳；首長換人，官員全部卸任', r.tax);
  ok(r.trialOpt.vic && r.trial.made && r.trial.once && r.trial.major, '出事的人可以提案審判；出過人命的求處歇業；同一件事只審一次', [r.trialOpt, r.trial]);
  ok(r.trial.votes.me.why === 'deal_me' && r.trial.votes.hurt.why === 'deal_hurt' && r.trial.votes.friend.why === 'deal_friend' && r.trial.votes.boss.why === 'deal_boss' && r.trial.sway, '審判的投票：被審的反對、出過事的贊成、朋友不信、同是東家的多半反對；收過他錢的官員更偏向他', r.trial.votes);
  ok(r.trial.refund && r.trial.take && r.trial.leak === 0 && r.trial.fixed && r.trial.closed, '審判通過：每位出事的人退 10、交出一半不當所得加人命罰款進公庫（錢一分不差）、做法改回來、勒令歇業 14 天', r.trial);
  ok(r.shut.run && r.shut.price && r.shut.toHall && r.shut.leak === 0 && r.shut.other && r.shut.back, '歇業期間由公所代管：照原價賣、錢進公庫、東家不能動價錢；有對手店時客人去對手店；期滿交還', r.shut);
  ok(r.trial.light, '沒出人命的審判：退錢、罰沒、改回來，不歇業', r.trial.light);
  ok(r.view.n >= 6 && r.view.laws === 3 && r.view.st && r.view.cats === 'pay,fine,rent', '畫面資料齊全；公庫帳本認得津貼、罰款、代管收入', r.view);
  ok(r.save.office && r.save.law && r.save.reset, '存讀檔後官員與規定都還在，開新鎮清掉', r.save);
  ok(zh ? !/\{[a-z]+\}/.test(r.texts) && /市場管理員/.test(r.texts) : !/[一-鿿]/.test(r.texts) && !/\{[a-z]+\}/.test(r.texts), '題目與紀錄沒有漏翻、沒有沒填的空格', (zh ? r.texts.match(/\{[a-z]+\}/g) : r.texts.match(/[一-鿿]+|\{[a-z]+\}/g)) || r.texts.slice(0, 300));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
