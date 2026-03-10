# RimTown v3.0 改版設計文件

## 設計理念

> **AI 智能 NPC 生活互動是最大賣點**
> 主線劇情不是線性的「必須做 A 才能做 B」，而是一個開放世界框架：
> 玩家可以選擇**跟 NPC 搞好關係來推進劇情**，也可以**循規蹈矩搜集資源解任務**。
> 每個問題都有多種解法，NPC 的態度和關係直接影響結果。

---

## 一、主線劇情系統 (StoryEngine)

### 核心概念：章節制 + 多路線

劇情分為 **5 大章**，每章有明確的目標但解法自由。
玩家不需要「按順序」完成——可以同時推進多個方向。

### 章節設計

```
第一章：落腳（新手引導）
├── 目標：讓小鎮存活過第一個冬天
├── 觸發：遊戲開始
├── 關鍵任務：
│   ├── [搜集路線] 儲備 300 食物 + 200 木材
│   ├── [社交路線] 說服林美(醫生)教你草藥知識 → 好感度 > 40
│   └── [建設路線] 建造穀倉 + 深井
├── NPC 互動：
│   ├── 陳偉(鎮長) 會主動給你任務提示
│   ├── 劉俊(農夫) 好感高時教你種植技巧 → 農場產量 +20%
│   └── 吳達(礦工) 抱怨物資不夠 → 可以幫他找工具換取信任
└── 完成獎勵：解鎖「鎮民」身份，可以參與鎮務投票

第二章：紮根（經營基礎）
├── 目標：建立穩定的經濟體系
├── 觸發：第一章完成 + 存活 30 天
├── 關鍵任務：
│   ├── [經營路線] 小鎮繁榮度達到 30
│   ├── [社交路線] 與任意 5 位 NPC 達到「朋友」關係
│   └── [探索路線] 發現並探索 2 個區域
├── 特殊事件：
│   ├── 第一次商人來訪 → 趙霞(商人)有特殊對話
│   ├── 鄰鎮來信請求貿易 → 開啟貿易路線支線
│   └── 有 NPC 生病 → 醫療危機支線
└── 完成獎勵：解鎖進階建築、農場系統

第三章：風暴（危機與抉擇）
├── 目標：應對重大危機
├── 觸發：第二章完成 + 繁榮度 > 40
├── 危機類型（隨機選一）：
│   ├── 蝗災：農作物全毀 → 需要食物來源替代方案
│   ├── 盜匪圍城：連續攻擊 → 需要防禦或談判
│   └── 瘟疫：NPC 陸續生病 → 需要醫療資源
├── 解決方式：
│   ├── [武力] 楊鋒(守衛)好感高 → 組織民兵，戰鬥解決
│   ├── [智慧] 孫雨(研究員)好感高 → 研發對策
│   ├── [外交] 趙霞(商人)好感高 → 從外部取得援助
│   └── [團結] 全鎮平均好感高 → NPC 主動合作度過
├── NPC 分歧：
│   ├── 有人主張逃離 vs 留守（派系衝突）
│   ├── 玩家的選擇影響 NPC 對你的看法
│   └── 關係好的 NPC 會站在你這邊
└── 完成獎勵：「領袖」聲望、特殊建築解鎖

第四章：繁榮（發展巔峰）
├── 目標：讓小鎮成為區域強鎮
├── 觸發：第三章完成 + 人口 > 20
├── 目標（三選二）：
│   ├── 繁榮度達到 80
│   ├── 完成所有科技研究
│   └── 與所有 NPC 達到「朋友」以上關係
├── 特殊內容：
│   ├── 選舉系統深化：可以競選鎮長
│   ├── 新移民帶來新故事線
│   └── 發現古代遺跡的秘密
└── 完成獎勵：最終章解鎖

第五章：傳承（結局）
├── 目標：為小鎮寫下歷史
├── 多結局：
│   ├── [繁榮結局] 小鎮成為貿易中心
│   ├── [和平結局] 所有派系和解
│   ├── [傳奇結局] 完成所有成就
│   └── [個人結局] 與某 NPC 結婚生子
└── 結局動畫：用 NPC 的記憶和日報拼湊出「鎮史」
```

### 資料結構

