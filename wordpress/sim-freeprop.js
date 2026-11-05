// RimTown - sim-freeprop.js（v6.47.0）：AI 村民自由提案。
// 以前 AI 只能從規則給的五個點子裡挑一個；現在可以自己發想（天馬行空也行），但效果一律落在「白名單」裡，對世界有真的影響：
//   資源一次增減、連續幾天的產出、心情（全鎮／某職業／某個性／某人）、兩人關係、政令加成（研究／農作／商人／節慶…）、
//   動工蓋建築、指定研究、讓某人轉職、立下新傳統（寫進 AI 的鎮況，之後大家說話做事都會參考）、立地標（地圖上看得到）。
// 引擎會檢查名字、數值範圍和「好處要有代價」的預算；投票、鎮長裁決、執行、十天後成效都沿用原本的提案流程。
// 載入順序：sim-conversation.js、sim-proposals.js 之後（擴充 ConversationEngine 與 ProposalSystem 的原型）。

const FREEPROP = (() => {
    const RES = ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'silver', 'tools', 'medicine', 'meals', 'clothing', 'furniture', 'research_points'];
    const VAL = { food: 0.6, wood: 0.8, stone: 0.8, metal: 2, cloth: 1, herbs: 1.2, silver: 1, tools: 4, medicine: 5, meals: 1.5, clothing: 3, furniture: 4, research_points: 2 };
    const MODS = { research_bonus: '研究加成', farm_bonus: '農作加成', merchant_chance: '商人來訪', festival_chance: '節慶機率', immigration_chance: '移民機率', defense_bonus: '防禦', sell_bonus: '賣價加成', raid_chance: '盜匪出沒', gathering_bonus: '採集加成' };
    const JOBS = ['farmer', 'miner', 'cook', 'blacksmith', 'doctor', 'researcher', 'trader', 'guard', 'carpenter', 'tailor', 'priest'];
    const CATS = ['economy', 'welfare', 'defense', 'culture', 'nature', 'freedom'];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
    const str = (s, n) => (typeof clipText === 'function' ? clipText(String(s || '').trim(), n) : String(s || '').trim().slice(0, n));
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const byName = (w, n) => { n = String(n || '').trim(); if (!n) return null; const L = (x) => (typeof I18N !== 'undefined' && I18N.delocalizeNames) ? I18N.delocalizeNames(x) : x; return npcs(w).find(a => a.name === n || a.name === L(n) || (typeof I18N !== 'undefined' && I18N.localizeName && I18N.localizeName(a.name) === n)) || null; };

    // AI 回來的效果 → 只留合法的、數值夾在範圍內
    function sanitize(w, raw) {
        const out = []; const list = Array.isArray(raw) ? raw.slice(0, 12) : []; // 最多看 12 個、留 8 個合法的
        for (const e of list) {
            if (!e || typeof e !== 'object') continue; const ty = String(e.type || '').toLowerCase();
            if (ty === 'resource' && RES.includes(e.res)) { const n = Math.round(clamp(e.amount, -150, 150)); if (n) out.push({ type: 'resource', res: e.res, amount: n }); }
            else if (ty === 'daily' && RES.includes(e.res)) { const n = Math.round(clamp(e.amount, -8, 8)); const d = Math.round(clamp(e.days || 7, 3, 20)); if (n) out.push({ type: 'daily', res: e.res, amount: n, days: d }); }
            else if (ty === 'mood') { const n = Math.round(clamp(e.amount, -8, 8)); const who = String(e.who || 'all'); if (!n) continue;
                if (who === 'all' || (who.startsWith('job:') && JOBS.includes(who.slice(4))) || (who.startsWith('trait:') && typeof TRAIT_POOL !== 'undefined' && TRAIT_POOL[who.slice(6)])) out.push({ type: 'mood', who, amount: n });
                else if (who.startsWith('name:')) { const a = byName(w, who.slice(5)); if (a) out.push({ type: 'mood', who: 'id:' + a.agentId, name: a.name, amount: n }); } }
            else if (ty === 'relation') { const a = byName(w, e.a), b = byName(w, e.b); const n = Math.round(clamp(e.amount, -25, 25)); if (a && b && a !== b && n) out.push({ type: 'relation', a: a.agentId, b: b.agentId, an: a.name, bn: b.name, amount: n }); }
            else if (ty === 'modifier' && MODS[e.key]) { const v = Math.round(clamp(e.value, -0.3, 0.3) * 100) / 100; const d = Math.round(clamp(e.days || 15, 5, 30)); if (v) out.push({ type: 'modifier', key: e.key, value: v, days: d }); }
            else if (ty === 'build' && typeof BUILDING_TEMPLATES !== 'undefined' && BUILDING_TEMPLATES[e.key] && (!w.research?.isUnlocked || w.research.isUnlocked(e.key))) out.push({ type: 'build', key: e.key });
            else if (ty === 'research' && w.research?.projects?.[e.key] && w.research.projects[e.key].status === 'available') out.push({ type: 'research', key: e.key });
            else if (ty === 'job' && JOBS.includes(e.job)) { const a = byName(w, e.name); if (a && a.job?.key !== 'mayor' && a.job?.key !== e.job) out.push({ type: 'job', id: a.agentId, name: a.name, job: e.job }); }
            else if (ty === 'tradition') { const s = str(e.text, 40); if (s.length >= 2) out.push({ type: 'tradition', text: s }); }
            else if (ty === 'landmark') { const s = str(e.name, 14); const ic = str(e.icon || '🗿', 2); if (s.length >= 1) out.push({ type: 'landmark', name: s, icon: ic || '🗿' }); }
        }
        // 不能同時兩個建設／研究／地標;最多 8 個效果
        const seen = {}; return out.filter(e => { if (!['build', 'research', 'landmark'].includes(e.type)) return true; if (seen[e.type]) return false; seen[e.type] = 1; return true; }).slice(0, 8);
    }
    function sanitizeCost(raw) { const c = {}; for (const [k, v] of Object.entries(raw || {})) if (RES.includes(k) && k !== 'research_points') { const n = Math.round(clamp(v, 0, 300)); if (n) c[k] = n; } return c; }
    // 好處要有代價:正面效果的價值超過花費太多,就把正面效果縮小
    function balance(fx, cost) {
        let plus = 0, minus = 0;
        const v = (e) => e.type === 'resource' ? e.amount * (VAL[e.res] || 1) : e.type === 'daily' ? e.amount * e.days * (VAL[e.res] || 1) : e.type === 'mood' ? e.amount * (e.who === 'all' ? 6 : 2) : e.type === 'modifier' ? (e.key === 'raid_chance' ? -e.value : e.value) * 250 * (e.days / 10) : e.type === 'relation' ? e.amount * 0.3 : 0;
        for (const e of fx) { const x = v(e); if (x > 0) plus += x; else minus -= x; }
        for (const [r, n] of Object.entries(cost)) minus += n * (VAL[r] || 1);
        if (fx.some(e => e.type === 'landmark') && !(cost.silver >= 30 || cost.stone >= 20)) { cost.silver = (cost.silver || 0) + 30; cost.stone = (cost.stone || 0) + 15; minus += 42; }
        const allow = minus * 1.6 + 50;
        if (plus > allow) { const k = allow / plus; for (const e of fx) { if (v(e) <= 0) continue; if ('amount' in e) e.amount = Math.round(e.amount * k) || Math.sign(e.amount); if ('value' in e) e.value = Math.round(e.value * k * 100) / 100 || (e.value > 0 ? 0.01 : -0.01); } }
        return { fx, cost };
    }
    const resName = (r) => (typeof t === 'function') ? t(({ food: '食物', wood: '木材', stone: '石材', metal: '金屬', cloth: '布料', herbs: '草藥', silver: '銀幣', tools: '工具', medicine: '藥品', meals: '餐點', clothing: '衣物', furniture: '家具', research_points: '研究點' })[r] || r) : r;
    const jobName = (j) => (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[j]?.title) ? t(JOB_DEFINITIONS[j].title) : j;
    const sg = (n) => (n > 0 ? '+' : '') + n;
    function describe(w, e) {
        const T = (k) => t(k);
        switch (e.type) {
            case 'resource': return `${resName(e.res)} ${sg(e.amount)}`;
            case 'daily': return T('每天{res} {n}，持續 {d} 天').replace('{res}', resName(e.res)).replace('{n}', sg(e.amount)).replace('{d}', e.days);
            case 'mood': { const who = e.who === 'all' ? T('全鎮') : e.who.startsWith('job:') ? jobName(e.who.slice(4)) : e.who.startsWith('trait:') ? t((typeof TRAIT_POOL !== 'undefined' && TRAIT_POOL[e.who.slice(6)]?.label) || e.who.slice(6)) : t(e.name || ''); return T('{who}心情 {n}').replace('{who}', String(who).trim()).replace('{n}', sg(e.amount)); }
            case 'relation': return T('{a}和{b}的關係 {n}').replace('{a}', t(e.an)).replace('{b}', t(e.bn)).replace('{n}', sg(e.amount));
            case 'modifier': return T('{m} {n}%，{d} 天').replace('{m}', T(MODS[e.key])).replace('{n}', sg(Math.round(e.value * 100))).replace('{d}', e.days);
            case 'build': return T('動工：{b}').replace('{b}', t(BUILDING_TEMPLATES?.[e.key]?.name || e.key));
            case 'research': return T('開始研究：{r}').replace('{r}', t(w?.research?.projects?.[e.key]?.name || e.key));
            case 'job': return T('{who}改當{job}').replace('{who}', t(e.name)).replace('{job}', jobName(e.job));
            case 'tradition': return T('新傳統：「{x}」').replace('{x}', e.text);
            case 'landmark': return T('立地標：{i} {x}').replace('{i}', e.icon).replace('{x}', e.name);
        }
        return '';
    }
    // 通過後執行
    function apply(w, P, p) {
        const day = P._abs(w); const out = [];
        for (const e of (p.fx || [])) {
            try {
                if (e.type === 'resource') { if (e.amount > 0) w.stockpile.add(e.res, e.amount, w.tickCount, t('提案'), 'proposal'); else w.stockpile.consume(e.res, Math.min(-e.amount, w.stockpile.get(e.res)), w.tickCount, t('提案'), 'proposal'); out.push(describe(w, e)); }
                else if (e.type === 'daily') { (P.ongoing || (P.ongoing = [])).push({ pid: p.id, res: e.res, amount: e.amount, until: day + e.days }); out.push(describe(w, e)); }
                else if (e.type === 'mood') { const hit = npcs(w).filter(a => e.who === 'all' || (e.who.startsWith('job:') && a.job?.key === e.who.slice(4)) || (e.who.startsWith('trait:') && a.personality?.traits?.includes(e.who.slice(6))) || (e.who.startsWith('id:') && a.agentId === e.who.slice(3)));
                    for (const a of hit) a.moodModifier = (a.moodModifier || 0) + e.amount; out.push(describe(w, e)); }
                else if (e.type === 'relation') { const a = w.agents[e.a], b = w.agents[e.b]; if (a && b) { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(e.amount); b.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(e.amount);
                    a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '因為{id}「{title}」，我和{other}的關係變了', { id: p.id, title: P.title(p), other: b.name }, 6, [b.name]); out.push(describe(w, e)); } }
                else if (e.type === 'modifier') { if (w.council) { w.council.activeDecrees = w.council.activeDecrees || []; w.council.activeDecrees.push({ id: 'free_' + p.id + '_' + e.key, title: P.title(p), effects: { [e.key]: e.value }, expiresDay: day + e.days }); } out.push(describe(w, e)); }
                else if (e.type === 'build') { const proj = w.buildings?.startProject?.(e.key, w, null); out.push(proj ? describe(w, e) : t('沒辦法動工（已經有同名建築）')); }
                else if (e.type === 'research') { const ok = w.research?.startResearch?.(e.key); out.push(ok ? describe(w, e) : t('研究沒辦法開始')); }
                else if (e.type === 'job') { const a = w.agents[e.id]; if (a && typeof Job !== 'undefined') { a.job = new Job(e.job); a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上通過了{id}，我改行當{job}了', { id: p.id, job: a.job.title }, 7, []); out.push(describe(w, e)); } }
                else if (e.type === 'tradition') { const L = P.traditions || (P.traditions = []); L.push({ text: e.text, by: p.proposerName, id: p.id, day }); if (L.length > 6) L.splice(0, L.length - 6); out.push(describe(w, e)); }
                else if (e.type === 'landmark') { const L = P.landmarks || (P.landmarks = []); L.push({ name: e.name, icon: e.icon, by: p.proposerName, id: p.id, day }); if (L.length > 6) L.splice(0, L.length - 6); for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + 2; out.push(describe(w, e)); }
            } catch (err) { console.warn('[FreeProp] apply', e, err); }
        }
        for (const a of npcs(w)) if (Math.random() < 0.5) a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上通過了{who}的點子「{title}」', { who: p.proposerName, title: P.title(p) }, 4, [p.proposerName]);
        return out;
    }
    function daily(w, P) {
        const day = P._abs(w); if (!Array.isArray(P.ongoing) || !P.ongoing.length) return;
        P.ongoing = P.ongoing.filter(o => o.until >= day);
        for (const o of P.ongoing) { try { if (o.amount > 0) w.stockpile.add(o.res, o.amount, w.tickCount, t('提案'), 'proposal'); else w.stockpile.consume(o.res, Math.min(-o.amount, w.stockpile.get(o.res)), w.tickCount, t('提案'), 'proposal'); } catch (e) {} }
    }
    // 投票的規則傾向(沒有 AI 時用):好處、代價、個性
    function voteBias(p, a, has) {
        let s = 0; const fx = p.fx || [];
        for (const e of fx) {
            if (e.type === 'mood' && (e.who === 'all' || (e.who === 'id:' + a.agentId))) s += e.amount > 0 ? 1 : -2;
            if (e.type === 'mood' && e.who.startsWith('job:') && a.job?.key === e.who.slice(4)) s += e.amount > 0 ? 2 : -3;
            if (e.type === 'job' && e.id === a.agentId) s += 1;
            if (e.type === 'tradition' || e.type === 'landmark') { if (has(a, 'creative') || has(a, 'romantic')) s += 1; if (has(a, 'ascetic') || has(a, 'stoic')) s -= 1; }
            if ((e.type === 'resource' || e.type === 'daily') && e.amount < 0) s -= 0.5;
        }
        return s;
    }
    // 給 AI 的鎮況補充:現有的傳統與地標
    function briefExtra(w) {
        const P = w.proposals; if (!P) return '';
        const tr = (P.traditions || []).map(x => `${t('「')}${x.text}${t('」')}`).join(t('、'));
        const lm = (P.landmarks || []).map(x => `${x.icon}${x.name}`).join(t('、'));
        return (tr ? `${t('；')}${t('本鎮的規矩與傳統')}${t('：')}${tr}` : '') + (lm ? `${t('；')}${t('地標')}${t('：')}${lm}` : '');
    }
    return { sanitize, sanitizeCost, balance, describe, apply, daily, voteBias, briefExtra, CATS, MODS, JOBS, RES };
})();

