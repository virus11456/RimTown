// v10.9.0 神職由教團發薪：教團養得起幾位就幾位，神職多寡影響傳教快慢
// - 神職的薪水不再從公庫出，改由他服事的教團從奉獻基金裡發（所得稅照樣進公庫）。
// - 教團養得起幾位：最近 14 天平均每天收到的奉獻扣掉場所維護，加上基金攤 90 天，除以一位神職一天的薪水。
// - 每週檢討一次：神職比養得起的多，薪水欠最久、虔誠度最低的那位卸下神職另外找工作；養得起更多，就從很虔誠的信徒裡按立一位。
// - 只剩一位、教團付得出一半以上的薪水時，他留下來領多少算多少。
// - 有領到薪水的神職越多，信徒越常去勸人、被勸的人越容易改信；一位都沒有時慢一半。
const CLERGY = (() => {
    const SPAN = 14, FUND_DAYS = 90, MIN_DAYS = 7, OWE_OUT = 7, CALL = 70, CALL_QUIT = 85, RESERVE_DAYS = 30;
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const r2 = (x) => Math.round(x * 100) / 100;
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const on = (w) => !!(w && w.observerMode && w.faith && w.wallet && typeof FAITH !== 'undefined' && typeof WALLET !== 'undefined' && (w.faith.rels || []).length);
    function S(w) {
        if (!w.clergy || typeof w.clergy !== 'object') w.clergy = { lastDay: null, inc: {}, got: {}, owe: {}, st: { paid: 0, short: 0, out: 0, in: 0 } };
        const C = w.clergy; C.inc = C.inc || {}; C.got = C.got || {}; C.owe = C.owe || {}; C.st = C.st || { paid: 0, short: 0, out: 0, in: 0 }; return C;
    }
    const isPriest = (a) => a?.job?.key === 'priest';
    // 公庫不發這個人的薪水（發薪、公庫固定支出、「領公庫薪水的人」三處共用）
    const paidBy = (w, a) => isPriest(a) && on(w);
    const relOf = (w, a) => { try { return FAITH.relOf(w, a); } catch (e) { return null; } };
    const piety = (w, a) => { try { return FAITH.pietyOf(w, a) || 0; } catch (e) { return 0; } };
    const headId = (w, R) => { try { return (typeof FAITH2 !== 'undefined' && FAITH2.headOf(w, R)?.agentId) || null; } catch (e) { return null; } };
    const priestsOf = (w, R) => { const h = headId(w, R); return FAITH.believers(w, R).filter(isPriest).sort((x, y) => ((y.agentId === h) - (x.agentId === h)) || (piety(w, y) - piety(w, x))); };
    const count = (w, all) => (all || npcs(w)).filter(isPriest).length;
    // 一位神職一天的薪水（教團付出去的全額，含所得稅）
    const wageOf = (w, a) => { const W = w.wallet || {}; const tax = W.tax || 0; return r2(Math.max(WALLET.wageOf(a), (W.minWage || 0) > 0 ? W.minWage / Math.max(0.01, 1 - tax) : 0)); };
    const std = (w) => { const W = w.wallet || {}; const tax = W.tax || 0; return Math.max(0.5, Math.max((WALLET.WAGE.priest || 3.5) * (WALLET.wageIdx ? WALLET.wageIdx() : 1), (W.minWage || 0) > 0 ? W.minWage / Math.max(0.01, 1 - tax) : 0)); };
    const upkeepOf = (w, R) => 0.3 + FAITH.believers(w, R).length * 0.03;
    const hist = (w, R) => S(w).inc[R.id] || [];
    const income = (w, R) => { const h = hist(w, R); return h.length ? h.reduce((s, x) => s + x, 0) / h.length : 0; };
    // 每天拿得出多少錢付薪水：奉獻扣掉場所維護，加上基金攤 90 天
    const budget = (w, R) => Math.max(0, income(w, R) - upkeepOf(w, R) + (R.fund || 0) / FUND_DAYS);
    const cap = (w, R) => Math.floor(budget(w, R) / std(w) + 1e-9);
    // 留得住幾位：養得起的人數；一位都養不起、但付得出半份薪水時留一位
    const keep = (w, R) => { const c = cap(w, R); return c > 0 ? c : (budget(w, R) >= std(w) * 0.5 ? 1 : 0); };
    const ready = (w, R) => hist(w, R).length >= MIN_DAYS;
    // 有在領薪水的神職（欠不到三天）
    const paidN = (w, R) => { const C = S(w); return priestsOf(w, R).filter(a => (C.owe[a.agentId] || 0) < 3).length; };
    // 傳教快慢：一位都沒有 0.5，一位 1，之後每多一位加三成，最多 1.9
    function reach(w, R) { if (!on(w) || !R) return 1; const n = paidN(w, R); return n <= 0 ? 0.5 : Math.min(1.9, 1 + 0.3 * (n - 1)); }
    // 基金要先留 30 天的神職薪水，超過的才拿去修建與濟貧
    const reserve = (w, R) => (on(w) ? r2(priestsOf(w, R).reduce((s, a) => s + wageOf(w, a), 0) * RESERVE_DAYS) : 0);
    const short = (w, R) => on(w) && priestsOf(w, R).some(a => (S(w).owe[a.agentId] || 0) >= 2);

    function track(w, C, F) {
        const rate = F.tax ? (1 - (FAITH.TAX_RATE || 0.15)) : 1;
        for (const R of F.rels) {
            const got = +R.got || 0; const last = C.got[R.id];
            if (last != null) { const h = C.inc[R.id] || (C.inc[R.id] = []); h.push(r2(Math.max(0, got - last) * rate)); if (h.length > SPAN) h.splice(0, h.length - SPAN); }
            C.got[R.id] = got;
        }
        for (const id of Object.keys(C.inc)) if (!F.rels.some(R => R.id === id)) { delete C.inc[id]; delete C.got[id]; }
    }
    // 當了神職卻沒有信仰的人，歸到最養得起他的教團
    function adopt(w, F) {
        for (const a of npcs(w)) {
            if (!isPriest(a) || relOf(w, a)) continue;
            const R = F.rels.slice().sort((x, y) => (cap(w, y) - priestsOf(w, y).length) - (cap(w, x) - priestsOf(w, x).length) || FAITH.believers(w, y).length - FAITH.believers(w, x).length)[0]; if (!R) continue;
            const f = F.of[a.agentId] || (F.of[a.agentId] = { rel: null, piety: 50 }); f.rel = R.id; f.piety = Math.max(f.piety || 0, 60);
        }
    }
    function pay(w, C, F) {
        const W = w.wallet; const tax = W.tax || 0; let jail = null; try { jail = typeof MONEY !== 'undefined' && MONEY.laborSet ? MONEY.laborSet(w) : null; } catch (e) {}
        for (const R of F.rels) for (const a of priestsOf(w, R)) {
            if (jail && jail.has(a.agentId)) continue; if (w.isAway?.(a.agentId)) continue;
            const full = wageOf(w, a); const g = r2(Math.min(full, Math.max(0, R.fund || 0)));
            if (g > 0) {
                R.fund = r2((R.fund || 0) - g); R.wages = r2((R.wages || 0) + g);
                const tx = r2(g * tax); WALLET.add(w, a, r2(g - tx)); if (tx > 0) w.stockpile?.add?.('silver', tx, w.tickCount, t('所得稅'));
                if (W.stats) { W.stats.wages = (W.stats.wages || 0) + g * (1 - tax); W.stats.taxes = (W.stats.taxes || 0) + g * tax; }
            }
            if (g >= full * 0.5) { C.owe[a.agentId] = 0; C.st.paid++; }
            else {
                C.owe[a.agentId] = (C.owe[a.agentId] || 0) + 1; C.st.short++; a.addThought?.('clergy_unpaid', w);
                if (C.owe[a.agentId] === 2 || Math.random() < 0.15) mem(w, a, g > 0 ? '{r}的奉獻不夠，今天的薪水只領到一點。' : '{r}的奉獻箱是空的，今天的薪水沒有著落。', { r: R.name[0] }, 5);
            }
        }
        for (const id of Object.keys(C.owe)) { const a = w.agents[id]; if (!a || a.isDead || !isPriest(a)) delete C.owe[id]; }
    }
    function leave(w, C, R, a, d) {
        a.job = null; delete C.owe[a.agentId]; C.st.out++;
        try { if (typeof LABOR !== 'undefined') LABOR.S(w).jobless[a.agentId] = d; } catch (e) {} // 就業市場下週會替他找別的工作
        mem(w, a, '{r}的奉獻養不起這麼多神職，我卸下神職，得另外找工作。信仰還是一樣的。', { r: R.name[0] }, 7);
        log(w, '⛪ {r}的奉獻養不起這麼多神職，{a}卸下神職，另外找工作。', { r: R.name[0], a: a.name }, a.name);
    }
    const isBoss = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    // 可以被按立的人：這個教團夠虔誠的成年信徒（首長、東家不算）
    const callPool = (w, R) => FAITH.believers(w, R).filter(a => !isPriest(a) && (a.age ?? 30) >= 18 && a.job?.key !== 'mayor' && !isBoss(w, a) && !(w.isAway?.(a.agentId)) && piety(w, a) >= CALL);
    const canQuit = (w, a) => piety(w, a) >= CALL_QUIT && !['guard', 'doctor', 'researcher'].includes(a.job?.key);
    // 當上神職的結算（照規則的舊路與本人自己答應共用）
    function take(w, C, R, a) {
        if (typeof Job === 'undefined' || typeof JOB_DEFINITIONS === 'undefined' || !JOB_DEFINITIONS.priest) return null;
        const was = a.job?.title || null; a.job = new Job('priest'); C.owe[a.agentId] = 0; C.st.in++;
        try { if (w.labor?.jobless) delete w.labor.jobless[a.agentId]; } catch (e) {}
        mem(w, a, was ? '{r}的奉獻養得起多一位神職，我放下原本的工作，去服事{r}。' : '{r}的奉獻養得起多一位神職，我去當神職了。', { r: R.name[0] }, 7);
        log(w, '⛪ {r}的奉獻夠養多一位神職，{a}成了神職。', { r: R.name[0], a: a.name }, a.name);
        return a;
    }
    // ch = 當不當神職交給本人決定（v11.13.0，每日流程帶進來；選擇點 ordain 登記在 sim-decide-work.js）；直接呼叫不帶 ch 照舊
    function ordain(w, C, R, d, ch) {
        const pool = callPool(w, R);
        if (ch) { // 以前沒工作的直接變神職、有工作的擲 50% 辭職；現在照同樣的順序去問本人：最虔誠、沒工作的先問，沒有才問有工作的。婉拒過的四週內不再問；一次檢討最多問兩位
            C.no = C.no || {}; C.ask = C.ask || {}; for (const id of Object.keys(C.no)) if (C.no[id] <= d) delete C.no[id];
            const pe = C.ask[R.id]; if (pe && d - pe.d < 2 && w.agents[pe.id] && !isPriest(w.agents[pe.id]) && !(C.no[pe.id] > d)) return null; // 上一位還在想
            const free = pool.filter(a => !(C.no[a.agentId] > d)); const order = free.filter(a => !a.job).sort((x, y) => piety(w, y) - piety(w, x)).concat(free.filter(a => a.job && canQuit(w, a)).sort((x, y) => piety(w, y) - piety(w, x)));
            for (const a of order.slice(0, 2)) { if (priestsOf(w, R).length >= cap(w, R)) break; C.ask[R.id] = { id: a.agentId, d }; let sent = false; try { sent = JOBS.ordainAsk(w, a, R, d); } catch (e) { console.warn('[Jobs] ordain', e); } if (!sent) { delete C.ask[R.id]; continue; } if (isPriest(a)) return a; if (!(C.no[a.agentId] > d)) return null; /* 還在想：等他回話 */ }
            return null;
        }
        const idle = pool.filter(a => !a.job).sort((x, y) => piety(w, y) - piety(w, x))[0];
        const called = idle ? null : pool.filter(a => canQuit(w, a)).sort((x, y) => piety(w, y) - piety(w, x))[0];
        const a = idle || (called && Math.random() < 0.5 ? called : null); if (!a) return null;
        return take(w, C, R, a);
    }
    function review(w, C, F, d, ch) {
        for (const R of F.rels) {
            if (!ready(w, R)) continue;
            const ps = priestsOf(w, R); const k = keep(w, R); const h = headId(w, R);
            // 欠最久的先走；一樣久的，虔誠度低的先走；掌教留到最後
            const out = ps.slice().sort((x, y) => ((x.agentId === h) - (y.agentId === h)) || ((C.owe[y.agentId] || 0) - (C.owe[x.agentId] || 0)) || (piety(w, x) - piety(w, y)))[0];
            if (ps.length > k && out) { leave(w, C, R, out, d); continue; }
            const late = ps.find(a => (C.owe[a.agentId] || 0) >= OWE_OUT && ps.length > 1); if (late) { leave(w, C, R, late, d); continue; }
            if (ps.length < cap(w, R)) ordain(w, C, R, d, ch);
        }
    }
    function daily(w) {
        if (!on(w)) return; const C = S(w), F = FAITH.S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        track(w, C, F); adopt(w, F); pay(w, C, F);
        if (d % 7 === 3) review(w, C, F, d, typeof JOBS !== 'undefined' && JOBS.on(w));
    }
    // 給信徒看的一句話（要不要奉獻時）
    function titheLine(w, R) {
        if (!on(w) || !R) return ''; const n = priestsOf(w, R).length;
        if (!n) return t('教團現在養不起神職，一位都沒有。');
        return short(w, R) ? t('教團這幾天發不出神職的薪水，再這樣下去神職得另外找工作。') : t('教團現在養 {n} 位神職。').replace('{n}', n);
    }
    // 給神職本人看的一句話
    function describe(w, a) {
        if (!paidBy(w, a)) return ''; const R = relOf(w, a); if (!R) return ''; const o = S(w).owe[a.agentId] || 0;
        return o >= 2 ? t('我的薪水是{r}從奉獻裡發的，已經 {n} 天領不到一半了').replace('{r}', t(R.name[0])).replace('{n}', o) : t('我的薪水是{r}從奉獻裡發的').replace('{r}', t(R.name[0]));
    }
    function rowOf(w, R) {
        if (!on(w)) return null; const ps = priestsOf(w, R);
        return { n: ps.length, cap: cap(w, R), keep: keep(w, R), ready: ready(w, R), income: r2(income(w, R)), wage: r2(ps.reduce((s, a) => s + wageOf(w, a), 0)), std: r2(std(w)), short: short(w, R), reach: reach(w, R), paid: Math.round(R.wages || 0) };
    }
    return { S, on, paidBy, isPriest, priestsOf, count, wageOf, std, income, budget, cap, keep, ready, reach, reserve, short, daily, review, pay, track, ordain, take, callPool, canQuit, relOf, piety, headId, CALL, CALL_QUIT, titheLine, describe, rowOf, SPAN, FUND_DAYS, OWE_OUT };
})();
if (typeof globalThis !== 'undefined') globalThis.CLERGY = CLERGY;
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, { clergy_unpaid: { mood: -5, opinion: 0, days: 3, label: t('教團發不出薪水') } });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { CLERGY.daily(w); } catch (e) { console.warn('[Clergy] daily', e); } return r; };
}
if (typeof FAITH !== 'undefined') {
    const _view = FAITH.view; FAITH.view = function (w) { const V = _view.call(this, w); try { const F = FAITH.S(w); for (const row of V) { const R = F.rels.find(x => x.id === row.id); const c = R && CLERGY.rowOf(w, R); if (c) row.clergy = c; } } catch (e) {} return V; };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.clergy = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.clergy) d.clergy = this.clergy; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.clergy = (data?.clergy && typeof data.clergy === 'object') ? data.clergy : null; } catch (e) {} return r; };
}
