// RimTown - sim-treasury.js（v10.7.0 公庫財政）
// 量過一個 115 人的鎮（第 13 年）：全鎮有六萬八千多銀幣，公庫只有三千四，每天收 550～575、支出 620～670，30 天掉到剩幾百，還有幾天發不出全薪。
// 錢不是不夠，是幾個寫死的門檻讓公庫留不住錢：
//   - 公庫超過 300 的部分每天自動花掉 8%。300 是寫死的，25 人和 115 人同一個數字，也不跟物價走；那個鎮一天要花六百多，300 連半天都不夠
//   - 公庫高於每人 8 銀幣就被當成寬裕、有人提減稅；低於每人 4 銀幣才有人提加稅。那個鎮每人 8 銀幣只夠花一天半，稅率就一路被減到最低的 2%
//   - 公共工程、生活補助的門檻也都是「每人幾銀幣」
// 這個檔案把這些門檻換成同一把尺：公庫現在的錢，夠付幾天的固定支出。
//   固定支出  ＝公職薪水＋建築維護＋每天要還的債（跟著人口、物價、編制自己變）
//   安全存量  ＝30 天的固定支出。公庫先留到這個數，超過的才是「可以動用的錢」
//   可以動用的錢 超過安全存量的全部，加上 10 天門檻到安全存量之間那一段的四分之一；拿去蓋公共建設、發補助（原本的機制，只是門檻換了）。自動花掉 8% 那一條取消
//   稅率      公庫不夠付 10 天而且不是正在回升、或最近發不出薪水 → 有人提加稅；夠付 45 天以上而且窮人多 → 才有人提減稅
// 另外記一本公庫的帳（最近 30 天每一類收了多少、花了多少），小鎮概況多一張「公庫」卡
'use strict';
const TREASURY = (() => {
    const RES_DAYS = 30, LOW_DAYS = 10, HIGH_DAYS = 45, KEEP = 30;
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const r2 = (n) => Math.round(n * 100) / 100;
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const BIG = ['town_walls', 'clock_tower', 'aqueduct', 'press', 'bank', 'hospital', 'council_hall', 'observatory', 'theater', 'sewers', 'barracks', 'caravanserai']; // 跟維護費那邊同一張表
    function S(w) { if (!w.treasury || typeof w.treasury !== 'object') w.treasury = { fx: null, led: {}, lastDay: null }; const T = w.treasury; T.led = T.led || {}; return T; }
    const silver = (w) => w?.stockpile?.get?.('silver') || 0;
    // ---------- 固定支出 ----------
    // 領公庫薪水的人：有工作、不是私人老闆發薪、沒在服勞役（跟發薪那邊同一個條件）
    function staff(w) {
        if (typeof WALLET === 'undefined' || !w?.wallet) return [];
        let jail = null; try { jail = typeof MONEY !== 'undefined' && MONEY.laborSet ? MONEY.laborSet(w) : null; } catch (e) {}
        return npcs(w).filter(a => WALLET.WAGE[a.job?.key] && !(typeof MARKET !== 'undefined' && MARKET.privatePaid?.(w, a)) && !(typeof CLERGY !== 'undefined' && CLERGY.paidBy(w, a)) && !(jail && jail.has(a.agentId))); // v10.9.0 神職由教團發薪，不算公庫的人
    }
    function payroll(w) { if (typeof WALLET === 'undefined' || !w?.wallet) return 0; const W = w.wallet; const PR = (typeof FISCAL !== 'undefined') ? FISCAL.pubRate(w) : 1; let off = 0; try { off = (typeof OFFICE !== 'undefined' && OFFICE) ? OFFICE.payDaily(w) : 0; } catch (e) {} return r2(staff(w).reduce((s, a) => s + Math.max(W.minWage || 0, WALLET.wageOf(a) * PR * (1 - (W.tax || 0))), 0) + off); } // v11.0.0 管店家的官員津貼也算
    const upkeep = (w) => (w?.buildings?.completed || []).reduce((s, b) => s + (BIG.includes(b.buildingKey) ? 4 : 2) * (b.level || 1), 0);
    function debt(w) { const D = w?.bank?.debt; let bond = 0; try { bond = (typeof FISCAL !== 'undefined') ? FISCAL.debtDaily(w) : 0; } catch (e) {} return r2((D && D.owed > 0 ? Math.min(D.owed, Math.max(2, Math.ceil(D.owed * 0.03))) : 0) + bond); } // v10.8.0 公債的利息與還本也算
    const fixedNow = (w) => r2(payroll(w) + upkeep(w) + debt(w));
    // 平滑過的固定支出（一兩天的人事變動不會讓門檻跳來跳去）
    function fixed(w) { const T = S(w); if (!(T.fx > 0)) T.fx = fixedNow(w); return Math.max(1, T.fx); }
    const reserve = (w) => Math.max(300, Math.round(RES_DAYS * fixed(w)));
    const days = (w) => silver(w) / fixed(w);
    const spare = (w) => Math.max(0, silver(w) - reserve(w));
    // 可以動用的錢：超過安全存量的全部，加上「10 天門檻到安全存量之間」那一段的四分之一
    // （還在存的時候，救濟和公共建設照樣有一點預算，不會整個停擺；公庫不到 10 天就一毛都不動）
    const budget = (w) => { const s = silver(w), r = reserve(w), lo = LOW_DAYS * fixed(w); return Math.max(0, Math.round(Math.max(0, s - r) + 0.25 * Math.max(0, Math.min(s, r) - lo))); };
    const low = (w) => days(w) < LOW_DAYS;
    const high = (w) => days(w) >= HIGH_DAYS;
    // ---------- 公庫的帳 ----------
    // 依原因歸類。原因是當下語言的字串，所以用翻譯後的字比對；比不到的算「其他」
    const CATS = {
        in: [['tax_sales', ['營業稅']], ['tax_corp', ['營利事業所得稅']], ['tax_income', ['所得稅']], ['tax_prop', ['地價稅', '遺產稅', '關稅', '無人繼承的遺產', '離境稅', '財產稅', '宗教捐獻稅']], ['bond', ['發行公債']],
            ['rent', ['店租與營業開銷', '公有房舍租金', '公有房舍標售', '公營產業標售', '代管店面的收入']], ['fine', ['罰款與沒收', '罰款', '沒收犯罪者財產']], ['fee', ['醫療收入：看診', '醫療收入：手術', '醫療收入']],
            ['goods', ['商人出口的貨款', '賣貨給商行', '商店出售', '酒館', '村民消費', '商人出口', '跨鎮商隊', '賣出多餘的貨', '賣給外地', '賣出', '訂單完成']]],
        out: [['pay', ['發薪水', '公職津貼']], ['upkeep', ['建築維護']], ['works', ['公共開支', '公共工程', '興建公有房舍', '公有房舍修繕']], ['import', ['原料進口', '向商行買進口貨']],
            ['relief', ['生活補助', '救濟金', '公費醫療補助']], ['debt', ['償還紓困債', '公債利息', '償還公債']], ['goods', ['貨款轉給產業', '公庫收購產業']]],
    };
    let _tab = null, _tabLang = null;
    function table() {
        let lang = ''; try { lang = typeof LLM_LANG !== 'undefined' ? LLM_LANG.get() : (typeof localStorage !== 'undefined' ? localStorage.getItem('rimtown-lang') : ''); } catch (e) {}
        if (_tab && _tabLang === lang) return _tab; _tab = { in: [], out: [] }; _tabLang = lang;
        const tr = (s) => { try { return t(s); } catch (e) { return s; } };
        for (const side of ['in', 'out']) for (const [cat, list] of CATS[side]) for (const s of list) { _tab[side].push([s, cat]); const x = tr(s); if (x !== s) _tab[side].push([x, cat]); }
        return _tab;
    }
    function catOf(side, why, src) {
        const k = String(why || ''); if (k) for (const [s, cat] of table()[side]) if (k === s || k.startsWith(s)) return cat;
        if (side === 'out' && src === 'proposal') return 'works';
        return 'other';
    }
    function note(w, delta, why, src) {
        if (!w || !w.observerMode || !(Math.abs(delta) > 1e-6)) return; const T = S(w), d = day(w); const D = T.led[d] || (T.led[d] = {});
        const side = delta > 0 ? 'in' : 'out'; const k = (side === 'in' ? '+' : '-') + catOf(side, why, src); D[k] = r2((D[k] || 0) + Math.abs(delta));
    }
    function daily(w) {
        const T = S(w), d = day(w); if (T.lastDay === d) return; T.lastDay = d;
        const now = fixedNow(w); T.fx = T.fx > 0 ? r2(T.fx + (now - T.fx) * 0.2) : now;
        for (const k of Object.keys(T.led)) if (+k < d - KEEP) delete T.led[k];
    }
    // 最近 n 天每一類的每日平均
    function ledger(w, n = KEEP) {
        const T = S(w), d = day(w); const out = { in: {}, out: {}, days: 0, inSum: 0, outSum: 0 }; const ks = Object.keys(T.led).filter(k => +k > d - n && +k <= d); out.days = Math.max(1, ks.length);
        for (const k of ks) for (const [c, v] of Object.entries(T.led[k])) { const side = c[0] === '+' ? 'in' : 'out'; out[side][c.slice(1)] = (out[side][c.slice(1)] || 0) + v; }
        for (const side of ['in', 'out']) { for (const c of Object.keys(out[side])) { out[side][c] = r2(out[side][c] / out.days); out[side + 'Sum'] += out[side][c]; } out[side + 'Sum'] = r2(out[side + 'Sum']); }
        return out;
    }
    // 最近 n 天公庫是在漲還是在掉（每天平均結餘）。帳不滿 5 天時回 null（還看不出來）
    function trend(w, n = 7) { const T = S(w), d = day(w); const ks = Object.keys(T.led).filter(k => +k > d - n && +k <= d); if (Object.keys(T.led).length < 5 || !ks.length) return null; let s = 0; for (const k of ks) for (const [c, v] of Object.entries(T.led[k])) s += c[0] === '+' ? v : -v; return r2(s / ks.length); }
    // 該不該加稅：公庫不夠付 10 天，而且不是正在回升（剛開鎮、剛付完一筆大錢，公庫低但每天都在進帳，就不急著加）
    const needTax = (w) => { if (!low(w)) return false; const tr = trend(w); return tr !== null && tr <= 0; };
    const NAME = { tax_sales: '營業稅', tax_corp: '營利事業所得稅', tax_income: '所得稅', tax_prop: '財產與關稅', bond: '借來的公債', rent: '租金與標售', fine: '罰款與沒收', fee: '醫療收入', goods: '賣公家倉庫的貨', pay: '公職薪水', upkeep: '建築維護', works: '公共建設', import: '進口', relief: '救濟與補助', debt: '還債', other: '其他' };
    function view(w) {
        const st = staff(w); const jobs = {}, jobName = {}; for (const a of st) { jobs[a.job.key] = (jobs[a.job.key] || 0) + 1; jobName[a.job.key] = a.job.title || a.job.key; }
        const L = ledger(w); const pop = npcs(w).length;
        return { silver: Math.round(silver(w)), fixed: r2(fixed(w)), payroll: payroll(w), upkeep: upkeep(w), debt: debt(w), reserve: reserve(w), days: Math.round(days(w) * 10) / 10, spare: Math.round(spare(w)), budget: budget(w), low: low(w), high: high(w),
            staff: st.length, pop, jobs, jobName, tax: w.wallet?.tax ?? null, unpaid: w.wallet?.unpaid || 0, short: (w.wallet?.shortDay ?? -99) >= day(w) - 7, owed: Math.round(w.bank?.debt?.owed || 0), ledger: L, RES_DAYS, LOW_DAYS, HIGH_DAYS };
    }
    // 給 AI 的一句話（發想提案、投票時知道公庫撐得了幾天）
    function brief(w) {
        if (typeof WALLET === 'undefined' || !w?.wallet) return ''; const v = view(w); const tr = (s) => { try { return t(s); } catch (e) { return s; } };
        return tr('公庫 {s} 銀幣，夠付 {d} 天的固定支出（薪水與維護一天約 {f}）；安全存量是 {r}').replace('{s}', v.silver).replace('{d}', Math.floor(v.days)).replace('{f}', Math.round(v.fixed)).replace('{r}', v.reserve) + (v.low ? tr('，快撐不住了') : v.budget > 0 ? tr('，有 {n} 可以動用').replace('{n}', v.budget) : tr('，還沒存夠'));
    }
    return { S, staff, payroll, upkeep, debt, fixedNow, fixed, reserve, days, spare, budget, low, high, trend, needTax, note, daily, ledger, view, brief, catOf, NAME, RES_DAYS, LOW_DAYS, HIGH_DAYS };
})();
if (typeof globalThis !== 'undefined') globalThis.TREASURY = TREASURY;

