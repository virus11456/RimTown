// ============================================================
// RimTown - Main Quest System v2 (主線任務系統 — 多路線版)
// ============================================================
// 升級重點：每個任務支援多條完成路線（搜集/社交/建設）
// 任何一條路線完成即可過關，NPC 好感度直接影響任務進展

const CHAPTER_NAMES = {
    1: t('第一章：落腳'),
    2: t('第二章：紮根'),
    3: t('第三章：風暴'),
    4: t('第四章：繁榮'),
    5: t('第五章：傳承'),
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
        title: t('落腳邊境'),
        description: t('你剛抵達這個偏遠的小鎮。先和鎮上的居民聊聊天，了解這裡的狀況。'),
        objectives: [
            { id: 'talk_3', type: 'chat_count', target: 3, label: t('和 3 位居民交談') },
        ],
        rewards: { silver: 20, reputation: 5 },
        unlocks: ['ch1_survive'],
        onComplete: t('鎮民們開始接受你的存在了。'),
        npcHints: {
            chen_wei: { minAffinity: 0, hint: t('你是新來的吧？去跟大家聊聊，認識一下這裡的人。') },
        },
    },
    {
        id: 'ch1_survive',
        chapter: 1,
        title: t('度過寒冬'),
        description: t('第一個冬天即將來臨。你得想辦法讓小鎮撐過去——方法不只一種。'),
        routes: [
            {
                id: 'gather', label: t('搜集路線'), icon: '📦',
                description: t('靠囤積物資硬撐過去。'),
                conditions: [
                    { type: 'resource', resource: 'food', target: 100, label: t('儲備 100 食物') },
                    { type: 'resource', resource: 'wood', target: 80, label: t('儲備 80 木材') },
                ],
            },
            {
                id: 'social', label: t('社交路線'), icon: '💬',
                description: t('說服林美教你草藥知識，用智慧過冬。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'lin_mei', target: 40, label: t('林美好感度達到 40') },
                    { type: 'chat_count', target: 8, label: t('與居民交談 8 次') },
                ],
            },
            {
                id: 'build', label: t('建設路線'), icon: '🏗️',
                description: t('建造基礎設施來抵禦寒冬。'),
                conditions: [
                    { type: 'building_count', target: 2, label: t('完成 2 座建築') },
                    { type: 'industry_count', target: 1, label: t('開啟 1 個產業') },
                ],
            },
        ],
        rewards: { silver: 50, reputation: 10 },
        unlocks: ['ch1_industry'],
        onComplete: t('小鎮平安度過了第一個冬天！你的努力沒有白費。'),
        npcHints: {
            chen_wei: { minAffinity: 0, hint: t('冬天快到了，得做點準備。你可以多囤點物資，或者找林醫生聊聊。') },
            lin_mei: { minAffinity: 20, hint: t('如果你有興趣，我可以教你一些草藥的知識...對過冬很有幫助。') },
            liu_jun: { minAffinity: 15, hint: t('你要是能幫我找些種子，我教你怎麼種東西。') },
            wu_da: { minAffinity: 10, hint: t('木材的事找我就對了，不過你得先讓我看看你的誠意。') },
        },
    },
    {
        id: 'ch1_industry',
        chapter: 1,
        title: t('發展的第一步'),
        description: t('有了基本生存條件，是時候考慮長遠發展了。'),
        routes: [
            {
                id: 'standard', label: t('產業路線'), icon: '🏭',
                description: t('開啟產業，建立經濟基礎。'),
                conditions: [
                    { type: 'industry_count', target: 1, label: t('開啟第一個產業') },
                ],
            },
            {
                id: 'social', label: t('人脈路線'), icon: '🤝',
                description: t('靠人脈和好名聲推動發展。'),
                conditions: [
                    { type: 'avg_affinity', target: 20, label: t('全鎮平均好感度達到 20') },
                    { type: 'chat_count', target: 15, label: t('與居民交談 15 次') },
                ],
            },
        ],
        rewards: { silver: 50, reputation: 10 },
        unlocks: ['ch2_economy'],
        onComplete: t('產業開始運轉，你正式成為鎮上不可或缺的一份子。'),
        npcHints: {
            zhao_xia: { minAffinity: 10, hint: t('想賺錢的話，先選個產業做起來。我看好農業或伐木。') },
        },
    },

    // ===================== 第二章：紮根 =====================
    {
        id: 'ch2_economy',
        chapter: 2,
        title: t('穩定經濟'),
        description: t('小鎮需要一個穩定的經濟體系才能長久。'),
        routes: [
            {
                id: 'trade', label: t('經營路線'), icon: '💰',
                description: t('透過貿易和產業建立經濟。'),
                conditions: [
                    { type: 'trade_count', target: 3, label: t('完成 3 次交易') },
                    { type: 'resource', resource: 'silver', target: 100, label: t('累積 100 銀幣') },
                ],
            },
            {
                id: 'social', label: t('社交路線'), icon: '💬',
                description: t('與多位 NPC 建立友誼，互助共榮。'),
                conditions: [
                    { type: 'friends_count', target: 3, label: t('與 3 位 NPC 達到「朋友」關係') },
                ],
            },
            {
                id: 'build', label: t('建設路線'), icon: '🏗️',
                description: t('大興土木，用建設帶動經濟。'),
                conditions: [
                    { type: 'building_count', target: 5, label: t('完成 5 座建築') },
                    { type: 'population', target: 12, label: t('人口達到 12 人') },
                ],
            },
        ],
        rewards: { silver: 100, reputation: 15 },
        unlocks: ['ch2_farm'],
        onComplete: t('小鎮的經濟開始走上正軌了。'),
        npcHints: {
            zhao_xia: { minAffinity: 20, hint: t('我認識幾個商人，如果你跟我關係好，我可以幫你牽線。') },
            liu_jun: { minAffinity: 15, hint: t('經濟不好的時候，農業最靠譜。我可以幫忙。') },
        },
    },
    {
        id: 'ch2_farm',
        chapter: 2,
        title: t('農耕之道'),
        description: t('民以食為天。建立農場，讓小鎮自給自足。'),
        routes: [
            {
                id: 'farm', label: t('務農路線'), icon: '🌾',
                description: t('親自種植作物，完成收穫。'),
                conditions: [
                    { type: 'industry_specific', industry: 'farming', label: t('開啟農業產業') },
                    { type: 'harvest_count', target: 3, label: t('完成 3 次收穫') },
                ],
            },
            {
                id: 'social', label: t('拜師路線'), icon: '👨‍🌾',
                description: t('跟劉俊學種田，事半功倍。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'liu_jun', target: 40, label: t('劉俊好感度達到 40') },
                    { type: 'harvest_count', target: 1, label: t('完成 1 次收穫') },
                ],
            },
        ],
        rewards: { silver: 80, food: 50, reputation: 10 },
        unlocks: ['ch2_community'],
        onComplete: t('第一次豐收！農民們歡天喜地。'),
        npcHints: {
            liu_jun: { minAffinity: 20, hint: t('你對種田有興趣？來，我教你幾招。先從小麥開始最穩。') },
            wang_li: { minAffinity: 10, hint: t('劉俊那小子種田很有一套，你可以去跟他請教。') },
        },
    },
    {
        id: 'ch2_community',
        chapter: 2,
        title: t('凝聚共識'),
        description: t('小鎮需要向心力。讓居民們感受到歸屬感。'),
        routes: [
            {
                id: 'popular', label: t('人氣路線'), icon: '⭐',
                description: t('成為大家喜愛的人物。'),
                conditions: [
                    { type: 'avg_affinity', target: 25, label: t('全鎮平均好感度達到 25') },
                    { type: 'population', target: 15, label: t('人口達到 15 人') },
                ],
            },
            {
                id: 'develop', label: t('發展路線'), icon: '📈',
                description: t('用實力說話，讓小鎮更上一層樓。'),
                conditions: [
                    { type: 'town_level', target: 3, label: t('城鎮等級達到 Lv3（村莊）') },
                    { type: 'industry_count', target: 2, label: t('開啟 2 個產業') },
                ],
            },
        ],
        rewards: { silver: 120, reputation: 15 },
        unlocks: ['ch3_crisis'],
        onComplete: t('小鎮的居民們已經把你當成自己人了。'),
        npcHints: {
            chen_wei: { minAffinity: 20, hint: t('你做的事大家都看在眼裡。繼續加油，這個鎮需要你。') },
            huang_li: { minAffinity: 15, hint: t('人心齊，泰山移。多跟大家聊聊天，讓他們感受到溫暖。') },
        },
    },

    // ===================== 第三章：風暴 =====================
    {
        id: 'ch3_crisis',
        chapter: 3,
        title: t('風暴來襲'),
        description: t('一場突如其來的危機降臨小鎮。你必須帶領大家度過難關。'),
        isCrisis: true,  // 標記為危機任務，由 CrisisSystem 處理
        crisisTypes: ['locust', 'bandit', 'plague'],  // 隨機選一
        routes: [
            {
                id: 'force', label: t('武力路線'), icon: '⚔️',
                description: t('靠武力和防禦正面迎擊。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'yang_feng', target: 40, label: t('楊鋒好感度達到 40') },
                    { type: 'raid_survived', target: 1, label: t('成功抵禦入侵') },
                ],
            },
            {
                id: 'wisdom', label: t('智慧路線'), icon: '🧠',
                description: t('用研究和知識找到對策。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'sun_yu', target: 40, label: t('孫雨好感度達到 40') },
                    { type: 'resource', resource: 'silver', target: 200, label: t('準備 200 銀幣研究經費') },
                ],
            },
            {
                id: 'diplomacy', label: t('外交路線'), icon: '🕊️',
                description: t('靠商業人脈從外部取得援助。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'zhao_xia', target: 40, label: t('趙霞好感度達到 40') },
                    { type: 'trade_count', target: 8, label: t('完成 8 次交易') },
                ],
            },
            {
                id: 'unity', label: t('團結路線'), icon: '🤝',
                description: t('團結全鎮之力，共同度過。'),
                conditions: [
                    { type: 'avg_affinity', target: 30, label: t('全鎮平均好感度達到 30') },
                    { type: 'friends_count', target: 5, label: t('與 5 位 NPC 達到「朋友」關係') },
                ],
            },
        ],
        rewards: { silver: 200, reputation: 25 },
        unlocks: ['ch3_rebuild'],
        onComplete: t('危機解除了！你的領導力讓小鎮度過了最艱難的時刻。'),
        npcHints: {
            yang_feng: { minAffinity: 20, hint: t('如果你信得過我，我可以幫你組織防禦。但你得聽我的指揮。') },
            sun_yu: { minAffinity: 20, hint: t('每個問題都有科學的解決方法。讓我研究一下，也許能找到突破口。') },
            zhao_xia: { minAffinity: 20, hint: t('外面的人脈很重要。如果你需要援助，我可以幫你聯繫。') },
            chen_wei: { minAffinity: 10, hint: t('大家都在看你怎麼做。不管選哪條路，團結是最重要的。') },
        },
    },
    {
        id: 'ch3_rebuild',
        chapter: 3,
        title: t('重建家園'),
        description: t('危機過後，小鎮需要重建。趁這個機會讓它變得更好。'),
        routes: [
            {
                id: 'build', label: t('建設路線'), icon: '🏗️',
                description: t('大興土木，重建並擴建。'),
                conditions: [
                    { type: 'building_count', target: 8, label: t('完成 8 座建築') },
                    { type: 'factory_count', target: 1, label: t('建造 1 座工廠') },
                ],
            },
            {
                id: 'prosper', label: t('繁榮路線'), icon: '💰',
                description: t('用經濟實力快速恢復。'),
                conditions: [
                    { type: 'resource', resource: 'silver', target: 300, label: t('累積 300 銀幣') },
                    { type: 'trade_count', target: 10, label: t('完成 10 次交易') },
                ],
            },
        ],
        rewards: { silver: 200, reputation: 20 },
        unlocks: ['ch4_expansion'],
        onComplete: t('浴火重生的小鎮比以前更加堅強！'),
        npcHints: {
            ma_qiang: { minAffinity: 20, hint: t('重建的事交給我吧！...好啦，我會認真的。') },
            wu_da: { minAffinity: 15, hint: t('建材的事，我這邊有門路。') },
        },
    },

    // ===================== 第四章：繁榮 =====================
    {
        id: 'ch4_expansion',
        chapter: 4,
        title: t('小鎮擴張'),
        description: t('小鎮已經站穩腳跟。是時候向更高的目標邁進了。'),
        routes: [
            {
                id: 'industry', label: t('產業路線'), icon: '🏭',
                description: t('多角化經營，產業全開。'),
                conditions: [
                    { type: 'industry_count', target: 3, label: t('開啟 3 個產業') },
                    { type: 'town_level', target: 5, label: t('城鎮等級達到 Lv5（城鎮）') },
                ],
            },
            {
                id: 'community', label: t('社群路線'), icon: '🏘️',
                description: t('讓所有人都覺得這裡是家。'),
                conditions: [
                    { type: 'population', target: 20, label: t('人口達到 20 人') },
                    { type: 'friends_count', target: 6, label: t('與 6 位 NPC 達到「朋友」關係') },
                ],
            },
        ],
        rewards: { silver: 250, reputation: 20 },
        unlocks: ['ch4_election'],
        onComplete: t('小鎮的規模今非昔比，已經成為區域內的重要據點。'),
        npcHints: {
            chen_wei: { minAffinity: 30, hint: t('這個鎮已經不小了。我們需要更正式的管理方式。') },
        },
    },
    {
        id: 'ch4_election',
        chapter: 4,
        title: t('民主之聲'),
        description: t('小鎮需要正式的領導人。參與這歷史性的一刻。'),
        routes: [
            {
                id: 'election', label: t('選舉路線'), icon: '🗳️',
                description: t('見證或參與選舉。'),
                conditions: [
                    { type: 'election_count', target: 1, label: t('經歷一次選舉') },
                ],
            },
            {
                id: 'trust', label: t('威望路線'), icon: '👑',
                description: t('靠威望獲得大家的信任。'),
                conditions: [
                    { type: 'avg_affinity', target: 40, label: t('全鎮平均好感度達到 40') },
                    { type: 'reputation', target: 80, label: t('聲望達到 80') },
                ],
            },
        ],
        rewards: { silver: 150, reputation: 20 },
        unlocks: ['ch4_bonds'],
        onComplete: t('小鎮有了正式的領導人！民主的種子在邊境發芽了。'),
    },
    {
        id: 'ch4_bonds',
        chapter: 4,
        title: t('深厚羈絆'),
        description: t('經歷了這麼多，你和這裡的人建立了深厚的感情。'),
        routes: [
            {
                id: 'bestfriend', label: t('摯友路線'), icon: '💛',
                description: t('與某位居民建立深厚的友誼。'),
                conditions: [
                    { type: 'max_affinity', target: 70, label: t('與某位居民好感度達到 70') },
                ],
            },
            {
                id: 'beloved', label: t('眾人路線'), icon: '🌟',
                description: t('成為人人愛戴的存在。'),
                conditions: [
                    { type: 'friends_count', target: 8, label: t('與 8 位 NPC 達到「朋友」關係') },
                    { type: 'avg_affinity', target: 35, label: t('全鎮平均好感度達到 35') },
                ],
            },
        ],
        rewards: { silver: 100, reputation: 15 },
        unlocks: ['ch5_legacy'],
        onComplete: t('你在這裡找到了真正的歸屬。這些人不只是鄰居——是家人。'),
        npcHints: {
            xu_ying: { minAffinity: 30, hint: t('...謝謝你一直對我這麼好。你是我在鎮上最信任的人。') },
            liu_jun: { minAffinity: 30, hint: t('欸，你是我最好的朋友，你知道吧？') },
        },
    },

    // ===================== 第五章：傳承 =====================
    {
        id: 'ch5_legacy',
        chapter: 5,
        title: t('傳承'),
        description: t('邊境鎮已經成為一個真正的家。為它寫下歷史吧。'),
        routes: [
            {
                id: 'prosper', label: t('繁榮結局'), icon: '🏙️',
                description: t('讓小鎮成為遠近聞名的繁榮之地。'),
                conditions: [
                    { type: 'resource', resource: 'silver', target: 500, label: t('累積 500 銀幣') },
                    { type: 'population', target: 25, label: t('人口達到 25 人') },
                    { type: 'town_level', target: 6, label: t('城鎮等級達到 Lv6（大城鎮）') },
                ],
            },
            {
                id: 'peace', label: t('和平結局'), icon: '🕊️',
                description: t('讓所有人和睦相處。'),
                conditions: [
                    { type: 'avg_affinity', target: 40, label: t('全鎮平均好感度達到 40') },
                    { type: 'friends_count', target: 10, label: t('與 10 位 NPC 達到「朋友」關係') },
                ],
            },
            {
                id: 'legend', label: t('傳奇結局'), icon: '🏆',
                description: t('完成所有挑戰，成為傳奇。'),
                conditions: [
                    { type: 'industry_count', target: 4, label: t('四大產業全開') },
                    { type: 'town_level', target: 7, label: t('城鎮等級達到 Lv7（城市）') },
                    { type: 'max_affinity', target: 80, label: t('與某位居民好感度達到 80') },
                ],
            },
        ],
        rewards: { silver: 500, reputation: 50 },
        unlocks: [],
        onComplete: t('邊境鎮的傳奇故事將被世世代代傳頌。這是你書寫的歷史。'),
        isFinale: true,
    },
];

