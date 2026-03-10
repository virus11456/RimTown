# RimTown 統整設計文件（v3 完整版）

> 本文件統整自 `DESIGN_v3.md`（主線劇情 + 繁榮度 + 自訂NPC）與 `DESIGN_farm_and_dailynews.md`（產業 + 農場 + 工廠 + 日報 + NPC事件）
> 標記 ✅ = 已實裝 | ⚠️ = 部分實裝 | ❌ = 未實裝 | ➖ = 暫不做

---

## 設計理念

> **AI 智能 NPC 生活互動是最大賣點**
> 主線劇情不是線性的「必須做 A 才能做 B」，而是一個開放世界框架：
> 玩家可以選擇**跟 NPC 搞好關係來推進劇情**，也可以**循規蹈矩搜集資源解任務**。
> 每個問題都有多種解法，NPC 的態度和關係直接影響結果。

---

## 系統總覽與實裝狀態

| # | 系統 | 檔案 | 狀態 |
|---|------|------|------|
| 1 | 四大產業 + 城鎮等級 (IndustryManager) | `simulation.js` 內建 | ✅ 已實裝 |
| 2 | 農場種植 (FarmSystem) | `farm.js` | ✅ 已實裝 |
| 3 | 工廠加工 (ProcessingSystem) | `processing.js` | ✅ 已實裝 |
| 4 | NPC 關係連鎖事件 (NPCEventSystem) | `npc-events.js` | ✅ 已實裝 |
| 5 | AI 城鎮日報 (DailyNewsEngine) | `daily-news.js` | ✅ 已實裝 |
| 6 | 主線任務 (QuestSystem) | `quest-system.js` | ✅ 已實裝（多路線版） |
| 7 | 繁榮度系統 (ProsperityEngine) | `prosperity.js` | ✅ 已實裝 |
| 8 | NPC 個人故事線 (NPCQuestSystem) | `npc-quests.js` | ✅ 已實裝 |
| 9 | 自訂 NPC (CustomNPCSystem) | `custom-npc.js`（待建） | ❌ 未實裝 |
| 10 | 多結局系統 | 整合於 quest-system.js | ❌ 未實裝 |
| 11 | 城鎮間外交 / Multiplayer | — | ➖ 暫不做 |

---

## 一、四大產業系統 (IndustryManager) ✅ 已實裝

### 設計理念

遊戲開始時，玩家**四選一**選擇起始產業。
城鎮升級到一定等級後，才能依序解鎖更多產業。
每個產業都有獨立的**升級路線**（Lv1→Lv5），越高級產出越值錢。

### 四大產業定義

