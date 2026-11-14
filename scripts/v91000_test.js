// v9.10.0 階層流動:小孩的出身跟著家裡、16 歲定下來;做生意／嫁娶拉高階層;拜師一個月出師換工作;
// 爬上兩階 = 白手起家(窮人當榜樣、老士紳嫌暴發戶);從士紳以上掉兩階 = 家道中落(爸媽白手起家 → 富不過三代);
// 敗家把錢付給店家(銀幣守恆);鎮況面板、村民卡、AI 簡介、存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, mobile) {
  const ctx = await browser.newContext(mobile ? { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const out = {}; const logs = () => (w.messageLog || []).map(m => m.content || ''); const C = CLASS.S(w); const MB = MOBILITY.S(w);
    const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 20);
    const used = new Set(); const take = (n) => { const L = adults().filter(o => !used.has(o.agentId)).slice(0, n); L.forEach(o => used.add(o.agentId)); for (const a of L) { a._parentNames = []; for (const [id, r0] of Object.entries(a.relationships?.relationships || {})) if (['married', 'dating'].includes(r0.status)) { r0.status = 'friend'; const o = w.agents[id]; const r1 = o?.relationships?.relationships?.[a.agentId]; if (r1) r1.status = 'friend'; } } return L; };
    const rel = (a, b, st) => { a.relationships.getOrCreate(b.agentId, b.name).status = st; b.relationships.getOrCreate(a.agentId, a.name).status = st; };
    const setCash = (a, n) => { w.wallet.bal[a.agentId] = n; };
    const strip = (a) => { delete C.titles[a.agentId]; const M = MARKET.S(w); for (const k of Object.keys(M.owners)) if (M.owners[k] === a.agentId) M.owners[k] = null; for (const R of Object.values(w.market.rival || {})) if (R?.owner === a.agentId) R.owner = '__none'; for (const sh of (w.biz?.shops || [])) if (sh.owner === a.agentId || sh.partner === a.agentId) sh.closed = true; if (a.job?.key && ['mayor', 'guard', 'priest'].includes(a.job.key)) a.job = new Job('farmer'); };
    const day = () => { MB.day = null; CLASS.daily(w); };
    const settle = (a) => { day(); if (MB.h[a.agentId]) MB.h[a.agentId][1] -= 10; day(); }; // 新階層穩住一週才算
    try {
      // A. 小孩的出身跟著家裡:士紳的孩子,出身算士紳;16 歲以後定下來
      { const [P] = take(1); strip(P); setCash(P, 500); const [K] = take(1); strip(K); K.age = 12; K._parentNames = [P.name]; setCash(K, 0); day(); day();
        out.kid = { pLv: CLASS.level(w, P), kLv: CLASS.level(w, K), origin: MB.o[K.agentId] };
        K.age = 16; setCash(P, 0); day(); day(); out.kid.fixed = MB.o[K.agentId]; }
      // B. 做生意拉高階層:有產業算士紳
      { const [X] = take(1); strip(X); setCash(X, 0); X.job = new Job('farmer'); day(); const l0 = CLASS.level(w, X); const M = MARKET.S(w); const k = Object.keys(MARKET.SECTORS).find(q => !M.owners[q]) || Object.keys(MARKET.SECTORS)[0]; M.owners[k] = X.agentId; day(); out.biz = { l0, l1: CLASS.level(w, X) }; M.owners[k] = null; }
      // C. 嫁娶:嫁給貴族的平民至少到士紳
      { const [X, Y] = take(2); strip(X); strip(Y); setCash(X, 0); X.job = new Job('farmer'); C.titles[Y.agentId] = { rank: 1, since: 0, how: 'granted' }; day(); const l0 = CLASS.level(w, X); rel(X, Y, 'married'); day(); out.wed = { l0, l1: CLASS.level(w, X), y: CLASS.level(w, Y), how: MOBILITY.how(w, X) }; delete C.titles[Y.agentId]; }
      // D. 白手起家:出身底層,爬到士紳 → 日誌、記憶、窮人的榜樣、AI 知道、村民卡標籤
      { const [X] = take(1); strip(X); setCash(X, 0); X.job = null; day(); MB.o[X.agentId] = 0; delete MB.told[X.agentId]; setCash(X, 900); X.job = new Job('trader'); settle(X);
        out.rise = { lv: CLASS.level(w, X), told: MB.told[X.agentId], log: logs().slice(-12).some(s => /出身底層|rose from Underclass/.test(s)), mem: (X.memory?.entries || []).slice(-10).some(m => /走到今天|got where I am/.test(m.content || '')), brief: MOBILITY.brief(w, X), tag: MOBILITY.tag(w, X)?.text || '' };
        app._showNpcCard?.(X.agentId); out.rise.card = /白手起家|rose from nothing/.test(document.querySelector('#npc-quick-card')?.innerText || ''); app._hideNpcCard?.(); }
      // E. 家道中落＋富不過三代:爸爸白手起家,兒子從士紳跌到平民
      { const [F, S2] = take(2); strip(F); strip(S2); MB.told[F.agentId] = 'rise'; S2._parentNames = [F.name]; S2.age = 30; setCash(S2, 900); S2.job = new Job('trader'); settle(S2); delete MB.told[S2.agentId]; MB.pk[S2.agentId] = 3;
        setCash(S2, 0); S2.job = null; setCash(F, 0); F.job = null; settle(S2);
        out.fall = { lv: CLASS.level(w, S2), told: MB.told[S2.agentId], three: logs().slice(-12).some(s => /這一代就敗光|squandered by/.test(s)), st: MB.st.three || 0 }; }
      // F. 拜師:沒出路的年輕人跟熟的師傅學 30 天,出師換成工匠,技能變高
      { const [A, Mst] = take(2); strip(A); strip(Mst); A.age = 20; A.job = new Job('farmer'); setCash(A, 50); Mst.job = new Job('blacksmith'); setCash(Mst, 300); A.personality.traits = ['hardworking'];
        Mst.relationships.getOrCreate(A.agentId, A.name).affinity = 60; day();
        for (const id of Object.keys(MB.ap)) delete MB.ap[id]; delete MB.done[A.agentId];
        const keep = Object.values(w.agents).filter(o => !o.isPlayer && !o.isDead && o !== A); const saved = keep.map(o => [o, o.job]); // 鎮上只留 Mst 一個師傅(拜師時是從全鎮的工匠裡找，18、19 歲的工匠也算)
        const tr0 = Math.random; Math.random = () => 0.1; const d0 = w._absDay(); let started = false;
        try { for (const o of keep) if (o !== Mst && o.job && ['blacksmith', 'carpenter', 'tailor', 'cook', 'trader', 'doctor', 'researcher'].includes(o.job.key)) o.job = new Job('farmer');
          MOBILITY.learnBy(w, A); /* 要不要拜師由本人決定：這裡替他拿主意 */ started = MB.ap[A.agentId]?.m === Mst.agentId;
        } finally { Math.random = tr0; for (const [o, j] of saved) if (o !== Mst) o.job = j; }
        { const sk = A.skills.get('工藝'); if (sk?.isIncapable) sk.passion = '無'; } /* 天生學不來這門手藝的人經驗不會長：這裡驗的是學徒會進步，先排除這種人 */
        const xp0 = A.skills.get('工藝')?.xp || 0; const P = MB.ap[A.agentId]; if (P) P.d0 = w._absDay() - 30;
        MOBILITY.apprentice(w, Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead), w._absDay() + 1);
        out.appr = { started, job: A.job?.key, done: MB.done[A.agentId], xp: (A.skills.get('工藝')?.xp || 0) > xp0, log: logs().slice(-10).some(s => /出師當上了|finished the apprenticeship/.test(s)), start: logs().slice(-14).some(s => /為師|apprentice to learn/.test(s)) }; }
      // G. 敗家:出身好又懶散的人揮霍,錢付給店家(總額不變)
      { const [X] = take(1); strip(X); MB.o[X.agentId] = 3; X.personality.traits = ['lazy']; setCash(X, 1000); const t0 = MONEY.total(w); const c0 = WALLET.get(w, X); const r0 = Math.random; Math.random = () => 0.01;
        try { MOBILITY.spreeBy(w, X); /* 要不要痛快花一筆交給本人決定：這裡替他拿主意 */ } finally { Math.random = r0; }
        out.spree = { spent: Math.round(c0 - WALLET.get(w, X)), cons: Math.abs(MONEY.total(w) - t0) < 0.01 }; }
      // H. 鎮況面板、存讀檔
      { const B = app._townBlocks(null, ['tier']); const panel = /階層流動|Social mobility/.test(B.tier || '') && /白手起家|rose from nothing|家道中落|fell on hard times/.test(B.tier || '');
        const v = MOBILITY.view(w); const sv = JSON.parse(JSON.stringify(w.serialize())); out.ui = { panel, view: !!v && v.n > 0, saved: !!sv.mobility?.o && Object.keys(sv.mobility.o).length > 0 }; }
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  console.log(lang, mobile ? 'mobile' : 'desktop', JSON.stringify(r));
  const tag = `[${lang}${mobile ? ' 手機' : ''}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  if (!mobile) {
    ok(r.kid && r.kid.pLv >= 3 && r.kid.kLv >= 3 && r.kid.origin >= 3, `${tag} 小孩的階層和出身跟著家裡（士紳的孩子算士紳）`, r.kid);
    ok(r.kid && r.kid.fixed >= 3, `${tag} 16 歲之後出身定下來，爸媽變窮也不改`, r.kid);
    ok(r.biz && r.biz.l1 >= 3 && r.biz.l1 > r.biz.l0, `${tag} 擁有產業算士紳（做生意往上爬）`, r.biz);
    ok(r.wed && r.wed.l1 >= r.wed.y - 1 && r.wed.l1 > r.wed.l0, `${tag} 嫁娶進貴族家，階層跟著拉高（最多到配偶下一階）`, r.wed);
    ok(r.rise && r.rise.told === 'rise' && r.rise.log && r.rise.mem, `${tag} 白手起家：日誌、記憶都有`, r.rise);
    ok(r.rise && r.rise.brief && r.rise.tag && r.rise.card, `${tag} AI 知道自己的出身，村民卡有「白手起家」標籤`, r.rise);
    ok(r.fall && r.fall.told === 'fall' && r.fall.three && r.fall.st >= 1, `${tag} 家道中落：爸爸白手起家、兒子敗光 → 富不過三代`, r.fall);
    ok(r.appr && r.appr.started && r.appr.start, `${tag} 沒出路的年輕人拜熟識的師傅為師`, r.appr);
    ok(r.appr && r.appr.job === 'blacksmith' && r.appr.done && r.appr.xp && r.appr.log, `${tag} 學滿一個月出師，換成工匠的工作、手藝變好`, r.appr);
    ok(r.spree && r.spree.spent > 0 && r.spree.cons, `${tag} 敗家：錢花掉了，但付給店家，全鎮銀幣總數不變`, r.spree);
    ok(r.ui && r.ui.view && r.ui.saved, `${tag} 流動統計與存檔`, r.ui);
  }
  ok(r.ui && r.ui.panel, `${tag} 鎮況看得到「階層流動」`, r.ui);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [lang, mobile] of [['zh', false], ['en', false], ['zh', true]]) await run(browser, lang, mobile);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
