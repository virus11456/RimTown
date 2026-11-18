// v11.12.0 公庫吃緊時怎麼辦由首長決定（選擇點 fiscTight，sim-fiscal.js／sim-decide-pol.js）＋公債借太多失去信任＋銀行家借不借（bankDesk 的 t:'bond'）
//   A) 什麼時候問、問誰：公庫吃緊（監管職位因為公庫吃緊空著，或村莊連續 5 天不到 10 天）問首長；十天一次；同類的案在表決、首長不在、決策核心沒開都不問
//   B) 事實裡的數字跟 TREASURY.view、FISCAL.view、OFFICE 對得上；做不到的選項不列，事實寫原因
//   C) 每個選項的後果：先撐著（介面寫首長的理由）、只放行稅務員、借錢（銀行家點頭→表決→錢進公庫→每天還本付息，錢守恆）、加稅提案；被否決有紀錄、下次寫進事實
//   D) 照個性：幾種首長 × 幾種公庫狀況；E) AI 路（假 AI）；F) 作廢、存讀檔、英文沒有中文
//   G) 負擔等級門檻、個人差異、公債提案贊成比例隨等級下降、銀行家太重不借、首長太重不選借、還清回復、國王民心、存戶擠兌事實
//   H) 放著跑 60 天沒有錯誤、帳上對不上的錢是 0
// 用法：BASE=http://localhost:8197/ node scripts/v111200_test.js
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8181/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Fiscal\]|\[Decide\]|\[Bank\]|\[Office\]|\[Proposals\]/.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 200)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  await page.addScriptTag({ path: __dirname + '/v111200_setup.js' });
  const r = await page.evaluate(async (zh) => {
    const F0 = window.__fisc; const out = {}; const texts = []; const R0 = Math.random;
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const K = () => DECIDE.KINDS.fiscTight; const idsOf = (ops) => ops.map(o => String(o.id));
    const pickOf = (w, a, ops) => { const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id) : null; };
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, why: tx(o.why), res: tx(o.res) }); });
    const fresh = (w, M) => { const X = FISCAL.TT(w); X.last = -99; X.pend = null; X.dec = null; X.tax = null; X.run = 0; for (const p of w.proposals.items) if (['open', 'shelved', 'approved'].includes(p.status) && ['tax', 'fisc_bond', 'office_appoint'].includes(p.kind)) { p.status = 'rejected'; p.resolvedDay = w._absDay() - 30; } FISCAL.S(w).bankAsk = null; FISCAL.S(w).bankNo = null; FISCAL.S(w).last.fisc_bond = -999; CIVIC.S(w).lastTax = w._absDay() - 22; DECIDE.S(w).q.length = 0; };
    const ctxNow = (w, M) => { const X = FISCAL.TT(w); X.tok = (X.tok || 0) + 1; X.last = w._absDay(); const c = { d: w._absDay(), tok: X.tok }; X.pend = { d: c.d, tok: X.tok, by: M.agentId }; return c; };
    const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
    const MM = () => MONEY.S(window.rimtownApp.world); const leak = (w, fn) => { const T0 = MONEY.total(w), P0 = MONEY.S(w).pend; const ret = fn(); return { leak: Math.round(((MONEY.total(w) - T0) - (MONEY.S(w).pend - P0)) * 1000) / 1000, ret }; };
    const passIt = (w, p) => { w.proposals._decide(w, p, 'approve', 'mayor'); return p.status; };
    const openOf = (w, kind) => w.proposals.items.filter(p => p.kind === kind && ['open', 'shelved', 'approved'].includes(p.status));

    // ============ A 登記與時機 ============
    let S = F0.setup(11); let { w, M, BK } = S; const A = {};
    A.reg = { has: !!K(), group: K()?.aiGroup, scan: K()?.scan, title: t(K()?.title || '') }; texts.push(A.reg.title);
    A.blocked = FISCAL.blocked(w).join(); A.low = TREASURY.low(w); A.canHire = FISCAL.canHire(w);
    { const n0 = seen.length; const c = FISCAL.tightDaily(w); A.ask = { c: !!c, who: seen.slice(n0).find(e => e.kind === 'fiscTight')?.who === M.agentId, n: seen.slice(n0).filter(e => e.kind === 'fiscTight').length };
      const c2 = FISCAL.tightDaily(w); A.gap = !c2; FISCAL.TT(w).last = w._absDay() - 9; A.gap9 = !FISCAL.tightDaily(w); { const lst = w._absDay() - 10; fresh(w, M); FISCAL.TT(w).last = lst; } A.gap10 = !!FISCAL.tightDaily(w); }
    // 首長不在、決策核心沒開、同類的案在表決
    { fresh(w, M); const loc = M.currentLocation; M.currentLocation = 'exploration'; A.away = !FISCAL.tightDaily(w); M.currentLocation = loc;
      fresh(w, M); const on0 = DECIDE.on; DECIDE.on = () => false; A.off = !FISCAL.tightDaily(w); DECIDE.on = on0;
      fresh(w, M); const p = CIVIC.taxUp(w, BK); A.taxOpen = !!p && !FISCAL.tightDaily(w); if (p) { p.status = 'rejected'; p.resolvedDay = w._absDay(); } CIVIC.S(w).lastTax = w._absDay() - 22;
      fresh(w, M); const pb = FISCAL.propose(w, 'fisc_bond', BK, ''); A.bondOpen = !!pb && !FISCAL.tightDaily(w); if (pb) pb.status = 'rejected'; FISCAL.S(w).last.fisc_bond = -999;
      // 公庫回到門檻以上：不問
      fresh(w, M); const s0 = w.stockpile.resources.silver; w.stockpile.resources.silver = Math.round(TREASURY.fixed(w) * 12); A.notLow = !TREASURY.low(w) && FISCAL.blocked(w).length === 0 && !FISCAL.tightDaily(w); w.stockpile.resources.silver = s0;
      // 村莊（沒有監管職位）：要連續 5 天不到 10 天才問
      fresh(w, M); const lv0 = TIERS.S(w).lv; TIERS.S(w).lv = 0; if (w.tierState) w.tierState.lv = 0; const got = []; for (let i = 0; i < 6; i++) { FISCAL.TT(w).runDay = null; got.push(!!FISCAL.tightDaily(w)); w._absDayOrig = w._absDayOrig || w._absDay; const dd = w._absDay() + 1; w._absDay = () => dd; } w._absDay = w._absDayOrig; delete w._absDayOrig; A.village = got.join(); TIERS.S(w).lv = lv0; if (w.tierState) w.tierState.lv = lv0; }
    out.A = A;

    // ============ B 事實裡的數字 ============
    S = F0.setup(12); ({ w, M, BK } = S); const B = {};
    { const c = ctxNow(w, M); const f = K().facts(w, M, c); texts.push(f); const V = TREASURY.view(w); const FV = FISCAL.view(w); const I = FISCAL.tightInfo(w); const ops = K().options(w, M, c); for (const o of ops) texts.push(tx(o.text), tx(o.say), tx(o.why));
      const n = FV.bondOffer; const Y = OFFICE.taxYield(w); const need = V.LOW_DAYS * V.fixed - V.silver; const net = V.ledger.inSum - V.ledger.outSum;
      B.facts = f; B.nums = { silver: f.includes(String(V.silver)), fixed: f.includes(String(Math.round(V.fixed))), days: f.includes(String(V.days)), inc: f.includes(String(Math.round(V.ledger.inSum))), out: f.includes(String(Math.round(V.ledger.outSum))), back: I.back === Math.ceil(need / net) && f.includes(String(I.back)),
        bond: n > 0 && f.includes(String(n)), int: f.includes(String(Math.round(n * 0.0008 * 100) / 100)), tax: f.includes('2%') || f.includes('2 %'), rej: f.includes(zh ? '2 次加稅提案被否決' : '2 tax increase'), pay: f.includes(String(Y.pay)), yield: f.includes(String(Math.round(Y.week))), blocked: FISCAL.blocked(w).length === 3 };
      B.ids = idsOf(ops).join(); B.Y = Y; B.n = n;
      // 稅務員的估算：照 inspect 的規則（貪心、看重財富、愛說謊的東家六成查得到，追回現金的 6%，8～80）
      { const ts = OFFICE.targets(w, null, 'tax'); const has = (a, x) => (a.personality?.traits || []).includes(x); const ev = ts.map(x => (has(x.o, 'greedy') || (x.o.personality?.values || []).includes('財富') || x.o.dark?.liar) ? 0.6 * Math.max(8, Math.min(80, Math.round(WALLET.get(w, x.o) * 0.06))) : 0); const per = ev.length ? ev.reduce((s, v) => s + v, 0) / ev.length : 0; B.yieldOk = near(Y.week, per * Math.min(Y.left, ts.length), 0.05) && Y.pay === OFFICE.stipend(w); }
      // 結餘是負的：寫回不來
      const L0 = JSON.stringify(TREASURY.S(w).led); for (const k of Object.keys(TREASURY.S(w).led)) TREASURY.S(w).led[k]['-pay'] = TREASURY.S(w).led[k]['+tax_income'] * 1.15; const f2 = K().facts(w, M, c); B.neg = { back: FISCAL.tightInfo(w).back === null, text: f2.includes(t('照最近的結餘，公庫自己回不到 {lo} 天的門檻。').replace('{lo}', '10')), wait: tx(K().options(w, M, c).find(o => o.id === 'wait').text) }; texts.push(f2); TREASURY.S(w).led = JSON.parse(L0);
      // 做不到的選項：銀行家出遠門（bondOffer 回 0）
      const bk = w.agents[BK.agentId]; delete w.agents[BK.agentId]; const f3 = K().facts(w, M, c); B.away = { ids: idsOf(K().options(w, M, c)).join(), why: f3.includes(t('銀行家出遠門了，沒有人可以談')), offer: FISCAL.bondOffer(w) }; w.agents[BK.agentId] = bk; texts.push(f3);
      // 已經有一筆公債沒還完
      FISCAL.S(w).bond = { owed: 900, n: 1000, day: w._absDay() - 30, paid: 100, int: 3 }; const f4 = K().facts(w, M, c); B.owed = { ids: idsOf(K().options(w, M, c)).join(), why: f4.includes(t('還有一筆公債沒還完（還欠 {n} 銀幣）').replace('{n}', '900')) }; FISCAL.S(w).bond = null;
      // 60 天內提過
      FISCAL.S(w).last.fisc_bond = w._absDay() - 20; const f5 = K().facts(w, M, c); B.gap = { ids: idsOf(K().options(w, M, c)).join(), why: f5.includes(t('{n} 天前才提過借錢，要隔 {g} 天才能再提').replace('{n}', '20').replace('{g}', '60')) }; FISCAL.S(w).last.fisc_bond = -999;
      // 稅率 25%：不能加稅；已經有稅務員：不列補稅務員
      w.wallet.tax = 0.25; B.taxMax = { ids: idsOf(K().options(w, M, c)).join(), why: K().facts(w, M, c).includes(t('稅率已經 {t}%，不能再加').replace('{t}', '25')) }; w.wallet.tax = 0.02;
      const cand = OFFICE.candidates(w, M, 'tax')[0].a; OFFICE.seat(w, 'tax', cand, M); B.hasTax = { ids: idsOf(K().options(w, M, c)).join(), blocked: FISCAL.blocked(w).join() }; OFFICE.vacate(w, 'tax', 'test'); }
    out.B = B;

    // ============ C 每個選項的後果 ============
    const C = {};
    // C1 先撐著：介面那一行寫首長決定先撐著＋理由；決定紀錄看得到
    S = F0.setup(13); ({ w, M, BK } = S); { const c = ctxNow(w, M); const op = K().options(w, M, c).find(o => o.id === 'wait'); DECIDE.askNow(w, []); // 走決策核心記錄
      const n0 = seen.length; DECIDE.enqueue(w, M, 'fiscTight', c); const keep = []; Math.random = () => 0.5; const ops0 = K().options; DECIDE.KINDS.fiscTight.options = (w2, a2, c2) => ops0.call(DECIDE.KINDS.fiscTight, w2, a2, c2).filter(o => o.id === 'wait'); try { DECIDE.drain(w, DECIDE.S(w), w._absDay()); } finally { DECIDE.KINDS.fiscTight.options = ops0; Math.random = R0; }
      const ov = OFFICE.view(w); const row = ov.wanted.find(x => x.post === 'market'); C.wait = { dec: FISCAL.view(w).tight.dec?.pick, why: FISCAL.view(w).tight.dec?.why, row: row?.why?.t, k: row?.why?.k, log: DECIDE.view(w, M).rows.some(x => x.kind === t('公庫吃緊，首長怎麼辦')) };
      texts.push(C.wait.row || '');
      // 介面：規定與官員卡片那一行
      const box = document.createElement('div'); document.body.appendChild(box); let html = ''; try { const app = window.rimtownApp; app.state = w.getState(); html = app._ppMarket ? String(app._ppMarket() || '') : ''; } catch (e) { html = 'ERR ' + e.message; } box.remove(); { const dv = document.createElement('div'); dv.innerHTML = html; html = dv.textContent; } C.wait.html = html.includes(C.wait.row || '@@'); C.wait.htmlLen = html.length;
      // 公庫回到門檻：下次問時事實寫上次的結果
      w.stockpile.resources.silver = Math.round(TREASURY.fixed(w) * 11); FISCAL.TT(w).runDay = null; FISCAL.tightDaily(w); C.wait.res = FISCAL.view(w).tight.dec?.res; w.stockpile.resources.silver = Math.round(TREASURY.fixed(w) * 5.8);
      FISCAL.TT(w).last = -99; FISCAL.TT(w).pend = null; const c2 = ctxNow(w, M); const f = K().facts(w, M, c2); C.wait.past = f.includes(t('先撐著')) && f.includes(C.wait.res || '@@'); texts.push(f); }
    // C2 先補稅務員：只放行稅務員
    S = F0.setup(14); ({ w, M, BK } = S); { const c = ctxNow(w, M); const op = K().options(w, M, c).find(o => o.id === 'taxman'); const q0 = DECIDE.S(w).q.length; const _dr = DECIDE.drain; DECIDE.drain = () => {}; let res; try { res = op.run(w, M); } finally { DECIDE.drain = _dr; }
      const q = DECIDE.S(w).q.slice(q0); C.taxman = { res: tx(res), q: q.map(x => x.kind + ':' + x.ctx?.post).join(), ok: FISCAL.taxmanOk(w), hire: FISCAL.canHire(w) };
      // 第二天補人：只提名稅務員（另外兩個職位照樣空著）；先清掉剛排的題目
      DECIDE.S(w).q.length = 0; const O = OFFICE.S(w); O.lastNom = {}; O.lastDay = null; DECIDE.drain = () => {}; try { OFFICE.daily(w); } finally { DECIDE.drain = _dr; } C.taxman.daily = DECIDE.S(w).q.filter(x => x.kind === 'officeNominate').map(x => x.ctx.post).join();
      DECIDE.S(w).q.length = 0; const ov = OFFICE.view(w); C.taxman.rowTax = ov.wanted.find(x => x.post === 'tax').why?.k; C.taxman.rowMarket = ov.wanted.find(x => x.post === 'market').why?.k;
      // 提名、同意之後上任，津貼算進固定支出
      const cand = OFFICE.candidates(w, M, 'tax')[0].a; const p = OFFICE.nominate(w, M, 'tax', cand); C.taxman.rowNom = OFFICE.view(w).wanted.find(x => x.post === 'tax').why?.k; passIt(w, p); C.taxman.seat = OFFICE.holder(w, 'tax') === cand; FISCAL.TT(w).runDay = null; FISCAL.tightDaily(w); C.taxman.res2 = FISCAL.view(w).tight.dec?.res; C.taxman.market = !OFFICE.holder(w, 'market') && !OFFICE.holder(w, 'health'); }
    // C3 向銀行借：銀行家點頭 → 提案 → 通過 → 錢進公庫 → 每天還本付息；錢守恆
    S = F0.setup(15); ({ w, M, BK } = S); { const c = ctxNow(w, M); const op = K().options(w, M, c).find(o => o.id === 'bond'); const res0 = w.bank.reserve, s0 = w.stockpile.get('silver'); const n0 = seen.length;
      const L1 = leak(w, () => steady(() => { const ops0 = BANK.deskOptions; return op.run(w, M); })); const bk = seen.slice(n0).find(e => e.kind === 'bankDesk'); const p = openOf(w, 'fisc_bond')[0];
      C.bond = { res: tx(L1.ret), bank: bk?.id, by: bk?.who === BK.agentId, prop: !!p, amt: p?.amt, bankBy: p?.bankBy === BK.agentId, pid: FISCAL.view(w).tight.dec?.pid === p?.id, leak1: L1.leak };
      const L2 = leak(w, () => passIt(w, p)); C.bond.pass = { st: p.status, silver: Math.round(w.stockpile.get('silver') - s0), reserve: Math.round(res0 - w.bank.reserve), owed: FISCAL.view(w).bond?.owed, leak: L2.leak, hist: FISCAL.S(w).hist.length };
      // 每天：先付利息；公庫夠 10 天以上就還本
      const b = FISCAL.S(w).bond; const owed0 = b.owed, r0 = w.bank.reserve, sv0 = w.stockpile.get('silver'); const L3 = leak(w, () => FISCAL.bondDaily(w)); C.bond.day = { int: Math.round((b.int || 0) * 100) / 100, paid: Math.round((owed0 - (FISCAL.S(w).bond?.owed ?? 0)) * 100) / 100, toBank: Math.round((w.bank.reserve - r0) * 100) / 100, fromTown: Math.round((sv0 - w.stockpile.get('silver')) * 100) / 100, leak: L3.leak, low: TREASURY.low(w) };
      FISCAL.TT(w).runDay = null; FISCAL.tightDaily(w); C.bond.res2 = FISCAL.view(w).tight.dec?.res;
      // 銀行家不借：提案不成立、首長那邊留紀錄、下次寫進事實
      S = F0.setup(16); ({ w, M, BK } = S); const c2 = ctxNow(w, M); const op2 = K().options(w, M, c2).find(o => o.id === 'bond'); const d0 = BANK.deskOptions; BANK.deskOptions = (w2, b2, cx) => d0.call(BANK, w2, b2, cx).filter(o => o.id === 'refuse'); let r2; try { r2 = op2.run(w, M); } finally { BANK.deskOptions = d0; }
      C.bond.no = { prop: openOf(w, 'fisc_bond').length, res: FISCAL.view(w).tight.dec?.res, bank: FISCAL.view(w).tight.dec?.bank, bankNo: FISCAL.S(w).bankNo === w._absDay(), mem: (M.memory?.entries || []).some(m => String(m.content || '').includes(t(BK.name)) || String(m.content || '').includes(BK.name)), offer: FISCAL.okNow(w, 'fisc_bond', false) };
      FISCAL.TT(w).last = -99; FISCAL.TT(w).pend = null; const c3 = ctxNow(w, M); const f = K().facts(w, M, c3); C.bond.no.past = f.includes(C.bond.no.res || '@@') && f.includes(t('銀行家 {n} 天前才拒絕借錢給公庫').replace('{n}', '0')) && !idsOf(K().options(w, M, c3)).includes('bond'); texts.push(f);
      // 銀行家那一題的事實
      FISCAL.S(w).bankNo = null; const BF = FISCAL.S(w); BF.bankTok = 77; BF.bankAsk = { d: w._absDay(), tok: 77, by: M.agentId, why: '', src: 'tight', n: FISCAL.bondOffer(w) }; const bf = FISCAL.bankFacts(w, BK, { t: 'bond', tok: 77 }); texts.push(bf); for (const o of FISCAL.bankOptions(w, BK, { t: 'bond', tok: 77 })) texts.push(tx(o.text), tx(o.say), tx(o.why));
      C.bond.bf = { pct: bf.includes(String(Math.round(BF.bankAsk.n / w.bank.reserve * 100)) + '%'), lv: bf.includes(t('輕')), rec: bf.includes(t('公庫以前沒有跟銀行借過錢')), ids: idsOf(FISCAL.bankOptions(w, BK, { t: 'bond', tok: 77 })).join(), wrongTok: FISCAL.bankOptions(w, BK, { t: 'bond', tok: 78 }).length, notBanker: FISCAL.bankOptions(w, M, { t: 'bond', tok: 77 }).length }; BF.bankAsk = null; }
    // C4 提案加稅：走原本的稅率提案、照樣投票；被否決有紀錄
    S = F0.setup(17); ({ w, M, BK } = S); { const c = ctxNow(w, M); const op = K().options(w, M, c).find(o => o.id === 'tax'); const res = op.run(w, M); const p = openOf(w, 'tax')[0];
      C.tax = { res: tx(res), prop: !!p, newTax: p?.newTax, dir: p?.dir, by: p?.proposerId === M.agentId, pid: FISCAL.view(w).tight.dec?.pid === p?.id };
      w.proposals._decide(w, p, 'reject', 'mayor'); FISCAL.TT(w).runDay = null; FISCAL.tightDaily(w); C.tax.res2 = FISCAL.view(w).tight.dec?.res; C.tax.log = (w.messageLog || []).slice(-6).some(m => String(m.content || World.logText(m)).includes(C.tax.res2 || '@@'));
      // 照樣投票：沒開 AI 的投票照 CIVIC.taxVote
      const p2 = { kind: 'tax', dir: 'up', newTax: 0.07, votes: {}, why: {}, proposerId: M.agentId }; const vs = F0.adults(w).slice(0, 20).map(a => { w.proposals._ruleVote(w, p2, a); return p2.votes[a.agentId]; }); C.tax.votes = vs.filter(v => v === 'for').length + '/' + vs.length; }
    out.C = C;

    // ============ D 照個性：幾種首長 × 幾種公庫狀況（不加心情起伏） ============
    const D = {}; { S = F0.setup(18); ({ w, M, BK } = S); const kinds = { plain: [], hard: ['hardworking'], shy: ['shy', 'kind'], thrifty: ['thrifty'], ambitious: ['ambitious', 'optimist'] };
      const L0 = JSON.stringify(TREASURY.S(w).led); const inc0 = Object.values(TREASURY.S(w).led)[0]['+tax_income']; const setNet = (o) => { for (const k of Object.keys(TREASURY.S(w).led)) TREASURY.S(w).led[k]['-pay'] = Math.round(inc0 * o / 1.53 * 100) / 100; };
      const states = { surplus: () => setNet(1.36), deficit: () => setNet(1.75), heavy: () => { setNet(1.36); FISCAL.S(w).hist = [{ d: w._absDay() - 200, n: 3000 }, { d: w._absDay() - 100, n: 3000 }, { d: w._absDay() - 20, n: 3000 }]; } };
      for (const [sk, sf] of Object.entries(states)) { D[sk] = {}; for (const [kk, tr] of Object.entries(kinds)) { TREASURY.S(w).led = JSON.parse(L0); FISCAL.S(w).hist = []; sf(); M.personality.traits = tr.slice(); M.personality.values = []; fresh(w, M); const c = ctxNow(w, M); D[sk][kk] = pickOf(w, M, K().options(w, M, c)); } }
      TREASURY.S(w).led = JSON.parse(L0); FISCAL.S(w).hist = [];
      // 上次選了先撐著、結餘又是負的：不會一直選撐著（四種個性都不選）
      setNet(1.75); M.personality.traits = ['shy', 'kind']; fresh(w, M); FISCAL.TT(w).dec = { pick: 'wait', by: M.agentId, name: M.name, d: w._absDay() - 10 }; const c = ctxNow(w, M); D.again = pickOf(w, M, K().options(w, M, c)); TREASURY.S(w).led = JSON.parse(L0);
      // 加心情起伏照樣跑 400 次（固定種子）：結餘是正的時候四個選項都有人選到、但撐著或補稅務員最多
      M.personality.traits = []; const cnt = {}; Math.random = seeded(4242); try { for (let i = 0; i < 400; i++) { fresh(w, M); const c4 = ctxNow(w, M); const ops = K().options(w, M, c4); const Ln = DECIDE.lean(w, M); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op) + (Math.random() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } cnt[best.id] = (cnt[best.id] || 0) + 1; } } finally { Math.random = R0; } D.noise = cnt; }
    out.D = D;

    // ============ E AI 路（假 AI） ============
    const E = {}; { S = F0.setup(19); ({ w, M, BK } = S); const app = window.rimtownApp; const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; ce._askJson = async (p) => { prompts.push(String(p)); return [{ n: 1, pick: 'taxman', why: 'model reason 31', feel: 'calc' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; E.aiOn = DECIDE.aiOn(w);
      if (E.aiOn) { const X0 = DECIDE.S(w); X0._asked = 0; X0._kAsked = {}; X0._gAsked = {}; X0._cDay = w._absDay(); X0.lastDay = w._absDay(); fresh(w, M); const n0 = seen.length; const c = FISCAL.tightDaily(w); const pending = seen.length === n0 && !!c; await DECIDE.flush(); await new Promise(r => setTimeout(r, 30)); await DECIDE.flush();
        const e = seen.slice(n0).find(q => q.kind === 'fiscTight'); const p = prompts.find(q => /taxman＝/.test(q)) || ''; E.r = { pending, id: e?.id, src: e?.src, why: e?.why, dec: FISCAL.view(w).tight.dec?.why, ok: FISCAL.taxmanOk(w), group: X0._gAsked.civic, codes: /wait＝/.test(p) && /bond＝/.test(p) && /tax＝/.test(p), cjk: /[一-鿿]/.test(p), sample: (p.match(/.{0,40}[一-鿿]+.{0,40}/) || [''])[0], len: p.length };
        // 銀行家那一題也送得出去（AI 回 refuse）
        ce._askJson = async (p2) => { prompts.push(String(p2)); return [{ n: 1, pick: 'refuse', why: 'model reason 32' }]; }; prompts.length = 0; X0._asked = 0; X0._kAsked = {}; X0._gAsked = {}; FISCAL.S(w).bankNo = null; const r = FISCAL.askBond(w, M, '', 'ai'); const wait = FISCAL.view(w).bankAsk; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 30)); await DECIDE.flush();
        const pb = prompts.find(q => /refuse＝/.test(q)) || ''; E.bank = { asked: !!r?.asked, wait, no: FISCAL.S(w).bankNo === w._absDay(), prop: openOf(w, 'fisc_bond').length, cjk: /[一-鿿]/.test(pb), sample: (pb.match(/.{0,40}[一-鿿]+.{0,40}/) || [''])[0], vac: OFFICE.view(w).wanted.find(x => x.post === 'market').why?.k }; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; }
    out.E = E;

    // ============ F 作廢、存讀檔 ============
    const F = {}; { S = F0.setup(20); ({ w, M, BK } = S); const c = ctxNow(w, M); F.before = K().options(w, M, c).length;
      w.stockpile.resources.silver = Math.round(TREASURY.fixed(w) * 12); F.backUp = K().options(w, M, c).length; F.backFacts = K().facts(w, M, c); w.stockpile.resources.silver = Math.round(TREASURY.fixed(w) * 5.8);
      const o = F0.adults(w).find(a => a !== M); F.other = K().options(w, o, c).length;
      const loc = M.currentLocation; M.currentLocation = 'exploration'; F.away = K().options(w, M, c).length; M.currentLocation = loc;
      const old = { d: c.d - 2, tok: c.tok }; F.stale = K().options(w, M, old).length;
      // 存讀檔：上次問的日子、決定與理由
      const op = K().options(w, M, c).find(x => x.id === 'wait'); op.run(w, M); FISCAL.TT(w).dec.why = { raw: 'reason 55' }; FISCAL.S(w).trust = { head: M.agentId, by: { x: 7 }, legit: 3, lv: 1 }; FISCAL.S(w).hist = [{ d: 1, n: 500 }]; FISCAL.S(w).miss = [w._absDay()];
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); F.save = { last: w2.fiscal?.tight?.last === FISCAL.TT(w).last, pick: w2.fiscal?.tight?.dec?.pick, why: w2.fiscal?.tight?.dec?.why?.raw, trust: w2.fiscal?.trust?.by?.x, legit: w2.fiscal?.trust?.legit, hist: w2.fiscal?.hist?.length, miss: w2.fiscal?.miss?.length }; w2.reset(); }
    out.F = F;

    // ============ G 負擔與信任 ============
    const G = {}; { S = F0.setup(21); ({ w, M, BK } = S); const Fs = FISCAL.S(w); const d = w._absDay(); const inc = FISCAL.burden(w).inc;
      const lvAt = (owed, hist, miss) => { Fs.hist = hist || []; Fs.miss = miss || []; const r = FISCAL.burdenAt(w, owed, 0).lv; Fs.hist = []; Fs.miss = []; return r; };
      G.th = { none: lvAt(0), light: lvAt(inc * 9.9), heavyDays: lvAt(inc * 10.1), heavyN: lvAt(inc * 2, [{ d: d - 100, n: 1 }, { d: d - 5, n: 1 }]), heavyMiss: lvAt(inc * 2, [], [d - 3]), badDays: lvAt(inc * 20.1), badN: lvAt(inc * 2, [{ d: d - 300, n: 1 }, { d: d - 100, n: 1 }, { d: d - 5, n: 1 }]), badMiss: lvAt(inc * 2, [], [d - 50, d - 40, d - 3]), oldN: lvAt(inc * 2, [{ d: d - 400, n: 1 }, { d: d - 5, n: 1 }]), paid3: lvAt(0, [{ d: d - 300, n: 1 }, { d: d - 100, n: 1 }, { d: d - 50, n: 1 }]) };
      // 個人差異：同一個負擔，有存款又節儉的人 vs 領公家薪水的人 vs 跟首長交情好的人
      const A2 = F0.adults(w).filter(a => a !== M && a !== BK); const PUB = ['guard', 'doctor', 'researcher', 'priest']; const saver = A2.find(a => (w.bank.dep[a.agentId] || 0) > 200 && !PUB.includes(a.job?.key)); saver.personality.traits = ['thrifty', 'neurotic']; const pub = A2.find(a => PUB.includes(a.job?.key) && !w.bank.dep[a.agentId]); pub.personality.traits = []; const fr = A2.find(a => a !== saver && a !== pub && !PUB.includes(a.job?.key)); fr.personality.traits = []; fr.relationships.getOrCreate(M.agentId, M.name).affinity = 50;
      const affTo = (a) => a.relationships.getOrCreate(M.agentId, M.name).affinity; const a0 = { s: affTo(saver), p: affTo(pub), f: affTo(fr) };
      Fs.bond = { owed: Math.round(inc * 21), n: Math.round(inc * 21), day: d, paid: 0, int: 0 }; Fs.trust = null; const nb0 = A2.length;
      G.concern = { s: FISCAL.concern(w, saver, M), p: FISCAL.concern(w, pub, M), f: FISCAL.concern(w, fr, M) };
      const wk = (n) => { for (let i = 0; i < n; i++) { const X = FISCAL.TS(w); X.wk = null; const dd = d + 7 * (i + 1); const ad = w._absDay; w._absDay = () => dd - (dd % 7) + 5; try { FISCAL.trustDaily(w); } finally { w._absDay = ad; } } };
      wk(4); G.drop = { s: Math.round((affTo(saver) - a0.s) * 10) / 10, p: Math.round((affTo(pub) - a0.p) * 10) / 10, f: Math.round((affTo(fr) - a0.f) * 10) / 10, uneasy: FISCAL.uneasy(w), mem: (saver.memory?.entries || []).filter(m => /公庫欠銀行的錢|treasury owes the bank/.test(m.content || '')).length, memP: (pub.memory?.entries || []).filter(m => /公庫欠銀行的錢|treasury owes the bank/.test(m.content || '')).length };
      wk(40); G.cap = Math.round((a0.s - affTo(saver)) * 10) / 10;
      // 公債提案的贊成比例隨等級下降（固定種子、每個等級 600 票）
      const rate = (owed, hist, miss) => { Fs.bond = owed ? { owed, n: owed, day: d, paid: 0, int: 0 } : null; Fs.hist = hist || []; Fs.miss = miss || []; const p = { kind: 'fisc_bond', votes: {}, why: {}, proposerId: M.agentId }; let f = 0, n = 0; Math.random = seeded(9001); try { for (let k = 0; k < 6; k++) for (const a of A2.slice(0, 100)) { const v = FISCAL.vote(w, p, a); n++; if (v.v === 'for') f++; } } finally { Math.random = R0; } return Math.round(f / n * 1000) / 10; };
      const keepT = Fs.trust; Fs.trust = { head: M.agentId, by: {}, legit: 0, lv: -1 }; G.vote = { none: rate(0), light: rate(Math.round(inc * 5)), heavy: rate(Math.round(inc * 12)), bad: rate(Math.round(inc * 22), [], [d - 3, d - 9, d - 20]) }; Fs.trust = keepT;
      G.voteDis = (() => { const keep = JSON.stringify(Fs.trust.by); for (const a of A2) Fs.trust.by[a.agentId] = 30; const r = rate(Math.round(inc * 5)); Fs.trust.by = JSON.parse(keep); return r; })();
      // 銀行家在太重時不借（照個性，不加心情起伏）、首長太重時不選借錢
      Fs.bond = null; Fs.hist = [{ d: d - 300, n: 1 }, { d: d - 200, n: 1 }, { d: d - 100, n: 1 }]; Fs.miss = []; Fs.last.fisc_bond = -999; Fs.bankNo = null; Fs.bankTok = 90; Fs.bankAsk = { d, tok: 90, by: M.agentId, why: '', src: 'tight', n: FISCAL.bondOffer(w) };
      BK.personality.traits = ['greedy']; G.bankBad = pickOf(w, BK, FISCAL.bankOptions(w, BK, { t: 'bond', tok: 90 })); Fs.hist = []; G.bankOk = pickOf(w, BK, FISCAL.bankOptions(w, BK, { t: 'bond', tok: 90 })); Fs.bankAsk = null;
      Fs.hist = [{ d: d - 300, n: 1 }, { d: d - 200, n: 1 }, { d: d - 100, n: 1 }]; M.personality.traits = ['ambitious', 'optimist']; const L0 = JSON.stringify(TREASURY.S(w).led); for (const k of Object.keys(TREASURY.S(w).led)) TREASURY.S(w).led[k]['-pay'] = TREASURY.S(w).led[k]['+tax_income'] * 1.15; const keepTr = Fs.trust; Fs.trust = null; fresh(w, M); const cc = ctxNow(w, M); G.mayorBad = pickOf(w, M, K().options(w, M, cc)); const fb = K().facts(w, M, cc); G.mayorFacts = fb.includes(t('公債已經還清；這一年借過 {k} 次。').replace('{k}', '3')); texts.push(fb); G.mayorBad2 = pickOf(w, M, K().options(w, M, cc).filter(o => ['wait', 'bond'].includes(o.id))); Fs.hist = []; fresh(w, M); G.mayorOk = pickOf(w, M, K().options(w, M, ctxNow(w, M)).filter(o => ['wait', 'bond'].includes(o.id))); Fs.trust = keepTr; TREASURY.S(w).led = JSON.parse(L0);
      // 還清之後慢慢回來：好感回到原本的水準
      Fs.bond = null; Fs.hist = []; Fs.miss = []; wk(40); G.back = { s: Math.round((affTo(saver) - a0.s) * 10) / 10, p: Math.round((affTo(pub) - a0.p) * 10) / 10, f: Math.round((affTo(fr) - a0.f) * 10) / 10, uneasy: FISCAL.uneasy(w), by: Object.keys(FISCAL.TS(w).by).length };
      // 付不出利息：記次數、當下往下、記憶
      Fs.bond = { owed: 3000, n: 3000, day: d, paid: 0, int: 0 }; const sv = w.stockpile.resources.silver; w.stockpile.resources.silver = 0; const af0 = affTo(saver); const L4 = leak(w, () => FISCAL.bondDaily(w)); w.stockpile.resources.silver = sv; G.miss = { n: Fs.st.miss, list: (Fs.miss || []).length, owed: Math.round(Fs.bond.owed * 100) / 100, drop: Math.round((affTo(saver) - af0) * 10) / 10, mem: (saver.memory?.entries || []).some(m => /利息都付不出來|can't even pay the interest/.test(m.content || '')), leak: L4.leak, lv: FISCAL.burden(w).lv };
      // 存戶：擠兌時要不要領的事實寫上公債（占存款的比例高、最近付不出利息）
      Fs.bond.owed = Math.round(BANK.totalDep(w.bank) * 0.3); w.bank.status = 'run'; w.bank.runDay = d; w.bank.run = { injected: 0, asked: null }; const dp = A2.find(a => w.bank.dep[a.agentId] > 0); const KR = DECIDE.KINDS.bankrun; const fr2 = KR.facts(w, dp, { d: 0 }); G.dep = { facts: fr2.includes(t('銀行借給公庫 {n} 銀幣，是存款的 {p}%，公庫最近 30 天有 {m} 次連利息都付不出來。').replace('{n}', String(Fs.bond.owed)).replace('{p}', '30').replace('{m}', '1')) }; texts.push(fr2); Fs.miss = []; G.dep.none = !KR.facts(w, dp, { d: 0 }).includes(t('銀行借給公庫 {n} 銀幣，是存款的 {p}%，公庫最近 30 天有 {m} 次連利息都付不出來。').split('{n}')[0]); w.bank.status = 'ok'; w.bank.run = null; Fs.bond = null;
      // 國王當政：民心（C.legit）跟著動，幅度跟王令同一級；還清回來
      const CR = CROWN.S(w); const king = A2.find(a => a !== saver && a !== pub && a !== fr); CR.king = king.agentId; CR.republic = false; CR.legit = 60; Fs.trust = null; Fs.bond = { owed: Math.round(inc * 21), n: Math.round(inc * 21), day: d, paid: 0, int: 0 }; wk(4); G.king = { down: Math.round((60 - CR.legit) * 10) / 10 }; Fs.bond = null; wk(20); G.king.back = Math.round(CR.legit * 10) / 10; CR.king = null;
      // 介面：公庫卡的那一行
      Fs.bond = { owed: Math.round(inc * 12), n: Math.round(inc * 12), day: d, paid: 0, int: 0 }; Fs.trust = { head: M.agentId, by: Object.fromEntries(A2.slice(0, 9).map(a => [a.agentId, 8])), legit: 0, lv: 1 }; const app = window.rimtownApp; let html = ''; try { html = app._icTreasury(); } catch (e) { html = 'ERR ' + e.message; } const div = document.createElement('div'); div.innerHTML = html; const tx2 = div.textContent;
      G.card = { has: tx2.includes(t('公債負擔')), lv: tx2.includes(t('偏重')), n: tx2.includes(t('；{n} 人不放心首長管錢').replace('{n}', '9')), days: tx2.includes(t('相當於 {d} 天的收入，{lv}').replace('{d}', '12').replace('{lv}', t('偏重'))) }; texts.push(tx2.replace(/\d+/g, '')); Fs.bond = null; Fs.trust = null; }
    out.G = G;

    // ============ H 放著跑 60 天 ============
    const H = {}; { S = F0.setup(22); ({ w, M, BK } = S); const d0 = w._absDay(); let asks = 0; const n0 = seen.length; try { F0.run(w, 60); } catch (e) { H.err = String(e.stack || e).slice(0, 300); } H.other = F0.other(w, d0); H.asks = seen.slice(n0).filter(e => e.kind === 'fiscTight').map(e => e.id).join(); H.days = w._absDay() - d0; H.tight = FISCAL.view(w).tight?.st; H.burden = FISCAL.view(w).burden?.name; }
    out.H = H;
    // 英文：所有收集到的文字不能有中文（人名先換成英文）
    const loc = (s) => (I18N.localizeNames ? I18N.localizeNames(String(s || ''), true) : String(s || ''));
    out.cjk = texts.map(loc).filter(s => /[一-鿿]/.test(s)).map(s => (s.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0]).slice(0, 6);
    return out;
  }, zh);
  const tag = `${dev}/${lang}`; const { A, B, C, D, E, F, G, H } = r;
  ok(A.reg.has && A.reg.group === 'civic' && A.reg.scan === false, `${tag} 登記 fiscTight：civic 組、不每天掃`, A.reg);
  ok(A.blocked === 'market,tax,health' && A.low && !A.canHire, `${tag} 情境：公庫不夠 10 天，三個監管職位都因為公庫吃緊空著`, A);
  ok(A.ask.c && A.ask.who && A.ask.n === 1, `${tag} 問的是現任首長，一次一件`, A.ask);
  ok(A.gap && A.gap9 && A.gap10, `${tag} 最多十天問一次`, A);
  ok(A.away && A.off && A.taxOpen && A.bondOpen && A.notLow, `${tag} 首長不在、決策核心沒開、加稅或借錢的案在表決、公庫回到門檻以上：都不問`, A);
  ok(A.village.startsWith('false,false,false,false,true'), `${tag} 村莊沒有監管職位：連續 5 天不到 10 天才問`, A.village);
  ok(Object.values(B.nums).every(Boolean), `${tag} 事實裡的數字跟 TREASURY.view／FISCAL.view／OFFICE 對得上`, { nums: B.nums, facts: B.facts.slice(0, 500) });
  ok(B.ids === 'wait,taxman,bond,tax' && B.yieldOk, `${tag} 四個選項都列出來；稅務員每週追回的估算照查帳的規則算`, { ids: B.ids, Y: B.Y });
  ok(B.neg.back && B.neg.text, `${tag} 結餘是負的：事實與選項都寫回不來`, B.neg);
  ok(B.away.offer === 0 && B.away.ids === 'wait,taxman,tax' && B.away.why, `${tag} 銀行家出遠門：bondOffer 是 0，借錢不列、事實寫原因`, B.away);
  ok(B.owed.ids === 'wait,taxman,tax' && B.owed.why && B.gap.ids === 'wait,taxman,tax' && B.gap.why, `${tag} 還有一筆沒還完、60 天內提過：借錢不列、事實寫原因`, { o: B.owed, g: B.gap });
  ok(B.taxMax.ids === 'wait,taxman,bond' && B.taxMax.why && B.hasTax.ids === 'wait,bond,tax' && B.hasTax.blocked === 'market,health', `${tag} 稅率到頂不列加稅；已經有稅務員不列補稅務員`, { t: B.taxMax, h: B.hasTax });
  ok(C.wait.dec === 'wait' && C.wait.why && C.wait.k === 'wait' && C.wait.row.includes(C.wait.why) && C.wait.log && C.wait.html, `${tag} 先撐著：介面空缺那一行寫首長決定先撐著＋理由，決定紀錄看得到`, C.wait);
  ok(!!C.wait.res && C.wait.past, `${tag} 公庫回到門檻：記下結果，下次問的時候寫進事實`, C.wait);
  ok(C.taxman.q === 'officeNominate:tax' && C.taxman.ok && !C.taxman.hire && C.taxman.daily === 'tax' && C.taxman.rowTax === 'taxman' && C.taxman.rowMarket !== 'taxman', `${tag} 先補稅務員：只放行稅務員（另外兩個職位照樣不補）`, C.taxman);
  ok(C.taxman.rowNom === 'nom' && C.taxman.seat && C.taxman.market && /稅務員|tax inspector/.test(C.taxman.res2 || ''), `${tag} 稅務員照原本的提名與同意流程上任；介面寫「已提名等同意」；結果記下來`, C.taxman);
  ok(C.bond.bank && C.bond.by && C.bond.prop && C.bond.bankBy && C.bond.pid && C.bond.leak1 === 0, `${tag} 向銀行借：先問銀行家，他點頭才開成公債提案`, C.bond);
  ok(C.bond.pass.st === 'done' && C.bond.pass.silver === C.bond.amt && C.bond.pass.reserve === C.bond.amt && C.bond.pass.owed === C.bond.amt && C.bond.pass.leak === 0 && C.bond.pass.hist === 1, `${tag} 通過後錢從銀行準備金進公庫，帳對得上`, C.bond.pass);
  ok(C.bond.day.int > 0 && C.bond.day.toBank > 0 && Math.abs(C.bond.day.toBank - C.bond.day.fromTown) < 0.02 && C.bond.day.leak === 0 && (C.bond.day.low || C.bond.day.paid > 0) && /借到|borrowed/i.test(C.bond.res2 || ''), `${tag} 每天付利息、公庫夠 10 天就還本；錢從公庫到銀行，一分不差；結果記下來`, C.bond.day);
  ok(C.bond.no.prop === 0 && C.bond.no.bank === 'no' && C.bond.no.bankNo && C.bond.no.mem && !C.bond.no.offer && C.bond.no.past, `${tag} 銀行家不借：提案不成立、首長記得、15 天內不再去碰、下次事實寫上次的結果`, C.bond.no);
  ok(C.bond.bf.pct && C.bond.bf.lv && C.bond.bf.rec && C.bond.bf.ids === 'lend,half,refuse' && C.bond.bf.wrongTok === 0 && C.bond.bf.notBanker === 0, `${tag} 銀行家那一題：事實寫占準備金幾成、負擔、還款紀錄；照借／只借一半／不借`, C.bond.bf);
  ok(C.tax.prop && C.tax.newTax === 0.07 && C.tax.dir === 'up' && C.tax.by && C.tax.pid && /否決|voted down/.test(C.tax.res2 || '') && C.tax.log, `${tag} 提案加稅：走原本的稅率提案；被否決有日誌，結果記下來`, C.tax);
  ok(D.surplus.hard === 'taxman' && D.surplus.shy === 'wait' && D.deficit.shy !== 'wait' && D.again !== 'wait', `${tag} 照個性：勤快的補稅務員、怕得罪人的撐著；結餘是負的、上次已經撐過，就不會一直撐`, D);
  ok(['bond', 'tax', 'taxman'].includes(D.deficit.ambitious) && !Object.values(D.heavy).includes('bond'), `${tag} 結餘是負的時候想辦法生錢；一年借了三次（負擔太重）沒有人選借錢`, D);
  ok(Object.keys(D.noise).length >= 3 && (D.noise.wait || 0) + (D.noise.taxman || 0) > 200, `${tag} 加上心情起伏（固定種子 400 次）：會選不一樣的，撐著與補稅務員最多`, D.noise);
  ok(E.aiOn && E.r && E.r.pending && E.r.id === 'taxman' && E.r.src === 'ai' && E.r.why === 'model reason 31' && E.r.ok && E.r.group >= 1 && E.r.codes, `${tag} AI 路：題目送出、照 AI 選的做、理由記下來、用 civic 組的額度`, E.r);
  ok(E.bank && E.bank.asked && E.bank.wait && E.bank.no && E.bank.prop === 0, `${tag} AI 路：銀行家那一題送得出去，回不借就不成立`, E.bank);
  if (!zh) ok(E.r && !E.r.cjk && E.bank && !E.bank.cjk, `${tag} 英文題目沒有中文`, { a: E.r?.sample, b: E.bank?.sample });
  ok(F.before === 4 && F.backUp === 0 && F.backFacts === '' && F.other === 0 && F.away === 0 && F.stale === 0, `${tag} 作廢：公庫回到門檻、不是首長、首長不在、題目過期都沒有選項`, F);
  ok(F.save.last && F.save.pick === 'wait' && F.save.why === 'reason 55' && F.save.trust === 7 && F.save.legit === 3 && F.save.hist === 1 && F.save.miss === 1, `${tag} 存讀檔：上次問的日子、決定與理由、信任與借款紀錄都在`, F.save);
  ok(G.th.none === -1 && G.th.light === 0 && G.th.heavyDays === 1 && G.th.heavyN === 1 && G.th.heavyMiss === 1 && G.th.badDays === 2 && G.th.badN === 2 && G.th.badMiss === 2 && G.th.oldN === 0 && G.th.paid3 === 0, `${tag} 負擔等級門檻：10／20 天收入、一年 2／3 次、付不出利息 1 次（30 天）／3 次（60 天）`, G.th);
  ok(G.concern.s > G.concern.f && G.concern.f > G.concern.p && G.drop.s < G.drop.f && G.drop.f < 0 && G.drop.p > G.drop.f && G.drop.s <= -12 && G.drop.p >= -6, `${tag} 個人差異：有存款又節儉的人看法掉得多、交情好的少、領公家薪水的最少`, { c: G.concern, d: G.drop });
  ok(G.drop.mem >= 1 && G.drop.mem <= 2 && G.drop.memP === 0 && G.drop.uneasy >= 5, `${tag} 在意的人等級變重時記在心裡（不是每天寫）；不放心的人數算得出來`, G.drop);
  ok(G.cap <= 30.01 && G.cap >= 29, `${tag} 這件事扣的好感最多 30`, G.cap);
  ok(G.vote.none > G.vote.heavy && G.vote.heavy > G.vote.bad && G.vote.light >= G.vote.heavy && G.voteDis < G.vote.light, `${tag} 公債提案的贊成比例隨負擔等級下降；大家不放心時也下降`, { v: G.vote, dis: G.voteDis });
  ok(G.bankBad === 'refuse' && G.bankOk === 'lend' && G.mayorBad !== 'bond' && G.mayorBad2 === 'wait' && G.mayorOk === 'bond' && G.mayorFacts, `${tag} 負擔太重：銀行家不借、首長不選借錢（不重時兩個都會借）；首長的事實寫一年借了幾次`, G);
  ok(Math.abs(G.back.s) < 0.6 && Math.abs(G.back.p) < 0.6 && Math.abs(G.back.f) < 0.6 && G.back.uneasy === 0 && G.back.by === 0, `${tag} 公債還清以後看法慢慢回到原本的水準`, G.back);
  ok(G.miss.n === 1 && G.miss.list === 1 && G.miss.owed > 3000 && G.miss.drop < 0 && G.miss.mem && G.miss.leak === 0 && G.miss.lv >= 1, `${tag} 付不出利息：記一筆、滾進本金、在意的人當下就往下並記住；錢守恆`, G.miss);
  ok(G.dep.facts && G.dep.none, `${tag} 存戶：擠兌時要不要領，事實寫公債占存款的比例與付不出利息（沒有付不出利息時不寫）`, G.dep);
  ok(G.king.down >= 4 && G.king.down <= 20 && G.king.back > 60 - G.king.down, `${tag} 國王當政：民心跟著往下（幅度在王令的級距），還清後回來`, G.king);
  ok(Object.values(G.card).every(Boolean), `${tag} 公庫卡寫公債負擔：相當於幾天收入、等級、有多少人不放心`, G.card);
  ok(!H.err && H.days === 60 && Math.abs(H.other) < 0.05, `${tag} 放著跑 60 天沒有錯誤，帳上對不上的錢是 0（fiscTight 問了 ${H.asks || '0 次'}）`, H);
  if (!zh) ok(r.cjk.length === 0, `${tag} 英文：題目、選項、介面文字沒有中文`, r.cjk);
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
