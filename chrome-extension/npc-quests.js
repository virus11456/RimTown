// ============================================================
// RimTown - NPC Personal Quest System (NPC 個人故事線)
// ============================================================
// 每個 NPC 都有自己的個人故事線，透過好感度解鎖
// 支援多路線完成、結果分支、連鎖觸發、產業加成

// ============================================================
// NPC 個人任務定義
// ============================================================
const NPC_PERSONAL_QUESTS = {
    'liu_jun': {
        name: '劉俊', job: 'farmer',
        quests: [
            {
                id: 'liu_jun_letter',
                title: '未寄出的情書',
                trigger: { affinity: 30 },
                description: '劉俊偷偷寫了一封情書給許瑩，但不敢寄出...',
                icon: '💌',
                routes: [
                    { id: 'deliver', label: '幫他送出情書', icon: '📮',
                      conditions: [
                          { type: 'talk_to', npcId: 'xu_ying', topic: 'liu_jun_letter', label: '把情書交給許瑩' },
                          { type: 'report_back', npcId: 'liu_jun', label: '回報劉俊結果' },
                      ]},
                    { id: 'encourage', label: '鼓勵他自己去', icon: '💪',
                      conditions: [
                          { type: 'npc_affinity', npcId: 'liu_jun', target: 60, label: '與劉俊好感度達到 60' },
                          { type: 'chat_with', npcId: 'liu_jun', target: 3, label: '鼓勵劉俊 3 次' },
                      ]},
                ],
                rewards: { reputation: 5, silver: 30 },
                outcomes: {
                    deliver: { flag: 'liu_xu_dating', mood: { liu_jun: 25, xu_ying: 15 }, reputation: 5 },
                    encourage: { flag: 'liu_xu_dating', mood: { liu_jun: 30, xu_ying: 20 }, reputation: 8 },
                },
                onComplete: '劉俊終於跨出了那一步。不管結果如何，他都很感激你。',
                unlocks: ['xu_ying_new_design'],
                npcHints: {
                    liu_jun: { minAffinity: 20, hint: '其實...有件事我想找人幫忙，但有點不好意思說...' },
                    xu_ying: { minAffinity: 15, hint: '最近劉俊看到我就臉紅，真是奇怪...' },
                },
            },
            {
                id: 'liu_jun_grandpa',
                title: '爺爺的種植手札',
                trigger: { affinity: 50, chapter: 2 },
                description: '劉俊的爺爺留下一本古老的種植手札，裡面記載了失傳的稀有作物種植法...',
                icon: '📖',
                routes: [
                    { id: 'study', label: '一起研究手札', icon: '🔍',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 50, label: '提供 50 食物作為實驗材料' },
                          { type: 'chat_with', npcId: 'liu_jun', target: 5, label: '與劉俊討論手札 5 次' },
                      ]},
                ],
                rewards: { reputation: 8, food: 80 },
                outcomes: {
                    study: { flag: 'rare_crops_unlocked', mood: { liu_jun: 20 }, industryBonus: { farming: 0.15 } },
                },
                onComplete: '你們成功解讀了手札中的秘密！農場產量將會提升。',
                npcHints: {
                    liu_jun: { minAffinity: 40, hint: '我爺爺留下一本種植手札...不知道你有沒有興趣看看？' },
                },
            },
        ],
    },
    'wu_da': {
        name: '吳達', job: 'miner',
        quests: [
            {
                id: 'wu_da_old_mine',
                title: '老礦工的秘密',
                trigger: { affinity: 40, chapter: 2 },
                description: '吳達說年輕時發現過一條金礦脈，但礦坑塌了...',
                icon: '⛏️',
                routes: [
                    { id: 'explore', label: '跟他一起去找', icon: '🗺️',
                      conditions: [
                          { type: 'resource', resource: 'wood', target: 40, label: '準備 40 木材加固礦道' },
                          { type: 'resource', resource: 'metal', target: 10, label: '準備 10 金屬做工具' },
                          { type: 'npc_affinity', npcId: 'wu_da', target: 55, label: '吳達好感度達到 55' },
                      ]},
                    { id: 'hire', label: '組織探礦隊', icon: '👷',
                      conditions: [
                          { type: 'resource', resource: 'silver', target: 100, label: '支付 100 銀幣僱人' },
                          { type: 'population', target: 12, label: '鎮上至少 12 人' },
                      ]},
                ],
                rewards: { silver: 200, reputation: 10 },
                outcomes: {
                    explore: { flag: 'gold_vein_found', mood: { wu_da: 30 }, industryBonus: { mining: 0.20 } },
                    hire: { flag: 'gold_vein_found', mood: { wu_da: 15 }, industryBonus: { mining: 0.15 } },
                },
                onComplete: '你們找到了傳說中的金礦脈！吳達激動得說不出話來。',
                npcHints: {
                    wu_da: { minAffinity: 30, hint: '年輕時我在廢礦裡看到過會發光的石頭...你信嗎？' },
                },
            },
            {
                id: 'wu_da_apprentice',
                title: '尋找傳人',
                trigger: { affinity: 70 },
                description: '吳達覺得自己年紀大了，想找人傳承採礦技術...',
                icon: '👴',
                routes: [
                    { id: 'learn', label: '你來學', icon: '📚',
                      conditions: [
                          { type: 'chat_with', npcId: 'wu_da', target: 8, label: '跟吳達學習 8 次' },
                      ]},
                    { id: 'find', label: '幫他找徒弟', icon: '🔎',
                      conditions: [
                          { type: 'avg_affinity', target: 30, label: '全鎮平均好感度 30+' },
                          { type: 'population', target: 15, label: '鎮上至少 15 人' },
                      ]},
                ],
                rewards: { reputation: 12 },
                outcomes: {
                    learn: { flag: 'mining_mastery', mood: { wu_da: 25 }, industryBonus: { mining: 0.10 } },
                    find: { flag: 'wu_da_has_apprentice', mood: { wu_da: 20 } },
                },
                onComplete: '吳達的技術不會失傳了。他笑得像個孩子。',
                npcHints: {
                    wu_da: { minAffinity: 60, hint: '唉...我這把老骨頭還能挖幾年呢...' },
                },
            },
        ],
    },
    'xu_ying': {
        name: '許瑩', job: 'tailor',
        quests: [
            {
                id: 'xu_ying_new_design',
                title: '夢想中的新衣',
                trigger: { affinity: 35, requireFlag: 'liu_xu_dating' },
                description: '許瑩想設計一套全新的服飾，作為送給劉俊的禮物...',
                icon: '👗',
                routes: [
                    { id: 'materials', label: '幫她收集材料', icon: '🧵',
                      conditions: [
                          { type: 'resource', resource: 'silver', target: 30, label: '提供 30 銀幣買布料' },
                          { type: 'chat_with', npcId: 'xu_ying', target: 3, label: '與許瑩討論設計 3 次' },
                      ]},
                ],
                rewards: { reputation: 6, silver: 50 },
                outcomes: {
                    materials: { flag: 'xu_ying_masterpiece', mood: { xu_ying: 25, liu_jun: 15 } },
                },
                onComplete: '許瑩的新作品讓全鎮驚艷！她感激地看著你。',
                npcHints: {
                    xu_ying: { minAffinity: 30, hint: '我最近有個設計靈感...但需要一些材料...' },
                },
            },
            {
                id: 'xu_ying_fashion',
                title: '邊境鎮時裝秀',
                trigger: { affinity: 60, chapter: 3 },
                description: '許瑩想在鎮上辦一場時裝秀，展示她所有的作品...',
                icon: '✨',
                routes: [
                    { id: 'organize', label: '幫她籌辦', icon: '🎪',
                      conditions: [
                          { type: 'resource', resource: 'silver', target: 80, label: '支付 80 銀幣場地費' },
                          { type: 'friends_count', target: 5, label: '邀請至少 5 位朋友來看' },
                      ]},
                ],
                rewards: { reputation: 15, silver: 120 },
                outcomes: {
                    organize: { flag: 'fashion_show_held', mood: { xu_ying: 30 }, townMoodBonus: 10 },
                },
                onComplete: '邊境鎮第一場時裝秀圓滿成功！全鎮歡慶！',
                npcHints: {
                    xu_ying: { minAffinity: 50, hint: '你覺得我們鎮上能辦一場時裝秀嗎...？' },
                },
            },
        ],
    },
    'chen_wei': {
        name: '陳偉', job: 'mayor',
        quests: [
            {
                id: 'chen_wei_past',
                title: '鎮長的過去',
                trigger: { affinity: 40 },
                description: '陳偉似乎有著不為人知的過去。他偶爾會望著遠方發呆...',
                icon: '🏛️',
                routes: [
                    { id: 'listen', label: '傾聽他的故事', icon: '👂',
                      conditions: [
                          { type: 'chat_with', npcId: 'chen_wei', target: 6, label: '與陳偉深談 6 次' },
                          { type: 'npc_affinity', npcId: 'chen_wei', target: 60, label: '陳偉好感度達到 60' },
                      ]},
                ],
                rewards: { reputation: 10 },
                outcomes: {
                    listen: { flag: 'chen_wei_trust', mood: { chen_wei: 20 } },
                },
                onComplete: '陳偉第一次向人敞開心扉。「謝謝你願意聽我說...」',
                npcHints: {
                    chen_wei: { minAffinity: 30, hint: '有時候我會想...當初離開京城到底是對是錯...' },
                },
            },
            {
                id: 'chen_wei_legacy',
                title: '鎮長的願景',
                trigger: { affinity: 70, chapter: 3 },
                description: '陳偉想在卸任前為小鎮留下一份珍貴的禮物——一部完整的鎮志...',
                icon: '📜',
                routes: [
                    { id: 'chronicle', label: '幫他撰寫鎮志', icon: '✍️',
                      conditions: [
                          { type: 'chat_count', target: 20, label: '總對話次數達到 20' },
                          { type: 'friends_count', target: 8, label: '認識至少 8 位鎮民' },
                          { type: 'npc_affinity', npcId: 'chen_wei', target: 80, label: '陳偉好感度達到 80' },
                      ]},
                ],
                rewards: { reputation: 20, silver: 100 },
                outcomes: {
                    chronicle: { flag: 'town_chronicle', mood: { chen_wei: 30 }, townMoodBonus: 5 },
                },
                onComplete: '《邊境鎮志》完成了。陳偉老淚縱橫：「這個鎮的故事，值得被記住。」',
                npcHints: {
                    chen_wei: { minAffinity: 60, hint: '如果有人能把這個鎮的故事記下來就好了...' },
                },
            },
        ],
    },
    'lin_mei': {
        name: '林美', job: 'doctor',
        quests: [
            {
                id: 'lin_mei_herb',
                title: '失傳的草藥方',
                trigger: { affinity: 35 },
                description: '林美在整理醫書時發現一個古老的草藥配方，但缺少關鍵藥材...',
                icon: '🌿',
                routes: [
                    { id: 'gather', label: '幫她採集藥材', icon: '🌱',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 30, label: '採集 30 份草藥（食物類）' },
                          { type: 'chat_with', npcId: 'lin_mei', target: 3, label: '與林美討論配方 3 次' },
                      ]},
                ],
                rewards: { reputation: 8, silver: 40 },
                outcomes: {
                    gather: { flag: 'ancient_remedy', mood: { lin_mei: 20 } },
                },
                onComplete: '林美成功還原了古老的草藥配方！「有了這個，鎮上的人都能更健康了。」',
                npcHints: {
                    lin_mei: { minAffinity: 25, hint: '我最近在舊醫書裡發現了一個有趣的配方...' },
                },
            },
            {
                id: 'lin_mei_clinic',
                title: '夢想中的診所',
                trigger: { affinity: 55, chapter: 2 },
                description: '林美想建一座真正的診所，不再是在帳篷裡看病...',
                icon: '🏥',
                routes: [
                    { id: 'build', label: '幫她建診所', icon: '🏗️',
                      conditions: [
                          { type: 'resource', resource: 'wood', target: 60, label: '提供 60 木材' },
                          { type: 'resource', resource: 'stone', target: 30, label: '提供 30 石材' },
                          { type: 'building_count', target: 4, label: '鎮上至少 4 座建築' },
                      ]},
                ],
                rewards: { reputation: 15, silver: 80 },
                outcomes: {
                    build: { flag: 'clinic_built', mood: { lin_mei: 30 }, townMoodBonus: 8 },
                },
                onComplete: '新診所落成了！林美感動地說：「終於可以好好照顧大家了。」',
                npcHints: {
                    lin_mei: { minAffinity: 45, hint: '如果能有一間真正的診所就好了...帳篷裡實在不方便。' },
                },
            },
        ],
    },
    'zhang_hao': {
        name: '張豪', job: 'blacksmith',
        quests: [
            {
                id: 'zhang_hao_sword',
                title: '傳說中的鑄劍術',
                trigger: { affinity: 45 },
                description: '張豪一直想重現失傳的古代鑄劍術，但需要特殊的材料...',
                icon: '⚔️',
                routes: [
                    { id: 'materials', label: '幫他收集材料', icon: '⛓️',
                      conditions: [
                          { type: 'resource', resource: 'metal', target: 30, label: '提供 30 金屬' },
                          { type: 'resource', resource: 'wood', target: 20, label: '提供 20 木材（木炭用）' },
                      ]},
                    { id: 'research', label: '找資料', icon: '📖',
                      conditions: [
                          { type: 'chat_with', npcId: 'sun_yu', target: 3, label: '請孫雨幫忙查古籍 3 次' },
                          { type: 'npc_affinity', npcId: 'zhang_hao', target: 60, label: '張豪好感度達到 60' },
                      ]},
                ],
                rewards: { reputation: 12, silver: 60 },
                outcomes: {
                    materials: { flag: 'legendary_forge', mood: { zhang_hao: 25 }, industryBonus: { smithing: 0.20 } },
                    research: { flag: 'legendary_forge', mood: { zhang_hao: 20, sun_yu: 10 }, industryBonus: { smithing: 0.15 } },
                },
                onComplete: '張豪成功鑄出了傳說級的武器！「這是我一生的巔峰之作！」',
                unlocks: ['yang_feng_blade'],
                npcHints: {
                    zhang_hao: { minAffinity: 35, hint: '傳說這座山脈曾經出產過神奇的礦石...你知道嗎？' },
                },
            },
        ],
    },
    'wang_li': {
        name: '王麗', job: 'cook',
        quests: [
            {
                id: 'wang_li_feast',
                title: '王麗的秘方',
                trigger: { affinity: 30 },
                description: '王麗想用她母親留下的秘方，為全鎮準備一場盛宴...',
                icon: '🍳',
                routes: [
                    { id: 'ingredients', label: '幫她準備材料', icon: '🥘',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 60, label: '準備 60 食物' },
                          { type: 'resource', resource: 'silver', target: 20, label: '購買 20 銀幣的香料' },
                      ]},
                ],
                rewards: { reputation: 8, silver: 40 },
                outcomes: {
                    ingredients: { flag: 'grand_feast', mood: { wang_li: 25 }, townMoodBonus: 15 },
                },
                onComplete: '全鎮大宴！每個人都吃得心滿意足，王麗笑開了花。',
                npcHints: {
                    wang_li: { minAffinity: 20, hint: '我媽媽留了一道拿手菜的食譜給我...但材料不太好找。' },
                },
            },
            {
                id: 'wang_li_restaurant',
                title: '開一間餐館',
                trigger: { affinity: 55, chapter: 3 },
                description: '王麗夢想開一間正式的餐館，讓鎮民有個聚會的好地方...',
                icon: '🏪',
                routes: [
                    { id: 'build', label: '幫她開餐館', icon: '🏗️',
                      conditions: [
                          { type: 'resource', resource: 'wood', target: 50, label: '提供 50 木材' },
                          { type: 'resource', resource: 'silver', target: 100, label: '投資 100 銀幣' },
                          { type: 'building_count', target: 5, label: '鎮上至少 5 座建築' },
                      ]},
                ],
                rewards: { reputation: 12, silver: 80 },
                outcomes: {
                    build: { flag: 'restaurant_opened', mood: { wang_li: 30 }, townMoodBonus: 10 },
                },
                onComplete: '「邊境小館」正式開張！王麗的手藝讓路過的商人都驚豔不已。',
                npcHints: {
                    wang_li: { minAffinity: 45, hint: '如果有一天我能開間餐館就好了...' },
                },
            },
        ],
    },
    'zhao_xia': {
        name: '趙霞', job: 'trader',
        quests: [
            {
                id: 'zhao_xia_route',
                title: '新的貿易路線',
                trigger: { affinity: 35 },
                description: '趙霞聽說山的另一邊有個繁華的城鎮，想開拓新的貿易路線...',
                icon: '🛤️',
                routes: [
                    { id: 'scout', label: '一起去探路', icon: '🗺️',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 40, label: '準備 40 食物做路糧' },
                          { type: 'npc_affinity', npcId: 'zhao_xia', target: 50, label: '趙霞好感度達到 50' },
                      ]},
                    { id: 'fund', label: '資助她', icon: '💰',
                      conditions: [
                          { type: 'resource', resource: 'silver', target: 150, label: '提供 150 銀幣資金' },
                      ]},
                ],
                rewards: { silver: 100, reputation: 10 },
                outcomes: {
                    scout: { flag: 'new_trade_route', mood: { zhao_xia: 25 }, industryBonus: { trade: 0.20 } },
                    fund: { flag: 'new_trade_route', mood: { zhao_xia: 15 }, industryBonus: { trade: 0.15 } },
                },
                onComplete: '新的貿易路線開通了！商人們開始更頻繁地造訪邊境鎮。',
                npcHints: {
                    zhao_xia: { minAffinity: 25, hint: '你有沒有想過，山的另一邊會是什麼樣子？' },
                },
            },
        ],
    },
    'yang_feng': {
        name: '楊鋒', job: 'guard',
        quests: [
            {
                id: 'yang_feng_training',
                title: '守衛的訓練',
                trigger: { affinity: 30 },
                description: '楊鋒想組織一支像樣的巡邏隊，保護小鎮的安全...',
                icon: '🛡️',
                routes: [
                    { id: 'train', label: '一起訓練', icon: '⚔️',
                      conditions: [
                          { type: 'resource', resource: 'metal', target: 15, label: '提供 15 金屬做訓練武器' },
                          { type: 'chat_with', npcId: 'yang_feng', target: 4, label: '與楊鋒訓練 4 次' },
                      ]},
                ],
                rewards: { reputation: 8, silver: 30 },
                outcomes: {
                    train: { flag: 'patrol_formed', mood: { yang_feng: 20 } },
                },
                onComplete: '巡邏隊成立了！楊鋒信心滿滿地說：「這下沒人敢來鬧事了。」',
                npcHints: {
                    yang_feng: { minAffinity: 20, hint: '光靠我一個人守不住整個鎮子啊...' },
                },
            },
            {
                id: 'yang_feng_blade',
                title: '楊鋒的新武器',
                trigger: { affinity: 50, requireFlag: 'legendary_forge' },
                description: '聽說張豪練成了傳說級的鑄劍術，楊鋒想請他打一把好武器...',
                icon: '🗡️',
                routes: [
                    { id: 'commission', label: '幫他牽線', icon: '🤝',
                      conditions: [
                          { type: 'npc_affinity', npcId: 'zhang_hao', target: 40, label: '張豪好感度達到 40' },
                          { type: 'resource', resource: 'metal', target: 20, label: '提供 20 金屬做材料' },
                      ]},
                ],
                rewards: { reputation: 10 },
                outcomes: {
                    commission: { flag: 'yang_feng_armed', mood: { yang_feng: 30, zhang_hao: 15 } },
                },
                onComplete: '楊鋒拿到新武器，激動地舞了一套劍法。「有了這把劍，誰來都不怕！」',
                npcHints: {
                    yang_feng: { minAffinity: 40, hint: '聽說張豪最近在研究什麼新的鍛造技術？' },
                },
            },
        ],
    },
    'sun_yu': {
        name: '孫雨', job: 'researcher',
        quests: [
            {
                id: 'sun_yu_discovery',
                title: '古代遺跡的線索',
                trigger: { affinity: 40 },
                description: '孫雨在研究中發現了關於附近古代遺跡的線索...',
                icon: '🔬',
                routes: [
                    { id: 'investigate', label: '一起調查', icon: '🏛️',
                      conditions: [
                          { type: 'resource', resource: 'silver', target: 50, label: '提供 50 銀幣研究經費' },
                          { type: 'chat_with', npcId: 'sun_yu', target: 5, label: '與孫雨討論發現 5 次' },
                      ]},
                ],
                rewards: { reputation: 15, silver: 80 },
                outcomes: {
                    investigate: { flag: 'ruins_discovered', mood: { sun_yu: 30 } },
                },
                onComplete: '你們發現了古代文明的遺跡！孫雨興奮得手都在抖。「這是改寫歷史的發現！」',
                npcHints: {
                    sun_yu: { minAffinity: 30, hint: '最近我在北邊的山洞裡發現了一些奇怪的符號...' },
                },
            },
            {
                id: 'sun_yu_library',
                title: '建造圖書館',
                trigger: { affinity: 60, chapter: 3 },
                description: '孫雨希望建一座圖書館，保存所有的研究成果和知識...',
                icon: '📚',
                routes: [
                    { id: 'build', label: '幫他建圖書館', icon: '🏗️',
                      conditions: [
                          { type: 'resource', resource: 'wood', target: 80, label: '提供 80 木材' },
                          { type: 'resource', resource: 'stone', target: 40, label: '提供 40 石材' },
                          { type: 'resource', resource: 'silver', target: 60, label: '提供 60 銀幣' },
                      ]},
                ],
                rewards: { reputation: 18, silver: 100 },
                outcomes: {
                    build: { flag: 'library_built', mood: { sun_yu: 30 }, townMoodBonus: 8 },
                },
                onComplete: '圖書館建成了！孫雨小心翼翼地把書一本本擺上書架。「知識是最珍貴的財富。」',
                npcHints: {
                    sun_yu: { minAffinity: 50, hint: '這些研究成果如果沒有好好保存，太可惜了...' },
                },
            },
        ],
    },
    'huang_li': {
        name: '黃莉', job: 'priest',
        quests: [
            {
                id: 'huang_li_shrine',
                title: '重建神龕',
                trigger: { affinity: 35 },
                description: '黃莉想在鎮上重建一座被風暴摧毀的古老神龕...',
                icon: '⛩️',
                routes: [
                    { id: 'rebuild', label: '幫她重建', icon: '🏗️',
                      conditions: [
                          { type: 'resource', resource: 'stone', target: 25, label: '提供 25 石材' },
                          { type: 'resource', resource: 'wood', target: 15, label: '提供 15 木材' },
                          { type: 'chat_with', npcId: 'huang_li', target: 3, label: '與黃莉祈禱 3 次' },
                      ]},
                ],
                rewards: { reputation: 10, silver: 30 },
                outcomes: {
                    rebuild: { flag: 'shrine_rebuilt', mood: { huang_li: 25 }, townMoodBonus: 10 },
                },
                onComplete: '神龕重建完成。黃莉在晨光中虔誠祈禱：「願這片土地上的所有人都平安。」',
                npcHints: {
                    huang_li: { minAffinity: 25, hint: '那座被毀的老神龕...我一直想把它修好。' },
                },
            },
            {
                id: 'huang_li_festival',
                title: '豐收祭典',
                trigger: { affinity: 55, chapter: 2 },
                description: '黃莉想舉辦一場傳統的豐收祭典，祈求來年風調雨順...',
                icon: '🎊',
                routes: [
                    { id: 'prepare', label: '幫她準備祭典', icon: '🎉',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 80, label: '準備 80 食物做祭品' },
                          { type: 'resource', resource: 'silver', target: 40, label: '支付 40 銀幣買裝飾' },
                          { type: 'friends_count', target: 6, label: '邀請至少 6 位鎮民參加' },
                      ]},
                ],
                rewards: { reputation: 15, silver: 60 },
                outcomes: {
                    prepare: { flag: 'harvest_festival', mood: { huang_li: 25 }, townMoodBonus: 20 },
                },
                onComplete: '豐收祭典圓滿成功！鎮民們載歌載舞，其樂融融。',
                npcHints: {
                    huang_li: { minAffinity: 45, hint: '如果能辦一場豐收祭典，大家的心情一定會好很多...' },
                },
            },
        ],
    },
    'ma_qiang': {
        name: '馬強', job: 'carpenter',
        quests: [
            {
                id: 'ma_qiang_masterwork',
                title: '千年古木的傳說',
                trigger: { affinity: 50 },
                description: '馬強說北山有一棵千年古木，用它的木材可以打造傳世之作...',
                icon: '🪓',
                routes: [
                    { id: 'expedition', label: '一起去北山', icon: '🏔️',
                      conditions: [
                          { type: 'resource', resource: 'food', target: 30, label: '準備 30 食物做路糧' },
                          { type: 'npc_affinity', npcId: 'ma_qiang', target: 65, label: '馬強好感度達到 65' },
                      ]},
                ],
                rewards: { reputation: 12, silver: 60 },
                outcomes: {
                    expedition: { flag: 'ancient_wood', mood: { ma_qiang: 30 }, industryBonus: { woodcutting: 0.20 } },
                },
                onComplete: '你們找到了傳說中的千年古木！馬強如獲至寶地撫摸著木材。',
                npcHints: {
                    ma_qiang: { minAffinity: 40, hint: '有件事...我年輕時在北山發現過一棵千年古木...' },
                },
            },
            {
                id: 'ma_qiang_workshop',
                title: '馬強的工坊',
                trigger: { affinity: 65, chapter: 3 },
                description: '馬強想建一座專業的木工工坊，提升全鎮的建設能力...',
                icon: '🔨',
                routes: [
                    { id: 'build', label: '幫他建工坊', icon: '🏗️',
                      conditions: [
                          { type: 'resource', resource: 'wood', target: 100, label: '提供 100 木材' },
                          { type: 'resource', resource: 'metal', target: 15, label: '提供 15 金屬做工具' },
                      ]},
                ],
                rewards: { reputation: 15, silver: 80 },
                outcomes: {
                    build: { flag: 'workshop_built', mood: { ma_qiang: 30 }, industryBonus: { woodcutting: 0.15 } },
                },
                onComplete: '馬強的工坊建成了！全鎮的建設速度都提升了。',
                npcHints: {
                    ma_qiang: { minAffinity: 55, hint: '如果有一間正式的工坊，我能做出更好的東西...' },
                },
            },
        ],
    },
};

