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
    function daily(w) {
        if (!W() || !w.wallet) return; const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        const all = here(w); if (!all.length) return; const px = P(w);
        // 1) 看戲、聽說書:有才藝的人在廣場表演,看的人丟賞錢(錢給表演的人)
        const perf = all.filter(a => (has(a, 'creative') || has(a, 'charismatic')) && cash(w, a) < 300);
        if (perf.length && Math.random() < 0.5) {
            const pf = perf[Math.floor(Math.random() * perf.length)]; const fee = r2(1.5 * px); let n = 0, got = 0;
            for (const a of all) { if (a === pf || cash(w, a) < 20 * px || Math.random() > 0.14 * thrift(a)) continue; if (WALLET.take(w, a, fee)) { got += fee; n++; a.moodModifier = (a.moodModifier || 0) + 1; } }
            if (got > 0) { if (WALLET.bizIncome) WALLET.bizIncome(w, pf, got); else WALLET.add(w, pf, got); X.st.show = r2((X.st.show || 0) + got); X.st.showN = (X.st.showN || 0) + 1;
                if (n >= 3 && Math.random() < 0.35) log(w, '🎭 {p}在廣場{x}，{n} 個人圍著看，丟了 {s} 銀幣賞錢。', { p: pf.name, x: has(pf, 'creative') ? t('說書唱曲') : t('變戲法'), n, s: Math.round(got) }, pf.name);
                if (n >= 4 && Math.random() < 0.3) mem(w, pf, '今天在廣場表演，{n} 個人丟賞錢給我。', { n }, 5); }
        }
        // 2) 宴客:有錢人請朋友吃一頓(錢付給食堂和農莊)
        for (const a of all) {
            const c = cash(w, a); if (c < 150 * px || Math.random() > 0.02 * thrift(a)) continue;
            const cost = r2(Math.min(c * 0.08, 25 * px + c * 0.03)); const guests = all.filter(o => o !== a && aff(a, o) >= 20).sort((x, y) => aff(a, y) - aff(a, x)).slice(0, 5); if (guests.length < 2 || !WALLET.take(w, a, cost)) continue;
            if (typeof MARKET !== 'undefined' && w.market) { MARKET.sell(w, 'kitchen', r2(cost * 0.6), t('宴客')); MARKET.sell(w, 'farm', r2(cost - r2(cost * 0.6)), t('宴客')); } else w.stockpile?.add?.('silver', cost, w.tickCount, t('宴客'));
            for (const g of guests) { bump(g, a, 4); bump(a, g, 2); g.moodModifier = (g.moodModifier || 0) + 2; }
            X.st.feast = r2((X.st.feast || 0) + cost); X.st.feastN = (X.st.feastN || 0) + 1;
            if (Math.random() < 0.5) log(w, '🍷 {a}花了 {n} 銀幣在食堂擺了一桌，請{g}吃飯。', { a: a.name, n: Math.round(cost), g: guests.slice(0, 3).map(x => x.name).join(t('、')) }, a.name);
            mem(w, a, '我請朋友吃了一頓好的，花了 {n} 銀幣。', { n: Math.round(cost) }, 4); break; // 一天最多一場
        }
        // 3) 請畫師畫像(錢給有才藝的人)
        { const painters = all.filter(a => has(a, 'creative')); if (painters.length) for (const a of all) {
            const c = cash(w, a); if (c < 250 * px || X.edu['art_' + a.agentId] > d - 120 || Math.random() > 0.006 * thrift(a)) continue;
            const pt = painters.filter(o => o !== a)[0]; if (!pt) continue; const fee = r2(25 * px + c * 0.02); if (!WALLET.take(w, a, fee)) continue;
            if (WALLET.bizIncome) WALLET.bizIncome(w, pt, fee); else WALLET.add(w, pt, fee); X.edu['art_' + a.agentId] = d; X.st.art = r2((X.st.art || 0) + fee); X.st.artN = (X.st.artN || 0) + 1;
            log(w, '🖼️ {a}花 {n} 銀幣請{p}畫了一張像，掛在家裡最顯眼的地方。', { a: a.name, n: Math.round(fee), p: pt.name }, a.name); mem(w, a, '我請{p}畫了一張像，以後子孫看得到我。', { p: pt.name }, 6); mem(w, pt, '{a}請我畫像，給了 {n} 銀幣。', { a: a.name, n: Math.round(fee) }, 5); break;
        } }
        // 4) 去外地旅遊(錢流出鎮外)
        for (const a of all) {
            const c = cash(w, a); if (c < 100 * px || Math.random() > 0.02 * thrift(a) * Math.min(2, c / (200 * px)) || a.job?.key === 'mayor') continue; // 越有錢越常出門
            const cost = r2(Math.min(c * 0.2, 40 * px + c * 0.08)); if (!WALLET.take(w, a, cost)) continue; out(w, 'travel', cost);
            const where = townName(w); a.moodModifier = (a.moodModifier || 0) + 6; X.st.trip = r2((X.st.trip || 0) + cost); X.st.tripN = (X.st.tripN || 0) + 1;
            if (Math.random() < 0.5) log(w, '🧳 {a}去{t}玩了幾天，花了 {n} 銀幣，回來逢人就說那裡的見聞。', { a: a.name, t: where, n: Math.round(cost) }, a.name);
            mem(w, a, '我去{t}玩了一趟，花了 {n} 銀幣，大開眼界。', { t: where, n: Math.round(cost) }, 6);
            for (const o of all) if (o !== a && aff(o, a) > 30 && cash(w, o) < 30 && Math.random() < 0.15) mem(w, o, '{a}又去外地玩了，我連一頓好的都吃不起。', { a: a.name }, 4);
            break;
        }
        // 5) 送孩子去外地讀書(學費流出鎮外;讀完回來,長大後工資高一成五)
        for (const k of npcs(w)) {
            const age = k.age ?? 30; if (age < 8 || age >= 16 || X.school[k.agentId] != null) continue;
            const fam = (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, k) : []).filter(o => o !== k && (o.age ?? 30) >= 18 && !o.isDead);
            const payer = fam.sort((x, y) => cash(w, y) - cash(w, x))[0]; if (!payer || cash(w, payer) < 100 * px || Math.random() > 0.02 * (has(payer, 'ascetic') ? 0.5 : 1) * (payer.personality?.values || []).concat([]).reduce((m, v) => m * (v === '知識' || v === t('知識') ? 2.5 : 1), 1)) continue;
            const fee = r2(40 * px); if (!WALLET.take(w, payer, fee)) continue; out(w, 'school', fee); X.school[k.agentId] = d; X.paid = X.paid || {}; X.paid[k.agentId] = d; X.st.fee = r2((X.st.fee || 0) + fee); X.st.feeN = (X.st.feeN || 0) + 1;
            log(w, '🎓 {a}花 {n} 銀幣送{k}去{t}讀書。', { a: payer.name, n: Math.round(fee), k: k.name, t: townName(w) }, payer.name); mem(w, payer, '我把錢省下來送{k}去外地讀書，希望他將來有出息。', { k: k.name }, 7); mem(w, k, '我要去外地讀書了。', {}, 7);
        }
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
    return { S, daily, view, brief };
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

