// RimTown - sim-decide-dark.js：v9.26.0 決策核心批次 D（陰暗面與選舉手段）
// 以前：不老實的懶人／貪吃的人每天 6% 機率動公家的東西、有仇人就推給他；好心人每天 5% 機率說善意的謊；
//       候選人每天 30% 機率抹黑或開空頭支票、50% 機率買票、35% 機率收買報社；神職每天 4% 機率私吞奉獻；
//       掌櫃每週 25% 機率揩油；買賣吵架時賣家 60% 機率是真的偷斤減兩；投贊成票的人 12～40% 機率私下不守；
//       疫情規定下每個人每天照「想溜的程度」擲骰；聽到朋友被說壞話 35% 機率去告訴本人。
// 現在：這些事由本人決定。會動這些念頭的還是同一批人（各系統說「他現在做得到哪幾件事」），做不做是他自己選：
//   公家的東西(pilfer)                  不動／拿了裝作不知道／拿了推給仇人
//   朋友心情很差(comfort)               先不打擾／陪他坐一會／說善意的謊
//   選戰怎麼打(dirty)                   正正當當拉票／抹黑對手／開空頭支票／塞錢買票／收買報社
//   聽到有人說朋友的壞話(tattle)         不傳話／去告訴當事人                ← 由講壞話那一刻引發
//   做生意的手法(trade)                 老老實實／秤頭上動手腳              ← 定下來以後，買賣糾紛是不是真的坑人就看這個，不再擲骰
//   掌櫃經手的帳(skim)                  照實記／挪一點進自己口袋
//   教團的奉獻箱(embezzle)              一枚都不動／拿一部分
//   自己贊成的規定(twoface)             照規定做／私下照自己的方便來        ← 由規定通過那一刻引發
//   疫情的規定(sneak)                   照規定來／找機會溜
// v11.11.0 塞錢與收錢（以前塞錢的人照機率塞、收錢的人一定收）：
//   提案要送進議會了(bribeVote)          不塞／塞給某位議員／兩個都塞（civic 那一組，一天 6 件）
//   有人提案要拆你的產業(trustFight)     不理／私下塞錢給兩個手頭緊的人／公開反駁（civic 那一組）
//   有人私下塞錢來(bribeTake)            議員：收下改投／退回／當眾說出來；選民（議員和首長選舉都一樣）：收了照投／收了不照投／不收；反壟斷：收下／不收
//   議員改選的買票併進「選戰怎麼打」(dirty)：正正當當／私下塞錢
// 會不會被發現仍然是運氣；結算全部在原本的系統裡（sim-dark.js、sim-wallet.js、sim-press.js、sim-faith.js、sim-compete.js、sim-ways.js、sim-plague-ways.js），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數。這一批的事以前各有各的機率，
// 所以傾向分數用 tilt() 把「以前大概多常發生」換成起跑分數，再加上個性與處境；整體頻率跟以前差不多，但誰會做、誰不會做看的是人。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => o.name).join(t('、'));
    const DK = () => (typeof DARK !== 'undefined' ? DARK : null);
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const PR = () => (typeof PRESS !== 'undefined' ? PRESS : null);
    const FA = () => (typeof FAITH !== 'undefined' ? FAITH : null);
    const CP = () => (typeof COMPETE !== 'undefined' ? COMPETE : null);
    const WY = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const PW = () => (typeof PLAGUEWAYS !== 'undefined' ? PLAGUEWAYS : null);
    const on = (w) => { try { const D = DK(); return !!D && DECIDE.on(w); } catch (e) { return false; } };
    const honesty = (a) => { try { return DK().honesty(a); } catch (e) { return 2; } };
    const malice = (a) => { try { return DK().malice(a); } catch (e) { return 0; } };
    // 兩個選項、當天心情起伏 ±0.9 時，起跑分數差多少會讓這個選項大約有 P 的機會被選中
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const within = (p, days) => 1 - Math.pow(1 - p, days); // 每天 p 的事，幾天內至少發生一次的機會
    const REF = 1; // 「不做」這個選項的起跑分數
    DECIDE.dark = true; // 其他系統看到這個，就知道說謊、選戰手段、揩油這些事交給本人決定、不擲骰

    // ================= 公家的東西 =================
    const pilferInfo = (w, a) => (on(w) ? DK().pilferInfo(w, a) : null);
    DECIDE.kind('pilfer', {
        title: '公家的東西', cool: 8, pri: 0.5,
        when(w, a) { const I = pilferInfo(w, a); return I ? { food: I.food } : null; },
        facts(w, a) {
            const I = pilferInfo(w, a); if (!I) return '';
            return fill('{what}{foe}真相要是被查出來，全鎮都會知道是你。',
                { what: I.food ? '倉庫現在沒人看著。進去拿一點吃的（公家的糧食會少 8 份），不會有人馬上發現。' : '今天的活很累。拿公家的工具硬來可以省不少力氣，但多半會弄壞一件（公家的工具少 1 件）。',
                  foe: I.foe ? { k: '你跟{v}本來就有過節，事後可以說是他弄的。', p: { v: I.foe.name } } : { raw: '' } });
        },
        options(w, a) {
            const D = DK(); const I = pilferInfo(w, a); if (!I) return [];
            const P = within(0.06, 8); const blamer = I.foe && I.mal >= 1.5;
            const res = (r) => (!r ? { k: '沒有下手' } : r.v ? { k: '大家以為是{v}', p: { v: r.v.name } } : { k: '沒有人發現' });
            const out = [
                { id: 'no', quiet: true, mute: true, text: I.food ? '不拿' : '照規矩慢慢做', say: '沒有動公家的東西', why: '被發現了在鎮上抬不起頭，不值得', base: REF, run: () => null },
                { id: 'take', quiet: true, text: I.food ? '進去拿一點吃的，裝作不知道' : '拿公家的工具硬來，弄壞了就裝作不知道', say: I.food ? '偷吃了倉庫的食物' : '把公家的工具弄壞了，沒有說', why: I.food ? '沒人看著，拿一點不會怎樣' : '能省力氣就省',
                    base: REF + tilt(P) - (blamer ? 0.5 : 0), lean: { joy: 0.3, safe: -0.3 }, run: (w2, a2) => res(D.pilferBy(w2, a2, false)) },
            ];
            if (I.foe) out.push({ id: 'blame', quiet: true, text: { k: I.food ? '進去拿一點吃的，事後說是{v}拿的' : '拿公家的工具硬來，弄壞了就說是{v}弄的', p: { v: I.foe.name } }, say: { k: I.food ? '偷吃了倉庫的食物，還推給{v}' : '把公家的工具弄壞了，還推給{v}', p: { v: I.foe.name } }, why: { k: '反正{v}本來就惹人厭，大家會信', p: { v: I.foe.name } },
                base: REF + tilt(P) - (blamer ? 0 : 1.2) + clampN((I.mal - 1.5) * 0.15, -0.3, 0.4), lean: { joy: 0.3, bond: -0.3 }, run: (w2, a2) => res(D.pilferBy(w2, a2, true)) });
            return out;
        },
    });

    // ================= 朋友心情很差 =================
    const comfortInfo = (w, a) => (on(w) ? DK().comfortInfo(w, a) : null);
    DECIDE.kind('comfort', {
        title: '朋友心情很差', cool: 10, pri: 0.4,
        when(w, a) { const I = comfortInfo(w, a); return I ? { b: I.sad.agentId } : null; },
        facts(w, a) { const I = comfortInfo(w, a); return I ? fill('{b}這幾天心情很差，覺得鎮上沒有人喜歡他。你們交情不錯。', { b: I.sad.name }) : ''; },
        options(w, a) {
            const D = DK(); const I = comfortInfo(w, a); if (!I) return []; const b = I.sad; const P = within(0.05, 10);
            return [
                { id: 'leave', quiet: true, mute: true, text: '先不打擾他', say: { k: '沒有去找{b}', p: { b: b.name } }, why: '他也許想一個人靜一靜', base: REF, run: () => null },
                { id: 'sit', quiet: true, text: '過去陪他坐一會，不說假話', say: { k: '去陪{b}坐了一會', p: { b: b.name } }, why: '說不出好聽的話，至少陪著他',
                    base: REF + tilt(P * 0.6) + clampN((honesty(a) - 3) * 0.2, -0.2, 0.4), lean: { bond: 0.2, joy: -0.2 }, run: (w2, a2) => (D.comfortBy(w2, a2, 'sit') ? { k: '{b}好過了一點', p: { b: b.name } } : null) },
                { id: 'lie', quiet: true, text: '跟他說「大家其實都很喜歡你」（不是真的，但他聽了會好過一點）', say: { k: '說了善意的謊安慰{b}', p: { b: b.name } }, why: '看他那樣，說什麼都想讓他好過一點',
                    base: REF + tilt(P * 0.7) + (has(a, 'romantic') ? 0.2 : 0) - clampN((honesty(a) - 3) * 0.2, 0, 0.4), lean: { bond: 0.2, safe: -0.2 }, run: (w2, a2) => (D.comfortBy(w2, a2, 'lie') ? { k: '{b}聽了好過多了', p: { b: b.name } } : null) },
            ];
        },
    });

    // ================= 選戰怎麼打 =================
    // v11.11.0 議員改選時的買票也走這裡（以前不老實又有 40 銀幣的候選人每天 40% 機率自動買票）
    const AS = () => (typeof ASSEMBLY !== 'undefined' ? ASSEMBLY : null);
    const campInfo = (w, a) => {
        if (!on(w)) return null; const I = DK().campInfo(w, a);
        if (!I) { let cb = null; try { cb = AS()?.buyInfo?.(w, a) || null; } catch (e) {} return cb ? { council: cb, opp: cb.opp, left: cb.left } : null; }
        let buy = null, press = null; try { buy = WL()?.voteBuyInfo?.(w, a) || null; } catch (e) {} try { press = PR()?.bribeInfo?.(w, a) || null; } catch (e) {}
        return (I.smear || I.hollow || buy || press) ? Object.assign({ buy, press }, I) : null;
    };
    DECIDE.kind('dirty', {
        title: '選戰怎麼打', cool: 1, pri: 1.4,
        when(w, a) { const I = campInfo(w, a); return I ? { left: I.left } : null; },
        facts(w, a) {
            const I = campInfo(w, a); if (!I) return '';
            if (I.council) { const B = I.council; return fill('{member}改選還剩 {n} 天{opp}。除了正正當當拉票，你也想過私下塞錢：你身上有 {c} 銀幣，鎮上有 {k} 個手頭緊的人，每人塞 {e} 銀幣（收不收、收了投不投你，看他們自己）。這種事被揭穿的話，當選也會被取消。',
                { member: B.member, n: Math.max(1, B.left), opp: I.opp.length ? { k: '，對手是{o}', p: { o: { raw: names(I.opp.slice(0, 4)) } } } : { raw: '' }, c: B.bal, k: B.n, e: B.each }); }
            const L = [fill('競選還剩 {n} 天{opp}。除了正正當當拉票，你也想過別的辦法：', { n: I.left, opp: I.opp.length ? { k: '，對手是{o}', p: { o: { raw: names(I.opp) } } } : { raw: '' } })];
            if (I.smear) L.push(t('跟選民說對手的壞話（編的，聽的人會對他印象變差；之後可能被拆穿）。'));
            if (I.hollow) L.push(t('開一張做不到的支票（聽的人會對你印象變好；之後可能被拆穿）。'));
            if (I.buy) L.push(fill('你身上有 {c} 銀幣。可以私下塞錢給 {n} 個手頭緊的人，每人 {e} 銀幣（收不收、收了投不投你，看他們自己）。', { c: I.buy.bal, n: I.buy.n, e: I.buy.each }));
            if (I.press) L.push(fill('鎮上有 {n} 家報社還沒被人買走。花 {c} 銀幣可以讓其中一家替你說話（記者不一定肯收；一次選舉只買得了一家）。', { n: I.press.n, c: I.press.cost }));
            return L.join('');
        },
        options(w, a) {
            const D = DK(); const I = campInfo(w, a); if (!I) return []; const h = honesty(a), m = malice(a);
            const out = [{ id: 'clean', quiet: true, mute: true, text: '正正當當拉票', say: '決定正正當當拉票', why: '贏要贏得乾淨，不然當選了也坐不穩', base: REF, lean: { safe: 0.1 }, run: () => null }];
            if (I.council) { const B = I.council; out.push({ id: 'cbuy', quiet: true, text: { k: '私下塞錢給手頭緊的人（每人 {e} 銀幣）', p: { e: B.each } }, say: { k: '{member}選舉時私下塞錢買票', p: { member: B.member } }, why: '手頭緊的人，一點錢就記得你',
                base: REF + tilt(0.4) + clampN((1.8 - h) * 0.2, 0, 0.4), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => { const got = AS()?.buyBy?.(w2, a2); return got && got.length ? { k: '私下找了{v}塞錢', p: { v: { raw: got.map(o => t(o.name)).join(t('、')) } } } : { k: '沒有塞成' }; } }); return out; }
            if (I.smear) for (const o of I.opp.slice().sort((x, y) => aff(a, x) - aff(a, y)).slice(0, 2)) out.push({ id: 'smear:' + o.agentId, quiet: true, text: { k: '跟選民說{o}的壞話（編的）', p: { o: o.name } }, say: { k: '拉票時抹黑了{o}', p: { o: o.name } }, why: { k: '把{o}拉下來，票才會到我這邊', p: { o: o.name } },
                base: REF + tilt(0.18) + clampN((m - 1) * 0.06, 0, 0.25) + clampN(-aff(a, o) / 100, -0.3, 0.3), lean: { face: 0.3, bond: -0.3 },
                run: (w2, a2) => { const r = D.smearBy(w2, a2, o.agentId); return r ? { k: '跟幾個選民說了{o}的壞話', p: { o: o.name } } : { k: '沒有說出口' }; } });
            if (I.hollow) out.push({ id: 'hollow', quiet: true, text: '開一張做不到的支票', say: '開了一張做不到的支票', why: '先選上再說，話說得漂亮才有人投',
                base: REF + tilt(I.smear ? 0.12 : 0.3) + (has(a, 'charismatic') ? 0.2 : 0), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => { const r = D.hollowBy(w2, a2); return r ? { k: '答應選民：「{x}」', p: { x: r.x } } : { k: '沒有說出口' }; } });
            if (I.buy) out.push({ id: 'buy', quiet: true, text: { k: '私下塞錢給 {n} 個手頭緊的人（每人 {e} 銀幣）', p: { n: I.buy.n, e: I.buy.each } }, say: '私下塞錢買票', why: '手頭緊的人，一點錢就記得你',
                base: REF + tilt(0.5) + clampN((1.8 - h) * 0.2, 0, 0.4), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => { const got = WL().voteBuyBy(w2, a2); return got && got.length ? { k: '私下找了{v}塞錢', p: { v: { raw: got.map(o => t(o.name)).join(t('、')) } } } : { k: '沒有塞成' }; } }); // v11.11.0 收不收由被找上的人決定（bribeTake）
            if (I.press) out.push({ id: 'press', quiet: true, text: { k: '花 {c} 銀幣收買一家報社', p: { c: I.press.cost } }, say: '花錢收買報社', why: '報上怎麼寫，大家就怎麼想',
                base: REF + tilt(0.35) + clampN((2 - h) * 0.15, -0.15, 0.3), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => { const r = PR().bribeBy(w2, a2); return !r ? { k: '沒有談成' } : r.asked ? { k: '去找{p}談了', p: { p: r.P.name[0] } } /* v11.8.0 收不收由那家的主筆決定 */ : r.refused ? { k: '{p}的記者沒有收', p: { p: r.P.name[0] } } : { k: '{p}收了錢', p: { p: r.P.name[0] } }; } });
            return out;
        },
    });

    // ================= 聽到有人說朋友的壞話（由講壞話那一刻引發） =================
    DECIDE.kind('tattle', {
        title: '聽到有人說朋友的壞話', scan: false, pri: 2,
        when() { return null; },
        facts(w, a, c) {
            const I = on(w) ? DK().tattleInfo(w, a, c) : null; if (!I) return '';
            return fill('{s}剛才在你面前說{c}的壞話：「{x}」你跟{c}交情不錯，當場替他說了幾句。要是去告訴{c}，他多半會去找{s}對質，兩個人會吵起來，{s}也會知道是你說的。', { s: I.by.name, c: I.foe.name, x: { raw: I.line } });
        },
        options(w, a, c) {
            const D = DK(); const I = on(w) ? D.tattleInfo(w, a, c) : null; if (!I) return [];
            return [
                { id: 'keep', quiet: true, mute: true, text: '不傳話，免得事情鬧大', say: { k: '沒有把{s}的話傳給{c}', p: { s: I.by.name, c: I.foe.name } }, why: '話傳來傳去只會更難收拾', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'tell', quiet: true, text: { k: '去告訴{c}', p: { c: I.foe.name } }, say: { k: '把{s}說的話告訴了{c}', p: { s: I.by.name, c: I.foe.name } }, why: '朋友被人這樣說，他有權知道',
                    base: REF + tilt(0.35) + clampN((aff(a, I.foe) - 50) / 100, -0.2, 0.4) + clampN(-aff(a, I.by) / 100, -0.3, 0.3) + (has(a, 'gossip') ? 0.3 : 0), lean: { bond: 0.2, safe: -0.2 },
                    run: (w2, a2) => (D.tattleBy(w2, a2, c) ? { k: '{c}去找{s}對質了', p: { c: I.foe.name, s: I.by.name } } : { k: '沒有說成' }) },
            ];
        },
    });

    // ================= 做生意的手法 =================
    const TNAME = { fair: '老老實實做生意', short: '秤頭上動手腳' };
    const tradeInfo = (w, a) => (on(w) ? DK().tradeInfo(w, a) : null);
    DECIDE.kind('trade', {
        title: '做生意的手法', cool: 30, pri: 0.4,
        when(w, a) { const I = tradeInfo(w, a); return I ? { cur: I.cur || '' } : null; },
        facts(w, a) {
            const I = tradeInfo(w, a); if (!I) return '';
            return fill('你是鎮上賣東西的。秤頭和用料上動點手腳，每次被坑的客人會多付 {n} 銀幣進你口袋；客人發現了會來吵，被坑的人會記仇，真相傳開了名聲也會變差。{cur}', { n: I.gain, cur: I.cur ? { k: '你現在的做法是「{x}」。', p: { x: TNAME[I.cur] } } : { raw: '' } });
        },
        options(w, a) {
            const D = DK(); const I = tradeInfo(w, a); if (!I) return []; const set = (k) => (w2, a2) => (D.tradeSet(w2, a2, k) ? null : { k: '沒有改' });
            return [
                { id: 'fair', quiet: true, mute: I.cur !== 'short', text: '老老實實做生意', say: '決定老老實實做生意', why: '生意要做長久，靠的是信用', base: REF, lean: { safe: 0.1 }, run: set('fair') },
                { id: 'short', quiet: true, mute: I.cur === 'short', text: '秤頭和用料上動點手腳，多賺一點', say: '決定在秤頭上動手腳', why: '大家都這樣做，不賺白不賺',
                    base: REF + tilt(0.6) + (has(a, 'greedy') ? 0.3 : 0) + (cash(w, a) < 20 ? 0.2 : 0), lean: { gain: 0.3, safe: -0.3 }, run: set('short') },
            ];
        },
    });

    // ================= 掌櫃經手的帳 =================
    const skimInfo = (w, a) => { try { return on(w) ? CP()?.skimInfo?.(w, a) || null : null; } catch (e) { return null; } };
    DECIDE.kind('skim', {
        title: '掌櫃經手的帳', cool: 7, pri: 0.6,
        when(w, a) { const I = skimInfo(w, a); return I ? { o: I.o.agentId } : null; },
        facts(w, a) {
            const I = skimInfo(w, a); if (!I) return '';
            return fill('你是{o}那家{s}的掌櫃，帳都經你的手。這週從帳上挪走 {n} 銀幣，東家不一定看得出來；被查到會當場丟掉掌櫃的差事，{o}也不會再信你。', { o: I.o.name, s: { raw: I.shop }, n: I.amt });
        },
        options(w, a) {
            const I = skimInfo(w, a); if (!I) return [];
            return [
                { id: 'clean', quiet: true, mute: true, text: '帳照實記', say: '帳照實記，沒有動手腳', why: '東家信得過我才把店交給我', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'skim', quiet: true, text: { k: '從帳上挪 {n} 銀幣進自己口袋', p: { n: I.amt } }, say: { k: '從{s}的帳上挪了 {n} 銀幣', p: { s: { raw: I.shop }, n: I.amt } }, why: '店是我在顧的，多拿一點也應該',
                    base: REF + tilt(0.25) + clampN(-aff(a, I.o) / 100, -0.4, 0.3) + (cash(w, a) < 20 ? 0.3 : 0), lean: { gain: 0.3, safe: -0.3 },
                    run: (w2, a2) => { const r = CP().skimBy(w2, a2); return !r ? { k: '沒有動成' } : r.caught ? { k: '被{o}查帳抓到，丟了掌櫃的差事', p: { o: I.o.name } } : { k: '{o}沒有發現', p: { o: I.o.name } }; } },
            ];
        },
    });

    // ================= 教團的奉獻箱 =================
    const embInfo = (w, a) => { try { return on(w) ? FA()?.embezzleInfo?.(w, a) || null : null; } catch (e) { return null; } };
    DECIDE.kind('embezzle', {
        title: '教團的奉獻箱', cool: 12, pri: 0.6,
        when(w, a) { const I = embInfo(w, a); return I ? { f: I.fund } : null; },
        facts(w, a) {
            const I = embInfo(w, a); if (!I) return '';
            return fill('{r}的奉獻由你保管，現在有 {f} 銀幣，本來是要濟貧、辦節日的。你身上有 {c} 銀幣。拿走 {n} 銀幣不會有人馬上發現；被查出來，信眾都會知道。', { r: I.R.name[0], f: I.fund, c: Math.round(cash(w, a)), n: I.n });
        },
        options(w, a) {
            const I = embInfo(w, a); if (!I) return []; const h = honesty(a);
            return [
                { id: 'clean', quiet: true, mute: true, text: '一枚都不動', say: '沒有動奉獻箱的錢', why: '那是信眾託付的錢', base: REF, lean: { bond: 0.1 }, run: () => null },
                { id: 'take', quiet: true, text: { k: '拿 {n} 銀幣放進自己口袋', p: { n: I.n } }, say: { k: '從奉獻箱拿了 {n} 銀幣', p: { n: I.n } }, why: '我為教團做了這麼多，拿一點不過分',
                    base: REF + tilt(within(0.04, 12)) + clampN((2 - h) * 0.35, -0.9, 0.5) + (has(a, 'greedy') ? 0.4 : 0) + (cash(w, a) < 20 ? 0.3 : 0), lean: { gain: 0.3, bond: -0.3 },
                    run: (w2, a2) => { const r = FA().embezzleBy(w2, a2); return r ? { k: '拿了 {n} 銀幣，沒有人發現', p: { n: r.n } } : { k: '沒有拿成' }; } },
            ];
        },
    });

    // ================= 自己贊成的規定（由規定通過那一刻引發） =================
    const TDO = { steam_air: '在自家工坊偷偷燒最便宜的黑煤', steam_factory: '讓學徒照樣做到半夜', steam_homun: '偷偷叫人造人到自家田裡幹活', bio_gmban: '在市集偷買便宜的基因糧食', bio_safety: '把樣本帶回家、不上鎖', bio_price: '私下把藥加價賣給有錢人', tech_safety: '叫工人跳過核電廠的停機檢查', policy: '私下自己照樣不守' };
    const tfInfo = (w, a, c) => { try { return on(w) ? WY()?.twofaceInfo?.(w, a, c) || null : null; } catch (e) { return null; } };
    DECIDE.kind('twoface', {
        title: '自己贊成的規定', scan: false, pri: 1.5,
        when() { return null; },
        facts(w, a, c) {
            const I = tfInfo(w, a, c); if (!I) return '';
            return fill('「{t}」通過了，你當初投的是贊成。可是照規定做對你自己不方便，你其實想{deed}。私下不守，被人撞見的話很丟臉，大家也會更不相信鎮上的規定。', { t: { raw: I.t }, deed: TDO[c.k] || TDO.policy });
        },
        options(w, a, c) {
            const I = tfInfo(w, a, c); if (!I) return [];
            return [
                { id: 'keep', quiet: true, mute: true, text: '照規定做', say: { k: '照著「{t}」做', p: { t: { raw: I.t } } }, why: '自己投了贊成，就該守', base: REF, lean: { face: 0.1 }, run: () => null },
                { id: 'break', quiet: true, text: { k: '私下照自己的方便來：{deed}', p: { deed: TDO[c.k] || TDO.policy } }, say: { k: '私下沒有守「{t}」', p: { t: { raw: I.t } } }, why: '規定是訂給大家看的，自己的日子還是要過',
                    base: REF + tilt(I.policy ? 0.12 : 0.4) + clampN((2 - honesty(a)) * 0.15, -0.4, 0.3), lean: { gain: 0.2, face: -0.2 },
                    run: (w2, a2) => (WY().twofaceBy(w2, a2, c) ? { k: '目前沒有人看見' } : { k: '沒有做' }) },
            ];
        },
    });

    // ================= 疫情的規定 =================
    const SNEAK_MIN = 0.008; // 幾乎沒動過念頭的人（以前每天不到 0.8% 機率）不問
    const SWHY = { quar: '你正在發燒，照規定要待在家裡。', lock: '封城讓你進不了貨，生意做不下去。', close: '酒館和市集都關著，沒地方去。', mask: '出門都要戴口罩，悶得難受。' };
    const SDO = { quar: '發著燒還是溜出門', lock: '偷偷出城去進貨', close: '從後門溜進關著的酒館喝一杯', mask: '出了家門就把口罩拉到下巴' };
    const sneakInfo = (w, a) => { try { const I = on(w) ? PW()?.sneakInfo?.(w, a) || null : null; return I && I.p >= SNEAK_MIN ? I : null; } catch (e) { return null; } };
    DECIDE.kind('sneak', {
        title: '疫情的規定', cool: 5, pri: 0.7,
        when(w, a) { const I = sneakInfo(w, a); return I ? { k: I.k } : null; },
        facts(w, a) {
            const I = sneakInfo(w, a); if (!I) return '';
            return fill('鎮上現在規定「{r}」，已經 {n} 天。{why}不守的話，你會{deed}。這樣比較容易染病、也可能傳給別人；{g}被逮到很丟臉。{v}{f}',
                { r: I.rule, n: I.days, why: SWHY[I.k] || '', deed: SDO[I.k] || '', g: I.guard ? '鎮上有衛兵在巡，' : { raw: '' }, v: I.voted ? '這條規定你當初投了贊成。' : { raw: '' }, f: I.tired ? '規定實施很久了，不少人已經在偷偷不守。' : { raw: '' } });
        },
        options(w, a) {
            const I = sneakInfo(w, a); if (!I) return [];
            return [
                { id: 'obey', quiet: true, mute: true, text: '照規定來', say: '照著疫情的規定做', why: '忍一忍，大家才撐得過去', base: REF, run: () => null },
                { id: 'sneak', quiet: true, text: { k: '不管規定：{deed}', p: { deed: SDO[I.k] || '' } }, say: { k: '決定不管規定，{deed}', p: { deed: SDO[I.k] || '' } }, why: '就這一次，不會那麼剛好',
                    base: REF + tilt(within(I.p, 5)) - (I.voted ? 0.1 : 0), lean: { joy: 0.3, safe: -0.3 },
                    run: (w2, a2) => (PW().sneakBy(w2, a2) ? { k: '打算找機會溜出去' } : { k: '沒有溜成' }) },
            ];
        },
    });

    // ================= 議會的票、反壟斷的票、選舉的票：塞錢與收錢（v11.11.0） =================
    // 以前：不老實或貪心、有 60 銀幣的提案人 50% 塞錢給會投反對的議員，議員一定收；議員改選時被塞錢的窮人一定收；
    //       被反壟斷案盯上的老闆貪心就一定、其他人一半塞錢給兩個窮人，窮人一定收。
    // 現在：塞的人自己決定塞不塞、塞給誰（老闆也可以公開反駁）；被塞的人用同一種決定（bribeTake），照是誰塞的、為了什麼、塞多少、自己多缺錢、交情、被發現會怎樣來選。
    // 錢只在收下的那一刻才付；收的人還在想的時候，事情（表決、開票）照常進行，晚到的答案就作廢，不會憑空付錢。
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const AL = (w) => { try { return TIERS.LV[TIERS.level(w)] || { council: '鎮議會', member: '鎮議員' }; } catch (e) { return { council: '鎮議會', member: '鎮議員' }; } };
    const live = (w, id) => { const a = id && w.agents[id]; return a && !a.isDead && !a.isPlayer && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) ? a : null; };
    const prop = (w, id) => (w.proposals?.items || []).find(p => p.id === id) || null;
    const ptitle = (w, p) => { try { return w.proposals.title(p); } catch (e) { return p?.id || ''; } };
    const isFam = (w, a, b) => { try { const f = (x) => (typeof MONEY !== 'undefined' ? MONEY.familyOf(w, x) : []); return f(a).includes(b) || f(b).includes(a); } catch (e) { return false; } };
    const tieK = (w, a, b) => (isFam(w, a, b) ? '是一家人' : aff(a, b) >= 60 ? '感情很好' : aff(a, b) >= 25 ? '還算有交情' : aff(a, b) <= -15 ? '之間有過節' : '只是普通交情');
    const tiltN = (ps) => { try { return ORDER.tiltN(ps); } catch (e) { return ps.map(() => REF); } };
    const leanSum = (l) => Object.values(l || {}).reduce((x, y) => x + y, 0);
    const cal = (opts, ps) => { const b = tiltN(ps); opts.forEach((op, i) => { op.base = b[i] - leanSum(op.lean) + (op.adj || 0); delete op.adj; }); return opts; };
    const nmT = (list) => list.map(o => t(o.name)).join(t('、')); // 名字先換成目前的語言（{raw} 不會再翻）
    const memo = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const logx = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, p || {}, who || ''); } catch (e) {} };
    const bumpx = (a, b, n) => { try { if (a && b && a !== b) a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(n); } catch (e) {} };

    // ---------- 提案要送進議會了：要不要私下塞錢給議員（提案人） ----------
    function voteInfo(w, a, c) {
        const p = c && prop(w, c.pid); const A = AS(); if (!p || !A || p.proposerId !== a.agentId || p.council || !['open', 'shelved'].includes(p.status) || day(w) - (c.d ?? 0) > 1) return null;
        const ts = A.lobbyTargets(w, p, a).filter(m => c.n?.[m.agentId] > 0 && live(w, m.agentId)); if (!ts.length) return null;
        const seats = A.seated(w); const yes = seats.filter(m => p.votes?.[m.agentId] === 'for').length;
        return { p, ts, seats: seats.length, yes, c0: Math.floor(cash(w, a)) };
    }
    DECIDE.kind('bribeVote', {
        title: '提案要送進議會了', scan: false, cool: 0, pri: 1.5, aiGroup: 'civic', aiKind: 1, when: () => null,
        facts(w, a, c) { const I = voteInfo(w, a, c); if (!I) return '';
            const list = I.ts.map(m => fill('{m}（你們{tie}，身上有 {c} 銀幣）', { m: m.name, tie: tieK(w, a, m), c: Math.floor(cash(w, m)) })).join(t('、'));
            return fill('你提的「{title}」要送進{council}表決了。{council}有 {n} 席，看起來只有 {y} 位會投贊成。你身上有 {c} 銀幣。還沒表態、可能被說動的議員有：{list}。私下塞錢給他們，收了的人會投贊成；可是有人不收，甚至當眾說出來，這件事被揭穿的話全鎮都會知道。', { title: ptitle(w, I.p), council: AL(w).council, n: I.seats, y: I.yes, c: I.c0, list: { raw: list } }); },
        options(w, a, c) { const I = voteInfo(w, a, c); if (!I) return []; const hn = honesty(a); const A = AS();
            const give = (ms) => (w2, a2) => { const I2 = voteInfo(w2, a2, c); if (!I2) return null; const got = ms.map(m => I2.ts.find(x => x.agentId === m.agentId)).filter(Boolean); let n = 0, sum = 0; const d0 = day(w2);
                for (const m of got) { const x = c.n[m.agentId]; if (cash(w2, a2) < sum + x) break; sum += x; n++; I2.p._lob && (I2.p._lob.wait = (I2.p._lob.wait || 0) + 1); DECIDE.enqueue(w2, m, 'bribeTake', { src: 'council', by: a2.agentId, pid: I2.p.id, n: x, d: d0 }); }
                A.lobbyDone(I2.p, 'pp'); if (!n) return { k: '沒有塞成' }; memo(w2, a2, '我私下找了{m}，想塞錢要他在議會挺我的提案。', { m: { raw: nmT(got.slice(0, n)) } }, 6); return { k: '私下找了{m}', p: { m: { raw: nmT(got.slice(0, n)) } } }; };
            const out = [{ id: 'no', quiet: true, mute: true, text: '不塞錢，讓議會自己決定', say: '沒有塞錢給議員', why: '提案好不好，議員自己會看。', lean: { safe: 0.1 }, adj: (hn >= 2 ? 0.3 : 0) - (has(a, 'greedy') ? 0.2 : 0) - (has(a, 'ambitious') ? 0.2 : 0),
                run: (w2, a2) => { const p = prop(w2, c.pid); if (p) A.lobbyDone(p, 'pp'); return null; } }];
            for (const m of I.ts) out.push({ id: 'give:' + m.agentId, quiet: true, mute: true, text: { k: '私下塞 {n} 銀幣給{m}', p: { n: c.n[m.agentId], m: m.name } }, say: { k: '私下塞錢給議員{m}', p: { m: m.name } }, why: '多一票是一票。', lean: { gain: 0.1 }, adj: clampN(aff(a, m) / 100, -0.3, 0.3), m: I.ts.length > 1 ? 'one' : 'all', run: give([m]) });
            if (I.ts.length > 1) out.push({ id: 'both', quiet: true, mute: true, text: { k: '兩個都塞（一共 {n} 銀幣）', p: { n: I.ts.reduce((s2, m) => s2 + c.n[m.agentId], 0) } }, say: { k: '私下塞錢給議員{m}', p: { m: { raw: nmT(I.ts) } } }, why: '要做就做到底，票才夠。', lean: { gain: 0.1 }, adj: (has(a, 'greedy') ? 0.2 : 0) + (cash(w, a) >= 150 ? 0.2 : 0), m: 'all', run: give(I.ts) });
            const P = { no: 0.5, one: 0.05, all: I.ts.length > 1 ? 0.4 : 0.5 };
            return cal(out, out.map(o => P[o.m || o.id]));
        },
    });

    // ---------- 被反壟斷案盯上：塞錢、不塞，還是公開反駁（老闆） ----------
    function fightInfo(w, a, c) {
        const C = CP(); const p = c && C?.trustP?.(w, c.pid); if (!p || p.status !== 'open' || p.refKey !== a.agentId || day(w) - (c.d ?? 0) > 1 || cash(w, a) < 20) return null;
        const ts = (c.t || []).map(id => live(w, id)).filter(Boolean); const sum = ts.reduce((s2, x) => s2 + (c.n[(c.t || []).indexOf(x.agentId)] || 0), 0);
        let firms = 0; try { firms = MARKET.ownedBy(w, a.agentId).length; } catch (e) {}
        return { p, ts, sum, firms, rebut: !p._rebut, f: p.votes ? Object.values(p.votes).filter(v => v === 'for').length : 0, g: p.votes ? Object.values(p.votes).filter(v => v === 'against').length : 0 };
    }
    DECIDE.kind('trustFight', {
        title: '有人提案要拆你的產業', scan: false, cool: 0, pri: 1.5, aiGroup: 'civic', aiKind: 1, when: () => null,
        facts(w, a, c) { const I = fightInfo(w, a, c); if (!I) return '';
            return fill('鎮上有人提案「{title}」，衝著你來（你名下有 {k} 家產業）。目前投贊成 {f} 票、反對 {g} 票。你身上有 {c} 銀幣。{who}{pub}私下塞錢被報社查到的話，全鎮都會知道。', { title: ptitle(w, I.p), k: I.firms, f: I.f, g: I.g, c: Math.floor(cash(w, a)),
                who: I.ts.length ? { k: '你打聽到{x}手頭很緊，私下塞一點錢（一共 {n} 銀幣），他們多半會投反對。', p: { x: { raw: nmT(I.ts) }, n: I.sum } } : { raw: '' }, pub: I.rebut ? '你也可以公開出來替自己說話：本來就挺你的人會更挺你，本來就討厭你的人會更反感。' : { raw: '' } }); },
        options(w, a, c) { const I = fightInfo(w, a, c); if (!I) return []; const C = CP();
            const out = [{ id: 'no', quiet: true, mute: true, text: '什麼都不做，讓大家投', say: { k: '沒有為{id}去打點', p: { id: I.p.id } }, why: '該是我的就是我的，不必搞那些。', lean: { safe: 0.1 }, adj: (has(a, 'kind') ? 0.6 : 0) + (honesty(a) >= 3 ? 0.3 : 0), run: () => null }];
            if (I.ts.length && cash(w, a) >= I.sum) out.push({ id: 'pay', quiet: true, mute: true, text: { k: '私下塞錢給{x}（一共 {n} 銀幣），請他們投反對', p: { x: { raw: nmT(I.ts) }, n: I.sum } }, say: { k: '為了{id}私下塞錢給村民', p: { id: I.p.id } }, why: '花一點小錢，保住我的店。', lean: { gain: 0.1 },
                adj: (has(a, 'greedy') ? 0.8 : 0) + (hasV(a, '財富') ? 0.6 : 0) - (has(a, 'kind') ? 0.8 : 0) - (honesty(a) >= 3.5 ? 0.4 : 0),
                run: (w2, a2) => { const I2 = fightInfo(w2, a2, c); if (!I2 || !I2.ts.length) return null; const n = C.lobbyPay(w2, I2.p, a2, I2.ts.map(x => x.agentId), I2.ts.map(x => c.n[(c.t || []).indexOf(x.agentId)])); return n ? { k: '私下找了{x}', p: { x: { raw: nmT(I2.ts) } } } : { k: '沒有塞成' }; } });
            if (I.rebut) out.push({ id: 'rebut', quiet: true, text: '公開出來反駁', say: { k: '公開反駁{id}', p: { id: I.p.id } }, why: '我沒做錯事，要說就攤開來說。', lean: { face: 0.2 },
                adj: (has(a, 'charismatic') ? 0.5 : 0) + (has(a, 'abrasive') ? 0.2 : 0) + (honesty(a) >= 3 ? 0.3 : 0) - (has(a, 'shy') ? 0.5 : 0),
                run: (w2, a2) => { const I2 = fightInfo(w2, a2, c); if (!I2 || !I2.rebut) return null; C.rebut(w2, I2.p, a2); return { k: '在大家面前反駁了{id}', p: { id: I2.p.id } }; } });
            const P = { no: 0.35, pay: 0.55, rebut: 0.1 };
            return cal(out, out.map(o => P[o.id]));
        },
    });

    // ---------- 有人私下塞錢來（議員、選民、反壟斷案的投票人共用） ----------
    const BWHY = { council: '要你在議會投贊成', cvote: '要你在選舉投他', mvote: '要你在選舉投他', trust: '要你投反對' };
    function takeInfo(w, a, c) {
        const b = c && live(w, c.by); if (!b || b === a || !BWHY[c.src] || day(w) - (c.d ?? 0) > 1 || cash(w, b) < c.n || !(c.n > 0)) return null; // 塞錢的人走了、錢不夠了、事情過了：這一題作廢
        const A = AS();
        if (c.src === 'council') { const p = prop(w, c.pid); if (!p || !A || p.council || !['open', 'shelved'].includes(p.status) || p.proposerId !== b.agentId || !A.seated(w).includes(a)) return null; return { b, p, title: ptitle(w, p), mine: p.votes?.[a.agentId] || null }; }
        if (c.src === 'cvote') { const E = w.assembly?.elec; if (!E || E.start !== c.e || !['campaign', 'voting'].includes(E.phase) || !E.cands.some(x => x.id === b.agentId) || E.cands.some(x => x.id === a.agentId)) return null; return { b, E, left: E.left }; }
        if (c.src === 'mvote') { const E = w.election; if (!E?.active || !['campaign', 'voting'].includes(E.phase) || !(E.candidates || []).some(x => x.agentId === b.agentId) || (E.candidates || []).some(x => x.agentId === a.agentId)) return null; return { b, E, left: E.campaignDaysLeft || 0 }; }
        if (c.src === 'trust') { const p = CP()?.trustP?.(w, c.pid); if (!p || p.status !== 'open' || p.refKey !== b.agentId) return null; return { b, p, title: ptitle(w, p), mine: p.votes?.[a.agentId] || null }; }
        return null;
    }
    const doneC = (w, c) => { if (c.src === 'council') { const p = prop(w, c.pid); if (p) AS()?.lobbyDone?.(p, 'wait'); } }; // 議員想完了（收不收都一樣）：議會不必再等他
    DECIDE.kind('bribeTake', {
        title: '有人私下塞錢來', scan: false, cool: 0, pri: 1.6, when: () => null,
        facts(w, a, c) { const I = takeInfo(w, a, c); if (!I) return ''; const n = c.n; const m = Math.floor(cash(w, a)); const tie = tieK(w, a, I.b);
            const poor = m < 10 ? '，快連飯都吃不起了' : m < 30 ? '，手頭很緊' : '';
            if (c.src === 'council') return fill('{b}私下拿 {n} 銀幣給你，要你在{council}投他提的「{title}」贊成{mine}。你身上有 {m} 銀幣{poor}，你們{tie}。收了就得投贊成，這件事被揭穿的話，你的議員多半做不下去；你也可以退回，或當眾說出他想收買你（全鎮都會知道）。',
                { b: I.b.name, n, council: AL(w).council, title: I.title, mine: I.mine === 'against' ? '（你原本打算投反對）' : { raw: '' }, m, poor: { raw: t(poor) }, tie });
            if (c.src === 'mvote') return fill('{lead}選舉的候選人{b}私下塞 {n} 銀幣給你，要你投他一票。你身上有 {m} 銀幣{poor}，你們{tie}。收了錢投不投他，沒有人看得到；可是這種事被揭穿的話，大家會知道你收過錢。', { lead: (() => { try { return TIERS.LV[TIERS.level(w)]?.leader || '鎮長'; } catch (e) { return '鎮長'; } })(), b: I.b.name, n, m, poor: { raw: t(poor) }, tie });
            if (c.src === 'cvote') return fill('{member}改選的候選人{b}私下塞 {n} 銀幣給你，要你投他一票（還有 {d} 天開票）。你身上有 {m} 銀幣{poor}，你們{tie}。收了錢投不投他，沒有人看得到；可是這種事被揭穿的話，大家會知道你收過錢。', { member: AL(w).member, b: I.b.name, n, d: Math.max(1, I.left), m, poor: { raw: t(poor) }, tie });
            return fill('{b}私下塞 {n} 銀幣給你，要你在「{title}」投反對，保住他的店。你身上有 {m} 銀幣{poor}，你們{tie}。收了的事被報社查到的話，全鎮都會知道。', { b: I.b.name, n, title: I.title, m, poor: { raw: t(poor) }, tie }); },
        options(w, a, c) { const I = takeInfo(w, a, c); if (!I) return []; const b = I.b.name; const hn = honesty(a); const m = cash(w, a); const v = aff(a, I.b);
            const need = m < 10 ? 0.5 : m < 30 ? 0.25 : m >= 150 ? -0.3 : 0; const clean = (hn >= 4 ? 0.8 : hn >= 3 ? 0.4 : 0) + (has(a, 'perfectionist') ? 0.4 : 0) + (hasV(a, '傳統') ? 0.1 : 0) - (has(a, 'greedy') ? 0.5 : 0) - (hasV(a, '財富') ? 0.3 : 0);
            const near = isFam(w, a, I.b) ? 0.5 : v >= 30 ? 0.3 : v <= -15 ? -0.4 : 0; const A = AS();
            if (c.src === 'council') return cal([
                { id: 'take', quiet: true, mute: true, text: { k: '收下 {n} 銀幣，改投贊成', p: { n: c.n } }, say: { k: '收了{b}的錢，在議會投贊成', p: { b } }, why: '大家都這樣，不差我一個。', lean: { gain: 0.1 }, adj: need - clean + near,
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); if (!I2) { doneC(w2, c); return null; } const ok = A.lobbyTake(w2, I2.p, I2.b, a2, c.n); A.lobbyDone(I2.p, 'wait'); return ok ? { k: '收了 {n} 銀幣', p: { n: c.n } } : null; } },
                { id: 'back', quiet: true, text: '退回去，票照自己的意思投', say: { k: '把{b}的錢退了回去', p: { b } }, why: '這錢我不能收。', lean: { safe: 0.1 }, adj: clean * 0.6 - need * 0.5 + (near > 0 ? 0.2 : 0),
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); doneC(w2, c); if (!I2) return null; memo(w2, a2, '{b}私下想塞錢給我，要我在議會挺他，我退回去了。', { b }, 6); memo(w2, I2.b, '我想塞錢給{a}，他退了回來。', { a: a2.name }, 5); bumpx(I2.b, a2, -3); return { k: '退回去了' }; } },
                { id: 'report', quiet: true, text: '當眾說出他想收買我', say: { k: '當眾揭穿{b}想收買議員', p: { b } }, why: '想用錢買議會，就該讓大家知道。', lean: { face: 0.1 }, adj: clean - need + (v <= -15 ? 0.5 : 0) - (near > 0 ? 0.6 : 0) + (has(a, 'abrasive') ? 0.2 : 0) - (has(a, 'shy') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); doneC(w2, c); if (!I2) return null; const s = DK().secret(w2, { kind: 'lobby', culprit: I2.b.agentId, victim: null, k: '{a}私下想塞 {n} 銀幣給議員{m}，要他在議會挺「{x}」', p: { a: I2.b.name, n: c.n, m: a2.name, x: I2.title } });
                        if (s) DK().reveal(w2, s, a2); try { WY()?.loseFace?.(w2, I2.b, 8); } catch (e) {} bumpx(I2.b, a2, -20); logx(w2, 'council', '📣 {m}在{council}當眾說出：{a}私下拿錢想收買他，要他挺「{x}」。', { m: a2.name, council: AL(w2).council, a: I2.b.name, x: I2.title }, a2.name);
                        memo(w2, I2.b, '我想塞錢給{a}，他竟然當眾說出來，丟臉丟到家了。', { a: a2.name }, 8); return { k: '當眾揭穿了{b}', p: { b } }; } },
            ], [0.8, 0.13, 0.07]);
            const WLx = () => (typeof WALLET !== 'undefined' ? WALLET : null);
            const vtake = (vote) => (w2, a2) => { const I2 = takeInfo(w2, a2, c); const ok = !!I2 && (c.src === 'mvote' ? WLx().voteTake(w2, I2.b, a2, c.n, vote) : A.buyTake(w2, I2.b, a2, c.n, vote)); if (!ok) { vdrop(w2, a2); return null; } return vote ? { k: '收了 {n} 銀幣', p: { n: c.n } } : { k: '收了 {n} 銀幣，沒有答應投他', p: { n: c.n } }; };
            const vdrop = (w2, a2) => { if (c.src === 'mvote') WLx()?.voteDrop?.(w2, a2); else A?.buyDrop?.(w2, a2); };
            if (c.src === 'cvote' || c.src === 'mvote') return cal([
                { id: 'take', quiet: true, mute: true, text: { k: '收下 {n} 銀幣，投他一票', p: { n: c.n } }, say: { k: '收了{b}的錢，答應投他', p: { b } }, why: '有錢拿，投誰不都一樣。', lean: { gain: 0.1 }, adj: need - clean + near,
                    run: vtake(true) },
                { id: 'keep', quiet: true, mute: true, text: { k: '錢收下，票照自己的意思投', p: { n: c.n } }, say: { k: '收了{b}的錢，票照自己的意思投', p: { b } }, why: '錢我收了，票投給誰是我的事。', lean: { gain: 0.1 }, adj: need * 0.6 - clean * 0.4 - near + (has(a, 'greedy') ? 0.3 : 0) + (v <= -10 ? 0.3 : 0),
                    run: vtake(false) },
                { id: 'refuse', quiet: true, text: '不收', say: { k: '沒收{b}的錢', p: { b } }, why: '我的票不賣。', lean: { safe: 0.1 }, adj: clean - need,
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); vdrop(w2, a2); if (!I2) return null; memo(w2, a2, '{b}私下想塞錢買我的票，我沒收。', { b }, 5); memo(w2, I2.b, '我想塞錢給{a}買票，他沒收。', { a: a2.name }, 4); bumpx(I2.b, a2, -2); return { k: '沒收' }; } },
            ], [0.75, 0.12, 0.13]);
            return cal([
                { id: 'take', quiet: true, mute: true, text: { k: '收下 {n} 銀幣，投反對', p: { n: c.n } }, say: { k: '收了{b}的錢，答應投反對', p: { b } }, why: '他給錢，我就幫他這一次。', lean: { gain: 0.1 }, adj: need - clean + near,
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); if (!I2 || !CP().trustTake(w2, I2.p, I2.b, a2, c.n, c.r)) return null; return { k: '收了 {n} 銀幣', p: { n: c.n } }; } },
                { id: 'refuse', quiet: true, text: '不收', say: { k: '沒收{b}的錢', p: { b } }, why: '我的票不賣。', lean: { safe: 0.1 }, adj: clean - need + (v <= -15 ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = takeInfo(w2, a2, c); if (!I2) return null; memo(w2, a2, '{b}私下想塞錢要我在{id}投反對，我沒收。', { b, id: I2.p.id }, 5); memo(w2, I2.b, '我想塞錢給{a}，他沒收。', { a: a2.name }, 4); bumpx(I2.b, a2, -2); return { k: '沒收' }; } },
            ], [0.8, 0.2]);
        },
    });
})();
