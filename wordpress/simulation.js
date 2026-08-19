// ============================================================
// RimTown Simulation Engine - Complete JS Port
// ============================================================

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
    constructor(capacity = 500) { this.entries = []; this.capacity = capacity; }
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
    toDict() { return this.entries.slice(-10000).map(e => e.toDict()); }
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
        if (this.sharedMemories.length > 150) this.sharedMemories = this.sharedMemories.slice(-150);
    }
    addSharedMemory(text) {
        this.sharedMemories.push(text);
        if (this.sharedMemories.length > 150) this.sharedMemories = this.sharedMemories.slice(-150);
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
            const hangout = this._pendingHangout;
            if (hangout.tick <= 0) {
                this.targetLocation = hangout.location;
                this.activity = hangout.activity || 'socializing';
                this._pendingHangout = null;
            } else {
                hangout.tick--;
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
        if (this.mood > 60) { thoughts.push(t('邊境鎮的生活還不錯。'), t('今天感覺很好！')); }
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
        const bf = this.relationships.getBestFriend();
        if (bf) thoughts.push(`${t('該去找')}${bf.targetName}${t('敘敘舊了。')}`);
        const rom = this.relationships.getRomanticInterests();
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
        };
    }
}

// --- PlayerAgent ---
class PlayerAgent extends Agent {
    constructor(name = t('旅人'), age = 25) {
        super('player', name, age, new Personality(['creative','kind'], t('最近抵達邊境鎮的神秘旅人。'), ['冒險','友情']), null, 'tavern');
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

// --- Gossip Network ---
// --- v5.2.0 鎮民動態(小鎮朋友圈) ---
class TownFeedSystem {
    constructor() { this.posts = []; this._counter = 0; this._lastLlmPostTick = -9999; }
    addPost(world, author, text, opts = {}) {
        this._counter++;
        const post = {
            id: 'p' + this._counter, authorId: author.agentId, authorName: author.name,
            text, time: world.clock.timeStr,
            day: `${t('第')}${world.clock.year}${t('年')} ${world.clock.season} ${t('第')}${world.clock.day}${t('天')}`,
            tick: world.tickCount, likes: [], comments: opts.comments || [],
        };
        this.posts.push(post);
        if (this.posts.length > 120) this.posts = this.posts.slice(-120);
        world._feedUnread = (world._feedUnread || 0) + 1;
        return post;
    }
    serialize() { return { posts: this.posts.slice(-80), _counter: this._counter }; }
    load(d) { if (d) { this.posts = Array.isArray(d.posts) ? d.posts : []; this._counter = d._counter || 0; } }
}

class GossipNetwork {
    constructor() { this.activeGossip = []; }
    // v5.3.0 針對真實關係事件生成「有內容」的八卦(取代空泛的「八卦了全鎮的事」)
    createRelGossip(world, kind, a, b, extra) {
        const templates = {
            crush:   [`${t('欸你有沒有發現,')}${a.name}${t('看')}${b.name}${t('的眼神不太一樣...')}`,
                      `${t('我猜')}${a.name}${t('對')}${b.name}${t('有意思,不然幹嘛老是找藉口靠近!')}`],
            jealous: [`${t('聽說')}${a.name}${t('最近超針對')}${b.name}${t('的,好像是為了')}${extra || t('某個人')}${t('...')}`,
                      `${a.name}${t('跟')}${b.name}${t('之間氣氛好僵,是在吃醋吧?')}`],
            newCouple:[`${t('天大的消息!')}${a.name}${t('和')}${b.name}${t('在一起了!')}`,
                      `${a.name}${t('跟')}${b.name}${t('湊成一對了,大家都說很配!')}`],
            rivalry: [`${a.name}${t('和')}${b.name}${t('鬧翻了,見面都不講話...')}`,
                      `${t('你敢信嗎?')}${a.name}${t('跟')}${b.name}${t('現在是死對頭了。')}`],
        };
        const pool = templates[kind]; if (!pool) return null;
        const content = pickRandom(pool);
        const gossip = { about: a.name, content, source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true, kind, juicy: true };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        // 直接進八卦頭條 & 每日報
        world.logMessage('gossip', `🗞️ ${content}`, a.name, b.name);
        if (world.dailyNews) world.dailyNews.collectEvent('gossip', content, kind === 'newCouple' ? 7 : 5, [a.name, b.name]);
        return gossip;
    }
    createGossip(source, about, world) {
        const rel = source.relationships.getOrCreate(about.agentId, about.name);
        const templates = [];
        if (rel.romanticInterest > 40) templates.push(`${t('你不覺得')}${about.name}${t('挺有魅力的嗎？')}`);
        if (rel.affinity < -10) templates.push(`${t('說真的，')}${about.name}${t('最近行為很奇怪。')}`);
        if (about.mood < -20) templates.push(`${t('你有注意到')}${about.name}${t('最近看起來很低落嗎？')}`);
        if (about.mood > 50) templates.push(`${about.name}${t('最近心情超好的！')}`);
        const ri = about.relationships.getRomanticInterests();
        if (ri.length) templates.push(`${t('聽說')}${about.name}${t('好像對')}${pickRandom(ri).targetName}${t('有意思！')}`);
        const partner = about.relationships.getPartner();
        if (partner) {
            if (partner.status === 'dating') templates.push(`${about.name}${t('和')}${partner.targetName}${t('在交往呢，你知道嗎？')}`);
            if (partner.status === 'married') templates.push(`${about.name}${t('和')}${partner.targetName}${t('的婚姻生活不知道怎麼樣？')}`);
            if (partner.isCheating) templates.push(`${t('我好像看到')}${about.name}${t('背著')}${partner.targetName}${t('跟別人在一起⋯⋯')}`);
        }
        const aboutPartner = about.relationships.getPartner();
        const cheatingRels = Object.values(about.relationships.relationships).filter(r => r.isCheating);
        if (cheatingRels.length) templates.push(`${t('你聽說了嗎？')}${about.name}${t('好像在劈腿⋯⋯')}`);
        if (!templates.length) templates.push(`${t('你聽說')}${about.name}${t('昨天在做什麼嗎？')}`);
        const content = pickRandom(templates);
        const gossip = { about:about.name, content, source:source.name, spreadCount:0, tickCreated:world.tickCount, isTrue:Math.random()>0.2 };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        return gossip;
    }
    spreadGossip(speaker, listener, world) {
        if (!this.activeGossip.length) return null;
        const eligible = this.activeGossip.filter(g => g.about !== listener.name);
        if (!eligible.length) return null;
        if (!speaker.personality.traits.includes('gossip') && Math.random() > 0.3) return null;
        const gossip = pickRandom(eligible);
        gossip.spreadCount++;
        // v5.2.0/5.3.0 傳話遊戲:謠言誇張化只做一次,不重複堆疊
        if (!gossip._mutated && gossip.spreadCount >= 2 && Math.random() < 0.4) {
            gossip._mutated = true;
            const wraps = [
                (c) => `${t('我跟你說,')}${c}${t('而且好像不只這樣...')}`,
                (c) => `${t('千真萬確!')}${c}`,
                (c) => `${c}${t('聽說整條街都知道了!')}`,
            ];
            gossip.content = pickRandom(wraps)(gossip.content);
        }
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social',
            `${speaker.name}${t('告訴我：「')}${gossip.content}${t('」')}`, 4, [speaker.name, gossip.about]);
        // v5.3.0 只有「有內容」且還算新鮮(傳不到 3 手)的八卦才進頭條,避免同一則洗版
        if (gossip.juicy && gossip.spreadCount <= 3) {
            world.logMessage('gossip', `🗣️ ${speaker.name}${t('偷偷說：「')}${gossip.content}${t('」')}`, speaker.name, listener.name);
        }
        // v5.2.0 傳到第 4 手,當事人聽到了 → 對質
        if (gossip.spreadCount >= 4 && !gossip._confronted) {
            gossip._confronted = true;
            this._handleGossipReachesSubject(gossip, world);
        }
        return gossip;
    }

    // v5.2.0 謠言傳回當事人耳裡:負面/不實 → 找源頭對質;正面 → 感謝
    _handleGossipReachesSubject(gossip, world) {
        const subject = Object.values(world.agents).find(a => a.name === gossip.about);
        if (!subject || subject.isPlayer) return;
        const source = Object.values(world.agents).find(a => a.name === gossip.source);
        const negative = gossip.tone === 'diss' || !gossip.isTrue || /奇怪|劈腿|背著|懶散/.test(gossip.content);
        const positive = gossip.tone === 'praise';
        if (source && source.isPlayer) {
            // 玩家是造謠源頭!
            const relToPlayer = subject.relationships.getOrCreate(source.agentId, source.name);
            if (positive) {
                relToPlayer.modifyAffinity(6);
                subject.addThought('praised', world, source.agentId, source.name); // v5.15.0 被公開稱讚
                subject.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('聽說')}${source.name}${t('到處誇我,真開心!')}`, 6, [source.name]);
                source.chatHistory?.push?.({ speaker: subject.name, target: source.name, text: t('欸,我聽說你到處跟人誇我?哈哈,謝啦,請你喝一杯!'), time: world.clock.timeStr });
                world.logMessage('gossip', `💐 ${subject.name}${t('聽到了鎮長的美言,好感大增!')}`, subject.name);
            } else if (negative) {
                relToPlayer.modifyAffinity(-12); relToPlayer.modifyTrust(-10);
                subject.addThought('slandered', world, source.agentId, source.name); // v5.15.0 被說壞話
                subject.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('居然是')}${source.name}${t('在背後說我壞話...太過分了。')}`, 8, [source.name]);
                source.chatHistory?.push?.({ speaker: subject.name, target: source.name, text: t('我都聽說了。你在背後那樣說我?虧我還這麼信任你。'), time: world.clock.timeStr });
                world.logMessage('gossip', `💢 ${subject.name}${t('發現')}${source.name}${t('在背後說他壞話,關係惡化!')}`, subject.name);
            }
            if (world.conversationEngine?.onNpcMessage) world.conversationEngine.onNpcMessage(subject.agentId);
        } else if (source && negative && source !== subject) {
            const relA = subject.relationships.getOrCreate(source.agentId, source.name);
            const relB = source.relationships.getOrCreate(subject.agentId, subject.name);
            relA.modifyAffinity(-12); relB.modifyAffinity(-8);
            world.logMessage('gossip', `💢 ${subject.name}${t('聽到了')}${source.name}${t('散布的謠言,當面對質!兩人關係惡化')}`, subject.name, source.name);
            if (world.dailyNews) world.dailyNews.collectEvent('drama', `${subject.name}${t('為了謠言找')}${source.name}${t('對質!')}`, 7, [subject.name, source.name]);
            // 當事人在鎮民動態發文澄清
            world.townFeed?.addPost(world, subject, pickRandom([
                `${t('最近聽到一些關於我的傳言。清者自清,懶得解釋。')}`,
                `${t('有些人嘴巴可以積點德嗎?')}`,
                `${t('謠言止於智者。就這樣。')}`,
            ]));
        }
        // v5.2.0 亂點鴛鴦:紅娘謠言讓兩位當事人開始注意彼此
        if (gossip.tone === 'ship' && gossip.shipWith) {
            const other = Object.values(world.agents).find(a => a.name === gossip.shipWith);
            if (other && !subject.isPlayer && !other.isPlayer && !subject.relationships.getPartner() && !other.relationships.getPartner()) {
                subject.relationships.getOrCreate(other.agentId, other.name).modifyRomantic(randInt(3, 6));
                other.relationships.getOrCreate(subject.agentId, subject.name).modifyRomantic(randInt(3, 6));
                world.logMessage('gossip', `💘 ${t('被大家起鬨之後,')}${subject.name}${t('和')}${gossip.shipWith}${t('好像真的開始注意彼此了...')}`, subject.name);
            }
        }
    }

    // v5.2.0 玩家放話:把八卦丟進謠言網路
    playerSeedGossip(world, player, listener, about, tone, shipWith) {
        const templates = {
            praise: [`${about.name}${t('最近超罩的,大家都該學學!')}`, `${t('我覺得')}${about.name}${t('是鎮上最可靠的人。')}`],
            diss: [`${about.name}${t('最近很懶散,大家小心點...')}`, `${t('說真的,')}${about.name}${t('私底下跟表面不太一樣喔...')}`],
            ship: [`${about.name}${t('和')}${shipWith || ''}${t('是不是有什麼?我看他們常常眉來眼去...')}`],
        };
        const content = pickRandom(templates[tone] || templates.praise);
        const gossip = {
            about: about.name, content, source: player.name, spreadCount: 1,
            tickCreated: world.tickCount, isTrue: tone === 'praise', tone,
            shipWith: shipWith || null,
        };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social', `${player.name}${t('偷偷跟我說:「')}${content}${t('」')}`, 5, [player.name, about.name]);
        world.logMessage('gossip', `🗣️ ${t('鎮長偷偷向')}${listener.name}${t('爆料了')}${about.name}${t('的事...')}`, player.name, listener.name);
        return gossip;
    }
}

// --- Conversation Engine (Personality-Driven + LLM) ---
class ConversationEngine {
    constructor(llmClient = null) {
        this.llm = llmClient;
        this.npcConversationLog = [];
        this._lastNpcLlmTick = 0;
        this._npcLlmCooldownTicks = 8; // Minimum ticks between NPC LLM calls
        this.onConversation = null; // Callback: (agentAId, agentBId, agentAName, agentBName, textA, textB) => {}
        this._lastNpcMsgTick = 0;
        this._npcMsgCooldownTicks = 30; // ~1 minute between proactive NPC messages
        this.onNpcMessage = null; // Callback: (npcId) => {} — notify UI of incoming message
        // v5.29.0 混合成本控制:app.js 注入「該 NPC 是否在玩家附近」的判定(8 格內)
        this.isNearPlayer = null; // (agentId) => bool
        // v5.37.0 全鎮 LLM 行程:每天為每位村民排隊生成「近況+分解式行程」,一次一位避免瞬間打爆 API
        this._planQueue = [];
        this._planBusy = false;
    }

    // v5.29.0 NPC↔NPC 對話每日 LLM 額度(可在設定頁調整;玩家聊天/劇情名場面不受限)
    // v5.37.0 預設改為無上限(金鑰是使用者自己的);想控費可在設定頁填數字,填 0 = 關閉 NPC 對話 LLM
    npcLlmDailyBudget() {
        try {
            const raw = localStorage.getItem('rimtown_npc_llm_budget');
            if (raw === null || raw === '') return Infinity;
            const v = parseInt(raw, 10);
            if (Number.isFinite(v) && v >= 0) return v;
        } catch (e) {}
        return Infinity;
    }

    // NPC↔NPC 對話是否允許用 LLM:雙方任一在玩家附近 + 今日額度未用完
    _npcLlmAllowed(world, agentA, agentB) {
        if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) return false;
        if (this.isNearPlayer) {
            return this.isNearPlayer(agentA.agentId) || this.isNearPlayer(agentB.agentId);
        }
        // 沒有地圖座標時退回「跟玩家同地點」判定
        const player = world.agents['player'];
        return !!player && (agentA.currentLocation === player.currentLocation || agentB.currentLocation === player.currentLocation);
    }

    _countNpcLlmUse(world) { world.npcLlmUsedToday = (world.npcLlmUsedToday || 0) + 1; }

    // v5.37.0 全鎮 LLM 行程(移植 generative_agents plan.py 的階層式規劃):
    // 每天清晨把所有村民排進隊伍,每個 tick 生成一位的「近況修訂 + 今日行程(含子步驟分解)」。
    // 玩家附近/劇情相關的村民優先,額度用完的村民保留規則式行程,不會空白。
    queueDailyPlans(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && a.currentLocation !== 'exploration');
        // 優先序:玩家附近 > 昨日記憶精彩(重要度總分高) > 其餘
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const scoreOf = (a) => {
            let s = a.memory.entries.filter(e => e.tick >= since).reduce((sum, e) => sum + (e.importance || 3), 0);
            if (this.isNearPlayer && this.isNearPlayer(a.agentId)) s += 1000;
            return s;
        };
        this._planQueue = npcs.sort((a, b) => scoreOf(b) - scoreOf(a)).map(a => a.agentId);
    }

    async tickPlanQueue(world) {
        if (this._planBusy || !this._planQueue.length) return;
        if (!this.llm || !this.llm._canMakeRequest(false)) return;
        if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) { this._planQueue = []; return; }
        const id = this._planQueue.shift();
        const npc = world.agents[id];
        if (!npc || npc.isDead || npc.isPlayer) return;
        this._planBusy = true;
        try {
            this._countNpcLlmUse(world);
            await this._generatePlanLLM(npc, world);
        } catch (e) { console.warn('[RimTown] plan LLM failed:', e); }
        finally { this._planBusy = false; }
    }

    async _generatePlanLLM(npc, world) {
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const p = this._buildCharacterProfile(npc);
        // 昨天的素材:計畫思考(對話裡的約定/待辦) + 最重要的記憶 + 最新體悟
        const memos = npc.memory.entries.filter(e => e.category === 'plan' && e.tick >= since).slice(-4).map(m => `- ${m.content}`).join('\n');
        const topMem = npc.memory.entries.filter(e => e.tick >= since && e.category !== 'plan')
            .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 5).map(m => `- ${m.content}`).join('\n');
        const thoughts = npc.memory.getThoughts(2).map(m => `- ${m.content}`).join('\n');
        const prevCurrently = npc.currently || npc.getPersonaStatus(world);
        const fest = world.festivals?.activeFestival;
        const ctx = [];
        if (fest) ctx.push(`${t('今天是')}${fest.name}${t('：')}${fest.description}`);
        if (world.election?.phase && world.election.phase !== 'none') ctx.push(t('鎮長選舉正在進行,鎮上都在討論。'));
        const wType = world.weather?.current;
        if (wType?.name) ctx.push(`${t('天氣：')}${wType.name}`);
        const prompt = `${t('你在為模擬小鎮「邊境鎮」的居民規劃真實的一天。像寫小說一樣,讓行程反映他的性格、人際與心事。')}
${t('【居民】')}${p.name}${t('，')}${p.age}${t('歲')}${p.job}${t('，性格')}${p.traits}${t('。')}${p.status}
${t('【作息】')}${npc.getLifestyleText()}
${t('【目前近況】')}${prevCurrently}
${ctx.length ? `${t('【今日環境】')}${ctx.join(t('；'))}` : ''}
${memos ? `${t('【昨天的約定/待辦】')}\n${memos}` : ''}
${topMem ? `${t('【昨天印象最深的事】')}\n${topMem}` : ''}
${thoughts ? `${t('【心裡的體悟】')}\n${thoughts}` : ''}

${t('【任務】')}
1. ${t('根據昨天發生的事,把「近況」改寫成一句 40 字內的人生此刻主線(第三人稱,像「正在存錢想開自己的麵包店,最近和XX走得很近」)。')}
2. ${t('生成今天的行程:6-8 個時段,每個時段 2-4 個具體的小動作(像「揉麵團」「跟熟客閒聊兩句」,不要抽象標籤)。行程要呼應約定、心事與性格,工作時段要符合作息。')}
${t('【規則】繁體中文(台灣用語)。只輸出 JSON,不要其他文字：')}
{"currently": "...", "plan": [{"time": "06:00", "text": "${t('時段在做什麼')}", "steps": ["${t('小動作1')}", "${t('小動作2')}"]}]}`;
        const response = await this.llm.generate(prompt, 900, 0.85, true);
        if (!response || response === '__ERROR__' || response === '__RATE_LIMITED__') return;
        let data = null;
        try {
            const js = response.indexOf('{'), je = response.lastIndexOf('}') + 1;
            if (js >= 0 && je > js) data = JSON.parse(response.slice(js, je));
        } catch (e) { return; }
        if (!data || !Array.isArray(data.plan) || !data.plan.length) return;
        const blocks = data.plan.filter(b => b && b.text).slice(0, 10).map(b => ({
            time: String(b.time || '').slice(0, 5),
            text: String(b.text).slice(0, 60),
            steps: (Array.isArray(b.steps) ? b.steps : []).filter(Boolean).slice(0, 4).map(s => String(s).slice(0, 40)),
        }));
        if (!blocks.length) return;
        const key = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        npc.dailyPlan = { key, goals: blocks.map(b => `${b.time} ${b.text}`), blocks, llm: true };
        if (typeof data.currently === 'string' && data.currently.trim()) {
            npc.currently = data.currently.trim().slice(0, 80);
        }
    }

    // v5.29.0 每日反思(移植 generative_agents reflect),v5.35.0 豐富化:
    // 1) 規則式(零成本):每位村民每天合成 1-2 條想法(人際 + 生活/夢想/事件) + 1 條昨日印象觀察
    // 2) LLM 深度反思:每天最多 3 位(挑昨日記憶重要度最高者),生成內心體悟
    async dailyReflection(world) {
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead);
        const scored = [];
        for (const npc of npcs) {
            const recent = npc.memory.entries.filter(e => e.tick >= since && e.category !== 'reflection' && e.category !== 'observation');
            // 規則式想法 1:昨天跟誰互動最多 → 依好感方向合成
            const counts = {};
            recent.forEach(e => (e.relatedAgents || []).forEach(nm => { if (nm && nm !== npc.name) counts[nm] = (counts[nm] || 0) + 1; }));
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (top && top[1] >= 3) {
                const [topName] = top;
                const rel = Object.values(npc.relationships.relationships).find(r => r.targetName === topName);
                const aff = rel ? rel.affinity : 0;
                let text;
                if (rel && (rel.status === 'dating' || rel.status === 'married')) text = pickRandom([`${t('最近和')}${topName}${t('的感情越來越深了。')}`, `${t('有')}${topName}${t('在身邊的日子,連工作都不覺得累。')}`]);
                else if (aff > 40) text = pickRandom([`${t('我最近跟')}${topName}${t('走得很近，有這樣的朋友真好。')}`, `${topName}${t('這個人,值得深交。')}`]);
                else if (aff < -20) text = pickRandom([`${topName}${t('最近老是跟我過不去，想到就煩。')}`, `${t('再讓')}${topName}${t('這樣下去,我遲早要跟他攤牌。')}`]);
                else text = `${t('最近常碰到')}${topName}${t('，這人比我想的有意思。')}`;
                const dup = npc.memory.entries.some(e => e.category === 'reflection' && e.tick >= since && e.relatedAgents.includes(topName));
                if (!dup) npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', text, 6, [topName]);
            }
            // v5.35.0 規則式想法 2:生活面(夢想/暗戀/需求/天氣/祭典),每天最多一條
            try {
                const lifePool = [];
                const goal = world.lifeGoals?.getGoal?.(npc.agentId);
                const def = goal && !goal.done && typeof LIFE_GOALS !== 'undefined' ? LIFE_GOALS[goal.goalId] : null;
                if (def) lifePool.push(`${t('離「')}${def.name}${t('」還有多遠呢...但我不會停下來的。')}`, `${t('夜裡想起我的夢想:')}${def.stages[goal.stage] || ''}${t('。明天再往前一步吧。')}`);
                const crush = npc.relationships.getRomanticInterests().filter(r => !r.status)[0];
                if (crush) lifePool.push(`${t('今天又想起')}${crush.targetName}${t('...我到底在期待什麼呢。')}`, `${t('要是能跟')}${crush.targetName}${t('多說上幾句話就好了。')}`);
                if (npc.needs.social < 35) lifePool.push(t('好久沒跟人好好說話了,心裡悶悶的。'));
                if (world.weather?.current?.type === 'rain' || world.weather?.current?.type === 'storm') lifePool.push(t('聽著雨聲,思緒飄得很遠。'));
                if (world.festivals?.activeFestival) lifePool.push(`${world.festivals.activeFestival.name}${t('的熱鬧還在耳邊,好日子總是過得快。')}`);
                if (npc.personality.traits.includes('gossip')) lifePool.push(t('今天聽到的八卦,不知道是真是假...明天再打聽打聽。'));
                if (lifePool.length && Math.random() < 0.5) {
                    npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', pickRandom(lifePool), 4, []);
                }
            } catch (e) {}
            // v5.35.0 昨日印象:一條低重要度的觀察記憶,讓今日足跡/檢索有生活質感
            try {
                const wType = world.weather?.current?.type || 'clear';
                const obsPool = [
                    `${t('在')}${(npc.job?.workplace || npc.homeLocation).replace(/_/g, ' ')}${t('忙了一整天,手都酸了。')}`,
                    wType === 'rain' ? t('昨天雨下個不停,路上都是泥。') : wType === 'snow' ? t('昨天雪景很美,屋簷都白了。') : t('昨天天色不錯,鎮上人來人往。'),
                    `${t('路過廣場時聞到烤麵包的香味,肚子咕嚕叫了。')}`,
                    `${t('聽見酒館傳來笑聲,小鎮的日子就是這樣熱熱鬧鬧的。')}`,
                ];
                npc.memory.add(world.tickCount, world.clock.timeStr, 'observation', pickRandom(obsPool), 2, []);
            } catch (e) {}
            const score = recent.reduce((s, e) => s + (e.importance || 5), 0);
            if (score >= 40) scored.push({ npc, recent, score });
        }
        // LLM 深度反思:每天最多 3 位,吃 NPC LLM 額度;挑昨日最精彩的村民
        scored.sort((a, b) => b.score - a.score);
        for (const { npc, recent } of scored.slice(0, 3)) {
            if (!this.llm || !this.llm._canMakeRequest(false)) break;
            if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) break;
            try {
                const topMem = recent.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 6)
                    .map(m => `- ${m.content}`).join('\n');
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你正在扮演「')}${pN.name}${t('」——')}${pN.age}${t('歲的')}${pN.job}${t('，性格')}${pN.traits}${t('。')}
${t('夜深了，你回想今天發生的事：')}
${topMem}

${t('【任務】寫下你今晚睡前心裡最深的一個體悟——關於某個人、某段關係、或你自己的處境。')}
${t('【規則】繁體中文（台灣用語），只寫一句話，第一人稱，有情感、有觀點，不要流水帳。不要加引號或其他文字。')}`;
                this._countNpcLlmUse(world);
                const response = await this.llm.generate(prompt, 120, 0.9, false);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    const text = response.trim().replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    if (text) {
                        const related = [...new Set(recent.flatMap(m => m.relatedAgents || []))].slice(0, 3);
                        npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', text, 8, related);
                        world.logMessage('thought', `💭 ${npc.name}${t('的內心：')}${text}`, npc.name);
                    }
                }
            } catch (e) { console.error('[RimTown] dailyReflection LLM failed:', e); }
        }
    }

    // v5.35.0 耳語植入(移植 generative_agents whisper):把玩家的一句話轉寫成
    // NPC 第一人稱的內心念頭,寫入記憶流——他會當成自己的想法,影響之後的對話與反思
    async plantWhisper(player, npc, text, world) {
        let thought = '', fx = {};
        if (this.llm) {
            try {
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你在為模擬遊戲處理「耳語植入」：玩家在村民耳邊低語,這句話會化成村民自己的內心念頭。')}
${t('村民：')}${pN.name}${t('，')}${pN.age}${t('歲')}${pN.job}${t('，性格')}${pN.traits}${t('。')}
${t('玩家的耳語：「')}${text}${t('」')}

${t('【任務】把耳語轉寫成這位村民會相信的「第一人稱內心念頭」——像是他自己冒出的想法,符合他的性格與口吻。')}
${t('【規則】繁體中文（台灣用語），只寫一句話。多疑或與他認知矛盾時可以寫成半信半疑的念頭。不要引號。')}
${t('最後一行：')}EFFECTS: {"target": "${t('若念頭涉及某位村民寫其姓名,否則空字串')}", "affinity_change": ${t('數字')}(-8${t('到')}8), "romantic_change": ${t('數字')}(0${t('到')}8)}`;
                const response = await this.llm.generate(prompt, 250, 0.9, true);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    const lines = response.trim().split('\n').filter(Boolean);
                    const fxLine = lines.find(l => l.includes('EFFECTS:'));
                    if (fxLine) { try { const js = fxLine.indexOf('{'); fx = JSON.parse(fxLine.slice(js)); } catch (e) {} }
                    thought = lines.filter(l => !l.includes('EFFECTS:')).join(' ').replace(/^["「『]|["」』]$/g, '').trim();
                }
            } catch (e) { console.error('[RimTown] whisper LLM failed:', e); }
        }
        if (!thought) thought = text; // 沒有 LLM 就原文植入
        const targets = [];
        // 念頭涉及的村民:LLM 給的 target,或直接掃描文字中出現的村民名
        const targetName = typeof fx.target === 'string' ? fx.target.trim() : '';
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead || a.agentId === npc.agentId) continue;
            if (a.name === targetName || thought.includes(a.name)) targets.push(a.name);
        }
        npc.memory.add(world.tickCount, world.clock.timeStr, 'whisper', thought, 8, targets.slice(0, 2));
        // 機械後果:對被提及村民的好感/浪漫漂移
        const tgt = Object.values(world.agents).find(a => !a.isPlayer && !a.isDead && a.name === (targetName || targets[0]));
        if (tgt) {
            const rel = npc.relationships.getOrCreate(tgt.agentId, tgt.name);
            const affD = Math.max(-8, Math.min(8, Math.round(fx.affinity_change || 0)));
            const romD = Math.max(0, Math.min(8, Math.round(fx.romantic_change || 0)));
            rel.modifyAffinity(affD); rel.modifyRomantic(romD);
        }
        world.logMessage('whisper', `🤫 ${t('你在')}${npc.name}${t('耳邊低語...一個念頭在他心裡生根了。')}`, player?.name, npc.name);
        return { thought };
    }

    /**
     * Called every world tick. Occasionally has an NPC send a proactive message to the player.
     */
    async tickProactiveMessages(world) {
        const player = world.agents['player'];
        if (!player) return;
        const ticksSince = world.tickCount - this._lastNpcMsgTick;
        if (ticksSince < this._npcMsgCooldownTicks) return;
        // ~5% chance per tick after cooldown
        if (Math.random() > 0.05) return;

        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.activity !== 'sleeping');
        if (!npcs.length) return;

        // Pick NPC — prefer higher affinity NPCs
        const weighted = npcs.map(npc => {
            const rel = npc.relationships.getOrCreate(player.agentId, player.name);
            return { npc, weight: Math.max(1, (rel.affinity || 0) + 10) };
        });
        const totalW = weighted.reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * totalW;
        let picked = weighted[0].npc;
        for (const w of weighted) { r -= w.weight; if (r <= 0) { picked = w.npc; break; } }

        this._lastNpcMsgTick = world.tickCount;

        // Generate proactive message
        const npc = picked;
        const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
        const relPlayer = player.relationships.getOrCreate(npc.agentId, npc.name);

        let npcText = '';
        if (this.llm && this.llm._canMakeRequest(false)) {
            try {
                const pN = this._buildCharacterProfile(npc);
                const recentChat = player.chatHistory.filter(c => c.target === npc.name || c.speaker === npc.name)
                    .slice(-5).map(c => `${c.speaker}: ${c.text}`).join('\n');
                // v5.29.0 記憶流:主動傳訊也帶著對玩家的記憶
                const memNpc = npc.memory.retrieve(player.name, [player.name], 3, world.tickCount);

                const scenarios = [
                    t('你想跟旅人分享今天工作的趣事'),
                    t('你想約旅人一起去做某件事'),
                    t('你突然想到一個問題想問旅人'),
                    t('你發現了一件有趣的事想告訴旅人'),
                    t('你想關心旅人最近過得如何'),
                    t('你想跟旅人聊聊最近鎮上的八卦'),
                ];
                // v5.0.0 祭典期間:NPC 更想邀玩家一起逛祭典
                const pFest = world.festivals?.activeFestival;
                if (pFest) {
                    scenarios.push(
                        `${t('今天是')}${pFest.name}${t('!你想邀旅人一起去')}${pickRandom(pFest.activities)}`,
                        t('你在祭典會場看到超有趣的東西,想趕快告訴旅人'),
                        `${t('你想約旅人在祭典結束前一起去')}${pickRandom(pFest.activities)}`,
                    );
                }
                const scenario = pickRandom(scenarios);

                const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。你想主動傳一則訊息給')}${player.name}${t('。')}
${t('情境：')}${scenario}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${t('你現在在')}${npc.currentLocation.replace(/_/g,' ')}${t('，正在')}${npc.activity}${t('。')}
${this._buildRelContext(relNpc, player.name)}
${memNpc.length ? `${t('你記得：')}${memNpc.map(m=>m.content).join(t('；'))}` : ''}

${recentChat ? `${t('【最近對話】')}\n${recentChat}` : ''}

${t('【規則】')}
${t('- 繁體中文（台灣用語），1-2句就好，像傳LINE訊息那樣自然')}
${t('- 不要加任何前綴、名字標籤、引號')}
${t('- 直接寫訊息內容就好')}`;

                const response = await this.llm.generate(prompt, 150, 0.9, false);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    npcText = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                    // Strip any name prefix
                    npcText = npcText.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                }
            } catch(e) { console.error('[RimTown] Proactive NPC message LLM failed:', e); }
        }

        // Fallback if no LLM or LLM failed
        if (!npcText) {
            const fallbacks = [
                `${t('欸')}${player.name}${t('，今天有空嗎？')}`,
                `${t('嘿！你最近在忙什麼啊？')}`,
                `${t('你有聽說嗎？今天鎮上發生了一件事...')}`,
                `${t('唉，工作好累，想找人聊聊')}`,
                `${t('欸欸，等一下要不要一起去逛逛？')}`,
                `${player.name}${t('！好久沒聊了，最近好嗎？')}`,
                `${t('我剛剛看到一個超好笑的事想跟你說哈哈')}`,
            ];
            npcText = pickRandom(fallbacks);
        }

        // Record in chat history
        player.chatHistory.push({ speaker: npc.name, target: player.name, text: npcText, time: world.clock.timeStr });
        // Record in memory
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('主動傳訊息給')}${player.name}${t('：')}${npcText}`, 3, [player.name]);
        // Log
        world.logMessage('player_chat', `${npc.name} → ${player.name}: ${npcText}`, npc.name, player.name);
        // Notify UI
        if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
    }

    // v5.4.0: 人生里程碑敘事 — NPC 達成夢想的某階段時,發鎮民動態 + 進頭條 + 記憶
    async narrateLifeMilestone(world, npc, def, goal, isDone) {
        try {
            const stageName = isDone ? def.stages[def.stages.length - 1] : def.stages[goal.stage];
            let text = '';
            if (this.llm && this.llm._canMakeRequest(false) &&
                world.tickCount - (world.townFeed?._lastLlmPostTick || -9999) > 150) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const prompt = `${t('你在為小鎮社群「鎮民動態」寫一則貼文。')}
${t('發文者:')}${pN.name}${t('，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${t('他的人生夢想是「')}${def.name}${t('」,現在剛剛達成了一個階段:「')}${stageName}${t('」。')}${isDone ? t('這是他夢想的最終實現!') : ''}
${t('【格式】只寫一句貼文,表達此刻的心情與這個里程碑,口語、真摯、可加表情符號。繁體中文,不要有其他文字。')}`;
                    const response = await this.llm.generate(prompt, 120, 0.9, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                        if (world.townFeed) world.townFeed._lastLlmPostTick = world.tickCount;
                    }
                } catch (e) { console.error('[RimTown] life milestone LLM failed:', e); }
            }
            if (!text) {
                text = isDone
                    ? pickRandom([`${def.icon} ${t('我做到了!「')}${def.name}${t('」——這一路走來,值得了。')}`, `${def.icon} ${t('夢想成真的這一刻,我會記得一輩子。')}${stageName}!`])
                    : pickRandom([`${def.icon} ${t('離夢想又近了一步:')}${stageName}。${t('繼續加油!')}`, `${t('今天達成了「')}${stageName}${t('」,朝著')}${def.name}${t('前進中 💪')}`]);
            }
            npc.addThought(isDone ? 'dream_achieved' : 'dream_progress', world); // v5.15.0 夢想推進的喜悅
            if (world.townFeed) world.townFeed.addPost(world, npc, text);
            npc.memory.add(world.tickCount, world.clock.timeStr, 'milestone', `${t('人生里程碑:')}${stageName}(${def.name})`, isDone ? 10 : 7, []);
            world.logMessage('milestone', `${def.icon} ${npc.name}${t('的夢想「')}${def.name}${t('」邁入:')}${stageName}${isDone ? t('(達成!)') : ''}`, npc.name);
            if (world.dailyNews) world.dailyNews.collectEvent('milestone', `${npc.name}${isDone ? t('實現了畢生夢想「') : t('朝夢想邁進:「')}${isDone ? def.name : stageName}${t('」')}`, isDone ? 8 : 5, [npc.name]);
            if (isDone) {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 4; });
                world._pendingMilestones = world._pendingMilestones || [];
                world._pendingMilestones.push({ npcId: npc.agentId, npcName: npc.name, icon: def.icon, goalName: def.name, text });
            }
        } catch (e) { console.error('[RimTown] narrateLifeMilestone failed:', e); }
    }

    // v5.2.0: 鎮民動態發文 — AI 寫一則動態+朋友留言,或用模板
    async generateFeedPost(world, author, tryLlm) {
        try {
            if (!world.townFeed) return;
            let text = '', comments = [];
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && a.agentId !== author.agentId);
            // 挑留言者:一個朋友 + (可能)一個對頭
            const relOf = (x) => author.relationships.relationships[x.agentId];
            const friends = npcs.filter(x => (relOf(x)?.affinity || 0) > 20);
            const rivals = npcs.filter(x => (relOf(x)?.affinity || 0) < -15);
            const commenters = [];
            if (friends.length) commenters.push(pickRandom(friends));
            if (rivals.length && Math.random() < 0.5) commenters.push(pickRandom(rivals));
            else if (npcs.length && commenters.length < 2 && Math.random() < 0.6) commenters.push(pickRandom(npcs));

            if (tryLlm && this.llm && this.llm._canMakeRequest(false) &&
                world.tickCount - (world.townFeed._lastLlmPostTick || -9999) > 200) {
                try {
                    const pN = this._buildCharacterProfile(author);
                    const names = commenters.map(c => c.name);
                    const prompt = `${t('你在為小鎮社群「鎮民動態」寫貼文(像臉書/IG動態)。')}
${t('發文者:')}${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${pN.thought ? `${t('最近在想：')}${pN.thought}` : ''}
${t('現在在')}${author.currentLocation.replace(/_/g, ' ')}${t('，正在')}${author.activity}${t('。')}

${t('【格式】第一行寫貼文內容(1-2句,口語、有梗、可加表情符號)。')}
${names.length ? `${t('接著每行寫一則留言,格式「名字: 留言」,留言者依序是:')}${names.join(t('、'))}` : ''}
${t('繁體中文(台灣用語),不要有其他任何文字。')}`;
                    const response = await this.llm.generate(prompt, 250, 0.95, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        const lines = response.trim().split('\n').map(s => s.trim()).filter(Boolean);
                        if (lines.length) {
                            text = lines[0].replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${author.name}[：:]\\s*`), '').trim();
                            for (const l of lines.slice(1)) {
                                const idx = l.search(/[:：]/);
                                if (idx > 0 && idx <= 12) comments.push({ speaker: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() });
                            }
                            comments = comments.slice(0, 2);
                            world.townFeed._lastLlmPostTick = world.tickCount;
                        }
                    }
                } catch (e) { console.error('[RimTown] feed post LLM failed:', e); }
            }
            if (!text) {
                const mood = author.mood ?? 0;
                const partner = author.relationships.getPartner();
                const pool = [
                    `${t('今天的')}${author.currentLocation.includes('farm') ? t('田') : t('工作')}${t('也太累了吧...誰要請我喝一杯 🍺')}`,
                    `${t('剛剛在路上看到超好笑的事,笑到肚子痛 😂')}`,
                    t('天氣真好,適合偷懶(才怪,還有一堆活要幹)'),
                    t('突然好想吃烤魚。就這樣。'),
                    mood > 30 ? t('最近的日子真不錯,感恩 🙏') : t('唉,不想說話。懂的都懂。'),
                ];
                if (partner) pool.push(`${t('有個人在等我回家吃飯,幸福大概就是這樣 ❤️')}`);
                if (author.personality.traits.includes('gossip')) pool.push(t('我知道一個大八卦,但我就不說 🤐 問就是不說'));
                if (author.personality.traits.includes('lazy')) pool.push(t('今日進度:0。明天的我加油 💪'));
                text = pickRandom(pool);
                comments = commenters.slice(0, 2).map(c => {
                    const aff = relOf(c)?.affinity || 0;
                    const linesPool = aff < -15
                        ? [t('呵。'), t('有些人真的很閒。'), t('然後呢?')]
                        : [t('哈哈哈笑死'), t('+1!'), t('晚上老地方見?'), t('你還好嗎?抱抱'), t('這就是你摸魚的藉口?😏')];
                    return { speaker: c.name, text: pickRandom(linesPool) };
                });
            }
            world.townFeed.addPost(world, author, text, { comments });
        } catch (e) { console.error('[RimTown] generateFeedPost failed:', e); }
    }

    // v5.1.0: 名場面 — 為 NPC 感情大事件生成 4-6 句對話劇(LLM 或罐頭劇本)
    async generateDramaScene(world, kind, meta, a, b, thirdName) {
        try {
            let lines = [];
            if (this.llm && this.llm._canMakeRequest(false)) {
                try {
                    const pA = this._buildCharacterProfile(a);
                    const pB = this._buildCharacterProfile(b);
                    const sceneDesc = {
                        confession: `${a.name}${t('鼓起勇氣向')}${b.name}${t('告白,對方答應了,兩人正式在一起')}`,
                        wedding: `${a.name}${t('和')}${b.name}${t('的婚禮現場,兩人交換誓言,賓客起鬨')}`,
                        busted: `${a.name}${t('當場發現')}${b.name}${t('和')}${thirdName || t('某人')}${t('的秘密關係,情緒爆發對質')}`,
                        breakup: `${a.name}${t('和')}${b.name}${t('走到感情盡頭,決定分手')}`,
                        divorce: `${a.name}${t('和')}${b.name}${t('的婚姻破裂,攤牌離婚')}`,
                    }[kind];
                    const prompt = `${t('你是一位才華橫溢的小說家，正在為奇幻小鎮「邊境鎮」寫一場關鍵感情戲。')}
${t('場面：')}${sceneDesc}${t('。')}

${t('【')}${pA.name}${t('】')}${pA.age}${t('歲')}${pA.job}${t('，性格')}${pA.traits}
${t('【')}${pB.name}${t('】')}${pB.age}${t('歲')}${pB.job}${t('，性格')}${pB.traits}

${t('【規則】')}
${t('- 必須使用繁體中文（台灣用語），不可使用簡體中文')}
${t('- 寫4-6句有張力、有情緒的對話,像戲劇高潮的名場面')}
${t('- 每個人的說話風格要符合性格')}
${t('- 格式：每行「名字: 對話內容」,不要有其他任何東西')}`;
                    const response = await this.llm.generate(prompt, 500, 0.95, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        for (const raw of response.trim().split('\n')) {
                            const s = raw.trim();
                            if (!s || !s.includes(':') && !s.includes('：')) continue;
                            const idx = s.search(/[:：]/);
                            const speaker = s.slice(0, idx).replace(/\*/g, '').trim();
                            const text = s.slice(idx + 1).trim();
                            if (speaker && text && speaker.length <= 12) lines.push({ speaker, text });
                        }
                        lines = lines.slice(0, 6);
                    }
                } catch (e) { console.error('[RimTown] drama scene LLM failed:', e); }
            }
            if (lines.length < 2) {
                const FB = {
                    confession: [
                        { speaker: a.name, text: t('那個...我練習了好多次,還是好緊張。我喜歡你,很久了。') },
                        { speaker: b.name, text: t('笨蛋...我等這句話等好久了。') },
                        { speaker: a.name, text: t('所以...你願意跟我在一起嗎?') },
                        { speaker: b.name, text: t('願意啦!要說幾次你才聽得懂!') },
                    ],
                    wedding: [
                        { speaker: a.name, text: t('從今以後,不管豐收還是荒年,我都會在你身邊。') },
                        { speaker: b.name, text: t('說好了喔,一輩子。') },
                        { speaker: t('賓客'), text: t('親一個!親一個!') },
                    ],
                    busted: [
                        { speaker: a.name, text: `${t('你們兩個...在這裡做什麼?')}` },
                        { speaker: b.name, text: t('等等,你聽我解釋,不是你想的那樣——') },
                        { speaker: a.name, text: `${t('我都看到了!')}${thirdName || t('某人')}${t(',虧我還把你當朋友!')}` },
                        { speaker: b.name, text: t('對不起...是我對不起你。') },
                    ],
                    breakup: [
                        { speaker: a.name, text: t('我們...好像回不去了,對吧。') },
                        { speaker: b.name, text: t('嗯。與其這樣互相消磨,不如就到這裡吧。') },
                        { speaker: a.name, text: t('謝謝你陪我走過這一段。祝你幸福。') },
                    ],
                    divorce: [
                        { speaker: a.name, text: t('這些年,我們都累了。簽了吧。') },
                        { speaker: b.name, text: t('...好。至少我們曾經真心愛過。') },
                        { speaker: a.name, text: t('保重。') },
                    ],
                }[kind] || [];
                lines = FB;
            }
            if (!lines.length) return;
            const scene = { kind, icon: meta.icon, title: meta.title, aName: a.name, bName: b.name, lines };
            world._pendingDramaScenes = world._pendingDramaScenes || [];
            world._pendingDramaScenes.push(scene);
            // v5.21.0 小鎮劇場:名場面存進可回顧的檔案,加上時間戳
            world.dramaArchive = world.dramaArchive || [];
            world.dramaArchive.push({ ...scene, year: world.clock.year, season: world.clock.season, day: world.clock.day, tick: world.tickCount });
            if (world.dramaArchive.length > 40) world.dramaArchive = world.dramaArchive.slice(-40);
            // v5.2.0 大事件後當事人發鎮民動態
            if (world.townFeed) {
                const feedPools = {
                    confession: { who: b, texts: [t('今天是個好日子 💕'), t('原來被喜歡的人喜歡,是這種感覺。')] },
                    wedding: { who: a, texts: [t('我!結!婚!啦!🎉 感謝大家的祝福!'), t('執子之手,與子偕老。❤️')] },
                    busted: { who: a, texts: [t('識人不清,是我活該。'), t('有些人,不點名。祝你們幸福,呵。')] },
                    breakup: { who: a, texts: [t('恢復單身。別問,問就是不合適。'), t('刪掉了很多東西。包括回憶。')] },
                    divorce: { who: b, texts: [t('一段路走完了。往前看。'), t('簽完字,天還是藍的。挺好。')] },
                };
                const fp = feedPools[kind];
                if (fp) world.townFeed.addPost(world, fp.who, pickRandom(fp.texts));
            }
        } catch (e) { console.error('[RimTown] generateDramaScene failed:', e); }
    }

    // v5.0.0: 心動事件 — NPC 用 AI 生成專屬真心話,並排入互動卡等玩家回應
    async fireHeartEvent(world, npc, ev) {
        try {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (!player) return;
            const rel = npc.relationships.getOrCreate(player.agentId, player.name);
            let text = '';
            if (this.llm && this.llm._canMakeRequest(false)) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const mems = (rel.sharedMemories || []).slice(-3).join(t('；'));
                    const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。這是一個重要的感情時刻。')}
${t('情境：')}${ev.scenario}${t('。對象是')}${player.name}${t('。')}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。背景：')}${pN.background}${t('。')}
${mems ? `${t('你們的共同回憶：')}${mems}` : ''}

${t('【規則】')}
${t('- 繁體中文（台灣用語），2-4句，要真摯、有溫度，符合你的性格')}
${t('- 可以提到具體的共同回憶或小鎮生活細節')}
${t('- 不要加任何前綴、名字標籤、引號')}`;
                    const response = await this.llm.generate(prompt, 250, 0.9, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                        text = text.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    }
                } catch (e) { console.error('[RimTown] heart event LLM failed:', e); }
            }
            if (!text) {
                const fb = ev.romance ? [
                    t('那個...我最近發現,只要看到你走過來,我就會不自覺地笑。你...應該懂我的意思吧?'),
                    t('跟你說話的時候,時間總是過得特別快。我想...我大概是喜歡上你了。'),
                ] : [
                    `${t('欸,認真說,自從你來了之後,我覺得這個鎮都不一樣了。有你這個朋友真好。')}`,
                    `${t('我不太會說這種話,但...謝謝你一直願意聽我說話。這對我來說很重要。')}`,
                ];
                text = pickRandom(fb);
            }
            player.chatHistory.push({ speaker: npc.name, target: player.name, text, time: world.clock.timeStr });
            npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('我對')}${player.name}${t('說出了真心話：')}${text}`, 9, [player.name]);
            rel.addSharedMemory(`${ev.name}${t('：')}${text}`);
            world.logMessage('player_chat', `${ev.icon} ${npc.name} → ${player.name}: ${text}`, npc.name, player.name);
            if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
            world._pendingHeartEvents = world._pendingHeartEvents || [];
            world._pendingHeartEvents.push({ npcId: npc.agentId, npcName: npc.name, icon: ev.icon, evName: ev.name, text, romance: !!ev.romance });
        } catch (e) { console.error('[RimTown] fireHeartEvent failed:', e); }
    }

    // v4.9.0: 建築完工/組合發現時,挑一位相關 NPC 用 AI 對玩家發表評論
    async sendEventComment(world, eventText, preferJobs = [], preferIds = [], fallbackLines = null) {
        try {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (!player) return;
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead);
            if (!npcs.length) return;
            let pool = preferIds.length ? npcs.filter(a => preferIds.includes(a.agentId)) : [];
            if (!pool.length && preferJobs.length) pool = npcs.filter(a => preferJobs.includes(a.job?.key));
            if (!pool.length) pool = npcs;
            const npc = pool[Math.floor(Math.random() * pool.length)];
            let text = '';
            if (this.llm && this.llm._canMakeRequest(false)) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。剛剛發生了一件事：')}${eventText}${t('。你想傳一則訊息給鎮長')}${player.name}${t('聊聊這件事。')}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}

${t('【規則】')}
${t('- 繁體中文（台灣用語），1-2句就好，像傳LINE訊息那樣自然')}
${t('- 從你的職業和性格出發評論這件事（開心、期待、或吐槽都行）')}
${t('- 不要加任何前綴、名字標籤、引號')}`;
                    const response = await this.llm.generate(prompt, 150, 0.9, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                        text = text.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    }
                } catch (e) { console.error('[RimTown] sendEventComment LLM failed:', e); }
            }
            if (!text) {
                const fallbacks = fallbackLines || [
                    `${eventText}${t('，太棒了吧！')}`,
                    `${t('你看到了嗎？')}${eventText}${t('！鎮上越來越有樣子了')}`,
                    `${eventText}${t('！鎮長真有眼光')}`,
                ];
                text = pickRandom(fallbacks);
            }
            player.chatHistory.push({ speaker: npc.name, target: player.name, text, time: world.clock.timeStr });
            npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('跟')}${player.name}${t('聊到：')}${text}`, 3, [player.name]);
            world.logMessage('player_chat', `${npc.name} → ${player.name}: ${text}`, npc.name, player.name);
            if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
        } catch (e) { console.error('[RimTown] sendEventComment failed:', e); }
    }

    _buildCharacterProfile(agent) {
        const traitLabels = agent.personality.traits.map(t => TRAIT_POOL[t]?.label || t);
        const partner = agent.relationships.getPartner();
        let statusStr = t('單身');
        if (partner) {
            if (partner.status === 'married') statusStr = `${t('已與')}${partner.targetName}${t('結婚')}`;
            else if (partner.status === 'dating') statusStr = `${t('正在與')}${partner.targetName}${t('交往')}`;
        }
        const needsStr = [];
        if (agent.needs.hunger < 30) needsStr.push(t('肚子很餓'));
        if (agent.needs.rest < 30) needsStr.push(t('很疲倦'));
        if (agent.needs.social < 30) needsStr.push(t('渴望社交'));
        if (agent.needs.recreation < 20) needsStr.push(t('需要娛樂'));
        return {
            name: agent.name, age: agent.age,
            job: agent.job?.title || t('無業'),
            traits: traitLabels.join(t('、')),
            background: agent.personality.background || t('普通居民'),
            values: agent.personality.values.join(t('、')),
            mood: agent.moodLabel,
            status: statusStr,
            needs: needsStr.join(t('、')) || t('狀態良好'),
            thought: agent.currentThought || '',
            bestSkill: agent.skills.bestSkill.category,
        };
    }

    _buildRelContext(rel, otherName) {
        let s = `${t('與')}${otherName}${t('的關係：')}${rel.type}${t('（好感度')}${rel.affinity}`;
        if (rel.romanticInterest > 0) s += `${t('，浪漫')}${rel.romanticInterest}`;
        s += `${t('，互動')}${rel.interactionCount}${t('次）')}`;
        if (rel.status) s += `${t('【')}${rel.statusLabel}${t('】')}`;
        if (rel.isCheating) s += t('【秘密關係】');
        if (rel.sharedMemories.length) s += `\n${t('共同回憶：')}${rel.sharedMemories.slice(-3).join(t('；'))}`;
        return s;
    }

    _buildEconomicContext(world) {
        const parts = [];
        // Prosperity
        if (world.prosperity) {
            parts.push(`${t('繁榮度：')}${world.prosperity.prosperity}${t('（')}${world.prosperity.level}${t('）')}`);
        }
        // Town level & industries
        if (world.industry) {
            parts.push(`${t('城鎮等級：')}${world.industry.townLevelName || t('荒村')}`);
            const indNames = Object.keys(world.industry.industries).map(k => {
                const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[k] : null;
                const ind = world.industry.industries[k];
                return def ? `${def.icon}${def.name}Lv${ind.level}` : k;
            });
            if (indNames.length) parts.push(`${t('產業：')}${indNames.join(t('、'))}`);
        }
        // Farm highlights
        if (world.farm && world.farm.plots.length > 0) {
            const growing = world.farm.plots.filter(p => p.state === 'growing').length;
            const ready = world.farm.plots.filter(p => p.state === 'ready').length;
            if (growing || ready) parts.push(`${t('農場：')}${growing}${t('塊生長中')}${ready ? t('、')+ready+t('塊可收穫') : ''}`);
            const lastHarvest = world.farm.harvestLog.slice(-1)[0];
            if (lastHarvest) parts.push(`${t('最近收穫：')}${lastHarvest.cropName}×${lastHarvest.amount}`);
        }
        // Factory highlights
        if (world.processing) {
            const active = Object.entries(world.processing.builtFactories)
                .filter(([, f]) => f.status === 'active')
                .map(([k]) => { const d = typeof FACTORIES !== 'undefined' ? FACTORIES[k] : null; return d ? `${d.icon}${d.name}` : k; });
            if (active.length) parts.push(`${t('工廠：')}${active.join(t('、'))}`);
        }
        return parts.length ? parts.join(t('。')) : '';
    }

    _buildQuestContext(world, npc, relToPlayer) {
        if (!world.questSystem) return '';
        const parts = [];
        // Active quest context
        const questCtx = world.questSystem.getActiveQuestContext();
        if (questCtx) parts.push(questCtx);
        // Crisis context
        const crisisCtx = world.questSystem.getCrisisContext();
        if (crisisCtx) parts.push(`${t('【危機】')}${crisisCtx}`);
        // NPC-specific quest hints (only if affinity is high enough)
        const affinity = relToPlayer?.affinity || 0;
        const hints = world.questSystem.getQuestHintsForNPC(npc.agentId, affinity);
        if (hints.length > 0) {
            const hintText = hints.map(h => `${t('關於「')}${h.questTitle}${t('」，你可以自然地提到：')}${h.hint}`).join('\n');
            parts.push(`${t('【你可以給的提示（只在話題相關時自然帶出，不要硬塞）】')}\n${hintText}`);
        }
        // NPC personal quest hints (個人故事線)
        if (world.npcQuests) {
            const personalHints = world.npcQuests.getPersonalQuestHints(npc.agentId, affinity);
            if (personalHints.length > 0) {
                const personalText = personalHints.map(h => {
                    if (h.type === 'active') return `${t('你的心願：')}${h.hint}`;
                    if (h.type === 'tease') return `${t('（如果話題相關）')}${h.hint}`;
                    return `${t('你聽說：')}${h.hint}`;
                }).join('\n');
                parts.push(`${t('【個人心願】')}\n${personalText}`);
            }
        }
        if (parts.length === 0) return '';
        return '\n' + t('【任務相關】') + '\n' + parts.join('\n') + '\n';
    }

    async generateConversation(agentA, agentB, world) {
        const relA = agentA.relationships.getOrCreate(agentB.agentId, agentB.name);
        const relB = agentB.relationships.getOrCreate(agentA.agentId, agentA.name);

        if (this.llm) {
            // Throttle NPC LLM calls to avoid burning through API quota
            const ticksSinceLast = world.tickCount - this._lastNpcLlmTick;
            // v5.29.0 混合模式:只有玩家附近的對話用 LLM,且受每日額度限制;其餘走規則式(照樣寫入記憶流)
            if (ticksSinceLast >= this._npcLlmCooldownTicks && this._npcLlmAllowed(world, agentA, agentB) && this.llm._canMakeRequest(false)) {
                try {
                    this._lastNpcLlmTick = world.tickCount;
                    this._countNpcLlmUse(world);
                    return await this._llmConversation(agentA, agentB, world, relA, relB);
                } catch(e) { console.error('LLM conversation failed:', e); }
            }
        }
        return this._fallbackConversation(agentA, agentB, world, relA, relB);
    }

    async _llmConversation(agentA, agentB, world, relA, relB) {
        const gossip = world.events.getGossipTopics ? world.events.getGossipTopics() : [];
        const gossipStr = gossip.slice(-3).join(t('、')) || t('沒有特別的事');
        // v5.29.0 記憶流檢索:以對方+近況為焦點,撈出「該記得的事」(不只限於跟對方直接相關)
        const focalA = `${agentB.name} ${agentB.activity} ${agentB.currentLocation} ${gossipStr}`;
        const focalB = `${agentA.name} ${agentA.activity} ${agentA.currentLocation} ${gossipStr}`;
        const memA = agentA.memory.retrieve(focalA, [agentB.name], 4, world.tickCount);
        const memB = agentB.memory.retrieve(focalB, [agentA.name], 4, world.tickCount);
        const thoughtsA = agentA.memory.getThoughts(2);
        const thoughtsB = agentB.memory.getThoughts(2);
        const pA = this._buildCharacterProfile(agentA);
        const pB = this._buildCharacterProfile(agentB);

        // Pick a random conversation scenario to add variety
        const scenarios = [
            t('兩人剛好在路上遇到，隨意閒聊起來'),
            t('一個人正在忙，另一個人過來搭話'),
            t('兩人一起吃東西或喝茶時的聊天'),
            t('一個人看到另一個人心情不好，主動關心'),
            t('分享一個有趣的發現或八卦'),
            t('討論最近發生的事情或計劃'),
            t('回憶過去的某件事'),
            t('為了一件小事開玩笑或互相吐槽'),
        ];
        let scenario = pickRandom(scenarios);
        // v5.0.0 祭典期間:一半機率改用祭典場景,並注入祭典氣氛
        const fest = world.festivals?.activeFestival;
        if (fest && Math.random() < 0.5) {
            scenario = pickRandom([
                `${t('兩人在')}${fest.name}${t('會場遇到,聊起眼前的')}${pickRandom(fest.activities)}`,
                `${t('兩人一起參加')}${pickRandom(fest.activities)}${t(',邊玩邊聊')}`,
                `${t('祭典的熱鬧中,一人拉著另一人去看')}${pickRandom(fest.activities)}`,
            ]);
        }
        const festCtx = fest ? `${t('【今天是')}${fest.name}${t('!】')}${fest.description}${t('鎮上到處都是祭典活動:')}${fest.activities.join(t('、'))}${t('。對話請自然融入祭典氣氛。')}\n` : '';

        const prompt = `${t('你是一位才華橫溢的小說家，正在為奇幻小鎮「邊境鎮」寫角色對話劇本。')}
${t('這是兩位小鎮居民偶然碰面的場景。請寫出生動、自然、有溫度的對話——就像真實的鄰居閒聊一樣。')}

${t('【重要規則】')}
${t('- 必須使用繁體中文（台灣用語），不可使用簡體中文')}
${t('- 絕對不要讓角色報告自己的狀態（不要說「我好餓」「我好累」「我心情不好」這種話）')}
${t('- 對話要像真人——談論具體的事、講故事、開玩笑、分享感受、抱怨、八卦')}
${t('- 每個人的說話風格要明顯不同（用詞、語氣、句子長短都要有差異）')}
${t('- 加入生活細節：提到具體的食物、地點、天氣感受、小鎮裡的人和事')}
${t('- 可以有幽默、諷刺、調侃、撒嬌、關心、爭吵等豐富的情感表達')}

${festCtx}${t('場景：')}${scenario}
${t('時間：')}${world.clock.timeStr}
${t('地點：')}${agentA.currentLocation.replace(/_/g,' ')}

${t('【')}${pA.name}${t('】')}${pA.age}${t('歲')}${pA.job}${t('，性格')}${pA.traits}${t('，')}${pA.status}
${pA.thought ? `${t('最近在想：')}${pA.thought}` : ''}${pA.needs !== t('狀態良好') ? `${t('（有點')}${pA.needs}${t('）')}` : ''}
${this._buildRelContext(relA, agentB.name)}
${memA.length ? `${t('記得：')}${memA.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : ''}
${thoughtsA.length ? `${t('心裡的體悟：')}${thoughtsA.map(m=>m.content).join(t('；'))}` : ''}

${t('【')}${pB.name}${t('】')}${pB.age}${t('歲')}${pB.job}${t('，性格')}${pB.traits}${t('，')}${pB.status}
${pB.thought ? `${t('最近在想：')}${pB.thought}` : ''}${pB.needs !== t('狀態良好') ? `${t('（有點')}${pB.needs}${t('）')}` : ''}
${this._buildRelContext(relB, agentA.name)}
${memB.length ? `${t('記得：')}${memB.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : ''}
${thoughtsB.length ? `${t('心裡的體悟：')}${thoughtsB.map(m=>m.content).join(t('；'))}` : ''}
${t('如果「記得」的事跟話題有關，讓角色自然地提起或延續它——這是他們真實的共同過去。')}

${t('小鎮近況：')}${gossipStr}
${this._buildEconomicContext(world)}

${t('請寫4-6句自然對話。範例風格：')}
${t('- 好友："欸你昨天有看到老王在河邊釣到一條超大的魚嗎？笑死我了他差點掉下去！"')}
${t('- 害羞的人："嗯...那個...你今天做的麵包聞起來好香..."')}
${t('- 毒舌的人："又在偷懶？你那個田再不管，雜草都要比你高了。"')}
${t('- 情侶："你怎麼又沒穿外套？天都涼了...過來，把這個披上。"')}

${t('格式：每行「名字: 對話內容」')}
${t('最後一行：')}EFFECTS: {"affinity_change_a": ${t('數字')}(-3${t('到')}5), "affinity_change_b": ${t('數字')}(-3${t('到')}5), "romantic_change_a": ${t('數字')}(0${t('到')}5), "romantic_change_b": ${t('數字')}(0${t('到')}5), "summary": "${t('用一句生動的話總結發生了什麼')}", "memory_a": "${pA.name}${t('會記住的一句話（以他的視角與感受）')}", "memory_b": "${pB.name}${t('會記住的一句話（以他的視角與感受）')}", "plan_a": "${t('若對話中有約定或待辦,寫')}${pA.name}${t('的一句「接下來要…」備忘,否則空字串')}", "plan_b": "${t('同上,')}${pB.name}${t('的備忘或空字串')}"}
${t('提示：romantic_change 代表心動程度的變化。只有明確的曖昧、調情、深層情感連結才給 1-2。普通友好聊天應該給 0。大部分對話 romantic_change 應該是 0。')}`;

        const response = await this.llm.generate(prompt, 800);
        return this._parseConversation(response, agentA, agentB, world, relA, relB);
    }

    _parseConversation(response, agentA, agentB, world, relA, relB) {
        const lines = response.trim().split('\n');
        const dialogue = []; let effects = {};
        for (const line of lines) {
            const trimmed = line.trim(); if (!trimmed) continue;
            if (trimmed.startsWith('EFFECTS:')) {
                try {
                    const rest = lines.slice(lines.indexOf(line)).join('\n');
                    const js = rest.indexOf('{'), je = rest.lastIndexOf('}')+1;
                    if (js>=0 && je>js) effects = JSON.parse(rest.slice(js,je));
                } catch(e) {}
                break;
            } else if (trimmed.includes(':')) {
                const [speaker, ...textParts] = trimmed.split(':');
                const text = textParts.join(':').trim();
                if (speaker && text) dialogue.push({speaker: speaker.replace(/\*/g,'').trim(), text});
            }
        }
        // Apply personality compatibility multiplier to affinity gains
        const compat = Personality.compatibility(agentA.personality.traits, agentB.personality.traits);
        let affA = effects.affinity_change_a ?? randInt(-2,5);
        let affB = effects.affinity_change_b ?? randInt(-2,5);
        if (affA > 0) affA = Math.round(affA * compat);
        if (affB > 0) affB = Math.round(affB * compat);
        // Default romantic growth: only grow on strongly positive conversations
        const romA = effects.romantic_change_a ?? (affA >= 3 ? randInt(0,1) : 0);
        const romB = effects.romantic_change_b ?? (affB >= 3 ? randInt(0,1) : 0);
        const summary = effects.summary || `${agentA.name}${t('和')}${agentB.name}${t('聊了天。')}`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        // v5.29.0 主觀記憶回寫:LLM 為兩人各寫一句「他會記住的話」,沒有就退回客觀摘要
        const memTextA = (typeof effects.memory_a === 'string' && effects.memory_a.trim()) ? effects.memory_a.trim() : `${t('與')}${agentB.name}${t('交談：')}${summary}`;
        const memTextB = (typeof effects.memory_b === 'string' && effects.memory_b.trim()) ? effects.memory_b.trim() : `${t('與')}${agentA.name}${t('交談：')}${summary}`;
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', memTextA, Math.min(8,4+Math.abs(affA)+romA), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', memTextB, Math.min(8,4+Math.abs(affB)+romB), [agentA.name]);
        // v5.37.0 計畫思考(移植 generative_agents 對話後的 planning thought):
        // 對話裡的約定/待辦寫成 'plan' 記憶,隔天生成行程時會被撈出來——「星期三見」真的會出現在星期三
        if (typeof effects.plan_a === 'string' && effects.plan_a.trim()) {
            agentA.memory.add(world.tickCount, world.clock.timeStr, 'plan', effects.plan_a.trim(), 6, [agentB.name]);
        }
        if (typeof effects.plan_b === 'string' && effects.plan_b.trim()) {
            agentB.memory.add(world.tickCount, world.clock.timeStr, 'plan', effects.plan_b.trim(), 6, [agentA.name]);
        }
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        // Collect notable conversations for daily news
        if (world.dailyNews && (Math.abs(affA) >= 4 || Math.abs(affB) >= 4 || romA >= 2 || romB >= 2)) {
            world.dailyNews.collectEvent('social', summary, 4, [agentA.name, agentB.name]);
        }
        // Store NPC conversation for sidebar viewing
        if (dialogue.length) {
            this.npcConversationLog.push({ time:world.clock.timeStr, location:agentA.currentLocation, dialogue, summary, agentA:agentA.name, agentB:agentB.name, agentAId:agentA.agentId, agentBId:agentB.agentId, llm:true });
            if (this.npcConversationLog.length > 10000) this.npcConversationLog = this.npcConversationLog.slice(-10000);
            // Notify UI for map speech bubbles
            if (this.onConversation) {
                const textA = dialogue[0]?.text || summary;
                const textB = dialogue[1]?.text || '';
                this.onConversation(agentA.agentId, agentB.agentId, agentA.name, agentB.name, textA, textB);
            }
        }
        return { dialogue, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _fallbackConversation(agentA, agentB, world, relA, relB) {
        const dialogue = this._generatePersonalityDialogue(agentA, agentB, world, relA, relB);
        const compatFb = Personality.compatibility(agentA.personality.traits, agentB.personality.traits);
        let affA = dialogue._affA ?? randInt(-1,4);
        let affB = dialogue._affB ?? randInt(-1,4);
        if (affA > 0) affA = Math.round(affA * compatFb);
        if (affB > 0) affB = Math.round(affB * compatFb);
        const romA = dialogue._romA ?? 0;
        const romB = dialogue._romB ?? 0;
        const summary = dialogue._summary || `${agentA.name}${t('和')}${agentB.name}${t('聊了天。')}`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${agentB.name}${t('交談：')}${summary}`, Math.min(6,3+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${agentA.name}${t('交談：')}${summary}`, Math.min(6,3+Math.abs(affB)), [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        if (world.dailyNews && (Math.abs(affA) >= 4 || Math.abs(affB) >= 4)) {
            world.dailyNews.collectEvent('social', summary, 4, [agentA.name, agentB.name]);
        }
        const lines = dialogue.lines;
        if (lines.length) {
            this.npcConversationLog.push({ time:world.clock.timeStr, location:agentA.currentLocation, dialogue:lines, summary, agentA:agentA.name, agentB:agentB.name, agentAId:agentA.agentId, agentBId:agentB.agentId });
            if (this.npcConversationLog.length > 10000) this.npcConversationLog = this.npcConversationLog.slice(-10000);
            if (this.onConversation) {
                const textA = lines[0]?.text || summary;
                const textB = lines[1]?.text || '';
                this.onConversation(agentA.agentId, agentB.agentId, agentA.name, agentB.name, textA, textB);
            }
        }
        return { dialogue:lines, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _generatePersonalityDialogue(agentA, agentB, world, relA, relB) {
        const tA = agentA.personality.traits;
        const tB = agentB.personality.traits;
        const jobA = agentA.job?.title || t('無業');
        const jobB = agentB.job?.title || t('無業');
        const loc = agentA.currentLocation.replace(/_/g,' ');
        const timeOfDay = world.clock.timeOfDay;
        const season = world.clock.season;
        const lines = [];
        let affA = 0, affB = 0, romA = 0, romB = 0;
        let summary = '';

        // --- Rich detail pools for vivid dialogue ---
        const foods = { '春季':[t('野菜煎餅'),t('花瓣蜜茶'),t('春筍燉肉'),t('桂花糕'),t('薺菜餛飩')], '夏季':[t('冰鎮酸梅湯'),t('西瓜'),t('涼拌黃瓜'),t('綠豆湯'),t('荷葉飯')], '秋季':[t('烤地瓜'),t('桂花釀'),t('栗子燒雞'),t('蘋果派'),t('南瓜濃湯')], '冬季':[t('薑母茶'),t('熱騰騰的羊肉鍋'),t('烤紅薯'),t('熱奶酒'),t('麻辣火鍋')] };
        const scenery = { '春季':[t('櫻花飄落的小徑'),t('河邊盛開的野花'),t('清晨帶著露水的草地')], '夏季':[t('星空下的河流'),t('螢火蟲飛舞的夜晚'),t('午後蟬鳴的樹蔭下')], '秋季':[t('金黃落葉鋪滿的石板路'),t('楓紅染遍山頭的景色'),t('豐收後堆滿穀物的倉庫')], '冬季':[t('白雪覆蓋的屋頂'),t('壁爐旁搖曳的火光'),t('冬夜裡遠處傳來的狼嚎')] };
        const gifts = [t('一束剛採的野花'),t('自己做的手工餅乾'),t('一瓶私藏的好酒'),t('昨天釣到的魚做成的魚乾'),t('一條手織的圍巾'),t('用漂亮石頭做的小飾品')];
        const rumors = [`${t('聽說')}${pickRandom([t('雜貨店'),t('酒館'),t('鎮公所')])}${t('昨晚有人看到奇怪的光')}`,`${t('據說最近森林裡出現了')}${pickRandom([t('罕見的白鹿'),t('神秘的遺跡'),t('一群外來的旅人')])}`,`${t('有人說')}${pickRandom([t('河邊'),t('山洞'),t('舊礦坑')])}${t('藏著寶藏')}`,`${t('聽說隔壁的商隊帶來了')}${pickRandom([t('稀有香料'),t('遠方的書信'),t('神秘的藥草')])}`];
        const food = pickRandom(foods[season] || foods['春季']);
        const scene = pickRandom(scenery[season] || scenery['春季']);

        const isCouple = relA.status === 'dating' || relA.status === 'married';
        const isCrush = relA.romanticInterest > 50 || relB.romanticInterest > 50;
        const isRival = relA.affinity < -20 || relB.affinity < -20;
        const isCloseFriend = relA.affinity > 50 && relB.affinity > 50;
        const isStranger = relA.interactionCount < 3;

        const greetA = this._personalityGreeting(agentA, agentB, relA);
        const greetB = this._personalityGreeting(agentB, agentA, relB);

        if (isCouple) {
            const coupleTopics = [
                () => {
                    lines.push({speaker:agentA.name, text:`${t('你今天做的')}${food}${t('真的太好吃了，我到現在嘴裡還有那個味道！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`${t('真...真的嗎？其實我怕做得不夠好，特地多加了點')}${pickRandom([t('蜂蜜'),t('香料'),t('秘方')])}...`:`${t('那當然！這可是我花了一整個下午的心血，為了某個人。')}`});
                    lines.push({speaker:agentA.name, text:t('下次讓我也給你做一頓，雖然我的手藝可能會讓你後悔...')});
                    lines.push({speaker:agentB.name, text:tB.includes('romantic')?t('你做什麼我都喜歡，因為是你做的。'):t('哈哈，那我先準備好腸胃藥！')});
                    lines.push({speaker:agentA.name, text:t('你！過分！...不過我真的很幸福。')});
                    affA = randInt(3,6); affB = randInt(3,6); romA = randInt(2,4); romB = randInt(2,4);
                    summary = `${loc}${t('裡，')}${agentA.name}${t('讚美了')}${agentB.name}${t('親手做的')}${food}${t('，兩人甜蜜地打鬧著，笑聲讓路過的人都忍不住微笑。')}`;
                },
                () => {
                    const jealousA = tA.includes('jealous');
                    const jealousB = tB.includes('jealous');
                    if (jealousA || jealousB) {
                        const j = jealousA ? agentA : agentB;
                        const o = jealousA ? agentB : agentA;
                        lines.push({speaker:j.name, text:t('我剛剛看到你跟那個人聊了好久，你們在說什麼悄悄話？')});
                        lines.push({speaker:o.name, text:`${t('就是在討論')}${pickRandom([t('工作的事'),t('鎮上活動'),t('建材價格')])}${t('啊，你又胡思亂想了。')}`});
                        lines.push({speaker:j.name, text:t('...你笑得那麼開心，我在旁邊看著心裡很不是滋味。')});
                        lines.push({speaker:o.name, text:o.personality.traits.includes('kind')?t('傻瓜，我心裡只有你一個人啊。來，把手給我。'):t('你能不能信任我一點？每次都這樣我也很累的。')});
                        lines.push({speaker:j.name, text:t('...對不起。我就是太害怕失去你了。')});
                        affA = randInt(-1,2); affB = randInt(-1,2); romA = randInt(0,1); romB = randInt(0,1);
                        summary = `${j.name}${t('因為看到')}${o.name}${t('和別人說笑而醋意大發，兩人經歷了一場小風波，最終在')}${loc}${t('和好。')}`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${t(season)}${t('的夜晚真美...你看那邊，')}${scene}${t('。要不要一起去走走？')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('shy')?t('好...牽著我的手好嗎？'):t('走啊！我還想帶你去看一個秘密地點，保證你沒去過！')});
                        lines.push({speaker:agentA.name, text:t('和你在一起的時候，覺得這個小鎮是全世界最美的地方。')});
                        lines.push({speaker:agentB.name, text:t('笨蛋...突然說這種話，我都不知道該怎麼回了。')});
                        affA = randInt(3,5); affB = randInt(3,5); romA = randInt(2,4); romB = randInt(2,4);
                        summary = `${t(season)}${t('的')}${loc}${t('裡，')}${agentA.name}${t('和')}${agentB.name}${t('手牽手散步，分享著')}${scene}${t('的浪漫景色，氣氛溫馨而甜蜜。')}`;
                    }
                },
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，閉上眼睛，我有東西要給你！')}`});
                    lines.push({speaker:agentB.name, text:t('又在搞什麼鬼？...好啦好啦，閉上了。')});
                    lines.push({speaker:agentA.name, text:`${t('好了，睜開！噹噹——')}${gift}${t('！看到的時候就想到你了。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......謝謝。我會好好珍藏的。'):t('天啊！這也太可愛了吧！你怎麼知道我一直想要這個？！')});
                    affA = randInt(3,6); affB = randInt(4,7); romA = randInt(2,3); romB = randInt(2,4);
                    summary = `${agentA.name}${t('在')}${loc}${t('送了')}${agentB.name}${gift}${t('作為驚喜，')}${agentB.name}${tB.includes('stoic')?t('雖然表面平靜但眼眶微紅'):t('感動得差點飛撲上去')}${t('，兩人的感情更加深厚了。')}`;
                },
            ];
            pickRandom(coupleTopics)();
        } else if (isRival) {
            const hostileTemplates = [
                () => {
                    lines.push({speaker:agentA.name, text:`${t('哦？')}${agentB.name}${t('也在')}${loc}${t('啊，我還以為你早就被鎮上的人趕走了呢。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('abrasive')?t('你少在那邊冷嘲熱諷，有本事當面說清楚！'):t('......你講話可以再難聽一點，我都習慣了。')});
                    lines.push({speaker:agentA.name, text:`${t('別裝可憐了，你做過什麼你自己心裡清楚。上次')}${pickRandom([t('倉庫的事'),t('選舉那件事'),t('你在背後說的那些話')])}${t('，全鎮都知道。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('信不信由你。我問心無愧。'):t('你！——好，你記住今天說的話。遲早你會後悔的。')});
                    affA = randInt(-5,-2); affB = randInt(-5,-2);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('正面交鋒，針鋒相對的言語讓空氣彷彿凝結，周圍的居民紛紛側目。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${t('聽說你最近又在到處說我')}${pickRandom([t('壞話'),t('是非'),t('不是')])}${t('？有種當面說啊。')}`});
                    lines.push({speaker:agentB.name, text:`${t('我說的都是事實。你那個')}${jobA}${t('做成什麼樣子，大家有目共睹。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('neurotic')?t('你——！我在這個鎮上付出了多少你知道嗎！？'):t('笑話。等你做到我一半再來批評吧。')});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?t('好了，我不想在這種地方吵。但你最好反省一下自己。'):t('哼，走著瞧。')});
                    lines.push({speaker:agentA.name, text:t('你才該好好反省！')});
                    affA = randInt(-6,-3); affB = randInt(-6,-3);
                    summary = `${agentA.name}${t('當面質問')}${agentB.name}${t('散播流言蜚語的事，兩人在')}${loc}${t('爆發了激烈口角，怒氣沖天，場面一度失控。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，我們需要談談。不是為了吵架，是為了把話說開。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('......好吧。我也不想一直這樣下去。'):t('你覺得有什麼好談的？')});
                    lines.push({speaker:agentA.name, text:t('我知道我們之間有很多誤會，但至少在鎮上要做到基本的尊重，你說呢？')});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......我會考慮的。'):t('尊重是互相的。你先做到再來要求我。')});
                    affA = randInt(-2,1); affB = randInt(-2,1);
                    summary = `${agentA.name}${t('在')}${loc}${t('試圖與')}${agentB.name}${t('和解，但雙方仍帶著心結，氣氛雖有緩和卻依然充滿張力。')}`;
                },
            ];
            pickRandom(hostileTemplates)();
        } else if (isCrush) {
            const crushA = relA.romanticInterest > 50;
            const crushB = relB.romanticInterest > 50;
            const crushTopics = [
                () => {
                    lines.push({speaker:agentA.name, text: crushA ? `${agentB.name}${t('！你、你頭上有片落葉——我幫你拿掉！')}` : greetA});
                    lines.push({speaker:agentB.name, text: crushB ? t('啊，謝...謝謝...（心跳好快）你的手好溫暖。') : t('哦，謝謝你啊。')});
                    lines.push({speaker:agentA.name, text: crushA ? `${t('抱歉！我是不是太靠近了...不，我只是...你今天')}${pickRandom([t('聞起來好香'),t('看起來好好看'),t('笑容好好看')])}${t('。')}` : `${t('不客氣！')}${t(season)}${t('嘛，到處都是落葉。')}`});
                    if (crushB) lines.push({speaker:agentB.name, text:tB.includes('shy')?t('你...你也是...（聲音越來越小）'):`${t('哈哈，被你這麼一說我都不好意思了！那改天一起去喝杯')}${food}${t('好嗎？')}`});
                    romA = crushA ? randInt(3,6) : randInt(0,2); romB = crushB ? randInt(3,6) : randInt(0,2);
                    affA = randInt(2,5); affB = randInt(2,5);
                    const who = (crushA && crushB) ? t('兩人') : (crushA ? agentA.name : agentB.name);
                    summary = `${agentA.name}${t('幫')}${agentB.name}${t('拿掉頭上的落葉時兩人靠得很近，')}${who}${t('的臉頰微微泛紅，')}${loc}${t('的空氣中瀰漫著微妙的心動氣息。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你知道嗎？我昨晚看到了')}${scene}${t('，第一個想到的人就是你。')}`});
                    lines.push({speaker:agentB.name, text: crushB ? t('真的嗎...其實我也常常想著——啊不，我是說，那一定很美！') : t('哦？聽起來很美呢。')});
                    lines.push({speaker:agentA.name, text:t('下次一定要帶你去看。跟你在一起的時候，什麼風景都會更美。')});
                    lines.push({speaker:agentB.name, text: crushB ? t('...好。一定要說到做到哦。') : tB.includes('kind')?t('你真會說話！好啊，到時候再說。'):t('嗯...好啊。')});
                    romA = crushA ? randInt(2,5) : randInt(1,2); romB = crushB ? randInt(2,5) : randInt(1,2);
                    affA = randInt(2,5); affB = randInt(2,4);
                    summary = `${agentA.name}${t('在')}${loc}${t('和')}${agentB.name}${t('分享了')}${scene}${t('的美景，話語間暗藏著告白的勇氣，')}${agentB.name}${crushB?t('也悄悄地紅了耳朵'):t('禮貌地微笑回應')}${t('。')}`;
                },
            ];
            pickRandom(crushTopics)();
        } else if (isCloseFriend) {
            const friendTopics = [
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！你一定不相信我剛聽到什麼——')}${rumor}${t('！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('什麼！？快跟我說清楚！細節呢！？'):t('真的假的？你確定不是誰在胡說八道？')});
                    lines.push({speaker:agentA.name, text:`${t('千真萬確！好幾個人都這麼說。要不要找個時間一起去')}${pickRandom([t('看看'),t('調查'),t('確認')])}${t('？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('嗯...小心為上，但如果是真的就太刺激了！'):`${t('走啊！怕什麼！帶上')}${food}${t('我們來場冒險！')}`});
                    affA = randInt(3,5); affB = randInt(3,5);
                    summary = `${agentA.name}${t('興沖沖地在')}${loc}${t('和摯友')}${agentB.name}${t('分享了一個驚天八卦，兩人越聊越起勁，甚至約好了一起去探個究竟，氣氛既神秘又興奮。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${t('唉...')}${agentB.name}${t('，你能不能幫我出出主意？最近')}${pickRandom([`${jobA}${t('的工作壓力大到快喘不過氣')}`,t('跟隔壁的鄰居鬧了點不愉快'),t('一直在做同一個奇怪的夢')])}...`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`${t('怎麼了？慢慢說，我聽著呢。先喝口')}${food}${t('暖暖。')}`:`${t('又怎麼了？你最近也太多煩惱了吧——不過說吧，反正你也憋不住。')}`});
                    lines.push({speaker:agentA.name, text:t('你真的是全鎮最了解我的人...每次跟你聊完心裡就踏實多了。')});
                    lines.push({speaker:agentB.name, text:`${t('別肉麻了！不過...有你當朋友我也很慶幸啦。來，我請你吃')}${pickRandom([t('剛烤好的麵包'),t('酒館的招牌菜'),t('剛摘的水果')])}${t('。')}`});
                    affA = randInt(3,6); affB = randInt(3,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('向摯友')}${agentB.name}${t('傾訴了最近的煩惱，')}${agentB.name}${t('耐心傾聽並貼心地準備了')}${food}${t('，兩人之間的友誼更加堅定了。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，還記得我們剛來邊境鎮那天嗎？什麼都沒有，就兩個人站在空蕩蕩的廣場上。')}`});
                    lines.push({speaker:agentB.name, text:t('記得啊！那時候你還摔了一跤，臉都栽進泥巴裡哈哈哈哈！')});
                    lines.push({speaker:agentA.name, text:t('你就記這個！？那你還不是迷路了三次才找到酒館！')});
                    lines.push({speaker:agentB.name, text:t('好了好了，我們扯平。不過認真的...能跟你一起在這裡打拼，我覺得這輩子值了。')});
                    lines.push({speaker:agentA.name, text:t('...你今天不準再說催淚的話了，我眼眶已經紅了。')});
                    affA = randInt(4,7); affB = randInt(4,7);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('回憶起初來邊境鎮的趣事，笑淚交織之間，深厚的友情讓旁人都為之動容。')}`;
                },
            ];
            pickRandom(friendTopics)();
        } else if (isStranger) {
            const strangerTopics = [
                () => {
                    lines.push({speaker:agentA.name, text:tA.includes('charismatic')?`${t('嘿！你是新面孔吧？我是')}${agentA.name}${t('，在這邊做')}${jobA}${t('的。歡迎來到邊境鎮！')}`:`${t('你好...我好像沒見過你？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`${t('嗯...我是')}${agentB.name}...${t('你好。這裡的')}${food}${t('看起來好好吃...')}`:`${t('哈囉！我叫')}${agentB.name}${t('！剛到這邊不久，請多指教！這裡比我想像中熱鬧多了。')}`});
                    lines.push({speaker:agentA.name, text:`${loc}${t('是鎮上最')}${pickRandom([t('熱鬧'),t('有意思'),t('舒服')])}${t('的地方！對了，如果你想吃好料的，推薦你去試試酒館的')}${food}${t('，絕對不會後悔。')}`});
                    lines.push({speaker:agentB.name, text:`${t('真的嗎！那我一定要去試試。謝謝你，')}${agentA.name}${t('！')}`});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('熱情地招呼了新來的')}${agentB.name}${t('，推薦了鎮上的美食')}${food}${t('，給')}${agentB.name}${t('留下了溫暖的第一印象。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('對吧？我聽說你是做')}${jobB}${t('的——正好，我一直想認識做這行的人！')}`});
                    lines.push({speaker:agentB.name, text:`${t('你認識我？啊，果然小鎮消息傳得快...對，我是')}${jobB}${t('。你是')}${agentA.name}${t('？')}`});
                    lines.push({speaker:agentA.name, text:`${t('哈哈，邊境鎮就是這樣，新人來的消息半天就全鎮都知道了。改天聊聊')}${pickRandom([t('工作心得'),t('鎮上的事'),t('生活經驗')])}${t('吧？')}`});
                    lines.push({speaker:agentB.name, text:t('好啊！期待跟你多認識。')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('初次交談，兩人相談甚歡，約好了改天再深入聊聊，邊境鎮又多了一段新的緣分。')}`;
                },
                // v5.13.0 更多樣的初次見面:尷尬的、八卦的、被東西吸引的、毒舌的、一見如故的
                () => { // 尷尬撞見
                    lines.push({speaker:agentA.name, text:tA.includes('shy')?t('啊,抱歉!我不是故意擋路的...'):t('喔喔,不好意思,差點撞到你。')});
                    lines.push({speaker:agentB.name, text:`${t('沒事沒事,是我在發呆。你是...')}${agentA.name}${t('?我常在')}${loc}${t('看到你。')}`});
                    lines.push({speaker:agentA.name, text:t('對啊,我幾乎天天來這。你也是這一帶的人?')});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?t('嗯...算是吧。那個...改天見。'):t('是啊,以後常會碰到,多多關照囉!')});
                    affA = randInt(1,3); affB = randInt(1,3);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('不小心撞在一起,尷尬又好笑地認識了彼此。')}`;
                },
                () => { // 被八卦拉近
                    const r = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${t('欸,你有沒有聽說?')}${r}${t('!')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('什麼!快跟我說詳細的!我最愛聽這種了!'):t('咦?我還真沒聽過,你消息真靈通。')});
                    lines.push({speaker:agentA.name, text:t('哈哈,我就是喜歡到處打聽。對了,我還沒問你叫什麼名字呢?')});
                    lines.push({speaker:agentB.name, text:`${t('我是')}${agentB.name}${t('。看來以後鎮上有什麼風吹草動,找你就對了!')}`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('用一則八卦成功勾起')}${agentB.name}${t('的興趣,兩人在')}${loc}${t('越聊越起勁。')}`;
                },
                () => { // 被手上的東西吸引
                    const item = pickRandom(gifts);
                    lines.push({speaker:agentB.name, text:`${t('欸,你手上那個是')}${item}${t('嗎?看起來好特別。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('creative')?t('對啊!我自己弄的,還在研究怎麼做得更好。你有興趣?'):t('喔這個啊,隨手弄的。你喜歡的話...改天送你一個?')});
                    lines.push({speaker:agentB.name, text:t('真的可以嗎!那我就不客氣了。我還不知道你名字呢。')});
                    lines.push({speaker:agentA.name, text:`${t('我叫')}${agentA.name}${t('。以後想要就來找我,別客氣。')}`});
                    affA = randInt(2,4); affB = randInt(3,5);
                    summary = `${agentB.name}${t('被')}${agentA.name}${t('手上的')}${item}${t('吸引,兩人就這麼聊開了,約好改天再見。')}`;
                },
                () => { // 毒舌/慢熱的初遇
                    const grump = tA.includes('abrasive') || tA.includes('pessimist') ? agentA : (tB.includes('abrasive') || tB.includes('pessimist') ? agentB : agentA);
                    const other = grump === agentA ? agentB : agentA;
                    lines.push({speaker:grump.name, text:t('新來的?這鎮上沒什麼好的,別抱太大期望。')});
                    lines.push({speaker:other.name, text:tB.includes('optimist')||tA.includes('optimist')?t('哈哈,你這人真直接!不過我倒覺得這裡挺有意思的。'):t('喔...好吧,謝謝提醒。')});
                    lines.push({speaker:grump.name, text:`${t('...算了,你要真遇到麻煩,來找我。我叫')}${grump.name}${t('。')}`});
                    lines.push({speaker:other.name, text:t('嘴硬心軟嘛,我懂。多謝啦!')});
                    affA = randInt(0,3); affB = randInt(0,3);
                    summary = `${grump.name}${t('嘴上潑冷水,卻還是對新認識的')}${other.name}${t('伸出了援手,反差讓人莞爾。')}`;
                },
                () => { // 一見如故
                    lines.push({speaker:agentA.name, text:`${t('奇怪,我總覺得跟你特別聊得來,明明才剛認識。')}`});
                    lines.push({speaker:agentB.name, text:t('我也有這種感覺!是不是上輩子就認識了哈哈。')});
                    lines.push({speaker:agentA.name, text:`${t('那以後要常一起')}${pickRandom([t('喝一杯'),t('散步'),t('看星星'),t('吃飯')])}${t('啊!')}`});
                    lines.push({speaker:agentB.name, text:t('一言為定!能認識你真好。')});
                    affA = randInt(3,6); affB = randInt(3,6);
                    if (Personality.compatibility(tA, tB) > 1) { romA = randInt(0,2); romB = randInt(0,2); }
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('一見如故,相談甚歡,彷彿認識了很久的老友。')}`;
                },
            ];
            pickRandom(strangerTopics)();
        } else {
            // --- Normal acquaintance conversation — vivid and story-driven ---
            const normalTopics = [
                // Sharing discoveries
                () => {
                    const discovery = pickRandom([
                        `${t('你知道嗎？我昨天在河邊發現了一種從沒見過的')}${pickRandom([t('發光的石頭'),t('藍色的蘑菇'),t('奇怪的腳印')])}`,
                        `${t('我昨晚在')}${pickRandom([t('圖書館'),t('禮拜堂'),t('山丘上')])}${t('看到了')}${pickRandom([t('神秘的光'),t('一隻從沒見過的鳥'),t('天上有兩個月亮')])}`,
                        `${t('今天早上我去')}${pickRandom([t('井邊打水'),t('田裡幹活'),t('林子裡散步')])}${t('的時候，聽到了')}${pickRandom([t('很美的歌聲'),t('奇怪的低語'),t('遠方傳來的鐘聲')])}`,
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！')}${discovery}${t('！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('creative')?t('什麼！？太神奇了！你帶我去看好不好！'):t('真的假的？該不會是你看花眼了吧？')});
                    lines.push({speaker:agentA.name, text:t('我騙你幹嘛！千真萬確，下次遇到我馬上叫你！')});
                    lines.push({speaker:agentB.name, text:tB.includes('pessimist')?t('好吧好吧...不過要是什麼危險的東西你可要負責。'):`${t('一言為定！記得帶上')}${food}${t('，探險可不能餓肚子！')}`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('興奮地和')}${agentB.name}${t('分享了一個神奇的發現，兩人在')}${loc}${t('聊得眉飛色舞，約好下次一起去探索。')}`;
                },
                // Season + food + life detail
                () => {
                    lines.push({speaker:agentA.name, text:`${t(season)}${t('最棒的就是')}${food}${t('了！我剛從酒館帶了一份，要不要嚐嚐？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('哇！好香！你也太貼心了吧——等等，你該不會有什麼事要拜託我？'):`${t('還行吧，不過我比較想吃')}${pickRandom(foods[season]||foods['春季'])}${t('。')}`});
                    lines.push({speaker:agentA.name, text:`${t('被你看穿了！其實是想問你')}${pickRandom([t('鎮上最近有什麼新鮮事'),t('知不知道哪裡可以買到好木材'),t('有沒有認識會修屋頂的人')])}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?t('哈哈！先吃東西再說正事！來來來，坐下聊。'):t('嗯...讓我想想，我好像聽說過一些消息。')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('帶了')}${food}${t('到')}${loc}${t('和')}${agentB.name}${t('邊吃邊聊，')}${t(season)}${t('的暖意讓兩人的對話格外愜意。')}`;
                },
                // Work + dramatic story
                () => {
                    const workStory = pickRandom([
                        {a:`${t('你不知道！今天')}${jobA}${t('的時候差點出大事——')}${pickRandom([t('一塊巨石突然滾下來'),t('工具斷了差點傷到人'),t('發現了一條密道')])}${t('！')}`, sum:t('分享了工作中驚險的一幕')},
                        {a:`${t('告訴你一個祕密，')}${pickRandom([t('倉庫裡藏了一批沒人知道的好東西'),t('鎮公所的地下室好像有奇怪的聲音'),t('雜貨店老闆其實以前是個冒險家')])}${t('！')}`, sum:t('悄悄透露了鎮上的一個祕密')},
                        {a:`${t('我今天在')}${pickRandom([t('工作的時候'),t('路上'),t('吃飯的時候')])}${t('碰到一件超搞笑的事——')}${pickRandom([t('有人把一桶水潑在鎮長身上'),t('一隻雞追著守衛跑了三圈'),t('有個旅人居然帶了一頭熊進酒館')])}${t('！')}`, sum:t('分享了一件讓人笑到肚子痛的趣事')},
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！')}${workStory.a}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('不會吧！？然後呢然後呢！？快說！'):t('哈哈哈你認真的嗎！？這也太誇張了！')});
                    lines.push({speaker:agentA.name, text:t('我發誓是真的！當場所有人都傻眼了！')});
                    lines.push({speaker:agentB.name, text:t('這件事我要跟全鎮的人說！太精彩了！')});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('向')}${agentB.name}${workStory.sum}${t('，兩人笑得前仰後合，')}${loc}${t('裡充滿了歡樂的氣氛。')}`;
                },
                // Gift giving
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`${t('對了')}${agentB.name}${t('，這個給你——')}${gift}${t('，上次你幫了我大忙，一直想謝謝你。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?t('欸...這也太...我只是舉手之勞啊，你不用這麼客氣的...'):t('你也太有心了吧！我只是做了該做的事而已！不過...我超喜歡的，謝謝！')});
                    lines.push({speaker:agentA.name, text:t('喜歡就好！以後有什麼需要幫忙的儘管開口。')});
                    lines.push({speaker:agentB.name, text:t('一定！你也是！...今天真的心情變好了。')});
                    affA = randInt(3,5); affB = randInt(4,6);
                    summary = `${agentA.name}${t('在')}${loc}${t('送了')}${agentB.name}${gift}${t('作為感謝，')}${agentB.name}${t('感動之餘兩人的友誼又更進了一步，')}${t(season)}${t('的空氣裡充滿了溫暖。')}`;
                },
                // Rumors and gossip
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${t('嘿')}${agentB.name}${t('，你有聽說嗎？')}${rumor}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('真的！？我的天，這也太刺激了！你從哪裡聯來的？'):t('嗯？聽起來不太靠譜...不過如果是真的就有意思了。')});
                    lines.push({speaker:agentA.name, text:`${t('好幾個人都這麼說呢！而且昨天夜裡好像真的有人看到')}${pickRandom([t('可疑的影子'),t('奇怪的燈火'),t('一群穿斗篷的人')])}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('嗯...希望不是什麼壞事。不過有你一起我就安心多了。'):t('哼，我倒要看看到底是怎麼回事。明天一起去打聽！')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('低聲討論著鎮上的神秘傳聞，越聊越覺得事情不簡單，兩人的表情既好奇又緊張。')}`;
                },
                // Mood-driven dramatic scene
                () => {
                    if (agentA.mood < 20) {
                        lines.push({speaker:agentB.name, text:`${agentA.name}...${t('你怎麼一個人坐在')}${loc}${t('發呆？你的眼眶是不是紅紅的...')}`});
                        lines.push({speaker:agentA.name, text:tA.includes('stoic')?t('...我沒事。只是在想一些事情。'):t('...最近什麼事都不順利，我有時候在想，我來邊境鎮到底對不對。')});
                        lines.push({speaker:agentB.name, text:tB.includes('kind')?`${t('你聽我說——你是這個鎮上不可或缺的人。我們都需要你。來，先喝口')}${food}${t('暖暖身子。')}`:`${t('你少來了，沒有你誰來做')}${jobA}${t('？鎮上離了你可不行。')}`});
                        lines.push({speaker:agentA.name, text:`${t('......謝謝你，')}${agentB.name}${t('。有你在真好。')}`});
                        affA = randInt(3,6); affB = randInt(2,4);
                        summary = `${agentB.name}${t('在')}${loc}${t('發現了獨自落寞的')}${agentA.name}${t('，溫柔地遞上一杯')}${food}${t('，用真摯的話語驅散了陰霾，')}${agentA.name}${t('眼眶泛紅地笑了。')}`;
                    } else if (agentA.mood > 70) {
                        lines.push({speaker:agentA.name, text:`${agentB.name}${t('！你猜怎麼著！今天是我這輩子最好的一天——')}${pickRandom([t('工作順利到不可思議'),t('發現了一個超棒的地方'),t('有人跟我說了一句讓我開心到飛起來的話')])}${t('！')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('pessimist')?t('你也太浮誇了...不過看你這麼開心我也忍不住笑了。'):`${t('太好了！快跟我說！今天我請你喝')}${food}${t('慶祝！')}`});
                        lines.push({speaker:agentA.name, text:`${t('我現在覺得什麼困難都打不倒我！連')}${t(season)}${t('的天氣都特別配合！')}`});
                        lines.push({speaker:agentB.name, text:t('哈哈哈，你也太誇張了！不過...你開心我也開心，畢竟你笑起來真的很有感染力。')});
                        affA = randInt(2,5); affB = randInt(2,5);
                        summary = `${t('心情大好的')}${agentA.name}${t('在')}${loc}${t('拉著')}${agentB.name}${t('分享喜悅，開懷大笑的聲音感染了整個')}${loc}${t('，連路過的人都忍不住嘴角上揚。')}`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你有沒有想過...如果當初沒來邊境鎮，現在會在哪裡？')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('creative')?`${t('我有時候會想呢。也許在某個大城市裡迷失方向吧...但這裡有')}${scene}${t('，有你們這些朋友，我不後悔。')}`:`${t('想那麼多幹嘛？現在過得不錯就好了。走，去弄點')}${food}${t('來吃。')}`});
                        lines.push({speaker:agentA.name, text:t('說得也是。有時候覺得命運把我們送到這裡，一定有它的道理。')});
                        lines.push({speaker:agentB.name, text:`${t('少在那邊感慨了！')}${food}${t('可不等人，走走走！')}`});
                        affA = randInt(2,4); affB = randInt(2,4);
                        summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('感慨起命運的安排，聊起了')}${scene}${t('的美好，最後被')}${food}${t('的香氣拉回了現實，氣氛輕鬆溫馨。')}`;
                    }
                },
            ];
            pickRandom(normalTopics)();

            if (Math.random() < 0.12) {
                this._addConflictEscalation(lines, agentA, agentB, world, tA, tB);
                affA = Math.min(affA, randInt(-4, -1));
                affB = Math.min(affB, randInt(-4, -1));
                summary += t('但後來氣氛突然變得微妙，兩人不歡而散。');
            }
        }

        // Romantic sparks — only when affinity is already decent
        if (!isCouple && !isRival && affA >= 3 && affB >= 3 && relA.affinity > 20 && relB.affinity > 20) {
            const hasRomanticTrait = tA.includes('romantic') || tB.includes('romantic');
            const hasChemistry = (tA.includes('shy') && tB.includes('charismatic')) ||
                                 (tB.includes('shy') && tA.includes('charismatic')) ||
                                 (tA.includes('creative') && tB.includes('creative'));
            const sparkChance = hasRomanticTrait ? 0.3 : hasChemistry ? 0.2 : 0.1;
            if (Math.random() < sparkChance) {
                const spark = randInt(1, hasRomanticTrait ? 3 : hasChemistry ? 2 : 2);
                romA += spark; romB += Math.max(0, spark - randInt(0,1));
            }
        }

        return { lines, _affA:affA, _affB:affB, _romA:romA, _romB:romB, _summary:summary };
    }

    _personalityGreeting(agent, other, rel) {
        const tr = agent.personality.traits;
        const name = other.name;
        if (rel.status === 'dating' || rel.status === 'married') return pickRandom([`${t('親愛的')}${name}${t('。')}`,`${name}~`,`${t('嘿，')}${name}${t('。')}`]);
        if (tr.includes('charismatic')) return pickRandom([`${t('嘿！')}${name}${t('！')}`,`${t('哈囉')}${name}${t('，真高興見到你！')}`,`${name}${t('！好久不見！')}`]);
        if (tr.includes('shy')) return pickRandom([`${t('啊...')}${name}...${t('你好。')}`,t('嗯...你好。'),t('...嗨。')]);
        if (tr.includes('abrasive')) return pickRandom([`${t('喔，')}${name}${t('啊。')}`,t('怎麼又是你。'),`${name}${t('。')}`]);
        if (tr.includes('optimist')) return pickRandom([`${name}${t('！今天也是美好的一天！')}`,`${t('嗨')}${name}${t('，你看起來很有精神！')}`]);
        if (tr.includes('pessimist')) return pickRandom([`${name}...${t('唉。')}`,`${t('嗯...')}${name}${t('。')}`]);
        return pickRandom([`${t('嘿，')}${name}${t('。')}`,`${t('你好啊，')}${name}${t('。')}`,`${t('哈囉，')}${name}${t('！')}`,`${name}${t('，好久不見。')}`]);
    }

    _addConflictEscalation(lines, agentA, agentB, world, tA, tB) {
        const conflictTypes = [
            // Bad joke that offends
            () => {
                const jokes = [
                    `${t('哈哈，你知道嗎，你做的')}${agentB.job?.title||t('事')}${t('讓我想到一個笑話——')}`,
                    t('說真的，你那個表情也太好笑了吧？'),
                    `${t('你是不是又')}${pickRandom([t('偷懶'),t('搞砸'),t('遲到')])}${t('了？我開玩笑的啦。')}`,
                ];
                lines.push({speaker:agentA.name, text:pickRandom(jokes)});
                lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......這一點都不好笑。'):tB.includes('neurotic')?t('你這什麼意思！？'):t('呵，你覺得很幽默嗎？')});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?t('抱歉抱歉，我不是那個意思...'):t('開不起玩笑啊？')});
            },
            // Value clash
            () => {
                const vA = agentA.personality.values[0] || '自由';
                const vB = agentB.personality.values[0] || '秩序';
                if (vA !== vB) {
                    lines.push({speaker:agentA.name, text:`${t('我覺得')}${vA}${t('才是最重要的，你不覺得嗎？')}`});
                    lines.push({speaker:agentB.name, text:`${t('我倒覺得')}${vB}${t('比較重要。你那種想法太天真了。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('stoic')?t('看法不同而已。'):t('哼，你不懂。')});
                } else {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你最近做的那件事，我覺得不太好。')}`});
                    lines.push({speaker:agentB.name, text:t('你管太多了吧？')});
                }
            },
            // Passive-aggressive remark
            () => {
                const remarks = [
                    `${t('嗯...')}${agentB.name}${t('你最近是不是胖了？')}`,
                    t('有些人啊，就是不知道自己幾斤幾兩。'),
                    t('哦對了，上次的事你還記得吧？算了，不提了。'),
                    t('我不是在說你啦，不過有人最近做事真的很馬虎。'),
                ];
                lines.push({speaker:agentA.name, text:pickRandom(remarks)});
                lines.push({speaker:agentB.name, text:tB.includes('abrasive')?t('你在暗示什麼？有話直說！'):tB.includes('shy')?'......':tB.includes('neurotic')?t('你是不是在說我！？'):t('...你今天怎麼了？')});
            },
            // Gossip about the other behind their back gets revealed
            () => {
                lines.push({speaker:agentB.name, text:`${agentA.name}${t('，我聽說你跟別人說我')}${pickRandom([t('壞話'),t('是非'),t('閒話')])}${t('？')}`});
                lines.push({speaker:agentA.name, text:tA.includes('gossip')?t('啊...那個...不是你想的那樣。'):tA.includes('abrasive')?t('我說的都是事實。'):t('什麼？我沒有啊！')});
                lines.push({speaker:agentB.name, text:tB.includes('kind')?t('我希望以後別這樣了。'):t('我會記住的。')});
            },
            // Annoying behavior
            () => {
                const annoyances = [
                    {act:t('一直不停地說話'), resp:t('你能不能安靜一會兒...')},
                    {act:t('吃東西的聲音超大'), resp:t('拜託，能不能注意一下？')},
                    {act:t('不請自來地給建議'), resp:t('我沒有問你的意見。')},
                    {act:`${t('打斷')}${agentB.name}${t('說話')}`, resp:t('你能讓我把話說完嗎！？')},
                ];
                const a = pickRandom(annoyances);
                lines.push({speaker:agentA.name, text:tA.includes('charismatic')?t('對了對了，我跟你說——'):t('嗯，我覺得你應該——')});
                lines.push({speaker:agentB.name, text:a.resp});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?t('...對不起。'):t('切，好心沒好報。')});
            },
        ];
        pickRandom(conflictTypes)();
    }

    async generatePlayerReply(player, npc, playerMessage, world) {
        const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
        const relPlayer = player.relationships.getOrCreate(npc.agentId, npc.name);

        if (this.llm) {
            console.log('[RimTown] Using LLM for player chat with', npc.name, '| provider:', this.llm.provider);
            try {
                const recentChat = player.chatHistory.filter(c => c.target === npc.name || c.speaker === npc.name)
                    .slice(-10).map(c => `${c.speaker}: ${c.text}`).join('\n');
                // v5.29.0 記憶流檢索:以玩家這句話為焦點,撈出最相關的記憶(而非只看最近 5 則)
                const memNpc = npc.memory.retrieve(`${player.name} ${playerMessage}`, [player.name], 5, world.tickCount);
                const npcThoughts = npc.memory.getThoughts(2);
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的一位真實居民。有個叫')}${player.name}${t('的人正在跟你說話。')}
${t('你要完全入戲，像真人一樣自然地回應。')}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。')}
${t('性格：')}${pN.traits}${t('。背景：')}${pN.background}${t('。')}
${t('在意的事：')}${pN.values}${t('。感情狀態：')}${pN.status}${t('。')}
${pN.thought ? `${t('你最近在想：')}${pN.thought}` : ''}
${this._buildRelContext(relNpc, player.name)}
${memNpc.length ? `${t('你記得的事（跟話題相關就自然提起）：')}${memNpc.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : `${t('你跟')}${player.name}${t('還不太熟。')}`}
${npcThoughts.length ? `${t('你心裡的體悟：')}${npcThoughts.map(m=>m.content).join(t('；'))}` : ''}

${world.festivals?.activeFestival ? `${t('【今天是')}${world.festivals.activeFestival.name}${t('!】')}${world.festivals.activeFestival.description}${t('聊天時可以自然提到祭典。')}` : ''}
${t('【小鎮經濟】')}
${this._buildEconomicContext(world)}
${this._buildQuestContext(world, npc, relNpc)}
${t('【對話記錄】')}
${recentChat || t('（剛開始聊）')}
${player.name}: ${playerMessage}

${t('【回覆規則】')}
${t('- 必須使用繁體中文（台灣用語），不可使用簡體中文。1-3句話')}
${t('- 像真人說話，不要文縐縐的。可以用語助詞（啊、啦、嘛、欸、喔、哈）')}
${t('- 根據你的性格回應：')}${pN.traits.includes(t('害羞')) ? t('你會說話結巴、簡短') : pN.traits.includes(t('健談')) ? t('你很愛聊天，會主動延伸話題') : pN.traits.includes(t('刻薄')) ? t('你說話帶刺但可能是關心的方式') : t('用你自己的方式說話')}
${t('- 不要直接說「我很累」「我心情不好」這種報告式的話。如果你累了，可能會打哈欠或說「唉今天腰都快斷了」')}
${t('- 對話要有來有往——回應對方說的話，也可以反問或岔開新話題')}
${t('- 如果聊到你在意的事（')}${pN.values}${t('），你會特別有感觸')}

${t('【輸出格式】嚴格遵守！')}
${t('- 第一行開始就直接寫')}${npc.name}${t('的對話內容，不要加任何分析、思考過程、或前言')}
${t('- 不要寫「讓我分析」「根據設定」「需要考慮」等分析文字')}
${t('- 不要加名字前綴')}
${t('- 最後另起一行寫：')}EFFECTS: {"affinity_change": ${t('數字')}(-3${t('到')}5), "romantic_change": ${t('數字')}(0${t('到')}3), "summary": "${t('一句話總結')}"}
${t('- 整個回覆只有對話內容和EFFECTS行，不要有其他任何東西')}`;

                const response = await this.llm.generate(prompt, 400, 0.9, true);
                console.log('[RimTown] LLM response length:', response?.length, 'preview:', response?.slice(0, 80));
                return this._parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc);
            } catch(e) { console.error('[RimTown] LLM player reply failed:', e); }
        } else {
            console.log('[RimTown] No LLM client — using fallback for player chat');
        }
        return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
    }

    _parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc) {
        if (!response || !response.trim()) {
            // LLM returned empty → use fallback
            return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
        }
        // Strip any reasoning/analysis blocks the LLM may have emitted
        let cleaned = response.trim();
        // Remove markdown-style thinking blocks
        cleaned = cleaned.replace(/```(?:thinking|analysis|reasoning)[\s\S]*?```/gi, '');
        // Remove lines that look like LLM internal analysis (common patterns)
        cleaned = cleaned.replace(/^[\s\S]*?(?=\n[^需要根据首先接下来分析让我])/m, (match) => {
            // Only strip if it looks like extended reasoning (>100 chars before first dialogue line)
            return match.length > 100 && /(?:需要|根据|分析|首先|接下来|让我|用户|角色|设定|背景|规则)/.test(match) ? '' : match;
        });

        const lines = cleaned.trim().split('\n');
        const replyLines = []; let effects = {};
        let foundEffects = false;
        for (const line of lines) {
            const s = line.trim(); if (!s) continue;
            if (s.startsWith('EFFECTS:') || s.startsWith('effects:') || s.startsWith('Effects:')) {
                try {
                    const rest = lines.slice(lines.indexOf(line)).join('\n');
                    const js=rest.indexOf('{'), je=rest.lastIndexOf('}')+1;
                    if(js>=0&&je>js) effects=JSON.parse(rest.slice(js,je));
                } catch(e){}
                foundEffects = true;
                break;
            } else {
                let text = s;
                // Strip various prefixes: "Name:", "**Name:**", "Name：", etc.
                const prefixPatterns = [
                    new RegExp(`^\\*{0,2}${npc.name}\\*{0,2}[${t('：')}:]\\s*`),
                    /^\*{0,2}[\w\u4e00-\u9fff]+\*{0,2}[：:]\s*/,
                ];
                for (const pat of prefixPatterns) {
                    if (pat.test(text)) { text = text.replace(pat, '').trim(); break; }
                }
                // Skip lines that look like stage directions or system text
                if (text.startsWith('(') && text.endsWith(')')) continue;
                if (text.startsWith(t('（')) && text.endsWith(t('）'))) {
                    // Keep emotional descriptions in parentheses
                    replyLines.push(text);
                    continue;
                }
                // Skip lines that look like LLM reasoning/analysis (not actual dialogue)
                if (/^(?:需要|根据|根據|首先|接下来|接下來|让我|讓我|分析|用户|用戶|角色|设定|設定|背景|规则|規則|考虑|考慮|这个|這個|所以|因此|综上|綜上|最后|最後按照|输出|輸出)/.test(text)) continue;
                // Skip lines with meta-commentary markers
                if (/(?:affinity_change|romantic_change|summary|好感度变化|好感度變化)/.test(text) && !foundEffects) continue;
                if (text) replyLines.push(text);
            }
        }
        const npcReply = replyLines.join(' ').trim();
        if (!npcReply) {
            // Parsing yielded nothing → use fallback
            return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
        }
        const affChange = effects.affinity_change ?? randInt(0,2);
        const romChange = effects.romantic_change ?? 0;
        const summary = effects.summary || `${npc.name}${t('回應了')}${player.name}${t('。')}`;
        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(0, affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}${t('說：「')}${playerMessage}${t('」— ')}${summary}`, 5, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${npc.name}${t('交談：')}${summary}`, 4, [npc.name]);
        // Only push NPC reply (player message already added by playerSendMessage)
        // 去重不比對時間戳:AI 回覆期間遊戲時間會前進,舊檢查因時間不同而重複寫入玩家訊息(重複留言 bug)
        if (!player.chatHistory.slice(-6).some(m => m.speaker === player.name && m.target === npc.name && m.text === playerMessage)) {
            player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        }
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        player._recentChatTick = world.tickCount; // Mark for social need recovery
        world.logMessage('player_chat', `${player.name} → ${npc.name}: ${summary}`, player.name, npc.name);
        world.checkHeartEvents?.(); // v5.0.0 聊天後檢查心動事件
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }

    _fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc) {
        const tr = npc.personality.traits;
        const aff = relNpc.affinity;
        const isCouple = relNpc.status === 'dating' || relNpc.status === 'married';
        const msg = playerMessage.toLowerCase();
        const jobTitle = npc.job?.title || t('居民');
        const jobKey = npc.job?.key || '';
        const loc = npc.currentLocation.replace(/_/g,' ');
        const season = world.clock.season;
        const timeOfDay = world.clock.timeOfDay;
        const isNight = timeOfDay === 'night' || timeOfDay === 'evening';

        let npcReply = '';
        let affChange = 0;
        let romChange = 0;
        let summary = '';

        // Detect message intent via keyword matching
        const isGreeting = /你好|嗨|哈囉|hello|hi|早安|晚安|嘿/.test(msg);
        const isAskName = /名字|你叫|你是誰|認識/.test(msg);
        const isAskJob = /工作|職業|做什麼|你在幹|忙什麼/.test(msg);
        const isAskMood = /心情|怎麼了|還好嗎|你好嗎|開心|難過|不好/.test(msg);
        const isAskLove = /喜歡|愛|暗戀|對象|交往|結婚|單身|感情/.test(msg);
        const isFlirt = /好看|漂亮|帥|可愛|迷人|約會|陪我/.test(msg);
        const isAskTown = /鎮上|小鎮|這裡|消息|八卦|新聞|最近/.test(msg);
        const isAskFood = /吃|餓|食物|餐|飯|料理|好吃/.test(msg);
        const isCompliment = /厲害|佩服|好棒|真強|了不起|手藝|技術/.test(msg);
        const isInsult = /笨|蠢|醜|差|爛|廢|討厭|滾/.test(msg);
        const isFarewell = /再見|掰|拜|走了|先走|告辭/.test(msg);
        const isAskHelp = /幫忙|幫我|拜託|求你|需要/.test(msg);
        const isAskStory = /故事|過去|以前|經歷|怎麼來|家鄉/.test(msg);
        const isAskWeather = /天氣|天空|冷|熱|下雨|季節|星星/.test(msg);

        // Personality-flavored response builder
        const shy = tr.includes('shy');
        const kind = tr.includes('kind');
        const abrasive = tr.includes('abrasive');
        const charismatic = tr.includes('charismatic');
        const gossip = tr.includes('gossip');
        const romantic = tr.includes('romantic');
        const pessimist = tr.includes('pessimist');
        const optimist = tr.includes('optimist');
        const lazy = tr.includes('lazy');

        if (isInsult) {
            // Player is being mean
            if (abrasive) npcReply = pickRandom([t('你說什麼！？你自己才是吧！'),t('哼，你也好不到哪去。'),t('你這嘴巴欠教訓。')]);
            else if (shy) npcReply = pickRandom([t('...你、你怎麼能這樣說...'),'......',t('我做錯什麼了嗎...')]);
            else if (kind) npcReply = pickRandom([t('這樣說話很傷人的...'),t('你是不是心情不好？不然怎麼會這樣。'),t('我...不知道你為什麼要這樣。')]);
            else npcReply = pickRandom([t('你這話說得太過分了。'),t('......我沒必要跟你計較。'),t('你認真的嗎？')]);
            affChange = randInt(-6,-3);
            summary = `${player.name}${t('言語冒犯了')}${npc.name}${t('。')}`;
        } else if (isFlirt) {
            if (isCouple) {
                npcReply = pickRandom([t('你啊...每次都這樣，不過我就是吃這套。'),t('哈哈，老夫老妻了還這麼會講。'),t('你真的很會撩人，我都不好意思了。')]);
                affChange = randInt(2,4); romChange = randInt(1,3);
            } else if (romantic && aff > 10) {
                npcReply = shy ? pickRandom([t('你、你在說什麼啦...（臉紅）'),t('別、別突然這樣講...'),t('...謝謝...（小聲）')])
                    : pickRandom([t('哈哈，你還挺會說話的嘛。'),t('嗯？你是在跟我告白嗎？'),t('你這話讓人心跳加速呢。')]);
                affChange = randInt(1,4); romChange = randInt(2,5);
            } else if (aff < -10) {
                npcReply = pickRandom([t('...你在開什麼玩笑。'),t('拜託，省省吧。'),t('你是不是搞錯了什麼？')]);
                affChange = randInt(-2,0);
            } else {
                npcReply = shy ? t('...什麼？（不知所措）') : pickRandom([t('哈？你認真的嗎？'),t('嗯...謝謝？'),t('你還挺有趣的。')]);
                affChange = randInt(0,2); romChange = randInt(0,2);
            }
            summary = `${player.name}${t('對')}${npc.name}${t('說了甜言蜜語。')}`;
        } else if (isGreeting) {
            if (isCouple) npcReply = pickRandom([`${t('嗨親愛的，我一直在等你呢。')}`,`${t('你來了！好想你。')}`,`${t('嘿~今天怎麼這麼晚來找我？')}`]);
            else if (aff > 50) npcReply = charismatic ? `${player.name}${t('！太好了你來了！')}`
                : shy ? `${t('啊...')}${player.name}...${t('你好。（微笑）')}`
                : `${t('嘿！好久不見，最近好嗎？')}`;
            else if (aff > 10) npcReply = pickRandom([`${t('你好啊！有什麼事嗎？')}`,`${t('嗨！今天')}${loc}${t('挺熱鬧的。')}`,`${t('哈囉，正好遇到你了。')}`]);
            else if (aff > -10) npcReply = abrasive ? t('嗯？怎麼了。') : pickRandom([`${t('嗯，你好。')}`,`${t('哦，是你啊。')}`,`${t('哈囉。')}`]);
            else npcReply = pickRandom([`...${t('有事嗎？')}`,`${t('你又來了。')}`,`${t('嗯。')}`]);
            affChange = aff > -10 ? randInt(0,2) : randInt(-1,0);
            summary = `${player.name}${t('和')}${npc.name}${t('打了招呼。')}`;
        } else if (isAskName) {
            npcReply = pickRandom([
                `${t('我叫')}${npc.name}${t('，')}${npc.age}${t('歲，在鎮上當')}${jobTitle}。`,
                `${npc.name}${t('啊，怎麼？你忘了我嗎？')}`,
                shy ? `${t('我...我叫')}${npc.name}...` : `${t('我是')}${npc.name}${t('，認識一下！')}`,
            ]);
            affChange = randInt(0,2);
            summary = `${npc.name}${t('自我介紹了。')}`;
        } else if (isAskJob) {
            const jobReplies = {
                farmer: [`${t('我是農夫啊，每天日出就到田裡去了。')}${season}${t('是')}${pickRandom([t('播種'),t('收穫'),t('準備'),t('整地')])}${t('的季節。')}`,`${t('種田很辛苦，但看到作物長大就很有成就感。')}`],
                miner: [`${t('挖礦啊，每天鑽到山裡去。最近挖到了一些不錯的')}${pickRandom([t('鐵礦'),t('石頭'),t('稀有礦石')])}${t('。')}`,`${t('礦坑裡又暗又悶，但能找到好東西的時候特別開心。')}`],
                cook: [`${t('我在酒館煮飯！最近在研究新')}${pickRandom([t('菜色'),t('食譜'),t('料理')])}${t('。')}`,`${t('煮飯給大家吃是我的樂趣，你要不要嚐嚐？')}`],
                blacksmith: [`${t('我是鐵匠，每天跟鐵和火打交道。')}${shy?t('...比跟人打交道容易多了。'):t('最近在打造一把新的工具。')}`,`${t('敲打金屬的感覺很療癒，每一件作品都是獨一無二的。')}`],
                doctor: [`${t('我是醫生，')}${lazy?t('...雖然有時候很懶得看診。'):t('負責照顧鎮上所有人的健康。')}${t('有什麼不舒服嗎？')}`,`${t('行醫是一份責任很重的工作，但能治好人的時候很開心。')}`],
                researcher: [`${t('我在圖書館做研究，最近在研究')}${pickRandom([t('古代遺跡'),t('草藥學'),t('天文現象'),t('歷史文獻')])}${t('。')}`,`${t('學問的世界無窮無盡，每天都有新發現。')}`],
                trader: [`${t('我做買賣的，跟外面的商隊有聯繫。')}${charismatic?t('要買什麼跟我說，我給你打折！'):t('最近市場不太穩定。')}`,`${t('當商人最重要的是眼光和人脈。')}`],
                guard: [`${t('我是守衛，負責鎮上的安全。')}${pessimist?t('這年頭什麼事都可能發生。'):t('還好最近挺太平的。')}`,`${t('守衛的工作就是讓大家能安心過日子。')}`],
                carpenter: [`${t('我是木匠，蓋房子修東西。')}${lazy?t('...雖然有時候偷懶。'):t('最近在趕工，忙得很。')}`,`${t('木工的手藝越老越精，每塊木頭都有它的個性。')}`],
                tailor: [`${t('我是裁縫，做衣服的。')}${shy?t('...你要訂做什麼嗎？'):t('最近在設計新款式呢！')}`,`${t('一針一線都是心血，我對品質很要求的。')}`],
                priest: [`${t('我在禮拜堂服務，照顧大家的心靈。')}${kind?t('如果有煩惱，可以來找我聊聊。'):t('也會幫忙主持各種儀式。')}`,`${t('能為鎮民帶來平靜和希望，就是我最大的滿足。')}`],
                mayor: [`${t('我是鎮長，管理鎮上大小事務。')}${optimist?t('我對這個鎮的未來很有信心！'):t('責任很重，但這是我的使命。')}`,`${t('治理一個鎮子不容易，但看到大家過得好就值了。')}`],
            };
            const pool = jobReplies[jobKey] || [`${t('我在鎮上當')}${jobTitle}${t('，還過得去吧。')}`,`${jobTitle}${t('的工作有好有壞，但至少有事做。')}`];
            npcReply = pickRandom(pool);
            affChange = randInt(0,2);
            summary = `${npc.name}${t('聊了自己的工作。')}`;
        } else if (isAskMood) {
            if (npc.mood > 60) npcReply = pickRandom([`${t('我很好啊！')}${optimist?t('今天特別開心！'):t('最近一切都挺順利的。')}`,`${t('心情不錯！有什麼好事就是會開心嘛。')}`,`${t('挺好的，謝謝你關心。')}`]);
            else if (npc.mood > 30) npcReply = pickRandom([`${t('還行吧，普普通通。')}`,`${t('馬馬虎虎，')}${pessimist?t('不過總覺得少了什麼。'):t('就是平常的日子。')}`,`${t('沒什麼特別的，過一天算一天。')}`]);
            else npcReply = pickRandom([
                `${t('唉...說實話不太好。')}${kind?t('不過沒關係，撐得住。'):t('別問了。')}`,
                `${t('最近有點')}${pickRandom([t('煩'),t('累'),t('低落'),t('壓力大')])}...${shy?'...':t('你真的想聽嗎？')}`,
                pessimist ? t('一如既往地糟。') : t('有點不順，但會過去的。'),
            ]);
            affChange = randInt(1,3);
            summary = `${npc.name}${t('分享了自己的心情。')}`;
        } else if (isAskLove) {
            if (isCouple) {
                const partnerName = relNpc.status === 'married' ? t('老公/老婆') : t('對象');
                npcReply = pickRandom([`${t('我跟')}${player.name}${t('在一起啊，你忘了嗎？')}`,`${t('哈哈，感情的事...有你就夠了。')}`,`${t('你是在試探我嗎？我只有你啊。')}`]);
                romChange = randInt(1,3);
            } else if (relNpc.romanticInterest > 50) {
                npcReply = shy ? `${t('感、感情的事...我不太想說...（臉紅）')}` :
                    pickRandom([`${t('嗯...其實有一個在意的人啦...不告訴你是誰。')}`,`${t('你為什麼突然問這個？難道你...？')}`,`${t('哈，秘密。')}`]);
                romChange = randInt(0,2);
            } else {
                npcReply = romantic ? pickRandom([`${t('還沒遇到對的人呢...不過我相信緣分。')}`,`${t('我是很期待愛情的，只是...唉。')}`])
                    : pickRandom([`${t('這種事順其自然吧。')}`,`${t('目前沒什麼想法，工作比較重要。')}`,abrasive?t('關你什麼事。'):t('哈哈，你怎麼突然問這個？')]);
            }
            affChange = randInt(0,2);
            summary = `${player.name}${t('問了')}${npc.name}${t('感情的事。')}`;
        } else if (isAskStory) {
            npcReply = pickRandom([
                `${t('我的故事啊...')}${npc.personality.background}`,
                `${t('以前的事嗎？')}${shy?t('...有點不好意思說。'):t('坐下來，我慢慢跟你講。')} ${npc.personality.background}`,
                `${t('你想知道我的過去？好吧...')}${npc.personality.background.slice(0,50)}`,
            ]);
            affChange = randInt(1,4);
            summary = `${npc.name}${t('分享了自己的故事。')}`;
        } else if (isAskTown) {
            const gossipTopics = world.events?.conversationTopics || [];
            const gossip_s = world.gossipNetwork?.activeGossip || [];
            if (gossip && gossip_s.length) {
                const g = pickRandom(gossip_s);
                npcReply = `${t('你想知道最近的八卦？')}${g.content} ${t('這可是獨家消息喔！')}`;
            } else if (gossipTopics.length) {
                npcReply = `${t('最近鎮上在聊')}${pickRandom(gossipTopics)}${t('的事，你聽說了嗎？')}`;
            } else {
                npcReply = pickRandom([
                    `${t('鎮上最近')}${optimist?t('挺太平的，大家都過得不錯。'):t('也沒什麼特別的事。')}`,
                    `${season}${t('嘛，')}${pickRandom([t('農忙的季節'),t('大家都挺忙的'),t('日子就這樣過')])}${t('。')}`,
                    pessimist ? t('最近總覺得要出什麼事...') : `${t('邊境鎮就是這樣，每天都有小故事。')}`,
                ]);
            }
            affChange = randInt(0,3);
            summary = `${npc.name}${t('跟')}${player.name}${t('聊了鎮上的近況。')}`;
        } else if (isAskFood) {
            if (jobKey === 'cook') npcReply = pickRandom([`${t('你來對人了！我最近做了')}${pickRandom([t('燉肉'),t('烤魚'),t('蔬菜湯'),t('肉包子')])}${t('，要不要嚐嚐？')}`,`${t('吃的是我的專業！等著，我去給你弄點好吃的。')}`]);
            else if (npc.needs.hunger < 30) npcReply = `${t('別說了，我自己都快餓死了...一起去酒館吧？')}`;
            else npcReply = pickRandom([`${t('酒館的飯菜不錯，推薦你去試試。')}`,`${t('王麗煮的菜最好吃了，你應該去嚐嚐。')}`,`${t('肚子餓了嗎？吃飽了心情才會好。')}`]);
            affChange = randInt(0,2);
            summary = `${player.name}${t('和')}${npc.name}${t('聊了吃的。')}`;
        } else if (isAskWeather) {
            const weatherMap = {'春季':t('春天暖洋洋的'),'夏季':t('夏天好熱'),'秋季':t('秋天涼爽'),'冬季':t('冬天好冷')};
            if (isNight) npcReply = pickRandom([`${t('今晚的')}${pickRandom([t('星空'),t('月色'),t('夜風')])}${t('真不錯。')}`,`${t('夜裡出來')}${pickRandom([t('看星星'),t('散步'),t('吹風')])}${t('？我也覺得很舒服。')}`,tr.includes('night_owl')?t('夜晚最棒了，安安靜靜的。'):t('這麼晚了，小心著涼。')]);
            else npcReply = pickRandom([`${weatherMap[season]||t('天氣還好')}${t('，')}${optimist?t('不過我很享受！'):t('希望別變天。')}`,`${season}${t('到了，')}${pickRandom([t('時間過得真快'),t('又是新的季節'),t('風景挺美的')])}${t('。')}`]);
            affChange = randInt(0,2);
            summary = `${player.name}${t('和')}${npc.name}${t('聊了天氣。')}`;
        } else if (isCompliment) {
            if (shy) npcReply = pickRandom([`${t('啊...謝、謝謝你...（臉紅）')}`,`${t('不、不會啦...你過獎了。')}`,`...${t('真的嗎？（開心但不好意思）')}`]);
            else if (abrasive) npcReply = pickRandom([`${t('哼，不用奉承我。')}`,`...${t('你有什麼目的？')}`,`${t('嗯，我知道。')}`]);
            else npcReply = pickRandom([`${t('哈哈，謝謝！你這麼說我很開心。')}`,`${t('你真會說話！')}`,`${t('被你這樣誇，有點不好意思呢。')}`]);
            affChange = randInt(2,5);
            if (romantic) romChange = randInt(0,2);
            summary = `${player.name}${t('讚美了')}${npc.name}。`;
        } else if (isAskHelp) {
            if (kind) npcReply = pickRandom([`${t('需要幫忙嗎？儘管說！')}`,`${t('我能做的一定幫！你說吧。')}`,`${t('別客氣，鄰居互相幫忙是應該的。')}`]);
            else if (lazy) npcReply = pickRandom([`${t('嗯...看是什麼事吧。我今天有點懶...')}`,`${t('幫忙可以，但別太累的。')}`]);
            else if (abrasive) npcReply = pickRandom([`${t('看什麼事吧。')}`,`${t('我不是慈善機構。')}`,`${t('你自己不能解決嗎？')}`]);
            else npcReply = pickRandom([`${t('什麼事？看我能不能幫上忙。')}`,`${t('好吧，你說說看。')}`,`${t('我盡量吧。')}`]);
            affChange = kind ? randInt(1,3) : randInt(-1,2);
            summary = `${player.name}${t('向')}${npc.name}${t('求助。')}`;
        } else if (isFarewell) {
            if (isCouple) npcReply = pickRandom([`${t('這麼快就走？路上小心。想你。')}`,`${t('嗯...早點回來。')}`,`${t('下次再來找我。')}`]);
            else if (aff > 30) npcReply = pickRandom([`${t('再見！下次再聊！')}`,`${t('掰掰，保重啊！')}`,`${t('好的，有空再來找我！')}`]);
            else npcReply = pickRandom([`${t('嗯，再見。')}`,`${t('好的。')}`,abrasive?t('終於要走了。'):t('拜拜。')]);
            affChange = randInt(0,1);
            summary = `${player.name}${t('和')}${npc.name}${t('道別了。')}`;
        } else {
            // Detect if player is asking a question
            const isQuestion = /[？?]/.test(msg) || /嗎$|呢$|吧$/.test(msg.trim()) || /^(誰|什麼|哪|為什麼|怎麼|有沒有|是不是|知不知|你知道|你覺得|你認為|你有|可以|能不能|會不會|要不要)/.test(msg);
            const isAboutSomeone = /誰|某人|有人|大家|他們|別人|其他人/.test(msg);
            const isAboutOpinion = /覺得|認為|看法|意見|怎麼看|怎麼想/.test(msg);
            const isAboutKnowledge = /知道|聽說|有沒有|是不是|真的|假的/.test(msg);

            if (isQuestion && isAboutSomeone) {
                // Question about other people
                const gossip_s = world.gossipNetwork?.activeGossip || [];
                if (gossip && gossip_s.length) {
                    const g = pickRandom(gossip_s);
                    npcReply = pickRandom([`${t('嗯...我聽說')}${g.content}`,`${t('你問這個啊？我倒是有聽到一些...')}${g.content}`,`${shy?t('呃...我不太確定，但...'):t('我跟你說喔，')}${g.content}`]);
                } else {
                    npcReply = pickRandom([
                        `${shy?t('嗯...我不太清楚...'):t('這個嘛...')}${t('我平常不太注意別人的事。')}`,
                        `${abrasive?t('我怎麼會知道這種事。'):t('我沒聽說過耶。')}${t('你要不要去問問別人？')}`,
                        `${gossip?t('欸我有聽到一點風聲，但不確定是不是真的...'):t('這個我真的不知道。')}`,
                        `${charismatic?t('哈哈，你還挺八卦的嘛！'):t('嗯...')}${t('我對這些不太了解欸。')}`,
                    ]);
                }
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('關於其他人的事。')}`;
            } else if (isQuestion && isAboutOpinion) {
                // Asking for NPC's opinion
                npcReply = pickRandom([
                    `${shy?t('呃...我的想法嗎...'):t('嗯，讓我想想。')}${t('我覺得')}${pickRandom([t('每個人有每個人的想法吧'),t('很難說，要看情況'),t('這種事沒有標準答案')])}${t('。')}`,
                    `${abrasive?t('你問我？'):t('好問題。')}${pessimist?t('反正不管怎樣結果都差不多。'):optimist?t('我覺得往好的方面想就對了！'):t('這要看怎麼看吧。')}`,
                    `${charismatic?t('哦？你想聽我的看法？'):t('嗯...')}${pickRandom([t('我個人是覺得還好啦。'),t('說真的，我也沒什麼特別的想法。'),t('這個嘛...要我說的話...算了，我也不太確定。')])}`,
                ]);
                affChange = randInt(0,3);
                summary = `${player.name}${t('詢問了')}${npc.name}${t('的看法。')}`;
            } else if (isQuestion && isAboutKnowledge) {
                // Asking if NPC knows something
                npcReply = pickRandom([
                    `${shy?t('呃...'):t('嗯，')}${pickRandom([t('我不太確定耶...'),t('這個我沒聽過。'),t('好像有聽說過，但記不太清了。')])}`,
                    `${gossip?t('欸你這麼一說我好像有印象...不過我也不確定是不是真的。'):t('這個嘛...我真的不知道欸。')}`,
                    `${abrasive?t('你覺得我什麼都知道嗎？'):t('哈，')}${t('你可以去問問鎮上其他人，搞不好他們知道。')}`,
                    `${charismatic?t('有趣的問題！'):t('嗯...')}${pickRandom([t('讓我想想...不，我真的不知道。'),t('我也想知道呢。'),t('你去圖書館查查看？')])}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('一些事。')}`;
            } else if (isQuestion) {
                // Generic question
                npcReply = pickRandom([
                    `${shy?t('嗯...這個嘛...'):t('')}${pickRandom([t('我想想喔...'),t('好問題...'),t('你突然這樣問我...')])}${pickRandom([t('我也不太確定。'),t('可能吧？'),t('要看情況。'),t('我沒想過這個問題欸。')])}`,
                    `${abrasive?t('這種事你自己不知道嗎？'):charismatic?t('哈哈，你真的很好奇欸！'):t('嗯...')}${pickRandom([t('說實話我不太清楚。'),t('我回去想想再告訴你。'),t('你為什麼會想問這個？')])}`,
                    `${optimist?t('嗯，我覺得答案應該是正面的！'):pessimist?t('我不確定，但大概不會太好吧...'):t('我沒有什麼特別的想法欸。')}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('一個問題。')}`;
            } else {
                // Statement / generic chat — respond based on relationship
                if (isCouple) npcReply = pickRandom([`${t('嗯嗯，我在聽。你繼續說。')}`,`${t('你說的我都聽進去了。')}`,`${t('是嗎？跟我說更多。')}`]);
                else if (aff > 50) npcReply = pickRandom([`${t('嗯嗯！然後呢？')}`,`${t('哈哈，你說的我懂。')}`,`${t('是嗎？有意思！跟我說更多。')}`,`${t('我也有同感！')}`]);
                else if (aff > 20) npcReply = pickRandom([`${t('嗯，你說的有道理。')}`,`${t('原來如此，我沒想過這件事。')}`,`${t('哈，你還挺有想法的嘛。')}`,`${t('是喔？有趣。')}`]);
                else if (aff > -10) npcReply = pickRandom([`${t('嗯...是嗎。')}`,`${t('哦，我知道了。')}`,`${t('你這人還挺愛聊的。')}`,shy?t('嗯嗯...'):abrasive?t('所以呢？'):t('好吧。')]);
                else npcReply = pickRandom([`...${t('隨便你怎麼說吧。')}`,`${t('嗯哼。')}`,`${t('我不太感興趣。')}`,`${t('你說完了嗎？')}`]);
                affChange = aff > 0 ? randInt(0,2) : randInt(-1,1);
            }
            summary = summary || `${player.name}${t('和')}${npc.name}${t('聊了天。')}`;
        }

        // Add context-sensitive follow-up based on NPC state (natural phrasing)
        if (npc.needs.hunger < 20 && Math.random() < 0.3) npcReply += pickRandom([t(' ...（肚子咕嚕叫）啊，不好意思。'),t(' 話說酒館現在有什麼吃的嗎？我都沒吃午飯。'),t(' 哎，跟你聊著聊著都忘了吃飯了。')]);
        if (npc.needs.rest < 20 && Math.random() < 0.3) npcReply += pickRandom([t(' （打了個哈欠）抱歉...昨晚沒睡好。'),t(' 唉，今天腰都快斷了，幹了一整天活。'),t(' 不好意思，我眼皮有點撐不住了...')]);
        if (isNight && !tr.includes('night_owl') && Math.random() < 0.2) npcReply += pickRandom([t(' 好了，夜深了，明天再聊吧。'),t(' 啊，都這個時間了？我得回去了。')]);
        if (npc.activity === 'stargazing' && Math.random() < 0.3) npcReply += pickRandom([t(' 欸你看！那邊那顆星特別亮！'),t(' 今晚的星空真美，你不覺得嗎？')]);

        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(-3,affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}${t('說：「')}${playerMessage.slice(0,30)}${t('」— ')}${summary}`, 4+Math.abs(affChange), [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${npc.name}${t('：')}${summary}`, 3+Math.abs(affChange), [npc.name]);
        // Only push NPC reply (player message already added by playerSendMessage)
        // 去重不比對時間戳:AI 回覆期間遊戲時間會前進,舊檢查因時間不同而重複寫入玩家訊息(重複留言 bug)
        if (!player.chatHistory.slice(-6).some(m => m.speaker === player.name && m.target === npc.name && m.text === playerMessage)) {
            player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        }
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        player._recentChatTick = world.tickCount; // Mark for social need recovery
        world.logMessage('player_chat', summary, player.name, npc.name);
        world.checkHeartEvents?.(); // v5.0.0 聊天後檢查心動事件
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }
}

// --- LLM Client ---
class LLMClient {
    constructor(provider, apiKey, model) {
        this.provider = provider; this.apiKey = apiKey; this.model = model;
        // Rate limiting
        this._requestTimestamps = [];
        this._maxRequestsPerMinute = 20;
        this._rateLimitedUntil = 0;
        // Fallback
        this.fallbackGroqKey = null;
        this._fallbackActive = false;
        this._primaryFailCount = 0;
        this._primaryCooldownUntil = 0;
    }

    setFallbackGroqKey(key) { this.fallbackGroqKey = key; }

    /**
     * Test if the API key is valid by making a minimal request.
     * Returns { ok: true/false, error: string|null }
     */
    async testConnection(provider, apiKey) {
        provider = provider || this.provider;
        apiKey = apiKey || this.apiKey;
        if (!provider || provider === 'none' || !apiKey) {
            return { ok: false, error: 'No provider or API key' };
        }
        try {
            this._lastError = '';
            const result = await this._callProvider(provider, apiKey, null, 'Say "ok"', 5, 0);
            if (result === '__RATE_LIMITED__') return { ok: true, error: null }; // rate limited means key is valid
            if (result === '__ERROR__') return { ok: false, error: this._lastError || 'API returned error — check your key' };
            return { ok: true, error: null };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    _canMakeRequest(isPlayerChat = false) {
        const now = Date.now();
        if (now < this._rateLimitedUntil) {
            if (!isPlayerChat || now < this._rateLimitedUntil - 30000) return false;
        }
        this._requestTimestamps = this._requestTimestamps.filter(t => now - t < 60000);
        const limit = isPlayerChat ? this._maxRequestsPerMinute : Math.floor(this._maxRequestsPerMinute / 2);
        return this._requestTimestamps.length < limit;
    }

    _recordRequest() { this._requestTimestamps.push(Date.now()); }

    _handleRateLimit() {
        this._rateLimitedUntil = Date.now() + 60000;
        console.warn('[RimTown LLM] 429 received — pausing all requests for 60 seconds');
    }

    async generate(prompt, maxTokens = 500, temperature = 0.9, isPlayerChat = false) {
        // If primary is in cooldown and fallback available, go straight to fallback
        if (this._primaryCooldownUntil > Date.now() && this.fallbackGroqKey && this.provider !== 'groq') {
            console.log('[RimTown LLM] Primary in cooldown — using Groq fallback');
            return this._generateWithGroqFallback(prompt, maxTokens, temperature);
        }

        if (!this._canMakeRequest(isPlayerChat)) {
            // Rate limited locally — try fallback instead of returning empty
            if (this.fallbackGroqKey && this.provider !== 'groq') {
                console.log('[RimTown LLM] Local rate limit — using Groq fallback');
                return this._generateWithGroqFallback(prompt, maxTokens, temperature);
            }
            const waitSec = Math.max(0, Math.ceil((this._rateLimitedUntil - Date.now()) / 1000));
            console.log(`[RimTown LLM] Rate limited — skipping (isPlayerChat: ${isPlayerChat}, cooldown: ${waitSec}s)`);
            return '';
        }
        this._recordRequest();

        console.log('[RimTown LLM] generate called | provider:', this.provider, '| model:', this.model, '| maxTokens:', maxTokens, '| priority:', isPlayerChat ? 'PLAYER' : 'npc');
        const result = await this._callProvider(this.provider, this.apiKey, this.model, prompt, maxTokens, temperature);

        // If primary failed and we have fallback, try Groq
        if (result === '__RATE_LIMITED__' || result === '__ERROR__') {
            this._handleRateLimit();
            if (this.fallbackGroqKey && this.provider !== 'groq') {
                console.log(`[RimTown LLM] Primary ${this.provider} failed (${result}) — switching to Groq fallback`);
                this._primaryFailCount++;
                const cooldownMs = Math.min(60000 * this._primaryFailCount, 300000);
                this._primaryCooldownUntil = Date.now() + cooldownMs;
                console.log(`[RimTown LLM] Primary cooldown: ${cooldownMs/1000}s (fail #${this._primaryFailCount})`);
                return this._generateWithGroqFallback(prompt, maxTokens, temperature);
            }
            return '';
        }

        // Primary succeeded — reset fail count
        if (result && this._primaryFailCount > 0) {
            this._primaryFailCount = 0;
            this._primaryCooldownUntil = 0;
            if (this._fallbackActive) {
                this._fallbackActive = false;
                console.log('[RimTown LLM] Primary recovered — back to', this.provider);
            }
        }
        return this._stripThinkTags(result);
    }

    _stripThinkTags(text) {
        if (!text) return text;
        // Remove paired <think>...</think> blocks
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // Remove unclosed <think> tag (model didn't close it or got cut off)
        text = text.replace(/<think>[\s\S]*/gi, '');
        return text.trim();
    }

    async _generateWithGroqFallback(prompt, maxTokens, temperature) {
        this._fallbackActive = true;
        const result = await this._callProvider('groq', this.fallbackGroqKey, null, prompt, maxTokens, temperature);
        if (result === '__RATE_LIMITED__' || result === '__ERROR__') return '';
        return this._stripThinkTags(result);
    }

    // v5.33.3 Groq 模型動態解析:Groq 汰換模型頻繁,寫死模型名遲早 404
    // 直接查這把 key 當下可用的模型清單,依偏好挑一個;結果快取到 localStorage
    async _resolveGroqModel(apiKey, force = false) {
        if (!force && this._groqModelCache) return this._groqModelCache;
        if (!force) {
            try { const c = localStorage.getItem('rimtown_groq_model'); if (c) return (this._groqModelCache = c); } catch (e) {}
        }
        try {
            const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': 'Bearer ' + apiKey } });
            if (res.ok) {
                const data = await res.json();
                const ids = (data.data || []).map(m => m.id);
                const prefer = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b'];
                let pick = prefer.find(p => ids.includes(p));
                if (!pick) pick = ids.find(id => !/whisper|tts|guard|embed|vision|scout|maverick/i.test(id));
                if (pick) {
                    this._groqModelCache = pick;
                    try { localStorage.setItem('rimtown_groq_model', pick); } catch (e) {}
                    console.log('[RimTown LLM] Groq model resolved:', pick);
                    return pick;
                }
            }
        } catch (e) { console.warn('[RimTown LLM] Groq model list failed:', e.message); }
        return this._groqModelCache || 'llama-3.3-70b-versatile';
    }

    async _callProvider(provider, apiKey, model, prompt, maxTokens, temperature) {
        const endpoints = {
            anthropic: { url: 'https://api.anthropic.com/v1/messages', model: model || 'claude-haiku-4-5-20251001' },
            // v5.29.1 OpenAI 鎖定 gpt-4o-mini(成本控制):忽略任何 model 覆寫,避免誤用到高價模型
            openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
            gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/${model||'gemini-2.5-flash'}:generateContent` },
            deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: model || 'deepseek-chat' },
            // v5.33.2 Groq 預設改用正式版模型(qwen3-32b 為 preview 已下架,舊預設會 404)
            groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: model || 'llama-3.3-70b-versatile' },
            together: { url: 'https://api.together.xyz/v1/chat/completions', model: model || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
            minimax: { url: 'https://api.minimaxi.com/v1/text/chatcompletion_v2', model: model || 'MiniMax-M2.5' },
        };
        // 小鎮伺服器 AI(免金鑰):走同網域 /api/chat,金鑰保管在伺服器
        if (provider === 'server') {
            try {
                const headers = { 'Content-Type': 'application/json' };
                try {
                    const jwt = localStorage.getItem('rimtown_jwt');
                    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
                } catch (e) {}
                const res = await fetch('/api/chat', {
                    method: 'POST', headers,
                    body: JSON.stringify({ prompt, max_tokens: maxTokens, temperature }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                return data.reply || '';
            } catch (err) {
                console.warn('[RimTown LLM] server provider error:', err.message);
                return '__ERROR__';
            }
        }

        const cfg = endpoints[provider];
        if (!cfg) return '__ERROR__';
        // v5.33.3 Groq 未指定模型時動態解析(可用清單快取)
        if (provider === 'groq' && !model) cfg.model = await this._resolveGroqModel(apiKey);

        try {
            if (provider === 'anthropic') {
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
                    body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                console.log('[RimTown LLM] Anthropic response:', res.status, data.content ? 'OK' : 'EMPTY', data.error?.message || '');
                return data.content?.[0]?.text || '';
            } else if (provider === 'gemini') {
                const res = await fetch(cfg.url, {
                    method:'POST', headers:{'Content-Type':'application/json', 'x-goog-api-key':apiKey},
                    body: JSON.stringify({
                        contents:[{parts:[{text:prompt}]}],
                        generationConfig:{maxOutputTokens:maxTokens, temperature},
                    }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                console.log('[RimTown LLM] Gemini response:', res.status, data.candidates ? 'OK' : 'EMPTY', data.error?.message || '');
                const parts = data.candidates?.[0]?.content?.parts || [];
                const textPart = parts.filter(p => !p.thought).map(p => p.text).join('');
                return textPart || parts[0]?.text || '';
            } else if (provider === 'minimax') {
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
                    body: JSON.stringify({ model:cfg.model, max_completion_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                if (data.base_resp && data.base_resp.status_code !== 0) {
                    console.error('[RimTown LLM] MiniMax API error:', data.base_resp.status_code, data.base_resp.status_msg);
                    return '__ERROR__';
                }
                const content = data.choices?.[0]?.message?.content || '';
                console.log('[RimTown LLM] MiniMax response:', res.status, '| content length:', content.length);
                return content;
            } else {
                // OpenAI-compatible (openai, deepseek, groq, together)
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
                    body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                // v5.33.2 記錄真實錯誤(HTTP 狀態 + API 訊息),測試連線時能顯示原因而非籠統「檢查金鑰」
                if (!res.ok) {
                    try { const eb = await res.json(); this._lastError = `HTTP ${res.status}${eb?.error?.message ? ': ' + eb.error.message : ''}`; }
                    catch (e2) { this._lastError = 'HTTP ' + res.status; }
                    console.error('[RimTown LLM]', provider, this._lastError);
                    // v5.33.3 Groq 快取的模型被下架 → 清快取強制重查清單,換一個模型重試一次
                    if (provider === 'groq' && res.status === 404 && !model) {
                        this._groqModelCache = null;
                        try { localStorage.removeItem('rimtown_groq_model'); } catch (e3) {}
                        const fresh = await this._resolveGroqModel(apiKey, true);
                        if (fresh && fresh !== cfg.model) return this._callProvider('groq', apiKey, fresh, prompt, maxTokens, temperature);
                    }
                    return '__ERROR__';
                }
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content || '';
                console.log('[RimTown LLM] Response:', res.status, '| content length:', content.length, '| error:', data.error?.message || 'none');
                if (data.error) { console.error('[RimTown LLM] API error:', data.error); return '__ERROR__'; }
                return content;
            }
        } catch (err) {
            console.error('[RimTown LLM] Network/fetch error:', err.message);
            return '__ERROR__';
        }
    }
}

// --- Town Map ---
const CORE_LOCATIONS = [
    ['town_square',[t('城鎮廣場'),t('中央廣場'),t('市集廣場'),t('村莊綠地')],t('聚落的核心'),'social',[15,25]],
    ['tavern',[t('鏽鶴酒館'),t('龍憩客棧'),t('金壺酒館'),t('月光酒館'),t('旅人之家')],t('飲食與社交'),'social',[10,18]],
    ['town_hall',[t('鎮公所'),t('議事廳'),t('鎮長辦公室'),t('長老會所')],t('小鎮的治理中心'),'work',[5,10]],
];
const WORK_LOCATIONS = [
    ['farm',[t('晴陽農場'),t('綠畝田園'),t('秋月農莊')],t('肥沃的農田'),'work',[4,8]],
    ['quarry',[t('深岩礦場'),t('鐵嶺礦坑'),t('石匠坑')],t('豐富的礦藏'),'work',[4,8]],
    ['workshop',[t('工匠工坊'),t('鍛造與砧'),t('修補工房')],t('製造商品之處'),'work',[5,10]],
    ['general_store',[t('雜貨店'),t('交易站'),t('商人角落')],t('交易與補給'),'work',[4,8]],
    ['clinic',[t('鎮醫院'),t('治療小屋'),t('藥房')],t('醫療照護'),'work',[3,6]],
    ['library',[t('古老圖書館'),t('學者典藏'),t('書塔')],t('知識與研究'),'work',[4,8]],
    ['guardpost',[t('守衛哨站'),t('瞭望塔'),t('民兵營房')],t('守護小鎮'),'work',[3,5]],
];
const SOCIAL_LOCATIONS = [
    ['chapel',[t('光明教堂'),t('石造神殿'),t('和諧聖壇')],t('平靜與沉思'),'social',[8,15]],
    ['park',[t('鎮公園'),t('花園'),t('日光草地')],t('寧靜的綠地'),'social',[10,18]],
    ['well',[t('鎮井'),t('泉水噴泉'),t('水車坊')],t('清澈的水源'),'social',[3,6]],
];
const RESIDENTIAL_LOCATIONS = [
    ['residential_north',[t('北區'),t('山丘住宅'),t('上城區')],t('住宅區'),'residential',[8,12]],
    ['residential_south',[t('南區'),t('河畔住宅'),t('下城區')],t('住宅區'),'residential',[8,12]],
    ['residential_east',[t('東區'),t('朝陽住宅'),t('花園區')],t('住宅區'),'residential',[8,12]],
];
const NATURE_LOCATIONS = [
    ['forest',[t('低語林'),t('幽暗松林'),t('長老樹林')],t('茂密的森林'),'nature',[6,10]],
    ['river',[t('水晶河'),t('銀溪'),t('急流溪')],t('平靜的河流'),'nature',[4,8]],
    ['hill',[t('瞭望丘'),t('風嘯嶺'),t('鷹巢峰')],t('高地'),'nature',[3,6]],
    ['cave',[t('暗影洞穴'),t('迴音岩洞'),t('舊礦坑')],t('神秘的洞穴'),'nature',[2,5]],
    ['lake',[t('鏡湖'),t('蓮花池'),t('深潭')],t('靜水'),'nature',[4,7]],
    ['meadow',[t('野花草原'),t('起伏田野'),t('三葉草坪')],t('開闊的草原'),'nature',[5,10]],
];
const TERRAIN_TYPES = [
    {name:'plains',nature_bonus:['meadow','river'],nature_remove:['cave']},
    {name:'forest',nature_bonus:['forest','cave'],nature_remove:['meadow']},
    {name:'mountain',nature_bonus:['cave','hill'],nature_remove:['lake']},
    {name:'riverside',nature_bonus:['river','lake'],nature_remove:['cave']},
    {name:'coastal',nature_bonus:['lake','hill'],nature_remove:['forest']},
];

class TownMap {
    constructor(seed = null) {
        this.locations = {};
        this.width = 800; this.height = 600;
        this.seed = seed ?? Math.floor(Math.random()*999999);
        this.terrain = 'plains';
    }
    addLocation(loc) { this.locations[loc.id] = loc; }
    toDict() {
        const locs = {};
        for (const [id, loc] of Object.entries(this.locations)) locs[id] = loc;
        return { width:this.width, height:this.height, seed:this.seed, terrain:this.terrain, locations:locs };
    }
}

function generateRandomTown(seed = null) {
    const rng = new SeededRandom(seed);
    const town = new TownMap(seed ?? rng.nextInt(0, 999999));
    const terrain = TERRAIN_TYPES[rng.nextInt(0, TERRAIN_TYPES.length-1)];
    town.terrain = terrain.name;
    const allLocs = [];
    const makeLoc = ([id, names, desc, cat, capRange]) => ({
        id, name: names[rng.nextInt(0,names.length-1)], description: desc,
        x:0, y:0, category: cat, capacity: rng.nextInt(capRange[0], capRange[1]),
    });

    CORE_LOCATIONS.forEach(l => allLocs.push(makeLoc(l)));
    const workPool = shuffle(WORK_LOCATIONS, rng);
    workPool.slice(0, rng.nextInt(4, Math.min(6, workPool.length))).forEach(l => allLocs.push(makeLoc(l)));
    const socPool = shuffle(SOCIAL_LOCATIONS, rng);
    socPool.slice(0, rng.nextInt(2, Math.min(3, socPool.length))).forEach(l => allLocs.push(makeLoc(l)));
    RESIDENTIAL_LOCATIONS.forEach(l => allLocs.push(makeLoc(l)));

    let naturePool = [...NATURE_LOCATIONS];
    const removeIds = new Set(terrain.nature_remove || []);
    naturePool = naturePool.filter(n => !removeIds.has(n[0]));
    naturePool = shuffle(naturePool, rng);
    const seen = new Set(); const uniqNature = [];
    naturePool.forEach(n => { if(!seen.has(n[0])){seen.add(n[0]);uniqNature.push(n);} });
    uniqNature.slice(0, rng.nextInt(2, Math.min(4, uniqNature.length))).forEach(l => allLocs.push(makeLoc(l)));

    placeLocations(allLocs, town.width, town.height, rng);
    allLocs.forEach(l => town.addLocation(l));
    return town;
}

function placeLocations(locations, width, height, rng) {
    const cx = width/2, cy = height/2, margin = 60;
    locations.forEach(loc => {
        if (loc.category === 'social') { loc.x = rng.nextInt(cx-150,cx+150); loc.y = rng.nextInt(cy-100,cy+100); }
        else if (loc.category === 'work') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(80,250); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
        else if (loc.category === 'residential') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(120,220); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
        else if (loc.category === 'nature') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(200,350); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
    });
    for (let iter=0;iter<50;iter++) {
        for (let i=0;i<locations.length;i++) {
            for (let j=i+1;j<locations.length;j++) {
                const a=locations[i], b=locations[j];
                const dx=b.x-a.x, dy=b.y-a.y;
                const dist = Math.max(1, Math.sqrt(dx*dx+dy*dy));
                if (dist < 90) {
                    const force=(90-dist)/2, nx=dx/dist, ny=dy/dist;
                    a.x-=Math.floor(nx*force); a.y-=Math.floor(ny*force);
                    b.x+=Math.floor(nx*force); b.y+=Math.floor(ny*force);
                }
            }
        }
    }
    locations.forEach(l => { l.x=Math.max(margin,Math.min(width-margin,l.x)); l.y=Math.max(margin,Math.min(height-margin,l.y)); });
}

// --- Event System (raids, chains, travel, immigration) ---
const EVENT_CHAINS = {
    drought_famine_riot: [
        {name:t('乾旱'),description:t('水井乾涸，作物枯萎。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('可怕的乾旱')},seasons:[t('夏季')],duration_days:3},
        {name:t('饑荒'),description:t('糧食供應嚴重不足。'),severity:'major',effects:{mood_all:-15,conversation_topic:t('惡化的饑荒')},delay_days:3,duration_days:4},
        {name:t('暴動'),description:t('絕望的居民為了物資大打出手！'),severity:'major',effects:{mood_all:-20,conversation_topic:t('暴動')},delay_days:4,duration_days:2},
    ],
    plague_quarantine_recovery: [
        {name:t('神秘疾病'),description:t('多名居民出現奇怪的病症。'),severity:'moderate',effects:{mood_all:-10,conversation_topic:t('神秘疾病')},duration_days:2},
        {name:t('隔離'),description:t('醫生下令進行隔離。'),severity:'major',effects:{mood_all:-15,conversation_topic:t('隔離措施')},delay_days:2,duration_days:3},
        {name:t('康復'),description:t('疾病已經過去！大家一起慶祝。'),severity:'minor',effects:{mood_all:15,conversation_topic:t('康復')},delay_days:3,duration_days:1},
    ],
    storm_damage_rebuild: [
        {name:t('大風暴'),description:t('可怕的風暴正在侵襲小鎮！'),severity:'major',effects:{mood_all:-12,conversation_topic:t('毀滅性的風暴')},seasons:[t('秋季'),t('冬季')],duration_days:1},
        {name:t('風暴損害'),description:t('風暴造成了嚴重的損壞。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('風暴損害')},delay_days:1,duration_days:3},
        {name:t('社區重建'),description:t('大家齊心協力重建。'),severity:'minor',effects:{mood_all:10,conversation_topic:t('重建工作')},delay_days:3,duration_days:2},
    ],
};
const RAID_POOL = [
    {name:t('盜匪來襲'),description:t('一群盜匪正在逼近！'),severity:'major',threat_level:3,attacker:t('盜匪'),effects:{mood_all:-15,conversation_topic:t('盜匪襲擊')}},
    {name:t('野獸攻擊'),description:t('一群狼從山上下來了！'),severity:'moderate',threat_level:2,attacker:t('狼群'),effects:{mood_all:-10,conversation_topic:t('狼群攻擊')}},
    {name:t('掠奪者入侵'),description:t('武裝掠奪者正在襲擊！'),severity:'major',threat_level:4,attacker:t('掠奪者'),effects:{mood_all:-18,conversation_topic:t('掠奪者')}},
    {name:t('野豬暴走'),description:t('暴怒的野豬衝進鎮上！'),severity:'moderate',threat_level:2,attacker:t('野豬'),effects:{mood_all:-8,conversation_topic:t('野豬暴走')}},
];
const EVENT_POOL = [
    {name:t('豐收'),description:t('作物長得特別好！'),severity:'minor',effects:{mood_all:5},seasons:[t('春季'),t('夏季')]},
    {name:t('寒流'),description:t('突如其來的寒流襲擊小鎮。'),severity:'moderate',effects:{mood_all:-10},seasons:[t('冬季'),t('秋季')]},
    {name:t('慶典日'),description:t('小鎮舉辦慶典！大家一起慶祝。'),severity:'minor',effects:{mood_all:15}},
    {name:t('物資短缺'),description:t('貿易路線中斷，物資不足。'),severity:'moderate',effects:{mood_all:-5}},
    {name:t('奇異光芒'),description:t('天空出現奇怪的光。'),severity:'minor',effects:{mood_all:-3,conversation_topic:t('奇異光芒')}},
    {name:t('旅行商人'),description:t('一位商人帶著稀有貨物到來。'),severity:'minor',effects:{mood_all:5,conversation_topic:t('商人的異國貨品')}},
    {name:t('美麗極光'),description:t('壯麗的極光照亮夜空。'),severity:'minor',effects:{mood_all:10},seasons:[t('冬季')]},
    {name:t('熱浪'),description:t('酷熱讓戶外工作難以忍受。'),severity:'moderate',effects:{mood_all:-8},seasons:[t('夏季')]},
    {name:t('幸運發現'),description:t('有人發現了珍貴的材料！'),severity:'minor',effects:{mood_all:8,conversation_topic:t('幸運的發現')}},
    {name:t('觀星之夜'),description:t('今晚的星空特別清澈，許多居民出門看星星。'),severity:'minor',effects:{mood_all:8,conversation_topic:t('美麗的星空')},night_event:true},
    {name:t('月蝕'),description:t('罕見的月蝕！月亮變成了血紅色。'),severity:'minor',effects:{mood_all:-3,conversation_topic:t('血色月蝕')},night_event:true},
    {name:t('螢火蟲之夜'),description:t('成千上萬的螢火蟲在鎮上飛舞！'),severity:'minor',effects:{mood_all:12,conversation_topic:t('螢火蟲奇觀')},seasons:[t('夏季'),t('春季')],night_event:true},
    {name:t('夜間竊盜'),description:t('有人趁夜偷走了倉庫的物資。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('神秘竊賊')},night_event:true},
    {name:t('極光出現'),description:t('天空中出現了壯麗的極光！'),severity:'minor',effects:{mood_all:15,conversation_topic:t('不可思議的極光')},seasons:[t('冬季'),t('秋季')],night_event:true},
    {name:t('夜半歌聲'),description:t('深夜從森林傳來神秘的歌聲。'),severity:'minor',effects:{mood_all:-2,conversation_topic:t('森林裡的歌聲')},night_event:true},
];
const DEPARTURE_REASONS = [
    t('決定出發去進行貿易遠征'),t('離開去城裡探望家人'),t('踏上朝聖之旅'),
    t('出發去探索荒野'),t('離開去遠方的學院進修'),
    t('前往首都尋求發展'),t('出門旅行增廣見聞'),
];
const IMMIGRANT_POOL = [
    {name:t('周明'),age:27,gender:'male',traits:['hardworking','optimist'],job:'farmer',background:t('來自鄰村的開朗年輕農夫。')},
    {name:t('李雪'),age:31,gender:'female',traits:['kind','perfectionist'],job:'tailor',background:t('聽說邊境鎮需要她的手藝的熟練裁縫。')},
    {name:t('鄭強'),age:35,gender:'male',traits:['stoic','hardworking'],job:'miner',background:t('來自本地區的資深礦工。')},
    {name:t('何芳'),age:24,gender:'female',traits:['charismatic','romantic'],job:'cook',background:t('懷抱遠大夢想的熱情廚師。')},
    {name:t('蔡文'),age:42,gender:'male',traits:['creative','neurotic'],job:'researcher',background:t('被古代遺跡吸引而來的古怪學者。')},
    {name:t('呂嵐'),age:29,gender:'female',traits:['shy','early_bird'],job:'carpenter',background:t('讓手藝說話的沉靜木匠。')},
    {name:t('丁傑'),age:38,gender:'male',traits:['abrasive','hardworking'],job:'blacksmith',background:t('言語粗獷但手藝精湛的鐵匠。')},
    {name:t('蕭瑜'),age:23,gender:'female',traits:['optimist','gossip'],job:'trader',background:t('善於議價的年輕商人。')},
    {name:t('唐琳'),age:33,gender:'female',traits:['kind','night_owl'],job:'doctor',background:t('四處行醫的慈悲醫者。')},
    {name:t('曹峰'),age:44,gender:'male',traits:['stoic','pessimist'],job:'guard',background:t('尋求平靜生活的資深戰士。')},
    {name:t('邱雅'),age:21,gender:'female',traits:['creative','shy'],job:'tailor',background:t('擁有刺繡天賦的年輕工匠。')},
    {name:t('范浩'),age:36,gender:'male',traits:['lazy','charismatic'],job:'priest',background:t('悠哉的精神導師。')},
];

class EventSystem {
    constructor() {
        this.eventLog = []; this.activeEffects = {}; this.conversationTopics = [];
        this._activeChains = []; this._travellingAgents = [];
        this._daysSinceRaid = 5; this._daysSinceChain = 5; this._daysSinceDeparture = 3;
        this._usedImmigrantNames = new Set();
        this.TARGET_POPULATION = 12;
    }
    dailyUpdate(world) {
        this._daysSinceRaid++; this._daysSinceChain++; this._daysSinceDeparture++;
        this._progressChains(world);
        this._checkReturningTravellers(world);
        const event = this._rollDailyEvent(world);
        this._managePopulation(world);
        return event;
    }
    _rollDailyEvent(world) {
        const roll = Math.random();
        // News modifiers affect event probabilities
        const nm = world.news ? world.news : {getModifier:(k,d)=>d};
        // 聲望事件護盾:高聲望降低負面事件(襲擊/事件鏈)機率
        const eventShield = world.reputationSystem ? world.reputationSystem.getModifier('event_shield') : 0;
        const raidChance = Math.max(0, Math.min(0.5, (0.10 + nm.getModifier('raid_chance', 0)) * (1 - eventShield)));
        const chainChance = Math.max(0, Math.min(0.4, (0.08 + nm.getModifier('chain_chance', 0)) * (1 - eventShield)));
        const festivalBoost = nm.getModifier('festival_chance', 0);
        const departureBoost = nm.getModifier('departure_chance', 0);

        if (roll < raidChance && this._daysSinceRaid >= 5) return this._triggerRaid(world);
        if (roll < raidChance + chainChance && this._daysSinceChain >= 7 && !this._activeChains.length) return this._startEventChain(world);
        if (roll < 0.38 + festivalBoost) return this._triggerRandomEvent(world);
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        if (roll < 0.43 + departureBoost && this._daysSinceDeparture >= 4 && npcCount > this.TARGET_POPULATION) this._triggerDeparture(world);
        return null;
    }
    _triggerRandomEvent(world) {
        const season = world.clock.season;
        let eligible = EVENT_POOL.filter(e => !e.seasons || e.seasons.includes(season));
        if (!eligible.length) return null;
        // News can boost festival/specific events
        const nm = world.news ? world.news : {getModifier:(k,d)=>d};
        const festivalBoost = nm.getModifier('festival_chance', 0);
        if (festivalBoost > 0.2) {
            const festival = eligible.find(e => e.name === t('慶典日'));
            if (festival && Math.random() < festivalBoost) {
                const event = {name:festival.name,description:festival.description,severity:festival.severity,effects:festival.effects||{},event_type:'random'};
                this.eventLog.push([world.clock.timeStr, event]);
                this._applyEffects(event, world);
                return event;
            }
        }
        // Drought/storm boost from news
        const droughtChance = nm.getModifier('drought_chance', 0);
        if (droughtChance > 0 && Math.random() < droughtChance && !this._activeChains.length) {
            return this._startEventChain(world, 'drought_famine_riot');
        }
        const stormChance = nm.getModifier('storm_chance', 0);
        if (stormChance > 0 && Math.random() < stormChance && !this._activeChains.length) {
            return this._startEventChain(world, 'storm_damage_rebuild');
        }
        const plagueChance = nm.getModifier('plague_chance', 0);
        if (plagueChance > 0 && Math.random() < plagueChance && !this._activeChains.length) {
            return this._startEventChain(world, 'plague_quarantine_recovery');
        }
        const ed = pickRandom(eligible);
        const event = {name:ed.name,description:ed.description,severity:ed.severity,effects:ed.effects||{},event_type:'random'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        return event;
    }
    _triggerRaid(world) {
        this._daysSinceRaid = 0;
        const rd = pickRandom(RAID_POOL);
        const event = {name:rd.name,description:rd.description,severity:rd.severity,effects:rd.effects||{},event_type:'raid'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        const guards = Object.values(world.agents).filter(a => a.job?.key==='guard' && !a.isPlayer);
        const buildingDefense = world.buildings ? (world.buildings.getEffect('defense_bonus',0)||0) : 0;
        const defense = guards.length * 2 + randInt(1,3) + buildingDefense;
        if (defense >= rd.threat_level) {
            world.logMessage('raid', `${t('小鎮成功抵禦了')}${rd.attacker}${t('！')}`);
            if (world.questSystem) world.questSystem.onRaidSurvived();
            guards.forEach(g => { g.moodModifier = (g.moodModifier || 0) + 10; g.memory.add(world.tickCount, world.clock.timeStr,'raid',`${t('協助抵禦了')}${rd.attacker}${t('！')}`,8); });
        } else {
            world.logMessage('raid', `${rd.attacker}${t('突破了我們的防線！')}`);
            if (world.stockpile) {
                const stolenFood = Math.min(world.stockpile.get('food'), randInt(10,30));
                const stolenSilver = Math.min(world.stockpile.get('silver'), randInt(5,20));
                if(stolenFood>0) world.stockpile.consume('food',stolenFood,world.tickCount,`${t('被')}${rd.attacker}${t('搶走')}`);
                if(stolenSilver>0) world.stockpile.consume('silver',stolenSilver,world.tickCount,`${t('被')}${rd.attacker}${t('搶走')}`);
                world.logMessage('raid',`${rd.attacker}${t('搶走了')}${stolenFood}${t('食物和')}${stolenSilver}${t('銀幣！')}`);
            }
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.job?.key !== 'guard');
            if (npcs.length && Math.random() < 0.4) {
                const fleeing = pickRandom(npcs);
                this._sendAgentTravelling(world, fleeing, `${t('在')}${rd.attacker}${t('襲擊後逃離')}`, 3);
            }
        }
        return event;
    }
    _startEventChain(world, forceChainId = null) {
        let chainId, stages;
        if (forceChainId && EVENT_CHAINS[forceChainId]) {
            chainId = forceChainId; stages = EVENT_CHAINS[forceChainId];
        } else {
            const season = world.clock.season;
            const eligible = Object.entries(EVENT_CHAINS).filter(([,s]) => {
                const first = s[0]; return !first.seasons || first.seasons.includes(season);
            });
            if (!eligible.length) return null;
            [chainId, stages] = pickRandom(eligible);
        }
        this._daysSinceChain = 0;
        this._activeChains.push({chainId, stage:0, daysUntilNext: stages[0].duration_days||2});
        const first = stages[0];
        const event = {name:first.name,description:first.description,severity:first.severity,effects:first.effects||{},event_type:'chain'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        world.logMessage('chain_event', `${t('事件鏈開始：')}${first.name}`);
        return event;
    }
    _progressChains(world) {
        const completed = [];
        this._activeChains.forEach(chain => {
            chain.daysUntilNext--;
            if (chain.daysUntilNext <= 0) {
                const stages = EVENT_CHAINS[chain.chainId];
                const nextIdx = chain.stage + 1;
                if (nextIdx >= stages.length) { completed.push(chain); world.logMessage('chain_event',`${t('事件鏈「')}${chain.chainId}${t('」已結束。')}`); }
                else {
                    const stage = stages[nextIdx];
                    chain.stage = nextIdx; chain.daysUntilNext = stage.duration_days || 2;
                    const event = {name:stage.name,description:stage.description,severity:stage.severity,effects:stage.effects||{},event_type:'chain'};
                    this.eventLog.push([world.clock.timeStr, event]);
                    this._applyEffects(event, world);
                    world.logMessage('chain_event', `[${event.severity.toUpperCase()}] ${event.name}${t('：')}${event.description}`);
                }
            }
        });
        completed.forEach(c => { this._activeChains = this._activeChains.filter(x=>x!==c); });
    }
    _triggerDeparture(world) {
        this._daysSinceDeparture = 0;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (!npcs.length) return;
        const traveller = pickRandom(npcs);
        this._sendAgentTravelling(world, traveller, pickRandom(DEPARTURE_REASONS), randInt(3,7));
    }
    _sendAgentTravelling(world, agent, reason, travelDays) {
        const data = { agentId:agent.agentId, name:agent.name, age:agent.age, jobKey:agent.job?.key,
            traits:agent.personality.traits, values:agent.personality.values, background:agent.personality.background,
            homeLocation:agent.homeLocation, gender:agent.gender,
            skills:agent.skills.toDict(), relationships:agent.relationships.toDict(),
            memories:agent.memory.toDict(), mood:agent.mood, moodModifier:agent.moodModifier||0 };
        this._travellingAgents.push({agentData:data, returnTick:world.tickCount+(travelDays*96), reason});
        world.logMessage('departure', `${agent.name}${reason}。${t('過幾天就會回來。')}`, agent.name);
        const event = {name:t('居民出行'),description:`${agent.name}${reason}。`,severity:'minor',effects:{conversation_topic:`${agent.name}${t('離開了小鎮')}`},event_type:'departure'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${agent.name}${t('離開了小鎮')}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'departure',`${agent.name}${reason}。`,5,[agent.name]);
        });
        delete world.agents[agent.agentId];
    }
    _checkReturningTravellers(world) {
        const returned = this._travellingAgents.filter(t => world.tickCount >= t.returnTick);
        returned.forEach(travel => {
            this._travellingAgents = this._travellingAgents.filter(t => t !== travel);
            this._returnAgent(world, travel);
        });
    }
    _returnAgent(world, travel) {
        const d = travel.agentData;
        const personality = new Personality(d.traits, d.background || '', d.values || []);
        const job = d.jobKey ? new Job(d.jobKey) : null;
        const agent = new Agent(d.agentId, d.name, d.age, personality, job, d.homeLocation || 'residential_north');
        if (d.gender) agent.gender = d.gender;
        agent.mood = d.mood ?? agent.mood;
        agent.moodModifier = d.moodModifier || 0;
        // Restore skills
        if (d.skills) {
            for (const [sk,sv] of Object.entries(d.skills)) {
                const s = agent.skills.get(sk);
                if (s && sv) { s.xp = sv.xp; s.passion = sv.passion; }
            }
        }
        // Restore relationships
        if (d.relationships) {
            for (const [rid,rd] of Object.entries(d.relationships)) {
                const r = agent.relationships.getOrCreate(rid, rd.name || rid);
                Object.assign(r, { affinity:rd.affinity||0, trust:rd.trust||0, romanticInterest:rd.romanticInterest||0,
                    interactionCount:rd.interactionCount||0, status:rd.status||null, statusSince:rd.statusSince||0 });
            }
        }
        // Restore memories
        if (d.memories && Array.isArray(d.memories)) {
            d.memories.forEach(m => agent.memory.add(m.tick, m.time, m.category, m.content ?? m.text ?? '', m.importance, m.related_agents || m.relatedAgents || []));
        }
        world.agents[agent.agentId] = agent;
        world.logMessage('arrival', `${agent.name}${t('旅行歸來了！')}`, agent.name);
        const event = {name:t('居民歸來'),description:`${agent.name}${t('帶著故事回來了！')}`,severity:'minor',effects:{mood_all:3,conversation_topic:`${agent.name}${t('的旅行故事')}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'arrival',`${agent.name}${t('旅行回來了！')}`,4,[agent.name]);
        });
    }
    _managePopulation(world) {
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const total = npcCount + this._travellingAgents.length;
        const repImmigration = world.reputationSystem ? world.reputationSystem.getModifier('immigration_bonus') : 0;
        const immigrationBoost = (world.news ? world.news.getModifier('immigration_chance', 0) : 0) + repImmigration;
        if (total < this.TARGET_POPULATION) {
            for (let i = 0; i < this.TARGET_POPULATION - total; i++) this._spawnImmigrant(world);
        } else if (immigrationBoost > 0 && Math.random() < immigrationBoost && total < this.TARGET_POPULATION + 3) {
            this._spawnImmigrant(world);
        }
    }
    _spawnImmigrant(world) {
        let available = IMMIGRANT_POOL.filter(p => !this._usedImmigrantNames.has(p.name));
        if (!available.length) { this._usedImmigrantNames.clear(); available = [...IMMIGRANT_POOL]; }
        // v5.19.0 城鎮身分:成形的路線會吸引「氣味相投」的移民(依職業軸加權挑選)
        let imm;
        const routeAxis = world.townIdentity?.routeAxis?.();
        if (routeAxis && Math.random() < 0.7) {
            const weights = available.map(p => JOB_AXIS[p.job] === routeAxis ? 4 : 1);
            imm = weightedChoice(available, weights);
        }
        if (!imm) imm = pickRandom(available);
        this._usedImmigrantNames.add(imm.name);
        const id = `imm_${imm.name}_${world.tickCount}`;
        const personality = new Personality(imm.traits, imm.background);
        personality.values = shuffle([t('家庭'),t('自由'),t('知識'),t('財富'),t('權力'),t('藝術'),t('自然'),t('社群'),t('冒險'),t('和平')]).slice(0, 1+Math.floor(Math.random()*3));
        const job = new Job(imm.job);
        const home = pickRandom(['residential_north','residential_south','residential_east']);
        const agent = new Agent(id, imm.name, imm.age, personality, job, home, imm.gender);
        world.agents[agent.agentId] = agent;
        // 聲望效果:高聲望的鎮長讓新居民帶著初始信任到來
        const initTrust = world.reputationSystem ? world.reputationSystem.getModifier('npc_initial_trust') : 0;
        if (initTrust > 0) {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (player) {
                const rel = agent.relationships.getOrCreate(player.agentId, player.name);
                rel.trust += initTrust;
                rel.affinity += Math.round(initTrust / 2);
            }
        }
        world.logMessage('immigration', `${t('新居民到來：')}${agent.name}${t('，')}${job.title}${t('！')}`, agent.name);
        const event = {name:t('新居民'),description:`${agent.name}${t('以')}${job.title}${t('身分到來！')}`,severity:'minor',effects:{mood_all:5,conversation_topic:`${t('新居民')}${agent.name}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${t('新居民')}${agent.name}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'immigration',`${t('新居民')}${agent.name}${t('到來了！')}`,5,[agent.name]);
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${t('新居民')}${agent.name}${t('以')}${job.title}${t('身分來到鎮上！')}`, 6, [agent.name]);
    }
    _applyEffects(event, world) {
        if (event.effects.conversation_topic) {
            this.conversationTopics.push(event.effects.conversation_topic);
            this.conversationTopics = this.conversationTopics.slice(-5);
        }
        if (event.effects.mood_all != null) this.activeEffects.mood_modifier = event.effects.mood_all;
    }
    getRecentEvents(n=10) { return this.eventLog.slice(-n); }
    getGossipTopics() {
        const topics = [...this.conversationTopics];
        this.eventLog.slice(-3).forEach(([,e]) => topics.push(e.description));
        return topics;
    }
    getTravellingAgents() { return this._travellingAgents.map(t => ({agentId:t.agentData.agentId,name:t.agentData.name,reason:t.reason,return_tick:t.returnTick})); }
    getActiveChains() {
        return this._activeChains.map(c => {
            const stages = EVENT_CHAINS[c.chainId]; const cur = stages[c.stage];
            return {chain:c.chainId, current_event:cur.name, stage:c.stage+1, total_stages:stages.length};
        });
    }
}

// --- Election System ---
// 選舉制度：每個居民根據自身個性、價值觀、關係來投票選出鎮長
const ELECTION_POLICIES = [
    { id:'economy',    label:t('經濟發展'), icon:'💰', values:[t('財富'),t('冒險')],     traits:['hardworking','perfectionist'] },
    { id:'welfare',    label:t('社會福利'), icon:'🤝', values:[t('家庭'),t('社群'),t('和平')], traits:['kind','optimist'] },
    { id:'defense',    label:t('軍事防禦'), icon:'🛡️', values:[t('權力'),t('冒險')],      traits:['stoic','hardworking'] },
    { id:'culture',    label:t('文化教育'), icon:'📚', values:[t('知識'),t('藝術')],      traits:['creative','perfectionist'] },
    { id:'nature',     label:t('自然保育'), icon:'🌿', values:[t('自然'),t('和平')],      traits:['ascetic','romantic'] },
    { id:'freedom',    label:t('個人自由'), icon:'🕊️', values:[t('自由'),t('冒險')],      traits:['creative','night_owl'] },
];

class ElectionSystem {
    constructor() {
        this.active = false;
        this.phase = 'none';
        this.candidates = [];
        this.votes = {};
        this.campaignDaysLeft = 0;
        this.votingDaysLeft = 0;
        this.resultsDaysLeft = 0;
        this.lastElectionDay = 0;
        this.electionHistory = [];
        this._electionCooldown = 60;
    }

    dailyUpdate(world) {
        const day = world.clock.day + (world.clock.year - 1) * 60;
        if (this.phase === 'campaign') {
            this.campaignDaysLeft--;
            if (this.campaignDaysLeft <= 0) this._startVoting(world);
            return null;
        }
        if (this.phase === 'voting') {
            this.votingDaysLeft--;
            this._processVotes(world);
            if (this.votingDaysLeft <= 0) return this._announceResults(world);
            return null;
        }
        if (this.phase === 'results') {
            this.resultsDaysLeft--;
            if (this.resultsDaysLeft <= 0) { this.phase = 'none'; this.active = false; }
            return null;
        }
        // v5.30.1 固定每年秋季第 1 天開選(競選3天→投票2天→公布);防止同年重複
        if (!this.active && world.clock.season === '秋季' && world.clock.day === 1
            && (day - this.lastElectionDay) >= 20) {
            this._startElection(world);
        }
        return null;
    }

    triggerElection(world) { if (this.active) return; this._startElection(world); }

    // v5.38.0 旅人參選鎮長 ----------------------------------------------------
    // 參選資格:第二章(繁榮 20)起,且至少 3 位村民好感 ≥ 40(有人願意聯署)
    playerEligibility(world) {
        const player = world.agents['player'];
        if (!player) return { ok: false, msg: '' };
        if ((world.prosperity?.prosperity || 0) < 20) return { ok: false, msg: t('小鎮還不夠認識你——進入第二章(小鎮成長 20)後才能參選。') };
        const backers = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && (a.relationships?.relationships?.['player']?.affinity || 0) >= 40);
        if (backers.length < 3) return { ok: false, msg: `${t('參選需要 3 位好感 40 以上的村民聯署(目前')} ${backers.length}/3${t(')。先去多交幾個朋友吧!')}` };
        return { ok: true, backers };
    }

    registerPlayerCandidate(world, policyId) {
        if (!this.active || this.phase !== 'campaign') return { ok: false, msg: t('現在不是競選登記期間(每年秋季第 1 天開選,登記期 3 天)。') };
        if (this.candidates.some(c => c.agentId === 'player')) return { ok: false, msg: t('你已經登記參選了。') };
        const elig = this.playerEligibility(world);
        if (!elig.ok) return elig;
        const player = world.agents['player'];
        const policy = ELECTION_POLICIES.find(p => p.id === policyId) || ELECTION_POLICIES[1];
        this.candidates.push({ agentId: 'player', name: player.name, policy: policy.id, policyLabel: policy.label, policyIcon: policy.icon, votes: 0, speech: `${t('我雖是旅人,但這裡早已是我的家。我主張')}${policy.label}${t(',請把你的一票交給我!')}`, isPlayer: true });
        this.playerCanvassed = {};
        world.logMessage('event', `📢 ${t('旅人')} ${player.name} ${t('宣布參選鎮長!主張')}${policy.icon}${policy.label}`);
        player.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我登記參選鎮長,主張')}${policy.label}${t('。聯署的朋友們都在為我加油。')}`, 9, []);
        // 全鎮都會知道旅人出馬了——寫進每個人的記憶流,之後的對話會自然聊到
        Object.values(world.agents).forEach(a => {
            if (a.isPlayer || a.isDead) return;
            a.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('鎮上的旅人')}${player.name}${t('宣布參選鎮長,主張')}${policy.label}`, 6, [player.name]);
        });
        if (world.dailyNews) world.dailyNews.collectEvent('politics', `${t('旅人')}${player.name}${t('投入鎮長選戰,主張')}${policy.label}`, 9, [player.name]);
        return { ok: true };
    }

    // 拉票:每位村民每屆一次;由聊天「說服」意圖觸發
    canvassNpc(world, npc) {
        if (!this.candidates.some(c => c.agentId === 'player')) return { ok: false };
        if (this.phase !== 'campaign' && this.phase !== 'voting') return { ok: false };
        this.playerCanvassed = this.playerCanvassed || {};
        if (this.playerCanvassed[npc.agentId]) return { ok: false, dup: true };
        this.playerCanvassed[npc.agentId] = true;
        const me = this.candidates.find(c => c.agentId === 'player');
        npc.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${world.agents['player']?.name || t('旅人')}${t('親自來拉票,認真談了他對')}${me?.policyLabel || ''}${t('的想法')}`, 5, []);
        return { ok: true };
    }

    _startElection(world) {
        const eligible = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        if (eligible.length < 2) return;
        this.active = true; this.phase = 'campaign'; this.campaignDaysLeft = 3; this.votingDaysLeft = 0; this.votes = {};
        const scored = eligible.map(a => {
            let score = (a.skills?.skills?.社交?.level || 0) * 2;
            score += (a.personality.socialModifier || 0) * 3;
            score += (a.mood + 50) / 20;
            if (a.personality.traits.includes('charismatic')) score += 8;
            if (a.personality.traits.includes('shy')) score -= 5;
            if (a.job?.key === 'mayor') score += 5;
            score += Math.random() * 6;
            return { agent: a, score };
        }).sort((a, b) => b.score - a.score);
        const numCandidates = Math.min(eligible.length, 2 + (eligible.length >= 8 ? 1 : 0) + (eligible.length >= 12 ? 1 : 0));
        this.candidates = scored.slice(0, numCandidates).map(({ agent }) => {
            const policy = this._pickPolicy(agent);
            return { agentId: agent.agentId, name: agent.name, policy: policy.id, policyLabel: policy.label, policyIcon: policy.icon, votes: 0, speech: this._generateSpeech(agent, policy) };
        });
        world.logMessage('event', `📢 ${t('選舉開始！')}${this.candidates.map(c => c.name).join(t('、'))} ${t('宣布參選鎮長')}`);
        world.logMessage('event', `📋 ${t('競選期間為')} ${this.campaignDaysLeft} ${t('天，之後進行投票')}`);
        this.candidates.forEach(c => {
            const agent = world.agents[c.agentId];
            if (agent?.memory) agent.memory.add(world.tickCount, world.clock.timeStr, 'election', `${t('我宣布參選鎮長，主張')}${c.policyLabel}`, 8, []);
        });
    }

    _pickPolicy(agent) {
        let best = ELECTION_POLICIES[0], bestScore = -Infinity;
        for (const policy of ELECTION_POLICIES) {
            let score = 0;
            for (const v of agent.personality.values) { if (policy.values.includes(v)) score += 3; }
            for (const t of agent.personality.traits) { if (policy.traits.includes(t)) score += 2; }
            score += Math.random() * 1.5;
            if (score > bestScore) { bestScore = score; best = policy; }
        }
        return best;
    }

    _generateSpeech(agent, policy) {
        const speeches = {
            economy: [`${t('身為')}${agent.name}${t('，我承諾帶領邊境鎮走向繁榮！')}`, `${t('我會讓每個人都能豐衣足食！')}`, `${t('加強貿易、開拓資源，讓鎮民富裕起來！')}`],
            welfare: [`${t('我會照顧好每一位居民！')}`, `${t('社區的和諧是我最重視的事。')}`, `${t('讓大家都能安居樂業！')}`],
            defense: [`${t('我會讓邊境鎮固若金湯！')}`, `${t('加強防禦，不再讓突襲得逞！')}`, `${t('保護家園是我的首要任務！')}`],
            culture: [`${t('教育和文化才是小鎮的未來！')}`, `${t('我要建立學院，讓知識傳承下去。')}`, `${t('藝術與智慧將使我們偉大！')}`],
            nature:  [`${t('我們必須與自然和諧共處。')}`, `${t('永續發展才是正道！')}`, `${t('保護環境就是保護我們自己。')}`],
            freedom: [`${t('每個人都應該有選擇的自由！')}`, `${t('減少管束，讓大家自由發展。')}`, `${t('尊重個人，成就集體！')}`],
        };
        return pickRandom(speeches[policy.id] || speeches.economy);
    }

    _startVoting(world) { this.phase = 'voting'; this.votingDaysLeft = 2; this.votes = {}; world.logMessage('event', `🗳️ ${t('投票開始！居民們正在投下神聖的一票')}`); }

    _processVotes(world) {
        const voters = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !this.votes[a.agentId] && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        for (const voter of voters) {
            if (Math.random() > 0.6) continue;
            const chosen = this._calculateVote(voter, world);
            if (chosen) { this.votes[voter.agentId] = chosen.agentId; chosen.votes++; }
        }
    }

    _calculateVote(voter, world) {
        if (!this.candidates.length) return null;
        const scores = this.candidates.map(c => {
            let score = 0;
            const candidate = world.agents[c.agentId];
            if (!candidate) return { candidate: c, score: 0 };
            const rel = voter.relationships?.relationships?.[c.agentId];
            if (rel) { score += (rel.affinity / 100) * 40; score += (rel.trust / 100) * 10; }
            const policy = ELECTION_POLICIES.find(p => p.id === c.policy);
            if (policy) { for (const v of voter.personality.values) { if (policy.values.includes(v)) score += 10; } }
            if (candidate.personality.traits.includes('charismatic')) score += 8;
            if (candidate.personality.traits.includes('kind')) score += 4;
            if (candidate.personality.traits.includes('abrasive')) score -= 6;
            if (candidate.personality.traits.includes('lazy')) score -= 4;
            score += (candidate.skills?.skills?.社交?.level || 0) * 1;
            score += (Math.random() - 0.3) * 10;
            if (voter.personality.traits.includes('pessimist') && c.policy === 'defense') score += 3;
            if (voter.personality.traits.includes('optimist') && c.policy === 'welfare') score += 3;
            if (voter.personality.traits.includes('creative') && c.policy === 'culture') score += 3;
            if (voter.personality.traits.includes('hardworking') && c.policy === 'economy') score += 3;
            if (voter.personality.traits.includes('ascetic') && c.policy === 'nature') score += 3;
            // v5.38.0 玩家候選人:聲望與親自拉票會左右選情;旅人資歷淺,起步略居劣勢
            if (c.agentId === 'player') {
                score -= 6;
                score += Math.max(-10, Math.min(15, (world.reputationSystem?.reputation || 0) / 15));
                if (this.playerCanvassed?.[voter.agentId]) score += 8;
            }
            return { candidate: c, score };
        });
        scores.sort((a, b) => b.score - a.score);
        return scores[0]?.candidate || null;
    }

    _announceResults(world) {
        const remaining = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !this.votes[a.agentId] && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        for (const voter of remaining) { const chosen = this._calculateVote(voter, world); if (chosen) { this.votes[voter.agentId] = chosen.agentId; chosen.votes++; } }
        this.candidates.sort((a, b) => b.votes - a.votes);
        const winner = this.candidates[0];
        const totalVotes = this.candidates.reduce((s, c) => s + c.votes, 0);
        if (!winner) { this.phase = 'none'; this.active = false; return null; }
        const oldMayor = Object.values(world.agents).find(a => a.job?.key === 'mayor' && a.agentId !== winner.agentId);
        const newMayorAgent = world.agents[winner.agentId];
        if (oldMayor && oldMayor.agentId !== winner.agentId) {
            const fallbackJobs = ['farmer','guard','trader','researcher'];
            const newJobKey = fallbackJobs[Math.floor(Math.random() * fallbackJobs.length)];
            oldMayor.job = JOB_DEFINITIONS[newJobKey] ? new Job(newJobKey) : null;
            oldMayor.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我在選舉中落敗，不再擔任鎮長')}`, 9, [winner.name]);
        }
        if (newMayorAgent) {
            newMayorAgent.job = new Job('mayor');
            newMayorAgent.moodModifier = (newMayorAgent.moodModifier || 0) + 20;
            newMayorAgent.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我贏得了鎮長選舉！得到')} ${winner.votes} ${t('票')}`, 10, []);
        }
        const resultMsg = this.candidates.map(c => `${c.name}${t('（')}${c.policyIcon}${c.policyLabel}${t('）：')}${c.votes} ${t('票')}`).join(t('、'));
        world.logMessage('event', `🏆 ${t('選舉結果：')}${winner.name} ${t('當選新鎮長！主張：')}${winner.policyIcon}${winner.policyLabel}`);
        world.logMessage('event', `📊 ${t('得票：')}${resultMsg}${t('（共')} ${totalVotes} ${t('票）')}`);
        if (world.questSystem) world.questSystem.onElection();
        this._applyPolicyEffects(winner.policy, world);
        const day = world.clock.day + (world.clock.year - 1) * 60;
        this.lastElectionDay = day;
        this.electionHistory.push({ day, year: world.clock.year, season: world.clock.season, winner: { agentId: winner.agentId, name: winner.name, policy: winner.policy, votes: winner.votes }, candidates: this.candidates.map(c => ({ agentId: c.agentId, name: c.name, policy: c.policy, votes: c.votes })), totalVotes });
        Object.values(world.agents).forEach(a => {
            if (a.isPlayer) return;
            const votedFor = this.votes[a.agentId];
            if (votedFor === winner.agentId) a.moodModifier = (a.moodModifier || 0) + 8;
            else if (votedFor) a.moodModifier = (a.moodModifier || 0) - 3;
        });
        // v5.38.0 玩家參選的結局
        const playerCand = this.candidates.find(c => c.agentId === 'player');
        if (playerCand) {
            const playerA = world.agents['player'];
            if (winner.agentId === 'player') {
                world.logMessage('event', `👑 ${t('你當選鎮長了!從今天起,全鎮大小事都等你拿主意。')}`);
                playerA?.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我贏得鎮長選舉(')}${playerCand.votes}${t('票),旅人成了邊境鎮的鎮長!')}`, 10, []);
            } else {
                world.logMessage('event', `🗳️ ${t('你以')} ${playerCand.votes} ${t('票落選,雖敗猶榮——村民記住了你的名字,下屆秋季再來!')}`);
                playerA?.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我在鎮長選舉中落敗(')}${playerCand.votes}${t('票)。')}${winner.name}${t('當選了,但我不會就此放棄。')}`, 8, [winner.name]);
            }
        }
        this.playerCanvassed = {};
        this.phase = 'results'; this.resultsDaysLeft = 3;
        return { name: t('鎮長選舉'), description: `${winner.name} ${t('以')} ${winner.votes}/${totalVotes} ${t('票當選新鎮長')}`, severity: 'major', event_type: 'election', effects: {} };
    }

    _applyPolicyEffects(policyId, world) {
        const effects = {
            economy: { headline:t('新鎮長推動經濟改革'), modifiers:{farm_bonus:0.15, trade_bonus:0.1}, severity:'good' },
            welfare: { headline:t('新鎮長推行社會福利'), modifiers:{mood_modifier:5, immigration_chance:0.1}, severity:'good' },
            defense: { headline:t('新鎮長加強防禦部署'), modifiers:{raid_chance:-0.05, guard_bonus:0.2}, severity:'info' },
            culture: { headline:t('新鎮長重視文化教育'), modifiers:{research_bonus:0.2, skill_bonus:0.1}, severity:'info' },
            nature:  { headline:t('新鎮長推動自然保育'), modifiers:{gathering_bonus:0.2, mood_modifier:3}, severity:'good' },
            freedom: { headline:t('新鎮長放寬政策管制'), modifiers:{mood_modifier:3, immigration_chance:0.15}, severity:'info' },
        };
        const effect = effects[policyId];
        if (effect && world.news) {
            world.news.bulletins.push({ id: 'election_policy_' + Date.now(), headline: effect.headline, headline_en: '', category: t('政治'), severity: effect.severity, flavor: `${this.candidates[0]?.name || t('新鎮長')}${t('的施政方針開始影響小鎮')}`, modifiers: effect.modifiers, publishedDay: world.clock.day, expiresDay: world.clock.day + 30, daysRemaining: 30 });
            world.news._rebuildModifiers(world.clock.day + (world.clock.year - 1) * 60);
        }
    }

    toDict() {
        return { active: this.active, phase: this.phase, candidates: this.candidates.map(c => ({...c})), votes: {...this.votes}, campaignDaysLeft: this.campaignDaysLeft, votingDaysLeft: this.votingDaysLeft, resultsDaysLeft: this.resultsDaysLeft, lastElectionDay: this.lastElectionDay, electionHistory: this.electionHistory.slice(-10), playerCanvassed: { ...(this.playerCanvassed || {}) } };
    }

    loadFrom(data) {
        if (!data) return;
        this.active = data.active || false; this.phase = data.phase || 'none';
        this.candidates = (data.candidates || []).map(c => ({...c})); this.votes = data.votes || {};
        this.campaignDaysLeft = data.campaignDaysLeft || 0; this.votingDaysLeft = data.votingDaysLeft || 0;
        this.resultsDaysLeft = data.resultsDaysLeft || 0; this.lastElectionDay = data.lastElectionDay || 0;
        this.electionHistory = (data.electionHistory || []).slice(-10);
        this.playerCanvassed = data.playerCanvassed || {};
    }
}

// --- Economy: Stockpile ---
const DEFAULT_STOCKPILE = { food:200, wood:100, stone:80, metal:30, cloth:40, herbs:20, silver:150, meals:50, tools:10, clothing:15, medicine:5, furniture:5, research_points:0,
    // New resources (industry + processing)
    plank:0, hardwood:0, brick:0, marble:0, steel:0, gold:0,
    // Crop resources
    wheat:0, rice:0, corn:0, potato:0, cotton:0, flowers:0, mushroom:0, sugarcane:0, tea:0, grapes:0, golden_wheat:0, dragon_fruit:0,
    // Processed goods
    bread:0, pastry:0, beer:0, wine:0, perfume:0, fine_tea:0, herbal_tea:0, sugar:0, jam:0, luxury_furniture:0,
};

class Stockpile {
    constructor() { this.resources = {...DEFAULT_STOCKPILE}; this.history = []; }
    get(r) { return this.resources[r] || 0; }
    add(r, amount, tick=0, reason='', source='') {
        this.resources[r] = (this.resources[r]||0) + amount;
        this.history.push({tick,resource:r,amount,reason,source});
        if (this.history.length > 10000) this.history = this.history.slice(-10000);
    }
    consume(r, amount, tick=0, reason='', source='') {
        if ((this.resources[r]||0) < amount) return false;
        this.resources[r] -= amount;
        this.history.push({tick,resource:r,amount:-amount,reason,source});
        if (this.history.length > 10000) this.history = this.history.slice(-10000);
        return true;
    }
    has(r, amount) { return (this.resources[r]||0) >= amount; }
    canAfford(costs) { return Object.entries(costs).every(([r,a]) => this.has(r,a)); }
    pay(costs, tick=0, reason='', source='') {
        if (!this.canAfford(costs)) return false;
        Object.entries(costs).forEach(([r,a]) => this.consume(r,a,tick,reason,source));
        return true;
    }
    toDict() { return { resources:{...this.resources}, recent_changes:this.history.slice(-10) }; }
}

// --- Economy: Production ---
const JOB_PRODUCTION = {
    farmer: {inputs:{},outputs:{food:12},skill:t('種植')},
    miner: {inputs:{tools:0.1},outputs:{stone:6,metal:3},skill:t('採礦')},
    cook: {inputs:{food:8},outputs:{meals:12},skill:t('烹飪')},
    blacksmith: {inputs:{metal:3,wood:1},outputs:{tools:3},skill:t('工藝')},
    carpenter: {inputs:{wood:4},outputs:{furniture:2},skill:t('建造')},
    tailor: {inputs:{cloth:3},outputs:{clothing:2},skill:t('工藝')},
    doctor: {inputs:{herbs:2},outputs:{medicine:2},skill:t('醫療')},
    researcher: {inputs:{},outputs:{research_points:5},skill:t('智識')},
    trader: {inputs:{},outputs:{silver:8},skill:t('社交')},
    guard: {inputs:{},outputs:{},skill:t('射擊')},
    priest: {inputs:{},outputs:{},skill:t('社交')},
    mayor: {inputs:{},outputs:{silver:3},skill:t('社交')},
};
const SEASON_FARM_MOD = {'春季':1.2,'夏季':1.5,'秋季':0.8,'冬季':0.4};
const NATURE_GATHERING = {forest:{wood:3},river:{food:2},meadow:{herbs:1,cloth:0.5},cave:{stone:2,metal:1},lake:{food:1.5}};

function processDailyProduction(world) {
    const sp = world.stockpile;
    // Check which NPC jobs are covered by the industry system to avoid double production
    const industryJobs = {};
    if (world.industry) {
        for (const [key] of Object.entries(world.industry.industries)) {
            const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
            if (def) industryJobs[def.npcJob] = true;
        }
    }
    Object.values(world.agents).forEach(agent => {
        if (agent.isPlayer || !agent.job) return;
        const recipe = JOB_PRODUCTION[agent.job.key]; if (!recipe) return;
        // If this job's production is handled by industry system, reduce to 30% (NPC still does ancillary work)
        const isIndustryHandled = industryJobs[agent.job.key];
        const skill = agent.skills.get(recipe.skill);
        let eff = 0.5 + ((skill?skill.level:0)/20)*2.0;
        if (isIndustryHandled) eff *= 0.5;
        if (agent.job.key === 'farmer') { eff *= SEASON_FARM_MOD[world.clock.season] || 1; eff *= 1 + (world.news?world.news.getModifier('farm_bonus',0):0) + (world.weather?world.weather.farmModifier:0); }
        if (agent.job.key === 'miner') eff *= 1 + (world.news?world.news.getModifier('mining_bonus',0):0);
        eff *= 1 + (agent.mood - 50)/500;
        eff *= 0.9 + Math.random()*0.2;
        let canProduce = true;
        for (const [r,a] of Object.entries(recipe.inputs)) { if (!sp.has(r,a)) { canProduce=false; break; } }
        if (!canProduce) { world.logMessage('economy',`${agent.name}${t('無法工作——材料不足！')}`,agent.name); agent.moodModifier=(agent.moodModifier||0)-3; return; }
        for (const [r,a] of Object.entries(recipe.inputs)) sp.consume(r,a,world.tickCount,`${agent.name}${t('的生產')}`,agent.name);
        for (const [r,a] of Object.entries(recipe.outputs)) sp.add(r,Math.round(a*eff*10)/10,world.tickCount,`${agent.name}${t('（')}${agent.job.title}${t('）')}`,agent.name);
        if (agent.job.key === 'priest') Object.values(world.agents).forEach(o => { if(o.agentId!==agent.agentId) o.moodModifier=(o.moodModifier||0)+1; });
    });
    const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
    const mealsNeeded = 1.5*npcCount;
    const mealsAvailable = sp.get('meals');
    if (mealsAvailable >= mealsNeeded) {
        sp.consume('meals',mealsNeeded,world.tickCount,'daily consumption');
    } else {
        if (mealsAvailable > 0) sp.consume('meals',mealsAvailable,world.tickCount,'daily consumption');
        const deficit = mealsNeeded - mealsAvailable;
        if (sp.consume('food',deficit*2,world.tickCount,t('緊急食物'))) world.logMessage('economy',t('餐食不夠！居民正在吃生食。'));
        else { world.logMessage('economy',t('糧食短缺！居民正在挨餓！')); Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-10; a.needs.hunger=Math.max(0,a.needs.hunger-20); }); }
    }
    if (world.townMap) { for (const [locId,gather] of Object.entries(NATURE_GATHERING)) { if (world.townMap.locations[locId]) { for (const [r,a] of Object.entries(gather)) sp.add(r,a*0.5,world.tickCount,`natural (${locId})`); } } }
    sp.consume('tools',npcCount*0.05,world.tickCount,'tool wear');
    sp.consume('clothing',npcCount*0.03,world.tickCount,'clothing wear');
    if (world.clock.season === '冬季' && !sp.consume('wood',npcCount*0.3,world.tickCount,'冬季取暖')) {
        world.logMessage('economy',t('木材不夠取暖！'));
        Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-8; a.needs.comfort=Math.max(0,a.needs.comfort-15); });
    }
}

// --- Economy: Buildings ---
const BUILDING_TEMPLATES = {
    watchtower:{name:t('瞭望塔'),description:t('提升防禦與襲擊預警'),costs:{wood:40,stone:30},work:20,effects:{defense_bonus:3}},
    granary:{name:t('穀倉'),description:t('增加食物儲存，減少腐壞'),costs:{wood:30,stone:20},work:15,effects:{food_capacity:500}},
    marketplace:{name:t('市集'),description:t('更好的交易與更多商人'),costs:{wood:25,stone:15,silver:50},work:18,effects:{trade_bonus:0.2,merchant_frequency:1.5}},
    well_upgrade:{name:t('深井'),description:t('改善供水'),costs:{stone:25,tools:3},work:12,effects:{drought_resistance:0.5}},
    training_ground:{name:t('訓練場'),description:t('守衛訓練更快'),costs:{wood:20,stone:10,tools:2},work:10,effects:{defense_bonus:2}},
    brewery:{name:t('釀酒坊'),description:t('生產啤酒，提升娛樂'),costs:{wood:15,metal:5,silver:30},work:14,effects:{recreation_bonus:10}},
    garden:{name:t('藥草園'),description:t('生產藥草用於醫療'),costs:{wood:10,silver:15},work:8,effects:{herbs_production:2}},
    school:{name:t('學堂'),description:t('提升所有技能經驗獲取'),costs:{wood:30,stone:20,silver:40},work:22,effects:{xp_bonus:1.2}},
    farm_irrigation:{name:t('農田灌溉'),description:t('提升作物產量'),costs:{stone:15,wood:10,tools:2},work:12,effects:{farm_bonus:1.3}},
    forge_bellows:{name:t('鍛造風箱'),description:t('加速金屬加工'),costs:{metal:10,stone:5},work:10,effects:{smithing_bonus:1.3}},
    clinic_upgrade:{name:t('醫療病房'),description:t('更好的治療效果'),costs:{wood:15,cloth:10,silver:25},work:14,effects:{healing_bonus:1.5}},
    town_walls:{name:t('城牆'),description:t('大幅提升防禦'),costs:{stone:80,wood:30,tools:5},work:40,effects:{defense_bonus:8}},
};

// --- Building Upgrades ---
const BUILDING_UPGRADES = {
    watchtower:{
        2:{name:t('強化瞭望塔'),description:t('石製加固，視野更遠'),costs:{stone:50,wood:20,metal:10},work:30,effects:{defense_bonus:2}},
        3:{name:t('哨兵高塔'),description:t('頂層弩砲，全天候警戒'),costs:{stone:80,metal:30,tools:5},work:50,effects:{defense_bonus:4,raid_chance:-0.05}},
    },
    granary:{
        2:{name:t('大型穀倉'),description:t('雙倍容量，通風防潮'),costs:{wood:50,stone:30,tools:3},work:25,effects:{food_capacity:500}},
        3:{name:t('冷藏穀庫'),description:t('地下冷藏，食物永不腐壞'),costs:{stone:60,metal:20,silver:40},work:40,effects:{food_capacity:800,food_decay:-0.5}},
    },
    marketplace:{
        2:{name:t('商業廣場'),description:t('更多攤位，吸引遠方商人'),costs:{wood:30,stone:25,silver:80},work:28,effects:{trade_bonus:0.15,merchant_frequency:0.5}},
        3:{name:t('國際商港'),description:t('稀有商品與異國商隊'),costs:{stone:50,metal:15,silver:150},work:45,effects:{trade_bonus:0.2,merchant_frequency:1.0}},
    },
    well_upgrade:{
        2:{name:t('淨水系統'),description:t('過濾雜質，提升健康'),costs:{stone:35,metal:10,tools:4},work:20,effects:{drought_resistance:0.3,healing_bonus:0.2}},
        3:{name:t('水渠網路'),description:t('全鎮供水，農田灌溉加成'),costs:{stone:60,metal:20,tools:6},work:35,effects:{drought_resistance:0.5,farm_bonus:0.2}},
    },
    training_ground:{
        2:{name:t('演武場'),description:t('專業訓練設施'),costs:{wood:30,stone:20,metal:10},work:18,effects:{defense_bonus:2}},
        3:{name:t('軍事學院'),description:t('培養精英守衛'),costs:{stone:40,metal:20,silver:50},work:35,effects:{defense_bonus:3,guard_xp_bonus:0.5}},
    },
    brewery:{
        2:{name:t('精釀酒坊'),description:t('釀造高級酒類'),costs:{wood:20,metal:10,silver:50},work:20,effects:{recreation_bonus:8}},
        3:{name:t('酒莊'),description:t('頂級佳釀，商業價值倍增'),costs:{wood:30,metal:15,silver:80},work:32,effects:{recreation_bonus:12,trade_bonus:0.1}},
    },
    garden:{
        2:{name:t('藥圃'),description:t('多樣藥草，產量加倍'),costs:{wood:15,silver:25,cloth:5},work:14,effects:{herbs_production:2}},
        3:{name:t('百草園'),description:t('珍稀藥材，治療奇效'),costs:{wood:20,silver:50,tools:3},work:24,effects:{herbs_production:3,healing_bonus:0.3}},
    },
    school:{
        2:{name:t('書院'),description:t('藏書豐富，學者雲集'),costs:{wood:40,stone:30,silver:60},work:30,effects:{xp_bonus:0.3}},
        3:{name:t('學府'),description:t('最高學府，研究加速'),costs:{stone:50,silver:100,tools:5},work:45,effects:{xp_bonus:0.4,research_bonus:0.2}},
    },
    farm_irrigation:{
        2:{name:t('水車灌溉'),description:t('自動化灌溉，省時省力'),costs:{wood:20,stone:15,metal:10},work:18,effects:{farm_bonus:0.3}},
        3:{name:t('精耕系統'),description:t('科學農法，產量大增'),costs:{stone:25,metal:15,tools:5},work:30,effects:{farm_bonus:0.5}},
    },
    forge_bellows:{
        2:{name:t('雙室鍛爐'),description:t('同時冶煉，效率翻倍'),costs:{metal:20,stone:15,tools:3},work:18,effects:{smithing_bonus:0.3}},
        3:{name:t('大師鍛造坊'),description:t('鍛造大師級裝備'),costs:{metal:35,stone:20,silver:40},work:30,effects:{smithing_bonus:0.5,tool_quality:0.3}},
    },
    clinic_upgrade:{
        2:{name:t('診療所'),description:t('專業醫療設備'),costs:{wood:20,cloth:15,silver:40,tools:3},work:22,effects:{healing_bonus:0.5}},
        3:{name:t('醫院'),description:t('全科醫療，起死回生'),costs:{stone:30,cloth:20,silver:80,tools:5},work:38,effects:{healing_bonus:0.8,mood_modifier:2}},
    },
    town_walls:{
        2:{name:t('加固城牆'),description:t('護城河與箭塔'),costs:{stone:120,wood:40,metal:20},work:55,effects:{defense_bonus:6}},
        3:{name:t('堅城堡壘'),description:t('銅牆鐵壁，固若金湯'),costs:{stone:180,metal:50,tools:10},work:80,effects:{defense_bonus:10,raid_chance:-0.1}},
    },
};

// --- v4.9.0 開羅式相鄰組合(建築+裝飾放在一起觸發加成,玩家自行發現) ---
const COMBO_DEFS = [
    {id:'romantic_corner', icon:'💞', name:t('浪漫街角'), parts:['flowerbed','bench','lamp'], desc:t('花圃+長椅+路燈')},
    {id:'plaza_oasis',     icon:'🌿', name:t('綠意廣場'), parts:['fountain','flowerbed'],     desc:t('小噴泉+花圃')},
    {id:'statue_square',   icon:'🗿', name:t('雕像廣場'), parts:['statue','bench'],           desc:t('雕像+長椅')},
    {id:'market_buzz',     icon:'🎪', name:t('市集人氣'), parts:['marketplace','lamp'],       desc:t('市集+路燈')},
    {id:'tavern_night',    icon:'🍺', name:t('酒香夜色'), parts:['brewery','lamp'],           desc:t('釀酒坊+路燈')},
    {id:'scholar_path',    icon:'📚', name:t('書香步道'), parts:['school','bench'],           desc:t('學堂+長椅')},
    {id:'iron_bastion',    icon:'🛡️', name:t('銅牆鐵壁'), parts:['watchtower','town_walls'],  desc:t('瞭望塔+城牆')},
    {id:'healing_garden',  icon:'🌼', name:t('靜心藥園'), parts:['garden','fountain'],        desc:t('藥草園+小噴泉')},
];

// --- v5.0.0 心動事件(礦石鎮式):與玩家的關係到達門檻時,NPC 用 AI 說出專屬真心話 ---
const HEART_EVENTS = [
    {id:'friend',   icon:'🌱', name:t('初識之誼'), min:{affinity:25},  scenario:t('你發現自己已經把旅人當朋友了。想跟他說說這段時間認識下來的感受,可以提起你們之間的某件小事')},
    {id:'close',    icon:'💛', name:t('知心好友'), min:{affinity:55},  scenario:t('旅人已是你的知心好友。你想跟他分享一件你從沒告訴過別人的心事或秘密')},
    {id:'soulmate', icon:'🌟', name:t('莫逆之交'), min:{affinity:80},  scenario:t('旅人是你此生難得的摯友。你想認真地告訴他,他對你有多重要')},
    {id:'crush',    icon:'💗', name:t('心動時刻'), min:{romantic:50},  scenario:t('你發現自己對旅人心動了。你鼓起勇氣,想含蓄地(或依你的性格直白地)透露你的感覺'), romance:true},
];

class BuildingManager {
    constructor() { this.projects=[]; this.completed=[]; this.activeEffects={}; this._counter=0; }
    getAvailable(world) {
        const done=new Set(this.completed.map(p=>p.name)), prog=new Set(this.projects.map(p=>p.name));
        return Object.entries(BUILDING_TEMPLATES).filter(([,t])=>!done.has(t.name)&&!prog.has(t.name)).map(([key,t])=>({key,...t,can_afford:world.stockpile.canAfford(t.costs)}));
    }
    getUpgradeable(world) {
        const upgrading=new Set(this.projects.filter(p=>p.upgradeKey).map(p=>p.upgradeKey));
        return this.completed.filter(b => {
            const key=b.buildingKey;
            if(!key||!BUILDING_UPGRADES[key]) return false;
            const lvl=b.level||1;
            if(lvl>=3) return false;
            if(upgrading.has(key)) return false;
            return !!BUILDING_UPGRADES[key][lvl+1];
        }).map(b => {
            const key=b.buildingKey;
            const nextLvl=(b.level||1)+1;
            const upg=BUILDING_UPGRADES[key][nextLvl];
            return { buildingKey:key, currentLevel:b.level||1, nextLevel:nextLvl, name:upg.name, description:upg.description, costs:upg.costs, work:upg.work, effects:upg.effects, can_afford:world.stockpile.canAfford(upg.costs), baseName:b.name };
        });
    }
    startUpgrade(buildingKey, world) {
        const b=this.completed.find(p=>p.buildingKey===buildingKey);
        if(!b) return null;
        const lvl=b.level||1;
        if(lvl>=3) return null;
        const upg=BUILDING_UPGRADES[buildingKey]?.[lvl+1];
        if(!upg) return null;
        if(this.projects.some(p=>p.upgradeKey===buildingKey)) return null;
        if(!world.stockpile.pay(upg.costs,world.tickCount,`${t('升級：')}${upg.name}`)) return null;
        this._counter++;
        const p={id:`build_${this._counter}`,name:upg.name,description:upg.description,costs:upg.costs,workRequired:upg.work,workDone:0,effects:upg.effects||{},status:'building',upgradeKey:buildingKey,targetLevel:lvl+1};
        this.projects.push(p);
        world.logMessage('building',`${t('開始升級：')}${upg.name}${t('！')}`);
        return p;
    }
    startProject(key, world, site) {
        const tmpl=BUILDING_TEMPLATES[key]; if(!tmpl) return null;
        const names=new Set([...this.completed,...this.projects].map(p=>p.name));
        if(names.has(tmpl.name)) return null;
        if(!world.stockpile.pay(tmpl.costs,world.tickCount,`Building: ${tmpl.name}`)) return null;
        this._counter++;
        const p={id:`build_${this._counter}`,name:tmpl.name,description:tmpl.description,costs:tmpl.costs,workRequired:tmpl.work,workDone:0,effects:tmpl.effects||{},status:'building',buildingKey:key};
        if (site && Number.isFinite(site.x)) { p.siteX = site.x; p.siteY = site.y; }
        this.projects.push(p); world.logMessage('building',`${t('開始建造：')}${tmpl.name}${t('！')}`); return p;
    }
    dailyConstruction(world) {
        const done=[];
        this.projects.forEach(p => {
            if(p.status!=='building') return;
            Object.values(world.agents).forEach(a => {
                if(a.isPlayer||!a.job) return;
                if(['carpenter','miner','blacksmith'].includes(a.job.key)) { const sk=a.skills.get('建造'); p.workDone+=1+Math.floor((sk?sk.level:0)/5); }
            });
            if(p.workDone>=p.workRequired) { p.status='complete'; done.push(p); }
        });
        done.forEach(p => {
            this.projects=this.projects.filter(x=>x!==p);
            if(p.upgradeKey) {
                // Upgrade: update existing completed building
                const existing=this.completed.find(b=>b.buildingKey===p.upgradeKey);
                if(existing) {
                    existing.level=p.targetLevel;
                    existing.name=p.name;
                    existing.description=p.description;
                }
                Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
                world.logMessage('building',`${t('升級完成：')}${p.name}${t('！')}`);
                if (world.dailyNews) world.dailyNews.collectEvent('building', `${p.name}${t('升級完成了！')}`, 7);
                Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+8; });
            } else {
                // New building
                p.buildingKey=p.buildingKey||null;
                p.level=1;
                this.completed.push(p);
                Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
                world.logMessage('building',`${t('建造完成：')}${p.name}${t('！')}`);
                if (world.dailyNews) world.dailyNews.collectEvent('building', `${p.name}${t('建造完成了！')}`, 6);
                Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+5; });
                // v4.9.0: 建築完工 → 檢查相鄰組合 + 相關職業 NPC 發表 AI 評論
                world.checkCombos?.();
                const commentJobs = {brewery:['cook'],school:['researcher'],marketplace:['trader'],garden:['doctor'],clinic_upgrade:['doctor'],watchtower:['guard'],town_walls:['guard'],training_ground:['guard'],granary:['farmer'],farm_irrigation:['farmer'],forge_bellows:['blacksmith'],well_upgrade:['carpenter']};
                world.conversationEngine?.sendEventComment?.(world, `${t('小鎮蓋好了新的「')}${p.name}${t('」')}`, commentJobs[p.buildingKey] || []);
            }
        });
    }
    getEffect(key, def=0) { return this.activeEffects[key]??def; }
    toDict() { return {in_progress:this.projects,completed:this.completed,active_effects:{...this.activeEffects},completed_count:this.completed.length,_counter:this._counter}; }
}

// --- Economy: Trade ---
const BASE_PRICES = {food:1,wood:1.5,stone:2,metal:4,cloth:3,herbs:3.5,meals:2.5,tools:8,clothing:6,medicine:10,furniture:7,
    plank:3,hardwood:5,brick:5,marble:8,steel:10,gold:15,
    wheat:2,rice:3,corn:2,potato:1,cotton:4,flowers:3,mushroom:4,sugarcane:3,tea:8,grapes:6,golden_wheat:15,dragon_fruit:20,
    bread:4,pastry:8,beer:5,wine:15,perfume:20,fine_tea:18,herbal_tea:10,sugar:5,jam:10,luxury_furniture:25,
};
const MERCHANT_TYPES = [
    {names:[t('張商人 (Zhang the Trader)'),t('老趙商隊 (Old Zhao\'s Caravan)')],specialty:'general',sells:['food','cloth','tools','wood'],buys:['meals','furniture','clothing']},
    {names:[t('礦商老李 (Li the Ore Dealer)')],specialty:'metals',sells:['metal','tools','stone'],buys:['food','meals']},
    {names:[t('藥師小雪 (Xue the Herbalist)')],specialty:'medicine',sells:['herbs','medicine'],buys:['food','cloth']},
    {names:[t('絲綢商人 (The Silk Trader)')],specialty:'textiles',sells:['cloth','clothing'],buys:['food','wood','stone']},
    {names:[t('異國商隊 (Exotic Caravan)')],specialty:'exotic',sells:['herbs','cloth','metal'],buys:['meals','clothing','furniture','tools']},
];

class TradeManager {
    constructor() { this.merchant=null; this._daysSince=0; this.tradeHistory=[]; }
    dailyUpdate(world) {
        this._daysSince++;
        if (this.merchant) { this.merchant.daysRemaining--; if(this.merchant.daysRemaining<=0){ world.logMessage('trade',`${t('商人')}${this.merchant.name}${t('已離開。')}`); this.merchant=null; } return; }
        const freq=world.buildings.getEffect('merchant_frequency',1);
        const newsBoost=world.news?world.news.getModifier('merchant_chance',0):0;
        const chance=Math.min(0.6, 0.15*freq+(this._daysSince-3)*0.05+newsBoost);
        if(Math.random()<chance) this._spawnMerchant(world);
    }
    _spawnMerchant(world) {
        this._daysSince=0;
        const mt=pickRandom(MERCHANT_TYPES);
        const tradeBonus=world.buildings.getEffect('trade_bonus',0);
        const sellBonus=world.news?world.news.getModifier('sell_bonus',0):0;
        const buyBonus=world.news?world.news.getModifier('buy_bonus',0):0;
        const repTradeBonus=world.reputationSystem?world.reputationSystem.getModifier('trade_price_bonus'):0;
        const offers=[];
        mt.sells.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(10,30),price:Math.round(bp*(1.2+Math.random()*0.6)*(1-tradeBonus-buyBonus-repTradeBonus)*10)/10,isBuying:false}); });
        mt.buys.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(15,40),price:Math.round(bp*(0.5+Math.random()*0.3)*(1+tradeBonus+sellBonus+repTradeBonus)*10)/10,isBuying:true}); });
        this.merchant={name:pickRandom(mt.names),specialty:mt.specialty,offers,daysRemaining:randInt(2,4)};
        world.logMessage('trade',`${t('商人')}${this.merchant.name}${t('到了！專長：')}${mt.specialty}。`);
    }
    executeTrade(offerIdx, qty, world) {
        if(!this.merchant) return {error:t('沒有商人')};
        const offer=this.merchant.offers[offerIdx]; if(!offer) return {error:t('無效交易')};
        qty=Math.min(qty,offer.amount); if(qty<=0) return {error:t('無效數量')};
        const total=qty*offer.price;
        if(offer.isBuying) {
            if(!world.stockpile.has(offer.resource,qty)) return {error:`${offer.resource}${t('不足')}`};
            world.stockpile.consume(offer.resource,qty,world.tickCount,`${t('賣給')}${this.merchant.name}`);
            world.stockpile.add('silver',total,world.tickCount,`${t('與')}${this.merchant.name}${t('交易')}`);
        } else {
            if(!world.stockpile.has('silver',total)) return {error:t('銀幣不足')};
            world.stockpile.consume('silver',total,world.tickCount,`${t('向')}${this.merchant.name}${t('購買')}`);
            world.stockpile.add(offer.resource,qty,world.tickCount,`${t('與')}${this.merchant.name}${t('交易')}`);
        }
        offer.amount-=qty;
        this.merchant.offers=this.merchant.offers.filter(o=>o.amount>0.5);
        world.logMessage('trade',`${offer.isBuying?t('賣出'):t('買入')} ${qty} ${offer.resource}${t('，')}${Math.round(total)}${t('銀幣。')}`);
        return {ok:true};
    }
    toDict() { return {merchant:this.merchant,days_since_merchant:this._daysSince}; }
}

// --- Economy: Research ---
const RESEARCH_TREE = {
    agriculture:{name:t('進階農業'),description:t('更好的農耕（+30%食物）'),cost:50,prerequisites:[],effects:{farm_bonus:1.3},unlocks:['farm_irrigation','garden']},
    metallurgy:{name:t('冶金術'),description:t('更好的金屬冶煉'),cost:60,prerequisites:[],effects:{smithing_bonus:1.2},unlocks:['forge_bellows']},
    medicine_research:{name:t('草藥醫學'),description:t('更好的療癒草藥'),cost:55,prerequisites:[],effects:{healing_bonus:1.3},unlocks:['clinic_upgrade','garden']},
    fortification:{name:t('防禦工事'),description:t('防禦性建築'),cost:70,prerequisites:[],effects:{defense_bonus:2},unlocks:['watchtower','training_ground','town_walls']},
    commerce:{name:t('商業'),description:t('更好的貿易方式'),cost:45,prerequisites:[],effects:{trade_bonus:0.15},unlocks:['marketplace']},
    architecture:{name:t('建築學'),description:t('進階建造'),cost:65,prerequisites:['metallurgy'],effects:{build_speed:1.3},unlocks:['school','town_walls']},
    brewing:{name:t('釀造術'),description:t('發酵的藝術'),cost:35,prerequisites:['agriculture'],effects:{recreation_bonus:5},unlocks:['brewery']},
    logistics:{name:t('後勤學'),description:t('更好的儲存'),cost:50,prerequisites:['commerce'],effects:{storage_bonus:1.5},unlocks:['granary']},
    education:{name:t('教育'),description:t('正式教育（+15%經驗）'),cost:80,prerequisites:['architecture'],effects:{xp_bonus:1.15},unlocks:['school']},
    masonry:{name:t('石匠術'),description:t('進階石工'),cost:55,prerequisites:['fortification'],effects:{stone_efficiency:1.3},unlocks:['town_walls','well_upgrade']},
};

class ResearchManager {
    constructor() {
        this.projects={}; this.current=null;
        for(const [key,d] of Object.entries(RESEARCH_TREE)) {
            this.projects[key]={key,name:d.name,description:d.description,cost:d.cost,progress:0,prerequisites:d.prerequisites||[],effects:d.effects||{},unlocks:d.unlocks||[],
                status:d.prerequisites.length===0?'available':'locked'};
        }
    }
    getAvailable() { return Object.values(this.projects).filter(p=>p.status==='available'); }
    startResearch(key) {
        const p=this.projects[key]; if(!p||p.status!=='available') return false;
        if(this.current&&this.projects[this.current]?.status==='researching') this.projects[this.current].status='available';
        p.status='researching'; this.current=key; return true;
    }
    dailyUpdate(world) {
        if(!this.current) { const av=this.getAvailable(); if(av.length) this.startResearch(av[0].key); return; }
        let pts=0;
        Object.values(world.agents).forEach(a=>{ if(!a.isPlayer&&a.job?.title===t('研究員')){ const sk=a.skills.get('智識'); pts+=3+(sk?sk.level:0)*0.5; } });
        pts *= 1 + (world.news?world.news.getModifier('research_bonus',0):0);
        const rp=world.stockpile.get('research_points'), bonus=Math.min(rp,5);
        if(bonus>0) world.stockpile.consume('research_points',bonus,world.tickCount,'research');
        if(pts+bonus<=0) return;
        const p=this.projects[this.current]; if(!p||p.status!=='researching') return;
        p.progress+=pts+bonus;
        if(p.progress>=p.cost) {
            p.status='complete'; this.current=null;
            Object.entries(p.effects).forEach(([k,v])=>{ world.buildings.activeEffects[k]=(world.buildings.activeEffects[k]||0)+(typeof v==='number'?v:0); });
            for(const op of Object.values(this.projects)) {
                if(op.status==='locked'&&op.prerequisites.every(pre=>this.projects[pre]?.status==='complete')) op.status='available';
            }
            world.logMessage('research',`${t('研究完成：')}${p.name}${t('！')}`);
            Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+3; });
        }
    }
    toDict() { return {current_research:this.current,projects:{...this.projects}}; }
}

// --- Economy: Work Orders ---
class WorkOrderManager {
    constructor() { this.orders=[]; this._counter=0; }
    createOrder(type,resource,amount,priority='normal',tick=0) {
        this._counter++;
        const o={id:`order_${this._counter}`,title:`${type}: ${amount} ${resource}`,type,resource,amount,current:0,priority,status:'queued',created:tick};
        this.orders.push(o); return o;
    }
    cancelOrder(id) { this.orders=this.orders.filter(o=>o.id!==id); }
    updateProgress(resource, amount) {
        this.orders.forEach(o=>{ if(o.status==='complete') return; if(o.resource===resource){ o.current+=amount; if(o.status==='queued') o.status='in_progress'; if(o.current>=o.amount) o.status='complete'; } });
    }
    cleanup() { const active=this.orders.filter(o=>o.status!=='complete'); const done=this.orders.filter(o=>o.status==='complete').slice(-10); this.orders=[...active,...done]; }
    toDict() { return {active:this.orders.filter(o=>o.status!=='complete'),all_orders:this.orders.slice(-20)}; }
}

// --- News System ---
const NEWS_TEMPLATES = [
    // Security/Raid related
    {headline:t('邊境偵察報告：發現可疑蹤跡'),headline_en:'Border scouts report suspicious tracks',category:'security',
     conditions:w=>true, weight:3, severity:'warning',
     modifiers:{raid_chance:0.15}, duration:3, flavor:[t('偵察兵在北方隘口發現營火殘跡。'),t('貿易路線發現不明足跡。')]},
    {headline:t('山賊集團在鄰近地區活動'),headline_en:'Bandit group active in nearby regions',category:'security',
     conditions:w=>w.clock.day>5, weight:2, severity:'danger',
     modifiers:{raid_chance:0.25,raid_severity:1}, duration:4, flavor:[t('鄰村難民警告有組織的盜匪。'),t('商人回報在主要道路遭遇伏擊。')]},
    {headline:t('附近村莊遭受襲擊'),headline_en:'Nearby village attacked',category:'security',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{raid_chance:0.30,chain_chance:0.1,mood_modifier:-5}, duration:3, flavor:[t('倖存者正逃向邊境鎮尋求安全。')]},
    {headline:t('邊境巡邏隊回報一切平靜'),headline_en:'Border patrols report all clear',category:'security',
     conditions:w=>true, weight:4, severity:'good',
     modifiers:{raid_chance:-0.05}, duration:2, flavor:[t('周邊地區目前看來很平靜。'),t('沒有偵測到敵對活動的跡象。')]},

    // Trade/Economy related
    {headline:t('商路暢通，大型商隊正在途中'),headline_en:'Trade routes clear, large caravan en route',category:'trade',
     conditions:w=>!w.trade?.merchant, weight:3, severity:'good',
     modifiers:{merchant_chance:0.3,trade_bonus:0.1}, duration:3, flavor:[t('好幾位商人帶著異國商品正朝我們而來。'),t('主要貿易道路已經修復。')]},
    {headline:t('貿易路線遭到封鎖'),headline_en:'Trade routes blocked',category:'trade',
     conditions:w=>true, weight:2, severity:'warning',
     modifiers:{merchant_chance:-0.15,supply_shortage:true}, duration:4, flavor:[t('山崩擋住了山間隘口。'),t('主要貿易道路的橋樑倒塌。')]},
    {headline:t('鄰國需求大增，物價上漲'),headline_en:'Neighboring demand surges, prices rising',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{sell_bonus:0.2}, duration:3, flavor:[t('區域對工藝品的需求急增。'),t('首都的大型建設工程需要材料。')]},
    {headline:t('市場供過於求，物價下跌'),headline_en:'Market oversupply, prices falling',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{buy_bonus:0.15,sell_bonus:-0.1}, duration:3, flavor:[t('太多商品湧入區域市場。')]},

    // Weather/Nature related
    {headline:t('農夫預測：近日天氣適宜耕作'),headline_en:'Farmers predict: good weather for crops',category:'weather',
     conditions:w=>[t('春季'),t('夏季')].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.2,mood_modifier:3}, duration:2, flavor:[t('預計晴空萬里並有微雨。'),t('完美的播種條件。')]},
    {headline:t('異常天象：暴風雨可能來襲'),headline_en:'Unusual signs: storms may approach',category:'weather',
     conditions:w=>[t('秋季'),t('冬季')].includes(w.clock.season), weight:3, severity:'warning',
     modifiers:{storm_chance:0.2,farm_bonus:-0.15,mood_modifier:-3}, duration:3, flavor:[t('地平線上烏雲聚集。'),t('動物舉止異常。')]},
    {headline:t('乾旱警報：水源開始減少'),headline_en:'Drought warning: water sources declining',category:'weather',
     conditions:w=>w.clock.season===t('夏季'), weight:2, severity:'danger',
     modifiers:{drought_chance:0.25,farm_bonus:-0.3,mood_modifier:-5}, duration:4, flavor:[t('河水水位下降很快。'),t('水井比平時更低。')]},
    {headline:t('豐沛雨水帶來好收成的希望'),headline_en:'Abundant rain brings hope for harvest',category:'weather',
     conditions:w=>[t('春季'),t('夏季')].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.3}, duration:2, flavor:[t('這個季節的雨量恰到好處。')]},

    // Social/Political
    {headline:t('居民對鎮長的支持度創新高'),headline_en:'Mayor approval rating hits new high',category:'social',
     conditions:w=>{ const mayor=Object.values(w.agents).find(a=>a.job?.title===t('鎮長')); return mayor&&mayor.mood>40; }, weight:2, severity:'good',
     modifiers:{mood_modifier:5,immigration_chance:0.1}, duration:2, flavor:[t('鎮議會合作良好。')]},
    {headline:t('不滿情緒蔓延，居民要求改善'),headline_en:'Discontent spreading, residents demand change',category:'social',
     conditions:w=>{ const avg=Object.values(w.agents).filter(a=>!a.isPlayer).reduce((s,a)=>s+a.mood,0)/(Object.values(w.agents).length||1); return avg<30; }, weight:3, severity:'warning',
     modifiers:{mood_modifier:-5,departure_chance:0.15,chain_chance:0.1}, duration:3, flavor:[t('好幾位居民大聲抱怨。'),t('酒館裡的氣氛很緊張。')]},
    {headline:t('有人目擊鄰近地區的疫病'),headline_en:'Plague spotted in neighboring area',category:'health',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{plague_chance:0.2,mood_modifier:-8,merchant_chance:-0.1}, duration:4, flavor:[t('旅人回報東方聚落正在蔓延疾病。')]},
    {headline:t('學者發現了古代遺跡的新線索'),headline_en:'Scholar discovers clues to ancient ruins',category:'discovery',
     conditions:w=>Object.values(w.agents).some(a=>a.job?.key==='researcher'), weight:2, severity:'good',
     modifiers:{research_bonus:0.3,mood_modifier:3}, duration:3, flavor:[t('古籍暗示附近藏有寶藏。'),t('破解古手稿取得突破。')]},
    {headline:t('野生動物出沒增加'),headline_en:'Wild animal sightings increasing',category:'nature',
     conditions:w=>true, weight:3, severity:'info',
     modifiers:{animal_raid_chance:0.1,gathering_bonus:0.15}, duration:2, flavor:[t('森林附近發現更多鹿和兔子。'),t('獵人回報獵物豐富。')]},
    {headline:t('遠方傳來戰爭的消息'),headline_en:'News of war from distant lands',category:'political',
     conditions:w=>w.clock.year>=1&&w.clock.day>10, weight:1, severity:'warning',
     modifiers:{raid_chance:0.1,merchant_chance:0.1,immigration_chance:0.15,mood_modifier:-3}, duration:5, flavor:[t('難民可能會來此避難。'),t('戰爭帶來危險也帶來機會。')]},
    {headline:t('節慶將至，居民期待歡慶'),headline_en:'Festival approaching, residents look forward',category:'social',
     conditions:w=>w.clock.day>=12&&w.clock.day<=14, weight:4, severity:'good',
     modifiers:{mood_modifier:8,festival_chance:0.4}, duration:2, flavor:[t('季節慶典的準備工作正在進行中。'),t('大家都很期待即將到來的慶祝活動。')]},
    {headline:t('礦坑發現新的礦脈'),headline_en:'New ore vein discovered in quarry',category:'discovery',
     conditions:w=>w.townMap?.locations?.['quarry'], weight:2, severity:'good',
     modifiers:{mining_bonus:0.25}, duration:3, flavor:[t('礦工對豐富的礦藏感到興奮。'),t('新礦脈含有高品質的金屬礦石。')]},
    {headline:t('城鎮名聲遠播，吸引新居民'),headline_en:'Town reputation grows, attracting settlers',category:'social',
     conditions:w=>Object.values(w.agents).filter(a=>!a.isPlayer).length<=10, weight:2, severity:'good',
     modifiers:{immigration_chance:0.25,mood_modifier:3}, duration:3, flavor:[t('邊境鎮繁榮的消息正在傳播。')]},
];

class NewsSystem {
    constructor() {
        this.bulletins = []; // {headline, headline_en, category, severity, flavor, modifiers, expiresDay, publishedDay, publishedTime}
        this.activeModifiers = {}; // aggregated from all active bulletins
        this._lastPublishDay = 0;
    }

    dailyUpdate(world) {
        // Expire old bulletins
        const currentDay = world.clock.year * 60 + (([t('春季'),t('夏季'),t('秋季'),t('冬季')].indexOf(world.clock.season)) * 15) + world.clock.day;
        this.bulletins = this.bulletins.filter(b => b.expiresDay > currentDay);

        // Publish 1-2 new bulletins per day
        const numNews = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < numNews; i++) {
            const bulletin = this._generateBulletin(world, currentDay);
            if (bulletin) {
                this.bulletins.push(bulletin);
                world.logMessage('news', `📰 ${bulletin.headline}`, '', '');
                // News also becomes gossip topic
                world.events.conversationTopics.push(bulletin.headline);
                if (world.events.conversationTopics.length > 8) world.events.conversationTopics = world.events.conversationTopics.slice(-8);
                // Mood effects from news
                if (bulletin.modifiers.mood_modifier) {
                    Object.values(world.agents).forEach(a => {
                        if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + Math.round(bulletin.modifiers.mood_modifier * 0.5);
                    });
                }
            }
        }

        // Rebuild active modifiers
        this._rebuildModifiers(currentDay);
        this._lastPublishDay = currentDay;
    }

    _generateBulletin(world, currentDay) {
        // Filter by conditions
        const eligible = NEWS_TEMPLATES.filter(t => {
            try { return t.conditions(world); } catch(e) { return true; }
        });
        if (!eligible.length) return null;

        // Weighted random selection
        const weights = eligible.map(t => t.weight);
        const template = weightedChoice(eligible, weights);

        const bulletin = {
            headline: template.headline,
            headline_en: template.headline_en,
            category: template.category,
            severity: template.severity,
            flavor: pickRandom(template.flavor),
            modifiers: {...template.modifiers},
            publishedDay: currentDay,
            publishedTime: world.clock.timeStr,
            expiresDay: currentDay + template.duration,
            daysRemaining: template.duration,
        };
        return bulletin;
    }

    _rebuildModifiers(currentDay) {
        this.activeModifiers = {};
        this.bulletins.forEach(b => {
            if (b.expiresDay <= currentDay) return;
            b.daysRemaining = b.expiresDay - currentDay;
            for (const [key, val] of Object.entries(b.modifiers)) {
                if (typeof val === 'number') {
                    this.activeModifiers[key] = (this.activeModifiers[key] || 0) + val;
                } else if (typeof val === 'boolean' && val) {
                    this.activeModifiers[key] = true;
                }
            }
        });
    }

    getModifier(key, defaultVal = 0) {
        return this.activeModifiers[key] ?? defaultVal;
    }

    getActiveBulletins() {
        return this.bulletins.slice().reverse();
    }

    toDict() {
        return {
            bulletins: this.bulletins.map(b => ({
                headline: b.headline,
                headline_en: b.headline_en,
                category: b.category,
                severity: b.severity,
                flavor: b.flavor,
                published_time: b.publishedTime,
                days_remaining: b.daysRemaining,
            })),
            active_modifiers: {...this.activeModifiers},
        };
    }
}

// --- Faction / Social Circle System ---
const FACTION_TYPES = {
    work_buddies:  { name:t('工作夥伴'), icon:'🔨', maxSize:5, formCondition:'sameJob' },
    drinking_pals: { name:t('酒友'), icon:'🍺', maxSize:6, formCondition:'tavernRegulars' },
    gossip_circle: { name:t('八卦圈'), icon:'🗣️', maxSize:5, formCondition:'gossipTraits' },
    scholars:      { name:t('學者聯盟'), icon:'📚', maxSize:4, formCondition:'intellectual' },
    romantics:     { name:t('戀愛同盟'), icon:'💕', maxSize:4, formCondition:'romanticTraits' },
    troublemakers: { name:t('搗蛋鬼'), icon:'😈', maxSize:4, formCondition:'abrasiveTraits' },
    elders_council:{ name:t('長者議會'), icon:'🧓', maxSize:5, formCondition:'olderAgents' },
    night_owls:    { name:t('夜貓族'), icon:'🦉', maxSize:5, formCondition:'nightOwlTraits' },
};

class Faction {
    constructor(id, type, founderName) {
        this.id = id;
        this.type = type; // key from FACTION_TYPES
        this.name = FACTION_TYPES[type]?.name || type;
        this.icon = FACTION_TYPES[type]?.icon || '👥';
        this.members = []; // agentId[]
        this.founderName = founderName;
        this.formedTick = 0;
        this.cohesion = 50; // 0-100, how united the group is
        this.rivalFactionId = null; // rival faction
        this.allyFactionId = null;  // allied faction
    }
    addMember(agentId) {
        if (!this.members.includes(agentId)) this.members.push(agentId);
    }
    removeMember(agentId) {
        this.members = this.members.filter(id => id !== agentId);
    }
    hasMember(agentId) { return this.members.includes(agentId); }
    get size() { return this.members.length; }
}

class FactionSystem {
    constructor() {
        this.factions = {}; // id -> Faction
        this._counter = 0;
        this._daysSinceCheck = 0;
    }

    dailyUpdate(world) {
        this._daysSinceCheck++;
        if (this._daysSinceCheck < 3) return; // check every 3 days
        this._daysSinceCheck = 0;

        this._dedupeFactions(); // v5.35.2 合併同型重複派系(舊版允許同名×2,顯示成兩個「學者聯盟」)
        this._tryFormFactions(world);
        this._updateCohesion(world);
        this._tryFactionEvents(world);
        this._cleanupDeadFactions(world);
    }

    // v5.35.2 同型派系名字相同,重複存在會顯示成兩個同名派系;合併成一個(保留較早的,成員取聯集)
    _dedupeFactions() {
        const byType = {};
        for (const [id, f] of Object.entries(this.factions)) {
            const kept = byType[f.type];
            if (kept) {
                f.members.forEach(m => kept.addMember(m));
                delete this.factions[id];
            } else {
                byType[f.type] = f;
            }
        }
    }

    _tryFormFactions(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        const existingTypes = Object.values(this.factions).map(f => f.type);

        for (const [type, def] of Object.entries(FACTION_TYPES)) {
            if (existingTypes.includes(type)) continue; // v5.35.2 同型派系最多 1 個(同名重複會讓玩家混亂)

            let candidates = [];
            switch (def.formCondition) {
                case 'sameJob': {
                    const jobGroups = {};
                    npcs.forEach(a => { if (a.job) { (jobGroups[a.job.key] = jobGroups[a.job.key] || []).push(a); } });
                    for (const group of Object.values(jobGroups)) {
                        if (group.length >= 2) { candidates = group.slice(0, def.maxSize); break; }
                    }
                    break;
                }
                case 'tavernRegulars': {
                    candidates = npcs.filter(a => {
                        const socialCount = a.memory.entries.filter(m => (m.content || '').includes(t('酒')) || (m.content || '').includes('tavern')).length;
                        return socialCount > 0 || a.personality.traits.includes('glutton') || a.personality.traits.includes('charismatic');
                    }).slice(0, def.maxSize);
                    break;
                }
                case 'gossipTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('gossip') || a.personality.traits.includes('charismatic')).slice(0, def.maxSize);
                    break;
                case 'intellectual':
                    candidates = npcs.filter(a => a.personality.values.includes('知識') || a.job?.category === 'intellectual').slice(0, def.maxSize);
                    break;
                case 'romanticTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('romantic') || a.personality.traits.includes('kind')).slice(0, def.maxSize);
                    break;
                case 'abrasiveTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('abrasive') || a.personality.traits.includes('lazy')).slice(0, def.maxSize);
                    break;
                case 'olderAgents':
                    candidates = npcs.filter(a => a.age >= 40).slice(0, def.maxSize);
                    break;
                case 'nightOwlTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('night_owl')).slice(0, def.maxSize);
                    break;
            }

            if (candidates.length >= 2 && Math.random() < 0.3) {
                // Check members not already in too many factions
                const filtered = candidates.filter(a => {
                    const factionCount = Object.values(this.factions).filter(f => f.hasMember(a.agentId)).length;
                    return factionCount < 2; // max 2 factions per NPC
                });
                if (filtered.length >= 2) {
                    const faction = new Faction(`faction_${++this._counter}`, type, filtered[0].name);
                    faction.formedTick = world.tickCount;
                    filtered.forEach(a => faction.addMember(a.agentId));
                    this.factions[faction.id] = faction;
                    const memberNames = filtered.map(a => a.name).join(t('、'));
                    world.logMessage('faction', `${faction.icon} ${memberNames}${t('組成了「')}${faction.name}${t('」！')}`, filtered[0].name);
                    filtered.forEach(a => {
                        a.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('我加入了「')}${faction.name}${t('」，成員有')}${memberNames}${t('。')}`, 6, filtered.map(x => x.name));
                        // Boost mutual affinity (scaled by personality compatibility)
                        filtered.forEach(b => {
                            if (a.agentId !== b.agentId) {
                                const factionCompat = Personality.compatibility(a.personality.traits, b.personality.traits);
                                const rel = a.relationships.getOrCreate(b.agentId, b.name);
                                rel.modifyAffinity(Math.round(randInt(2, 5) * factionCompat));
                                rel.modifyTrust(Math.round(randInt(1, 3) * factionCompat));
                            }
                        });
                    });
                }
            }
        }
    }

    _updateCohesion(world) {
        for (const faction of Object.values(this.factions)) {
            // Cohesion based on average mutual affinity
            let totalAffinity = 0, pairCount = 0;
            for (let i = 0; i < faction.members.length; i++) {
                for (let j = i + 1; j < faction.members.length; j++) {
                    const a = world.agents[faction.members[i]];
                    const b = world.agents[faction.members[j]];
                    if (a && b) {
                        const rel = a.relationships.getOrCreate(b.agentId, b.name);
                        totalAffinity += rel.affinity;
                        pairCount++;
                    }
                }
            }
            if (pairCount > 0) {
                const avgAff = totalAffinity / pairCount;
                faction.cohesion = Math.max(0, Math.min(100, 50 + avgAff));
            }

            // Members with very low affinity to others may leave
            for (const memberId of [...faction.members]) {
                const agent = world.agents[memberId];
                if (!agent) { faction.removeMember(memberId); continue; }
                const otherMembers = faction.members.filter(id => id !== memberId);
                const avgAff = otherMembers.reduce((sum, otherId) => {
                    const other = world.agents[otherId];
                    if (!other) return sum;
                    return sum + agent.relationships.getOrCreate(otherId, other.name).affinity;
                }, 0) / Math.max(1, otherMembers.length);
                if (avgAff < -30 && Math.random() < 0.2) {
                    faction.removeMember(memberId);
                    world.logMessage('faction', `${agent.name}${t('退出了「')}${faction.name}${t('」。')}`, agent.name);
                    agent.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('我退出了「')}${faction.name}${t('」，我受不了他們了。')}`, 5, []);
                }
            }
        }
    }

    _tryFactionEvents(world) {
        const factionList = Object.values(this.factions).filter(f => f.size >= 2);
        if (factionList.length < 2 || Math.random() > 0.15) return;

        // Pick two factions for interaction
        const [fA, fB] = shuffle(factionList).slice(0, 2);
        const roll = Math.random();

        if (roll < 0.4) {
            // Conflict between factions
            if (fA.rivalFactionId === fB.id || Math.random() < 0.3) {
                fA.rivalFactionId = fB.id;
                fB.rivalFactionId = fA.id;
                const eventDesc = pickRandom([
                    `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」在鎮上爆發了爭執！')}`,
                    `${t('「')}${fA.name}${t('」的成員公開批評「')}${fB.name}${t('」。')}`,
                    `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」因為意見不合發生衝突。')}`,
                ]);
                world.logMessage('faction', eventDesc);
                world.events.conversationTopics.push(eventDesc);
                // Damage cross-faction relationships
                fA.members.forEach(aId => {
                    fB.members.forEach(bId => {
                        const a = world.agents[aId], b = world.agents[bId];
                        if (a && b) {
                            a.relationships.getOrCreate(bId, b.name).modifyAffinity(randInt(-5, -2));
                            b.relationships.getOrCreate(aId, a.name).modifyAffinity(randInt(-5, -2));
                        }
                    });
                });
                fA.members.forEach(aId => { const a = world.agents[aId]; if (a) a.moodModifier = (a.moodModifier || 0) - 5; });
                fB.members.forEach(bId => { const b = world.agents[bId]; if (b) b.moodModifier = (b.moodModifier || 0) - 5; });
            }
        } else if (roll < 0.7) {
            // Cooperation between factions
            fA.allyFactionId = fB.id;
            fB.allyFactionId = fA.id;
            if (fA.rivalFactionId === fB.id) { fA.rivalFactionId = null; fB.rivalFactionId = null; }
            const eventDesc = pickRandom([
                `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」決定攜手合作！')}`,
                `${t('「')}${fA.name}${t('」邀請「')}${fB.name}${t('」一起舉辦活動。')}`,
                `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」化敵為友，達成共識。')}`,
            ]);
            world.logMessage('faction', eventDesc);
            // Boost cross-faction relationships
            fA.members.forEach(aId => {
                fB.members.forEach(bId => {
                    const a = world.agents[aId], b = world.agents[bId];
                    if (a && b) {
                        a.relationships.getOrCreate(bId, b.name).modifyAffinity(randInt(2, 5));
                        b.relationships.getOrCreate(aId, a.name).modifyAffinity(randInt(2, 5));
                    }
                });
            });
            fA.members.forEach(aId => { const a = world.agents[aId]; if (a) a.moodModifier = (a.moodModifier || 0) + 3; });
            fB.members.forEach(bId => { const b = world.agents[bId]; if (b) b.moodModifier = (b.moodModifier || 0) + 3; });
        } else {
            // Internal faction drama
            const faction = pickRandom([fA, fB]);
            if (faction.size >= 3 && Math.random() < 0.4) {
                const members = faction.members.map(id => world.agents[id]).filter(Boolean);
                const [instigator, target] = shuffle(members).slice(0, 2);
                const drama = pickRandom([
                    `${instigator.name}${t('在「')}${faction.name}${t('」聚會中公開指責')}${target.name}${t('！')}`,
                    `${instigator.name}${t('和')}${target.name}${t('在「')}${faction.name}${t('」內鬧不愉快。')}`,
                    `${t('「')}${faction.name}${t('」內部出現分裂，')}${instigator.name}${t('帶頭反對')}${target.name}${t('。')}`,
                ]);
                world.logMessage('faction', drama, instigator.name, target.name);
                instigator.relationships.getOrCreate(target.agentId, target.name).modifyAffinity(randInt(-8, -3));
                target.relationships.getOrCreate(instigator.agentId, instigator.name).modifyAffinity(randInt(-6, -2));
                faction.cohesion = Math.max(0, faction.cohesion - 10);
                world.gossipNetwork.activeGossip.push({
                    about: instigator.name, content: drama, source: t('鎮民'),
                    spreadCount: 0, tickCreated: world.tickCount, isTrue: true
                });
            }
        }
    }

    _cleanupDeadFactions(world) {
        for (const [id, faction] of Object.entries(this.factions)) {
            // Remove members no longer in the world
            faction.members = faction.members.filter(mId => world.agents[mId]);
            if (faction.size < 2) {
                if (faction.size === 1) {
                    const lastAgent = world.agents[faction.members[0]];
                    if (lastAgent) {
                        world.logMessage('faction', `${t('「')}${faction.name}${t('」因人數不足而解散。')}`, lastAgent.name);
                    }
                }
                delete this.factions[id];
            }
        }
    }

    getAgentFactions(agentId) {
        return Object.values(this.factions).filter(f => f.hasMember(agentId));
    }

    toDict() {
        return {
            factions: Object.fromEntries(Object.entries(this.factions).map(([k, f]) => [k, {
                id: f.id, type: f.type, name: f.name, icon: f.icon,
                members: [...f.members], founderName: f.founderName,
                formedTick: f.formedTick, cohesion: f.cohesion,
                rivalFactionId: f.rivalFactionId, allyFactionId: f.allyFactionId,
            }])),
            _counter: this._counter,
            _daysSinceCheck: this._daysSinceCheck,
        };
    }
}

// --- Seasonal Festival System ---
const FESTIVALS = {
    '春季': {
        day: 8, name: t('春祭'), icon: '🌸',
        description: t('慶祝新生與播種的季節！全城一起祈禱豐收。'),
        effects: { mood_all: 15, social_boost: 20, conversation_topic: t('春祭慶典') },
        activities: [t('舞龍舞獅'), t('花車遊行'), t('種下許願樹'), t('分享春餅')],
        questName: t('採集春花'), questDesc: t('在城外採集100朵春花裝飾廣場。'),
    },
    '夏季': {
        day: 10, name: t('豐收前夜祭'), icon: '🔥',
        description: t('仲夏夜的篝火慶典，居民圍著篝火講故事。'),
        effects: { mood_all: 12, social_boost: 15, conversation_topic: t('仲夏篝火') },
        activities: [t('篝火晚會'), t('說故事比賽'), t('夜間市集'), t('放煙火')],
        questName: t('收集木材'), questDesc: t('收集足夠的木材來搭建巨型篝火。'),
    },
    '秋季': {
        day: 12, name: t('秋收節'), icon: '🍂',
        description: t('感謝大地豐收！全城分享收成的喜悅。'),
        effects: { mood_all: 18, food_bonus: 50, conversation_topic: t('秋收慶典') },
        activities: [t('豐收宴席'), t('農產品比賽'), t('秋收舞會'), t('感恩祭祀')],
        questName: t('豐收祭品'), questDesc: t('準備最好的農產品作為祭品。'),
    },
    '冬季': {
        day: 7, name: t('冬至慶典'), icon: '❄️',
        description: t('最長的夜晚，居民們互相取暖、交換禮物。'),
        effects: { mood_all: 20, social_boost: 25, conversation_topic: t('冬至禮物') },
        activities: [t('交換禮物'), t('熱湯分享'), t('冬至詩會'), t('雪地遊戲')],
        questName: t('準備禮物'), questDesc: t('為每位居民準備一份特別的禮物。'),
    },
};

// --- v5.4.0 村民人生故事線(LifeGoalSystem):每個村民有長期夢想,隨真實狀態推進,AI 敘事 ---
const LIFE_GOALS = {
    truelove: {
        icon: '💗', name: t('尋覓真愛'),
        stages: [t('憧憬愛情'), t('怦然心動'), t('兩情相悅'), t('步入婚姻')],
        // 直接讀愛恨引擎:憧憬→有暗戀→交往→結婚
        stageReady(w, a, stage) {
            const rels = Object.values(a.relationships.relationships).filter(r => { const o = w.agents[r.targetId]; return o && !o.isPlayer; });
            if (stage === 0) return rels.some(r => r.romanticInterest > 40);
            if (stage === 1) return rels.some(r => r.status === 'dating' || r.status === 'married');
            if (stage === 2) return rels.some(r => r.status === 'married');
            return false;
        },
    },
    entrepreneur: {
        icon: '🏪', name: t('開店創業'),
        stages: [t('胸懷創業夢'), t('攢下第一桶金'), t('盤下店面'), t('開張大吉')],
        stageReady(w, a, stage) {
            const prosp = w.prosperity?.score || 0;
            if (stage === 0) return prosp > 15 || (w.stockpile.get('silver') || 0) > 120;
            if (stage === 1) return prosp > 30 || (w.stockpile.get('silver') || 0) > 250;
            if (stage === 2) return prosp > 45 || (w.buildings?.completed?.some(b => b.buildingKey === 'marketplace'));
            return false;
        },
    },
    master: {
        icon: '🎨', name: t('技藝登峰'),
        stages: [t('拜師苦練'), t('小有名氣'), t('獨當一面'), t('一代宗師')],
        stageReady(w, a, stage) {
            const cats = ['工藝', '藝術', '烹飪', '醫療', '智識', '建造', '種植'];
            const lv = Math.max(...cats.map(c => a.skills.get(c)?.level || 0));
            return lv >= [6, 10, 15, 99][stage];
        },
    },
    adventurer: {
        icon: '🧭', name: t('浪跡天涯'),
        stages: [t('嚮往遠方'), t('打點行裝'), t('踏上旅程'), t('滿載而歸')],
        stageReady(w, a, stage) { return true; }, // 純時間推進(冒險是心境)
    },
    family: {
        icon: '👨‍👩‍👧', name: t('闔家團圓'),
        stages: [t('渴望有個家'), t('遇見對的人'), t('開枝散葉'), t('兒孫繞膝')],
        stageReady(w, a, stage) {
            const partner = a.relationships.getPartner();
            if (stage === 0) return !!partner;
            if (stage === 1) return a.relationships.getSpouse && !!a.relationships.getSpouse();
            if (stage === 2) return (w.lifecycle?.births || []).some(b => (b.parentNames || []).includes(a.name));
            return false;
        },
    },
    legacy: {
        icon: '🏛️', name: t('名留青史'),
        stages: [t('胸懷大志'), t('嶄露頭角'), t('舉足輕重'), t('名留青史')],
        stageReady(w, a, stage) {
            const prosp = w.prosperity?.score || 0;
            const onCouncil = (w.council?.members || []).includes(a.agentId);
            if (stage === 0) return prosp > 20;
            if (stage === 1) return prosp > 40 || onCouncil;
            if (stage === 2) return prosp > 60 && onCouncil;
            return false;
        },
    },
};

class LifeGoalSystem {
    constructor() { this.goals = {}; this._assigned = false; }
    _pickGoal(a) {
        const v = a.values || a.personality?.values || [];
        const tr = a.personality?.traits || [];
        const score = { truelove: 0, entrepreneur: 0, master: 0, adventurer: 0, family: 0, legacy: 0 };
        if (v.includes(t('財富'))) score.entrepreneur += 3;
        if (v.includes(t('知識'))) score.master += 2;
        if (v.includes(t('藝術'))) score.master += 3;
        if (v.includes(t('家庭'))) { score.family += 3; score.truelove += 1; }
        if (v.includes(t('冒險'))) score.adventurer += 3;
        if (v.includes(t('自由'))) score.adventurer += 2;
        if (v.includes(t('權力'))) score.legacy += 3;
        if (v.includes(t('榮譽'))) score.legacy += 2;
        if (v.includes(t('社群')) || v.includes(t('和平'))) score.legacy += 1;
        if (tr.includes('romantic')) score.truelove += 3;
        if (tr.includes('creative')) score.master += 2;
        if (tr.includes('hardworking')) score.entrepreneur += 1;
        if (tr.includes('charismatic')) score.legacy += 1;
        // 職業傾向
        const jobGoal = { blacksmith: 'master', tailor: 'master', carpenter: 'master', cook: 'master',
            doctor: 'master', researcher: 'master', trader: 'entrepreneur', guard: 'legacy', priest: 'legacy' };
        if (a.job?.key && jobGoal[a.job.key]) score[jobGoal[a.job.key]] += 2;
        // 若已婚/交往,傾向 family;單身年輕傾向 truelove
        if (a.relationships.getPartner()) score.family += 2; else if (a.age < 35) score.truelove += 1;
        let best = 'truelove', bv = -1;
        for (const [k, s] of Object.entries(score)) if (s > bv) { bv = s; best = k; }
        if (bv <= 0) best = pickRandom(['truelove', 'adventurer', 'master']);
        return best;
    }
    ensureAssigned(world) {
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead) continue;
            if (!this.goals[a.agentId]) {
                this.goals[a.agentId] = { key: this._pickGoal(a), stage: 0, stageStartDay: world.clock.totalDays || 0, done: false };
            }
        }
        this._assigned = true;
    }
    dailyUpdate(world) {
        this.ensureAssigned(world);
        const today = world.clock.totalDays || 0;
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead) continue;
            const g = this.goals[a.agentId];
            if (!g || g.done) continue;
            const def = LIFE_GOALS[g.key]; if (!def) continue;
            const daysAtStage = today - (g.stageStartDay || 0);
            const minDays = 6; // 每階段至少醞釀 6 天
            if (daysAtStage < minDays) continue;
            const ready = def.stageReady(world, a, g.stage);
            // 條件達成 → 推進;純時間型(adventurer)靠機率慢慢走
            const advance = ready && (def.stageReady === LIFE_GOALS.adventurer.stageReady ? Math.random() < 0.18 : Math.random() < 0.5);
            if (advance) {
                g.stage++;
                g.stageStartDay = today;
                const isDone = g.stage >= def.stages.length;
                if (isDone) { g.done = true; g.doneDay = today; }
                // 敘事:AI 或模板,推播里程碑
                if (world.conversationEngine?.narrateLifeMilestone)
                    world.conversationEngine.narrateLifeMilestone(world, a, def, g, isDone);
            }
        }
    }
    getGoal(agentId) { return this.goals[agentId]; }
    describe(agentId) {
        const g = this.goals[agentId]; if (!g) return null;
        const def = LIFE_GOALS[g.key]; if (!def) return null;
        return { key: g.key, icon: def.icon, name: def.name,
            stageName: g.done ? def.stages[def.stages.length - 1] : def.stages[g.stage],
            stage: g.stage, totalStages: def.stages.length, done: g.done };
    }
    nudge(world, agentId) { // 玩家助夢:縮短當前階段醞釀時間
        const g = this.goals[agentId]; if (!g || g.done) return false;
        g.stageStartDay = Math.min(g.stageStartDay, (world.clock.totalDays || 0) - 6);
        g._nudged = true;
        return true;
    }
    serialize() { return { goals: this.goals }; }
    load(d) { if (d && d.goals) { this.goals = d.goals; this._assigned = true; } }
}

// v5.19.0 城鎮身分/路線:小鎮依長期決策自然長成某種樣貌,影響移民、氛圍與事件
const TOWN_ROUTES = {
    commerce:  { icon: '💰', name: () => t('商業自由鎮'), desc: () => t('金流暢旺,商人與旅人絡繹不絕') },
    military:  { icon: '🛡️', name: () => t('軍事要塞'),   desc: () => t('壁壘森嚴,以武立鎮') },
    agrarian:  { icon: '🌾', name: () => t('農業共同體'), desc: () => t('阡陌相連,自給自足') },
    scholarly: { icon: '📚', name: () => t('學術聚落'),   desc: () => t('崇尚知識,書香瀰漫') },
    romance:   { icon: '💕', name: () => t('浪漫小鎮'),   desc: () => t('愛情故事在此處處上演') },
    crime:     { icon: '🗡️', name: () => t('龍蛇混雜之地'), desc: () => t('恩怨情仇,暗流洶湧') },
};
const JOB_AXIS = {
    farmer: 'agrarian', cook: 'agrarian',
    trader: 'commerce', tailor: 'commerce', carpenter: 'commerce', miner: 'commerce',
    guard: 'military', blacksmith: 'military',
    researcher: 'scholarly', doctor: 'scholarly', priest: 'scholarly',
};
const POLICY_AXIS = { economy: 'commerce', freedom: 'commerce', defense: 'military', welfare: 'agrarian', nature: 'agrarian', culture: 'scholarly' };

class TownIdentitySystem {
    constructor() {
        this.scores = { commerce: 0, military: 0, agrarian: 0, scholarly: 0, romance: 0, crime: 0 };
        this.route = null;      // 目前結晶出的路線 key
        this.routeSince = null; // 成為該路線的日子
        this.history = [];      // [{route, day}]
    }
    dailyUpdate(world) {
        const s = this.scores;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        // 職業分佈:小鎮靠什麼維生
        for (const a of npcs) { const ax = JOB_AXIS[a.job?.key]; if (ax) s[ax] += 1; }
        // 經濟樣態
        const silver = world.stockpile?.get?.('silver') || 0;
        const food = world.stockpile?.get?.('food') || 0;
        if (silver > 300) s.commerce += 2; else if (silver > 150) s.commerce += 1;
        if (food > 150) s.agrarian += 1;
        // 研究氛圍
        const techDone = world.research?.completed?.length || world.research?.unlocked?.length || 0;
        if (techDone > 0) s.scholarly += Math.min(3, techDone * 0.4);
        // 愛恨密度
        let couples = 0, rivalPairs = 0;
        for (const a of npcs) {
            if (a.relationships?.getPartner?.()) couples++;
            for (const r of Object.values(a.relationships?.relationships || {})) if ((r.affinity || 0) < -40) rivalPairs++;
        }
        s.romance += Math.min(5, couples / 2);
        s.crime += Math.min(4, rivalPairs / 4);
        // 選舉政策(最近一屆的方向,強訊號)
        const pol = world.election?.electionHistory?.slice(-1)[0]?.winner?.policy;
        if (pol && POLICY_AXIS[pol]) s[POLICY_AXIS[pol]] += 4;
        // 輕微衰退:讓「近期」比「遠古」更有份量,路線可隨玩法轉變
        for (const k in s) s[k] *= 0.97;
        this._evaluate(world);
    }
    _evaluate(world) {
        const days = world.clock?.totalDays || 0;
        if (days < 15) return; // 需要一段歷史才成形
        const sorted = Object.entries(this.scores).sort((a, b) => b[1] - a[1]);
        const [topK, topV] = sorted[0];
        const runnerV = sorted[1] ? sorted[1][1] : 0;
        if (topV < 25 || topV < runnerV * 1.2) return; // 訊號不夠強或不夠獨佔 → 尚未成形
        if (this.route === topK) return;
        const prev = this.route;
        this.route = topK; this.routeSince = days;
        this.history.push({ route: topK, day: days });
        const def = TOWN_ROUTES[topK];
        const verb = prev ? t('小鎮的樣貌轉變了,如今成為「') : t('小鎮的樣貌逐漸成形——「');
        world.logMessage?.('event', `${def.icon} ${verb}${def.name()}${t('」:')}${def.desc()}`);
        world.dailyNews?.collectEvent?.('event', `${def.icon} ${prev ? t('小鎮轉型為:') : t('小鎮成形為:')}${def.name()}`, 9, []);
    }
    currentRoute() {
        if (!this.route) return null;
        const def = TOWN_ROUTES[this.route];
        return { key: this.route, icon: def.icon, name: def.name(), desc: def.desc() };
    }
    // 依路線偏好的職業軸(供移民加權)
    routeAxis() { return this.route; }
    toDict() { return { route: this.route, routeName: this.route ? TOWN_ROUTES[this.route].name() : null, routeIcon: this.route ? TOWN_ROUTES[this.route].icon : null, routeDesc: this.route ? TOWN_ROUTES[this.route].desc() : null, scores: { ...this.scores } }; }
    serialize() { return { scores: this.scores, route: this.route, routeSince: this.routeSince, history: this.history }; }
    load(d) { if (!d) return; this.scores = d.scores || this.scores; this.route = d.route || null; this.routeSince = d.routeSince || null; this.history = d.history || []; }
}

class FestivalSystem {
    constructor() {
        this.activeFestival = null; // current festival or null
        this.festivalLog = [];     // past festivals
        this.activeQuest = null;   // {name, desc, progress, goal, rewards, deadline}
        this._lastFestivalSeason = null;
    }

    dailyUpdate(world) {
        const season = world.clock.season;
        const day = world.clock.day;
        const festival = FESTIVALS[season];
        if (!festival) return;

        // Festival announcement (1 day before)
        if (day === festival.day - 1 && this._lastFestivalSeason !== season) {
            world.logMessage('festival', `${festival.icon} ${t('明天就是')}${festival.name}${t('了！全城都在準備中。')}`);
            world.events.conversationTopics.push(`${t('即將到來的')}${festival.name}`);
            // Start quest
            this.activeQuest = {
                name: festival.questName, desc: festival.questDesc,
                progress: 0, goal: 100, season: season,
                rewards: { mood: 10, resources: { food: 30, silver: 20 } },
            };
        }

        // Festival day!
        if (day === festival.day && this._lastFestivalSeason !== season) {
            this._lastFestivalSeason = season;
            this.activeFestival = {
                ...festival, season, startTick: world.tickCount,
                endTick: world.tickCount + 96 * 2, // lasts 2 days
            };

            // Apply effects
            Object.values(world.agents).forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + festival.effects.mood_all;
                if (!a.isPlayer) a.addThought('festival_joy', world); // v5.15.0 祭典的歡樂
                if (festival.effects.social_boost) {
                    a.needs.social = Math.min(100, a.needs.social + festival.effects.social_boost);
                }
                const activity = pickRandom(festival.activities);
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `${t('參加了')}${festival.name}${t('！')}${activity}${t('真有趣。')}`, 7, []);
            });

            // Food bonus
            if (festival.effects.food_bonus) {
                world.stockpile.add('food', festival.effects.food_bonus);
                world.stockpile.add('meals', Math.floor(festival.effects.food_bonus / 2));
            }

            world.logMessage('festival', `${festival.icon} ${festival.name}${t('開始了！')}${festival.description}`);
            world.events.conversationTopics.push(festival.effects.conversation_topic);

            // Boost relationships during festival
            const agents = Object.values(world.agents);
            for (let i = 0; i < agents.length; i++) {
                for (let j = i + 1; j < agents.length; j++) {
                    if (Math.random() < 0.3) {
                        const relA = agents[i].relationships.getOrCreate(agents[j].agentId, agents[j].name);
                        const relB = agents[j].relationships.getOrCreate(agents[i].agentId, agents[i].name);
                        relA.modifyAffinity(randInt(1, 4));
                        relB.modifyAffinity(randInt(1, 4));
                    }
                }
            }

            this.festivalLog.push({ name: festival.name, season, year: world.clock.year, tick: world.tickCount });

            // v5.0.0 祭典邀約:對玩家最有感情的 NPC(伴侶>心動>最好的朋友)主動傳訊邀玩家逛祭典
            const playerAgent = Object.values(world.agents).find(a => a.isPlayer);
            if (playerAgent && world.conversationEngine?.sendEventComment) {
                let inviter = null, best = -Infinity;
                for (const a of Object.values(world.agents)) {
                    if (a.isPlayer || a.isDead) continue;
                    const rel = a.relationships.relationships[playerAgent.agentId];
                    if (!rel) continue;
                    const score = (rel.status === 'married' ? 300 : rel.status === 'dating' ? 200 : 0) + (rel.romanticInterest >= 50 ? 100 : 0) + rel.affinity;
                    if (score > best) { best = score; inviter = a; }
                }
                if (inviter && best > 10) {
                    const act = pickRandom(festival.activities);
                    world.conversationEngine.sendEventComment(world,
                        `${t('今天是')}${festival.name}${t('！')}${festival.description}${t('你想邀')}${playerAgent.name}${t('一起去')}${act}`,
                        [], [inviter.agentId], [
                            `${t('欸欸,今天是')}${festival.name}${t('耶!要不要一起去')}${act}${t('?我在廣場等你!')}`,
                            `${festival.name}${t('開始了!走啦,陪我去')}${act}${t(',一個人去多無聊')}`,
                        ]);
                }
            }

            // Special festival dialogue templates
            world.gossipNetwork.activeGossip.push({
                about: t('全鎮'), content: `${festival.name}${t('好熱鬧！')}${pickRandom(festival.activities)}${t('太棒了！')}`,
                source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
            });
        }

        // End festival
        if (this.activeFestival && world.tickCount > this.activeFestival.endTick) {
            world.logMessage('festival', `${this.activeFestival.icon} ${this.activeFestival.name}${t('結束了，大家帶著美好的回憶回到日常。')}`);
            this.activeFestival = null;
        }

        // Auto-progress quest (NPC contributions)
        if (this.activeQuest && this.activeQuest.season === season) {
            const workers = Object.values(world.agents).filter(a => !a.isPlayer && a.activity === 'working');
            this.activeQuest.progress = Math.min(this.activeQuest.goal,
                this.activeQuest.progress + workers.length * randInt(2, 5));
            if (this.activeQuest.progress >= this.activeQuest.goal) {
                world.logMessage('festival', `🎉 ${t('節日任務「')}${this.activeQuest.name}${t('」完成！獲得獎勵！')}`);
                if (this.activeQuest.rewards.resources) {
                    for (const [r, amt] of Object.entries(this.activeQuest.rewards.resources)) {
                        world.stockpile.add(r, amt);
                    }
                }
                Object.values(world.agents).forEach(a => {
                    a.moodModifier = (a.moodModifier || 0) + (this.activeQuest.rewards.mood || 5);
                });
                this.activeQuest = null;
            }
        }
        // Clear quest if season changed
        if (this.activeQuest && this.activeQuest.season !== season) {
            this.activeQuest = null;
        }
    }

    toDict() {
        return {
            activeFestival: this.activeFestival ? { ...this.activeFestival } : null,
            festivalLog: this.festivalLog.slice(-10000),
            activeQuest: this.activeQuest ? { ...this.activeQuest } : null,
            _lastFestivalSeason: this._lastFestivalSeason,
            _gameRewardKey: this._gameRewardKey || null, // v5.1.0 本屆祭典攤位獎勵是否已領
        };
    }
}

// --- NPC Death / Birth / Aging System ---
const DEATH_CAUSES = [
    t('年老體衰'), t('突發疾病'), t('意外事故'), t('在探險中犧牲'), t('神秘失蹤後被發現'),
];
const BABY_NAMES_MALE = [t('小龍'),t('天明'),t('子軒'),t('浩宇'),t('嘉禾'),t('承恩'),t('宏志'),t('瑞陽'),t('文博'),t('志遠'),t('新宇'),t('國棟')];
const BABY_NAMES_FEMALE = [t('小鳳'),t('曉月'),t('詩涵'),t('雨桐'),t('美琪'),t('欣怡'),t('佳穎'),t('思琪'),t('夢瑤'),t('婉清'),t('紫萱'),t('若蘭')];

// v5.27.0 肉鴿:隨機開局用的名字/背景池
const RANDOM_SURNAMES = ['陳','林','黃','張','李','王','吳','劉','蔡','楊','許','鄭','謝','郭','洪','曾','廖','賴','徐','周','葉','蘇','高','呂','潘','簡'];
const RANDOM_GIVEN_MALE = ['志明','建宏','俊傑','家豪','承翰','冠廷','宗翰','柏翰','彥廷','子墨','宇軒','澤','思成','岳','峰','昊','翔','睿','浩然','立','風','岩','洲','霆'];
const RANDOM_GIVEN_FEMALE = ['淑芬','美玲','雅婷','怡君','佳蓉','曉薇','子晴','語彤','欣妍','佩珊','宛柔','思妤','詠晴','若曦','芷若','靜宜','采薇','韻如','婉婷','晴','嵐','薇','蕎','菱'];
const RANDOM_BG = () => [
    t('帶著一身故事來到邊境鎮,想在這裡重新開始。'),
    t('土生土長的鎮民,對這片土地有說不完的感情。'),
    t('曾在遠方闖蕩多年,如今只想找個安穩的落腳處。'),
    t('沉默寡言,但只要熟了就會發現一顆熱心腸。'),
    t('心裡藏著一個沒說出口的夢,也藏著一個沒說出口的人。'),
    t('嘴上不饒人,做起事來卻比誰都認真。'),
    t('走到哪都能交到朋友,也總在不經意間牽動誰的心。'),
    t('看似瀟灑,其實對某段過去始終放不下。'),
];

class LifecycleSystem {
    constructor() {
        this.graveyard = [];   // { name, age, deathCause, deathTick, deathTime, epitaph, job }
        this.births = [];       // { name, parentNames, birthTick, birthTime }
        this._daysSinceCheck = 0;
    }

    dailyUpdate(world) {
        this._daysSinceCheck++;
        if (this._daysSinceCheck < 2) return;
        this._daysSinceCheck = 0;

        this._processAging(world);
        this._checkDeaths(world);
        this._checkBirths(world);
    }

    _processAging(world) {
        // Age NPCs once every 2 seasons (approx every 30 game-days)
        if (world.clock.day !== 1) return;
        if (!this._agingToggle) this._agingToggle = false;
        this._agingToggle = !this._agingToggle;
        if (!this._agingToggle) return; // Skip every other season
        Object.values(world.agents).forEach(a => {
            if (!a.isPlayer) {
                a.age += 1; // 1 year per 2 seasons for balanced lifespan
                // Aging effects
                if (a.age >= 60) {
                    a.needs.rest = Math.max(0, a.needs.rest - 3); // elders tire faster
                }
                if (a.age >= 70) {
                    a.needs.comfort = Math.max(0, a.needs.comfort - 2);
                }
            }
        });
    }

    _checkDeaths(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        for (const npc of npcs) {
            let deathChance = 0;

            // Age-based mortality
            if (npc.age >= 80) deathChance = 0.08;
            else if (npc.age >= 70) deathChance = 0.03;
            else if (npc.age >= 60) deathChance = 0.01;

            // Mood modifier: very miserable people are more susceptible
            if (npc.mood < -50) deathChance += 0.01;

            // Disease event modifier
            if (world.events.activeEffects.disease) deathChance += 0.02;

            // Random accident (very rare)
            deathChance += 0.001;

            if (deathChance > 0 && Math.random() < deathChance) {
                this._killNpc(world, npc);
            }
        }
    }

    _killNpc(world, npc) {
        let cause;
        if (npc.age >= 70) cause = t('年老體衰');
        else if (world.events.activeEffects.disease) cause = t('突發疾病');
        else cause = pickRandom(DEATH_CAUSES.slice(1));

        const epitaph = this._generateEpitaph(npc);

        // Record in graveyard
        this.graveyard.push({
            name: npc.name, age: npc.age, gender: npc.gender,
            deathCause: cause, deathTick: world.tickCount,
            deathTime: world.clock.timeStr, epitaph: epitaph,
            job: npc.job?.title || t('無'), traits: npc.personality.traits.slice(0, 3),
        });

        // Notify the world
        world.logMessage('death', `⚰️ ${npc.name}${t('（')}${npc.age}${t('歲）因')}${cause}${t('離世了。')}${epitaph}`, npc.name);

        // Grief for related NPCs + mourning behavior
        Object.values(world.agents).forEach(a => {
            if (a.agentId === npc.agentId) return;
            const rel = a.relationships.relationships[npc.agentId];
            if (rel) {
                let grief = -5;
                let isFamily = false;
                if (rel.status === 'married' || rel.status === 'dating') { grief = -30; isFamily = true; }
                else if (rel.affinity > 50) grief = -20;
                else if (rel.affinity > 20) grief = -10;
                // Check parent-child relationship
                if (a._parentNames && a._parentNames.includes(npc.name)) isFamily = true;
                if (npc._parentNames && npc._parentNames.includes(a.name)) isFamily = true;
                a.moodModifier = (a.moodModifier || 0) + grief;
                if (isFamily || rel.affinity > 50) a.addThought('lost_loved_one', world, npc.agentId, npc.name); // v5.15.0 痛失至親
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `${npc.name}${t('去世了...我很難過。')}`, 9, [npc.name]);
                // Add mourning target — everyone with a relationship will visit graveyard
                if (!a.isPlayer && a._mourningTargets) {
                    a._mourningTargets.push({ name: npc.name, deathTick: world.tickCount, isFamily });
                }
                // Clear relationship status
                if (rel.status === 'married' || rel.status === 'dating') {
                    rel.status = 'ex'; rel.statusSince = world.tickCount;
                }
            }
        });

        // Town-wide mourning: even unacquainted NPCs pay brief respects
        Object.values(world.agents).forEach(a => {
            if (a.agentId === npc.agentId || a.isPlayer) return;
            if (!a.relationships.relationships[npc.agentId] && a._mourningTargets && Math.random() < 0.4) {
                a._mourningTargets.push({ name: npc.name, deathTick: world.tickCount, isFamily: false });
            }
        });

        // Town-wide mood hit
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== npc.agentId && !a.isPlayer) {
                a.moodModifier = (a.moodModifier || 0) - 3;
            }
        });

        world.gossipNetwork.activeGossip.push({
            about: npc.name, content: `${npc.name}${t('去世了...願他安息。')}`,
            source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${npc.name}${t('（')}${npc.age}${t('歲）因')}${cause}${t('離世了。')}${epitaph}`, 10, [npc.name]);

        // Remove from factions
        if (world.factions) {
            for (const faction of Object.values(world.factions.factions)) {
                faction.removeMember(npc.agentId);
            }
        }

        // Remove from factories
        if (world.processing) world.processing.removeWorker(npc.agentId);

        // Remove the agent
        world.removeAgent(npc.agentId);

        // Job vacancy - may need immigration
        world.events.TARGET_POPULATION = Math.max(world.events.TARGET_POPULATION,
            Object.values(world.agents).filter(a => !a.isPlayer).length + 1);
    }

    _checkBirths(world) {
        // Check for married couples (including player-NPC couples)
        const allAgents = Object.values(world.agents);
        for (const agent of allAgents) {
            if (agent.age < 20 || agent.age > 45) continue;
            const partner = agent.relationships.getPartner();
            if (!partner || partner.status !== 'married') continue;
            const otherAgent = world.agents[partner.targetId];
            if (!otherAgent) continue;

            // Only check once per couple (by comparing IDs)
            if (agent.agentId > partner.targetId) continue;

            // Player-NPC couples: mark child as player's child
            const involvesPlayer = agent.isPlayer || otherAgent.isPlayer;

            // Birth probability based on age and relationship quality
            const avgAge = (agent.age + otherAgent.age) / 2;
            let birthChance = 0.02;
            if (avgAge > 35) birthChance = 0.01;
            if (avgAge > 40) birthChance = 0.005;
            if (partner.affinity > 60) birthChance *= 1.5;

            // Population limits
            if (involvesPlayer) {
                // Player-NPC couples: max 3 children, no population cap
                const playerChildCount = (this.playerChildren || []).length;
                if (playerChildCount >= 3) continue;
            } else {
                // NPC-NPC couples: limited by total population
                const currentPop = Object.values(world.agents).filter(a => !a.isPlayer).length;
                if (currentPop >= 20) continue;
            }

            if (Math.random() < birthChance) {
                this._birthChild(world, agent, otherAgent, involvesPlayer);
            }
        }
    }

    _birthChild(world, parentA, parentB, isPlayerChild = false) {
        const gender = Math.random() < 0.5 ? 'male' : 'female';
        const namePool = gender === 'male' ? BABY_NAMES_MALE : BABY_NAMES_FEMALE;
        const usedNames = new Set(Object.values(world.agents).map(a => a.name));
        const graveyardNames = new Set(this.graveyard.map(g => g.name));
        const availableNames = namePool.filter(n => !usedNames.has(n) && !graveyardNames.has(n));
        const name = availableNames.length > 0 ? pickRandom(availableNames) :
            `${parentA.name.charAt(0)}${pickRandom(namePool).slice(-1)}`;

        // Inherit traits from parents
        const allTraits = [...parentA.personality.traits, ...parentB.personality.traits];
        const inheritedTraits = shuffle(allTraits).slice(0, 2);
        // Add one random new trait
        const POSSIBLE_TRAITS = ['kind','shy','charismatic','gossip','hardworking','lazy','perfectionist','creative','optimist','pessimist','neurotic','stoic','romantic','night_owl','early_bird'];
        const newTrait = pickRandom(POSSIBLE_TRAITS.filter(t => !inheritedTraits.includes(t)));
        inheritedTraits.push(newTrait);

        const values = shuffle([...parentA.personality.values, ...parentB.personality.values]).slice(0, 2);
        const background = `${parentA.name}${t('和')}${parentB.name}${t('的孩子。在邊境鎮出生長大。')}`;

        const personality = new Personality(inheritedTraits, background, values);
        const childAge = 16; // Start as young adult
        const agent = new Agent(`child_${world.tickCount}`, name, childAge, personality, null,
            parentA.homeLocation, gender);

        world.addAgent(agent);

        this.births.push({
            name, parentNames: [parentA.name, parentB.name],
            birthTick: world.tickCount, birthTime: world.clock.timeStr,
        });

        // Parents get mood boost
        parentA.moodModifier = (parentA.moodModifier || 0) + 25;
        parentB.moodModifier = (parentB.moodModifier || 0) + 25;
        parentA.memory.add(world.tickCount, world.clock.timeStr, 'relationship',
            `${t('我們的孩子')}${name}${t('出生了！')}`, 10, [parentB.name, name]);
        parentB.memory.add(world.tickCount, world.clock.timeStr, 'relationship',
            `${t('我們的孩子')}${name}${t('出生了！')}`, 10, [parentA.name, name]);

        // Set up parent-child relationships
        const relA = agent.relationships.getOrCreate(parentA.agentId, parentA.name);
        relA.modifyAffinity(50); relA.modifyTrust(40);
        const relB = agent.relationships.getOrCreate(parentB.agentId, parentB.name);
        relB.modifyAffinity(50); relB.modifyTrust(40);
        parentA.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);
        parentB.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);

        // Track player's children for inheritance
        if (isPlayerChild) {
            agent._isPlayerChild = true;
            agent._parentNames = [parentA.name, parentB.name];
            if (!this.playerChildren) this.playerChildren = [];
            this.playerChildren.push({ agentId: agent.agentId, name, parentNames: [parentA.name, parentB.name], birthTick: world.tickCount });
            world.logMessage('system', `🎉 ${t('你的孩子')}${name}${t('出生了！將來可以繼承你的一切。')}`);
        }

        // Town celebration
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== agent.agentId) {
                a.moodModifier = (a.moodModifier || 0) + 5;
            }
        });

        world.logMessage('birth', `🎒 ${parentA.name}${t('和')}${parentB.name}${t('的孩子')}${name}${t('出生了！全鎮慶祝！')}`, name);
        world.gossipNetwork.activeGossip.push({
            about: name, content: `${parentA.name}${t('和')}${parentB.name}${t('生了個')}${gender==='male'?t('男'):t('女')}${t('孩，取名')}${name}${t('！')}`,
            source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${parentA.name}${t('和')}${parentB.name}${t('的孩子')}${name}${t('出生了！')}`, 9, [parentA.name, parentB.name, name]);
    }

    _generateEpitaph(npc) {
        const lines = [];
        if (npc.job) lines.push(`${t('曾任')}${npc.job.title}`);
        if (npc.personality.traits.includes('kind')) lines.push(t('以善良著稱'));
        else if (npc.personality.traits.includes('hardworking')) lines.push(t('勤勞一生'));
        else if (npc.personality.traits.includes('creative')) lines.push(t('才華洋溢'));
        else if (npc.personality.traits.includes('charismatic')) lines.push(t('深受愛戴'));
        else lines.push(t('將被永遠懷念'));
        return lines.join(t('，')) + t('。');
    }

    toDict() {
        return {
            graveyard: this.graveyard.slice(-10000),
            births: this.births.slice(-10000),
            playerChildren: this.playerChildren || [],
            _daysSinceCheck: this._daysSinceCheck,
        };
    }
}

// --- Exploration / Map Expansion System ---
const EXPLORATION_ZONES = [
    { id:'deep_forest', name:t('幽深森林'), icon:'🌲', difficulty:2, distance:3,
      description:t('城鎮外的茂密森林，傳說中有稀有草藥和野生動物。'),
      rewards: { resources:{ wood:30, herbs:20 }, xpSkill:t('種植'), xpAmount:50 },
      events: [t('發現了一片珍貴的草藥田！'),t('遭遇了一群野狼，但成功擊退！'),t('找到了一個隱藏的獵人小屋。'),t('迷路了一陣子，但最終找到了回家的路。')] },
    { id:'ancient_ruins', name:t('古代遺跡'), icon:'🏛️', difficulty:4, distance:5,
      description:t('神秘的古代建築遺址，可能藏有珍貴的知識和寶物。'),
      rewards: { resources:{ silver:40, research_points:30 }, xpSkill:t('智識'), xpAmount:80 },
      events: [t('發現了古代文字記錄！'),t('觸發了一個古老的陷阱！'),t('找到了珍貴的古代文物。'),t('遺跡深處傳來神秘的聲音...')] },
    { id:'abandoned_mine', name:t('廢棄礦坑'), icon:'⛏️', difficulty:3, distance:4,
      description:t('一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。'),
      rewards: { resources:{ stone:25, metal:20 }, xpSkill:t('採礦'), xpAmount:60 },
      events: [t('發現了一條新的礦脈！'),t('礦坑塌方，但安全逃出！'),t('找到了前礦工留下的工具。'),t('在礦坑深處看到了奇異的光芒。')] },
    { id:'mountain_pass', name:t('山間隘口'), icon:'⛰️', difficulty:5, distance:6,
      description: t('通往外界的危險山路，但可能找到貿易路線和珍稀資源。'),
      rewards: { resources:{ silver:30, cloth:15, tools:10 }, xpSkill:t('近戰'), xpAmount:70 },
      events: [t('在山頂看到了壯麗的風景！'),t('遭遇山賊，經過一番苦戰取勝。'),t('發現了一條通往鄰鎮的捷徑。'),t('暴風雪來襲，艱難地撐了過去。')] },
    { id:'riverside_cave', name:t('河畔洞窟'), icon:'🕳️', difficulty:2, distance:2,
      description:t('河邊的一個神秘洞穴，經常有奇怪的回音。'),
      rewards: { resources:{ herbs:15, stone:10 }, xpSkill:t('建造'), xpAmount:40 },
      events: [t('在洞窟裡發現了古老的壁畫！'),t('找到了地下泉水，可能對鎮上的供水有幫助。'),t('洞窟深處有蝙蝠群棲息。'),t('發現了被水沖來的寶箱殘骸。')] },
    { id:'cursed_swamp', name:t('詛咒沼澤'), icon:'🌿', difficulty:4, distance:4,
      description:t('傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。'),
      rewards: { resources:{ herbs:30, medicine:10 }, xpSkill:t('醫療'), xpAmount:60 },
      events: [t('找到了極為罕見的藥用植物！'),t('陷入了沼澤泥潭，差點走不出來。'),t('遇到了一位隱居的老藥師。'),t('在沼澤中心發現了一塊奇怪的石頭。')] },
];

class ExplorationSystem {
    constructor() {
        this.discoveredZones = {};  // zoneId -> { discovered:bool, timesExplored:int, lastExploredTick }
        this.activeExpeditions = []; // { zoneId, agentIds[], departureTick, returnTick, status }
        this.expeditionLog = [];     // completed expedition results
        this._counter = 0;
    }

    dailyUpdate(world) {
        this._checkReturningExpeditions(world);
        this._autoDiscoverZones(world);
    }

    _autoDiscoverZones(world) {
        // Gradually discover zones based on town development
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const dayCount = world.clock.year * 60 + ([t('春季'),t('夏季'),t('秋季'),t('冬季')].indexOf(world.clock.season)) * 15 + world.clock.day;

        for (const zone of EXPLORATION_ZONES) {
            if (this.discoveredZones[zone.id]) continue;
            let discoverChance = 0;
            // Guards and researchers discover zones
            const explorers = Object.values(world.agents).filter(a =>
                a.job && (a.job.key === 'guard' || a.job.key === 'researcher'));
            if (explorers.length > 0) discoverChance = 0.02 * explorers.length;
            // Time-based discovery
            if (dayCount > 20) discoverChance += 0.01;
            if (dayCount > 40) discoverChance += 0.02;
            // Difficulty check
            discoverChance /= zone.difficulty;

            if (Math.random() < discoverChance) {
                this.discoveredZones[zone.id] = { discovered: true, timesExplored: 0, lastExploredTick: 0 };
                world.logMessage('exploration', `🗺️ ${t('發現了新的探索區域：')}${zone.icon} ${zone.name}${t('！')}${zone.description}`);
                world.events.conversationTopics.push(`${t('新發現的')}${zone.name}`);
                if (world.dailyNews) world.dailyNews.collectEvent('exploration', `${t('發現了新的探索區域：')}${zone.name}${t('！')}`, 7);
            }
        }
    }

    canSendExpedition(zoneId) {
        if (!this.discoveredZones[zoneId]) return false;
        // Check if not already exploring this zone
        return !this.activeExpeditions.some(e => e.zoneId === zoneId);
    }

    sendExpedition(world, zoneId, agentIds) {
        const zone = EXPLORATION_ZONES.find(z => z.id === zoneId);
        if (!zone || !this.canSendExpedition(zoneId)) return null;

        const agents = agentIds.map(id => world.agents[id]).filter(Boolean);
        if (agents.length === 0) return null;

        const returnTick = world.tickCount + 96 * zone.distance; // distance in days

        const expedition = {
            id: `exp_${++this._counter}`,
            zoneId, zoneName: zone.name, zoneIcon: zone.icon,
            agentIds: agents.map(a => a.agentId),
            agentNames: agents.map(a => a.name),
            departureTick: world.tickCount,
            returnTick: returnTick,
            status: 'travelling',
        };

        this.activeExpeditions.push(expedition);

        // Remove agents from town temporarily
        agents.forEach(a => {
            a.currentLocation = 'exploration';
            a.activity = 'exploring';
            a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                `${t('出發前往')}${zone.name}${t('探險！')}`, 7, agents.map(x => x.name));
        });

        const names = agents.map(a => a.name).join(t('、'));
        world.logMessage('exploration', `${zone.icon} ${names}${t('出發前往')}${zone.name}${t('探險了！預計')}${zone.distance}${t('天後返回。')}`);

        return expedition;
    }

    _checkReturningExpeditions(world) {
        const returning = this.activeExpeditions.filter(e => world.tickCount >= e.returnTick);

        for (const expedition of returning) {
            const zone = EXPLORATION_ZONES.find(z => z.id === expedition.zoneId);
            if (!zone) continue;

            const agents = expedition.agentIds.map(id => world.agents[id]).filter(Boolean);
            const teamSkill = agents.reduce((sum, a) => {
                const relevantSkill = a.skills.get(zone.rewards.xpSkill);
                return sum + (relevantSkill?.level || 1);
            }, 0) / Math.max(1, agents.length);

            // Success chance based on team skill vs difficulty
            const successChance = Math.min(0.95, 0.4 + (teamSkill / zone.difficulty) * 0.15);
            const isSuccess = Math.random() < successChance;

            const event = pickRandom(zone.events);
            let resultMsg = '';

            if (isSuccess) {
                // Give rewards
                const multiplier = 0.5 + teamSkill * 0.1;
                for (const [resource, amount] of Object.entries(zone.rewards.resources)) {
                    const gained = Math.floor(amount * multiplier);
                    world.stockpile.add(resource, gained);
                }
                // XP for participants
                agents.forEach(a => {
                    a.skills.addXp(zone.rewards.xpSkill, zone.rewards.xpAmount);
                    a.moodModifier = (a.moodModifier || 0) + 10;
                    a.currentLocation = a.homeLocation;
                    a.activity = 'idle';
                    a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                        `${t('從')}${zone.name}${t('探險歸來！')}${event}`, 8, agents.map(x => x.name));
                });

                resultMsg = `${zone.icon} ${t('探險隊從')}${zone.name}${t('凱旋歸來！')}${event}`;
                this.discoveredZones[zone.id].timesExplored++;
            } else {
                // Failed expedition - agents return wounded
                agents.forEach(a => {
                    a.moodModifier = (a.moodModifier || 0) - 15;
                    a.needs.rest = Math.max(0, a.needs.rest - 30);
                    a.needs.hunger = Math.max(0, a.needs.hunger - 20);
                    a.currentLocation = a.homeLocation;
                    a.activity = 'idle';
                    a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                        `${t('從')}${zone.name}${t('探險失敗返回...')}${event}`, 7, agents.map(x => x.name));
                });
                // Some resources still found
                for (const [resource, amount] of Object.entries(zone.rewards.resources)) {
                    world.stockpile.add(resource, Math.floor(amount * 0.2));
                }
                resultMsg = `${zone.icon} ${t('探險隊從')}${zone.name}${t('狼狽歸來...')}${event}`;
            }

            this.discoveredZones[zone.id].lastExploredTick = world.tickCount;
            expedition.status = isSuccess ? 'success' : 'failed';
            expedition.result = event;

            world.logMessage('exploration', resultMsg, agents.map(a => a.name).join(t('、')));
            if (world.dailyNews) world.dailyNews.collectEvent('exploration', resultMsg, isSuccess ? 7 : 5, agents.map(a => a.name));
            this.expeditionLog.push({
                ...expedition, completedTick: world.tickCount,
                success: isSuccess, event: event,
            });
        }

        this.activeExpeditions = this.activeExpeditions.filter(e => world.tickCount < e.returnTick);
    }

    toDict() {
        return {
            discoveredZones: { ...this.discoveredZones },
            activeExpeditions: this.activeExpeditions.map(e => ({ ...e })),
            expeditionLog: this.expeditionLog.slice(-10000),
            _counter: this._counter,
        };
    }
}

// --- Legacy / New Game+ System ---
class LegacySystem {
    // Collects inheritance data from the current world and applies it to a new one
    static collectLegacy(world) {
        const player = world.agents?.player;
        const npcs = Object.values(world.agents || {}).filter(a => !a.isPlayer);

        // Find player's children
        const playerChildren = npcs.filter(a => a._isPlayerChild);

        // Determine heir: oldest player child, or null
        let heir = null;
        if (playerChildren.length > 0) {
            heir = playerChildren.reduce((oldest, c) => c.age > oldest.age ? c : oldest, playerChildren[0]);
        }

        // Collect NPC memories about the player (for "remembering the previous generation")
        const npcMemories = {};
        for (const npc of npcs) {
            const relToPlayer = npc.relationships?.relationships?.player;
            if (relToPlayer && relToPlayer.affinity !== 0) {
                npcMemories[npc.agentId] = {
                    name: npc.name,
                    affinity: relToPlayer.affinity,
                    trust: relToPlayer.trust,
                    status: relToPlayer.status,
                    memories: npc.memory?.entries
                        ?.filter(m => m.relatedAgents?.includes(player?.name))
                        ?.slice(-5)
                        ?.map(m => m.content) || [],
                };
            }
        }

        // Collect ending stats
        const stats = world.multiEnding?._collectStats?.(world) || {};

        return {
            version: 1,
            generation: (world._legacyGeneration || 1),
            previousPlayerName: player?.name || t('旅人'),
            heir: heir ? {
                agentId: heir.agentId,
                name: heir.name,
                age: heir.age,
                gender: heir.gender,
                traits: heir.personality.traits,
                values: heir.personality.values,
                background: heir.personality.background,
                parentNames: heir._parentNames || [],
                skills: Object.fromEntries(Object.entries(heir.skills.skills).map(([k,s]) => [k, { xp: Math.floor(s.xp * 0.3), passion: s.passion }])),
            } : null,
            // 中度繼承: 50% silver
            silver: Math.floor((world.stockpile?.get('silver') || 0) * 0.5),
            food: Math.floor((world.stockpile?.get('food') || 0) * 0.3),
            // Keep completed buildings
            buildings: (world.buildings?.completed || []).map(b => ({ ...b })),
            // Keep industries (keys and levels)
            industries: world.industry ? JSON.parse(JSON.stringify(world.industry.industries || {})) : {},
            industryMeta: {
                townLevel: world.industry?.townLevel || 1,
                townLevelName: world.industry?.townLevelName || t('荒村'),
                maxIndustries: world.industry?.maxIndustries || 1,
                firstChoice: world.industry?.firstChoice || null,
            },
            // Prosperity (carry over partially)
            prosperity: Math.floor((world.prosperity?.prosperity || 0) * 0.6),
            // NPC memories of previous generation
            npcMemories,
            // Town history
            endingType: world.multiEnding?.endingTriggered || null,
            stats,
            // Farm data (partial)
            farms: world.farm ? JSON.parse(JSON.stringify(world.farm.farms || {})) : {},
            // Research progress (keep completed)
            research: world.research ? Object.fromEntries(
                Object.entries(world.research.projects)
                    .filter(([, p]) => p.completed)
                    .map(([k, p]) => [k, { ...p }])
            ) : {},
        };
    }

    static applyLegacy(world, legacy) {
        if (!legacy || legacy.version !== 1) return;

        world._legacyGeneration = (legacy.generation || 1) + 1;

        // --- Heir becomes new player ---
        if (legacy.heir) {
            const player = world.agents?.player;
            if (player) {
                player.name = legacy.heir.name;
                player.age = legacy.heir.age || 18;
                player.gender = legacy.heir.gender || 'male';
                player.personality = new Personality(
                    legacy.heir.traits || ['creative', 'kind'],
                    `${legacy.previousPlayerName}${t('的孩子。繼承了家業，在邊境鎮長大。第')}${world._legacyGeneration}${t('代。')}`,
                    legacy.heir.values || [t('冒險'), t('友情')]
                );
                // Inherit some skills (30%)
                if (legacy.heir.skills) {
                    for (const [sk, sv] of Object.entries(legacy.heir.skills)) {
                        const s = player.skills.get(sk);
                        if (s) { s.xp = sv.xp; s.passion = sv.passion; }
                    }
                }
            }
        } else {
            // No heir: new traveler with legacy background
            const player = world.agents?.player;
            if (player) {
                player.personality = new Personality(
                    ['creative', 'kind'],
                    `${t('收到了')}${legacy.previousPlayerName}${t('的遺產，來到邊境鎮開始新生活。第')}${world._legacyGeneration}${t('代。')}`,
                    [t('冒險'), t('友情')]
                );
            }
        }

        // --- Silver & food ---
        if (legacy.silver > 0) world.stockpile.add('silver', legacy.silver);
        if (legacy.food > 0) world.stockpile.add('food', legacy.food);

        // --- Buildings ---
        if (legacy.buildings?.length && world.buildings) {
            world.buildings.completed = legacy.buildings;
            // Re-apply building effects
            for (const b of legacy.buildings) {
                if (b.effects) {
                    for (const [k, v] of Object.entries(b.effects)) {
                        world.buildings.activeEffects[k] = (world.buildings.activeEffects[k] || 0) + v;
                    }
                }
            }
        }

        // --- Industries ---
        if (legacy.industries && Object.keys(legacy.industries).length > 0 && world.industry) {
            world.industry.industries = legacy.industries;
            // Clear workers from inherited industries (they're from last gen)
            for (const ind of Object.values(world.industry.industries)) {
                ind.workers = [];
            }
            world.industry.townLevel = legacy.industryMeta?.townLevel || 1;
            world.industry.townLevelName = legacy.industryMeta?.townLevelName || t('荒村');
            world.industry.maxIndustries = legacy.industryMeta?.maxIndustries || 1;
            world.industry.firstChoice = legacy.industryMeta?.firstChoice || null;
            world.industry.needsIndustryChoice = false;
            world.industry._updateSynergies?.();
        }

        // --- Prosperity ---
        if (legacy.prosperity > 0 && world.prosperity) {
            world.prosperity.prosperity = legacy.prosperity;
            world.prosperity._updateLevel?.();
        }

        // --- Research (keep completed) ---
        if (legacy.research && world.research) {
            for (const [k, p] of Object.entries(legacy.research)) {
                if (world.research.projects[k]) {
                    Object.assign(world.research.projects[k], p);
                }
            }
        }

        // --- Farm plots (keep planted) ---
        if (legacy.farms && Object.keys(legacy.farms).length > 0 && world.farm) {
            for (const [k, f] of Object.entries(legacy.farms)) {
                if (world.farm.farms[k]) {
                    world.farm.farms[k].unlocked = f.unlocked;
                    // Don't carry over crop state, just the unlocked status
                }
            }
        }

        // --- NPC memories of previous generation ---
        // NPCs that survived from last gen will remember the previous player
        if (legacy.npcMemories) {
            for (const npc of Object.values(world.agents).filter(a => !a.isPlayer)) {
                const prevMemory = legacy.npcMemories[npc.agentId];
                if (prevMemory) {
                    // Transfer affinity as "memory of the parent" -> goodwill toward child
                    const rel = npc.relationships.getOrCreate('player', world.agents.player?.name || t('旅人'));
                    const inheritedAffinity = Math.floor(prevMemory.affinity * 0.5);
                    const inheritedTrust = Math.floor(prevMemory.trust * 0.3);
                    rel.modifyAffinity(inheritedAffinity);
                    rel.modifyTrust(inheritedTrust);
                    // Add a memory about the previous generation
                    npc.memory.add(0, t('第1年 春季 第1天 6:00'),  'legacy',
                        `${legacy.previousPlayerName}${t('的')}${legacy.heir ? t('孩子') : t('繼承人')}${t('來到了鎮上。想起了和')}${legacy.previousPlayerName}${t('的日子。')}`,
                        8, [world.agents.player?.name || t('旅人'), legacy.previousPlayerName]);
                }
            }
        }

        // --- Log the inheritance ---
        const heirName = legacy.heir?.name || t('新旅人');
        world.logMessage('system', `📜 ${t('第')}${world._legacyGeneration}${t('代開始！')}${heirName}${t('繼承了')}${legacy.previousPlayerName}${t('的遺產。')}`);
        world.logMessage('system', `💰 ${t('繼承銀幣')} ${legacy.silver}${t('，已建建築')} ${legacy.buildings?.length || 0} ${t('棟，產業')} ${Object.keys(legacy.industries || {}).length} ${t('個。')}`);
        if (legacy.endingType) {
            world.logMessage('system', `📖 ${t('上一代結局：')}${legacy.endingType}${t('。鎮民們仍然記得')}${legacy.previousPlayerName}${t('的故事。')}`);
        }
    }
}

// --- World ---
class World {
    constructor() {
        this.clock = new GameClock();
        this.events = new EventSystem();
        this.election = new ElectionSystem();
        this.agents = {};
        this.townMap = null;
        this.tickCount = 0;
        this.paused = false;
        this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
        this.conversationEngine = new ConversationEngine();
        // Economy
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
        // New systems
        this.factions = new FactionSystem();
        this.festivals = new FestivalSystem();
        this.lifecycle = new LifecycleSystem();
        this.exploration = new ExplorationSystem();
        // v3 systems
        this.industry = new IndustryManager();
        this.farm = new FarmSystem();
        this.processing = new ProcessingSystem();
        this.dailyNews = new DailyNewsEngine();
        this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
        this.lifeGoals = new LifeGoalSystem(); // v5.4.0 人生故事線
        this.customNPC = typeof CustomNPCSystem !== 'undefined' ? new CustomNPCSystem() : null;
        this.multiEnding = typeof MultiEndingSystem !== 'undefined' ? new MultiEndingSystem() : null;
        // v4.0 systems
        this.dailyDecision = new DailyDecisionSystem();
        this.shop = new ShopSystem();
        this.eventChoice = new EventChoiceSystem();
        this.rogueCards = new RogueCardSystem(); // v5.28.0 際遇卡
        this.npcHelp = new NPCHelpSystem();
        this.reputationSystem = new ReputationSystem();
        this.weather = new WeatherSystem();
        this.council = new CouncilSystem();
    }
    addAgent(agent) { this.agents[agent.agentId] = agent; }
    removeAgent(id) { delete this.agents[id]; }
    getAgent(id) { return this.agents[id] || null; }
    getAgentByName(name) { return Object.values(this.agents).find(a => a.name === name) || null; }
    getAgentsAtLocation(locId) { return Object.values(this.agents).filter(a => a.currentLocation === locId); }
    logMessage(type, content, agentName = '', targetName = '') {
        this.messageLog.push({ time:this.clock.timeStr, tick:this.tickCount, type, content, agent:agentName, target:targetName });
        if (this.messageLog.length > 10000) this.messageLog = this.messageLog.slice(-10000);
    }
    tick() {
        if (this.paused) return;
        this.tickCount++;
        const timeEvents = this.clock.tick();
        if (timeEvents.includes('new_day')) {
            // v5.34.0 逾時代選:互動選擇放超過一個遊戲日沒人理,小鎮自行決定,避免卡住事件線
            this._autoResolveStaleChoices();
            const event = this.events.dailyUpdate(this);
            if (event) {
                this.logMessage('event', `[${event.severity.toUpperCase()}] ${event.name}: ${event.description}`);
                // v4.0: Offer player a choice for significant events
                // v5.32.0 第二章(繁榮 20)起才把事件應對交給玩家,第一章自動結算不打擾
                if (event.severity !== 'minor' && this.eventChoice && (this.prosperity?.prosperity || 0) >= 20) {
                    this.eventChoice.offerChoice(event, this);
                }
                // Only auto-apply mood if no choice was offered
                if (!this.eventChoice?.pendingEvent && event.effects.mood_all != null) {
                    Object.values(this.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + event.effects.mood_all; });
                }
                if (this.dailyNews) this.dailyNews.collectEvent('event', `${event.name}${t('：')}${event.description}`, event.severity === 'critical' ? 10 : event.severity === 'major' ? 8 : 5);
            }
            // Relationship progression (dating, marriage, breakup, etc.)
            this._processRelationships();
            // Daily news (before economy/events so modifiers apply)
            this.news.dailyUpdate(this);
            // Daily economy
            processDailyProduction(this);
            this.stockpile.history.filter(h=>h.amount>0).slice(-50).forEach(h=>this.workOrders.updateProgress(h.resource,h.amount));
            this.buildings.dailyConstruction(this);
            this.trade.dailyUpdate(this);
            this.research.dailyUpdate(this);
            this.workOrders.cleanup();
            // Election system
            const electionEvent = this.election.dailyUpdate(this);
            if (electionEvent) {
                this.logMessage('event', `[${electionEvent.severity.toUpperCase()}] ${electionEvent.name}: ${electionEvent.description}`);
                if (this.dailyNews) this.dailyNews.collectEvent('politics', `${electionEvent.name}${t('：')}${electionEvent.description}`, 8);
            }
            // New systems daily updates
            this.factions.dailyUpdate(this);
            this.festivals.dailyUpdate(this);
            this.townIdentity.dailyUpdate(this); // v5.19.0 城鎮身分逐日累積並結晶
            this.checkHeartEvents(); // v5.0.0 每日掃描心動事件門檻
            this._processThoughts(); // v5.15.0 記憶想法:清過期 + 對特定對象的好感漂移
            // v5.29.0 記憶流每日反思(規則式 + 每天至多 1 次 LLM),並重置 NPC 對話 LLM 額度
            this.conversationEngine.dailyReflection(this).catch(e => console.warn('[RimTown] reflection error:', e));
            this.npcLlmUsedToday = 0;
            // v5.30.0 每天早上為每位村民生成今日目標(規則式,依性格+人際+夢想+事件)
            Object.values(this.agents).forEach(a => { if (!a.isPlayer && !a.isDead && a.generateDailyPlan) { try { a.generateDailyPlan(this); } catch (e) {} } });
            // v5.37.0 全鎮 LLM 行程:排隊逐位生成「近況修訂+分解式行程」,規則式行程作為墊底
            try { this.conversationEngine.queueDailyPlans(this); } catch (e) {}
            this.generateDailyFeedPosts(); // v5.2.0 鎮民動態每日發文
            if (this.clock.day % 7 === 0) this.generateWeeklyDigest(); // v5.3.0 每 7 天小鎮頭條
            this.lifecycle.dailyUpdate(this);
            this.exploration.dailyUpdate(this);
            // v3 systems daily updates
            this.industry.dailyUpdate(this);
            this.farm.dailyUpdate(this);
            this.processing.dailyUpdate(this);
            this.npcEvents.dailyUpdate(this);
            if (this.prosperity) this.prosperity.dailyUpdate(this);
            if (this.npcQuests) this.npcQuests.dailyUpdate(this);
            if (this.lifeGoals) this.lifeGoals.dailyUpdate(this); // v5.4.0
            if (this.questSystem) this.questSystem.checkProgress(this);
            // v4.0 systems
            // v5.32.0 章節門檻:互動卡片第二章(繁榮 20)起、議會第四章(繁榮 70)起才啟動
            const chapterPros = this.prosperity?.prosperity || 0;
            if (chapterPros >= 20) this.dailyDecision.dailyUpdate(this);
            if (chapterPros >= 20) this.rogueCards.dailyUpdate(this); // v5.28.0 際遇卡每日抽
            this.dailyDecision.processFollowups(this);
            if (chapterPros >= 20) this.npcHelp.dailyUpdate(this);
            this.reputationSystem.dailyUpdate(this);
            this.weather.dailyUpdate(this);
            if (chapterPros >= 70) this.council.dailyUpdate(this);
            // AI Daily News (async, fire-and-forget)
            this.dailyNews.generateNewspaper(this).catch(e => console.warn('[DailyNews] Error:', e));
            // v5.31.0 今日焦點:回答「我現在該做什麼、為什麼」(放最後,讓它讀得到當日 pending 狀態)
            try { this.generateDailyFocus(); } catch (e) { console.warn('[RimTown] daily focus error:', e); }
        }
        Object.values(this.agents).forEach(agent => {
            if (agent.currentLocation === 'exploration') return; // Skip agents on expedition
            agent.update(this);
        });
        // NPC proactive messaging to player
        this.conversationEngine.tickProactiveMessages(this).catch(e => console.warn('[RimTown] Proactive msg error:', e));
        // v5.37.0 每個 tick 處理一位排隊中的村民 LLM 行程(避免清晨瞬間打爆 API)
        this.conversationEngine.tickPlanQueue(this).catch(e => console.warn('[RimTown] plan queue error:', e));
    }
    // v5.34.0 逾時代選:pending 的互動選擇滿一個遊戲日(96 ticks)沒人處理就隨機結算
    _autoResolveStaleChoices() {
        const DAY = 96;
        const pickLog = (what, label) => this.logMessage('event_choice', `⏳ ${t('你遲遲沒有決定,小鎮自行處理了「')}${what}${t('」:')}${label}`);
        try {
            const ev = this.eventChoice?.pendingEvent;
            if (ev && this.tickCount - (ev.timestamp || 0) >= DAY) {
                const i = randInt(0, ev.choices.length - 1);
                const label = ev.choices[i]?.label || '';
                this.eventChoice.resolveChoice(i, this);
                pickLog(ev.eventName, label);
            }
        } catch (e) {}
        try {
            const dd = this.dailyDecision?.pendingDecision;
            const todayKey = `${this.clock.year}-${this.clock.season}-${this.clock.day}`;
            if (dd && dd.dayKey !== todayKey) {
                const c = Math.random() < 0.5 ? 'A' : 'B';
                const label = (c === 'A' ? dd.optionA : dd.optionB)?.label || '';
                this.dailyDecision.resolveDecision(c, this);
                pickLog(dd.title, label);
            }
        } catch (e) {}
        try {
            const hq = this.npcHelp?.pendingRequest;
            if (hq && hq.tick != null && this.tickCount - hq.tick >= DAY) {
                const c = Math.random() < 0.5 ? 'A' : 'B';
                const label = (c === 'A' ? hq.optionA : hq.optionB)?.label || '';
                this.npcHelp.resolveRequest(c, this);
                pickLog(`${hq.npcName}${t('的請求')}`, label);
            }
        } catch (e) {}
        try {
            const rc = this.rogueCards?.pending;
            if (rc && this.tickCount - (rc.stamp || 0) >= DAY) {
                const i = randInt(0, rc.choices.length - 1);
                const label = rc.choices[i]?.label || '';
                this.rogueCards.resolve(i, this);
                pickLog(rc.title, label);
            }
        } catch (e) {}
    }

    // v5.31.0 今日焦點:每天從小鎮當前狀態挑 2-3 個「有理由的具體行動」
    // 每項 { icon, text, reason, npcId?|tab? } — npcId 點了開資訊卡,tab 點了跳分頁
    generateDailyFocus() {
        const items = [];
        const player = this.agents['player'];
        const npcOf = (name) => Object.values(this.agents).find(a => !a.isPlayer && !a.isDead && a.name === name);
        // 1) 有人在等你的回應(最高優先)
        if (this.npcHelp?.pendingRequest) {
            const req = this.npcHelp.pendingRequest;
            items.push({ icon: '🙏', text: `${req.npcName || t('有村民')}${t('正在等你幫忙')}`, reason: t('回應會直接影響他對你的信任'), npcId: req.npcId || null, tab: req.npcId ? null : 'events' });
        }
        if (this.eventChoice?.pendingEvent) {
            items.push({ icon: '⚠️', text: `${t('「')}${this.eventChoice.pendingEvent.name || t('重大事件')}${t('」需要你決定怎麼應對')}`, reason: t('放著不管會自動發展,後果未必是你要的'), tab: 'events' });
        }
        if (this.dailyDecision?.pendingDecision && items.length < 2) {
            items.push({ icon: '🗂️', text: t('有村民來找你商量一件事'), reason: t('今天的選擇會留下長期影響'), tab: 'events' });
        }
        // 2) 選舉期(v5.38.0 玩家可以親自參選)
        if (this.election?.phase === 'campaign') {
            const isCand = this.election.candidates?.some(c => c.agentId === 'player');
            if (isCand) {
                items.push({ icon: '👑', text: t('你正在競選鎮長!去找村民聊天,用「說服」為自己拉票'), reason: `${t('競選只剩')} ${this.election.campaignDaysLeft} ${t('天,每位村民只能拉一次票')}`, tab: 'events' });
            } else if (this.election.playerEligibility?.(this)?.ok) {
                items.push({ icon: '🗳️', text: t('選舉開跑了!你已符合參選資格——要不要自己出馬選鎮長?'), reason: t('到「事件」分頁登記參選,錯過要再等一年'), tab: 'events' });
            } else {
                items.push({ icon: '🗳️', text: t('選舉開跑了!去跟村民聊聊,用「說服」幫你支持的人拉票'), reason: `${t('競選只剩')} ${this.election.campaignDaysLeft} ${t('天')}`, tab: 'events' });
            }
        } else if (this.election?.phase === 'voting') {
            const isCand = this.election.candidates?.some(c => c.agentId === 'player');
            items.push({ icon: '🗳️', text: isCand ? t('投票進行中!你也在選票上——把握最後機會拉票') : t('投票中!去投下你的一票'), reason: t('你的一票可能改變小鎮未來的政策'), tab: 'events' });
        }
        // 3) 昨天的劇情餘波:名場面當事人值得關心
        const arc = (this.dramaArchive || []).slice(-1)[0];
        if (arc && items.length < 3) {
            const sameYear = arc.year === this.clock.year && arc.season === this.clock.season;
            const dayDiff = sameYear ? this.clock.day - arc.day : 99;
            if (dayDiff >= 0 && dayDiff <= 1) {
                const who = npcOf(arc.aName) || npcOf(arc.bName);
                if (who) items.push({ icon: '🎭', text: `${arc.aName}${t('和')}${arc.bName}${t('之間剛發生大事(')}${arc.title}${t('),去關心一下')}${who.name}`, reason: t('這時候的陪伴最能改變關係'), npcId: who.agentId });
            }
        }
        // 4) 祭典
        const fest = this.festivals?.activeFestival;
        if (fest && items.length < 3) {
            items.push({ icon: fest.icon || '🎪', text: `${t('今天有')}${fest.name}${t('!去會場逛逛、玩攤位')}`, reason: t('祭典期間村民好感更容易提升'), tab: 'events' });
        }
        // 5) 好感度接近心動門檻的村民:再推一把
        if (player && items.length < 3) {
            const thresholds = [25, 55, 80];
            let best = null;
            for (const a of Object.values(this.agents)) {
                if (a.isPlayer || a.isDead) continue;
                const aff = a.relationships.relationships['player']?.affinity || 0;
                for (const th of thresholds) {
                    if (aff >= th - 6 && aff < th) {
                        if (!best || aff > best.aff) best = { a, aff, th };
                    }
                }
            }
            if (best) items.push({ icon: '💗', text: `${t('和')}${best.a.name}${t('的關係就差一點點了,去聊聊天或送個小禮物')}`, reason: t('關係更近時,他會對你說出真心話'), npcId: best.a.agentId });
        }
        // 6) 保底:找最好的朋友敘舊
        if (player && !items.length) {
            const bf = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead)
                .sort((x, y) => (y.relationships.relationships['player']?.affinity || 0) - (x.relationships.relationships['player']?.affinity || 0))[0];
            if (bf) items.push({ icon: '💬', text: `${t('今天挺平靜的,去找')}${bf.name}${t('聊聊天吧')}`, reason: t('常聊天他會記得你、跟你越來越熟'), npcId: bf.agentId });
        }
        this.dailyFocus = { key: `${this.clock.year}-${this.clock.season}-${this.clock.day}`, items: items.slice(0, 3) };
        return this.dailyFocus;
    }

    getState() {
        return {
            clock: this.clock.toDict(), tick: this.tickCount, paused: this.paused,
            agents: Object.fromEntries(Object.entries(this.agents).map(([id,a]) => [id, a.toDict()])),
            locations: this.townMap?.toDict() || {},
            recent_events: this.events.getRecentEvents().map(([t,e]) => ({time:t, name:e.name, description:e.description, severity:e.severity, event_type:e.event_type})),
            recent_messages: this.messageLog.slice(-10000),
            travelling_agents: this.events.getTravellingAgents(),
            active_chains: this.events.getActiveChains(),
            stockpile: this.stockpile.toDict(),
            buildings: this.buildings.toDict(),
            trade: this.trade.toDict(),
            research: this.research.toDict(),
            work_orders: this.workOrders.toDict(),
            news: this.news.toDict(),
            npc_conversations: this.conversationEngine.npcConversationLog.slice(-10000),
            election: this.election.toDict(),
            factions: this.factions.toDict(),
            festivals: this.festivals.toDict(),
            lifecycle: this.lifecycle.toDict(),
            exploration: this.exploration.toDict(),
            industry: this.industry.toDict(),
            farm: this.farm.toDict(),
            processing: this.processing.toDict(),
            dailyNews: this.dailyNews.toDict(),
            townIdentity: this.townIdentity.toDict(),
            dramaArchive: (this.dramaArchive || []).slice(-40),
            npcEvents: this.npcEvents.toDict(),
            questSystem: this.questSystem ? this.questSystem.toDict() : null,
            prosperity: this.prosperity ? this.prosperity.toDict() : null,
            npcQuests: this.npcQuests ? this.npcQuests.toDict() : null,
            customNPC: this.customNPC ? this.customNPC.toDict() : null,
            multiEnding: this.multiEnding ? this.multiEnding.toDict() : null,
            // v4.0
            dailyDecision: this.dailyDecision.toDict(),
            shop: this.shop.toDict(),
            eventChoice: this.eventChoice.toDict(),
            rogueCards: this.rogueCards.toDict(),
            npcHelp: this.npcHelp.toDict(),
            reputationSystem: this.reputationSystem.toDict(),
            weather: this.weather.toDict(),
            council: (() => { const cd = this.council.toDict(); cd.memberNames = this.council.members.map(id => this.agents[id]?.name || '?'); return cd; })(),
            lifeGoals: (() => { const m = {}; if (this.lifeGoals) for (const a of Object.values(this.agents)) { if (a.isPlayer) continue; const d = this.lifeGoals.describe(a.agentId); if (d) m[a.agentId] = d; } return m; })(),
        };
    }
    reset(seed = null) {
        this.clock.reset(); this.events = new EventSystem(); this.election = new ElectionSystem();
        this.agents = {}; this.tickCount = 0; this.paused = false; this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
        this.factions = new FactionSystem();
        this.festivals = new FestivalSystem();
        this.lifecycle = new LifecycleSystem();
        this.exploration = new ExplorationSystem();
        this.industry = new IndustryManager();
        this.farm = new FarmSystem();
        this.processing = new ProcessingSystem();
        this.dailyNews = new DailyNewsEngine();
        this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
        this.lifeGoals = new LifeGoalSystem(); // v5.4.0 人生故事線
        this.customNPC = typeof CustomNPCSystem !== 'undefined' ? new CustomNPCSystem() : null;
        this.multiEnding = typeof MultiEndingSystem !== 'undefined' ? new MultiEndingSystem() : null;
        // v4.0 systems
        this.dailyDecision = new DailyDecisionSystem();
        this.shop = new ShopSystem();
        this.eventChoice = new EventChoiceSystem();
        this.rogueCards = new RogueCardSystem(); // v5.28.0 際遇卡
        this.npcHelp = new NPCHelpSystem();
        this.reputationSystem = new ReputationSystem();
        this.weather = new WeatherSystem();
        this.council = new CouncilSystem();
        this.conversationEngine = new ConversationEngine(this.conversationEngine?.llm);
        this.townMap = generateRandomTown(seed);
        // v5.27.0 肉鴿:隨機開局模式(rosterMode='random')抽全新村民,否則用劇本卡司
        if (this.rosterMode === 'random') this._loadRandomResidents(15);
        else this._loadDefaultResidents();
        const player = new PlayerAgent();
        this.addAgent(player);
    }
    startNewGamePlus() {
        // Collect legacy from current world state
        const legacy = LegacySystem.collectLegacy(this);
        // Reset the world
        this.reset();
        // Apply legacy data to the fresh world
        LegacySystem.applyLegacy(this, legacy);
        return legacy;
    }
    _processRelationships() {
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer);
        for (const agent of npcs) {
            for (const rel of Object.values(agent.relationships.relationships)) {
                const other = this.agents[rel.targetId];
                if (!other || other.isPlayer) continue;
                // Only process each pair once (avoid duplicate events)
                if (agent.agentId > rel.targetId) continue;
                const otherRel = other.relationships.getOrCreate(agent.agentId, agent.name);

                // --- Relationship decay: affinity drifts toward 0 without interaction ---
                const ticksSinceLast = this.tickCount - (rel.lastInteractionTick || 0);
                if (ticksSinceLast > 50) {
                    // Married/dating couples decay slower
                    const isCouple = rel.status === 'married' || rel.status === 'dating';
                    const decayRate = isCouple ? 0.3 : 0.8;
                    if (rel.affinity > 5) { rel.modifyAffinity(-decayRate); otherRel.modifyAffinity(-decayRate); }
                    // v5.3.0: 心動只在感情疏遠(好感低於30)時才衰退。親密的人會持續累積心動,
                    // 這是原本戀愛談不成的根因——心動被固定衰退壓在門檻下
                    if (rel.romanticInterest > 5 && !isCouple && rel.affinity < 30) { rel.modifyRomantic(-0.5); otherRel.modifyRomantic(-0.5); }
                }

                // --- Natural romantic attraction growth (v5.3.0 大幅加速) ---
                // 只要有基本好感與幾次互動,相配的人就會慢慢心動
                if (!rel.status && rel.affinity > 20 && rel.interactionCount > 3) {
                    const tA = agent.personality.traits;
                    const tB = other.personality.traits;
                    let compat = 1; // v5.3.0 基礎相容度 1(讓一般人也有機會),而非 0
                    if (tA.includes('romantic') || tB.includes('romantic')) compat += 2;
                    if (tA.includes('romantic') && tB.includes('romantic')) compat += 1;
                    if (tA.includes('shy') && tB.includes('kind')) compat += 1;
                    if (tA.includes('kind') && tB.includes('shy')) compat += 1;
                    if (tA.includes('charismatic') || tB.includes('charismatic')) compat += 1;
                    if (tA.includes('creative') && tB.includes('creative')) compat += 1;
                    if (tA.includes('optimist') && tB.includes('optimist')) compat += 1;
                    if (tA.includes('abrasive') && tB.includes('abrasive')) compat -= 2;
                    if (tA.includes('jealous') || tB.includes('jealous')) compat -= 1;
                    const affinityBonus = Math.floor(rel.affinity / 20); // v5.3.0 每20好感 +1(原25)
                    const charmBonus = Math.floor((other.attr('charm') - 5) / 2); // v5.26.0 對方越有魅力越讓人心動
                    const growth = Math.max(0, affinityBonus + compat + charmBonus);
                    // v5.3.0: 機率 0.45(原0.25)、增量最高 5(原3),讓心動能追過衰退、跨過門檻
                    if (growth > 0 && Math.random() < 0.45) {
                        rel.modifyRomantic(randInt(1, Math.min(growth + 1, 5)));
                    }
                    // v5.3.0 來電火花:高好感+高相容,偶爾一次大跳躍(命中注定的感覺)
                    if (rel.affinity > 45 && compat >= 3 && rel.romanticInterest > 15 && Math.random() < 0.06) {
                        const spark = randInt(8, 16);
                        rel.modifyRomantic(spark);
                        this.logMessage('relationship', `💓 ${agent.name}${t('對')}${other.name}${t('的心動,好像悄悄加深了...')}`, agent.name, other.name);
                        if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'crush', agent, other);
                    }
                    // v5.3.0 日久生情的回應:agent 對 other 明顯有意,若 other 對 agent 也親近且沒別的對象,
                    // other 有機會回應這份心動——這是讓「單戀」有機會變「兩情相悅」的關鍵
                    if (rel.romanticInterest > 40 && otherRel.affinity > 30 && !otherRel.status &&
                        otherRel.romanticInterest < rel.romanticInterest) {
                        const otherPartner = other.relationships.getPartner();
                        const otherCrush = Object.values(other.relationships.relationships).find(r => r.romanticInterest > 55 && r.targetId !== agent.agentId);
                        if (!otherPartner && !otherCrush && Math.random() < 0.3) {
                            otherRel.modifyRomantic(randInt(2, 5));
                        }
                    }
                }

                // --- v5.3.0 單戀受挫 & 情敵嫉妒 ---
                // agent 深深暗戀 other,但 other 已經名花有主 → agent 心碎,並嫉妒那個「幸運兒」
                if (!rel.status && rel.romanticInterest > 45) {
                    const otherPartner = other.relationships.getPartner();
                    if (otherPartner && otherPartner.targetId !== agent.agentId) {
                        const luckyOne = this.agents[otherPartner.targetId];
                        if (luckyOne && !luckyOne.isPlayer && Math.random() < 0.13) { // v5.22.0 加溫:單戀嫉妒更常燒起來
                            const jealousRel = agent.relationships.getOrCreate(luckyOne.agentId, luckyOne.name);
                            // 心動越深恨越重;已經在恨了就繼續往下探(讓三角戀燒成真正的仇敵)
                            const bite = jealousRel.affinity < 0 ? randInt(8, 16) : randInt(6, 12);
                            jealousRel.modifyAffinity(-bite);
                            agent.addThought('jealous', this, luckyOne.agentId, luckyOne.name); // v5.15.0 嫉妒的煎熬
                            agent.moodModifier = (agent.moodModifier || 0) - 6;
                            rel.modifyRomantic(-randInt(2, 5)); // 慢慢死心
                            this.logMessage('relationship', `💔 ${agent.name}${t('看著')}${other.name}${t('和')}${luckyOne.name}${t(',心裡很不是滋味...')}`, agent.name, luckyOne.name);
                            if (this.gossipNetwork && Math.random() < 0.4) this.gossipNetwork.createRelGossip(this, 'jealous', agent, luckyOne, other.name);
                        }
                    } else {
                        // other 還單身,但另有他人也強烈喜歡 other → 情敵!agent 對情敵生恨
                        for (const rival of npcs) {
                            if (rival === agent || rival === other || rival.isPlayer) continue;
                            const rivalCrush = rival.relationships.relationships[other.agentId];
                            if (rivalCrush && rivalCrush.romanticInterest > 40 && Math.random() < 0.20) { // v5.22.0 加溫:情敵更容易結樑子
                                const feud = agent.relationships.getOrCreate(rival.agentId, rival.name);
                                const feudBack = rival.relationships.getOrCreate(agent.agentId, agent.name);
                                // 情敵之恨蓋過友情:已在敵對就繼續探底,直到真正水火不容
                                const bite = feud.affinity < -10 ? randInt(10, 20) : randInt(8, 15);
                                feud.modifyAffinity(-bite); feudBack.modifyAffinity(-bite);
                                feud.modifyTrust(-5); feudBack.modifyTrust(-5);
                                if (!feud._rivalGossiped && feud.affinity <= -25) {
                                    feud._rivalGossiped = true;
                                    agent.addThought('rival_formed', this, rival.agentId, rival.name); // v5.15.0 結了樑子
                                    rival.addThought('rival_formed', this, agent.agentId, agent.name);
                                    this.logMessage('relationship', `⚡ ${agent.name}${t('和')}${rival.name}${t('為了')}${other.name}${t('暗自較勁,關係越來越僵...')}`, agent.name, rival.name);
                                    if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'rivalry', agent, rival);
                                }
                                break;
                            }
                        }
                    }
                }

                // --- v5.3.0 個性摩擦:合不來的人偶爾會起口角,好感下滑(製造仇敵的土壤) ---
                if (rel.interactionCount > 3 && !rel.status) {
                    const tA = agent.personality.traits, tB = other.personality.traits;
                    let friction = 0;
                    for (const [x, y] of INCOMPATIBLE) {
                        if ((tA.includes(x) && tB.includes(y)) || (tA.includes(y) && tB.includes(x))) friction += 2;
                    }
                    if (tA.includes('abrasive') || tB.includes('abrasive')) friction += 1;
                    if (tA.includes('jealous') && tB.includes('charismatic')) friction += 1;
                    if (friction > 0 && Math.random() < 0.16) { // v5.22.0 加溫:合不來的人更常起口角
                        rel.modifyAffinity(-randInt(2, friction + 2));
                        otherRel.modifyAffinity(-randInt(2, friction + 2));
                    }
                }
                // v5.3.0 剛剛跌破仇敵線 → 生成仇敵八卦(一次)
                if (rel.affinity <= -40 && !rel._rivalGossiped) {
                    rel._rivalGossiped = true;
                    agent.moodModifier = (agent.moodModifier || 0) - 4;
                    if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'rivalry', agent, other);
                }

                // --- Start Dating ---
                if (!rel.status && !otherRel.status) {
                    const agentHasPartner = agent.relationships.getPartner();
                    const otherHasPartner = other.relationships.getPartner();
                    if (!agentHasPartner && !otherHasPartner &&
                        rel.romanticInterest > 50 && otherRel.romanticInterest > 35 &&
                        rel.affinity > 30 && otherRel.affinity > 20 && Math.random() < 0.2) {
                        rel.status = 'dating'; rel.statusSince = this.tickCount;
                        otherRel.status = 'dating'; otherRel.statusSince = this.tickCount;
                        this.queueDramaScene('confession', agent, other); // v5.1.0 名場面
                        agent.addThought('got_together', this, other.agentId, other.name); other.addThought('got_together', this, agent.agentId, agent.name);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('開始交往了！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('開始交往了！')}`, 9, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('開始交往了！')}`, 9, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) + 20;
                        other.moodModifier = (other.moodModifier || 0) + 20;
                        this.gossipNetwork.createRelGossip(this, 'newCouple', agent, other); // v5.3.0 有內容八卦
                    }
                }

                // --- Proposal / Marriage (from dating) ---
                if (rel.status === 'dating' && otherRel.status === 'dating') {
                    const datingDuration = this.tickCount - rel.statusSince;
                    // Need to have been dating for a while, high affinity and romantic
                    if (datingDuration > 300 && rel.affinity > 50 && rel.romanticInterest > 55 &&
                        otherRel.affinity > 45 && otherRel.romanticInterest > 45 && Math.random() < 0.10) {
                        rel.status = 'married'; rel.statusSince = this.tickCount;
                        otherRel.status = 'married'; otherRel.statusSince = this.tickCount;
                        this.queueDramaScene('wedding', agent, other); // v5.1.0 名場面
                        agent.addThought('married', this, other.agentId, other.name); other.addThought('married', this, agent.agentId, agent.name);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('結婚了！全鎮舉辦了盛大的婚禮！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('結婚了！這是我人生中最幸福的一天。')}`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('結婚了！太開心了。')}`, 10, [agent.name]);
                        // Wedding boosts mood for everyone
                        Object.values(this.agents).forEach(a => {
                            a.moodModifier = (a.moodModifier || 0) + 8;
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.memory.add(this.tickCount, this.clock.timeStr, 'social', `${t('參加了')}${agent.name}${t('和')}${other.name}${t('的婚禮！')}`, 6, [agent.name, other.name]);
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('結婚了！婚禮好浪漫！')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}${t('和')}${other.name}${t('結婚了！全鎮舉辦了盛大的婚禮！')}`, 10, [agent.name, other.name]);
                    }
                }

                // --- Cheating ---
                if ((rel.status === 'dating' || rel.status === 'married') && !rel.isCheating) {
                    // Check if agent has high romantic interest in someone else
                    for (const otherRel2 of Object.values(agent.relationships.relationships)) {
                        if (otherRel2.targetId === rel.targetId) continue;
                        const third = this.agents[otherRel2.targetId];
                        if (!third || third.isPlayer) continue;
                        const thirdRel = third.relationships.getOrCreate(agent.agentId, agent.name);
                        // Both need romantic interest, and agent has low affinity with partner or is neurotic/romantic
                        const isVulnerable = rel.affinity < 20 || agent.personality.traits.includes('romantic') || agent.personality.traits.includes('neurotic');
                        if (isVulnerable && otherRel2.romanticInterest > 50 && thirdRel.romanticInterest > 40 &&
                            otherRel2.affinity > 30 && Math.random() < 0.06) { // v5.22.0 加溫:偷情更容易發生(修羅場的火種)
                            otherRel2.isCheating = true;
                            thirdRel.isCheating = true;
                            this.logMessage('relationship', `${agent.name}${t('背著')}${other.name}${t('和')}${third.name}${t('有了秘密關係⋯⋯')}`, agent.name, third.name);
                            agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我背著')}${other.name}${t('和')}${third.name}${t('在一起了⋯⋯我知道這不對。')}`, 9, [other.name, third.name]);
                            third.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('開始了秘密關係。')}`, 8, [agent.name]);
                            this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${t('有人看到')}${agent.name}${t('和')}${third.name}${t('偷偷在一起⋯⋯')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                            if (this.dailyNews) this.dailyNews.collectEvent('drama', `${t('有人看到')}${agent.name}${t('和')}${third.name}${t('偷偷在一起⋯⋯')}`, 8, [agent.name, third.name]);
                            break; // Only one affair at a time
                        }
                    }
                }

                // --- Discovery of cheating leads to breakup/divorce ---
                if ((rel.status === 'dating' || rel.status === 'married') && !rel.isCheating) {
                    // Check if partner is cheating
                    const partnerCheating = Object.values(other.relationships.relationships).find(r => r.isCheating && r.targetId !== agent.agentId);
                    if (partnerCheating && Math.random() < 0.15) { // v5.22.0 加溫:劈腿更容易東窗事發 → 修羅場
                        // Discovered!
                        const thirdParty = this.agents[partnerCheating.targetId];
                        const thirdName = thirdParty?.name || t('某人');
                        const wasMariage = rel.status === 'married';
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-40); rel.modifyTrust(-50);
                        otherRel.modifyAffinity(-20);
                        // End the affair too
                        partnerCheating.isCheating = false; partnerCheating.status = null;
                        if (thirdParty) {
                            const thirdBack = thirdParty.relationships.getOrCreate(other.agentId, other.name);
                            thirdBack.isCheating = false; thirdBack.status = null;
                        }
                        const action = wasMariage ? t('離婚') : t('分手');
                        this.queueDramaScene('busted', agent, other, thirdName); // v5.1.0 名場面
                        agent.addThought('betrayed', this, other.agentId, other.name);
                        this.logMessage('relationship', `${agent.name}${t('發現')}${other.name}${t('劈腿')}${thirdName}${t('，兩人')}${action}${t('了！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('發現')}${other.name}${t('背著我和')}${thirdName}${t('在一起。我們')}${action}${t('了。')}`, 10, [other.name, thirdName]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${agent.name}${t('發現了我的事情。我們')}${action}${t('了。')}`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 30;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:other.name, content:`${other.name}${t('劈腿被')}${agent.name}${t('發現了！兩人')}${action}${t('了！')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${other.name}${t('劈腿被')}${agent.name}${t('發現！兩人')}${action}${t('了！')}`, 10, [agent.name, other.name, thirdName]);
                        // Trigger NPC event chain for cheating discovery
                        if (this.npcEvents && thirdParty) this.npcEvents.handleCheatingDiscovery(this, other, agent, thirdParty);
                    }
                }

                // --- Natural breakup (dating, low affinity) ---
                if (rel.status === 'dating' && otherRel.status === 'dating') {
                    const duration = this.tickCount - rel.statusSince;
                    if (duration > 100 && (rel.affinity < -10 || otherRel.affinity < -10 || (rel.romanticInterest < 15 && otherRel.romanticInterest < 15)) && Math.random() < 0.1) {
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-10); otherRel.modifyAffinity(-10);
                        this.queueDramaScene('breakup', agent, other); // v5.1.0 名場面
                        agent.addThought('broke_up', this); other.addThought('broke_up', this);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('分手了。')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('分手了。')}`, 8, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('分手了。')}`, 8, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 15;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('分手了⋯⋯')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}${t('和')}${other.name}${t('分手了⋯⋯')}`, 6, [agent.name, other.name]);
                    }
                }

                // --- Divorce (married, very low affinity for a long time) ---
                if (rel.status === 'married' && otherRel.status === 'married') {
                    const duration = this.tickCount - rel.statusSince;
                    if (duration > 300 && rel.affinity < -30 && otherRel.affinity < -20 && Math.random() < 0.05) {
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-15); otherRel.modifyAffinity(-15);
                        this.queueDramaScene('divorce', agent, other); // v5.1.0 名場面
                        agent.addThought('divorced', this); other.addThought('divorced', this);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('離婚了。')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('離婚了。')}`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('離婚了。')}`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 25;
                        other.moodModifier = (other.moodModifier || 0) - 25;
                        Object.values(this.agents).forEach(a => {
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.moodModifier = (a.moodModifier || 0) - 3;
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('離婚了⋯⋯好可惜。')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${agent.name}${t('和')}${other.name}${t('離婚了⋯⋯全鎮不勝唏噓。')}`, 9, [agent.name, other.name]);
                    }
                }
            }
        }
    }

    _loadDefaultResidents() {
        const residents = [
            {id:'chen_wei',name:t('陳偉'),age:45,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','hardworking','optimist'],values:[t('社群'),t('和平')],background:t('曾是軍官，二十年前定居邊境鎮。他深愛這個社區，把全鎮的安危視為自己的責任。')},
            {id:'lin_mei',name:t('林美'),age:32,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','night_owl'],values:[t('知識'),t('家庭')],background:t('才華洋溢的醫生，離開城裡的大醫院來到邊境鎮行醫。經常工作到深夜。')},
            {id:'zhang_hao',name:t('張豪'),age:28,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','shy','stoic'],values:[t('藝術'),t('自由')],background:t('沉默寡言但技藝精湛的鐵匠，用金屬表達自己的情感。私下喜歡寫詩。')},
            {id:'wang_li',name:t('王麗'),age:38,gender:'female',job:'cook',home:'residential_south',traits:['gossip','kind','glutton'],values:[t('社群'),t('家庭')],background:t('酒館的靈魂人物，認識鎮上每一個人，也知道所有人的八卦。煮的菜讓人回味無窮。')},
            {id:'liu_jun',name:t('劉俊'),age:22,gender:'male',job:'farmer',home:'residential_east',traits:['early_bird','romantic','creative'],values:[t('自然'),t('冒險')],background:t('有著遠大夢想的年輕農夫。偷偷寫情書但從未寄出，心中暗戀著某人。')},
            {id:'zhao_xia',name:t('趙霞'),age:35,gender:'female',job:'trader',home:'residential_east',traits:['charismatic','creative','pessimist'],values:[t('財富'),t('冒險')],background:t('精明的女商人，與外面的世界有廣泛的聯繫。表面開朗但內心悲觀。')},
            {id:'yang_feng',name:t('楊鋒'),age:40,gender:'male',job:'guard',home:'residential_north',traits:['stoic','hardworking','jealous'],values:[t('權力'),t('家庭')],background:t('前傭兵，在邊境鎮找到了平靜。但嫉妒心很重，尤其在感情方面。')},
            {id:'sun_yu',name:t('孫雨'),age:26,gender:'female',job:'researcher',home:'residential_east',traits:['creative','neurotic','night_owl'],values:[t('知識'),t('自由')],background:t('聰明但容易焦慮的年輕學者，正在研究小鎮附近的古代遺跡。')},
            {id:'wu_da',name:t('吳達'),age:50,gender:'male',job:'miner',home:'residential_south',traits:['hardworking','pessimist','abrasive'],values:[t('財富'),t('自由')],background:t('從十六歲就開始挖礦的老礦工。說話粗魯但非常可靠。')},
            {id:'huang_li',name:t('黃莉'),age:29,gender:'female',job:'priest',home:'residential_north',traits:['kind','optimist','romantic'],values:[t('和平'),t('社群'),t('藝術')],background:t('溫柔的牧師，照顧禮拜堂和居民的心靈。有一副動人的歌喉，經常在教堂唱歌。')},
            {id:'ma_qiang',name:t('馬強'),age:33,gender:'male',job:'carpenter',home:'residential_south',traits:['lazy','charismatic','gossip'],values:[t('自由'),t('冒險')],background:t('迷人的懶鬼，比起幹活更喜歡講故事。但只要認真起來手藝一流。')},
            {id:'xu_ying',name:t('許瑩'),age:20,gender:'female',job:'tailor',home:'residential_east',traits:['shy','perfectionist','early_bird'],values:[t('藝術'),t('家庭')],background:t('鎮上最年輕的居民。天賦異稟的裁縫師，但太害羞不敢接受別人的誇獎。')},
            // v5.5.0 新村民包(自帶戲劇鉤子)
            {id:'zhou_ming',name:t('周明'),age:27,gender:'male',job:'trader',home:'residential_east',traits:['charismatic','romantic','creative'],values:[t('冒險'),t('藝術')],background:t('從遠方來的遊唱商人，帶著一把舊吉他和說不完的故事。走到哪都是焦點，也走到哪都留下心碎的人。')},
            {id:'he_chang',name:t('何昌'),age:44,gender:'male',job:'carpenter',home:'residential_north',traits:['hardworking','kind','stoic'],values:[t('家庭'),t('社群')],background:t('沉穩可靠的老木匠，和妻子何秀結縭二十年。話不多，但眼裡總有妻子的身影。')},
            {id:'he_xiu',name:t('何秀'),age:41,gender:'female',job:'cook',home:'residential_north',traits:['kind','gossip','optimist'],values:[t('家庭'),t('社群')],background:t('何昌的妻子，開朗愛笑。和王麗是廚房裡的死黨，兩人湊在一起整條街的八卦都藏不住。')},
            {id:'zheng_wei',name:t('鄭薇'),age:23,gender:'female',job:'researcher',home:'residential_east',traits:['shy','creative','perfectionist'],values:[t('知識'),t('藝術')],background:t('孤僻的年輕天才，總是埋首書堆。最近卻常常為了一個人心神不寧，連公式都算錯。')},
            // v5.25.0 新村民包(新的三角、派系與同性甜蜜線)
            {id:'su_qing',name:t('蘇晴'),age:24,gender:'female',job:'cook',home:'residential_east',traits:['optimist','charismatic','early_bird'],values:[t('社群'),t('冒險')],background:t('剛搬來的糕點師傅，笑起來像陽光。她的甜點總在清晨飄香，也悄悄記住了某個早起農夫的身影。')},
            {id:'gao_lang',name:t('高朗'),age:31,gender:'male',job:'guard',home:'residential_north',traits:['hardworking','stoic','abrasive'],values:[t('權力'),t('社群')],background:t('吳達的舊袍澤，退伍後追隨老友來到邊境鎮。剛硬耿直,看不慣楊鋒的作風,卻對禮拜堂的歌聲莫名心軟。')},
            {id:'ke_wei',name:t('柯薇'),age:27,gender:'female',job:'tailor',home:'residential_south',traits:['creative','romantic','night_owl'],values:[t('藝術'),t('自由')],background:t('遊歷各地的繡藝師，指尖有星光。愛自由不受拘束，卻在遇見一位安靜的星象學者後,第一次想為誰停下腳步。')},
            {id:'ling_bo',name:t('凌波'),age:25,gender:'female',job:'researcher',home:'residential_south',traits:['shy','creative','perfectionist'],values:[t('知識'),t('自然')],background:t('沉靜的星象研究者，總在夜裡觀測。話不多,但每次抬頭看見那位繡藝師,筆記本上的星圖就會多幾筆走神的線條。')},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        this._seedRelationships(); // v5.5.0 開局關係網,讓小鎮一開始就有戲
    }

    // v5.27.0 肉鴿:隨機開局 —— 每一局抽一批全新村民 + 隨機愛恨關係網
    _loadRandomResidents(count = 15) {
        const usedNames = new Set();
        const rollName = (gender) => {
            const givens = gender === 'male' ? RANDOM_GIVEN_MALE : RANDOM_GIVEN_FEMALE;
            for (let tryN = 0; tryN < 40; tryN++) {
                const nm = pickRandom(RANDOM_SURNAMES) + pickRandom(givens);
                if (!usedNames.has(nm)) { usedNames.add(nm); return nm; }
            }
            return pickRandom(RANDOM_SURNAMES) + pickRandom(givens) + randInt(1, 9);
        };
        const homes = ['residential_north', 'residential_south', 'residential_east'];
        const jobKeys = Object.keys(JOB_DEFINITIONS).filter(k => k !== 'mayor');
        const bgPool = RANDOM_BG();
        const ids = [];
        for (let i = 0; i < count; i++) {
            const gender = Math.random() < 0.5 ? 'male' : 'female';
            const name = rollName(gender);
            const jobKey = i === 0 ? 'mayor' : pickRandom(jobKeys); // 第一位當鎮長,其餘隨機
            const age = i === 0 ? randInt(38, 55) : randInt(20, 52);
            const personality = Personality.random(3);
            personality.background = pickRandom(bgPool);
            const job = new Job(jobKey);
            const id = `rand_${i}`;
            const agent = new Agent(id, name, age, personality, job, pickRandom(homes), gender);
            this.addAgent(agent);
            ids.push(id);
        }
        this._seedRandomRelationships(ids);
    }

    // 隨機愛恨關係網:夫妻 / 前任 / 暗戀(含三角) / 世仇 / 摯友,一律不分性別
    _seedRandomRelationships(ids) {
        const A = this.agents;
        const pool = shuffle(ids.filter(id => A[id]));
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2 || from === to) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        let idx = 0;
        const take = (n = 1) => pool.slice(idx, idx += n);
        const gossips = [];
        // 💍 1 對恩愛夫妻
        if (pool.length >= 2) { const [a, b] = take(2); pair(a, b, { aff: 70, rom: 54, trust: 58, status: 'married' }, { aff: 68, rom: 52, trust: 56, status: 'married' }); }
        // 💔 1 對藕斷絲連的前任
        if (pool.length - idx >= 2) { const [a, b] = take(2); pair(a, b, { aff: 18, rom: 20, status: 'ex' }, { aff: 26, rom: 22, status: 'ex' }); gossips.push({ about: A[a].name, content: `${A[a].name}${t('和')}${A[b].name}${t('明明分了,見面卻還是躲躲閃閃...是還沒放下嗎?')}`, kind: 'crush' }); }
        // 💘 2~3 段暗戀,其中一段做成三角(兩人搶一人)
        const crushN = Math.min(3, Math.max(1, Math.floor((pool.length - idx) / 3)));
        for (let c = 0; c < crushN && pool.length - idx >= 2; c++) {
            const [a, b] = take(2);
            pair(a, b, { aff: 34 + randInt(0, 8), rom: 42 + randInt(0, 8) }, { aff: 20 + randInt(0, 10), rom: randInt(2, 14) });
            if (c === 0 && pool.length - idx >= 1) { // 三角:再找一人也暗戀 b
                const [rivalC] = take(1);
                set(rivalC, b, { aff: 30, rom: 44 });
                gossips.push({ about: A[b].name, content: `${A[a].name}${t('和')}${A[rivalC].name}${t('好像都對')}${A[b].name}${t('有意思,這下有得瞧了。')}`, kind: 'crush' });
            } else {
                gossips.push({ about: A[a].name, content: `${t('聽說')}${A[a].name}${t('偷偷喜歡著')}${A[b].name}${t('...')}`, kind: 'crush' });
            }
        }
        // ⚔️ 1~2 對世仇
        const feudN = Math.min(2, Math.max(1, Math.floor((pool.length - idx) / 4)));
        for (let f = 0; f < feudN && pool.length - idx >= 2; f++) {
            const [a, b] = take(2);
            pair(a, b, { aff: -42 - randInt(0, 12), trust: -28 }, { aff: -40 - randInt(0, 12), trust: -26 });
            gossips.push({ about: A[a].name, content: `${A[a].name}${t('和')}${A[b].name}${t('的樑子結很久了,一見面就火藥味十足。')}`, kind: 'rivalry' });
        }
        // 👯 剩下的隨機配幾對摯友
        while (pool.length - idx >= 2 && Math.random() < 0.7) {
            const [a, b] = take(2);
            pair(a, b, { aff: 58 + randInt(0, 12), trust: 40 }, { aff: 56 + randInt(0, 12), trust: 38 });
        }
        // 開局八卦頭條
        if (this.gossipNetwork) {
            for (const g of gossips.slice(0, 3)) {
                this.gossipNetwork.activeGossip.push({ about: g.about, content: g.content, source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: g.kind });
            }
        }
    }

    // v5.5.0 預設關係網:開局就種下暗戀/前任/世仇/摯友/夫妻,不必空等 30 天才有戲
    _seedRelationships() {
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6);
            r.lastInteractionTick = 0;
        };
        const pair = (x, y, opts) => { set(x, y, opts.x); set(y, x, opts.y); };

        // 💌 劉俊 暗戀 許瑩(那些從沒寄出的情書)——單戀
        pair('liu_jun', 'xu_ying', { x: { aff: 42, rom: 48 }, y: { aff: 26, rom: 8 } });
        // 💗 張豪 暗戀 黃莉(害羞詩人愛上歌聲牧師)——微微雙向
        pair('zhang_hao', 'huang_li', { x: { aff: 38, rom: 44 }, y: { aff: 32, rom: 18 } });
        // 🛡️ 楊鋒 暗戀 林美(嫉妒守衛的心事),林美埋首工作
        pair('yang_feng', 'lin_mei', { x: { aff: 36, rom: 43 }, y: { aff: 22, rom: 6 } });
        // ⚔️ 吳達 vs 楊鋒(老礦工與前傭兵的舊怨)——世仇
        pair('wu_da', 'yang_feng', { x: { aff: -46, trust: -30 }, y: { aff: -44, trust: -28 } });
        // 👯 王麗 & 何秀 廚房八卦死黨;王麗 & 黃莉 摯友
        pair('wang_li', 'he_xiu', { x: { aff: 66 }, y: { aff: 66 } });
        pair('wang_li', 'huang_li', { x: { aff: 62 }, y: { aff: 58 } });
        // 💔 趙霞 & 馬強 前任(藕斷絲連)
        pair('zhao_xia', 'ma_qiang', { x: { aff: 16, rom: 18, status: 'ex' }, y: { aff: 28, rom: 24, status: 'ex' } });
        // 💍 何昌 & 何秀 恩愛老夫妻
        pair('he_chang', 'he_xiu', { x: { aff: 72, rom: 56, status: 'married', trust: 60 }, y: { aff: 70, rom: 54, status: 'married', trust: 58 } });
        // 🎸 周明 迷上 趙霞(威脅到馬強)——催化五角戀
        pair('zhou_ming', 'zhao_xia', { x: { aff: 34, rom: 40 }, y: { aff: 30, rom: 20 } });
        // 📚 鄭薇 暗戀 周明(算錯公式的原因)——單戀
        pair('zheng_wei', 'zhou_ming', { x: { aff: 30, rom: 46 }, y: { aff: 18, rom: 4 } });
        // 🌙 孫雨 傾心 林美(兩個夜貓子,焦慮學者與沉靜醫生)——雙向漸濃,且與楊鋒形成三角
        pair('sun_yu', 'lin_mei', { x: { aff: 40, rom: 46 }, y: { aff: 30, rom: 24 } });
        // 🎸 馬強 對周明又恨又迷(周明搶了他前任趙霞,偏偏那股魅力也讓他動搖)——愛恨交織
        pair('ma_qiang', 'zhou_ming', { x: { aff: -8, rom: 30 }, y: { aff: 10, rom: 4 } });
        // 🤝 陳偉(鎮長) & 楊鋒 老戰友互敬
        pair('chen_wei', 'yang_feng', { x: { aff: 54, trust: 40 }, y: { aff: 52, trust: 38 } });
        // v5.25.0 新村民包的開局鉤子 ——
        // 🧁 蘇晴 傾心 劉俊(早起農夫與糕點師傅),劉俊 心裡卻還有許瑩 → 新三角
        pair('su_qing', 'liu_jun', { x: { aff: 36, rom: 42 }, y: { aff: 30, rom: 20 } });
        // 🪖 高朗 & 吳達 生死之交(結盟對抗楊鋒,把舊怨燒成兩派)
        pair('gao_lang', 'wu_da', { x: { aff: 60, trust: 46 }, y: { aff: 58, trust: 44 } });
        // ⚔️ 高朗 看不慣楊鋒(袍澤情義使然)——開局微敵意
        pair('gao_lang', 'yang_feng', { x: { aff: -24, trust: -12 }, y: { aff: -18, trust: -10 } });
        // 🎶 高朗 暗戀 黃莉(鐵漢被歌聲融化),張豪也暗戀黃莉 → 情敵
        pair('gao_lang', 'huang_li', { x: { aff: 34, rom: 40 }, y: { aff: 20, rom: 4 } });
        // 🌌 柯薇 & 凌波 互相傾心(繡藝師與星象學者,夜裡最懂彼此)——雙向漸濃,likely 成雙
        pair('ke_wei', 'ling_bo', { x: { aff: 42, rom: 46 }, y: { aff: 38, rom: 40 } });
        // 開局八卦頭條:讓玩家一進來就嗅到戲
        if (this.gossipNetwork) {
            this.gossipNetwork.activeGossip.push(
                { about: A['zhou_ming']?.name, content: t('聽說新來的周明,好像跟趙霞走得很近...而馬強的臉色可不太好看。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
                { about: A['wu_da']?.name, content: t('吳達和楊鋒又在酒館互看不順眼了,他們的樑子結很久了。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'rivalry' },
                { about: A['lin_mei']?.name, content: t('聽說孫雨最近老往診所跑,林美醫生好像也不排斥她的陪伴...倒是守衛楊鋒的臉色越來越難看。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
                { about: A['gao_lang']?.name, content: t('新來的高朗是吳達的老袍澤,一來就跟楊鋒針鋒相對...酒館的火藥味濃得化不開。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'rivalry' },
                { about: A['su_qing']?.name, content: t('糕點師傅蘇晴的早餐總幫劉俊多留一份,可劉俊的心思好像還在許瑩身上...這下有得瞧了。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
            );
        }
    }

    // --- v4.9.0 相鄰組合(開羅式):裝飾與有座標的建築放在一起觸發 ---
    getActiveCombos() {
        const items = (this.decorations || []).map(d => ({ kind: d.type, x: d.x, y: d.y }));
        for (const b of (this.buildings?.completed || [])) {
            if (b.buildingKey && Number.isFinite(b.siteX)) items.push({ kind: b.buildingKey, x: b.siteX + 1, y: b.siteY + 1 });
        }
        if (!items.length) return [];
        const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 4;
        return COMBO_DEFS.filter(c => {
            const anchors = items.filter(i => i.kind === c.parts[0]);
            return anchors.some(a => c.parts.slice(1).every(pk => items.some(i => i !== a && i.kind === pk && near(i, a))));
        });
    }
    checkCombos() {
        this.combosFound = this.combosFound || [];
        const newly = this.getActiveCombos().filter(c => !this.combosFound.includes(c.id));
        for (const c of newly) {
            this.combosFound.push(c.id);
            this.logMessage('building', `✨ ${t('發現相鄰組合：')}${c.icon}${c.name}(${c.desc})${t('！全鎮心情大好')}`);
            this.dailyNews?.collectEvent('building', `${t('小鎮出現了「')}${c.name}${t('」組合！')}`, 7);
            Object.values(this.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 6; });
            this.conversationEngine?.sendEventComment?.(this, `${t('小鎮出現了新組合「')}${c.name}${t('」(')}${c.desc})`);
        }
        if (newly.length) this._pendingComboNotifs = (this._pendingComboNotifs || []).concat(newly);
        return newly;
    }

    // --- v5.1.0 名場面直播:NPC 感情大事件時生成 AI 對話劇,推播給玩家吃瓜 ---
    queueDramaScene(kind, agentA, agentB, thirdName) {
        const meta = {
            confession: { icon: '💘', title: t('告白成功') },
            wedding:    { icon: '💍', title: t('婚禮現場') },
            busted:     { icon: '🔥', title: t('修羅場') },
            breakup:    { icon: '💔', title: t('分手現場') },
            divorce:    { icon: '⚡', title: t('離婚風暴') },
        }[kind];
        if (!meta || !agentA || !agentB) return;
        Promise.resolve(this.conversationEngine?.generateDramaScene?.(this, kind, meta, agentA, agentB, thirdName)).catch(() => {});
    }

    // --- v5.3.0 本週小鎮頭條:把浮現的愛恨糾葛整理成可讀摘要,每 7 天推播 ---
    generateWeeklyDigest() {
        const couples = [], newCouples = [], crushes = [], rivals = [], triangles = [];
        const seen = new Set();
        const prevCouples = new Set(this._lastDigestCouples || []);
        const nowCouples = new Set();
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead) continue;
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                const other = this.agents[tid];
                if (!other || other.isPlayer || other.isDead) continue;
                const key = [a.agentId, tid].sort().join('|');
                if (rel.status === 'married' || rel.status === 'dating') {
                    nowCouples.add(key);
                    if (!seen.has(key)) {
                        seen.add(key);
                        const icon = rel.status === 'married' ? '💍' : '💗';
                        const line = `${icon} ${a.name} × ${other.name}`;
                        if (!prevCouples.has(key)) newCouples.push(line); else couples.push(line);
                    }
                } else if (rel.romanticInterest > 45 && a.agentId < tid) {
                    crushes.push(`💘 ${a.name} ${t('暗戀著')} ${other.name}`);
                } else if (rel.affinity <= -25 && a.agentId < tid) {
                    rivals.push(`⚔️ ${a.name} ${t('與')} ${other.name} ${t('勢不兩立')}`);
                }
            }
        }
        // 三角戀:兩人暗戀同一人
        const crushMap = {};
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead) continue;
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                if (rel.romanticInterest > 40) { (crushMap[tid] = crushMap[tid] || []).push(a.name); }
            }
        }
        for (const [tid, admirers] of Object.entries(crushMap)) {
            if (admirers.length >= 2) {
                const target = this.agents[tid];
                if (target && !target.isPlayer) triangles.push(`🔺 ${admirers.slice(0,3).join(t('、'))} ${t('都喜歡')} ${target.name}`);
            }
        }
        this._lastDigestCouples = [...nowCouples];
        // v5.4.0 夢想進行中:挑最接近實現夢想的村民(階段最高、未完成)
        const dreams = [];
        if (this.lifeGoals) {
            const arr = [];
            for (const a of Object.values(this.agents)) {
                if (a.isPlayer || a.isDead) continue;
                const d = this.lifeGoals.describe(a.agentId);
                if (d && !d.done && d.stage > 0) arr.push({ name: a.name, d });
            }
            arr.sort((x, y) => y.d.stage - x.d.stage);
            for (const { name, d } of arr.slice(0, 3)) dreams.push(`${d.icon} ${name} ${t('正在追逐「')}${d.name}${t('」:')}${d.stageName}`);
        }
        const hasContent = newCouples.length || crushes.length || rivals.length || triangles.length || couples.length || dreams.length;
        if (!hasContent) return null;
        const digest = {
            week: `${this.clock.year}-${this.clock.season}-${this.clock.day}`,
            newCouples, couples: couples.slice(0, 4), crushes: crushes.slice(0, 5),
            rivals: rivals.slice(0, 4), triangles: triangles.slice(0, 3), dreams,
        };
        this._pendingWeeklyDigest = digest;
        return digest;
    }

    // --- v5.2.0 鎮民動態:每天挑 2 位村民發文(第 1 篇嘗試 AI,其餘模板) ---
    generateDailyFeedPosts() {
        if (!this.townFeed) return;
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead);
        if (!npcs.length) return;
        const posters = [...npcs].sort(() => Math.random() - 0.5).slice(0, 2);
        posters.forEach((npc, i) => {
            Promise.resolve(this.conversationEngine?.generateFeedPost?.(this, npc, i === 0)).catch(() => {});
        });
    }

    // v5.15.0 每日處理記憶想法:過期清除 + 對特定對象的好感每天漂移(RimWorld 式持久 opinion)
    _processThoughts() {
        const today = this.clock.totalDays || 0;
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead || !a.thoughts?.length) continue;
            a.thoughts = a.thoughts.filter(th => (today - th.start) < th.days); // 清過期
            for (const th of a.thoughts) {
                if (th.opinion && th.targetId) {
                    const rel = a.relationships.relationships[th.targetId];
                    if (rel) rel.modifyAffinity(th.opinion); // 記憶還在→每天持續影響好感
                }
            }
        }
    }

    // --- v5.0.0 心動事件:每個 NPC 每個門檻只觸發一次,一次只發一件 ---
    checkHeartEvents() {
        if (this._heartEventBusy) return;
        this.heartEventsFired = this.heartEventsFired || {};
        const player = Object.values(this.agents).find(a => a.isPlayer);
        if (!player || !this.conversationEngine?.fireHeartEvent) return;
        for (const npc of Object.values(this.agents)) {
            if (npc.isPlayer || npc.isDead) continue;
            const rel = npc.relationships.relationships[player.agentId];
            if (!rel) continue;
            const fired = this.heartEventsFired[npc.agentId] = this.heartEventsFired[npc.agentId] || [];
            for (const ev of HEART_EVENTS) {
                if (fired.includes(ev.id)) continue;
                if (ev.min.affinity !== undefined && rel.affinity < ev.min.affinity) continue;
                if (ev.min.romantic !== undefined && rel.romanticInterest < ev.min.romantic) continue;
                fired.push(ev.id);
                this._heartEventBusy = true;
                Promise.resolve(this.conversationEngine.fireHeartEvent(this, npc, ev))
                    .catch(() => {})
                    .finally(() => { this._heartEventBusy = false; });
                return; // 一次只觸發一件,避免轟炸
            }
        }
    }

    // --- Save / Load ---
    serialize() {
        const serializeAgent = (a) => ({
            id:a.agentId, name:a.name, age:a.age, gender:a.gender, isPlayer:a.isPlayer,
            _isPlayerChild: a._isPlayerChild || false, _parentNames: a._parentNames || null,
            jobKey: a.job?.key || null,
            homeLocation: a.homeLocation, currentLocation: a.currentLocation,
            mood: a.mood, activity: a.activity, currentThought: a.currentThought,
            personality: { traits:a.personality.traits, background:a.personality.background, values:a.personality.values },
            needs: { hunger:a.needs.hunger, rest:a.needs.rest, social:a.needs.social, comfort:a.needs.comfort, recreation:a.needs.recreation, beauty:a.needs.beauty },
            skills: Object.fromEntries(Object.entries(a.skills.skills).map(([k,s])=>[k,{xp:s.xp,passion:s.passion}])),
            relationships: Object.fromEntries(Object.entries(a.relationships.relationships).map(([k,r])=>[k,{
                targetId:r.targetId, targetName:r.targetName, affinity:r.affinity, trust:r.trust,
                romanticInterest:r.romanticInterest, interactionCount:r.interactionCount,
                lastInteractionTick:r.lastInteractionTick, sharedMemories:r.sharedMemories.slice(-10000),
                status:r.status, statusSince:r.statusSince, isCheating:r.isCheating
            }])),
            memory: a.memory.entries.slice(-10000).map(m=>({tick:m.tick,timeStr:m.timeStr,category:m.category,content:m.content,importance:m.importance,relatedAgents:m.relatedAgents})),
            chatHistory: a.isPlayer ? (a.chatHistory||[]).slice(-10000) : undefined,
            _lastInteractionTick: a._lastInteractionTick,
            _locationStayRemaining: a._locationStayRemaining || 0,
            _mourningTargets: a._mourningTargets || [],
            _annualMourning: a._annualMourning || [],
            thoughts: (a.thoughts || []).map(t2 => ({ ...t2 })), // v5.15.0 記憶想法
            attributes: { ...(a.attributes || {}) }, // v5.26.0 核心屬性
            dailyPlan: a.dailyPlan ? { key: a.dailyPlan.key, goals: [...a.dailyPlan.goals], blocks: a.dailyPlan.blocks ? a.dailyPlan.blocks.map(b => ({ time: b.time, text: b.text, steps: [...(b.steps || [])] })) : undefined, llm: a.dailyPlan.llm || undefined } : null, // v5.30.0 今日目標 / v5.37.0 LLM 分解行程
            currently: a.currently || undefined, // v5.37.0 LLM 每日修訂的近況
        });
        return {
            version: 2,
            _legacyGeneration: this._legacyGeneration || 1,
            savedAt: new Date().toISOString(),
            clock: { day:this.clock.day, hour:this.clock.hour, minute:this.clock.minute, season:this.clock.season, year:this.clock.year },
            tickCount: this.tickCount,
            paused: this.paused,
            messageLog: this.messageLog.slice(-10000),
            townMap: this.townMap ? { seed:this.townMap.seed, terrain:this.townMap.terrain, width:this.townMap.width, height:this.townMap.height,
                locations: Object.fromEntries(Object.entries(this.townMap.locations).map(([k,v])=>[k,{id:v.id,name:v.name,description:v.description,x:v.x,y:v.y,category:v.category,capacity:v.capacity}])) } : null,
            agents: Object.fromEntries(Object.entries(this.agents).map(([k,a])=>[k,serializeAgent(a)])),
            // v5.29.0 AI 對話紀錄以文字形式持久化(含每則對話全文),反思則隨 agent.memory 一起存
            npcConversationLog: this.conversationEngine.npcConversationLog.slice(-10000).map(c => ({ ...c, dialogue: (c.dialogue || []).map(d => ({ ...d })) })),
            npcLlmUsedToday: this.npcLlmUsedToday || 0,
            dailyFocus: this.dailyFocus ? { key: this.dailyFocus.key, items: this.dailyFocus.items.map(i => ({ ...i })) } : null, // v5.31.0 今日焦點
            gossip: this.gossipNetwork.activeGossip.slice(-10000),
            townFeed: this.townFeed ? this.townFeed.serialize() : null,
            events: {
                eventLog: this.events.eventLog.slice(-10000),
                activeEffects: {...this.events.activeEffects},
                conversationTopics: [...this.events.conversationTopics],
                _activeChains: this.events._activeChains.map(c=>({...c})),
                _travellingAgents: this.events._travellingAgents.map(t=>({agentData:{...t.agentData},returnTick:t.returnTick,reason:t.reason})),
                _daysSinceRaid: this.events._daysSinceRaid,
                _daysSinceChain: this.events._daysSinceChain,
                _daysSinceDeparture: this.events._daysSinceDeparture,
                _usedImmigrantNames: [...this.events._usedImmigrantNames],
            },
            stockpile: { resources:{...this.stockpile.resources}, history:this.stockpile.history.slice(-10000) },
            buildings: { projects:this.buildings.projects.map(p=>({...p})), completed:this.buildings.completed.map(p=>({...p})), activeEffects:{...this.buildings.activeEffects}, _counter:this.buildings._counter },
            trade: { merchant:this.trade.merchant?{...this.trade.merchant,offers:this.trade.merchant.offers.map(o=>({...o}))}:null, _daysSince:this.trade._daysSince, tradeHistory:this.trade.tradeHistory.slice(-10) },
            research: { projects:Object.fromEntries(Object.entries(this.research.projects).map(([k,p])=>[k,{...p}])), current:this.research.current },
            workOrders: { orders:this.workOrders.orders.map(o=>({...o})), _counter:this.workOrders._counter },
            news: { bulletins:this.news.bulletins.map(b=>({...b})), activeModifiers:{...this.news.activeModifiers}, _lastPublishDay:this.news._lastPublishDay },
            election: this.election.toDict(),
            factions: this.factions.toDict(),
            festivals: this.festivals.toDict(),
            lifecycle: this.lifecycle.toDict(),
            exploration: this.exploration.toDict(),
            decorations: this.decorations || [],
            combosFound: this.combosFound || [],
            heartEventsFired: this.heartEventsFired || {},
            industry: this.industry.serialize(),
            farm: this.farm.serialize(),
            processing: this.processing.serialize(),
            dailyNews: this.dailyNews.serialize(),
            townIdentity: this.townIdentity.serialize(),
            dramaArchive: (this.dramaArchive || []).slice(-40),
            npcEvents: this.npcEvents.serialize(),
            questSystem: this.questSystem ? this.questSystem.serialize() : null,
            prosperity: this.prosperity ? this.prosperity.serialize() : null,
            npcQuests: this.npcQuests ? this.npcQuests.serialize() : null,
            lifeGoals: this.lifeGoals ? this.lifeGoals.serialize() : null,
            customNPC: this.customNPC ? this.customNPC.serialize() : null,
            multiEnding: this.multiEnding ? this.multiEnding.serialize() : null,
            // v4.0
            dailyDecision: this.dailyDecision.serialize(),
            shop: this.shop.serialize(),
            eventChoice: this.eventChoice.serialize(),
            rogueCards: this.rogueCards.serialize(),
            npcHelp: this.npcHelp.serialize(),
            reputationSystem: this.reputationSystem.serialize(),
            weather: this.weather.serialize(),
            council: this.council.serialize(),
        };
    }

    loadSave(data) {
        if (!data || !data.version) return false;
        try {
            // Clock
            this.clock.day=data.clock.day; this.clock.hour=data.clock.hour; this.clock.minute=data.clock.minute;
            this.clock.season=data.clock.season; this.clock.year=data.clock.year;
            this.tickCount = data.tickCount;
            this._legacyGeneration = data._legacyGeneration || 1;
            this.paused = data.paused || false;
            this.messageLog = data.messageLog || [];

            // Town map
            if (data.townMap) {
                this.townMap = new TownMap(data.townMap.seed);
                this.townMap.terrain = data.townMap.terrain;
                this.townMap.width = data.townMap.width; this.townMap.height = data.townMap.height;
                for (const [k,v] of Object.entries(data.townMap.locations)) this.townMap.addLocation(v);
            }

            // Agents
            this.agents = {};
            for (const [id, ad] of Object.entries(data.agents)) {
                const personality = new Personality(ad.personality.traits, ad.personality.background, ad.personality.values);
                const job = ad.jobKey ? new Job(ad.jobKey) : null;
                let agent;
                if (ad.isPlayer) {
                    agent = new PlayerAgent(ad.name, ad.age);
                    agent.personality = personality;
                    if (job) agent.job = job;
                    agent.chatHistory = ad.chatHistory || [];
                } else {
                    agent = new Agent(id, ad.name, ad.age, personality, job, ad.homeLocation);
                }
                agent.currentLocation = ad.currentLocation;
                if (ad.gender) agent.gender = ad.gender;
                if (ad._isPlayerChild) { agent._isPlayerChild = true; agent._parentNames = ad._parentNames; }
                agent.mood = ad.mood; agent.activity = ad.activity;
                agent.moodModifier = ad.moodModifier || 0;
                agent.currentThought = ad.currentThought || '';
                agent._lastInteractionTick = ad._lastInteractionTick || 0;
                agent._locationStayRemaining = ad._locationStayRemaining || 0;
                agent._mourningTargets = ad._mourningTargets || [];
                agent._annualMourning = ad._annualMourning || [];
                agent.thoughts = Array.isArray(ad.thoughts) ? ad.thoughts : []; // v5.15.0 記憶想法
                if (ad.attributes && Object.keys(ad.attributes).length) agent.attributes = { ...ad.attributes }; // v5.26.0 核心屬性
                if (ad.dailyPlan) agent.dailyPlan = ad.dailyPlan; // v5.30.0 今日目標(v5.37.0 含 LLM blocks)
                if (ad.currently) agent.currently = ad.currently; // v5.37.0 近況

                // Needs
                if (ad.needs) { Object.assign(agent.needs, ad.needs); }
                // Skills
                if (ad.skills) {
                    for (const [sk,sv] of Object.entries(ad.skills)) {
                        const s = agent.skills.get(sk);
                        if (s) { s.xp = sv.xp; s.passion = sv.passion; }
                    }
                }
                // Relationships
                if (ad.relationships) {
                    for (const [rk,rv] of Object.entries(ad.relationships)) {
                        const rel = agent.relationships.getOrCreate(rv.targetId, rv.targetName);
                        rel.affinity = rv.affinity; rel.trust = rv.trust;
                        rel.romanticInterest = rv.romanticInterest;
                        rel.interactionCount = rv.interactionCount;
                        rel.lastInteractionTick = rv.lastInteractionTick;
                        rel.sharedMemories = rv.sharedMemories || [];
                        rel.status = rv.status || null;
                        rel.statusSince = rv.statusSince || 0;
                        rel.isCheating = rv.isCheating || false;
                    }
                }
                // Memory
                if (ad.memory) {
                    ad.memory.forEach(m => agent.memory.add(m.tick, m.timeStr, m.category, m.content, m.importance, m.relatedAgents));
                }
                this.agents[id] = agent;
            }

            // v5.29.0 AI 對話紀錄還原(文字形式持久化)
            if (Array.isArray(data.npcConversationLog)) this.conversationEngine.npcConversationLog = data.npcConversationLog;
            this.npcLlmUsedToday = data.npcLlmUsedToday || 0;
            if (data.dailyFocus) this.dailyFocus = data.dailyFocus; // v5.31.0 今日焦點

            // Gossip
            this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
            this.gossipNetwork.activeGossip = data.gossip || [];
            if (this.townFeed) this.townFeed.load(data.townFeed);

            // Events
            this.events = new EventSystem();
            if (data.events) {
                this.events.eventLog = data.events.eventLog || [];
                this.events.activeEffects = data.events.activeEffects || {};
                this.events.conversationTopics = data.events.conversationTopics || [];
                this.events._activeChains = data.events._activeChains || [];
                this.events._travellingAgents = data.events._travellingAgents || [];
                this.events._daysSinceRaid = data.events._daysSinceRaid ?? 5;
                this.events._daysSinceChain = data.events._daysSinceChain ?? 5;
                this.events._daysSinceDeparture = data.events._daysSinceDeparture ?? 3;
                this.events._usedImmigrantNames = new Set(data.events._usedImmigrantNames || []);
            }

            // Stockpile
            this.stockpile = new Stockpile();
            if (data.stockpile) { this.stockpile.resources = {...data.stockpile.resources}; this.stockpile.history = data.stockpile.history || []; }

            // Buildings
            this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
            if (data.buildings) {
                this.buildings.projects = data.buildings.projects || [];
                this.buildings.completed = (data.buildings.completed || []).map(b => {
                    if (!b.buildingKey) {
                        // Legacy save: resolve buildingKey from name
                        for (const [key, tmpl] of Object.entries(BUILDING_TEMPLATES)) {
                            if (tmpl.name === b.name) { b.buildingKey = key; break; }
                        }
                    }
                    if (!b.level) b.level = 1;
                    return b;
                });
                this.buildings.activeEffects = data.buildings.activeEffects || {};
                this.buildings._counter = data.buildings._counter || 0;
            }

            // Trade
            this.trade = new TradeManager();
            if (data.trade) {
                this.trade.merchant = data.trade.merchant;
                this.trade._daysSince = data.trade._daysSince || 0;
                this.trade.tradeHistory = data.trade.tradeHistory || [];
            }

            // Research
            this.research = new ResearchManager();
            if (data.research) {
                for (const [k,p] of Object.entries(data.research.projects)) {
                    if (this.research.projects[k]) Object.assign(this.research.projects[k], p);
                }
                this.research.current = data.research.current;
            }

            // Work orders
            this.workOrders = new WorkOrderManager();
            if (data.workOrders) { this.workOrders.orders = data.workOrders.orders || []; this.workOrders._counter = data.workOrders._counter || 0; }

            // News
            this.news = new NewsSystem();
            if (data.news) {
                this.news.bulletins = data.news.bulletins || [];
                this.news.activeModifiers = data.news.activeModifiers || {};
                this.news._lastPublishDay = data.news._lastPublishDay || 0;
            }

            // Election
            this.election = new ElectionSystem();
            if (data.election) this.election.loadFrom(data.election);

            // Factions
            this.factions = new FactionSystem();
            if (data.factions) {
                this.factions._counter = data.factions._counter || 0;
                this.factions._daysSinceCheck = data.factions._daysSinceCheck || 0;
                if (data.factions.factions) {
                    for (const [id, fd] of Object.entries(data.factions.factions)) {
                        const f = new Faction(fd.id, fd.type, fd.founderName);
                        f.name = fd.name; f.icon = fd.icon;
                        f.members = fd.members || [];
                        f.formedTick = fd.formedTick || 0;
                        f.cohesion = fd.cohesion ?? 50;
                        f.rivalFactionId = fd.rivalFactionId || null;
                        f.allyFactionId = fd.allyFactionId || null;
                        this.factions.factions[id] = f;
                    }
                }
            }

            // Festivals
            this.festivals = new FestivalSystem();
            if (data.festivals) {
                this.festivals.activeFestival = data.festivals.activeFestival || null;
                this.festivals.festivalLog = data.festivals.festivalLog || [];
                this.festivals.activeQuest = data.festivals.activeQuest || null;
                this.festivals._lastFestivalSeason = data.festivals._lastFestivalSeason || null;
                this.festivals._gameRewardKey = data.festivals._gameRewardKey || null;
            }

            // Lifecycle
            this.lifecycle = new LifecycleSystem();
            if (data.lifecycle) {
                this.lifecycle.graveyard = data.lifecycle.graveyard || [];
                this.lifecycle.births = data.lifecycle.births || [];
                this.lifecycle.playerChildren = data.lifecycle.playerChildren || [];
                this.lifecycle._daysSinceCheck = data.lifecycle._daysSinceCheck || 0;
            }

            // Exploration
            this.exploration = new ExplorationSystem();
            if (data.exploration) {
                this.exploration.discoveredZones = data.exploration.discoveredZones || {};
                this.exploration.activeExpeditions = data.exploration.activeExpeditions || [];
                this.exploration.expeditionLog = data.exploration.expeditionLog || [];
                this.exploration._counter = data.exploration._counter || 0;
            }

            // v3 systems
            this.industry = new IndustryManager();
            if (data.industry) this.industry.loadFrom(data.industry);
            this.farm = new FarmSystem();
            if (data.farm) this.farm.loadFrom(data.farm);
            this.processing = new ProcessingSystem();
            if (data.processing) this.processing.loadFrom(data.processing);
            this.dailyNews = new DailyNewsEngine();
            this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
            if (data.dailyNews) this.dailyNews.loadFrom(data.dailyNews);
            if (data.townIdentity) this.townIdentity.load(data.townIdentity);
            this.dramaArchive = Array.isArray(data.dramaArchive) ? data.dramaArchive : [];
            this.npcEvents = new NPCEventSystem();
            if (data.npcEvents) this.npcEvents.loadFrom(data.npcEvents);
            if (this.questSystem && data.questSystem) this.questSystem.loadFrom(data.questSystem);
            if (this.prosperity && data.prosperity) this.prosperity.loadFrom(data.prosperity);
            if (this.npcQuests && data.npcQuests) this.npcQuests.loadFrom(data.npcQuests);
            if (this.lifeGoals && data.lifeGoals) this.lifeGoals.load(data.lifeGoals);
            if (this.customNPC && data.customNPC) this.customNPC.loadFrom(data.customNPC);
            if (this.multiEnding && data.multiEnding) this.multiEnding.loadFrom(data.multiEnding);
            // v4.0 systems
            if (data.dailyDecision) this.dailyDecision.loadFrom(data.dailyDecision);
            this.decorations = Array.isArray(data.decorations) ? data.decorations : [];
            this.combosFound = Array.isArray(data.combosFound) ? data.combosFound : [];
            this.heartEventsFired = (data.heartEventsFired && typeof data.heartEventsFired === 'object') ? data.heartEventsFired : {};
            if (data.shop) this.shop.loadFrom(data.shop);
            if (data.eventChoice) this.eventChoice.loadFrom(data.eventChoice);
            this.rogueCards = new RogueCardSystem(); if (data.rogueCards) this.rogueCards.loadFrom(data.rogueCards);
            if (data.npcHelp) this.npcHelp.loadFrom(data.npcHelp);
            if (data.reputationSystem) this.reputationSystem.loadFrom(data.reputationSystem);
            if (data.weather) this.weather.loadFrom(data.weather);
            if (data.council) this.council.loadFrom(data.council);

            this.logMessage('system', t('遊戲讀取成功！'));
            return true;
        } catch(e) {
            console.error('Failed to load save:', e);
            return false;
        }
    }
}

// ============================================================
// v4.0 - Reputation System (聲望系統)
// ============================================================
const REPUTATION_TIERS = [
    { min: 0,   name:()=>t('無名之輩'), icon:'👤', desc:()=>t('剛來的外地人，沒人認識你') },
    { min: 15,  name:()=>t('新面孔'),   icon:'🙂', desc:()=>t('居民開始記住你的名字了') },
    { min: 40,  name:()=>t('可靠鄰人'), icon:'🤝', desc:()=>t('大家覺得你是可以信賴的人') },
    { min: 70,  name:()=>t('鎮之棟樑'), icon:'⭐', desc:()=>t('你已經是小鎮不可或缺的一份子') },
    { min: 100, name:()=>t('邊境英雄'), icon:'🏆', desc:()=>t('你的事蹟在邊境廣為流傳') },
    { min: 150, name:()=>t('傳奇人物'), icon:'👑', desc:()=>t('後人會在書裡讀到你的故事') },
];

class ReputationSystem {
    constructor() {
        this.reputation = 0;        // Total reputation points (synced with questSystem)
        this.sources = {};          // Track where reputation came from: { quests, decisions, help, trade, events }
        this._lastEffectTier = -1;
        this._dailyActionPoints = 0; // Track daily actions for passive rep gain
    }

    // Get current tier info
    get tier() {
        let current = REPUTATION_TIERS[0];
        for (const tier of REPUTATION_TIERS) {
            if (this.reputation >= tier.min) current = tier;
            else break;
        }
        return current;
    }

    get tierIndex() {
        let idx = 0;
        for (let i = 0; i < REPUTATION_TIERS.length; i++) {
            if (this.reputation >= REPUTATION_TIERS[i].min) idx = i;
            else break;
        }
        return idx;
    }

    get nextTier() {
        const idx = this.tierIndex;
        return idx < REPUTATION_TIERS.length - 1 ? REPUTATION_TIERS[idx + 1] : null;
    }

    // Add reputation from a specific source
    addReputation(amount, source, world) {
        if (amount === 0) return;
        this.reputation = Math.max(0, this.reputation + amount);
        if (!this.sources[source]) this.sources[source] = 0;
        this.sources[source] += amount;

        // Sync with quest system
        if (world?.questSystem) {
            world.questSystem.reputation = this.reputation;
        }

        // Check for tier up
        const newTierIdx = this.tierIndex;
        if (newTierIdx > this._lastEffectTier && this._lastEffectTier >= 0) {
            const tier = this.tier;
            world?.logMessage?.('reputation', `⭐ ${t('聲望提升！你現在是')}「${tier.icon} ${tier.name()}」— ${tier.desc()}`);
            if (world?.dailyNews) {
                world.dailyNews.collectEvent('social', `${t('鎮長的聲望提升為')}「${tier.name()}」！`, 7);
            }
            // Tier-up mood boost
            Object.values(world?.agents || {}).forEach(a => {
                if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 3;
            });
        }
        this._lastEffectTier = newTierIdx;
    }

    // Daily update: passive reputation & apply effects
    dailyUpdate(world) {
        // Sync FROM quest system (quests add rep directly to questSystem)
        if (world.questSystem && world.questSystem.reputation !== this.reputation) {
            const diff = world.questSystem.reputation - this.reputation;
            if (diff > 0) {
                this.reputation = world.questSystem.reputation;
                if (!this.sources['quests']) this.sources['quests'] = 0;
                this.sources['quests'] += diff;
            }
        }

        // Passive reputation from daily good deeds
        this._dailyActionPoints = 0;
        const player = world.agents?.['player'];
        if (player) {
            // Working consistently
            if (player.job) this._dailyActionPoints += 1;
            // High average affinity
            const rels = Object.values(player.relationships?.relationships || {});
            if (rels.length > 0) {
                const avgAff = rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length;
                if (avgAff > 30) this._dailyActionPoints += 1;
                if (avgAff > 60) this._dailyActionPoints += 1;
            }
        }

        // Convert daily action points to small reputation gains (slow passive growth)
        if (this._dailyActionPoints >= 2 && Math.random() < 0.3) {
            this.addReputation(1, 'daily', world);
        }

        // Apply reputation effects to game systems
        this._applyEffects(world);
    }

    // Reputation effects on game mechanics —
    // 全部效果由各系統透過 getModifier() 讀取:
    // 1. npc_initial_trust → EventSystem._spawnImmigrant(新居民初始信任)
    // 2. trade_price_bonus → TradeSystem._spawnMerchant(商人買賣價)
    // 3. immigration_bonus → EventSystem._managePopulation(移民機率)
    // 4. npc_mood_bonus   → Agent 心情計算(simulation.js Agent.update)
    // 5. event_shield     → EventSystem._rollDailyEvent(負面事件機率)
    //    shop_discount    → ShopSystem(商店折扣)
    _applyEffects(world) {}

    // Modifiers for other systems to query
    getModifier(key) {
        const tierIdx = this.tierIndex;
        switch (key) {
            case 'trade_price_bonus':
                return [0, 0.03, 0.05, 0.08, 0.12, 0.15][tierIdx] || 0;
            case 'npc_initial_trust':
                return [0, 2, 5, 8, 12, 15][tierIdx] || 0;
            case 'npc_mood_bonus':
                return [0, 0, 1, 2, 3, 5][tierIdx] || 0;
            case 'immigration_bonus':
                return [0, 0.02, 0.05, 0.08, 0.12, 0.15][tierIdx] || 0;
            case 'event_shield':
                return tierIdx >= 3 ? 0.15 : tierIdx >= 2 ? 0.08 : 0;
            case 'shop_discount':
                return [0, 0, 0.05, 0.08, 0.10, 0.15][tierIdx] || 0;
            default:
                return 0;
        }
    }

    toDict() {
        const tier = this.tier;
        const nextTier = this.nextTier;
        return {
            reputation: this.reputation,
            tierName: tier.name(),
            tierIcon: tier.icon,
            tierDesc: tier.desc(),
            tierIndex: this.tierIndex,
            nextTierName: nextTier ? nextTier.name() : null,
            nextTierMin: nextTier ? nextTier.min : null,
            progressToNext: nextTier ? Math.round(((this.reputation - tier.min) / (nextTier.min - tier.min)) * 100) : 100,
            sources: { ...this.sources },
            effects: {
                trade_bonus: `+${Math.round(this.getModifier('trade_price_bonus') * 100)}%`,
                npc_trust: `+${this.getModifier('npc_initial_trust')}`,
                mood_bonus: `+${this.getModifier('npc_mood_bonus')}`,
                shop_discount: `${Math.round(this.getModifier('shop_discount') * 100)}%`,
                event_shield: `${Math.round(this.getModifier('event_shield') * 100)}%`,
            },
        };
    }

    serialize() {
        return {
            reputation: this.reputation,
            sources: { ...this.sources },
            _lastEffectTier: this._lastEffectTier,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.reputation = data.reputation || 0;
        this.sources = data.sources || {};
        this._lastEffectTier = data._lastEffectTier ?? -1;
    }
}

// ============================================================
// v4.0 - Weather System (動態天氣引擎)
// ============================================================
const WEATHER_TYPES = {
    clear:    { name:()=>t('晴天'),   icon:'☀️', farm:0.1,  mood:2,  desc:()=>t('萬里無雲，適合工作'),     visual:'clear' },
    cloudy:   { name:()=>t('多雲'),   icon:'☁️', farm:0,    mood:0,  desc:()=>t('雲層遮住了部分陽光'),     visual:'cloudy' },
    rain:     { name:()=>t('下雨'),   icon:'🌧️', farm:0.2,  mood:-2, desc:()=>t('雨水滋潤了大地'),         visual:'rain' },
    storm:    { name:()=>t('暴風雨'), icon:'⛈️', farm:-0.2, mood:-8, desc:()=>t('狂風暴雨肆虐小鎮'),       visual:'storm' },
    snow:     { name:()=>t('下雪'),   icon:'❄️', farm:-0.3, mood:-3, desc:()=>t('白雪覆蓋了田野'),         visual:'snow' },
    blizzard: { name:()=>t('暴風雪'), icon:'🌨️', farm:-0.5, mood:-12,desc:()=>t('猛烈暴風雪，出門危險'),   visual:'blizzard' },
    fog:      { name:()=>t('大霧'),   icon:'🌫️', farm:-0.05,mood:-1, desc:()=>t('濃霧籠罩，能見度極低'),   visual:'fog' },
    heatwave: { name:()=>t('熱浪'),   icon:'🔥', farm:-0.3, mood:-10,desc:()=>t('酷熱難耐，人畜疲憊'),     visual:'heatwave' },
    drought:  { name:()=>t('乾旱'),   icon:'🏜️', farm:-0.4, mood:-8, desc:()=>t('水源枯竭，作物乾枯'),     visual:'drought' },
    wind:     { name:()=>t('強風'),   icon:'💨', farm:-0.1, mood:-3, desc:()=>t('大風不斷吹拂'),           visual:'wind' },
};

// Season → weighted weather pools: [type, weight]
const SEASON_WEATHER = {
    '春季': [['clear',3],['cloudy',3],['rain',4],['fog',2],['wind',1],['storm',0.5]],
    '夏季': [['clear',4],['cloudy',2],['rain',2],['heatwave',2],['drought',1.5],['storm',1]],
    '秋季': [['clear',2],['cloudy',3],['rain',3],['fog',3],['wind',2],['storm',1.5]],
    '冬季': [['clear',1],['cloudy',3],['snow',3],['blizzard',1],['fog',2],['wind',2],['storm',0.5]],
};

class WeatherSystem {
    constructor() {
        this.current = 'clear';       // Current weather type key
        this.duration = 1;            // How many more days this weather lasts
        this.forecast = [];           // Next 3 days forecast: [{type, day}]
        this.streak = 0;              // Consecutive days of same weather category (for drought/heatwave escalation)
        this._temperature = 20;       // Abstract temperature (affects comfort)
        this._humidity = 50;          // Affects crop water, fog chance
        this._windSpeed = 0;          // 0-100, affects storm severity
        this.disasterWarning = null;  // {type, severity, daysUntil} or null
        this.activeDisaster = null;   // {type, severity, daysLeft, effects} or null
        this._daysSinceDisaster = 10;
    }

    dailyUpdate(world) {
        const season = world.clock.season;
        this._daysSinceDisaster++;

        // Advance duration
        this.duration--;
        if (this.duration <= 0) {
            this._advanceWeather(season);
        }

        // Update environmental vars
        this._updateEnvironment(season);

        // Check for extreme weather escalation → disaster
        this._checkDisasterEscalation(world);

        // Progress active disaster
        if (this.activeDisaster) {
            this.activeDisaster.daysLeft--;
            if (this.activeDisaster.daysLeft <= 0) {
                this._endDisaster(world);
            }
        }

        // Generate forecast if empty
        while (this.forecast.length < 3) {
            this.forecast.push({ type: this._rollWeather(season), day: world.clock.day + this.forecast.length + 1 });
        }

        // Apply weather effects to game systems
        this._applyEffects(world);

        // Broadcast to daily news (significant weather only)
        this._reportWeather(world);
    }

    _rollWeather(season) {
        const pool = SEASON_WEATHER[season] || SEASON_WEATHER['春季'];
        const types = pool.map(p => p[0]);
        const weights = pool.map(p => p[1]);
        return weightedChoice(types, weights);
    }

    _advanceWeather(season) {
        // Use forecast if available, otherwise roll new
        if (this.forecast.length > 0) {
            const next = this.forecast.shift();
            const prev = this.current;
            this.current = next.type;
            // Track streak for same-category weather
            if (this.current === prev || (this._isHot(this.current) && this._isHot(prev)) || (this._isWet(this.current) && this._isWet(prev))) {
                this.streak++;
            } else {
                this.streak = 0;
            }
        } else {
            this.current = this._rollWeather(season);
            this.streak = 0;
        }
        // Duration: 1-3 days, storms and extreme weather are shorter
        const w = WEATHER_TYPES[this.current];
        if (['storm','blizzard','heatwave'].includes(this.current)) {
            this.duration = Math.random() < 0.3 ? 2 : 1;
        } else if (['drought'].includes(this.current)) {
            this.duration = 2 + Math.floor(Math.random() * 2); // 2-3 days
        } else {
            this.duration = 1 + Math.floor(Math.random() * 3); // 1-3 days
        }
    }

    _isHot(type) { return ['heatwave','drought','clear'].includes(type) && type !== 'clear'; }
    _isWet(type) { return ['rain','storm'].includes(type); }

    _updateEnvironment(season) {
        // Base temperature by season
        const seasonTemp = { '春季':18, '夏季':30, '秋季':15, '冬季':2 };
        const base = seasonTemp[season] || 18;
        const weatherMod = { clear:3, cloudy:0, rain:-2, storm:-5, snow:-8, blizzard:-15, fog:-1, heatwave:12, drought:8, wind:-3 };
        this._temperature = base + (weatherMod[this.current] || 0) + (Math.random() * 4 - 2);

        // Humidity
        const humidityMap = { clear:30, cloudy:50, rain:85, storm:90, snow:60, blizzard:55, fog:95, heatwave:15, drought:10, wind:35 };
        this._humidity = humidityMap[this.current] || 50;

        // Wind
        const windMap = { clear:10, cloudy:15, rain:30, storm:80, snow:25, blizzard:90, fog:5, heatwave:10, drought:5, wind:70 };
        this._windSpeed = windMap[this.current] || 10;
    }

    _checkDisasterEscalation(world) {
        // Drought escalation: 3+ consecutive hot days in summer
        if (this.streak >= 3 && this._isHot(this.current) && world.clock.season === '夏季' && !this.activeDisaster && this._daysSinceDisaster > 8) {
            this.disasterWarning = { type: 'drought_severe', severity: 'major', daysUntil: 1 };
            world.logMessage('weather', `⚠️ ${t('乾旱警報：連續高溫，水源告急！')}`);
            this._offerPrepChoice(world, t('嚴重乾旱'));
        }
        // Blizzard escalation: extended cold in winter
        if (this.streak >= 2 && this.current === 'snow' && world.clock.season === '冬季' && !this.activeDisaster && this._daysSinceDisaster > 8) {
            this.disasterWarning = { type: 'blizzard_severe', severity: 'major', daysUntil: 1 };
            world.logMessage('weather', `⚠️ ${t('暴風雪警報：氣溫持續下降，請準備取暖物資！')}`);
            this._offerPrepChoice(world, t('猛烈暴風雪'));
        }
        // Storm escalation chance
        if (this.current === 'storm' && Math.random() < 0.3 && !this.activeDisaster && this._daysSinceDisaster > 6) {
            this.disasterWarning = { type: 'flood', severity: 'major', daysUntil: 0 };
            world.logMessage('weather', `⚠️ ${t('洪水警報：暴風雨導致河水暴漲！')}`);
        }

        // Trigger disaster from warning
        if (this.disasterWarning && this.disasterWarning.daysUntil <= 0) {
            this._startDisaster(this.disasterWarning.type, world);
            this.disasterWarning = null;
        } else if (this.disasterWarning) {
            this.disasterWarning.daysUntil--;
        }
    }

    // v4.5.0 災害預警:給玩家防災準備選擇(明天災害來襲前)
    _offerPrepChoice(world, disasterName) {
        if (!world.eventChoice || world.eventChoice.pendingEvent) return;
        world.eventChoice.pendingEvent = {
            eventName: `${t('災害預警：')}${disasterName}`,
            description: `${disasterName}${t('預計明天來襲！現在做準備還來得及——要怎麼應對？')}`,
            severity: 'major',
            choices: [
                { label: t('全面防災'), icon: '🏗️', desc: t('花費 30 木材 + 20 食物：災害效果減半、提早一天結束'),
                  effects: { wood: -30, food: -20, disaster_prep: 2 } },
                { label: t('基本準備'), icon: '🧰', desc: t('花費 10 木材：災害效果減輕 25%'),
                  effects: { wood: -10, disaster_prep: 1 } },
                { label: t('聽天由命'), icon: '🤷', desc: t('不做任何準備'),
                  effects: { disaster_prep: 0 } },
            ],
            timestamp: world.tickCount,
        };
        world.logMessage('event_choice', `⚡ ${t('災害預警——你需要決定如何防災！')}`);
    }

    _startDisaster(type, world) {
        const disasters = {
            drought_severe: {
                name: ()=>t('嚴重乾旱'), severity:'major', daysLeft:4,
                effects: { farm:-0.5, mood:-10, water:-30, wood_consumption:0.5 },
                desc: ()=>t('水井乾涸，作物大面積枯死，居民飲水困難。'),
            },
            blizzard_severe: {
                name: ()=>t('極端暴風雪'), severity:'major', daysLeft:3,
                effects: { farm:-0.6, mood:-15, comfort:-20, wood_consumption:2.0 },
                desc: ()=>t('暴風雪封路，木材消耗加倍，居民被困室內。'),
            },
            flood: {
                name: ()=>t('洪水'), severity:'major', daysLeft:3,
                effects: { farm:-0.4, mood:-12, food_loss:0.1 },
                desc: ()=>t('河水氾濫，部分農田被淹，儲備糧食受損。'),
            },
        };
        const d = disasters[type];
        if (!d) return;
        this.activeDisaster = { type, name: d.name(), severity: d.severity, daysLeft: d.daysLeft, effects: d.effects, desc: d.desc() };
        this._daysSinceDisaster = 0;
        world.logMessage('weather', `🚨 ${t('天災發生！')}${d.name()}：${d.desc()}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('disaster', `${d.name()}${t('來襲')}：${d.desc()}`, 10);
        }
        // 深井/淨水系統的 drought_resistance 效果:依累積抗旱值減輕乾旱(Lv1 深井 0.5 → +0.2,Lv2 淨水再 +0.3 → +0.3)
        const droughtRes = world.buildings?.getEffect?.('drought_resistance', 0) || 0;
        if (type === 'drought_severe' && droughtRes > 0) {
            world.logMessage('weather', `💧 ${t('深井發揮作用，減輕了乾旱影響！')}`);
            this.activeDisaster.effects.farm = Math.max(-0.3, this.activeDisaster.effects.farm + Math.min(0.3, droughtRes * 0.4));
        }
        // v4.5.0 玩家事前防災準備的減災效果
        const prep = this._prepLevel || 0;
        if (prep > 0) {
            const factor = prep === 2 ? 0.5 : 0.75;
            for (const k of Object.keys(this.activeDisaster.effects)) {
                if (typeof this.activeDisaster.effects[k] === 'number') this.activeDisaster.effects[k] *= factor;
            }
            if (prep === 2) this.activeDisaster.daysLeft = Math.max(1, this.activeDisaster.daysLeft - 1);
            world.logMessage('weather', prep === 2
                ? `🏗️ ${t('事前的全面防災大幅減輕了災害衝擊！')}`
                : `🧰 ${t('基本準備發揮了作用，災損有所減輕。')}`);
        }
        this._prepLevel = 0;
    }

    _endDisaster(world) {
        const name = this.activeDisaster.name;
        world.logMessage('weather', `✅ ${name}${t('已經結束，小鎮開始恢復。')}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('recovery', `${name}${t('結束，開始重建')}`, 7);
        }
        // Recovery mood boost
        Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 5; });
        this.activeDisaster = null;
    }

    _applyEffects(world) {
        const w = WEATHER_TYPES[this.current];
        if (!w) return;

        // 1. Farm bonus/penalty via news modifier system (stacks with existing)
        if (world.news) {
            // Set weather modifier (overwrites previous weather modifier)
            world.news.activeModifiers['weather_farm_bonus'] = w.farm + (this.activeDisaster?.effects?.farm || 0);
            world.news.activeModifiers['weather_mood'] = w.mood + (this.activeDisaster?.effects?.mood || 0);
        }

        // 2. Comfort penalty from extreme temperatures
        if (this._temperature < 0 || this._temperature > 38) {
            Object.values(world.agents).forEach(a => {
                if (a.needs) a.needs.comfort = Math.max(0, a.needs.comfort - (this.activeDisaster ? 8 : 3));
            });
        }

        // 3. Disaster-specific: extra wood consumption
        if (this.activeDisaster?.effects?.wood_consumption) {
            const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
            const extraWood = Math.ceil(npcCount * this.activeDisaster.effects.wood_consumption);
            if (!world.stockpile.consume('wood', extraWood, world.tickCount, this.activeDisaster.name)) {
                world.logMessage('weather', `🪵 ${t('木材嚴重不足！')}${this.activeDisaster.name}${t('讓居民受凍。')}`);
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) - 5; });
            }
        }

        // 4. Disaster-specific: food loss (flood)
        if (this.activeDisaster?.effects?.food_loss) {
            const foodLost = Math.floor(world.stockpile.get('food') * this.activeDisaster.effects.food_loss);
            if (foodLost > 0) {
                world.stockpile.consume('food', foodLost, world.tickCount, this.activeDisaster.name);
                world.logMessage('weather', `🍖 ${t('洪水沖走了')} ${foodLost} ${t('食物！')}`);
            }
        }

        // 5. NPC activity disruption: storms/blizzards keep NPCs indoors
        if (['storm','blizzard'].includes(this.current) || this.activeDisaster) {
            Object.values(world.agents).forEach(a => {
                if (!a.isPlayer && a.activity === 'working' && Math.random() < 0.3) {
                    a.activity = 'idle';
                }
            });
        }
    }

    _reportWeather(world) {
        const w = WEATHER_TYPES[this.current];
        if (!w) return;
        // Only report significant weather changes to news
        if (['storm','blizzard','heatwave','drought','snow'].includes(this.current)) {
            if (world.dailyNews) {
                world.dailyNews.collectEvent('weather', `${w.icon} ${w.name()}：${w.desc()}`, 6);
            }
        }
    }

    // Public API for other systems
    get weatherType() { return WEATHER_TYPES[this.current]; }
    get temperature() { return Math.round(this._temperature); }
    get humidity() { return Math.round(this._humidity); }
    get windSpeed() { return Math.round(this._windSpeed); }
    get farmModifier() {
        const w = WEATHER_TYPES[this.current];
        return (w?.farm || 0) + (this.activeDisaster?.effects?.farm || 0);
    }
    get moodModifier() {
        const w = WEATHER_TYPES[this.current];
        return (w?.mood || 0) + (this.activeDisaster?.effects?.mood || 0);
    }
    get isExtreme() { return ['storm','blizzard','heatwave','drought'].includes(this.current) || !!this.activeDisaster; }

    toDict() {
        const w = WEATHER_TYPES[this.current];
        return {
            current: this.current,
            name: w?.name() || this.current,
            icon: w?.icon || '?',
            desc: w?.desc() || '',
            duration: this.duration,
            temperature: this.temperature,
            humidity: this.humidity,
            windSpeed: this.windSpeed,
            forecast: this.forecast.map(f => {
                const fw = WEATHER_TYPES[f.type];
                return { type: f.type, name: fw?.name() || f.type, icon: fw?.icon || '?' };
            }),
            farmModifier: this.farmModifier,
            moodModifier: this.moodModifier,
            isExtreme: this.isExtreme,
            disasterWarning: this.disasterWarning ? { type: this.disasterWarning.type, severity: this.disasterWarning.severity, daysUntil: this.disasterWarning.daysUntil } : null,
            activeDisaster: this.activeDisaster ? { type: this.activeDisaster.type, name: this.activeDisaster.name, desc: this.activeDisaster.desc, daysLeft: this.activeDisaster.daysLeft, severity: this.activeDisaster.severity } : null,
        };
    }

    serialize() {
        return {
            current: this.current, duration: this.duration, streak: this.streak,
            forecast: this.forecast, _temperature: this._temperature,
            _humidity: this._humidity, _windSpeed: this._windSpeed,
            disasterWarning: this.disasterWarning, activeDisaster: this.activeDisaster,
            _daysSinceDisaster: this._daysSinceDisaster,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.current = data.current || 'clear';
        this.duration = data.duration || 1;
        this.streak = data.streak || 0;
        this.forecast = data.forecast || [];
        this._temperature = data._temperature ?? 20;
        this._humidity = data._humidity ?? 50;
        this._windSpeed = data._windSpeed ?? 0;
        this.disasterWarning = data.disasterWarning || null;
        this.activeDisaster = data.activeDisaster || null;
        this._daysSinceDisaster = data._daysSinceDisaster ?? 10;
    }
}

// ============================================================
// v4.0 - Council System (NPC 議會治理系統)
// ============================================================
const COUNCIL_PROPOSALS = [
    { id:'tax_trade', title:()=>t('提高商人稅收'), desc:()=>t('對來往商人收取更高稅金，增加收入但減少商人到訪。'),
      effects:{ silver:20, merchant_chance:-0.1, mood_traders:-5 }, category:'economy', minRep:15 },
    { id:'food_reserve', title:()=>t('建立糧食儲備制度'), desc:()=>t('每日扣留部分糧食作為儲備，減少消耗但降低滿意度。'),
      effects:{ food_save:0.1, mood_all:-2 }, category:'welfare', minRep:0 },
    { id:'festival_fund', title:()=>t('設立慶典基金'), desc:()=>t('每季撥銀幣舉辦慶典，提升全鎮心情。'),
      effects:{ silver:-30, mood_all:10, festival_chance:0.3 }, category:'culture', minRep:20 },
    { id:'night_patrol', title:()=>t('夜間巡邏制度'), desc:()=>t('安排守衛夜間巡邏，降低突襲機率但守衛更疲勞。'),
      effects:{ raid_chance:-0.08, guard_fatigue:true }, category:'defense', minRep:15 },
    { id:'open_borders', title:()=>t('開放邊境政策'), desc:()=>t('歡迎外來移民，加速人口增長但可能帶來衝突。'),
      effects:{ immigration_chance:0.2, mood_all:-3, chain_chance:0.03 }, category:'welfare', minRep:30 },
    { id:'research_grant', title:()=>t('學術研究補助'), desc:()=>t('投入資源支持研究，加速科技發展。'),
      effects:{ silver:-20, research_bonus:0.25 }, category:'culture', minRep:25 },
    { id:'trade_route', title:()=>t('開拓新貿易路線'), desc:()=>t('派商人探索新路線，短期花費大但長期增加貿易機會。'),
      effects:{ silver:-40, merchant_chance:0.2, sell_bonus:0.1 }, category:'economy', minRep:40 },
    { id:'herb_garden_public', title:()=>t('公共藥草園'), desc:()=>t('開闢公共藥草園，增加草藥產量。'),
      effects:{ herbs:5, mood_all:2 }, category:'welfare', minRep:10 },
    { id:'military_training', title:()=>t('全民防禦訓練'), desc:()=>t('所有居民接受基本防禦訓練，提升防禦但耗費時間。'),
      effects:{ defense_bonus:3, mood_all:-4 }, category:'defense', minRep:35 },
    { id:'nature_preserve', title:()=>t('自然保護區'), desc:()=>t('劃設保護區，提升採集效率和居民心情。'),
      effects:{ gathering_bonus:0.2, mood_all:3, farm_bonus:-0.05 }, category:'nature', minRep:20 },
    { id:'artisan_market', title:()=>t('工匠市集日'), desc:()=>t('每季舉辦工匠市集，促進手工業發展。'),
      effects:{ silver:15, mood_all:5, tools:3 }, category:'economy', minRep:30 },
    { id:'water_management', title:()=>t('水利工程'), desc:()=>t('修建灌溉水渠，大幅提升農業產量。'),
      effects:{ wood:-20, stone:-15, farm_bonus:0.25 }, category:'economy', minRep:50 },
];

class CouncilSystem {
    constructor() {
        this.members = [];          // agentId[] — council NPCs (3-5 members)
        this.pendingProposal = null; // {proposal, proposerId, proposerName, votes:{agentId:'for'|'against'}, daysLeft}
        this.activeDecrees = [];    // [{id, title, effects, expiresDay}]
        this.proposalLog = [];      // past proposals
        this._daysSinceProposal = 0;
        this._daysSinceCouncilCheck = 0;
        this._formed = false;
    }

    dailyUpdate(world) {
        this._daysSinceProposal++;
        this._daysSinceCouncilCheck++;

        // Try to form council if not yet formed (requires 6+ NPCs)
        if (!this._formed) {
            const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
            if (npcCount >= 6 && this._daysSinceCouncilCheck >= 5) {
                this._formCouncil(world);
                this._daysSinceCouncilCheck = 0;
            }
            if (!this._formed) return;
        }

        // Expire old decrees
        const currentDay = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;
        this.activeDecrees = this.activeDecrees.filter(d => d.expiresDay > currentDay);

        // Apply active decree effects
        this._applyDecreeEffects(world);

        // Clean up members who left the town
        this.members = this.members.filter(id => world.agents[id]);
        if (this.members.length < 2) {
            this._formed = false;
            this.pendingProposal = null;
            return;
        }

        // Process pending proposal voting
        if (this.pendingProposal) {
            this.pendingProposal.daysLeft--;
            this._processVotes(world);
            if (this.pendingProposal.daysLeft <= 0) {
                this._resolveProposal(world);
            }
            return;
        }

        // Generate new proposal every 7-12 days
        if (this._daysSinceProposal >= 7 + Math.floor(Math.random() * 6)) {
            this._generateProposal(world);
        }
    }

    _formCouncil(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (npcs.length < 6) return;

        // Select council members: prefer older, higher-skilled, higher-affinity NPCs
        const scored = npcs.map(a => {
            let score = 0;
            if (a.age >= 35) score += 3;
            if (a.age >= 45) score += 2;
            score += (a.skills?.skills?.社交?.level || 0) * 2;
            score += (a.mood + 50) / 25;
            if (a.personality.traits.includes('hardworking')) score += 2;
            if (a.personality.traits.includes('kind')) score += 2;
            if (a.personality.traits.includes('lazy')) score -= 3;
            if (a.personality.traits.includes('abrasive')) score -= 2;
            if (a.job?.key === 'mayor') score += 5;
            score += Math.random() * 4;
            return { agent: a, score };
        }).sort((a, b) => b.score - a.score);

        const size = Math.min(5, Math.max(3, Math.floor(npcs.length / 3)));
        this.members = scored.slice(0, size).map(s => s.agent.agentId);
        this._formed = true;

        const names = this.members.map(id => world.agents[id]?.name).filter(Boolean).join(t('、'));
        world.logMessage('council', `🏛️ ${t('議會成立！成員：')}${names}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('小鎮議會正式成立，成員有')}${names}`, 8);
        }
    }

    _generateProposal(world) {
        const rep = world.reputationSystem?.reputation || 0;
        const eligible = COUNCIL_PROPOSALS.filter(p => {
            // Check reputation requirement
            if (p.minRep > rep) return false;
            // Don't repeat recently passed proposals
            const recent = this.proposalLog.slice(-10);
            if (recent.some(r => r.id === p.id && r.passed)) return false;
            return true;
        });
        if (!eligible.length) return;

        const proposal = pickRandom(eligible);
        const proposer = pickRandom(this.members);
        const proposerAgent = world.agents[proposer];

        this.pendingProposal = {
            id: proposal.id,
            title: proposal.title(),
            desc: proposal.desc(),
            effects: proposal.effects,
            category: proposal.category,
            proposerId: proposer,
            proposerName: proposerAgent?.name || '?',
            votes: {},  // agentId → 'for' | 'against'
            daysLeft: 3,
            playerVoted: false,
        };
        this._daysSinceProposal = 0;

        world.logMessage('council', `🏛️ ${proposerAgent?.name || '?'}${t('提出議案：')}${proposal.title()}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('議會提案：')}${proposal.title()}`, 6);
        }
    }

    _processVotes(world) {
        if (!this.pendingProposal) return;
        for (const memberId of this.members) {
            if (this.pendingProposal.votes[memberId]) continue; // Already voted
            if (Math.random() > 0.5) continue; // Not voting today
            const agent = world.agents[memberId];
            if (!agent) continue;

            // NPC voting logic based on personality
            let forScore = 0;
            const effects = this.pendingProposal.effects;
            const cat = this.pendingProposal.category;

            // Policy alignment from election policies
            for (const policy of ELECTION_POLICIES) {
                if (policy.id === cat) {
                    for (const v of agent.personality.values) { if (policy.values.includes(v)) forScore += 3; }
                    for (const tr of agent.personality.traits) { if (policy.traits.includes(tr)) forScore += 2; }
                }
            }

            // React to negative effects
            if (effects.mood_all && effects.mood_all < 0) forScore -= 2;
            if (effects.mood_all && effects.mood_all > 0) forScore += 2;
            if (effects.silver && effects.silver < 0) forScore -= 1;
            if (effects.silver && effects.silver > 0) forScore += 1;

            // Proposer affinity matters
            const rel = agent.relationships?.relationships?.[this.pendingProposal.proposerId];
            if (rel) forScore += (rel.affinity / 100) * 5;

            // Random factor
            forScore += (Math.random() - 0.3) * 4;

            this.pendingProposal.votes[memberId] = forScore >= 0 ? 'for' : 'against';
        }
    }

    // Player votes on the current proposal
    playerVote(choice) {
        if (!this.pendingProposal || this.pendingProposal.playerVoted) return false;
        this.pendingProposal.votes['player'] = choice; // 'for' or 'against'
        this.pendingProposal.playerVoted = true;
        return true;
    }

    _resolveProposal(world) {
        if (!this.pendingProposal) return;
        const p = this.pendingProposal;

        // Count votes
        const forVotes = Object.values(p.votes).filter(v => v === 'for').length;
        const againstVotes = Object.values(p.votes).filter(v => v === 'against').length;
        const totalVotes = forVotes + againstVotes;
        const passed = forVotes > againstVotes;

        if (passed) {
            // Apply immediate resource effects
            const sp = world.stockpile;
            if (p.effects.silver && p.effects.silver > 0) sp.add('silver', p.effects.silver, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.silver && p.effects.silver < 0) sp.consume('silver', Math.abs(p.effects.silver), world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.food_save) { /* passive effect via decree */ }
            if (p.effects.herbs) sp.add('herbs', p.effects.herbs, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.tools) sp.add('tools', p.effects.tools, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.wood && p.effects.wood < 0) sp.consume('wood', Math.abs(p.effects.wood), world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.stone && p.effects.stone < 0) sp.consume('stone', Math.abs(p.effects.stone), world.tickCount, `${t('議會決議')}：${p.title}`);

            // Mood effects
            if (p.effects.mood_all) {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + p.effects.mood_all; });
            }

            // Register as active decree (modifier effects last 20 days)
            const currentDay = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;
            this.activeDecrees.push({
                id: p.id, title: p.title, effects: p.effects, expiresDay: currentDay + 20,
            });

            // Reputation gain for passing proposals
            if (world.reputationSystem) world.reputationSystem.addReputation(3, 'council', world);

            world.logMessage('council', `✅ ${t('議會通過：')}${p.title}（${forVotes}${t(' 票贊成 / ')}${againstVotes}${t(' 票反對）')}`);
        } else {
            world.logMessage('council', `❌ ${t('議會否決：')}${p.title}（${forVotes}${t(' 票贊成 / ')}${againstVotes}${t(' 票反對）')}`);
        }

        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('議會')}${passed ? t('通過') : t('否決')}${t('了')}「${p.title}」（${forVotes}:${againstVotes}）`, 7);
        }

        this.proposalLog.push({ id: p.id, title: p.title, passed, forVotes, againstVotes, totalVotes });
        if (this.proposalLog.length > 30) this.proposalLog = this.proposalLog.slice(-30);
        this.pendingProposal = null;
    }

    _applyDecreeEffects(world) {
        // Aggregate all active decree modifiers into news system
        for (const decree of this.activeDecrees) {
            const e = decree.effects;
            if (e.merchant_chance && world.news) world.news.activeModifiers['council_merchant'] = (world.news.activeModifiers['council_merchant'] || 0) + e.merchant_chance;
            if (e.raid_chance && world.news) world.news.activeModifiers['council_raid'] = (world.news.activeModifiers['council_raid'] || 0) + e.raid_chance;
            if (e.immigration_chance && world.news) world.news.activeModifiers['council_immigration'] = (world.news.activeModifiers['council_immigration'] || 0) + e.immigration_chance;
            if (e.research_bonus && world.news) world.news.activeModifiers['council_research'] = (world.news.activeModifiers['council_research'] || 0) + e.research_bonus;
            if (e.farm_bonus && world.news) world.news.activeModifiers['council_farm'] = (world.news.activeModifiers['council_farm'] || 0) + e.farm_bonus;
            if (e.gathering_bonus && world.news) world.news.activeModifiers['council_gathering'] = (world.news.activeModifiers['council_gathering'] || 0) + e.gathering_bonus;
            if (e.sell_bonus && world.news) world.news.activeModifiers['council_sell'] = (world.news.activeModifiers['council_sell'] || 0) + e.sell_bonus;
            if (e.defense_bonus && world.news) world.news.activeModifiers['council_defense'] = (world.news.activeModifiers['council_defense'] || 0) + e.defense_bonus;
            if (e.festival_chance && world.news) world.news.activeModifiers['council_festival'] = (world.news.activeModifiers['council_festival'] || 0) + e.festival_chance;
        }
    }

    toDict() {
        return {
            formed: this._formed,
            members: [...this.members],
            memberNames: [], // populated in getState
            pendingProposal: this.pendingProposal ? {
                id: this.pendingProposal.id, title: this.pendingProposal.title,
                desc: this.pendingProposal.desc, category: this.pendingProposal.category,
                proposerName: this.pendingProposal.proposerName,
                votes: { ...this.pendingProposal.votes },
                daysLeft: this.pendingProposal.daysLeft,
                playerVoted: this.pendingProposal.playerVoted,
                forCount: Object.values(this.pendingProposal.votes).filter(v => v === 'for').length,
                againstCount: Object.values(this.pendingProposal.votes).filter(v => v === 'against').length,
            } : null,
            activeDecrees: this.activeDecrees.map(d => ({ id:d.id, title:d.title })),
            proposalLog: this.proposalLog.slice(-10),
        };
    }

    serialize() {
        return {
            members: [...this.members],
            pendingProposal: this.pendingProposal,
            activeDecrees: this.activeDecrees,
            proposalLog: this.proposalLog,
            _daysSinceProposal: this._daysSinceProposal,
            _daysSinceCouncilCheck: this._daysSinceCouncilCheck,
            _formed: this._formed,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.members = data.members || [];
        this.pendingProposal = data.pendingProposal || null;
        this.activeDecrees = data.activeDecrees || [];
        this.proposalLog = data.proposalLog || [];
        this._daysSinceProposal = data._daysSinceProposal || 0;
        this._daysSinceCouncilCheck = data._daysSinceCouncilCheck || 0;
        this._formed = data._formed || false;
    }
}

// ============================================================
// v4.0 - Daily Decision System (每日決策卡片)
// ============================================================
const DAILY_DECISIONS = [
    // 請託型框架：村民來找你商量、求助、請你幫忙
    { id:'water_dispute', title:()=>t('農夫的煩惱'), desc:()=>t('農夫氣沖沖地跑來找你抱怨：「工坊把水都搶走了，我的田快乾死了！你能幫我跟鐵匠說說嗎？」'),
      optionA:{label:()=>t('幫農夫說情'), effects:{food:15,moodTarget:'farmer',moodAmt:5,moodOther:'blacksmith',moodOtherAmt:-3}, desc:()=>t('+15食物，農夫開心，鐵匠不滿')},
      optionB:{label:()=>t('勸他體諒工坊'), effects:{tools:5,moodTarget:'blacksmith',moodAmt:5,moodOther:'farmer',moodOtherAmt:-3}, desc:()=>t('+5工具，鐵匠開心，農夫不滿')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='farmer') && Object.values(w.agents).some(a=>a.job?.key==='blacksmith') },
    { id:'food_surplus', title:()=>t('吃不完的食物'), desc:()=>t('你經過倉庫，發現食物堆得滿出來了。鄰居湊過來問：「這麼多吃的，要不要辦個聚餐啊？」'),
      optionA:{label:()=>t('張羅聚餐'), effects:{food:-30,mood_all:8}, desc:()=>t('-30食物，全鎮心情+8')},
      optionB:{label:()=>t('建議拿去賣'), effects:{food:0,silver:20}, desc:()=>t('賣掉多餘的食物，+20銀幣')},
      condition: w => w.stockpile.get('food') > 100 },
    { id:'traveler_arrived', title:()=>t('路邊的旅人'), desc:()=>t('你在鎮口遇到一個疲憊的旅人，他向你搭話：「請問⋯⋯這裡能找到吃的和住的地方嗎？」'),
      optionA:{label:()=>t('帶他去安頓'), effects:{food:-10,silver:-5,mood_all:5,reputation:3}, desc:()=>t('-10食物-5銀幣，全鎮心情+5，聲望+3')},
      optionB:{label:()=>t('指個方向就好'), effects:{mood_all:-2}, desc:()=>t('全鎮心情-2，但保住資源')},
      condition: w => w.stockpile.get('food') > 20 },
    { id:'mine_danger', title:()=>t('礦工的擔憂'), desc:()=>t('礦工下工後攔住你：「裡面的支架裂了好幾根，我怕再挖下去會塌⋯⋯你覺得該跟上面說嗎？」'),
      optionA:{label:()=>t('陪他去反映'), effects:{wood:-15,stone:-10,moodTarget:'miner',moodAmt:8}, desc:()=>t('-15木材-10石材，礦工安心')},
      optionB:{label:()=>t('安慰他沒事的'), effects:{metal:10,moodTarget:'miner',moodAmt:-10}, desc:()=>t('+10金屬，但礦工士氣低落')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='miner') },
    { id:'merchant_deal', title:()=>t('商人的暗示'), desc:()=>t('商人趙霞悄悄拉你到一旁：「我手上有批好東西，算你便宜，有興趣嗎？」'),
      optionA:{label:()=>t('掏錢買下'), effects:{silver:-30,random_reward:true}, desc:()=>t('-30銀幣，有機會獲得稀有物資')},
      optionB:{label:()=>t('搖頭婉拒'), effects:{moodTarget:'trader',moodAmt:-3}, desc:()=>t('商人略顯失望')},
      condition: w => w.stockpile.get('silver') >= 30 },
    { id:'sick_npc', title:()=>t('鄰居的求助'), desc:()=>t('隔壁鄰居敲你的門，滿臉焦急：「我家人發燒了，你手邊有草藥嗎？拜託幫幫忙⋯⋯」'),
      optionA:{label:()=>t('拿草藥過去'), effects:{herbs:-5,mood_all:3,moodTarget:'doctor',moodAmt:5}, desc:()=>t('-5草藥，醫生有成就感')},
      optionB:{label:()=>t('建議多休息就好'), effects:{mood_all:-3}, desc:()=>t('全鎮有點擔心')},
      condition: w => w.stockpile.get('herbs') >= 5 && Object.values(w.agents).some(a=>a.job?.key==='doctor') },
    { id:'festival_plan', title:()=>t('酒館裡的提議'), desc:()=>t('你在酒館喝酒時，有人站起來喊：「最近大家太悶了，一起辦個慶典吧！」所有人看向你等你表態。'),
      optionA:{label:()=>t('舉手贊成'), effects:{food:-20,silver:-10,mood_all:12}, desc:()=>t('-20食物-10銀幣，全鎮大幅開心')},
      optionB:{label:()=>t('搖搖頭算了'), effects:{mood_all:-2}, desc:()=>t('居民有些失望')},
      condition: w => w.stockpile.get('food') > 40 && w.stockpile.get('silver') > 10 },
    { id:'guard_patrol', title:()=>t('守衛的商量'), desc:()=>t('守衛巡邏經過你家門口，停下來跟你聊：「最近夜裡不太平，我想多巡幾圈，你覺得呢？」'),
      optionA:{label:()=>t('主動幫忙望風'), effects:{moodTarget:'guard',moodAmt:5,mood_all:3,defense:2}, desc:()=>t('守衛積極，全鎮安心+3')},
      optionB:{label:()=>t('覺得還好吧'), effects:{moodTarget:'guard',moodAmt:-3}, desc:()=>t('守衛有些不滿')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='guard') },
    { id:'library_debate', title:()=>t('書房裡的爭執'), desc:()=>t('你路過書房，研究員和牧師正為一本古書吵得面紅耳赤。看到你進來，兩人同時問：「你說，到底誰說得對？」'),
      optionA:{label:()=>t('覺得研究員有理'), effects:{research_points:10,moodTarget:'researcher',moodAmt:8,moodOther:'priest',moodOtherAmt:-5}, desc:()=>t('+10研究點，研究員開心')},
      optionB:{label:()=>t('覺得牧師有理'), effects:{mood_all:3,moodTarget:'priest',moodAmt:8,moodOther:'researcher',moodOtherAmt:-5}, desc:()=>t('全鎮心情+3，牧師開心')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='researcher') && Object.values(w.agents).some(a=>a.job?.key==='priest') },
    { id:'crop_choice', title:()=>t('田邊的閒聊'), desc:()=>t('農夫蹲在田邊嘆氣，看到你走過來就問：「這季不知道該種什麼，你覺得種值錢的好還是種糧食穩？」'),
      optionA:{label:()=>t('建議種經濟作物'), effects:{silver:15,food:-5}, desc:()=>t('+15銀幣，但食物稍減')},
      optionB:{label:()=>t('建議種糧食'), effects:{food:20}, desc:()=>t('+20食物，穩扎穩打')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='farmer') },
    { id:'npc_conflict', title:()=>t('街上的吵架'), desc:()=>t('兩個居民在街上吵了起來，越吵越兇。旁邊的人推了推你：「你跟他們都熟，去勸勸唄？」'),
      optionA:{label:()=>t('上前調解'), effects:{mood_all:3,social_boost:5}, desc:()=>t('全鎮關係改善')},
      optionB:{label:()=>t('假裝沒看到'), effects:{mood_all:-2}, desc:()=>t('有人覺得你太冷漠')},
      condition: w => true },
    { id:'woodcutter_rest', title:()=>t('木匠的訴苦'), desc:()=>t('木匠拎著酒壺坐在你旁邊嘆氣：「最近累得不行，真想休一天⋯⋯但又怕木材不夠用。你說我該怎麼辦？」'),
      optionA:{label:()=>t('叫他好好休息'), effects:{moodTarget:'carpenter',moodAmt:10,wood:-5}, desc:()=>t('木匠感激，但今天少產木材')},
      optionB:{label:()=>t('鼓勵他再撐一下'), effects:{wood:5,moodTarget:'carpenter',moodAmt:-5}, desc:()=>t('+5木材，但木匠累了')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='carpenter') },
];

class DailyDecisionSystem {
    constructor() {
        this.pendingDecision = null;  // Current decision waiting for player
        this.decisionLog = [];        // Past decisions
        this._lastDecisionDay = 0;
    }

    dailyUpdate(world) {
        const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        if (this._lastDecisionDay === dayKey) return;
        if (this.pendingDecision) return; // Don't generate new if one is pending

        this._lastDecisionDay = dayKey;

        // Filter eligible decisions
        const eligible = DAILY_DECISIONS.filter(d => !d.condition || d.condition(world));
        if (eligible.length === 0) return;

        // Avoid repeating recent decisions
        const recentIds = this.decisionLog.slice(-5).map(d => d.id);
        const fresh = eligible.filter(d => !recentIds.includes(d.id));
        const pool = fresh.length > 0 ? fresh : eligible;

        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.pendingDecision = {
            id: chosen.id,
            title: chosen.title(),
            desc: chosen.desc(),
            optionA: { label: chosen.optionA.label(), desc: chosen.optionA.desc(), effects: chosen.optionA.effects },
            optionB: { label: chosen.optionB.label(), desc: chosen.optionB.desc(), effects: chosen.optionB.effects },
            dayKey: dayKey,
        };

        world.logMessage('decision', `💬 ${t('有人找你商量')}：${this.pendingDecision.title}`);
    }

    resolveDecision(choice, world) {
        if (!this.pendingDecision) return null;
        const decision = this.pendingDecision;
        const effects = choice === 'A' ? decision.optionA.effects : decision.optionB.effects;
        const label = choice === 'A' ? decision.optionA.label : decision.optionB.label;

        // Apply effects
        const sp = world.stockpile;
        const resourceKeys = ['food','wood','stone','metal','silver','tools','herbs','cloth','research_points'];
        for (const key of resourceKeys) {
            if (effects[key]) {
                if (effects[key] > 0) sp.add(key, effects[key], world.tickCount, `${t('決策')}：${decision.title}`);
                else sp.consume(key, Math.abs(effects[key]), world.tickCount, `${t('決策')}：${decision.title}`);
            }
        }

        // Mood effects
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }
        if (effects.moodTarget) {
            const targets = Object.values(world.agents).filter(a => a.job?.key === effects.moodTarget);
            targets.forEach(a => { a.moodModifier = (a.moodModifier || 0) + (effects.moodAmt || 0); });
        }
        if (effects.moodOther) {
            const others = Object.values(world.agents).filter(a => a.job?.key === effects.moodOther);
            others.forEach(a => { a.moodModifier = (a.moodModifier || 0) + (effects.moodOtherAmt || 0); });
        }

        // Random reward
        if (effects.random_reward) {
            const rewards = [{r:'metal',a:15},{r:'cloth',a:10},{r:'herbs',a:10},{r:'silver',a:40},{r:'tools',a:8}];
            const reward = rewards[Math.floor(Math.random() * rewards.length)];
            sp.add(reward.r, reward.a, world.tickCount, t('商人交易'));
            world.logMessage('decision', `💰 ${t('交易獲得了')} ${reward.a} ${t(reward.r)}！`);
        }

        // Social boost
        if (effects.social_boost) {
            Object.values(world.agents).forEach(a => { a.needs.social = Math.min(100, a.needs.social + effects.social_boost); });
        }

        // Reputation effects
        if (effects.reputation && world.reputationSystem) {
            world.reputationSystem.addReputation(effects.reputation, 'decisions', world);
        }

        world.logMessage('decision', `💬 ${t('你決定')}「${label}」`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('social', `${decision.title} → ${label}`, 4);
        }

        this.decisionLog.push({ id: decision.id, choice, dayKey: decision.dayKey, title: decision.title });
        if (this.decisionLog.length > 100) this.decisionLog = this.decisionLog.slice(-100);

        // v4.5.0 延遲後果:3 天後村民回來道謝或抱怨(依選項效果傾向加權)
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (npcs.length) {
            const follow = npcs[Math.floor(Math.random() * npcs.length)];
            const positive = (effects.mood_all || 0) > 0 || (effects.reputation || 0) > 0 || effects.social_boost;
            this.followups = this.followups || [];
            this.followups.push({
                dueTick: world.tickCount + 288, // 3 遊戲日
                npc: follow.name,
                title: decision.title,
                choiceLabel: label,
                good: Math.random() < (positive ? 0.78 : 0.45),
            });
        }
        this.pendingDecision = null;
        return { title: decision.title, choice: label };
    }

    // v4.5.0 每日結算延遲後果(由 World.tick 的 dailyUpdate 呼叫)
    processFollowups(world) {
        if (!this.followups?.length) return;
        this.followups = this.followups.filter(f => {
            if (world.tickCount < f.dueTick) return true;
            if (f.good) {
                world.stockpile.add('silver', 15, world.tickCount, t('村民答謝'));
                if (world.reputationSystem) world.reputationSystem.addReputation(2, 'decisions', world);
                world.logMessage('relationship', `💝 ${f.npc}${t('特地回來道謝：「上次「')}${f.title}${t('」的事，多虧你決定「')}${f.choiceLabel}${t('」，現在順利多了！」(+15 銀幣、+2 聲望)')}`, f.npc);
                if (world.dailyNews) world.dailyNews.collectEvent('social', `${f.npc}${t('公開感謝鎮長當初的決定')}`, 6, [f.npc]);
            } else {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) - 2; });
                world.logMessage('drama', `😤 ${f.npc}${t('抱怨：「上次「')}${f.title}${t('」你決定「')}${f.choiceLabel}${t('」，結果根本沒解決問題…」(全鎮心情 -2)')}`, f.npc);
                if (world.dailyNews) world.dailyNews.collectEvent('social', `${f.npc}${t('對鎮長先前的決策表達不滿')}`, 5, [f.npc]);
            }
            return false;
        });
    }

    toDict() {
        return {
            pendingDecision: this.pendingDecision,
            recentDecisions: this.decisionLog.slice(-10),
        };
    }

    serialize() {
        return {
            pendingDecision: this.pendingDecision,
            decisionLog: this.decisionLog,
            _lastDecisionDay: this._lastDecisionDay,
            followups: this.followups || [],
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.pendingDecision = data.pendingDecision || null;
        this.decisionLog = data.decisionLog || [];
        this.followups = data.followups || [];
        this._lastDecisionDay = data._lastDecisionDay || 0;
    }
}

// ============================================================
// v4.0 - Shop System (商店系統)
// ============================================================
const SHOP_ITEMS = {
    food:       { name:()=>t('食物'), icon:'🍖', buyPrice:3,  sellPrice:1, category:'basic' },
    meals:      { name:()=>t('餐食'), icon:'🍲', buyPrice:5,  sellPrice:2, category:'basic' },
    wood:       { name:()=>t('木材'), icon:'🪵', buyPrice:4,  sellPrice:2, category:'basic' },
    stone:      { name:()=>t('石材'), icon:'🪨', buyPrice:5,  sellPrice:2, category:'basic' },
    metal:      { name:()=>t('金屬'), icon:'⛓️', buyPrice:8,  sellPrice:4, category:'basic' },
    tools:      { name:()=>t('工具'), icon:'🔧', buyPrice:12, sellPrice:6, category:'craft' },
    herbs:      { name:()=>t('草藥'), icon:'🌿', buyPrice:6,  sellPrice:3, category:'craft' },
    cloth:      { name:()=>t('布料'), icon:'🧵', buyPrice:7,  sellPrice:3, category:'craft' },
    medicine:   { name:()=>t('藥品'), icon:'💊', buyPrice:15, sellPrice:8, category:'craft' },
    clothing:   { name:()=>t('衣物'), icon:'👕', buyPrice:10, sellPrice:5, category:'craft' },
    furniture:  { name:()=>t('傢俱'), icon:'🪑', buyPrice:14, sellPrice:7, category:'luxury' },
    bread:      { name:()=>t('麵包'), icon:'🍞', buyPrice:6,  sellPrice:3, category:'processed' },
    beer:       { name:()=>t('啤酒'), icon:'🍺', buyPrice:8,  sellPrice:4, category:'processed' },
    wine:       { name:()=>t('葡萄酒'), icon:'🍷', buyPrice:15, sellPrice:8, category:'luxury' },
};

class ShopSystem {
    constructor() {
        this.transactionLog = [];
    }

    getAvailableItems(world) {
        return Object.entries(SHOP_ITEMS).map(([key, item]) => ({
            key, name: item.name(), icon: item.icon,
            buyPrice: item.buyPrice, sellPrice: item.sellPrice,
            category: item.category,
            stock: world.stockpile.get(key),
            canBuy: world.stockpile.get('silver') >= item.buyPrice,
            canSell: world.stockpile.get(key) >= 1,
        }));
    }

    buy(itemKey, amount, world) {
        const item = SHOP_ITEMS[itemKey];
        if (!item) return { success: false, msg: t('商品不存在') };
        // Apply reputation shop discount
        const discount = world.reputationSystem ? world.reputationSystem.getModifier('shop_discount') : 0;
        const discountedPrice = Math.max(1, Math.round(item.buyPrice * (1 - discount)));
        const totalCost = discountedPrice * amount;
        if (!world.stockpile.has('silver', totalCost)) return { success: false, msg: t('銀幣不足') };
        world.stockpile.consume('silver', totalCost, world.tickCount, `${t('購買')}${item.name()}`);
        world.stockpile.add(itemKey, amount, world.tickCount, `${t('商店購買')}`);
        this.transactionLog.push({ type: 'buy', item: itemKey, amount, cost: totalCost, tick: world.tickCount });
        const discountText = discount > 0 ? ` (${t('聲望折扣')} ${Math.round(discount*100)}%)` : '';
        world.logMessage('economy', `🛒 ${t('購買了')} ${amount} ${item.name()}${t('，花費')} ${totalCost} ${t('銀幣')}${discountText}`);
        return { success: true, msg: `${t('購買成功')}！` };
    }

    sell(itemKey, amount, world) {
        const item = SHOP_ITEMS[itemKey];
        if (!item) return { success: false, msg: t('商品不存在') };
        if (!world.stockpile.has(itemKey, amount)) return { success: false, msg: t('庫存不足') };
        const totalIncome = item.sellPrice * amount;
        world.stockpile.consume(itemKey, amount, world.tickCount, `${t('出售')}${item.name()}`);
        world.stockpile.add('silver', totalIncome, world.tickCount, `${t('商店出售')}`);
        this.transactionLog.push({ type: 'sell', item: itemKey, amount, income: totalIncome, tick: world.tickCount });
        world.logMessage('economy', `💰 ${t('出售了')} ${amount} ${item.name()}${t('，獲得')} ${totalIncome} ${t('銀幣')}`);
        return { success: true, msg: `${t('出售成功')}！` };
    }

    toDict() {
        return { recentTransactions: this.transactionLog.slice(-20) };
    }

    serialize() { return { transactionLog: this.transactionLog }; }
    loadFrom(data) { if (data) this.transactionLog = data.transactionLog || []; }
}

// ============================================================
// v4.0 - Event Choice System (事件選擇分支)
// ============================================================
class EventChoiceSystem {
    constructor() {
        this.pendingEvent = null;
        this.eventLog = [];
    }

    // Called when an event fires — wraps it with player choices
    offerChoice(event, world) {
        if (this.pendingEvent) return; // One at a time

        const choices = this._generateChoices(event, world);
        if (!choices) return; // No choices for this event type

        // v5.36.0 敘事修正:玩家是旅人不是鎮長——全鎮大事改為「現任鎮長來徵詢你的意見」
        // v5.38.0 若玩家已當選鎮長,改回鎮長視角:鎮民等你拿主意
        const playerIsMayor = world.agents['player']?.job?.key === 'mayor';
        if (playerIsMayor) {
            this.pendingEvent = {
                eventName: event.name,
                description: `${event.description}${t('身為鎮長,全鎮都在等你拿主意。')}`,
                severity: event.severity,
                choices: choices,
                timestamp: world.tickCount,
            };
            world.logMessage('event_choice', `⚡ ${event.name}${t('——鎮民都在等鎮長的決定!')}`);
            return;
        }
        const mayor = Object.values(world.agents).find(a => !a.isPlayer && !a.isDead && a.job?.key === 'mayor');
        const asker = mayor ? mayor.name : t('鎮長');
        this.pendingEvent = {
            eventName: event.name,
            description: `${asker}${t('急匆匆找到你：「')}${event.description}${t('你見多識廣，幫我拿個主意！」')}`,
            severity: event.severity,
            choices: choices,
            timestamp: world.tickCount,
        };
        world.logMessage('event_choice', `⚡ ${event.name}${t('——')}${asker}${t('來徵詢你的意見！')}`);
    }

    _generateChoices(event, world) {
        // Generate contextual choices based on event type
        if (event.severity === 'minor') return null; // Minor events don't need choices

        if (event.threat_level) {
            // Raid/attack events
            return [
                { label: t('全力防禦'), icon: '🛡️', desc: t('派出所有守衛迎戰'),
                  effects: { defense_bonus: 3, mood_all: -3, guard_mood: 10 } },
                { label: t('談判求和'), icon: '🕊️', desc: t('嘗試用銀幣買和平'),
                  effects: { silver: -(event.threat_level * 15), mood_all: 2 } },
                { label: t('疏散居民'), icon: '🏃', desc: t('優先保護居民安全'),
                  effects: { mood_all: 5, resource_loss: true } },
            ];
        }

        if (event.effects?.mood_all < -5) {
            // Negative events (disaster, famine, etc.)
            return [
                { label: t('團結面對'), icon: '💪', desc: t('號召全鎮一起渡過難關'),
                  effects: { mood_all: 5, social_boost: 3 } },
                { label: t('祈禱平安'), icon: '🙏', desc: t('到教堂為大家祈禱'),
                  effects: { mood_all: 3, moodTarget: 'priest', moodAmt: 8 } },
            ];
        }

        return null;
    }

    resolveChoice(choiceIndex, world) {
        if (!this.pendingEvent || !this.pendingEvent.choices[choiceIndex]) return null;
        const choice = this.pendingEvent.choices[choiceIndex];
        const effects = choice.effects;

        // Apply effects
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }
        if (effects.silver) {
            if (effects.silver > 0) world.stockpile.add('silver', effects.silver, world.tickCount, t('事件決策'));
            else world.stockpile.consume('silver', Math.abs(effects.silver), world.tickCount, t('事件決策'));
        }
        // v4.5.0 一般資源消耗/獲得 + 防災準備等級
        for (const rk of ['food','wood','stone','metal','tools','herbs','cloth']) {
            if (effects[rk]) {
                if (effects[rk] > 0) world.stockpile.add(rk, effects[rk], world.tickCount, t('事件決策'));
                else world.stockpile.consume(rk, Math.abs(effects[rk]), world.tickCount, t('事件決策'));
            }
        }
        if ('disaster_prep' in effects && world.weather) {
            world.weather._prepLevel = effects.disaster_prep;
        }
        if (effects.social_boost) {
            Object.values(world.agents).forEach(a => { a.needs.social = Math.min(100, a.needs.social + effects.social_boost); });
        }
        if (effects.moodTarget) {
            Object.values(world.agents).filter(a => a.job?.key === effects.moodTarget).forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + (effects.moodAmt || 0);
            });
        }
        if (effects.guard_mood) {
            Object.values(world.agents).filter(a => a.job?.key === 'guard').forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + effects.guard_mood;
            });
        }
        if (effects.resource_loss) {
            // Lose some random resources from the raid
            ['food','wood','stone'].forEach(r => {
                const loss = Math.floor(world.stockpile.get(r) * 0.15);
                if (loss > 0) world.stockpile.consume(r, loss, world.tickCount, t('入侵損失'));
            });
        }

        world.logMessage('event_choice', `⚡ ${t('你選擇了')}「${choice.label}」${t('來應對')}${this.pendingEvent.eventName}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('event', `${t('面對')}${this.pendingEvent.eventName}${t('，鎮長選擇了')}「${choice.label}」`, 7);
        }

        this.eventLog.push({ event: this.pendingEvent.eventName, choice: choice.label, tick: world.tickCount });
        if (this.eventLog.length > 50) this.eventLog = this.eventLog.slice(-50);
        const result = { event: this.pendingEvent.eventName, choice: choice.label };
        this.pendingEvent = null;
        return result;
    }

    toDict() {
        return {
            pendingEvent: this.pendingEvent,
            recentChoices: this.eventLog.slice(-10),
        };
    }

    serialize() { return { pendingEvent: this.pendingEvent, eventLog: this.eventLog }; }
    loadFrom(data) {
        if (!data) return;
        this.pendingEvent = data.pendingEvent || null;
        this.eventLog = data.eventLog || [];
    }
}

// ============================================================
// v5.28.0 肉鴿③:局內隨機事件 / 抽卡強化(每隔幾天跳一張二/三選一,永久改變這一局)
// ============================================================
class RogueCardSystem {
    constructor() {
        this.pending = null;      // {id, icon, title, flavor, choices:[{label,icon,desc}], stamp}
        this.buffs = [];          // 持續型增益 [{key,label,daysLeft,kind}]
        this.history = [];        // [{title, choice, day}]
        this._lastCardDay = 0;
        this._nextIn = 4 + randInt(0, 3); // 首張卡的天數
    }
    _npcs(world) { return Object.values(world.agents).filter(a => a && !a.isPlayer && !a.isDead); }
    _singles(world) { return this._npcs(world).filter(a => !a.relationships.getPartner || !a.relationships.getPartner()); }
    _bumpAttr(world, key, amt) {
        let n = 0;
        for (const a of this._npcs(world)) { if (!a.attributes) continue; a.attributes[key] = Math.max(1, Math.min(10, (a.attributes[key] || 5) + amt)); n++; }
        return n;
    }
    _moodAll(world, amt) { for (const a of this._npcs(world)) a.moodModifier = (a.moodModifier || 0) + amt; }
    _res(world, key, amt) { if (amt >= 0) world.stockpile.add(key, amt, world.tickCount, t('際遇卡')); else world.stockpile.consume(key, Math.abs(amt), world.tickCount, t('際遇卡')); }
    _spark(world, romance) {
        const s = shuffle(this._singles(world));
        if (s.length < 2) return null;
        const a = s[0], b = s[1];
        const ra = a.relationships.getOrCreate(b.agentId, b.name), rb = b.relationships.getOrCreate(a.agentId, a.name);
        if (romance) { ra.modifyRomantic(22); rb.modifyRomantic(16); ra.modifyAffinity(10); rb.modifyAffinity(8); }
        else { ra.modifyAffinity(-32); rb.modifyAffinity(-30); ra.modifyTrust(-15); rb.modifyTrust(-15); }
        return [a.name, b.name];
    }
    // 卡池:每張卡 apply(world) 回傳結果字串
    _deck() {
        return [
            { id: 'merchant', icon: '🐫', title: t('旅行商隊經過'), flavor: t('一支風塵僕僕的商隊在鎮口停下,領隊朝你眨眨眼。'),
              choices: [
                { icon: '💰', label: t('買下稀有貨物'), desc: t('花 40 銀幣,換來全鎮的好心情與糧食'), apply: (w) => { this._res(w, 'silver', -40); this._res(w, 'food', 20); this._moodAll(w, 4); return t('稀有貨物讓全鎮眼睛發亮,士氣大振。'); } },
                { icon: '🧑', label: t('招募新血'), desc: t('說服一位旅人留下來定居'), apply: (w) => { if (w.events && w.events._spawnImmigrant) w.events._spawnImmigrant(w); return t('一位新居民決定在邊境鎮落腳。'); } },
                { icon: '👂', label: t('打聽消息'), desc: t('商隊帶來遠方的風流韻事…也撩動了鎮上某兩顆心'), apply: (w) => { const p = this._spark(w, true); return p ? `${p[0]}${t('和')}${p[1]}${t('之間,似乎有什麼悄悄萌芽了。')}` : t('可惜鎮上沒有適合的單身男女。'); } },
              ] },
            { id: 'blessing', icon: '🔮', title: t('神秘旅人的祝福'), flavor: t('一位蒙面旅人留下一句祝禱,便消失在暮色裡。'),
              choices: [
                { icon: '✨', label: t('魅力之祝'), desc: t('全鎮居民魅力 +1'), apply: (w) => { this._bumpAttr(w, 'charm', 1); return t('一股迷人的氣質,悄悄籠罩了全鎮。'); } },
                { icon: '🔥', label: t('膽識之祝'), desc: t('全鎮居民膽識 +1'), apply: (w) => { this._bumpAttr(w, 'grit', 1); return t('居民們的眼神,多了幾分堅定。'); } },
                { icon: '🧠', label: t('智慧之祝'), desc: t('全鎮居民智慧 +1'), apply: (w) => { this._bumpAttr(w, 'wit', 1); return t('鎮上彷彿一夜之間開了竅。'); } },
              ] },
            { id: 'harvest', icon: '🌾', title: t('豐收的抉擇'), flavor: t('今年收成不錯,穀倉滿溢。該怎麼運用這份餘裕?'),
              choices: [
                { icon: '📦', label: t('囤積過冬'), desc: t('把餘糧全存起來(+40 糧食)'), apply: (w) => { this._res(w, 'food', 40); return t('穀倉裝得滿滿當當,過冬不愁了。'); } },
                { icon: '🍲', label: t('大辦豐收宴'), desc: t('全鎮同歡(-15 糧食,士氣大漲)'), apply: (w) => { this._res(w, 'food', -15); this._moodAll(w, 7); return t('豐收宴的笑聲響徹整條街。'); } },
                { icon: '💱', label: t('賣給商人'), desc: t('換成現金(-20 糧食,+30 銀幣)'), apply: (w) => { this._res(w, 'food', -20); this._res(w, 'silver', 30); return t('餘糧換成了沉甸甸的銀幣。'); } },
              ] },
            { id: 'rumor', icon: '🔥', title: t('謠言的火種'), flavor: t('一則來路不明的傳聞在鎮上流竄,你要怎麼撥弄這把火?'),
              choices: [
                { icon: '💘', label: t('順水推舟'), desc: t('撮合一對有緣人'), apply: (w) => { const p = this._spark(w, true); return p ? `${t('在你的推波助瀾下,')}${p[0]}${t('和')}${p[1]}${t('走得更近了。')}` : t('沒有適合湊對的人。'); } },
                { icon: '⚡', label: t('挑撥離間'), desc: t('讓兩人反目(製造衝突)'), apply: (w) => { const p = this._spark(w, false); return p ? `${p[0]}${t('和')}${p[1]}${t('因為這則謠言結下了樑子。')}` : t('沒能挑起什麼事端。'); } },
                { icon: '🤐', label: t('壓下謠言'), desc: t('息事寧人(全鎮 +3 心情)'), apply: (w) => { this._moodAll(w, 3); return t('謠言被你巧妙地平息,鎮上恢復平靜。'); } },
              ] },
            { id: 'gamble', icon: '🎲', title: t('命運的賭注'), flavor: t('一位賭徒攤開骰盅,問你敢不敢賭一把。'),
              choices: [
                { icon: '🪙', label: t('穩穩收下'), desc: t('拿一筆小錢就走(+15 銀幣)'), apply: (w) => { this._res(w, 'silver', 15); return t('落袋為安,穩穩賺了一小筆。'); } },
                { icon: '🎰', label: t('豪賭一場'), desc: t('五五波:大賺 +60 或慘賠 -30 銀幣'), apply: (w) => { if (Math.random() < 0.5) { this._res(w, 'silver', 60); return t('骰子擲出好彩頭,大賺一筆!'); } else { this._res(w, 'silver', -30); return t('手氣不佳,賠了 30 銀幣…'); } } },
                { icon: '🚶', label: t('不賭走人'), desc: t('遠離是非(全鎮 +2 心情)'), apply: (w) => { this._moodAll(w, 2); return t('你搖搖頭離開,鎮民都說鎮長明智。'); } },
              ] },
            { id: 'healer', icon: '🩺', title: t('遊方醫者'), flavor: t('一位背著藥箱的醫者投宿一晚,想回報你的款待。'),
              choices: [
                { icon: '💊', label: t('為全鎮看診'), desc: t('全鎮 +8 心情'), apply: (w) => { this._moodAll(w, 8); return t('醫者妙手回春,鎮民神清氣爽。'); } },
                { icon: '📖', label: t('傳授醫術'), desc: t('提升一位居民的智慧 +2'), apply: (w) => { const a = pickRandom(this._npcs(w)); if (a && a.attributes) { a.attributes.wit = Math.min(10, (a.attributes.wit || 5) + 2); return `${a.name}${t('學到了醫者的學問,智慧大增。')}`; } return t('沒有人有空學習。'); } },
                { icon: '🌿', label: t('留下草藥'), desc: t('+15 糧食(當作補給)'), apply: (w) => { this._res(w, 'food', 15); return t('醫者留下一批珍貴的草藥補給。'); } },
              ] },
            { id: 'blessing_buff', icon: '🕯️', title: t('豐年祭的餘暉'), flavor: t('祭典的餘溫還在,你可以讓這份好氣氛延續下去。'),
              choices: [
                { icon: '🎐', label: t('延續歡慶'), desc: t('接下來 8 天,全鎮每天 +1 心情'), apply: (w) => { this.buffs.push({ key: 'festive', label: t('歡慶餘暉'), daysLeft: 8, kind: 'mood', amt: 1 }); return t('歡慶的氣氛,會在鎮上多留幾天。'); } },
                { icon: '💪', label: t('鼓舞士氣'), desc: t('全鎮 +5 心情(一次)'), apply: (w) => { this._moodAll(w, 5); return t('你的一番話,讓鎮民精神為之一振。'); } },
                { icon: '🤝', label: t('促成情誼'), desc: t('讓兩位居民成為摯友'), apply: (w) => { const s = shuffle(this._npcs(w)); if (s.length >= 2) { s[0].relationships.getOrCreate(s[1].agentId, s[1].name).modifyAffinity(30); s[1].relationships.getOrCreate(s[0].agentId, s[0].name).modifyAffinity(30); return `${s[0].name}${t('和')}${s[1].name}${t('成了無話不談的好友。')}`; } return t('沒能促成什麼。'); } },
              ] },
        ];
    }
    dailyUpdate(world) {
        // 持續型增益結算
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const bf = this.buffs[i];
            if (bf.kind === 'mood') this._moodAll(world, bf.amt || 1);
            bf.daysLeft--;
            if (bf.daysLeft <= 0) this.buffs.splice(i, 1);
        }
        if (this.pending) return; // 有卡未決,不再抽
        const day = world.clock.totalDays || 0;
        if (day - this._lastCardDay < this._nextIn) return;
        // 抽一張沒剛抽過的卡
        const deck = this._deck();
        const recentIds = new Set(this.history.slice(-3).map(h => h.id));
        const pool = deck.filter(c => !recentIds.has(c.id));
        const card = pickRandom(pool.length ? pool : deck);
        this._deckCache = deck; // resolve 時查 apply
        this.pending = {
            id: card.id, icon: card.icon, title: card.title, flavor: card.flavor,
            choices: card.choices.map(ch => ({ icon: ch.icon, label: ch.label, desc: ch.desc })),
            stamp: world.tickCount,
        };
        this._lastCardDay = day;
        this._nextIn = 5 + randInt(0, 4); // 下一張的間隔
        world.logMessage('event_choice', `🃏 ${t('際遇卡:')}${card.title}${t('——做個選擇吧!')}`);
    }
    resolve(index, world) {
        if (!this.pending) return null;
        const deck = this._deckCache || this._deck();
        const card = deck.find(c => c.id === this.pending.id);
        const choice = card && card.choices[index];
        let resultText = '';
        if (choice && typeof choice.apply === 'function') {
            try { resultText = choice.apply(world) || ''; } catch (e) { resultText = ''; }
        }
        const title = this.pending.title, label = choice ? choice.label : '';
        this.history.push({ id: this.pending.id, title, choice: label, day: world.clock.totalDays || 0 });
        if (this.history.length > 30) this.history = this.history.slice(-30);
        world.logMessage('event_choice', `🃏 ${title}:${t('你選擇了')}「${label}」——${resultText}`);
        if (world.dailyNews) world.dailyNews.collectEvent('event', `${t('鎮長在「')}${title}${t('」中選擇了')}「${label}」`, 6);
        this.pending = null;
        return { title, choice: label, resultText };
    }
    toDict() { return { pending: this.pending, buffs: this.buffs, recent: this.history.slice(-8) }; }
    serialize() { return { pending: this.pending, buffs: this.buffs, history: this.history, _lastCardDay: this._lastCardDay, _nextIn: this._nextIn }; }
    loadFrom(d) { if (!d) return; this.pending = d.pending || null; this.buffs = d.buffs || []; this.history = d.history || []; this._lastCardDay = d._lastCardDay || 0; this._nextIn = d._nextIn || 5; }
}

// ============================================================
// v4.0 - NPC Help Request System (NPC 求助系統)
// ============================================================
class NPCHelpSystem {
    constructor() {
        this.pendingRequest = null;
        this.requestLog = [];
        this._daysSinceRequest = 0;
    }

    dailyUpdate(world) {
        this._daysSinceRequest++;
        if (this._daysSinceRequest < 3) return; // Every 3 days max
        if (this.pendingRequest) return;

        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.status !== 'hospitalized');
        if (npcs.length === 0) return;

        // Find NPCs with issues
        const candidates = [];

        for (const npc of npcs) {
            // Low mood NPC
            if (npc.mood < 20) {
                candidates.push({ npc, type: 'low_mood',
                    title: `${npc.name}${t('看起來很沮喪')}`,
                    desc: `${npc.name}${t('：「最近什麼事都不太順利...你能聽我說說嗎？」')}`,
                    optionA: { label: t('陪他聊聊'), effects: { targetMood: 15, playerSocial: 10, affinity: 10 } },
                    optionB: { label: t('給他空間'), effects: { targetMood: -3, affinity: -5 } },
                });
            }
            // Hungry NPC
            if (npc.needs.hunger < 20) {
                candidates.push({ npc, type: 'hungry',
                    title: `${npc.name}${t('肚子餓了')}`,
                    desc: `${npc.name}${t('：「你有沒有多餘的食物？我快餓扁了...」')}`,
                    optionA: { label: t('分享食物'), effects: { food: -5, targetHunger: 40, affinity: 8 } },
                    optionB: { label: t('抱歉沒有'), effects: { affinity: -3 } },
                });
            }
            // Relationship conflict
            const enemies = Object.values(npc.relationships?.relationships || {}).filter(r => r.affinity < -30);
            if (enemies.length > 0) {
                const enemy = world.agents[enemies[0].targetId];
                if (enemy && !enemy.isPlayer) {
                    candidates.push({ npc, type: 'conflict',
                        title: `${npc.name}${t('和')}${enemy.name}${t('鬧矛盾')}`,
                        desc: `${npc.name}${t('：「我跟')}${enemy.name}${t('吵了一架...你覺得誰對？」')}`,
                        optionA: { label: `${t('支持')}${npc.name}`, effects: { affinity: 12, enemyAffinity: -8 }, enemyId: enemy.agentId },
                        optionB: { label: t('勸他們和好'), effects: { affinity: 3, enemyAffinity: 5, mood_all: 2 }, enemyId: enemy.agentId },
                    });
                }
            }
            // Overworked NPC
            if (npc.needs.rest < 25 && npc.job) {
                candidates.push({ npc, type: 'tired',
                    title: `${npc.name}${t('太累了')}`,
                    desc: `${npc.name}${t('：「我已經連續工作好幾天了...能不能給我放個假？」')}`,
                    optionA: { label: t('批准休假'), effects: { targetRest: 40, targetMood: 10, affinity: 5 } },
                    optionB: { label: t('鼓勵堅持'), effects: { targetMood: -5, affinity: -3 } },
                });
            }
        }

        if (candidates.length === 0) return;

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        this._daysSinceRequest = 0;
        this.pendingRequest = {
            tick: world.tickCount, // v5.34.0 供逾時代選判斷
            npcId: chosen.npc.agentId,
            npcName: chosen.npc.name,
            type: chosen.type,
            title: chosen.title,
            desc: chosen.desc,
            optionA: chosen.optionA,
            optionB: chosen.optionB,
            enemyId: chosen.optionA.enemyId || chosen.optionB.enemyId || null,
            timestamp: world.tickCount,
        };

        world.logMessage('npc_help', `💬 ${chosen.npc.name}${t('需要你的幫助！')}`);
    }

    resolveRequest(choice, world) {
        if (!this.pendingRequest) return null;
        const req = this.pendingRequest;
        const effects = choice === 'A' ? req.optionA.effects : req.optionB.effects;
        const label = choice === 'A' ? req.optionA.label : req.optionB.label;

        const npc = world.agents[req.npcId];
        const player = world.agents['player'];

        if (npc) {
            if (effects.targetMood) npc.moodModifier = (npc.moodModifier || 0) + effects.targetMood;
            if (effects.targetHunger) npc.needs.hunger = Math.min(100, npc.needs.hunger + effects.targetHunger);
            if (effects.targetRest) npc.needs.rest = Math.min(100, npc.needs.rest + effects.targetRest);
            if (effects.affinity && player) {
                const rel = npc.relationships.getOrCreate('player', player.name);
                rel.modifyAffinity(effects.affinity);
            }
        }

        if (effects.enemyAffinity && req.enemyId) {
            const enemy = world.agents[req.enemyId];
            if (enemy && player) {
                const rel = enemy.relationships.getOrCreate('player', player.name);
                rel.modifyAffinity(effects.enemyAffinity);
            }
        }

        if (effects.food && effects.food < 0) {
            world.stockpile.consume('food', Math.abs(effects.food), world.tickCount, `${t('幫助')}${req.npcName}`);
        }
        if (effects.playerSocial && player) {
            player.needs.social = Math.min(100, player.needs.social + effects.playerSocial);
        }
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }

        // Reputation for helping NPCs (option A is always the helpful choice)
        if (choice === 'A' && world.reputationSystem) {
            world.reputationSystem.addReputation(2, 'help', world);
        }

        world.logMessage('npc_help', `💬 ${t('你對')}${req.npcName}${t('說')}：「${label}」`);

        this.requestLog.push({ npcName: req.npcName, type: req.type, choice: label, tick: world.tickCount });
        if (this.requestLog.length > 50) this.requestLog = this.requestLog.slice(-50);
        const result = { npcName: req.npcName, choice: label };
        this.pendingRequest = null;
        return result;
    }

    toDict() {
        return {
            pendingRequest: this.pendingRequest,
            recentRequests: this.requestLog.slice(-10),
        };
    }

    serialize() { return { pendingRequest: this.pendingRequest, requestLog: this.requestLog, _daysSinceRequest: this._daysSinceRequest }; }
    loadFrom(data) {
        if (!data) return;
        this.pendingRequest = data.pendingRequest || null;
        this.requestLog = data.requestLog || [];
        this._daysSinceRequest = data._daysSinceRequest || 0;
    }
}

// --- Utility Functions ---
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr, rng = null) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
        const j = rng ? rng.nextInt(0, i) : Math.floor(Math.random() * (i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function weightedChoice(items, weights) {
    const total = weights.reduce((s,w) => s+w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length-1];
}

// Seeded random for reproducible map generation
class SeededRandom {
    constructor(seed) { this.seed = seed || Math.floor(Math.random() * 2147483647); }
    _next() { this.seed = (this.seed * 16807) % 2147483647; return this.seed; }
    nextFloat() { return (this._next() - 1) / 2147483646; }
    nextInt(min, max) { return Math.floor(this.nextFloat() * (max - min + 1)) + min; }
}
