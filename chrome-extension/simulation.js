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
    constructor(capacity = 10000) { this.entries = []; this.capacity = capacity; }
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
    toDict() { return this.entries.slice(-10000).map(e => e.toDict()); }
}

// --- Relationships ---
const REL_TYPES = { STRANGER:'陌生人', ACQUAINTANCE:'認識', FRIEND:'朋友',
    CLOSE_FRIEND:'摯友', RIVAL:'對手', ENEMY:'敵人', CRUSH:'暗戀',
    DATING:'交往中', MARRIED:'已婚', EX:'前任' };

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
        const m = { dating:'交往中', married:'已婚', ex:'前任' };
        return this.status ? m[this.status] || '' : '';
    }
    modifyAffinity(d) { this.affinity = Math.max(-100, Math.min(100, this.affinity + d)); }
    modifyTrust(d) { this.trust = Math.max(-100, Math.min(100, this.trust + d)); }
    modifyRomantic(d) { this.romanticInterest = Math.max(0, Math.min(100, this.romanticInterest + d)); }
    recordInteraction(tick, summary) {
        this.interactionCount++; this.lastInteractionTick = tick;
        this.sharedMemories.push(summary);
        if (this.sharedMemories.length > 10000) this.sharedMemories = this.sharedMemories.slice(-10000);
    }
    addSharedMemory(text) {
        this.sharedMemories.push(text);
        if (this.sharedMemories.length > 10000) this.sharedMemories = this.sharedMemories.slice(-10000);
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
    toDict() { return { key:this.key, title:this.title, category:this.category, description:this.description, workplace:this.workplace, work_hours:this.workHours, skill_level:this.skillLevel }; }
}

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
        this._lastInteractionTick = 0; this._interactionCooldown = 6;
        this.currentThought = ''; this.isPlayer = false;
        this._locationStayTicks = 0; // how many ticks to stay at current location
        this._locationStayRemaining = 0; // countdown
        this.moodModifier = 0; // accumulated mood changes from events, decays over time
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
        const map = { sleeping:'睡覺', eating:'進食', working:'工作', socializing:'社交', wandering:'閒逛', recreation:'娛樂', idle:'閒置', stargazing:'看星星', night_mischief:'搞事', night_stroll:'夜間散步', exploring:'探險中' };
        return map[this.activity] || this.activity;
    }
    get genderLabel() {
        return this.gender === 'male' ? '男' : this.gender === 'female' ? '女' : '不明';
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
    update(world) {
        const prevActivity = this.activity;
        this._decideActivity(world.clock.hour);
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation');
        // Decay moodModifier toward 0
        if (this.moodModifier > 0) this.moodModifier = Math.max(0, this.moodModifier - 0.5);
        else if (this.moodModifier < 0) this.moodModifier = Math.min(0, this.moodModifier + 0.5);
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution) + this.moodModifier));
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
            case 'night_stroll': return 3 + randInt(0, 3); // strolling moves more
            case 'wandering': return 5 + randInt(0, 3);
            default: return 4;
        }
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
        const isNight = hour >= 21 || hour < 5;
        const isLateNight = hour >= 23 || hour < 4;
        const sleepStart = isNightOwl ? 2 : (isEarlyBird ? 20 : 22);
        const sleepEnd = isNightOwl ? 9 : (isEarlyBird ? 5 : 6);

        // Critical needs always override
        if (this.needs.hunger < 15) { this.activity='eating'; return; }
        if (this.needs.rest < 10) { this.activity='sleeping'; return; }

        // Sleep schedule
        const inSleepWindow = sleepStart > sleepEnd
            ? (hour >= sleepStart || hour < sleepEnd)
            : (hour >= sleepStart && hour < sleepEnd);
        if (inSleepWindow && this.needs.rest < 90) { this.activity='sleeping'; return; }

        // Night owl special behaviors when others sleep
        if (isNight && isNightOwl && this.needs.rest >= 30) {
            return this._decideNightOwlActivity(hour);
        }

        // Regular people awake at night (can't sleep, rest is high)
        if (isNight && !inSleepWindow && this.needs.rest >= 80) {
            return this._decideNightActivity(hour);
        }

        // Daytime: work hours
        if (this.job) {
            const [ws,we] = this.job.workHours;
            if (ws <= hour && hour < we) {
                if (this.needs.hunger < 30 && Math.random() < 0.3) { this.activity='eating'; return; }
                this.activity='working'; return;
            }
        }
        // Evening / free time
        const urgent = this.needs.mostUrgent;
        if (urgent==='hunger') { this.activity='eating'; return; }
        if (urgent==='social') { this.activity='socializing'; return; }
        if (urgent==='recreation') { this.activity='recreation'; return; }
        const choices = ['socializing','wandering','recreation'];
        const weights = [3,2,2];
        if (this.personality.socialModifier > 0) weights[0] += 2;
        this.activity = weightedChoice(choices, weights);
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

        if (this.activity==='sleeping') this.targetLocation = this.homeLocation;
        else if (this.activity==='eating') {
            // During work hours, eat near workplace or at tavern; at night, eat at home or tavern
            if (isWorkHours && workplace) this.targetLocation = pickRandom([workplace, 'tavern', 'tavern']);
            else if (isNight) this.targetLocation = pickRandom(['tavern', 'tavern', 'home']);
            else this.targetLocation = 'tavern';
        }
        else if (this.activity==='working' && this.job) this.targetLocation = this.job.workplace;
        else if (this.activity==='socializing') {
            if (isWorkHours && workplace) {
                // During work hours, socialize at workplace or very nearby (break room chat)
                this.targetLocation = pickRandom([workplace, workplace, 'tavern', 'town_square']);
            } else if (isNight) this.targetLocation = pickRandom(['tavern','tavern','town_square','park']);
            else {
                // After work: prefer home area, tavern, town square
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
        else if (this.activity==='night_mischief') this.targetLocation = pickRandom(['town_square','general_store','tavern']);
        else if (this.activity==='wandering') {
            // During work hours, wander near workplace; otherwise near home
            if (isWorkHours && workplace) this.targetLocation = pickRandom([workplace, 'town_square', 'well']);
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
            const desc = `${this.name}約了${target.name}一起去${spot.replace(/_/g,' ')}`;
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
                const rel = this.relationships.getOrCreate(companion.agentId, companion.name);
                rel.modifyAffinity(randInt(2, 5));
                rel.modifyRomantic(randInt(0, 3));
                rel.addSharedMemory(`一起在${this.currentLocation.replace(/_/g,' ')}看星星`);
                const otherRel = companion.relationships.getOrCreate(this.agentId, this.name);
                otherRel.modifyAffinity(randInt(2, 5));
                otherRel.modifyRomantic(randInt(0, 3));
                otherRel.addSharedMemory(`一起在${this.currentLocation.replace(/_/g,' ')}看星星`);
                world.logMessage('social', `${this.name}和${companion.name}一起看星星，感情升溫了。`, this.name, companion.name);
                this.memory.add(world.tickCount, world.clock.timeStr, 'social', `和${companion.name}一起看星星，很浪漫。`, 7, [companion.name]);
                companion.memory.add(world.tickCount, world.clock.timeStr, 'social', `和${this.name}一起看星星，很浪漫。`, 7, [this.name]);
            }
        }
        // Rare special discovery while stargazing
        if (Math.random() < 0.02) {
            const discoveries = [
                { text: '看到了一顆流星劃過天際！', mood: 10, topic: '流星' },
                { text: '發現了一個從未見過的星座圖案。', mood: 5, topic: '神秘星座' },
                { text: '看到了罕見的月暈現象！', mood: 8, topic: '月暈奇觀' },
                { text: '在星光下發現了一株發光的植物！', mood: 12, topic: '夜光植物' },
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
            { text: '偷偷在鎮公所牆上塗鴉', target: 'town_hall', mood_self: 5, mood_others: -2, severity: 'minor' },
            { text: '把別人晾的衣服藏起來', target: null, mood_self: 3, mood_others: -3, severity: 'minor' },
            { text: '偷吃了酒館儲藏室的食物', target: 'tavern', mood_self: 8, mood_others: -2, severity: 'moderate' },
            { text: '在水井裡放了無害的染料', target: 'well', mood_self: 5, mood_others: -5, severity: 'moderate' },
            { text: '偷偷移動了路標的方向', target: null, mood_self: 3, mood_others: -2, severity: 'minor' },
            { text: '在廣場放了一堆假蜘蛛', target: 'town_square', mood_self: 8, mood_others: -4, severity: 'minor' },
        ];
        const mischief = pickRandom(mischiefTypes);
        this.moodModifier = (this.moodModifier || 0) + mischief.mood_self;
        world.logMessage('mischief', `${this.name}趁著夜色${mischief.text}！`, this.name);
        this.memory.add(world.tickCount, world.clock.timeStr, 'mischief', `我趁夜裡${mischief.text}`, 6, []);
        this.currentThought = '嘿嘿...成功了。';
        world.events.conversationTopics.push(`有人在夜裡${mischief.text}`);
        // Chance to get caught by guards or night owls
        const awakeAgents = Object.values(world.agents).filter(a => a.agentId !== this.agentId && a.activity !== 'sleeping' && !a.isPlayer);
        if (awakeAgents.length && Math.random() < 0.3) {
            const witness = pickRandom(awakeAgents);
            const rel = witness.relationships.getOrCreate(this.agentId, this.name);
            rel.modifyAffinity(-5);
            world.logMessage('mischief', `${witness.name}撞見了${this.name}的惡作劇！`, witness.name, this.name);
            witness.memory.add(world.tickCount, world.clock.timeStr, 'witness', `撞見${this.name}在${mischief.text}`, 7, [this.name]);
            this.moodModifier = (this.moodModifier || 0) - 5;
            this.currentThought = `糟糕，被${witness.name}看到了...`;
        }
    }
    _generateThought(world) {
        const thoughts = [];
        const hour = world.clock.hour;
        const isNight = hour >= 21 || hour < 5;
        if (this.mood > 60) { thoughts.push('邊境鎮的生活還不錯。', '今天感覺很好！'); }
        else if (this.mood < 20) { thoughts.push('事情可以更好的...', '我感覺不太好。'); }
        if (this.needs.hunger < 30) thoughts.push('肚子好餓...');
        if (this.needs.rest < 30) thoughts.push('好想睡覺...');
        if (this.needs.social < 30) thoughts.push('應該找人聊聊天...');
        // Night-specific thoughts
        if (this.activity === 'stargazing') {
            thoughts.push('今晚的星空真美...', '那顆星星特別亮。', '仰望星空讓人感覺渺小...', '流星！快許願！');
            if (world.clock.season === '冬季') thoughts.push('冬天的星空格外清晰。');
        }
        if (this.activity === 'night_stroll') {
            thoughts.push('夜裡的鎮上好安靜...', '月光下散步真舒服。', '夜風吹來很涼爽。');
            if (this.mood < 30) thoughts.push('睡不著...出來走走吧。', '夜裡比較容易想事情...');
        }
        if (this.activity === 'night_mischief') {
            thoughts.push('嘿嘿，趁大家都睡了...', '沒人看到的話...', '夜裡做點小惡作劇。');
        }
        if (isNight && this.personality.traits.includes('night_owl')) {
            thoughts.push('夜晚才是我的主場。', '安靜的夜晚最適合思考。');
        }
        if (isNight && !this.personality.traits.includes('night_owl') && this.activity !== 'sleeping') {
            thoughts.push('這麼晚了還沒睡...', '明天會很累吧。');
        }
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
            id:this.agentId, name:this.name, age:this.age, gender:this.gender, gender_label:this.genderLabel,
            job: this.job?.toDict() || null, personality: this.personality.toDict(),
            mood:this.mood, moodModifier:this.moodModifier, mood_description:this.moodDescription, mood_label:this.moodLabel,
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
        super('player', name, age, new Personality(['creative','kind'], '最近抵達邊境鎮的神秘旅人。', ['冒險','友情']), null, 'tavern');
        this.isPlayer = true; this.chatHistory = [];
    }
    update(world) {
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation');
        if (this.moodModifier > 0) this.moodModifier = Math.max(0, this.moodModifier - 0.5);
        else if (this.moodModifier < 0) this.moodModifier = Math.min(0, this.moodModifier + 0.5);
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution) + (this.moodModifier || 0)));
    }
    moveTo(locationId, world) {
        if (world.townMap && !world.townMap.locations[locationId]) return false;
        this.currentLocation = locationId; this.activity = 'wandering';
        world.logMessage('player_move', `你移動到了${locationId.replace(/_/g,' ')}`, this.name);
        return true;
    }
    toDict() { const d = super.toDict(); d.is_player = true; d.chat_history = this.chatHistory.slice(-10000); return d; }
}