// ============================================================
// NPC 與產業深度綁定
// ============================================================
const NPC_INDUSTRY_BINDINGS = {
    'ma_qiang': {
        industry: 'woodcutting', name: '馬強（木匠）',
        tiers: [
            { affinity: 10, effect: 'hint', desc: '透露哪片森林木材最好' },
            { affinity: 30, effect: 'shortcut', desc: '教你辨認木材品種（硬木採集捷徑）', bonus: 0.05 },
            { affinity: 50, effect: 'quest', desc: '千年古木支線任務', questId: 'ma_qiang_masterwork' },
            { affinity: 70, effect: 'supervisor', desc: '自願當伐木場主管', bonus: 0.25 },
            { affinity: 90, effect: 'legendary', desc: '傳說工具——「這把斧頭跟了我一輩子，現在交給你。」', bonus: 0.35 },
        ],
    },
    'wu_da': {
        industry: 'mining', name: '吳達（礦工）',
        tiers: [
            { affinity: 30, effect: 'hint', desc: '告訴你哪裡有好石頭' },
            { affinity: 50, effect: 'quest', desc: '大理石礦脈任務', questId: 'wu_da_old_mine' },
            { affinity: 70, effect: 'secret', desc: '帶你去秘密礦脈', bonus: 0.20 },
        ],
    },
    'liu_jun': {
        industry: 'farming', name: '劉俊（農夫）',
        tiers: [
            { affinity: 30, effect: 'hint', desc: '分享種植技巧', bonus: 0.05 },
            { affinity: 50, effect: 'quest', desc: '爺爺的種植手札', questId: 'liu_jun_grandpa' },
            { affinity: 70, effect: 'automate', desc: '自動幫你照顧農田', bonus: 0.20 },
        ],
    },
    'zhang_hao': {
        industry: 'smithing', name: '張豪（鐵匠）',
        tiers: [
            { affinity: 30, effect: 'quality', desc: '打造工具品質更高', bonus: 0.05 },
            { affinity: 50, effect: 'quest', desc: '傳說中的鑄劍術', questId: 'zhang_hao_sword' },
            { affinity: 70, effect: 'master', desc: '開放大師級鍛造', bonus: 0.25 },
        ],
    },
    'zhao_xia': {
        industry: 'trade', name: '趙霞（商人）',
        tiers: [
            { affinity: 30, effect: 'discount', desc: '交易價格優惠', bonus: 0.05 },
            { affinity: 50, effect: 'quest', desc: '新的貿易路線', questId: 'zhao_xia_route' },
            { affinity: 70, effect: 'network', desc: '打開商人網絡', bonus: 0.20 },
        ],
    },
};


