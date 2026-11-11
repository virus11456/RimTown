// RimTown - sim-decide-pol.js：v9.21.0 決策核心階段 3（政治）
// 以前：誰帶頭組工會、誰加入、誰退出、老闆答不答應加薪、誰捐政治獻金、收不收、誰出來選，都是各系統擲骰決定的
//       （例如「每週 35% 機率組工會」「金主每週 35% 機率捐錢」「工會領袖 60% 機率出來選」）；立場只會被朋友和報紙慢慢帶著走。
// 現在：這些事由本人決定。各系統只說「他現在遇到什麼事、做得到哪幾件事」和「做了之後怎麼結算」：
//   工資被壓，大家都在抱怨(organize)   再忍忍／帶頭組工會
//   鎮上有工會(union)                 先不加入／加入
//   工會會員(unionout)                留著／退出                         ← 日子過得去了，或罷工輸了
//   工會宣布罷工(strike)              跟著罷工／照常上工（退出工會）       ← 工會發動罷工時才會遇到
//   工會來談加薪(demand)              答應／塞錢給領袖／開除帶頭的／不答應  ← 老闆；工會來談時才會遇到
//   手上寬裕，政治人物用得上(donate)   不捐／捐給掌權的人／捐給想法相近的人
//   有人送政治獻金來(gift)            收下／退回                         ← 金主開口時才會遇到
//   快選舉了(run)                     這次不選／出來選
//   日子變了(rethink)                 想法沒變／對某件事更支持或更反感     ← 依他自己的處境：手頭、工作、信仰、認識的人
// 結算全部在原本的系統裡（sim-union.js、sim-power.js、sim-town.js 的選舉、sim-mind.js 的立場），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數（個性、處境、交情），不是固定機率。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const ok = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const mem = (w, a, k, p, imp = 6, cat = 'social') => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', cat, k, p || {}, imp, []); } catch (e) {} };
    const log = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, p || {}, who || ''); } catch (e) {} };
    const honesty = (a) => { try { return typeof DARK !== 'undefined' ? DARK.honesty(a) : 2; } catch (e) { return 2; } };
    const U_ = () => (typeof UNION !== 'undefined' ? UNION : null);
    const P_ = () => (typeof POWER !== 'undefined' ? POWER : null);
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const MD = () => (typeof MIND !== 'undefined' ? MIND : null);
    const pct = (x) => Math.round(x * 100);
    DECIDE.pol = true; // 其他系統看到這個，就知道政治的事交給本人決定、不擲骰

    // ================= 工會 =================
    const bossOf = (w, a) => { const U = U_(), M = MK(); if (!U || !M || !w.market) return null; const k = U.sectorOf(w, a); return k ? w.agents[M.ownerOf(w, k)] || null : null; };
    const payLine = (w, a) => { const U = U_(), M = MK(); const k = U.sectorOf(w, a); const r = M.payRate(w, k); return r < 1 ? fill('你在{s}做工，工資被壓到原本的 {p}%。', { s: M.name(k), p: pct(r) }) : fill('你在{s}做工，工資照常發。', { s: M.name(k) }); };

    // ---------- 工資被壓，大家都在抱怨：要不要帶頭 ----------
    DECIDE.kind('organize', {
        title: '工資被壓，大家都在抱怨', cool: 7, pri: 2,
        when(w, a) { const U = U_(); if (!U || !w.market) return null; const n = U.canOrganize(w, a); return n ? { n } : null; },
        facts(w, a, ctx) { const b = bossOf(w, a); return fill('{pay}鎮上還有 {n} 個工人跟你一樣不滿，但沒有人出面。老闆是{o}。', { pay: { raw: payLine(w, a) }, n: Math.max(0, ctx.n - 1), o: b ? b.name : '' }); },
        options(w, a, ctx) {
            const U = U_(); if (!U || !U.canOrganize(w, a)) return []; const b = bossOf(w, a); const g = U.grievance(w, a);
            return [
                { id: 'wait', quiet: true, mute: true, text: '再忍一忍，不出這個頭', why: '出頭的人最先被盯上', base: 1.5 + (has(a, 'shy') ? 0.6 : 0) + clampN(aff(a, b) / 50, -1, 1) * 0.5, lean: { safe: 0.5 }, run: () => null },
                { id: 'lead', text: '帶頭組工會，大家一起跟老闆談', say: '帶頭組工會', why: '一個人說話沒人聽，大家一起才有籌碼', base: 0.3 + g * 1.2 + (has(a, 'charismatic') ? 0.9 : 0) + (has(a, 'abrasive') ? 0.4 : 0) - (has(a, 'shy') ? 0.8 : 0), lean: { bond: 0.5, face: 0.4, safe: -0.4 },
                    run: (w, a) => (U.start(w, a, []) ? { k: '工會成立了' } : null) },
            ];
        },
    });

    // ---------- 鎮上有工會：要不要加入 ----------
    DECIDE.kind('union', {
        title: '鎮上有工會', cool: 14, pri: 1,
        when(w, a) { const U = U_(); const X = w.union; if (!U || !X?.on || !w.market || X.members[a.agentId] || (a.age || 30) < 16 || !U.sectorOf(w, a)) return null; return ok(w, w.agents[X.leader]) || w.isAway?.(X.leader) ? { u: 1 } : null; },
        facts(w, a) { const X = w.union; const L = w.agents[X.leader]; const b = bossOf(w, a);
            return fill('{pay}{u}由{l}帶領，現在有 {n} 個會員，每週要繳一點會費；罷工時不上工，只領工會的補貼。老闆是{o}。{won}', { pay: { raw: payLine(w, a) }, u: X.name, l: L ? L.name : '', n: Object.keys(X.members).length, o: b ? b.name : '', won: X.won ? { k: '工會已經替大家爭取到 {n} 次加薪。', p: { n: X.won } } : { raw: '' } }); },
        options(w, a) {
            const U = U_(); const X = w.union; if (!U || !X?.on || X.members[a.agentId] || !U.sectorOf(w, a)) return []; const L = w.agents[X.leader], b = bossOf(w, a); const g = U.grievance(w, a);
            return [
                { id: 'no', quiet: true, mute: true, text: '先不加入', why: g > 0.2 ? '怕被老闆盯上' : '現在的日子還過得去', base: 1.6 + clampN(aff(a, b) / 50, -1, 1) * 0.6 + (has(a, 'greedy') ? 0.3 : 0), lean: { safe: 0.4, gain: 0.2 }, run: () => null },
                { id: 'join', text: { k: '加入{u}', p: { u: X.name } }, say: { k: '加入{u}', p: { u: X.name } }, why: '大家團結才有籌碼', base: 0.4 + g * 1.6 + clampN(aff(a, L) / 50, -1, 1) * 0.5 + Math.min(0.5, (X.won || 0) * 0.15), lean: { bond: 0.6 },
                    run: (w, a) => (U.join(w, a) ? { k: '成了會員' } : null) },
            ];
        },
    });

    // ---------- 工會會員：要不要退出 ----------
    DECIDE.kind('unionout', {
        title: '工會會員', cool: 21, pri: 0.8,
        when(w, a) {
            const U = U_(); const X = w.union; if (!U || !X?.on || !w.market || !X.members[a.agentId] || X.leader === a.agentId || U.idle(w, a)) return null; const k = U.sectorOf(w, a); if (!k) return null;
            if (X.sour?.[a.agentId] != null) return { why: 'lost' };
            return (MK().payRate(w, k) >= 1 && (a.mood ?? 50) > 60) ? { why: 'fine' } : null;
        },
        facts(w, a, ctx) { const X = w.union; return fill(ctx.why === 'lost' ? '{u}的罷工輸了，你白白少領了好幾天工資。會費還是每週要繳。' : '你是{u}的會員，每週繳會費。現在工資照常發，日子過得去。', { u: X.name }); },
        options(w, a, ctx) {
            const U = U_(); const X = w.union; if (!U || !X?.on || !X.members[a.agentId] || X.leader === a.agentId) return []; const L = w.agents[X.leader]; const lost = ctx.why === 'lost';
            return [
                { id: 'stay', quiet: true, mute: true, text: '留在工會', why: lost ? '輸一次不代表沒用' : '哪天工資又被壓，還是得靠大家', base: 1.6 + clampN(aff(a, L) / 50, -1, 1) * 0.5 + Math.min(0.5, (X.won || 0) * 0.15), lean: { bond: 0.5 },
                    run: (w, a) => { if (X.sour) delete X.sour[a.agentId]; return null; } },
                { id: 'quit', text: '退出工會', say: { k: '退出{u}', p: { u: X.name } }, why: lost ? '罷工根本沒用' : '會費省下來', base: (lost ? 1.3 : 0.8) + (has(a, 'greedy') ? 0.4 : 0) + (cash(w, a) < 8 ? 0.4 : 0) + (has(a, 'pessimist') && lost ? 0.4 : 0), lean: { gain: 0.4, safe: 0.2, bond: -0.4 },
                    run: (w, a) => (U.leave(w, a, lost ? 'lost' : 'fine') ? { k: '不再是會員' } : null) },
            ];
        },
    });

    // ---------- 工會宣布罷工（工會發動罷工時才會遇到） ----------
    DECIDE.kind('strike', {
        title: '工會宣布罷工', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) { const U = U_(), M = MK(); const X = w.union; const s = X?.strike?.[ctx.k]; const b = s && w.agents[s.boss]; if (!s || !b) return '';
            return fill('{u}在{s}發動罷工，要{o}把工資調到原本的 {p}%。罷工期間不上工，每天只領工會 {n} 銀幣的補貼。你身上有 {c} 銀幣。', { u: X.name, s: M.name(ctx.k), o: b.name, p: pct(s.want), n: U.STRIKE_PAY, c: Math.floor(cash(w, a)) }); },
        options(w, a, ctx) {
            const U = U_(); const X = w.union; const s = X?.strike?.[ctx.k]; if (!U || !s || !s.members.includes(a.agentId) || !X.members[a.agentId]) return []; const L = w.agents[X.leader], b = w.agents[s.boss]; const g = U.grievance(w, a), c = cash(w, a);
            return [
                { id: 'out', text: '跟大家一起罷工', say: '跟著罷工', why: '這時候不能散', base: 1.5 + g * 0.8 + clampN(aff(a, L) / 50, -1, 1) * 0.4, lean: { bond: 0.6, safe: -0.3 },
                    run: () => ({ k: '站在罷工的隊伍裡' }) },
                { id: 'work', text: '不跟，照常去上工（等於退出工會）', say: '沒有跟著罷工', why: c < 6 ? '家裡等著這份工資' : '跟老闆鬧翻沒有好處', base: 0.1 + (c < 6 ? 1.0 : 0) + clampN(aff(a, b) / 50, -1, 1) * 0.8 + (has(a, 'greedy') ? 0.3 : 0), lean: { safe: 0.5, gain: 0.3, bond: -0.5 },
                    run: (w, a) => (U.cross(w, a, ctx.k) ? { k: '被罵工賊' } : null) },
            ];
        },
    });

    // ---------- 工會來談加薪（老闆；工會來談時才會遇到） ----------
    DECIDE.kind('demand', {
        title: '工會來談加薪', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) { const U = U_(), M = MK(); const X = w.union; const T = U?.talkInfo(w, ctx.k); if (!T) return '';
            return fill('{u}的{l}帶著 {n} 個會員來談：{s}的工資現在是原本的 {r}%，他們要調到 {p}%（一週大約多付 {x} 銀幣）。這一週{s}{profit}。你身上有 {c} 銀幣；工會的罷工基金有 {f} 銀幣{can}。', {
                u: X.name, l: T.L.name, n: T.mem_.length, s: M.name(ctx.k), r: pct(T.rate), p: pct(T.want), x: Math.max(1, Math.round(T.bill * (T.want - T.rate))), profit: T.profit > 0 ? { k: '賺了 {n} 銀幣', p: { n: Math.round(T.profit) } } : { k: '虧了 {n} 銀幣', p: { n: Math.round(-T.profit) } },
                c: Math.floor(cash(w, a)), f: Math.round(X.fund), can: T.canStrike ? '，夠他們罷工' : '，還不夠罷工' }) + (T.corruptible ? fill('聽說{l}很看重錢，或者最近手頭很緊。', { l: T.L.name }) : ''); },
        options(w, a, ctx) {
            const U = U_(); const X = w.union; if (!U || X?.ask?.[ctx.k] == null) return []; const T = U.talkInfo(w, ctx.k); if (!T || T.boss !== a) { if (X.ask) delete X.ask[ctx.k]; return []; }
            const c = cash(w, a), h = honesty(a); const pay = T.profit > T.bill * 0.5 ? 0.6 : T.profit < 0 ? -0.6 : 0;
            const out = [
                { id: 'yes', text: { k: '答應把工資調到 {p}%', p: { p: pct(T.want) } }, say: '答應工會加薪', why: T.canStrike ? '真的罷工，虧得更多' : '他們說的也有道理', base: 0.5 + (T.kind ? 1.2 : 0) - (T.greedy ? 1.6 : 0) + pay + (c > T.bill * 2 ? 0.3 : 0) + (T.canStrike ? 0.5 : 0) + Math.min(0.4, (X.won || 0) * 0.1), lean: { bond: 0.5, gain: -0.5 },
                    run: (w) => (U.answer(w, ctx.k, 'yes') === 'deal' ? { k: '談成了' } : null) },
                { id: 'no', text: '不答應', say: '不答應工會加薪', why: T.profit < 0 ? '店都在虧，拿什麼加' : '工資多少由我決定', base: 1.0 + (T.greedy ? 0.8 : 0) - (T.kind ? 0.5 : 0) - pay * 0.5 - (T.canStrike ? 0.3 : 0), lean: { gain: 0.5, face: 0.2 },
                    run: (w) => { const r = U.answer(w, ctx.k, 'no'); return r === 'strike' ? { k: '工會發動罷工' } : r ? { k: '工會的錢不夠罷工，只能算了' } : null; } },
            ];
            if (c >= 60) out.push({ id: 'bribe', text: { k: '私下塞 30 銀幣給{l}，要他別再帶人來', p: { l: T.L.name } }, say: { k: '想私下拿錢擺平{l}', p: { l: T.L.name } }, why: '花小錢省大錢', base: -0.7 + (T.greedy ? 0.9 : 0) + (T.corruptible ? 0.9 : 0) + (2 - h) * 0.5 - (T.kind ? 0.8 : 0), lean: { gain: 0.5, face: -0.2 },
                run: (w) => { const r = U.answer(w, ctx.k, 'bribe'); return r === 'bribed' ? { k: '{l}收下了，這件事不了了之', p: { l: T.L.name } } : r === 'back_strike' ? { k: '{l}把錢退了回來，工會發動罷工', p: { l: T.L.name } } : r ? { k: '{l}把錢退了回來', p: { l: T.L.name } } : null; } });
            out.push({ id: 'fire', text: '開除帶頭要加薪的人', say: '開除帶頭要加薪的人', why: '殺雞儆猴', base: -0.3 + (T.greedy ? 0.8 : 0) + (has(a, 'abrasive') ? 1.2 : 0) - (T.kind ? 1.4 : 0) - (T.canStrike ? 0.2 : 0), lean: { face: 0.4, bond: -0.6 },
                run: (w) => { const r = U.answer(w, ctx.k, 'fire'); return r === 'strike' ? { k: '人開除了，工會發動罷工' } : r ? { k: '人開除了' } : null; } });
            return out;
        },
    });

    // ================= 政治獻金 =================
    const roleOf = (w, a) => { try { const E = w.election; if (E?.active && (E.candidates || []).some(c => c.agentId === a.agentId)) return t('候選人'); if (E?._officeHolder?.(w) === a) return typeof TIERS !== 'undefined' ? TIERS.leaderTitle(w) : t('鎮長'); return typeof TIERS !== 'undefined' ? TIERS.memberTitle(w) : t('議員'); } catch (e) { return ''; } };
    const pending = (w, kinds) => { try { return (w.proposals?.items || []).some(p => ['open', 'shelved'].includes(p.status) && kinds(p)); } catch (e) { return false; } };

    // ---------- 手上寬裕：要不要捐給政治人物 ----------
    DECIDE.kind('donate', {
        title: '手上寬裕，政治人物用得上', cool: 7, pri: 1,
        when(w, a) {
            const P = P_(); if (!P || !w.wallet || !P.canDonate(w, a)) return null; const T = P.targetsOf(w); const list = T.list.filter(x => x !== a && ok(w, x)); if (!list.length || T.list.includes(a)) return null;
            const M = MD(); const t1 = list[0]; let t2 = null, best = -9;
            for (const x of list.slice(1)) { const s = (M ? M.affinity(w, a, x) : 0) + aff(a, x) / 40; if (s > best) { best = s; t2 = x; } }
            return { t1: t1.agentId, t2: t2 && best > 0.2 ? t2.agentId : null, camp: T.campaign ? 1 : 0 };
        },
        facts(w, a, ctx) { const P = P_(); const t1 = w.agents[ctx.t1], t2 = ctx.t2 ? w.agents[ctx.t2] : null; if (!t1) return '';
            const worry = pending(w, P.HURTS) ? '鎮上正在討論會讓老闆多花錢的提案（最低工資、津貼、救濟或加稅）。' : '';
            return fill('你身上有 {c} 銀幣{own}。{camp}{p}是{r}{two}。捐了錢，以後說話比較有人聽；這種錢是私下給的，被報社挖出來會很難看。{worry}', { c: Math.floor(cash(w, a)), own: MK()?.ownedBy?.(w, a.agentId)?.length ? '，名下有產業' : { raw: '' }, camp: ctx.camp ? '現在是選舉期間。' : { raw: '' }, p: t1.name, r: { raw: roleOf(w, t1) }, two: t2 ? { k: '；{p}是{r}，想法跟你比較接近', p: { p: t2.name, r: { raw: roleOf(w, t2) } } } : { raw: '' }, worry }); },
        options(w, a, ctx) {
            const P = P_(); if (!P || !P.canDonate(w, a)) return []; const t1 = w.agents[ctx.t1], t2 = ctx.t2 ? w.agents[ctx.t2] : null; if (!ok(w, t1)) return []; const n = P.giftSize(w, a); const own = !!MK()?.ownedBy?.(w, a.agentId)?.length;
            const worry = pending(w, P.HURTS) && own ? 0.7 : 0; const M = MD();
            const out = [
                { id: 'skip', quiet: true, mute: true, text: '不捐', why: '錢留在自己手上比較實在', base: 1.7 + (honesty(a) - 2) * 0.2, lean: { safe: 0.3 }, run: () => null },
                { id: 'power', text: { k: '捐 {n} 銀幣給{p}', p: { n, p: t1.name } }, say: { k: '捐政治獻金給{p}', p: { p: t1.name } }, why: ctx.camp ? '押聲勢最好的人' : '以後有事好說話', base: 0.7 + (has(a, 'greedy') ? 0.6 : 0) + (own ? 0.3 : 0) + worry + clampN(aff(a, t1) / 50, -1, 1) * 0.3, lean: { gain: 0.5 },
                    run: (w, a) => (P.offer(w, a, t1, n, !!ctx.camp) ? { k: '錢送過去了，等他回話' } : null) },
            ];
            if (ok(w, t2)) out.push({ id: 'like', text: { k: '捐 {n} 銀幣給想法相近的{p}', p: { n, p: t2.name } }, say: { k: '捐政治獻金給{p}', p: { p: t2.name } }, why: '他的主張跟我一樣', base: 0.1 + (M ? M.affinity(w, a, t2) : 0) * 0.35 + clampN(aff(a, t2) / 50, -1, 1) * 0.4, lean: { face: 0.3, bond: 0.3 },
                run: (w, a) => (P.offer(w, a, t2, n, !!ctx.camp) ? { k: '錢送過去了，等他回話' } : null) });
            return out;
        },
    });

    // ---------- 有人送政治獻金來（金主開口時才會遇到） ----------
    DECIDE.kind('gift', {
        title: '有人送政治獻金來', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) { const dn = w.agents[ctx.dn]; if (!dn) return ''; const P = P_();
            return fill('{d}私下拿了 {n} 銀幣來，說是政治獻金。{own}你已經收過的獻金人情一共 {o} 銀幣；收得越多，表決時越難不替金主著想。你身上有 {c} 銀幣。', { d: dn.name, n: ctx.n, own: MK()?.ownedBy?.(w, dn.agentId)?.length ? { k: '{d}名下有產業。', p: { d: dn.name } } : { raw: '' }, o: Math.round(P.owed(w, a)), c: Math.floor(cash(w, a)) }); },
        options(w, a, ctx) {
            const P = P_(); const dn = w.agents[ctx.dn]; if (!P || !ok(w, dn) || cash(w, dn) < ctx.n) return []; const h = honesty(a), kind = has(a, 'kind'), greedy = has(a, 'greedy');
            return [
                { id: 'take', text: { k: '收下{d}的 {n} 銀幣', p: { d: dn.name, n: ctx.n } }, say: { k: '收下{d}的政治獻金', p: { d: dn.name } }, why: ctx.camp ? '選舉處處要用錢' : '人家的心意', base: 1.5 + (greedy ? 1.2 : 0) - (kind && !greedy ? 0.9 : 0) - (h - 2) * 0.35 + (cash(w, a) < 20 ? 0.4 : 0) + clampN(aff(a, dn) / 50, -1, 1) * 0.2, lean: { gain: 0.6 },
                    run: (w, a) => (P.give(w, dn, a, ctx.n, !!ctx.camp) ? { k: '收下了，欠了一份人情' } : null) },
                { id: 'back', text: '退回去', say: { k: '退回{d}的政治獻金', p: { d: dn.name } }, why: '拿了就得聽他的', base: 0.1 + (kind ? 0.8 : 0) + (h - 2) * 0.35 + ((w.power?.scandal?.[a.agentId] || 0) > 0 ? 0.5 : 0), lean: { face: 0.4, safe: 0.3 },
                    run: (w, a) => { P.turnDown(w, dn, a, ctx.n); return { k: '沒有收' }; } },
            ];
        },
    });

    // ================= 選舉：要不要出來選 =================
    const RUN_DAYS = 4; // 夏季最後幾天問(秋季第 1 天開選)
    const runS = (w) => { const X = DECIDE.S(w); if (!X.run || typeof X.run !== 'object') X.run = {}; return X.run; };
    // 選前幾天說過要不要選的人：{ id: 1 要選 / -1 不選 }（超過十天的不算）
    DECIDE.runIntent = (w) => { const R = runS(w); const d = day(w); const out = {}; for (const [id, v] of Object.entries(R)) { if (d - v.d > 10) { delete R[id]; continue; } out[id] = v.y; } return out; };
    let _pool = { w: null, d: -1, ids: null, rank: null };
    function runPool(w) {
        const d = day(w); if (_pool.w === w && _pool.d === d) return _pool; const E = w.election; const out = { w, d, ids: new Set(), rank: {} };
        try {
            let el = E._residents(w).filter(a => E._canServe(w, a));
            try { if (typeof TIERS !== 'undefined' && TIERS.S(w).lv) { const q = el.filter(a => TIERS.qualified(w, a)); if (q.length >= 2) el = q; } } catch (e) {}
            const sorted = el.slice().sort((x, y) => E._runScore(w, y) - E._runScore(w, x)); sorted.forEach((a, i) => { out.rank[a.agentId] = i + 1; });
            for (const a of sorted.slice(0, 5)) out.ids.add(a.agentId);
            const holder = E._officeHolder?.(w); if (holder && out.rank[holder.agentId]) out.ids.add(holder.agentId);
            const M = MD(); if (M) for (const a of el) if (M.S(w).amb?.[a.agentId]?.key === 'leader') out.ids.add(a.agentId);
            const X = w.union; if (X?.on && Object.keys(X.members || {}).length >= 5 && out.rank[X.leader]) out.ids.add(X.leader);
        } catch (e) {}
        _pool = out; return out;
    }
    DECIDE.kind('run', {
        title: '快選舉了', cool: 20, pri: 2.5,
        when(w, a) {
            const E = w.election; if (!E || E.active || typeof E._runScore !== 'function' || !w.clock || w.clock.season !== '夏季' || w.clock.day <= (w.clock.DAYS_PER_SEASON || 15) - RUN_DAYS) return null;
            if (runS(w)[a.agentId] && day(w) - runS(w)[a.agentId].d <= 10) return null;
            const Pp = runPool(w); return Pp.ids.has(a.agentId) ? { r: Pp.rank[a.agentId] } : null;
        },
        facts(w, a, ctx) { const E = w.election; const holder = E._officeHolder?.(w); const title = typeof TIERS !== 'undefined' ? TIERS.leaderTitle(w) : t('鎮長'); const amb = MD()?.S(w).amb?.[a.agentId]?.key === 'leader';
            return fill('再過幾天就要選{title}了。{now}論口才和人望，你在鎮上排第 {r}。{amb}{u}', { title: { raw: title }, now: holder === a ? '現任就是你。' : holder ? { k: '現任是{m}。', p: { m: holder.name } } : '現在沒有人在位。', r: ctx.r, amb: amb ? '當上首長是你一直想做的事。' : { raw: '' }, u: w.union?.on && w.union.leader === a.agentId ? '你是工會領袖，會員都會支持你。' : { raw: '' } }); },
        options(w, a, ctx) {
            const E = w.election; if (!E || E.active) return []; const holder = E._officeHolder?.(w); const mine = holder === a; const title = typeof TIERS !== 'undefined' ? TIERS.leaderTitle(w) : t('鎮長'); const amb = MD()?.S(w).amb?.[a.agentId]?.key === 'leader';
            const ul = w.union?.on && w.union.leader === a.agentId && Object.keys(w.union.members || {}).length >= 5;
            const yes = 0.2 + (amb ? 1.6 : 0) + (has(a, 'charismatic') ? 0.7 : 0) - (has(a, 'shy') ? 1.0 : 0) + (mine ? 1.2 : 0) + (ctx.r <= 2 ? 0.6 : ctx.r <= 4 ? 0.2 : -0.3) + (ul ? 0.8 : 0) - ((a.mood ?? 50) < 35 ? 0.5 : 0);
            return [
                { id: 'no', quiet: !mine, mute: !mine, text: mine ? '做完這一任就好，不再選了' : '這次不選', say: mine ? '不再參選' : '這次不出來選', why: mine ? '該換人做做看了' : '把自己的日子過好就好', base: 1.5, lean: { safe: 0.4 },
                    run: (w, a) => { runS(w)[a.agentId] = { d: day(w), y: -1 }; if (mine) { mem(w, a, '我想過了，這次不再出來選。', {}, 7, 'election'); log(w, 'event', '📣 {a}表示這次不再參選{title}。', { a: a.name, title }, a.name); } return mine ? { k: '等著交棒' } : null; } },
                { id: 'yes', text: { k: '出來選{title}', p: { title: { raw: title } } }, say: { k: '決定出來選{title}', p: { title: { raw: title } } }, why: amb ? '這是我一直想做的事' : mine ? '還有事情沒做完' : '我覺得我能做得更好', base: yes, lean: { face: 0.6, safe: -0.3 },
                    run: (w, a) => { runS(w)[a.agentId] = { d: day(w), y: 1 }; mem(w, a, '我決定出來選{title}。', { title }, 8, 'election'); log(w, 'event', '📣 {a}表示會出來選{title}。', { a: a.name, title }, a.name); return { k: '等開選那天登記' }; } },
            ];
        },
    });

    // ================= 立場：日子變了，重新想想 =================
    const STEP = 0.6;
    // 議題的名稱(英文用小寫的說法:taxes、the king…)
    const issue = (k) => { const I = MD()?.ISSUES?.[k]; if (!I) return k; try { return (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? I[1] : t(I[0]); } catch (e) { return I[0]; } };
    // 他現在的處境，會把他往哪邊推：[議題, 方向, 理由, 力道]
    function pushes(w, a) {
        const M = MD(); const o = M?.opOf(w, a); if (!o) return []; const out = []; const c = cash(w, a); const mood = a.mood ?? 50; const Mk = MK();
        // 處境只會把人推到「跟這個理由相稱」的位置(理由越強推得越遠)，不會一路推到極端
        const add = (k, dir, why, s, p) => { const cap = 0.4 + s; const room = cap - dir * o[k]; if (room < 0.15) return; out.push({ k, dir, why, s, p: p || null, step: Math.min(STEP, room) }); };
        const hungry = (() => { try { return Mk && w.market ? Mk.isHungry(w, a) : 0; } catch (e) { return 0; } })();
        const own = (() => { try { return !!(Mk && w.market && Mk.ownedBy(w, a.agentId).length); } catch (e) { return false; } })();
        const jobless = !a.job || a.job.key === 'unemployed';
        if (hungry >= 2) add('tax', 1, '吃不飽的時候才知道，公庫有錢才幫得了人', 1.0);
        else if (c < 8) add('tax', -1, '手頭這麼緊，稅還是照收', 0.9);
        else if (c > 300 || (own && c > 150)) add('tax', -1, '賺得多，被抽走的也多', 0.6);
        const king = (() => { try { const C = w.crown; const k = C && C.king ? w.agents[C.king] : null; return k && !k.isDead ? k : null; } catch (e) { return null; } })();
        if (king && king !== a) {
            if (mood < 35 || hungry >= 2) add('king', -1, '日子這麼難過，國王也沒替我們做什麼', 0.8);
            else if (mood > 70 && c > 60) add('king', 1, '有國王在，日子安穩', 0.5);
        }
        if ((a._mourningTargets || []).length) add('faith', 1, '親近的人走了，只能求個心安', 0.9);
        else if (mood < 30) add('faith', 1, '日子太苦，總要有個寄託', 0.5);
        const techJob = ['researcher', 'engineer', 'mechanic', 'factory_worker'].includes(a.job?.key);
        const era = (() => { try { return typeof w.research?.currentEra === 'function' ? w.research.currentEra() : 1; } catch (e) { return 1; } })();
        if (jobless && era >= 2) add('tech', -1, '新東西越來越多，我卻沒有工作', 0.8);
        else if (techJob) add('tech', 1, '我就是靠新技術吃飯的', 0.6);
        if (String(a.agentId).startsWith('imm_')) add('out', 1, '我自己就是外地來的', 0.7);
        else {
            const fr = Object.values(a.relationships?.relationships || {}).find(r => (r.affinity || 0) >= 40 && String(r.targetId).startsWith('imm_') && ok(w, w.agents[r.targetId]));
            if (fr) add('out', 1, '認識了{b}，外地人也沒什麼不一樣', 0.5, { b: w.agents[fr.targetId].name });
            else if (jobless) add('out', -1, '外地人一來，工作更難找', 0.6);
        }
        return out.sort((x, y) => y.s - x.s);
    }
    const shiftText = (p) => ({ k: p.dir > 0 ? '對{i}比較支持了' : '對{i}比較反感了', p: { i: issue(p.k) } });
    DECIDE.kind('rethink', {
        title: '日子變了，重新想想', cool: 25, pri: 0.3,
        when(w, a) { if (!MD() || !w.mind || (a.age || 30) < 16) return null; const ps = pushes(w, a); return ps.length ? { ps: ps.slice(0, 2).map(p => [p.k, p.dir]) } : null; },
        facts(w, a) { const M = MD(); const s = M.stanceText(w, a); return fill('{s}最近的日子讓你重新想了一些事。', { s: s ? { raw: s + t('。') } : '你對鎮上的大事沒有特別強的看法。' }); },
        options(w, a, ctx) {
            const M = MD(); if (!M) return []; const all = pushes(w, a); const ps = (ctx.ps || []).map(([k, dir]) => all.find(p => p.k === k && p.dir === dir)).filter(Boolean); if (!ps.length) return [];
            const out = [{ id: 'keep', quiet: true, mute: true, text: '想法沒變', why: '想來想去還是原來的看法', base: 1.3 + (has(a, 'stoic') ? 0.4 : 0), lean: { safe: 0.2 }, run: () => null }];
            for (const p of ps) out.push({ id: p.k + (p.dir > 0 ? '+' : '-'), text: { k: '{x}：{why}', p: { x: shiftText(p), why: { k: p.why, p: p.p || {} } } }, say: shiftText(p), why: { k: p.why, p: p.p || {} }, base: 0.5 + p.s, lean: {},
                run: (w, a) => { M.shift(w, a, p.k, p.dir * (p.step || STEP)); mem(w, a, '我對{i}的想法變了：{why}', { i: issue(p.k), why: { k: p.why, p: p.p || {} } }, 6, 'reflection'); return { k: '想法不一樣了' }; } });
            return out;
        },
    });
    DECIDE.polPushes = pushes; // 測試用
})();
