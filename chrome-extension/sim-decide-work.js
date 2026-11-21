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

    // ================= 東家每週看帳（v11.6.0） =================
    // 以前調薪、調價、被挖角就加薪、裁員、請掌櫃是五條自動規則，東家沒被問過。現在每位東家一週看一次帳，自己決定這週做哪一件事。
    // 由 sim-boss.js 在輪到他的那一天送進來（不是每天掃）；選項照當下的帳列，結算也在那邊。另有自己的每日額度（DECIDE.AI_GROUP.work，一天 6 件）
    const BS = () => (typeof BOSS !== 'undefined' ? BOSS : null);
    // 額度：一天最多兩位東家輪到（原本那家一位、對面那家晚三天的一位），開智能體時前一天的追問最多再兩件，平常最多 4 件；work 一組 6 件夠用。
    // 同一類一天最多 4 件（aiKind），超過的（錯過補問的人剛好擠在同一天）照個性決定，不會沒人問
    DECIDE.kind('bossWeek', { title: '東家這週看帳', scan: false, cool: 0, pri: 2, aiGroup: 'work', aiKind: 4,
        facts(w, a, ctx) { const B = BS(); return B ? B.facts(w, a, ctx) : ''; },
        options(w, a, ctx) { const B = BS(); return B ? B.options(w, a, ctx) : []; } });

    // ================= v11.6.0 銀行的事由銀行家決定、房東自己定租金與欠租的事 =================
    // 銀行家（sim-bank.js）：有人來借錢借不借、每週利率、逾期的人怎麼辦、擠兌時押多少自己的錢，四種用 ctx.t 分。
    // 房東（sim-estate.js）：每 28 天定一次自己房子的租金檔位、房客欠租到三倍時趕不趕。都由那邊在該問的時候送進來（不是每天掃），額度跟東家看帳同一組 work
    const BK = () => (typeof BANK !== 'undefined' ? BANK : null), ES = () => (typeof ESTATE !== 'undefined' ? ESTATE : null);
    DECIDE.kind('bankDesk', { title: '銀行家坐櫃台', scan: false, cool: 0, pri: 2.5, aiGroup: 'work', aiKind: 3,
        facts(w, a, ctx) { const B = BK(); return B ? B.deskFacts(w, a, ctx) : ''; },
        options(w, a, ctx) { const B = BK(); return B ? B.deskOptions(w, a, ctx) : []; } });
    DECIDE.kind('landlord', { title: '房東看自己的房子', scan: false, cool: 0, pri: 2, aiGroup: 'work', aiKind: 3,
        facts(w, a, ctx) { const E = ES(); return E && E.llFacts ? E.llFacts(w, a, ctx) : ''; },
        options(w, a, ctx) { const E = ES(); return E && E.llOptions ? E.llOptions(w, a, ctx) : []; } });

    // ================= 小店撐不撐、接不接（v11.6.0） =================
    // 以前連虧 15 天或欠到 40 就自動倒閉，老闆不在了店直接消失，沒有人被問過。現在：
    //   一直虧(shopFail)：連虧 10 天或欠到 25 時問店主一次（之後每 7 天最多一次）：貼錢、降價、找朋友合夥、收掉、頂讓；原本的倒閉門檻留著當底線
    //   朋友的店找你合夥(shopJoin)：店主選了找某某合夥，對方答應才算
    //   老闆不在了(shopHeir)：先問合夥人、再問配偶、成年子女要不要接；都不接就收掉，店面空下來
    // 都由 sim-biz.js 在那一刻送進來（不是每天掃），選項與結算也在那邊；跟東家看帳共用 work 那一組的 AI 額度
    DECIDE.kind('shopFail', { title: '店一直在虧錢', scan: false, cool: 0, pri: 2, aiGroup: 'work', aiKind: 2,
        facts(w, a, ctx) { const B = BZ(); return B ? B.failFacts(w, a, ctx) : ''; },
        options(w, a, ctx) { const B = BZ(); return B ? B.failOptions(w, a, ctx) : []; } });
    DECIDE.kind('shopJoin', { title: '朋友的店找你合夥', scan: false, cool: 0, pri: 3, aiGroup: 'work', aiKind: 2,
        facts(w, a, ctx) { const B = BZ(); return B ? B.joinFacts(w, a, ctx) : ''; },
        options(w, a, ctx) { const B = BZ(); return B ? B.joinOptions(w, a, ctx) : []; } });
    DECIDE.kind('shopHeir', { title: '要不要接下留下來的店', scan: false, cool: 0, pri: 2.5, aiGroup: 'work', aiKind: 2,
        facts(w, a, ctx) { const B = BZ(); return B ? B.heirFacts(w, a, ctx) : ''; },
        options(w, a, ctx) { const B = BZ(); return B ? B.heirOptions(w, a, ctx) : []; } });

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

