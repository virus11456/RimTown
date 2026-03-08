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
        return `第${this.year}年 ${this.season} 第${this.day}天 ${h}:${m}`;
    }
    get shortTime() {
        return `${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
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
    tickDecay(isSleeping, isEating, isSocializing, isRecreating) {
        this.hunger = isEating ? Math.min(100, this.hunger + 20) : Math.max(0, this.hunger - 2);
        this.rest = isSleeping ? Math.min(100, this.rest + 8) : Math.max(0, this.rest - 1.5);
        this.social = isSocializing ? Math.min(100, this.social + 10) : Math.max(0, this.social - 1);
        this.recreation = isRecreating ? Math.min(100, this.recreation + 15) : Math.max(0, this.recreation - 0.8);
    }
    get moodContribution() {
        let s = 0;
        if (this.hunger < 20) s -= 15; else if (this.hunger > 80) s += 5;
        if (this.rest < 20) s -= 20; else if (this.rest > 80) s += 5;
        if (this.social < 20) s -= 10; else if (this.social > 70) s += 5;
        if (this.recreation < 15) s -= 8; else if (this.recreation > 70) s += 3;
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
    constructor(capacity = 100) { this.entries = []; this.capacity = capacity; }
    add(tick, timeStr, category, content, importance = 5, relatedAgents = []) {
        this.entries.push(new MemoryEntry(tick, timeStr, category, content, importance, relatedAgents));
        if (this.entries.length > this.capacity) this.entries = this.entries.slice(-this.capacity);
    }
    getRecent(n = 10) { return this.entries.slice(-n); }
    getAboutAgent(name, n = 5) { return this.entries.filter(e => e.relatedAgents.includes(name)).slice(-n); }
    getImportant(minImp = 7, n = 10) { return this.entries.filter(e => e.importance >= minImp).slice(-n); }
    summarizeRecent(n = 5) {
        const recent = this.getRecent(n);
        if (!recent.length) return '沒有近期記憶。';
        return recent.map(m => `- [${m.timeStr}] ${m.content}`).join('\n');
    }
    toDict() { return this.entries.slice(-20).map(e => e.toDict()); }
}

// --- Relationships ---
const REL_TYPES = { STRANGER:'陌生人', ACQUAINTANCE:'認識', FRIEND:'朋友',
    CLOSE_FRIEND:'摯友', RIVAL:'對手', ENEMY:'敵人', CRUSH:'暗戀', PARTNER:'伴侶' };

class Relationship {
    constructor(targetId, targetName) {
        this.targetId = targetId; this.targetName = targetName;
        this.affinity = 0; this.trust = 0; this.romanticInterest = 0;
        this.interactionCount = 0; this.lastInteractionTick = 0; this.sharedMemories = [];
    }
    get type() {
        if (this.romanticInterest > 60 && this.affinity > 50) return REL_TYPES.PARTNER;
        if (this.romanticInterest > 30) return REL_TYPES.CRUSH;
        if (this.affinity > 60) return REL_TYPES.CLOSE_FRIEND;
        if (this.affinity > 20) return REL_TYPES.FRIEND;
        if (this.affinity > -20) return this.interactionCount > 0 ? REL_TYPES.ACQUAINTANCE : REL_TYPES.STRANGER;
        if (this.affinity > -60) return REL_TYPES.RIVAL;
        return REL_TYPES.ENEMY;
    }
    modifyAffinity(d) { this.affinity = Math.max(-100, Math.min(100, this.affinity + d)); }
    modifyTrust(d) { this.trust = Math.max(-100, Math.min(100, this.trust + d)); }
    modifyRomantic(d) { this.romanticInterest = Math.max(0, Math.min(100, this.romanticInterest + d)); }
    recordInteraction(tick, summary) {
        this.interactionCount++; this.lastInteractionTick = tick;
        this.sharedMemories.push(summary);
        if (this.sharedMemories.length > 20) this.sharedMemories = this.sharedMemories.slice(-15);
    }
    toDict() {
        return { target_id:this.targetId, target_name:this.targetName, type:this.type,
                 affinity:this.affinity, trust:this.trust, romantic_interest:this.romanticInterest,
                 interaction_count:this.interactionCount };
    }
}

class RelationshipManager {
    constructor() { this.relationships = {}; }
    getOrCreate(targetId, targetName) {
        if (!this.relationships[targetId]) this.relationships[targetId] = new Relationship(targetId, targetName);
        return this.relationships[targetId];
    }
    getFriends() { return Object.values(this.relationships).filter(r => r.affinity > 20); }
    getRomanticInterests() { return Object.values(this.relationships).filter(r => r.romanticInterest > 20); }
    getBestFriend() {
        const friends = this.getFriends();
        return friends.length ? friends.reduce((a,b) => a.affinity > b.affinity ? a : b) : null;
    }
    toDict() { return Object.values(this.relationships).map(r => r.toDict()); }
}

// --- Personality ---
const TRAIT_POOL = {
    kind: { social: 2, label: '善良', description: '天生善良且富有同理心' },
    abrasive: { social: -2, label: '刻薄', description: '容易得罪別人' },
    shy: { social: -1, label: '害羞', description: '在社交場合感到不自在' },
    charismatic: { social: 3, label: '魅力', description: '天生具有吸引力' },
    gossip: { social: 1, label: '八卦', description: '喜歡散播和聽取傳聞' },
    hardworking: { work: 2, label: '勤勞', description: '在辛勤工作中獲得滿足' },
    lazy: { work: -2, label: '懶惰', description: '盡可能避免工作' },
    perfectionist: { work: 1, label: '完美主義', description: '一切都要做到最好' },
    creative: { work: 1, label: '有創意', description: '思維跳脫框架' },
    optimist: { mood_base: 10, label: '樂觀', description: '總是看到光明面' },
    pessimist: { mood_base: -10, label: '悲觀', description: '預期最壞的結果' },
    neurotic: { mood_sensitivity: 1.5, label: '神經質', description: '情緒波動劇烈' },
    stoic: { mood_sensitivity: 0.5, label: '沉穩', description: '很少表露情感' },
    romantic: { romance: 2, label: '浪漫', description: '容易墜入愛河' },
    jealous: { romance: -1, label: '嫉妒', description: '容易感到嫉妒' },
    night_owl: { schedule: 'late', label: '夜貓子', description: '偏好晚睡' },
    early_bird: { schedule: 'early', label: '早起鳥', description: '日出而作' },
    glutton: { food: 1.5, label: '貪吃', description: '比大多數人更愛吃' },
    ascetic: { comfort: -1, label: '苦行', description: '偏好簡樸的生活' },
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
    get socialModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.social || 0), 0); }
    get workModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.work || 0), 0); }
    get moodBase() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.mood_base || 0), 0); }
    describe() { return this.traits.filter(t => TRAIT_POOL[t]).map(t => `${TRAIT_POOL[t].label}：${TRAIT_POOL[t].description}`).join('；'); }
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
    get isIncapable() { return this.passion === '無能'; }
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
const ACTIVITY_SKILL_MAP = { socializing:['社交'], eating:[], sleeping:[], recreation:['藝術'], wandering:['動物','種植'] };

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
            const s = skills.get(n); if (!s.isIncapable) { s.xp += randInt(200,600); if(s.passion==='none') s.passion='minor'; }
        });
        (map.secondary||[]).forEach(n => { const s = skills.get(n); if (!s.isIncapable) s.xp += randInt(50,250); });
        (map.primary||[]).forEach(n => { if(skills.get(n).isIncapable) skills.get(n).passion='minor'; });
    }
    return skills;
}

// --- Job ---
const JOB_DEFINITIONS = {
    farmer:{title:'農夫',category:'production',description:'種植作物與照料田地',workplace:'farm',work_hours:[6,16],daily_output:'食物與農產'},
    miner:{title:'礦工',category:'production',description:'在礦場開採石頭與礦石',workplace:'quarry',work_hours:[7,16]},
    cook:{title:'廚師',category:'service',description:'在酒館準備餐食',workplace:'tavern',work_hours:[5,14]},
    blacksmith:{title:'鐵匠',category:'production',description:'鍛造工具與裝備',workplace:'workshop',work_hours:[8,17]},
    doctor:{title:'醫生',category:'intellectual',description:'治療傷病患者',workplace:'clinic',work_hours:[8,18]},
    researcher:{title:'研究員',category:'intellectual',description:'研究與發現新知識',workplace:'library',work_hours:[9,17]},
    trader:{title:'商人',category:'social',description:'管理雜貨店',workplace:'general_store',work_hours:[8,18]},
    guard:{title:'守衛',category:'combat',description:'巡邏與保護小鎮',workplace:'guardpost',work_hours:[6,18]},
    carpenter:{title:'木匠',category:'production',description:'建造與修繕建築',workplace:'workshop',work_hours:[7,16]},
    tailor:{title:'裁縫',category:'production',description:'製作衣物與紡織品',workplace:'workshop',work_hours:[8,17]},
    priest:{title:'牧師',category:'social',description:'照顧居民的心靈需求',workplace:'chapel',work_hours:[7,19]},
    mayor:{title:'鎮長',category:'social',description:'領導小鎮',workplace:'town_hall',work_hours:[9,17]},
};

class Job {
    constructor(key) {
        const d = JOB_DEFINITIONS[key];
        this.key = key; this.title = d.title; this.category = d.category; this.description = d.description;
        this.workplace = d.workplace; this.workHours = d.work_hours || [8,17]; this.skillLevel = 1;
    }
    toDict() { return { title:this.title, category:this.category, description:this.description, workplace:this.workplace, work_hours:this.workHours, skill_level:this.skillLevel }; }
}

// --- Agent ---
const ACTIVITIES = ['sleeping','eating','working','socializing','wandering','recreation','idle'];

class Agent {
    constructor(agentId, name, age = 25, personality = null, job = null, homeLocation = 'residential_north') {
        this.agentId = agentId; this.name = name; this.age = age;
        this.personality = personality || Personality.random();
        this.job = job; this.homeLocation = homeLocation;
        this.currentLocation = homeLocation; this.targetLocation = null;
        this.mood = 50 + this.personality.moodBase; this.activity = 'idle';
        this.needs = new Needs(); this.memory = new Memory(); this.relationships = new RelationshipManager();
        this.skills = generateRandomSkills(job?.key, age, this.personality.traits);
        this._lastInteractionTick = 0; this._interactionCooldown = 4;
        this.currentThought = ''; this.isPlayer = false;
    }
    get moodDescription() {
        if (this.mood >= 80) return 'ecstatic'; if (this.mood >= 60) return 'happy';
        if (this.mood >= 40) return 'content'; if (this.mood >= 20) return 'unhappy';
        if (this.mood >= 0) return 'stressed'; return 'miserable';
    }
    get moodLabel() {
        const map = { ecstatic:'欣喜若狂', happy:'快樂', content:'滿足', unhappy:'不開心', stressed:'壓力大', miserable:'痛苦' };
        return map[this.moodDescription] || this.moodDescription;
    }
    get activityLabel() {
        const map = { sleeping:'睡覺', eating:'進食', working:'工作', socializing:'社交', wandering:'閒逛', recreation:'娛樂', idle:'閒置' };
        return map[this.activity] || this.activity;
    }
    update(world) {
        this._decideActivity(world.clock.hour);
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation');
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution)));
        this._gainSkillXp(world);
        this._decideLocation(world.clock.hour);
        if (this.targetLocation && this.targetLocation !== this.currentLocation) {
            this.currentLocation = this.targetLocation; this.targetLocation = null;
        }
        if (this.activity === 'socializing') this._trySocialInteraction(world);
        if (Math.random() < 0.1) this._generateThought(world);
    }
    _gainSkillXp(world) {
        const xp = randInt(3,8);
        if (this.activity === 'working' && this.job) {
            const map = JOB_SKILL_MAP[this.job.key];
            if (map) {
                (map.primary||[]).forEach(n => {
                    if(this.skills.addXp(n, xp*2)) {
                        world.logMessage('skill_up', `${this.name}的${n}達到等級${this.skills.get(n).level}！`, this.name);
                        this.currentThought = `${n}技能進步了！`;
                    }
                });
                (map.secondary||[]).forEach(n => this.skills.addXp(n, xp));
            }
        } else {
            const actMap = ACTIVITY_SKILL_MAP[this.activity] || [];
            actMap.forEach(n => { if(this.skills.addXp(n, xp)) world.logMessage('skill_up', `${this.name}的${n}達到等級${this.skills.get(n).level}！`, this.name); });
        }
    }
    _decideActivity(hour) {
        const isNightOwl = this.personality.traits.includes('night_owl');
        const isEarlyBird = this.personality.traits.includes('early_bird');
        const sleepStart = isNightOwl ? 23 : (isEarlyBird ? 20 : 22);
        const sleepEnd = isNightOwl ? 8 : (isEarlyBird ? 5 : 6);
        if (hour >= sleepStart || hour < sleepEnd) { if (this.needs.rest < 90) { this.activity='sleeping'; return; } }
        if (this.needs.hunger < 15) { this.activity='eating'; return; }
        if (this.needs.rest < 10) { this.activity='sleeping'; return; }
        if (this.job) {
            const [ws,we] = this.job.workHours;
            if (ws <= hour && hour < we) {
                if (this.needs.hunger < 30 && Math.random() < 0.3) { this.activity='eating'; return; }
                this.activity='working'; return;
            }
        }
        const urgent = this.needs.mostUrgent;
        if (urgent==='hunger') { this.activity='eating'; return; }
        if (urgent==='social') { this.activity='socializing'; return; }
        if (urgent==='recreation') { this.activity='recreation'; return; }
        const choices = ['socializing','wandering','recreation'];
        const weights = [3,2,2];
        if (this.personality.socialModifier > 0) weights[0] += 2;
        this.activity = weightedChoice(choices, weights);
    }
    _decideLocation(hour) {
        if (this.activity==='sleeping') this.targetLocation = this.homeLocation;
        else if (this.activity==='eating') this.targetLocation = 'tavern';
        else if (this.activity==='working' && this.job) this.targetLocation = this.job.workplace;
        else if (this.activity==='socializing') this.targetLocation = pickRandom(['tavern','town_square','park','well','chapel']);
        else if (this.activity==='recreation') this.targetLocation = pickRandom(['park','library','forest','river','tavern']);
        else if (this.activity==='wandering') this.targetLocation = pickRandom(['town_square','park','forest','river','well','general_store','chapel']);
    }
    _trySocialInteraction(world) {
        if (world.tickCount - this._lastInteractionTick < this._interactionCooldown) return;
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

        // Conversation
        world.conversationEngine.generateConversation(this, target, world);
    }
    _generateThought(world) {
        const thoughts = [];
        if (this.mood > 60) { thoughts.push('邊境鎮的生活還不錯。', '今天感覺很好！'); }
        else if (this.mood < 20) { thoughts.push('事情可以更好的...', '我感覺不太好。'); }
        if (this.needs.hunger < 30) thoughts.push('肚子好餓...');
        if (this.needs.rest < 30) thoughts.push('好想睡覺...');
        if (this.needs.social < 30) thoughts.push('應該找人聊聊天...');
        const bf = this.relationships.getBestFriend();
        if (bf) thoughts.push(`該去找${bf.targetName}敘敘舊了。`);
        const rom = this.relationships.getRomanticInterests();
        if (rom.length) thoughts.push(`一直在想${pickRandom(rom).targetName}...`);
        const best = this.skills.bestSkill;
        if (best.level > 0) thoughts.push(`${best.category}技能進步中...`);
        // Economy thoughts
        if (world.stockpile) {
            if (world.stockpile.get('food') < 30) thoughts.push('食物快不夠了...');
            if (world.stockpile.get('silver') > 300) thoughts.push('鎮上的國庫很充裕！');
            if (world.stockpile.get('meals') < 10) thoughts.push('廚師需要多準備一些餐食。');
        }
        if (world.buildings?.projects?.length) { const p=world.buildings.projects[0]; thoughts.push(`${p.name}已完成${Math.round(p.workDone/p.workRequired*100)}%！`); }
        if (world.trade?.merchant) thoughts.push(`去看看${world.trade.merchant.name}在賣什麼吧。`);
        if (world.news?.bulletins?.length) {
            const latest = world.news.bulletins[world.news.bulletins.length-1];
            if (latest.severity === 'danger') thoughts.push(`「${latest.headline}」的消息令人擔憂...`);
            else if (latest.severity === 'good') thoughts.push(`好消息：${latest.headline}！`);
        }
        if (thoughts.length) this.currentThought = pickRandom(thoughts);
    }
    toDict() {
        return {
            id:this.agentId, name:this.name, age:this.age,
            job: this.job?.toDict() || null, personality: this.personality.toDict(),
            mood:this.mood, mood_description:this.moodDescription, mood_label:this.moodLabel,
            activity:this.activity, activity_label:this.activityLabel,
            current_location:this.currentLocation, current_thought:this.currentThought,
            needs:this.needs.toDict(), skills:this.skills.toDict(),
            relationships:this.relationships.toDict(), recent_memories:this.memory.toDict(),
        };
    }
}

// --- PlayerAgent ---
class PlayerAgent extends Agent {
    constructor(name = '旅人', age = 25) {
        super('player', name, age, new Personality(['curious','kind'], '最近抵達邊境鎮的神秘旅人。', ['冒險','友情']), null, 'tavern');
        this.isPlayer = true; this.chatHistory = [];
    }
    update(world) {
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation');
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution)));
    }
    moveTo(locationId, world) {
        if (world.townMap && !world.townMap.locations[locationId]) return false;
        this.currentLocation = locationId; this.activity = 'wandering';
        world.logMessage('player_move', `你移動到了${locationId.replace(/_/g,' ')}`, this.name);
        return true;
    }
    toDict() { const d = super.toDict(); d.is_player = true; d.chat_history = this.chatHistory.slice(-500); return d; }
}

// --- Gossip Network ---
class GossipNetwork {
    constructor() { this.activeGossip = []; }
    createGossip(source, about, world) {
        const rel = source.relationships.getOrCreate(about.agentId, about.name);
        const templates = [];
        if (rel.romanticInterest > 20) templates.push(`I think ${about.name} is quite attractive, don't you think?`);
        if (rel.affinity < -10) templates.push(`Between you and me, ${about.name} has been acting strange lately.`);
        if (about.mood < -20) templates.push(`Have you noticed ${about.name} seems really down lately?`);
        if (about.mood > 50) templates.push(`${about.name} has been in such a great mood recently!`);
        const ri = about.relationships.getRomanticInterests();
        if (ri.length) templates.push(`I heard ${about.name} might have feelings for ${pickRandom(ri).targetName}!`);
        if (!templates.length) templates.push(`Did you hear what ${about.name} was up to yesterday?`);
        const content = pickRandom(templates);
        const gossip = { about:about.name, content, source:source.name, spreadCount:0, tickCreated:world.tickCount, isTrue:Math.random()>0.2 };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 30) this.activeGossip = this.activeGossip.slice(-20);
        return gossip;
    }
    spreadGossip(speaker, listener, world) {
        if (!this.activeGossip.length) return null;
        const eligible = this.activeGossip.filter(g => g.about !== listener.name);
        if (!eligible.length) return null;
        if (!speaker.personality.traits.includes('gossip') && Math.random() > 0.3) return null;
        const gossip = pickRandom(eligible);
        gossip.spreadCount++;
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social',
            `${speaker.name} told me: "${gossip.content}"`, 4, [speaker.name, gossip.about]);
        world.logMessage('gossip', `${speaker.name}向${listener.name}八卦了${gossip.about}的事`, speaker.name, listener.name);
        return gossip;
    }
}

