// ============================================================
// RimTown - Main Quest System (主線任務系統)
// ============================================================

const MAIN_QUESTS = [
    // === Chapter 1: Arrival & Survival ===
    {
        id: 'ch1_settle',
        chapter: 1,
        title: '落腳邊境',
        description: '你剛抵達這個偏遠的小鎮。先和鎮上的居民聊聊天，了解這裡的狀況。',
        objectives: [
            { id: 'talk_3', type: 'chat_count', target: 3, label: '和 3 位居民交談', progress: 0 },
        ],
        rewards: { silver: 20 },
        unlocks: 'ch1_food',
        onComplete: '鎮民們開始接受你的存在了。',
    },
    {
        id: 'ch1_food',
        chapter: 1,
        title: '溫飽問題',
        description: '鎮上的糧食供應不太穩定。幫忙確保食物充足。',
        objectives: [
            { id: 'food_50', type: 'resource_reach', resource: 'food', target: 50, label: '累積 50 單位食物', progress: 0 },
        ],
        rewards: { silver: 30 },
        unlocks: 'ch1_industry',
        onComplete: '有了充足的糧食，鎮民們總算安心了。',
    },
    {
        id: 'ch1_industry',
        chapter: 1,
        title: '發展的第一步',
        description: '小鎮需要產業才能自給自足。選擇並開啟你的第一個產業。',
        objectives: [
            { id: 'open_industry', type: 'industry_count', target: 1, label: '開啟第一個產業', progress: 0 },
        ],
        rewards: { silver: 50 },
        unlocks: 'ch2_build',
        onComplete: '產業開始運轉，這只是發展的開始。',
    },

    // === Chapter 2: Growth ===
    {
        id: 'ch2_build',
        chapter: 2,
        title: '建設城鎮',
        description: '居民們需要更好的設施。建造一些公共建築來改善生活品質。',
        objectives: [
            { id: 'build_3', type: 'building_count', target: 3, label: '完成 3 座建築', progress: 0 },
        ],
        rewards: { silver: 80, wood: 30 },
        unlocks: 'ch2_pop',
        onComplete: '新的建築讓小鎮看起來更像樣了。',
    },
    {
        id: 'ch2_pop',
        chapter: 2,
        title: '人口增長',
        description: '要讓小鎮繁榮，需要更多居民。確保大家心情愉快以吸引新住民。',
        objectives: [
            { id: 'pop_15', type: 'population', target: 15, label: '人口達到 15 人', progress: 0 },
        ],
        rewards: { silver: 100 },
        unlocks: 'ch2_farm',
        onComplete: '越來越多人選擇定居在這裡。',
    },
    {
        id: 'ch2_farm',
        chapter: 2,
        title: '農耕之道',
        description: '開啟農業產業，種植作物，完成你的第一次收穫。',
        objectives: [
            { id: 'start_farming', type: 'industry_specific', industry: 'farming', label: '開啟農業產業', progress: 0 },
            { id: 'harvest_1', type: 'harvest_count', target: 1, label: '完成第一次收穫', progress: 0 },
        ],
        rewards: { silver: 60, food: 30 },
        unlocks: 'ch3_trade',
        onComplete: '第一次豐收！農民們歡天喜地。',
    },

    // === Chapter 3: Prosperity ===
    {
        id: 'ch3_trade',
        chapter: 3,
        title: '商業往來',
        description: '與來訪的商人進行交易，讓小鎮的經濟更活絡。',
        objectives: [
            { id: 'trade_5', type: 'trade_count', target: 5, label: '完成 5 次交易', progress: 0 },
        ],
        rewards: { silver: 150 },
        unlocks: 'ch3_factory',
        onComplete: '商人們開始把邊境鎮列入固定路線了。',
    },
    {
        id: 'ch3_factory',
        chapter: 3,
        title: '加工產業',
        description: '建造一座工廠，開始將原料加工成更有價值的商品。',
        objectives: [
            { id: 'build_factory', type: 'factory_count', target: 1, label: '建造並啟用一座工廠', progress: 0 },
        ],
        rewards: { silver: 120, metal: 20 },
        unlocks: 'ch3_townlv',
        onComplete: '工廠的煙囪冒出了第一縷煙。',
    },
    {
        id: 'ch3_townlv',
        chapter: 3,
        title: '城鎮升格',
        description: '持續發展，讓城鎮等級提升到「小鎮」。',
        objectives: [
            { id: 'town_lv4', type: 'town_level', target: 4, label: '城鎮等級達到 Lv4（小鎮）', progress: 0 },
        ],
        rewards: { silver: 200, stone: 40 },
        unlocks: 'ch4_election',
        onComplete: '邊境鎮正式成為「小鎮」！周邊地區開始注意到這裡的發展。',
    },

    // === Chapter 4: Community ===
    {
        id: 'ch4_election',
        chapter: 4,
        title: '民主之聲',
        description: '小鎮已經大到需要正式的領導人了。參與或見證第一次選舉。',
        objectives: [
            { id: 'election_1', type: 'election_count', target: 1, label: '經歷一次選舉', progress: 0 },
        ],
        rewards: { silver: 100 },
        unlocks: 'ch4_friendship',
        onComplete: '第一任鎮長誕生了！',
    },
    {
        id: 'ch4_friendship',
        chapter: 4,
        title: '深厚羈絆',
        description: '與一位居民建立深厚的友誼關係。',
        objectives: [
            { id: 'friend_60', type: 'max_affinity', target: 60, label: '與某位居民好感度達到 60', progress: 0 },
        ],
        rewards: { silver: 80 },
        unlocks: 'ch4_defense',
        onComplete: '你在這裡找到了真正的朋友。',
    },
    {
        id: 'ch4_defense',
        chapter: 4,
        title: '守護家園',
        description: '邊境並不安全。成功抵禦一次外敵入侵。',
        objectives: [
            { id: 'defend_1', type: 'raid_survived', target: 1, label: '成功抵禦一次入侵', progress: 0 },
        ],
        rewards: { silver: 200, metal: 30 },
        unlocks: 'ch5_prosper',
        onComplete: '鎮民們團結一心擊退了入侵者。這裡就是你們的家。',
    },

    // === Chapter 5: Legacy ===
    {
        id: 'ch5_prosper',
        chapter: 5,
        title: '繁榮之鎮',
        description: '讓小鎮成為一個真正繁榮的城鎮。累積充足的財富和資源。',
        objectives: [
            { id: 'silver_500', type: 'resource_reach', resource: 'silver', target: 500, label: '累積 500 銀幣', progress: 0 },
            { id: 'pop_25', type: 'population', target: 25, label: '人口達到 25 人', progress: 0 },
        ],
        rewards: { silver: 500 },
        unlocks: null,
        onComplete: '邊境鎮已經成為遠近聞名的繁榮之地。你的傳奇故事將被世世代代傳頌。',
    },
];

