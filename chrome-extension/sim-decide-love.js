// RimTown - sim-decide-love.js：v9.28.0 決策核心批次 F（感情與衝突）
// 以前：互相有意思的兩個單身村民每天 20% 機率在一起；交往夠久、感情夠好的每天 10% 機率決定結婚；
//       感情不好或多情、神經質的人對彼此有意思的第三人每天 6% 機率偷偷在一起；感情淡了的情侶每天 10% 機率分手；
//       婚姻很糟的夫妻每天 5% 機率離婚；互相仇視的兩人每天 15% 機率當街對嗆；每天 25% 機率隨便挑一個心情好的人去鄰鎮作客。
// 現在：這些事由本人決定。會被問到的還是同一批人（simulation.js 的 xxxCands 說「他現在做得到哪幾件事」），做不做是他自己選：
//   心動的人(confess)           先不說／向某人告白
//   有人向你告白(wooed)          婉拒／答應交往                      ← 由告白那一刻引發
//   要不要求婚(propose)          再等等／求婚
//   對方向你求婚(proposed)       說還沒準備好／答應                   ← 由求婚那一刻引發
//   對別人動了心(affair)          守住現在的感情／背著另一半跟某人在一起
//   感情淡了(breakup)            再試試看／分手
//   婚姻走不下去(divorce)         為了這個家再撐一下／離婚
//   碰上死對頭(feud)             忍一忍，繞路走／當面跟他吵個明白      ← 兩邊都要好的人仍可能出面打圓場
//   要不要去鄰鎮作客(visit)       這次不去／去作客                     ← 每天 25% 機率問一個心情好的人；不去的話再問一個
// 被告白、被求婚的人可以拒絕（以前一定答應）；被拒絕的人難過一陣子，二十天（告白）／十五天（求婚）內不會再開口。
// 抓姦（發現另一半劈腿）、絕交（好感跌破 -60）、心動慢慢累積仍然照原本的方式，不是本人選的。
// 結算全部在 simulation.js 原本的程式（startDating、marry、startAffair、breakUp、divorce、publicFeud、sendVisitorTo），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數：用 tilt() 把「以前大概多常發生」換成起跑分數，再加上個性、交情與處境。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const val = (a, v) => (a?.personality?.values || []).includes(v);
    const rel = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId] || null : null);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const on = (w) => { try { return !!DECIDE.love && !!DECIDE.on?.(w); } catch (e) { return false; } };
    const safe = (f) => { try { return f() || null; } catch (e) { return null; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const within = (p, days) => 1 - Math.pow(1 - p, days);
    const REF = 1;
    // 被拒絕的人多久不再開口：用決策核心的冷卻（會跟著存檔）
    const hold = (w, a, kind, days) => { try { const X = DECIDE.S(w); const k = a.agentId + '|' + kind; X.cool[k] = Math.max(X.cool[k] || 0, w._absDay() + days); } catch (e) {} };
    const ask = (w, a, kind, ctx) => { try { DECIDE.enqueue(w, a, kind, ctx); } catch (e) { console.warn('[Love] ask', e); } };
    DECIDE.love = true; // simulation.js 看到這個，就知道告白、求婚、偷情、分手、離婚、對嗆、出訪交給本人決定、不擲骰

    // ================= 心動的人：要不要告白 =================
    const confessOf = (w, a) => (on(w) ? safe(() => w.confessCands?.(a)) : null);
    DECIDE.kind('confess', {
        title: '心動的人', cool: 3, pri: 1.0,
        when(w, a) { const L = confessOf(w, a); return L && L.length ? { b: L[0].b.agentId } : null; },
        facts(w, a) {
            const L = confessOf(w, a); if (!L || !L.length) return '';
            return L.map(x => tf('你對{b}很心動（心動 {r}／100，好感 {f}）。看得出來{b2}對你也有好感。', { b: x.b.name, b2: x.b.name, r: x.ri, f: x.aff })).join('')
                + t('告白的話對方可能答應，也可能婉拒；被婉拒會難過一陣子。');
        },
        options(w, a) {
            const L = confessOf(w, a); if (!L || !L.length) return [];
            const out = [{ id: 'wait', quiet: true, mute: true, text: '先不說，再看看', say: '沒有告白', why: '還沒準備好', base: REF, lean: { safe: 0.1 }, run: () => null }];
            for (const x of L) out.push({ id: 'go:' + x.b.agentId, quiet: true, text: { k: '向{b}告白', p: { b: x.b.name } }, say: { k: '向{b}告白', p: { b: x.b.name } }, why: { k: '不說出口，{b}永遠不會知道', p: { b: x.b.name } },
                // 以前：兩邊門檻都過了以後每天 20%（三天問一次）
                base: REF + tilt(within(0.2, 3)) + (has(a, 'romantic') ? 0.2 : 0) + (has(a, 'charismatic') ? 0.15 : 0) - (has(a, 'shy') ? 0.3 : 0) + clampN((x.ri - 65) / 100, -0.1, 0.25), lean: { joy: 0.3, safe: -0.2 },
                run: (w2, a2) => { const b = w2.agents[x.b.agentId]; if (!b) return { k: '沒有說成' }; ask(w2, b, 'wooed', { by: a2.agentId }); return { k: '向{b}告白了', p: { b: b.name } }; } });
            return out;
        },
    });

    // ================= 有人向你告白（由告白那一刻引發） =================
    const woo = (w, a, c) => {
        if (!on(w) || !c) return null; const by = w.agents[c.by]; if (!by || !w._loveOk?.(by) || !w._loveOk?.(a)) return null;
        if (by.relationships.getPartner() || a.relationships.getPartner()) return null; const r = rel(a, by); const r2 = rel(by, a); if (!r || r.status || (r2 && r2.status)) return null;
        return { by, ri: Math.round(r.romanticInterest || 0), aff: Math.round(r.affinity || 0) };
    };
    DECIDE.kind('wooed', {
        title: '有人向你告白', scan: false, pri: 2,
        when() { return null; },
        facts(w, a, c) { const I = woo(w, a, c); return I ? tf('{b}鼓起勇氣向你告白，問你願不願意跟他在一起。你對{b2}的好感是 {f}，心動 {r}／100。', { b: I.by.name, b2: I.by.name, f: I.aff, r: I.ri }) : ''; },
        options(w, a, c) {
            const I = woo(w, a, c); if (!I) return [];
            return [
                { id: 'no', quiet: true, text: '婉拒他', say: { k: '婉拒了{b}的告白', p: { b: I.by.name } }, why: '我對他沒有那種感覺', base: REF, lean: { safe: 0.1 },
                    run: (w2, a2) => { const b = w2.agents[c.by]; if (b) { w2.turnDown(b, a2); hold(w2, b, 'confess', 20); } return { k: '婉拒了{b}', p: { b: I.by.name } }; } },
                // 以前：門檻過了就一定答應；這裡留一點拒絕的餘地
                { id: 'yes', quiet: true, text: '答應跟他交往', say: { k: '答應跟{b}交往', p: { b: I.by.name } }, why: '我也喜歡他很久了',
                    base: REF + tilt(0.9) + clampN((I.ri - 50) / 100, -0.2, 0.3) + clampN((I.aff - 40) / 150, -0.1, 0.2), lean: { joy: 0.3, bond: 0.2 },
                    run: (w2, a2) => { const b = w2.agents[c.by]; if (!b || !woo(w2, a2, c)) return { k: '來不及了' }; w2.startDating(b, a2); return { k: '跟{b}在一起了', p: { b: b.name } }; } },
            ];
        },
    });

    // ================= 要不要求婚 =================
    const propOf = (w, a) => (on(w) ? safe(() => w.proposeCands?.(a)?.[0]) : null);
    DECIDE.kind('propose', {
        title: '要不要求婚', cool: 4, pri: 1.1,
        when(w, a) { const I = propOf(w, a); return I ? { b: I.b.agentId } : null; },
        facts(w, a) {
            const I = propOf(w, a); if (!I) return '';
            return tf('你跟{b}已經交往 {d} 天，感情很好（好感 {f}）。求婚的話他可能答應，也可能說還沒準備好。結了婚要辦婚禮、請客。', { b: I.b.name, d: I.days, f: I.aff });
        },
        options(w, a) {
            const I = propOf(w, a); if (!I) return [];
            return [
                { id: 'wait', quiet: true, mute: true, text: '再等等', say: { k: '還沒向{b}求婚', p: { b: I.b.name } }, why: '不急，日子還長', base: REF, lean: { safe: 0.1 }, run: () => null },
                // 以前：一對情侶每天 10%（兩個人都可能開口；照新舊對照，一個人算 4%，四天問一次）
                { id: 'propose', quiet: true, text: { k: '向{b}求婚', p: { b: I.b.name } }, say: { k: '向{b}求婚', p: { b: I.b.name } }, why: '我想跟他過一輩子',
                    base: REF + tilt(within(0.04, 4)) + (has(a, 'romantic') ? 0.2 : 0) + (val(a, '家庭') ? 0.2 : 0) - (val(a, '自由') ? 0.2 : 0), lean: { bond: 0.3, joy: 0.2 },
                    run: (w2, a2) => { const b = w2.agents[I.b.agentId]; if (!b) return { k: '沒有說成' }; ask(w2, b, 'proposed', { by: a2.agentId }); return { k: '向{b}求婚了', p: { b: b.name } }; } },
            ];
        },
    });

    // ================= 對方向你求婚（由求婚那一刻引發） =================
    const pro = (w, a, c) => {
        if (!on(w) || !c) return null; const by = w.agents[c.by]; if (!by || !w._loveOk?.(by) || !w._loveOk?.(a)) return null;
        const r = rel(a, by), r2 = rel(by, a); if (!r || r.status !== 'dating' || !r2 || r2.status !== 'dating') return null;
        return { by, aff: Math.round(r.affinity || 0), ri: Math.round(r.romanticInterest || 0), days: Math.floor((w.tickCount - (r.statusSince || 0)) / 96) };
    };
    DECIDE.kind('proposed', {
        title: '對方向你求婚', scan: false, pri: 2,
        when() { return null; },
        facts(w, a, c) { const I = pro(w, a, c); return I ? tf('交往 {d} 天的{b}向你求婚了。你對{b2}的好感是 {f}，心動 {r}／100。答應的話會訂婚、辦婚禮；說還沒準備好，你們還是在交往，只是他會難過一陣子。', { d: I.days, b: I.by.name, b2: I.by.name, f: I.aff, r: I.ri }) : ''; },
        options(w, a, c) {
            const I = pro(w, a, c); if (!I) return [];
            return [
                { id: 'later', quiet: true, text: '跟他說還沒準備好', say: { k: '跟{b}說還沒準備好結婚', p: { b: I.by.name } }, why: '我還想再多一點時間', base: REF, lean: { safe: 0.1 },
                    run: (w2, a2) => { const b = w2.agents[c.by]; if (b) { w2.notYet(b, a2); hold(w2, b, 'propose', 15); } return { k: '還沒答應{b}', p: { b: I.by.name } }; } },
                // 以前：門檻過了就一定結婚
                { id: 'yes', quiet: true, text: '答應他', say: { k: '答應了{b}的求婚', p: { b: I.by.name } }, why: '就是他了',
                    base: REF + tilt(0.9) + clampN((I.ri - 50) / 100, -0.2, 0.3) + (val(a, '自由') ? -0.2 : 0), lean: { bond: 0.3, joy: 0.2 },
                    run: (w2, a2) => { const b = w2.agents[c.by]; if (!b || !pro(w2, a2, c)) return { k: '來不及了' }; w2.marry(b, a2); return { k: '要跟{b}結婚了', p: { b: b.name } }; } },
            ];
        },
    });

    // ================= 對別人動了心：要不要偷情 =================
    const affOf = (w, a) => (on(w) ? safe(() => w.affairCands?.(a)?.[0]) : null);
    DECIDE.kind('affair', {
        title: '對別人動了心', cool: 7, pri: 0.6,
        when(w, a) { const I = affOf(w, a); return I ? { p: I.p.agentId } : null; },
        facts(w, a) {
            const I = affOf(w, a); if (!I) return '';
            return tf(I.married ? '你已經跟{p}結婚了（你對他的好感 {f}）。' : '你正在跟{p}交往（你對他的好感 {f}）。', { p: I.p.name, f: I.cool })
                + I.list.map(x => tf('你對{t}很心動（心動 {r}／100），他對你也有意思。', { t: x.t.name, r: x.ri })).join('')
                + t('偷偷在一起的事遲早可能被發現；被發現的話會分手或離婚，大家都會知道。');
        },
        options(w, a) {
            const I = affOf(w, a); if (!I) return [];
            const out = [{ id: 'stay', quiet: true, mute: true, text: '守住現在的感情', say: { k: '沒有背著{p}亂來', p: { p: I.p.name } }, why: '不能對不起他',
                base: REF + (has(a, 'kind') ? 0.2 : 0) + (has(a, 'stoic') ? 0.15 : 0), lean: { safe: 0.2, face: 0.2 }, run: () => null }];
            // 以前：一對情侶裡只有一個人會被擲到（而且是對每個第三人分別擲），每天 6%；照新舊對照，一個人算 6%，七天問一次
            for (const x of I.list) out.push({ id: 'go:' + x.t.agentId, quiet: true, text: { k: '背著{p}跟{t}在一起', p: { p: I.p.name, t: x.t.name } }, say: { k: '背著{p}跟{t}在一起', p: { p: I.p.name, t: x.t.name } }, why: '心不由己',
                base: REF + tilt(within(0.06, 7)) + (has(a, 'romantic') ? 0.15 : 0) + (has(a, 'neurotic') ? 0.1 : 0) + clampN(-I.cool / 100, -0.1, 0.3), lean: { joy: 0.3, safe: -0.3, face: -0.2 },
                run: (w2, a2) => { const tt = w2.agents[x.t.agentId], p = w2.agents[I.p.agentId]; if (!tt || !p || !w2.affairCands(a2).length) return { k: '沒有成' }; w2.startAffair(a2, p, tt); return { k: '跟{t}偷偷在一起了', p: { t: tt.name } }; } });
            return out;
        },
    });

    // ================= 感情淡了：要不要分手 =================
    const brkOf = (w, a) => (on(w) ? safe(() => w.breakCands?.(a)?.[0]) : null);
    DECIDE.kind('breakup', {
        title: '感情淡了', cool: 4, pri: 0.9,
        when(w, a) { const I = brkOf(w, a); return I ? { b: I.b.agentId } : null; },
        facts(w, a) { const I = brkOf(w, a); return I ? tf('你跟{b}交往中，但感情已經淡了：你對他的好感 {f}、他對你 {g}，你的心動只剩 {r}／100。分手的話兩個人都會難過一陣子。', { b: I.b.name, f: I.aff, g: I.back, r: I.ri }) : ''; },
        options(w, a) {
            const I = brkOf(w, a); if (!I) return [];
            return [
                { id: 'stay', quiet: true, mute: true, text: '再試試看', say: { k: '還沒跟{b}分手', p: { b: I.b.name } }, why: '也許只是一時', base: REF, lean: { bond: 0.1 }, run: () => null },
                // 以前：一對情侶每天 10%（兩個人都可能開口，所以一個人算 6%，四天問一次）
                { id: 'break', quiet: true, text: { k: '跟{b}分手', p: { b: I.b.name } }, say: { k: '跟{b}分手', p: { b: I.b.name } }, why: '與其互相消磨，不如就到這裡',
                    base: REF + tilt(within(0.06, 4)) + clampN((-10 - Math.min(I.aff, I.back)) / 100, -0.1, 0.3) + (has(a, 'abrasive') ? 0.1 : 0), lean: { joy: 0.1, bond: -0.2 },
                    run: (w2, a2) => { const b = w2.agents[I.b.agentId]; if (!b || !w2.breakCands(a2).length) return { k: '沒有說成' }; w2.breakUp(a2, b); return { k: '跟{b}分手了', p: { b: b.name } }; } },
            ];
        },
    });

    // ================= 婚姻走不下去：要不要離婚 =================
    const divOf = (w, a) => (on(w) ? safe(() => w.divorceCands?.(a)?.[0]) : null);
    DECIDE.kind('divorce', {
        title: '婚姻走不下去', cool: 6, pri: 1.0,
        when(w, a) { const I = divOf(w, a); return I ? { b: I.b.agentId } : null; },
        facts(w, a) {
            const I = divOf(w, a); if (!I) return '';
            return tf('你跟{b}的婚姻很糟：你對他的好感 {f}、他對你 {g}。', { b: I.b.name, f: I.aff, g: I.back }) + (I.kids ? tf('你們有 {n} 個還沒長大的孩子。', { n: I.kids }) : '') + t('離婚的話兩個人都會很難過，鎮上的人也會議論。');
        },
        options(w, a) {
            const I = divOf(w, a); if (!I) return [];
            return [
                { id: 'stay', quiet: true, mute: true, text: '為了這個家再撐一下', say: { k: '還沒跟{b}離婚', p: { b: I.b.name } }, why: '一個家散了不容易再聚', base: REF + (I.kids ? 0.2 : 0), lean: { bond: 0.2, face: 0.1 }, run: () => null },
                // 以前：一對夫妻每天 5%（兩個人都可能開口，所以一個人算 3%，六天問一次）
                { id: 'divorce', quiet: true, text: { k: '跟{b}離婚', p: { b: I.b.name } }, say: { k: '跟{b}離婚', p: { b: I.b.name } }, why: '這些年我們都累了',
                    base: REF + tilt(within(0.03, 6)) + clampN((-30 - I.aff) / 100, 0, 0.3) - (val(a, '家庭') ? 0.15 : 0), lean: { joy: 0.1, face: -0.2 },
                    run: (w2, a2) => { const b = w2.agents[I.b.agentId]; if (!b || !w2.divorceCands(a2).length) return { k: '沒有離成' }; w2.divorce(a2, b); return { k: '跟{b}離婚了', p: { b: b.name } }; } },
            ];
        },
    });

    // ================= 碰上死對頭：要不要當面吵 =================
    const feudOf = (w, a) => (on(w) ? safe(() => w.feudCands?.(a)) : null);
    DECIDE.kind('feud', {
        title: '碰上死對頭', cool: 3, pri: 0.8,
        when(w, a) { const L = feudOf(w, a); return L && L.length ? { b: L[0].b.agentId } : null; },
        facts(w, a) {
            const L = feudOf(w, a); if (!L || !L.length) return '';
            return L.map(x => tf('你跟{b}互相看不順眼（你對他 {f}、他對你 {g}）。', { b: x.b.name, f: x.aff, g: x.back })).join('')
                + t('當街吵起來，兩個人心情都會變差、關係更僵，跟你們要好的人會選邊站；也可能有人出面打圓場。');
        },
        options(w, a) {
            const L = feudOf(w, a); if (!L || !L.length) return [];
            const out = [{ id: 'calm', quiet: true, mute: true, text: '忍一忍，繞路走', say: '沒有跟人起衝突', why: '吵了也沒用', base: REF, lean: { safe: 0.2 }, run: () => null }];
            // 以前：每一對每天 15%、吵過隔五天，仇人多的人一天可能吵好幾場；這裡一個人三天問一次（一次只跟一個人吵），照新舊對照算 18%
            for (const x of L) out.push({ id: 'go:' + x.b.agentId, quiet: true, text: { k: '當面跟{b}吵個明白', p: { b: x.b.name } }, say: { k: '當街跟{b}吵起來', p: { b: x.b.name } }, why: '這口氣我嚥不下去',
                base: REF + tilt(within(0.18, 3)) + (has(a, 'abrasive') ? 0.3 : 0) + (has(a, 'neurotic') ? 0.1 : 0) - (has(a, 'stoic') ? 0.3 : 0) - (has(a, 'kind') ? 0.2 : 0) - (has(a, 'shy') ? 0.2 : 0), lean: { face: 0.3, safe: -0.2, bond: -0.1 },
                run: (w2, a2) => { const b = w2.agents[x.b.agentId]; if (!b || !w2.feudCands(a2).some(y => y.b === b)) return { k: '沒有碰上' }; w2.publicFeud(a2, b); return { k: '跟{b}吵了一架', p: { b: b.name } }; } });
            return out;
        },
    });

    // ================= 要不要去鄰鎮作客（每天 25% 機率問一個心情好的人） =================
    const visOf = (w, a, c) => (on(w) ? safe(() => w.visitInfo?.(a, c)) : null);
    const visitCands = (w, but) => Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead && x !== but && x.job?.key !== 'mayor' && !String(x.agentId).startsWith('visit_') && (x.mood || 50) > 40);
    DECIDE.kind('visit', {
        title: '要不要去鄰鎮作客', scan: false, pri: 1.2,
        when() { return null; },
        facts(w, a, c) { const I = visOf(w, a, c); return I ? tf('鎮上有人要去{t}作客，問你要不要一起去住 {n} 天。去的話這幾天不在鎮上，回來會帶著那邊的見聞。', { t: I.town.name, n: c.stay || 4 }) : ''; },
        options(w, a, c) {
            const I = visOf(w, a, c); if (!I) return []; const tn = I.town.name;
            return [
                { id: 'stay', quiet: true, mute: true, text: '這次不去', say: { k: '沒有去{t}', p: { t: tn } }, why: '鎮上還有事要忙', base: REF + (has(a, 'hardworking') ? 0.15 : 0), lean: { gain: 0.1 },
                    run: (w2, a2) => { if (c.again) { const L = visitCands(w2, a2); if (L.length) ask(w2, L[Math.floor(Math.random() * L.length)], 'visit', { town: c.town, stay: c.stay, again: 0 }); } return null; } },
                // 以前：被挑到就一定去
                { id: 'go', quiet: true, text: { k: '去{t}作客', p: { t: tn } }, say: { k: '去{t}作客', p: { t: tn } }, why: '出去走走看看也好',
                    base: REF + tilt(0.8) + (val(a, '冒險') ? 0.3 : 0) + (has(a, 'charismatic') ? 0.1 : 0) - (has(a, 'shy') ? 0.2 : 0), lean: { joy: 0.3, gain: -0.1 },
                    run: (w2, a2) => (w2.visitBy(a2, c) ? { k: '出發去{t}了', p: { t: tn } } : { k: '沒有去成' }) },
            ];
        },
    });

    // 帶參數的句子：先翻譯整句再填名字（跟其他決策檔一樣，英文字典以整句為鍵）
    function tf(k, p) { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof y === 'string' ? t(y) : String(y)); return s; }
})();
