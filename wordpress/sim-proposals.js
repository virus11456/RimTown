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
        this.stats = { made: 0, approved: 0, rejected: 0, shelved: 0, done: 0, failed: 0, auto: 0 };
        this._lastDay = null;
    }
    static MAX_OPEN = 4;
    static DECIDE_DAYS = 3;
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
            if (p.status === 'open' && day - p.createdDay >= ProposalSystem.DECIDE_DAYS) {
                const f = this._count(p, 'for'), a = this._count(p, 'against');
                this.stats.auto++;
                this._decide(w, p, f > a ? 'approve' : 'reject', 'auto');
            } else if (p.status === 'shelved' && day - (p.shelvedDay || p.createdDay) >= ProposalSystem.SHELF_DAYS) {
                p.status = 'expired'; p.resolvedDay = day; p.result = '擱置太久，提案人自己收回了';
                this._notify(w, 'expired', p);
            } else if (p.status === 'approved') {
                this._execute(w, p, day);
            }
        }
    }
    _count(p, v) { return Object.values(p.votes || {}).filter(x => x === v).length; }

    // ---------- 投票(全鎮參考票) ----------
    _vote(w) {
        const open = this.open(); if (!open.length) return;
        for (const p of open) {
            for (const a of this._npcs(w)) {
                if (a.agentId === p.proposerId || p.votes[a.agentId]) continue;
                if (Math.random() > 0.6) continue;
                let s = 0;
                const vals = PROPOSAL_POLICY_VALUES[p.category] || [];
                for (const v of vals) if (this._hasValue(a, v)) s += 2;
                if (p.kind === 'build' || p.kind === 'industry' || p.kind === 'factory') { if (this._hasValue(a, '財富')) s += 1; if (this._hasTrait(a, 'hardworking')) s += 1; if (this._hasTrait(a, 'lazy')) s -= 1; }
                if (p.kind === 'festival' || p.kind === 'feast') { if (this._hasValue(a, '社群') || this._hasValue(a, '藝術')) s += 2; if (this._hasTrait(a, 'glutton')) s += 2; if (this._hasTrait(a, 'ascetic')) s -= 2; if (this._hasTrait(a, 'stoic')) s -= 1; if (this._hasTrait(a, 'charismatic')) s += 1; }
                if (p.kind === 'expedition') { if (this._hasValue(a, '冒險')) s += 3; if (this._hasValue(a, '家庭')) s -= 1; if (this._hasTrait(a, 'shy')) s -= 1; }
                if (p.kind === 'relief') { if (this._hasValue(a, '社群') || this._hasValue(a, '和平')) s += 2; if (this._hasTrait(a, 'kind')) s += 2; if (this._hasValue(a, '財富')) s -= 1; }
                if (p.kind === 'trial') s += 2;
                if (p.kind === 'policy' && p.effects) { if ((p.effects.mood_all || 0) < 0) s -= 2; if ((p.effects.mood_all || 0) > 0) s += 2; if ((p.effects.silver || 0) < 0) s -= 1; }
                if (this._hasTrait(a, 'pessimist')) s -= 1; if (this._hasTrait(a, 'optimist')) s += 1;
                if (a.job?.key && p.jobBias && p.jobBias.includes(a.job.key)) s += 2;
                const rel = a.relationships?.relationships?.[p.proposerId]; if (rel) s += (rel.affinity || 0) / 100 * 4;
                const silverCost = this._cost(p).silver || 0; if (silverCost && silverCost > (w.stockpile?.get?.('silver') || 0)) s -= 2;
                s += (Math.random() - 0.5) * 4;
                p.votes[a.agentId] = s >= 0 ? 'for' : 'against';
            }
        }
    }

    // ---------- 生成 ----------
    _generate(w, day) {
        const open = this.open();
        if (open.length >= ProposalSystem.MAX_OPEN) return;
        const n = Math.random() < 0.72 ? 1 : (Math.random() < 0.35 ? 2 : 0);
        for (let i = 0; i < n && this.open().length < ProposalSystem.MAX_OPEN; i++) {
            const cands = this._candidates(w, day);
            if (!cands.length) return;
            const total = cands.reduce((s, c) => s + c.weight, 0); let r = Math.random() * total; let pick = cands[0];
            for (const c of cands) { r -= c.weight; if (r <= 0) { pick = c; break; } }
            this._create(w, day, pick);
        }
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
        return out;
    }
    _create(w, day, cand) {
        const a = this._proposer(w, day, cand.jobs || [], cand.pred); if (!a) return null;
        const base = cand.make(a);
        this.counter++;
        const p = Object.assign({ id: 'L' + String(this.counter).padStart(3, '0'), n: this.counter, status: 'open', proposerId: a.agentId, proposerName: a.name, proposerJob: a.job?.key || '', createdDay: day, votes: {}, decidedBy: null, result: '', pitch: '' }, base);
        this.items.push(p);
        this.cooldown[p.key] = day; this.proposerCooldown[a.agentId] = day; this.stats.made++;
        a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '我向鎮上提了 {id}「{title}」，看大家怎麼想。', { id: p.id, title: this.title(p) }, 5, [a.name]);
        w.logMessageT?.('council', '📜 {who}提出 {id}：{title}', { who: a.name, id: p.id, title: this.title(p) }, a.name);
        w.dailyNews?.collectEvent?.('politics', `${a.name}${t('提出提案')} ${p.id}${t('：')}${this.title(p)}`, 6, [a.name]);
        this._notify(w, 'new', p);
        return p;
    }

    // ---------- 觀察者決定 ----------
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
            p.status = 'approved'; p.approvedDay = day; this.stats.approved++;
            if (a) { a.moodModifier = (a.moodModifier || 0) + 5; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{id}「{title}」{how}批准了！', { id: p.id, title: this.title(p), how: by === 'auto' ? '依票數' : '被鎮上' }, 6, [p.proposerName]); }
            for (const [aid, v] of Object.entries(p.votes)) { const x = w.agents[aid]; if (x && v === 'for') x.moodModifier = (x.moodModifier || 0) + 1; }
            w.logMessageT?.('council', '✅ {id}「{title}」批准（{f} 贊成 / {a} 反對{auto}）', { id: p.id, title: this.title(p), f, a: ag, auto: by === 'auto' ? '，三天沒處理依票數定案' : '' });
            w.dailyNews?.collectEvent?.('politics', `${p.id}${t('「')}${this.title(p)}${t('」')}${t('獲准')}${t('（')}${f}:${ag}${t('）')}`, 7, [p.proposerName]);
            this._notify(w, 'approved', p);
            this._execute(w, p, day);
        } else {
            p.status = 'rejected'; p.resolvedDay = day; this.stats.rejected++; p.result = by === 'auto' ? '三天沒處理，依票數否決' : '被否決';
            if (a) { a.moodModifier = (a.moodModifier || 0) - 4; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{id}「{title}」被否決了，有點失望。', { id: p.id, title: this.title(p) }, 6, [p.proposerName]); }
            for (const [aid, v] of Object.entries(p.votes)) { const x = w.agents[aid]; if (x && v === 'for') x.moodModifier = (x.moodModifier || 0) - 1; }
            w.logMessageT?.('council', '❌ {id}「{title}」否決（{f} 贊成 / {a} 反對{auto}）', { id: p.id, title: this.title(p), f, a: ag, auto: by === 'auto' ? '，三天沒處理依票數定案' : '' });
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
            }
        } catch (e) { console.warn('[Proposals] execute', e); ok = false; result = '執行時出了問題'; }
        p.status = ok ? 'done' : 'failed'; p.resolvedDay = day; p.result = result;
        if (ok) { this.stats.done++; const a = w.agents[p.proposerId]; if (a) { a.moodModifier = (a.moodModifier || 0) + 3; } if (w.questSystem) w.questSystem.reputation = (w.questSystem.reputation || 0) + 2; }
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
        };
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
    serialize() { return { counter: this.counter, items: this.items, cooldown: this.cooldown, proposerCooldown: this.proposerCooldown, stats: this.stats, _lastDay: this._lastDay }; }
    loadFrom(d) { if (!d) return; this.counter = d.counter || 0; this.items = Array.isArray(d.items) ? d.items : []; this.cooldown = d.cooldown || {}; this.proposerCooldown = d.proposerCooldown || {}; this.stats = Object.assign({ made: 0, approved: 0, rejected: 0, shelved: 0, done: 0, failed: 0, auto: 0 }, d.stats || {}); this._lastDay = d._lastDay ?? null; }
}
if (typeof window !== 'undefined') { window.ProposalSystem = ProposalSystem; window.PROPOSAL_KINDS = PROPOSAL_KINDS; }
