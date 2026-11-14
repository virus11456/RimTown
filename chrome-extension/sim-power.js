// v6.95.0 金權與第四權
// 一、政治獻金:城鎮以上,老闆和有錢人每週可能捐錢給首長、議員或(選舉時)可能當選的候選人;
//     有人收、有人拒收(心腸軟又不貪的比較會拒)。收了錢就欠人情:審到傷害金主的提案(最低工資、救濟、加稅)會傾向反對,
//     選舉時候選人有錢打選戰(有加分)。私下收的錢記在真相頁,報社挖得到。
// 二、第四權:報社平時就監督(不只選舉),每週從鎮上真實發生的事挑一件查:
//     真相頁的祕密(獻金、收賄、工會領袖拿錢…)、壓薪的老闆、驅逐潮、銀行呆帳。報導出來會真的改變結果:
//     讀者憤怒、對當事人印象變差、首長醜聞分數上升(選票下降、民怨夠高就連署罷免提前改選)、老闆被迫加薪、
//     驅逐潮讓救濟／最低工資提案更常出現、銀行出事讀者去提款(可能擠兌)。
// 三、媒體被收編:有錢人可以買下報社,之後跟老闆或他的金主有關的新聞會被壓下;正直的記者可能照登,下場是被開除。
//     被揭發的首長可能告報社誹謗(報導屬實就敗訴、醜聞更大)。
// 四、AI 知道自己收過／捐過誰的錢、自己是哪家報社的記者;經濟頁有「金權與輿論」一行。
const POWER = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const rel = (a, b) => (a && b ? a.relationships?.getOrCreate?.(b.agentId, b.name) : null);
    const aff = (a, id) => a?.relationships?.relationships?.[id]?.affinity || 0;
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, p || {}, who || ''); } catch (e) {} };
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const cash = (w, a) => (WL() && w.wallet ? WALLET.get(w, a) : 0);
    const tierLv = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { return 0; } };
    const isOwner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const HURTS = (p) => ['minwage', 'stipend', 'relief'].includes(p?.kind) || (p?.kind === 'tax' && p.dir === 'up');
    const HELPS = (p) => p?.kind === 'tax' && p.dir === 'down';

    function S(w) {
        if (!w.power || typeof w.power !== 'object') w.power = { inf: {}, camp: {}, scandal: {}, pressure: {}, lastDay: -1, recallDay: -99, stats: { donated: 0, gifts: 0, refused: 0, exposed: 0, spiked: 0, fired: 0, bought: 0, recalls: 0, sued: 0, raised: 0, withdrawn: 0 }, log: [] };
        const P = w.power; P.inf = P.inf || {}; P.camp = P.camp || {}; P.scandal = P.scandal || {}; P.pressure = P.pressure || {}; P.stats = P.stats || {}; P.log = P.log || []; return P;
    }
    const leaderOf = (w) => { try { return w.election?._officeHolder?.(w) || null; } catch (e) { return null; } };
    const councilOf = (w) => (w.council?.members || []).map(id => w.agents[id]).filter(a => a && !a.isDead);
    const politicians = (w) => { const L = leaderOf(w); const out = L ? [L] : []; for (const c of councilOf(w)) if (!out.includes(c)) out.push(c); return out; };
    const owed = (w, pol) => { const m = S(w).inf[pol?.agentId] || {}; return Object.values(m).reduce((s, v) => s + v, 0); };
    // 金主對這個人的影響:收的錢越多,越偏向金主的利益(上限)
    function sway(w, pol, p) {
        if (!pol || !w.power) return 0; const n = owed(w, pol); if (n < 20) return 0;
        const k = Math.min(3, n / 30);
        if (HURTS(p)) return -k; if (HELPS(p)) return k * 0.6; return 0;
    }

    // ---------- 一、政治獻金 ----------
    // v9.21.0 決策核心階段 3:捐不捐、捐給誰、收不收,交給本人決定(sim-decide-pol.js);這裡只留「誰捐得起、可以捐給誰」和「錢怎麼過手」
    const here = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    // 現在可以捐給誰:選舉期間是候選人(依聲勢排),平常是首長和議員
    function targetsOf(w) {
        const E = w.election; const campaign = !!(E?.active && (E.phase === 'campaign' || E.phase === 'voting'));
        const list = campaign ? (E.candidates || []).slice().sort((x, y) => (y.votes || 0) - (x.votes || 0)).map(c => w.agents[c.agentId]).filter(Boolean) : politicians(w);
        return { campaign, list };
    }
    // 金主的門檻:有產業的老闆(手頭 60 以上),或鎮上最有錢的前 8%(至少 100)
    let _top = { w: null, d: -1, v: 100 };
    function richLine(w) { const d = day(w); if (_top.w === w && _top.d === d) return _top.v; const all = npcs(w); const rich = all.map(a => cash(w, a)).sort((x, y) => y - x); _top = { w, d, v: Math.max(100, rich[Math.floor(all.length * 0.08)] || 100) }; return _top.v; }
    const canDonate = (w, a) => tierLv(w) >= 1 && !!WL() && ((isOwner(w, a) && cash(w, a) >= 60) || cash(w, a) >= richLine(w));
    const giftSize = (w, dn) => Math.max(5, Math.min(80, Math.round(cash(w, dn) * 0.08)));
    // 錢過手(擲骰版和本人決定共用)
    function give(w, dn, tg, n, campaign, d = day(w)) {
        const P = S(w); const Wl = WL(); if (!Wl || !dn || !tg || tg === dn || n < 1 || !Wl.take(w, dn, n)) return false; Wl.add(w, tg, n);
        const m = P.inf[tg.agentId] = P.inf[tg.agentId] || {}; m[dn.agentId] = (m[dn.agentId] || 0) + n;
        if (campaign) P.camp[tg.agentId] = (P.camp[tg.agentId] || 0) + n;
        P.stats.donated += n; P.stats.gifts++;
        mem(w, tg, '{d}給了我 {n} 銀幣的政治獻金，這份人情得記著。', { d: dn.name, n }, 6); mem(w, dn, '我捐了 {n} 銀幣給{p}，以後有事好說話。', { n, p: tg.name }, 6);
        rel(tg, dn)?.modifyAffinity?.(5);
        // 私下的錢記在真相頁(同一對金主、政治人物一個月記一筆)
        const key = tg.agentId + ':' + dn.agentId; P.secretDay = P.secretDay || {};
        if ((P.secretDay[key] || -99) < d - 30 && typeof DARK !== 'undefined') { P.secretDay[key] = d; try { DARK.secret(w, { kind: 'donation', culprit: tg.agentId, victim: null, donor: dn.agentId, k: '{p}私下收了{d}{n} 銀幣的政治獻金', p: { p: tg.name, d: dn.name, n } }); } catch (e) {} }
        return true;
    }
    function turnDown(w, dn, tg, n) { const P = S(w); P.stats.refused++; mem(w, tg, '{d}想塞 {n} 銀幣給我當政治獻金，我拒絕了。', { d: dn.name, n }, 6); mem(w, dn, '我想捐錢給{p}，被拒絕了。', { p: tg.name }, 5); }
    // 金主開口:交給對方決定(選擇點 gift),隔天有答案;對方不在鎮上問不到時,才照他的個性推一個結果
    function offer(w, dn, tg, n, campaign) {
        if (!dn || !tg || tg === dn) return null;
        if (here(w, tg)) { try { DECIDE.enqueue(w, tg, 'gift', { dn: dn.agentId, n, camp: campaign ? 1 : 0 }); return 'asked'; } catch (e) {} }
        const honest = (has(tg, 'kind') && !has(tg, 'greedy') && Math.random() < 0.6) || (!has(tg, 'greedy') && Math.random() < 0.15);
        if (honest) { turnDown(w, dn, tg, n); return 'refused'; }
        return give(w, dn, tg, n, campaign) ? 'given' : null;
    }
    function readersOf(w, Pp) { const R = w.press; return npcs(w).filter(a => R?.reads?.[a.agentId] === Pp.id); }
    // 報社老闆會不會壓這則新聞:新聞的主角是老闆自己、老闆捐過錢的人、或捐錢給老闆的人
    function captured(w, Pp, ids) {
        const o = Pp.owner; if (!o) return false; const P = S(w);
        for (const id of ids) { if (!id) continue; if (id === o) return true; if ((P.inf[id] || {})[o]) return true; if ((P.inf[o] || {})[id]) return true; }
        return false;
    }
    function outrage(w, Pp, target, k, p) {
        let n = 0;
        for (const a of readersOf(w, Pp)) {
            const tr = typeof PRESS !== 'undefined' ? PRESS.trust(w, a, Pp) : 0.6; if (tr < 0.45 || a === target) continue;
            n++; if (target) rel(a, target)?.modifyAffinity?.(-6); a.addThought?.('outraged', w);
            if (Math.random() < 0.6) mem(w, a, '看到報導：{x}。太過分了！', { x: { k, p } }, 6);
        }
        return n;
    }
    function topics(w) {
        const out = []; const P = S(w); const d = day(w);
        // (a) 真相頁還沒曝光的祕密:主角是公眾人物(首長、議員、老闆、工會領袖)才值得查
        try { if (typeof DARK !== 'undefined' && w.dark) { const pubIds = new Set([...politicians(w).map(a => a.agentId), w.union?.leader].filter(Boolean)); for (const a of npcs(w)) if (isOwner(w, a)) pubIds.add(a.agentId);
            for (const s of DARK.S(w).secrets) if (!s.found && pubIds.has(s.culprit) && d - s.day >= 1) out.push({ type: 'secret', s, ids: [s.culprit, s.donor], w: s.kind === 'donation' ? 3 : 2 }); } } catch (e) {}
        // (b) 壓薪的老闆
        try { if (typeof MARKET !== 'undefined' && w.market) for (const k of Object.keys(MARKET.SECTORS)) { const id = MARKET.ownerOf(w, k); if (id && MARKET.payRate(w, k) <= 0.7) out.push({ type: 'wage', k, boss: id, ids: [id], w: 1.5 }); } } catch (e) {}
        // (c) 驅逐潮
        try { const E = w.estate; if (E) { const ev = (E.stats?.evicted || 0) - (P.evictSeen || 0); if (ev >= 3) out.push({ type: 'evict', n: ev, ids: [], w: 1.2 }); } } catch (e) {}
        // (d) 銀行呆帳
        try { const B = w.bank; if (B?.open && B.status !== 'run' && ((B.bad || 0) > 30 || (typeof BANK !== 'undefined' && BANK.totalDep(B) > 50 && B.reserve < BANK.totalDep(B) * 0.25))) out.push({ type: 'bank', ids: [B.banker], w: 1 }); } catch (e) {}
        return out;
    }
    function watchdog(w, d) {
        const R = w.press; if (!R?.papers?.length || typeof PRESS === 'undefined') return; const P = S(w);
        const pool = topics(w); if (!pool.length) { P.evictSeen = w.estate?.stats?.evicted || 0; return; }
        for (const Pp of R.papers) {
            if (Pp.banned || Pp.st === 'board' || Pp.st === 'crown') continue; // 公告欄、官報不揭弊
            const J = w.agents[Pp.journo]; if (!J) continue;
            if (Math.random() > 0.35 + (has(J, 'perfectionist') ? 0.15 : 0) + (has(J, 'gossip') ? 0.1 : 0)) continue;
            const tot = pool.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot, pick = pool[0]; for (const x of pool) { r -= x.w; if (r <= 0) { pick = x; break; } }
            if (pick.done) continue;
            // 報社被收編:壓新聞;正直的記者可能照登,然後被開除
            if (captured(w, Pp, pick.ids)) {
                const owner = w.agents[Pp.owner];
                if (has(J, 'perfectionist') && Math.random() < 0.5) {
                    publish(w, Pp, J, pick, d); pick.done = true; P.stats.fired++;
                    log(w, 'news', '🚪 {j}不顧老闆{o}反對登出了新聞，隨即被{paper}開除。', { j: J.name, o: owner?.name || '', paper: Pp.name[0] }, J.name);
                    mem(w, J, '我堅持把新聞登出來，結果被{o}開除了。我不後悔。', { o: owner?.name || '' }, 8); rel(J, owner)?.modifyAffinity?.(-25);
                    Pp.journo = null; Pp.cred = Math.min(95, Pp.cred + 3);
                } else {
                    P.stats.spiked++; Pp.cred = Math.max(20, Pp.cred - 2);
                    try { if (typeof DARK !== 'undefined') DARK.secret(w, { kind: 'spiked', culprit: Pp.owner, victim: null, k: '{o}壓下了{paper}一則對自己人不利的新聞', p: { o: owner?.name || '', paper: Pp.name[0] } }); } catch (e) {}
                    mem(w, J, '我查到的新聞被老闆{o}壓下來了。', { o: owner?.name || '' }, 6);
                }
                continue;
            }
            publish(w, Pp, J, pick, d); pick.done = true;
        }
        P.evictSeen = w.estate?.stats?.evicted || 0;
    }
    function publish(w, Pp, J, x, d) {
        const P = S(w); J.memory && mem(w, J, '我在{paper}登出了一則調查報導。', { paper: Pp.name[0] }, 6);
        if (x.type === 'secret') {
            const s = x.s; const c = w.agents[s.culprit]; if (!c) return;
            PRESS.story(w, Pp, 'expose', '調查報導：{x}', { x: { k: s.k, p: s.p } }, s.culprit);
            try { DARK.reveal(w, s, J); } catch (e) {}
            P.stats.exposed++;
            const L = leaderOf(w); const isLeader = L && L.agentId === c.agentId; const isPol = politicians(w).includes(c);
            if (isPol) P.scandal[c.agentId] = (P.scandal[c.agentId] || 0) + (isLeader ? 2 : 1);
            const n = outrage(w, Pp, c, s.k, s.p);
            if (s.donor && w.agents[s.donor]) for (const a of readersOf(w, Pp)) if (Math.random() < 0.5) rel(a, w.agents[s.donor])?.modifyAffinity?.(-3);
            try { if (typeof CROWN !== 'undefined' && CROWN.king(w)?.agentId === c.agentId && w.crown) w.crown.legit = Math.max(0, w.crown.legit - 8); } catch (e) {}
            // 被揭發的首長可能告報社誹謗:報導屬實就敗訴、醜聞更大
            if (isLeader && (has(c, 'greedy') || has(c, 'abrasive')) && Math.random() < 0.5) {
                P.stats.sued++; P.scandal[c.agentId] += 1;
                log(w, 'news', '⚖️ {m}告{paper}誹謗，報導句句屬實，{m}敗訴，醜聞越鬧越大。', { m: c.name, paper: Pp.name[0] }, c.name);
                mem(w, c, '我告{paper}誹謗卻輸了，現在全鎮都在看我笑話。', { paper: Pp.name[0] }, 8);
            }
            P.log.push({ d, k: 'expose', who: c.name, n }); return;
        }
        if (x.type === 'wage') {
            const boss = w.agents[x.boss]; if (!boss) return; const pct = Math.round(MARKET.payRate(w, x.k) * 100);
            PRESS.story(w, Pp, 'expose', '調查報導：{o}的{s}只發標準工資的 {p}%，工人吃不飽', { o: boss.name, s: MARKET.name(x.k), p: pct }, boss.agentId);
            outrage(w, Pp, boss, '{o}的{s}只發標準工資的 {p}%，工人吃不飽', { o: boss.name, s: MARKET.name(x.k), p: pct });
            if (!has(boss, 'greedy') && Math.random() < 0.55) { w.market.pay[x.k] = Math.min(1, Math.round((MARKET.payRate(w, x.k) + 0.1) * 100) / 100); P.stats.raised++;
                log(w, 'economy', '📰 報導一出，{o}頂不住輿論，把{s}的工資調到 {p}%。', { o: boss.name, s: MARKET.name(x.k), p: Math.round(w.market.pay[x.k] * 100) }, boss.name); mem(w, boss, '報紙把我壓薪的事登出來，只好加薪。', {}, 7); }
            else { mem(w, boss, '報紙說我壓薪，哼，我的生意我說了算。', {}, 6); if (w.union?.on) w.union.talks[x.k] = -99; } // 工會可以馬上去談
            P.log.push({ d, k: 'wage', who: boss.name }); return;
        }
        if (x.type === 'evict') {
            PRESS.story(w, Pp, 'expose', '調查報導：這陣子有 {n} 戶付不出房租被趕出家門，睡在廣場', { n: x.n }, null);
            outrage(w, Pp, null, '這陣子有 {n} 戶付不出房租被趕出家門', { n: x.n });
            P.pressure.relief = d + 20; P.pressure.minwage = d + 20; // 救濟、最低工資提案更常出現
            P.log.push({ d, k: 'evict', n: x.n }); return;
        }
        if (x.type === 'bank') {
            const B = w.bank; const bk = w.agents[B.banker];
            PRESS.story(w, Pp, 'expose', '調查報導：銀行呆帳 {n} 銀幣，存款可能拿不回來', { n: Math.round(B.bad || 0) }, B.banker);
            let n = 0; for (const a of readersOf(w, Pp)) { const dep = B.dep?.[a.agentId] || 0; if (dep < 5 || PRESS.trust(w, a, Pp) < 0.5) continue;
                const got = BANK.withdraw(w, B, a, dep * 0.4); if (got > 0) { n++; mem(w, a, '報紙說銀行快不行了，我先把存款領一部分出來。', {}, 6); } }
            P.stats.withdrawn += n; if (bk) mem(w, bk, '報紙一登銀行呆帳的新聞，好多人跑來提款。', {}, 7);
            P.log.push({ d, k: 'bank', n }); return;
        }
    }
    // 有錢人買下報社(媒體被收編)
    function buyPapers(w, d) {
        const R = w.press; if (!R?.papers?.length || tierLv(w) < 1) return; const P = S(w); const Wl = WL(); if (!Wl) return;
        const free = R.papers.filter(Pp => !Pp.owner && !Pp.banned && !['board', 'crown'].includes(Pp.st)); if (!free.length || Math.random() > 0.25) return;
        const buyer = npcs(w).filter(a => cash(w, a) >= 220 && (isOwner(w, a) || owed(w, a) === 0)).sort((x, y) => cash(w, y) - cash(w, x))[0]; if (!buyer) return;
        const Pp = free[0]; const price = 120; if (!Wl.take(w, buyer, price)) return;
        w.stockpile?.add?.('silver', price, w.tickCount, t('報社轉手')); Pp.owner = buyer.agentId; Pp.cred = Math.max(20, Pp.cred - 5); P.stats.bought++;
        log(w, 'news', '📰 {o}花 {n} 銀幣買下了{paper}。', { o: buyer.name, n: price, paper: Pp.name[0] }, buyer.name); mem(w, buyer, '我買下了{paper}，以後說話更有份量了。', { paper: Pp.name[0] }, 7);
    }
    // 醜聞累積、民怨夠高 → 連署罷免、提前改選
    function recall(w, d) {
        const P = S(w); const L = leaderOf(w); const E = w.election; if (!L || !E || E.active || d - P.recallDay < 40) return;
        const sc = P.scandal[L.agentId] || 0; if (sc < 3) return;
        const all = npcs(w).filter(a => a !== L); if (all.length < 6) return;
        const angry = all.filter(a => aff(a, L.agentId) < -15).length / all.length; if (angry < 0.35) return;
        P.recallDay = d; P.stats.recalls++;
        log(w, 'event', '📢 醜聞延燒，{n}% 的人連署罷免{m}，提前改選！', { n: Math.round(angry * 100), m: L.name }, L.name);
        mem(w, L, '大家連署罷免我，要提前改選了。', {}, 9);
        P.recalled = L.agentId; P.recalledDay = d; // 被罷免的人這次不能再選
        try { E.triggerElection(w); } catch (e) { console.warn('[Power] recall', e); }
        if (!E.active && L.job?.key === 'mayor') { // 沒有足夠的人出來選:直接下台,職位出缺走補選
            L.job = (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS.trader) ? new Job('trader') : null;
            log(w, 'event', '📢 {m}被罷免下台，等待補選。', { m: L.name }, L.name);
        }
    }
    function daily(w) {
        const P = S(w); const d = day(w); if (P.lastDay === d) return; P.lastDay = d;
        for (const id of Object.keys(P.scandal)) { P.scandal[id] = Math.max(0, P.scandal[id] - 0.02); if (P.scandal[id] === 0) delete P.scandal[id]; } // 醜聞慢慢被淡忘
        for (const [k, until] of Object.entries(P.pressure)) if (until < d) delete P.pressure[k];
        if (!w.election?.active) P.camp = {};
        // 捐不捐由金主自己決定(選擇點 donate)
        if (d % 7 === 1) { watchdog(w, d); buyPapers(w, d); }
        recall(w, d);
        if (P.log.length > 30) P.log = P.log.slice(-30);
        // 金主人情:每週淡一點(太久以前的錢慢慢不算數)
        if (d % 7 === 0) for (const m of Object.values(P.inf)) for (const k of Object.keys(m)) { m[k] = Math.round(m[k] * 0.9 * 10) / 10; if (m[k] < 2) delete m[k]; }
    }

    // ---------- 選舉 ----------
    function bias(w, voter, cid) {
        const P = w.power; if (!P) return 0; let s = 0;
        const camp = P.camp[cid] || 0; if (camp > 0) s += Math.min(8, Math.sqrt(camp)) * (w.union?.members?.[voter?.agentId] ? 0.3 : 1); // 有錢打選戰
        const sc = P.scandal[cid] || 0; if (sc > 0) s -= Math.min(20, sc * 6);
        return s;
    }

    // ---------- 顯示 ----------
    function brief(w, a) {
        const P = w.power; if (!P || !a) return ''; const out = [];
        const got = P.inf[a.agentId]; if (got && Object.keys(got).length) { const names = Object.keys(got).map(id => w.agents[id]?.name).filter(Boolean).slice(0, 3).join(t('、')); out.push(t('你收過 {n} 銀幣的政治獻金（{d}），審到對金主不利的案子會猶豫。').replace('{n}', Math.round(Object.values(got).reduce((s, v) => s + v, 0))).replace('{d}', names)); }
        const gave = Object.entries(P.inf).filter(([, m]) => m[a.agentId]).map(([id]) => w.agents[id]?.name).filter(Boolean); if (gave.length) out.push(t('你捐過政治獻金給{p}。').replace('{p}', gave.slice(0, 3).join(t('、'))));
        if ((P.scandal[a.agentId] || 0) >= 1) out.push(t('你最近醜聞纏身，很多人對你不滿。'));
        const R = w.press; const myPaper = R?.papers?.find(Pp => Pp.journo === a.agentId); if (myPaper) out.push(t('你是{paper}的記者，專門挖鎮上的弊案。').replace('{paper}', t(myPaper.name[0])));
        const owns = R?.papers?.find(Pp => Pp.owner === a.agentId); if (owns) out.push(t('你是{paper}的老闆。').replace('{paper}', t(owns.name[0])));
        return out.join(' ');
    }
    function view(w) {
        const P = S(w); const R = w.press;
        return { gifts: P.stats.gifts || 0, donated: Math.round(P.stats.donated || 0), refused: P.stats.refused || 0, exposed: P.stats.exposed || 0, spiked: P.stats.spiked || 0, fired: P.stats.fired || 0, bought: P.stats.bought || 0, recalls: P.stats.recalls || 0, sued: P.stats.sued || 0, raised: P.stats.raised || 0, withdrawn: P.stats.withdrawn || 0,
            owned: (R?.papers || []).filter(Pp => Pp.owner).map(Pp => { const id = Pp.owner; const a = w.agents[id]; const nm = (a && !a.isDead && a.name) || (w.events?._travellingAgents || []).find(tr => tr?.agentData?.agentId === id)?.agentData?.name || ''; const gone = !nm; const nm2 = nm || a?.name || w.departedNames?.[id] || w._nameCache?.[id] || ''; return [t(Pp.name[0]), nm2 ? t(nm2) + (gone ? t('（已不在鎮上）') : '') : t('已不在鎮上的人')]; }) }; // v9.18.1 老闆過世或搬走時,以前名字會變成空的「（）」
    }
    return { S, daily, donations, watchdog, publish, buyPapers, recall, sway, bias, brief, view, captured, topics, HURTS, owed,
        targetsOf, canDonate, giftSize, give, turnDown, offer, HELPS };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, { outraged: { mood: -4, opinion: 0, days: 2, label: t('看了新聞很憤怒') } });
