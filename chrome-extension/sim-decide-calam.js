// RimTown - sim-decide-calam.js：v11.7.0 決策核心「災難裡的人」
// 以前：災難裡每個人怎麼做都是擲骰替他決定的。怕的人恐慌期每天 25% 躲在家、病人每天 15% 有人送飯、疫苗做出來每天三成的人自動打到、
//       每天 12% 冒出一個賣萬靈藥的、被拆穿 40% 退錢、事後 55% 有人去道歉、家人被喪屍咬了 40% 幫忙瞞、家人 50% 衝出來擋斧頭、
//       有錢人每天 4% 逃走、大災之後隨便挑幾個人搬走；災後反應（搶、囤、逃、幫忙、怪罪……）自己算分，結果不進決策核心。
// 現在：災難什麼時候來、傷多重、誰被感染、誰被咬照舊看天，喪屍照固定的方式遊蕩咬人；每個人在災難裡怎麼做由本人決定：
//   怕被傳染，待不待在家(calStay)        照常出門／待在家幾天／帶家人一起躲
//   病人需要人送飯(calFood)              送到門口／不敢去／託別人送／（有過節的）不想理
//   疫苗做出來了(calVax)                 去打／再等等看／不打（醫生一天打得完的人數照舊，想打的排隊）
//   要不要趁亂賣萬靈藥(calPanSell)        不做／擺攤賣
//   有人在賣萬靈藥(calPanBuy)            買／不信
//   賣的假藥被拆穿了(calRefund)           全退／退一半／不退
//   疫情過去了，當初怪過的人(calSorry)     道歉／不說話／照樣怪
//   當初投了反對，後來死了人(calStub)       認錯／嘴硬／不說話
//   要不要離開小鎮避難(calFlee)           留下／自己走／帶家人走／帶朋友走／花錢買避難的位子（疫情恐慌、末日將至、大災之後、不孕之後）
//   被喪屍咬了(zbBit)                    自己去診所／回家跟家人說
//   家人被喪屍咬了(zbHide)               幫他瞞著／帶去診所／綁在家裡
//   輪到你去清剿(zbHunt)                 動手／下不了手／趕到墓園那邊
//   有人要對變成喪屍的家人下手(zbGuard)     衝出去擋／轉過頭／求他再等幾天
//   出了大事，你怎麼反應(crisis)          災後反應的十種做法＋照常過日子（傾向分數就是 sim-aftermath.js 原本的分數）
// 每個選擇點只問跟這件事最有關的少數人（篩選與冷卻在各系統裡）；用自己的一組 AI 額度（calam，一天 12 件），輪不到 AI 的照個性決定。
// 結算全部在原本的系統裡（sim-plague-ways.js、sim-calamity.js、sim-worldcal.js、sim-aftermath.js），這裡不動任何數字。
// 傾向分數照「以前大概多常發生」算起跑分數（tilt），再加上交情、個性與處境：沒開 AI 時整體頻率跟以前差不多，誰會那樣做看的是人。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const G = 'calam';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => t(o.name)).join(t('、'));
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const PW = () => (typeof PLAGUEWAYS !== 'undefined' ? PLAGUEWAYS : null);
    const WC = () => (typeof WORLDCAL !== 'undefined' ? WORLDCAL : null);
    const AM = () => (typeof AFTERMATH !== 'undefined' ? AFTERMATH : null);
    const honesty = (a) => { try { return typeof DARK !== 'undefined' ? DARK.honesty(a) : 2; } catch (e) { return 2; } };
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    // 兩個選項、當天心情起伏 ±0.9 時，起跑分數差多少會讓這個選項大約有 P 的機會被選中（跟 sim-decide-dark.js 同一個算法）
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1;
    const TIE = { '家人': '是一家人', '很要好': '感情很好', '有交情': '還算有交情', '交情普通': '只是普通交情', '有過節': '之間有過節' };
    const tieTxt = (k) => TIE[k] || TIE['交情普通'];
    const kids = (w, a, list) => list.filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(a.name));
    const base = { scan: false, cool: 0, aiGroup: G, when: () => null };

    // ================= 疫情：怕被傳染，待不待在家 =================
    DECIDE.kind('calStay', Object.assign({}, base, {
        title: '怕被傳染，待不待在家', pri: 1.2, aiKind: 2,
        facts(w, a) {
            const I = PW()?.stayInfo(w, a); if (!I) return '';
            const why = [I.lost ? '你家裡才剛有人病死。' : '', I.old ? '你年紀大了，染上了比較危險。' : '', I.pess ? '你本來就容易往壞處想。' : ''].filter(Boolean).map(x => t(x)).join('');
            return fill('{n}在鎮上傳開了：現在有 {i} 個人病著，已經死了 {d} 個。{p}{fam}{why}{money}', { n: I.n, i: I.sick, d: I.died, p: I.panic ? '鎮上人心惶惶。' : { raw: '' },
                fam: I.famSick.length ? { k: '你家裡的{x}正病著。', p: { x: { raw: names(I.famSick) } } } : '你家裡沒有人生病。', why: { raw: why },
                money: I.wage ? { k: '你身上只有 {c} 銀幣，沒什麼積蓄，幾天不上工就沒飯吃。', p: { c: I.c } } : { k: '你身上有 {c} 銀幣，幾天不上工還撐得住。', p: { c: I.c } } });
        },
        options(w, a) {
            const I = PW()?.stayInfo(w, a); if (!I) return []; const PWx = PW();
            const P = 1 - Math.pow(1 - I.q, I.gap); // 以前每天 q 的機率躲起來；現在每 gap 天問一次
            const adj = 0.2 + (I.lost ? 0.2 : 0) + (I.old && I.pess ? 0.2 : 0) + (has(a, 'neurotic') ? 0.3 : 0) + (I.famSick.length ? 0.2 : 0) - (I.wage ? 0.6 : 0) - (has(a, 'hardworking') ? 0.3 : 0) - (has(a, 'optimist') ? 0.3 : 0);
            const st = REF + tilt(P) + adj - (I.fam.length ? 0.15 : 0); const out = [
                { id: 'go', quiet: true, mute: true, text: '照常出門做事', say: '照常出門做事', why: '日子還是要過，總不能一直躲著。', base: REF, lean: { gain: 0.2, safe: -0.2 }, run: () => ({ k: '照常出門做事' }) },
                { id: 'stay', quiet: true, text: '待在家幾天，哪裡都不去', say: '待在家裡避一避', why: '外面太危險了，先躲幾天再說。', base: st, lean: { safe: 0.3, gain: -0.2, joy: -0.1 },
                    run: (w2, a2) => (PWx.stayBy(w2, a2, false) ? { k: '這幾天都待在家裡' } : { k: '沒有躲成' }) }];
            if (I.fam.length) out.push({ id: 'fam', quiet: true, text: { k: '帶著家人一起躲在家裡（{x}）', p: { x: { raw: names(I.fam) } } }, say: '帶著家人一起躲在家裡', why: '一家人都不要出門，誰都別染上。',
                base: st - 0.35 + (hasV(a, '家庭') ? 0.5 : 0) + (kids(w, a, I.fam).length ? 0.3 : 0), lean: { safe: 0.3, bond: 0.2, gain: -0.3 },
                run: (w2, a2) => { const r = PWx.stayBy(w2, a2, true); return r ? { k: '一家 {n} 口都待在家裡', p: { n: r.who.length } } : { k: '沒有躲成' }; } });
            return out;
        },
    }));

    // ================= 疫情：病人需要人送飯 =================
    DECIDE.kind('calFood', Object.assign({}, base, {
        title: '生病的人需要人送飯', pri: 1.4, aiKind: 2,
        facts(w, b, ctx) {
            const I = PW()?.foodInfo(w, b, ctx); if (!I) return '';
            return fill('{s}染上了{n}，已經病了 {k} 天{alone}。{via}你跟{s}{tie}。鎮上已經死了 {d} 個人。飯菜放在門口就好，可是你自己也可能被傳染。', { s: I.a.name, n: I.n, k: I.days, alone: I.alone ? '，家裡沒有人能照顧' : { raw: '' },
                via: I.via ? { k: '{v}託你幫忙送飯過去。', p: { v: I.via.name } } : { raw: '' }, tie: tieTxt(I.tie), d: I.died });
        },
        options(w, b, ctx) {
            const I = PW()?.foodInfo(w, b, ctx); if (!I) return []; const PWx = PW(); const s = I.a.name;
            const adj = -0.55 + clampN((I.af - 40) / 60, -0.5, 0.5) + (I.fam ? 0.4 : 0) + (has(b, 'kind') ? 0.5 : 0) + (hasV(b, '社群') ? 0.3 : 0) + (has(b, 'generous') ? 0.2 : 0) - (has(b, 'pessimist') ? 0.6 : 0) - (has(b, 'neurotic') ? 0.3 : 0) - ((b.age ?? 30) >= 60 ? 0.3 : 0) + (I.via ? 0.2 : 0) + (I.alone ? 0.3 : 0) - (I.cold ? 0.6 : 0);
            const out = [
                { id: 'give', text: { k: '每天把飯菜送到{s}家門口（送兩天）', p: { s } }, say: { k: '送飯到{s}家門口', p: { s } }, why: { k: '{s}病著，總要有人顧他一口飯。', p: { s } }, base: REF + tilt(I.q) + adj, lean: { bond: 0.4, safe: -0.3 },
                    run: (w2, b2) => (PWx.feedBy(w2, b2, ctx) ? { k: '送飯給{s}', p: { s } } : { k: '沒送成' }) },
                { id: 'afraid', quiet: true, text: '不敢去，怕被傳染', say: { k: '不敢送飯給{s}', p: { s } }, why: '我也怕，萬一染上了誰顧我家。', base: REF, lean: { safe: 0.3 },
                    run: (w2, b2) => (PWx.foodNo(w2, b2, ctx, false) ? { k: '沒有送飯給{s}', p: { s } } : null) }];
            if (I.pass) out.push({ id: 'pass', text: { k: '託{c}幫忙送', p: { c: I.pass.name } }, say: { k: '託{c}送飯給{s}', p: { c: I.pass.name, s } }, why: '我自己不敢去，找個人幫忙。', base: REF + tilt(0.1) + (has(b, 'pessimist') || has(b, 'neurotic') ? 0.4 : 0), lean: { safe: 0.2, bond: 0.1 },
                run: (w2, b2) => (PWx.foodPass(w2, b2, ctx) ? { k: '託{c}幫忙送飯', p: { c: I.pass.name } } : { k: '沒託成' }) });
            if (I.cold) out.push({ id: 'cold', text: '不想理他', say: { k: '不想理{s}', p: { s } }, why: { k: '我跟{s}早就不來往了。', p: { s } }, base: REF + 0.6 + (has(b, 'abrasive') ? 0.3 : 0), lean: { bond: -0.3 },
                run: (w2, b2) => (PWx.foodNo(w2, b2, ctx, true) ? { k: '沒有理{s}', p: { s } } : null) });
            return out;
        },
    }));

    // ================= 疫情：疫苗做出來了 =================
    DECIDE.kind('calVax', Object.assign({}, base, {
        title: '疫苗做出來了，打不打', pri: 1, aiKind: 2,
        facts(w, a) {
            const I = PW()?.vaxInfo(w, a); if (!I) return '';
            return fill('{n}的疫苗做出來了。鎮上 {pop} 個人裡已經有 {v} 個人打過，到現在沒聽說誰打了出事。現在還有 {i} 個人病著，已經死了 {d} 個。{fam}醫生一天只打得了 {cap} 個人，現在有 {q} 個人在排隊。{kid}{again}', { n: I.n, pop: I.pop, v: I.shots, i: I.sick, d: I.died,
                fam: I.lost ? '你家裡有人死在這場病裡。' : I.famSick.length ? { k: '你家裡的{x}正病著。', p: { x: { raw: names(I.famSick) } } } : { raw: '' }, cap: I.cap, q: I.queue,
                kid: I.kids.length ? { k: '你家的{x}也還沒打。', p: { x: { raw: names(I.kids) } } } : { raw: '' }, again: I.asks >= 2 ? '你上次說要再等等看。' : { raw: '' } });
        },
        options(w, a) {
            const I = PW()?.vaxInfo(w, a); if (!I) return []; const PWx = PW(); const rate = I.shots / Math.max(1, I.pop);
            const out = [{ id: 'go', quiet: true, text: I.kids.length ? '帶著孩子去排隊打疫苗' : '去排隊打疫苗', say: '去排隊打疫苗', why: '打了才安心。', lean: { safe: 0.3 },
                base: 1.9 + (I.lost ? 0.5 : 0) + (I.famSick.length ? 0.4 : 0) + (I.old ? 0.3 : 0) + (a.job?.key === 'doctor' ? 1 : 0) + (rate > 0.4 ? 0.3 : 0) + (I.kids.length ? 0.2 : 0),
                run: (w2, a2) => { const r = PWx.vaxBy(w2, a2, 'go'); return r ? { k: '排進了打疫苗的隊伍' } : null; } }];
            if (I.asks < 3) out.push({ id: 'wait', quiet: true, mute: true, text: '再等等，看別人打了有沒有事', say: '再等等看別人打了有沒有事', why: '這麼快做出來的東西，先看看再說。', lean: { safe: 0.1 },
                base: 1.0 + (has(a, 'pessimist') ? 0.3 : 0) + (has(a, 'optimist') ? 0.2 : 0) + (has(a, 'neurotic') ? 0.2 : 0) + (I.distrust ? 0.4 : 0) - (rate > 0.5 ? 0.3 : 0),
                run: (w2, a2) => { const r = PWx.vaxBy(w2, a2, 'wait'); return r ? { k: '說要再等等看' } : null; } });
            out.push({ id: 'no', text: '不打', say: '不打疫苗', why: I.piety >= 60 ? '神會保佑我，我不打那種東西。' : '我不相信那個東西。', lean: { safe: -0.1 },
                base: 0.3 + (I.piety >= 75 ? 1.6 : I.piety >= 60 ? 0.6 : 0) + (I.distrust ? 0.9 : 0) + (hasV(a, '自由') ? 0.3 : 0) + (hasV(a, '傳統') ? 0.3 : 0) - (I.lost ? 0.5 : 0),
                run: (w2, a2) => { const r = PWx.vaxBy(w2, a2, 'no'); return r ? { k: '不打疫苗' } : null; } });
            return out;
        },
    }));

    // ================= 疫情：要不要趁亂賣萬靈藥 =================
    DECIDE.kind('calPanSell', Object.assign({}, base, {
        title: '要不要趁亂賣萬靈藥', pri: 0.8, aiKind: 1,
        facts(w, a) {
            const I = PW()?.panSellInfo(w, a); if (!I) return '';
            return fill('鎮上正在流行{n}，現在有 {i} 個人病著，已經死了 {d} 個，大家都很怕。你身上有 {c} 銀幣。你可以弄一些「{x}」擺攤賣，說喝了就不會染上，怕的人應該會買單。可是那東西根本沒用，有人喝了照樣病倒就會被拆穿。{b}', { n: I.n, i: I.sick, d: I.died, c: I.c, x: I.nm, b: I.burned ? '上次疫情就有人賣過假藥被拆穿，大家沒那麼好騙了。' : { raw: '' } });
        },
        options(w, a) {
            const I = PW()?.panSellInfo(w, a); if (!I) return []; const PWx = PW();
            return [
                { id: 'no', quiet: true, mute: true, text: '不做這種事', say: '沒有去賣萬靈藥', why: '拿人家的命賺錢，我做不出來。', base: REF, lean: { face: 0.2 }, run: () => null },
                { id: 'sell', text: { k: '擺攤賣「{x}」', p: { x: I.nm } }, say: { k: '在市集擺攤賣「{x}」', p: { x: I.nm } }, why: '大家怕成這樣，總有人願意花錢買個安心。',
                    base: REF + tilt(I.burned ? 0.06 : 0.12) + clampN((I.motive - 1.5) * 0.35, -0.4, 0.7) - (has(a, 'kind') ? 0.8 : 0), lean: { gain: 0.5, face: -0.3 },
                    run: (w2, a2) => (PWx.panOpen(w2, a2) ? { k: '在市集擺了攤賣「{x}」', p: { x: I.nm } } : { k: '沒擺成' }) },
            ];
        },
    }));
    DECIDE.kind('calPanBuy', Object.assign({}, base, {
        title: '有人在賣萬靈藥', pri: 1, aiKind: 2,
        facts(w, b, ctx) {
            const I = PW()?.panBuyInfo(w, b, ctx); if (!I) return '';
            return fill('{s}在市集擺攤賣「{x}」，一瓶 {n} 銀幣，說喝了就不會染上{dis}。你跟{s}{tie}。現在有 {i} 個人病著，已經死了 {d} 個。{fam}{o}你身上有 {c} 銀幣。', { s: I.s.name, x: I.nm, n: I.n, dis: I.dis, tie: tieTxt(I.tie), i: I.sick, d: I.died,
                fam: I.lost ? '你家裡有人死在這場病裡。' : I.famSick.length ? { k: '你家裡的{x}正病著。', p: { x: { raw: names(I.famSick) } } } : { raw: '' }, o: I.others ? { k: '已經有 {k} 個人買了。', p: { k: I.others } } : { raw: '' }, c: I.c });
        },
        options(w, b, ctx) {
            const I = PW()?.panBuyInfo(w, b, ctx); if (!I) return []; const PWx = PW();
            const fear = (has(b, 'pessimist') ? 0.4 : 0) + ((b.age ?? 30) >= 55 ? 0.4 : 0) + (I.lost ? 0.6 : 0) + (I.famSick.length ? 0.5 : 0) + (has(b, 'neurotic') ? 0.3 : 0);
            return [
                { id: 'buy', quiet: true, text: { k: '花 {n} 銀幣買一瓶', p: { n: I.n } }, say: { k: '跟{s}買了「{x}」', p: { s: I.s.name, x: I.nm } }, why: '買個安心也好，萬一有用呢。', lean: { safe: 0.4, gain: -0.3 },
                    base: REF + tilt(0.5) - 0.3 + fear + clampN(I.af / 80, -0.5, 0.5) - (hasV(b, '知識') ? 0.5 : 0) - (I.c < 20 ? 0.3 : 0) + (I.others >= 3 ? 0.2 : 0),
                    run: (w2, b2) => { const r = PWx.panBuy(w2, b2, ctx); return r ? { k: '花 {n} 銀幣買了「{x}」', p: { n: r.n, x: r.nm } } : { k: '沒買成' }; } },
                { id: 'no', quiet: true, mute: true, text: '不信這種東西', say: { k: '沒跟{s}買', p: { s: I.s.name } }, why: '喝一瓶就不會染上？哪有這麼好的事。', base: REF, lean: { gain: 0.2 }, run: () => null },
            ];
        },
    }));
    DECIDE.kind('calRefund', Object.assign({}, base, {
        title: '賣的假藥被拆穿了', pri: 1.6, aiKind: 1,
        facts(w, a, ctx) {
            const bs = (ctx?.b || []).filter(([id]) => w.agents[id] && !w.agents[id].isDead); const m = bs.reduce((s, x) => s + x[1], 0);
            return fill('你賣的「{x}」被拆穿了：買的人喝了照樣病倒。當初有 {k} 個人跟你買，一共 {m} 銀幣，現在大家都在罵你。你身上有 {c} 銀幣。', { x: ctx?.nm || '萬靈藥', k: bs.length, m, c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const bs = (ctx?.b || []).filter(([id]) => w.agents[id] && !w.agents[id].isDead); if (!bs.length || day(w) - (ctx.d ?? 0) > 3) return []; const PWx = PW(); const m = bs.reduce((s, x) => s + x[1], 0);
            const out = [];
            if (cash(w, a) >= 1) out.push({ id: 'all', text: { k: '把錢全部退給大家（{m} 銀幣）', p: { m } }, say: '把賣假藥的錢全部退回去', why: '是我對不起大家，錢一分都不能留。', lean: { face: 0.3, gain: -0.3 },
                base: REF + tilt(0.32) + (has(a, 'kind') ? 1.0 : 0) + (honesty(a) >= 3 ? 0.4 : 0) - (has(a, 'greedy') ? 0.5 : 0), run: (w2, a2) => { const r = PWx.refundBy(w2, a2, ctx, 1); return { k: '退了 {n} 銀幣', p: { n: r.back } }; } });
            if (cash(w, a) >= 1) out.push({ id: 'half', text: '退一半，說自己也是被騙的', say: '退了一半的錢', why: '我也是跟人批來的，總不能全算我的。', lean: { face: 0.1 },
                base: REF + tilt(0.1) + (has(a, 'thrifty') ? 0.3 : 0), run: (w2, a2) => { const r = PWx.refundBy(w2, a2, ctx, 0.5); return { k: '退了 {n} 銀幣', p: { n: r.back } }; } });
            out.push({ id: 'no', text: '不退：藥是好藥，是他們自己身子虛', say: '不肯把錢退回去', why: '藥是好藥，喝了還是病是他們自己的事。', lean: { gain: 0.3, face: -0.2 },
                base: REF + (has(a, 'greedy') ? 0.3 : 0) + (has(a, 'abrasive') ? 0.2 : 0), run: (w2, a2) => { PWx.refundNo(w2, a2, ctx); return { k: '一分都沒退' }; } });
            return out;
        },
    }));

    // ================= 疫情：事後道不道歉、嘴不嘴硬 =================
    DECIDE.kind('calSorry', Object.assign({}, base, {
        title: '疫情過去了，當初怪過的人', pri: 1.2, aiKind: 2,
        facts(w, a, ctx) { const sc = w.agents[ctx?.sc]; if (!sc) return ''; return fill('{n}過去了。那時候鎮上傳說是{x}帶來的，你也怪過他，現在你對他的好感是 {f}。{x}這陣子出門都低著頭。', { n: ctx.n, x: sc.name, f: Math.round(aff(a, sc)) }); },
        options(w, a, ctx) {
            const sc = w.agents[ctx?.sc]; if (!sc || sc.isDead || sc === a || day(w) - (ctx.d ?? 0) > 3) return []; const PWx = PW(); const f = aff(a, sc); const x = sc.name;
            return [
                { id: 'sorry', text: { k: '去跟{x}道歉', p: { x } }, say: { k: '跟{x}道歉', p: { x } }, why: '那時候大家都慌了，不該把氣出在他身上。', lean: { bond: 0.4, face: -0.3 },
                    base: REF + tilt(0.25) + clampN((f + 20) / 40, -0.4, 0.4) + (has(a, 'kind') ? 0.6 : 0) + (honesty(a) >= 3 ? 0.3 : 0) - (has(a, 'ambitious') || has(a, 'jealous') ? 0.3 : 0), run: (w2, a2) => (PWx.sorryBy(w2, a2, ctx, 'sorry') ? { k: '跟{x}道歉了', p: { x } } : null) },
                { id: 'quiet', quiet: true, mute: true, text: '不說話，就這樣過去', say: { k: '沒有跟{x}道歉', p: { x } }, why: '事情都過去了，再提也尷尬。', base: REF + 0.1, lean: { face: 0.1 }, run: (w2, a2) => (PWx.sorryBy(w2, a2, ctx, 'quiet') ? { k: '什麼都沒說' } : null) },
                { id: 'still', text: '還是覺得是他害的', say: { k: '還是把帳算在{x}頭上', p: { x } }, why: '無風不起浪，我才不信跟他沒關係。', lean: { bond: -0.3, face: 0.1 },
                    base: REF + tilt(0.18) + (has(a, 'abrasive') ? 0.6 : 0) + (has(a, 'jealous') ? 0.4 : 0) + (f < -30 ? 0.5 : 0), run: (w2, a2) => (PWx.sorryBy(w2, a2, ctx, 'still') ? { k: '跟{x}吵了一架', p: { x } } : null) },
            ];
        },
    }));
    DECIDE.kind('calStub', Object.assign({}, base, {
        title: '當初投了反對，後來死了人', pri: 1.5, aiKind: 1,
        facts(w, a, ctx) { const b = ctx?.by ? w.agents[ctx.by] : null; return fill('「{t}」當初被否決了，你投的是反對。之後兩週內又死了 {n} 個人，大家都在說早該聽{b}的，有人當面問你怎麼想。', { t: { raw: ctx?.t || '' }, n: ctx?.n || 0, b: b?.name || '醫生' }); },
        options(w, a, ctx) {
            if (!ctx || day(w) - (ctx.d ?? 0) > 3) return []; const PWx = PW(); const b = ctx.by ? w.agents[ctx.by] : null; const bn = b?.name || '醫生';
            const admitT = has(a, 'kind') || has(a, 'honest') || honesty(a) >= 2; // 跟以前一樣：心腸好、老實的人認錯
            return [
                { id: 'admit', text: { k: '低頭認錯：早知道就該聽{b}的', p: { b: bn } }, say: '低頭認錯', why: '人都死了，再嘴硬有什麼用。', base: REF + (admitT ? 0.9 : -0.5), lean: { face: -0.3, bond: 0.2 }, run: (w2, a2) => ({ k: PWx.stubBy(w2, a2, ctx, 'admit') === 'admit' ? '認錯了' : '沒說什麼' }) },
                { id: 'stub', text: '嘴硬：人本來就會死，跟那個沒關係', say: '嘴硬說跟那條規定沒關係', why: '我又沒說錯，死人跟規定有什麼關係。', base: REF + (admitT ? -0.5 : 0.6), lean: { face: 0.4 }, run: (w2, a2) => ({ k: PWx.stubBy(w2, a2, ctx, 'stub') === 'stub' ? '嘴硬到底' : '沒說什麼' }) },
                { id: 'quiet', text: '不說話，低頭走開', say: '低頭走開', why: '說什麼都不對，不如不說。', base: REF - 0.3 + (has(a, 'shy') ? 0.5 : 0), lean: { face: 0.1, safe: 0.1 }, run: (w2, a2) => { PWx.stubBy(w2, a2, ctx, 'quiet'); return { k: '低頭走開了' }; } },
            ];
        },
    }));

    // ================= 去留：要不要離開小鎮避難 =================
    const curPl = (w) => { const X = w?.calamity?.cur; return X && X.kind === 'pathogen' ? X : null; };
    const curWc = (w) => w?.worldcal?.cur || null;
    const BUNK_KINDS = ['nukewar', 'aliens', 'iceage', 'blacksun', 'zombie'];
    function fleeInfo(w, a, ctx) {
        if (!a || !ctx || day(w) - (ctx.d ?? 0) > 2) return null; const fam = (WC()?.kin || PW()?.kin)?.(w, a) || [];
        const friend = (w2) => Object.values(a.relationships?.relationships || {}).map(r => w2.agents[r.targetId]).filter(o => o && !o.isDead && !o.isPlayer && !fam.includes(o) && (o.age ?? 30) >= 16 && aff(a, o) >= 40 && aff(o, a) >= 40 && !w2.isAway?.(o.agentId) && !(WC()?.isZombie?.(w2, o))).sort((x, y) => aff(a, y) - aff(a, x))[0] || null;
        if (ctx.src === 'plague') { const X = curPl(w); if (!X || !['panic', 'rumor', 'found'].includes(X.phase) || X.st[a.agentId]) return null; return { src: 'plague', X, n: X.spec.name, fam, fr: fam.length ? null : friend(w), c: Math.floor(cash(w, a)), sick: Object.values(X.st).filter(x => x.s === 'I').length, died: X.died, fled: X.fled }; }
        const c = curWc(w); if (!c || WC()?.isZombie?.(w, a)) return null; const K = WC().KINDS[c.kind]; const sp = fam.find(o => o.relationships?.relationships?.[a.agentId]?.status === 'married' || a.relationships?.relationships?.[o.agentId]?.status === 'married') || null;
        if (ctx.t === 'kids' && !sp) return null;
        const canB = ctx.t === 'early' && BUNK_KINDS.includes(c.kind) && !(c.bunk || {})[a.agentId]; const bc = canB ? WC().bunkCost(w, a) : 0;
        return { src: 'wc', c, K, t: ctx.t, name: K.name, fam, sp, fr: fam.length ? null : friend(w), cash: Math.floor(cash(w, a)), dead: c.dead || 0, left: c.left || 0, prep: !!c.prep, bunk: canB && cash(w, a) >= bc + 20 ? bc : 0, warn: (c.warn || []).includes(a.agentId), deny: (c.deny || []).includes(a.agentId) };
    }
    const FLEE_HEAD = { early: '學者說{name}要來了，鎮上的人都在講。{prep}', after: '{name}剛過去：已經有 {dead} 個人死了，{left} 個人走了。', cold: '{name}來了，田地結凍、牲口凍死，最冷的日子還沒過去。', dark: '{name}之後以太燈全熄了，天冷得像冰河期，有人說要往南邊找有光的地方。' };
    DECIDE.kind('calFlee', Object.assign({}, base, {
        title: '要不要離開小鎮避難', pri: 1.6, aiKind: 3,
        facts(w, a, ctx) {
            const I = fleeInfo(w, a, ctx); if (!I) return ''; const fam = I.fam.length ? { k: '你的家人：{x}。', p: { x: { raw: names(I.fam) } } } : '你在鎮上沒有家人。';
            if (I.src === 'plague') return fill('{n}越傳越兇，鎮上人心惶惶：現在有 {i} 個人病著，已經死了 {d} 個，已經有 {f} 個人逃走了。你身上有 {c} 銀幣，是鎮上比較有錢的人，走得起。{fam}', { n: I.n, i: I.sick, d: I.died, f: I.fled, c: I.c, fam });
            if (I.t === 'kids') return fill('{name}之後，鎮上再也沒有孩子出生。有人說外地還生得出來，想要孩子的夫妻在考慮搬走。你跟{sp}是夫妻。{fam}', { name: I.name, sp: I.sp.name, fam });
            const head = fill(FLEE_HEAD[I.t] || FLEE_HEAD.after, { name: I.name, dead: I.dead, left: I.left, prep: I.prep ? '鎮上的防備已經做好了。' : { raw: '' } });
            return fill('{h}你身上有 {c} 銀幣。{fam}{b}', { h: { raw: head }, c: I.cash, fam, b: I.bunk ? { k: '花 {n} 銀幣可以替一家人買到避難的位子（錢付給公庫）。', p: { n: I.bunk } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const I = fleeInfo(w, a, ctx); if (!I) return []; const q = +ctx.q || 0.4; const out = [];
            const adj = (has(a, 'pessimist') ? 0.3 : 0) + (has(a, 'neurotic') ? 0.3 : 0) + (kids(w, a, I.fam).length ? 0.3 : 0) - (owner(w, a) ? 0.6 : 0) - ((a.age ?? 30) >= 65 ? 0.4 : 0) + (hasV(a, '冒險') ? 0.2 : 0) - (hasV(a, '傳統') ? 0.3 : 0) - (has(a, 'brave') ? 0.3 : 0) + (I.warn ? 0.3 : 0) - (I.deny ? 0.5 : 0);
            const go = REF + tilt(q) + adj - (I.fam.length || I.fr ? 0.25 : 0); const tk = I.t || 'plague';
            const leave = (w2, a2, extra) => { if (I.src === 'plague') return plagueGo(w2, a2, extra); return WC().goBy(w2, a2, tk, extra); };
            const res = (out2) => (out2 && out2.length ? (out2.length > 1 ? { k: '帶著{x}離開了小鎮', p: { x: { raw: names(out2.slice(1)) } } } : { k: '離開了小鎮' }) : { k: '沒走成' });
            out.push({ id: 'stay', quiet: true, mute: true, text: '留下來', say: '留在鎮上', why: '這裡是我的家，要走去哪裡。', base: REF, lean: { bond: 0.2, safe: -0.1 }, run: () => ({ k: '留在鎮上' }) });
            if (I.t === 'kids') { out.push({ id: 'go', text: { k: '跟{sp}一起搬去外地碰運氣', p: { sp: I.sp.name } }, say: '搬去外地想辦法生孩子', why: '我們想要一個孩子，總要試試看。', base: REF + tilt(hasV(a, '家庭') ? 0.85 : q), lean: { bond: 0.3, safe: -0.2 }, run: (w2, a2) => res(leave(w2, a2, [w2.agents[I.sp.agentId]])) }); return out; }
            out.push({ id: 'go', text: I.fam.length ? '自己先走，家人留下' : '一個人走', say: '離開小鎮避難', why: '再留下去只會更糟。', base: go - (I.fam.length ? 0.3 : 0), lean: { safe: 0.3, bond: -0.2 }, run: (w2, a2) => res(leave(w2, a2, [])) });
            if (I.fam.length) out.push({ id: 'fam', text: { k: '帶著家人一起走（{x}）', p: { x: { raw: names(I.fam) } } }, say: '帶著家人離開小鎮', why: '要走就一家人一起走。', base: go + (hasV(a, '家庭') ? 0.3 : 0), lean: { safe: 0.3, bond: 0.2 }, run: (w2, a2) => res(leave(w2, a2, I.fam.map(o => w2.agents[o.agentId]).filter(Boolean))) });
            if (I.fr) out.push({ id: 'friend', text: { k: '帶著{x}一起走', p: { x: I.fr.name } }, say: { k: '帶著{x}一起離開', p: { x: I.fr.name } }, why: { k: '{x}跟我就像家人一樣，不能丟下他。', p: { x: I.fr.name } }, base: go - 0.1 + clampN((aff(a, I.fr) - 50) / 60, -0.2, 0.4), lean: { safe: 0.3, bond: 0.3 }, run: (w2, a2) => res(leave(w2, a2, [w2.agents[I.fr.agentId]].filter(Boolean))) });
            if (I.bunk) out.push({ id: 'bunk', text: { k: '花 {n} 銀幣替家人買避難的位子，留下來', p: { n: I.bunk } }, say: '花錢買了避難的位子', why: '走不了那麼遠，至少要有個地方躲。', base: REF + tilt(0.3) + (I.fam.length ? 0.2 : 0) + (has(a, 'thrifty') ? -0.3 : 0) + (owner(w, a) ? 0.4 : 0), lean: { safe: 0.4, gain: -0.2 },
                run: (w2, a2) => { const r = WC().bunkBy(w2, a2); return r ? { k: '花 {n} 銀幣買了避難的位子', p: { n: r.n } } : { k: '沒買成' }; } });
            return out;
        },
    }));
    // 疫情裡逃走（原本的寫法：一個一個 leaveTown，算進逃走的人數）
    function plagueGo(w, a, extra) {
        const X = curPl(w); if (!X) return []; const out = []; const why = fill('怕染上{n}，帶著家當逃走了', { n: X.spec.name });
        for (const x of [a, ...(extra || [])]) { if (!x || x.isDead || !w.agents[x.agentId] || CALAMITY.adults(w).length <= 5) continue; let ok = false; try { ok = !!w.leaveTown?.(x.agentId, why); } catch (e) {} if (ok) { X.fled++; out.push(x); } }
        if (out.length) { try { w.logMessageT?.('event', out.length > 1 ? '🧳 {a}怕染上{n}，帶著{b}收拾家當逃離了小鎮。' : '🧳 {a}怕染上{n}，收拾家當逃離了小鎮。', { a: a.name, n: X.spec.name, b: names(out.slice(1)) }, a.name); } catch (e) {} }
        return out;
    }

    // ================= 喪屍：被咬了、家人被咬了、輪到你清剿、家人擋不擋 =================
    const zc = (w) => { const c = curWc(w); return c?.zb ? c : null; };
    const pctOf = (c) => Math.round(c.prog || 0);
    function etaOf(w, c) { const res = Object.values(w.agents).filter(a => !a.isDead && a.job?.key === 'researcher').length; const v = (0.8 + 0.4 * Math.min(6, res)) * (c.fast || 1) * (c.fix ? 1.5 : 1); return Math.max(1, Math.ceil((100 - (c.prog || 0)) / Math.max(0.1, v))); }
    const etaTxt = (w, c) => (c.prog >= 100 ? { raw: '' } : { k: '，照現在的速度大概還要 {n} 天', p: { n: etaOf(w, c) } });
    const bitOk = (w, v, ctx) => { const c = zc(w); return c && v && !v.isDead && c.zb.bit[v.agentId] != null && !(c.zb.how || {})[v.agentId] && day(w) - (ctx?.d ?? 0) <= 1 ? c : null; };
    DECIDE.kind('zbBit', Object.assign({}, base, {
        title: '被喪屍咬了', pri: 2, aiKind: 2,
        facts(w, a, ctx) { const c = bitOk(w, a, ctx); if (!c) return ''; const z = ctx.z ? w.agents[ctx.z] : null; const fam = WC().kin(w, a);
            return fill('昨晚{z}撞開了你家的窗，咬傷了你的手臂。被咬的人兩天內就會變成喪屍。解藥做了 {p}%{eta}。守衛知道的話會把你帶去診所關起來。你的家人：{x}。', { z: z?.name || '喪屍', p: pctOf(c), eta: etaTxt(w, c), x: { raw: names(fam) } }); },
        options(w, a, ctx) {
            const c = bitOk(w, a, ctx); if (!c) return []; const fam = WC().kin(w, a); if (!fam.length) return [];
            const f = fam.slice().sort((x, y) => (y.relationships?.relationships?.[a.agentId]?.status === 'married' ? 100 : 0) + aff(y, a) - (x.relationships?.relationships?.[a.agentId]?.status === 'married' ? 100 : 0) - aff(x, a))[0];
            return [
                { id: 'clinic', text: '自己走去診所，叫他們把我關起來', say: '被咬之後自己去診所隔離', why: '我不想變成那樣以後咬到家人。', lean: { bond: 0.2, safe: -0.2 },
                    base: REF + tilt(0.15) + (has(a, 'brave') ? 0.4 : 0) + (has(a, 'kind') ? 0.3 : 0) + (kids(w, a, fam).length ? 0.3 : 0) + (honesty(a) >= 3 ? 0.2 : 0) - (has(a, 'neurotic') ? 0.3 : 0), run: (w2, a2) => (WC().zIso(w2, a2, null) ? { k: '自己去診所隔離了' } : null) },
                { id: 'home', text: { k: '回家跟{f}說', p: { f: f.name } }, say: { k: '回家跟{f}說被咬了', p: { f: f.name } }, why: '我好怕，想先回家。', base: REF, lean: { safe: 0.2 },
                    run: (w2, a2) => { DECIDE.askNow(w2, [{ a: w2.agents[f.agentId], kind: 'zbHide', ctx: { v: a2.agentId, d: day(w2) } }]); return { k: '回家跟{f}說了', p: { f: f.name } }; } },
            ];
        },
    }));
    DECIDE.kind('zbHide', Object.assign({}, base, {
        title: '家人被喪屍咬了', pri: 2.2, aiKind: 2,
        facts(w, f, ctx) { const v = ctx ? w.agents[ctx.v] : null; const c = bitOk(w, v, ctx); if (!c) return ''; const ks = kids(w, f, WC().kin(w, f)).filter(k => k !== v);
            return fill('{v}昨晚被喪屍咬了，手臂上的傷口還在流血，兩天內就會變成喪屍。解藥做了 {p}%{eta}。守衛知道的話會把人帶去診所隔離；要是被人發現你瞞著，鄰居也會怪你。你跟{v}{tie}。{k}', { v: v.name, p: pctOf(c), eta: etaTxt(w, c), tie: tieTxt(PW()?.tie?.(w, f, v) || '家人'), k: ks.length ? { k: '家裡還有{x}，萬一出了事，全家都危險。', p: { x: { raw: names(ks) } } } : { raw: '' } }); },
        options(w, f, ctx) {
            const v = ctx ? w.agents[ctx.v] : null; const c = bitOk(w, v, ctx); if (!c || v === f) return []; const ks = kids(w, f, WC().kin(w, f)).filter(k => k !== v);
            const guards = Object.values(w.agents).filter(o => !o.isDead && o.job?.key === 'guard' && o !== f); const distrust = hasV(f, '自由') || guards.some(g => aff(f, g) <= -10);
            const rules = hasV(f, '傳統') || has(f, 'perfectionist') || has(f, 'stoic');
            return [
                { id: 'hide', text: '幫他瞞著，說是被狗咬的', say: { k: '幫被咬的{v}瞞著', p: { v: v.name } }, why: '說了他們會把人帶走，我捨不得。', lean: { bond: 0.4, safe: -0.3 },
                    base: REF + 0.05 + clampN((aff(f, v) - 40) / 60, -0.4, 0.5) + (distrust ? 0.4 : 0) - (rules ? 0.4 : 0) - (ks.length ? 0.4 : 0) + (has(f, 'kind') ? 0.2 : 0) + (c.prog >= 60 ? 0.2 : 0), run: (w2, f2) => (WC().zHid(w2, f2, v, 'hide') ? { k: '幫{v}瞞了下來', p: { v: v.name } } : null) },
                { id: 'clinic', text: '帶他去診所隔離', say: { k: '把被咬的{v}帶去診所', p: { v: v.name } }, why: '瞞著只會害更多人。', base: REF, lean: { safe: 0.2 }, run: (w2, f2) => (WC().zIso(w2, v, f2) ? { k: '把{v}帶去診所了', p: { v: v.name } } : null) },
                { id: 'tie', text: '自己動手把他綁在家裡', say: { k: '把被咬的{v}綁在家裡', p: { v: v.name } }, why: '不送走他，也不能讓他傷人。', lean: { bond: 0.2 },
                    base: REF + tilt(0.12) + (has(f, 'brave') ? 0.3 : 0) + (has(f, 'stoic') ? 0.3 : 0), run: (w2, f2) => (WC().zHid(w2, f2, v, 'tie') ? { k: '把{v}綁在家裡', p: { v: v.name } } : null) },
            ];
        },
    }));
    const zOk = (w, ctx) => { const c = zc(w); const z = c && ctx ? w.agents[ctx.z] : null; return c && z && !z.isDead && c.zb.ids.includes(z.agentId) && day(w) - (ctx.d ?? 0) <= 1 ? { c, z } : null; };
    const zFam = (w, z, not) => WC().kinZ(w, z).filter(o => o !== not).sort((x, y) => aff(y, z) - aff(x, z));
    DECIDE.kind('zbHunt', Object.assign({}, base, {
        title: '輪到你去清剿喪屍', pri: 2, aiKind: 1,
        facts(w, h, ctx) { const Z = zOk(w, ctx); if (!Z) return ''; const fam = zFam(w, Z.z, h);
            return fill('今天輪到你帶著守衛去清剿。墓園邊那個喪屍是{z}，生前你跟{z}{tie}。{fam}解藥做了 {p}%{eta}。', { z: Z.z.name, tie: tieTxt(PW()?.tie?.(w, h, Z.z) || '交情普通'), fam: fam.length ? { k: '{z}的家人{x}還在鎮上。', p: { z: Z.z.name, x: { raw: names(fam) } } } : { raw: '' }, p: pctOf(Z.c), eta: etaTxt(w, Z.c) }); },
        options(w, h, ctx) {
            const Z = zOk(w, ctx); if (!Z || h === Z.z) return []; const z = Z.z; const a0 = aff(h, z); const mine = WC().kinZ(w, z).includes(h); const soon = etaOf(w, Z.c) <= 3;
            return [
                { id: 'kill', text: '動手', say: { k: '對{z}動了手', p: { z: z.name } }, why: '那已經不是他了，再拖下去會有更多人被咬。', lean: { safe: 0.3, bond: -0.2 },
                    base: REF + tilt(0.9) - clampN(a0 / 40, 0, 1.5) - (mine ? 1.5 : 0) - (has(h, 'kind') ? 0.4 : 0) + (h.job?.key === 'guard' ? 0.3 : 0) - (soon ? 0.6 : 0),
                    run: (w2, h2) => { const Z2 = zOk(w2, ctx); if (!Z2) return null; const f = zFam(w2, Z2.z, h2)[0];
                        if (f) { DECIDE.askNow(w2, [{ a: f, kind: 'zbGuard', ctx: { z: Z2.z.agentId, h: h2.agentId, d: day(w2) } }]); return { k: '舉起了斧頭' }; }
                        return WC().zKill(w2, h2, Z2.z) ? { k: '結束了{z}', p: { z: Z2.z.name } } : null; } },
                { id: 'cant', text: '下不了手', say: { k: '對{z}下不了手', p: { z: z.name } }, why: '那是我認識的人，我做不到。', base: REF, lean: { bond: 0.3 }, run: (w2, h2) => { const Z2 = zOk(w2, ctx); return Z2 && WC().zSpare(w2, h2, Z2.z, false) ? { k: '放下了斧頭' } : null; } },
                { id: 'drive', text: '只把他趕到墓園那邊', say: { k: '把{z}趕回墓園', p: { z: z.name } }, why: '先別讓他靠近大家，等解藥。', base: REF - 0.2 + (soon ? 0.4 : 0), lean: { bond: 0.2, safe: 0.1 }, run: (w2, h2) => { const Z2 = zOk(w2, ctx); return Z2 && WC().zSpare(w2, h2, Z2.z, true) ? { k: '把{z}趕回墓園', p: { z: Z2.z.name } } : null; } },
            ];
        },
    }));
    DECIDE.kind('zbGuard', Object.assign({}, base, {
        title: '有人要對變成喪屍的家人下手', pri: 2.5, aiKind: 1,
        facts(w, f, ctx) { const Z = zOk(w, ctx); const h = Z && w.agents[ctx.h]; if (!Z || !h) return '';
            return fill('{h}舉起斧頭，要對{z}下手。{z}已經變成喪屍了，可是你還認得那件衣服。解藥做了 {p}%{eta}。你跟{h}{tie}。', { h: h.name, z: Z.z.name, p: pctOf(Z.c), eta: etaTxt(w, Z.c), tie: tieTxt(PW()?.tie?.(w, f, h) || '交情普通') }); },
        options(w, f, ctx) {
            const Z = zOk(w, ctx); const h = Z && w.agents[ctx.h]; if (!Z || !h || h.isDead || f === h || f === Z.z) return []; const z = Z.z; const soon = etaOf(w, Z.c) <= 5;
            return [
                { id: 'block', text: { k: '衝出去擋在{z}前面', p: { z: z.name } }, say: { k: '擋在變成喪屍的{z}前面', p: { z: z.name } }, why: '解藥就快好了，他還有救。', lean: { bond: 0.4, safe: -0.3 },
                    base: REF + tilt(0.35) + clampN((aff(f, z) - 40) / 60, -0.3, 0.5) + (has(f, 'brave') ? 0.4 : 0) + (soon ? 0.3 : 0) - (has(f, 'neurotic') || has(f, 'shy') ? 0.2 : 0),
                    run: (w2, f2) => { const Z2 = zOk(w2, ctx); const h2 = w2.agents[ctx.h]; return Z2 && h2 && WC().zBlock(w2, f2, h2, Z2.z, false) ? { k: '擋住了{h}', p: { h: h2.name } } : null; } },
                { id: 'away', text: '轉過頭不看', say: '轉過頭，讓他動手', why: '那已經不是他了，讓他走吧。', base: REF, lean: { safe: 0.2 },
                    run: (w2, f2) => { const Z2 = zOk(w2, ctx); const h2 = w2.agents[ctx.h]; return Z2 && h2 && !h2.isDead && WC().zKill(w2, h2, Z2.z) ? { k: '轉過頭，{h}動了手', p: { h: h2.name } } : null; } },
                { id: 'beg', text: '跪下來求他再等幾天', say: { k: '求{h}再等幾天', p: { h: h.name } }, why: '求求你，再等幾天就好。', lean: { bond: 0.3 },
                    base: REF + tilt(0.2) + (aff(f, h) >= 25 ? 0.4 : 0) + (has(f, 'kind') ? 0.2 : 0),
                    run: (w2, f2) => { const Z2 = zOk(w2, ctx); const h2 = w2.agents[ctx.h]; return Z2 && h2 && WC().zBlock(w2, f2, h2, Z2.z, true) ? { k: '{h}答應再等幾天', p: { h: h2.name } } : null; } },
            ];
        },
    }));

    // ================= 災後反應：出了大事，你怎麼反應 =================
    const RTXT = { loot: '趁亂去搶商店或糧倉', hoard: '去店裡大買一批糧食和藥囤起來', flee: '帶著家當離開小鎮', help: '拿點錢和吃的去幫受害的人', blame: '到處跟人說這是誰害的', rumor: '把聽來的消息傳出去', protest: '上街抗議，要鎮公所給個交代', pray: '去跟大家一起禱告', volunteer: '自願去照顧受害的人', comfort: '待在家陪家人' };
    const RWHY = { loot: '大家都在拿，不拿白不拿。', hoard: '誰知道接下來會怎樣，先囤起來再說。', flee: '這裡待不下去了。', help: '大家都不好過，能幫就幫。', blame: '總要有人負責。', rumor: '我聽說的可不只這樣。', protest: '鎮公所得給大家一個交代。', pray: '現在只能求神保佑了。', volunteer: '那些人需要人照顧。', comfort: '這種時候，家人最重要。' };
    const RDONE = { loot: '去搶了', hoard: '囤了一批貨', flee: '離開了小鎮', help: '送了錢和吃的過去', blame: '到處說是誰害的', rumor: '把消息傳了出去', protest: '上街抗議了', pray: '去禱告了', volunteer: '去照顧受害的人', comfort: '在家陪家人' };
    const SEV = { 1: { raw: '' }, 2: '，事情不小', 3: '，是一場大災' };
    DECIDE.kind('crisis', Object.assign({}, base, {
        title: '出了大事，你怎麼反應', pri: 1.5, aiKind: 8,
        facts(w, a, ctx) {
            const X = AM()?.choices(w, a, ctx); if (!X) return ''; const cr = X.cr; const b = cr.blame ? w.agents[cr.blame] : null; const R = AM().R;
            return fill('小鎮剛發生{c}{sev}。{vic}{bl}{fr}你身上有 {m} 銀幣。', { c: cr.cause, sev: SEV[cr.sev] || SEV[1], vic: X.fv ? '你自己或家人受害了。' : { raw: '' },
                bl: b ? (b === a ? '大家在怪你。' : { k: '大家在怪{b}。', p: { b: b.name } }) : { raw: '' },
                fr: X.friends.length ? { k: '身邊的人在做：{x}。', p: { x: { raw: X.friends.map(([o, r]) => `${t(o.name)}${t('：')}${t(R[r]?.name || '照常過日子')}`).join(t('、')) } } } : { raw: '' }, m: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const X = AM()?.choices(w, a, ctx); if (!X) return []; const R = AM().R;
            const out = X.list.map(({ r, s }) => ({ id: r, text: RTXT[r], say: { k: '{icon}{name}', p: { icon: { raw: R[r].icon }, name: R[r].name } }, why: RWHY[r], base: s, lean: {},
                run: (w2, a2) => { const v = AM().doIt(w2, a2, ctx, r); return v ? { k: RDONE[r] } : { k: '想做卻沒做成' }; } }));
            out.push({ id: 'none', quiet: true, mute: true, text: '照常過日子', say: '照常過日子', why: '日子還是要過。', base: X.none, lean: {}, run: (w2, a2) => { AM().doIt(w2, a2, ctx, 'none'); return null; } });
            return out;
        },
    }));
})();
