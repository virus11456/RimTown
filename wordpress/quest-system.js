// ============================================================
// RimTown - Main Quest System v2 (主線任務系統 — 多路線版)
// ============================================================
// 升級重點：每個任務支援多條完成路線（搜集/社交/建設）
// 任何一條路線完成即可過關，NPC 好感度直接影響任務進展

const CHAPTER_NAMES = {
    1: '第一章：落腳',
    2: '第二章：紮根',
    3: '第三章：風暴',
    4: '第四章：繁榮',
    5: '第五章：傳承',
};

// ============================================================
// 主線任務定義 — 多路線版
// ============================================================
// routes: 多條路線，任一完成即過關
// objectives: 傳統單路線（向後兼容）
// npcHints: NPC 在對話中可根據好感度給提示
// ============================================================

const MAIN_QUESTS = [
    // ===================== 第一章：落腳 =====================
    {
        id: 'ch1_settle',
        chapter: 1,
        title: '落腳邊境',
        description: '你剛抵達這個偏遠的小鎮。先和鎮上的居民聊聊天，了解這裡的狀況。',
        objectives: [
            { id: 'talk_3', type: 'chat_count', target: 3, label: '和 3 位居民交談' },
        ],
        rewards: { silver: 20, reputation: 5 },
        unlocks: ['ch1_survive'],
        onComplete: '鎮民們開始接受你的存在了。',
        npcHints: {
            chen_wei: { minAffinity: 0, hint: '你是新來的吧？去跟大家聊聊，認識一下這裡的人。' },
        },
    },
    {
        id: 'ch1_survive',
        chapter: 1,
        title: '度過寒冬',
        description: '第一個冬天即將來臨。你得想辦法讓小鎮撐過去——方法不只一種。',
        routes: [
            {
                id: 'gather', label: '搜集路線', icon: '📦',
                description: '靠囤積物資硬撐過去。',
                conditions: [
                    { type: 'resource', resource: 'food', target: 100, label: '儲備 100 食物' },
                    { type: 'resource', resource: 'wood', target: 80, label: '儲備 80 木材' },
                ],
            },
            {
                id: 'social', label: '社交路線', icon: '💬',
                description: '說服林美教你草藥知識，用智慧過冬。',
                conditions: [
                    { type: 'npc_affinity', npcId: 'lin_mei', target: 40, label: '林美好感度達到 40' },
                    { type: 'chat_count', target: 8, label: '與居民交談 8 次' },
                ],
            },
            {
                id: 'build', label: '建設路線', icon: '🏗️',
                description: '建造基礎設施來抵禦寒冬。',
                conditions: [
                    { type: 'building_count', target: 2, label: '完成 2 座建築' },
                    { type: 'industry_count', target: 1, label: '開啟 1 個產業' },
                ],
            },
        ],
        rewards: { silver: 50, reputation: 10 },
        unlocks: ['ch1_industry'],
        onComplete: '小鎮平安度過了第一個冬天！你的努力沒有白費。',
        npcHints: {
            chen_wei: { minAffinity: 0, hint: '冬天快到了，得做點準備。你可以多囤點物資，或者找林醫生聊聊。' },
            lin_mei: { minAffinity: 20, hint: '如果你有興趣，我可以教你一些草藥的知識...對過冬很有幫助。' },
            liu_jun: { minAffinity: 15, hint: '你要是能幫我找些種子，我教你怎麼種東西。' },
            wu_da: { minAffinity: 10, hint: '木材的事找我就對了，不過你得先讓我看看你的誠意。' },
        },
    },
    {
        id: 'ch1_industry',
        chapter: 1,
        title: '發展的第一步',
        description: '有了基本生存條件，是時候考慮長遠發展了。',
        routes: [
            {
                id: 'standard', label: '產業路線', icon: '🏭',
                description: '開啟產業，建立經濟基礎。',
                conditions: [
                    { type: 'industry_count', target: 1, label: '開啟第一個產業' },
                ],
            },
            {
                id: 'social', label: '人脈路線', icon: '🤝',
                description: '靠人脈和好名聲推動發展。',
                conditions: [
                    { type: 'avg_affinity', target: 20, label: '全鎮平均好感度達到 20' },
                    { type: 'chat_count', target: 15, label: '與居民交談 15 次' },
                ],
            },
        ],
        rewards: { silver: 50, reputation: 10 },
        unlocks: ['ch2_economy'],
        onComplete: '產業開始運轉，你正式成為鎮上不可或缺的一份子。',
        npcHints: {
            zhao_xia: { minAffinity: 10, hint: '想賺錢的話，先選個產業做起來。我看好農業或伐木。' },
        },
    },

    // ===================== 第二章：紮根 =====================
    {
        id: 'ch2_economy',
        chapter: 2,
        title: '穩定經濟',
        description: '小鎮需要一個穩定的經濟體系才能長久。',
        routes: [
            {
                id: 'trade', label: '經營路線', icon: '💰',
                description: '透過貿易和產業建立經濟。',
                conditions: [
                    { type: 'trade_count', target: 3, label: '完成 3 次交易' },
                    { type: 'resource', resource: 'silver', target: 100, label: '累積 100 銀幣' },
                ],
            },
            {
                id: 'social', label: '社交路線', icon: '💬',
                description: '與多位 NPC 建立友誼，互助共榮。',
                conditions: [
                    { type: 'friends_count', target: 3, label: '與 3 位 NPC 達到「朋友」關係' },
                ],
            },
            {
                id: 'build', label: '建設路線', icon: '🏗️',
                description: '大興土木，用建設帶動經濟。',
                conditions: [
                    { type: 'building_count', target: 5, label: '完成 5 座建築' },
                    { type: 'population', target: 12, label: '人口達到 12 人' },
                ],
            },
        ],
        rewards: { silver: 100, reputation: 15 },
        unlocks: ['ch2_farm'],
        onComplete: '小鎮的經濟開始走上正軌了。',
        npcHints: {
            zhao_xia: { minAffinity: 20, hint: '我認識幾個商人，如果你跟我關係好，我可以幫你牽線。' },
            liu_jun: { minAffinity: 15, hint: '經濟不好的時候，農業最靠譜。我可以幫忙。' },
        },
    },
    {
        id: 'ch2_farm',
        chapter: 2,
        title: '農耕之道',
        description: '民以食為天。建立農場，讓小鎮自給自足。',
        routes: [
            {
                id: 'farm', label: '務農路線', icon: '🌾',
                description: '親自種植作物，完成收穫。',
                conditions: [
                    { type: 'industry_specific', industry: 'farming', label: '開啟農業產業' },
                    { type: 'harvest_count', target: 3, label: '完成 3 次收穫' },
                ],
            },
            {
                id: 'social', label: '拜師路線', icon: '👨‍🌾',
                description: '跟劉俊學種田，事半功倍。',
                conditions: [
                    { type: 'npc_affinity', npcId: 'liu_jun', target: 40, label: '劉俊好感度達到 40' },
                    { type: 'harvest_count', target: 1, label: '完成 1 次收穫' },
                ],
            },
        ],
        rewards: { silver: 80, food: 50, reputation: 10 },
        unlocks: ['ch2_community'],
        onComplete: '第一次豐收！農民們歡天喜地。',
        npcHints: {
            liu_jun: { minAffinity: 20, hint: '你對種田有興趣？來，我教你幾招。先從小麥開始最穩。' },
            wang_li: { minAffinity: 10, hint: '劉俊那小子種田很有一套，你可以去跟他請教。' },
        },
    },
    {
        id: 'ch2_community',
        chapter: 2,
        title: '凝聚共識',
        description: '小鎮需要向心力。讓居民們感受到歸屬感。',
        routes: [
            {
                id: 'popular', label: '人氣路線', icon: '⭐',
                description: '成為大家喜愛的人物。',
                conditions: [
                    { type: 'avg_affinity', target: 25, label: '全鎮平均好感度達到 25' },
                    { type: 'population', target: 15, label: '人口達到 15 人' },
                ],
            },
            {
                id: 'develop', label: '發展路線', icon: '📈',
                description: '用實力說話，讓小鎮更上一層樓。',
                conditions: [
                    { type: 'town_level', target: 3, label: '城鎮等級達到 Lv3（村莊）' },
                    { type: 'industry_count', target: 2, label: '開啟 2 個產業' },
                ],
            },
        ],
        rewards: { silver: 120, reputation: 15 },
        unlocks: ['ch3_crisis'],
        onComplete: '小鎮的居民們已經把你當成自己人了。',
        npcHints: {
            chen_wei: { minAffinity: 20, hint: '你做的事大家都看在眼裡。繼續加油，這個鎮需要你。' },
            huang_li: { minAffinity: 15, hint: '人心齊，泰山移。多跟大家聊聊天，讓他們感受到溫暖。' },
        },
    },

    // ===================== 第三章：風暴 =====================
    {
        id: 'ch3_crisis',
        chapter: 3,
        title: '風暴來襲',
        description: '一場突如其來的危機降臨小鎮。你必須帶領大家度過難關。',
        isCrisis: true,  // 標記為危機任務，由 CrisisSystem 處理
        crisisTypes: ['locust', 'bandit', 'plague'],  // 隨機選一
        routes: [
            {
                id: 'force', label: '武力路線', icon: '⚔️',
                description: '靠武力和防禦正面迎擊。',
                conditions: [
                    { type: 'npc_affinity', npcId: 'yang_feng', target: 40, label: '楊鋒好感度達到 40' },
                    { type: 'raid_survived', target: 1, label: '成功抵禦入侵' },
                ],
            },
            {
                id: 'wisdom', label: '智慧路線', icon: '🧠',
                description: '用研究和知識找到對策。',
                conditions: [
                    { type: 'npc_affinity', npcId: 'sun_yu', target: 40, label: '孫雨好感度達到 40' },
                    { type: 'resource', resource: 'silver', target: 200, label: '準備 200 銀幣研究經費' },
                ],
            },
            {
                id: 'diplomacy', label: '外交路線', icon: '🕊️',
                description: '靠商業人脈從外部取得援助。',
                conditions: [
                    { type: 'npc_affinity', npcId: 'zhao_xia', target: 40, label: '趙霞好感度達到 40' },
                    { type: 'trade_count', target: 8, label: '完成 8 次交易' },
                ],
            },
            {
                id: 'unity', label: '團結路線', icon: '🤝',
                description: '團結全鎮之力，共同度過。',
                conditions: [
                    { type: 'avg_affinity', target: 30, label: '全鎮平均好感度達到 30' },
                    { type: 'friends_count', target: 5, label: '與 5 位 NPC 達到「朋友」關係' },
                ],
            },
        ],
        rewards: { silver: 200, reputation: 25 },
        unlocks: ['ch3_rebuild'],
        onComplete: '危機解除了！你的領導力讓小鎮度過了最艱難的時刻。',
        npcHints: {
            yang_feng: { minAffinity: 20, hint: '如果你信得過我，我可以幫你組織防禦。但你得聽我的指揮。' },
            sun_yu: { minAffinity: 20, hint: '每個問題都有科學的解決方法。讓我研究一下，也許能找到突破口。' },
            zhao_xia: { minAffinity: 20, hint: '外面的人脈很重要。如果你需要援助，我可以幫你聯繫。' },
            chen_wei: { minAffinity: 10, hint: '大家都在看你怎麼做。不管選哪條路，團結是最重要的。' },
        },
    },
    {
        id: 'ch3_rebuild',
        chapter: 3,
        title: '重建家園',
        description: '危機過後，小鎮需要重建。趁這個機會讓它變得更好。',
        routes: [
            {
                id: 'build', label: '建設路線', icon: '🏗️',
                description: '大興土木，重建並擴建。',
                conditions: [
                    { type: 'building_count', target: 8, label: '完成 8 座建築' },
                    { type: 'factory_count', target: 1, label: '建造 1 座工廠' },
                ],
            },
            {
                id: 'prosper', label: '繁榮路線', icon: '💰',
                description: '用經濟實力快速恢復。',
                conditions: [
                    { type: 'resource', resource: 'silver', target: 300, label: '累積 300 銀幣' },
                    { type: 'trade_count', target: 10, label: '完成 10 次交易' },
                ],
            },
        ],
        rewards: { silver: 200, reputation: 20 },
        unlocks: ['ch4_expansion'],
        onComplete: '浴火重生的小鎮比以前更加堅強！',
        npcHints: {
            ma_qiang: { minAffinity: 20, hint: '重建的事交給我吧！...好啦，我會認真的。' },
            wu_da: { minAffinity: 15, hint: '建材的事，我這邊有門路。' },
        },
    },

    // ===================== 第四章：繁榮 =====================
    {
        id: 'ch4_expansion',
        chapter: 4,
        title: '小鎮擴張',
        description: '小鎮已經站穩腳跟。是時候向更高的目標邁進了。',
        routes: [
            {
                id: 'industry', label: '產業路線', icon: '🏭',
                description: '多角化經營，產業全開。',
                conditions: [
                    { type: 'industry_count', target: 3, label: '開啟 3 個產業' },
                    { type: 'town_level', target: 5, label: '城鎮等級達到 Lv5（城鎮）' },
                ],
            },
            {
                id: 'community', label: '社群路線', icon: '🏘️',
                description: '讓所有人都覺得這裡是家。',
                conditions: [
                    { type: 'population', target: 20, label: '人口達到 20 人' },
                    { type: 'friends_count', target: 6, label: '與 6 位 NPC 達到「朋友」關係' },
                ],
            },
        ],
        rewards: { silver: 250, reputation: 20 },
        unlocks: ['ch4_election'],
        onComplete: '小鎮的規模今非昔比，已經成為區域內的重要據點。',
        npcHints: {
            chen_wei: { minAffinity: 30, hint: '這個鎮已經不小了。我們需要更正式的管理方式。' },
        },
    },
    {
        id: 'ch4_election',
        chapter: 4,
        title: '民主之聲',
        description: '小鎮需要正式的領導人。參與這歷史性的一刻。',
        routes: [
            {
                id: 'election', label: '選舉路線', icon: '🗳️',
                description: '見證或參與選舉。',
                conditions: [
                    { type: 'election_count', target: 1, label: '經歷一次選舉' },
                ],
            },
            {
                id: 'trust', label: '威望路線', icon: '👑',
                description: '靠威望獲得大家的信任。',
                conditions: [
                    { type: 'avg_affinity', target: 40, label: '全鎮平均好感度達到 40' },
                    { type: 'reputation', target: 80, label: '聲望達到 80' },
                ],
            },
        ],
        rewards: { silver: 150, reputation: 20 },
        unlocks: ['ch4_bonds'],
        onComplete: '小鎮有了正式的領導人！民主的種子在邊境發芽了。',
    },
    {
        id: 'ch4_bonds',
        chapter: 4,
        title: '深厚羈絆',
        description: '經歷了這麼多，你和這裡的人建立了深厚的感情。',
        routes: [
            {
                id: 'bestfriend', label: '摯友路線', icon: '💛',
                description: '與某位居民建立深厚的友誼。',
                conditions: [
                    { type: 'max_affinity', target: 70, label: '與某位居民好感度達到 70' },
                ],
            },
            {
                id: 'beloved', label: '眾人路線', icon: '🌟',
                description: '成為人人愛戴的存在。',
                conditions: [
                    { type: 'friends_count', target: 8, label: '與 8 位 NPC 達到「朋友」關係' },
                    { type: 'avg_affinity', target: 35, label: '全鎮平均好感度達到 35' },
                ],
            },
        ],
        rewards: { silver: 100, reputation: 15 },
        unlocks: ['ch5_legacy'],
        onComplete: '你在這裡找到了真正的歸屬。這些人不只是鄰居——是家人。',
        npcHints: {
            xu_ying: { minAffinity: 30, hint: '...謝謝你一直對我這麼好。你是我在鎮上最信任的人。' },
            liu_jun: { minAffinity: 30, hint: '欸，你是我最好的朋友，你知道吧？' },
        },
    },

    // ===================== 第五章：傳承 =====================
    {
        id: 'ch5_legacy',
        chapter: 5,
        title: '傳承',
        description: '邊境鎮已經成為一個真正的家。為它寫下歷史吧。',
        routes: [
            {
                id: 'prosper', label: '繁榮結局', icon: '🏙️',
                description: '讓小鎮成為遠近聞名的繁榮之地。',
                conditions: [
                    { type: 'resource', resource: 'silver', target: 500, label: '累積 500 銀幣' },
                    { type: 'population', target: 25, label: '人口達到 25 人' },
                    { type: 'town_level', target: 6, label: '城鎮等級達到 Lv6（大城鎮）' },
                ],
            },
            {
                id: 'peace', label: '和平結局', icon: '🕊️',
                description: '讓所有人和睦相處。',
                conditions: [
                    { type: 'avg_affinity', target: 40, label: '全鎮平均好感度達到 40' },
                    { type: 'friends_count', target: 10, label: '與 10 位 NPC 達到「朋友」關係' },
                ],
            },
            {
                id: 'legend', label: '傳奇結局', icon: '🏆',
                description: '完成所有挑戰，成為傳奇。',
                conditions: [
                    { type: 'industry_count', target: 4, label: '四大產業全開' },
                    { type: 'town_level', target: 7, label: '城鎮等級達到 Lv7（城市）' },
                    { type: 'max_affinity', target: 80, label: '與某位居民好感度達到 80' },
                ],
            },
        ],
        rewards: { silver: 500, reputation: 50 },
        unlocks: [],
        onComplete: '邊境鎮的傳奇故事將被世世代代傳頌。這是你書寫的歷史。',
        isFinale: true,
    },
];


