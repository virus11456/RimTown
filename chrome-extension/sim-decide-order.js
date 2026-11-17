// RimTown - sim-decide-order.js：v11.8.0 決策核心「派系、報社與治安裡的行為」
// 以前：湊到 3 個合得來的人每三天 20% 自動成立小團體、所有人自動加入；跟團體裡的人翻臉的人 20% 退出；
//       兩派碰上了擲骰決定結怨、合作或內鬨；記者挖到候選人的醜聞一定照登；八卦報或被收買的報社每天 25% 登假消息、受害者擲骰；
//       假消息被拆穿 30% 自動更正；國王 35% 查禁批評他的報社，被禁的報社每天 20% 轉入地下；記者不是完美主義就收錢；
//       衛兵抓到小偷一定還錢、關起來；襲擊來了照守衛人數自動開打。
// 現在：運氣照舊看天（湊不湊得到人、哪兩派碰上、挖不挖得到、假消息被不被拆穿、抓不抓得到、打不打得贏），人的行為交給本人：
//   湊得到人，要不要出面拉大家成立小團體(facFound)    不了／出面拉大家
//   有人拉你成立小團體(facJoin)                     不加入／加入（至少兩個人答應才成立）
//   在小團體裡待不下去(facLeave)                    留下／悄悄淡出／公開退出（跟裡面的人翻臉、團體跟自己的家人或恩人作對、團體名聲變差）
//   碰上另一派(facRival)                           不理／槓上／示好（帶頭的人決定）
//   另一派找上門(facReply)                         對方槓上：嗆回去／找他說開／不理；對方示好：接受／婉拒／不理
//   團體裡有人讓你受不了(facRow)                    忍著／當眾指責／私下講開
//   挖到候選人的醜聞(pressScoop)                   照實登／壓下來／拿去跟當事人談條件／先查證
//   報社拿你的醜聞來談條件(pressHush)               付錢封口／不付
//   要不要登抹黑的假消息(pressSmear)                不登／登某位候選人（內容三選一照舊看天）
//   登的假消息被拆穿了(pressFix)                   登更正啟事／裝沒事／再補一刀
//   有報社批評國王(pressBan)                       不管它／查禁
//   報社被查禁了(pressUnder)                       再等等／轉入地下／停刊／低頭改口
//   候選人塞錢要報社替他說話(pressBuy)              收下／不收／不收還登出來
//   抓到小偷或趁亂搶東西的人(caught)                關起來／只叫他還回去／放他一馬／收錢了事
//   襲擊來了(raidCall)                            出去打／守在牆內／花錢消災／帶大家躲起來
// 每個選擇點只問跟這件事有關的那一兩個人（篩選與冷卻寫在各自那一段）；用自己的一組 AI 額度（order，一天 8 件），輪不到 AI 的照個性決定。
// 結算全部在原本的系統裡（sim-society.js、sim-press.js、sim-civic.js、sim-aftermath.js、sim-town.js），原本的效果抽成函式共用，這裡不改任何數字。
// 傾向分數照「以前大概多常發生」算起跑分數（tiltN），再加上交情、個性與處境：沒開 AI 時整體頻率跟以前差不多，誰會那樣做看的是人。
// 搜查：盤點過沒有「守衛搜查某人的家或店」這種自動發生的事，所以這一版不加搜查。
// 必須在 sim-decide.js 之後載入。
'use strict';

