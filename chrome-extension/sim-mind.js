// v6.68.0 村民的內心:每晚反思日記、人生野心、意見系統
// - 日記:重要人物每晚寫一句話總結今天(完整智能體模式一次問 AI 幾個人,否則用規則從今天最重要的記憶拼成)
// - 野心:依個性訂一個長期目標(當首長、發財、當神職、跟某人結婚、報仇、成名、出人頭地);每季檢討,達成就換下一個,太久沒進展可能放棄或轉向
// - 意見:每人對五個議題(稅、國王、宗教、新科技、外地人)有立場 -2～+2;讀報、跟朋友聊天、親身經歷會改變;選舉與提案投票都會看
const MIND = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 6, cat = 'reflection') => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', cat, k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clamp = (v) => Math.max(-2, Math.min(2, v));
    const ISSUES = { tax: ['稅', 'taxes'], king: ['國王', 'the king'], faith: ['宗教', 'religion'], tech: ['新科技', 'new technology'], out: ['外地人', 'outsiders'] };
    const AMB = {
        leader: { zh: '當上首長', en: 'become the town leader', icon: '🏛️' },
        rich:   { zh: '發大財', en: 'get rich', icon: '💰' },
        clergy: { zh: '成為宗教領袖', en: 'lead a faith', icon: '⛪' },
        love:   { zh: '跟{t}在一起', en: 'be with {t}', icon: '💞' },
        revenge:{ zh: '向{t}討回公道', en: 'get even with {t}', icon: '🗡️' },
        fame:   { zh: '成為鎮上的名人', en: 'become famous in town', icon: '⭐' },
        rise:   { zh: '出人頭地', en: 'rise in the world', icon: '🪜' },
        family: { zh: '讓家人過好日子', en: 'give my family a good life', icon: '🏡' },
        craft:  { zh: '把手藝練到登峰造極', en: 'master my craft', icon: '🎨' }, // v9.5.1 併入舊的「技藝登峰」夢想
    };
    const CRAFT = ['工藝', '藝術', '烹飪', '醫療', '智識', '建造', '種植'];
    const craftLv = (a) => { try { return Math.max(0, ...CRAFT.map(c => a.skills?.get?.(c)?.level || 0)); } catch (e) { return 0; } };
    for (const v of Object.values(AMB)) { try { I18N.registerName(v.zh, v.en); } catch (e) {} }
    const isNotable = (w, a) => { try { return typeof CROWD !== 'undefined' ? CROWD.isNotable(w, a) : true; } catch (e) { return true; } };
    // ---------- 意見 ----------
    function initOp(w, a) {
        const p = (w.faith?.of?.[a.agentId]?.piety || 30), c = cash(w, a), lv = (() => { try { return CLASS.level(w, a); } catch (e) { return 1; } })();
        const o = { tax: 0, king: 0, faith: 0, tech: 0, out: 0 };
        o.tax = (a.job?.key === 'mayor' || has(a, 'hardworking') ? 0.5 : 0) - (c < 20 ? 1 : 0) - (c > 200 ? 0.8 : 0);
        o.king = (lv >= 4 ? 1.2 : 0) - (c < 10 ? 0.8 : 0) + (has(a, 'stoic') ? 0.3 : 0) - (has(a, 'abrasive') ? 0.5 : 0);
        o.faith = (p - 45) / 25;
        o.tech = (has(a, 'creative') ? 1 : 0) + (a.job?.key === 'researcher' ? 1 : 0) - (p >= 70 ? 0.8 : 0) - ((a.age || 30) >= 50 ? 0.6 : 0) + ((a.age || 30) <= 25 ? 0.4 : 0);
        o.out = (has(a, 'kind') ? 0.8 : 0) + (has(a, 'optimist') ? 0.5 : 0) - (has(a, 'pessimist') ? 0.6 : 0) - (has(a, 'jealous') ? 0.5 : 0);
        for (const k of Object.keys(o)) o[k] = clamp(Math.round((o[k] + (Math.random() - 0.5) * 0.6) * 10) / 10);
        return o;
    }
    function S(w) {
        if (!w.mind || typeof w.mind.op !== 'object') w.mind = { op: {}, amb: {}, diary: {}, lastDay: null, lastAmb: null };
        const M = w.mind; for (const a of npcs(w)) if (!M.op[a.agentId]) M.op[a.agentId] = initOp(w, a);
        return M;
    }
    const opOf = (w, a) => S(w).op[a?.agentId] || null;
    function shift(w, a, k, n) { const o = opOf(w, a); if (o) o[k] = clamp(Math.round((o[k] + n) * 100) / 100); }
    // 讀報、跟朋友聊天會讓立場移動
    function drift(w, M) {
        const all = npcs(w);
        for (const a of all) {
            const o = M.op[a.agentId]; if (!o) continue;
            // 朋友的平均立場(交情越好越受影響)
            const fr = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 30 && M.op[r.targetId]).slice(0, 5);
            for (const k of Object.keys(ISSUES)) { if (!fr.length) break; const avg = fr.reduce((s, r) => s + M.op[r.targetId][k], 0) / fr.length; o[k] = clamp(o[k] + (avg - o[k]) * 0.02); }
            // 報紙的立場
            try { const P = typeof PRESS !== 'undefined' ? PRESS.paperOf(w, a) : null; if (P) { const tr = PRESS.trust(w, a, P) * 0.02; if (P.st === 'cons') { o.king = clamp(o.king + tr); o.tech = clamp(o.tech - tr); o.faith = clamp(o.faith + tr); } if (P.st === 'prog') { o.king = clamp(o.king - tr); o.tech = clamp(o.tech + tr); o.out = clamp(o.out + tr); } if (P.st === 'crown') o.king = clamp(o.king + tr * 1.5); } } catch (e) {}
            // 親身經歷:窮的人更討厭稅
            if (cash(w, a) < 5 && !(typeof DECIDE !== 'undefined' && DECIDE.pol && DECIDE.on?.(w))) o.tax = clamp(o.tax - 0.02); // v9.21.0 本人會自己重新想(選擇點 rethink),不再天天自動扣
        }
    }
    // 投票時立場相近的候選人加分(每個議題差距越小越好)
    function affinity(w, a, b) { const x = opOf(w, a), y = opOf(w, b); if (!x || !y) return 0; let s = 0; for (const k of Object.keys(ISSUES)) s += 1 - Math.abs(x[k] - y[k]) / 2; return s - 2.5; } // -2.5～+2.5
    function stanceText(w, a) {
        const o = opOf(w, a); if (!o) return '';
        const strong = Object.entries(o).filter(([, v]) => Math.abs(v) >= 0.8).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 3);
        if (!strong.length) return '';
        return `${t('你的立場')}${t('：')}${strong.map(([k, v]) => `${t(ISSUES[k][0])}${t(v > 0 ? '（支持）' : '（反對）')}`).join(t('、'))}`;
    }
    // ---------- 野心 ----------
    function pickAmb(w, a) {
        const opts = [];
        if (has(a, 'charismatic') || a.job?.key === 'mayor') opts.push(['leader', 3]);
        if (has(a, 'jealous') || has(a, 'hardworking') || a.job?.key === 'trader') opts.push(['rich', 3]);
        if ((w.faith?.of?.[a.agentId]?.piety || 0) >= 70 || a.job?.key === 'priest') opts.push(['clergy', 3]);
        const crush = Object.values(a.relationships?.relationships || {}).filter(r => (r.romanticInterest || 0) > 30 && r.status !== 'married' && w.agents[r.targetId] && !w.agents[r.targetId].isDead).sort((x, y) => y.romanticInterest - x.romanticInterest)[0];
        if (crush && (has(a, 'romantic') || Math.random() < 0.5)) opts.push(['love', 4, crush.targetId]);
        try { const foe = typeof DARK !== 'undefined' ? DARK.foeOf(w, a) : null; if (foe?.b) opts.push(['revenge', has(a, 'abrasive') || has(a, 'jealous') ? 4 : 2, foe.b.agentId]); } catch (e) {}
        if (has(a, 'creative') || has(a, 'gossip')) opts.push(['fame', 2]);
        if (has(a, 'creative') || has(a, 'perfectionist') || ['blacksmith', 'tailor', 'carpenter', 'cook', 'doctor', 'researcher'].includes(a.job?.key)) opts.push(['craft', has(a, 'perfectionist') ? 4 : 2]);
        opts.push(['rise', 1]); if (a.relationships?.getPartner?.() || (a._childNames || []).length) opts.push(['family', 2]);
        const tot = opts.reduce((s, o) => s + o[1], 0); let r = Math.random() * tot; for (const o of opts) { if ((r -= o[1]) <= 0) return { key: o[0], target: o[2] || null }; } return { key: 'rise' };
    }
    function ambText(w, A) { if (!A) return ''; const D = AMB[A.key]; if (!D) return ''; const tn = A.target && w.agents[A.target] ? w.agents[A.target].name : ''; return `${D.icon} ${t(D.zh).replace('{t}', t(tn))}`; }
    function achieved(w, a, A) {
        try {
            if (A.key === 'leader') { const b = TIERS.badge(w, a); return !!b && (b.cls === 'leader' || b.cls === 'king'); }
            if (A.key === 'rich') return cash(w, a) >= 300;
            if (A.key === 'clergy') return typeof FAITH2 !== 'undefined' && !!FAITH2.headRel(w, a);
            if (A.key === 'love') return a.relationships?.relationships?.[A.target]?.status === 'married' || a.relationships?.relationships?.[A.target]?.status === 'dating';
            if (A.key === 'revenge') { const t2 = w.agents[A.target]; return !t2 || t2.isDead || (w.dark?.rep?.[A.target]?.exposed || 0) >= 1; }
            if (A.key === 'fame') return Object.values(w.dark?.rep?.[a.agentId] || {}).reduce((s, n) => s + n, 0) >= 5 || (w.goods?.owned?.[a.agentId] || []).length > 0;
            if (A.key === 'rise') return CLASS.level(w, a) >= 3;
            if (A.key === 'family') return cash(w, a) >= 120 && (a.mood || 50) >= 60;
            if (A.key === 'craft') return craftLv(a) >= 15;
        } catch (e) {}
        return false;
    }
    function reviewAmb(w, M, d) {
        for (const a of npcs(w)) {
            if ((a.age || 30) < 16) continue; let A = M.amb[a.agentId];
            if (!A) { const p = pickAmb(w, a); A = M.amb[a.agentId] = Object.assign(p, { since: d }); continue; }
            if (achieved(w, a, A)) {
                a.moodModifier = (a.moodModifier || 0) + 10; mem(w, a, '我終於做到了：{g}。接下來呢？', { g: { k: AMB[A.key].zh, p: { t: w.agents[A.target]?.name || '' } } }, 8);
                if (isNotable(w, a)) log(w, '🌟 {a}完成了人生心願：{g}', { a: a.name, g: { k: AMB[A.key].zh, p: { t: w.agents[A.target]?.name || '' } } }, a.name);
                (A.done || (A.done = [])); const done = (M.done || (M.done = {})); (done[a.agentId] || (done[a.agentId] = [])).push(A.key);
                M.amb[a.agentId] = Object.assign(pickAmb(w, a), { since: d }); continue;
            }
            if (d - A.since >= 60 && Math.random() < 0.3) {
                const old = A; const nw = pickAmb(w, a); if (nw.key === old.key) continue;
                a.moodModifier = (a.moodModifier || 0) - 4; mem(w, a, '{g}大概是做不到了，我想換個方向。', { g: { k: AMB[old.key].zh, p: { t: w.agents[old.target]?.name || '' } } }, 7);
                M.amb[a.agentId] = Object.assign(nw, { since: d });
            }
        }
    }
    // ---------- 日記 ----------
    function ruleDiary(w, a) {
        const today = (a.memory?.entries || []).filter(m => (w.tickCount - (m.tick || 0)) < 96).sort((x, y) => (y.importance || 0) - (x.importance || 0))[0];
        const mood = (a.mood || 50) >= 65 ? '心情不錯' : (a.mood || 50) < 40 ? '心裡很悶' : '平平淡淡';
        const A = w.mind?.amb?.[a.agentId];
        return { k: '今天{e}，{m}。{g}', p: { e: today ? { k: '{x}', p: { x: today.text ? today.text() : today.content } } : '沒什麼特別的事', m: mood, g: A ? { k: '我還是想{x}。', p: { x: { k: AMB[A.key].zh, p: { t: w.agents[A.target]?.name || '' } } } } : '' } };
    }
    async function diaries(w, M, d) {
        const who = npcs(w).filter(a => isNotable(w, a)).slice(0, 6); if (!who.length) return;
        const ce = w.conversationEngine; let ai = null;
        if (w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson) {
            try {
                const lines = who.slice(0, 4).map((a, i) => { const b = ce._agentBrief(w, a, null); return `${i + 1}. ${b.name}${t('（')}${b.job}${t('，')}${t('性格')}${t('：')}${b.traits}${t('）')}${t('：')}${(b.mem || []).slice(0, 4).join(' / ')}`; }).join('\n');
                const prompt = `${t('以下是幾位村民今天的狀況。請替每個人用第一人稱寫一句睡前日記（20 字內，像真人，可以有情緒）。只輸出 JSON 陣列')}${t('：')}["...","..."]\n${lines}`;
                ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 260); if (Array.isArray(j)) ai = j;
            } catch (e) {}
        }
        who.forEach((a, i) => {
            const line = ai && typeof ai[i] === 'string' && ai[i].trim() ? { k: '{x}', p: { x: String(ai[i]).trim().slice(0, 60) } } : ruleDiary(w, a);
            const arr = M.diary[a.agentId] || (M.diary[a.agentId] = []); arr.push({ day: d, k: line.k, p: line.p, ai: !!ai }); if (arr.length > 5) arr.splice(0, arr.length - 5);
            mem(w, a, line.k, line.p, 5);
        });
    }
    function daily(w) {
        const M = S(w), d = day(w); if (M.lastDay === d) return; M.lastDay = d;
        drift(w, M);
        if (M.lastAmb === null || d - M.lastAmb >= 15) { M.lastAmb = d; reviewAmb(w, M, d); }
        diaries(w, M, d);
    }
    // 經歷改變立場
    function onEvent(w, kind) {
        const all = npcs(w);
        if (kind === 'tax_up') for (const a of all) shift(w, a, 'tax', -0.3);
        // v9.9.0 拿掉從來沒被呼叫的 famine／immigrant 分支
        if (kind === 'research') for (const a of all) shift(w, a, 'tech', (w.ideaSystem?.openness?.(w, a, '') || 0) > 0 ? 0.15 : -0.1);
    }
    function brief(w, a) { const parts = [stanceText(w, a)]; const A = w.mind?.amb?.[a.agentId]; if (A) parts.push(`${t('你的人生心願')}${t('：')}${ambText(w, A).replace(/^\S+ /, '')}`); return parts.filter(Boolean).join(t('；')); }
    function lastDiary(w, a) { const arr = w.mind?.diary?.[a?.agentId]; if (!arr || !arr.length) return ''; const x = arr[arr.length - 1]; try { return Memory.render(x.k, x.p); } catch (e) { return ''; } }
    function poll(w) { const M = S(w); const all = npcs(w); return Object.keys(ISSUES).map(k => { const v = all.map(a => M.op[a.agentId]?.[k] || 0); return { k, name: t(ISSUES[k][0]), avg: Math.round(v.reduce((s, x) => s + x, 0) / Math.max(1, v.length) * 10) / 10, pro: v.filter(x => x >= 0.5).length, con: v.filter(x => x <= -0.5).length }; }); }
    return { ISSUES, AMB, craftLv, S, opOf, shift, drift, affinity, stanceText, pickAmb, ambText, achieved, reviewAmb, ruleDiary, diaries, daily, onEvent, brief, lastDiary, poll };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) MIND.daily(w); } catch (e) { console.warn('[Mind] daily', e); } return r; };
    // 稅率提案:依自己對稅的立場加權
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { const r = _rv.call(this, w, p, a, ...rest); try { if (w.mind && p.kind === 'tax') { const o = MIND.opOf(w, a); if (o && Math.abs(o.tax) >= 1) p.votes[a.agentId] = (p.dir === 'up') === (o.tax > 0) ? 'for' : 'against'; } if (w.mind && p.kind === 'research') { const o = MIND.opOf(w, a); if (o && Math.abs(o.tech) >= 1.2) p.votes[a.agentId] = o.tech > 0 ? 'for' : 'against'; } } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.mind && MIND.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
// 經歷:研究完成、加稅王令
if (typeof IdeaSystem !== 'undefined') { const IP = IdeaSystem.prototype; const _d = IP.onResearchComplete; IP.onResearchComplete = function (w, key, ...rest) { const r = _d.call(this, w, key, ...rest); try { if (w.mind) MIND.onEvent(w, 'research'); } catch (e) {} return r; }; }
if (typeof CIVIC !== 'undefined') { const _at = CIVIC.applyTax; CIVIC.applyTax = function (w, p) { const r = _at.call(this, w, p); try { if (r && p.dir === 'up' && w.mind) MIND.onEvent(w, 'tax_up'); } catch (e) {} return r; }; }
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.mind = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.mind) d.mind = this.mind; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.mind = (data?.mind && typeof data.mind.op === 'object') ? data.mind : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.MIND = MIND;
