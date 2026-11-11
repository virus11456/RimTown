// RimTown - sim-invest.js：v9.8.0 更多人當股東
// 1. 看利息入股:手上有閒錢(錢包＋銀行存款)的村民,每週拿「這家產業一週分紅大概幾 %」跟「銀行存款一週給幾 %」比
//    - 分紅比利息好、而且好到夠彌補風險(謹慎的人要多一點,敢衝的人少一點),就向當家買一份股份;錢不夠先從銀行領
//    - 當家看個性與手頭決定賣不賣;被抓過做假帳的當家,大家心裡會打折
// 2. 退股存銀行:小股東連三週算下來分紅都比銀行利息差,就把股份賣回給當家(或別的有錢人),錢存回銀行
// 3. 朋友合夥開新店:某一行很賺、想在對面開店的人一個人出不起本錢,就找交情好的朋友一起出錢,照出資比例拿股份
//    - 新店每週照股份分紅(利潤的六成);收攤時大家一起賠;新店把原本那家併掉時,合夥人變成合併後那家的股東
//    - 合夥人過世由家人繼承股份;老闆過世沒有家人,由股份最多的合夥人接手(以前會直接關門)
// 全部是錢包之間轉帳或錢包與銀行存款互轉(銀幣守恆)。必須在 sim-shares.js、sim-compete.js、sim-bank.js 之後載入。
'use strict';

