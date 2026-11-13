// RimTown - sim-spend.js(v8.9.0 錢的去處)
// 鎮上長年賣貨到外地,錢只進不出,越存越多。這個檔案加三件事,讓錢有去處、也讓錢多了會「變薄」:
//  INFL  通貨膨脹:大家手上的錢越多,東西越貴(物價水準);工資會跟著漲,但比物價慢,存錢的人吃虧、欠錢的人賺。
//        工資落後太多時,工人會提「工資跟上物價」,老闆和有錢人多半反對。
//  SPEND 更多花錢的地方:本地的看戲說書、宴客、請畫師畫像(錢留在鎮上流轉);
//        外地的旅遊、送孩子去外地讀書(錢真的流出鎮外;讀過書的孩子長大後工資高一成五)。
//  WORKS 公共建設承包:公庫錢多時撥款修路修橋蓋水渠,村民競標,得標的人賺差價;
//        貪心的承包商會偷工減料,工程日後可能出事,被抓到要賠錢、名聲掃地,一陣子標不到工程。
// 每一筆錢都從某人手上到另一人手上;流出鎮外的記到 MONEY 的「外地旅遊」「外地學費」,全鎮銀幣守恆。
'use strict';
const INFL = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp, []); } catch (e) {} };
    const news = (w, s, imp, nm) => { try { w.dailyNews?.collectEvent?.('economy', s, imp || 6, nm || []); } catch (e) {} };
    const r2 = (n) => Math.round(n * 100) / 100;
    const LO = 0.8, HI = 3; const BANDS = [1.2, 1.5, 2, 2.5];
    function S(w) {
        if (!w.infl || typeof w.infl !== 'object') w.infl = { p: 1, wage: 1, base: null, lastDay: null, band: 0, hist: [], lastRaise: -99, st: { raises: 0 } };
        const I = w.infl; I.hist = I.hist || []; I.st = I.st || { raises: 0 }; return I;
    }
    const p = (w) => (w?.infl?.p || 1);
    const wage = (w) => (w?.infl?.wage || 1);
    // 大家手上的錢(錢包＋一半的銀行存款:存著的錢花得比較少)平均每人多少
    function perCap(w) {
        const A = adults(w); if (!A.length) return 0; const B = w.wallet?.bal || {}; let s = 0; for (const a of A) s += Math.max(0, +B[a.agentId] || 0);
        const dep = w.bank?.dep ? Object.values(w.bank.dep).reduce((x, v) => x + (+v || 0), 0) : 0; return (s + dep * 0.5) / A.length;
    }
    function sync(w) { try { if (typeof WALLET !== 'undefined' && WALLET.setWageIdx) WALLET.setWageIdx(wage(w)); } catch (e) {} }
    function daily(w) {
        const I = S(w), d = day(w); if (I.lastDay === d) return; I.lastDay = d;
        const per = perCap(w);
        if (I.base == null) { if (d < 12 || !(per > 0)) { sync(w); return; } I.base = Math.max(30, Math.round(per)); } // 開局頭幾天的平均存款當作基準
        const target = Math.max(LO, Math.min(HI, Math.pow(Math.max(1, per) / I.base, 0.35)));
        const gap = target - I.p; let dv = gap * 0.012; if (Math.abs(dv) < 0.001 && Math.abs(gap) > 0.001) dv = Math.sign(gap) * 0.001; I.p = Math.round(Math.max(LO, Math.min(HI, I.p + dv)) * 1000) / 1000;
        // 工資慢慢跟上(比物價慢很多;物價跌的時候工資也很難降)
        const wg = I.p - I.wage; I.wage = Math.round(Math.max(0.8, I.wage + (wg > 0 ? wg * 0.003 : wg * 0.001)) * 1000) / 1000;
        if (d % 15 === 0) { I.hist.push([d, I.p, I.wage]); if (I.hist.length > 24) I.hist.shift(); }
        // 跨過門檻才報
        const band = BANDS.filter(b => I.p >= b).length;
        if (band > I.band) {
            const meal = r2(3 * I.p); log(w, '📈 東西越來越貴了：物價漲到原本的 {x} 倍，一頓飯要 {m} 銀幣。存了一輩子錢的人心裡發慌。', { x: I.p.toFixed(2), m: meal });
            news(w, `${t('物價漲到原本的')} ${I.p.toFixed(1)} ${t('倍')}`, 6 + band);
            for (const a of adults(w)) { const dep = w.bank?.dep?.[a.agentId] || 0; if (dep > 100) { a.moodModifier = (a.moodModifier || 0) - 3; if (Math.random() < 0.5) mem(w, a, '存在銀行的錢越來越不值錢了，以前一頓飯三個銀幣，現在要 {m}。', { m: meal }, 6); } else if (w.bank?.loans?.[a.agentId] && Math.random() < 0.5) mem(w, a, '東西漲價了，欠銀行的錢倒是一樣多，相對變少了。', {}, 4); }
        } else if (band < I.band && I.p < (BANDS[band] || 1.2) - 0.05) log(w, '📉 物價回落了一些，現在是原本的 {x} 倍。', { x: I.p.toFixed(2) });
        I.band = band;
        try { raisePropose(w, I, d); } catch (e) {}
        sync(w);
    }
    // 工資跟上物價:落後一成二以上,工人提案;通過後工資一次補上八成的差距
    function raisePropose(w, I, d) {
        const T = typeof TECH !== 'undefined' ? TECH : null; if (!T || !T.propose || T.busy?.(w, 'infl_raise')) return;
        if (I.p / I.wage < 1.12 || d - (I.lastRaise ?? -99) < 25) return;
        const all = adults(w); const B = w.wallet?.bal || {};
        const who = all.filter(a => typeof WALLET !== 'undefined' && WALLET.WAGE[a.job?.key] && !owner(w, a)).sort((x, y) => (B[x.agentId] || 0) - (B[y.agentId] || 0) + (w.union?.members?.[y.agentId] ? 50 : 0) - (w.union?.members?.[x.agentId] ? 50 : 0))[0];
        if (!who) return; I.lastRaise = d;
        T.propose(w, 'infl_raise', 'infl', who, '工資跟上物價', '{who}說東西已經漲到原本的 {p} 倍，工資卻只有 {g} 倍，做一天的工買不起以前的東西：提議公庫和老闆把工資調高，補上落後的差距。', { p: I.p.toFixed(2), g: I.wage.toFixed(2) }, 'economy', {}, {});
    }
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    function vote(w, p0, a) {
        const B = w.wallet?.bal || {}; const bal = B[a.agentId] || 0; const worker = typeof WALLET !== 'undefined' && !!WALLET.WAGE[a.job?.key] && !owner(w, a);
        let s = (worker ? 1.4 : 0) + (bal < 40 ? 0.8 : 0) + (w.union?.members?.[a.agentId] ? 1 : 0) - (owner(w, a) ? 1.8 : 0) - (bal > 300 ? 0.8 : 0) - (has(a, 'greedy') && !worker ? 0.6 : 0) + (Math.random() - 0.5);
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (worker ? 'infl_worker' : 'infl_fair') : (owner(w, a) ? 'infl_boss' : 'infl_spiral') };
    }
    function enact(w, p0) {
        const I = S(w); const before = I.wage; I.wage = Math.round((I.wage + (I.p - I.wage) * 0.8) * 1000) / 1000; I.st.raises++;
        if (w.wallet && (w.wallet.minWage || 0) > 0 && typeof WALLET !== 'undefined') w.wallet.minWage = Math.max(w.wallet.minWage, r2(WALLET.FLOOR * I.p)); // 最低工資也跟著調
        sync(w); log(w, '💼 工資調高了：從原本的 {a} 倍調到 {b} 倍，總算跟得上物價。老闆們一邊算帳一邊嘆氣。', { a: before.toFixed(2), b: I.wage.toFixed(2) });
        return `${t('工資')} ${before.toFixed(2)}× → ${I.wage.toFixed(2)}×`;
    }
    function view(w) { const I = S(w); return { p: I.p, wage: I.wage, meal: r2(3 * I.p), base: I.base, raises: I.st.raises || 0, hist: I.hist.slice(-8) }; }
    function brief(w) { const I = w.infl; if (!I || I.p < 1.15) return ''; return `${t('最近東西越來越貴：物價是原本的')} ${I.p.toFixed(1)} ${t('倍')}${t('，')}${t('工資只有')} ${I.wage.toFixed(1)} ${t('倍')}${t('。')}`; }
    return { S, p, wage, perCap, daily, vote, enact, view, brief, sync, BANDS };
})();