// ============================================================
// NPCQuestSystem 核心類
// ============================================================
class NPCQuestSystem {
    constructor() {
        this.quests = {};           // { questId: { status, progress, completedRoute, ... } }
        this.storyFlags = {};       // { flagName: true }
        this.industryBonuses = {};  // { industryKey: totalBonus }
        this.chainUnlocks = [];     // quest IDs unlocked by chain triggers
        this._lastCheckDay = -1;
        this._lastCheckYear = -1;
    }

    // ============================================================
    // 每日更新（在 World.tick() 的 new_day 區塊呼叫）
    // ============================================================
    dailyUpdate(world) {
        if (this._lastCheckDay === world.clock.day && this._lastCheckYear === world.clock.year) return;
        this._lastCheckDay = world.clock.day;
        this._lastCheckYear = world.clock.year;

        this._checkTriggers(world);
        this._checkProgress(world);
        this._updateIndustryBonuses(world);
    }

    // ============================================================
    // 檢查任務觸發條件
    // ============================================================
    _checkTriggers(world) {
        const player = world.agents?.player;
        if (!player) return;

        for (const [npcId, npcData] of Object.entries(NPC_PERSONAL_QUESTS)) {
            for (const quest of npcData.quests) {
                if (this.quests[quest.id]) continue; // Already triggered

                // Check affinity trigger
                const npc = world.agents?.[npcId];
                if (!npc) continue;

                const rel = player.relationships?.relationships?.[npcId];
                const affinity = rel?.affinity || 0;
                if (affinity < (quest.trigger.affinity || 0)) continue;

                // Check chapter trigger
                if (quest.trigger.chapter) {
                    const currentChapter = world.questSystem?.getCurrentChapter?.() || 1;
                    if (currentChapter < quest.trigger.chapter) continue;
                }

                // Check flag trigger (e.g. requireFlag: 'liu_xu_dating')
                if (quest.trigger.requireFlag) {
                    if (!this.storyFlags[quest.trigger.requireFlag]) continue;
                }

                // Trigger the quest!
                this.quests[quest.id] = {
                    status: 'active',
                    npcId: npcId,
                    title: quest.title,
                    description: quest.description,
                    icon: quest.icon || '📋',
                    routes: quest.routes.map(r => ({
                        id: r.id,
                        label: r.label,
                        icon: r.icon || '📋',
                        description: r.description || '',
                        conditions: r.conditions.map(c => ({
                            ...c,
                            progress: 0,
                            completed: false,
                        })),
                    })),
                    rewards: quest.rewards || {},
                    completedRoute: null,
                    triggeredDay: world.clock.day,
                    triggeredYear: world.clock.year,
                };

                world.logMessage?.('quest', `💫 ${npcData.name}的個人任務「${quest.title}」已觸發！`);
                if (world.dailyNews) {
                    world.dailyNews.collectEvent('quest', `${npcData.name}似乎有事情想找人幫忙...`, 6, [npcData.name]);
                }
            }
        }
    }

