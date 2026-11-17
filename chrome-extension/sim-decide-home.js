// RimTown - sim-decide-home.js：v11.9.0 決策核心「家庭、王令、使節，以及把固定的制度開放給提案」
// 以前：已婚夫妻每天擲 2% 懷上，夫妻從來沒商量過；人走了錢一律由配偶子女平分；家人沒錢吃飯，家裡最有錢的人自動代付；
//       親戚被逐出，最親的那位自動收養孩子；單身國王直接娶階層最高的人；聯姻時首長的孩子直接被嫁走；
//       王令照固定順序挑；外交照規則選；王位、議員、代理首長被指到就得接；醜事被揭穿自動辭職；下台的首長自動改當商人；
//       偷竊固定關三天、人口不夠就自動有人搬來、公職薪水表寫死，都沒有人能提案改。
// 現在：什麼時候會發生照舊看天，當事人自己決定怎麼做：
//   要不要生孩子(birthPlan)          想生／再等等／不生了（答案只改機率，懷不懷得上照舊看天；一對夫妻大約一年問一次，處境大變時提早）
//   要不要立遺囑(will)               照規矩平分／多給某一位／留一份給朋友／捐一半給鎮上（60 歲以上或病重時問；三年或家裡大變才再問）
//   家人沒錢吃飯(feedHelp)           替他出／這次不出（一天可能幾十次，不問 AI，照個性與交情決定）
//   親戚的孩子沒人照顧(adopt)         接來家裡養／不接（不接就問下一位，都不接孩子才跟著走）
//   國王要挑誰成婚(royalPick)         向某一位求婚／再等等（被挑上的人走原本的「對方向你求婚」，可以答應或拒絕）
//   要你嫁到盟邦去(wedAway)           答應／拒絕／逃婚
//   這一道王令(decree)               賑災／加稅／減稅／慶典／大赦／宵禁／這次不頒
//   這一季的外交(diploSeason)         派某人出使／送禮／提聯姻／這次不理（被挑上的使節可以推辭）
//   有人要你接這個位子(postOffer)      接／不接／讓給弟妹（王位、議員遞補、代理首長、出使）
//   醜事被揭穿了(scandal)             辭職／否認／道歉但不辭／反咬一口（否認與硬撐照現有的醜聞分數、罷免、議會壓力結算）
//   下台以後做什麼(afterOffice)        去做買賣／回去做原本的工作／去種田
// 家裡的事用預設的 AI 額度；王令、外交、接不接位子、醜事被揭穿用 civic 那一組；輪不到 AI 的照個性決定。
// 另外三條寫死的制度改成可以提案（HOMEPROP）：偷竊罰則（從輕／照舊／從重）、暫停或重新開放收新移民、公職薪水整體調高或調低一級。
// 決策核心沒開、當事人問不到時，照原本的規則跑。必須在 sim-decide.js 之後載入。
'use strict';

