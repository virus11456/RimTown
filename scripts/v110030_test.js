// v11.0.0 市場與第四權（第一段）之四：民怨、鎮公所前的抗議、遊行、政治陣營
//   1) 民怨怎麼來：告發沒有下文、報上登出官員不辦事；輕的不會馬上想做什麼，累積了才會；30 天後淡掉
//   2) 心裡有氣的人：忍著／號召／跟著去／連署罷免（對象是首長）；人不夠不能號召
//   3) 號召之後各自決定去不去；隔天人太少就不成；夠了就到鎮公所前
//   4) 首長：出面答應處理（撤換官員、重查）／不出面／叫衛兵趕人；被打發之後人夠多會升級成遊行
//   5) 衛兵隊長：照命令趕人（有人受傷、帶頭的被關、想罷免首長的人變多）／站到一邊／站到人群裡
//   6) 陣營：收東家錢或自己開店的是一邊，工會與出過事的是另一邊；滿兩人成形、自己挑名字；影響表決與選舉
//   7) 畫面資料、存讀檔、中英
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
    WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); DEALASK.S(w); PRESS.S(w); const PW = POWER.S(w); const sp = w.stockpile; const P = w.proposals; try { CIVIC.S(w); } catch (e) {}
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const bal = (a, v) => { if (v != null) w.wallet.bal[a.agentId] = v; return WALLET.get(w, a); };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); };
    const like = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; }; const liking = (a, b) => a.relationships.getOrCreate(b.agentId, b.name).affinity;
    const MY = w.election.currentMayor(w); const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a !== MY);
    const [TG, LEAD, A1, A2, A3, A4, A5, A6, A7, GD, O1, O3, CM1, CM2, CM3, CM4, J] = adults; const cast = [TG, LEAD, A1, A2, A3, A4, A5, A6, A7, GD, O1, O3, CM1, CM2, CM3, CM4, J, MY];
    for (const a of cast) { traits(a, []); bal(a, 200); for (const b of cast) if (a !== b) like(a, b, 0); a.job = new Job('farmer'); }
    for (const a of npcs()) { if (a.job?.key === 'guard') a.job = new Job('farmer'); if (a !== MY) { like(a, MY, 0); } if (a !== GD) like(GD, a, 0); } // 衛兵原本的交情歸零，後面才看得出「人群裡有親友」的差別
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; O1.job = new Job('trader'); O3.job = new Job('trader'); MY.job = MY.job?.key === 'mayor' ? MY.job : new Job('mayor');
    const P1 = { id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, owner: null, journo: J.agentId, stories: [], fame: 0 }; I18N.registerName('鎮報', 'Town Paper'); w.press.papers = [P1]; w.press.reads = {}; for (const a of [A5, A6]) w.press.reads[a.agentId] = 'P1'; PW.inf = {}; PW.scandal = {};
    w.deallaw = null; w.office = null; w.tips = null; w.unrest = null; w.camps = null; D.reports = []; D.tips = []; D.harm = []; if (w.union) { w.union.on = false; w.union.members = {}; }
    const U = UNREST.S(w); const O = OFFICE.S(w); const T = TIPS.S(w); TIERS.S(w).lv = 1; if (w.tierState) w.tierState.lv = 1; sp.resources.silver = 5000;
    const K = DECIDE.KINDS; const ids = (k, a, c) => K[k].options(w, a, c).map(o => o.id); const opt = (k, a, c, id) => K[k].options(w, a, c).find(o => o.id === id); const q = () => DECIDE.S(w).q; const qGet = (kind, a) => q().find(x => x.kind === kind && x.a === a.agentId); const qClear = () => { q().length = 0; };
    const _abs = w._absDay.bind(w); let now = _abs(); w._absDay = () => now; const _dr = DECIDE.drain; DECIDE.drain = () => {};
    const signers = () => { try { const I = REPEAL.recallInfo(w, null); return Array.isArray(I.signers) ? I.signers.length : I.signers; } catch (e) { return -1; } };
    OFFICE.seat(w, 'market', TG, MY); O.mayor = MY.agentId; O.lastNom = { market: now + 99, tax: now + 99 };

    // 1) 民怨怎麼來
    qClear(); const x1 = UNREST.anger(w, A1, TG, 1, 'shield'); out.anger = { one: x1.n === 1 && !qGet('hallCall', A1), self: UNREST.anger(w, TG, TG, 1, 'snub') === null };
    UNREST.anger(w, A1, TG, 1, 'shield'); out.anger.two = U.angry[A1.agentId].n === 2 && !!qGet('hallCall', A1); qClear(); UNREST.anger(w, A1, TG, 1, 'shield'); out.anger.onceAWeek = !qGet('hallCall', A1) && U.angry[A1.agentId].n === 3;
    const kid = npcs().find(a => (a.age || 30) < 14); out.anger.kid = !kid || UNREST.anger(w, kid, TG, 2, 'snub') === null;
    // 告發沒有下文、報上登出來：都會記一筆
    DEAL.setCut(w, 'textile', 1); const ft = DEAL.liveFact(w, 'textile', 'cut'); DEAL.F(w, 'textile').gain = 40; DEALASK.report(w, A2, ft); qClear(); const tg = OFFICE.targets(w, TG, 'market').find(x => x.key === 'textile'); const fc = fix(0, () => OFFICE.inspect(w, TG, 'market', tg)); opt('officeFound', TG, fc, 'sit').run(w, TG);
    out.anger.snub = U.angry[A2.agentId]?.why === 'snub' && U.angry[A2.agentId].n === 2 && !!qGet('hallCall', A2) && !!qGet('reportSnub', A2);
    const cf = D.facts.find(f => f.kind === 'cover' && f.by === TG.agentId); const xs = TIPS.add(w, { src: 'tip', by: A2.agentId, about: TG.agentId, type: 'shield', cover: cf.id }); const C = TIPS.start(w, P1, J, xs, false); fix(0, () => TIPS.print(w, P1, J, C, false)); out.anger.read = U.angry[A5.agentId]?.why === 'shield' && U.angry[A6.agentId]?.at === TG.agentId;
    out.anger.list = UNREST.list(w, TG).length; out.anger.heat = UNREST.heat(w) > 0; out.anger.describe = UNREST.describe(w, A2); out.anger.mine = UNREST.describe(w, TG);
    now += 31; out.anger.fade = UNREST.list(w, TG).length === 0; U.lastDay = null; UNREST.daily(w); out.anger.gone = Object.keys(U.angry).length === 0; now -= 31; U.asked = {}; if (O.posts.market) delete O.posts.market; OFFICE.seat(w, 'market', TG, MY); qClear();

    // 2) 心裡有氣的人
    UNREST.anger(w, LEAD, TG, 2, 'snub'); UNREST.anger(w, A1, TG, 2, 'snub'); const hc = { at: TG.agentId };
    out.call = { few: ids('hallCall', LEAD, hc).join(), facts: K.hallCall.facts(w, LEAD, hc), calm: K.hallCall.options(w, A7, hc).length === 0 }; UNREST.anger(w, A2, TG, 2, 'snub'); UNREST.anger(w, A3, TG, 2, 'paid'); out.call.ids = ids('hallCall', LEAD, hc).join(); out.call.can = UNREST.canCall(w, TG) && !UNREST.wouldMarch(w, TG);
    const bc0 = opt('hallCall', LEAD, hc, 'call').base; traits(LEAD, ['shy']); out.call.shy = opt('hallCall', LEAD, hc, 'call').base < bc0; traits(LEAD, ['charismatic']); out.call.bold = opt('hallCall', LEAD, hc, 'call').base > bc0; traits(LEAD, []);
    qClear(); opt('hallCall', LEAD, hc, 'call').run(w, LEAD); out.call.made = U.call?.lead === LEAD.agentId && U.call.kind === 'hall' && U.call.who.length === 1 && [A1, A2, A3].every(a => !!qGet('hallJoin', a)) && !qGet('hallJoin', LEAD);
    out.call.after = ids('hallCall', A1, hc).join(); const jc = { at: TG.agentId, lead: LEAD.agentId }; out.join = { ids: ids('hallJoin', A1, jc).join(), facts: K.hallJoin.facts(w, A1, jc), notAngry: K.hallJoin.options(w, A7, jc).length === 0 };
    const bj0 = opt('hallJoin', A1, jc, 'go').base; like(A1, LEAD, 50); out.join.friend = opt('hallJoin', A1, jc, 'go').base > bj0; like(A1, LEAD, 0);
    // 3) 人太少不成；夠了就成
    opt('hallJoin', A1, jc, 'go').run(w, A1); out.join.go = U.call.who.includes(A1.agentId) && K.hallJoin.options(w, A1, jc).length === 0; now += 1; U.lastDay = null; UNREST.daily(w); out.fizzle = !U.call && U.hist.length === 1 && U.hist[0].res === 'fizzle' && U.st.fizzled === 1 && U.last.hall < 0;
    UNREST.call(w, LEAD, TG); for (const a of [A1, A2]) opt('hallJoin', a, jc, 'go').run(w, a); qClear(); now += 1; U.lastDay = null; UNREST.daily(w); const E1 = U.hist[U.hist.length - 1];
    out.hall = { on: E1.kind === 'hall' && E1.n === 3 && E1.res === null && U.last.hall === now && U.st.halls === 1, go: [LEAD, A1, A2].every(a => a._thingGo?.place === 'town_hall' && a._thingGo.why === 'protest'), asked: !!qGet('hallFaced', MY), mem: (LEAD.memory?.entries || []).some(m => /鎮公所|town hall/.test(m.content || '')) };
    // 4) 首長怎麼應對
    const fcx = { eid: E1.id }; out.faced = { ids: ids('hallFaced', MY, fcx).join(), facts: K.hallFaced.facts(w, MY, fcx), notMayor: K.hallFaced.options(w, A7, fcx).length === 0 }; GD.job = new Job('guard'); out.faced.guard = ids('hallFaced', MY, fcx).join();
    const bm0 = opt('hallFaced', MY, fcx, 'meet').base; traits(MY, ['kind']); out.faced.kind = opt('hallFaced', MY, fcx, 'meet').base > bm0; traits(MY, []); like(MY, TG, 60); out.faced.friend = opt('hallFaced', MY, fcx, 'meet').base < bm0; like(MY, TG, 0);
    const sg0 = signers(); const l0 = liking(LEAD, MY); fix(0.99, () => opt('hallFaced', MY, fcx, 'ignore').run(w, MY)); out.ignore = { res: E1.res === 'ignore', liked: liking(LEAD, MY) < l0, at: U.angry[LEAD.agentId].at === MY.agentId && U.angry[LEAD.agentId].why === 'ignored', escal: U.escal[TG.agentId] === now && U.escal[MY.agentId] === now, done: K.hallFaced.options(w, MY, fcx).length === 0, noCall: !UNREST.canCall(w, MY) };
    // 被打發之後，人夠多就升級成遊行；首長叫衛兵趕人
    now += 8; const need = UNREST.marchNeed(w); const more = npcs().filter(a => (a.age || 30) >= 20 && !cast.includes(a)).slice(0, need); for (const a of [A3, A4, A5, A6, A7, ...more]) UNREST.anger(w, a, MY, 2, 'ignored');
    out.march = { need, would: UNREST.wouldMarch(w, MY), ids: ids('hallCall', LEAD, { at: MY.agentId }).join(), facts: K.hallCall.facts(w, LEAD, { at: MY.agentId }) }; const sgA = signers(); opt('hallCall', A4, { at: MY.agentId }, 'sign').run(w, A4); out.march.sign = liking(A4, MY) <= -20 && U.st.signed === 1 && signers() >= sgA;
    qClear(); UNREST.call(w, LEAD, MY); out.march.kind = U.call?.kind === 'march'; const jm = { at: MY.agentId, lead: LEAD.agentId }; out.march.joinFacts = K.hallJoin.facts(w, A1, jm); for (const a of [A1, A2, A3, A5, A6, A7, ...more]) { const o = opt('hallJoin', a, jm, 'go'); if (o) o.run(w, a); }
    qClear(); now += 1; U.lastDay = null; UNREST.daily(w); const E2 = U.hist[U.hist.length - 1]; const mc = { eid: E2.id }; out.march.on = E2.kind === 'march' && E2.n >= Math.ceil(need * 0.6) && U.st.marches === 1 && !!qGet('hallFaced', MY); out.march.faced = K.hallFaced.facts(w, MY, mc);
    qClear(); opt('hallFaced', MY, mc, 'clear').run(w, MY); const gc = { eid: E2.id }; out.guard = { asked: !!qGet('hallGuard', GD) && E2.res === null, ids: ids('hallGuard', GD, gc).join(), facts: K.hallGuard.facts(w, GD, gc), notGuard: K.hallGuard.options(w, A7, gc).length === 0 };
    const bo0 = opt('hallGuard', GD, gc, 'obey').base; like(GD, A1, 60); like(GD, A2, 60); out.guard.kin = opt('hallGuard', GD, gc, 'obey').base < bo0 && ids('hallGuard', GD, gc).includes('join'); like(GD, A1, 0); like(GD, A2, 0);
    const sg1 = signers(); const sc0 = PW.scandal[MY.agentId] || 0; fix(0, () => opt('hallGuard', GD, gc, 'obey').run(w, GD));
    out.clear = { res: E2.res === 'cleared', hurt: E2.hurt === E2.n, jail: (w.civic?.jail?.[LEAD.agentId] || 0) === now + 2, scandal: (PW.scandal[MY.agentId] || 0) === sc0 + 1, angry: U.angry[A1.agentId].why === 'cleared' && U.angry[A1.agentId].n >= 4, signers: [sg0, sg1, signers()], more: signers() > sg1, home: !A1._thingGo, st: U.st.cleared === 1 };
    // 站到一邊；站到人群裡
    const mk = (kind, at, who) => { U.call = { d: now - 1, lead: who[0].agentId, at: at.agentId, who: who.map(a => a.agentId), kind }; U.last = { hall: -99, march: -99 }; const E = UNREST.happen(w); E.order = MY.agentId; return E; };
    const E3 = mk('hall', MY, [A1, A2, A3]); const l3 = liking(MY, GD); opt('hallGuard', GD, { eid: E3.id }, 'stand').run(w, GD); out.stand = E3.res === 'stood' && liking(MY, GD) < l3 && liking(A1, GD) > -8 && U.st.stood === 1;
    const E4 = mk('hall', MY, [A1, A2, A3]); UNREST.anger(w, GD, MY, 2, 'cleared'); out.joinG = { ids: ids('hallGuard', GD, { eid: E4.id }).join() }; opt('hallGuard', GD, { eid: E4.id }, 'join').run(w, GD); out.joinG.ok = E4.res === 'joined' && E4.who.includes(GD.agentId) && U.st.joined === 1;
    // 出面答應處理：撤換官員；首長自己壓下來的事重新查
    for (const a of [A1, A2, A3]) UNREST.anger(w, a, TG, 2, 'snub'); const E5 = mk('hall', TG, [A1, A2, A3]); delete E5.order; const l5 = liking(A1, MY); opt('hallFaced', MY, { eid: E5.id }, 'meet').run(w, MY);
    out.meet = { res: E5.res === 'meet', fired: !OFFICE.holder(w, 'market'), calm: UNREST.list(w, TG).length === 0, liked: liking(A1, MY) > l5, log: E5.log.length >= 2, st: U.st.met === 1 };
    DEAL.setCut(w, 'textile', 0); DEAL.setCut(w, 'textile', 1); DEAL.F(w, 'textile').gain = 40; const cm = DEAL.fact(w, { kind: 'cover', key: 'textile', by: MY.agentId, with: O3.agentId, lv: 1 }); for (const a of [A1, A2, A3]) UNREST.anger(w, a, MY, 2, 'cover'); const n5 = U.angry[A1.agentId].n;
    const E6 = mk('hall', MY, [A1, A2, A3]); delete E6.order; const s6 = sp.get('silver'); bal(O3, 200); opt('hallFaced', MY, { eid: E6.id }, 'meet').run(w, MY); out.meet.redo = !!cm.redo && sp.get('silver') > s6 && DEAL.F(w, 'textile').cut === 0 && U.angry[A1.agentId].n < n5;
    const E7 = mk('hall', MY, [A1, A2, A3]); delete E7.order; opt('hallFaced', MY, { eid: E7.id }, 'meet').run(w, MY); out.meet.law = (P.items || []).some(p => DEALLAW.LAWS.includes(p.kind) && p.proposerId === MY.agentId && p.status === 'open');

    // 6) 陣營
    w.council = w.council || {}; const c0 = { f: w.council._formed, m: w.council.members }; w.council._formed = true; w.council.members = [CM1, CM2, CM3, CM4].map(a => a.agentId);
    PW.inf[CM1.agentId] = { [O1.agentId]: 60 }; M.owners.timber = CM2.agentId; w.union = w.union || {}; w.union.on = true; w.union.members = w.union.members || {}; w.union.members[CM3.agentId] = 1; D.harm.push({ id: CM4.agentId, name: CM4.name, key: 'kitchen', kind: 'meal', d: now, sev: 1 }); D.reports.push({ fid: ft.id, by: CM4.agentId, d: now, about: O3.agentId, key: 'textile', kind: 'cut', st: 'new' });
    out.camp = { score: [CM1, CM2, CM3, CM4, A7].map(a => CAMPS.sideOf(CAMPS.score(w, a))).join(), before: CAMPS.side(w, CM1) === null }; qClear(); CAMPS.rebuild(w); const CS = CAMPS.S(w);
    out.camp.formed = CS.biz.m.length === 2 && CS.folk.m.length === 2 && CS.st.formed === 2 && CAMPS.side(w, CM1) === 'biz' && CAMPS.side(w, CM3) === 'folk' && CAMPS.side(w, A7) === null; const lb = w.agents[CS.biz.lead], lf = w.agents[CS.folk.lead]; out.camp.ask = !!qGet('campName', lb) && !!qGet('campName', lf);
    out.camp.ids = ids('campName', lb, { side: 'biz' }).join(); out.camp.facts = K.campName.facts(w, lb, { side: 'biz' }); out.camp.notLead = K.campName.options(w, A7, { side: 'biz' }).length === 0; out.camp.unnamed = CAMPS.describe(w, CM1);
    opt('campName', lb, { side: 'biz' }, 'n0').run(w, lb); opt('campName', lf, { side: 'folk' }, 'n1').run(w, lf); out.camp.named = CS.biz.name?.[0] === '商會派' && CS.folk.name?.[0] === '公道會' && CS.st.named === 2 && K.campName.options(w, lb, { side: 'biz' }).length === 0; out.camp.describe = CAMPS.describe(w, CM1) + CAMPS.describe(w, CM3);
    CAMPS.rebuild(w); out.camp.noReask = !qGet('campName', lb) || CS.biz.name != null;
    const pl = DEALLAW.propose(w, 'deal_cartel', A6, '') || (P.items || []).find(p => DEALLAW.LAWS.includes(p.kind) && p.status === 'open'); const vt = (p, a) => { delete p.votes[a.agentId]; P._ruleVote(w, p, a); return p.why?.[a.agentId]; };
    out.camp.votes = fix(0, () => [vt(pl, CM1), vt(pl, CM3)]).join(); const pa = OFFICE.nominate(w, MY, 'market', CM2); out.camp.appoint = fix(0, () => [vt(pa, CM1), vt(pa, CM3)]).join(); out.camp.free = fix(0.99, () => vt(pl, CM1)) !== 'camp_biz';
    out.camp.stance = [CAMPS.stance(w, CM1), CAMPS.stance(w, CM3)].join(); out.camp.bias = { hurtStrict: CAMPS.bias(w, CM4, CM3.agentId) > 0, hurtLoose: CAMPS.bias(w, CM4, CM1.agentId) < 0, ownerLoose: CAMPS.bias(w, O1, CM1.agentId) > 0, ownerStrict: CAMPS.bias(w, O1, CM3.agentId) < 0, self: CAMPS.bias(w, CM1, CM1.agentId) === 0 };
    // 7) 畫面資料、存讀檔
    const uv = UNREST.view(w), cv = CAMPS.view(w); out.view = { hist: uv.hist.length, log: uv.hist.map(h => h.res + '：' + h.log.map(l => l.text).join('／')).join(' ‖ '), targets: uv.targets.length >= 1, camps: cv.biz.name + '｜' + cv.folk.name, members: cv.biz.members.length === 2 && cv.folk.members.length === 2 };
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); out.save = { unrest: (w2.unrest?.hist || []).length === U.hist.length, camps: w2.camps?.biz?.name?.[0] === '商會派' }; w2.reset(); out.save.reset = !w2.unrest && !w2.camps;
    out.whys = Object.keys(UNREST.WHY).map(k => t(UNREST.WHY[k])).join('｜') + '｜' + ['camp_biz', 'camp_folk', 'camp_own', 'camp_other'].map(k => t(VOTE_WHY[k])).join('｜');
    out.texts = [out.anger.describe, out.anger.mine, out.call.facts, out.join.facts, out.faced.facts, out.march.facts, out.march.joinFacts, out.march.faced, out.guard.facts, out.camp.facts, out.camp.unnamed, out.camp.describe, out.view.log, out.view.camps, out.whys].join(' ‖ ');
    w._absDay = _abs; DECIDE.drain = _dr; w.council._formed = c0.f; w.council.members = c0.m;
    return out;
  });
  ok(r.anger.one && r.anger.two && r.anger.onceAWeek && r.anger.self && r.anger.kid, '民怨：輕的一筆不會馬上想做什麼，累積到兩分才問他要不要出這口氣，一個人七天問一次；小孩不算', r.anger);
  ok(r.anger.snub && r.anger.read && r.anger.list >= 3 && r.anger.heat, '告發沒有下文的人、讀到報導而且相信的人，各記一筆', r.anger);
  ok(r.anger.fade && r.anger.gone, '30 天後淡掉', r.anger);
  ok(r.call.few === 'bear' && r.call.calm && r.call.ids === 'bear,call' && r.call.can, '有氣的人不到 3 個不能號召；心裡沒氣的人不會被問', r.call);
  ok(r.call.shy && r.call.bold, '害羞的人比較不會出來號召，有人緣的比較會', r.call);
  ok(r.call.made && r.call.after === 'bear,join', '號召之後：其他有氣的人各自被問去不去；之後的人只能跟，不能再另外號召', r.call);
  ok(r.join.ids === 'stay,go' && r.join.notAngry && r.join.friend && r.join.go, '跟不跟：跟帶頭的人有交情比較會去；答應了就算一個', r.join);
  ok(r.fizzle, '隔天只來兩個人：不成，也不算辦過', r.fizzle);
  ok(r.hall.on && r.hall.go && r.hall.asked && r.hall.mem, '來了三個人：真的走到鎮公所前，首長要決定怎麼應對', r.hall);
  ok(r.faced.ids === 'meet,ignore' && r.faced.guard === 'meet,ignore,clear' && r.faced.notMayor && r.faced.kind && r.faced.friend, '首長：出面答應處理／不出面／叫衛兵趕人（要有衛兵）；心軟的比較會出面，被抗議的是朋友就比較不想處理', r.faced);
  ok(r.ignore.res && r.ignore.liked && r.ignore.at && r.ignore.escal && r.ignore.done && r.ignore.noCall, '不出面：到場的人對首長的好感下降、氣轉到首長身上；七天內不會再有人號召', r.ignore);
  ok(r.march.would && r.march.ids === 'bear,call,sign' && r.march.sign && r.march.kind && r.march.on, '被打發之後有氣的人夠多（至少 6 人或一成五）：再號召就是上街遊行；對象是首長時可以去連署罷免', r.march);
  ok(r.guard.asked && r.guard.ids === 'obey,stand' && r.guard.notGuard && r.guard.kin, '叫衛兵趕人：衛兵隊長自己決定；人群裡有親友就比較下不了手，還可能站過去', r.guard);
  ok(r.clear.res && r.clear.hurt && r.clear.jail && r.clear.scandal && r.clear.angry && r.clear.home && r.clear.st, '照命令趕人：有人受傷、帶頭的被關兩天、首長多一筆醜聞、被趕的人更氣', r.clear);
  ok(r.clear.more, '被趕之後想連署罷免首長的人變多（好感就是連署人數）', r.clear.signers);
  ok(r.stand && r.joinG.ids === 'obey,stand,join' && r.joinG.ok, '衛兵也可以站到一邊不動手（首長對他不滿）；自己也有氣的可以站到人群裡', [r.stand, r.joinG]);
  ok(r.meet.res && r.meet.fired && r.meet.calm && r.meet.liked && r.meet.log && r.meet.st, '出面答應處理：被抗議的官員真的被撤換，大家的氣消了、對首長好感回升', r.meet);
  ok(r.meet.redo && r.meet.law, '被抗議的是首長自己：把壓下來的事重新查（真的罰、改回來）；沒有可查的就答應立規定', r.meet);
  ok(r.camp.score === 'biz,biz,folk,folk,' && r.camp.before && r.camp.formed, '陣營自己長出來：收東家錢的、自己開店的是一邊；工會的、出過事又去告發的是另一邊；其他人兩邊都不是', r.camp);
  ok(r.camp.ask && r.camp.ids === 'n0,n1,n2,n3,n4' && r.camp.notLead && r.camp.named && r.camp.noReask, '一邊滿兩人就成形，由裡頭資歷最深的人從幾個名字裡挑一個；取過就不再問', r.camp);
  ok(r.camp.votes === 'camp_biz,camp_folk' && r.camp.appoint === 'camp_own,camp_other' && r.camp.free, '表決：管店家的案子一邊反對一邊贊成；任命官員時挺自己人、擋另一邊的（不是每次都照陣營投）', r.camp);
  ok(r.camp.stance === 'loose,strict' && r.camp.bias.hurtStrict && r.camp.bias.hurtLoose && r.camp.bias.ownerLoose && r.camp.bias.ownerStrict && r.camp.bias.self, '選舉：候選人在「管不管商人」上有立場；出過事的選民挑要管的、東家挑少管的', r.camp);
  ok(r.view.hist >= 6 && r.view.targets && r.view.members && r.save.unrest && r.save.camps && r.save.reset, '畫面資料齊全；存讀檔後還在，開新鎮清掉', [r.view.hist, r.save]);
  ok(zh ? !/\{[a-z]+\}/.test(r.texts) && /鎮公所/.test(r.texts) && /商會派/.test(r.texts) : !/[一-鿿]/.test(r.texts) && !/\{[a-z]+\}/.test(r.texts) && /Merchants/.test(r.texts), '題目與紀錄沒有漏翻、沒有沒填的空格', (zh ? r.texts.match(/\{[a-z]+\}/g) : r.texts.match(/[一-鿿]+|\{[a-z]+\}/g)) || r.texts.slice(0, 300));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