// ============================================================
// QuestSystem Class — 多路線引擎
// ============================================================

class QuestSystem {
    constructor() {
        this.quests = {};           // { questId: { status, objectives, routes, completedRoute } }
        this.completedOrder = [];
        this.tradeCount = 0;
        this.harvestCount = 0;
        this.chatCount = 0;
        this.raidsSurvived = 0;
        this.electionsHeld = 0;
        this.reputation = 0;        // 聲望值
        this.storyFlags = {};       // 劇情旗標
        this.activeCrisis = null;   // 第三章危機類型
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        for (const q of MAIN_QUESTS) {
            if (this.quests[q.id]) continue;
            const state = {
                status: q.id === 'ch1_settle' ? 'active' : 'locked',
                completedRoute: null,
            };
            // Old-style objectives
            if (q.objectives) {
                state.objectives = {};
                for (const obj of q.objectives) {
                    state.objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            // Multi-route
            if (q.routes) {
                state.routes = {};
                for (const route of q.routes) {
                    state.routes[route.id] = {};
                    for (const cond of route.conditions) {
                        const condId = cond.label; // use label as key for simplicity
                        state.routes[route.id][condId] = { progress: 0, completed: false };
                    }
                }
            }
            this.quests[q.id] = state;
        }
    }

    // ============================================================
    // Progress checking — 每 tick 呼叫
    // ============================================================
    checkProgress(world) {
        this.init();
        for (const questDef of MAIN_QUESTS) {
            const quest = this.quests[questDef.id];
            if (!quest || quest.status !== 'active') continue;

            // Multi-route quests
            if (questDef.routes) {
                for (const routeDef of questDef.routes) {
                    let routeComplete = true;
                    for (const condDef of routeDef.conditions) {
                        const condId = condDef.label;
                        const condState = quest.routes?.[routeDef.id]?.[condId];
                        if (!condState) { routeComplete = false; continue; }
                        if (condState.completed) continue;

                        const current = this._evaluateCondition(condDef, world);
                        condState.progress = Math.min(current, condDef.target);
                        if (condState.progress >= condDef.target) {
                            condState.completed = true;
                        } else {
                            routeComplete = false;
                        }
                    }
                    if (routeComplete) {
                        quest.completedRoute = routeDef.id;
                        this._completeQuest(questDef, world, routeDef);
                        break;
                    }
                }
                continue;
            }

            // Legacy single-objective quests
            if (questDef.objectives) {
                let allDone = true;
                for (const objDef of questDef.objectives) {
                    const obj = quest.objectives[objDef.id];
                    if (obj.completed) continue;
                    const current = this._evaluateCondition(objDef, world);
                    obj.progress = Math.min(current, objDef.target);
                    if (obj.progress >= objDef.target) {
                        obj.completed = true;
                    } else {
                        allDone = false;
                    }
                }
                if (allDone) {
                    this._completeQuest(questDef, world, null);
                }
            }
        }
    }

    // ============================================================
    // Condition evaluation — 統一評估各種條件
    // ============================================================
    _evaluateCondition(cond, world) {
        switch (cond.type) {
            case 'chat_count':
                return this.chatCount;
            case 'resource':
            case 'resource_reach':
                return world.stockpile?.get?.(cond.resource) || 0;
            case 'industry_count':
                return Object.keys(world.industry?.industries || {}).length;
            case 'industry_specific':
                return world.industry?.industries?.[cond.industry] ? 1 : 0;
            case 'building_count':
                return world.buildings?.completed?.length || 0;
            case 'population':
                return Object.keys(world.agents || {}).length;
            case 'harvest_count':
                return this.harvestCount;
            case 'trade_count':
                return this.tradeCount;
            case 'factory_count':
                return Object.values(world.processing?.builtFactories || {}).filter(f => f.status === 'active').length;
            case 'town_level':
                return world.industry?.townLevel || 1;
            case 'election_count':
                return this.electionsHeld;
            case 'raid_survived':
                return this.raidsSurvived;
            case 'reputation':
                return this.reputation;
            case 'max_affinity': {
                const player = world.agents?.player;
                if (player?.relationships?.relationships) {
                    return Math.max(0, ...Object.values(player.relationships.relationships).map(r => r.affinity || 0));
                }
                return 0;
            }
            case 'npc_affinity': {
                const player = world.agents?.player;
                const rel = player?.relationships?.relationships?.[cond.npcId];
                return rel?.affinity || 0;
            }
            case 'avg_affinity': {
                const player = world.agents?.player;
                if (!player?.relationships?.relationships) return 0;
                const rels = Object.values(player.relationships.relationships);
                if (rels.length === 0) return 0;
                return Math.round(rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length);
            }
            case 'friends_count': {
                const player = world.agents?.player;
                if (!player?.relationships?.relationships) return 0;
                return Object.values(player.relationships.relationships).filter(r => (r.affinity || 0) > 20).length;
            }
            default:
                return 0;
        }
    }

    // ============================================================
    // Quest completion
    // ============================================================
    _completeQuest(questDef, world, completedRoute) {
        const quest = this.quests[questDef.id];
        quest.status = 'completed';
        this.completedOrder.push(questDef.id);

        // Give rewards
        if (questDef.rewards) {
            for (const [res, amount] of Object.entries(questDef.rewards)) {
                if (res === 'reputation') {
                    this.reputation += amount;
                } else {
                    world.stockpile?.add?.(res, amount, world.tickCount, `任務獎勵：${questDef.title}`);
                }
            }
        }

        // Set story flags
        const routeLabel = completedRoute ? completedRoute.label : '';
        this.storyFlags[questDef.id] = {
            completedRoute: completedRoute?.id || 'default',
            day: world.clock.day,
            year: world.clock.year,
        };

        // Log
        const routeMsg = completedRoute ? `（${completedRoute.label}）` : '';
        world.logMessage?.('quest', `⚔️ 主線任務完成：「${questDef.title}」${routeMsg}！${questDef.onComplete}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `主線任務「${questDef.title}」${routeMsg}完成！${questDef.onComplete}`, 8);
        }

        // Multi-ending trigger (when finale quest completes)
        if (questDef.isFinale && world.multiEnding) {
            const endingRouteId = completedRoute?.id || 'prosper';
            world.multiEnding.checkEnding(world, endingRouteId);
        }

        // Unlock next quests (supports array or string)
        const unlocks = questDef.unlocks;
        if (unlocks) {
            const unlockList = Array.isArray(unlocks) ? unlocks : [unlocks];
            for (const nextId of unlockList) {
                const next = this.quests[nextId];
                if (next && next.status === 'locked') {
                    next.status = 'active';
                    const nextDef = MAIN_QUESTS.find(q => q.id === nextId);
                    if (nextDef) {
                        world.logMessage?.('quest', `📜 新任務解鎖：「${nextDef.title}」`);
                    }

                    // If crisis quest, roll crisis type
                    if (nextDef?.isCrisis && !this.activeCrisis) {
                        const types = nextDef.crisisTypes || ['locust', 'bandit', 'plague'];
                        this.activeCrisis = types[Math.floor(Math.random() * types.length)];
                        const crisisNames = { locust: '蝗災', bandit: '盜匪圍城', plague: '瘟疫' };
                        world.logMessage?.('quest', `⚠️ 危機降臨：${crisisNames[this.activeCrisis] || this.activeCrisis}！`);
                        if (world.dailyNews) {
                            world.dailyNews.collectEvent?.('crisis', `重大危機！${crisisNames[this.activeCrisis]}威脅著小鎮的生存！`, 10);
                        }
                    }
                }
            }
        }
    }

    // ============================================================
    // NPC 對話提示 — 供 ConversationEngine 使用
    // ============================================================
    getQuestHintsForNPC(npcId, playerAffinity) {
        const hints = [];
        for (const questDef of MAIN_QUESTS) {
            const quest = this.quests[questDef.id];
            if (!quest || quest.status !== 'active') continue;
            if (!questDef.npcHints || !questDef.npcHints[npcId]) continue;
            const hintDef = questDef.npcHints[npcId];
            if (playerAffinity >= (hintDef.minAffinity || 0)) {
                hints.push({
                    questTitle: questDef.title,
                    hint: hintDef.hint,
                });
            }
        }
        return hints;
    }

    // Get active quest context for prompt injection
    getActiveQuestContext() {
        const active = this.getActiveQuests();
        if (active.length === 0) return '';
        const parts = active.map(q => {
            let s = `任務「${q.title}」：${q.description}`;
            if (q.routes) {
                const routeLabels = q.routes.map(r => r.label).join('、');
                s += `（可選路線：${routeLabels}）`;
            }
            return s;
        });
        return `玩家正在進行的任務：${parts.join('；')}`;
    }

    // Get crisis description for prompt injection
    getCrisisContext() {
        if (!this.activeCrisis) return '';
        const desc = {
            locust: '蝗災正在侵襲小鎮，農作物受到嚴重威脅。大家都很擔心糧食問題。',
            bandit: '盜匪在小鎮附近出沒，安全受到威脅。居民們人心惶惶。',
            plague: '一種神秘的疾病在小鎮蔓延，已有多人生病。大家急需醫療資源。',
        };
        return desc[this.activeCrisis] || '';
    }

    // ============================================================
    // Event hooks
    // ============================================================
    onChat() { this.chatCount++; }
    onTrade() { this.tradeCount++; }
    onHarvest() { this.harvestCount++; }
    onRaidSurvived() { this.raidsSurvived++; }
    onElection() { this.electionsHeld++; }

    // ============================================================
    // Getters
    // ============================================================
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

    // ============================================================
    // Serialization (UI state)
    // ============================================================
    toDict() {
        const active = this.getActiveQuests();
        const result = {
            quests: {},
            currentChapter: this.getCurrentChapter(),
            activeCount: active.length,
            completedCount: this.completedOrder.length,
            totalCount: MAIN_QUESTS.length,
            reputation: this.reputation,
            activeCrisis: this.activeCrisis,
        };
        for (const questDef of MAIN_QUESTS) {
            const quest = this.quests[questDef.id];
            if (!quest) continue;

            const qData = {
                id: questDef.id,
                chapter: questDef.chapter,
                title: questDef.title,
                description: questDef.description,
                status: quest.status,
                rewards: questDef.rewards,
                onComplete: questDef.onComplete,
                completedRoute: quest.completedRoute,
                isCrisis: questDef.isCrisis || false,
                isFinale: questDef.isFinale || false,
            };

            // Multi-route data
            if (questDef.routes) {
                qData.routes = questDef.routes.map(routeDef => ({
                    id: routeDef.id,
                    label: routeDef.label,
                    icon: routeDef.icon,
                    description: routeDef.description,
                    conditions: routeDef.conditions.map(condDef => {
                        const condState = quest.routes?.[routeDef.id]?.[condDef.label] || {};
                        return {
                            ...condDef,
                            progress: condState.progress || 0,
                            completed: condState.completed || false,
                        };
                    }),
                    isComplete: quest.completedRoute === routeDef.id,
                }));
            }

            // Legacy objectives
            if (questDef.objectives) {
                qData.objectives = questDef.objectives.map(objDef => ({
                    ...objDef,
                    progress: quest.objectives?.[objDef.id]?.progress || 0,
                    completed: quest.objectives?.[objDef.id]?.completed || false,
                }));
            }

            result.quests[questDef.id] = qData;
        }
        return result;
    }

    // ============================================================
    // Serialization (save/load)
    // ============================================================
    serialize() {
        return {
            quests: JSON.parse(JSON.stringify(this.quests)),
            completedOrder: [...this.completedOrder],
            tradeCount: this.tradeCount,
            harvestCount: this.harvestCount,
            chatCount: this.chatCount,
            raidsSurvived: this.raidsSurvived,
            electionsHeld: this.electionsHeld,
            reputation: this.reputation,
            storyFlags: { ...this.storyFlags },
            activeCrisis: this.activeCrisis,
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
        this.reputation = data.reputation || 0;
        this.storyFlags = data.storyFlags || {};
        this.activeCrisis = data.activeCrisis || null;
        this._initialized = Object.keys(this.quests).length > 0;

        // Migrate: if old save has quests but no routes, reinitialize new quests
        this._migrateIfNeeded();
    }

    _migrateIfNeeded() {
        // Add any new quests that don't exist in save data
        for (const q of MAIN_QUESTS) {
            if (this.quests[q.id]) {
                // Ensure routes exist for multi-route quests
                if (q.routes && !this.quests[q.id].routes) {
                    this.quests[q.id].routes = {};
                    for (const route of q.routes) {
                        this.quests[q.id].routes[route.id] = {};
                        for (const cond of route.conditions) {
                            this.quests[q.id].routes[route.id][cond.label] = { progress: 0, completed: false };
                        }
                    }
                }
                continue;
            }
            // New quest not in save — determine status
            this.quests[q.id] = {
                status: 'locked',
                completedRoute: null,
            };
            if (q.objectives) {
                this.quests[q.id].objectives = {};
                for (const obj of q.objectives) {
                    this.quests[q.id].objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            if (q.routes) {
                this.quests[q.id].routes = {};
                for (const route of q.routes) {
                    this.quests[q.id].routes[route.id] = {};
                    for (const cond of route.conditions) {
                        this.quests[q.id].routes[route.id][cond.label] = { progress: 0, completed: false };
                    }
                }
            }
        }

        // Migrate old quest IDs to new structure
        // Old: ch1_food → merged into ch1_survive
        // Old: ch2_build, ch2_pop → merged into ch2_economy, ch2_community
        const oldToNew = {
            'ch1_food': 'ch1_survive',
            'ch2_build': 'ch2_economy',
            'ch2_pop': 'ch2_community',
            'ch3_trade': 'ch3_crisis',
            'ch3_factory': 'ch3_rebuild',
            'ch3_townlv': 'ch3_rebuild',
            'ch4_friendship': 'ch4_bonds',
            'ch4_defense': 'ch4_bonds',
            'ch5_prosper': 'ch5_legacy',
        };

        for (const [oldId, newId] of Object.entries(oldToNew)) {
            if (this.quests[oldId]?.status === 'completed' && this.quests[newId]?.status === 'locked') {
                this.quests[newId].status = 'active';
            }
        }

        // If ch1_settle is completed but ch1_survive doesn't exist as active, activate it
        if (this.quests['ch1_settle']?.status === 'completed' && this.quests['ch1_survive']?.status === 'locked') {
            this.quests['ch1_survive'].status = 'active';
        }
        if (this.quests['ch1_industry']?.status === 'completed' && this.quests['ch2_economy']?.status === 'locked') {
            this.quests['ch2_economy'].status = 'active';
        }
    }
}
