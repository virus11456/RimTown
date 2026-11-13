// v8.9.0 賭場：城鎮以上才開、十賭九輸（莊家長期贏）、一夕致富（莊家付不出就倒）、家破人亡（配偶離開、欠債跑路）、城市以上外地賭客（觀光收入）、禁賭提案與投票、銀幣守恆、存讀檔、介面
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
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    if (typeof DECIDE !== 'undefined') DECIDE.fun = false; // v9.25.0 去不去賭、押多少、開不開賭場改由本人決定(v92500_test.js 在驗)；這支驗的是賭場本身的結算(下注、賒帳、討債、輸光、觀光客)，所以用舊的擲骰來驅動
    const tick = (n) => { for (let k = 0; k < n; k++) { w.paused = false; w.tick(); } };
    tick(96 * 21); // 開張要第 20 天以後
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const B = w.wallet.bal; const T = () => MONEY.total(w); const P0 = () => MONEY.S(w).pend;
    const logs = () => (w.messageLog || []).slice(-40).map(m => String(m.content || '')).join('\n');
    const fix = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return { ok: Math.abs((T() - t0) - (P0() - p0)) < 0.02, d: Math.round(((T() - t0) - (P0() - p0)) * 100) / 100 }; };
    const _lv = TIERS.level; let TIER = 0; TIERS.level = () => TIER;
    const C = CASINO.S(w); const run1 = (v) => { C.lastDay = -1; return v == null ? CASINO.daily(w) : fix(v, () => CASINO.daily(w)); };
    try {
      INFL.S(w).p = 1; INFL.S(w).wage = 1; INFL.sync(w);
      // ---------- 1) 開張:村莊不開,城鎮以上有野心的有錢人開 ----------
      const all = npcs(); const boss = all.find(a => a.job?.key !== 'priest'); boss.personality.traits = ['greedy', 'ambitious']; for (const a of all) B[a.agentId] = 30; B[boss.agentId] = 600;
      TIER = 0; run1(0.001); out.village = !C.open;
      TIER = 1; const oc = conserved(() => run1(0.001));
      out.open = { open: C.open, owner: C.owner === boss.agentId, paid: B[boss.agentId] < 600, cons: oc, log: /開了一家賭場|opened a casino|to open a casino/.test(logs()), name: C.name };
      // ---------- 2) 十賭九輸:三十天自然下注,莊家淨賺、多數賭客變少 ----------
      B[boss.agentId] = 100000; const gam = all.filter(a => a !== boss).slice(0, 12); for (const a of gam) { a.personality.traits = ['greedy', 'optimist']; B[a.agentId] = 100; }
      const g0 = Object.fromEntries(gam.map(a => [a.agentId, 100])); if (w.bank) w.bank.open = false;
      const v0 = C.st.visits, h0 = C.st.house, pd0 = C.st.paid; const hc = conserved(() => { for (let k = 0; k < 60; k++) run1(); });
      // 樣本要大才看得出莊家優勢:每天把賭客的錢重設成 100,連跑 1500 天,累計每個人的輸贏
      const cum = {}; const v1 = C.st.visits, h1 = C.st.house, pd1 = C.st.paid; out.lossN0 = C.st.lossN || 0;
      for (let k = 0; k < 1500; k++) { for (const a of gam) if (w.agents[a.agentId]) { B[a.agentId] = 100; } B[boss.agentId] = 100000; run1(); for (const a of gam) if (w.agents[a.agentId]) cum[a.agentId] = (cum[a.agentId] || 0) + (B[a.agentId] - 100); }
      const went = gam.filter(a => (C.v[a.agentId] || 0) > 0 && a.agentId in cum); const lost = went.filter(a => cum[a.agentId] < 0);
      out.edge = { visits: C.st.visits - v1, house: Math.round(C.st.house - h1), paid: Math.round(C.st.paid - pd1), net: Math.round((C.st.house - h1) - (C.st.paid - pd1)), went: went.length, lost: lost.length, cons: hc, d60: C.st.visits - v0 > 0, lossRate: Math.round(((C.st.lossN || 0) - (out.lossN0 || 0)) / Math.max(1, C.st.visits - v1) * 1000) / 1000, edge: Math.round(((1 - CASINO.EDGE) - (CASINO.EDGE - CASINO.JACK) - CASINO.JACK * CASINO.JACKX) * 1000) / 1000 /* 每押 1：輸的機率 − 小贏 − 大獎 */ };
      if (w.bank) w.bank.open = true;
      // ---------- 3) 一夕致富:中大獎 25 倍;莊家付不出就倒 ----------
      for (const a of all) B[a.agentId] = 1; B[boss.agentId] = 100000; const lucky = gam.find(a => w.agents[a.agentId]); B[lucky.agentId] = 50; C.streak = {};
      const j0 = C.st.jack; const jc = conserved(() => run1(0.001)); out.jack = { n: C.st.jack - j0, got: B[lucky.agentId], open: C.open, cons: jc, log: /押中了大獎|hit the jackpot/.test(logs()) };
      B[boss.agentId] = 10; B[lucky.agentId] = 50; const bc = conserved(() => run1(0.001)); out.broke = { closed: !C.open, why: C.closedWhy, ownerCash: B[boss.agentId], cons: bc, log: /傾家蕩產|lost everything/.test(logs()) };
      // 重新開張(下一個有錢人)
      for (const a of all) B[a.agentId] = 1; B[boss.agentId] = 600; run1(0.001); out.reopen = C.open;
      // ---------- 4) 家破人亡:輸光、配偶離開、欠銀行的人連夜跑路 ----------
      B[boss.agentId] = 100000; const vic = gam.find(a => a !== lucky && w.agents[a.agentId]); const sp = all.find(a => a !== vic && a !== boss && a !== lucky && w.agents[a.agentId]);
      for (const rr of Object.values(vic.relationships.relationships || {})) if (rr.status === 'married') rr.status = 'friend';
      vic.personality.traits = ['greedy']; vic.relationships.getOrCreate(sp.agentId, sp.name).status = 'married'; sp.relationships.getOrCreate(vic.agentId, vic.name).status = 'married';
      for (const a of all) B[a.agentId] = Math.min(B[a.agentId] ?? 0, 4); B[boss.agentId] = 100000; B[vic.agentId] = 5; const d = w._absDay();
      C.streak[vic.agentId] = 4; C.lost[vic.agentId] = [[d, 60]]; const BK = BANK.S(w); BK.loans = BK.loans || {}; BK.loans[vic.agentId] = { owed: 20, principal: 20, rate: 0.1, day: d, due: d + 30 };
      THINGS.S(w).att[C.thing][vic.agentId] = 90; C.debt[vic.agentId] = { n: 1, day: d }; /* 很愛賭、已經跟莊家賒過帳（不會再賒） */
      const r0 = C.st.ruin, f0 = C.st.fled, dv0 = C.st.divorce; const rc = conserved(() => run1(0.45));
      out.ruin = { dbg: { cash: B[vic.agentId], v: C.v[vic.agentId], st: C.streak[vic.agentId], dealer: C.dealer === vic.agentId, owner: C.owner === vic.agentId, open: C.open, mult: THINGS.useMult(w, C.thing, vic), lost: (C.lost[vic.agentId] || []).length }, ruin: C.st.ruin - r0, divorce: C.st.divorce - dv0, fled: C.st.fled - f0, spouse: sp.relationships.relationships[vic.agentId]?.status, gone: !w.agents[vic.agentId] || w.agents[vic.agentId].isDead || vic.currentLocation === 'left', cons: rc, log: /連吃飯的錢都沒了|can't even afford food/.test(logs()) && /連夜跑路|slipped out of town/.test(logs()) };
      // ---------- 5) 城市以上:外地賭客來玩(觀光收入,從外地流進來) ----------
      for (const a of npcs()) if (a.agentId !== C.owner) B[a.agentId] = 1; TIER = 2; const ownC = B[C.owner]; const M = MONEY.S(w); const day0 = M.days?.[w._absDay()]?.tourism || 0; const t0 = C.st.tourists;
      const tc = conserved(() => run1(0.5)); out.tour = { n: C.st.tourists - t0, owner: B[C.owner] > ownC, flow: (M.days?.[w._absDay()]?.tourism || 0) - day0, cons: tc };
      TIER = 1; const t1 = C.st.tourists; run1(0.5); out.tour.townNo = C.st.tourists === t1;
      // ---------- 6) 禁賭（v9.0.0 走通用的「禁止新東西」）:被害的家庭夠多，就有人站出來提;討厭賭場的人贊成、老闆反對 ----------
      const X = THINGS.S(w); const TT = X.list[C.thing]; TT.born = w._absDay() - 20; TT.banProp = -99; w.proposals.items = (w.proposals.items || []).filter(q => q.kind !== 'thing_ban');
      const preacher = npcs().find(a => a.agentId !== C.owner); preacher.personality.traits = ['kind', 'ascetic'];
      for (const a of npcs()) if (X.att[C.thing][a.agentId] == null) X.att[C.thing][a.agentId] = a === preacher ? -95 : -50;
      X.att[C.thing][preacher.agentId] = -95; const vs = npcs().filter(a => a !== preacher && a.agentId !== C.owner).slice(0, 2); for (const v of vs) X.victims[v.agentId] = { id: C.thing, day: w._absDay(), k: 'x', p: {} };
      X.lastDay = -1; await THINGS.daily(w); const pr = (w.proposals.items || []).find(q => q.kind === 'thing_ban'); out.ban = { prop: !!pr, thing: pr?.thing === C.thing };
      if (pr) {
        const own = w.agents[C.owner];
        let of = 0, hf = 0; for (let k = 0; k < 20; k++) { delete pr.votes[own.agentId]; w.proposals._ruleVote(w, pr, own); if (pr.votes[own.agentId] === 'for') of++; delete pr.votes[preacher.agentId]; w.proposals._ruleVote(w, pr, preacher); if (pr.votes[preacher.agentId] === 'for') hf++; }
        out.ban.votes = { of, hf }; pr.status = 'approved'; w.proposals._execute(w, pr, w._absDay()); out.ban.ok = C.ban && !C.open; run1(0.001); out.ban.stays = !C.open; out.ban.log = /決定禁賭|ban gambling/.test(logs()); out.ban.retired = !!X.list[C.thing]?.gone;
      }
      out.brief = CASINO.brief(w, all.find(a => (C.v[a.agentId] || 0) >= 5) || all[0]);
      // ---------- 存讀檔 ----------
      { const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = !!w2.casino && w2.casino.ban === C.ban && w2.casino.st.visits === C.st.visits && w2.casino.st.ruin === C.st.ruin; }
      // ---------- 介面 ----------
      if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300));
      out.ui = document.querySelector('.price-section .casino-meta')?.textContent || '';
    } finally { TIERS.level = _lv; }
    return out;
  });
  const en = lang === 'en';
  ok(r.village, '村莊不會開賭場', r.village);
  ok(r.open.open && r.open.owner && r.open.paid && r.open.log && r.open.name, '城鎮以上，有野心的有錢人花錢開賭場', r.open);
  ok(r.open.cons.ok, '開賭場的錢付給工匠，全鎮的錢不多不少', r.open.cons);
  ok(r.edge.visits >= 250 && r.edge.lossRate >= 0.57 && r.edge.lossRate <= 0.67 && r.edge.edge >= 0.15, '每押有六成以上輸，莊家每押理論上抽一成五以上（大獎運氣不算）', r.edge);
  ok(r.edge.went >= 5 && r.edge.lost / r.edge.went > 0.5, '常去賭的人多數輸錢（運氣好中大獎的少數例外）', r.edge);
  ok(r.edge.d60 && r.edge.cons.ok, '兩個月自然下注，錢都只是在村民之間移動，全鎮的錢不多不少', r.edge.cons);
  ok(r.jack.n >= 1 && r.jack.got >= 120 && r.jack.log, '偶爾有人中大獎，一夕致富', r.jack);
  ok(r.jack.cons.ok, '大獎是莊家付的，全鎮的錢不多不少', r.jack.cons);
  ok(r.broke.closed && r.broke.why === 'broke' && r.broke.ownerCash < 0.01 && r.broke.log && r.broke.cons.ok, '莊家付不出大獎就傾家蕩產、賭場關門', r.broke);
  ok(r.reopen, '之後別的有錢人還能再開', r.reopen);
  ok(r.ruin.ruin === 1 && r.ruin.log, '輸光又一直想翻本的人家破人亡', r.ruin);
  ok(r.ruin.divorce === 1 && r.ruin.spouse === 'ex', '配偶受不了帶著孩子離開', r.ruin);
  ok(r.ruin.fled === 1 && r.ruin.gone, '欠銀行錢的人連夜跑路', r.ruin);
  ok(r.tour.n > 0 && r.tour.owner && r.tour.flow > 0 && r.tour.cons.ok, '城市以上外地賭客來玩，錢記成「外地賭客與觀光」流入', r.tour);
  ok(r.tour.townNo, '城鎮還沒有外地賭客', r.tour);
  ok(r.ban.prop && r.ban.thing, '被賭場害慘的家庭多了，有人提案禁止賭場（通用的「禁止新東西」）', r.ban);
  ok(r.ban.votes && r.ban.votes.of === 0 && r.ban.votes.hf >= 18, '討厭賭場的人贊成、賭場老闆反對（照各自的看法投票）', r.ban.votes);
  ok(r.ban.ok && r.ban.stays && r.ban.log && r.ban.retired, '通過後賭場關門、之後也不會再開，新東西清單上也撤下', r.ban);
  ok(r.save, '存讀檔後賭場紀錄都在', r.save);
  ok(en ? /Gambling banned/.test(r.ui) && !/[一-鿿]/.test(r.ui) : /全鎮禁賭/.test(r.ui), '經濟頁顯示賭場狀況', r.ui);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 800 });
  await run(browser, 'en', { width: 390, height: 844 });
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
