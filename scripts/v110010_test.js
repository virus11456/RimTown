// v11.0.0 市場與第四權（第一段）之二：線索箱、記者自己選題、查證、被查的人怎麼反應、登不登、讀者信不信
//   1) 線索進箱：有人爆料（重複的併成一條）、記者自己看到的大幅漲價；只有公告欄的小地方沒有這條路
//   2) 記者選題：選項、跟當事人有交情或報社老闆有往來就比較不想查；選了就立案
//   3) 查證：每天去問最多兩位知情的人，對方自己決定說不說；員工具名一次是人證，再一位不具名就是鐵證
//   4) 查了兩天，被查的人聽到風聲：道歉、悄悄改、塞錢、找老闆、找首長、放話要告
//   5) 塞錢：記者收／不收／寫進報導；找老闆壓稿；找首長出面（這件事本身變成新線索）
//   6) 登不登：照登（讀者信不信、之後怎麼辦、報社信譽）、淡化、撤稿、轉給別家；不顧老闆照登會被開除
//   7) 首長護航被登出來；畫面資料、存讀檔、中英
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
    WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); DEALASK.S(w); PRESS.S(w); const PW = POWER.S(w);
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const MY = w.election.currentMayor(w); const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a !== MY);
    const [O1, O3, J, J2, PO, S1, S2, C1, C2, C3] = adults; for (const a of [O1, O3, J, J2, PO, S1, S2, C1, C2, C3, MY]) { traits(a, []); bal(a, 200); }
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; O1.job = new Job('trader'); O3.job = new Job('trader');
    for (const a of npcs()) if (a.job?.key === 'cook') a.job = new Job('farmer'); S1.job = new Job('cook'); S2.job = new Job('cook'); for (const a of [J, J2, PO, C1, C2, C3]) a.job = new Job('farmer');
    // 只有公告欄的小地方
    w.press.papers = [{ id: 'P0', st: 'board', name: ['公告欄', 'Notice Board'], cred: 55, owner: null, journo: null, stories: [], fame: 0 }]; w.press.reads = {}; w.press.n = 0; PW.inf = {}; w.tips = null;
    DEAL.setUp(w, 'textile', 0.2); const fh0 = DEAL.liveFact(w, 'textile', 'hike'); out.board = { on: TIPS.on(w), papers: TIPS.papers(w).length, noTip: !DECIDE.KINDS.dealCust.options(w, C1, { key: 'textile', fid: fh0.id }).some(o => o.id === 'tip') }; DEAL.setUp(w, 'textile', 0);
    const P1 = { id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, owner: null, journo: J.agentId, stories: [], fame: 0 }, P2 = { id: 'P2', st: 'gossip', name: ['小報', 'Tattler'], cred: 40, owner: null, journo: J2.agentId, stories: [], fame: 0 };
    I18N.registerName('鎮報', 'Town Paper'); I18N.registerName('小報', 'Tattler'); w.press.papers = [P1, P2]; for (const a of [C1, C2, C3, S1]) w.press.reads[a.agentId] = 'P1';
    const T = TIPS.S(w); const d = w._absDay(); const K = DECIDE.KINDS; const ids = (k, a, c) => K[k].options(w, a, c).map(o => o.id); const opt = (k, a, c, id) => K[k].options(w, a, c).find(o => o.id === id); const q = () => DECIDE.S(w).q; const qGet = (kind, a) => q().find(x => x.kind === kind && x.a === a.agentId);

    // 1) 線索進箱
    DEAL.setCut(w, 'kitchen', 1); const f = DEAL.liveFact(w, 'kitchen', 'cut'); f.harm = 3; DEAL.learn(w, f, C1, 'victim'); D.harm.push({ id: C1.agentId, name: C1.name, key: 'kitchen', kind: 'meal', d, sev: 1, fid: f.id });
    DEALASK.tip(w, S1, f, true); TIPS.gather(w, T, d); const x = T.box.find(y => y.fid === f.id); DEALASK.tip(w, C1, f, false); TIPS.gather(w, T, d);
    DEAL.setUp(w, 'textile', 0.3); const fh = DEAL.liveFact(w, 'textile', 'hike'); TIPS.gather(w, T, d); const xh = T.box.find(y => y.fid === fh.id);
    out.box = { on: TIPS.on(w), anon: x?.src === 'anon', one: T.box.filter(y => y.fid === f.id).length === 1, more: x.more === 1, self: xh?.src === 'self' && xh.by === J.agentId, text: TIPS.view(w).box.map(y => y.text + '｜' + y.src).join(' ‖ ') };

    // 2) 記者選題
    const pc = { pid: 'P1', ids: [x.id, xh.id] }; out.pick = { ids: ids('tipPick', J, pc).join(), facts: K.tipPick.facts(w, J, pc), notMine: K.tipPick.options(w, J2, pc).length === 0 };
    const b0 = opt('tipPick', J, pc, 'go:' + x.id).base; J.relationships.getOrCreate(O1.agentId, O1.name).affinity = 60; const bFriend = opt('tipPick', J, pc, 'go:' + x.id).base; J.relationships.getOrCreate(O1.agentId, O1.name).affinity = 0;
    P1.owner = PO.agentId; PW.inf[PO.agentId] = { [O1.agentId]: 30 }; const bCap = opt('tipPick', J, pc, 'go:' + x.id).base; out.pick.cap = /往來|dealings/.test(K.tipPick.facts(w, J, pc)); PW.inf = {}; P1.owner = null;
    traits(J, ['gossip']); out.pick.rush = ids('tipPick', J, pc).includes('rush:' + x.id); traits(J, []);
    out.pick.lean = bFriend < b0 && bCap < b0; opt('tipPick', J, pc, 'go:' + x.id).run(w, J); const C = T.cases.P1;
    out.pick.started = !!C && C.tid === x.id && x.st === 'working' && T.st.picked === 1 && near(C.ev, 0.3) && TIPS.level(C) === 0 && ids('tipPick', J, pc).length === 0;

    // 3) 查證
    DECIDE.S(w).q.length = 0; T.lastDay = null; fix(0.99, () => TIPS.daily(w)); DECIDE.S(w).q.length = 0; // drain 會把剛排的事直接照個性決定掉；這裡只看有沒有問到人
    out.dig = { asked: Object.keys(C.asked).length === 2 };
    const ac = { pid: 'P1', tid: x.id }; C.ev = 0.3; C.log = C.log.slice(0, 1); out.dig.ids = ids('tipAsked', S1, ac).join(); out.dig.facts = K.tipAsked.facts(w, S1, ac);
    opt('tipAsked', S1, ac, 'talk').run(w, S1); out.dig.lv1 = near(C.ev, 1.3) && TIPS.level(C) === 1; opt('tipAsked', S2, ac, 'anon').run(w, S2); out.dig.lv2 = near(C.ev, 2.0) && TIPS.level(C) === 2;
    C.ev = 0.3; opt('tipAsked', C1, ac, 'talk').run(w, C1); out.dig.victim = near(C.ev, 0.8); const j0 = bal(J), s0 = bal(S1); opt('tipAsked', S1, ac, 'money').run(w, S1); out.dig.money = near(bal(J), j0 - 8) && near(bal(S1), s0 + 8) && near(C.ev, 1.5);
    traits(S1, ['kind', 'perfectionist']); const th = opt('tipAsked', S1, ac, 'talk').base; traits(S1, ['lazy', 'gossip']); const tl = opt('tipAsked', S1, ac, 'talk').base; traits(S1, []); out.dig.honest = th > tl;

    // 4) 被查的人聽到風聲
    C.d0 = d - 2; C.heard = false; DECIDE.S(w).q.length = 0; T.lastDay = null; const _dr = DECIDE.drain; DECIDE.drain = () => {}; TIPS.daily(w); out.hear = { asked: !!qGet('tipTarget', O1) && C.heard };
    P1.owner = PO.agentId; out.hear.ids = ids('tipTarget', O1, ac).join(); out.hear.facts = K.tipTarget.facts(w, O1, ac); out.hear.notOther = K.tipTarget.options(w, O3, ac).length === 0;
    // 5) 塞錢
    DECIDE.S(w).q.length = 0; opt('tipTarget', O1, ac, 'bribe').run(w, O1); const bq = qGet('tipBribe', J); out.bribe = { asked: !!bq && bq.ctx.n >= 10, ids: ids('tipBribe', J, bq.ctx).join(), facts: K.tipBribe.facts(w, J, bq.ctx) };
    opt('tipBribe', J, bq.ctx, 'expose').run(w, J); out.bribe.expose = C.bribeTried === true; C.bribeTried = false;
    const j1 = bal(J), o1 = bal(O1), pb0 = opt('tipPrint', J, ac, 'print').base; opt('tipBribe', J, bq.ctx, 'take').run(w, J);
    out.bribe.take = near(bal(J), j1 + bq.ctx.n) && near(bal(O1), o1 - bq.ctx.n) && C.kill === 'bribe' && D.facts.some(y => y.kind === 'bribe' && y.by === O1.agentId && y.knows[J.agentId]) && T.st.bribed === 1 && opt('tipPrint', J, ac, 'print').base < pb0 - 1 && /收了他的錢|took his money/.test(K.tipPrint.facts(w, J, ac));
    C.kill = null;
    // 找老闆壓稿
    DECIDE.S(w).q.length = 0; opt('tipTarget', O1, ac, 'boss').run(w, O1); const oq = qGet('tipOwner', PO); out.boss = { asked: !!oq, ids: ids('tipOwner', PO, oq.ctx).join(), facts: K.tipOwner.facts(w, PO, oq.ctx), notOwner: K.tipOwner.options(w, C1, oq.ctx).length === 0 };
    opt('tipOwner', PO, oq.ctx, 'kill').run(w, PO); out.boss.kill = C.ownerKill === true && /可能被開除|may be fired/.test(JSON.stringify(K.tipPrint.options(w, J, ac).map(o => typeof o.text === 'string' ? t(o.text) : ''))) && /老闆叫你別登|owner has told you/.test(K.tipPrint.facts(w, J, ac));
    // 找首長出面
    DECIDE.S(w).q.length = 0; PW.inf[MY.agentId] = { [O1.agentId]: 40 }; opt('tipTarget', O1, ac, 'mayor').run(w, O1); const mq = qGet('tipMayor', MY); out.mayor = { asked: !!mq, ids: ids('tipMayor', MY, mq.ctx).join(), facts: K.tipMayor.facts(w, MY, mq.ctx) };
    const lb = opt('tipMayor', MY, mq.ctx, 'lean').base; PW.inf = {}; const lb0 = opt('tipMayor', MY, mq.ctx, 'lean').base; out.mayor.owed = lb > lb0 && /40/.test(out.mayor.facts);
    opt('tipMayor', MY, mq.ctx, 'lean').run(w, MY); const cv = D.facts.find(y => y.kind === 'cover' && y.by === MY.agentId); const xc = T.box.find(y => y.type === 'cover');
    out.mayor.lean = C.mayor === true && !!cv && cv.knows[J.agentId] === 'party' && !!xc && xc.about === MY.agentId && xc.d === d + 3;
    opt('tipTarget', O1, ac, 'libel').run(w, O1); out.hear.libel = C.libel === true;
    // 6) 登不登
    out.print = { ids: ids('tipPrint', J, ac).join(), facts: K.tipPrint.facts(w, J, ac) };
    C.ev = 2; const pPress = opt('tipPrint', J, ac, 'print').base; C.ownerKill = false; C.mayor = false; C.libel = false; const pFree = opt('tipPrint', J, ac, 'print').base; C.ev = 0.3; const pThin = opt('tipPrint', J, ac, 'print').base; out.print.lean = pPress < pFree && pThin < pFree;
    // 不顧老闆照登 → 被開除
    C.ev = 2; C.ownerKill = true; for (const a of [C1, C2, C3]) a.relationships.getOrCreate(O1.agentId, O1.name).affinity = 0; DECIDE.S(w).q.length = 0; const cred0 = P1.cred;
    fix(0, () => opt('tipPrint', J, ac, 'print').run(w, J)); const st = P1.stories[P1.stories.length - 1];
    out.print.done = st?.kind === 'expose' && st.fid === f.id && f.pub === d && !T.cases.P1 && x.st === 'printed' && T.done[T.done.length - 1].out === 'print' && T.done[T.done.length - 1].log.length >= 3;
    out.print.readers = [C1, C2, C3].every(a => f.knows[a.agentId]) && f.knows[C2.agentId] === 'read' && (C2.relationships.relationships[O1.agentId]?.affinity || 0) <= -8 && q().filter(y => y.kind === 'dealRead').length >= 3 && !!T.spread[f.id];
    out.print.fired = P1.journo === null && T.st.fired === 1 && P1.cred === cred0 + 2 + 3 && (O1.memory?.entries || []).some(m => /登出來/.test(m.content || '') || /printed a story/.test(m.content || ''));
    const rc = { fid: f.id, pid: 'P1' }; out.read = { ids: ids('dealRead', C2, rc).join(), facts: K.dealRead.facts(w, C2, rc), hurt: /你自己也出過事|hurt yourself/.test(K.dealRead.facts(w, C1, rc)) };
    opt('dealRead', C2, rc, 'boycott').run(w, C2); out.read.boy = D.boy.kitchen?.lead === C2.agentId && (typeof opt('dealRead', C3, rc, 'boycott').text === 'object'); opt('dealRead', C3, rc, 'boycott').run(w, C3); out.read.join = D.boy.kitchen.n === 2;
    // 沒人相信、淡化、撤稿、轉給別家
    P1.journo = J.agentId; DEAL.setCut(w, 'kitchen', 0); DEAL.setCut(w, 'kitchen', 2); const f2 = DEAL.liveFact(w, 'kitchen', 'cut'); const mk = () => { const y = TIPS.add(w, { src: 'tip', by: S1.agentId, about: O1.agentId, fid: f2.id }); const Cc = TIPS.start(w, P1, J, y, false); return [y, Cc, { pid: 'P1', tid: y.id }]; };
    let [y1, C1c, a1] = mk(); C1c.ev = 0.3; fix(0.99, () => opt('tipPrint', J, a1, 'print').run(w, J)); out.print.nobody = !Object.values(f2.knows).includes('read') && P1.cred === cred0 + 5 - 2; f2.pub = 0; y1.st = 'dropped';
    let [y2, C2c, a2] = mk(); const n0 = P1.stories.length; opt('tipPrint', J, a2, 'soft').run(w, J); out.print.soft = P1.stories.length === n0 + 1 && P1.stories[n0].kind === 'critic' && !f2.pub && T.done[T.done.length - 1].out === 'soft' && T.st.soft === 1; y2.st = 'dropped';
    let [y3, C3c, a3] = mk(); opt('tipPrint', J, a3, 'kill').run(w, J); out.print.kill = T.st.killed === 1 && y3.st === 'dropped' && !T.cases.P1;
    let [y4, C4c, a4] = mk(); C4c.ev = 1.5; out.print.passOpt = ids('tipPrint', J, a4).includes('pass'); opt('tipPrint', J, a4, 'pass').run(w, J); out.print.pass = y4.st === 'new' && y4.src === 'pass' && y4.ev === 1.5 && T.st.passed === 1;
    const C5 = TIPS.start(w, P2, J2, y4, false); out.print.passed = near(C5.ev, 1.5) && TIPS.level(C5) === 1; TIPS.close(w, T, P2, C5, 'drop');
    // 當事人道歉
    let [y6, C6c, a6] = mk(); D.harm.push({ id: C3.agentId, name: C3.name, key: 'kitchen', kind: 'meal', d, sev: 1, fid: f2.id }); const c30 = bal(C3); opt('tipTarget', O1, a6, 'sorry').run(w, O1);
    out.sorry = { ok: C6c.sorry === true && f2.end != null && DEAL.F(w, 'kitchen').cut === 0 && bal(C3) > c30, noFix: !ids('tipTarget', O1, a6).includes('fix') }; f2.pub = 0; fix(0, () => opt('tipPrint', J, a6, 'print').run(w, J)); out.sorry.story = /道歉|apologised/.test(JSON.stringify(P1.stories[P1.stories.length - 1].k));
    // 7) 首長護航被登出來
    xc.d = d; const aM = MY.relationships; const C7 = TIPS.start(w, P1, J, xc, false); const sc0 = PW.scandal[MY.agentId] || 0; for (const a of [C1, C2, C3]) a.relationships.getOrCreate(MY.agentId, MY.name).affinity = 10;
    out.cover = { ev: TIPS.level(C7) === 2 }; fix(0, () => TIPS.print(w, P1, J, C7, false)); out.cover.done = (PW.scandal[MY.agentId] || 0) === sc0 + 1 && (C2.relationships.relationships[MY.agentId]?.affinity || 0) <= 2 && cv.pub === d && xc.st === 'printed';
    // 每天自己排選題
    DECIDE.drain = () => {}; const y8 = TIPS.add(w, { src: 'tip', by: S1.agentId, about: O3.agentId, fid: fh.id }); T.last = {}; DECIDE.S(w).q.length = 0; T.lastDay = null; TIPS.daily(w); out.auto = { pick: !!qGet('tipPick', J) && !!qGet('tipPick', J2) };
    DECIDE.S(w).q.length = 0; T.lastDay = null; TIPS.daily(w); out.auto.idle = !qGet('tipPick', J); DECIDE.drain = _dr;
    const C9 = TIPS.start(w, P1, J, y8, false); out.auto.openEv = TIPS.level(C9) === 2; C9.d0 = d - 3; DECIDE.S(w).q.length = 0; DECIDE.drain = () => {}; T.lastDay = null; TIPS.daily(w); DECIDE.drain = _dr; out.auto.printAsk = !!qGet('tipPrint', J) && C9.printAsk;
    C9.d0 = d - 11; T.lastDay = null; DECIDE.S(w).q.length = 0; DECIDE.drain = () => {}; TIPS.daily(w); DECIDE.drain = _dr; out.auto.stale = !T.cases.P1;
    const v = TIPS.view(w); out.view = { box: v.box.length, done: v.done.length, log: v.done.map(z => z.text + '：' + z.log.map(l => l.text).join('／')).join(' ‖ ') };
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { box: (w2.tips?.box || []).length === T.box.length, done: (w2.tips?.done || []).length === T.done.length }; w2.reset(); out.save.reset = !w2.tips;
    out.texts = [out.box.text, out.pick.facts, out.dig.facts, out.hear.facts, out.bribe.facts, out.boss.facts, out.mayor.facts, out.print.facts, out.read.facts, out.view.log].join(' ‖ ');
    return out;
  });
  ok(!r.board.on && r.board.papers === 0 && r.board.noTip, '只有公告欄的小地方：沒有記者，也沒有「向報社說」這條路', r.board);
  ok(r.box.on && r.box.anon && r.box.one && r.box.more && r.box.self, '線索進箱：匿名爆料、同一件事多人來說併成一條、記者自己看到的大幅漲價', r.box);
  ok(r.pick.ids.startsWith('none,go:') && r.pick.ids.split(',').length === 3 && r.pick.notMine && r.pick.lean && r.pick.cap && r.pick.rush, '記者選題：每條線索一個選項；跟當事人有交情、他跟報社老闆有往來，就比較不想查；愛八卦的可以不查就登', r.pick);
  ok(r.pick.started, '選了就立案：線索標成查證中，手上還只有傳聞', r.pick);
  ok(r.dig.asked && r.dig.ids === 'no,talk,anon,money', '查證：每天去問最多兩位知情的人；對方可以不說、具名說、不具名說、要錢才說', r.dig);
  ok(r.dig.lv1 && r.dig.lv2 && r.dig.victim && r.dig.money && r.dig.honest, '員工具名是人證、再一位不具名就是鐵證；受害人的話只算一半；花錢買得到說法；老實的人比較肯說', r.dig);
  ok(r.hear.asked && r.hear.ids === 'ignore,sorry,fix,bribe,boss,mayor,libel' && r.hear.notOther && r.hear.libel, '查了兩天，被查的人聽到風聲：不理／道歉／悄悄改／塞錢／找老闆／找首長／放話要告', r.hear);
  ok(r.bribe.asked && r.bribe.ids === 'refuse,take,expose' && r.bribe.expose && r.bribe.take, '塞錢：記者可以不收、收下（錢真的過手、記成一件有人知道的事、之後幾乎不會登）、寫進報導', r.bribe);
  ok(r.boss.asked && r.boss.ids === 'let,kill' && r.boss.notOwner && r.boss.kill, '找報社老闆：老闆可以不管或叫記者別登', r.boss);
  ok(r.mayor.asked && r.mayor.ids === 'refuse,lean' && r.mayor.owed && r.mayor.lean, '找首長：收過他錢的首長比較會出面；出面這件事記者知道，三天後變成新線索', r.mayor);
  ok(r.print.ids === 'kill,print,soft,pass' && r.print.lean, '登不登：受到壓力、證據不夠時比較不敢登', r.print);
  ok(r.print.done && r.print.readers, '照登：訂報的人讀到、相信的人知道了這件事、對當事人印象變差，之後自己決定怎麼辦', r.print);
  ok(r.print.fired, '不顧老闆照登：記者被開除，報社信譽上升', r.print);
  ok(r.read.ids === 'shrug,boycott,trial,tell' && r.read.hurt && r.read.boy && r.read.join, '讀到的人：看看就算了／號召或跟著抵制／提案審判／講給別人聽', r.read);
  ok(r.print.nobody && r.print.soft && r.print.kill && r.print.passOpt && r.print.pass && r.print.passed, '只有傳聞就登沒人信、信譽下降；淡化不指名；撤稿；轉給別家時查到的證據跟著過去', r.print);
  ok(r.sorry.ok && r.sorry.noFix && r.sorry.story, '當事人公開道歉：賠錢給出事的人、改回來，報導會寫他已經道歉', r.sorry);
  ok(r.cover.ev && r.cover.done, '首長護航被登出來：讀者對首長印象變差、多一筆醜聞', r.cover);
  ok(r.auto.pick && r.auto.idle && r.auto.openEv && r.auto.printAsk && r.auto.stale, '每天的流程：閒著的報社隔幾天選一次題、公開的漲價不用找人證、第三天問登不登、拖太久作罷', r.auto);
  ok(r.view.box >= 1 && r.view.done >= 5 && r.save.box && r.save.done && r.save.reset, '來龍去脈留得下來；存讀檔後還在，開新鎮清掉', [r.view.box, r.view.done, r.save]);
  ok(zh ? !/\{[a-z]+\}/.test(r.texts) && /記者/.test(r.texts) : !/[一-鿿]/.test(r.texts) && !/\{[a-z]+\}/.test(r.texts), '題目與紀錄沒有漏翻、沒有沒填的空格', (zh ? r.texts.match(/\{[a-z]+\}/g) : r.texts.match(/[一-鿿]+|\{[a-z]+\}/g)) || r.texts.slice(0, 300));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
