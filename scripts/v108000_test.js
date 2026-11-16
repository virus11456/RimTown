// v10.8.0 其他財政收入、公債、公職薪水
//   1) 離境稅：沒開徵不收；開徵後搬走的人帶走的錢，超過免稅額的部分留兩成；現金與存款共用一份免稅額；真的搬走時公庫真的進帳
//   2) 財產稅：每週一次，現金加存款超過門檻的部分繳 1%；不老實的少報四成；現金不夠從存款扣（銀行真的付出）
//   3) 公職薪水跟著民間行情：老闆不到三家照原價；取中位數、限制在 0.8～1.1；一天最多動 0.02；公庫吃緊不跟著加薪；發薪與固定支出都用這個倍率
//   4) 公債：銀行留得住六成準備金才借；通過後錢從銀行到公庫；每天付利息；公庫吃緊時不還本；還清後結案；算進固定支出
//   5) 沒開智能體時什麼情況會有人提；開了就不自動提
//   6) 投票：要繳的人反對、領公庫薪水的人在公庫吃緊時贊成
//   7) 兩種稅通過後可以表決廢除、再恢復；開了智能體，題目裡列出還沒有的財源，AI 回 fiscal 效果就成案
//   8) 公庫卡多一段；存讀檔；中英；順手修掉最低工資提案的舊錯
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const P = w.proposals; const sp = w.stockpile; const T = TREASURY, F = FISCAL; const r2 = (n) => Math.round(n * 100) / 100;
    const runDay = () => { const d0 = w._absDay(); for (let i = 0; i < 300 && w._absDay() === d0; i++) { w.paused = false; w.tick(); } w.paused = true; };
    runDay();
    const A = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16); const W = w.wallet; const d = () => w._absDay();
    const rnd0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = rnd0; } };
    const clearF = () => { P.items = (P.items || []).filter(p => !(['fisc_exit', 'fisc_wealth', 'fisc_bond', 'tax', 'law_repeal', 'law_restore'].includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status))); };
    const fresh = () => { clearF(); const S = F.S(w); S.last = {}; S.lastDay = -1; S.used = {}; return S; };
    const setS = (v) => { sp.resources.silver = v; }; const setFx = (v) => { T.S(w).fx = v; };
    const bankOn = () => { const B = w.bank = w.bank || {}; B.open = true; B.status = 'ok'; B.dep = B.dep || {}; B.loans = B.loans || {}; B.bonds = B.bonds || []; if (!w.agents[B.banker]) B.banker = A().find(a => a.job?.key === 'trader')?.agentId || A()[0].agentId; return B; };
    out.ver = RIMTOWN_APP_VERSION; out.kinds = ['fisc_exit', 'fisc_wealth', 'fisc_bond'].every(k => PROPOSAL_KINDS[k]?.icon && t(PROPOSAL_KINDS[k].label)); out.laws = !!(REPEAL.LAWS.fisc_exit && REPEAL.LAWS.fisc_wealth);
    const idx = WALLET.wageIdx(); out.free = { exit: F.exitFree(), wealth: F.wealthFree(), idx };
    // 1) 離境稅
    let S = fresh(); S.exit = 0; setS(1000); out.levyOff = F.levy(w, 'x1', 5000);
    S.exit = d(); const s0 = sp.get('silver'); const l1 = F.levy(w, 'x1', 1200); const l2 = F.levy(w, 'x1', 1000); const l3 = F.levy(w, 'x2', 100);
    out.levy = { l1, l2, l3, exp1: r2((1200 - F.exitFree()) * 0.2), got: r2(sp.get('silver') - s0), st: S.st.exit, n: S.st.exitN };
    // 真的搬走：現金 2000（鎮上沒有銀行時只驗現金）
    S = fresh(); S.exit = d(); S.st = { exit: 0, exitN: 0, wealth: 0, wealthN: 0, hid: 0 };
    const goer = A().find(a => a.job?.key !== 'mayor' && !MARKET.ownedBy(w, a.agentId).length); W.bal[goer.agentId] = 2000; T.S(w).led = {}; const tot0 = MONEY.total(w);
    let left = null; try { left = w.leaveTown(goer.agentId, 'test'); } catch (e) { left = 'ERR ' + e.message; }
    const Lg = T.S(w).led; let prop = 0; for (const D of Object.values(Lg)) prop += D['+tax_prop'] || 0;
    out.leave = { total: r2(tot0 - MONEY.total(w)), left: !!left && !String(left).startsWith('ERR'), gone: !w.agents[goer.agentId] || !!w.agents[goer.agentId]?.isDead, st: F.S(w).st.exit, exp: r2((2000 - F.exitFree()) * 0.2), ledger: r2(prop), balGone: !(goer.agentId in W.bal) };
    // 2) 財產稅
    S = fresh(); S.exit = 0; S.wealth = 0; for (const a of A()) { W.bal[a.agentId] = 50; if (w.bank?.dep) delete w.bank.dep[a.agentId]; }
    const [r1, r3, r4] = A().filter(a => !(a.personality?.traits || []).includes('greedy') && !a.dark?.liar).slice(0, 3); const r2a = A().find(a => ![r1, r3, r4].includes(a)); r2a.personality.traits = [...new Set([...(r2a.personality.traits || []), 'greedy'])];
    const free = F.wealthFree(); W.bal[r1.agentId] = free + 2000; W.bal[r2a.agentId] = free + 2000;
    out.wOff = F.weekly(w);
    S.wealth = d(); const s1 = sp.get('silver'); const got = fix(0.9, () => F.weekly(w));
    out.wealth = { got, exp: r2(20 + 12), treasury: r2(sp.get('silver') - s1), r1: r2(W.bal[r1.agentId] - free), r2: r2(W.bal[r2a.agentId] - free), hid: S.st.hid, st: S.st.wealth, n: S.st.wealthN };
    // 現金不夠，從存款扣
    const B = bankOn(); W.bal[r1.agentId] = 50; W.bal[r2a.agentId] = 50; W.bal[r3.agentId] = 5; B.dep[r3.agentId] = free + 3000; B.reserve = 9000; const s2 = sp.get('silver');
    const got2 = fix(0.9, () => F.weekly(w)); out.wealthDep = { got: got2, exp: r2((5 + free + 3000 - free) * 0.01), cash: W.bal[r3.agentId], dep: r2(free + 3000 - B.dep[r3.agentId]), reserve: r2(9000 - B.reserve), treasury: r2(sp.get('silver') - s2) };
    delete B.dep[r3.agentId]; W.bal[r3.agentId] = 50; S.wealth = 0;
    // 3) 公職薪水倍率
    const M = MARKET.S(w); const own0 = Object.assign({}, M.owners), pay0 = Object.assign({}, M.pay); const ks = Object.keys(MARKET.SECTORS);
    M.owners = {}; out.rate = { none: F.privateRate(w) };
    const bosses = A().slice(0, 4); M.owners = { [ks[0]]: bosses[0].agentId, [ks[1]]: bosses[1].agentId, [ks[2]]: bosses[2].agentId }; M.pay = { [ks[0]]: 0.8, [ks[1]]: 0.9, [ks[2]]: 0.9 }; out.rate.mid = F.privateRate(w);
    M.pay = { [ks[0]]: 0.5, [ks[1]]: 0.5, [ks[2]]: 0.6 }; out.rate.lo = F.privateRate(w); M.pay = { [ks[0]]: 1.4, [ks[1]]: 1.5, [ks[2]]: 1.3 }; out.rate.hi = F.privateRate(w);
    // 一天最多動 0.02；公庫吃緊不加薪
    S = fresh(); S.rate = 1; setFx(100); setS(9000); W.shortDay = -99; w.fullAgentMode = true; // 開著智能體：這裡只看倍率，不要自動成案
    F.daily(w); out.rate.step = S.rate; S.rate = 1.09; S.lastDay = -1; F.daily(w); out.rate.cap = S.rate;
    setS(300); S.rate = 1; S.lastDay = -1; F.daily(w); out.rate.tightUp = S.rate; S.rate = 1.06; S.lastDay = -1; F.daily(w); out.rate.tightDown = S.rate;
    M.pay = { [ks[0]]: 0.8, [ks[1]]: 0.8, [ks[2]]: 0.8 }; S.rate = 1; S.lastDay = -1; F.daily(w); out.rate.down = S.rate;
    w.fullAgentMode = false;
    // 發薪與固定支出都乘上倍率
    M.owners = own0; M.pay = pay0; S.rate = 1; const p1 = T.payroll(w); S.rate = 0.9; const p9 = T.payroll(w); out.pay = { p1, p9, ratio: r2(p9 / p1), min: W.minWage || 0 };
    S.rate = 1; setS(5000); const st = T.staff(w)[0]; const b0 = W.bal[st.agentId] || 0; const seen = []; const c0 = sp.consume; sp.consume = function (r, n, tk, why, src) { const o = c0.call(this, r, n, tk, why, src); if (r === 'silver' && o && why === t('發薪水')) seen.push(n); return o; };
    S.rate = 0.9; S.lastDay = d() + 1; runDay(); sp.consume = c0; out.pay.paid = seen.length ? r2(seen[0]) : null; out.pay.expect = null; S.rate = 1;
    // 6') 占比與能不能設新職位
    T.S(w).led = {}; out.share0 = F.payShare(w); const dd = d(); for (let i = 0; i < 12; i++) T.S(w).led[dd - i] = { '+goods': 100 }; setFx(50); setS(3000);
    const PR1 = T.payroll(w); out.share = { v: F.payShare(w), exp: r2(PR1 / 100), can: F.canHire(w) }; for (let i = 0; i < 12; i++) T.S(w).led[dd - i] = { '+goods': PR1 * 3 }; out.share.lowV = F.payShare(w); out.share.canLow = F.canHire(w); setS(100); out.share.canTight = F.canHire(w);
    // 4) 公債
    S = fresh(); S.bond = null; setFx(100); setS(200); B.dep = {}; for (const a of A().slice(0, 5)) B.dep[a.agentId] = 1000; B.reserve = 3100; out.bond = { thin: F.bondOffer(w) }; // 準備金只比六成多一點：借不到一百
    B.reserve = 9000; out.bond.offer = F.bondOffer(w); // 15 天固定支出＝1500，銀行多出來的一半＝3000 → 1500
    const mayor = A().find(a => a.job?.key === 'mayor') || A()[0]; const pb = F.propose(w, 'fisc_bond', mayor, '');
    out.bond.prop = { made: !!pb, kind: pb?.kind, amt: pb?.amt, title: pb ? P.title(pb) : '', desc: pb ? P._fill(pb.dk, pb.dp).slice(0, 200) : '', major: (() => { const lv0 = TIERS.S(w).lv; try { TIERS.S(w).lv = 1; return ASSEMBLY.isMajor(w, pb); } finally { TIERS.S(w).lv = lv0; } })() };
    const res0 = B.reserve, sil0 = sp.get('silver'), tot1 = MONEY.total(w); P._decide(w, pb, 'approve', 'mayor'); if (pb.status === 'approved') P._execute(w, pb, d());
    out.bond.done = { status: pb.status, owed: S.bond?.owed, reserve: r2(res0 - B.reserve), silver: r2(sp.get('silver') - sil0), total: r2(MONEY.total(w) - tot1), debt: T.debt(w), again: F.bondOffer(w) };
    // 吃緊：只付利息；緩過來：付利息＋還本
    setS(300); const o1 = S.bond.owed, rv1 = B.reserve; F.bondDaily(w); out.bond.low = { owed: S.bond.owed === o1, int: r2(B.reserve - rv1), exp: r2(o1 * 0.0008) };
    setS(5000); const o2 = S.bond.owed, rv2 = B.reserve, sl2 = sp.get('silver'); F.bondDaily(w); out.bond.back = { paid: r2(o2 - S.bond.owed), exp: r2(Math.max(3, o2 * 0.03)), reserve: r2(B.reserve - rv2), silver: r2(sl2 - sp.get('silver')) };
    S.bond.owed = 2; F.bondDaily(w); out.bond.closed = S.bond === null;
    // 5) 沒開智能體：什麼時候有人提
    const cnt = (k) => P.items.filter(p => p.kind === k && p.status === 'open').length;
    S = fresh(); S.exit = 0; S.wealth = 0; S.bond = null; setFx(100); setS(9000); W.shortDay = -99; W.tax = 0.05; for (const a of A()) W.bal[a.agentId] = 50; w.money.days = {};
    F.daily(w); out.trig = { calm: cnt('fisc_exit') + cnt('fisc_wealth') + cnt('fisc_bond') };
    w.money.days[d() - 3] = { emigrant: -5000 }; S.lastDay = -1; w.fullAgentMode = true; F.daily(w); out.trig.exitAgent = cnt('fisc_exit'); w.fullAgentMode = false; S.lastDay = -1; F.daily(w); out.trig.exit = cnt('fisc_exit'); out.trig.exitDesc = (() => { const p = P.items.find(x => x.kind === 'fisc_exit' && x.status === 'open'); return p ? P._fill(p.dk, p.dp).slice(0, 160) : ''; })();
    S = fresh(); w.money.days = {}; setS(300); const big = A()[0]; W.bal[big.agentId] = F.wealthFree() * 6; W.tax = 0.05; F.daily(w); out.trig.wealthLowTax = cnt('fisc_wealth'); W.tax = 0.12; S.lastDay = -1; B.reserve = 0; F.daily(w); out.trig.wealth = cnt('fisc_wealth');
    S = fresh(); W.bal[big.agentId] = 50; B.reserve = 9000; W.shortDay = d(); setS(50); F.daily(w); out.trig.bond = cnt('fisc_bond'); W.shortDay = -99;
    // 6) 投票
    S = fresh(); setS(300); B.dep = {}; for (const a of A()) W.bal[a.agentId] = 50; const pe = F.propose(w, 'fisc_exit', A()[5], ''); const rich = A()[6], pub = A().find(a => MARKET.PUBLIC.includes(a.job?.key) && a.job.key !== 'mayor' && !MARKET.privatePaid(w, a) && a !== A()[5] && a !== rich); W.bal[rich.agentId] = F.wealthFree() * 3;
    const vt = (p, a) => { delete p.votes[a.agentId]; P._ruleVote(w, p, a); return { v: p.votes[a.agentId], why: p.why?.[a.agentId] }; };
    out.vote = { mine: vt(pe, A()[5]), richExit: vt(pe, rich), pubExit: vt(pe, pub) }; P._decide(w, pe, 'reject', 'mayor');
    S = fresh(); const pw = F.propose(w, 'fisc_wealth', A()[5], ''); out.vote.richWealth = vt(pw, rich); out.vote.pubWealth = vt(pw, pub); out.vote.why = ['fisc_rich', 'fisc_pay', 'fisc_fair', 'fisc_town', 'fisc_bank'].every(k => typeof VOTE_WHY[k] === 'string' && t(VOTE_WHY[k]).length > 3);
    // 7) 通過 → 成為規定 → 可以廢除、恢復
    P._decide(w, pw, 'approve', 'mayor'); if (pw.status === 'approved') P._execute(w, pw, d()); out.law = { status: pw.status, on: F.on(w, 'fisc_wealth'), live: REPEAL.view(w).live.some(x => x.id === 'fisc_wealth') };
    const pr = REPEAL.propose(w, 'fisc_wealth', rich, 'law_repeal'); out.law.repealMade = !!pr; if (pr) { out.law.richVote = vt(pr, rich).v; P._decide(w, pr, 'approve', 'mayor'); if (pr.status === 'approved') P._execute(w, pr, d()); }
    out.law.off = !F.on(w, 'fisc_wealth'); out.law.quiet = F.okNow(w, 'fisc_wealth', false) === false; out.law.set = !!REPEAL.LAWS.fisc_wealth.set(w) && F.on(w, 'fisc_wealth'); F.S(w).wealth = 0;
    // 智能體
    S = fresh(); w.repeal = null; S.exit = 0; S.wealth = 0; S.bond = null; setS(300); B.reserve = 9000; w.fullAgentMode = true; const eng = w.conversationEngine; const ok0 = eng.fullAgentOk; eng.fullAgentOk = () => true; const ask0 = eng._askJson; let prompts = []; eng._askJson = async (p) => { prompts.push(p); return { skip: true }; };
    await eng.inventProposal(w, A()[7], []); const pt = prompts[0] || ''; const PP = F.promptParts(w);
    out.ai = { ctx: !!PP.ctx && pt.includes(PP.ctx.trim()), fx: pt.includes('"type":"fiscal"'), codes: ['fisc_exit', 'fisc_wealth', 'fisc_bond'].every(k => pt.includes(k)), len: pt.length };
    eng._askJson = ask0; const inv0 = eng.inventProposal; eng.inventProposal = async () => ({ title: 'x', pitch: '搬走的人把錢都帶走了，鎮上什麼都沒留下。', category: 'economy', effects: [{ type: 'fiscal', key: 'fisc_exit' }] });
    const n0 = P.items.length; await P._inventLLM(w, d(), A()[7], () => {}, []); const pa = P.items.find(p => p.kind === 'fisc_exit' && p.status === 'open'); out.ai.made = P.items.length - n0; out.ai.llm = !!pa?.llm; out.ai.pitch = !!pa?.pitch;
    out.ai.busy = F.fromAI(w, A()[8], { effects: [{ type: 'fiscal', key: 'fisc_wealth' }] }) === null; out.ai.busyPrompt = F.promptParts(w).ctx === '';
    clearF(); S.last = {}; out.ai.bad = F.fromAI(w, A()[8], { effects: [{ type: 'fiscal', key: 'fisc_nothing' }] }) === null; S.exit = d(); out.ai.onPrompt = !F.promptParts(w).ctx.includes('fisc_exit'); out.ai.onNull = F.fromAI(w, A()[8], { effects: [{ type: 'fiscal', key: 'fisc_exit' }] }) === null; S.exit = 0;
    eng.inventProposal = inv0; eng.fullAgentOk = ok0; w.fullAgentMode = false;
    // 8) 卡片
    S.exit = d(); S.st.exit = 321; S.bond = { owed: 800, n: 1000, day: d(), paid: 200, int: 5 }; setFx(100); setS(2000);
    app._icAlerts = null; const el = document.createElement('div'); el.innerHTML = app._icTreasury(); out.card = el.textContent.replace(/\s+/g, ' ');
    // 最低工資提案的舊錯：成案之前有人丟了工作也不會出錯
    let mw = 'none'; try { W.minWage = 0; W.tax = 0.3; for (const a of A()) W.bal[a.agentId] = 3; P._cd = {}; clearF(); const cands = P._candidates(w, d()) || []; const c = cands.find(x => x.kind === 'minwage'); if (c) { const lost = A().filter(a => WALLET.WAGE[a.job?.key]).slice(0, 6); const keep = lost.map(a => a.job); lost.forEach(a => { a.job = null; }); try { const m = c.make(); mw = (m && m.dp && Number.isFinite(m.dp.y) && m.dp.n > 0) ? 'ok' : 'bad'; } finally { lost.forEach((a, i) => { a.job = keep[i]; }); } } } catch (e) { mw = 'ERR ' + e.message; }
    out.minwage = mw; W.tax = 0.1;
    // 存讀檔
    const data = JSON.parse(JSON.stringify(w.serialize())); w.fiscal = null; w.loadSave(data); out.save = { exit: !!w.fiscal?.exit, bond: w.fiscal?.bond?.owed === 800, st: w.fiscal?.st?.exit === 321 };
    return out;
  });
  const zh = lang === 'zh'; const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
  ok(/^\d+\.\d+\.\d+$/.test(r.ver) && r.kinds && r.laws, '模組載入：三種提案有圖示與名稱，兩種稅登記成可以廢除的規定', { v: r.ver, k: r.kinds, l: r.laws });
  ok(r.levyOff === 0, '離境稅沒開徵：不收', r.levyOff);
  ok(near(r.levy.l1, r.levy.exp1) && near(r.levy.l2, 200) && r.levy.l3 === 0 && near(r.levy.got, r.levy.l1 + r.levy.l2) && r.levy.n === 2, '開徵後：超過免稅額的部分留兩成；同一個人現金與存款共用一份免稅額；沒超過不收', r.levy);
  { const carried = r.leave.total + r.leave.st; // 離開前會先賣掉家當，身上可能比 2000 多一點
    ok(r.leave.left && r.leave.gone && r.leave.balGone && carried >= 2000 && near(r.leave.st, (carried - r.free.exit) * 0.2, 0.05) && near(r.leave.ledger, r.leave.st), '真的有人帶著兩千多搬走：公庫進帳兩成的離境稅，全鎮少掉的只有他真的帶走的', r.leave); }
  ok(r.wOff === 0, '財產稅沒開徵：不收', r.wOff);
  ok(near(r.wealth.got, r.wealth.exp) && near(r.wealth.treasury, r.wealth.exp) && near(r.wealth.r1, 1980) && near(r.wealth.r2, 1988) && near(r.wealth.hid, 8) && r.wealth.n === 2, '財產稅：超過門檻的部分繳 1%；不老實的少報四成，少繳的有記下來', r.wealth);
  ok(near(r.wealthDep.got, r.wealthDep.exp) && r.wealthDep.cash === 0 && near(r.wealthDep.dep, r.wealthDep.exp - 5) && near(r.wealthDep.reserve, r.wealthDep.exp - 5) && near(r.wealthDep.treasury, r.wealthDep.exp), '現金不夠：從存款扣，銀行準備金跟著少', r.wealthDep);
  ok(r.rate.none === 1 && r.rate.mid === 0.9 && r.rate.lo === 0.8 && r.rate.hi === 1.1, '民間行情：老闆不到三家照原價；取中位數；限制在 0.8～1.1', r.rate);
  ok(r.rate.step === 1.02 && r.rate.cap === 1.1 && r.rate.tightUp === 1 && r.rate.tightDown === 1.04 && r.rate.down === 0.98, '公職薪水倍率一天最多動 0.02；公庫吃緊時不跟著加薪、慢慢降回原價', r.rate);
  ok(r.pay.min > 0 ? r.pay.ratio >= 0.9 && r.pay.ratio <= 1 : near(r.pay.ratio, 0.9, 0.005), '公庫的固定支出照倍率算', r.pay);
  ok(r.pay.paid !== null && r.pay.paid > 0 && r.pay.paid < r.pay.p1 + 0.5, '發薪照倍率發', r.pay);
  ok(r.share0 === null && near(r.share.v, r.share.exp) && r.share.can === false && r.share.lowV < 0.6 && r.share.canLow === true && r.share.canTight === false, '公職薪水占收入：帳不滿十天不判斷；超過六成或公庫吃緊就不該再設新職位', { s0: r.share0, s: r.share });
  ok(r.bond.thin === 0 && r.bond.offer === 1500, '公債：銀行留得住六成準備金才借；借 15 天的固定支出', r.bond);
  ok(r.bond.prop.made && r.bond.prop.kind === 'fisc_bond' && r.bond.prop.amt === 1500 && r.bond.prop.major && (zh ? /1500/.test(r.bond.prop.title) && /每天付利息/.test(r.bond.prop.desc) : /1500/.test(r.bond.prop.title) && /interest/.test(r.bond.prop.desc)), '公債是一般提案，城鎮以上要先過議會，說明寫出金額與代價', r.bond.prop);
  ok(r.bond.done.status === 'done' && r.bond.done.owed === 1500 && r.bond.done.reserve === 1500 && r.bond.done.silver === 1500 && near(r.bond.done.total, 0) && r.bond.done.debt > 40 && r.bond.done.again === 0, '通過後錢從銀行到公庫（全鎮的錢沒有變多），算進固定支出，還清前不能再借', r.bond.done);
  ok(r.bond.low.owed && near(r.bond.low.int, r.bond.low.exp), '公庫吃緊：只付利息，不還本', r.bond.low);
  ok(near(r.bond.back.paid, r.bond.back.exp) && near(r.bond.back.silver, r.bond.back.reserve) && r.bond.back.reserve > r.bond.back.paid, '公庫緩過來：付利息也還本，錢回到銀行', r.bond.back);
  ok(r.bond.closed, '還清後結案', r.bond.closed);
  ok(r.trig.calm === 0, '平常沒有人提', r.trig);
  ok(r.trig.exitAgent === 0 && r.trig.exit === 1 && (zh ? /帶走了 5000/.test(r.trig.exitDesc) : /5000/.test(r.trig.exitDesc)), '有人帶著大筆錢搬走以後才有人提離境稅；開了智能體就不自動提', r.trig);
  ok(r.trig.wealthLowTax === 0 && r.trig.wealth === 1, '財產稅：公庫吃緊、所得稅已到一成、錢又集中，才有人提', r.trig);
  ok(r.trig.bond === 1, '發不出薪水：有人提公債', r.trig);
  ok(r.vote.mine.v === 'for' && r.vote.richExit.v === 'against' && r.vote.richExit.why === 'fisc_rich' && r.vote.pubExit.v === 'for' && r.vote.pubExit.why === 'fisc_pay', '離境稅：提的人贊成、有錢人反對、領公庫薪水的人在公庫吃緊時贊成', r.vote);
  ok(r.vote.richWealth.v === 'against' && r.vote.pubWealth.v === 'for' && r.vote.why, '財產稅：要繳的人反對；理由都有文字', r.vote);
  ok(r.law.status === 'done' && r.law.on && r.law.live, '通過後成為鎮上的規定', r.law);
  ok(r.law.repealMade && r.law.richVote === 'for' && r.law.off && r.law.quiet && r.law.set, '可以再表決廢除（要繳的人贊成廢除）；剛廢除的先不再提；也可以恢復', r.law);
  ok(r.ai.ctx && r.ai.fx && r.ai.codes && r.ai.len < (zh ? 5700 : 17000), '發想提案的題目列出還沒有的財源，長度在上限內', r.ai);
  ok(r.ai.made === 1 && r.ai.llm && r.ai.pitch, 'AI 回 fiscal 效果 → 開成正式提案', r.ai);
  ok(r.ai.busy && r.ai.busyPrompt && r.ai.bad && r.ai.onPrompt && r.ai.onNull, '已有一件在表決、代碼不對、已經開徵的，都不成案也不再列', r.ai);
  ok(zh ? /其他財源與公職薪水/.test(r.card) && /已開徵，至今收了 321/.test(r.card) && /還欠銀行 800/.test(r.card) && /公職薪水倍率/.test(r.card) : /Other income and public pay/.test(r.card) && /321 collected/.test(r.card) && /800 owed/.test(r.card), '公庫卡多一段：兩種稅、公債、公職薪水倍率', r.card.slice(-420));
  ok(zh ? !/[A-Za-z]{6,}/.test(r.card.replace(/plank|silver/g, '')) : !/[一-鿿]/.test(r.card), '卡片沒有漏翻', zh ? r.card.match(/[A-Za-z]{6,}/g) : (r.card.match(/[一-鿿]+/g) || []).slice(0, 6));
  ok(r.minwage === 'ok' || r.minwage === 'none', '最低工資提案：成案之前有人丟了工作也不會出錯', r.minwage);
  ok(r.save.exit && r.save.bond && r.save.st, '存讀檔後紀錄還在', r.save);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