    // ============================================================
    // 檢查任務進度
    // ============================================================
    _checkProgress(world) {
        const player = world.agents?.player;
        if (!player) return;

        for (const [questId, questState] of Object.entries(this.quests)) {
            if (questState.status !== 'active') continue;

            // Find quest definition
            const questDef = this._getQuestDef(questId);
            if (!questDef) continue;

            // Check each route
            for (const route of questState.routes) {
                let allDone = true;
                for (const cond of route.conditions) {
                    if (cond.completed) continue;

                    const progress = this._evaluateCondition(cond, world, player, questState.npcId);
                    cond.progress = progress;
                    if (progress >= (cond.target || 1)) {
                        cond.completed = true;
                    } else {
                        allDone = false;
                    }
                }

                // Route completed!
                if (allDone) {
                    this._completeQuest(questId, route.id, questDef, world);
                    break;
                }
            }
        }
    }

    // ============================================================
    // 評估單一條件
    // ============================================================
    _evaluateCondition(cond, world, player, npcId) {
        switch (cond.type) {
            case 'resource': {
                return world.stockpile?.get(cond.resource) || 0;
            }
            case 'npc_affinity': {
                const rel = player.relationships?.relationships?.[cond.npcId];
                return rel?.affinity || 0;
            }
            case 'chat_with': {
                // Count chat messages with specific NPC
                const chatCount = (player.chatHistory || []).filter(c =>
                    c.target === (world.agents?.[cond.npcId]?.name) ||
                    c.speaker === (world.agents?.[cond.npcId]?.name)
                ).length;
                return Math.floor(chatCount / 2); // Each exchange = 1 count
            }
            case 'chat_count': {
                return (player.chatHistory || []).length;
            }
            case 'talk_to': {
                // Check if player has talked to a specific NPC (simplified: check chat history)
                const talked = (player.chatHistory || []).some(c =>
                    c.target === (world.agents?.[cond.npcId]?.name) ||
                    c.speaker === (world.agents?.[cond.npcId]?.name)
                );
                return talked ? 1 : 0;
            }
            case 'report_back': {
                // Check if player recently talked to the quest NPC after talking to the target
                const npcName = world.agents?.[cond.npcId]?.name;
                const recentChats = (player.chatHistory || []).slice(-20);
                return recentChats.some(c => c.target === npcName || c.speaker === npcName) ? 1 : 0;
            }
            case 'population': {
                return Object.keys(world.agents || {}).length;
            }
            case 'avg_affinity': {
                const rels = Object.values(player.relationships?.relationships || {});
                if (rels.length === 0) return 0;
                return Math.round(rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length);
            }
            case 'friends_count': {
                const rels = Object.values(player.relationships?.relationships || {});
                return rels.filter(r => (r.affinity || 0) >= 30).length;
            }
            case 'building_count': {
                return world.buildings?.completed?.length || 0;
            }
            case 'industry_count': {
                return world.industry ? Object.keys(world.industry.industries || {}).length : 0;
            }
            case 'relationship': {
                const rel = player.relationships?.relationships?.[cond.npcId];
                return rel?.affinity || 0;
            }
            default:
                return 0;
        }
    }

