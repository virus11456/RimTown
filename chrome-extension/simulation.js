// ============================================================
// RimTown Simulation Engine - Complete JS Port
// ============================================================

// --- GameClock ---
class GameClock {
    constructor() {
        this.day = 1;
        this.hour = 6;
        this.minute = 0;
        this.season = 'spring';
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
            const seasons = ['spring','summer','autumn','winter'];
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
        return `Year ${this.year}, ${this.season.charAt(0).toUpperCase()+this.season.slice(1)}, Day ${this.day}, ${h}:${m}`;
    }
    get shortTime() {
        return `${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
    }
    reset() { this.day=1; this.hour=6; this.minute=0; this.season='spring'; this.year=1; }
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
        if (!recent.length) return 'No recent memories.';
        return recent.map(m => `- [${m.timeStr}] ${m.content}`).join('\n');
    }
    toDict() { return this.entries.slice(-20).map(e => e.toDict()); }
}

// --- Relationships ---
const REL_TYPES = { STRANGER:'stranger', ACQUAINTANCE:'acquaintance', FRIEND:'friend',
    CLOSE_FRIEND:'close_friend', RIVAL:'rival', ENEMY:'enemy', CRUSH:'crush', PARTNER:'partner' };

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
    kind: { social: 2, description: 'Naturally kind and empathetic' },
    abrasive: { social: -2, description: 'Tends to rub people the wrong way' },
    shy: { social: -1, description: 'Uncomfortable in social situations' },
    charismatic: { social: 3, description: 'Naturally draws people in' },
    gossip: { social: 1, description: 'Loves to share and hear rumors' },
    hardworking: { work: 2, description: 'Finds satisfaction in hard work' },
    lazy: { work: -2, description: 'Avoids work whenever possible' },
    perfectionist: { work: 1, description: 'Must do everything just right' },
    creative: { work: 1, description: 'Thinks outside the box' },
    optimist: { mood_base: 10, description: 'Always sees the bright side' },
    pessimist: { mood_base: -10, description: 'Expects the worst' },
    neurotic: { mood_sensitivity: 1.5, description: 'Emotions swing wildly' },
    stoic: { mood_sensitivity: 0.5, description: 'Rarely shows emotion' },
    romantic: { romance: 2, description: 'Falls in love easily' },
    jealous: { romance: -1, description: 'Prone to jealousy' },
    night_owl: { schedule: 'late', description: 'Prefers staying up late' },
    early_bird: { schedule: 'early', description: 'Rises with the sun' },
    glutton: { food: 1.5, description: 'Loves food more than most' },
    ascetic: { comfort: -1, description: 'Prefers a simple life' },
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
        const allValues = ['family','freedom','knowledge','wealth','power','art','nature','community','adventure','peace'];
        const vals = shuffle(allValues).slice(0, 1 + Math.floor(Math.random() * 3));
        return new Personality(traits, '', vals);
    }
    get socialModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.social || 0), 0); }
    get workModifier() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.work || 0), 0); }
    get moodBase() { return this.traits.reduce((s,t) => s + (TRAIT_POOL[t]?.mood_base || 0), 0); }
    describe() { return this.traits.filter(t => TRAIT_POOL[t]).map(t => TRAIT_POOL[t].description).join('; '); }
    toDict() { return { traits:this.traits, background:this.background, values:this.values, description:this.describe() }; }
}

// --- Skills ---
const SKILL_CATEGORIES = ['shooting','melee','construction','mining','cooking','plants','animals','crafting','medicine','social','intellectual','artistic'];
const PASSION_LEVELS = ['incapable','none','minor','major','burning'];
const PASSION_XP_MULT = { incapable:0, none:1, minor:1.5, major:2.5, burning:4 };

function xpForLevel(level) { return level <= 0 ? 0 : Math.floor(100 * level * (1 + level * 0.2)); }

class Skill {
    constructor(category) { this.category = category; this.xp = 0; this.passion = 'none'; }
    get level() { let l=0; while(l<20 && this.xp >= xpForLevel(l+1)) l++; return l; }
    get xpToNext() { return Math.max(0, xpForLevel(Math.min(this.level+1,20)) - this.xp); }
    get levelProgress() {
        const l = this.level; if (l>=20) return 1;
        const cur = xpForLevel(l), nxt = xpForLevel(l+1);
        return nxt===cur ? 1 : (this.xp - cur)/(nxt - cur);
    }
    get isIncapable() { return this.passion === 'incapable'; }
    addXp(amount) {
        if (this.isIncapable) return false;
        const old = this.level;
        this.xp += Math.floor(amount * (PASSION_XP_MULT[this.passion] || 1));
        return this.level > old;
    }
    toDict() {
        const icons = {incapable:'X',none:'',minor:'*',major:'**',burning:'***'};
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
    get passions() { return Object.values(this.skills).filter(s => ['minor','major','burning'].includes(s.passion)); }
    get totalLevel() { return Object.values(this.skills).reduce((s,sk) => s + sk.level, 0); }
    toDict() { return { skills: Object.fromEntries(Object.entries(this.skills).map(([k,v])=>[k,v.toDict()])), total_level:this.totalLevel, best_skill:this.bestSkill.category }; }
}

const JOB_SKILL_MAP = {
    farmer:{primary:['plants'],secondary:['animals','cooking']}, miner:{primary:['mining'],secondary:['construction','melee']},
    cook:{primary:['cooking'],secondary:['plants','social']}, blacksmith:{primary:['crafting'],secondary:['mining','construction']},
    doctor:{primary:['medicine'],secondary:['intellectual','social']}, researcher:{primary:['intellectual'],secondary:['medicine','crafting']},
    trader:{primary:['social'],secondary:['intellectual','crafting']}, guard:{primary:['shooting'],secondary:['melee','medicine']},
    carpenter:{primary:['construction'],secondary:['crafting','plants']}, tailor:{primary:['crafting'],secondary:['artistic','social']},
    priest:{primary:['social'],secondary:['artistic','intellectual']}, mayor:{primary:['social'],secondary:['intellectual','artistic']},
};
const ACTIVITY_SKILL_MAP = { socializing:['social'], eating:[], sleeping:[], recreation:['artistic'], wandering:['animals','plants'] };

function generateRandomSkills(jobKey, age = 25, traitList = []) {
    const skills = new SkillSet();
    const cats = shuffle([...SKILL_CATEGORIES]);
    const nBurning = Math.random()<0.15?1:0, nMajor = randInt(0,2), nMinor = randInt(1,3), nIncap = Math.random()<0.25?1:0;
    let idx = 0;
    for (let i=0;i<nBurning&&idx<cats.length;i++) skills.get(cats[idx++]).passion='burning';
    for (let i=0;i<nMajor&&idx<cats.length;i++) skills.get(cats[idx++]).passion='major';
    for (let i=0;i<nMinor&&idx<cats.length;i++) skills.get(cats[idx++]).passion='minor';
    for (let i=0;i<nIncap&&idx<cats.length;i++) skills.get(cats[idx++]).passion='incapable';

    const traitPassionMap = {kind:'social',charismatic:'social',creative:'artistic',hardworking:'construction',romantic:'artistic',gossip:'social'};
    traitList.forEach(t => {
        const sk = traitPassionMap[t]; if (!sk) return;
        const s = skills.get(sk);
        if (s.passion==='none') s.passion='minor'; else if (s.passion==='minor') s.passion='major';
    });

    let pool = Math.max(0, (age - 16)) * randInt(30,60);
    const capable = Object.values(skills.skills).filter(s => !s.isIncapable);
    const weights = capable.map(s => ({incapable:0,none:1,minor:2,major:3.5,burning:5}[s.passion])||1);
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
    farmer:{title:'Farmer',category:'production',description:'Grows crops and tends to the fields',workplace:'farm',work_hours:[6,16],daily_output:'food and produce'},
    miner:{title:'Miner',category:'production',description:'Extracts stone and ore from the quarry',workplace:'quarry',work_hours:[7,16]},
    cook:{title:'Cook',category:'service',description:'Prepares meals at the tavern',workplace:'tavern',work_hours:[5,14]},
    blacksmith:{title:'Blacksmith',category:'production',description:'Forges tools and equipment',workplace:'workshop',work_hours:[8,17]},
    doctor:{title:'Doctor',category:'intellectual',description:'Treats the sick and injured',workplace:'clinic',work_hours:[8,18]},
    researcher:{title:'Researcher',category:'intellectual',description:'Studies and discovers new knowledge',workplace:'library',work_hours:[9,17]},
    trader:{title:'Trader',category:'social',description:'Manages the general store',workplace:'general_store',work_hours:[8,18]},
    guard:{title:'Guard',category:'combat',description:'Patrols and protects the town',workplace:'guardpost',work_hours:[6,18]},
    carpenter:{title:'Carpenter',category:'production',description:'Builds and repairs structures',workplace:'workshop',work_hours:[7,16]},
    tailor:{title:'Tailor',category:'production',description:'Makes clothing and textiles',workplace:'workshop',work_hours:[8,17]},
    priest:{title:'Priest',category:'social',description:'Tends to the spiritual needs',workplace:'chapel',work_hours:[7,19]},
    mayor:{title:'Mayor',category:'social',description:'Leads the town',workplace:'town_hall',work_hours:[9,17]},
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
                        world.logMessage('skill_up', `${this.name}'s ${n} reached level ${this.skills.get(n).level}!`, this.name);
                        this.currentThought = `I'm getting better at ${n}!`;
                    }
                });
                (map.secondary||[]).forEach(n => this.skills.addXp(n, xp));
            }
        } else {
            const actMap = ACTIVITY_SKILL_MAP[this.activity] || [];
            actMap.forEach(n => { if(this.skills.addXp(n, xp)) world.logMessage('skill_up', `${this.name}'s ${n} reached level ${this.skills.get(n).level}!`, this.name); });
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
        if (this.mood > 60) { thoughts.push('Life in RimTown is pretty good.', 'I feel great today!'); }
        else if (this.mood < 20) { thoughts.push('Things could be better...', "I'm not feeling so great."); }
        if (this.needs.hunger < 30) thoughts.push("I'm getting hungry...");
        if (this.needs.rest < 30) thoughts.push('I could really use some sleep...');
        if (this.needs.social < 30) thoughts.push('I should talk to someone...');
        const bf = this.relationships.getBestFriend();
        if (bf) thoughts.push(`I should catch up with ${bf.targetName}.`);
        const rom = this.relationships.getRomanticInterests();
        if (rom.length) thoughts.push(`I keep thinking about ${pickRandom(rom).targetName}...`);
        const best = this.skills.bestSkill;
        if (best.level > 0) thoughts.push(`I've been improving at ${best.category}...`);
        // Economy thoughts
        if (world.stockpile) {
            if (world.stockpile.get('food') < 30) thoughts.push("We're running low on food...");
            if (world.stockpile.get('silver') > 300) thoughts.push("The town's treasury is doing well!");
            if (world.stockpile.get('meals') < 10) thoughts.push("We need the cook to prepare more meals.");
        }
        if (world.buildings?.projects?.length) { const p=world.buildings.projects[0]; thoughts.push(`The ${p.name} is ${Math.round(p.workDone/p.workRequired*100)}% done!`); }
        if (world.trade?.merchant) thoughts.push(`I should check what ${world.trade.merchant.name} is selling.`);
        if (thoughts.length) this.currentThought = pickRandom(thoughts);
    }
    toDict() {
        return {
            id:this.agentId, name:this.name, age:this.age,
            job: this.job?.toDict() || null, personality: this.personality.toDict(),
            mood:this.mood, mood_description:this.moodDescription, activity:this.activity,
            current_location:this.currentLocation, current_thought:this.currentThought,
            needs:this.needs.toDict(), skills:this.skills.toDict(),
            relationships:this.relationships.toDict(), recent_memories:this.memory.toDict(),
        };
    }
}