const ORDER = (() => {
    if (typeof DECIDE === 'undefined') return { on: () => false };
    const G = 'order';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(n); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet && a ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => t(o.name)).join(t('、'));
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const jailed = (w, a) => !!(w.civic?.jail?.[a?.agentId] > day(w));
    const live = (w, id) => { const a = id && w.agents[id]; return a && !a.isDead && !a.isPlayer && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) ? a : null; };
    const honesty = (a) => { try { return typeof DARK !== 'undefined' ? DARK.honesty(a) : 2; } catch (e) { return 2; } };
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a).filter(f => f !== a) : []; } catch (e) { return []; } };
    const isFam = (w, a, b) => !!(a && b && a !== b && (famOf(w, a).includes(b) || famOf(w, b).includes(a))); // 夫妻、父母，也包括自己的孩子
    const owes = (w, a, b) => (w.ways?.owe?.[a?.agentId]?.[b?.agentId] || 0) > 0; // a 欠 b 人情（b 是 a 的恩人）
    const cold = (w, a, b) => { try { return typeof WAYS !== 'undefined' && WAYS.coldWith ? !!WAYS.coldWith(w, a, b) : false; } catch (e) { return false; } };
    const tie = (w, a, b) => (isFam(w, a, b) ? '家人' : (cold(w, a, b) || aff(a, b) <= -15) ? '有過節' : aff(a, b) >= 60 ? '很要好' : aff(a, b) >= 25 ? '有交情' : '交情普通');
    const TIE = { '家人': '是一家人', '很要好': '感情很好', '有交情': '還算有交情', '交情普通': '只是普通交情', '有過節': '之間有過節' };
    const tieTxt = (k) => TIE[k] || TIE['交情普通'];
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const on = (w) => { try { return !!DECIDE.on(w); } catch (e) { return false; } };
    const REF = 1;
    // 兩個選項、當天心情起伏 ±0.9 時，起跑分數差多少會讓這個選項大約有 P 的機會被選中（跟 sim-decide-dark.js 同一個算法）
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    // 三個以上的選項：每個選項加上 ±0.9 的心情起伏後挑最高的，解出起跑分數，讓一般人選到每一項的機會接近 ps（第一項固定在 REF）
    const U = 0.9; const Fu = (x) => (x <= -U ? 0 : x >= U ? 1 : (x + U) / (2 * U));
    const pOf = (b, i) => { const n = b.length, M = 48; let s = 0; for (let m = 0; m < M; m++) { const u = -U + (m + 0.5) * (2 * U / M); let p = 1; for (let j = 0; j < n && p > 0; j++) if (j !== i) p *= Fu(b[i] + u - b[j]); s += p; } return s / M; };
    const _TN = new Map();
    function tiltN(ps) {
        let q = ps.map(p => clampN(+p || 0, 0.004, 0.99)); const sum = q.reduce((x, y) => x + y, 0); q = q.map(p => p / sum);
        const key = q.map(p => Math.round(p * 400)).join(','); if (_TN.has(key)) return _TN.get(key);
        // 一次調一個選項（二分法：自己的分數越高，被選中的機會越大），來回調三十輪就穩了
        const b = q.map(() => 0); for (let sw = 0; sw < 30; sw++) for (let i = 1; i < b.length; i++) { let lo = -4, hi = 4; for (let k = 0; k < 22; k++) { b[i] = (lo + hi) / 2; if (pOf(b, i) < q[i]) lo = b[i]; else hi = b[i]; } }
        const out = b.map(x => REF + x); if (_TN.size > 400) _TN.clear(); _TN.set(key, out); return out;
    }
    // 起跑分數：扣掉這個選項的 lean 對一般人（每一項都是 1）的那一份，再加上這個人自己的加減
    const leanSum = (l) => Object.values(l || {}).reduce((x, y) => x + y, 0);
    const cal = (opts, ps) => { const b = tiltN(ps); opts.forEach((op, i) => { op.base = b[i] - leanSum(op.lean) + (op.adj || 0); delete op.adj; }); return opts; };
    const base = { scan: false, cool: 0, aiGroup: G, when: () => null };

    function S(w) {
        if (!w.order || typeof w.order !== 'object') w.order = { pend: {}, cool: {}, ver: [], st: {} };
        const O = w.order; for (const k of ['pend', 'cool', 'st']) if (!O[k] || typeof O[k] !== 'object') O[k] = {}; if (!Array.isArray(O.ver)) O.ver = []; return O;
    }
    const st = (w, k) => { const O = S(w); O.st[k] = (O.st[k] || 0) + 1; };
    const ask = (w, a, kind, ctx) => { if (a) DECIDE.askNow(w, [{ a, kind, ctx }]); };

    // ================= A. 小團體與派系 =================
    const FZH = { work_buddies: '工作夥伴', drinking_pals: '酒友', gossip_circle: '八卦圈', scholars: '學者聯盟', romantics: '戀愛同盟', troublemakers: '搗蛋鬼', elders_council: '長者議會', night_owls: '夜貓族' };
    const fnm = (f) => FZH[f?.type] || f?.name || '';
    const FS = (w) => w.factions || null;
    const nFac = (w, a) => Object.values(FS(w)?.factions || {}).filter(f => f.hasMember(a.agentId)).length;
    const facOf = (w, id) => FS(w)?.factions?.[id] || null;
    const leaderOf = (w, f) => { if (!f) return null; const ms = f.members.map(id => live(w, id)).filter(Boolean); return ms.find(a => a.name === f.founderName) || ms[0] || null; };
    const avgAff = (a, list) => (list.length ? list.reduce((s, o) => s + aff(a, o), 0) / list.length : 0);
    // 共同的不滿：這群人裡至少兩個（含自己）都看不順眼的那個人
    function sharedFoe(w, a, group) { const cnt = {}; for (const o of group) for (const r of Object.values(o.relationships?.relationships || {})) if ((r.affinity || 0) <= -15 && !group.some(g => g.agentId === r.targetId)) cnt[r.targetId] = (cnt[r.targetId] || 0) + 1;
        const ids = Object.keys(cnt).filter(id => cnt[id] >= 2 && aff(a, w.agents[id]) <= -15 && w.agents[id] && !w.agents[id].isDead).sort((x, y) => cnt[y] - cnt[x]); return ids.length ? w.agents[ids[0]] : null; }
    const motive = (w, a, group) => { const o = group.filter(x => x !== a); return (has(a, 'charismatic') ? 0.4 : 0) + (has(a, 'ambitious') ? 0.25 : 0) + (hasV(a, '社群') ? 0.3 : 0) + (has(a, 'gossip') ? 0.15 : 0) - (has(a, 'shy') ? 0.4 : 0) + clampN(avgAff(a, o) / 100, -0.3, 0.3) + (sharedFoe(w, a, group) ? 0.2 : 0); };
    // 被拉的人之中至少兩個答應的機會（每個人照 0.85 算）：出面的人「拉不拉」的起跑機會要除掉這一份，整體才跟以前每三天 20% 差不多
    const atLeast2 = (m, q = 0.85) => (m < 2 ? 0 : 1 - Math.pow(1 - q, m) - m * q * Math.pow(1 - q, m - 1));

    // 湊得到 3 個人（FactionSystem 每三天看一次）：最有動機的那一位決定要不要出面拉大家
    function found(w, Fs, type, cands) {
        const O = S(w), d = day(w); const pe = O.pend[type];
        if (pe) { if (d - pe.d >= 2) settle(w, type); return; } // 還在等人回話；等了兩天還沒回完，照答應的人算
        if (Object.values(Fs.factions).some(f => f.type === type)) return;
        const pool = cands.filter(a => live(w, a.agentId) && !jailed(w, a) && nFac(w, a) < 2); if (pool.length < 3) return;
        // 同一天最多問三個人要不要出面（開局那幾天八種小團體可能同時湊得到人，一次全問會一天問二十幾個人）；沒輪到的下次再看
        if (O.fd?.d === d && O.fd.n >= 3) return; O.fd = O.fd?.d === d ? { d, n: O.fd.n + 1 } : { d, n: 1 };
        const fdr = pool.slice().sort((x, y) => motive(w, y, pool) - motive(w, x, pool))[0];
        ask(w, fdr, 'facFound', { t: type, c: pool.map(a => a.agentId), d });
    }
    function foundInfo(w, a, c) {
        const Fs = FS(w); if (!Fs || !c || !FZH[c.t] || day(w) - (c.d ?? 0) > 1 || S(w).pend[c.t] || Object.values(Fs.factions).some(f => f.type === c.t) || nFac(w, a) >= 2) return null;
        const others = (c.c || []).map(id => live(w, id)).filter(o => o && o !== a && nFac(w, o) < 2); if (others.length < 2) return null;
        return { others, foe: sharedFoe(w, a, [a, ...others]), mine: nFac(w, a), m: others.length };
    }
    const tieList = (w, a, list) => list.map(o => `${t(o.name)}${t('（')}${t(tie(w, a, o))}${t('）')}`).join(t('、'));
    DECIDE.kind('facFound', Object.assign({}, base, {
        title: '湊得到人，要不要拉大家成立小團體', pri: 1, aiKind: 1,
        facts(w, a, c) { const I = foundInfo(w, a, c); if (!I) return '';
            return fill('鎮上有幾個人跟你合得來，可以湊成「{f}」：{list}。{foe}你現在參加了 {n} 個小團體（最多兩個）。要不要出面拉大家成立？要是答應的人不到兩個，就成不了。', { f: FZH[c.t], list: { raw: tieList(w, a, I.others) }, foe: I.foe ? { k: '你們幾個都看不慣{x}。', p: { x: I.foe.name } } : { raw: '' }, n: I.mine }); },
        options(w, a, c) { const I = foundInfo(w, a, c); if (!I) return []; const f = FZH[c.t];
            const P = clampN(0.2 / Math.max(0.2, atLeast2(I.m)), 0.05, 0.9);
            return cal([
                { id: 'no', quiet: true, mute: true, text: '不了，維持現在這樣', say: '沒有出面拉人成立小團體', why: '大家各過各的也很好。', lean: {}, run: () => null },
                { id: 'form', text: { k: '出面拉大家成立「{f}」', p: { f } }, say: { k: '找大家一起成立「{f}」', p: { f } }, why: '我們幾個合得來，常在一起也好有個照應。', lean: { bond: 0.2 }, adj: motive(w, a, [a, ...I.others]) - 0.25,
                    run: (w2, a2) => { const I2 = foundInfo(w2, a2, c); if (!I2) return null; const O = S(w2); O.pend[c.t] = { by: a2.agentId, c: I2.others.map(o => o.agentId), yes: [a2.agentId], no: [], d: day(w2) }; st(w2, 'found');
                        DECIDE.askNow(w2, I2.others.map(o => ({ a: o, kind: 'facJoin', ctx: { t: c.t, by: a2.agentId, d: day(w2) } }))); return { k: '去找{x}談了', p: { x: { raw: names(I2.others) } } }; } },
            ], [1 - P, P]);
        },
    }));
    function joinInfo(w, a, c) {
        const pe = c && S(w).pend[c.t]; const by = pe && live(w, pe.by); if (!pe || !by || pe.by !== c.by || by === a || !pe.c.includes(a.agentId) || pe.yes.includes(a.agentId) || pe.no.includes(a.agentId) || nFac(w, a) >= 2) return null;
        const others = pe.c.map(id => live(w, id)).filter(o => o && o !== a); return { pe, by, others, foes: others.filter(o => aff(a, o) <= -20), mine: nFac(w, a) };
    }
    function settle(w, type) {
        const O = S(w); const pe = O.pend[type]; if (!pe) return; delete O.pend[type]; const Fs = FS(w); if (!Fs) return;
        const yes = pe.yes.map(id => live(w, id)).filter(o => o && nFac(w, o) < 2); const by = w.agents[pe.by];
        if (yes.length >= 3 && !Object.values(Fs.factions).some(f => f.type === type)) { Fs._formFaction(w, type, yes); st(w, 'formed'); return; }
        st(w, 'failed'); if (by) { log(w, 'social', '🫥 {a}想拉大家成立「{f}」，只有 {n} 個人答應，沒有成。', { a: by.name, f: FZH[type], n: Math.max(0, yes.length - 1) }, by.name); mem(w, by, '我想成立「{f}」，可是大家不太捧場。', { f: FZH[type] }, 5); }
    }
    const settleIfDone = (w, type) => { const pe = S(w).pend[type]; if (pe && pe.yes.length + pe.no.length >= pe.c.length + 1) settle(w, type); };
    DECIDE.kind('facJoin', Object.assign({}, base, {
        title: '有人拉你成立小團體', pri: 1.2, aiKind: 2,
        facts(w, a, c) { const I = joinInfo(w, a, c); if (!I) return '';
            return fill('{b}來找你，想拉你一起成立「{f}」。一起被找的還有：{list}。你跟{b}{tie}。你現在參加了 {n} 個小團體（最多兩個）。至少要有兩個人答應才成立。', { b: I.by.name, f: FZH[c.t], list: { raw: tieList(w, a, I.others) || t('沒有別人') }, tie: tieTxt(tie(w, a, I.by)), n: I.mine }); },
        options(w, a, c) { const I = joinInfo(w, a, c); if (!I) return []; const f = FZH[c.t];
            const adj = clampN(aff(a, I.by) / 40, -1.4, 0.4) + clampN(avgAff(a, I.others) / 80, -0.4, 0.3) + (isFam(w, a, I.by) ? 0.4 : 0) - (I.foes.length ? 0.4 : 0) - (has(a, 'shy') ? 0.3 : 0) + (has(a, 'charismatic') ? 0.2 : 0) - (hasV(a, '自由') ? 0.2 : 0) - (I.mine ? 0.15 : 0);
            return cal([
                { id: 'no', quiet: true, text: '婉拒，不想加入', say: { k: '沒有加入{b}找的「{f}」', p: { b: I.by.name, f } }, why: '我不想被綁在一個圈子裡。', lean: {},
                    run: (w2, a2) => { const pe = S(w2).pend[c.t]; if (!pe || pe.by !== c.by) return null; pe.no.push(a2.agentId); const b = w2.agents[pe.by]; if (b) { bump(b, a2, -2); mem(w2, b, '我找{a}加入「{f}」，他不肯。', { a: a2.name, f }, 4); } st(w2, 'decline'); settleIfDone(w2, c.t); return { k: '婉拒了' }; } },
                { id: 'join', quiet: true, text: { k: '答應加入「{f}」', p: { f } }, say: { k: '答應加入{b}找的「{f}」', p: { b: I.by.name, f } }, why: '跟合得來的人一起，有什麼不好。', lean: { bond: 0.2 }, adj,
                    run: (w2, a2) => { const pe = S(w2).pend[c.t]; if (!pe || pe.by !== c.by) return null; pe.yes.push(a2.agentId); st(w2, 'join'); settleIfDone(w2, c.t); return { k: '答應了' }; } },
            ], [0.15, 0.85]);
        },
    }));

    // 待不下去的人：跟裡面的人翻臉（以前每三天 20% 退出）、團體跟自己的家人或恩人作對、團體名聲變差（後兩種是新的，十二天最多問一次）
    function leaveCheck(w, Fs, f, a, avg) {
        if (!live(w, a.agentId) || jailed(w, a)) return; const O = S(w), d = day(w); let why = null, x = null;
        if (avg < -30) why = 'feud';
        else { const ck = 'lv|' + f.id + '|' + a.agentId; if ((O.cool[ck] || 0) > d) return;
            const k = kinFoe(w, f, a); if (k) { why = 'kin'; x = k.agentId; } else if (badName(w, f, a)) why = 'rep';
            if (why) O.cool[ck] = d + 12; }
        if (why) ask(w, a, 'facLeave', { f: f.id, why, x, d });
    }
    const rivalOf = (w, f) => (f?.rivalFactionId ? facOf(w, f.rivalFactionId) : null);
    function kinFoe(w, f, a) { const R = rivalOf(w, f); if (!R) return null; return R.members.map(id => w.agents[id]).find(o => o && !o.isDead && o !== a && !f.hasMember(o.agentId) && (isFam(w, a, o) || owes(w, a, o))) || null; }
    const shady = (w, o) => { try { return typeof DARK !== 'undefined' && (DARK.reputation(w, o) || []).includes('scheming'); } catch (e) { return false; } };
    function badName(w, f, a) { const ms = f.members.map(id => w.agents[id]).filter(o => o && !o.isDead && o !== a); const n = ms.filter(o => shady(w, o)).length; return n >= 2 && n >= ms.length / 2 ? n : 0; }
    function leaveInfo(w, a, c) {
        const f = c && facOf(w, c.f); if (!f || !f.hasMember(a.agentId) || day(w) - (c.d ?? 0) > 1) return null; const others = f.members.map(id => w.agents[id]).filter(o => o && !o.isDead && o !== a); if (!others.length) return null;
        const worst = others.slice().sort((x, y) => aff(a, x) - aff(a, y))[0]; const x = c.x ? w.agents[c.x] : null; const R = rivalOf(w, f);
        if (c.why === 'kin' && (!x || !R)) return null;
        return { f, others, worst, avg: Math.round(avgAff(a, others)), x, R, days: Math.max(0, Math.floor((w.tickCount - (f.formedTick || 0)) / 96)), shady: badName(w, f, a) };
    }
    DECIDE.kind('facLeave', Object.assign({}, base, {
        title: '在小團體裡待不下去', pri: 1.1, aiKind: 1,
        facts(w, a, c) { const I = leaveInfo(w, a, c); if (!I) return ''; const f = fnm(I.f);
            const why = c.why === 'feud' ? { k: '你跟「{f}」裡的人處得很差：你對他們的好感平均是 {v}，最受不了的是{x}（{n}）。', p: { f, v: I.avg, x: I.worst.name, n: Math.round(aff(a, I.worst)) } }
                : c.why === 'kin' ? { k: '「{f}」正跟「{g}」槓上，可是{x}在「{g}」那邊，他是{rel}。', p: { f, g: fnm(I.R), x: I.x.name, rel: isFam(w, a, I.x) ? '你的家人' : '你的恩人' } }
                : { k: '「{f}」的名聲越來越差：裡面有 {n} 個人在大家眼中很陰險。', p: { f, n: I.shady } };
            return fill('{why}你在這個團體裡 {d} 天了。悄悄淡出，沒人會說什麼；公開退出，大家都會知道。', { why, d: I.days }); },
        options(w, a, c) { const I = leaveInfo(w, a, c); if (!I) return []; const f = fnm(I.f); const feud = c.why === 'feud';
            const stay = (hasV(a, '社群') ? 0.2 : 0) + (I.f.members.length <= 2 ? 0.2 : 0);
            return cal([
                { id: 'stay', quiet: true, mute: true, text: '留下來', say: { k: '留在「{f}」', p: { f } }, why: '待久了，走了也捨不得。', lean: {}, run: () => null },
                { id: 'fade', quiet: true, text: '悄悄淡出，不再去聚會', say: { k: '慢慢不去「{f}」了', p: { f } }, why: '不想鬧得大家都難看，慢慢不去就好。', lean: { safe: 0.1 }, adj: (has(a, 'shy') ? 0.3 : 0) + (has(a, 'kind') ? 0.2 : 0) - stay,
                    run: (w2, a2) => { const f2 = facOf(w2, c.f); if (!f2 || !FS(w2)._leaveFaction(w2, f2, a2, 'fade')) return null; st(w2, 'fade'); return { k: '慢慢不去「{f}」了', p: { f } }; } },
                { id: 'quit', quiet: true, text: '公開退出', say: { k: '退出了「{f}」', p: { f } }, why: c.why === 'kin' ? { k: '他們跟{x}作對，我不能站在那邊。', p: { x: I.x.name } } : '我受不了他們了。', lean: { face: 0.1 }, adj: (has(a, 'abrasive') ? 0.3 : 0) - (has(a, 'shy') ? 0.3 : 0) + (c.why === 'kin' ? 0.3 : 0) - stay,
                    run: (w2, a2) => { const f2 = facOf(w2, c.f); if (!f2 || !FS(w2)._leaveFaction(w2, f2, a2, 'quit')) return null; st(w2, 'quit'); for (const id of f2.members) { const o = w2.agents[id]; if (o) bump(o, a2, -3); } return { k: '退出了「{f}」', p: { f } }; } },
            ], feud ? [0.8, 0.08, 0.12] : [0.96, 0.025, 0.015]); // 翻臉照以前每三天 20%；家人在對頭那邊、名聲變差是新的理由，起跑機會壓低，整體退出的次數才跟以前差不多
        },
    }));

    // 兩派碰上了（哪兩派碰上照舊看天）：帶頭的人決定怎麼對另一派
    function rival(w, Fs, fA, fB, iss) { const L = leaderOf(w, fA), M = leaderOf(w, fB); if (!L || !M || L === M) return; ask(w, L, 'facRival', { a: fA.id, b: fB.id, iss: iss ? { name: iss.name, a: iss.a } : null, d: day(w) }); }
    function rivalInfo(w, a, c) {
        const fA = c && facOf(w, c.a), fB = c && facOf(w, c.b); if (!fA || !fB || !fA.hasMember(a.agentId) || leaderOf(w, fA) !== a || day(w) - (c.d ?? 0) > 1) return null; const M = leaderOf(w, fB); if (!M || M === a) return null;
        const them = fB.members.map(id => w.agents[id]).filter(Boolean), us = fA.members.map(id => w.agents[id]).filter(Boolean); let good = 0, bad = 0; for (const x of us) for (const y of them) { const v = aff(x, y); if (v >= 25) good++; else if (v <= -15) bad++; }
        return { fA, fB, M, them, us, good, bad, cross: us.length && them.length ? us.reduce((s, x) => s + them.reduce((s2, y) => s2 + aff(x, y), 0), 0) / (us.length * them.length) : 0, rivals: fA.rivalFactionId === fB.id, allies: fA.allyFactionId === fB.id };
    }
    const QA = 0.9; // 對方接受示好的機會（照個性算的平均）：示好的起跑機會要除掉這一份，整體合作的次數才跟以前差不多
    DECIDE.kind('facRival', Object.assign({}, base, {
        title: '碰上另一派，怎麼對他們', pri: 1.2, aiKind: 1,
        facts(w, a, c) { const I = rivalInfo(w, a, c); if (!I) return '';
            return fill('你帶頭的「{f}」跟「{g}」碰上了，兩邊{state}。{iss}你跟他們帶頭的{l}{tie}。你們這邊有 {k} 對人跟他們那邊有交情、{h} 對有過節。你們 {n} 個人，他們 {m} 個人。', { f: fnm(I.fA), g: fnm(I.fB), state: I.rivals ? '本來就是死對頭' : I.allies ? '本來是盟友' : '沒什麼往來',
                iss: c.iss ? { k: '兩邊對{x}看法相反：一邊說好，一邊說不行。', p: { x: c.iss.name } } : { raw: '' }, l: I.M.name, tie: tieTxt(tie(w, a, I.M)), k: I.good, h: I.bad, n: I.us.length, m: I.them.length }); },
        options(w, a, c) { const I = rivalInfo(w, a, c); if (!I) return []; const g = fnm(I.fB);
            // 以前：兩派對同一件事看法相反就吵（70% 那一段全是吵）；不然四成想吵（已經是死對頭才吵得起來，不是的話只有三成）、三成合作
            let pc = c.iss ? 0.85 : (0.4 / 0.7) * (I.rivals ? 1 : 0.3), pa = c.iss ? 0.05 : Math.min(0.9, (0.3 / 0.7) / QA); if (pc + pa > 0.97) { const k = 0.97 / (pc + pa); pc *= k; pa *= k; }
            const warm = clampN(I.cross / 80, -0.3, 0.3) + clampN(aff(a, I.M) / 120, -0.2, 0.2);
            return cal([
                { id: 'ignore', quiet: true, mute: true, text: '不理他們', say: { k: '沒有去惹「{g}」', p: { g } }, why: '井水不犯河水。', lean: {}, run: () => null },
                { id: 'clash', quiet: true, text: { k: '帶大家跟「{g}」槓上', p: { g } }, say: { k: '帶頭跟「{g}」槓上', p: { g } }, why: '他們太囂張了，總要有人出來說話。', lean: { face: 0.2, bond: -0.1 }, adj: -warm + (has(a, 'abrasive') ? 0.3 : 0) + (has(a, 'jealous') ? 0.2 : 0) - (has(a, 'kind') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = rivalInfo(w2, a2, c); if (!I2) return null; FS(w2)._clash(w2, I2.fA, I2.fB, c.iss); st(w2, 'clash'); ask(w2, I2.M, 'facReply', { a: c.a, b: c.b, how: 'clash', by: a2.agentId, d: day(w2) }); return { k: '跟「{g}」吵起來了', p: { g } }; } },
                { id: 'befriend', quiet: true, text: { k: '去找「{g}」帶頭的{l}示好', p: { g, l: I.M.name } }, say: { k: '去跟「{g}」示好', p: { g } }, why: '大家住同一個鎮，與其吵不如合作。', lean: { bond: 0.2 }, adj: warm + (has(a, 'kind') ? 0.3 : 0) + (has(a, 'charismatic') ? 0.2 : 0) - (has(a, 'abrasive') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = rivalInfo(w2, a2, c); if (!I2) return null; st(w2, 'befriend'); log(w2, 'social', '🤝 「{f}」帶頭的{a}去找「{g}」的{b}，說兩邊以後互相照應。', { f: fnm(I2.fA), g, a: a2.name, b: I2.M.name }, a2.name); ask(w2, I2.M, 'facReply', { a: c.a, b: c.b, how: 'ally', by: a2.agentId, d: day(w2) }); return { k: '去跟「{g}」示好了', p: { g } }; } },
            ], [Math.max(0.02, 1 - pc - pa), pc, pa]);
        },
    }));
    function replyInfo(w, a, c) { const fA = c && facOf(w, c.a), fB = c && facOf(w, c.b); const L = c && live(w, c.by); if (!fA || !fB || !L || !fB.hasMember(a.agentId) || leaderOf(w, fB) !== a || day(w) - (c.d ?? 0) > 1) return null; return { fA, fB, L }; }
    DECIDE.kind('facReply', Object.assign({}, base, {
        title: '另一派找上門來', pri: 1.3, aiKind: 1,
        facts(w, a, c) { const I = replyInfo(w, a, c); if (!I) return '';
            return fill(c.how === 'clash' ? '「{f}」帶頭的{l}帶著他的人跟你們「{g}」槓上了，兩邊的人都在吵。你是「{g}」帶頭的，你跟{l}{tie}。' : '「{f}」帶頭的{l}來找你，說兩邊以後互相照應。你是「{g}」帶頭的，你跟{l}{tie}。', { f: fnm(I.fA), g: fnm(I.fB), l: I.L.name, tie: tieTxt(tie(w, a, I.L)) }); },
        options(w, a, c) { const I = replyInfo(w, a, c); if (!I) return []; const f = fnm(I.fA), l = I.L.name; const warm = clampN(aff(a, I.L) / 120, -0.2, 0.2);
            if (c.how === 'clash') return cal([
                { id: 'let', quiet: true, mute: true, text: '不理他們', say: { k: '沒有理「{f}」', p: { f } }, why: '跟他們吵只會越吵越大。', lean: {}, run: () => null },
                { id: 'back', quiet: true, text: '嗆回去', say: { k: '帶頭嗆回「{f}」', p: { f } }, why: '被欺負到頭上了，不能不回。', lean: { face: 0.2 }, adj: -warm + (has(a, 'abrasive') ? 0.3 : 0) - (has(a, 'kind') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = replyInfo(w2, a2, c); if (!I2) return null; for (const x of I2.fA.members) for (const y of I2.fB.members) { const p = w2.agents[x], q = w2.agents[y]; if (p && q) { bump(p, q, -2); bump(q, p, -2); } } st(w2, 'back'); log(w2, 'social', '💢 「{g}」帶頭的{a}帶著大家回嘴，跟「{f}」越吵越兇。', { g: fnm(I2.fB), a: a2.name, f }, a2.name); return { k: '嗆回去了' }; } },
                { id: 'calm', quiet: true, text: { k: '去找{l}把話說開', p: { l } }, say: { k: '去找{l}把話說開', p: { l } }, why: '吵下去對誰都沒好處。', lean: { bond: 0.2 }, adj: warm + (has(a, 'kind') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = replyInfo(w2, a2, c); if (!I2) return null; I2.fA.rivalFactionId = null; I2.fB.rivalFactionId = null; bump(a2, I2.L, 3); bump(I2.L, a2, 3); st(w2, 'calm'); log(w2, 'social', '🫱 「{g}」帶頭的{a}去找{l}把話說開，兩派暫時不吵了。', { g: fnm(I2.fB), a: a2.name, l }, a2.name); return { k: '跟{l}把話說開了', p: { l } }; } },
            ], [0.4, 0.4, 0.2]);
            return cal([
                { id: 'let', quiet: true, mute: true, text: '不理他', say: { k: '沒有回應{l}', p: { l } }, why: '先看看他們想幹嘛。', lean: {}, run: () => null },
                { id: 'accept', quiet: true, text: '接受，兩邊以後互相照應', say: { k: '跟「{f}」握手言和', p: { f } }, why: '多個朋友總比多個敵人好。', lean: { bond: 0.2 }, adj: warm + (has(a, 'kind') ? 0.2 : 0) - (has(a, 'jealous') ? 0.2 : 0),
                    run: (w2, a2) => { const I2 = replyInfo(w2, a2, c); if (!I2) return null; FS(w2)._ally(w2, I2.fA, I2.fB); st(w2, 'allied'); return { k: '跟「{f}」合作了', p: { f } }; } },
                { id: 'refuse', quiet: true, text: '婉拒', say: { k: '婉拒了{l}', p: { l } }, why: '我們跟他們不是一路的。', lean: { face: 0.1 }, adj: -warm + (has(a, 'abrasive') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = replyInfo(w2, a2, c); if (!I2) return null; bump(I2.L, a2, -5); st(w2, 'refuse'); mem(w2, I2.L, '我去找{a}示好，他不領情。', { a: a2.name }, 5); return { k: '婉拒了{l}', p: { l } }; } },
            ], [0.04, QA, 0.06]);
        },
    }));
    // 團體裡的摩擦（以前三成的日子挑兩個人擲骰，四成鬧起來）：最受不了某人的那一位自己決定
    function row(w, Fs, f) {
        const ms = f.members.map(id => live(w, id)).filter(o => o && !jailed(w, o)); if (ms.length < 2) return; let best = null, bv = 1e9;
        for (const x of ms) for (const y of ms) if (x !== y) { const v = aff(x, y); if (v < bv) { bv = v; best = [x, y]; } }
        if (best) ask(w, best[0], 'facRow', { f: f.id, x: best[1].agentId, d: day(w) });
    }
    function rowInfo(w, a, c) { const f = c && facOf(w, c.f); const x = c && live(w, c.x); if (!f || !x || x === a || !f.hasMember(a.agentId) || !f.hasMember(x.agentId) || day(w) - (c.d ?? 0) > 1) return null; return { f, x }; }
    DECIDE.kind('facRow', Object.assign({}, base, {
        title: '團體裡有人讓你受不了', pri: 1, aiKind: 1,
        facts(w, a, c) { const I = rowInfo(w, a, c); if (!I) return ''; return fill('「{f}」今天聚會，{x}也在。你們之間{tie}，你對他的好感是 {v}。當眾說他，團體裡的人會看笑話，你們也會吵得更兇。', { f: fnm(I.f), x: I.x.name, tie: tieTxt(tie(w, a, I.x)), v: Math.round(aff(a, I.x)) }); },
        options(w, a, c) { const I = rowInfo(w, a, c); if (!I) return []; const x = I.x.name; const v = aff(a, I.x);
            return cal([
                { id: 'hold', quiet: true, mute: true, text: '忍著，不說什麼', say: { k: '忍著沒說{x}', p: { x } }, why: '大家都在，鬧開了不好看。', lean: {}, run: () => null },
                { id: 'call', quiet: true, text: { k: '當眾指責{x}', p: { x } }, say: { k: '在聚會上當眾指責{x}', p: { x } }, why: { k: '{x}太過分了，我今天一定要說。', p: { x } }, lean: { face: 0.2 }, adj: (v <= -30 ? 0.4 : v >= 30 ? -0.15 : 0) + (has(a, 'abrasive') ? 0.3 : 0) - (has(a, 'shy') ? 0.3 : 0) - (has(a, 'kind') ? 0.2 : 0),
                    run: (w2, a2) => { const I2 = rowInfo(w2, a2, c); if (!I2) return null; FS(w2)._drama(w2, I2.f, a2, I2.x); st(w2, 'call'); return { k: '當眾說了{x}', p: { x } }; } },
                { id: 'talk', quiet: true, text: { k: '散會後私下找{x}講開', p: { x } }, say: { k: '私下找{x}講開', p: { x } }, why: '有話私下說，不用鬧到大家都知道。', lean: { bond: 0.2 }, adj: (has(a, 'kind') ? 0.3 : 0) + (hasV(a, '和平') ? 0.2 : 0) - (has(a, 'abrasive') ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = rowInfo(w2, a2, c); if (!I2) return null; bump(a2, I2.x, 3); bump(I2.x, a2, 3); I2.f.cohesion = Math.min(100, (I2.f.cohesion || 50) + 3); st(w2, 'talk'); mem(w2, I2.x, '{a}私下來找我把話說開。', { a: a2.name }, 5); return { k: '跟{x}私下講開了', p: { x } }; } },
            ], [0.4, 0.45, 0.15]); // 以前挑到的兩個人四成會鬧起來；現在挑的是最受不了對方的那一位，處得還好的才少一點
        },
    }));

    // ================= B. 報社 =================
    const PR = () => (typeof PRESS !== 'undefined' ? PRESS : null);
    const paper = (w, id) => (w.press?.papers || []).find(P => P.id === id) || null;
    const elecOn = (w) => { const E = w.election; return !!(E && E.active && (E.phase === 'campaign' || E.phase === 'voting')); };
    const cands = (w) => (w.election?.candidates || []).map(c => w.agents[c.agentId]).filter(a => a && !a.isDead);
    const roleOf = (P, a) => (P.owner === a.agentId ? '的東家' : '的主筆');
    const secOf = (w, id) => (w.dark?.secrets || []).find(s => s.id === id) || null;
    const owedTo = (w, pol, donor) => { try { return (typeof POWER !== 'undefined' && POWER.S(w).inf?.[pol.agentId]?.[donor.agentId]) || 0; } catch (e) { return 0; } };
    const patron = (w, P, ed, c) => (P.owner === c.agentId ? 'owner' : owedTo(w, ed, c) >= 20 ? 'donor' : null);
    const credTxt = (P) => ({ k: '報社的信譽是 {n}／100。', p: { n: Math.round(P.cred) } });
    function lastHit(w, a, c) { const h = w.press?.ord?.hit?.[c.agentId]; if (!h) return { raw: '' }; return { k: '{n} 天前報上登過{c}的事，他到現在還記恨（對你的好感 {f}）。', p: { n: Math.max(0, day(w) - h.d), c: c.name, f: Math.round(aff(c, a)) } }; }

    // 挖到了（照舊看天）：交給主筆（或東家）決定
    function scoop(w, P, sec) {
        const ed = PR().editorOf(w, P); const c = w.agents[sec.culprit]; if (!ed || !c || ed === c) return false;
        (sec.pseen || (sec.pseen = [])).push(P.id); ask(w, ed, 'pressScoop', { pid: P.id, sid: sec.id, d: day(w) }); return true;
    }
    function scoopInfo(w, a, c) {
        const P = c && paper(w, c.pid); const sec = c && secOf(w, c.sid); if (!P || !sec || sec.found || P.banned && !P.underground || P.closed || PR().editorOf(w, P) !== a || day(w) - (c.d ?? 0) > 1) return null; // v11.8.0 不再要求選舉還在進行：查證兩天、選舉在這兩天內結束，這一件也要再問一次
        const cu = w.agents[sec.culprit]; if (!cu || cu.isDead || cu === a) return null; const J = w.agents[P.journo];
        return { P, sec, cu, over: !elecOn(w), won: (() => { try { return w.election?.currentMayor?.(w) === cu; } catch (e) { return false; } })(), J: J && J !== a ? J : null, pat: patron(w, P, a, cu), tie: tie(w, a, cu), hush: Math.floor(clampN(Math.round(cash(w, cu) * 0.3), 15, 80)), rich: cash(w, cu) >= 15 };
    }
    DECIDE.kind('pressScoop', Object.assign({}, base, {
        title: '挖到候選人的醜聞', pri: 1.8, aiKind: 2,
        facts(w, a, c) { const I = scoopInfo(w, a, c); if (!I) return '';
            return fill('你是{paper}{role}。{who}挖到候選人{c}的事：{what}。你跟{c}{tie}。{pat}{last}{cred}{ver}{after}', { paper: I.P.name[0], role: roleOf(I.P, a), who: I.J ? { k: '記者{j}', p: { j: I.J.name } } : '你自己', c: I.cu.name, what: { k: I.sec.k, p: I.sec.p }, tie: tieTxt(I.tie),
                pat: I.pat === 'owner' ? { k: '{c}是這家報社的東家。', p: { c: I.cu.name } } : I.pat === 'donor' ? { k: '{c}前後給過你 {n} 銀幣。', p: { c: I.cu.name, n: Math.round(owedTo(w, a, I.cu)) } } : { raw: '' }, last: lastHit(w, a, I.cu), cred: credTxt(I.P), ver: c.ver ? '你已經查證過了，證據確實。' : { raw: '' },
                // v11.8.0 選舉結束了就照實寫：登出來不會再影響選票，但會照 exposeDo 做的事發生（大家知道、他的名聲變差、記恨你、報社信譽加分）
                after: I.over ? { k: '選舉已經結束，{c}{res}。登出來，鎮上的人會知道這件事，{c}在大家眼中的名聲會變差（以後他說的話、提的案比較沒人信），他也會記恨你；報社的信譽會加分。', p: { c: I.cu.name, res: I.won ? '當選了' : '沒有當選' } } : { k: '登出來，{c}的選情會受重傷，也會記恨你。', p: { c: I.cu.name } } }); },
        options(w, a, c) { const I = scoopInfo(w, a, c); if (!I) return []; const cn = I.cu.name; const pp = I.P.name[0]; const hon = honesty(a);
            const close = I.tie === '家人' ? 1.2 : I.tie === '很要好' ? 0.6 : I.tie === '有交情' ? 0.2 : 0; const foe = I.tie === '有過節' ? 0.4 : 0; const pat = I.pat ? 0.5 : 0; const straight = (has(a, 'perfectionist') ? 0.4 : 0) + (hon >= 4 ? 0.3 : 0);
            const out = [
                { id: 'bury', quiet: true, mute: true, text: '壓下來，不登', say: { k: '把{c}的醜聞壓了下來', p: { c: cn } }, why: '得罪人的事，能不登就不登。', lean: { safe: 0.1 }, adj: close + pat + (w.press?.ord?.hit?.[I.cu.agentId] ? 0.2 : 0) - straight - foe,
                    run: (w2, a2) => { st(w2, 'bury'); mem(w2, a2, '報社挖到{c}的事，我壓下來沒登。', { c: cn }, 6); return { k: '沒有登' }; } },
                { id: 'print', quiet: true, text: '照實登出來', say: { k: '在{paper}登出{c}的醜聞', p: { paper: pp, c: cn } }, why: '查到的事就該讓大家知道。', lean: { face: 0.2 }, adj: straight + foe - close * 0.3,
                    run: (w2, a2) => { const I2 = scoopInfo(w2, a2, c); if (!I2) return null; PR().exposeDo(w2, I2.P, I2.sec, a2, c.ver ? 3 : 0); st(w2, 'print'); return { k: '登出來了' }; } },
            ];
            if (I.rich) out.push({ id: 'deal', quiet: true, mute: true, text: { k: '私下去找{c}談：給 {n} 銀幣就不登', p: { c: cn, n: I.hush } }, say: { k: '拿醜聞去跟{c}談條件', p: { c: cn } }, why: '登了也只是一天的新聞，不如換點實在的。', lean: { gain: 0.2 }, adj: (has(a, 'greedy') ? 0.6 : 0) + (hasV(a, '財富') ? 0.3 : 0) + (hon <= 1.5 ? 0.3 : 0) - (hon >= 4 ? 0.8 : 0) - (has(a, 'perfectionist') ? 0.5 : 0) + close * 0.2 + pat * 0.4,
                run: (w2, a2) => { const I2 = scoopInfo(w2, a2, c); if (!I2) return null; st(w2, 'deal'); ask(w2, I2.cu, 'pressHush', { pid: c.pid, sid: c.sid, by: a2.agentId, n: I2.hush, d: day(w2) }); return { k: '去找{c}談了', p: { c: cn } }; } });
            if (!c.ver) out.push({ id: 'verify', quiet: true, text: '先查證，過兩天再決定', say: { k: '先查證{c}的事', p: { c: cn } }, why: '登錯了報社就完了，先查清楚。', lean: { safe: 0.1 }, adj: (has(a, 'perfectionist') ? 0.4 : 0) + (I.P.cred < 40 ? 0.2 : 0) + close * 0.2,
                run: (w2, a2) => { S(w2).ver.push({ pid: c.pid, sid: c.sid, by: a2.agentId, at: day(w2) + 2 }); st(w2, 'verify'); return { k: '先去查證了' }; } });
            const ps = out.map(o => ({ bury: 0.04, print: c.ver ? 0.92 : 0.88, deal: 0.04, verify: 0.04 })[o.id]); return cal(out, [ps[0], ...ps.slice(1)]);
        },
    }));
    function hushInfo(w, a, c) {
        const P = c && paper(w, c.pid); const sec = c && secOf(w, c.sid); const ed = c && live(w, c.by); if (!P || !sec || sec.found || !ed || sec.culprit !== a.agentId || day(w) - (c.d ?? 0) > 1) return null; // v11.8.0 選舉結束了也照樣問（以前會悄悄不見）
        return { P, sec, ed, n: c.n, can: cash(w, a) >= c.n, over: !elecOn(w), won: (() => { try { return w.election?.currentMayor?.(w) === a; } catch (e) { return false; } })() };
    }
    DECIDE.kind('pressHush', Object.assign({}, base, {
        title: '報社拿你的醜聞來談條件', pri: 1.9, aiKind: 1,
        facts(w, a, c) { const I = hushInfo(w, a, c); if (!I) return '';
            return fill('{e}私下來找你：{paper}手上有你的事（{what}），他說給他 {n} 銀幣就不登。{over}你身上有 {c} 銀幣。你跟{e}{tie}。不付，明天就見報；付了，這筆錢要是被人知道，會更難看。', { e: I.ed.name, paper: I.P.name[0], what: { k: I.sec.k, p: I.sec.p }, n: I.n, c: Math.floor(cash(w, a)), tie: tieTxt(tie(w, a, I.ed)),
                over: I.over ? { k: '選舉已經結束，你{res}；登出來不會再影響選票，可是鎮上的人都會知道，你的名聲會變差。', p: { res: I.won ? '當選了' : '沒有當選' } } : { raw: '' } }); },
        options(w, a, c) { const I = hushInfo(w, a, c); if (!I) return []; const e = I.ed.name;
            const out = [{ id: 'refuse', quiet: true, text: '不付，要登就登', say: { k: '不肯付錢給{e}', p: { e } }, why: '被他勒索一次，就會有第二次。', lean: { face: 0.2 },
                run: (w2, a2) => { const I2 = hushInfo(w2, a2, c); if (!I2) return null; st(w2, 'hushNo'); mem(w2, a2, '{e}要我付錢封口，我沒付。', { e }, 6); PR().exposeDo(w2, I2.P, I2.sec, I2.ed, 0); return { k: '{e}把事情登出來了', p: { e } }; } }];
            if (I.can) out.push({ id: 'pay', quiet: true, mute: true, text: { k: '付 {n} 銀幣封口', p: { n: I.n } }, say: { k: '付錢給{e}封口', p: { e } }, why: I.over ? '這件事傳出去，往後在鎮上抬不起頭。' : '選舉就差這幾天，不能讓這件事見報。', lean: { safe: 0.2 }, adj: clampN((cash(w, a) - I.n * 2) / 200, -0.4, 0.4) + (has(a, 'neurotic') ? 0.2 : 0) - (has(a, 'abrasive') ? 0.3 : 0) - (honesty(a) >= 4 ? 0.4 : 0) + (has(a, 'ambitious') ? 0.2 : 0),
                run: (w2, a2) => { const I2 = hushInfo(w2, a2, c); if (!I2 || !I2.can) return null; if (!WALLET.pay(w2, a2, I2.ed, I2.n)) return null; st(w2, 'hushPaid');
                    try { DARK.secret(w2, { kind: 'scheme', culprit: I2.ed.agentId, victim: a2.agentId, k: '{e}拿{c}的醜聞要錢，收了 {n} 銀幣就沒登', p: { e: I2.ed.name, c: a2.name, n: I2.n } }); } catch (x) {}
                    mem(w2, a2, '我付了 {n} 銀幣給{e}，他答應不登我的事。', { n: I2.n, e }, 7); mem(w2, I2.ed, '{c}付了 {n} 銀幣，我答應不登他的事。', { c: a2.name, n: I2.n }, 7); return { k: '付了 {n} 銀幣', p: { n: I2.n } }; } });
            return cal(out, out.length > 1 ? [0.4, 0.6] : [1]);
        },
    }));
    // 先查證的那幾件：兩天後再問一次（這次沒有「先查證」）
    // v11.8.0 一定會再問到：選舉結束了照樣問。只有那件事已經被別人揭穿、當事人不在鎮上或過世、報社登不出來時才作廢，作廢時查證的人記得這件事（不會悄悄不見）；
    //         主筆剛好不在鎮上就隔天再看，等十天還等不到才算了
    function verDaily(w) {
        const O = S(w), d = day(w); const keep = [];
        for (const x of O.ver) {
            if (x.at > d) { keep.push(x); continue; }
            const P = paper(w, x.pid); const sec = secOf(w, x.sid); const cu = sec && w.agents[sec.culprit]; const by = w.agents[x.by]; const cn = cu?.name || '';
            const drop = (k) => { st(w, 'verDrop'); if (by && !by.isDead) mem(w, by, k, { c: cn }, 6); };
            if (!sec || sec.found) { drop('我查證到一半，事情已經被別人登出來了。'); continue; }
            if (!cu || cu.isDead || !live(w, cu.agentId)) { drop('我查證{c}的事查到一半，他已經不在鎮上了，這件事只好作罷。'); continue; }
            if (!P || P.closed || (P.banned && !P.underground)) { drop('{c}那件事我查證好了，可是報社登不出來了。'); continue; }
            const ed = PR()?.editorOf(w, P); if (!ed || ed === cu) { if (d - x.at < 10) keep.push(x); else drop('{c}那件事我查證好了，一直沒機會登。'); continue; }
            ask(w, ed, 'pressScoop', { pid: x.pid, sid: x.sid, d, ver: 1 });
        }
        O.ver = keep;
    }

    // 抹黑：八卦報或被收買的報社，兩天問主筆一次（以前每天 25%）
    function smearAsk(w, P, cs) { const ed = PR().editorOf(w, P); if (!ed) return; const O = S(w), d = day(w), ck = 'sm|' + P.id; if ((O.cool[ck] || 0) > d) return; O.cool[ck] = d + 2; ask(w, ed, 'pressSmear', { pid: P.id, d }); }
    function smearInfo(w, a, c) {
        const P = c && paper(w, c.pid); if (!P || (P.st !== 'gossip' && !P.bribedBy) || (P.banned && !P.underground) || PR().editorOf(w, P) !== a || !elecOn(w) || day(w) - (c.d ?? 0) > 1) return null;
        const pat = P.bribedBy ? w.agents[P.bribedBy] : null; const vs = cands(w).filter(v => v !== a && v.agentId !== P.bribedBy); if (!vs.length) return null; return { P, pat, vs };
    }
    const smearW = (w, a, pat, v) => (1 + (aff(a, v) <= -15 ? 2 : 0) + (pat && aff(pat, v) <= -15 ? 1 : 0) + (pat ? 0.5 : 0)) * (isFam(w, a, v) ? 0.05 : aff(a, v) >= 60 ? 0.2 : aff(a, v) >= 25 ? 0.6 : 1);
    DECIDE.kind('pressSmear', Object.assign({}, base, {
        title: '要不要登抹黑的假消息', pri: 1.2, aiKind: 1,
        facts(w, a, c) { const I = smearInfo(w, a, c); if (!I) return '';
            return fill('你是{paper}{role}。{why}選舉正熱，報上隨便登一則對候選人不利的傳聞，讀者大多會信；可是被拆穿的話，報社的信譽會大跌。{cred}候選人：{list}。', { paper: I.P.name[0], role: roleOf(I.P, a), why: I.pat ? { k: '{b}花錢買了你的版面，要你替他說話。', p: { b: I.pat.name } } : '你的報是閒話報，讀者就愛看醜聞。', cred: credTxt(I.P),
                list: { raw: I.vs.map(v => `${t(v.name)}${t('（')}${fill('你跟他{tie}', { tie: tieTxt(tie(w, a, v)) })}${I.pat && aff(I.pat, v) <= -15 ? t('，跟金主有過節') : ''}${t('）')}`).join(t('、')) } }); },
        options(w, a, c) { const I = smearInfo(w, a, c); if (!I) return []; const P0 = 1 - 0.75 * 0.75; const ws = I.vs.map(v => smearW(w, a, I.pat, v)); const sw = ws.reduce((x, y) => x + y, 0) || 1; const hon = honesty(a);
            const adj = (hon >= 4 ? -0.8 : hon <= 1.5 ? 0.3 : 0) - (has(a, 'perfectionist') ? 0.6 : 0) + (has(a, 'jealous') ? 0.2 : 0) + (has(a, 'gossip') ? 0.2 : 0) - (I.P.cred < 25 ? 0.3 : 0);
            const out = [{ id: 'no', quiet: true, mute: true, text: '不登，沒根據的事不寫', say: '沒有登抹黑的消息', why: '登假消息，總有一天會被拆穿。', lean: {}, run: () => null }];
            I.vs.forEach((v, i) => out.push({ id: 'smear:' + v.agentId, quiet: true, text: { k: '登一則{x}的醜聞', p: { x: v.name } }, say: { k: '在{paper}登了一則抹黑{x}的消息', p: { paper: I.P.name[0], x: v.name } }, why: aff(a, v) <= -15 ? { k: '{x}早就該有人治治他了。', p: { x: v.name } } : '讀者愛看，報紙才賣得出去。', lean: { gain: 0.1, face: -0.1 }, adj,
                run: (w2, a2) => { const I2 = smearInfo(w2, a2, c); const v2 = I2 && I2.vs.find(x => x.agentId === v.agentId); if (!v2) return null; PR().smearDo(w2, I2.P, v2, I2.P.bribedBy); st(w2, 'smear'); return { k: '登了{x}的醜聞', p: { x: v.name } }; } }));
            return cal(out, [1 - P0, ...ws.map(x => P0 * x / sw)]);
        },
    }));

    // 假消息被拆穿了（照舊每天 30% 看天）：主筆決定更不更正
    function fixAsk(w, P, s) { const ed = PR().editorOf(w, P); if (!ed) return false; const d = day(w); if (s.fixAsk != null && d - s.fixAsk < 3) return true; s.fixAsk = d; ask(w, ed, 'pressFix', { pid: P.id, sid: s.id, d }); return true; }
    function fixInfo(w, a, c) { const P = c && paper(w, c.pid); const s = P && P.stories.find(x => x.id === c.sid); if (!P || !s || !s.fake || s.corrected || s.fixed || PR().editorOf(w, P) !== a || day(w) - (c.d ?? 0) > 1) return null; const v = w.agents[s.cand]; if (!v || v.isDead) return null; return { P, s, v, by: s.by ? w.agents[s.by] : null }; }
    DECIDE.kind('pressFix', Object.assign({}, base, {
        title: '登的假消息被拆穿了', pri: 1.6, aiKind: 1,
        facts(w, a, c) { const I = fixInfo(w, a, c); if (!I) return '';
            return fill('{paper}先前登的「{lie}」被拆穿了，大家都知道是假的，{v}很生氣。你跟{v}{tie}。{by}{cred}登更正啟事，信譽會掉 20；裝沒事，掉得更多；也可以再補一刀。', { paper: I.P.name[0], lie: { k: I.s.k, p: I.s.p }, v: I.v.name, tie: tieTxt(tie(w, a, I.v)), by: I.by ? { k: '那一則是替{b}登的。', p: { b: I.by.name } } : { raw: '' }, cred: credTxt(I.P) }); },
        options(w, a, c) { const I = fixInfo(w, a, c); if (!I) return []; const v = I.v.name; const foe = aff(a, I.v) <= -15;
            return cal([
                { id: 'correct', quiet: true, text: '登更正啟事', say: { k: '登了更正，還{v}清白', p: { v } }, why: '錯了就要認，報社才有人信。', lean: { face: -0.1 }, adj: (has(a, 'perfectionist') ? 0.5 : 0) + (honesty(a) >= 4 ? 0.4 : 0),
                    run: (w2, a2) => { const I2 = fixInfo(w2, a2, c); if (!I2) return null; I2.s.fixed = true; PR().correctDo(w2, I2.P, I2.s); st(w2, 'correct'); return { k: '登了更正' }; } },
                { id: 'ignore', quiet: true, mute: true, text: '裝沒事，不更正', say: { k: '沒有更正抹黑{v}的報導', p: { v } }, why: '更正等於自己打臉，過幾天大家就忘了。', lean: { face: 0.1 }, adj: (has(a, 'abrasive') ? 0.3 : 0) + (has(a, 'jealous') ? 0.2 : 0) - (has(a, 'perfectionist') ? 0.4 : 0),
                    run: (w2, a2) => { const I2 = fixInfo(w2, a2, c); if (!I2) return null; I2.s.fixed = true; I2.P.cred = Math.max(5, I2.P.cred - 25); bump(I2.v, a2, -10); mem(w2, I2.v, '{paper}造謠抹黑我，被拆穿了還不肯更正。', { paper: I2.P.name[0] }, 7); st(w2, 'ignore');
                        if (I2.by) for (const o of npcs(w2)) if (w2.press?.reads?.[o.agentId] === I2.P.id) bump(o, I2.by, -6); return { k: '沒有更正' }; } },
                { id: 'double', quiet: true, text: { k: '再登一則，補{v}一刀', p: { v } }, say: { k: '又登了一則抹黑{v}的消息', p: { v } }, why: { k: '反正已經得罪{v}了，乾脆做到底。', p: { v } }, lean: { face: 0.2, bond: -0.1 }, adj: (foe ? 0.5 : 0) + (I.by ? 0.2 : 0) + (has(a, 'abrasive') ? 0.2 : 0) - (honesty(a) >= 4 ? 0.6 : 0),
                    run: (w2, a2) => { const I2 = fixInfo(w2, a2, c); if (!I2) return null; I2.s.fixed = true; I2.P.cred = Math.max(5, I2.P.cred - 30); bump(I2.v, a2, -20); PR().smearDo(w2, I2.P, I2.v, I2.s.by); st(w2, 'double'); mem(w2, I2.v, '{paper}造謠被拆穿，竟然又登一則來抹黑我。', { paper: I2.P.name[0] }, 8); return { k: '又登了一則' }; } },
            ], [0.8, 0.14, 0.06]);
        },
    }));

    // 有報社批評國王（以前 35% 查禁）：國王自己決定
    function banAsk(w, P, k) { if (!live(w, k.agentId)) return false; ask(w, k, 'pressBan', { pid: P.id, d: day(w) }); return true; }
    const kingOf = (w) => { try { return typeof CROWN !== 'undefined' ? CROWN.king(w) : null; } catch (e) { return null; } };
    function banInfo(w, a, c) { const P = c && paper(w, c.pid); if (!P || P.banned || kingOf(w) !== a || !w.crown || day(w) - (c.d ?? 0) > 1) return null; const ed = PR().editorOf(w, P); return { P, ed, legit: Math.round(w.crown.legit), readers: Object.values(w.press?.reads || {}).filter(x => x === P.id).length }; }
    DECIDE.kind('pressBan', Object.assign({}, base, {
        title: '有報社批評國王', pri: 1.5, aiKind: 1,
        facts(w, a, c) { const I = banInfo(w, a, c); if (!I) return '';
            return fill('你是國王。{paper}登文章說「民怨沸騰，國王該聽聽百姓的聲音」。你的民心只剩 {l}／100。這家報有 {n} 個讀者。{ed}查禁它，民心會再掉 5，讀者會很不滿，它也可能轉入地下；不查禁，批評會繼續。', { paper: I.P.name[0], l: I.legit, n: I.readers, ed: I.ed ? { k: '你跟它{role}{e}{tie}。', p: { role: roleOf(I.P, I.ed), e: I.ed.name, tie: tieTxt(tie(w, a, I.ed)) } } : { raw: '' } }); },
        options(w, a, c) { const I = banInfo(w, a, c); if (!I) return []; const pp = I.P.name[0];
            return cal([
                { id: 'let', quiet: true, mute: true, text: '不管它，讓它寫', say: { k: '沒有查禁{paper}', p: { paper: pp } }, why: '查禁只會讓人更不滿。', lean: {}, run: () => null },
                { id: 'ban', quiet: true, text: { k: '查禁{paper}', p: { paper: pp } }, say: { k: '下令查禁{paper}', p: { paper: pp } }, why: '再讓它寫下去，國家就亂了。', lean: { face: 0.2, safe: 0.1 }, adj: (hasV(a, '權力') ? 0.3 : 0) + (has(a, 'abrasive') ? 0.2 : 0) + (has(a, 'ambitious') ? 0.2 : 0) - (has(a, 'kind') ? 0.3 : 0) - (hasV(a, '自由') ? 0.4 : 0) + (I.legit < 25 ? 0.2 : 0) + (I.ed && aff(a, I.ed) <= -15 ? 0.3 : I.ed && aff(a, I.ed) >= 40 ? -0.4 : 0),
                    run: (w2, a2) => { const I2 = banInfo(w2, a2, c); if (!I2) return null; PR().banDo(w2, I2.P, a2); st(w2, 'ban'); return { k: '查禁了{paper}', p: { paper: pp } }; } },
            ], [0.65, 0.35]);
        },
    }));
    // 被查禁的報社（以前每天 20% 轉入地下）：主筆四天問一次
    function underAsk(w, P) { const ed = PR().editorOf(w, P); if (!ed) return false; const O = S(w), d = day(w), ck = 'un|' + P.id; if ((O.cool[ck] || 0) > d) return true; O.cool[ck] = d + 4; ask(w, ed, 'pressUnder', { pid: P.id, d }); return true; }
    function underInfo(w, a, c) { const P = c && paper(w, c.pid); if (!P || !P.banned || P.underground || P.closed || PR().editorOf(w, P) !== a || day(w) - (c.d ?? 0) > 1) return null; const k = kingOf(w); return { P, k, n: Math.max(0, day(w) - (P.bannedDay ?? day(w))), readers: Object.values(w.press?.reads || {}).filter(x => x === P.id).length }; }
    DECIDE.kind('pressUnder', Object.assign({}, base, {
        title: '報社被查禁了', pri: 1.3, aiKind: 1,
        facts(w, a, c) { const I = underInfo(w, a, c); if (!I) return '';
            return fill('{paper}被{k}查禁了，已經 {n} 天。你是它{role}，還有 {r} 個讀者在等。轉入地下私下印，讀的人會更多、更信，可是會更得罪{k}；也可以停刊，或是低頭改口，以後不再批評，換回解禁。{tie}', { paper: I.P.name[0], k: I.k ? { k: '國王{x}', p: { x: I.k.name } } : '國王', n: I.n, role: roleOf(I.P, a), r: I.readers, tie: I.k ? { k: '你跟國王{tie}。', p: { tie: tieTxt(tie(w, a, I.k)) } } : { raw: '' } }); },
        options(w, a, c) { const I = underInfo(w, a, c); if (!I) return []; const pp = I.P.name[0]; const kc = I.k ? aff(a, I.k) : 0;
            return cal([
                { id: 'wait', quiet: true, mute: true, text: '再等等，看風頭', say: { k: '{paper}先停幾天看看', p: { paper: pp } }, why: '現在出頭太危險了。', lean: {}, run: () => null },
                { id: 'under', quiet: true, text: '轉入地下，私下照印', say: { k: '讓{paper}轉入地下', p: { paper: pp } }, why: '他越禁，大家越想看。', lean: { face: 0.1, safe: -0.1 }, adj: (hasV(a, '自由') ? 0.4 : 0) + (has(a, 'perfectionist') ? 0.2 : 0) - (has(a, 'neurotic') ? 0.3 : 0) - (kc >= 25 ? 0.3 : 0),
                    run: (w2, a2) => { const I2 = underInfo(w2, a2, c); if (!I2) return null; PR().underDo(w2, I2.P); st(w2, 'under'); return { k: '{paper}轉入地下了', p: { paper: pp } }; } },
                { id: 'close', quiet: true, text: '停刊', say: { k: '讓{paper}停刊', p: { paper: pp } }, why: '撐不下去了，收起來吧。', lean: { safe: 0.1 }, adj: (has(a, 'pessimist') ? 0.3 : 0) + ((a.age ?? 30) >= 60 ? 0.2 : 0),
                    run: (w2, a2) => { const I2 = underInfo(w2, a2, c); if (!I2) return null; I2.P.closed = true; st(w2, 'close'); log(w2, 'news', '📪 {paper}停刊了。', { paper: pp }, a2.name); return { k: '{paper}停刊了', p: { paper: pp } }; } },
                { id: 'bow', quiet: true, text: '低頭改口，以後不再批評，換回解禁', say: { k: '讓{paper}低頭改口', p: { paper: pp } }, why: '報社還要活下去，先低頭再說。', lean: { safe: 0.1, face: -0.1 }, adj: (kc >= 25 ? 0.6 : 0) + (hasV(a, '權力') ? 0.2 : 0) + (has(a, 'greedy') ? 0.2 : 0) - (hasV(a, '自由') ? 0.4 : 0),
                    run: (w2, a2) => { const I2 = underInfo(w2, a2, c); if (!I2) return null; I2.P.banned = false; I2.P.tame = day(w2); I2.P.cred = Math.max(5, I2.P.cred - 10); if (w2.crown) w2.crown.legit = Math.min(100, w2.crown.legit + 2); st(w2, 'bow'); log(w2, 'news', '🙇 {paper}登出聲明，說以後不再批評國王，換回了解禁。', { paper: pp }, a2.name); return { k: '{paper}低頭改口了', p: { paper: pp } }; } },
            ], [0.32, 0.55, 0.05, 0.08]);
        },
    }));
    // 候選人塞錢要報社替他說話（以前記者不是完美主義就收）：主筆自己決定
    function buyAsk(w, P, a, ed, n) { ask(w, ed, 'pressBuy', { by: a.agentId, pid: P.id, n, d: day(w) }); }
    function buyInfo(w, a, c) { const P = c && paper(w, c.pid); const b = c && live(w, c.by); if (!P || !b || b === a || P.bribedBy || P.banned || PR().editorOf(w, P) !== a || !elecOn(w) || cash(w, b) < c.n || day(w) - (c.d ?? 0) > 1) return null; return { P, b }; }
    DECIDE.kind('pressBuy', Object.assign({}, base, {
        title: '候選人塞錢要報社替他說話', pri: 1.7, aiKind: 1,
        facts(w, a, c) { const I = buyInfo(w, a, c); if (!I) return '';
            return fill('候選人{b}私下來找你，拿出 {n} 銀幣，要{paper}在選戰裡替他說話。你是{paper}{role}，身上有 {m} 銀幣，跟{b}{tie}。{cred}收了，報上就得幫他；這件事傳出去，報社就完了。', { b: I.b.name, n: c.n, paper: I.P.name[0], role: roleOf(I.P, a), m: Math.floor(cash(w, a)), tie: tieTxt(tie(w, a, I.b)), cred: credTxt(I.P) }); },
        options(w, a, c) { const I = buyInfo(w, a, c); if (!I) return []; const b = I.b.name; const pp = I.P.name[0]; const hon = honesty(a); const v = aff(a, I.b);
            return cal([
                { id: 'refuse', quiet: true, text: '不收', say: { k: '沒收{b}的錢', p: { b } }, why: '收了這個錢，報紙就沒人信了。', lean: {},
                    run: (w2, a2) => { const I2 = buyInfo(w2, a2, c); if (!I2) return null; st(w2, 'buyNo'); mem(w2, I2.b, '我想塞錢給{paper}，被擋了回來。', { paper: pp }, 5); mem(w2, a2, '{a}想塞錢要我替他說好話，我沒收。', { a: b }, 6); return { k: '沒收' }; } },
                { id: 'take', quiet: true, mute: true, text: { k: '收下 {n} 銀幣', p: { n: c.n } }, say: { k: '收了{b}的錢', p: { b } }, why: '選舉嘛，誰不是這樣。', lean: { gain: 0.2 }, adj: (has(a, 'perfectionist') ? -2.5 : 0) + (hon >= 4 ? -0.8 : 0) + (has(a, 'greedy') ? 0.4 : 0) + (cash(w, a) < 30 ? 0.3 : 0) + (v >= 30 ? 0.3 : v <= -15 ? -0.6 : 0),
                    run: (w2, a2) => { const I2 = buyInfo(w2, a2, c); if (!I2 || !PR().buyDo(w2, I2.P, I2.b, a2, c.n)) return null; st(w2, 'buyTake'); return { k: '收了 {n} 銀幣', p: { n: c.n } }; } },
                { id: 'expose', quiet: true, text: '不收，還把他塞錢的事登出來', say: { k: '把{b}塞錢的事登了出來', p: { b } }, why: '想用錢買報紙，這本身就是新聞。', lean: { face: 0.2 }, adj: (has(a, 'perfectionist') ? 0.8 : 0) + (hon >= 4 ? 0.4 : 0) + (v <= -15 ? 0.4 : 0),
                    run: (w2, a2) => { const I2 = buyInfo(w2, a2, c); if (!I2) return null; st(w2, 'buyExpose'); I2.P.cred = Math.min(95, I2.P.cred + 3); PR().story(w2, I2.P, 'expose', '揭弊！{c}想花錢收買本報', { c: b }, I2.b.agentId); bump(I2.b, a2, -15); mem(w2, I2.b, '我塞錢給{paper}，結果被登了出來。', { paper: pp }, 7); return { k: '登出來了' }; } },
            ], [0.06, 0.92, 0.02]);
        },
    }));

    // ================= C. 治安 =================
    // 抓不抓得到照舊看天；抓到之後，抓到人的那位守衛（誰剛好在場是運氣）自己決定
    function caught(w, ctx) {
        const th = w.agents[ctx.th]; if (!th) return false;
        const gs = npcs(w).filter(g => g.job?.key === 'guard' && g.agentId !== ctx.th && g.agentId !== ctx.vic && live(w, g.agentId) && !jailed(w, g)); if (!gs.length) return false;
        const g = gs[Math.floor(Math.random() * gs.length)]; ask(w, g, 'caught', Object.assign({}, ctx, { g: g.agentId })); return true;
    }
    function caughtInfo(w, a, c) {
        if (!c || c.g !== a.agentId || day(w) - (c.d ?? 0) > 1) return null; const th = w.agents[c.th]; if (!th || th.isDead || jailed(w, th)) return null; const vic = c.vic ? w.agents[c.vic] : null; if (c.vic && (!vic || vic.isDead)) return null;
        const kids = npcs(w).filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(th.name)); const recent = (w.civic?.tlog || []).filter(x => day(w) - x < 14).length;
        return { th, vic, kids, recent, tth: tie(w, a, th), tv: vic ? tie(w, a, vic) : null, bribe: Math.min(Math.floor(cash(w, th)), Math.max(3, Math.round(c.n * 0.5))) };
    }
    const HEAD = { theft: '你巡邏時抓到{a}偷了{v}的 {n} 銀幣。', loot: '{cause}的混亂中，你當場抓到{a}衝進{v}的店裡搶了 {n} 銀幣。', grain: '{cause}的混亂中，你當場抓到{a}從公有糧倉扛走 {n} 份糧食。' };
    DECIDE.kind('caught', Object.assign({}, base, {
        title: '抓到小偷了', pri: 2, aiKind: 2,
        facts(w, a, c) { const I = caughtInfo(w, a, c); if (!I) return '';
            const head = fill(HEAD[c.src] || HEAD.theft, { a: I.th.name, v: I.vic?.name || '', n: c.n, cause: c.cause || '災難' });
            return fill('{h}{poor}{kids}你跟{a}{tie}{tv}。最近兩週鎮上有 {k} 起偷竊。照規矩要{back}，再關他 {d} 天。', { h: { raw: head }, a: I.th.name, poor: c.c0 != null ? { k: '他偷之前身上只剩 {c} 銀幣。', p: { c: Math.max(0, c.c0) } } : { raw: '' }, kids: I.kids.length ? { k: '他家裡有 {n} 個小孩。', p: { n: I.kids.length } } : { raw: '' },
                tie: tieTxt(I.tth), tv: I.vic ? { k: '，跟{v}{tie}', p: { v: I.vic.name, tie: tieTxt(I.tv) } } : { raw: '' }, k: I.recent, back: c.src === 'grain' ? '把糧食扛回糧倉' : { k: '把錢還給{v}', p: { v: I.vic?.name || '' } }, d: c.days }); },
        options(w, a, c) { const I = caughtInfo(w, a, c); if (!I) return []; const th = I.th.name; const hon = honesty(a);
            const close = I.tth === '家人' ? 1.6 : I.tth === '很要好' ? 0.8 : I.tth === '有交情' ? 0.3 : 0; const foe = I.tth === '有過節' ? 0.5 : 0; const vclose = I.tv === '家人' ? 0.6 : I.tv === '很要好' ? 0.4 : 0;
            const strict = (hon >= 4 ? 0.3 : 0) + (has(a, 'perfectionist') ? 0.3 : 0) + (hasV(a, '傳統') ? 0.2 : 0) + (I.recent >= 5 ? 0.3 : 0) + foe + vclose; const soft = (has(a, 'kind') ? 0.4 : 0) + (I.kids.length ? 0.2 : 0) + (c.c0 != null && c.c0 <= 1 ? 0.15 : 0);
            const out = [
                { id: 'jail', quiet: true, text: { k: '照規矩辦：關起來 {d} 天', p: { d: c.days } }, say: { k: '把{a}關了起來', p: { a: th } }, why: '偷就是偷，不能壞了規矩。', lean: { safe: 0.1 }, adj: strict,
                    run: (w2, a2) => { const I2 = caughtInfo(w2, a2, c); if (!I2) return null; doJail(w2, a2, c, I2); st(w2, 'jail'); return { k: '把{a}關了 {d} 天', p: { a: th, d: c.days } }; } },
                { id: 'repay', quiet: true, text: c.src === 'grain' ? '叫他把糧食扛回去，這次不關' : '只叫他當場把東西還回去，這次不關', say: { k: '叫{a}還回去，沒有關他', p: { a: th } }, why: '東西還了就好，關起來他一家吃什麼。', lean: { bond: 0.1 }, adj: close * 0.5 + soft - strict * 0.5,
                    run: (w2, a2) => { const I2 = caughtInfo(w2, a2, c); if (!I2) return null; doRepay(w2, a2, c, I2); st(w2, 'repay'); return { k: '叫{a}還回去了', p: { a: th } }; } },
                { id: 'spare', quiet: true, mute: true, text: '放他一馬，當作沒看到', say: { k: '放了{a}一馬', p: { a: th } }, why: I.tth === '家人' || I.tth === '很要好' ? { k: '{a}是我的人，我下不了手。', p: { a: th } } : '他也是走投無路。', lean: { bond: 0.1 }, adj: close + soft * 0.7 - strict,
                    run: (w2, a2) => { const I2 = caughtInfo(w2, a2, c); if (!I2) return null; doSpare(w2, a2, c, I2); st(w2, 'spare'); return { k: '放了{a}', p: { a: th } }; } },
            ];
            if (I.bribe >= 3) out.push({ id: 'bribe', quiet: true, mute: true, text: { k: '收他 {n} 銀幣，放他走', p: { n: I.bribe } }, say: { k: '收了{a}的錢放他走', p: { a: th } }, why: '睜一隻眼閉一隻眼，大家都好過。', lean: { gain: 0.2 }, adj: (has(a, 'greedy') ? 0.6 : 0) + (hasV(a, '財富') ? 0.3 : 0) + (hon <= 1.5 ? 0.4 : 0) - (hon >= 4 ? 0.8 : 0) - (has(a, 'perfectionist') ? 0.5 : 0) + (cash(w, a) < 20 ? 0.2 : 0) - vclose,
                run: (w2, a2) => { const I2 = caughtInfo(w2, a2, c); if (!I2 || I2.bribe < 3) return null; const n = doBribe(w2, a2, c, I2); if (!n) return null; st(w2, 'bribe'); return { k: '收了 {n} 銀幣', p: { n } }; } });
            return cal(out, out.length > 3 ? [0.84, 0.08, 0.04, 0.04] : [0.86, 0.09, 0.05]);
        },
    }));
    const C = (w) => (typeof CIVIC !== 'undefined' ? CIVIC.S(w) : (w.civic || { jail: {} }));
    function doJail(w, g, c, I) {
        const Cv = C(w); const th = I.th, vic = I.vic; const d = day(w);
        if (c.src === 'theft' && typeof CIVIC !== 'undefined') { CIVIC.jailDo(w, Cv, th, vic, c.n, c.days, d); mem(w, g, '我抓到{a}偷錢，照規矩把他關了起來。', { a: th.name }, 5); return; }
        (Cv.jail || (Cv.jail = {}))[th.agentId] = d + c.days;
        if (c.src === 'loot') { const back = Math.min(c.n, cash(w, th)); if (back > 0) WALLET.pay(w, th, vic, back); bump(vic, th, -25); try { DARK.bump(w, th, 'exposed'); } catch (e) {} log(w, 'event', '🛒 {c}的混亂中，{a}衝進{s}的店裡搶錢，當場被衛兵抓住，關進牢裡。{say}', { c: c.cause || '', a: th.name, s: vic.name, say: '' }, th.name); mem(w, th, '{c}那時候我昏了頭，去搶了{s}的店，被抓了。', { c: c.cause || '', s: vic.name }, 8); }
        else log(w, 'event', '🛒 {c}的混亂中，{a}衝進公有糧倉扛走糧食，被衛兵當場抓住。{say}', { c: c.cause || '', a: th.name, say: '' }, th.name);
    }
    function doRepay(w, g, c, I) {
        const th = I.th, vic = I.vic;
        if (c.src === 'grain') { try { w.stockpile?.add?.('food', c.n, w.tickCount, t('糧食追回來了')); } catch (e) {} log(w, 'event', '👮 {g}抓到{a}從糧倉扛走糧食，叫他扛回去，沒有關他。', { g: g.name, a: th.name }, g.name); }
        else { const back = Math.min(c.n, cash(w, th)); if (back > 0) WALLET.pay(w, th, vic, back); bump(vic, th, -15); mem(w, vic, '{a}偷了我的錢，衛兵{g}叫他還給我了。', { a: th.name, g: g.name }, 6);
            log(w, 'event', '👮 {g}抓到{a}偷了{v}的 {n} 銀幣，叫他當場還回去，沒有關他。', { g: g.name, a: th.name, v: vic.name, n: c.n }, g.name); }
        bump(th, g, 4); mem(w, th, '我被{g}抓到，他只叫我把東西還回去，沒有關我。', { g: g.name }, 7); try { DARK.bump(w, th, 'exposed'); } catch (e) {}
    }
    function doSpare(w, g, c, I) {
        const th = I.th, vic = I.vic;
        if (vic && c.src === 'theft' && typeof CIVIC !== 'undefined') CIVIC.unseen(w, th, vic, c.n);
        else if (vic) { mem(w, vic, '{c}那幾天，店裡的錢櫃被搶了 {n} 銀幣。', { c: c.cause || '', n: c.n }, 8); try { DARK.secret(w, { kind: 'scheme', culprit: th.agentId, victim: vic.agentId, k: '{a}趁{c}搶了{s}店裡的 {n} 銀幣', p: { a: th.name, c: c.cause || '', s: vic.name, n: c.n } }); } catch (e) {} }
        bump(th, g, 8); mem(w, th, '我被{g}抓到，他放了我一馬。', { g: g.name }, 7); mem(w, g, '我抓到{a}，看他可憐，放他走了。', { a: th.name }, 6);
    }
    function doBribe(w, g, c, I) {
        const th = I.th, vic = I.vic; const n = I.bribe; if (!WALLET.pay(w, th, g, n)) return 0;
        if (vic && c.src === 'theft' && typeof CIVIC !== 'undefined') CIVIC.unseen(w, th, vic, c.n);
        try { DARK.secret(w, { kind: 'scheme', culprit: g.agentId, victim: vic ? vic.agentId : null, k: vic ? '{g}收了{a} {n} 銀幣，放走了搶{v}的他' : '{g}收了{a} {n} 銀幣，放走了搶糧倉的他', p: { g: g.name, a: th.name, v: vic?.name || '', n } }); } catch (e) {}
        mem(w, th, '我被{g}抓到，塞了 {n} 銀幣給他才放我走。', { g: g.name, n }, 7); mem(w, g, '我收了{a} {n} 銀幣，放他走了。', { a: th.name, n }, 6); return n;
    }

    // 襲擊來了：首長（沒有首長就資歷最深的守衛）決定怎麼應對
    const AZH = ['盜匪', '狼群', '掠奪者', '野豬'];
    const leaderNow = (w) => { let m = null; try { m = w.election?.currentMayor?.(w) || null; } catch (e) {} if (m && live(w, m.agentId) && !jailed(w, m)) return { a: m, role: '鎮上的首長' }; const g = npcs(w).filter(x => x.job?.key === 'guard' && live(w, x.agentId) && !jailed(w, x)).sort((x, y) => (y.age ?? 30) - (x.age ?? 30))[0]; return g ? { a: g, role: '資歷最深的守衛' } : null; };
    function raid(w, ES, ri) { if (ri < 0 || typeof RAID_POOL === 'undefined') return false; const L = leaderNow(w); if (!L) return false; ask(w, L.a, 'raidCall', { ri, d: day(w), role: L.role }); return true; }
    function raidInfo(w, a, c) {
        if (!c || typeof RAID_POOL === 'undefined' || !RAID_POOL[c.ri] || day(w) - (c.d ?? 0) > 1 || !w.events?._raidOutcome) return null; const L = leaderNow(w); if (!L || L.a !== a) return null; if ((S(w).raid || {})[c.d + ':' + c.ri] ) return null;
        const rd = RAID_POOL[c.ri]; const R = w.events.raidStrength(w, rd); const cost = w.events.raidTribute(w, rd); const tr = Math.floor(w.stockpile?.get?.('silver') || 0);
        const kids = npcs(w).filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(a.name)).length;
        return { rd, g: R.guards.length, b: Math.round(R.buildingDefense), est: R.guards.length * 2 + 2 + Math.round(R.buildingDefense), wallEst: Math.round(R.guards.length * 1.6 + 2 + R.buildingDefense * 1.5), thr: R.threat, cost, tr, kids, role: L.role };
    }
    DECIDE.kind('raidCall', Object.assign({}, base, {
        title: '襲擊來了，怎麼應對', pri: 2.5, aiKind: 1,
        facts(w, a, c) { const I = raidInfo(w, a, c); if (!I) return '';
            return fill('{atk}正往鎮上來。你是{role}，大家等你拿主意。鎮上有 {g} 個守衛，城牆和工事加起來 {b} 點；照經驗，出去打大概有 {e} 點，守在牆內大概有 {wv} 點，對方看起來有 {t} 點，差不多的時候就看運氣。{judge}{money}打輸了會被搶走糧食和銀幣，有人會嚇得逃走；躲起來不會有人逃走，但會被搶得更多。{kids}', { atk: AZH[c.ri] || '敵人', role: I.role, g: I.g, b: I.b, e: I.est, wv: I.wallEst, t: I.thr,
                // v11.8.0 照數字算出來的強弱（只講強弱，不建議怎麼做）：我們較強的那一種打法比對方多三成以上、少三成以上、或在中間
                judge: Math.max(I.est, I.wallEst) >= I.thr * 1.3 ? '照這些數字，我們明顯比對方強。' : Math.max(I.est, I.wallEst) * 1.3 <= I.thr ? '照這些數字，對方明顯比我們強。' : '照這些數字，兩邊差不多。',
                money: I.tr >= I.cost ? { k: '公庫有 {s} 銀幣，花 {cost} 銀幣可以打發他們走。', p: { s: I.tr, cost: I.cost } } : { k: '公庫只有 {s} 銀幣，不夠付 {cost} 銀幣打發他們走。', p: { s: I.tr, cost: I.cost } }, kids: I.kids ? { k: '你家裡有 {n} 個小孩。', p: { n: I.kids } } : { raw: '' } }); },
        options(w, a, c) { const I = raidInfo(w, a, c); if (!I) return []; const atk = AZH[c.ri] || '敵人'; const m = I.est - I.thr;
            const go = (mode) => (w2, a2) => { const I2 = raidInfo(w2, a2, c); if (!I2) return null; (S(w2).raid || (S(w2).raid = {}))[c.d + ':' + c.ri] = mode; for (const k of Object.keys(S(w2).raid)) if (day(w2) - parseInt(k, 10) > 3) delete S(w2).raid[k];
                const r = w2.events._raidOutcome(w2, I2.rd, mode, a2); st(w2, 'raid_' + (r?.mode || mode)); if (r?.held) st(w2, 'raidHeld');
                return r?.paid ? { k: '花了 {n} 銀幣打發{x}', p: { n: r.paid, x: atk } } : r?.held ? { k: '擋下了{x}', p: { x: atk } } : { k: '{x}在鎮上搶了一輪', p: { x: atk } }; };
            const brave = (has(a, 'brave') ? 0.3 : 0) + (a.job?.key === 'guard' ? 0.2 : 0) + (has(a, 'ambitious') ? 0.1 : 0); const scared = (has(a, 'neurotic') ? 0.3 : 0) + (has(a, 'pessimist') ? 0.2 : 0) + (I.kids ? 0.15 : 0);
            const out = [
                { id: 'fight', quiet: true, text: '叫守衛出去打', say: { k: '叫守衛出去迎戰{x}', p: { x: atk } }, why: '守衛就是為了這個時候養的。', lean: { face: 0.1 }, adj: brave - scared, run: go('fight') },
                { id: 'wall', quiet: true, text: '大家退到牆內守著', say: { k: '叫大家退到牆內守著', p: { x: atk } }, why: '守著就好，別出去送命。', lean: { safe: 0.1 }, adj: (I.wallEst > I.est ? 0.3 : -0.2) + (has(a, 'stoic') ? 0.2 : 0) + scared * 0.5, run: go('wall') },
            ];
            if (I.tr >= I.cost) out.push({ id: 'pay', quiet: true, text: { k: '從公庫拿 {n} 銀幣打發他們', p: { n: I.cost } }, say: { k: '從公庫拿錢打發{x}', p: { x: atk } }, why: '花錢消災，總比被搶光好。', lean: { safe: 0.1 }, adj: (hasV(a, '和平') ? 0.3 : 0) + scared * 0.5 - (has(a, 'thrifty') ? 0.4 : 0) - (has(a, 'greedy') ? 0.3 : 0) - (hasV(a, '權力') ? 0.2 : 0) + clampN((I.tr - I.cost * 4) / 800, -0.3, 0), run: go('pay') }); // 公庫很緊才少付；公庫寬裕不會因此比較想花錢
            out.push({ id: 'hide', quiet: true, text: '帶大家躲起來，東西讓他們拿', say: { k: '帶大家躲起來避開{x}', p: { x: atk } }, why: '東西沒了可以再賺，人沒了就沒了。', lean: { safe: 0.1, face: -0.1 }, adj: scared + (has(a, 'kind') ? 0.2 : 0) - brave, run: go('hide') });
            const P = m >= 1 ? { fight: 0.85, wall: 0.1, pay: 0.03, hide: 0.02 } : m >= -2 ? { fight: 0.6, wall: 0.25, pay: 0.1, hide: 0.05 } : { fight: 0.3, wall: 0.3, pay: 0.25, hide: 0.15 };
            return cal(out, out.map(o => P[o.id]));
        },
    }));

    // ================= 每天 =================
    if (typeof ProposalSystem !== 'undefined') {
        const PS = ProposalSystem.prototype; const _daily = PS.daily;
        PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && on(w)) { verDaily(w); const O = S(w); for (const k of Object.keys(O.cool)) if (O.cool[k] <= day(w)) delete O.cool[k]; for (const [ty, pe] of Object.entries(O.pend)) if (day(w) - pe.d >= 3) settle(w, ty); } } catch (e) { console.warn('[Order] daily', e); } return r; };
    }
    if (typeof World !== 'undefined') {
        const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.order = null; return r; };
        const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.order) d.order = this.order; return d; };
        const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.order = (data?.order && typeof data.order === 'object') ? data.order : null; } catch (e) {} return r; };
    }
    DECIDE.order = true; // 其他系統看到這個，就知道小團體、報社、治安裡的這些事交給本人決定
    return { on, S, found, leaveCheck, rival, row, scoop, smearAsk, fixAsk, banAsk, underAsk, buyAsk, caught, raid, verDaily, tiltN, tie, FZH, leaderOf, settle };
})();
if (typeof globalThis !== 'undefined') globalThis.ORDER = ORDER;