const CHAPTER_NAMES = {
    1: '第一章：落腳',
    2: '第二章：成長',
    3: '第三章：繁榮',
    4: '第四章：社群',
    5: '第五章：傳承',
};

class QuestSystem {
    constructor() {
        this.quests = {};        // { questId: { status: 'locked'|'active'|'completed', objectives: {...} } }
        this.completedOrder = []; // IDs in completion order
        this.tradeCount = 0;
        this.harvestCount = 0;
        this.chatCount = 0;
        this.raidsSurvived = 0;
        this.electionsHeld = 0;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        // Initialize quest states
        for (const q of MAIN_QUESTS) {
            if (this.quests[q.id]) continue;
            this.quests[q.id] = {
                status: q.id === 'ch1_settle' ? 'active' : 'locked',
                objectives: {},
            };
            for (const obj of q.objectives) {
                this.quests[q.id].objectives[obj.id] = { progress: 0, completed: false };
            }
        }
    }

    // Called every tick to check objective progress
    checkProgress(world) {
        this.init();
        for (const questDef of MAIN_QUESTS) {
            const quest = this.quests[questDef.id];
            if (!quest || quest.status !== 'active') continue;

            let allDone = true;
            for (const objDef of questDef.objectives) {
                const obj = quest.objectives[objDef.id];
                if (obj.completed) continue;

                let current = 0;
                switch (objDef.type) {
                    case 'chat_count':
                        current = this.chatCount;
                        break;
                    case 'resource_reach':
                        current = world.stockpile?.get?.(objDef.resource) || 0;
                        break;
                    case 'industry_count':
                        current = Object.keys(world.industry?.industries || {}).length;
                        break;
                    case 'industry_specific':
                        current = world.industry?.industries?.[objDef.industry] ? 1 : 0;
                        break;
                    case 'building_count':
                        current = (world.buildings?.completed?.length || 0);
                        break;
                    case 'population':
                        current = Object.keys(world.agents || {}).length;
                        break;
                    case 'harvest_count':
                        current = this.harvestCount;
                        break;
                    case 'trade_count':
                        current = this.tradeCount;
                        break;
                    case 'factory_count':
                        current = Object.values(world.processing?.builtFactories || {}).filter(f => f.status === 'active').length;
                        break;
                    case 'town_level':
                        current = world.industry?.townLevel || 1;
                        break;
                    case 'election_count':
                        current = this.electionsHeld;
                        break;
                    case 'max_affinity': {
                        const player = world.agents?.player;
                        if (player?.relationships?.relationships) {
                            current = Math.max(0, ...Object.values(player.relationships.relationships).map(r => r.affinity || 0));
                        }
                        break;
                    }
                    case 'raid_survived':
                        current = this.raidsSurvived;
                        break;
                }

                obj.progress = Math.min(current, objDef.target);
                if (obj.progress >= objDef.target) {
                    obj.completed = true;
                } else {
                    allDone = false;
                }
            }

            // Complete quest if all objectives done
            if (allDone) {
                this._completeQuest(questDef, world);
            }
        }
    }

