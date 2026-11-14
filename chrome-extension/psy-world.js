// 擬人化智能體 D1：各事件 adapter 共用的世界資料（只有事實與價格，沒有心理判斷）
// 這個檔案「不」載入正式遊戲，只由測試腳本注入。所有讀取都經 PSY.reader，權限由讀取器自己判斷。
const PSY_WORLD = (() => {
    // 診所收費（引擎規則，見 sim-health.js treat：輕症看診 4＋藥 6＝10；重症開刀 60，最重 120）。
    const FEE_LIGHT = 10, FEE_HEAVY_MIN = 60, FEE_HEAVY_MAX = 120;
    // 看病付不出時先向家人收、家人自己至少留 10（引擎規則，見 sim-health.js pay：room = 身上 − 10）
    const FAMILY_KEEP = 10;
    const PART = { e: '眼睛', h: '手', f: '腳', c: '心臟', l: '肺' };
    const r2 = (x) => Math.round(x * 100) / 100;

    // 公開的健康消息（sim-health.js 寫進訊息紀錄的模板，逐字照抄）。
    // 這是「消息說了什麼」的對照，不是「聽到消息該有什麼反應」：who＝消息裡指名的人，part＝部位，fee＝消息裡寫明的金額，
    // charge＝依診所規則可能要付的錢（受傷不知道輕重，只能給整個價格範圍；開刀湊不出錢的消息有寫明金額）。
    const HEALTH_NEWS = {
        '👊 {a}跟{b}打起來了，{l}的{p}受了傷。': { who: 'l', part: 'p', charge: 'range' },
        '🩹 {a}工作時出了意外，{p}受傷了。': { who: 'a', part: 'p', charge: 'range' },
        '💸 {a}要開刀，但湊不出 {n} 銀幣，只能拖著。': { who: 'a', fee: 'n', charge: 'fee' },
        '🙏 {a}篤信神明，拒絕開刀，改去祈福。': { who: 'a' },
        '😞 {a}的{p}手術失敗，留下了後遺症。': { who: 'a', part: 'p' },
        '🏥 {a}的{p}手術算是成功，但沒辦法完全恢復。': { who: 'a', part: 'p' },
        '🏥 {d}幫{a}動了{p}手術，很成功。': { who: 'a', part: 'p' },
        '😞 {a}移植的{p}被身體排斥了。': { who: 'a', part: 'p' },
    };
    const render = (k, p) => String(k).replace(/\{(\w+)\}/g, (_, x) => (p && p[x] != null ? (typeof p[x] === 'object' ? (p[x].raw ?? '') : p[x]) : ''));
    // 本人經公開消息知道的、關於某人的健康消息（不讀健康表；消息之後有沒有好轉，本人不知道）
    function healthNews(R, name) {
        const out = []; const today = R.day();
        for (const m of R.publicMessages(['health'])) { const T = HEALTH_NEWS[m.k]; if (!T || m.p[T.who] !== name) continue; out.push({ text: render(m.k, m.p), d: m.d, days_ago: m.d == null ? null : today - m.d, charge: T.charge || null, fee: T.fee ? Number(m.p[T.fee]) : null }); }
        return out;
    }

    // 本人知道的支出與債務：自己欠人的錢、銀行貸款、自己的病；家人有公開的受傷／開刀消息時，依診所規則可能被收的錢。
    // 家人沒有任何消息時，明白寫「你沒有消息」，不從健康表補。
    function obligations(R) {
        const me = R.selfId; const out = []; let j = 0; const today = R.day();
        for (const L of R.ownLoans()) if (L.r === me && !L.done) { const who = R.publicOf(L.l); out.push({ id: 'k' + (++j), what: '欠' + (who ? who.name : '別人') + ' ' + L.n + ' 銀幣', amount: L.n, due_in_days: L.due - today, src: 'own_record' }); }
        const bank = R.ownBankLoan(); if (bank && bank.owed > 0) out.push({ id: 'k' + (++j), what: '欠銀行 ' + bank.owed + ' 銀幣', amount: bank.owed, due_in_days: null, src: 'own_record' });
        for (const x of R.ownAilments()) { const fee = x.s >= 3 ? FEE_HEAVY_MAX : x.s === 2 ? FEE_HEAVY_MIN : FEE_LIGHT; out.push({ id: 'k' + (++j), what: '你自己的' + (PART[x.p] || '身體') + '有毛病（嚴重度 ' + x.s + '），診所收 ' + fee + ' 銀幣', amount: fee, due_in_days: null, src: 'own_body' }); }
        const REL = { spouse: '配偶', parent: '父母', child: '孩子' };
        for (const k of R.kin()) {
            const news = healthNews(R, k.name).filter(n => n.charge);
            if (!news.length) { out.push({ id: 'k' + (++j), what: k.name + '（你的' + (REL[k.rel] || '家人') + '）最近身體怎樣，你沒有消息', status: 'unknown', who: k.id, src: 'no_record' }); continue; }
            for (const n of news) {
                const hi = n.charge === 'fee' && n.fee > 0 ? n.fee : FEE_HEAVY_MAX;
                out.push({ id: 'k' + (++j), what: '公開消息（' + (n.days_ago == null ? '日期不明' : n.days_ago + ' 天前') + '）：' + n.text + ' 依診所規則，' + k.name + '自己付不出時會先向家人收（家人自己至少留 ' + FAMILY_KEEP + ' 銀幣），所以你可能被收 0～' + hi + ' 銀幣；後來好了沒有，你不知道',
                    amount_min: 0, amount_max: hi, due_in_days: null, who: k.id, src: 'public_news', basis: 'messageLog@' + n.d });
            }
        }
        return out;
    }
    // 已知支出的合計：有範圍的分開算最低與最高（引擎只做加法，不判斷「應該準備多少」）；不知道的項目不算錢
    function totals(obl) { let lo = 0, hi = 0; for (const o of obl) { if (o.status === 'unknown') continue; lo += o.amount ?? o.amount_min ?? 0; hi += o.amount ?? o.amount_max ?? 0; } return { lo: r2(lo), hi: r2(hi) }; }
    const counted = (obl) => obl.filter(o => o.status !== 'unknown');

    // 對方是誰：親屬身分、是否同住、本人的感受、本人當事的借貸經歷、公開的工作、公開的健康消息
    function personViews(R, otherId, nm) {
        const v = []; const pub = R.publicOf(otherId);
        const feel = R.ownFeeling(otherId); if (feel) v.push({ id: 'v_feel', about: otherId, kind: 'own_feeling', what: '你對' + nm + '的好感 ' + feel.affinity + '、信任 ' + feel.trust + (feel.status ? '（' + feel.status + '）' : '') });
        const kin = R.kin().find(x => x.id === otherId); if (kin) v.push({ id: 'v_kin', about: otherId, kind: 'public', what: nm + '是你的' + ({ spouse: '配偶', parent: '父母', child: '孩子' }[kin.rel] || '家人') });
        if (R.cohabitants().includes(otherId)) v.push({ id: 'v_cohab', about: otherId, kind: 'public', what: '你和' + nm + '住同一棟房子' });
        if (pub?.job) v.push({ id: 'v_job', about: otherId, kind: 'public', what: nm + '的工作：' + pub.job });
        let h = 0; if (pub) for (const n of healthNews(R, pub.name)) v.push({ id: 'v_news' + (++h), about: otherId, kind: 'public', what: '公開消息（' + (n.days_ago == null ? '日期不明' : n.days_ago + ' 天前') + '）：' + n.text });
        let k = 0; for (const L of R.ownLoans()) {
            if (L.l === R.selfId && L.r === otherId) v.push({ id: 'v_loan' + (++k), about: otherId, kind: 'own_experience', what: '你在第 ' + L.day + ' 天借過' + nm + ' ' + L.n + ' 銀幣，' + (L.done ? '這筆紀錄已經結束' : '還沒還（第 ' + L.due + ' 天到期）') });
            if (L.r === R.selfId && L.l === otherId) v.push({ id: 'v_loan' + (++k), about: otherId, kind: 'own_experience', what: '你在第 ' + L.day + ' 天跟' + nm + '借過 ' + L.n + ' 銀幣，' + (L.done ? '這筆紀錄已經結束' : '你還沒還（第 ' + L.due + ' 天到期）') });
        }
        return v;
    }
    return { FEE_LIGHT, FEE_HEAVY_MIN, FEE_HEAVY_MAX, FAMILY_KEEP, PART, HEALTH_NEWS, r2, render, healthNews, obligations, totals, counted, personViews };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PSY_WORLD; else if (typeof globalThis !== 'undefined') globalThis.PSY_WORLD = PSY_WORLD;