const HOME = (() => {
    const D_ = () => (typeof DECIDE !== 'undefined' ? DECIDE : null);
    const on = (w) => { try { return !!D_() && !!w?.observerMode && D_().on(w); } catch (e) { return false; } };
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { if (a && b && a !== b) a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet && a ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const r2 = (n) => Math.round(n * 100) / 100;
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => t(o.name)).join(t('、'));
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && inTown(w, a));
    const mem = (w, a, k, p, imp = 6, cat = 'social') => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', cat, k, p || {}, imp, []); } catch (e) {} };
    const log = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, p || {}, who || ''); } catch (e) {} };
    const honesty = (a) => { try { return typeof DARK !== 'undefined' ? DARK.honesty(a) : 2; } catch (e) { return 2; } };
    // 兩個選項、當天心情起伏 ±0.9 時，起跑分數差多少會讓這個選項大約有 P 的機會被選中（跟 sim-decide-calam.js 同一個算法）
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1;
    const wedTo = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.status === 'married' || b?.relationships?.relationships?.[a?.agentId]?.status === 'married';
    const isKid = (a, o) => (o._parentNames || []).includes(a.name);
    const kin = (a, o) => !!a && !!o && (wedTo(a, o) || isKid(a, o) || isKid(o, a));
    const TIE = { '家人': '是一家人', '很要好': '感情很好', '有交情': '還算有交情', '交情普通': '只是普通交情', '有過節': '之間有過節' };
    const tieOf = (a, b) => { if (kin(a, b)) return TIE['家人']; const v = aff(a, b); return TIE[v >= 50 ? '很要好' : v >= 20 ? '有交情' : v <= -20 ? '有過節' : '交情普通']; };
    const lead = (w) => { try { return (typeof TIERS !== 'undefined' ? TIERS.LV[TIERS.level(w)]?.leader : '') || '鎮長'; } catch (e) { return '鎮長'; } };
    const LV = (w) => { try { return TIERS.LV[TIERS.level(w)] || { council: '鎮議會', member: '鎮議員' }; } catch (e) { return { council: '鎮議會', member: '鎮議員' }; } };
    const jobT = (k) => { try { return (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[k]?.title) || k; } catch (e) { return k; } };

    function S(w) {
        if (!w.home || typeof w.home !== 'object') w.home = {};
        const H = w.home; for (const k of ['bp', 'will', 'hc', 'decl', 'acc', 'pend', 'prev', 'wedNo', 'royalNo', 'asked', 'law', 'st', 'vic', 'thief', 'adopt', 'offer']) if (!H[k] || typeof H[k] !== 'object' || Array.isArray(H[k])) H[k] = {};
        if (!Array.isArray(H.scan)) H.scan = [];
        for (const k of ['throne', 'seat', 'acting', 'envoy']) { if (!H.decl[k] || typeof H.decl[k] !== 'object') H.decl[k] = {}; if (!H.pend[k] || typeof H.pend[k] !== 'object') H.pend[k] = {}; }
        if (!H.acc.acting || typeof H.acc.acting !== 'object') H.acc.acting = {};
        return H;
    }
    const stat = (w, k, n = 1) => { const H = S(w); H.st[k] = (H.st[k] || 0) + n; };
    // 問一個人（事件當下）：人在鎮上、而且有選項才送出去；回 false 的話呼叫的地方照原本的規則
    function ask(w, a, kind, ctx) {
        if (!on(w) || !inTown(w, a)) return false; const K = D_().KINDS[kind]; if (!K) return false;
        let ops = []; try { ops = K.options(w, a, ctx) || []; } catch (e) { console.warn('[Home] options', kind, e); ops = []; } if (!ops.length) return false;
        D_().askNow(w, [{ a, kind, ctx }]); return true;
    }
    const kindBase = { scan: false, cool: 0, when: () => null };
    const civ = (n) => ({ aiGroup: 'civic', aiKind: n });

    // ================= 生孩子 =================
    // 答案只改機率：想生的稍微提高，再等等大幅降低，不生了趨近零。乘數照「沒開 AI 時整體出生數跟以前差不多」調過（見回報的新舊對照）
    const MULT = { want: 1.35, wait: 0.3, no: 0.03 };
    const ckey = (A, B) => (A.agentId < B.agentId ? A.agentId + '|' + B.agentId : B.agentId + '|' + A.agentId);
    function couple(w, a) {
        const r = a?.relationships?.getPartner?.(); if (!r || r.status !== 'married') return null; const b = w.agents[r.targetId]; if (!b || b.isDead || b.isPlayer || a.isPlayer) return null;
        const ks = npcs(w).filter(o => isKid(a, o) || isKid(b, o)); const ys = ks.map(o => o.age ?? 16);
        return { a, b, r, k: ckey(a, b), kids: ks, young: ys.length ? Math.min(...ys) : null, days: Math.max(0, Math.floor((w.tickCount - (r.statusSince || 0)) / 96)), snap: { n: ks.length, j: (a.job ? 0 : 1) + (b.job ? 0 : 2), h: String(a.homeLocation || '') + '/' + String(b.homeLocation || '') } };
    }
    // 另一半的意願（寫進事實，也影響傾向）
    function wish(w, p, o, n) {
        const s = 0.3 + (hasV(p, '家庭') ? 0.8 : 0) + (has(p, 'romantic') ? 0.3 : 0) - (n >= 3 ? 1.0 : n >= 2 ? 0.4 : 0) - ((p.age ?? 30) >= 38 ? 0.6 : 0) - (!p.job ? 0.4 : 0) - (cash(w, p) < 20 ? 0.3 : 0) + clampN((aff(p, o) - 40) / 80, -0.4, 0.4) - (hasV(p, '自由') ? 0.4 : 0) - (has(p, 'ambitious') ? 0.2 : 0);
        return s >= 0.6 ? 'want' : s <= -0.3 ? 'no' : 'maybe';
    }
    function birthMult(w, A, B) {
        if (!on(w)) return 1; const H = S(w); const I = couple(w, A); const k = ckey(A, B); const d = day(w);
        const rec = H.bp[k]; if (!I) return rec ? (MULT[rec.k] ?? 1) : 1;
        const due = !rec || d - rec.d >= 60 || (d - rec.d >= 10 && (rec.n !== I.snap.n || rec.j !== I.snap.j || rec.h !== I.snap.h));
        if (due && !((H.asked.bp?.[k] ?? -99) >= d - 3)) { // 剛問過還沒回（等 AI）就不重複問
            (H.asked.bp || (H.asked.bp = {}))[k] = d;
            const first = !rec ? A : (rec.by === A.agentId ? B : A); const second = first === A ? B : A; // 兩個人輪流被問
            if (!ask(w, first, 'birthPlan', { k, d })) ask(w, second, 'birthPlan', { k, d });
        }
        const r = H.bp[k]; return r ? (MULT[r.k] ?? 1) : 1;
    }
    const WISH = { want: '{b}很想要孩子。', maybe: '{b}說都可以，看你。', no: '{b}說不想再生了。' };
    const BPS = { want: '想生孩子', wait: '再等等', no: '不生了' };
    DECIDE.kind('birthPlan', Object.assign({}, kindBase, {
        title: '要不要生孩子', pri: 1.2,
        facts(w, a, ctx) {
            const I = couple(w, a); if (!I || I.k !== ctx?.k) return ''; const b = I.b; const pw = wish(w, b, a, I.kids.length); const rec = S(w).bp[I.k];
            return fill('你跟{b}結婚 {d} 天了，你們{tie}（你對{b}的好感 {f}）。{kids}你今年 {age} 歲，{b}{bage} 歲。你身上有 {c} 銀幣，{b}有 {bc} 銀幣。{job}{wish}{last}想不想要是你們的事，生不生得出來還是要看天。', {
                b: b.name, d: I.days, tie: tieOf(a, b), f: Math.round(aff(a, b)), age: a.age ?? 30, bage: b.age ?? 30, c: Math.floor(cash(w, a)), bc: Math.floor(cash(w, b)),
                kids: I.kids.length ? { k: '你們已經有 {n} 個孩子（{x}）。', p: { n: I.kids.length, x: { raw: names(I.kids) } } } : '你們還沒有孩子。',
                job: !a.job ? '你現在沒有工作。' : !b.job ? { k: '{b}現在沒有工作。', p: { b: b.name } } : { raw: '' }, wish: { k: WISH[pw], p: { b: b.name } },
                last: rec ? { k: '上次你們說好「{x}」。', p: { x: BPS[rec.k] || '再等等' } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const I = couple(w, a); if (!I || I.k !== ctx?.k) return []; const b = I.b; const n = I.kids.length; const pw = wish(w, b, a, n); const H = S(w);
            const age = Math.max(a.age ?? 30, b.age ?? 30); const poor = cash(w, a) + cash(w, b) < 40; const jobless = !a.job || !b.job;
            const want = REF + tilt(0.72) + (hasV(a, '家庭') ? 0.5 : 0) + (has(a, 'romantic') ? 0.2 : 0) + (pw === 'want' ? 0.35 : pw === 'no' ? -0.5 : 0) + clampN((aff(a, b) - 50) / 100, -0.3, 0.3)
                - (n >= 3 ? 0.6 : n >= 2 ? 0.2 : 0) - (age >= 38 ? 0.4 : 0) - (jobless ? 0.35 : 0) - (poor ? 0.3 : 0) - (hasV(a, '自由') ? 0.3 : 0) - (has(a, 'ambitious') ? 0.2 : 0);
            const no = REF + tilt(0.1) + (n >= 2 ? 0.4 : 0) + (n >= 3 ? 0.6 : 0) + (age >= 40 ? 0.5 : 0) + (pw === 'no' ? 0.4 : 0) - (hasV(a, '家庭') ? 0.4 : 0);
            const set = (w2, a2, k) => { const I2 = couple(w2, a2); if (!I2) return null; S(w2).bp[I2.k] = { k, d: day(w2), by: a2.agentId, n: I2.snap.n, j: I2.snap.j, h: I2.snap.h }; stat(w2, 'bp_' + k);
                const b2 = I2.b; const pw2 = wish(w2, b2, a2, I2.kids.length); mem(w2, b2, '{a}跟我商量孩子的事，說{x}。', { a: a2.name, x: BPS[k] }, 6, 'relationship');
                if ((pw2 === 'want' && k !== 'want') || (pw2 === 'no' && k === 'want')) { bump(b2, a2, -3); mem(w2, b2, '我跟{a}對孩子的事想法不一樣，心裡有點悶。', { a: a2.name }, 6, 'relationship'); }
                return { k: k === 'want' ? '跟{b}說好要生孩子' : k === 'no' ? '跟{b}說好不生了' : '跟{b}說好孩子的事再等等', p: { b: b2.name } }; };
            return [
                { id: 'want', quiet: true, text: '想生孩子', say: { k: '跟{b}說想要孩子', p: { b: b.name } }, why: n ? '家裡再多一個孩子會更熱鬧。' : '我們想要一個自己的孩子。', base: want, lean: { bond: 0.3, joy: 0.1 }, run: (w2, a2) => set(w2, a2, 'want') },
                { id: 'wait', quiet: true, text: '再等等', say: { k: '跟{b}說孩子的事再等等', p: { b: b.name } }, why: '現在還不是時候。', base: REF, lean: { safe: 0.2 }, run: (w2, a2) => set(w2, a2, 'wait') },
                { id: 'no', text: '不生了', say: { k: '跟{b}說不想再生了', p: { b: b.name } }, why: n ? '家裡的孩子已經夠了。' : '我不想要孩子。', base: no, lean: { safe: 0.2, joy: 0.1 }, run: (w2, a2) => set(w2, a2, 'no') },
            ];
        },
    }));

    // ================= 遺囑 =================
    // 繼承人跟 sim-wallet.js 同一套：配偶與子女（出遠門的也算，在那邊另外加）
    const heirsOf = (w, a) => Object.values(w.agents || {}).filter(o => o && o !== a && !o.isPlayer && !o.isDead && (wedTo(o, a) || isKid(a, o)));
    const hhash = (L) => L.map(o => o.agentId).sort().join(',');
    const sick = (w, a) => { try { return typeof HEALTH !== 'undefined' && w.health && HEALTH.deathMult(w, a) >= 2; } catch (e) { return false; } };
    function willDue(w, a) {
        if ((a.age ?? 30) < 60 && !sick(w, a)) return false; const H = S(w); const d = day(w); const rec = H.will[a.agentId];
        if ((H.asked.will?.[a.agentId] ?? -99) >= d - 5) return false;
        if (!rec) return true; return d - rec.d >= 180 || (d - rec.d >= 15 && rec.h !== hhash(heirsOf(w, a)));
    }
    function willInfo(w, a) {
        const hs = heirsOf(w, a); const H = S(w);
        const care = hs.slice().sort((x, y) => aff(y, a) - aff(x, a))[0] || null; const dear = hs.slice().sort((x, y) => aff(a, y) - aff(a, x))[0] || null;
        const fr = npcs(w).filter(o => o !== a && !hs.includes(o) && (o.age ?? 30) >= 16 && aff(a, o) >= 40).sort((x, y) => aff(a, y) - aff(a, x))[0] || null;
        let dep = 0; try { dep = Math.floor(w.bank?.dep?.[a.agentId] || 0); } catch (e) {}
        return { hs, care, dear, fr, dep, c: Math.floor(cash(w, a)), tr: Math.floor(w.stockpile?.get?.('silver') || 0), rec: H.will[a.agentId] || null };
    }
    const WILLK = { even: '照規矩平分', fav: '多留給{x}', friend: '留三成給朋友{x}', town: '捐一半給鎮上' };
    DECIDE.kind('will', Object.assign({}, kindBase, {
        title: '要不要立遺囑', pri: 1,
        facts(w, a) {
            const I = willInfo(w, a); const hs = I.hs;
            return fill('你今年 {age} 歲{sick}，開始想身後的事。你身上有 {c} 銀幣{dep}。{heirs}{care}{fr}公庫現在有 {tr} 銀幣。{last}', {
                age: a.age ?? 60, sick: sick(w, a) ? '，身體很差' : { raw: '' }, c: I.c, dep: I.dep > 0 ? { k: '，銀行裡還有 {n}', p: { n: I.dep } } : { raw: '' },
                heirs: hs.length ? { k: '照規矩，你走了以後錢由{x}平分，產業和房子給{y}。', p: { x: { raw: names(hs) }, y: (MARKET_ok() ? MARKET.heirsAll(w, a)[0] : hs[0])?.name || hs[0].name } } : '你沒有配偶和孩子，照規矩錢會歸公庫。',
                care: hs.length >= 2 && I.care ? { k: '家人裡最常來看你的是{x}（他對你的好感 {f}），你最疼的是{y}（你對他的好感 {g}）。', p: { x: I.care.name, f: Math.round(aff(I.care, a)), y: I.dear.name, g: Math.round(aff(a, I.dear)) } } : { raw: '' },
                fr: I.fr ? { k: '你最要好的朋友是{x}（好感 {f}），不在繼承的名單上。', p: { x: I.fr.name, f: Math.round(aff(a, I.fr)) } } : { raw: '' },
                tr: I.tr, last: I.rec ? { k: '你之前立的遺囑是「{x}」。', p: { x: { k: WILLK[I.rec.k] || WILLK.even, p: { x: w.agents[I.rec.to]?.name || '' } } } } : { raw: '' } });
        },
        options(w, a) {
            const I = willInfo(w, a); const hs = I.hs; const out = [];
            const set = (k, to) => (w2, a2) => { const H = S(w2); H.will[a2.agentId] = { k, to: to || null, d: day(w2), h: hhash(heirsOf(w2, a2)) }; stat(w2, 'will_' + k); const o = to ? w2.agents[to] : null;
                const x = { k: WILLK[k], p: { x: o?.name || '' } }; mem(w2, a2, '我立好了遺囑：{x}。', { x }, 7, 'economy'); if (k !== 'even') log(w2, 'social', '📜 {a}立了遺囑：{x}。', { a: a2.name, x }, a2.name);
                return { k: '立了遺囑：{x}', p: { x } }; };
            out.push({ id: 'even', quiet: true, text: hs.length ? '照規矩，由家人平分' : '照規矩，留給公庫', say: '照規矩立了遺囑', why: hs.length ? '都是自己的骨肉，一碗水端平。' : '沒有家人，就留給鎮上吧。', base: REF + tilt(0.7) + (has(a, 'stoic') ? 0.2 : 0), lean: { safe: 0.2, bond: 0.1 }, run: set('even') });
            if (hs.length >= 2) for (const o of [...new Set([I.care, I.dear].filter(Boolean))]) {
                const gap = (aff(a, o) - hs.filter(x => x !== o).reduce((s, x) => s + aff(a, x), 0) / Math.max(1, hs.length - 1)) + (aff(o, a) - 50) / 2;
                out.push({ id: 'fav:' + o.agentId, text: { k: '多留一些給{x}（一半給他，其餘大家平分；產業和房子也給他）', p: { x: o.name } }, say: { k: '遺囑多留給{x}', p: { x: o.name } }, why: o === I.care ? { k: '{x}照顧我最多，該多拿一點。', p: { x: o.name } } : { k: '我最放心不下{x}。', p: { x: o.name } },
                    base: REF + tilt(0.12) + clampN(gap / 40, -0.4, 0.7) + (has(a, 'jealous') || has(a, 'abrasive') ? 0.2 : 0), lean: { bond: 0.2 }, run: set('fav', o.agentId) });
            }
            if (I.fr) out.push({ id: 'friend:' + I.fr.agentId, text: { k: '留三成給好朋友{x}，其餘照規矩', p: { x: I.fr.name } }, say: { k: '遺囑留一份給{x}', p: { x: I.fr.name } }, why: { k: '{x}陪我走了這麼多年。', p: { x: I.fr.name } },
                base: REF + tilt(0.08) + (hs.length ? 0 : 0.6) + clampN((aff(a, I.fr) - 60) / 60, 0, 0.4) + (has(a, 'generous') ? 0.2 : 0) - (hasV(a, '家庭') ? 0.3 : 0), lean: { bond: 0.3 }, run: set('friend', I.fr.agentId) });
            if (hs.length) out.push({ id: 'town', text: '捐一半給鎮上，其餘照規矩', say: '遺囑捐一半給鎮上', why: '鎮上養了我一輩子，該還一點回去。', base: REF + tilt(0.05) + (hasV(a, '社群') ? 0.4 : 0) + (has(a, 'generous') ? 0.3 : 0) + (has(a, 'kind') ? 0.1 : 0) - (has(a, 'greedy') ? 0.4 : 0) - (hasV(a, '家庭') ? 0.3 : 0), lean: { bond: 0.2, face: 0.2 }, run: set('town') });
            return out;
        },
    }));
    const MARKET_ok = () => typeof MARKET !== 'undefined' && !!MARKET.heirsAll;
    // 遺囑指定多給的那一位排第一（產業、房子、補繳的遺產稅都歸他）
    function heirOrder(w, npc, L) { const rec = w?.home?.will?.[npc?.agentId]; if (!rec || rec.k !== 'fav' || !Array.isArray(L)) return L; const i = L.findIndex(o => o && o.agentId === rec.to); if (i <= 0) return L; const out = L.slice(); const [x] = out.splice(i, 1); out.unshift(x); return out; }
    // 立過遺囑的照遺囑分；錢只在人與人、人與公庫之間移動（先全部算好再付）。回 false＝照原本的規矩
    function estateSplit(w, npc, heirs, estate) {
        const H = w.home; const rec = H?.will?.[npc?.agentId]; if (!rec || rec.done || rec.k === 'even' || !(estate > 0)) return false;
        const hs = (heirs || []).filter(Boolean); const plan = []; const evenTo = (n) => { if (!hs.length) { plan.push([null, n]); return; } const base = Math.floor(n / hs.length * 100 + 1e-6) / 100; hs.forEach((h, i) => plan.push([h, i === 0 ? r2(n - base * (hs.length - 1)) : base])); };
        let to = null, why = '';
        if (rec.k === 'fav') { to = hs.find(h => h.agentId === rec.to); if (!to || hs.length < 2) return false; const half = r2(estate * 0.5); plan.push([to, half]); evenTo(r2(estate - half)); why = '多留給{x}'; }
        else if (rec.k === 'friend') { to = w.agents[rec.to]; if (!to || to.isDead || to.isPlayer) return false; const part = r2(estate * 0.3); plan.push([to, part]); evenTo(r2(estate - part)); why = '留三成給朋友{x}'; }
        else if (rec.k === 'town') { if (!hs.length) return false; const half = r2(estate * 0.5); plan.push([null, half]); evenTo(r2(estate - half)); why = '捐一半給鎮上'; }
        else return false;
        const sum = r2(plan.reduce((s, x) => s + x[1], 0)); if (Math.abs(sum - estate) > 0.001) plan[plan.length - 1][1] = r2(plan[plan.length - 1][1] + (estate - sum));
        rec.done = 1; const got = new Map();
        for (const [o, n] of plan) { if (!(n > 0)) continue; if (o) { WALLET.add(w, o, n); got.set(o, r2((got.get(o) || 0) + n)); } else w.stockpile?.add?.('silver', n, w.tickCount, t('遺囑捐給鎮上')); }
        for (const [o, n] of got) o.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', '繼承了{name}留下的 {n} 銀幣。', { name: npc.name, n }, 6, [npc.name]);
        const x = { k: why, p: { x: to?.name || '' } }; log(w, 'economy', '📜 {name}的遺囑公開了：{x}。', { name: npc.name, x }, npc.name); stat(w, 'willDone_' + rec.k);
        // 被少分的家人會知道、會有感覺
        const even = hs.length ? estate / hs.length : 0;
        for (const h of hs) { const g = got.get(h) || 0; if (h === to || g >= even - 0.5 || h._travel) continue; h.moodModifier = (h.moodModifier || 0) - 4; h.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', '{name}的遺囑{x}，我只分到 {n} 銀幣。', { name: npc.name, x, n: Math.round(g) }, 7, [npc.name]); if (to) bump(h, to, rec.k === 'fav' ? -8 : -5); }
        return true;
    }

    // ================= 家人沒錢吃飯：接不接濟（不問 AI，照個性與交情） =================
    const helpN = (w, a, h) => { const L = (S(w).hc[a.agentId + '|' + h.agentId] || []).filter(x => x > day(w) - 30); S(w).hc[a.agentId + '|' + h.agentId] = L; return L.length; };
    DECIDE.kind('feedHelp', Object.assign({}, kindBase, {
        title: '家人沒錢吃飯', pri: 0.5, noAi: true,
        facts(w, h, ctx) { const a = w.agents[ctx?.to]; if (!a) return ''; return fill('{a}身上沒錢吃飯，要靠你出今天的飯錢（{n} 銀幣）。你們{tie}。你身上有 {c} 銀幣。這個月你已經替他出過 {k} 次。', { a: a.name, n: ctx.n, tie: tieOf(h, a), c: Math.floor(cash(w, h)), k: helpN(w, a, h) }); },
        options(w, h, ctx) {
            const a = w.agents[ctx?.to]; if (!a || a === h) return []; const k = helpN(w, a, h); const c = cash(w, h); const f = aff(h, a);
            // 大多數人照樣會出（以前一定出）；真的處不來、自己也快吃不上飯、或對方好吃懶做一直伸手的，才可能不出。量過：不出的比例太高，全鎮挨餓的人次會明顯變多
            const no = REF + (f <= -50 ? 2.0 : f <= -30 ? 1.4 : f <= -10 ? 0.5 : 0) + (c < ctx.n * 2 + 5 ? 0.3 : 0) + (has(a, 'lazy') && k >= 4 ? 0.4 : 0) + (k >= 10 ? 0.3 : 0) + (has(h, 'greedy') ? 0.3 : 0) + (has(h, 'thrifty') ? 0.1 : 0)
                - (has(h, 'kind') ? 0.5 : 0) - (hasV(h, '家庭') ? 0.4 : 0) - (has(h, 'generous') ? 0.3 : 0) - (wedTo(h, a) ? 0.3 : 0);
            return [
                { id: 'pay', quiet: true, mute: true, text: { k: '替他出飯錢（{n} 銀幣）', p: { n: ctx.n } }, say: { k: '替{a}出了飯錢', p: { a: a.name } }, why: '一家人，總不能看他餓肚子。', base: REF + tilt(0.99), lean: { bond: 0.3 },
                    run: (w2, h2) => { const L = S(w2).hc[a.agentId + '|' + h2.agentId] || (S(w2).hc[a.agentId + '|' + h2.agentId] = []); L.push(day(w2)); return null; } },
                { id: 'no', quiet: true, text: '這次不出', say: { k: '這次不肯替{a}出飯錢', p: { a: a.name } }, why: f <= -10 ? '他平常那樣對我，憑什麼要我養他。' : c < ctx.n * 2 + 5 ? '我自己也快沒錢了。' : '老是靠別人，總要學著自己想辦法。', base: no, lean: { gain: 0.2, safe: 0.1 },
                    run: (w2, h2) => { stat(w2, 'feedNo'); bump(a, h2, -4); mem(w2, a, '{h}不肯替我出飯錢，我今天只能餓著。', { h: h2.name }, 6); mem(w2, h2, '{a}又沒錢吃飯，這次我沒有替他出。', { a: a.name }, 4); log(w2, 'social', '🍚 {h}這次不肯替{a}出飯錢。', { h: h2.name, a: a.name }, h2.name); return { k: '沒有替{a}出飯錢', p: { a: a.name } }; } },
            ];
        },
    }));
    // 照個性當場決定（跟決策核心沒有 AI 時同一套：傾向分數加上當天的心情起伏），記進本人的決定
    function ruleNow(w, a, key, ctx) {
        const Dc = D_(); const K = Dc.KINDS[key]; let ops = []; try { ops = K.options(w, a, ctx) || []; } catch (e) { return null; } if (!ops.length) return null;
        const Ln = Dc.lean(w, a); let best = null, bs = -Infinity; for (const op of ops) { const s = Dc.score(Ln, op) + (Math.random() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } }
        let res = null; try { res = best.run(w, a, ctx) || null; } catch (e) { console.warn('[Home] run', key, e); }
        try { Dc.record(w, Dc.S(w), a, K, best, best.why || null, res, 'rule', day(w), ctx); } catch (e) {}
        return best.id;
    }
    function helpOk(w, h, a, cost) {
        if (!on(w) || !h || !a || (h.age ?? 30) < 16) return true; const H = S(w); const d = day(w); if (!H.hd || H.hd.d !== d) H.hd = { d, m: {} };
        const key = h.agentId + '|' + a.agentId; if (key in H.hd.m) return H.hd.m[key];
        const id = ruleNow(w, h, 'feedHelp', { to: a.agentId, n: r2(cost) }); const ok = id !== 'no'; H.hd.m[key] = ok; return ok;
    }

    // ================= 親戚的孩子沒人照顧：接不接 =================
    function adoptAsk(w, c, p, pool) {
        if (!on(w) || !c || !(pool || []).length) return false; const H = S(w);
        H.adopt[c.agentId] = { p: p?.name || '', q: pool.map(o => o.agentId), d: day(w) }; adoptNext(w, c.agentId); return true;
    }
    function adoptNext(w, cid) {
        const H = S(w); const R = H.adopt[cid]; const c = w.agents[cid]; if (!R) return; if (!c || c.isDead) { delete H.adopt[cid]; return; }
        while (R.q.length) { const r = w.agents[R.q.shift()]; if (r && !r.isDead && ask(w, r, 'adopt', { c: cid, d: day(w) })) return; }
        delete H.adopt[cid]; stat(w, 'adoptNone');
        log(w, 'social', '🧒 沒有親戚肯收留{c}，只好跟著{p}離開了小鎮。', { c: c.name, p: R.p }, c.name);
        try { w.leaveTown?.(c.agentId, t('跟著{p}一起搬走').replace('{p}', R.p)); } catch (e) { console.warn('[Home] adopt leave', e); }
    }
    DECIDE.kind('adopt', Object.assign({}, kindBase, {
        title: '親戚的孩子沒人照顧', pri: 2,
        facts(w, r, ctx) { const R = S(w).adopt[ctx?.c]; const c = w.agents[ctx?.c]; if (!R || !c) return ''; const own = npcs(w).filter(o => isKid(r, o) && (o.age ?? 30) < 16).length;
            return fill('{p}被逐出小鎮了，留下{c}（{age} 歲）。{c}跟你{tie}，{c}對你的好感 {f}。你可以把{c}接來家裡養，以後就是你的孩子；不接的話會再問別的親戚，都沒人接，{c}就得跟著{p}走。你身上有 {m} 銀幣{own}。', { p: R.p, c: c.name, age: c.age ?? 10, tie: tieOf(r, c), f: Math.round(aff(c, r)), m: Math.floor(cash(w, r)), own: own ? { k: '，家裡已經有 {n} 個孩子要養', p: { n: own } } : { raw: '' } }); },
        options(w, r, ctx) {
            const R = S(w).adopt[ctx?.c]; const c = w.agents[ctx?.c]; if (!R || !c || c.isDead || r === c) return []; const own = npcs(w).filter(o => isKid(r, o) && (o.age ?? 30) < 16).length;
            return [
                { id: 'take', text: { k: '把{c}接來家裡養', p: { c: c.name } }, say: { k: '收養了{c}', p: { c: c.name } }, why: '孩子沒有錯，不能讓他沒人管。', lean: { bond: 0.4, safe: -0.1 },
                    base: REF + tilt(0.85) + clampN(aff(r, c) / 60, -0.3, 0.5) + (hasV(r, '家庭') ? 0.4 : 0) + (has(r, 'kind') ? 0.4 : 0) - (cash(w, r) < 30 ? 0.4 : 0) - (own >= 3 ? 0.3 : 0),
                    run: (w2, r2_) => { const R2 = S(w2).adopt[ctx.c]; const c2 = w2.agents[ctx.c]; if (!R2 || !c2) return null; delete S(w2).adopt[ctx.c];
                        c2._parentNames = [...(c2._parentNames || []), r2_.name]; c2._guardian = r2_.agentId; log(w2, 'event', '👪 {p}被逐出小鎮，{c}留了下來，由{r}收養。', { p: R2.p, c: c2.name, r: r2_.name }, r2_.name);
                        mem(w2, r2_, '{p}被趕出小鎮，我把{c}接來家裡養。', { p: R2.p, c: c2.name }, 8); mem(w2, c2, '{p}被趕出小鎮了，我留下來跟{r}一起住。', { p: R2.p, r: r2_.name }, 9); c2.moodModifier = (c2.moodModifier || 0) - 10;
                        try { const X = EXILE.S(w2); X.st.adopted = (X.st.adopted || 0) + 1; } catch (e) {} stat(w2, 'adopt'); return { k: '把{c}接回家了', p: { c: c2.name } }; } },
                { id: 'no', text: '不接', say: { k: '沒有收養{c}', p: { c: c.name } }, why: '我自己都顧不好了。', base: REF + (has(r, 'greedy') ? 0.3 : 0) + (has(r, 'abrasive') ? 0.3 : 0), lean: { safe: 0.3, gain: 0.1 },
                    run: (w2, r2_) => { const c2 = w2.agents[ctx.c]; if (c2) { bump(c2, r2_, -15); mem(w2, c2, '{r}不肯收留我。', { r: r2_.name }, 8); mem(w2, r2_, '我沒有把{c}接來家裡。', { c: c2.name }, 6); } stat(w2, 'adoptNo'); adoptNext(w2, ctx.c); return { k: '沒有接{c}', p: { c: c2?.name || '' } }; } },
            ];
        },
    }));

    // ================= 國王要挑誰成婚 =================
    function royalAsk(w, k, list) {
        if (!on(w) || !inTown(w, k) || typeof CIVIC === 'undefined') return false; const H = S(w); const d = day(w);
        const cands = list.filter(o => inTown(w, o) && !((H.royalNo[o.agentId] ?? -1) > d)).slice(0, 3); if (!cands.length) return true; // 人選都拒絕過：這次不成婚
        return ask(w, k, 'royalPick', { c: cands.map(o => o.agentId), r: cands[0].agentId, d });
    }
    const lvOf = (w, a) => { try { return CLASS.level(w, a); } catch (e) { return 0; } };
    const rCands = (w, k, ctx) => (ctx?.c || []).map(id => w.agents[id]).filter(o => o && !o.isDead && !o.relationships?.getPartner?.() && o !== k);
    DECIDE.kind('royalPick', Object.assign({}, kindBase, {
        title: '國王要挑誰成婚', pri: 1.5,
        facts(w, k, ctx) { const L = rCands(w, k, ctx); if (!L.length) return '';
            return fill('你是國王，到現在還沒有成婚，大臣們催你早點成家。人選有：{x}。被你挑中的人可以答應，也可以拒絕。', { x: { raw: L.map(o => fill('{n}（{age} 歲，階層 {lv}，你對他的好感 {f}，他對你的好感 {g}）', { n: o.name, age: o.age ?? 25, lv: lvOf(w, o), f: Math.round(aff(k, o)), g: Math.round(aff(o, k)) })).join(t('、')) } }); },
        options(w, k, ctx) {
            if (k.relationships?.getPartner?.()) return []; const L = rCands(w, k, ctx); if (!L.length) return [];
            const out = L.map(o => ({ id: 'pick:' + o.agentId, quiet: true, text: { k: '向{n}求婚', p: { n: o.name } }, say: { k: '挑了{n}，向他求婚', p: { n: o.name } }, why: aff(k, o) >= 30 ? { k: '我一直很欣賞{n}。', p: { n: o.name } } : '這門親事對王室最好。', lean: { bond: 0.2, face: 0.2 },
                base: REF + 0.8 + (o.agentId === ctx.r ? 0.9 : 0) + clampN(aff(k, o) / 40, -0.6, 0.8) * (has(k, 'romantic') ? 1.5 : 1) + (has(k, 'ambitious') || hasV(k, '權力') ? lvOf(w, o) * 0.08 : 0),
                run: (w2, k2) => { const b = w2.agents[o.agentId]; if (!b || !ask(w2, b, 'proposed', { by: k2.agentId, royal: 1, d: day(w2) })) return { k: '沒有說成' }; return { k: '向{n}求婚了', p: { n: o.name } }; } }));
            out.push({ id: 'wait', quiet: true, mute: true, text: '再等等，現在不想成婚', say: '還不想成婚', why: '終身大事，急不得。', base: REF - 0.2 + (hasV(k, '自由') ? 0.5 : 0) + (has(k, 'shy') ? 0.2 : 0), lean: { safe: 0.1 }, run: () => null });
            return out;
        },
    }));
    // 被國王挑上：接到原本的「對方向你求婚」（proposed），多一種來意（ctx.royal）
    const royalOk = (w, a, c) => { const k = c ? w.agents[c.by] : null; return k && !k.isDead && k !== a && !k.relationships?.getPartner?.() && !a.relationships?.getPartner?.() && w.crown?.king === k.agentId ? k : null; };
    function hookProposed() {
        const P0 = D_()?.KINDS?.proposed; if (!P0 || P0._home) return; P0._home = 1; const f0 = P0.facts, o0 = P0.options;
        P0.facts = function (w, a, c) { if (!c?.royal) return f0.call(this, w, a, c); const k = royalOk(w, a, c); if (!k) return '';
            return fill('國王{k}（{age} 歲）向你求婚。你對國王的好感是 {f}。答應的話你就成了王族，搬進王宮；拒絕國王，他會很沒面子。', { k: k.name, age: k.age ?? 40, f: Math.round(aff(a, k)) }); };
        P0.options = function (w, a, c) { if (!c?.royal) return o0.call(this, w, a, c); const k = royalOk(w, a, c); if (!k) return [];
            return [
                { id: 'later', text: '婉拒國王', say: { k: '婉拒了國王{k}的求婚', p: { k: k.name } }, why: '我不想過那種日子。', base: REF + (hasV(a, '自由') ? 0.4 : 0) + (aff(a, k) <= -20 ? 0.6 : 0), lean: { safe: 0.1, joy: 0.1 },
                    run: (w2, a2) => { const k2 = w2.agents[c.by]; const H = S(w2); H.royalNo[a2.agentId] = day(w2) + 60; stat(w2, 'royalNo'); if (k2) { k2.moodModifier = (k2.moodModifier || 0) - 6; bump(k2, a2, -10); mem(w2, k2, '我向{b}求婚，被拒絕了。', { b: a2.name }, 8, 'relationship'); if (w2.crown) w2.crown.legit = Math.max(0, w2.crown.legit - 1); }
                        mem(w2, a2, '國王向我求婚，我拒絕了。', {}, 8, 'relationship'); log(w2, 'event', '💔 {b}婉拒了國王{k}的求婚。', { b: a2.name, k: k2?.name || '' }, a2.name); return { k: '婉拒了國王' }; } },
                { id: 'yes', text: '答應國王', say: { k: '答應了國王{k}的求婚', p: { k: k.name } }, why: '能嫁進王室，是天大的福氣。', base: REF + tilt(0.85) + clampN(aff(a, k) / 60, -0.4, 0.4) + (hasV(a, '權力') ? 0.4 : 0) + (has(a, 'ambitious') ? 0.3 : 0) - (hasV(a, '自由') ? 0.4 : 0), lean: { face: 0.3, bond: 0.1 },
                    run: (w2, a2) => { const k2 = royalOk(w2, a2, c); if (!k2 || !CIVIC.royalWed(w2, k2, a2)) return { k: '來不及了' }; stat(w2, 'royalYes'); return { k: '嫁給了國王{k}', p: { k: k2.name } }; } },
            ]; };
    }
    hookProposed();

    // ================= 聯姻：被嫁出去的人 =================
    const wedSkip = (w, a) => (w?.home?.wedNo?.[a?.agentId] ?? -1) > day(w);
    const loverOf = (w, a) => { const r = a?.relationships?.getPartner?.(); const b = r && r.status === 'dating' ? w.agents[r.targetId] : null; return b && !b.isDead && inTown(w, b) ? b : null; };
    const rebel = (a) => has(a, 'abrasive') || hasV(a, '自由') || hasV(a, '冒險');
    function wedAsk(w, D, p, L, pick) {
        if (!on(w) || !inTown(w, pick)) return false; return ask(w, pick, 'wedAway', { pid: p.id, by: L?.agentId || null, d: day(w) });
    }
    const placeOf = (w, pid) => (typeof DIPLO !== 'undefined' ? DIPLO.places(w).find(x => x.id === pid) : null);
    function wedFacts(w, a, ctx) {
        const p = placeOf(w, ctx?.pid); if (!p) return null; const D = DIPLO.S(w); if (D.wed[p.id] || D.status[p.id] !== 'ally') return null; const L = ctx.by ? w.agents[ctx.by] : null;
        const fam = npcs(w).filter(o => o !== a && kin(a, o) && inTown(w, o)); return { p, L, fam, lover: loverOf(w, a), D };
    }
    DECIDE.kind('wedAway', Object.assign({}, kindBase, {
        title: '要你嫁到盟邦去', pri: 2,
        facts(w, a, ctx) { const I = wedFacts(w, a, ctx); if (!I) return '';
            return fill('{l}要你嫁到{p}去，跟那邊的人成親，兩地結為親家。嫁過去就要永遠離開小鎮。{p}是我們的盟友，這門親事對小鎮很重要。{l2}{fam}{lover}', { l: I.L?.name || lead(w), p: DIPLO.pname(I.p), l2: I.L ? { k: '你跟{l}{tie}。', p: { l: I.L.name, tie: tieOf(a, I.L) } } : { raw: '' },
                fam: I.fam.length ? { k: '你的家人{x}都在鎮上。', p: { x: { raw: names(I.fam) } } } : '你在鎮上沒有家人。', lover: I.lover ? { k: '你正在跟{b}交往。', p: { b: I.lover.name } } : { raw: '' } }); },
        options(w, a, ctx) {
            const I = wedFacts(w, a, ctx); if (!I) return []; const pn = DIPLO.pname(I.p); const b = I.lover; const out = [];
            out.push({ id: 'yes', text: { k: '答應，嫁到{p}去', p: { p: pn } }, say: { k: '答應遠嫁{p}', p: { p: pn } }, why: '為了小鎮，我願意。', lean: { bond: 0.2, face: 0.3, safe: -0.2 },
                base: REF + tilt(0.85) - (b ? 1.0 : 0) + clampN(aff(a, I.L) / 100, -0.3, 0.3) + (hasV(a, '社群') || hasV(a, '權力') ? 0.3 : 0) + (hasV(a, '冒險') ? 0.3 : 0) - (I.fam.length >= 3 ? 0.2 : 0),
                run: (w2, a2) => { const I2 = wedFacts(w2, a2, ctx); if (!I2) return { k: '來不及了' }; stat(w2, 'wedYes'); DIPLO.wedDo(w2, I2.D, I2.p, a2); return { k: '遠嫁{p}', p: { p: pn } }; } });
            out.push({ id: 'no', text: '拒絕', say: { k: '不肯遠嫁{p}', p: { p: pn } }, why: b ? { k: '我心裡只有{b}。', p: { b: b.name } } : '我的終身大事要自己作主。', lean: { safe: 0.2, joy: 0.1 },
                base: REF + (b ? 0.8 : 0) + (hasV(a, '自由') ? 0.4 : 0) + (has(a, 'abrasive') ? 0.3 : 0) + (hasV(a, '家庭') ? 0.2 : 0),
                run: (w2, a2) => { const I2 = wedFacts(w2, a2, ctx); if (!I2) return null; wedRefuse(w2, I2, a2, false); return { k: '拒絕了這門親事' }; } });
            if (b || rebel(a)) out.push({ id: 'run', text: b ? { k: '跟{b}連夜私奔', p: { b: b.name } } : '連夜逃走，躲到外地', say: '逃婚', why: b ? { k: '誰都不能把我跟{b}拆開。', p: { b: b.name } } : '我才不要被人當成禮物送走。', lean: { joy: 0.3, face: -0.2 },
                base: REF + tilt(0.08) + (b ? 0.8 : 0) + (has(a, 'abrasive') ? 0.3 : 0) + (hasV(a, '冒險') ? 0.2 : 0),
                run: (w2, a2) => { const I2 = wedFacts(w2, a2, ctx); if (!I2) return null; wedRefuse(w2, I2, a2, true); return { k: '逃婚了' }; } });
            return out;
        },
    }));
    // 拒絕與逃婚的後果：兩地關係、首長的面子、本人跟首長的交情（逃婚更重）；這個人 60 天內不會再被提
    function wedRefuse(w, I, a, ran) {
        const H = S(w); const d = day(w); H.wedNo[a.agentId] = d + 60; const pn = DIPLO.pname(I.p); const L = I.L && !I.L.isDead ? I.L : null; const b = loverOf(w, a);
        DIPLO.bump(w, I.p.id, ran ? -20 : -10); stat(w, ran ? 'wedRun' : 'wedNo');
        if (L) { bump(L, a, ran ? -20 : -12); bump(a, L, ran ? -8 : -6); L.moodModifier = (L.moodModifier || 0) - (ran ? 6 : 3); mem(w, L, ran ? '{a}為了不嫁去{p}連夜逃走，我在盟友面前丟盡了臉。' : '{a}不肯嫁去{p}，盟友那邊覺得被冷落了。', { a: a.name, p: pn }, 8); }
        try { if (L && w.crown?.king === L.agentId) w.crown.legit = Math.max(0, w.crown.legit - (ran ? 4 : 2)); } catch (e) {}
        if (!ran) { DIPLO.note(w, '🙅 {a}不肯遠嫁{p}，對方覺得受了冷落。', { a: a.name, p: pn }); mem(w, a, '{l}要我嫁去{p}，我拒絕了。', { l: L?.name || lead(w), p: pn }, 8); return; }
        if (b) { DIPLO.note(w, '🏃 {a}不肯遠嫁{p}，連夜跟{b}私奔，兩人偷偷成了親。{p}那邊很不高興。', { a: a.name, b: b.name, p: pn }); try { w.marry?.(a, b); } catch (e) {} mem(w, a, '我不要嫁去{p}，跟{b}私奔成親了。', { p: pn, b: b.name }, 9, 'relationship'); }
        else { DIPLO.note(w, '🏃 {a}不肯遠嫁{p}，連夜逃到外地躲了起來。{p}那邊很不高興。', { a: a.name, p: pn }); mem(w, a, '我不要被送去{p}，先逃到外地躲幾天。', { p: pn }, 9); try { w.events?._sendAgentTravelling?.(w, a, tpl('逃婚躲到外地', {}), 5); } catch (e) {} }
    }

    // ================= 這一道王令 =================
    function decreeAsk(w, k, r) { if (!on(w) || !inTown(w, k) || typeof CROWN === 'undefined') return false; return ask(w, k, 'decree', { r, d: day(w) }); }
    function decreeInfo(w, k) {
        const C = w.crown; if (!C || C.king !== k.agentId) return null; const tr = Math.floor(w.stockpile?.get?.('silver') || 0); const tax = w.wallet?.tax ?? 0.1;
        const poor = npcs(w).filter(a => (a.age ?? 30) >= 16 && cash(w, a) < 10).length; const I = w.proposals?.issues || {}; const hungry = !!(I.poverty || I.food);
        const last = (C.decrees || []).slice(-1)[0] || null; let op = null; try { op = w.mind?.op || null; } catch (e) {}
        const foes = npcs(w).filter(a => a !== k && (aff(a, k) <= -20 || (op?.[a.agentId]?.king ?? 0) <= -1.2)).sort((x, y) => aff(x, k) - aff(y, k));
        return { C, tr, tax, poor, hungry, last, foes, legit: Math.round(C.legit) };
    }
    const DTXT = { relief: '頒賑災令：從公庫撥錢給窮人（每人最多 15 銀幣）', tax_up: '頒加稅令：稅率加到 {n}%', tax_down: '頒減稅令：稅率降到 {n}%', festival: '辦王室慶典（公庫出最多 80 銀幣，給食堂和農莊）', amnesty: '頒大赦令：免掉還在服的公共勞役', curfew: '頒宵禁令：晚上不准出門' };
    const DWHY = { relief: '百姓餓著肚子，王室不能不管。', tax_up: '公庫空了，什麼事都辦不成。', tax_down: '百姓的日子太苦了，先讓大家喘口氣。', festival: '讓大家開心一下，也讓人記得王室的好。', amnesty: '給犯過錯的人一個重新開始的機會。', curfew: '最近太亂了，得管一管。' };
    DECIDE.kind('decree', Object.assign({}, kindBase, civ(1), {
        title: '這一道王令', pri: 2.5,
        facts(w, k, ctx) { const I = decreeInfo(w, k); if (!I) return '';
            const DC = CROWN.DECREES; const dn = (key) => (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? DC[key]?.en : DC[key]?.zh;
            return fill('又到了頒布王令的時候。公庫有 {tr} 銀幣，稅率 {tax}%，民心 {lg}/100。鎮上有 {poor} 個大人身上不到 10 銀幣{hun}。{last}{foe}', { tr: I.tr, tax: Math.round(I.tax * 100), lg: I.legit, poor: I.poor, hun: I.hungry ? '，有人在挨餓' : { raw: '' },
                last: I.last ? { k: '上一道王令是{n}（{d} 天前）。', p: { n: { raw: dn(I.last.key) || '' }, d: Math.max(0, day(w) - I.last.day) } } : '你還沒有頒過王令。',
                foe: I.foes.length ? { k: '{x}在背後罵你（一共有 {n} 個人對你很不滿）。', p: { x: { raw: names(I.foes.slice(0, 3)) }, n: I.foes.length } } : '最近沒聽到有人罵你。' }); },
        options(w, k, ctx) {
            // 原本會挑的那一道起跑分數多 2（沒開 AI 時各種王令的次數跟以前差不多），個性只在邊際上改變；各選項的傾向（lean）壓小，不然愛享受的國王一直辦慶典
            const I = decreeInfo(w, k); if (!I) return []; const r = ctx?.r; const out = []; const lowL = I.legit < 40; const tax = I.tax;
            const add = (key, ok, adj, lean, p) => { if (!ok) return; out.push({ id: key, text: { k: DTXT[key], p: p || {} }, say: { k: '頒布了{n}', p: { n: CROWN.DECREES[key].zh } }, why: DWHY[key], base: REF + (key === r ? 2.0 : 0) + adj, lean,
                run: (w2) => { const rec = CROWN.issue(w2, key, ''); if (!rec) return null; stat(w2, 'decree_' + key); return { k: '頒布了{n}', p: { n: CROWN.DECREES[key].zh } }; } }); };
            add('relief', I.poor > 0 && I.tr > 0, (has(k, 'kind') ? 0.4 : 0) + (hasV(k, '社群') ? 0.3 : 0) - (has(k, 'greedy') ? 0.3 : 0), { bond: 0.1 });
            add('tax_up', tax < 0.3, (has(k, 'greedy') || hasV(k, '權力') ? 0.4 : 0) - (lowL ? 0.6 : 0) - (has(k, 'kind') ? 0.3 : 0), { gain: 0.1 }, { n: Math.round(Math.min(0.3, tax + 0.05) * 100) });
            add('tax_down', tax > 0.03, (has(k, 'kind') ? 0.2 : 0) + (lowL ? 0.3 : 0) - (has(k, 'greedy') ? 0.3 : 0), { bond: 0.1 }, { n: Math.round(Math.max(0.03, tax - 0.05) * 100) });
            add('festival', true, (has(k, 'charismatic') ? 0.3 : 0) + (has(k, 'optimist') ? 0.2 : 0) - (has(k, 'thrifty') ? 0.3 : 0), { joy: 0.1 });
            add('amnesty', true, (has(k, 'kind') ? 0.3 : 0), { bond: 0.1 });
            add('curfew', true, (has(k, 'abrasive') ? 0.3 : 0) + (hasV(k, '權力') ? 0.2 : 0) - (lowL ? 0.4 : 0), { safe: 0.1 });
            out.push({ id: 'none', quiet: true, text: '這次不頒', say: '這次沒有頒王令', why: '現在這樣就好，不必多事。', base: REF - 0.9 + (has(k, 'lazy') ? 0.4 : 0) + (I.legit >= 70 && !I.hungry ? 0.3 : 0), lean: { safe: 0.2 },
                run: (w2, k2) => { stat(w2, 'decree_none'); log(w2, 'event', '📜 國王{k}這次沒有頒布王令。', { k: k2.name }, k2.name); return null; } });
            return out;
        },
    }));
    // AI 寫的理由當作詔書（只改紀錄上的那一句，結算不變）
    try { D_()?.observe((ev, o) => { if (ev !== 'decided' || o.K?.key !== 'decree' || o.src !== 'ai' || !o.why) return; const C = o.w?.crown; const rec = C?.decrees?.slice(-1)[0]; if (rec && rec.day === day(o.w) && !rec.text && rec.key === String(o.op?.id)) rec.text = String(tx(o.why)).slice(0, 60); }); } catch (e) {}

    // ================= 這一季的外交 =================
    function diploAsk(w, D, L, rc) { if (!on(w) || !inTown(w, L) || typeof DIPLO === 'undefined' || !DIPLO.places(w).length) return false; return ask(w, L, 'diploSeason', { r: rc || null, d: day(w) }); }
    function diploInfo(w, L) {
        const D = DIPLO.S(w); const ps = DIPLO.places(w); if (!ps.length) return null; const rel = (p) => D.rel[p.id] || 0;
        const worst = ps.slice().sort((a, b) => rel(a) - rel(b))[0]; const best = ps.filter(p => rel(p) >= 25 && D.status[p.id] !== 'ally').sort((a, b) => rel(b) - rel(a))[0];
        const ally = ps.find(p => D.status[p.id] === 'ally' && !D.wed[p.id]); const goods = (w.goods?.town || []).filter(x => !x.rel && !x.gift);
        return { D, ps, worst, best, ally, goods, envT: best || worst, cands: DIPLO.envoys(w, L).filter(o => inTown(w, o) && !((S(w).decl.envoy[o.agentId] ?? -1) > day(w))).slice(0, 2) };
    }
    const stName = (D, p) => { const st = DIPLO.statusOf(D.rel[p.id] || 0, D, p.id); return DIPLO.ST[st][1]; };
    const envTrait = (e) => has(e, 'charismatic') ? '，很會說話' : has(e, 'kind') ? '，待人和氣' : has(e, 'abrasive') ? '，說話很衝' : '';
    DECIDE.kind('diploSeason', Object.assign({}, kindBase, civ(1), {
        title: '這一季的外交', pri: 2.2,
        facts(w, L) { const I = diploInfo(w, L); if (!I) return '';
            return fill('又到了決定外交的時候。我們跟各地的關係：{list}。公庫裡有 {g} 件珍品可以當禮物。{ally}', { list: { raw: I.ps.map(p => fill('{p}（{r}，{st}）', { p: DIPLO.pname(p), r: Math.round(I.D.rel[p.id] || 0), st: stName(I.D, p) })).join(t('、')) }, g: I.goods.length,
                ally: I.ally ? { k: '{p}是我們的盟友，兩地還沒有聯姻。', p: { p: DIPLO.pname(I.ally) } } : { raw: '' } }); },
        options(w, L, ctx) {
            const I = diploInfo(w, L); if (!I) return []; const r = ctx?.r || []; const out = [];
            I.cands.forEach((e, i) => out.push({ id: 'envoy:' + e.agentId, text: { k: '派{e}出使{p}（{e}{tr}）', p: { e: e.name, p: DIPLO.pname(I.envT), tr: envTrait(e) || { raw: '' } } }, say: { k: '派{e}出使{p}', p: { e: e.name, p: DIPLO.pname(I.envT) } }, why: '多走動，關係才會好。', lean: { bond: 0.2 },
                base: REF + (r[0] === 'envoy' && i === 0 ? 1.5 : 0) + (i === 0 ? 0.3 : 0) + clampN(aff(L, e) / 60, -0.3, 0.3),
                run: (w2, L2) => { stat(w2, 'diplo_envoy'); envoyOffer(w2, L2, I.envT.id, I.cands.map(x => x.agentId), e.agentId); return { k: '找{e}出使{p}', p: { e: e.name, p: DIPLO.pname(I.envT) } }; } }));
            if (I.goods.length) { const tg = r[0] === 'gift' ? (I.ps.find(p => p.id === r[1]) || I.worst) : I.worst;
                out.push({ id: 'gift', text: { k: '把一件珍品送給{p}當禮物', p: { p: DIPLO.pname(tg) } }, say: { k: '送禮給{p}', p: { p: DIPLO.pname(tg) } }, why: '送點東西，人家才會記得我們的好。', lean: { bond: 0.2, gain: -0.2 },
                    base: REF + (r[0] === 'gift' ? 1.5 : 0) + (has(L, 'generous') ? 0.2 : 0) - (has(L, 'greedy') ? 0.3 : 0),
                    run: (w2) => { stat(w2, 'diplo_gift'); return DIPLO.act(w2, DIPLO.S(w2), 'gift', tg.id) ? { k: '送了禮給{p}', p: { p: DIPLO.pname(tg) } } : null; } }); }
            if (I.ally) out.push({ id: 'wed', text: { k: '提議跟{p}聯姻', p: { p: DIPLO.pname(I.ally) } }, say: { k: '提議跟{p}聯姻', p: { p: DIPLO.pname(I.ally) } }, why: '結了親家，盟約才牢靠。', lean: { bond: 0.2, face: 0.2 },
                base: REF + (r[0] === 'wed' ? 1.5 : 0) + (hasV(L, '權力') ? 0.2 : 0),
                run: (w2) => { stat(w2, 'diplo_wed'); return DIPLO.act(w2, DIPLO.S(w2), 'wed', I.ally.id) ? { k: '提了聯姻' } : null; } });
            out.push({ id: 'none', quiet: true, text: '這次不理', say: '這一季沒有外交行動', why: '鎮上自己的事都忙不完了。', base: REF - 0.8 + (has(L, 'lazy') ? 0.4 : 0) + (has(L, 'shy') ? 0.2 : 0), lean: { safe: 0.2 },
                run: (w2) => { stat(w2, 'diplo_none'); return null; } });
            return out;
        },
    }));
    // 首長挑的使節可以推辭：推辭就換下一位人選，都推辭就這次不派
    function envoyOffer(w, L, pid, list, first) {
        const H = S(w); const q = [first, ...list.filter(id => id !== first)]; H.offer.envoy = { pid, by: L.agentId, q, d: day(w) }; envoyNext(w);
    }
    function envoyNext(w) {
        const H = S(w); const O = H.offer.envoy; if (!O) return; const L = w.agents[O.by]; const p = placeOf(w, O.pid);
        while (O.q.length) { const e = w.agents[O.q.shift()]; if (e && L && p && ask(w, e, 'postOffer', { post: 'envoy', pid: O.pid, by: O.by, d: day(w) })) return; }
        H.offer.envoy = null; if (L && p) { stat(w, 'envoyNone'); DIPLO.note(w, '🕊️ {a}找不到人願意出使{p}，這次只好作罷。', { a: L.name, p: DIPLO.pname(p) }); }
    }

    // ================= 有人要你接這個位子 =================
    const POSTQ = { throne: 0.92, seat: 0.88, acting: 0.92, envoy: 0.9 };
    function postInfo(w, a, ctx) {
        const post = ctx?.post; const d = day(w); if (!POSTQ[post]) return null;
        if (post === 'throne') { if (typeof CROWN === 'undefined' || CROWN.king(w) || w.crown?.republic) return null; const prev = (w.crown?.history || []).slice(-1)[0]; const sib = npcs(w).filter(o => o !== a && prev && isKid({ name: prev.name }, o) && (o.age ?? 30) >= 16 && inTown(w, o) && !((S(w).decl.throne[o.agentId] ?? -1) > d)); return { post, prev, sib, lg: Math.round(w.crown?.legit ?? 50) }; }
        if (post === 'seat') { if ((w.council?.members || []).includes(a.agentId)) return null; return { post }; }
        if (post === 'acting') { const E = w.election; if (!E || E._realMayor?.(w) || a.job?.key === 'mayor') return null; return { post, m: ctx.m || '' }; }
        if (post === 'envoy') { const O = S(w).offer.envoy; const p = placeOf(w, ctx.pid); const L = w.agents[ctx.by]; if (!O || !p || !L || O.pid !== ctx.pid) return null; return { post, p, L }; }
        return null;
    }
    DECIDE.kind('postOffer', Object.assign({}, kindBase, civ(2), {
        title: '有人要你接這個位子', pri: 2.4,
        facts(w, a, ctx) { const I = postInfo(w, a, ctx); if (!I) return ''; const Lw = LV(w);
            if (I.post === 'throne') return fill('國王{p}走了，照順位王位由你繼承。{sib}接下王位，國事都要你扛；你也可以不接，讓給下一位，或指定讓給弟妹。民心現在是 {lg}/100。', { p: I.prev?.name || '', sib: I.sib.length ? { k: '你的弟妹有{x}。', p: { x: { raw: names(I.sib) } } } : { raw: '' }, lg: I.lg });
            if (I.post === 'seat') return fill('{c}有空位，大家推舉你遞補當{m}。當了要常去開會、替大家表決；你可以接，也可以推辭，推辭就換下一位。', { c: Lw.council, m: Lw.member });
            if (I.post === 'acting') return fill('{l}現在不在，大家想請你暫時代理{l2}，替鎮上拍板，等{m}回來或補選完就交還。你可以推辭，推辭就換別人。', { l: lead(w), l2: lead(w), m: I.m || lead(w) });
            return fill('{l}想派你出使{p}，要離開小鎮幾天，替兩地說好話。你跟{l}{tie}。你可以推辭，{l}會改找別人。', { l: I.L.name, p: DIPLO.pname(I.p), tie: tieOf(a, I.L) }); },
        options(w, a, ctx) {
            const I = postInfo(w, a, ctx); if (!I) return []; const H = S(w); const post = I.post; const Lw = LV(w);
            const kids = npcs(w).some(o => isKid(a, o) && (o.age ?? 30) < 16);
            const yes = REF + tilt(POSTQ[post]) + (has(a, 'ambitious') ? 0.4 : 0) + (hasV(a, '權力') ? 0.4 : 0) + (has(a, 'charismatic') ? 0.2 : 0) - (has(a, 'shy') ? 0.5 : 0) - (has(a, 'lazy') ? 0.3 : 0) - (hasV(a, '自由') ? 0.2 : 0) - ((a.mood ?? 50) < 35 ? 0.3 : 0) - ((a.age ?? 30) >= 70 ? 0.4 : 0)
                + (post === 'envoy' ? (hasV(a, '冒險') ? 0.3 : 0) - (kids ? 0.3 : 0) + clampN(aff(a, I.L) / 100, -0.3, 0.3) : 0);
            const no = REF + (has(a, 'ascetic') ? 0.2 : 0);
            const TXT = { throne: ['接下王位', '不接，讓給下一位'], seat: [{ k: '接下{m}的位子', p: { m: Lw.member } }, '推辭'], acting: [{ k: '暫時代理{l}', p: { l: lead(w) } }, '推辭'], envoy: [{ k: '出使{p}', p: { p: I.p ? DIPLO.pname(I.p) : '' } }, '推辭'] }[post];
            const out = [
                { id: 'yes', text: TXT[0], say: TXT[0], why: post === 'throne' ? '這是我的責任。' : '大家看得起我，就做做看。', base: yes, lean: { face: 0.4, safe: -0.2 }, run: (w2, a2) => postYes(w2, a2, ctx) },
                { id: 'no', text: TXT[1], say: { k: '推辭了：{x}', p: { x: TXT[0] } }, why: post === 'throne' ? '我擔不起這個位子。' : '我沒那個心力。', base: no, lean: { safe: 0.3, joy: 0.1 }, run: (w2, a2) => postNo(w2, a2, ctx) },
            ];
            if (post === 'throne') for (const s of I.sib.filter(o => aff(a, o) >= 20).slice(0, 2)) out.push({ id: 'yield:' + s.agentId, text: { k: '讓給{s}', p: { s: s.name } }, say: { k: '把王位讓給{s}', p: { s: s.name } }, why: { k: '{s}比我更適合。', p: { s: s.name } },
                base: REF + tilt(0.08) + (has(a, 'kind') ? 0.3 : 0) + (aff(a, s) >= 60 ? 0.3 : 0) - (has(a, 'ambitious') ? 0.5 : 0), lean: { bond: 0.3 }, run: (w2, a2) => postYield(w2, a2, s.agentId) });
            return out;
        },
    }));
    function postYes(w, a, ctx) {
        const H = S(w); const d = day(w); const post = ctx.post;
        if (post === 'throne') { H.offer.throne = null; if (CROWN.king(w)) return { k: '王位已經有人了' }; CROWN.crown(w, a, 'heir'); stat(w, 'throneYes'); return { k: '接下了王位' }; }
        if (post === 'envoy') { H.offer.envoy = null; const p = placeOf(w, ctx.pid); const L = w.agents[ctx.by]; if (!p || !L) return null; stat(w, 'envoyYes'); return DIPLO.envoy(w, DIPLO.S(w), p, L, a) ? { k: '出使{p}', p: { p: DIPLO.pname(p) } } : { k: '沒去成' }; }
        delete H.pend[post][a.agentId];
        if (post === 'acting') { H.acc.acting[a.agentId] = d; stat(w, 'actingYes'); if (H._sync === a.agentId) H.res[a.agentId] = 'yes'; return { k: '答應暫時代理{l}', p: { l: lead(w) } }; }
        stat(w, 'seatYes'); if (H._sync === a.agentId) { H.res[a.agentId] = 'yes'; return { k: '答應遞補' }; }
        return seatJoin(w, a, ctx.mode);
    }
    function postNo(w, a, ctx) {
        const H = S(w); const d = day(w); const post = ctx.post; stat(w, post + 'No');
        if (post === 'throne') { H.decl.throne[a.agentId] = d + 3650; H.offer.throne = null; log(w, 'event', '👑 {a}不肯接王位，說自己擔不起。', { a: a.name }, a.name); mem(w, a, '王位輪到我，我沒有接。', {}, 9); try { CROWN.succession(w); } catch (e) {} return { k: '沒有接王位' }; }
        if (post === 'envoy') { H.decl.envoy[a.agentId] = d + 20; const L = w.agents[ctx.by]; if (L) { bump(L, a, -3); mem(w, a, '{l}要我出使，我推辭了。', { l: L.name }, 5); } envoyNext(w); return { k: '推辭了出使' }; }
        H.decl[post][a.agentId] = d + (post === 'seat' ? 30 : 20); delete H.pend[post][a.agentId];
        log(w, 'council', post === 'seat' ? '🏛️ {a}推辭了{m}的位子，換下一位。' : '🏛️ {a}推辭了代理{m}的工作，換別人。', { a: a.name, m: post === 'seat' ? LV(w).member : lead(w) }, a.name);
        if (H._sync === a.agentId) { H.res[a.agentId] = 'no'; return { k: '推辭了' }; }
        if (post === 'acting') { const E = w.election; if (E?.acting?.agentId === a.agentId) { E.acting = null; try { E._checkMayor(w); } catch (e) {} } }
        return { k: '推辭了' };
    }
    function postYield(w, a, sid) {
        const H = S(w); H.decl.throne[a.agentId] = day(w) + 3650; H.offer.throne = null; const s = w.agents[sid]; stat(w, 'throneYield');
        if (!s) { try { CROWN.succession(w); } catch (e) {} return null; }
        log(w, 'event', '👑 {a}把王位讓給了{b}。', { a: a.name, b: s.name }, a.name); mem(w, a, '我把王位讓給了{b}。', { b: s.name }, 9);
        if (ask(w, s, 'postOffer', { post: 'throne', d: day(w), by: a.agentId })) H.offer.throne = { id: sid, d: day(w) }; else { try { CROWN.succession(w); } catch (e) {} }
        return { k: '讓位給{b}', p: { b: s.name } };
    }
    // 王位：還在等回話就先等；都不接回 'none'（進繼承危機）
    function throneAsk(w, heirs) {
        if (!on(w)) return null; const H = S(w); const d = day(w); const T = H.offer.throne;
        if (T && d - T.d <= 2 && w.agents[T.id] && !w.agents[T.id].isDead) return 'asked';
        const list = heirs.filter(h => !((H.decl.throne[h.agentId] ?? -1) > d)); if (!list.length) return 'none';
        for (const h of list) { if (ask(w, h, 'postOffer', { post: 'throne', d })) { if (!CROWN.king(w) && !H.offer.throne && !(H.decl.throne[h.agentId] > d)) H.offer.throne = { id: h.agentId, d }; return 'asked'; } }
        return null;
    }
    // 議員遞補：'yes' 接、'no' 不接（往下找）、'wait' 等他回話（席位先空著）
    function offerSync(w, a, post, ctx) { const H = S(w); H.res = H.res || {}; delete H.res[a.agentId]; H._sync = a.agentId; let asked = false; try { asked = ask(w, a, 'postOffer', Object.assign({ post, d: day(w) }, ctx || {})); } finally { H._sync = null; } if (!asked) return 'yes'; const r = H.res[a.agentId]; delete H.res[a.agentId]; if (r) return r; H.pend[post][a.agentId] = day(w); return 'wait'; }
    function seatOk(w, a, mode) {
        if (!on(w) || !a) return 'yes'; const H = S(w); const d = day(w);
        if ((H.decl.seat[a.agentId] ?? -1) > d) return 'no'; const p = H.pend.seat[a.agentId]; if (p != null && d - p <= 1) return 'wait';
        return offerSync(w, a, 'seat', { mode });
    }
    // 晚一點才答應（等 AI 回話）的：自己補進議會
    function seatJoin(w, a, mode) {
        const C = w.council; if (!C || !Array.isArray(C.members) || C.members.includes(a.agentId)) return { k: '席次已經滿了' }; const Lw = LV(w);
        let want = 5; try { want = typeof ASSEMBLY !== 'undefined' ? ASSEMBLY.wantSeats(w) : Math.min(TIERS.seats(w), Math.max(3, Math.floor(npcs(w).length / 3))); } catch (e) {}
        if (C.members.filter(id => w.agents[id]).length >= want) return { k: '席次已經滿了' }; C.members.push(a.agentId);
        if (mode === 'runner') { try { const R = ASSEMBLY.R(w, a.agentId); R.since = day(w); R.terms = (R.terms || 0) + 1; } catch (e) {} log(w, 'council', '🏛️ {name}是上次{council}改選票數最高的落選者，遞補空出來的席次。', { name: a.name, council: Lw.council }, a.name); mem(w, a, '有人出缺，我以上次落選第一高票遞補進{council}。', { council: Lw.council }, 7); }
        else { log(w, 'council', '🏛️ {council}有空位，大家推舉{name}遞補為{member}。', { council: Lw.council, name: a.name, member: Lw.member }, a.name); mem(w, a, '大家推舉我進{council}，我得好好做。', { council: Lw.council }, 7); }
        return { k: '遞補進了{c}', p: { c: Lw.council } };
    }
    // 代理首長：不肯接的跳過；30 天內答應過的不再問；等回話的這段時間先由他代理
    function actingPick(w, E) {
        if (!on(w)) return E._pickActing(w); const H = S(w); const d = day(w);
        const skip = new Set(Object.keys(H.decl.acting).filter(id => H.decl.acting[id] > d)); let m = ''; try { m = E._mayorTravelling?.(w)?.agentData?.name || E._officeHolder?.(w)?.name || ''; } catch (e) {}
        for (let g = 0; g < 8; g++) {
            const p = E._pickActing(w, skip); if (!p) return null;
            if ((H.acc.acting[p.agentId] ?? -99) >= d - 30) return p; const pd = H.pend.acting[p.agentId]; if (pd != null && d - pd <= 1) return p;
            const r = offerSync(w, p, 'acting', { m }); if (r === 'no') { skip.add(p.agentId); continue; } return p;
        }
        return E._pickActing(w, skip);
    }

    // ================= 醜事被揭穿了 =================
    function scandalAsk(w, c, type, s, q) {
        if (!on(w) || !inTown(w, c) || typeof ASSEMBLY === 'undefined') return false; return ask(w, c, 'scandal', { type, sid: s?.id || null, v: s?.victim || null, q: q || 0.5, d: day(w) });
    }
    const holds = (w, c, type) => type === 'mayor' ? w.election?._officeHolder?.(w)?.agentId === c.agentId : (w.council?.members || []).includes(c.agentId);
    const secOf = (w, ctx) => { try { return (w.dark?.secrets || []).find(x => x.id === ctx?.sid) || null; } catch (e) { return null; } };
    DECIDE.kind('scandal', Object.assign({}, kindBase, civ(2), {
        title: '醜事被揭穿了', pri: 2.6,
        facts(w, c, ctx) { if (!ctx || !holds(w, c, ctx.type)) return ''; const Lw = LV(w); const v = ctx.v ? w.agents[ctx.v] : null; const mad = npcs(w).filter(o => o !== c && aff(o, c) <= -15).length;
            const head = { bribe: { k: '你在{c}收錢投票的事被揭穿了，全鎮都在議論。', p: { c: Lw.council } }, buy: { k: '你選{m}時買票的事被揭穿了，大家說你的席位是買來的。', p: { m: Lw.member } }, mayor: { k: '你當年選{l}時私下塞錢買票的事被揭穿了，證據傳遍全鎮。', p: { l: lead(w) } } }[ctx.type];
            return fill('{h}{v}鎮上已經有 {n} 個人對你很不滿。你可以辭職，可以一口咬定是造謠，可以公開道歉但不辭，{c}', { h: head, v: v ? { k: '這件事牽涉到{x}，你跟{x}{tie}。', p: { x: v.name, tie: tieOf(c, v) } } : { raw: '' }, n: mad, c: v && inTown(w, v) ? { k: '也可以反咬{x}一口。', p: { x: v.name } } : '或者硬撐下去。' }); },
        options(w, c, ctx) {
            if (!ctx || !holds(w, c, ctx.type)) return []; const v = ctx.v ? w.agents[ctx.v] : null; const hn = honesty(c);
            const out = [
                { id: 'resign', text: ctx.type === 'buy' ? '認了，讓出這個席位' : '辭職下台', say: '醜事被揭穿後辭職', why: '做錯了就要認。', lean: { face: -0.2, safe: 0.2 },
                    base: REF + tilt(ctx.q) + (hn >= 3 ? 0.4 : 0) - (has(c, 'ambitious') ? 0.4 : 0) - (hasV(c, '權力') ? 0.4 : 0),
                    run: (w2, c2) => { stat(w2, 'scandal_resign'); ASSEMBLY.scandalOut(w2, c2, ctx.type, secOf(w2, ctx)); return { k: '辭職了' }; } },
                { id: 'deny', text: '一口咬定是有人造謠，不下台', say: '否認醜聞，不肯下台', why: '我沒做過的事，憑什麼要我認。', lean: { face: 0.4, safe: -0.2 },
                    base: REF + (hn < 2 ? 0.5 : 0) + (has(c, 'ambitious') ? 0.3 : 0) + (hasV(c, '權力') ? 0.3 : 0) - (has(c, 'kind') ? 0.2 : 0),
                    run: (w2, c2) => { scandalStay(w2, c2, ctx, 'deny'); return { k: '否認到底' }; } },
                { id: 'sorry', text: '公開道歉，但不辭職', say: '公開道歉但不辭職', why: '我錯了，可是我還想把事情做完。', lean: { face: -0.1, bond: 0.2 },
                    base: REF + tilt(0.15) + (has(c, 'kind') ? 0.4 : 0) + (hn >= 3 ? 0.2 : 0),
                    run: (w2, c2) => { scandalStay(w2, c2, ctx, 'sorry'); return { k: '道歉了，沒有辭職' }; } },
            ];
            if (v && inTown(w, v) && v !== c) out.push({ id: 'counter', text: { k: '反咬{x}一口，說是他設計陷害', p: { x: v.name } }, say: { k: '反咬{x}一口', p: { x: v.name } }, why: { k: '要不是{x}，事情怎麼會變成這樣。', p: { x: v.name } }, lean: { face: 0.4, bond: -0.3 },
                base: REF + tilt(0.06) + (has(c, 'abrasive') ? 0.5 : 0) + (hn < 1.5 ? 0.4 : 0) + (aff(c, v) < -10 ? 0.4 : 0),
                run: (w2, c2) => { scandalStay(w2, c2, ctx, 'counter'); return { k: '反咬了{x}一口', p: { x: v.name } }; } });
            return out;
        },
    }));
    // 不下台的代價：認識他的人更不滿、醜聞分數上升（首長累積夠了會被連署罷免）、議會同僚施壓；否認和反咬的人過幾天可能被新證據逼下台
    const STAY = { deny: [6, 2, 8, 0.5], sorry: [3, 1, 3, 0.2], counter: [8, 3, 8, 0.6] };
    function scandalStay(w, c, ctx, how) {
        const [dk, sc, cp, p] = STAY[how]; const Lw = LV(w); stat(w, 'scandal_' + how);
        for (const o of npcs(w)) { if (o === c) continue; const r = o.relationships?.relationships?.[c.agentId]; if (r) { try { r.modifyAffinity(-dk); } catch (e) {} } }
        for (const id of (w.council?.members || [])) { const m = w.agents[id]; if (m && m !== c) bump(m, c, -cp); }
        try { if (typeof POWER !== 'undefined') { const P = POWER.S(w); P.scandal[c.agentId] = (P.scandal[c.agentId] || 0) + sc; } } catch (e) {}
        try { if (typeof DARK !== 'undefined') DARK.bump(w, c, 'exposed'); } catch (e) {}
        c.moodModifier = (c.moodModifier || 0) - (how === 'sorry' ? 6 : 3);
        const v = ctx.v ? w.agents[ctx.v] : null;
        if (how === 'deny') { log(w, 'council', '🗣️ {c}一口咬定是有人造謠，不肯下台。大家議論得更兇了。', { c: c.name }, c.name); mem(w, c, '我說那些都是造謠，我不會下台。', {}, 8); }
        else if (how === 'sorry') { log(w, 'council', '🙇 {c}公開道歉，說會好好反省，可是不辭職。', { c: c.name }, c.name); mem(w, c, '我公開道歉了，可是沒有辭職。', {}, 8); try { if (typeof WAYS !== 'undefined') WAYS.loseFace?.(w, c, 6); } catch (e) {} }
        else { log(w, 'council', '😠 {c}反咬{v}一口，說是被設計陷害的。這下鬧得更大了。', { c: c.name, v: v?.name || '' }, c.name); mem(w, c, '我說是{v}陷害我的。', { v: v?.name || '' }, 8); if (v) { bump(v, c, -25); mem(w, v, '{c}自己做了醜事，還反咬我一口。', { c: c.name }, 8); try { DARK.wrong?.(w, c, v, 2, '反咬{v}一口', { v: v.name }); } catch (e) {} } }
        S(w).scan.push({ id: c.agentId, type: ctx.type, sid: ctx.sid, d: day(w) + 5, p, how });
    }
    function scandalCheck(w) {
        const H = S(w); const d = day(w); const keep = [];
        for (const x of H.scan) { if (x.d > d) { keep.push(x); continue; } const c = w.agents[x.id]; if (!c || c.isDead || !holds(w, c, x.type) || typeof ASSEMBLY === 'undefined') continue;
            if (Math.random() < x.p) { log(w, 'council', '📰 又有新的證據傳出來，{c}再也賴不掉了。', { c: c.name }, c.name); stat(w, 'scandal_forced'); try { ASSEMBLY.scandalOut(w, c, x.type, secOf(w, x)); } catch (e) { console.warn('[Home] scandal out', e); } } }
        H.scan = keep;
    }

    // ================= 下台以後做什麼 =================
    const AWHY = { scandal: '買票的事被揭穿', recall: '被罷免', coup: '政變失敗', crowned: '登基當了國王' };
    function afterOffice(w, a, why) { if (!on(w) || !inTown(w, a) || why === 'crowned') return; ask(w, a, 'afterOffice', { why: why || '', d: day(w), prev: S(w).prev[a.agentId] || null }); }
    DECIDE.kind('afterOffice', Object.assign({}, kindBase, {
        title: '下台以後做什麼', pri: 1.2,
        facts(w, a, ctx) { if (a.job?.key === 'mayor') return ''; return fill('你剛從{l}的位子上下來（{why}）。照慣例你先去做買賣，可是之後要做什麼由你自己決定。{prev}你身上有 {c} 銀幣。', { l: lead(w), why: AWHY[ctx?.why] || '換人做', prev: ctx?.prev && ctx.prev !== 'mayor' ? { k: '當{l}之前你是{j}。', p: { l: lead(w), j: jobT(ctx.prev) } } : { raw: '' }, c: Math.floor(cash(w, a)) }); },
        options(w, a, ctx) {
            if (a.job?.key === 'mayor' || typeof Job === 'undefined') return []; const prev = ctx?.prev && JOB_DEFINITIONS[ctx.prev] && !['mayor', 'trader'].includes(ctx.prev) ? ctx.prev : null;
            const set = (k) => (w2, a2) => { if (a2.job?.key === 'mayor') return null; stat(w2, 'after_' + k); if (a2.job?.key !== k) { try { a2.job = new Job(k); } catch (e) { return null; } } if (k !== 'trader') log(w2, 'event', '🔧 {a}下台以後，決定去當{j}。', { a: a2.name, j: jobT(k) }, a2.name); mem(w2, a2, '下台以後，我決定去當{j}。', { j: jobT(k) }, 6); return { k: '去當{j}', p: { j: jobT(k) } }; };
            const out = [{ id: 'trader', quiet: true, text: '去做買賣', say: '下台後去做買賣', why: '先找點事做，日子總要過。', base: REF + tilt(0.6), lean: { gain: 0.3 }, run: set('trader') }];
            if (prev) out.push({ id: 'prev', text: { k: '回去當{j}', p: { j: jobT(prev) } }, say: { k: '回去當{j}', p: { j: jobT(prev) } }, why: '還是做回老本行最自在。', base: REF + tilt(0.3) + 0.2, lean: { safe: 0.3 }, run: set(prev) });
            if (prev !== 'farmer') out.push({ id: 'farmer', text: '去種田', say: '下台後去種田', why: '離那些是是非非遠一點。', base: REF + tilt(0.15) + (hasV(a, '自然') ? 0.4 : 0) + (has(a, 'hardworking') ? 0.2 : 0), lean: { safe: 0.2, face: -0.2 }, run: set('farmer') });
            return out;
        },
    }));

    // ================= 每天 =================
    function daily(w) {
        if (!on(w)) return; const H = S(w); const d = day(w); if (H.lastDay === d) return; H.lastDay = d;
        const gone = (id) => !w.agents[id] && !w.isAway?.(id);
        for (const k of Object.keys(H.will)) if (gone(k)) delete H.will[k];
        for (const k of Object.keys(H.bp)) { const [x, y] = k.split('|'); if (gone(x) || gone(y) || !wedTo(w.agents[x], w.agents[y])) { if (d - H.bp[k].d > 60 || gone(x) || gone(y)) delete H.bp[k]; } }
        for (const k of Object.keys(H.hc)) { const L = (H.hc[k] || []).filter(x => x > d - 30); if (L.length) H.hc[k] = L; else delete H.hc[k]; }
        for (const g of ['wedNo', 'royalNo', 'vic', 'thief']) for (const k of Object.keys(H[g])) if (gone(k) || (g === 'vic' || g === 'thief' ? d - H[g][k] > 60 : H[g][k] < d)) delete H[g][k];
        for (const g of Object.keys(H.decl)) for (const k of Object.keys(H.decl[g])) if (H.decl[g][k] < d || gone(k)) delete H.decl[g][k];
        for (const g of Object.keys(H.pend)) for (const k of Object.keys(H.pend[g])) if (d - H.pend[g][k] > 2) delete H.pend[g][k];
        for (const k of Object.keys(H.acc.acting)) if (d - H.acc.acting[k] > 30) delete H.acc.acting[k];
        for (const k of Object.keys(H.asked)) for (const id of Object.keys(H.asked[k] || {})) if (d - H.asked[k][id] > 10) delete H.asked[k][id];
        if (H.offer.envoy && d - H.offer.envoy.d > 2) H.offer.envoy = null;
        for (const cid of Object.keys(H.adopt)) if (d - H.adopt[cid].d > 3) adoptNext(w, cid);
        // 之前做什麼工作（下台的首長回去做老本行用）
        for (const a of npcs(w)) if (a.job?.key && a.job.key !== 'mayor') H.prev[a.agentId] = a.job.key;
        for (const k of Object.keys(H.prev)) if (gone(k)) delete H.prev[k];
        try { scandalCheck(w); } catch (e) { console.warn('[Home] scandal', e); }
        // 遺囑：60 歲以上或病重、還沒立過（或三年、家裡大變）的人，一天最多問三個（年紀大、病重的先）
        try { const due = adults(w).filter(a => willDue(w, a)).sort((x, y) => (sick(w, y) ? 50 : 0) + (y.age ?? 30) - (sick(w, x) ? 50 : 0) - (x.age ?? 30)).slice(0, 3);
            for (const a of due) { (H.asked.will || (H.asked.will = {}))[a.agentId] = d; ask(w, a, 'will', { d }); } } catch (e) { console.warn('[Home] will', e); }
    }
    function stolen(w, th, vic, n) { const H = S(w); if (vic) H.vic[vic.agentId] = day(w); if (th) H.thief[th.agentId] = day(w); stat(w, 'thefts'); }

    return { S, on, ask, MULT, couple, wish, birthMult, heirOrder, estateSplit, helpOk, ruleNow, adoptAsk, adoptNext, royalAsk, wedAsk, wedSkip, decreeAsk, diploAsk, envoyOffer, throneAsk, seatOk, seatJoin, actingPick, scandalAsk, scandalCheck, afterOffice, daily, stolen, tilt,
        theftLaw: (w) => (w?.home?.law?.theft || 'normal'), immigPaused: (w) => HOMEPROP_?.paused(w) || false };
})();
let HOMEPROP_ = null;

// ================= 把固定的制度開放給提案 =================
// 三條規定：偷竊罰則（從輕＝不關、罰錢給公庫／照舊＝關 3 天／從重＝關 5 天）、暫停收新移民（最多 40 天、人口太少自動失效）／重新開放、公職薪水整體調高或調低一級（每級一成，接在 v10.8.0 的「公職薪水跟著民間走」上面）。
// 誰會提：被偷過的人提從重、被關過的人的家人朋友提從輕；找不到工作的人提暫停收人、東家們在人少時提重新開放；領公家薪水的人在公庫寬裕時提調高、嫌稅重的人在公庫吃緊時提調低。
// 走的是原本的提案流程（全鎮投票 → 大事送議會 → 首長裁決）。開了完整智能體，村民發想提案時看得到這幾條、可以自己提。
const HOMEPROP = (() => {
    const KINDS = ['home_theft', 'home_immig', 'home_pay']; const GAP = 40, AIGAP = 5, PAUSE = 30, PAUSE_MAX = 40;
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, x) => (a?.personality?.traits || []).includes(x);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const log = (w, k, p, who) => { try { w.logMessageT?.('council', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const L = (w) => { const H = HOME.S(w); const X = H.law; if (!X.theft) X.theft = 'normal'; if (!Number.isFinite(X.pay)) X.pay = 0; if (!X.last || typeof X.last !== 'object') X.last = {}; return X; };
    const TR = (w) => (typeof TREASURY !== 'undefined' && w.observerMode && w.wallet) ? TREASURY : null;
    const tight = (w) => { const T = TR(w); try { return !!T && (T.low(w) || (w.wallet?.shortDay ?? -99) >= day(w) - 7); } catch (e) { return false; } };
    const rich = (w) => { const T = TR(w); try { return !!T && T.high(w); } catch (e) { return false; } };
    const isPub = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.PUBLIC.includes(a.job?.key) && !MARKET.privatePaid?.(w, a) && !(typeof CLERGY !== 'undefined' && CLERGY.paidBy(w, a)); } catch (e) { return false; } };
    const isBoss = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const busy = (w) => (w.proposals?.items || []).some(p => KINDS.includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status));
    const LAWT = { light: '從輕（不關，罰錢）', normal: '照舊（關 3 天）', harsh: '從重（關 5 天）' };
    const target = (w) => Math.max(20, w.events?.TARGET_POPULATION || 20);
    const floorPop = (w) => Math.max(12, Math.round(target(w) * 0.6));
    const jobless = (w) => adults(w).filter(a => !a.job && (a.age ?? 30) >= 18 && (a.age ?? 30) < 65);
    // 暫停收人：到期、或鎮上人口少於目標的六成，自動失效
    function paused(w) {
        const X = w?.home?.law; const P = X?.pause; if (!P) return false; const d = day(w); const pop = npcs(w).length;
        if (d >= P.until || pop < floorPop(w)) { X.pause = null; log(w, d >= P.until ? '🚪 暫停收新移民的規定到期了，小鎮重新開放讓人搬進來。' : '🚪 鎮上人口太少，暫停收新移民的規定自動失效，小鎮重新開放讓人搬進來。', {}); try { HOME.S(w).st.immigLift = (HOME.S(w).st.immigLift || 0) + 1; } catch (e) {} return false; }
        return true;
    }
    function okNow(w, kind, dir, ai) {
        const X = L(w); const d = day(w); if (busy(w) || !w.wallet) return false; if (d - (X.last[kind] ?? -999) < (ai ? AIGAP : GAP)) return false;
        if (kind === 'home_theft') return ['light', 'normal', 'harsh'].includes(dir) && dir !== X.theft;
        if (kind === 'home_immig') return dir === 'pause' ? !X.pause && npcs(w).length >= floorPop(w) + 4 : dir === 'open' && !!X.pause;
        if (kind === 'home_pay') return (dir === 1 && X.pay < 2) || (dir === -1 && X.pay > -2);
        return false;
    }
    function propose(w, kind, who, dir, why) {
        if (!who || typeof TECH === 'undefined' || !okNow(w, kind, dir, true)) return null; const X = L(w); let p = null;
        if (kind === 'home_theft') p = TECH.propose(w, kind, kind, who, '偷竊罰則改成{x}', '{who}提議把偷竊的罰則從「{a}」改成「{b}」。{why}', { a: LAWT[X.theft], b: LAWT[dir], why: why || '' }, 'defense', { x: LAWT[dir] }, { dir });
        else if (kind === 'home_immig') p = dir === 'pause' ? TECH.propose(w, kind, kind, who, '暫停收新移民 {n} 天', '{who}提議暫停收新移民 {n} 天。{why}到期或鎮上人口少於 {m} 人時自動恢復。', { n: PAUSE, m: floorPop(w), why: why || '' }, 'welfare', { n: PAUSE }, { dir, days: PAUSE })
            : TECH.propose(w, kind, kind, who, '重新開放收新移民', '{who}提議提前結束暫停，重新讓人搬進來。{why}', { why: why || '' }, 'economy', {}, { dir });
        else if (kind === 'home_pay') p = TECH.propose(w, kind, kind, who, dir > 0 ? '公職薪水調高一級' : '公職薪水調低一級', dir > 0 ? '{who}提議把公職薪水整體調高一成（現在是第 {a} 級，調完是第 {b} 級）。{why}' : '{who}提議把公職薪水整體調低一成（現在是第 {a} 級，調完是第 {b} 級）。{why}', { a: X.pay, b: X.pay + dir, why: why || '' }, 'economy', {}, { dir });
        if (p) { X.last[kind] = day(w); try { HOME.S(w).st['prop_' + kind] = (HOME.S(w).st['prop_' + kind] || 0) + 1; } catch (e) {} }
        return p;
    }
    // 沒開完整智能體：有感的人在有感的時候提
    function daily(w) {
        if (!w?.proposals || !w.observerMode || w.fullAgentMode || busy(w) || !w.wallet) return; const X = L(w); const H = HOME.S(w); const d = day(w); const A = adults(w); if (A.length < 8) return;
        // 偷竊：一個月內被偷的人多了，被偷過的人提從重；被關的人的家人朋友提從輕
        const vic = A.filter(a => d - (H.vic[a.agentId] ?? -99) <= 30);
        if (vic.length >= 3 && X.theft !== 'harsh' && okNow(w, 'home_theft', X.theft === 'light' ? 'normal' : 'harsh', false) && Math.random() < 0.2) { const who = vic.sort((x, y) => cash(w, y) - cash(w, x))[0]; if (propose(w, 'home_theft', who, X.theft === 'light' ? 'normal' : 'harsh', t('這個月鎮上已經有 {n} 個人被偷，罰得太輕根本嚇不了人。').replace('{n}', vic.length))) return; }
        const th = Object.keys(H.thief).map(id => w.agents[id]).filter(a => a && !a.isDead && d - H.thief[a.agentId] <= 20);
        if (th.length && X.theft !== 'light' && vic.length < 3 && okNow(w, 'home_theft', X.theft === 'harsh' ? 'normal' : 'light', false) && Math.random() < 0.08) { const x = th[0]; const who = A.filter(o => o !== x && (aff(o, x) >= 50 || (o._parentNames || []).includes(x.name) || (x._parentNames || []).includes(o.name))).sort((p, q) => aff(q, x) - aff(p, x))[0]; if (who && propose(w, 'home_theft', who, X.theft === 'harsh' ? 'normal' : 'light', t('{x}一時糊塗偷了錢，被關了好幾天，出來工作都丟了。').replace('{x}', t(x.name)))) return; }
        // 移民：找不到工作的人多了，提暫停；暫停中人又少了，東家提重新開放
        const jl = jobless(w);
        if (!X.pause && jl.length >= Math.max(5, Math.round(A.length * 0.08)) && okNow(w, 'home_immig', 'pause', false) && Math.random() < 0.08) { const who = jl.sort((x, y) => cash(w, x) - cash(w, y))[0]; if (propose(w, 'home_immig', who, 'pause', t('鎮上已經有 {n} 個人找不到工作，外地人還一直搬進來。').replace('{n}', jl.length))) return; }
        if (X.pause && npcs(w).length < target(w) - 6 && okNow(w, 'home_immig', 'open', false) && Math.random() < 0.15) { const who = A.filter(a => isBoss(w, a)).sort((x, y) => cash(w, y) - cash(w, x))[0] || A.find(a => a.job?.key === 'trader'); if (who && propose(w, 'home_immig', who, 'open', t('鎮上的人越來越少，店裡都快找不到人手了。'))) return; }
        // 公職薪水：公庫寬裕時領公家薪水的人提調高；公庫吃緊、稅又重時嫌稅重的人提調低
        if (X.pay < 2 && rich(w) && okNow(w, 'home_pay', 1, false) && Math.random() < 0.04) { const who = A.filter(a => isPub(w, a)).sort((x, y) => cash(w, x) - cash(w, y))[0]; if (who && propose(w, 'home_pay', who, 1, t('公庫還算寬裕，做公家事的人薪水卻追不上外面。'))) return; }
        if (X.pay > -2 && tight(w) && (w.wallet.tax || 0) >= 0.12 && okNow(w, 'home_pay', -1, false) && Math.random() < 0.06) { const who = A.filter(a => !isPub(w, a) && a.job && cash(w, a) >= 20 && cash(w, a) < 300).sort((x, y) => cash(w, y) - cash(w, x))[0]; if (who) propose(w, 'home_pay', who, -1, t('稅抽得這麼重，公庫還是不夠，公家的薪水卻一毛都不少。')); }
    }
    // ---------- 投票（沒有 AI 時）：看自己的處境 ----------
    function vote(w, p, a) {
        if (a.agentId === p.proposerId) return { v: 'for', why: 'home_mine' }; const H = HOME.S(w); const d = day(w); const r = Math.random(); const c = cash(w, a);
        if (p.kind === 'home_theft') {
            const victim = d - (H.vic[a.agentId] ?? -99) <= 60; const kinThief = Object.keys(H.thief).some(id => { const x = w.agents[id]; return x && x !== a && (aff(a, x) >= 50 || (x._parentNames || []).includes(a.name) || (a._parentNames || []).includes(x.name)); }); const thief = d - (H.thief[a.agentId] ?? -99) <= 60;
            const order = { light: 0, normal: 1, harsh: 2 }; const up = order[p.dir] > order[L(w).theft];
            if (up) { if (thief || kinThief) return { v: 'against', why: kinThief ? 'theft_kin' : 'theft_poor' }; if (victim) return { v: 'for', why: 'theft_victim' }; if (a.job?.key === 'guard') return { v: 'for', why: 'theft_guard' }; if (c >= 100) return r < 0.7 ? { v: 'for', why: 'theft_rich' } : { v: 'against', why: 'theft_keep' }; if (c < 10) return r < 0.7 ? { v: 'against', why: 'theft_poor' } : { v: 'for', why: 'theft_rich' }; return r < 0.45 ? { v: 'for', why: 'theft_rich' } : { v: 'against', why: 'theft_keep' }; }
            if (thief || kinThief) return { v: 'for', why: kinThief ? 'theft_kin' : 'theft_poor' }; if (victim) return { v: 'against', why: 'theft_victim' }; if (c < 10 || has(a, 'kind')) return r < 0.7 ? { v: 'for', why: 'theft_poor' } : { v: 'against', why: 'theft_keep' }; if (c >= 100) return r < 0.25 ? { v: 'for', why: 'theft_poor' } : { v: 'against', why: 'theft_rich' }; return r < 0.4 ? { v: 'for', why: 'theft_poor' } : { v: 'against', why: 'theft_keep' };
        }
        if (p.kind === 'home_immig') {
            const nojob = !a.job && (a.age ?? 30) >= 18; const boss = isBoss(w, a); const newbie = /^(imm_|o_)/.test(String(a.agentId));
            if (p.dir === 'pause') { if (nojob) return { v: 'for', why: 'immig_job' }; if (boss) return { v: 'against', why: 'immig_staff' }; if (newbie) return r < 0.2 ? { v: 'for', why: 'crowded' } : { v: 'against', why: 'newcomer' }; if (c < 10) return r < 0.6 ? { v: 'for', why: 'immig_job' } : { v: 'against', why: 'growth' }; return r < 0.35 ? { v: 'for', why: 'crowded' } : { v: 'against', why: 'growth' }; }
            if (boss) return { v: 'for', why: 'immig_staff' }; if (nojob) return { v: 'against', why: 'immig_job' }; if (newbie) return { v: 'for', why: 'newcomer' }; return r < 0.55 ? { v: 'for', why: 'growth' } : { v: 'against', why: 'oldways' };
        }
        if (p.kind === 'home_pay') {
            const pub = isPub(w, a); const tg = tight(w); const taxed = (w.wallet?.tax || 0) >= 0.12;
            if (p.dir > 0) { if (pub) return { v: 'for', why: 'pay_mine' }; if (tg) return { v: 'against', why: 'pay_town' }; return r < (taxed ? 0.2 : 0.35) ? { v: 'for', why: 'pay_fair' } : { v: 'against', why: 'pay_tax' }; }
            if (pub) return { v: 'against', why: 'pay_mine' }; if (taxed && a.job) return r < 0.7 ? { v: 'for', why: 'pay_tax' } : { v: 'against', why: 'pay_fair' }; return r < (tg ? 0.55 : 0.35) ? { v: 'for', why: 'pay_town' } : { v: 'against', why: 'pay_fair' };
        }
        return { v: r < 0.5 ? 'for' : 'against', why: 'gut' };
    }
    // ---------- 通過 ----------
    function enact(w, p) {
        const X = L(w); const d = day(w); const st = HOME.S(w).st; st['done_' + p.kind] = (st['done_' + p.kind] || 0) + 1;
        if (p.kind === 'home_theft') { if (!LAWT[p.dir] || p.dir === X.theft) return ''; X.theft = p.dir; X.theftDay = d; log(w, '⚖️ 偷竊的罰則改了：從今以後{x}。', { x: LAWT[p.dir] }); return t('偷竊罰則改成{x}').replace('{x}', t(LAWT[p.dir])); }
        if (p.kind === 'home_immig') {
            if (p.dir === 'pause') { if (X.pause) return ''; const n = Math.min(PAUSE_MAX, p.days || PAUSE); X.pause = { from: d, until: d + n }; log(w, '🚪 小鎮暫停收新移民 {n} 天（人口少於 {m} 人時自動恢復）。', { n, m: floorPop(w) }); return t('暫停收新移民 {n} 天').replace('{n}', n); }
            if (!X.pause) return ''; X.pause = null; log(w, '🚪 小鎮重新開放收新移民。', {}); return t('重新開放收新移民');
        }
        if (p.kind === 'home_pay') { const nv = Math.max(-2, Math.min(2, X.pay + (p.dir > 0 ? 1 : -1))); if (nv === X.pay) return ''; X.pay = nv; X.payDay = d; log(w, p.dir > 0 ? '💼 公職薪水整體調高了一成，現在是第 {n} 級。' : '💼 公職薪水整體調低了一成，現在是第 {n} 級。', { n: nv }); for (const a of adults(w)) if (isPub(w, a) && Math.random() < 0.4) mem(w, a, p.dir > 0 ? '公職薪水調高了，日子好過一點。' : '公職薪水被調低了，心裡不太痛快。', {}, 5); return t(p.dir > 0 ? '公職薪水調高一級' : '公職薪水調低一級'); }
        return '';
    }
    // ---------- 給 AI ----------
    function choices(w) {
        const X = L(w); const out = [];
        for (const dir of ['light', 'normal', 'harsh']) if (okNow(w, 'home_theft', dir, true)) out.push(['home_theft:' + dir, { k: '偷竊罰則改成{x}', p: { x: LAWT[dir] } }]);
        if (okNow(w, 'home_immig', 'pause', true)) out.push(['home_immig:pause', { k: '暫停收新移民 {n} 天', p: { n: PAUSE } }]); if (okNow(w, 'home_immig', 'open', true)) out.push(['home_immig:open', '重新開放收新移民']);
        if (okNow(w, 'home_pay', 1, true)) out.push(['home_pay:up', '公職薪水調高一級']); if (okNow(w, 'home_pay', -1, true)) out.push(['home_pay:down', '公職薪水調低一級']);
        return out;
    }
    const tx = (x) => (x && typeof x === 'object') ? (() => { let s = t(x.k); for (const [a, b] of Object.entries(x.p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : String(b)); return s; })() : t(x);
    function promptParts(w) {
        try { if (busy(w) || !w.wallet) return { ctx: '', fx: '' }; const C = choices(w); if (!C.length) return { ctx: '', fx: '' }; const X = L(w);
            const now = t('現在：偷竊{a}；{b}；公職薪水第 {c} 級').replace('{a}', t(LAWT[X.theft])).replace('{b}', t(X.pause ? '暫停收新移民中' : '照常收新移民')).replace('{c}', X.pay);
            return { ctx: `${t('【可以提案改的鎮上規定】')}${now}${t('。')}${t('可以提：')}${C.map(([k, v]) => `${k}${t('＝')}${tx(v)}`).join(t('、'))}\n`, fx: `{"type":"homelaw","key":"${t('上面「鎮上規定」的代碼')}"}${t('（改一條鎮上的規定，要說得出為什麼）')}\n` };
        } catch (e) { return { ctx: '', fx: '' }; }
    }
    function fromAI(w, a, j) {
        const e = (Array.isArray(j?.effects) ? j.effects : []).find(o => String(o?.type || '').toLowerCase() === 'homelaw'); if (!e) return null;
        const [kind, x] = String(e.key || '').trim().split(':'); if (!KINDS.includes(kind)) return null; const dir = kind === 'home_pay' ? (x === 'up' ? 1 : x === 'down' ? -1 : 0) : x;
        if (!okNow(w, kind, dir, true)) return null; return propose(w, kind, a, dir, '');
    }
    const view = (w) => { const X = L(w); return { theft: X.theft, pause: X.pause ? Object.assign({}, X.pause) : null, pay: X.pay }; };
    return { KINDS, LAWT, paused, okNow, propose, daily, vote, enact, promptParts, fromAI, view, floorPop, PAUSE, PAUSE_MAX };
})();
HOMEPROP_ = HOMEPROP;

// ---- 掛勾 ----
if (typeof FISCAL !== 'undefined' && typeof FISCAL.pubRate === 'function') { const _pr = FISCAL.pubRate; FISCAL.pubRate = function (w) { const r = _pr.call(this, w); const s = w?.observerMode ? (w.home?.law?.pay || 0) : 0; return s ? Math.round(r * (1 + 0.1 * s) * 1000) / 1000 : r; }; } // v11.9.0 公職薪水整體調高或調低一級（每級一成）
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { home_theft: { icon: '⚖️', label: '偷竊罰則' }, home_immig: { icon: '🚪', label: '新移民' }, home_pay: { icon: '💼', label: '公職薪水' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { home_mine: '這是我提的', theft_victim: '我被偷過', theft_guard: '抓小偷是我的工作', theft_rich: '有錢的人怕被偷', theft_poor: '窮到偷東西的人不該關', theft_kin: '我的家人朋友被關過', theft_keep: '照現在就好', immig_job: '工作已經不夠分了', immig_staff: '店裡缺人手', pay_mine: '這是我的薪水', pay_town: '公庫沒那麼多錢', pay_fair: '做公家事的人也要過日子', pay_tax: '稅抽得太重了' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { HOME.daily(w); } catch (e) { console.warn('[Home] daily', e); } try { HOMEPROP.daily(w); } catch (e) { console.warn('[HomeProp] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (HOMEPROP.KINDS.includes(p.kind)) { const r = HOMEPROP.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.home = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.home) { const { hd, res, _sync, ...rest } = this.home; d.home = rest; } return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.home = (data?.home && typeof data.home === 'object') ? data.home : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') { globalThis.HOME = HOME; globalThis.HOMEPROP = HOMEPROP; }
