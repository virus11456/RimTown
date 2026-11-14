// RimTown - sim-compete.js：v9.7.0 同業競爭、管理成本、反壟斷政治
// 1. 競爭:某一行連續兩週賺很多,有野心、有本錢的人就在對面開一家(對手店),挖走一部分工人、開幕打折
//    - 兩家搶客人:人手多、價錢便宜、老闆顧得到的那家分到比較多(MARKET.shareOf);打折省下的錢回到村民手上
//    - 每週調價:客人被搶走的那家降價,搶贏的慢慢漲回來;兩家同時降價就是價格戰
//    - 搶工人:對面工資高一成以上,工人會跳槽;被挖走人又有賺錢的老闆會加薪
//    - 連虧三週又沒錢:對手店收攤(工人回原本那家),原本那家撐不住就被對手低價併購
// 2. 管理成本:一個人名下超過兩家店,多的那幾家要請掌櫃代管(付掌櫃薪水),服務也會變差(MARKET.quality);掌櫃可能暗中揩油
// 3. 反壟斷是投票來的:已經有反壟斷法的鎮,有人名下兩家以上、貧富差距又大,會有人提案收緊到兩家;
//    被針對的大老闆會私下塞錢遊說(進政治獻金名單,投票時會偏向他),被報社揭發就破功
// 全部是錢包之間轉帳或付給本地產業(銀幣守恆)。必須在 sim-market.js、sim-finance.js、sim-shares.js 之後載入。
'use strict';