    // ============================================================
    // 完成任務
    // ============================================================
    _completeQuest(questId, routeId, questDef, world) {
        const questState = this.quests[questId];
        questState.status = 'completed';
        questState.completedRoute = routeId;

        // Apply outcomes
        const outcomes = questDef.outcomes?.[routeId];
        if (outcomes) {
            // Story flags
            if (outcomes.flag) this.storyFlags[outcomes.flag] = true;

            // Mood changes
            if (outcomes.mood) {
                for (const [npcId, moodChange] of Object.entries(outcomes.mood)) {
                    const npc = world.agents?.[npcId];
                    if (npc) npc.moodModifier = (npc.moodModifier || 0) + moodChange;
                }
            }

            // Reputation
            if (outcomes.reputation && world.questSystem) {
                world.questSystem.reputation = (world.questSystem.reputation || 0) + outcomes.reputation;
            }

            // Industry bonus
            if (outcomes.industryBonus) {
                for (const [industry, bonus] of Object.entries(outcomes.industryBonus)) {
                    this.industryBonuses[industry] = (this.industryBonuses[industry] || 0) + bonus;
                }
            }

            // Town mood bonus
            if (outcomes.townMoodBonus) {
                for (const npc of Object.values(world.agents || {})) {
                    if (!npc.isPlayer) {
                        npc.moodModifier = (npc.moodModifier || 0) + outcomes.townMoodBonus;
                    }
                }
            }
        }

        // Apply rewards
        if (questDef.rewards) {
            for (const [resource, amount] of Object.entries(questDef.rewards)) {
                if (resource === 'reputation') {
                    if (world.questSystem) {
                        world.questSystem.reputation = (world.questSystem.reputation || 0) + amount;
                    }
                } else {
                    world.stockpile?.add(resource, amount, world.tickCount, `任務獎勵：${questDef.title}`);
                }
            }
        }

        // Chain unlocks
        if (questDef.unlocks) {
            for (const unlockId of questDef.unlocks) {
                this.chainUnlocks.push(unlockId);
            }
        }

        // Find NPC name for display
        const npcData = NPC_PERSONAL_QUESTS[questState.npcId];
        const npcName = npcData?.name || questState.npcId;
        const route = questState.routes.find(r => r.id === routeId);

        world.logMessage?.('quest', `🎉 完成了${npcName}的個人任務「${questDef.title}」！（${route?.icon || ''} ${route?.label || routeId}）`);
        if (questDef.onComplete) {
            world.logMessage?.('quest', `📖 ${questDef.onComplete}`);
        }
        if (world.dailyNews) {
            world.dailyNews.collectEvent('quest', `${npcName}的心願「${questDef.title}」達成了！`, 8, [npcName]);
        }
    }

