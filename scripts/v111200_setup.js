// v11.12.0 測試共用：照「公庫只夠 5～6 天、稅率 2%、每天小有結餘、三個監管職位空著、銀行有錢」造一座 116 人的城
// 給 v111200_test.js、v111200_smoke.js、v111200_scene.js 用（page.addScriptTag 載入）
(() => {
  const npcs = (w) => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
  const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 18);
  function tickDay(w) { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; }
  function setup(seed, o = {}) {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed, pop: o.pop || 116 }); w.observerMode = true; w.fullAgentMode = false;
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tickDay(w);
    const d = w._absDay();
    for (const a of npcs(w)) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    let M = npcs(w).find(a => a.job?.key === 'mayor'); if (!M) { M = adults(w)[0]; M.job = new Job('mayor'); }
    if (o.traits) M.personality.traits = o.traits.slice(); if (o.values) M.personality.values = o.values.slice();
    // 銀行：銀行家是首長以外最有錢的商人；最有錢的二十人存了三萬六千多，沒有放款
    const B = BANK.S(w); const pool = adults(w).filter(a => a !== M); const tr = pool.filter(a => a.job?.key === 'trader');
    const BK = (tr.length ? tr : pool).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0];
    B.open = true; B.status = 'ok'; B.banker = BK.agentId; B.loans = {}; B.bonds = []; B.offer = null; B.run = null; B.bad = 0; B.desk = null; B.refused = {}; B.dep = {};
    const savers = pool.filter(a => a !== BK).slice(0, 20); const DEP = o.dep ?? 36819; savers.forEach((a, i) => { B.dep[a.agentId] = Math.round(DEP * (i < 3 ? 0.2 : 0.4 / 17)); });
    B.reserve = Object.values(B.dep).reduce((s, x) => s + x, 0); B.lastRunEnd = d; // 剛開始的這段時間不要擠兌（照原本的規則，擠兌冷卻 20 天）
    // 私人手上的錢：最有錢的一成拿著八成六
    const rich = pool.slice().sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x)); const k10 = Math.max(1, Math.round(rich.length / 10));
    rich.forEach((a, i) => { w.wallet.bal[a.agentId] = i < k10 ? Math.round(39031 / k10) : Math.round(6431 / (rich.length - k10)); });
    // 私人產業：每一行交給一位有錢人當東家（稅務員查的是東家的帳）
    { const Mk = MARKET.S(w); Mk.rival = {}; const owners = rich.filter(a => a !== BK).slice(0, Object.keys(MARKET.SECTORS).length); Object.keys(MARKET.SECTORS).forEach((k, i) => { if (owners[i]) { Mk.owners[k] = owners[i].agentId; Mk.pay[k] = 1; } }); if (owners[0]) owners[0].personality.traits = Array.from(new Set([...(owners[0].personality.traits || []), 'greedy'])); }
    w.wallet.tax = o.tax ?? 0.02; w.wallet.shortDay = -99; w.wallet.unpaid = 0;
    // 公庫：夠付 5.8 天
    w.fiscal = null; FISCAL.S(w); w.treasury = null; const T = TREASURY.S(w); T.lastDay = d; T.fx = TREASURY.fixedNow(w); const fx = T.fx;
    w.stockpile.resources.silver = Math.round(fx * (o.days ?? 5.8));
    T.led = {}; const pr = TREASURY.payroll(w); const inc = o.inc ?? Math.max(1.53 * fx, pr / 0.563) / fx, out = o.out ?? inc * 544 / 611; for (let k = 0; k < 30; k++) T.led[d - k] = { '+tax_income': Math.round(fx * inc * 100) / 100, '-pay': Math.round(fx * out * 100) / 100 }; // 公職薪水占收入 56%（真實存檔 344／611），收支比照 611／544
    // 監管職位全部空著
    w.office = null; OFFICE.S(w).mayor = M.agentId; OFFICE.S(w).lastDay = d;
    // 提案：清掉還在表決的；最近兩次加稅提案被否決
    const P = w.proposals; P.items = P.items.filter(p => !['open', 'shelved', 'approved'].includes(p.status));
    for (const ago of [22, 41]) P.items.push({ id: 'LX' + ago, kind: 'tax', dir: 'up', status: 'rejected', createdDay: d - ago - 3, resolvedDay: d - ago, newTax: 0.07, votes: {}, why: {}, proposerId: M.agentId, proposerName: M.name, tk: '加稅到 {n}%', tp: { n: 7 }, dk: '', dp: {} });
    CIVIC.S(w).lastTax = d - 22; w.decide.q = [];
    const MM = MONEY.S(w); MM.lastT = MONEY.total(w); MM.pend = 0;
    return { w, M, BK, B, app, d };
  }
  // 往後跑 n 天（每天回呼一次）
  function run(w, n, each) { for (let i = 0; i < n; i++) { tickDay(w); if (each) each(i + 1); } }
  // 這段時間帳上對不上的錢（「其他」）
  function other(w, d0) { const M = MONEY.S(w); let s = 0; for (const [k, D] of Object.entries(M.days || {})) if (+k > d0) s += D.other || 0; return Math.round(s * 100) / 100; }
  window.__fisc = { setup, run, tickDay, other, npcs, adults };
})();
