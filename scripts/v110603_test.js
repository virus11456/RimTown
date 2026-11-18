// v11.6.0 第三包：銀行家、房東、醫生、出面談生意的人自己拿主意
//   bankDesk（sim-bank.js）：有人來借錢借不借、每週利率、逾期的人怎麼辦、擠兌時押多少自己的錢
//   landlord（sim-estate.js）：每位私人房東自己定租金檔位、房客欠到三倍租金怎麼辦
//   pharmaWeek（sim-bio.js）：藥廠這週做多少藥，鎮上醫術最好的醫生決定
//   surplus（sim-procure.js）：公倉多出來的貨賣不賣，出面談生意的人決定
//  每一件都驗：有登記、事實裡的數字與交情對得上、選項該有才有、選了之後帳真的照做、交情與個性會改變傾向、
//  當事人不在或決策核心沒開走原本的規則、等回話期間不重複問、隔天沒回音照規則、存讀檔、開智能體時題目送出並採用回答（英文題目沒有中文）、放著跑 30 天沒有錯誤
// 用法：BASE=http://localhost:8179/ node scripts/v110603_test.js
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8179/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Bank\]|\[Decide\]|\[Estate\]|\[Procure\]|\[Bio\]|\[Autonomy\]/.test(x)) console.log('    console:', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    // 城鎮才有銀行：開一座城鎮規模的鎮
    w.reset(); w.observerMode = true; ORIGIN.seed(w, 1, { seed: 31 }); w.observerMode = true; w.fullAgentMode = false;
    for (let k = 0; k < 1200 && !(DECIDE.on(w) && w.bank?.open && w.estate); k++) { w.paused = false; w.tick(); } w.paused = true;
    out.on = DECIDE.on(w) && !!w.bank?.open && !!w.estate;
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), moved: r3(MONEY.total(w) - T0), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X = DECIDE.S(w); const KB = DECIDE.KINDS.bankDesk, KL = DECIDE.KINDS.landlord, KP = DECIDE.KINDS.pharmaWeek, KS = DECIDE.KINDS.surplus;
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && ['bankDesk', 'landlord', 'pharmaWeek', 'surplus'].includes(o.K.key)) seen.push({ k: o.K.key, t: o.ctx?.t || '', who: o.a.agentId, d: o.d, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); });
    const plain = (a) => { a._p0 = a._p0 || JSON.stringify(a.personality); a.personality.traits = []; a.personality.values = []; }; const restore = (a) => { if (a._p0) { Object.assign(a.personality, JSON.parse(a._p0)); delete a._p0; } };
    const withTraits = (a, tr, vs) => { plain(a); a.personality.traits = tr.slice(); a.personality.values = (vs || []).slice(); };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const texts = []; const idsOf = (K, a, c) => { const os = K.options(w, a, c); for (const o of os) texts.push(tx(o.text), tx(o.say || ''), tx(o.why || '')); return os.map(o => String(o.id).split(':')[0]); };
    const pick = (K, a, c, id) => K.options(w, a, c).find(o => String(o.id).split(':')[0] === id);
    const logs = () => (w.messageLog || []).map(m => String(m.content || '')); const newLogs = (n0) => logs().slice(n0);
    const memOf = (a) => (a.memory?.entries || []).map(e => String(e.content || '')); const memMark = (a) => { const E0 = a.memory?.entries || []; return E0[E0.length - 1] || null; }; const memAfter = (a, m) => { const E0 = a.memory?.entries || []; const i = m ? E0.indexOf(m) : -1; return E0.slice(i + 1).map(e => String(e.content || '')); }; const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
    const setAff = (a, b, v) => { const r = a.relationships.getOrCreate(b.agentId, b.name); r.affinity = v; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { w.wallet.bal[a.agentId] = n; };
    const B = BANK.S(w); if (!w.agents[B.banker] || w.isAway?.(B.banker)) B.banker = npcs().filter(a => (a.age ?? 30) >= 25 && !w.isAway?.(a.agentId)).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0].agentId; /* 銀行家剛好出遠門：換一位在鎮上的 */ const banker = w.agents[B.banker];
    // 借款人候選：大人、不是銀行家、沒有欠銀行
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && a !== banker && !w.isAway?.(a.agentId));
    const clearLoans = () => { for (const id of Object.keys(B.loans)) delete B.loans[id]; B.refused = {}; const D0 = BANK.D(B); D0.apply = {}; D0.burnt = {}; };
    const fund = () => { B.reserve = Math.max(B.reserve, 600); B.status = 'ok'; B.run = null; };
    const fam = (a) => MONEY.familyOf(w, a);
    const pool = adults().filter(a => !fam(banker).includes(a) && a.job);
    const A = pool[0], A2 = pool[1], A3 = pool[2], A4 = pool[3];
    clearLoans(); fund(); for (const a of [A, A2, A3, A4]) { setAff(banker, a, 0); setAff(a, banker, 0); try { w.dark.rep[a.agentId] = {}; } catch (e) {} }
    const mkApp = (a, n, why, extra) => { const D0 = BANK.D(B); const tok = ++D0.n; D0.apply[a.agentId] = Object.assign({ n, why, d: day(), tok, coll: null, biz: 0 }, extra || {}); return { t: 'loan', id: a.agentId, tok, d: day() }; };

    // 1) 登記
    out.reg = ['bankDesk', 'landlord', 'pharmaWeek', 'surplus'].map(k => { const K = DECIDE.KINDS[k]; return K ? { k, title: t(K.title), scan: K.scan, group: K.aiGroup, kind: K.aiKind } : null; });
    out.groups = { work: DECIDE.AI_GROUP.work, civic: DECIDE.AI_GROUP.civic, deal: DECIDE.AI_GROUP.deal, max: DECIDE.AI_MAX, kinds: Object.keys(DECIDE.KINDS).length };

    // ================= 2) 有人來借錢 =================
    { const o = {}; plain(banker); setAff(banker, A, 45); setCash(A, 7); const c = mkApp(A, 40, '開店'); const f = KB.facts(w, banker, c); texts.push(f);
      o.facts = { name: f.includes(t(A.name)), n: f.includes('40'), why: f.includes(t('開店')), cash: f.includes(String(Math.floor(cash(A)))), tie: f.includes(t('是你的好朋友')), regard: f.includes('45'), dep: f.includes(String(Math.round(BANK.totalDep(B)))), res: f.includes(String(Math.round(B.reserve))), bad: f.includes(String(Math.round(B.bad || 0))), job: f.includes(t(A.job.title || '')) };
      setAff(banker, A, -30); const f2 = KB.facts(w, banker, c); o.facts.foe = f2.includes(t('跟你有過節')); setAff(banker, A, 0); o.facts.none = KB.facts(w, banker, c).includes(t('跟你不熟'));
      // 選項：有房子、沒抵押才列「要他拿房子抵押」
      const hasHouse = (a) => ESTATE.ownsOf(w, a.agentId).length > 0; const u0 = Object.values(w.estate.units).find(u => u.owner && u.owner !== A.agentId && u.owner !== banker.agentId) || Object.values(w.estate.units)[0];
      const own0 = u0.owner; o.noHouse = (() => { for (const u of ESTATE.ownsOf(w, A.agentId)) u._was = u.owner, u.owner = 'nobody_x'; const ids = idsOf(KB, banker, c); for (const u of Object.values(w.estate.units)) if (u._was) { u.owner = u._was; delete u._was; } return ids; })();
      u0.owner = A.agentId; o.withHouse = idsOf(KB, banker, c); const c2 = mkApp(A, 40, '房屋抵押', { coll: u0.id }); o.mortgage = idsOf(KB, banker, c2);
      o.stale = KB.options(w, banker, { t: 'loan', id: A.agentId, tok: 99999, d: day() }).length; o.notBanker = KB.options(w, A2, c2).length;
      // 結算
      const runLoan = (a, id, n) => { clearLoans(); fund(); const cc = mkApp(a, n, '周轉'); const op = pick(KB, banker, cc, id); if (!op) return { none: id }; const c0 = cash(a), r0 = B.reserve; const L = leak(() => op.run(w, banker, cc)); const Ln = B.loans[a.agentId]; return { res: tx(L.ret), leak: L.leak, moved: L.moved, got: Ln ? Ln.principal : 0, cashD: Math.round(cash(a) - c0), resD: Math.round(r0 - B.reserve), coll: Ln?.collateral || null, pend: !!BANK.pendingOf(w, a), refused: B.refused?.[a.agentId] ?? null, mem: memOf(a).slice(-2) }; };
      o.lend = runLoan(A, 'lend', 40); o.half = runLoan(A, 'half', 40); o.coll = runLoan(A, 'coll', 40); o.coll.houses = ESTATE.ownsOf(w, A.agentId).map(u => u.id);
      const af0 = aff(A, banker); o.refuse = runLoan(A, 'refuse', 40); o.refuse.affD = aff(A, banker) - af0; o.refuse.memHit = memOf(A).some(x => x.includes(fill('銀行家{b}不肯借我錢。', { b: banker.name })));
      u0.owner = own0; clearLoans(); fund();
      // 申請送出 → 照個性當場決定（BANK.lend 包好的那一層）
      const viaLend = (a, n, why) => { clearLoans(); fund(); const n0 = BANK.D(B).st.asks; const got = steady(() => BANK.lend(w, B, a, n, why)); return { got, asked: BANK.D(B).st.asks - n0, loan: B.loans[a.agentId]?.principal || 0, by: B.loans[a.agentId]?.by || null }; };
      plain(banker); setAff(banker, A, 0); o.plainLend = viaLend(A, 30, t('周轉'));
      w.dark.rep[A.agentId] = { exposed: 2 }; o.exposed = viaLend(A, 30, t('周轉')); w.dark.rep[A.agentId] = {};
      setAff(banker, A, -35); o.foe = viaLend(A, 30, t('周轉')); setAff(banker, A, 0);
      // 一群隨機個性的銀行家、隨機個性的借款人（不是名聲差、也不是處不好）：多半照借
      { let n = 0, lent = 0, half = 0, coll = 0; const p0 = JSON.stringify(banker.personality); const TR = ['greedy', 'kind', 'thrifty', 'generous', 'neurotic', 'optimist', 'stoic', 'lazy', 'hardworking', 'ambitious'];
        for (let i = 0; i < 40; i++) { clearLoans(); fund(); banker.personality.traits = TR.filter(() => R0() < 0.25); const a = pool[i % pool.length]; setAff(banker, a, Math.round(R0() * 60 - 15)); w.dark.rep[a.agentId] = {}; const cc = mkApp(a, 30, '周轉'); BANK.D(B).apply[a.agentId].n = 30;
          const e = (() => { const os = KB.options(w, banker, cc); const Ln = DECIDE.lean(w, banker); let best = null, bs = -1e9; for (const op of os) { const s = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } return best ? best.id : null; })();
          n++; if (e === 'lend') lent++; if (e === 'half') half++; if (e === 'coll') coll++; }
        // 沒有工作、以前賴過帳的人：一部分被推到借一半、要抵押或不借
        let m = 0, other = 0; for (let i = 0; i < 40; i++) { clearLoans(); fund(); banker.personality.traits = TR.filter(() => R0() < 0.25); const a = pool[i % pool.length]; const j0 = a.job; a.job = null; BANK.D(B).burnt[a.agentId] = 1; setAff(banker, a, Math.round(R0() * 40 - 10)); const cc = mkApp(a, 30, '周轉');
          const os = KB.options(w, banker, cc); const Ln = DECIDE.lean(w, banker); let best = null, bs = -1e9; for (const op of os) { const sc = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (sc > bs) { bs = sc; best = op; } } a.job = j0; m++; if (best && best.id !== 'lend') other++; }
        Object.assign(banker.personality, JSON.parse(p0)); o.crowd = { n, lent, half, coll }; o.risky = { n: m, other }; plain(banker); clearLoans(); }
      // 銀行家不在鎮上、決策核心沒開：照原本的規則（不問）
      { const away = w.isAway; w.isAway = (id) => id === banker.agentId || (away ? away.call(w, id) : false); o.away = viaLend(A, 30, t('周轉')); w.isAway = away; }
      { const on0 = DECIDE.on; DECIDE.on = () => false; o.off = viaLend(A, 30, t('周轉')); w.dark.rep[A.agentId] = { exposed: 2 }; o.offRule = viaLend(A, 30, t('周轉')); w.dark.rep[A.agentId] = {}; DECIDE.on = on0; }
      // 銀行家自己跟自己的銀行借：照原本的規則
      { clearLoans(); fund(); const n0 = BANK.D(B).st.asks; BANK.lend(w, B, banker, 30, t('周轉')); o.self = { asked: BANK.D(B).st.asks - n0, loan: B.loans[banker.agentId]?.principal || 0 }; }
      // 創業貸款：四十五天、記進創業貸款，沒有記兩次
      { clearLoans(); fund(); const b0 = B.bizLent || 0; const got = steady(() => BIZ.bizLoan(w, A, 40, '開店')); const L = B.loans[A.agentId]; o.biz = { got, kind: L?.kind, due: L ? L.due - day() : null, lentD: Math.round((B.bizLent || 0) - b0) }; }
      clearLoans(); fund(); out.loan = o; }

    // ================= 3) 每週定利率 =================
    { const o = {}; clearLoans(); fund(); plain(banker); const tg = Math.round(BANK.rateTarget(B) * 100); const c = () => ({ t: 'rate', d: day() }); const arm = () => { B.rateAsk = { d: day(), done: 0 }; };
      B.rate = 0.1; arm(); const f = KB.facts(w, banker, c()); texts.push(f); o.facts = { cur: f.includes('10%'), tg: f.includes(tg + '%'), dep: f.includes(String(Math.round(BANK.totalDep(B)))), res: f.includes(String(Math.round(B.reserve))), cash: f.includes(String(Math.floor(cash(banker)))) };
      o.mid = idsOf(KB, banker, c()); B.rate = 0.2; arm(); o.top = idsOf(KB, banker, c()); B.rate = 0.04; arm(); o.bottom = idsOf(KB, banker, c()); B.rate = 0.19; arm(); o.near = idsOf(KB, banker, c());
      B.rate = 0.1; arm(); const op = pick(KB, banker, c(), 'up1'); const n0 = logs().length; const L = leak(() => op.run(w, banker, c())); o.up1 = { rate: Math.round(B.rate * 100), leak: L.leak, log: newLogs(n0).some(x => x.includes('11%')) }; o.again = KB.options(w, banker, c()).length;
      // 照個性：離目標越遠越想往那邊調；貪心的偏高、心腸好的偏低
      const ask = () => { const n0 = seen.length; B.rateAsk = null; steady(() => BANK.setRate(w, B)); return seen.slice(n0).pop() || null; };
      B.rate = Math.max(0.04, BANK.rateTarget(B) - 0.04); o.farBelow = ask()?.id; B.rate = Math.min(0.2, BANK.rateTarget(B) + 0.04); o.farAbove = ask()?.id; B.rate = BANK.rateTarget(B); o.atTarget = ask()?.id;
      const avg = (tr) => { let s = 0; const n = 40; const p0 = JSON.stringify(banker.personality); for (let i = 0; i < n; i++) { banker.personality.traits = tr.slice(); B.rate = BANK.rateTarget(B); const r0 = Math.round(B.rate * 100); B.rateAsk = null; BANK.setRate(w, B); s += Math.round(B.rate * 100) - r0; } Object.assign(banker.personality, JSON.parse(p0)); return s / n; };
      o.greedyAvg = avg(['greedy']); o.kindAvg = avg(['kind', 'generous']); o.plainAvg = avg([]);
      o.why = BANK.view(w).why; o.rateBy = BANK.view(w).rateBy; plain(banker);
      // 銀行家不在：照原本的公式
      { const away = w.isAway; w.isAway = (id) => id === banker.agentId || (away ? away.call(w, id) : false); B.rate = 0.15; B.rateAsk = null; const n0 = seen.length; BANK.setRate(w, B); o.away = { rate: Math.round(B.rate * 100), tg: Math.round(BANK.rateTarget(B) * 100), asked: seen.length - n0 }; w.isAway = away; }
      // 等回話隔天沒回音：照原本的公式
      { B.rate = 0.15; B.rateAsk = { d: day() - 1, done: 0 }; BANK.deskDaily(w, B, day()); o.fallback = { rate: Math.round(B.rate * 100), done: B.rateAsk.done }; }
      out.rate = o; }

    // ================= 4) 逾期還不出來的人 =================
    { const o = {}; clearLoans(); fund(); plain(banker); const mkLate = (a, extra) => { clearLoans(); fund(); const got = BANK.rawLend(w, B, a, 30, t('周轉')); const L = B.loans[a.agentId]; Object.assign(L, { due: day() - 15 }, extra || {}); setCash(a, 0); return L; };
      const house = Object.values(w.estate.units).find(u => u.owner && u.owner !== banker.agentId && u.owner !== A.agentId); const hOwn = house.owner;
      const askLate = (a) => { const L = B.loans[a.agentId]; return { L, handled: steady(() => BANK.lateAsk(w, B, a.agentId, L, day())) }; };
      const cL = (a) => ({ t: 'late', id: a.agentId, tok: B.loans[a.agentId]?.ask?.tok, d: day() });
      // 不讓它當場決定：先把問的那一步攔下來，看事實與選項
      const hold = (fn) => { const dr = DECIDE.drain; DECIDE.drain = () => {}; try { return fn(); } finally { DECIDE.drain = dr; DECIDE.S(w).q.length = 0; } };
      setAff(banker, A, 0); { const L = mkLate(A); hold(() => BANK.lateAsk(w, B, A.agentId, L, day())); const f = KB.facts(w, banker, cL(A)); texts.push(f); o.facts = { name: f.includes(t(A.name)), owed: f.includes(String(Math.round(L.owed))), late: f.includes('15'), cash: f.includes('0'), tie: f.includes(t('跟你不熟')), noColl: f.includes(t('這筆沒有抵押品。')) }; o.ids = idsOf(KB, banker, cL(A)); }
      { const L = mkLate(A, { ext: 2, waived: 1 }); hold(() => BANK.lateAsk(w, B, A.agentId, L, day())); o.idsMax = idsOf(KB, banker, cL(A)); }
      { house.owner = A.agentId; const L = mkLate(A, { collateral: house.id }); hold(() => BANK.lateAsk(w, B, A.agentId, L, day())); o.idsColl = idsOf(KB, banker, cL(A)); o.factsColl = KB.facts(w, banker, cL(A)).includes(t('這筆有拿他的房子抵押。')); house.owner = hOwn; }
      const runLate = (a, id, extra, pre) => { const L = mkLate(a, extra); if (pre) pre(); hold(() => BANK.lateAsk(w, B, a.agentId, L, day())); const cc = cL(a); const op = pick(KB, banker, cc, id); if (!op) return { none: id }; const bad0 = B.bad || 0, f0 = w.estate.stats.foreclosed || 0, ex0 = w.dark?.rep?.[a.agentId]?.exposed || 0, af0 = aff(a, banker); const owed0 = L.owed;
        const Lk = leak(() => op.run(w, banker, cc)); const L2 = B.loans[a.agentId]; return { res: tx(Lk.ret), leak: Lk.leak, loan: !!L2, due: L2 ? L2.due - day() : null, ext: L2?.ext || 0, owed0, owed: L2 ? L2.owed : null, waived: L2?.waived || 0, badD: Math.round((B.bad || 0) - bad0), forD: (w.estate.stats.foreclosed || 0) - f0, exD: (w.dark?.rep?.[a.agentId]?.exposed || 0) - ex0, affD: Math.round(aff(a, banker) - af0), ask: !!L2?.ask, mem: memOf(a).slice(-1)[0] || '' }; };
      o.extend = runLate(A, 'extend'); o.waive = runLate(A, 'waive'); o.writeoff = runLate(A, 'writeoff');
      house.owner = A.agentId; o.seize = runLate(A, 'seize', { collateral: house.id }); o.seize.owner = house.owner === banker.agentId; house.owner = hOwn;
      // 照個性：不熟又沒抵押的打成呆帳；有抵押的收房；家人、好朋友多半寬限
      const decideLate = (a, extra, pre) => { const L = mkLate(a, extra); if (pre) pre(); const n0 = seen.length; steady(() => BANK.lateAsk(w, B, a.agentId, L, day())); return seen.slice(n0).pop()?.id || null; };
      setAff(banker, A, 0); o.stranger = decideLate(A); house.owner = A.agentId; o.withColl = decideLate(A, { collateral: house.id }); house.owner = hOwn; setAff(banker, A, 70); o.friend = decideLate(A); setAff(banker, A, 0);
      { let n = 0, rule = 0; for (let i = 0; i < 30; i++) { const a = pool[i % pool.length]; setAff(banker, a, Math.round(R0() * 40 - 15)); const L = mkLate(a); const n0 = seen.length; BANK.lateAsk(w, B, a.agentId, L, day()); const e = seen.slice(n0).pop(); if (e) { n++; if (e.id === 'writeoff') rule++; } } o.crowd = { n, rule }; }
      // 等回話：這一天先不動、不重複問；隔天沒回音照原本的規則
      { const L = mkLate(A); hold(() => BANK.lateAsk(w, B, A.agentId, L, day())); const tok = L.ask?.tok; const n0 = BANK.D(B).st.late; const again = BANK.lateAsk(w, B, A.agentId, L, day()); o.pend = { again, sameTok: L.ask?.tok === tok, asked: BANK.D(B).st.late - n0, loan: !!B.loans[A.agentId] };
        L.ask.d = day() - 1; const next = BANK.lateAsk(w, B, A.agentId, L, day()); const bad0 = B.bad || 0; if (!next) BANK.lateRule(w, B, A.agentId, L, A); o.pend.next = next; o.pend.rule = !B.loans[A.agentId] && (B.bad || 0) > bad0; }
      { const away = w.isAway; w.isAway = (id) => id === banker.agentId || (away ? away.call(w, id) : false); const L = mkLate(A); o.away = BANK.lateAsk(w, B, A.agentId, L, day()); w.isAway = away; }
      clearLoans(); fund(); out.late = o; }

    // ================= 5) 擠兌時押多少自己的錢 =================
    { const o = {}; plain(banker); const saver = pool[4] || A2; const arm = () => { clearLoans(); B.status = 'run'; B.runDay = day(); B.run = { injected: 0, asked: null }; B.dep[saver.agentId] = 300; B.reserve = 100; setCash(banker, 200); };
      const cR = () => ({ t: 'run', tok: B.run?.inj?.tok, d: day() }); const hold = (fn) => { const dr = DECIDE.drain; DECIDE.drain = () => {}; try { return fn(); } finally { DECIDE.drain = dr; DECIDE.S(w).q.length = 0; } };
      arm(); hold(() => BANK.injAsk(w, B, banker, B.run, day())); const f = KB.facts(w, banker, cR()); texts.push(f); o.facts = { dep: f.includes(String(Math.round(BANK.totalDep(B)))), res: f.includes('100'), cash: f.includes('200'), all: f.includes('140') };
      o.ids = idsOf(KB, banker, cR()); o.closed = BANK.runInfo(w, saver) === null;
      const runInj = (id) => { arm(); hold(() => BANK.injAsk(w, B, banker, B.run, day())); const op = pick(KB, banker, cR(), id); const c0 = cash(banker), r0 = B.reserve; const L = leak(() => op.run(w, banker, cR())); return { injected: B.run.injected, cashD: Math.round(c0 - cash(banker)), resD: Math.round(B.reserve - r0), leak: L.leak, pend: !!B.run.inj }; };
      o.all = runInj('all'); o.half = runInj('half'); o.none = runInj('none');
      arm(); const n0 = seen.length; steady(() => BANK.injAsk(w, B, banker, B.run, day())); o.plainPick = seen.slice(n0).pop()?.id;
      withTraits(banker, ['greedy', 'thrifty']); arm(); const n1 = seen.length; steady(() => BANK.injAsk(w, B, banker, B.run, day())); o.greedyPick = seen.slice(n1).pop()?.id; plain(banker);
      // 等回話：銀行先關門一天；隔天沒回音照原本的規則掏七成
      arm(); hold(() => BANK.injAsk(w, B, banker, B.run, day())); o.pend = { wait: BANK.injAsk(w, B, banker, B.run, day()), closed: BANK.runInfo(w, saver) === null }; B.run.inj.d = day() - 1; o.pend.next = BANK.injAsk(w, B, banker, B.run, day()); if (!o.pend.next) BANK.inject(w, B, banker, B.run); o.pend.injected = B.run.injected;
      delete B.dep[saver.agentId]; B.status = 'ok'; B.run = null; fund(); out.brun = o; }

    // ================= 6) 房東 =================
    const E = ESTATE.S(w); const HH = () => ESTATE.households(w);
    { const o = {}; const hh = HH(); const heads = [...hh.keys()].map(id => w.agents[id]).filter(a => a && (a.age ?? 30) >= 18);
      const LL = heads.find(a => a !== banker && !ESTATE.ownsOf(w, a.agentId).length && E.home[a.agentId]) || heads[0]; plain(LL); setCash(LL, 80);
      const others = [...hh.keys()].filter(id => id !== ESTATE.headOf(w, LL).agentId && E.home[id] && !E.lodge[id]).slice(0, 3);
      const [h1, h2, h3] = others; const u1 = E.units[E.home[h1]], u2 = E.units[E.home[h2]], u3 = E.units[E.home[h3]]; const own0 = [u1.owner, u2.owner, u3.owner];
      u1.owner = LL.agentId; u2.owner = LL.agentId; u3.owner = null; // 第三間是公有房舍：對照組
      delete E.ll[LL.agentId]; delete E.llAsk[LL.agentId]; for (const h of [h1, h2]) { E.arrears[h] = 0; delete E.cut[h]; delete E.grace[h]; delete E.late[h]; }
      const H1 = w.agents[h1], H2 = w.agents[h2]; setAff(LL, H1, 60); setAff(LL, H2, 0); for (const m of hh.get(h2) || []) setAff(LL, m, Math.min(aff(LL, m), 0));
      const cR = () => ({ t: 'rent', d: day() }); const f = KL.facts(w, LL, cR()); texts.push(f);
      o.facts = { two: f.includes('2'), n1: f.includes(t(H1.name)), n2: f.includes(t(H2.name)), friend: f.includes(t('跟你是好朋友')), none: f.includes(t('跟你不熟')), r1: f.includes(String(ESTATE.rentOf(w, u1, h1))), cash: f.includes('80'), town: f.includes(String(Object.keys(E.units).length)), cur: f.includes(t('照行情')) };
      o.ids = idsOf(KL, LL, cR()); o.notLL = KL.options(w, H2, cR()).length;
      // 結算：檔位只套在他名下出租的房子；公有房舍、別人的房子不變
      const r = () => ({ u1: ESTATE.rentOf(w, u1, h1), u2: ESTATE.rentOf(w, u2, h2), u3: ESTATE.rentOf(w, u3, h3) });
      const base = r(); const runTier = (id) => { const op = pick(KL, LL, cR(), id); const ms = (HH().get(h2) || [H2]); const m0 = ms.map(memMark), a0 = aff(H2, LL); const L = leak(() => op.run(w, LL, cR())); return { rent: r(), tier: E.ll[LL.agentId]?.tier, kin: E.ll[LL.agentId]?.kin, leak: L.leak, mem: ms.flatMap((m, i) => memAfter(m, m0[i])), affD: aff(H2, LL) - a0, res: tx(L.ret) }; };
      o.base = base; o.hi = runTier('hi'); o.lo = runTier('lo'); o.mid = runTier('mid');
      o.idsKin = idsOf(KL, LL, cR()); o.kin = runTier('kin'); o.idsKinOn = idsOf(KL, LL, cR()); o.nokin = runTier('nokin');
      o.raw = { hi: Math.max(2, Math.round(base.u2 * 1.15)), lo: Math.max(2, Math.round(base.u2 * 0.85)) };
      // 介面與村民看到的房租跟著變
      E.ll[LL.agentId] = { tier: 'hi', kin: 1, d: day(), by: LL.agentId }; o.brief = { h1: ESTATE.brief(w, H1).includes(String(ESTATE.rentOf(w, u1, h1))), h2: ESTATE.brief(w, H2).includes(String(ESTATE.rentOf(w, u2, h2))), kinCheaper: ESTATE.rentOf(w, u1, h1) < ESTATE.rentOf(w, u1) };
      delete E.ll[LL.agentId];
      // 照個性：照行情佔多數；貪心的偏貴、心腸好又慷慨的偏便宜
      const share = (tr, vs) => { const p0 = JSON.stringify(LL.personality); const c = {}; for (let i = 0; i < 40; i++) { LL.personality.traits = tr.slice(); LL.personality.values = (vs || []).slice(); delete E.ll[LL.agentId]; const os = KL.options(w, LL, cR()); const Ln = DECIDE.lean(w, LL); let best = null, bs = -1e9; for (const op of os) { const s = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } c[best.id] = (c[best.id] || 0) + 1; } Object.assign(LL.personality, JSON.parse(p0)); return c; };
      setAff(LL, H1, 0); o.plainShare = share([]); o.greedyShare = share(['greedy'], ['財富']); o.kindShare = share(['kind', 'generous']);
      { const TR = ['greedy', 'kind', 'thrifty', 'generous', 'neurotic', 'optimist', 'stoic', 'lazy', 'hardworking', 'ambitious', 'charismatic', 'shy']; const p0 = JSON.stringify(LL.personality); const c = {}; for (let i = 0; i < 60; i++) { LL.personality.traits = TR.filter(() => R0() < 0.2); delete E.ll[LL.agentId]; const os = KL.options(w, LL, cR()); const Ln = DECIDE.lean(w, LL); let best = null, bs = -1e9; for (const op of os) { const s = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } c[best.id] = (c[best.id] || 0) + 1; } Object.assign(LL.personality, JSON.parse(p0)); o.crowd = c; }
      plain(LL); setAff(LL, H1, 60);
      // 什麼時候問：剛變成房東先問一次，同一天不再問；之後照人錯開，28 天一次
      { delete E.ll[LL.agentId]; delete E.llAsk[LL.agentId]; const n0 = seen.length; steady(() => ESTATE.llDaily(w, day())); const got = seen.slice(n0).filter(x => x.k === 'landlord' && x.who === LL.agentId).length; steady(() => ESTATE.llDaily(w, day())); const again = seen.slice(n0).filter(x => x.k === 'landlord' && x.who === LL.agentId).length; o.when = { first: got, again, askD: E.llAsk[LL.agentId] === day() }; }
      // 欠租
      const cLate = (h) => ({ t: 'late', hid: h, uid: E.home[h], tok: E.late[h]?.tok, d: day() }); const hold = (fn) => { const dr = DECIDE.drain; DECIDE.drain = () => {}; try { return fn(); } finally { DECIDE.drain = dr; DECIDE.S(w).q.length = 0; } };
      const owe = (h, u) => { E.arrears[h] = ESTATE.rentOf(w, u) * 3 + 2; delete E.grace[h]; delete E.cut[h]; delete E.late[h]; };
      const homeless = (h) => E.homeless[h] !== undefined; const back = (h, u) => { if (homeless(h)) { ESTATE.moveIn(w, h, u); } E.arrears[h] = 0; delete E.grace[h]; delete E.cut[h]; delete E.late[h]; };
      owe(h2, u2); hold(() => ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2))); const fl = KL.facts(w, LL, cLate(h2)); texts.push(fl);
      o.lateFacts = { name: fl.includes(t(H2.name)), owed: fl.includes(String(Math.round(E.arrears[h2]))), tie: fl.includes(t('跟你不熟')), rent: fl.includes(String(ESTATE.rentOf(w, u2, h2))) }; o.lateIds = idsOf(KL, LL, cLate(h2)); o.notEvicted = !homeless(h2) && !!E.late[h2];
      const runLate = (id) => { back(h2, u2); owe(h2, u2); hold(() => ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2))); const op = pick(KL, LL, cLate(h2), id); if (!op) return { none: id }; const a0 = aff(H2, LL), ar0 = E.arrears[h2], m0 = memMark(H2); const L = leak(() => op.run(w, LL, cLate(h2)));
        const st = { homeless: homeless(h2), grace: E.grace[h2] ? E.grace[h2].until - day() : null, cut: !!E.cut[h2], ar0: Math.round(ar0), ar: Math.round(E.arrears[h2] || 0), affD: aff(H2, LL) - a0, mem: memAfter(H2, m0), leak: L.leak, pend: !!E.late[h2] };
        if (id !== 'evict') { ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2)); st.afterWeek = homeless(h2); } return st; };
      o.evict = runLate('evict'); o.grace = runLate('grace'); o.cut = runLate('cut'); o.cut.rent = ESTATE.rentOf(w, u2, h2); o.cut.list = ESTATE.rentOf(w, u2); o.halve = runLate('halve');
      // 寬限兩次之後不再列寬限
      back(h2, u2); owe(h2, u2); hold(() => ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2))); E.grace[h2] = { uid: u2.id, until: day() - 1, n: 2 }; o.idsGrace2 = idsOf(KL, LL, cLate(h2));
      // 照個性與交情：不熟的多半趕，好朋友的多半不趕
      const decide = (h, u) => { back(h, u); owe(h, u); const n0 = seen.length; steady(() => ESTATE.overdue(w, u, h, ESTATE.rentOf(w, u))); return seen.slice(n0).pop()?.id || null; };
      setAff(LL, H2, 0); o.strangerPick = decide(h2, u2); for (const m of hh.get(h2) || []) setAff(LL, m, 65); o.friendPick = decide(h2, u2); for (const m of hh.get(h2) || []) setAff(LL, m, -40); o.foePick = decide(h2, u2); for (const m of hh.get(h2) || []) setAff(LL, m, 0);
      { let n = 0, ev = 0; const TR = ['greedy', 'kind', 'thrifty', 'generous', 'neurotic', 'optimist', 'stoic']; const p0 = JSON.stringify(LL.personality); for (let i = 0; i < 30; i++) { LL.personality.traits = TR.filter(() => R0() < 0.2); setAff(LL, H2, Math.round(R0() * 30 - 10)); back(h2, u2); owe(h2, u2); hold(() => ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2))); const os = KL.options(w, LL, cLate(h2)); const Ln = DECIDE.lean(w, LL); let best = null, bs = -1e9; for (const op of os) { const s = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } n++; if (best.id === 'evict') ev++; } Object.assign(LL.personality, JSON.parse(p0)); o.crowdLate = { n, ev }; plain(LL); }
      // 公有房舍、房東不在鎮上：照原本的規則馬上趕
      { back(h3, u3); owe(h3, u3); const n0 = seen.length; ESTATE.overdue(w, u3, h3, ESTATE.rentOf(w, u3)); o.pub = { homeless: homeless(h3), asked: seen.length - n0 }; back(h3, u3); }
      { const away = w.isAway; w.isAway = (id) => id === LL.agentId || (away ? away.call(w, id) : false); back(h2, u2); owe(h2, u2); ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2)); o.away = { homeless: homeless(h2) }; w.isAway = away; back(h2, u2); }
      // 等回話：先不趕、不重複問；隔天沒回音照原本的規則
      { back(h2, u2); owe(h2, u2); hold(() => ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2))); const tok = E.late[h2]?.tok; ESTATE.overdue(w, u2, h2, ESTATE.rentOf(w, u2)); o.pend = { homeless: homeless(h2), same: E.late[h2]?.tok === tok };
        // 存讀檔帶著（掛著的、檔位、寬限）
        E.ll[LL.agentId] = { tier: 'lo', kin: 1, d: day(), by: LL.agentId }; E.grace[h1] = { uid: u1.id, until: day() + 9, n: 1 };
        const sv = JSON.parse(JSON.stringify(w.serialize())); const wB = new World(); wB.loadSave(sv); o.save = { late: wB.estate?.late?.[h2]?.tok === tok, ll: wB.estate?.ll?.[LL.agentId]?.tier, grace: wB.estate?.grace?.[h1]?.n }; wB.reset?.();
        E.late[h2].d = day() - 1; ESTATE.llDaily(w, day()); o.pend.next = homeless(h2); o.pend.cleared = !E.late[h2]; back(h2, u2); delete E.ll[LL.agentId]; delete E.grace[h1]; }
      // 舊存檔：沒有這幾格
      { const sv0 = JSON.parse(JSON.stringify(w.serialize())); for (const k of ['ll', 'llAsk', 'late', 'grace', 'cut']) delete sv0.estate[k]; delete sv0.bank.desk; if (sv0.procure) delete sv0.procure.sur; const wA = new World(); let err = null; try { wA.loadSave(sv0); o.old = { rent: ESTATE.rentOf(wA, wA.estate.units[u1.id], h1), view: ESTATE.view(wA).rent > 0, bank: !!BANK.view(wA) }; } catch (e) { err = String(e.message); } o.oldErr = err; wA.reset?.(); }
      u1.owner = own0[0]; u2.owner = own0[1]; u3.owner = own0[2]; restore(LL); out.ll = o; }

    // ================= 7) 藥廠 =================
    { const o = {}; const sp = w.stockpile; const comp = w.buildings.completed; const fake = { buildingKey: 'pharma_works', key: 'pharma_works', name: t('藥廠') }; if (!TECH.built(w, 'pharma_works')) comp.push(fake);
      const docs = npcs().filter(a => (a.age ?? 30) >= 18 && a !== banker); const doc = docs[5] || docs[0]; const jobs0 = npcs().map(a => [a, a.job]); for (const a of npcs()) if (a.job?.key === 'doctor' && a !== doc) a.job = new Job('farmer'); doc.job = new Job('doctor'); plain(doc);
      try { doc.skills.get('醫療').xp = xpForLevel(12); } catch (e) {}
      const BB = BIO.S(w); const cP = () => ({ d: day() }); sp.resources.herbs = 30; sp.resources.medicine = 2; BB.waste = [{ d: day() - 2, f: A.name }];
      o.doctor = BIO.doctorOf(w) === doc; const f = KP.facts(w, doc, cP()); texts.push(f); o.facts = { med: f.includes('2'), want: f.includes(String(Math.round(FLOW.want(w, 'medicine')))), herbs: f.includes('30'), waste: f.includes(t(A.name)) };
      o.ids = idsOf(KP, doc, cP()); sp.resources.herbs = 5; o.idsLow = idsOf(KP, doc, cP()); sp.resources.herbs = 30; o.notDoc = KP.options(w, A, cP()).length;
      const prod = (mode) => { BB.pharma = mode ? { mode, d: day(), by: doc.agentId } : null; BB.phAsk = day(); sp.resources.herbs = 30; sp.resources.medicine = 2; const n = BIO.pharmaRounds(w); for (let i = 0; i < n && sp.get('herbs') >= 2; i++) { sp.consume('herbs', 2, w.tickCount, 'x', 'production'); sp.add('medicine', 1, w.tickCount, 'x'); } return { n, med: sp.get('medicine') - 2, herbs: 30 - sp.get('herbs') }; };
      o.normal = prod('normal'); o.full = prod('full'); o.stop = prod('stop');
      // 真的跑一天藥廠（BIO.daily）
      { BB.pharma = { mode: 'full', d: day(), by: doc.agentId }; BB.phAsk = day(); sp.resources.herbs = 30; sp.resources.medicine = 2; BIO.daily(w); o.daily = { med: sp.get('medicine'), herbs: sp.get('herbs') }; }
      // 照個性與處境
      const pickP = (med, herbs, sick, waste) => { sp.resources.medicine = med; sp.resources.herbs = herbs; BB.waste = waste ? [{ d: day() - 1, f: A.name }] : []; const s0 = npcs().map(a => [a, a.isSick]); npcs().slice(0, sick).forEach(a => { a.isSick = true; }); BB.pharma = null; BB.phAsk = null; const n0 = seen.length; steady(() => BIO.pharmaRounds(w)); for (const [a, v] of s0) a.isSick = v; return seen.slice(n0).pop()?.id || null; };
      const want = Math.round(FLOW.want(w, 'medicine'));
      o.pickLow = pickP(0, 40, 4, false); o.pickHigh = pickP(want * 3, 40, 0, true); o.pickMid = pickP(want, 40, 0, false);
      // 一週只問一次
      { BB.pharma = null; BB.phAsk = null; const n0 = seen.length; steady(() => BIO.pharmaRounds(w)); steady(() => BIO.pharmaRounds(w)); o.once = seen.slice(n0).filter(x => x.k === 'pharmaWeek').length; }
      // 沒有醫生、醫生不在、決策核心沒開：照原本每天一輪
      { const away = w.isAway; w.isAway = (id) => id === doc.agentId || (away ? away.call(w, id) : false); BB.pharma = { mode: 'stop', d: day(), by: doc.agentId }; o.away = BIO.pharmaRounds(w); w.isAway = away; }
      { const on0 = DECIDE.on; DECIDE.on = () => false; BB.pharma = { mode: 'stop', d: day(), by: doc.agentId }; o.off = BIO.pharmaRounds(w); DECIDE.on = on0; }
      { doc.job = new Job('farmer'); BB.pharma = { mode: 'stop', d: day(), by: doc.agentId }; o.noDoc = BIO.pharmaRounds(w); doc.job = new Job('doctor'); }
      // 等回話那一天照常一輪，不重複問
      { const dr = DECIDE.drain; DECIDE.drain = () => {}; BB.pharma = null; BB.phAsk = null; const n0 = BIO.pharmaView(w).ask; o.pendRounds = BIO.pharmaRounds(w); const q = DECIDE.S(w).q.length; BIO.pharmaRounds(w); o.pendQ = { first: q, after: DECIDE.S(w).q.length }; DECIDE.drain = dr; DECIDE.S(w).q.length = 0; }
      BB.pharma = null; BB.phAsk = null; BB.waste = []; restore(doc); for (const [a, j] of jobs0) a.job = j; const i = comp.indexOf(fake); if (i >= 0) comp.splice(i, 1); sp.resources.medicine = 10; out.ph = o; }

    // ================= 8) 公倉多出來的貨 =================
    { const o = {}; const sp = w.stockpile; const P = PROCURE.S(w); const AU = w.autonomy; const SI = SHOP_ITEMS; const r = 'beer'; for (const x of PROCURE.SUR) sp.resources[x] = 0; const line = FLOW.keepLine(w, r, 80), keep = FLOW.keepLine(w, r, 50); const mid = Math.round((line + keep) / 2);
      const D = PROCURE.dealerOf(w); o.dealer = !!D; const dl = D?.a; plain(dl);
      const reset = (n) => { sp.resources[r] = n; P.sur = null; P.surAsk = null; P.surDay = null; };
      // 量這筆出售本身的進帳（日誌記的金額），不是公庫前後的淨差：同一步驟公庫可能也買了別的東西
      const day1 = () => { const b0 = sp.get(r), n0 = logs().length; let gain = 0, gainN = 0; const L0 = w.logMessageT; w.logMessageT = function (type, k, p2, ...rest) { if (/多出來的\{item\}/.test(String(k))) { gain += +p2?.gain || 0; gainN++; } return L0.call(this, type, k, p2, ...rest); }; let L; try { L = leak(() => AU._shop(w)); } finally { w.logMessageT = L0; } return { sold: Math.round(b0 - sp.get(r)), silverD: Math.round(gain * 100) / 100, sales: gainN, leak: L.leak, logs: newLogs(n0).filter(x => x.includes('💰') || x.includes('🧾')) }; };
      reset(line + 40); const cS = () => ({ d: day(), by: dl.agentId }); const f = KS.facts(w, dl, cS()); texts.push(f); o.facts = { item: f.includes(SI[r].name()), n: f.includes(String(line + 40)), line: f.includes(String(Math.round(line))), pub: f.includes(t('這是替鎮上做的買賣：付的是公庫的錢、動的是倉裡的貨，跟你自己口袋裡有多少錢沒有關係。')), silver: f.includes(String(Math.round(sp.get('silver')))) };
      o.ids = idsOf(KS, dl, cS()); o.notDealer = KS.options(w, banker === dl ? A : banker, cS()).length; reset(Math.round(line) - 1); o.none = KS.options(w, dl, cS()).length;
      const runMode = (mode) => { reset(line + 40); const op = pick(KS, dl, cS(), mode); op.run(w, dl, cS()); const a = day1(); P.surDay = null; const b = day1(); return { first: a, second: b, plan: P.sur?.mode }; };
      o.sell = runMode('sell'); o.half = runMode('half'); o.keep = runMode('keep'); o.price = SI[r].sellPrice;
      o.halfFloor = (() => { reset(mid + 2); P.sur = { mode: 'half', d: day(), by: dl.agentId, byName: dl.name }; return day1().sold; })();
      // 照個性：多半照原本的規則賣
      { reset(line + 40); const n0 = seen.length; steady(() => AU._shop(w)); o.plainPick = seen.slice(n0).pop()?.id; o.plainLog = logs().slice(-3).some(x => x.includes(t(dl.name))); }
      { let n = 0, sell = 0; const TR = ['greedy', 'kind', 'thrifty', 'generous', 'neurotic', 'optimist', 'stoic']; const p0 = JSON.stringify(dl.personality); for (let i = 0; i < 30; i++) { dl.personality.traits = TR.filter(() => R0() < 0.25); reset(line + 40); const os = KS.options(w, dl, cS()); const Ln = DECIDE.lean(w, dl); let best = null, bs = -1e9; for (const op of os) { const s = DECIDE.score(Ln, op) + (R0() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } n++; if (best.id === 'sell') sell++; } Object.assign(dl.personality, JSON.parse(p0)); o.crowd = { n, sell }; plain(dl); }
      // 一週只問一次、決定管七天
      { reset(line + 40); const n0 = seen.length; steady(() => AU._shop(w)); P.surDay = null; AU._shop(w); P.surDay = null; AU._shop(w); o.weekOnce = seen.slice(n0).filter(x => x.k === 'surplus').length; P.sur.d = day() - 7; P.surAsk = day() - 7; P.surDay = null; const n1 = seen.length; steady(() => AU._shop(w)); o.afterWeek = seen.slice(n1).filter(x => x.k === 'surplus').length; }
      // 決策核心沒開：照原本的規則賣、日誌不掛人名
      { const on0 = DECIDE.on; DECIDE.on = () => false; reset(line + 40); o.off = day1(); o.off.noName = o.off.logs.length > 0 && !o.off.logs.some(x => x.includes(t(dl.name))); DECIDE.on = on0; }
      // 等回話：今天先不賣、不重複問；隔天沒回音照規則賣（不掛人名）
      { const dr = DECIDE.drain; DECIDE.drain = () => {}; reset(line + 40); const a = day1(); const q = DECIDE.S(w).q.filter(x => x.kind === 'surplus').length; P.surDay = null; const b = day1(); DECIDE.drain = dr; DECIDE.S(w).q.length = 0; P.surAsk = day() - 1; P.surDay = null; const c = day1(); o.pend = { first: a.sold, q, again: b.sold, next: c.sold, noName: c.logs.length > 0 && !c.logs.some(x => x.includes(t(dl.name))), asks: P.st.surAsks }; }
      // 提案今天剛賣過這一樣：不再自動賣；他選了留著，提案通過照樣賣
      { reset(line + 40); P.sur = { mode: 'sell', d: day(), by: dl.agentId, byName: dl.name }; const fakeP = { id: 'PX', kind: 'market', side: 'sell', refKey: r, status: 'done', resolvedDay: day(), qty: 10 }; w.proposals.items.push(fakeP); o.voted = day1().sold; w.proposals.items.splice(w.proposals.items.indexOf(fakeP), 1);
        reset(line + 40); P.sur = { mode: 'keep', d: day(), by: dl.agentId, byName: dl.name }; const b0 = sp.get(r); const res = w.shop.sell(r, 10, w); o.voteKeep = { ok: !!res?.success, sold: Math.round(b0 - sp.get(r)), autoAfter: day1().sold }; }
      // 存讀檔
      { P.sur = { mode: 'half', d: day(), by: dl.agentId, byName: dl.name }; P.surAsk = day(); const sv = JSON.parse(JSON.stringify(w.serialize())); const wB = new World(); wB.loadSave(sv); o.save = { mode: wB.procure?.sur?.mode, ask: wB.procure?.surAsk === day() }; wB.reset?.(); }
      reset(0); restore(dl); out.sur = o; }

    // ================= 9) 借錢申請的存讀檔：掛著的申請讀檔後不卡住，隔天照規則 =================
    { const o = {}; clearLoans(); fund(); plain(banker); setAff(banker, A, 0); w.dark.rep[A.agentId] = {}; /* 前面打成呆帳時被揭過底，這裡要的是一般的借款人 */ const c = mkApp(A, 30, t('周轉')); const sv = JSON.parse(JSON.stringify(w.serialize())); const wB = new World(); wB.loadSave(sv);
      o.kept = !!wB.bank?.desk?.apply?.[A.agentId]; const ap = wB.bank.desk.apply[A.agentId]; ap.d = day() - 1; wB.decide = wB.decide || {}; if (wB.decide.q) wB.decide.q.length = 0; const c0 = wB.wallet?.bal?.[A.agentId] || 0; o.dbg = { loan: !!wB.bank.loans[A.agentId], can: BANK.lendable(wB.bank), ref: wB.bank.refused?.[A.agentId] ?? null, rep: wB.dark?.rep?.[A.agentId] || null, aff: Math.round(aff(wB.agents[wB.bank.banker], wB.agents[A.agentId])), st: Object.assign({}, wB.bank.desk.st) }; BANK.deskDaily(wB, wB.bank, day()); o.dbg.st2 = Object.assign({}, wB.bank.desk.st); o.after = { pend: !!wB.bank.desk.apply[A.agentId], loan: wB.bank.loans[A.agentId]?.principal || 0, cashD: Math.round((wB.wallet?.bal?.[A.agentId] || 0) - c0) }; wB.reset?.();
      // 同一個世界：等回話（還在佇列裡）的那一天不重複問；隔天就照規則
      const n0 = BANK.D(B).st.asks; const again = BANK.lend(w, B, A, 30, t('周轉')); o.dup = { got: again, asks: BANK.D(B).st.asks - n0 }; BANK.D(B).apply[A.agentId].d = day() - 1; BANK.deskDaily(w, B, day()); o.same = { pend: !!BANK.pendingOf(w, A), loan: B.loans[A.agentId]?.principal || 0 };
      clearLoans(); fund(); out.save = o; }

    // ================= 10) 開智能體：題目送出、回答被採用、英文沒有中文 =================
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; let reply = null; ce._askJson = async (p) => { prompts.push(String(p)); return reply; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { X.lastDay = day(); X._cDay = day(); X._asked = 0; X._kAsked = {}; X._gAsked = {};
        // 借錢：申請先掛著、回 0；AI 選「只借一半」，回話來了才撥款
        clearLoans(); fund(); plain(banker); reply = [{ n: 1, pick: 'half', why: 'model reason 61', feel: 'careful' }]; const c0 = cash(A); const got = BANK.lend(w, B, A, 40, t('開店')); const pend = !!BANK.pendingOf(w, A); const wait = BANK.lendReply(B, A);
        DECIDE.drain(w, X, day()); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); if (wait) await Promise.race([wait, new Promise(r2 => setTimeout(r2, 500))]);
        const lg = (X.log[banker.agentId] || []).filter(x => x.kind === 'bankDesk').pop();
        o.loan = { got, pend, wait: !!wait, after: B.loans[A.agentId]?.principal || 0, cashD: Math.round(cash(A) - c0), pendAfter: !!BANK.pendingOf(w, A), ai: lg?.ai, why: lg?.why?.raw, work: X._gAsked.work || 0 };
        const p = prompts[0] || ''; const i0 = p.indexOf(t('【遇到的事】')); const part = i0 >= 0 ? p.slice(i0) : p; o.p1 = { n: prompts.length, facts: part.includes('40'), codes: /lend＝/.test(p) && /half＝/.test(p) && /refuse＝/.test(p), cjk: /[一-鿿]/.test(p), sample: (p.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 小額、看病的急用：當場照個性決定，不送題目；90 銀幣的非看病借款才送題目、回答後才撥款
        { clearLoans(); fund(); plain(banker); for (const a of [A2, A3, A4]) { setAff(banker, a, 0); w.dark.rep[a.agentId] = {}; } X._gAsked = {}; X._kAsked = {}; const np0 = prompts.length; const n0 = BANK.D(B).st.asks;
          const g25 = steady(() => BANK.lend(w, B, A2, 25, t('周轉'))); const gMed = steady(() => BANK.lend(w, B, A3, 60, t('看病'))); const npQuick = prompts.length - np0;
          const lgQ = (X.log[banker.agentId] || []).filter(x => x.kind === 'bankDesk').slice(-2).map(x => x.ai);
          reply = [{ n: 1, pick: 'lend', why: 'model reason 64' }]; const g60 = BANK.lend(w, B, A4, 90, t('周轉')); const pend60 = !!BANK.pendingOf(w, A4); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
          o.quick = { g25, gMed, npQuick, asked: BANK.D(B).st.asks - n0, logged: lgQ, g60, pend60, after60: B.loans[A4.agentId]?.principal || 0, np60: prompts.length - np0 - npQuick, why60: (X.log[banker.agentId] || []).filter(x => x.kind === 'bankDesk').pop()?.why?.raw }; clearLoans(); fund(); }
        // 房東定租金：AI 選「比行情便宜一點」
        const hh = HH(); const head = [...hh.keys()].map(id => w.agents[id]).find(a => a && (a.age ?? 30) >= 18 && a !== banker && a !== A && E.home[a.agentId]); const hid2 = [...hh.keys()].find(id => id !== ESTATE.headOf(w, head).agentId && E.home[id] && !E.lodge[id]); const u = E.units[E.home[hid2]]; const own0 = u.owner; u.owner = head.agentId; delete E.ll[head.agentId]; delete E.llAsk[head.agentId];
        reply = [{ n: 1, pick: 'lo', why: 'model reason 62' }]; const np = prompts.length; X._gAsked = {}; X._kAsked = {}; ESTATE.llDaily(w, day()); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.ll = { tier: E.ll[head.agentId]?.tier, ask: E.llAsk[head.agentId] === day(), prompts: prompts.length - np }; const p2 = prompts[np] || ''; o.p2 = { cjk: /[一-鿿]/.test(p2), codes: /mid＝/.test(p2) && /hi＝/.test(p2) && /lo＝/.test(p2), sample: (p2.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        u.owner = own0; delete E.ll[head.agentId];
        // 公倉：AI 選「先留著」
        const sp = w.stockpile; const D = PROCURE.dealerOf(w); const P = PROCURE.S(w); sp.resources.beer = FLOW.keepLine(w, 'beer', 80) + 40; P.sur = null; P.surAsk = null; P.surDay = null; reply = [{ n: 1, pick: 'keep', why: 'model reason 63' }]; const np3 = prompts.length; X._gAsked = {}; X._kAsked = {};
        w.autonomy._shop(w); const sold0 = sp.get('beer'); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); o.sur = { plan: P.sur?.mode, by: P.sur?.by === D?.a?.agentId, waited: sold0 === FLOW.keepLine(w, 'beer', 80) + 40, prompts: prompts.length - np3, civic: X._gAsked.civic || 0 }; const p3 = prompts[np3] || ''; o.p3 = { cjk: /[一-鿿]/.test(p3), sample: (p3.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        sp.resources.beer = 0; P.sur = null; P.surAsk = null; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; clearLoans(); fund(); out.ai = o; }

    // ================= 11) 放著跑 30 天 =================
    { restore(banker); for (const a of [A, A2, A3, A4]) restore(a); const errs0 = []; const n0 = seen.length; const d0 = day();
      MM.lastT = MONEY.total(w) - MM.pend; delete (MM.days[d0] || {}).other; // 前面為了測試直接改過帳：從這裡重新起算
      // 該定利率的日子：那一天銀行照常營業（擠兌的日子不定利率）、銀行家在鎮上。每一個這樣的日子都要有銀行家被問（rateAsk），而且最後都定出來：他自己決定的，或隔天照公式補上的都算
      let rateDays = 0; const rateMiss = [], asks = []; for (let i = 0; i < 30; i++) { const dd = w._absDay(); const due = (dd + 1) % 7 === 0 && w.bank?.open && !!BANK.teller(w, w.bank); /* 銀行家在、能拿主意（沒被關、決策核心開著）才由他定 */ try { for (let j = 0; j < 400 && w._absDay() === dd; j++) { w.paused = false; w.tick(); } } catch (e) { errs0.push(String(e.message)); } w.paused = true; const RA = w.bank?.rateAsk; if (due && w.bank.status === 'ok' && !(RA && RA.d === dd + 1)) { const rr = w.bank.lastRun; if (!(w.bank.lastRunEnd >= dd + 1 || (rr && rr.d === dd + 1))) rateMiss.push(dd + 1); } if (due && RA && RA.d === dd + 1) { rateDays++; asks.push(RA); } await new Promise(r2 => setTimeout(r2, 0)); }
      { const dd = w._absDay(); for (let j = 0; j < 400 && w._absDay() === dd; j++) { w.paused = false; w.tick(); } w.paused = true; } // 多跑一天：最後一次的利率如果銀行家沒回，隔天照公式補上
      const rateDone = asks.filter(x => x.done).length;
      const got = seen.slice(n0); let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      const by = {}; for (const e of got) { const k = e.k + '.' + e.t; by[k] = (by[k] || 0) + 1; }
      out.run = { rateDays, rateDone, rateMiss, errs: errs0.slice(0, 3), n: got.length, by, other: Math.round(other * 100) / 100, pend: Object.keys(B.desk?.apply || {}).length, bank: BANK.view(w).desk, ll: Object.keys(E.ll).length, landlords: ESTATE.landlords(w).size, rent: ESTATE.view(w).rent, sur: PROCURE.view(w).st.surAsks || 0 }; }
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-120);
    out.texts = texts.filter(Boolean).map(s => { try { return I18N.localizeNames ? I18N.localizeNames(s, true) : s; } catch (e) { return s; } });
    out.views = [BANK.view(w).why, ESTATE.brief(w, A), PROCURE.view(w).sur ? 'x' : ''].filter(Boolean);
    return out; });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on, `${tag} 城鎮開著：決策核心、銀行、房產都在`, { on: r.on });
  // 1
  { const R = r.reg; ok(R.every(Boolean) && R.every(x => x.scan === false) && R[0].group === 'work' && R[1].group === 'work' && R[2].group === 'civic' && R[3].group === 'civic', `${tag} 登記了銀行家坐櫃台、房東看自己的房子（work 組）、藥廠這週做多少藥、公倉多出來的貨（civic 組），都是該問的時候才送進來`, R);
    ok(r.groups.work === 6 && r.groups.civic === 6 && r.groups.deal === 20 && r.groups.max === 10, `${tag} 額度沒有改：work 6、civic 6、deal 20、全鎮 10`, r.groups); }
  // 2
  { const L = r.loan; ok(Object.values(L.facts).every(Boolean), `${tag} 借錢的事實：誰、借多少、做什麼用、工作、身上的錢、交情（好朋友／有過節／不熟）、好感、銀行的存款準備金呆帳`, L.facts);
    const has = (xs, ...ys) => ys.every(y => xs.includes(y)), none = (xs, ...ys) => ys.every(y => !xs.includes(y));
    ok(has(L.noHouse, 'lend', 'half', 'refuse') && none(L.noHouse, 'coll') && has(L.withHouse, 'coll') && none(L.mortgage, 'coll'), `${tag} 選項：照借、借一半、不借；有房子又沒抵押才列「要他拿房子抵押」，本來就是抵押貸款的不列`, { no: L.noHouse, house: L.withHouse, mort: L.mortgage });
    ok(L.stale === 0 && L.notBanker === 0, `${tag} 對不上號的申請、不是銀行家的人：沒有選項`, { stale: L.stale, nb: L.notBanker });
    ok(L.lend.got === 40 && L.lend.cashD === 40 && L.lend.resD === 40 && L.lend.leak === 0 && !L.lend.pend, `${tag} 照借：撥 40 銀幣（錢從準備金到借款人身上），申請不再掛著，錢沒有憑空多出來`, L.lend);
    ok(L.half.got === 20 && L.half.cashD === 20 && L.half.leak === 0, `${tag} 只借一半：撥 20 銀幣`, L.half);
    ok(L.coll.got === 40 && L.coll.houses.includes(L.coll.coll) && L.coll.leak === 0, `${tag} 要他拿房子抵押：照借，抵押品記上他的房子`, L.coll);
    ok(L.refuse.got === 0 && L.refuse.refused != null && L.refuse.affD < 0 && L.refuse.memHit && L.refuse.leak === 0, `${tag} 不借：沒撥款、記下被拒絕（十天內不再來碰釘子）、借款人記得是誰不借、對銀行家的觀感變差`, L.refuse);
    ok(L.plainLend.got === 30 && L.plainLend.asked === 1 && L.plainLend.by, `${tag} 照個性：一般的銀行家，名聲正常、不熟的人來借 30 銀幣，當場照借（BANK.lend 直接回撥款金額）`, L.plainLend);
    ok(L.exposed.got === 0 && L.foe.got === 0, `${tag} 照個性：被揭過兩次底的、跟銀行家有過節的，不借（跟原本的規則一樣）`, { exp: L.exposed, foe: L.foe });
    ok(L.crowd.n >= 30 && L.crowd.lent / L.crowd.n >= 0.75, `${tag} 一群隨機個性的銀行家遇到一般的借款人：多半照借（${L.crowd.lent}/${L.crowd.n}）`, L.crowd);
    ok(L.risky.other >= 6 && L.risky.other < L.risky.n, `${tag} 沒有工作又賴過帳的借款人：一部分被推到借一半、要抵押或不借（${L.risky.other}/${L.risky.n}）`, L.risky);
    ok(L.away.asked === 0 && L.away.got === 30 && L.off.asked === 0 && L.off.got === 30 && L.offRule.got === 0 && L.self.asked === 0 && L.self.loan === 30, `${tag} 銀行家不在鎮上、決策核心沒開、自己跟自己借：不問，照原本的規則（名聲太差照樣不借）`, { away: L.away, off: L.off, offRule: L.offRule, self: L.self });
    ok(L.biz.got >= 35 && L.biz.kind === 'biz' && L.biz.due === 45 && L.biz.lentD === L.biz.got, `${tag} 開店的貸款：四十五天、記進創業貸款，金額只記一次`, L.biz); }
  // 3
  { const R = r.rate; ok(Object.values(R.facts).every(Boolean), `${tag} 利率的事實：現在的利率、照帳算的合理利率、存款、準備金、自己身上的錢`, R.facts);
    ok(R.mid.length === 5 && !R.top.includes('up1') && !R.top.includes('up2') && !R.bottom.includes('down1') && !R.bottom.includes('down2') && R.near.includes('up1') && !R.near.includes('up2'), `${tag} 選項：調高 1%／2%、不動、調低 1%／2%，不超出 4%～20%`, { mid: R.mid, top: R.top, bottom: R.bottom, near: R.near });
    ok(R.up1.rate === 11 && R.up1.log && R.up1.leak === 0 && R.again === 0, `${tag} 調高 1%：10% → 11%，日誌有寫；這週定過了就不能再定`, R.up1);
    ok(R.farBelow === 'up2' && R.farAbove === 'down2' && R.atTarget === 'keep', `${tag} 照個性：比合理利率低很多就調高、高很多就調低、剛好就不動`, R);
    ok(R.greedyAvg > R.plainAvg && R.kindAvg < R.plainAvg, `${tag} 照個性：貪心的偏高（平均 ${R.greedyAvg}），心腸好又慷慨的偏低（${R.kindAvg}），一般的 ${R.plainAvg}`, R);
    ok(R.why && R.rateBy, `${tag} 介面上的利率理由是他這次決定的理由`, { why: R.why, by: R.rateBy });
    ok(R.away.asked === 0 && R.away.rate === R.away.tg && R.fallback.done === 1, `${tag} 銀行家不在：照原本的公式；等回話隔天沒回音也照公式`, { away: R.away, fb: R.fallback }); }
  // 4
  { const L = r.late; ok(Object.values(L.facts).every(Boolean), `${tag} 逾期的事實：誰、還欠多少、逾期幾天、身上的錢、交情、有沒有抵押`, L.facts);
    ok(L.ids.includes('extend') && L.ids.includes('waive') && L.ids.includes('writeoff') && !L.ids.includes('seize') && !L.idsMax.includes('extend') && !L.idsMax.includes('waive') && L.idsColl.includes('seize') && L.factsColl, `${tag} 選項：寬限（同一筆最多兩次）、免利息（一次）、打成呆帳；有抵押才列收房`, { ids: L.ids, max: L.idsMax, coll: L.idsColl });
    ok(L.extend.loan && L.extend.due === 0 && L.extend.ext === 1 && L.extend.affD > 0 && !L.extend.ask && L.extend.leak === 0, `${tag} 再寬限十天：這筆留著、再過十天才又算逾期、寬限次數加一、借款人觀感變好`, L.extend);
    ok(L.waive.loan && L.waive.owed < L.waive.owed0 && L.waive.waived === 1 && L.waive.affD > 0 && L.waive.leak === 0, `${tag} 利息不要了：欠款扣掉利息、再給十天`, L.waive);
    ok(!L.writeoff.loan && L.writeoff.badD === L.writeoff.owed0 && L.writeoff.exD === 1 && L.writeoff.affD < 0, `${tag} 打成呆帳：呆帳加上欠款、名聲受損（跟原本的規則一樣）`, L.writeoff);
    ok(!L.seize.loan && L.seize.forD === 1 && L.seize.owner && L.seize.badD === 0, `${tag} 收房：房子歸銀行家、不算呆帳（跟原本的規則一樣）`, L.seize);
    ok(L.stranger === 'writeoff' && L.withColl === 'seize' && L.friend === 'extend', `${tag} 照交情：不熟又沒抵押的打成呆帳、有抵押的收房、好朋友再寬限`, { s: L.stranger, c: L.withColl, f: L.friend });
    ok(L.crowd.n >= 25 && L.crowd.rule / L.crowd.n >= 0.6, `${tag} 隨機交情、隨機心情：多半照原本的規則打成呆帳（${L.crowd.rule}/${L.crowd.n}）`, L.crowd);
    ok(L.pend.again === true && L.pend.sameTok && L.pend.asked === 0 && L.pend.loan && L.pend.next === false && L.pend.rule, `${tag} 等回話：這一天先不動、不重複問；隔天沒回音照原本的規則`, L.pend);
    ok(L.away === false, `${tag} 銀行家不在：不問，照原本的規則`, L.away); }
  // 5
  { const R = r.brun; ok(Object.values(R.facts).every(Boolean) && R.ids.join() === 'all,half,none' && R.closed, `${tag} 擠兌：事實有存款、準備金、自己身上的錢、全押的數字；選項全押、押一半、不押；等他決定時銀行先關門`, { f: R.facts, ids: R.ids, closed: R.closed });
    ok(R.all.injected === 140 && R.all.cashD === 140 && R.all.resD === 140 && R.all.leak === 0 && R.half.injected === 70 && R.half.leak === 0 && R.none.injected === -1 && R.none.cashD === 0, `${tag} 全押拿出七成（140）、押一半（70）、不押（一毛都沒動），錢從銀行家身上到準備金`, { all: R.all, half: R.half, none: R.none });
    ok(R.plainPick === 'all' && R.greedyPick !== 'all', `${tag} 照個性：一般的銀行家全押（跟原本一樣）、又貪心又節儉的不全押`, { plain: R.plainPick, greedy: R.greedyPick });
    ok(R.pend.wait === true && R.pend.closed && R.pend.next === false && R.pend.injected === 140, `${tag} 等回話：銀行先關門；隔天沒回音照原本的規則掏七成`, R.pend); }
  // 6
  { const L = r.ll; ok(Object.values(L.facts).every(Boolean), `${tag} 房東的事實：名下幾棟、租給誰（好朋友／不熟）、收多少、鎮上幾棟房子、現在的定法、身上的錢`, L.facts);
    ok(L.ids.includes('mid') && L.ids.includes('hi') && L.ids.includes('lo') && L.ids.includes('kin') && !L.ids.includes('nokin') && L.notLL === 0, `${tag} 選項：照行情、貴一點、便宜一點；房客裡有自己人才列「自己人打八五折」；不是房東沒有選項`, { ids: L.ids, notLL: L.notLL });
    ok(L.hi.rent.u2 === L.raw.hi && L.hi.rent.u3 === L.base.u3 && L.hi.tier === 'hi' && L.hi.mem.some(x => x.includes(String(L.raw.hi))) && L.hi.affD < 0 && L.hi.leak === 0, `${tag} 貴一點：他名下出租的房子 ×1.15（${L.base.u2} → ${L.raw.hi}），公有房舍不變；房客記得漲租、觀感變差`, L.hi);
    ok(L.lo.rent.u2 === L.raw.lo && L.lo.rent.u3 === L.base.u3 && L.lo.mem.length > 0 && L.lo.affD > 0, `${tag} 便宜一點：×0.85，房客記得降租、觀感變好`, L.lo);
    ok(L.mid.rent.u2 === L.base.u2 && L.mid.rent.u1 === L.base.u1, `${tag} 照行情：回到原本的公式`, L.mid);
    ok(L.kin.rent.u1 === Math.max(2, Math.round(L.base.u1 * 0.85)) && L.kin.rent.u2 === L.base.u2 && L.kin.kin === 1 && L.idsKinOn.includes('nokin') && !L.idsKinOn.includes('kin') && L.nokin.rent.u1 === L.base.u1, `${tag} 自己人打八五折：只有好朋友那一戶便宜，另一戶照行情；之後可以改回一樣收`, { kin: L.kin, on: L.idsKinOn, nokin: L.nokin });
    ok(L.brief.h1 && L.brief.h2 && L.brief.kinCheaper, `${tag} 房客自己看到的房租（給 AI 的、介面的）跟實際收的一樣`, L.brief);
    const top = (c) => Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; const sum = (c) => Object.values(c).reduce((s, x) => s + x, 0);
    ok(top(L.plainShare) === 'mid' && (L.greedyShare.hi || 0) > (L.plainShare.hi || 0) && (L.kindShare.lo || 0) > (L.plainShare.lo || 0), `${tag} 照個性：一般的照行情；貪心的比較常收貴、心腸好又慷慨的比較常收便宜`, { plain: L.plainShare, greedy: L.greedyShare, kind: L.kindShare });
    ok((L.crowd.mid || 0) / sum(L.crowd) >= 0.55, `${tag} 一群隨機個性的房東：照行情佔多數（${L.crowd.mid || 0}/${sum(L.crowd)}），整體租金不會跳`, L.crowd);
    ok(L.when.first === 1 && L.when.again === 1 && L.when.askD, `${tag} 剛變成房東先問一次，同一天不再問`, L.when);
    ok(Object.values(L.lateFacts).every(Boolean) && ['evict', 'grace', 'cut', 'halve'].every(x => L.lateIds.includes(x)) && L.notEvicted, `${tag} 欠到三倍租金：事實有誰、欠多少、交情、房租；選項趕出去、寬限四週、打八折、免一半；等他決定時先不趕`, { f: L.lateFacts, ids: L.lateIds, ne: L.notEvicted });
    ok(L.evict.homeless && L.evict.affD < 0 && L.evict.mem.length > 0 && L.evict.leak === 0, `${tag} 趕出去：一家去睡廣場、記得被誰趕、觀感變差`, L.evict);
    ok(!L.grace.homeless && L.grace.grace === 28 && !L.grace.afterWeek && L.grace.affD > 0 && L.grace.mem.length > 0, `${tag} 寬限四週：這四週內再欠也不趕、觀感變好`, L.grace);
    ok(L.cut.cut && L.cut.rent === Math.max(2, Math.round(L.cut.list * 0.8)) && !L.cut.afterWeek && L.cut.affD > 0, `${tag} 打八折：這一戶的房租打八折（${L.cut.list} → ${L.cut.rent}）、這四週先不趕`, L.cut);
    ok(L.halve.ar === L.halve.ar0 - Math.floor(L.halve.ar0 / 2) && !L.halve.afterWeek && L.halve.affD > 0 && L.halve.leak === 0, `${tag} 免一半：欠租少一半，就不到三倍、不會被趕；沒有錢憑空出現`, L.halve);
    ok(!L.idsGrace2.includes('grace'), `${tag} 同一戶寬限過兩次，不再列寬限`, L.idsGrace2);
    ok(L.strangerPick === 'evict' && L.friendPick !== 'evict' && L.foePick === 'evict', `${tag} 照交情：不熟的、有過節的趕出去；好朋友不趕`, { s: L.strangerPick, f: L.friendPick, foe: L.foePick });
    ok(L.crowdLate.ev / L.crowdLate.n >= 0.6, `${tag} 隨機交情與個性：多半照原本的規則趕人（${L.crowdLate.ev}/${L.crowdLate.n}）`, L.crowdLate);
    ok(L.pub.homeless && L.pub.asked === 0 && L.away.homeless, `${tag} 公有房舍、房東不在鎮上：照原本的規則馬上趕`, { pub: L.pub, away: L.away });
    ok(!L.pend.homeless && L.pend.same && L.pend.next && L.pend.cleared, `${tag} 等回話：先不趕、不重複問；隔天沒回音照原本的規則趕`, L.pend);
    ok(L.save.late && L.save.ll === 'lo' && L.save.grace === 1 && !L.oldErr && L.old && L.old.rent > 0 && L.old.view, `${tag} 存讀檔帶著房東的檔位、寬限、掛著的欠租；舊存檔讀得進來，租金照行情`, { save: L.save, old: L.old, err: L.oldErr }); }
  // 7
  { const P = r.ph; ok(P.doctor && Object.values(P.facts).every(Boolean), `${tag} 藥廠：醫術最好的醫生；事實有藥、鎮上該備多少、藥草、最近為了廢水來吵的人`, { d: P.doctor, f: P.facts });
    ok(P.ids.join() === 'normal,full,stop' && !P.idsLow.includes('full') && P.notDoc === 0, `${tag} 選項：照常做、全力做（藥草夠才列）、先停；不是那位醫生沒有選項`, { ids: P.ids, low: P.idsLow });
    ok(P.normal.n === 1 && P.normal.med === 1 && P.full.n === 2 && P.full.med === 2 && P.full.herbs === 4 && P.stop.n === 0 && P.stop.med === 0, `${tag} 產量：照常一天一份、全力一天兩份（用掉四份藥草）、停工不做`, { n: P.normal, f: P.full, s: P.stop });
    ok(P.daily.med === 4 && P.daily.herbs === 26, `${tag} 真的跑一天藥廠（全力做）：藥 2 → 4、藥草 30 → 26`, P.daily);
    ok(P.pickLow === 'full' && P.pickHigh === 'stop' && P.pickMid === 'normal', `${tag} 照處境：藥不夠又很多人生病就全力做、藥很多又有人為廢水來吵就停、平常照常`, { low: P.pickLow, high: P.pickHigh, mid: P.pickMid });
    ok(P.once === 1, `${tag} 一週只問一次`, P.once);
    ok(P.away === 1 && P.off === 1 && P.noDoc === 1, `${tag} 醫生不在、決策核心沒開、沒有醫生：照原本每天一輪`, { away: P.away, off: P.off, nd: P.noDoc });
    ok(P.pendRounds === 1 && P.pendQ.first === 1 && P.pendQ.after === 1, `${tag} 等回話的那一天照常一輪、不重複問`, { r: P.pendRounds, q: P.pendQ }); }
  // 8
  { const S = r.sur; ok(S.dealer && Object.values(S.facts).every(Boolean), `${tag} 公倉：問出面談生意的人；事實有哪樣貨、多少、算多的門檻、錢進公庫跟自己口袋無關、公庫有多少`, S.facts);
    ok(S.ids.join() === 'sell,half,keep' && S.notDealer === 0 && S.none === 0, `${tag} 選項：賣掉、只賣一半、先留著；不是他、沒有多出來的貨：沒有選項`, { ids: S.ids, nd: S.notDealer, none: S.none });
    ok(S.sell.first.sold === 6 && S.sell.first.silverD === 6 * S.price && S.sell.first.sales === 1 && S.sell.first.leak === 0 && S.sell.first.logs.length > 0 && S.sell.second.sold === 6, `${tag} 賣掉：照原本的速度一天 6 份，錢（${6 * S.price}）進公庫，日誌有寫`, S.sell);
    ok(S.half.first.sold === 3 && S.halfFloor <= 2, `${tag} 只賣一半：一天 3 份，賣到剩門檻與 50 的中間就停`, { h: S.half, floor: S.halfFloor });
    ok(S.keep.first.sold === 0 && S.keep.second.sold === 0 && S.keep.plan === 'keep', `${tag} 先留著：這一週自動賣真的停了`, S.keep);
    ok(S.plainPick === 'sell' && S.plainLog && S.crowd.sell / S.crowd.n >= 0.7, `${tag} 照個性：多半照原本的規則賣（${S.crowd.sell}/${S.crowd.n}），他拿過主意的日誌掛他的名字`, { p: S.plainPick, log: S.plainLog, c: S.crowd });
    ok(S.weekOnce === 1 && S.afterWeek === 1, `${tag} 一週最多問一次，決定管七天，過了再問`, { w: S.weekOnce, a: S.afterWeek });
    ok(S.off.sold === 6 && S.off.noName && S.off.leak === 0, `${tag} 決策核心沒開：照原本的規則賣，日誌不掛人名`, S.off);
    ok(S.pend.first === 0 && S.pend.q === 1 && S.pend.again === 0 && S.pend.next === 6 && S.pend.noName, `${tag} 等回話：今天先不賣、不重複問；隔天沒回音照規則賣（不掛人名）`, S.pend);
    ok(S.voted === 0 && S.voteKeep.ok && S.voteKeep.sold === 10 && S.voteKeep.autoAfter === 0, `${tag} 提案今天剛賣過這一樣就不再自動賣（同一批不賣兩次）；他選了留著，提案通過照樣賣、自動的照樣停`, { v: S.voted, k: S.voteKeep });
    ok(S.save.mode === 'half' && S.save.ask, `${tag} 存讀檔帶著這一週的決定`, S.save); }
  // 9
  { const S = r.save; ok(S.kept && !S.after.pend && S.after.loan === 30 && S.after.cashD === 30, `${tag} 掛著的借錢申請存檔讀檔後還在；隔天沒回音照原本的規則撥款，不會卡死`, S);
    ok(S.dup.got === 0 && S.dup.asks === 0 && !S.same.pend && S.same.loan === 30, `${tag} 等回話時同一個人再來申請不重複問；隔天照規則`, S); }
  // 10
  { const M = r.ai; ok(M.aiOn && M.loan && M.loan.got === 0 && M.loan.pend && M.loan.wait && M.loan.after === 20 && M.loan.cashD === 20 && !M.loan.pendAfter && M.loan.ai === 1 && M.loan.why === 'model reason 61' && M.loan.work >= 1, `${tag} 開智能體：申請先掛著（回 0、開店的人有得等），AI 選「只借一半」才撥 20 銀幣，用的是 work 組的額度`, M.loan);
    { const Q = M.quick || {}; ok(Q.g25 > 0 && Q.g25 < 40 && Q.gMed >= 40 && Q.npQuick === 0 && Q.logged.length === 2 && Q.logged.every(x => x === 0), `${tag} 開智能體時，25 銀幣周轉和看病的借款由銀行家當場照個性決定、有撥款、沒有送題目，「做過的決定」照樣記`, Q);
      ok(Q.g60 === 0 && Q.pend60 && Q.np60 === 1 && Q.after60 >= 60 && Q.why60 === 'model reason 64', `${tag} 90 銀幣的非看病借款：送出題目、先掛著，回答後才撥款`, Q); }
    ok(M.p1 && M.p1.n >= 1 && M.p1.facts && M.p1.codes, `${tag} 題目裡有借款的數字和選項代號`, M.p1);
    ok(M.ll && M.ll.tier === 'lo' && M.ll.prompts === 1 && M.p2.codes && M.sur && M.sur.plan === 'keep' && M.sur.by && M.sur.waited && M.sur.civic >= 1, `${tag} 房東定租金、公倉賣不賣：題目送出、回答被採用（便宜一點、先留著），公倉等回話那一天先不賣，用 civic 組`, { ll: M.ll, sur: M.sur });
    ok(zh || (M.p1 && !M.p1.cjk && !M.p2.cjk && !M.p3.cjk), `${tag} 英文題目裡沒有中文`, zh ? null : { p1: M.p1?.sample, p2: M.p2?.sample, p3: M.p3?.sample }); }
  // 11
  { const R = r.run; ok(R.errs.length === 0 && R.other === 0 && R.n >= 3 && R.rateDays >= 1 && R.rateDone === R.rateDays && R.rateMiss.length === 0 && R.pend === 0, `${tag} 放著跑 30 天：銀行家每週定利率、各種事有人決定、沒有錯誤、帳上沒有對不上的錢、沒有卡住的申請`, R); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk) && !r.views.some(cjk)), `${tag} 給當事人看的事實、選項、理由、結果、介面都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 4), seen: r.seenTexts.filter(cjk).slice(0, 4), views: r.views.filter(cjk) });
  console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