```javascript
class StoryEngine {
    constructor() {
        this.currentChapter = 1;
        this.completedChapters = [];
        this.activeQuests = [];      // 當前可做的任務
        this.completedQuests = [];   // 已完成任務
        this.storyFlags = {};        // 劇情旗標（決定分支）
        this.reputation = 0;         // 聲望值（影響 NPC 信任）
    }
}

// 任務定義
const QUEST = {
    id: 'ch1_survive_winter',
    chapter: 1,
    title: '度過寒冬',
    description: '在第一個冬天來臨前儲備足夠的物資。',
    type: 'main',            // main / side / npc_personal
    routes: [                // 多種完成路線
        { id: 'gather', label: '搜集路線', conditions: [
            { type: 'resource', resource: 'food', amount: 300 },
            { type: 'resource', resource: 'wood', amount: 200 },
        ]},
        { id: 'social', label: '社交路線', conditions: [
            { type: 'relationship', npcId: 'lin_mei', minAffinity: 40 },
            { type: 'skill', skill: 'plants', minLevel: 3 },
        ]},
        { id: 'build', label: '建設路線', conditions: [
            { type: 'building', building: 'granary' },
            { type: 'building', building: 'well_upgrade' },
        ]},
    ],
    rewards: {
        reputation: 10,
        flag: 'citizen_status',
        unlock_quests: ['ch2_economy', 'ch2_friends'],
    },
    npcDialogues: {
        // NPC 在任務進行中的特殊對話
        'chen_wei': { trigger: 'quest_active', lines: ['你要是能幫大家撐過這個冬天，鎮民們會記住你的。'] },
        'liu_jun': { trigger: 'relationship_30', lines: ['你對種植有興趣？來，我教你幾招...'] },
    },
};
```

### 與 NPC 的深度整合

```
任務不只是「收集 X 個 Y」——NPC 會：
1. 主動給提示（好感度高時）
2. 阻礙你（敵對時）
3. 提供捷徑（特定關係觸發）
4. 對任務結果有反應（記憶 + 對話）

例：「盜匪圍城」任務
- 楊鋒(守衛) 好感 > 50 → 「我帶你去巡邏，教你怎麼佈防。」
- 楊鋒(守衛) 好感 < 0 → 「哼，你一個外來人懂什麼防守？」
- 趙霞(商人) 好感 > 40 → 「我有門路，可以從外面弄到武器。」
- 全鎮平均好感 > 30 → NPC 自發組織，降低任務難度
```

---

## 二、經營模擬系統 (ProsperityEngine)

### 繁榮度系統

繁榮度 (0-100) 是衡量小鎮發展的核心指標，由多個維度組成：

```javascript
class ProsperityEngine {
    // 繁榮度 = 各維度加權平均
    dimensions = {
        economy:    { weight: 0.25, value: 0 },  // 經濟：資源充足度、貿易
        buildings:  { weight: 0.20, value: 0 },  // 建設：建築數量與品質
        population: { weight: 0.15, value: 0 },  // 人口：人數、出生率
        happiness:  { weight: 0.15, value: 0 },  // 幸福：NPC 平均心情
        culture:    { weight: 0.10, value: 0 },  // 文化：節慶、教育
        defense:    { weight: 0.10, value: 0 },  // 防禦：建築、守衛
        beauty:     { weight: 0.05, value: 0 },  // 美觀：花園、裝飾
    };
}
```

### 農場/種植系統 (FarmSystem)

現有系統只有 `farmer` 職業自動產出食物。新系統讓玩家**親手經營農場**：

```javascript
class FarmSystem {
    constructor() {
        this.plots = [];          // 農田格子
        this.crops = {};          // 已種植作物
        this.season_calendar = {};// 種植日曆
        this.harvestLog = [];     // 收穫記錄
    }
}

// 作物定義
const CROPS = {
    wheat:    { name:'小麥', icon:'🌾', seasons:['春季','秋季'], growDays:8,  yield:{food:20},       difficulty:1 },
    rice:     { name:'稻米', icon:'🌾', seasons:['夏季'],       growDays:12, yield:{food:30},       difficulty:2 },
    herbs:    { name:'草藥', icon:'🌿', seasons:['春季','夏季'], growDays:6,  yield:{herbs:10},      difficulty:2 },
    cotton:   { name:'棉花', icon:'🌸', seasons:['夏季','秋季'], growDays:10, yield:{cloth:8},       difficulty:2 },
    grapes:   { name:'葡萄', icon:'🍇', seasons:['秋季'],       growDays:14, yield:{food:10,silver:15}, difficulty:3 },
    tea:      { name:'茶葉', icon:'🍵', seasons:['春季'],       growDays:10, yield:{silver:20},      difficulty:3 },
    flowers:  { name:'花卉', icon:'🌺', seasons:['春季','夏季'], growDays:5,  yield:{beauty:5},      difficulty:1 },
    mushroom: { name:'蘑菇', icon:'🍄', seasons:['秋季','冬季'], growDays:4,  yield:{food:8,herbs:3},difficulty:2 },
};

// 農田狀態
const PLOT_STATE = {
    empty: '空地',
    tilled: '已翻土',     // 需要翻土才能種
    planted: '已播種',
    growing: '生長中',
    ready: '可收穫',
    withered: '枯萎',     // 沒及時收穫或季節不對
};
```

