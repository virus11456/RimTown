// ============================================================
// RimTown - Industry System (四大產業 + 城鎮等級)
// ============================================================

const INDUSTRIES = {
    lumber: {
        name: '伐木業', icon: '🪓', npcJob: 'carpenter',
        resource: 'wood',
        description: '砍伐樹木，生產木材。木材是建築和家具的基礎。',
        levels: [
            { lv:1, name:'伐木小屋',   cost:{silver:0},                        output:{wood:15},                          bonus:'基礎伐木',        workers:1 },
            { lv:2, name:'伐木場',     cost:{silver:50, stone:20},             output:{wood:25},                          bonus:'解鎖硬木採集',     workers:2 },
            { lv:3, name:'製材所',     cost:{silver:120, stone:40, metal:10},  output:{wood:40, plank:8},                 bonus:'原木→木板加工',   workers:3 },
            { lv:4, name:'林業公司',   cost:{silver:250, stone:60, metal:20},  output:{wood:60, plank:15, hardwood:5},    bonus:'稀有木材',        workers:4 },
            { lv:5, name:'木材帝國',   cost:{silver:500, stone:80, metal:40},  output:{wood:80, plank:25, hardwood:12},   bonus:'出口木材',        workers:5 },
        ],
    },
    quarry: {
        name: '採石業', icon: '⛏️', npcJob: 'miner',
        resource: 'stone',
        description: '開採石材，是建築城牆和高級建築的基礎。',
        levels: [
            { lv:1, name:'採石小坑',   cost:{silver:0},                        output:{stone:12},                         bonus:'基礎採石',        workers:1 },
            { lv:2, name:'採石場',     cost:{silver:60, wood:25},              output:{stone:20},                         bonus:'解鎖花崗岩',      workers:2 },
            { lv:3, name:'石材工坊',   cost:{silver:150, wood:40, metal:15},   output:{stone:35, brick:6},                bonus:'石頭→磚塊加工',  workers:3 },
            { lv:4, name:'大型礦場',   cost:{silver:300, wood:50, metal:30},   output:{stone:50, brick:12, marble:3},     bonus:'大理石開採',      workers:4 },
            { lv:5, name:'石材帝國',   cost:{silver:600, wood:60, metal:50},   output:{stone:70, brick:20, marble:8},     bonus:'出口石材',        workers:5 },
        ],
    },
    farming: {
        name: '農業', icon: '🌾', npcJob: 'farmer',
        resource: 'food',
        description: '種植作物，生產食物和經濟作物。養活全鎮的基礎。',
        levels: [
            { lv:1, name:'小農田',     cost:{silver:0},                        output:{food:15},                          bonus:'基礎作物',        workers:1, plots:4  },
            { lv:2, name:'農莊',       cost:{silver:50, wood:30},              output:{food:25},                          bonus:'解鎖更多作物',    workers:2, plots:8  },
            { lv:3, name:'灌溉農場',   cost:{silver:130, wood:40, stone:20},   output:{food:40},                          bonus:'灌溉 +30%',      workers:3, plots:12 },
            { lv:4, name:'大型農莊',   cost:{silver:280, wood:50, stone:30},   output:{food:60},                          bonus:'高級經濟作物',    workers:4, plots:16 },
            { lv:5, name:'農業帝國',   cost:{silver:550, wood:60, stone:40},   output:{food:80},                          bonus:'出口 + 品種改良', workers:5, plots:20 },
        ],
    },
    mining: {
        name: '礦業', icon: '⚒️', npcJob: 'blacksmith',
        resource: 'metal',
        description: '開採礦石，冶煉金屬。工具和武器的來源。',
        levels: [
            { lv:1, name:'小礦坑',     cost:{silver:0},                        output:{metal:8},                          bonus:'基礎鐵礦',       workers:1 },
            { lv:2, name:'礦場',       cost:{silver:70, wood:30},              output:{metal:15},                         bonus:'解鎖銅礦',       workers:2 },
            { lv:3, name:'冶煉廠',     cost:{silver:160, wood:35, stone:25},   output:{metal:25, steel:4},                bonus:'鐵→鋼加工',     workers:3 },
            { lv:4, name:'大型礦業',   cost:{silver:320, wood:40, stone:40},   output:{metal:40, steel:10, gold:2},       bonus:'金礦開採',       workers:4 },
            { lv:5, name:'礦業帝國',   cost:{silver:650, wood:50, stone:50},   output:{metal:60, steel:18, gold:5},       bonus:'出口金屬',       workers:5 },
        ],
    },
};