```javascript
const INDUSTRIES = {
    lumber: {
        name: '伐木業', icon: '🪓', npcJob: 'carpenter', resource: 'wood',
        unlockTownLevel: 0,  // 起始可選
        levels: [
            { lv:1, name:'伐木小屋',  output:{wood:15},                       workers:1 },
            { lv:2, name:'伐木場',    output:{wood:25},                       workers:2, bonus:'解鎖硬木' },
            { lv:3, name:'製材所',    output:{wood:40, plank:8},              workers:3 },
            { lv:4, name:'林業公司',   output:{wood:60, plank:15, hardwood:5}, workers:4 },
            { lv:5, name:'木材帝國',   output:{wood:80, plank:25, hardwood:12},workers:5, bonus:'可出口' },
        ],
    },
    quarry: {
        name: '採石業', icon: '⛏️', npcJob: 'miner', resource: 'stone',
        unlockTownLevel: 0,
        levels: [
            { lv:1, name:'採石小坑',  output:{stone:12},                       workers:1 },
            { lv:2, name:'採石場',    output:{stone:20},                       workers:2, bonus:'解鎖花崗岩' },
            { lv:3, name:'石材工坊',   output:{stone:35, brick:6},              workers:3 },
            { lv:4, name:'大型礦場',   output:{stone:50, brick:12, marble:3},   workers:4 },
            { lv:5, name:'石材帝國',   output:{stone:70, brick:20, marble:8},   workers:5, bonus:'可出口' },
        ],
    },
    farming: {
        name: '農業', icon: '🌾', npcJob: 'farmer', resource: 'food',
        unlockTownLevel: 0,
        levels: [
            { lv:1, name:'小農田',    output:{food:15}, workers:1, plots:4 },
            { lv:2, name:'農莊',      output:{food:25}, workers:2, plots:8 },
            { lv:3, name:'灌溉農場',   output:{food:40}, workers:3, plots:12, bonus:'灌溉 +30%' },
            { lv:4, name:'大型農莊',   output:{food:60}, workers:4, plots:16, bonus:'高級作物' },
            { lv:5, name:'農業帝國',   output:{food:80}, workers:5, plots:20, bonus:'出口+品種改良' },
        ],
    },
    mining: {
        name: '礦業', icon: '⚒️', npcJob: 'blacksmith', resource: 'metal',
        unlockTownLevel: 0,
        levels: [
            { lv:1, name:'小礦坑',    output:{metal:8},                        workers:1 },
            { lv:2, name:'礦場',      output:{metal:15},                       workers:2, bonus:'解鎖銅礦' },
            { lv:3, name:'冶煉廠',    output:{metal:25, steel:4},              workers:3 },
            { lv:4, name:'大型礦業',   output:{metal:40, steel:10, gold:2},     workers:4 },
            { lv:5, name:'礦業帝國',   output:{metal:60, steel:18, gold:5},     workers:5, bonus:'可出口' },
        ],
    },
};
```

### 城鎮等級（7級）

```
Lv1 荒村    → 人口5+,  建築0+  → 1個產業
Lv2 小村    → 人口10+, 建築3+  → 1個產業
Lv3 村莊    → 人口15+, 建築5+  → 2個產業
Lv4 小鎮    → 人口20+, 建築8+  → 2個產業
Lv5 城鎮    → 人口25+, 建築12+ → 3個產業
Lv6 大城鎮  → 人口30+, 建築15+ → 3個產業
Lv7 城市    → 人口35+, 建築18+ → 4個產業全開
```

### 產業協同加成

```
🪓+🌾 伐木+農業 = 「農林複合」→ 農產 +15%
🪓+⛏️ 伐木+採石 = 「營建雙雄」→ 建築速度 +25%
🪓+⚒️ 伐木+礦業 = 「工業基礎」→ 工具產量 +20%
⛏️+⚒️ 採石+礦業 = 「地下霸主」→ 採集效率 +20%
⛏️+🌾 採石+農業 = 「基建農業」→ 穀倉容量 +30%
🌾+⚒️ 農業+礦業 = 「自給自足」→ 食物消耗 -15%
四大全開 = 「完全體」→ 所有加成 + 特殊成就
```

---

## 二、農場種植系統 (FarmSystem) ✅ 已實裝

### 作物定義（受農業等級限制）

