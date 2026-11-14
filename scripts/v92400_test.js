// v9.24.0 決策核心批次 B（股份與借貸）
// 買斷處不來的股東、帳上動不動手腳、帶頭合股買公營產業、工人認不認股、拿房子去抵押、擠兌時領不領、買不買債券：改由本人決定，不再擲骰。
// 驗：六個選擇點都登記了＋「手頭很緊」多一個抵押的選項、每日／每週流程不再擲骰、
//     每個選項的結算、個性與處境不同分數不同、AI 版、銀幣守恆、存讀檔、中英文
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  console.log(`— ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const ce = w.conversationEngine;
    for (let d = 0; d < 2; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    w.fullAgentMode = false; app._fullAgentOn = () => w.fullAgentMode;
    const holder = w.election._officeHolder(w);
    const adults0 = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const pool = adults0.filter(a => a !== holder && !String(a.agentId).startsWith('imm_') && a.job?.key !== 'priest');
    const [A, B, C, D, E, F, G, H] = pool; // A 當家、B 股東、C D G 工人、E 朋友、F 銀行家、H 屋主
    const Bal = w.wallet.bal; const X = DECIDE.S(w); const K = DECIDE.KINDS; const M = MARKET.S(w); const SM = SHARES.S(w); const SX = SM.sh; const Bk = BANK.S(w); const Es = ESTATE.S(w);
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const traits = (a, ts) => { a.personality.traits = ts.slice(); a.personality.values = []; if (a.dark) a.dark.liar = false; };
    const d0 = () => w._absDay();
    const logs = (n = 30) => (w.messageLog || []).slice(-n).map(m => (w.logText ? w.logText(m) : String(m.content || ''))).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const TEST = [A, B, C, D, E, F, G, H]; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const Kf = 'kitchen'; const NEW = ['buyout', 'cook', 'syndicate', 'staffshare', 'bankrun', 'bond'];
    const clean = () => {
      X.cool = {}; X.q = [];
      for (const a of all()) { Bal[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; a.mood = 50; if (a.job?.key === 'cook') a.job = new Job('guard'); }
      for (const a of TEST) { traits(a, ['hardworking']); a.age = 30; for (const b of TEST) if (a !== b) { rel(a, b, 0); } a.job = new Job('guard'); }
      for (const k of Object.keys(MARKET.SECTORS)) { M.owners[k] = 'gov_hold'; delete M.shares[k]; if (M.rival) delete M.rival[k]; } // 其他產業都算有主(不讓別家也被拿來合股)
      M.owners[Kf] = A.agentId; M.pay[Kf] = 1; M.hist[Kf] = Array.from({ length: 7 }, () => [60, 10]);
      for (const a of [C, D, G]) a.job = new Job('cook'); A.job = new Job('trader');
      SX.cheat = {}; SX.cook = {}; SX.law = {}; SX.ask = {}; SX.angry = {}; SX.dry = {};
      Object.assign(Bk, { open: true, status: 'ok', banker: F.agentId, reserve: 500, dep: {}, loans: {}, bonds: [], offer: null, run: null, rate: 0.08, bad: 0, lastIssue: -99, lastRunEnd: -99 });
      for (const u of Object.values(Es.units)) if (TEST.some(a => a.agentId === u.owner)) u.owner = null;
      if (w.mind?.amb) for (const a of TEST) delete w.mind.amb[a.agentId];
    };
    const sc = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); if (!c) return null; const op = K[key].options(w, a, c).find(o => o.id === id); return op ? Math.round(DECIDE.score(DECIDE.lean(w, a), op) * 100) / 100 : null; };
    const opt = (a, key, id, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).find(o => o.id === id) || null : null; };
    const go = (a, key, id, ctx) => { const o = opt(a, key, id, ctx); return o ? o.run(w, a) : null; };
    const ids = (a, key, ctx) => { const c = ctx || K[key].when(w, a); return c ? K[key].options(w, a, c).map(o => o.id) : null; };
    const texts = {}; const keep = (name, key, a, ctx) => { try { const c = ctx || K[key].when(w, a); texts[name] = { fact: K[key].facts(w, a, c), ops: K[key].options(w, a, c).map(o => [o.text, o.say, o.why]) }; } catch (e) { texts[name] = { err: String(e) }; } };
    const stake = (o) => { M.shares[Kf] = Object.fromEntries(Object.entries(o).map(([k, v]) => [({ A, B, C, D, E, G })[k].agentId, v])); };
    const pctOf = (a) => SHARES.pctOf(w, Kf, a.agentId);

    // ---------- 1) 登記 ----------
    out.kinds = { all: NEW.every(k => !!K[k]), share: DECIDE.share === true, on: DECIDE.on(w), scan: NEW.every(k => K[k].scan !== false), pinch: !!K.pinch };

    // ---------- 2) 合夥的股東處不來 ----------
    clean(); { stake({ A: 70, B: 30 }); rel(A, B, -50); rel(B, A, -50); Bal[A.agentId] = 500; const price = SHARES.priceOf(w, Kf, 30);
      const c1 = K.buyout.when(w, A); keep('buyout', 'buyout', A);
      out.buy = { ctx: c1 && c1.k === Kf && c1.o === B.agentId, ids: ids(A, 'buyout'), holder: K.buyout.when(w, B), price };
      const bear = sc(A, 'buyout', 'bear'), buy = sc(A, 'buyout', 'buy'); traits(A, ['hardworking', 'abrasive']); const buyA = sc(A, 'buyout', 'buy'); traits(A, ['hardworking', 'kind']); const bearK = sc(A, 'buyout', 'bear'); traits(A, ['hardworking']);
      Bal[A.agentId] = price + 5; const bearTight = sc(A, 'buyout', 'bear'); Bal[A.agentId] = price - 1; const poor = K.buyout.when(w, A); Bal[A.agentId] = 500; rel(A, B, 10); rel(B, A, 10); const fine = K.buyout.when(w, A); rel(A, B, -50); rel(B, A, -50);
      out.buy.sc = { bear, buy, buyA, bearK, bearTight, poor, fine };
      // 每週流程交給本人：骰子再順也不會自己買斷
      const s0 = SX.st.split; fix(0.99, () => SHARES.weekly(w, all(), d0())); const kept = pctOf(B) === 30 && SX.st.split === s0;
      const b0 = Bal[B.agentId]; let res = null; const cons = conserved(() => { res = go(A, 'buyout', 'buy'); });
      out.buy.run = { kept, res: res?.k, mine: pctOf(A), his: pctOf(B), paid: Math.round(Bal[B.agentId] - b0), cons, split: SX.st.split - s0, log: /買斷|buy out/.test(logs(6)), after: K.buyout.when(w, A) };
    }

    // ---------- 3) 這週的帳要不要少報一點 ----------
    clean(); { stake({ A: 70, B: 30 }); traits(A, ['hardworking']); const honestMan = K.cook.when(w, A); traits(A, ['greedy']); const c1 = K.cook.when(w, A); keep('cook', 'cook', A);
      out.cook = { honestMan, ctx: c1 && c1.k === Kf, ids: ids(A, 'cook'), holder: K.cook.when(w, B) };
      const honest = sc(A, 'cook', 'honest'), cook = sc(A, 'cook', 'cook'); SX.law.audit = true; const honestAudit = sc(A, 'cook', 'honest'); keep('cookAudit', 'cook', A); SX.law.audit = false; Bal[A.agentId] = 5; const cookPoor = sc(A, 'cook', 'cook'); Bal[A.agentId] = 30;
      traits(A, ['greedy', 'kind']); const honestKind = sc(A, 'cook', 'honest'); traits(A, ['greedy']);
      out.cook.sc = { honest, cook, honestAudit, cookPoor, honestKind };
      // 交給本人：沒打定主意，每週分紅再怎麼擲骰都照實分；打定主意，下次分紅才少報
      const c0 = SX.st.cheat; fix(0.01, () => SHARES.weekly(w, all(), d0())); const noPlan = SX.st.cheat - c0;
      const res = go(A, 'cook', 'cook'); const planned = SX.cook?.[Kf] === d0(); const again = K.cook.when(w, A);
      const c1b = SX.st.cheat; const consW = conserved(() => fix(0.99, () => SHARES.weekly(w, all(), d0()))); // 0.99：不會被翻帳本的股東抓到
      out.cook.run = { noPlan, res: res?.k, planned, again, cheat: SX.st.cheat - c1b, owed: !!SX.cheat[Kf], cleared: SX.cook?.[Kf] == null, consW };
      SX.cheat = {}; }

    // ---------- 4) 要不要帶頭合股買下公營產業 ----------
    clean(); { delete M.owners[Kf]; delete M.shares[Kf]; const price = SHARES.valueOf(w, Kf);
      Bal[A.agentId] = Math.round(price * 0.6); Bal[B.agentId] = Math.round(price * 0.5); Bal[E.agentId] = Math.round(price * 0.5); rel(B, A, 45); rel(E, A, 40);
      const c1 = K.syndicate.when(w, A); keep('syndicate', 'syndicate', A); const I = SHARES.synInfo(w, A);
      out.syn = { price, ctx: c1 && c1.k === Kf, ids: ids(A, 'syndicate'), friend: K.syndicate.when(w, B), parts: I ? I.parts.length : 0 };
      const pass = sc(A, 'syndicate', 'pass'), lead = sc(A, 'syndicate', 'lead'); traits(A, ['hardworking', 'ambitious']); const leadA = sc(A, 'syndicate', 'lead'); traits(A, ['hardworking', 'thrifty']); const passT = sc(A, 'syndicate', 'pass'); traits(A, ['hardworking']);
      out.syn.sc = { pass, lead, leadA, passT };
      // 每天的流程交給本人：骰子再順也沒有人自己湊錢買
      fix(0.01, () => SHARES.syndicate(w, all(), d0())); const untouched = !M.owners[Kf];
      let res = null; const cons = conserved(() => { res = go(A, 'syndicate', 'lead'); }); const s = M.shares[Kf] || {};
      out.syn.run = { untouched, res: res?.k, owner: M.owners[Kf] === A.agentId, holders: Object.keys(s).length, sum: Object.values(s).reduce((x, y) => x + y, 0), friendIn: (s[B.agentId] || 0) > 0, cons, log: logs(6).slice(-400), after: K.syndicate.when(w, A) };
      delete M.owners[Kf]; delete M.shares[Kf]; Bal[A.agentId] = Math.round(price * 0.6); Bal[B.agentId] = Math.round(price * 0.5); Bal[E.agentId] = Math.round(price * 0.5);
      // 朋友不夠、湊不齊：不會問他要不要帶頭
      delete M.owners[Kf]; delete M.shares[Kf]; Bal[A.agentId] = Math.round(price * 0.6); Bal[B.agentId] = 5; Bal[E.agentId] = 5; out.syn.short = K.syndicate.when(w, A); }

    // ---------- 5) 要不要認購自家店的股份 ----------
    clean(); { const price = SHARES.priceOf(w, Kf, 5); Bal[C.agentId] = price + 60; const off = K.staffshare.when(w, C); SX.law.staff = true;
      const c1 = K.staffshare.when(w, C); keep('staffshare', 'staffshare', C);
      out.staff = { off, price, ctx: c1 && c1.k === Kf, ids: ids(C, 'staffshare'), boss: K.staffshare.when(w, A), other: K.staffshare.when(w, E), poor: K.staffshare.when(w, D) };
      const keepS = sc(C, 'staffshare', 'keep'), buy = sc(C, 'staffshare', 'buy'); rel(C, A, 60); const buyF = sc(C, 'staffshare', 'buy'); rel(C, A, 0); traits(C, ['hardworking', 'thrifty']); const keepT = sc(C, 'staffshare', 'keep'); traits(C, ['hardworking']);
      out.staff.sc = { keepS, buy, buyF, keepT };
      const n0 = SX.st.staff || 0; fix(0.01, () => SHARES.weekly(w, all(), d0())); const untouched = pctOf(C) === 0;
      let res = null; const cons = conserved(() => { res = go(C, 'staffshare', 'buy'); });
      out.staff.run = { untouched, res: res?.k, pct: pctOf(C), boss: pctOf(A), cons, n: (SX.st.staff || 0) - n0, after: K.staffshare.when(w, C), log: /認購|stake/.test(logs(6)) };
    }

    // ---------- 6) 手頭很緊：名下有房子的人可以拿去抵押 ----------
    clean(); { const u = Object.values(Es.units)[0]; u.owner = H.agentId; Bal[H.agentId] = 3; Bal[G.agentId] = 3; const val = ESTATE.valueOf(w, u);
      const cH = K.pinch.when(w, H); const idH = ids(H, 'pinch'), idG = ids(G, 'pinch'); texts.mortgage = { fact: K.pinch.facts(w, H, cH), ops: K.pinch.options(w, H, cH).filter(o => o.id === 'mortgage').map(o => [o.text, o.say, o.why]) };
      const I = ESTATE.mortInfo(w, H); Bk.loans[H.agentId] = { owed: 10, principal: 10, rate: 0.1, day: d0(), due: d0() + 20 }; const loaned = ids(H, 'pinch').includes('mortgage'); delete Bk.loans[H.agentId];
      out.mort = { owner: idH.includes('mortgage'), tenant: idG.includes('mortgage'), n: I?.n, want: Math.round(val * 0.4), loaned };
      // 每天的流程交給本人：骰子再順銀行也不會自己把房子押進去
      fix(0.01, () => ESTATE.market(w)); const untouched = !Bk.loans[H.agentId];
      const r0 = Bk.reserve; let res = null; const cons = conserved(() => { res = go(H, 'pinch', 'mortgage'); }); const L = Bk.loans[H.agentId];
      out.mort.run = { untouched, res: res?.k, got: Math.round(Bal[H.agentId] - 3), col: L?.collateral === u.id, reserve: Math.round(r0 - Bk.reserve), cons, again: ids(H, 'pinch')?.includes('mortgage') || false };
      delete Bk.loans[H.agentId]; u.owner = null; }

    // ---------- 7) 銀行在擠兌 ----------
    clean(); { Bk.dep[C.agentId] = 100; Bk.reserve = 500; const calm = K.bankrun.when(w, C); Bk.status = 'run'; Bk.runDay = d0(); Bk.run = { injected: 0, asked: null };
      const c1 = K.bankrun.when(w, C); keep('bankrun', 'bankrun', C);
      out.run = { calm, ctx: !!c1, ids: ids(C, 'bankrun'), nodep: K.bankrun.when(w, D) };
      const stay = sc(C, 'bankrun', 'stay'), all2 = sc(C, 'bankrun', 'all'); rel(C, F, 60); const stayF = sc(C, 'bankrun', 'stay'); rel(C, F, 0); traits(C, ['hardworking', 'neurotic']); const allN = sc(C, 'bankrun', 'all'); traits(C, ['hardworking']);
      Bk.run.asked = 'pending'; const closed = K.bankrun.when(w, C); Bk.run.asked = null;
      out.run.sc = { stay, all: all2, stayF, allN, closed };
      // 每天的流程交給本人：骰子再順銀行也不會自己替存戶把錢領走
      fix(0.01, () => BANK.bankRun(w, Bk, d0())); const untouched = Bk.dep[C.agentId] === 100;
      const b0 = Bal[C.agentId]; let r1 = null; const cons1 = conserved(() => { r1 = go(C, 'bankrun', 'half'); }); const half = { res: r1?.k, got: Math.round(Bal[C.agentId] - b0), left: Bk.dep[C.agentId] };
      let r2 = null; const cons2 = conserved(() => { r2 = go(C, 'bankrun', 'all'); });
      out.run.run = { untouched, half, cons1, cons2, res: r2?.k, got: Math.round(Bal[C.agentId] - b0), left: Bk.dep[C.agentId] || 0, after: K.bankrun.when(w, C) };
      // 銀行沒錢了：領不到
      Bk.dep[D.agentId] = 80; Bk.reserve = 0; const r3 = go(D, 'bankrun', 'all'); out.run.dry = { res: r3?.k, left: Bk.dep[D.agentId] };
    }

    // ---------- 8) 銀行在賣債券 ----------
    clean(); { Bal[C.agentId] = 100; Bal[D.agentId] = 100; const none = K.bond.when(w, C);
      const ret = BANK.issueBonds(w, Bk, d0(), 80, false); const O = Bk.offer;
      const c1 = K.bond.when(w, C); keep('bond', 'bond', C); const I = BANK.bondInfo(w, C);
      rel(D, F, -20); const foe = K.bond.when(w, D); rel(D, F, 0); Bal[G.agentId] = 10; const poor = K.bond.when(w, G);
      out.bond = { none, ret, offer: !!O && O.goal === 80 && O.until === d0() + 2, sold0: Bk.bonds.length, ctx: !!c1, ids: ids(C, 'bond'), n: I?.n, banker: K.bond.when(w, F), foe, poor, logIssue: /債券|bond/i.test(logs(4)) };
      const passS = sc(C, 'bond', 'pass'), buy = sc(C, 'bond', 'buy'); rel(C, F, 50); const buyT = sc(C, 'bond', 'buy'); rel(C, F, 0); traits(C, ['hardworking', 'pessimist']); const passP = sc(C, 'bond', 'pass'); traits(C, ['hardworking']);
      out.bond.sc = { pass: passS, buy, buyT, passP };
      const r0 = Bk.reserve, b0 = Bal[C.agentId]; let res = null; const cons = conserved(() => { res = go(C, 'bond', 'buy'); });
      out.bond.run = { res: res?.k, paid: Math.round(b0 - Bal[C.agentId]), reserve: Math.round(Bk.reserve - r0), bonds: Bk.bonds.length, holder: Bk.bonds[0]?.holder === C.agentId, due: Bk.bonds[0]?.due === d0() + 30, raised: O.raised, cons, again: K.bond.when(w, C), nextN: BANK.bondInfo(w, D)?.n };
      // 認購期過了：公布賣了多少
      O.until = d0() - 1; const late = K.bond.when(w, D); fix(0.99, () => { Bk.lastDay = -1; BANK.daily(w); }); out.bond.close = { late, gone: !Bk.offer, log: /買了債券|bought bonds|bonds/i.test(logs(6)) };
      // 擠兌時發的債券：題目會講明
      Bk.bonds = []; BANK.issueBonds(w, Bk, d0(), 60, true); keep('bondRun', 'bond', D); out.bond.runRate = Bk.offer?.rate; Bk.offer = null;
    }

    // ---------- 9) 接到每天的決策流程（傾向版） ----------
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };
    const only = (...keepA) => { const s = new Set(keepA.map(a => a.agentId)); for (const a of all()) if (!s.has(a.agentId)) for (const k of Object.keys(K)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    const others = (a, keys) => { for (const k of Object.keys(K)) if (!keys.includes(k)) X.cool[a.agentId + '|' + k] = d0() + 9; };
    clean(); { Bk.dep[C.agentId] = 100; Bk.status = 'run'; Bk.runDay = d0(); Bk.run = { injected: 0, asked: null }; traits(C, ['neurotic', 'pessimist']); only(C); others(C, ['bankrun']);
      fix(0.5, () => today()); const e = lastLog(C); out.rule = { kind: e?.kind, id: e?.id, ai: e?.ai, left: Bk.dep[C.agentId] || 0, pick: X.pick['bankrun.all'] || 0 }; }

    // ---------- 10) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    clean(); w.fullAgentMode = true; { Bal[C.agentId] = 100; rel(C, F, -5); BANK.issueBonds(w, Bk, d0(), 80, false); only(C); others(C, ['bond']); prompts = [];
      reply = (p) => /在賣債券|selling bonds/.test(p) ? [{ n: 1, pick: 'b', why: 'W-BOND', next: 'N-NEXT' }] : null;
      today(); await DECIDE.flush(); await DECIDE.flush(); const e = lastLog(C); const pD = prompts.find(p => /在賣債券|selling bonds/.test(p)) || '';
      out.ai = { id: e?.id, ai: e?.ai, why: e?.why?.raw, bonds: Bk.bonds.length, plan: DECIDE.view(w, C).plan, menu: /other＝/.test(pD), money: /【錢】|\[Money\]/.test(pD), fact: /三十天|thirty days/.test(pD), cjk: /[一-鿿]/.test(pD), bits: (pD.match(/[^\n]{0,20}[一-鿿][^\n]{0,20}/g) || []).slice(0, 6) }; Bk.offer = null; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 11) 存讀檔、跑幾天 ----------
    clean(); { stake({ A: 70, B: 30 }); SX.cook[Kf] = d0(); BANK.issueBonds(w, Bk, d0(), 80, false);
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { cook: w2.market?.sh?.cook?.[Kf] === d0(), offer: w2.bank?.offer?.goal === 80 && !!w2.bank?.offer?.got }; Bk.offer = null; SX.cook = {}; }
    clean(); { let err = null; try { for (let d = 0; d < 8; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, q: X.q.length }; }
    // 每個選擇點的標題、事實、選項文字在英文版都有翻譯
    out.txt = (() => { const bad = []; const cjk = (s) => /[一-鿿]/.test(String(s || '')); const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; if (!en) return bad;
      const say = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : (() => { let s = t(x.k); for (const [a, b] of Object.entries(x.p || {})) s = s.split('{' + a + '}').join(typeof b === 'object' ? say(b) : (typeof b === 'string' ? t(b) : b)); return s; })()) : (typeof x === 'string' ? t(x) : '');
      for (const k of NEW) if (cjk(t(K[k].title))) bad.push('title:' + k);
      for (const [name, v] of Object.entries(texts)) { if (v.err) { bad.push('err:' + name + ':' + v.err); continue; } if (cjk(I18N.localizeNames(String(v.fact || ''), true))) bad.push('fact:' + name + ':' + v.fact);
        for (const row of v.ops) for (const x of row) { const s = I18N.localizeNames(say(x), true); if (cjk(s)) bad.push('opt:' + name + ':' + s); } }
      return bad; })();
    out.facts = Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.err ? 'ERR ' + v.err : String(v.fact || '').length]));
    out.nOps = Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.err ? -1 : v.ops.length]));
    return out;
  });
  const T = (lang) => `[${lang}] `; const L = T(lang);
  ok(r.kinds.all && r.kinds.share && r.kinds.on && r.kinds.scan && r.kinds.pinch, L + '六個選擇點都登記了，股份、銀行、房產三個系統都知道這些事交給本人', r.kinds);
  // 買斷
  ok(r.buy.ctx && r.buy.ids.join() === 'bear,buy' && !r.buy.holder, L + '買斷：只問當家（有處不來又買得起的股東時）', r.buy);
  ok(r.buy.sc.buyA > r.buy.sc.buy && r.buy.sc.bearK > r.buy.sc.bear && r.buy.sc.bearTight > r.buy.sc.bear && !r.buy.sc.poor && !r.buy.sc.fine, L + '買斷：脾氣衝的比較想買、心軟或買完手頭太緊的比較想忍；買不起或沒翻臉就不問', r.buy.sc);
  ok(r.buy.run.kept && r.buy.run.res && r.buy.run.mine === 100 && r.buy.run.his === 0 && r.buy.run.paid === r.buy.price && r.buy.run.cons && r.buy.run.split === 1 && r.buy.run.log && !r.buy.run.after, L + '買斷：每週流程不再擲骰；本人決定買，股份歸他、錢付給對方、銀幣守恆', r.buy.run);
  // 做帳
  ok(!r.cook.honestMan && r.cook.ctx && r.cook.ids.join() === 'honest,cook' && !r.cook.holder, L + '做帳：只問有股東要分紅、又動得了這種念頭的當家', r.cook);
  ok(r.cook.sc.honestAudit > r.cook.sc.honest + 0.9 && r.cook.sc.cookPoor > r.cook.sc.cook && r.cook.sc.honestKind > r.cook.sc.honest, L + '做帳：帳本公開後幾乎沒人敢、缺錢的比較想、心軟的比較不想', r.cook.sc);
  ok(r.cook.run.noPlan === 0 && r.cook.run.res && r.cook.run.planned && !r.cook.run.again && r.cook.run.cheat === 1 && r.cook.run.owed && r.cook.run.cleared && r.cook.run.consW, L + '做帳：沒打定主意就照實分（不擲骰）；打定主意後，下一次分紅才少報、只生效一次、銀幣守恆', r.cook.run);
  // 合股
  ok(r.syn.ctx && r.syn.ids.join() === 'pass,lead' && !r.syn.friend && r.syn.parts >= 2 && !r.syn.short, L + '合股：只問最有條件帶頭的人；朋友湊不齊就不問', r.syn);
  ok(r.syn.sc.leadA > r.syn.sc.lead && r.syn.sc.passT > r.syn.sc.pass, L + '合股：有企圖心的比較想帶頭、節儉的比較不想', r.syn.sc);
  ok(r.syn.run.untouched && r.syn.run.res && r.syn.run.owner && r.syn.run.holders >= 2 && r.syn.run.sum === 100 && r.syn.run.friendIn && r.syn.run.cons && !r.syn.run.after, L + '合股：每天的流程不再擲骰；本人決定帶頭，朋友出錢、他當家、銀幣守恆', r.syn.run);
  // 認股
  ok(!r.staff.off && r.staff.ctx && r.staff.ids.join() === 'keep,buy' && !r.staff.boss && !r.staff.other && !r.staff.poor, L + '認股：通過員工認股後，只問在那家做工、錢夠的工人', r.staff);
  ok(r.staff.sc.buyF > r.staff.sc.buy && r.staff.sc.keepT > r.staff.sc.keepS, L + '認股：跟老闆交情好的比較想買、節儉的比較想把錢留著', r.staff.sc);
  ok(r.staff.run.untouched && r.staff.run.res && r.staff.run.pct === 5 && r.staff.run.boss === 95 && r.staff.run.cons && r.staff.run.n === 1 && !r.staff.run.after, L + '認股：每週流程不再替工人決定；本人決定買，拿到 5%、錢付給當家、銀幣守恆', r.staff.run);
  // 抵押
  ok(r.mort.owner && !r.mort.tenant && r.mort.n === r.mort.want && !r.mort.loaned, L + '抵押：手頭很緊又有自己房子的人多一個選項（可借房價四成）；沒房子或已經有貸款的沒有', r.mort);
  ok(r.mort.run.untouched && r.mort.run.res && r.mort.run.got === r.mort.n && r.mort.run.col && r.mort.run.reserve === r.mort.n && r.mort.run.cons && !r.mort.run.again, L + '抵押：每天的流程不再擲骰；本人決定抵押，借到錢、房子記成抵押品、銀幣守恆', r.mort.run);
  // 擠兌
  ok(!r.run.calm && r.run.ctx && r.run.ids.join() === 'stay,half,all' && !r.run.nodep, L + '擠兌：只在擠兌時問有存款的人，可以不領、領一半、全領', r.run);
  ok(r.run.sc.stayF > r.run.sc.stay && r.run.sc.allN > r.run.sc.all && !r.run.sc.closed, L + '擠兌：信得過銀行家的比較願意不領、容易緊張的比較想全領；銀行暫停營業那天不問', r.run.sc);
  ok(r.run.run.untouched && r.run.run.half.res && r.run.run.half.got === 50 && r.run.run.half.left === 50 && r.run.run.got === 100 && r.run.run.left === 0 && r.run.run.cons1 && r.run.run.cons2 && !r.run.run.after, L + '擠兌：每天的流程不再替存戶領錢；本人決定領一半／全領，錢照數到手、銀幣守恆', r.run.run);
  ok(r.run.dry.res && r.run.dry.left === 80, L + '擠兌：銀行沒錢了就領不到，存款還記著', r.run.dry);
  // 債券
  ok(!r.bond.none && r.bond.ret === 0 && r.bond.offer && r.bond.sold0 === 0 && r.bond.ctx && r.bond.ids.join() === 'pass,buy' && r.bond.n === 40 && !r.bond.banker && !r.bond.foe && !r.bond.poor && r.bond.logIssue, L + '債券：發行後開賣兩天，不再當場擲骰；只問手上有錢、跟銀行家沒翻臉的人（最多買手上四成）', r.bond);
  ok(r.bond.sc.buyT > r.bond.sc.buy + 0.5 && r.bond.sc.passP > r.bond.sc.pass, L + '債券：信得過銀行家的比較想買、悲觀的比較不想', r.bond.sc);
  ok(r.bond.run.res && r.bond.run.paid === 40 && r.bond.run.reserve === 40 && r.bond.run.bonds === 1 && r.bond.run.holder && r.bond.run.due && r.bond.run.raised === 40 && r.bond.run.cons && !r.bond.run.again && r.bond.run.nextN === 40, L + '債券：本人決定買，錢進銀行準備金、三十天後到期、銀幣守恆；買過的不再問', r.bond.run);
  ok(!r.bond.close.late && r.bond.close.gone && r.bond.close.log && r.bond.runRate === 0.12, L + '債券：認購期過了就結算、公布賣了多少；擠兌時發的利息一成二', { c: r.bond.close, rate: r.bond.runRate });
  // 流程
  ok(r.rule.kind === 'bankrun' && r.rule.id === 'all' && r.rule.ai === 0 && r.rule.left === 0, L + '接到每天的決策流程：AI 沒開時照個性決定（容易緊張又悲觀的人把存款全領出來）', r.rule);
  ok(r.ai.id === 'buy' && r.ai.ai === 1 && r.ai.why === 'W-BOND' && r.ai.bonds === 1 && r.ai.plan === 'N-NEXT' && r.ai.menu && r.ai.money && r.ai.fact, L + 'AI 版：由 AI 決定買債券並說理由（就算他跟銀行家交情普通）', r.ai);
  if (!zh) ok(!r.ai.cjk, L + '英文版給 AI 的資料沒有中文', r.ai.bits);
  ok(r.save.cook && r.save.offer, L + '存讀檔：打定主意要動的帳、開賣中的債券都還在', r.save);
  ok(!r.days.err, L + '照常跑八天沒有錯誤', r.days);
  ok(Object.entries(r.facts).every(([k, v]) => typeof v === 'number' && v > (k === 'mortgage' ? 10 : 30)) && r.nOps.mortgage === 1, L + '每個選擇點都講得出事實', { f: r.facts, n: r.nOps });
  if (!zh) ok(r.txt.length === 0, L + '英文版：標題、事實、選項、理由都有翻譯', r.txt.slice(0, 6));
  ok(errs.length === 0, L + '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