    // ============================================================
    // 產業加成更新（基於 NPC 好感度 tier）
    // ============================================================
    _updateIndustryBonuses(world) {
        const player = world.agents?.player;
        if (!player) return;

        for (const [npcId, binding] of Object.entries(NPC_INDUSTRY_BINDINGS)) {
            const rel = player.relationships?.relationships?.[npcId];
            const affinity = rel?.affinity || 0;

            // Find highest unlocked tier
            for (const tier of binding.tiers) {
                if (affinity >= tier.affinity && tier.bonus) {
                    // Only add tier bonus if not already counted from quest outcomes
                    const tierKey = `_tier_${npcId}_${tier.affinity}`;
                    if (!this.storyFlags[tierKey]) {
                        this.storyFlags[tierKey] = true;
                        this.industryBonuses[binding.industry] = (this.industryBonuses[binding.industry] || 0) + tier.bonus;

                        const npcName = NPC_PERSONAL_QUESTS[npcId]?.name || npcId;
                        world.logMessage?.('industry', `📈 ${npcName}的好感度效果：${tier.desc}`);
                    }
                }
            }
        }
    }

    // ============================================================
    // 取得產業加成
    // ============================================================
    getIndustryBonus(industryKey) {
        return this.industryBonuses[industryKey] || 0;
    }