### 農場玩法

```
1. 解鎖農場 → 第二章完成或建造「農田灌溉」後
2. 分配農田格子（初始 4 格，可擴充到 12 格）
3. 選擇作物 → 不同季節可種不同東西
4. 等待生長 → 會受天氣事件影響（暴風雨 -20% 產量）
5. 收穫 → 產出進入 stockpile
6. NPC 幫手 → 劉俊(農夫)好感高可以自動幫忙照顧

進階玩法：
- 輪作加成：同塊地連續種不同作物 → +15% 產量
- 灌溉加成：建了灌溉系統 → +30%
- 肥料系統：用 herbs 製作肥料 → 加速生長
- 種子商人：特殊商人賣稀有種子
- 品質系統：高技能種出「優質」作物 → 賣價 2x
```

### 繁榮度效果

```
繁榮度    效果
0-20      「荒涼」：商人不來、移民不來、士氣低
20-40     「起步」：偶爾有商人、可能有移民
40-60     「發展中」：穩定商人、穩定移民、解鎖新建築
60-80     「繁榮」：稀有商人、快速移民、NPC 特殊對話
80-100    「傳奇」：所有加成最大化、特殊事件、結局解鎖
```

---

## 三、AI 城鎮日報 (DailyNewsEngine)

### 概念
每天（遊戲內）用 LLM 自動生成一篇城鎮報紙，用 NPC 視角寫，充滿沉浸感。

### 資料結構

```javascript
class DailyNewsEngine {
    constructor() {
        this.newspapers = [];      // 歷史報紙
        this.todayEvents = [];     // 今日素材收集
        this._lastPublishDay = 0;
    }

    // 每天收集素材
    collectEvent(category, content, importance, agents = []) {
        this.todayEvents.push({ category, content, importance, agents, tick: world.tickCount });
    }

    // 每天結束時生成報紙
    async generateNewspaper(world) {
        // 收集當天素材
        const events = this.todayEvents.sort((a, b) => b.importance - a.importance);
        const topEvents = events.slice(0, 5);

        // 選一個 NPC 當「記者」
        const reporter = pickRandom(Object.values(world.agents).filter(a => !a.isPlayer));

        const prompt = `你是「${reporter.name}」，${reporter.personality.background}
你的性格特徵：${reporter.personality.traits.join('、')}
你正在為邊境鎮寫今天的日報。

今天發生的事：
${topEvents.map(e => `- [${e.category}] ${e.content}`).join('\n')}

目前天氣/季節：${world.clock.season} 第${world.clock.day}天
小鎮人口：${Object.keys(world.agents).length}人
鎮上的八卦：${world.gossipNetwork.activeGossip.slice(-3).map(g => g.content).join('；')}

請用你的視角寫一篇簡短有趣的日報（200-400字），包含：
1. 一個吸引人的頭條標題
2. 2-3 則新聞（用你的個性來評論）
3. 一段「記者碎碎念」（你個人的心情或觀察）

風格要求：像小鎮的黑板報，親切、生活化、帶有你的個人色彩。`;

        const content = await llm.generate(prompt, 600);
        const newspaper = {
            day: world.clock.day,
            season: world.clock.season,
            year: world.clock.year,
            reporter: reporter.name,
            reporterId: reporter.agentId,
            content: content,
            events: topEvents,
            publishedAt: world.tickCount,
        };
        this.newspapers.push(newspaper);
        return newspaper;
    }
}
```

### UI 設計

```
┌──────────────────────────────────────┐
│  📰 邊境鎮日報  第1年 秋季 第12天     │
│  記者：趙霞                           │
│──────────────────────────────────────│
│  【頭條】秋收節大豐收！穀倉快裝不下了   │
│                                      │
│  本日新聞：                           │
│  🌾 劉俊的農田今年產量破紀錄...        │
│  💕 聽說楊鋒最近老往許瑩的店裡跑...     │
│  ⚔️ 昨晚的山賊被守衛們成功擊退了       │
│                                      │
│  【記者碎碎念】                        │
│  今天在市集忙了一整天，腳都站酸了。      │
│  不過看到大家臉上的笑容，值了。         │
│  對了，有人看到我放在攤位上的圍巾嗎？    │
└──────────────────────────────────────┘
```

