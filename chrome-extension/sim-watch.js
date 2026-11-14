// RimTown - sim-watch.js：事件追蹤紀錄器（觀察工具原型，只看不改）
// 目的：把鎮上「持續進行的一件事」整理成一條事件（誰發起、問了誰、誰答應、誰真的去了、結果與後續），
//       讓玩家不用逐一翻村民日誌。這一版先做兩種事件：
//       1. 工資爭議（sim-market.js 的砍薪與自發罷工、sim-union.js 的工會談判與罷工、sim-decide-pol.js 的個人決定）
//       2. 抗議集合（sim-things.js 的貼告示、sim-decide-crowd.js 的「去不去」、隔天真的走到現場）
//       3. 典禮（sim-ceremony.js 的婚禮、葬禮、追思會：遊戲把賓客的目的地設成會場）
//       另外把打架與守衛抓人各記成單一事件（遊戲沒有把人排到任何地方，所以只有紀錄）。
// 原則：
//   - 只讀：不呼叫 Math.random、不寫記憶、不動任何遊戲狀態、不進存檔（狀態放在 WeakMap，不掛在 world 上）。
//   - 每一筆都帶來源（src）：log＝遊戲日誌原句、decision＝決策核心的紀錄、state＝讀到的狀態變化。沒有資料就不寫。
//   - 被問到、回答、實際行動、結果分開記，不混成一筆。
//   - 只用明確的鍵把紀錄接到同一件事（行業、東西的編號、當事人的編號）；不因為時間相近就接在一起。
//     日誌只寫名字：鎮上有同名的人、又分不出是哪一個時不猜，那一筆標成「同名，沒有接到人」。
//   - 「沒有紀錄」只代表紀錄器沒有讀到，不代表沒有發生。文字一律寫「沒有記到」「沒有被排去」，不寫「沒有發生」「沒有去」。
//   - 沒有呼叫 WATCH.attach(world) 之前完全不運作。這個檔目前沒有放進 town.html，正式站不會載入。
// 必須在 simulation.js、sim-decide.js、sim-market.js、sim-union.js、sim-things.js 之後載入。
'use strict';

