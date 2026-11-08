// v6.54.0 個人錢包:鎮公庫(公家的錢與資源)和村民自己的銀幣分開
// - 有工作的人每天從公庫領工資(先扣稅);沒工作的人沒收入
// - 每天自己掏錢付三餐(一部分給廚師)、每十天買衣服(一部分給裁縫)、冬天買柴;付不起就吃不飽、穿不暖、會冷
// - 窮的人跟朋友借錢(真的有錢移動,到期還不還接上恩怨系統);有錢又大方的人請客、接濟、捐給公庫;窮人會眼紅
// - 提案可以提案人自掏腰包、找朋友湊錢、或公庫出;出錢的方式會影響支持度
// - 選舉時不老實又有錢的候選人會私下塞錢買票(上帝視角看得到)
const WALLET = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const day = (w) => w.proposals?._abs?.(w) ?? Math.floor((w.tickCount || 0) / 96);
    const mem = (w, a, k, p, imp = 4) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who); } catch (e) {} };
    const aff = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const rel = (a, b) => a?.relationships?.getOrCreate?.(b.agentId, b.name);
    const trait = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const value = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
        wage_unpaid:  { mood: -6, opinion: 0, days: 3, label: t('公庫發不出薪水') },
        broke_hungry: { mood: -6, opinion: 0, days: 2, label: t('錢不夠，吃不飽') },
        broke_cold:   { mood: -6, opinion: 0, days: 2, label: t('買不起柴，晚上好冷') },
        shabby:       { mood: -3, opinion: 0, days: 4, label: t('衣服破了買不起新的') },
        envious:      { mood: -3, opinion: -1, days: 3, label: t('眼紅別人比自己有錢') },
        treated:      { mood: 5, opinion: 2, days: 2, label: t('被請了一頓好的') },
        helped_out:   { mood: 6, opinion: 2, days: 3, label: t('手頭緊的時候有人幫忙') },
        generous_joy: { mood: 3, opinion: 0, days: 2, label: t('幫了別人，心裡踏實') },
        bribed:       { mood: 2, opinion: 1, days: 3, label: t('收了候選人的紅包') },
    });
    // 每天工資(從公庫領,先扣稅);主要看職業
    const WAGE = { mayor: 7, doctor: 6.5, researcher: 6, blacksmith: 5, carpenter: 5, guard: 4.5, trader: 4.5, tailor: 4, cook: 4, miner: 4.2, farmer: 4, priest: 3.5 };
    const MEAL0 = 3, CLOTHES0 = 6, FIREWOOD0 = 1.5; // 原價(v7.0.0 實際付的錢要乘上物價指數,見 living)
    const MEAL = MEAL0;
    // 材料折算銀幣(自己出錢 = 把材料錢付給公庫)
    const PRICE = { silver: 1, wood: 2, stone: 3, food: 1, meals: 2, metal: 5, iron: 5, tools: 6, clothing: 6, cloth: 4, medicine: 6, furniture: 8, bread: 2 };
    const costValue = (c) => Math.round(Object.entries(c || {}).reduce((s, [r, n]) => s + (PRICE[r] || 3) * (n || 0), 0));
    function S(w) {
        if (!w.wallet || typeof w.wallet.bal !== 'object') w.wallet = { bal: {}, tax: 0.1, unpaid: 0, lastDay: null, stats: { wages: 0, taxes: 0, spent: 0 } };
        const W = w.wallet; W.stats = W.stats || { wages: 0, taxes: 0, spent: 0 }; if (typeof W.tax !== 'number') W.tax = 0.1;
        for (const a of npcs(w)) if (typeof W.bal[a.agentId] !== 'number') W.bal[a.agentId] = Math.round((WAGE[a.job?.key] || 3) * 6 + Math.random() * 20);
        W_OK.add(W); // 結構檢查過了;S1 之後只補單人
        return W;
    }
    // v6.76.2 單人查／加／扣錢只補這個人的初始存款(以前每次都把全鎮掃一遍,一格叫上百次);全鎮的補齊留給每天結算與總覽
    function S1(w, a) {
        const W = (w.wallet && typeof w.wallet.bal === 'object' && W_OK.has(w.wallet)) ? w.wallet : S(w);
        if (typeof W.bal[a.agentId] !== 'number' && !a.isPlayer && !a.isDead) W.bal[a.agentId] = Math.round((WAGE[a.job?.key] || 3) * 6 + Math.random() * 20);
        return W;
    }
    const W_OK = new WeakSet();
    const get = (w, a) => a ? Math.max(0, Math.round((S1(w, a).bal[a.agentId] || 0) * 10) / 10) : 0;
    const add = (w, a, n) => { if (!a || !(n > 0)) return; const W = S1(w, a); W.bal[a.agentId] = Math.round(((W.bal[a.agentId] || 0) + n) * 10) / 10; };
    const take = (w, a, n) => { if (!a || !(n > 0)) return true; const W = S1(w, a); const b = W.bal[a.agentId] || 0; if (b + 1e-6 < n) return false; W.bal[a.agentId] = Math.round((b - n) * 10) / 10; return true; };
    const treasury = (w) => w.stockpile?.get?.('silver') || 0;
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', Math.round(n * 10) / 10, w.tickCount, why); };
    // v6.81.0 營業稅:做生意賣東西的收入(開店、廚師賣餐、裁縫賣衣)先繳 15% 給公庫,剩下才進自己口袋
    const BIZ_TAX = 0.15;
    const bizIncome = (w, a, n) => { if (!a || !(n > 0)) return 0; const tax = Math.round(n * BIZ_TAX * 100) / 100; if (tax > 0) { toTown(w, tax, t('營業稅')); const W = S(w); W.stats.bizTax = Math.round(((W.stats.bizTax || 0) + tax) * 10) / 10; } add(w, a, n - tax); return n - tax; };
    const fromTown = (w, n, why) => n > 0 && !!w.stockpile?.consume?.('silver', n, w.tickCount, why);
    // a 付 n 給 b(b 為 null 就是付給公庫)
    function pay(w, a, b, n, why) { if (!take(w, a, n)) return false; if (b) add(w, b, n); else toTown(w, n, why || t('村民付款')); return true; }
    const word = (n) => n >= 150 ? '手頭寬裕' : n >= 40 ? '過得去' : n >= 8 ? '手頭有點緊' : '身無分文';

    // ---------- 每天 ----------
    function daily(w) {
        const W = S(w), today = day(w), all = npcs(w); if (!all.length || W.lastDay === today) return; W.lastDay = today;
        payday(w, W, all); try { if (typeof MARKET !== 'undefined') MARKET.payroll(w, W, all); } catch (e) { console.warn('[Market] payroll', e); } living(w, W, all);
        try { social(w, W, all, today); } catch (e) { console.warn('[Wallet] social', e); }
        try { election(w, W, all); } catch (e) { console.warn('[Wallet] election', e); }
        try { if (typeof MARKET !== 'undefined') MARKET.daily(w, W, all); } catch (e) { console.warn('[Market] daily', e); } // v6.89.0 產權、調薪、挨餓
        for (const id of Object.keys(W.bal)) if (!w.agents[id] && !(w.isAway?.(id))) delete W.bal[id]; // 搬走或過世的人(v6.87.0 出遠門的人錢包留著;過世的人的錢在過世時就由家人繼承)
    }
    // v6.87.0 最低工資(扣稅後至少 4.5:三餐 3＋衣服＋柴火平均約 4,再留一點)不是天生就有,要有人提案、投票通過才生效(W.minWage);沒通過就照市價,做滿一天也可能越過越窮
    const FLOOR = 4.5;
    const netOf = (W, a) => Math.max(W.minWage || 0, WAGE[a.job.key] * (1 - W.tax));
    function payday(w, W, all) {
        // v6.89.0 公庫只發公職與公營產業的薪水;有老闆的私人產業由老闆自己發(MARKET.payroll)
        const workers = all.filter(a => WAGE[a.job?.key] && !(typeof MARKET !== 'undefined' && MARKET.privatePaid(w, a))); const gross = workers.reduce((s, a) => s + WAGE[a.job.key], 0); if (!gross) return;
        const net = workers.reduce((s, a) => s + netOf(W, a), 0); const have = treasury(w);
        const ratio = have >= net ? 1 : Math.max(0, have / net); W.unpaid = ratio < 1 ? workers.length : 0;
        if (ratio > 0) fromTown(w, Math.round(net * ratio * 10) / 10, t('發薪水'));
        W.stats.wages += net * ratio; W.stats.taxes += Math.max(0, gross - net) * ratio;
        for (const a of workers) {
            add(w, a, netOf(W, a) * ratio);
            if (ratio < 1) { a.addThought?.('wage_unpaid', w); if (Math.random() < 0.4) mem(w, a, ratio > 0 ? '公庫只發得出 {p}% 的薪水，這樣怎麼過日子。' : '公庫沒錢，這個月的薪水領不到了。', { p: Math.round(ratio * 100) }, 5); }
        }
        if (ratio < 1 && Math.random() < 0.5) log(w, 'economy', '💸 公庫只剩 {n} 銀幣，薪水只發得出 {p}%。', { n: Math.round(have), p: Math.round(ratio * 100) });
    }
    function living(w, W, all) {
        // v6.81.0 廚師、裁縫的分成平均給鎮上每一位廚師／裁縫,而且每人每天有上限(以前全給第一位,百人大城一天進帳四十多、其他人一毛都沒有)
        const cooks = all.filter(a => a.job?.key === 'cook'), tailors = all.filter(a => a.job?.key === 'tailor');
        const tipCap = 6, tips = new Map();
        const tip = (pool, n, reason, payer) => { const cand = pool.filter(x => x !== payer); if (!cand.length) { toTown(w, n, reason); return; } const who = cand[Math.floor(Math.random() * cand.length)]; const got = tips.get(who) || 0; const give = Math.max(0, Math.min(n, tipCap - got)); if (give > 0) { bizIncome(w, who, give); tips.set(who, got + give); } if (n - give > 0) toTown(w, n - give, reason); };
        const winter = w.clock?.season === '冬季'; const d = day(w); let hungryToday = 0;
        // v7.0.0 浮動物價:三餐、衣服、柴火照物價指數付錢(多付的錢一樣付給產業主或公庫,總數不變)
        const px = (k) => (typeof PRICES !== 'undefined' && w.prices ? PRICES.idx(w, k) : 1);
        const MEAL = Math.round(MEAL0 * px('food') * 100) / 100, CLOTHES = Math.round(CLOTHES0 * px('cloth') * 100) / 100, FIREWOOD = Math.round(FIREWOOD0 * px('fuel') * 100) / 100;
        for (const a of all) {
            // 三餐:四成給廚師,其餘歸公庫(食材是公家的)
            // v6.89.0 三餐的錢付給食堂與農莊的老闆;自己沒錢先找家人接濟,沒人幫就真的沒得吃
            if (typeof MARKET !== 'undefined') {
                const payer = MARKET.feed(w, a, MEAL);
                if (payer) { W.stats.spent += MEAL; MARKET.sale(w, 'meal', MEAL); MARKET.markFed(w, a, true); }
                else { hungryToday++; MARKET.markFed(w, a, false); a.needs && (a.needs.hunger = Math.max(0, (a.needs.hunger ?? 50) - 35)); a.addThought?.('broke_hungry', w); if (Math.random() < 0.3) mem(w, a, '身上沒錢，今天沒東西吃。', {}, 6); }
            }
            else if (take(w, a, MEAL)) { W.stats.spent += MEAL; tip(cooks, MEAL * 0.1, t('餐費'), a); toTown(w, MEAL * 0.9, t('餐費')); }
            else { a.needs && (a.needs.hunger = Math.max(0, (a.needs.hunger ?? 50) - 25)); a.addThought?.('broke_hungry', w); if (Math.random() < 0.3) mem(w, a, '身上沒錢，今天只吃了一點點。', {}, 5); }
            // 衣服:每人錯開,每十天一次
            if ((d + (a.agentId.length * 7)) % 10 === 0) {
                if (take(w, a, CLOTHES)) { W.stats.spent += CLOTHES; if (typeof MARKET !== 'undefined') MARKET.sale(w, 'clothes', CLOTHES); else { tip(tailors, CLOTHES * 0.25, t('衣服'), a); toTown(w, CLOTHES * 0.75, t('衣服')); } }
                else { a.needs && (a.needs.comfort = Math.max(0, (a.needs.comfort ?? 50) - 10)); a.addThought?.('shabby', w); }
            }
            // 手頭寬裕的人會花錢:上酒館、買點好東西(錢回到鎮上流通,不會越存越多);v6.90.0 越有錢花得越多(大約跟財富的平方根成正比)
            const bal = get(w, a); if (bal > 70 && Math.random() < (trait(a, 'greedy') ? 0.15 : 0.45)) { const n = Math.min(bal * 0.08, 3 + Math.sqrt(bal) * (0.4 + Math.random() * 0.5)); if (take(w, a, n)) { if (typeof MARKET !== 'undefined') MARKET.sale(w, 'luxury', n); else toTown(w, n, t('村民消費')); W.stats.spent += n; } }
            if (winter) {
                if (take(w, a, FIREWOOD)) { W.stats.spent += FIREWOOD; if (typeof MARKET !== 'undefined') MARKET.sale(w, 'firewood', FIREWOOD); else toTown(w, FIREWOOD, t('柴火')); }
                else { a.needs && (a.needs.comfort = Math.max(0, (a.needs.comfort ?? 50) - 20)); a.addThought?.('broke_cold', w); if (Math.random() < 0.3) mem(w, a, '買不起柴，晚上冷得睡不著。', {}, 5); }
            }
        }
        W.hungryToday = hungryToday; // v6.89.0 今天沒錢吃飯的人數(公共倉庫的餐食只算吃得起的人)
    }
    function social(w, W, all, today) {
        const rich = all.filter(a => get(w, a) >= 120), poor = all.filter(a => get(w, a) < 6);
        // 借錢:窮的人找交情不錯、手頭寬裕的朋友週轉(真的給錢;到期在恩怨系統裡還或賴帳)
        for (const r of poor.slice(0, 2)) {
            if (Math.random() > 0.5) continue;
            const l = all.filter(x => x !== r && get(w, x) >= 40 && aff(x, r) >= 10).sort((x, y) => aff(y, r) - aff(x, r))[0];
            if (!l) continue;
            if (trait(l, 'greedy') || (value(l, '財富') && Math.random() < 0.5)) { rel(r, l)?.modifyAffinity?.(-4); mem(w, r, '跟{l}借錢被拒絕了，原來交情就這樣。', { l: l.name }, 4); continue; }
            const n = Math.min(30, Math.max(10, Math.round(get(w, l) * 0.15 / 5) * 5));
            pay(w, l, r, n); r.addThought?.('helped_out', w, l.agentId, l.name);
            try { const D = DARK.S(w); D.debts = D.debts || []; D.debts.push({ l: l.agentId, r: r.agentId, n, day: today, due: today + 7, cash: true }); } catch (e) {}
            mem(w, l, '{r}手頭緊，跟我借了 {n} 銀幣。', { r: r.name, n }, 4); mem(w, r, '跟{l}借了 {n} 銀幣週轉，一週後要還。', { l: l.name, n }, 5);
            log(w, 'social', '🤝 {r}手頭緊，跟{l}借了 {n} 銀幣。', { r: r.name, l: l.name, n }, r.name);
        }
        // 有錢又大方:請客、接濟窮人、公庫快空時捐錢
        for (const g of rich) {
            const kindish = trait(g, 'kind') || trait(g, 'charismatic') || value(g, '社群');
            if (!kindish || Math.random() > 0.25) continue;
            const needy = poor.filter(x => x !== g)[0];
            if (needy && Math.random() < 0.5) {
                pay(w, g, needy, 15); needy.addThought?.('helped_out', w, g.agentId, g.name); g.addThought?.('generous_joy', w); rel(needy, g)?.modifyAffinity?.(10);
                mem(w, needy, '{g}塞了 15 銀幣給我，說先拿去吃飯。', { g: g.name }, 6); log(w, 'social', '💝 {g}接濟了手頭很緊的{n}。', { g: g.name, n: needy.name }, g.name);
                try { DARK.bump(w, g, 'helped'); } catch (e) {}
            } else if (treasury(w) < 40 && get(w, g) >= 160) {
                const n = 40; pay(w, g, null, n, t('{a}捐給公庫').replace('{a}', g.name)); g.addThought?.('generous_joy', w);
                log(w, 'economy', '🏛️ 公庫快空了，{g}捐了 {n} 銀幣。', { g: g.name, n }, g.name); try { DARK.bump(w, g, 'helped'); } catch (e) {}
            } else {
                const f = all.filter(x => x !== g && aff(g, x) >= 20); if (!f.length) continue; const x = pick(f);
                pay(w, g, null, 8, t('酒館')); x.addThought?.('treated', w, g.agentId, g.name); rel(x, g)?.modifyAffinity?.(5); rel(g, x)?.modifyAffinity?.(3);
                log(w, 'social', '🍻 {g}請{x}吃了一頓好的。', { g: g.name, x: x.name }, g.name);
            }
        }
        // 眼紅:窮又愛比較的人看到鎮上最有錢的人
        const top = all.slice().sort((x, y) => get(w, y) - get(w, x))[0];
        if (top && get(w, top) >= 150) for (const e of all.filter(a => a !== top && get(w, a) < 20 && (trait(a, 'neurotic') || trait(a, 'pessimist') || trait(a, 'jealous'))).slice(0, 2)) {
            if (Math.random() > 0.15) continue;
            e.addThought?.('envious', w, top.agentId, top.name); rel(e, top)?.modifyAffinity?.(-3);
            mem(w, e, '{t}那麼有錢，我卻連飯都快吃不起，憑什麼。', { t: top.name }, 4);
        }
    }
    // 選舉:不老實又有錢的候選人私下塞錢拉票
    function election(w, W, all) {
        const el = w.election; if (!el || el.phase !== 'campaign' || !Array.isArray(el.candidates)) return;
        for (const c of el.candidates) {
            const a = w.agents[c.agentId || c.id]; if (!a || get(w, a) < 60) continue;
            let honest = 3; try { honest = DARK.honesty(a); } catch (e) {}
            if (honest > 1.8 || Math.random() > 0.5) continue;
            const voters = all.filter(v => v !== a && get(w, v) < 40 && aff(v, a) > -30).sort(() => Math.random() - 0.5).slice(0, 2);
            for (const v of voters) {
                if (!pay(w, a, v, 10)) break;
                rel(v, a)?.modifyAffinity?.(15); v.addThought?.('bribed', w, a.agentId, a.name);
                mem(w, v, '{c}私下塞了 10 銀幣給我，要我投他一票。', { c: a.name }, 5);
                try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: v.agentId, k: '{c}私下塞錢給{v}買票', p: { c: a.name, v: v.name } }); } catch (e) {}
            }
        }
    }

    // ---------- 鎮況急事 ----------
    function issues(w) {
        if (!w.wallet) return []; const all = npcs(w), out = [];
        const broke = all.filter(a => get(w, a) < MEAL);
        if (broke.length >= Math.max(2, Math.ceil(all.length * 0.15))) out.push({ key: 'poverty', sev: broke.length >= all.length * 0.3 ? 3 : 2, who: broke.map(a => a.agentId), k: '{n} 個村民窮到買不起三餐：{list}', p: { n: broke.length, list: broke.slice(0, 3).map(a => t(a.name)).join(t('、')) } });
        if (w.wallet.unpaid) out.push({ key: 'wages', sev: 2, k: '公庫發不出全額薪水，{n} 個工人領不到錢', p: { n: w.wallet.unpaid } });
        return out;
    }

    // ---------- 提案出資 ----------
    // 提案有銀幣花費時,決定誰出:提案人自掏腰包／找朋友湊錢／公庫
    function decideFund(w, ps, p) {
        const c = costValue(ps._cost(p)); if (!(c > 0)) return null;
        const a = w.agents[p.proposerId]; if (!a) return { by: 'town', value: c };
        const mine = get(w, a);
        if (mine >= c * 1.2 && (trait(a, 'kind') || trait(a, 'charismatic') || c <= mine * 0.35 || Math.random() < 0.35)) return { by: 'self', pledges: { [a.agentId]: c }, value: c };
        const pledges = {}; let sum = 0;
        const mineGive = Math.floor(Math.min(mine * 0.5, c)); if (mineGive >= 5) { pledges[a.agentId] = mineGive; sum += mineGive; }
        for (const f of npcs(w).filter(x => x !== a && aff(x, a) >= 25 && get(w, x) >= 20).sort((x, y) => aff(y, a) - aff(x, a))) {
            if (sum >= c) break; const n = Math.floor(Math.min(get(w, f) * 0.3, c - sum)); if (n >= 5) { pledges[f.agentId] = n; sum += n; }
        }
        if (sum >= c && Object.keys(pledges).length >= 2) return { by: 'crowd', pledges, value: c };
        return { by: 'town', value: c };
    }
    // 批准時把私人出的錢收進公庫(專款),付不出的部分由公庫補
    function collect(w, p) {
        const f = p.fund; if (!f || f.by === 'town' || f.paid) return; f.paid = true; let got = 0;
        for (const [id, n] of Object.entries(f.pledges || {})) {
            const a = w.agents[id]; if (!a) continue; const can = Math.min(n, get(w, a));
            if (can > 0 && pay(w, a, null, can, t('{a}出資 {id}').replace('{a}', a.name).replace('{id}', p.id))) { got += can; mem(w, a, '{id}「{title}」通過了，我出的 {n} 銀幣交出去了。', { id: p.id, title: w.proposals?.title?.(p) || '', n: Math.round(can) }, 4); }
        }
        f.got = Math.round(got);
    }
    function fundText(w, p) {
        const f = p?.fund; if (!f) return '';
        const names = Object.keys(f.pledges || {}).map(id => t(w.agents[id]?.name || '')).filter(Boolean);
        if (f.by === 'self') return t('提案人自掏腰包（約 {n} 銀幣）').replace('{n}', f.value || 0);
        if (f.by === 'crowd') return t('{list}一起湊錢（約 {n} 銀幣）').replace('{list}', names.slice(0, 3).join(t('、')) + (names.length > 3 ? t('等人') : '')).replace('{n}', f.value || 0);
        return t('公庫出（約 {n} 銀幣）').replace('{n}', f.value || 0);
    }
    function describe(w, a) { if (!w.wallet || !a) return ''; const n = Math.round(get(w, a)); return t('身上有 {n} 銀幣（{w}）').replace('{n}', n).replace('{w}', t(word(n))); }
    function summary(w) {
        if (!w.wallet) return null; const all = npcs(w); if (!all.length) return null;
        const list = all.map(a => ({ a, n: get(w, a) })).sort((x, y) => y.n - x.n);
        return { total: Math.round(list.reduce((s, x) => s + x.n, 0)), rich: list[0], poor: list[list.length - 1], broke: list.filter(x => x.n < MEAL).length, tax: w.wallet.tax, bizTax: Math.round(w.wallet.stats?.bizTax || 0), bizRate: BIZ_TAX };
    }
    return { S, get, add, take, pay, costValue, daily, issues, decideFund, collect, fundText, describe, summary, word, WAGE, bizIncome, BIZ_TAX, netOf, FLOOR };
})();

