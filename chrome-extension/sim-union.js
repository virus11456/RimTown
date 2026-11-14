// v6.93.0 工會
// - 升格為城市以後才有工會(村莊、城鎮只有工人自發的罷工);私人產業的工人被壓薪、欠薪、挨餓的人一多,有號召力的人會出來組工會;之後每週有人入會(看委屈程度、跟領袖和老闆的交情)
// - 會員每週繳一點會費存成罷工基金
// - 集體談判:某產業的會員過半、工資沒給足,工會就找老闆談加薪;老闆依個性:讓步、拒絕、收買工會領袖(真相頁看得到)、開除帶頭的人(兩週沒工作)
// - 談不攏就由工會發動罷工:只有會員罷工,沒入會的照常上工(工賊,會員會記恨);罷工期間基金每天發補貼,基金見底或撐太久罷工就失敗、有人退會
// - 政治:工會領袖可能出來選鎮長,會員多半投他、不投老闆;有錢的老闆反過來不投他;工會在時最低工資提案更常出現、會員都支持
// - AI 知道自己是不是會員／領袖,老闆知道自己有多少工人入了會
const UNION = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const rel = (a, b) => (a && b ? a.relationships?.getOrCreate?.(b.agentId, b.name) : null);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const cash = (w, a) => (WL() && w.wallet ? WALLET.get(w, a) : 0);
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const STRIKE_PAY = 2, STRIKE_MAX = 6, DUES = 1;
    const tierLv = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { return 0; } };

    function S(w) {
        if (!w.union || typeof w.union !== 'object') w.union = { on: false, name: '', leader: null, members: {}, fund: 0, founded: null, strikes: 0, won: 0, lost: 0, bribed: 0, fired: 0, raises: 0, talks: {}, strike: {}, firedUntil: {}, lastDay: -1, history: [] };
        const U = w.union; U.members = U.members || {}; U.talks = U.talks || {}; U.strike = U.strike || {}; U.firedUntil = U.firedUntil || {}; U.history = U.history || []; U.sour = U.sour || {}; U.ask = U.ask || {}; return U;
    }
    // 在私人產業做工(不是老闆自己)的人
    function sectorOf(w, a) { const M = MK(); if (!M || !w.market) return null; const k = M.JOB2S[a?.job?.key]; if (!k) return null; const o = M.ownerOf(w, k); return o && o !== a.agentId ? k : null; }
    const privateWorkers = (w, all) => all.filter(a => (a.age || 30) >= 16 && sectorOf(w, a));
    const isMember = (w, a) => !!(w.union?.on && a && w.union.members[a.agentId]);
    function grievance(w, a) {
        const M = MK(); const k = sectorOf(w, a); if (!k) return 0; let g = 0;
        const rate = M.payRate(w, k); if (rate < 1) g += (1 - rate) * 2.5;
        const boss = M.ownerOf(w, k); if ((w.market.unpaid?.[boss] || 0) > 0) g += 0.3;
        if (M.isHungry && M.isHungry(w, a) >= 2) g += 0.25;
        if ((a.mood ?? 50) < 40) g += 0.15;
        return g;
    }
    const leadBase = (w, a) => (has(a, 'charismatic') ? 3 : 0) + (has(a, 'abrasive') ? 1 : 0) + (has(a, 'pessimist') ? 0.5 : 0) + (a.skills?.skills?.社交?.level || 0) * 0.4 + grievance(w, a) * 2;
    const leaderScore = (w, a) => leadBase(w, a) + Math.random();
    // v9.21.0 決策核心階段 3:要不要帶頭組工會、加入、退出、跟不跟罷工、老闆答不答應,交給本人決定(sim-decide-pol.js);這裡只留「做得到什麼」和「做了怎麼結算」
    const here = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);

    // ---------- 組工會、入會、退會、會費 ----------
    // 現在組不組得起工會、這個人是不是適合帶頭的那幾個(回傳一起不滿的人數)
    function canOrganize(w, a) {
        const U = S(w); if (U.on || tierLv(w) < 2 || !MK() || !w.market || !sectorOf(w, a) || grievance(w, a) < 0.3) return 0;
        const ws = privateWorkers(w, npcs(w)); if (ws.length < 6) return 0; const angry = ws.filter(x => grievance(w, x) >= 0.3); if (angry.length < 4) return 0;
        const top = angry.slice().sort((x, y) => leadBase(w, y) - leadBase(w, x)).slice(0, 3); return top.includes(a) ? angry.length : 0;
    }
    function start(w, lead, others, d = day(w)) {
        const U = S(w); if (U.on || !lead) return false;
        U.on = true; U.founded = d; U.leader = lead.agentId; U.members = { [lead.agentId]: d }; for (const a of (others || [])) U.members[a.agentId] = d;
        U.name = (w.townName ? t(w.townName) : '') + t('工人聯合會');
        log(w, '✊ {a}號召{n}個工人成立了「{u}」，要一起跟老闆爭取工資。', { a: lead.name, n: Object.keys(U.members).length, u: U.name }, lead.name);
        for (const id of Object.keys(U.members)) mem(w, w.agents[id], id === lead.agentId ? '我帶頭成立了工會，大家團結起來才不會一直被壓榨。' : '我加入了{a}組的工會，希望大家一起爭取到合理的工資。', { a: lead.name }, 7);
        U.history.push({ d, k: 'found', who: lead.name }); return true;
    }
    // 入會、退會(擲骰版和本人決定共用)
    function join(w, a, d = day(w)) { const U = S(w); if (!U.on || !a || U.members[a.agentId] || !sectorOf(w, a)) return false; U.members[a.agentId] = d; mem(w, a, '我加入了{u}，大家團結才有籌碼。', { u: U.name }, 6); rel(a, w.agents[U.leader])?.modifyAffinity?.(4); return true; }
    function leave(w, a, why) { const U = S(w); if (!a || !U.members[a.agentId] || U.leader === a.agentId) return false; delete U.members[a.agentId]; delete U.sour[a.agentId];
        mem(w, a, why === 'lost' ? '我退出工會了，罷工根本沒用。' : '日子過得去了，我退出了工會，會費省下來。', {}, why === 'lost' ? 5 : 4); return true; }
    function membership(w, all, d) { // 要不要加入、待遇好了要不要退會，由本人決定(選擇點 union／unionout)；這裡只管會員名冊與領袖
        const U = S(w); const lead = w.agents[U.leader];
        const gone = []; for (const id of Object.keys(U.members)) { const a = w.agents[id]; if (!a && w.isAway?.(id)) continue; /* v9.9.4 出遠門還是會員 */ if (!a || a.isDead || !sectorOf(w, a)) { delete U.members[id]; if (a && !a.isDead) gone.push(a); } }
        // 領袖不在了(過世、離鎮、當了老闆):會員裡最有號召力的人接手
        if ((!lead && !w.isAway?.(U.leader)) || lead?.isDead || !U.members[U.leader]) { // v9.9.4 領袖出遠門不換人
            const pool = Object.keys(U.members).map(id => w.agents[id]).filter(Boolean);
            if (!pool.length) { U.on = false; U.leader = null; refund(w, gone); log(w, '🥀 {u}沒有會員了，就此解散。', { u: U.name }); U.history.push({ d, k: 'dissolve' }); return; }
            const nl = pool.sort((x, y) => leaderScore(w, y) - leaderScore(w, x))[0]; U.leader = nl.agentId;
            log(w, '✊ {a}接下了{u}的領袖。', { a: nl.name, u: U.name }, nl.name); mem(w, nl, '我接下了工會領袖，要替大家爭取。', {}, 7);
        }
        // 領袖收老闆錢的事被揭發(真相頁):會員把他趕下台
        try { if (typeof DARK !== 'undefined' && w.dark) { const sc = (DARK.S(w).secrets || []).find(x => x.kind === 'union_bribe' && x.found && !x.unionDone && x.culprit === U.leader);
            if (sc) { sc.unionDone = true; const old = w.agents[U.leader]; delete U.members[U.leader]; const pool = Object.keys(U.members).map(id => w.agents[id]).filter(Boolean);
                for (const m of pool) { rel(m, old)?.modifyAffinity?.(-20); if (Math.random() < 0.5) mem(w, m, '原來{a}收了老闆的錢，我們被出賣了。', { a: old?.name || '' }, 8); }
                if (pool.length) { const nl = pool.sort((x, y) => leaderScore(w, y) - leaderScore(w, x))[0]; U.leader = nl.agentId; log(w, '💥 {a}收老闆錢的事曝光，被{u}趕下台，改由{b}帶領。', { a: old?.name || '', u: U.name, b: nl.name }, nl.name); }
                else { U.on = false; U.leader = null; refund(w, old && !old.isDead ? [old] : []); } U.history.push({ d, k: 'ousted' }); if (!U.on) return; } } } catch (e) {}
        for (const [id, d0] of Object.entries(U.sour)) if (d - d0 > 10 || !U.members[id]) delete U.sour[id];
    }
    // 解散時把罷工基金分還給最後的會員(沒人可分就進公庫),錢不會憑空消失
    function refund(w, people) {
        const U = S(w); const n = Math.floor(U.fund * 100) / 100; if (n <= 0) return; const Wl = WL();
        if (people.length && Wl) { const each = Math.floor(n / people.length * 100) / 100; people.forEach((a, i) => Wl.add(w, a, i === 0 ? Math.round((n - each * (people.length - 1)) * 100) / 100 : each)); } // 分不完的零頭給第一位(以前零頭跟著基金歸零消失)
        else w.stockpile?.add?.('silver', n, w.tickCount, t('工會解散的基金'));
        U.fund = 0;
    }
    function dues(w) {
        const U = S(w); const Wl = WL(); if (!Wl) return; let got = 0;
        for (const id of Object.keys(U.members)) { const a = w.agents[id]; if (!a) continue; const c = cash(w, a); if (c < 3) continue; const n = Math.min(DUES, Math.round(c * 0.03 * 100) / 100); if (n > 0 && Wl.take(w, a, n)) got += n; }
        U.fund = Math.round((U.fund + got) * 100) / 100;
    }

    // ---------- 集體談判 ----------
    // 這一行現在談得起來嗎(會員過半、工資被壓);只回傳談判桌上的情況,不動任何東西
    function talkInfo(w, k, all = npcs(w)) {
        const U = S(w); const M = MK(); const L = w.agents[U.leader]; if (!U.on || !L || !M?.SECTORS?.[k]) return null;
        const bossId = M.ownerOf(w, k); if (!bossId || U.strike[k]) return null;
        const ws = M.workersOf(w, k, all).filter(a => a.agentId !== bossId); const mem_ = ws.filter(a => U.members[a.agentId]);
        if (mem_.length < 2 || mem_.length < ws.length / 2) return null;
        const rate = M.payRate(w, k); if (rate >= 1) return null;
        const boss = w.agents[bossId]; if (!boss) return null; const want = Math.min(1.1, Math.round((rate + 0.1) * 100) / 100);
        const bill = ws.reduce((s, a) => s + (WALLET.WAGE[a.job?.key] || 4), 0) * 7;
        const greedy = has(boss, 'greedy'), kind = has(boss, 'kind');
        const h = w.market.hist?.[k] || []; const profit = h.reduce((x, [rv, c]) => x + rv - c, 0); // 最近一週賺不賺錢
        // 老闆不會輕易讓步:賺錢、手頭寬、心腸軟才比較肯;吝嗇的談判桌上從不讓步
        const pYes = greedy ? 0 : (kind ? 0.55 : 0.2) + (profit > bill * 0.5 ? 0.2 : profit < 0 ? -0.15 : 0) + (cash(w, boss) > bill * 2 ? 0.1 : 0);
        return { k, L, bossId, boss, ws, mem_, rate, want, bill, greedy, kind, profit, pYes, corruptible: has(L, 'greedy') || cash(w, L) < 10, canStrike: U.fund >= mem_.length * STRIKE_PAY * 2 };
    }
    // 談判的四種結果(擲骰版和老闆自己決定共用)
    function deal(w, T, d = day(w)) {
        const U = S(w); const M = MK(); w.market.pay[T.k] = T.want; U.raises++; U.won++;
        log(w, '🤝 {u}跟{o}談成了，{s}的工資調到原本的 {p}%。', { u: U.name, o: T.boss.name, s: M.name(T.k), p: Math.round(T.want * 100) }, T.boss.name);
        for (const a of T.mem_) mem(w, a, '工會跟{o}談成加薪了，團結真的有用。', { o: T.boss.name }, 6);
        mem(w, T.boss, '工會來談，我答應把{s}的工資調高。', { s: M.name(T.k) }, 5); U.history.push({ d, k: 'deal', s: T.k });
    }
    function bribe(w, T, d = day(w)) {
        const U = S(w); const M = MK(); const n = 30; const L = T.L; if (!WL().take(w, T.boss, n)) return false;
        WL().add(w, L, n); U.bribed++; U.talks[T.k] = d + 30; // 拿了錢,一個月不提這家
        try { if (typeof DARK !== 'undefined') DARK.secret(w, { kind: 'union_bribe', culprit: L.agentId, victim: null, k: '{l}私下收了{o}{n} 銀幣，答應工會不再找{s}的麻煩', p: { l: L.name, o: T.boss.name, n, s: M.name(T.k) } }); } catch (e) {}
        mem(w, L, '{o}塞給我 {n} 銀幣，要我別再帶人去吵。', { o: T.boss.name, n }, 7); log(w, '🤐 {u}跟{o}的談判不了了之。', { u: U.name, o: T.boss.name }, T.boss.name); U.history.push({ d, k: 'bribe', s: T.k });
        return true;
    }
    function bribeRefused(w, T) {
        mem(w, T.L, '{o}想塞錢要我別再帶人去吵，我把錢退了回去。', { o: T.boss.name }, 7); mem(w, T.boss, '我想私下拿錢擺平{l}，被他退了回來。', { l: T.L.name }, 6);
        rel(T.L, T.boss)?.modifyAffinity?.(-10);
    }
    function fireLead(w, T, d = day(w)) {
        const U = S(w); const tgt = T.mem_.slice().sort((x, y) => leaderScore(w, y) - leaderScore(w, x))[0]; if (!tgt) return null;
        U.firedUntil[tgt.agentId] = d + 14; U.fired++;
        log(w, '🚪 {o}開除了帶頭要加薪的{a}。', { o: T.boss.name, a: tgt.name }, T.boss.name); mem(w, tgt, '{o}因為我帶頭要加薪，把我開除了，兩週沒工作。', { o: T.boss.name }, 8);
        rel(tgt, T.boss)?.modifyAffinity?.(-25); for (const a of T.mem_) if (a !== tgt) rel(a, T.boss)?.modifyAffinity?.(-8);
        U.history.push({ d, k: 'fire', s: T.k }); return tgt;
    }
    // 談判破裂 → 罷工(基金要撐得了幾天);回傳有沒有罷工成
    function walkout(w, T, d = day(w), ask = false) { // ask = 會員各自決定跟不跟(老闆親口回絕時才問；老闆不在鎮上那條路不問)
        const U = S(w); const M = MK(); const { k, boss, mem_, ws } = T;
        if (U.fund >= mem_.length * STRIKE_PAY * 2) {
            U.strike[k] = { start: d, until: d + STRIKE_MAX, members: mem_.map(a => a.agentId), boss: T.bossId, want: T.want };
            U.strikes++; if (w.market) w.market.strikes = (w.market.strikes || 0) + 1;
            log(w, '✊ {u}在{s}發動罷工，{n} 個會員不上工，要{o}加薪。', { u: U.name, s: M.name(k), n: mem_.length, o: boss.name }, boss.name);
            for (const a of mem_) mem(w, a, '工會宣布罷工，我跟大家一起不去{s}上工。', { s: M.name(k) }, 7);
            const scabs = ws.filter(a => !U.members[a.agentId]);
            for (const s of scabs) { for (const a of mem_) if (Math.random() < 0.5) rel(a, s)?.modifyAffinity?.(-6); if (Math.random() < 0.5) mem(w, s, '我沒加入工會，罷工的時候照樣去上工，被他們罵工賊。', {}, 5); }
            U.history.push({ d, k: 'strike', s: k });
            // 會員自己決定跟不跟(領袖帶頭,不問)
            if (ask) for (const a of mem_) if (a.agentId !== U.leader && here(w, a)) { try { DECIDE.enqueue(w, a, 'strike', { k }); } catch (e) {} }
            return true;
        }
        log(w, '😠 {o}拒絕了{u}的加薪要求，工會的錢還不夠罷工。', { o: boss.name, u: U.name }, boss.name); for (const a of mem_) mem(w, a, '{o}不肯加薪，工會的錢也不夠撐罷工。', { o: boss.name }, 5);
        return false;
    }
    // 會員沒跟著罷工:照常上工,也離開工會
    function cross(w, a, k) {
        const U = S(w); const M = MK(); const s = U.strike[k]; if (!s || !a || !s.members.includes(a.agentId)) return false;
        s.members = s.members.filter(id => id !== a.agentId); delete U.members[a.agentId]; delete U.sour[a.agentId];
        rel(w.agents[U.leader], a)?.modifyAffinity?.(-8); for (const id of s.members.slice(0, 6)) rel(w.agents[id], a)?.modifyAffinity?.(-6); rel(w.agents[s.boss], a)?.modifyAffinity?.(4);
        mem(w, a, '工會罷工我沒跟，照常去{s}上工，也退出了工會。', { s: M.name(k) }, 6);
        log(w, '🚶 {a}沒有跟著罷工，照常去{s}上工，也退出了工會。', { a: a.name, s: M.name(k) }, a.name);
        return true;
    }
    // 老闆對加薪要求的回答(選擇點 demand):yes 答應／bribe 想拿錢擺平領袖／fire 開除帶頭的／no 不答應
    function answer(w, k, how) {
        const U = S(w); if (U.ask[k] == null) return null; delete U.ask[k]; const T = talkInfo(w, k); if (!T) return 'gone'; const d = day(w);
        if (how === 'yes') { deal(w, T, d); return 'deal'; }
        if (how === 'bribe') { if (T.corruptible && bribe(w, T, d)) return 'bribed'; bribeRefused(w, T); return walkout(w, T, d, true) ? 'back_strike' : 'back'; }
        if (how === 'fire') { fireLead(w, T, d); return walkout(w, T, d, true) ? 'strike' : 'no'; }
        return walkout(w, T, d, true) ? 'strike' : 'no';
    }
    function bargain(w, all, d) {
        const U = S(w); const M = MK(); if (!w.agents[U.leader]) return;
        for (const k of Object.keys(M.SECTORS)) {
            if ((U.talks[k] || -99) > d - 14 || U.ask[k] != null) continue; const T = talkInfo(w, k, all); if (!T) continue;
            U.talks[k] = d;
            if (here(w, T.boss)) { // 老闆自己決定怎麼回(隔天有答案)；老闆不在鎮上問不到時，才照他的個性推一個結果
                U.ask[k] = d; log(w, '📣 {u}向{o}提出要求：{s}的工資要調到原本的 {p}%。', { u: U.name, o: T.boss.name, s: M.name(k), p: Math.round(T.want * 100) }, T.boss.name);
                try { DECIDE.enqueue(w, T.boss, 'demand', { k }); } catch (e) { delete U.ask[k]; }
                if (U.ask[k] != null) continue;
            }
            const r = Math.random();
            if (r < T.pYes) { deal(w, T, d); continue; }
            // 老闆不肯:收買領袖、開除帶頭的人,或乾脆拒絕
            if (cash(w, T.boss) >= 60 && T.corruptible && r < 0.55 && bribe(w, T, d)) continue;
            if ((T.greedy || has(T.boss, 'abrasive')) && Math.random() < 0.6) fireLead(w, T, d);
            walkout(w, T, d);
        }
    }
    // 罷工每天:發補貼、老闆會不會讓步、撐不住就失敗
    function strikeDay(w, d) {
        const U = S(w); const M = MK(); const Wl = WL();
        for (const [k, s] of Object.entries(U.strike)) {
            const boss = w.agents[s.boss]; const live = s.members.filter(id => w.agents[id] && !w.agents[id].isDead && U.members[id]);
            if (!boss || !live.length) { delete U.strike[k]; continue; }
            const pay = live.length * STRIKE_PAY;
            if (U.fund >= pay) { U.fund = Math.round((U.fund - pay) * 100) / 100; if (Wl) for (const id of live) Wl.add(w, w.agents[id], STRIKE_PAY); }
            const days = d - s.start; const greedy = has(boss, 'greedy');
            const rich = cash(w, boss) > live.length * 40; // 老闆夠有錢就能耗下去
            const pGive = (greedy ? 0.06 : 0.25) + days * (greedy ? 0.04 : 0.07) + (live.length >= 5 ? 0.08 : 0) - (rich ? 0.08 : 0);
            if (Math.random() < pGive) {
                w.market.pay[k] = Math.max(M.payRate(w, k), s.want + 0.05 > 1.1 ? 1.1 : Math.round((s.want + 0.05) * 100) / 100); U.won++; U.raises++;
                log(w, '🎉 {o}撐不住讓步了！{s}罷工 {n} 天後，工資調到原本的 {p}%。', { o: boss.name, s: M.name(k), n: days + 1, p: Math.round(w.market.pay[k] * 100) }, boss.name);
                for (const id of live) mem(w, w.agents[id], '罷工贏了，{o}答應加薪！', { o: boss.name }, 8);
                mem(w, boss, '工會罷工{n}天，我只好讓步加薪。', { n: days + 1 }, 7); delete U.strike[k]; U.history.push({ d, k: 'won', s: k }); continue;
            }
            if (U.fund < pay || d >= s.until) {
                U.lost++; log(w, '🥀 {s}的罷工撐不下去了，工人們回去上工，什麼也沒爭取到。', { s: M.name(k) }, boss.name);
                for (const id of live) { const a = w.agents[id]; mem(w, a, '罷工失敗了，白白少領好幾天工資。', {}, 7); a.addThought?.('strike_lost', w); U.sour[id] = d; /* 輸了之後要不要退會,由本人決定(選擇點 unionout) */ }
                delete U.strike[k]; U.history.push({ d, k: 'lost', s: k });
            }
        }
        for (const [id, until] of Object.entries(U.firedUntil)) if (until < d) delete U.firedUntil[id];
        if (U.history.length > 40) U.history = U.history.slice(-40);
    }
    // 給市場用:這個人今天有沒有在罷工／被開除(不上工、沒工資)
    function idle(w, a) { const U = w.union; if (!U?.on || !a) return false; const d = day(w); if ((U.firedUntil[a.agentId] || -1) >= d) return true; for (const s of Object.values(U.strike)) if (s.members.includes(a.agentId) && U.members[a.agentId]) return true; return false; }

    function daily(w) {
        const U = S(w); const d = day(w); if (U.lastDay === d) return; U.lastDay = d; const all = npcs(w);
        if (!MK() || !w.market) return;
        if (U.on) strikeDay(w, d);
        // 老闆三天都沒回話(不在鎮上、出遠門):當作不答應
        for (const [k, d0] of Object.entries(U.ask)) if (d - d0 >= 3) { try { answer(w, k, 'no'); } catch (e) { delete U.ask[k]; } }
        if (d % 7 !== 3) return; // 每週一次(跟市場的週結錯開)
        if (!U.on) return; // 有人願意帶頭才組得起來(選擇點 organize)
        membership(w, all, d); if (!U.on) return; dues(w); bargain(w, all, d);
    }

    // ---------- 選舉與提案 ----------
    function bias(w, voter, cid) {
        const U = w.union; if (!U?.on || !voter) return 0; let s = 0; const M = MK();
        if (U.members[voter.agentId]) { if (cid === U.leader) s += 15; if (M && M.ownedBy(w, cid).length) s -= 8; }
        else if (M && M.ownedBy(w, voter.agentId).length && cid === U.leader) s -= 12;
        return s;
    }

    // ---------- 顯示 ----------
    function brief(w, a) {
        const U = w.union; if (!U?.on || !a) return '';
        if (U.leader === a.agentId) return t('你是{u}的領袖，帶著 {n} 個會員，罷工基金 {f} 銀幣。').replace('{u}', U.name).replace('{n}', Object.keys(U.members).length).replace('{f}', Math.round(U.fund));
        if (U.members[a.agentId]) return t('你是{u}的會員，每週繳一點會費；工會基金 {f} 銀幣。').replace('{u}', U.name).replace('{f}', Math.round(U.fund));
        const M = MK(); if (M) { const own = M.ownedBy(w, a.agentId); if (own.length) { const n = npcs(w).filter(x => U.members[x.agentId] && own.includes(M.JOB2S[x.job?.key])).length; if (n) return t('你的工人裡有 {n} 個加入了工會。').replace('{n}', n); } }
        return '';
    }
    function describe(w, a) {
        const U = w.union; if (!U?.on || !a) return '';
        if (U.leader === a.agentId) return t('工會領袖');
        if ((U.firedUntil[a.agentId] || -1) >= day(w)) return t('帶頭要加薪被開除');
        if (U.members[a.agentId]) return idle(w, a) ? t('工會會員（罷工中）') : t('工會會員');
        return '';
    }
    function view(w) {
        const U = S(w); return { on: U.on, name: U.name, leader: w.agents[U.leader]?.name || '', members: Object.keys(U.members).length, fund: Math.round(U.fund), strikes: U.strikes, won: U.won, lost: U.lost, bribed: U.bribed, fired: U.fired, striking: Object.keys(U.strike).length };
    }
    return { S, daily, membership, dues, bargain, strikeDay, idle, bias, brief, describe, view, isMember, grievance, sectorOf, STRIKE_PAY,
        canOrganize, start, join, leave, talkInfo, deal, bribe, fireLead, walkout, cross, answer, leadBase, privateWorkers };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, { strike_lost: { mood: -6, opinion: 0, days: 3, label: t('罷工失敗') } });