const SPEND = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    const r2 = (n) => Math.round(n * 100) / 100;
    const P = (w) => INFL.p(w);
    const out = (w, cat, n) => { try { if (typeof MONEY !== 'undefined') MONEY.flow(w, cat, -n); } catch (e) {} }; // 流出鎮外的錢記帳
    function S(w) {
        if (!w.spend || typeof w.spend !== 'object') w.spend = { lastDay: null, school: {}, edu: {}, st: { show: 0, showN: 0, feast: 0, feastN: 0, art: 0, artN: 0, trip: 0, tripN: 0, fee: 0, feeN: 0 } };
        const X = w.spend; X.school = X.school || {}; X.edu = X.edu || {}; X.st = X.st || {}; return X;
    }
    const thrift = (a) => (has(a, 'ascetic') || has(a, 'stoic') ? 0.4 : 1) * (has(a, 'greedy') ? 0.6 : 1) * (has(a, 'glutton') || has(a, 'optimist') || has(a, 'romantic') || has(a, 'generous') ? 1.4 : 1); // 克己的人少花、貪心的人捨不得、愛享受的人多花
    const townName = (w) => { const L = (w.otherTowns || []).map(x => x?.name || x?.townName).filter(Boolean); return L.length ? t(L[Math.floor(Math.random() * L.length)]) : t('王都'); };
    // ---------- v9.19.0 花錢的動作(由決策核心呼叫) ----------
    // 每個動作分兩半:xxxPlan(w, a) 只回答「現在做得到嗎、要花多少、跟誰」(不動任何東西);xxx(w, a) 真的結算。
    // 誰會去做、什麼時候做,不在這裡決定。
    function feastPlan(w, a) {
        const c = cash(w, a), px = P(w); if (c < 150 * px) return null;
        const guests = here(w).filter(o => o !== a && aff(a, o) >= 20).sort((x, y) => aff(a, y) - aff(a, x)).slice(0, 5); if (guests.length < 2) return null;
        return { cost: r2(Math.min(c * 0.08, 25 * px + c * 0.03)), guests };
    }
    function feast(w, a) {
        const pl = feastPlan(w, a); if (!pl || !WALLET.take(w, a, pl.cost)) return null; const X = S(w), { cost, guests } = pl;
        if (typeof MARKET !== 'undefined' && w.market) { MARKET.sell(w, 'kitchen', r2(cost * 0.6), t('宴客')); MARKET.sell(w, 'farm', r2(cost - r2(cost * 0.6)), t('宴客')); } else w.stockpile?.add?.('silver', cost, w.tickCount, t('宴客'));
        for (const g of guests) { bump(g, a, 4); bump(a, g, 2); g.moodModifier = (g.moodModifier || 0) + 2; }
        X.st.feast = r2((X.st.feast || 0) + cost); X.st.feastN = (X.st.feastN || 0) + 1;
        log(w, '🍷 {a}花了 {n} 銀幣在食堂擺了一桌，請{g}吃飯。', { a: a.name, n: Math.round(cost), g: guests.slice(0, 3).map(x => x.name).join(t('、')) }, a.name);
        mem(w, a, '我請朋友吃了一頓好的，花了 {n} 銀幣。', { n: Math.round(cost) }, 4);
        return pl;
    }
    function artPlan(w, a) {
        const c = cash(w, a), px = P(w), X = S(w); if (c < 250 * px || X.edu['art_' + a.agentId] > day(w) - 120) return null;
        const painter = here(w).filter(o => o !== a && has(o, 'creative'))[0]; if (!painter) return null;
        return { cost: r2(25 * px + c * 0.02), painter };
    }
    function art(w, a) {
        const pl = artPlan(w, a); if (!pl || !WALLET.take(w, a, pl.cost)) return null; const X = S(w), { cost: fee, painter: pt } = pl;
        if (WALLET.bizIncome) WALLET.bizIncome(w, pt, fee); else WALLET.add(w, pt, fee); X.edu['art_' + a.agentId] = day(w); X.st.art = r2((X.st.art || 0) + fee); X.st.artN = (X.st.artN || 0) + 1;
        log(w, '🖼️ {a}花 {n} 銀幣請{p}畫了一張像，掛在家裡最顯眼的地方。', { a: a.name, n: Math.round(fee), p: pt.name }, a.name); mem(w, a, '我請{p}畫了一張像，以後子孫看得到我。', { p: pt.name }, 6); mem(w, pt, '{a}請我畫像，給了 {n} 銀幣。', { a: a.name, n: Math.round(fee) }, 5);
        return pl;
    }
    function tripPlan(w, a) {
        const c = cash(w, a), px = P(w); if (c < 100 * px || a.job?.key === 'mayor') return null; // 首長走不開
        return { cost: r2(Math.min(c * 0.2, 40 * px + c * 0.08)) };
    }
    function trip(w, a) {
        const pl = tripPlan(w, a); if (!pl || !WALLET.take(w, a, pl.cost)) return null; const X = S(w), cost = pl.cost; out(w, 'travel', cost);
        const where = townName(w); a.moodModifier = (a.moodModifier || 0) + 6; X.st.trip = r2((X.st.trip || 0) + cost); X.st.tripN = (X.st.tripN || 0) + 1;
        log(w, '🧳 {a}去{t}玩了幾天，花了 {n} 銀幣，回來逢人就說那裡的見聞。', { a: a.name, t: where, n: Math.round(cost) }, a.name);
        mem(w, a, '我去{t}玩了一趟，花了 {n} 銀幣，大開眼界。', { t: where, n: Math.round(cost) }, 6);
        { const sore = here(w).filter(o => o !== a && aff(o, a) > 30 && cash(w, o) < 30)[0]; if (sore) mem(w, sore, '{a}又去外地玩了，我連一頓好的都吃不起。', { a: a.name }, 4); } // 手頭緊的熟人看在眼裡
        pl.where = where; return pl;
    }
    // 這個人可以替哪些孩子出學費:家裡 8～15 歲、還沒去讀書的孩子,而且他是那個家裡手頭最寬的大人(一個孩子只有一個人拿主意)
    function enrolPlan(w, a) {
        const px = P(w), X = S(w); if ((a.age ?? 30) < 18 || cash(w, a) < 100 * px) return null; const fam = (o) => (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, o) : []);
        const kids = npcs(w).filter(k => { const age = k.age ?? 30; if (k === a || age < 8 || age >= 16 || X.school[k.agentId] != null) return false; const ad = fam(k).filter(o => o !== k && (o.age ?? 30) >= 18 && !o.isDead); return ad.includes(a) && ad.every(o => cash(w, o) <= cash(w, a)); });
        return kids.length ? { cost: r2(40 * px), again: r2(30 * px), kids } : null;
    }
    function enrol(w, a, kidId) {
        const pl = enrolPlan(w, a); const k = pl && (pl.kids.find(x => x.agentId === kidId) || pl.kids[0]); if (!k || !WALLET.take(w, a, pl.cost)) return null; const X = S(w), d = day(w), fee = pl.cost; out(w, 'school', fee);
        X.school[k.agentId] = d; X.paid = X.paid || {}; X.paid[k.agentId] = d; X.st.fee = r2((X.st.fee || 0) + fee); X.st.feeN = (X.st.feeN || 0) + 1;
        log(w, '🎓 {a}花 {n} 銀幣送{k}去{t}讀書。', { a: a.name, n: Math.round(fee), k: k.name, t: townName(w) }, a.name); mem(w, a, '我把錢省下來送{k}去外地讀書，希望他將來有出息。', { k: k.name }, 7); mem(w, k, '我要去外地讀書了。', {}, 7);
        return { cost: fee, kid: k };
    }
    const byFun = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.fun && !!DECIDE.on?.(w); } catch (e) { return false; } };
    const tips = (w, a, pf) => { const h = WALLET.habitOf ? WALLET.habitOf(w, a) : 'normal'; return h === 'indulge' || (h === 'normal' && aff(a, pf) >= 20); }; // 想買就買的人都給；普通的人給認識的人；省的人不給
    function daily(w) {
        if (!W() || !w.wallet) return; const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        const all = here(w); if (!all.length) return; const px = P(w);
        // 1) 看戲、聽說書:有才藝的人在廣場表演,看的人丟賞錢(錢給表演的人)
        const perf = all.filter(a => (has(a, 'creative') || has(a, 'charismatic')) && cash(w, a) < 300);
        if (perf.length && Math.random() < 0.5) {
            const pf = perf[Math.floor(Math.random() * perf.length)]; const fee = r2(1.5 * px); let n = 0, got = 0;
            const fun = byFun(w); // v9.25.0 交給本人:給不給賞錢看他自己的花錢習慣(想買就買的人都給、普通的人只給熟人、省的人不給)，不擲骰
            for (const a of all) { if (a === pf || cash(w, a) < 20 * px || (fun ? !tips(w, a, pf) : Math.random() > 0.14 * thrift(a))) continue; if (WALLET.take(w, a, fee)) { got += fee; n++; a.moodModifier = (a.moodModifier || 0) + 1; } }
            if (got > 0) { if (WALLET.bizIncome) WALLET.bizIncome(w, pf, got); else WALLET.add(w, pf, got); X.st.show = r2((X.st.show || 0) + got); X.st.showN = (X.st.showN || 0) + 1;
                if (n >= 3 && Math.random() < 0.35) log(w, '🎭 {p}在廣場{x}，{n} 個人圍著看，丟了 {s} 銀幣賞錢。', { p: pf.name, x: has(pf, 'creative') ? t('說書唱曲') : t('變戲法'), n, s: Math.round(got) }, pf.name);
                if (n >= 4 && Math.random() < 0.3) mem(w, pf, '今天在廣場表演，{n} 個人丟賞錢給我。', { n }, 5); }
        }
        // v9.19.0 宴客、畫像、旅遊、送孩子讀書不再在這裡擲骰:由決策核心(sim-decide.js)在村民「手上有閒錢」時自己挑,結算用下面的 feast／art／trip／enrol
        // 讀書期間每 30 天繳一次學費;家裡繳不出來就只好輟學回家
        X.paid = X.paid || {}; for (const k of npcs(w)) { const id = k.agentId; if (X.school[id] == null || X.edu[id] || X.drop?.[id] || (k.age ?? 0) >= 16 || d - (X.paid[id] ?? X.school[id]) < 30) continue;
            const fam = (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, k) : []).filter(o => o !== k && (o.age ?? 30) >= 18 && !o.isDead); const payer = fam.sort((x, y) => cash(w, y) - cash(w, x))[0]; const fee = r2(30 * px);
            if (payer && WALLET.take(w, payer, fee)) { out(w, 'school', fee); X.paid[id] = d; X.st.fee = r2((X.st.fee || 0) + fee); }
            else { (X.drop = X.drop || {})[id] = d; mem(w, k, '家裡繳不出學費，我只好從外地回來，書念不完了。', {}, 7); if (payer) mem(w, payer, '繳不出{k}的學費，只好叫他回來。', { k: k.name }, 7); log(w, '📚 {k}家裡繳不出學費，只好從外地輟學回來。', { k: k.name }, k.name); } }
        for (const k of npcs(w)) { if (X.school[k.agentId] != null && !X.drop?.[k.agentId] && (k.age ?? 0) >= 16 && !X.edu[k.agentId]) { X.edu[k.agentId] = d; mem(w, k, '我在外地讀過書，回來找工作比別人吃香。', {}, 6); if (Math.random() < 0.5) log(w, '🎓 {k}讀完書回來了，見識和別人不一樣。', { k: k.name }, k.name); } k._edu = !!X.edu[k.agentId]; }
        for (const id of Object.keys(X.school)) if (!w.agents[id] && !w.isAway?.(id)) { delete X.school[id]; delete X.edu[id]; if (X.paid) delete X.paid[id]; if (X.drop) delete X.drop[id]; }
    }
    function view(w) { const X = S(w); return { ...X.st, edu: Object.keys(X.edu).filter(k => !k.startsWith('art_')).length, studying: Object.keys(X.school).filter(id => !X.edu[id] && !X.drop?.[id]).length, drop: Object.keys(X.drop || {}).length }; }
    function brief(w, a) { const X = w.spend; if (!X) return ''; if (X.edu?.[a.agentId]) return t('你小時候家裡送你去外地讀過書，工資比別人高一些。'); if (X.school?.[a.agentId] != null) return t('家裡花錢送你去外地讀書。'); return ''; }
    return { S, daily, view, brief, feastPlan, feast, artPlan, art, tripPlan, trip, enrolPlan, enrol, thrift, byFun, tips };
})();

