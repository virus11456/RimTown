// RimTown - sim-decide-life.js：v9.22.0 決策核心階段 4（自己的事）
// 以前：當家賣不賣股份、股東退不退股、要不要翻修房子、要不要奉獻、記恨的人要不要動手、要不要開店、被挖角走不走，都是各系統擲骰決定的
//       （例如「有錢就每天 35% 機率翻修」「每天 15% 機率有人創業」「被挖角 50% 機率留下」）。
// 現在：這些事由本人決定。各系統只說「他現在遇到什麼事、做得到哪幾件事」和「做了之後怎麼結算」：
//   有人想買你的股份(sell)          賣／不賣                              ← 當家；有人來談入股時才會遇到
//   手上的股份分紅不如銀行(cashout)  繼續拿著／賣掉存銀行
//   家裡的房子舊了(renovate)        先不翻修／自己出錢翻修／跟銀行借錢翻修
//   要不要奉獻(tithe)               先不奉獻／隨手奉獻／大筆捐獻
//   跟某人結怨很深(scheme)          忍著／栽贓／破壞他的工作／私下拉票／搶功
//   想不想自己開店(startup)         再想想／開店
//   別鎮開高薪來挖角(poach)         留下／搬過去                          ← 對手鎮來挖角時才會遇到
// 結算全部在原本的系統裡（sim-invest.js、sim-shares.js、sim-housing.js、sim-bank.js、sim-faith.js、sim-dark.js、sim-biz.js、sim-rival.js），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數（個性、處境、交情），不是固定機率。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const ok = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const log = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, p || {}, who || ''); } catch (e) {} };
    const amb = (w, a) => w.mind?.amb?.[a.agentId]?.key || '';
    const pct1 = (y) => Math.round(y * 1000) / 10;
    // 交情用一句話講(給帳本看)
    const tie = (a, b) => { const v = aff(a, b); return v >= 40 ? '交情很好' : v >= 10 ? '還算熟' : v > -10 ? '沒什麼交情' : '處不來'; };
    const IV = () => (typeof INVEST !== 'undefined' ? INVEST : null);
    const SH = () => (typeof SHARES !== 'undefined' ? SHARES : null);
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    DECIDE.life = true; // 其他系統看到這個，就知道這些事交給本人決定、不擲骰

    // ================= 股份 =================
    // ---------- 有人想買你的股份：賣不賣 ----------
    // 來談的人有兩種：算過分紅比利息好、拿存款來入股的(src: inv)；看生意好眼紅、出高價的(src: envy)
    function sellInfo(w, a, ctx) {
        const S = SH(); if (!S || !w.market || S.S(w).owners[ctx.k] !== a.agentId) return null;
        if (ctx.src === 'envy') { const I = S.askInfo(w, ctx.k); return I && I.fan.agentId === ctx.by ? { b: I.fan, p: Math.min(I.pct, I.mine - 30), price: I.price, mine: I.mine } : null; }
        const I = IV()?.askInfo(w, ctx.k); return I && I.a.agentId === ctx.by ? { b: I.a, p: I.q.p, price: I.q.price, mine: S.stakes(w, ctx.k)[a.agentId] || 0 } : null;
    }
    // 談的人已經不買了(錢花掉了、人不在了)：把那筆邀約清掉，免得擋住別人來談
    function sellDrop(w, ctx) { try { const X = ctx.src === 'envy' ? SH().S(w).sh : IV().S(w); if (X.ask?.[ctx.k]?.by === ctx.by) delete X.ask[ctx.k]; } catch (e) {} }
    DECIDE.kind('sell', {
        title: '有人想買你的股份', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) {
            const I = sellInfo(w, a, ctx); if (!I) return '';
            return fill('{b}想出 {n} 銀幣，買你在{s}的 {p}% 股份（你現在有 {m}%，賣了以後你還是當家，但每週的分紅要分他一份）。{why}{s}這一週賺了 {x} 銀幣。你身上有 {c} 銀幣；你跟{b}{tie}。',
                { b: I.b.name, n: I.price, s: MK().name(ctx.k), p: I.p, m: I.mine, why: ctx.src === 'envy' ? '他是看這家生意好，開的價比行情高。' : '他算過，這家的分紅比銀行利息好。', x: Math.round(SH().profit7(w, ctx.k)), c: Math.floor(cash(w, a)), tie: tie(a, I.b) });
        },
        options(w, a, ctx) {
            const I = sellInfo(w, a, ctx); if (!I || !(I.p > 0)) { sellDrop(w, ctx); return []; } const sName = MK().name(ctx.k); const envy = ctx.src === 'envy';
            const settle = (yes) => (envy ? SH().answerBuy(w, ctx.k, yes) : IV().answer(w, ctx.k, yes));
            return [
                { id: 'yes', text: { k: '賣給{b}，收下 {n} 銀幣', p: { b: I.b.name, n: I.price } }, say: { k: '把{s} {p}% 的股份賣給{b}', p: { s: sName, p: I.p, b: I.b.name } }, why: '手上多一筆現錢，生意的風險也有人分擔',
                    base: 0.6 + (cash(w, a) < 30 ? 0.9 : 0) + (has(a, 'greedy') ? 0.5 : 0) + clampN(aff(a, I.b) / 60, -1, 1) * 0.6 - (envy ? 0.1 : 0), lean: { gain: 0.4 },
                    run: () => (settle(true) === 'sold' ? { k: '成交，收下 {n} 銀幣', p: { n: I.price } } : { k: '後來沒談成' }) },
                { id: 'no', text: '不賣', say: { k: '不肯把{s}的股份賣給{b}', p: { s: sName, b: I.b.name } }, why: '這是我一手做起來的',
                    base: 0.85 + (has(a, 'stubborn') || hasV(a, '傳統') ? 0.6 : 0), lean: { safe: 0.3 },
                    run: () => { settle(false); return { k: '回絕了' }; } },
            ];
        },
    });

    // ---------- 手上的股份分紅不如銀行：要不要退 ----------
    DECIDE.kind('cashout', {
        title: '手上的股份分紅不如銀行', cool: 7, pri: 1,
        when(w, a) { const V = IV(); if (!V || !w.market || !DECIDE.on(w)) return null; const L = V.lowOf(w, a); return L ? { k: L.k } : null; },
        facts(w, a, ctx) {
            const L = IV().lowOf(w, a); if (!L || L.k !== ctx.k) return '';
            return fill('你在{s}有 {p}% 股份。這家的分紅已經連續 {n} 週不如銀行：照現在的行情一週大約 {y}%，銀行存款一週 {r}%。現在賣可以拿回 {m} 銀幣（{b}願意接手）。當家是{o}，你跟他{tie}。',
                { s: MK().name(L.k), p: L.p, n: L.weeks, y: pct1(L.y) || 0, r: pct1(L.by), m: L.price, b: L.buyer.name, o: L.boss.name, tie: tie(a, L.boss) });
        },
        options(w, a, ctx) {
            const V = IV(); const L = V?.lowOf(w, a); if (!L || L.k !== ctx.k) return []; const sName = MK().name(L.k);
            return [
                { id: 'keep', quiet: true, mute: true, text: '繼續拿著，等生意好轉', why: '生意有起有落', base: 1.0 + clampN(aff(a, L.boss) / 60, -1, 1) * 0.5 + (has(a, 'stubborn') ? 0.3 : 0) + (has(a, 'optimist') ? 0.3 : 0), lean: { bond: 0.2, safe: 0.1 }, run: () => null },
                { id: 'out', text: { k: '把股份賣掉，{m} 銀幣存進銀行', p: { m: L.price } }, say: { k: '賣掉{s}的股份，把錢存進銀行', p: { s: sName } }, why: '分紅還不如利息，錢放銀行比較實在',
                    base: 0.9 + Math.min(0.6, (L.weeks - 3) * 0.2) + (has(a, 'thrifty') ? 0.3 : 0), lean: { safe: 0.3, gain: 0.2 },
                    run: (w, a) => (V.cashOut(w, npcs(w), L.k, a.agentId) ? { k: '賣了 {m} 銀幣，存進銀行', p: { m: L.price } } : { k: '沒賣成' }) },
            ];
        },
    });

    // ================= 房子 =================
    // ---------- 家裡的房子舊了：要不要翻修 ----------
    const HS = () => (typeof HOUSING !== 'undefined' ? HOUSING : null);
    const envied = (w, home) => { try { return typeof WAYS !== 'undefined' && !!WAYS.envied?.(w, home); } catch (e) { return false; } };
    // 手頭不夠時，銀行借不借得到：回傳要借多少(借不到是 0)
    function renoLoan(w, a, cost) {
        if (typeof BANK === 'undefined' || !w.bank) return 0; const B = BANK.S(w); if (!B.open || B.status === 'run' || B.loans?.[a.agentId]) return 0;
        const need = Math.ceil(cost * 1.2 - cash(w, a) + 5); return need >= 5 && BANK.lendable(B) >= need ? need : 0;
    }
    function renoInfo(w, a) {
        const H = HS(); if (!H || !DECIDE.on(w)) return null; const I = H.info(w, a); if (!I || I.lack) return null;
        const c = cash(w, a); const can = c >= I.cost * 1.2; const loan = can ? 0 : renoLoan(w, a, I.cost); if (!can && !loan) return null;
        return { ...I, c, can, loan, envy: envied(w, I.home) };
    }
    DECIDE.kind('renovate', {
        title: '家裡的房子舊了', cool: 5, pri: 0.8,
        when(w, a) { const I = renoInfo(w, a); return I ? { h: I.home } : null; },
        facts(w, a, ctx) {
            const I = renoInfo(w, a); if (!I) return ''; const H = HS();
            return fill('你家現在是{s0}，鎮上已經蓋得起{s1}。翻修要 {n} 銀幣（跟鎮上買料）。你身上有 {c} 銀幣。{short}{fam}{envy}',
                { s0: H.STYLE[I.lv], s1: I.style, n: I.cost, c: Math.floor(I.c), short: I.can ? { raw: '' } : '錢不夠，要翻修得跟銀行借。', fam: I.people.length > 1 ? { k: '家裡住了 {k} 個人。', p: { k: I.people.length } } : { raw: '' }, envy: I.envy ? '隔壁最近翻修好了，你看了心裡不是滋味。' : { raw: '' } });
        },
        options(w, a, ctx) {
            const I = renoInfo(w, a); if (!I) return []; const H = HS(); const asc = has(a, 'ascetic'), thr = has(a, 'thrifty');
            const out = [{ id: 'wait', quiet: true, mute: true, text: '先不翻修，房子還能住', why: '錢要留著應急', base: 1.0 + (thr ? 0.4 : 0) + (asc ? 0.8 : 0), lean: { safe: 0.3 }, run: () => null }];
            if (I.can) out.push({ id: 'pay', text: { k: '花 {n} 銀幣把家翻修成{s}', p: { n: I.cost, s: I.style } }, say: { k: '出錢把家翻修成{s}', p: { s: I.style } }, why: '住得好一點，家人也舒服',
                base: 1.1 + Math.min(0.6, (I.c / I.cost - 1.2) * 0.5) + (I.envy ? 0.5 : 0) + (I.people.length > 1 ? 0.2 : 0) - (asc ? 1.0 : 0) - (thr ? 0.3 : 0), lean: { face: 0.4 },
                run: (w, a) => { const r = H.renovateBy(w, a); return r === true ? { k: '家翻修成{s}了', p: { s: I.style } } : r === 'mat' ? { k: '鎮上的料不夠，只好先等' } : null; } });
            else out.push({ id: 'loan', text: { k: '跟銀行借 {n} 銀幣來翻修', p: { n: I.loan } }, say: '跟銀行借錢翻修房子', why: I.envy ? '不能輸給隔壁' : '先住得好一點，錢慢慢還',
                base: 0.2 + (I.envy ? 0.9 : 0) + (has(a, 'jealous') ? 0.3 : 0) - (asc ? 1.5 : 0) - (thr ? 0.5 : 0), lean: { face: 0.5, safe: -0.5 },
                run: (w, a) => {
                    const got = BANK.lend(w, BANK.S(w), a, I.loan, t(I.envy ? '跟鄰居一樣翻修房子' : '翻修房子')); if (!got) return { k: '銀行沒有借' };
                    if (I.envy) { try { WAYS.envyBorrowed(w, I.home); } catch (e) {} log(w, 'economy', '🏦 {a}為了把家翻修得跟鄰居一樣，跟銀行借了 {n} 銀幣。', { a: a.name, n: got }, a.name); }
                    return H.renovateBy(w, a) === true ? { k: '借了 {n} 銀幣，家翻修成{s}了', p: { n: got, s: I.style } } : { k: '借到 {n} 銀幣，還沒動工', p: { n: got } };
                } });
            return out;
        },
    });

    // ================= 信仰 =================
    // ---------- 要不要奉獻 ----------
    const FT = () => (typeof FAITH !== 'undefined' ? FAITH : null);
    const titheInfo = (w, a) => { const F = FT(); if (!F || !w.faith || !DECIDE.on(w)) return null; const I = F.giftInfo(w, a); return I && I.piety >= 45 ? I : null; };
    DECIDE.kind('tithe', {
        title: '要不要奉獻', cool: 7, pri: 0.5,
        when(w, a) { return titheInfo(w, a) ? {} : null; },
        facts(w, a) {
            const I = titheInfo(w, a); if (!I) return '';
            return fill('你信{r}（虔誠 {p}／100）。你身上有 {c} 銀幣。教團的基金現在有 {f} 銀幣，用在場所維護、節日辦桌和救濟窮人。{big}', { r: I.R.name[0], p: Math.round(I.piety), c: Math.floor(I.cash), f: Math.round(I.R.fund || 0), big: I.big ? '捐得多，神職和同信仰的人會對你另眼相看。' : { raw: '' } });
        },
        options(w, a) {
            const I = titheInfo(w, a); if (!I) return []; const F = FT(); const rn = I.R.name[0];
            const out = [
                { id: 'skip', quiet: true, mute: true, text: '這陣子先不奉獻', why: '心意到了就好', base: 1.3 + (has(a, 'greedy') ? 0.5 : 0) + (has(a, 'thrifty') ? 0.2 : 0), lean: { safe: 0.2 }, run: () => null },
                { id: 'small', quiet: true, text: { k: '奉獻 {n} 銀幣', p: { n: I.small } }, say: { k: '奉獻 {n} 銀幣給{r}', p: { n: I.small, r: rn } }, why: '該盡的心意', base: 0.1 + I.piety / 40 + (has(a, 'kind') ? 0.3 : 0), lean: { bond: 0.2 },
                    run: (w, a) => { const n = F.donate(w, a, false); return n ? { k: '奉獻了 {n} 銀幣', p: { n } } : null; } },
            ];
            if (I.big) out.push({ id: 'big', text: { k: '捐 {n} 銀幣，讓大家都看見', p: { n: I.big } }, say: { k: '捐 {n} 銀幣給{r}', p: { n: I.big, r: rn } }, why: '錢財是身外之物，捐了大家也敬重',
                base: -0.4 + I.piety / 60 + Math.min(0.6, (I.cash - 150) / 300) + (has(a, 'charismatic') ? 0.2 : 0) - (has(a, 'greedy') ? 0.6 : 0), lean: { face: 0.6, gain: -0.3 },
                run: (w, a) => { const n = F.donate(w, a, true); return n ? { k: '捐了 {n} 銀幣，大家看他的眼神不一樣了', p: { n } } : null; } });
            return out;
        },
    });

    // ================= 陰謀 =================
    // ---------- 跟某人結怨很深：要不要動手 ----------
    const DK = () => (typeof DARK !== 'undefined' ? DARK : null);
    const SCHEME = {
        frame: { text: '栽贓：拿走公庫的錢，讓大家以為是{v}拿的', say: '暗中栽贓給{v}', off: -0.3 },
        sabotage: { text: '偷偷破壞{v}的工作', say: '暗中破壞{v}的工作', off: -0.1 },
        lobby: { text: '私下拉票，讓{v}的提案過不了', say: '私下拉票擋掉{v}的提案', off: 0.2 },
        credit: { text: '到處說{v}的提案其實是你的主意', say: '搶走{v}的功勞', off: 0.1 },
    };
    function schemeInfo(w, a) {
        const D = DK(); if (!D || !DECIDE.on(w) || D.malice(a) < 1 || D.honesty(a) > 3) return null;
        const I = D.schemeInfo(w, a); return I && ok(w, I.v) ? I : null;
    }
    DECIDE.kind('scheme', {
        title: '跟某人結怨很深', cool: 7, pri: 1,
        when(w, a) { const I = schemeInfo(w, a); return I ? { v: I.v.agentId } : null; },
        facts(w, a, ctx) {
            const I = schemeInfo(w, a); if (!I || I.v.agentId !== ctx.v) return '';
            return fill('你跟{v}結怨很深（{why}）。你可以暗中對付他；做了以後可能被人拆穿，到時候名聲會壞掉。', { v: I.v.name, why: { k: DK().WHY[I.why] || DK().WHY.dislike, p: { v: I.v.name } } });
        },
        options(w, a, ctx) {
            const D = DK(); const I = schemeInfo(w, a); if (!I || I.v.agentId !== ctx.v) return []; const m = D.malice(a), h = D.honesty(a), v = I.v;
            const out = [{ id: 'hold', quiet: true, mute: true, text: '忍著，不動手', why: '做了會被人看不起', base: 1.5 + (has(a, 'stoic') ? 0.3 : 0), lean: { safe: 0.3, bond: 0.2 }, run: () => null }];
            for (const k of I.kinds) { const C = SCHEME[k]; if (!C) continue;
                out.push({ id: k, text: { k: C.text, p: { v: v.name } }, say: { k: C.say, p: { v: v.name } }, why: '這口氣吞不下去', base: -0.45 + C.off + m * 0.45 + (I.s - 50) / 50 - (h - 2) * 0.6, lean: { face: 0.2, bond: -0.5 },
                    run: (w, a) => (D.plot(w, a, v, k, I.why) ? { k: '開始盤算怎麼對付{v}', p: { v: v.name } } : null) }); }
            return out;
        },
    });

    // ================= 開店 =================
    // ---------- 想不想自己開店 ----------
    const BZ = () => (typeof BIZ !== 'undefined' ? BIZ : null);
    const startInfo = (w, a) => { const B = BZ(); return B && DECIDE.on(w) ? B.startInfo(w, a) : null; };
    const START_WHY = { full: '鎮上的店已經夠多了，沒開成', noloan: '銀行借不到錢，沒開成', wait: '去銀行談開店的貸款了，等銀行家回話', nocash: '本錢沒湊齊，沒開成', gone: '情況變了，這次沒開成' };
    DECIDE.kind('startup', {
        title: '想不想自己開店', cool: 10, pri: 1.2,
        when(w, a) { return startInfo(w, a) ? {} : null; },
        facts(w, a) {
            const I = startInfo(w, a); if (!I) return '';
            return fill('鎮上現在有 {k} 家店，還容得下新店。你想開的是{ty}，本錢 {n} 銀幣；你身上有 {c} 銀幣。{how}開了店每天有進帳，但生意不好也可能撐不下去。',
                { k: BZ().S(w).shops.length, ty: I.type, n: I.cost, c: Math.floor(cash(w, a)), how: I.partner ? { k: '本錢不夠，{p}願意合夥出一部分。', p: { p: I.partner.name } } : I.loan ? (I.loanAsk ? '本錢不夠，得跟銀行借，銀行家不一定答應。' : '本錢不夠，得跟銀行借。') : { raw: '' } });
        },
        options(w, a) {
            const I = startInfo(w, a); if (!I) return []; const B = BZ();
            return [
                { id: 'wait', quiet: true, mute: true, text: '再想想，先做好現在的工作', why: '現在的日子過得去', base: 1.5, lean: { safe: 0.4 }, run: () => null },
                { id: 'open', text: { k: '開一家{ty}', p: { ty: I.type } }, why: '替別人做事，不如自己當老闆',
                    base: 0.4 + (amb(w, a) === 'rich' ? 0.7 : 0) + (has(a, 'creative') ? 0.4 : 0) + (a.job?.key === 'trader' ? 0.5 : 0) + Math.min(0.5, cash(w, a) / 150) - (I.loan ? 0.3 : 0), lean: { gain: 0.6, safe: -0.4 },
                    // v9.30.0 沒開成的原因照實寫(以前一律寫「本錢沒湊齊」):店位滿了、銀行借不到、還在等銀行家回話、情況變了
                    run: (w, a) => { const R = B.startTry ? B.startTry(w, a) : { shop: B.start(w, a) }; return { k: R.shop ? '店開張了' : (START_WHY[R.why] || '本錢沒湊齊，沒開成') }; } },
            ];
        },
    });

    // ================= 挖角 =================
    // ---------- 別鎮開高薪來挖角：走不走 ----------
    const RV = () => (typeof RIVAL !== 'undefined' ? RIVAL : null);
    DECIDE.kind('poach', {
        title: '別鎮開高薪來挖角', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) {
            const I = RV()?.poachInfo(w, ctx.pid); if (!I) return ''; const pr = a.relationships?.getPartner?.(); const partner = pr && w.agents[pr.targetId];
            const friends = npcs(w).filter(o => o !== a && aff(a, o) >= 40).length;
            return fill('{p}開高薪想挖你過去，看上的是你的{s}手藝。我們鎮繁榮 {u}，他們 {h}。{fam}鎮上跟你交情好的有 {k} 人。你身上有 {c} 銀幣。走了就是搬離這個鎮。',
                { p: I.name, s: ctx.skill, u: I.us, h: I.them, fam: partner ? { k: '你的伴侶{x}在這裡。', p: { x: partner.name } } : { raw: '' }, k: friends, c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const R = RV(); const I = R?.poachInfo(w, ctx.pid); if (!I || !ok(w, a)) return []; const mood = a.mood ?? 50; const partner = !!a.relationships?.getPartner?.();
            const friends = npcs(w).filter(o => o !== a && aff(a, o) >= 40).length;
            const out = [{ id: 'stay', text: '留下來', say: { k: '婉拒{p}的挖角', p: { p: I.name } }, why: '這裡是我的家',
                base: 0.85 + (partner ? 0.45 : 0) + Math.min(0.4, friends * 0.08) + (mood >= 60 ? 0.25 : 0) - (mood < 35 ? 0.4 : 0) + (I.rel <= -30 ? 0.3 : 0) + (has(a, 'stoic') ? 0.2 : 0), lean: { bond: 0.5, safe: 0.3 },
                run: (w, a) => (R.poachAnswer(w, a, ctx.pid, ctx.skill, false) ? { k: '留下來了' } : null) }];
            if (I.canLeave) out.push({ id: 'go', text: { k: '答應，搬去{p}', p: { p: I.name } }, say: { k: '答應{p}的挖角', p: { p: I.name } }, why: '那邊給得多，機會也多',
                base: 1.0 + (I.them > I.us + 10 ? 0.25 : 0) + (has(a, 'greedy') ? 0.4 : 0) + (has(a, 'jealous') ? 0.15 : 0) + (cash(w, a) < 15 ? 0.3 : 0) + (amb(w, a) === 'rich' ? 0.3 : 0), lean: { gain: 0.6 },
                run: (w, a) => (R.poachAnswer(w, a, ctx.pid, ctx.skill, true) === 'gone' ? { k: '搬走了' } : null) });
            return out;
        },
    });
})();