if (typeof MAYOR_WHY !== 'undefined') MAYOR_WHY.donor = '票數接近，鎮長顧及金主的意思 🕵️';
if (typeof VOTE_WHY !== 'undefined') VOTE_WHY.donor = '收了金主的錢 🕵️';
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.wallet) POWER.daily(w); } catch (e) { console.warn('[Power] daily', e); } return r; };
    // 首長:收了金主的錢,票數接近時偏向金主
    const _lean = PS._mayorLean;
    PS._mayorLean = function (m, p) { const base = _lean.call(this, m, p); try { const w = this._w || (typeof window !== 'undefined' ? window.rimtownApp?.world : null); const s = w ? POWER.sway(w, m, p) : 0; if (s) { p._donorSway = s; return base + s; } } catch (e) {} return base; };
    const _dec = PS._decide;
    PS._decide = function (w, p, action, by) { try { if (p._donorSway && by === 'mayor' && ((p._donorSway < 0 && p.mayorWhy === 'own_no') || (p._donorSway > 0 && p.mayorWhy === 'own_yes'))) p.mayorWhy = 'donor'; } catch (e) {} return _dec.call(this, w, p, action, by); };
    const _mr = PS._mayorRule;
    PS._mayorRule = function (w, ...rest) { this._w = w; try { return _mr.call(this, w, ...rest); } finally { this._w = null; } };
    // 收了錢的政治人物投票:對金主不利的案子投反對
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { const r = _rv.call(this, w, p, a, ...rest); try { if (w.power && POWER.sway(w, a, p) <= -1.5 && p.votes?.[a.agentId] === 'for') { p.votes[a.agentId] = 'against'; (p.why || (p.why = {}))[a.agentId] = 'donor'; } } catch (e) {} return r; };
    // 報導帶出的民意壓力:救濟、最低工資提案更常出現
    const _cands = PS._candidates;
    PS._candidates = function (w, day, ...rest) { const out = _cands.call(this, w, day, ...rest); try { const pr = w.power?.pressure || {}; for (const c of out || []) if ((c.kind === 'relief' && pr.relief) || (c.kind === 'minwage' && pr.minwage) || (c.kind === 'stipend' && pr.relief)) c.weight = (c.weight || 1) * 2.5; } catch (e) {} return out; };
}
// 被罷免的人 60 天內不能再參選
if (typeof ElectionSystem !== 'undefined') {
    // 只在推候選人時排除(他照樣可以投票)
    const recalledId = (w) => { const P = w?.power; return (P?.recalled && (w._absDay?.() ?? 0) - (P.recalledDay || 0) < 60) ? P.recalled : null; };
    const ES = ElectionSystem.prototype; const _start = ES._startElection;
    ES._startElection = function (world, ...rest) {
        const rid = recalledId(world); if (!rid) return _start.call(this, world, ...rest);
        const own = Object.prototype.hasOwnProperty.call(this, '_residents'); const base = this._residents;
        if (!own) this._residents = function (w2) { return ES._residents.call(this, w2 || world).filter(a => a.agentId !== rid); };
        try { return _start.call(this, world, ...rest); } finally { if (!own) delete this._residents; }
    };
    if (typeof TIERS !== 'undefined' && TIERS.qualified) { const _q = TIERS.qualified; TIERS.qualified = function (w, a) { try { if (a && recalledId(w) === a.agentId) return false; } catch (e) {} return _q.call(this, w, a); }; }
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.power && POWER.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.power = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.power) d.power = this.power; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.power = (data?.power && typeof data.power.inf === 'object') ? data.power : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.POWER = POWER;