// ---------- 接上其他系統 ----------
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { infl_raise: { icon: '💼', label: '工資跟上物價' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { infl_worker: '做一天的工已經買不起以前的東西', infl_fair: '物價漲了工資也該漲', infl_boss: '工資一漲，店就撐不下去', infl_spiral: '工資一漲物價又會跟著漲' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { INFL.daily(w); } catch (e) { console.warn('[Infl] daily', e); } try { SPEND.daily(w); } catch (e) { console.warn('[Spend] daily', e); } try { WORKS.daily(w); } catch (e) { console.warn('[Works] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'infl_raise') { const r = INFL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = [INFL.brief(world), SPEND.brief(world, a), WORKS.brief(world, a)].filter(Boolean); if (s.length) b.mem = [...(b.mem || []), ...s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.infl = null; this.spend = null; try { INFL.sync(this); } catch (e) {} return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d) { if (this.infl) d.infl = this.infl; if (this.spend) d.spend = this.spend; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.infl = (data?.infl && typeof data.infl === 'object') ? data.infl : null; this.spend = (data?.spend && typeof data.spend === 'object') ? data.spend : null; INFL.sync(this); } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') { globalThis.INFL = INFL; globalThis.SPEND = SPEND; globalThis.WORKS = WORKS; }
