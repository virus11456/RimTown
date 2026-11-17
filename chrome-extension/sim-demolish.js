// v10.6.0 蓋出來的東西可以表決拆掉
// 10.4.0 盤點時留下一格：建設、工廠、產業蓋了就是永久的，沒有任何辦法拿掉。規定可以廢除、判決可以赦免，建築也該能拆。
// 一樣是一般提案（全鎮投票 → 大事送議會 → 首長裁決），不另立機制：
//   拆什麼：鎮上蓋好的建築（含升級）、工廠、產業。這三樣都是公家的（私人的店歇業走原本的「勒令歇業／禁止」）。
//   拆掉以後：效果跟著消失、不再付維護費、回收三成建材；工廠倉庫裡的貨歸公庫、工人回去做原本的事。之後想要可以再提案蓋回來。
//   誰會提：完整智能體模式下村民自己想提就提（題目裡列得出可以拆的東西）；沒開的話，公庫連續幾天見底、又養著一堆建築時，節儉的人會提拆掉最花錢的那一棟
//   怎麼投：多數人捨不得（維持現狀佔便宜）；靠它吃飯的人反對；公庫見底時在意錢的人贊成；提的人和他的朋友贊成
//   限制只擋洗版：同時只有一件拆除案、同一棟被否決後 20 天內不再提、剛蓋好 20 天內不提、產業至少留一個
// v11.6.0 多一種：小店收掉後留下的空店面（sim-biz.js），空滿 30 天可以提案拆掉；通過後攤位從地圖上移除、那一格還給空地
const DEMOLISH = (() => {
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const tr = (s) => { try { return t(s); } catch (e) { return String(s || ''); } };
    const has = (a, x) => (a?.personality?.traits || []).includes(x);
    const adults = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who || ''); } catch (e) {} };
    const SALVAGE = 0.3, NEW = 20, RETRY = 20, GAP = 30, POOR = 5, AIGAP = 5;
    const BIG = ['town_walls', 'clock_tower', 'aqueduct', 'press', 'bank', 'hospital', 'council_hall', 'observatory', 'theater', 'sewers', 'barracks', 'caravanserai']; // 跟維護費那邊同一張表
    function S(w) { if (!w.demolish || typeof w.demolish !== 'object') w.demolish = { seen: {}, last: {}, done: [], lastAny: -99, poor: 0 }; const D = w.demolish; D.seen = D.seen || {}; D.last = D.last || {}; D.done = D.done || []; if (!Number.isFinite(D.lastAny)) D.lastAny = -99; D.poor = D.poor || 0; return D; }
    const resName = (r) => { try { return (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[r]) ? SHOP_ITEMS[r].name() : tr(r); } catch (e) { return String(r); } };
    const busy = (w) => (w.proposals?.items || []).some(p => p.kind === 'demolish' && ['open', 'shelved', 'approved'].includes(p.status));

    // ---------- 鎮上可以拆的東西 ----------
    // 每樣：{ id, kind: 'b'|'f'|'i', key, name, icon, upkeep, costs, jobs }
    function list(w) {
        const out = []; const D = S(w); const d = day(w);
        const upg = new Set((w.buildings?.projects || []).filter(p => p.upgradeKey).map(p => p.upgradeKey));
        for (const b of w.buildings?.completed || []) {
            const key = b.buildingKey || b.id; if (!key || upg.has(b.buildingKey)) continue; // 正在升級的先不拆
            out.push({ id: 'b:' + key, kind: 'b', key, name: b.name, icon: '🏛️', level: b.level || 1, upkeep: (BIG.includes(b.buildingKey) ? 4 : 2) * (b.level || 1), costs: b.costs || (typeof BUILDING_TEMPLATES !== 'undefined' ? BUILDING_TEMPLATES[b.buildingKey]?.costs : null) || {},
                jobs: Object.entries(typeof PROPOSAL_JOB_BUILDINGS !== 'undefined' ? PROPOSAL_JOB_BUILDINGS : {}).filter(([, v]) => v.includes(b.buildingKey)).map(([k]) => k) });
        }
        try { if (typeof FACTORIES !== 'undefined') for (const [k, f] of Object.entries(w.processing?.builtFactories || {})) { const F = FACTORIES[k]; if (!F || f.status !== 'active') continue; out.push({ id: 'f:' + k, kind: 'f', key: k, name: F.name, icon: F.icon || '🏭', level: 1, upkeep: 0, costs: F.cost || {}, jobs: F.preferredJob ? [F.preferredJob] : [], workers: (f.workers || []).slice() }); } } catch (e) {}
        try { if (typeof INDUSTRIES !== 'undefined') { const ks = Object.keys(w.industry?.industries || {}); if (ks.length > 1) for (const k of ks) { const I = INDUSTRIES[k]; if (!I) continue; out.push({ id: 'i:' + k, kind: 'i', key: k, name: I.name, icon: I.icon || '🏭', level: w.industry.industries[k].level || 1, upkeep: 0, costs: {}, jobs: [], workers: (w.industry.industries[k].workers || []).slice() }); } } } catch (e) {} // 產業至少留一個
        for (const x of out) { if (D.seen[x.id] === undefined) D.seen[x.id] = d; x.age = d - D.seen[x.id]; }
        try { if (typeof BIZ !== 'undefined' && BIZ.demoList) out.push(...BIZ.demoList(w)); } catch (e) {} // v11.6.0 空店面（age＝空了幾天）
        for (const k of Object.keys(D.seen)) if (!out.some(x => x.id === k)) delete D.seen[k];
        return out;
    }
    const get = (w, id) => list(w).find(x => x.id === id) || null;
    // 現在能不能提拆這一樣（ai＝智能體：不看「剛蓋好」以外的等待）
    function okNow(w, x, ai) { const D = S(w); const d = day(w); if (!x || busy(w)) return false; if (x.age < (x.kind === 'p' ? (typeof BIZ !== 'undefined' ? BIZ.IDLE_DEMO : 30) : (ai ? AIGAP : NEW))) return false; return d - (D.last[x.id] ?? -999) >= (ai ? AIGAP : RETRY); } // 空店面要空滿 30 天才能提
    // 拆掉會少什麼（給提案說明用）
    function lossText(w, x) {
        if (x.kind === 'b') { const b = (w.buildings?.completed || []).find(o => (o.buildingKey || o.id) === x.key); const eff = Object.keys(b?.effects || {}).length; return eff ? tr('它帶來的好處會跟著消失') : tr('鎮上會少一棟建築'); }
        if (x.kind === 'f') return tr('裡面做的加工品就沒有了，倉庫裡的貨歸公庫');
        if (x.kind === 'p') return tr('那一格還給空地，之後想開店的人得花 60 銀幣蓋新的');
        return tr('這一行的產出就沒有了，做這行的人得另外找事做');
    }
    function propose(w, id, who, why) {
        const x = get(w, id); if (!x || typeof TECH === 'undefined' || !who || busy(w)) return null; const D = S(w); const d = day(w);
        const p = TECH.propose(w, 'demolish', id, who, '拆除{b}', '{who}提議把{b}拆掉。{why}拆掉以後：{loss}；回收三成建材{up}。之後想要，可以再提案蓋回來。',
            { b: x.name, why: why || '', loss: lossText(w, x), up: x.upkeep ? tr('，每天省下 {n} 銀幣的維護費').replace('{n}', x.upkeep) : '' }, 'economy', { b: x.name });
        if (p) { D.last[id] = d; D.lastAny = d; }
        return p;
    }
    // ---------- 投票（沒有 AI 時） ----------
    function vote(w, p, a) {
        const x = get(w, p.refKey); if (!x) return { v: 'against', why: 'demolish_keep' };
        if (x.kind === 'p' && typeof BIZ !== 'undefined' && BIZ.demoVote) return BIZ.demoVote(w, p, a, x); // v11.6.0 空店面：住附近、愛整潔的想拆，想開店的捨不得
        if (a.agentId === p.proposerId) return { v: 'for', why: 'demolish_mine' };
        const works = (x.workers || []).includes(a.agentId) || x.jobs.includes(a.job?.key);
        const silver = w.stockpile?.get?.('silver') || 0; const broke = silver < 30 && x.upkeep > 0;
        const rel = (a.relationships?.relationships?.[p.proposerId]?.affinity || 0) / 40;
        let s = -0.8 + rel + (Math.random() - 0.5) * 2; // 多數人捨不得：東西在那裡就是好的
        if (works) s -= 2.5;
        if (broke) s += 1 + (has(a, 'greedy') || has(a, 'ascetic') || has(a, 'perfectionist') ? 0.8 : 0);
        if (x.kind !== 'b' && (has(a, 'nature_lover') || (a.personality?.values || []).includes('nature'))) s += 0.8;
        const why = s > 0 ? (broke ? 'demolish_cost' : rel >= 0.75 ? 'demolish_friend' : 'demolish_fine') : (works ? 'demolish_work' : rel <= -0.75 ? 'demolish_foe' : 'demolish_keep');
        return { v: s > 0 ? 'for' : 'against', why };
    }
    // ---------- 通過：真的拆 ----------
    function enact(w, p) {
        const x = get(w, p?.refKey); if (!x) return ''; const D = S(w); const d = day(w); const sp = w.stockpile; const got = [];
        const back = (costs, lv) => { for (const [r, n] of Object.entries(costs || {})) { if (r === 'silver') continue; const k = Math.floor(n * SALVAGE * (lv || 1)); if (k > 0) { try { sp.add(r, k, w.tickCount, tr('拆除回收'), 'demolish'); got.push(`${resName(r)} ${k}`); } catch (e) {} } } };
        if (x.kind === 'b') {
            const B = w.buildings; const i = B.completed.findIndex(o => (o.buildingKey || o.id) === x.key); if (i < 0) return '';
            B.projects = (B.projects || []).filter(o => o.upgradeKey !== x.key); B.completed.splice(i, 1); back(x.costs, 1);
            try { B.recomputeEffects(w); } catch (e) { console.warn('[Demolish] effects', e); } try { w.checkCombos?.(); } catch (e) {}
        } else if (x.kind === 'f') {
            const f = w.processing.builtFactories[x.key]; if (!f) return '';
            for (const [r, n] of Object.entries(f.warehouse || {})) { if (n > 0) { try { sp.add(r, n, w.tickCount, tr('工廠倉庫'), 'demolish'); } catch (e) {} } }
            delete w.processing.builtFactories[x.key]; back(x.costs, 1);
        } else if (x.kind === 'p') {
            if (typeof BIZ === 'undefined' || !BIZ.demoEnact(w, x.key)) return '';
        } else {
            if (Object.keys(w.industry.industries).length <= 1 || !w.industry.industries[x.key]) return '';
            delete w.industry.industries[x.key]; if (w.industry.firstChoice === x.key) w.industry.firstChoice = Object.keys(w.industry.industries)[0] || null; try { w.industry._updateSynergies?.(); } catch (e) {} w.industry._pendingUnlock = true; // 空出來的位置之後可以再提案開別的產業
        }
        delete D.seen[x.id]; D.done.push({ id: x.id, name: x.name, d, by: p.proposerName || '' }); if (D.done.length > 8) D.done.splice(0, D.done.length - 8);
        log(w, '🏚️ 小鎮表決拆掉了{b}。', { b: x.name }); try { w.dailyNews?.collectEvent?.('building', `${tr('小鎮表決拆掉了')}${tr(x.name)}`, 7); } catch (e) {}
        // 靠它吃飯的人不好受；提的人記得這件事
        for (const a of adults(w)) { if ((x.workers || []).includes(a.agentId) || x.jobs.includes(a.job?.key)) { a.moodModifier = (a.moodModifier || 0) - 6; try { a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '{b}被拆掉了，我做事的地方沒了。', { b: x.name }, 7, []); } catch (e) {} } }
        return got.length ? tr('拆掉了，回收了{x}').replace('{x}', got.join(tr('、'))) : tr('拆掉了');
    }
    // ---------- 沒開智能體：公庫連續見底、又養著建築 → 節儉的人提拆最花錢的那一棟 ----------
    function daily(w) {
        const D = S(w); const d = day(w); if (D.lastDay === d) return; D.lastDay = d; const L = list(w);
        const silver = w.stockpile?.get?.('silver') || 0; const up = L.reduce((s, x) => s + x.upkeep, 0);
        D.poor = (silver < 20 && up >= 6) ? D.poor + 1 : 0;
        if (w.fullAgentMode || D.poor < POOR || d - D.lastAny < GAP || busy(w)) return;
        const pick = L.filter(x => x.kind === 'b' && okNow(w, x, false)).sort((a, b) => b.upkeep - a.upkeep)[0]; if (!pick) return;
        const A = adults(w).filter(a => !pick.jobs.includes(a.job?.key)); const who = A.find(a => has(a, 'ascetic') || has(a, 'greedy') || has(a, 'perfectionist')) || A[0]; if (!who) return;
        propose(w, pick.id, who, tr('公庫已經見底好幾天，還得天天付它的維護費。'));
    }
    // ---------- 給 AI：可以拆的東西、拆除的效果 ----------
    function promptParts(w) {
        if (busy(w)) return { ctx: '', fx: '' };
        const L = list(w).filter(x => okNow(w, x, true)).sort((a, b) => b.upkeep - a.upkeep).slice(0, 10); if (!L.length) return { ctx: '', fx: '' };
        const ctx = `${tr('【可以拆掉的（拆掉以後好處跟著消失、回收三成建材、不再付維護費；之後想要可以再蓋）】')}${L.map(x => `${x.id}${tr('＝')}${tr(x.name)}${x.upkeep ? tr('（每天維護 {n} 銀幣）').replace('{n}', x.upkeep) : ''}`).join(tr('、'))}\n`;
        const fx = `{"type":"demolish","key":"${tr('上面「可以拆掉的」的代碼')}"}${tr('（把鎮上一棟建築、工廠或產業拆掉。這是大事，多數人捨不得，要有說得過去的理由）')}\n`;
        return { ctx, fx };
    }
    function fromAI(w, a, j) {
        const e = (Array.isArray(j?.effects) ? j.effects : []).find(o => String(o?.type || '').toLowerCase() === 'demolish'); if (!e) return null;
        const L = list(w); const key = String(e.key || '').trim(); const x = L.find(o => o.id === key) || L.find(o => o.key === key) || L.find(o => tr(o.name) === key || o.name === key);
        if (!x || !okNow(w, x, true)) return null;
        return propose(w, x.id, a, '');
    }
    const view = (w) => ({ list: list(w).map(x => ({ id: x.id, name: tr(x.name), icon: x.icon, upkeep: x.upkeep, age: x.age })), done: S(w).done.slice().reverse().map(x => ({ name: tr(x.name), ago: day(w) - x.d, by: x.by })) });
    return { S, list, get, okNow, propose, vote, enact, daily, promptParts, fromAI, view, SALVAGE, NEW, RETRY, GAP, POOR, AIGAP };
})();
if (typeof globalThis !== 'undefined') globalThis.DEMOLISH = DEMOLISH;

// ---- 掛勾 ----
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.demolish = { icon: '🏚️', label: '拆除' };
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { demolish_keep: '捨不得，東西在那裡就是好的', demolish_work: '那是我做事的地方', demolish_cost: '公庫養不起了', demolish_fine: '覺得用不到了', demolish_friend: '跟提的人交情好', demolish_foe: '跟提的人處不來', demolish_mine: '這是我提的', demolish_eyesore: '空店面擺著難看', demolish_spare: '留著說不定有人會再來開店' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { DEMOLISH.daily(w); } catch (e) { console.warn('[Demolish] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'demolish') { const r = DEMOLISH.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.demolish = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.demolish) d.demolish = this.demolish; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.demolish = (data?.demolish && typeof data.demolish === 'object') ? data.demolish : null; } catch (e) {} return r; };
}