```javascript
const CROPS = {
    // Lv1 基礎
    wheat:        { name:'小麥',     icon:'🌾', seasons:['春季','秋季'], growDays:8,  yield:15, sellPrice:2,  reqLevel:1 },
    potato:       { name:'馬鈴薯',   icon:'🥔', seasons:['春季','秋季'], growDays:7,  yield:20, sellPrice:1,  reqLevel:1 },
    // Lv2
    rice:         { name:'稻米',     icon:'🌾', seasons:['夏季'],       growDays:12, yield:20, sellPrice:3,  reqLevel:2 },
    corn:         { name:'玉米',     icon:'🌽', seasons:['夏季','秋季'], growDays:10, yield:18, sellPrice:2,  reqLevel:2 },
    cotton:       { name:'棉花',     icon:'🌸', seasons:['夏季','秋季'], growDays:10, yield:10, sellPrice:4,  reqLevel:2 },
    flowers:      { name:'花卉',     icon:'🌺', seasons:['春季','夏季'], growDays:5,  yield:12, sellPrice:3,  reqLevel:2 },
    // Lv3
    herbs:        { name:'草藥',     icon:'🌿', seasons:['春季','夏季'], growDays:6,  yield:8,  sellPrice:5,  reqLevel:3 },
    mushroom:     { name:'蘑菇',     icon:'🍄', seasons:['秋季','冬季'], growDays:4,  yield:10, sellPrice:4,  reqLevel:3 },
    sugarcane:    { name:'甘蔗',     icon:'🎋', seasons:['夏季'],       growDays:12, yield:14, sellPrice:3,  reqLevel:3 },
    // Lv4
    tea:          { name:'茶葉',     icon:'🍵', seasons:['春季'],       growDays:10, yield:6,  sellPrice:8,  reqLevel:4 },
    grapes:       { name:'葡萄',     icon:'🍇', seasons:['秋季'],       growDays:14, yield:8,  sellPrice:6,  reqLevel:4 },
    // Lv5
    golden_wheat: { name:'金色小麥', icon:'✨', seasons:['秋季'],       growDays:15, yield:10, sellPrice:15, reqLevel:5 },
    dragon_fruit: { name:'火龍果',   icon:'🐉', seasons:['夏季'],       growDays:12, yield:6,  sellPrice:20, reqLevel:5 },
};
```

### 農場玩法

```
操作流程：翻土 → 播種（需當季+種子費） → 等待生長 → 收穫 → 處理（自用/賣/送工廠加工）

品質系統：
- 普通 (normal)   → 1x 售價
- 優良 (good)     → 1.5x 售價（施肥+灌溉充足）
- 極品 (excellent) → 2.5x 售價（NPC農夫幫忙+輪作+施肥）

NPC 農夫互動（劉俊）：
- 好感 20+：告訴你當季最賺作物
- 好感 40+：自動照顧農田（+10%生長, +1品質）
- 好感 60+：教輪作技巧
- 好感 80+：送稀有種子
```

---

## 三、工廠加工系統 (ProcessingSystem) ✅ 已實裝

### 工廠定義

```javascript
const FACTORIES = {
    bakery:             { name:'麵包坊',   icon:'🍞', recipes:['小麥→麵包', '小麥+糖→糕點'],         workers:1 },
    textile_mill:       { name:'紡織廠',   icon:'🧵', recipes:['棉花→布料', '布料→衣服'],            workers:2 },
    brewery:            { name:'釀酒廠',   icon:'🍺', recipes:['小麥→啤酒', '葡萄→葡萄酒'],          workers:1 },
    herbal_workshop:    { name:'草藥工坊', icon:'⚗️', recipes:['草藥→藥品', '草藥+花→香水'],         workers:1 },
    tea_house:          { name:'茶坊',     icon:'🍵', recipes:['茶葉→精製茶', '茶+草藥→養生茶'],     workers:1 },
    sugar_refinery:     { name:'製糖廠',   icon:'🍬', recipes:['甘蔗→糖', '糖+水果→果醬'],          workers:1 },
    furniture_workshop: { name:'家具工坊', icon:'🪑', recipes:['木材→家具', '木材+布料→豪華家具'],    workers:2 },
};
```

### 加工鏈（開羅風格）

```
🌾 小麥(2銀)  → 🍞 麵包(4銀)      利潤 +100%
🌾 小麥(2銀)  → 🍺 啤酒(5銀)      利潤 +150%
🍇 葡萄(6銀)  → 🍷 葡萄酒(15銀)   利潤 +150%
🌸 棉花(4銀)  → 🧵 布料 → 👔 衣服(12銀)  多段加工
🍵 茶葉(8銀)  → 🍵 精製茶(18銀)   利潤 +125%
🌿 草藥+🌺花  → ⚗️ 香水(20銀)    利潤 +150%
```

### 工廠運作

```
員工效率：對應職業 NPC = 100% | 其他 NPC = 60% | 心情好 +20% | 高技能 = 優質成品 1.5x
販賣管道：商人來訪（價格浮動）| 市集擺攤（穩定但量少）| 限時訂單（2倍價格）
```

