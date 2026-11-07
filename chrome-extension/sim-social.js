// v6.88.0 社交距離與遺忘
// - 圈層(Dunbar):家人伴侶 → 內圈(約 5)→ 好友(約 15)→ 朋友(約 50)→ 點頭之交(最多約 150)
// - 遺忘曲線:沒互動的關係慢慢淡掉,越外圈淡得越快;家人伴侶不忘;記仇比記恩久(負面偏誤);淡到沒意義就整段忘掉
// - 二度:朋友的朋友只「聽某某說過」,不建完整關係;三度以外就是陌生人
// - 傳聞走距離:八卦多半講自己圈子裡的人,每多傳一手就更不可信,傳太多手就沒人再講
// - 記憶跟著距離淡:只跟遠的人(或忘掉的人)有關的小事,重要度慢慢下降,最後被忘掉
const SOCIAL = (() => {
    const DAY = 96;
    const CAPS = [Infinity, 5, 15, 50, 150];          // 0 家人伴侶 1 內圈 2 好友 3 朋友 4 點頭之交
    const NEED = [0, 60, 35, 15, 0];                    // 進到這一圈至少要多深的交情
    const GRACE = [Infinity, 20, 12, 7, 4];             // 幾天沒來往才開始淡
    const RATE = [0, 0.15, 0.35, 0.6, 1.0];             // 每天淡多少(好感／信任往 0 回落)
    const NAMES = ['家人', '內圈', '好友', '朋友', '點頭之交'];
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / DAY));
    const S = (w) => { if (!w.social || typeof w.social !== 'object') w.social = { lastDay: null, forgot: 0 }; return w.social; };
    const isFam = (w, a, r) => !!r && (r.status === 'married' || r.status === 'dating' || (a._parentNames || []).includes(r.targetName) || ((w.agents?.[r.targetId]?._parentNames) || []).includes(a.name));
    const bond = (r) => Math.abs(r.affinity || 0) + Math.abs(r.trust || 0) * 0.5 + (r.romanticInterest || 0) * 0.5 + Math.min(20, r.interactionCount || 0) + (r.isFeud ? 30 : 0);
    const faded = (r) => !r.status && !r.isFeud && !r.isCheating && Math.abs(r.affinity || 0) < 3 && Math.abs(r.trust || 0) < 3 && !((r.romanticInterest || 0) > 5);
    const toward0 = (v, d) => (v > 0 ? Math.max(0, v - d) : Math.min(0, v + d));

    // ---------- 圈層 ----------
    const _cache = new WeakMap();
    function circles(w, a, fresh) {
        const R = a?.relationships?.relationships; if (!R) return new Map();
        const key = day(w) + ':' + Object.keys(R).length;
        const c = _cache.get(a); if (!fresh && c && c.key === key) return c.map;
        const map = new Map(); const rest = [];
        for (const id in R) { if (id === 'player') continue; const r = R[id]; if (isFam(w, a, r)) map.set(id, 0); else if (!faded(r)) rest.push([id, bond(r)]); }
        rest.sort((x, y) => y[1] - x[1]);
        const n = [0, 0, 0, 0, 0];
        for (const [id, b] of rest) { let k = 1; while (k < 4 && (b < NEED[k] || n[k] >= CAPS[k])) k++; if (k === 4 && n[4] >= CAPS[4]) continue; n[k]++; map.set(id, k); }
        _cache.set(a, { key, map });
        return map;
    }
    const circleOf = (w, a, id) => { const v = circles(w, a).get(id); return v === undefined ? null : v; };
    const circleName = (k) => (k === null || k === undefined) ? '' : t(NAMES[k]);
    function counts(w, a) { const n = [0, 0, 0, 0, 0]; for (const k of circles(w, a).values()) n[k]++; return n; }

    // ---------- 二度、三度 ----------
    // 朋友(含家人)裡有人跟對方有交情 → 聽說過;回傳是聽誰說的、那個人對他的印象
    // 常來往的人(朋友圈以內、不是處不來的人)都會跟你聊到別人
    const talksWith = (w, a, id, r) => { if (isFam(w, a, r)) return true; if ((r.affinity || 0) < -10) return false; const k = circleOf(w, a, id); return k !== null && k <= 3; };
    function heardOf(w, a, targetId) {
        const R = a?.relationships?.relationships; if (!R || !targetId) return null; let best = null;
        for (const id in R) {
            if (id === targetId || id === 'player') continue; const r = R[id];
            if (!talksWith(w, a, id, r)) continue;
            const f = w.agents?.[id]; const fr = f?.relationships?.relationships?.[targetId]; if (!fr || faded(fr)) continue;
            const s = bond(fr) + (r.affinity || 0) * 0.3; if (!best || s > best.s) best = { via: f, s, aff: fr.affinity || 0 };
        }
        return best;
    }
    function distance(w, a, b) {
        if (!a || !b) return Infinity; if (a === b) return 0;
        const r = a.relationships?.relationships?.[b.agentId]; if (r && (!faded(r) || isFam(w, a, r))) return 1;
        if (heardOf(w, a, b.agentId)) return 2;
        const R = a.relationships?.relationships || {};
        for (const id in R) { const x = R[id]; if (!talksWith(w, a, id, x)) continue; const f = w.agents?.[id]; if (f && heardOf(w, f, b.agentId)) return 3; }
        return Infinity;
    }
    const impression = (aff) => aff > 20 ? t('人不錯') : aff < -20 ? t('不怎麼樣') : t('普普通通');
    // 給 AI 的一句話:認識的人寫圈層,聽說過的寫聽誰說,遠的就不認識
    function relLine(w, a, b) {
        const d = distance(w, a, b);
        if (d === 1) { const k = circleOf(w, a, b.agentId); return k === null ? '' : t('（{c}）').replace('{c}', circleName(k)); }
        if (d === 2) { const h = heardOf(w, a, b.agentId); return t('你跟{b}不熟，只聽{via}說過這個人（{via}覺得{b}{imp}）。').split('{b}').join(t(b.name)).split('{via}').join(t(h.via.name)).replace('{imp}', impression(h.aff)); }
        if (d === 3) return t('你不認識{b}，只隱約聽人提過這個名字。').split('{b}').join(t(b.name));
        return t('你不認識{b}，也沒聽人提過。').split('{b}').join(t(b.name));
    }

    // ---------- 每天:遺忘 ----------
    function daily(w) {
        const st = S(w), d = day(w); if (st.lastDay === d) return; st.lastDay = d;
        const now = w.tickCount || 0; let forgot = 0;
        for (const a of npcs(w)) {
            const R = a.relationships?.relationships; if (!R) continue;
            const C = circles(w, a, true);
            for (const id in R) {
                if (id === 'player') continue; const r = R[id];
                if (!r.lastInteractionTick) { r.lastInteractionTick = now || 1; continue; } // 舊檔沒記互動時間:從今天開始算
                const k = C.has(id) ? C.get(id) : 4; if (k === 0) continue;   // 家人伴侶不忘
                const idle = (now - r.lastInteractionTick) / DAY; if (idle < GRACE[k]) continue;
                const neg = (r.affinity || 0) < 0 ? (r.isFeud ? 0.3 : 0.5) : 1; // 記仇比記恩久
                const rate = RATE[k] * (C.has(id) ? 1 : 2);
                r.affinity = Math.round(toward0(r.affinity || 0, rate * neg) * 100) / 100;
                r.trust = Math.round(toward0(r.trust || 0, rate * 0.7 * neg) * 100) / 100;
                if ((r.romanticInterest || 0) > 0 && !r.status) r.romanticInterest = Math.max(0, Math.round((r.romanticInterest - rate * 0.5) * 100) / 100);
                if (faded(r) && idle > GRACE[k] * 3) { delete R[id]; forgot++; }
            }
            // 超過 150 段(Dunbar):最淡的那些想不起來了
            const ids = Object.keys(R).filter(id => id !== 'player' && !isFam(w, a, R[id]));
            if (ids.length > CAPS[4]) { ids.sort((x, y) => bond(R[y]) - bond(R[x])); for (const id of ids.slice(CAPS[4])) { delete R[id]; forgot++; } }
            fadeMemories(w, a, d, now);
        }
        st.forgot = (st.forgot || 0) + forgot;
    }
    // 只跟遠的人(或已經忘掉的人)有關的小事慢慢淡掉;重要的事(7 以上)、跟家人摯友有關的事不淡
    function fadeMemories(w, a, d, now) {
        const m = a.memory; if (!m || !m.entries?.length) return;
        const R = a.relationships?.relationships || {}; const C = circles(w, a);
        const close = new Set([a.name]); for (const id in R) { const k = C.get(id); if (k !== undefined && k <= 2) close.add(R[id].targetName); }
        let drop = false;
        for (const e of m.entries) {
            if ((e.importance || 0) >= 7) continue; const ra = e.relatedAgents || []; if (!ra.length) continue;
            if (ra.some(n => close.has(n))) continue;
            if ((now - (e.tick || 0)) / DAY < 10) continue;
            if (e._fd === undefined) { e._fd = d; continue; }
            if (d - e._fd >= 10) { e.importance = Math.max(0, (e.importance || 0) - 1); e._fd = d; if (e.importance <= 0) drop = true; }
        }
        if (drop) m.entries = m.entries.filter(e => (e.importance || 0) > 0 || (now - (e.tick || 0)) / DAY < 20 || !(e.relatedAgents || []).length);
    }
    // 八卦:講的人跟當事人越遠越不會講;傳太多手就沒人講了
    const GOSSIP_DIE = 6;
    function gossipOk(w, speaker, g) {
        if ((g.spreadCount || 0) >= GOSSIP_DIE) return false;
        const subj = Object.values(w.agents || {}).find(x => x.name === g.about); if (!subj) return true;
        const r = speaker.relationships?.relationships?.[subj.agentId];
        return (r && !faded(r)) || !!heardOf(w, speaker, subj.agentId) || Math.random() < 0.15;
    }
    function view(w, a) { const n = counts(w, a); return { family: n[0], inner: n[1], good: n[2], friends: n[3], acquaint: n[4] }; }
    return { CAPS, NAMES, circles, circleOf, circleName, counts, heardOf, distance, relLine, impression, daily, fadeMemories, gossipOk, faded, bond, isFam, view, S, GOSSIP_DIE };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { SOCIAL.daily(w); } catch (e) { console.warn('[Social] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    // AI 決策資料:對方是誰、多熟(認識的寫圈層,聽說過的寫聽誰說,遠的就不認識)
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) {
        const b = _ab.call(this, world, a, other);
        try { if (other && other.agentId !== a.agentId && !other.isPlayer) { const line = SOCIAL.relLine(world, a, other); if (line) b.rel = SOCIAL.distance(world, a, other) === 1 ? `${b.rel || ''}${line}` : line; } } catch (e) {}
        return b;
    };
    // NPC 之間的 AI 對話:不認識的人只寫聽誰說過
    const _lc = CE._llmConversation;
    if (_lc) CE._llmConversation = async function (agentA, agentB, world, relA, relB) { this._socialCtx = { world, a: agentA, b: agentB }; try { return await _lc.call(this, agentA, agentB, world, relA, relB); } finally { this._socialCtx = null; } };
    const _rc = CE._buildRelContext;
    if (_rc) CE._buildRelContext = function (rel, otherName) {
        let s = _rc.call(this, rel, otherName);
        try {
            const c = this._socialCtx; if (!c || !rel) return s;
            const owner = rel.targetId === c.b.agentId ? c.a : rel.targetId === c.a.agentId ? c.b : null; const other = owner === c.a ? c.b : c.a; if (!owner) return s;
            if (!(rel.interactionCount > 0) && SOCIAL.faded(rel)) s += '\n' + SOCIAL.relLine(c.world, owner, other); else { const k = SOCIAL.circleOf(c.world, owner, other.agentId); if (k !== null) s += t('（{c}）').replace('{c}', SOCIAL.circleName(k)); }
        } catch (e) {}
        return s;
    };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.social = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.social) d.social = { lastDay: this.social.lastDay, forgot: this.social.forgot || 0 }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.social = (data?.social && typeof data.social === 'object') ? { ...data.social } : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.SOCIAL = SOCIAL;