### 素材自動收集

在現有系統的關鍵時刻自動收集日報素材：

```
- 對話系統：重要對話 → collectEvent('social', ...)
- 經濟系統：生產異常、短缺 → collectEvent('economy', ...)
- 事件系統：天氣、襲擊 → collectEvent('event', ...)
- 關係系統：交往、分手、結婚 → collectEvent('relationship', ...)
- 探索系統：探險回歸 → collectEvent('exploration', ...)
- 建築系統：建築完成 → collectEvent('building', ...)
- 選舉系統：選舉結果 → collectEvent('politics', ...)
- 生命系統：出生、死亡 → collectEvent('lifecycle', ...)
- 農場系統：收穫、枯萎 → collectEvent('farm', ...)
```

---

## 四、NPC 個人任務系統 (NPCQuestSystem)

### 概念

每個 NPC 都有自己的「個人故事線」，透過互動解鎖。
這是最能體現「AI NPC 是賣點」的系統。

```javascript
const NPC_PERSONAL_QUESTS = {
    'liu_jun': {  // 劉俊 - 農夫
        quests: [
            {
                id: 'liu_jun_letter',
                title: '未寄出的情書',
                trigger: { affinity: 30 },  // 好感度 30 以上才會告訴你
                description: '劉俊偷偷寫了一封情書，但不敢寄出...',
                routes: [
                    { id: 'deliver', label: '幫他送出情書',
                      steps: [
                          { type: 'talk_to', npc: 'xu_ying', topic: 'liu_jun_letter' },
                          { type: 'report_back', npc: 'liu_jun' },
                      ]},
                    { id: 'encourage', label: '鼓勵他自己去',
                      conditions: [{ type: 'relationship', npcId: 'liu_jun', minAffinity: 60 }],
                      // 需要很高好感度才能說服他
                    },
                ],
                outcomes: {
                    deliver_accept: { flag: 'liu_xu_dating', reputation: 5, mood_liu: 25, mood_xu: 15 },
                    deliver_reject: { flag: 'liu_heartbreak', reputation: 3, mood_liu: -20 },
                    encourage_success: { flag: 'liu_xu_dating', reputation: 8, mood_liu: 30, mood_xu: 20 },
                },
            },
        ],
    },
    'wu_da': {  // 吳達 - 礦工
        quests: [
            {
                id: 'wu_da_old_mine',
                title: '老礦工的秘密',
                trigger: { affinity: 40, chapter: 2 },
                description: '吳達說年輕時發現過一條金礦脈，但礦坑塌了...',
                routes: [
                    { id: 'explore', label: '跟他一起去找',
                      steps: [
                          { type: 'resource', resource: 'tools', amount: 5 },
                          { type: 'explore_zone', zone: 'abandoned_mine' },
                      ]},
                ],
            },
        ],
    },
    // ... 每個 NPC 都有 2-3 個個人任務
};
```

### NPC 任務觸發方式

```
1. 好感度到門檻 → NPC 在對話中提起
   「其實...有件事我一直想找人幫忙...你願意聽嗎？」

2. 特定場景觸發 → NPC 在特定地點/時間有特殊行為
   （深夜看到劉俊在河邊發呆 → 觸發情書任務）

3. 連鎖觸發 → 完成 A 的任務後解鎖 B 的
   （幫劉俊送情書 → 解鎖許瑩的「設計新衣」任務）

4. LLM 感知任務 → 聊天時 NPC 會根據任務狀態調整對話
   prompt 注入：「你目前有一個未完成的心願：...」
```

---

## 五、自訂 NPC 系統 (CustomNPCSystem)

### 創建自訂 NPC

```javascript
class CustomNPCSystem {
    // 玩家可以創建自訂 NPC
    createCustomNPC(config) {
        // config: { name, age, gender, traits, values, background, job, appearance }
        // 限制：
        // - 名字不能與現有 NPC 重複
        // - 最多 3 個特質
        // - 自訂背景故事（最多 200 字）
        // - 可選外觀（職業決定外觀）
    }

    // 邀請朋友成為 NPC
    inviteAsNPC(friendConfig) {
        // friendConfig 可以從分享連結匯入
        // 包含：名字、性格、背景故事
        // 邀請的 NPC 會帶有「[玩家創建]」標記
    }
}
```

### UI 設計

