// v6.55.0 大人口(人一多也不卡、存檔不爆、AI 額度夠用)
// - 人多(40 人以上)時:每天清掉「點頭之交」的空白關係、每人最多留 40 段最在乎的關係;非重要人物的記憶留 60 筆(重要的優先)
// - 存檔也照同一套規則精簡(存讀檔前後一致)
// - 人非常多(100 人以上)時:只有「重要人物」(官員、議員、候選人、富商、名人、提案人、你跟拍的人)用 AI 對話和 AI 行程,其他人照規則過日子
const CROWD = (() => {
    const TRIM_AT = 40, AI_AT = 100, REL_CAP = 40, MEM_CAP = 60;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const pop = (w) => npcs(w).length;
    // 一段關係值不值得記:有身分(交往／婚姻／前任)、有過節、交情或信任明顯、有暗戀、互動過兩次以上、有共同回憶
    const relScore = (r) => (r.status ? 1000 : 0) + (r.isFeud ? 500 : 0) + (r.isCheating ? 300 : 0) + Math.abs(r.affinity || 0) + Math.abs(r.trust || 0) * 0.5 + (r.romanticInterest || 0) + Math.min(30, r.interactionCount || 0) + ((r.sharedMemories || []).length ? 5 : 0);
    const trivial = (r) => !r.status && !r.isFeud && !r.isCheating && Math.abs(r.affinity || 0) < 5 && Math.abs(r.trust || 0) < 5 && !(r.romanticInterest > 0) && (r.interactionCount || 0) < 2 && !(r.sharedMemories || []).length;
    // 要留下的關係(依重要度排序,最多 REL_CAP 段);人少時全部留
    function keepRels(w, a) {
        const all = Object.entries(a.relationships?.relationships || {});
        if (pop(w) < TRIM_AT) return all;
        return all.filter(([, r]) => !trivial(r)).sort((x, y) => relScore(y[1]) - relScore(x[1])).slice(0, REL_CAP);
    }
    let _nCache = null, _nKey = '';
    // 重要人物名單(每遊戲小時重算一次)
    function notable(w) {
        const key = (w.tickCount >> 2) + ':' + pop(w);
        if (_nCache && _nKey === key && _nCache.w === w) return _nCache.set;
        const set = new Set(); const add = (a) => { if (a && a.agentId) set.add(a.agentId); };
        try { add(w.election?.currentMayor?.(w)); } catch (e) {}
        for (const id of (w.council?.members || [])) set.add(id);
        for (const c of (w.election?.candidates || [])) if (c.agentId && c.agentId !== 'player') set.add(c.agentId);
        const all = npcs(w);
        for (const a of all) if (a.job?.key === 'mayor' || a.job?.key === 'priest') add(a);
        try { if (typeof WALLET !== 'undefined' && w.wallet) all.slice().sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x)).slice(0, 6).forEach(add); } catch (e) {}
        try { const R = w.dark?.rep || {}; all.filter(a => R[a.agentId]).sort((x, y) => Object.values(R[y.agentId]).reduce((s, n) => s + n, 0) - Object.values(R[x.agentId]).reduce((s, n) => s + n, 0)).slice(0, 6).forEach(add); } catch (e) {}
        for (const p of (w.proposals?.items || [])) if (p.status === 'open' || p.status === 'shelved' || p.status === 'approved') set.add(p.proposerId);
        try { const app = typeof window !== 'undefined' && window.rimtownApp; const f = app?.tileMap?._followAgent; if (f) set.add(f); if (app?.selectedAgent) set.add(app.selectedAgent); } catch (e) {}
        _nCache = { w, set }; _nKey = key; return set;
    }
    const isNotable = (w, a) => !!a && notable(w).has(a.agentId);
    const aiCrowded = (w) => pop(w) >= AI_AT;
    // 每天:清空白關係、限關係數、限非重要人物的記憶數
    function daily(w) {
        if (pop(w) < TRIM_AT) return;
        const N = notable(w);
        for (const a of npcs(w)) {
            const rm = a.relationships?.relationships; if (rm) { const keep = new Set(keepRels(w, a).map(([k]) => k)); for (const k of Object.keys(rm)) if (!keep.has(k)) delete rm[k]; }
            const m = a.memory; if (!m || N.has(a.agentId) || m.entries.length <= MEM_CAP) continue;
            // 重要的(重要度 7 以上)優先留,其餘留最近的
            const imp = m.entries.filter(e => (e.importance || 0) >= 7).slice(-Math.floor(MEM_CAP / 2));
            const impSet = new Set(imp); const rest = m.entries.filter(e => !impSet.has(e)).slice(-(MEM_CAP - imp.length));
            const keep = new Set([...imp, ...rest]); m.entries = m.entries.filter(e => keep.has(e));
        }
    }
    return { TRIM_AT, AI_AT, REL_CAP, MEM_CAP, pop, notable, isNotable, aiCrowded, keepRels, daily, relScore, trivial };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) {
        const r = _daily.call(this, w, ...rest);
        try { const d = this._abs(w); if (this._crowdDay !== d) { this._crowdDay = d; CROWD.daily(w); } } catch (e) { console.warn('[Crowd] daily', e); }
        return r;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    // 人非常多時,兩個路人的閒聊用規則版;至少一方是重要人物才用 AI
    const _allowed = CE._npcLlmAllowed;
    CE._npcLlmAllowed = function (world, a, b) {
        if (CROWD.aiCrowded(world) && !CROWD.isNotable(world, a) && !CROWD.isNotable(world, b)) return false;
        return _allowed.call(this, world, a, b);
    };
    // 人非常多時,AI 行程只排重要人物(其他人照規則行程)
    const _queue = CE.queueDailyPlans;
    CE.queueDailyPlans = function (world) {
        const r = _queue.call(this, world);
        try { if (CROWD.aiCrowded(world) && Array.isArray(this._planQueue)) { const N = CROWD.notable(world); this._planQueue = this._planQueue.filter(id => N.has(id)); } } catch (e) {}
        return r;
    };
}
if (typeof globalThis !== 'undefined') globalThis.CROWD = CROWD;