// --- Conversation Engine (Mock + LLM) ---
class ConversationEngine {
    constructor(llmClient = null) { this.llm = llmClient; }

    async generateConversation(agentA, agentB, world) {
        const relA = agentA.relationships.getOrCreate(agentB.agentId, agentB.name);
        const relB = agentB.relationships.getOrCreate(agentA.agentId, agentA.name);

        if (this.llm) {
            try {
                return await this._llmConversation(agentA, agentB, world, relA, relB);
            } catch(e) { console.error('LLM conversation failed:', e); }
        }
        return this._fallbackConversation(agentA, agentB, world, relA, relB);
    }

    async _llmConversation(agentA, agentB, world, relA, relB) {
        const gossip = world.events.getGossipTopics();
        const gossipStr = gossip.slice(-3).join(', ') || 'nothing special happening';
        const memA = agentA.memory.getAboutAgent(agentB.name, 3);
        const memB = agentB.memory.getAboutAgent(agentA.name, 3);

        const prompt = `You are simulating a conversation between two residents of a small town called RimTown.

TIME: ${world.clock.timeStr}
LOCATION: ${agentA.currentLocation}

=== PERSON A: ${agentA.name} ===
Job: ${agentA.job?.title || 'Unemployed'}
Personality: ${agentA.personality.describe()}
Background: ${agentA.personality.background}
Current mood: ${agentA.moodDescription}
Relationship with ${agentB.name}: ${relA.type} (affinity: ${relA.affinity}, romantic: ${relA.romanticInterest})
Recent memories about ${agentB.name}: ${memA.length ? memA.map(m=>m.content).join('\n') : 'None'}

=== PERSON B: ${agentB.name} ===
Job: ${agentB.job?.title || 'Unemployed'}
Personality: ${agentB.personality.describe()}
Background: ${agentB.personality.background}
Current mood: ${agentB.moodDescription}
Relationship with ${agentA.name}: ${relB.type} (affinity: ${relB.affinity}, romantic: ${relB.romanticInterest})
Recent memories about ${agentA.name}: ${memB.length ? memB.map(m=>m.content).join('\n') : 'None'}

TOWN GOSSIP/TOPICS: ${gossipStr}

Generate a natural, brief conversation (3-6 exchanges total). After the conversation, on a new line write EFFECTS: followed by JSON:
{"affinity_change_a": number, "affinity_change_b": number, "romantic_change_a": number, "romantic_change_b": number, "summary": "one sentence"}

Format each line as "NAME: dialogue".`;

        const response = await this.llm.generate(prompt, 600);
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
        const affA = effects.affinity_change_a ?? randInt(-2,5);
        const affB = effects.affinity_change_b ?? randInt(-2,5);
        const romA = effects.romantic_change_a ?? 0;
        const romB = effects.romantic_change_b ?? 0;
        const summary = effects.summary || `${agentA.name}和${agentB.name}聊了天。`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentB.name}交談：${summary}`, Math.min(8,4+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentA.name}交談：${summary}`, Math.min(8,4+Math.abs(affB)), [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        return { dialogue, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _fallbackConversation(agentA, agentB, world, relA, relB) {
        const greetings = ['嘿','你好啊','哈囉','好久不見','嗨'];
        const topics = [
            `${agentB.job?.title || '今天'}還順利嗎？`, '今天天氣不錯吧？',
            '最近有聽到什麼消息嗎？', '最近好忙啊。', '這小鎮真不錯，對吧？'
        ];
        const dialogue = [
            {speaker:agentA.name, text:`${pickRandom(greetings)}，${agentB.name}！`},
            {speaker:agentB.name, text:`${pickRandom(greetings)}！${pickRandom(topics)}`},
            {speaker:agentA.name, text:'說的也是，保重啊！'},
        ];
        const summary = `${agentA.name}和${agentB.name}簡短聊了一下。`;
        const aff = randInt(0,3);
        relA.modifyAffinity(aff); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(aff); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', summary, 3, [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', summary, 3, [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        return { dialogue, summary, effects:{affinity_a:aff,affinity_b:aff} };
    }

    async generatePlayerReply(player, npc, playerMessage, world) {
        const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
        const relPlayer = player.relationships.getOrCreate(npc.agentId, npc.name);

        if (this.llm) {
            try {
                const recentChat = player.chatHistory.filter(c => c.target === npc.name || c.speaker === npc.name)
                    .slice(-10).map(c => `${c.speaker}: ${c.text}`).join('\n');
                const memNpc = npc.memory.getAboutAgent(player.name, 5);
                const prompt = `You are ${npc.name}, a resident of RimTown. A visitor named ${player.name} is talking to you.

TIME: ${world.clock.timeStr}
LOCATION: ${npc.currentLocation}

=== YOUR CHARACTER: ${npc.name} ===
Age: ${npc.age}, Job: ${npc.job?.title||'無業'}
Personality: ${npc.personality.describe()}
Background: ${npc.personality.background}
Mood: ${npc.moodLabel}
Relationship with ${player.name}: ${relNpc.type} (affinity: ${relNpc.affinity})
Memories about ${player.name}: ${memNpc.length ? memNpc.map(m=>m.content).join('\n') : "你還不太認識他們。"}

RECENT CONVERSATION:
${recentChat || '(Start of conversation)'}

${player.name}: ${playerMessage}

Reply as ${npc.name} with 1-3 sentences. Stay in character. Respond in the same language.
After your reply, write EFFECTS: {"affinity_change": number, "romantic_change": number, "summary": "one sentence"}`;

                const response = await this.llm.generate(prompt, 300);
                return this._parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc);
            } catch(e) { console.error('LLM player reply failed:', e); }
        }
        return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
    }

    _parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc) {
        const lines = response.trim().split('\n');
        const replyLines = []; let effects = {};
        for (const line of lines) {
            const s = line.trim(); if (!s) continue;
            if (s.startsWith('EFFECTS:')) {
                try {
                    const rest = lines.slice(lines.indexOf(line)).join('\n');
                    const js=rest.indexOf('{'), je=rest.lastIndexOf('}')+1;
                    if(js>=0&&je>js) effects=JSON.parse(rest.slice(js,je));
                } catch(e){}
                break;
            } else {
                let text = s;
                if (text.startsWith(`${npc.name}:`)) text = text.slice(npc.name.length+1).trim();
                replyLines.push(text);
            }
        }
        const npcReply = replyLines.join(' ').trim() || '...';
        const affChange = effects.affinity_change ?? randInt(0,2);
        const romChange = effects.romantic_change ?? 0;
        const summary = effects.summary || `${npc.name} replied to ${player.name}.`;
        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(0, affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name} said: "${playerMessage}" - ${summary}`, 5, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${npc.name}交談：${summary}`, 4, [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', `${player.name} → ${npc.name}: ${summary}`, player.name, npc.name);
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }

    _fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc) {
        const pools = {
            high: ['見到你真高興！','我剛好在想你呢！','當然！隨時歡迎聊天。'],
            medium: ['喔，你好！什麼風把你吹來了？','嗯，我有空。','今天還不錯，你呢？'],
            low: ['嗯？有什麼事？','我有點忙...','...'],
        };
        const pool = relNpc.affinity > 30 ? pools.high : relNpc.affinity > -10 ? pools.medium : pools.low;
        const npcReply = pickRandom(pool);
        const aff = randInt(0,2);
        relNpc.modifyAffinity(aff); relNpc.recordInteraction(world.tickCount, `與${player.name}聊天`);
        relPlayer.modifyAffinity(aff); relPlayer.recordInteraction(world.tickCount, `與${npc.name}聊天`);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}和我說了話。`, 4, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `和${npc.name}聊了天。`, 3, [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', `${player.name}和${npc.name}聊天了`, player.name, npc.name);
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:aff,romantic_change:0}, summary:`${player.name}和${npc.name}聊了天。` };
    }
}

// --- LLM Client ---
class LLMClient {
    constructor(provider, apiKey, model) { this.provider = provider; this.apiKey = apiKey; this.model = model; }
    async generate(prompt, maxTokens = 500) {
        const endpoints = {
            anthropic: { url: 'https://api.anthropic.com/v1/messages', model: this.model || 'claude-haiku-4-5-20251001' },
            openai: { url: 'https://api.openai.com/v1/chat/completions', model: this.model || 'gpt-4o-mini' },
            gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/${this.model||'gemini-2.0-flash'}:generateContent?key=${this.apiKey}` },
            deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: this.model || 'deepseek-chat' },
            groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: this.model || 'llama-3.3-70b-versatile' },
            together: { url: 'https://api.together.xyz/v1/chat/completions', model: this.model || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
        };
        const cfg = endpoints[this.provider];
        if (!cfg) throw new Error(`Unknown provider: ${this.provider}`);

        if (this.provider === 'anthropic') {
            const res = await fetch(cfg.url, {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'x-api-key':this.apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
                body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, messages:[{role:'user',content:prompt}] }),
            });
            const data = await res.json();
            return data.content?.[0]?.text || '';
        } else if (this.provider === 'gemini') {
            const res = await fetch(cfg.url, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:maxTokens} }),
            });
            const data = await res.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
            // OpenAI-compatible (openai, deepseek, groq, together)
            const res = await fetch(cfg.url, {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${this.apiKey}` },
                body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, messages:[{role:'user',content:prompt}] }),
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content || '';
        }
    }
}

// --- Town Map ---
const CORE_LOCATIONS = [
    ['town_square',['城鎮廣場','中央廣場','市集廣場','村莊綠地'],'聚落的核心','social',[15,25]],
    ['tavern',['鏽鶴酒館','龍憩客棧','金壺酒館','月光酒館','旅人之家'],'飲食與社交','social',[10,18]],
    ['town_hall',['鎮公所','議事廳','鎮長辦公室','長老會所'],'小鎮的治理中心','work',[5,10]],
];
const WORK_LOCATIONS = [
    ['farm',['晴陽農場','綠畝田園','秋月農莊'],'肥沃的農田','work',[4,8]],
    ['quarry',['深岩礦場','鐵嶺礦坑','石匠坑'],'豐富的礦藏','work',[4,8]],
    ['workshop',['工匠工坊','鍛造與砧','修補工房'],'製造商品之處','work',[5,10]],
    ['general_store',['雜貨店','交易站','商人角落'],'交易與補給','work',[4,8]],
    ['clinic',['鎮醫院','治療小屋','藥房'],'醫療照護','work',[3,6]],
    ['library',['古老圖書館','學者典藏','書塔'],'知識與研究','work',[4,8]],
    ['guardpost',['守衛哨站','瞭望塔','民兵營房'],'守護小鎮','work',[3,5]],
];
const SOCIAL_LOCATIONS = [
    ['chapel',['光明教堂','石造神殿','和諧聖壇'],'平靜與沉思','social',[8,15]],
    ['park',['鎮公園','花園','日光草地'],'寧靜的綠地','social',[10,18]],
    ['well',['鎮井','泉水噴泉','水車坊'],'清澈的水源','social',[3,6]],
];
const RESIDENTIAL_LOCATIONS = [
    ['residential_north',['北區','山丘住宅','上城區'],'住宅區','residential',[8,12]],
    ['residential_south',['南區','河畔住宅','下城區'],'住宅區','residential',[8,12]],
    ['residential_east',['東區','朝陽住宅','花園區'],'住宅區','residential',[8,12]],
];
const NATURE_LOCATIONS = [
    ['forest',['低語林','幽暗松林','長老樹林'],'茂密的森林','nature',[6,10]],
    ['river',['水晶河','銀溪','急流溪'],'平靜的河流','nature',[4,8]],
    ['hill',['瞭望丘','風嘯嶺','鷹巢峰'],'高地','nature',[3,6]],
    ['cave',['暗影洞穴','迴音岩洞','舊礦坑'],'神秘的洞穴','nature',[2,5]],
    ['lake',['鏡湖','蓮花池','深潭'],'靜水','nature',[4,7]],
    ['meadow',['野花草原','起伏田野','三葉草坪'],'開闊的草原','nature',[5,10]],
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
        {name:'乾旱',description:'水井乾涸，作物枯萎。',severity:'moderate',effects:{mood_all:-8,conversation_topic:'可怕的乾旱'},seasons:['夏季'],duration_days:3},
        {name:'饑荒',description:'糧食供應嚴重不足。',severity:'major',effects:{mood_all:-15,conversation_topic:'惡化的饑荒'},delay_days:3,duration_days:4},
        {name:'暴動',description:'絕望的居民為了物資大打出手！',severity:'major',effects:{mood_all:-20,conversation_topic:'暴動'},delay_days:4,duration_days:2},
    ],
    plague_quarantine_recovery: [
        {name:'神秘疾病',description:'多名居民出現奇怪的病症。',severity:'moderate',effects:{mood_all:-10,conversation_topic:'神秘疾病'},duration_days:2},
        {name:'隔離',description:'醫生下令進行隔離。',severity:'major',effects:{mood_all:-15,conversation_topic:'隔離措施'},delay_days:2,duration_days:3},
        {name:'康復',description:'疾病已經過去！大家一起慶祝。',severity:'minor',effects:{mood_all:15,conversation_topic:'康復'},delay_days:3,duration_days:1},
    ],
    storm_damage_rebuild: [
        {name:'大風暴',description:'可怕的風暴正在侵襲小鎮！',severity:'major',effects:{mood_all:-12,conversation_topic:'毀滅性的風暴'},seasons:['秋季','冬季'],duration_days:1},
        {name:'風暴損害',description:'風暴造成了嚴重的損壞。',severity:'moderate',effects:{mood_all:-8,conversation_topic:'風暴損害'},delay_days:1,duration_days:3},
        {name:'社區重建',description:'大家齊心協力重建。',severity:'minor',effects:{mood_all:10,conversation_topic:'重建工作'},delay_days:3,duration_days:2},
    ],
};
const RAID_POOL = [
    {name:'盜匪來襲',description:'一群盜匪正在逼近！',severity:'major',threat_level:3,attacker:'盜匪',effects:{mood_all:-15,conversation_topic:'盜匪襲擊'}},
    {name:'野獸攻擊',description:'一群狼從山上下來了！',severity:'moderate',threat_level:2,attacker:'狼群',effects:{mood_all:-10,conversation_topic:'狼群攻擊'}},
    {name:'掠奪者入侵',description:'武裝掠奪者正在襲擊！',severity:'major',threat_level:4,attacker:'掠奪者',effects:{mood_all:-18,conversation_topic:'掠奪者'}},
    {name:'野豬暴走',description:'暴怒的野豬衝進鎮上！',severity:'moderate',threat_level:2,attacker:'野豬',effects:{mood_all:-8,conversation_topic:'野豬暴走'}},
];
const EVENT_POOL = [
    {name:'豐收',description:'作物長得特別好！',severity:'minor',effects:{mood_all:5},seasons:['春季','夏季']},
    {name:'寒流',description:'突如其來的寒流襲擊小鎮。',severity:'moderate',effects:{mood_all:-10},seasons:['冬季','秋季']},
    {name:'慶典日',description:'小鎮舉辦慶典！大家一起慶祝。',severity:'minor',effects:{mood_all:15}},
    {name:'物資短缺',description:'貿易路線中斷，物資不足。',severity:'moderate',effects:{mood_all:-5}},
    {name:'奇異光芒',description:'天空出現奇怪的光。',severity:'minor',effects:{mood_all:-3,conversation_topic:'奇異光芒'}},
    {name:'旅行商人',description:'一位商人帶著稀有貨物到來。',severity:'minor',effects:{mood_all:5,conversation_topic:'商人的異國貨品'}},
    {name:'美麗極光',description:'壯麗的極光照亮夜空。',severity:'minor',effects:{mood_all:10},seasons:['冬季']},
    {name:'熱浪',description:'酷熱讓戶外工作難以忍受。',severity:'moderate',effects:{mood_all:-8},seasons:['夏季']},
    {name:'幸運發現',description:'有人發現了珍貴的材料！',severity:'minor',effects:{mood_all:8,conversation_topic:'幸運的發現'}},
    {name:'觀星之夜',description:'今晚的星空特別清澈。',severity:'minor',effects:{mood_all:5,conversation_topic:'美麗的星空'}},
];
const DEPARTURE_REASONS = [
    '決定出發去進行貿易遠征','離開去城裡探望家人','踏上朝聖之旅',
    '出發去探索荒野','離開去遠方的學院進修',
    '前往首都尋求發展','出門旅行增廣見聞',
];
const IMMIGRANT_POOL = [
    {name:'周明',age:27,traits:['hardworking','optimist'],job:'farmer',background:'來自鄰村的開朗年輕農夫。'},
    {name:'李雪',age:31,traits:['kind','perfectionist'],job:'tailor',background:'聽說邊境鎮需要她的手藝的熟練裁縫。'},
    {name:'鄭強',age:35,traits:['stoic','hardworking'],job:'miner',background:'來自本地區的資深礦工。'},
    {name:'何芳',age:24,traits:['charismatic','romantic'],job:'cook',background:'懷抱遠大夢想的熱情廚師。'},
    {name:'蔡文',age:42,traits:['creative','neurotic'],job:'researcher',background:'被古代遺跡吸引而來的古怪學者。'},
    {name:'呂嵐',age:29,traits:['shy','early_bird'],job:'carpenter',background:'讓手藝說話的沉靜木匠。'},
    {name:'丁傑',age:38,traits:['abrasive','hardworking'],job:'blacksmith',background:'言語粗獷但手藝精湛的鐵匠。'},
    {name:'蕭瑜',age:23,traits:['optimist','gossip'],job:'trader',background:'善於議價的年輕商人。'},
    {name:'唐琳',age:33,traits:['kind','night_owl'],job:'doctor',background:'四處行醫的慈悲醫者。'},
    {name:'曹峰',age:44,traits:['stoic','pessimist'],job:'guard',background:'尋求平靜生活的資深戰士。'},
    {name:'邱雅',age:21,traits:['creative','shy'],job:'tailor',background:'擁有刺繡天賦的年輕工匠。'},
    {name:'范浩',age:36,traits:['lazy','charismatic'],job:'priest',background:'悠哉的精神導師。'},
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
        const raidChance = Math.max(0, Math.min(0.5, 0.10 + nm.getModifier('raid_chance', 0)));
        const chainChance = Math.max(0, Math.min(0.4, 0.08 + nm.getModifier('chain_chance', 0)));
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
            const festival = eligible.find(e => e.name === 'Festival Day');
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
            world.logMessage('raid', `小鎮成功抵禦了${rd.attacker}！`);
            guards.forEach(g => { g.mood = Math.min(100, g.mood+10); g.memory.add(world.tickCount, world.clock.timeStr,'raid',`協助抵禦了${rd.attacker}！`,8); });
        } else {
            world.logMessage('raid', `${rd.attacker}突破了我們的防線！`);
            if (world.stockpile) {
                const stolenFood = Math.min(world.stockpile.get('food'), randInt(10,30));
                const stolenSilver = Math.min(world.stockpile.get('silver'), randInt(5,20));
                if(stolenFood>0) world.stockpile.consume('food',stolenFood,world.tickCount,`被${rd.attacker}搶走`);
                if(stolenSilver>0) world.stockpile.consume('silver',stolenSilver,world.tickCount,`被${rd.attacker}搶走`);
                world.logMessage('raid',`${rd.attacker}搶走了${stolenFood}食物和${stolenSilver}銀幣！`);
            }
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.job?.key !== 'guard');
            if (npcs.length && Math.random() < 0.4) {
                const fleeing = pickRandom(npcs);
                this._sendAgentTravelling(world, fleeing, `在${rd.attacker}襲擊後逃離`, 3);
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
        world.logMessage('chain_event', `事件鏈開始：${first.name}`);
        return event;
    }
    _progressChains(world) {
        const completed = [];
        this._activeChains.forEach(chain => {
            chain.daysUntilNext--;
            if (chain.daysUntilNext <= 0) {
                const stages = EVENT_CHAINS[chain.chainId];
                const nextIdx = chain.stage + 1;
                if (nextIdx >= stages.length) { completed.push(chain); world.logMessage('chain_event',`事件鏈「${chain.chainId}」已結束。`); }
                else {
                    const stage = stages[nextIdx];
                    chain.stage = nextIdx; chain.daysUntilNext = stage.duration_days || 2;
                    const event = {name:stage.name,description:stage.description,severity:stage.severity,effects:stage.effects||{},event_type:'chain'};
                    this.eventLog.push([world.clock.timeStr, event]);
                    this._applyEffects(event, world);
                    world.logMessage('chain_event', `[${event.severity.toUpperCase()}] ${event.name}：${event.description}`);
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
            homeLocation:agent.homeLocation };
        this._travellingAgents.push({agentData:data, returnTick:world.tickCount+(travelDays*96), reason});
        world.logMessage('departure', `${agent.name}${reason}。過幾天就會回來。`, agent.name);
        const event = {name:'居民出行',description:`${agent.name}${reason}。`,severity:'minor',effects:{conversation_topic:`${agent.name}離開了小鎮`},event_type:'departure'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${agent.name}離開了小鎮`);
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
        world.agents[agent.agentId] = agent;
        world.logMessage('arrival', `${agent.name}旅行歸來了！`, agent.name);
        const event = {name:'居民歸來',description:`${agent.name}帶著故事回來了！`,severity:'minor',effects:{mood_all:3,conversation_topic:`${agent.name}的旅行故事`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'arrival',`${agent.name}旅行回來了！`,4,[agent.name]);
        });
    }
    _managePopulation(world) {
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const total = npcCount + this._travellingAgents.length;
        const immigrationBoost = world.news ? world.news.getModifier('immigration_chance', 0) : 0;
        if (total < this.TARGET_POPULATION) {
            for (let i = 0; i < this.TARGET_POPULATION - total; i++) this._spawnImmigrant(world);
        } else if (immigrationBoost > 0 && Math.random() < immigrationBoost && total < this.TARGET_POPULATION + 3) {
            this._spawnImmigrant(world);
        }
    }
    _spawnImmigrant(world) {
        let available = IMMIGRANT_POOL.filter(p => !this._usedImmigrantNames.has(p.name));
        if (!available.length) { this._usedImmigrantNames.clear(); available = [...IMMIGRANT_POOL]; }
        const imm = pickRandom(available);
        this._usedImmigrantNames.add(imm.name);
        const id = `imm_${imm.name}_${world.tickCount}`;
        const personality = new Personality(imm.traits, imm.background);
        personality.values = shuffle(['家庭','自由','知識','財富','權力','藝術','自然','社群','冒險','和平']).slice(0, 1+Math.floor(Math.random()*3));
        const job = new Job(imm.job);
        const home = pickRandom(['residential_north','residential_south','residential_east']);
        const agent = new Agent(id, imm.name, imm.age, personality, job, home);
        world.agents[agent.agentId] = agent;
        world.logMessage('immigration', `新居民到來：${agent.name}，${job.title}！`, agent.name);
        const event = {name:'新居民',description:`${agent.name}以${job.title}身分到來！`,severity:'minor',effects:{mood_all:5,conversation_topic:`新居民${agent.name}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`新居民${agent.name}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'immigration',`新居民${agent.name}到來了！`,5,[agent.name]);
        });
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
    getTravellingAgents() { return this._travellingAgents.map(t => ({name:t.agentData.name,reason:t.reason,return_tick:t.returnTick})); }
    getActiveChains() {
        return this._activeChains.map(c => {
            const stages = EVENT_CHAINS[c.chainId]; const cur = stages[c.stage];
            return {chain:c.chainId, current_event:cur.name, stage:c.stage+1, total_stages:stages.length};
        });
    }
}