// ---- 掛勾 ----
// 公庫銀幣的每一筆進出都記一筆（pay 會逐項呼叫 consume，所以只包 add 與 consume）
if (typeof Stockpile !== 'undefined') {
    const SP = Stockpile.prototype; const _add = SP.add, _consume = SP.consume;
    // 記的是這一筆本身的金額。扣錢時別的掛勾可能順手把一部分付回公庫（公營產業的工程款），那一筆會由它自己的 add 記下，不能用前後差額算
    SP.add = function (r, amount, tick = 0, reason = '', source = '') { const out = _add.call(this, r, amount, tick, reason, source); if (r === 'silver') { try { TREASURY.note(this._world, +amount || 0, reason, source); } catch (e) {} } return out; };
    SP.consume = function (r, amount, tick = 0, reason = '', source = '') { const out = _consume.call(this, r, amount, tick, reason, source); if (r === 'silver' && out) { try { TREASURY.note(this._world, -(+amount || 0), reason, source); } catch (e) {} } return out; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { try { if (w.observerMode) TREASURY.daily(w); } catch (e) { console.warn('[Treasury] daily', e); } return _daily.call(this, w, ...rest); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.treasury = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.treasury) d.treasury = this.treasury; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.treasury = (data?.treasury && typeof data.treasury === 'object') ? data.treasury : null; } catch (e) {} return r; };
}