const COMPETE = (() => {
    const MK = () => MARKET;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const r2 = (n) => Math.round(n * 100) / 100;
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const news = (w, k, p, imp, nm) => { try { w.dailyNews?.collectEvent?.('economy', fill(k, p), imp || 7, nm || []); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const bump = (a, b, n) => { try { a?.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bal = (w, a) => (a && typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 0);
    const TAX = 0.05, CORP = 0.12;
    const profit = (h) => (h || []).reduce((s, [r, c]) => s + r * (1 - TAX) - c, 0);
    const wageIdx = () => (typeof WALLET !== 'undefined' && WALLET.wageIdx ? WALLET.wageIdx() : 1);

    function S(w) {
        const M = MK().S(w); M.rival = M.rival || {}; M.price = M.price || {}; M.good = M.good || {}; M.loss = M.loss || {}; M.mgr = M.mgr || {};
        M.cst = M.cst || { opened: 0, closed: 0, merged: 0, wars: 0, poach: 0, raise: 0, mgr: 0, skim: 0, caught: 0, lobby: 0, exposed: 0, divest: 0 }; M.fn = M.fn || 0;
        return M;
    }
    const firmName = (w, k, id) => fill('{o}的{s}', { o: w.agents[id]?.name || '', s: MK().name(k) });
    const empOf = (w, k, R, all) => MK().workersOf(w, k, all).filter(a => R.emp?.[a.agentId] && a.agentId !== R.owner);
    const incOf = (w, k, R, all) => MK().workersOf(w, k, all).filter(a => a.agentId !== w.market.owners[k] && !(R && R.emp?.[a.agentId]));

    // ---------- 1. 有人在對面開店 ----------
    // v9.23.0 要不要在對面開店、要不要跳槽，交給本人決定(sim-decide-work.js)；這裡只剩「誰夠格」和結算
    const openCost = (w, k, all) => Math.round(30 + MK().workersOf(w, k, all).length * 8);
    // 這個人有多想、多適合在這一行開店(不含當天的運氣)
    const drive = (w, a, k, boss) => (has(a, 'greedy') ? 2 : 0) + (has(a, 'hardworking') ? 1 : 0) + (has(a, 'charismatic') ? 1 : 0) + (hasV(a, '財富') ? 2 : 0) + (MK().JOB2S[a.job?.key] === k ? 2 : 0) - (aff(a, boss) > 40 ? 2 : 0);
    const canOpen = (w, a, k, cost, d) => a.agentId !== MK().ownerOf(w, k) && (a.age ?? 30) >= 18 && bal(w, a) >= cost * 1.5 && MK().canBuy(w, a.agentId) && !(w.civic?.jail?.[a.agentId] > d);
    // 開張：付裝修錢、挖走四成跟老闆交情最淺的工人、開幕打九折。deal = 朋友合夥(INVEST.partner 已經扣好錢)
    function openShop(w, all, k, owner, d, deal) {
        const M = S(w); const Mk = MK(); const id = Mk.ownerOf(w, k); const boss = w.agents[id]; const ws = Mk.workersOf(w, k, all); const cost = openCost(w, k, all);
        // 裝修錢付給本地木作坊、礦場;合夥湊的錢可能比本錢少幾角(INVEST.partner 允許最後差 0.5 以內),照實際湊到的付(以前照本錢付,憑空多出零頭)
        const spent = deal ? r2(deal.parts.reduce((s, [, n]) => s + n, 0)) : cost, wood = r2(spent * 0.6);
        Mk.sell(w, 'timber', wood, t('開店裝修')); Mk.sell(w, 'mine', r2(spent - wood), t('開店裝修'));
        const R = M.rival[k] = { fid: 'F' + (++M.fn), owner: owner.agentId, since: d, price: 0.9, pay: Math.min(1.2, Math.round((Mk.payRate(w, k) + 0.1) * 100) / 100), emp: {}, rev: 0, cost: 0, hist: [], loss: 0 };
        const pool = ws.filter(a => a.agentId !== id && a.agentId !== owner.agentId).sort((x, y) => aff(x, boss) - aff(y, boss));
        const n = Math.max(1, Math.ceil(pool.length * 0.4)); pool.slice(0, n).forEach(a => { R.emp[a.agentId] = d; mem(w, a, '{a}開了新店，開的工資比{o}高，我跳槽過去了。', { a: owner.name, o: boss?.name || '' }, 6); });
        M.good[k] = 0; M.cst.opened++;
        if (deal) INVEST.setup(w, k, R, deal);
        log(w, '🏪 {a}看{o}的{s}生意好，自己也開了一家，挖走 {n} 個人、開幕打九折！', { a: owner.name, o: boss?.name || '', s: Mk.name(k), n }, owner.name);
        news(w, '{a}在{o}的{s}對面開了新店，兩家要搶生意了', { a: owner.name, o: boss?.name || '', s: Mk.name(k) }, 7, [owner.name, boss?.name || '']);
        mem(w, owner, '我看{o}的{s}那麼賺，花了 {n} 銀幣在對面開了一家，要跟他搶生意。', { o: boss?.name || '', s: Mk.name(k), n: cost }, 8);
        mem(w, boss, '{a}在我的{s}對面開了一家，還挖走我 {n} 個人。', { a: owner.name, s: Mk.name(k), n }, 8);
        bump(boss, owner, -8); bump(owner, boss, -3);
        return R;
    }
    // 給決策核心：這個人現在可以在哪一行對面開店(那一行連兩週好賺、還沒有對手、他出得起本錢、也有那個心)
    function openInfo(w, a) {
        const M = S(w); const Mk = MK(); const d = day(w); const all = npcs(w); let best = null;
        for (const k of Object.keys(Mk.SECTORS)) {
            const id = Mk.ownerOf(w, k); if (!id || Mk.rivalOf(w, k) || (M.good[k] || 0) < 2) continue; const boss = w.agents[id]; if (!boss) continue;
            const cost = openCost(w, k, all); if (!canOpen(w, a, k, cost, d)) continue; const s = drive(w, a, k, boss); if (s < 2) continue;
            if (!best || s > best.s) best = { k, cost, s, boss, weeks: M.good[k], profit: Math.round(profit(M.hist[k])), staff: Mk.workersOf(w, k, all).length };
        }
        return best;
    }
    // 本人決定開(由決策核心呼叫)
    function openBy(w, a, k) {
        const Mk = MK(); const d = day(w); const all = npcs(w); const I = openInfo(w, a); if (!I || I.k !== k || Mk.rivalOf(w, k)) return null;
        if (!WALLET.take(w, a, I.cost)) return null; return openShop(w, all, k, a, d, null);
    }
    // 要不要開店交給本人決定：這裡只記「這一行連幾週好賺」；一個人開不起、要找朋友合夥的那種照舊
    function entry(w, all, d) {
        const M = S(w); const Mk = MK();
        for (const k of Object.keys(Mk.SECTORS)) {
            const id = Mk.ownerOf(w, k); if (!id || Mk.rivalOf(w, k)) { if (!id) M.good[k] = 0; continue; }
            if (M.rival[k]) delete M.rival[k];
            const ws = Mk.workersOf(w, k, all); if (ws.length < 3) { M.good[k] = 0; continue; }
            const P = profit(M.hist[k]); M.good[k] = P > Math.max(20, ws.length * 5) ? (M.good[k] || 0) + 1 : 0;
            if (M.good[k] < 2) continue;
            const cost = openCost(w, k, all);
            const boss = w.agents[id];
            if (all.some(a => canOpen(w, a, k, cost, d) && drive(w, a, k, boss) >= 2)) continue; // 有人自己開得起：等他拿主意
            if (Math.random() > 0.5) continue;
            const score = (a) => drive(w, a, k, boss) + Math.random();
            const cand = all.filter(a => canOpen(w, a, k, cost, d))
                .map(a => [a, score(a)]).filter(([, s]) => s >= 2).sort((x, y) => y[1] - x[1])[0]?.[0];
            // v9.8.0 一個人出不起本錢:找朋友合夥(INVEST.partner 已經從每個人錢包扣好錢)
            let deal = null, owner = cand;
            if (!cand) { deal = (typeof INVEST !== 'undefined') ? INVEST.partner(w, all, k, cost, id, score) : null; if (!deal) continue; owner = deal.lead; }
            else if (!WALLET.take(w, cand, cost)) continue;
            openShop(w, all, k, owner, d, deal);
        }
    }
    // ---------- 跳槽 ----------
    // 這個工人現在的處境：在哪一家、對面是誰、兩邊工資差多少(對面高一成以上才算有得跳)
    function hopInfo(w, a) {
        const Mk = MK(); const M = S(w); const all = npcs(w);
        for (const k of Object.keys(Mk.SECTORS)) {
            const R = Mk.rivalOf(w, k); if (!R) continue; const id = M.owners[k]; if (a.agentId === id || a.agentId === R.owner) continue;
            if (!Mk.workersOf(w, k, all).includes(a)) continue; const atR = !!R.emp[a.agentId];
            const payI = Mk.payRate(w, k), payR = R.pay ?? 1; const mine = atR ? payR : payI, other = atR ? payI : payR; if (other - mine < 0.1) return null;
            return { k, atR, mine, other, from: w.agents[atR ? R.owner : id] || null, to: w.agents[atR ? id : R.owner] || null };
        }
        return null;
    }
    // 換過去(由決策核心呼叫)。被挖走的那邊下次每週結算時可能加薪
    function hop(w, a, k) {
        const I = hopInfo(w, a); if (!I || I.k !== k) return false; const M = S(w); const R = MK().rivalOf(w, k); const d = day(w);
        if (I.atR) { delete R.emp[a.agentId]; R.hopR = (R.hopR || 0) + 1; } else { R.emp[a.agentId] = d; R.hopI = (R.hopI || 0) + 1; }
        M.cst.poach++; mem(w, a, '{o}那邊工資比較高，我換過去做了。', { o: I.to?.name || '' }, 5);
        if (d - (R.poachLog || -99) >= 14) { R.poachLog = d; log(w, '🔀 {s}的工人跳槽：{n} 個人換到工資比較高的那一家。', { s: MK().name(k), n: 1 }); }
        return true;
    }

    // ---------- 每週:調價、搶工人、繳稅、倒閉與併購 ----------
    function weekly(w, all, d) {
        const M = S(w); const Mk = MK();
        for (const k of Object.keys(Mk.SECTORS)) {
            const R = Mk.rivalOf(w, k); if (!R) continue; const id = M.owners[k]; const boss = w.agents[id], rv = w.agents[R.owner];
            const s = Mk.shareOf(w, k); const Pi = profit(M.hist[k]), Pr = profit(R.hist);
            // 調價:被搶走客人、還有賺頭的那家降價;贏的那家慢慢漲回原價。吝嗇的不肯降到九折以下,心腸好的降得快
            const floor = (a) => (has(a, 'greedy') ? 0.9 : 0.75), step = (a) => ((has(a, 'kind') || has(a, 'generous')) ? 0.1 : 0.05);
            const pi0 = M.price[k] ?? 1, pr0 = R.price ?? 1; let pi = pi0, pr = pr0;
            if (s > 0.55 && Pi > -5) pi = Math.max(floor(boss), pi - step(boss)); else if (s < 0.35) pi = Math.min(1, pi + 0.05);
            if (s < 0.45 && Pr > -5) pr = Math.max(floor(rv), pr - step(rv)); else if (s > 0.65) pr = Math.min(1, pr + 0.05);
            M.price[k] = Math.round(pi * 100) / 100; R.price = Math.round(pr * 100) / 100;
            if (pi < pi0 && pr < pr0 && d - (R.warLog || -99) >= 21) { R.warLog = d; M.cst.wars++; log(w, '💥 {o}和{a}的{s}打起價格戰，一個降到 {p}%、一個降到 {q}%，村民樂得撿便宜。', { o: boss?.name || '', a: rv?.name || '', s: Mk.name(k), p: Math.round(pi * 100), q: Math.round(pr * 100) }, rv?.name || ''); news(w, '{o}和{a}的{s}打起價格戰', { o: boss?.name || '', a: rv?.name || '', s: Mk.name(k) }, 6, [boss?.name || '', rv?.name || '']); }
            // 搶工人:對面工資高一成以上，跳不跳槽由工人自己決定(hopBy)；這一週換過去的人記在 hopI／hopR
            const payI = Mk.payRate(w, k), payR = R.pay ?? 1; let lostI = R.hopI || 0, lostR = R.hopR || 0; delete R.hopI; delete R.hopR;
            // 被挖走人、還有賺錢的老闆加薪(吝嗇的不加)
            if (lostI && Pi > 0 && !has(boss, 'greedy') && payI < 1.2) { M.pay[k] = Math.min(1.2, Math.round((payI + 0.05) * 100) / 100); M.cst.raise++; }
            if (lostR && Pr > 0 && !has(rv, 'greedy') && payR < 1.2) { R.pay = Math.min(1.2, Math.round((payR + 0.05) * 100) / 100); M.cst.raise++; }
            // 對手店的營所稅(原本那家由 MARKET.corpTax 收)
            if (Pr > 0 && rv) { const tax = Math.min(bal(w, rv), r2(Pr * CORP * (has(rv, 'greedy') ? 0.6 : 1))); if (tax > 0 && WALLET.take(w, rv, tax)) w.stockpile.add('silver', tax, w.tickCount, t('營利事業所得稅')); }
            // v9.8.0 合夥開的店:稅後利潤的六成照股份分給合夥人
            if (Pr > 0 && rv && R.sh && typeof INVEST !== 'undefined') { try { INVEST.rivalDividend(w, k, R, r2(Pr * (1 - CORP))); } catch (e) {} }
            // 倒閉與併購
            R.loss = Pr < 0 ? (R.loss || 0) + 1 : 0; M.loss[k] = Pi < 0 ? (M.loss[k] || 0) + 1 : 0;
            if (R.loss >= 3 && bal(w, rv) < 40) {
                const n = empOf(w, k, R, all).length; try { if (typeof INVEST !== 'undefined') INVEST.rivalClosed(w, k, R); } catch (e) {} delete M.rival[k]; M.cst.closed++;
                log(w, '📉 {a}的{s}撐不下去，收攤了；{n} 個夥計回到{o}那邊。', { a: rv?.name || '', s: Mk.name(k), n, o: boss?.name || '' }, rv?.name || '');
                news(w, '{a}的{s}收攤了', { a: rv?.name || '', s: Mk.name(k) }, 6, [rv?.name || '']); mem(w, rv, '我的{s}撐不下去，收攤了。', { s: Mk.name(k) }, 8); mem(w, boss, '{a}的店收攤了，客人又回到我這裡。', { a: rv?.name || '' }, 6);
                continue;
            }
            if (boss && rv && M.loss[k] >= 3 && bal(w, boss) < 40) { // v9.10.1 兩邊老闆都要在鎮上才談得成併購(老闆出遠門時以前會被當成沒錢、賣款付不出去就不見了)
                const price = Math.round(Mk.value(w, k, all) * 0.5);
                if (bal(w, rv) >= price && WALLET.take(w, rv, price)) {
                    WALLET.add(w, boss, price); M.owners[k] = R.owner; M.pay[k] = R.pay ?? 1; M.price[k] = R.price ?? 1; M.loss[k] = 0; delete M.rival[k]; M.cst.merged++;
                    try { if (!(typeof INVEST !== 'undefined' && INVEST.rivalMerged(w, k, R)) && w.market.shares?.[k]) w.market.shares[k] = { [R.owner]: 100 }; } catch (e) {} // v9.8.0 合夥人變成合併後那家的股東
                    log(w, '🤝 {o}的{s}撐不住，被對手{a}以 {n} 銀幣併購，兩家併成一家。', { o: boss?.name || '', s: Mk.name(k), a: rv?.name || '', n: price }, rv?.name || '');
                    news(w, '{a}併購了{o}的{s}', { a: rv?.name || '', o: boss?.name || '', s: Mk.name(k) }, 7, [rv?.name || '', boss?.name || '']);
                    mem(w, boss, '撐不下去了，只好把{s}賣給對手{a}。', { s: Mk.name(k), a: rv?.name || '' }, 8); mem(w, rv, '我把{o}的{s}買下來了，這一行現在是我的。', { o: boss?.name || '', s: Mk.name(k) }, 8);
                }
            }
        }
    }

    // ---------- 2. 管理成本:名下超過兩家店,多的要請掌櫃 ----------
    const fkey = (f) => f.k + (f.rival ? ':R' : '');
    function firmRev(w, f) { const M = S(w); const h = f.rival ? (M.rival[f.k]?.hist || []) : (M.hist[f.k] || []); return h.reduce((s, [r]) => s + r, 0); }
    function firmStaff(w, f, all) { const R = MK().rivalOf(w, f.k); return f.rival ? empOf(w, f.k, R, all) : incOf(w, f.k, R, all); }
    // 掌櫃揩油:拿走這家店近期營收的 8%,老闆有三成五的機會查出來
    const skimAmt = (w, f, o) => Math.min(bal(w, o), r2(firmRev(w, f) * 0.08));
    function skim(w, M, key, f, o, m) {
        const Mk = MK(); const amt = skimAmt(w, f, o); if (!(amt >= 1) || !WALLET.take(w, o, amt)) return null; WALLET.add(w, m, amt); M.cst.skim++;
        if (Math.random() < 0.35) { M.cst.caught++; delete M.mgr[key]; bump(o, m, -20); bump(m, o, -8); log(w, '🕵️ {o}查帳發現掌櫃{m}揩油了 {n} 銀幣，當場把他辭了。', { o: o.name, m: m.name, n: Math.round(amt) }, o.name); mem(w, o, '掌櫃{m}在{s}的帳上動手腳，被我抓到了。', { m: m.name, s: Mk.name(f.k) }, 8); mem(w, m, '我在帳上動手腳被{o}抓到，丟了掌櫃的差事。', { o: o.name }, 8); return { amt, caught: true }; }
        mem(w, m, '這週又從{s}的帳上撈了一點，{o}沒發現。', { s: Mk.name(f.k), o: o.name }, 5); return { amt, caught: false };
    }
    // v9.26.0 給決策核心:這個人是不是哪家店的掌櫃、這週帳上撈得到多少(跟以前擲骰的是同一批人:貪心或愛說謊的掌櫃)
    function skimInfo(w, a) {
        if (!a || !(has(a, 'greedy') || a.dark?.liar) || typeof WALLET === 'undefined' || !w.wallet) return null; const M = S(w);
        const key = Object.keys(M.mgr || {}).find(k => M.mgr[k] === a.agentId); if (!key) return null;
        const k = key.split(':')[0], rival = key.endsWith(':R'); const o = w.agents[rival ? M.rival?.[k]?.owner : M.owners?.[k]]; if (!o || o.isDead || o === a) return null;
        const f = { k, rival }; const amt = skimAmt(w, f, o); return amt >= 1 ? { key, f, o, amt: Math.round(amt), shop: MK().name(k) } : null;
    }
    function skimBy(w, a) { const I = skimInfo(w, a); return I ? skim(w, S(w), I.key, I.f, I.o, a) : null; }
    function manage(w, all, d) {
        const M = S(w); const Mk = MK(); const owners = new Set([...Object.values(M.owners || {}), ...Object.values(M.rival || {}).map(R => R?.owner)].filter(Boolean)); const keep = new Set();
        for (const id of owners) {
            const o = w.agents[id]; if (!o) continue; const fs = Mk.firmsOf(w, id); if (fs.length <= 2) continue;
            const extra = fs.slice().sort((x, y) => (M.mgr[fkey(x)] ? 1 : 0) - (M.mgr[fkey(y)] ? 1 : 0) || firmRev(w, y) - firmRev(w, x)).slice(2); // 老闆自己顧最賺的兩家;已經有掌櫃的照舊交給掌櫃,不要天天換人
            for (const f of extra) {
                const key = fkey(f); keep.add(key); let m = w.agents[M.mgr[key]];
                const staff = firmStaff(w, f, all).filter(a => a.agentId !== id);
                if (!m || m.isDead || !staff.includes(m)) {
                    m = staff.sort((x, y) => (y.skills?.get?.('社交')?.level || 0) - (x.skills?.get?.('社交')?.level || 0))[0]; if (!m) { delete M.mgr[key]; continue; }
                    M.mgr[key] = m.agentId; M.cst.mgr++;
                    log(w, '👔 {o}名下店太多顧不過來，請{m}當{s}的掌櫃。', { o: o.name, m: m.name, s: Mk.name(f.k) }, o.name); mem(w, m, '{o}請我當{s}的掌櫃，多一份薪水。', { o: o.name, s: Mk.name(f.k) }, 6);
                }
                const fee = r2(2 * wageIdx()); if (WALLET.take(w, o, fee)) WALLET.add(w, m, fee);
                // 掌櫃揩油:動不動帳由掌櫃自己決定(skimBy),老闆不一定抓得到
            }
        }
        for (const key of Object.keys(M.mgr)) if (!keep.has(key)) delete M.mgr[key];
    }

    // ---------- 3. 反壟斷政治:收緊上限、遊說、超過上限要賣掉 ----------
    function C(w) { const X = w.cycle; return X && typeof X === 'object' ? X : null; }
    function bigOwner(w, min) { const Mk = MK(); const ids = new Set([...Object.values(w.market.owners || {}), ...Object.values(w.market.rival || {}).map(R => R?.owner)].filter(Boolean)); let best = null; for (const id of ids) { if (!w.agents[id]) continue; const n = Mk.firmsOf(w, id).length; if (n >= min && (!best || n > best.n)) best = { id, n }; } return best; }
    function capProposal(w, d) {
        const X = C(w); const P = w.proposals; if (!X?.law || (X.cap || 3) <= 2 || !P?._createWith || d - (X.lastCap || -99) < 60) return;
        if ((P.items || []).some(p => (p.kind === 'antitrust_cap' || p.kind === 'antitrust') && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const big = bigOwner(w, 2); if (!big || MK().gini(w) < 0.6) return;
        const all = npcs(w); const mono = w.agents[big.id]; const U = w.union;
        const who = (U?.on && U.leader && U.leader !== big.id && w.agents[U.leader]) || all.filter(a => a.agentId !== big.id && a.job && bal(w, a) < 40).sort((x, y) => (has(y, 'charismatic') ? 1 : 0) - (has(x, 'charismatic') ? 1 : 0))[0]; if (!who) return;
        X.lastCap = d;
        const cand = { kind: 'antitrust_cap', key: 'antitrust_cap:' + d, refKey: big.id, jobs: [], make: () => ({ kind: 'antitrust_cap', key: 'antitrust_cap:' + d, refKey: big.id, tk: '反壟斷法收緊到兩家', tp: {}, dk: '{who}說鎮上的錢越來越集中在少數人手上，{name}一個人就有 {n} 家店。提議把反壟斷法收緊：一個人名下最多兩家。', dp: { who: who.name, name: mono.name, n: big.n }, cost: {}, category: 'politics' }) };
        const p = P._createWith(w, d, cand, who); if (p) p.refKey = big.id; return p;
    }
    function enactCap(w, p) {
        const X = C(w); if (!X) return ''; X.law = true; X.cap = 2;
        log(w, '⚖️ 反壟斷法收緊：從今天起，一個人名下最多只能有兩家店，超過的要賣掉。', {});
        news(w, '反壟斷法收緊到兩家', {}, 8, []);
        return t('反壟斷法收緊到一人最多兩家');
    }
    // 超過上限的人每週賣掉一家(最不賺的那家):有人買得起就賣,對手店沒人買就收攤,原本那家沒人買就由公庫收購
    function divest(w, all, d) {
        const X = C(w); if (!X?.law) return; const cap = X.cap || 3; const M = S(w); const Mk = MK();
        const big = bigOwner(w, cap + 1); if (!big) return; const o = w.agents[big.id]; if (!o) return;
        const f = Mk.firmsOf(w, big.id).sort((x, y) => firmRev(w, x) - firmRev(w, y))[0]; if (!f) return;
        const price = Math.round(Mk.value(w, f.k, all) * (f.rival ? 0.6 : 1));
        const buyer = all.filter(a => a.agentId !== big.id && bal(w, a) >= price && Mk.canBuy(w, a.agentId) && a.agentId !== M.owners[f.k] && a.agentId !== M.rival[f.k]?.owner).sort((x, y) => bal(w, y) - bal(w, x))[0];
        M.cst.divest++;
        if (f.rival) {
            if (buyer && WALLET.take(w, buyer, price)) { WALLET.add(w, o, price); M.rival[f.k].owner = buyer.agentId; log(w, '⚖️ 依反壟斷法，{o}把對面那家{s}以 {n} 銀幣賣給了{b}。', { o: o.name, s: Mk.name(f.k), n: price, b: buyer.name }, o.name); }
            else { try { if (typeof INVEST !== 'undefined') INVEST.rivalClosed(w, f.k, M.rival[f.k]); } catch (e) {} delete M.rival[f.k]; log(w, '⚖️ 依反壟斷法，{o}名下店太多，對面那家{s}沒人接手，只好收掉。', { o: o.name, s: Mk.name(f.k) }, o.name); }
            return;
        }
        if (buyer && WALLET.take(w, buyer, price)) { WALLET.add(w, o, price); M.owners[f.k] = buyer.agentId; if (M.rival[f.k]?.owner === buyer.agentId) delete M.rival[f.k]; try { if (w.market.shares?.[f.k]) w.market.shares[f.k] = { [buyer.agentId]: 100 }; } catch (e) {} log(w, '⚖️ 依反壟斷法，{o}把{s}以 {n} 銀幣賣給了{b}。', { o: o.name, s: Mk.name(f.k), n: price, b: buyer.name }, o.name); return; }
        if (w.stockpile.consume('silver', price, w.tickCount, t('公庫收購產業'))) { WALLET.add(w, o, price); M.owners[f.k] = null; try { if (w.market.shares?.[f.k]) delete w.market.shares[f.k]; } catch (e) {} log(w, '⚖️ 依反壟斷法，{o}的{s}沒人買得起，公庫以 {n} 銀幣收購，改為公營。', { o: o.name, s: Mk.name(f.k), n: price }, o.name); }
    }
    // 遊說:被反壟斷案針對的大老闆私下塞錢給手頭緊的村民,請他們投反對票;被報社揭發就破功
    function lobby(w, d) {
        const P = w.proposals; if (!P) return; const M = S(w);
        for (const p of (P.items || [])) {
            if (!['antitrust', 'antitrust_cap'].includes(p.kind) || p.status !== 'open') continue;
            const o = w.agents[p.refKey]; if (!o || (p._lobby || 0) >= 3 || p._lobbyDay === d || bal(w, o) < 40 || has(o, 'kind')) continue;
            if (!(has(o, 'greedy') || hasV(o, '財富') || Math.random() < 0.5)) continue;
            p._lobbyDay = d; p._lobby = (p._lobby || 0) + 1;
            const PW = typeof POWER !== 'undefined' && POWER.S ? POWER.S(w) : (w.power = w.power || { inf: {} }); PW.inf = PW.inf || {};
            const targets = npcs(w).filter(a => a !== o && bal(w, a) < 50 && !(w.union?.members?.[a.agentId]) && !(PW.inf[a.agentId] || {})[o.agentId] && !has(a, 'stoic')).sort(() => Math.random() - 0.5).slice(0, 2);
            const got = [];
            for (const a of targets) { const n = 5 + Math.floor(Math.random() * 4); if (!WALLET.take(w, o, n)) break; WALLET.add(w, a, n); (PW.inf[a.agentId] = PW.inf[a.agentId] || {})[o.agentId] = (PW.inf[a.agentId][o.agentId] || 0) + n; got.push(a); mem(w, a, '{o}私下塞了 {n} 銀幣給我，請我在{id}投反對票。', { o: o.name, n, id: p.id }, 6); }
            if (!got.length) continue; M.cst.lobby++;
            mem(w, o, '我私下打點了幾個人，{id}應該過不了。', { id: p.id }, 6);
            if (Math.random() < 0.2) { // 被報社揭發
                M.cst.exposed++; for (const a of got) delete PW.inf[a.agentId][o.agentId];
                for (const a of npcs(w)) if (a !== o && Math.random() < 0.5) bump(a, o, -4);
                log(w, '📰 {o}為了{id}私下塞錢給村民的事被揭發了，鎮上一片譁然。', { o: o.name, id: p.id }, o.name);
                news(w, '{o}花錢遊說反壟斷案的事被揭發', { o: o.name }, 8, [o.name]);
                try { if (typeof PRESS !== 'undefined' && w.press?.papers?.length) { const pp = w.press.papers.find(x => !x.banned && x.st !== 'board') || w.press.papers[0]; PRESS.story(w, pp, 'expose', '{o}私下塞錢給村民，想擋下{id}。', { o: o.name, id: p.id }); } } catch (e) {}
            }
        }
    }

    function daily(w) {
        if (!w.observerMode || !w.market || typeof WALLET === 'undefined' || !w.wallet) return; const M = S(w); const d = day(w); if (M.compDay === d) return; M.compDay = d;
        const all = npcs(w);
        try { manage(w, all, d); } catch (e) { console.warn('[Compete] manage', e); }
        try { lobby(w, d); } catch (e) { console.warn('[Compete] lobby', e); }
        if (d % 7 === 2) { try { entry(w, all, d); weekly(w, all, d); capProposal(w, d); divest(w, all, d); } catch (e) { console.warn('[Compete] weekly', e); } }
        // 沒有對手的那一行,價錢慢慢回到原價
        for (const k of Object.keys(M.price)) if (!MK().rivalOf(w, k) && M.price[k] < 1 && d % 7 === 2) M.price[k] = Math.min(1, Math.round((M.price[k] + 0.05) * 100) / 100);
    }
    function row(w, k) {
        const Mk = MK(); const R = Mk.rivalOf(w, k); if (!R) return null; const M = S(w);
        return { owner: t(w.agents[R.owner]?.name || ''), share: Math.round(Mk.shareOf(w, k) * 100), price: Math.round((R.price ?? 1) * 100), incPrice: Math.round((M.price[k] ?? 1) * 100), pay: Math.round((R.pay ?? 1) * 100), staff: empOf(w, k, R, npcs(w)).length, since: R.since, partners: (typeof INVEST !== 'undefined') ? INVEST.partners(w, k) : '' };
    }
    function view(w) { const M = S(w); const X = C(w); return { st: M.cst, saved: Math.round(M.saved || 0), cap: X?.law ? (X.cap || 3) : 0, mgr: Object.entries(M.mgr).map(([key, id]) => ({ s: MK().name(key.split(':')[0]), m: t(w.agents[id]?.name || '') })) }; }
    function brief(w, a) {
        const Mk = MK(); const out = [];
        for (const [k, R] of Object.entries(w.market?.rival || {})) {
            if (!Mk.rivalOf(w, k)) continue; const s = Math.round(Mk.shareOf(w, k) * 100); const inc = w.agents[w.market.owners[k]];
            if (R.owner === a.agentId) out.push(fill('你在{s}這一行開了店，跟{o}搶生意，現在搶到 {p}% 的客人。', { s: Mk.name(k), o: inc?.name || '', p: s }));
            else if (w.market.owners[k] === a.agentId) out.push(fill('{o}在對面開了一家{s}跟你搶生意，被他搶走 {p}% 的客人。', { o: w.agents[R.owner]?.name || '', s: Mk.name(k), p: s }));
            else if (R.emp?.[a.agentId]) out.push(fill('你在{o}新開的{s}做工。', { o: w.agents[R.owner]?.name || '', s: Mk.name(k) }));
        }
        for (const [key, id] of Object.entries(w.market?.mgr || {})) if (id === a.agentId) out.push(fill('你是{s}的掌櫃，替老闆代管。', { s: Mk.name(key.split(':')[0]) }));
        return out.join(' ');
    }
    // 給觀察者看的(第三人稱)
    function describe(w, a) {
        const Mk = MK(); const out = [];
        for (const [k, R] of Object.entries(w.market?.rival || {})) {
            if (!Mk.rivalOf(w, k)) continue; const s = Math.round(Mk.shareOf(w, k) * 100); const inc = w.agents[w.market.owners[k]];
            if (R.owner === a.agentId) out.push(fill('在{s}這一行開店跟{o}搶生意，搶到 {p}% 的客人', { s: Mk.name(k), o: inc?.name || '', p: s }));
            else if (w.market.owners[k] === a.agentId) out.push(fill('{o}在對面開店搶生意，被搶走 {p}% 的客人', { o: w.agents[R.owner]?.name || '', p: s }));
            else if (R.emp?.[a.agentId]) out.push(fill('在{o}新開的{s}做工', { o: w.agents[R.owner]?.name || '', s: Mk.name(k) }));
        }
        for (const [key, id] of Object.entries(w.market?.mgr || {})) if (id === a.agentId) out.push(fill('{s}的掌櫃', { s: Mk.name(key.split(':')[0]) }));
        return out.join(t('；'));
    }
    return { S, daily, entry, weekly, openInfo, openBy, hopInfo, hop, manage, skimInfo, skimBy, capProposal, enactCap, divest, lobby, row, view, brief, describe, profit };
})();
if (typeof window !== 'undefined') window.COMPETE = COMPETE;
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.antitrust_cap = { icon: '⚖️', label: '反壟斷' };
if (typeof ProposalSystem !== 'undefined' && !ProposalSystem.prototype._competeHooked) {
    const PS = ProposalSystem.prototype; PS._competeHooked = true; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { COMPETE.daily(w); } catch (e) { console.warn('[Compete] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'antitrust_cap' && typeof CYCLE !== 'undefined') { const r = CYCLE.antitrustVote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof MARKET !== 'undefined') {
    const _v = MARKET.view; MARKET.view = function (w) { const rows = _v.call(this, w); try { for (const r of rows) r.rival = COMPETE.row(w, r.k); } catch (e) {} return rows; };
    const _br = MARKET.brief; MARKET.brief = function (w, a) { const b = _br.call(this, w, a); let s = ''; try { s = COMPETE.brief(w, a); } catch (e) {} return [b, s].filter(Boolean).join(' '); };
    const _ds = MARKET.describe; MARKET.describe = function (w, a) { const b = _ds.call(this, w, a); let s = ''; try { s = COMPETE.describe(w, a); } catch (e) {} return [b, s].filter(Boolean).join(t('；')); };
}