// 每天跟著提案系統一起跑(觀察者模式)
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.wallet) UNION.daily(w); } catch (e) { console.warn('[Union] daily', e); } return r; };
}
// 工會領袖出來選鎮長
if (typeof ElectionSystem !== 'undefined') {
    const ES = ElectionSystem.prototype; const _start = ES._startElection;
    ES._startElection = function (world, opts) {
        const r = _start.call(this, world, opts);
        try {
            const U = world.union; const L = U?.on && world.agents[U.leader];
            const mine = L && this.candidates?.find(c => c.agentId === L.agentId);
            if (mine) { mine.union = true; world.logMessageT?.('event', '✊ {u}表態支持自家領袖{a}。', { u: U.name, a: L.name }, L.name); } // 領袖本來就有出來選:工會全力支持
            // 領袖沒出來選:要不要選由他自己說(選擇點 run)
        } catch (e) { console.warn('[Union] election', e); }
        return r;
    };
}
// 城市以上參選要有資歷:帶領 5 人以上工會的領袖也算(工會領袖從政是常見的路)
if (typeof TIERS !== 'undefined' && TIERS.qualified) {
    const _q = TIERS.qualified;
    TIERS.qualified = function (w, a) { try { const U = w?.union; if (U?.on && a && U.leader === a.agentId && Object.keys(U.members).length >= 5) return true; } catch (e) {} return _q.call(this, w, a); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.union && UNION.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.union = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.union) d.union = this.union; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.union = (data?.union && typeof data.union.members === 'object') ? data.union : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.UNION = UNION;