// ============================================================
// 支線任務定義 — NPC 角色故事驅動
// ============================================================
// trigger: 觸發條件（主線進度/好感度/時間/季節）
// story: 故事文字，增加劇情帶入感
// ============================================================

const SIDE_QUESTS = [
    // ── 第一章支線 ──
    {
        id: 'side_wang_recipe',
        chapter: 1,
        title: t('王麗的私房菜'),
        type: 'side',
        trigger: { mainQuest: 'ch1_settle', npcAffinity: { wang_li: 10 } },
        story: t('「嘿，新來的！你看起來瘦巴巴的。來，嚐嚐我的拿手菜。不過我缺一些食材...幫我找找？」王麗笑著遞給你一張紙條。'),
        description: t('幫王麗收集食材，品嚐她的私房菜。'),
        objectives: [
            { id: 'gather_food', type: 'resource', resource: 'food', target: 30, label: t('收集 30 份食材') },
            { id: 'talk_wang', type: 'npc_affinity', npcId: 'wang_li', target: 20, label: t('和王麗好感度達 20') },
        ],
        rewards: { silver: 15, reputation: 3 },
        onComplete: t('王麗端出一桌好菜，整個酒館都飄著香氣。「怎麼樣？好吃吧？以後你就是我的常客了！」你感覺到了家的溫暖。'),
        npcHints: {
            wang_li: { minAffinity: 5, hint: t('我最近在研究一道新菜，需要一些特別的食材。你能幫忙嗎？') },
        },
    },
    {
        id: 'side_zhang_masterwork',
        chapter: 1,
        title: t('鐵匠的心事'),
        type: 'side',
        trigger: { mainQuest: 'ch1_survive', npcAffinity: { zhang_hao: 15 } },
        story: t('你偶然發現張豪在工坊後面偷偷寫著什麼。他一看到你，慌忙把紙藏起來。「沒...沒什麼。」他的臉紅了。你注意到紙上寫的是一首詩。'),
        description: t('了解張豪的內心世界，幫助他找到表達自己的方式。'),
        objectives: [
            { id: 'talk_zhang', type: 'npc_affinity', npcId: 'zhang_hao', target: 30, label: t('和張豪好感度達 30') },
            { id: 'get_metal', type: 'resource', resource: 'metal', target: 20, label: t('收集 20 金屬') },
        ],
        rewards: { silver: 25, reputation: 5 },
        onComplete: t('張豪終於鼓起勇氣，把他的詩刻在了一件精美的鐵器上。「謝謝你...你是第一個知道我會寫詩的人。」他遞給你一把特製的工具作為謝禮。'),
        npcHints: {
            zhang_hao: { minAffinity: 10, hint: t('...你不會覺得一個鐵匠寫詩很奇怪吧？') },
        },
    },
    {
        id: 'side_liu_letter',
        chapter: 1,
        title: t('未寄出的情書'),
        type: 'side',
        trigger: { mainQuest: 'ch1_survive', npcAffinity: { liu_jun: 15 } },
        story: t('劉俊在田邊嘆氣，手裡攥著一封信。「你...你覺得一個農夫配得上她嗎？」他小聲問你。你看到信封上寫著許瑩的名字。'),
        description: t('幫助劉俊鼓起勇氣，送出他的情書。'),
        objectives: [
            { id: 'talk_liu', type: 'npc_affinity', npcId: 'liu_jun', target: 25, label: t('和劉俊好感度達 25') },
            { id: 'talk_xu', type: 'npc_affinity', npcId: 'xu_ying', target: 15, label: t('和許瑩好感度達 15') },
        ],
        rewards: { silver: 10, reputation: 5 },
        onComplete: t('在你的鼓勵下，劉俊終於把信交給了許瑩。許瑩讀完後，臉紅得像夕陽一樣。「笨蛋...你早該說的。」她小聲說。劉俊傻傻地笑了。'),
        npcHints: {
            liu_jun: { minAffinity: 10, hint: t('我...我有一封信想交給某個人。但我怕被拒絕。') },
            xu_ying: { minAffinity: 5, hint: t('最近劉俊好像一直在看我...是我想多了嗎？') },
        },
    },

    // ── 第二章支線 ──
    {
        id: 'side_sun_ruins',
        chapter: 2,
        title: t('古代遺跡之謎'),
        type: 'side',
        trigger: { mainQuest: 'ch2_economy' },
        story: t('孫雨興奮地跑來找你：「我在鎮外發現了古代遺跡的入口！裡面可能藏著這片土地的秘密。但我一個人不敢進去...你願意陪我嗎？」'),
        description: t('和孫雨一起探索古代遺跡，揭開邊境鎮的歷史。'),
        objectives: [
            { id: 'sun_friend', type: 'npc_affinity', npcId: 'sun_yu', target: 35, label: t('和孫雨好感度達 35') },
            { id: 'gather_silver', type: 'resource', resource: 'silver', target: 80, label: t('準備 80 銀幣的探險經費') },
        ],
        rewards: { silver: 60, reputation: 8 },
        onComplete: t('你和孫雨在遺跡中發現了一面石碑，上面記載著邊境鎮數百年前曾是一個繁華的驛站。「原來這裡曾經這麼輝煌...」孫雨的眼睛閃著光，「也許我們能讓它重現往日的榮光。」'),
        npcHints: {
            sun_yu: { minAffinity: 20, hint: t('鎮外的那些石頭不是普通的石頭，那是古代建築的遺跡！我需要幫手。') },
        },
    },
    {
        id: 'side_wu_past',
        chapter: 2,
        title: t('老礦工的秘密'),
        type: 'side',
        trigger: { mainQuest: 'ch2_farm', npcAffinity: { wu_da: 20 } },
        story: t('一天晚上，吳達在酒館裡喝得醉醺醺的，突然說：「你知道嗎...我年輕的時候，差點把整個礦坑炸了。」他的眼中閃過一絲愧疚。'),
        description: t('聆聽吳達的過去，幫助他放下心中的包袱。'),
        objectives: [
            { id: 'wu_friend', type: 'npc_affinity', npcId: 'wu_da', target: 40, label: t('和吳達好感度達 40') },
            { id: 'mine_stone', type: 'resource', resource: 'stone', target: 60, label: t('開採 60 石料（證明你理解他的工作）') },
        ],
        rewards: { silver: 40, reputation: 8 },
        onComplete: t('吳達終於說出了全部的故事——年輕時因為疏忽導致礦坑事故，兩個同伴受傷。他來邊境鎮就是為了贖罪。「謝謝你聽我說這些...我覺得輕鬆多了。」老礦工第一次露出了笑容。'),
        npcHints: {
            wu_da: { minAffinity: 15, hint: t('...算了，你不會想聽一個老頭子的嘮叨。') },
        },
    },
    {
        id: 'side_huang_festival',
        chapter: 2,
        title: t('黃莉的歌聲'),
        type: 'side',
        trigger: { mainQuest: 'ch2_community' },
        story: t('「你有沒有聽過邊境鎮的古老歌謠？」黃莉在教堂門口問你。「聽說以前每年豐收節，全鎮的人都會一起唱。要不要幫我恢復這個傳統？」'),
        description: t('幫助黃莉組織一場音樂會，凝聚鎮民的心。'),
        objectives: [
            { id: 'huang_friend', type: 'npc_affinity', npcId: 'huang_li', target: 30, label: t('和黃莉好感度達 30') },
            { id: 'pop_check', type: 'population', target: 13, label: t('鎮上至少有 13 位居民') },
            { id: 'avg_aff', type: 'avg_affinity', target: 15, label: t('全鎮平均好感度至少 15') },
        ],
        rewards: { silver: 30, reputation: 10 },
        onComplete: t('在黃莉的帶領下，整個小鎮的人聚在廣場上，一起唱著古老的豐收歌。有人笑，有人哭。這一刻，所有人都感受到了歸屬感。你看到陳偉偷偷擦了擦眼角。'),
        npcHints: {
            huang_li: { minAffinity: 15, hint: t('我在整理教堂時找到了一本很舊的歌譜。想不想聽我唱幾首？') },
        },
    },

    // ── 第三章支線 ──
    {
        id: 'side_yang_past',
        chapter: 3,
        title: t('楊鋒的戰爭記憶'),
        type: 'side',
        trigger: { mainQuest: 'ch3_crisis', npcAffinity: { yang_feng: 25 } },
        story: t('危機當前，楊鋒比任何人都緊張。你發現他半夜一個人在城牆上，盯著遠方。「我以前打過仗，」他低聲說，「我知道戰爭是什麼樣子。我不想讓這裡的人經歷那些...」'),
        description: t('了解楊鋒的過去，幫助他面對內心的恐懼。'),
        objectives: [
            { id: 'yang_deep', type: 'npc_affinity', npcId: 'yang_feng', target: 50, label: t('和楊鋒好感度達 50') },
            { id: 'chen_talk', type: 'npc_affinity', npcId: 'chen_wei', target: 30, label: t('和陳偉好感度達 30（兩個老兵互相理解）') },
        ],
        rewards: { silver: 50, reputation: 10 },
        onComplete: t('你把陳偉帶到楊鋒身邊。兩個曾經的軍人，第一次坦誠地聊起了戰爭的記憶。「我們不是為了打仗才來這裡的，」陳偉拍拍楊鋒的肩膀，「我們是為了保護要保護的人。」楊鋒的眼眶紅了，但背脊挺得更直了。'),
        npcHints: {
            yang_feng: { minAffinity: 20, hint: t('你有沒有失去過重要的人？...算了，當我沒問。') },
        },
    },
    {
        id: 'side_zhao_network',
        chapter: 3,
        title: t('趙霞的人脈'),
        type: 'side',
        trigger: { mainQuest: 'ch3_crisis', npcAffinity: { zhao_xia: 20 } },
        story: t('趙霞緊皺著眉頭在翻她的帳本。「外面的局勢比我想的嚴峻...不過我還有幾張底牌。」她抬頭看你，「要不要跟我一起跑一趟商路？」'),
        description: t('和趙霞一起拓展商業網絡，為小鎮爭取外援。'),
        objectives: [
            { id: 'zhao_friend', type: 'npc_affinity', npcId: 'zhao_xia', target: 45, label: t('和趙霞好感度達 45') },
            { id: 'trade_5', type: 'trade_count', target: 5, label: t('完成 5 次交易') },
        ],
        rewards: { silver: 80, reputation: 8 },
        onComplete: t('趙霞成功聯繫上了遠方的商會。「以後不管發生什麼事，我們都有退路了。」她少見地露出安心的表情。然後她轉頭對你說：「你知道嗎？你是我第一個信任的合夥人。」'),
        npcHints: {
            zhao_xia: { minAffinity: 15, hint: t('做生意最重要的是人脈。我可以帶你認識幾個有用的人。') },
        },
    },

    // ── 第四章支線 ──
    {
        id: 'side_ma_redemption',
        chapter: 4,
        title: t('浪子回頭'),
        type: 'side',
        trigger: { mainQuest: 'ch4_expansion', npcAffinity: { ma_qiang: 25 } },
        story: t('馬強最近變得不太一樣。他不再整天吹牛，而是認真地待在工坊裡。「我想替鎮上蓋一座真正的地標，」他說，「證明我不只是個嘴砲。」'),
        description: t('支持馬強的改變，幫他建造一座地標建築。'),
        objectives: [
            { id: 'ma_friend', type: 'npc_affinity', npcId: 'ma_qiang', target: 40, label: t('和馬強好感度達 40') },
            { id: 'build_many', type: 'building_count', target: 10, label: t('鎮上建築達 10 座') },
            { id: 'wood_supply', type: 'resource', resource: 'wood', target: 100, label: t('準備 100 木材') },
        ],
        rewards: { silver: 60, reputation: 12 },
        onComplete: t('馬強花了整整三天三夜，建造出一座精美的鐘塔。全鎮的人都來圍觀。「我這輩子第一次把一件事做到最好。」他看著自己的作品，眼角有些濕潤。王麗遞給他一碗熱湯：「吃吧，大藝術家。」'),
        npcHints: {
            ma_qiang: { minAffinity: 20, hint: t('你信不信，我其實是個天才木匠？...好啦，至少我想成為一個。') },
        },
    },
    {
        id: 'side_xu_dream',
        chapter: 4,
        title: t('許瑩的夢想'),
        type: 'side',
        trigger: { mainQuest: 'ch4_bonds', npcAffinity: { xu_ying: 30 } },
        story: t('你在許瑩的工坊裡看到一件華麗的禮服——但只完成了一半。「這是...我夢想中的作品。」她小聲說，「但我怕做不好，會被大家笑。」'),
        description: t('鼓勵許瑩完成她的夢想之作。'),
        objectives: [
            { id: 'xu_deep', type: 'npc_affinity', npcId: 'xu_ying', target: 50, label: t('和許瑩好感度達 50') },
            { id: 'cloth_supply', type: 'resource', resource: 'cloth', target: 40, label: t('收集 40 布料') },
        ],
        rewards: { silver: 35, reputation: 8 },
        onComplete: t('在你的支持下，許瑩完成了她的傑作。當她怯怯地把禮服展示給大家時，全場安靜了三秒——然後爆發出熱烈的掌聲。許瑩哭了，但這次是開心的眼淚。「謝謝你相信我...」'),
        npcHints: {
            xu_ying: { minAffinity: 25, hint: t('我有一件很重要的作品...但我還沒有勇氣完成它。') },
        },
    },

    // ── 第五章支線 ──
    {
        id: 'side_chen_retirement',
        chapter: 5,
        title: t('老鎮長的心願'),
        type: 'side',
        trigger: { mainQuest: 'ch5_legacy', npcAffinity: { chen_wei: 40 } },
        story: t('陳偉找到你，罕見地露出疲憊的表情。「我老了...這個鎮已經不需要我這樣的人了。」他望著窗外，「但在我交出這個位置之前，我想做最後一件事——寫一部邊境鎮的歷史。你願意幫我嗎？」'),
        description: t('幫助陳偉完成邊境鎮的歷史紀錄，讓後人銘記。'),
        objectives: [
            { id: 'chen_deep', type: 'npc_affinity', npcId: 'chen_wei', target: 60, label: t('和陳偉好感度達 60') },
            { id: 'high_rep', type: 'reputation', target: 60, label: t('聲望達到 60') },
            { id: 'many_friends', type: 'friends_count', target: 6, label: t('至少和 6 位居民成為朋友') },
        ],
        rewards: { silver: 100, reputation: 20 },
        onComplete: t('陳偉在最後一頁寫道：「...在這位旅人到來之後，邊境鎮真正活了過來。」他合上書，遞給你。「這本書是鎮上所有人的故事，但你是最重要的那一章。」你翻開扉頁，看到每一位居民都簽上了自己的名字。'),
        npcHints: {
            chen_wei: { minAffinity: 35, hint: t('你知道嗎？我來這裡已經二十年了。有時候我會想...這一切值不值得。') },
        },
    },
];

