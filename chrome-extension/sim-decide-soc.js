// RimTown - sim-decide-soc.js：v9.20.0 決策核心階段 2（人際）
// 以前：欠的錢還不還、要不要道歉、原不原諒、要不要報復、要不要在背後講壞話、冷戰誰先開口，都是各系統擲骰決定的
//       （例如「每天 15% 機率去道歉」「老實度不到 2.5 的人有六成會賴帳」）。
// 現在：這些事由本人決定。各系統只說「他現在遇到什麼事、做得到哪幾件事」和「做了之後怎麼結算」：
//   借的錢到期了(owe)      還／先還一部分／拜託寬限／拖著不還
//   對不起某人(sorry)      先不提／去道歉／帶賠禮去道歉／不覺得自己有錯
//   有人來道歉(forgive)    原諒／還沒辦法原諒／以後不必再來往          ← 別人道歉時才會遇到
//   心裡有口氣(grudge)     先忍著／放下／當面說清楚／到處提醒大家小心他／偷偷動他的東西
//   看某人不順眼(vent)     放在心裡／跟朋友抱怨／加油添醋／直接去找他把話說開
//   跟某人冷戰中(makeup)   等他先開口／先開口／乾脆不再往來
//   他先開口了(reached)    點頭和好／裝作沒看到                        ← 對方先開口時才會遇到
// 結算全部在原本的系統裡（sim-dark.js、sim-ways.js、錢包），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數（個性、交情、事情大小），不是固定機率。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined' || typeof DARK === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const ok = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const mal = (a) => Math.max(0, DARK.malice(a));
    const WAYS_ = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const proud = (a) => has(a, 'abrasive') || has(a, 'charismatic') || has(a, 'greedy') || has(a, 'jealous');
    const ago = (n) => (n <= 0 ? t('今天') : fill('{n} 天前', { n }));
    DECIDE.soc = true; // 其他系統看到這個，就知道人際的事交給本人決定、不擲骰

    // ---------- 借的錢到期了 ----------
    const debtOf = (w, a, ctx) => (w.dark?.debts || []).find(x => !x.done && x.cash && x.r === a.agentId && x.l === ctx.l && x.day === ctx.day) || null;
    DECIDE.kind('owe', {
        title: '借的錢到期了', cool: 1, pri: 3,
        when(w, a) {
            const D = w.dark; if (!Array.isArray(D?.debts)) return null; const d0 = DARK.today(w);
            const d = D.debts.find(x => !x.done && x.cash && x.r === a.agentId && d0 >= x.due && ok(w, w.agents[x.l])); return d ? { l: d.l, day: d.day } : null;
        },
        facts(w, a, ctx) {
            const d = debtOf(w, a, ctx), l = w.agents[ctx.l]; if (!d || !l) return ''; const over = DARK.today(w) - d.due;
            return fill('你跟{l}借的 {n} 銀幣{when}。你身上有 {c} 銀幣。{tries}', { l: l.name, n: d.n, c: Math.floor(cash(w, a)), when: over > 0 ? { k: '已經過期 {n} 天', p: { n: over } } : '今天到期', tries: d.tries ? { k: '你已經拜託他寬限過 {n} 次。', p: { n: d.tries } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const d = debtOf(w, a, ctx), l = w.agents[ctx.l]; if (!d || !l) return []; const c = cash(w, a), h = DARK.honesty(a), close = clampN(aff(a, l) / 50, -1, 1); const out = [];
            if (c >= d.n) out.push({ id: 'repay', text: { k: '把 {n} 銀幣還給{l}', p: { n: d.n, l: l.name } }, say: { k: '把錢還給{l}', p: { l: l.name } }, why: '借了就要還', base: 1.5 + h * 0.3 + close * 0.4, lean: { bond: 0.4, face: 0.3 },
                run: (w, a) => (DARK.debtRepay(w, d) ? { k: '還清了' } : { k: '錢不夠，沒還成' }) });
            else { const m = Math.min(d.n - 1, Math.floor(c * 0.6)); if (m >= 3) out.push({ id: 'part', text: { k: '先還 {m} 銀幣，剩下的請{l}再等幾天', p: { m, l: l.name } }, say: { k: '先還{l}一部分', p: { l: l.name } }, why: '有多少先還多少', base: 1.2 + h * 0.3 + close * 0.3, lean: { bond: 0.4, safe: -0.2 },
                run: (w, a) => { const got = DARK.debtPart(w, d, m); return got ? { k: '先還了 {m} 銀幣', p: { m: got } } : { k: '錢不夠，沒還成' }; } }); }
            if ((d.tries || 0) < 2) out.push({ id: 'extend', text: { k: '拜託{l}再寬限幾天', p: { l: l.name } }, say: { k: '拜託{l}再寬限幾天', p: { l: l.name } }, why: c >= d.n ? '手上的錢還有別的用處' : '現在真的湊不出來', base: (c >= d.n ? 0.3 : 1.5) + close * 0.2, lean: { safe: 0.4 },
                run: (w, a) => { DARK.debtExtend(w, d); return { k: '多了五天' }; } });
            out.push({ id: 'dodge', text: c >= d.n ? { k: '有錢也先不還，拖著{l}', p: { l: l.name } } : { k: '還不出來，躲著{l}', p: { l: l.name } }, say: { k: '拖著不還{l}的錢', p: { l: l.name } }, why: c >= d.n ? '錢在自己手上比較實在' : '沒有就是沒有', base: (c >= d.n ? 2.3 : 1.9) - h * 0.6 - close * 0.5, lean: { gain: 0.5, bond: -0.5 },
                run: (w, a) => { DARK.debtDodge(w, d); return { k: '{l}很不高興', p: { l: l.name } }; } });
            return out;
        },
    });

    // ---------- 對不起某人 ----------
    const myWrong = (w, a) => { const D = w.dark; if (!D?.wrongs) return null; const d0 = DARK.today(w);
        return D.wrongs.find(x => !x.done && x.by === a.agentId && d0 - x.day >= 2 && d0 - (x.last || 0) >= 3 && d0 - x.day <= 20 && ok(w, w.agents[x.to])) || null; };
    DECIDE.kind('sorry', {
        title: '對不起某人', cool: 3, pri: 2,
        when(w, a) { const x = myWrong(w, a); return x ? { id: DARK.wrongId(w, x) } : null; },
        facts(w, a, ctx) {
            const x = DARK.wrongById(w, ctx.id); const b = x && w.agents[x.to]; if (!b) return '';
            return fill('{when}：{line}。{state}', { when: { raw: ago(DARK.today(w) - x.day) }, line: { raw: DARK.wrongLine(x, t('你'), t(b.name)) }, state: x.tries ? { k: '你道過歉，{b}還沒原諒。', p: { b: b.name } } : { k: '你還沒跟{b}道歉。', p: { b: b.name } } });
        },
        options(w, a, ctx) {
            const x = DARK.wrongById(w, ctx.id); const b = x && w.agents[x.to]; if (!x || x.done || !b) return []; const h = DARK.honesty(a), m = mal(a), c = cash(w, a), close = clampN(aff(a, b) / 50, -1, 1);
            const sayBase = 1.2 + (has(a, 'kind') ? 1.0 : 0) + (h - 2) * 0.25 - (has(a, 'abrasive') ? 0.5 : 0) - m * 0.15 + x.w * 0.1 + close * 0.3;
            const out = [
                { id: 'skip', quiet: true, mute: true, text: '先不提這件事', why: '還開不了口', base: 1.5, lean: { face: 0.3 }, run: () => null },
                { id: 'say', text: { k: '去跟{b}道歉', p: { b: b.name } }, say: { k: '去跟{b}道歉', p: { b: b.name } }, why: '是我不對，該說清楚', base: sayBase, lean: { bond: 0.6 },
                    run: (w, a) => (DARK.apologize(w, x, 0) ? { k: '話說出口了' } : null) },
            ];
            const n = clampN(Math.round(4 + x.w * 4), 5, Math.floor(c * 0.3));
            if (c >= 12 && n >= 5) out.push({ id: 'gift', text: { k: '帶 {n} 銀幣的賠禮去跟{b}道歉', p: { n, b: b.name } }, say: { k: '帶著賠禮去跟{b}道歉', p: { b: b.name } }, why: '光用嘴說不夠誠意', base: sayBase - 0.5 + (has(a, 'generous') ? 0.5 : 0) + x.w * 0.15, lean: { bond: 0.6, gain: -0.4 },
                run: (w, a) => { const r = DARK.apologize(w, x, n); return r ? (r.gift ? { k: '送了 {n} 銀幣的賠禮', p: { n: r.gift } } : { k: '話說出口了' }) : null; } });
            out.push({ id: 'deny', text: '不覺得自己有錯，不道歉', say: { k: '不跟{b}道歉', p: { b: b.name } }, why: '我沒有錯', base: -0.4 + (has(a, 'abrasive') ? 0.9 : 0) + m * 0.25 - (has(a, 'kind') ? 1 : 0) - close * 0.4, lean: { face: 0.5, bond: -0.5 },
                run: (w, a) => { DARK.deny(w, x); return { k: '這件事就這樣了' }; } });
            return out;
        },
    });

    // ---------- 有人來道歉（別人道歉時才會遇到） ----------
    DECIDE.kind('forgive', {
        title: '有人來道歉', scan: false, pri: 3,
        when: () => null,
        facts(w, b, ctx) {
            const x = DARK.wrongById(w, ctx.id); const a = w.agents[ctx.by]; if (!x || !a) return '';
            return fill('{a}來跟你道歉（{when}：{line}）。這是他第 {k} 次道歉{gift}。', { a: a.name, when: { raw: ago(DARK.today(w) - x.day) }, line: { raw: DARK.wrongLine(x, t(a.name), t('你')) }, k: x.tries || 1, gift: ctx.gift ? { k: '，還帶了 {n} 銀幣的賠禮', p: { n: ctx.gift } } : { raw: '' } });
        },
        options(w, b, ctx) {
            const x = DARK.wrongById(w, ctx.id); const a = w.agents[ctx.by]; if (!x || x.forgiven || x.never || !a) return []; const close = clampN(aff(b, a) / 50, -1, 1), m = mal(b);
            const soft = (has(b, 'kind') ? 1.0 : 0) + (has(b, 'optimist') ? 0.6 : 0) + (has(b, 'stoic') ? 0.2 : 0) - ((has(b, 'jealous') || has(b, 'abrasive')) ? 0.8 : 0) - (has(b, 'neurotic') ? 0.4 : 0);
            return [
                { id: 'yes', text: { k: '原諒{a}', p: { a: a.name } }, say: { k: '原諒{a}', p: { a: a.name } }, why: '他是真心的，算了', base: 2.0 + soft - x.w * 0.3 + ((x.tries || 1) - 1) * 0.4 + (ctx.gift ? 0.5 : 0) + close * 0.5, lean: { bond: 0.4 },
                    run: (w) => { DARK.answer(w, x, 'yes'); return { k: '和好了' }; } },
                { id: 'no', text: '現在還沒辦法原諒', say: { k: '先不原諒{a}', p: { a: a.name } }, why: '心裡那關還過不去', base: 1.4 + x.w * 0.15, lean: { face: 0.3 },
                    run: (w) => { DARK.answer(w, x, 'no'); return { k: '還沒辦法原諒' }; } },
                { id: 'never', text: { k: '告訴{a}以後不必再來往', p: { a: a.name } }, say: { k: '跟{a}斷了往來', p: { a: a.name } }, why: '這種人不值得', base: -0.8 + x.w * 0.35 + m * 0.3 - close * 0.6, lean: { face: 0.3, bond: -0.5 },
                    run: (w) => { DARK.answer(w, x, 'never'); return { k: '從此不往來' }; } },
            ];
        },
    });

    // ---------- 心裡有口氣（別人對不起自己，還沒了結） ----------
    const myHurt = (w, a) => { const D = w.dark; if (!D?.wrongs) return null; const d0 = DARK.today(w);
        return D.wrongs.find(x => x.to === a.agentId && !x.forgiven && !x.revenged && !x.let && d0 - x.day >= 2 && d0 - x.day <= 30 && ok(w, w.agents[x.by])) || null; };
    DECIDE.kind('grudge', {
        title: '心裡有口氣', cool: 4, pri: 1,
        when(w, a) { const x = myHurt(w, a); return x ? { id: DARK.wrongId(w, x) } : null; },
        facts(w, a, ctx) {
            const x = DARK.wrongById(w, ctx.id); const c = x && w.agents[x.by]; if (!c) return '';
            return fill('{when}：{line}。{state}', { when: { raw: ago(DARK.today(w) - x.day) }, line: { raw: DARK.wrongLine(x, t(c.name), t('你')) }, state: x.denied ? '他不覺得自己有錯。' : x.never ? '他來道過歉，你說以後不必再來往。' : x.tries ? '他來道過歉，你還沒原諒。' : '他到現在都沒有道歉。' });
        },
        options(w, a, ctx) {
            const x = DARK.wrongById(w, ctx.id); const c = x && w.agents[x.by]; if (!x || x.forgiven || x.revenged || x.let || !c) return []; const m = mal(a), h = DARK.honesty(a), hot = has(a, 'abrasive') || has(a, 'jealous');
            const out = [
                { id: 'wait', quiet: true, mute: true, text: '先忍著，再看看', why: '現在不想把事情鬧大', base: 1.5, lean: { safe: 0.3 }, run: () => null },
                { id: 'letgo', text: '算了，把這件事放下', say: { k: '放下跟{c}的那件事', p: { c: c.name } }, why: '一直記著只會讓自己難受', base: 0.2 + (has(a, 'kind') ? 0.9 : 0) + (has(a, 'stoic') ? 0.4 : 0) + (has(a, 'optimist') ? 0.3 : 0) - x.w * 0.2 - m * 0.2, lean: { safe: 0.2, bond: 0.3 },
                    run: (w) => { DARK.letGo(w, x); return { k: '心裡放下了' }; } },
            ];
            if (!x.faced && !x.never) out.push({ id: 'face', text: { k: '當面找{c}說清楚', p: { c: c.name } }, say: { k: '當面找{c}說清楚', p: { c: c.name } }, why: '有話就要當面講', base: -0.2 + (has(a, 'charismatic') ? 0.3 : 0) + (hot ? 0.4 : 0) - (has(a, 'shy') ? 0.7 : 0) + x.w * 0.1, lean: { face: 0.4 },
                run: (w) => { const r = DARK.faceUp(w, x); return r === 'sorry' ? { k: '{c}當場道了歉', p: { c: c.name } } : r === 'fight' ? { k: '兩人吵了起來' } : null; } });
            out.push({ id: 'warn', text: { k: '到處提醒大家小心{c}', p: { c: c.name } }, say: { k: '到處提醒大家小心{c}', p: { c: c.name } }, why: '不能讓他好過', base: -0.4 + m * 0.5 + (hot ? 0.5 : 0) + x.w * 0.25 - (has(a, 'kind') ? 1.2 : 0), lean: { face: 0.4, bond: -0.3 },
                run: (w, a) => { DARK.avenge(w, x, a, c, 'warn'); return { k: '報了一箭之仇' }; } });
            out.push({ id: 'sabotage', text: { k: '偷偷動{c}的東西', p: { c: c.name } }, say: { k: '偷偷動了{c}的東西', p: { c: c.name } }, why: '讓他也嚐嚐滋味', base: -1.0 + m * 0.55 + (hot ? 0.3 : 0) + x.w * 0.3 - (h - 2) * 0.3 - (has(a, 'kind') ? 1.2 : 0), lean: { face: 0.3, bond: -0.5 },
                run: (w, a) => { DARK.avenge(w, x, a, c, 'sabotage'); return { k: '報了一箭之仇' }; } });
            return out;
        },
    });

    // ---------- 看某人不順眼（要不要在背後講） ----------
    DECIDE.kind('vent', {
        title: '看某人不順眼', cool: 4, pri: 0.5,
        when(w, a) {
            const D = w.dark; if (!D || D.spoke?.[a.agentId] === DARK.today(w)) return null;
            const f = DARK.foeOf(w, a, null); if (!f || !ok(w, f.b)) return null;
            let best = null; for (const r of Object.values(a.relationships?.relationships || {})) { const o = w.agents[r.targetId]; if (!o || o === f.b || (r.affinity || 0) < 5 || !ok(w, o) || (o.age ?? 30) < 16) continue; if (!best || r.affinity > best[1]) best = [o, r.affinity]; }
            return best ? { foe: f.b.agentId, l: best[0].agentId, why: f.g.why, s: Math.round(f.g.s) } : null;
        },
        facts(w, a, ctx) {
            const foe = w.agents[ctx.foe], l = w.agents[ctx.l]; if (!foe || !l) return '';
            return fill('你{why}，心裡一直不舒服。今天遇到{l}，可以聊聊。', { why: { raw: fill(DARK.WHY[ctx.why] || DARK.WHY.dislike, { v: foe.name }) }, l: l.name });
        },
        options(w, a, ctx) {
            const foe = w.agents[ctx.foe], l = w.agents[ctx.l]; if (!foe || !l || !ok(w, foe) || !ok(w, l)) return []; const m = mal(a), h = DARK.honesty(a), kind = has(a, 'kind'), deep = ctx.s > 70 ? 1 : 0;
            return [
                { id: 'hold', quiet: true, mute: true, text: '放在心裡，不說', why: '背後說人不好', base: 1.6, lean: { safe: 0.2 }, run: () => null },
                { id: 'true', text: { k: '跟{l}抱怨{c}（只說真的）', p: { l: l.name, c: foe.name } }, say: { k: '跟{l}抱怨{c}', p: { l: l.name, c: foe.name } }, why: '不說出來憋得難受', base: 1.0 + m * 0.3 + deep * 0.4 - (kind ? 0.9 : 0), lean: { face: 0.2, bond: -0.2 },
                    run: (w, a) => { DARK.speak(w, a, l, foe, ctx.why, false); return { k: '說完心裡舒服了些' }; } },
                { id: 'lie', text: { k: '跟{l}說{c}的壞話，加油添醋', p: { l: l.name, c: foe.name } }, say: { k: '跟{l}說{c}的壞話', p: { l: l.name, c: foe.name } }, why: '讓大家知道他是什麼人', base: -0.7 + m * 0.35 + (2 - h) * 0.4 + deep * 0.3 - (kind ? 1.2 : 0), lean: { bond: -0.4, face: 0.2 },
                    run: (w, a) => { DARK.speak(w, a, l, foe, ctx.why, true); return { k: '話傳出去了' }; } },
                { id: 'direct', text: { k: '直接去找{c}把話說開', p: { c: foe.name } }, say: { k: '去找{c}把話說開', p: { c: foe.name } }, why: '與其背後說，不如當面講', base: -1.2 + (kind ? 0.7 : 0) + (has(a, 'charismatic') ? 0.4 : 0) - (has(a, 'shy') ? 0.7 : 0) - (has(a, 'abrasive') ? 0.4 : 0), lean: { bond: 0.4 },
                    run: (w, a) => (DARK.talkOut(w, a, foe) ? { k: '心結解開了一些' } : { k: '又吵了一架' }) },
            ];
        },
    });

    // ---------- 跟某人冷戰中 ----------
    DECIDE.kind('makeup', {
        title: '跟某人冷戰中', cool: 4, pri: 1,
        when(w, a) { const Y = WAYS_(); if (!Y || !w.ways) return null; const x = Y.coldList(w, a).find(o => o.days >= 2 && ok(w, o.b) && o.c.by !== a.agentId); return x ? { b: x.b.agentId } : null; },
        facts(w, a, ctx) { const Y = WAYS_(); const b = w.agents[ctx.b]; const x = Y && b ? Y.coldList(w, a).find(o => o.b === b) : null; if (!x) return '';
            return fill('你跟{b}吵架後冷戰第 {n} 天了，在路上遇到都繞路走。{snub}', { b: b.name, n: x.days, snub: x.c.snub ? '上次有人先開口，被當作沒看到。' : { raw: '' } }); },
        options(w, a, ctx) {
            const Y = WAYS_(); const b = w.agents[ctx.b]; if (!Y || !b || !Y.coldWith(w, a, b)) return []; const close = clampN(aff(a, b) / 40, -1.5, 1.5), pr = proud(a) ? 1 : 0;
            return [
                { id: 'wait', quiet: true, mute: true, text: '等他先開口', why: '憑什麼要我先低頭', base: 1.5 + pr * 0.3, lean: { face: 0.3 }, run: () => null },
                { id: 'reach', text: { k: '先開口跟{b}打招呼', p: { b: b.name } }, say: { k: '先開口跟{b}說話', p: { b: b.name } }, why: '再僵下去沒意思', base: 0.9 + (has(a, 'kind') ? 0.8 : 0) + close * 0.6 - pr * 0.4, lean: { bond: 0.6, face: -0.3 },
                    run: (w, a) => (Y.reach(w, a, b) ? { k: '先開了口' } : null) },
                { id: 'cut', text: { k: '乾脆不再跟{b}往來', p: { b: b.name } }, say: { k: '不再跟{b}往來', p: { b: b.name } }, why: '這段交情到此為止', base: -1.4 - close * 0.7 + (has(a, 'abrasive') ? 0.4 : 0), lean: { face: 0.3, bond: -0.5 },
                    run: (w, a) => (Y.apart(w, a, b) ? { k: '從此不往來' } : null) },
            ];
        },
    });
    DECIDE.kind('reached', {
        title: '他先開口了', scan: false, pri: 3,
        when: () => null,
        facts(w, b, ctx) { const a = w.agents[ctx.a]; return a ? fill('你跟{a}冷戰了好幾天，今天他先開口跟你打招呼。', { a: a.name }) : ''; },
        options(w, b, ctx) {
            const Y = WAYS_(); const a = w.agents[ctx.a]; if (!Y || !a || !Y.coldWith(w, a, b)) return []; const close = clampN(aff(b, a) / 40, -1.5, 1.5), pr = proud(b) ? 1 : 0;
            return [
                { id: 'accept', text: '點頭回應，和好', say: { k: '跟{a}和好', p: { a: a.name } }, why: '他都先開口了', base: 1.6 + (has(b, 'kind') ? 0.6 : 0) + close * 0.5 - pr * 0.3, lean: { bond: 0.5 },
                    run: (w) => (Y.thaw(w, a, b) ? { k: '和好了' } : null) },
                { id: 'snub', text: '裝作沒看到', say: { k: '還不想理{a}', p: { a: a.name } }, why: '氣還沒消', base: 0.7 + pr * 0.4 - close * 0.5, lean: { face: 0.4, bond: -0.3 },
                    run: (w) => (Y.snub(w, a, b) ? { k: '沒有理他' } : null) },
            ];
        },
    });
})();
