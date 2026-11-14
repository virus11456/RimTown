// RimTown - sim-dark.js（v6.51.0）：人性的陰暗面與誤會。
// 恩怨從哪來：討厭的人、競選對手、同行搶生意、最近吵過架（_grudge）。
// 會做什麼（依個性：惡意 _malice、誠實 _honesty、眼力 _insight）：
//   講壞話（背後跟朋友抱怨仇人；誠實度低的會加油添醋或乾脆編造）、
//   說謊（偷懶偷吃還推給別人、選舉開空頭支票、善良的人說善意的謊言）、
//   陰謀（栽贓、搶功、拉票讓對手的提案過不了、破壞對方的工作），
//   誤會（內向的人被當成冷漠、吃醋的人以為伴侶劈腿、聽到半句話以為在說自己）。
// 每件壞事都是一個「秘密」：玩家（上帝視角）一開始就看得到真相，村民要等被拆穿；
// 眼力好的人（守衛、鎮長、學者、完美主義者…）比較容易看穿。拆穿後信任崩盤、被冤枉的人洗清冤屈。
// 載入順序：sim-pets.js 之後。
'use strict';
const DARK = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rnd = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const rel = (a, b) => a.relationships?.getOrCreate?.(b.agentId, b.name);
    const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
    const fill = (k, p) => { let s = t(k); for (const [x, v] of Object.entries(p || {})) s = s.split('{' + x + '}').join(String(v)); return s; };
    const mem = (w, a, k, p, imp, cat) => { try { a.memory?.addT?.(w.tickCount, w.clock.timeStr, cat || 'social', k, p || {}, imp || 5, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const day = (w) => (w.proposals?._abs?.(w)) ?? (w.clock ? (w.clock.year * 400 + ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 100 + w.clock.day) : 0);
    // 個性
    const malice = (a) => (has(a, 'jealous') ? 2 : 0) + (has(a, 'abrasive') ? 2 : 0) + (has(a, 'gossip') ? 1.5 : 0) + (has(a, 'neurotic') ? 1 : 0) + (has(a, 'pessimist') ? 0.5 : 0) - (has(a, 'kind') ? 3 : 0) - (has(a, 'optimist') ? 0.5 : 0) - (has(a, 'stoic') ? 0.5 : 0);
    const honesty = (a) => 2 + (has(a, 'kind') ? 2 : 0) + (has(a, 'stoic') ? 1 : 0) + (has(a, 'perfectionist') ? 1 : 0) + (has(a, 'ascetic') ? 1 : 0) - (has(a, 'gossip') ? 1 : 0) - (has(a, 'lazy') ? 1 : 0) - (has(a, 'jealous') ? 1 : 0) - (has(a, 'abrasive') ? 0.5 : 0) - (has(a, 'charismatic') ? 0.5 : 0);
    const insight = (a) => ({ guard: 2, mayor: 1, researcher: 1, doctor: 0.5 }[a.job?.key] || 0) + (has(a, 'perfectionist') ? 1 : 0) + (has(a, 'stoic') ? 0.5 : 0) + (has(a, 'neurotic') ? 0.5 : 0) + (has(a, 'gossip') ? 0.5 : 0);
    // 感受(記憶想法)
    if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
        misunderstood:   { mood: -5, opinion: 0, days: 3, label: t('被人誤會，覺得很委屈') },
        snubbed:         { mood: -3, opinion: -1, days: 2, label: t('覺得被冷落') },
        suspicious:      { mood: -6, opinion: -1, days: 3, label: t('起了疑心，心裡不踏實') },
        cleared_up:      { mood: 5, opinion: 1, days: 3, label: t('誤會解開了，鬆了一口氣') },
        regret_misjudge: { mood: -2, opinion: 1, days: 2, label: t('誤會了別人，有點過意不去') },
        wrongly_blamed:  { mood: -10, opinion: 0, days: 5, label: t('被冤枉了') },
        exposed:         { mood: -12, opinion: 0, days: 6, label: t('做的壞事被拆穿了') },
        vindicated:      { mood: 8, opinion: 0, days: 4, label: t('終於洗清冤屈') },
        credit_stolen:   { mood: -7, opinion: -2, days: 4, label: t('功勞被人搶走') },
        work_ruined:     { mood: -6, opinion: 0, days: 3, label: t('工作被人動了手腳') },
        comforted:       { mood: 4, opinion: 1, days: 2, label: t('被朋友安慰了') },
        resentful:       { mood: -4, opinion: -2, days: 4, label: t('心裡記恨著') },
        competitive:     { mood: -3, opinion: -1, days: 3, label: t('被同行比下去，不服氣') },
        guilty:          { mood: -3, opinion: 0, days: 3, label: t('心裡有鬼，怕被發現') },
        cheated:         { mood: -5, opinion: -2, days: 4, label: t('覺得被坑了') },
        debt_unpaid:     { mood: -5, opinion: -2, days: 5, label: t('借出去的錢一直要不回來') },
        neighbor_trouble:{ mood: -3, opinion: -1, days: 3, label: t('被鄰居吵得受不了') },
        apologized:      { mood: 2, opinion: 1, days: 2, label: t('道了歉，心裡好過一點') },
        forgiven:        { mood: 6, opinion: 2, days: 3, label: t('被原諒了') },
        forgave:         { mood: 3, opinion: 1, days: 2, label: t('選擇原諒對方') },
        unforgiving:     { mood: -3, opinion: -2, days: 4, label: t('還沒辦法原諒對方') },
        avenged:         { mood: 4, opinion: -2, days: 3, label: t('報了一箭之仇') },
        punished:        { mood: -10, opinion: 0, days: 6, label: t('被全鎮處罰') },
        justice:         { mood: 6, opinion: 0, days: 3, label: t('討回了公道') },
    });
    const S = (w) => { if (!w.dark || !Array.isArray(w.dark.secrets)) w.dark = { secrets: [], mis: [], n: 0, cool: {}, spoke: {}, exposedCount: {} }; const D = w.dark; D.rep = D.rep || {}; D.wrongs = D.wrongs || []; D.allies = D.allies || {}; D.cliques = D.cliques || []; D.feuds = D.feuds || {}; return D; };
    // ---------- 名聲:大家怎麼看這個人(由他做過的事累積) ----------
    const bump = (w, a, k, n = 1) => { if (!a) return; const D = S(w); const r = D.rep[a.agentId] || (D.rep[a.agentId] = {}); r[k] = (r[k] || 0) + n; };
    function reputation(w, a) {
        const r = S(w).rep[a.agentId] || {}; const tags = [];
        if ((r.exposed || 0) >= 1 || (r.revenge || 0) >= 2) tags.push('scheming');
        if ((r.badmouth || 0) >= 3) tags.push('gossip');
        if ((r.helped || 0) >= 2 || (r.forgave || 0) >= 2) tags.push('helpful');
        if (!(r.lies || 0) && !(r.exposed || 0) && honesty(a) >= 3) tags.push('honest');
        return tags;
    }
    const REP = { scheming: '陰險', gossip: '愛八卦', helpful: '熱心', honest: '老實' };
    const repLabel = (w, a) => reputation(w, a).map(k => t(REP[k])).join(t('、'));
    const credibility = (w, a) => { const tg = reputation(w, a); return 1 + (tg.includes('honest') ? 0.5 : 0) - (tg.includes('gossip') ? 0.4 : 0) - (tg.includes('scheming') ? 0.7 : 0); };
    // ---------- 虧欠:誰對不起誰(之後可能道歉、原諒,或報復) ----------
    function wrong(w, by, to, weight, kx, p) { if (!by || !to || by === to) return; const D = S(w); D.wn = (D.wn || 0) + 1; D.wrongs.push({ id: D.wn, by: by.agentId, to: to.agentId, w: weight, day: day(w), tries: 0, k: kx, p }); if (D.wrongs.length > 30) D.wrongs = D.wrongs.slice(-30); }

    // ---------- 恩怨從哪來 ----------
    const RIVAL_JOBS = ['trader', 'cook', 'blacksmith', 'tailor', 'carpenter', 'doctor', 'miner', 'tavern', 'researcher'];
    const competitor = (a, b) => !!(a.job?.key && a.job.key === b.job?.key && RIVAL_JOBS.includes(a.job.key));
    const opponents = (w, a, b) => { const E = w.election; if (!E?.active || !Array.isArray(E.candidates)) return false; const ids = E.candidates.map(c => c.agentId); return ids.includes(a.agentId) && ids.includes(b.agentId); };
    const QUARREL = ['fought', 'rival_formed', 'harsh_words', 'slandered', 'credit_stolen', 'wrongly_blamed', 'resentful', 'competitive', 'cheated', 'debt_unpaid', 'neighbor_trouble', 'jealous'];
    const recentFight = (w, a, b) => { const now = w.clock?.totalDays || 0; return (a.thoughts || []).some(x => x.targetId === b.agentId && QUARREL.includes(x.kind) && now - x.start < Math.max(x.days, 6)); };
    function grudge(w, a, b) {
        let s = -aff(a, b), why = 'dislike';
        if (opponents(w, a, b)) { s += 30; why = 'election'; }
        if (competitor(a, b)) { s += 15; if (why === 'dislike') why = 'business'; }
        if (recentFight(w, a, b)) { s += 25; if (why === 'dislike') why = 'quarrel'; }
        return { s, why };
    }
    const WHY = { dislike: '看{v}不順眼', election: '選舉時跟{v}是對手', business: '{v}搶了自己的生意', quarrel: '跟{v}吵過架' };
    function foeOf(w, a, excl) {
        let best = null;
        for (const b of npcs(w)) { if (b === a || b === excl) continue; const g = grudge(w, a, b); if (g.s >= 35 && (!best || g.s > best.g.s)) best = { b, g }; }
        return best;
    }

    // ---------- 秘密(玩家看得到真相,村民要等被拆穿) ----------
    function secret(w, o) {
        const D = S(w); D.n++;
        const s = Object.assign({ id: 'S' + D.n, day: day(w), found: false }, o);
        D.secrets.push(s);
        if (D.secrets.length > 30) D.secrets = D.secrets.filter(x => !x.found || day(w) - x.day < 20).slice(-30);
        const c = w.agents[s.culprit]; if (c && s.kind !== 'white') c.addThought?.('guilty', w);
        return s;
    }
    const BASE = { slander: 0.05, frame: 0.06, credit: 0.08, lobby: 0.1, sabotage: 0.05, cover: 0.07, promise: 0.06, white: 0.03 };
    function reveal(w, s, by) {
        s.found = true; s.foundDay = day(w); s.foundBy = by?.agentId || null;
        const c = w.agents[s.culprit], v = s.victim ? w.agents[s.victim] : null; if (!c) return;
        const all = npcs(w).filter(a => a !== c);
        const truth = fill(s.k, s.p);
        if (s.kind === 'white') {
            if (v) { rel(v, c)?.modifyAffinity?.(2); mem(w, v, '原來{a}那時候是在說善意的謊言安慰我，反而更感動了。', { a: c.name }, 5); }
            log(w, 'social', '💗 {v}發現{a}之前是說善意的謊言安慰自己，兩人更要好了。', { v: v?.name || '', a: c.name }, c.name);
            return;
        }
        const heavy = ['frame', 'sabotage', 'slander', 'credit'].includes(s.kind);
        for (const o of all) { const r = rel(o, c); r?.modifyAffinity?.(o === v ? -18 : heavy ? -8 : -4); r?.modifyTrust?.(heavy ? -12 : -6); }
        c.addThought?.('exposed', w);
        mem(w, c, '我做的事被拆穿了：{x}。大家看我的眼神都不一樣了。', { x: truth }, 8);
        for (const o of rnd(all, 6)) mem(w, o, '真相大白：{x}', { x: truth }, 7);
        if (v && heavy) { v.addThought?.('vindicated', w); mem(w, v, '真相終於大白，原來是{a}在搞鬼。', { a: c.name }, 8); for (const o of rnd(all.filter(x => x !== v), 4)) rel(o, v)?.modifyAffinity?.(4); }
        log(w, 'drama', '🔍 真相大白：{x}{by}', { x: truth, by: by ? fill('（被{b}看穿）', { b: by.name }) : '' }, c.name);
        w.dailyNews?.collectEvent?.('drama', `🔍 ${t('真相大白：')}${truth}`, 8, [c.name, v?.name].filter(Boolean));
        const D = S(w);
        // v9.9.4 前科會淡:兩個月沒再犯就減一次(以前一輩子累計,三次就趕走)
        if (heavy) { D.lastHeavy = D.lastHeavy || {}; const last = D.lastHeavy[c.agentId]; if (last != null && D.exposedCount[c.agentId]) D.exposedCount[c.agentId] = Math.max(0, D.exposedCount[c.agentId] - Math.floor((day(w) - last) / 60)); D.lastHeavy[c.agentId] = day(w); }
        D.exposedCount[c.agentId] = (D.exposedCount[c.agentId] || 0) + (heavy ? 1 : 0);
        bump(w, c, 'exposed');
        if (v) wrong(w, c, v, heavy ? 3 : 1, s.k, s.p);
        // v6.52.0 嚴重的事:全鎮提案審判(罰款／公共勞役／逐出小鎮),投票決定
        if (heavy && v) { try { proposeVerdict(w, s, c, v, by); } catch (e) { console.warn('[Dark] verdict', e); } }
    }
    // ---------- 審判提案:陰謀被拆穿後由受害者(或看穿的人)提出 ----------
    const PEN = { fine: '罰他替公庫做工抵 30 銀幣，並公開道歉', labor: '罰他做一週公共勞役（每天搬木材石頭）', exile: '把他逐出小鎮' };
    function proposeVerdict(w, s, c, v, by) {
        const P = w.proposals; if (!P?._createWith) return null;
        if ((P.items || []).some(p => p.kind === 'verdict' && p.status === 'open' && p.culprit === c.agentId)) return null;
        const n = S(w).exposedCount[c.agentId] || 1;
        const pen = n >= 5 ? 'exile' : n >= 3 ? 'labor' : 'fine'; // v9.9.4 門檻提高:第 1～2 次罰款、第 3～4 次勞役、第 5 次才逐出(以前第 3 次就趕走,一年要趕走兩三成的人)
        const who = (v && !v.isDead && w.agents[v.agentId]) ? v : (by || v);
        const what = fill(s.k, s.p);
        const cand = { kind: 'verdict', key: 'verdict:' + s.id, jobs: [], make: () => ({ kind: 'verdict', key: 'verdict:' + s.id, culprit: c.agentId, victim: v.agentId, pen, tk: '處置{a}：{pen}', tp: { a: c.name, pen: t({ fine: '罰款道歉', labor: '公共勞役', exile: '逐出小鎮' }[pen]) }, dk: '{who}提議：因為{what}，{pen}。', dp: { who: who.name, what, pen: t(PEN[pen]) }, cost: {}, category: 'welfare', jobBias: ['guard', 'mayor'] }) };
        const p = P._createWith(w, day(w), cand, who); if (!p) return null;
        p.culprit = c.agentId; p.victim = v.agentId; p.pen = pen;
        log(w, 'council', '⚖️ {who}提議處置{a}：{pen}', { who: who.name, a: c.name, pen: t(PEN[pen]) }, who.name);
        return p;
    }
    // 依個性與交情投票:心軟、跟被告要好、同派系的人傾向從輕(反對);受害者、正直的人、守衛傾向贊成
    function verdictVote(w, p, a) {
        const c = w.agents[p.culprit]; if (!c) return null; if (a.agentId === p.culprit) return 'against'; if (a.agentId === p.victim) return 'for';
        let s = 0.5;
        if (has(a, 'kind')) s -= p.pen === 'exile' ? 2 : 1; if (honesty(a) >= 3.5) s += 1; if (a.job?.key === 'guard') s += 1;
        s -= aff(a, c) / 30; s += aff(a, w.agents[p.victim] || a) / 40;
        const cq = cliqueOf(w, a.agentId); if (cq && cq.members.includes(p.culprit)) s -= 2;
        if (p.pen === 'exile') s -= 0.8;
        return s + (Math.random() - 0.5) * 1.5 >= 0 ? 'for' : 'against';
    }
    function punish(w, P, p) {
        const c = w.agents[p.culprit], v = w.agents[p.victim]; if (!c) return fill('{a}已經不在鎮上了', { a: '' });
        c.addThought?.('punished', w); if (v) { v.addThought?.('justice', w); mem(w, v, '全鎮替我討回了公道。', {}, 6); }
        mem(w, c, '全鎮投票處置了我：{pen}。', { pen: t(PEN[p.pen]) }, 8);
        if (p.pen === 'fine') { if (typeof MONEY !== 'undefined' && MONEY.fine) MONEY.fine(w, c, 30, t('罰款')); else { const Wl = typeof WALLET !== 'undefined' && w.wallet ? WALLET : null; const n = Wl ? Math.min(30, Math.max(0, Wl.get(w, c))) : 0; if (n > 0 && Wl.take(w, c, n)) w.stockpile?.add?.('silver', n, w.tickCount, t('罰款')); } /* v7.6.0 罰款從被告錢包出;v7.7.2 付不出的記成欠款,從工資分期扣 */ if (v) { rel(v, c)?.modifyAffinity?.(5); mem(w, v, '{a}當眾向我道歉了。', { a: c.name }, 6); } S(w).wrongs = S(w).wrongs.filter(x => !(x.by === c.agentId && x.to === v?.agentId)); }
        else if (p.pen === 'labor') { const D = S(w); D.labor = (D.labor || []).concat([{ id: c.agentId, until: day(w) + 7 }]); }
        else if (p.pen === 'exile') { if (typeof EXILE !== 'undefined') EXILE.order(w, c, { crime: true, reason: t('被全鎮投票逐出小鎮') }); else w.leaveTown?.(c.agentId, t('被全鎮投票逐出小鎮')); } // v9.9.4 限期 7 天變賣,犯罪沒收五成
        log(w, 'council', '⚖️ 判決執行：{a}，{pen}。', { a: c.name, pen: t(PEN[p.pen]) }, c.name);
        w.dailyNews?.collectEvent?.('politics', fill('⚖️ 判決執行：{a}，{pen}。', { a: c.name, pen: t(PEN[p.pen]) }), 8, [c.name]);
        return fill('判決執行：{pen}', { pen: t(PEN[p.pen]) });
    }
    function laborDaily(w) {
        const D = S(w); if (!D.labor?.length) return; const today = day(w);
        D.labor = D.labor.filter(x => { const a = w.agents[x.id]; if (!a && w.isAway?.(x.id)) { x.until++; return true; } /* v9.9.4 出遠門回來接著做 */ if (!a || today > x.until) return false; w.stockpile?.add?.('wood', 3, w.tickCount, t('公共勞役')); w.stockpile?.add?.('stone', 2, w.tickCount, t('公共勞役')); if (a.needs) a.needs.rest = Math.max(0, a.needs.rest - 15); return true; });
    }
    // ---------- 道歉與原諒 ----------
    const APOLOGY = ['對不起，之前是我不對。', '那件事我一直很過意不去，真的很抱歉。', '我知道說什麼都晚了，但我還是想跟你道歉。'];
    // v9.20.0 村民自己拿主意時由決策核心決定(sim-decide-soc.js)；這裡只剩「怎麼結算」。下面擲骰的版本留給沒有決策核心的情況
    const byChoice = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.soc && !!DECIDE.on?.(w); } catch (e) { return false; } };
    const byLife = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.life && !!DECIDE.on?.(w); } catch (e) { return false; } }; // v9.22.0 陰謀陷害交給本人決定
    const byDark = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.dark && !!DECIDE.on?.(w); } catch (e) { return false; } }; // v9.26.0 說謊、選戰手段、傳話交給本人決定
    const wrongById = (w, id) => (S(w).wrongs || []).find(x => x.id === id) || null;
    const wrongId = (w, x) => { const D = S(w); if (!x.id) { D.wn = (D.wn || 0) + 1; x.id = D.wn; } return x.id; };
    // 這筆帳是什麼事(給決策核心看的一句話)。who 做的人、vName 受害的人;整句已經寫好人名的(被拆穿的秘密)就照原句
    const wrongLine = (x, who, vName) => !x?.k ? fill('{who}{what}', { who, what: t('做了對不起人的事') }) : x.k.includes('{a}') ? fill(x.k, Object.assign({}, x.p || {}, { a: who }, x.k.includes('{v}') ? { v: vName } : {})) : x.k.includes('{v}') ? fill('{who}{what}', { who, what: fill(x.k, Object.assign({}, x.p || {}, { v: vName })) }) : fill(x.k, x.p);
    // 道歉說出口
    function sorryS(w, x, a, b) {
        x.last = day(w); x.tries = (x.tries || 0) + 1; bump(w, a, 'apologized');
        const line = t(pick(APOLOGY)); a.addThought?.('apologized', w, b.agentId, b.name);
        mem(w, a, '我去跟{b}道歉了：「{x}」', { b: b.name, x: line }, 6); return line;
    }
    function forgiveS(w, x, a, b, line) {
        x.done = true; x.forgiven = true;
        rel(a, b)?.modifyAffinity?.(6); rel(b, a)?.modifyAffinity?.(10); rel(b, a)?.modifyTrust?.(4);
        a.addThought?.('forgiven', w, b.agentId, b.name); b.addThought?.('forgave', w, a.agentId, a.name); bump(w, b, 'forgave');
        mem(w, b, '{a}來跟我道歉，我原諒他了。', { a: a.name }, 6);
        (b.thoughts || []).forEach(th => { if (th.targetId === a.agentId && ['slandered', 'wrongly_blamed', 'credit_stolen', 'resentful', 'cheated', 'debt_unpaid'].includes(th.kind)) th.days = Math.min(th.days, (w.clock?.totalDays || 0) - th.start + 1); });
        log(w, 'social', '🙏 {a}向{b}道歉：「{x}」{b}原諒了他。', { a: a.name, b: b.name, x: line || t(APOLOGY[0]) }, a.name);
    }
    function refuseS(w, x, a, b) {
        rel(b, a)?.modifyAffinity?.(-2); b.addThought?.('unforgiving', w, a.agentId, a.name);
        mem(w, b, '{a}跑來道歉，可是我還沒辦法原諒他。', { a: a.name }, 6);
        log(w, 'social', '🙏 {a}向{b}道歉，但{b}還不肯原諒。', { a: a.name, b: b.name }, a.name);
        if (x.tries >= 2) x.done = true;
    }
    // 決策核心用：去道歉(可以帶賠禮) → 對方自己決定要不要原諒
    function apologize(w, x, gift) {
        const a = w.agents[x.by], b = w.agents[x.to]; if (!a || !b) { x.done = true; return null; }
        const line = sorryS(w, x, a, b); let g = 0;
        if (gift > 0 && typeof WALLET !== 'undefined' && w.wallet && WALLET.pay(w, a, b, gift)) { g = gift; mem(w, b, '{a}帶了 {n} 銀幣的賠禮來道歉。', { a: a.name, n: g }, 5); }
        x.line = line; if (typeof DECIDE !== 'undefined') DECIDE.enqueue(w, b, 'forgive', { id: wrongId(w, x), by: a.agentId, gift: g });
        return { line, gift: g };
    }
    // 對方的回應：yes 原諒／no 還不行／never 不想再往來
    function answer(w, x, how) {
        const a = w.agents[x.by], b = w.agents[x.to]; if (!a || !b) { x.done = true; return; }
        if (how === 'yes') return forgiveS(w, x, a, b, x.line);
        if (how === 'never') { x.done = true; x.never = true; rel(b, a)?.modifyAffinity?.(-6); rel(a, b)?.modifyAffinity?.(-4); b.addThought?.('unforgiving', w, a.agentId, a.name);
            mem(w, b, '{a}來道歉，我告訴他以後不必再來往了。', { a: a.name }, 7); mem(w, a, '{b}說以後不必再來往了。', { b: b.name }, 7);
            log(w, 'social', '🙏 {a}向{b}道歉，{b}說：「以後不必再來往了。」', { a: a.name, b: b.name }, a.name); return; }
        refuseS(w, x, a, b);
    }
    // 嘴硬不認錯：這件事他不會再去道歉
    function deny(w, x) { const a = w.agents[x.by], b = w.agents[x.to]; x.done = true; x.denied = true; if (a && b) mem(w, a, '{b}那件事，我不覺得自己有錯。', { b: b.name }, 4); }
    // 沒人管的舊帳：超過 20 天就不再提
    function tidyWrongs(w) {
        const D = S(w), today = day(w);
        for (const x of D.wrongs) { if (x.done) continue; if (!w.agents[x.by] || !w.agents[x.to] || today - x.day > 20) x.done = true; }
        if (D.wrongs.length > 30) D.wrongs = D.wrongs.filter(x => !x.done).concat(D.wrongs.filter(x => x.done).slice(-6)).slice(-30);
    }
    // ---------- 報復:沒被原諒/不肯原諒的人,記恨又不老實的可能反擊,恩怨變成連載 ----------
    // how: 'warn' 到處提醒大家小心他／'sabotage' 偷偷動他的東西
    function avengeS(w, x, v, c, how) {
        const D = S(w), today = day(w);
        x.revenged = true; bump(w, v, 'revenge');
        const key = [v.agentId, c.agentId].sort().join('|'); const f = D.feuds[key] || (D.feuds[key] = { n: 0, start: today }); f.n++;
        v.addThought?.('avenged', w, c.agentId, c.name);
        if (how === 'warn') {
            const ears = rnd(npcs(w).filter(o => o !== v && o !== c), 3);
            for (const o of ears) { rel(o, c)?.modifyAffinity?.(-4); mem(w, o, '{v}提醒大家要小心{c}，說他不是什麼好人。', { v: v.name, c: c.name }, 5); }
            log(w, 'scheme', '⚔️ {v}到處提醒大家小心{c}，報復之前的事。', { v: v.name, c: c.name }, v.name);
        } else {
            c.addThought?.('work_ruined', w); mem(w, c, '我的東西被人動了手腳，一定是{v}幹的！', { v: v.name }, 7);
            log(w, 'scheme', '⚔️ {v}偷偷動了{c}的東西，報一箭之仇。🕵️', { v: v.name, c: c.name }, v.name);
            secret(w, { kind: 'sabotage', culprit: v.agentId, victim: c.agentId, k: '{v}為了報復，偷偷破壞了{c}的東西', p: { v: v.name, c: c.name } });
        }
        wrong(w, v, c, 2, '報復{v}', { v: c.name });
        if (f.n >= 2) { log(w, 'drama', '📖 恩怨連載：{a}和{b}你來我往，已經第 {n} 回了。', { a: v.name, b: c.name, n: f.n }, v.name); w.dailyNews?.collectEvent?.('drama', fill('📖 恩怨連載：{a}和{b}你來我往，已經第 {n} 回了。', { a: v.name, b: c.name, n: f.n }), 7, [v.name, c.name]); }
    }
    // 放下：不再想著報復(對方之後來道歉還是可以原諒)
    function letGo(w, x) { const v = w.agents[x.to], c = w.agents[x.by]; x.let = true; if (v && c) { v.moodModifier = (v.moodModifier || 0) + 2; mem(w, v, '{c}那件事，我決定不再放在心上。', { c: c.name }, 5); } }
    // 當面說清楚：對方老實或心軟就當場道歉；不然就吵起來
    function faceUp(w, x) {
        const v = w.agents[x.to], c = w.agents[x.by]; if (!v || !c) return 'gone'; x.faced = true;
        if (!x.done && (has(c, 'kind') || honesty(c) >= 3) && !has(c, 'abrasive')) { mem(w, c, '{v}當面來問我那件事，我跟他道歉了。', { v: v.name }, 6); apologize(w, x, 0); return 'sorry'; }
        rel(v, c)?.modifyAffinity?.(-4); rel(c, v)?.modifyAffinity?.(-4); v.addThought?.('harsh_words', w, c.agentId, c.name);
        mem(w, v, '我去找{c}把話說清楚，他一點都不覺得自己有錯，我們吵了起來。', { c: c.name }, 6); mem(w, c, '{v}跑來興師問罪，我們吵了一架。', { v: v.name }, 6);
        log(w, 'social', '💢 {v}當面找{c}說清楚，兩人吵了起來。', { v: v.name, c: c.name }, v.name);
        try { if (typeof WAYS !== 'undefined') WAYS.quarrel(w, v, c); } catch (e) {}
        return 'fight';
    }
    function discover(w) {
        const D = S(w), today = day(w); const all = npcs(w);
        for (const s of D.secrets) {
            if (s.found || today - s.day > 15 || today === s.day) continue;
            const c = w.agents[s.culprit]; if (!c) { s.found = true; continue; }
            const eyes = all.filter(a => a !== c); if (!eyes.length) continue;
            const sharp = eyes.reduce((m, a) => insight(a) > insight(m) ? a : m, eyes[0]);
            const v = s.victim ? w.agents[s.victim] : null;
            const p = (BASE[s.kind] || 0.05) + insight(sharp) * 0.03 + (v ? insight(v) * 0.02 : 0) - (has(c, 'charismatic') ? 0.02 : 0);
            if (Math.random() < p) reveal(w, s, Math.random() < 0.6 ? sharp : (v || sharp));
        }
    }

    // ---------- 講壞話(兩人聊天時) ----------
    const DISS_TRUE = ['{who}做事老是拖拖拉拉，交代的事都做不好。', '{who}那個人很自私，只顧自己。', '{who}講話很難聽，你跟他相處要小心。', '{who}最近很愛出風頭，看了就煩。'];
    const DISS_LIE = ['我看到{who}偷偷拿了公庫的東西。', '{who}在背後笑你，說你什麼都不懂。', '聽說{who}欠了一屁股債還不還。', '{who}答應幫人的事，轉頭就忘了，還怪別人。'];
    // 說出口之後(要不要講、講真的還是編的由本人決定):傳成流言、聽的人怎麼想、編造的變成秘密
    function speak(w, speaker, listener, foe, why, lie) {
        const D = S(w), today = day(w);
        D.spoke[speaker.agentId] = today;
        const kx = pick(lie ? DISS_LIE : DISS_TRUE); const line = fill(kx, { who: foe.name });
        const G = w.gossipNetwork;
        if (G?.activeGossip) G.activeGossip.push({ about: foe.name, content: line, contentT: { k: kx, p: { who: foe.name } }, source: speaker.name, spreadCount: 1, tickCreated: w.tickCount, isTrue: !lie, tone: 'diss', juicy: false });
        mem(w, speaker, '我跟{b}抱怨了{c}（{why}）。', { b: listener.name, c: foe.name, why: fill(WHY[why] || WHY.dislike, { v: foe.name }) }, 4);
        bump(w, speaker, 'badmouth'); if (lie) bump(w, speaker, 'lies');
        log(w, 'gossip', '🗣️ {a}在背後跟{b}說{c}的壞話：「{x}」{lie}', { a: speaker.name, b: listener.name, c: foe.name, x: line, lie: lie ? t('🎭（其實是編的）') : '' }, speaker.name);
        // 聽的人:跟被講的人很要好又正直 → 幫忙說話,可能直接告訴本人;否則印象變差
        if ((has(listener, 'kind') || honesty(listener) >= 4) && aff(listener, foe) >= 30) {
            rel(listener, speaker)?.modifyAffinity?.(-3); bump(w, listener, 'helped');
            mem(w, listener, '{a}在背後說{c}的壞話，我替{c}說了幾句話。', { a: speaker.name, c: foe.name }, 5);
            // 要不要去告訴當事人,由聽到的人自己決定(決策核心「聽到有人說朋友壞話」)
            try { DECIDE.enqueue(w, listener, 'tattle', { foe: foe.agentId, by: speaker.agentId, line }); } catch (e) {}
        } else {
            // v6.52.0 信不信要看說的人名聲:老實的人講的比較有人信,愛八卦、陰險的人講的大家打折聽
            const cred = credibility(w, speaker);
            rel(listener, foe)?.modifyAffinity?.(-Math.round((2 + (aff(listener, speaker) >= 30 ? 2 : 0)) * cred));
            mem(w, listener, cred < 0.8 ? '{a}又在說{c}的壞話了，聽聽就好。' : '{a}跟我說{c}的壞話：「{x}」', { a: speaker.name, c: foe.name, x: line }, 4);
            if (cred >= 0.8) ally(w, speaker, listener, foe);
        }
        if (lie) secret(w, { kind: 'slander', culprit: speaker.agentId, victim: foe.agentId, k: '{a}編造了{c}的壞話（「{x}」）', p: { a: speaker.name, c: foe.name, x: line } });
        return { foe: foe.agentId, lie };
    }
    // 直接去找對方把話說開:對方不是難相處的人、也還沒到撕破臉,心結就解開一些;不然吵起來
    // 談得成談不成看兩個人:好相處、有口才的比較談得成;對方難相處、彼此已經很討厭就談不攏。真的談崩了才會冷戰
    function talkOut(w, a, foe) {
        S(w).spoke[a.agentId] = day(w);
        const sc = (has(a, 'kind') ? 1 : 0) + (has(a, 'charismatic') ? 1 : 0) + (has(foe, 'kind') ? 1 : 0) - (has(foe, 'abrasive') ? 1.5 : 0) - (has(a, 'abrasive') ? 1 : 0) + aff(foe, a) / 40;
        if (sc > -1.3) {
            rel(a, foe)?.modifyAffinity?.(7); rel(foe, a)?.modifyAffinity?.(6);
            mem(w, a, '我去找{c}把話說開，談完心裡舒服多了。', { c: foe.name }, 6); mem(w, foe, '{a}來找我把話說開，原來他一直放在心上。', { a: a.name }, 6);
            log(w, 'social', '☕ {a}去找{c}把話說開，兩人談了很久。', { a: a.name, c: foe.name }, a.name); return true;
        }
        rel(a, foe)?.modifyAffinity?.(-3); rel(foe, a)?.modifyAffinity?.(-3); a.addThought?.('harsh_words', w, foe.agentId, foe.name);
        mem(w, a, '我去找{c}想把話說開，結果又吵了一架。', { c: foe.name }, 6); mem(w, foe, '{a}跑來找我理論，我們吵了一架。', { a: a.name }, 5);
        log(w, 'social', '💢 {a}去找{c}想把話說開，結果又吵了起來。', { a: a.name, c: foe.name }, a.name);
        if (sc < -2.4) { try { if (typeof WAYS !== 'undefined') WAYS.quarrel(w, a, foe); } catch (e) {} }
        return false;
    }
    // ---------- 小團體:常一起說同一個人壞話的人會越走越近,成了一派 ----------
    function ally(w, a, b, target) {
        const D = S(w); const key = [a.agentId, b.agentId].sort().join('|');
        const x = D.allies[key] || (D.allies[key] = { n: 0, targets: [] }); x.n++; if (!x.targets.includes(target.agentId)) x.targets.push(target.agentId);
        rel(a, b)?.modifyAffinity?.(2); rel(b, a)?.modifyAffinity?.(2);
        if (x.n < 2) return;
        let c = D.cliques.find(q => q.members.includes(a.agentId) || q.members.includes(b.agentId));
        if (!c) {
            if (D.cliques.length >= 4) return;
            c = { id: 'C' + (++D.n), leader: a.agentId, members: [a.agentId, b.agentId], against: [target.agentId], day: day(w), last: day(w) }; D.cliques.push(c);
            log(w, 'social', '🫂 {a}和{b}常常一起說{c}的閒話，成了一個小圈圈。', { a: a.name, b: b.name, c: target.name }, a.name);
            w.dailyNews?.collectEvent?.('relationship', fill('🫂 {a}和{b}常常一起說{c}的閒話，成了一個小圈圈。', { a: a.name, b: b.name, c: target.name }), 5, [a.name, b.name]);
        } else {
            for (const id of [a.agentId, b.agentId]) if (!c.members.includes(id) && c.members.length < 6) { c.members.push(id); log(w, 'social', '🫂 {x}加入了{l}那一派。', { x: w.agents[id]?.name || '', l: w.agents[c.leader]?.name || '' }, w.agents[id]?.name || ''); }
            if (!c.against.includes(target.agentId)) c.against.push(target.agentId);
            c.last = day(w);
        }
    }
    const cliqueOf = (w, id) => S(w).cliques.find(c => c.members.includes(id)) || null;
    const cliqueName = (w, c) => c ? t('{l}那一派').replace('{l}', w.agents[c.leader]?.name || t('某人')) : '';
    function cliqueDaily(w) {
        const D = S(w), today = day(w);
        D.cliques = D.cliques.filter(c => { c.members = c.members.filter(id => w.agents[id] && !w.agents[id].isDead); if (!w.agents[c.leader]) c.leader = c.members[0]; return c.members.length >= 2 && today - c.last < 30; });
        for (const c of D.cliques) for (const i of c.members) for (const j of c.members) if (i !== j && Math.random() < 0.3) rel(w.agents[i], w.agents[j])?.modifyAffinity?.(1);
    }
    // 投票時小團體一起行動:自己人提的支持、對頭提的反對
    function cliqueVote(w, p, voter) {
        const D = w.dark; if (!D?.cliques?.length) return 0;
        const mine = cliqueOf(w, voter.agentId); if (!mine) return 0;
        if (mine.members.includes(p.proposerId)) return 1;
        if (mine.against.includes(p.proposerId) || (cliqueOf(w, p.proposerId) && cliqueOf(w, p.proposerId) !== mine && cliqueOf(w, p.proposerId).against.some(id => mine.members.includes(id)))) return -1;
        return 0;
    }
    function confront(w, subject, source, line) {
        rel(subject, source)?.modifyAffinity?.(-12); rel(source, subject)?.modifyAffinity?.(-6);
        subject.addThought?.('slandered', w, source.agentId, source.name);
        mem(w, subject, '聽說{a}在背後說我：「{x}」我去找他問清楚，吵了一架。', { a: source.name, x: line }, 7);
        mem(w, source, '{c}知道我在背後說他的壞話，跑來找我對質。', { c: subject.name }, 6);
        log(w, 'gossip', '💢 {c}知道{a}在背後說自己壞話，當面對質！', { c: subject.name, a: source.name }, subject.name);
        wrong(w, source, subject, 2, '在背後說{v}壞話', { v: subject.name });
    }

    // ---------- 恩怨的情緒:同行搶生意、競選對手 ----------
    function rivalries(w) {
        const all = npcs(w);
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            if (competitor(a, b) && Math.random() < 0.05) {
                const [loser, winner] = Math.random() < 0.5 ? [a, b] : [b, a];
                const sore = has(loser, 'jealous') || has(loser, 'abrasive') || malice(loser) >= 1;
                if (!sore && Math.random() < 0.6) continue;
                loser.addThought?.(has(loser, 'jealous') ? 'jealous' : 'competitive', w, winner.agentId, winner.name);
                rel(loser, winner)?.modifyAffinity?.(-(sore ? 6 : 3));
                mem(w, loser, '今天的客人都跑去找{b}了，同樣是{job}，憑什麼？', { b: winner.name, job: t(loser.job?.title || '') }, 5);
                { const dd = day(w), R = loser._rivLog || (loser._rivLog = {}); if (!(R[winner.agentId] > dd - 10)) { R[winner.agentId] = dd; log(w, 'social', '💼 {a}和{b}搶生意，{a}心裡很不是滋味。', { a: loser.name, b: winner.name }, loser.name); } } // v9.5.1 同一對十天內只報一次(心情與好感照扣)
            }
            if (opponents(w, a, b)) {
                rel(a, b)?.modifyAffinity?.(-2); rel(b, a)?.modifyAffinity?.(-2);
                if (Math.random() < 0.25) { const x = Math.random() < 0.5 ? a : b, y = x === a ? b : a; x.addThought?.('resentful', w, y.agentId, y.name); mem(w, x, '選舉越來越近，{b}到處拉票，看了就有氣。', { b: y.name }, 5); }
            }
        }
    }
    // ---------- 日常糾紛:買賣、借錢不還、鄰居、情敵(都會變成恩怨) ----------
    const SELLERS = ['trader', 'cook', 'blacksmith', 'tailor', 'carpenter', 'tavern', 'doctor'];
    // ---------- 朋友之間借的錢:三種結算(擲骰版與決策核心共用) ----------
    function debtRepay(w, d) {
        const l = w.agents[d.l], r = w.agents[d.r]; if (!l || !r) { d.done = true; return false; }
        const W = d.cash && typeof WALLET !== 'undefined' && w.wallet; if (W && !WALLET.pay(w, r, l, d.n)) return false;
        d.done = true; rel(l, r)?.modifyAffinity?.(3); mem(w, l, '{r}準時把借的 {n} 銀幣還我了，這人可靠。', { r: r.name, n: d.n }, 4); return true;
    }
    // 先還一部分,剩下的再等幾天
    function debtPart(w, d, m) {
        const l = w.agents[d.l], r = w.agents[d.r]; if (!l || !r) { d.done = true; return 0; }
        m = Math.max(1, Math.min(d.n - 1, Math.floor(m))); if (!(typeof WALLET !== 'undefined' && w.wallet && WALLET.pay(w, r, l, m))) return 0;
        d.n -= m; d.tries = (d.tries || 0) + 1; d.due = day(w) + 5; rel(l, r)?.modifyAffinity?.(1);
        mem(w, l, '{r}先還了我 {m} 銀幣，還欠 {n}，說過幾天補上。', { r: r.name, m, n: d.n }, 4); mem(w, r, '先還了{l} {m} 銀幣，剩下的請他再等幾天。', { l: l.name, m }, 4); return m;
    }
    function debtExtend(w, d) {
        const l = w.agents[d.l], r = w.agents[d.r]; if (!l || !r) { d.done = true; return; }
        d.done = false; d.tries = (d.tries || 0) + 1; d.due = day(w) + 5; mem(w, r, '欠{l}的錢還湊不出來，只好拜託他再寬限幾天。', { l: l.name }, 4);
    }
    function debtDodge(w, d) {
        const l = w.agents[d.l], r = w.agents[d.r]; d.done = true; if (!l || !r) return;
        const rich = d.cash && typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, r) >= d.n : true;
        rel(l, r)?.modifyAffinity?.(-10); l.addThought?.('debt_unpaid', w, r.agentId, r.name); wrong(w, r, l, 2, '欠{v}錢不還', { v: l.name });
        mem(w, l, '{r}跟我借的 {n} 銀幣一直不還，每次問都說下次。', { r: r.name, n: d.n }, 6);
        mem(w, r, '{l}又來催我還錢了，煩死了。', { l: l.name }, 4);
        log(w, 'social', '💸 {r}借{l}的 {n} 銀幣一直沒還，{l}很不高興。', { r: r.name, l: l.name, n: d.n }, l.name);
        if (rich) secret(w, { kind: 'cover', culprit: r.agentId, victim: l.agentId, k: '{r}其實有錢，只是不想還{l}', p: { r: r.name, l: l.name } });
    }
    function disputes(w) {
        const D = S(w), today = day(w), all = npcs(w); if (all.length < 3) return;
        D.debts = D.debts || [];
        // 借的錢到期:老實的人會還,不老實的賴帳
        for (const d of D.debts) {
            if (d.done || today < d.due) continue;
            const l = w.agents[d.l], r = w.agents[d.r]; if (!l || !r) { d.done = true; continue; }
            // v6.54.0 真的借了錢(個人錢包):想還但沒錢就再寬限幾天;有錢才真的還
            const W = d.cash && typeof WALLET !== 'undefined' && w.wallet;
            // v9.20.0 還不還由借錢的人自己決定(決策核心「借的錢到期了」)。過了四天還沒下文(人不在鎮上、被關…)才在這裡收尾:有錢又老實就還,不然算賴帳
            if (W) { if (today < d.due + 4) continue; if (WALLET.get(w, r) >= d.n && honesty(r) >= 2.5) debtRepay(w, d); else debtDodge(w, d); continue; }
            if ((honesty(r) >= 2.5 || Math.random() < 0.4) && debtRepay(w, d)) continue;
            debtDodge(w, d);
        }
        if (D.debts.length > 12) D.debts = D.debts.filter(d => !d.done).concat(D.debts.filter(d => d.done).slice(-4));
        if (Math.random() > 0.45) return;
        const roll = Math.random();
        if (roll < 0.35) { // 買賣糾紛:嫌貴、品質差、不給退
            const sellers = all.filter(a => SELLERS.includes(a.job?.key)); if (!sellers.length) return;
            const s = pick(sellers), b = pick(all.filter(a => a !== s));
            const i = Math.floor(Math.random() * 3); const k = ['嫌{s}賣得太貴', '買到{s}做的東西沒幾天就壞了', '要{s}退錢被拒絕'][i]; const k2 = ['賣太貴', '東西做得不好', '不肯退錢'][i];
            const cheat = shorting(w, s); // 有沒有偷斤減兩,看這個賣家自己定的做法
            rel(b, s)?.modifyAffinity?.(-6); b.addThought?.('cheated', w, s.agentId, s.name); rel(s, b)?.modifyAffinity?.(-2);
            mem(w, b, '今天{k}，以後不想再跟他買了。', { k: fill(k, { s: s.name }) }, 5);
            mem(w, s, '{b}又來找麻煩，說我{k}。', { b: b.name, k: t(k2) }, 4);
            log(w, 'social', '🛒 {b}跟{s}吵起來了：{k}。{c}', { b: b.name, s: s.name, k: fill(k, { s: s.name }), c: cheat ? t('🎭（{s}真的有偷斤減兩）').replace('{s}', s.name) : t('🎭（其實是原料漲價，{s}沒有騙人）').replace('{s}', s.name) }, b.name);
            if (cheat) { bump(w, s, 'lies'); wrong(w, s, b, 1, '賣東西坑了{v}', { v: b.name }); }
            if (cheat) { try { if (typeof WALLET !== 'undefined' && w.wallet) WALLET.pay(w, b, s, SHORT_GAIN); } catch (e) {} } // 坑到的錢是真的從買的人口袋到他口袋
            if (cheat) secret(w, { kind: 'cover', culprit: s.agentId, victim: b.agentId, k: '{s}賣東西真的偷斤減兩，坑了{b}', p: { s: s.name, b: b.name } });
            else D.mis.push({ kind: 'price', a: b.agentId, b: s.agentId, day: today });
        } else if (roll < 0.55) { // 借錢
            if (typeof WALLET !== 'undefined' && w.wallet) return; // v6.54.0 有個人錢包後,借錢由錢包系統處理(真的有錢移動)
            const r = pick(all.filter(a => (a.mood ?? 50) < 60) .concat(all)); const l = pick(all.filter(a => a !== r && aff(a, r) >= 0));
            if (!r || !l) return;
            const n = 10 + Math.floor(Math.random() * 4) * 10;
            D.debts.push({ l: l.agentId, r: r.agentId, n, day: today, due: today + 7 });
            mem(w, l, '{r}跟我借了 {n} 銀幣，說好一週後還。', { r: r.name, n }, 4);
            mem(w, r, '跟{l}借了 {n} 銀幣週轉。', { l: l.name, n }, 4);
            log(w, 'social', '🤝 {r}跟{l}借了 {n} 銀幣，說好一週後還。', { r: r.name, l: l.name, n }, r.name);
        } else if (roll < 0.8) { // 鄰居:寵物闖禍、半夜太吵
            const pets = (w.pets?.list || []).filter(p => p.owner && p.sp !== 'chicken');
            if (pets.length && Math.random() < 0.6) {
                const p = pick(pets); const o = w.agents[p.owner]; const n = o && pick(all.filter(a => a !== o)); if (!o || !n) return;
                rel(n, o)?.modifyAffinity?.(-5); n.addThought?.('neighbor_trouble', w, o.agentId, o.name);
                mem(w, n, '{o}家的{pet}又跑來把我的菜園挖得亂七八糟。', { o: o.name, pet: t(p.name) }, 5);
                mem(w, o, '{n}跑來抱怨{pet}挖了他的菜園，我一直道歉。', { n: n.name, pet: t(p.name) }, 4);
                log(w, 'social', '🐾 {o}家的{pet}跑進{n}的菜園亂挖，{n}很不高興。', { o: o.name, pet: t(p.name), n: n.name }, n.name);
            } else {
                const owl = all.find(a => has(a, 'night_owl')), bird = all.find(a => has(a, 'early_bird') && a !== owl) || pick(all.filter(a => a !== owl));
                if (!owl || !bird) return;
                rel(bird, owl)?.modifyAffinity?.(-4); bird.addThought?.('neighbor_trouble', w, owl.agentId, owl.name);
                mem(w, bird, '{o}半夜還在敲敲打打，吵得我睡不著。', { o: owl.name }, 5);
                log(w, 'social', '🌙 {o}半夜太吵，{b}被吵得睡不著。', { o: owl.name, b: bird.name }, bird.name);
            }
        } else { // 情敵:兩個人喜歡同一個人
            for (const c of rnd(all, all.length)) {
                const fans = all.filter(a => a !== c && (a.relationships?.relationships?.[c.agentId]?.romanticInterest || 0) > 40);
                if (fans.length < 2) continue;
                const [a, b] = rnd(fans, 2);
                rel(a, b)?.modifyAffinity?.(-8); rel(b, a)?.modifyAffinity?.(-8);
                a.addThought?.('jealous', w, b.agentId, b.name); b.addThought?.('jealous', w, a.agentId, a.name);
                mem(w, a, '{b}最近一直跟{c}走很近，看了就不舒服。', { b: b.name, c: c.name }, 6);
                mem(w, b, '{a}也喜歡{c}？我不會讓的。', { a: a.name, c: c.name }, 6);
                log(w, 'social', '💘 {a}和{b}都喜歡{c}，兩人開始較勁。', { a: a.name, b: b.name, c: c.name }, a.name);
                break;
            }
        }
    }

    // 選舉的髒招:講對手壞話給選民聽、開空頭支票
    function smear(w, a, o) {
        const all = npcs(w); const voters = rnd(all.filter(v => v !== a && v !== o), 3);
        const kx = pick(DISS_LIE); const line = fill(kx, { who: o.name });
        for (const v of voters) { rel(v, o)?.modifyAffinity?.(-4); mem(w, v, '{a}拉票的時候跟我說：「{x}」', { a: a.name, x: line }, 5); }
        log(w, 'politics', '🗳️ {a}拉票時抹黑對手{o}：「{x}」🎭（其實是編的）', { a: a.name, o: o.name, x: line }, a.name);
        secret(w, { kind: 'slander', culprit: a.agentId, victim: o.agentId, k: '{a}選舉時造謠抹黑{c}（「{x}」）', p: { a: a.name, c: o.name, x: line } });
        return line;
    }
    function hollow(w, a) {
        const all = npcs(w);
        const promise = pick(['當選後每戶發 50 銀幣', '當選後保證不再缺糧', '當選後每週辦一次宴席', '當選後把路全部鋪成石板']);
        for (const v of rnd(all.filter(v => v !== a), 3)) { rel(v, a)?.modifyAffinity?.(3); mem(w, v, '{a}答應我們：「{x}」', { a: a.name, x: t(promise) }, 5); }
        log(w, 'politics', '🗳️ {a}開出支票：「{x}」🎭（根本做不到）', { a: a.name, x: t(promise) }, a.name);
        secret(w, { kind: 'promise', culprit: a.agentId, victim: null, k: '{a}的選舉承諾「{x}」是空頭支票', p: { a: a.name, x: t(promise) } });
        return promise;
    }
    // v9.26.0 給決策核心:這個候選人現在能用哪些手段(跟以前擲骰的是同一批人:不夠老實的才會動這個念頭)
    function campInfo(w, a) {
        const E = w.election; if (!a || !E?.active || E.phase !== 'campaign' || !Array.isArray(E.candidates) || !E.candidates.some(c => c.agentId === a.agentId)) return null;
        const opp = E.candidates.map(x => w.agents[x.agentId]).filter(x => x && x !== a && !x.isPlayer && !x.isDead);
        return { opp, left: E.campaignDaysLeft || 0, smear: honesty(a) <= 2 && malice(a) >= 1 && opp.length > 0, hollow: honesty(a) <= 2 };
    }
    function smearBy(w, a, oid) { const I = campInfo(w, a); const o = I && I.smear ? I.opp.find(x => x.agentId === oid) : null; return o ? { o, line: smear(w, a, o) } : null; }
    function hollowBy(w, a) { const I = campInfo(w, a); return I && I.hollow ? { x: hollow(w, a) } : null; }

    // ---------- 說謊:偷懶偷吃還推給別人;善意的謊言 ----------
    const pilferOk = (w, a) => honesty(a) <= 1 && (has(a, 'lazy') || has(a, 'glutton')) && !!w.stockpile;
    function pilferDo(w, a, v) {
        const all = npcs(w); const sp = w.stockpile;
        const food = has(a, 'glutton'); const what = food ? t('倉庫的食物') : t('工具');
        if (food) sp.consume?.('food', 8, w.tickCount, t('不見了')); else sp.consume?.('tools', 1, w.tickCount, t('壞了'));
        if (v) {
            for (const o of rnd(all.filter(x => x !== a && x !== v), 3)) { rel(o, v)?.modifyAffinity?.(-4); mem(w, o, '{a}說是{v}弄的：{what}。', { a: a.name, v: v.name, what }, 5); }
            v.addThought?.('wrongly_blamed', w); mem(w, v, '大家說{what}是我弄的，可是根本不是我！', { what }, 7);
            log(w, 'incident', '⚠️ {what}出了狀況，{a}說是{v}弄的。🎭（其實是{a}自己）', { what, a: a.name, v: v.name }, a.name);
            bump(w, a, 'lies'); wrong(w, a, v, 2, '把{what}推給{v}', { what, v: v.name });
            secret(w, { kind: 'cover', culprit: a.agentId, victim: v.agentId, k: '{what}其實是{a}弄的，還推給{v}', p: { what, a: a.name, v: v.name } });
        } else {
            log(w, 'incident', '⚠️ {what}出了狀況，沒人承認。🎭（其實是{a}）', { what, a: a.name }, a.name);
            secret(w, { kind: 'cover', culprit: a.agentId, victim: null, k: '{what}其實是{a}弄的，他一直裝作不知道', p: { what, a: a.name } });
        }
        return what;
    }
    const comfortOk = (a) => has(a, 'kind') || has(a, 'romantic');
    const sadFriend = (w, a) => npcs(w).find(b => b !== a && (b.mood ?? 50) < 30 && aff(a, b) >= 20) || null;
    function comfortDo(w, a, sad) {
        sad.moodModifier = (sad.moodModifier || 0) + 4; sad.addThought?.('comforted', w, a.agentId, a.name);
        mem(w, sad, '{a}跟我說大家其實都很喜歡我，心裡好受多了。', { a: a.name }, 5);
        log(w, 'social', '💗 {a}安慰心情低落的{b}：「大家其實都很喜歡你。」🎭（善意的謊言）', { a: a.name, b: sad.name }, a.name);
        bump(w, a, 'helped');
        secret(w, { kind: 'white', culprit: a.agentId, victim: sad.agentId, k: '{a}說「大家都很喜歡{b}」是善意的謊言', p: { a: a.name, b: sad.name } });
    }
    // v9.26.0 給決策核心。會動這些念頭的,跟以前擲骰的是同一批人;做不做由他自己決定
    function pilferInfo(w, a) {
        if (!a || !pilferOk(w, a)) return null; const food = has(a, 'glutton');
        let have = 0; try { have = w.stockpile.get(food ? 'food' : 'tools') || 0; } catch (e) {} if (have < (food ? 8 : 1)) return null; // 倉庫是空的就沒得拿
        const f = foeOf(w, a, null); return { food, foe: f ? f.b : null, why: f ? f.g.why : null, mal: malice(a) };
    }
    function pilferBy(w, a, blame) {
        const I = pilferInfo(w, a); if (!I) return null; const v = blame && I.foe ? I.foe : null;
        const what = pilferDo(w, a, v); a.moodModifier = (a.moodModifier || 0) + (I.food ? 3 : 2); // 吃飽了／省了力氣
        mem(w, a, v ? (I.food ? '我偷吃了倉庫的東西，還說是{v}拿的。' : '我把公家的工具弄壞了，還說是{v}弄的。') : (I.food ? '我偷吃了倉庫的東西，沒有人知道。' : '我把公家的工具弄壞了，裝作不知道。'), { v: v ? v.name : '' }, 5);
        return { what, v, food: I.food };
    }
    function comfortInfo(w, a) { if (!a || !comfortOk(a)) return null; const sad = sadFriend(w, a); return sad ? { sad } : null; }
    function comfortBy(w, a, how) {
        const I = comfortInfo(w, a); if (!I) return null; const sad = I.sad;
        if (how === 'lie') comfortDo(w, a, sad);
        else { sad.moodModifier = (sad.moodModifier || 0) + 2; rel(sad, a)?.modifyAffinity?.(2); mem(w, sad, '{a}來陪我坐了一會，沒多說什麼。', { a: a.name }, 4); mem(w, a, '{b}心情很差，我去陪他坐了一會。', { b: sad.name }, 4); bump(w, a, 'helped'); }
        return { sad, how };
    }
    // 做生意的手法:不夠老實的賣家自己決定要不要偷斤減兩(定下來以後,買賣糾紛是不是真的坑人就看這個,不再擲骰)
    const SHORT_GAIN = 3;
    const tradeOk = (a) => !!a && SELLERS.includes(a.job?.key) && honesty(a) <= 1.5;
    const shorting = (w, s) => tradeOk(s) && S(w).trade?.[s.agentId]?.k === 'short';
    function tradeInfo(w, a) { if (!tradeOk(a)) return null; const cur = S(w).trade?.[a.agentId] || null; return { cur: cur ? cur.k : null, since: cur ? cur.d : null, gain: SHORT_GAIN }; }
    function tradeSet(w, a, k) { if (!tradeOk(a) || !['fair', 'short'].includes(k)) return false; const D = S(w); D.trade = D.trade || {}; const was = D.trade[a.agentId]?.k || null; D.trade[a.agentId] = { k, d: day(w) }; return was !== k; }
    // 聽到有人說朋友壞話:去不去告訴當事人
    function tattleInfo(w, a, c) { const foe = w.agents[c?.foe], by = w.agents[c?.by]; return a && foe && by && !foe.isDead && !by.isDead && foe !== a && by !== a ? { foe, by, line: c.line || '' } : null; }
    function tattleBy(w, a, c) { const I = tattleInfo(w, a, c); if (!I) return null; mem(w, a, '我把{a}在背後說的話告訴了{c}。', { a: I.by.name, c: I.foe.name }, 5); confront(w, I.foe, I.by, I.line); return I; }

    // ---------- 陰謀:籌劃 → 動手 → 可能被拆穿 ----------
    function schemes(w) { // 要不要動手陷害由本人決定(sim-decide-life.js「跟某人結怨很深」)；這裡只負責讓籌劃好的事發生
        const D = S(w), today = day(w), all = npcs(w);
        // 動手(籌劃一兩天後)
        for (const s of D.secrets.filter(x => x.stage === 'plan' && today - x.day >= 1)) {
            const c = w.agents[s.culprit], v = w.agents[s.victim]; if (!c || !v) { s.stage = 'off'; s.found = true; continue; }
            s.stage = 'done'; s.day = today; act(w, s, c, v);
        }
    }
    // 現在能用哪幾招對付他(對方有提案在表決 → 可以私下拉票；對方的提案剛通過 → 可以搶功)
    function schemeKinds(w, v, today) {
        const P = w.proposals; const opts = ['frame', 'sabotage'];
        if (P?.items?.some(p => p.proposerId === v.agentId && p.status === 'open')) opts.push('lobby', 'lobby');
        if (P?.items?.some(p => p.proposerId === v.agentId && p.status === 'done' && today - (p.decidedDay || p.createdDay || 0) <= 10)) opts.push('credit');
        return opts;
    }
    // 開始籌劃(一兩天後動手)
    function plot(w, c, v, kind, why) {
        const D = S(w); D.cool[c.agentId] = day(w);
        const s = secret(w, { kind, stage: 'plan', culprit: c.agentId, victim: v.agentId, why, k: '{a}在籌劃陷害{v}', p: { a: c.name, v: v.name } });
        mem(w, c, '{v}，你等著瞧。', { v: v.name }, 6);
        log(w, 'scheme', '🕵️ {a}（{why}）開始盤算怎麼對付{v}……', { a: c.name, v: v.name, why: fill(WHY[why], { v: v.name }) }, c.name);
        return s;
    }
    // 這個人現在有沒有結怨很深、可以下手的對象：{ v, why, s(怨有多深), kinds }；沒有就回傳 null
    function schemeInfo(w, c) {
        const D = S(w), today = day(w); if (D.secrets.filter(x => x.stage === 'plan').length >= 2 || (today - (D.cool[c.agentId] ?? -99)) < 20) return null;
        const f = foeOf(w, c, null); if (!f || f.g.s < 50) return null;
        return { v: f.b, why: f.g.why, s: f.g.s, kinds: [...new Set(schemeKinds(w, f.b, today))] };
    }
    function act(w, s, c, v) {
        const all = npcs(w).filter(a => a !== c && a !== v); const P = w.proposals; const sp = w.stockpile;
        if (s.kind === 'frame') {
            const silver = Math.min(25, sp?.get?.('silver') || 0); if (silver > 0 && sp.consume?.('silver', silver, w.tickCount, t('不見了')) && typeof WALLET !== 'undefined' && w.wallet) WALLET.add(w, c, silver); /* v7.6.0 錢進了主謀的口袋 */
            for (const o of rnd(all, 4)) { rel(o, v)?.modifyAffinity?.(-6); mem(w, o, '公庫少了銀幣，聽說是{v}拿的……', { v: v.name }, 6); }
            v.addThought?.('wrongly_blamed', w); mem(w, v, '公庫少了錢，大家都說是我拿的，可是我沒有！', {}, 8);
            log(w, 'incident', '⚠️ 公庫少了 {n} 銀幣，大家都在傳是{v}拿的。🕵️（其實是{a}栽贓）', { n: silver, v: v.name, a: c.name }, v.name);
            s.k = '公庫少的 {n} 銀幣是{a}拿的，還栽贓給{v}'; s.p = { n: silver, a: c.name, v: v.name };
        } else if (s.kind === 'sabotage') {
            const plots = (w.farm?.plots || []).filter(p => p.state === 'growing');
            if (v.job?.key === 'farmer' && plots.length) { for (const p of rnd(plots, 2)) p.state = 'withered'; }
            else sp?.consume?.('tools', 2, w.tickCount, t('被弄壞了'));
            v.addThought?.('work_ruined', w); mem(w, v, '我的東西被人動了手腳，到底是誰？', {}, 7);
            log(w, 'incident', '⚠️ {v}的工作被人動了手腳。🕵️（其實是{a}幹的）', { v: v.name, a: c.name }, v.name);
            s.k = '{a}偷偷破壞了{v}的工作'; s.p = { a: c.name, v: v.name };
        } else if (s.kind === 'lobby') {
            const p = P?.items?.find(x => x.proposerId === v.agentId && x.status === 'open');
            if (!p) { s.found = true; s.stage = 'off'; return; }
            let n = 0; for (const [vid, vote] of Object.entries(p.votes || {})) { const o = w.agents[vid]; if (n < 3 && vote === 'for' && o && o !== c && aff(o, c) >= 0) { p.votes[vid] = 'against'; n++; mem(w, o, '{a}私下跟我說{id}根本行不通，我就改投反對了。', { a: c.name, id: p.id }, 4); } }
            log(w, 'scheme', '🕵️ {a}私下拉票，想讓{v}的提案{id}過不了（{n} 人改投反對）。', { a: c.name, v: v.name, id: p.id, n }, c.name);
            s.k = '{a}私下拉票，讓{v}的提案{id}被否決'; s.p = { a: c.name, v: v.name, id: p.id };
        } else if (s.kind === 'credit') {
            const p = P?.items?.filter(x => x.proposerId === v.agentId && x.status === 'done').pop();
            const title = p ? (P.title?.(p) || p.id) : '';
            for (const o of rnd(all, 4)) { rel(o, c)?.modifyAffinity?.(3); mem(w, o, '{a}說「{x}」其實是他出的主意。', { a: c.name, x: title }, 4); }
            v.addThought?.('credit_stolen', w, c.agentId, c.name); mem(w, v, '「{x}」明明是我提的，{a}卻到處說是他的功勞。', { x: title, a: c.name }, 7);
            log(w, 'scheme', '🕵️ {a}到處說「{x}」是自己的主意，搶走了{v}的功勞。', { a: c.name, x: title, v: v.name }, c.name);
            s.k = '「{x}」明明是{v}提的，{a}卻搶走功勞'; s.p = { x: title, v: v.name, a: c.name };
        }
    }

    // ---------- 誤會(不是壞人,只是沒搞懂) ----------
    function misunderstand(w) {
        const D = S(w), today = day(w), all = npcs(w);
        if (D.mis.filter(m => !m.done).length < 4 && Math.random() < 0.35) {
            const shy = all.filter(a => has(a, 'shy'));
            const roll = Math.random();
            if (shy.length && roll < 0.5) { // 內向的人被當成冷漠、高傲
                const s = pick(shy); const x = pick(all.filter(a => a !== s && !has(a, 'shy')) || []);
                if (x && aff(x, s) < 40) {
                    rel(x, s)?.modifyAffinity?.(-4); x.addThought?.('snubbed', w, s.agentId, s.name);
                    mem(w, x, '跟{s}打招呼，他頭也不抬，是不是看不起我？', { s: s.name }, 5);
                    const knows = Math.random() < 0.5; if (knows) { s.addThought?.('misunderstood', w, x.agentId, x.name); mem(w, s, '我只是不太會跟人說話，{x}好像以為我很冷漠……', { x: x.name }, 5); }
                    log(w, 'social', '😶 {x}以為{s}很冷漠、看不起人。🎭（其實{s}只是害羞）', { x: x.name, s: s.name }, x.name);
                    D.mis.push({ kind: 'cold', a: x.agentId, b: s.agentId, day: today });
                }
            } else if (roll < 0.75) { // 吃醋:看到伴侶跟別人有說有笑
                const j = all.find(a => has(a, 'jealous') && a.relationships?.getPartner?.()); const pr = j?.relationships?.getPartner?.();
                const partner = pr && w.agents[pr.targetId]; const other = partner && pick(all.filter(a => a !== j && a !== partner));
                if (j && partner && other) {
                    j.addThought?.('suspicious', w, other.agentId, other.name); rel(j, other)?.modifyAffinity?.(-6); rel(j, partner)?.modifyAffinity?.(-3);
                    partner.addThought?.('misunderstood', w, j.agentId, j.name);
                    mem(w, j, '看到{p}跟{o}有說有笑，心裡很不是滋味。', { p: partner.name, o: other.name }, 6);
                    mem(w, partner, '我只是跟{o}聊個天，{j}就擺臉色給我看。', { o: other.name, j: j.name }, 5);
                    log(w, 'social', '😤 {j}看到{p}跟{o}有說有笑，吃起醋來。🎭（其實只是普通聊天）', { j: j.name, p: partner.name, o: other.name }, j.name);
                    D.mis.push({ kind: 'jealous', a: j.agentId, b: partner.agentId, c: other.agentId, day: today });
                }
            } else { // 聽到半句話,以為在說自己
                const x = pick(all), y = pick(all.filter(a => a !== x));
                if (x && y && !has(x, 'stoic')) {
                    rel(x, y)?.modifyAffinity?.(-5); x.addThought?.('resentful', w, y.agentId, y.name);
                    mem(w, x, '經過的時候聽到{y}說「那個人真的很煩」，是在說我嗎？', { y: y.name }, 5);
                    log(w, 'social', '👂 {x}只聽到{y}半句話，以為是在說自己。🎭（{y}說的是別人）', { x: x.name, y: y.name }, x.name);
                    D.mis.push({ kind: 'overheard', a: x.agentId, b: y.agentId, day: today });
                }
            }
        }
        // 解開(善於社交的人會幫忙說開);拖太久就變成心結
        for (const m of D.mis) {
            if (m.done) continue;
            const a = w.agents[m.a], b = w.agents[m.b]; if (!a || !b) { m.done = true; continue; }
            const age = today - m.day; if (age < 1) continue;
            const mediator = npcs(w).find(o => o !== a && o !== b && has(o, 'charismatic') && aff(o, a) >= 20 && aff(o, b) >= 20);
            const p = 0.15 + (mediator ? 0.15 : 0) + (has(b, 'shy') ? 0 : 0.1) + (has(a, 'kind') ? 0.1 : 0);
            if (Math.random() < p) {
                m.done = true; m.ok = true;
                rel(a, b)?.modifyAffinity?.(8); rel(b, a)?.modifyAffinity?.(4);
                a.addThought?.('regret_misjudge', w, b.agentId, b.name); b.addThought?.('cleared_up', w, a.agentId, a.name);
                const why = { cold: '{b}只是害羞，不是看不起人', jealous: '{b}跟別人只是普通朋友', overheard: '{b}說的根本不是自己', price: '{b}漲價是因為原料變貴，不是在坑人' }[m.kind];
                mem(w, a, '原來是我誤會了：{why}。有點不好意思。', { why: fill(why, { b: b.name }) }, 6);
                mem(w, b, '跟{a}把話說開了，誤會解開，鬆了一口氣。', { a: a.name }, 6);
                if (mediator) { bump(w, mediator, 'helped'); mem(w, mediator, '幫{a}和{b}把誤會說開了。', { a: a.name, b: b.name }, 4); rel(a, mediator)?.modifyAffinity?.(3); rel(b, mediator)?.modifyAffinity?.(3); }
                log(w, 'social', '🤝 誤會解開：{a}知道{why}。{m}', { a: a.name, why: fill(why, { b: b.name }), m: mediator ? fill('（{m}幫忙說開的）', { m: mediator.name }) : '' }, a.name);
            } else if (age > 10) {
                m.done = true; rel(a, b)?.modifyAffinity?.(-5);
                mem(w, a, '跟{b}之間的疙瘩一直沒解開。', { b: b.name }, 5);
            }
        }
        if (D.mis.length > 20) D.mis = D.mis.filter(m => !m.done).concat(D.mis.filter(m => m.done).slice(-6)).slice(-20);
    }

    function daily(w) {
        S(w);
        try { rivalries(w); } catch (e) { console.warn('[Dark] rivalries', e); }
        try { disputes(w); } catch (e) { console.warn('[Dark] disputes', e); }
        try { const T = w.dark.trade; if (T) for (const id of Object.keys(T)) if (!w.agents[id] && !w.isAway?.(id)) delete T[id]; } catch (e) {}
        try { schemes(w); } catch (e) { console.warn('[Dark] schemes', e); }
        try { misunderstand(w); } catch (e) { console.warn('[Dark] mis', e); }
        try { discover(w); } catch (e) { console.warn('[Dark] discover', e); }
        // 道歉、原諒、報復由本人決定(決策核心);這裡只收掉沒人管的舊帳
        try { tidyWrongs(w); } catch (e) { console.warn('[Dark] wrongs', e); }
        try { cliqueDaily(w); } catch (e) { console.warn('[Dark] cliques', e); }
        try { laborDaily(w); } catch (e) { console.warn('[Dark] labor', e); }
    }
    // 給畫面(只有玩家看得到):還沒被拆穿的秘密、還沒解開的誤會
    function view(w) {
        const D = w.dark; if (!D) return { secrets: [], mis: [] };
        const nm = (id) => w.agents[id]?.name || '';
        return {
            secrets: D.secrets.filter(s => !s.found && s.stage !== 'off').slice(-8).reverse().map(s => ({ id: s.id, kind: s.kind, plan: s.stage === 'plan', text: fill(s.k, s.p), culprit: s.culprit, victim: s.victim })),
            mis: D.mis.filter(m => !m.done).slice(-6).map(m => ({ kind: m.kind, a: nm(m.a), b: nm(m.b) })),
            cliques: (D.cliques || []).map(c => ({ name: cliqueName(w, c), members: c.members.map(nm).filter(Boolean), against: c.against.map(nm).filter(Boolean) })),
            feuds: Object.entries(D.feuds || {}).filter(([, f]) => f.n >= 2).map(([k, f]) => ({ names: k.split('|').map(nm), n: f.n })).filter(f => f.names.every(Boolean)).slice(-4), // v6.73.1 有人離鎮或過世就不列出(原本會顯示「⚔️ vs 某某」)
        };
    }
    function about(w, a) { // 這個人身上的秘密與恩怨(村民卡、AI 用)
        const D = w.dark; const out = { secrets: [], grudge: null };
        if (D) out.secrets = D.secrets.filter(s => !s.found && s.stage !== 'off' && s.culprit === a.agentId && s.kind !== 'white').map(s => fill(s.k, s.p));
        const f = foeOf(w, a, null); if (f) out.grudge = { name: f.b.name, why: fill(WHY[f.g.why], { v: f.b.name }) };
        out.rep = D ? repLabel(w, a) : ''; const cq = D ? cliqueOf(w, a.agentId) : null; out.clique = cq ? cliqueName(w, cq) : '';
        out.owe = D ? [...new Set((D.wrongs || []).filter(x => !x.done && x.by === a.agentId).map(x => w.agents[x.to]?.name).filter(Boolean))].slice(0, 2) : [];
        out.hurt = D ? [...new Set((D.wrongs || []).filter(x => !x.done && x.to === a.agentId && !x.forgiven).map(x => w.agents[x.by]?.name).filter(Boolean))].slice(0, 2) : [];
        return out;
    }
    return { daily, badmouth, confront, grudge, foeOf, secret, reveal, view, about, malice, honesty, insight, S, reputation, repLabel, credibility, cliqueVote, cliqueOf, verdictVote, punish, proposeVerdict, wrong, apologies, revenge, bump,
        today: day, byChoice, byLife, schemeInfo, plot, malice, wrongById, wrongId, wrongLine, apologize, answer, deny, avenge: avengeS, letGo, faceUp, speak, talkOut, debtRepay, debtPart, debtExtend, debtDodge, WHY,
        byDark, campInfo, smearBy, hollowBy, pilferInfo, pilferBy, comfortInfo, comfortBy, tradeInfo, tradeSet, shorting, tattleInfo, tattleBy };
})();