---

## 四、NPC 關係連鎖事件 (NPCEventSystem) ✅ 已實裝

### 已實裝事件

```
【衝突類】
- 打架住院：好感 < -25 的 NPC 可能打架 → 受害者住院 → 無法工作 → 全鎮對打人者好感降
- 劈腿被抓：被戴綠帽者暴走 → 可能打架 → 全鎮八卦 → 農場產量下降（如農夫心碎）
- 搞破壞：neurotic + 心情差的 NPC → 深夜破壞農田

【正面類】
- 好友合作：同工廠好友 → 心情提升
- 婚禮加成：全鎮心情 +15，蜜月效率 +30%

【狀態異常】
- 住院：消耗藥品，有醫生快 3 天，沒醫生沒藥 7 天。好友心情下降
- 失蹤：伴侶心情崩潰，5天未找到 → 永久離開
```

---

## 五、AI 城鎮日報 (DailyNewsEngine) ✅ 已實裝

### 核心機制

```
每天遊戲結束時：
1. 收集當天素材（各系統自動注入 collectEvent）
2. 按重要性排序取前 5 件
3. 隨機選 NPC 當記者
4. LLM 生成日報（帶記者個人風格）
5. 永久保存所有歷史日報

素材來源：
- 對話系統 → collectEvent('social', ...)
- 經濟系統 → collectEvent('economy', ...)
- 事件系統 → collectEvent('event', ...)
- 關係系統 → collectEvent('relationship', ...)
- 選舉系統 → collectEvent('politics', ...)
- 建築系統 → collectEvent('building', ...)
- 農場系統 → collectEvent('farm', ...)
- 工廠系統 → collectEvent('factory', ...)
- 探索系統 → collectEvent('exploration', ...)
- 生命週期 → collectEvent('lifecycle', ...)
```

---

## 六、主線任務系統 (QuestSystem) ⚠️ 需升級

### 現狀

目前的 `quest-system.js` 是**單路線數值達標**制：每個任務只有一種完成方式（收集X資源、人口達到Y等）。

### 目標

升級為**多路線 StoryEngine**：每個任務提供搜集路線、社交路線、建設路線等多種解法，NPC 好感度直接影響任務進展。

### 章節設計（5 章）

```
第一章：落腳（新手引導）
├── 目標：讓小鎮存活過第一個冬天
├── 觸發：遊戲開始
├── 完成路線（任選其一）：
│   ├── [搜集路線] 儲備 300 食物 + 200 木材
│   ├── [社交路線] 說服林美(醫生)教草藥知識 → 好感度 > 40
│   └── [建設路線] 建造穀倉 + 深井
├── NPC 互動：
│   ├── 陳偉(鎮長) 主動給任務提示
│   ├── 劉俊(農夫) 好感高→教種植技巧 → 農場產量 +20%
│   └── 吳達(礦工) 幫他找工具→換取信任
└── 完成獎勵：解鎖「鎮民」身份 + 聲望 +10

第二章：紮根（經營基礎）
├── 目標：建立穩定的經濟體系
├── 觸發：第一章完成 + 存活 30 天
├── 完成路線（任選其一）：
│   ├── [經營路線] 小鎮繁榮度達到 30
│   ├── [社交路線] 與任意 5 位 NPC 達到「朋友」關係
│   └── [探索路線] 發現並探索 2 個區域
├── 特殊事件：
│   ├── 第一次商人來訪 → 趙霞(商人)特殊對話
│   ├── 鄰鎮來信請求貿易 → 開啟貿易路線支線
│   └── 有 NPC 生病 → 醫療危機支線
└── 完成獎勵：解鎖進階建築、農場系統

第三章：風暴（危機與抉擇）
├── 目標：應對重大危機
├── 觸發：第二章完成 + 繁榮度 > 40
├── 危機類型（隨機選一）：
│   ├── 蝗災：農作物全毀 → 需要替代食物來源
│   ├── 盜匪圍城：連續攻擊 → 需要防禦或談判
│   └── 瘟疫：NPC 陸續生病 → 需要醫療資源
├── 解決方式（任選其一）：
│   ├── [武力] 楊鋒(守衛)好感高 → 組織民兵
│   ├── [智慧] 孫雨(研究員)好感高 → 研發對策
│   ├── [外交] 趙霞(商人)好感高 → 外部援助
│   └── [團結] 全鎮平均好感高 → NPC 主動合作
├── NPC 分歧：
│   ├── 有人主張逃離 vs 留守（派系衝突）
│   └── 關係好的 NPC 會站在你這邊
└── 完成獎勵：「領袖」聲望 + 特殊建築解鎖

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
├── 多結局（見第十節）
└── 結局動畫：用 NPC 的記憶和日報拼湊出「鎮史」
```