// ============================================================
// 每日小目標 — 保持遊戲節奏的短期目標
// ============================================================
// 根據遊戲進度動態生成，每次完成一個就自動換下一個
// ============================================================

const DAILY_OBJECTIVES = [
    // 早期目標（第一章）
    { id: 'daily_chat_1', chapter: 1, text: t('和一位居民聊聊天'), icon: '💬', condition: { type: 'chat_count', target: 1 }, reward: { silver: 5 } },
    { id: 'daily_food_20', chapter: 1, text: t('儲備 20 份食物'), icon: '🍖', condition: { type: 'resource', resource: 'food', target: 20 }, reward: { silver: 5 } },
    { id: 'daily_wood_15', chapter: 1, text: t('收集 15 份木材'), icon: '🪵', condition: { type: 'resource', resource: 'wood', target: 15 }, reward: { silver: 5 } },
    { id: 'daily_friend_1', chapter: 1, text: t('讓一位居民對你好感超過 10'), icon: '😊', condition: { type: 'max_affinity', target: 10 }, reward: { silver: 8 } },
    // 中期目標（第二、三章）
    { id: 'daily_harvest', chapter: 2, text: t('完成一次收穫'), icon: '🌾', condition: { type: 'harvest_count', target: 1 }, reward: { silver: 10 } },
    { id: 'daily_trade', chapter: 2, text: t('完成一次交易'), icon: '💰', condition: { type: 'trade_count', target: 1 }, reward: { silver: 10 } },
    { id: 'daily_build', chapter: 2, text: t('建造一座建築'), icon: '🏗️', condition: { type: 'building_count', target: 1 }, reward: { silver: 10 } },
    { id: 'daily_chat_5', chapter: 2, text: t('累計聊天達 5 次'), icon: '💬', condition: { type: 'chat_count', target: 5 }, reward: { silver: 8 } },
    { id: 'daily_silver_50', chapter: 2, text: t('累積 50 銀幣'), icon: '💰', condition: { type: 'resource', resource: 'silver', target: 50 }, reward: { reputation: 3 } },
    // 後期目標（第四、五章）
    { id: 'daily_industry', chapter: 4, text: t('開啟一個新產業'), icon: '🏭', condition: { type: 'industry_count', target: 1 }, reward: { silver: 15 } },
    { id: 'daily_friend_3', chapter: 4, text: t('擁有至少 3 位朋友'), icon: '🤝', condition: { type: 'friends_count', target: 3 }, reward: { silver: 12 } },
    { id: 'daily_pop_15', chapter: 4, text: t('人口達到 15 人'), icon: '👥', condition: { type: 'population', target: 15 }, reward: { silver: 15 } },
    { id: 'daily_aff_25', chapter: 4, text: t('全鎮平均好感度達 25'), icon: '❤️', condition: { type: 'avg_affinity', target: 25 }, reward: { reputation: 5 } },
];