// ---- 掛勾:每日、存檔、AI(要不要講壞話由本人決定，不再掛在聊天上) ----
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.verdict = { icon: '⚖️', label: '審判' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a) {
        if (p.kind === 'verdict') { const v = DARK.verdictVote(w, p, a); if (v) { p.votes[a.agentId] = v; (p.why || (p.why = {}))[a.agentId] = 'gut'; return; } }
        _rv.call(this, w, p, a);
        try {
            const cv = DARK.cliqueVote(w, p, a); if (cv && Math.random() < 0.6) { p.votes[a.agentId] = cv > 0 ? 'for' : 'against'; (p.why || (p.why = {}))[a.agentId] = cv > 0 ? 'relgood' : 'relbad'; }
            const pr = w.agents[p.proposerId]; if (pr) { const tg = DARK.reputation(w, pr); if (tg.includes('scheming') && p.votes[a.agentId] === 'for' && Math.random() < 0.4) p.votes[a.agentId] = 'against'; else if ((tg.includes('helpful') || tg.includes('honest')) && p.votes[a.agentId] === 'against' && Math.random() < 0.25) p.votes[a.agentId] = 'for'; }
        } catch (e) {}
    };
    const _daily = ProposalSystem.prototype.daily;
    ProposalSystem.prototype.daily = function (w) {
        try { const d = this._abs(w); if (w.observerMode && this._darkDay !== d) { this._darkDay = d; DARK.daily(w); } } catch (e) { console.warn('[Dark] daily', e); }
        return _daily.call(this, w);
    };
}
if (typeof World !== 'undefined') {
    // v6.53.2 新建城鎮(world.reset)不能帶入上一鎮的祕密、恩怨、名聲、小團體
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.dark = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.dark) d.dark = this.dark; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.dark = (data?.dark && Array.isArray(data.dark.secrets)) ? Object.assign({ secrets: [], mis: [], n: 0, cool: {}, spoke: {}, exposedCount: {} }, data.dark) : null; } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) {
        const b = _ab.call(this, world, a, other);
        try {
            const x = DARK.about(world, a); const add = [];
            if (x.grudge) add.push(t('心裡記恨{v}（{why}）').replace('{v}', x.grudge.name).replace('{why}', x.grudge.why));
            if (x.secrets.length) add.push(t('藏著秘密，怕被發現：') + x.secrets[0]);
            if (x.rep) add.push(t('大家眼中的我：') + x.rep);
            if (x.clique) add.push(t('我是{c}的人').replace('{c}', x.clique));
            if (x.owe.length) add.push(t('覺得對不起{v}，想找機會道歉').replace('{v}', x.owe.join(t('、'))));
            if (x.hurt.length) add.push(t('還在氣{v}').replace('{v}', x.hurt.join(t('、'))));
            if (add.length) b.mem = [...(b.mem || []).slice(0, 1), ...add, ...(b.mem || []).slice(1)];
        } catch (e) {}
        return b;
    };
    const _cp = CE._buildCharacterProfile;
    CE._buildCharacterProfile = function (agent) {
        const p = _cp.call(this, agent);
        try { const w = typeof window !== 'undefined' && window.rimtownApp?.world; const x = w && DARK.about(w, agent); if (x?.grudge) p.status = `${p.status}${t('；')}${t('心裡記恨{v}（{why}），聊天時可能會抱怨或說他壞話').replace('{v}', x.grudge.name).replace('{why}', x.grudge.why)}`; } catch (e) {}
        return p;
    };
}
if (typeof globalThis !== 'undefined') globalThis.DARK = DARK;
