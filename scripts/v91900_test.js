// v9.19.0 決策核心（完整智能體模式的閉環，階段 0＋1）
// 帳本（【錢】【立場】【人際】【近況】【鎮上】【做過的決定】【打算】）、理財的三個選擇點、
// 傾向版（AI 不在時）、AI 版（選項、理由、打算、「其他：我想做的事」的白名單效果）、AI 沒回話的處理、
// 舊的擲骰迴圈已經拿掉、銀幣守恆、存讀檔、村民卡、中英文、手機
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`); const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const ce = w.conversationEngine;
    for (let d = 0; d < 3; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } // 跑三天,讓錢包、產業、關係都有東西
    w.fullAgentMode = false; const _fa = app._fullAgentOn; app._fullAgentOn = () => w.fullAgentMode; // 測試自己控制開關
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const B = w.wallet.bal; const X = DECIDE.S(w); const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend;
    const fix = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
    const conserved = async (f) => { const t0 = T(), p0 = P0(); await f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const rel = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const all = npcs(); const [A, Bb, C, D2, E, F, G] = all;
    const logs = (n = 40) => (w.messageLog || []).slice(-n).map(m => String(m.content || '')).join('\n');
    const lastLog = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null;
    const reset = () => { for (const a of all) { B[a.agentId] = 30; delete X.log[a.agentId]; delete X.plan[a.agentId]; } X.cool = {}; /* 這支只測錢的決定：v9.20.0 加的人際選擇點（scripts/v92000_test.js 在測）先全部冷卻，不然會多問 AI、多寫紀錄 */ for (const a of all) for (const k of Object.keys(DECIDE.KINDS).filter(k => !['spare', 'pinch', 'asked'].includes(k))) X.cool[a.agentId + '|' + k] = w._absDay() + 99; /* v9.21.0 政治的選擇點(scripts/v92100_test.js)也一樣 */ X.q = []; if (w.dark?.debts) w.dark.debts = []; if (w.infl) { w.infl.p = 1; w.infl.wage = 1; } };
    const today = () => { X.lastDay = -1; DECIDE.daily(w); };

    // ---------- 1) 帳本 ----------
    reset(); B[A.agentId] = 222; rel(A, Bb, 70); rel(A, C, -60); B[Bb.agentId] = 2;
    { const b = ce._agentBrief(w, A, null); const L = b.ledger; const m = b.mem; const flat = [...L.eco, ...L.pol, ...L.soc, ...L.self, ...L.world];
      out.ledger = { heads: m.map(s => (s.match(/^(【[^】]+】|\[[^\]]+\])/) || [''])[0]), eco: L.eco.length, soc: L.soc.length, cash: L.eco.some(s => s.includes('222')), friend: L.soc.join('|').includes(t(Bb.name)) || L.soc.join('|').includes(Bb.name), foe: L.soc.join('|').includes(C.name) || L.soc.join('|').includes(t(C.name)), dup: flat.length !== new Set(flat).size, tight: /手頭很緊|short of money/.test(L.soc.join('|')) }; }
    // 新系統登記一句話就進得了帳本
    DECIDE.source('eco', (ww, a) => a === A ? '測試來源：你有一張欠條' : ''); out.source = ce._agentBrief(w, A, null).ledger.eco.includes('測試來源：你有一張欠條');

    // ---------- 2) 傾向版:同一件事,不同的人選不一樣 ----------
    reset();
    const pickOf = (a) => fix(0.5, () => { const K = DECIDE.KINDS.spare; const c = K.when(w, a); if (!c) return null; const ops = K.options(w, a, c); const Ln = DECIDE.lean(w, a); return ops.slice().sort((x, y) => DECIDE.score(Ln, y) - DECIDE.score(Ln, x))[0].id; });
    A.personality.traits = ['glutton', 'optimist']; A.personality.values = ['冒險', '自由']; B[A.agentId] = 600; A.job = A.job?.key === 'mayor' ? null : A.job;
    Bb.personality.traits = ['ascetic', 'stoic', 'neurotic']; Bb.personality.values = ['傳統', '和平']; B[Bb.agentId] = 600; for (const o of all) { rel(Bb, o, 0); rel(A, o, 0); }
    out.lean = { a: DECIDE.lean(w, A), b: DECIDE.lean(w, Bb), pa: pickOf(A), pb: pickOf(Bb), ids: DECIDE.KINDS.spare.options(w, A, DECIDE.KINDS.spare.when(w, A)).map(o => o.id) };
    // 真的跑一天:有紀錄、錢守恆、花的錢流到該去的地方
    { const st0 = { ...SPEND.S(w).st }; out.dayCons = await conserved(() => fix(0.5, today)); const e = lastLog(A), e2 = lastLog(Bb);
      out.day = { a: e && e.id, aRes: e && !!e.res, b: e2 && e2.id, trip: (SPEND.S(w).st.tripN || 0) - (st0.tripN || 0), cashA: B[A.agentId] < 600, cashB: B[Bb.agentId], ai: e && e.ai, cool: X.cool[A.agentId + '|spare'] > w._absDay(), rule: X.st.rule > 0 };
      // 冷卻期內不再問同一件事
      const n0 = (X.log[A.agentId] || []).length; fix(0.5, today); out.day.again = (X.log[A.agentId] || []).length === n0; }

    // ---------- 3) 手頭很緊 → 跟朋友借 → 對方自己決定 ----------
    reset(); for (const o of all) for (const p of all) if (o !== p) rel(o, p, 0);
    C.personality.traits = ['kind']; C.personality.values = ['社群']; D2.personality.traits = ['shy']; D2.personality.values = ['家庭'];
    B[D2.agentId] = 2; B[C.agentId] = 200; rel(C, D2, 60); rel(D2, C, 60);
    { out.loanCons = await conserved(() => fix(0.5, today)); const e = lastLog(D2), l = lastLog(C);
      out.loan = { pick: e && e.id, res: e && e.res ? DECIDE.view(w, D2).rows[0].res : '', lender: l && l.id, lenderKind: l && l.kind, got: B[D2.agentId] > 2, paid: B[C.agentId] < 200, debt: (w.dark.debts || []).some(x => x.l === C.agentId && x.r === D2.agentId && x.cash && !x.done), q: X.q.length };
      // 帳本裡看得到這筆債和這個決定
      const L = ce._agentBrief(w, D2, null).ledger; out.loan.ledgerDebt = L.eco.join('|').includes(String((w.dark.debts.find(x => x.r === D2.agentId) || {}).n)); out.loan.ledgerDid = L.did.length >= 1; }
    // 被坑過的人不肯再借
    reset(); B[D2.agentId] = 2; B[C.agentId] = 200; rel(C, D2, 15); rel(D2, C, 60); C.personality.traits = ['stoic']; C.personality.values = ['財富'];
    (w.dark.wrongs = w.dark.wrongs || []).push({ by: D2.agentId, to: C.agentId, sev: 2, day: w._absDay() });
    { fix(0.5, today); const l = lastLog(C); out.refuse = { lender: l && l.id, got: B[D2.agentId] <= 2.01, res: (DECIDE.view(w, D2).rows[0] || {}).res || '' }; w.dark.wrongs = w.dark.wrongs.filter(x => !(x.by === D2.agentId && x.to === C.agentId)); }

    // ---------- 4) 舊的擲骰迴圈已經拿掉:沒有決策核心,宴客、旅遊、借錢、接濟都不會自己發生 ----------
    reset(); for (const a of all) B[a.agentId] = 500; B[E.agentId] = 1; for (const o of all) rel(o, E, 50); E.personality.traits = ['kind']; G.personality.traits = ['creative']; B[G.agentId] = 100;
    { const S0 = { ...SPEND.S(w).st }; const d0 = (w.dark.debts || []).length; const e0 = B[E.agentId]; const lg0 = (w.messageLog || []).length;
      fix(0.001, () => { for (let i = 0; i < 12; i++) { SPEND.S(w).lastDay = -1; SPEND.daily(w); } const W0 = WALLET.S(w); });
      const S1 = SPEND.S(w).st; const txt = (w.messageLog || []).slice(lg0).map(m => String(m.content || '')).join('\n');
      out.noDice = { feast: (S1.feastN || 0) - (S0.feastN || 0), trip: (S1.tripN || 0) - (S0.tripN || 0), art: (S1.artN || 0) - (S0.artN || 0), fee: (S1.feeN || 0) - (S0.feeN || 0), debts: (w.dark.debts || []).length - d0, show: (S1.showN || 0) - (S0.showN || 0), api: typeof INVEST.buyIns, src: !/Math\.random\(\) > 0\.02 \* thrift/.test(SPEND.daily.toString()) }; }

    // ---------- 5) AI 版 ----------
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = null;
    ce.fullAgentOk = () => true; ce._askJson = async (p) => { prompts.push(p); return typeof reply === 'function' ? reply(p) : reply; };
    const letterOf = (p, who, re) => { const blk = p.split('=== ').slice(1).find(s => s.includes(who)) || ''; /* 第 0 段是鎮況,裡面也可能提到這個人 */ const line = (blk.split('\n').find(s => /【可以選】|\[You can choose\]/.test(s)) || ''); const parts = line.split(' ／ '); for (const x of parts) { const m = x.match(/([\w:.-]+)＝(.*)$/); if (m && re.test(m[2])) return m[1]; /* v9.23.2 選項改用固定代號（＝前面那個字） */ } return ''; };
    const who = (a) => (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en' ? I18N.localizeNames(a.name, true) : a.name);
    // 5a) AI 選一個選項,附理由和打算
    reset(); w.fullAgentMode = true; B[F.agentId] = 600; F.job = F.job?.key === 'mayor' ? null : F.job; for (const o of all) rel(F, o, 0);
    reply = (p) => [{ n: 1, pick: letterOf(p, who(F), /去外地玩|trip/i), why: 'AIWHY想看看山的另一邊', next: 'AINEXT回來後開一間小店' }];
    { const st0 = SPEND.S(w).st.tripN || 0; const lg0 = (w.messageLog || []).length; prompts = []; out.aiCons = await conserved(async () => { today(); await DECIDE.flush(); }); const e = lastLog(F); const v = DECIDE.view(w, F); const p = prompts[0] || '';
      out.ai = { asked: prompts.length, id: e && e.id, ai: e && e.ai, why: v.rows[0]?.why, res: v.rows[0]?.res, plan: v.plan, trip: (SPEND.S(w).st.tripN || 0) - st0, log: (w.messageLog || []).slice(-12).some(m => String(m.content || '').includes('🧭') && String(m.content || '').includes('AIWHY')), mem: F.memory.entries.slice(-6).some(m => JSON.stringify(m).includes('AIWHY')),
        prompt: { money: /【錢】|\[Money\]/.test(p), people: /【人際】|\[People\]/.test(p), event: /【遇到的事】|\[What came up\]/.test(p), choose: /【可以選】|\[You can choose\]/.test(p), other: /other＝/.test(p), town: /【鎮況】|\[Town\]/.test(p), cjk: /[一-鿿]/.test(p), cjkBits: (p.match(/[^\n]{0,24}[一-鿿][^\n]{0,24}/g) || []).slice(0, 10) },
        planInLedger: (ce._agentBrief(w, F, null).mem || []).some(s => s.includes('AINEXT')) }; }
    // 5b) AI 選「其他」:自己想做的事,用白名單效果落地;不在白名單的不算
    reset(); B[F.agentId] = 400; B[G.agentId] = 10; rel(F, G, 10);
    reply = () => [{ n: 1, pick: 'z', why: 'AIWHY他幫過我', do: 'AIDO把錢分給老朋友', fx: [{ t: 'give', to: who(G), n: 9999 }, { t: 'rel', to: who(G), d: 8 }, { t: 'mint', n: 99999 }, { t: 'mood', d: 3 }] }];
    { const tot0 = T(); const f0 = X.st.free; const a0 = F.relationships.relationships[G.agentId].affinity; out.freeCons = await conserved(async () => { today(); await DECIDE.flush(); }); const e = lastLog(F); const v = DECIDE.view(w, F);
      out.free = { id: e && e.id, free: e && e.free, gave: Math.round(B[G.agentId] - 10), left: Math.round(B[F.agentId]), aff: F.relationships.relationships[G.agentId].affinity - a0, what: v.rows[0]?.what, res: v.rows[0]?.res, n: X.st.free - f0, total: Math.abs(T() - tot0) < 0.02, log: logs(8).includes('💭') }; }
    // 5c) 想做但遊戲裡做不到的:不會憑空發生,留成「打算」
    reset(); B[F.agentId] = 400; reply = () => [{ n: 1, pick: 'z', why: 'AIWHY', do: 'AIDO挖一條地道通到王都', fx: [{ t: 'tunnel', to: 'capital' }] }];
    { const c0 = B[F.agentId]; today(); await DECIDE.flush(); const v = DECIDE.view(w, F); out.dream = { plan: v.plan, same: B[F.agentId] === c0, res: v.rows[0]?.res }; }
    // 5d) AI 答非所問、亂選 → 傾向版頂上,不會卡住也不會亂做
    reset(); B[F.agentId] = 400; reply = () => [{ n: 1, pick: 'q', why: 'x' }];
    { const m0 = X.st.aiMiss; fix(0.5, today); await DECIDE.flush(); const e = lastLog(F); out.bad = { decided: !!e, ai: e && e.ai, miss: X.st.aiMiss - m0 }; }
    reset(); B[F.agentId] = 400; reply = () => null;
    { fix(0.5, today); await DECIDE.flush(); const e = lastLog(F); out.nul = { decided: !!e, ai: e && e.ai }; }
    // 5e) AI 一直不回話:隔天先照個性決定;晚到的回話不算數
    reset(); B[F.agentId] = 3000; const held = []; const release = () => { for (const f of held.splice(0)) f(); }; reply = () => new Promise(res => { held.push(() => res([{ n: 1, pick: 'a', why: 'LATE' }])); });
    { today(); const pending = !lastLog(F); for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } w.fullAgentMode = true; const e = lastLog(F); const n1 = (X.log[F.agentId] || []).length; reply = () => null; release(); await DECIDE.flush(); await new Promise(x => setTimeout(x, 30));
      out.slow = { pending, decided: !!e, gone: F.currentLocation === 'exploration' || !!w.isAway?.(F.agentId) || !!F.isDead, loc: F.currentLocation, cash: Math.round(B[F.agentId]), jail: w.civic?.jail?.[F.agentId] || 0, ai: e && e.ai, late: (X.log[F.agentId] || []).length === n1 && !JSON.stringify(X.log[F.agentId] || []).includes('LATE') }; }
    // 5f) 一天問 AI 的人數有上限,其餘照個性
    reset(); for (const a of all) B[a.agentId] = 400; let asked = 0; reply = (p) => { const n = (p.match(/=== \d+\. /g) || []).length; asked += n; return Array.from({ length: n }, (_, i) => ({ n: i + 1, pick: 'a', why: 'ok' })); };
    { today(); await DECIDE.flush(); out.cap = { asked, max: DECIDE.AI_MAX, batch: DECIDE.BATCH, everyone: all.filter(a => (X.log[a.agentId] || []).length).length, eligible: all.filter(a => DECIDE.KINDS.spare.when(w, a) || (X.log[a.agentId] || []).length).length }; }
    // 5g) 原本的 AI 投票也看得到帳本
    reset(); { let vp = ''; ce._askJson = async (p) => { vp = p; return null; }; const p0 = (w.proposals.items || [])[0]; if (p0) { try { await ce.decideVotes(w, p0, all.slice(0, 2), w.agents[p0.proposerId] || all[3]); } catch (e) {} } out.vote = { has: !p0 || /【錢】|\[Money\]/.test(vp) }; }
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;

    // ---------- 6) 存讀檔 ----------
    reset(); B[A.agentId] = 600; fix(0.5, today); X.plan[A.agentId] = { x: { raw: 'PLANX' }, d: w._absDay() };
    { const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { log: JSON.stringify(w2.decide?.log?.[A.agentId] || []) === JSON.stringify(X.log[A.agentId] || []), plan: w2.decide?.plan?.[A.agentId]?.x?.raw === 'PLANX', noTmp: !('_asked' in (w2.decide || {})), st: w2.decide?.st?.rule === X.st.rule }; }

    // ---------- 7) 村民卡 ----------
    app.state = w.getState(); app._showNpcCard(A.agentId); await new Promise(x => setTimeout(x, 600));
    { const card = document.getElementById('npc-quick-card'); const det = card?.querySelector('details.nqc-decide'); if (det) det.open = true; await new Promise(x => setTimeout(x, 100));
      const rows = det ? [...det.querySelectorAll('.nqc-dec')] : []; const r0 = rows[0]; const cr = card?.getBoundingClientRect(); const over = rows.filter(e => { const b = e.getBoundingClientRect(); return b.right > (cr?.right || 0) + 1 || b.left < (cr?.left || 0) - 1; }).length;
      out.card = { has: !!det, rows: rows.length, what: !!r0?.querySelector('.nqc-dec-what')?.textContent.trim(), src: r0?.querySelector('.nqc-dec-src')?.textContent.trim() || '', plan: det?.querySelector('.nqc-dec-plan')?.textContent.includes('PLANX') || false, over, sumH: Math.round(det?.querySelector('summary')?.getBoundingClientRect().height || 0), text: (det?.textContent || '').replace('PLANX', ''), hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 }; }
    out.lang = typeof I18N !== 'undefined' ? I18N.getLang?.() : 'zh';
    return out;
  });
  const en = lang === 'en';
  ok(r.ledger.heads.length >= 3 && r.ledger.heads.every(h => h.length >= 3) && r.ledger.eco >= 1 && r.ledger.soc >= 1, '帳本分門別類：每一行都是一個領域（錢、立場、人際、近況、鎮上）', r.ledger);
  ok(r.ledger.cash && r.ledger.friend && r.ledger.foe && r.ledger.tight, '帳本看得到自己的錢、最親的人、處不來的人，還標出誰手頭很緊', r.ledger);
  ok(!r.ledger.dup, '同一句話不會在帳本裡出現兩次', r.ledger);
  ok(r.source, '新系統登記一句話，就進得了帳本', r.source);
  ok(r.lean.a.joy > r.lean.b.joy && r.lean.b.safe > r.lean.a.safe, '愛享受的人和克己的人，傾向不一樣', r.lean);
  ok(r.lean.pa === 'trip' && r.lean.pb !== 'trip' && r.lean.pa !== r.lean.pb, '同樣有閒錢：愛冒險的人去旅遊，克己的人不去', r.lean);
  ok(r.day.a === 'trip' && r.day.trip === 1 && r.day.cashA && r.day.aRes && !r.day.ai && r.day.rule, '跑一天：決定真的被執行（旅遊一次、錢花掉、紀錄有結果）', r.day);
  ok(r.dayCons, '傾向版的決定：全鎮銀幣守恆', r.dayCons);
  ok(r.day.cool && r.day.again, '同一件事幾天內不會再問一次', r.day);
  ok(r.loan.pick === 'borrow:' + r.loan.pick.split(':')[1] && r.loan.lenderKind === 'asked' && r.loan.lender === 'lend' && r.loan.got && r.loan.paid && r.loan.debt && r.loan.q === 0, '手頭很緊的人跟朋友開口 → 朋友自己決定借 → 錢真的過去、記下債', r.loan);
  ok(/借了我|lent me/.test(r.loan.res) && r.loan.ledgerDebt && r.loan.ledgerDid, '借的人看得到結果；帳本裡有這筆債和這個決定', r.loan);
  ok(r.loanCons, '朋友借錢：銀幣守恆', r.loanCons);
  ok(r.refuse.lender === 'refuse' && r.refuse.got && /拒絕|turned me down/.test(r.refuse.res), '被他坑過的人不肯再借，借的人知道被拒絕了', r.refuse);
  ok(r.noDice.feast === 0 && r.noDice.trip === 0 && r.noDice.art === 0 && r.noDice.fee === 0 && r.noDice.debts === 0 && r.noDice.api === 'undefined' && r.noDice.src, '舊的擲骰迴圈拿掉了：沒有人拿主意，宴客、旅遊、畫像、讀書、借錢都不會自己發生', r.noDice);
  ok(r.noDice.show >= 1, '街頭表演賞錢（不是誰的決定）照舊', r.noDice);
  ok(r.ai.asked === 1 && r.ai.id === 'trip' && r.ai.ai === 1 && r.ai.trip === 1 && /AIWHY/.test(r.ai.why) && r.ai.res, 'AI 版：AI 選了旅遊就真的去旅遊，理由是 AI 自己寫的', r.ai);
  ok(/AINEXT/.test(r.ai.plan) && r.ai.planInLedger, 'AI 留下的「接下來的打算」記下來了，下次拿主意時他自己看得到', r.ai);
  ok(r.ai.log && r.ai.mem, 'AI 的決定進日誌（🧭）和本人的記憶', r.ai);
  ok(r.ai.prompt.money && r.ai.prompt.people && r.ai.prompt.event && r.ai.prompt.choose && r.ai.prompt.other && r.ai.prompt.town, '給 AI 的資料：帳本＋遇到的事＋可以選的＋「其他」', r.ai.prompt);
  if (en) ok(!r.ai.prompt.cjk, '英文版給 AI 的資料沒有中文', r.ai.prompt);
  ok(r.aiCons, 'AI 版的決定：銀幣守恆', r.aiCons);
  ok(r.free.id === 'other' && r.free.free === 1 && r.free.n === 1 && /AIDO/.test(r.free.what), 'AI 選「其他」：他自己想做的事被記下來', r.free);
  ok(r.free.gave === 200 && r.free.left === 200 && r.free.aff >= 8 && r.free.total, '給錢的效果落地（最多給一半）、對人更好；不在白名單的「憑空變錢」沒有發生', r.free);
  ok(r.freeCons && r.free.log, '自由行動：銀幣守恆、日誌有 💭', r.free);
  ok(/AIDO/.test(r.dream.plan) && r.dream.same && r.dream.res, '遊戲裡做不到的事（挖地道）不會憑空發生，留成「打算」', r.dream);
  ok(r.bad.decided && !r.bad.ai && r.bad.miss >= 1 && r.bad.miss <= 2 /* v9.22.0 他若決定去談入股，當家也會被問一次(同樣答非所問、同樣照個性決定) */ && r.nul.decided && !r.nul.ai, 'AI 亂選或沒回 → 照個性決定，不會卡住', { bad: r.bad, nul: r.nul });
  ok(r.slow.pending && ((r.slow.decided && !r.slow.ai) || r.slow.gone) && r.slow.late, 'AI 一直不回話：隔天先照個性決定，晚到的回話不算', r.slow);
  ok(r.cap.asked <= r.cap.max && r.cap.asked >= 1 && r.cap.everyone >= r.cap.asked, '一天問 AI 的人數有上限，其餘的人照個性決定', r.cap);
  ok(r.vote.has, '原本的 AI 投票也看得到帳本（【錢】）', r.vote);
  ok(r.save.log && r.save.plan && r.save.noTmp && r.save.st, '存讀檔：決策紀錄、打算、統計都在', r.save);
  ok(r.card.has && r.card.rows >= 1 && r.card.what && r.card.src && r.card.plan, '村民卡有「最近的決定」：做了什麼、誰決定的、打算', r.card);
  ok(r.card.over === 0 && !r.card.hscroll && r.card.sumH >= 24, '村民卡不跑版（不超出卡片、沒有橫向捲動）', r.card);
  if (en) ok(!/[一-鿿]/.test(r.card.text), '英文版的決定紀錄沒有中文', r.card.text.slice(0, 300));
  ok(errs.length === 0, '沒有程式錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 860 });
  await run(browser, 'en', { width: 390, height: 844 });
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