// --- Economy: Stockpile ---
const DEFAULT_STOCKPILE = { food:200, wood:100, stone:80, metal:30, cloth:40, herbs:20, silver:150, meals:50, tools:10, clothing:15, medicine:5, furniture:5, research_points:0 };

class Stockpile {
    constructor() { this.resources = {...DEFAULT_STOCKPILE}; this.history = []; }
    get(r) { return this.resources[r] || 0; }
    add(r, amount, tick=0, reason='', source='') {
        this.resources[r] = (this.resources[r]||0) + amount;
        this.history.push({tick,resource:r,amount,reason,source});
        if (this.history.length > 500) this.history = this.history.slice(-300);
    }
    consume(r, amount, tick=0, reason='', source='') {
        if ((this.resources[r]||0) < amount) return false;
        this.resources[r] -= amount;
        this.history.push({tick,resource:r,amount:-amount,reason,source});
        if (this.history.length > 500) this.history = this.history.slice(-300);
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
    farmer: {inputs:{},outputs:{food:12},skill:'plants'},
    miner: {inputs:{tools:0.1},outputs:{stone:6,metal:3},skill:'mining'},
    cook: {inputs:{food:8},outputs:{meals:12},skill:'cooking'},
    blacksmith: {inputs:{metal:3,wood:1},outputs:{tools:3},skill:'crafting'},
    carpenter: {inputs:{wood:4},outputs:{furniture:2},skill:'construction'},
    tailor: {inputs:{cloth:3},outputs:{clothing:2},skill:'crafting'},
    doctor: {inputs:{herbs:2},outputs:{medicine:2},skill:'medicine'},
    researcher: {inputs:{},outputs:{research_points:5},skill:'intellectual'},
    trader: {inputs:{},outputs:{silver:8},skill:'social'},
    guard: {inputs:{},outputs:{},skill:'shooting'},
    priest: {inputs:{},outputs:{},skill:'social'},
    mayor: {inputs:{},outputs:{silver:3},skill:'social'},
};
const SEASON_FARM_MOD = {'春季':1.2,'夏季':1.5,'秋季':0.8,'冬季':0.2};
const NATURE_GATHERING = {forest:{wood:3},river:{food:2},meadow:{herbs:1,cloth:0.5},cave:{stone:2,metal:1},lake:{food:1.5}};

function processDailyProduction(world) {
    const sp = world.stockpile;
    Object.values(world.agents).forEach(agent => {
        if (agent.isPlayer || !agent.job) return;
        const recipe = JOB_PRODUCTION[agent.job.key]; if (!recipe) return;
        const skill = agent.skills.get(recipe.skill);
        let eff = 0.5 + ((skill?skill.level:0)/20)*2.0;
        if (agent.job.key === 'farmer') { eff *= SEASON_FARM_MOD[world.clock.season] || 1; eff *= 1 + (world.news?world.news.getModifier('farm_bonus',0):0); }
        if (agent.job.key === 'miner') eff *= 1 + (world.news?world.news.getModifier('mining_bonus',0):0);
        eff *= 1 + (agent.mood - 50)/500;
        eff *= 0.9 + Math.random()*0.2;
        let canProduce = true;
        for (const [r,a] of Object.entries(recipe.inputs)) { if (!sp.has(r,a)) { canProduce=false; break; } }
        if (!canProduce) { world.logMessage('economy',`${agent.name}無法工作——材料不足！`,agent.name); agent.mood=Math.max(-100,agent.mood-3); return; }
        for (const [r,a] of Object.entries(recipe.inputs)) sp.consume(r,a,world.tickCount,`${agent.name}的生產`,agent.name);
        for (const [r,a] of Object.entries(recipe.outputs)) sp.add(r,Math.round(a*eff*10)/10,world.tickCount,`${agent.name}（${agent.job.title}）`,agent.name);
        if (agent.job.key === 'priest') Object.values(world.agents).forEach(o => { if(o.agentId!==agent.agentId) o.mood=Math.min(100,o.mood+1); });
    });
    const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
    if (!sp.consume('meals',1.5*npcCount,world.tickCount,'daily consumption')) {
        const deficit = 1.5*npcCount - sp.get('meals');
        if (sp.consume('food',deficit*2,world.tickCount,'緊急食物')) world.logMessage('economy','餐食不夠！居民正在吃生食。');
        else { world.logMessage('economy','糧食短缺！居民正在挨餓！'); Object.values(world.agents).forEach(a => { a.mood=Math.max(-100,a.mood-10); a.needs.hunger=Math.max(0,a.needs.hunger-20); }); }
    }
    if (world.townMap) { for (const [locId,gather] of Object.entries(NATURE_GATHERING)) { if (world.townMap.locations[locId]) { for (const [r,a] of Object.entries(gather)) sp.add(r,a*0.5,world.tickCount,`natural (${locId})`); } } }
    sp.consume('tools',npcCount*0.05,world.tickCount,'tool wear');
    sp.consume('clothing',npcCount*0.03,world.tickCount,'clothing wear');
    if (world.clock.season === '冬季' && !sp.consume('wood',npcCount*0.3,world.tickCount,'冬季取暖')) {
        world.logMessage('economy','木材不夠取暖！');
        Object.values(world.agents).forEach(a => { a.mood=Math.max(-100,a.mood-8); a.needs.comfort=Math.max(0,a.needs.comfort-15); });
    }
}

// --- Economy: Buildings ---
const BUILDING_TEMPLATES = {
    watchtower:{name:'瞭望塔',description:'提升防禦與襲擊預警',costs:{wood:40,stone:30},work:20,effects:{defense_bonus:3}},
    granary:{name:'穀倉',description:'增加食物儲存，減少腐壞',costs:{wood:30,stone:20},work:15,effects:{food_capacity:500}},
    marketplace:{name:'市集',description:'更好的交易與更多商人',costs:{wood:25,stone:15,silver:50},work:18,effects:{trade_bonus:0.2,merchant_frequency:1.5}},
    well_upgrade:{name:'深井',description:'改善供水',costs:{stone:25,tools:3},work:12,effects:{drought_resistance:0.5}},
    training_ground:{name:'訓練場',description:'守衛訓練更快',costs:{wood:20,stone:10,tools:2},work:10,effects:{defense_bonus:2}},
    brewery:{name:'釀酒坊',description:'生產啤酒，提升娛樂',costs:{wood:15,metal:5,silver:30},work:14,effects:{recreation_bonus:10}},
    garden:{name:'藥草園',description:'生產藥草用於醫療',costs:{wood:10,silver:15},work:8,effects:{herbs_production:2}},
    school:{name:'學堂',description:'提升所有技能經驗獲取',costs:{wood:30,stone:20,silver:40},work:22,effects:{xp_bonus:1.2}},
    farm_irrigation:{name:'農田灌溉',description:'提升作物產量',costs:{stone:15,wood:10,tools:2},work:12,effects:{farm_bonus:1.3}},
    forge_bellows:{name:'鍛造風箱',description:'加速金屬加工',costs:{metal:10,stone:5},work:10,effects:{smithing_bonus:1.3}},
    clinic_upgrade:{name:'醫療病房',description:'更好的治療效果',costs:{wood:15,cloth:10,silver:25},work:14,effects:{healing_bonus:1.5}},
    town_walls:{name:'城牆',description:'大幅提升防禦',costs:{stone:80,wood:30,tools:5},work:40,effects:{defense_bonus:8}},
};

class BuildingManager {
    constructor() { this.projects=[]; this.completed=[]; this.activeEffects={}; this._counter=0; }
    getAvailable(world) {
        const done=new Set(this.completed.map(p=>p.name)), prog=new Set(this.projects.map(p=>p.name));
        return Object.entries(BUILDING_TEMPLATES).filter(([,t])=>!done.has(t.name)&&!prog.has(t.name)).map(([key,t])=>({key,...t,can_afford:world.stockpile.canAfford(t.costs)}));
    }
    startProject(key, world) {
        const t=BUILDING_TEMPLATES[key]; if(!t) return null;
        const names=new Set([...this.completed,...this.projects].map(p=>p.name));
        if(names.has(t.name)) return null;
        if(!world.stockpile.pay(t.costs,world.tickCount,`Building: ${t.name}`)) return null;
        this._counter++;
        const p={id:`build_${this._counter}`,name:t.name,description:t.description,costs:t.costs,workRequired:t.work,workDone:0,effects:t.effects||{},status:'building'};
        this.projects.push(p); world.logMessage('building',`開始建造：${t.name}！`); return p;
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
            this.projects=this.projects.filter(x=>x!==p); this.completed.push(p);
            Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
            world.logMessage('building',`建造完成：${p.name}！`);
            Object.values(world.agents).forEach(a=>{ a.mood=Math.min(100,a.mood+5); });
        });
    }
    getEffect(key, def=0) { return this.activeEffects[key]??def; }
    toDict() { return {in_progress:this.projects,completed:this.completed,active_effects:{...this.activeEffects},completed_count:this.completed.length}; }
}

