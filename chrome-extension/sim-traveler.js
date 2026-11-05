// v6.58.2 微服出巡的神明:上帝視角下,你在村民眼裡只是「時常路過的旅人」,沒人知道你是誰
// - 聊天:AI 以「路過的旅人」看待你;你說的話會留在對方記憶裡(提案發想、日常都看得到)、可能被轉述給朋友
// - 點化:完整智能體模式下,聽了你的話的人有機會據此向全鎮提案(不是命令,他可能照自己的意思改,也可能不理)
// - 識破:你來過之後鎮上總出怪事(事件卡),虔誠的人(神職、苦行)越容易起疑;起疑 → 相信你是神明化身 → 悄悄告訴朋友
// 資料存在 world.traveler,存讀檔保留、新城鎮重來
const TRAVELER = (() => {
    const SUSPECT = 3, BELIEVE = 6;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const clip = (s, n) => (typeof clipText === 'function' ? clipText(String(s || '').trim(), n) : String(s || '').trim().slice(0, n));
    const mem = (w, a, k, p, imp, who) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, who || []); } catch (e) {} };
    function S(w) {
        if (!w.traveler || typeof w.traveler !== 'object') w.traveler = { said: {}, sus: {}, stage: {}, lastCard: -99 };
        const T = w.traveler; T.said = T.said || {}; T.sus = T.sus || {}; T.stage = T.stage || {}; return T;
    }
    // 越虔誠、越迷信越容易起疑;講求證據的人比較不信
    function piety(a) {
        const tr = a?.personality?.traits || []; let p = 1;
        if (a?.job?.key === 'priest') p *= 2; if (tr.includes('ascetic')) p *= 1.5; if (tr.includes('neurotic') || tr.includes('pessimist')) p *= 1.2;
        if (['doctor', 'researcher'].includes(a?.job?.key)) p *= 0.7; return p;
    }
    const stageOf = (w, a) => (a && w.traveler?.stage?.[a.agentId]) || 0; // 0 不知道 1 起疑 2 相信
    function bump(w, a, n) {
        const T = S(w), id = a.agentId; T.sus[id] = Math.min(12, (T.sus[id] || 0) + n * piety(a));
        const st = T.stage[id] || 0;
        if (st < 1 && T.sus[id] >= SUSPECT) {
            T.stage[id] = 1; mem(w, a, '那個路過的旅人不太尋常……他來過之後，鎮上總會發生怪事。', {}, 7);
            try { w.logMessageT?.('social', '🕯️ {a}開始覺得那個旅人不是普通人。', { a: a.name }, a.name); } catch (e) {}
        }
        if ((T.stage[id] || 0) < 2 && T.sus[id] >= BELIEVE) {
            T.stage[id] = 2; mem(w, a, '我相信那個旅人是神明化身，只是不能說破。', {}, 8);
            try { w.logMessageT?.('social', '🙏 {a}私下相信那個旅人是神明化身。', { a: a.name }, a.name); } catch (e) {}
            // 悄悄告訴最要好的一兩個人
            const rels = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 30 && w.agents[r.targetId] && !w.agents[r.targetId].isDead && !w.agents[r.targetId].isPlayer).sort((x, y) => y.affinity - x.affinity).slice(0, 2);
            for (const r of rels) { const o = w.agents[r.targetId]; mem(w, o, '{a}悄悄跟我說，那個路過的旅人可能是神明。', { a: a.name }, 6, [a.name]); bump(w, o, 1); }
        }
    }
    // 你跟村民說了一句話
    function onChat(w, npc, text) {
        if (!w?.observerMode || !npc || npc.isPlayer) return;
        const T = S(w), d = day(w), m = clip(text, 60); if (!m) return;
        const arr = T.said[npc.agentId] || (T.said[npc.agentId] = []); arr.push({ d, m, told: false, used: false }); if (arr.length > 3) arr.splice(0, arr.length - 3);
        mem(w, npc, '路過的旅人跟我說：「{m}」', { m }, 6);
        if (d - (T.lastCard ?? -99) <= 2) bump(w, npc, 0.5); // 怪事才剛發生,旅人就出現了
    }
    // 你打出一張事件卡(在村民眼裡是命運或神蹟)
    function onCard(w) {
        if (!w?.observerMode) return; const T = S(w), d = day(w); T.lastCard = d;
        for (const a of npcs(w)) { const said = T.said[a.agentId] || []; if (said.some(x => d - x.d <= 3)) bump(w, a, 1); }
    }
    function daily(w, P) {
        if (!w?.observerMode) return; const T = S(w), d = day(w);
        for (const [id, arr] of Object.entries(T.said)) {
            const a = w.agents[id]; if (!a || a.isDead) { delete T.said[id]; continue; }
            for (const x of arr) {
                // 轉述給朋友(走樣不大,但會傳開)
                if (!x.told && d - x.d <= 2 && Math.random() < 0.4) {
                    x.told = true; const r = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 20 && w.agents[r.targetId] && !w.agents[r.targetId].isDead && !w.agents[r.targetId].isPlayer).sort((p, q) => q.affinity - p.affinity)[0];
                    if (r) mem(w, w.agents[r.targetId], '{a}說那個路過的旅人跟他講過：「{m}」', { a: a.name, m: x.m }, 4, [a.name]);
                }
            }
            T.said[id] = arr.filter(x => d - x.d <= 10);
        }
        for (const id of Object.keys(T.sus)) if ((T.stage[id] || 0) < 2) { T.sus[id] = Math.max(0, T.sus[id] - 0.1); if (!T.sus[id]) delete T.sus[id]; }
        // 點化:聽了你的話的人,有機會據此向全鎮提案(只在完整智能體模式、AI 可用時)
        try {
            if (!P || !w.fullAgentMode || typeof FREEPROP === 'undefined' || !P._inventLLM || !w.conversationEngine?.fullAgentOk?.(w)) return;
            if (P.open().length >= ProposalSystem.MAX_OPEN) return;
            const cands = []; for (const [id, arr] of Object.entries(T.said)) for (const x of arr) if (!x.used && d - x.d <= 2 && w.agents[id] && !w.agents[id].isDead) cands.push([w.agents[id], x]);
            if (!cands.length || Math.random() > 0.3) return; const [a, x] = cands[Math.floor(Math.random() * cands.length)]; x.used = true;
            P._inventLLM(w, P._abs(w), a, () => {}, [{ title: t('路過的旅人跟你說過的話'), desc: x.m }]);
        } catch (e) { console.warn('[Traveler] nudge', e); }
    }
    // 給聊天 AI 的身分說明
    function persona(w, npc) {
        const st = stageOf(w, npc);
        let s = t('他是個時常路過小鎮的旅人，來去無蹤，不住在鎮上、也沒有官職，沒人知道他從哪裡來，用名字叫他就好。他說的話你會放在心上，但你有自己的判斷，不會照單全收。');
        if (st === 1) s += t('你隱約覺得他不是普通人：他來過之後，鎮上總會發生怪事。你對他有點好奇、有點敬畏，但不確定。');
        if (st === 2) s += t('你私下相信他是神明化身，對他又敬又畏，說話會小心，也許會想求他保佑；但你不會當眾說破。');
        return s;
    }
    function chip(w, a) { const st = stageOf(w, a); return st === 2 ? `🙏 ${t('相信旅人是神明')}` : st === 1 ? `🕯️ ${t('懷疑旅人不是凡人')}` : ''; }
    const believers = (w) => Object.entries(S(w).stage).filter(([id, s]) => s === 2 && w.agents[id] && !w.agents[id].isDead).length;
    return { S, onChat, onCard, daily, persona, chip, stageOf, believers, piety, SUSPECT, BELIEVE };
})();
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _gpr = CE.generatePlayerReply;
    CE.generatePlayerReply = async function (player, npc, msg, world, ...rest) { const r = await _gpr.call(this, player, npc, msg, world, ...rest); try { TRAVELER.onChat(world, npc, msg); } catch (e) {} return r; };
}
if (typeof EventCardSystem !== 'undefined') {
    const _play = EventCardSystem.prototype.play;
    EventCardSystem.prototype.play = function (w, id, ...rest) { const r = _play.call(this, w, id, ...rest); try { if (r && r.ok !== false) TRAVELER.onCard(w); } catch (e) {} return r; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { const d = this._abs(w); if (w.observerMode && this._travDay !== d) { this._travDay = d; TRAVELER.daily(w, this); } } catch (e) { console.warn('[Traveler] daily', e); } return r; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.traveler = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.traveler) d.traveler = this.traveler; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.traveler = (data?.traveler && typeof data.traveler === 'object') ? data.traveler : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.TRAVELER = TRAVELER;
