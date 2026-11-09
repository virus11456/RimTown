// v6.69.0 政治深化:競選辯論、議會私下交換條件與倒戈、外交談判、法庭審判與翻案
// - 辯論:選舉期間候選人公開辯論,互相攻擊對方的弱點(立場、被揭過的醜聞、提案戰績);在場的人看誰講得好(口才、魅力),報社報導;完整智能體模式由 AI 寫辯詞
// - 議會:議員提案時私下拉一位交情好的議員「這次你挺我,下次我挺你」;輪到對方提案時要還人情,不老實的人可能倒戈
// - 外交談判:使節出使時(完整智能體模式)由 AI 同時扮演使節與對方領袖,談出條約、聯姻、賠償或破局
// - 法庭:被栽贓的人可能被告上法庭;審判時控方、辯方、法官陳詞,辯護好壞影響陪審票;冤案日後可能被翻案,真兇改被起訴
const POLITICS = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const honest = (a) => { try { return DARK.honesty(a); } catch (e) { return 3; } };
    const speak = (a) => (has(a, 'charismatic') ? 3 : 0) + (has(a, 'abrasive') ? -1 : 0) + (has(a, 'shy') ? -2 : 0) + ((a.skills?.skills?.社交?.level || 0) * 0.5) + Math.random() * 2;
    function S(w) { if (!w.politics || typeof w.politics.pacts !== 'object') w.politics = { pacts: [], debates: [], trials: {}, appeals: [], lastDay: null }; const P = w.politics; P.pacts = P.pacts || []; P.trials = P.trials || {}; return P; }
    // ---------- 辯論 ----------
    function weakness(w, me, foe) {
        const out = [];
        try { const r = w.dark?.rep?.[foe.agentId]; if (r && (r.exposed || 0) >= 1) out.push(['scandal', { c: foe.name }]); } catch (e) {}
        try { const rec = w.proposals?.record?.(foe.agentId); if (rec && (rec.rejected || 0) >= 2) out.push(['record', { c: foe.name, n: rec.rejected }]); } catch (e) {}
        try { const a = MIND.opOf(w, me), b = MIND.opOf(w, foe); if (a && b) { const k = Object.keys(MIND.ISSUES).sort((x, y) => Math.abs(b[y] - a[y]) - Math.abs(b[x] - a[x]))[0]; if (Math.abs(b[k] - a[k]) >= 1) out.push(['stance', { c: foe.name, i: MIND.ISSUES[k][0], s: b[k] > 0 ? '支持' : '反對' }]); } } catch (e) {}
        if (!out.length) out.push(['vague', { c: foe.name }]);
        return out[Math.floor(Math.random() * out.length)];
    }
    const LINE = { scandal: '{c}自己都被報紙揭過底，憑什麼帶領大家？', record: '{c}的提案被否決了 {n} 次，這就是他的能力。', stance: '{c}竟然{s}{i}，這會害了大家！', vague: '{c}只會說好聽話，從來沒做過實事。' };
    async function debate(w, P, E, d) {
        const cands = (E.candidates || []).map(c => w.agents[c.agentId]).filter(Boolean); if (cands.length < 2) return null;
        const lines = cands.map((a, i) => { const foe = cands[(i + 1) % cands.length]; const [k, p] = weakness(w, a, foe); return { id: a.agentId, k: LINE[k], p, score: speak(a) }; });
        const ce = ai(w);
        if (ce) {
            try {
                const prompt = `${t('鎮上的選舉辯論。候選人')}${t('：')}${cands.map(a => { const b = ce._agentBrief(w, a, null); return `${b.name}${t('（')}${b.traits}${t('）')}`; }).join(t('、'))}${t('。')}${t('請替每位候選人寫一句攻擊對手或宣揚自己的辯詞（25 字內，口語），並判斷誰表現最好。只輸出 JSON')}${t('：')}{"lines":["...","..."],"best":0}`;
                ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 220);
                if (j && Array.isArray(j.lines)) { j.lines.forEach((s, i) => { if (lines[i] && typeof s === 'string' && s.trim()) { lines[i].k = '{x}'; lines[i].p = { x: s.trim().slice(0, 60) }; } }); if (Number.isInteger(j.best) && lines[j.best]) lines[j.best].score += 100; } // AI 判定的贏家就是贏家
            } catch (e) {}
        }
        for (let i = lines.length - 1; i >= 0; i--) { const a = w.agents[lines[i].id]; if (!a || a.isDead) lines.splice(i, 1); } if (lines.length < 2) return null; // v8.7.0 等 AI 的時候候選人可能過世或搬走了
        const win = lines.slice().sort((x, y) => y.score - x.score)[0]; const wa = w.agents[win.id];
        log(w, 'council', '🎤 選舉辯論登場！', {});
        for (const l of lines) { const a = w.agents[l.id]; log(w, 'council', '🎤 {a}：「{s}」', { a: a.name, s: { k: l.k, p: l.p } }, a.name); }
        log(w, 'council', '👏 大家都說{a}今晚辯得最好。', { a: wa.name }, wa.name);
        // 在場的人(約一半)對贏家加分、對被點名的輸家扣一點
        for (const v of npcs(w)) { if (cands.includes(v) || Math.random() > 0.5) continue; v.relationships.getOrCreate(wa.agentId, wa.name).modifyAffinity(4); mem(w, v, '我去看了選舉辯論，{a}講得最好。', { a: wa.name }, 5); }
        try { const R = w.press; if (R) for (const Pp of R.papers.filter(x => !x.banned)) PRESS.story(w, Pp, 'debate', '辯論會：{a}表現最好', { a: wa.name }, wa.agentId); } catch (e) {}
        const rec = { day: d, winner: wa.name, lines: lines.map(l => ({ name: w.agents[l.id].name, k: l.k, p: l.p })) }; P.debates.push(rec); if (P.debates.length > 4) P.debates.shift();
        return rec;
    }
    // ---------- 議會交換條件 ----------
    const isCouncil = (w, a) => (w.council?.members || []).includes(a?.agentId);
    function onProposal(w, p) {
        const P = S(w); const a = w.agents[p.proposerId]; if (!a || !isCouncil(w, a)) return;
        // 先還人情:有人欠我 → 這次他會挺我(之後再看他有沒有兌現)
        const partner = (w.council.members || []).map(id => w.agents[id]).filter(b => b && b !== a && aff(b, a) >= 10 && !P.pacts.some(x => x.from === a.agentId && x.to === b.agentId && !x.done)).sort((x, y) => aff(y, a) - aff(x, a))[0];
        if (!partner) return;
        P.pacts.push({ from: a.agentId, to: partner.agentId, prop: p.id, day: day(w), done: false });
        log(w, 'council', '🤝 {a}私下跟{b}談好：「這次你挺我，下次我挺你。」🕵️', { a: a.name, b: partner.name }, a.name);
        mem(w, partner, '我答應{a}這次投他的提案，他欠我一次。', { a: a.name }, 6);
    }
    function pactVote(w, p, voter) {
        const P = w.politics; if (!P) return null; const proposer = w.agents[p.proposerId]; if (!proposer) return null;
        // 我答應過要挺這個提案
        if (P.pacts.some(x => x.prop === p.id && x.to === voter.agentId)) return 'for';
        // 我欠提案人一次 → 還人情(或倒戈)
        const owe = P.pacts.find(x => x.from === voter.agentId && x.to === proposer.agentId && !x.done && x.prop !== p.id);
        if (!owe) return null; owe.done = true;
        if (honest(voter) < 2.5 && aff(voter, proposer) < 20 && Math.random() < 0.6) {
            owe.betrayed = true; log(w, 'council', '🔄 {a}倒戈了，沒有兌現對{b}的承諾！', { a: voter.name, b: proposer.name }, voter.name);
            proposer.relationships.getOrCreate(voter.agentId, voter.name).modifyAffinity(-20); mem(w, proposer, '{a}說好要挺我的提案，結果倒戈了。', { a: voter.name }, 8);
            return 'against';
        }
        mem(w, proposer, '{a}守信用，挺了我的提案。', { a: voter.name }, 5); proposer.relationships.getOrCreate(voter.agentId, voter.name).modifyAffinity(5);
        return 'for';
    }
    // ---------- 外交談判 ----------
    async function negotiate(w, pid, envoyName) {
        const ce = ai(w); if (!ce || typeof DIPLO === 'undefined') return null; const D = DIPLO.S(w); const p = (w.tidings?.places || []).find(x => x.id === pid); if (!p) return null;
        try {
            const prompt = `${t('請同時扮演兩邊：本鎮使節「')}${envoyName}${t('」與')}${t(p.name[0])}${t('的領袖，進行一場外交談判。目前雙方關係')} ${Math.round(D.rel[pid] || 0)}${t('（-100～100）。')}${t('談判結果只能是 treaty（簽約）、marriage（聯姻）、compensation（對方要求賠償）、none（破局）之一，並用一句話描述經過。只輸出 JSON')}${t('：')}{"result":"treaty","text":"..."}`;
            ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 160); if (!j || !['treaty', 'marriage', 'compensation', 'none'].includes(j.result)) return null;
            const text = String(j.text || '').slice(0, 80);
            if (j.result === 'treaty') { DIPLO.bump(w, pid, 15); if ((D.rel[pid] || 0) >= 20 && D.status[pid] !== 'ally') { D.status[pid] = 'trade'; } }
            if (j.result === 'marriage') DIPLO.bump(w, pid, 10);
            if (j.result === 'compensation') { const n = Math.min(60, w.stockpile?.get?.('silver') || 0); if (n && w.stockpile.consume('silver', n, w.tickCount, t('外交賠償'))) { try { if (typeof MONEY !== 'undefined') MONEY.flow(w, 'event', -n); } catch (e) {} } /* v8.8.0 賠給外地的錢記到「事件」 */ DIPLO.bump(w, pid, 8); }
            if (j.result === 'none') DIPLO.bump(w, pid, -5);
            log(w, 'event', '🕊️ 跟{p}的談判：{x}', { p: p.name[0], x: text }, envoyName);
            return { result: j.result, text };
        } catch (e) { return null; }
    }
    // ---------- 法庭 ----------
    // 被栽贓的人可能被告上法庭(冤案)
    function accuseFramed(w, P, d) {
        if (typeof DARK === 'undefined') return; const D = DARK.S(w);
        for (const s of (D.secrets || [])) {
            if (s.kind !== 'frame' || s.found || s.tried || d - (s.day || d) > 6) continue; const v = w.agents[s.victim]; if (!v || v.isDead) continue;
            if (Math.random() > 0.3) continue; s.tried = true;
            const accuser = npcs(w).filter(a => a !== v && aff(a, v) < 0 && a.agentId !== s.culprit).sort((x, y) => aff(x, v) - aff(y, v))[0] || npcs(w).find(a => a.job?.key === 'guard' && a !== v); if (!accuser) continue;
            const fake = DARK.secret(w, { kind: 'scheme', culprit: v.agentId, victim: accuser.agentId, k: '{v}偷拿了公庫的 {n} 銀幣', p: { v: v.name, n: s.p?.n || 20 }, wrongful: s.id }); fake.found = true;
            const pr = DARK.proposeVerdict(w, fake, v, accuser, accuser); if (pr) { pr.wrongful = s.id; log(w, 'council', '⚖️ {a}把{v}告上法庭，說公庫的錢是他拿的。🕵️（其實是被栽贓）', { a: accuser.name, v: v.name }, accuser.name); }
        }
    }
    async function trial(w, P, p) {
        if (P.trials[p.id]) return P.trials[p.id]; const c = w.agents[p.culprit]; if (!c) return null;
        const prosecutor = w.agents[p.victim] || w.agents[p.proposerId] || c; const judge = (typeof CROWN !== 'undefined' && CROWN.king(w)) || w.election?.currentMayor?.(w) || prosecutor;
        const defender = Object.values(c.relationships?.relationships || {}).filter(r => r.affinity >= 30 && w.agents[r.targetId] && !w.agents[r.targetId].isDead && w.agents[r.targetId] !== prosecutor).map(r => w.agents[r.targetId]).sort((x, y) => speak(y) - speak(x))[0] || c;
        const T = { id: p.id, pro: prosecutor.name, def: defender.name, judge: judge.name, proS: speak(prosecutor) + (p.wrongful ? -1 : 1), defS: speak(defender) + (p.wrongful ? 2 : 0), lines: null };
        T.lines = [{ who: prosecutor.name, k: '{c}的罪證確鑿，請大家主持公道。', p: { c: c.name } }, { who: defender.name, k: defender === c ? '我是清白的，請大家相信我。' : '{c}不是那種人，證據根本不夠。', p: { c: c.name } }, { who: judge.name, k: '請大家憑良心投票。', p: {} }];
        const ce = ai(w);
        if (ce) {
            try {
                const prompt = `${t('鎮上的審判：被告')}${c.name}${t('，罪名')}${t('：')}${p.dk ? Memory.render(p.dk, p.dp || {}) : ''}${t('。')}${t('控方')}${prosecutor.name}${t('、辯方')}${defender.name}${t('、法官')}${judge.name}${t('。請替三人各寫一句陳詞（25 字內）。只輸出 JSON 陣列')}${t('：')}["...","...","..."]`;
                ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 200); if (Array.isArray(j)) j.slice(0, 3).forEach((s, i) => { if (typeof s === 'string' && s.trim()) { T.lines[i].k = '{x}'; T.lines[i].p = { x: s.trim().slice(0, 60) }; } });
            } catch (e) {}
        }
        P.trials[p.id] = T;
        log(w, 'council', '⚖️ 審判{c}：控方{a}、辯方{b}、法官{j}。', { c: c.name, a: prosecutor.name, b: defender.name, j: judge.name }, c.name);
        for (const l of T.lines) log(w, 'council', '🗣️ {a}：「{s}」', { a: l.who, s: { k: l.k, p: l.p } }, l.who);
        return T;
    }
    // 陪審票:辯護好壞讓人改變心意
    function juryShift(w, p, v) {
        const T = w.politics?.trials?.[p.id]; if (!T || !v) return v;
        if (v === 'for' && Math.random() < Math.max(0, T.defS - T.proS) * 0.08) return 'against';
        if (v === 'against' && Math.random() < Math.max(0, T.proS - T.defS) * 0.08) return 'for';
        return v;
    }
    // 冤案翻案
    function appeals(w, P, d) {
        for (const a of P.appeals) {
            if (a.done || d - a.day < 2 || Math.random() > 0.12) continue; a.done = true;
            const v = w.agents[a.victim], f = w.agents[a.framer]; const real = (DARK.S(w).secrets || []).find(s => s.id === a.sec);
            log(w, 'council', '🔍 翻案！真相大白：{v}是被{f}栽贓的。', { v: v?.name || '', f: f?.name || '' }, f?.name || '');
            if (v) { const n = Math.min(30, w.stockpile?.get?.('silver') || 0); if (n && typeof WALLET !== 'undefined' && w.wallet) { w.stockpile.consume('silver', n, w.tickCount, t('冤案補償')); WALLET.add(w, v, n); } v.moodModifier = (v.moodModifier || 0) + 10; mem(w, v, '終於還我清白了。', {}, 9); for (const o of npcs(w)) if (o !== v && Math.random() < 0.5) o.relationships.getOrCreate(v.agentId, v.name).modifyAffinity(6); }
            if (f && real) { real.found = true; try { DARK.bump(w, f, 'exposed'); DARK.proposeVerdict(w, real, f, v || f, v || f); } catch (e) {} mem(w, f, '我栽贓的事被翻出來了。', {}, 9); }
        }
    }
    async function daily(w) {
        const P = S(w), d = day(w); if (P.lastDay === d) return; P.lastDay = d;
        const E = w.election; if (E?.active && E.phase === 'campaign' && E._debateKey !== (E.lastElectionDay + ':' + (E.candidates || []).length)) { E._debateKey = E.lastElectionDay + ':' + (E.candidates || []).length; debate(w, P, E, d); }
        accuseFramed(w, P, d);
        for (const p of (w.proposals?.items || [])) if (p.kind === 'verdict' && p.status === 'open' && !P.trials[p.id]) trial(w, P, p);
        if (typeof DARK !== 'undefined') appeals(w, P, d);
        P.pacts = P.pacts.filter(x => d - x.day <= 60);
    }
    function onPunish(w, p) { if (!p.wrongful) return; const P = S(w); const real = (DARK.S(w).secrets || []).find(s => s.id === p.wrongful); if (!real) return; P.appeals.push({ day: day(w), victim: p.culprit, framer: real.culprit, sec: real.id, done: false }); }
    function view(w) { const P = S(w); return { debates: P.debates.slice(-1).map(x => ({ winner: t(x.winner), lines: x.lines.map(l => `${t(l.name)}${t('：')}${Memory.render(l.k, l.p)}`) })), pacts: P.pacts.filter(x => !x.done).length, betrayals: P.pacts.filter(x => x.betrayed).length, trials: Object.values(P.trials).slice(-3).map(x => ({ pro: t(x.pro), def: t(x.def), judge: t(x.judge) })), appeals: P.appeals.filter(x => x.done).length }; }
    return { S, debate, onProposal, pactVote, negotiate, accuseFramed, trial, juryShift, appeals, daily, onPunish, view, weakness };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) POLITICS.daily(w); } catch (e) { console.warn('[Politics] daily', e); } return r; };
    const _cw = PS._createWith;
    PS._createWith = function (w, day, cand, a, ...rest) { const p = _cw.call(this, w, day, cand, a, ...rest); try { if (p && w.observerMode && p.kind !== 'verdict' && p.kind !== 'tax') POLITICS.onProposal(w, p); } catch (e) {} return p; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { const r = _rv.call(this, w, p, a, ...rest); try { const v = POLITICS.pactVote(w, p, a); if (v) { p.votes[a.agentId] = v; (p.why || (p.why = {}))[a.agentId] = 'pact'; } } catch (e) {} return r; };
}
if (typeof DARK !== 'undefined') {
    const _vv = DARK.verdictVote; DARK.verdictVote = function (w, p, a) { const v = _vv.call(this, w, p, a); try { return POLITICS.juryShift(w, p, v); } catch (e) { return v; } };
    const _pu = DARK.punish; DARK.punish = function (w, P, p) { const r = _pu.call(this, w, P, p); try { POLITICS.onPunish(w, p); } catch (e) {} return r; };
}
if (typeof DIPLO !== 'undefined') {
    const _act = DIPLO.act;
    DIPLO.act = function (w, D, choice, pid, ...rest) { const before = (D.log || []).length; const r = _act.call(this, w, D, choice, pid, ...rest); try { const last = (D.log || [])[D.log.length - 1]; if (r && D.log.length > before && last && /出使/.test(last.k)) POLITICS.negotiate(w, pid, last.p?.e || ''); } catch (e) {} return r; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.politics = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.politics) d.politics = this.politics; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.politics = (data?.politics && typeof data.politics.pacts === 'object') ? data.politics : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.POLITICS = POLITICS;
