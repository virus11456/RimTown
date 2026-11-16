// v11.0.0 市場與第四權（第一段）之五：民怨、鎮公所前的抗議、遊行
// - 民怨怎麼來：官員接到告發不辦、收錢了事、首長出面護航或留任上了報的官員。親身碰到的人、讀到報導而且相信的人，各記一筆（30 天後淡掉）。
// - 心裡有氣的人自己決定（hallCall）：忍著／號召大家到鎮公所前抗議／跟著已經有人號召的去／去連署罷免（對象是首長時）。
// - 有人號召，其他有氣的人各自決定去不去（hallJoin）。隔天到場滿 3 人就成局；有氣的人夠多、上一次又被打發掉，就升級成遊行。
// - 首長自己決定怎麼應對（hallFaced）：出面答應處理（撤換官員、重查、提規定）／不出面／叫衛兵趕人。
// - 衛兵隊長自己決定（hallGuard）：照命令趕人／站到一邊／站到人群裡。
// - 後果都落在好感上：被打發、被趕的人對首長的好感大降，這直接就是連署罷免的人數（sim-repeal.js 的 dislike）。王都以外最高只到罷免。
// 必須在 sim-office.js 之後載入。
'use strict';
const UNREST = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined') return null;
    const KEEP = 30, GAP_HALL = 7, GAP_MARCH = 14, MIN = 3, ASK_GAP = 7;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1, G = 'deal';
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && !(w.isAway?.(a.agentId)));
    const live = (w, id) => { const a = w.agents[id]; return a && !a.isDead ? a : null; };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'politics', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('politics', k, p || {}, who || ''); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const mayor = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    const OF = () => (typeof OFFICE !== 'undefined' && OFFICE ? OFFICE : null);
    const LW = () => (typeof DEALLAW !== 'undefined' && DEALLAW ? DEALLAW : null);
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w); } catch (e) { return false; } };
    const WHY = { snub: '接到告發卻不辦', paid: '報上說收了店家的錢不辦事', shield: '報上說接到告發卻不辦', cover: '報上說出面替店家擋事', keep: '把上了報的官員留在位子上', heard: '聽說接到告發卻不辦', ignored: '大家到鎮公所前抗議，卻不出面', cleared: '叫衛兵把抗議的人趕走', death: '出了人命卻沒有人負責' }; // 不寫主詞：對別人、對首長自己講都通
    function S(w) {
        if (!w.unrest || typeof w.unrest !== 'object') w.unrest = { angry: {}, call: null, cur: null, last: { hall: -99, march: -99 }, escal: {}, asked: {}, hist: [], n: 0, lastDay: null, st: { calls: 0, halls: 0, marches: 0, fizzled: 0, met: 0, ignored: 0, cleared: 0, stood: 0, joined: 0, signed: 0 } };
        const U = w.unrest; U.angry = U.angry || {}; U.last = U.last || { hall: -99, march: -99 }; U.escal = U.escal || {}; U.asked = U.asked || {}; U.hist = U.hist || []; U.st = U.st || {}; return U;
    }
    const postName = (w, a) => { const p = OF()?.postOf(w, a); return p ? OF().pname(p) : (mayor(w) === a ? '首長' : '官員'); };
    // 還在氣頭上的人。target＝只算對這個人的
    function list(w, target) { const U = S(w), d = day(w); const out = []; for (const [id, x] of Object.entries(U.angry)) { if (d - x.d > KEEP) continue; if (target && x.at !== target.agentId) continue; const a = live(w, id); if (a && !(w.isAway?.(id))) out.push(a); } return out; }
    const heat = (w) => { const n = adults(w).length; return n ? Math.round(list(w).length / n * 100) / 100 : 0; };
    const marchNeed = (w) => Math.max(6, Math.ceil(adults(w).length * 0.15));
    const angryAt = (w, a) => { const x = w.unrest?.angry?.[a?.agentId]; return x && day(w) - x.d <= KEEP ? x : null; };
    // 記一筆怨氣。n＝輕重 1～3；why＝WHY 裡的代碼
    function anger(w, a, target, n, why) {
        if (!on(w) || !a || !target || a === target || a.isDead || (a.age ?? 30) < 16) return null; const U = S(w), d = day(w);
        const x = U.angry[a.agentId] && d - U.angry[a.agentId].d <= KEEP ? U.angry[a.agentId] : (U.angry[a.agentId] = { d, at: target.agentId, n: 0, why: why || 'heard' });
        x.n = Math.min(6, (x.n || 0) + (n || 1)); x.d = d; x.at = target.agentId; if (why) x.why = why;
        if (x.n >= 2 && d - (U.asked[a.agentId] ?? -99) >= ASK_GAP) { U.asked[a.agentId] = d; DECIDE.enqueue(w, a, 'hallCall', { at: target.agentId }); }
        return x;
    }
    const calm = (w, target, f) => { const U = S(w); for (const [id, x] of Object.entries(U.angry)) if (x.at === target.agentId) { if (f <= 0) delete U.angry[id]; else x.n = Math.max(1, Math.floor(x.n * f)); } };
    const canCall = (w, target) => { const U = S(w), d = day(w); return !U.call && d - Math.max(U.last.hall, U.last.march) >= GAP_HALL && list(w, target).length >= MIN; };
    const wouldMarch = (w, target) => { const U = S(w), d = day(w); return list(w, target).length >= marchNeed(w) && d - U.last.march >= GAP_MARCH && d - (U.escal[target.agentId] ?? -99) <= 21; };
    function call(w, lead, target) {
        const U = S(w), d = day(w); if (!canCall(w, target)) return null; const kind = wouldMarch(w, target) ? 'march' : 'hall';
        U.call = { d, lead: lead.agentId, at: target.agentId, who: [lead.agentId], kind }; U.st.calls = (U.st.calls || 0) + 1;
        mem(w, lead, kind === 'march' ? '我號召大家明天上街，一路走到鎮公所。' : '我號召大家明天到鎮公所前抗議。', {}, 7);
        log(w, kind === 'march' ? '📣 {a}號召大家明天上街遊行，要{o}出來面對。' : '📣 {a}號召大家明天到鎮公所前抗議{o}。', { a: lead.name, o: target.name }, lead.name);
        const others = list(w, target).filter(a => a !== lead).sort((x, y) => (U.angry[y.agentId].n + aff(y, lead) / 40) - (U.angry[x.agentId].n + aff(x, lead) / 40)).slice(0, 14);
        for (const a of others) DECIDE.enqueue(w, a, 'hallJoin', { at: target.agentId, lead: lead.agentId });
        return U.call;
    }
    const guards = (w) => npcs(w).filter(a => a.job?.key === 'guard' && !(w.isAway?.(a.agentId))).sort((x, y) => (y.age ?? 30) - (x.age ?? 30));
    const rec = (w, E, k, p) => { E.log.push({ d: day(w), k, p: p || {} }); };
    // 隔天：到場的人夠不夠
    function happen(w) {
        const U = S(w), d = day(w); const C = U.call; U.call = null; if (!C) return null; const target = live(w, C.at); const lead = live(w, C.lead);
        const crowd = C.who.map(id => live(w, id)).filter(a => a && !(w.isAway?.(a.agentId))); const need = C.kind === 'march' ? Math.max(MIN + 2, Math.ceil(marchNeed(w) * 0.6)) : MIN;
        if (!target || crowd.length < need) { U.st.fizzled = (U.st.fizzled || 0) + 1; if (lead) mem(w, lead, '我號召大家去鎮公所，來的人太少，沒有成。', {}, 6); U.hist.push({ id: 'U' + (++U.n), d, kind: C.kind, at: C.at, atName: target?.name || '', lead: C.lead, leadName: lead?.name || '', n: crowd.length, who: [], res: 'fizzle', log: [{ d, k: '只來了 {n} 個人，沒有成', p: { n: crowd.length } }] }); if (U.hist.length > 12) U.hist.shift(); return null; }
        const E = { id: 'U' + (++U.n), d, kind: C.kind, at: C.at, atName: target.name, lead: C.lead, leadName: lead?.name || '', n: crowd.length, who: crowd.map(a => a.agentId), res: null, log: [] }; U.hist.push(E); if (U.hist.length > 12) U.hist.shift(); U.cur = E.id; U.last[C.kind] = d; U.st[C.kind === 'march' ? 'marches' : 'halls'] = (U.st[C.kind === 'march' ? 'marches' : 'halls'] || 0) + 1;
        const now = w.tickCount; for (const a of crowd) { if (!a._ceremony) a._thingGo = { place: 'town_hall', from: now, until: now + (C.kind === 'march' ? 24 : 16), why: 'protest', id: E.id }; rel(a, target)?.modifyAffinity?.(-3); mem(w, a, C.kind === 'march' ? '我跟大家一起上街，走到鎮公所前。' : '我去了鎮公所前抗議。', {}, 6); }
        log(w, C.kind === 'march' ? '🚩 {n} 人上街遊行，一路走到鎮公所前，要{o}（{p}）出來面對。' : '✊ {n} 人聚在鎮公所前抗議{o}（{p}）。', { n: crowd.length, o: target.name, p: postName(w, target) }, target.name);
        rec(w, E, C.kind === 'march' ? '{a}帶著 {n} 人上街，走到鎮公所前' : '{a}帶著 {n} 人到鎮公所前抗議', { a: lead?.name || '', n: crowd.length });
        try { w.dailyNews?.collectEvent?.('politics', fill(C.kind === 'march' ? '{n} 人上街遊行' : '{n} 人到鎮公所前抗議', { n: crowd.length }), C.kind === 'march' ? 8 : 6, [target.name]); } catch (e) {}
        const M = mayor(w); if (M && !(w.isAway?.(M.agentId))) DECIDE.enqueue(w, M, 'hallFaced', { eid: E.id }); else snubbed(w, E, null, 'ignored');
        return E;
    }
    const evOf = (w, id) => S(w).hist.find(x => x.id === id) || null;
    const crowdOf = (w, E) => (E?.who || []).map(id => live(w, id)).filter(Boolean);
    // 被打發（不出面、衛兵站到一邊）：到場的人更氣
    function snubbed(w, E, M, why) {
        const U = S(w); const target = live(w, E.at); const k = E.kind === 'march' ? 1.5 : 1;
        for (const a of crowdOf(w, E)) { if (M) { rel(a, M)?.modifyAffinity?.(-Math.round(5 * k)); anger(w, a, M, 1, why); } else if (target) anger(w, a, target, 1, why); }
        if (M) for (const a of adults(w)) if (!E.who.includes(a.agentId) && a !== M && Math.random() < 0.3) rel(a, M)?.modifyAffinity?.(-Math.round(2 * k));
        U.escal[E.at] = day(w); if (M) U.escal[M.agentId] = day(w);
    }
    // 首長出面答應處理：真的去做
    function concede(w, M, E) {
        const U = S(w); const target = live(w, E.at); const lead = live(w, E.lead); const done = []; const post = target && OF() ? OF().postOf(w, target) : null;
        if (post && target !== M) { OF().vacate(w, post, '民眾抗議後被撤換'); rel(target, M)?.modifyAffinity?.(-15); calm(w, target, 0); done.push({ k: '撤掉了{p}{o}', p: { p: OF().pname(post), o: target.name } }); }
        // 被壓下來的事重新辦：還在做的偷工、講好，交付審判或當場罰
        const covers = DEAL.S(w).facts.filter(f => (f.kind === 'cover' || f.kind === 'bribe') && f.key && !f.redo && day(w) - f.d <= 60 && (f.by === E.at || f.with === E.at || f.by === M.agentId));
        for (const cf of covers.slice(0, 2)) { cf.redo = day(w); const lf = DEAL.liveFact(w, cf.key, 'cut') || DEAL.liveFact(w, cf.key, 'pact'); const o = DEAL.owner(w, cf.key); if (!lf || !o) continue;
            if (LW() && (lf.harm || lf.dead) && !lf.tried && LW().trial(w, lf, lead || M)) { done.push({ k: '把{o}交付審判', p: { o: o.name } }); continue; }
            if (OF()) { const n = clampN(Math.round((DEAL.F(w, cf.key).gain || 0) * 0.5) + 10, 10, 120); const g = OF().punish(w, M, { post: 'market', key: cf.key, oid: o.agentId, what: [lf.kind], n }, false); done.push({ k: '重查{o}，罰了 {n} 銀幣', p: { o: o.name, n: g } }); } }
        if (!done.length && LW()) { const kind = LW().LAWS.find(k => LW().okNow(w, k, true)); if (kind && LW().propose(w, kind, M, '')) done.push({ k: '答應立規定：{t}', p: { t: LW().TITLE[kind] } }); }
        if (!done.length) done.push({ k: '答應會查清楚' });
        for (const a of crowdOf(w, E)) rel(a, M)?.modifyAffinity?.(4); calm(w, M, 0.5); if (target && target !== M) calm(w, target, 0.5);
        return done;
    }
    // ---------- 每天 ----------
    function daily(w) {
        if (!on(w)) return; const U = S(w), d = day(w); if (U.lastDay === d) return; U.lastDay = d;
        for (const [id, x] of Object.entries(U.angry)) if (d - x.d > KEEP || !live(w, id)) delete U.angry[id];
        for (const id of Object.keys(U.asked)) if (d - U.asked[id] > 60) delete U.asked[id];
        if (U.call && U.call.d < d) happen(w);
        try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) {}
    }
    // ================= 心裡有氣的人 =================
    DECIDE.kind('hallCall', {
        title: '這口氣要不要出', scan: false, pri: 1.2, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = live(w, c.at); const x = angryAt(w, a); if (!o || !x) return ''; const U = S(w); const n = list(w, o).length;
            return fill('你對{o}（{p}）很不滿：{why}。鎮上像你這樣對他不滿的人大約有 {n} 個。{call}{esc}', { o: o.name, p: postName(w, o), why: WHY[x.why] || WHY.heard, n,
                call: U.call ? { k: '{a}已經號召大家明天到鎮公所前，現在有 {n} 人要去。', p: { a: live(w, U.call.lead)?.name || '', n: U.call.who.length } } : { raw: '' }, esc: day(w) - (U.escal[o.agentId] ?? -99) <= 21 ? '上一次去抗議，被打發掉了。' : { raw: '' } }); },
        options(w, a, c) {
            const o = live(w, c.at); const x = angryAt(w, a); if (!o || !x) return []; const U = S(w); const shy = has(a, 'shy') ? 0.35 : 1, bold = has(a, 'brave') || has(a, 'abrasive') || has(a, 'charismatic') ? 1.6 : 1; const M = mayor(w);
            const out = [{ id: 'bear', quiet: true, mute: true, text: '忍著，日子還是要過', say: '把氣吞了下去', why: '小老百姓鬥不過當官的', base: REF + (has(a, 'stoic') ? 0.3 : 0), lean: { safe: 0.4 }, run: () => null }];
            if (U.call && U.call.at === o.agentId && !U.call.who.includes(a.agentId)) out.push({ id: 'join', text: '明天跟大家一起去鎮公所', say: '決定明天去鎮公所前', why: '人多才有人理', base: REF + tilt(clampN(0.35 * x.n / 2 * shy * bold, 0.03, 0.95)), lean: { bond: 0.3, safe: -0.2 }, run: (w2, a2) => { if (!S(w2).call) return null; S(w2).call.who.push(a2.agentId); return { k: '明天去' }; } });
            if (canCall(w, o)) { const mk = wouldMarch(w, o); out.push({ id: 'call', text: mk ? '號召大家上街，一路走到鎮公所' : '號召大家明天到鎮公所前抗議', say: mk ? '號召大家上街遊行' : '號召大家到鎮公所前抗議', why: '不鬧大，他們不會當一回事', base: REF + tilt(clampN(0.12 * x.n / 2 * shy * bold * (aff(a, o) >= 40 ? 0.3 : 1), 0.01, 0.9)), lean: { face: 0.4, safe: -0.4 }, run: (w2, a2) => (call(w2, a2, o) ? { k: '號召了' } : null) }); }
            if (M === o && typeof REPEAL !== 'undefined' && REPEAL.recallInfo) out.push({ id: 'sign', quiet: true, text: { k: '去連署罷免{o}', p: { o: o.name } }, say: { k: '去連署罷免{o}', p: { o: o.name } }, why: '這種人不該再當下去', base: REF + tilt(clampN(0.2 * x.n / 2 * (honesty(a) >= 4 ? 1.4 : 1) * (aff(a, o) >= 40 ? 0.2 : 1), 0.02, 0.9)), lean: { face: 0.2, safe: -0.1 },
                run: (w2, a2) => { rel(a2, o)?.modifyAffinity?.(-20); S(w2).st.signed = (S(w2).st.signed || 0) + 1; mem(w2, a2, '我去連署罷免{o}。', { o: o.name }, 7); return { k: '簽了名' }; } });
            return out;
        },
    });
    DECIDE.kind('hallJoin', {
        title: '有人號召去鎮公所', scan: false, pri: 1.0, aiGroup: G, aiKind: 8,
        when() { return null; },
        facts(w, a, c) { const U = S(w); const C = U.call; const o = live(w, c.at); const L = live(w, c.lead); const x = angryAt(w, a); if (!C || !o || !L || !x) return '';
            return fill(C.kind === 'march' ? '{l}號召大家明天上街，一路走到鎮公所，要{o}出來面對。現在有 {n} 人要去。你對{o}也不滿：{why}。' : '{l}號召大家明天到鎮公所前抗議{o}。現在有 {n} 人要去。你對{o}也不滿：{why}。', { l: L.name, o: o.name, n: C.who.length, why: WHY[x.why] || WHY.heard }); },
        options(w, a, c) {
            const U = S(w); const C = U.call; const L = live(w, c.lead); const x = angryAt(w, a); if (!C || C.at !== c.at || !L || !x || C.who.includes(a.agentId)) return []; const shy = has(a, 'shy') ? 0.4 : 1; const o = live(w, c.at);
            return [
                { id: 'stay', quiet: true, mute: true, text: '不去', say: '沒有跟著去', why: '出頭的人最先倒楣', base: REF, lean: { safe: 0.4 }, run: () => null },
                { id: 'go', text: '跟著去', say: '答應明天一起去鎮公所', why: '人多才有人理', base: REF + tilt(clampN(0.4 * x.n / 2 * shy * (aff(a, L) >= 30 ? 1.5 : 1) * (C.who.length >= 4 ? 1.3 : 1) * (o && aff(a, o) >= 40 ? 0.3 : 1), 0.03, 0.95)), lean: { bond: 0.3, safe: -0.2 }, run: (w2, a2) => { const C2 = S(w2).call; if (!C2 || C2.who.includes(a2.agentId)) return null; C2.who.push(a2.agentId); return { k: '明天去' }; } },
            ];
        },
    });
    // ================= 首長怎麼應對 =================
    DECIDE.kind('hallFaced', {
        title: '鎮公所前聚了一群人', scan: false, pri: 1.9, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const E = evOf(w, c.eid); const o = live(w, E?.at); if (!E || !o) return ''; const gs = guards(w); const I = (typeof REPEAL !== 'undefined' && REPEAL.recallInfo) ? (() => { try { return REPEAL.recallInfo(w, null); } catch (e) { return null; } })() : null;
            return fill(E.kind === 'march' ? '{n} 人上街遊行，走到鎮公所前，帶頭的是{l}。他們不滿的是{who}：{why}。{g}{r}' : '{n} 人聚在鎮公所前抗議，帶頭的是{l}。他們不滿的是{who}：{why}。{g}{r}', { n: E.n, l: E.leadName, who: o === a ? '你' : { k: '{o}（{p}）', p: { o: o.name, p: postName(w, o) } }, why: WHY[S(w).angry[E.lead]?.why] || WHY.heard,
                g: gs.length ? { k: '鎮上有 {n} 名衛兵聽你調度。', p: { n: gs.length } } : { raw: '' }, r: I && I.L === a ? { k: '現在想連署罷免你的有 {n} 人，滿 {m} 人就會成案。', p: { n: I.signers, m: I.need } } : { raw: '' } }); },
        options(w, a, c) {
            const E = evOf(w, c.eid); const o = live(w, E?.at); if (!E || E.res || !o || mayor(w) !== a) return []; const gs = guards(w); const hon = honesty(a); const big = E.kind === 'march' ? 1.4 : 1; const self = o === a; const tie = !self && aff(a, o) >= 40 ? 0.5 : 1;
            const out = [
                { id: 'meet', text: self ? '出面，答應把壓下來的事重新查' : { k: '出面，答應處理{o}的事', p: { o: o.name } }, say: '出面答應處理', why: '再不處理，下一個被趕下台的是我', base: REF + tilt(clampN(0.35 * big * (hon >= 4 ? 1.4 : 1) * (has(a, 'kind') ? 1.3 : 1) * tie * (self ? 0.7 : 1), 0.03, 0.97)), lean: { bond: 0.3, face: -0.2 },
                    run: (w2, a2) => { const done = concede(w2, a2, E); E.res = 'meet'; S(w2).st.met = (S(w2).st.met || 0) + 1; for (const x of done) rec(w2, E, '{m}出面：{x}', { m: a2.name, x }); log(w2, '🏛️ {m}出面見了抗議的人，答應處理。', { m: a2.name }, a2.name); return { k: '答應處理' }; } },
                { id: 'ignore', quiet: true, text: '不出面，等他們自己散', say: '沒有出面', why: '理了一次，以後天天有人來鬧', base: REF + tilt(clampN(0.4 / big * (has(a, 'lazy') ? 1.4 : 1) * (hon >= 4 ? 0.6 : 1), 0.03, 0.95)), lean: { safe: 0.3, face: -0.2 },
                    run: (w2, a2) => { E.res = 'ignore'; S(w2).st.ignored = (S(w2).st.ignored || 0) + 1; snubbed(w2, E, a2, 'ignored'); rec(w2, E, '{m}沒有出面，人群等到天黑才散', { m: a2.name }); log(w2, '🏛️ {m}沒有出面，鎮公所前的人等到天黑才散。', { m: a2.name }, a2.name); return { k: '沒有出面' }; } },
            ];
            if (gs.length) out.push({ id: 'clear', text: '叫衛兵把人趕走', say: '下令衛兵驅散人群', why: '聚眾鬧事，不能縱容', base: REF + tilt(clampN(0.08 * big * (has(a, 'abrasive') ? 2.5 : 1) * (has(a, 'kind') ? 0.2 : 1) * (hon >= 4 ? 0.4 : 1), 0.004, 0.8)), lean: { safe: 0.2, bond: -0.5 },
                run: (w2, a2) => { E.order = a2.agentId; rec(w2, E, '{m}下令衛兵把人趕走', { m: a2.name }); DECIDE.enqueue(w2, gs[0], 'hallGuard', { eid: E.id }); return { k: '下了命令' }; } });
            return out;
        },
    });
    // ================= 衛兵隊長 =================
    DECIDE.kind('hallGuard', {
        title: '首長叫你把人趕走', scan: false, pri: 1.9, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const E = evOf(w, c.eid); const M = live(w, E?.order); if (!E || !M) return ''; const kin = crowdOf(w, E).filter(x => aff(a, x) >= 40).length;
            return fill('{m}下令：把鎮公所前的 {n} 個人趕走。{kin}{mine}', { m: M.name, n: E.n, kin: kin ? { k: '人群裡有 {n} 個是你的親友。', p: { n: kin } } : { raw: '' }, mine: angryAt(w, a) ? '他們不滿的事，你自己也不滿。' : { raw: '' } }); },
        options(w, a, c) {
            const E = evOf(w, c.eid); const M = live(w, E?.order); if (!E || E.res || !M || !guards(w).includes(a)) return []; const kin = crowdOf(w, E).filter(x => aff(a, x) >= 40).length; const mine = !!angryAt(w, a); const hon = honesty(a);
            const out = [
                { id: 'obey', text: '照命令把人趕走', say: '帶人驅散了人群', why: '命令就是命令', base: REF + tilt(clampN(0.45 * (has(a, 'abrasive') ? 1.5 : 1) * (kin ? 0.4 : 1) * (mine ? 0.4 : 1) * (aff(a, M) >= 40 ? 1.4 : 1), 0.03, 0.95)), lean: { safe: 0.3, bond: -0.4 },
                    run: (w2, a2) => { const U = S(w2), d = day(w2); E.res = 'cleared'; U.st.cleared = (U.st.cleared || 0) + 1; let hurt = 0; const cr = crowdOf(w2, E); const k = E.kind === 'march' ? 1.5 : 1;
                        for (const x of cr) { delete x._thingGo; if (Math.random() < 0.25) { hurt++; try { HEALTH.hurt(w2, x, Math.random() < 0.5 ? 'h' : 'f', 0.3); } catch (e) {} x.moodModifier = (x.moodModifier || 0) - 6; } rel(x, M)?.modifyAffinity?.(-Math.round(12 * k)); rel(x, a2)?.modifyAffinity?.(-8); anger(w2, x, M, 2, 'cleared'); }
                        for (const x of adults(w2)) if (!E.who.includes(x.agentId) && x !== M && x !== a2 && Math.random() < 0.4) rel(x, M)?.modifyAffinity?.(-Math.round(4 * k));
                        try { const PW = POWER.S(w2); PW.scandal[M.agentId] = (PW.scandal[M.agentId] || 0) + 1; } catch (e) {}
                        const lead = live(w2, E.lead); if (lead && w2.civic?.jail) { w2.civic.jail[lead.agentId] = d + 2; mem(w2, lead, '我帶頭去鎮公所，被關了兩天。', {}, 8); }
                        U.escal[E.at] = d; U.escal[M.agentId] = d; E.hurt = hurt; rec(w2, E, '衛兵把人趕走，{n} 人受傷，帶頭的被關了兩天', { n: hurt }); log(w2, '🛡️ 衛兵把鎮公所前的人趕走了，{n} 人受傷。', { n: hurt }, M.name);
                        try { w2.dailyNews?.collectEvent?.('politics', fill('衛兵驅散鎮公所前的人群，{n} 人受傷', { n: hurt }), 8, [M.name]); } catch (e) {} return { k: '把人趕走了，{n} 人受傷', p: { n: hurt } }; } },
                { id: 'stand', text: '把人帶到場，站到一邊不動手', say: '到了場卻沒有動手', why: '那些都是鄉親，我下不了手', base: REF + tilt(clampN(0.35 * (has(a, 'kind') ? 1.6 : 1) * (kin ? 1.8 : 1) * (hon >= 4 ? 1.3 : 1), 0.03, 0.95)), lean: { bond: 0.3, safe: -0.2 },
                    run: (w2, a2) => { E.res = 'stood'; S(w2).st.stood = (S(w2).st.stood || 0) + 1; rel(M, a2)?.modifyAffinity?.(-10); for (const x of crowdOf(w2, E)) rel(x, a2)?.modifyAffinity?.(6); snubbed(w2, E, M, 'ignored'); rec(w2, E, '衛兵到了場，站在一邊沒有動手', {}); log(w2, '🛡️ 衛兵到了鎮公所前，站在一邊沒有動手。', {}, a2.name); return { k: '沒有動手' }; } },
            ];
            if (mine || kin >= 2) out.push({ id: 'join', text: '摘下帽子，站到人群裡', say: '站到了人群那一邊', why: '他們說的沒有錯', base: REF + tilt(clampN(0.1 * (mine ? 2 : 1) * (kin >= 2 ? 1.5 : 1) * (aff(a, M) >= 40 ? 0.2 : 1), 0.01, 0.8)), lean: { face: 0.3, safe: -0.5 },
                run: (w2, a2) => { E.res = 'joined'; S(w2).st.joined = (S(w2).st.joined || 0) + 1; E.who.push(a2.agentId); E.n++; rel(M, a2)?.modifyAffinity?.(-20); for (const x of crowdOf(w2, E)) if (x !== a2) rel(x, a2)?.modifyAffinity?.(10); try { const PW = POWER.S(w2); PW.scandal[M.agentId] = (PW.scandal[M.agentId] || 0) + 1; } catch (e) {} snubbed(w2, E, M, 'ignored'); rec(w2, E, '衛兵隊長{g}摘下帽子，站到人群裡', { g: a2.name }); log(w2, '🛡️ 衛兵隊長{g}摘下帽子，站到了人群那一邊。', { g: a2.name }, a2.name); return { k: '站到人群裡' }; } });
            return out;
        },
    });
    // 做決定時看得到的處境
    function describe(w, a) {
        if (!w.unrest || !a) return ''; const out = []; const x = angryAt(w, a); const o = x ? live(w, x.at) : null;
        if (x && o) out.push(fill('你對{o}很不滿：{why}。', { o: o.name, why: WHY[x.why] || WHY.heard }));
        const n = list(w, a).length; if (n >= 3) out.push(fill('鎮上有 {n} 個人對你很不滿。', { n }));
        return out.join('');
    }
    const RES = { meet: '首長出面答應處理', ignore: '首長沒有出面', cleared: '被衛兵趕走', stood: '衛兵沒有動手', joined: '衛兵站到人群那一邊', fizzle: '人太少，沒有成' };
    function view(w) {
        if (!w.unrest) return null; const U = S(w), d = day(w); const cnt = {}; for (const a of list(w)) { const id = U.angry[a.agentId].at; cnt[id] = (cnt[id] || 0) + 1; }
        return { heat: heat(w), angry: list(w).length, need: marchNeed(w), targets: Object.entries(cnt).map(([id, n]) => ({ id, name: w.agents[id]?.name || '', n })).filter(x => x.name).sort((x, y) => y.n - x.n).slice(0, 5),
            call: U.call ? { lead: live(w, U.call.lead)?.name || '', at: live(w, U.call.at)?.name || '', n: U.call.who.length, kind: U.call.kind } : null,
            hist: U.hist.slice(-8).reverse().map(E => ({ id: E.id, ago: d - E.d, kind: E.kind, at: E.atName, lead: E.leadName, n: E.n, res: E.res ? t(RES[E.res] || E.res) : t('首長還沒有回應'), log: E.log.map(l => ({ ago: d - l.d, text: fill(l.k, l.p) })) })), st: Object.assign({}, U.st) };
    }
    try { DECIDE.source('pol', (w, a) => describe(w, a)); } catch (e) {}
    return { S, on, WHY, anger, angryAt, list, heat, marchNeed, canCall, wouldMarch, call, happen, concede, snubbed, calm, guards, daily, describe, view, KEEP };
})();
if (typeof globalThis !== 'undefined') globalThis.UNREST = UNREST;
if (UNREST) {
    if (typeof ProposalSystem !== 'undefined') { const PS = ProposalSystem.prototype; const _daily = PS.daily; if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { UNREST.daily(w); } catch (e) { console.warn('[Unrest] daily', e); } return r; }; }
    if (typeof World !== 'undefined') {
        const WP = World.prototype;
        const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.unrest = null; return r; };
        const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.unrest) d.unrest = this.unrest; return d; };
        const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.unrest = (data?.unrest && typeof data.unrest === 'object') ? data.unrest : null; } catch (e) {} return r; };
    }
}