    // ============================================================
    // NPC 對話時的個人故事提示（供 LLM prompt 注入）
    // ============================================================
    getPersonalQuestHints(npcId, playerAffinity) {
        const hints = [];
        const npcData = NPC_PERSONAL_QUESTS[npcId];
        if (!npcData) return hints;

        for (const quest of npcData.quests) {
            // Hint for not-yet-triggered quest (tease)
            if (!this.quests[quest.id] && quest.npcHints?.[npcId]) {
                const h = quest.npcHints[npcId];
                if (playerAffinity >= (h.minAffinity || 0) && playerAffinity < (quest.trigger.affinity || 0)) {
                    hints.push({ questTitle: quest.title, hint: h.hint, type: 'tease' });
                }
            }

            // Hint for active quest (NPC has a personal wish)
            if (this.quests[quest.id]?.status === 'active') {
                hints.push({
                    questTitle: quest.title,
                    hint: `你目前有一個未完成的心願：「${quest.title}」——${quest.description}`,
                    type: 'active',
                });
            }

            // Hint from other NPCs about this NPC's quest
            if (quest.npcHints) {
                for (const [hintNpcId, hintData] of Object.entries(quest.npcHints)) {
                    if (hintNpcId === npcId) continue; // Skip self (handled above)
                    // This is checked when building hints for hintNpcId
                }
            }
        }

        // Also check hints from OTHER NPCs' quests about this NPC
        for (const [otherNpcId, otherData] of Object.entries(NPC_PERSONAL_QUESTS)) {
            if (otherNpcId === npcId) continue;
            for (const quest of otherData.quests) {
                if (quest.npcHints?.[npcId]) {
                    const h = quest.npcHints[npcId];
                    if (playerAffinity >= (h.minAffinity || 0)) {
                        if (this.quests[quest.id]?.status === 'active') {
                            hints.push({ questTitle: quest.title, hint: h.hint, type: 'gossip' });
                        }
                    }
                }
            }
        }

        return hints;
    }