// --- Economy: Trade ---
const BASE_PRICES = {food:1,wood:1.5,stone:2,metal:4,cloth:3,herbs:3.5,meals:2.5,tools:8,clothing:6,medicine:10,furniture:7};
const MERCHANT_TYPES = [
    {names:['張商人 (Zhang the Trader)','老趙商隊 (Old Zhao\'s Caravan)'],specialty:'general',sells:['food','cloth','tools','wood'],buys:['meals','furniture','clothing']},
    {names:['礦商老李 (Li the Ore Dealer)'],specialty:'metals',sells:['metal','tools','stone'],buys:['food','meals']},
    {names:['藥師小雪 (Xue the Herbalist)'],specialty:'medicine',sells:['herbs','medicine'],buys:['food','cloth']},
    {names:['絲綢商人 (The Silk Trader)'],specialty:'textiles',sells:['cloth','clothing'],buys:['food','wood','stone']},
    {names:['異國商隊 (Exotic Caravan)'],specialty:'exotic',sells:['herbs','cloth','metal'],buys:['meals','clothing','furniture','tools']},
];

class TradeManager {
    constructor() { this.merchant=null; this._daysSince=0; this.tradeHistory=[]; }
    dailyUpdate(world) {
        this._daysSince++;
        if (this.merchant) { this.merchant.daysRemaining--; if(this.merchant.daysRemaining<=0){ world.logMessage('trade',`商人${this.merchant.name}已離開。`); this.merchant=null; } return; }
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
        const offers=[];
        mt.sells.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(10,30),price:Math.round(bp*(1.2+Math.random()*0.6)*(1-tradeBonus-buyBonus)*10)/10,isBuying:false}); });
        mt.buys.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(15,40),price:Math.round(bp*(0.5+Math.random()*0.3)*(1+tradeBonus+sellBonus)*10)/10,isBuying:true}); });
        this.merchant={name:pickRandom(mt.names),specialty:mt.specialty,offers,daysRemaining:randInt(2,4)};
        world.logMessage('trade',`商人${this.merchant.name}到了！專長：${mt.specialty}。`);
    }
    executeTrade(offerIdx, qty, world) {
        if(!this.merchant) return {error:'沒有商人'};
        const offer=this.merchant.offers[offerIdx]; if(!offer) return {error:'無效交易'};
        qty=Math.min(qty,offer.amount); if(qty<=0) return {error:'無效數量'};
        const total=qty*offer.price;
        if(offer.isBuying) {
            if(!world.stockpile.has(offer.resource,qty)) return {error:`${offer.resource}不足`};
            world.stockpile.consume(offer.resource,qty,world.tickCount,`賣給${this.merchant.name}`);
            world.stockpile.add('silver',total,world.tickCount,`與${this.merchant.name}交易`);
        } else {
            if(!world.stockpile.has('silver',total)) return {error:'銀幣不足'};
            world.stockpile.consume('silver',total,world.tickCount,`向${this.merchant.name}購買`);
            world.stockpile.add(offer.resource,qty,world.tickCount,`與${this.merchant.name}交易`);
        }
        offer.amount-=qty;
        this.merchant.offers=this.merchant.offers.filter(o=>o.amount>0.5);
        world.logMessage('trade',`${offer.isBuying?'賣出':'買入'} ${qty} ${offer.resource}，${Math.round(total)}銀幣。`);
        return {ok:true};
    }
    toDict() { return {merchant:this.merchant,days_since_merchant:this._daysSince}; }
}

