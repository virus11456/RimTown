// v6.93.0 工會
// - 私人產業的工人被壓薪、欠薪、挨餓的人一多,有號召力的人會出來組工會;之後每週有人入會(看委屈程度、跟領袖和老闆的交情)
// - 會員每週繳一點會費存成罷工基金
// - 集體談判:某產業的會員過半、工資沒給足,工會就找老闆談加薪;老闆依個性:讓步、拒絕、收買工會領袖(真相頁看得到)、開除帶頭的人(兩週沒工作)
// - 談不攏就由工會發動罷工:只有會員罷工,沒入會的照常上工(工賊,會員會記恨);罷工期間基金每天發補貼,基金見底或撐太久罷工就失敗、有人退會
// - 政治:工會領袖可能出來選鎮長,會員多半投他、不投老闆;有錢的老闆反過來不投他;工會在時最低工資提案更常出現、會員都支持
// - AI 知道自己是不是會員／領袖,老闆知道自己有多少工人入了會
const UNION = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, id) => a?.relationships?.relationships?.[id]?.affinity || 0;
    const rel = (a, b) => (a && b ? a.relationships?.getOrCreate?.(b.agentId, b.name) : null);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const cash = (w, a) => (WL() && w.wallet ? WALLET.get(w, a) : 0);
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const STRIKE_PAY = 2, STRIKE_MAX = 6, DUES = 1;

    function S(w) {
        if (!w.union || typeof w.union !== 'object') w.union = { on: false, name: '', leader: null, members: {}, fund: 0, founded: null, strikes: 0, won: 0, lost: 0, bribed: 0, fired: 0, raises: 0, talks: {}, strike: {}, firedUntil: {}, lastDay: -1, history: [] };
        const U = w.union; U.members = U.members || {}; U.talks = U.talks || {}; U.strike = U.strike || {}; U.firedUntil = U.firedUntil || {}; U.history = U.history || []; return U;
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
    const leaderScore = (w, a) => (has(a, 'charismatic') ? 3 : 0) + (has(a, 'abrasive') ? 1 : 0) + (has(a, 'pessimist') ? 0.5 : 0) + (a.skills?.skills?.社交?.level || 0) * 0.4 + grievance(w, a) * 2 + Math.random();

    // ---------- 組工會、入會、退會、會費 ----------
    function found(w, all, d) {
        const U = S(w); const ws = privateWorkers(w, all); if (ws.length < 6) return;
        const angry = ws.filter(a => grievance(w, a) >= 0.3); if (angry.length < 4 || Math.random() > 0.35) return;
        const lead = angry.slice().sort((x, y) => leaderScore(w, y) - leaderScore(w, x))[0];
        U.on = true; U.founded = d; U.leader = lead.agentId; U.members = {}; for (const a of angry) if (a === lead || Math.random() < 0.6) U.members[a.agentId] = d;
        U.name = (w.townName ? t(w.townName) : '') + t('工人聯合會');
        log(w, '✊ {a}號召{n}個工人成立了「{u}」，要一起跟老闆爭取工資。', { a: lead.name, n: Object.keys(U.members).length, u: U.name }, lead.name);
        for (const id of Object.keys(U.members)) mem(w, w.agents[id], id === lead.agentId ? '我帶頭成立了工會，大家團結起來才不會一直被壓榨。' : '我加入了{a}組的工會，希望大家一起爭取到合理的工資。', { a: lead.name }, 7);
        U.history.push({ d, k: 'found', who: lead.name });
    }
    function membership(w, all, d) {
        const U = S(w); const lead = w.agents[U.leader];
        const gone = []; for (const id of Object.keys(U.members)) { const a = w.agents[id]; if (!a || a.isDead || !sectorOf(w, a)) { delete U.members[id]; if (a && !a.isDead) gone.push(a); } }
        // 領袖不在了(過世、離鎮、當了老闆):會員裡最有號召力的人接手
        if (!lead || lead.isDead || !U.members[U.leader]) {
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
        const L = w.agents[U.leader];
        for (const a of privateWorkers(w, all)) {
            if (U.members[a.agentId]) {
                const k = sectorOf(w, a); if (MK().payRate(w, k) >= 1 && (a.mood ?? 50) > 60 && Math.random() < 0.08) { delete U.members[a.agentId]; mem(w, a, '日子過得去了，我退出了工會，會費省下來。', {}, 4); }
                continue;
            }
            const boss = w.agents[MK().ownerOf(w, sectorOf(w, a))];
            let p = 0.08 + grievance(w, a) * 0.35 + (aff(a, U.leader) > 30 ? 0.15 : 0) - (aff(a, boss?.agentId) > 50 ? 0.25 : 0) - (has(a, 'greedy') ? 0.08 : 0) + Math.min(0.15, (U.won || 0) * 0.04);
            if (Math.random() < p) { U.members[a.agentId] = d; mem(w, a, '我加入了{u}，大家團結才有籌碼。', { u: U.name }, 6); rel(a, L)?.modifyAffinity?.(4); }
        }
    }
    // 解散時把罷工基金分還給最後的會員(沒人可分就進公庫),錢不會憑空消失
    function refund(w, people) {
        const U = S(w); const n = Math.floor(U.fund * 100) / 100; if (n <= 0) return; const Wl = WL();
        if (people.length && Wl) { const each = Math.floor(n / people.length * 100) / 100; for (const a of people) Wl.add(w, a, each); }
        else w.stockpile?.add?.('silver', n, w.tickCount, t('工會解散的基金'));
        U.fund = 0;
    }
    function dues(w) {
        const U = S(w); const Wl = WL(); if (!Wl) return; let got = 0;
        for (const id of Object.keys(U.members)) { const a = w.agents[id]; if (!a) continue; const c = cash(w, a); if (c < 3) continue; const n = Math.min(DUES, Math.round(c * 0.03 * 100) / 100); if (n > 0 && Wl.take(w, a, n)) got += n; }
        U.fund = Math.round((U.fund + got) * 100) / 100;
    }

    // ---------- 集體談判 ----------
    function bargain(w, all, d) {
        const U = S(w); const M = MK(); const L = w.agents[U.leader]; if (!L) return;
        for (const k of Object.keys(M.SECTORS)) {
            const bossId = M.ownerOf(w, k); if (!bossId || U.strike[k] || (U.talks[k] || -99) > d - 14) continue;
            const ws = M.workersOf(w, k, all).filter(a => a.agentId !== bossId); const mem_ = ws.filter(a => U.members[a.agentId]);
            if (mem_.length < 2 || mem_.length < ws.length / 2) continue;
            const rate = M.payRate(w, k); if (rate >= 1) continue;
            U.talks[k] = d; const boss = w.agents[bossId]; const want = Math.min(1.1, Math.round((rate + 0.1) * 100) / 100);
            const bill = ws.reduce((s, a) => s + (WALLET.WAGE[a.job?.key] || 4), 0) * 7;
            const greedy = has(boss, 'greedy'), kind = has(boss, 'kind');
            const h = w.market.hist?.[k] || []; const profit = h.reduce((x, [rv, c]) => x + rv - c, 0); // 最近一週賺不賺錢
            const r = Math.random();
            // 老闆不會輕易讓步:賺錢、手頭寬、心腸軟才比較肯;吝嗇的談判桌上從不讓步
            const pYes = greedy ? 0 : (kind ? 0.55 : 0.2) + (profit > bill * 0.5 ? 0.2 : profit < 0 ? -0.15 : 0) + (cash(w, boss) > bill * 2 ? 0.1 : 0);
            if (r < pYes) {
                w.market.pay[k] = want; U.raises++; U.won++;
                log(w, '🤝 {u}跟{o}談成了，{s}的工資調到原本的 {p}%。', { u: U.name, o: boss.name, s: M.name(k), p: Math.round(want * 100) }, boss.name);
                for (const a of mem_) mem(w, a, '工會跟{o}談成加薪了，團結真的有用。', { o: boss.name }, 6);
                mem(w, boss, '工會來談，我答應把{s}的工資調高。', { s: M.name(k) }, 5); U.history.push({ d, k: 'deal', s: k });
                continue;
            }
            // 老闆不肯:收買領袖、開除帶頭的人,或乾脆拒絕
            const corruptible = has(L, 'greedy') || cash(w, L) < 10;
            if (cash(w, boss) >= 60 && corruptible && r < 0.55) {
                const n = 30; if (WL().take(w, boss, n)) { WL().add(w, L, n); U.bribed++; U.talks[k] = d + 30; // 拿了錢,一個月不提這家
                    try { if (typeof DARK !== 'undefined') DARK.secret(w, { kind: 'union_bribe', culprit: L.agentId, victim: null, k: '{l}私下收了{o}{n} 銀幣，答應工會不再找{s}的麻煩', p: { l: L.name, o: boss.name, n, s: M.name(k) } }); } catch (e) {}
                    mem(w, L, '{o}塞給我 {n} 銀幣，要我別再帶人去吵。', { o: boss.name, n }, 7); log(w, '🤐 {u}跟{o}的談判不了了之。', { u: U.name, o: boss.name }, boss.name); U.history.push({ d, k: 'bribe', s: k });
                    continue; }
            }
            if ((greedy || has(boss, 'abrasive')) && Math.random() < 0.6) {
                const tgt = mem_.slice().sort((x, y) => leaderScore(w, y) - leaderScore(w, x))[0];
                if (tgt) {
                    U.firedUntil[tgt.agentId] = d + 14; U.fired++;
                    log(w, '🚪 {o}開除了帶頭要加薪的{a}。', { o: boss.name, a: tgt.name }, boss.name); mem(w, tgt, '{o}因為我帶頭要加薪，把我開除了，兩週沒工作。', { o: boss.name }, 8);
                    rel(tgt, boss)?.modifyAffinity?.(-25); for (const a of mem_) if (a !== tgt) rel(a, boss)?.modifyAffinity?.(-8);
                    U.history.push({ d, k: 'fire', s: k });
                }
            }
            // 談判破裂 → 罷工(基金要撐得了幾天)
            if (U.fund >= mem_.length * STRIKE_PAY * 2) {
                U.strike[k] = { start: d, until: d + STRIKE_MAX, members: mem_.map(a => a.agentId), boss: bossId, want };
                U.strikes++; if (w.market) w.market.strikes = (w.market.strikes || 0) + 1;
                log(w, '✊ {u}在{s}發動罷工，{n} 個會員不上工，要{o}加薪。', { u: U.name, s: M.name(k), n: mem_.length, o: boss.name }, boss.name);
                for (const a of mem_) mem(w, a, '工會宣布罷工，我跟大家一起不去{s}上工。', { s: M.name(k) }, 7);
                const scabs = ws.filter(a => !U.members[a.agentId]);
                for (const s of scabs) { for (const a of mem_) if (Math.random() < 0.5) rel(a, s)?.modifyAffinity?.(-6); if (Math.random() < 0.5) mem(w, s, '我沒加入工會，罷工的時候照樣去上工，被他們罵工賊。', {}, 5); }
                U.history.push({ d, k: 'strike', s: k });
            } else { log(w, '😠 {o}拒絕了{u}的加薪要求，工會的錢還不夠罷工。', { o: boss.name, u: U.name }, boss.name); for (const a of mem_) mem(w, a, '{o}不肯加薪，工會的錢也不夠撐罷工。', { o: boss.name }, 5); }
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
                for (const id of live) { const a = w.agents[id]; mem(w, a, '罷工失敗了，白白少領好幾天工資。', {}, 7); a.addThought?.('strike_lost', w); if (Math.random() < 0.3) { delete U.members[id]; mem(w, a, '我退出工會了，罷工根本沒用。', {}, 5); } }
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
        if (d % 7 !== 3) return; // 每週一次(跟市場的週結錯開)
        if (!U.on) { found(w, all, d); return; }
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
    return { S, daily, found, membership, dues, bargain, strikeDay, idle, bias, brief, describe, view, isMember, grievance, sectorOf, STRIKE_PAY };
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
            if (L && !L.isDead && Object.keys(U.members).length >= 5 && this.candidates?.length && !this.candidates.some(c => c.agentId === L.agentId) && this._residents(world).includes(L) && Math.random() < 0.6) {
                const pol = (typeof ELECTION_POLICIES !== 'undefined' && ELECTION_POLICIES.find(p => p.id === 'welfare')) || this._pickPolicy(L);
                const c = { agentId: L.agentId, name: L.name, policy: pol.id, policyLabel: pol.label, policyIcon: pol.icon, votes: 0, speech: this._generateSpeech(L, pol), union: true };
                this.candidates[this.candidates.length - 1] = c;
                world.logMessageT?.('event', '✊ {u}推出領袖{a}參選鎮長。', { u: U.name, a: L.name }, L.name);
                L.memory?.addT?.(world.tickCount, world.clock.timeStr, 'election', '工會推我出來選鎮長，要替工人發聲。', {}, 8, []);
            }
        } catch (e) { console.warn('[Union] election', e); }
        return r;
    };
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
