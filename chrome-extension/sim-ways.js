// RimTown - sim-ways.js：v8.1.0 🤝 人情世故
// 日常的小毛病串成會反饋的社會生態（不誇張、好笑來自真實）：
// 🎭 面子：提案被當眾大比數否決會丟面子。多數人從此不敢提（沉默期），有人脈的會私下拉票再試；朋友給台階會被記住。
//    沉默的人一多，鎮上提案變少，看不下去的人提「鄰里茶會」，讓大家重新敢開口。
// 🧧 人情帳：婚禮禮金、去送葬、災後幫忙都記在帳上。欠了人情投票時不好意思反對；收過的禮金下次要包回去，包太少會被記住。
// 🙃 嘴硬：提案失敗或成效不好，投贊成的人多半怪提案的人（「我當初就覺得怪怪的」），只有少數人認錯；全鎮的信任下降。
// 🤫 說一套做一套：法律通過後，有人私下違反自己投票支持的法律；被撞見時名聲重挫、信任下降。
//    信任低的時候，大家對提案比較多疑（要更多理由才投贊成）。
// 🏠 跟鄰居比：有人翻修房子，鄰居心裡不是滋味；手頭不夠的就去銀行借錢也要翻修，景氣短暫變熱，之後有人還不出錢。
// 👴 懷舊：老人美化過去、比較反對新東西（研究、新建設、科技路線），常說「以前的首長多好」；年輕人聽多了會煩。
// ☕ 日常習慣：每個人有固定的小去處（早上的廣場、傍晚的酒館…），常碰面的人慢慢變熟成了街坊；誰兩天沒出現，街坊會去敲門。
// 🧊 冷戰：吵完架互不說話（不會聊天），共同的朋友被迫選邊；時間到了多半和好，也可能從此不往來；調解提案可以化解。
// 存在 world.ways；不動銀幣（銀幣守恆：禮金本來就是賓客付給新人，這裡只決定包多少）。
'use strict';