// v6.87.0 過世的人的錢(錢包＋銀行存款,先還銀行貸款)由家人繼承(配偶、子女平分;沒有家人就歸公庫),以前直接消失
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let estate = 0, heirs = [];
        try {
            if (world.wallet && npc && !npc.isPlayer) {
                estate = WALLET.get(world, npc);
                // 銀行存款一起算進遺產,先還清欠銀行的錢
                const B = world.bank, id = npc.agentId;
                if (B && B.dep && B.dep[id] > 0) { const paid = Math.min(B.dep[id], Math.max(0, Math.floor(B.reserve || 0))); B.reserve -= paid; delete B.dep[id]; estate += paid; }
                if (B && B.loans && B.loans[id] && estate > 0) { const L = B.loans[id]; const pay = Math.min(L.owed || 0, estate); estate -= pay; B.reserve += pay; L.owed -= pay; if (L.owed <= 0) delete B.loans[id]; }
                heirs = Object.values(world.agents || {}).filter(a => a !== npc && !a.isPlayer && !a.isDead && (['married', 'dating'].includes(a.relationships?.relationships?.[npc.agentId]?.status) || (a._parentNames || []).includes(npc.name)));
            }
        } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        try {
            if (estate > 0) {
                if (world.wallet?.bal) delete world.wallet.bal[npc.agentId];
                if (heirs.length) { const each = Math.round(estate / heirs.length * 10) / 10; for (const h of heirs) { WALLET.add(world, h, each); h.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '繼承了{name}留下的 {n} 銀幣。', { name: npc.name, n: each }, 6, [npc.name]); } }
                else world.stockpile?.add?.('silver', Math.round(estate * 10) / 10, world.tickCount, t('無人繼承的遺產'));
            }
        } catch (e) {}
        return r;
    };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) {
        const r = _daily.call(this, w, ...rest);
        try { const d = this._abs(w); if (w.observerMode && this._walletDay !== d) { this._walletDay = d; WALLET.daily(w); } } catch (e) { console.warn('[Wallet] daily', e); }
        return r;
    };
    const _create = PS._createWith;
    PS._createWith = function (w, day, cand, a) {
        const p = _create.call(this, w, day, cand, a);
        try { if (p && w.wallet) { const f = WALLET.decideFund(w, this, p); if (f) { p.fund = f; if (f.by !== 'town') a?.memory?.addT?.(w.tickCount, w.clock.timeStr, 'economy', f.by === 'self' ? '{id} 我打算自己出錢，不動用公庫。' : '{id} 找了幾個朋友一起湊錢。', { id: p.id }, 4, []); } } } catch (e) {}
        return p;
    };
    const _decide = PS._decide;
    // 批准前先把私人出的錢收進公庫(批准當下可能就馬上執行,要先有錢)
    PS._decide = function (w, p, action, by) { try { if (action === 'approve') WALLET.collect(w, p); } catch (e) {} return _decide.call(this, w, p, action, by); };
    // 出錢方式影響支持度:自己出錢／湊錢比較容易過;動用公庫,省錢的人會猶豫
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a) {
        _rv.call(this, w, p, a);
        try {
            const f = p.fund; if (!f) return; const v = p.votes[a.agentId]; const why = (p.why || (p.why = {}));
            if (f.pledges?.[a.agentId]) { p.votes[a.agentId] = 'for'; why[a.agentId] = 'pledged'; return; }
            const c = f.value || 0;
            if (f.by !== 'town') {
                const pr = w.agents[p.proposerId]; const g = pr ? (a.relationships?.relationships?.[pr.agentId]?.affinity || 0) : 0;
                if (v === 'against' && g > -30 && Math.random() < 0.35) { p.votes[a.agentId] = 'for'; why[a.agentId] = 'selfpay'; }
                else if (v === 'for' && g < -30 && Math.random() < 0.3) { p.votes[a.agentId] = 'against'; why[a.agentId] = 'buyfavor'; }
            } else if (c > 0 && v === 'for') {
                const thrifty = this._hasTrait(a, 'greedy') || this._hasValue(a, '財富'); const low = (w.stockpile?.get?.('silver') || 0) < c * 1.5;
                if ((thrifty && Math.random() < 0.3) || (low && Math.random() < 0.25)) { p.votes[a.agentId] = 'against'; why[a.agentId] = 'townmoney'; }
            }
        } catch (e) {}
    };
    const _toItem = PS.toItem;
    PS.toItem = function (w, p) { const it = _toItem.call(this, w, p); try { if (it && p.fund) { it.fundBy = p.fund.by; it.fundText = WALLET.fundText(w, p); } } catch (e) {} return it; };
}
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { pledged: '自己也出了錢', selfpay: '提案人自己出錢，不花公庫', buyfavor: '覺得是在用錢收買人心', townmoney: '不想動用公庫' });
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.wallet = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.wallet) d.wallet = { bal: this.wallet.bal, tax: this.wallet.tax, unpaid: this.wallet.unpaid || 0, lastDay: this.wallet.lastDay, stats: this.wallet.stats }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.wallet = (data?.wallet && typeof data.wallet.bal === 'object') ? Object.assign({ tax: 0.1, unpaid: 0, lastDay: null, stats: { wages: 0, taxes: 0, spent: 0 } }, data.wallet) : null; } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = WALLET.describe(world, a); if (s) b.mem = [s, ...(b.mem || [])]; } catch (e) {} return b; };
    const _cp = CE._buildCharacterProfile;
    CE._buildCharacterProfile = function (agent) { const p = _cp.call(this, agent); try { const w = this._world || (typeof window !== 'undefined' && window.rimtownApp?.world); const s = w && WALLET.describe(w, agent); if (s) p.status = `${p.status}${t('；')}${s}`; } catch (e) {} return p; };
}
if (typeof globalThis !== 'undefined') globalThis.WALLET = WALLET;
