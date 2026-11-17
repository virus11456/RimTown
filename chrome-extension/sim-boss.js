// RimTown - sim-boss.js：v11.6.0 東家每週自己看帳（把寫死的規則交給村民，第二階段）
// 以前私人產業的東家從來沒被問過，五條自動規則替他做主：
//   1. 每週調薪（sim-market.js adjust）：虧錢砍一成（最低五成）、貪心的每週壓 5%（最低六成）、心腸好又很賺才加 5%（最高 120%）
//   2. 兩家搶生意時每週調價（sim-compete.js weekly）：客人被搶走的降 5%（心腸好降 10%），最低七五折（貪心的九折）；搶贏的慢慢漲回原價
//   3. 工人被對面挖走就加薪（sim-compete.js weekly）
//   4. 每週裁員（sim-finance.js LABOR.weekly）：某一行的人比名額多兩成以上，最不擅長的被裁，一週最多 2 人
//   5. 名下超過兩家就自動請掌櫃（sim-compete.js manage）：挑社交最好的夥計
// 現在每位東家一週看一次帳，自己決定這週做哪一件事（選擇點 bossWeek，登記在 sim-decide-work.js）：
//   加薪／砍薪、降價／漲回、請某某走路、請某某當掌櫃或自己硬撐、叫這一行多做或少做一點（微調 FLOW.demandMult 的門檻），或這週照舊。
//   - 誰：七種產業的東家（MARKET.ownerOf）與對面那家的東家（rival.owner）。公營的沒有東家，照舊規則
//   - 什麼時候：一週一次，照產業順序錯開在一週的七天（對面那家晚三天）；名下好幾家的只問一次，問最有狀況的那一家
//   - 結算的數字、上下限、日誌與記憶都沿用原本規則的；錢只在人、店、公庫之間動（調薪、調價不搬錢，掌櫃的薪水照原本由 manage 付）
//   - 問過的事記在 boss.took[那一家] = { d, 哪幾件事攤在他面前 }：七天內原本的規則跳過那幾件。沒問到的（決策核心沒開、東家不在鎮上、
//     舊存檔、還沒輪到）照原本的規則跑，所以原本的函式都留著
// 必須在 sim-market.js、sim-compete.js、sim-finance.js、sim-flow.js 之後載入；問人用的是決策核心（sim-decide.js，晚一點載入，執行時才用到）
'use strict';

