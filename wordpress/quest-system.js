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


// ============================================================
// v5.83.0 海風鎮專屬任務鏈「潮聲」(第 1–3 章;第 4–5 章與支線 v5.84.0)
// 任務鏈依城鎮主題查表:QUEST_CHAINS_BY_THEME[theme];沒有表的鎮不跑主線(任務分頁顯示占位)
// ============================================================
const HARBOR_CHAPTER_NAMES = {
    1: t('第一章：上岸'),
    2: t('第二章：鹽與燈'),
    3: t('第三章：海菜與窗台'),
    4: t('第四章：颱風夜'),
    5: t('第五章：出海'),
};

const HARBOR_MAIN_QUESTS = [
    {
        id: 'hb1_arrive', chapter: 1,
        title: t('潮聲初聞'),
        description: t('你搭馬車來到海風鎮。先到海味居吃一頓，認識幾位討海人。'),
        hint: t('走到海味居坐一坐，跟掌杓的小鷗說上話，再找兩三位居民聊聊。'),
        objectives: [
            { id: 'talk_3', type: 'chat_count', target: 3, label: t('和 3 位居民交談') },
            { id: 'visit_tavern', type: 'visit_location', location: 'tavern', target: 1, label: t('到海味居坐一坐') },
            { id: 'talk_xiaoou', type: 'talk_to', npcId: 'hb_xiaoou', target: 1, label: t('和小鷗說上話') },
        ],
        rewards: { silver: 20, reputation: 5 },
        unlocks: ['hb1_explore'],
        onComplete: t('小鷗端上一碗熱騰騰的海鮮麵：「吃吧，海風鎮的規矩，新來的第一碗免費。」'),
        npcHints: {
            hb_xiaoou: { minAffinity: 0, hint: t('新來的？坐吧，我先給你下碗麵。') },
            hb_haibo: { minAffinity: 0, hint: t('海風鎮不大，走一圈就認識了。先去海味居，小鷗會照顧你。') },
        },
    },
    {
        id: 'hb1_explore', chapter: 1,
        title: t('走一圈海風鎮'),
        description: t('沿著海岸走一圈，看看鹽場、小廟和工房；順便向雲姨求一炷平安香。'),
        hint: t('在地圖上走訪三處地點（鹽場、海神小廟、曬網場、修船工房…），再去找廟祝雲姨聊聊。'),
        objectives: [
            { id: 'visit_3', type: 'visited', locations: ['quarry', 'chapel', 'park', 'well', 'workshop', 'library', 'clinic', 'general_store'], target: 3, label: t('走訪 3 處地點') },
            { id: 'yunyi', type: 'npc_affinity', npcId: 'hb_yunyi', target: 10, label: t('雲姨好感度達到 10') },
        ],
        rewards: { silver: 30, reputation: 5 },
        unlocks: ['hb2_wreck'],
        onComplete: t('雲姨把平安符塞進你手裡：「出海的人都帶一個，你也帶著吧。」'),
        npcHints: {
            hb_yunyi: { minAffinity: 0, hint: t('初來的人都該來小廟上一炷香，海神會記得你的名字。') },
        },
    },
    {
        id: 'hb2_wreck', chapter: 2,
        title: t('船難那一夜'),
        description: t('石叔和燈爺二十年沒說過一句話，鎮上沒人知道那晚發生了什麼。老漁當年也在船上——他比誰都清楚。'),
        hint: t('先去碼頭找老漁喝一杯問出那一夜，再決定要讓兩個老人和解，還是讓往事留在海裡。'),
        routes: [
            {
                id: 'reconcile', label: t('和解路線'), icon: '🕯️',
                description: t('問出真相，再把兩個老人拉到同一盞燈下。'),
                conditions: [
                    { type: 'talk_to', npcId: 'hb_laoyu', target: 2, label: t('向老漁問出那一夜（交談 2 次）') },
                    { type: 'npc_affinity', npcId: 'hb_shishu', target: 30, label: t('石叔好感度達到 30') },
                    { type: 'npc_affinity', npcId: 'hb_dengye', target: 30, label: t('燈爺好感度達到 30') },
                ],
                effects: { pairAffinity: [['hb_shishu', 'hb_dengye', 45], ['hb_dengye', 'hb_shishu', 45]], pairTrust: [['hb_shishu', 'hb_dengye', 30], ['hb_dengye', 'hb_shishu', 30]] },
                onComplete: t('石叔提著一壺酒走上燈塔崖，燈爺把燈芯撥亮了些。二十年的沉默，就在那盞燈下化掉了。'),
            },
            {
                id: 'silence', label: t('沉默路線'), icon: '🌊',
                description: t('有些事不必揭開，陪他們各自把日子過下去。'),
                conditions: [
                    { type: 'chat_count', target: 15, label: t('與居民交談 15 次') },
                    { type: 'npc_affinity', npcId: 'hb_laoyu', target: 25, label: t('老漁好感度達到 25') },
                    { type: 'npc_affinity', npcId: 'hb_shishu', target: 20, label: t('石叔好感度達到 20') },
                ],
                effects: { playerAffinity: [['hb_shishu', 10], ['hb_dengye', 10], ['hb_laoyu', 10]] },
                onComplete: t('老漁拍拍你的肩：「不是每個結都要解開。」海風照舊吹，兩個老人照舊各過各的，但你知道了那晚的事。'),
            },
        ],
        rewards: { silver: 60, reputation: 12 },
        unlocks: ['hb3_window'],
        onComplete: t('燈塔的燈那晚特別亮。'),
        npcHints: {
            hb_laoyu: { minAffinity: 10, hint: t('那晚的事…你真想知道？先讓我喝一杯。') },
            hb_shishu: { minAffinity: 20, hint: t('燈塔那老頭…哼。別跟我提他。') },
            hb_dengye: { minAffinity: 20, hint: t('石叔的事，我不想談。燈還得有人守。') },
        },
    },
    {
        id: 'hb3_window', chapter: 3,
        title: t('窗台上的海菜'),
        description: t('阿浮每天把最好的海菜放在珊珊窗台，從來不署名；望潮哨的阿帆也喜歡珊珊。你要幫誰？'),
        hint: t('和阿浮或阿帆混熟，替其中一個把心意送到珊珊那裡——送禮或傳話都行，但只能選一邊。'),
        routes: [
            {
                id: 'afu', label: t('替阿浮署名'), icon: '🌿',
                description: t('讓珊珊知道海菜是誰放的。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'hb_afu', target: 30, label: t('阿浮好感度達到 30') },
                    { type: 'gift_to', npcId: 'hb_shanshan', target: 1, label: t('替阿浮送一份禮給珊珊') },
                ],
                effects: { pairRomance: [['hb_shanshan', 'hb_afu', 30], ['hb_afu', 'hb_shanshan', 10]], pairAffinity: [['hb_shanshan', 'hb_afu', 20]], playerAffinity: [['hb_afan', -8]] },
                onComplete: t('珊珊終於知道海菜是誰放的。那天晚上，阿浮第一次在她窗前站了超過三秒。'),
            },
            {
                id: 'afan', label: t('替阿帆傳話'), icon: '🔭',
                description: t('把哨塔上那個人的心意帶到珊珊面前。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'hb_afan', target: 30, label: t('阿帆好感度達到 30') },
                    { type: 'talk_to', npcId: 'hb_shanshan', target: 2, label: t('替阿帆跟珊珊說上話（交談 2 次）') },
                ],
                effects: { pairRomance: [['hb_shanshan', 'hb_afan', 30], ['hb_afan', 'hb_shanshan', 10]], pairAffinity: [['hb_shanshan', 'hb_afan', 20]], playerAffinity: [['hb_afu', -8]] },
                onComplete: t('阿帆用望潮哨的望遠鏡讓珊珊看了一次颱風前的海——她記住了那片海，也記住了他。'),
            },
        ],
        rewards: { silver: 60, reputation: 12 },
        unlocks: ['hb4_typhoon'],
        onComplete: t('窗台上的海菜，從此有了名字。'),
        npcHints: {
            hb_afu: { minAffinity: 15, hint: t('海菜…不是我放的。（他的耳朵紅了）') },
            hb_afan: { minAffinity: 15, hint: t('你能幫我跟珊珊說句話嗎？我在哨塔上看她看了一年。') },
            hb_shanshan: { minAffinity: 10, hint: t('窗台上的海菜，每天都有。我其實…有點想知道是誰。') },
        },
    },
    {
        id: 'hb4_typhoon', chapter: 4,
        title: t('颱風夜'),
        description: t('阿帆從哨塔跑下來：颱風三天內登陸。整個鎮只有兩條路——把房子釘牢、把船拖上岸，或者祈禱。'),
        hint: t('囤木材 60、帆布 30 並跟哨長阿舵把守哨排好（加固路線），或靠阿帆與阿錨把漁船拖上岸避風（避風路線）。'),
        routes: [
            {
                id: 'brace', label: t('加固路線'), icon: '🪵',
                description: t('全鎮加固：木材釘窗、帆布蓋艙、守哨徹夜。'),
                conditions: [
                    { type: 'resource', resource: 'wood', target: 60, label: t('儲備 60 木材') },
                    { type: 'resource', resource: 'cloth', target: 30, label: t('儲備 30 帆布') },
                    { type: 'npc_affinity', npcId: 'hb_aduo', target: 25, label: t('阿舵好感度達到 25') },
                ],
                effects: { stockpile: { wood: -60, cloth: -30 }, prosperity: 10, flags: { lighthouseUpgraded: true }, playerAffinity: [['hb_aduo', 10], ['hb_dengye', 8]] },
                onComplete: t('風在半夜最大，整個鎮沒有一盞燈滅。天亮時燈爺把燈塔的燈換上了更亮的燈芯——「颱風夜守得住的鎮，燈就該更亮。」'),
            },
            {
                id: 'shelter', label: t('避風路線'), icon: '⛵',
                description: t('來不及加固，先把人和船拖上岸。'),
                conditions: [
                    { type: 'npc_affinity', npcId: 'hb_afan', target: 25, label: t('阿帆好感度達到 25') },
                    { type: 'npc_affinity', npcId: 'hb_amao', target: 20, label: t('阿錨好感度達到 20') },
                    { type: 'chat_count', target: 25, label: t('與居民交談 25 次') },
                ],
                effects: { stockpile: { food: -40 }, prosperity: 3, playerAffinity: [['hb_afan', 10], ['hb_amao', 8]] },
                onComplete: t('兩艘船沒拖上來，漁獲損失了一些；但沒有人受傷。海嬤說：「船可以再造，人不行。」'),
            },
        ],
        rewards: { silver: 80, reputation: 15 },
        unlocks: ['hb5_voyage'],
        onComplete: t('颱風過去了，海風鎮還在。'),
        npcHints: {
            hb_afan: { minAffinity: 0, hint: t('颱風三天內登陸，我在塔上看得清清楚楚。') },
            hb_aduo: { minAffinity: 10, hint: t('木材帆布備夠，守哨的事交給我。') },
            hb_amao: { minAffinity: 10, hint: t('船拖上岸要人手，你肯幫忙的話…') },
        },
    },
    {
        id: 'hb5_voyage', chapter: 5,
        title: t('出海'),
        description: t('颱風之後，海伯說該有一條自己的海路了。修好船、備好貨，首航市集城——海風鎮的名字要靠自己的帆送出去。'),
        hint: t('請阿錨修船、木蝦補板，備足 120 食物與 40 帆布，等商隊來過一次確認航路，就能出海。'),
        objectives: [
            { id: 'amao', type: 'npc_affinity', npcId: 'hb_amao', target: 30, label: t('阿錨好感度達到 30（修船）') },
            { id: 'muxia', type: 'npc_affinity', npcId: 'hb_muxia', target: 25, label: t('木蝦好感度達到 25（補板）') },
            { id: 'food', type: 'resource', resource: 'food', target: 120, label: t('備貨 120 食物') },
            { id: 'cloth', type: 'resource', resource: 'cloth', target: 40, label: t('備帆 40 帆布') },
            { id: 'caravan', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次（航路確認）') },
        ],
        rewards: { silver: 150, reputation: 25 },
        effects: { flags: { seaRoute: true }, prosperity: 5, playerAffinity: [['hb_haibo', 15], ['hb_langshu', 10]] },
        isFinale: false,
        onComplete: t('首航那天全鎮都在棧橋上。海伯親自掌舵，浪叔在船頭喊得比海浪還大聲。從此商隊兩天就來一趟，海風鎮的魚乾和帆布有了自己的航線。'),
        npcHints: {
            hb_haibo: { minAffinity: 10, hint: t('老骨頭還掌得了舵。你把船和貨備好，我帶你出海。') },
            hb_langshu: { minAffinity: 10, hint: t('市集城那邊我熟，首航我押船。') },
        },
    },
];

const HARBOR_SIDE_QUESTS = [
    {
        id: 'side_hb_haima_recipe', chapter: 1, type: 'side',
        title: t('傳家魚乾'),
        trigger: { mainQuest: 'hb1_arrive', npcAffinity: { hb_haima: 10 } },
        story: t('海嬤在海味居後廚翻出一本油漬斑斑的本子：「這是我阿嬤的醃法。你幫我備些魚，我做一批給你帶著。」'),
        description: t('幫海嬤備足魚獲，學她的傳家醃法。'),
        objectives: [
            { id: 'food', type: 'resource', resource: 'food', target: 80, label: t('儲備 80 食物') },
            { id: 'talk', type: 'talk_to', npcId: 'hb_haima', target: 2, label: t('跟海嬤聊 2 次') },
        ],
        rewards: { food: 30, silver: 15, reputation: 3 },
        onComplete: t('海嬤把一包魚乾塞進你懷裡：「鹽要三指、風要北風。這本子…以後也抄一份給你。」'),
        npcHints: { hb_haima: { minAffinity: 5, hint: t('我阿嬤的醃法快沒人會了，你想學嗎？') } },
    },
    {
        id: 'side_hb_yunyi_haibo', chapter: 1, type: 'side',
        title: t('廟前的經文'),
        trigger: { mainQuest: 'hb1_explore', npcAffinity: { hb_yunyi: 20 } },
        story: t('雲姨念經念到一半忽然停住——海伯剛好從廟前走過。她把那段經文又念了一遍，念錯了兩個字。'),
        description: t('聽聽雲姨沒說完的往事，再替她把海伯請到廟前。'),
        objectives: [
            { id: 'yunyi', type: 'talk_to', npcId: 'hb_yunyi', target: 2, label: t('跟雲姨聊 2 次') },
            { id: 'haibo', type: 'npc_affinity', npcId: 'hb_haibo', target: 25, label: t('海伯好感度達到 25') },
        ],
        rewards: { silver: 25, reputation: 5 },
        effects: { pairRomance: [['hb_yunyi', 'hb_haibo', 15], ['hb_haibo', 'hb_yunyi', 15]], pairAffinity: [['hb_yunyi', 'hb_haibo', 10], ['hb_haibo', 'hb_yunyi', 10]] },
        onComplete: t('海伯在廟前站了很久，雲姨那段經文終於一個字都沒念錯。「四十年了，」他說，「你念得還是比我記得的好聽。」'),
        npcHints: { hb_yunyi: { minAffinity: 15, hint: t('海伯年輕時…算了，經文還沒念完。') }, hb_haibo: { minAffinity: 15, hint: t('廟前那段經我聽過幾百遍了，每次她都在同一個地方停。') } },
    },
    {
        id: 'side_hb_kesao_topic', chapter: 1, type: 'side',
        title: t('蚵嫂的話題'),
        trigger: { mainQuest: 'hb1_explore', npcAffinity: { hb_kesao: 10 } },
        story: t('蚵嫂攔住你：「我家阿浮一天講不到三句話，你去跟他聊聊，看他到底在想什麼！」'),
        description: t('替蚵嫂去探探阿浮的心事。'),
        objectives: [
            { id: 'afu', type: 'talk_to', npcId: 'hb_afu', target: 2, label: t('跟阿浮聊 2 次') },
            { id: 'kesao', type: 'npc_affinity', npcId: 'hb_kesao', target: 25, label: t('蚵嫂好感度達到 25') },
        ],
        rewards: { silver: 20, reputation: 3 },
        effects: { pairAffinity: [['hb_afu', 'hb_kesao', 10], ['hb_kesao', 'hb_afu', 10]] },
        onComplete: t('你告訴蚵嫂：阿浮不是不想說，是說不出口。她愣了一下，那天晚上沒再追問兒子，只多煮了一碗湯。'),
        npcHints: { hb_kesao: { minAffinity: 5, hint: t('那孩子悶得我頭疼，你幫我問問。') } },
    },
    {
        id: 'side_hb_muxia_mermaid', chapter: 2, type: 'side',
        title: t('人魚的故事'),
        trigger: { mainQuest: 'hb2_wreck', npcAffinity: { hb_muxia: 15 } },
        story: t('木蝦躺在曬網場，第四次講他「差點抓到人魚」的故事。「不信？你到曬網場來，我證明給你看。」'),
        description: t('聽完木蝦的人魚故事，到曬網場看他的「證據」。'),
        objectives: [
            { id: 'talk', type: 'talk_to', npcId: 'hb_muxia', target: 3, label: t('聽木蝦講 3 次') },
            { id: 'park', type: 'visit_location', location: 'park', target: 1, label: t('到曬網場') },
        ],
        rewards: { silver: 20, reputation: 3 },
        onComplete: t('「證據」是一片會發光的鱗片——後來阿汐說那是深海魚的。木蝦不在乎：「人魚的鱗片當然像魚的鱗片。」'),
        npcHints: { hb_muxia: { minAffinity: 10, hint: t('人魚的事我只跟信的人講。你信嗎？') } },
    },
    {
        id: 'side_hb_ayan_salt', chapter: 2, type: 'side',
        title: t('鹽不過山'),
        trigger: { mainQuest: 'hb2_wreck', npcAffinity: { hb_ayan: 15 } },
        story: t('阿鹽把一袋鹽拍在桌上：「礦山鎮缺鹽，我們多的是鹽。石叔說鹽不過山——我偏要過。」'),
        description: t('等礦山鎮通車、商隊來過，幫阿鹽把海風鎮的鹽送上山。'),
        objectives: [
            { id: 'mt', type: 'neighbor_town', theme: 'mountain', target: 1, label: t('礦山鎮已通車') },
            { id: 'caravan', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次') },
            { id: 'ayan', type: 'npc_affinity', npcId: 'hb_ayan', target: 30, label: t('阿鹽好感度達到 30') },
        ],
        rewards: { silver: 40, reputation: 5 },
        effects: { playerAffinity: [['hb_shishu', 5]], pairAffinity: [['hb_shishu', 'hb_ayan', 10]] },
        onComplete: t('第一袋海風鎮的鹽上了山。石叔什麼都沒說，只把自己的鹽耙借給了阿鹽。'),
        npcHints: { hb_ayan: { minAffinity: 10, hint: t('山上的人吃鹽也要錢，為什麼不是我們賣？') } },
    },
    {
        id: 'side_hb_arong_dream', chapter: 3, type: 'side',
        title: t('繡坊夢'),
        trigger: { mainQuest: 'hb3_window', npcAffinity: { hb_arong: 15 } },
        story: t('阿蓉偷偷給你看一塊繡了整片海的帆布：「市集城有人要收。師父說我走了就別回來…你覺得呢？」'),
        description: t('幫阿蓉備齊布料，也幫她和秀姑把話說開。'),
        objectives: [
            { id: 'cloth', type: 'resource', resource: 'cloth', target: 50, label: t('儲備 50 布料') },
            { id: 'xiugu', type: 'npc_affinity', npcId: 'hb_xiugu', target: 25, label: t('秀姑好感度達到 25') },
            { id: 'arong', type: 'npc_affinity', npcId: 'hb_arong', target: 30, label: t('阿蓉好感度達到 30') },
        ],
        rewards: { silver: 30, reputation: 5 },
        effects: { pairAffinity: [['hb_xiugu', 'hb_arong', 15], ['hb_arong', 'hb_xiugu', 15]], pairTrust: [['hb_xiugu', 'hb_arong', 10]] },
        onComplete: t('秀姑把一整捆最好的帆布塞給阿蓉：「去。繡壞了再回來補帆。」她轉過身去，很久沒轉回來。'),
        npcHints: { hb_arong: { minAffinity: 10, hint: t('那塊繡了海的帆布…你覺得市集城的人會喜歡嗎？') }, hb_xiugu: { minAffinity: 15, hint: t('走了就別回來。…誰讓她針法比我好。') } },
    },
];

const HARBOR_STORY_EVENTS = [
    {
        id: 'hb_story_first_night', trigger: { tickCount: 96 },
        title: t('棧橋上的第一夜'), icon: '🌙',
        text: t('你坐在棧橋盡頭，燈塔的光每隔幾秒掃過海面。海嬤端來一碗魚湯：「海風鎮的夜晚只有浪聲，聽久了就睡得著。」'),
    },
    {
        id: 'hb_story_lighthouse', trigger: { storyFlag: 'hb2_wreck' },
        title: t('燈塔之夜'), icon: '🗼',
        text: t('那晚之後，燈塔的燈好像比以前亮了一點。出海的人說，海風鎮的燈從來沒有這麼好認過。'),
    },
    {
        id: 'hb_story_typhoon_warning', trigger: { storyFlag: 'hb3_window' },
        title: t('颱風警報'), icon: '🌀',
        text: t('阿帆從望潮哨一路跑下來，臉色發白：「東南方的雲…三天內會登陸。」海伯把全鎮叫到碼頭廣場，沒有人說話，只有浪聲變大了。'),
    },
    {
        id: 'hb_story_typhoon_night', trigger: { storyFlag: 'hb4_typhoon' },
        title: t('颱風夜'), icon: '⛈️',
        text: t('那一夜浪打上了棧橋，雨橫著下。你和全鎮擠在海味居裡，小鷗不停地煮麵，雲姨一直念經。天亮時風停了，有人哭了，更多人笑了。'),
    },
    {
        id: 'hb_story_first_voyage', trigger: { storyFlag: 'hb5_voyage' },
        title: t('首航'), icon: '⛵',
        text: t('船離開棧橋的時候，燈爺在燈塔上把燈點亮了——大白天的。「讓他們回頭看得見家。」'),
    },
];


// ============================================================
// mountain 專屬任務鏈(由 scripts 外的 chainbuild 產生;文案中英文都在 i18n)
// ============================================================
const MT_CHAPTER_NAMES = {
    1: t('第一章：下坑'),
    2: t('第二章：金脈的算式'),
    3: t('第三章：白姑的信'),
    4: t('第四章：塌方'),
    5: t('第五章：第七層'),
};
const MT_MAIN_QUESTS = [
    {
        id: 'mt1_arrive', chapter: 1,
        title: t('下坑第一天'),
        description: t('你跟著礦車上了山。礦燈酒館的阿杏說：「新來的先喝碗湯，礦山的規矩。」'),
        hint: t('先去礦燈酒館找阿杏，再跟礦工們聊聊；油伯那裡有礦山所有的故事。'),
        objectives: [{ id: 'o1', type: 'chat_count', target: 3, label: t('與居民交談 3 次') }, { id: 'o2', type: 'visit_location', location: 'tavern', label: t('走訪礦燈酒館'), target: 1 }, { id: 'o3', type: 'talk_to', npcId: 'mt_axing', target: 1, label: t('跟阿杏聊一次') }],
        rewards: {"silver": 20, "reputation": 3},
        unlocks: ["mt1_explore"],
        onComplete: t('阿杏把一碗蘿蔔湯推到你面前：「阿梯種的，醜是醜，甜。」'),
        npcHints: { mt_axing: { minAffinity: 0, hint: t('新來的？坐，湯先喝。') }, mt_youbo: { minAffinity: 0, hint: t('礦山的事你問我就對了，油燈底下什麼都聽得到。') } },
    },
    {
        id: 'mt1_explore', chapter: 1,
        title: t('摸一下護身符'),
        description: t('下坑前每個礦工都要去山神祠摸一下祠婆的護身符。走一圈礦山，再去祠裡見見她。'),
        hint: t('在地圖上走訪三處地點（主礦坑、山神祠、山泉浴場、熔爐鍛坊…），再去找守祠人祠婆聊聊。'),
        objectives: [{ id: 'o1', type: 'visited', locations: ["quarry", "chapel", "park", "well", "workshop", "library", "clinic", "general_store"], target: 3, label: t('走訪 3 處地點') }, { id: 'o2', type: 'npc_affinity', npcId: 'mt_cipo', target: 10, label: t('祠婆好感度達到 10') }],
        rewards: {"silver": 30, "reputation": 5},
        unlocks: ["mt2_vein"],
        onComplete: t('祠婆把一枚磨得發亮的銅牌掛在你脖子上：「進去的，都要出來。」'),
        npcHints: { mt_cipo: { minAffinity: 0, hint: t('下坑前來摸一下，山神會記得你的名字。') } },
    },
    {
        id: 'mt2_vein', chapter: 2,
        title: t('金脈的算式'),
        description: t('阿岩算出主礦坑第七層有金，礦爺卻不肯批准往下挖。小鑽說：批不批，我們自己下去看。'),
        hint: t('說服路線：和阿岩、礦爺混熟，替她把算式送到礦務所；下探路線：跟小鑽、阿鈴偷偷下去看一眼。'),
        routes: [
            { id: 'persuade', label: t('說服礦爺'), icon: '📐', description: t('把阿岩的礦脈圖攤在礦爺桌上，讓他親眼看。'), conditions: [{ type: 'npc_affinity', npcId: 'mt_ayan', target: 30, label: t('阿岩好感度達到 30') }, { type: 'npc_affinity', npcId: 'mt_kuangye', target: 30, label: t('礦爺好感度達到 30') }, { type: 'talk_to', npcId: 'mt_ayan', target: 2, label: t('聽阿岩講完算式（交談 2 次）') }], effects: {"flags": {"veinApproved": true}, "pairAffinity": [["mt_kuangye", "mt_ayan", 20], ["mt_ayan", "mt_kuangye", 15]], "playerAffinity": [["mt_ayan", 10]]}, onComplete: t('礦爺盯著那張圖看了半個鐘頭，最後只說了一句：「支架先補。」阿岩當晚把圖重畫了一遍，署上自己的名字。') },
            { id: 'sneak', label: t('偷偷下探'), icon: '🔦', description: t('夜裡跟小鑽和阿鈴提一盞燈，自己下去看第七層。'), conditions: [{ type: 'npc_affinity', npcId: 'mt_xiaozuan', target: 30, label: t('小鑽好感度達到 30') }, { type: 'npc_affinity', npcId: 'mt_aling', target: 25, label: t('阿鈴好感度達到 25') }, { type: 'chat_count', target: 15, label: t('與居民交談 15 次') }], effects: {"stockpile": {"metal": 40}, "playerAffinity": [["mt_kuangye", -8], ["mt_xiaozuan", 10]], "pairAffinity": [["mt_xiaozuan", "mt_ayan", 10]]}, onComplete: t('你們帶回一袋礦石和一身泥。阿鈴在燈下看了很久：「阿岩算得對。」第二天礦爺什麼都沒說，但看你的眼神變了。') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        unlocks: ["mt3_truth"],
        onComplete: t('第七層有金，整座礦山都知道了。'),
        npcHints: { mt_ayan: { minAffinity: 10, hint: t('我的算式沒錯，錯的是沒人肯看。') }, mt_kuangye: { minAffinity: 15, hint: t('往下挖？支架撐不撐得住你問過木根沒有？') }, mt_xiaozuan: { minAffinity: 10, hint: t('批不批有什麼差，今晚我們自己下去。') } },
    },
    {
        id: 'mt3_truth', chapter: 3,
        title: t('白姑的信'),
        description: t('坑口醫站的白姑整理了十年的塵肺病例，想寫一封信把礦山的真相寄出去。礦爺不想讓那封信離開這座山。'),
        hint: t('寄出去：和白姑熟到她肯把信交給你，付 60 銀子託阿晴的車送下山；先治人：備 30 草藥，陪她先把人治好。'),
        routes: [
            { id: 'send', label: t('寄出去'), icon: '✉️', description: t('真相該離開這座山，不管礦爺高不高興。'), conditions: [{ type: 'npc_affinity', npcId: 'mt_baigu', target: 30, label: t('白姑好感度達到 30') }, { type: 'talk_to', npcId: 'mt_baigu', target: 2, label: t('讀完白姑的病例（交談 2 次）') }, { type: 'resource', resource: 'silver', target: 60, label: t('準備 60 銀子（託車下山）') }], effects: {"stockpile": {"silver": -60}, "prosperity": 3, "playerAffinity": [["mt_baigu", 15], ["mt_kuangye", -10]], "pairAffinity": [["mt_kuangye", "mt_baigu", -10]]}, onComplete: t('信跟著阿晴的車下了山。一個月後邊境鎮的林醫師帶著兩箱藥上來——礦爺站在礦務所門口，沒攔，也沒迎。') },
            { id: 'heal', label: t('先治人'), icon: '🌿', description: t('信可以晚點寄，咳血的人等不了。'), conditions: [{ type: 'npc_affinity', npcId: 'mt_baigu', target: 25, label: t('白姑好感度達到 25') }, { type: 'resource', resource: 'herbs', target: 30, label: t('儲備 30 草藥') }], effects: {"stockpile": {"herbs": -30}, "playerAffinity": [["mt_laochui", 10], ["mt_youbo", 10], ["mt_baigu", 8]]}, onComplete: t('老錘和油伯咳得輕了些。白姑把信收進抽屜：「等坑裡的人都能喘氣了，再寄。」') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        effects: {"disaster": {"type": "tunnel_collapse", "daysUntil": 1}},
        unlocks: ["mt4_collapse"],
        onComplete: t('那天夜裡，主礦坑第三層傳來木頭斷裂的聲音。'),
        npcHints: { mt_baigu: { minAffinity: 10, hint: t('這些病例…十年了。我想把它寄出去，但礦爺不會讓這封信下山。') }, mt_aqing: { minAffinity: 10, hint: t('下山的車我每週跑一趟，帶信也行——銀子照算。') } },
    },
    {
        id: 'mt4_collapse', chapter: 4,
        title: t('塌方'),
        description: t('主礦坑的支架斷了，第三層正在往下塌。木根說還來得及加固，牛叔說先把人撤出來。'),
        hint: t('加固坑道：備 80 木材，請木根量撐木、老錘帶路下去（災害提早結束）；緊急撤離：靠牛叔和油伯把人叫出來，礦石損失一些。'),
        routes: [
            { id: 'brace', label: t('加固坑道'), icon: '🪵', description: t('趁第三層還撐得住，把新支架打進去。'), conditions: [{ type: 'resource', resource: 'wood', target: 80, label: t('儲備 80 木材') }, { type: 'npc_affinity', npcId: 'mt_mugen', target: 25, label: t('木根好感度達到 25') }, { type: 'npc_affinity', npcId: 'mt_laochui', target: 25, label: t('老錘好感度達到 25') }], effects: {"stockpile": {"wood": -80}, "prosperity": 10, "flags": {"tunnelBraced": true}, "endDisaster": "tunnel_collapse", "playerAffinity": [["mt_mugen", 10], ["mt_laochui", 8]]}, onComplete: t('老錘提著燈走在最前面，木根每走十步就敲一根撐木。天亮時第三層撐住了。二十年來老錘第一次說：「這回的安全，我信。」') },
            { id: 'evacuate', label: t('緊急撤離'), icon: '🚨', description: t('來不及了，先把人全部叫出坑。'), conditions: [{ type: 'npc_affinity', npcId: 'mt_niushu', target: 25, label: t('牛叔好感度達到 25') }, { type: 'npc_affinity', npcId: 'mt_youbo', target: 20, label: t('油伯好感度達到 20') }, { type: 'chat_count', target: 25, label: t('與居民交談 25 次') }], effects: {"stockpile": {"stone": -40, "metal": -20}, "prosperity": 3, "playerAffinity": [["mt_niushu", 10], ["mt_youbo", 8]]}, onComplete: t('牛叔的嗓門這次救了人。第三層埋了，兩車礦石沒了；但點名的時候，一個都沒少。') }
        ],
        rewards: {"silver": 80, "reputation": 15},
        unlocks: ["mt5_seventh"],
        onComplete: t('塌方過去了，礦山鎮還在。'),
        npcHints: { mt_mugen: { minAffinity: 10, hint: t('木材夠的話，我量得出每一根撐木該打在哪。') }, mt_laochui: { minAffinity: 15, hint: t('二十年前我是最後一個爬出來的。這次…我帶路。') }, mt_niushu: { minAffinity: 10, hint: t('別跟我講支架，先把人叫出來！') } },
    },
    {
        id: 'mt5_seventh', chapter: 5,
        title: t('第七層'),
        description: t('塌方之後，礦爺終於點了頭：往第七層挖。要阿岩的圖、鐵柱的鎬、足夠的工具和糧，還要一條把金礦運下山的商路。'),
        hint: t('和阿岩、鐵柱熟到他們肯一起下坑，備 20 工具與 100 食物，等商隊來過一次確認運路，就能開挖第七層。'),
        objectives: [{ id: 'o1', type: 'npc_affinity', npcId: 'mt_ayan', target: 35, label: t('阿岩好感度達到 35（礦脈圖）') }, { id: 'o2', type: 'npc_affinity', npcId: 'mt_tiezhu', target: 30, label: t('鐵柱好感度達到 30（鎬頭）') }, { id: 'o3', type: 'resource', resource: 'tools', target: 20, label: t('備 20 工具') }, { id: 'o4', type: 'resource', resource: 'food', target: 100, label: t('備糧 100 食物') }, { id: 'o5', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次（運路確認）') }],
        rewards: {"silver": 200, "reputation": 25},
        effects: {"flags": {"tradeRoute": true}, "prosperity": 5, "stockpile": {"metal": 60}, "playerAffinity": [["mt_kuangye", 15], ["mt_ayan", 10], ["mt_xiaozuan", 8]]},
        onComplete: t('第七層的第一鎬是礦爺親手下的，膝蓋跪在泥裡也沒人敢扶。金光照出來的時候，小鑽哭了，阿岩沒有——她在改圖。從此商隊兩天就來一趟，礦山鎮的礦石有了自己的商路。'),
        npcHints: { mt_kuangye: { minAffinity: 15, hint: t('第七層。你把人和東西備好，第一鎬我來。') }, mt_tiezhu: { minAffinity: 10, hint: t('第七層的石頭硬，我得重打一批鎬頭。') } },
    },
];
const MT_SIDE_QUESTS = [
    {
        id: 'side_mt_tiezhu_pick', chapter: 1, type: 'side',
        title: t('鐵柱的鎬頭'),
        trigger: { mainQuest: 'mt1_arrive', npcAffinity: {"mt_tiezhu": 10} },
        story: t('鐵柱把一把斷了頭的鎬扔在砧上：「坑裡的鎬一半是我十年前打的，該換了。你幫我弄些金屬來。」'),
        description: t('替鐵柱備足金屬，換一批新鎬頭。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'metal', target: 60, label: t('儲備 60 金屬') }, { id: 'o2', type: 'talk_to', npcId: 'mt_tiezhu', target: 2, label: t('跟鐵柱聊 2 次') }],
        rewards: {"silver": 15, "reputation": 3},
        effects: {"stockpile": {"metal": -30, "tools": 10}},
        onComplete: t('爐火燒了一整夜。天亮時砧上排著十把新鎬，鐵柱把最亮的那把遞給你：「別弄斷。」'),
        npcHints: { mt_tiezhu: { minAffinity: 5, hint: t('坑裡的鎬頭該換了，金屬夠我就開爐。') } },
    },
    {
        id: 'side_mt_cipo_charm', chapter: 1, type: 'side',
        title: t('祠婆的護身符'),
        trigger: { mainQuest: 'mt1_explore', npcAffinity: {"mt_cipo": 20} },
        story: t('祠婆擦著一枚沒人來領的護身符。「這枚是給老錘的，」她說，「他二十年沒來摸過了。」'),
        description: t('聽祠婆說完塌方那年的事，再把老錘請回山神祠。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'mt_cipo', target: 2, label: t('跟祠婆聊 2 次') }, { id: 'o2', type: 'npc_affinity', npcId: 'mt_laochui', target: 25, label: t('老錘好感度達到 25') }],
        rewards: {"silver": 25, "reputation": 5},
        effects: {"pairRomance": [["mt_cipo", "mt_laochui", 15], ["mt_laochui", "mt_cipo", 15]], "pairAffinity": [["mt_cipo", "mt_laochui", 10], ["mt_laochui", "mt_cipo", 10]]},
        onComplete: t('老錘在祠門口站了很久才進去。他摸了那枚護身符，祠婆沒說話，只是把燈撥亮了些。'),
        npcHints: { mt_cipo: { minAffinity: 15, hint: t('那枚護身符…是他的。你要是見到老錘，跟他說燈還亮著。') }, mt_laochui: { minAffinity: 15, hint: t('山神祠？二十年沒去了。護身符沒保住那三個人。') } },
    },
    {
        id: 'side_mt_xiaozuan_dream', chapter: 2, type: 'side',
        title: t('小鑽的金脈夢'),
        trigger: { mainQuest: 'mt2_vein', npcAffinity: {"mt_xiaozuan": 15} },
        story: t('小鑽蹲在礦圖室窗外：「她看圖的時候不看我。你幫我送點東西給她，讓她知道我也懂一點礦脈。」'),
        description: t('替小鑽把一份心意送到阿岩那裡。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'mt_xiaozuan', target: 2, label: t('跟小鑽聊 2 次') }, { id: 'o2', type: 'gift_to', npcId: 'mt_ayan', target: 1, label: t('替小鑽送一份禮給阿岩') }],
        rewards: {"silver": 20, "reputation": 3},
        effects: {"pairAffinity": [["mt_ayan", "mt_xiaozuan", 15]], "pairRomance": [["mt_ayan", "mt_xiaozuan", 8]]},
        onComplete: t('阿岩收下禮物時眉頭皺了一下，然後在礦脈圖的角落寫了一行小字：「小鑽說第五層偏東。」'),
        npcHints: { mt_xiaozuan: { minAffinity: 10, hint: t('你幫我送東西給阿岩好不好？我自己送她會以為是礦石。') } },
    },
    {
        id: 'side_mt_aqing_order', chapter: 3, type: 'side',
        title: t('阿晴的訂單'),
        trigger: { mainQuest: 'mt3_truth', npcAffinity: {"mt_aqing": 15} },
        story: t('阿晴拍著一張皺巴巴的單子：「邊境鎮趙老闆娘要一車石料換布料，這條線我跑了五年。你幫我湊夠貨，利潤分你。」'),
        description: t('替阿晴湊齊一車石料，換回布料和銀子。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'stone', target: 120, label: t('儲備 120 石材') }, { id: 'o2', type: 'talk_to', npcId: 'mt_aqing', target: 2, label: t('跟阿晴聊 2 次') }],
        rewards: {"reputation": 5},
        effects: {"stockpile": {"stone": -80, "cloth": 30, "silver": 40}},
        onComplete: t('車下山、車上山，阿晴把一疊布和一袋銀子丟在櫃台上：「趙老闆娘說下次要兩車。」繡姑已經在挑布了。'),
        npcHints: { mt_aqing: { minAffinity: 10, hint: t('石料湊夠一車我就下山，布料銀子分你一份。') } },
    },
];
const MT_STORY_EVENTS = [
    { id: 'mt_story_first_night', trigger: {"tickCount": 96}, title: t('礦燈初夜'), icon: '🪔', text: t('油伯提早一小時把坑口的油燈全點亮。你坐在礦車廣場，聽他講二十年前的塌方——「三個人沒出來。老錘是最後一個爬出來的。」') },
    { id: 'mt_story_rumble', trigger: {"storyFlag": "mt3_truth"}, title: t('坑道異響'), icon: '⚠️', text: t('夜裡主礦坑第三層傳來木頭斷裂的悶響。木根提著燈下去看了一眼，上來時臉色發白：「撐木裂了，明天就撐不住。」') },
    { id: 'mt_story_collapse_night', trigger: {"storyFlag": "mt4_collapse"}, title: t('塌方之夜'), icon: '⛏️', text: t('整座礦山一夜沒睡。天亮時祠婆在山神祠前點了一排燈，每一盞都對著坑口。老錘站在最後一盞燈旁邊，沒走。') },
    { id: 'mt_story_gold', trigger: {"storyFlag": "mt5_seventh"}, title: t('金光'), icon: '✨', text: t('第七層的燈照在礦壁上，金色一條一條像阿岩圖上畫的那樣。礦爺把第一塊礦石放進你手裡：「礦山鎮的第一塊金，你拿著。」') },
];


// ============================================================
// forest 專屬任務鏈(由 scripts 外的 chainbuild 產生;文案中英文都在 i18n)
// ============================================================
const FV_CHAPTER_NAMES = {
    1: t('第一章：進林'),
    2: t('第二章：第十四隻木雕'),
    3: t('第三章：護林與伐木'),
    4: t('第四章：山火'),
    5: t('第五章：那棵樹'),
};
const FV_MAIN_QUESTS = [
    {
        id: 'fv1_arrive', chapter: 1,
        title: t('篝火旁的第一碗湯'),
        description: t('馬車在林子口就停了，剩下的路得走。篝火場上桂嬸正在攪一鍋蘑菇湯：「新來的？先喝，再說話。」'),
        hint: t('先去松脂酒館找桂嬸，再跟村裡人聊聊；鋸哥知道誰家煮了什麼。'),
        objectives: [{ id: 'o1', type: 'chat_count', target: 3, label: t('與居民交談 3 次') }, { id: 'o2', type: 'visit_location', location: 'tavern', label: t('走訪松脂酒館'), target: 1 }, { id: 'o3', type: 'talk_to', npcId: 'fv_guishen', target: 1, label: t('跟桂嬸聊一次') }],
        rewards: {"silver": 20, "reputation": 3},
        unlocks: ["fv1_explore"],
        onComplete: t('桂嬸把湯碗收走：「帳不用算，這村裡沒人算帳。」鋸哥在旁邊吃第三碗。'),
        npcHints: { fv_guishen: { minAffinity: 0, hint: t('新來的？坐，湯快好了。') }, fv_juge: { minAffinity: 0, hint: t('村裡誰家煮了什麼我都知道，你想吃哪家？') } },
    },
    {
        id: 'fv1_explore', chapter: 1,
        title: t('繞古樹一圈'),
        description: t('樹婆說進村的人都要繞古樹走一圈，樹才認得你。走一圈林間村，再到古樹祭壇見她。'),
        hint: t('在地圖上走訪三處地點（伐木場、古樹祭壇、林中空地、木工坊…），再去找祭司樹婆聊聊。'),
        objectives: [{ id: 'o1', type: 'visited', locations: ["quarry", "chapel", "park", "well", "workshop", "library", "clinic", "general_store"], target: 3, label: t('走訪 3 處地點') }, { id: 'o2', type: 'npc_affinity', npcId: 'fv_shupo', target: 10, label: t('樹婆好感度達到 10') }],
        rewards: {"silver": 30, "reputation": 5},
        unlocks: ["fv2_carving"],
        onComplete: t('樹婆把一片古樹的葉子夾進你的衣領：「它記住你了。」'),
        npcHints: { fv_shupo: { minAffinity: 0, hint: t('繞古樹走一圈再來找我，樹才認得你。') } },
    },
    {
        id: 'fv2_carving', chapter: 2,
        title: t('第十四隻木雕'),
        description: t('阿松每個月送阿葉一隻木雕小動物，已經十四隻了，一句話也沒說過；守林人阿哨也在看阿葉。皮姑拉著你：「你去幫阿松問問。」'),
        hint: t('替阿松送禮（和阿松混熟、替他送一份禮給阿葉），或替阿哨傳話（和阿哨混熟、跟阿葉聊兩次）——只能選一邊。'),
        routes: [
            { id: 'asong', label: t('替阿松送第十五隻'), icon: '🪵', description: t('讓阿葉知道十四隻木雕是誰刻的、為什麼刻。'), conditions: [{ type: 'npc_affinity', npcId: 'fv_asong', target: 30, label: t('阿松好感度達到 30') }, { type: 'gift_to', npcId: 'fv_aye', target: 1, label: t('替阿松送一份禮給阿葉') }], effects: {"pairRomance": [["fv_aye", "fv_asong", 30], ["fv_asong", "fv_aye", 10]], "pairAffinity": [["fv_aye", "fv_asong", 20]], "playerAffinity": [["fv_ashao", -8]]}, onComplete: t('第十五隻是一隻鹿，底下刻了一行字。阿葉把十五隻排在藥草小屋的窗台上，那天晚上第一次主動去了木工坊。') },
            { id: 'ashao', label: t('替阿哨傳話'), icon: '🗼', description: t('把哨塔上那個人的心意帶到藥草小屋。'), conditions: [{ type: 'npc_affinity', npcId: 'fv_ashao', target: 30, label: t('阿哨好感度達到 30') }, { type: 'talk_to', npcId: 'fv_aye', target: 2, label: t('替阿哨跟阿葉說上話（交談 2 次）') }], effects: {"pairRomance": [["fv_aye", "fv_ashao", 30], ["fv_ashao", "fv_aye", 10]], "pairAffinity": [["fv_aye", "fv_ashao", 20]], "playerAffinity": [["fv_asong", -8]]}, onComplete: t('阿哨帶阿葉上了哨塔，讓她看了一次整片林子的日出。她後來說，從那上面，每一株草都看得到。') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        unlocks: ["fv3_forest"],
        onComplete: t('窗台上的木雕，從此有了故事。'),
        npcHints: { fv_asong: { minAffinity: 15, hint: t('十四隻了…她應該知道是我吧？應該吧？') }, fv_ashao: { minAffinity: 15, hint: t('你能幫我跟阿葉說句話嗎？我在塔上看她採藥看了一年。') }, fv_aye: { minAffinity: 10, hint: t('窗台上那些小動物…我其實一直想知道是誰刻的。') } },
    },
    {
        id: 'fv3_forest', chapter: 3,
        title: t('護林與伐木'),
        description: t('阿哨的本子記滿了伐木場砍掉的樹，他要林姥下禁伐令；鋸哥說不砍樹全村吃什麼。你站哪邊？'),
        hint: t('禁伐令：和阿哨、林姥混熟，聽完阿哨的本子；擴產：和鋸哥、桂嬸混熟，陪伐木場多砍一季（木材 +80）。'),
        routes: [
            { id: 'ban', label: t('禁伐令'), icon: '🌲', description: t('把阿哨的本子攤在林姥面前，讓古林喘口氣。'), conditions: [{ type: 'npc_affinity', npcId: 'fv_ashao', target: 30, label: t('阿哨好感度達到 30') }, { type: 'npc_affinity', npcId: 'fv_linlao', target: 30, label: t('林姥好感度達到 30') }, { type: 'talk_to', npcId: 'fv_ashao', target: 2, label: t('聽完阿哨的本子（交談 2 次）') }], effects: {"flags": {"loggingBan": true}, "prosperity": 3, "pairAffinity": [["fv_linlao", "fv_ashao", 15], ["fv_ashao", "fv_juge", 12], ["fv_juge", "fv_ashao", 8]], "playerAffinity": [["fv_juge", -8], ["fv_ashao", 10]]}, onComplete: t('林姥在篝火場宣布：古林以東不許下斧。鋸哥罵了三天，第四天帶人去東邊種樹——「砍不了就種，反正手閒不下來。」') },
            { id: 'expand', label: t('擴產'), icon: '🪓', description: t('村裡要過冬，伐木場再砍一季。'), conditions: [{ type: 'npc_affinity', npcId: 'fv_juge', target: 30, label: t('鋸哥好感度達到 30') }, { type: 'npc_affinity', npcId: 'fv_guishen', target: 25, label: t('桂嬸好感度達到 25') }, { type: 'chat_count', target: 15, label: t('與居民交談 15 次') }], effects: {"stockpile": {"wood": 80}, "playerAffinity": [["fv_ashao", -10], ["fv_juge", 10]], "pairAffinity": [["fv_ashao", "fv_juge", -8]]}, onComplete: t('伐木場多砍了一季，木料堆到篝火場邊。阿哨的本子又多了兩頁，他把本子合上，沒再說話。') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        effects: {"disaster": {"type": "wildfire", "daysUntil": 1}},
        unlocks: ["fv4_fire"],
        onComplete: t('那天傍晚，伐木場那頭的天空是橘色的。'),
        npcHints: { fv_ashao: { minAffinity: 10, hint: t('本子上每一棵都是我親手記的。你要看嗎？') }, fv_juge: { minAffinity: 10, hint: t('不砍樹？那你告訴我冬天燒什麼。') }, fv_linlao: { minAffinity: 15, hint: t('樹跟人一樣，都要留一口氣。') } },
    },
    {
        id: 'fv4_fire', chapter: 4,
        title: t('山火'),
        description: t('伐木場的乾枝燒起來了，風往千年古林吹。大熊說開防火線還來得及，鹿娘說先把人和鹿趕出去。'),
        hint: t('開防火線：備 60 木材，大熊帶路、木叔砍出隔離帶（災害立刻結束）；疏散：靠鹿娘和阿矢把人和鹿趕到鏡池邊，藥草損失一些。'),
        routes: [
            { id: 'firebreak', label: t('開防火線'), icon: '🔥', description: t('在火頭前面砍出一條空地，讓火燒到這裡就停。'), conditions: [{ type: 'resource', resource: 'wood', target: 60, label: t('儲備 60 木材') }, { type: 'npc_affinity', npcId: 'fv_daxiong', target: 25, label: t('大熊好感度達到 25') }, { type: 'npc_affinity', npcId: 'fv_mushu', target: 25, label: t('木叔好感度達到 25') }], effects: {"stockpile": {"wood": -60}, "prosperity": 10, "flags": {"firebreak": true}, "endDisaster": "wildfire", "playerAffinity": [["fv_daxiong", 10], ["fv_mushu", 8]]}, onComplete: t('大熊走在最前面，木叔的斧頭一夜沒停。天亮時火停在隔離帶前三步。古林一棵也沒少。') },
            { id: 'evacuate', label: t('疏散'), icon: '🦌', description: t('來不及了，先把人和鹿趕到水邊。'), conditions: [{ type: 'npc_affinity', npcId: 'fv_luniang', target: 25, label: t('鹿娘好感度達到 25') }, { type: 'npc_affinity', npcId: 'fv_ashi', target: 20, label: t('阿矢好感度達到 20') }, { type: 'chat_count', target: 25, label: t('與居民交談 25 次') }], effects: {"stockpile": {"herbs": -40, "food": -20}, "prosperity": 3, "playerAffinity": [["fv_luniang", 10], ["fv_ashi", 8]]}, onComplete: t('鹿娘的鹿群跑在最前面，全村跟著鹿走到鏡池邊。藥草小屋燒掉了半邊；但點名的時候，人和鹿一個都沒少。') }
        ],
        rewards: {"silver": 80, "reputation": 15},
        unlocks: ["fv5_tree"],
        onComplete: t('山火過去了，林間村還在。'),
        npcHints: { fv_daxiong: { minAffinity: 10, hint: t('木材備夠，防火線我來開。') }, fv_luniang: { minAffinity: 10, hint: t('鹿知道往哪跑，跟著鹿走。') }, fv_mushu: { minAffinity: 10, hint: t('砍隔離帶要看紋理，我來。') } },
    },
    {
        id: 'fv5_tree', chapter: 5,
        title: t('那棵樹'),
        description: t('火之後，老樵終於肯帶路去找那棵不能砍的樹。阿苔想記下它，林姥想用它的種子換一條通往外面的路。備好糧和藥草，等商隊來過一次。'),
        hint: t('和老樵、阿苔熟到他們肯帶路，備 80 草藥與 100 食物，等商隊來過一次確認路線，就能進林子深處。'),
        objectives: [{ id: 'o1', type: 'npc_affinity', npcId: 'fv_laoqiao', target: 35, label: t('老樵好感度達到 35（帶路）') }, { id: 'o2', type: 'npc_affinity', npcId: 'fv_atai', target: 30, label: t('阿苔好感度達到 30（記錄）') }, { id: 'o3', type: 'resource', resource: 'herbs', target: 80, label: t('備 80 草藥') }, { id: 'o4', type: 'resource', resource: 'food', target: 100, label: t('備糧 100 食物') }, { id: 'o5', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次（路線確認）') }],
        rewards: {"silver": 200, "reputation": 25},
        effects: {"flags": {"tradeRoute": true}, "prosperity": 5, "stockpile": {"herbs": 60}, "playerAffinity": [["fv_linlao", 15], ["fv_laoqiao", 10], ["fv_atai", 8]]},
        onComplete: t('那棵樹真的在。老樵在樹下站了很久，說從今晚起不會再做那個夢了。阿苔畫了三天，林姥撿了一袋種子。從此商隊兩天就來一趟，林間村的木料和藥草有了自己的商路。'),
        npcHints: { fv_laoqiao: { minAffinity: 15, hint: t('那棵樹…好，我帶你去。你把糧備好，路很長。') }, fv_atai: { minAffinity: 10, hint: t('如果那棵樹真的在，我要把它畫下來。') } },
    },
];
const FV_SIDE_QUESTS = [
    {
        id: 'side_fv_asong_carving', chapter: 1, type: 'side',
        title: t('阿松的木雕'),
        trigger: { mainQuest: 'fv1_arrive', npcAffinity: {"fv_asong": 10} },
        story: t('阿松把一塊沒紋理的木頭丟到一邊：「好木料都給伐木場賣了。你幫我弄些木材來，我刻一批小動物，阿狐說城裡搶著要。」'),
        description: t('替阿松備足木材，讓他刻一批木雕去賣。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'wood', target: 60, label: t('儲備 60 木材') }, { id: 'o2', type: 'talk_to', npcId: 'fv_asong', target: 2, label: t('跟阿松聊 2 次') }],
        rewards: {"reputation": 3},
        effects: {"stockpile": {"wood": -30, "silver": 25}},
        onComplete: t('一批小鹿小熊跟著阿狐的車下了山，回來的是一袋銀子。阿松留了一隻沒賣——「這隻是給她的。」'),
        npcHints: { fv_asong: { minAffinity: 5, hint: t('木材夠的話我能刻一批去賣，你幫我弄些來？') } },
    },
    {
        id: 'side_fv_linlao_reason', chapter: 1, type: 'side',
        title: t('林姥進林子的原因'),
        trigger: { mainQuest: 'fv1_explore', npcAffinity: {"fv_shupo": 20} },
        story: t('樹婆擦著祭壇，忽然說：「你知道林姥年輕時為什麼一個人進林子住了十年嗎？全村只有我知道。」'),
        description: t('聽樹婆說完五十年前的事，再去看看林姥。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'fv_shupo', target: 2, label: t('跟樹婆聊 2 次') }, { id: 'o2', type: 'npc_affinity', npcId: 'fv_linlao', target: 25, label: t('林姥好感度達到 25') }],
        rewards: {"silver": 25, "reputation": 5},
        effects: {"pairAffinity": [["fv_linlao", "fv_laoqiao", 10], ["fv_laoqiao", "fv_linlao", 10]], "pairRomance": [["fv_linlao", "fv_laoqiao", 10], ["fv_laoqiao", "fv_linlao", 10]]},
        onComplete: t('原來那十年，是在等一個砍倒千年古木之後不敢回村的人。林姥聽你說完，只是笑了笑：「樹婆嘴還是這麼碎。」那天晚上老樵的木屋多了一盞燈。'),
        npcHints: { fv_shupo: { minAffinity: 15, hint: t('林姥那十年…你想聽嗎？別跟她說是我講的。') }, fv_linlao: { minAffinity: 15, hint: t('樹婆跟你說了什麼？她嘴碎了五十年了。') } },
    },
    {
        id: 'side_fv_daxiong_trap', chapter: 2, type: 'side',
        title: t('大熊的陷阱'),
        trigger: { mainQuest: 'fv2_carving', npcAffinity: {"fv_daxiong": 15} },
        story: t('大熊蹲在獵人小屋門口修陷阱，鹿娘在菜園那頭瞪他。「十年了，」他說，「她還是覺得我會打她的鹿。你幫我跟她說，陷阱都避開鹿道的。」'),
        description: t('聽大熊說完陷阱的事，替他跟鹿娘說清楚。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'fv_daxiong', target: 2, label: t('跟大熊聊 2 次') }, { id: 'o2', type: 'npc_affinity', npcId: 'fv_luniang', target: 20, label: t('鹿娘好感度達到 20') }],
        rewards: {"food": 30, "silver": 15, "reputation": 3},
        effects: {"pairAffinity": [["fv_daxiong", "fv_luniang", 12], ["fv_luniang", "fv_daxiong", 12]], "pairTrust": [["fv_daxiong", "fv_luniang", 10], ["fv_luniang", "fv_daxiong", 10]]},
        onComplete: t('鹿娘聽完，走到陷阱邊看了一圈，真的都避開了鹿道。她沒說話，那天晚上大熊的碗裡多了一塊肉。'),
        npcHints: { fv_daxiong: { minAffinity: 10, hint: t('陷阱都避開鹿道的，她就是不信。你幫我說。') } },
    },
    {
        id: 'side_fv_aye_recipe', chapter: 3, type: 'side',
        title: t('藥草小屋的配方'),
        trigger: { mainQuest: 'fv3_forest', npcAffinity: {"fv_aye": 15} },
        story: t('阿葉把一張配方攤在桌上：「邊境鎮的林醫師要一批止血藥。我一個人配不完，你幫我備草藥，賣的錢分你。」'),
        description: t('替阿葉備足草藥，配一批止血藥賣去邊境鎮。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'herbs', target: 100, label: t('儲備 100 草藥') }, { id: 'o2', type: 'talk_to', npcId: 'fv_aye', target: 2, label: t('跟阿葉聊 2 次') }],
        rewards: {"reputation": 5},
        effects: {"stockpile": {"herbs": -60, "silver": 50}},
        onComplete: t('一批止血藥跟著阿狐的車下了山。阿葉把配方抄了一份給你：「下次認錯一株草，記得翻這個。」'),
        npcHints: { fv_aye: { minAffinity: 10, hint: t('草藥夠的話我能配一批止血藥，你幫我備？') } },
    },
];
const FV_STORY_EVENTS = [
    { id: 'fv_story_first_night', trigger: {"tickCount": 96}, title: t('篝火初夜'), icon: '🔥', text: t('篝火場的火燒到半夜，老樵坐在最外圈，說林子深處有一棵不能砍的樹。阿矢說他不信，阿苔說她要去找。') },
    { id: 'fv_story_smoke', trigger: {"storyFlag": "fv3_forest"}, title: t('林子裡的煙'), icon: '💨', text: t('傍晚阿哨從哨塔上看到伐木場那頭冒煙。他跑下塔的時候，鋸哥已經提著水桶往那邊去了。') },
    { id: 'fv_story_fire_night', trigger: {"storyFlag": "fv4_fire"}, title: t('山火之夜'), icon: '🔥', text: t('整個林間村一夜沒睡。天亮時樹婆帶全村繞古樹走了一圈，比春天那一圈走得慢很多。林姥走在最後，摸了每一棵樹。') },
    { id: 'fv_story_tree', trigger: {"storyFlag": "fv5_tree"}, title: t('那棵樹'), icon: '🌳', text: t('它比老樵說的還大。阿苔的畫紙不夠，林姥撿種子撿到天黑。老樵坐在樹根上，說了一句誰也沒聽清的話——樹婆說，那是道歉。') },
];


// ============================================================
// market 專屬任務鏈(由 scripts 外的 chainbuild 產生;文案中英文都在 i18n)
// ============================================================
const MK_CHAPTER_NAMES = {
    1: t('第一章：進城'),
    2: t('第二章：老帳的那筆帳'),
    3: t('第三章：綵姑等的人'),
    4: t('第四章：商隊劫案'),
    5: t('第五章：五鎮商會'),
};
const MK_MAIN_QUESTS = [
    {
        id: 'mk1_arrive', chapter: 1,
        title: t('金馬車的第一夜'),
        description: t('城門衛所盤問了你三遍才放行。金馬車客棧的肥叔隔著酒桌喊：「新來的？先坐，酒錢記帳。」'),
        hint: t('先去金馬車客棧找肥叔，再跟城裡人聊聊；商隊的消息都在他的酒桌上。'),
        objectives: [{ id: 'o1', type: 'chat_count', target: 3, label: t('與居民交談 3 次') }, { id: 'o2', type: 'visit_location', location: 'tavern', label: t('走訪金馬車客棧'), target: 1 }, { id: 'o3', type: 'talk_to', npcId: 'mk_feishu', target: 1, label: t('跟肥叔聊一次') }],
        rewards: {"silver": 20, "reputation": 3},
        unlocks: ["mk1_explore"],
        onComplete: t('肥叔在帳本上寫下你的名字：「市集城的規矩，第一杯免費，第二杯記著。」'),
        npcHints: { mk_feishu: { minAffinity: 0, hint: t('新來的？坐，第一杯我請。') }, mk_asun: { minAffinity: 0, hint: t('城裡攤主的事我都知道，你想問誰？') } },
    },
    {
        id: 'mk1_explore', chapter: 1,
        title: t('求一炷財香'),
        description: t('財叔說進城做生意的人都要到財神廟上一炷香。走一圈大市集，再去廟裡見他。'),
        hint: t('在地圖上走訪三處地點（磚窯、財神廟、噴泉花園、百工坊…），再去找廟祝財叔聊聊。'),
        objectives: [{ id: 'o1', type: 'visited', locations: ["quarry", "chapel", "park", "well", "workshop", "library", "clinic", "general_store"], target: 3, label: t('走訪 3 處地點') }, { id: 'o2', type: 'npc_affinity', npcId: 'mk_caishu', target: 10, label: t('財叔好感度達到 10') }],
        rewards: {"silver": 30, "reputation": 5},
        unlocks: ["mk2_ledger"],
        onComplete: t('財叔笑得見牙不見眼：「會發會發。」他自己的長衫袖口破了個洞。'),
        npcHints: { mk_caishu: { minAffinity: 0, hint: t('做生意的先來上炷香，會發會發。') } },
    },
    {
        id: 'mk2_ledger', chapter: 2,
        title: t('老帳的那筆帳'),
        description: t('老帳四十年沒算錯一分錢，夜裡對帳卻對出一筆不該存在的款項——流向金老爺的私帳。窯叔說那是全城磚價被壓的錢。'),
        hint: t('揭發：和老帳、窯叔混熟，聽完那筆帳，把帳攤到商會桌上；壓下：和金老爺、鳳姨混熟，讓帳本翻過去。'),
        routes: [
            { id: 'expose', label: t('揭發'), icon: '📒', description: t('把那筆帳攤在商會大樓的桌上，讓全城知道。'), conditions: [{ type: 'npc_affinity', npcId: 'mk_laozhang', target: 30, label: t('老帳好感度達到 30') }, { type: 'talk_to', npcId: 'mk_laozhang', target: 2, label: t('聽完那筆帳（交談 2 次）') }, { type: 'npc_affinity', npcId: 'mk_yaoshu', target: 25, label: t('窯叔好感度達到 25') }], effects: {"flags": {"ledgerExposed": true}, "stockpile": {"silver": 80}, "prosperity": 3, "pairAffinity": [["mk_yaoshu", "mk_jinlaoye", 12], ["mk_laozhang", "mk_jinlaoye", -10]], "playerAffinity": [["mk_laozhang", 12], ["mk_yaoshu", 10], ["mk_jinlaoye", -12], ["mk_fengyi", -8]]}, onComplete: t('商會開了一整夜的會。天亮時那筆款項退回了公帳，窯叔的磚價漲回三成。金老爺沒看你，鳳姨看了你很久。') },
            { id: 'bury', label: t('壓下'), icon: '🤫', description: t('有些帳翻過去就好，城裡的生意還要做。'), conditions: [{ type: 'npc_affinity', npcId: 'mk_jinlaoye', target: 30, label: t('金老爺好感度達到 30') }, { type: 'npc_affinity', npcId: 'mk_fengyi', target: 25, label: t('鳳姨好感度達到 25') }, { type: 'chat_count', target: 15, label: t('與居民交談 15 次') }], effects: {"stockpile": {"silver": 120}, "playerAffinity": [["mk_jinlaoye", 12], ["mk_fengyi", 10], ["mk_laozhang", -10], ["mk_yaoshu", -8]], "pairTrust": [["mk_laozhang", "mk_jinlaoye", -10]]}, onComplete: t('鳳姨把大市集最好位置的攤位租約放在你手裡：「聰明人才留得住攤位。」老帳那晚把帳本合上，沒再翻開那一頁。') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        unlocks: ["mk3_wait"],
        onComplete: t('那筆帳，全城都有了自己的說法。'),
        npcHints: { mk_laozhang: { minAffinity: 10, hint: t('四十年沒算錯一分錢…這筆，我該說嗎？') }, mk_yaoshu: { minAffinity: 10, hint: t('磚價被壓了十年，錢去哪了你問老帳。') }, mk_jinlaoye: { minAffinity: 15, hint: t('帳本的事…城裡的生意要做，有些頁翻過去就好。') } },
    },
    {
        id: 'mk3_wait', chapter: 3,
        title: t('綵姑等的人'),
        description: t('戲班散了十年，綵姑還在等一個說好要回來的人；城門的門叔每天經過她的攤子多看兩眼。你要幫她找，還是幫她放下？'),
        hint: t('找人：和綵姑混熟，託駝姐跑五鎮打聽（跟駝姐聊兩次、40 銀幣路費）；替門叔說話：和門叔混熟，替他送一份禮給綵姑。'),
        routes: [
            { id: 'search', label: t('託駝姐找人'), icon: '🐪', description: t('五個鎮總有人見過那個人。'), conditions: [{ type: 'npc_affinity', npcId: 'mk_caigu', target: 30, label: t('綵姑好感度達到 30') }, { type: 'talk_to', npcId: 'mk_tuojie', target: 2, label: t('託駝姐打聽（交談 2 次）') }, { type: 'resource', resource: 'silver', target: 40, label: t('準備 40 銀幣路費') }], effects: {"stockpile": {"silver": -40}, "playerAffinity": [["mk_caigu", 15], ["mk_tuojie", 8]], "pairAffinity": [["mk_caigu", "mk_tuojie", 12]]}, onComplete: t('駝姐從礦山鎮帶回消息：那個人三年前在坑裡沒出來。綵姑把嫁衣收進箱底，第二天攤子照開。「等到答案了，」她說，「也算等到了。」') },
            { id: 'menshu', label: t('替門叔說話'), icon: '🛡️', description: t('城門那個鐵面的人，看了她的攤子十年。'), conditions: [{ type: 'npc_affinity', npcId: 'mk_menshu', target: 30, label: t('門叔好感度達到 30') }, { type: 'gift_to', npcId: 'mk_caigu', target: 1, label: t('替門叔送一份禮給綵姑') }], effects: {"pairRomance": [["mk_caigu", "mk_menshu", 30], ["mk_menshu", "mk_caigu", 10]], "pairAffinity": [["mk_caigu", "mk_menshu", 20]]}, onComplete: t('綵姑收下禮物，隔天給門叔的衛隊做了一套新的戲服——不，是新的制服。門叔那天盤問商隊只問了一遍。') }
        ],
        rewards: {"silver": 60, "reputation": 12},
        effects: {"disaster": {"type": "caravan_raid", "daysUntil": 1}},
        unlocks: ["mk4_raid"],
        onComplete: t('城外十里，駝姐的商隊沒按時進城。'),
        npcHints: { mk_caigu: { minAffinity: 10, hint: t('他說好要回來的。十年了，我還在等。') }, mk_menshu: { minAffinity: 15, hint: t('她的攤子…我看了十年。你能替我說句話嗎？') }, mk_tuojie: { minAffinity: 10, hint: t('找人？五個鎮我都跑，路費照算。') } },
    },
    {
        id: 'mk4_raid', chapter: 4,
        title: t('商隊劫案'),
        description: t('駝姐的商隊在城外被馬賊劫了，城門緊閉，市集停擺。門叔要銀子加強守衛，肥叔說馬賊要的只是贖金。'),
        hint: t('加強守衛：備 80 銀幣，門叔帶衛隊、阿鋼打兵器出城清剿（災害立刻結束）；贖回：付 150 銀幣，靠駝姐和肥叔的酒桌把貨和人贖回來。'),
        routes: [
            { id: 'guard', label: t('加強守衛'), icon: '⚔️', description: t('衛隊出城，把路清乾淨。'), conditions: [{ type: 'resource', resource: 'silver', target: 80, label: t('準備 80 銀幣') }, { type: 'npc_affinity', npcId: 'mk_menshu', target: 25, label: t('門叔好感度達到 25') }, { type: 'npc_affinity', npcId: 'mk_agang', target: 25, label: t('阿鋼好感度達到 25') }], effects: {"stockpile": {"silver": -80}, "prosperity": 10, "flags": {"cityGuard": true}, "endDisaster": "caravan_raid", "playerAffinity": [["mk_menshu", 10], ["mk_agang", 8]]}, onComplete: t('阿鋼三天沒合眼，打出來的刀每一把都一樣重。門叔帶衛隊出城，天亮前路清了，駝姐的貨一件沒少。從此城門的衛隊多了一班。') },
            { id: 'ransom', label: t('贖回'), icon: '💰', description: t('人和貨要緊，銀子再賺。'), conditions: [{ type: 'resource', resource: 'silver', target: 150, label: t('準備 150 銀幣') }, { type: 'npc_affinity', npcId: 'mk_tuojie', target: 25, label: t('駝姐好感度達到 25') }, { type: 'npc_affinity', npcId: 'mk_feishu', target: 20, label: t('肥叔好感度達到 20') }], effects: {"stockpile": {"silver": -150}, "prosperity": 3, "playerAffinity": [["mk_tuojie", 12], ["mk_feishu", 8]]}, onComplete: t('肥叔的酒桌上談成了贖金。駝姐和人全回來了，貨少了三車；她罵了一路，進城門時聲音啞了。') }
        ],
        rewards: {"silver": 80, "reputation": 15},
        unlocks: ["mk5_guild"],
        onComplete: t('劫案過去了，市集城的城門又開了。'),
        npcHints: { mk_menshu: { minAffinity: 10, hint: t('給我銀子和兵器，衛隊出城把路清了。') }, mk_agang: { minAffinity: 10, hint: t('兵器我來打，一把一把都要一樣重。') }, mk_feishu: { minAffinity: 10, hint: t('馬賊要的是銀子，不是命。我認識能談的人。') } },
    },
    {
        id: 'mk5_guild', chapter: 5,
        title: t('五鎮商會'),
        description: t('劫案之後，金老爺終於肯坐下談：五鎮聯手開一條有守衛的商路。要駝姐帶路、備足布料和糧，還要商隊來過一次。'),
        hint: t('和金老爺、駝姐熟到他們肯同桌，備 80 布料與 100 食物，等商隊來過一次確認路線，五鎮商會就能成立。'),
        objectives: [{ id: 'o1', type: 'npc_affinity', npcId: 'mk_jinlaoye', target: 35, label: t('金老爺好感度達到 35（主持）') }, { id: 'o2', type: 'npc_affinity', npcId: 'mk_tuojie', target: 30, label: t('駝姐好感度達到 30（帶路）') }, { id: 'o3', type: 'resource', resource: 'cloth', target: 80, label: t('備 80 布料') }, { id: 'o4', type: 'resource', resource: 'food', target: 100, label: t('備糧 100 食物') }, { id: 'o5', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次（路線確認）') }],
        rewards: {"silver": 200, "reputation": 25},
        effects: {"flags": {"tradeRoute": true}, "prosperity": 5, "stockpile": {"silver": 150}, "playerAffinity": [["mk_jinlaoye", 15], ["mk_tuojie", 10], ["mk_laozhang", 8]]},
        onComplete: t('五鎮的旗插在商會大樓門口。金老爺的排場這次沒人嫌，老帳記下第一筆五鎮的帳，一分不差。從此商隊兩天就來一趟，市集城的銀幣和布料有了自己的商路。'),
        npcHints: { mk_jinlaoye: { minAffinity: 15, hint: t('五鎮商會？你把人和貨備好，我來主持。') }, mk_tuojie: { minAffinity: 10, hint: t('五個鎮的路我都熟，有守衛的話我帶頭跑。') } },
    },
];
const MK_SIDE_QUESTS = [
    {
        id: 'side_mk_asuan_sutra', chapter: 1, type: 'side',
        title: t('阿算的算經'),
        trigger: { mainQuest: 'mk1_arrive', npcAffinity: {"mk_asuan": 10} },
        story: t('阿算把一本翻爛的《算經》塞給你：「我整本背完了，她還是嫌我吵。你幫我送點東西給書儀，別說是我。」'),
        description: t('替阿算把一份心意送到書院的書儀那裡。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'mk_asuan', target: 2, label: t('跟阿算聊 2 次') }, { id: 'o2', type: 'gift_to', npcId: 'mk_shuyi', target: 1, label: t('替阿算送一份禮給書儀') }],
        rewards: {"silver": 20, "reputation": 3},
        effects: {"pairAffinity": [["mk_shuyi", "mk_asuan", 15]], "pairRomance": [["mk_shuyi", "mk_asuan", 8]]},
        onComplete: t('書儀收下禮物時什麼都沒說，隔天批阿算的算題，第一次在旁邊寫了「甚好」兩個字。'),
        npcHints: { mk_asuan: { minAffinity: 5, hint: t('你幫我送東西給書儀好不好？我自己送她會以為是算題。') } },
    },
    {
        id: 'side_mk_yaoshu_price', chapter: 1, type: 'side',
        title: t('窯叔的磚價'),
        trigger: { mainQuest: 'mk1_explore', npcAffinity: {"mk_yaoshu": 15} },
        story: t('窯叔一腳踢開一塊裂磚：「商會壓價十年。你幫我湊一批石料，我燒一窯好磚直接賣給邊境鎮，看他們還壓不壓。」'),
        description: t('替窯叔湊齊石料，燒一窯磚繞過商會賣出去。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'stone', target: 80, label: t('儲備 80 石材') }, { id: 'o2', type: 'talk_to', npcId: 'mk_yaoshu', target: 2, label: t('跟窯叔聊 2 次') }],
        rewards: {"reputation": 4},
        effects: {"stockpile": {"stone": -50, "silver": 60}, "pairAffinity": [["mk_yaoshu", "mk_jinlaoye", 8]]},
        onComplete: t('一窯磚跟著駝姐的車出了城，回來的銀子比商會給的多三成。窯叔頭一次沒嫌東嫌西，只嫌窯太小。'),
        npcHints: { mk_yaoshu: { minAffinity: 10, hint: t('石料湊夠我就開窯，這批磚不經商會。') } },
    },
    {
        id: 'side_mk_tuojie_news', chapter: 2, type: 'side',
        title: t('駝姐的五鎮消息'),
        trigger: { mainQuest: 'mk2_ledger', npcAffinity: {"mk_tuojie": 15} },
        story: t('駝姐把鞭子往桌上一放：「海風鎮的浪叔又晚了，礦山鎮的礦爺又壓價，林間村的阿狐又說要搬城裡。你想聽哪一鎮的？」'),
        description: t('聽駝姐講完五鎮的消息，再等她的商隊進一次城。'),
        objectives: [{ id: 'o1', type: 'talk_to', npcId: 'mk_tuojie', target: 2, label: t('跟駝姐聊 2 次') }, { id: 'o2', type: 'caravan_count', target: 1, label: t('商隊來過至少 1 次') }],
        rewards: {"silver": 30, "reputation": 5},
        effects: {"playerAffinity": [["mk_tuojie", 8], ["mk_feishu", 5]]},
        onComplete: t('商隊進城那天，駝姐把一包海風鎮的魚乾丟給你：「浪叔託帶的，他說欠你的。」你不記得他欠你什麼。'),
        npcHints: { mk_tuojie: { minAffinity: 10, hint: t('五個鎮的消息我都有，坐下來聽。') } },
    },
    {
        id: 'side_mk_xinggu_clinic', chapter: 3, type: 'side',
        title: t('杏姑的醫館'),
        trigger: { mainQuest: 'mk3_wait', npcAffinity: {"mk_xinggu": 15} },
        story: t('杏姑指著藥堂門口排到街角的隊伍：「商會不肯蓋醫館，我自己蓋。你幫我備木料和藥材，鳳姨那邊…我去談。」'),
        description: t('替杏姑備足木料和草藥，把醫館蓋起來。'),
        objectives: [{ id: 'o1', type: 'resource', resource: 'wood', target: 80, label: t('儲備 80 木材') }, { id: 'o2', type: 'resource', resource: 'herbs', target: 40, label: t('儲備 40 草藥') }, { id: 'o3', type: 'talk_to', npcId: 'mk_xinggu', target: 2, label: t('跟杏姑聊 2 次') }],
        rewards: {"silver": 20, "reputation": 6},
        effects: {"stockpile": {"wood": -80, "herbs": -40}, "prosperity": 3, "pairAffinity": [["mk_fengyi", "mk_xinggu", 15], ["mk_xinggu", "mk_fengyi", 15]]},
        onComplete: t('醫館開在藥堂隔壁。開張那天鳳姨送了一塊匾，匾上四個字是她自己寫的。杏姑看了很久，把匾掛在最高的地方。'),
        npcHints: { mk_xinggu: { minAffinity: 10, hint: t('木料藥材備夠，醫館我自己蓋。') } },
    },
];
const MK_STORY_EVENTS = [
    { id: 'mk_story_first_night', trigger: {"tickCount": 96}, title: t('金馬車的第一夜'), icon: '🏮', text: t('大市集的燈到半夜才熄。肥叔的酒桌上，駝姐講五個鎮的路，財叔對每個人說「會發會發」，阿算在角落背算經。') },
    { id: 'mk_story_road', trigger: {"storyFlag": "mk3_wait"}, title: t('路上的消息'), icon: '🐎', text: t('肥叔的酒桌上來了個渾身是土的騎手：城外十里，駝姐的商隊被馬賊圍了。門叔聽完，把城門關上了。') },
    { id: 'mk_story_raid_night', trigger: {"storyFlag": "mk4_raid"}, title: t('劫案之後'), icon: '🏙️', text: t('城門重開那天，綵姑在攤子前掛了一盞燈，整條街跟著掛。財叔說這叫招財，門叔說這叫照路。') },
    { id: 'mk_story_guild', trigger: {"storyFlag": "mk5_guild"}, title: t('五鎮的旗'), icon: '🚩', text: t('商會大樓門口五面旗：邊境鎮的麥、海風鎮的浪、礦山鎮的鎬、林間村的樹、市集城的秤。阿鋼說秤是他打的；沒人懷疑。') },
];

const QUEST_CHAINS_BY_THEME = {
    frontier: { chapters: CHAPTER_NAMES, main: MAIN_QUESTS, side: SIDE_QUESTS, daily: DAILY_OBJECTIVES, story: STORY_EVENTS, startQuest: 'ch1_settle' },
    harbor: { chapters: HARBOR_CHAPTER_NAMES, main: HARBOR_MAIN_QUESTS, side: HARBOR_SIDE_QUESTS, daily: DAILY_OBJECTIVES, story: HARBOR_STORY_EVENTS, startQuest: 'hb1_arrive' },
    market: { chapters: MK_CHAPTER_NAMES, main: MK_MAIN_QUESTS, side: MK_SIDE_QUESTS, daily: DAILY_OBJECTIVES, story: MK_STORY_EVENTS, startQuest: 'mk1_arrive' },
    forest: { chapters: FV_CHAPTER_NAMES, main: FV_MAIN_QUESTS, side: FV_SIDE_QUESTS, daily: DAILY_OBJECTIVES, story: FV_STORY_EVENTS, startQuest: 'fv1_arrive' },
    mountain: { chapters: MT_CHAPTER_NAMES, main: MT_MAIN_QUESTS, side: MT_SIDE_QUESTS, daily: DAILY_OBJECTIVES, story: MT_STORY_EVENTS, startQuest: 'mt1_arrive' },
};
function questChainFor(theme) { return QUEST_CHAINS_BY_THEME[theme || 'frontier'] || null; }

class QuestSystem {
    constructor() {
        this.theme = 'frontier';   // v5.83.0 任務鏈主題(依 world.townTheme)
        this.chatWith = {};        // v5.83.0 {npcId: 次數}
        this.giftsTo = {};         // v5.83.0 {npcId: 次數}
        this.visitedLocations = []; // v5.83.0 玩家到過的地點 id
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

    // v5.83.0 依主題取任務表(沒有表就退回邊境鎮的,避免舊呼叫點爆掉)
    _chain() { return questChainFor(this.theme) || QUEST_CHAINS_BY_THEME.frontier; }
    _main() { return this._chain().main; }
    _side() { return this._chain().side; }
    _daily() { return this._chain().daily; }
    _story() { return this._chain().story; }
    chapterNames() { return this._chain().chapters; }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        for (const q of this._main()) {
            if (this.quests[q.id]) continue;
            const state = {
                status: q.id === this._chain().startQuest ? 'active' : 'locked',
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
        for (const sq of this._side()) {
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
        for (const questDef of this._main()) {
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
        for (const sqDef of this._side()) {
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
        try { this._applyEffects(sqDef.effects, world); } catch (e) {} // v5.84.0
        try { world.growth?.addXp(15, 'side_quest', world); } catch (e) {} // v5.94.0 經驗
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
        const objDef = this._daily().find(d => d.id === this.dailyObjective.id);
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
        const candidates = this._daily().filter(d =>
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
        for (const event of this._story()) {
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
            // v5.83.0 主題任務鏈用的條件
            case 'talk_to':
                return this.chatWith?.[cond.npcId] || 0;
            case 'gift_to':
                return this.giftsTo?.[cond.npcId] || 0;
            case 'visit_location':
                return (this.visitedLocations || []).includes(cond.location) ? 1 : 0;
            case 'visited':
                return (cond.locations || []).filter(l => (this.visitedLocations || []).includes(l)).length;
            case 'season':
                return world.clock?.season === cond.season ? 1 : 0;
            case 'prosperity':
                return world.prosperity?.prosperity || 0;
            case 'caravan_count':
                return world.caravanCount || 0;
            case 'neighbor_town':
                return (Array.isArray(world.otherTowns) && typeof themeKeyOfTownName === 'function' && world.otherTowns.some(tw => themeKeyOfTownName(tw.name) === cond.theme)) ? 1 : 0;
            case 'npc_pair_affinity': {
                const a = world.agents?.[cond.a];
                const rel = a?.relationships?.relationships?.[cond.b];
                return rel?.affinity || 0;
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

        // v5.83.0 路線/任務的劇情後果(改村民之間的好感/信任/心動、玩家好感)
        try { this._applyEffects(completedRoute?.effects, world); this._applyEffects(questDef.effects, world); } catch (e) {}
        try { world.growth?.addXp(30, 'quest', world); } catch (e) {} // v5.94.0 經驗
        const doneText = completedRoute?.onComplete || questDef.onComplete || '';

        // Log
        const routeMsg = completedRoute ? `（${completedRoute.label}）` : '';
        world.logMessage?.('quest', `⚔️ ${t('主線任務完成')}：「${questDef.title}」${routeMsg}！${doneText}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `${t('主線任務')}「${questDef.title}」${routeMsg}${t('完成')}！${doneText}`, 8);
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
                    const nextDef = this._main().find(q => q.id === nextId);
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

    // v5.83.0 任務後果:pairAffinity/pairTrust/pairRomance [[from, to, delta]]、playerAffinity [[npc, delta]]
    _applyEffects(effects, world) {
        if (!effects || !world?.agents) return;
        const relOf = (fromId, toId) => {
            const a = world.agents[fromId], b = world.agents[toId];
            if (!a || !b || !a.relationships?.getOrCreate) return null;
            return a.relationships.getOrCreate(b.agentId, b.name);
        };
        for (const [a, b, d] of (effects.pairAffinity || [])) { const r = relOf(a, b); if (r) r.affinity = Math.max(-100, Math.min(100, (r.affinity || 0) + d)); }
        for (const [a, b, d] of (effects.pairTrust || [])) { const r = relOf(a, b); if (r) r.trust = Math.max(-100, Math.min(100, (r.trust || 0) + d)); }
        for (const [a, b, d] of (effects.pairRomance || [])) { const r = relOf(a, b); if (r) r.romanticInterest = Math.max(0, Math.min(100, (r.romanticInterest || 0) + d)); }
        for (const [npcId, d] of (effects.playerAffinity || [])) { const r = relOf(npcId, 'player'); if (r) r.affinity = Math.max(-100, Math.min(100, (r.affinity || 0) + d)); }
        // v5.84.0 物資增減、繁榮度加成(持久、進存檔)、世界旗標(燈塔升級、海路開通…)
        for (const [res, d] of Object.entries(effects.stockpile || {})) {
            if (!world.stockpile) break;
            if (d >= 0) world.stockpile.add(res, d, world.tickCount, t('任務'));
            else world.stockpile.consume?.(res, Math.min(world.stockpile.get(res) || 0, -d), world.tickCount, t('任務'));
        }
        if (effects.prosperity && world.prosperity) world.prosperity.questBonus = (world.prosperity.questBonus || 0) + effects.prosperity;
        if (effects.flags) { world.harborFlags = world.harborFlags || {}; Object.assign(world.harborFlags, effects.flags); }
        // v5.85.0 主題災難:劇情排程災害(明天來襲)/路線化解災害
        if (effects.disaster && world.weather?.scheduleDisaster) world.weather.scheduleDisaster(effects.disaster.type, effects.disaster.daysUntil ?? 1, world);
        if (effects.endDisaster && world.weather?.resolveDisaster) world.weather.resolveDisaster(effects.endDisaster, world);
    }

    // ============================================================
    // NPC 對話提示 — 供 ConversationEngine 使用
    // ============================================================
    getQuestHintsForNPC(npcId, playerAffinity) {
        const hints = [];
        for (const questDef of this._main()) {
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
        for (const sqDef of this._side()) {
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
    onChat(npcId) { this.chatCount++; if (npcId) this.chatWith[npcId] = (this.chatWith[npcId] || 0) + 1; } // v5.83.0 記下跟誰聊
    onGift(npcId) { if (npcId) this.giftsTo[npcId] = (this.giftsTo[npcId] || 0) + 1; } // v5.83.0
    onVisit(locId) { if (locId && !this.visitedLocations.includes(locId)) this.visitedLocations.push(locId); } // v5.83.0
    onTrade() { this.tradeCount++; }
    onHarvest() { this.harvestCount++; }
    onRaidSurvived() { this.raidsSurvived++; }
    onElection() { this.electionsHeld++; }

    // ============================================================
    // Getters
    // ============================================================
    getActiveQuests() {
        return this._main().filter(q => this.quests[q.id]?.status === 'active');
    }

    getCompletedQuests() {
        return this.completedOrder.map(id => this._main().find(q => q.id === id)).filter(Boolean);
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
            totalCount: this._main().length,
            reputation: this.reputation,
            activeCrisis: this.activeCrisis,
            theme: this.theme, // v5.83.0
            chapterNames: this.chapterNames(),
        };
        for (const questDef of this._main()) {
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
        for (const sqDef of this._side()) {
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
            const objDef = this._daily().find(d => d.id === this.dailyObjective.id);
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
            chatWith: { ...this.chatWith }, giftsTo: { ...this.giftsTo }, visitedLocations: [...this.visitedLocations], // v5.83.0
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
        this.chatWith = data.chatWith || {}; this.giftsTo = data.giftsTo || {}; this.visitedLocations = data.visitedLocations || []; // v5.83.0
        this._initialized = Object.keys(this.quests).length > 0;

        // Migrate: if old save has quests but no routes, reinitialize new quests
        this._migrateIfNeeded();
    }

    _migrateIfNeeded() {
        // Add any new quests that don't exist in save data
        for (const q of this._main()) {
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

        // v5.83.0 主題鏈:只保證起始任務至少是 active
        if (this.theme !== 'frontier') {
            const st = this._chain().startQuest;
            const anyStarted = this._main().some(q => this.quests[q.id] && this.quests[q.id].status !== 'locked');
            if (this.quests[st] && !anyStarted) this.quests[st].status = 'active';
            return;
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


// ============================================================
// v5.91.0 委託板與行動點(README H1):村民每天發出有時限的具體委託,旅人每天只有幾點行動
// 掛在既有 questSystem.onChat/onGift/onVisit 的呼叫點旁;交付/調解要走到委託人身邊(同地點)
// ============================================================
const REQUEST_AP_BASE = 5, REQUEST_AP_BUY_COST = 30, REQUEST_AP_BUY_MAX = 2;
const REQUEST_JOB_RES = { farmer: 'tools', miner: 'tools', carpenter: 'wood', blacksmith: 'metal', cook: 'food', doctor: 'herbs', researcher: 'herbs', priest: 'herbs', tailor: 'cloth', guard: 'food', trader: 'cloth', mayor: 'food' };
const REQUEST_FETCH_LOCS = ['tavern', 'well', 'chapel', 'park', 'library', 'general_store', 'quarry', 'farm', 'workshop', 'clinic', 'guardpost', 'town_square'];
const REQUEST_LOC_FALLBACK = { tavern: '酒館', well: '水井', chapel: '教堂', park: '公園', library: '圖書館', general_store: '雜貨店', quarry: '採石場', farm: '農場', workshop: '工坊', clinic: '診所', guardpost: '哨站', town_square: '鎮中心廣場' };
const REQUEST_RES_NAMES = { food: '食物', wood: '木材', stone: '石材', metal: '金屬', cloth: '布料', herbs: '草藥', tools: '工具', silver: '銀幣' };
class RequestBoard {
    constructor() {
        this.board = [];                 // 今日(含未到期)委託
        this.dayKey = null;              // 最近一次 roll 的日期鍵
        this.ap = { left: REQUEST_AP_BASE, max: REQUEST_AP_BASE, bought: 0 };
        this.stats = { done: 0, failed: 0, streak: 0, bestStreak: 0, days: 0 };
        this._seq = 0;
        this._lastNoticeDay = null;      // app 用:今天的「新委託」通知發過沒
    }
    _dayKey(w) { return `${w.clock.year}-${w.clock.season}-${w.clock.day}`; }
    _absDay(w) { return typeof w._absDay === 'function' ? w._absDay() : (w.clock.year * 1000 + w.clock.day); }
    _rand(n) { return Math.floor(Math.random() * n); }
    _pick(arr) { return arr.length ? arr[this._rand(arr.length)] : null; }
    _player(w) { return w.agents?.player || null; }
    _playerName(w) { return this._player(w)?.name || t('旅人'); }
    _villagers(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_')); }
    resName(res) { return t(REQUEST_RES_NAMES[res] || res); }
    // --- 每天早上:結算昨天、重設行動點、發新委託 ---
    dailyRoll(world) {
        const key = this._dayKey(world);
        if (this.dayKey === key) return;
        const today = this._absDay(world);
        // 昨天沒完成的到期委託 → 失敗(調解有兩天)
        let allDone = this.board.length > 0;
        for (const r of this.board) {
            if (r.status === 'open' && today >= r.expiresAbsDay) this._fail(r, world);
            if (r.status !== 'done') allDone = false;
        }
        if (this.dayKey) { // 不是第一天
            this.lastDay = { dayKey: this.dayKey, done: this.board.filter(r => r.status === 'done').length, failed: this.board.filter(r => r.status === 'failed').length, total: this.board.length }; // v5.97.0 昨日結算
            this.stats.days++;
            if (allDone) { this.stats.streak++; this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak); }
            else if (this.board.some(r => r.status === 'failed')) this.stats.streak = 0;
        }
        this.board = this.board.filter(r => r.status === 'open'); // 只留還沒到期的(調解)
        this.dayKey = key;
        const g = world.growth; const vigor = g ? g.attr(world, 'vigor') : (this._player(world)?.attributes?.vigor || 5);
        this.ap.max = REQUEST_AP_BASE + (vigor >= 7 ? 1 : 0) + (this.stats.streak >= 3 ? 1 : 0) + (g?.has('stride') ? 1 : 0); // v5.94.0 天賦:健步
        this.ap.freeFirst = !!g?.has('earlybird'); // v5.94.0 天賦:早起
        this.ap.left = this.ap.max; this.ap.bought = 0;
        this._generate(world);
        world.logMessage?.('quest', `📋 ${t('今日委託')}：${this.board.filter(r => r.status === 'open').length} ${t('件')}，${t('行動點')} ${this.ap.left}`);
    }
    _generate(world) {
        const vs = this._villagers(world); if (vs.length < 3) return;
        const used = new Set(this.board.map(r => r.npcId));
        const prosperity = world.prosperity?.prosperity || 0;
        const want = Math.min(5, 3 + (prosperity >= 50 ? 1 : 0) + (Math.random() < 0.5 ? 1 : 0)) - this.board.length;
        const today = this._absDay(world);
        const makers = [
            () => { // 送貨
                const cands = vs.filter(a => !used.has(a.agentId) && REQUEST_JOB_RES[a.job?.key]);
                const npc = this._pick(cands); if (!npc) return null;
                const res = REQUEST_JOB_RES[npc.job.key]; const stock = world.stockpile?.get?.(res) || 0;
                const amount = Math.max(10, Math.min(30, 10 + this._rand(21), Math.floor(stock * 0.5)));
                return { type: 'deliver', npcId: npc.agentId, npcName: npc.name, res, amount, apCost: 1, reward: { silver: amount * 2, aff: 8, rep: 2 } };
            },
            () => { // 陪伴
                const cands = vs.filter(a => !used.has(a.agentId) && ((a.mood || 50) < 45 || (a.needs?.social ?? 60) < 40));
                const npc = this._pick(cands.length ? cands : vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                return { type: 'visit', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 15, aff: 6, rep: 2 } };
            },
            () => { // 調解
                const pairs = [];
                for (const a of vs) for (const b of vs) {
                    if (a.agentId >= b.agentId || used.has(a.agentId) || used.has(b.agentId)) continue;
                    const ra = a.relationships?.relationships?.[b.agentId], rb = b.relationships?.relationships?.[a.agentId];
                    if (ra && rb && (ra.affinity || 0) < -20 && (rb.affinity || 0) < -20) pairs.push([a, b]);
                }
                const pr = this._pick(pairs); if (!pr) return null;
                return { type: 'mediate', npcId: pr[0].agentId, npcName: pr[0].name, otherId: pr[1].agentId, otherName: pr[1].name, talked: [], apCost: 2, reward: { silver: 40, aff: 8, rep: 4 }, days: 2 };
            },
            () => { // 跑腿
                const npc = this._pick(vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                const locs = REQUEST_FETCH_LOCS.filter(l => l !== npc.currentLocation && l !== npc.homeLocation);
                const loc = this._pick(locs); if (!loc) return null;
                const packRes = this._pick(['food', 'wood', 'herbs', 'cloth', 'stone']);
                const locName = (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[world.townTheme || 'frontier']?.locationNames?.[loc]) || REQUEST_LOC_FALLBACK[loc] || loc;
                return { type: 'fetch', npcId: npc.agentId, npcName: npc.name, loc, locName, visited: false, apCost: 2, reward: { silver: 30, aff: 8, rep: 3, pack: { res: packRes, amount: 10 + this._rand(11) } } };
            },
            () => { // 送禮
                const cands = vs.filter(a => !used.has(a.agentId) && (a.mood || 50) < 50);
                const npc = this._pick(cands); if (!npc) return null;
                return { type: 'gift', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 20, aff: 6, rep: 2 } };
            },
            // v5.97.0 接通其他系統的委託
            () => { // 押商隊(商人/鎮長發):有鄰鎮、沒有商隊在路上
                if (!Array.isArray(world.otherTowns) || !world.otherTowns.length || world.playerCaravan?.active) return null;
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && (a.job?.key === 'trader' || a.job?.key === 'mayor'))); if (!npc) return null;
                return { type: 'caravan', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 30, aff: 6, rep: 3 } };
            },
            () => { // 打聽(愛八卦的人發):去跟某人打聽
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && (a.personality?.traits || []).includes('gossip'))); if (!npc) return null;
                const target = this._pick(vs.filter(a => a.agentId !== npc.agentId)); if (!target) return null;
                return { type: 'rumor', npcId: npc.agentId, npcName: npc.name, targetId: target.agentId, targetName: target.name, apCost: 1, reward: { silver: 20, aff: 6, rep: 2 } };
            },
            () => { // 考驗衝刺(鎮長發):本季考驗還沒達標時,把指標再推高一截
                const tr = world.trials?.current; if (!tr || tr.status !== 'active') return null;
                const value = world.trials.value(tr.type, world); if (value >= tr.target) return null;
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && a.job?.key === 'mayor')) || this._pick(vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                const delta = Math.max(5, Math.round((tr.target - value) * 0.3));
                return { type: 'trial', npcId: npc.agentId, npcName: npc.name, trialType: tr.type, baseValue: value, delta, apCost: 0, reward: { silver: 40, aff: 4, rep: 4 } };
            },
            () => { // 拉票(選舉期間、候選人發):替他去說服某人
                const el = world.election; if (!el?.active || (el.phase !== 'campaign' && el.phase !== 'voting')) return null;
                const cands = (el.candidates || []).filter(c => c.agentId !== 'player' && world.agents[c.agentId] && !used.has(c.agentId)); const c = this._pick(cands); if (!c) return null;
                const target = this._pick(vs.filter(a => a.agentId !== c.agentId)); if (!target) return null;
                return { type: 'canvass', npcId: c.agentId, npcName: world.agents[c.agentId].name, targetId: target.agentId, targetName: target.name, apCost: 1, reward: { silver: 25, aff: 8, rep: 3 } };
            },
        ];
        const order = [0, 1, 3, 2, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
        let made = 0, guard = 0;
        while (made < want && guard++ < 30) {
            const mk = makers[order[guard % order.length]];
            const r = mk(); if (!r) continue;
            if (used.has(r.npcId)) continue;
            used.add(r.npcId); if (r.otherId) used.add(r.otherId);
            this.board.push({ id: 'rq' + (++this._seq) + '_' + today, status: 'open', createdAbsDay: today, expiresAbsDay: today + (r.days || 1), ...r });
            made++;
        }
    }
    // --- 文案(顯示時才翻譯,存檔只存結構) ---
    describe(r) {
        const fill = (s, m) => Object.entries(m).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(v), s);
        switch (r.type) {
            case 'deliver': return fill(t('把 {n} {res} 送到 {npc} 手上'), { n: r.amount, res: this.resName(r.res), npc: t(r.npcName) });
            case 'visit': return fill(t('{npc} 今天心情差，去陪他聊聊'), { npc: t(r.npcName) });
            case 'mediate': return fill(t('勸 {a} 和 {b} 和好（先各聊一次，再按「調解」）'), { a: t(r.npcName), b: t(r.otherName) });
            case 'fetch': return fill(t('幫 {npc} 去 {loc} 拿東西回來'), { npc: t(r.npcName), loc: t(r.locName || r.loc) });
            case 'gift': return fill(t('{npc} 今天過得不好，送他一份禮'), { npc: t(r.npcName) });
            case 'caravan': return fill(t('{npc} 想看鎮上的貨出去走走：押一趟商隊去鄰鎮'), { npc: t(r.npcName) });
            case 'rumor': return fill(t('{npc} 想知道 {target} 的近況：去跟他打聽（用「打聽」）'), { npc: t(r.npcName), target: t(r.targetName) });
            case 'trial': return fill(t('{npc} 請你為本季考驗出力：把{unit}再推高 {n}'), { npc: t(r.npcName), unit: (typeof TRIAL_TYPES !== 'undefined' && this._trialUnit) ? this._trialUnit(r.trialType) : '', n: r.delta });
            case 'canvass': return fill(t('{npc} 請你替他拉票：去說服 {target}（用「說服」）'), { npc: t(r.npcName), target: t(r.targetName) });
        }
        return r.type;
    }
    icon(r) { return { deliver: '📦', visit: '🫂', mediate: '🤝', fetch: '🏃', gift: '🎁', caravan: '🐪', rumor: '👂', trial: '⚖️', canvass: '🗳️' }[r.type] || '📋'; }
    _trialUnit(type) { return { famine: t('食物'), plague: t('草藥'), bandits: t('防衛值'), pricewar: t('銀幣') }[type] || ''; }
    // 進度說明(給 UI)
    progress(r, world) {
        if (r.status === 'done') return r.outcome === 'partial' ? t('已嘗試（沒完全成功）') : t('已完成');
        if (r.status === 'failed') return t('已過期');
        if (r.type === 'mediate') { const n = (r.talked || []).length; return n < 2 ? `${t('已聊過')} ${n}/2` : t('兩人都聊過了，去找其中一位按「調解」'); }
        if (r.type === 'fetch') return r.visited ? t('東西拿到了，回去交給他') : t('先到指定地點');
        if (r.type === 'deliver') { const have = world?.stockpile?.get?.(r.res) || 0; return `${t('倉庫')} ${have}/${r.amount}`; }
        if (r.type === 'trial' && world?.trials) { const v = world.trials.value(r.trialType, world) - (r.baseValue || 0); return `${t('已推高')} ${Math.max(0, v)}/${r.delta}`; }
        if (r.type === 'caravan') return world?.playerCaravan?.active ? t('商隊在路上了，回報就算') : t('到馬車站押一隊');
        return '';
    }
    // 哪些需要「同地點」按鈕
    needsButton(r) { return r.status === 'open' && (r.type === 'deliver' || r.type === 'mediate' || r.type === 'fetch'); }
    canAct(r, world) {
        if (!r || r.status !== 'open') return { ok: false, reason: '' };
        if (this.ap.left < this._cost(r)) return { ok: false, reason: t('行動點不足') };
        const player = this._player(world);
        if (r.type === 'deliver') {
            if ((world.stockpile?.get?.(r.res) || 0) < r.amount) return { ok: false, reason: t('物資不足') };
            const npc = world.agents[r.npcId]; if (!npc || npc.currentLocation !== player?.currentLocation) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('身邊')}` };
            return { ok: true };
        }
        if (r.type === 'fetch') {
            if (!r.visited) return { ok: false, reason: t('先到指定地點') };
            const npc = world.agents[r.npcId]; if (!npc || npc.currentLocation !== player?.currentLocation) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('身邊')}` };
            return { ok: true };
        }
        if (r.type === 'mediate') {
            if ((r.talked || []).length < 2) return { ok: false, reason: t('先跟兩人各聊一次') };
            const a = world.agents[r.npcId], b = world.agents[r.otherId];
            if (!(a && a.currentLocation === player?.currentLocation) && !(b && b.currentLocation === player?.currentLocation)) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('或')} ${t(r.otherName)} ${t('身邊')}` };
            return { ok: true };
        }
        return { ok: false, reason: '' };
    }
    // v5.94.0 行動點花費(天賦「早起」:每天第一件免費)
    _cost(r) { return this.ap.freeFirst ? 0 : r.apCost; }
    _spend(r) { const c = this._cost(r); if (this.ap.freeFirst) this.ap.freeFirst = false; return c; }
    // v5.97.0 其他系統的掛鉤:聊天意圖成功、押商隊出發、考驗指標被動達標
    onIntent(npcId, key, ok, world) {
        if (!ok) return;
        for (const r of this.board) {
            if (r.status !== 'open') continue;
            if (r.type === 'rumor' && key === 'gossip' && r.targetId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
            if (r.type === 'canvass' && key === 'persuade' && r.targetId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
        }
    }
    onCaravanLaunch(world) {
        for (const r of this.board) { if (r.status === 'open' && r.type === 'caravan' && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); } }
    }
    checkPassive(world) {
        for (const r of this.board) {
            if (r.status !== 'open' || r.type !== 'trial' || !world?.trials) continue;
            const v = world.trials.value(r.trialType, world) - (r.baseValue || 0);
            if (v >= r.delta) this._complete(r, world);
        }
    }
    // --- 掛鉤 ---
    onChat(npcId, world) {
        for (const r of this.board) {
            if (r.status !== 'open') continue;
            if (r.type === 'visit' && r.npcId === npcId) { if (this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); const npc = world.agents[npcId]; if (npc) npc.moodModifier = (npc.moodModifier || 0) + 8; this._complete(r, world); } }
            if (r.type === 'mediate' && (r.npcId === npcId || r.otherId === npcId)) { r.talked = r.talked || []; if (!r.talked.includes(npcId)) r.talked.push(npcId); }
        }
    }
    onGift(npcId, world) {
        for (const r of this.board) {
            if (r.status === 'open' && r.type === 'gift' && r.npcId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
        }
    }
    onVisit(locId, world) {
        for (const r of this.board) { if (r.status === 'open' && r.type === 'fetch' && r.loc === locId && !r.visited) { r.visited = true; world.logMessage?.('quest', `🏃 ${t('拿到了')} ${t(r.npcName)} ${t('要的東西，回去交給他')}`); } }
    }
    act(reqId, world) {
        const r = this.board.find(x => x.id === reqId); if (!r) return { ok: false, msg: '' };
        const c = this.canAct(r, world); if (!c.ok) return { ok: false, msg: c.reason };
        this.ap.left -= this._spend(r);
        if (r.type === 'deliver') {
            world.stockpile.consume?.(r.res, r.amount, world.tickCount, `${t('委託')}：${t(r.npcName)}`);
            this._complete(r, world); return { ok: true, msg: `${t('交付完成')}：${this.describe(r)}` };
        }
        if (r.type === 'fetch') { this._complete(r, world); return { ok: true, msg: `${t('交付完成')}：${this.describe(r)}` }; }
        if (r.type === 'mediate') {
            const a = world.agents[r.npcId], b = world.agents[r.otherId]; const pl = this._player(world);
            const at = pl?.attributes || {}; const affA = a?.relationships?.relationships?.player?.affinity || 0, affB = b?.relationships?.relationships?.player?.affinity || 0;
            const g = world.growth; const charm = g ? g.attr(world, 'charm') : (at.charm || 5), wit = g ? g.attr(world, 'wit') : (at.wit || 5);
            const pSucc = Math.max(0.2, Math.min(0.95, 0.5 + charm * 0.04 + wit * 0.02 + (affA + affB) / 400 + (g?.has('silvertongue') ? 0.08 : 0))); // v5.94.0 天賦:巧舌
            const ok = Math.random() < pSucc;
            const bump = (x, y, d) => { if (!x || !y) return; const rel = x.relationships.getOrCreate(y.agentId, y.name); rel.affinity = Math.max(-100, Math.min(100, (rel.affinity || 0) + d)); if (ok) rel.trust = Math.min(100, (rel.trust || 0) + 5); };
            bump(a, b, ok ? 15 : 3); bump(b, a, ok ? 15 : 3);
            if (ok) { this._complete(r, world); return { ok: true, msg: `${t('調解成功')}：${t(r.npcName)} ${t('與')} ${t(r.otherName)} ${t('握手言和')}` }; }
            const loser = Math.random() < 0.5 ? a : b; if (loser) { const rel = loser.relationships.getOrCreate('player', this._playerName(world)); rel.modifyAffinity?.(-3); }
            r.status = 'done'; r.outcome = 'partial'; this.stats.done++; world.growth?.addXp(5, 'request_partial', world);
            const half = { silver: Math.round(r.reward.silver / 2), aff: 0, rep: 1 }; this._reward(r, world, half);
            world.logMessage?.('quest', `🤝 ${t('調解沒成')}：${t(r.npcName)} ${t('與')} ${t(r.otherName)} ${t('只肯各退一步')}`);
            return { ok: true, msg: `${t('調解沒成')}（${Math.round(pSucc * 100)}%）：${t('兩人只肯各退一步')}` };
        }
        return { ok: false, msg: '' };
    }
    buyAP(world) {
        if (this.ap.bought >= REQUEST_AP_BUY_MAX) return { ok: false, msg: t('今天買的行動點已達上限') };
        if ((world.stockpile?.get?.('silver') || 0) < REQUEST_AP_BUY_COST) return { ok: false, msg: t('銀幣不足') };
        world.stockpile.consume?.('silver', REQUEST_AP_BUY_COST, world.tickCount, t('買行動點'));
        this.ap.bought++; this.ap.left++; this.ap.max++;
        return { ok: true, msg: `${t('行動點')} +1` };
    }
    _reward(r, world, rw) {
        const npc = world.agents[r.npcId]; const pname = this._playerName(world);
        if (rw.silver) world.stockpile?.add?.('silver', rw.silver, world.tickCount, `${t('委託獎勵')}：${t(r.npcName)}`);
        if (rw.pack) world.stockpile?.add?.(rw.pack.res, rw.pack.amount, world.tickCount, `${t('委託獎勵')}：${t(r.npcName)}`);
        if (rw.rep && world.questSystem) world.questSystem.reputation = (world.questSystem.reputation || 0) + rw.rep;
        if (npc && rw.aff) { const rel = npc.relationships.getOrCreate('player', pname); rel.modifyAffinity?.(rw.aff + (world.growth?.has('charmer') ? 3 : 0)); } // v5.94.0 天賦:人緣
    }
    _complete(r, world) {
        r.status = 'done'; r.outcome = 'ok'; this.stats.done++;
        world.growth?.addXp(r.type === 'mediate' ? 15 : 10, 'request', world); // v5.94.0 經驗
        this._reward(r, world, r.reward || {});
        const npc = world.agents[r.npcId]; const pname = this._playerName(world); const desc = this.describe(r);
        npc?.memory?.add?.(world.tickCount, world.clock.timeStr, 'help', `${pname}${t('幫了我：')}${desc}`, 7, [pname]);
        world.logMessage?.('quest', `✅ ${t('委託完成')}：${desc}（${t('行動點剩')} ${this.ap.left}）`);
        world.dailyNews?.collectEvent?.('social', `${pname}${t('替')}${t(r.npcName)}${t('辦妥了一件事：')}${desc}`, 6, [r.npcName]);
        world.events?.conversationTopics?.push(`${pname}${t('幫')}${t(r.npcName)}${t('的忙')}`);
    }
    _fail(r, world) {
        r.status = 'failed'; this.stats.failed++;
        const npc = world.agents[r.npcId]; const pname = this._playerName(world);
        if (npc) { const rel = npc.relationships.getOrCreate('player', pname); rel.modifyAffinity?.(world.growth?.has('grit') ? -2 : -4); npc.memory?.add?.(world.tickCount, world.clock.timeStr, 'neglect', `${t('拜託')}${pname}${t('的事沒有下文：')}${this.describe(r)}`, 5, [pname]); }
        world.logMessage?.('quest', `⌛ ${t('委託過期')}：${this.describe(r)}`);
    }
    openCount() { return this.board.filter(r => r.status === 'open').length; }
    firstOpen() { return this.board.find(r => r.status === 'open') || null; }
    toDict(world) { return { board: this.board.map(r => ({ ...r, text: this.describe(r), icon: this.icon(r), progress: this.progress(r, world), can: this.canAct(r, world) })), ap: { ...this.ap }, stats: { ...this.stats }, dayKey: this.dayKey, lastDay: this.lastDay || null }; }
    serialize() { return { board: this.board, dayKey: this.dayKey, ap: this.ap, stats: this.stats, _seq: this._seq, lastDay: this.lastDay || null }; }
    loadFrom(d) { if (!d) return; this.board = Array.isArray(d.board) ? d.board : []; this.dayKey = d.dayKey || null; this.ap = { left: REQUEST_AP_BASE, max: REQUEST_AP_BASE, bought: 0, ...(d.ap || {}) }; this.stats = { done: 0, failed: 0, streak: 0, bestStreak: 0, days: 0, ...(d.stats || {}) }; this._seq = d._seq || 0; this.lastDay = d.lastDay || null; }
}


// ============================================================
// v5.93.0 季度考驗與軟性失敗(README H3):每季第 5 天公布一個鎮級考驗,季末結算
// 撐過→永久加成(世界旗標);失敗→2–3 名村民搬走、繁榮 −10、士氣 −10;連續兩季失敗→衰敗結局(可繼續玩)
// ============================================================
const TRIAL_TYPES = {
    famine:   { icon: '🌾', title: '糧荒', perk: 'granary', perkName: '大糧倉', perkDesc: '農田產量 +20%、之後的糧荒目標 −20%', weights: { mountain: 3, market: 3, frontier: 1, harbor: 1, forest: 1 } },
    plague:   { icon: '🤒', title: '瘟疫', perk: 'apothecary', perkName: '藥局', perkDesc: '全鎮心情 +10、之後的瘟疫目標 −30%', weights: { market: 3, mountain: 2, frontier: 2, harbor: 1, forest: 1 } },
    bandits:  { icon: '🏴', title: '匪患', perk: 'watchtower', perkName: '守望塔', perkDesc: '襲擊機率 −30%', weights: { frontier: 3, market: 2, mountain: 2, harbor: 1, forest: 2 } },
    pricewar: { icon: '📉', title: '商會壓價', perk: 'guildSeal', perkName: '商會印信', perkDesc: '押商隊利潤 +10%', weights: { market: 3, harbor: 3, forest: 1, frontier: 1, mountain: 1 } },
};
class SeasonTrials {
    constructor() { this.current = null; this.failStreak = 0; this.history = []; this.lastType = null; }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_')); }
    _seasonKey(w) { return `${w.clock.year}-${w.clock.season}`; }
    _flags(w) { return w.harborFlags || (w.harborFlags = {}); }
    target(type, w) {
        const n = Math.max(8, this._npcs(w).length); const f = this._flags(w);
        const pv = w.growth?.has('provident') ? 0.9 : 1; // v5.94.0 天賦:未雨
        if (type === 'famine') return Math.round(n * 8 * (f.granary ? 0.8 : 1) * pv);
        if (type === 'plague') return Math.round(n * 2 * (f.apothecary ? 0.7 : 1) * pv);
        if (type === 'bandits') return pv < 1 ? 5 : 6;
        return Math.round(150 * pv);
    }
    value(type, w) {
        const sp = w.stockpile;
        if (type === 'famine') return sp?.get?.('food') || 0;
        if (type === 'plague') return (sp?.get?.('herbs') || 0) + (sp?.get?.('medicine') || 0) * 3;
        if (type === 'bandits') { const guards = this._npcs(w).filter(a => a.job?.key === 'guard').length; return guards * 2 + Math.round(w.buildings?.getEffect?.('defense_bonus', 0) || 0) + (this._flags(w).cityGuard ? 3 : 0) + (this._flags(w).watchtower ? 2 : 0); }
        if (type === 'pricewar') return Math.max(0, (sp?.get?.('silver') || 0) - (this.current?.silverAtStart || 0));
        return 0;
    }
    unit(type) { return { famine: t('食物'), plague: t('草藥（藥品算 3）'), bandits: t('防衛值'), pricewar: t('銀幣') }[type] || ''; }
    goalText(type, target) {
        const fill = (s, m) => Object.entries(m).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(v), s);
        const tpl = { famine: t('季末前把食物存到 {n} 以上'), plague: t('季末前備齊 {n} 份草藥（藥品一份算三份）'), bandits: t('季末前把防衛值撐到 {n}（守衛每人 2、防禦建築、市集城加強守衛 3）'), pricewar: t('這一季銀幣要比開季時多 {n}（押商隊、賣貨、委託都算）') }[type];
        return fill(tpl, { n: target });
    }
    _pick(w) {
        const theme = w.townTheme || 'frontier';
        const pool = Object.entries(TRIAL_TYPES).filter(([k]) => k !== this.lastType).map(([k, d]) => [k, d.weights[theme] || 1]);
        let total = pool.reduce((a, [, wgt]) => a + wgt, 0), r = Math.random() * total;
        for (const [k, wgt] of pool) { r -= wgt; if (r <= 0) return k; }
        return pool[0][0];
    }
    daily(world) {
        const key = this._seasonKey(world); const day = world.clock.day; const last = world.clock.DAYS_PER_SEASON || 15;
        // 跨季還掛著(錯過季末那天):先結算
        if (this.current && this.current.status === 'active' && this.current.seasonKey !== key) this._resolve(world, false);
        if (!this.current && day >= 5 && day < last && this.lastSeasonKey !== key) this._announce(world, key);
        if (this.current && this.current.status === 'active' && this.current.seasonKey === key && day >= last) this._resolve(world, true);
    }
    _announce(world, key) {
        const type = this._pick(world); const d = TRIAL_TYPES[type];
        this.lastSeasonKey = key; this.lastType = type;
        this.current = { type, seasonKey: key, status: 'active', target: this.target(type, world), startAbsDay: world._absDay?.() || 0, dueDay: world.clock.DAYS_PER_SEASON || 15, silverAtStart: world.stockpile?.get?.('silver') || 0 };
        if (type === 'pricewar') this.current.target = 150;
        const text = `${t('本季考驗')}「${t(d.title)}」：${this.goalText(type, this.current.target)}`;
        world.logMessage?.('event', `⚖️ ${text}`);
        world.dailyNews?.collectEvent?.('event', text, 9);
        world.events?.conversationTopics?.push(`${t('這一季的考驗是')}${t(d.title)}`);
        world.onTrialEvent?.('announce', `${d.icon} ${t('本季考驗')}：${t(d.title)}`, this.goalText(type, this.current.target));
    }
    _resolve(world, onTime) {
        const c = this.current; if (!c || c.status !== 'active') return;
        const d = TRIAL_TYPES[c.type]; const v = this.value(c.type, world); const passed = v >= c.target;
        c.status = passed ? 'passed' : 'failed'; c.finalValue = v;
        world.growth?.addXp(passed ? 40 : 10, 'trial', world); // v5.94.0 經驗
        const f = this._flags(world);
        if (passed) {
            this.failStreak = 0; f[d.perk] = true;
            if (c.type === 'plague') Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 10; });
            Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 5; });
            if (world.questSystem) world.questSystem.reputation = (world.questSystem.reputation || 0) + 10;
            if (world.prosperity) world.prosperity.questBonus = (world.prosperity.questBonus || 0) + 5;
            const text = `${t('撐過了')}「${t(d.title)}」${t('的考驗！全鎮得到')}「${t(d.perkName)}」：${t(d.perkDesc)}`;
            world.logMessage?.('event', `🏅 ${text}`); world.dailyNews?.collectEvent?.('event', text, 10);
            world.onTrialEvent?.('passed', `🏅 ${t('考驗通過')}：${t(d.title)}`, `${t(d.perkName)} — ${t(d.perkDesc)}`);
        } else {
            this.failStreak++;
            const leavers = this._npcs(world).filter(a => a.job?.key !== 'mayor' && !(a.relationships?.relationships?.player?.status === 'married')).sort((a, b) => (a.mood || 50) - (b.mood || 50)).slice(0, Math.max(1, 2 + (this.failStreak >= 2 ? 1 : 0) - (world.growth?.has('grit') ? 1 : 0))); // v5.94.0 天賦:硬頸
            const names = leavers.map(a => a.name);
            leavers.forEach(a => world.leaveTown?.(a.agentId, t('鎮上的日子過不下去')));
            Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) - 10; });
            if (world.prosperity) world.prosperity.questBonus = (world.prosperity.questBonus || 0) - 10;
            const text = `${t('沒撐過')}「${t(d.title)}」${t('的考驗：')}${names.join('、')}${t('搬走了，繁榮 −10、全鎮士氣低落')}`;
            world.logMessage?.('event', `💔 ${text}`); world.dailyNews?.collectEvent?.('event', text, 10, names);
            world.onTrialEvent?.('failed', `💔 ${t('考驗失敗')}：${t(d.title)}`, text);
            if (this.failStreak >= 2) world.multiEnding?.triggerDecline?.(world);
        }
        this.history = this.history.concat([{ type: c.type, seasonKey: c.seasonKey, status: c.status, value: v, target: c.target }]).slice(-8);
        this.current = null;
    }
    toDict(world) {
        const c = this.current; const d = c ? TRIAL_TYPES[c.type] : null;
        const f = this._flags(world);
        return {
            current: c ? { ...c, icon: d.icon, title: t(d.title), goal: this.goalText(c.type, c.target), value: this.value(c.type, world), unit: this.unit(c.type), pct: Math.min(100, Math.round(this.value(c.type, world) / Math.max(1, c.target) * 100)), daysLeft: Math.max(0, (c.dueDay || 15) - world.clock.day), perkName: t(d.perkName), perkDesc: t(d.perkDesc) } : null,
            failStreak: this.failStreak,
            perks: Object.values(TRIAL_TYPES).filter(x => f[x.perk]).map(x => ({ name: t(x.perkName), desc: t(x.perkDesc) })),
            history: this.history.slice(-4).reverse().map(h => ({ ...h, title: t(TRIAL_TYPES[h.type]?.title || h.type), icon: TRIAL_TYPES[h.type]?.icon || '⚖️' })),
            nextAnnounceDay: c ? null : 5,
        };
    }
    serialize() { return { current: this.current, failStreak: this.failStreak, history: this.history, lastType: this.lastType, lastSeasonKey: this.lastSeasonKey || null }; }
    loadFrom(d) { if (!d) return; this.current = d.current || null; this.failStreak = d.failStreak || 0; this.history = Array.isArray(d.history) ? d.history : []; this.lastType = d.lastType || null; this.lastSeasonKey = d.lastSeasonKey || null; }
}


// ============================================================
// v5.94.0 旅人成長(README H4):委託/考驗/商隊/任務給經驗,升級三選一天賦;天賦接進既有系統
// ============================================================
const GROWTH_PERKS = {
    stride:      { icon: '🥾', name: '健步', desc: '每天行動點 +1', attr: { vigor: 1 } },
    silvertongue:{ icon: '🗣️', name: '巧舌', desc: '調解成功率 +8%，魅力 +2', attr: { charm: 2 } },
    shrewd:      { icon: '🧮', name: '精算', desc: '押商隊利潤 +5%，機智 +2', attr: { wit: 2 } },
    grit:        { icon: '🪨', name: '硬頸', desc: '委託過期只扣一半好感；考驗失敗少走一人，毅力 +2', attr: { grit: 2 } },
    charmer:     { icon: '🤝', name: '人緣', desc: '完成委託時委託人好感再 +3', attr: {} },
    pathfinder:  { icon: '🧭', name: '識途', desc: '押商隊遇劫率 ×0.8', attr: {} },
    provident:   { icon: '🌾', name: '未雨', desc: '季度考驗目標 −10%', attr: {} },
    earlybird:   { icon: '🌅', name: '早起', desc: '每天第一件委託不扣行動點', attr: {} },
};
class TravellerGrowth {
    constructor() { this.xp = 0; this.level = 1; this.perks = []; this.pending = null; this.log = []; this.total = 0; }
    xpToNext() { return 60 + this.level * 45; } // v5.96.0 浸泡測試 35 天就 Lv.10 學完八種天賦,放慢
    has(perk) { return this.perks.includes(perk); }
    attrBonus() { const b = { charm: 0, vigor: 0, wit: 0, grit: 0 }; for (const k of this.perks) for (const [a, v] of Object.entries(GROWTH_PERKS[k]?.attr || {})) b[a] += v; return b; }
    attr(world, key) { return ((world?.agents?.player?.attributes || {})[key] || 5) + this.attrBonus()[key]; }
    addXp(n, reason, world) {
        if (!n) return;
        this.xp += n; this.total = (this.total || 0) + n; this.log = this.log.concat([{ n, reason, day: world?.clock?.day }]).slice(-20);
        let leveled = false;
        while (this.xp >= this.xpToNext()) { this.xp -= this.xpToNext(); this.level++; leveled = true; }
        if (leveled && !this.pending) this._offer();
        if (leveled) { world?.logMessage?.('quest', `⬆️ ${t('旅人升到')} ${this.level} ${t('級，去「故事」分頁選一個天賦')}`); world?.onGrowthEvent?.('level', this.level); }
    }
    _offer() {
        const pool = Object.keys(GROWTH_PERKS).filter(k => !this.has(k));
        if (!pool.length) { this.pending = null; return; }
        const pick = []; while (pick.length < Math.min(3, pool.length)) { const k = pool[Math.floor(Math.random() * pool.length)]; if (!pick.includes(k)) pick.push(k); }
        this.pending = pick;
    }
    pendingLevels() { // 升了幾級還沒選
        return Math.max(0, this.level - 1 - this.perks.length);
    }
    choose(perk, world) {
        if (!this.pending || !this.pending.includes(perk) || this.has(perk)) return { ok: false };
        this.perks.push(perk); this.pending = null;
        if (this.pendingLevels() > 0) this._offer();
        const d = GROWTH_PERKS[perk];
        world?.logMessage?.('quest', `✨ ${t('旅人學會了')}「${t(d.name)}」：${t(d.desc)}`);
        world?.onGrowthEvent?.('perk', perk);
        return { ok: true, perk };
    }
    toDict(world) {
        const b = this.attrBonus(); const base = (world?.agents?.player?.attributes) || { charm: 5, vigor: 5, wit: 5, grit: 5 };
        return { xp: this.xp, level: this.level, next: this.xpToNext(), pct: Math.round(this.xp / this.xpToNext() * 100),
            perks: this.perks.map(k => ({ id: k, icon: GROWTH_PERKS[k].icon, name: t(GROWTH_PERKS[k].name), desc: t(GROWTH_PERKS[k].desc) })),
            pending: (this.pending || []).map(k => ({ id: k, icon: GROWTH_PERKS[k].icon, name: t(GROWTH_PERKS[k].name), desc: t(GROWTH_PERKS[k].desc) })),
            pendingLevels: this.pendingLevels(),
            attrs: ['charm', 'vigor', 'wit', 'grit'].map(k => ({ key: k, base: base[k] || 5, bonus: b[k] })), log: this.log.slice(-5).reverse() };
    }
    serialize() { return { xp: this.xp, level: this.level, perks: this.perks, pending: this.pending, log: this.log, total: this.total || 0 }; }
    loadFrom(d) { if (!d) return; this.xp = d.xp || 0; this.total = d.total || 0; this.level = d.level || 1; this.perks = Array.isArray(d.perks) ? d.perks : []; this.pending = Array.isArray(d.pending) ? d.pending : null; this.log = Array.isArray(d.log) ? d.log : []; if (!this.pending && this.pendingLevels() > 0) this._offer(); }
}

// v5.98.0 季末回顧:季初快照、季末差分,換季那天彈一頁回顧;最多留 4 季
class SeasonRecap {
    constructor() { this.start = null; this.last = null; this.history = []; this.pendingShow = false; }
    _key(w) { return `${w.clock.year}-${w.clock.season}`; }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer); }
    _snap(w) {
        const aff = {}; for (const a of this._npcs(w)) aff[a.agentId] = a.relationships?.relationships?.player?.affinity || 0;
        return {
            key: this._key(w), year: w.clock.year, season: w.clock.season, absDay: w._absDay?.() || 0,
            silver: w.stockpile?.get?.('silver') || 0, pop: this._npcs(w).length, level: w.growth?.level || 1, xpTotal: w.growth?.total || 0,
            reqDone: w.requests?.stats?.done || 0, reqFailed: w.requests?.stats?.failed || 0, bestStreak: w.requests?.stats?.bestStreak || 0,
            carRuns: w.playerCaravan?.totals?.runs || 0, carSilver: w.playerCaravan?.totals?.silver || 0, carRaids: w.playerCaravan?.totals?.raids || 0,
            rep: w.questSystem?.reputation || 0, prosperity: w.prosperity?.prosperity || 0,
            questsDone: Object.values(w.questSystem?.quests || {}).filter(q => q.status === 'completed').length, aff,
        };
    }
    // 每天叫一次(在 trials.daily 之後):第一次只拍快照;換季就結算上一季
    daily(w) {
        if (!w?.clock) return;
        const key = this._key(w);
        if (!this.start) { this.start = this._snap(w); return; }
        if (this.start.key === key) return;
        const s = this.start, now = this._snap(w);
        const gains = this._npcs(w).map(a => ({ id: a.agentId, name: a.name, delta: (now.aff[a.agentId] || 0) - (a.agentId in s.aff ? s.aff[a.agentId] : (now.aff[a.agentId] || 0)) })).filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
        const left = (w.movedOut || []).filter(m => m.absDay >= s.absDay && m.absDay < now.absDay).map(m => m.name);
        const joined = this._npcs(w).filter(a => !(a.agentId in s.aff)).map(a => a.name);
        const tr = w.trials?.current; const trial = (tr && tr.seasonKey === s.key && tr.status !== 'active') ? { type: tr.type, status: tr.status, value: tr.finalValue ?? 0, target: tr.target } : null;
        const r = {
            key: s.key, year: s.year, season: s.season, trial,
            reqDone: now.reqDone - s.reqDone, reqFailed: now.reqFailed - s.reqFailed, bestStreak: now.bestStreak,
            carRuns: now.carRuns - s.carRuns, carSilver: now.carSilver - s.carSilver, carRaids: now.carRaids - s.carRaids,
            xp: now.xpTotal - s.xpTotal, levelFrom: s.level, levelTo: now.level,
            silverFrom: s.silver, silverTo: now.silver, popFrom: s.pop, popTo: now.pop, rep: now.rep - s.rep, prosperity: now.prosperity - s.prosperity, questsDone: now.questsDone - s.questsDone,
            gains, left, joined, grade: '',
        };
        r.grade = this._grade(r);
        this.last = r; this.history = this.history.concat([r]).slice(-4); this.start = now; this.pendingShow = true;
        const line = this.headline(r);
        w.logMessage?.('event', `📜 ${line}`); w.dailyNews?.collectEvent?.('event', line, 9);
        if (typeof w.onSeasonRecap === 'function') { this.pendingShow = false; try { w.onSeasonRecap(r); } catch (e) {} }
    }
    _grade(r) {
        let s = 0;
        if (r.trial?.status === 'passed') s += 2; else if (r.trial?.status === 'failed') s -= 2;
        s += Math.min(2, Math.floor(r.reqDone / 10)); if (r.reqFailed > r.reqDone) s -= 1;
        if (r.silverTo > r.silverFrom) s += 1; if (r.popTo < r.popFrom) s -= 1; if (r.carSilver >= 100) s += 1; if (r.questsDone > 0) s += 1;
        return s >= 5 ? 'S' : s >= 3 ? 'A' : s >= 0 ? 'B' : 'C';
    }
    _fill(tpl, m) { return Object.entries(m).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(String(v)), tpl); }
    title(r) { return this._fill(t('第 {y} 年{s}'), { y: r.year, s: t(r.season) }); }
    gradeText(g) { return { S: t('這一季漂亮'), A: t('穩穩的一季'), B: t('平平的一季'), C: t('難熬的一季') }[g] || ''; }
    headline(r) {
        const tr = r.trial ? (r.trial.status === 'passed' ? t('撐過了考驗') : t('考驗沒撐過')) : t('沒有考驗');
        return this._fill(t('{name}回顧：{tr}，委託完成 {n} 件，商隊 {c} 趟，評等 {g}'), { name: this.title(r), tr, n: r.reqDone, c: r.carRuns, g: r.grade });
    }
    // 給介面用的文字版(顯示時才翻譯)
    lines(r) {
        if (!r) return [];
        const T = (typeof TRIAL_TYPES !== 'undefined') ? TRIAL_TYPES : {};
        const out = [];
        if (r.trial) { const d = T[r.trial.type] || {}; out.push({ icon: r.trial.status === 'passed' ? '🏅' : '💔', text: `${this._fill(r.trial.status === 'passed' ? t('撐過了「{t}」') : t('沒撐過「{t}」'), { t: t(d.title || r.trial.type) })} ${r.trial.value}/${r.trial.target}` }); }
        else out.push({ icon: '⚖️', text: t('本季沒有考驗') });
        out.push({ icon: '📋', text: this._fill(t('完成 {a} 件、過期 {b} 件、最佳連勝 {c} 天'), { a: r.reqDone, b: r.reqFailed, c: r.bestStreak }) });
        if (r.carRuns) out.push({ icon: '🐪', text: this._fill(t('{n} 趟、賺 {s} 銀幣、遇劫 {r} 次'), { n: r.carRuns, s: r.carSilver, r: r.carRaids }) });
        out.push({ icon: '🧭', text: this._fill(t('經驗 +{x}，Lv.{a} → Lv.{b}'), { x: r.xp, a: r.levelFrom, b: r.levelTo }) });
        out.push({ icon: '💰', text: this._fill(t('銀幣 {a} → {b}'), { a: r.silverFrom, b: r.silverTo }) + `（${r.silverTo - r.silverFrom >= 0 ? '+' : ''}${r.silverTo - r.silverFrom}）` });
        out.push({ icon: '👥', text: this._fill(t('人口 {a} → {b}'), { a: r.popFrom, b: r.popTo }) + ` · ${this._fill(t('聲望 {d}'), { d: (r.rep >= 0 ? '+' : '') + r.rep })} · ${this._fill(t('繁榮 {d}'), { d: (r.prosperity >= 0 ? '+' : '') + r.prosperity })}` });
        if (r.questsDone) out.push({ icon: '⚔️', text: this._fill(t('任務完成 {n} 件'), { n: r.questsDone }) });
        if (r.gains?.length) out.push({ icon: '💞', text: `${t('好感升最多')}：${r.gains.map(g => `${t(g.name)} +${g.delta}`).join('、')}` });
        if (r.left?.length) out.push({ icon: '🚪', text: `${t('搬走了')}：${r.left.map(n => t(n)).join('、')}` });
        if (r.joined?.length) out.push({ icon: '🏠', text: `${t('新住民')}：${r.joined.map(n => t(n)).join('、')}` });
        return out;
    }
    toDict(w) {
        const fmt = (r) => r ? { key: r.key, grade: r.grade, title: this.title(r), gradeText: this.gradeText(r.grade), headline: this.headline(r), lines: this.lines(r) } : null;
        return { last: fmt(this.last), history: this.history.slice().reverse().map(fmt), pendingShow: this.pendingShow };
    }
    serialize() { return { start: this.start, last: this.last, history: this.history, pendingShow: this.pendingShow }; }
    loadFrom(d) { if (!d) return; this.start = d.start || null; this.last = d.last || null; this.history = Array.isArray(d.history) ? d.history : []; this.pendingShow = !!d.pendingShow; }
}
