// RimTown - sim-exile.js(v9.9.4 驅逐與搬走的財產處理)
// 以前被驅逐或搬走的人只帶走現金:產業股份白白分給別人、房子掛著不在的屋主(家人反而要付房租給公庫)。現在:
// - 被驅逐(判決或神裔驅逐)限期 7 天收拾:每天照順序找買家 → 家人直接接手 → 股東／合夥人 8 折 → 夥計集資 8 折 → 鎮上有錢人出價(交情好的照原價、貪心的壓到 6 折)
//   → 最後一天公庫 5 折收購整家產業或房子(付得起才買)→ 都沒人要就停業,血本無歸
// - 自己搬走的人當下就照同樣順序處理(不給寬限)
// - 離開前先還銀行:現金、存款、變賣的錢先還債;不夠就由銀行收走他名下的房子;再不夠就成了銀行的呆帳(家人不揹債)
// - 犯罪被逐出:還完債剩下的錢沒收五成進公庫;非本人過錯的驅逐(神裔副作用)不沒收
// - 人走了產業就不再是他的(不做「不在地主」):離開前一定處理完
// 金流守恆:買方付給賣方、公庫付給賣方、沒收進公庫,錢只在錢包、公庫、銀行之間移動;最後剩下的現金由錢包模組記成「搬走的人帶走」
'use strict';
const EXILE = (() => {
    const GRACE = 7, CONFISCATE = 0.5;
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const present = (w, id) => !!id && !!w.agents?.[id] && !w.agents[id].isDead;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const r2 = (n) => Math.round(n * 100) / 100;
    const W = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const cash = (w, a) => (W() && w.wallet ? W().get(w, a) : 0);
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 7) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', r2(n), w.tickCount, why); };
    const treasury = (w) => w.stockpile?.get?.('silver') || 0;
    function S(w) { if (!w.exile || typeof w.exile !== 'object') w.exile = { pending: {}, hist: [], st: { ordered: 0, left: 0, family: 0, partner: 0, staff: 0, buyer: 0, town: 0, lost: 0, confiscated: 0, bad: 0 } }; const X = w.exile; X.pending = X.pending || {}; X.hist = X.hist || []; X.st = X.st || {}; return X; }
    const pendingOf = (w, id) => w.exile?.pending?.[id] || null;
    const free = (w, a) => a && !a.isDead && !a.isPlayer && !pendingOf(w, a.agentId) && (a.age ?? 30) >= 16;
    // 家人:配偶優先,其次成年子女(沿用遺產繼承的順序)
    const family = (w, a) => { try { return (MARKET.heirsOf(w, a) || []).filter(o => free(w, o)); } catch (e) { return []; } };

    // ---------- 他名下有什麼 ----------
    function assetsOf(w, a) {
        const id = a.agentId, out = [];
        try { if (typeof SHARES !== 'undefined' && w.market) for (const [k, pct] of SHARES.holdings(w, id)) out.push({ t: 'sector', k, pct, boss: w.market.owners[k] === id, name: MARKET.name(k) }); } catch (e) {}
        try { for (const [k, R] of Object.entries(w.market?.rival || {})) { if (!R) continue; const pct = R.owner === id ? (R.sh?.[id] ?? 100) : (R.sh?.[id] || 0); if (pct > 0) out.push({ t: 'rival', k, pct, boss: R.owner === id, name: MARKET.name(k) }); } } catch (e) {}
        try { if (typeof BIZ !== 'undefined' && w.biz) for (const s of BIZ.S(w).shops) if (!s.closed && (s.owner === id || s.partner === id)) out.push({ t: 'shop', s, boss: s.owner === id, name: s.name[0] }); } catch (e) {}
        try { if (typeof ESTATE !== 'undefined' && w.estate) for (const u of ESTATE.ownsOf(w, id)) out.push({ t: 'house', u, boss: true, name: '房子' }); } catch (e) {}
        return out;
    }
    const valueOf = (w, A) => {
        try {
            if (A.t === 'sector' || A.t === 'rival') return Math.max(5, Math.round(SHARES.priceOf(w, A.k, A.pct) * (A.t === 'rival' ? 0.8 : 1)));
            if (A.t === 'shop') return Math.round((A.boss ? 60 : 40) * (A.s.profit > 0 ? 1.2 : 0.8));
            if (A.t === 'house') return Math.round(ESTATE.valueOf(w, A.u));
        } catch (e) {}
        return 30;
    };
    const label = (A) => A.t === 'house' ? '房子' : A.t === 'shop' ? A.name : (A.pct >= 99 ? A.name : { k: '{s}的 {p}% 股份', p: { s: A.name, p: Math.round(A.pct) } });
    const stillOwns = (w, a, A) => assetsOf(w, a).some(B => B.t === A.t && (A.t === 'shop' ? B.s === A.s : A.t === 'house' ? B.u === A.u : B.k === A.k));

    // ---------- 過戶(付錢另外處理) ----------
    function move(w, A, from, to, pct) {
        const id = from.agentId, M = w.market;
        if (A.t === 'sector') {
            const s = SHARES.stakes(w, A.k); const p = Math.min(pct ?? A.pct, s[id] || 0); if (!(p > 0)) return false;
            s[id] -= p; s[to.agentId] = (s[to.agentId] || 0) + p; M.shares[A.k] = SHARES.norm(s);
            if (M.owners[A.k] === id || !(M.owners[A.k] in M.shares[A.k])) { const top = Object.keys(M.shares[A.k]).filter(x => x !== id && present(w, x)).sort((x, y) => M.shares[A.k][y] - M.shares[A.k][x])[0]; if (top) M.owners[A.k] = top; }
            return true;
        }
        if (A.t === 'rival') {
            const R = M.rival?.[A.k]; if (!R) return false; const s = R.sh ? Object.assign({}, R.sh) : { [R.owner]: 100 };
            const p = Math.min(pct ?? A.pct, s[id] || 0); if (!(p > 0)) return false; s[id] -= p; if (s[id] <= 0.0001) delete s[id]; s[to.agentId] = (s[to.agentId] || 0) + p;
            if (R.owner === id) R.owner = Object.keys(s).sort((x, y) => s[y] - s[x])[0];
            R.sh = SHARES.norm(s); if (Object.keys(R.sh).length < 2) delete R.sh; return true;
        }
        if (A.t === 'shop') { const s = A.s; if (s.owner === id) { s.owner = to.agentId; if (s.partner === to.agentId) s.partner = null; } else if (s.partner === id) s.partner = s.owner === to.agentId ? null : to.agentId; return true; }
        if (A.t === 'house') { A.u.owner = to.agentId; return true; }
        return false;
    }
    // 沒人要:停業、股份作廢(其他股東照比例分)、房子空著歸公有
    function drop(w, A, a) {
        const id = a.agentId, M = w.market;
        if (A.t === 'sector') { const s = SHARES.stakes(w, A.k); delete s[id]; if (!Object.keys(s).length) { delete M.shares[A.k]; M.owners[A.k] = null; } else { M.shares[A.k] = SHARES.norm(s); if (M.owners[A.k] === id) M.owners[A.k] = Object.keys(M.shares[A.k]).sort((x, y) => M.shares[A.k][y] - M.shares[A.k][x])[0]; } }
        else if (A.t === 'rival') { const R = M.rival?.[A.k]; if (R) { if (R.owner === id) { try { INVEST.rivalClosed?.(w, A.k, R); } catch (e) {} delete M.rival[A.k]; } else if (R.sh) { delete R.sh[id]; R.sh = SHARES.norm(R.sh); if (Object.keys(R.sh).length < 2) delete R.sh; } } }
        else if (A.t === 'shop') { if (A.s.owner === id) { try { BIZ.close(w, A.s, 'exile'); } catch (e) { A.s.closed = true; } } else A.s.partner = null; }
        else if (A.t === 'house') A.u.owner = null;
    }
    const pay = (w, buyer, seller, n) => { n = r2(n); if (!(n > 0)) return true; if (!W().take(w, buyer, n)) return false; W().add(w, seller, n); return true; };

    // ---------- 照順序找買家 ----------
    // 回傳 { who, how, price } 或 null;final=最後一天(公庫才出手、有錢人一定會看)
    function sellOne(w, a, A, final) {
        const v = valueOf(w, A), X = S(w), id = a.agentId, M = w.market;
        // 1. 家人直接接手
        const fam = family(w, a).filter(o => !(A.t === 'shop' && A.boss && BIZ.shopOf(w, o)) && !(A.t === 'rival' && A.boss && M.owners[A.k] === o.agentId));
        const owe = (w.bank?.loans?.[id]?.owed || 0) - cash(w, a) - (w.bank?.dep?.[id] || 0); // 欠銀行的錢還不夠還:先變賣抵債,不能直接送給家人
        if (fam.length && owe <= 0 && move(w, A, a, fam[0])) { X.st.family++; return { who: fam[0], how: 'family', price: 0 }; }
        // 2. 股東、合夥人 8 折
        let co = [];
        if (A.t === 'sector') co = Object.keys(SHARES.stakes(w, A.k)).filter(x => x !== id).map(x => w.agents[x]);
        else if (A.t === 'rival') co = Object.keys(M.rival?.[A.k]?.sh || {}).filter(x => x !== id).map(x => w.agents[x]);
        else if (A.t === 'shop') co = [w.agents[A.s.owner === id ? A.s.partner : A.s.owner]];
        co = co.filter(o => free(w, o)).sort((x, y) => cash(w, y) - cash(w, x));
        const p8 = Math.round(v * 0.8);
        for (const o of co) if (cash(w, o) >= p8 && pay(w, o, a, p8)) { move(w, A, a, o); X.st.partner++; return { who: o, how: 'partner', price: p8 }; }
        // 3. 夥計集資 8 折(產業、對面那家):每人最多出一半的錢,至少兩個人
        if (A.t === 'sector' || A.t === 'rival') {
            let ws = []; try { ws = MARKET.workersOf(w, A.k, npcs(w)).filter(o => o !== a && free(w, o) && (A.t !== 'rival' || M.rival?.[A.k]?.emp?.[o.agentId])); } catch (e) {}
            if (A.t === 'sector') ws = ws.filter(o => !(M.rival?.[A.k]?.emp || {})[o.agentId]);
            const put = ws.map(o => [o, Math.floor(cash(w, o) * 0.5)]).filter(([, n]) => n >= 3);
            const tot = put.reduce((s, [, n]) => s + n, 0);
            if (put.length >= 2 && tot >= p8) {
                let left = p8; const paid = []; const L = put.sort((x, y) => x[1] - y[1]); // 大家平均分攤,出不起的人出多少算多少,其他人補上
                for (let i = 0; i < L.length && left > 0.01; i++) { const [o, n] = L[i]; const c = r2(Math.min(n, left / (L.length - i))); if (c > 0 && pay(w, o, a, c)) { paid.push([o, c]); left = r2(left - c); } }
                if (left <= 0.01) { for (const [o, c] of paid) move(w, A, a, o, A.pct * c / p8); X.st.staff++; return { who: paid[0][0], how: 'staff', price: p8, n: paid.length }; }
                for (const [o, c] of paid) pay(w, a, o, c); // 湊不齊就退錢
            }
        }
        // 4. 鎮上有錢人出價:交情好的照原價,貪心的趁火打劫壓到 6 折,其他人 8 折;最後一天一定有人來看,平常一半的機會
        if (final || Math.random() < 0.5) {
            const offers = npcs(w).filter(o => o !== a && free(w, o) && (owe > 0 || !fam.includes(o)) && !(A.t === 'shop' && A.boss && BIZ.shopOf(w, o)) && !(A.t === 'rival' && A.boss && M.owners[A.k] === o.agentId))
                .map(o => { const f = has(o, 'greedy') ? 0.6 : (aff(o, a) >= 40 && !has(o, 'greedy')) ? 1 : 0.8; return [o, Math.round(v * f), f]; })
                .filter(([o, n]) => cash(w, o) >= n * 1.2 + 10).sort((x, y) => y[1] - x[1]);
            const best = offers[0];
            if (best && pay(w, best[0], a, best[1])) { move(w, A, a, best[0]); X.st.buyer++; return { who: best[0], how: best[2] >= 1 ? 'friend' : best[2] < 0.7 ? 'vulture' : 'buyer', price: best[1] }; }
        }
        if (!final) return null;
        if (A.t === 'house' && (w.bank?.loans?.[id]?.owed || 0) > cash(w, a)) return null; // 還欠銀行錢:房子留給銀行收走(見 settle)
        // 5. 公庫 5 折收購:整家產業(他是唯一股東)或房子,公庫付得起才買
        const whole = A.t === 'house' || (A.t === 'sector' && A.pct >= 99);
        const p5 = Math.round(v * 0.5);
        if (whole && treasury(w) >= p5 + 20 && w.stockpile.consume('silver', p5, w.tickCount, t('公庫收購被驅逐者的產業'), 'event')) {
            W().add(w, a, p5);
            if (A.t === 'sector') { delete M.shares?.[A.k]; M.owners[A.k] = null; } else A.u.owner = null; // 變成公營產業／公有房舍
            X.st.town++; return { who: null, how: 'town', price: p5 };
        }
        // 6. 沒人要
        drop(w, A, a); X.st.lost++; return { who: null, how: 'lost', price: 0 };
    }
    const HOW = {
        family: '🏠 {a}把{x}留給了{b}。',
        partner: '🤝 {b}照八折買下{a}的{x}（{n} 銀幣）。',
        staff: '👷 {b}等 {m} 個夥計湊錢，照八折買下{a}的{x}（{n} 銀幣）。',
        friend: '🫱 {b}仗義相挺，照原價買下{a}的{x}（{n} 銀幣）。',
        vulture: '🦅 {b}趁火打劫，只出六折就買走{a}的{x}（{n} 銀幣）。',
        buyer: '💰 {b}出價 {n} 銀幣，買下{a}的{x}。',
        town: '🏛️ 沒人接手，公庫照五折收購{a}的{x}（{n} 銀幣）。',
        lost: '🕳️ {a}的{x}沒人要，只能放著不管，什麼都拿不回來。',
    };
    function sellAll(w, a, final) {
        const P = pendingOf(w, a.agentId); let n = 0;
        for (const A of assetsOf(w, a)) {
            if (!stillOwns(w, a, A)) continue; const x = label(A); const r = sellOne(w, a, A, final); if (!r) continue; n++;
            log(w, HOW[r.how], { a: a.name, b: r.who?.name || '', x, n: r.price, m: r.n || 0 }, a.name);
            if (r.who) mem(w, r.who, r.how === 'family' ? '{a}要走了，把{x}留給我。' : '我買下了{a}的{x}。', { a: a.name, x }, 7);
            if (P) (P.sold = P.sold || []).push([A.t, r.how, r.price]);
        }
        return n;
    }

    // ---------- 離開前結清:存款、銀行貸款、沒收 ----------
    function settle(w, a) {
        const id = a.agentId, B = w.bank, X = S(w);
        if (B && B.dep && B.dep[id] > 0) { const out = Math.min(B.dep[id], Math.max(0, Math.floor(B.reserve || 0))); B.reserve = r2((B.reserve || 0) - out); delete B.dep[id]; if (out > 0) W().add(w, a, out); }
        const L = B?.loans?.[id];
        if (L && L.owed > 0) {
            const payN = r2(Math.min(L.owed, cash(w, a))); if (payN > 0 && W().take(w, a, payN)) { L.owed = r2(L.owed - payN); B.reserve = r2((B.reserve || 0) + payN); }
            if (L.owed > 0.01) {
                // 還不夠:還在他名下的房子由銀行收走(沿用房屋抵押收回)
                let took = false; try { const u = typeof ESTATE !== 'undefined' && w.estate ? ESTATE.ownsOf(w, id)[0] : null; if (u) { L.collateral = u.id; took = ESTATE.foreclose(w, id, L); } } catch (e) {}
                if (!took) { B.bad = r2((B.bad || 0) + L.owed); X.st.bad = r2((X.st.bad || 0) + L.owed); log(w, '🏦 {a}還欠銀行 {n} 銀幣就被趕走了，成了銀行的呆帳。', { a: a.name, n: Math.round(L.owed) }, a.name); }
            }
            delete B.loans[id];
        }
    }
    function confiscate(w, a) {
        const X = S(w); { const c = r2(cash(w, a) * CONFISCATE); if (c > 0 && W().take(w, a, c)) { toTown(w, c, t('沒收犯罪者財產')); X.st.confiscated = r2((X.st.confiscated || 0) + c); log(w, '⚖️ {a}犯罪被逐出，剩下的財產沒收五成（{n} 銀幣）進公庫。', { a: a.name, n: Math.round(c) }, a.name); } }
    }

    // ---------- 驅逐令:限期 7 天 ----------
    function order(w, a, o = {}) {
        if (!a || a.isDead || a.isPlayer) return false; const X = S(w); if (X.pending[a.agentId]) return true;
        if (!w.observerMode || !W() || !w.wallet) { w.leaveTown?.(a.agentId, o.reason || ''); return true; } // 沒有經濟系統就照舊直接走
        X.pending[a.agentId] = { d0: day(w), until: day(w) + GRACE, crime: !!o.crime, reason: o.reason || '' }; X.st.ordered++;
        const has0 = assetsOf(w, a).length;
        log(w, has0 ? '⏳ {a}被判逐出小鎮，限期 {n} 天收拾家當、變賣產業。' : '⏳ {a}被判逐出小鎮，限期 {n} 天收拾行李。', { a: a.name, n: GRACE }, a.name);
        mem(w, a, '我被逐出小鎮，只剩 {n} 天收拾。', { n: GRACE }, 9); a.moodModifier = (a.moodModifier || 0) - 15;
        return true;
    }
    function daily(w) {
        const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        for (const [id, P] of Object.entries(X.pending)) {
            const a = w.agents[id]; if (!a || a.isDead) { delete X.pending[id]; continue; }
            const final = d >= P.until;
            try { sellAll(w, a, final); } catch (e) { console.warn('[Exile] sell', e); }
            if (final) { try { w.leaveTown(id, P.reason); } catch (e) { console.warn('[Exile] leave', e); } delete X.pending[id]; }
        }
    }
    // 離開小鎮(驅逐期滿,或自己搬走):先把剩下的東西處理完、還債、沒收,再讓錢包模組記成帶走的錢
    // 配偶、交往對象離開了小鎮:跟過世一樣,關係改成「前任」,才能再婚(以前一直掛著已婚)
    function unpair(w, id) {
        const a = w.agents?.[id]; if (!a) return;
        for (const o of Object.values(w.agents)) { if (o === a) continue; const rel = o.relationships?.relationships?.[id]; if (rel && (rel.status === 'married' || rel.status === 'dating')) { const was = rel.status; rel.status = 'ex'; rel.statusSince = w.tickCount; if (!o.isPlayer && was === 'married') mem(w, o, '{a}離開了小鎮，我們的婚姻就這樣結束了。', { a: a.name }, 8); } }
    }
    function beforeLeave(w, id) {
        try { unpair(w, id); } catch (e) {}
        const a = w.agents?.[id]; if (!a || a.isPlayer || !w.observerMode || !W() || !w.wallet) return;
        const X = S(w); const P = X.pending[id];
        try { sellAll(w, a, true); } catch (e) { console.warn('[Exile] final sell', e); }
        try { settle(w, a); } catch (e) { console.warn('[Exile] settle', e); }
        try { sellAll(w, a, true); } catch (e) {} // 債還清了、房子沒被收走:照順序處理掉
        try { if (P?.crime) confiscate(w, a); } catch (e) {} // 犯罪:還完債剩下的沒收五成
        if (P) { X.st.left++; X.hist.unshift({ name: a.name, d: day(w), crime: !!P.crime, sold: (P.sold || []).length, carried: Math.round(cash(w, a)) }); X.hist = X.hist.slice(0, 8); delete X.pending[id]; }
    }
    function view(w) { const X = w.exile; if (!X) return null; return { pending: Object.entries(X.pending).filter(([id]) => w.agents[id]).map(([id, P]) => ({ name: t(w.agents[id].name), left: Math.max(0, P.until - day(w)), crime: P.crime, n: assetsOf(w, w.agents[id]).length })), hist: X.hist.map(h => ({ ...h, name: t(h.name) })), st: X.st }; }
    function brief(w, a) { const P = pendingOf(w, a.agentId); if (!P) return ''; return t('你被逐出小鎮，{n} 天內要離開，正在變賣家當').replace('{n}', Math.max(0, P.until - day(w))); }
    return { S, GRACE, CONFISCATE, order, daily, beforeLeave, assetsOf, valueOf, sellOne, settle, confiscate, pendingOf, view, brief };
})();
// ---------- 接上其他系統 ----------
if (typeof World !== 'undefined' && World.prototype.leaveTown) {
    const _lt = World.prototype.leaveTown;
    World.prototype.leaveTown = function (agentId, ...rest) { try { EXILE.beforeLeave(this, agentId); } catch (e) { console.warn('[Exile] leave', e); } return _lt.call(this, agentId, ...rest); };
    const _ro = World.prototype.relocateOut;
    if (_ro) World.prototype.relocateOut = function (agentId, ...rest) { try { EXILE.beforeLeave(this, agentId); } catch (e) {} return _ro.call(this, agentId, ...rest); };
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.exile = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.exile) d.exile = this.exile; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.exile = (data?.exile && typeof data.exile === 'object') ? data.exile : null; } catch (e) {} return r; };
}
// v9.9.4 過世:小店交給合夥人或家人(以前店跟著老闆一起關掉,合夥人出的本錢也沒了);收藏的珍品交給家人
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let heir = null, shops = [], goods = null;
        try { if (npc && !npc.isPlayer) { heir = (typeof MARKET !== 'undefined' ? MARKET.heirsOf(world, npc) : [])[0] || null; shops = (typeof BIZ !== 'undefined' && world.biz) ? BIZ.S(world).shops.filter(s => !s.closed && (s.owner === npc.agentId || s.partner === npc.agentId)) : []; goods = world.goods?.owned?.[npc.agentId] || null; } } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        if (!npc || (world.agents?.[npc.agentId] && !npc.isDead)) return r; // 冥王之血復活了(過世的人會從小鎮移除)
        try {
            for (const s of shops) {
                if (s.partner === npc.agentId) { s.partner = null; continue; }
                const p = s.partner && world.agents[s.partner] && !world.agents[s.partner].isDead ? world.agents[s.partner] : null;
                const to = p || (heir && world.agents[heir.agentId] && !BIZ.shopOf(world, heir) ? heir : null); if (!to) continue;
                s.owner = to.agentId; s.partner = null; world.logMessageT?.('economy', '🏪 {o}走了，「{n}」由{h}接手。', { o: npc.name, n: s.name[0], h: to.name }, to.name);
                to.memory?.addT?.(world.tickCount, world.clock?.timeStr || '', 'economy', '我接手了{o}留下的店「{n}」。', { o: npc.name, n: s.name[0] }, 7, [npc.name]);
            }
            // v9.9.5 出遠門的配偶:改成前任、記得這件事(回來才不會還跟過世的人結婚)
            for (const tr of (world.events?._travellingAgents || [])) { const d = tr?.agentData; if (!d) continue; const rel = (d.relationships || []).find(x => (x.target_id || x.targetId) === npc.agentId); if (!rel) continue;
                const was = rel.status; if (was === 'married' || was === 'dating') { rel.status = 'ex'; rel.statusSince = world.tickCount; }
                if (was === 'married' || (d._parentNames || []).includes(npc.name)) { const k = was === 'married' ? '我出遠門的時候，{a}走了，連最後一面都沒見到。' : '我出遠門的時候，{a}過世了。'; (d.memories = d.memories || []).push({ tick: world.tickCount, time: world.clock?.timeStr || '', category: 'death', content: Memory.render(k, { a: npc.name }), importance: 9, related_agents: [npc.name], k, p: { a: npc.name } }); } }
            if (goods && goods.length && heir && world.agents[heir.agentId] && world.goods?.owned) { const G = world.goods.owned; G[heir.agentId] = (G[heir.agentId] || []).concat(goods); delete G[npc.agentId]; }
        } catch (e) { console.warn('[Exile] death', e); }
        return r;
    };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { EXILE.daily(w); } catch (e) { console.warn('[Exile] daily', e); } } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = EXILE.brief(world, a); if (s) b.mem = [s, ...(b.mem || [])]; } catch (e) {} return b; };
}
if (typeof globalThis !== 'undefined') globalThis.EXILE = EXILE;