    _completeQuest(questDef, world) {
        const quest = this.quests[questDef.id];
        quest.status = 'completed';
        this.completedOrder.push(questDef.id);

        // Give rewards
        if (questDef.rewards) {
            for (const [res, amount] of Object.entries(questDef.rewards)) {
                world.stockpile?.add?.(res, amount, world.tickCount, `任務獎勵：${questDef.title}`);
            }
        }

        // Log
        world.logMessage?.('quest', `⚔️ 主線任務完成：「${questDef.title}」！${questDef.onComplete}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `主線任務「${questDef.title}」完成！${questDef.onComplete}`, 8);
        }

        // Unlock next quest
        if (questDef.unlocks) {
            const next = this.quests[questDef.unlocks];
            if (next && next.status === 'locked') {
                next.status = 'active';
                const nextDef = MAIN_QUESTS.find(q => q.id === questDef.unlocks);
                if (nextDef) {
                    world.logMessage?.('quest', `📜 新任務解鎖：「${nextDef.title}」`);
                }
            }
        }
    }

    // Event hooks - called from other systems
    onChat() { this.chatCount++; }
    onTrade() { this.tradeCount++; }
    onHarvest() { this.harvestCount++; }
    onRaidSurvived() { this.raidsSurvived++; }
    onElection() { this.electionsHeld++; }

    // Get current active quest for display
    getActiveQuests() {
        return MAIN_QUESTS.filter(q => this.quests[q.id]?.status === 'active');
    }

    getCompletedQuests() {
        return this.completedOrder.map(id => MAIN_QUESTS.find(q => q.id === id)).filter(Boolean);
    }

    getCurrentChapter() {
        const active = this.getActiveQuests();
        if (active.length > 0) return active[0].chapter;
        const completed = this.getCompletedQuests();
        if (completed.length > 0) return completed[completed.length - 1].chapter;
        return 1;
    }

    toDict() {
        const active = this.getActiveQuests();
        const result = {
            quests: {},
            currentChapter: this.getCurrentChapter(),
            activeCount: active.length,
            completedCount: this.completedOrder.length,
            totalCount: MAIN_QUESTS.length,
        };
        // Include active and recently completed quests with full data
        for (const questDef of MAIN_QUESTS) {
            const quest = this.quests[questDef.id];
            if (!quest) continue;
            result.quests[questDef.id] = {
                ...questDef,
                status: quest.status,
                objectives: questDef.objectives.map(objDef => ({
                    ...objDef,
                    progress: quest.objectives[objDef.id]?.progress || 0,
                    completed: quest.objectives[objDef.id]?.completed || false,
                })),
            };
        }
        return result;
    }

    serialize() {
        return {
            quests: JSON.parse(JSON.stringify(this.quests)),
            completedOrder: [...this.completedOrder],
            tradeCount: this.tradeCount,
            harvestCount: this.harvestCount,
            chatCount: this.chatCount,
            raidsSurvived: this.raidsSurvived,
            electionsHeld: this.electionsHeld,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.quests = data.quests || {};
        this.completedOrder = data.completedOrder || [];
        this.tradeCount = data.tradeCount || 0;
        this.harvestCount = data.harvestCount || 0;
        this.chatCount = data.chatCount || 0;
        this.raidsSurvived = data.raidsSurvived || 0;
        this.electionsHeld = data.electionsHeld || 0;
        this._initialized = Object.keys(this.quests).length > 0;
    }
}