const TOWN_LEVELS = [
    { lv:1, name:'荒村',   population:0,  buildings:0,  unlockSlots:1 },
    { lv:2, name:'小村',   population:10, buildings:3,  unlockSlots:1 },
    { lv:3, name:'村莊',   population:15, buildings:5,  unlockSlots:2 },
    { lv:4, name:'小鎮',   population:20, buildings:8,  unlockSlots:2 },
    { lv:5, name:'城鎮',   population:25, buildings:12, unlockSlots:3 },
    { lv:6, name:'大城鎮', population:30, buildings:15, unlockSlots:3 },
    { lv:7, name:'城市',   population:35, buildings:18, unlockSlots:4 },
];

// Industry synergy combos
const INDUSTRY_SYNERGIES = [
    { keys:['lumber','farming'],  name:'農林複合', icon:'🌳', effects:{farm_bonus:0.15} },
    { keys:['lumber','quarry'],   name:'營建雙雄', icon:'🏗️', effects:{build_speed:0.25} },
    { keys:['lumber','mining'],   name:'工業基礎', icon:'🔨', effects:{tool_bonus:0.20} },
    { keys:['quarry','mining'],   name:'地下霸主', icon:'⛰️', effects:{gather_bonus:0.20} },
    { keys:['quarry','farming'],  name:'基建農業', icon:'🏠', effects:{storage_bonus:0.30} },
    { keys:['farming','mining'],  name:'自給自足', icon:'🍚', effects:{food_save:0.15} },
    // Triple combos
    { keys:['lumber','quarry','mining'],  name:'工業強鎮', icon:'🏭', effects:{build_cost:-0.20} },
    { keys:['lumber','quarry','farming'], name:'資源大鎮', icon:'📦', effects:{merchant_frequency:0.50} },
    { keys:['farming','mining','lumber'], name:'均衡發展', icon:'⚖️', effects:{mood_bonus:10} },
    // All four
    { keys:['lumber','quarry','farming','mining'], name:'完全體', icon:'👑', effects:{all_bonus:0.10} },
];

class IndustryManager {
    constructor() {
        this.townLevel = 1;
        this.townLevelName = '荒村';
        this.industries = {};       // { lumber: { key, level, workers:[], dailyOutput:{} }, ... }
        this.maxIndustries = 1;
        this.firstChoice = null;
        this.needsIndustryChoice = true;  // Show selection modal on first run
        this._pendingUnlock = false;       // Flag for when a new slot opens
        this.activeSynergies = [];
    }

    chooseIndustry(key) {
        if (this.industries[key]) return false;
        if (Object.keys(this.industries).length >= this.maxIndustries) return false;
        if (!INDUSTRIES[key]) return false;
        if (!this.firstChoice) this.firstChoice = key;
        this.industries[key] = { key, level: 1, workers: [], dailyOutput: {} };
        this.needsIndustryChoice = false;
        this._pendingUnlock = false;
        this._updateSynergies();
        return true;
    }

    upgradeIndustry(key, world) {
        const ind = this.industries[key];
        if (!ind) return { ok: false, error: '未擁有此產業' };
        const def = INDUSTRIES[key];
        const nextLevelDef = def.levels.find(l => l.lv === ind.level + 1);
        if (!nextLevelDef) return { ok: false, error: '已達最高等級' };
        if (!world.stockpile.canAfford(nextLevelDef.cost)) return { ok: false, error: '資源不足' };
        world.stockpile.pay(nextLevelDef.cost, world.tickCount, `${def.name}升級到 Lv${nextLevelDef.lv}`);
        ind.level = nextLevelDef.lv;
        world.logMessage('industry', `${def.icon} ${def.name}升級到 Lv${nextLevelDef.lv}「${nextLevelDef.name}」！`);

        // Notify daily news if available
        if (world.dailyNews) {
            world.dailyNews.collectEvent('industry', `${def.name}升級到了「${nextLevelDef.name}」！`, 6);
        }
        return { ok: true };
    }

    getCurrentLevel(key) {
        const ind = this.industries[key];
        if (!ind) return null;
        return INDUSTRIES[key].levels.find(l => l.lv === ind.level);
    }