// --- Economy: Research ---
const RESEARCH_TREE = {
    agriculture:{name:'進階農業',description:'更好的農耕（+30%食物）',cost:50,prerequisites:[],effects:{farm_bonus:1.3},unlocks:['farm_irrigation','garden']},
    metallurgy:{name:'冶金術',description:'更好的金屬冶煉',cost:60,prerequisites:[],effects:{smithing_bonus:1.2},unlocks:['forge_bellows']},
    medicine_research:{name:'草藥醫學',description:'更好的療癒草藥',cost:55,prerequisites:[],effects:{healing_bonus:1.3},unlocks:['clinic_upgrade','garden']},
    fortification:{name:'防禦工事',description:'防禦性建築',cost:70,prerequisites:[],effects:{defense_bonus:2},unlocks:['watchtower','training_ground','town_walls']},
    commerce:{name:'商業',description:'更好的貿易方式',cost:45,prerequisites:[],effects:{trade_bonus:0.15},unlocks:['marketplace']},
    architecture:{name:'建築學',description:'進階建造',cost:65,prerequisites:['metallurgy'],effects:{build_speed:1.3},unlocks:['school','town_walls']},
    brewing:{name:'釀造術',description:'發酵的藝術',cost:35,prerequisites:['agriculture'],effects:{recreation_bonus:5},unlocks:['brewery']},
    logistics:{name:'後勤學',description:'更好的儲存',cost:50,prerequisites:['commerce'],effects:{storage_bonus:1.5},unlocks:['granary']},
    education:{name:'教育',description:'正式教育（+15%經驗）',cost:80,prerequisites:['architecture'],effects:{xp_bonus:1.15},unlocks:['school']},
    masonry:{name:'石匠術',description:'進階石工',cost:55,prerequisites:['fortification'],effects:{stone_efficiency:1.3},unlocks:['town_walls','well_upgrade']},
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
        Object.values(world.agents).forEach(a=>{ if(!a.isPlayer&&a.job?.title==='Researcher'){ const sk=a.skills.get('intellectual'); pts+=3+(sk?sk.level:0)*0.5; } });
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
            world.logMessage('research',`研究完成：${p.name}！`);
            Object.values(world.agents).forEach(a=>{ a.mood=Math.min(100,a.mood+3); });
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
    {headline:'邊境偵察報告：發現可疑蹤跡',headline_en:'Border scouts report suspicious tracks',category:'security',
     conditions:w=>true, weight:3, severity:'warning',
     modifiers:{raid_chance:0.15}, duration:3, flavor:['偵察兵在北方隘口發現營火殘跡。','貿易路線發現不明足跡。']},
    {headline:'山賊集團在鄰近地區活動',headline_en:'Bandit group active in nearby regions',category:'security',
     conditions:w=>w.clock.day>5, weight:2, severity:'danger',
     modifiers:{raid_chance:0.25,raid_severity:1}, duration:4, flavor:['鄰村難民警告有組織的盜匪。','商人回報在主要道路遭遇伏擊。']},
    {headline:'附近村莊遭受襲擊',headline_en:'Nearby village attacked',category:'security',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{raid_chance:0.30,chain_chance:0.1,mood_modifier:-5}, duration:3, flavor:['倖存者正逃向邊境鎮尋求安全。']},
    {headline:'邊境巡邏隊回報一切平靜',headline_en:'Border patrols report all clear',category:'security',
     conditions:w=>true, weight:4, severity:'good',
     modifiers:{raid_chance:-0.05}, duration:2, flavor:['周邊地區目前看來很平靜。','沒有偵測到敵對活動的跡象。']},

    // Trade/Economy related
    {headline:'商路暢通，大型商隊正在途中',headline_en:'Trade routes clear, large caravan en route',category:'trade',
     conditions:w=>!w.trade?.merchant, weight:3, severity:'good',
     modifiers:{merchant_chance:0.3,trade_bonus:0.1}, duration:3, flavor:['好幾位商人帶著異國商品正朝我們而來。','主要貿易道路已經修復。']},
    {headline:'貿易路線遭到封鎖',headline_en:'Trade routes blocked',category:'trade',
     conditions:w=>true, weight:2, severity:'warning',
     modifiers:{merchant_chance:-0.15,supply_shortage:true}, duration:4, flavor:['山崩擋住了山間隘口。','主要貿易道路的橋樑倒塌。']},
    {headline:'鄰國需求大增，物價上漲',headline_en:'Neighboring demand surges, prices rising',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{sell_bonus:0.2}, duration:3, flavor:['區域對工藝品的需求急增。','首都的大型建設工程需要材料。']},
    {headline:'市場供過於求，物價下跌',headline_en:'Market oversupply, prices falling',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{buy_bonus:0.15,sell_bonus:-0.1}, duration:3, flavor:['太多商品湧入區域市場。']},

    // Weather/Nature related
    {headline:'農夫預測：近日天氣適宜耕作',headline_en:'Farmers predict: good weather for crops',category:'weather',
     conditions:w=>['春季','夏季'].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.2,mood_modifier:3}, duration:2, flavor:['預計晴空萬里並有微雨。','完美的播種條件。']},
    {headline:'異常天象：暴風雨可能來襲',headline_en:'Unusual signs: storms may approach',category:'weather',
     conditions:w=>['秋季','冬季'].includes(w.clock.season), weight:3, severity:'warning',
     modifiers:{storm_chance:0.2,farm_bonus:-0.15,mood_modifier:-3}, duration:3, flavor:['地平線上烏雲聚集。','動物舉止異常。']},
    {headline:'乾旱警報：水源開始減少',headline_en:'Drought warning: water sources declining',category:'weather',
     conditions:w=>w.clock.season==='夏季', weight:2, severity:'danger',
     modifiers:{drought_chance:0.25,farm_bonus:-0.3,mood_modifier:-5}, duration:4, flavor:['河水水位下降很快。','水井比平時更低。']},
    {headline:'豐沛雨水帶來好收成的希望',headline_en:'Abundant rain brings hope for harvest',category:'weather',
     conditions:w=>['春季','夏季'].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.3}, duration:2, flavor:['這個季節的雨量恰到好處。']},

    // Social/Political
    {headline:'居民對鎮長的支持度創新高',headline_en:'Mayor approval rating hits new high',category:'social',
     conditions:w=>{ const mayor=Object.values(w.agents).find(a=>a.job?.title==='Mayor'); return mayor&&mayor.mood>40; }, weight:2, severity:'good',
     modifiers:{mood_modifier:5,immigration_chance:0.1}, duration:2, flavor:['鎮議會合作良好。']},
    {headline:'不滿情緒蔓延，居民要求改善',headline_en:'Discontent spreading, residents demand change',category:'social',
     conditions:w=>{ const avg=Object.values(w.agents).filter(a=>!a.isPlayer).reduce((s,a)=>s+a.mood,0)/(Object.values(w.agents).length||1); return avg<30; }, weight:3, severity:'warning',
     modifiers:{mood_modifier:-5,departure_chance:0.15,chain_chance:0.1}, duration:3, flavor:['好幾位居民大聲抱怨。','酒館裡的氣氛很緊張。']},
    {headline:'有人目擊鄰近地區的疫病',headline_en:'Plague spotted in neighboring area',category:'health',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{plague_chance:0.2,mood_modifier:-8,merchant_chance:-0.1}, duration:4, flavor:['旅人回報東方聚落正在蔓延疾病。']},
    {headline:'學者發現了古代遺跡的新線索',headline_en:'Scholar discovers clues to ancient ruins',category:'discovery',
     conditions:w=>Object.values(w.agents).some(a=>a.job?.key==='researcher'), weight:2, severity:'good',
     modifiers:{research_bonus:0.3,mood_modifier:3}, duration:3, flavor:['古籍暗示附近藏有寶藏。','破解古手稿取得突破。']},
    {headline:'野生動物出沒增加',headline_en:'Wild animal sightings increasing',category:'nature',
     conditions:w=>true, weight:3, severity:'info',
     modifiers:{animal_raid_chance:0.1,gathering_bonus:0.15}, duration:2, flavor:['森林附近發現更多鹿和兔子。','獵人回報獵物豐富。']},
    {headline:'遠方傳來戰爭的消息',headline_en:'News of war from distant lands',category:'political',
     conditions:w=>w.clock.year>=1&&w.clock.day>10, weight:1, severity:'warning',
     modifiers:{raid_chance:0.1,merchant_chance:0.1,immigration_chance:0.15,mood_modifier:-3}, duration:5, flavor:['難民可能會來此避難。','戰爭帶來危險也帶來機會。']},
    {headline:'節慶將至，居民期待歡慶',headline_en:'Festival approaching, residents look forward',category:'social',
     conditions:w=>w.clock.day>=12&&w.clock.day<=14, weight:4, severity:'good',
     modifiers:{mood_modifier:8,festival_chance:0.4}, duration:2, flavor:['季節慶典的準備工作正在進行中。','大家都很期待即將到來的慶祝活動。']},
    {headline:'礦坑發現新的礦脈',headline_en:'New ore vein discovered in quarry',category:'discovery',
     conditions:w=>w.townMap?.locations?.['quarry'], weight:2, severity:'good',
     modifiers:{mining_bonus:0.25}, duration:3, flavor:['礦工對豐富的礦藏感到興奮。','新礦脈含有高品質的金屬礦石。']},
    {headline:'城鎮名聲遠播，吸引新居民',headline_en:'Town reputation grows, attracting settlers',category:'social',
     conditions:w=>Object.values(w.agents).filter(a=>!a.isPlayer).length<=10, weight:2, severity:'good',
     modifiers:{immigration_chance:0.25,mood_modifier:3}, duration:3, flavor:['邊境鎮繁榮的消息正在傳播。']},
];