const WORKS = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'work', k, p || {}, imp, []); } catch (e) {} };
    const news = (w, s, imp, nm) => { try { w.dailyNews?.collectEvent?.('economy', s, imp || 7, nm || []); } catch (e) {} };
    const r2 = (n) => Math.round(n * 100) / 100;
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const TRADES = ['builder', 'carpenter', 'miner', 'blacksmith'];
    // 依撥款大小挑工程
    const KINDS = [[20, '🛣️', '修路'], [60, '🌉', '修橋'], [100, '💧', '蓋水渠'], [150, '⛲', '整修廣場'], [220, '🏫', '蓋學堂'], [320, '🏯', '築城牆']];
    function S(w) { const C = w.cycle || (w.cycle = {}); if (!C.wk || typeof C.wk !== 'object') C.wk = { list: [], ban: {}, st: { n: 0, bad: 0, fell: 0, caught: 0, margin: 0 } }; return C.wk; }
    const mayor = (w) => npcs(w).find(a => a.job?.key === 'mayor') || null;
    // 公庫撥 n 銀幣蓋一件公共建設:村民競標,得標的人拿差價,剩下的付給工人和木作坊、礦場、鐵匠
    function tender(w, n, parts, tot, all, C) {
        if (typeof WALLET === 'undefined' || !w.wallet || n < 20) return false; const K = S(w), d = day(w);
        const kind = KINDS.filter(k => n >= k[0]).pop() || KINDS[0];
        const bidders = all.filter(a => (a.age ?? 30) >= 20 && (TRADES.includes(a.job?.key) || (() => { try { return MARKET.ownedBy(w, a.agentId).some(s => ['timber', 'mine', 'forge'].includes(s)); } catch (e) { return false; } })()) && !(K.ban[a.agentId] > d) && !w.isAway?.(a.agentId));
        if (!bidders.length) return false;
        const m0 = mayor(w);
        const bids = bidders.map(a => { const greedy = has(a, 'greedy') || a.dark?.liar; const m = (greedy ? 0.22 : 0.12) + Math.random() * 0.08; return { a, m, greedy, score: m - (m0 && aff(m0, a) >= 40 && has(m0, 'greedy') ? 0.15 : 0) - (has(a, 'hardworking') ? 0.02 : 0) }; }).sort((x, y) => x.score - y.score);
        const win = bids[0]; const crony = m0 && aff(m0, win.a) >= 40 && has(m0, 'greedy') && bids.length > 1 && bids[1].m < win.m;
        if (!w.stockpile.consume('silver', n, w.tickCount, t('公共工程'))) return false;
        const margin = r2(n * win.m); const skim = win.greedy && Math.random() < 0.5 ? r2(n * 0.12) : 0; const rest = r2(n - margin - skim);
        WALLET.add(w, win.a, r2(margin + skim));
        // 工錢(三成五)給其他工匠,材料錢給木作坊、礦場、鐵匠
        const crew = all.filter(a => a !== win.a && TRADES.includes(a.job?.key)).sort(() => Math.random() - 0.5).slice(0, 4); const labor = crew.length ? r2(rest * 0.35) : 0;
        let paid = 0; crew.forEach((a, i) => { const v = i === crew.length - 1 ? r2(labor - paid) : r2(labor / crew.length); paid = r2(paid + v); if (v > 0) WALLET.add(w, a, v); });
        const mat = r2(rest - labor); let left = mat; const ps = parts.filter(([, f]) => f > 0); ps.forEach(([k, f], i) => { const v = i === ps.length - 1 ? left : r2(mat * f / tot); left = r2(left - v); if (v > 0) MARKET.sell(w, k, v, t('公共工程款')); });
        const q = skim > 0 ? 'poor' : 'good'; const id = 'W' + (++K.st.n);
        K.list.push({ id, icon: kind[1], name: kind[2], by: win.a.agentId, byName: win.a.name, n, margin, skim, q, d, crony: !!crony, fell: false }); if (K.list.length > 12) K.list.shift();
        K.st.margin = r2((K.st.margin || 0) + margin + skim); if (q === 'poor') K.st.bad = (K.st.bad || 0) + 1;
        C.works = Math.round((C.works || 0) + n); C.worksN = (C.worksN || 0) + 1; for (const a of all) a.moodModifier = (a.moodModifier || 0) + 0.5;
        log(w, '{i} 鎮公所撥了 {n} 銀幣{k}，{a}以 {m}% 的利潤標下了工程{x}。', { i: kind[1], n, k: t(kind[2]), a: win.a.name, m: Math.round(win.m * 100), x: crony ? t('（聽說跟鎮長很熟）') : '' }, win.a.name);
        mem(w, win.a, skim ? '我標下了{k}的工程，材料偷偷省了一些，多賺了 {n} 銀幣。' : '我標下了{k}的工程，賺了 {n} 銀幣。', { k: t(kind[2]), n: Math.round(margin + skim) }, 6);
        for (const c of crew) if (Math.random() < 0.4) mem(w, c, '我在{a}包的{k}工地做工，領到了工錢。', { a: win.a.name, k: t(kind[2]) }, 3);
        if (crony) for (const b of bids.slice(1, 3)) { b.a.relationships?.getOrCreate?.(m0.agentId, m0.name)?.modifyAffinity?.(-6); mem(w, b.a, '{k}的工程我出價比較低，最後卻給了跟鎮長熟的{a}。', { k: t(kind[2]), a: win.a.name }, 6); }
        return true;
    }
    // 偷工減料的工程,過一陣子可能出事
    function daily(w) {
        const K = S(w), d = day(w); if (K.lastDay === d) return; K.lastDay = d;
        for (const x of K.list) {
            if (x.fell || x.q !== 'poor' || d - x.d < 12 || Math.random() > 0.025) continue;
            x.fell = true; K.st.fell = (K.st.fell || 0) + 1; const all = npcs(w); const c = w.agents[x.by];
            log(w, '💥 {a}包的{k}出事了：{y}。大家這才發現當初材料偷工減料。', { a: x.byName, k: t(x.name), y: t(x.name === '修橋' ? '橋面塌了一塊，兩個人掉進河裡' : x.name === '蓋水渠' ? '水渠裂開，淹了半條街' : '才用沒多久就崩壞了') }, x.byName);
            news(w, `💥 ${t(x.name)}${t('出事')}${t('：')}${x.byName}${t('偷工減料')}`, 9, [x.byName]);
            for (const a of all) { if (a === c) continue; a.moodModifier = (a.moodModifier || 0) - 2; if (c) a.relationships?.getOrCreate?.(c.agentId, c.name)?.modifyAffinity?.(-8); }
            if (c) {
                const fine = Math.min(cash(w, c), r2((x.skim || 0) * 2 + 10)); if (fine > 0 && WALLET.take(w, c, fine)) w.stockpile?.add?.('silver', fine, w.tickCount, t('偷工減料的賠償'));
                K.ban[c.agentId] = d + 90; K.st.caught = (K.st.caught || 0) + 1; c.moodModifier = (c.moodModifier || 0) - 10;
                try { if (typeof DARK !== 'undefined' && DARK.bump) DARK.bump(w, c, 'exposed'); } catch (e) {}
                log(w, '⚖️ {a}賠了 {n} 銀幣，三個月內不准再標鎮上的工程。', { a: c.name, n: Math.round(fine) }, c.name); mem(w, c, '我包的{k}出事了，賠了 {n} 銀幣，大家都用異樣的眼光看我。', { k: t(x.name), n: Math.round(fine) }, 9);
            }
        }
        for (const id of Object.keys(K.ban)) if (K.ban[id] <= d) delete K.ban[id];
    }
    function view(w) { const K = S(w); return { list: K.list.slice(-4).reverse().map(x => ({ icon: x.icon, name: t(x.name), by: t(x.byName), n: x.n, fell: x.fell, crony: x.crony })), st: K.st }; }
    function brief(w, a) { const K = w.cycle?.wk; if (!K) return ''; const x = K.list.slice().reverse().find(y => y.by === a.agentId); if (!x) return ''; return x.fell ? t('你包的公共工程偷工減料出了事，賠了錢、名聲也壞了。') : x.skim ? t('你包的公共工程偷偷省了材料，多賺了一些，怕被人發現。') : t('你標到過鎮上的公共工程，賺了一筆。'); }
    return { S, tender, daily, view, brief, KINDS };
})();