const WAYS = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 18 && !(w.isAway?.(a.agentId)));
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const fill = (k, p) => { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof y === 'string' ? t(y) : y); return s; };
    const log = (w, k, p, who, who2) => { try { w.logMessageT?.('social', k, p || {}, who, who2); } catch (e) {} };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('social', fill(k, p), imp || 5, names || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp || 5, []); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships?.getOrCreate?.(b.agentId, b.name); } catch (e) { return null; } };
    const aff = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const addAff = (a, b, n) => { try { rel(a, b)?.modifyAffinity?.(n); } catch (e) {} };
    const key2 = (a, b) => [a, b].sort().join('|');

    function S(w) {
        if (!w.ways || typeof w.ways !== 'object') w.ways = {};
        const X = w.ways; for (const k of ['face', 'shame', 'lobby', 'owe', 'gift', 'rt', 'nod', 'miss', 'cold', 'envy', 'st', 'odd']) if (!X[k] || typeof X[k] !== 'object') X[k] = {};
        if (!Array.isArray(X.hyp)) X.hyp = []; if (!Array.isArray(X.reno)) X.reno = []; if (!(X.trust >= 0)) X.trust = 60; return X;
    }
    const bump = (X, k, n) => { X.st[k] = (X.st[k] || 0) + (n || 1); };

    // ================= 🎭 面子 =================
    const faceOf = (w, a) => S(w).face[a.agentId] ?? 50;
    const proud = (a) => hasT(a, 'abrasive') || hasT(a, 'charismatic') || hasT(a, 'greedy') || hasT(a, 'jealous');
    function setFace(w, a, v) { S(w).face[a.agentId] = Math.max(0, Math.min(100, Math.round(v))); }
    function loseFace(w, a, n) { setFace(w, a, faceOf(w, a) - n * (proud(a) ? 1.4 : 1)); }
    function onRejected(w, p) {
        const a = w.agents[p.proposerId]; if (!a || a.isDead) return; const X = S(w); const d = day(w);
        const V = Object.values(p.votes || {}); const f = V.filter(v => v === 'for').length, ag = V.filter(v => v === 'against').length;
        const big = ag >= Math.max(3, f * 1.5) || /鎮長否決/.test(p.result || '');
        loseFace(w, a, big ? 15 : 5); bump(X, 'rejected');
        if (big && Math.random() < 0.15 && d - (X.lastCasual ?? -99) >= 20) { X.lastCasual = d; log(w, '🎭 {a}的提案被大比數否決之後，逢人就說：「我本來就只是隨口提提。」', { a: a.name }, a.name); bump(X, 'casual'); }
        // 朋友給台階
        const fr = adults(w).filter(x => x !== a && aff(a, x) >= 30 && aff(x, a) >= 20).sort((x, y) => aff(a, y) - aff(a, x))[0];
        if (fr && big && Math.random() < 0.5) {
            setFace(w, a, faceOf(w, a) + 10); addAff(a, fr, 6); owe(w, a, fr, 3); bump(X, 'step');
            mem(w, a, '提案被否決那天，還好{f}替我說了話。', { f: fr.name }, 7);
            log(w, '🎭 {f}跟{a}說：「這次是時機不對，不是你的問題。」{a}嘴上說沒事，心裡記住了這份情。', { f: fr.name, a: a.name }, fr.name, a.name);
        }
        if (faceOf(w, a) < 35) {
            if (hasT(a, 'charismatic') || hasT(a, 'abrasive')) { X.lobby[a.agentId] = d; mem(w, a, '我不服氣，這次先去找大家私下聊聊，下次一定讓它通過。', {}, 6); bump(X, 'lobby'); }
            else { X.shame[a.agentId] = d + 20; mem(w, a, '這陣子不想再提案了，免得又被當眾否決。', {}, 6); bump(X, 'silent'); }
        }
    }
    const silent = (w) => { const X = S(w), d = day(w); return Object.entries(X.shame).filter(([id, u]) => u > d && w.agents[id] && !w.agents[id].isDead).map(([id]) => id); };
    const SYS = /^(tech_|bio_|steam_|ways_|cal_|tier_up)/;
    function forum(w) {
        const X = S(w); X.shame = {}; for (const a of npcs(w)) { setFace(w, a, faceOf(w, a) + 10); a.moodModifier = (a.moodModifier || 0) + 3; }
        X.trust = Math.min(100, X.trust + 5); X.lastForum = day(w); bump(X, 'forum');
        log(w, '🫖 鄰里茶會辦完了：有人抱怨水井、有人想開市集，說錯了也沒人笑。好幾個很久沒開口的人又開始提事情了。', {});
        news(w, '🫖 鄰里茶會：大家又敢開口了', {}, 6, []); return t('大家又敢開口提事情了');
    }

    // ================= 🧧 人情帳 =================
    function owe(w, debtor, creditor, n) { if (!debtor || !creditor || debtor === creditor) return; const O = S(w).owe; const m = O[debtor.agentId] || (O[debtor.agentId] = {}); m[creditor.agentId] = Math.round(((m[creditor.agentId] || 0) + n) * 10) / 10; }
    const owedTo = (w, debtor, creditor) => S(w).owe[debtor?.agentId]?.[creditor?.agentId] || 0;
    function repay(w, debtor, creditor, n) { const m = S(w).owe[debtor.agentId]; if (!m || !m[creditor.agentId]) return; m[creditor.agentId] = Math.max(0, m[creditor.agentId] - n); if (m[creditor.agentId] < 0.5) delete m[creditor.agentId]; }
    // 婚禮禮金:收過對方的禮要包回去(大方的多包、小氣或手頭緊的包少)
    function giftAmount(w, x, A, B) {
        const X = S(w); const exp = Math.max(X.gift[A.agentId + '>' + x.agentId] || 0, X.gift[B.agentId + '>' + x.agentId] || 0);
        let n = 2 + Math.floor(Math.random() * 7); if (!exp) return n;
        n = exp * (hasT(x, 'kind') || hasT(x, 'charismatic') ? 1.2 : hasT(x, 'greedy') ? 0.5 : 0.8 + Math.random() * 0.4);
        const cash = typeof WALLET !== 'undefined' ? WALLET.get(w, x) : 50; if (cash < exp * 3) n = Math.min(n, exp * 0.6); // 手頭緊只好少包
        return Math.max(2, Math.round(n));
    }
    function onGift(w, x, A, B, n) {
        const X = S(w); const exp = Math.max(X.gift[A.agentId + '>' + x.agentId] || 0, X.gift[B.agentId + '>' + x.agentId] || 0); const giver = (X.gift[A.agentId + '>' + x.agentId] || 0) >= (X.gift[B.agentId + '>' + x.agentId] || 0) ? A : B;
        X.gift[x.agentId + '>' + A.agentId] = n; X.gift[x.agentId + '>' + B.agentId] = n;
        owe(w, A, x, n / 2); owe(w, B, x, n / 2); repay(w, x, A, n / 2); repay(w, x, B, n / 2); bump(X, 'gift');
        if (exp && n < exp * 0.7) {
            addAff(giver, x, -6); bump(X, 'stingy'); mem(w, giver, '{x}包的禮金只有 {n}，當初我包給他的可是 {m}。', { x: x.name, n, m: exp }, 6);
            if (Math.random() < 0.5) log(w, '💌 {a}私下算了算禮金：{x}只包了 {n}，當初{a}包給{x}的是 {m}。兩家從此見面只點頭。', { a: giver.name, x: x.name, n, m: exp }, giver.name, x.name);
        }
    }
    function onFuneral(w, guests, host) { if (!host) return; for (const g of guests || []) if (g !== host) owe(w, host, g, 1); }

    // ================= 🙃 嘴硬 =================
    const badOutcome = (o) => !!o && (o.mood <= -6 || o.pop <= -3 || (o.silver <= -80 && o.food < -30)); // 十天前後比,只有真的很差才算(心情本來就會上下晃)
    const goodOutcome = (o) => !!o && (o.mood >= 3 || o.food >= 60 || o.pop >= 2);
    function onBad(w, p) {
        const X = S(w); const pr = w.agents[p.proposerId]; const sup = Object.entries(p.votes || {}).filter(([id, v]) => v === 'for' && id !== p.proposerId).map(([id]) => w.agents[id]).filter(a => a && !a.isDead);
        const title = (() => { try { return w.proposals.title(p); } catch (e) { return p.id; } })();
        let admit = 0, blamers = [];
        for (const a of sup) {
            if ((hasT(a, 'kind') && Math.random() < 0.5) || hasV(a, '誠實') || Math.random() < 0.1) { admit++; mem(w, a, '「{t}」我當初也投了贊成，是我看走眼。', { t: title }, 5); setFace(w, a, faceOf(w, a) - 3); }
            else if (pr && Math.random() < 0.6) { blamers.push(a); addAff(a, pr, -2); mem(w, a, '「{t}」會搞砸，都是{p}沒辦好。', { t: title, p: pr.name }, 5); }
        }
        if (pr && !pr.isDead) loseFace(w, pr, p.status === 'failed' ? 4 : 8); X.trust = Math.max(20, X.trust - (p.status === 'failed' ? 0 : 2)); bump(X, 'bad'); if (admit) bump(X, 'admit', admit); if (blamers.length) bump(X, 'blame', blamers.length); // 缺料作罷不太算判斷錯誤,不扣信任
        if (blamers.length >= 1 && sup.length >= 2 && day(w) - (X.lastSaid ?? -99) >= 10) { X.lastSaid = day(w); const b = rnd(blamers); log(w, '🙃 {id}「{t}」沒有成功。當初投贊成的{a}跟人說：「我當初就覺得怪怪的。」', { id: p.id, t: title, a: b.name }, b.name); }
    }
    function onGood(w, p) { const X = S(w); const pr = w.agents[p.proposerId]; if (pr) setFace(w, pr, faceOf(w, pr) + 5); X.trust = Math.min(100, X.trust + 1); if (X.lobby[p.proposerId]) { delete X.lobby[p.proposerId]; if (pr) setFace(w, pr, faceOf(w, pr) + 15); } }

    // ================= 🤫 說一套做一套 =================
    const DEED = { steam_air: '自家工坊偷偷燒最便宜的黑煤', steam_factory: '讓學徒做到半夜', steam_homun: '偷偷叫人造人到自家田裡幹活', bio_gmban: '在市集偷買便宜的基因糧食', bio_safety: '把樣本帶回家沒上鎖', bio_price: '私下把藥加價賣給有錢人', tech_safety: '叫工人跳過核電廠的停機檢查', cal_close: '趁酒館關門時從後門溜進去喝酒', cal_mask: '一出家門就把口罩拉到下巴', cal_quar: '發著燒還偷偷溜出門', cal_lock: '封城期間偷偷出城去進貨', policy: '私下自己照樣不守' };
    function onApproved(w, p) {
        const X = S(w); if (p._lobby && X.lobby[p.proposerId]) { delete X.lobby[p.proposerId]; const pr = w.agents[p.proposerId]; if (pr) { setFace(w, pr, faceOf(w, pr) + 20); mem(w, pr, '私下一個一個去拜託，這次終於通過了。', {}, 7); } }
        if (!DEED[p.kind] || /^cal_/.test(p.kind)) return; // 疫情規定的陽奉陰違由 sim-plague-ways.js 看真的偷溜才算
        const owner = (a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
        const pool = Object.entries(p.votes || {}).filter(([, v]) => v === 'for').map(([id]) => w.agents[id]).filter(a => a && !a.isDead && (hasT(a, 'greedy') || hasT(a, 'lazy') || owner(a)));
        if (!pool.length || Math.random() > (p.kind === 'policy' ? 0.12 : 0.4)) return; const a = rnd(pool); // 一般政令比較少人陽奉陰違;真的有限制的法律才常見
        let title = p.id; try { title = w.proposals.title(p); } catch (e) {}
        X.hyp.push({ a: a.agentId, k: p.kind, t: title, d: day(w) }); if (X.hyp.length > 12) X.hyp = X.hyp.slice(-12);
        mem(w, a, '「{t}」我是投了贊成，不過自己私下……反正沒人看見。', { t: title }, 4);
    }
    function expose(w, h) {
        const X = S(w); const a = w.agents[h.a]; h.exp = day(w); if (!a || a.isDead) return;
        loseFace(w, a, 25); X.trust = Math.max(20, X.trust - 6); bump(X, 'hyp');
        for (const x of adults(w)) if (x !== a && Math.random() < 0.6) addAff(x, a, -3);
        mem(w, a, '被人撞見了，這下全鎮都知道我說一套做一套。', {}, 8);
        log(w, '🤫 當初投票支持「{t}」的{a}，被人撞見{deed}。', { t: h.t, a: a.name, deed: DEED[h.k] || DEED.policy }, a.name);
        news(w, '🤫 {a}說一套做一套，被人撞見了', { a: a.name }, 6, [a.name]);
    }

    // ================= 🏠 跟鄰居比 =================
    function onRenovate(w, home, payer) {
        const X = S(w); const d = day(w); X.reno.push(d); X.reno = X.reno.filter(x => d - x <= 30); bump(X, 'reno');
        if (typeof HOUSING === 'undefined') return; const H = HOUSING.S(w); const byHome = {};
        for (const a of npcs(w)) { const h = HOUSING.houseOf(w, a); if (h && h !== home) (byHome[h] || (byHome[h] = [])).push(a); }
        const lvNew = H.lv[home] ?? 0; const cand = Object.entries(byHome).filter(([h]) => (H.lv[h] ?? HOUSING.maxLv(w)) < lvNew).sort(() => Math.random() - 0.5).slice(0, 2);
        for (const [h, ppl] of cand) {
            X.envy[h] = d; const b = ppl.slice().sort((x, y) => (typeof WALLET !== 'undefined' ? WALLET.get(w, y) - WALLET.get(w, x) : 0))[0]; if (!b) continue;
            b.moodModifier = (b.moodModifier || 0) - 3; mem(w, b, '{a}家翻修好了，看了心裡不是滋味。', { a: payer?.name || '' }, 5); bump(X, 'envy');
            if (Math.random() < 0.4 && payer) log(w, '🏠 {a}家翻修好了，隔壁的{b}站在門口看了很久。', { a: payer.name, b: b.name }, b.name);
        }
        if (X.reno.length === 3 && payer) log(w, '🏠 本來沒人在意屋頂是什麼顏色，直到{a}家先翻修。這個月已經是第三戶了。', { a: payer.name }, payer.name);
    }
    // 眼紅的人家手頭不夠:去銀行借錢也要翻修
    function envyBorrow(w) {
        const X = S(w); const d = day(w); if (typeof HOUSING === 'undefined' || typeof BANK === 'undefined' || !w.bank || typeof WALLET === 'undefined') return;
        const H = HOUSING.S(w); const top = HOUSING.maxLv(w);
        for (const [h, dd] of Object.entries(X.envy)) {
            if (d - dd > 30) { delete X.envy[h]; continue; } const lv = H.lv[h] ?? top; if (lv >= top) { delete X.envy[h]; continue; }
            const ppl = npcs(w).filter(a => HOUSING.houseOf(w, a) === h); const b = ppl.sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0]; if (!b) continue;
            const need = Math.ceil(HOUSING.COST[lv + 1] * 1.25 - WALLET.get(w, b)); if (need <= 0 || hasT(b, 'ascetic') || Math.random() > 0.08) continue;
            try { const B = BANK.S(w); const got = BANK.lend(w, B, b, need, t('跟鄰居一樣翻修房子')); if (got) { bump(X, 'borrow'); delete X.envy[h]; log(w, '🏦 {a}為了把家翻修得跟鄰居一樣，跟銀行借了 {n} 銀幣。', { a: b.name, n: got }, b.name); } } catch (e) {}
        }
    }

    // ================= 👴 懷舊 =================
    const NEW_KINDS = ['research', 'build', 'factory', 'industry', 'industry_up', 'tech_path', 'upgrade', 'market'];
    const old = (a) => (a.age ?? 30) >= 60;
    function pastLeader(w) {
        try { if (typeof TIERS === 'undefined') return null; const C = TIERS.S(w).career || {}; let best = null;
            for (const [id, list] of Object.entries(C)) for (const x of list || []) if (x.role === 'leader' && x.to !== null && x.to !== undefined && (!best || x.to > best.to)) { const a = w.agents[id]; if (a) best = { a, to: x.to, e: x.e || '', lv: x.lv }; }
            return best; } catch (e) { return null; }
    }
    function nostalgia(w) {
        const X = S(w); const d = day(w); if (d % 7 !== 3 || Math.random() > 0.35) return;
        const o = rnd(adults(w).filter(old)); if (!o) return; const pl = pastLeader(w);
        if (pl && pl.a !== o) {
            const title = (() => { try { return TIERS.leaderTitle(w, pl.lv); } catch (e) { return t('首長'); } })();
            log(w, pl.e === 'lost' ? '👴 {a}又在說：「以前{m}當{title}的時候多好。」（{m}當年是落選下台的。）' : '👴 {a}又在說：「以前{m}當{title}的時候多好。」', { a: o.name, m: pl.a.name, title }, o.name);
        } else log(w, '👴 {a}又在說：「我年輕的時候，一斤米才兩個銅板，哪像現在。」', { a: o.name }, o.name);
        bump(X, 'nostalgia'); for (const y of adults(w).filter(x => (x.age ?? 30) < 30).sort(() => Math.random() - 0.5).slice(0, 2)) addAff(y, o, -1); // 年輕人聽多了會煩
    }

    // ================= ☕ 日常習慣 =================
    const SPOTS = ['town_square', 'tavern', 'park', 'chapel', 'market'];
    const SPOT_NAME = { town_square: '廣場', tavern: '酒館', park: '公園', chapel: '禮拜堂', market: '市集' };
    const SLOT_NAME = { am: '早上', pm: '傍晚' };
    function routineOf(w, a) {
        const X = S(w); let r = X.rt[a.agentId]; if (r) return r;
        const devout = (() => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } })();
        const spot = devout ? 'chapel' : old(a) ? rnd(['town_square', 'park', 'park']) : hasT(a, 'charismatic') || hasT(a, 'glutton') ? 'tavern' : a.job?.key === 'trader' ? 'market' : rnd(SPOTS);
        r = X.rt[a.agentId] = { s: spot, t: old(a) || hasT(a, 'early_bird') || a.isEarlyBird ? 'am' : rnd(['am', 'pm']) }; return r;
    }
    const ABSENT = []; // v8.2.0 其他系統可以說「這個人今天不出門」(例如怕被傳染待在家)
    const absent = (w, a) => { if (w.isAway?.(a.agentId)) return true; for (const f of ABSENT) try { if (f(w, a)) return true; } catch (e) {} try { return typeof HEALTH !== 'undefined' && w.health && (HEALTH.ails(w, a) || []).some(x => x.s >= 2); } catch (e) { return false; } };
    function routines(w) {
        const X = S(w); const groups = {}; let checked = 0;
        for (const a of adults(w).concat(npcs(w).filter(x => w.isAway?.(x.agentId)))) { const r = routineOf(w, a); const g = r.s + ':' + r.t; (groups[g] || (groups[g] = [])).push(a); }
        for (const [g, ppl] of Object.entries(groups)) {
            const here = ppl.filter(a => !absent(w, a)); const [spot, slot] = g.split(':');
            for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
                const a = here[i], b = here[j]; const k = key2(a.agentId, b.agentId); X.nod[k] = (X.nod[k] || 0) + 1;
                if (aff(a, b) < 35 && Math.random() < 0.5) { addAff(a, b, 1); addAff(b, a, 1); }
                if (X.nod[k] >= 45 && aff(a, b) < 15 && !X.odd[k] && day(w) - (X.lastBench ?? -99) >= 20) { X.odd[k] = 1; X.lastBench = day(w); bump(X, 'bench'); log(w, '🪑 {a}和{b}{slot}在{spot}碰面已經 {n} 天了，到現在還叫不出對方的名字。', { a: a.name, b: b.name, slot: SLOT_NAME[slot], spot: SPOT_NAME[spot], n: X.nod[k] }, a.name, b.name); }
            }
            for (const a of ppl) {
                X.miss[a.agentId] = absent(w, a) ? (X.miss[a.agentId] || 0) + 1 : 0;
                if (X.miss[a.agentId] === 2 && checked < 2) {
                    const m = here.filter(b => b !== a && (X.nod[key2(a.agentId, b.agentId)] || 0) >= 8 && !coldWith(w, a, b)).sort((x, y) => (X.nod[key2(a.agentId, y.agentId)] || 0) - (X.nod[key2(a.agentId, x.agentId)] || 0))[0];
                    if (m) { checked++; bump(X, 'check'); addAff(a, m, 4); addAff(m, a, 4); mem(w, a, '我兩天沒出門，{b}跑來敲門問我還好嗎。', { b: m.name }, 6); mem(w, m, '{a}兩天沒出現在{spot}，我去敲門看看。', { a: a.name, spot: SPOT_NAME[spot] }, 5);
                        log(w, '☕ {a}兩天沒出現在{spot}，{b}跑去敲門問候。', { a: a.name, b: m.name, spot: SPOT_NAME[spot] }, m.name, a.name); }
                }
            }
        }
        // 只留常碰面的配對(存檔不會越長越大)
        const ks = Object.keys(X.nod); if (ks.length > 240) for (const k of ks.sort((x, y) => X.nod[x] - X.nod[y]).slice(0, ks.length - 180)) delete X.nod[k];
        const od = Object.keys(X.odd); if (od.length > 40) for (const k of od.slice(0, od.length - 40)) delete X.odd[k];
        const gk = Object.keys(X.gift); if (gk.length > 200) for (const k of gk.slice(0, gk.length - 160)) delete X.gift[k];
    }

    // ================= 🧊 冷戰 =================
    const coldWith = (w, a, b) => { const c = S(w).cold[key2(a.agentId, b.agentId)]; return !!c && c.until > day(w); };
    const coldOf = (w, a) => { const out = new Set(); const d = day(w); for (const [k, c] of Object.entries(S(w).cold)) if (c.until > d) { const [x, y] = k.split('|'); if (x === a.agentId) out.add(y); else if (y === a.agentId) out.add(x); } return out; };
    function quarrel(w, a, b) {
        if (!a || !b || a === b || a.isPlayer || b.isPlayer || a.isDead || b.isDead) return; const X = S(w); const d = day(w); const k = key2(a.agentId, b.agentId);
        const c = X.cold[k]; if (c && c.until > d) { c.until = Math.min(c.d + 60, c.until + 5); return; }
        if (Math.random() > 0.6) return;
        X.cold[k] = { d, until: d + 10 + Math.floor(Math.random() * 20) }; bump(X, 'cold');
        mem(w, a, '跟{b}吵完架，我不想再跟他說話了。', { b: b.name }, 6); mem(w, b, '跟{a}吵完架，我不想再跟他說話了。', { a: a.name }, 6);
        log(w, '🧊 {a}和{b}吵完架開始冷戰，在路上遇到都繞路走。', { a: a.name, b: b.name }, a.name, b.name);
        // 共同的朋友被迫選邊
        for (const f of adults(w)) { if (f === a || f === b || aff(f, a) < 25 || aff(f, b) < 25) continue; const side = aff(f, a) >= aff(f, b) ? a : b; const other = side === a ? b : a; addAff(f, other, -3); bump(X, 'side'); if (Math.random() < 0.3) mem(w, f, '{a}和{b}在冷戰，我好像得站在{s}那邊。', { a: a.name, b: b.name, s: side.name }, 4); }
    }
    function coldDaily(w) {
        const X = S(w); const d = day(w);
        for (const [k, c] of Object.entries(X.cold)) {
            const [x, y] = k.split('|'); const a = w.agents[x], b = w.agents[y]; if (!a || !b || a.isDead || b.isDead) { delete X.cold[k]; continue; }
            if (c.until <= d) {
                if (c.done) { if (d - c.until > 60) delete X.cold[k]; continue; } c.done = 1;
                if (Math.random() < 0.6) { addAff(a, b, 8); addAff(b, a, 8); bump(X, 'thaw'); log(w, '🫖 冷戰了 {n} 天，{a}和{b}在井邊碰到，終於開口打了招呼。', { n: c.until - c.d, a: a.name, b: b.name }, a.name, b.name); }
                else { addAff(a, b, -5); addAff(b, a, -5); bump(X, 'apart'); log(w, '🧊 {a}和{b}冷戰到最後，從此不再往來。', { a: a.name, b: b.name }, a.name, b.name); }
            } else if (aff(a, b) >= 10 && aff(b, a) >= 10 && d - c.d >= 2) { c.until = d; c.done = 1; bump(X, 'thaw'); log(w, '🤝 {a}和{b}終於和好了，冷戰結束。', { a: a.name, b: b.name }, a.name, b.name); }
        }
    }
    // 婚禮上冷戰的兩個人被排在同一桌
    function weddingGuests(w, guests, c) {
        const X = S(w); if (!guests?.length) return; const d = day(w);
        for (let i = 0; i < guests.length; i++) for (let j = i + 1; j < guests.length; j++) {
            const a = guests[i], b = guests[j]; const cc = X.cold[key2(a.agentId, b.agentId)];
            if (cc && cc.until > d && !cc.table) { cc.table = 1; bump(X, 'table'); log(w, '💒 冷戰中的{a}和{b}在{x}的婚宴上被排在同一桌，全場都在偷看。', { a: a.name, b: b.name, x: c?.name || '' }, a.name, b.name); return; }
        }
    }

    // ================= 投票:人情、拉票、信任、懷舊 =================
    function vote(w, p, a) {
        const X = S(w); const v = p.votes?.[a.agentId]; if (!v) return; const pr = w.agents[p.proposerId]; const why = (k) => { (p.why || (p.why = {}))[a.agentId] = k; };
        if (pr && pr !== a && v === 'against') {
            const o = owedTo(w, a, pr);
            if (o >= 3 && Math.random() < Math.min(0.6, o / 12)) { p.votes[a.agentId] = 'for'; why('owe'); repay(w, a, pr, 3); bump(X, 'oweVote'); return; }
            if (p._lobby && aff(a, pr) >= 0 && Math.random() < 0.35) { p.votes[a.agentId] = 'for'; why('lobbied'); bump(X, 'lobbyVote'); return; }
        }
        if (v === 'for' && pr && pr !== a && X.trust < 45 && aff(a, pr) < 30 && owedTo(w, a, pr) < 2 && Math.random() < Math.min(0.2, (45 - X.trust) / 120)) { p.votes[a.agentId] = 'against'; why('distrust'); bump(X, 'distrustVote'); return; }
        if (v === 'for' && old(a) && NEW_KINDS.includes(p.kind) && Math.random() < 0.25 + (hasV(a, '傳統') ? 0.15 : 0)) { p.votes[a.agentId] = 'against'; why('oldways'); bump(X, 'oldVote'); }
    }

    // ================= 每天 =================
    function daily(w) {
        const X = S(w); const d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        for (const id of Object.keys(X.face)) { const v = X.face[id]; if (!w.agents[id] || w.agents[id].isDead) { delete X.face[id]; continue; } X.face[id] = v < 50 ? Math.min(50, v + 0.5) : Math.max(50, v - 0.2); }
        for (const [id, u] of Object.entries(X.shame)) if (u <= d || !w.agents[id]) delete X.shame[id];
        for (const [id, dd] of Object.entries(X.lobby)) if (d - dd > 40 || !w.agents[id]) delete X.lobby[id];
        X.trust += X.trust < 60 ? 0.25 : X.trust > 60 ? -0.1 : 0; // 不愉快會慢慢淡忘
        // 人情慢慢淡掉;互相欠人情的人越走越近
        for (const [db, m] of Object.entries(X.owe)) { if (!w.agents[db] || w.agents[db].isDead) { delete X.owe[db]; continue; } for (const cr of Object.keys(m)) { m[cr] *= 0.99; if (m[cr] < 0.5 || !w.agents[cr]) delete m[cr]; } if (!Object.keys(m).length) delete X.owe[db]; }
        if (d % 7 === 0) for (const [db, m] of Object.entries(X.owe)) for (const cr of Object.keys(m)) if (m[cr] >= 2 && (X.owe[cr]?.[db] || 0) >= 2) { const a = w.agents[db], b = w.agents[cr]; if (a && b) { addAff(a, b, 1); addAff(b, a, 1); } }
        for (const h of X.hyp) if (!h.exp && d - h.d >= 3 && Math.random() < 0.02) expose(w, h);
        X.hyp = X.hyp.filter(h => !h.exp || d - h.exp < 120);
        // 沉默的人太多:看不下去的人提鄰里茶會
        const sil = silent(w); const A = adults(w);
        if (A.length && sil.length >= Math.max(2, Math.round(A.length * 0.12)) && d - (X.lastForum ?? -99) >= 45 && typeof TECH !== 'undefined' && !TECH.busy(w, 'ways_forum')) {
            const who = A.filter(a => !sil.includes(a.agentId)).sort((x, y) => ((hasT(y, 'kind') ? 2 : 0) + (hasT(y, 'charismatic') ? 2 : 0) + (hasV(y, '社群') ? 1 : 0)) - ((hasT(x, 'kind') ? 2 : 0) + (hasT(x, 'charismatic') ? 2 : 0) + (hasV(x, '社群') ? 1 : 0)))[0];
            if (who) { X.lastForum = d; TECH.propose(w, 'ways_forum', 'ways', who, '辦一場鄰里茶會', '{who}說最近大家都不太敢開口提事情了，提議辦一場鄰里茶會：每個人都能說說自己的想法，說錯了也沒關係。只花一點茶點錢。', {}, 'culture'); }
        }
        envyBorrow(w); nostalgia(w); routines(w); coldDaily(w);
    }

    // ================= 給介面與 AI =================
    function view(w) {
        const X = S(w); const d = day(w); let favors = 0; for (const m of Object.values(X.owe)) favors += Object.keys(m).length;
        const colds = Object.entries(X.cold).filter(([, c]) => c.until > d).map(([k]) => k.split('|').map(id => w.agents[id]?.name || '').filter(Boolean));
        return { trust: Math.round(X.trust), trustLv: X.trust >= 65 ? 'high' : X.trust >= 45 ? 'mid' : 'low', silent: silent(w).map(id => w.agents[id]?.name).filter(Boolean), favors, colds, envy: Object.keys(X.envy).length, st: X.st,
            hyp: X.hyp.filter(h => !h.exp).map(h => ({ name: w.agents[h.a]?.name || '', t: h.t, deed: DEED[h.k] || DEED.policy })) };
    }
    function brief(w, a) {
        const X = S(w); const out = []; const d = day(w);
        if (X.shame[a.agentId] > d) out.push(t('提案被當眾否決，這陣子覺得很沒面子，不太想再提事情'));
        const m = X.owe[a.agentId] || {}; const top = Object.entries(m).sort((x, y) => y[1] - x[1])[0]; if (top && top[1] >= 4 && w.agents[top[0]]) out.push(t('我欠{x}一份人情').replace('{x}', t(w.agents[top[0]].name)));
        for (const id of coldOf(w, a)) { const b = w.agents[id]; if (b) { out.push(t('我跟{x}在冷戰，不想跟他說話').replace('{x}', t(b.name))); break; } }
        if (old(a)) out.push(t('我常覺得以前的日子比較好'));
        const r = X.rt[a.agentId]; if (r) out.push(t('我每天{slot}都會去{spot}坐坐').replace('{slot}', t(SLOT_NAME[r.t])).replace('{spot}', t(SPOT_NAME[r.s])));
        return out;
    }
    function townBrief(w) { const X = w.ways; if (!X) return ''; return X.trust < 45 ? t('鎮上的人最近不太相信喊口號的人') : silent(w).length >= 3 ? t('鎮上最近很多人不敢開口提事情') : ''; }
    return { ABSENT, S, faceOf, setFace, loseFace, onRejected, silent, forum, owe, owedTo, repay, giftAmount, onGift, onFuneral, badOutcome, goodOutcome, onBad, onGood, DEED, onApproved, expose, onRenovate, envyBorrow, NEW_KINDS, pastLeader, nostalgia, SPOTS, routineOf, routines, coldWith, coldOf, quarrel, coldDaily, weddingGuests, vote, daily, view, brief, townBrief, SYS };
})();