class NewsSystem {
    constructor() {
        this.bulletins = []; // {headline, headline_en, category, severity, flavor, modifiers, expiresDay, publishedDay, publishedTime}
        this.activeModifiers = {}; // aggregated from all active bulletins
        this._lastPublishDay = 0;
    }

    dailyUpdate(world) {
        // Expire old bulletins
        const currentDay = world.clock.year * 60 + ((['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15) + world.clock.day;
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
                        if (!a.isPlayer) a.mood = Math.max(-100, Math.min(100, a.mood + Math.round(bulletin.modifiers.mood_modifier * 0.5)));
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

// --- World ---
class World {
    constructor() {
        this.clock = new GameClock();
        this.events = new EventSystem();
        this.agents = {};
        this.townMap = null;
        this.tickCount = 0;
        this.paused = false;
        this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.conversationEngine = new ConversationEngine();
        // Economy
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
    }
    addAgent(agent) { this.agents[agent.agentId] = agent; }
    removeAgent(id) { delete this.agents[id]; }
    getAgent(id) { return this.agents[id] || null; }
    getAgentByName(name) { return Object.values(this.agents).find(a => a.name === name) || null; }
    getAgentsAtLocation(locId) { return Object.values(this.agents).filter(a => a.currentLocation === locId); }
    logMessage(type, content, agentName = '', targetName = '') {
        this.messageLog.push({ time:this.clock.timeStr, tick:this.tickCount, type, content, agent:agentName, target:targetName });
        if (this.messageLog.length > 500) this.messageLog = this.messageLog.slice(-300);
    }
    tick() {
        if (this.paused) return;
        this.tickCount++;
        const timeEvents = this.clock.tick();
        if (timeEvents.includes('new_day')) {
            const event = this.events.dailyUpdate(this);
            if (event) {
                this.logMessage('event', `[${event.severity.toUpperCase()}] ${event.name}: ${event.description}`);
                if (event.effects.mood_all != null) {
                    Object.values(this.agents).forEach(a => { a.mood = Math.max(-100, Math.min(100, a.mood + event.effects.mood_all)); });
                }
            }
            // Daily news (before economy/events so modifiers apply)
            this.news.dailyUpdate(this);
            // Daily economy
            processDailyProduction(this);
            this.stockpile.history.filter(h=>h.amount>0).slice(-50).forEach(h=>this.workOrders.updateProgress(h.resource,h.amount));
            this.buildings.dailyConstruction(this);
            this.trade.dailyUpdate(this);
            this.research.dailyUpdate(this);
            this.workOrders.cleanup();
        }
        Object.values(this.agents).forEach(agent => agent.update(this));
    }
    getState() {
        return {
            clock: this.clock.toDict(), tick: this.tickCount, paused: this.paused,
            agents: Object.fromEntries(Object.entries(this.agents).map(([id,a]) => [id, a.toDict()])),
            locations: this.townMap?.toDict() || {},
            recent_events: this.events.getRecentEvents().map(([t,e]) => ({time:t, name:e.name, description:e.description, severity:e.severity, event_type:e.event_type})),
            recent_messages: this.messageLog.slice(-30),
            travelling_agents: this.events.getTravellingAgents(),
            active_chains: this.events.getActiveChains(),
            stockpile: this.stockpile.toDict(),
            buildings: this.buildings.toDict(),
            trade: this.trade.toDict(),
            research: this.research.toDict(),
            work_orders: this.workOrders.toDict(),
            news: this.news.toDict(),
        };
    }
    reset(seed = null) {
        this.clock.reset(); this.events = new EventSystem();
        this.agents = {}; this.tickCount = 0; this.paused = false; this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
        this.townMap = generateRandomTown(seed);
        this._loadDefaultResidents();
        const player = new PlayerAgent();
        this.addAgent(player);
    }
    _loadDefaultResidents() {
        const residents = [
            {id:'chen_wei',name:'陳偉 (Chen Wei)',age:45,job:'mayor',home:'residential_north',traits:['charismatic','hardworking','optimist'],values:['community','peace'],background:'A former military officer who settled in RimTown 20 years ago. He cares deeply about the community.'},
            {id:'lin_mei',name:'林美 (Lin Mei)',age:32,job:'doctor',home:'residential_north',traits:['kind','perfectionist','night_owl'],values:['knowledge','family'],background:'A talented doctor who left a prestigious hospital to provide medical care to the rural town.'},
            {id:'zhang_hao',name:'張豪 (Zhang Hao)',age:28,job:'blacksmith',home:'residential_south',traits:['hardworking','shy','stoic'],values:['art','freedom'],background:'A quiet but skilled craftsman who expresses himself through metalwork. Has a secret passion for poetry.'},
            {id:'wang_li',name:'王麗 (Wang Li)',age:38,job:'cook',home:'residential_south',traits:['gossip','kind','glutton'],values:['community','family'],background:'The heart and soul of the tavern. She knows everyone\'s business.'},
            {id:'liu_jun',name:'劉俊 (Liu Jun)',age:22,job:'farmer',home:'residential_east',traits:['early_bird','romantic','creative'],values:['nature','adventure'],background:'A young farmer with big dreams. He writes love letters that he never sends.'},
            {id:'zhao_xia',name:'趙霞 (Zhao Xia)',age:35,job:'trader',home:'residential_east',traits:['charismatic','creative','pessimist'],values:['wealth','adventure'],background:'A savvy merchant with connections to the outside world.'},
            {id:'yang_feng',name:'楊鋒 (Yang Feng)',age:40,job:'guard',home:'residential_north',traits:['stoic','hardworking','jealous'],values:['power','family'],background:'A former mercenary who found peace guarding RimTown.'},
            {id:'sun_yu',name:'孫雨 (Sun Yu)',age:26,job:'researcher',home:'residential_east',traits:['creative','neurotic','night_owl'],values:['knowledge','freedom'],background:'A brilliant but anxious young scholar studying ancient ruins near the town.'},
            {id:'wu_da',name:'吳達 (Wu Da)',age:50,job:'miner',home:'residential_south',traits:['hardworking','pessimist','abrasive'],values:['wealth','freedom'],background:'A grizzled miner who\'s been digging since he was 16. Rough but reliable.'},
            {id:'huang_li',name:'黃莉 (Huang Li)',age:29,job:'priest',home:'residential_north',traits:['kind','optimist','romantic'],values:['peace','community','art'],background:'A gentle soul who tends the chapel. She has a beautiful singing voice.'},
            {id:'ma_qiang',name:'馬強 (Ma Qiang)',age:33,job:'carpenter',home:'residential_south',traits:['lazy','charismatic','gossip'],values:['freedom','adventure'],background:'A charming slacker who\'d rather tell stories than swing a hammer.'},
            {id:'xu_ying',name:'許瑩 (Xu Ying)',age:20,job:'tailor',home:'residential_east',traits:['shy','perfectionist','early_bird'],values:['art','family'],background:'The youngest adult in town. A talented seamstress too timid to accept compliments.'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home);
            this.addAgent(agent);
        });
    }

    // --- Save / Load ---
    serialize() {
        const serializeAgent = (a) => ({
            id:a.agentId, name:a.name, age:a.age, isPlayer:a.isPlayer,
            jobKey: a.job?.key || null,
            homeLocation: a.homeLocation, currentLocation: a.currentLocation,
            mood: a.mood, activity: a.activity, currentThought: a.currentThought,
            personality: { traits:a.personality.traits, background:a.personality.background, values:a.personality.values },
            needs: { hunger:a.needs.hunger, rest:a.needs.rest, social:a.needs.social, comfort:a.needs.comfort, recreation:a.needs.recreation, beauty:a.needs.beauty },
            skills: Object.fromEntries(Object.entries(a.skills.skills).map(([k,s])=>[k,{xp:s.xp,passion:s.passion}])),
            relationships: Object.fromEntries(Object.entries(a.relationships.relationships).map(([k,r])=>[k,{
                targetId:r.targetId, targetName:r.targetName, affinity:r.affinity, trust:r.trust,
                romanticInterest:r.romanticInterest, interactionCount:r.interactionCount,
                lastInteractionTick:r.lastInteractionTick, sharedMemories:r.sharedMemories.slice(-10)
            }])),
            memory: a.memory.entries.slice(-50).map(m=>({tick:m.tick,timeStr:m.timeStr,category:m.category,content:m.content,importance:m.importance,relatedAgents:m.relatedAgents})),
            chatHistory: a.isPlayer ? (a.chatHistory||[]).slice(-500) : undefined,
            _lastInteractionTick: a._lastInteractionTick,
        });
        return {
            version: 2,
            savedAt: new Date().toISOString(),
            clock: { day:this.clock.day, hour:this.clock.hour, minute:this.clock.minute, season:this.clock.season, year:this.clock.year },
            tickCount: this.tickCount,
            paused: this.paused,
            messageLog: this.messageLog.slice(-100),
            townMap: this.townMap ? { seed:this.townMap.seed, terrain:this.townMap.terrain, width:this.townMap.width, height:this.townMap.height,
                locations: Object.fromEntries(Object.entries(this.townMap.locations).map(([k,v])=>[k,{id:v.id,name:v.name,description:v.description,x:v.x,y:v.y,category:v.category,capacity:v.capacity}])) } : null,
            agents: Object.fromEntries(Object.entries(this.agents).map(([k,a])=>[k,serializeAgent(a)])),
            gossip: this.gossipNetwork.activeGossip.slice(-15),
            events: {
                eventLog: this.events.eventLog.slice(-20),
                activeEffects: {...this.events.activeEffects},
                conversationTopics: [...this.events.conversationTopics],
                _activeChains: this.events._activeChains.map(c=>({...c})),
                _travellingAgents: this.events._travellingAgents.map(t=>({agentData:{...t.agentData},returnTick:t.returnTick,reason:t.reason})),
                _daysSinceRaid: this.events._daysSinceRaid,
                _daysSinceChain: this.events._daysSinceChain,
                _daysSinceDeparture: this.events._daysSinceDeparture,
                _usedImmigrantNames: [...this.events._usedImmigrantNames],
            },
            stockpile: { resources:{...this.stockpile.resources}, history:this.stockpile.history.slice(-50) },
            buildings: { projects:this.buildings.projects.map(p=>({...p})), completed:this.buildings.completed.map(p=>({...p})), activeEffects:{...this.buildings.activeEffects}, _counter:this.buildings._counter },
            trade: { merchant:this.trade.merchant?{...this.trade.merchant,offers:this.trade.merchant.offers.map(o=>({...o}))}:null, _daysSince:this.trade._daysSince, tradeHistory:this.trade.tradeHistory.slice(-10) },
            research: { projects:Object.fromEntries(Object.entries(this.research.projects).map(([k,p])=>[k,{...p}])), current:this.research.current },
            workOrders: { orders:this.workOrders.orders.map(o=>({...o})), _counter:this.workOrders._counter },
            news: { bulletins:this.news.bulletins.map(b=>({...b})), activeModifiers:{...this.news.activeModifiers}, _lastPublishDay:this.news._lastPublishDay },
        };
    }

    loadSave(data) {
        if (!data || !data.version) return false;
        try {
            // Clock
            this.clock.day=data.clock.day; this.clock.hour=data.clock.hour; this.clock.minute=data.clock.minute;
            this.clock.season=data.clock.season; this.clock.year=data.clock.year;
            this.tickCount = data.tickCount;
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
                    agent.chatHistory = ad.chatHistory || [];
                } else {
                    agent = new Agent(id, ad.name, ad.age, personality, job, ad.homeLocation);
                }
                agent.currentLocation = ad.currentLocation;
                agent.mood = ad.mood; agent.activity = ad.activity;
                agent.currentThought = ad.currentThought || '';
                agent._lastInteractionTick = ad._lastInteractionTick || 0;
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
                    }
                }
                // Memory
                if (ad.memory) {
                    ad.memory.forEach(m => agent.memory.add(m.tick, m.timeStr, m.category, m.content, m.importance, m.relatedAgents));
                }
                this.agents[id] = agent;
            }

            // Gossip
            this.gossipNetwork = new GossipNetwork();
            this.gossipNetwork.activeGossip = data.gossip || [];

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
            if (data.buildings) {
                this.buildings.projects = data.buildings.projects || [];
                this.buildings.completed = data.buildings.completed || [];
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

            this.logMessage('system', '遊戲讀取成功！');
            return true;
        } catch(e) {
            console.error('Failed to load save:', e);
            return false;
        }
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
    constructor(seed) { this.seed = seed ?? Math.floor(Math.random() * 2147483647); }
    _next() { this.seed = (this.seed * 16807) % 2147483647; return this.seed; }
    nextFloat() { return (this._next() - 1) / 2147483646; }
    nextInt(min, max) { return Math.floor(this.nextFloat() * (max - min + 1)) + min; }
}