// v8.9.0 賭場:城鎮以上才有,有野心的有錢人開;十賭九輸,偶爾有人一夕致富,也有人輸到家破人亡;城市以上吸引外地賭客(觀光)
const CASINO = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const news = (w, s, imp, nm) => { try { w.dailyNews?.collectEvent?.('social', s, imp || 7, nm || []); } catch (e) {} };
    const r2 = (n) => Math.round(n * 100) / 100;
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const tier = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { return 0; } };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const NAMES = [['金滿堂', 'Golden Hall'], ['好運來', 'Lucky Star'], ['聚寶閣', 'Treasure Pavilion'], ['一擲樓', 'The Last Throw'], ['銀骰坊', 'Silver Dice']];
    const EDGE = 0.38, JACK = 0.003, JACKX = 20; // 贏的機會 38%(押多少賺多少),0.3% 中大獎(20 倍):莊家每押抽將近兩成,長期下來十賭九輸
    function S(w) {
        if (!w.casino || typeof w.casino !== 'object') w.casino = { open: false, owner: null, name: null, opened: null, ban: false, lastDay: null, lastProp: -99, ruin0: 0, v: {}, streak: {}, lost: {}, st: { visits: 0, house: 0, paid: 0, jack: 0, ruin: 0, fled: 0, divorce: 0, tourists: 0, tour: 0, credit: 0, collect: 0, theft: 0, wage: 0 }, today: null, debt: {}, net: [] };
        const C = w.casino; C.v = C.v || {}; C.streak = C.streak || {}; C.lost = C.lost || {}; C.st = C.st || {}; C.debt = C.debt || {}; C.net = C.net || []; return C;
    }
    const nameOf = (C) => C.name ? (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en' ? C.name[1] : C.name[0]) : '';
    // 賭性:貪心、樂觀的人愛賭;克己、虔誠、謹慎的人少碰;輸了想翻本的人越陷越深
    function urge(w, C, a) {
        let p = 0.05 * (has(a, 'greedy') ? 1.7 : 1) * (has(a, 'optimist') ? 1.4 : 1) * (has(a, 'lazy') ? 1.3 : 1) * (has(a, 'ascetic') || has(a, 'stoic') || has(a, 'perfectionist') ? 0.25 : 1) * (devout(w, a) ? 0.3 : 1);
        const st = C.streak[a.agentId] || 0; p += Math.min(0.45, st * 0.12); // 越輸越想翻本
        if (cash(w, a) < 40 * INFL.p(w) && (w.bank?.loans?.[a.agentId] || (w.market?.hungry?.[a.agentId] || 0) > 0)) p += 0.05; // 走投無路的人想靠運氣
        if (typeof THINGS !== 'undefined' && C.thing) p *= THINGS.useMult(w, C.thing, a); // v9.0.0 喜不喜歡賭場、有沒有答應家人戒賭
        return Math.min(0.7, p);
    }
    // v9.25.0 去不去賭、押多少、借不借錢翻本、賭債還不出來怎麼辦、要不要開賭場，交給本人決定(sim-decide-fun.js)；沒有決策核心時照舊擲骰
    const byFun = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.fun && !!DECIDE.on?.(w); } catch (e) { return false; } };
    const openCand = (w) => { const px = INFL.p(w); return here(w).filter(a => cash(w, a) >= 250 * px && (has(a, 'greedy') || has(a, 'ambitious') || has(a, 'charismatic')) && a.job?.key !== 'priest').sort((x, y) => cash(w, y) - cash(w, x))[0] || null; };
    function open(w, C, d, who) {
        const px = INFL.p(w); const cand = who || openCand(w);
        if (!cand) return; const cost = r2(120 * px); if (!WALLET.take(w, cand, cost)) return;
        const hand = here(w).filter(o => o !== cand && ['builder', 'carpenter'].includes(o.job?.key)); const h = hand[Math.floor(Math.random() * hand.length)]; if (h) WALLET.add(w, h, cost); else w.stockpile?.add?.('silver', cost, w.tickCount, t('蓋賭場'));
        const nm = NAMES[Math.floor(Math.random() * NAMES.length)]; C.open = true; C.owner = cand.agentId; C.name = nm; C.opened = d; try { I18N.registerName(nm[0], nm[1]); } catch (e) {}
        log(w, '🎰 {a}花 {n} 銀幣在鎮上開了一家賭場「{s}」。有人說會帶來財路，也有人說會害人。', { a: cand.name, n: Math.round(cost), s: nm[0] }, cand.name);
        news(w, `🎰 ${cand.name}${t('開了賭場')}${t('「')}${t(nm[0])}${t('」')}`, 7, [cand.name]); mem(w, cand, '我開了一家賭場，莊家永遠是贏的那一邊。', {}, 8);
        // v9.0.0 登記成鎮上的新東西：大家怎麼看、要不要去、抗議或勸人，交給村民自己（sim-things.js）
        C.net = []; C.debt = {}; C.dealer = null;
        if (typeof THINGS !== 'undefined') { const T = THINGS.register(w, { kind: 'casino', key: 'c' + d + '_' + (C.st.opens = (C.st.opens || 0) + 1), name: nm, icon: '🎰', facts: '賭場：押錢可能贏也可能輸，大部分人輸，莊家長期穩賺；偶爾有人中大獎一夕致富，也有人輸到傾家蕩產。', place: 'casino', owner: cand.agentId, tags: { vice: 1, money: 1, risk: 1, fun: 1, harm: 0.7, jobs: 0.3 }, usable: true, build: { tmpl: 'tavern' } }); C.thing = T.id; }
        const dl = here(w).filter(o => o !== cand && (o.age ?? 30) >= 18).sort((x, y) => ((!x.job || x.job.key === 'unemployed') ? 0 : 1) - ((!y.job || y.job.key === 'unemployed') ? 0 : 1) || cash(w, x) - cash(w, y))[0]; /* 先找沒工作的、再找最缺錢的 */ if (dl) { C.dealer = dl.agentId; mem(w, dl, '我在{a}的賭場找到一份荷官的工作。', { a: cand.name }, 6); }
    }
    function close(w, C, why) { const o = w.agents[C.owner]; C.open = false; C.closedWhy = why; C.owner = null; C.dealer = null; try { if (typeof THINGS !== 'undefined' && C.thing) THINGS.retire(w, C.thing); } catch (e) {} if (o) mem(w, o, why === 'broke' ? '賭場被一個大贏家搬空了，莊家也有輸的一天。' : '我的賭場關門了。', {}, 8); }
    // 下一注:f = 押身上的幾成。回傳 { res: 'jack'｜'win'｜'lose', stake, pay, closed }；輸贏是賭桌上的運氣，不是誰的決定
    function bet(w, C, own, a, f, d, px, T) {
        const st = C.streak[a.agentId] || 0; const rich = cash(w, a) >= 200 * px;
        const stake = r2(Math.max(2, cash(w, a) * f)); if (!(stake > 0) || !WALLET.take(w, a, stake)) return null;
        C.v[a.agentId] = (C.v[a.agentId] || 0) + 1; C.st.visits++; T.n++; const r = Math.random(); try { if ((typeof THINGS !== 'undefined' && C.thing)) THINGS.goTonight(w, C.thing, a, 19, 23); } catch (e) {}
        if (r < JACK || r < EDGE) {
            const jack = r < JACK; let win = jack ? r2(stake * JACKX) : stake; const ownCash = cash(w, own); const pay = Math.min(win, ownCash); // 莊家付不出就把家當都賠上
            if (pay > 0) WALLET.take(w, own, pay); WALLET.add(w, a, r2(stake + pay)); C.st.paid = r2(C.st.paid + pay); T.net = r2(T.net - pay); C.streak[a.agentId] = 0; try { if ((typeof THINGS !== 'undefined' && C.thing)) THINGS.feel(w, C.thing, a, jack ? 40 : 3); } catch (e) {}
            if (jack) {
                C.st.jack++; log(w, '🎉 {a}在「{s}」押中了大獎，一夜之間贏了 {n} 銀幣！', { a: a.name, s: C.name[0], n: Math.round(pay) }, a.name); news(w, `🎉 ${a.name}${t('一夕致富')}`, 9, [a.name]);
                mem(w, a, '我在賭場一夜贏了 {n} 銀幣，人生從此不一樣了。', { n: Math.round(pay) }, 9); a.moodModifier = (a.moodModifier || 0) + 15;
                for (const o of here(w)) if (o !== a && (has(o, 'jealous') || cash(w, o) < 20 * px) && Math.random() < 0.4) { bump(o, a, -5); C.streak[o.agentId] = Math.max(C.streak[o.agentId] || 0, 1); try { if ((typeof THINGS !== 'undefined' && C.thing)) THINGS.feel(w, C.thing, o, 12, '{a}在賭場一夜暴富，憑什麼不是我？我也要去試試。', { a: a.name }); else mem(w, o, '{a}在賭場一夜暴富，憑什麼不是我？我也要去試試。', { a: a.name }, 5); } catch (e) {} }
                if (pay < win) { log(w, '💥 「{s}」被{a}贏得付不出錢，老闆{o}傾家蕩產，賭場關門。', { s: C.name[0], a: a.name, o: own.name }, own.name); close(w, C, 'broke'); return { res: 'jack', stake, pay, closed: true }; }
            }
            return { res: jack ? 'jack' : 'win', stake, pay };
        }
        if (WALLET.bizIncome) WALLET.bizIncome(w, own, stake); else WALLET.add(w, own, stake); C.st.house = r2(C.st.house + stake); T.net = r2(T.net + stake); C.st.lossN = (C.st.lossN || 0) + 1;
        C.streak[a.agentId] = st + 1; try { if ((typeof THINGS !== 'undefined' && C.thing)) THINGS.feel(w, C.thing, a, stake >= 20 * px ? -6 : -2); } catch (e) {} const L = (C.lost[a.agentId] = C.lost[a.agentId] || []); L.push([d, stake]); while (L.length && L[0][0] < d - 15) L.shift();
        if (rich && Math.random() < 0.15) log(w, '🎲 {a}在賭場輸了 {n} 銀幣，笑笑說就當買個開心。', { a: a.name, n: Math.round(stake) }, a.name);
        else if (f >= 0.3 && Math.random() < 0.3) { log(w, '🎲 {a}把{x}都押在賭桌上，一把輸光了。', { a: a.name, x: f >= 0.8 ? t('身上所有的錢') : t('一大半的家當') }, a.name); mem(w, a, '我在賭場輸了 {n} 銀幣，下次一定要贏回來。', { n: Math.round(stake) }, 6); }
        if (cash(w, a) < 2 && L.reduce((s, x) => s + x[1], 0) >= 40 * px && (st + 1) >= 3) ruin(w, C, a, L.reduce((s, x) => s + x[1], 0));
        return { res: 'lose', stake, pay: 0 };
    }
    // ---------- v9.25.0 交給本人決定的版本 ----------
    // 這個人今晚能不能去賭、有哪些路(銀行借、莊家賒)
    function goInfo(w, a) {
        const C = w.casino; if (!C || !C.open || C.ban || !a || (a.age ?? 30) < 18) return null; const own = w.agents[C.owner]; if (!own || own.isDead || own === a) return null;
        const px = INFL.p(w); const c = cash(w, a); const st = C.streak?.[a.agentId] || 0;
        const canBank = st >= 2 && c < 10 * px && typeof BANK !== 'undefined' && !!w.bank?.open && !w.bank.loans?.[a.agentId] && (!BANK.lendable || BANK.lendable(w.bank) >= 5);
        const canCredit = st >= 2 && c < 10 * px && !C.debt?.[a.agentId] && cash(w, own) > 100 * px;
        if (c < 5 && !canBank && !canCredit) return null;
        const lost = (C.lost?.[a.agentId] || []).reduce((x, y) => x + y[1], 0);
        return { own, c: Math.floor(c), st, px, rich: c >= 200 * px, poor: c < 40 * px, urge: urge(w, C, a), canBank, canCredit, lost: Math.round(lost), visits: C.v?.[a.agentId] || 0, owed: Math.round(C.debt?.[a.agentId]?.n || 0), name: C.name ? C.name[0] : '' };
    }
    const FRAC = { small: 0.12, big: 0.35, all: 0.9 };
    // 本人決定去賭:small 小玩／big 押大的／all 全押翻本／bank 跟銀行借了再押／credit 跟莊家賒了再押
    function goBy(w, a, mode) {
        const I = goInfo(w, a); if (!I) return null; const C = w.casino; const own = I.own; const px = I.px; const d = day(w);
        if (mode === 'bank') { if (!I.canBank) return null; let got = 0; try { got = BANK.lend(w, BANK.S(w), a, Math.ceil(30 * px), t('翻本')); } catch (e) {} if (!got) return { res: 'nobank' }; log(w, '🏦 {a}跟銀行借了 {n} 銀幣，說要去賭場翻本。', { a: a.name, n: got }, a.name); mode = 'all'; }
        else if (mode === 'credit') { if (!I.canCredit) return null; const n = Math.round(20 * px); if (!WALLET.take(w, own, n)) return { res: 'nocredit' }; WALLET.add(w, a, n); C.debt[a.agentId] = { n, day: d }; C.st.credit++; log(w, '🧾 {o}讓{a}先賒 {n} 銀幣下注，說「有錢再還」。', { o: own.name, a: a.name, n }, a.name); mode = 'all'; }
        if (!FRAC[mode] || cash(w, a) < 2) return null;
        const T = C.today && typeof C.today === 'object' ? C.today : (C.today = { n: 0, net: 0 });
        return bet(w, C, own, a, mode === 'small' && I.rich ? 0.04 : FRAC[mode], d, px, T);
    }
    // 要不要開賭場:只問鎮上最有條件開的那個人(有本錢、有那個性子)
    function openInfo(w, a) { const C = S(w); if (C.open || C.ban || tier(w) < 1 || day(w) < 20 || !a || openCand(w) !== a) return null; return { cost: r2(120 * INFL.p(w)), c: Math.floor(cash(w, a)) }; }
    function openBy(w, a) { if (!openInfo(w, a)) return false; const C = S(w); open(w, C, day(w), a); return !!C.open && C.owner === a.agentId; }
    // 賭債拖了三週還不出來
    function debtInfo(w, a) {
        const C = w.casino; if (!C || !C.open || !a) return null; const D = C.debt?.[a.agentId]; const own = w.agents[C.owner]; const d = day(w); if (!D || !own || D.n <= 0.5 || d - D.day < 21) return null;
        return { n: Math.round(D.n), days: d - D.day, own, c: Math.floor(cash(w, a)), canSteal: here(w).some(o => o !== a && o !== own && cash(w, o) >= D.n + 10) };
    }
    function stealBy(w, a) {
        const I = debtInfo(w, a); if (!I) return 0; const C = w.casino; const D = C.debt[a.agentId]; const own = I.own;
        const mark = here(w).filter(o => o !== a && o !== own && cash(w, o) >= D.n + 10).sort(() => Math.random() - 0.5)[0]; if (!mark) return 0;
        const n = Math.min(D.n, cash(w, mark) * 0.3); if (!WALLET.take(w, mark, n)) return 0; WALLET.add(w, own, n); D.n = r2(D.n - n); C.st.theft++;
        try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: mark.agentId, k: '{a}為了還賭債，偷了{b}的 {n} 銀幣', p: { a: a.name, b: mark.name, n: Math.round(n) } }); } catch (e) {}
        mem(w, mark, '我家少了 {n} 銀幣，不知道被誰拿走了。', { n: Math.round(n) }, 7); mem(w, a, '我為了還賭債，偷了{b}的錢。', { b: mark.name }, 9); log(w, '🕵️ {b}家裡少了 {n} 銀幣，大家議論紛紛。', { b: mark.name, n: Math.round(n) }, mark.name);
        if (D.n <= 0.5) delete C.debt[a.agentId]; return Math.round(n);
    }
    function fleeBy(w, a, ruined) {
        const C = w.casino; if (!C || !a) return false; if (!ruined && !debtInfo(w, a)) return false;
        log(w, '🌙 {a}欠了一屁股債，連夜跑路離開了小鎮。', { a: a.name }, a.name); if (ruined) news(w, `🌙 ${a.name}${t('賭輸跑路')}`, 7, [a.name]); C.st.fled++; delete C.debt[a.agentId];
        try { a._leaveReason = t('賭債'); w.leaveTown?.(a.agentId, t('賭債')); } catch (e) {} return true;
    }
    function daily(w) {
        if (typeof WALLET === 'undefined' || !w.wallet) return; const C = S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d; const tr = tier(w);
        if (C.ban) return;
        const fun = byFun(w);
        if (!C.open) { if (!fun && tr >= 1 && d >= 20 && Math.random() < 0.04) open(w, C, d); return; }
        const own = w.agents[C.owner]; if (!own || own.isDead) { if (!w.isAway?.(C.owner)) { log(w, '🎰 賭場「{s}」的老闆不在了，賭場關了門。', { s: C.name[0] }); close(w, C, 'gone'); } return; }
        const px = INFL.p(w); const T = fun && C.today && typeof C.today === 'object' ? C.today : (C.today = { n: 0, net: 0 }); // 交給本人:今天的帳是從上次結帳到現在、大家自己來賭累積的
        for (const a of here(w)) {
            if (fun) break; // 去不去、押多少由本人決定(goBy)
            if (a === own || cash(w, a) < 5 || Math.random() > urge(w, C, a)) continue;
            const c = cash(w, a), st = C.streak[a.agentId] || 0; const rich = c >= 200 * px, poor = c < 40 * px;
            let f = rich ? 0.02 + Math.random() * 0.04 : poor ? 0.3 + Math.random() * 0.4 : 0.1 + Math.random() * 0.1; if (st >= 2) f = Math.max(f, 0.5 + Math.random() * 0.5); // 輸紅了眼就全押
            // 想翻本卻沒錢:去銀行借
            if (st >= 2 && c < 10 * px && typeof BANK !== 'undefined' && w.bank?.open && !w.bank.loans?.[a.agentId]) { try { const got = BANK.lend(w, BANK.S(w), a, Math.ceil(30 * px), t('翻本')); if (got) log(w, '🏦 {a}跟銀行借了 {n} 銀幣，說要去賭場翻本。', { a: a.name, n: got }, a.name); } catch (e) {} }
            // v9.0.0 銀行不借，莊家賒帳給你賭（記成賭債，之後會來討）
            if (st >= 2 && cash(w, a) < 10 * px && !C.debt[a.agentId] && cash(w, own) > 100 * px && Math.random() < 0.6) { const n = Math.round(20 * px); if (WALLET.take(w, own, n)) { WALLET.add(w, a, n); C.debt[a.agentId] = { n, day: d }; C.st.credit++; log(w, '🧾 {o}讓{a}先賒 {n} 銀幣下注，說「有錢再還」。', { o: own.name, a: a.name, n }, a.name); } }
            if (bet(w, C, own, a, f, d, px, T)?.closed) return;
        }
        // 城市以上:外地賭客來試手氣(觀光收入,錢從外地進來)
        if (tr >= 2 && cash(w, own) > 0) { const n = tr * (1 + Math.floor(Math.random() * 3)); const spend = r2(n * (6 + Math.random() * 6) * px); const inn = r2(n * 2 * px);
            if (WALLET.bizIncome) WALLET.bizIncome(w, own, spend); else WALLET.add(w, own, spend); if (typeof MARKET !== 'undefined' && w.market) MARKET.sell(w, 'kitchen', inn, t('外地賭客')); else w.stockpile?.add?.('silver', inn, w.tickCount, t('外地賭客'));
            try { if (typeof MONEY !== 'undefined') MONEY.flow(w, 'tourism', r2(spend + inn)); } catch (e) {}
            C.st.tourists += n; C.st.tour = r2(C.st.tour + spend + inn); if (Math.random() < 0.08) log(w, '🧳 {n} 個外地客專程來「{s}」試手氣，順便在鎮上吃住，花了 {m} 銀幣。', { n, s: C.name[0], m: Math.round(spend + inn) }); }
        upkeep(w, C, own, d, T); collect(w, C, own, d);
        if (fun && C.open) C.today = { n: 0, net: 0 }; // 結完帳，重新開始記(之後大家自己來賭的會累積在這裡)
        for (const id of Object.keys(C.v)) if (!w.agents[id] && !w.isAway?.(id)) { delete C.v[id]; delete C.streak[id]; delete C.lost[id]; }
    }
    // v9.0.0 開店要成本：荷官工資每天從老闆口袋付；連續一個月虧錢、老闆又沒錢，就收掉
    function upkeep(w, C, own, d, T) {
        const px = INFL.p(w); const dl = w.agents[C.dealer]; let wage = 0;
        if (dl && !dl.isDead) { wage = r2(Math.min(cash(w, own), 3 * px)); if (wage > 0 && WALLET.take(w, own, wage)) { WALLET.add(w, dl, wage); C.st.wage = r2((C.st.wage || 0) + wage); } else wage = 0; } else C.dealer = null;
        C.net.push(r2((T?.net || 0) - wage)); while (C.net.length > 30) C.net.shift();
        const sum = C.net.reduce((x, y) => x + y, 0);
        if (C.net.length >= 30 && sum < 0 && cash(w, own) < 30 * px && C.open) { log(w, '🎰 「{s}」一個月下來都在賠錢，{o}撐不下去，把賭場收了。', { s: C.name[0], o: own.name }, own.name); news(w, `🎰 ${t(C.name[0])}${t('收掉了')}`, 6, [own.name]); close(w, C, 'loss'); }
    }
    // 賭債：七天後開始討；有錢就拿走，沒錢先找家人，再不行就威脅；三週還不出來，有人會去偷、有人連夜跑路
    function collect(w, C, own, d) {
        if (!own) return; const px = INFL.p(w);
        for (const [id, D] of Object.entries(C.debt)) {
            const a = w.agents[id]; if (!a && w.isAway?.(id)) continue; /* v9.9.4 出遠門不算賴掉 */ if (!a || a.isDead) { delete C.debt[id]; continue; } if (d - D.day < 7) continue;
            let got = Math.min(cash(w, a), D.n); if (got > 0 && WALLET.take(w, a, got)) { WALLET.add(w, own, got); D.n = r2(D.n - got); }
            // 家人代還（錢直接從家人付給賭場老闆）
            if (D.n > 0.5) { const fam = (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []).filter(o => o !== own && cash(w, o) >= D.n + 20 && Math.random() < 0.4)[0];
                if (fam && WALLET.take(w, fam, D.n)) { WALLET.add(w, own, D.n); log(w, '💸 {f}咬著牙替{a}還了 {n} 銀幣賭債。', { f: fam.name, a: a.name, n: Math.round(D.n) }, fam.name); mem(w, fam, '我替{a}還了賭債，心裡很不是滋味。', { a: a.name }, 7); try { if (C.thing && typeof THINGS !== 'undefined') THINGS.feel(w, C.thing, fam, -20); } catch (e) {} D.n = 0; } }
            if (D.n <= 0.5) { delete C.debt[id]; C.st.collect++; log(w, '🧾 {a}把欠{o}的賭債還清了。', { a: a.name, o: own.name }, a.name); continue; }
            if (!D.warned || d - D.warned >= 4) { D.warned = d; a.moodModifier = (a.moodModifier || 0) - 8; bump(a, own, -8); log(w, '👊 {o}找人堵在{a}家門口討賭債：「還欠 {n} 銀幣，別想躲。」', { o: own.name, a: a.name, n: Math.round(D.n) }, a.name); mem(w, a, '{o}的人天天堵在我家門口討債，我怕得不敢出門。', { o: own.name }, 8); }
            if (d - D.day >= 21 && !byFun(w)) { // 交給本人:偷不偷、跑不跑由他自己決定(stealBy／fleeBy)
                const mark = here(w).filter(o => o !== a && o !== own && cash(w, o) >= D.n + 10).sort(() => Math.random() - 0.5)[0];
                if (mark && !has(a, 'kind') && Math.random() < 0.5) { const n = Math.min(D.n, cash(w, mark) * 0.3); if (WALLET.take(w, mark, n)) { WALLET.add(w, own, n); D.n = r2(D.n - n); C.st.theft++; try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: mark.agentId, k: '{a}為了還賭債，偷了{b}的 {n} 銀幣', p: { a: a.name, b: mark.name, n: Math.round(n) } }); } catch (e) {} mem(w, mark, '我家少了 {n} 銀幣，不知道被誰拿走了。', { n: Math.round(n) }, 7); mem(w, a, '我為了還賭債，偷了{b}的錢。', { b: mark.name }, 9); log(w, '🕵️ {b}家裡少了 {n} 銀幣，大家議論紛紛。', { b: mark.name, n: Math.round(n) }, mark.name); if (D.n <= 0.5) delete C.debt[id]; } }
                else if (Math.random() < 0.3) { log(w, '🌙 {a}欠了一屁股債，連夜跑路離開了小鎮。', { a: a.name }, a.name); C.st.fled++; delete C.debt[id]; try { a._leaveReason = t('賭債'); w.leaveTown?.(a.agentId, t('賭債')); } catch (e) {} }
            }
        }
    }
    // 輸到家破人亡:配偶受不了離開、欠債的人連夜跑路
    function ruin(w, C, a, tot) {
        C.st.ruin++; C.streak[a.agentId] = 0; C.lost[a.agentId] = []; a.moodModifier = (a.moodModifier || 0) - 20;
        log(w, '💔 {a}在賭場前後輸掉了 {n} 銀幣，連吃飯的錢都沒了。', { a: a.name, n: Math.round(tot) }, a.name); try { if ((typeof THINGS !== 'undefined' && C.thing)) { THINGS.victim(w, C.thing, a, '我把家當全輸在賭場了，我怎麼會走到這一步。'); THINGS.goTonight(w, C.thing, a, 17, 21, true); } else mem(w, a, '我把家當全輸在賭場了，我怎麼會走到這一步。', {}, 9); } catch (e) {}
        const RR = a.relationships?.relationships || {}; const sk = Object.keys(RR).find(k => RR[k]?.status === 'married'); const sp = sk ? RR[sk] : null; const spouse = sk ? w.agents[sk] : null;
        if (spouse && !spouse.isDead && Math.random() < 0.5) {
            sp.status = 'ex'; const back = spouse.relationships?.relationships?.[a.agentId]; if (back) { back.status = 'ex'; back.affinity = Math.min(back.affinity ?? 0, -30); } C.st.divorce++;
            log(w, '💔 {b}受不了{a}一直去賭，帶著孩子離開了這個家。', { a: a.name, b: spouse.name }, spouse.name); mem(w, spouse, '{a}把家都賭光了，我不能再跟他過下去。', { a: a.name }, 9);
        }
        for (const o of (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : [])) if (o !== a && o !== spouse && Math.random() < 0.6) { bump(o, a, -10); mem(w, o, '{a}在賭場把家都輸光了。', { a: a.name }, 6); }
        const owes = w.bank?.loans?.[a.agentId];
        if (byFun(w)) { try { DECIDE.enqueue(w, a, 'ruined', { tot: Math.round(tot), owes: !!owes }); } catch (e) {} }
        else if (owes || Math.random() < 0.25) {
            log(w, '🌙 {a}欠了一屁股債，連夜跑路離開了小鎮。', { a: a.name }, a.name); news(w, `🌙 ${a.name}${t('賭輸跑路')}`, 7, [a.name]); C.st.fled++;
            try { a._leaveReason = t('賭債'); w.leaveTown?.(a.agentId, t('賭債')); } catch (e) {}
        }
    }
    function vote(w, p0, a) {
        const C = S(w); const own = a.agentId === C.owner; const gambler = (C.v[a.agentId] || 0) >= 3; const kitchen = (() => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).includes('kitchen'); } catch (e) { return false; } })();
        const hurt = (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []).some(o => (C.lost[o.agentId] || []).length >= 2) || C.st.ruin > 0 && aff(a, w.agents[C.owner]) < -20;
        const s = (devout(w, a) || a.job?.key === 'priest' ? 1.6 : 0) + (hurt ? 1.4 : 0) + (has(a, 'kind') ? 0.5 : 0) + (has(a, 'ascetic') ? 0.6 : 0) - (own ? 5 : 0) - (gambler ? 1.5 : 0) - (kitchen ? 1 : 0) - (has(a, 'greedy') ? 0.6 : 0) + (Math.random() - 0.5);
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (hurt ? 'cas_hurt' : 'cas_sin') : (own || kitchen ? 'cas_money' : 'cas_free') };
    }
    function enact(w, p0) { const C = S(w); const nm = C.name?.[0] || ''; C.ban = true; if (C.open) close(w, C, 'ban'); log(w, '🚫 小鎮決定禁賭，「{s}」關門了。', { s: nm }); return t('全鎮禁賭'); }
    function view(w) { const C = w.casino; if (!C || (!C.open && !C.ban && !C.st?.visits)) return null; return { open: C.open, ban: C.ban, name: nameOf(C), owner: C.owner && w.agents[C.owner] ? t(w.agents[C.owner].name) : '', st: C.st, today: C.today || { n: 0, net: 0 } }; }
    function brief(w, a) {
        const C = w.casino; if (!C) return ''; if (a.agentId === C.owner && C.open) return t('你在鎮上開賭場，莊家長期下來總是贏。');
        const st = C.streak?.[a.agentId] || 0; if (st >= 2) return t('你最近在賭場一直輸，滿腦子只想把錢贏回來。'); if ((C.v?.[a.agentId] || 0) >= 5) return t('你常去賭場碰碰運氣。'); return '';
    }
    return { S, daily, vote, enact, view, brief, EDGE, JACK, JACKX, byFun, urge, goInfo, goBy, openInfo, openBy, debtInfo, stealBy, fleeBy };
})();

