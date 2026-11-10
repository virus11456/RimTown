// v9.9.4 驅逐與搬走的財產處理:限期 7 天變賣、家人接手 → 股東 8 折 → 夥計集資 8 折 → 有錢人出價(仗義原價／趁火打劫 6 折) → 公庫 5 折 → 沒人要;
// 先還銀行(不夠就收房子、再不夠成呆帳、家人不揹債)、犯罪沒收五成、自己搬走也照順序處理、錢不會憑空產生或消失
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; for (let i = 0; i < 2 * 96; i++) { w.paused = false; w.tick(); }
    const out = {}; const rnd = Math.random; const heirs0 = MARKET.heirsOf;
    const logs = () => (w.messageLog || []).map(m => m.content || '');
    const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const W = w.wallet; W.bal[a.agentId] = n; };
    const M = MARKET.S(w); const K = Object.keys(MARKET.SECTORS); const BK = BANK.S(w); BK.loans = BK.loans || {}; BK.dep = BK.dep || {};
    const total = () => MONEY.total(w);
    const ff = (id) => { const P = EXILE.S(w).pending[id]; if (P) P.until = w._absDay(); EXILE.S(w).lastDay = null; EXILE.daily(w); };
    const step = () => { EXILE.S(w).lastDay = null; EXILE.daily(w); };
    const reset = (k) => { for (const a of adults()) setCash(a, 0); MARKET.heirsOf = () => []; for (const q of K) { if (q !== k) continue; delete M.rival?.[q]; } };
    const clear = (X) => { for (const q of K) { if (M.owners[q] === X.agentId) { M.owners[q] = null; delete M.shares[q]; } else if (M.shares?.[q]?.[X.agentId]) { delete M.shares[q][X.agentId]; } } for (const u of Object.values(w.estate?.units || {})) if (u.owner === X.agentId) u.owner = null; for (const sh of (w.biz?.shops || [])) if (sh.owner === X.agentId) sh.closed = true; };
    const own = (X, k) => { clear(X); M.owners[k] = X.agentId; M.shares[k] = { [X.agentId]: 100 }; };
    const used = new Set(); const pick = (n) => { let L = adults().filter(a => !used.has(a.agentId) && !EXILE.pendingOf(w, a.agentId)).slice(0, n); if (L.length < n) { used.clear(); L = adults().filter(a => !EXILE.pendingOf(w, a.agentId)).slice(0, n); } /* 人口少的鎮:用完了就重複用還在鎮上的人 */ L.forEach(a => used.add(a.agentId)); return L; };
    try {
      // A. 限期:判決後人還在,7 天內每天找買家;期滿才離開
      { const [X] = pick(1); reset(); const k = K[0]; own(X, k); MARKET.heirsOf = () => [];
        EXILE.order(w, X, { crime: false, reason: 'test' }); out.grace = { still: !!w.agents[X.agentId], pending: !!EXILE.pendingOf(w, X.agentId), brief: EXILE.brief(w, X), log: logs().slice(-3).some(s => /限期 7 天|7 days/.test(s)) };
        const html = (app._renderEconomyTab?.() || ''); out.grace.panel = /限期離鎮|Must leave town/.test(document.body.innerHTML + html) || !!EXILE.view(w).pending.length;
        const sv = JSON.parse(JSON.stringify(w.serialize())); out.grace.saved = !!sv.exile?.pending?.[X.agentId];
        ff(X.agentId); out.grace.gone = !w.agents[X.agentId]; }
      // B. 家人直接接手產業和房子
      { const [X, Y] = pick(2); reset(); const k = K[1]; own(X, k); const u = Object.values(w.estate?.units || {}).find(z => !z.owner) || Object.values(w.estate?.units || {})[0]; if (u) u.owner = X.agentId; MARKET.heirsOf = (ww, a) => a === X ? [Y] : [];
        EXILE.order(w, X, {}); step(); out.family = { sector: M.owners[k] === Y.agentId, house: !u || u.owner === Y.agentId, log: logs().slice(-6).some(s => /留給了|left the/.test(s)) }; ff(X.agentId); }
      // C. 股東八折
      { const [X, P] = pick(2); reset(); const k = K[2]; M.owners[k] = X.agentId; M.shares[k] = { [X.agentId]: 60, [P.agentId]: 40 }; setCash(P, 2000); const v = EXILE.valueOf(w, { t: 'sector', k, pct: 60 }); const c0 = cash(X);
        Math.random = () => 0.99; try { EXILE.order(w, X, {}); step(); } finally { Math.random = rnd; }
        out.partner = { all: M.shares[k]?.[P.agentId] === 100, boss: M.owners[k] === P.agentId, paid: Math.round(cash(X) - c0), want: Math.round(v * 0.8) }; ff(X.agentId); }
      // D. 夥計集資八折
      { const [X] = pick(1); reset(); const k = K[3]; own(X, k); const ws = MARKET.workersOf(w, k, adults()).filter(a => a !== X).slice(0, 4); for (const a of ws) setCash(a, 400);
        Math.random = () => 0.99; try { EXILE.order(w, X, {}); step(); } finally { Math.random = rnd; }
        const s = M.shares[k] || {}; out.staff = { n: ws.length, holders: Object.keys(s).filter(id => ws.some(a => a.agentId === id)).length, boss: ws.some(a => a.agentId === M.owners[k]), log: logs().slice(-6).some(s2 => /夥計湊錢|pooled/.test(s2)) }; ff(X.agentId); }
      // E. 有錢人出價:交情好的照原價,只有貪心的時候六折
      { const [X, F, G] = pick(3); reset(); const k = K[4]; own(X, k); setCash(F, 3000); setCash(G, 3000); F.relationships.getOrCreate(X.agentId, X.name).affinity = 70; F.personality.traits = F.personality.traits.filter(t => t !== 'greedy'); G.personality.traits = [...G.personality.traits.filter(t => t !== 'greedy'), 'greedy']; G.relationships.getOrCreate(X.agentId, X.name).affinity = 0;
        for (const a of adults()) if (a !== F && a !== X) a.relationships.getOrCreate(X.agentId, X.name).affinity = Math.min(a.relationships.getOrCreate(X.agentId, X.name).affinity, 10);
        const v = EXILE.valueOf(w, { t: 'sector', k, pct: 100 }); const c0 = cash(X); Math.random = () => 0.1; try { EXILE.order(w, X, {}); step(); } finally { Math.random = rnd; }
        out.friend = { boss: M.owners[k] === F.agentId, paid: Math.round(cash(X) - c0), v: Math.round(v), log: logs().slice(-6).some(s => /仗義|stood by/.test(s)) }; ff(X.agentId);
        const [X2] = pick(1); own(X2, k); setCash(F, 0); setCash(G, 3000); const c1 = cash(X2); const v2 = EXILE.valueOf(w, { t: 'sector', k, pct: 100 }); Math.random = () => 0.1; try { EXILE.order(w, X2, {}); step(); } finally { Math.random = rnd; }
        out.vulture = { boss: M.owners[k] === G.agentId, paid: Math.round(cash(X2) - c1), v: Math.round(v2 * 0.6), log: logs().slice(-6).some(s => /趁火打劫|took advantage/.test(s)) }; ff(X2.agentId); }
      // F. 沒人買:最後一天公庫五折收購;公庫沒錢就血本無歸
      { const [X] = pick(1); reset(); const k = K[5] || K[0]; own(X, k); const v = EXILE.valueOf(w, { t: 'sector', k, pct: 100 }); w.stockpile.add('silver', 5000, w.tickCount, 'test'); const t0 = w.stockpile.get('silver'); const c0 = cash(X);
        Math.random = () => 0.99; try { EXILE.order(w, X, {}); step(); out.town = { notYet: M.owners[k] === X.agentId }; const P = EXILE.S(w).pending[X.agentId]; P.until = w._absDay(); P.crime = false; step(); } finally { Math.random = rnd; }
        out.town.pub = !M.owners[k]; out.town.spent = Math.round(t0 - w.stockpile.get('silver')); out.town.half = Math.round(v * 0.5); out.town.gone = !w.agents[X.agentId];
        const [X2] = pick(1); reset(); own(X2, k); const s = w.stockpile.get('silver'); w.stockpile.consume('silver', s, w.tickCount, 'test'); EXILE.order(w, X2, {}); ff(X2.agentId);
        out.lost = { pub: !M.owners[k], log: logs().slice(-8).some(q => /沒人要|No one wanted/.test(q)) }; w.stockpile.add('silver', s, w.tickCount, 'test'); }
      // G. 先還銀行:賣掉的錢先還債 → 還不夠收房子 → 再不夠成呆帳(家人不揹債,也不能先把東西送給家人)
      { const [X, Y, R] = pick(3); reset(); const k = K[0]; own(X, k); setCash(X, 20); BK.dep[X.agentId] = 30; BK.reserve = (BK.reserve || 0) + 30; BK.loans[X.agentId] = { owed: 120, due: w._absDay() + 30, rate: 0.1 }; setCash(R, 5000); MARKET.heirsOf = (ww, a) => a === X ? [Y] : [];
        const res0 = BK.reserve, bad0 = BK.bad || 0; Math.random = () => 0.1; try { EXILE.order(w, X, {}); step(); } finally { Math.random = rnd; }
        out.debt1 = { notToFamily: M.owners[k] !== Y.agentId, sold: M.owners[k] && M.owners[k] !== X.agentId }; ff(X.agentId);
        out.debt1.paid = !BK.loans[X.agentId] && (BK.bad || 0) === bad0 && BK.reserve >= res0 + 90 - 0.01;
        const [X2] = pick(1); reset(); clear(X2); const u = Object.values(w.estate?.units || {}).find(z => !z.owner) || Object.values(w.estate?.units || {})[1]; if (u) u.owner = X2.agentId; setCash(X2, 5); BK.loans[X2.agentId] = { owed: 500, due: w._absDay() + 30, rate: 0.1 };
        EXILE.order(w, X2, {}); ff(X2.agentId); out.debt2 = { house: !u || u.owner !== X2.agentId, loan: !BK.loans[X2.agentId], log: logs().slice(-8).some(q => /被銀行收走|bank took/.test(q)) || !u };
        const [X3] = pick(1); reset(); clear(X3); setCash(X3, 5); BK.loans[X3.agentId] = { owed: 300, due: w._absDay() + 30, rate: 0.1 }; const bad1 = BK.bad || 0;
        EXILE.order(w, X3, {}); ff(X3.agentId); out.debt3 = { bad: Math.round((BK.bad || 0) - bad1), log: logs().slice(-6).some(q => /呆帳|bad debt/.test(q)) }; }
      // H. 犯罪:還完債剩下的沒收五成進公庫;錢不會憑空產生或消失
      { const [X] = pick(1); reset(); clear(X); setCash(X, 200); BK.loans[X.agentId] = { owed: 50, due: w._absDay() + 30, rate: 0.1 }; const t0 = w.stockpile.get('silver'); const T0 = total();
        EXILE.order(w, X, { crime: true, reason: 'crime' }); ff(X.agentId); const h = EXILE.S(w).hist[0];
        out.crime = { conf: Math.round(w.stockpile.get('silver') - t0), carried: h?.carried, crime: h?.crime, log: logs().slice(-6).some(q => /沒收五成|confiscated/.test(q)), drift: Math.round((T0 - total()) - (h?.carried || 0)) }; }
      // I. 自己搬走(不是驅逐):當下就處理,房子不會掛在不在的人名下
      { const [X, Y] = pick(2); reset(); clear(X); const u = Object.values(w.estate?.units || {}).find(z => !z.owner) || Object.values(w.estate?.units || {})[2]; if (u) u.owner = X.agentId; MARKET.heirsOf = (ww, a) => a === X ? [Y] : [];
        w.leaveTown(X.agentId, 'moving'); out.volunt = { gone: !w.agents[X.agentId], house: !u || u.owner === Y.agentId }; }
      // J. 配偶離開小鎮:留下的人改成前任,可以再婚
      { const [X, Y] = pick(2); X.relationships.getOrCreate(Y.agentId, Y.name).status = 'married'; Y.relationships.getOrCreate(X.agentId, X.name).status = 'married'; w.leaveTown(X.agentId, 'moving');
        out.unpair = { st: Y.relationships.relationships[X.agentId]?.status, partner: !!Y.getPartner?.() }; }
      // K. 出遠門不會把罰款一筆勾銷
      { const [X] = pick(1); const F = MONEY.S(w).fines = MONEY.S(w).fines || {}; F[X.agentId] = { owed: 50, since: w._absDay(), why: 'test' }; const keep = w.agents[X.agentId]; const ia = w.isAway; w.isAway = (id) => id === X.agentId || ia.call(w, id);
        delete w.agents[X.agentId]; try { MONEY.finesDaily(w); } catch (e) {} out.away = { kept: !!F[X.agentId] }; w.agents[X.agentId] = keep; w.isAway = ia; delete F[X.agentId]; }
      // L. 老闆過世:小店交給合夥人(以前跟著關掉)
      { const [X, P] = pick(2); reset(); const sh = { id: 'xd1', type: Object.keys(BIZ.TYPES)[0], name: ['過世測試鋪', 'Passing Test Shop'], owner: X.agentId, partner: P.agentId, price: 3, till: 0, week: 0, profit: 0, lossDays: 0, closed: false }; BIZ.S(w).shops.push(sh);
        X._deathCause = 'test'; w.lifecycle._killNpc(w, X); out.shopHeir = { owner: sh.owner === P.agentId, open: !sh.closed, log: logs().slice(-8).some(q => /接手|taken over/.test(q)) }; }
      // M. 驅逐門檻:第 3 次勞役、第 5 次才逐出;兩個月沒再犯前科會淡
      { const [X, Y, Z] = pick(3); const D = DARK.S ? DARK.S(w) : w.dark; D.exposedCount = D.exposedCount || {}; D.lastHeavy = D.lastHeavy || {}; const P = w.proposals; const pen = (cnt, ago) => { D.exposedCount[X.agentId] = cnt; D.lastHeavy[X.agentId] = w._absDay() - ago; P.items = (P.items || []).filter(q => !(q.kind === 'verdict' && q.status === 'open'));
          const sc = DARK.secret(w, { kind: 'sabotage', culprit: X.agentId, victim: Y.agentId, k: '{a}偷偷破壞了{v}的工作', p: { a: X.name, v: Y.name } }); const R2 = Math.random; Math.random = () => 0.99; try { DARK.reveal(w, sc, Z); } finally { Math.random = R2; } return (P.items || []).find(q => q.kind === 'verdict' && q.status === 'open' && q.culprit === X.agentId)?.pen; };
        out.thresh = { third: pen(2, 1), fifth: pen(4, 1), faded: pen(4, 200) }; }
    } finally { MARKET.heirsOf = heirs0; Math.random = rnd; }
    out.raw = logs().slice(-80).filter(s => /\{[a-z]\}|\[object Object\]/.test(s));
    return out;
  });
  console.log(lang, JSON.stringify(r).slice(0, 1500));
  ok(r.grace.still && r.grace.pending && r.grace.log && /被逐出|banished/.test(r.grace.brief) && r.grace.saved && r.grace.gone, `[${lang}] 判決後限期 7 天：人還在、AI 知道、存檔帶著，期滿才離開`, r.grace);
  ok(r.family.sector && r.family.house && r.family.log, `[${lang}] 家人直接接手產業和房子`, r.family);
  ok(r.partner.all && r.partner.boss && Math.abs(r.partner.paid - r.partner.want) <= 1, `[${lang}] 股東照八折買下股份`, r.partner);
  ok(r.staff.n >= 2 && r.staff.holders >= 2 && r.staff.boss && r.staff.log, `[${lang}] 夥計集資八折買下產業`, r.staff);
  ok(r.friend.boss && Math.abs(r.friend.paid - r.friend.v) <= 1 && r.friend.log, `[${lang}] 交情好的朋友仗義照原價買`, r.friend);
  ok(r.vulture.boss && Math.abs(r.vulture.paid - r.vulture.v) <= 1 && r.vulture.log, `[${lang}] 只剩貪心的人時被壓到六折`, r.vulture);
  ok(r.town.notYet && r.town.pub && Math.abs(r.town.spent - r.town.half) <= 1 && r.town.gone, `[${lang}] 沒人買：最後一天公庫五折收購，變公營`, r.town);
  ok(r.lost.pub && r.lost.log, `[${lang}] 公庫也沒錢：沒人要，血本無歸`, r.lost);
  ok(r.debt1.notToFamily && r.debt1.sold && r.debt1.paid, `[${lang}] 欠銀行錢：不能先送給家人，賣掉的錢先還清貸款`, r.debt1);
  ok(r.debt2.house && r.debt2.loan && r.debt2.log, `[${lang}] 還不夠：銀行收走他的房子`, r.debt2);
  ok(r.debt3.bad >= 290 && r.debt3.log, `[${lang}] 再不夠：成了銀行的呆帳（家人不揹債）`, r.debt3);
  ok(r.crime.crime && r.crime.conf === 75 && r.crime.carried === 75 && r.crime.log, `[${lang}] 犯罪被逐出：還完債剩下的沒收五成進公庫`, r.crime);
  ok(Math.abs(r.crime.drift) <= 1, `[${lang}] 錢不會憑空產生或消失（少掉的剛好是他帶走的）`, r.crime);
  ok(r.volunt.gone && r.volunt.house, `[${lang}] 自己搬走也當下處理：房子交給家人，不會掛在不在的人名下`, r.volunt);
  ok(r.unpair.st === 'ex' && !r.unpair.partner, `[${lang}] 配偶離開小鎮：留下的人改成前任，可以再婚`, r.unpair);
  ok(r.away.kept, `[${lang}] 出遠門不會把罰款一筆勾銷`, r.away);
  ok(r.shopHeir.owner && r.shopHeir.open && r.shopHeir.log, `[${lang}] 老闆過世：小店交給合夥人，不會跟著關掉`, r.shopHeir);
  ok(r.thresh.third === 'labor' && r.thresh.fifth === 'exile' && r.thresh.faded === 'fine', `[${lang}] 驅逐門檻提高：第 3 次勞役、第 5 次才逐出，兩個月沒再犯前科會淡`, r.thresh);
  ok(!r.raw.length, `[${lang}] 日誌沒有沒填的 {x} 或 [object Object]`, r.raw.slice(0, 3));
  ok(!errs.length, `[${lang}] 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