// --- PlayerAgent ---
class PlayerAgent extends Agent {
    constructor(name = 'Traveler', age = 25) {
        super('player', name, age, new Personality(['curious','kind'], 'A mysterious traveler who recently arrived in RimTown.', ['adventure','friendship']), null, 'tavern');
        this.isPlayer = true; this.chatHistory = [];
    }
    update(world) {
        this.needs.tickDecay(this.activity==='sleeping', this.activity==='eating', this.activity==='socializing', this.activity==='recreation');
        this.mood = Math.max(-100, Math.min(100, 50 + this.personality.moodBase + Math.floor(this.needs.moodContribution)));
    }
    moveTo(locationId, world) {
        if (world.townMap && !world.townMap.locations[locationId]) return false;
        this.currentLocation = locationId; this.activity = 'wandering';
        world.logMessage('player_move', `You moved to ${locationId}`, this.name);
        return true;
    }
    toDict() { const d = super.toDict(); d.is_player = true; d.chat_history = this.chatHistory.slice(-50); return d; }
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
        world.logMessage('gossip', `${speaker.name} gossiped to ${listener.name} about ${gossip.about}`, speaker.name, listener.name);
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
        const summary = effects.summary || `${agentA.name} and ${agentB.name} had a chat.`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `Talked with ${agentB.name}: ${summary}`, Math.min(8,4+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `Talked with ${agentA.name}: ${summary}`, Math.min(8,4+Math.abs(affB)), [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        return { dialogue, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _fallbackConversation(agentA, agentB, world, relA, relB) {
        const greetings = ['Hey','Hi there','Hello','Good to see you','Oh, hey'];
        const topics = [
            `How's the ${agentB.job?.title || 'day'} going?`, 'Nice weather today, isn\'t it?',
            'Have you heard any news lately?', 'I\'ve been so busy lately.', 'This town is really something, huh?'
        ];
        const dialogue = [
            {speaker:agentA.name, text:`${pickRandom(greetings)}, ${agentB.name}!`},
            {speaker:agentB.name, text:`${pickRandom(greetings)}! ${pickRandom(topics)}`},
            {speaker:agentA.name, text:'Yeah, I know what you mean. Take care!'},
        ];
        const summary = `${agentA.name} and ${agentB.name} had a brief chat.`;
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
Age: ${npc.age}, Job: ${npc.job?.title||'Unemployed'}
Personality: ${npc.personality.describe()}
Background: ${npc.personality.background}
Mood: ${npc.moodDescription}
Relationship with ${player.name}: ${relNpc.type} (affinity: ${relNpc.affinity})
Memories about ${player.name}: ${memNpc.length ? memNpc.map(m=>m.content).join('\n') : "You don't know them well yet."}

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
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `Talked with ${npc.name}: ${summary}`, 4, [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', `${player.name} → ${npc.name}: ${summary}`, player.name, npc.name);
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }

    _fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc) {
        const pools = {
            high: ["It's always great to see you!","I was just thinking about you!","Of course! Happy to chat anytime."],
            medium: ["Oh, hello! What brings you here?","Sure, I have a moment.","Not a bad day. How about you?"],
            low: ["Hmm? What do you want?","I'm a bit busy...","..."],
        };
        const pool = relNpc.affinity > 30 ? pools.high : relNpc.affinity > -10 ? pools.medium : pools.low;
        const npcReply = pickRandom(pool);
        const aff = randInt(0,2);
        relNpc.modifyAffinity(aff); relNpc.recordInteraction(world.tickCount, `Chatted with ${player.name}`);
        relPlayer.modifyAffinity(aff); relPlayer.recordInteraction(world.tickCount, `Chatted with ${npc.name}`);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name} talked to me.`, 4, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `Talked with ${npc.name}.`, 3, [npc.name]);
        player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        world.logMessage('player_chat', `${player.name} chatted with ${npc.name}`, player.name, npc.name);
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:aff,romantic_change:0}, summary:`${player.name} chatted with ${npc.name}.` };
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
    ['town_square',['Town Square','Central Plaza','Market Square','Village Green'],'The heart of the settlement','social',[15,25]],
    ['tavern',['The Rusty Pickaxe','Dragon\'s Rest Inn','The Golden Tankard','Moonlight Tavern','The Wanderer\'s Haven'],'Food, drink, and socializing','social',[10,18]],
    ['town_hall',['Town Hall','Council Hall','Mayor\'s Office','Elder\'s Lodge'],'Where the town is governed','work',[5,10]],
];
const WORK_LOCATIONS = [
    ['farm',['Sunny Fields','Green Acres','Harvest Moon Farm'],'Fertile farmland','work',[4,8]],
    ['quarry',['Deep Rock Quarry','Iron Ridge Mine','Stonecutter\'s Pit'],'Rich mineral deposits','work',[4,8]],
    ['workshop',['Crafter\'s Workshop','The Forge & Anvil','Tinker\'s Bench'],'Where goods are crafted','work',[5,10]],
    ['general_store',['General Store','Trading Post','Merchant\'s Corner'],'Trade and supplies','work',[4,8]],
    ['clinic',['Town Clinic','Healer\'s Hut','Apothecary'],'Medical care','work',[3,6]],
    ['library',['The Old Library','Scholar\'s Archive','Book Tower'],'Knowledge and research','work',[4,8]],
    ['guardpost',['Guard Post','Watchtower','Militia Barracks'],'Watching over the town','work',[3,5]],
];
const SOCIAL_LOCATIONS = [
    ['chapel',['Chapel of Light','Stone Temple','Shrine of Harmony'],'Peace and reflection','social',[8,15]],
    ['park',['Town Park','Blossom Garden','Sunlit Meadow'],'Peaceful green space','social',[10,18]],
    ['well',['Town Well','Spring Fountain','Water Mill'],'Fresh water','social',[3,6]],
];
const RESIDENTIAL_LOCATIONS = [
    ['residential_north',['North Quarter','Hilltop Houses','Upper District'],'Residential area','residential',[8,12]],
    ['residential_south',['South Quarter','Riverside Homes','Lower District'],'Residential area','residential',[8,12]],
    ['residential_east',['East Quarter','Sunrise Houses','Garden District'],'Residential area','residential',[8,12]],
];
const NATURE_LOCATIONS = [
    ['forest',['Whispering Woods','Dark Pines','Eldergrove'],'Dense forest','nature',[6,10]],
    ['river',['Crystal River','Silverbrook','Rushing Creek'],'A calm river','nature',[4,8]],
    ['hill',['Outlook Hill','Windswept Ridge','Eagle\'s Peak'],'High ground','nature',[3,6]],
    ['cave',['Shadow Cave','Echo Cavern','Old Mine Shaft'],'Mysterious cave','nature',[2,5]],
    ['lake',['Mirror Lake','Lily Pond','Deep Pool'],'Still water','nature',[4,7]],
    ['meadow',['Wildflower Meadow','Rolling Fields','Clover Flats'],'Open grasslands','nature',[5,10]],
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
        {name:'Drought',description:'The wells are running dry and crops are withering.',severity:'moderate',effects:{mood_all:-8,conversation_topic:'the terrible drought'},seasons:['summer'],duration_days:3},
        {name:'Famine',description:'Food supplies are critically low.',severity:'major',effects:{mood_all:-15,conversation_topic:'the worsening famine'},delay_days:3,duration_days:4},
        {name:'Riot',description:'Desperate townsfolk are fighting over supplies!',severity:'major',effects:{mood_all:-20,conversation_topic:'the riot'},delay_days:4,duration_days:2},
    ],
    plague_quarantine_recovery: [
        {name:'Mysterious Illness',description:'Several residents show signs of strange illness.',severity:'moderate',effects:{mood_all:-10,conversation_topic:'the mysterious illness'},duration_days:2},
        {name:'Quarantine',description:'The doctor ordered a quarantine.',severity:'major',effects:{mood_all:-15,conversation_topic:'the quarantine'},delay_days:2,duration_days:3},
        {name:'Recovery',description:'The illness has passed! Everyone celebrates.',severity:'minor',effects:{mood_all:15,conversation_topic:'recovering'},delay_days:3,duration_days:1},
    ],
    storm_damage_rebuild: [
        {name:'Great Storm',description:'A terrible storm is battering the town!',severity:'major',effects:{mood_all:-12,conversation_topic:'the devastating storm'},seasons:['autumn','winter'],duration_days:1},
        {name:'Storm Damage',description:'The storm left significant damage.',severity:'moderate',effects:{mood_all:-8,conversation_topic:'storm damage'},delay_days:1,duration_days:3},
        {name:'Community Rebuild',description:'Everyone pitches in to rebuild.',severity:'minor',effects:{mood_all:10,conversation_topic:'the rebuild effort'},delay_days:3,duration_days:2},
    ],
};
const RAID_POOL = [
    {name:'Bandit Raid',description:'A group of bandits is approaching!',severity:'major',threat_level:3,attacker:'bandits',effects:{mood_all:-15,conversation_topic:'the bandit attack'}},
    {name:'Wild Beast Attack',description:'A pack of wolves has come from the mountains!',severity:'moderate',threat_level:2,attacker:'wolves',effects:{mood_all:-10,conversation_topic:'the wolf attack'}},
    {name:'Marauder Incursion',description:'Armed marauders are raiding!',severity:'major',threat_level:4,attacker:'marauders',effects:{mood_all:-18,conversation_topic:'the marauders'}},
    {name:'Wild Boar Rampage',description:'Enraged wild boars charging through town!',severity:'moderate',threat_level:2,attacker:'boars',effects:{mood_all:-8,conversation_topic:'the boar rampage'}},
];
const EVENT_POOL = [
    {name:'Bountiful Harvest',description:'Crops are growing exceptionally well!',severity:'minor',effects:{mood_all:5},seasons:['spring','summer']},
    {name:'Cold Snap',description:'An unexpected cold front hit the town.',severity:'moderate',effects:{mood_all:-10},seasons:['winter','autumn']},
    {name:'Festival Day',description:'The town holds a festival! Everyone celebrates.',severity:'minor',effects:{mood_all:15}},
    {name:'Supply Shortage',description:'Trade routes disrupted. Supplies running low.',severity:'moderate',effects:{mood_all:-5}},
    {name:'Strange Lights',description:'Strange lights in the sky.',severity:'minor',effects:{mood_all:-3,conversation_topic:'strange lights'}},
    {name:'Travelling Merchant',description:'A merchant arrives with rare goods.',severity:'minor',effects:{mood_all:5,conversation_topic:'the merchant\'s exotic wares'}},
    {name:'Beautiful Aurora',description:'A stunning aurora lights up the night sky.',severity:'minor',effects:{mood_all:10},seasons:['winter']},
    {name:'Heatwave',description:'Scorching heat makes outdoor work unbearable.',severity:'moderate',effects:{mood_all:-8},seasons:['summer']},
    {name:'Lucky Find',description:'Someone found valuable materials!',severity:'minor',effects:{mood_all:8,conversation_topic:'the lucky discovery'}},
    {name:'Stargazing Night',description:'The sky is exceptionally clear tonight.',severity:'minor',effects:{mood_all:5,conversation_topic:'the beautiful stars'}},
];
const DEPARTURE_REASONS = [
    'decided to go on a trading expedition','left to visit family in the city','embarked on a pilgrimage',
    'went on an adventure to explore the wilderness','left to study at a faraway academy',
    'departed to seek fortune in the capital','went travelling to broaden their horizons',
];
const IMMIGRANT_POOL = [
    {name:'周明 (Zhou Ming)',age:27,traits:['hardworking','optimist'],job:'farmer',background:'A cheerful young farmer from a neighbouring village.'},
    {name:'李雪 (Li Xue)',age:31,traits:['kind','perfectionist'],job:'tailor',background:'A skilled seamstress who heard RimTown needed her talents.'},
    {name:'鄭強 (Zheng Qiang)',age:35,traits:['stoic','hardworking'],job:'miner',background:'A veteran miner from the region.'},
    {name:'何芳 (He Fang)',age:24,traits:['charismatic','romantic'],job:'cook',background:'An enthusiastic cook with big dreams.'},
    {name:'蔡文 (Cai Wen)',age:42,traits:['creative','neurotic'],job:'researcher',background:'An eccentric scholar drawn by ancient ruins.'},
    {name:'呂嵐 (Lv Lan)',age:29,traits:['shy','early_bird'],job:'carpenter',background:'A quiet carpenter who lets craftsmanship speak.'},
    {name:'丁傑 (Ding Jie)',age:38,traits:['abrasive','hardworking'],job:'blacksmith',background:'A rough-spoken but masterful blacksmith.'},
    {name:'蕭瑜 (Xiao Yu)',age:23,traits:['optimist','gossip'],job:'trader',background:'A young merchant with a knack for bargains.'},
    {name:'唐琳 (Tang Lin)',age:33,traits:['kind','night_owl'],job:'doctor',background:'A compassionate healer who travels where needed.'},
    {name:'曹峰 (Cao Feng)',age:44,traits:['stoic','pessimist'],job:'guard',background:'A seasoned warrior looking for a quieter life.'},
    {name:'邱雅 (Qiu Ya)',age:21,traits:['creative','shy'],job:'tailor',background:'A young artisan with a gift for embroidery.'},
    {name:'范浩 (Fan Hao)',age:36,traits:['lazy','charismatic'],job:'priest',background:'A laid-back spiritual guide.'},
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
        if (roll < 0.10 && this._daysSinceRaid >= 5) return this._triggerRaid(world);
        if (roll < 0.18 && this._daysSinceChain >= 7 && !this._activeChains.length) return this._startEventChain(world);
        if (roll < 0.38) return this._triggerRandomEvent(world);
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        if (roll < 0.43 && this._daysSinceDeparture >= 4 && npcCount > this.TARGET_POPULATION) this._triggerDeparture(world);
        return null;
    }
    _triggerRandomEvent(world) {
        const season = world.clock.season;
        const eligible = EVENT_POOL.filter(e => !e.seasons || e.seasons.includes(season));
        if (!eligible.length) return null;
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
        const guards = Object.values(world.agents).filter(a => a.job?.title==='Guard' && !a.isPlayer);
        const buildingDefense = world.buildings ? (world.buildings.getEffect('defense_bonus',0)||0) : 0;
        const defense = guards.length * 2 + randInt(1,3) + buildingDefense;
        if (defense >= rd.threat_level) {
            world.logMessage('raid', `The town successfully defended against the ${rd.attacker}!`);
            guards.forEach(g => { g.mood = Math.min(100, g.mood+10); g.memory.add(world.tickCount, world.clock.timeStr,'raid',`Helped defend against ${rd.attacker}!`,8); });
        } else {
            world.logMessage('raid', `The ${rd.attacker} overwhelmed our defenses!`);
            // Raiders steal resources
            if (world.stockpile) {
                const stolenFood = Math.min(world.stockpile.get('food'), randInt(10,30));
                const stolenSilver = Math.min(world.stockpile.get('silver'), randInt(5,20));
                if(stolenFood>0) world.stockpile.consume('food',stolenFood,world.tickCount,`stolen by ${rd.attacker}`);
                if(stolenSilver>0) world.stockpile.consume('silver',stolenSilver,world.tickCount,`stolen by ${rd.attacker}`);
                world.logMessage('raid',`The ${rd.attacker} stole ${stolenFood} food and ${stolenSilver} silver!`);
            }
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.job?.title !== 'Guard');
            if (npcs.length && Math.random() < 0.4) {
                const fleeing = pickRandom(npcs);
                this._sendAgentTravelling(world, fleeing, `fled after the ${rd.attacker} attack`, 3);
            }
        }
        return event;
    }
    _startEventChain(world) {
        const season = world.clock.season;
        const eligible = Object.entries(EVENT_CHAINS).filter(([,stages]) => {
            const first = stages[0]; return !first.seasons || first.seasons.includes(season);
        });
        if (!eligible.length) return null;
        const [chainId, stages] = pickRandom(eligible);
        this._daysSinceChain = 0;
        this._activeChains.push({chainId, stage:0, daysUntilNext: stages[0].duration_days||2});
        const first = stages[0];
        const event = {name:first.name,description:first.description,severity:first.severity,effects:first.effects||{},event_type:'chain'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        world.logMessage('chain_event', `Event chain started: ${first.name}`);
        return event;
    }
    _progressChains(world) {
        const completed = [];
        this._activeChains.forEach(chain => {
            chain.daysUntilNext--;
            if (chain.daysUntilNext <= 0) {
                const stages = EVENT_CHAINS[chain.chainId];
                const nextIdx = chain.stage + 1;
                if (nextIdx >= stages.length) { completed.push(chain); world.logMessage('chain_event',`Event chain '${chain.chainId}' has concluded.`); }
                else {
                    const stage = stages[nextIdx];
                    chain.stage = nextIdx; chain.daysUntilNext = stage.duration_days || 2;
                    const event = {name:stage.name,description:stage.description,severity:stage.severity,effects:stage.effects||{},event_type:'chain'};
                    this.eventLog.push([world.clock.timeStr, event]);
                    this._applyEffects(event, world);
                    world.logMessage('chain_event', `[${event.severity.toUpperCase()}] ${event.name}: ${event.description}`);
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
        world.logMessage('departure', `${agent.name} ${reason}. They'll be back in a few days.`, agent.name);
        const event = {name:'Resident Departure',description:`${agent.name} ${reason}.`,severity:'minor',effects:{conversation_topic:`${agent.name} leaving town`},event_type:'departure'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${agent.name} leaving town`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'departure',`${agent.name} ${reason}.`,5,[agent.name]);
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
        world.logMessage('arrival', `${agent.name} has returned from their travels!`, agent.name);
        const event = {name:'Resident Returns',description:`${agent.name} has returned with stories!`,severity:'minor',effects:{mood_all:3,conversation_topic:`${agent.name}'s travel stories`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'arrival',`${agent.name} returned from travelling!`,4,[agent.name]);
        });
    }
    _managePopulation(world) {
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const total = npcCount + this._travellingAgents.length;
        if (total < this.TARGET_POPULATION) {
            for (let i = 0; i < this.TARGET_POPULATION - total; i++) this._spawnImmigrant(world);
        }
    }
    _spawnImmigrant(world) {
        let available = IMMIGRANT_POOL.filter(p => !this._usedImmigrantNames.has(p.name));
        if (!available.length) { this._usedImmigrantNames.clear(); available = [...IMMIGRANT_POOL]; }
        const imm = pickRandom(available);
        this._usedImmigrantNames.add(imm.name);
        const id = `imm_${imm.name.split('(')[1]?.replace(')','').trim().toLowerCase().replace(/\s/g,'_') || randInt(1000,9999)}_${world.tickCount}`;
        const personality = new Personality(imm.traits, imm.background);
        personality.values = shuffle(['family','freedom','knowledge','wealth','power','art','nature','community','adventure','peace']).slice(0, 1+Math.floor(Math.random()*3));
        const job = new Job(imm.job);
        const home = pickRandom(['residential_north','residential_south','residential_east']);
        const agent = new Agent(id, imm.name, imm.age, personality, job, home);
        world.agents[agent.agentId] = agent;
        world.logMessage('immigration', `A new resident arrived: ${agent.name}, a ${job.title}!`, agent.name);
        const event = {name:'New Resident',description:`${agent.name} has arrived as a new ${job.title}!`,severity:'minor',effects:{mood_all:5,conversation_topic:`the new resident ${agent.name}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`the new resident ${agent.name}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'immigration',`A new resident named ${agent.name} arrived!`,5,[agent.name]);
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
const SEASON_FARM_MOD = {spring:1.2,summer:1.5,autumn:0.8,winter:0.2};
const NATURE_GATHERING = {forest:{wood:3},river:{food:2},meadow:{herbs:1,cloth:0.5},cave:{stone:2,metal:1},lake:{food:1.5}};

function processDailyProduction(world) {
    const sp = world.stockpile;
    Object.values(world.agents).forEach(agent => {
        if (agent.isPlayer || !agent.job) return;
        const recipe = JOB_PRODUCTION[agent.job.key]; if (!recipe) return;
        const skill = agent.skills.get(recipe.skill);
        let eff = 0.5 + ((skill?skill.level:0)/20)*2.0;
        if (agent.job.key === 'farmer') eff *= SEASON_FARM_MOD[world.clock.season] || 1;
        eff *= 1 + (agent.mood - 50)/500;
        eff *= 0.9 + Math.random()*0.2;
        let canProduce = true;
        for (const [r,a] of Object.entries(recipe.inputs)) { if (!sp.has(r,a)) { canProduce=false; break; } }
        if (!canProduce) { world.logMessage('economy',`${agent.name} couldn't work - not enough materials!`,agent.name); agent.mood=Math.max(-100,agent.mood-3); return; }
        for (const [r,a] of Object.entries(recipe.inputs)) sp.consume(r,a,world.tickCount,`${agent.name}'s production`,agent.name);
        for (const [r,a] of Object.entries(recipe.outputs)) sp.add(r,Math.round(a*eff*10)/10,world.tickCount,`${agent.name} (${agent.job.title})`,agent.name);
        if (agent.job.key === 'priest') Object.values(world.agents).forEach(o => { if(o.agentId!==agent.agentId) o.mood=Math.min(100,o.mood+1); });
    });
    const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
    if (!sp.consume('meals',1.5*npcCount,world.tickCount,'daily consumption')) {
        const deficit = 1.5*npcCount - sp.get('meals');
        if (sp.consume('food',deficit*2,world.tickCount,'emergency food')) world.logMessage('economy','Not enough meals! Residents eating raw food.');
        else { world.logMessage('economy','FOOD SHORTAGE! Residents are going hungry!'); Object.values(world.agents).forEach(a => { a.mood=Math.max(-100,a.mood-10); a.needs.hunger=Math.max(0,a.needs.hunger-20); }); }
    }
    if (world.townMap) { for (const [locId,gather] of Object.entries(NATURE_GATHERING)) { if (world.townMap.locations[locId]) { for (const [r,a] of Object.entries(gather)) sp.add(r,a*0.5,world.tickCount,`natural (${locId})`); } } }
    sp.consume('tools',npcCount*0.05,world.tickCount,'tool wear');
    sp.consume('clothing',npcCount*0.03,world.tickCount,'clothing wear');
    if (world.clock.season === 'winter' && !sp.consume('wood',npcCount*0.3,world.tickCount,'winter heating')) {
        world.logMessage('economy','Not enough wood for heating!');
        Object.values(world.agents).forEach(a => { a.mood=Math.max(-100,a.mood-8); a.needs.comfort=Math.max(0,a.needs.comfort-15); });
    }
}

// --- Economy: Buildings ---
const BUILDING_TEMPLATES = {
    watchtower:{name:'Watchtower',description:'Improves defense and raid warning',costs:{wood:40,stone:30},work:20,effects:{defense_bonus:3}},
    granary:{name:'Granary',description:'Increases food storage, reduces spoilage',costs:{wood:30,stone:20},work:15,effects:{food_capacity:500}},
    marketplace:{name:'Marketplace',description:'Better trade and more merchants',costs:{wood:25,stone:15,silver:50},work:18,effects:{trade_bonus:0.2,merchant_frequency:1.5}},
    well_upgrade:{name:'Deep Well',description:'Better water supply',costs:{stone:25,tools:3},work:12,effects:{drought_resistance:0.5}},
    training_ground:{name:'Training Ground',description:'Guards train faster',costs:{wood:20,stone:10,tools:2},work:10,effects:{defense_bonus:2}},
    brewery:{name:'Brewery',description:'Produces ale, boosts recreation',costs:{wood:15,metal:5,silver:30},work:14,effects:{recreation_bonus:10}},
    garden:{name:'Herb Garden',description:'Produces herbs for medicine',costs:{wood:10,silver:15},work:8,effects:{herbs_production:2}},
    school:{name:'School',description:'Increases all skill XP gain',costs:{wood:30,stone:20,silver:40},work:22,effects:{xp_bonus:1.2}},
    farm_irrigation:{name:'Farm Irrigation',description:'Better crop yield',costs:{stone:15,wood:10,tools:2},work:12,effects:{farm_bonus:1.3}},
    forge_bellows:{name:'Forge Bellows',description:'Faster metalwork',costs:{metal:10,stone:5},work:10,effects:{smithing_bonus:1.3}},
    clinic_upgrade:{name:'Medical Ward',description:'Better healing',costs:{wood:15,cloth:10,silver:25},work:14,effects:{healing_bonus:1.5}},
    town_walls:{name:'Town Walls',description:'Massive defense boost',costs:{stone:80,wood:30,tools:5},work:40,effects:{defense_bonus:8}},
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
        this.projects.push(p); world.logMessage('building',`Construction started: ${t.name}!`); return p;
    }
    dailyConstruction(world) {
        const done=[];
        this.projects.forEach(p => {
            if(p.status!=='building') return;
            Object.values(world.agents).forEach(a => {
                if(a.isPlayer||!a.job) return;
                if(['Carpenter','Miner','Blacksmith'].includes(a.job.title)) { const sk=a.skills.get('construction'); p.workDone+=1+Math.floor((sk?sk.level:0)/5); }
            });
            if(p.workDone>=p.workRequired) { p.status='complete'; done.push(p); }
        });
        done.forEach(p => {
            this.projects=this.projects.filter(x=>x!==p); this.completed.push(p);
            Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
            world.logMessage('building',`Construction complete: ${p.name}!`);
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
        if (this.merchant) { this.merchant.daysRemaining--; if(this.merchant.daysRemaining<=0){ world.logMessage('trade',`Merchant ${this.merchant.name} has departed.`); this.merchant=null; } return; }
        const freq=world.buildings.getEffect('merchant_frequency',1);
        const chance=Math.min(0.6, 0.15*freq+(this._daysSince-3)*0.05);
        if(Math.random()<chance) this._spawnMerchant(world);
    }
    _spawnMerchant(world) {
        this._daysSince=0;
        const mt=pickRandom(MERCHANT_TYPES);
        const tradeBonus=world.buildings.getEffect('trade_bonus',0);
        const offers=[];
        mt.sells.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(10,30),price:Math.round(bp*(1.2+Math.random()*0.6)*(1-tradeBonus)*10)/10,isBuying:false}); });
        mt.buys.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(15,40),price:Math.round(bp*(0.5+Math.random()*0.3)*(1+tradeBonus)*10)/10,isBuying:true}); });
        this.merchant={name:pickRandom(mt.names),specialty:mt.specialty,offers,daysRemaining:randInt(2,4)};
        world.logMessage('trade',`Merchant ${this.merchant.name} has arrived! Specializes in ${mt.specialty}.`);
    }
    executeTrade(offerIdx, qty, world) {
        if(!this.merchant) return {error:'No merchant'};
        const offer=this.merchant.offers[offerIdx]; if(!offer) return {error:'Invalid offer'};
        qty=Math.min(qty,offer.amount); if(qty<=0) return {error:'Invalid quantity'};
        const total=qty*offer.price;
        if(offer.isBuying) {
            if(!world.stockpile.has(offer.resource,qty)) return {error:`Not enough ${offer.resource}`};
            world.stockpile.consume(offer.resource,qty,world.tickCount,`Sold to ${this.merchant.name}`);
            world.stockpile.add('silver',total,world.tickCount,`Trade with ${this.merchant.name}`);
        } else {
            if(!world.stockpile.has('silver',total)) return {error:'Not enough silver'};
            world.stockpile.consume('silver',total,world.tickCount,`Bought from ${this.merchant.name}`);
            world.stockpile.add(offer.resource,qty,world.tickCount,`Trade with ${this.merchant.name}`);
        }
        offer.amount-=qty;
        this.merchant.offers=this.merchant.offers.filter(o=>o.amount>0.5);
        world.logMessage('trade',`${offer.isBuying?'Sold':'Bought'} ${qty} ${offer.resource} for ${Math.round(total)} silver.`);
        return {ok:true};
    }
    toDict() { return {merchant:this.merchant,days_since_merchant:this._daysSince}; }
}