// --- Gossip Network ---
class GossipNetwork {
    constructor() { this.activeGossip = []; }
    createGossip(source, about, world) {
        const rel = source.relationships.getOrCreate(about.agentId, about.name);
        const templates = [];
        if (rel.romanticInterest > 40) templates.push(`你不覺得${about.name}挺有魅力的嗎？`);
        if (rel.affinity < -10) templates.push(`說真的，${about.name}最近行為很奇怪。`);
        if (about.mood < -20) templates.push(`你有注意到${about.name}最近看起來很低落嗎？`);
        if (about.mood > 50) templates.push(`${about.name}最近心情超好的！`);
        const ri = about.relationships.getRomanticInterests();
        if (ri.length) templates.push(`聽說${about.name}好像對${pickRandom(ri).targetName}有意思！`);
        const partner = about.relationships.getPartner();
        if (partner) {
            if (partner.status === 'dating') templates.push(`${about.name}和${partner.targetName}在交往呢，你知道嗎？`);
            if (partner.status === 'married') templates.push(`${about.name}和${partner.targetName}的婚姻生活不知道怎麼樣？`);
            if (partner.isCheating) templates.push(`我好像看到${about.name}背著${partner.targetName}跟別人在一起⋯⋯`);
        }
        const aboutPartner = about.relationships.getPartner();
        const cheatingRels = Object.values(about.relationships.relationships).filter(r => r.isCheating);
        if (cheatingRels.length) templates.push(`你聽說了嗎？${about.name}好像在劈腿⋯⋯`);
        if (!templates.length) templates.push(`你聽說${about.name}昨天在做什麼嗎？`);
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
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social',
            `${speaker.name}告訴我：「${gossip.content}」`, 4, [speaker.name, gossip.about]);
        world.logMessage('gossip', `${speaker.name}向${listener.name}八卦了${gossip.about}的事`, speaker.name, listener.name);
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
    }

    _buildCharacterProfile(agent) {
        const traitLabels = agent.personality.traits.map(t => TRAIT_POOL[t]?.label || t);
        const partner = agent.relationships.getPartner();
        let statusStr = '單身';
        if (partner) {
            if (partner.status === 'married') statusStr = `已與${partner.targetName}結婚`;
            else if (partner.status === 'dating') statusStr = `正在與${partner.targetName}交往`;
        }
        const needsStr = [];
        if (agent.needs.hunger < 30) needsStr.push('肚子很餓');
        if (agent.needs.rest < 30) needsStr.push('很疲倦');
        if (agent.needs.social < 30) needsStr.push('渴望社交');
        if (agent.needs.recreation < 20) needsStr.push('需要娛樂');
        return {
            name: agent.name, age: agent.age,
            job: agent.job?.title || '無業',
            traits: traitLabels.join('、'),
            background: agent.personality.background || '普通居民',
            values: agent.personality.values.join('、'),
            mood: agent.moodLabel,
            status: statusStr,
            needs: needsStr.join('、') || '狀態良好',
            thought: agent.currentThought || '',
            bestSkill: agent.skills.bestSkill.category,
        };
    }

    _buildRelContext(rel, otherName) {
        let s = `與${otherName}的關係：${rel.type}（好感度${rel.affinity}`;
        if (rel.romanticInterest > 0) s += `，浪漫${rel.romanticInterest}`;
        s += `，互動${rel.interactionCount}次）`;
        if (rel.status) s += `【${rel.statusLabel}】`;
        if (rel.isCheating) s += '【秘密關係】';
        if (rel.sharedMemories.length) s += `\n共同回憶：${rel.sharedMemories.slice(-3).join('；')}`;
        return s;
    }

    _buildEconomicContext(world) {
        const parts = [];
        // Prosperity
        if (world.prosperity) {
            parts.push(`繁榮度：${world.prosperity.prosperity}（${world.prosperity.level}）`);
        }
        // Town level & industries
        if (world.industry) {
            parts.push(`城鎮等級：${world.industry.townLevelName || '荒村'}`);
            const indNames = Object.keys(world.industry.industries).map(k => {
                const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[k] : null;
                const ind = world.industry.industries[k];
                return def ? `${def.icon}${def.name}Lv${ind.level}` : k;
            });
            if (indNames.length) parts.push(`產業：${indNames.join('、')}`);
        }
        // Farm highlights
        if (world.farm && world.farm.plots.length > 0) {
            const growing = world.farm.plots.filter(p => p.state === 'growing').length;
            const ready = world.farm.plots.filter(p => p.state === 'ready').length;
            if (growing || ready) parts.push(`農場：${growing}塊生長中${ready ? '、'+ready+'塊可收穫' : ''}`);
            const lastHarvest = world.farm.harvestLog.slice(-1)[0];
            if (lastHarvest) parts.push(`最近收穫：${lastHarvest.cropName}×${lastHarvest.amount}`);
        }
        // Factory highlights
        if (world.processing) {
            const active = Object.entries(world.processing.builtFactories)
                .filter(([, f]) => f.status === 'active')
                .map(([k]) => { const d = typeof FACTORIES !== 'undefined' ? FACTORIES[k] : null; return d ? `${d.icon}${d.name}` : k; });
            if (active.length) parts.push(`工廠：${active.join('、')}`);
        }
        return parts.length ? parts.join('。') : '';
    }

    _buildQuestContext(world, npc, relToPlayer) {
        if (!world.questSystem) return '';
        const parts = [];
        // Active quest context
        const questCtx = world.questSystem.getActiveQuestContext();
        if (questCtx) parts.push(questCtx);
        // Crisis context
        const crisisCtx = world.questSystem.getCrisisContext();
        if (crisisCtx) parts.push(`【危機】${crisisCtx}`);
        // NPC-specific quest hints (only if affinity is high enough)
        const affinity = relToPlayer?.affinity || 0;
        const hints = world.questSystem.getQuestHintsForNPC(npc.agentId, affinity);
        if (hints.length > 0) {
            const hintText = hints.map(h => `關於「${h.questTitle}」，你可以自然地提到：${h.hint}`).join('\n');
            parts.push(`【你可以給的提示（只在話題相關時自然帶出，不要硬塞）】\n${hintText}`);
        }
        // NPC personal quest hints (個人故事線)
        if (world.npcQuests) {
            const personalHints = world.npcQuests.getPersonalQuestHints(npc.agentId, affinity);
            if (personalHints.length > 0) {
                const personalText = personalHints.map(h => {
                    if (h.type === 'active') return `你的心願：${h.hint}`;
                    if (h.type === 'tease') return `（如果話題相關）${h.hint}`;
                    return `你聽說：${h.hint}`;
                }).join('\n');
                parts.push(`【個人心願】\n${personalText}`);
            }
        }
        if (parts.length === 0) return '';
        return '\n【任務相關】\n' + parts.join('\n') + '\n';
    }

    async generateConversation(agentA, agentB, world) {
        const relA = agentA.relationships.getOrCreate(agentB.agentId, agentB.name);
        const relB = agentB.relationships.getOrCreate(agentA.agentId, agentA.name);

        if (this.llm) {
            // Throttle NPC LLM calls to avoid burning through API quota
            const ticksSinceLast = world.tickCount - this._lastNpcLlmTick;
            if (ticksSinceLast >= this._npcLlmCooldownTicks && this.llm._canMakeRequest(false)) {
                try {
                    this._lastNpcLlmTick = world.tickCount;
                    return await this._llmConversation(agentA, agentB, world, relA, relB);
                } catch(e) { console.error('LLM conversation failed:', e); }
            } else {
                console.log('[RimTown] NPC conversation throttled, using fallback (ticks since last:', ticksSinceLast, ')');
            }
        }
        return this._fallbackConversation(agentA, agentB, world, relA, relB);
    }

    async _llmConversation(agentA, agentB, world, relA, relB) {
        const gossip = world.events.getGossipTopics ? world.events.getGossipTopics() : [];
        const gossipStr = gossip.slice(-3).join('、') || '沒有特別的事';
        const memA = agentA.memory.getAboutAgent(agentB.name, 5);
        const memB = agentB.memory.getAboutAgent(agentA.name, 5);
        const pA = this._buildCharacterProfile(agentA);
        const pB = this._buildCharacterProfile(agentB);

        // Pick a random conversation scenario to add variety
        const scenarios = [
            '兩人剛好在路上遇到，隨意閒聊起來',
            '一個人正在忙，另一個人過來搭話',
            '兩人一起吃東西或喝茶時的聊天',
            '一個人看到另一個人心情不好，主動關心',
            '分享一個有趣的發現或八卦',
            '討論最近發生的事情或計劃',
            '回憶過去的某件事',
            '為了一件小事開玩笑或互相吐槽',
        ];
        const scenario = pickRandom(scenarios);

        const prompt = `你是一位才華橫溢的小說家，正在為奇幻小鎮「邊境鎮」寫角色對話劇本。
這是兩位小鎮居民偶然碰面的場景。請寫出生動、自然、有溫度的對話——就像真實的鄰居閒聊一樣。

【重要規則】
- 必須使用繁體中文（台灣用語），不可使用簡體中文
- 絕對不要讓角色報告自己的狀態（不要說「我好餓」「我好累」「我心情不好」這種話）
- 對話要像真人——談論具體的事、講故事、開玩笑、分享感受、抱怨、八卦
- 每個人的說話風格要明顯不同（用詞、語氣、句子長短都要有差異）
- 加入生活細節：提到具體的食物、地點、天氣感受、小鎮裡的人和事
- 可以有幽默、諷刺、調侃、撒嬌、關心、爭吵等豐富的情感表達

場景：${scenario}
時間：${world.clock.timeStr}
地點：${agentA.currentLocation.replace(/_/g,' ')}

【${pA.name}】${pA.age}歲${pA.job}，性格${pA.traits}，${pA.status}
${pA.thought ? `最近在想：${pA.thought}` : ''}${pA.needs !== '狀態良好' ? `（有點${pA.needs}）` : ''}
${this._buildRelContext(relA, agentB.name)}
${memA.length ? `記得：${memA.slice(-3).map(m=>m.content).join('；')}` : ''}

【${pB.name}】${pB.age}歲${pB.job}，性格${pB.traits}，${pB.status}
${pB.thought ? `最近在想：${pB.thought}` : ''}${pB.needs !== '狀態良好' ? `（有點${pB.needs}）` : ''}
${this._buildRelContext(relB, agentA.name)}
${memB.length ? `記得：${memB.slice(-3).map(m=>m.content).join('；')}` : ''}

小鎮近況：${gossipStr}
${this._buildEconomicContext(world)}

請寫4-6句自然對話。範例風格：
- 好友："欸你昨天有看到老王在河邊釣到一條超大的魚嗎？笑死我了他差點掉下去！"
- 害羞的人："嗯...那個...你今天做的麵包聞起來好香..."
- 毒舌的人："又在偷懶？你那個田再不管，雜草都要比你高了。"
- 情侶："你怎麼又沒穿外套？天都涼了...過來，把這個披上。"

格式：每行「名字: 對話內容」
最後一行：EFFECTS: {"affinity_change_a": 數字(-3到5), "affinity_change_b": 數字(-3到5), "romantic_change_a": 數字(0到5), "romantic_change_b": 數字(0到5), "summary": "用一句生動的話總結發生了什麼"}
提示：romantic_change 代表心動程度的變化。只有明確的曖昧、調情、深層情感連結才給 1-2。普通友好聊天應該給 0。大部分對話 romantic_change 應該是 0。`;

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
        const affA = effects.affinity_change_a ?? randInt(-2,5);
        const affB = effects.affinity_change_b ?? randInt(-2,5);
        // Default romantic growth: only grow on strongly positive conversations
        const romA = effects.romantic_change_a ?? (affA >= 3 ? randInt(0,1) : 0);
        const romB = effects.romantic_change_b ?? (affB >= 3 ? randInt(0,1) : 0);
        const summary = effects.summary || `${agentA.name}和${agentB.name}聊了天。`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentB.name}交談：${summary}`, Math.min(8,4+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentA.name}交談：${summary}`, Math.min(8,4+Math.abs(affB)), [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        // Collect notable conversations for daily news
        if (world.dailyNews && (Math.abs(affA) >= 4 || Math.abs(affB) >= 4 || romA >= 2 || romB >= 2)) {
            world.dailyNews.collectEvent('social', summary, 4, [agentA.name, agentB.name]);
        }
        // Store NPC conversation for sidebar viewing
        if (dialogue.length) {
            this.npcConversationLog.push({ time:world.clock.timeStr, location:agentA.currentLocation, dialogue, summary, agentA:agentA.name, agentB:agentB.name, agentAId:agentA.agentId, agentBId:agentB.agentId });
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
        const affA = dialogue._affA ?? randInt(-1,4);
        const affB = dialogue._affB ?? randInt(-1,4);
        const romA = dialogue._romA ?? 0;
        const romB = dialogue._romB ?? 0;
        const summary = dialogue._summary || `${agentA.name}和${agentB.name}聊了天。`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentB.name}交談：${summary}`, Math.min(6,3+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${agentA.name}交談：${summary}`, Math.min(6,3+Math.abs(affB)), [agentA.name]);
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
        const jobA = agentA.job?.title || '無業';
        const jobB = agentB.job?.title || '無業';
        const loc = agentA.currentLocation.replace(/_/g,' ');
        const timeOfDay = world.clock.timeOfDay;
        const season = world.clock.season;
        const lines = [];
        let affA = 0, affB = 0, romA = 0, romB = 0;
        let summary = '';

        // --- Rich detail pools for vivid dialogue ---
        const foods = { '春季':['野菜煎餅','花瓣蜜茶','春筍燉肉','桂花糕','薺菜餛飩'], '夏季':['冰鎮酸梅湯','西瓜','涼拌黃瓜','綠豆湯','荷葉飯'], '秋季':['烤地瓜','桂花釀','栗子燒雞','蘋果派','南瓜濃湯'], '冬季':['薑母茶','熱騰騰的羊肉鍋','烤紅薯','熱奶酒','麻辣火鍋'] };
        const scenery = { '春季':['櫻花飄落的小徑','河邊盛開的野花','清晨帶著露水的草地'], '夏季':['星空下的河流','螢火蟲飛舞的夜晚','午後蟬鳴的樹蔭下'], '秋季':['金黃落葉鋪滿的石板路','楓紅染遍山頭的景色','豐收後堆滿穀物的倉庫'], '冬季':['白雪覆蓋的屋頂','壁爐旁搖曳的火光','冬夜裡遠處傳來的狼嚎'] };
        const gifts = ['一束剛採的野花','自己做的手工餅乾','一瓶私藏的好酒','昨天釣到的魚做成的魚乾','一條手織的圍巾','用漂亮石頭做的小飾品'];
        const rumors = [`聽說${pickRandom(['雜貨店','酒館','鎮公所'])}昨晚有人看到奇怪的光`,`據說最近森林裡出現了${pickRandom(['罕見的白鹿','神秘的遺跡','一群外來的旅人'])}`,`有人說${pickRandom(['河邊','山洞','舊礦坑'])}藏著寶藏`,`聽說隔壁的商隊帶來了${pickRandom(['稀有香料','遠方的書信','神秘的藥草'])}`];
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
                    lines.push({speaker:agentA.name, text:`你今天做的${food}真的太好吃了，我到現在嘴裡還有那個味道！`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`真...真的嗎？其實我怕做得不夠好，特地多加了點${pickRandom(['蜂蜜','香料','秘方'])}...`:`那當然！這可是我花了一整個下午的心血，為了某個人。`});
                    lines.push({speaker:agentA.name, text:`下次讓我也給你做一頓，雖然我的手藝可能會讓你後悔...`});
                    lines.push({speaker:agentB.name, text:tB.includes('romantic')?`你做什麼我都喜歡，因為是你做的。`:`哈哈，那我先準備好腸胃藥！`});
                    lines.push({speaker:agentA.name, text:`你！過分！...不過我真的很幸福。`});
                    affA = randInt(3,6); affB = randInt(3,6); romA = randInt(2,4); romB = randInt(2,4);
                    summary = `${loc}裡，${agentA.name}讚美了${agentB.name}親手做的${food}，兩人甜蜜地打鬧著，笑聲讓路過的人都忍不住微笑。`;
                },
                () => {
                    const jealousA = tA.includes('jealous');
                    const jealousB = tB.includes('jealous');
                    if (jealousA || jealousB) {
                        const j = jealousA ? agentA : agentB;
                        const o = jealousA ? agentB : agentA;
                        lines.push({speaker:j.name, text:`我剛剛看到你跟那個人聊了好久，你們在說什麼悄悄話？`});
                        lines.push({speaker:o.name, text:`就是在討論${pickRandom(['工作的事','鎮上活動','建材價格'])}啊，你又胡思亂想了。`});
                        lines.push({speaker:j.name, text:`...你笑得那麼開心，我在旁邊看著心裡很不是滋味。`});
                        lines.push({speaker:o.name, text:o.personality.traits.includes('kind')?`傻瓜，我心裡只有你一個人啊。來，把手給我。`:`你能不能信任我一點？每次都這樣我也很累的。`});
                        lines.push({speaker:j.name, text:`...對不起。我就是太害怕失去你了。`});
                        affA = randInt(-1,2); affB = randInt(-1,2); romA = randInt(0,1); romB = randInt(0,1);
                        summary = `${j.name}因為看到${o.name}和別人說笑而醋意大發，兩人經歷了一場小風波，最終在${loc}和好。`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${season}的夜晚真美...你看那邊，${scene}。要不要一起去走走？`});
                        lines.push({speaker:agentB.name, text:tB.includes('shy')?`好...牽著我的手好嗎？`:`走啊！我還想帶你去看一個秘密地點，保證你沒去過！`});
                        lines.push({speaker:agentA.name, text:`和你在一起的時候，覺得這個小鎮是全世界最美的地方。`});
                        lines.push({speaker:agentB.name, text:`笨蛋...突然說這種話，我都不知道該怎麼回了。`});
                        affA = randInt(3,5); affB = randInt(3,5); romA = randInt(2,4); romB = randInt(2,4);
                        summary = `${season}的${loc}裡，${agentA.name}和${agentB.name}手牽手散步，分享著${scene}的浪漫景色，氣氛溫馨而甜蜜。`;
                    }
                },
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`${agentB.name}，閉上眼睛，我有東西要給你！`});
                    lines.push({speaker:agentB.name, text:`又在搞什麼鬼？...好啦好啦，閉上了。`});
                    lines.push({speaker:agentA.name, text:`好了，睜開！噹噹——${gift}！看到的時候就想到你了。`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?`......謝謝。我會好好珍藏的。`:`天啊！這也太可愛了吧！你怎麼知道我一直想要這個？！`});
                    affA = randInt(3,6); affB = randInt(4,7); romA = randInt(2,3); romB = randInt(2,4);
                    summary = `${agentA.name}在${loc}送了${agentB.name}${gift}作為驚喜，${agentB.name}${tB.includes('stoic')?'雖然表面平靜但眼眶微紅':'感動得差點飛撲上去'}，兩人的感情更加深厚了。`;
                },
            ];
            pickRandom(coupleTopics)();
        } else if (isRival) {
            const hostileTemplates = [
                () => {
                    lines.push({speaker:agentA.name, text:`哦？${agentB.name}也在${loc}啊，我還以為你早就被鎮上的人趕走了呢。`});
                    lines.push({speaker:agentB.name, text:tB.includes('abrasive')?`你少在那邊冷嘲熱諷，有本事當面說清楚！`:`......你講話可以再難聽一點，我都習慣了。`});
                    lines.push({speaker:agentA.name, text:`別裝可憐了，你做過什麼你自己心裡清楚。上次${pickRandom(['倉庫的事','選舉那件事','你在背後說的那些話'])}，全鎮都知道。`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?`信不信由你。我問心無愧。`:`你！——好，你記住今天說的話。遲早你會後悔的。`});
                    affA = randInt(-5,-2); affB = randInt(-5,-2);
                    summary = `${agentA.name}和${agentB.name}在${loc}正面交鋒，針鋒相對的言語讓空氣彷彿凝結，周圍的居民紛紛側目。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`聽說你最近又在到處說我${pickRandom(['壞話','是非','不是'])}？有種當面說啊。`});
                    lines.push({speaker:agentB.name, text:`我說的都是事實。你那個${jobA}做成什麼樣子，大家有目共睹。`});
                    lines.push({speaker:agentA.name, text:tA.includes('neurotic')?`你——！我在這個鎮上付出了多少你知道嗎！？`:`笑話。等你做到我一半再來批評吧。`});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?`好了，我不想在這種地方吵。但你最好反省一下自己。`:`哼，走著瞧。`});
                    lines.push({speaker:agentA.name, text:`你才該好好反省！`});
                    affA = randInt(-6,-3); affB = randInt(-6,-3);
                    summary = `${agentA.name}當面質問${agentB.name}散播流言蜚語的事，兩人在${loc}爆發了激烈口角，怒氣沖天，場面一度失控。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}，我們需要談談。不是為了吵架，是為了把話說開。`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`......好吧。我也不想一直這樣下去。`:`你覺得有什麼好談的？`});
                    lines.push({speaker:agentA.name, text:`我知道我們之間有很多誤會，但至少在鎮上要做到基本的尊重，你說呢？`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?`......我會考慮的。`:`尊重是互相的。你先做到再來要求我。`});
                    affA = randInt(-2,1); affB = randInt(-2,1);
                    summary = `${agentA.name}在${loc}試圖與${agentB.name}和解，但雙方仍帶著心結，氣氛雖有緩和卻依然充滿張力。`;
                },
            ];
            pickRandom(hostileTemplates)();
        } else if (isCrush) {
            const crushA = relA.romanticInterest > 50;
            const crushB = relB.romanticInterest > 50;
            const crushTopics = [
                () => {
                    lines.push({speaker:agentA.name, text: crushA ? `${agentB.name}！你、你頭上有片落葉——我幫你拿掉！` : greetA});
                    lines.push({speaker:agentB.name, text: crushB ? `啊，謝...謝謝...（心跳好快）你的手好溫暖。` : `哦，謝謝你啊。`});
                    lines.push({speaker:agentA.name, text: crushA ? `抱歉！我是不是太靠近了...不，我只是...你今天${pickRandom(['聞起來好香','看起來好好看','笑容好好看'])}。` : `不客氣！${season}嘛，到處都是落葉。`});
                    if (crushB) lines.push({speaker:agentB.name, text:tB.includes('shy')?`你...你也是...（聲音越來越小）`:`哈哈，被你這麼一說我都不好意思了！那改天一起去喝杯${food}好嗎？`});
                    romA = crushA ? randInt(3,6) : randInt(0,2); romB = crushB ? randInt(3,6) : randInt(0,2);
                    affA = randInt(2,5); affB = randInt(2,5);
                    const who = (crushA && crushB) ? '兩人' : (crushA ? agentA.name : agentB.name);
                    summary = `${agentA.name}幫${agentB.name}拿掉頭上的落葉時兩人靠得很近，${who}的臉頰微微泛紅，${loc}的空氣中瀰漫著微妙的心動氣息。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}，你知道嗎？我昨晚看到了${scene}，第一個想到的人就是你。`});
                    lines.push({speaker:agentB.name, text: crushB ? `真的嗎...其實我也常常想著——啊不，我是說，那一定很美！` : `哦？聽起來很美呢。`});
                    lines.push({speaker:agentA.name, text:`下次一定要帶你去看。跟你在一起的時候，什麼風景都會更美。`});
                    lines.push({speaker:agentB.name, text: crushB ? `...好。一定要說到做到哦。` : tB.includes('kind')?`你真會說話！好啊，到時候再說。`:`嗯...好啊。`});
                    romA = crushA ? randInt(2,5) : randInt(1,2); romB = crushB ? randInt(2,5) : randInt(1,2);
                    affA = randInt(2,5); affB = randInt(2,4);
                    summary = `${agentA.name}在${loc}和${agentB.name}分享了${scene}的美景，話語間暗藏著告白的勇氣，${agentB.name}${crushB?'也悄悄地紅了耳朵':'禮貌地微笑回應'}。`;
                },
            ];
            pickRandom(crushTopics)();
        } else if (isCloseFriend) {
            const friendTopics = [
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${agentB.name}！你一定不相信我剛聽到什麼——${rumor}！`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?`什麼！？快跟我說清楚！細節呢！？`:`真的假的？你確定不是誰在胡說八道？`});
                    lines.push({speaker:agentA.name, text:`千真萬確！好幾個人都這麼說。要不要找個時間一起去${pickRandom(['看看','調查','確認'])}？`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`嗯...小心為上，但如果是真的就太刺激了！`:`走啊！怕什麼！帶上${food}我們來場冒險！`});
                    affA = randInt(3,5); affB = randInt(3,5);
                    summary = `${agentA.name}興沖沖地在${loc}和摯友${agentB.name}分享了一個驚天八卦，兩人越聊越起勁，甚至約好了一起去探個究竟，氣氛既神秘又興奮。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`唉...${agentB.name}，你能不能幫我出出主意？最近${pickRandom([`${jobA}的工作壓力大到快喘不過氣`,`跟隔壁的鄰居鬧了點不愉快`,`一直在做同一個奇怪的夢`])}...`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`怎麼了？慢慢說，我聽著呢。先喝口${food}暖暖。`:`又怎麼了？你最近也太多煩惱了吧——不過說吧，反正你也憋不住。`});
                    lines.push({speaker:agentA.name, text:`你真的是全鎮最了解我的人...每次跟你聊完心裡就踏實多了。`});
                    lines.push({speaker:agentB.name, text:`別肉麻了！不過...有你當朋友我也很慶幸啦。來，我請你吃${pickRandom(['剛烤好的麵包','酒館的招牌菜','剛摘的水果'])}。`});
                    affA = randInt(3,6); affB = randInt(3,5);
                    summary = `${agentA.name}在${loc}向摯友${agentB.name}傾訴了最近的煩惱，${agentB.name}耐心傾聽並貼心地準備了${food}，兩人之間的友誼更加堅定了。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}，還記得我們剛來邊境鎮那天嗎？什麼都沒有，就兩個人站在空蕩蕩的廣場上。`});
                    lines.push({speaker:agentB.name, text:`記得啊！那時候你還摔了一跤，臉都栽進泥巴裡哈哈哈哈！`});
                    lines.push({speaker:agentA.name, text:`你就記這個！？那你還不是迷路了三次才找到酒館！`});
                    lines.push({speaker:agentB.name, text:`好了好了，我們扯平。不過認真的...能跟你一起在這裡打拼，我覺得這輩子值了。`});
                    lines.push({speaker:agentA.name, text:`...你今天不準再說催淚的話了，我眼眶已經紅了。`});
                    affA = randInt(4,7); affB = randInt(4,7);
                    summary = `${agentA.name}和${agentB.name}在${loc}回憶起初來邊境鎮的趣事，笑淚交織之間，深厚的友情讓旁人都為之動容。`;
                },
            ];
            pickRandom(friendTopics)();
        } else if (isStranger) {
            const strangerTopics = [
                () => {
                    lines.push({speaker:agentA.name, text:tA.includes('charismatic')?`嘿！你是新面孔吧？我是${agentA.name}，在這邊做${jobA}的。歡迎來到邊境鎮！`:`你好...我好像沒見過你？`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`嗯...我是${agentB.name}...你好。這裡的${food}看起來好好吃...`:`哈囉！我叫${agentB.name}！剛到這邊不久，請多指教！這裡比我想像中熱鬧多了。`});
                    lines.push({speaker:agentA.name, text:`${loc}是鎮上最${pickRandom(['熱鬧','有意思','舒服'])}的地方！對了，如果你想吃好料的，推薦你去試試酒館的${food}，絕對不會後悔。`});
                    lines.push({speaker:agentB.name, text:`真的嗎！那我一定要去試試。謝謝你，${agentA.name}！`});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}在${loc}熱情地招呼了新來的${agentB.name}，推薦了鎮上的美食${food}，給${agentB.name}留下了溫暖的第一印象。`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}對吧？我聽說你是做${jobB}的——正好，我一直想認識做這行的人！`});
                    lines.push({speaker:agentB.name, text:`你認識我？啊，果然小鎮消息傳得快...對，我是${jobB}。你是${agentA.name}？`});
                    lines.push({speaker:agentA.name, text:`哈哈，邊境鎮就是這樣，新人來的消息半天就全鎮都知道了。改天聊聊${pickRandom(['工作心得','鎮上的事','生活經驗'])}吧？`});
                    lines.push({speaker:agentB.name, text:`好啊！期待跟你多認識。`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}和${agentB.name}在${loc}初次交談，兩人相談甚歡，約好了改天再深入聊聊，邊境鎮又多了一段新的緣分。`;
                },
            ];
            pickRandom(strangerTopics)();
        } else {
            // --- Normal acquaintance conversation — vivid and story-driven ---
            const normalTopics = [
                // Sharing discoveries
                () => {
                    const discovery = pickRandom([
                        `你知道嗎？我昨天在河邊發現了一種從沒見過的${pickRandom(['發光的石頭','藍色的蘑菇','奇怪的腳印'])}`,
                        `我昨晚在${pickRandom(['圖書館','禮拜堂','山丘上'])}看到了${pickRandom(['神秘的光','一隻從沒見過的鳥','天上有兩個月亮'])}`,
                        `今天早上我去${pickRandom(['井邊打水','田裡幹活','林子裡散步'])}的時候，聽到了${pickRandom(['很美的歌聲','奇怪的低語','遠方傳來的鐘聲'])}`,
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}！${discovery}！`});
                    lines.push({speaker:agentB.name, text:tB.includes('creative')?`什麼！？太神奇了！你帶我去看好不好！`:`真的假的？該不會是你看花眼了吧？`});
                    lines.push({speaker:agentA.name, text:`我騙你幹嘛！千真萬確，下次遇到我馬上叫你！`});
                    lines.push({speaker:agentB.name, text:tB.includes('pessimist')?`好吧好吧...不過要是什麼危險的東西你可要負責。`:`一言為定！記得帶上${food}，探險可不能餓肚子！`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}興奮地和${agentB.name}分享了一個神奇的發現，兩人在${loc}聊得眉飛色舞，約好下次一起去探索。`;
                },
                // Season + food + life detail
                () => {
                    lines.push({speaker:agentA.name, text:`${season}最棒的就是${food}了！我剛從酒館帶了一份，要不要嚐嚐？`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`哇！好香！你也太貼心了吧——等等，你該不會有什麼事要拜託我？`:`還行吧，不過我比較想吃${pickRandom(foods[season]||foods['春季'])}。`});
                    lines.push({speaker:agentA.name, text:`被你看穿了！其實是想問你${pickRandom(['鎮上最近有什麼新鮮事','知不知道哪裡可以買到好木材','有沒有認識會修屋頂的人'])}。`});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?`哈哈！先吃東西再說正事！來來來，坐下聊。`:`嗯...讓我想想，我好像聽說過一些消息。`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}帶了${food}到${loc}和${agentB.name}邊吃邊聊，${season}的暖意讓兩人的對話格外愜意。`;
                },
                // Work + dramatic story
                () => {
                    const workStory = pickRandom([
                        {a:`你不知道！今天${jobA}的時候差點出大事——${pickRandom(['一塊巨石突然滾下來','工具斷了差點傷到人','發現了一條密道'])}！`, sum:`分享了工作中驚險的一幕`},
                        {a:`告訴你一個祕密，${pickRandom(['倉庫裡藏了一批沒人知道的好東西','鎮公所的地下室好像有奇怪的聲音','雜貨店老闆其實以前是個冒險家'])}！`, sum:`悄悄透露了鎮上的一個祕密`},
                        {a:`我今天在${pickRandom(['工作的時候','路上','吃飯的時候'])}碰到一件超搞笑的事——${pickRandom(['有人把一桶水潑在鎮長身上','一隻雞追著守衛跑了三圈','有個旅人居然帶了一頭熊進酒館'])}！`, sum:`分享了一件讓人笑到肚子痛的趣事`},
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}！${workStory.a}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?`不會吧！？然後呢然後呢！？快說！`:`哈哈哈你認真的嗎！？這也太誇張了！`});
                    lines.push({speaker:agentA.name, text:`我發誓是真的！當場所有人都傻眼了！`});
                    lines.push({speaker:agentB.name, text:`這件事我要跟全鎮的人說！太精彩了！`});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}在${loc}向${agentB.name}${workStory.sum}，兩人笑得前仰後合，${loc}裡充滿了歡樂的氣氛。`;
                },
                // Gift giving
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`對了${agentB.name}，這個給你——${gift}，上次你幫了我大忙，一直想謝謝你。`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`欸...這也太...我只是舉手之勞啊，你不用這麼客氣的...`:`你也太有心了吧！我只是做了該做的事而已！不過...我超喜歡的，謝謝！`});
                    lines.push({speaker:agentA.name, text:`喜歡就好！以後有什麼需要幫忙的儘管開口。`});
                    lines.push({speaker:agentB.name, text:`一定！你也是！...今天真的心情變好了。`});
                    affA = randInt(3,5); affB = randInt(4,6);
                    summary = `${agentA.name}在${loc}送了${agentB.name}${gift}作為感謝，${agentB.name}感動之餘兩人的友誼又更進了一步，${season}的空氣裡充滿了溫暖。`;
                },
                // Rumors and gossip
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`嘿${agentB.name}，你有聽說嗎？${rumor}。`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?`真的！？我的天，這也太刺激了！你從哪裡聽來的？`:`嗯？聽起來不太靠譜...不過如果是真的就有意思了。`});
                    lines.push({speaker:agentA.name, text:`好幾個人都這麼說呢！而且昨天夜裡好像真的有人看到${pickRandom(['可疑的影子','奇怪的燈火','一群穿斗篷的人'])}。`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`嗯...希望不是什麼壞事。不過有你一起我就安心多了。`:`哼，我倒要看看到底是怎麼回事。明天一起去打聽！`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}和${agentB.name}在${loc}低聲討論著鎮上的神秘傳聞，越聊越覺得事情不簡單，兩人的表情既好奇又緊張。`;
                },
                // Mood-driven dramatic scene
                () => {
                    if (agentA.mood < 20) {
                        lines.push({speaker:agentB.name, text:`${agentA.name}...你怎麼一個人坐在${loc}發呆？你的眼眶是不是紅紅的...`});
                        lines.push({speaker:agentA.name, text:tA.includes('stoic')?`...我沒事。只是在想一些事情。`:`...最近什麼事都不順利，我有時候在想，我來邊境鎮到底對不對。`});
                        lines.push({speaker:agentB.name, text:tB.includes('kind')?`你聽我說——你是這個鎮上不可或缺的人。我們都需要你。來，先喝口${food}暖暖身子。`:`你少來了，沒有你誰來做${jobA}？鎮上離了你可不行。`});
                        lines.push({speaker:agentA.name, text:`......謝謝你，${agentB.name}。有你在真好。`});
                        affA = randInt(3,6); affB = randInt(2,4);
                        summary = `${agentB.name}在${loc}發現了獨自落寞的${agentA.name}，溫柔地遞上一杯${food}，用真摯的話語驅散了陰霾，${agentA.name}眼眶泛紅地笑了。`;
                    } else if (agentA.mood > 70) {
                        lines.push({speaker:agentA.name, text:`${agentB.name}！你猜怎麼著！今天是我這輩子最好的一天——${pickRandom(['工作順利到不可思議','發現了一個超棒的地方','有人跟我說了一句讓我開心到飛起來的話'])}！`});
                        lines.push({speaker:agentB.name, text:tB.includes('pessimist')?`你也太浮誇了...不過看你這麼開心我也忍不住笑了。`:`太好了！快跟我說！今天我請你喝${food}慶祝！`});
                        lines.push({speaker:agentA.name, text:`我現在覺得什麼困難都打不倒我！連${season}的天氣都特別配合！`});
                        lines.push({speaker:agentB.name, text:`哈哈哈，你也太誇張了！不過...你開心我也開心，畢竟你笑起來真的很有感染力。`});
                        affA = randInt(2,5); affB = randInt(2,5);
                        summary = `心情大好的${agentA.name}在${loc}拉著${agentB.name}分享喜悅，開懷大笑的聲音感染了整個${loc}，連路過的人都忍不住嘴角上揚。`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${agentB.name}，你有沒有想過...如果當初沒來邊境鎮，現在會在哪裡？`});
                        lines.push({speaker:agentB.name, text:tB.includes('creative')?`我有時候會想呢。也許在某個大城市裡迷失方向吧...但這裡有${scene}，有你們這些朋友，我不後悔。`:`想那麼多幹嘛？現在過得不錯就好了。走，去弄點${food}來吃。`});
                        lines.push({speaker:agentA.name, text:`說得也是。有時候覺得命運把我們送到這裡，一定有它的道理。`});
                        lines.push({speaker:agentB.name, text:`少在那邊感慨了！${food}可不等人，走走走！`});
                        affA = randInt(2,4); affB = randInt(2,4);
                        summary = `${agentA.name}和${agentB.name}在${loc}感慨起命運的安排，聊起了${scene}的美好，最後被${food}的香氣拉回了現實，氣氛輕鬆溫馨。`;
                    }
                },
            ];
            pickRandom(normalTopics)();

            if (Math.random() < 0.12) {
                this._addConflictEscalation(lines, agentA, agentB, world, tA, tB);
                affA = Math.min(affA, randInt(-4, -1));
                affB = Math.min(affB, randInt(-4, -1));
                summary += '但後來氣氛突然變得微妙，兩人不歡而散。';
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
        const t = agent.personality.traits;
        const name = other.name;
        if (rel.status === 'dating' || rel.status === 'married') return pickRandom([`親愛的${name}。`,`${name}~`,`嘿，${name}。`]);
        if (t.includes('charismatic')) return pickRandom([`嘿！${name}！`,`哈囉${name}，真高興見到你！`,`${name}！好久不見！`]);
        if (t.includes('shy')) return pickRandom([`啊...${name}...你好。`,`嗯...你好。`,`...嗨。`]);
        if (t.includes('abrasive')) return pickRandom([`喔，${name}啊。`,`怎麼又是你。`,`${name}。`]);
        if (t.includes('optimist')) return pickRandom([`${name}！今天也是美好的一天！`,`嗨${name}，你看起來很有精神！`]);
        if (t.includes('pessimist')) return pickRandom([`${name}...唉。`,`嗯...${name}。`]);
        return pickRandom([`嘿，${name}。`,`你好啊，${name}。`,`哈囉，${name}！`,`${name}，好久不見。`]);
    }

    _addConflictEscalation(lines, agentA, agentB, world, tA, tB) {
        const conflictTypes = [
            // Bad joke that offends
            () => {
                const jokes = [
                    `哈哈，你知道嗎，你做的${agentB.job?.title||'事'}讓我想到一個笑話——`,
                    `說真的，你那個表情也太好笑了吧？`,
                    `你是不是又${pickRandom(['偷懶','搞砸','遲到'])}了？我開玩笑的啦。`,
                ];
                lines.push({speaker:agentA.name, text:pickRandom(jokes)});
                lines.push({speaker:agentB.name, text:tB.includes('stoic')?'......這一點都不好笑。':tB.includes('neurotic')?'你這什麼意思！？':'呵，你覺得很幽默嗎？'});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?'抱歉抱歉，我不是那個意思...':'開不起玩笑啊？'});
            },
            // Value clash
            () => {
                const vA = agentA.personality.values[0] || '自由';
                const vB = agentB.personality.values[0] || '秩序';
                if (vA !== vB) {
                    lines.push({speaker:agentA.name, text:`我覺得${vA}才是最重要的，你不覺得嗎？`});
                    lines.push({speaker:agentB.name, text:`我倒覺得${vB}比較重要。你那種想法太天真了。`});
                    lines.push({speaker:agentA.name, text:tA.includes('stoic')?'看法不同而已。':'哼，你不懂。'});
                } else {
                    lines.push({speaker:agentA.name, text:`${agentB.name}，你最近做的那件事，我覺得不太好。`});
                    lines.push({speaker:agentB.name, text:'你管太多了吧？'});
                }
            },
            // Passive-aggressive remark
            () => {
                const remarks = [
                    `嗯...${agentB.name}你最近是不是胖了？`,
                    `有些人啊，就是不知道自己幾斤幾兩。`,
                    `哦對了，上次的事你還記得吧？算了，不提了。`,
                    `我不是在說你啦，不過有人最近做事真的很馬虎。`,
                ];
                lines.push({speaker:agentA.name, text:pickRandom(remarks)});
                lines.push({speaker:agentB.name, text:tB.includes('abrasive')?'你在暗示什麼？有話直說！':tB.includes('shy')?'......':tB.includes('neurotic')?'你是不是在說我！？':'...你今天怎麼了？'});
            },
            // Gossip about the other behind their back gets revealed
            () => {
                lines.push({speaker:agentB.name, text:`${agentA.name}，我聽說你跟別人說我${pickRandom(['壞話','是非','閒話'])}？`});
                lines.push({speaker:agentA.name, text:tA.includes('gossip')?'啊...那個...不是你想的那樣。':tA.includes('abrasive')?'我說的都是事實。':'什麼？我沒有啊！'});
                lines.push({speaker:agentB.name, text:tB.includes('kind')?'我希望以後別這樣了。':'我會記住的。'});
            },
            // Annoying behavior
            () => {
                const annoyances = [
                    {act:`一直不停地說話`, resp:'你能不能安靜一會兒...'},
                    {act:`吃東西的聲音超大`, resp:'拜託，能不能注意一下？'},
                    {act:`不請自來地給建議`, resp:'我沒有問你的意見。'},
                    {act:`打斷${agentB.name}說話`, resp:'你能讓我把話說完嗎！？'},
                ];
                const a = pickRandom(annoyances);
                lines.push({speaker:agentA.name, text:tA.includes('charismatic')?`對了對了，我跟你說——`:`嗯，我覺得你應該——`});
                lines.push({speaker:agentB.name, text:a.resp});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?'...對不起。':'切，好心沒好報。'});
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
                const memNpc = npc.memory.getAboutAgent(player.name, 5);
                const pN = this._buildCharacterProfile(npc);
                const prompt = `你正在扮演「${npc.name}」——邊境鎮的一位真實居民。有個叫${player.name}的人正在跟你說話。
你要完全入戲，像真人一樣自然地回應。

【你是誰】
${pN.name}，${pN.age}歲，${pN.job}。
性格：${pN.traits}。背景：${pN.background}。
在意的事：${pN.values}。感情狀態：${pN.status}。
${pN.thought ? `你最近在想：${pN.thought}` : ''}
${this._buildRelContext(relNpc, player.name)}
${memNpc.length ? `你記得關於${player.name}的事：${memNpc.map(m=>m.content).join('；')}` : `你跟${player.name}還不太熟。`}

【小鎮經濟】
${this._buildEconomicContext(world)}
${this._buildQuestContext(world, npc, relNpc)}
【對話記錄】
${recentChat || '（剛開始聊）'}
${player.name}: ${playerMessage}

【回覆規則】
- 必須使用繁體中文（台灣用語），不可使用簡體中文。1-3句話
- 像真人說話，不要文縐縐的。可以用語助詞（啊、啦、嘛、欸、喔、哈）
- 根據你的性格回應：${pN.traits.includes('害羞') ? '你會說話結巴、簡短' : pN.traits.includes('健談') ? '你很愛聊天，會主動延伸話題' : pN.traits.includes('刻薄') ? '你說話帶刺但可能是關心的方式' : '用你自己的方式說話'}
- 不要直接說「我很累」「我心情不好」這種報告式的話。如果你累了，可能會打哈欠或說「唉今天腰都快斷了」
- 對話要有來有往——回應對方說的話，也可以反問或岔開新話題
- 如果聊到你在意的事（${pN.values}），你會特別有感觸

【輸出格式】嚴格遵守！
- 第一行開始就直接寫${npc.name}的對話內容，不要加任何分析、思考過程、或前言
- 不要寫「讓我分析」「根據設定」「需要考慮」等分析文字
- 不要加名字前綴
- 最後另起一行寫：EFFECTS: {"affinity_change": 數字(-3到5), "romantic_change": 數字(0到3), "summary": "一句話總結"}
- 整個回覆只有對話內容和EFFECTS行，不要有其他任何東西`;

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
                    new RegExp(`^\\*{0,2}${npc.name}\\*{0,2}[：:]\\s*`),
                    /^\*{0,2}[\w\u4e00-\u9fff]+\*{0,2}[：:]\s*/,
                ];
                for (const pat of prefixPatterns) {
                    if (pat.test(text)) { text = text.replace(pat, '').trim(); break; }
                }
                // Skip lines that look like stage directions or system text
                if (text.startsWith('(') && text.endsWith(')')) continue;
                if (text.startsWith('（') && text.endsWith('）')) {
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
        const summary = effects.summary || `${npc.name}回應了${player.name}。`;
        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(0, affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}說：「${playerMessage}」— ${summary}`, 5, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${npc.name}交談：${summary}`, 4, [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', `${player.name} → ${npc.name}: ${summary}`, player.name, npc.name);
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }

    _fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc) {
        const t = npc.personality.traits;
        const aff = relNpc.affinity;
        const isCouple = relNpc.status === 'dating' || relNpc.status === 'married';
        const msg = playerMessage.toLowerCase();
        const jobTitle = npc.job?.title || '居民';
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
        const shy = t.includes('shy');
        const kind = t.includes('kind');
        const abrasive = t.includes('abrasive');
        const charismatic = t.includes('charismatic');
        const gossip = t.includes('gossip');
        const romantic = t.includes('romantic');
        const pessimist = t.includes('pessimist');
        const optimist = t.includes('optimist');
        const lazy = t.includes('lazy');

        if (isInsult) {
            // Player is being mean
            if (abrasive) npcReply = pickRandom([`你說什麼！？你自己才是吧！`,`哼，你也好不到哪去。`,`你這嘴巴欠教訓。`]);
            else if (shy) npcReply = pickRandom([`...你、你怎麼能這樣說...`,`......`,`我做錯什麼了嗎...`]);
            else if (kind) npcReply = pickRandom([`這樣說話很傷人的...`,`你是不是心情不好？不然怎麼會這樣。`,`我...不知道你為什麼要這樣。`]);
            else npcReply = pickRandom([`你這話說得太過分了。`,`......我沒必要跟你計較。`,`你認真的嗎？`]);
            affChange = randInt(-6,-3);
            summary = `${player.name}言語冒犯了${npc.name}。`;
        } else if (isFlirt) {
            if (isCouple) {
                npcReply = pickRandom([`你啊...每次都這樣，不過我就是吃這套。`,`哈哈，老夫老妻了還這麼會講。`,`你真的很會撩人，我都不好意思了。`]);
                affChange = randInt(2,4); romChange = randInt(1,3);
            } else if (romantic && aff > 10) {
                npcReply = shy ? pickRandom([`你、你在說什麼啦...（臉紅）`,`別、別突然這樣講...`,`...謝謝...（小聲）`])
                    : pickRandom([`哈哈，你還挺會說話的嘛。`,`嗯？你是在跟我告白嗎？`,`你這話讓人心跳加速呢。`]);
                affChange = randInt(1,4); romChange = randInt(2,5);
            } else if (aff < -10) {
                npcReply = pickRandom([`...你在開什麼玩笑。`,`拜託，省省吧。`,`你是不是搞錯了什麼？`]);
                affChange = randInt(-2,0);
            } else {
                npcReply = shy ? '...什麼？（不知所措）' : pickRandom([`哈？你認真的嗎？`,`嗯...謝謝？`,`你還挺有趣的。`]);
                affChange = randInt(0,2); romChange = randInt(0,2);
            }
            summary = `${player.name}對${npc.name}說了甜言蜜語。`;
        } else if (isGreeting) {
            if (isCouple) npcReply = pickRandom([`嗨親愛的，我一直在等你呢。`,`你來了！好想你。`,`嘿~今天怎麼這麼晚來找我？`]);
            else if (aff > 50) npcReply = charismatic ? `${player.name}！太好了你來了！`
                : shy ? `啊...${player.name}...你好。（微笑）`
                : `嘿！好久不見，最近好嗎？`;
            else if (aff > 10) npcReply = pickRandom([`你好啊！有什麼事嗎？`,`嗨！今天${loc}挺熱鬧的。`,`哈囉，正好遇到你了。`]);
            else if (aff > -10) npcReply = abrasive ? '嗯？怎麼了。' : pickRandom([`嗯，你好。`,`哦，是你啊。`,`哈囉。`]);
            else npcReply = pickRandom([`...有事嗎？`,`你又來了。`,`嗯。`]);
            affChange = aff > -10 ? randInt(0,2) : randInt(-1,0);
            summary = `${player.name}和${npc.name}打了招呼。`;
        } else if (isAskName) {
            npcReply = pickRandom([
                `我叫${npc.name}，${npc.age}歲，在鎮上當${jobTitle}。`,
                `${npc.name}啊，怎麼？你忘了我嗎？`,
                shy ? `我...我叫${npc.name}...` : `我是${npc.name}，認識一下！`,
            ]);
            affChange = randInt(0,2);
            summary = `${npc.name}自我介紹了。`;
        } else if (isAskJob) {
            const jobReplies = {
                farmer: [`我是農夫啊，每天日出就到田裡去了。${season}是${pickRandom(['播種','收穫','準備','整地'])}的季節。`,`種田很辛苦，但看到作物長大就很有成就感。`],
                miner: [`挖礦啊，每天鑽到山裡去。最近挖到了一些不錯的${pickRandom(['鐵礦','石頭','稀有礦石'])}。`,`礦坑裡又暗又悶，但能找到好東西的時候特別開心。`],
                cook: [`我在酒館煮飯！最近在研究新${pickRandom(['菜色','食譜','料理'])}。`,`煮飯給大家吃是我的樂趣，你要不要嚐嚐？`],
                blacksmith: [`我是鐵匠，每天跟鐵和火打交道。${shy?'...比跟人打交道容易多了。':'最近在打造一把新的工具。'}`,`敲打金屬的感覺很療癒，每一件作品都是獨一無二的。`],
                doctor: [`我是醫生，${lazy?'...雖然有時候很懶得看診。':'負責照顧鎮上所有人的健康。'}有什麼不舒服嗎？`,`行醫是一份責任很重的工作，但能治好人的時候很開心。`],
                researcher: [`我在圖書館做研究，最近在研究${pickRandom(['古代遺跡','草藥學','天文現象','歷史文獻'])}。`,`學問的世界無窮無盡，每天都有新發現。`],
                trader: [`我做買賣的，跟外面的商隊有聯繫。${charismatic?'要買什麼跟我說，我給你打折！':'最近市場不太穩定。'}`,`當商人最重要的是眼光和人脈。`],
                guard: [`我是守衛，負責鎮上的安全。${pessimist?'這年頭什麼事都可能發生。':'還好最近挺太平的。'}`,`守衛的工作就是讓大家能安心過日子。`],
                carpenter: [`我是木匠，蓋房子修東西。${lazy?'...雖然有時候偷懶。':'最近在趕工，忙得很。'}`,`木工的手藝越老越精，每塊木頭都有它的個性。`],
                tailor: [`我是裁縫，做衣服的。${shy?'...你要訂做什麼嗎？':'最近在設計新款式呢！'}`,`一針一線都是心血，我對品質很要求的。`],
                priest: [`我在禮拜堂服務，照顧大家的心靈。${kind?'如果有煩惱，可以來找我聊聊。':'也會幫忙主持各種儀式。'}`,`能為鎮民帶來平靜和希望，就是我最大的滿足。`],
                mayor: [`我是鎮長，管理鎮上大小事務。${optimist?'我對這個鎮的未來很有信心！':'責任很重，但這是我的使命。'}`,`治理一個鎮子不容易，但看到大家過得好就值了。`],
            };
            const pool = jobReplies[jobKey] || [`我在鎮上當${jobTitle}，還過得去吧。`,`${jobTitle}的工作有好有壞，但至少有事做。`];
            npcReply = pickRandom(pool);
            affChange = randInt(0,2);
            summary = `${npc.name}聊了自己的工作。`;
        } else if (isAskMood) {
            if (npc.mood > 60) npcReply = pickRandom([`我很好啊！${optimist?'今天特別開心！':'最近一切都挺順利的。'}`,`心情不錯！有什麼好事就是會開心嘛。`,`挺好的，謝謝你關心。`]);
            else if (npc.mood > 30) npcReply = pickRandom([`還行吧，普普通通。`,`馬馬虎虎，${pessimist?'不過總覺得少了什麼。':'就是平常的日子。'}`,`沒什麼特別的，過一天算一天。`]);
            else npcReply = pickRandom([
                `唉...說實話不太好。${kind?'不過沒關係，撐得住。':'別問了。'}`,
                `最近有點${pickRandom(['煩','累','低落','壓力大'])}...${shy?'...':'你真的想聽嗎？'}`,
                pessimist ? '一如既往地糟。' : '有點不順，但會過去的。',
            ]);
            affChange = randInt(1,3);
            summary = `${npc.name}分享了自己的心情。`;
        } else if (isAskLove) {
            if (isCouple) {
                const partnerName = relNpc.status === 'married' ? '老公/老婆' : '對象';
                npcReply = pickRandom([`我跟${player.name}在一起啊，你忘了嗎？`,`哈哈，感情的事...有你就夠了。`,`你是在試探我嗎？我只有你啊。`]);
                romChange = randInt(1,3);
            } else if (relNpc.romanticInterest > 50) {
                npcReply = shy ? `感、感情的事...我不太想說...（臉紅）` :
                    pickRandom([`嗯...其實有一個在意的人啦...不告訴你是誰。`,`你為什麼突然問這個？難道你...？`,`哈，秘密。`]);
                romChange = randInt(0,2);
            } else {
                npcReply = romantic ? pickRandom([`還沒遇到對的人呢...不過我相信緣分。`,`我是很期待愛情的，只是...唉。`])
                    : pickRandom([`這種事順其自然吧。`,`目前沒什麼想法，工作比較重要。`,abrasive?'關你什麼事。':'哈哈，你怎麼突然問這個？']);
            }
            affChange = randInt(0,2);
            summary = `${player.name}問了${npc.name}感情的事。`;
        } else if (isAskStory) {
            npcReply = pickRandom([
                `我的故事啊...${npc.personality.background}`,
                `以前的事嗎？${shy?'...有點不好意思說。':'坐下來，我慢慢跟你講。'} ${npc.personality.background}`,
                `你想知道我的過去？好吧...${npc.personality.background.slice(0,50)}`,
            ]);
            affChange = randInt(1,4);
            summary = `${npc.name}分享了自己的故事。`;
        } else if (isAskTown) {
            const gossipTopics = world.events?.conversationTopics || [];
            const gossip_s = world.gossipNetwork?.activeGossip || [];
            if (gossip && gossip_s.length) {
                const g = pickRandom(gossip_s);
                npcReply = `你想知道最近的八卦？${g.content} 這可是獨家消息喔！`;
            } else if (gossipTopics.length) {
                npcReply = `最近鎮上在聊${pickRandom(gossipTopics)}的事，你聽說了嗎？`;
            } else {
                npcReply = pickRandom([
                    `鎮上最近${optimist?'挺太平的，大家都過得不錯。':'也沒什麼特別的事。'}`,
                    `${season}嘛，${pickRandom(['農忙的季節','大家都挺忙的','日子就這樣過'])}。`,
                    pessimist ? '最近總覺得要出什麼事...' : `邊境鎮就是這樣，每天都有小故事。`,
                ]);
            }
            affChange = randInt(0,3);
            summary = `${npc.name}跟${player.name}聊了鎮上的近況。`;
        } else if (isAskFood) {
            if (jobKey === 'cook') npcReply = pickRandom([`你來對人了！我最近做了${pickRandom(['燉肉','烤魚','蔬菜湯','肉包子'])}，要不要嚐嚐？`,`吃的是我的專業！等著，我去給你弄點好吃的。`]);
            else if (npc.needs.hunger < 30) npcReply = `別說了，我自己都快餓死了...一起去酒館吧？`;
            else npcReply = pickRandom([`酒館的飯菜不錯，推薦你去試試。`,`王麗煮的菜最好吃了，你應該去嚐嚐。`,`肚子餓了嗎？吃飽了心情才會好。`]);
            affChange = randInt(0,2);
            summary = `${player.name}和${npc.name}聊了吃的。`;
        } else if (isAskWeather) {
            const weatherMap = {'春季':'春天暖洋洋的','夏季':'夏天好熱','秋季':'秋天涼爽','冬季':'冬天好冷'};
            if (isNight) npcReply = pickRandom([`今晚的${pickRandom(['星空','月色','夜風'])}真不錯。`,`夜裡出來${pickRandom(['看星星','散步','吹風'])}？我也覺得很舒服。`,t.includes('night_owl')?'夜晚最棒了，安安靜靜的。':'這麼晚了，小心著涼。']);
            else npcReply = pickRandom([`${weatherMap[season]||'天氣還好'}，${optimist?'不過我很享受！':'希望別變天。'}`,`${season}到了，${pickRandom(['時間過得真快','又是新的季節','風景挺美的'])}。`]);
            affChange = randInt(0,2);
            summary = `${player.name}和${npc.name}聊了天氣。`;
        } else if (isCompliment) {
            if (shy) npcReply = pickRandom([`啊...謝、謝謝你...（臉紅）`,`不、不會啦...你過獎了。`,`...真的嗎？（開心但不好意思）`]);
            else if (abrasive) npcReply = pickRandom([`哼，不用奉承我。`,`...你有什麼目的？`,`嗯，我知道。`]);
            else npcReply = pickRandom([`哈哈，謝謝！你這麼說我很開心。`,`你真會說話！`,`被你這樣誇，有點不好意思呢。`]);
            affChange = randInt(2,5);
            if (romantic) romChange = randInt(0,2);
            summary = `${player.name}讚美了${npc.name}。`;
        } else if (isAskHelp) {
            if (kind) npcReply = pickRandom([`需要幫忙嗎？儘管說！`,`我能做的一定幫！你說吧。`,`別客氣，鄰居互相幫忙是應該的。`]);
            else if (lazy) npcReply = pickRandom([`嗯...看是什麼事吧。我今天有點懶...`,`幫忙可以，但別太累的。`]);
            else if (abrasive) npcReply = pickRandom([`看什麼事吧。`,`我不是慈善機構。`,`你自己不能解決嗎？`]);
            else npcReply = pickRandom([`什麼事？看我能不能幫上忙。`,`好吧，你說說看。`,`我盡量吧。`]);
            affChange = kind ? randInt(1,3) : randInt(-1,2);
            summary = `${player.name}向${npc.name}求助。`;
        } else if (isFarewell) {
            if (isCouple) npcReply = pickRandom([`這麼快就走？路上小心。想你。`,`嗯...早點回來。`,`下次再來找我。`]);
            else if (aff > 30) npcReply = pickRandom([`再見！下次再聊！`,`掰掰，保重啊！`,`好的，有空再來找我！`]);
            else npcReply = pickRandom([`嗯，再見。`,`好的。`,abrasive?'終於要走了。':'拜拜。']);
            affChange = randInt(0,1);
            summary = `${player.name}和${npc.name}道別了。`;
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
                    npcReply = pickRandom([`嗯...我聽說${g.content}`,`你問這個啊？我倒是有聽到一些...${g.content}`,`${shy?'呃...我不太確定，但...':'我跟你說喔，'}${g.content}`]);
                } else {
                    npcReply = pickRandom([
                        `${shy?'嗯...我不太清楚...':'這個嘛...'}我平常不太注意別人的事。`,
                        `${abrasive?'我怎麼會知道這種事。':'我沒聽說過耶。'}你要不要去問問別人？`,
                        `${gossip?'欸我有聽到一點風聲，但不確定是不是真的...':'這個我真的不知道。'}`,
                        `${charismatic?'哈哈，你還挺八卦的嘛！':'嗯...'}我對這些不太了解欸。`,
                    ]);
                }
                affChange = randInt(0,2);
                summary = `${player.name}問了${npc.name}關於其他人的事。`;
            } else if (isQuestion && isAboutOpinion) {
                // Asking for NPC's opinion
                npcReply = pickRandom([
                    `${shy?'呃...我的想法嗎...':'嗯，讓我想想。'}我覺得${pickRandom(['每個人有每個人的想法吧','很難說，要看情況','這種事沒有標準答案'])}。`,
                    `${abrasive?'你問我？':'好問題。'}${pessimist?'反正不管怎樣結果都差不多。':optimist?'我覺得往好的方面想就對了！':'這要看怎麼看吧。'}`,
                    `${charismatic?'哦？你想聽我的看法？':'嗯...'}${pickRandom(['我個人是覺得還好啦。','說真的，我也沒什麼特別的想法。','這個嘛...要我說的話...算了，我也不太確定。'])}`,
                ]);
                affChange = randInt(0,3);
                summary = `${player.name}詢問了${npc.name}的看法。`;
            } else if (isQuestion && isAboutKnowledge) {
                // Asking if NPC knows something
                npcReply = pickRandom([
                    `${shy?'呃...':'嗯，'}${pickRandom(['我不太確定耶...','這個我沒聽過。','好像有聽說過，但記不太清了。'])}`,
                    `${gossip?'欸你這麼一說我好像有印象...不過我也不確定是不是真的。':'這個嘛...我真的不知道欸。'}`,
                    `${abrasive?'你覺得我什麼都知道嗎？':'哈，'}你可以去問問鎮上其他人，搞不好他們知道。`,
                    `${charismatic?'有趣的問題！':'嗯...'}${pickRandom(['讓我想想...不，我真的不知道。','我也想知道呢。','你去圖書館查查看？'])}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}問了${npc.name}一些事。`;
            } else if (isQuestion) {
                // Generic question
                npcReply = pickRandom([
                    `${shy?'嗯...這個嘛...':''}${pickRandom(['我想想喔...','好問題...','你突然這樣問我...'])}${pickRandom(['我也不太確定。','可能吧？','要看情況。','我沒想過這個問題欸。'])}`,
                    `${abrasive?'這種事你自己不知道嗎？':charismatic?'哈哈，你真的很好奇欸！':'嗯...'}${pickRandom(['說實話我不太清楚。','我回去想想再告訴你。','你為什麼會想問這個？'])}`,
                    `${optimist?'嗯，我覺得答案應該是正面的！':pessimist?'我不確定，但大概不會太好吧...':'我沒有什麼特別的想法欸。'}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}問了${npc.name}一個問題。`;
            } else {
                // Statement / generic chat — respond based on relationship
                if (isCouple) npcReply = pickRandom([`嗯嗯，我在聽。你繼續說。`,`你說的我都聽進去了。`,`是嗎？跟我說更多。`]);
                else if (aff > 50) npcReply = pickRandom([`嗯嗯！然後呢？`,`哈哈，你說的我懂。`,`是嗎？有意思！跟我說更多。`,`我也有同感！`]);
                else if (aff > 20) npcReply = pickRandom([`嗯，你說的有道理。`,`原來如此，我沒想過這件事。`,`哈，你還挺有想法的嘛。`,`是喔？有趣。`]);
                else if (aff > -10) npcReply = pickRandom([`嗯...是嗎。`,`哦，我知道了。`,`你這人還挺愛聊的。`,shy?'嗯嗯...':abrasive?'所以呢？':'好吧。']);
                else npcReply = pickRandom([`...隨便你怎麼說吧。`,`嗯哼。`,`我不太感興趣。`,`你說完了嗎？`]);
                affChange = aff > 0 ? randInt(0,2) : randInt(-1,1);
            }
            summary = summary || `${player.name}和${npc.name}聊了天。`;
        }

        // Add context-sensitive follow-up based on NPC state (natural phrasing)
        if (npc.needs.hunger < 20 && Math.random() < 0.3) npcReply += pickRandom([' ...（肚子咕嚕叫）啊，不好意思。',' 話說酒館現在有什麼吃的嗎？我都沒吃午飯。',' 哎，跟你聊著聊著都忘了吃飯了。']);
        if (npc.needs.rest < 20 && Math.random() < 0.3) npcReply += pickRandom([' （打了個哈欠）抱歉...昨晚沒睡好。',' 唉，今天腰都快斷了，幹了一整天活。',' 不好意思，我眼皮有點撐不住了...']);
        if (isNight && !t.includes('night_owl') && Math.random() < 0.2) npcReply += pickRandom([' 好了，夜深了，明天再聊吧。',' 啊，都這個時間了？我得回去了。']);
        if (npc.activity === 'stargazing' && Math.random() < 0.3) npcReply += pickRandom([' 欸你看！那邊那顆星特別亮！',' 今晚的星空真美，你不覺得嗎？']);

        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(-3,affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}說：「${playerMessage.slice(0,30)}」— ${summary}`, 4+Math.abs(affChange), [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `與${npc.name}：${summary}`, 3+Math.abs(affChange), [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', summary, player.name, npc.name);
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
        const result = await this._callProvider('groq', this.fallbackGroqKey, 'qwen/qwen3-32b', prompt, maxTokens, temperature);
        if (result === '__RATE_LIMITED__' || result === '__ERROR__') return '';
        return this._stripThinkTags(result);
    }

    async _callProvider(provider, apiKey, model, prompt, maxTokens, temperature) {
        const endpoints = {
            anthropic: { url: 'https://api.anthropic.com/v1/messages', model: model || 'claude-haiku-4-5-20251001' },
            openai: { url: 'https://api.openai.com/v1/chat/completions', model: model || 'gpt-4o-mini' },
            gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/${model||'gemini-2.5-flash'}:generateContent` },
            deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: model || 'deepseek-chat' },
            groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: model || 'qwen/qwen3-32b' },
            together: { url: 'https://api.together.xyz/v1/chat/completions', model: model || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
            minimax: { url: 'https://api.minimaxi.com/v1/text/chatcompletion_v2', model: model || 'MiniMax-M2.5' },
        };
        const cfg = endpoints[provider];
        if (!cfg) return '__ERROR__';

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
                if (!res.ok) return '__ERROR__';
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
    {name:'觀星之夜',description:'今晚的星空特別清澈，許多居民出門看星星。',severity:'minor',effects:{mood_all:8,conversation_topic:'美麗的星空'},night_event:true},
    {name:'月蝕',description:'罕見的月蝕！月亮變成了血紅色。',severity:'minor',effects:{mood_all:-3,conversation_topic:'血色月蝕'},night_event:true},
    {name:'螢火蟲之夜',description:'成千上萬的螢火蟲在鎮上飛舞！',severity:'minor',effects:{mood_all:12,conversation_topic:'螢火蟲奇觀'},seasons:['夏季','春季'],night_event:true},
    {name:'夜間竊盜',description:'有人趁夜偷走了倉庫的物資。',severity:'moderate',effects:{mood_all:-8,conversation_topic:'神秘竊賊'},night_event:true},
    {name:'極光出現',description:'天空中出現了壯麗的極光！',severity:'minor',effects:{mood_all:15,conversation_topic:'不可思議的極光'},seasons:['冬季','秋季'],night_event:true},
    {name:'夜半歌聲',description:'深夜從森林傳來神秘的歌聲。',severity:'minor',effects:{mood_all:-2,conversation_topic:'森林裡的歌聲'},night_event:true},
];
const DEPARTURE_REASONS = [
    '決定出發去進行貿易遠征','離開去城裡探望家人','踏上朝聖之旅',
    '出發去探索荒野','離開去遠方的學院進修',
    '前往首都尋求發展','出門旅行增廣見聞',
];
const IMMIGRANT_POOL = [
    {name:'周明',age:27,gender:'male',traits:['hardworking','optimist'],job:'farmer',background:'來自鄰村的開朗年輕農夫。'},
    {name:'李雪',age:31,gender:'female',traits:['kind','perfectionist'],job:'tailor',background:'聽說邊境鎮需要她的手藝的熟練裁縫。'},
    {name:'鄭強',age:35,gender:'male',traits:['stoic','hardworking'],job:'miner',background:'來自本地區的資深礦工。'},
    {name:'何芳',age:24,gender:'female',traits:['charismatic','romantic'],job:'cook',background:'懷抱遠大夢想的熱情廚師。'},
    {name:'蔡文',age:42,gender:'male',traits:['creative','neurotic'],job:'researcher',background:'被古代遺跡吸引而來的古怪學者。'},
    {name:'呂嵐',age:29,gender:'female',traits:['shy','early_bird'],job:'carpenter',background:'讓手藝說話的沉靜木匠。'},
    {name:'丁傑',age:38,gender:'male',traits:['abrasive','hardworking'],job:'blacksmith',background:'言語粗獷但手藝精湛的鐵匠。'},
    {name:'蕭瑜',age:23,gender:'female',traits:['optimist','gossip'],job:'trader',background:'善於議價的年輕商人。'},
    {name:'唐琳',age:33,gender:'female',traits:['kind','night_owl'],job:'doctor',background:'四處行醫的慈悲醫者。'},
    {name:'曹峰',age:44,gender:'male',traits:['stoic','pessimist'],job:'guard',background:'尋求平靜生活的資深戰士。'},
    {name:'邱雅',age:21,gender:'female',traits:['creative','shy'],job:'tailor',background:'擁有刺繡天賦的年輕工匠。'},
    {name:'范浩',age:36,gender:'male',traits:['lazy','charismatic'],job:'priest',background:'悠哉的精神導師。'},
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
            const festival = eligible.find(e => e.name === '慶典日');
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
            if (world.questSystem) world.questSystem.onRaidSurvived();
            guards.forEach(g => { g.moodModifier = (g.moodModifier || 0) + 10; g.memory.add(world.tickCount, world.clock.timeStr,'raid',`協助抵禦了${rd.attacker}！`,8); });
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
            homeLocation:agent.homeLocation, gender:agent.gender,
            skills:agent.skills.toDict(), relationships:agent.relationships.toDict(),
            memories:agent.memory.toDict(), mood:agent.mood, moodModifier:agent.moodModifier||0 };
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
            d.memories.forEach(m => agent.memory.add(m.tick, m.time, m.category, m.text, m.importance, m.relatedAgents||[]));
        }
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
        const agent = new Agent(id, imm.name, imm.age, personality, job, home, imm.gender);
        world.agents[agent.agentId] = agent;
        world.logMessage('immigration', `新居民到來：${agent.name}，${job.title}！`, agent.name);
        const event = {name:'新居民',description:`${agent.name}以${job.title}身分到來！`,severity:'minor',effects:{mood_all:5,conversation_topic:`新居民${agent.name}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`新居民${agent.name}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'immigration',`新居民${agent.name}到來了！`,5,[agent.name]);
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `新居民${agent.name}以${job.title}身分來到鎮上！`, 6, [agent.name]);
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
    { id:'economy',    label:'經濟發展', icon:'💰', values:['財富','冒險'],     traits:['hardworking','perfectionist'] },
    { id:'welfare',    label:'社會福利', icon:'🤝', values:['家庭','社群','和平'], traits:['kind','optimist'] },
    { id:'defense',    label:'軍事防禦', icon:'🛡️', values:['權力','冒險'],      traits:['stoic','hardworking'] },
    { id:'culture',    label:'文化教育', icon:'📚', values:['知識','藝術'],      traits:['creative','perfectionist'] },
    { id:'nature',     label:'自然保育', icon:'🌿', values:['自然','和平'],      traits:['ascetic','romantic'] },
    { id:'freedom',    label:'個人自由', icon:'🕊️', values:['自由','冒險'],      traits:['creative','night_owl'] },
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
        if (!this.active && (day - this.lastElectionDay) >= this._electionCooldown) {
            if (Math.random() < 0.02) this._startElection(world);
        }
        return null;
    }

    triggerElection(world) { if (this.active) return; this._startElection(world); }

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
        world.logMessage('event', `📢 選舉開始！${this.candidates.map(c => c.name).join('、')} 宣布參選鎮長`);
        world.logMessage('event', `📋 競選期間為 ${this.campaignDaysLeft} 天，之後進行投票`);
        this.candidates.forEach(c => {
            const agent = world.agents[c.agentId];
            if (agent?.memory) agent.memory.add(world.tickCount, world.clock.timeStr, 'election', `我宣布參選鎮長，主張${c.policyLabel}`, 8, []);
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
            economy: [`身為${agent.name}，我承諾帶領邊境鎮走向繁榮！`, `我會讓每個人都能豐衣足食！`, `加強貿易、開拓資源，讓鎮民富裕起來！`],
            welfare: [`我會照顧好每一位居民！`, `社區的和諧是我最重視的事。`, `讓大家都能安居樂業！`],
            defense: [`我會讓邊境鎮固若金湯！`, `加強防禦，不再讓突襲得逞！`, `保護家園是我的首要任務！`],
            culture: [`教育和文化才是小鎮的未來！`, `我要建立學院，讓知識傳承下去。`, `藝術與智慧將使我們偉大！`],
            nature:  [`我們必須與自然和諧共處。`, `永續發展才是正道！`, `保護環境就是保護我們自己。`],
            freedom: [`每個人都應該有選擇的自由！`, `減少管束，讓大家自由發展。`, `尊重個人，成就集體！`],
        };
        return pickRandom(speeches[policy.id] || speeches.economy);
    }

    _startVoting(world) { this.phase = 'voting'; this.votingDaysLeft = 2; this.votes = {}; world.logMessage('event', `🗳️ 投票開始！居民們正在投下神聖的一票`); }

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
            oldMayor.memory?.add(world.tickCount, world.clock.timeStr, 'election', `我在選舉中落敗，不再擔任鎮長`, 9, [winner.name]);
        }
        if (newMayorAgent) {
            newMayorAgent.job = new Job('mayor');
            newMayorAgent.moodModifier = (newMayorAgent.moodModifier || 0) + 20;
            newMayorAgent.memory?.add(world.tickCount, world.clock.timeStr, 'election', `我贏得了鎮長選舉！得到 ${winner.votes} 票`, 10, []);
        }
        const resultMsg = this.candidates.map(c => `${c.name}（${c.policyIcon}${c.policyLabel}）：${c.votes} 票`).join('、');
        world.logMessage('event', `🏆 選舉結果：${winner.name} 當選新鎮長！主張：${winner.policyIcon}${winner.policyLabel}`);
        world.logMessage('event', `📊 得票：${resultMsg}（共 ${totalVotes} 票）`);
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
        this.phase = 'results'; this.resultsDaysLeft = 3;
        return { name: '鎮長選舉', description: `${winner.name} 以 ${winner.votes}/${totalVotes} 票當選新鎮長`, severity: 'major', event_type: 'election', effects: {} };
    }

    _applyPolicyEffects(policyId, world) {
        const effects = {
            economy: { headline:'新鎮長推動經濟改革', modifiers:{farm_bonus:0.15, trade_bonus:0.1}, severity:'good' },
            welfare: { headline:'新鎮長推行社會福利', modifiers:{mood_modifier:5, immigration_chance:0.1}, severity:'good' },
            defense: { headline:'新鎮長加強防禦部署', modifiers:{raid_chance:-0.05, guard_bonus:0.2}, severity:'info' },
            culture: { headline:'新鎮長重視文化教育', modifiers:{research_bonus:0.2, skill_bonus:0.1}, severity:'info' },
            nature:  { headline:'新鎮長推動自然保育', modifiers:{gathering_bonus:0.2, mood_modifier:3}, severity:'good' },
            freedom: { headline:'新鎮長放寬政策管制', modifiers:{mood_modifier:3, immigration_chance:0.15}, severity:'info' },
        };
        const effect = effects[policyId];
        if (effect && world.news) {
            world.news.bulletins.push({ id: 'election_policy_' + Date.now(), headline: effect.headline, headline_en: '', category: '政治', severity: effect.severity, flavor: `${this.candidates[0]?.name || '新鎮長'}的施政方針開始影響小鎮`, modifiers: effect.modifiers, publishedDay: world.clock.day, expiresDay: world.clock.day + 30, daysRemaining: 30 });
            world.news._rebuildModifiers(world.clock.day + (world.clock.year - 1) * 60);
        }
    }

    toDict() {
        return { active: this.active, phase: this.phase, candidates: this.candidates.map(c => ({...c})), votes: {...this.votes}, campaignDaysLeft: this.campaignDaysLeft, votingDaysLeft: this.votingDaysLeft, resultsDaysLeft: this.resultsDaysLeft, lastElectionDay: this.lastElectionDay, electionHistory: this.electionHistory.slice(-10) };
    }

    loadFrom(data) {
        if (!data) return;
        this.active = data.active || false; this.phase = data.phase || 'none';
        this.candidates = (data.candidates || []).map(c => ({...c})); this.votes = data.votes || {};
        this.campaignDaysLeft = data.campaignDaysLeft || 0; this.votingDaysLeft = data.votingDaysLeft || 0;
        this.resultsDaysLeft = data.resultsDaysLeft || 0; this.lastElectionDay = data.lastElectionDay || 0;
        this.electionHistory = (data.electionHistory || []).slice(-10);
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
    farmer: {inputs:{},outputs:{food:12},skill:'種植'},
    miner: {inputs:{tools:0.1},outputs:{stone:6,metal:3},skill:'採礦'},
    cook: {inputs:{food:8},outputs:{meals:12},skill:'烹飪'},
    blacksmith: {inputs:{metal:3,wood:1},outputs:{tools:3},skill:'工藝'},
    carpenter: {inputs:{wood:4},outputs:{furniture:2},skill:'建造'},
    tailor: {inputs:{cloth:3},outputs:{clothing:2},skill:'工藝'},
    doctor: {inputs:{herbs:2},outputs:{medicine:2},skill:'醫療'},
    researcher: {inputs:{},outputs:{research_points:5},skill:'智識'},
    trader: {inputs:{},outputs:{silver:8},skill:'社交'},
    guard: {inputs:{},outputs:{},skill:'射擊'},
    priest: {inputs:{},outputs:{},skill:'社交'},
    mayor: {inputs:{},outputs:{silver:3},skill:'社交'},
};
const SEASON_FARM_MOD = {'春季':1.2,'夏季':1.5,'秋季':0.8,'冬季':0.2};
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
        if (isIndustryHandled) eff *= 0.3;
        if (agent.job.key === 'farmer') { eff *= SEASON_FARM_MOD[world.clock.season] || 1; eff *= 1 + (world.news?world.news.getModifier('farm_bonus',0):0); }
        if (agent.job.key === 'miner') eff *= 1 + (world.news?world.news.getModifier('mining_bonus',0):0);
        eff *= 1 + (agent.mood - 50)/500;
        eff *= 0.9 + Math.random()*0.2;
        let canProduce = true;
        for (const [r,a] of Object.entries(recipe.inputs)) { if (!sp.has(r,a)) { canProduce=false; break; } }
        if (!canProduce) { world.logMessage('economy',`${agent.name}無法工作——材料不足！`,agent.name); agent.moodModifier=(agent.moodModifier||0)-3; return; }
        for (const [r,a] of Object.entries(recipe.inputs)) sp.consume(r,a,world.tickCount,`${agent.name}的生產`,agent.name);
        for (const [r,a] of Object.entries(recipe.outputs)) sp.add(r,Math.round(a*eff*10)/10,world.tickCount,`${agent.name}（${agent.job.title}）`,agent.name);
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
        if (sp.consume('food',deficit*2,world.tickCount,'緊急食物')) world.logMessage('economy','餐食不夠！居民正在吃生食。');
        else { world.logMessage('economy','糧食短缺！居民正在挨餓！'); Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-10; a.needs.hunger=Math.max(0,a.needs.hunger-20); }); }
    }
    if (world.townMap) { for (const [locId,gather] of Object.entries(NATURE_GATHERING)) { if (world.townMap.locations[locId]) { for (const [r,a] of Object.entries(gather)) sp.add(r,a*0.5,world.tickCount,`natural (${locId})`); } } }
    sp.consume('tools',npcCount*0.05,world.tickCount,'tool wear');
    sp.consume('clothing',npcCount*0.03,world.tickCount,'clothing wear');
    if (world.clock.season === '冬季' && !sp.consume('wood',npcCount*0.3,world.tickCount,'冬季取暖')) {
        world.logMessage('economy','木材不夠取暖！');
        Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-8; a.needs.comfort=Math.max(0,a.needs.comfort-15); });
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
            if (world.dailyNews) world.dailyNews.collectEvent('building', `${p.name}建造完成了！`, 6);
            Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+5; });
        });
    }
    getEffect(key, def=0) { return this.activeEffects[key]??def; }
    toDict() { return {in_progress:this.projects,completed:this.completed,active_effects:{...this.activeEffects},completed_count:this.completed.length}; }
}

// --- Economy: Trade ---
const BASE_PRICES = {food:1,wood:1.5,stone:2,metal:4,cloth:3,herbs:3.5,meals:2.5,tools:8,clothing:6,medicine:10,furniture:7,
    plank:3,hardwood:5,brick:5,marble:8,steel:10,gold:15,
    wheat:2,rice:3,corn:2,potato:1,cotton:4,flowers:3,mushroom:4,sugarcane:3,tea:8,grapes:6,golden_wheat:15,dragon_fruit:20,
    bread:4,pastry:8,beer:5,wine:15,perfume:20,fine_tea:18,herbal_tea:10,sugar:5,jam:10,luxury_furniture:25,
};
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
        Object.values(world.agents).forEach(a=>{ if(!a.isPlayer&&a.job?.title==='研究員'){ const sk=a.skills.get('智識'); pts+=3+(sk?sk.level:0)*0.5; } });
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
     conditions:w=>{ const mayor=Object.values(w.agents).find(a=>a.job?.title==='鎮長'); return mayor&&mayor.mood>40; }, weight:2, severity:'good',
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
    work_buddies:  { name:'工作夥伴', icon:'🔨', maxSize:5, formCondition:'sameJob' },
    drinking_pals: { name:'酒友', icon:'🍺', maxSize:6, formCondition:'tavernRegulars' },
    gossip_circle: { name:'八卦圈', icon:'🗣️', maxSize:5, formCondition:'gossipTraits' },
    scholars:      { name:'學者聯盟', icon:'📚', maxSize:4, formCondition:'intellectual' },
    romantics:     { name:'戀愛同盟', icon:'💕', maxSize:4, formCondition:'romanticTraits' },
    troublemakers: { name:'搗蛋鬼', icon:'😈', maxSize:4, formCondition:'abrasiveTraits' },
    elders_council:{ name:'長者議會', icon:'🧓', maxSize:5, formCondition:'olderAgents' },
    night_owls:    { name:'夜貓族', icon:'🦉', maxSize:5, formCondition:'nightOwlTraits' },
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

        this._tryFormFactions(world);
        this._updateCohesion(world);
        this._tryFactionEvents(world);
        this._cleanupDeadFactions(world);
    }

    _tryFormFactions(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        const existingTypes = Object.values(this.factions).map(f => f.type);

        for (const [type, def] of Object.entries(FACTION_TYPES)) {
            if (existingTypes.filter(t => t === type).length >= 2) continue; // max 2 of same type

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
                        const socialCount = a.memory.entries.filter(m => m.content.includes('酒') || m.content.includes('tavern')).length;
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
                    const memberNames = filtered.map(a => a.name).join('、');
                    world.logMessage('faction', `${faction.icon} ${memberNames}組成了「${faction.name}」！`, filtered[0].name);
                    filtered.forEach(a => {
                        a.memory.add(world.tickCount, world.clock.timeStr, 'social', `我加入了「${faction.name}」，成員有${memberNames}。`, 6, filtered.map(x => x.name));
                        // Boost mutual affinity
                        filtered.forEach(b => {
                            if (a.agentId !== b.agentId) {
                                const rel = a.relationships.getOrCreate(b.agentId, b.name);
                                rel.modifyAffinity(randInt(3, 8));
                                rel.modifyTrust(randInt(2, 5));
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
                    world.logMessage('faction', `${agent.name}退出了「${faction.name}」。`, agent.name);
                    agent.memory.add(world.tickCount, world.clock.timeStr, 'social', `我退出了「${faction.name}」，我受不了他們了。`, 5, []);
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
                    `「${fA.name}」和「${fB.name}」在鎮上爆發了爭執！`,
                    `「${fA.name}」的成員公開批評「${fB.name}」。`,
                    `「${fA.name}」和「${fB.name}」因為意見不合發生衝突。`,
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
                `「${fA.name}」和「${fB.name}」決定攜手合作！`,
                `「${fA.name}」邀請「${fB.name}」一起舉辦活動。`,
                `「${fA.name}」和「${fB.name}」化敵為友，達成共識。`,
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
                    `${instigator.name}在「${faction.name}」聚會中公開指責${target.name}！`,
                    `${instigator.name}和${target.name}在「${faction.name}」內鬧不愉快。`,
                    `「${faction.name}」內部出現分裂，${instigator.name}帶頭反對${target.name}。`,
                ]);
                world.logMessage('faction', drama, instigator.name, target.name);
                instigator.relationships.getOrCreate(target.agentId, target.name).modifyAffinity(randInt(-8, -3));
                target.relationships.getOrCreate(instigator.agentId, instigator.name).modifyAffinity(randInt(-6, -2));
                faction.cohesion = Math.max(0, faction.cohesion - 10);
                world.gossipNetwork.activeGossip.push({
                    about: instigator.name, content: drama, source: '鎮民',
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
                        world.logMessage('faction', `「${faction.name}」因人數不足而解散。`, lastAgent.name);
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
        day: 8, name: '春祭', icon: '🌸',
        description: '慶祝新生與播種的季節！全城一起祈禱豐收。',
        effects: { mood_all: 15, social_boost: 20, conversation_topic: '春祭慶典' },
        activities: ['舞龍舞獅', '花車遊行', '種下許願樹', '分享春餅'],
        questName: '採集春花', questDesc: '在城外採集100朵春花裝飾廣場。',
    },
    '夏季': {
        day: 10, name: '豐收前夜祭', icon: '🔥',
        description: '仲夏夜的篝火慶典，居民圍著篝火講故事。',
        effects: { mood_all: 12, social_boost: 15, conversation_topic: '仲夏篝火' },
        activities: ['篝火晚會', '說故事比賽', '夜間市集', '放煙火'],
        questName: '收集木材', questDesc: '收集足夠的木材來搭建巨型篝火。',
    },
    '秋季': {
        day: 12, name: '秋收節', icon: '🍂',
        description: '感謝大地豐收！全城分享收成的喜悅。',
        effects: { mood_all: 18, food_bonus: 50, conversation_topic: '秋收慶典' },
        activities: ['豐收宴席', '農產品比賽', '秋收舞會', '感恩祭祀'],
        questName: '豐收祭品', questDesc: '準備最好的農產品作為祭品。',
    },
    '冬季': {
        day: 7, name: '冬至慶典', icon: '❄️',
        description: '最長的夜晚，居民們互相取暖、交換禮物。',
        effects: { mood_all: 20, social_boost: 25, conversation_topic: '冬至禮物' },
        activities: ['交換禮物', '熱湯分享', '冬至詩會', '雪地遊戲'],
        questName: '準備禮物', questDesc: '為每位居民準備一份特別的禮物。',
    },
};

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
            world.logMessage('festival', `${festival.icon} 明天就是${festival.name}了！全城都在準備中。`);
            world.events.conversationTopics.push(`即將到來的${festival.name}`);
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
                if (festival.effects.social_boost) {
                    a.needs.social = Math.min(100, a.needs.social + festival.effects.social_boost);
                }
                const activity = pickRandom(festival.activities);
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `參加了${festival.name}！${activity}真有趣。`, 7, []);
            });

            // Food bonus
            if (festival.effects.food_bonus) {
                world.stockpile.add('food', festival.effects.food_bonus);
                world.stockpile.add('meals', Math.floor(festival.effects.food_bonus / 2));
            }

            world.logMessage('festival', `${festival.icon} ${festival.name}開始了！${festival.description}`);
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

            // Special festival dialogue templates
            world.gossipNetwork.activeGossip.push({
                about: '全鎮', content: `${festival.name}好熱鬧！${pickRandom(festival.activities)}太棒了！`,
                source: '鎮民', spreadCount: 0, tickCreated: world.tickCount, isTrue: true
            });
        }

        // End festival
        if (this.activeFestival && world.tickCount > this.activeFestival.endTick) {
            world.logMessage('festival', `${this.activeFestival.icon} ${this.activeFestival.name}結束了，大家帶著美好的回憶回到日常。`);
            this.activeFestival = null;
        }

        // Auto-progress quest (NPC contributions)
        if (this.activeQuest && this.activeQuest.season === season) {
            const workers = Object.values(world.agents).filter(a => !a.isPlayer && a.activity === 'working');
            this.activeQuest.progress = Math.min(this.activeQuest.goal,
                this.activeQuest.progress + workers.length * randInt(2, 5));
            if (this.activeQuest.progress >= this.activeQuest.goal) {
                world.logMessage('festival', `🎉 節日任務「${this.activeQuest.name}」完成！獲得獎勵！`);
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
        };
    }
}

// --- NPC Death / Birth / Aging System ---
const DEATH_CAUSES = [
    '年老體衰', '突發疾病', '意外事故', '在探險中犧牲', '神秘失蹤後被發現',
];
const BABY_NAMES_MALE = ['小龍','天明','子軒','浩宇','嘉禾','承恩','宏志','瑞陽','文博','志遠','新宇','國棟'];
const BABY_NAMES_FEMALE = ['小鳳','曉月','詩涵','雨桐','美琪','欣怡','佳穎','思琪','夢瑤','婉清','紫萱','若蘭'];

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
        // Age NPCs once per season (approx every 15 game-days = every ~7 checks)
        if (world.clock.day !== 1) return;
        Object.values(world.agents).forEach(a => {
            if (!a.isPlayer) {
                a.age += 1; // 1 year per season for accelerated time
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
        if (npc.age >= 70) cause = '年老體衰';
        else if (world.events.activeEffects.disease) cause = '突發疾病';
        else cause = pickRandom(DEATH_CAUSES.slice(1));

        const epitaph = this._generateEpitaph(npc);

        // Record in graveyard
        this.graveyard.push({
            name: npc.name, age: npc.age, gender: npc.gender,
            deathCause: cause, deathTick: world.tickCount,
            deathTime: world.clock.timeStr, epitaph: epitaph,
            job: npc.job?.title || '無', traits: npc.personality.traits.slice(0, 3),
        });

        // Notify the world
        world.logMessage('death', `⚰️ ${npc.name}（${npc.age}歲）因${cause}離世了。${epitaph}`, npc.name);

        // Grief for related NPCs
        Object.values(world.agents).forEach(a => {
            if (a.agentId === npc.agentId) return;
            const rel = a.relationships.relationships[npc.agentId];
            if (rel) {
                let grief = -5;
                if (rel.status === 'married' || rel.status === 'dating') grief = -30;
                else if (rel.affinity > 50) grief = -20;
                else if (rel.affinity > 20) grief = -10;
                a.moodModifier = (a.moodModifier || 0) + grief;
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `${npc.name}去世了...我很難過。`, 9, [npc.name]);
                // Clear relationship status
                if (rel.status === 'married' || rel.status === 'dating') {
                    rel.status = 'ex'; rel.statusSince = world.tickCount;
                }
            }
        });

        // Town-wide mood hit
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== npc.agentId && !a.isPlayer) {
                a.moodModifier = (a.moodModifier || 0) - 3;
            }
        });

        world.gossipNetwork.activeGossip.push({
            about: npc.name, content: `${npc.name}去世了...願他安息。`,
            source: '鎮民', spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${npc.name}（${npc.age}歲）因${cause}離世了。${epitaph}`, 10, [npc.name]);

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
        // Check for married couples
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        for (const npc of npcs) {
            if (npc.age < 20 || npc.age > 45) continue;
            const partner = npc.relationships.getPartner();
            if (!partner || partner.status !== 'married') continue;
            const otherAgent = world.agents[partner.targetId];
            if (!otherAgent || otherAgent.isPlayer) continue;

            // Only check once per couple (by comparing IDs)
            if (npc.agentId > partner.targetId) continue;

            // Birth probability based on age and relationship quality
            const avgAge = (npc.age + otherAgent.age) / 2;
            let birthChance = 0.02;
            if (avgAge > 35) birthChance = 0.01;
            if (avgAge > 40) birthChance = 0.005;
            if (partner.affinity > 60) birthChance *= 1.5;

            // Limit total population
            const currentPop = Object.values(world.agents).filter(a => !a.isPlayer).length;
            if (currentPop >= 20) continue;

            if (Math.random() < birthChance) {
                this._birthChild(world, npc, otherAgent);
            }
        }
    }

    _birthChild(world, parentA, parentB) {
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
        const background = `${parentA.name}和${parentB.name}的孩子。在邊境鎮出生長大。`;

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
            `我們的孩子${name}出生了！`, 10, [parentB.name, name]);
        parentB.memory.add(world.tickCount, world.clock.timeStr, 'relationship',
            `我們的孩子${name}出生了！`, 10, [parentA.name, name]);

        // Set up parent-child relationships
        const relA = agent.relationships.getOrCreate(parentA.agentId, parentA.name);
        relA.modifyAffinity(50); relA.modifyTrust(40);
        const relB = agent.relationships.getOrCreate(parentB.agentId, parentB.name);
        relB.modifyAffinity(50); relB.modifyTrust(40);
        parentA.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);
        parentB.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);

        // Town celebration
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== agent.agentId) {
                a.moodModifier = (a.moodModifier || 0) + 5;
            }
        });

        world.logMessage('birth', `🎒 ${parentA.name}和${parentB.name}的孩子${name}出生了！全鎮慶祝！`, name);
        world.gossipNetwork.activeGossip.push({
            about: name, content: `${parentA.name}和${parentB.name}生了個${gender==='male'?'男':'女'}孩，取名${name}！`,
            source: '鎮民', spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${parentA.name}和${parentB.name}的孩子${name}出生了！`, 9, [parentA.name, parentB.name, name]);
    }

    _generateEpitaph(npc) {
        const lines = [];
        if (npc.job) lines.push(`曾任${npc.job.title}`);
        if (npc.personality.traits.includes('kind')) lines.push('以善良著稱');
        else if (npc.personality.traits.includes('hardworking')) lines.push('勤勞一生');
        else if (npc.personality.traits.includes('creative')) lines.push('才華洋溢');
        else if (npc.personality.traits.includes('charismatic')) lines.push('深受愛戴');
        else lines.push('將被永遠懷念');
        return lines.join('，') + '。';
    }

    toDict() {
        return {
            graveyard: this.graveyard.slice(-10000),
            births: this.births.slice(-10000),
            _daysSinceCheck: this._daysSinceCheck,
        };
    }
}

// --- Exploration / Map Expansion System ---
const EXPLORATION_ZONES = [
    { id:'deep_forest', name:'幽深森林', icon:'🌲', difficulty:2, distance:3,
      description:'城鎮外的茂密森林，傳說中有稀有草藥和野生動物。',
      rewards: { resources:{ wood:30, herbs:20 }, xpSkill:'種植', xpAmount:50 },
      events: ['發現了一片珍貴的草藥田！','遭遇了一群野狼，但成功擊退！','找到了一個隱藏的獵人小屋。','迷路了一陣子，但最終找到了回家的路。'] },
    { id:'ancient_ruins', name:'古代遺跡', icon:'🏛️', difficulty:4, distance:5,
      description:'神秘的古代建築遺址，可能藏有珍貴的知識和寶物。',
      rewards: { resources:{ silver:40, research_points:30 }, xpSkill:'智識', xpAmount:80 },
      events: ['發現了古代文字記錄！','觸發了一個古老的陷阱！','找到了珍貴的古代文物。','遺跡深處傳來神秘的聲音...'] },
    { id:'abandoned_mine', name:'廢棄礦坑', icon:'⛏️', difficulty:3, distance:4,
      description:'一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。',
      rewards: { resources:{ stone:25, metal:20 }, xpSkill:'採礦', xpAmount:60 },
      events: ['發現了一條新的礦脈！','礦坑塌方，但安全逃出！','找到了前礦工留下的工具。','在礦坑深處看到了奇異的光芒。'] },
    { id:'mountain_pass', name:'山間隘口', icon:'⛰️', difficulty:5, distance:6,
      description: '通往外界的危險山路，但可能找到貿易路線和珍稀資源。',
      rewards: { resources:{ silver:30, cloth:15, tools:10 }, xpSkill:'近戰', xpAmount:70 },
      events: ['在山頂看到了壯麗的風景！','遭遇山賊，經過一番苦戰取勝。','發現了一條通往鄰鎮的捷徑。','暴風雪來襲，艱難地撐了過去。'] },
    { id:'riverside_cave', name:'河畔洞窟', icon:'🕳️', difficulty:2, distance:2,
      description:'河邊的一個神秘洞穴，經常有奇怪的回音。',
      rewards: { resources:{ herbs:15, stone:10 }, xpSkill:'建造', xpAmount:40 },
      events: ['在洞窟裡發現了古老的壁畫！','找到了地下泉水，可能對鎮上的供水有幫助。','洞窟深處有蝙蝠群棲息。','發現了被水沖來的寶箱殘骸。'] },
    { id:'cursed_swamp', name:'詛咒沼澤', icon:'🌿', difficulty:4, distance:4,
      description:'傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。',
      rewards: { resources:{ herbs:30, medicine:10 }, xpSkill:'醫療', xpAmount:60 },
      events: ['找到了極為罕見的藥用植物！','陷入了沼澤泥潭，差點走不出來。','遇到了一位隱居的老藥師。','在沼澤中心發現了一塊奇怪的石頭。'] },
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
        const dayCount = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;

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
                world.logMessage('exploration', `🗺️ 發現了新的探索區域：${zone.icon} ${zone.name}！${zone.description}`);
                world.events.conversationTopics.push(`新發現的${zone.name}`);
                if (world.dailyNews) world.dailyNews.collectEvent('exploration', `發現了新的探索區域：${zone.name}！`, 7);
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
                `出發前往${zone.name}探險！`, 7, agents.map(x => x.name));
        });

        const names = agents.map(a => a.name).join('、');
        world.logMessage('exploration', `${zone.icon} ${names}出發前往${zone.name}探險了！預計${zone.distance}天後返回。`);

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
                        `從${zone.name}探險歸來！${event}`, 8, agents.map(x => x.name));
                });

                resultMsg = `${zone.icon} 探險隊從${zone.name}凱旋歸來！${event}`;
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
                        `從${zone.name}探險失敗返回...${event}`, 7, agents.map(x => x.name));
                });
                // Some resources still found
                for (const [resource, amount] of Object.entries(zone.rewards.resources)) {
                    world.stockpile.add(resource, Math.floor(amount * 0.2));
                }
                resultMsg = `${zone.icon} 探險隊從${zone.name}狼狽歸來...${event}`;
            }

            this.discoveredZones[zone.id].lastExploredTick = world.tickCount;
            expedition.status = isSuccess ? 'success' : 'failed';
            expedition.result = event;

            world.logMessage('exploration', resultMsg, agents.map(a => a.name).join('、'));
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
        this.conversationEngine = new ConversationEngine();
        // Economy
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
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
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
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
            const event = this.events.dailyUpdate(this);
            if (event) {
                this.logMessage('event', `[${event.severity.toUpperCase()}] ${event.name}: ${event.description}`);
                if (event.effects.mood_all != null) {
                    Object.values(this.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + event.effects.mood_all; });
                }
                if (this.dailyNews) this.dailyNews.collectEvent('event', `${event.name}：${event.description}`, event.severity === 'critical' ? 10 : event.severity === 'major' ? 8 : 5);
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
                if (this.dailyNews) this.dailyNews.collectEvent('politics', `${electionEvent.name}：${electionEvent.description}`, 8);
            }
            // New systems daily updates
            this.factions.dailyUpdate(this);
            this.festivals.dailyUpdate(this);
            this.lifecycle.dailyUpdate(this);
            this.exploration.dailyUpdate(this);
            // v3 systems daily updates
            this.industry.dailyUpdate(this);
            this.farm.dailyUpdate(this);
            this.processing.dailyUpdate(this);
            this.npcEvents.dailyUpdate(this);
            if (this.prosperity) this.prosperity.dailyUpdate(this);
            if (this.npcQuests) this.npcQuests.dailyUpdate(this);
            if (this.questSystem) this.questSystem.checkProgress(this);
            // AI Daily News (async, fire-and-forget)
            this.dailyNews.generateNewspaper(this).catch(e => console.warn('[DailyNews] Error:', e));
        }
        Object.values(this.agents).forEach(agent => {
            if (agent.currentLocation === 'exploration') return; // Skip agents on expedition
            agent.update(this);
        });
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
            npcEvents: this.npcEvents.toDict(),
            questSystem: this.questSystem ? this.questSystem.toDict() : null,
            prosperity: this.prosperity ? this.prosperity.toDict() : null,
            npcQuests: this.npcQuests ? this.npcQuests.toDict() : null,
        };
    }
    reset(seed = null) {
        this.clock.reset(); this.events = new EventSystem(); this.election = new ElectionSystem();
        this.agents = {}; this.tickCount = 0; this.paused = false; this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
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
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
        this.conversationEngine = new ConversationEngine(this.conversationEngine?.llm);
        this.townMap = generateRandomTown(seed);
        this._loadDefaultResidents();
        const player = new PlayerAgent();
        this.addAgent(player);
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

                // --- Natural romantic attraction growth ---
                // Requires decent affinity and multiple interactions before romance develops
                if (!rel.status && rel.affinity > 25 && rel.interactionCount > 5) {
                    const tA = agent.personality.traits;
                    const tB = other.personality.traits;
                    let compat = 0; // Base compatibility — need traits for romance
                    if (tA.includes('romantic') || tB.includes('romantic')) compat += 2;
                    if (tA.includes('shy') && tB.includes('kind')) compat += 1;
                    if (tA.includes('kind') && tB.includes('shy')) compat += 1;
                    if (tA.includes('charismatic') || tB.includes('charismatic')) compat += 1;
                    if (tA.includes('creative') && tB.includes('creative')) compat += 1;
                    if (tA.includes('abrasive') && tB.includes('abrasive')) compat -= 2;
                    const affinityBonus = Math.floor(rel.affinity / 25);
                    const growth = Math.max(0, affinityBonus + compat);
                    // Lower chance, requires real compatibility
                    if (growth > 0 && Math.random() < 0.25) {
                        rel.modifyRomantic(randInt(1, Math.min(growth, 3)));
                    }
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
                        this.logMessage('relationship', `${agent.name}和${other.name}開始交往了！`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${other.name}開始交往了！`, 9, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${agent.name}開始交往了！`, 9, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) + 20;
                        other.moodModifier = (other.moodModifier || 0) + 20;
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}和${other.name}在一起了！`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}和${other.name}開始交往了！`, 7, [agent.name, other.name]);
                    }
                }

                // --- Proposal / Marriage (from dating) ---
                if (rel.status === 'dating' && otherRel.status === 'dating') {
                    const datingDuration = this.tickCount - rel.statusSince;
                    // Need to have been dating for a while, high affinity and romantic
                    if (datingDuration > 100 && rel.affinity > 40 && rel.romanticInterest > 50 &&
                        otherRel.affinity > 35 && otherRel.romanticInterest > 40 && Math.random() < 0.15) {
                        rel.status = 'married'; rel.statusSince = this.tickCount;
                        otherRel.status = 'married'; otherRel.statusSince = this.tickCount;
                        this.logMessage('relationship', `${agent.name}和${other.name}結婚了！全鎮舉辦了盛大的婚禮！`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${other.name}結婚了！這是我人生中最幸福的一天。`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${agent.name}結婚了！太開心了。`, 10, [agent.name]);
                        // Wedding boosts mood for everyone
                        Object.values(this.agents).forEach(a => {
                            a.moodModifier = (a.moodModifier || 0) + 8;
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.memory.add(this.tickCount, this.clock.timeStr, 'social', `參加了${agent.name}和${other.name}的婚禮！`, 6, [agent.name, other.name]);
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}和${other.name}結婚了！婚禮好浪漫！`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}和${other.name}結婚了！全鎮舉辦了盛大的婚禮！`, 10, [agent.name, other.name]);
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
                            otherRel2.affinity > 30 && Math.random() < 0.03) {
                            otherRel2.isCheating = true;
                            thirdRel.isCheating = true;
                            this.logMessage('relationship', `${agent.name}背著${other.name}和${third.name}有了秘密關係⋯⋯`, agent.name, third.name);
                            agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我背著${other.name}和${third.name}在一起了⋯⋯我知道這不對。`, 9, [other.name, third.name]);
                            third.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${agent.name}開始了秘密關係。`, 8, [agent.name]);
                            this.gossipNetwork.activeGossip.push({ about:agent.name, content:`有人看到${agent.name}和${third.name}偷偷在一起⋯⋯`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                            if (this.dailyNews) this.dailyNews.collectEvent('drama', `有人看到${agent.name}和${third.name}偷偷在一起⋯⋯`, 8, [agent.name, third.name]);
                            break; // Only one affair at a time
                        }
                    }
                }

                // --- Discovery of cheating leads to breakup/divorce ---
                if ((rel.status === 'dating' || rel.status === 'married') && !rel.isCheating) {
                    // Check if partner is cheating
                    const partnerCheating = Object.values(other.relationships.relationships).find(r => r.isCheating && r.targetId !== agent.agentId);
                    if (partnerCheating && Math.random() < 0.1) {
                        // Discovered!
                        const thirdParty = this.agents[partnerCheating.targetId];
                        const thirdName = thirdParty?.name || '某人';
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
                        const action = wasMariage ? '離婚' : '分手';
                        this.logMessage('relationship', `${agent.name}發現${other.name}劈腿${thirdName}，兩人${action}了！`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `發現${other.name}背著我和${thirdName}在一起。我們${action}了。`, 10, [other.name, thirdName]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${agent.name}發現了我的事情。我們${action}了。`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 30;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:other.name, content:`${other.name}劈腿被${agent.name}發現了！兩人${action}了！`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${other.name}劈腿被${agent.name}發現！兩人${action}了！`, 10, [agent.name, other.name, thirdName]);
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
                        this.logMessage('relationship', `${agent.name}和${other.name}分手了。`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${other.name}分手了。`, 8, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${agent.name}分手了。`, 8, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 15;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}和${other.name}分手了⋯⋯`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}和${other.name}分手了⋯⋯`, 6, [agent.name, other.name]);
                    }
                }

                // --- Divorce (married, very low affinity for a long time) ---
                if (rel.status === 'married' && otherRel.status === 'married') {
                    const duration = this.tickCount - rel.statusSince;
                    if (duration > 300 && rel.affinity < -30 && otherRel.affinity < -20 && Math.random() < 0.05) {
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-15); otherRel.modifyAffinity(-15);
                        this.logMessage('relationship', `${agent.name}和${other.name}離婚了。`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${other.name}離婚了。`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `我和${agent.name}離婚了。`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 25;
                        other.moodModifier = (other.moodModifier || 0) - 25;
                        Object.values(this.agents).forEach(a => {
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.moodModifier = (a.moodModifier || 0) - 3;
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}和${other.name}離婚了⋯⋯好可惜。`, source:'鎮民', spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${agent.name}和${other.name}離婚了⋯⋯全鎮不勝唏噓。`, 9, [agent.name, other.name]);
                    }
                }
            }
        }
    }

    _loadDefaultResidents() {
        const residents = [
            {id:'chen_wei',name:'陳偉',age:45,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','hardworking','optimist'],values:['社群','和平'],background:'曾是軍官，二十年前定居邊境鎮。他深愛這個社區，把全鎮的安危視為自己的責任。'},
            {id:'lin_mei',name:'林美',age:32,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','night_owl'],values:['知識','家庭'],background:'才華洋溢的醫生，離開城裡的大醫院來到邊境鎮行醫。經常工作到深夜。'},
            {id:'zhang_hao',name:'張豪',age:28,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','shy','stoic'],values:['藝術','自由'],background:'沉默寡言但技藝精湛的鐵匠，用金屬表達自己的情感。私下喜歡寫詩。'},
            {id:'wang_li',name:'王麗',age:38,gender:'female',job:'cook',home:'residential_south',traits:['gossip','kind','glutton'],values:['社群','家庭'],background:'酒館的靈魂人物，認識鎮上每一個人，也知道所有人的八卦。煮的菜讓人回味無窮。'},
            {id:'liu_jun',name:'劉俊',age:22,gender:'male',job:'farmer',home:'residential_east',traits:['early_bird','romantic','creative'],values:['自然','冒險'],background:'有著遠大夢想的年輕農夫。偷偷寫情書但從未寄出，心中暗戀著某人。'},
            {id:'zhao_xia',name:'趙霞',age:35,gender:'female',job:'trader',home:'residential_east',traits:['charismatic','creative','pessimist'],values:['財富','冒險'],background:'精明的女商人，與外面的世界有廣泛的聯繫。表面開朗但內心悲觀。'},
            {id:'yang_feng',name:'楊鋒',age:40,gender:'male',job:'guard',home:'residential_north',traits:['stoic','hardworking','jealous'],values:['權力','家庭'],background:'前傭兵，在邊境鎮找到了平靜。但嫉妒心很重，尤其在感情方面。'},
            {id:'sun_yu',name:'孫雨',age:26,gender:'female',job:'researcher',home:'residential_east',traits:['creative','neurotic','night_owl'],values:['知識','自由'],background:'聰明但容易焦慮的年輕學者，正在研究小鎮附近的古代遺跡。'},
            {id:'wu_da',name:'吳達',age:50,gender:'male',job:'miner',home:'residential_south',traits:['hardworking','pessimist','abrasive'],values:['財富','自由'],background:'從十六歲就開始挖礦的老礦工。說話粗魯但非常可靠。'},
            {id:'huang_li',name:'黃莉',age:29,gender:'female',job:'priest',home:'residential_north',traits:['kind','optimist','romantic'],values:['和平','社群','藝術'],background:'溫柔的牧師，照顧禮拜堂和居民的心靈。有一副動人的歌喉，經常在教堂唱歌。'},
            {id:'ma_qiang',name:'馬強',age:33,gender:'male',job:'carpenter',home:'residential_south',traits:['lazy','charismatic','gossip'],values:['自由','冒險'],background:'迷人的懶鬼，比起幹活更喜歡講故事。但只要認真起來手藝一流。'},
            {id:'xu_ying',name:'許瑩',age:20,gender:'female',job:'tailor',home:'residential_east',traits:['shy','perfectionist','early_bird'],values:['藝術','家庭'],background:'鎮上最年輕的居民。天賦異稟的裁縫師，但太害羞不敢接受別人的誇獎。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
    }

    // --- Save / Load ---
    serialize() {
        const serializeAgent = (a) => ({
            id:a.agentId, name:a.name, age:a.age, gender:a.gender, isPlayer:a.isPlayer,
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
        });
        return {
            version: 2,
            savedAt: new Date().toISOString(),
            clock: { day:this.clock.day, hour:this.clock.hour, minute:this.clock.minute, season:this.clock.season, year:this.clock.year },
            tickCount: this.tickCount,
            paused: this.paused,
            messageLog: this.messageLog.slice(-10000),
            townMap: this.townMap ? { seed:this.townMap.seed, terrain:this.townMap.terrain, width:this.townMap.width, height:this.townMap.height,
                locations: Object.fromEntries(Object.entries(this.townMap.locations).map(([k,v])=>[k,{id:v.id,name:v.name,description:v.description,x:v.x,y:v.y,category:v.category,capacity:v.capacity}])) } : null,
            agents: Object.fromEntries(Object.entries(this.agents).map(([k,a])=>[k,serializeAgent(a)])),
            gossip: this.gossipNetwork.activeGossip.slice(-10000),
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
            industry: this.industry.serialize(),
            farm: this.farm.serialize(),
            processing: this.processing.serialize(),
            dailyNews: this.dailyNews.serialize(),
            npcEvents: this.npcEvents.serialize(),
            questSystem: this.questSystem ? this.questSystem.serialize() : null,
            prosperity: this.prosperity ? this.prosperity.serialize() : null,
            npcQuests: this.npcQuests ? this.npcQuests.serialize() : null,
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
                    agent.personality = personality;
                    if (job) agent.job = job;
                    agent.chatHistory = ad.chatHistory || [];
                } else {
                    agent = new Agent(id, ad.name, ad.age, personality, job, ad.homeLocation);
                }
                agent.currentLocation = ad.currentLocation;
                if (ad.gender) agent.gender = ad.gender;
                agent.mood = ad.mood; agent.activity = ad.activity;
                agent.moodModifier = ad.moodModifier || 0;
                agent.currentThought = ad.currentThought || '';
                agent._lastInteractionTick = ad._lastInteractionTick || 0;
                agent._locationStayRemaining = ad._locationStayRemaining || 0;
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
            }

            // Lifecycle
            this.lifecycle = new LifecycleSystem();
            if (data.lifecycle) {
                this.lifecycle.graveyard = data.lifecycle.graveyard || [];
                this.lifecycle.births = data.lifecycle.births || [];
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
            if (data.dailyNews) this.dailyNews.loadFrom(data.dailyNews);
            this.npcEvents = new NPCEventSystem();
            if (data.npcEvents) this.npcEvents.loadFrom(data.npcEvents);
            if (this.questSystem && data.questSystem) this.questSystem.loadFrom(data.questSystem);
            if (this.prosperity && data.prosperity) this.prosperity.loadFrom(data.prosperity);
            if (this.npcQuests && data.npcQuests) this.npcQuests.loadFrom(data.npcQuests);

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
    constructor(seed) { this.seed = seed || Math.floor(Math.random() * 2147483647); }
    _next() { this.seed = (this.seed * 16807) % 2147483647; return this.seed; }
    nextFloat() { return (this._next() - 1) / 2147483646; }
    nextInt(min, max) { return Math.floor(this.nextFloat() * (max - min + 1)) + min; }
}
