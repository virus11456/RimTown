// RimTown - sim-agent.js：從 simulation.js 拆出的 時鐘、需求、記憶、關係、性格、技能、職業、村民 Agent／PlayerAgent（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。

// --- GameClock ---
class GameClock {
    constructor() {
        this.day = 1;
        this.hour = 6;
        this.minute = 0;
        this.season = '春季';
        this.year = 1;
        this.DAYS_PER_SEASON = 15;
    }
    tick() {
        const events = [];
        this.minute += 15;
        if (this.minute >= 60) { this.minute = 0; this.hour++; events.push('new_hour'); }
        if (this.hour >= 24) { this.hour = 0; this.day++; events.push('new_day'); }
        if (this.day > this.DAYS_PER_SEASON) {
            this.day = 1;
            const seasons = ['春季','夏季','秋季','冬季'];
            const idx = seasons.indexOf(this.season);
            if (idx === seasons.length - 1) { this.season = seasons[0]; this.year++; events.push('new_year'); }
            else { this.season = seasons[idx + 1]; }
            events.push('new_season');
        }
        return events;
    }
    get timeOfDay() {
        if (this.hour >= 5 && this.hour < 7) return 'dawn';
        if (this.hour >= 7 && this.hour < 12) return 'morning';
        if (this.hour >= 12 && this.hour < 17) return 'afternoon';
        if (this.hour >= 17 && this.hour < 21) return 'evening';
        return 'night';
    }
    get timeStr() {
        const h = String(this.hour).padStart(2,'0');
        const m = String(this.minute).padStart(2,'0');
        return `${t('第')}${this.year}${t('年 ')}${t(this.season)} ${t('第')}${this.day}${t('天')} ${h}:${m}`;
    }
    get shortTime() {
        return `${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
    }
    // v5.4.0 遊戲累計天數(供人生故事線計時)
    get totalDays() {
        const seasons = ['春季','夏季','秋季','冬季'];
        const si = Math.max(0, seasons.indexOf(this.season));
        return (this.year - 1) * 60 + si * this.DAYS_PER_SEASON + (this.day - 1);
    }
    reset() { this.day=1; this.hour=6; this.minute=0; this.season='春季'; this.year=1; }
    toDict() {
        return { day:this.day, hour:this.hour, minute:this.minute, season:this.season, year:this.year, time_of_day:this.timeOfDay, time_str:this.timeStr };
    }
}

// --- Needs ---
class Needs {
    constructor() {
        this.hunger = 70; this.rest = 80; this.social = 60; this.comfort = 60; this.recreation = 50; this.beauty = 50;
    }
    tickDecay(isSleeping, isEating, isSocializing, isRecreating, hour) {
        // v4.0: Night-aware decay — rest decays slower at night (NPC should be sleeping)
        const isNightTime = hour !== undefined ? (hour >= 21 || hour < 6) : false;
        const restDecay = isNightTime ? 0.6 : 1.5; // 60% slower rest decay at night
        const hungerDecay = isNightTime ? 1.2 : 2;  // Slower hunger decay at night too

        this.hunger = isEating ? Math.min(100, this.hunger + 20) : Math.max(0, this.hunger - hungerDecay);
        this.rest = isSleeping ? Math.min(100, this.rest + 8) : Math.max(0, this.rest - restDecay);
        this.social = isSocializing ? Math.min(100, this.social + 10) : Math.max(0, this.social - 1);
        this.recreation = isRecreating ? Math.min(100, this.recreation + 15) : Math.max(0, this.recreation - 0.8);
    }
    get moodContribution() {
        let s = 0;
        // v4.0: Gentler mood penalties with graduated thresholds
        if (this.hunger < 10) s -= 15;       // Only severe penalty at very low hunger
        else if (this.hunger < 25) s -= 8;   // Moderate penalty
        else if (this.hunger > 80) s += 5;

        if (this.rest < 10) s -= 18;         // Severe only when extremely tired
        else if (this.rest < 25) s -= 8;     // Moderate penalty
        else if (this.rest > 80) s += 5;

        if (this.social < 15) s -= 8;
        else if (this.social > 70) s += 5;

        if (this.recreation < 10) s -= 6;
        else if (this.recreation > 70) s += 3;
        return s;
    }
    get mostUrgent() {
        const n = { hunger: this.hunger, rest: this.rest, social: this.social, recreation: this.recreation };
        return Object.entries(n).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    }
    toDict() {
        return { hunger:Math.round(this.hunger*10)/10, rest:Math.round(this.rest*10)/10, social:Math.round(this.social*10)/10,
                 comfort:Math.round(this.comfort*10)/10, recreation:Math.round(this.recreation*10)/10, beauty:Math.round(this.beauty*10)/10,
                 most_urgent: this.mostUrgent };
    }
}

// --- Memory ---
class MemoryEntry {
    constructor(tick, timeStr, category, content, importance = 5, relatedAgents = []) {
        this.tick = tick; this.timeStr = timeStr; this.category = category;
        this.content = content; this.importance = importance; this.relatedAgents = relatedAgents;
    }
    toDict() {
        return { tick:this.tick, time:this.timeStr, category:this.category, content:this.content,
                 importance:this.importance, related_agents:this.relatedAgents };
    }
}

class Memory {
    constructor(capacity = 120) { this.entries = []; this.capacity = capacity; } // v5.99.0 500→120(B12 存檔體積;讀取端最多只取最近 10–20 筆)
    add(tick, timeStr, category, content, importance = 5, relatedAgents = []) {
        this.entries.push(new MemoryEntry(tick, timeStr, category, content, importance, relatedAgents));
        if (this.entries.length > this.capacity) this.entries = this.entries.slice(-this.capacity);
    }
    getRecent(n = 10) { return this.entries.slice(-n); }
    getAboutAgent(name, n = 5) { return this.entries.filter(e => e.relatedAgents.includes(name)).slice(-n); }
    getImportant(minImp = 7, n = 10) { return this.entries.filter(e => e.importance >= minImp).slice(-n); }
    // v5.29.0 記憶流檢索(移植 generative_agents retrieve.py):
    // 每則記憶依「時近性 + 重要度 + 與焦點的相關度」加權排序,取前 n 則
    static _bigrams(text) {
        const s = String(text || '').replace(/[\s。，、！？!?,.:：;；「」『』()（）\[\]…~—-]/g, '');
        const set = new Set();
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
        return set;
    }
    retrieve(focalText, focalAgents = [], n = 5, nowTick = 0) {
        if (!this.entries.length) return [];
        const TICKS_PER_DAY = 96; // 1 tick = 15 遊戲分鐘
        const qBi = Memory._bigrams(focalText);
        const scored = this.entries.map(e => {
            const ageDays = Math.max(0, (nowTick - e.tick) / TICKS_PER_DAY);
            const recency = Math.pow(0.85, ageDays);
            const importance = Math.min(10, e.importance || 5) / 10;
            // 相關度:內容字元 bigram Dice 相似 + 涉及人物命中
            if (!e._bi) e._bi = Memory._bigrams(e.content);
            let overlap = 0;
            for (const b of qBi) if (e._bi.has(b)) overlap++;
            const dice = (qBi.size + e._bi.size) ? (2 * overlap) / (qBi.size + e._bi.size) : 0;
            let agentHit = 0;
            for (const nm of focalAgents) {
                if (nm && (e.relatedAgents.includes(nm) || (e.content || '').includes(nm))) { agentHit = 1; break; }
            }
            const relevance = Math.min(1, dice * 2 + agentHit * 0.6);
            // 權重比照 generative_agents 的 gw = [0.5, 3, 2]
            return { e, score: 0.5 * recency + 3 * relevance + 2 * importance };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, n).map(s => s.e).sort((a, b) => a.tick - b.tick);
    }
    // 反思(thought)節點:dailyReflection 產生的 reflection + 玩家植入的 whisper(v5.35.0)
    getThoughts(n = 3) { return this.entries.filter(e => e.category === 'reflection' || e.category === 'whisper').slice(-n); }
    summarizeRecent(n = 5) {
        const recent = this.getRecent(n);
        if (!recent.length) return t('沒有近期記憶。');
        return recent.map(m => `- [${m.timeStr}] ${m.content}`).join('\n');
    }
    toDict() { return this.entries.slice(-this.capacity).map(e => e.toDict()); }
}

// --- Relationships ---
const REL_TYPES = { STRANGER:t('陌生人'), ACQUAINTANCE:t('認識'), FRIEND:t('朋友'),
    CLOSE_FRIEND:t('摯友'), RIVAL:t('對手'), ENEMY:t('敵人'), CRUSH:t('暗戀'),
    DATING:t('交往中'), MARRIED:t('已婚'), EX:t('前任') };

class Relationship {
    constructor(targetId, targetName) {
        this.targetId = targetId; this.targetName = targetName;
        this.affinity = 0; this.trust = 0; this.romanticInterest = 0;
        this.interactionCount = 0; this.lastInteractionTick = 0; this.sharedMemories = [];
        // Formal relationship status: null, 'dating', 'married', 'ex'
        this.status = null;
        this.statusSince = 0; // tick when status changed
        this.isCheating = false; // currently cheating with this person
    }
    get type() {
        if (this.status === 'married') return REL_TYPES.MARRIED;
        if (this.status === 'dating') return REL_TYPES.DATING;
        if (this.status === 'ex') return REL_TYPES.EX;
        if (this.romanticInterest > 50) return REL_TYPES.CRUSH;
        if (this.affinity > 60) return REL_TYPES.CLOSE_FRIEND;
        if (this.affinity > 20) return REL_TYPES.FRIEND;
        if (this.affinity > -20) return this.interactionCount > 0 ? REL_TYPES.ACQUAINTANCE : REL_TYPES.STRANGER;
        if (this.affinity > -60) return REL_TYPES.RIVAL;
        return REL_TYPES.ENEMY;
    }
    get statusLabel() {
        const m = { dating:t('交往中'), married:t('已婚'), ex:t('前任') };
        return this.status ? m[this.status] || '' : '';
    }
    modifyAffinity(d) { this.affinity = Math.max(-100, Math.min(100, this.affinity + d)); }
    modifyTrust(d) { this.trust = Math.max(-100, Math.min(100, this.trust + d)); }
    modifyRomantic(d) { this.romanticInterest = Math.max(0, Math.min(100, this.romanticInterest + d)); }
    recordInteraction(tick, summary) {
        this.interactionCount++; this.lastInteractionTick = tick;
        this.sharedMemories.push(summary);
        if (this.sharedMemories.length > 30) this.sharedMemories = this.sharedMemories.slice(-30); // v5.99.0 150→30
    }
    addSharedMemory(text) {
        this.sharedMemories.push(text);
        if (this.sharedMemories.length > 30) this.sharedMemories = this.sharedMemories.slice(-30);
    }
    toDict() {
        return { target_id:this.targetId, target_name:this.targetName, type:this.type,
                 affinity:this.affinity, trust:this.trust, romantic_interest:this.romanticInterest,
                 interaction_count:this.interactionCount, status:this.status, status_label:this.statusLabel,
                 is_cheating:this.isCheating };
    }
}

class RelationshipManager {
    constructor() { this.relationships = {}; }
    getOrCreate(targetId, targetName) {
        if (!this.relationships[targetId]) this.relationships[targetId] = new Relationship(targetId, targetName);
        return this.relationships[targetId];
    }
    getFriends() { return Object.values(this.relationships).filter(r => r.affinity > 20); }
    getRomanticInterests() { return Object.values(this.relationships).filter(r => r.romanticInterest > 40); }
    getBestFriend() {
        const friends = this.getFriends();
        return friends.length ? friends.reduce((a,b) => a.affinity > b.affinity ? a : b) : null;
    }
    getPartner() { return Object.values(this.relationships).find(r => r.status === 'dating' || r.status === 'married') || null; }
    getSpouse() { return Object.values(this.relationships).find(r => r.status === 'married') || null; }
    toDict() { return Object.values(this.relationships).map(r => r.toDict()); }
}

// --- Personality ---
const TRAIT_POOL = {
    kind: { social: 2, label: t('善良'), description: t('天生善良且富有同理心') },
    abrasive: { social: -2, label: t('刻薄'), description: t('容易得罪別人') },
    shy: { social: -1, label: t('害羞'), description: t('在社交場合感到不自在') },
    charismatic: { social: 3, label: t('魅力'), description: t('天生具有吸引力') },
    gossip: { social: 1, label: t('八卦'), description: t('喜歡散播和聽取傳聞') },
    hardworking: { work: 2, label: t('勤勞'), description: t('在辛勤工作中獲得滿足') },
    lazy: { work: -2, label: t('懶惰'), description: t('盡可能避免工作') },
    perfectionist: { work: 1, label: t('完美主義'), description: t('一切都要做到最好') },
    creative: { work: 1, label: t('有創意'), description: t('思維跳脫框架') },
    optimist: { mood_base: 10, label: t('樂觀'), description: t('總是看到光明面') },
    pessimist: { mood_base: -10, label: t('悲觀'), description: t('預期最壞的結果') },
    neurotic: { mood_sensitivity: 1.5, label: t('神經質'), description: t('情緒波動劇烈') },
    stoic: { mood_sensitivity: 0.5, label: t('沉穩'), description: t('很少表露情感') },
    romantic: { romance: 2, label: t('浪漫'), description: t('容易墜入愛河') },
    jealous: { romance: -1, label: t('嫉妒'), description: t('容易感到嫉妒') },
    night_owl: { schedule: 'late', label: t('夜貓子'), description: t('偏好晚睡') },
    early_bird: { schedule: 'early', label: t('早起鳥'), description: t('日出而作') },
    glutton: { food: 1.5, label: t('貪吃'), description: t('比大多數人更愛吃') },
    ascetic: { comfort: -1, label: t('苦行'), description: t('偏好簡樸的生活') },
};
const INCOMPATIBLE = [['optimist','pessimist'],['hardworking','lazy'],['shy','charismatic'],['night_owl','early_bird']];

class Personality {
    constructor(traits = [], background = '', values = []) {
        this.traits = traits; this.background = background; this.values = values;
    }
    static random(numTraits = 3) {
        const available = Object.keys(TRAIT_POOL);
        const traits = [];
        const used = new Set();
        for (let i = 0; i < numTraits && available.length; i++) {
            const pool = available.filter(t => !used.has(t));
            if (!pool.length) break;
            const t = pool[Math.floor(Math.random() * pool.length)];
            traits.push(t); used.add(t);
            INCOMPATIBLE.forEach(([a,b]) => { if (t===a) used.add(b); if (t===b) used.add(a); });
        }
        const allValues = ['家庭','自由','知識','財富','權力','藝術','自然','社群','冒險','和平'];
        const vals = shuffle(allValues).slice(0, 1 + Math.floor(Math.random() * 3));
        return new Personality(traits, '', vals);
    }
    // Personality compatibility: returns multiplier 0.2 ~ 1.6 for relationship growth
    static compatibility(traitsA, traitsB) {
        let score = 0;
        // Synergy pairs: shared worldview or complementary traits
        const SYNERGY = [['kind','kind'],['creative','creative'],['optimist','optimist'],['kind','shy'],['charismatic','shy'],['hardworking','hardworking'],['romantic','romantic'],['stoic','neurotic']];
        // Clash pairs: personality friction
        const CLASH = [['abrasive','shy'],['abrasive','kind'],['pessimist','optimist'],['lazy','hardworking'],['lazy','perfectionist'],['jealous','charismatic'],['neurotic','neurotic'],['gossip','stoic']];
        for (const [a, b] of SYNERGY) {
            if ((traitsA.includes(a) && traitsB.includes(b)) || (traitsA.includes(b) && traitsB.includes(a))) score++;
        }
        for (const [a, b] of CLASH) {
            if ((traitsA.includes(a) && traitsB.includes(b)) || (traitsA.includes(b) && traitsB.includes(a))) score--;
        }
        // Clamp to 0.2 ~ 1.6
        return Math.max(0.2, Math.min(1.6, 1.0 + score * 0.3));
    }
    get socialModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.social || 0), 0); }
    get workModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.work || 0), 0); }
    get moodBase() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.mood_base || 0), 0); }
    describe() { return this.traits.filter(tr => TRAIT_POOL[tr]).map(tr => `${TRAIT_POOL[tr].label}${t('：')}${TRAIT_POOL[tr].description}`).join(t('；')); }
    toDict() { return { traits:this.traits, background:this.background, values:this.values, description:this.describe() }; }
}

// --- Skills ---
const SKILL_CATEGORIES = ['射擊','近戰','建造','採礦','烹飪','種植','動物','工藝','醫療','社交','智識','藝術'];
const PASSION_LEVELS = ['無能','無','微','大','狂熱'];
const PASSION_XP_MULT = { '無能':0, '無':1, '微':1.5, '大':2.5, '狂熱':4 };

function xpForLevel(level) { return level <= 0 ? 0 : Math.floor(100 * level * (1 + level * 0.2)); }

class Skill {
    constructor(category) { this.category = category; this.xp = 0; this.passion = '無'; }
    get level() { let l=0; while(l<20 && this.xp >= xpForLevel(l+1)) l++; return l; }
    get xpToNext() { return Math.max(0, xpForLevel(Math.min(this.level+1,20)) - this.xp); }
    get levelProgress() {
        const l = this.level; if (l>=20) return 1;
        const cur = xpForLevel(l), nxt = xpForLevel(l+1);
        return nxt===cur ? 1 : (this.xp - cur)/(nxt - cur);
    }
    get isIncapable() { return this.passion === t('無能'); }
    addXp(amount) {
        if (this.isIncapable) return false;
        const old = this.level;
        this.xp += Math.floor(amount * (PASSION_XP_MULT[this.passion] || 1));
        return this.level > old;
    }
    toDict() {
        const icons = {'無能':'X','無':'','微':'*','大':'**','狂熱':'***'};
        return { name:this.category, level:this.level, xp:this.xp, xp_to_next:this.xpToNext,
                 progress:Math.round(this.levelProgress*100)/100, passion:this.passion,
                 passion_icon:icons[this.passion]||'', incapable:this.isIncapable };
    }
}

class SkillSet {
    constructor() { this.skills = {}; SKILL_CATEGORIES.forEach(c => this.skills[c] = new Skill(c)); }
    get(name) { return this.skills[name]; }
    addXp(name, amount) { return this.skills[name]?.addXp(amount) || false; }
    get bestSkill() { return Object.values(this.skills).reduce((a,b) => (a.level>b.level||(a.level===b.level&&a.xp>b.xp))?a:b); }
    get passions() { return Object.values(this.skills).filter(s => ['微','大','狂熱'].includes(s.passion)); }
    get totalLevel() { return Object.values(this.skills).reduce((s,sk) => s + sk.level, 0); }
    toDict() { return { skills: Object.fromEntries(Object.entries(this.skills).map(([k,v])=>[k,v.toDict()])), total_level:this.totalLevel, best_skill:this.bestSkill.category }; }
}

const JOB_SKILL_MAP = {
    farmer:{primary:['種植'],secondary:['動物','烹飪']}, miner:{primary:['採礦'],secondary:['建造','近戰']},
    cook:{primary:['烹飪'],secondary:['種植','社交']}, blacksmith:{primary:['工藝'],secondary:['採礦','建造']},
    doctor:{primary:['醫療'],secondary:['智識','社交']}, researcher:{primary:['智識'],secondary:['醫療','工藝']},
    trader:{primary:['社交'],secondary:['智識','工藝']}, guard:{primary:['射擊'],secondary:['近戰','醫療']},
    carpenter:{primary:['建造'],secondary:['工藝','種植']}, tailor:{primary:['工藝'],secondary:['藝術','社交']},
    priest:{primary:['社交'],secondary:['藝術','智識']}, mayor:{primary:['社交'],secondary:['智識','藝術']},
};
const ACTIVITY_SKILL_MAP = { socializing:['社交'], eating:[], sleeping:[], recreation:['藝術'], wandering:['動物','種植'], stargazing:['智識'], night_mischief:['社交'], night_stroll:['動物'] };

function generateRandomSkills(jobKey, age = 25, traitList = []) {
    const skills = new SkillSet();
    const cats = shuffle([...SKILL_CATEGORIES]);
    const nBurning = Math.random()<0.15?1:0, nMajor = randInt(0,2), nMinor = randInt(1,3), nIncap = Math.random()<0.25?1:0;
    let idx = 0;
    for (let i=0;i<nBurning&&idx<cats.length;i++) skills.get(cats[idx++]).passion='狂熱';
    for (let i=0;i<nMajor&&idx<cats.length;i++) skills.get(cats[idx++]).passion='大';
    for (let i=0;i<nMinor&&idx<cats.length;i++) skills.get(cats[idx++]).passion='微';
    for (let i=0;i<nIncap&&idx<cats.length;i++) skills.get(cats[idx++]).passion='無能';

    const traitPassionMap = {kind:'社交',charismatic:'社交',creative:'藝術',hardworking:'建造',romantic:'藝術',gossip:'社交'};
    traitList.forEach(t => {
        const sk = traitPassionMap[t]; if (!sk) return;
        const s = skills.get(sk);
        if (s.passion==='無') s.passion='微'; else if (s.passion==='微') s.passion='大';
    });

    let pool = Math.max(0, (age - 16)) * randInt(30,60);
    const capable = Object.values(skills.skills).filter(s => !s.isIncapable);
    const weights = capable.map(s => ({'無能':0,'無':1,'微':2,'大':3.5,'狂熱':5}[s.passion])||1);
    while (pool > 0 && capable.length) {
        const s = weightedChoice(capable, weights);
        const chunk = Math.min(pool, randInt(10,50));
        s.xp += chunk; pool -= chunk;
    }

    if (jobKey && JOB_SKILL_MAP[jobKey]) {
        const map = JOB_SKILL_MAP[jobKey];
        (map.primary||[]).forEach(n => {
            const s = skills.get(n); if (!s.isIncapable) { s.xp += randInt(200,600); if(s.passion==='無') s.passion='微'; }
        });
        (map.secondary||[]).forEach(n => { const s = skills.get(n); if (!s.isIncapable) s.xp += randInt(50,250); });
        (map.primary||[]).forEach(n => { if(skills.get(n).isIncapable) skills.get(n).passion='微'; });
    }
    return skills;
}

// --- Job ---
const JOB_DEFINITIONS = {
    farmer:{title:t('農夫'),category:'production',description:t('種植作物與照料田地'),workplace:'farm',work_hours:[6,16],daily_output:t('食物與農產')},
    miner:{title:t('礦工'),category:'production',description:t('在礦場開採石頭與礦石'),workplace:'quarry',work_hours:[7,16]},
    cook:{title:t('廚師'),category:'service',description:t('在酒館準備餐食'),workplace:'tavern',work_hours:[5,14]},
    blacksmith:{title:t('鐵匠'),category:'production',description:t('鍛造工具與裝備'),workplace:'workshop',work_hours:[8,17]},
    doctor:{title:t('醫生'),category:'intellectual',description:t('治療傷病患者'),workplace:'clinic',work_hours:[8,18]},
    researcher:{title:t('研究員'),category:'intellectual',description:t('研究與發現新知識'),workplace:'library',work_hours:[9,17]},
    trader:{title:t('商人'),category:'social',description:t('管理雜貨店'),workplace:'general_store',work_hours:[8,18]},
    guard:{title:t('守衛'),category:'combat',description:t('巡邏與保護小鎮'),workplace:'guardpost',work_hours:[6,18]},
    carpenter:{title:t('木匠'),category:'production',description:t('建造與修繕建築'),workplace:'workshop',work_hours:[7,16]},
    tailor:{title:t('裁縫'),category:'production',description:t('製作衣物與紡織品'),workplace:'workshop',work_hours:[8,17]},
    priest:{title:t('牧師'),category:'social',description:t('照顧居民的心靈需求'),workplace:'chapel',work_hours:[7,19]},
    mayor:{title:t('鎮長'),category:'social',description:t('領導小鎮'),workplace:'town_hall',work_hours:[9,17]},
};

class Job {
    constructor(key) {
        const d = JOB_DEFINITIONS[key];
        this.key = key; this.title = d.title; this.category = d.category; this.description = d.description;
        this.workplace = d.workplace; this.workHours = d.work_hours || [8,17]; this.skillLevel = 1;
    }
    toDict() { return { key:this.key, title:this.title, category:this.category, description:this.description, workplace:this.workplace, work_hours:this.workHours, skill_level:this.skillLevel }; }
}

// --- v5.15.0 記憶想法系統(RimWorld thoughts):村民記得誰對他做過什麼,
//     這些記憶會跨天緩慢衰退,持續影響他的「心情」與對那人的「好感」。 ---
// mood = 峰值心情偏移(隨 days 線性衰退到 0);opinion = 每天對 targetId 好感漂移(記憶還在就一直影響)
const THOUGHT_DEFS = {
    gift_received:   { mood:  6, opinion: 0, days: 2,  label: t('收到禮物') },
    fav_gift:        { mood: 10, opinion: 0, days: 3,  label: t('收到最愛的禮物') },
    nice_chat:       { mood:  3, opinion: 0, days: 1,  label: t('愉快的聊天') },
    harsh_words:     { mood: -4, opinion:-1, days: 2,  label: t('被說了難聽的話') },
    confessed_to:    { mood: 15, opinion: 2, days: 4,  label: t('有人向我表白') },
    got_together:    { mood: 20, opinion: 0, days: 5,  label: t('戀愛的甜蜜') },
    married:         { mood: 25, opinion: 0, days: 8,  label: t('新婚的幸福') },
    betrayed:        { mood:-28, opinion:-4, days:15,  label: t('被劈腿背叛') },
    broke_up:        { mood:-15, opinion: 0, days: 8,  label: t('剛失戀') },
    divorced:        { mood:-20, opinion: 0, days:12,  label: t('離婚的傷痛') },
    lost_loved_one:  { mood:-30, opinion: 0, days:20,  label: t('痛失至親') },
    rival_formed:    { mood: -6, opinion:-2, days:10,  label: t('跟人結了樑子') },
    jealous:         { mood: -8, opinion: 0, days: 6,  label: t('嫉妒的煎熬') },
    dream_progress:  { mood:  8, opinion: 0, days: 3,  label: t('離夢想更近了') },
    dream_achieved:  { mood: 20, opinion: 0, days:10,  label: t('實現了畢生夢想') },
    praised:         { mood:  8, opinion: 2, days: 4,  label: t('被人公開稱讚') },
    slandered:       { mood:-10, opinion:-3, days: 6,  label: t('被人說壞話') },
    festival_joy:    { mood:  6, opinion: 0, days: 2,  label: t('祭典的歡樂') },
};

// --- Agent ---
const ACTIVITIES = ['sleeping','eating','working','socializing','wandering','recreation','idle'];

class Agent {
    constructor(agentId, name, age = 25, personality = null, job = null, homeLocation = 'residential_north', gender = null) {
        this.agentId = agentId; this.name = name; this.age = age;
        this.gender = gender || Agent.guessGender(name);
        this.personality = personality || Personality.random();
        this.job = job; this.homeLocation = homeLocation;
        this.currentLocation = homeLocation; this.targetLocation = null;
        this.mood = 50 + this.personality.moodBase; this.activity = 'idle';
        this.needs = new Needs(); this.memory = new Memory(); this.relationships = new RelationshipManager();
        this.skills = generateRandomSkills(job?.key, age, this.personality.traits);
        this.attributes = Agent.rollAttributes(this.personality, job); // v5.26.0 肉鴿:核心屬性(每村民不同)
        this._lastInteractionTick = 0; this._interactionCooldown = 6;
        this.currentThought = ''; this.isPlayer = false;
        this.look = null; // v5.89.0 自訂外觀 { skin, hair, hairColor, shirt, acc }(null = 依名字雜湊的預設)
        this.thoughts = []; // v5.15.0 記憶想法(RimWorld thoughts):{kind,label,mood,opinion,targetId,targetName,start,days}
        this._locationStayTicks = 0; // how many ticks to stay at current location
        this._locationStayRemaining = 0; // countdown
        this.moodModifier = 0; // accumulated mood changes from events, decays over time
        this._mourningTargets = []; // [{name, deathTick, isFamily}] - deceased to mourn at graveyard
        this._annualMourning = []; // [{name, lastVisitYear}] - family members to visit yearly
    }
    get moodDescription() {
        if (this.mood >= 80) return 'ecstatic'; if (this.mood >= 60) return 'happy';
        if (this.mood >= 40) return 'content'; if (this.mood >= 20) return 'unhappy';
        if (this.mood >= 0) return 'stressed'; return 'miserable';
    }
    get moodLabel() {
        const map = { ecstatic:t('欣喜若狂'), happy:t('快樂'), content:t('滿足'), unhappy:t('不開心'), stressed:t('壓力大'), miserable:t('痛苦') };
        return map[this.moodDescription] || this.moodDescription;
    }
    get activityLabel() {
        const map = { sleeping:t('睡覺'), eating:t('進食'), working:t('工作'), socializing:t('社交'), wandering:t('閒逛'), recreation:t('娛樂'), idle:t('閒置'), stargazing:t('看星星'), night_mischief:t('搞事'), night_stroll:t('夜間散步'), exploring:t('探險中'), mourning:t('弔念') };
        if (this.activity === 'commuting') return t('趕著去上工'); // v5.72.0 通勤原本漏標籤,中文介面直接露出 commuting
        return map[this.activity] || this.activity;
    }
    get genderLabel() {
        return this.gender === 'male' ? t('男') : this.gender === 'female' ? t('女') : t('不明');
    }
    static guessGender(name) {
        // Common Chinese female name characters
        const femaleChars = '美麗芳雪瑜琳雅瑩霞莉蘭嵐雨秀娟敏慧婷芸玲珍嬌櫻蕊翠彩鳳';
        // Common Chinese male name characters
        const maleChars = '偉豪俊強峰達傑明浩磊剛毅堅志勇武鋒威龍彪';
        const lastChar = name.charAt(name.length - 1);
        if (femaleChars.includes(lastChar)) return 'female';
        if (maleChars.includes(lastChar)) return 'male';
        // Check second-to-last if two-char given name
        if (name.length >= 2) {
            const secondChar = name.charAt(name.length - 2);
            if (femaleChars.includes(secondChar)) return 'female';
            if (maleChars.includes(secondChar)) return 'male';
        }
        return Math.random() < 0.5 ? 'male' : 'female';
    }
    // v5.26.0 肉鴿:依性格+職業隨機 roll 四項核心屬性(1-10),讓每位村民、每一局都不同
    static rollAttributes(personality, job) {
        const r = () => 3 + randInt(0, 4); // 3-7 基礎
        const a = { charm: r(), vigor: r(), wit: r(), grit: r() };
        const tr = (personality && personality.traits) || [];
        if (tr.includes('charismatic')) a.charm += randInt(1, 3);
        if (tr.includes('romantic')) a.charm += 1;
        if (tr.includes('shy')) a.charm -= 1;
        if (tr.includes('hardworking')) a.vigor += randInt(1, 2);
        if (tr.includes('lazy')) a.vigor -= 1;
        if (tr.includes('glutton')) a.vigor += 1;
        if (tr.includes('creative') || tr.includes('perfectionist')) a.wit += randInt(1, 2);
        if (tr.includes('night_owl')) a.wit += 1;
        if (tr.includes('stoic') || tr.includes('optimist')) a.grit += randInt(1, 2);
        if (tr.includes('neurotic') || tr.includes('pessimist')) a.grit -= 1;
        const jk = job && job.key;
        if (jk === 'guard') { a.grit += 2; a.vigor += 1; }
        else if (jk === 'researcher' || jk === 'doctor') a.wit += 2;
        else if (jk === 'trader' || jk === 'priest') a.charm += 1;
        else if (jk === 'miner' || jk === 'farmer' || jk === 'blacksmith' || jk === 'carpenter') a.vigor += 1;
        else if (jk === 'tailor' || jk === 'cook') a.wit += 1;
        for (const k in a) a[k] = Math.max(1, Math.min(10, a[k]));
        return a;
    }
    static ATTR_META() {
        return [
            { key: 'charm', icon: '✨', label: t('魅力') },
            { key: 'vigor', icon: '💪', label: t('體魄') },
            { key: 'wit',   icon: '🧠', label: t('智慧') },
            { key: 'grit',  icon: '🔥', label: t('膽識') },
        ];
    }
    attr(k) { return (this.attributes && this.attributes[k]) || 5; }
    // v5.15.0 加一則記憶想法(同 kind+對象會刷新計時,不無限堆疊)
    addThought(kind, world, targetId, targetName) {
        const def = THOUGHT_DEFS[kind]; if (!def) return;
        this.thoughts = this.thoughts || [];
        const now = world.clock.totalDays || 0;
        const existing = this.thoughts.find(t2 => t2.kind === kind && t2.targetId === (targetId || null));
        if (existing) { existing.start = now; return; }
        this.thoughts.push({ kind, label: def.label, mood: def.mood, opinion: def.opinion, targetId: targetId || null, targetName: targetName || null, start: now, days: def.days });
        if (this.thoughts.length > 14) this.thoughts = this.thoughts.slice(-14);
    }
    // 目前所有記憶想法的心情總貢獻(隨時間線性衰退)
    thoughtMoodTotal(totalDays) {
        if (!this.thoughts || !this.thoughts.length) return 0;
        let s = 0;
        for (const th of this.thoughts) {
            const frac = 1 - (totalDays - th.start) / th.days;
            if (frac > 0) s += th.mood * frac;
        }
        return s;
    }
    // v5.16.0 意圖面板:為什麼在做現在這件事(從 needs+作息推導,人話一句)
    activityReason() {
        const n = this.needs;
        switch (this.activity) {
            case 'sleeping': return n.rest < 30 ? t('累壞了,需要補眠') : t('照著作息就寢');
            case 'eating': return n.hunger < 30 ? t('肚子餓得受不了') : t('到了用餐時間');
            case 'working': return this.job ? `${t('正在')}${this.job.title || t('工作')}${t('崗位上')}` : t('工作時間');
            case 'socializing': return n.social < 30 ? t('太久沒跟人說話了') : t('想跟大家聚聚');
            case 'recreation': return n.recreation < 30 ? t('壓力太大,需要放鬆') : t('享受閒暇時光');
            case 'wandering': return t('沒什麼事,四處走走');
            case 'mourning': return t('放不下逝去的人,前往墓園');
            case 'stargazing': return t('夜貓子睡不著,仰望星空');
            case 'night_stroll': return t('夜裡出來透透氣');
            case 'night_mischief': return t('趁夜深搞點小惡作劇');
            case 'commuting': return t('趕著去上工');
            case 'heading_home': return t('準備回家休息');
            case 'exploring': return t('離鎮外出探險');
            default: return t('沒有特別的事');
        }
    }
    // 接下來打算做什麼(優先人生夢想,其次最迫切的需求)
    nextIntent(world) {
        const goal = world?.lifeGoals?.describe?.(this.agentId);
        if (goal && !goal.done && goal.stageName) {
            return `${t('朝「')}${goal.stageName}${t('」努力')}`;
        }
        const partner = this.relationships.getPartner?.();
        const crush = this.relationships.getRomanticInterests?.().sort((a,b)=>b.romanticInterest-a.romanticInterest)[0];
        if (!partner && crush && crush.romanticInterest > 55) return `${t('鼓起勇氣接近')}${crush.targetName}`;
        switch (this.needs.mostUrgent) {
            case 'hunger': return t('打算去吃點東西');
            case 'rest':   return t('想好好睡一覺');
            case 'social': return t('想找人聊聊');
            case 'recreation': return t('想找點樂子放鬆');
        }
        return t('過好平常的一天');
    }
    // 對城鎮目前最大的意見(從需求缺口 + 城鎮狀態推導)
    townConcern(world) {
        const n = this.needs;
        const foodLow = world?.stockpile ? (world.stockpile.get('food') || 0) < 40 : false;
        if (n.hunger < 35 || foodLow) return t('對糧食配給不太滿意');
        if (n.rest < 35) return t('覺得日子過得太操勞');
        if (n.recreation < 30) return t('希望鎮上多點娛樂');
        if (n.social < 30) return t('覺得鎮上有點冷清');
        if (n.comfort < 30) return t('對居住環境不太滿意');
        if (n.beauty < 30) return t('嫌鎮上不夠美觀');
        const foe = Object.values(this.relationships.relationships).filter(r => (r.affinity||0) < -40).sort((a,b)=>a.affinity-b.affinity)[0];
        if (foe && Math.random() < 0.5) return `${t('最看不順眼')}${foe.targetName}`;
        if (this.mood > 65) return t('對現在的生活很滿意');
        return t('大致上過得去');
    }
    update(world) {
        const prevActivity = this.activity;
        this._decideActivity(world.clock.hour);
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation', world.clock.hour);
        // Decay moodModifier toward 0
        if (this.moodModifier > 0) this.moodModifier = Math.max(0, this.moodModifier - 0.5);
        else if (this.moodModifier < 0) this.moodModifier = Math.min(0, this.moodModifier + 0.5);
        const repMoodBonus = world.reputationSystem ? world.reputationSystem.getModifier('npc_mood_bonus') : 0;
        const weatherMoodBonus = world.weather ? Math.round(world.weather.moodModifier * 0.3) : 0;
        const thoughtMood = Math.round(this.thoughtMoodTotal(world.clock.totalDays || 0)); // v5.15.0 記憶想法心情
        const gritMood = Math.round((this.attr('grit') - 5) * 0.8); // v5.26.0 膽識→心情韌性(穩得住)
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution) + this.moodModifier + repMoodBonus + weatherMoodBonus + thoughtMood + gritMood));
        this._gainSkillXp(world);
        // Only re-pick location if activity changed or stay duration expired
        const activityChanged = this.activity !== prevActivity;
        if (activityChanged) {
            this._locationStayRemaining = 0; // force re-pick on activity change
        }
        if (this._locationStayRemaining > 0) {
            this._locationStayRemaining--;
        } else {
            this._decideLocation(world.clock.hour);
            if (this.targetLocation && this.targetLocation !== this.currentLocation) {
                this.currentLocation = this.targetLocation; this.targetLocation = null;
            }
            // Set stay duration based on activity
            this._locationStayRemaining = this._getStayDuration();
        }
        if (this.activity === 'socializing') this._trySocialInteraction(world);
        if (this.activity === 'stargazing') this._doStargazing(world);
        if (this.activity === 'night_mischief') this._doNightMischief(world);
        if (this.activity === 'mourning') this._doMourning(world);
        if (this.activity === 'night_stroll') { this.needs.recreation = Math.min(100, this.needs.recreation + 1); this.needs.comfort = Math.min(100, this.needs.comfort + 0.5); }
        if (Math.random() < 0.1) this._generateThought(world);
        // v5.40.0 今日足跡全紀錄 + 環境感知(皆為零成本規則式,移植 generative_agents 的逐格行程/perceive)
        this._recordTrace(world);
        this._perceiveSurroundings(world);
    }

    // v5.40.0 行動軌跡:行程步驟/活動/地點一有變化就記一筆——「今日足跡」因此像
    // generative_agents 的逐分鐘行程(準備食材(10分)→下鍋(20分)→擺盤(5分)),完全不花 LLM
    _recordTrace(world) {
        try {
            const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
            if (!this.todayTrace || this._traceDay !== dayKey) { this.todayTrace = []; this._traceDay = dayKey; this._traceKey = ''; }
            let text;
            if (this.activity === 'sleeping') text = t('睡覺');
            else if (this.activity === 'eating') text = t('進食'); // 生理需求蓋過行程時記實際行為
            else {
                const cur = this.getCurrentPlanStep ? this.getCurrentPlanStep(world) : null;
                if (cur && cur.step) text = `${cur.goal}${t('（')}${cur.step}${t('）')}`;
                else if (cur) text = cur.goal;
                else text = this.activityLabel;
            }
            const key = `${text}|${this.currentLocation}`;
            if (key === this._traceKey) return;
            this._traceKey = key;
            this.todayTrace.push({ m: world.clock.hour * 60 + world.clock.minute, text, loc: this.currentLocation });
            if (this.todayTrace.length > 160) this.todayTrace = this.todayTrace.slice(-160);
        } catch (e) {}
    }

    // v5.40.0 環境感知:偶爾把「看到誰在做什麼」寫進記憶流(每天最多 6 條,低重要度)
    // 這些記憶會被檢索進對話——村民聊天時會自然提起「早上看到你在打鐵」
    _perceiveSurroundings(world) {
        try {
            if (this.activity === 'sleeping') return;
            const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
            if (this._obsDay !== dayKey) { this._obsDay = dayKey; this._obsCount = 0; }
            if (this._obsCount >= 6) return;
            if (world.tickCount % 4 !== 0 || Math.random() > 0.18) return;
            const others = Object.values(world.agents).filter(a => a !== this && !a.isDead && !a.isPlayer && a.currentLocation === this.currentLocation && a.activity !== 'sleeping');
            if (!others.length) return;
            const o = pickRandom(others);
            const oStep = o.getCurrentPlanStep ? o.getCurrentPlanStep(world) : null;
            const doing = (oStep && oStep.step) ? oStep.step : o.activityLabel;
            this._obsCount++;
            this.memory.add(world.tickCount, world.clock.timeStr, 'observation', `${t('看到')}${o.name}${t('正忙著')}${doing}`, 2, [o.name]);
        } catch (e) {}
    }
    _getStayDuration() {
        // Return how many ticks to stay at current location before moving again
        switch (this.activity) {
            case 'sleeping': return 8 + randInt(0, 4);    // stay in bed a long time
            case 'working': return 12 + randInt(0, 8);    // stay at workplace for a long time
            case 'eating': return 4 + randInt(0, 3);      // eat for a while
            case 'socializing': return 6 + randInt(0, 4); // stay to chat
            case 'recreation': return 5 + randInt(0, 4);
            case 'stargazing': return 6 + randInt(0, 4);
            case 'mourning': return 6 + randInt(0, 4);     // mourning at graveyard
            case 'night_stroll': return 3 + randInt(0, 3); // strolling moves more
            case 'wandering': return 5 + randInt(0, 3);
            case 'heading_home': return 20;                // keep heading home until bedtime
            case 'commuting': return 20;                   // keep heading to work until start
            default: return 4;
        }
    }
    _gainSkillXp(world) {
        const xp = Math.round(randInt(3,8) * (1 + (this.attr('wit') - 5) * 0.06)); // v5.26.0 智慧→技能成長快慢
        if (this.activity === 'working' && this.job) {
            const map = JOB_SKILL_MAP[this.job.key];
            if (map) {
                (map.primary||[]).forEach(n => {
                    if(this.skills.addXp(n, xp*2)) {
                        world.logMessage('skill_up', `${this.name}${t('的')}${t(n)}${t('達到等級')}${this.skills.get(n).level}${t('！')}`, this.name);
                        this.currentThought = `${t(n)}${t('技能進步了！')}`;
                    }
                });
                (map.secondary||[]).forEach(n => this.skills.addXp(n, xp));
            }
        } else {
            const actMap = ACTIVITY_SKILL_MAP[this.activity] || [];
            actMap.forEach(n => { if(this.skills.addXp(n, xp)) world.logMessage('skill_up', `${this.name}${t('的')}${t(n)}${t('達到等級')}${this.skills.get(n).level}${t('！')}`, this.name); });
        }
    }
    _decideActivity(hour) {
        const isNightOwl = this.personality.traits.includes('night_owl');
        const isEarlyBird = this.personality.traits.includes('early_bird');
        const isNight = hour >= 21 || hour < 5;
        const isLateNight = hour >= 23 || hour < 4;
        const sleepStart = isNightOwl ? 2 : (isEarlyBird ? 20 : 22);
        const sleepEnd = isNightOwl ? 9 : (isEarlyBird ? 5 : 6);

        // Critical needs always override
        if (this.needs.hunger < 15) { this.activity='eating'; return; }
        if (this.needs.rest < 10) { this.activity='sleeping'; return; }

        // Pre-sleep: head home 1 hour before bedtime (walk home while still awake)
        const preSleepHour = (sleepStart - 1 + 24) % 24;
        const inPreSleep = sleepStart > sleepEnd
            ? (hour === preSleepHour)
            : (hour === preSleepHour);
        if (inPreSleep && this.needs.rest < 90 && this.currentLocation !== this.homeLocation) {
            this.activity = 'heading_home';
            return;
        }

        // Pre-work: head to workplace 1 hour before work starts
        if (this.job) {
            const [ws] = this.job.workHours;
            const preWorkHour = (ws - 1 + 24) % 24;
            if (hour === preWorkHour && this.activity !== 'sleeping' && this.currentLocation !== this.job.workplace) {
                this.activity = 'commuting';
                return;
            }
        }

        // Sleep schedule
        // v5.35.8 修復半夜遊蕩:原本 rest>=90(睡飽)就不睡,夜間衰減又慢,導致村民凌晨還在外面閒逛
        // 一般人睡眠時段一律回家睡覺;夜貓子維持自己的作息(sleepStart 2:00)
        const inSleepWindow = sleepStart > sleepEnd
            ? (hour >= sleepStart || hour < sleepEnd)
            : (hour >= sleepStart && hour < sleepEnd);
        if (inSleepWindow) { this.activity='sleeping'; return; }

        // Mourning: visit graveyard for recently deceased or annual family remembrance
        if (!inSleepWindow && hour >= 7 && hour < 20 && this._shouldMourn()) {
            this.activity = 'mourning'; return;
        }

        // Night owl special behaviors when others sleep
        if (isNight && isNightOwl && this.needs.rest >= 30) {
            return this._decideNightOwlActivity(hour);
        }

        // Regular people awake at night (can't sleep, rest is high)
        if (isNight && !inSleepWindow && this.needs.rest >= 80) {
            return this._decideNightActivity(hour);
        }

        // Daytime: work hours — employed NPCs MUST work, no socializing off-site
        if (this.job) {
            const [ws,we] = this.job.workHours;
            if (ws <= hour && hour < we) {
                if (this.needs.hunger < 30 && Math.random() < 0.3) { this.activity='eating'; return; }
                this.activity='working'; return;
            }
        }
        // Free time (before/after work, weekends, unemployed)
        const urgent = this.needs.mostUrgent;
        if (urgent==='hunger') { this.activity='eating'; return; }
        if (urgent==='social') { this.activity='socializing'; return; }
        if (urgent==='recreation') { this.activity='recreation'; return; }
        const choices = ['socializing','wandering','recreation'];
        const weights = [3,2,2];
        if (this.personality.socialModifier > 0) weights[0] += 2;
        this.activity = weightedChoice(choices, weights);
    }
    _shouldMourn() {
        // Recent death mourning: 30% chance per tick during mourning window
        if (this._mourningTargets.length > 0 && Math.random() < 0.3) return true;
        // Annual family mourning: check if there's an unvisited family grave this year
        if (this._annualMourning.length > 0 && Math.random() < 0.15) return true;
        return false;
    }
    _decideNightOwlActivity(hour) {
        const traits = this.personality.traits;
        const isLateNight = hour >= 23 || hour < 4;
        const choices = [];
        const weights = [];

        // Night owls love stargazing
        choices.push('stargazing'); weights.push(4);
        // Socializing at tavern
        choices.push('socializing'); weights.push(3);
        // Night stroll
        choices.push('night_stroll'); weights.push(2);
        // Recreation (reading by candlelight etc)
        choices.push('recreation'); weights.push(2);

        // Mischief for abrasive/gossip personalities
        if (traits.includes('abrasive') || traits.includes('gossip')) {
            choices.push('night_mischief'); weights.push(3);
        }
        // Creative types get inspired at night
        if (traits.includes('creative')) {
            choices.push('recreation'); weights.push(3);
        }
        // Romantic types might seek partners
        if (traits.includes('romantic')) {
            const partner = this.relationships.getPartner();
            if (partner) { choices.push('socializing'); weights.push(4); }
            else { choices.push('night_stroll'); weights.push(2); }
        }

        this.activity = weightedChoice(choices, weights);
    }
    _decideNightActivity(hour) {
        // Regular people who happen to be awake at night
        const choices = ['stargazing', 'night_stroll', 'socializing', 'recreation'];
        const weights = [2, 2, 1, 2];
        // Low mood → night stroll to think
        if (this.mood < 30) { weights[1] += 3; }
        // High social need → tavern
        if (this.needs.social < 40) { weights[2] += 3; }
        this.activity = weightedChoice(choices, weights);
    }
    _decideLocation(hour) {
        const isNight = hour >= 21 || hour < 5;
        const isWorkHours = this.job && (() => { const [ws,we] = this.job.workHours; return ws <= hour && hour < we; })();
        const workplace = this.job?.workplace;

        if (this.activity==='heading_home') this.targetLocation = this.homeLocation;
        else if (this.activity==='commuting' && this.job) this.targetLocation = this.job.workplace;
        else if (this.activity==='sleeping') this.targetLocation = this.homeLocation;
        else if (this.activity==='eating') {
            // During work hours, eat near workplace or at tavern; at night, eat at home or tavern
            if (isWorkHours && workplace) this.targetLocation = pickRandom([workplace, 'tavern', 'tavern']);
            else if (isNight) this.targetLocation = pickRandom(['tavern', 'tavern', 'home']);
            else this.targetLocation = 'tavern';
        }
        else if (this.activity==='working' && this.job) this.targetLocation = this.job.workplace;
        else if (this.activity==='socializing') {
            if (isWorkHours && workplace) {
                // During work hours, socialize ONLY at workplace (break room chat) — no leaving work
                this.targetLocation = workplace;
            } else if (isNight) this.targetLocation = pickRandom(['tavern','tavern','town_square','park']);
            else {
                // Before/after work: prefer home area, tavern, town square
                const homeArea = this.homeLocation;
                this.targetLocation = pickRandom(['tavern','town_square','park','well','chapel', homeArea]);
            }
        }
        else if (this.activity==='recreation') {
            if (isNight) this.targetLocation = pickRandom(['tavern','library']);
            else this.targetLocation = pickRandom(['park','library','tavern']);
        }
        else if (this.activity==='stargazing') this.targetLocation = pickRandom(['park','hill','meadow']);
        else if (this.activity==='night_stroll') this.targetLocation = pickRandom(['park','town_square','hill','meadow']);
        else if (this.activity==='mourning') this.targetLocation = 'chapel';
        else if (this.activity==='night_mischief') this.targetLocation = pickRandom(['town_square','general_store','tavern']);
        else if (this.activity==='wandering') {
            // Employed during work hours: stay near workplace
            if (isWorkHours && workplace) this.targetLocation = workplace;
            else {
                const homeArea = this.homeLocation;
                this.targetLocation = pickRandom(['town_square','park','well', homeArea, homeArea]);
            }
        }

        // Handle social hangouts / adventure invitations
        if (this._pendingHangout) {
            // v5.54.0 睡眠時段不赴約:約好的聚會倒數到半夜,原本會把睡覺的人拉去廣場站整晚;
            // 已入睡就直接取消這場約(夜貓子還醒著,不受影響)
            if (this.activity === 'sleeping') {
                this._pendingHangout = null;
            } else {
            const hangout = this._pendingHangout;
            if (hangout.tick <= 0) {
                this.targetLocation = hangout.location;
                this.activity = hangout.activity || 'socializing';
                this._pendingHangout = null;
            } else {
                hangout.tick--;
            }
            }
        }

        // Fallback: home for invalid locations
        if (this.activity==='eating' && this.targetLocation === 'home') this.targetLocation = this.homeLocation;
    }
    _trySocialInteraction(world) {
        if (world.tickCount - this._lastInteractionTick < this._interactionCooldown) return;
        // Sleeping NPCs never initiate conversations
        if (this.activity === 'sleeping') return;
        const others = world.getAgentsAtLocation(this.currentLocation).filter(a => a.agentId !== this.agentId && a.activity !== 'sleeping');
        if (!others.length) return;
        const weights = others.map(o => {
            const rel = this.relationships.getOrCreate(o.agentId, o.name);
            let w = 5 + Math.max(0, Math.floor(rel.affinity / 10)) + Math.floor(rel.romanticInterest / 10);
            if (rel.affinity < -30) w = Math.max(1, w - 5);
            return Math.max(1, w);
        });
        const target = weightedChoice(others, weights);
        this._lastInteractionTick = world.tickCount;

        // Gossip
        if (Math.random() < 0.3) world.gossipNetwork.spreadGossip(this, target, world);

        // Hangout invitation: good friends may invite each other to go somewhere together
        const rel = this.relationships.getOrCreate(target.agentId, target.name);
        if (rel.affinity >= 30 && Math.random() < 0.12 && !this._pendingHangout && !target._pendingHangout) {
            const hangoutSpots = ['tavern','park','town_square','chapel','forest','library'];
            const spot = pickRandom(hangoutSpots);
            const hangoutActivity = rel.romanticInterest > 40 ? 'recreation' : 'socializing';
            const delay = randInt(2, 5);
            this._pendingHangout = { location: spot, activity: hangoutActivity, tick: delay, withAgent: target.name };
            target._pendingHangout = { location: spot, activity: hangoutActivity, tick: delay, withAgent: this.name };
            const desc = `${this.name}${t('約了')}${target.name}${t('一起去')}${spot.replace(/_/g,' ')}`;
            world.logMessage('social', desc, this.name, target.name);
            this.memory.add(world.tickCount, world.clock.timeStr, 'social', desc, 5, [target.name]);
            target.memory.add(world.tickCount, world.clock.timeStr, 'social', desc, 5, [this.name]);
        }

        // Conversation
        world.conversationEngine.generateConversation(this, target, world);
    }
    _doStargazing(world) {
        this.needs.recreation = Math.min(100, this.needs.recreation + 2);
        this.needs.comfort = Math.min(100, this.needs.comfort + 1);
        this.moodModifier = (this.moodModifier || 0) + 0.5;
        // Chance to bond with someone also stargazing
        if (Math.random() < 0.15) {
            const others = world.getAgentsAtLocation(this.currentLocation).filter(a => a.agentId !== this.agentId && a.activity === 'stargazing');
            if (others.length) {
                const companion = pickRandom(others);
                const starCompat = Personality.compatibility(this.personality.traits, companion.personality.traits);
                const rel = this.relationships.getOrCreate(companion.agentId, companion.name);
                rel.modifyAffinity(Math.round(randInt(1, 4) * starCompat));
                // Romantic growth only if already have some affinity
                if (rel.affinity > 20) rel.modifyRomantic(Math.round(randInt(0, 2) * starCompat));
                rel.addSharedMemory(`${t('一起在')}${this.currentLocation.replace(/_/g,' ')}${t('看星星')}`);
                const otherRel = companion.relationships.getOrCreate(this.agentId, this.name);
                otherRel.modifyAffinity(Math.round(randInt(1, 4) * starCompat));
                if (otherRel.affinity > 20) otherRel.modifyRomantic(Math.round(randInt(0, 2) * starCompat));
                otherRel.addSharedMemory(`${t('一起在')}${this.currentLocation.replace(/_/g,' ')}${t('看星星')}`);
                world.logMessage('social', `${this.name}${t('和')}${companion.name}${t('一起看星星，感情升溫了。')}`, this.name, companion.name);
                this.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('和')}${companion.name}${t('一起看星星，很浪漫。')}`, 7, [companion.name]);
                companion.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('和')}${this.name}${t('一起看星星，很浪漫。')}`, 7, [this.name]);
            }
        }
        // Rare special discovery while stargazing
        if (Math.random() < 0.02) {
            const discoveries = [
                { text: t('看到了一顆流星劃過天際！'), mood: 10, topic: t('流星') },
                { text: t('發現了一個從未見過的星座圖案。'), mood: 5, topic: t('神秘星座') },
                { text: t('看到了罕見的月暈現象！'), mood: 8, topic: t('月暈奇觀') },
                { text: t('在星光下發現了一株發光的植物！'), mood: 12, topic: t('夜光植物') },
            ];
            const disc = pickRandom(discoveries);
            this.moodModifier = (this.moodModifier || 0) + disc.mood;
            this.currentThought = disc.text;
            world.logMessage('discovery', `${this.name}${disc.text}`, this.name);
            this.memory.add(world.tickCount, world.clock.timeStr, 'discovery', disc.text, 8, []);
            if (disc.topic) world.events.conversationTopics.push(disc.topic);
        }
    }
    _doNightMischief(world) {
        if (Math.random() > 0.08) return; // Low chance per tick
        const mischiefTypes = [
            { text: t('偷偷在鎮公所牆上塗鴉'), target: 'town_hall', mood_self: 5, mood_others: -2, severity: 'minor' },
            { text: t('把別人晾的衣服藏起來'), target: null, mood_self: 3, mood_others: -3, severity: 'minor' },
            { text: t('偷吃了酒館儲藏室的食物'), target: 'tavern', mood_self: 8, mood_others: -2, severity: 'moderate' },
            { text: t('在水井裡放了無害的染料'), target: 'well', mood_self: 5, mood_others: -5, severity: 'moderate' },
            { text: t('偷偷移動了路標的方向'), target: null, mood_self: 3, mood_others: -2, severity: 'minor' },
            { text: t('在廣場放了一堆假蜘蛛'), target: 'town_square', mood_self: 8, mood_others: -4, severity: 'minor' },
        ];
        const mischief = pickRandom(mischiefTypes);
        this.moodModifier = (this.moodModifier || 0) + mischief.mood_self;
        world.logMessage('mischief', `${this.name}${t('趁著夜色')}${mischief.text}${t('！')}`, this.name);
        this.memory.add(world.tickCount, world.clock.timeStr, 'mischief', `${t('我趁夜裡')}${mischief.text}`, 6, []);
        this.currentThought = t('嘿嘿...成功了。');
        world.events.conversationTopics.push(`${t('有人在夜裡')}${mischief.text}`);
        // Chance to get caught by guards or night owls
        const awakeAgents = Object.values(world.agents).filter(a => a.agentId !== this.agentId && a.activity !== 'sleeping' && !a.isPlayer);
        if (awakeAgents.length && Math.random() < 0.3) {
            const witness = pickRandom(awakeAgents);
            const rel = witness.relationships.getOrCreate(this.agentId, this.name);
            rel.modifyAffinity(-5);
            world.logMessage('mischief', `${witness.name}${t('撞見了')}${this.name}${t('的惡作劇！')}`, witness.name, this.name);
            witness.memory.add(world.tickCount, world.clock.timeStr, 'witness', `${t('撞見')}${this.name}${t('在')}${mischief.text}`, 7, [this.name]);
            this.moodModifier = (this.moodModifier || 0) - 5;
            this.currentThought = `${t('糟糕，被')}${witness.name}${t('看到了...')}`;
        }
    }
    _doMourning(world) {
        if (Math.random() > 0.15) return; // Process mourning periodically
        const year = world.clock.year;
        // Handle recent death mourning
        if (this._mourningTargets.length > 0) {
            const target = this._mourningTargets[0];
            this.currentThought = `${target.name}${t('...我會記得你的。')}`;
            this.needs.social = Math.min(100, this.needs.social + 0.5);
            this.moodModifier = (this.moodModifier || 0) + 0.3; // Slight comfort from paying respects
            this.memory.add(world.tickCount, world.clock.timeStr, 'mourning',
                `${t('前往墓園弔念')}${target.name}${t('。')}`, 7, [target.name]);
            world.logMessage('mourning', `🕯️ ${this.name}${t('前往墓園弔念')}${target.name}${t('。')}`, this.name);
            // If family, add to annual mourning list
            if (target.isFamily && !this._annualMourning.find(m => m.name === target.name)) {
                this._annualMourning.push({ name: target.name, lastVisitYear: year });
            }
            this._mourningTargets.shift(); // Remove from queue
            return;
        }
        // Handle annual family mourning
        const unvisited = this._annualMourning.find(m => m.lastVisitYear < year);
        if (unvisited) {
            unvisited.lastVisitYear = year;
            this.currentThought = `${t('又到了一年...去看看')}${unvisited.name}${t('吧。')}`;
            this.moodModifier = (this.moodModifier || 0) - 2;
            this.needs.social = Math.min(100, this.needs.social + 1);
            this.memory.add(world.tickCount, world.clock.timeStr, 'mourning',
                `${t('每年都會來墓園看望')}${unvisited.name}${t('。')}`, 6, [unvisited.name]);
            world.logMessage('mourning', `🕯️ ${this.name}${t('來到墓園，緬懷已故的親人')}${unvisited.name}${t('。')}`, this.name);
        }
    }
    _generateThought(world) {
        const thoughts = [];
        const hour = world.clock.hour;
        const isNight = hour >= 21 || hour < 5;
        if (this.mood > 60) { thoughts.push(`${world.townName || t('邊境鎮')}${t('的生活還不錯。')}`, t('今天感覺很好！')); }
        else if (this.mood < 20) { thoughts.push(t('事情可以更好的...'), t('我感覺不太好。')); }
        if (this.needs.hunger < 30) thoughts.push(t('肚子好餓...'));
        if (this.needs.rest < 30) thoughts.push(t('好想睡覺...'));
        if (this.needs.social < 30) thoughts.push(t('應該找人聊聊天...'));
        // Night-specific thoughts
        if (this.activity === 'stargazing') {
            thoughts.push(t('今晚的星空真美...'), t('那顆星星特別亮。'), t('仰望星空讓人感覺渺小...'), t('流星！快許願！'));
            if (world.clock.season === '冬季') thoughts.push(t('冬天的星空格外清晰。'));
        }
        if (this.activity === 'night_stroll') {
            thoughts.push(t('夜裡的鎮上好安靜...'), t('月光下散步真舒服。'), t('夜風吹來很涼爽。'));
            if (this.mood < 30) thoughts.push(t('睡不著...出來走走吧。'), t('夜裡比較容易想事情...'));
        }
        if (this.activity === 'mourning') {
            thoughts.push(t('願逝者安息...'), t('站在墓前，心裡百感交集。'), t('我不會忘記你的。'));
            if (this._annualMourning.length > 0) thoughts.push(`${this._annualMourning[0].name}${t('...我來看你了。')}`);
        }
        if (this.activity === 'night_mischief') {
            thoughts.push(t('嘿嘿，趁大家都睡了...'), t('沒人看到的話...'), t('夜裡做點小惡作劇。'));
        }
        if (isNight && this.personality.traits.includes('night_owl')) {
            thoughts.push(t('夜晚才是我的主場。'), t('安靜的夜晚最適合思考。'));
        }
        if (isNight && !this.personality.traits.includes('night_owl') && this.activity !== 'sleeping') {
            thoughts.push(t('這麼晚了還沒睡...'), t('明天會很累吧。'));
        }
        // v5.58.0 跨鎮親緣:偶爾想起海那頭的親友——路通不通,人都在心上
        const tie = typeof CROSS_TOWN_TIES !== 'undefined' ? CROSS_TOWN_TIES[this.agentId] : null;
        if (tie && Math.random() < 0.3) thoughts.push(pickRandom(tie.thoughts));
        // v5.47.0 BUG-01 防護:名字是純數字的斷掉引用(舊檔殘留)不進閒置意圖
        const bf = this.relationships.getBestFriend();
        if (bf && bf.targetName && !/^\d+$/.test(String(bf.targetName))) thoughts.push(`${t('該去找')}${bf.targetName}${t('敘敘舊了。')}`);
        const rom = this.relationships.getRomanticInterests().filter(r => r.targetName && !/^\d+$/.test(String(r.targetName)));
        if (rom.length) thoughts.push(`${t('一直在想')}${pickRandom(rom).targetName}...`);
        const best = this.skills.bestSkill;
        if (best.level > 0) thoughts.push(`${t(best.category)}${t('技能進步中...')}`);
        // Economy thoughts
        if (world.stockpile) {
            if (world.stockpile.get('food') < 30) thoughts.push(t('食物快不夠了...'));
            if (world.stockpile.get('silver') > 300) thoughts.push(t('鎮上的國庫很充裕！'));
            if (world.stockpile.get('meals') < 10) thoughts.push(t('廚師需要多準備一些餐食。'));
        }
        if (world.buildings?.projects?.length) { const p=world.buildings.projects[0]; thoughts.push(`${p.name}${t('已完成')}${Math.round(p.workDone/p.workRequired*100)}%${t('！')}`); }
        if (world.trade?.merchant) thoughts.push(`${t('去看看')}${world.trade.merchant.name}${t('在賣什麼吧。')}`);
        if (world.news?.bulletins?.length) {
            const latest = world.news.bulletins[world.news.bulletins.length-1];
            if (latest.severity === 'danger') thoughts.push(`${t('「')}${latest.headline}${t('」的消息令人擔憂...')}`);
            else if (latest.severity === 'good') thoughts.push(`${t('好消息：')}${latest.headline}${t('！')}`);
        }
        if (thoughts.length) this.currentThought = pickRandom(thoughts);
    }

    // ===== v5.30.0 人物狀態頁(移植 generative_agents 的 persona state) =====
    // 生活作息:由性格與職業推出的固定節奏(對應原版 lifestyle)
    getLifestyleText() {
        const isNightOwl = this.personality.traits.includes('night_owl');
        const isEarlyBird = this.personality.traits.includes('early_bird');
        const sleepStart = isNightOwl ? 2 : (isEarlyBird ? 20 : 22);
        const sleepEnd = isNightOwl ? 9 : (isEarlyBird ? 5 : 6);
        let s = `${t('約')} ${sleepStart}:00 ${t('上床睡覺,')} ${sleepEnd}:00 ${t('起床')}`;
        if (this.job) s += `${t('；')}${this.job.workHours[0]}:00–${this.job.workHours[1]}:00 ${t('在')}${this.job.workplace.replace(/_/g,' ')}${t('工作')}`;
        if (isNightOwl) s += t('。是個夜貓子,深夜才有精神');
        if (isEarlyBird) s += t('。習慣早睡早起');
        return s + t('。');
    }

    // 近況:婚戀/夢想/最新反思/僵局,依當下狀態合成(對應原版 currently)
    // v5.37.0 若有 LLM 每日修訂的近況(this.currently),優先使用——這是他「人生此刻的主線」
    getPersonaStatus(world) {
        if (this.currently) return this.currently;
        const parts = [];
        const partner = this.relationships.getPartner();
        if (partner) parts.push(`${partner.status === 'married' ? t('和') + partner.targetName + t('是夫妻') : t('正在和') + partner.targetName + t('交往')}`);
        const crushes = this.relationships.getRomanticInterests().filter(r => !r.status);
        if (!partner && crushes.length) parts.push(`${t('偷偷喜歡著')}${crushes[0].targetName}`);
        const goal = world?.lifeGoals?.getGoal?.(this.agentId);
        if (goal && !goal.done) {
            const def = (typeof LIFE_GOALS !== 'undefined') ? LIFE_GOALS[goal.goalId] : null;
            if (def) parts.push(`${t('正朝著人生夢想「')}${def.name}${t('」努力(')}${def.stages[goal.stage] || ''}${t(')')}`);
        }
        const enemy = Object.values(this.relationships.relationships).filter(r => r.affinity < -30).sort((a,b)=>a.affinity-b.affinity)[0];
        if (enemy) parts.push(`${t('最近跟')}${enemy.targetName}${t('處得很僵')}`);
        const reflection = this.memory.getThoughts(1)[0];
        if (reflection) parts.push(`${t('心裡想著:「')}${reflection.content}${t('」')}`);
        if (!parts.length) parts.push(t('日子過得平平淡淡,沒什麼特別的事'));
        return parts.join(t('；')) + t('。');
    }

    // 今日目標:每天早上依作息+職業+性格+當下的人際/夢想/事件生成(對應原版 daily plan)
    generateDailyPlan(world) {
        const key = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        if (this.dailyPlan?.key === key) return this.dailyPlan;
        const traits = this.personality.traits;
        const isNightOwl = traits.includes('night_owl');
        const isEarlyBird = traits.includes('early_bird');
        const sleepStart = isNightOwl ? 2 : (isEarlyBird ? 20 : 22);
        const sleepEnd = isNightOwl ? 9 : (isEarlyBird ? 5 : 6);
        const goals = [];
        goals.push(`${sleepEnd}:00 ${t('起床,展開新的一天')}`);
        if (this.job) {
            const flavor = traits.includes('lazy') ? t('(能摸魚就摸魚)') : traits.includes('hardworking') ? t('(打算多做一點)') : traits.includes('perfectionist') ? t('(每件事都要做到位)') : '';
            goals.push(`${this.job.workHours[0]}:00 ${t('到')}${this.job.workplace.replace(/_/g,' ')}${t('上工,做')}${this.job.title}${t('的活')}${flavor}`);
        }
        // 動態目標:依今天的人際/夢想/祭典/選舉
        const fest = world.festivals?.activeFestival;
        if (fest) goals.push(`${t('抽空去逛')}${fest.name}${t(',看看')}${pickRandom(fest.activities)}`);
        const partner = this.relationships.getPartner();
        const crushes = this.relationships.getRomanticInterests().filter(r => !r.status);
        if (partner) goals.push(`${t('傍晚想跟')}${partner.targetName}${t('一起吃飯聊聊今天')}`);
        else if (crushes.length) goals.push(`${t('想找機會跟')}${crushes[0].targetName}${t('多說幾句話')}`);
        const enemy = Object.values(this.relationships.relationships).filter(r => r.affinity < -30).sort((a,b)=>a.affinity-b.affinity)[0];
        if (enemy) goals.push(`${t('盡量避開')}${enemy.targetName}${t(',免得又吵起來')}`);
        const goal = world?.lifeGoals?.getGoal?.(this.agentId);
        if (goal && !goal.done) {
            const def = (typeof LIFE_GOALS !== 'undefined') ? LIFE_GOALS[goal.goalId] : null;
            if (def) goals.push(`${t('為夢想「')}${def.name}${t('」再努力一點:')}${def.stages[goal.stage] || ''}`);
        }
        if (world.election?.phase && world.election.phase !== 'none') goals.push(t('跟人聊聊鎮長選舉,想想要投給誰'));
        if (this.needs.social < 35) goals.push(t('好一陣子沒跟人好好聊天了,今天想找人說說話'));
        // 晚間安排依性格
        if (traits.includes('gossip')) goals.push(t('晚上去酒館打聽今天的八卦'));
        else if (traits.includes('shy')) goals.push(t('晚上想一個人安靜待著'));
        else if (traits.includes('curious')) goals.push(t('晚上去圖書館翻翻書'));
        else goals.push(t('晚上找朋友放鬆一下'));
        goals.push(`${sleepStart}:00 ${t('回家睡覺')}`);
        this.dailyPlan = { key, goals };
        return this.dailyPlan;
    }

    // v5.37.0 目前行程步驟:LLM 分解式行程(blocks)中,找出「此刻正在做的子步驟」
    // 對應 generative_agents 的 task decomposition——行程不只是標籤,而是 5 分鐘級的生活片段
    getCurrentPlanStep(world) {
        const blocks = this.dailyPlan?.blocks;
        if (!blocks || !blocks.length) return null;
        const toMin = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; };
        const now = world.clock.hour * 60 + world.clock.minute;
        let cur = null, curStart = null, nextStart = 24 * 60;
        for (let i = 0; i < blocks.length; i++) {
            const s = toMin(blocks[i].time);
            if (s == null) continue;
            if (s <= now && (curStart == null || s >= curStart)) { cur = blocks[i]; curStart = s; nextStart = 24 * 60; for (let j = 0; j < blocks.length; j++) { const e = toMin(blocks[j].time); if (e != null && e > s && e < nextStart) nextStart = e; } }
        }
        if (!cur) return null;
        const steps = Array.isArray(cur.steps) ? cur.steps.filter(Boolean) : [];
        let step = '';
        if (steps.length) {
            const frac = Math.max(0, Math.min(0.999, (now - curStart) / Math.max(1, nextStart - curStart)));
            step = steps[Math.floor(frac * steps.length)] || steps[0];
        }
        return { goal: cur.text || '', step, time: cur.time || '' };
    }

    // 今日足跡:今天實際發生的記憶時間軸(對應原版逐格行程,但記的是真實事件)
    getTodayTimeline(world, n = 12) {
        const dayStart = world.tickCount - (world.clock.hour * 4 + Math.floor(world.clock.minute / 15));
        return this.memory.entries.filter(e => e.tick >= dayStart).slice(-n);
    }

    toDict() {
        return {
            id:this.agentId, name:this.name, age:this.age, gender:this.gender, gender_label:this.genderLabel,
            job: this.job?.toDict() || null, personality: this.personality.toDict(),
            mood:this.mood, moodModifier:this.moodModifier, mood_description:this.moodDescription, mood_label:this.moodLabel,
            activity:this.activity, activity_label:this.activityLabel,
            current_location:this.currentLocation, home_location:this.homeLocation, current_thought:this.currentThought,
            needs:this.needs.toDict(), skills:this.skills.toDict(),
            relationships:this.relationships.toDict(), recent_memories:this.memory.toDict(),
            thoughts: (this.thoughts || []).map(t2 => ({ ...t2 })), // v5.15.0 記憶想法(供 UI 顯示心情來源)
            attributes: { ...(this.attributes || {}) }, // v5.26.0 核心屬性
            look: this.look ? { ...this.look } : null, // v5.89.0 自訂外觀(地圖/頭像用)
        };
    }
}

// --- PlayerAgent ---
class PlayerAgent extends Agent {
    constructor(name = t('旅人'), age = 25) {
        super('player', name, age, new Personality(['creative','kind'], '最近抵達邊境鎮的神秘旅人。', ['冒險','友情']), null, 'tavern');
        this.isPlayer = true; this.chatHistory = []; this._recentChatTick = 0;
    }
    update(world) {
        // Auto-manage player activity based on needs and context
        this._autoManageActivity(world);
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation', world.clock.hour);
        // Passive recovery: location-based need bonuses
        if (this.currentLocation === 'tavern') this.needs.hunger = Math.min(100, this.needs.hunger + 0.5);
        if (['residential_north','residential_south','residential_east'].includes(this.currentLocation)) this.needs.rest = Math.min(100, this.needs.rest + 0.3);
        if (['town_square','tavern','park','chapel'].includes(this.currentLocation)) this.needs.social = Math.min(100, this.needs.social + 0.2);
        if (['park','chapel','library'].includes(this.currentLocation)) this.needs.recreation = Math.min(100, this.needs.recreation + 0.2);
        // Chatting with NPCs recovers social
        if (this._recentChatTick && world.tickCount - this._recentChatTick < 8) {
            this.needs.social = Math.min(100, this.needs.social + 1.5);
        }
        if (this.moodModifier > 0) this.moodModifier = Math.max(0, this.moodModifier - 0.5);
        else if (this.moodModifier < 0) this.moodModifier = Math.min(0, this.moodModifier + 0.5);
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution) + (this.moodModifier || 0)));
    }
    _autoManageActivity(world) {
        const hour = world.clock.hour;
        const isNight = hour >= 22 || hour < 6;
        // Night: auto-sleep (only critical hunger can interrupt)
        if (isNight && this.needs.rest < 95) {
            if (this.needs.hunger < 10) { this.activity = 'eating'; return; }
            this.activity = 'sleeping';
            return;
        }
        // Critical needs auto-recovery
        if (this.needs.hunger < 20) { this.activity = 'eating'; return; }
        if (this.needs.rest < 15) { this.activity = 'sleeping'; return; }
        if (this.needs.social < 20) { this.activity = 'socializing'; return; }
        if (this.needs.recreation < 15) { this.activity = 'recreation'; return; }
        // Working during work hours if player has a job
        if (this.job) {
            const [ws, we] = this.job.workHours;
            if (ws <= hour && hour < we) {
                if (this.needs.hunger < 30 && Math.random() < 0.3) { this.activity = 'eating'; return; }
                this.activity = 'working';
                return;
            }
        }
        // Default: keep current activity or wander
        if (this.activity === 'sleeping' && hour >= 6 && hour < 22) {
            this.activity = 'wandering';
        }
    }
    moveTo(locationId, world) {
        if (world.townMap && !world.townMap.locations[locationId]) return false;
        this.currentLocation = locationId; this.activity = 'wandering';
        const locLabels = {town_hall:t('鎮公所'),clinic:t('診所'),workshop:t('工坊'),farm:t('農場'),tavern:t('酒館'),guardpost:t('哨站'),chapel:t('教堂'),library:t('圖書館'),general_store:t('雜貨店'),quarry:t('礦場'),town_square:t('廣場'),park:t('公園'),well:t('水井'),residential_north:t('北區住宅'),residential_south:t('南區住宅'),residential_east:t('東區住宅')};
        world.logMessage('player_move', `${t('你移動到了')}${locLabels[locationId] || locationId.replace(/_/g,' ')}`, this.name);
        return true;
    }
    toDict() { const d = super.toDict(); d.is_player = true; d.chat_history = this.chatHistory.slice(-10000); return d; }
}
