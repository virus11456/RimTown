// RimTown - sim-decide-fun.js：v9.25.0 決策核心批次 C（花錢與享樂）
// 以前：手頭寬的人每天 45% 機率去買點好東西、看表演 14% 機率丟賞錢、名匠每週 30% 機率有人來訂做、敗家子每三天 12% 揮霍、
//       賭場每個人每天照「賭性」擲骰去不去、押多少也是擲骰、沒錢翻本就自動去借、賭債還不出來 50% 去偷 30% 跑路、
//       每天 4% 機率有人開賭場、每天 15% 機率最有錢的人買爵位、等移植的有錢人 15% 機率塞紅包插隊、提案人 35% 機率自掏腰包。
// 現在：這些事由本人決定。各系統只說「他現在做得到哪幾件事」和「做了之後怎麼結算」：
//   平常怎麼花錢(habit)                能省就省／偶爾花一點／想買就買      ← 定下來以後，買東西和賞錢都照這個習慣，不再擲骰
//   要不要找名匠訂做(bespoke)           不訂／訂一件
//   手上有閒錢(spare) 多一個選項        痛快花一筆
//   今晚要不要去賭場(gamble)            不去／小玩一把／押大的／全押翻本／跟銀行借了再押／跟莊家賒了再押
//   賭債拖了三週還不出來(gamedebt)       繼續躲／偷別人的錢來還／連夜跑路
//   在賭場輸到一無所有(ruined)          留下來從頭再來／連夜離開            ← 由賭場那邊引發
//   要不要開賭場(opencasino)            不開／開
//   要不要花錢買爵位(title)             不買／買
//   等移植，要不要塞紅包插隊(bribe)      照規矩排隊／塞紅包
//   提案的錢誰出(fund)                  自己掏腰包／找朋友湊／讓公庫出      ← 提案的當下就問
// 賭桌上的輸贏仍然是運氣；結算全部在原本的系統裡（sim-wallet.js、sim-spend.js、sim-mobility.js、sim-class.js、sim-health.js），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數（個性、處境、交情），不是固定機率。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => o.name).join(t('、'));
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const CS = () => (typeof CASINO !== 'undefined' ? CASINO : null);
    const MB = () => (typeof MOBILITY !== 'undefined' ? MOBILITY : null);
    const CL = () => (typeof CLASS !== 'undefined' ? CLASS : null);
    const HL = () => (typeof HEALTH !== 'undefined' ? HEALTH : null);
    const on = (M, w) => { try { return !!M && !!M.byFun && M.byFun(w); } catch (e) { return false; } };
    DECIDE.fun = true; // 其他系統看到這個，就知道花錢與享樂的事交給本人決定、不擲骰

    // ================= 平常怎麼花錢 =================
    const HNAME = { frugal: '能省就省', normal: '偶爾花一點', indulge: '想買就買' };
    const habitInfo = (w, a) => { const W = WL(); return on(W, w) && w.wallet ? W.habitInfo(w, a) : null; };
    DECIDE.kind('habit', {
        title: '平常怎麼花錢', cool: 30, pri: 0.4,
        when(w, a) { const I = habitInfo(w, a); return I ? { c: I.bal } : null; },
        facts(w, a) {
            const I = habitInfo(w, a); if (!I) return '';
            return fill('你身上有 {c} 銀幣，吃穿之外還有餘裕。平常要不要上酒館、買點好東西（一次大概花 {n} 銀幣，錢是花給鎮上店家的），廣場有人表演時要不要丟賞錢，看你自己的習慣。{cur}',
                { c: I.bal, n: I.once, cur: I.cur ? { k: '你現在的習慣是「{x}」。', p: { x: HNAME[I.cur] } } : { raw: '' } });
        },
        options(w, a) {
            const W = WL(); const I = habitInfo(w, a); if (!I) return []; const set = (k) => (w2, a2) => (W.habitSet(w2, a2, k) ? null : { k: '沒有改' });
            return [
                { id: 'frugal', quiet: true, mute: I.cur === 'frugal', text: '能省就省，除了吃穿不亂花（大概一週才花一次，表演不給賞錢）', say: '決定平常能省就省', why: '錢要留著，以後用得到',
                    base: 1.0 + (has(a, 'greedy') ? 0.6 : 0) + (has(a, 'ascetic') ? 0.7 : 0) + (has(a, 'stoic') ? 0.3 : 0), lean: { safe: 0.5 }, run: set('frugal') },
                { id: 'normal', quiet: true, mute: I.cur === 'normal', text: '偶爾上酒館、買點喜歡的東西（大概兩天一次，熟人表演才給賞錢）', say: '決定平常偶爾花一點', why: '賺了錢，偶爾也要對自己好一點',
                    base: 1.5, lean: { joy: 0.2, safe: 0.15 }, run: set('normal') },
                { id: 'indulge', quiet: true, mute: I.cur === 'indulge', text: '想買就買，該享受就享受（幾乎天天花，看表演都給賞錢）', say: '決定想買就買、好好享受', why: '錢賺了就是要花',
                    base: 0.5 + (has(a, 'glutton') ? 0.6 : 0) + (has(a, 'optimist') ? 0.3 : 0) + (has(a, 'romantic') ? 0.3 : 0) + (has(a, 'generous') ? 0.3 : 0) + Math.min(0.5, I.bal / 800), lean: { joy: 0.6, face: 0.2, safe: -0.4 }, run: set('indulge') },
            ];
        },
    });

    // ================= 要不要找名匠訂做 =================
    const commInfo = (w, a) => { const M = MB(); return on(M, w) && w.wallet ? M.commInfo(w, a) : null; };
    DECIDE.kind('bespoke', {
        title: '要不要找名匠訂做', cool: 3, pri: 0.9, // 有錢的客人不多，問得勤一點，名匠才接得到跟以前差不多的訂單(一位名匠一週還是只接一件)
        when(w, a) { const I = commInfo(w, a); return I ? { m: I.m.agentId } : null; },
        facts(w, a) {
            const I = commInfo(w, a); if (!I) return '';
            return fill('鎮上的{j}名匠{m}手藝是公認最好的，一週只接一件訂做。你身上有 {c} 銀幣，請他做一件要 {n} 銀幣（錢是付給他本人的）。', { j: { raw: I.job }, m: I.m.name, c: I.c, n: I.fee });
        },
        options(w, a) {
            const M = MB(); const I = commInfo(w, a); if (!I) return [];
            return [
                { id: 'pass', quiet: true, mute: true, text: '不訂，現在用的就夠了', say: '沒有找名匠訂做', why: '東西能用就好，不必講究', base: 1.4 + (has(a, 'ascetic') || has(a, 'greedy') ? 0.5 : 0), lean: { safe: 0.4 }, run: () => null },
                { id: 'order', quiet: true, text: { k: '花 {n} 銀幣請名匠{m}做一件', p: { n: I.fee, m: I.m.name } }, say: { k: '找名匠{m}訂做東西', p: { m: I.m.name } }, why: '好東西值得花錢，用起來也有面子',
                    base: 1.5 + clampN(aff(a, I.m) / 80, -0.3, 0.4), lean: { face: 0.5, joy: 0.2, safe: -0.3 },
                    run: (w2, a2) => { const got = M.commBy(w2, a2, I.m.agentId); return got ? { k: '請{m}做了一件，付了 {n} 銀幣', p: { m: I.m.name, n: got } } : { k: '沒談成' }; } },
            ];
        },
    });

    // ================= 手上有閒錢：多一個選項（痛快花一筆） =================
    { const K = DECIDE.KINDS.spare;
      if (K && !K._fun) { K._fun = true; const _opts = K.options;
        K.options = function (w, a, ctx) {
            const out = _opts.call(this, w, a, ctx) || []; const M = MB(); if (!on(M, w)) return out;
            try { const I = M.spreeInfo(w, a); if (I) out.push({ id: 'spree', text: { k: '痛快花一筆：請客、買一堆喜歡的東西，大概花掉 {n} 銀幣', p: { n: I.n } }, say: '痛快花了一筆', why: '錢就是拿來花的，省給誰看',
                base: 1.3, lean: { joy: 0.8, face: 0.3, safe: -0.5 },
                run: (w2, a2) => { const got = M.spreeBy(w2, a2); return got ? { k: '花掉了 {n} 銀幣', p: { n: got } } : { k: '沒花成' }; } }); } catch (e) {}
            return out;
        }; } }

    // ================= 賭場 =================
    const goInfo = (w, a) => { const C = CS(); return on(C, w) && w.casino ? C.goInfo(w, a) : null; };
    const betRes = (r) => !r ? { k: '沒賭成' } : r.res === 'nobank' ? { k: '銀行不肯借' } : r.res === 'nocredit' ? { k: '莊家不肯賒' } : r.res === 'jack' ? { k: '中了大獎，贏了 {n} 銀幣', p: { n: Math.round(r.pay) } } : r.res === 'win' ? { k: '贏了 {n} 銀幣', p: { n: Math.round(r.pay) } } : { k: '輸了 {n} 銀幣', p: { n: Math.round(r.stake) } };
    DECIDE.kind('gamble', {
        title: '今晚要不要去賭場', cool: 4, pri: 0.45,
        when(w, a) { const I = goInfo(w, a); return I ? { st: I.st } : null; },
        facts(w, a) {
            const I = goInfo(w, a); if (!I) return '';
            return fill('鎮上的賭場「{s}」開著，老闆是{o}。押錢可能贏也可能輸：大部分人輸、莊家長期穩賺，偶爾有人中大獎。你身上有 {c} 銀幣。{hist}{st}{owed}',
                { s: I.name, o: I.own.name, c: I.c,
                  hist: I.visits ? { k: '你去過 {v} 次，最近半個月輸了 {l} 銀幣。', p: { v: I.visits, l: I.lost } } : { raw: '' },
                  st: I.st >= 2 ? { k: '你已經連輸 {k} 把，很想翻本。', p: { k: I.st } } : { raw: '' },
                  owed: I.owed ? { k: '你還欠莊家 {n} 銀幣賭債。', p: { n: I.owed } } : { raw: '' } });
        },
        options(w, a) {
            const C = CS(); const I = goInfo(w, a); if (!I) return []; const px = I.px; const out = [];
            const pull = clampN((I.urge - 0.05) * 6, -0.3, 1.5); // 賭性(個性、連輸想翻本、走投無路、對賭場的好惡)比一般人高多少
            const go = (mode) => (w2, a2) => betRes(C.goBy(w2, a2, mode));
            out.push({ id: 'skip', quiet: true, mute: true, text: '不去', say: '沒去賭場', why: '十賭九輸，不碰比較好',
                base: 1.1 + (has(a, 'ascetic') || has(a, 'stoic') || has(a, 'perfectionist') ? 0.8 : 0) - Math.min(0.6, I.st * 0.2), lean: { safe: 0.5 }, run: () => null });
            if (I.c >= 5) out.push({ id: 'small', quiet: true, text: { k: '去小玩一把（押 {n} 銀幣左右）', p: { n: Math.max(2, Math.round(I.c * (I.rich ? 0.04 : 0.12))) } }, say: '去賭場小玩了一把', why: '小賭怡情，試試手氣',
                base: 0.4 + pull, lean: { joy: 0.4, gain: 0.2, safe: -0.3 }, run: go('small') });
            if (I.c >= 15) out.push({ id: 'big', text: { k: '去押一把大的（{n} 銀幣左右）', p: { n: Math.round(I.c * 0.35) } }, say: '去賭場押了一把大的', why: '要贏就要敢押',
                base: 0.3 + pull + (I.st >= 1 ? 0.4 : 0) + (has(a, 'greedy') ? 0.3 : 0) + (I.poor ? 0.6 : 0), lean: { gain: 0.5, joy: 0.2, safe: -0.6 }, run: go('big') }); // 手頭緊的人想靠一把翻身
            if (I.st >= 2 && I.c >= 5) out.push({ id: 'all', text: '把身上的錢幾乎全押下去，一把翻本', say: '把錢全押上賭桌想翻本', why: '輸掉的一定要贏回來',
                base: 0.7 + I.st * 0.25 + pull * 0.5, lean: { gain: 0.5, safe: -0.8 }, run: go('all') });
            if (I.canBank) out.push({ id: 'bank', text: { k: '跟銀行借 {n} 銀幣去翻本', p: { n: Math.ceil(30 * px) } }, say: '跟銀行借錢去賭場翻本', why: '再一把，贏回來就收手',
                base: 0.8 + I.st * 0.25, lean: { gain: 0.4, safe: -0.9 }, run: go('bank') });
            if (I.canCredit) out.push({ id: 'credit', text: { k: '跟莊家{o}賒 {n} 銀幣下注（他之後會來討）', p: { o: I.own.name, n: Math.round(20 * px) } }, say: '跟莊家賒帳下注', why: '先賒著，贏了就還',
                base: 0.9 + I.st * 0.25, lean: { gain: 0.4, safe: -0.9 }, run: go('credit') });
            return out;
        },
    });

    // ---------- 賭債拖了三週還不出來 ----------
    const debtInfo = (w, a) => { const C = CS(); return on(C, w) && w.casino ? C.debtInfo(w, a) : null; };
    DECIDE.kind('gamedebt', {
        title: '賭債還不出來', cool: 4, pri: 2,
        when(w, a) { const I = debtInfo(w, a); return I ? { n: I.n } : null; },
        facts(w, a) {
            const I = debtInfo(w, a); if (!I) return '';
            return fill('你欠賭場老闆{o} {n} 銀幣賭債，已經拖了 {d} 天，他的人天天堵在你家門口。你身上只有 {c} 銀幣，還不出來。', { o: I.own.name, n: I.n, d: I.days, c: I.c });
        },
        options(w, a) {
            const C = CS(); const I = debtInfo(w, a); if (!I) return []; const out = [];
            out.push({ id: 'hide', quiet: true, mute: true, text: '繼續躲著，能拖一天是一天', say: '繼續躲賭債', why: '現在真的沒錢，只能先躲', base: 1.0, lean: { safe: 0.1 }, run: () => null });
            if (I.canSteal) out.push({ id: 'steal', quiet: true, text: '去偷別人的錢來還', say: '偷了別人的錢還賭債', why: '被逼到沒路走了',
                base: 1.6 - (has(a, 'kind') ? 1.4 : 0) + (a.dark?.liar ? 0.3 : 0), lean: { bond: -0.5 },
                run: (w2, a2) => { const got = C.stealBy(w2, a2); return got ? { k: '偷到 {n} 銀幣，拿去還了債', p: { n: got } } : { k: '沒得手' }; } });
            out.push({ id: 'flee', quiet: true, text: '連夜離開小鎮', say: '為了躲賭債連夜跑路', why: '留下來只有死路一條',
                base: 1.5, lean: { safe: 0.2, bond: -0.6 }, run: (w2, a2) => (C.fleeBy(w2, a2) ? { k: '連夜走了' } : { k: '沒走成' }) });
            return out;
        },
    });

    // ---------- 在賭場輸到一無所有（由賭場那邊引發） ----------
    DECIDE.kind('ruined', {
        title: '在賭場輸到一無所有', scan: false, pri: 3,
        when() { return null; },
        facts(w, a, ctx) { return fill('你在賭場前後輸掉了 {n} 銀幣，連吃飯的錢都沒了。{owes}', { n: ctx.tot || 0, owes: ctx.owes ? '你還欠銀行一筆貸款沒還。' : { raw: '' } }); },
        options(w, a, ctx) {
            const C = CS(); if (!C || !w.casino) return [];
            return [
                { id: 'stay', quiet: true, text: '留下來，從頭再來', say: '輸光了還是留在鎮上', why: '家在這裡，再難也得撐下去', base: 1.2, lean: { bond: 0.4 }, run: () => null },
                { id: 'flee', quiet: true, text: '連夜離開小鎮，躲開債主和閒話', say: '輸光以後連夜跑路', why: '沒臉再待下去了',
                    base: 1.5 + (ctx.owes ? 1.3 : 0), lean: { face: 0.3, bond: -0.5 }, run: (w2, a2) => (C.fleeBy(w2, a2, true) ? { k: '連夜走了' } : { k: '沒走成' }) },
            ];
        },
    });

    // ---------- 要不要開賭場 ----------
    const openInfo = (w, a) => { const C = CS(); return on(C, w) ? C.openInfo(w, a) : null; };
    DECIDE.kind('opencasino', {
        title: '要不要開賭場', cool: 14, pri: 1,
        when(w, a) { const I = openInfo(w, a); return I ? { n: I.cost } : null; },
        facts(w, a) {
            const I = openInfo(w, a); if (!I) return '';
            return fill('鎮上還沒有賭場。你身上有 {c} 銀幣，花 {n} 銀幣就能開一家：莊家長期穩賺，可是每天要付荷官工資，遇到中大獎的客人可能一夜賠光；鎮上也會有人說你害人，甚至提案禁賭。', { c: I.c, n: Math.round(I.cost) });
        },
        options(w, a) {
            const C = CS(); const I = openInfo(w, a); if (!I) return [];
            return [
                { id: 'pass', quiet: true, mute: true, text: '不開', say: '沒有開賭場', why: '賺這種錢，晚上睡不安穩', base: 1.2 + (has(a, 'kind') ? 0.5 : 0), lean: { safe: 0.4, bond: 0.3 }, run: () => null },
                { id: 'open', quiet: true, text: { k: '花 {n} 銀幣開一家賭場', p: { n: Math.round(I.cost) } }, say: '開了一家賭場', why: '莊家永遠是贏的那一邊',
                    base: 1.6 + (has(a, 'greedy') ? 0.4 : 0) + (has(a, 'ambitious') ? 0.3 : 0), lean: { gain: 0.8, safe: -0.4, bond: -0.2 },
                    run: (w2, a2) => (C.openBy(w2, a2) ? { k: '賭場開張了' } : { k: '沒開成' }) },
            ];
        },
    });

    // ================= 要不要花錢買爵位 =================
    const titleInfo = (w, a) => { const C = CL(); return on(C, w) && w.wallet ? C.titleInfo(w, a) : null; };
    DECIDE.kind('title', {
        title: '要不要花錢買爵位', cool: 14, pri: 0.9,
        when(w, a) { const I = titleInfo(w, a); return I ? { n: I.price } : null; },
        facts(w, a) {
            const I = titleInfo(w, a); if (!I) return '';
            return fill('你身上有 {c} 銀幣。花 {n} 銀幣可以向鎮公所買一個騎士頭銜（錢進公庫），從此算是貴族，出入上流的場合。不過大家都會知道這個頭銜是買來的，{k}',
                { c: I.c, n: I.price, k: I.nobles ? { k: '鎮上 {m} 位受封的貴族多半會看不起你。', p: { m: I.nobles } } : '難免有人說閒話。' });
        },
        options(w, a) {
            const C = CL(); const I = titleInfo(w, a); if (!I) return [];
            return [
                { id: 'pass', quiet: true, mute: true, text: '不買', say: '沒有買爵位', why: '買來的頭銜，戴著也不踏實', base: 1.5 + (has(a, 'ascetic') ? 0.5 : 0), lean: { safe: 0.4 }, run: () => null },
                { id: 'buy', quiet: true, text: { k: '花 {n} 銀幣買下騎士頭銜', p: { n: I.price } }, say: '花錢買了騎士頭銜', why: '有了頭銜，走到哪裡都不一樣',
                    base: 1.1 + (has(a, 'ambitious') ? 0.4 : 0) + (hasV(a, '名聲') ? 0.3 : 0) + Math.min(0.6, (I.c - I.price * 1.3) / 600), lean: { face: 0.9, safe: -0.4 },
                    run: (w2, a2) => (C.titleBy(w2, a2) ? { k: '成了騎士' } : { k: '沒買成' }) },
            ];
        },
    });

    // ================= 等移植，要不要塞紅包插隊 =================
    const bribeInfo = (w, a) => { const H = HL(); return on(H, w) && w.health ? H.bribeInfo(w, a) : null; };
    DECIDE.kind('bribe', {
        title: '等移植，要不要塞紅包插隊', cool: 5, pri: 2,
        when(w, a) { const I = bribeInfo(w, a); return I ? { pos: I.pos } : null; },
        facts(w, a) {
            const I = bribeInfo(w, a); if (!I) return '';
            return fill('你的{p}快不行了（只剩 {h}／100），在等移植的名單上排第 {k} 位{first}。你身上有 {c} 銀幣。聽說塞 {n} 銀幣給醫生{d}，就能排到最前面；萬一被報社揭發，大家都會看不起你。',
                { p: I.part, h: I.hp, k: I.pos, first: I.first ? { k: '，排在最前面的是{x}', p: { x: I.first.name } } : { raw: '' }, c: I.c, n: I.fee, d: I.doc.name });
        },
        options(w, a) {
            const H = HL(); const I = bribeInfo(w, a); if (!I) return [];
            return [
                { id: 'wait', quiet: true, mute: true, text: '照規矩排隊', say: '照規矩排隊等移植', why: '大家都在等，插隊說不過去',
                    base: 1.2 + (has(a, 'kind') ? 0.5 : 0) + (I.first ? clampN(aff(a, I.first) / 60, 0, 0.5) : 0), lean: { bond: 0.3, face: 0.2 }, run: () => null },
                { id: 'bribe', quiet: true, text: { k: '塞 {n} 銀幣給醫生{d}，排到最前面', p: { n: I.fee, d: I.doc.name } }, say: { k: '塞紅包給醫生{d}插隊', p: { d: I.doc.name } }, why: '命是自己的，顧不了那麼多',
                    base: 1.5 + (I.hp < 15 ? 0.5 : 0) + (has(a, 'greedy') ? 0.2 : 0), lean: { safe: 0.5, bond: -0.3 },
                    run: (w2, a2) => (H.bribeBy(w2, a2) ? { k: '排到最前面了' } : { k: '沒辦成' }) },
            ];
        },
    });

    // ================= 提案的錢誰出（提案的當下就問） =================
    const fundInfo = (w, a, pid) => { const W = WL(); return on(W, w) && w.wallet ? W.fundInfo(w, a, pid) : null; };
    DECIDE.kind('fund', {
        title: '提案的錢誰出', scan: false, pri: 3,
        when() { return null; },
        facts(w, a, ctx) {
            const I = fundInfo(w, a, ctx.pid); if (!I) return ''; let title = ''; try { title = w.proposals?.title?.(I.p) || ''; } catch (e) {}
            return fill('你提的 {id}「{title}」大約要花 {n} 銀幣。你身上有 {c} 銀幣，自己出得起；{crowd}公庫現在有 {m} 銀幣。自己出錢，提案比較容易過，大家也會記得；動用公庫，比較省的人會猶豫。',
                { id: { raw: I.p.id }, title: { raw: title }, n: I.cost, c: I.mine, m: I.treasury, crowd: I.crowd.length ? { k: '{g}願意一起湊；', p: { g: { raw: names(I.crowd.slice(0, 3)) } } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const W = WL(); const I = fundInfo(w, a, ctx.pid); if (!I) return []; const pid = ctx.pid; const out = [];
            const set = (how, ok) => (w2, a2) => (W.fundBy(w2, a2, pid, how) ? ok : { k: '來不及改了' });
            out.push({ id: 'self', quiet: true, text: { k: '自己掏腰包（{n} 銀幣）', p: { n: I.cost } }, say: { k: '決定自己出錢辦 {id}', p: { id: { raw: I.p.id } } }, why: '自己提的事自己出錢，不動用大家的公庫',
                base: 0.9 + (has(a, 'kind') ? 0.5 : 0) + (has(a, 'charismatic') ? 0.5 : 0) + (I.cost <= I.mine * 0.35 ? 1.2 : 0) - (has(a, 'greedy') ? 0.5 : 0), lean: { face: 0.5, bond: 0.4, safe: -0.5 }, run: set('self', { k: '由我自己出' }) });
            if (I.crowd.length) out.push({ id: 'crowd', quiet: true, text: { k: '找{g}一起湊', p: { g: { raw: names(I.crowd.slice(0, 3)) } } }, say: { k: '找朋友一起湊錢辦 {id}', p: { id: { raw: I.p.id } } }, why: '大家一起出，事情才是大家的',
                base: 1.1, lean: { bond: 0.5, safe: 0.1 }, run: set('crowd', { k: '找朋友一起湊' }) });
            out.push({ id: 'town', quiet: true, mute: true, text: '讓公庫出', say: { k: '{id} 的錢讓公庫出', p: { id: { raw: I.p.id } } }, why: '這是鎮上的事，本來就該公庫出',
                base: I.crowd.length ? 0.8 : 1.3, lean: { safe: 0.5 }, run: set('town', null) });
            return out;
        },
    });
})();