if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { ways_forum: { icon: '🫖', label: '鄰里茶會' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { owe: '欠了人情，不好意思反對', lobbied: '被私下拜託過', distrust: '最近不太相信提案的人', oldways: '以前那樣就好' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily; PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) WAYS.daily(w); } catch (e) { console.warn('[Ways] daily', e); } return r; };
    // 提案的結果:否決丟面子、失敗或成效差的嘴硬、法律通過之後說一套做一套
    const _nt = PS._notify; PS._notify = function (w, kind, p, ...rest) {
        try { if (w.observerMode && p) { if (kind === 'rejected') WAYS.onRejected(w, p); else if (kind === 'approved') WAYS.onApproved(w, p); else if (kind === 'failed') WAYS.onBad(w, p); else if (kind === 'outcome') { const C = w.calamity; const plague = !!C?.cur?.found || (C?.hist?.[0]?.end != null && (w._absDay?.() ?? 0) - C.hist[0].end <= 10); /* v8.2.0 疫情期間鎮上的好壞都算在疫情頭上,不算提案的功過 */ if (plague) {} else if (WAYS.badOutcome(p.outcome)) WAYS.onBad(w, p); else if (WAYS.goodOutcome(p.outcome)) WAYS.onGood(w, p); } } } catch (e) { console.warn('[Ways] notify', e); }
        return _nt.call(this, w, kind, p, ...rest);
    };
    // 沉默期的人不提案;拉票的人下一個提案大家比較會投贊成
    const _cw = PS._createWith; if (_cw) PS._createWith = function (w, d, cand, who, ...rest) {
        try { const X = WAYS.S(w); if (who && !WAYS.SYS.test(cand?.kind || '') && X.shame[who.agentId] > d) return null; } catch (e) {}
        const p = _cw.call(this, w, d, cand, who, ...rest); try { if (p && who && WAYS.S(w).lobby[who.agentId]) p._lobby = true; } catch (e) {} return p;
    };
    const _rv = PS._ruleVote; PS._ruleVote = function (w, p, a, ...rest) {
        if (p.kind === 'ways_forum') { const hasT = (k) => (a.personality?.traits || []).includes(k); const s = 0.6 + (hasT('kind') ? 0.8 : 0) + (hasT('charismatic') ? 0.4 : 0) - (hasT('abrasive') ? 0.6 : 0) - (hasT('greedy') ? 0.3 : 0) + Math.random() - 0.5; p.votes[a.agentId] = s > 0 ? 'for' : 'against'; (p.why || (p.why = {}))[a.agentId] = s > 0 ? 'care' : 'gut'; return; }
        const r = _rv.call(this, w, p, a, ...rest); try { if (w.observerMode) WAYS.vote(w, p, a); } catch (e) {} return r;
    };
}
// 吵架 → 冷戰;冷戰的兩個人不聊天
if (typeof Agent !== 'undefined') {
    const AP = Agent.prototype; const _at = AP.addThought;
    AP.addThought = function (kind, world, targetId, targetName, ...rest) { const r = _at.call(this, kind, world, targetId, targetName, ...rest); try { if (world?.observerMode && targetId && (kind === 'fought' || kind === 'harsh_words')) WAYS.quarrel(world, this, world.agents[targetId]); } catch (e) {} return r; };
    const _tsi = AP._trySocialInteraction;
    if (_tsi) AP._trySocialInteraction = function (world, ...rest) {
        let cw = null; try { cw = world?.ways ? WAYS.coldOf(world, this) : null; } catch (e) {}
        if (!cw || !cw.size) return _tsi.call(this, world, ...rest);
        const own = Object.prototype.hasOwnProperty.call(world, 'getAgentsAtLocation'); const g = world.getAgentsAtLocation;
        world.getAgentsAtLocation = function (loc) { return g.call(this, loc).filter(x => !cw.has(x.agentId)); };
        try { return _tsi.call(this, world, ...rest); } finally { if (own) world.getAgentsAtLocation = g; else delete world.getAgentsAtLocation; }
    };
}
// 翻修 → 鄰居眼紅
if (typeof HOUSING !== 'undefined') {
    const _hd = HOUSING.daily; HOUSING.daily = function (w, ...rest) {
        let before = null; try { before = Object.assign({}, HOUSING.S(w).lv); } catch (e) {}
        const r = _hd.call(this, w, ...rest);
        try { if (before && w.observerMode) { const H = HOUSING.S(w); for (const [h, lv] of Object.entries(H.lv)) if (lv > (before[h] ?? HOUSING.maxLv(w)) && before[h] !== undefined) { const ppl = Object.values(w.agents).filter(a => !a.isDead && HOUSING.houseOf(w, a) === h); const payer = ppl.sort((x, y) => (typeof WALLET !== 'undefined' ? WALLET.get(w, y) - WALLET.get(w, x) : 0))[0]; WAYS.onRenovate(w, h, payer); } } } catch (e) { console.warn('[Ways] reno', e); }
        return r;
    };
}
// 災後幫忙 → 受害者欠一份人情
if (typeof AFTERMATH !== 'undefined') {
    const _act = AFTERMATH.act; AFTERMATH.act = function (w, a, r, cr, ...rest) { const out = _act.call(this, w, a, r, cr, ...rest); try { if (out && ['help', 'volunteer', 'comfort'].includes(r)) for (const id of (cr?.vic || []).slice(0, 4)) { const v = w.agents[id]; if (v && v !== a) WAYS.owe(w, v, a, 2); } } catch (e) {} return out; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = WAYS.brief(world, a); if (s.length && b) b.mem = [...(b.mem || []), ...s.slice(0, 2)]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = WAYS.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.ways = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.ways) { const X = this.ways; d.ways = { face: X.face, shame: X.shame, lobby: X.lobby, owe: X.owe, gift: X.gift, trust: X.trust, hyp: X.hyp, rt: X.rt, nod: X.nod, miss: X.miss, cold: X.cold, envy: X.envy, reno: X.reno, st: X.st, odd: X.odd, lastForum: X.lastForum ?? null }; } return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.ways = (data?.ways && typeof data.ways === 'object') ? data.ways : null; } catch (e) {} return r; };
}
if (typeof window !== 'undefined') window.WAYS = WAYS;
