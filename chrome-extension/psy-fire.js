// 擬人化智能體 D1：第二個情境「店面失火，老闆來求助」的世界資料 adapter（只描述世界，不決定心理）
// 這個檔案「不」載入正式遊戲，只由測試腳本注入；需要先載入 psy-world.js。
//
// 遊戲裡沒有「求助」這個選擇點：店面失火時老闆自己吸收損失（sim-market.js risk）。
// 所以這裡的事件是研究用的假設情境：失火是真實發生、公開看得到的事；「老闆跑來找誰幫忙、說了什麼」由測試設定，不是遊戲行為。
// 本 adapter 沒有任何「失火就該同情」「鄰居就該幫」之類的心理內容；共用核心沒有為它新增分支。
const PSY_FIRE = (() => {
    const W = typeof PSY_WORLD !== 'undefined' ? PSY_WORLD : (typeof require === 'function' ? require('./psy-world.js') : null);
    const FIRE_KEY = '🔥 {o}的{s}失火，損失 {n} 銀幣。'; // sim-market.js RISKS[0]

    // 從公開的訊息紀錄找出真實發生過的失火（只讀，不改紀錄）
    function firesInLog(w) {
        const out = [];
        for (const m of w.messageLog || []) if (m && m.k === FIRE_KEY && m.p) { const owner = Object.values(w.agents || {}).find(a => a && !a.isDead && a.name === m.p.o); if (owner) out.push({ owner: owner.agentId, shop: m.p.s, loss: m.p.n, tick: m.tick ?? null }); }
        return out;
    }
    // 研究情境：fire = { owner, shop, loss }；helper 是被找上的人；said 是老闆說的話（可省略）
    function eventOf(w, helperId, fire, said) {
        const d = typeof w._absDay === 'function' ? w._absDay() : 0;
        const id = 'ev_fire_' + helperId + '_' + fire.owner + '_' + d + '_' + fire.loss;
        return { id, decision: 'dc_' + id, agent: helperId, from: fire.owner, shop: fire.shop, loss: fire.loss, said: said || null, world: w.townName || null, constructed: true };
    }

    function build(R, ev) {
        const owner = R.publicOf(ev.from); const nm = owner ? owner.name : '（不認識的人）';
        const cash = R.selfCash();
        const seen = [
            { id: 'o_fire', text: nm + '的' + ev.shop + '失火了。', src: 'public_event' },
            { id: 'o_req', text: nm + '來找你，說這次損失了 ' + ev.loss + ' 銀幣，問你能不能幫忙。', src: 'heard_direct:' + ev.from },
        ];
        if (ev.said) seen.push({ id: 'o_said', text: nm + '說：「' + ev.said + '」', src: 'heard_direct:' + ev.from });
        const views = W.personViews(R, ev.from, nm);
        views.push({ id: 'v_loss_said', about: ev.from, kind: 'said', what: nm + '說損失 ' + ev.loss + ' 銀幣（是他說的數字）' });
        views.push({ id: 'v_savings_unknown', about: ev.from, kind: 'unknown', what: nm + '還有多少積蓄' });
        views.push({ id: 'v_others_unknown', about: ev.from, kind: 'unknown', what: '還有沒有別人在幫' + nm });
        const obligations = W.obligations(R);

        const options = []; const c = cash == null ? 0 : Math.floor(cash);
        if (c >= 1) options.push({ opt: 'give', label: '拿錢給' + nm + '，不用還', params: { amount: { type: 'int', min: 1, max: c } }, cost: { cash: '-amount' }, engine_now: 'not_supported' });
        if (c >= 1) options.push({ opt: 'lend', label: '借錢給' + nm, params: { amount: { type: 'int', min: 1, max: c }, term_days: { type: 'int', min: 1, max: 30 } }, cost: { cash: '-amount' }, gets: { promise: '+amount（要看' + nm + '會不會還）' }, engine_now: 'not_supported' });
        options.push({ opt: 'labor', label: '去幫忙收拾、修繕', params: { days: { type: 'int', min: 1, max: 3 } }, cost: { time: 'days（這幾天不能做自己的工作）' }, engine_now: 'not_supported' });
        options.push({ opt: 'refuse', label: '這次幫不上', params: { explain: { type: 'text' } }, cost: {}, engine_now: 'not_supported' });

        const derived = []; const T = W.totals(obligations);
        const C = W.counted(obligations);
        if (cash != null && C.length) {
            const tot = T.lo === T.hi ? String(T.lo) : T.lo + '～' + T.hi;
            derived.push({ id: 'd_known_total', what: '已知的支出與欠款合計 ' + tot + ' 銀幣', value: T.lo, value_max: T.hi, from: C.map(o => o.id) });
            derived.push({ id: 'd_now_vs_known', what: '身上 ' + cash + '，' + (cash >= T.hi ? '夠' : cash < T.lo ? '不夠' : '夠不夠要看實際收費，') + '支付已知的 ' + tot, value: W.r2(cash - T.lo), from: ['s_cash', 'd_known_total'] });
        }
        return { label: 'help_after_fire', seen, views, obligations, options, derived, focus: { text: seen.map(s => s.text).join(' ') + ' 失火 幫忙', names: owner ? [owner.name] : [] } };
    }
    return { observes: null, label: 'help_after_fire', FIRE_KEY, firesInLog, eventOf, build };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PSY_FIRE; else if (typeof globalThis !== 'undefined') globalThis.PSY_FIRE = PSY_FIRE;