```
┌─────────────────────────────────┐
│  👤 創建新居民                    │
│─────────────────────────────────│
│  名字：[________]                │
│  性別：○ 男  ○ 女               │
│  年齡：[20] ←──────→           │
│                                 │
│  性格特質（選 1-3 個）：          │
│  ☑ 善良  ☐ 害羞  ☐ 有魅力      │
│  ☐ 勤勞  ☐ 創意  ☐ 浪漫       │
│  ☐ 樂觀  ☐ 悲觀  ☐ 夜貓子     │
│                                 │
│  職業偏好：[農夫 ▾]              │
│                                 │
│  背景故事：                      │
│  [從遠方來的旅人，帶著一把______] │
│  [舊吉他和一段不願提起的過去。___] │
│                                 │
│  [預覽]  [創建]  [分享連結]      │
└─────────────────────────────────┘
```

### 限制機制

```
- 每座城鎮最多自訂 3 個 NPC（防止破壞平衡）
- 創建需消耗資源（silver: 50 + food: 30）= 「接待新移民的成本」
- 自訂 NPC 進城後，AI 接管行為（玩家只決定初始設定）
- 分享連結：可以生成一個 JSON 編碼的 URL 讓朋友匯入
```

---

## 六、系統整合與優先級

### 實現順序

```
Phase 1（核心）— 預計工作量最大
├── 1. StoryEngine + 第一章劇情
├── 2. ProsperityEngine 繁榮度系統
├── 3. 任務系統 UI（sidebar 新 tab）
└── 4. NPC 對話整合（任務相關特殊對話）

Phase 2（經營）
├── 5. FarmSystem 農場種植
├── 6. 農場 UI（新面板或 sidebar tab）
├── 7. 第二章劇情
└── 8. NPC 個人任務（前 4 個 NPC）

Phase 3（沉浸感）
├── 9.  DailyNewsEngine AI 日報
├── 10. 日報 UI（閱報亭/佈告欄）
├── 11. 第三章劇情
└── 12. 剩餘 NPC 個人任務

Phase 4（社交）
├── 13. CustomNPCSystem 自訂 NPC
├── 14. 分享/邀請功能
├── 15. 第四、五章劇情
└── 16. 多結局系統

Phase 5（未來 — 暫不實現）
└── 城鎮間外交 / Multiplayer
```

### 現有系統的改動

```
需要修改的現有系統：
├── simulation.js
│   ├── World.tick() → 加入 StoryEngine.update()、ProsperityEngine.update()
│   ├── World.serialize() → 加入新系統的序列化
│   ├── ConversationEngine → prompt 注入任務狀態、NPC 個人心願
│   ├── 事件系統 → 事件觸發時通知 DailyNewsEngine
│   └── 經濟系統 → 繁榮度計算鉤子
│
├── app.js
│   ├── sidebar → 新增「任務」「農場」「日報」tab
│   ├── renderSidebar() → 新 tab 渲染
│   └── 成就系統 → 新增劇情相關成就
│
└── tilemap.js
    ├── 農田格子渲染（在地圖上顯示作物生長狀態）
    └── 任務標記（NPC 頭上顯示 ! 或 ? 標記）
```

### 新檔案結構

```
wordpress/
├── simulation.js      (現有，擴充)
├── app.js             (現有，擴充)
├── tilemap.js         (現有，擴充)
├── story.js           (新) StoryEngine + 劇情定義
├── farm.js            (新) FarmSystem + 作物定義
├── prosperity.js      (新) ProsperityEngine
├── daily-news.js      (新) DailyNewsEngine
├── npc-quests.js      (新) NPC 個人任務定義
└── custom-npc.js      (新) CustomNPCSystem
```

---

## 七、關鍵設計原則

1. **NPC 是核心，不是裝飾**
   - 每個任務都能透過 NPC 關係找到捷徑
   - NPC 的對話會根據劇情進度、任務狀態動態變化
   - 玩家的選擇透過 NPC 記憶永久保存

2. **多路線不是假選擇**
   - 搜集路線和社交路線的難度大致相當
   - 不同路線會導致不同的 NPC 反應
   - 沒有「最佳路線」，只有「你的故事」

3. **經營不是數字遊戲**
   - 農場種植直觀、視覺化
   - 繁榮度是結果，不是目標
   - NPC 會對小鎮變化有反應（新建築→對話、農場豐收→心情）

4. **AI 日報是黏著度利器**
   - 每天一篇 → 玩家每天想回來看
   - NPC 視角 → 增加對 NPC 的感情
   - 記錄歷史 → 回顧時有成就感

5. **自訂 NPC 是社交傳播**
   - 邀請朋友 → 自然的口碑傳播
   - 分享連結 → 低門檻的社交互動
   - 看到朋友在小鎮生活 → 情感連結