// ============================================================
// 故事事件 — 在特定條件觸發的劇情對話
// ============================================================
// 增加遊戲的故事沉浸感，不是任務但會自動觸發
// ============================================================

const STORY_EVENTS = [
    {
        id: 'story_first_night',
        trigger: { tickCount: 96 },  // 第一天結束
        title: t('第一個夜晚'),
        text: t('夜幕降臨，你獨自坐在酒館門口。遠處傳來蟲鳴和偶爾的犬吠。王麗端了一碗熱湯出來：「喝吧，新來的。邊境鎮的夜晚很冷的。」你喝了一口，暖意從胃裡蔓延到全身。也許...這裡不算太糟。'),
        icon: '🌙',
    },
    {
        id: 'story_first_friend',
        trigger: { max_affinity: 20 },
        title: t('第一個朋友'),
        text: t('你發現有人開始主動跟你打招呼了——不再是禮貌性的點頭，而是真心的微笑。在這個偏遠的邊境小鎮，你交到了第一個朋友。原來被人接納的感覺，是這麼的好。'),
        icon: '🤝',
    },
    {
        id: 'story_first_harvest',
        trigger: { harvestCount: 1 },
        title: t('第一次豐收'),
        text: t('看著田裡金黃的麥穗隨風搖曳，你第一次理解了劉俊對土地的熱愛。「這就是我留在這裡的原因，」他站在你身邊，驕傲地說，「你種下的每一顆種子，都是對未來的承諾。」'),
        icon: '🌾',
    },
    {
        id: 'story_population_15',
        trigger: { population: 15 },
        title: t('小鎮漸成'),
        text: t('站在高處眺望，你發現小鎮不知不覺已經有了規模。新來的住戶正在搬家，孩子們在街上奔跑，商人們在廣場上討價還價。陳偉走到你身邊：「你看，這就是我們一起建造的。」他的語氣中帶著自豪。'),
        icon: '🏘️',
    },
    {
        id: 'story_crisis_begin',
        trigger: { storyFlag: 'ch3_crisis' },
        title: t('風雨欲來'),
        text: t('天邊烏雲密佈，鎮上的氣氛變得凝重。你看到楊鋒在磨刀，吳達在加固礦道，林美在準備草藥。每個人都在用自己的方式做準備。陳偉拍了拍你的肩膀：「不管發生什麼，我們一起面對。」'),
        icon: '⛈️',
    },
    {
        id: 'story_rebuild_hope',
        trigger: { storyFlag: 'ch3_rebuild' },
        title: t('廢墟中的希望'),
        text: t('危機過後，小鎮滿目瘡痍。但你看到黃莉在廢墟中唱歌，馬強已經在丈量重建的尺寸，王麗架起臨時的鍋灶煮飯。「沒什麼好怕的，」趙霞理了理頭髮，「重建也是一種商機嘛。」你笑了。這些人，才是邊境鎮真正的寶藏。'),
        icon: '🌅',
    },
    {
        id: 'story_deep_bond',
        trigger: { max_affinity: 60 },
        title: t('你是我們的一份子'),
        text: t('今天有人叫你「我們的人」而不是「那個旅人」。你在酒館裡坐著，四周是熟悉的面孔和笑聲。不知道從什麼時候開始，這裡不再是暫時的落腳處——這裡已經是你的家了。'),
        icon: '🏠',
    },
];

