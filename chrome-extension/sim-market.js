// v6.89.0 產權、雇傭與市場
// - 產業有主人:農莊、食堂、布莊、木作坊、礦場、鐵鋪、商行各有一位老闆(一人可擁有好幾家);沒人買得起就是公營
// - 私人產業的工資由老闆自己付(扣所得稅給公庫);老闆看生意好壞調工資,吝嗇的老闆壓薪;付不出就欠薪;週轉不靈會把產業賣掉
// - 公職(首長、守衛、神職、醫生、研究員)才由公庫發薪
// - 三餐、衣服、柴火、消費的錢付給產業主(先繳營業稅),不再流回公庫;公庫的工程款、維護費大半付給木作坊、礦場、鐵鋪的老闆
// - 沒錢就真的吃不到:先找家人接濟,沒人幫就挨餓;連續挨餓會沒力氣、生病,撐太久會餓死或離鄉
// - 老闆過世由配偶或成年子女繼承產業
const MARKET = (() => {
    const SECTORS = {
        farm:    { jobs: ['farmer'],     zh: '農莊',   en: 'Farm',          icon: '🌾' },
        kitchen: { jobs: ['cook'],       zh: '食堂',   en: 'Eatery',        icon: '🍲' },
        textile: { jobs: ['tailor'],     zh: '布莊',   en: 'Clothier',      icon: '🧵' },
        timber:  { jobs: ['carpenter'],  zh: '木作坊', en: 'Timber yard',   icon: '🪵' },
        mine:    { jobs: ['miner'],      zh: '礦場',   en: 'Mine',          icon: '⛏️' },
        forge:   { jobs: ['blacksmith'], zh: '鐵鋪',   en: 'Forge',         icon: '⚒️' },
        trade:   { jobs: ['trader'],     zh: '商行',   en: 'Trading house', icon: '📦' },
    };
    const PUBLIC = ['mayor', 'guard', 'priest', 'doctor', 'researcher'];
    const JOB2S = {}; for (const [k, s] of Object.entries(SECTORS)) for (const j of s.jobs) JOB2S[j] = k;
    // 一筆消費怎麼分給各產業(其餘跟著營業稅進公庫)
    const SPLIT = { meal: [['kitchen', 0.6], ['farm', 0.4]], clothes: [['textile', 0.75], ['farm', 0.25]], firewood: [['timber', 1]], luxury: [['kitchen', 0.5], ['trade', 0.5]] };
    const BUILD = [['timber', 0.4], ['mine', 0.3], ['forge', 0.3]];
    const PROCURE_SHARE = 0.6; // 公庫工程款有六成付給本地承包商,其餘是外地材料與運費
    const TAX = 0.05;        // 營業稅:營收的 5%(轉嫁給買的人)
    const CORP = 0.12;       // 營利事業所得稅:每週利潤的 12%(老闆自己報,不老實的會少報)
    // 薪資所得稅另計:由老闆從工資扣繳(稅率是村民投票決定的 WALLET.tax),上班族一毛都逃不掉
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const name = (k) => (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? SECTORS[k].en : SECTORS[k].zh;
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    function S(w) {
        if (!w.market || typeof w.market.owners !== 'object') w.market = { owners: {}, pay: {}, rev: {}, cost: {}, hist: {}, hungry: {}, unpaid: {}, lastDay: null, deaths: 0, left: 0 };
        const M = w.market; for (const k of ['pay', 'rev', 'cost', 'hist', 'hungry', 'unpaid']) M[k] = M[k] || {};
        return M;
    }
    const W = (w) => (typeof WALLET !== 'undefined' && w.wallet) ? WALLET.S(w) : null;
    const present = (w, id) => !!id && (!!w.agents?.[id] || !!w.isAway?.(id));
    const bal = (w, id) => Math.max(0, (W(w)?.bal?.[id]) || 0);
    const addId = (w, id, n) => { const Wl = W(w); if (!Wl || !id || !(n > 0)) return; Wl.bal[id] = Math.round(((Wl.bal[id] || 0) + n) * 100) / 100; };
    const takeId = (w, id, n) => { const Wl = W(w); if (!Wl || !id || !(n > 0)) return n <= 0; const b = Wl.bal[id] || 0; if (b + 1e-6 < n) return false; Wl.bal[id] = Math.round((b - n) * 100) / 100; return true; };
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', Math.round(n * 100) / 100, w.tickCount, why); };
    const ownerOf = (w, k) => { const id = S(w).owners[k]; return present(w, id) ? id : null; };
    const workersOf = (w, k, all) => (all || npcs(w)).filter(a => JOB2S[a.job?.key] === k);
    const ownedBy = (w, id) => Object.keys(SECTORS).filter(k => S(w).owners[k] === id);
    // v9.7.0 同產業競爭:賺錢的產業會有人在對面開第二家(對手店),跟原本那家搶客人、搶工人
    // 對手店存在 world.market.rival[產業] = { fid, owner, since, price, pay, emp:{工人:1}, rev, cost, hist, loss, n }
    const rivalOf = (w, k) => { const R = S(w).rival?.[k]; return R && present(w, R.owner) && ownerOf(w, k) && R.owner !== S(w).owners[k] ? R : null; };
    const isRivalEmp = (w, k, a) => { const R = rivalOf(w, k); return !!R && !!R.emp?.[a?.agentId]; };
    // 一個人名下有幾家店(原本那家＋在別的產業開的對手店都算)
    const firmsOf = (w, id) => { const out = ownedBy(w, id).map(k => ({ k, rival: false })); for (const [k, R] of Object.entries(S(w).rival || {})) if (R && R.owner === id && rivalOf(w, k)) out.push({ k, rival: true }); return out; };
    // v7.2.0 反壟斷法:第一次拆分通過後生效,已經擁有三家以上產業的人不能再買;v9.7.0 鎮上可以再投票收緊到兩家(w.cycle.cap)
    const capOf = (w) => (w.cycle?.law ? (w.cycle.cap || 3) : Infinity);
    const canBuy = (w, id) => firmsOf(w, id).length < capOf(w);
    const payRate = (w, k) => { const v = S(w).pay[k]; return typeof v === 'number' ? v : 1; };
    // 有老闆的私人產業工人由老闆發薪;公職與公營產業由公庫發
    const privatePaid = (w, a) => { const k = JOB2S[a?.job?.key]; return !!k && !!ownerOf(w, k); };

    // ---------- 收錢 ----------
    // v9.7.0 兩家搶客人:人手多、服務好、價錢便宜的那家分到比較多;老闆名下店太多、自己顧不到的,服務會變差
    function quality(w, k, id, nWorkers) { const extra = Math.max(0, firmsOf(w, id).length - 2); return (1 + nWorkers) * Math.pow(0.85, extra); }
    function shareOf(w, k) {
        const R = rivalOf(w, k); if (!R) return 0; const M = S(w); const ws = workersOf(w, k);
        const nr = ws.filter(a => R.emp?.[a.agentId]).length, ni = ws.length - nr;
        const pi = M.price?.[k] ?? 1, pr = R.price ?? 1;
        const ai = quality(w, k, M.owners[k], ni) / (pi * pi), ar = quality(w, k, R.owner, nr) / (pr * pr);
        return Math.round(ar / Math.max(1e-6, ai + ar) * 1000) / 1000;
    }
    // 打折省下來的錢回到買東西的村民手上(隨機一位大人):這就是競爭的好處,錢不會憑空消失
    function rebate(w, n) { if (!(n > 0)) return; const c = w._mkAdults && w._mkAdults.t === w.tickCount ? w._mkAdults.l : (w._mkAdults = { t: w.tickCount, l: npcs(w).filter(a => (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_')) }).l; /* 路過的訪客不算 */ const a = c[Math.floor(Math.random() * c.length)]; if (a) addId(w, a.agentId, n); else toTown(w, n, t('折扣')); const M = S(w); M.saved = Math.round(((M.saved || 0) + n) * 100) / 100; }
    function sellTo(w, k, n, why, id, price, R) {
        n = Math.round(n * 100) / 100; if (!(n > 0)) return; const M = S(w);
        const kept = Math.round(n * Math.min(1, price) * 100) / 100; rebate(w, Math.round((n - kept) * 100) / 100);
        if (R) R.rev = (R.rev || 0) + kept; else M.rev[k] = (M.rev[k] || 0) + kept;
        const tax = Math.round(kept * TAX * 100) / 100; toTown(w, tax, t('營業稅')); addId(w, id, Math.round((kept - tax) * 100) / 100);
    }
    function sell(w, k, n, why) {
        n = Math.round(n * 100) / 100; if (!(n > 0)) return; const M = S(w);
        const R = rivalOf(w, k); if (R) { const nr = Math.round(n * shareOf(w, k) * 100) / 100; sellTo(w, k, Math.round((n - nr) * 100) / 100, why, M.owners[k], M.price?.[k] ?? 1, null); sellTo(w, k, nr, why, R.owner, R.price ?? 1, R); return; }
        M.rev[k] = (M.rev[k] || 0) + n;
        const id = ownerOf(w, k); if (!id) { toTown(w, n, why || t('公營收入')); return; }
        const tax = Math.round(n * TAX * 100) / 100; toTown(w, tax, t('營業稅')); // v8.8.0 算到「分」,稅＋老闆實拿剛好等於客人付的錢 const Wl = W(w); if (Wl) Wl.stats.bizTax = Math.round(((Wl.stats.bizTax || 0) + tax) * 10) / 10;
        addId(w, id, n - tax);
    }
    // 一筆消費(三餐、衣服、柴火、消費)
    function sale(w, kind, n) {
        const parts = SPLIT[kind] || [['trade', 1]]; const all = npcs(w);
        // 鎮上沒有廚師就自己煮:三餐的錢全付給農莊
        if (kind === 'meal' && !workersOf(w, 'kitchen', all).length && !ownerOf(w, 'kitchen')) return sell(w, 'farm', n, t('餐費'));
        let left = Math.round(n * 100) / 100; parts.forEach(([k, f], i) => { const v = i === parts.length - 1 ? left : Math.round(n * f * 100) / 100; left = Math.round((left - v) * 100) / 100; sell(w, k, v, t('村民消費')); }); // v8.8.0 拆帳最後一份拿剩下的,不會多出或少掉零頭
    }
    // 公庫的工程款、維護費:六成付給本地承包商(依工人數分)
    function procure(w, n) {
        if (!(n > 0)) return 0; const all = npcs(w); const ws = BUILD.map(([k, f]) => [k, f * (workersOf(w, k, all).length ? 1 : 0)]); const tot = ws.reduce((s, [, f]) => s + f, 0); let paid = 0;
        if (tot) for (const [k, f] of ws) if (f) { const v = Math.round(n * PROCURE_SHARE * f / tot * 100) / 100; sell(w, k, v, t('公共工程款')); paid += v; } // 算到分:sell 付出去的就是這個數(以前記帳用沒捨入的數,每次差幾厘)
        try { if (typeof MONEY !== 'undefined' && Math.abs(n - paid) > 1e-6) MONEY.flow(w, 'works', -(n - paid)); } catch (e) {} // v7.7.0 外地包商拿走的部分
        return paid;
    }

    // ---------- 發薪 ----------
    function payroll(w, Wl, all) {
        const M = S(w); const tax = Wl.tax || 0; const floorNet = Wl.minWage || 0;
        for (const k of Object.keys(SECTORS)) {
            const id = ownerOf(w, k); if (!id) continue; const boss = w.agents[id];
            if ((M.strike?.[k] || -1) >= day(w)) continue; // v6.90.0 罷工期間沒上工、也沒工資
            const jail = typeof MONEY !== 'undefined' && MONEY.laborSet ? MONEY.laborSet(w) : null; // v7.7.2 服公共勞役的人沒工資
            const R = rivalOf(w, k); // v9.7.0 對手店的工人由對手老闆發薪
            if (R) { const rws = workersOf(w, k, all).filter(a => R.emp?.[a.agentId] && a.agentId !== R.owner && !(jail && jail.has(a.agentId))); if (rws.length) payFirm(w, Wl, k, R.owner, rws, R.pay ?? 1, R); }
            const ws = workersOf(w, k, all).filter(a => a.agentId !== id && !(R && R.emp?.[a.agentId]) && !(typeof UNION !== 'undefined' && UNION.idle(w, a)) && !(jail && jail.has(a.agentId))); if (!ws.length) continue; // v6.93.0 罷工中的會員、被開除的人沒工資
            payFirm(w, Wl, k, id, ws, payRate(w, k), null);
        }
    }
    function payFirm(w, Wl, k, id, ws, rate, R) {
        const M = S(w); const tax = Wl.tax || 0; const floorNet = Wl.minWage || 0; const boss = w.agents[id]; {
            const gross = ws.map(a => Math.max((WALLET.WAGE[a.job.key] || 4) * (a._wageMult || 1) * (a._edu ? 1.15 : 1) * (WALLET.wageIdx ? WALLET.wageIdx() : 1) * rate, floorNet > 0 ? floorNet / Math.max(0.01, 1 - tax) : 0));
            const total = gross.reduce((s, g) => s + g, 0); const have = bal(w, id);
            const ratio = have >= total ? 1 : Math.max(0, have / total);
            // v8.8.0 算到「分」:老闆付出去的剛好等於工人拿到的＋所得稅
            let gs = gross.map(g => Math.round(g * ratio * 100) / 100); let tot = Math.round(gs.reduce((s, g) => s + g, 0) * 100) / 100;
            if (tot > have) { gs = gross.map(g => Math.floor(g * ratio * 100) / 100); tot = Math.round(gs.reduce((s, g) => s + g, 0) * 100) / 100; }
            if (!(tot > 0 && takeId(w, id, tot))) { gs = gs.map(() => 0); tot = 0; }
            if (R) R.cost = (R.cost || 0) + tot; else M.cost[k] = (M.cost[k] || 0) + tot;
            ws.forEach((a, i) => {
                const g = gs[i]; const tx = Math.round(g * tax * 100) / 100; addId(w, a.agentId, Math.round((g - tx) * 100) / 100); toTown(w, tx, t('所得稅'));
                Wl.stats.wages += g * (1 - tax); Wl.stats.taxes += g * tax;
                if (ratio < 1) { a.addThought?.('boss_unpaid', w); if (Math.random() < 0.4) mem(w, a, ratio > 0 ? '{o}只發得出 {p}% 的工資，這樣怎麼過日子。' : '{o}說週轉不過來，今天的工資沒著落。', { o: boss?.name || '', p: Math.round(ratio * 100) }, 5); }
            });
            M.unpaid[id] = ratio < 1 ? (M.unpaid[id] || 0) + 1 : 0;
        }
    }

    // ---------- 每天:產權、調薪、挨餓 ----------
    function daily(w, Wl, all) {
        const M = S(w), d = day(w); if (M.lastDay === d) return; M.lastDay = d;
        // 記帳:每天的營收與工資支出,留七天
        for (const k of Object.keys(SECTORS)) { const h = M.hist[k] = (M.hist[k] || []); h.push([Math.round((M.rev[k] || 0) * 10) / 10, Math.round((M.cost[k] || 0) * 10) / 10]); if (h.length > 7) h.shift(); M.rev[k] = 0; M.cost[k] = 0;
            const R = M.rival?.[k]; if (R) { R.hist = R.hist || []; R.hist.push([Math.round((R.rev || 0) * 10) / 10, Math.round((R.cost || 0) * 10) / 10]); if (R.hist.length > 7) R.hist.shift(); R.rev = 0; R.cost = 0; } }
        assign(w, all, d);
        if (d % 7 === 0) { corpTax(w, all); adjust(w, all); unrest(w, all, d); risk(w, all); }
        endStrikes(w, all, d);
        hunger(w, all, byWork(w));
    }
    // 產業估價:底價＋每個工人＋最近一週的利潤。公營產業的工資由公庫付、帳上看不到,要用估計的工資扣掉(以前漏扣,估價虛高到沒人買得起)
    const value = (w, k, all) => { const h = S(w).hist[k] || []; const ws = workersOf(w, k, all); const owned = !!ownerOf(w, k);
        const wageBill = ws.reduce((s, a) => s + (WALLET.WAGE[a.job?.key] || 4), 0) * (WALLET.wageIdx ? WALLET.wageIdx() : 1) * h.length;
        const prof = h.reduce((s, [r, c]) => s + r * (1 - TAX) - (owned ? c : 0), 0) - (owned ? 0 : wageBill);
        return Math.round(40 + ws.length * 12 + Math.max(0, prof) * 0.5); };
    function assign(w, all, d) {
        const M = S(w);
        for (const k of Object.keys(SECTORS)) {
            const ws = workersOf(w, k, all); let id = ownerOf(w, k);
            if (M.owners[k] && !id) M.owners[k] = null; // 老闆搬走了
            // v9.7.0 原本那家的老闆走了,對面的對手店接手成為鎮上這一行唯一的店
            { const R = M.rival?.[k]; if (R && !id && present(w, R.owner)) { M.owners[k] = R.owner; M.pay[k] = R.pay ?? 1; M.price = M.price || {}; M.price[k] = R.price ?? 1; delete M.rival[k]; id = R.owner; log(w, '🏪 {s}原本的老闆不在了，{o}的店成了鎮上唯一的一家。', { s: name(k), o: w.agents[R.owner]?.name || '' }, w.agents[R.owner]?.name || ''); }
              else if (R && !present(w, R.owner)) delete M.rival[k]; }
            // 週轉不靈:老闆沒錢、連欠三天以上 → 賣給出得起錢的人
            if (id && M.unpaid[id] >= 3 && bal(w, id) < 2) {
                const price = value(w, k, all); const buyer = all.filter(a => a.agentId !== id && bal(w, a.agentId) >= price && canBuy(w, a.agentId)).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
                if (buyer) { takeId(w, buyer.agentId, price); addId(w, id, price); M.owners[k] = buyer.agentId; if (M.rival?.[k]?.owner === buyer.agentId) delete M.rival[k]; /* 對手買下原本那家:兩家併成一家 */ M.pay[k] = has(buyer, 'greedy') ? 0.85 : 1; M.unpaid[id] = 0; const old = w.agents[id];
                    log(w, '📉 {o}週轉不靈，把{s}以 {n} 銀幣賣給了{b}。', { o: old?.name || '', s: name(k), n: price, b: buyer.name }, buyer.name);
                    mem(w, old, '撐不下去了，只好把{s}賣給{b}。', { s: name(k), b: buyer.name }, 8); mem(w, buyer, '我用 {n} 銀幣買下了{s}。', { n: price, s: name(k) }, 7); }
                continue;
            }
            if (id || !ws.length) continue;
            // 公營產業標售:同行裡最有錢的人優先,不然由手頭最寬裕的人出資
            const price = value(w, k, all);
            const inside = ws.filter(a => bal(w, a.agentId) >= price && canBuy(w, a.agentId)).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
            const investor = inside || all.filter(a => bal(w, a.agentId) >= price * 2 && canBuy(w, a.agentId)).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
            if (!investor) continue;
            takeId(w, investor.agentId, price); toTown(w, price, t('公營產業標售')); M.owners[k] = investor.agentId; M.pay[k] = has(investor, 'greedy') ? 0.85 : 1;
            log(w, '🏪 {o}出 {n} 銀幣買下了鎮上的{s}，當上了老闆。', { o: investor.name, n: price, s: name(k) }, investor.name);
            mem(w, investor, '我買下了{s}，從今天起是老闆了。', { s: name(k) }, 8);
        }
    }
    // 每週營所稅:照利潤課;吝嗇或不老實的老闆少報(約只報六成),上班族的薪資稅是扣繳的、少報不了
    function corpTax(w, all) {
        const M = S(w); M.corp = M.corp || { paid: 0, evaded: 0 };
        const byOwner = {};
        for (const k of Object.keys(SECTORS)) { const id = ownerOf(w, k); if (!id) continue; const h = M.hist[k] || []; const prof = h.reduce((s, [r, c]) => s + r * (1 - TAX) - c, 0); if (prof > 0) byOwner[id] = (byOwner[id] || 0) + prof; }
        for (const [id, prof] of Object.entries(byOwner)) {
            const a = w.agents[id]; const shady = a && (has(a, 'greedy') || (a.personality?.values || []).includes('財富') || a.dark?.liar);
            const reported = prof * (shady ? 0.6 : 1); const due = Math.round(reported * CORP * 100) / 100; const pay = Math.min(due, bal(w, id));
            if (pay > 0 && takeId(w, id, pay)) { toTown(w, pay, t('營利事業所得稅')); M.corp.paid += pay; }
            if (shady) { M.corp.evaded += Math.round((prof - reported) * CORP * 100) / 100; if (a && Math.random() < 0.3) mem(w, a, '這週帳上少報了一些，稅繳得比較少。', {}, 4); }
        }
    }
    // 每週調薪:虧錢就砍薪;吝嗇的老闆一直壓;賺很多、心腸好的老闆加一點
    function adjust(w, all) {
        const M = S(w);
        for (const k of Object.keys(SECTORS)) {
            const id = ownerOf(w, k); if (!id) continue; const boss = w.agents[id]; const h = M.hist[k] || []; if (h.length < 5) continue;
            const rev = h.reduce((s, x) => s + x[0], 0), cost = h.reduce((s, x) => s + x[1], 0); const old = payRate(w, k); let nv = old;
            if (rev * (1 - TAX) < cost) nv = Math.max(0.5, old - 0.1);
            else if (boss && has(boss, 'greedy')) nv = Math.max(0.6, old - 0.05);
            else if (boss && (has(boss, 'kind') || has(boss, 'generous')) && rev * (1 - TAX) > cost * 1.6) nv = Math.min(1.2, old + 0.05);
            nv = Math.round(nv * 100) / 100; if (nv === old) continue; M.pay[k] = nv;
            const p = Math.round(nv * 100);
            if (nv < old) { log(w, '✂️ {o}的{s}把工資砍到原本的 {p}%。', { o: boss?.name || '', s: name(k), p }, boss?.name || ''); for (const a of workersOf(w, k, all)) if (a.agentId !== id && Math.random() < 0.5) { mem(w, a, '{o}又把工資砍了，現在只剩原本的 {p}%。', { o: boss?.name || '', p }, 6); const r = a.relationships?.getOrCreate?.(id, boss?.name || ''); r?.modifyAffinity?.(-4); } }
            else for (const a of workersOf(w, k, all)) if (a.agentId !== id && Math.random() < 0.4) mem(w, a, '{o}給大家加薪了。', { o: boss?.name || '' }, 4);
        }
    }
    // v6.90.0 罷工:工資被壓到七成以下、工人心情又差,就罷工兩天;老闆通常讓步加薪(吝嗇的不一定)
    function unrest(w, all, d) {
        const M = S(w); M.strike = M.strike || {};
        for (const k of Object.keys(SECTORS)) {
            const id = ownerOf(w, k); if (!id || (M.strike[k] || -1) >= d) continue; const ws = workersOf(w, k, all).filter(a => a.agentId !== id && !isRivalEmp(w, k, a)); if (ws.length < 4) continue; // v9.7.0 對手店的工人不跟著罷工
            // v9.6.0 工資壓在七成以下超過三週,心情再好也忍不下去(以前要心情低於 48 才罷工,一整年幾乎沒人罷工,工資一直卡在五成)
            M.low = M.low || {}; if (payRate(w, k) > 0.7) { delete M.low[k]; continue; } if (M.low[k] == null) M.low[k] = d;
            if (typeof UNION !== 'undefined' && w.union?.on && ws.filter(a => UNION.isMember(w, a)).length >= Math.max(2, ws.length / 2)) continue; // v9.9.1 這一行過半是工會會員:交給工會談判、由工會罷工(以前兩套罷工會同時發生)
            const mood = ws.reduce((s, a) => s + (a.mood || 50), 0) / ws.length; if ((mood > 48 && d - M.low[k] < 21) || Math.random() > 0.5) continue;
            M.strike[k] = d + 2; M.strikes = (M.strikes || 0) + 1; const boss = w.agents[id];
            log(w, '✊ {s}的 {n} 個工人罷工了，要求{o}加薪。', { s: name(k), n: ws.length, o: boss?.name || '' }, boss?.name || '');
            for (const a of ws) mem(w, a, '我們{s}的人一起罷工，工資再這樣壓下去活不下去。', { s: name(k) }, 7);
        }
    }
    function endStrikes(w, all, d) {
        const M = S(w); if (!M.strike) return;
        for (const [k, until] of Object.entries(M.strike)) {
            if (until !== d - 1) continue; const id = ownerOf(w, k); const boss = id && w.agents[id]; if (!boss) continue;
            if (!has(boss, 'greedy') || Math.random() < 0.4) { M.pay[k] = Math.min(1.1, Math.round((payRate(w, k) + 0.15) * 100) / 100); log(w, '🤝 {o}讓步了，{s}的工資調回原本的 {p}%。', { o: boss.name, s: name(k), p: Math.round(M.pay[k] * 100) }, boss.name); }
            else log(w, '😠 {o}不肯讓步，{s}的工人只好回去上工。', { o: boss.name, s: name(k) }, boss.name);
        }
    }
    // v6.90.0 經營風險:每週每家產業有小機率出事(火災、壞帳、貨物被偷),老闆自己吸收損失
    const RISKS = ['🔥 {o}的{s}失火，損失 {n} 銀幣。', '📉 {o}的{s}被客人倒帳，損失 {n} 銀幣。', '🦹 {o}的{s}遭小偷，損失 {n} 銀幣。'];
    function risk(w, all) {
        for (const k of Object.keys(SECTORS)) {
            const id = ownerOf(w, k); if (!id || Math.random() > 0.04) continue; const boss = w.agents[id]; if (!boss) continue;
            const loss = Math.round(Math.min(bal(w, id) * 0.25, value(w, k, all) * 0.6)); if (loss < 5 || !takeId(w, id, loss)) continue;
            const ri = Math.floor(Math.random() * RISKS.length); log(w, RISKS[ri], { o: boss.name, s: name(k), n: loss }, boss.name); mem(w, boss, '{s}出了事，賠了 {n} 銀幣。', { s: name(k), n: loss }, 7);
            if (ri === 0 && typeof LEGACY !== 'undefined' && LEGACY.incident) { try { const pl = typeof JOB_DEFINITIONS !== 'undefined' ? JOB_DEFINITIONS[SECTORS[k].jobs[0]]?.workplace : null; if (pl) LEGACY.incident(w, 'curse', pl, { p: typeof locName === 'function' ? locName(w, pl) : pl }); } catch (e) {} } // v9.9.2 失火的地方被說「不乾淨」
            // v8.8.0 賠掉的錢不會憑空消失:失火的修繕費給工匠、倒帳的錢留在欠債的客人手上、被偷的進了小偷口袋(都找不到人就進公庫)
            { const others = all.filter(a => a !== boss && !a.isDead && (a.age ?? 30) >= 16); const pick = (L) => L[Math.floor(Math.random() * L.length)];
              const to = ri === 0 ? pick(others.filter(a => ['builder', 'carpenter'].includes(a.job?.key))) : ri === 2 ? pick(others.filter(a => has(a, 'greedy') || a.dark?.liar)) || pick(others.slice().sort((x, y) => bal(w, x.agentId) - bal(w, y.agentId)).slice(0, 5)) : pick(others);
              if (to) addId(w, to.agentId, loss); else toTown(w, loss, t('修繕與賠償')); }
        }
    }
    const onStrike = (w, a) => { const k = JOB2S[a?.job?.key]; const M = w.market; if (typeof UNION !== 'undefined' && UNION.idle(w, a)) return true; /* v6.93.0 工會罷工的會員、被開除的人不上工 */ return !!(k && M?.strike && (M.strike[k] || -1) >= day(w) && ownerOf(w, k) !== a.agentId); };
    // 沒錢就真的吃不到:先找家人接濟
    function family(w, a) {
        const out = new Set(); const R = a.relationships?.relationships || {};
        for (const id in R) { const r = R[id]; const o = w.agents[id]; if (o && !o.isDead && (r.status === 'married' || r.status === 'dating')) out.add(o); }
        for (const o of npcs(w)) if (o !== a && ((a._parentNames || []).includes(o.name) || (o._parentNames || []).includes(a.name))) out.add(o); // 爸媽、子女
        return [...out];
    }
    function feed(w, a, cost) {
        const kid = (a.age ?? 30) < 16; // v7.7.0 小孩的飯錢先由家人出
        if (!kid && WALLET.take(w, a, cost)) return a;
        const helper = family(w, a).filter(o => WALLET.get(w, o) >= cost + 3).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0];
        if (helper && WALLET.take(w, helper, cost)) { if (!kid && Math.random() < 0.25) { mem(w, a, '身上沒錢，靠{h}接濟才吃上飯。', { h: helper.name }, 5); mem(w, helper, '{a}手頭緊，我幫忙出了飯錢。', { a: a.name }, 4); } return helper; }
        if (kid && WALLET.take(w, a, cost)) return a;
        return null;
    }
    const isHungry = (w, a) => (S(w).hungry[a.agentId] || 0);
    function markFed(w, a, fed) { const M = S(w); if (fed) delete M.hungry[a.agentId]; else M.hungry[a.agentId] = (M.hungry[a.agentId] || 0) + 1; }
    // v9.23.0 餓到活不下去時要不要離鄉，交給本人決定(sim-decide-work.js)；擲骰的版本留給直接呼叫 hunger() 的情況
    const byWork = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.work && !!DECIDE.on?.(w); } catch (e) { return false; } };
    function leaveHungry(w, a) {
        const M = S(w); if (!a || (a.age || 30) < 16 || !w.leaveTown) return false; M.left = (M.left || 0) + 1;
        log(w, '🎒 {a}在鎮上活不下去，收拾行李去別處討生活。', { a: a.name }, a.name);
        try { return !!w.leaveTown(a.agentId, t('在鎮上活不下去，去別處討生活')); } catch (e) { return false; }
    }
    function hunger(w, all, ch) {
        const M = S(w);
        for (const id of Object.keys(M.hungry)) if (!w.agents[id]) delete M.hungry[id];
        for (const a of all) {
            const h = M.hungry[a.agentId] || 0; if (h < 3) continue;
            a.addThought?.('starving', w); a.needs && (a.needs.hunger = Math.min(a.needs.hunger ?? 0, 10));
            if (h === 3 && Math.random() < 0.6) mem(w, a, '已經好幾天沒吃飽了，做事都沒力氣。', {}, 7);
            if (h < 7) continue;
            const frail = (a.age || 30) < 14 || (a.age || 30) >= 65 ? 1.5 : 1;
            const pDie = Math.min(0.12, 0.03 + (h - 7) * 0.01) * frail;
            if (Math.random() < pDie && w.lifecycle?._killNpc) {
                a._deathCause = t('餓死'); M.deaths = (M.deaths || 0) + 1;
                log(w, '💀 {a}餓了 {n} 天，沒撐過去。', { a: a.name, n: h }, a.name);
                try { w.lifecycle._killNpc(w, a); } catch (e) { console.warn('[Market] starve', e); }
                continue;
            }
            if (!ch && (a.age || 30) >= 16 && Math.random() < 0.05 && w.leaveTown) leaveHungry(w, a);
        }
    }
    // 老闆過世:配偶或成年子女繼承
    function heirsOf(w, a) {
        return npcs(w).filter(o => o !== a && (o.relationships?.relationships?.[a.agentId]?.status === 'married' || ((o._parentNames || []).includes(a.name) && (o.age || 0) >= 16))) /* v9.7.4 交往中的不算繼承人 */
            .sort((x, y) => (y.relationships?.relationships?.[a.agentId]?.status === 'married') - (x.relationships?.relationships?.[a.agentId]?.status === 'married') || (y.age || 0) - (x.age || 0));
    }
    // v9.9.6 繼承人也算出遠門的家人:產業記在他名下,回來就是他的;記憶寫進他的行李(以前出遠門的人分不到店、房子、股份)
    function awayHeir(d, wed) {
        return { agentId: d.agentId, name: d.name, age: d.age, _travel: true, _wed: wed, isDead: false,
            memory: { addT(tick, time, cat, k, p, imp, rel) { try { (d.memories || (d.memories = [])).push({ tick, time, category: cat, content: Memory.render(k, p || {}), importance: imp || 5, related_agents: rel || [], k, p: p || {} }); } catch (e) {} } } };
    }
    function heirsAll(w, a) {
        const out = ((typeof MARKET !== 'undefined' && MARKET.heirsOf) || heirsOf)(w, a).slice();
        for (const tr of (w.events?._travellingAgents || [])) { const d = tr?.agentData; if (!d?.agentId || w.agents?.[d.agentId] || !a) continue;
            const st = (d.relationships || []).find(x => (x.target_id || x.targetId) === a.agentId)?.status;
            if (st === 'married' || ((d._parentNames || []).includes(a.name) && (d.age || 0) >= 16)) out.push(awayHeir(d, st === 'married')); }
        const wed = (o) => o._travel ? !!o._wed : o.relationships?.relationships?.[a.agentId]?.status === 'married';
        return out.sort((x, y) => wed(y) - wed(x) || (y.age || 0) - (x.age || 0));
    }
    function brief(w, a) {
        const out = []; const own = ownedBy(w, a.agentId).filter(k => S(w).owners[k]);
        if (own.length) { const n = own.reduce((s, k) => s + workersOf(w, k).filter(x => x.agentId !== a.agentId).length, 0); out.push(t('你是{s}的老闆，僱了 {n} 個人，工資開原本的 {p}%。').replace('{s}', own.map(name).join(t('、'))).replace('{n}', n).replace('{p}', Math.round(own.reduce((s, k) => s + payRate(w, k), 0) / own.length * 100))); }
        else { const k = JOB2S[a.job?.key]; const id = k && ownerOf(w, k); if (id && id !== a.agentId) out.push(t('你在{o}的{s}做工，工資是原本的 {p}%。').replace('{o}', t(w.agents[id]?.name || '')).replace('{s}', name(k)).replace('{p}', Math.round(payRate(w, k) * 100))); }
        const h = isHungry(w, a); if (h >= 2) out.push(t('你已經 {n} 天沒吃飽了。').replace('{n}', h));
        return out.join(' ');
    }
    // 給觀察者看的(第三人稱)
    function describe(w, a) {
        const out = []; const own = ownedBy(w, a.agentId).filter(k => S(w).owners[k]);
        if (own.length) { const n = own.reduce((s, k) => s + workersOf(w, k).filter(x => x.agentId !== a.agentId).length, 0); out.push(t('{s}的老闆，僱了 {n} 個人，工資開原本的 {p}%').replace('{s}', own.map(name).join(t('、'))).replace('{n}', n).replace('{p}', Math.round(own.reduce((s, k) => s + payRate(w, k), 0) / own.length * 100))); }
        else { const k = JOB2S[a.job?.key]; const id = k && ownerOf(w, k); if (id && id !== a.agentId) out.push(t('在{o}的{s}做工，工資是原本的 {p}%').replace('{o}', t(w.agents[id]?.name || '')).replace('{s}', name(k)).replace('{p}', Math.round(payRate(w, k) * 100))); else if (PUBLIC.includes(a.job?.key)) out.push(t('公職，薪水由公庫發')); }
        const h = isHungry(w, a); if (h >= 1) out.push(t('已經 {n} 天沒吃飽').replace('{n}', h));
        return out.join(t('；'));
    }
    function view(w) {
        const all = npcs(w);
        return Object.keys(SECTORS).map(k => { const id = ownerOf(w, k); const h = S(w).hist[k] || []; return { k, icon: SECTORS[k].icon, name: name(k), owner: id ? t(w.agents[id]?.name || '') : '', ownerId: id, workers: workersOf(w, k, all).length, pay: Math.round(payRate(w, k) * 100), rev7: Math.round(h.reduce((s, x) => s + x[0], 0)), cost7: Math.round(h.reduce((s, x) => s + x[1], 0)) }; }).filter(x => x.workers || x.owner);
    }
    function gini(w) {
        const v = npcs(w).map(a => bal(w, a.agentId)).sort((x, y) => x - y); const n = v.length; const s = v.reduce((x, y) => x + y, 0); if (!n || !s) return 0;
        let c = 0; v.forEach((x, i) => { c += (2 * (i + 1) - n - 1) * x; }); return Math.round(c / (n * s) * 100) / 100;
    }
    return { canBuy, rivalOf, isRivalEmp, firmsOf, capOf, shareOf, quality, rebate, SECTORS, PUBLIC, JOB2S, SPLIT, S, sell, sale, procure, payroll, daily, assign, adjust, feed, markFed, isHungry, hunger, leaveHungry, byWork, heirsOf, heirsAll, ownerOf, ownedBy, workersOf, payRate, privatePaid, brief, describe, view, gini, name, value, corpTax, unrest, endStrikes, risk, onStrike, TAX, CORP, PROCURE_SHARE };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    boss_unpaid: { mood: -7, opinion: 0, days: 3, label: t('老闆發不出工資') },
    starving:    { mood: -12, opinion: 0, days: 2, label: t('好幾天沒吃飽') },
});
// 老闆過世:配偶或成年子女繼承產業
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let own = [], heir = null, rivals = [];
        try { if (world.market && npc) { own = MARKET.ownedBy(world, npc.agentId); rivals = Object.keys(world.market.rival || {}).filter(k => world.market.rival[k]?.owner === npc.agentId); if (own.length || rivals.length) heir = MARKET.heirsAll(world, npc)[0] || null; } } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        try {
            if (own.length) { const M = MARKET.S(world); for (const k of own) M.owners[k] = heir ? heir.agentId : null;
                if (heir) { world.logMessageT?.('economy', '🏪 {h}繼承了{o}留下的{s}。', { h: heir.name, o: npc.name, s: own.map(MARKET.name).join(t('、')) }, heir.name); heir.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '我繼承了{o}留下的{s}。', { o: npc.name, s: own.map(MARKET.name).join(t('、')) }, 8, [npc.name]); } }
            // v9.7.4 對面那家(競爭店)也由家人接手;繼承人剛好是原本那家的老闆就併成一家;沒人繼承就收掉
            if (rivals.length) { const M = MARKET.S(world);
                for (const k of rivals) { const R = M.rival?.[k]; if (!R) continue;
                    if (heir && M.owners[k] === heir.agentId) { delete M.rival[k]; world.logMessageT?.('economy', '🏪 {h}繼承了{o}在對面開的{s}，兩家併成一家。', { h: heir.name, o: npc.name, s: MARKET.name(k) }, heir.name); }
                    else if (heir) { R.owner = heir.agentId; world.logMessageT?.('economy', '🏪 {h}接手了{o}在對面開的{s}。', { h: heir.name, o: npc.name, s: MARKET.name(k) }, heir.name); heir.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '我接手了{o}開的{s}。', { o: npc.name, s: MARKET.name(k) }, 8, [npc.name]); }
                    else { const pt = Object.entries(R.sh || {}).filter(([id]) => id !== npc.agentId && world.agents[id] && id !== M.owners[k]).sort((a, b) => b[1] - a[1])[0]; // v9.8.0 合夥開的店:股份最多的合夥人接手
                        if (pt) { R.owner = pt[0]; const a = world.agents[pt[0]]; world.logMessageT?.('economy', '🤝 {o}過世了，合夥的{a}接手了那家{s}，店繼續開。', { o: npc.name, a: a.name, s: MARKET.name(k) }, a.name); a.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '{o}走了，我接手我們合夥開的{s}。', { o: npc.name, s: MARKET.name(k) }, 8, [npc.name]); }
                        else { delete M.rival[k]; world.logMessageT?.('economy', '🏪 {o}過世後沒有家人接手，對面那家{s}關門了。', { o: npc.name, s: MARKET.name(k) }, npc.name); } } } }
            // v9.7.4 繼承後超過反壟斷上限:照法律限期賣掉多的(實際出售由每週的反壟斷檢查處理)
            if (heir && (own.length || rivals.length) && world.cycle?.law && MARKET.firmsOf && MARKET.capOf) { const n = MARKET.firmsOf(world, heir.agentId).length, cap = MARKET.capOf(world); if (n > cap) world.logMessageT?.('economy', '⚖️ {h}繼承後名下有 {n} 家店，超過反壟斷法的上限 {c} 家，得限期賣掉多的。', { h: heir.name, n, c: cap }, heir.name); }
            if (world.market?.hungry) delete world.market.hungry[npc.agentId];
        } catch (e) {}
        return r;
    };
}
// 公庫的工程款、維護費、提案花費:大半付給本地承包商(不再憑空消失);發給村民的補助、救濟、還債不算
if (typeof Stockpile !== 'undefined') {
    const SP = Stockpile.prototype; const _consume = SP.consume;
    SP.consume = function (r, amount, tick = 0, reason = '', source = '') {
        const ok = _consume.call(this, r, amount, tick, reason, source);
        try {
            const w = this._world;
            if (ok && r === 'silver' && amount > 0 && w && w.market && w.observerMode) {
                const why = String(reason || '');
                const transfer = why === t('生活補助') || why === t('救濟金') || why === t('償還紓困債') || why === t('發薪水');
                if (!transfer && (source === 'upkeep' || source === 'proposal' || why.startsWith('Building:'))) MARKET.procure(w, amount);
            }
        } catch (e) {}
        return ok;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.market && MARKET.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.market = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.market) d.market = this.market; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.market = (data?.market && typeof data.market.owners === 'object') ? data.market : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.MARKET = MARKET;