    // ============================================================
    // 產業綁定提示（用於 NPC 對話）
    // ============================================================
    getIndustryBindingContext(npcId, playerAffinity) {
        const binding = NPC_INDUSTRY_BINDINGS[npcId];
        if (!binding) return '';

        const unlockedTiers = binding.tiers.filter(t => playerAffinity >= t.affinity);
        if (unlockedTiers.length === 0) return '';

        const latest = unlockedTiers[unlockedTiers.length - 1];
        return `你因為和玩家的關係好，${latest.desc}。`;
    }

    // ============================================================
    // 輔助方法
    // ============================================================
    _getQuestDef(questId) {
        for (const npcData of Object.values(NPC_PERSONAL_QUESTS)) {
            for (const quest of npcData.quests) {
                if (quest.id === questId) return quest;
            }
        }
        return null;
    }

    // ============================================================
    // 供外部查詢
    // ============================================================
    toDict() {
        const active = [];
        const completed = [];
        for (const [qId, q] of Object.entries(this.quests)) {
            const entry = { id: qId, ...q };
            if (q.status === 'active') active.push(entry);
            else if (q.status === 'completed') completed.push(entry);
        }
        return {
            active,
            completed,
            storyFlags: { ...this.storyFlags },
            industryBonuses: { ...this.industryBonuses },
            activeCount: active.length,
            completedCount: completed.length,
            totalDefinedCount: Object.values(NPC_PERSONAL_QUESTS).reduce((s, d) => s + d.quests.length, 0),
        };
    }

    // ============================================================
    // Serialization
    // ============================================================
    serialize() {
        return {
            quests: JSON.parse(JSON.stringify(this.quests)),
            storyFlags: { ...this.storyFlags },
            industryBonuses: { ...this.industryBonuses },
            chainUnlocks: [...this.chainUnlocks],
            _lastCheckDay: this._lastCheckDay,
            _lastCheckYear: this._lastCheckYear,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.quests = data.quests || {};
        this.storyFlags = data.storyFlags || {};
        this.industryBonuses = data.industryBonuses || {};
        this.chainUnlocks = data.chainUnlocks || [];
        this._lastCheckDay = data._lastCheckDay ?? -1;
        this._lastCheckYear = data._lastCheckYear ?? undefined;
    }
}