### 任務資料結構（升級版）

```javascript
// 升級後的任務定義——支援多路線
const QUEST = {
    id: 'ch1_survive_winter',
    chapter: 1,
    title: '度過寒冬',
    description: '在第一個冬天來臨前儲備足夠的物資。',
    type: 'main',                // main / side / npc_personal
    routes: [                    // 多種完成路線（任選其一即可完成）
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
        'chen_wei': { trigger: 'quest_active', lines: ['你要是能幫大家撐過這個冬天，鎮民們會記住你的。'] },
        'liu_jun':  { trigger: 'relationship_30', lines: ['你對種植有興趣？來，我教你幾招...'] },
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
- 楊鋒(守衛) 好感 < 0  → 「哼，你一個外來人懂什麼防守？」
- 趙霞(商人) 好感 > 40 → 「我有門路，可以從外面弄到武器。」
- 全鎮平均好感 > 30     → NPC 自發組織，降低任務難度

LLM prompt 注入：
"你知道玩家正在收集建材升級伐木場，但還差 30 石頭。
 根據你的性格和跟玩家的關係，自然地在對話中回應。
 如果你願意幫忙，用你自己的方式表達。"
```

---

## 七、繁榮度系統 (ProsperityEngine) ❌ 未實裝

### 設計

繁榮度 (0-100) 是衡量小鎮發展的核心指標，由多個維度組成：

