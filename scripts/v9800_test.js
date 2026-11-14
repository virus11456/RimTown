// v9.8.0 更多人當股東:看利息入股、退股存銀行、朋友合夥開新店(分紅、收攤、併購、繼承、老闆過世由合夥人接手)、銀幣守恆
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; /* 這裡驗的是照個性推估的版本(AI 版會等回話) */ for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
    const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const T = () => Math.round(MONEY.total(w) * 100) / 100;
    const P = all().filter(a => (a.age ?? 30) >= 18); for (const a of all()) WALLET.get(w, a);
    const M = MARKET.S(w); const X = SHARES.S(w).sh; const IV = INVEST.S(w);
    const setCash = (a, n) => { WALLET.take(w, a, WALLET.get(w, a)); WALLET.add(w, a, n); };
    const tr = (a, list) => { a.personality = a.personality || {}; a.personality.traits = list.slice(); a.personality.values = []; };
    const B = BANK.S(w); B.open = true; B.status = 'ok'; B.depRate = 0.01; B.dep = B.dep || {}; IV.bankY = 0.01;
    const rnd = Math.random; const out = {}; const t0 = T();
    // 先把鎮上其他人的錢壓低,免得別人搶走機會
    for (const a of all()) { setCash(a, 5); delete B.dep[a.agentId]; }
    const t1 = T();
    // 1. 看利息入股:食堂一週賺很多,分紅率遠高於銀行
    const [boss, inv, poorRate, ...rest] = P;
    for (const k of Object.keys(MARKET.SECTORS)) { delete M.owners[k]; delete M.shares[k]; delete M.rival[k]; }
    M.owners.kitchen = boss.agentId; M.shares.kitchen = { [boss.agentId]: 100 }; M.hist.kitchen = Array.from({ length: 7 }, () => [60, 10]);
    tr(boss, ['greedy']); tr(inv, ['ambitious']); setCash(inv, 800);
    const y = INVEST.perPct(w, 'kitchen') * 10 / INVEST.askPrice(w, 'kitchen', 10, boss);
    // v9.19.0 誰要入股改由決策核心挑(傾向版:算每個選項的分數,挑最高的);這裡把當天的心情起伏固定住
    const decide = (a) => { const K = DECIDE.KINDS.spare; const ctx = K.when(w, a); if (!ctx) return null; const ops = K.options(w, a, ctx).filter(o => o.id === 'keep' || o.id.startsWith('invest:')); /* 只比「留著」和「入股」:這個人有沒有更想請客、接濟誰,不是這裡要驗的 */ const Ln = DECIDE.lean(w, a); const best = ops.slice().sort((x, y) => DECIDE.score(Ln, y) - DECIDE.score(Ln, x))[0]; if (best) best.run(w, a, ctx); /* v9.22.0 賣不賣由當家自己決定:把「有人來談入股」交給他回答 */ DECIDE.drain(w, DECIDE.S(w), w._absDay()); return best ? best.id : null; };
    Math.random = () => 0.1; out.buyPick = decide(inv); Math.random = rnd;
    out.buy = { pick: out.buyPick, y, stake: SHARES.pctOf(w, 'kitchen', inv.agentId), bossStake: SHARES.pctOf(w, 'kitchen', boss.agentId), st: IV.st.buy, log: w.messageLog.slice(-6).some(m => /銀行存款一週才/.test(m.k || '')), mem: inv.memory.entries.slice(-5).some(m => /比銀行利息/.test(JSON.stringify(m))) };
    // 2. 分紅比銀行差就不買:把利潤壓低、銀行利息調高
    M.hist.kitchen = Array.from({ length: 7 }, () => [10, 10]); IV.bankY = 0.03; const inv2 = rest[0]; tr(inv2, ['ambitious']); setCash(inv2, 800); const b0 = IV.st.buy;
    Math.random = () => 0.1; const pick2 = decide(inv2); Math.random = rnd;
    out.noBuy = { y: INVEST.perPct(w, 'kitchen'), stake: SHARES.pctOf(w, 'kitchen', inv2.agentId), buys: IV.st.buy - b0, pick: pick2 };
    // 謹慎的人門檻比較高:同樣的分紅率,敢衝的人買、謹慎的人不買
    out.hurdle = { cautious: INVEST.hurdle({ personality: { traits: ['thrifty'] } }), bold: INVEST.hurdle({ personality: { traits: ['greedy'] } }) };
    // 3. 退股存銀行:連三週分紅比銀行差,小股東把股份賣回給當家、錢存進銀行
    setCash(boss, 900); const d0 = B.dep[inv.agentId] || 0, o0 = IV.st.out;
    Math.random = () => 0.1; for (let i = 0; i < 3; i++) INVEST.cashOuts(w, all(), w._absDay()); Math.random = rnd;
    // 每週只記下「連幾週不如銀行」，退不退由股東自己決定：這裡替他拿主意
    const kept3 = SHARES.pctOf(w, 'kitchen', inv.agentId) > 0; const low = INVEST.lowOf(w, inv); if (low) INVEST.cashOut(w, all(), low.k, inv.agentId);
    out.cashOut = { kept3, weeks: low?.weeks, stake: SHARES.pctOf(w, 'kitchen', inv.agentId), dep: Math.round((B.dep[inv.agentId] || 0) - d0), outs: IV.st.out - o0 };
    IV.bankY = 0.01;
    // 4. 朋友合夥開新店:一個人出不起,找交情好的朋友湊
    for (const a of all()) if (a !== boss) setCash(a, 5); setCash(boss, 5);
    const forgeBoss = rest[1]; const [lead, f1, f2] = rest.slice(2, 5);
    M.owners.forge = forgeBoss.agentId; M.shares.forge = { [forgeBoss.agentId]: 100 };
    const ws = MARKET.workersOf(w, 'forge', all()); const need = Math.max(0, 3 - ws.length); for (const a of rest.slice(5, 5 + need)) a.job = Object.assign({}, a.job || {}, { key: Object.keys(MARKET.JOB2S).find(j => MARKET.JOB2S[j] === 'forge') });
    const nWs = MARKET.workersOf(w, 'forge', all()).length; const cost = Math.round(30 + nWs * 8);
    M.hist.forge = Array.from({ length: 7 }, () => [nWs * 20, 5]); COMPETE.S(w).good.forge = 5;
    tr(lead, ['greedy', 'hardworking']); setCash(lead, Math.round(cost * 0.6)); for (const f of [f1, f2]) { tr(f, ['kind']); setCash(f, cost); }
    for (const [a, b] of [[f1, lead], [f2, lead], [lead, f1], [lead, f2]]) a.relationships.getOrCreate(b.agentId, b.name).affinity = 70;
    for (const f of [f1, f2, lead]) f.relationships.getOrCreate(forgeBoss.agentId, forgeBoss.name).affinity = 0; // 跟原老闆交情太好的人不會去對面合夥:開局幾天的隨機交情要固定住,不然偶爾會失敗
    const tA = T(); Math.random = () => 0.1; COMPETE.entry(w, all(), w._absDay()); Math.random = rnd;
    const R = M.rival.forge;
    out.coop = { opened: !!R, owner: R?.owner === lead.agentId, sh: R?.sh ? Object.keys(R.sh).length : 0, cost, leadLeft: Math.round(WALLET.get(w, lead)), conserved: Math.abs(T() - tA) < 0.05, log: w.messageLog.slice(-6).some(m => /一起合夥/.test(m.k || '')), row: COMPETE.row(w, 'forge')?.partners || '' };
    // 5. 合夥店分紅:利潤照股份分給合夥人
    let divOk = null; if (R && R.sh) { setCash(lead, 500); const fr = Object.keys(R.sh).find(id => id !== lead.agentId); const a = w.agents[fr]; const c0 = WALLET.get(w, a); const tB = T(); const paid = INVEST.rivalDividend(w, 'forge', R, 100); divOk = { paid: Math.round(paid), got: Math.round(WALLET.get(w, a) - c0), expect: Math.round(60 * R.sh[fr] / 100), conserved: Math.abs(T() - tB) < 0.05 }; }
    out.div = divOk;
    // 6. 合夥人過世:家人繼承股份
    let inh = null; if (R && R.sh) { const fr = Object.keys(R.sh).find(id => id !== lead.agentId); const a = w.agents[fr]; const kid = rest[8]; kid._parentNames = [a.name]; kid.age = 30; const p = R.sh[fr]; const h0 = (MARKET.heirsOf(w, a) || [])[0]; w.lifecycle._killNpc(w, a, 'test'); inh = { heir: h0?.name, kidStake: h0 ? (R.sh?.[h0.agentId] || 0) : -1, p, gone: !(fr in (R.sh || {})) }; }
    out.inherit = inh;
    // 7. 老闆過世沒有家人:股份最多的合夥人接手(以前直接關門)
    let take = null; if (M.rival.forge && M.rival.forge.sh) { const R2 = M.rival.forge; const others = Object.keys(R2.sh).filter(id => id !== lead.agentId); for (const a of all()) { const rr = a.relationships.relationships[lead.agentId]; if (rr && rr.status === 'married') rr.status = 'friend'; if ((a._parentNames || []).includes(lead.name)) a._parentNames = []; }
      w.lifecycle._killNpc(w, lead, 'test'); take = { open: !!M.rival.forge, owner: M.rival.forge && others.includes(M.rival.forge.owner) }; }
    out.takeover = take;
    // 8. 併購原本那家:合夥人變成合併後那家的股東
    const Rm = { owner: rest[10].agentId, sh: { [rest[10].agentId]: 60, [rest[11].agentId]: 40 } }; M.owners.cloth = rest[12].agentId; M.rival.cloth = Rm;
    INVEST.rivalMerged(w, 'cloth', Rm); out.merge = { owner: M.owners.cloth === rest[10].agentId, partner: SHARES.pctOf(w, 'cloth', rest[11].agentId) };
    // 9. 一家最多六個股東
    out.maxH = SHARES.maxH(w);
    out.money = { t0, t1, end: T() };
    return out;
  });
  console.log(JSON.stringify(r, null, 1).slice(0, 3000));
  ok(r.buy.y > 0.02 && r.buy.stake >= 5 && r.buy.bossStake >= 40 && r.buy.st >= 1, '分紅率比銀行利息好：有閒錢的人向當家買股份（當家至少留 40%）', r.buy);
  ok(r.buy.log && r.buy.mem, '日誌與記憶寫出「分紅幾 %、銀行幾 %」的比較', r.buy);
  ok(r.noBuy.stake === 0 && r.noBuy.buys === 0, '分紅比銀行利息差就不入股', r.noBuy);
  ok(r.hurdle.cautious > r.hurdle.bold, '謹慎的人要求的分紅比敢衝的人高', r.hurdle);
  ok(r.cashOut.kept3 && r.cashOut.weeks >= 3 && r.cashOut.stake === 0 && r.cashOut.dep > 0 && r.cashOut.outs === 1, '連三週分紅比銀行差：小股東把股份賣回、錢存進銀行', r.cashOut);
  ok(r.coop.opened && r.coop.owner && r.coop.sh >= 2 && r.coop.conserved && r.coop.log, '一個人出不起開店本錢：找朋友合夥開新店，照出資拿股份', r.coop);
  ok(/%/.test(r.coop.row), '市場面板的對手店列出合夥人與股份', r.coop.row);
  ok(r.div && r.div.got === r.div.expect && r.div.conserved, '合夥店每週照股份分紅（利潤六成）', r.div);
  ok(r.inherit && r.inherit.gone && r.inherit.kidStake > 0, '合夥人過世，股份由子女繼承', r.inherit);
  ok(r.takeover && r.takeover.open && r.takeover.owner, '合夥店老闆過世又沒家人：由股份最多的合夥人接手，店繼續開', r.takeover);
  ok(r.merge.owner && r.merge.partner === 40, '合夥店併購原本那家：合夥人變成合併後那家的股東', r.merge);
  ok(r.maxH === 6, '一家最多六個股東（以前四個）', r.maxH);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
