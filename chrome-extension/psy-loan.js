// 擬人化智能體 D1：「有人來借錢」的世界資料 adapter（只描述世界，不決定心理）
// 這個檔案「不」載入正式遊戲，只由測試腳本注入。
//
// adapter 負責：這件事是什麼（誰、借多少、說多久還）、本人知道的成本與債務、可行動作的參數範圍、確定的算術。
// adapter 不負責：借錢會不會增進感情、拒絕會不會丟面子、誰該在乎什麼、誰該選什麼。
// 所有世界資料都經 PSY.reader 讀取：讀別人的錢包、別人的帳本會直接丟錯。
const PSY_LOAN = (() => {
    const TERM_DAYS = 7; // 引擎規則：朋友借款一週後到期（sim-wallet.js lendTo 的 due = today + 7）
    // 診所收費（引擎規則，見 sim-health.js treat：輕症看診 4＋藥 6；重症開刀 60，最重 120）
    const FEE = (s) => (s >= 3 ? 120 : s === 2 ? 60 : 10);
    const PART = { e: '眼睛', h: '手', f: '腳', c: '心臟', l: '肺' };
    const r2 = (x) => Math.round(x * 100) / 100;

    function eventOf(w, a, ctx) {
        if (!ctx || !ctx.from || !a) return null;
        const d = typeof w._absDay === 'function' ? w._absDay() : 0;
        const id = 'ev_loan_' + a.agentId + '_' + ctx.from + '_' + d + '_' + ctx.n;
        return { id, decision: 'dc_' + id, agent: a.agentId, from: ctx.from, n: ctx.n, said: ctx.said || null, world: w.townName || null };
    }

    function build(R, ev) {
        const me = R.selfId; const asker = R.publicOf(ev.from); const nm = asker ? asker.name : '（不認識的人）';
        const cash = R.selfCash(); const hh = R.household(); const today = R.day();
        const seen = [{ id: 'o_req', text: nm + '來跟你借 ' + ev.n + ' 銀幣，說 ' + TERM_DAYS + ' 天後還。', src: 'heard_direct:' + ev.from }];
        if (ev.said) seen.push({ id: 'o_said', text: nm + '說：「' + ev.said + '」', src: 'heard_direct:' + ev.from });

        const views = [];
        const feel = R.ownFeeling(ev.from);
        if (feel) views.push({ id: 'v_feel', about: ev.from, kind: 'own_feeling', what: '你對' + nm + '的好感 ' + feel.affinity + '、信任 ' + feel.trust + (feel.status ? '（' + feel.status + '）' : '') });
        views.push({ id: 'v_promise', about: ev.from, kind: 'promise', what: nm + '說 ' + TERM_DAYS + ' 天後還（是他說的，還沒發生）' });
        views.push({ id: 'v_cash_unknown', about: ev.from, kind: 'unknown', what: nm + '現在手上有多少錢' });
        views.push({ id: 'v_intent_unknown', about: ev.from, kind: 'unknown', what: nm + '會不會照說的時間還' });
        if (asker?.job) views.push({ id: 'v_job', about: ev.from, kind: 'public', what: nm + '的工作：' + asker.job });
        // 對方若是同戶家人，身分關係是公開的事實（不是心理判斷：要不要因為是家人就借，由評估決定）
        const kin = hh.find(x => x.id === ev.from); if (kin) views.push({ id: 'v_kin', about: ev.from, kind: 'public', what: nm + '是你的' + ({ spouse: '配偶', parent: '父母', child: '孩子' }[kin.rel] || '家人') });

        const loans = R.ownLoans(); let k = 0;
        for (const L of loans) {
            if (L.l === me && L.r === ev.from) views.push({ id: 'v_loan' + (++k), about: ev.from, kind: 'own_experience', what: '你在第 ' + L.day + ' 天借過' + nm + ' ' + L.n + ' 銀幣，' + (L.done ? '這筆紀錄已經結束' : '還沒還（第 ' + L.due + ' 天到期）') });
            if (L.r === me && L.l === ev.from) views.push({ id: 'v_loan' + (++k), about: ev.from, kind: 'own_experience', what: '你在第 ' + L.day + ' 天跟' + nm + '借過 ' + L.n + ' 銀幣，' + (L.done ? '這筆紀錄已經結束' : '你還沒還（第 ' + L.due + ' 天到期）') });
        }

        // 本人知道的支出與債務
        const obligations = []; let j = 0;
        for (const L of loans) if (L.r === me && !L.done) { const who = R.publicOf(L.l); obligations.push({ id: 'k' + (++j), what: '欠' + (who ? who.name : '別人') + ' ' + L.n + ' 銀幣', amount: L.n, due_in_days: L.due - today, src: 'own_record' }); }
        const bank = R.ownBankLoan(); if (bank && bank.owed > 0) obligations.push({ id: 'k' + (++j), what: '欠銀行 ' + bank.owed + ' 銀幣', amount: bank.owed, due_in_days: null, src: 'own_record' });
        for (const who of [{ id: me, name: '你自己', rel: 'self' }].concat(hh)) {
            for (const x of R.ailmentsOf(who.id, hh)) obligations.push({ id: 'k' + (++j), what: (who.rel === 'self' ? '你自己' : who.name) + '的' + (PART[x.p] || '身體') + '有毛病（嚴重度 ' + x.s + '），診所收 ' + FEE(x.s) + ' 銀幣', amount: FEE(x.s), due_in_days: null, who: who.id, src: who.rel === 'self' ? 'own_body' : 'household' });
        }

        // 可行動作：只依本人現金判斷能不能做（不留「保底」之類的預設判斷）
        const options = []; const c = cash == null ? 0 : Math.floor(cash);
        if (c >= 1) options.push({ opt: 'lend', label: '借錢給' + nm, params: { amount: { type: 'int', min: 1, max: c, requested: Math.min(ev.n, c) } }, cost: { cash: '-amount' }, gets: { promise: '+amount（' + nm + '說 ' + TERM_DAYS + ' 天後還，未必兌現）' }, engine_now: 'engine_lends_its_own_fixed_amount' });
        if (c >= 1) options.push({ opt: 'gift', label: '直接給錢，不用還', params: { amount: { type: 'int', min: 1, max: c } }, cost: { cash: '-amount' }, engine_now: 'engine_gives_15_only' });
        options.push({ opt: 'refuse', label: '不借', params: { explain: { type: 'text' } }, cost: {}, engine_now: 'supported' });

        // 確定的算術（引擎事實，不含任何「夠不夠用」以外的判斷）
        const derived = []; const known = obligations.reduce((s, o) => s + (o.amount || 0), 0);
        if (cash != null) {
            if (cash >= ev.n) derived.push({ id: 'd_after_req', what: '照他說的借出 ' + ev.n + ' 後，身上剩 ' + r2(cash - ev.n) + ' 銀幣', value: r2(cash - ev.n), from: ['s_cash', 'o_req'] });
            else derived.push({ id: 'd_short_req', what: '身上 ' + cash + ' 銀幣，不夠借出 ' + ev.n, value: r2(cash - ev.n), from: ['s_cash', 'o_req'] });
            if (obligations.length) {
                derived.push({ id: 'd_known_total', what: '已知的支出與欠款合計 ' + r2(known) + ' 銀幣', value: r2(known), from: obligations.map(o => o.id) });
                if (cash >= ev.n) { const left = r2(cash - ev.n); derived.push({ id: 'd_after_req_vs_known', what: '借出 ' + ev.n + ' 後剩 ' + left + '，' + (left >= known ? '仍夠' : '不夠') + '支付已知的 ' + r2(known), value: r2(left - known), from: ['d_after_req', 'd_known_total'] }); }
                derived.push({ id: 'd_now_vs_known', what: '不借的話身上 ' + cash + '，' + (cash >= known ? '夠' : '不夠') + '支付已知的 ' + r2(known), value: r2(cash - known), from: ['s_cash', 'd_known_total'] });
            }
        }
        return { label: 'request_money', seen, views, obligations, options, derived, focus: { text: seen.map(s => s.text).join(' ') + ' 借錢 還錢 銀幣', names: asker ? [asker.name] : [] } };
    }
    return { observes: 'asked', label: 'request_money', TERM_DAYS, FEE, eventOf, build };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PSY_LOAN; else if (typeof globalThis !== 'undefined') globalThis.PSY_LOAN = PSY_LOAN;