    getNextLevel(key) {
        const ind = this.industries[key];
        if (!ind) return null;
        return INDUSTRIES[key].levels.find(l => l.lv === ind.level + 1) || null;
    }

    getAvailableIndustries() {
        return Object.keys(INDUSTRIES).filter(k => !this.industries[k]);
    }

    canUnlockNew() {
        return Object.keys(this.industries).length < this.maxIndustries;
    }

    // Daily production from all industries
    dailyUpdate(world) {
        this._checkTownLevelUp(world);

        // Industry production
        for (const [key, ind] of Object.entries(this.industries)) {
            const def = INDUSTRIES[key];
            const levelDef = def.levels.find(l => l.lv === ind.level);
            if (!levelDef) continue;

            // Count workers of the right job type
            const workers = Object.values(world.agents).filter(a =>
                !a.isPlayer && a.job?.key === def.npcJob &&
                (!a.status || a.status === 'normal')
            );
            const workerCount = Math.min(workers.length, levelDef.workers);
            const efficiency = workerCount > 0 ? workerCount / levelDef.workers : 0.3; // Min 30% even with no workers

            // Apply synergy bonuses
            let synergyMult = 1;
            for (const syn of this.activeSynergies) {
                if (syn.effects.all_bonus) synergyMult += syn.effects.all_bonus;
                if (key === 'farming' && syn.effects.farm_bonus) synergyMult += syn.effects.farm_bonus;
                if (key === 'mining' && syn.effects.gather_bonus) synergyMult += syn.effects.gather_bonus;
            }

            // Produce resources
            ind.dailyOutput = {};
            for (const [resource, amount] of Object.entries(levelDef.output)) {
                const produced = Math.round(amount * efficiency * synergyMult * 10) / 10;
                world.stockpile.add(resource, produced, world.tickCount, `${def.name} Lv${ind.level}`, def.name);
                ind.dailyOutput[resource] = produced;
            }
        }
    }

    _checkTownLevelUp(world) {
        const pop = Object.keys(world.agents).length;
        const builds = world.buildings.completed.length;

        for (const tl of TOWN_LEVELS) {
            if (tl.lv > this.townLevel && pop >= tl.population && builds >= tl.buildings) {
                this.townLevel = tl.lv;
                this.townLevelName = tl.name;
                this.maxIndustries = tl.unlockSlots;
                world.logMessage('town', `🎉 城鎮升級為「${tl.name}」！(Lv${tl.lv})`);

                if (this.canUnlockNew()) {
                    this._pendingUnlock = true;
                    world.logMessage('town', `💡 可以開啟新產業了！(${Object.keys(this.industries).length}/${this.maxIndustries})`);
                }

                if (world.dailyNews) {
                    world.dailyNews.collectEvent('town', `城鎮升級為「${tl.name}」！`, 8);
                }
            }
        }
    }

    _updateSynergies() {
        const ownedKeys = Object.keys(this.industries);
        this.activeSynergies = INDUSTRY_SYNERGIES.filter(syn =>
            syn.keys.every(k => ownedKeys.includes(k))
        );
    }

    toDict() {
        return {
            townLevel: this.townLevel,
            townLevelName: this.townLevelName,
            industries: JSON.parse(JSON.stringify(this.industries)),
            maxIndustries: this.maxIndustries,
            firstChoice: this.firstChoice,
            needsIndustryChoice: this.needsIndustryChoice,
            _pendingUnlock: this._pendingUnlock,
            activeSynergies: this.activeSynergies.map(s => ({ name: s.name, icon: s.icon })),
        };
    }

    serialize() {
        return {
            townLevel: this.townLevel,
            townLevelName: this.townLevelName,
            industries: JSON.parse(JSON.stringify(this.industries)),
            maxIndustries: this.maxIndustries,
            firstChoice: this.firstChoice,
            needsIndustryChoice: this.needsIndustryChoice,
            _pendingUnlock: this._pendingUnlock,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.townLevel = data.townLevel || 1;
        this.townLevelName = data.townLevelName || '荒村';
        this.industries = data.industries || {};
        this.maxIndustries = data.maxIndustries || 1;
        this.firstChoice = data.firstChoice || null;
        this.needsIndustryChoice = data.needsIndustryChoice ?? (Object.keys(this.industries).length === 0);
        this._pendingUnlock = data._pendingUnlock || false;
        this._updateSynergies();
    }
}