const BOSS = (() => {
    const WEEK = 7, CUT_MAX = 2;
    const ORDER = ['farm', 'kitchen', 'textile', 'timber', 'mine', 'forge', 'trade']; // 一週七天各問一行的東家（對面那家晚三天）
    const GOOD = { farm: ['food'], kitchen: ['meals'], textile: ['clothing'], timber: ['furniture'], mine: ['stone', 'metal'], forge: ['tools'] }; // 跟 FLOW.JOB_GOOD 對得上：這一行做的東西
    const R2S = {}; for (const [k, gs] of Object.entries(GOOD)) for (const r of gs) R2S[r] = k;
    const STOCK_F = { more: 1.15, less: 0.85 }; // 多做／少做：把「存量夠了就放慢」那條線的門檻挪一成五（堆到三倍的硬上限不動）
    const STOCK_NAME = { usual: '照平常的量做', more: '多做一點備貨', less: '少做一點' };
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const CP = () => (typeof COMPETE !== 'undefined' ? COMPETE : null);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) && !(w.civic?.jail?.[a.agentId] > day(w));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const r2 = (n) => Math.round(n * 100) / 100, pct = (x) => Math.round(x * 100);
    const cash = (w, a) => (a && typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const zh = (r) => (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[r]) || r;
    const jt = (k) => { try { return (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[k]?.title) || k; } catch (e) { return k; } };
    const social = (a) => { try { return a.skills?.get?.('社交')?.level || 0; } catch (e) { return 0; } };
    // v11.6.0 東家跟這個人的關係：家人（MONEY.familyOf，帳本裡「家人」那一行用的同一份），不然照交情分級（跟決策核心「跟這件事有關的往事」同一套字）
    const affOf = (a, x) => (a && x ? a.relationships?.relationships?.[x.agentId]?.affinity || 0 : 0);
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    function relOf(w, a, x) { if (famOf(w, a).includes(x) || famOf(w, x).includes(a)) return 'fam'; /* familyOf 只算伴侶和爸媽：反過來看一次，自己的孩子也算家人 */ const v = affOf(a, x); return v >= 60 ? 'close' : v >= 25 ? 'friend' : v <= -40 ? 'feud' : v <= -15 ? 'cold' : 'plain'; }
    const REL_WORD = { fam: '家人', close: '很要好', friend: '有交情', cold: '不太對盤', feud: '結過怨', plain: '交情普通' };
    const FIRE_REL = { fam: -2.0, close: -1.2, friend: -0.6, plain: 0, cold: 0.5, feud: 1.0 }; // 裁家人、好朋友下不了手；有過節的趁機請走
    const MGR_REL = { fam: 1.2, close: 1.0, friend: 0.4, plain: 0, cold: -0.6, feud: -1.2 }; // 用人唯親：自己人比較放心
    const asking = (w) => !!(w?.observerMode && w.market && typeof DECIDE !== 'undefined' && DECIDE.on(w) && DECIDE.KINDS?.bossWeek);

    function S(w) {
        const M = MK().S(w); if (!M.boss || typeof M.boss !== 'object') M.boss = {}; // 跟著 world.market 一起存檔；舊存檔沒有這一格，就是「還沒有人被問過」
        const B = M.boss; for (const k of ['took', 'last', 'stock', 'next']) if (!B[k] || typeof B[k] !== 'object') B[k] = {};
        if (B.self) delete B.self; // v11.6.0 早期的「自己硬撐」記在東家身上（以東家 id 為 key），改成一家一家算之後用不到，舊存檔帶進來的直接丟掉
        if (!B.cut || typeof B.cut !== 'object') B.cut = { wk: -1, n: 0 }; B.st = Object.assign({ asks: 0 }, B.st || {});
        return B;
    }
    const keyOf = (k, rival) => k + (rival ? ':R' : '');
    // 這一家這週的這件事，東家拿過主意了沒有（原本的規則看這個決定要不要跳過）。topic：pay 工資／price 價錢／cut 裁員
    function took(w, key, topic) {
        const B = w?.market?.boss; const x = B?.took?.[key]; if (!x || !x[topic]) return false; const d = day(w); if (!(d - x.d < WEEK && d >= x.d)) return false;
        const k = String(key).split(':')[0], rival = String(key).endsWith(':R'); const o = rival ? MK().rivalOf(w, k)?.owner : MK().ownerOf(w, k); return !!o && o === x.by; // 換了東家就不算
    }
    // 這一家這週被問過掌櫃的事、現在還沒有掌櫃（自己硬撐，或選了別的事還沒請）：manage 不替他自動請，客人少一些（MARKET.quality）。
    // 一家一家算：沒被問到的那幾家照原本自動請
    function selfRun(w, key) { if (!took(w, key, 'mgr')) return false; const m = w.agents?.[w.market?.mgr?.[key]]; return !(m && !m.isDead); }
    // 這一行的東家定的生產檔位 → FLOW.demandMult 的門檻倍率（換了東家、或公營就回到 1）
    function stockF(w, r) {
        const k = R2S[r]; if (!k) return 1; const x = w?.market?.boss?.stock?.[k]; if (!x || !STOCK_F[x.v]) return 1;
        try { return MK().ownerOf(w, k) === x.by ? STOCK_F[x.v] : 1; } catch (e) { return 1; }
    }
    const stanceOf = (w, k) => { const x = w?.market?.boss?.stock?.[k]; return x && STOCK_F[x.v] && MK().ownerOf(w, k) === x.by ? x.v : 'usual'; };
    // 這週已經裁了幾個人（東家裁的＋規則裁的，一週最多 2 人；週的算法跟 LABOR.weekly 一樣）
    function cutsThisWeek(w) { const B = S(w); const wk = Math.floor(day(w) / 7); return B.cut.wk === wk ? B.cut.n : 0; }
    function noteCut(w, n) { const B = S(w); const wk = Math.floor(day(w) / 7); if (B.cut.wk !== wk) B.cut = { wk, n: 0 }; B.cut.n += n || 1; }
    // 工人跳槽（COMPETE.hop 呼叫）：記下被挖走的是哪一家、哪一天，東家看帳時才說得出「這週被挖走幾個人」
    function noteHop(w, k, fromRival) { try { const R = w.market?.rival?.[k]; if (!R) return; const f = fromRival ? 'lostR' : 'lostI'; const d = day(w); R[f] = (R[f] || []).filter(x => d - x < WEEK); R[f].push(d); } catch (e) {} }
    const lostOf = (w, k, R, rival) => { const d = day(w); return ((R && R[rival ? 'lostR' : 'lostI']) || []).filter(x => d - x < WEEK).length; };

    // ================= 一家店的帳 =================
    function firm(w, k, rival) {
        const Mk = MK(); const M = Mk.S(w); const R = Mk.rivalOf(w, k); if (rival && !R) return null;
        const id = rival ? R.owner : Mk.ownerOf(w, k); if (!id) return null; const boss = w.agents[id] || null; const all = npcs(w);
        const h = (rival ? R.hist : M.hist[k]) || []; const rev = h.reduce((s, x) => s + x[0], 0), cost = h.reduce((s, x) => s + x[1], 0); const prof = rev * (1 - Mk.TAX) - cost;
        const ws = Mk.workersOf(w, k, all); const staff = ws.filter(a => a.agentId !== id && (rival ? !!R.emp?.[a.agentId] : !(R && R.emp?.[a.agentId])));
        const job = Mk.SECTORS[k].jobs[0]; let slots = 0, filled = 0; try { if (typeof LABOR !== 'undefined') { const here = all.filter(a => !w.isAway?.(a.agentId)); slots = LABOR.slots(w, here)[job] || 0; filled = LABOR.filled(here)[job] || 0; } } catch (e) {}
        const share = R ? (rival ? Mk.shareOf(w, k) : 1 - Mk.shareOf(w, k)) : 1;
        return { k, rival: !!rival, key: keyOf(k, rival), R, id, boss, days: h.length, rev: Math.round(rev), cost: Math.round(cost), prof: Math.round(prof), losing: rev * (1 - Mk.TAX) < cost, hi: rev * (1 - Mk.TAX) > cost * 1.6,
            pay: rival ? (R.pay ?? 1) : Mk.payRate(w, k), price: rival ? (R.price ?? 1) : (M.price?.[k] ?? 1), staff, job, slots, filled, share,
            other: R ? (rival ? { a: w.agents[M.owners[k]] || null, price: M.price?.[k] ?? 1, pay: Mk.payRate(w, k) } : { a: w.agents[R.owner] || null, price: R.price ?? 1, pay: R.pay ?? 1 }) : null,
            lost: R ? lostOf(w, k, R, rival) : 0, unpaid: M.unpaid?.[id] || 0 };
    }
    // 名下超過兩家時，哪幾家要請掌櫃（跟 manage 挑法一樣：自己顧最賺的兩家，已經有掌櫃的照舊交給掌櫃）；回傳還沒有掌櫃的那幾家
    function needMgr(w, id) {
        const Mk = MK(), C = CP(); if (!C) return []; const fs = Mk.firmsOf(w, id); if (fs.length <= 2) return []; const M = C.S(w);
        const rev = (f) => ((f.rival ? M.rival?.[f.k]?.hist : M.hist?.[f.k]) || []).reduce((s, [r]) => s + r, 0);
        const extra = fs.slice().sort((x, y) => (M.mgr[keyOf(x.k, x.rival)] ? 1 : 0) - (M.mgr[keyOf(y.k, y.rival)] ? 1 : 0) || rev(y) - rev(x)).slice(2);
        return extra.filter(f => { const m = w.agents[M.mgr[keyOf(f.k, f.rival)]]; const F = firm(w, f.k, f.rival); return F && !(m && !m.isDead && F.staff.includes(m)); });
    }
    // 這一行的人比名額多兩成以上（跟 LABOR.weekly 同一條線）：可以請誰走路（最不擅長、身體最不適合的先；工會領袖不行）
    function overstaffed(F) { return F.filled > F.slots + 1 && F.filled > F.slots * 1.2; }
    function firable(w, F) {
        if (F.rival || !overstaffed(F) || cutsThisWeek(w) >= CUT_MAX || typeof LABOR === 'undefined') return [];
        const fit = (a) => (typeof HEALTH !== 'undefined' ? HEALTH.jobFit(a, F.job) : 1); const sk = (a) => LABOR.skillOf(a, F.job) * fit(a);
        const isBoss = (a) => { try { return MK().ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
        const pool = F.staff.filter(a => !isBoss(a) && w.union?.leader !== a.agentId && !w.isAway?.(a.agentId)).sort((x, y) => sk(x) - sk(y)); const out = pool.slice(0, 2);
        // 最不擅長的兩位之外，夥計裡跟東家有過節的也在名單上（最多三位）：真的東家會想趁機把他請走
        for (const x of pool.slice(2).filter(x => ['cold', 'feud'].includes(relOf(w, F.boss, x))).sort((x, y) => affOf(F.boss, x) - affOf(F.boss, y))) if (out.length < 3) out.push(x);
        return out;
    }
    // 掌櫃人選：社交最好的兩位，加上夥計裡東家的家人或很要好、有交情的人（最多三位）
    function mgrPicks(w, F) { const top = F.staff.slice().sort((x, y) => social(y) - social(x)); const out = top.slice(0, 2); for (const x of top.slice(2).filter(x => ['fam', 'close', 'friend'].includes(relOf(w, F.boss, x))).sort((x, y) => (relOf(w, F.boss, y) === 'fam') - (relOf(w, F.boss, x) === 'fam') || affOf(F.boss, y) - affOf(F.boss, x))) if (out.length < 3) out.push(x); return out; }
    // 這一家這週「有狀況」的事（第一件做完之後要不要追問，看這個）
    function issues(w, F) {
        const out = []; const gs = F.rival ? [] : goods(w, F.k); const lo = gs.length ? Math.min(...gs.map(g => g.ratio)) : 1, hiS = gs.length ? Math.max(...gs.map(g => g.ratio)) : 1;
        if (F.lost || (!F.rival && F.days >= 5 && (F.losing || (F.hi && F.pay < 1.2 - 1e-9)))) out.push('pay');
        if (F.R && ((F.share < 0.45 && F.prof > -5) || (F.share > 0.65 && F.price < 1 - 1e-9))) out.push('price');
        if (firable(w, F).length) out.push('cut');
        if (F.boss && needMgr(w, F.id).some(f => keyOf(f.k, f.rival) === F.key)) out.push('mgr');
        if (gs.length && (lo < 0.5 || (hiS > 1.3 && F.k !== 'farm'))) out.push('stock');
        return out;
    }
    function goods(w, k) {
        if (typeof FLOW === 'undefined') return []; return (GOOD[k] || []).map(r => { const want = FLOW.want(w, r), have = w.stockpile?.get?.(r) || 0; return { r, want: Math.round(want), have: Math.round(have), ratio: want > 0 ? have / want : 1 }; });
    }
    // 一家店這週值得東家看的「狀況」有多大（名下好幾家時問最有狀況的那一家）
    const TOPIC = { cutpay: 'pay', raise: 'pay', down: 'price', down2: 'price', up: 'price', fire: 'cut', hire: 'mgr', self: 'mgr', more: 'stock', less: 'stock', normal: 'stock' };
    const topicOf = (id) => TOPIC[String(id).split(':')[0]] || null;
    function trouble(w, F, mgrKeys) { return (F.losing && F.days >= 5 ? 4 : 0) + (F.lost ? 3 : 0) + (F.R && F.share < 0.45 ? 2 : 0) + (F.unpaid ? 2 : 0) + (!F.rival && overstaffed(F) ? 1.5 : 0) + (mgrKeys.includes(F.key) ? 2 : 0) + Math.min(0.9, F.rev / 2000); }

    // ================= 誰、什麼時候 =================
    const bosses = (w) => { const M = MK().S(w); const ids = new Set([...Object.values(M.owners || {}), ...Object.values(M.rival || {}).map(R => R?.owner)].filter(Boolean)); return [...ids].map(id => w.agents[id]).filter(Boolean); };
    const firmsOf = (w, id) => MK().firmsOf(w, id).map(f => firm(w, f.k, f.rival)).filter(Boolean);
    // 一週裡哪一天問他：照他名下最前面那一行（對面那家晚三天）
    function slotOf(w, id) { let s = 9; for (const f of MK().firmsOf(w, id)) { const i = ORDER.indexOf(f.k); if (i >= 0) s = Math.min(s, (i + (f.rival ? 3 : 0)) % WEEK); } return s; }
    function focusOf(w, a) { const fs = firmsOf(w, a.agentId); if (!fs.length) return null; const mk = needMgr(w, a.agentId).map(f => keyOf(f.k, f.rival)); return fs.map(F => [F, trouble(w, F, mk)]).sort((x, y) => y[1] - x[1])[0][0]; }
    // 馬上問這一個人這一件事（跟 PROCURE 一樣：別的系統排著、還沒輪到的事先拿開，問完原樣放回去）
    function askNow(w, a, ctx) { const X = DECIDE.S(w); const keep = X.q.splice(0, X.q.length); try { DECIDE.enqueue(w, a, 'bossWeek', ctx); DECIDE.drain(w, X, day(w)); } finally { if (keep.length) X.q.unshift(...keep); } }
    // 每天（發薪、記完帳之後、任何一條每週規則之前，由 MARKET.daily 呼叫）：今天輪到的東家看帳
    function daily(w) {
        if (!asking(w)) return; const B = S(w), d = day(w); if (B.day === d) return; B.day = d;
        for (const id of Object.keys(B.last)) if (!w.agents[id] && !w.isAway?.(id)) delete B.last[id];
        // 前一天（開智能體時回話比較晚）想到還有一件事要處理的，先問（「隔天又想到一件事」）；took 的七天標記還在，每週規則不會搶先
        for (const id of Object.keys(B.next)) { const a = w.agents[id]; if (!a || !inTown(w, a)) { if (d - (B.next[id]?.at ?? d) > 2) delete B.next[id]; continue; } try { follow(w, a); } catch (e) { console.warn('[Boss] follow', e); delete B.next[id]; } }
        for (const a of bosses(w)) {
            if (!inTown(w, a) || (a.age ?? 30) < 16) continue; const last = B.last[a.agentId]; if (last != null && d - last < WEEK) continue; // 一週只問一次
            if (slotOf(w, a.agentId) !== d % WEEK && !(last != null && d - last >= WEEK + 3)) continue; // 還沒輪到他（換過店、錯過的，晚三天補問）
            try { ask(w, a); } catch (e) { console.warn('[Boss] ask', e); }
        }
    }
    function ask(w, a) {
        const B = S(w), d = day(w); const F = focusOf(w, a); if (!F) return null;
        const ctx = { k: F.k, rival: F.rival, d, by: a.agentId }; const opts = options(w, a, ctx); if (!opts.length) return null;
        mark(w, F.key, a, opts); B.last[a.agentId] = d; B.st.asks++; delete B.next[a.agentId];
        askNow(w, a, ctx);
        // 照個性決定的當場就有答案：第一件做完、還有別的事，現在就追問（askNow 已經回來了，不是在決策核心處理佇列的半路上，不會重入）。
        // 開智能體時要等回話，回話時記下的追問留到隔天 daily 一開始才問
        if (B.next[a.agentId]) follow(w, a);
        return ctx;
    }
    // 攤在東家面前的事記下來：七天內原本的每週規則不動這一家的這幾件事
    function mark(w, key, a, opts) { const ids = opts.map(o => topicOf(o.id)); const x = S(w).took[key] = Object.assign({ d: day(w), by: a.agentId }, S(w).took[key]?.by === a.agentId && day(w) - S(w).took[key].d < WEEK ? S(w).took[key] : {}); x.d = day(w); for (const tp of ['pay', 'price', 'cut', 'mgr']) if (ids.includes(tp)) x[tp] = 1; for (const tp of ['pay', 'price', 'cut', 'mgr']) x[tp] = x[tp] || 0; return x; }
    // 第一件事做完（run 裡只記下來，不在 run 裡面再問）：同一家還有別的狀況就追問那一家；沒有的話，名下另一家狀況夠大（trouble ≥ 3）就問那一家。一週最多兩次
    function planNext(w, a, ctx, id, res) {
        if (!ctx || ctx.second || topicOf(id) == null) return; const F = firm(w, ctx.k, ctx.rival); if (!F || F.id !== a.agentId) return; const tp = topicOf(id); const B = S(w);
        const rest = issues(w, F).filter(x => x !== tp);
        const op = res && typeof res === 'object' ? res : null; // 剛剛做的事的結果（「工資砍到行情的 90%」），追問時開頭講給他聽
        if (rest.length) { B.next[a.agentId] = { at: day(w), ctx: { k: F.k, rival: F.rival, by: a.agentId, second: 1, skip: [tp], first: op || null, d0: ctx.d } }; return; }
        const mk = needMgr(w, a.agentId).map(f => keyOf(f.k, f.rival)); const G = firmsOf(w, a.agentId).filter(x => x.key !== F.key).map(x => [x, trouble(w, x, mk)]).filter(x => x[1] >= 3).sort((x, y) => y[1] - x[1])[0];
        if (G) B.next[a.agentId] = { at: day(w), ctx: { k: G[0].k, rival: G[0].rival, by: a.agentId, second: 1, other: 1, skip: [], first: op || null, d0: ctx.d } };
    }
    // 原本的每週規則哪一天跑：工資（原本那家）第 0 天、價錢與被挖角加薪第 2 天、裁員每週第一天
    const RULE_DAY = { pay: (rival) => (rival ? 2 : 0), price: () => 2, cut: () => 0 };
    function follow(w, a) {
        const B = S(w), d = day(w); const N = B.next[a.agentId]; delete B.next[a.agentId]; if (!N || !N.ctx || d - (N.at ?? d) > 2 || d - (N.ctx.d0 ?? d) >= WEEK) return null;
        const ctx = Object.assign({}, N.ctx, { d }); const key = keyOf(ctx.k, ctx.rival);
        // 隔天才問的話：第一次沒攤在他面前、這中間原本的每週規則已經處理過的事，就不再列（不然一週做兩次）
        const ran = (tp) => { const f = RULE_DAY[tp]; if (!f || took(w, key, tp)) return false; for (let x = ctx.d0; x < d; x++) if (x % WEEK === f(ctx.rival)) return true; return false; };
        ctx.skip = [...new Set([...(ctx.skip || []), ...['pay', 'price', 'cut'].filter(ran)])]; const opts = options(w, a, ctx);
        if (!opts.some(o => o.id !== 'keep')) return null; mark(w, key, a, opts);
        B.st.asks++; B.st.second = (B.st.second || 0) + 1; askNow(w, a, ctx); return ctx;
    }

    // ================= 結算（數字、上下限、日誌都照原本的規則） =================
    function setPay(w, a, F, nv) {
        const Mk = MK(); const M = Mk.S(w); nv = r2(nv); const old = F.pay; if (nv === old) return null; const p = pct(nv);
        if (F.rival) F.R.pay = nv; else M.pay[F.k] = nv;
        if (nv < old) { log(w, '✂️ {o}的{s}把工資砍到原本的 {p}%。', { o: a.name, s: Mk.name(F.k), p }, a.name); for (const x of F.staff) if (Math.random() < 0.5) { mem(w, x, '{o}又把工資砍了，現在只剩原本的 {p}%。', { o: a.name, p }, 6); x.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(-4); } return { k: '工資砍到行情的 {p}%', p: { p } }; }
        log(w, '💰 {o}的{s}把工資調到原本的 {p}%。', { o: a.name, s: Mk.name(F.k), p }, a.name); for (const x of F.staff) if (Math.random() < 0.4) mem(w, x, '{o}給大家加薪了。', { o: a.name }, 4);
        try { CP().S(w).cst.raise++; } catch (e) {}
        return { k: '工資調到行情的 {p}%', p: { p } };
    }
    function setPrice(w, a, F, nv) {
        const Mk = MK(); const M = Mk.S(w); nv = r2(nv); if (nv === F.price) return null; const d = day(w); const R = F.R; const p = pct(nv);
        if (F.rival) { R.price = nv; } else { M.price = M.price || {}; M.price[F.k] = nv; }
        if (nv < F.price) { R[F.rival ? 'cutR' : 'cutI'] = d; log(w, '🏷️ {o}的{s}降價到原價的 {p}%，想把客人搶回來。', { o: a.name, s: Mk.name(F.k), p }, a.name);
            // 兩家這一週都降了價：就是價格戰（跟原本每週調價的那一句一樣，三週最多報一次）
            const od = R[F.rival ? 'cutI' : 'cutR']; if (od != null && d - od < WEEK && d - (R.warLog || -99) >= 21) { R.warLog = d; try { CP().S(w).cst.wars++; } catch (e) {} const bi = w.agents[M.owners[F.k]], rv = w.agents[R.owner]; const pi = M.price?.[F.k] ?? 1, pr = R.price ?? 1;
                log(w, '💥 {o}和{a}的{s}打起價格戰，一個降到 {p}%、一個降到 {q}%，村民樂得撿便宜。', { o: bi?.name || '', a: rv?.name || '', s: Mk.name(F.k), p: pct(pi), q: pct(pr) }, rv?.name || '');
                try { w.dailyNews?.collectEvent?.('economy', fill('{o}和{a}的{s}打起價格戰', { o: { raw: bi?.name || '' }, a: { raw: rv?.name || '' }, s: { raw: Mk.name(F.k) } }), 6, [bi?.name || '', rv?.name || '']); } catch (e) {} }
            return { k: '價錢降到原價的 {p}%', p: { p } }; }
        log(w, '🏷️ {o}的{s}把價錢調回原價的 {p}%。', { o: a.name, s: Mk.name(F.k), p }, a.name); return { k: '價錢調回原價的 {p}%', p: { p } };
    }
    function fire(w, a, F, x) {
        if (!x || x.isDead || !x.job || x.job.key !== F.job || cutsThisWeek(w) >= CUT_MAX || !F.staff.includes(x)) return { k: '沒裁成' };
        const L = typeof LABOR !== 'undefined' ? LABOR.S(w) : null; x.job = null; if (L) { L.jobless[x.agentId] = day(w); L.stats.laidOff++; } noteCut(w, 1);
        x.addThought?.('laid_off', w); mem(w, x, '{j}的人太多了，我被裁掉了，得重新找工作。', { j: t(jt(F.job)) }, 7); x.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(-6);
        log(w, '📉 {j}的人手過剩，{a}被裁員了。', { j: t(jt(F.job)), a: x.name }, x.name);
        return { k: '請{x}走路了', p: { x: x.name } };
    }
    function hire(w, a, F, m) {
        const C = CP(); if (!C || !m || m.isDead || !F.staff.includes(m)) return { k: '沒請成' }; const M = C.S(w);
        M.mgr[F.key] = m.agentId; M.cst.mgr++;
        log(w, '👔 {o}名下店太多顧不過來，請{m}當{s}的掌櫃。', { o: a.name, m: m.name, s: MK().name(F.k) }, a.name); mem(w, m, '{o}請我當{s}的掌櫃，多一份薪水。', { o: a.name, s: MK().name(F.k) }, 6);
        return { k: '請{m}當掌櫃', p: { m: m.name } };
    }
    function setStock(w, a, F, v) {
        const B = S(w); if (v === 'usual') delete B.stock[F.k]; else B.stock[F.k] = { v, by: a.agentId, d: day(w) };
        log(w, v === 'more' ? '📦 {o}交代{s}這陣子多做一點，倉裡多備些貨。' : v === 'less' ? '📦 {o}交代{s}這陣子少做一點，貨夠用就好。' : '📦 {o}交代{s}照平常的量做。', { o: a.name, s: MK().name(F.k) }, a.name);
        return { k: '{s}{x}', p: { s: { raw: MK().name(F.k) }, x: STOCK_NAME[v] } };
    }

    // ================= 選擇點 bossWeek：這週做哪一件事 =================
    const live = (w, a, ctx) => { if (!ctx || !a || !inTown(w, a) || day(w) - (ctx.d ?? 0) > 2) return null; const F = firm(w, ctx.k, ctx.rival); return F && F.id === a.agentId ? F : null; };
    function facts(w, a, ctx) {
        const F = live(w, a, ctx); if (!F) return ''; const Mk = MK(); const sName = Mk.name(F.k);
        const head = F.rival ? fill('你在{o}的店對面開的{s}', { o: F.other?.a?.name || '', s: sName }) : fill('你的{s}', { s: sName });
        const pl = F.prof >= 0 ? { k: '賺了 {n} 銀幣', p: { n: F.prof } } : { k: '賠了 {n} 銀幣', p: { n: -F.prof } };
        const book = F.days >= 3 ? fill('最近 {d} 天的帳：進帳 {rev} 銀幣，付出去的工資 {cost} 銀幣，扣掉營業稅{pl}。', { d: F.days, rev: F.rev, cost: F.cost, pl }) : t('剛開張，帳還看不出什麼。');
        const price = F.R || F.price < 1 ? fill('，價錢是原價的 {p}%', { p: pct(F.price) }) : '';
        const riv = F.R && F.other ? fill(F.rival ? '你搶到 {p}% 的客人；{o}那家的價錢是原價的 {q}%、工資開行情的 {r}%。' : '對面{o}的店搶走了 {p}% 的客人；他的價錢是原價的 {q}%、工資開行情的 {r}%。', { o: F.other.a?.name || '', p: F.rival ? pct(F.share) : pct(1 - F.share), q: pct(F.other.price), r: pct(F.other.pay) }) : '';
        const lost = F.lost ? fill('這週有 {n} 個夥計被對面挖走了。', { n: F.lost }) : '';
        const unpaid = F.unpaid ? fill('你已經連 {n} 天發不出全薪。', { n: F.unpaid }) : '';
        const gs = F.rival ? [] : goods(w, F.k); const st = gs.length ? fill('倉裡的{list}。這一行現在{x}。', { list: { raw: gs.map(g => fill('{g}存 {n}、鎮上該備 {m}（{s}）', { g: zh(g.r), n: g.have, m: g.want, s: g.ratio < 0.6 ? '不太夠' : g.ratio > 1.3 ? '堆太多了' : '差不多夠' })).join(t('；')) }, x: STOCK_NAME[stanceOf(w, F.k)] }) : '';
        const nm = needMgr(w, a.agentId).find(f => keyOf(f.k, f.rival) === F.key); const fee = r2(2 * (typeof WALLET !== 'undefined' && WALLET.wageIdx ? WALLET.wageIdx() : 1));
        const mgr = nm ? fill('你名下有 {n} 家店，{s}顧不過來，要請掌櫃（一天 {f} 銀幣）；不請的話那家的客人會少一些。', { n: Mk.firmsOf(w, a.agentId).length, s: sName, f: fee }) : '';
        const others = Mk.firmsOf(w, a.agentId).filter(f => keyOf(f.k, f.rival) !== F.key); const oth = others.length ? fill('你名下還有{list}，這週由夥計照老樣子打理。', { list: { raw: others.map(f => Mk.name(f.k)).join(t('、')) } }) : '';
        const cut = !F.rival && overstaffed(F) ? t('人比名額多了不少，這一行有人會被裁。') : '';
        // 罷工、工會：東家砍薪、裁人之前會顧慮的事（拿不到資料就不講）
        let lab = ''; try { const d = day(w); const M = Mk.S(w); if ((M.strike?.[F.k] ?? -1) >= d || (w.union?.on && w.union.strike?.[F.k])) lab += t('這一行的工人正在罷工。'); const ld = w.union?.on ? w.agents[w.union.leader] : null; if (ld && F.staff.includes(ld)) lab += fill('夥計裡的{x}是工會的頭頭。', { x: ld.name }); } catch (e) { lab = ''; }
        const pre = ctx.second ? (ctx.other ? fill('你剛剛決定了：{x}。你名下的{s}也有狀況，要一起處理嗎？', { x: ctx.first || t('這週照舊'), s: sName }) : fill('你剛剛決定了：{x}。還有別的事要一起處理嗎？', { x: ctx.first || t('這週照舊') })) : '';
        return pre + fill('又過了一週，該看看{h}的帳了。{book}工資開行情的 {pay}%{price}。你僱了 {n} 個夥計；鎮上{j}的名額 {sl} 位，現在有 {fl} 位在做。{cut}{riv}{lost}{unpaid}{st}{mgr}{oth}你自己身上有 {c} 銀幣。{lab}',
            { lab: { raw: lab }, h: { raw: head }, book: { raw: book }, pay: pct(F.pay), price: { raw: price }, n: F.staff.length, j: t(jt(F.job)), sl: F.slots, fl: F.filled, cut: { raw: cut }, riv: { raw: riv }, lost: { raw: lost }, unpaid: { raw: unpaid }, st: { raw: st }, mgr: { raw: mgr }, oth: { raw: oth }, c: Math.floor(cash(w, a)) });
    }
    // 傾向分數照原本的規則調：原本「會動」的情況，照個性算出來多半也會動；原本不動的，多半照舊（當天的心情起伏是 ±0.9）
    function options(w, a, ctx) {
        const F = live(w, a, ctx); if (!F) return []; const Mk = MK(); const sName = Mk.name(F.k); const out = [];
        const greedy = has(a, 'greedy'), kind = has(a, 'kind'), gen = has(a, 'generous'), soft = kind || gen;
        const go = (fn, id) => (w2, a2) => { const F2 = live(w2, a2, ctx); if (!F2) return null; const r = fn(w2, a2, F2); try { planNext(w2, a2, ctx, id, r); } catch (e) {} return r; }; // 做完記下要不要追問（只記，不在這裡問）
        const skip = new Set(ctx.skip || []); const push = (o) => { if (!skip.has(topicOf(o.id))) out.push(o); };
        // 工資：原本那家才調（對面那家的工資只在被挖走人時加，跟原本一樣）；帳要有五天以上
        if (!F.rival && F.days >= 5) {
            const amt = F.losing ? 0.1 : 0.05, floor = F.losing ? 0.5 : 0.6;
            if (F.pay > floor + 1e-9) { const nv = Math.max(floor, F.pay - amt);
                push({ id: 'cutpay', text: { k: '把工資砍到行情的 {p}%', p: { p: pct(nv) } }, say: { k: '把{s}的工資砍到 {p}%', p: { s: { raw: sName }, p: pct(nv) } }, why: F.losing ? '店在賠錢，工資得先省下來。' : '能少付一點是一點。',
                    // 賺錢時只有貪心的會壓（原本的規則就是這樣）；看重錢、節儉的只在虧錢時更快下手（新舊對照量過：賺錢時也讓他們壓，全鎮的工資平均會比以前低一點）
                    base: F.losing ? 2.4 + (greedy ? 0.4 : 0) + (hasV(a, '財富') ? 0.4 : 0) + (has(a, 'thrifty') ? 0.3 : 0) - (kind ? 0.6 : 0) - (gen ? 0.6 : 0) : -0.9 + (greedy ? 2.3 : 0) - (kind ? 0.6 : 0) - (gen ? 0.6 : 0), lean: { gain: 0.4, bond: -0.2 }, run: go((w2, a2, F2) => setPay(w2, a2, F2, Math.max(floor, F2.pay - amt)), 'cutpay') }); }
        }
        if (F.pay < 1.2 - 1e-9 && (!F.losing || F.lost) && (!F.rival ? F.days >= 5 || F.lost : F.lost)) { const nv = Math.min(1.2, F.pay + 0.05); const keepers = F.lost && F.prof > 0 && !greedy;
            push({ id: 'raise', text: F.lost ? { k: '加薪留人：工資調到行情的 {p}%（這週被挖走 {n} 個）', p: { p: pct(nv), n: F.lost } } : { k: '給夥計加薪：工資調到行情的 {p}%', p: { p: pct(nv) } }, say: { k: '給{s}的夥計加薪到 {p}%', p: { s: { raw: sName }, p: pct(nv) } }, why: F.lost ? '人再被挖走，店就開不下去了。' : '店有賺，大家辛苦了。',
                base: -0.6 + (F.hi && soft ? 2.2 : 0) + (keepers ? 2.4 : 0) + (kind ? 0.3 : 0) + (gen ? 0.3 : 0) - (greedy ? 1.0 : 0) - (F.prof < 0 ? 1.0 : 0), lean: { bond: 0.4, gain: -0.2 }, run: go((w2, a2, F2) => setPay(w2, a2, F2, Math.min(1.2, F2.pay + 0.05)), 'raise') }); }
        // 價錢：有對手才有得調。客人被搶走（自己不到四成五）又還撐得住才降；搶贏（六成五以上）才漲回。貪心的不降到九折以下
        if (F.R) {
            const pf = greedy ? 0.9 : 0.75, lose = F.share < 0.45 && F.prof > -5, win = F.share > 0.65;
            if (F.price > pf + 1e-9) { const n1 = Math.max(pf, F.price - 0.05);
                push({ id: 'down', text: { k: '降價到原價的 {p}%，把客人搶回來', p: { p: pct(n1) } }, say: { k: '把{s}降價到 {p}%', p: { s: { raw: sName }, p: pct(n1) } }, why: '客人都跑到對面去了。', base: (lose ? 2.4 : -0.3) - (greedy ? 0.4 : 0), lean: { gain: 0.2 }, run: go((w2, a2, F2) => setPrice(w2, a2, F2, Math.max(pf, F2.price - 0.05)), 'down') });
                if (F.price - 0.05 > pf + 1e-9) { const n2 = Math.max(pf, F.price - 0.1);
                    push({ id: 'down2', text: { k: '大降價到原價的 {p}%', p: { p: pct(n2) } }, say: { k: '把{s}大降價到 {p}%', p: { s: { raw: sName }, p: pct(n2) } }, why: '便宜一點，大家都買得起，客人自然會回來。', base: (lose ? 1.0 : -0.8) + (soft ? 1.8 : 0) - (greedy ? 0.6 : 0), lean: { bond: 0.3 }, run: go((w2, a2, F2) => setPrice(w2, a2, F2, Math.max(pf, F2.price - 0.1)), 'down2') }); } }
            if (F.price < 1 - 1e-9) { const n3 = Math.min(1, F.price + 0.05);
                push({ id: 'up', text: { k: '把價錢調回原價的 {p}%', p: { p: pct(n3) } }, say: { k: '把{s}的價錢調回 {p}%', p: { s: { raw: sName }, p: pct(n3) } }, why: '客人回來了，不用再賠本賣。', base: (win ? 2.4 : -0.4) + (greedy ? 0.4 : 0), lean: { gain: 0.3 }, run: go((w2, a2, F2) => setPrice(w2, a2, F2, Math.min(1, F2.price + 0.05)), 'up') }); }
        }
        // 裁員：這一行的人比名額多兩成以上，由這一行的東家決定請誰走（最不擅長的排前面）、或不裁
        // 交情也算進來：家人、好朋友下不了手，有過節的趁機請走（文字註明關係，AI 也看得到）
        firable(w, F).forEach((x, i) => { const rl = relOf(w, a, x); push({ id: 'fire:' + x.agentId, text: { k: '請{x}走路（{j}的人太多了；{x}：{r}）', p: { x: x.name, j: t(jt(F.job)), r: REL_WORD[rl] } }, say: { k: '請{x}走路', p: { x: x.name } }, why: rl === 'feud' || rl === 'cold' ? { k: '人手太多，{x}又跟我處不來。', p: { x: x.name } } : '人手太多，養不起這麼多人。',
            base: (i === 0 ? 2.4 : i === 1 ? 1.2 : 0.8) + (greedy ? 0.3 : 0) - (kind ? 0.7 : 0) - (gen ? 0.4 : 0) + FIRE_REL[rl], lean: { gain: 0.3, bond: -0.3 }, run: go((w2, a2, F2) => fire(w2, a2, F2, w2.agents[x.agentId]), 'fire') }); });
        // 掌櫃：名下超過兩家、這一家還沒有掌櫃
        if (needMgr(w, a.agentId).some(f => keyOf(f.k, f.rival) === F.key)) {
            mgrPicks(w, F).forEach((m, i) => { const rl = relOf(w, a, m); push({ id: 'hire:' + m.agentId, text: { k: '請{m}當{s}的掌櫃（{m}：{r}）', p: { m: m.name, s: sName, r: REL_WORD[rl] } }, say: { k: '請{m}當{s}的掌櫃', p: { m: m.name, s: sName } }, why: rl === 'fam' || rl === 'close' || rl === 'friend' ? { k: '{m}是自己人，交給他放心。', p: { m: m.name } } : '一個人顧不了這麼多家店。',
                base: (i === 0 ? 2.4 : i === 1 ? 1.4 : 1.0) + MGR_REL[rl], lean: { bond: 0.2 }, run: go((w2, a2, F2) => hire(w2, a2, F2, w2.agents[m.agentId]), 'hire') }); });
            push({ id: 'self', text: { k: '不請掌櫃，{s}自己硬撐', p: { s: sName } }, say: { k: '{s}不請掌櫃，自己顧', p: { s: sName } }, why: '掌櫃的薪水省下來，帳也不會被人動手腳。', base: 0.4 + (has(a, 'thrifty') ? 0.6 : 0) + (greedy ? 0.5 : 0), lean: { safe: 0.2, gain: 0.2 },
                run: go((w2, a2, F2) => { log(w2, '👔 {o}名下店太多，還是決定自己顧{s}，不請掌櫃。', { o: a2.name, s: MK().name(F2.k) }, a2.name); return { k: '{s}自己顧', p: { s: { raw: MK().name(F2.k) } } }; }, 'self') });
        }
        // 生產的檔位：只有原本那家的東家定（整行一起），幅度小
        const gs = F.rival ? [] : goods(w, F.k);
        if (gs.length) { const cur = stanceOf(w, F.k), lo = Math.min(...gs.map(g => g.ratio)), hiS = Math.max(...gs.map(g => g.ratio));
            if (cur !== 'more' && hiS < 1.3) push({ id: 'more', text: { k: '叫{s}多做一點，倉裡多備些貨', p: { s: sName } }, say: { k: '叫{s}多做一點', p: { s: sName } }, why: '貨多備一點，不怕斷貨。', base: -0.3 + (lo < 0.5 ? 0.8 : 0) + (has(a, 'hardworking') ? 0.3 : 0) + (has(a, 'ambitious') ? 0.3 : 0) - (F.losing ? 0.5 : 0), lean: { gain: 0.3 }, run: go((w2, a2, F2) => setStock(w2, a2, F2, 'more'), 'more') });
            // 糧食不給「少做一點」：農莊少種一點，全鎮的人都會餓到（其他行少做頂多是貨慢一點補上）
            if (cur !== 'less' && lo > 0.6 && F.k !== 'farm') push({ id: 'less', text: { k: '叫{s}少做一點，貨夠用就好', p: { s: sName } }, say: { k: '叫{s}少做一點', p: { s: sName } }, why: '貨堆著也賣不掉，省點料。', base: -0.3 + (lo > 1.3 ? 1.0 : 0) + (F.losing ? 0.4 : 0) + (has(a, 'lazy') ? 0.3 : 0), lean: { safe: 0.2 }, run: go((w2, a2, F2) => setStock(w2, a2, F2, 'less'), 'less') });
            if (cur !== 'usual') push({ id: 'normal', text: { k: '叫{s}照平常的量做', p: { s: sName } }, say: { k: '叫{s}照平常的量做', p: { s: sName } }, why: '平常怎麼做就怎麼做。', base: 0.4 + ((cur === 'more' && lo > 1.1) || (cur === 'less' && lo < 0.7) ? 1.2 : 0), lean: { safe: 0.2 }, run: go((w2, a2, F2) => setStock(w2, a2, F2, 'usual'), 'normal') });
        }
        out.push({ id: 'keep', quiet: true, text: ctx.second ? '不用了，這週就這樣' : '這週照舊，什麼都不改', say: { k: '{s}這週照舊', p: { s: sName } }, why: '生意就是這樣，不用動。', base: 1.0, lean: { safe: 0.2 }, run: () => ({ k: '這週照舊' }) });
        return out;
    }

    // 給介面與測試看
    function view(w) { const B = S(w); return { asks: B.st.asks, took: Object.assign({}, B.took), stock: Object.fromEntries(Object.keys(GOOD).map(k => [k, stanceOf(w, k)])), cut: cutsThisWeek(w) }; }
    return { S, took, selfRun, issues, follow, mgrPicks, relOf, topicOf, stockF, stanceOf, cutsThisWeek, noteCut, noteHop, firm, needMgr, firable, overstaffed, goods, focusOf, slotOf, bosses, daily, ask, facts, options, view, ORDER, GOOD, STOCK_F, STOCK_NAME, WEEK };
})();
if (typeof globalThis !== 'undefined') globalThis.BOSS = BOSS;