const WATCH = (() => {
    const ST = new WeakMap();
    const FORMAT = 1;
    const CAP = { threads: 300, timeline: 400, frames: 400 };
    const FOLLOW_DAYS = 21; // 事件結束後還接多久的後續（退會、開除期滿、工資變動）

    // ---------- 小工具（全部只讀） ----------
    const day = (w) => { try { return w._absDay ? w._absDay() : 0; } catch (e) { return 0; } };
    const stamp = (w) => ({ d: day(w), tick: w.tickCount || 0, time: w.clock?.timeStr || '' });
    const render = (k, p) => { try { return typeof Memory !== 'undefined' && Memory.render ? Memory.render(k, p || {}) : String(k); } catch (e) { return String(k); } };
    const say = (x) => (x == null ? '' : typeof x === 'string' ? render(x, {}) : x.raw != null ? String(x.raw) : x.k ? render(x.k, x.p || {}) : '');
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const UN = () => (typeof UNION !== 'undefined' ? UNION : null);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const named = (w, name) => (name ? Object.values(w.agents || {}).filter(a => a.name === name) : []);
    // 日誌只寫名字、不寫編號。同名的人不只一個時，只用這件事裡已知的當事人（編號）來挑；挑不出唯一的一個就不猜，回傳 null
    function byName(w, name, T) {
        const c = named(w, name); if (c.length <= 1) return c[0] || null;
        const hint = new Set(T ? [...Object.keys(T.people || {}), T.sector ? ownerOf(w, T.sector) : null, T.type === 'wage' || T.type === 'union' ? w.union?.leader : null].filter(Boolean) : []);
        const m = c.filter(a => hint.has(a.agentId)); return m.length === 1 ? m[0] : null;
    }
    const secName = (k) => { try { return MK().name(k); } catch (e) { return k; } };
    const secByName = (name) => { const M = MK(); if (!M || !name) return null; for (const [k, s] of Object.entries(M.SECTORS)) if (s.zh === name || s.en === name || M.name(k) === name) return k; return null; };
    const payOf = (w, k) => { const v = w.market?.pay?.[k]; return typeof v === 'number' ? v : 1; };
    const ownerOf = (w, k) => (w.market?.owners ? w.market.owners[k] || null : null);
    const sectorOf = (w, a) => { try { return w.market && UN() ? UN().sectorOf(w, a) : null; } catch (e) { return null; } };
    const pct = (x) => Math.round(x * 100);
    const inTown = (w, a) => !!a && !a.isDead && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);

    // ---------- 事件與參與者 ----------
    function thread(st, w, key, init) {
        let T = st.idx[key]; if (T) return T;
        T = Object.assign({ id: 'E' + (++st.n), key, type: '', title: '', place: null, status: 'open', stage: '', outcome: null, opened: stamp(w), closed: null, people: {}, timeline: [], resources: [], open: [], scene: null, notes: [] }, init);
        st.idx[key] = T; st.threads.push(T);
        if (st.threads.length > CAP.threads) { let i = st.threads.findIndex(x => x.status === 'closed' && x !== T); if (i < 0) i = 0; drop(st, st.threads.splice(i, 1)[0]); }
        return T;
    }
    // 被捨棄的事件不會匯出，所以任何還指著它的索引都要清掉，不然之後的紀錄會寫進一條看不到的事件
    function drop(st, old) {
        delete st.idx[old.key]; st.evicted = (st.evicted || 0) + 1;
        for (const k of Object.keys(st.wage)) if (st.wage[k] === old) delete st.wage[k];
        for (const k of Object.keys(st.prot)) if (st.prot[k] === old) delete st.prot[k];
        for (const k of Object.keys(st.cer)) if (st.cer[k] === old) st.cer[k] = { status: 'dropped' }; // 留一個記號，免得同一場典禮又被當成新的
        st.fights = st.fights.filter(x => x !== old);
    }
    function person(T, a, role) {
        if (!a) return null; const id = a.agentId; const P = T.people[id] || (T.people[id] = { id, name: a.name, roles: [], asked: [], answered: [], acted: [], result: [] });
        if (role && !P.roles.includes(role)) P.roles.push(role); return P;
    }
    // 一筆時間線。mk＝合併鍵：同一個人重複做同一個回答時合併成一筆（times 加一），不洗版
    function add(T, w, e) {
        const s = stamp(w); const L = T.timeline;
        if (e.names) { const who = [], unsure = []; for (const n of e.names) { const a = byName(w, n, T); if (a) who.push(a.agentId); else if (named(w, n).length > 1) unsure.push(n); } e.who = who; delete e.names; if (unsure.length) e.whoUnsure = unsure; }
        if (e.mk) { const prev = L.slice(-12).reverse().find(x => x.mk === e.mk); if (prev) { prev.times = (prev.times || 1) + 1; prev.lastD = s.d; prev.lastTime = s.time; return prev; } }
        const x = Object.assign({ n: (T.tn = (T.tn || 0) + 1), d: s.d, tick: s.tick, time: s.time }, e); L.push(x); if (L.length > CAP.timeline) { L.shift(); T.dropped = (T.dropped || 0) + 1; }
        T.last = s; return x;
    }
    const setStage = (T, stage) => { T.stage = stage; };
    function close(T, w, outcome, text) { T.outcome = { code: outcome, text, at: stamp(w) }; T.status = 'closed'; T.closed = stamp(w); T.stage = 'ended'; T.open = T.open.filter(o => o.keep); }
    const commit = (T, w, code, text, extra) => { T.open = T.open.filter(o => o.code !== code); T.open.push(Object.assign({ code, text, since: stamp(w) }, extra || {})); };
    const settle = (T, code) => { T.open = T.open.filter(o => o.code !== code); };

    // ---------- 工資爭議 ----------
    // 同一行同時只有一條進行中的爭議；結束之後又有新的砍薪、要求或罷工，才開下一條
    function wage(st, w, k, fresh) {
        const cur = st.wage[k]; if (cur && cur.status === 'open') return cur;
        if (cur && !fresh && day(w) - (cur.closed?.d ?? -99) <= FOLLOW_DAYS) return cur; // 後續接在剛結束的那一條
        const M = MK(); const boss = w.agents[ownerOf(w, k)] || null; const n = (st.wageN[k] = (st.wageN[k] || 0) + 1);
        const T = thread(st, w, 'wage:' + k + ':' + n, { type: 'wage', sector: k, title: render('{s}的工資爭議', { s: secName(k) }) + (n > 1 ? render('（第 {n} 次）', { n }) : ''), stage: 'grievance',
            place: { id: null, name: secName(k), note: render('談判和罷工都沒有集合地點：程式直接在資料上結算，不會把人排到某個地方。罷工期間程式不算這些人的產出和工資；每個人當天實際在哪裡，這裡沒有記。', {}) } });
        st.wage[k] = T; if (boss) person(T, boss, 'boss');
        try { if (M) T.facts = { pay: pct(payOf(w, k)), workers: M.workersOf(w, k, npcs(w)).filter(a => a.agentId !== ownerOf(w, k)).length, boss: boss?.name || null, tier: typeof TIERS !== 'undefined' ? TIERS.level(w) : null, union: !!w.union?.on }; } catch (e) {}
        return T;
    }
    function unionThread(st, w) {
        const U = w.union; const key = 'union:' + (U?.on ? U.founded : 'pre' + (st.unionN || 0));
        if (st.idx[key]) return st.idx[key];
        return thread(st, w, key, { type: 'union', title: U?.on ? render('{u}的組織', { u: U.name }) : render('有人考慮組工會', {}), stage: U?.on ? 'active' : 'considering',
            place: { id: null, name: '', note: render('組工會、入會、退會都沒有現場，是每個人自己的決定。', {}) } });
    }

    // 日誌原句 → 事件（鍵是遊戲裡的原句；測試會檢查這些原句都還在原始檔裡）
    const LOGS = {
        '✂️ {o}的{s}把工資砍到原本的 {p}%。': (st, w, e) => { const k = secByName(e.p.s); if (!k) return; const cur = st.wage[k]; if (payOf(w, k) >= 1 && !(cur && cur.status === 'open')) return; /* 從高於原本砍回原本，不算被壓 */ const T = wage(st, w, k, true); add(T, w, { kind: 'cause', text: e.text, names: [e.p.o], src: e.src }); },
        '✊ {s}的 {n} 個工人罷工了，要求{o}加薪。': (st, w, e) => { const k = secByName(e.p.s); if (!k) return; const T = wage(st, w, k, true); setStage(T, 'strike'); const M = MK();
            add(T, w, { kind: 'strike', text: e.text, src: e.src, note: render('這是工人自發的罷工：程式把這一行的工人全部算進去，沒有逐一問每個人。', {}) });
            try { for (const a of M.workersOf(w, k, npcs(w)).filter(a => a.agentId !== ownerOf(w, k) && !M.isRivalEmp(w, k, a))) person(T, a, 'worker').acted.push({ d: day(w), code: 'wildcat', text: render('被算進罷工的人（沒有個別決定）', {}), src: { type: 'state', path: 'market.workersOf' } }); } catch (x) {}
            commit(T, w, 'strike_end', render('罷工兩天後結束，老闆讓不讓步到時候才知道', {}), { until: w.market?.strike?.[k] ?? null }); },
        '🤝 {o}讓步了，{s}的工資調回原本的 {p}%。': (st, w, e) => { const k = secByName(e.p.s); const T = k && st.wage[k]; if (!T) return; add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src }); close(T, w, 'raise_after_strike', e.text); },
        '😠 {o}不肯讓步，{s}的工人只好回去上工。': (st, w, e) => { const k = secByName(e.p.s); const T = k && st.wage[k]; if (!T) return; add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src }); close(T, w, 'strike_failed', e.text); },
        '✊ {a}號召{n}個工人成立了「{u}」，要一起跟老闆爭取工資。': (st, w, e) => { const old = st.idx['union:pre' + (st.unionN || 0)]; const T = unionThread(st, w); if (old && old !== T) { old.status = 'closed'; old.closed = stamp(w); old.outcome = { code: 'founded', text: e.text, at: stamp(w) }; old.stage = 'ended'; st.unionN = (st.unionN || 0) + 1; }
            setStage(T, 'active'); add(T, w, { kind: 'organize', text: e.text, names: [e.p.a], src: e.src }); const a = byName(w, e.p.a, T); if (a) person(T, a, 'leader'); },
        '🥀 {u}沒有會員了，就此解散。': (st, w, e) => { const T = lastUnion(st); if (!T) return; add(T, w, { kind: 'outcome', text: e.text, src: e.src }); close(T, w, 'dissolved', e.text); },
        '✊ {a}接下了{u}的領袖。': (st, w, e) => { const T = lastUnion(st); if (!T) return; add(T, w, { kind: 'organize', text: e.text, names: [e.p.a], src: e.src }); const a = byName(w, e.p.a, T); if (a) person(T, a, 'leader'); },
        '💥 {a}收老闆錢的事曝光，被{u}趕下台，改由{b}帶領。': (st, w, e) => { const T = lastUnion(st); if (!T) return; add(T, w, { kind: 'conflict', text: e.text, names: [e.p.a, e.p.b], src: e.src }); },
        '📣 {u}向{o}提出要求：{s}的工資要調到原本的 {p}%。': (st, w, e) => { const k = secByName(e.p.s); if (!k) return; const T = wage(st, w, k, true); setStage(T, 'demand'); add(T, w, { kind: 'talk', text: e.text, names: [e.p.o], src: e.src });
            const L = w.agents[w.union?.leader]; if (L) person(T, L, 'leader'); commit(T, w, 'await_boss', render('等{o}回覆；三天沒回話就當作不答應', { o: e.p.o })); },
        '🤝 {u}跟{o}談成了，{s}的工資調到原本的 {p}%。': (st, w, e) => { const k = secByName(e.p.s); if (!k) return; const T = wage(st, w, k, true); add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src }); close(T, w, 'deal', e.text); },
        '🤐 {u}跟{o}的談判不了了之。': (st, w, e) => { for (const k of histSectors(st, w, 'bribe', e.p.o)) { const T = wage(st, w, k, true); add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src, uncertain: st._amb || undefined });
            add(T, w, { kind: 'hidden', text: render('（只有觀察者看得到）工會的紀錄寫著這次是「收買」：領袖私下收了老闆的錢。鎮民目前不知道。', {}), src: { type: 'state', path: 'union.history', value: 'bribe' } }); close(T, w, 'stalled', e.text); } },
        '😠 {o}拒絕了{u}的加薪要求，工會的錢還不夠罷工。': (st, w, e) => { for (const k of talkSectors(st, w, e.p.o)) { const T = wage(st, w, k, true); add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src, uncertain: st._amb || undefined }); close(T, w, 'refused', e.text); } },
        '🚪 {o}開除了帶頭要加薪的{a}。': (st, w, e) => { for (const k of histSectors(st, w, 'fire', e.p.o)) { const T = wage(st, w, k, true); add(T, w, { kind: 'conflict', text: e.text, names: [e.p.o, e.p.a], src: e.src, uncertain: st._amb || undefined }); const a = byName(w, e.p.a, T);
            if (a) { person(T, a, 'worker').result.push({ d: day(w), code: 'fired', text: render('被開除，兩週沒工作', {}), src: e.src }); T.open.push({ code: 'fired:' + a.agentId, keep: true, text: render('{a}被開除，到第 {d} 天才能回去上工', { a: a.name, d: w.union?.firedUntil?.[a.agentId] ?? '?' }), since: stamp(w), until: w.union?.firedUntil?.[a.agentId] ?? null }); } } },
        '✊ {u}在{s}發動罷工，{n} 個會員不上工，要{o}加薪。': (st, w, e) => { const k = secByName(e.p.s); if (!k) return; const T = wage(st, w, k, true); setStage(T, 'strike'); settle(T, 'await_boss'); add(T, w, { kind: 'strike', text: e.text, names: [e.p.o], src: e.src });
            const s = w.union?.strike?.[k]; if (s) { for (const id of s.members) { const a = w.agents[id]; if (a) person(T, a, id === w.union.leader ? 'leader' : 'member').acted.push({ d: day(w), code: 'listed', text: render('被列進罷工名單', {}), src: { type: 'state', path: 'union.strike.members' } }); }
                commit(T, w, 'strike_end', render('罷工最多撐到第 {d} 天；基金發不出補貼就提前結束', { d: s.until }), { until: s.until }); } },
        '🚶 {a}沒有跟著罷工，照常去{s}上工，也退出了工會。': (st, w, e) => { const k = secByName(e.p.s); const T = k && st.wage[k]; if (!T) return; add(T, w, { kind: 'exit', text: e.text, names: [e.p.a], src: e.src }); const a = byName(w, e.p.a, T); if (a) person(T, a, 'member').result.push({ d: day(w), code: 'crossed', text: render('照常上工，退出工會', {}), src: e.src }); },
        '🎉 {o}撐不住讓步了！{s}罷工 {n} 天後，工資調到原本的 {p}%。': (st, w, e) => { const k = secByName(e.p.s); const T = k && st.wage[k]; if (!T) return; add(T, w, { kind: 'outcome', text: e.text, names: [e.p.o], src: e.src }); close(T, w, 'strike_won', e.text); },
        '🥀 {s}的罷工撐不下去了，工人們回去上工，什麼也沒爭取到。': (st, w, e) => { const k = secByName(e.p.s); const T = k && st.wage[k]; if (!T) return; add(T, w, { kind: 'outcome', text: e.text, src: e.src }); close(T, w, 'strike_lost', e.text); },
        // 打架：只有這一句日誌和受傷紀錄，沒有現場、沒有守衛
        '👊 {a}跟{b}打起來了，{l}的{p}受了傷。': (st, w, e) => { const T = thread(st, w, 'fight:' + (++st.fightN), { type: 'fight', title: render('{a}跟{b}打架', { a: e.p.a, b: e.p.b }), stage: 'ended', place: { id: null, name: '', note: render('打架是每天結算時直接算出來的，沒有地點，也沒有守衛或旁人介入。', {}) } });
            add(T, w, { kind: 'conflict', text: e.text, names: [e.p.a, e.p.b], src: e.src }); for (const n of [e.p.a, e.p.b]) { const a = byName(w, n, T); if (a) person(T, a, n === e.p.l ? 'injured' : 'fighter'); }
            T.status = 'closed'; T.closed = stamp(w); T.outcome = { code: 'injury', text: e.text, at: stamp(w) }; T.injuredId = byName(w, e.p.l, T)?.agentId || null; T.injured = e.p.l; st.fights.push(T); if (st.fights.length > 30) st.fights.shift(); },
    };
    const lastUnion = (st) => { for (let i = st.threads.length - 1; i >= 0; i--) if (st.threads[i].type === 'union' && st.threads[i].stage !== 'considering') return st.threads[i]; return null; };
    // 開除、收買、拒絕的日誌只寫老闆的名字，沒寫是哪一行。對應時都要求「這一行的老闆就是日誌裡那個人」，一筆日誌只用掉一筆紀錄：
    //   1. 工會紀錄這一格新增的同類項目（帶行業）；
    //   2. 這一格決策核心記到的「老闆回覆工會」（帶行業、帶老闆的編號，答應的不算）；
    //   3. 都沒有：這個老闆今天被工會找過的行業。超過一個就都接，並標成「對應不確定」。
    const bossIds = (w, bossName) => new Set(named(w, bossName).map(a => a.agentId));
    function histSectors(st, w, kind, bossName) {
        const B = bossIds(w, bossName); const h = (st._hist || []).find(h => h.k === kind && h.s && !st._used.has(h) && B.has(ownerOf(w, h.s)));
        if (h) { st._used.add(h); st._amb = false; return [h.s]; } return talkSectors(st, w, bossName);
    }
    function talkSectors(st, w, bossName) {
        const B = bossIds(w, bossName);
        const x = (st._buf || []).find(x => x.ev === 'decided' && x.kind === 'demand' && x.ctx?.k && String(x.op?.id) !== 'yes' && !st._used.has(x) && B.has(x.a?.agentId));
        if (x) { st._used.add(x); st._amb = false; return [x.ctx.k]; }
        const d = day(w); const ks = Object.keys(w.union?.talks || {}).filter(k => w.union.talks[k] === d && B.has(ownerOf(w, k))); st._amb = ks.length > 1; return ks;
    }

    // ---------- 決策核心的通知 ----------
    const DEC_TEXT = { organize: '工資被壓，要不要帶頭', union: '鎮上有工會，要不要加入', unionout: '要不要退出工會', strike: '工會宣布罷工，跟不跟', demand: '工會來談加薪，怎麼回', rally: '有人號召抗議，去不去', thing: '看不慣鎮上的東西，要不要做點什麼' };
    function decisionEntry(w, x) {
        const own = x.src === 'ai' && x.why && typeof x.why === 'object' && x.why.raw != null;
        return { kind: 'answer', who: [x.a.agentId], text: x.a.name + render('：', {}) + say(x.op.say || x.op.text), why: say(x.why) || null,
            whySrc: !say(x.why) ? 'none' : own ? 'own' : 'option', res: say(x.res) || null, quiet: !!x.op.mute, src: { type: 'decision', kind: x.kind, id: String(x.op.id), mode: x.src } };
    }
    function onDecided(st, w, x) {
        const a = x.a; const k0 = x.kind; if (!DEC_TEXT[k0]) return; const e = decisionEntry(w, x); const ans = { d: day(w), q: render(DEC_TEXT[k0], {}), id: String(x.op.id), text: say(x.op.say || x.op.text), why: e.why, whySrc: e.whySrc, res: e.res, mode: x.src };
        if (k0 === 'organize' || k0 === 'union' || k0 === 'unionout') {
            const U = unionThread(st, w); person(U, a, k0 === 'organize' ? 'worker' : 'worker').answered.push(ans); add(U, w, Object.assign({ mk: k0 + '|' + a.agentId + '|' + x.op.id }, e));
            const k = sectorOf(w, a) || x._sec; const T = k && st.wage[k]; if (T && (T.status === 'open' || day(w) - (T.closed?.d ?? -99) <= FOLLOW_DAYS)) { person(T, a, 'worker').answered.push(ans); add(T, w, Object.assign({ mk: k0 + '|' + a.agentId + '|' + x.op.id, kind: T.status === 'open' ? 'answer' : 'follow' }, e, T.status === 'open' ? {} : { kind: 'follow' })); if (T.status === 'open' && T.stage === 'grievance' && (x.op.id === 'lead' || x.op.id === 'join')) setStage(T, 'organizing'); }
            return;
        }
        if (k0 === 'strike' || k0 === 'demand') { const k = x.ctx?.k; const T = k && st.wage[k]; if (!T) return; person(T, a, k0 === 'demand' ? 'boss' : 'member').answered.push(ans); add(T, w, e); if (k0 === 'demand') settle(T, 'await_boss'); return; }
        if (k0 === 'rally' || k0 === 'thing') { const tid = x.ctx?.tid; const T = tid && st.prot[tid]; if (!T || T.status !== 'open') { if (k0 === 'thing' && x.op.id === 'protest' && tid) st._lead[tid] = { a, ans, e }; return; } person(T, a, k0 === 'rally' ? (x.ctx.side === 'pro' ? 'supporter' : 'protester') : 'organizer').answered.push(ans); add(T, w, e); }
    }
    function onAsked(st, w, x) {
        const q = { d: day(w), text: render(DEC_TEXT[x.kind] || x.kind, {}), src: { type: 'decision', kind: x.kind, step: 'asked' } };
        if (x.kind === 'strike' || x.kind === 'demand') { const T = x.ctx?.k && st.wage[x.ctx.k]; if (T) person(T, x.a, x.kind === 'demand' ? 'boss' : 'member').asked.push(q); }
        else if (x.kind === 'rally') { const tid = x.ctx?.tid; (st._ask[tid] = st._ask[tid] || []).push({ a: x.a, q, side: x.ctx.side }); }
    }

    // ---------- 每格結束：把這一格的紀錄整理進事件，再讀狀態 ----------
    function flush(st, w) {
        const buf = st._buf;
        // 工會紀錄裡這一格新增的項目
        st._hist = []; st._used = new WeakSet(); const H = w.union?.history; if (Array.isArray(H)) for (const h of H) if (!st.seenHist.has(h)) { st.seenHist.add(h); st._hist.push(h); }
        things(st, w); // 先看有沒有新的號召，才接得到同一格的告示與回答
        for (const x of buf) {
            try {
                if (x.ev === 'log') { const f = LOGS[x.k]; const e = { p: x.p || {}, text: x.text, src: { type: 'log', cat: x.type, k: x.k } }; if (f) f(st, w, e); else looseLog(st, w, x, e); }
                else if (x.ev === 'decided') onDecided(st, w, x); else if (x.ev === 'asked') onAsked(st, w, x);
            } catch (err) { st.errors.push(String(err && err.message || err).slice(0, 160)); if (st.errors.length > 20) st.errors.shift(); }
        }
        st._buf = [];
        try { market(st, w); union(st, w); things(st, w); scenes(st, w); ceremonies(st, w); } catch (err) { st.errors.push(String(err && err.message || err).slice(0, 160)); }
    }
    // 沒有專門規則的日誌：只有明確提到某樣東西的名字（抗議事件）或受傷的人（打架後的醫療）才接上去
    function looseLog(st, w, x, e) {
        const tn = x.p && typeof x.p.t === 'string' ? x.p.t : (x.p?.t?.raw ?? null);
        const hits = tn ? Object.values(st.prot).filter(T => T.thingName === tn && (T.status === 'open' || day(w) - (T.closed?.d ?? -99) <= 3)) : [];
        for (const T of hits) { add(T, w, { uncertain: hits.length > 1 || undefined, kind: x.k.startsWith('📌') ? 'invite' : x.k.startsWith('📢') || x.k.startsWith('🙋') ? 'scene' : x.k.startsWith('🎁') || x.k.startsWith('🙅') ? 'outcome' : 'related', text: e.text, src: e.src }); if (x.k.startsWith('🎁') || x.k.startsWith('🙅')) T.ownerReply = e.text; }
        if (x.type === 'health' && x.p && typeof x.p.a === 'string') for (const T of st.fights) if (T.injuredId && day(w) - T.opened.d <= 7) { const c = named(w, x.p.a); if (!c.some(a => a.agentId === T.injuredId)) continue;
            add(T, w, { kind: 'follow', text: e.text, src: e.src, uncertain: c.length > 1 || undefined, note: render(c.length > 1 ? '鎮上有同名的人，這筆醫療紀錄只寫名字，不確定是不是同一個人。傷病紀錄也沒有寫原因。' : '同一個人之後的醫療紀錄。傷病紀錄沒有寫原因，無法確認是不是這次打架的傷。', {}) }); }
        if (x.k.startsWith('👮')) { const T = thread(st, w, 'guard:' + (++st.fightN), { type: 'guard', title: render('守衛出面', {}), stage: 'ended', place: { id: null, name: '', note: render('守衛抓人是直接結算的，地圖上沒有追捕或押送。', {}) } }); add(T, w, { kind: 'conflict', text: e.text, src: e.src }); T.status = 'closed'; T.closed = stamp(w); T.outcome = { code: 'guard', text: e.text, at: stamp(w) }; for (const v of Object.values(x.p || {})) { const a = typeof v === 'string' ? byName(w, v) : null; if (a) person(T, a, 'involved'); } }
    }
    // 工資：每一行的工資比例有變就記一筆（資源變化）
    function market(st, w) {
        const M = MK(); if (!M || !w.market) return;
        for (const k of Object.keys(M.SECTORS)) {
            const now = payOf(w, k), old = st.pay[k]; st.pay[k] = now; if (old == null || old === now) continue;
            const T = st.wage[k]; if (!T) continue; if (T.status !== 'open' && day(w) - (T.closed?.d ?? -99) > FOLLOW_DAYS) continue;
            const r = { d: day(w), time: w.clock?.timeStr || '', what: 'pay', text: render('{s}的工資比例：{a}% → {b}%', { s: secName(k), a: pct(old), b: pct(now) }), from: pct(old), to: pct(now), src: { type: 'state', path: 'market.pay.' + k } }; T.resources.push(r);
            if (T.status === 'open' && now >= 1 && (T.stage === 'grievance' || T.stage === 'organizing')) { add(T, w, { kind: 'outcome', text: r.text, src: r.src }); close(T, w, 'recovered', render('工資回到原本的水準；這段期間沒有記到談判或罷工', {})); }
        }
    }
    // 工會：會員進出、基金、罷工名單、開除期滿
    function union(st, w) {
        const U = w.union; if (!U || typeof U !== 'object') return; const d = day(w); const UT = U.on ? unionThread(st, w) : null;
        if (UT) {
            const now = new Set(Object.keys(U.members || {})); const old = st.members;
            if (old) { for (const id of now) if (!old.has(id)) { const a = w.agents[id]; if (a) person(UT, a, 'member').acted.push({ d, code: 'joined', text: render('成為會員', {}), src: { type: 'state', path: 'union.members' } }); }
                for (const id of old) if (!now.has(id)) { const a = w.agents[id]; const P = UT.people[id]; if (P) P.acted.push({ d, code: 'left', text: render('不再是會員', {}), src: { type: 'state', path: 'union.members' } }); else if (a) person(UT, a, 'member').acted.push({ d, code: 'left', text: render('不再是會員', {}), src: { type: 'state', path: 'union.members' } }); } }
            st.members = now; UT.facts = { members: now.size, fund: Math.round((U.fund || 0) * 100) / 100, leader: w.agents[U.leader]?.name || null, strikes: U.strikes || 0, won: U.won || 0, lost: U.lost || 0 };
        }
        if (d !== st.fundDay) { // 基金一天記一次
            const f = Math.round((U.fund || 0) * 100) / 100; if (st.fund != null && f !== st.fund) { const active = Object.keys(U.strike || {}); const r = { d, what: 'fund', text: render('工會基金：{a} → {b} 銀幣', { a: st.fund, b: f }), from: st.fund, to: f, src: { type: 'state', path: 'union.fund' } };
                if (UT) UT.resources.push(r); if (f < st.fund && st.strikeKs.length) for (const k of st.strikeKs) { const T = st.wage[k]; if (T) T.resources.push(Object.assign({}, r, st.strikeKs.length > 1 ? { note: render('同時有 {n} 場罷工共用基金，這筆沒辦法分開算', { n: st.strikeKs.length }) } : { note: render('罷工補貼：每人每天 {n} 銀幣', { n: UN()?.STRIKE_PAY ?? 2 }) })); } }
            st.fund = f; st.fundDay = d; st.strikeKs = Object.keys(U.strike || {});
            // 罷工名單：每天讀一次，記成「第幾天到第幾天在名單上」
            for (const [k, s] of Object.entries(U.strike || {})) { const T = st.wage[k]; if (!T) continue; for (const id of s.members) { const a = w.agents[id]; if (!a || !U.members[id]) continue; const P = person(T, a, id === U.leader ? 'leader' : 'member'); const last = P.acted.find(x => x.code === 'striking' && x.to === d - 1); if (last) last.to = d; else if (!P.acted.some(x => x.code === 'striking' && x.to === d)) P.acted.push({ d, code: 'striking', from: d, to: d, text: render('名字在罷工名單上', {}), note: render('名單一天讀一次。這一筆只代表名字在工會的罷工名單上；人當天實際在哪裡、有沒有去上工，這裡沒有讀。', {}), src: { type: 'state', path: 'union.strike.' + k + '.members' } }); } }
        }
        for (const T of st.threads) if (T.type === 'wage') T.open = T.open.filter(o => !(o.until != null && o.code.startsWith('fired:') && o.until < d));
    }
    // 抗議：號召（T.call）→ 隔天集合（T.protest）；到場以 _thingGo 為準
    function things(st, w) {
        const X = w.things; if (!X || !X.list) return; const d = day(w);
        for (const T0 of Object.values(X.list)) {
            const seen = st.thing[T0.id] || (st.thing[T0.id] = { callD: null, who: new Set(), fans: new Set() });
            const name = (() => { try { return typeof T0.name === 'string' ? render(T0.name, {}) : Array.isArray(T0.name) ? (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en' ? T0.name[1] : T0.name[0]) : String(T0.name?.raw ?? T0.name ?? T0.id); } catch (e) { return String(T0.id); } })();
            if (T0.call && seen.callD !== T0.call.d) { // 新的號召
                seen.callD = T0.call.d; seen.who = new Set(); seen.fans = new Set(); const org = w.agents[T0.call.org];
                const T = thread(st, w, 'protest:' + T0.id + ':' + T0.call.d, { type: 'protest', thing: T0.id, thingName: name, title: render('號召抗議{t}', { t: name }), stage: 'calling',
                    place: { id: T0.place ? T0.place + '_front' : 'town_square', name: T0.place ? render('{t}門口', { t: name }) : render('廣場', {}), note: render('隔天集合時，答應的人會真的走到這裡，停留大約四個小時。', {}) } });
                st.prot[T0.id] = T; if (org) person(T, org, 'organizer'); const own = w.agents[T0.owner]; if (own) person(T, own, 'owner');
                const L = st._lead[T0.id]; if (L) { person(T, L.a, 'organizer').answered.push(L.ans); add(T, w, L.e); delete st._lead[T0.id]; }
                add(T, w, { kind: 'invite', text: render('{a}號召大家明天去抗議{t}。', { a: org?.name || '?', t: name }), who: org ? [org.agentId] : [], src: { type: 'state', path: 'things.' + T0.id + '.call' } });
                for (const q of (st._ask[T0.id] || [])) person(T, q.a, q.side === 'pro' ? 'supporter' : 'protester').asked.push(q.q); delete st._ask[T0.id];
                commit(T, w, 'gather', render('明天集合；能到的人不到三個就不成形', {}));
            }
            const T = st.prot[T0.id]; if (!T || T.status !== 'open') continue;
            for (const q of (st._ask[T0.id] || [])) person(T, q.a, q.side === 'pro' ? 'supporter' : 'protester').asked.push(q.q); delete st._ask[T0.id];
            if (T0.call) { // 名單上多了誰
                for (const [list, set, role] of [[T0.call.who, seen.who, 'protester'], [T0.call.fans, seen.fans, 'supporter']]) for (const id of (list || [])) if (!set.has(id)) { set.add(id); const a = w.agents[id]; if (a) person(T, a, id === T0.call.org ? 'organizer' : role).acted.push({ d, code: 'promised', text: render(role === 'supporter' ? '名字在明天聲援的名單上' : '名字在明天抗議的名單上', {}), src: { type: 'state', path: 'things.' + T0.id + '.call.' + (role === 'supporter' ? 'fans' : 'who') } }); }
            } else if (T.stage === 'calling') { // 號召被用掉了：成形或沒成形
                settle(T, 'gather'); const formed = T0.protest && T0.protest.day === d;
                const going = new Set(Object.values(w.agents || {}).filter(a => a._thingGo && a._thingGo.id === T0.id && a._thingGo.why === 'protest').map(a => a.agentId));
                for (const id of [...seen.who, ...seen.fans]) { const a = w.agents[id]; const P = T.people[id]; if (!P) continue;
                    if (going.has(id)) P.acted.push({ d, code: 'sent', text: render('今天被排去現場', {}), src: { type: 'state', path: 'agent._thingGo' } });
                    else P.acted.push({ d, code: 'absent', text: !a || a.isDead ? render('沒有被排去現場（人已經不在了）', {}) : !inTown(w, a) ? render('沒有被排去現場（當天不在鎮上）', {}) : formed && seen.fans.has(id) ? render('沒有被排去現場（程式的條件：聲援的人不夠三個，或好感已經降到門檻以下；是哪一個這裡分不出來）', {}) : render('沒有被排去現場（原因沒有紀錄）', {}), src: { type: 'state', path: 'agent._thingGo', value: null } }); }
                if (formed) { setStage(T, 'gathering'); T.formed = { n: T0.protest.n, counter: T0.protest.counter || 0, lead: w.agents[T0.protest.lead]?.name || null }; for (const id of going) if (!T.people[id]) { const a = w.agents[id]; if (a) person(T, a, 'unlisted').acted.push({ d, code: 'sent', text: render('今天被排去現場（不在前一天的名單上）', {}), src: { type: 'state', path: 'agent._thingGo' } }); }
                    T.scene = { place: T.place.id, from: w.tickCount, frames: [], who: [...going], sides: Object.fromEntries([...going].map(id => [id, seen.fans.has(id) ? 'pro' : seen.who.has(id) ? 'con' : 'unknown'])) }; }
                else { add(T, w, { kind: 'outcome', text: render('集合沒有成形：當天能到的人不到三個。', {}), src: { type: 'state', path: 'things.' + T0.id + '.protest', value: null } }); close(T, w, 'fizzled', render('沒有成形，當天沒有集合', {})); }
            }
        }
    }
    // 現場：每一格讀一次被排去現場的人在哪裡；有變化才留一格。on(a)＝這個人現在是不是還被排在這個現場
    function sceneStep(T, w, on) {
        const S = T.scene; const pos = {}; let any = false;
        for (const id of S.who) { const a = w.agents[id]; if (!a) continue; const o = !!on(a); if (o) any = true; pos[id] = { loc: a.currentLocation || null, st: !o ? 'left' : a.currentLocation === S.place ? 'present' : a.targetLocation === S.place || a._thingAt === S.place ? 'heading' : 'waiting' }; }
        const sig = JSON.stringify(pos); if (sig !== S._sig) { S._sig = sig; if (S.frames.length < CAP.frames) S.frames.push({ tick: w.tickCount, d: day(w), time: w.clock?.timeStr || '', pos }); else S.framesDropped = (S.framesDropped || 0) + 1; }
        for (const id of S.who) { const P = T.people[id]; const p = pos[id]; if (P && p && p.st === 'present' && !P.acted.some(x => x.code === 'present')) P.acted.push({ d: day(w), code: 'present', text: render('人在現場（{t}）', { t: w.clock?.timeStr || '' }), src: { type: 'state', path: 'agent.currentLocation', value: S.place } }); }
        return any;
    }
    function sceneEnd(T, w, src) {
        const S = T.scene; S.ended = true; S.until = w.tickCount; delete S._sig; add(T, w, { kind: 'scene', text: render('現場散了。', {}), src });
        for (const id of S.who.filter(id => !T.people[id]?.acted.some(x => x.code === 'present'))) T.people[id]?.acted.push({ d: day(w), code: 'never_seen', text: render('被排去現場，但沒有記到他站在那裡', {}), note: render('位置一格讀一次（遊戲裡的十五分鐘）；停留不到一格的人可能沒被讀到。', {}), src: { type: 'state', path: 'agent.currentLocation' } });
    }
    function scenes(st, w) {
        for (const T of Object.values(st.prot)) {
            const S = T.scene; if (!S || S.ended) continue;
            if (!sceneStep(T, w, a => { const g = a._thingGo; return g && g.id === T.thing && g.why === 'protest'; })) { sceneEnd(T, w, { type: 'state', path: 'agent._thingGo', value: null }); close(T, w, 'held', T.ownerReply || render('集合結束', {})); }
        }
    }
    // 典禮（婚禮、葬禮、追思會）：開始時遊戲把賓客的目的地設成會場（agent._ceremony），結束時解除。賓客名單是程式排的，沒有逐一問
    function ceremonies(st, w) {
        const C = w.ceremony; if (!C || !Array.isArray(C.list)) return;
        for (const c of C.list) {
            if (c.status === 'ongoing' && !st.cer[c.id]) {
                const wed = c.kind === 'wedding'; const g = (c.guests || []).slice();
                const locN = (() => { try { const l = w.townMap?.locations?.[c.loc]; return typeof l?.name === 'string' ? render(l.name, {}) : String(l?.name ?? c.loc); } catch (e) { return String(c.loc); } })();
                const T = thread(st, w, 'ceremony:' + c.id, { type: 'ceremony', cer: c.id, title: wed ? render('{a}和{b}的婚禮', { a: c.name, b: c.name2 }) : render(c.memorial ? '{a}的追思會' : '{a}的葬禮', { a: c.name }), stage: 'gathering',
                    place: { id: c.loc, name: locN, note: render('典禮開始時，遊戲把賓客的目的地設成會場，結束時解除。', {}) } });
                st.cer[c.id] = T;
                for (const id of g) { const a = w.agents[id]; if (a) person(T, a, wed && (id === c.a || id === c.b) ? 'couple' : id === c.host ? 'host' : 'guest').acted.push({ d: day(w), code: 'sent', text: render('被排去會場', {}), src: { type: 'state', path: 'ceremony.guests' } }); }
                add(T, w, { kind: 'scene', text: render('典禮開始，名單上有 {n} 人。', { n: g.length }), who: g, src: { type: 'state', path: 'ceremony.list.status', value: 'ongoing' }, note: render('名單是程式照好感與親屬排的，沒有逐一問每個人要不要來，所以這些人沒有「被問到」和「回答」。', {}) });
                T.scene = { place: c.loc, from: w.tickCount, frames: [], who: g, sides: {}, kind: 'ceremony' };
            }
            const T = st.cer[c.id]; if (!T || T.status !== 'open') continue;
            const any = sceneStep(T, w, a => a._ceremony && a._ceremony.id === c.id);
            if (c.status !== 'ongoing' || !any) { sceneEnd(T, w, { type: 'state', path: 'ceremony.list.status', value: c.status }); close(T, w, c.status === 'held' ? 'ceremony_held' : 'ceremony_off', render(c.status === 'held' ? '典禮辦完了' : '典禮沒有辦完', {})); }
        }
    }

    // ---------- 接上與匯出 ----------
    function attach(w) {
        if (!w || ST.get(w)) return ST.get(w) || null;
        const st = { on: true, n: 0, threads: [], idx: {}, wage: {}, wageN: {}, prot: {}, cer: {}, thing: {}, fights: [], fightN: 0, unionN: 0, pay: {}, members: null, fund: null, fundDay: null, strikeKs: [], seenHist: new WeakSet(), _used: new WeakSet(), evicted: 0, _buf: [], _hist: [], _ask: {}, _lead: {}, errors: [], started: stamp(w) };
        // 接上的當下已經存在的狀態當作起點，不當成新事件
        try { const M = MK(); if (M && w.market) for (const k of Object.keys(M.SECTORS)) st.pay[k] = payOf(w, k); if (Array.isArray(w.union?.history)) for (const h of w.union.history) st.seenHist.add(h); if (w.union?.on) { st.members = new Set(Object.keys(w.union.members || {})); st.fund = Math.round((w.union.fund || 0) * 100) / 100; } } catch (e) {}
        // 接上時工資已經被壓的行業：開一條事件，註明之前的經過沒有紀錄
        try { const M = MK(); if (M && w.market) for (const k of Object.keys(M.SECTORS)) if (st.pay[k] < 1 && ownerOf(w, k)) { const T = wage(st, w, k, true); add(T, w, { kind: 'cause', text: render('開始記錄時，{s}的工資已經是原本的 {p}%。在這之前的經過沒有紀錄。', { s: secName(k), p: pct(st.pay[k]) }), src: { type: 'state', path: 'market.pay.' + k } }); } } catch (e) {}
        try { for (const c of (w.ceremony?.list || [])) if (c.status === 'ongoing') st.cer[c.id] = { status: 'before' }; } catch (e) {} // 接上時已經開始的典禮不記（前半段沒有紀錄）
        ST.set(w, st); return st;
    }
    const detach = (w) => { ST.delete(w); };
    const get = (w) => ST.get(w) || null;
    function mapOf(w) { const out = []; try { for (const [id, l] of Object.entries(w.townMap?.locations || {})) out.push({ id, name: typeof l.name === 'string' ? render(l.name, {}) : String(l.name ?? id), x: l.x ?? null, y: l.y ?? null, cat: l.category || l.type || '' }); } catch (e) {} return out; }
    function exportData(w, meta) {
        const st = ST.get(w); if (!st) return null;
        const clean = (T) => { const o = JSON.parse(JSON.stringify(T, (k, v) => (k === 'mk' || k === '_sig' || k === 'last' || k === 'tn' ? undefined : v))); o.people = Object.values(o.people); return o; };
        return { format: FORMAT, source: 'REAL_GAME_RECORD', meta: Object.assign({ app: typeof RIMTOWN_APP_VERSION !== 'undefined' ? RIMTOWN_APP_VERSION : '?', town: w.townName ? render(w.townName, {}) : '', lang: typeof I18N !== 'undefined' && I18N.getLang ? I18N.getLang() : 'zh', from: st.started, to: stamp(w), ai: !!w.fullAgentMode, errors: st.errors.slice(), evicted: st.evicted || 0, caps: CAP }, meta || {}),
            map: mapOf(w), threads: st.threads.map(clean) };
    }

    // 掛上觀察點（只通知，不改回傳值、不改參數）
    if (typeof DECIDE !== 'undefined' && DECIDE.observe) DECIDE.observe((ev, o) => { const st = ST.get(o.w); if (!st) return; st._buf.push(ev === 'decided' ? { ev, a: o.a, kind: o.K.key, op: o.op, why: o.why, res: o.res, src: o.src, ctx: o.ctx } : { ev, a: o.a, kind: o.kind, ctx: o.ctx }); });
    if (typeof World !== 'undefined') {
        const WP = World.prototype; const _log = WP.logMessageT;
        WP.logMessageT = function (type, k, p, agentName, targetName) { const r = _log.apply(this, arguments); const st = ST.get(this); if (st) { let text = ''; try { text = render(k, p); } catch (e) {} st._buf.push({ ev: 'log', type, k, p, text, who: agentName || '' }); } return r; };
        const _tick = WP.tick;
        WP.tick = function () { const r = _tick.apply(this, arguments); const st = ST.get(this); if (st) { try { flush(st, this); } catch (e) { st.errors.push(String(e && e.message || e).slice(0, 160)); } } return r; };
    }
    return { attach, detach, get, export: exportData, LOG_KEYS: Object.keys(LOGS), FORMAT, CAP };
})();
if (typeof globalThis !== 'undefined') globalThis.WATCH = WATCH;
