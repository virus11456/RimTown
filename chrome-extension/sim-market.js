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
    const payRate = (w, k) => { const v = S(w).pay[k]; return typeof v === 'number' ? v : 1; };
    // 有老闆的私人產業工人由老闆發薪;公職與公營產業由公庫發
    const privatePaid = (w, a) => { const k = JOB2S[a?.job?.key]; return !!k && !!ownerOf(w, k); };

    // ---------- 收錢 ----------
    function sell(w, k, n, why) {
        if (!(n > 0)) return; const M = S(w); M.rev[k] = (M.rev[k] || 0) + n;
        const id = ownerOf(w, k); if (!id) { toTown(w, n, why || t('公營收入')); return; }
        const tax = n * TAX; toTown(w, tax, t('營業稅')); const Wl = W(w); if (Wl) Wl.stats.bizTax = Math.round(((Wl.stats.bizTax || 0) + tax) * 10) / 10;
        addId(w, id, n - tax);
    }
    // 一筆消費(三餐、衣服、柴火、消費)
    function sale(w, kind, n) {
        const parts = SPLIT[kind] || [['trade', 1]]; const all = npcs(w);
        // 鎮上沒有廚師就自己煮:三餐的錢全付給農莊
        if (kind === 'meal' && !workersOf(w, 'kitchen', all).length && !ownerOf(w, 'kitchen')) return sell(w, 'farm', n, t('餐費'));
        for (const [k, f] of parts) sell(w, k, n * f, t('村民消費'));
    }
    // 公庫的工程款、維護費:六成付給本地承包商(依工人數分)
    function procure(w, n) {
        if (!(n > 0)) return; const all = npcs(w); const ws = BUILD.map(([k, f]) => [k, f * (workersOf(w, k, all).length ? 1 : 0)]); const tot = ws.reduce((s, [, f]) => s + f, 0); if (!tot) return;
        for (const [k, f] of ws) if (f) sell(w, k, n * PROCURE_SHARE * f / tot, t('公共工程款'));
    }

    // ---------- 發薪 ----------
    function payroll(w, Wl, all) {
        const M = S(w); const tax = Wl.tax || 0; const floorNet = Wl.minWage || 0;
        for (const k of Object.keys(SECTORS)) {
            const id = ownerOf(w, k); if (!id) continue; const boss = w.agents[id];
            const ws = workersOf(w, k, all).filter(a => a.agentId !== id); if (!ws.length) continue;
            const rate = payRate(w, k);
            const gross = ws.map(a => Math.max((WALLET.WAGE[a.job.key] || 4) * rate, floorNet > 0 ? floorNet / Math.max(0.01, 1 - tax) : 0));
            const total = gross.reduce((s, g) => s + g, 0); const have = bal(w, id);
            const ratio = have >= total ? 1 : Math.max(0, have / total);
            if (ratio > 0) takeId(w, id, total * ratio);
            M.cost[k] = (M.cost[k] || 0) + total * ratio;
            ws.forEach((a, i) => {
                const g = gross[i] * ratio; addId(w, a.agentId, g * (1 - tax)); toTown(w, g * tax, t('所得稅'));
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
        for (const k of Object.keys(SECTORS)) { const h = M.hist[k] = (M.hist[k] || []); h.push([Math.round((M.rev[k] || 0) * 10) / 10, Math.round((M.cost[k] || 0) * 10) / 10]); if (h.length > 7) h.shift(); M.rev[k] = 0; M.cost[k] = 0; }
        assign(w, all, d);
        if (d % 7 === 0) { corpTax(w, all); adjust(w, all); }
        hunger(w, all);
    }
    // 產業估價:底價＋每個工人＋最近一週的利潤。公營產業的工資由公庫付、帳上看不到,要用估計的工資扣掉(以前漏扣,估價虛高到沒人買得起)
    const value = (w, k, all) => { const h = S(w).hist[k] || []; const ws = workersOf(w, k, all); const owned = !!ownerOf(w, k);
        const wageBill = ws.reduce((s, a) => s + (WALLET.WAGE[a.job?.key] || 4), 0) * h.length;
        const prof = h.reduce((s, [r, c]) => s + r * (1 - TAX) - (owned ? c : 0), 0) - (owned ? 0 : wageBill);
        return Math.round(40 + ws.length * 12 + Math.max(0, prof) * 0.5); };
    function assign(w, all, d) {
        const M = S(w);
        for (const k of Object.keys(SECTORS)) {
            const ws = workersOf(w, k, all); let id = ownerOf(w, k);
            if (M.owners[k] && !id) M.owners[k] = null; // 老闆搬走了
            // 週轉不靈:老闆沒錢、連欠三天以上 → 賣給出得起錢的人
            if (id && M.unpaid[id] >= 3 && bal(w, id) < 2) {
                const price = value(w, k, all); const buyer = all.filter(a => a.agentId !== id && bal(w, a.agentId) >= price).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
                if (buyer) { takeId(w, buyer.agentId, price); addId(w, id, price); M.owners[k] = buyer.agentId; M.pay[k] = has(buyer, 'greedy') ? 0.85 : 1; M.unpaid[id] = 0; const old = w.agents[id];
                    log(w, '📉 {o}週轉不靈，把{s}以 {n} 銀幣賣給了{b}。', { o: old?.name || '', s: name(k), n: price, b: buyer.name }, buyer.name);
                    mem(w, old, '撐不下去了，只好把{s}賣給{b}。', { s: name(k), b: buyer.name }, 8); mem(w, buyer, '我用 {n} 銀幣買下了{s}。', { n: price, s: name(k) }, 7); }
                continue;
            }
            if (id || !ws.length) continue;
            // 公營產業標售:同行裡最有錢的人優先,不然由手頭最寬裕的人出資
            const price = value(w, k, all);
            const inside = ws.filter(a => bal(w, a.agentId) >= price).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
            const investor = inside || all.filter(a => bal(w, a.agentId) >= price * 2).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
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
    // 沒錢就真的吃不到:先找家人接濟
    function family(w, a) {
        const out = new Set(); const R = a.relationships?.relationships || {};
        for (const id in R) { const r = R[id]; const o = w.agents[id]; if (o && !o.isDead && (r.status === 'married' || r.status === 'dating')) out.add(o); }
        for (const o of npcs(w)) if (o !== a && ((a._parentNames || []).includes(o.name) || (o._parentNames || []).includes(a.name))) out.add(o); // 爸媽、子女
        return [...out];
    }
    function feed(w, a, cost) {
        if (WALLET.take(w, a, cost)) return a;
        const helper = family(w, a).filter(o => WALLET.get(w, o) >= cost + 3).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0];
        if (helper && WALLET.take(w, helper, cost)) { if (Math.random() < 0.25) { mem(w, a, '身上沒錢，靠{h}接濟才吃上飯。', { h: helper.name }, 5); mem(w, helper, '{a}手頭緊，我幫忙出了飯錢。', { a: a.name }, 4); } return helper; }
        return null;
    }
    const isHungry = (w, a) => (S(w).hungry[a.agentId] || 0);
    function markFed(w, a, fed) { const M = S(w); if (fed) delete M.hungry[a.agentId]; else M.hungry[a.agentId] = (M.hungry[a.agentId] || 0) + 1; }
    function hunger(w, all) {
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
            if ((a.age || 30) >= 16 && Math.random() < 0.05 && w.leaveTown) { M.left = (M.left || 0) + 1; log(w, '🎒 {a}在鎮上活不下去，收拾行李去別處討生活。', { a: a.name }, a.name); try { w.leaveTown(a.agentId, t('在鎮上活不下去，去別處討生活')); } catch (e) {} }
        }
    }
    // 老闆過世:配偶或成年子女繼承
    function heirsOf(w, a) {
        return npcs(w).filter(o => o !== a && (['married', 'dating'].includes(o.relationships?.relationships?.[a.agentId]?.status) || ((o._parentNames || []).includes(a.name) && (o.age || 0) >= 16)))
            .sort((x, y) => (y.relationships?.relationships?.[a.agentId]?.status === 'married') - (x.relationships?.relationships?.[a.agentId]?.status === 'married') || (y.age || 0) - (x.age || 0));
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
    return { SECTORS, PUBLIC, JOB2S, SPLIT, S, sell, sale, procure, payroll, daily, assign, adjust, feed, markFed, isHungry, hunger, heirsOf, ownerOf, ownedBy, workersOf, payRate, privatePaid, brief, describe, view, gini, name, value, corpTax, TAX, CORP, PROCURE_SHARE };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    boss_unpaid: { mood: -7, opinion: 0, days: 3, label: t('老闆發不出工資') },
    starving:    { mood: -12, opinion: 0, days: 2, label: t('好幾天沒吃飽') },
});
// 老闆過世:配偶或成年子女繼承產業
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let own = [], heir = null;
        try { if (world.market && npc) { own = MARKET.ownedBy(world, npc.agentId); if (own.length) heir = MARKET.heirsOf(world, npc)[0] || null; } } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        try {
            if (own.length) { const M = MARKET.S(world); for (const k of own) M.owners[k] = heir ? heir.agentId : null;
                if (heir) { world.logMessageT?.('economy', '🏪 {h}繼承了{o}留下的{s}。', { h: heir.name, o: npc.name, s: own.map(MARKET.name).join(t('、')) }, heir.name); heir.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '我繼承了{o}留下的{s}。', { o: npc.name, s: own.map(MARKET.name).join(t('、')) }, 8, [npc.name]); } }
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
