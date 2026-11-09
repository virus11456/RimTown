// v9.5.0 人生劇本:心願不再只有「做到／放棄」,而是一步一步走的故事
// - 每個心願拆成 2～3 個階段(最後一步就是原本的心願達成),走到下一步會寫進他的人生故事、記在心裡;重要人物的進展會上日誌
// - 挫折:存款大跌退回原點、選舉落敗、表白對象跟別人在一起(心碎)、太久沒進展陷入低潮
// - 轉折結局:記仇的人跟仇人和好(放下)、心碎的人轉換心願;每段劇本結束(達成、放棄、心碎、放下)都留在「人生故事」裡
// - 鎮況「人生劇本」列出最接近夢想的幾個人,村民卡看得到每個人走到第幾步
const ARCS = (() => {
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const mem = (w, a, k, p, imp = 7) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'reflection', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const notable = (w, a) => { try { return typeof CROWD !== 'undefined' ? CROWD.isNotable(w, a) : true; } catch (e) { return true; } };
    const rel = (a, id) => a?.relationships?.relationships?.[id] || null;
    const rec = (w, a) => { try { return w.proposals?.record?.(a.agentId) || {}; } catch (e) { return {}; } };
    const clv = (w, a) => { try { return CLASS.level(w, a); } catch (e) { return 1; } };
    const piety = (w, a) => w.faith?.of?.[a.agentId]?.piety || 0;
    const inCouncil = (w, a) => (w.council?.members || []).includes(a.agentId);
    const ran = (w, a) => { const E = w.election; return !!(E?.candidates || []).some(c => c.agentId === a.agentId) || (E?.electionHistory || []).some(h => (h.candidates || []).some(c => c.agentId === a.agentId)); };
    const friends = (w, a) => Object.values(a.relationships?.relationships || {}).filter(r => (r.affinity || 0) >= 25 && w.agents[r.targetId] && !w.agents[r.targetId].isDead).length;
    // 每個心願的中途階段(最後一步＝MIND.achieved,不在這裡)
    const STEPS = {
        leader: [{ k: '開始在鎮上的事情發聲', ok: (w, a) => (rec(w, a).made || 0) >= 1 || inCouncil(w, a) }, { k: '進了議會，或站出來參選', ok: (w, a) => inCouncil(w, a) || ran(w, a) || (rec(w, a).approved || 0) >= 3 }],
        rich:   [{ k: '存下第一筆積蓄', ok: (w, a) => cash(w, a) >= 60 }, { k: '小有身家', ok: (w, a) => cash(w, a) >= 160 || (typeof BIZ !== 'undefined' && w.biz && !!BIZ.chip?.(w, a)) }],
        clergy: [{ k: '每天虔誠祈禱', ok: (w, a) => piety(w, a) >= 75 }, { k: '穿上神職的衣服', ok: (w, a) => a.job?.key === 'priest' }],
        love:   [{ k: '越來越在意{t}', ok: (w, a, A) => (rel(a, A.target)?.romanticInterest || 0) >= 45 || (rel(a, A.target)?.affinity || 0) >= 50 }],
        revenge:[{ k: '把對{t}的仇記在心裡', ok: (w, a, A) => (rel(a, A.target)?.affinity ?? 0) <= -30 }, { k: '開始找{t}的把柄', ok: (w, a, A) => (rel(a, A.target)?.affinity ?? 0) <= -55 || (w.dark?.rep?.[A.target]?.exposed || 0) >= 1 }],
        fame:   [{ k: '鎮上開始有人認得他', ok: (w, a) => friends(w, a) >= 6 }],
        rise:   [{ k: '日子慢慢好起來', ok: (w, a) => clv(w, a) >= 2 }],
        craft:  [{ k: '拜師苦練，小有名氣', ok: (w, a) => MIND.craftLv(a) >= 6 }, { k: '能獨當一面了', ok: (w, a) => MIND.craftLv(a) >= 10 }],
        family: [{ k: '有了另一半', ok: (w, a) => !!a.relationships?.getPartner?.() }, { k: '家裡添了孩子', ok: (w, a) => (a._childNames || []).length > 0 || Object.values(w.agents).some(o => (o._parentNames || []).includes(a.name)) }],
    };
    const total = (A) => (STEPS[A?.key] || []).length + 1;
    // 文字都存成模板 {k,p}(切換語言後跟著翻)
    const render = (x) => { try { return x && typeof x === 'object' ? Memory.render(x.k, x.p) : t(String(x || '')); } catch (e) { return String(x?.k || x || ''); } };
    const goalT = (w, A) => { const D = typeof MIND !== 'undefined' ? MIND.AMB[A.key] : null; return D ? { k: D.zh, p: { t: w.agents[A.target]?.name || '' } } : { k: '', p: {} }; };
    const stepT = (w, A, i) => { const s = (STEPS[A.key] || [])[i]; return s ? { k: s.k, p: { t: w.agents[A.target]?.name || '' } } : goalT(w, A); };
    const goal = (w, A) => render(goalT(w, A));
    const stepText = (w, A, i) => render(stepT(w, A, i));
    function beat(w, a, A, k, p, opts = {}) {
        const d = day(w); (A.lg || (A.lg = [])).push({ d, k, p }); if (A.lg.length > 6) A.lg.splice(0, A.lg.length - 6);
        if (opts.mem) mem(w, a, opts.mem, p, opts.imp || 7);
        if (opts.log && notable(w, a)) log(w, opts.log, Object.assign({ a: a.name }, p), a.name);
    }
    function story(w, a, A, end) {
        const M = w.mind; if (!M) return; const X = M.story || (M.story = {}); const arr = X[a.agentId] || (X[a.agentId] = []);
        arr.push({ key: A.key, g: goalT(w, A), end, d0: A.since || 0, d1: day(w), st: A.st || 0, n: total(A) }); if (arr.length > 4) arr.splice(0, arr.length - 4);
        const R = M.recent || (M.recent = []); R.push({ id: a.agentId, name: a.name, g: goalT(w, A), end, d: day(w) }); if (R.length > 8) R.splice(0, R.length - 8);
    }
    // 每三天看一次每個人的劇本走到哪
    function tick(w) {
        const M = w.mind; if (!M?.amb) return; const d = day(w);
        for (const a of npcs(w)) {
            const A = M.amb[a.agentId]; if (!A || !STEPS[A.key]) continue;
            if (A.st == null) { A.st = 0; A.lp = A.since || d; A.c0 = cash(w, a); }
            const g = goalT(w, A), tgt = w.agents[A.target];
            // ---- 轉折與挫折 ----
            if (A.key === 'love' && tgt) {
                const p = tgt.relationships?.getPartner?.();
                if (p && p.targetId !== a.agentId && !tgt.isDead) { // 心碎:對方跟別人在一起了
                    const other = w.agents[p.targetId];
                    a.moodModifier = (a.moodModifier || 0) - 8;
                    beat(w, a, A, '{t}跟{o}在一起了，心碎了一地。', { t: tgt.name, o: other?.name || '' }, { mem: '{t}跟{o}在一起了。原來我一直只是在自作多情。', log: '💔 {a}一直默默喜歡{t}，可是{t}選了{o}。', imp: 8 });
                    story(w, a, A, 'heart');
                    try { M.amb[a.agentId] = Object.assign(MIND.pickAmb(w, a), { since: d }); if (M.amb[a.agentId].key === 'love' && M.amb[a.agentId].target === A.target) M.amb[a.agentId] = { key: 'rise', since: d }; } catch (e) { delete M.amb[a.agentId]; }
                    continue;
                }
            }
            if (A.key === 'revenge' && tgt && (rel(a, A.target)?.affinity ?? -99) > 10 && A.st >= 1) { // 放下:跟仇人和好
                a.moodModifier = (a.moodModifier || 0) + 6;
                beat(w, a, A, '跟{t}和好了，那些仇放下了。', { t: tgt.name }, { mem: '我跟{t}之間的帳，算了吧。放下以後，心裡輕鬆多了。', log: '🕊️ {a}本來發誓要跟{t}討回公道，最後兩人卻和好了。', imp: 8 });
                story(w, a, A, 'peace');
                try { M.amb[a.agentId] = Object.assign(MIND.pickAmb(w, a), { since: d }); if (M.amb[a.agentId].key === 'revenge') M.amb[a.agentId] = { key: 'rise', since: d }; } catch (e) { delete M.amb[a.agentId]; }
                continue;
            }
            if (A.key === 'rich' && A.st >= 1 && cash(w, a) < Math.max(20, (A.cp || 60) * 0.4)) { // 錢沒了,退回原點
                A.st = 0; A.lp = d; a.moodModifier = (a.moodModifier || 0) - 6;
                beat(w, a, A, '積蓄幾乎賠光，一切從頭來過。', {}, { mem: '存了那麼久的錢，一下子就沒了……從頭來過吧。', log: '📉 {a}辛苦存下的積蓄幾乎賠光，發財夢一夜回到原點。', imp: 8 });
            }
            if (A.key === 'leader' && A.st >= 2 && !A.lost) { // 選舉落敗,但沒放棄
                const h = (w.election?.electionHistory || []).slice(-1)[0];
                if (h && (h.candidates || []).some(c => c.agentId === a.agentId) && h.winner?.agentId !== a.agentId && (h.day || 0) >= (A.lp || 0)) {
                    A.lost = (A.lost || 0) + 1; a.moodModifier = (a.moodModifier || 0) - 5;
                    beat(w, a, A, '輸給了{w}，但沒有放棄。', { w: h.winner?.name || '' }, { mem: '這次輸給了{w}。下一次，我會準備得更好。', log: '🗳️ {a}這次選輸了{w}，私下說：「我還會再來。」', imp: 8 });
                }
            }
            // ---- 往前走一步 ----
            const S = STEPS[A.key];
            while (A.st < S.length && S[A.st].ok(w, a, A)) {
                const txt = stepT(w, A, A.st); A.st++; A.lp = d; A.low = 0; if (A.key === 'rich') A.cp = cash(w, a);
                a.moodModifier = (a.moodModifier || 0) + 3;
                beat(w, a, A, '{s}', { s: txt, g }, { mem: '朝著「{g}」又前進了一步：{s}。', log: A.st === S.length ? '✨ {a}離「{g}」只差最後一步了：{s}。' : null, imp: 7 });
                if (A.st === S.length && notable(w, a)) { try { w.dailyNews?.collectEvent?.('social', `${t(a.name)}${t('離心願只差一步')}${t('：')}${render(g)}`, 6, [a.name]); } catch (e) {} }
            }
            // ---- 低潮 ----
            if (!A.low && d - (A.lp || d) >= 30 && (a.mood || 50) < 50) {
                A.low = 1; a.moodModifier = (a.moodModifier || 0) - 2;
                beat(w, a, A, '對「{g}」越來越灰心。', { g }, { mem: '「{g}」好像越來越遠了……我是不是太天真了？', imp: 6 });
            }
        }
    }
    // MIND 每 15 天檢討心願(達成就換、太久沒進展可能放棄):比對上次的快照,記下那段劇本怎麼結束
    const sig = (A) => A ? `${A.key}|${A.target || ''}|${A.since || 0}` : '';
    function ends(w) {
        const M = w.mind; const P = M._ap || {};
        for (const [id, o] of Object.entries(P)) {
            if (sig(M.amb[id]) === o.sig) continue; const a = w.agents[id]; if (!a || a.isDead) continue;
            const won = (M.done?.[id]?.length || 0) > (o.dn || 0);
            story(w, a, Object.assign({}, o, { st: won ? total(o) - 1 : o.st }), won ? 'done' : 'give');
        }
    }
    function snap(w) { const M = w.mind; const P = {}; for (const [id, A] of Object.entries(M.amb || {})) if (w.agents[id] && !w.agents[id].isDead) P[id] = { sig: sig(A), key: A.key, target: A.target || null, since: A.since || 0, st: A.st || 0, dn: M.done?.[id]?.length || 0 }; M._ap = P; }
    function wrapBrief() {
        if (typeof MIND === 'undefined' || MIND._arcWrapped) return; MIND._arcWrapped = true;
        const _ab = MIND.brief;
        MIND.brief = function (w, a) { let s = _ab.call(this, w, a); try { const A = w.mind?.amb?.[a.agentId]; if (A && STEPS[A.key]) { const n = total(A), st = A.st || 0; s += `${t('；')}${t('目前走到第 {i} 步（共 {n} 步）').replace('{i}', st + 1).replace('{n}', n)}${t('：')}${stepText(w, A, st)}`; } } catch (e) {} return s; };
    }
    const END = { done: ['🌟 達成', '🌟 achieved'], give: ['🍂 放棄', '🍂 gave up'], heart: ['💔 心碎', '💔 heartbroken'], peace: ['🕊️ 放下', '🕊️ let go'] };
    const endText = (e) => { const z = END[e] || END.give; return (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? z[1] : z[0]; };
    const dots = (A) => { const n = total(A), st = Math.min(A.st || 0, n); return '●'.repeat(st) + '○'.repeat(Math.max(0, n - st)); };
    // 村民卡:心願、走到第幾步、最近幾段劇情、以前的劇本
    function card(w, a) {
        const A = w.mind?.amb?.[a?.agentId]; if (!A || !STEPS[A.key]) return null;
        return { dots: dots(A), next: stepText(w, A, Math.min(A.st || 0, total(A) - 1)), beats: (A.lg || []).slice(-3).map(x => render(x)), past: (w.mind.story?.[a.agentId] || []).slice(-2).map(s => `${endText(s.end)}${t('：')}${render(s.g)}`) };
    }
    // 鎮況:最接近夢想的人、最近落幕的劇本
    function board(w) {
        const M = w.mind; if (!M?.amb) return null;
        const rows = npcs(w).map(a => ({ a, A: M.amb[a.agentId] })).filter(x => x.A && STEPS[x.A.key] && (x.A.st || 0) >= 1).map(x => ({ id: x.a.agentId, name: x.a.name, g: goal(w, x.A), dots: dots(x.A), r: (x.A.st || 0) / total(x.A), next: stepText(w, x.A, Math.min(x.A.st || 0, total(x.A) - 1)), last: x.A.lg?.length ? render(x.A.lg[x.A.lg.length - 1]) : '' }))
            .sort((x, y) => y.r - x.r).slice(0, 5);
        return { rows, recent: (M.recent || []).slice(-3).reverse().map(x => ({ name: x.name, end: endText(x.end), g: render(x.g) })) };
    }
    // 給規則對話、每日計畫用的一句(取代舊的「夢想」)
    function lineFor(w, a) { const A = w.mind?.amb?.[a.agentId]; if (!A || !STEPS[A.key]) return ''; return t('正朝著心願「{g}」努力（下一步：{s}）').replace('{g}', goal(w, A)).replace('{s}', stepText(w, A, Math.min(A.st || 0, total(A) - 1))); }
    function planT(w, a) { const A = w.mind?.amb?.[a.agentId]; if (!A || !STEPS[A.key]) return null; return { k: '為心願「{g}」再努力一點：{s}', p: { g: goalT(w, A), s: stepT(w, A, Math.min(A.st || 0, total(A) - 1)) } }; }
    function diaryT(w, a) { const A = w.mind?.amb?.[a.agentId]; if (!A || !STEPS[A.key]) return null; return Math.random() < 0.5 ? { k: '離「{g}」還有多遠呢……但我不會停下來的。', p: { g: goalT(w, A) } } : { k: '夜裡又想起「{g}」。下一步是{s}，明天再往前一點吧。', p: { g: goalT(w, A), s: stepT(w, A, Math.min(A.st || 0, total(A) - 1)) } }; }
    function daily(w) { const M = w.mind; if (!M?.amb) return; const d = day(w); if (M.arcDay != null && d - M.arcDay < 3) return; M.arcDay = d; ends(w); tick(w); snap(w); }
    wrapBrief();
    return { STEPS, total, goal, stepText, tick, daily, ends, snap, card, board, dots, endText, lineFor, planT, diaryT };
})();
if (typeof MIND !== 'undefined') {
    const _d = MIND.daily;
    MIND.daily = function (w) { const r = _d.call(this, w); try { ARCS.daily(w); } catch (e) { console.warn('[Arcs] daily', e); } return r; };
}
// v9.5.1 舊的「夢想」(v5.4,看全鎮繁榮度、純時間推進)在觀察者模式停用:村民卡、每日計畫、對話都改看心願／人生劇本
if (typeof LifeGoalSystem !== 'undefined') {
    const LG = LifeGoalSystem.prototype; const obs = (g) => g._obs ?? (typeof window !== 'undefined' && !!window.rimtownApp?.world?.observerMode);
    const _du = LG.dailyUpdate; LG.dailyUpdate = function (world, ...r) { this._obs = !!world?.observerMode; if (this._obs) return; return _du.call(this, world, ...r); };
    const _gg = LG.getGoal; LG.getGoal = function (id) { return obs(this) ? null : _gg.call(this, id); };
    const _ds = LG.describe; LG.describe = function (id) { return obs(this) ? null : _ds.call(this, id); };
}
if (typeof globalThis !== 'undefined') globalThis.ARCS = ARCS;
