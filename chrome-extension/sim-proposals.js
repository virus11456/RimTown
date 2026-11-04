// RimTown - sim-proposals.js：v6.26.0 村民主動提案系統（觀察者沙盒的核心迴圈）
// 村民依性格、職業與小鎮近況提出提案（L 編號），全鎮投票當參考；觀察者批准／否決／擱置，
// 三天沒處理就依票數自動定案；批准後由系統執行（蓋建築、開工廠、政令、贊助節慶、選產業、探險、宴席、救濟、考驗對策）。
// 掛在 world.proposals；simulation.js 每日呼叫 daily(world)，getState/serialize/loadSave 同步。
'use strict';

const PROPOSAL_KINDS = {
    build:      { icon: '🏗️', label: '建設' },
    factory:    { icon: '🏭', label: '工廠' },
    policy:     { icon: '📜', label: '政令' },
    festival:   { icon: '🎪', label: '節慶' },
    industry:   { icon: '⛏️', label: '產業' },
    expedition: { icon: '🗺️', label: '探險' },
    feast:      { icon: '🍲', label: '宴席' },
    relief:     { icon: '🤝', label: '救濟' },
    trial:      { icon: '⚖️', label: '考驗對策' },
    // v6.30.0 人際類
    mediate:    { icon: '🕊️', label: '調解' },
    honor:      { icon: '🏅', label: '表揚' },
    mentor:     { icon: '🎓', label: '帶徒弟' },
    // v6.30.0 對外類
    trade:      { icon: '🧭', label: '外銷' },
    envoy:      { icon: '🤝', label: '結盟' },
    recruit:    { icon: '📣', label: '招募' },
    // v6.37.0 村民全自主:原本留給玩家按的研究／買賣／升級，改由村民提案
    research:   { icon: '🔬', label: '研究' },
    market:     { icon: '🛒', label: '買賣' },
    upgrade:    { icon: '🔨', label: '升級' },
    industry_up:{ icon: '📈', label: '產業升級' },
};
// v6.37.0 鎮長裁決理由(鍵 → 顯示文字;顯示時才 t())
const MAYOR_WHY = {
    majority: '多數贊成', minority: '多數反對', cost: '公庫付不起', own_yes: '票數接近，鎮長自己也贊成', own_no: '票數接近，鎮長覺得不妥',
    wait: '票數接近，鎮長想再看看', quiet: '沒什麼人表態，鎮長拍板先做', nomayor: '鎮上沒有鎮長，照票數定案', revisit: '擱置幾天後鎮長重新拍板',
};
// v6.30.0 投票理由(鍵 → 顯示文字;顯示時才 t())
const VOTE_WHY = {
    value: '價值觀相合', wealth: '看重財富', work: '勤勞肯做', lazy: '懶得折騰', fun: '愛熱鬧', glutton: '貪吃', ascetic: '不愛鋪張', stoic: '不愛熱鬧', charm: '愛出風頭',
    adventure: '愛冒險', family: '顧家', shy: '怕生', care: '重視社群', kind: '心軟', greedy: '捨不得花錢', trial: '考驗當前', moodup: '政令會讓大家開心', mooddown: '政令會讓大家不開心', spend: '政令要花錢',
    pessimist: '悲觀', optimist: '樂觀', job: '跟自己這行有關', relgood: '跟提案人交情好', relbad: '跟提案人處不來', cost: '公庫不夠', gut: '憑直覺',
    feud: '想讓兩人和好', grudge: '跟當事人有過節', proud: '為同鄉驕傲', newcomer: '歡迎新面孔', crowded: '覺得鎮上夠擠了',
};
// 職業 → 偏好的建築／工廠
const PROPOSAL_JOB_BUILDINGS = {
    guard: ['watchtower', 'training_ground', 'town_walls'], farmer: ['granary', 'farm_irrigation', 'well_upgrade'], doctor: ['clinic_upgrade', 'garden'],
    trader: ['marketplace'], blacksmith: ['forge_bellows'], researcher: ['school'], cook: ['brewery', 'granary'], carpenter: ['school', 'marketplace'],
    priest: ['well_upgrade', 'garden'], mayor: ['town_walls', 'marketplace', 'school'], miner: ['forge_bellows', 'well_upgrade'], tailor: ['marketplace', 'clinic_upgrade'],
};
const PROPOSAL_JOB_FACTORIES = { cook: ['bakery', 'tea_house'], tailor: ['textile_mill'], trader: ['brewery', 'sugar_refinery', 'tea_house'], doctor: ['herbal_workshop'], carpenter: ['furniture_workshop'], farmer: ['bakery', 'sugar_refinery'] };
const PROPOSAL_POLICY_VALUES = { economy: ['財富', '冒險'], welfare: ['家庭', '社群', '和平'], defense: ['權力', '冒險'], culture: ['知識', '藝術'], nature: ['自然', '和平'], freedom: ['自由', '冒險'] };

class ProposalSystem {
    constructor() {
        this.counter = 0;          // L 編號
        this.items = [];           // 全部提案(含歷史),最多保留 60 筆
        this.cooldown = {};        // key → 最後提出的 absDay
        this.proposerCooldown = {}; // agentId → 最後提出的 absDay
        this.track = {};           // v6.30.0 每位村民的提案戰績 { made, approved, rejected, done }(選舉與名片用)
        this.stats = { made: 0, approved: 0, rejected: 0, shelved: 0, done: 0, failed: 0, auto: 0 };
        this._lastDay = null;
    }
    static MAX_OPEN = 4;
    static DECIDE_DAYS = 2; // v6.37.0 投票兩天後鎮長裁決(七成的人投完票、過了一天也會提早裁決)
    static SHELF_DAYS = 10;
    static WAIT_DAYS = 7;