const INVEST = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a?.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const r2 = (n) => Math.round(n * 100) / 100;
    const pct1 = (y) => Math.round(y * 1000) / 10; // 0.023 → 2.3
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const news = (w, k, p, imp, nm) => { try { w.dailyNews?.collectEvent?.('economy', fill(k, p), imp || 6, nm || []); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const present = (w, id) => !!id && (!!w.agents?.[id] || !!w.isAway?.(id));
    const cash = (w, a) => (a && typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const dep = (w, a) => (a && w.bank?.open ? (w.bank.dep?.[a.agentId] || 0) : 0);
    const MK = () => MARKET, SH = () => SHARES;
    const nm = (k) => MK().name(k);

    function S(w) {
        const M = MK().S(w); const X = M.inv = M.inv && typeof M.inv === 'object' ? M.inv : {};
        X.st = X.st || { buy: 0, out: 0, refuse: 0, coop: 0, coopDiv: 0, coopLost: 0 }; X.low = X.low || {}; X.lastPaid = X.lastPaid ?? null;
        return X;
    }

    // ---------- 銀行一週實際給幾 % ----------
    // 存款利息是從放款賺的利息裡付,賺不夠就打折;用上週實際付出去的比例估,沒有紀錄就照牌告利率打對折
    function bankYield(w) {
        const B = w.bank; if (!B?.open || B.status !== 'ok') return 0; const X = S(w);
        return X.bankY != null ? X.bankY : (B.depRate || 0) * 0.5;
    }
    function trackBank(w) {
        const B = w.bank; const X = S(w); if (!B?.open) { X.bankY = null; X.lastPaid = null; return; }
        const paid = B.interestPaid || 0; const tot = Object.values(B.dep || {}).reduce((s, v) => s + v, 0);
        if (X.lastPaid != null && tot > 0) X.bankY = Math.max(0, Math.min(0.05, (paid - X.lastPaid) / tot));
        X.lastPaid = paid;
    }
    // 這家產業一週分紅大約是股價的幾 %:利潤的六成照股份分(SHARES.weekly 的規則)
    function firmYield(w, k) {
        const v = SH().valueOf(w, k); if (!(v > 0)) return 0;
        return Math.max(0, SH().profit7(w, k)) * 0.6 / v;
    }
    // 每 1% 股份一週大概分多少銀幣
    const perPct = (w, k) => Math.max(0, SH().profit7(w, k)) * 0.6 / 100;
    // 當家開價:帳面估價跟「幾週回本」取高的(產業估價只算人手與設備,很賺的店不會照帳面賣)。貪心的要回本久一點才肯賣,心腸好的開得低;缺錢的急著賣
    function payback(w, boss) {
        let n = (has(boss, 'greedy') || hasV(boss, '財富')) ? 36 : (has(boss, 'stubborn') || hasV(boss, '傳統')) ? 30 : (has(boss, 'kind') || has(boss, 'generous')) ? 18 : 24;
        if (cash(w, boss) < 30) n *= 0.75; return n;
    }
    const askPrice = (w, k, p, boss) => Math.max(SH().priceOf(w, k, p, 1.05), Math.round(perPct(w, k) * p * payback(w, boss)));
    // 謹慎的人要求分紅比利息多很多才肯冒險;敢衝、做生意的人要求少
    function hurdle(a) {
        if (has(a, 'greedy') || has(a, 'ambitious') || hasV(a, '財富') || ['trader', 'banker'].includes(a.job?.key)) return 0.004;
        if (has(a, 'thrifty') || has(a, 'stoic') || has(a, 'ascetic') || has(a, 'neurotic') || hasV(a, '傳統')) return 0.025;
        return 0.012;
    }
    const trusts = (w, k, a) => { const X = SH().S(w).sh; const ang = X.angry?.[k]; return !(ang && Object.keys(ang).length); };

    // 付錢:錢包不夠就先從銀行領(真的領得出來才算)
    function fund(w, a, n) {
        if (cash(w, a) >= n) return true;
        if (typeof BANK === 'undefined' || !w.bank?.open) return false;
        const need = Math.ceil(n - cash(w, a)); if (dep(w, a) < need) return false;
        BANK.withdraw(w, w.bank, a, need); return cash(w, a) >= n;
    }

    // ---------- 1. 看利息入股 ----------
    // v9.19.0 誰要入股、入哪一家,改由決策核心(sim-decide.js)在村民「手上有閒錢」時自己挑;這裡只報價(quotes)和成交(buy)。
    // 報價:這個人現在買得起、也還有股份可賣的產業,各開一個價;y 是照開價算一週分紅大約是本錢的幾 %(當家被抓過做假帳的打六折看)
    function quotes(w, a) {
        if (!a || (a.age ?? 30) < 18 || typeof SHARES === 'undefined' || !w.market || (w.civic?.jail?.[a.agentId] > day(w))) return [];
        const M = SH().S(w); const savings = cash(w, a) + dep(w, a); if (savings < 60) return []; const by = bankYield(w); const out = [];
        const firms = Object.keys(MK().SECTORS).filter(k => M.owners[k] && w.agents[M.owners[k]] && perPct(w, k) > 0).map(k => [k, perPct(w, k)]).sort((x, y) => y[1] - x[1]);
        for (const [k, pp] of firms) {
            const s = SH().stakes(w, k); const bossId = M.owners[k]; const boss = w.agents[bossId];
            if (!boss || s[a.agentId] || bossId === a.agentId || Object.keys(s).length >= SH().maxH(w)) continue;
            const budget = savings * (has(a, 'thrifty') ? 0.3 : 0.5);
            let p = Math.min(20, (s[bossId] || 0) - 40); if (p < 5) continue;
            while (p >= 5 && askPrice(w, k, p, boss) > budget) p -= 5; if (p < 5) continue;
            const price = askPrice(w, k, p, boss); const y = pp * p / price;
            out.push({ k, p, price, y: trusts(w, k, a) ? y : y * 0.6, by, boss });
        }
        return out;
    }
    // 成交:當家賣不賣看他自己(缺錢、貪心的爽快;固執、守舊的不太肯;交情好的比較好說話)。回傳 { ok, refused, k, p, price }
    function buy(w, a, k) {
        const X = S(w); const q = quotes(w, a).find(x => x.k === k); if (!q) return { ok: false };
        const { p, price, boss, by } = q; const bossId = boss.agentId;
        const yes = cash(w, boss) < 30 || has(boss, 'greedy') ? 0.85 : (has(boss, 'stubborn') || hasV(boss, '傳統')) ? 0.2 : aff(boss, a) >= 30 ? 0.65 : 0.45;
        if (Math.random() > yes) {
            X.st.refuse++; log(w, '🙅 {a}想用存款入股{s}，{o}不肯賣。', { a: a.name, s: nm(k), o: boss.name }, boss.name); bump(a, boss, -2);
            return { ok: false, refused: true, k, p, price, boss };
        }
        if (!fund(w, a, price) || !SH().transfer(w, k, bossId, a.agentId, p, price)) return { ok: false };
        X.st.buy++; SH().S(w).sh.st.buy++;
        const by1 = pct1(by), y1 = pct1(q.y);
        log(w, '📊 {a}算了一下：{s}一週分紅大約 {y}%，銀行存款一週才 {r}%，就拿 {n} 銀幣向{o}買了 {p}% 股份。', { a: a.name, s: nm(k), y: y1, r: by1, n: price, o: boss.name, p }, a.name);
        mem(w, a, '我算過，{s}一週分紅大約 {y}%，比銀行利息 {r}% 好，就買了 {p}% 股份。', { s: nm(k), y: y1, r: by1, p }, 7);
        mem(w, boss, '{a}用存款買了{s} {p}% 的股份。', { a: a.name, s: nm(k), p }, 5);
        news(w, '📊 {a}把存款拿去入股{s}', { a: a.name, s: nm(k) }, 5, [a.name]);
        try { SH().note?.(w, k, '看利息入股', { a: a.name }); } catch (e) {}
        return { ok: true, k, p, price, boss };
    }

    // ---------- 2. 退股存銀行 ----------
    function cashOuts(w, all, d) {
        const X = S(w); const M = SH().S(w); const by = bankYield(w); if (!(by > 0) || typeof BANK === 'undefined') return;
        for (const k of Object.keys(MK().SECTORS)) {
            const bossId = M.owners[k]; const boss = w.agents[bossId]; if (!boss) continue; const y = firmYield(w, k);
            for (const h of Object.keys(SH().stakes(w, k))) {
                if (h === bossId) continue; const a = w.agents[h]; if (!a) continue; const key = k + '|' + h;
                X.low[key] = y < by * 0.8 ? (X.low[key] || 0) + 1 : 0;
                if (X.low[key] < 3 || Math.random() > 0.5) continue;
                const p = SH().pctOf(w, k, h); const price = SH().priceOf(w, k, p, 0.9);
                const buyer = cash(w, boss) >= price + 10 ? boss : all.filter(o => o.agentId !== h && o.agentId !== bossId && cash(w, o) >= price + 30 && firmYield(w, k) >= bankYield(w)).sort((x, z) => cash(w, z) - cash(w, x))[0];
                if (!buyer || !SH().transfer(w, k, h, buyer.agentId, p, price)) continue;
                const put = BANK.deposit(w, w.bank, a, price);
                X.st.out++; delete X.low[key];
                log(w, '🏦 {a}算來算去，{s}的分紅一週不到 {y}%，還不如銀行的 {r}%，把 {p}% 股份以 {n} 銀幣賣給{b}，錢存進銀行。', { a: a.name, s: nm(k), y: pct1(y) || 0, r: pct1(by), p, n: price, b: buyer.name }, a.name);
                mem(w, a, '{s}的分紅比銀行利息還差，我把股份賣了，錢存銀行比較實在。', { s: nm(k) }, 6);
                if (buyer !== boss) mem(w, buyer, '我接手了{a}在{s}的 {p}% 股份。', { a: a.name, s: nm(k), p }, 5);
                if (put > 0 && Math.random() < 0.3) mem(w, a, '我把 {n} 銀幣存進銀行，放著也會生利息。', { n: put }, 4);
                try { SH().note?.(w, k, '退股存銀行', { a: a.name, b: buyer.name }); } catch (e) {}
            }
        }
    }

    // ---------- 3. 朋友合夥開新店(由 COMPETE.entry 呼叫) ----------
    // 回傳 { lead, parts:[[a, 出資]] },已經從每個人錢包扣好錢;湊不到就回傳 null
    function partner(w, all, k, cost, bossId, score) {
        const boss = w.agents[bossId]; const Mk = MK();
        const leads = all.filter(a => a.agentId !== bossId && (a.age ?? 30) >= 18 && cash(w, a) >= cost * 0.35 && Mk.canBuy(w, a.agentId) && !(w.civic?.jail?.[a.agentId] > day(w)))
            .map(a => [a, score(a)]).filter(([, s]) => s >= 2).sort((x, y) => y[1] - x[1]);
        for (const [lead] of leads.slice(0, 3)) {
            const mine = r2(Math.min(cash(w, lead) * 0.8, cost * 0.7)); let need = cost - mine; const parts = [[lead, mine]];
            const friends = all.filter(o => o !== lead && o.agentId !== bossId && (o.age ?? 30) >= 18 && aff(o, lead) >= 30 && aff(lead, o) >= 20 && cash(w, o) >= 15 && aff(o, boss) < 50)
                .sort((x, y) => aff(y, lead) - aff(x, lead) || cash(w, y) - cash(w, x));
            for (const f of friends) {
                if (need <= 0.5 || parts.length >= 4) break;
                const put = r2(Math.min(need, cash(w, f) * (has(f, 'thrifty') ? 0.4 : 0.6), cost * 0.45)); if (put < Math.min(cost * 0.1, need - 0.01)) continue; /* 最後補一點零頭也算 */
                parts.push([f, put]); need -= put;
            }
            if (need > 0.5 || parts.length < 2) continue;
            const paid = [];
            for (const [a, n] of parts) { if (WALLET.take(w, a, n)) paid.push([a, n]); else break; }
            if (paid.length < parts.length) { for (const [a, n] of paid) WALLET.add(w, a, n); continue; }
            return { lead, parts: paid };
        }
        return null;
    }
    // 開店時記下合夥人的股份
    function setup(w, k, R, deal) {
        const s = {}; for (const [a, n] of deal.parts) s[a.agentId] = n; R.sh = SH().norm(s);
        const X = S(w); X.st.coop++;
        const others = deal.parts.slice(1).map(([a]) => a); const lead = deal.lead;
        log(w, '🤝 {a}一個人出不起開店的本錢，找了{b}一起合夥，在對面開了一家{s}。', { a: lead.name, b: others.map(x => x.name).join(t('、')), s: nm(k) }, lead.name);
        news(w, '🤝 {a}和{b}合夥開了一家{s}', { a: lead.name, b: others.map(x => x.name).join(t('、')), s: nm(k) }, 7, [lead.name, ...others.map(x => x.name)]);
        for (const o of others) { mem(w, o, '我出錢跟{a}合夥開了一家{s}，佔 {p}% 的股份。', { a: lead.name, s: nm(k), p: R.sh[o.agentId] || 0 }, 7); bump(o, lead, 5); bump(lead, o, 5); }
    }
    // 合夥人名單整理:不在鎮上的拿掉、老闆一定在裡面;只剩一個人就不算合夥
    function sh(w, R) {
        if (!R || !R.sh) return null; const s = R.sh;
        for (const id of Object.keys(s)) if (!present(w, id)) delete s[id];
        if (!(R.owner in s)) s[R.owner] = Object.keys(s).length ? 1 : 100;
        R.sh = SH().norm(s); if (Object.keys(R.sh).length < 2) { delete R.sh; return null; }
        return R.sh;
    }
    // 每週分紅(由 COMPETE.weekly 在繳完稅後呼叫)
    function rivalDividend(w, k, R, profit) {
        const s = sh(w, R); if (!s || !(profit > 0)) return 0; const own = w.agents[R.owner]; if (!own) return 0;
        const pool = profit * 0.6; let paid = 0;
        for (const [id, p] of Object.entries(s)) {
            if (id === R.owner) continue; const a = w.agents[id]; const due = r2(pool * p / 100); if (!a || due < 0.5) continue;
            if (WALLET.take(w, own, due)) { WALLET.add(w, a, due); paid += due; if (due >= 5 && Math.random() < 0.3) mem(w, a, '{o}的{s}這週分紅，我拿到 {n} 銀幣。', { o: own.name, s: nm(k), n: Math.round(due) }, 4); }
        }
        R.div = r2((R.div || 0) + paid); S(w).st.coopDiv = r2(S(w).st.coopDiv + paid);
        return paid;
    }
    // 收攤:合夥人一起賠
    function rivalClosed(w, k, R) {
        const s = R && R.sh; if (!s) return; const own = w.agents[R.owner]; let n = 0;
        for (const id of Object.keys(s)) { if (id === R.owner) continue; const a = w.agents[id]; if (!a) continue; n++; mem(w, a, '我跟{o}合夥開的{s}收攤了，投進去的錢都賠掉了。', { o: own?.name || '', s: nm(k) }, 7); bump(a, own, -6); }
        if (n) S(w).st.coopLost += n;
    }
    // 併購原本那家:合夥人變成合併後那家的股東
    function rivalMerged(w, k, R) {
        const s = sh(w, R); if (!s) return false; const M = SH().S(w);
        M.shares[k] = Object.assign({}, s); M.owners[k] = R.owner; return true;
    }

    // ---------- 合夥人過世 ----------
    function onDeath(world, npc, snap, heir) {
        const M = MK().S(world);
        for (const [k, was] of Object.entries(snap)) {
            const R = M.rival?.[k]; const p = was.sh[npc.agentId] || 0; if (!p) continue;
            if (was.owner === npc.agentId) {
                if (R && R.owner !== npc.agentId) { // 家人接手:股份跟著過去
                    R.sh = Object.assign({}, was.sh); delete R.sh[npc.agentId]; R.sh[R.owner] = (R.sh[R.owner] || 0) + p; sh(world, R); continue;
                }
                const merged = !R && heir && M.owners[k] === heir.agentId; // 繼承人本來就是原本那家的老闆:兩家併成一家
                if (merged) { const s = Object.assign({}, was.sh); delete s[npc.agentId]; const cur = SH().stakes(world, k); const out = Object.assign({}, cur);
                    for (const [id, q] of Object.entries(s)) if (present(world, id)) out[id] = (out[id] || 0) + q * 0.5; M.shares[k] = SH().norm(out); M.owners[k] = heir.agentId; continue; }
                continue;
            }
            if (!R || !R.sh) continue; // 合夥人過世:家人繼承,沒有家人就照比例分給其他人
            delete R.sh[npc.agentId];
            if (heir && present(world, heir.agentId)) { R.sh[heir.agentId] = (R.sh[heir.agentId] || 0) + p; log(world, '📜 {h}繼承了{o}在{a}那家{s}的 {p}% 股份。', { h: heir.name, o: npc.name, a: world.agents[R.owner]?.name || '', s: nm(k), p }, heir.name); mem(world, heir, '我繼承了{o}合夥開店的股份。', { o: npc.name }, 6); }
            sh(world, R);
        }
    }

    // ---------- 每週 ----------
    function weekly(w) {
        if (!w.observerMode || !w.market || typeof WALLET === 'undefined' || !w.wallet || typeof SHARES === 'undefined') return;
        const X = S(w); const d = day(w); if (X.day === d) return; X.day = d;
        trackBank(w); const all = npcs(w);
        try { cashOuts(w, all, d); } catch (e) { console.warn('[Invest] weekly', e); } // v9.19.0 入股改由決策核心處理
    }

    // ---------- 給 AI 與觀察者 ----------
    function brief(w, a) {
        const out = []; const by = bankYield(w);
        for (const [k, R] of Object.entries(w.market?.rival || {})) {
            if (!MK().rivalOf(w, k) || !R.sh || !R.sh[a.agentId]) continue;
            if (R.owner === a.agentId) out.push(fill('你跟{b}合夥開店，你佔 {p}%。', { b: Object.keys(R.sh).filter(id => id !== a.agentId).map(id => w.agents[id]?.name || '').filter(Boolean).join(t('、')), p: R.sh[a.agentId] }));
            else out.push(fill('你跟{o}合夥開了{s}，佔 {p}% 的股份。', { o: w.agents[R.owner]?.name || '', s: nm(k), p: R.sh[a.agentId] }));
        }
        if (by > 0 && cash(w, a) + dep(w, a) >= 60) out.push(fill('銀行存款現在一週大約給 {r}% 利息。', { r: pct1(by) }));
        return out.join(' ');
    }
    function describe(w, a) {
        const out = [];
        for (const [k, R] of Object.entries(w.market?.rival || {})) { if (!MK().rivalOf(w, k) || !R.sh || !R.sh[a.agentId] || R.owner === a.agentId) continue; out.push(fill('{o}的{s}合夥人（{p}%）', { o: w.agents[R.owner]?.name || '', s: nm(k), p: R.sh[a.agentId] })); }
        return out.join(t('、'));
    }
    function partners(w, k) { const R = MK().rivalOf(w, k); const s = R && sh(w, R); if (!s) return ''; return Object.keys(s).sort((a, b) => s[b] - s[a]).map(id => `${t(w.agents[id]?.name || '')} ${s[id]}%`).join(t('・')); }
    function view(w) { const X = S(w); return { st: X.st, bank: pct1(bankYield(w)), best: (() => { try { const M = SH().S(w); return Object.keys(MK().SECTORS).filter(k => M.owners[k] && perPct(w, k) > 0).map(k => ({ s: nm(k), y: Math.round(perPct(w, k) * 10) / 10 })).sort((a, b) => b.y - a.y).slice(0, 3); } catch (e) { return []; } })() }; }

    return { S, bankYield, trackBank, firmYield, perPct, payback, askPrice, hurdle, fund, quotes, buy, cashOuts, partner, setup, sh, rivalDividend, rivalClosed, rivalMerged, onDeath, weekly, brief, describe, partners, view };
})();
if (typeof window !== 'undefined') window.INVEST = INVEST;

// 每週跟在股份分紅之後跑(MARKET.daily 已經被 SHARES 包過一層,再包一層)
if (typeof MARKET !== 'undefined') {
    const _d = MARKET.daily;
    MARKET.daily = function (w, ...args) { const r = _d.call(this, w, ...args); try { if (w && w._absDay && w._absDay() % 7 === 0) INVEST.weekly(w); } catch (e) { console.warn('[Invest] daily', e); } return r; };
    const _br = MARKET.brief;
    MARKET.brief = function (w, a) { const b = _br.call(this, w, a); let s = ''; try { s = INVEST.brief(w, a); } catch (e) {} return [b, s].filter(Boolean).join(' '); };
    const _ds = MARKET.describe;
    MARKET.describe = function (w, a) { const b = _ds.call(this, w, a); let s = ''; try { s = INVEST.describe(w, a); } catch (e) {} return [b, s].filter(Boolean).join(t('；')); };
}
// 合夥人(或合夥開店的老闆)過世
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let snap = null, heir = null;
        try { const RV = world.market?.rival || {}; for (const [k, R] of Object.entries(RV)) if (R && R.sh && npc && npc.agentId in R.sh) { (snap = snap || {})[k] = { owner: R.owner, sh: Object.assign({}, R.sh), R: JSON.parse(JSON.stringify(R)) }; } if (snap) heir = (MARKET.heirsAll(world, npc) || [])[0] || null; } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        if (npc && !npc.isDead && world.agents?.[npc.agentId]) return r; // v9.9.4 冥王之血復活了:不分遺產
        try { if (snap) INVEST.onDeath(world, npc, snap, heir); } catch (e) { console.warn('[Invest] death', e); }
        return r;
    };
}