// ---- 提案系統掛勾 ----
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.free = { icon: '💭', label: '村民的點子' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    // AI 自己發想;失敗就回到原本「從幾個點子裡挑」的流程
    ProposalSystem.prototype._inventLLM = async function (w, day, a, fallback) {
        let j = null;
        try { j = await w.conversationEngine.inventProposal(w, a); } catch (e) { console.warn('[Proposals] invent', e); }
        if (this.open().length >= ProposalSystem.MAX_OPEN) return;
        if (!j || j.skip) { if (j?.skip) { w.logMessageT?.('council', '🤔 {who}想了想，今天沒什麼要跟大家提的。', { who: a.name }, a.name); return; } return fallback(); }
        const fx0 = FREEPROP.sanitize(w, j.effects); if (!fx0.length) return fallback();
        const { fx, cost } = FREEPROP.balance(fx0, FREEPROP.sanitizeCost(j.cost));
        const title = String(j.title || '').trim().replace(/^[「『"“]+|[」』"”]+$/g, ''); if (title.length < 2) return fallback();
        const cat = FREEPROP.CATS.includes(j.category) ? j.category : 'welfare';
        const cand = { kind: 'free', key: 'free:' + title.slice(0, 12), jobs: [a.job?.key], make: () => ({ kind: 'free', key: 'free:' + title.slice(0, 12), tk: (typeof clipText === 'function' ? clipText(title, 30) : title.slice(0, 30)), tp: {}, dk: String(j.pitch || '').trim().slice(0, 160), dp: {}, cost, fx, category: cat, jobBias: [a.job?.key] }) };
        const p = this._createWith(w, day, cand, a);
        if (p) { p.llm = true; p.pitch = String(j.pitch || '').trim().slice(0, 160); try { w.onProposalEvent?.('vote', this.toItem(w, p)); } catch (e) {} }
    };
    const _toItem = PS.toItem;
    PS.toItem = function (w, p) { const it = _toItem.call(this, w, p); if (p.kind === 'free') it.effectsText = (p.fx || []).map(e => FREEPROP.describe(w, e)).filter(Boolean); return it; };
    const _ruleVote = PS._ruleVote;
    PS._ruleVote = function (w, p, a) { _ruleVote.call(this, w, p, a); if (p.kind !== 'free') return; const b = FREEPROP.voteBias(p, a, (x, tr) => this._hasTrait(x, tr)); if (b >= 1.5 && p.votes[a.agentId] === 'against' && Math.random() < 0.5) p.votes[a.agentId] = 'for'; if (b <= -1.5 && p.votes[a.agentId] === 'for' && Math.random() < 0.5) p.votes[a.agentId] = 'against'; };
    const _serialize = PS.serialize;
    PS.serialize = function () { const d = _serialize.call(this); d.ongoing = this.ongoing || []; d.traditions = this.traditions || []; d.landmarks = this.landmarks || []; return d; };
    const _loadFrom = PS.loadFrom;
    PS.loadFrom = function (d) { _loadFrom.call(this, d); this.ongoing = Array.isArray(d?.ongoing) ? d.ongoing : []; this.traditions = Array.isArray(d?.traditions) ? d.traditions : []; this.landmarks = Array.isArray(d?.landmarks) ? d.landmarks : []; };
    const _toDict = PS.toDict;
    PS.toDict = function (w) { const d = _toDict.call(this, w); d.traditions = (this.traditions || []).slice(); d.landmarks = (this.landmarks || []).slice(); return d; };
}
// ---- AI 引擎：自由發想 ----
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _tb = CE._townBrief;
    CE._townBrief = function (world) { return _tb.call(this, world) + FREEPROP.briefExtra(world); };
    ConversationEngine.prototype.inventProposal = async function (world, a) {
        if (!this.fullAgentOk(world) || !a) return null;
        const b = this._agentBrief(world, a);
        const names = Object.values(world.agents).filter(x => !x.isPlayer && !x.isDead && x !== a).slice(0, 14).map(x => (LLM_LANG.get() === 'en' && typeof I18N !== 'undefined') ? I18N.localizeNames(x.name, true) : x.name).join(t('、'));
        const BT = typeof BUILDING_TEMPLATES !== 'undefined' ? BUILDING_TEMPLATES : {};
        const done = new Set([...(world.buildings?.completed || []), ...(world.buildings?.projects || [])].map(p => p.buildingKey || p.key || p.name));
        const builds = Object.entries(BT).filter(([k, v]) => !done.has(k) && !done.has(v.name) && (!world.research?.isUnlocked || world.research.isUnlocked(k))).slice(0, 8).map(([k, v]) => `${k}${t('＝')}${t(v.name)}`).join(t('、'));
        const res = Object.values(world.research?.projects || {}).filter(p => p.status === 'available').slice(0, 6).map(p => `${p.key}${t('＝')}${t(p.name)}`).join(t('、'));
        const prompt = `${t('你正在扮演「')}${b.name}${t('」（')}${b.age}${t('歲，')}${b.job}${t('；')}${t('性格')}${t('：')}${b.traits}${t('；')}${t('在乎')}${t('：')}${b.values}${t('；')}${t('心情')} ${b.mood}/100${t('）。')}
${t('你想向全鎮提一個你自己想出來的提案。可以很實際，也可以天馬行空、有個人色彩（例如替廣場的貓立雕像、每週一天大家只能說真話、讓鐵匠去學醫），但要符合你的個性、記憶和鎮上現況。')}
${t('【鎮況】')}${this._townBrief(world)}
${b.mem.length ? `${t('【你最近記得的事】')}${b.mem.join('／')}\n` : ''}${t('【鎮上的人】')}${names}
${builds ? `${t('【能蓋的建築】')}${builds}\n` : ''}${res ? `${t('【能研究的】')}${res}\n` : ''}${t('提案的效果只能用下面幾種（effects 陣列，最多 4 個；好處要有代價，太划算會被打折）：')}
{"type":"resource","res":"food|wood|stone|metal|cloth|herbs|silver|tools|medicine","amount":-150~150}
{"type":"daily","res":"…","amount":-8~8,"days":3~20}
{"type":"mood","who":"all|job:farmer|trait:creative|name:${t('名字')}","amount":-8~8}
{"type":"relation","a":"${t('名字')}","b":"${t('名字')}","amount":-25~25}
{"type":"modifier","key":"research_bonus|farm_bonus|merchant_chance|festival_chance|immigration_chance|defense_bonus|sell_bonus|gathering_bonus","value":-0.3~0.3,"days":5~30}
{"type":"build","key":"${t('建築代碼')}"} {"type":"research","key":"${t('研究代碼')}"} {"type":"job","name":"${t('名字')}","job":"farmer|doctor|…"}
{"type":"tradition","text":"${t('一句新規矩或傳統')}"} {"type":"landmark","name":"${t('地標名')}","icon":"${t('一個表情符號')}"}
${t('只輸出 JSON：{"title":"提案名（15 字內）","pitch":"你向全鎮說明的一兩句話（第一人稱，60 字內）","category":"economy|welfare|defense|culture|nature|freedom","cost":{"silver":數字,…},"effects":[…]}；今天不想提就輸出 {"skip":true}')}`;
        this._countNpcLlmUse(world);
        const j = await this._askJson(prompt, 420);
        if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
        return j;
    };
}
if (typeof globalThis !== 'undefined') globalThis.FREEPROP = FREEPROP;
