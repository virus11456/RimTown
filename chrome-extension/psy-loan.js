// 擬人化智能體 D1：「有人來借錢」的世界資料 adapter（只描述世界，不決定心理）
// 這個檔案「不」載入正式遊戲，只由測試腳本注入；需要先載入 psy-world.js。
//
// adapter 負責：這件事是什麼（誰、借多少、說多久還）、可行動作的參數範圍、確定的算術。
// 本人的支出、對方是誰（親屬、同住、感受、借貸經歷）用 PSY_WORLD 的共用世界資料。
// adapter 不負責：借錢會不會增進感情、拒絕會不會丟面子、誰該在乎什麼、誰該選什麼。
const PSY_LOAN = (() => {
    const W = typeof PSY_WORLD !== 'undefined' ? PSY_WORLD : (typeof require === 'function' ? require('./psy-world.js') : null);
    const TERM_DAYS = 7; // 引擎規則：朋友借款一週後到期（sim-wallet.js lendTo 的 due = today + 7）
    const r2 = (x) => Math.round(x * 100) / 100;

    function eventOf(w, a, ctx) {
        if (!ctx || !ctx.from || !a) return null;
        const d = typeof w._absDay === 'function' ? w._absDay() : 0;
        const id = 'ev_loan_' + a.agentId + '_' + ctx.from + '_' + d + '_' + ctx.n;
        return { id, decision: 'dc_' + id, agent: a.agentId, from: ctx.from, n: ctx.n, said: ctx.said || null, world: w.townName || null };
    }

    function build(R, ev) {
        const asker = R.publicOf(ev.from); const nm = asker ? asker.name : '（不認識的人）';
        const cash = R.selfCash();
        const seen = [{ id: 'o_req', text: nm + '來跟你借 ' + ev.n + ' 銀幣，說 ' + TERM_DAYS + ' 天後還。', src: 'heard_direct:' + ev.from }];
        if (ev.said) seen.push({ id: 'o_said', text: nm + '說：「' + ev.said + '」', src: 'heard_direct:' + ev.from });
        const views = W.personViews(R, ev.from, nm);
        views.push({ id: 'v_promise', about: ev.from, kind: 'promise', what: nm + '說 ' + TERM_DAYS + ' 天後還（是他說的，還沒發生）' });
        views.push({ id: 'v_cash_unknown', about: ev.from, kind: 'unknown', what: nm + '現在手上有多少錢' });
        views.push({ id: 'v_intent_unknown', about: ev.from, kind: 'unknown', what: nm + '會不會照說的時間還' });
        const obligations = W.obligations(R);

        // 可行動作：只依本人現金判斷能不能做（不留「保底」之類的預設判斷）
        const options = []; const c = cash == null ? 0 : Math.floor(cash);
        if (c >= 1) options.push({ opt: 'lend', label: '借錢給' + nm, params: { amount: { type: 'int', min: 1, max: c, requested: Math.min(ev.n, c) } }, cost: { cash: '-amount' }, gets: { promise: '+amount（' + nm + '說 ' + TERM_DAYS + ' 天後還，未必兌現）' }, engine_now: 'engine_lends_its_own_fixed_amount' });
        if (c >= 1) options.push({ opt: 'gift', label: '直接給錢，不用還', params: { amount: { type: 'int', min: 1, max: c } }, cost: { cash: '-amount' }, engine_now: 'engine_gives_15_only' });
        options.push({ opt: 'refuse', label: '不借', params: { explain: { type: 'text' } }, cost: {}, engine_now: 'supported' });

        // 確定的算術（引擎事實；有範圍的支出只說「夠／不夠／看實際收費」，不判斷該準備多少）
        const derived = []; const T = W.totals(obligations);
        if (cash != null) {
            if (cash >= ev.n) derived.push({ id: 'd_after_req', what: '照他說的借出 ' + ev.n + ' 後，身上剩 ' + r2(cash - ev.n) + ' 銀幣', value: r2(cash - ev.n), from: ['s_cash', 'o_req'] });
            else derived.push({ id: 'd_short_req', what: '身上 ' + cash + ' 銀幣，不夠借出 ' + ev.n, value: r2(cash - ev.n), from: ['s_cash', 'o_req'] });
            const C = W.counted(obligations); // 「沒有消息」的項目不算錢
            if (C.length) {
                const tot = T.lo === T.hi ? String(T.lo) : T.lo + '～' + T.hi;
                derived.push({ id: 'd_known_total', what: '已知的支出與欠款合計 ' + tot + ' 銀幣', value: T.lo, value_max: T.hi, from: C.map(o => o.id) });
                const cmp = (x) => (x >= T.hi ? '夠' : x < T.lo ? '不夠' : '夠不夠要看實際收費，') + '支付已知的 ' + tot;
                if (cash >= ev.n) { const left = r2(cash - ev.n); derived.push({ id: 'd_after_req_vs_known', what: '借出 ' + ev.n + ' 後剩 ' + left + '，' + cmp(left), value: r2(left - T.lo), from: ['d_after_req', 'd_known_total'] }); }
                derived.push({ id: 'd_now_vs_known', what: '不借的話身上 ' + cash + '，' + cmp(cash), value: r2(cash - T.lo), from: ['s_cash', 'd_known_total'] });
            }
        }
        return { label: 'request_money', seen, views, obligations, options, derived, focus: { text: seen.map(s => s.text).join(' ') + ' 借錢 還錢 銀幣', names: asker ? [asker.name] : [] } };
    }
    // 事件內容從哪裡來（給稽核用；單元測試用代理物件核對 eventOf 實際只讀這些）
    const EVENT_SOURCES = { from: 'ctx.from：開口的人（本人看得到是誰來借）', n: 'ctx.n：對方開口說的金額', said: 'ctx.said：對方說的話（可省略）', day: 'w._absDay()：日曆', world: 'w.townName：鎮名' };
    return { observes: 'asked', label: 'request_money', TERM_DAYS, EVENT_SOURCES, eventOf, build };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PSY_LOAN; else if (typeof globalThis !== 'undefined') globalThis.PSY_LOAN = PSY_LOAN;
