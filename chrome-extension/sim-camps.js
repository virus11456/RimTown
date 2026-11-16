// v11.0.0 市場與第四權（第一段）之六：政治陣營
// - 不憑空發兩個黨下去。陣營自己長出來：首長、議員、官員、候選人裡，
//   收了東家的錢或自己開店的，是「東家這一邊」；工會的人、出過事的人、提過管店家的案子或對官員有氣的人，是「街坊這一邊」。
//   分數不夠明顯的人兩邊都不是。每週重算一次。
// - 一邊滿兩個人就成形，由裡頭資歷最深的人從幾個名字裡挑一個（campName）。完全自由取名與黨魁、黨紀留到第三段的政黨。
// - 陣營影響三件事：管店家的規定與審判怎麼投、任命官員時挺不挺自己人、選舉時「管不管商人」這個立場吸引哪些選民。
// 必須在 sim-unrest.js 之後載入。
'use strict';
const CAMPS = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined') return null;
    const SIDES = ['biz', 'folk'];
    const NAMES = {
        biz: [['商會派', 'Merchants\' Bloc'], ['興業會', 'Prosperity Club'], ['市場派', 'Market Faction'], ['東家聯誼會', 'Owners\' Circle'], ['安定會', 'Steady Hands']],
        folk: [['街坊會', 'Neighbours\' League'], ['公道會', 'Fair Deal Society'], ['百工盟', 'Working Hands'], ['清流社', 'Clean Stream'], ['問政會', 'Open Books Club']],
    };
    const DEALK = ['deal_cap', 'deal_check', 'deal_cartel', 'deal_trial'];
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const REF = 1, G = 'deal';
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const live = (w, id) => { const a = w.agents[id]; return a && !a.isDead ? a : null; };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'politics', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('politics', k, p || {}, who || ''); } catch (e) {} };
    const mayor = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w); } catch (e) { return false; } };
    const owner = (w, a) => DEAL.firmsOf(w, a.agentId).length > 0;
    function S(w) {
        if (!w.camps || typeof w.camps !== 'object') w.camps = { biz: { name: null, lead: null, since: null, m: [] }, folk: { name: null, lead: null, since: null, m: [] }, built: null, lastDay: null, st: { formed: 0, named: 0, votes: 0 } };
        const C = w.camps; for (const s of SIDES) { C[s] = C[s] || { name: null, lead: null, since: null, m: [] }; C[s].m = C[s].m || []; } C.st = C.st || {}; return C;
    }
    // 檯面上的人：首長、議員、官員、正在選的候選人
    function pols(w) {
        const out = new Map(); const add = (a) => { if (a && !a.isDead && !a.isPlayer) out.set(a.agentId, a); };
        add(mayor(w)); try { for (const a of ASSEMBLY.seated(w)) add(a); } catch (e) {} try { for (const a of OFFICE.officials(w)) add(a); } catch (e) {}
        try { for (const c of (w.election?.candidates || [])) add(w.agents[c.agentId]); } catch (e) {}
        return [...out.values()];
    }
    // 一個人偏哪一邊的分數（不只政治人物，選民也用這個）
    function score(w, a) {
        let biz = 0, folk = 0; const D = DEAL.S(w); const id = a.agentId;
        if (owner(w, a)) biz += 2;
        try { const inf = POWER.S(w).inf[id] || {}; let n = 0; for (const [did, v] of Object.entries(inf)) { const dn = w.agents[did]; if (dn && owner(w, dn)) n += v; } biz += Math.min(3, n / 20); } catch (e) {}
        try { if (w.union?.on && w.union.members?.[id]) folk += 2; if (w.union?.leader === id) folk += 1; } catch (e) {}
        if (D.harm.some(h => h.id === id)) folk += 1;
        if ((D.reports || []).some(x => x.by === id) || (D.tips || []).some(x => x.by === id)) folk += 1;
        try { if (UNREST.angryAt(w, a)) folk += 1; } catch (e) {}
        for (const p of (w.proposals?.items || [])) { if (!DEALK.includes(p.kind)) continue; if (p.proposerId === id) folk += 1.5; const v = p.councilVotes?.[id] || p.votes?.[id]; if (p.kind !== 'deal_trial' && v === 'against') biz += 0.5; if (v === 'for') folk += 0.5; if (p.accused === id) biz += 1; }
        return { biz: Math.round(biz * 10) / 10, folk: Math.round(folk * 10) / 10 };
    }
    const sideOf = (sc) => (sc.biz >= 2 && sc.biz > sc.folk ? 'biz' : sc.folk >= 2 && sc.folk > sc.biz ? 'folk' : null);
    // 政治人物屬於哪一邊（照每週算好的名單）
    const side = (w, a) => { const C = w.camps; if (!C || !a) return null; return C.biz.m.includes(a.agentId) ? 'biz' : C.folk.m.includes(a.agentId) ? 'folk' : null; };
    // 一般人的傾向（選舉時用）：東家偏一邊，出過事、有氣、工會的人偏另一邊
    const lean = (w, a) => side(w, a) || sideOf(score(w, a));
    const nameOf = (w, s) => { const C = w.camps?.[s]; return C?.name ? C.name[0] : (s === 'biz' ? '東家這一邊' : '街坊這一邊'); };
    const senior = (w, list) => list.slice().sort((x, y) => ((mayor(w) === y ? 100 : 0) + (y.age ?? 30)) - ((mayor(w) === x ? 100 : 0) + (x.age ?? 30)))[0] || null;
    function rebuild(w) {
        const C = S(w), d = day(w); C.built = d; const ps = pols(w); const next = { biz: [], folk: [] };
        for (const a of ps) { const s = sideOf(score(w, a)); if (s) next[s].push(a); }
        for (const s of SIDES) {
            const X = C[s]; const was = X.m.length; X.m = next[s].map(a => a.agentId);
            if (X.m.length >= 2) {
                if (!X.since) { X.since = d; C.st.formed = (C.st.formed || 0) + 1; }
                if (!live(w, X.lead) || !X.m.includes(X.lead)) X.lead = senior(w, next[s])?.agentId || null;
                if (!X.name && X.lead && !X.asked) { X.asked = d; DECIDE.enqueue(w, w.agents[X.lead], 'campName', { side: s }); }
            } else if (was >= 2 && X.m.length < 2) { X.since = null; X.lead = X.m[0] || null; }
        }
        return C;
    }
    function setName(w, s, pair, by) {
        const C = S(w); const X = C[s]; if (!X || X.name) return false; X.name = pair.slice(0, 2); C.st.named = (C.st.named || 0) + 1; try { I18N.registerName(pair[0], pair[1]); } catch (e) {}
        const ms = X.m.map(id => live(w, id)).filter(Boolean); for (const a of ms) mem(w, a, '我們這一邊的人開始自稱「{n}」。', { n: pair[0] }, 6);
        log(w, s === 'biz' ? '🏳️ {a}和幾位走得近的人開始自稱「{n}」：做生意的事，他們主張少管。' : '🏳️ {a}和幾位走得近的人開始自稱「{n}」：店家的事，他們主張要管。', { a: by?.name || '', n: pair[0] }, by?.name || '');
        return true;
    }
    function daily(w) {
        if (!on(w)) return; const C = S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        try { for (const s of SIDES) if (C[s].name) I18N.registerName(C[s].name[0], C[s].name[1]); } catch (e) {}
        if (C.built == null || d - C.built >= 7) rebuild(w);
        try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) {}
    }
    DECIDE.kind('campName', {
        title: '幫自己這一邊取個名字', scan: false, pri: 0.8, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const X = S(w)[c.side]; if (!X || X.name) return ''; const ms = X.m.map(id => live(w, id)).filter(x => x && x !== a).map(x => x.name);
            return fill(c.side === 'biz' ? '這陣子你跟{who}在鎮上的事情上常站同一邊：做生意的事，你們主張少管。外面的人開始把你們看成一夥，該有個名字了。' : '這陣子你跟{who}在鎮上的事情上常站同一邊：店家的事，你們主張要管。外面的人開始把你們看成一夥，該有個名字了。', { who: { raw: ms.map(n => t(n)).join(t('、')) } }); },
        options(w, a, c) {
            const X = S(w)[c.side]; if (!X || X.name || X.lead !== a.agentId) return [];
            const taken = new Set(SIDES.map(s => S(w)[s].name?.[0]).filter(Boolean)); let seed = 0; for (const ch of String(a.agentId)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
            return NAMES[c.side].filter(p => !taken.has(p[0])).map((p, i) => ({ id: 'n' + i, quiet: true, text: { k: '叫「{n}」', p: { n: p[0] } }, say: { k: '把自己這一邊叫做「{n}」', p: { n: p[0] } }, why: '名字要讓人一聽就懂我們要什麼', base: REF + (((seed + i * 7) % 5) * 0.12), lean: {}, run: (w2, a2) => (setName(w2, c.side, p, a2) ? { k: '定了名字' } : null) }));
        },
    });
    // 沒開智能體時的投票：檯面上的人照自己這一邊投。回 null＝照原本的算
    function vote(w, p, a) {
        const s = side(w, a); if (!s || !p || a.agentId === p.proposerId || a.agentId === p.accused || a.agentId === p.cand) return null; const C = S(w);
        if (DEALK.includes(p.kind)) { if (Math.random() >= 0.7) return null; C.st.votes = (C.st.votes || 0) + 1; return s === 'biz' ? { v: 'against', why: 'camp_biz' } : { v: 'for', why: 'camp_folk' }; }
        if (p.kind === 'office_appoint') { const cs = side(w, w.agents[p.cand]); if (!cs) return null; if (cs === s) { if (Math.random() >= 0.8) return null; C.st.votes = (C.st.votes || 0) + 1; return { v: 'for', why: 'camp_own' }; } if (Math.random() >= 0.6) return null; C.st.votes = (C.st.votes || 0) + 1; return { v: 'against', why: 'camp_other' }; }
        return null;
    }
    // 選舉：候選人在「管不管商人」上的立場。strict＝要管、loose＝少管
    function stance(w, a) {
        if (!a) return null; const s = lean(w, a); if (s === 'folk') return 'strict'; if (s === 'biz') return 'loose';
        if (honesty(a) >= 4 || has(a, 'kind')) return 'strict'; if (has(a, 'greedy')) return 'loose'; return null;
    }
    function bias(w, voter, cid) {
        if (!w.camps && !w.deal) return 0; const c = w.agents[cid]; if (!c || !voter || voter === c) return 0; const st = stance(w, c); if (!st) return 0;
        let hot = 0; try { hot = UNREST.heat(w); } catch (e) {} const k = 1 + Math.min(1, hot * 3); const vl = lean(w, voter);
        if (vl === 'folk') return st === 'strict' ? 6 * k : -6 * k; if (vl === 'biz') return st === 'loose' ? 6 : -4;
        return st === 'strict' ? 2 * hot * 10 : -2 * hot * 10; // 沒有偏向的人：鎮上怨氣越重，越想找個肯管的
    }
    function describe(w, a) {
        if (!w.camps || !a) return ''; const s = side(w, a); if (!s) return ''; const X = S(w)[s]; const ms = X.m.map(id => live(w, id)).filter(x => x && x !== a).map(x => t(x.name)).slice(0, 4).join(t('、'));
        if (!X.name) return ms ? fill(s === 'biz' ? '在鎮上的政治裡，你跟{who}常站同一邊：做生意的事主張少管。' : '在鎮上的政治裡，你跟{who}常站同一邊：店家的事主張要管。', { who: { raw: ms } }) : '';
        return fill(s === 'biz' ? '在鎮上的政治裡，你屬於「{n}」這一邊（{who}）：做生意的事主張少管。' : '在鎮上的政治裡，你屬於「{n}」這一邊（{who}）：店家的事主張要管。', { n: X.name[0], who: { raw: ms } });
    }
    function view(w) {
        if (!w.camps) return null; const C = S(w), d = day(w);
        const one = (s) => { const X = C[s]; return { side: s, name: t(nameOf(w, s)), named: !!X.name, formed: X.m.length >= 2, days: X.since != null ? d - X.since : 0, lead: live(w, X.lead)?.name || null, members: X.m.map(id => live(w, id)).filter(Boolean).map(a => ({ id: a.agentId, name: a.name, score: score(w, a) })) }; };
        let cands = []; try { cands = (w.election?.candidates || []).map(c => ({ id: c.agentId, name: w.agents[c.agentId]?.name || c.name, stance: stance(w, w.agents[c.agentId]) })).filter(x => x.name); } catch (e) {}
        return { biz: one('biz'), folk: one('folk'), cands, st: Object.assign({}, C.st) };
    }
    try { DECIDE.source('pol', (w, a) => describe(w, a)); } catch (e) {}
    return { S, on, NAMES, pols, score, sideOf, side, lean, nameOf, rebuild, setName, daily, vote, stance, bias, describe, view };
})();
if (typeof globalThis !== 'undefined') globalThis.CAMPS = CAMPS;
if (CAMPS) {
    if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { camp_biz: '我們這一邊不贊成管這麼多', camp_folk: '我們這一邊就是要管住店家', camp_own: '他是我們這一邊的人', camp_other: '他是另一邊的人' });
    if (typeof ProposalSystem !== 'undefined') {
        const PS = ProposalSystem.prototype;
        const _daily = PS.daily; if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { CAMPS.daily(w); } catch (e) { console.warn('[Camps] daily', e); } return r; };
        const _rv = PS._ruleVote; PS._ruleVote = function (w, p, a, ...rest) { try { const r = w.camps ? CAMPS.vote(w, p, a) : null; if (r) { p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } } catch (e) {} return _rv.call(this, w, p, a, ...rest); };
    }
    if (typeof World !== 'undefined') {
        const WP = World.prototype;
        const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.camps = null; return r; };
        const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.camps) d.camps = this.camps; return d; };
        const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.camps = (data?.camps && typeof data.camps === 'object') ? data.camps : null; if (this.camps) for (const s of ['biz', 'folk']) { const n = this.camps[s]?.name; if (n) I18N.registerName(n[0], n[1]); } } catch (e) {} return r; };
    }
}
