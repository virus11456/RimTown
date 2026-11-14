// RimTown - sim-decide-work.js：v9.23.0 決策核心批次 A（生計與去留）
// 以前：誰搬離小鎮、誰跳槽、誰去拜師、誰在對面開店、合夥人拆不拆夥，都是各系統擲骰決定的
//       （例如「缺糧拖了五天，心情最差的人每天 12% 機率搬走」「對面工資高一成，每週 30% 機率跳槽」）。
// 現在：這些事由本人決定。各系統只說「他現在遇到什麼事、做得到哪幾件事」和「做了之後怎麼結算」：
//   想不想離開這個鎮(leave)        留下來／搬走            ← 餓了七天以上、鎮上缺糧或氣氛差拖著沒人管、自己過得慘沒人關心
//   對面那家工資比較高(jobhop)      留在原來的店／換過去
//   要不要拜師學手藝(apprentice)    照現在這樣過／拜師
//   這一行很賺，要不要在對面開店(rivalshop)  再看看／開
//   合夥的店不賺錢(split)          再撐一陣子／拆夥
// 結算全部在原本的系統裡（sim-issues.js、sim-market.js、sim-compete.js、sim-mobility.js、sim-biz.js），這裡不動任何數字。
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
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const amb = (w, a) => w.mind?.amb?.[a.agentId]?.key || '';
    const pct = (x) => Math.round(x * 100);
    const tie = (a, b) => { const v = aff(a, b); return v >= 40 ? '交情很好' : v >= 10 ? '還算熟' : v > -10 ? '沒什麼交情' : '處不來'; };
    const jobName = (a) => { try { return a.job?.title || (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[a.job?.key]?.title) || '沒有工作'; } catch (e) { return '沒有工作'; } };
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const TI = () => (typeof TOWN_ISSUES !== 'undefined' ? TOWN_ISSUES : null);
    const CP = () => (typeof COMPETE !== 'undefined' ? COMPETE : null);
    const MB = () => (typeof MOBILITY !== 'undefined' ? MOBILITY : null);
    const BZ = () => (typeof BIZ !== 'undefined' ? BIZ : null);
    DECIDE.work = true; // 其他系統看到這個，就知道生計與去留的事交給本人決定、不擲骰

    // 把人留在鎮上的東西：伴侶、還小的孩子、交情好的朋友、名下的店和產業
    function roots(w, a) {
        const pr = a.relationships?.getPartner?.(); const partner = (pr && w.agents[pr.targetId]) || null;
        const kids = npcs(w).filter(o => (o.age ?? 30) < 16 && (o._parentNames || []).includes(a.name)).length;
        const friends = npcs(w).filter(o => o !== a && aff(a, o) >= 40).length;
        let owns = false; try { owns = !!(BZ()?.shopOf?.(w, a)) || !!(w.market && MK()?.ownedBy?.(w, a.agentId)?.length); } catch (e) {}
        return { partner, kids, friends, owns, pull: (partner ? 0.5 : 0) + (kids ? 0.5 : 0) + Math.min(0.4, friends * 0.08) + (owns ? 0.4 : 0) };
    }

    // ================= 去留 =================
    // ---------- 想不想離開這個鎮 ----------
    const LEAVE = {
        starve: { fact: '你已經 {n} 天沒吃飽了，在這裡找不到活路。', why: '再待下去會餓死', base: 1.4 },
        food: { fact: '鎮上缺糧嚴重，已經拖了 {n} 天，沒有人想出辦法。', why: '這裡連飯都吃不飽', base: 1.4 },
        misery: { fact: '你的日子很難過，已經 {n} 天了，鎮上沒有人來關心你。', why: '這裡沒有人在乎我', base: 1.8 },
        gloom: { fact: '鎮上的氣氛很差，已經拖了 {n} 天沒人管。', why: '這個地方待不下去了', base: 1.2 },
    };
    function leaveInfo(w, a) {
        const M = MK(); try { if (M && w.market && DECIDE.on(w) && (a.age || 30) >= 16) { const h = M.isHungry(w, a); if (h >= 7) return { key: 'starve', n: h }; } } catch (e) {}
        const T = TI(); try { if (T && DECIDE.on(w)) { const I = T.leaveWhy(w, a); if (I) return { key: I.key, n: I.idle }; } } catch (e) {}
        return null;
    }
    DECIDE.kind('leave', {
        title: '想不想離開這個鎮', cool: 5, pri: 2.5,
        when(w, a) { const I = leaveInfo(w, a); return I ? { key: I.key } : null; },
        facts(w, a, ctx) {
            const I = leaveInfo(w, a); if (!I || I.key !== ctx.key) return ''; const R = roots(w, a);
            return fill('{why}{fam}鎮上跟你交情好的有 {k} 人。你身上有 {c} 銀幣。走了就是搬離這個鎮，工作和房子都留在這裡。',
                { why: { k: LEAVE[I.key].fact, p: { n: I.n } }, fam: R.partner ? { k: '你的伴侶{x}在這裡。', p: { x: R.partner.name } } : { raw: '' }, k: R.friends, c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const I = leaveInfo(w, a); if (!I || I.key !== ctx.key) return []; const R = roots(w, a); const L = LEAVE[I.key]; const mood = a.mood ?? 50;
            return [
                { id: 'stay', quiet: true, mute: true, text: '留下來，再撐一撐', why: '家在這裡', base: 1.4 + R.pull + (has(a, 'stoic') ? 0.2 : 0) + (has(a, 'optimist') ? 0.2 : 0), lean: { bond: 0.5, safe: 0.3 }, run: () => null },
                { id: 'go', text: '收拾行李，搬去別的地方', say: '離開這個鎮', why: L.why,
                    base: L.base + clampN((50 - mood) / 50, -0.5, 1) * 0.5 + (I.key === 'starve' ? Math.min(0.6, (I.n - 7) * 0.1) : 0) + (has(a, 'pessimist') ? 0.2 : 0), lean: { gain: 0.3 },
                    run: (w, a) => ((I.key === 'starve' ? MK().leaveHungry(w, a) : TI().leaveBy(w, a, I.key)) ? { k: '搬走了' } : { k: '想了想，還是沒走成' }) },
            ];
        },
    });

    // ================= 工作 =================
    // ---------- 對面那家工資比較高：要不要換過去 ----------
    const hopInfo = (w, a) => { const C = CP(); return C && w.market && DECIDE.on(w) ? C.hopInfo(w, a) : null; };
    DECIDE.kind('jobhop', {
        title: '對面那家工資比較高', cool: 7, pri: 1.5,
        when(w, a) { const I = hopInfo(w, a); return I && I.from && I.to ? { k: I.k } : null; },
        facts(w, a, ctx) {
            const I = hopInfo(w, a); if (!I || I.k !== ctx.k) return '';
            return fill('你在{f}的{s}做工，工資是行情的 {m}%；對面{o}那一家開到 {n}%。你跟現在的老闆{tie}。你身上有 {c} 銀幣。', { f: I.from.name, s: MK().name(I.k), m: pct(I.mine), o: I.to.name, n: pct(I.other), tie: tie(a, I.from), c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const C = CP(); const I = hopInfo(w, a); if (!I || I.k !== ctx.k || !I.from || !I.to) return [];
            return [
                { id: 'stay', quiet: true, mute: true, text: { k: '留在{f}這邊', p: { f: I.from.name } }, why: '做熟了，老闆待我也不差', base: 1.0 + clampN(aff(a, I.from) / 50, -1, 1) * 0.6 + (has(a, 'stoic') ? 0.2 : 0), lean: { bond: 0.3, safe: 0.2 }, run: () => null },
                { id: 'move', text: { k: '換到{o}那邊做', p: { o: I.to.name } }, say: { k: '跳槽到{o}那邊', p: { o: I.to.name } }, why: '一樣是做工，當然去工資高的地方',
                    base: 0.35 + (I.other - I.mine - 0.1) * 3 + (has(a, 'greedy') ? 0.5 : 0) + (cash(w, a) < 15 ? 0.4 : 0) + clampN(aff(a, I.to) / 50, -1, 1) * 0.3, lean: { gain: 0.5 },
                    run: (w, a) => (C.hop(w, a, I.k) ? { k: '換過去了' } : null) },
            ];
        },
    });

    // ---------- 要不要拜師學手藝 ----------
    const learnInfo = (w, a) => { const M = MB(); return M && DECIDE.on(w) ? M.learnInfo(w, a) : null; };
    DECIDE.kind('apprentice', {
        title: '要不要拜師學手藝', cool: 14, pri: 1.2,
        when(w, a) { const I = learnInfo(w, a); return I ? { m: I.m.agentId } : null; },
        facts(w, a, ctx) {
            const I = learnInfo(w, a); if (!I || I.m.agentId !== ctx.m) return '';
            return fill('你現在是{j0}，日子沒什麼起色。{m}是{j}，{fast}願意收你當徒弟：要學 {n} 天，拜師禮 {f} 銀幣，出師以後改當{j}，工資比現在好。你身上有 {c} 銀幣。',
                { j0: jobName(a), m: I.m.name, j: I.job, fast: I.fast ? '而且是鎮上公認的名匠，' : { raw: '' }, n: I.days, f: I.fee, c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const M = MB(); const I = learnInfo(w, a); if (!I || I.m.agentId !== ctx.m) return [];
            return [
                { id: 'no', quiet: true, mute: true, text: '照現在這樣過', why: '現在的工作做得好好的', base: 1.5, lean: { safe: 0.3 }, run: () => null },
                { id: 'learn', text: { k: '拜{m}為師，學當{j}', p: { m: I.m.name, j: I.job } }, say: { k: '拜{m}為師', p: { m: I.m.name } }, why: '學一門手藝，不要一輩子這樣過',
                    base: -0.7 + (has(a, 'hardworking') ? 0.5 : 0) + (has(a, 'creative') ? 0.5 : 0) + (has(a, 'perfectionist') ? 0.5 : 0) + (['craft', 'rich'].includes(amb(w, a)) ? 0.4 : 0) + (I.fast ? 0.3 : 0) + ((a.age ?? 30) <= 25 ? 0.2 : 0) - (has(a, 'lazy') ? 0.8 : 0) + clampN(aff(a, I.m) / 50, 0, 1) * 0.3, lean: { gain: 0.5 },
                    run: (w, a) => (M.learnBy(w, a) ? { k: '拜師了，要學 {n} 天', p: { n: I.days } } : null) },
            ];
        },
    });

    // ================= 開店 =================
    // ---------- 這一行很賺：要不要在對面開一家 ----------
    const openInfo = (w, a) => { const C = CP(); return C && w.market && DECIDE.on(w) ? C.openInfo(w, a) : null; };
    DECIDE.kind('rivalshop', {
        title: '這一行很賺，要不要在對面開一家', cool: 7, pri: 1.3,
        when(w, a) { const I = openInfo(w, a); return I ? { k: I.k } : null; },
        facts(w, a, ctx) {
            const I = openInfo(w, a); if (!I || I.k !== ctx.k) return '';
            return fill('{o}的{s}已經連 {n} 週生意很好（這一週賺了 {p} 銀幣），鎮上還沒有第二家。在對面開一家要 {c} 銀幣，可以開高一點的工資挖走他一部分工人；你身上有 {m} 銀幣。你跟{o}{tie}。開了就是跟他搶生意，生意不好也可能賠光收攤。',
                { o: I.boss.name, s: MK().name(I.k), n: I.weeks, p: I.profit, c: I.cost, m: Math.floor(cash(w, a)), tie: tie(a, I.boss) });
        },
        options(w, a, ctx) {
            const C = CP(); const I = openInfo(w, a); if (!I || I.k !== ctx.k) return []; const sName = MK().name(I.k);
            return [
                { id: 'wait', quiet: true, mute: true, text: '再看看，不去搶這門生意', why: '人家做得好好的，何必去搶', base: 1.5, lean: { safe: 0.4 }, run: () => null },
                { id: 'open', text: { k: '花 {c} 銀幣在對面開一家{s}', p: { c: I.cost, s: sName } }, say: { k: '在{o}對面開一家{s}', p: { o: I.boss.name, s: sName } }, why: '這麼好賺的生意，不能讓他一個人賺',
                    base: -0.1 + I.s * 0.35 + Math.min(0.4, (cash(w, a) / I.cost - 1.5) * 0.2), lean: { gain: 0.6, safe: -0.4 },
                    run: (w, a) => (C.openBy(w, a, I.k) ? { k: '新店開張了，要跟{o}搶生意', p: { o: I.boss.name } } : { k: '沒開成' }) },
            ];
        },
    });

    // ---------- 合夥的店不賺錢：要不要拆夥 ----------
    const splitInfo = (w, a) => { const B = BZ(); return B && DECIDE.on(w) ? B.splitInfo(w, a) : null; };
    DECIDE.kind('split', {
        title: '合夥的店不賺錢', cool: 7, pri: 1,
        when(w, a) { const I = splitInfo(w, a); return I ? { o: I.other.agentId } : null; },
        facts(w, a, ctx) {
            const I = splitInfo(w, a); if (!I || I.other.agentId !== ctx.o) return '';
            return fill('你跟{o}合夥的「{n}」上週只賺了 {x} 銀幣。{role}你跟{o}{tie}。拆夥的話店由老闆自己開下去，兩個人會翻臉。', { o: I.other.name, n: I.s.name[0], x: I.last, role: I.mine ? '你是老闆，他是出錢的合夥人。' : '他是老闆，你是出錢的合夥人。', tie: tie(a, I.other) });
        },
        options(w, a, ctx) {
            const B = BZ(); const I = splitInfo(w, a); if (!I || I.other.agentId !== ctx.o) return []; const o = I.other;
            return [
                { id: 'stay', quiet: true, mute: true, text: '再撐一陣子', why: '生意有起有落，合夥就是要互相體諒', base: 1.4 + clampN(aff(a, o) / 50, -1, 1) * 0.5, lean: { bond: 0.4 }, run: () => null },
                { id: 'split', text: { k: '跟{o}拆夥', p: { o: o.name } }, say: { k: '跟{o}拆夥', p: { o: o.name } }, why: '錢沒賺到，還要看對方臉色',
                    base: 0.6 + (has(a, 'jealous') ? 0.8 : 0) + (has(o, 'lazy') ? 0.8 : 0) + (has(a, 'lazy') ? 0.3 : 0) + (has(a, 'abrasive') ? 0.3 : 0) + (I.last < 0 ? 0.3 : 0) - (has(a, 'kind') ? 0.5 : 0), lean: { face: 0.2, bond: -0.4 },
                    run: (w, a) => (B.splitBy(w, a) ? { k: '拆夥了' } : null) },
            ];
        },
    });
})();