// ================= v11.13.0 工作與求職 =================
// 以前這六件事都沒有人被問過：
//   沒工作的人每週照「擅長＋工資＋運氣」被配一個職缺，一定接；太擠的行業裡最適合新工作的人直接被轉走；
//   公職與公營的行業人太多，最不擅長的人照規則被裁，沒有人拿主意；
//   沒有工會的工人工資被壓到七成以下，每週擲 50% 整行一起罷工；罷工之後東家不貪心就一定讓、貪心的擲 40%；
//   教團養得起多一位神職時，沒工作的虔誠信徒直接變神職，有工作的擲 50% 辭職。
// 現在什麼時候遇到照舊看處境與運氣（有沒有缺、哪一行太擠、誰先聽到消息、工資被壓多久），遇到之後怎麼做由本人決定：
//   沒有工作，鎮上有缺(jobSeek)            去做最做得來的／去做工資最高的／這禮拜先不找／拜師學手藝（有師傅肯收才有）
//   這一行人太多，別行缺人(jobSwitch)       留在原本這一行／改行
//   公家的行業人太多(pubCut)               首長：這禮拜不裁人／請某某另外找工作（最生疏的兩位，加上跟他有過節的，最多三位）
//   工資被壓，同行說要罷工(wildcat)         站出來罷工／再忍一忍／去加入工會（鎮上有工會才有）；一半以上的人站出來才罷得成，只有站出來的人不上工、沒工資
//   罷工的人回來上工了(wildcatEnd)          東家：讓步加薪／不讓步／不讓步還開除帶頭的
//   教團想請你當神職(ordain)               去當神職／不去（婉拒的四週內不再問，換問下一位）
// 都由原本的系統在那一刻送進來（不是每天掃）；結算在原本的系統裡（sim-finance.js、sim-market.js、sim-clergy.js、sim-union.js、sim-mobility.js），
// 這裡不搬任何錢。首長裁人用公家那一組的 AI 額度（civic），其餘五種用自己的一組（jobs，一天 8 件），輪不到 AI 的照個性決定。
// 傾向分數照「以前大概多常發生」算起跑分數，再加上手藝、工資、交情、個性與處境：沒開 AI 時整體頻率跟以前差不多，誰會那樣做看的是人。
const JOBS = (() => {
    if (typeof DECIDE === 'undefined') return { on: () => false };
    const G = 'jobs'; DECIDE.AI_GROUP.jobs = 8;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(n); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet && a ? WALLET.get(w, a) : 0);
    const depOf = (w, a) => (w.bank?.open ? (w.bank.dep?.[a.agentId] || 0) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const jailed = (w, a) => !!(w.civic?.jail?.[a?.agentId] > day(w));
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a).filter(f => f !== a) : []; } catch (e) { return []; } };
    const isFam = (w, a, b) => !!(a && b && a !== b && (famOf(w, a).includes(b) || famOf(w, b).includes(a)));
    const tie = (w, a, b) => { if (isFam(w, a, b)) return '是一家人'; const v = aff(a, b); return v >= 40 ? '交情很好' : v >= 10 ? '還算熟' : v > -10 ? '沒什麼交情' : '處不來'; };
    const kidsOf = (w, a) => npcs(w).filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(a.name)).length;
    const hungry = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.isHungry ? MARKET.isHungry(w, a) : 0; } catch (e) { return 0; } };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const en = () => { try { return typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; } catch (e) { return false; } };
    const on = (w) => { try { return !!DECIDE.on(w) && typeof LABOR !== 'undefined'; } catch (e) { return false; } };
    const LB = () => LABOR, MK = () => (typeof MARKET !== 'undefined' ? MARKET : null), CL = () => (typeof CLERGY !== 'undefined' ? CLERGY : null), UN = () => (typeof UNION !== 'undefined' ? UNION : null);
    const jobT = (k) => LB().jobTitle(k);
    const isBoss = (w, a) => { try { return !!(MK() && w.market && MK().ownedBy(w, a.agentId).length > 0); } catch (e) { return false; } };
    const st = (w, k) => { try { const L = LB().S(w); const D = L.dec || (L.dec = {}); D[k] = (D[k] || 0) + 1; } catch (e) {} };
    // 起跑分數：讓一般人（五種傾向都是 1）選到每一項的機會接近 ps，再加上這個人自己的加減（算法跟 sim-decide-order.js 同一個）
    const tiltN = (ps) => (typeof ORDER !== 'undefined' && ORDER.tiltN ? ORDER.tiltN(ps) : ps.map(p => 1 + (p - ps[0]) * 2));
    const leanSum = (l) => Object.values(l || {}).reduce((x, y) => x + y, 0);
    const cal = (opts, ps) => { const b = tiltN(ps); opts.forEach((op, i) => { op.base = b[i] - leanSum(op.lean) + (op.adj || 0); delete op.adj; }); return opts; };
    const base = { scan: false, cool: 0, aiGroup: G, when: () => null };
    const skill = (a, k) => { try { return a.skills?.get?.(LB().PRIMARY[k]) || null; } catch (e) { return null; } };
    const cant = (a, k) => !!skill(a, k)?.isIncapable;
    const skillWord = (a, k) => { const s = skill(a, k); if (!s) return '沒做過'; if (s.isIncapable) return '天生做不來'; const lv = s.level || 0; return lv >= 10 ? '很拿手' : lv >= 6 ? '做得不錯' : lv >= 3 ? '做得來' : lv >= 1 ? '只會一點' : '沒做過'; };
    const love = (a, k) => ({ '狂熱': 0.5, '大': 0.3 }[skill(a, k)?.passion] || 0); // 對這門手藝有多投入
    const fitOf = (a, k) => LB().skillOf(a, k) + (typeof HEALTH !== 'undefined' ? (HEALTH.jobFit(a, k) - 1) * 6 : 0);

    // ================= A. 沒有工作，鎮上有缺 =================
    function seekInfo(w, a, c) {
        if (!c || !a || a.job || (a.age ?? 30) < 16 || day(w) - (c.d ?? 0) > 2 || !inTown(w, a)) return null;
        const L = LB(); const O = L.openNow(w); const ks = Object.keys(O.open).filter(k => O.open[k] > 0); if (!ks.length) return null;
        const pay = (k) => L.payOf(w, k);
        const fit = ks.slice().sort((x, y) => fitOf(a, y) - fitOf(a, x) || pay(y) - pay(x))[0]; const top = ks.slice().sort((x, y) => pay(y) - pay(x) || fitOf(a, y) - fitOf(a, x))[0];
        const since = L.S(w).jobless[a.agentId]; const first = since == null && (a.age ?? 30) < 20;
        let learn = null; try { learn = typeof MOBILITY !== 'undefined' && MOBILITY.learnInfo ? MOBILITY.learnInfo(w, a) : null; } catch (e) {}
        const ap = w.mobility?.ap?.[a.agentId]; const master = ap && w.agents[ap.m] ? { m: w.agents[ap.m], k: ap.k } : null;
        return { O, ks, fit, top, pay, since, first, learn, master, c: Math.floor(cash(w, a)), dep: Math.floor(depOf(w, a)) };
    }
    function seek(w, seekers, d) {
        const L = LB();
        for (const a of seekers) {
            if (a.job) continue;
            const O = L.openNow(w); if (!Object.values(O.open).some(n => n > 0)) { L.idle(w, a, d); continue; } // 沒有缺：照舊，找不到工作
            if (!inTown(w, a)) { L.idle(w, a, d, false); continue; } // 人不在鎮上（出去探險）：這禮拜沒辦法找
            st(w, 'seek'); DECIDE.askNow(w, [{ a, kind: 'jobSeek', ctx: { d } }]);
        }
    }
    DECIDE.kind('jobSeek', Object.assign({}, base, {
        title: '沒有工作，鎮上有缺', pri: 1.6, aiKind: 3,
        facts(w, a, c) { const I = seekInfo(w, a, c); if (!I) return '';
            const list = I.ks.slice().sort((x, y) => I.O.open[y] - I.O.open[x]).slice(0, 5).map(k => fill('{j}（缺 {n} 人，一天大約 {p} 銀幣）', { j: jobT(k), n: I.O.open[k], p: I.pay(k) })).join(t('、'));
            return fill('{head}鎮上現在缺人的行業：{list}。這裡面你最做得來的是{j}（{fw}），一天大約領 {fp} 銀幣{same}。{top}你身上有 {c} 銀幣{dep}；沒有工作就沒有工資，只能靠存款、家人或救濟。{master}{learn}', {
                head: I.first ? '你成年了，要開始自己找工作。' : I.since != null ? { k: '你已經 {n} 天沒有工作了。', p: { n: Math.max(0, day(w) - I.since) } } : '你現在沒有工作。', list: { raw: list },
                j: jobT(I.fit), fw: skillWord(a, I.fit), fp: I.pay(I.fit), same: I.top === I.fit ? '，也是現在工資最高的' : { raw: '' },
                top: I.top !== I.fit ? { k: '工資最高的是{j}，一天大約 {p} 銀幣；這一行你{w}。', p: { j: jobT(I.top), p: I.pay(I.top), w: skillWord(a, I.top) } } : { raw: '' },
                c: I.c, dep: I.dep > 0 ? { k: '，銀行裡還有 {d}', p: { d: I.dep } } : { raw: '' },
                master: I.master ? { k: '你正在跟{m}學當{j}，還沒出師。學徒本身沒有工資，學的時候也可以先接一份工作，出師時再改當{j}。', p: { m: I.master.m.name, j: jobT(I.master.k) } } : { raw: '' },
                learn: I.learn ? { k: '{m}是{j}，願意收你當徒弟：要學 {n} 天，拜師禮 {f} 銀幣，出師以後當{j}。學徒本身沒有工資，學的時候也可以接一份工作。', p: { m: I.learn.m.name, j: I.learn.job, n: I.learn.days, f: I.learn.fee } } : { raw: '' } }); },
        options(w, a, c) { const I = seekInfo(w, a, c); if (!I) return []; const L = LB(); const d0 = day(w);
            // 想好的時候這個缺已經被別人補走（開著 AI 時好幾個人同時在想）：他本來就是要去做工，還有別的缺就照同樣的標準（最做得來／工資最高）改接那一個，都沒有了才落空
            const takeRun = (k, by) => (w2, a2) => { if (a2.job) return null; const O2 = L.openNow(w2);
                if (!(O2.open[k] > 0)) { const alt = Object.keys(O2.open).filter(x => O2.open[x] > 0 && !cant(a2, x)).sort(by === 'pay' ? (x, y) => L.payOf(w2, y) - L.payOf(w2, x) || fitOf(a2, y) - fitOf(a2, x) : (x, y) => fitOf(a2, y) - fitOf(a2, x) || L.payOf(w2, y) - L.payOf(w2, x))[0];
                    if (alt && L.hire(w2, a2, alt)) { st(w2, 'take'); st(w2, 'takeAlt'); return { k: '晚了一步，{j}的缺已經被別人補走了，改當{b}', p: { j: jobT(k), b: jobT(alt) } }; }
                    L.idle(w2, a2, day(w2)); return { k: '晚了一步，{j}的缺已經被別人補走了', p: { j: jobT(k) } }; }
                if (!L.hire(w2, a2, k)) return null; st(w2, 'take'); return { k: '當上了{j}', p: { j: jobT(k) } }; };
            const poor = I.c < 10 ? 1 : 0; const kids = kidsOf(w, a) ? 1 : 0; const hu = hungry(w, a) >= 1 ? 1 : 0; const sF = L.skillOf(a, I.fit), sT = L.skillOf(a, I.top); const pF = I.pay(I.fit), pT = I.pay(I.top);
            const out = [{ id: 'fit:' + I.fit, text: { k: '去當{j}（你最做得來的）', p: { j: jobT(I.fit) } }, say: { k: '去當{j}', p: { j: jobT(I.fit) } }, why: '做自己會的，比較安心。', lean: { safe: 0.2 },
                adj: clampN(sF / 20, -0.3, 0.4) + (has(a, 'hardworking') ? 0.1 : 0) + (cant(a, I.fit) ? -0.6 : 0), run: takeRun(I.fit) }];
            if (I.top !== I.fit) out.push({ id: 'pay:' + I.top, text: { k: '去當{j}（工資最高的）', p: { j: jobT(I.top) } }, say: { k: '去當{j}', p: { j: jobT(I.top) } }, why: '一樣是做工，當然挑錢多的。', lean: { gain: 0.3 },
                adj: clampN((pT - pF) / Math.max(1, pF), 0, 1) * 0.9 - clampN((sF - sT) / 16, 0, 0.5) + (poor ? 0.2 : 0) + (cant(a, I.top) ? -1.5 : 0), run: takeRun(I.top, 'pay') });
            out.push({ id: 'wait', text: '這禮拜先不找，再看看', say: '這禮拜先不找工作', why: sF <= 0 ? '這些工作我一樣都不會，再等等看。' : '不急，再看看有沒有更合適的。', lean: { joy: 0.2 },
                adj: (has(a, 'lazy') ? 0.5 : 0) - (has(a, 'hardworking') ? 0.3 : 0) + (I.c + I.dep >= 400 ? 0.5 : I.c + I.dep >= 150 ? 0.3 : 0) - poor * 0.5 - hu * 0.4 - kids * 0.3 + (sF <= 0 ? 0.25 : 0) - (I.since != null && d0 - I.since >= 21 ? 0.2 : 0),
                run: (w2, a2) => { if (a2.job) return null; L.idle(w2, a2, day(w2), false); st(w2, 'wait'); mem(w2, a2, '這禮拜我沒有去找工作，想再看看。', {}, 4); log(w2, '🪑 {a}這禮拜沒有去找工作，想再看看。', { a: a2.name }, a2.name); return { k: '還是沒有工作' }; } });
            if (I.learn) out.push({ id: 'learn', text: { k: '不找工作，拜{m}為師學當{j}', p: { m: I.learn.m.name, j: I.learn.job } }, say: { k: '拜{m}為師', p: { m: I.learn.m.name } }, why: '學一門手藝，以後才有出路。', lean: { gain: 0.2 },
                adj: (has(a, 'hardworking') ? 0.3 : 0) + (has(a, 'creative') ? 0.3 : 0) + ((a.age ?? 30) <= 25 ? 0.2 : 0) + (I.learn.fast ? 0.2 : 0) + (sF <= 2 ? 0.3 : 0) - (has(a, 'lazy') ? 0.5 : 0) - poor * 0.2 + clampN(aff(a, I.learn.m) / 50, 0, 1) * 0.3,
                run: (w2, a2) => { if (a2.job) return null; if (!MOBILITY.learnBy(w2, a2)) return { k: '沒拜成' }; L.idle(w2, a2, day(w2), false); st(w2, 'learn'); return { k: '拜師了，要學 {n} 天', p: { n: I.learn.days } }; } });
            const P = { fit: I.top === I.fit ? 0.9 : 0.63, pay: 0.27, wait: 0.07, learn: 0.03 };
            return cal(out, out.map(o => P[String(o.id).split(':')[0]]));
        },
    }));

    // ================= B. 這一行人太多，別行缺人 =================
    function switchInfo(w, a, c) {
        if (!c || !a || a.job?.key !== c.from || day(w) - (c.d ?? 0) > 2 || !inTown(w, a) || isBoss(w, a) || w.union?.leader === a.agentId) return null;
        const L = LB(); const O = L.openNow(w); const n = O.fl[c.from] || 0, m = O.sl[c.from]; if (!(O.open[c.to] > 0) || !(n > m)) return null;
        let boss = null; try { const sec = MK() && w.market ? MK().JOB2S[c.from] : null; const id = sec ? MK().ownerOf(w, sec) : null; boss = id && id !== a.agentId ? (w.agents[id] || null) : null; } catch (e) {}
        return { n, m, need: O.open[c.to], risk: L.overfull(n, m), p0: L.payOf(w, c.from), p1: L.payOf(w, c.to), s0: L.skillOf(a, c.from), s1: L.skillOf(a, c.to), boss };
    }
    function switchAsk(w, cands, from, to, d) { const list = (cands || []).filter(a => a && inTown(w, a)).map(a => ({ a, kind: 'jobSwitch', ctx: { from, to, d } })); if (!list.length) return false; st(w, 'switchAsk'); DECIDE.askNow(w, list); return true; }
    DECIDE.kind('jobSwitch', Object.assign({}, base, {
        title: '這一行人太多，別行缺人', pri: 1.3, aiKind: 2,
        facts(w, a, c) { const I = switchInfo(w, a, c); if (!I) return '';
            return fill('你是{a}。鎮上做{a}的有 {n} 人，名額只有 {m} 個{risk}。{b}還缺 {k} 人。做{a}你{w0}，一天大約領 {p0} 銀幣；做{b}你{w1}，一天大約領 {p1} 銀幣。{boss}你身上有 {c} 銀幣。', {
                a: jobT(c.from), b: jobT(c.to), n: I.n, m: I.m, k: I.need, risk: I.risk ? '，人多到隨時可能裁人' : { raw: '' }, w0: skillWord(a, c.from), w1: skillWord(a, c.to), p0: I.p0, p1: I.p1,
                boss: I.boss ? { k: '現在的東家是{o}，你們{tie}。', p: { o: I.boss.name, tie: tie(w, a, I.boss) } } : { raw: '' }, c: Math.floor(cash(w, a)) }); },
        options(w, a, c) { const I = switchInfo(w, a, c); if (!I) return [];
            return cal([
                { id: 'stay', quiet: true, mute: true, text: '留在原本這一行', say: { k: '留下來繼續當{a}', p: { a: jobT(c.from) } }, why: '做熟了，不想從頭學起。', lean: { safe: 0.3 }, run: () => null },
                { id: 'move', text: { k: '改行當{b}', p: { b: jobT(c.to) } }, say: { k: '改行當{b}', p: { b: jobT(c.to) } }, why: '這一行人太多了，換個地方才有出路。', lean: { gain: 0.3 },
                    adj: clampN((I.s1 - I.s0) / 10, -0.6, 0.4) + clampN((I.p1 - I.p0) / Math.max(1, I.p0), -0.5, 0.5) * 0.8 + (I.risk ? 0.3 : 0) + (has(a, 'ambitious') ? 0.15 : 0) - love(a, c.from) - (hasV(a, '傳統') ? 0.15 : 0) - (I.boss && aff(a, I.boss) >= 40 ? 0.2 : 0) - (cant(a, c.to) ? 1.5 : 0),
                    run: (w2, a2) => { if (!switchInfo(w2, a2, c)) return { k: '晚了一步，{j}的缺已經被別人補走了', p: { j: jobT(c.to) } }; if (!LB().switchTo(w2, a2, c.from, c.to)) return null; st(w2, 'switch'); return { k: '改行當了{b}', p: { b: jobT(c.to) } }; } },
            ], [0.32, 0.68]); // 起跑機會比一半高：被問到的人多半在原本這一行比較熟、也比較有感情（下面會扣），實跑下來每個人大約一半會換，兩個人合起來跟以前「每週轉走一位」差不多
        },
    }));

    // ================= C. 公家的行業人太多：首長決定裁誰或不裁 =================
    const publicJob = (w, k) => { try { if (!MK() || !w.market) return true; const sec = MK().JOB2S[k]; return !sec || !MK().ownerOf(w, sec); } catch (e) { return false; } };
    function headOf(w) { let m = null; try { m = typeof FISCAL !== 'undefined' && FISCAL.headOf ? FISCAL.headOf(w) : (typeof PROCURE !== 'undefined' && PROCURE.headOf ? PROCURE.headOf(w) : null); } catch (e) { m = null; } return m && inTown(w, m) && !jailed(w, m) ? m : null; }
    const cutsNow = (w) => { try { return typeof BOSS !== 'undefined' && w.market ? BOSS.cutsThisWeek(w) : 0; } catch (e) { return 0; } };
    function cutInfo(w, a, c) {
        if (!c || !a || headOf(w) !== a || day(w) - (c.d ?? 0) > 2 || !publicJob(w, c.k) || cutsNow(w) >= 2) return null;
        const L = LB(); const O = L.openNow(w); const n = O.fl[c.k] || 0, m = O.sl[c.k]; if (!L.overfull(n, m)) return null;
        const pool = L.cutPool(w, O.all, c.k).filter(x => x !== a); const list = pool.slice(0, 2).map(x => ({ x, why: 'weak' }));
        for (const x of pool.slice(2).filter(x => aff(a, x) <= -15).sort((x, y) => aff(a, x) - aff(a, y))) if (list.length < 3) list.push({ x, why: 'foe' }); // 最生疏的兩位之外，跟首長有過節的也在名單上：真的首長會想趁機把他請走
        if (!list.length) return null; let low = false; try { low = typeof TREASURY !== 'undefined' && !!TREASURY.low(w); } catch (e) {}
        return { n, m, list, low, pay: L.payOf(w, c.k), sec: MK() && w.market ? MK().JOB2S[c.k] : null, silver: Math.floor(w.stockpile?.get?.('silver') || 0), cuts: cutsNow(w) };
    }
    function cutAsk(w, head, k, d) { st(w, 'cutAsk'); DECIDE.askNow(w, [{ a: head, kind: 'pubCut', ctx: { k, d } }]); return true; }
    const CWHY = { weak: '這一行他最生疏', foe: '跟你有過節' };
    DECIDE.kind('pubCut', Object.assign({}, base, {
        title: '公家的行業人太多', pri: 2, aiGroup: 'civic', aiKind: 2,
        facts(w, a, c) { const I = cutInfo(w, a, c); if (!I) return '';
            const list = I.list.map(m => { const kn = kidsOf(w, m.x); return fill('{x}（做這一行{sw}，你們{tie}，身上有 {c} 銀幣{kids}）', { x: m.x.name, sw: skillWord(m.x, c.k), tie: tie(w, a, m.x), c: Math.floor(cash(w, m.x)), kids: kn ? { k: '，家裡有 {n} 個小孩', p: { n: kn } } : { raw: '' } }); }).join(t('、'));
            return fill('{j}現在有 {n} 人，名額只有 {m} 個，多了 {x} 人。{pay}公庫現在有 {s} 銀幣{low}。可以請走的人：{list}。被請走的人沒有工資，要自己再找工作，也會記得是你決定的。這個禮拜鎮上已經裁了 {k} 人，一週最多 2 人。', {
                j: jobT(c.k), n: I.n, m: I.m, x: I.n - I.m, pay: I.sec ? { k: '{s}是公營的，工資由公庫發，一人一天大約 {p} 銀幣。', p: { s: { raw: MK().name(I.sec) }, p: I.pay } } : { k: '這是公職，工資由公庫發，一人一天大約 {p} 銀幣。', p: { p: I.pay } },
                s: I.silver, low: I.low ? '，已經吃緊' : { raw: '' }, list: { raw: list }, k: I.cuts }); },
        options(w, a, c) { const I = cutInfo(w, a, c); if (!I) return []; const avg = I.list.reduce((s, m) => s + aff(a, m.x), 0) / I.list.length;
            const out = [{ id: 'keep', quiet: true, mute: true, text: '這禮拜不裁人', say: { k: '沒有裁{j}的人', p: { j: jobT(c.k) } }, why: '大家都要吃飯，能不裁就不裁。', lean: { bond: 0.3 },
                adj: (has(a, 'kind') ? 0.3 : 0) + (has(a, 'generous') ? 0.15 : 0) - (has(a, 'thrifty') ? 0.2 : 0) - (I.low ? 0.5 : 0) + clampN(avg / 80, -0.2, 0.3) - clampN((I.n - I.m - 2) * 0.08, 0, 0.3), run: () => null }];
            for (const m of I.list) { const x = m.x;
                out.push({ id: 'cut:' + x.agentId, text: { k: '請{x}另外找工作（{why}）', p: { x: x.name, why: CWHY[m.why] } }, say: { k: '請{x}另外找工作', p: { x: x.name } }, why: m.why === 'foe' ? '反正人太多，先請跟我過不去的走。' : '人太多了，只能請最生疏的先走。', lean: { gain: 0.2, bond: -0.2 }, m: m.why,
                    adj: -clampN(aff(a, x) / 50, -0.6, 1) * 0.5 - (isFam(w, a, x) ? 1.5 : 0) - (has(a, 'kind') && cash(w, x) < 10 ? 0.2 : 0),
                    run: (w2, a2) => { const I2 = cutInfo(w2, a2, c); const x2 = w2.agents[x.agentId]; if (!I2 || !x2 || x2.isDead || x2.job?.key !== c.k) return { k: '沒裁成' }; LB().layoff(w2, x2, c.k, day(w2), a2); st(w2, 'cut'); return { k: '請{x}另外找工作了', p: { x: x2.name } }; } }); }
            const ps = [0.3].concat(I.list.length === 1 ? [0.7] : I.list.length === 2 ? [0.45, 0.25] : [0.42, 0.2, 0.08]);
            return cal(out, ps);
        },
    }));

    // ================= D. 工資被壓，同行說要罷工（沒有工會出面的那種） =================
    const wsOf = (w, k) => { const M = MK(); const id = M.ownerOf(w, k); return M.workersOf(w, k, npcs(w)).filter(a => a.agentId !== id && !M.isRivalEmp(w, k, a)); };
    function walkAsk(w, k, ws, d) {
        const M = MK().S(w); M.walk = M.walk || {}; const here = (ws || []).filter(a => inTown(w, a) && !jailed(w, a)); if (here.length < 3) return false;
        if (M.strikers) delete M.strikers[k]; M.walk[k] = { d, n: here.length, yes: [], no: [] }; st(w, 'walkAsk');
        DECIDE.askNow(w, here.map(a => ({ a, kind: 'wildcat', ctx: { k, d } }))); return true;
    }
    function walkInfo(w, a, c) {
        const M0 = MK(); if (!c || !a || !M0 || !w.market || day(w) - (c.d ?? 0) > 1 || M0.JOB2S[a.job?.key] !== c.k || !inTown(w, a)) return null;
        const M = M0.S(w); const W = M.walk?.[c.k]; if (!W || W.d !== c.d || W.yes.includes(a.agentId) || W.no.includes(a.agentId)) return null;
        const bossId = M0.ownerOf(w, c.k); const boss = bossId && bossId !== a.agentId ? w.agents[bossId] : null; if (!boss) return null; const rate = M0.payRate(w, c.k); if (rate > 0.7) return null; // 等回話的這段時間東家已經加薪了：這件事就過去了
        const U = UN(); const X = w.union; const union = U && X?.on && !X.members[a.agentId] && U.sectorOf(w, a) && !isBoss(w, a) ? X : null;
        const pay = LB().payOf(w, a.job.key); return { W, boss, rate, days: Math.max(0, day(w) - (M.low?.[c.k] ?? day(w))), union, pay, full: Math.round(pay / Math.max(0.01, rate) * 10) / 10, c: Math.floor(cash(w, a)) };
    }
    const need = (n) => Math.max(2, Math.ceil(n / 2));
    function walkVote(w, a, c, yes) {
        const M0 = MK(); const M = M0.S(w); const W = M.walk?.[c.k]; if (!W || W.d !== c.d) return null; (yes ? W.yes : W.no).push(a.agentId); const s = M0.name(c.k);
        if (W.on) { // 已經罷起來了：晚一點才想好的人
            if (!yes) { if ((M.strike?.[c.k] || -1) >= day(w)) mem(w, a, '同行的人罷工了，我沒有跟，照常去上工。', {}, 5); return { k: '照常上工' }; } if (!((M.strike?.[c.k] || -1) >= day(w))) return { k: '罷工已經結束了' };
            (M.strikers[c.k] = M.strikers[c.k] || []).push(a.agentId); mem(w, a, '我們{s}的人一起罷工，工資再這樣壓下去活不下去。', { s }, 7); return { k: '加入了罷工的隊伍' };
        }
        if (yes && W.yes.length >= need(W.n)) {
            const boss = w.agents[M0.ownerOf(w, c.k)]; const ys = W.yes.map(id => w.agents[id]).filter(x => x && !x.isDead);
            const lead = ys.slice().sort((x, y) => ((has(y, 'charismatic') ? 30 : 0) + (has(y, 'abrasive') ? 10 : 0) - aff(y, boss)) - ((has(x, 'charismatic') ? 30 : 0) + (has(x, 'abrasive') ? 10 : 0) - aff(x, boss)))[0];
            W.on = 1; W.lead = lead?.agentId || null; M0.walkStart(w, c.k, ys, lead, W.n, day(w)); st(w, 'strike');
            for (const id of W.no) { const o = w.agents[id]; if (!o) continue; if (lead) bump(lead, o, -5); if (boss) bump(boss, o, 3); mem(w, o, '同行的人罷工了，我沒有跟，照常去上工。', {}, 5); } // 沒有跟的人：帶頭的記著，東家也記著
            return { k: '罷工開始了' };
        }
        if (!W.fail && W.yes.length + W.no.length >= W.n) { W.fail = 1; st(w, 'fizzle');
            if (W.yes.length) { log(w, '😶 {s}有 {n} 個工人想罷工，站出來的人不夠，沒有罷成。', { s, n: W.yes.length }); for (const id of W.yes) mem(w, w.agents[id], '我想罷工，可是站出來的人不夠，只好算了。', {}, 5); }
            return yes ? { k: '站出來的人不夠，沒有罷成' } : { k: '照常上工' }; }
        return yes ? { k: '站出來了，看有多少人跟' } : { k: '照常上工' };
    }
    DECIDE.kind('wildcat', Object.assign({}, base, {
        title: '工資被壓，同行說要罷工', pri: 2.4, aiKind: 3,
        facts(w, a, c) { const I = walkInfo(w, a, c); if (!I) return ''; const s = MK().name(c.k);
            return fill('{o}把{s}的工資壓在行情的 {r}%{long}：你一天只領 {p} 銀幣，照行情該有 {f} 銀幣。{s}的 {m} 個工人私下在說要一起罷工兩天，逼{o}加薪；站出來的人這兩天沒有工資，要有 {q} 個人站出來才罷得成。你跟{o}{tie}。你身上有 {c} 銀幣。{union}', {
                o: I.boss.name, s: { raw: s }, r: Math.round(I.rate * 100), long: I.days >= 1 ? { k: '，已經 {n} 天了', p: { n: I.days } } : { raw: '' }, p: I.pay, f: I.full, m: I.W.n, q: need(I.W.n), tie: tie(w, a, I.boss), c: I.c,
                union: I.union ? { k: '鎮上有{u}，也可以去加入，讓工會出面談。', p: { u: { raw: I.union.name } } } : { raw: '' } }); },
        options(w, a, c) { const I = walkInfo(w, a, c); if (!I) return []; const mood = a.mood ?? 50; const b = I.boss;
            const out = [
                { id: 'out', text: '跟大家一起罷工兩天', say: '站出來罷工', why: '工資再這樣壓下去活不下去。', lean: { bond: 0.3, safe: -0.2 },
                    adj: clampN((0.7 - I.rate) / 0.2, 0, 1) * 0.4 + clampN((I.days - 21) / 28, 0, 1) * 0.3 + (mood < 35 ? 0.25 : mood > 65 ? -0.2 : 0) + (hungry(w, a) >= 2 ? 0.2 : 0) - clampN(aff(a, b) / 50, -1, 1) * 0.5 + (has(a, 'abrasive') ? 0.2 : 0) - (has(a, 'stoic') ? 0.15 : 0) - (has(a, 'shy') ? 0.15 : 0),
                    run: (w2, a2) => walkVote(w2, a2, c, true) },
                { id: 'bear', quiet: true, text: '再忍一忍，照常上工', say: '沒有跟著罷工', why: I.c < 6 ? '家裡等著這份工資。' : '跟東家鬧翻沒有好處。', lean: { safe: 0.3 },
                    adj: (I.c < 6 ? 0.35 : 0) + (kidsOf(w, a) ? 0.15 : 0) + (isFam(w, a, b) ? 1 : 0), run: (w2, a2) => walkVote(w2, a2, c, false) },
            ];
            if (I.union) { const X = I.union; const Ld = w.agents[X.leader];
                out.push({ id: 'union', text: { k: '不罷工，去加入{u}', p: { u: { raw: X.name } } }, say: { k: '加入{u}', p: { u: { raw: X.name } } }, why: '自己鬧沒有用，要有工會出面才談得動。', lean: { bond: 0.2 },
                    adj: clampN(aff(a, Ld) / 50, -1, 1) * 0.3 + Math.min(0.4, (X.won || 0) * 0.15),
                    run: (w2, a2) => { const r = walkVote(w2, a2, c, false); if (!r) return null; return UN().join(w2, a2) ? (st(w2, 'union'), { k: '成了會員' }) : { k: '沒加入成' }; } }); }
            return cal(out, I.union ? [0.5, 0.36, 0.14] : [0.55, 0.45]);
        },
    }));

    // ================= E. 罷工的人回來上工了：東家讓不讓 =================
    function endAsk(w, k, boss, d, until) {
        if (!inTown(w, boss) || jailed(w, boss)) return false; const M = MK().S(w); M.endQ = M.endQ || {}; M.endQ[k] = { d, until };
        st(w, 'endAsk'); DECIDE.askNow(w, [{ a: boss, kind: 'wildcatEnd', ctx: { k, d, until } }]); return true;
    }
    function endInfo(w, a, c) {
        const M0 = MK(); if (!c || !a || !M0 || !w.market || day(w) - (c.d ?? 0) > 2 || M0.ownerOf(w, c.k) !== a.agentId) return null;
        const M = M0.S(w); const Q = M.endQ?.[c.k]; if (!Q || Q.until !== c.until || Q.done) return null;
        const ws = wsOf(w, c.k); const ids = M.strikers?.[c.k]; const outs = ids ? ws.filter(x => ids.includes(x.agentId)) : ws; const W = M.walk?.[c.k];
        const lead = W?.lead && outs.find(x => x.agentId === W.lead) || null; const rate = M0.payRate(w, c.k); const want = Math.min(1.1, Math.round((rate + 0.15) * 100) / 100);
        const idx = typeof WALLET !== 'undefined' && WALLET.wageIdx ? WALLET.wageIdx() : 1; const bill = ws.reduce((s, x) => s + (WALLET.WAGE[x.job?.key] || 4), 0) * idx * 7;
        const h = M.hist?.[c.k] || []; const profit = h.reduce((s, [rv, cs]) => s + rv - cs, 0);
        return { Q, ws, outs, lead, rate, want, bill, profit, days: Math.max(0, day(w) - (M.low?.[c.k] ?? day(w))), c: Math.floor(cash(w, a)) };
    }
    DECIDE.kind('wildcatEnd', Object.assign({}, base, {
        title: '罷工的人回來上工了', pri: 2.6, aiKind: 2,
        facts(w, a, c) { const I = endInfo(w, a, c); if (!I) return ''; const s = { raw: MK().name(c.k) };
            return fill('{s}的 {n} 個工人罷工了兩天{lead}，剛回來上工。{s}的工資現在是行情的 {r}%{long}。讓步的話調到 {p}%，一週大約多付 {x} 銀幣。這一週{s}{profit}。你身上有 {c} 銀幣。不讓步的話工資照舊，可是只要還壓在七成以下，他們下禮拜可能再罷工。', {
                s, n: I.outs.length, lead: I.lead ? { k: '，帶頭的是{l}（你們{tie}）', p: { l: I.lead.name, tie: tie(w, a, I.lead) } } : { raw: '' }, r: Math.round(I.rate * 100), long: I.days >= 1 ? { k: '，已經 {n} 天了', p: { n: I.days } } : { raw: '' },
                p: Math.round(I.want * 100), x: Math.max(1, Math.round(I.bill * (I.want - I.rate))), profit: I.profit > 0 ? { k: '賺了 {n} 銀幣', p: { n: Math.round(I.profit) } } : { k: '虧了 {n} 銀幣', p: { n: Math.round(-I.profit) } }, c: I.c }); },
        options(w, a, c) { const I = endInfo(w, a, c); if (!I) return []; const M0 = MK(); const s = M0.name(c.k); const kind = has(a, 'kind'), greedy = has(a, 'greedy');
            const pay = I.profit > I.bill * 0.3 ? 0.2 : I.profit < 0 ? -0.4 : 0; const avg = I.outs.length ? I.outs.reduce((x, o) => x + aff(a, o), 0) / I.outs.length : 0;
            const done = (w2) => { const Q2 = M0.S(w2).endQ?.[c.k]; if (!Q2 || Q2.until !== c.until || Q2.done) return false; Q2.done = 1; return true; };
            const outs2 = (w2) => { const I2 = endInfo(w2, w2.agents[a.agentId], c); return I2 ? I2.outs : []; };
            const out = [
                { id: 'give', text: { k: '讓步，把工資調到 {p}%', p: { p: Math.round(I.want * 100) } }, say: '讓步加薪', why: '再鬧下去，虧的是我自己。', lean: { bond: 0.15, gain: -0.15 },
                    adj: (kind ? 0.5 : 0) + (has(a, 'generous') ? 0.2 : 0) - (greedy ? 0.4 : 0) - (has(a, 'abrasive') ? 0.2 : 0) + pay + (I.c > I.bill * 2 ? 0.15 : 0) + clampN(avg / 60, -0.3, 0.3),
                    run: (w2, a2) => { const os = outs2(w2); if (!done(w2)) return null; const nv = M0.giveIn(w2, c.k, a2); st(w2, 'give'); for (const o of os) { mem(w2, o, '罷工有用，{o}讓步加薪了。', { o: a2.name }, 6); bump(o, a2, 3); } mem(w2, a2, '工人罷工兩天，我讓步把{s}的工資調高了。', { s }, 6); return { k: '工資調到 {p}%', p: { p: Math.round(nv * 100) } }; } },
                { id: 'hold', text: '不讓步，工資照舊', say: '不肯讓步', why: I.profit < 0 ? '店都在虧，拿什麼加。' : '工資多少由我決定。', lean: { gain: 0.15 },
                    adj: (greedy ? 0.2 : 0) + (I.profit < 0 ? 0.3 : 0) - (kind ? 0.2 : 0),
                    run: (w2, a2) => { const os = outs2(w2); if (!done(w2)) return null; M0.holdOut(w2, c.k, a2); st(w2, 'hold'); for (const o of os) { mem(w2, o, '罷了兩天工，{o}還是不肯加薪。', { o: a2.name }, 6); bump(o, a2, -4); } return { k: '工人回去上工了' }; } },
            ];
            if (I.lead) { const l = I.lead;
                out.push({ id: 'fire', text: { k: '不讓步，還把帶頭的{l}開除', p: { l: l.name } }, say: { k: '開除帶頭罷工的{l}', p: { l: l.name } }, why: '殺雞儆猴，看誰還敢鬧。', lean: { face: 0.2, bond: -0.2 },
                    adj: (greedy ? 0.2 : 0) + (has(a, 'abrasive') ? 0.6 : 0) - (kind ? 1 : 0) + clampN(-aff(a, l) / 50, -0.5, 0.6) - (isFam(w, a, l) ? 1.5 : 0),
                    run: (w2, a2) => { const os = outs2(w2); const l2 = w2.agents[l.agentId]; if (!done(w2)) return null; if (!M0.sackLead(w2, c.k, a2, l2)) { M0.holdOut(w2, c.k, a2); st(w2, 'hold'); return { k: '工人回去上工了' }; } st(w2, 'fire');
                        for (const o of os) if (o !== l2) { mem(w2, o, '{o}把帶頭罷工的{l}開除了，大家敢怒不敢言。', { o: a2.name, l: l2.name }, 6); bump(o, a2, -8); } return { k: '{l}被開除了', p: { l: l2.name } }; } }); }
            return cal(out, I.lead ? [0.7, 0.22, 0.08] : [0.72, 0.28]);
        },
    }));

    // ================= F. 教團想請你當神職 =================
    const relName = (R) => (en() ? (R.name[1] || R.name[0]) : R.name[0]);
    function ordInfo(w, a, c) {
        const C0 = CL(); if (!c || !a || !C0 || !C0.on(w) || day(w) - (c.d ?? 0) > 2 || !inTown(w, a) || C0.isPriest(a) || a.job?.key === 'mayor' || isBoss(w, a)) return null;
        const R = (w.faith?.rels || []).find(x => x.id === c.r); if (!R || C0.relOf(w, a) !== R || C0.piety(w, a) < C0.CALL || (a.job && !C0.canQuit(w, a))) return null;
        const C = C0.S(w); if (C.no?.[a.agentId] > day(w) || C0.priestsOf(w, R).length >= C0.cap(w, R)) return null;
        const L = LB(); const since = L.S(w).jobless[a.agentId];
        return { R, C, piety: Math.round(C0.piety(w, a)), pay: L.payOf(w, 'priest'), cur: a.job ? L.payOf(w, a.job.key) : 0, short: !!C0.short(w, R), since, c: Math.floor(cash(w, a)) };
    }
    function ordainAsk(w, a, R, d) { if (!inTown(w, a)) return false; st(w, 'ordAsk'); DECIDE.askNow(w, [{ a, kind: 'ordain', ctx: { r: R.id, d } }]); return true; }
    DECIDE.kind('ordain', Object.assign({}, base, {
        title: '教團想請你當神職', pri: 1.8, aiKind: 2,
        facts(w, a, c) { const I = ordInfo(w, a, c); if (!I) return '';
            return fill('{r}的奉獻養得起多一位神職，大家想到你（你的虔誠度 {p}）。當神職一天大約領 {x} 銀幣，是教團從奉獻裡發的{short}。{now}你身上有 {c} 銀幣。', {
                r: { raw: relName(I.R) }, p: I.piety, x: I.pay, short: I.short ? '；這幾天奉獻不夠，神職的薪水發不齊' : '；奉獻不夠的時候會領不到',
                now: a.job ? { k: '你現在是{j}，一天大約領 {y} 銀幣；去當神職就要放下這份工作。', p: { j: jobT(a.job.key), y: I.cur } } : I.since != null ? { k: '你已經 {n} 天沒有工作了。', p: { n: Math.max(0, day(w) - I.since) } } : '你現在沒有工作。', c: I.c }); },
        options(w, a, c) { const I = ordInfo(w, a, c); if (!I) return []; const R = I.R; const d0 = day(w);
            return cal([
                { id: 'yes', text: { k: '去當神職，服事{r}', p: { r: { raw: relName(R) } } }, say: '答應去當神職', why: '這是我該走的路。', lean: { bond: 0.2, gain: -0.2 },
                    adj: clampN((I.piety - 85) / 15, -1, 1) * 0.3 + (has(a, 'ascetic') ? 0.3 : 0) - (has(a, 'greedy') ? 0.3 : 0) - (hasV(a, '財富') ? 0.3 : 0) - (I.short ? 0.4 : 0)
                        + (a.job ? -clampN((I.cur - I.pay) / Math.max(1, I.pay), -0.5, 1) * 0.6 - love(a, a.job.key) : (I.c < 10 ? 0.2 : 0) + (I.since != null && d0 - I.since >= 14 ? 0.2 : 0)),
                    run: (w2, a2) => { const I2 = ordInfo(w2, a2, c); if (!I2) return { k: '晚了一步，教團已經不缺人了' }; if (!CL().take(w2, I2.C, I2.R, a2)) return null; st(w2, 'ordYes'); return { k: '成了{r}的神職', p: { r: { raw: relName(I2.R) } } }; } },
                { id: 'no', quiet: true, text: a.job ? '留在原本的工作' : '不去，另外找工作', say: '沒有答應去當神職', why: a.job ? '信仰放在心裡就好，飯碗不能丟。' : '我想找別的工作。', lean: { safe: 0.2 },
                    run: (w2, a2) => { const C = CL().S(w2); (C.no = C.no || {})[a2.agentId] = day(w2) + 28; st(w2, 'ordNo'); mem(w2, a2, '{r}想請我當神職，我沒有答應。', { r: R.name[0] }, 4); try { w2.logMessageT?.('social', '⛪ {r}想請{a}當神職，{a}沒有答應。', { r: R.name[0], a: a2.name }, a2.name); } catch (e) {} return { k: '沒有去' }; } },
            ], a.job ? [0.5, 0.5] : [0.85, 0.15]);
        },
    }));

    DECIDE.jobs = true; // 其他系統看到這個，就知道求職、轉行、公家的裁員、沒有工會的罷工、當不當神職交給本人決定
    return { on, seek, seekInfo, switchAsk, switchInfo, publicJob, headOf, cutAsk, cutInfo, walkAsk, walkInfo, walkVote, need, endAsk, endInfo, ordainAsk, ordInfo };
})();
if (typeof globalThis !== 'undefined') globalThis.JOBS = JOBS;