// --- Economy: Research ---
const RESEARCH_TREE = {
    agriculture:{name:'Advanced Agriculture',description:'Better farming (+30% food)',cost:50,prerequisites:[],effects:{farm_bonus:1.3},unlocks:['farm_irrigation','garden']},
    metallurgy:{name:'Metallurgy',description:'Better metal smelting',cost:60,prerequisites:[],effects:{smithing_bonus:1.2},unlocks:['forge_bellows']},
    medicine_research:{name:'Herbal Medicine',description:'Better healing herbs',cost:55,prerequisites:[],effects:{healing_bonus:1.3},unlocks:['clinic_upgrade','garden']},
    fortification:{name:'Fortification',description:'Defensive structures',cost:70,prerequisites:[],effects:{defense_bonus:2},unlocks:['watchtower','training_ground','town_walls']},
    commerce:{name:'Commerce',description:'Better trade practices',cost:45,prerequisites:[],effects:{trade_bonus:0.15},unlocks:['marketplace']},
    architecture:{name:'Architecture',description:'Advanced building',cost:65,prerequisites:['metallurgy'],effects:{build_speed:1.3},unlocks:['school','town_walls']},
    brewing:{name:'Brewing',description:'Art of fermentation',cost:35,prerequisites:['agriculture'],effects:{recreation_bonus:5},unlocks:['brewery']},
    logistics:{name:'Logistics',description:'Better storage',cost:50,prerequisites:['commerce'],effects:{storage_bonus:1.5},unlocks:['granary']},
    education:{name:'Education',description:'Formal education (+15% XP)',cost:80,prerequisites:['architecture'],effects:{xp_bonus:1.15},unlocks:['school']},
    masonry:{name:'Masonry',description:'Advanced stonework',cost:55,prerequisites:['fortification'],effects:{stone_efficiency:1.3},unlocks:['town_walls','well_upgrade']},
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
            world.logMessage('research',`Research complete: ${p.name}!`);
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