    _abs(w) { return w._absDay ? w._absDay() : (w.clock.year * 60 + ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15 + w.clock.day); }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && a.currentLocation !== 'exploration'); }
    _fill(k, p) { let s = (typeof t === 'function') ? t(k) : k; for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof t === 'function' && typeof b === 'string' ? t(b) : String(b)); return s; }
    _hasValue(a, v) { const vs = a.personality?.values || []; return vs.includes(v) || (typeof t === 'function' && vs.includes(t(v))); }
    _hasTrait(a, tr) { return (a.personality?.traits || []).includes(tr); }
    open() { return this.items.filter(p => p.status === 'open'); }
    shelved() { return this.items.filter(p => p.status === 'shelved'); }
    pending() { return this.items.filter(p => p.status === 'open' || p.status === 'shelved'); }
    byId(id) { return this.items.find(p => p.id === id) || null; }
    _cost(p) { return p.cost || {}; }
    _affordable(w, p) { const c = this._cost(p); return Object.entries(c).every(([r, n]) => (w.stockpile?.get?.(r) || 0) >= n); }
    // v6.30.0 戰績
    _tr(aid) { return this.track[aid] || (this.track[aid] = { made: 0, approved: 0, rejected: 0, done: 0 }); }
    record(aid) { return this.track[aid] || { made: 0, approved: 0, rejected: 0, done: 0 }; }
    // v6.30.0 成效快照:執行當下記公庫／食物／平均心情／人口,十天後比
    _snapshot(w, day) { const n = this._npcs(w); return { day, silver: Math.round(w.stockpile?.get?.('silver') || 0), food: Math.round(w.stockpile?.get?.('food') || 0), mood: Math.round(n.length ? n.reduce((a, x) => a + (x.mood || 0), 0) / n.length : 0), pop: n.length }; }
    _outcome(w, p, day) {
        const now = this._snapshot(w, day), s = p.snap;
        p.outcome = { days: day - s.day, silver: now.silver - s.silver, food: now.food - s.food, mood: now.mood - s.mood, pop: now.pop - s.pop };
        const text = this.outcomeText(p.outcome);
        w.logMessageT?.('council', '📈 {id}「{title}」十天後：{text}', { id: p.id, title: this.title(p), text });
        w.dailyNews?.collectEvent?.('politics', `${p.id}${t('「')}${this.title(p)}${t('」')}${t('十天後')}${t('：')}${text}`, 5, [p.proposerName]);
        this._notify(w, 'outcome', p);
    }
    outcomeText(o) {
        if (!o) return '';
        const sg = (n) => (n > 0 ? '+' : '') + n;
        const parts = [];
        if (o.mood) parts.push(`${t('心情')} ${sg(o.mood)}`);
        if (o.silver) parts.push(`${t('公庫')} ${sg(o.silver)}`);
        if (o.food) parts.push(`${t('食物')} ${sg(o.food)}`);
        if (o.pop) parts.push(`${t('人口')} ${sg(o.pop)}`);
        return parts.length ? parts.join(t('、')) : t('鎮上沒什麼變化');
    }

    // ---------- 每日 ----------
    daily(w) {
        if (!w.observerMode) return;
        const day = this._abs(w);
        if (this._lastDay === day) return;
        this._lastDay = day;
        try { this._advance(w, day); } catch (e) { console.warn('[Proposals] advance', e); }
        try { this._vote(w); } catch (e) { console.warn('[Proposals] vote', e); }
        try { this._generate(w, day); } catch (e) { console.warn('[Proposals] generate', e); }
        if (this.items.length > 60) this.items = this.items.filter(p => p.status === 'open' || p.status === 'shelved' || p.status === 'approved').concat(this.items.filter(p => !['open', 'shelved', 'approved'].includes(p.status)).slice(-40));
    }
    _advance(w, day) {
        for (const p of this.items) {
            if (p._ruling) continue; // v6.39.0 鎮長還在想(LLM 回覆中)
            if (p.status === 'open') {
                // v6.37.0 上帝視角:觀察者不再批准／否決,由村民投票 + NPC 鎮長裁決
                const voted = Object.keys(p.votes || {}).length, pop = Math.max(1, this._npcs(w).length - 1);
                const age = day - p.createdDay;
                if (age >= ProposalSystem.DECIDE_DAYS || (age >= 1 && voted >= pop * 0.7)) this._mayorRule(w, p, day, false);
            } else if (p.status === 'shelved' && day - (p.shelvedDay || p.createdDay) >= 3) {
                this._mayorRule(w, p, day, true); // 擱置三天後鎮長一定給個答案
            } else if (p.status === 'shelved' && day - (p.shelvedDay || p.createdDay) >= ProposalSystem.SHELF_DAYS) {
                p.status = 'expired'; p.resolvedDay = day; p.result = '擱置太久，提案人自己收回了';
                this._notify(w, 'expired', p);
            } else if (p.status === 'approved') {
                this._execute(w, p, day);
            } else if (p.status === 'done' && p.snap && !p.outcome && day - p.snap.day >= 10) {
                this._outcome(w, p, day); // v6.30.0 成效追蹤
            }
        }
    }
    _count(p, v) { return Object.values(p.votes || {}).filter(x => x === v).length; }

    // ---------- 投票(全鎮參考票) ----------
    _vote(w) {
        const open = this.open(); if (!open.length) return;
        const eng = w.conversationEngine; const llmOn = !!(w.fullAgentMode && eng?.decideVotes);
        for (const p of open) {
            const batch = [];
            for (const a of this._npcs(w)) {
                if (a.agentId === p.proposerId || p.votes[a.agentId]) continue;
                if (Math.random() > 0.6) continue;
                if (llmOn && batch.length < 6 && !(p._llmAsked && p._llmAsked[a.agentId])) { batch.push(a); continue; }
                this._ruleVote(w, p, a);
            }
            if (batch.length) this._voteLLM(w, p, batch);
        }
    }
    // v6.39.0 完整智能體:一批村民交給 LLM 決定;失敗就退回規則
    async _voteLLM(w, p, voters) {
        p._llmAsked = p._llmAsked || {}; for (const a of voters) p._llmAsked[a.agentId] = true;
        let res = null;
        try { res = await w.conversationEngine.decideVotes(w, p, voters, w.agents[p.proposerId]); } catch (e) { console.warn('[Proposals] llm vote', e); }
        if (p.status !== 'open' && p.status !== 'shelved') return;
        for (const a of voters) {
            if (p.votes[a.agentId]) continue;
            const r = res && res[a.agentId];
            if (r) { p.votes[a.agentId] = r.vote; (p.why || (p.why = {}))[a.agentId] = 'llm:' + (r.why || ''); p.llm = true; }
            else this._ruleVote(w, p, a);
        }
        try { w.onProposalEvent?.('vote', this.toItem(w, p)); } catch (e) {}
    }
    _ruleVote(w, p, a) {
        let s = 0; const R = []; const add = (k, d) => { s += d; if (d) R.push([k, d]); }; // v6.30.0 記下每一分的理由
        const vals = PROPOSAL_POLICY_VALUES[p.category] || [];
        for (const v of vals) if (this._hasValue(a, v)) add('value', 2);
        if (p.kind === 'research') { if (this._hasValue(a, '知識')) add('value', 2); if (a.job?.key === 'researcher' || a.job?.key === 'doctor') add('job', 1); if (this._hasTrait(a, 'lazy')) add('lazy', -1); }
        if (p.kind === 'build' || p.kind === 'industry' || p.kind === 'factory' || p.kind === 'trade' || p.kind === 'upgrade' || p.kind === 'industry_up' || p.kind === 'market') { if (this._hasValue(a, '財富')) add('wealth', 1); if (this._hasTrait(a, 'hardworking')) add('work', 1); if (this._hasTrait(a, 'lazy')) add('lazy', -1); }
        if (p.kind === 'festival' || p.kind === 'feast' || p.kind === 'honor') { if (this._hasValue(a, '社群') || this._hasValue(a, '藝術')) add('fun', 2); if (this._hasTrait(a, 'glutton') && p.kind !== 'honor') add('glutton', 2); if (this._hasTrait(a, 'ascetic')) add('ascetic', -2); if (this._hasTrait(a, 'stoic')) add('stoic', -1); if (this._hasTrait(a, 'charismatic')) add('charm', 1); }
        if (p.kind === 'expedition' || p.kind === 'envoy') { if (this._hasValue(a, '冒險')) add('adventure', 3); if (this._hasValue(a, '家庭')) add('family', -1); if (this._hasTrait(a, 'shy')) add('shy', -1); }
        if (p.kind === 'relief' || p.kind === 'mediate' || p.kind === 'mentor') { if (this._hasValue(a, '社群') || this._hasValue(a, '和平')) add('care', 2); if (this._hasTrait(a, 'kind')) add('kind', 2); if (this._hasValue(a, '財富') && p.kind === 'relief') add('greedy', -1); }
        if (p.kind === 'mediate' && p.pair) { const r0 = a.relationships?.relationships?.[p.pair[0]], r1 = a.relationships?.relationships?.[p.pair[1]]; if ((r0?.affinity || 0) > 20 || (r1?.affinity || 0) > 20) add('feud', 2); if ((r0?.affinity || 0) < -30 || (r1?.affinity || 0) < -30) add('grudge', -2); }
        if (p.kind === 'honor' && p.refKey) { const r0 = a.relationships?.relationships?.[p.refKey]; if ((r0?.affinity || 0) > 20) add('proud', 2); if ((r0?.affinity || 0) < -20) add('grudge', -3); if (this._hasTrait(a, 'jealous')) add('grudge', -1); }
        if (p.kind === 'recruit') { if (this._hasValue(a, '社群') || this._hasTrait(a, 'optimist')) add('newcomer', 2); if (this._hasTrait(a, 'shy') || this._hasTrait(a, 'ascetic')) add('crowded', -2); }
        if (p.kind === 'trial') add('trial', 2);
        if (p.kind === 'policy' && p.effects) { if ((p.effects.mood_all || 0) < 0) add('mooddown', -2); if ((p.effects.mood_all || 0) > 0) add('moodup', 2); if ((p.effects.silver || 0) < 0) add('spend', -1); }
        if (this._hasTrait(a, 'pessimist')) add('pessimist', -1); if (this._hasTrait(a, 'optimist')) add('optimist', 1);
        if (a.job?.key && p.jobBias && p.jobBias.includes(a.job.key)) add('job', 2);
        const rel = a.relationships?.relationships?.[p.proposerId]; if (rel) { const d = (rel.affinity || 0) / 100 * 4; add(d >= 0 ? 'relgood' : 'relbad', d); }
        const silverCost = this._cost(p).silver || 0; if (silverCost && silverCost > (w.stockpile?.get?.('silver') || 0)) add('cost', -2);
        s += (Math.random() - 0.5) * 4;
        p.votes[a.agentId] = s >= 0 ? 'for' : 'against';
        const side = s >= 0 ? 1 : -1; let best = null; for (const [k, d] of R) if (Math.sign(d) === side && Math.abs(d) >= 0.5 && (!best || Math.abs(d) > Math.abs(best[1]))) best = [k, d];
        (p.why || (p.why = {}))[a.agentId] = best ? best[0] : 'gut';
    }

    // ---------- 生成 ----------
    _generate(w, day) {
        const open = this.open();
        if (open.length >= ProposalSystem.MAX_OPEN) return;
        const cands = this._candidates(w, day);
        if (!cands.length) return;
        const pickWeighted = (arr) => { const total = arr.reduce((s, c) => s + c.weight, 0); let r = Math.random() * total; for (const c of arr) { r -= c.weight; if (r <= 0) return c; } return arr[0]; };
        // v6.39.0 完整智能體:今天輪到發言的人自己決定要不要提、提什麼(一天一次 LLM);失敗退回規則
        const eng = w.conversationEngine;
        if (w.fullAgentMode && eng?.chooseProposal && eng.fullAgentOk?.(w)) {
            const pick = pickWeighted(cands);
            const a = this._proposer(w, day, pick.jobs || [], pick.pred); if (!a) return;
            const fits = (c) => !c.jobs || !c.jobs.length || c.jobs.includes(a.job?.key) || c === pick;
            const alts = [pick, ...cands.filter(c => c !== pick && fits(c)).sort((x, y) => y.weight - x.weight)].slice(0, 5);
            const summaries = alts.map(c => { const base = c.make(a); return { title: this._fill(base.tk, base.tp), desc: this._fill(base.dk, base.dp), cost: base.cost || {} }; });
            this._generateLLM(w, day, a, alts, summaries, pick);
            return;
        }
        const n = Math.random() < 0.72 ? 1 : (Math.random() < 0.35 ? 2 : 0);
        for (let i = 0; i < n && this.open().length < ProposalSystem.MAX_OPEN; i++) {
            const cs = this._candidates(w, day); if (!cs.length) return;
            this._create(w, day, pickWeighted(cs));
        }
    }
    async _generateLLM(w, day, a, alts, summaries, pick) {
        let r = null;
        try { r = await w.conversationEngine.chooseProposal(w, a, summaries); } catch (e) { console.warn('[Proposals] llm choose', e); }
        if (this.open().length >= ProposalSystem.MAX_OPEN) return;
        if (!r) { this._create(w, day, pick); return; }
        if (r.choice <= 0 || r.choice > alts.length) { this._lastPass = { day, who: a.name }; w.logMessageT?.('council', '🤔 {who}想了想，今天沒什麼要跟大家提的。', { who: a.name }, a.name); return; }
        const cand = alts[r.choice - 1];
        const p = this._createWith(w, day, cand, a);
        if (p) { if (r.pitch) p.pitch = r.pitch; p.llm = true; try { w.onProposalEvent?.('vote', this.toItem(w, p)); } catch (e) {} }
    }
    _proposer(w, day, jobs, pred) {
        const npcs = this._npcs(w).filter(a => (day - (this.proposerCooldown[a.agentId] || -99)) >= 5);
        let pool = npcs.filter(a => jobs.includes(a.job?.key));
        if (pred) { const p2 = pool.filter(pred); if (p2.length) pool = p2; }
        if (!pool.length && pred) pool = npcs.filter(pred);
        if (!pool.length) pool = npcs;
        if (!pool.length) return null;
        // 有話語權的人更常提:魅力、勤勞、樂觀、鎮長
        const wgt = (a) => 1 + (this._hasTrait(a, 'charismatic') ? 1.2 : 0) + (this._hasTrait(a, 'hardworking') ? 0.6 : 0) + (this._hasTrait(a, 'optimist') ? 0.4 : 0) + (a.job?.key === 'mayor' ? 1 : 0) - (this._hasTrait(a, 'shy') ? 0.6 : 0) - (this._hasTrait(a, 'lazy') ? 0.5 : 0);
        const tot = pool.reduce((s, a) => s + Math.max(0.2, wgt(a)), 0); let r = Math.random() * tot;
        for (const a of pool) { r -= Math.max(0.2, wgt(a)); if (r <= 0) return a; }
        return pool[pool.length - 1];
    }
    _cool(day, key, days = 12) { return (day - (this.cooldown[key] || -999)) >= days && !this.pending().some(p => p.key === key); }
    _candidates(w, day) {
        const out = [];
        const sp = w.stockpile; const silver = sp?.get?.('silver') || 0, food = sp?.get?.('food') || 0;
        const npcs = this._npcs(w); const avgMood = npcs.length ? npcs.reduce((s, a) => s + (a.mood || 0), 0) / npcs.length : 0;
        const BT = (typeof BUILDING_TEMPLATES !== 'undefined') ? BUILDING_TEMPLATES : {};
        const built = new Set([...(w.buildings?.completed || []), ...(w.buildings?.projects || [])].map(p => p.buildingKey || p.key || p.name));
        const builtNames = new Set([...(w.buildings?.completed || []), ...(w.buildings?.projects || [])].map(p => p.name));
        // 建設
        for (const [key, tm] of Object.entries(BT)) {
            if (built.has(key) || builtNames.has(tm.name) || !this._cool(day, 'build:' + key)) continue;
            const jobs = Object.entries(PROPOSAL_JOB_BUILDINGS).filter(([, ks]) => ks.includes(key)).map(([j]) => j);
            let weight = 1;
            if (key === 'granary' && food < 120) weight += 2; if (key === 'farm_irrigation' && food < 150) weight += 1.5;
            if ((key === 'watchtower' || key === 'town_walls' || key === 'training_ground') && w.trials?.current?.type === 'bandits') weight += 2;
            if (key === 'clinic_upgrade' && npcs.some(a => a.isSick || (a.health || 100) < 50)) weight += 2;
            if (key === 'marketplace' && silver < 100) weight += 1;
            const afford = Object.entries(tm.costs || {}).every(([r, n]) => (sp?.get?.(r) || 0) >= n * 0.6);
            if (!afford) weight *= 0.35;
            out.push({ kind: 'build', key: 'build:' + key, weight, jobs, make: (a) => ({ kind: 'build', key: 'build:' + key, refKey: key, tk: '在鎮上蓋{name}', tp: { name: tm.name }, dk: '{desc}', dp: { desc: tm.description }, cost: { ...(tm.costs || {}) }, category: ['watchtower', 'town_walls', 'training_ground'].includes(key) ? 'defense' : ['school', 'brewery'].includes(key) ? 'culture' : ['garden', 'clinic_upgrade', 'well_upgrade'].includes(key) ? 'welfare' : 'economy', jobBias: jobs }) });
        }
        // 工廠
        const FT = (typeof FACTORIES !== 'undefined') ? FACTORIES : {};
        if (w.processing) for (const [key, def] of Object.entries(FT)) {
            if (w.processing.builtFactories?.[key] || !this._cool(day, 'factory:' + key, 15)) continue;
            const jobs = Object.entries(PROPOSAL_JOB_FACTORIES).filter(([, ks]) => ks.includes(key)).map(([j]) => j);
            const afford = Object.entries(def.cost || {}).every(([r, n]) => (sp?.get?.(r) || 0) >= n * 0.6);
            out.push({ kind: 'factory', key: 'factory:' + key, weight: afford ? 0.8 : 0.25, jobs, make: (a) => ({ kind: 'factory', key: 'factory:' + key, refKey: key, tk: '開一間{name}', tp: { name: def.name }, dk: '{desc}', dp: { desc: def.description || def.desc || '' }, cost: { ...(def.cost || {}) }, category: 'economy', jobBias: jobs }) });
        }
        // 政令(沿用議會提案表)
        const CP = (typeof COUNCIL_PROPOSALS !== 'undefined') ? COUNCIL_PROPOSALS : [];
        const active = new Set((w.council?.activeDecrees || []).map(d => d.id));
        for (const cp of CP) {
            if (active.has(cp.id) || !this._cool(day, 'policy:' + cp.id, 20)) continue;
            if ((w.questSystem?.reputation || 0) + 20 < (cp.minRep || 0)) continue;
            const cost = {}; if ((cp.effects.silver || 0) < 0) cost.silver = -cp.effects.silver; if ((cp.effects.wood || 0) < 0) cost.wood = -cp.effects.wood; if ((cp.effects.stone || 0) < 0) cost.stone = -cp.effects.stone;
            const jobs = cp.category === 'defense' ? ['guard', 'mayor'] : cp.category === 'economy' ? ['trader', 'mayor', 'blacksmith'] : cp.category === 'culture' ? ['researcher', 'priest'] : cp.category === 'nature' ? ['farmer', 'priest'] : ['doctor', 'priest', 'mayor'];
            out.push({ kind: 'policy', key: 'policy:' + cp.id, weight: 0.7, jobs, make: (a) => ({ kind: 'policy', key: 'policy:' + cp.id, refKey: cp.id, tk: '{title}', tp: { title: cp.title() }, dk: '{desc}', dp: { desc: cp.desc() }, cost, effects: { ...cp.effects }, category: cp.category, jobBias: jobs }) });
        }
        // 節慶贊助
        const fs = w.festivals?.sponsorStatus?.(w);
        if (fs?.open && !fs.sponsored && this._cool(day, 'festival', 3)) out.push({ kind: 'festival', key: 'festival', weight: silver >= fs.cost ? 2.5 : 0.6, jobs: ['priest', 'cook', 'trader', 'mayor'], make: (a) => ({ kind: 'festival', key: 'festival', tk: '出錢把{fest}辦得更熱鬧', tp: { fest: fs.name }, dk: '從公庫撥 {n} 銀幣贊助{fest}：籌備更快、全鎮心情與聲望都會漲。', dp: { n: fs.cost, fest: fs.name }, cost: { silver: fs.cost }, category: 'culture', jobBias: ['priest', 'cook'] }) });
        // 產業(遊戲在等人選產業時,由村民提)
        const IND = (typeof INDUSTRIES !== 'undefined') ? INDUSTRIES : {};
        if (w.industry && (w.industry.needsIndustryChoice || w.industry._pendingUnlock) && Object.keys(w.industry.industries || {}).length < (w.industry.maxIndustries || 1)) {
            for (const [key, def] of Object.entries(IND)) {
                if (w.industry.industries?.[key] || !this._cool(day, 'industry:' + key, 6)) continue;
                out.push({ kind: 'industry', key: 'industry:' + key, weight: 1.6, jobs: [def.npcJob].filter(Boolean), make: (a) => ({ kind: 'industry', key: 'industry:' + key, refKey: key, tk: '把{name}做成鎮上的主業', tp: { name: def.name }, dk: '{who}說自己這行做得來，想帶幾個人一起把它做大。', dp: { who: a.name }, cost: {}, category: 'economy', jobBias: [def.npcJob] }) });
            }
        }
        // 探險
        if (w.exploration) for (const [zid, z] of Object.entries(w.exploration.discoveredZones || {})) {
            if (!z?.discovered || !w.exploration.canSendExpedition?.(zid) || !this._cool(day, 'exp:' + zid, 10)) continue;
            const zone = (typeof EXPLORATION_ZONES !== 'undefined') ? EXPLORATION_ZONES.find(x => x.id === zid) : null; if (!zone) continue;
            out.push({ kind: 'expedition', key: 'exp:' + zid, weight: 0.9, jobs: ['guard', 'researcher', 'miner'], pred: (a) => this._hasValue(a, '冒險'), make: (a) => ({ kind: 'expedition', key: 'exp:' + zid, refKey: zid, tk: '組隊去{zone}探險', tp: { zone: zone.name }, dk: '{who}想帶兩三個人去{zone}走一趟，約 {d} 天來回，可能帶回物資或發現。', dp: { who: a.name, zone: zone.name, d: zone.distance || 2 }, cost: {}, category: 'freedom', jobBias: ['guard', 'researcher'] }) });
        }
        // 宴席
        if (food >= 120 && avgMood < 58 && this._cool(day, 'feast', 10)) out.push({ kind: 'feast', key: 'feast', weight: 1.4, jobs: ['cook', 'tavern', 'trader'], make: (a) => ({ kind: 'feast', key: 'feast', tk: '辦一桌全鎮的宴席', tp: {}, dk: '{who}想用 40 份食物辦一頓大家一起吃的飯：全鎮心情 +6，吃過飯的人彼此更親近。', dp: { who: a.name }, cost: { food: 40 }, category: 'welfare', jobBias: ['cook'] }) });
        // 救濟
        const low = npcs.filter(a => (a.mood || 0) < 15).sort((x, y) => (x.mood || 0) - (y.mood || 0))[0];
        if (low && silver >= 60 && this._cool(day, 'relief:' + low.agentId, 15)) out.push({ kind: 'relief', key: 'relief:' + low.agentId, weight: 1.6, jobs: ['priest', 'doctor', 'mayor'], pred: (a) => this._hasTrait(a, 'kind'), make: (a) => ({ kind: 'relief', key: 'relief:' + low.agentId, refKey: low.agentId, tk: '撥一筆救濟金給{name}', tp: { name: low.name }, dk: '{name}最近過得很不好。{who}提議從公庫撥 20 銀幣幫一把，讓{name}喘口氣。', dp: { name: low.name, who: a.name }, cost: { silver: 20 }, category: 'welfare', jobBias: ['priest', 'doctor'] }) });
        // 考驗對策
        const tr = w.trials?.current;
        if (tr && tr.status === 'active' && this._cool(day, 'trial:' + tr.type, 8)) {
            const M = {
                famine:   { jobs: ['farmer', 'cook'], tk: '全鎮加班下田', dk: '糧荒當前，{who}提議接下來半個月大家都多下田：農產 +30%。', cost: {}, effects: { farm_bonus: 0.3 } },
                plague:   { jobs: ['doctor', 'priest'], tk: '組一支採藥隊', dk: '瘟疫蔓延，{who}提議花 30 銀幣組採藥隊進山：帶回 12 份草藥。', cost: { silver: 30 }, gain: { herbs: 12 } },
                pricewar: { jobs: ['trader', 'mayor'], tk: '聯合定價抗壓價', dk: '外地商人壓價，{who}提議全鎮聯合定價：賣價 +15%，先補 30 銀幣進公庫。', cost: {}, effects: { sell_bonus: 0.15 }, gain: { silver: 30 } },
                bandits:  { jobs: ['guard', 'mayor'], tk: '加派夜間巡邏', dk: '匪患在即，{who}提議守衛加派夜間巡邏：防衛 +2、襲擊機率下降。', cost: {}, effects: { defense_bonus: 2, raid_chance: -0.05 } },
            }[tr.type];
            if (M) out.push({ kind: 'trial', key: 'trial:' + tr.type, weight: 3, jobs: M.jobs, make: (a) => ({ kind: 'trial', key: 'trial:' + tr.type, refKey: tr.type, tk: M.tk, tp: {}, dk: M.dk, dp: { who: a.name }, cost: { ...M.cost }, effects: M.effects || null, gain: M.gain || null, category: tr.type === 'bandits' ? 'defense' : 'welfare', jobBias: M.jobs }) });
        }
        // ---------- v6.30.0 人際類 ----------
        // 調解:鎮上有一對結了怨的人(好感 ≤ −40),由神父／鎮長／醫生或心軟的人出面
        {
            let worst = null;
            for (const x of npcs) for (const [tid, r] of Object.entries(x.relationships?.relationships || {})) {
                if ((r.affinity || 0) > -40) continue; const y = w.agents[tid]; if (!y || y.isPlayer || y.isDead || !npcs.includes(y)) continue;
                const key = [x.agentId, tid].sort().join('|'); if (!this._cool(day, 'mediate:' + key, 20)) continue;
                if (!worst || r.affinity < worst.aff) worst = { x, y, aff: r.affinity, key };
            }
            if (worst) out.push({ kind: 'mediate', key: 'mediate:' + worst.key, weight: 1.5, jobs: ['priest', 'mayor', 'doctor'], pred: (a) => a.agentId !== worst.x.agentId && a.agentId !== worst.y.agentId && (this._hasTrait(a, 'kind') || this._hasValue(a, '和平')),
                make: (a) => ({ kind: 'mediate', key: 'mediate:' + worst.key, refKey: worst.key, pair: [worst.x.agentId, worst.y.agentId], tk: '替{a}和{b}調解', tp: { a: worst.x.name, b: worst.y.name }, dk: '{a}和{b}結怨很久了，{who}想擺一桌把兩人請來把話說開：花 10 銀幣，成了的話兩人關係回暖、全鎮氣氛也好一點。', dp: { a: worst.x.name, b: worst.y.name, who: a.name }, cost: { silver: 10 }, category: 'welfare', jobBias: ['priest', 'mayor', 'doctor'] }) });
        }
        // 表揚:技能最強或提案落實最多的人,鎮長／神父／學者提議公開表揚(士氣低時更想辦)
        if (this._cool(day, 'honor', 20) && npcs.length >= 4) {
            const score = (a) => (a.skills?.totalLevel || 0) + (this.record(a.agentId).done || 0) * 4;
            const star = npcs.slice().sort((x, y) => score(y) - score(x))[0];
            if (star && score(star) >= 6) out.push({ kind: 'honor', key: 'honor', weight: avgMood < 50 ? 1.4 : 0.7, jobs: ['mayor', 'priest', 'researcher'], pred: (a) => a.agentId !== star.agentId,
                make: (a) => ({ kind: 'honor', key: 'honor', refKey: star.agentId, tk: '公開表揚{name}', tp: { name: star.name }, dk: '{who}覺得{name}這陣子為鎮上出了最多力（{why}），想在廣場辦個小儀式表揚：花 15 銀幣，當事人心情大好、大家也更敬重他。', dp: { who: a.name, name: star.name, why: (this.record(star.agentId).done || 0) >= 2 ? '提案一件件落實' : '手藝是鎮上最好的' }, cost: { silver: 15 }, category: 'culture', jobBias: ['mayor', 'priest', 'researcher'] }) });
        }
        // 帶徒弟:同行裡有師傅(主技能 ≥ 4)與學徒(主技能 ≤ 1)
        if (this._cool(day, 'mentor', 18)) {
            const JS = (typeof JOB_SKILL_MAP !== 'undefined') ? JOB_SKILL_MAP : {};
            let pick = null;
            for (const m of npcs) {
                const prim = JS[m.job?.key]?.primary?.[0]; if (!prim) continue; const ml = m.skills?.skills?.[prim]?.level || 0; if (ml < 4) continue;
                const ap = npcs.find(x => x !== m && x.job?.key === m.job?.key && (x.skills?.skills?.[prim]?.level || 0) <= 1) || npcs.find(x => x !== m && (x.age || 30) < 26 && (x.skills?.skills?.[prim]?.level || 0) <= 1);
                if (ap && (!pick || ml > pick.ml)) pick = { m, ap, prim, ml };
            }
            if (pick) out.push({ kind: 'mentor', key: 'mentor', weight: 0.9, jobs: [pick.m.job?.key].filter(Boolean), pred: (a) => a.agentId === pick.m.agentId || a.job?.key === 'mayor' || a.job?.key === 'researcher',
                make: (a) => ({ kind: 'mentor', key: 'mentor', refKey: pick.m.agentId, pair: [pick.m.agentId, pick.ap.agentId], tk: '讓{m}收{ap}當徒弟', tp: { m: pick.m.name, ap: pick.ap.name }, dk: '{m}的{skill}是鎮上數一數二的，{who}提議讓{ap}跟著學一陣子：徒弟技能大進、兩人也會變熟。', dp: { m: pick.m.name, ap: pick.ap.name, skill: pick.prim, who: a.name }, cost: {}, skill: pick.prim, category: 'culture', jobBias: [pick.m.job?.key, 'researcher'].filter(Boolean) }) });
        }
        // ---------- v6.30.0 對外類 ----------
        // 外銷商隊:糧食或木材有餘、公庫不豐,商人想載出去賣
        {
            const wood = sp?.get?.('wood') || 0;
            const res = food >= 160 ? 'food' : wood >= 120 ? 'wood' : null;
            if (res && this._cool(day, 'trade', 12)) out.push({ kind: 'trade', key: 'trade', weight: silver < 300 ? 1.4 : 0.6, jobs: ['trader', 'farmer', 'carpenter'], make: (a) => ({ kind: 'trade', key: 'trade', refKey: res, tk: '派商隊把{res}載去鄰鎮賣', tp: { res: res === 'food' ? '餘糧' : '木材' }, dk: '{who}說倉庫的{res}放著也是放著，載 40 份去鄰鎮大約能換 55 銀幣回來；路上有一點被劫的風險。', dp: { who: a.name, res: res === 'food' ? '餘糧' : '木材' }, cost: { [res]: 40 }, category: 'economy', jobBias: ['trader'] }) });
        }
        // 派使者結盟:匪患當前或每隔一陣子,花 25 銀幣送禮換 20 天少被襲擊、也更吸引人搬來
        if (silver >= 25 && this._cool(day, 'envoy', 30) && !(w.council?.activeDecrees || []).some(d => d.id === 'prop_envoy')) out.push({ kind: 'envoy', key: 'envoy', weight: w.trials?.current?.type === 'bandits' ? 1.8 : 0.5, jobs: ['mayor', 'trader', 'guard'], pred: (a) => this._hasTrait(a, 'charismatic') || this._hasValue(a, '和平'),
            make: (a) => ({ kind: 'envoy', key: 'envoy', tk: '派使者去鄰鎮結盟', tp: {}, dk: '{who}願意帶著 25 銀幣的禮物走一趟鄰鎮談互保：20 天內襲擊機率下降、鎮上名聲也會傳出去。', dp: { who: a.name }, cost: { silver: 25 }, effects: { raid_chance: -0.08, immigration_chance: 0.05 }, category: 'defense', jobBias: ['mayor', 'guard'] }) });
        // 招募新居民:人口不多、糧食夠,貼告示請人搬來
        {
            const tp = (w.events?.TARGET_POPULATION || 12) + 3; const recentLeft = (w.movedOut || []).filter(m => day - (m.absDay || 0) <= 15).length;
            if (npcs.length < tp && food >= 80 && silver >= 30 && this._cool(day, 'recruit', 20)) out.push({ kind: 'recruit', key: 'recruit', weight: recentLeft ? 1.8 : 1.0, jobs: ['mayor', 'trader', 'priest'], make: (a) => ({ kind: 'recruit', key: 'recruit', tk: '貼告示招人搬來鎮上', tp: {}, dk: '{who}覺得鎮上人手不夠（現在 {n} 人），想花 30 銀幣到鄰鎮貼告示、備一間屋子，招一戶人家搬來。', dp: { who: a.name, n: npcs.length }, cost: { silver: 30 }, category: 'welfare', jobBias: ['mayor', 'trader'] }) });
        }
        // ---------- v6.37.0 村民全自主:研究／買賣／升級 ----------
        // 研究:沒在研究時，學者／相關行業提「研究某項」(三天沒人提，學者會自己挑)
        if (w.research && !w.research.current) {
            const REL = { agriculture: ['farmer'], metallurgy: ['blacksmith', 'miner'], medicine_research: ['doctor'], fortification: ['guard'], commerce: ['trader'], architecture: ['carpenter'], brewing: ['cook'], logistics: ['trader'], education: ['researcher'], masonry: ['miner', 'carpenter'] };
            for (const pr of (w.research.getAvailable?.() || [])) {
                if (!this._cool(day, 'research:' + pr.key, 6)) continue;
                const jobs = ['researcher', ...(REL[pr.key] || [])];
                let weight = 1.2; if (pr.key === 'agriculture' && food < 150) weight += 1; if (pr.key === 'medicine_research' && npcs.some(x => x.isSick || (x.health ?? 100) < 50)) weight += 1; if (pr.key === 'fortification' && w.trials?.current?.type === 'bandits') weight += 1;
                out.push({ kind: 'research', key: 'research:' + pr.key, weight, jobs, make: (a) => ({ kind: 'research', key: 'research:' + pr.key, refKey: pr.key, tk: '研究「{name}」', tp: { name: pr.name }, dk: '{who}覺得鎮上該把{name}研究出來：{desc}（要累積 {cost} 點研究進度）。', dp: { who: a.name, name: pr.name, desc: pr.description, cost: pr.cost }, cost: {}, category: 'culture', jobBias: jobs }) });
            }
        }
        // 買賣:大宗進貨(原料見底)／大宗拋售(倉庫爆了),由商人、鎮長提;日常小量補貨由 autonomy 自己做
        {
            const SI = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : {};
            for (const r of ['wood', 'stone', 'metal', 'cloth', 'herbs']) {
                if (!SI[r] || (sp?.get?.(r) || 0) >= 25 || silver < SI[r].buyPrice * 30 + 60 || !this._cool(day, 'market:buy:' + r, 8)) continue;
                const qty = 30, price = SI[r].buyPrice * qty;
                out.push({ kind: 'market', key: 'market:buy:' + r, weight: 1.3, jobs: ['trader', 'mayor', 'carpenter', 'blacksmith'], make: (a) => ({ kind: 'market', key: 'market:buy:' + r, refKey: r, qty, side: 'buy', tk: '進一批{item}備料', tp: { item: SI[r].name() }, dk: '{item}快見底了，{who}提議從公庫撥 {n} 銀幣去商店進 {qty} 份。', dp: { item: SI[r].name(), who: a.name, n: price, qty }, cost: { silver: price }, category: 'economy', jobBias: ['trader'] }) });
            }
            const foodCap = 400 + (w.buildings?.getEffect?.('food_capacity', 0) || 0);
            for (const r of Object.keys(SI)) {
                const have = sp?.get?.(r) || 0; const over = r === 'food' ? have > foodCap : have > 250;
                if (!over || !this._cool(day, 'market:sell:' + r, 8)) continue;
                const qty = r === 'food' ? Math.max(20, Math.floor(have - foodCap * 0.85)) : 80, gain = SI[r].sellPrice * qty;
                out.push({ kind: 'market', key: 'market:sell:' + r, weight: 1.4, jobs: ['trader', 'mayor', 'cook', 'farmer'], make: (a) => ({ kind: 'market', key: 'market:sell:' + r, refKey: r, qty, side: 'sell', tk: '把多出來的{item}賣掉', tp: { item: SI[r].name() }, dk: '{item}堆了 {have} 份，放著也是壞掉。{who}提議賣掉 {qty} 份，大約能進帳 {n} 銀幣。', dp: { item: SI[r].name(), who: a.name, have: Math.round(have), qty, n: gain }, cost: {}, category: 'economy', jobBias: ['trader'] }) });
            }
        }
        // 升級既有建築
        if (w.buildings?.getUpgradeable) for (const u of w.buildings.getUpgradeable(w)) {
            if (!this._cool(day, 'upgrade:' + u.buildingKey, 15)) continue;
            const jobs = Object.entries(PROPOSAL_JOB_BUILDINGS).filter(([, ks]) => ks.includes(u.buildingKey)).map(([j]) => j);
            out.push({ kind: 'upgrade', key: 'upgrade:' + u.buildingKey, weight: u.can_afford ? 0.9 : 0.3, jobs, make: (a) => ({ kind: 'upgrade', key: 'upgrade:' + u.buildingKey, refKey: u.buildingKey, tk: '把{name}升到 Lv{lv}', tp: { name: u.name, lv: u.nextLevel }, dk: '{who}提議升級：{desc}', dp: { who: a.name, desc: u.description }, cost: { ...u.costs }, category: 'economy', jobBias: jobs }) });
        }
        // 產業升級
        if (w.industry?.industries) for (const [key, data] of Object.entries(w.industry.industries)) {
            const def = IND[key]; const next = def?.levels?.find(l => l.lv === (data.level || 1) + 1); if (!next || !this._cool(day, 'indup:' + key, 12)) continue;
            const afford = Object.entries(next.cost || {}).every(([r, n]) => (sp?.get?.(r) || 0) >= n * 0.8);
            out.push({ kind: 'industry_up', key: 'indup:' + key, weight: afford ? 1.0 : 0.3, jobs: [def.npcJob, 'mayor'].filter(Boolean), make: (a) => ({ kind: 'industry_up', key: 'indup:' + key, refKey: key, tk: '把{name}升到 Lv{lv}「{lvname}」', tp: { name: def.name, lv: next.lv, lvname: next.name }, dk: '{who}覺得{name}該擴大了：升級後 {bonus}。', dp: { who: a.name, name: def.name, bonus: next.bonus || next.name }, cost: { ...(next.cost || {}) }, category: 'economy', jobBias: [def.npcJob].filter(Boolean) }) });
        }
        return out;
    }
    _create(w, day, cand) {
        const a = this._proposer(w, day, cand.jobs || [], cand.pred); if (!a) return null;
        return this._createWith(w, day, cand, a);
    }
    _createWith(w, day, cand, a) {
        const base = cand.make(a);
        this.counter++;
        const p = Object.assign({ id: 'L' + String(this.counter).padStart(3, '0'), n: this.counter, status: 'open', proposerId: a.agentId, proposerName: a.name, proposerJob: a.job?.key || '', createdDay: day, votes: {}, why: {}, decidedBy: null, result: '', pitch: '' }, base);
        this.items.push(p);
        this.cooldown[p.key] = day; this.proposerCooldown[a.agentId] = day; this.stats.made++; this._tr(a.agentId).made++;
        a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '我向鎮上提了 {id}「{title}」，看大家怎麼想。', { id: p.id, title: this.title(p) }, 5, [a.name]);
        w.logMessageT?.('council', '📜 {who}提出 {id}：{title}', { who: a.name, id: p.id, title: this.title(p) }, a.name);
        w.dailyNews?.collectEvent?.('politics', `${a.name}${t('提出提案')} ${p.id}${t('：')}${this.title(p)}`, 6, [a.name]);
        this._notify(w, 'new', p);
        return p;
    }

    // ---------- v6.37.0 鎮長裁決 ----------
    _mayor(w) { return this._npcs(w).find(a => a.job?.key === 'mayor') || null; }
    _mayorLean(m, p) {
        if (!m) return 0;
        let s = 0;
        for (const v of (PROPOSAL_POLICY_VALUES[p.category] || [])) if (this._hasValue(m, v)) s += 1;
        if (p.proposerId === m.agentId) s += 2;
        const rel = m.relationships?.relationships?.[p.proposerId]; if (rel) s += (rel.affinity || 0) / 50;
        if (this._hasTrait(m, 'greedy') && (this._cost(p).silver || 0) > 30) s -= 1;
        if (this._hasTrait(m, 'pessimist')) s -= 0.5; if (this._hasTrait(m, 'optimist')) s += 0.5;
        if (p.kind === 'trial' || p.kind === 'relief') s += 1;
        return s > 0.6 ? 1 : s < -0.6 ? -1 : 0;
    }
    _mayorRule(w, p, day, final) {
        const m = this._mayor(w);
        // v6.39.0 完整智能體:鎮長用 LLM 裁決(非同步);失敗退回下面的規則
        if (m && w.fullAgentMode && w.conversationEngine?.decideMayor && !p._ruling && p._llmRuledDay !== day) { p._ruling = true; this._mayorRuleLLM(w, p, day, final, m); return; }
        const f = this._count(p, 'for'), a = this._count(p, 'against'), total = f + a;
        const silver = w.stockpile?.get?.('silver') || 0, cost = this._cost(p).silver || 0;
        let action, why;
        if (!m) { action = f >= a ? 'approve' : 'reject'; why = 'nomayor'; }
        else if (cost > 40 && cost > silver * 1.5) { action = 'reject'; why = 'cost'; }
        else if (total === 0) { action = (final || Math.random() < 0.5) ? 'approve' : 'shelve'; why = action === 'approve' ? 'quiet' : 'wait'; }
        else if (f > a * 1.5) { action = 'approve'; why = 'majority'; }
        else if (a > f * 1.5) { action = 'reject'; why = 'minority'; }
        else {
            const lean = this._mayorLean(m, p);
            if (lean > 0) { action = 'approve'; why = 'own_yes'; }
            else if (lean < 0) { action = 'reject'; why = 'own_no'; }
            else if (!final && p.status === 'open' && Math.random() < 0.4) { action = 'shelve'; why = 'wait'; }
            else { action = f >= a ? 'approve' : 'reject'; why = final ? 'revisit' : (f >= a ? 'majority' : 'minority'); }
        }
        if (action === 'shelve' && p.status === 'shelved') { action = f >= a ? 'approve' : 'reject'; why = 'revisit'; }
        p.mayorName = m ? m.name : ''; p.mayorWhy = why;
        this.stats.auto++;
        this._decide(w, p, action, 'mayor');
    }
    async _mayorRuleLLM(w, p, day, final, m) {
        let r = null;
        try {
            const tally = { f: this._count(p, 'for'), a: this._count(p, 'against'), forWhy: this._whyTop(p, 'for').map(x => x.why), againstWhy: this._whyTop(p, 'against').map(x => x.why) };
            r = await w.conversationEngine.decideMayor(w, p, m, tally);
        } catch (e) { console.warn('[Proposals] llm mayor', e); }
        p._ruling = false;
        if (p.status !== 'open' && p.status !== 'shelved') return;
        if (!r) { p._llmRuledDay = day; this._mayorRule(w, p, this._abs(w), final); return; }
        let action = r.action;
        if (action === 'shelve' && (final || p.status === 'shelved')) action = this._count(p, 'for') >= this._count(p, 'against') ? 'approve' : 'reject';
        p.mayorName = m.name; p.mayorWhy = 'llm:' + (r.why || ''); p.llm = true;
        this.stats.auto++;
        this._decide(w, p, action, 'mayor');
    }
    mayorWhyText(p) { if (!p.mayorWhy) return ''; if (String(p.mayorWhy).startsWith('llm:')) return String(p.mayorWhy).slice(4); return t(MAYOR_WHY[p.mayorWhy] || p.mayorWhy); }

    // ---------- 觀察者決定(v6.37.0 起介面不再提供,保留給測試與舊流程) ----------
    decide(w, id, action) {
        const p = this.byId(id); if (!p) return { ok: false, msg: t('找不到這個提案') };
        if (p.status !== 'open' && p.status !== 'shelved') return { ok: false, msg: t('這個提案已經定案了') };
        if (!['approve', 'reject', 'shelve'].includes(action)) return { ok: false, msg: 'bad action' };
        if (action === 'shelve' && p.status === 'shelved') return { ok: false, msg: t('已經在擱置中') };
        this._decide(w, p, action, 'observer');
        return { ok: true, p };
    }
    _decide(w, p, action, by) {
        const day = this._abs(w); const a = w.agents[p.proposerId];
        p.decidedBy = by; p.decidedDay = day;
        const f = this._count(p, 'for'), ag = this._count(p, 'against');
        if (action === 'shelve') {
            p.status = 'shelved'; p.shelvedDay = day; this.stats.shelved++;
            a?.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{id} 被擱置了，再等等看。', { id: p.id }, 3, [p.proposerName]);
            this._notify(w, 'shelved', p); return;
        }
        if (action === 'approve') {
            p.status = 'approved'; p.approvedDay = day; this.stats.approved++; this._tr(p.proposerId).approved++;
            if (a) { a.moodModifier = (a.moodModifier || 0) + 5; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{id}「{title}」{how}批准了！', { id: p.id, title: this.title(p), how: by === 'auto' ? '依票數' : by === 'mayor' ? '被鎮長' : '被鎮上' }, 6, [p.proposerName]); }
            for (const [aid, v] of Object.entries(p.votes)) { const x = w.agents[aid]; if (x && v === 'for') x.moodModifier = (x.moodModifier || 0) + 1; }
            w.logMessageT?.('council', '✅ {id}「{title}」批准（{f} 贊成 / {a} 反對{auto}）', { id: p.id, title: this.title(p), f, a: ag, auto: by === 'auto' ? '，三天沒處理依票數定案' : by === 'mayor' ? `${t('，鎮長')}${p.mayorName || ''}${t('裁決：')}${this.mayorWhyText(p)}` : '' });
            w.dailyNews?.collectEvent?.('politics', `${p.id}${t('「')}${this.title(p)}${t('」')}${t('獲准')}${t('（')}${f}:${ag}${t('）')}`, 7, [p.proposerName]);
            this._notify(w, 'approved', p);
            this._execute(w, p, day);
        } else {
            p.status = 'rejected'; p.resolvedDay = day; this.stats.rejected++; this._tr(p.proposerId).rejected++; p.result = by === 'auto' ? '三天沒處理，依票數否決' : by === 'mayor' ? '鎮長否決' : '被否決';
            if (a) { a.moodModifier = (a.moodModifier || 0) - 4; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{id}「{title}」被否決了，有點失望。', { id: p.id, title: this.title(p) }, 6, [p.proposerName]); }
            for (const [aid, v] of Object.entries(p.votes)) { const x = w.agents[aid]; if (x && v === 'for') x.moodModifier = (x.moodModifier || 0) - 1; }
            w.logMessageT?.('council', '❌ {id}「{title}」否決（{f} 贊成 / {a} 反對{auto}）', { id: p.id, title: this.title(p), f, a: ag, auto: by === 'auto' ? '，三天沒處理依票數定案' : by === 'mayor' ? `${t('，鎮長')}${p.mayorName || ''}${t('裁決：')}${this.mayorWhyText(p)}` : '' });
            w.dailyNews?.collectEvent?.('politics', `${p.id}${t('「')}${this.title(p)}${t('」')}${t('被否決')}${t('（')}${f}:${ag}${t('）')}`, 6, [p.proposerName]);
            this._notify(w, 'rejected', p);
        }
    }

    // ---------- 執行 ----------
    _execute(w, p, day) {
        if (p.status !== 'approved') return;
        if (!this._affordable(w, p)) {
            p.waitDays = (p.waitDays || 0) + 1;
            if (p.waitDays > ProposalSystem.WAIT_DAYS) { p.status = 'failed'; p.resolvedDay = day; p.result = '等了一週公庫還是不夠，提案作罷'; this.stats.failed++; this._notify(w, 'failed', p); }
            return;
        }
        let ok = false, result = '';
        try {
            switch (p.kind) {
                case 'build': { const proj = w.buildings?.startProject?.(p.refKey, w, null); ok = !!proj; result = ok ? '動工了，村民正在蓋' : '沒辦法動工（已經有同名建築）'; break; }
                case 'factory': { const r = w.processing?.buildFactory?.(p.refKey, w); ok = !!r?.ok; result = ok ? '工廠動工' : (r?.error || '沒辦法動工'); break; }
                case 'policy': { ok = this._applyPolicy(w, p); result = ok ? '政令生效 20 天' : '無法施行'; break; }
                case 'festival': { const r = w.festivals?.sponsor?.(w, p.proposerName); ok = !!r?.ok; result = ok ? '贊助成功，節慶更熱鬧' : (r?.msg || '贊助失敗'); break; }
                case 'industry': { const r = w.industry?.chooseIndustry?.(p.refKey, w); ok = !!r?.ok; result = ok ? '產業開張' : (r?.error || '無法開張'); break; }
                case 'expedition': {
                    const a = w.agents[p.proposerId]; const mates = this._npcs(w).filter(x => x.agentId !== p.proposerId && (this._hasValue(x, '冒險') || x.job?.key === 'guard')).slice(0, 2);
                    const ids = [a, ...mates].filter(Boolean).map(x => x.agentId);
                    const exp = w.exploration?.sendExpedition?.(w, p.refKey, ids); ok = !!exp; result = ok ? `${exp.agentNames.join(t('、'))}${t('出發了')}` : '隊伍組不起來'; break;
                }
                case 'feast': {
                    w.stockpile.consume('food', 40, w.tickCount, t('全鎮宴席'), 'proposal');
                    for (const x of this._npcs(w)) { x.moodModifier = (x.moodModifier || 0) + 6; x.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{who}辦的宴席，全鎮一起吃了一頓。', { who: p.proposerName }, 5, [p.proposerName]); }
                    try { w.festivals?._boostRelationships?.(w, 0.25); } catch (e) {}
                    ok = true; result = '全鎮吃了一頓好的，心情 +6'; break;
                }
                case 'relief': {
                    const x = w.agents[p.refKey]; w.stockpile.consume('silver', 20, w.tickCount, t('救濟金'), 'proposal');
                    if (x) { x.moodModifier = (x.moodModifier || 0) + 15; x.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上撥了救濟金給我，{who}幫我說話。', { who: p.proposerName }, 7, [p.proposerName]); const rel = x.relationships?.getOrCreate?.(p.proposerId, p.proposerName); rel?.modifyAffinity?.(8); }
                    ok = true; result = `${x?.name || ''}${t('心情好多了')}`; break;
                }
                case 'trial': {
                    for (const [r, n] of Object.entries(this._cost(p))) w.stockpile.consume(r, n, w.tickCount, t('考驗對策'), 'proposal');
                    if (p.gain) for (const [r, n] of Object.entries(p.gain)) w.stockpile.add(r, n, w.tickCount, t('考驗對策'), 'player');
                    if (p.effects) this._addDecree(w, p, 15);
                    ok = true; result = '對策上路，全鎮動起來'; break;
                }
                // ---------- v6.30.0 ----------
                case 'mediate': {
                    const [xa, ya] = (p.pair || []).map(id => w.agents[id]); if (!xa || !ya) { result = '當事人不在鎮上了'; break; }
                    w.stockpile.consume('silver', 10, w.tickCount, t('調解飯局'), 'proposal');
                    const rx = xa.relationships?.getOrCreate?.(ya.agentId, ya.name), ry = ya.relationships?.getOrCreate?.(xa.agentId, xa.name);
                    const worked = Math.random() < 0.8; const d = worked ? 25 : 8;
                    rx?.modifyAffinity?.(d); ry?.modifyAffinity?.(d); rx?.modifyTrust?.(worked ? 10 : 2); ry?.modifyTrust?.(worked ? 10 : 2);
                    xa.moodModifier = (xa.moodModifier || 0) + (worked ? 4 : 1); ya.moodModifier = (ya.moodModifier || 0) + (worked ? 4 : 1);
                    xa.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', worked ? '{who}請我和{other}吃了一頓飯，把話說開了。' : '{who}想替我和{other}調解，但話還是沒說開。', { who: p.proposerName, other: ya.name }, 7, [p.proposerName, ya.name]);
                    ya.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', worked ? '{who}請我和{other}吃了一頓飯，把話說開了。' : '{who}想替我和{other}調解，但話還是沒說開。', { who: p.proposerName, other: xa.name }, 7, [p.proposerName, xa.name]);
                    rx?.addSharedMemory?.(t('一起吃了調解飯')); ry?.addSharedMemory?.(t('一起吃了調解飯'));
                    if (worked) for (const x of this._npcs(w)) x.moodModifier = (x.moodModifier || 0) + 1;
                    ok = true; result = worked ? '兩人把話說開了，關係回暖' : '飯吃了，但兩人還是有點僵'; break;
                }
                case 'honor': {
                    const x = w.agents[p.refKey]; if (!x) { result = '當事人不在鎮上了'; break; }
                    w.stockpile.consume('silver', 15, w.tickCount, t('表揚儀式'), 'proposal');
                    x.moodModifier = (x.moodModifier || 0) + 12; x.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上在廣場公開表揚了我，{who}提的。', { who: p.proposerName }, 8, [p.proposerName]);
                    for (const o of this._npcs(w)) { if (o === x) continue; const r = o.relationships?.getOrCreate?.(x.agentId, x.name); r?.modifyAffinity?.(this._hasTrait(o, 'jealous') ? -2 : 4); o.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上公開表揚了{name}。', { name: x.name }, 3, [x.name]); }
                    ok = true; result = `${x.name}${t('受到全鎮表揚，大家更敬重他了')}`; break;
                }
                case 'mentor': {
                    const [m, ap] = (p.pair || []).map(id => w.agents[id]); if (!m || !ap) { result = '師徒有人不在鎮上了'; break; }
                    const sk = ap.skills?.skills?.[p.skill]; const before = sk?.level || 0;
                    if (sk) { const need = (typeof xpForLevel === 'function') ? xpForLevel(before + 1) - sk.xp : 120; sk.addXp(Math.max(120, need + 10)); } // 至少升一級(Lv0→1 要 120 xp)
                    const after = sk?.level || 0;
                    m.relationships?.getOrCreate?.(ap.agentId, ap.name)?.modifyAffinity?.(10); ap.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyAffinity?.(12); ap.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyTrust?.(10);
                    ap.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '跟著{m}學了一陣子{skill}，進步很多。', { m: m.name, skill: p.skill }, 7, [m.name]); m.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '收了{ap}當徒弟，教他{skill}。', { ap: ap.name, skill: p.skill }, 6, [ap.name]);
                    ok = true; result = `${ap.name}${t('的')}${t(p.skill)} Lv${before} → Lv${after}`; break;
                }
                case 'trade': {
                    const res = p.refKey || 'food'; w.stockpile.consume(res, 40, w.tickCount, t('外銷商隊'), 'proposal');
                    const raided = Math.random() < 0.15; const earn = raided ? 20 + Math.round(Math.random() * 8) : 50 + Math.round(Math.random() * 12);
                    w.stockpile.add('silver', earn, w.tickCount, t('外銷商隊'), 'proposal'); if (w.questSystem) w.questSystem.reputation = (w.questSystem.reputation || 0) + 1;
                    const a = w.agents[p.proposerId]; a?.memory?.addT?.(w.tickCount, w.clock.timeStr, 'work', raided ? '押貨去鄰鎮路上遇了劫，只帶回 {n} 銀幣。' : '押貨去鄰鎮賣，帶回 {n} 銀幣。', { n: earn }, 6, []);
                    ok = true; result = raided ? `${t('路上遇劫，只帶回')} ${earn} ${t('銀幣')}` : `${t('商隊回來了，賺進')} ${earn} ${t('銀幣')}`; break;
                }
                case 'envoy': {
                    w.stockpile.consume('silver', 25, w.tickCount, t('結盟禮物'), 'proposal');
                    if (w.council) { w.council.activeDecrees = w.council.activeDecrees || []; w.council.activeDecrees.push({ id: 'prop_envoy', title: this.title(p), effects: { ...(p.effects || {}) }, expiresDay: day + 20 }); }
                    if (w.questSystem) w.questSystem.reputation = (w.questSystem.reputation || 0) + 4;
                    w.events?.conversationTopics?.push(`${p.proposerName}${t('去鄰鎮談成了互保')}`);
                    ok = true; result = '鄰鎮答應互保，20 天內襲擊機率下降'; break;
                }
                case 'recruit': {
                    w.stockpile.consume('silver', 30, w.tickCount, t('招募告示'), 'proposal');
                    const before = new Set(Object.keys(w.agents)); w.events?._spawnImmigrant?.(w);
                    const nid = Object.keys(w.agents).find(k => !before.has(k)); const nw = nid ? w.agents[nid] : null;
                    if (nw) { const a = w.agents[p.proposerId]; if (a) { nw.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(15); a.relationships?.getOrCreate?.(nw.agentId, nw.name)?.modifyAffinity?.(8); nw.memory?.addT?.(w.tickCount, w.clock.timeStr, 'immigration', '看到{who}貼的告示才搬來的，他幫我安頓了屋子。', { who: a.name }, 7, [a.name]); } }
                    ok = !!nw; result = nw ? `${nw.name}${t('看到告示搬來了')}` : '告示貼了，暫時沒人來'; break;
                }
                // ---------- v6.37.0 ----------
                case 'research': { ok = !!w.research?.startResearch?.(p.refKey); result = ok ? '學者們開始研究了' : '這項已經在研究或研究過了'; break; }
                case 'market': {
                    const r = p.side === 'buy' ? w.shop?.buy?.(p.refKey, p.qty, w) : w.shop?.sell?.(p.refKey, p.qty, w);
                    ok = !!r?.success; result = ok ? (p.side === 'buy' ? `${t('進了')} ${p.qty} ${t('份')}` : `${t('賣掉')} ${p.qty} ${t('份')}`) : (r?.msg || '沒買賣成'); break;
                }
                case 'upgrade': { const r = w.buildings?.startUpgrade?.(p.refKey, w); ok = !!r; result = ok ? '工匠開始升級了' : '沒辦法升級（正在升級或已到頂）'; break; }
                case 'industry_up': { const r = w.industry?.upgradeIndustry?.(p.refKey, w); ok = !!r?.ok; result = ok ? '產業升級了' : (r?.error || '沒辦法升級'); break; }
            }
        } catch (e) { console.warn('[Proposals] execute', e); ok = false; result = '執行時出了問題'; }
        p.status = ok ? 'done' : 'failed'; p.resolvedDay = day; p.result = result;
        if (ok) { this.stats.done++; this._tr(p.proposerId).done++; p.snap = this._snapshot(w, day); const a = w.agents[p.proposerId]; if (a) { a.moodModifier = (a.moodModifier || 0) + 3; } if (w.questSystem) w.questSystem.reputation = (w.questSystem.reputation || 0) + 2; }
        else this.stats.failed++;
        w.logMessageT?.('council', '{icon} {id}「{title}」{result}', { icon: ok ? '🏁' : '⚠️', id: p.id, title: this.title(p), result });
        w.dailyNews?.collectEvent?.('politics', `${p.id}${t('「')}${this.title(p)}${t('」')}${t(result)}`, ok ? 7 : 5, [p.proposerName]);
        this._notify(w, ok ? 'done' : 'failed', p);
    }
    _addDecree(w, p, days) {
        if (!w.council) return;
        const cur = this._abs(w);
        w.council.activeDecrees = w.council.activeDecrees || [];
        w.council.activeDecrees.push({ id: 'prop_' + p.id, title: this.title(p), effects: p.effects, expiresDay: cur + days });
    }
    _applyPolicy(w, p) {
        const e = p.effects || {}; const sp = w.stockpile; if (!sp) return false;
        const why = `${t('提案')}${t('：')}${this.title(p)}`;
        if ((e.silver || 0) < 0 && !sp.consume('silver', -e.silver, w.tickCount, why, 'proposal')) return false;
        if ((e.wood || 0) < 0 && !sp.consume('wood', -e.wood, w.tickCount, why, 'proposal')) return false;
        if ((e.stone || 0) < 0 && !sp.consume('stone', -e.stone, w.tickCount, why, 'proposal')) return false;
        if ((e.silver || 0) > 0) sp.add('silver', e.silver, w.tickCount, why, 'proposal');
        if (e.herbs) sp.add('herbs', e.herbs, w.tickCount, why, 'proposal');
        if (e.tools) sp.add('tools', e.tools, w.tickCount, why, 'proposal');
        if (e.mood_all) for (const a of this._npcs(w)) a.moodModifier = (a.moodModifier || 0) + e.mood_all;
        this._addDecree(w, p, 20);
        return true;
    }

    _notify(w, kind, p) { try { w.onProposalEvent?.(kind, this.toItem(w, p)); } catch (e) {} }

    // ---------- 文字與輸出 ----------
    title(p) { return this._fill(p.tk, p.tp); }
    desc(p) { return this._fill(p.dk, p.dp); }
    toItem(w, p) {
        const f = this._count(p, 'for'), a = this._count(p, 'against'); const day = this._abs(w);
        const names = (v) => Object.entries(p.votes || {}).filter(([, x]) => x === v).map(([id]) => w.agents?.[id]?.name || '').filter(Boolean);
        const K = PROPOSAL_KINDS[p.kind] || { icon: '📜', label: '' };
        return {
            id: p.id, n: p.n, kind: p.kind, icon: K.icon, kindLabel: t(K.label), status: p.status, title: this.title(p), desc: this.desc(p), pitch: p.pitch || '',
            proposerId: p.proposerId, proposerName: p.proposerName, proposerJob: w.agents?.[p.proposerId]?.job?.title || '',
            forCount: f, againstCount: a, forNames: names('for'), againstNames: names('against'),
            cost: this._cost(p), affordable: this._affordable(w, p), decidedBy: p.decidedBy, result: p.result ? t(p.result) : '',
            daysLeft: p.status === 'open' ? Math.max(0, ProposalSystem.DECIDE_DAYS - (day - p.createdDay)) : p.status === 'shelved' ? Math.max(0, ProposalSystem.SHELF_DAYS - (day - (p.shelvedDay || p.createdDay))) : 0,
            waitDays: p.waitDays || 0, createdDay: p.createdDay, resolvedDay: p.resolvedDay || null,
            forWhy: this._whyTop(p, 'for'), againstWhy: this._whyTop(p, 'against'), // v6.30.0 投票理由(前兩名)
            outcome: p.outcome || null, outcomeText: p.outcome ? this.outcomeText(p.outcome) : '', // v6.30.0 十天後成效
            mayorName: p.mayorName || '', mayorWhy: this.mayorWhyText(p), // v6.37.0 鎮長裁決
            llm: !!(p.llm || String(p.mayorWhy || '').startsWith('llm:') || Object.values(p.why || {}).some(k => String(k).startsWith('llm:'))), // v6.39.0 這件案子有 AI 推理的決定
        };
    }
    _whyTop(p, side) {
        const cnt = {}; for (const [aid, v] of Object.entries(p.votes || {})) { if (v !== side) continue; const k = p.why?.[aid] || 'gut'; cnt[k] = (cnt[k] || 0) + 1; }
        return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => ({ why: k.startsWith('llm:') ? k.slice(4) : t(VOTE_WHY[k] || VOTE_WHY.gut), n })); // v6.39.0 llm: 開頭是村民自己說的理由
    }
    // v6.30.0 這一段期間(absDay 區間)的提案統計,季末回顧用
    periodStats(w, fromDay, toDay) {
        const inP = this.items.filter(p => p.createdDay >= fromDay && p.createdDay < toDay);
        const by = {}; for (const p of inP) by[p.proposerName] = (by[p.proposerName] || 0) + 1;
        const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || null;
        const resolved = this.items.filter(p => (p.resolvedDay || p.approvedDay || 0) >= fromDay && (p.resolvedDay || p.approvedDay || 0) < toDay);
        return { made: inP.length, approved: resolved.filter(p => ['approved', 'done', 'failed'].includes(p.status)).length, rejected: resolved.filter(p => p.status === 'rejected').length, done: resolved.filter(p => p.status === 'done').length, top: top ? { name: top[0], n: top[1] } : null };
    }
    toDict(w) {
        const items = this.items.map(p => this.toItem(w, p));
        const isHist = (s) => ['done', 'failed', 'rejected', 'expired'].includes(s);
        return {
            open: items.filter(x => x.status === 'open').sort((a, b) => b.n - a.n),
            shelved: items.filter(x => x.status === 'shelved').sort((a, b) => b.n - a.n),
            active: items.filter(x => x.status === 'approved').sort((a, b) => b.n - a.n),
            history: items.filter(x => isHist(x.status)).sort((a, b) => b.n - a.n).slice(0, 20),
            stats: { ...this.stats }, pendingCount: items.filter(x => x.status === 'open').length,
        };
    }
    serialize() { return { counter: this.counter, items: this.items, cooldown: this.cooldown, proposerCooldown: this.proposerCooldown, stats: this.stats, track: this.track, _lastDay: this._lastDay }; }
    loadFrom(d) { if (!d) return; this.counter = d.counter || 0; this.items = Array.isArray(d.items) ? d.items : []; this.cooldown = d.cooldown || {}; this.proposerCooldown = d.proposerCooldown || {}; this.track = d.track || {}; this.stats = Object.assign({ made: 0, approved: 0, rejected: 0, shelved: 0, done: 0, failed: 0, auto: 0 }, d.stats || {}); this._lastDay = d._lastDay ?? null; for (const p of this.items) { delete p._ruling; } }
}
if (typeof window !== 'undefined') { window.ProposalSystem = ProposalSystem; window.PROPOSAL_KINDS = PROPOSAL_KINDS; window.VOTE_WHY = VOTE_WHY; }