```javascript
class ProsperityEngine {
    // 繁榮度 = 各維度加權平均
    dimensions = {
        economy:    { weight: 0.25, value: 0 },  // 經濟：資源充足度、貿易量、工廠產出
        buildings:  { weight: 0.20, value: 0 },  // 建設：建築數量與品質、城鎮等級
        population: { weight: 0.15, value: 0 },  // 人口：人數、出生率
        happiness:  { weight: 0.15, value: 0 },  // 幸福：NPC 平均心情
        culture:    { weight: 0.10, value: 0 },  // 文化：節慶、教育
        defense:    { weight: 0.10, value: 0 },  // 防禦：守衛數量、城牆
        beauty:     { weight: 0.05, value: 0 },  // 美觀：花園、裝飾、花卉種植
    };
}
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

### 與其他系統的連動

```
- 主線任務第二章要求繁榮度 30
- 主線任務第三章要求繁榮度 40
- 主線任務第四章可選目標：繁榮度 80
- 農場豐收 → economy 維度上升
- 建造新建築 → buildings 維度上升
- NPC 心情好 → happiness 維度上升
- 花卉種植 → beauty 維度上升
- 守衛+城牆 → defense 維度上升
```

---

## 八、NPC 個人故事線 (NPCQuestSystem) ✅ 已實裝

### 概念

每個 NPC 都有自己的「個人故事線」，透過好感度解鎖。
這是最能體現「AI NPC 是賣點」的系統——不是隨機事件，是**有劇情的個人任務**。

### NPC 個人任務定義

```javascript
const NPC_PERSONAL_QUESTS = {
    'liu_jun': {  // 劉俊 - 農夫
        quests: [
            {
                id: 'liu_jun_letter',
                title: '未寄出的情書',
                trigger: { affinity: 30 },
                description: '劉俊偷偷寫了一封情書，但不敢寄出...',
                routes: [
                    { id: 'deliver', label: '幫他送出情書',
                      steps: [
                          { type: 'talk_to', npc: 'xu_ying', topic: 'liu_jun_letter' },
                          { type: 'report_back', npc: 'liu_jun' },
                      ]},
                    { id: 'encourage', label: '鼓勵他自己去',
                      conditions: [{ type: 'relationship', npcId: 'liu_jun', minAffinity: 60 }],
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
    // 其他 NPC 各 2-3 個任務...
};
```

### 觸發方式

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

### NPC 與產業的深度綁定

```
每個產業都有「代表 NPC」，好感度直接影響產業發展：

🪓 伐木業 — 王大力（木匠）
   好感 10+：閒聊透露哪片森林木材最好
   好感 30+：教你辨認木材品種（解鎖硬木採集捷徑）
   好感 50+：「有件事...我年輕時在北山發現過一棵千年古木...」→ 支線任務
   好感 70+：自願當伐木場主管（產量 +25%）
   好感 90+：「這把斧頭跟了我一輩子，現在交給你。」→ 傳說工具

⛏️ 採石業 — 吳達（礦工）
   好感 30+：告訴你哪裡有好石頭
   好感 50+：「年輕時我在廢礦裡看到過會發光的石頭...」→ 大理石礦脈任務
   好感 70+：帶你去秘密礦脈

🌾 農業 — 劉俊（農夫）
   好感 30+：分享種植技巧
   好感 50+：「我爺爺留下一本種植手札...」→ 解鎖稀有作物
   好感 70+：自動幫你照顧農田

⚒️ 礦業 — 鐵匠
   好感 30+：打造工具品質更高
   好感 50+：「傳說這座山下面有龍脈...」→ 深層採礦任務
```

---

## 九、自訂 NPC 系統 (CustomNPCSystem) ❌ 未實裝

> 不含分享連結/邀請等連線功能

### 創建自訂 NPC

```javascript
class CustomNPCSystem {
    createCustomNPC(config) {
        // config: { name, age, gender, traits, values, background, job }
        // 限制：
        // - 名字不能與現有 NPC 重複
        // - 最多 3 個特質
        // - 自訂背景故事（最多 200 字）
        // - 職業偏好決定初始技能
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
│          [預覽]  [創建]          │
└─────────────────────────────────┘
```

### 限制機制

```
- 每座城鎮最多自訂 3 個 NPC
- 創建需消耗資源（silver:50 + food:30）= 接待新移民的成本
- 自訂 NPC 進城後，AI 接管行為（玩家只決定初始設定）
```

---

## 十、多結局系統 ❌ 未實裝

### 結局類型

```
[繁榮結局] 繁榮度達 80 以上 → 小鎮成為貿易中心
[和平結局] 所有派系和解 → 大團圓
[傳奇結局] 完成所有成就 → 完美通關
[個人結局] 與某 NPC 結婚生子 → 個人幸福

結局動畫：用 NPC 的記憶和日報拼湊出「鎮史」
```

---

## 十一、NPC 與經濟系統的深度整合設計

### 感情培養 → 解鎖經濟路線

```
【約會中的 NPC】
→ 約會對象是農夫？→ 農場產量 +15%
→ 約會對象是商人？→ 所有交易價格 -10%
→ 約會時 NPC 會送「小禮物」（稀有資源）

【結婚後的 NPC】
→ 配偶自動幫忙管理一個產業（免費主管）
→ 配偶技能加成到對應產業
→ 吵架時產量下降（真實感！）

【親密好友（非戀愛）】
→ 好友 NPC 主動分享情報（哪些商品漲價、哪裡有資源）
→ 在對話中自然提供幫助（AI 生成，不是系統給的）
```

### NPC 對工廠/農場的情感反應

```
由 LLM 根據 NPC 性格即時生成：
prompt 注入：「小鎮剛建好了一座麵包坊。以你的性格，你會怎麼看待這件事？」
→ 每次回應都不同，真正的 AI 個性化反應
```

---

## 十二、對話系統 prompt 注入（確保 AI 品質）

```javascript
function buildConversationContext(npc, world) {
    return {
        ...existingContext,  // 性格、記憶、關係

        // 產業/經濟
        town_industries: Object.keys(world.industry.industries).map(k => INDUSTRIES[k].name),
        town_level: world.industry.townLevel,
        recent_harvests: world.farm?.harvestLog.slice(-3),
        factory_products: world.processing?.recentOutput.slice(-3),

        // NPC 對經濟的看法（根據職業和性格）
        economic_opinion: '...',

        // NPC 可以主動提供幫助的事項
        can_help_with: getHelpableItems(npc, world),

        // 玩家當前任務（讓 NPC 能自然回應）
        player_active_tasks: world.activeTasks?.map(t => ({
            task: t.description,
            hint: '如果玩家提到相關話題，你可以根據自己的能力和性格提供幫助或建議'
        })),

        // NPC 個人心願（如果有未觸發/進行中的個人任務）
        personal_wish: getNPCPersonalWish(npc),
    };
}
```

---

## 十三、實作優先順序

### 已完成

```
✅ Phase A：四大產業 + 城鎮等級
✅ Phase B：農場深化 + 種植
✅ Phase C：工廠加工
✅ Phase D：NPC 關係連鎖事件
✅ Phase E：AI 日報
✅ Phase F：打磨平衡
✅ 基礎主線任務（QuestSystem 簡化版）
```

### 待完成

```
Phase G：主線劇情升級（多路線 StoryEngine）
├── G1. 升級 QuestSystem 支援 routes[] 多路線
├── G2. 重寫 5 章任務定義（加入社交/搜集/建設路線）
├── G3. NPC 對話 prompt 注入任務狀態
├── G4. 第三章危機系統（隨機蝗災/盜匪/瘟疫）
└── G5. 任務 UI 顯示多路線進度

Phase H：繁榮度系統
├── H1. ProsperityEngine 核心（7 維度加權計算）
├── H2. 各系統鉤子（農場→經濟、建築→建設、NPC心情→幸福...）
├── H3. 繁榮度效果（影響商人、移民、事件觸發）
└── H4. UI 顯示繁榮度儀表板

Phase I：NPC 個人故事線
├── I1. NPCQuestSystem 核心（好感度觸發、多路線、結果分支）
├── I2. 前 4 個 NPC 個人任務（劉俊情書、吳達老礦坑...）
├── I3. NPC 與產業深度綁定（代表NPC好感→產業加成）
├── I4. 剩餘 NPC 個人任務
├── I5. 連鎖觸發（完成 A 解鎖 B）
└── I6. LLM prompt 注入個人心願

Phase J：自訂 NPC + 多結局
├── J1. CustomNPCSystem 核心（創建、限制、AI接管）
├── J2. 自訂 NPC UI
├── J3. 多結局判定邏輯
└── J4. 結局演出（鎮史回顧）
```

---

## 十四、檔案結構

```
wordpress/
├── simulation.js      (現有) 核心模擬引擎
├── app.js             (現有) UI + sidebar
├── tilemap.js         (現有) 地圖渲染
├── farm.js            (現有) ✅ FarmSystem
├── processing.js      (現有) ✅ ProcessingSystem
├── daily-news.js      (現有) ✅ DailyNewsEngine
├── npc-events.js      (現有) ✅ NPCEventSystem
├── quest-system.js    (現有) ⚠️ QuestSystem → 需升級為多路線
├── prosperity.js      ✅ ProsperityEngine
├── npc-quests.js      ✅ NPC 個人故事線
└── custom-npc.js      (待建) ❌ CustomNPCSystem

chrome-extension/      (同步上述所有檔案)
```

---

## 十五、關鍵設計原則

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

5. **感情培養有實際效益**
   - 約會/結婚的 NPC 帶來經濟加成
   - 好友 NPC 主動提供幫助
   - 吵架/分手會影響產量（真實感）