// ============================================================
// QuestSystem Class — 多路線引擎（含支線 + 每日目標 + 故事事件）
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
        // Side quest & daily objective tracking
        this.sideQuests = {};       // { sideQuestId: { status, objectives } }
        this.sideCompletedOrder = [];
        this.dailyObjective = null; // { id, startValue, completed }
        this.dailyCompletedIds = []; // Prevent repeats
        this.triggeredStoryEvents = []; // Story event IDs already shown
        this._pendingStoryEvent = null; // Event waiting to be displayed
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
        // Initialize side quests (all start as 'locked')
        for (const sq of SIDE_QUESTS) {
            if (this.sideQuests[sq.id]) continue;
            const state = { status: 'locked', objectives: {} };
            if (sq.objectives) {
                for (const obj of sq.objectives) {
                    state.objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            this.sideQuests[sq.id] = state;
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

        // Check side quests
        this._checkSideQuests(world);

        // Check daily objectives
        this._checkDailyObjective(world);

        // Check story events
        this._checkStoryEvents(world);
    }

    // ============================================================
    // Side quest management
    // ============================================================
    _checkSideQuests(world) {
        for (const sqDef of SIDE_QUESTS) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq) continue;

            // Check if locked side quest should be activated
            if (sq.status === 'locked') {
                if (this._checkSideQuestTrigger(sqDef, world)) {
                    sq.status = 'active';
                    world.logMessage?.('quest', `📜 ${t('支線任務解鎖')}：「${sqDef.title}」`);
                    if (sqDef.story) {
                        world.logMessage?.('quest', `📖 ${sqDef.story}`);
                    }
                }
                continue;
            }

            // Check active side quest progress
            if (sq.status === 'active' && sqDef.objectives) {
                let allDone = true;
                for (const objDef of sqDef.objectives) {
                    const obj = sq.objectives[objDef.id];
                    if (!obj) { allDone = false; continue; }
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
                    this._completeSideQuest(sqDef, world);
                }
            }
        }
    }

    _checkSideQuestTrigger(sqDef, world) {
        const trigger = sqDef.trigger;
        if (!trigger) return false;
        // Must have main quest completed or active
        if (trigger.mainQuest) {
            const mq = this.quests[trigger.mainQuest];
            if (!mq || (mq.status !== 'active' && mq.status !== 'completed')) return false;
        }
        // NPC affinity gates
        if (trigger.npcAffinity) {
            const player = world.agents?.player;
            for (const [npcId, minAff] of Object.entries(trigger.npcAffinity)) {
                const rel = player?.relationships?.relationships?.[npcId];
                if (!rel || (rel.affinity || 0) < minAff) return false;
            }
        }
        return true;
    }

    _completeSideQuest(sqDef, world) {
        const sq = this.sideQuests[sqDef.id];
        sq.status = 'completed';
        this.sideCompletedOrder.push(sqDef.id);
        // Give rewards
        if (sqDef.rewards) {
            for (const [res, amount] of Object.entries(sqDef.rewards)) {
                if (res === 'reputation') {
                    this.reputation += amount;
                } else {
                    world.stockpile?.add?.(res, amount, world.tickCount, `${t('支線獎勵')}：${sqDef.title}`);
                }
            }
        }
        world.logMessage?.('quest', `✨ ${t('支線任務完成')}：「${sqDef.title}」！`);
        if (sqDef.onComplete) {
            world.logMessage?.('quest', `📖 ${sqDef.onComplete}`);
        }
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `${t('支線任務')}「${sqDef.title}」${t('完成')}！`, 6);
        }
    }

    // ============================================================
    // Daily objective management
    // ============================================================
    _checkDailyObjective(world) {
        const chapter = this.getCurrentChapter();

        // Assign a new daily objective if none active
        if (!this.dailyObjective || this.dailyObjective.completed) {
            this._assignDailyObjective(world, chapter);
            return;
        }

        // Check current daily objective progress
        const objDef = DAILY_OBJECTIVES.find(d => d.id === this.dailyObjective.id);
        if (!objDef) return;

        const current = this._evaluateCondition(objDef.condition, world);
        const gained = current - (this.dailyObjective.startValue || 0);
        if (gained >= objDef.condition.target) {
            this.dailyObjective.completed = true;
            this.dailyCompletedIds.push(objDef.id);
            // Give reward
            if (objDef.reward) {
                for (const [res, amount] of Object.entries(objDef.reward)) {
                    if (res === 'reputation') {
                        this.reputation += amount;
                    } else {
                        world.stockpile?.add?.(res, amount, world.tickCount, t('每日目標獎勵'));
                    }
                }
            }
            world.logMessage?.('quest', `⭐ ${t('每日目標完成')}：${objDef.icon} ${objDef.text}！`);
        }
    }

    _assignDailyObjective(world, chapter) {
        // Find objectives matching current chapter (or earlier)
        const candidates = DAILY_OBJECTIVES.filter(d =>
            d.chapter <= chapter && !this.dailyCompletedIds.includes(d.id)
        );
        if (candidates.length === 0) {
            // Reset completed list to allow repeating
            this.dailyCompletedIds = [];
            return;
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const startValue = this._evaluateCondition(pick.condition, world);
        this.dailyObjective = { id: pick.id, startValue, completed: false };
    }

    // ============================================================
    // Story event management
    // ============================================================
    _checkStoryEvents(world) {
        for (const event of STORY_EVENTS) {
            if (this.triggeredStoryEvents.includes(event.id)) continue;
            if (this._checkStoryEventTrigger(event, world)) {
                this.triggeredStoryEvents.push(event.id);
                this._pendingStoryEvent = event;
                world.logMessage?.('event', `${event.icon} 【${event.title}】${event.text}`);
                break; // Only one story event per tick
            }
        }
    }

    _checkStoryEventTrigger(event, world) {
        const trigger = event.trigger;
        if (!trigger) return false;
        if (trigger.tickCount && world.tickCount >= trigger.tickCount) return true;
        if (trigger.population) {
            const pop = Object.keys(world.agents || {}).length;
            if (pop >= trigger.population) return true;
        }
        if (trigger.max_affinity) {
            const player = world.agents?.player;
            if (player?.relationships?.relationships) {
                const max = Math.max(0, ...Object.values(player.relationships.relationships).map(r => r.affinity || 0));
                if (max >= trigger.max_affinity) return true;
            }
        }
        if (trigger.harvestCount && this.harvestCount >= trigger.harvestCount) return true;
        if (trigger.storyFlag && this.storyFlags[trigger.storyFlag]) return true;
        return false;
    }

    getPendingStoryEvent() {
        const event = this._pendingStoryEvent;
        this._pendingStoryEvent = null;
        return event;
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
                    world.stockpile?.add?.(res, amount, world.tickCount, `${t('任務獎勵')}：${questDef.title}`);
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
        world.logMessage?.('quest', `⚔️ ${t('主線任務完成')}：「${questDef.title}」${routeMsg}！${questDef.onComplete}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `${t('主線任務')}「${questDef.title}」${routeMsg}${t('完成')}！${questDef.onComplete}`, 8);
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
                        world.logMessage?.('quest', `📜 ${t('新任務解鎖')}：「${nextDef.title}」`);
                    }

                    // If crisis quest, roll crisis type
                    if (nextDef?.isCrisis && !this.activeCrisis) {
                        const types = nextDef.crisisTypes || ['locust', 'bandit', 'plague'];
                        this.activeCrisis = types[Math.floor(Math.random() * types.length)];
                        const crisisNames = { locust: t('蝗災'), bandit: t('盜匪圍城'), plague: t('瘟疫') };
                        world.logMessage?.('quest', `⚠️ ${t('危機降臨')}：${crisisNames[this.activeCrisis] || this.activeCrisis}！`);
                        if (world.dailyNews) {
                            world.dailyNews.collectEvent?.('crisis', `${t('重大危機')}！${crisisNames[this.activeCrisis]}${t('威脅著小鎮的生存')}！`, 10);
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
        // Also check side quest hints
        for (const sqDef of SIDE_QUESTS) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq || sq.status !== 'active') continue;
            if (!sqDef.npcHints || !sqDef.npcHints[npcId]) continue;
            const hintDef = sqDef.npcHints[npcId];
            if (playerAffinity >= (hintDef.minAffinity || 0)) {
                hints.push({
                    questTitle: `[${t('支線')}] ${sqDef.title}`,
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
            let s = `${t('任務')}「${q.title}」：${q.description}`;
            if (q.routes) {
                const routeLabels = q.routes.map(r => r.label).join(t('、'));
                s += `（${t('可選路線')}：${routeLabels}）`;
            }
            return s;
        });
        return `${t('玩家正在進行的任務')}：${parts.join('；')}`;
    }

    // Get crisis description for prompt injection
    getCrisisContext() {
        if (!this.activeCrisis) return '';
        const desc = {
            locust: t('蝗災正在侵襲小鎮，農作物受到嚴重威脅。大家都很擔心糧食問題。'),
            bandit: t('盜匪在小鎮附近出沒，安全受到威脅。居民們人心惶惶。'),
            plague: t('一種神秘的疾病在小鎮蔓延，已有多人生病。大家急需醫療資源。'),
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

        // Side quests
        result.sideQuests = {};
        for (const sqDef of SIDE_QUESTS) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq || sq.status === 'locked') continue; // Only show active/completed
            result.sideQuests[sqDef.id] = {
                id: sqDef.id,
                chapter: sqDef.chapter,
                title: sqDef.title,
                description: sqDef.description,
                story: sqDef.story,
                status: sq.status,
                rewards: sqDef.rewards,
                onComplete: sqDef.onComplete,
                objectives: (sqDef.objectives || []).map(objDef => ({
                    ...objDef,
                    progress: sq.objectives?.[objDef.id]?.progress || 0,
                    completed: sq.objectives?.[objDef.id]?.completed || false,
                })),
            };
        }
        result.sideQuestCount = Object.keys(result.sideQuests).length;
        result.sideCompletedCount = this.sideCompletedOrder.length;

        // Daily objective
        if (this.dailyObjective && !this.dailyObjective.completed) {
            const objDef = DAILY_OBJECTIVES.find(d => d.id === this.dailyObjective.id);
            if (objDef) {
                result.dailyObjective = {
                    text: objDef.text,
                    icon: objDef.icon,
                    reward: objDef.reward,
                };
            }
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
            // Side quests & daily objectives
            sideQuests: JSON.parse(JSON.stringify(this.sideQuests)),
            sideCompletedOrder: [...this.sideCompletedOrder],
            dailyObjective: this.dailyObjective ? { ...this.dailyObjective } : null,
            dailyCompletedIds: [...this.dailyCompletedIds],
            triggeredStoryEvents: [...this.triggeredStoryEvents],
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
        // Side quests & daily objectives
        this.sideQuests = data.sideQuests || {};
        this.sideCompletedOrder = data.sideCompletedOrder || [];
        this.dailyObjective = data.dailyObjective || null;
        this.dailyCompletedIds = data.dailyCompletedIds || [];
        this.triggeredStoryEvents = data.triggeredStoryEvents || [];
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

        // Ensure ch1_settle is always at least 'active' — this is the starting quest
        if (this.quests['ch1_settle'] && this.quests['ch1_settle'].status === 'locked') {
            this.quests['ch1_settle'].status = 'active';
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