// ---------- 接上其他系統 ----------
if (typeof THINGS !== 'undefined') THINGS.HOOKS.casino = {
    alive: (w, T) => !!(w.casino && w.casino.open && w.casino.thing === T.id),
    regulars: (w) => Object.entries(w.casino?.v || {}).filter(([, n]) => n >= 2).map(([id]) => id),
    ban: (w, T) => CASINO.enact(w, {}),
    facts: (w, T) => { const C = w.casino; const st = C?.st || {}; return `${t(T.facts)}${t('到目前為止')} ${st.visits || 0} ${t('人次')}${t('，')}${t('一夕致富')} ${st.jack || 0}${t('，')}${t('家破人亡')} ${st.ruin || 0}${t('。')}`; },
};
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { infl_raise: { icon: '💼', label: '工資跟上物價' }, casino_ban: { icon: '🚫', label: '禁賭' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { infl_worker: '做一天的工已經買不起以前的東西', infl_fair: '物價漲了工資也該漲', infl_boss: '工資一漲，店就撐不下去', infl_spiral: '工資一漲物價又會跟著漲', cas_hurt: '家裡有人被賭場害慘了', cas_sin: '賭博傷風敗俗', cas_money: '賭場帶來生意和觀光客', cas_free: '願賭服輸，大人自己負責' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { INFL.daily(w); } catch (e) { console.warn('[Infl] daily', e); } try { SPEND.daily(w); } catch (e) { console.warn('[Spend] daily', e); } try { WORKS.daily(w); } catch (e) { console.warn('[Works] daily', e); } try { CASINO.daily(w); } catch (e) { console.warn('[Casino] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'infl_raise' || p.kind === 'casino_ban') { const r = p.kind === 'casino_ban' ? CASINO.vote(w, p, a) : INFL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = [INFL.brief(world), SPEND.brief(world, a), WORKS.brief(world, a), CASINO.brief(world, a)].filter(Boolean); if (s.length) b.mem = [...(b.mem || []), ...s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.infl = null; this.spend = null; this.casino = null; try { INFL.sync(this); } catch (e) {} return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d) { if (this.infl) d.infl = this.infl; if (this.spend) d.spend = this.spend; if (this.casino) d.casino = this.casino; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.infl = (data?.infl && typeof data.infl === 'object') ? data.infl : null; this.spend = (data?.spend && typeof data.spend === 'object') ? data.spend : null; this.casino = (data?.casino && typeof data.casino === 'object') ? data.casino : null; INFL.sync(this); } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') { globalThis.INFL = INFL; globalThis.SPEND = SPEND; globalThis.WORKS = WORKS; globalThis.CASINO = CASINO; }
