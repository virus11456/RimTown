# RimTown 設計規劃：四大產業 + 工廠加工 + AI 日報

> 基於現有架構延伸，不重寫任何現有系統
> **保留原有 NewsSystem 不動**，新增獨立的 DailyNewsEngine
> **保留所有 AI 日報不刪除**

---

## 零、四大產業系統 (IndustrySystem) — 核心機制

### 設計理念

遊戲開始時，玩家**四選一**選擇起始產業。
城鎮升級到一定等級後，才能依序解鎖更多產業。
每個產業都有獨立的**升級路線**（Lv1→Lv5），越高級產出越值錢。

### 0.1 四大產業定義

```javascript
const INDUSTRIES = {
    lumber: {
        name: '伐木業', icon: '🪓', npcJob: 'carpenter',
        resource: 'wood',
        description: '砍伐樹木，生產木材。木材是建築和家具的基礎。',
        unlockTownLevel: 0,  // 起始可選
        levels: [
            { lv:1, name:'伐木小屋',     cost:{silver:0},                          output:{wood:15},      bonus:'基礎伐木',          workers:1 },
            { lv:2, name:'伐木場',       cost:{silver:50, stone:20},               output:{wood:25},      bonus:'解鎖硬木採集',       workers:2 },
            { lv:3, name:'製材所',       cost:{silver:120, stone:40, metal:10},    output:{wood:40,plank:8}, bonus:'原木→木板加工',    workers:3 },
            { lv:4, name:'林業公司',     cost:{silver:250, stone:60, metal:20},    output:{wood:60,plank:15,hardwood:5}, bonus:'稀有木材', workers:4 },
            { lv:5, name:'木材帝國',     cost:{silver:500, stone:80, metal:40},    output:{wood:80,plank:25,hardwood:12}, bonus:'出口木材', workers:5 },
        ],
        // 加工鏈
        processingChain: [
            '🪵 原木(1銀) → 🪵 木板(3銀) → 🪑 家具(10銀) → 🏠 精裝家具(25銀)',
            '🪵 硬木(5銀) → 🎸 樂器(20銀)',
            '🪵 木板(3銀) → 🛶 木船(15銀)',
        ],
    },
    quarry: {
        name: '採石業', icon: '⛏️', npcJob: 'miner',
        resource: 'stone',
        description: '開採石材，是建築城牆和高級建築的基礎。',
        unlockTownLevel: 0,  // 起始可選
        levels: [
            { lv:1, name:'採石小坑',     cost:{silver:0},                          output:{stone:12},     bonus:'基礎採石',          workers:1 },
            { lv:2, name:'採石場',       cost:{silver:60, wood:25},               output:{stone:20},     bonus:'解鎖花崗岩',        workers:2 },
            { lv:3, name:'石材工坊',     cost:{silver:150, wood:40, metal:15},    output:{stone:35,brick:6}, bonus:'石頭→磚塊加工', workers:3 },
            { lv:4, name:'大型礦場',     cost:{silver:300, wood:50, metal:30},    output:{stone:50,brick:12,marble:3}, bonus:'大理石開採', workers:4 },
            { lv:5, name:'石材帝國',     cost:{silver:600, wood:60, metal:50},    output:{stone:70,brick:20,marble:8}, bonus:'出口石材', workers:5 },
        ],
        processingChain: [
            '🪨 石頭(2銀) → 🧱 磚塊(5銀) → 🏛️ 石雕(15銀)',
            '🪨 大理石(8銀) → 🗿 雕像(30銀)',
            '🧱 磚塊(5銀) → 🏗️ 建材(12銀)',
        ],
    },
    farming: {
        name: '農業', icon: '🌾', npcJob: 'farmer',
        resource: 'food',
        description: '種植作物，生產食物和經濟作物。養活全鎮的基礎。',
        unlockTownLevel: 0,  // 起始可選
        levels: [
            { lv:1, name:'小農田',       cost:{silver:0},                          output:{food:15},      bonus:'基礎作物（小麥、馬鈴薯）', workers:1, plots:4 },
            { lv:2, name:'農莊',         cost:{silver:50, wood:30},               output:{food:25},      bonus:'解鎖稻米、玉米、棉花',     workers:2, plots:8 },
            { lv:3, name:'灌溉農場',     cost:{silver:130, wood:40, stone:20},    output:{food:40},      bonus:'灌溉系統 +30% 產量',       workers:3, plots:12 },
            { lv:4, name:'大型農莊',     cost:{silver:280, wood:50, stone:30},    output:{food:60},      bonus:'解鎖茶葉、葡萄等高級作物', workers:4, plots:16 },
            { lv:5, name:'農業帝國',     cost:{silver:550, wood:60, stone:40},    output:{food:80},      bonus:'出口農產品 + 品種改良',    workers:5, plots:20 },
        ],
        processingChain: [
            '🌾 小麥(2銀) → 🍞 麵包(4銀) → 🥐 糕點(8銀)',
            '🍇 葡萄(6銀) → 🍷 葡萄酒(15銀)',
            '🌸 棉花(4銀) → 🧵 布料(5銀) → 👔 衣服(12銀)',
            '🍵 茶葉(8銀) → 🍵 精製茶(18銀)',
        ],
    },
    mining: {
        name: '礦業', icon: '⚒️', npcJob: 'blacksmith',
        resource: 'metal',
        description: '開採礦石，冶煉金屬。工具和武器的來源。',
        unlockTownLevel: 0,  // 起始可選
        levels: [
            { lv:1, name:'小礦坑',       cost:{silver:0},                          output:{metal:8},      bonus:'基礎鐵礦',          workers:1 },
            { lv:2, name:'礦場',         cost:{silver:70, wood:30},               output:{metal:15},     bonus:'解鎖銅礦',          workers:2 },
            { lv:3, name:'冶煉廠',       cost:{silver:160, wood:35, stone:25},    output:{metal:25,steel:4}, bonus:'鐵→鋼加工',     workers:3 },
            { lv:4, name:'大型礦業',     cost:{silver:320, wood:40, stone:40},    output:{metal:40,steel:10,gold:2}, bonus:'金礦開採', workers:4 },
            { lv:5, name:'礦業帝國',     cost:{silver:650, wood:50, stone:50},    output:{metal:60,steel:18,gold:5}, bonus:'出口金屬', workers:5 },
        ],
        processingChain: [
            '⛓️ 鐵(4銀) → 🗡️ 鋼(10銀) → ⚔️ 武器(25銀)',
            '⛓️ 鐵(4銀) → 🔧 工具(8銀) → ⚙️ 精密工具(20銀)',
            '🥇 金(15銀) → 💍 飾品(40銀)',
        ],
    },
};
```

### 0.2 城鎮等級與產業解鎖

```javascript
const TOWN_LEVELS = {
    1: { name:'荒村',     requirement:{population:5,  buildings:0},  unlockSlots:1, description:'剛建立的小聚落' },
    2: { name:'小村',     requirement:{population:10, buildings:3},  unlockSlots:1, description:'有了基本設施' },
    3: { name:'村莊',     requirement:{population:15, buildings:5},  unlockSlots:2, description:'可以開啟第二產業！' },
    4: { name:'小鎮',     requirement:{population:20, buildings:8},  unlockSlots:2, description:'兩個產業都在運作' },
    5: { name:'城鎮',     requirement:{population:25, buildings:12}, unlockSlots:3, description:'可以開啟第三產業！' },
    6: { name:'大城鎮',   requirement:{population:30, buildings:15}, unlockSlots:3, description:'三個產業蓬勃發展' },
    7: { name:'城市',     requirement:{population:35, buildings:18}, unlockSlots:4, description:'四大產業全開！' },
};

// 產業解鎖流程
class IndustryManager {
    constructor() {
        this.townLevel = 1;
        this.industries = {};       // { lumber: { level:1, workers:[], ... }, ... }
        this.maxIndustries = 1;     // 由城鎮等級決定
        this.firstChoice = null;    // 玩家的第一個選擇
    }

    // 開局四選一
    chooseFirstIndustry(key) {
        if (this.firstChoice) return false;  // 已選過
        this.firstChoice = key;
        this.industries[key] = { key, level:1, workers:[], dailyOutput:{} };
        return true;
    }

    // 城鎮升級時檢查是否可解鎖新產業
    checkTownLevelUp(world) {
        const pop = Object.keys(world.agents).length;
        const builds = world.buildings.completed.length;
        for (const [lv, req] of Object.entries(TOWN_LEVELS)) {
            if (Number(lv) > this.townLevel &&
                pop >= req.requirement.population &&
                builds >= req.requirement.buildings) {
                this.townLevel = Number(lv);
                this.maxIndustries = req.unlockSlots;
                world.logMessage('town', `🎉 城鎮升級為「${req.name}」！`);
                if (this.maxIndustries > Object.keys(this.industries).length) {
                    world.logMessage('town', `可以開啟新產業了！(${Object.keys(this.industries).length}/${this.maxIndustries})`);
                }
            }
        }
    }

    // 解鎖新產業（城鎮等級足夠時）
    unlockIndustry(key) {
        if (this.industries[key]) return false;  // 已有
        if (Object.keys(this.industries).length >= this.maxIndustries) return false;
        this.industries[key] = { key, level:1, workers:[], dailyOutput:{} };
        return true;
    }

    // 產業升級
    upgradeIndustry(key, world) {
        const ind = this.industries[key];
        if (!ind) return false;
        const def = INDUSTRIES[key];
        const nextLevel = def.levels.find(l => l.lv === ind.level + 1);
        if (!nextLevel) return false;  // 已滿級
        if (!world.stockpile.canAfford(nextLevel.cost)) return false;
        world.stockpile.pay(nextLevel.cost, world.tickCount, `${def.name}升級到 Lv${nextLevel.lv}`);
        ind.level = nextLevel.lv;
        world.logMessage('industry', `${def.name}升級到 Lv${nextLevel.lv}「${nextLevel.name}」！`);
        return true;
    }
}
```

### 0.3 遊戲開局流程

```
遊戲開始 → 劇情引導：
┌──────────────────────────────────────┐
│  歡迎來到邊境鎮！                      │
│  這片土地有豐富的自然資源。              │
│  你想從哪個產業開始發展？               │
│                                      │
│  🪓 [伐木業] 木材是一切建設的基礎       │
│  ⛏️ [採石業] 石材讓城鎮堅不可摧        │
│  🌾 [農業]   民以食為天                │
│  ⚒️ [礦業]   掌握金屬就掌握力量        │
│                                      │
│  💡 提示：城鎮發展後可以解鎖更多產業     │
└──────────────────────────────────────┘

選擇後：
- 獲得對應 Lv1 設施
- 對應 NPC 加入（例：選農業 → 劉俊自動好感+20）
- 初始資源偏向該產業

解鎖第二產業（城鎮 Lv3）：
- 彈出選擇面板，從剩餘 3 個中選 1 個
- 需支付建設費用（Lv1 cost）

解鎖第三產業（城鎮 Lv5）→ 第四產業（城鎮 Lv7）
```

### 0.4 產業升級路線圖

```
=== 🪓 伐木業 升級路線 ===
Lv1 伐木小屋    → 每日 15 木材，1 工人
Lv2 伐木場      → 每日 25 木材，2 工人，解鎖硬木
Lv3 製材所      → 每日 40 木材 + 8 木板，3 工人（開始加工！）
Lv4 林業公司    → 每日 60 木材 + 15 木板 + 5 硬木，4 工人
Lv5 木材帝國    → 每日 80 木材 + 25 木板 + 12 硬木，5 工人，可出口

=== ⛏️ 採石業 升級路線 ===
Lv1 採石小坑    → 每日 12 石頭，1 工人
Lv2 採石場      → 每日 20 石頭，2 工人，解鎖花崗岩
Lv3 石材工坊    → 每日 35 石頭 + 6 磚塊，3 工人（開始加工！）
Lv4 大型礦場    → 每日 50 石頭 + 12 磚塊 + 3 大理石，4 工人
Lv5 石材帝國    → 每日 70 石頭 + 20 磚塊 + 8 大理石，5 工人，可出口

=== 🌾 農業 升級路線 ===
Lv1 小農田      → 每日 15 食物，1 工人，4 格農田
Lv2 農莊        → 每日 25 食物，2 工人，8 格，解鎖更多作物
Lv3 灌溉農場    → 每日 40 食物，3 工人，12 格，灌溉 +30%
Lv4 大型農莊    → 每日 60 食物，4 工人，16 格，解鎖高級作物
Lv5 農業帝國    → 每日 80 食物，5 工人，20 格，出口 + 品種改良

=== ⚒️ 礦業 升級路線 ===
Lv1 小礦坑      → 每日 8 金屬，1 工人
Lv2 礦場        → 每日 15 金屬，2 工人，解鎖銅礦
Lv3 冶煉廠      → 每日 25 金屬 + 4 鋼，3 工人（開始冶煉！）
Lv4 大型礦業    → 每日 40 金屬 + 10 鋼 + 2 金，4 工人
Lv5 礦業帝國    → 每日 60 金屬 + 18 鋼 + 5 金，5 工人，可出口
```

### 0.5 產業之間的協同效果

```
組合加成（擁有多個產業時觸發）：

🪓 + 🌾 伐木+農業 = 「農林複合」→ 農田灌溉用木管，農產 +15%
🪓 + ⛏️ 伐木+採石 = 「營建雙雄」→ 建築速度 +25%
🪓 + ⚒️ 伐木+礦業 = 「工業基礎」→ 工具產量 +20%
⛏️ + ⚒️ 採石+礦業 = 「地下霸主」→ 採集效率 +20%
⛏️ + 🌾 採石+農業 = 「基建農業」→ 穀倉容量 +30%
🌾 + ⚒️ 農業+礦業 = 「自給自足」→ 食物消耗 -15%

三產業以上：
🪓+⛏️+⚒️     = 「工業強鎮」→ 全建築成本 -20%
🪓+⛏️+🌾     = 「資源大鎮」→ 商人來訪頻率 +50%
🌾+⚒️+🪓     = 「均衡發展」→ 全鎮幸福度 +10
四大全開       = 「完全體」→ 所有加成 + 特殊成就
```

---

## 一、農場種植系統 (FarmSystem)

### 設計理念：開羅遊戲風格的經濟鏈

```
種植 → 收穫原料 → 選擇出路：
  ├── 直接賣給商人（低價，快速）
  ├── 送進工廠加工 → 賣成品（高價，需時間 + 設備）
  └── 自用（食物、布料等進入 stockpile）
```

### 1.1 作物定義（受農業等級限制）

> 農業 Lv1 只能種基礎作物，升級後解鎖更多（受農業等級限制）

```javascript
const CROPS = {
    // === Lv1 基礎作物（小農田即可種）===
    wheat:    { name:'小麥',   icon:'🌾', seasons:['春季','秋季'], growDays:8,  yield:15, sellPrice:2,  category:'grain',    reqLevel:1 },
    potato:   { name:'馬鈴薯', icon:'🥔', seasons:['春季','秋季'], growDays:7,  yield:20, sellPrice:1,  category:'vegetable',reqLevel:1 },

    // === Lv2 解鎖（農莊）===
    rice:     { name:'稻米',   icon:'🌾', seasons:['夏季'],       growDays:12, yield:20, sellPrice:3,  category:'grain',    reqLevel:2 },
    corn:     { name:'玉米',   icon:'🌽', seasons:['夏季','秋季'], growDays:10, yield:18, sellPrice:2,  category:'grain',    reqLevel:2 },
    cotton:   { name:'棉花',   icon:'🌸', seasons:['夏季','秋季'], growDays:10, yield:10, sellPrice:4,  category:'fiber',    reqLevel:2 },
    flowers:  { name:'花卉',   icon:'🌺', seasons:['春季','夏季'], growDays:5,  yield:12, sellPrice:3,  category:'flower',   reqLevel:2 },

    // === Lv3 解鎖（灌溉農場）===
    herbs:    { name:'草藥',   icon:'🌿', seasons:['春季','夏季'], growDays:6,  yield:8,  sellPrice:5,  category:'herb',     reqLevel:3 },
    mushroom: { name:'蘑菇',   icon:'🍄', seasons:['秋季','冬季'], growDays:4,  yield:10, sellPrice:4,  category:'vegetable',reqLevel:3 },
    sugarcane:{ name:'甘蔗',   icon:'🎋', seasons:['夏季'],       growDays:12, yield:14, sellPrice:3,  category:'sugar',    reqLevel:3 },

    // === Lv4 解鎖（大型農莊）— 高級經濟作物 ===
    tea:      { name:'茶葉',   icon:'🍵', seasons:['春季'],       growDays:10, yield:6,  sellPrice:8,  category:'luxury',   reqLevel:4 },
    grapes:   { name:'葡萄',   icon:'🍇', seasons:['秋季'],       growDays:14, yield:8,  sellPrice:6,  category:'fruit',    reqLevel:4 },

    // === Lv5 解鎖（農業帝國）— 傳說作物 ===
    golden_wheat:{ name:'金色小麥', icon:'✨', seasons:['秋季'],   growDays:15, yield:10, sellPrice:15, category:'legendary', reqLevel:5 },
    dragon_fruit:{ name:'火龍果',   icon:'🐉', seasons:['夏季'],   growDays:12, yield:6,  sellPrice:20, category:'legendary', reqLevel:5 },
};
```

### 1.2 農田系統

```javascript
class FarmSystem {
    constructor() {
        this.plots = [];           // 農田格子（初始 4 格，最多 16 格）
        this.maxPlots = 4;         // 當前上限
        this.harvestLog = [];      // 收穫歷史
        this.totalHarvested = {};  // 累計收穫量（用於成就）
    }
}

// 農田格子狀態
const PlotState = {
    EMPTY: 'empty',           // 空地
    TILLED: 'tilled',         // 已翻土（可播種）
    PLANTED: 'planted',       // 已播種
    GROWING: 'growing',       // 生長中（顯示進度條）
    READY: 'ready',           // 可收穫（閃爍提示）
    WITHERED: 'withered',     // 枯萎（超過 3 天未收穫或季節不對）
};

// 每個農田格子
const plot = {
    id: 0,
    state: 'empty',
    crop: null,              // CROPS key
    plantedDay: 0,           // 播種日
    growthProgress: 0,       // 0-100%
    quality: 'normal',       // normal / good / excellent
    waterLevel: 100,         // 灌溉度（影響生長速度）
    fertilized: false,       // 是否施肥
};
```

### 1.3 農場玩法流程

```
玩家操作流程：
1. [翻土] 選空地 → 翻土（消耗 1 天）
2. [播種] 選作物 → 播種（需當季、消耗種子費 = sellPrice × 2 銀幣）
3. [等待] 每天自動生長，可施肥/澆水加速
4. [收穫] 作物成熟 → 點擊收穫 → 獲得原料
5. [處理] 原料可以：
   ├── 放入 stockpile 自用
   ├── 直接賣給商人
   └── 送進工廠加工
```

### 1.4 品質系統

```
品質等級：
- 普通 (normal)  → 基礎產量，1x 售價
- 優良 (good)    → +30% 產量，1.5x 售價 — 條件：施肥 + 灌溉充足
- 極品 (excellent)→ +60% 產量，2.5x 售價 — 條件：NPC 農夫幫手 + 輪作 + 施肥

影響品質的因素：
- 灌溉度 > 80%          → +1 品質
- 施肥                   → +1 品質
- NPC 農夫好感 > 40 幫忙  → +1 品質
- 輪作（上一季不同作物）   → +1 品質
- 暴風雨事件              → -1 品質
- 冬季種非冬季作物         → 直接枯萎
```

### 1.5 NPC 農夫互動

```
劉俊（農夫）好感度效果：
- 好感 20+：告訴你哪些作物當季最賺錢
- 好感 40+：自動幫你照顧農田（每天 +10% 生長，+1 品質）
- 好感 60+：教你輪作技巧（解鎖輪作加成）
- 好感 80+：送你稀有種子（解鎖茶葉、葡萄等進階作物）
```

---

## 二、工廠加工系統 (ProcessingSystem)

### 設計理念：開羅遊戲的核心——加工鏈

玩家可以**購買/建造工廠**，將原料加工成高價成品。
工廠需要 NPC 員工來運作，創造就業機會。

### 2.1 工廠定義

```javascript
const FACTORIES = {
    // === 第一批（農場解鎖後可建）===
    bakery: {
        name: '麵包坊', icon: '🍞',
        cost: { wood:20, stone:15, silver:80 },
        buildDays: 5,
        recipes: [
            { input:{wheat:5},           output:{bread:8},     time:1, outputPrice:4  },  // 小麥→麵包
            { input:{wheat:3, sugar:2},   output:{pastry:4},    time:2, outputPrice:8  },  // 小麥+糖→糕點
        ],
        workerSlots: 1,    // 需要 1 個 NPC 員工
        preferredJob: 'cook',
    },
    textile_mill: {
        name: '紡織廠', icon: '🧵',
        cost: { wood:25, metal:10, silver:100 },
        buildDays: 7,
        recipes: [
            { input:{cotton:6},           output:{cloth:10},    time:1, outputPrice:5  },  // 棉花→布料
            { input:{cloth:4},            output:{clothing:3},  time:2, outputPrice:12 },  // 布料→衣服
        ],
        workerSlots: 2,
        preferredJob: 'tailor',
    },
    brewery: {
        name: '釀酒廠', icon: '🍺',
        cost: { wood:15, metal:5, silver:60 },
        buildDays: 4,
        recipes: [
            { input:{wheat:4},            output:{beer:6},      time:2, outputPrice:5  },  // 小麥→啤酒
            { input:{grapes:6},           output:{wine:3},      time:4, outputPrice:15 },  // 葡萄→葡萄酒
        ],
        workerSlots: 1,
        preferredJob: 'cook',
    },

    // === 第二批（需研究解鎖）===
    herbal_workshop: {
        name: '草藥工坊', icon: '⚗️',
        cost: { wood:15, stone:10, silver:70 },
        buildDays: 5,
        recipes: [
            { input:{herbs:4},            output:{medicine:3},  time:2, outputPrice:14 },  // 草藥→藥品
            { input:{herbs:2, flowers:3}, output:{perfume:2},   time:3, outputPrice:20 },  // 草藥+花→香水
        ],
        workerSlots: 1,
        preferredJob: 'doctor',
    },
    tea_house: {
        name: '茶坊', icon: '🍵',
        cost: { wood:20, silver:120 },
        buildDays: 6,
        recipes: [
            { input:{tea:4},              output:{fine_tea:3},  time:2, outputPrice:18 },  // 茶葉→精製茶
            { input:{tea:2, herbs:2},     output:{herbal_tea:4},time:1, outputPrice:10 },  // 茶+草藥→養生茶
        ],
        workerSlots: 1,
        preferredJob: 'trader',
    },
    sugar_refinery: {
        name: '製糖廠', icon: '🍬',
        cost: { wood:15, metal:8, silver:90 },
        buildDays: 5,
        recipes: [
            { input:{sugarcane:6},        output:{sugar:8},     time:1, outputPrice:5  },  // 甘蔗→糖
            { input:{sugar:3, fruit:4},   output:{jam:4},       time:2, outputPrice:10 },  // 糖+水果→果醬
        ],
        workerSlots: 1,
        preferredJob: 'cook',
    },

    // === 進階工廠（需多項前置）===
    furniture_workshop: {
        name: '家具工坊', icon: '🪑',
        cost: { wood:30, metal:10, tools:5, silver:150 },
        buildDays: 8,
        recipes: [
            { input:{wood:8},             output:{furniture:4}, time:2, outputPrice:10 },
            { input:{wood:5, cloth:3},    output:{luxury_furniture:2}, time:3, outputPrice:25 },
        ],
        workerSlots: 2,
        preferredJob: 'carpenter',
    },
};
```

### 2.2 加工鏈示例（開羅風格）

```
🌾 小麥(2銀) → 🍞 麵包坊 → 麵包(4銀)        利潤 +100%
🌾 小麥(2銀) + 🍬 糖(5銀) → 🥐 糕點(8銀)     利潤 +14%（但糕點可當高級餐食）
🌾 小麥(2銀) → 🍺 釀酒廠 → 啤酒(5銀)         利潤 +150%
🍇 葡萄(6銀) → 🍺 釀酒廠 → 葡萄酒(15銀)      利潤 +150%
🌸 棉花(4銀) → 🧵 紡織廠 → 布料(5銀) → 衣服(12銀)  多段加工利潤更高
🍵 茶葉(8銀) → 🍵 茶坊   → 精製茶(18銀)      利潤 +125%
🌿 草藥(5銀) + 🌺 花(3銀) → ⚗️ 香水(20銀)    利潤 +150%
```

### 2.3 工廠運作機制

```
工廠需要：
1. 建造完成（消耗資源 + 天數）
2. 分配 NPC 員工（拖曳或自動分配）
3. 設定生產配方（選擇要做什麼）
4. 原料充足時自動生產
5. 成品進入「工廠倉庫」→ 玩家決定賣掉或自用

員工效率：
- 對應職業的 NPC → 100% 效率
- 其他 NPC → 60% 效率
- NPC 心情好 → +20% 效率
- NPC 技能高 → 加工出「優質」成品（售價 1.5x）

工廠升級（未來版本）：
- Lv1：基礎產能
- Lv2：+50% 產能，解鎖新配方
- Lv3：+100% 產能，可出口到其他城鎮
```

### 2.4 市場/販賣系統

```
賣東西的管道：
1. 【商人來訪】等商人來 → 賣給商人（價格浮動）
2. 【市集擺攤】建了市集後 → 自動每天賣掉部分成品（穩定但量少）
3. 【訂單系統】（新增）特殊訂單隨機出現：
   - "鄰鎮急需 20 個麵包，願出 2 倍價格！"
   - "貴族商隊收購精製茶，每個 25 銀！"
   - 限時訂單 → 完成有額外獎勵

自動販賣（建了市集後）：
- 市集每天自動賣掉「工廠倉庫」中的成品
- 售價 = 基礎價 × (0.8~1.2 隨機) × 市集等級加成
- 商人 NPC（趙霞/蕭瑜）好感高 → 售價 +10~20%
```

---

## 三、AI 日報系統 (DailyNewsEngine)

> **注意：完整保留現有 NewsSystem（模板新聞），DailyNewsEngine 是額外的獨立系統**

### 3.1 核心概念

每天遊戲結束時，由一個隨機 NPC「記者」用 LLM 生成一篇充滿個人風格的日報。
這不是取代 NewsSystem 的模板新聞，而是一個**沉浸式的每日故事**。

### 3.2 素材收集系統

在各個現有系統的關鍵事件點，自動收集日報素材：

```javascript
// 收集點（嵌入現有系統，不改動邏輯，只加 collectEvent 調用）

// simulation.js - World.tick() 中
// 對話系統
conversationEngine.onConversationEnd → collectEvent('social', '陳偉和劉俊在廣場聊了很久', 3, ['陳偉','劉俊'])

// 經濟系統
processDailyProduction → collectEvent('economy', '今日糧食產量比平時多了30%', 4)

// 事件系統
EventSystem.triggerEvent → collectEvent('event', '暴風雨來襲！農田受損', 8)

// 關係系統
_processRelationships（交往）→ collectEvent('relationship', '劉俊和許瑩開始交往了', 9, ['劉俊','許瑩'])
_processRelationships（結婚）→ collectEvent('relationship', '舉辦了盛大婚禮', 10)

// 選舉系統
ElectionSystem → collectEvent('politics', '楊鋒當選新任鎮長', 9)

// 建築系統
BuildingManager → collectEvent('building', '城牆建設完工', 7)

// 農場系統（新）
FarmSystem.harvest → collectEvent('farm', '秋季大豐收！收穫了30單位小麥', 5)

// 工廠系統（新）
ProcessingSystem → collectEvent('factory', '麵包坊今日產出24個麵包', 4)

// 探索系統
ExplorationSystem → collectEvent('exploration', '探險隊在洞穴中發現了古代遺跡', 8)

// 生命週期
LifecycleSystem → collectEvent('lifecycle', '小鎮迎來了新生兒！', 9)
```

### 3.3 日報生成

```javascript
class DailyNewsEngine {
    constructor() {
        this.newspapers = [];       // 歷史報紙（全部保存！）
        this.todayEvents = [];      // 今日素材
        this._lastPublishDay = 0;
        this._enabled = true;       // 可關閉（省 API 額度）
    }

    collectEvent(category, content, importance, agents = []) {
        this.todayEvents.push({
            category, content, importance, agents,
            time: world.clock.shortTime
        });
    }

    async generateNewspaper(world) {
        if (!this._enabled || this.todayEvents.length === 0) return null;

        // 按重要性排序，取前 5 件
        const events = this.todayEvents
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 5);

        // 選 NPC 記者（偏好商人、牧師等社交型）
        const candidates = Object.values(world.agents).filter(a => !a.isPlayer);
        const reporter = pickRandom(candidates);

        const prompt = buildNewsPrompt(reporter, events, world);
        const content = await llm.generate(prompt, 600);

        const newspaper = {
            id: this.newspapers.length + 1,
            day: world.clock.day,
            season: world.clock.season,
            year: world.clock.year,
            reporter: reporter.name,
            reporterId: reporter.agentId,
            reporterJob: reporter.job?.title || '居民',
            content: content,
            events: events,
            publishedAt: world.tickCount,
        };

        this.newspapers.push(newspaper);
        this.todayEvents = [];  // 清空今日素材
        return newspaper;
    }

    // 序列化（保存所有報紙）
    toDict() {
        return {
            newspapers: this.newspapers,
            enabled: this._enabled,
            totalPublished: this.newspapers.length,
        };
    }
}
```

### 3.4 UI 設計

在 sidebar 新增「📰 日報」tab：

```
┌──────────────────────────────────────┐
│  📰 邊境鎮日報  第1年 秋季 第12天     │
│  記者：趙霞（商人）                    │
│──────────────────────────────────────│
│                                      │
│  [LLM 生成的日報內容]                 │
│  包含頭條、2-3則新聞、記者碎碎念       │
│                                      │
│──────────────────────────────────────│
│  ← 上一期    第 23 期    下一期 →     │
│                                      │
│  📚 歷史日報 (共 23 期)               │
│  ┌────────────────────────────┐      │
│  │ #23 秋季第12天 - 趙霞      │      │
│  │ #22 秋季第11天 - 劉俊      │      │
│  │ #21 秋季第10天 - 楊鋒      │      │
│  │ ...                        │      │
│  └────────────────────────────┘      │
└──────────────────────────────────────┘
```

---

## 四、與現有系統的整合方式

### 4.1 不動的部分

| 系統 | 改動 |
|------|------|
| NewsSystem | ❌ 完全不動，保留模板新聞 |
| ConversationEngine | ❌ 不動核心邏輯 |
| EventSystem | ❌ 不動核心邏輯 |
| ElectionSystem | ❌ 不動 |
| Stockpile | ❌ 不動 |
| 其他現有系統 | ❌ 不動核心邏輯 |

### 4.2 輕微修改的部分

```javascript
// simulation.js - World 類

// 1. constructor 中新增：
this.farm = new FarmSystem();
this.processing = new ProcessingSystem();
this.dailyNews = new DailyNewsEngine();

// 2. tick() 的 new_day 區塊中新增：
this.farm.dailyUpdate(this);
this.processing.dailyUpdate(this);
if (this.dailyNews._enabled) {
    await this.dailyNews.generateNewspaper(this);
}

// 3. getState() 中新增：
farm: this.farm.toDict(),
processing: this.processing.toDict(),
dailyNews: this.dailyNews.toDict(),

// 4. reset() 中新增：
this.farm = new FarmSystem();
this.processing = new ProcessingSystem();
this.dailyNews = new DailyNewsEngine();

// 5. 各系統關鍵事件點加入 collectEvent（非侵入式）
// 例：_processRelationships 中婚禮後加一行：
this.dailyNews.collectEvent('relationship', `${agent.name}和${other.name}結婚了！`, 10, [agent.name, other.name]);
```

### 4.3 新增資源類型

```javascript
// 加入 Stockpile 的新資源（加工產品）
// 在 DEFAULT_STOCKPILE 中新增：
bread: 0, pastry: 0, beer: 0, wine: 0,
perfume: 0, fine_tea: 0, herbal_tea: 0,
sugar: 0, jam: 0, luxury_furniture: 0,

// 商人系統新增這些產品的買賣價格
// 在 BASE_PRICES 中新增對應價格
```

### 4.4 新增檔案

```
wordpress/
├── simulation.js     (現有，小幅擴充)
├── app.js            (現有，新增 sidebar tabs)
├── farm.js           (新) FarmSystem + 作物定義
├── processing.js     (新) ProcessingSystem + 工廠定義
└── daily-news.js     (新) DailyNewsEngine
```

---

## 五、實作優先順序

```
Phase A：四大產業 + 城鎮等級（核心骨架）
├── 1. IndustryManager 核心（四選一、城鎮升級、產業解鎖）
├── 2. 四大產業 Lv1-Lv5 升級系統
├── 3. 開局選擇 UI
├── 4. 產業管理 UI（sidebar tab）
└── 5. 產業協同加成

Phase B：農場深化 + 種植（農業產業的完整體驗）
├── 6. FarmSystem 核心（翻土、播種、生長、收穫）
├── 7. 農場 UI（sidebar tab + 農田格子）
├── 8. 作物等級解鎖（與農業 Lv 連動）
├── 9. 品質系統
└── 10. NPC 農夫互動（劉俊幫忙 + 多路徑任務）

Phase C：工廠加工（開羅核心）
├── 11. ProcessingSystem 核心（工廠建造、配方生產）
├── 12. 工廠 UI（管理面板）
├── 13. NPC 員工分配 + 效率系統
├── 14. 市集自動販賣 + 訂單系統
└── 15. 加工產品進入商人交易

Phase D：NPC 關係連鎖事件（利用 AI 特色）
├── 16. 住院/失蹤/打架事件系統
├── 17. 劈腿/離婚 → 城鎮影響連鎖
├── 18. 好友合作/仇人搞破壞
├── 19. NPC 調解任務（多路徑）
└── 20. 關係狀態影響產業效率

Phase E：AI 日報
├── 21. DailyNewsEngine 核心 + 素材收集
├── 22. 日報 UI（sidebar tab + 歷史瀏覽）
├── 23. 各系統嵌入 collectEvent
└── 24. 記者個性化 + 連續報導追蹤

Phase F：打磨
├── 25. tilemap 上顯示農田、工廠、產業設施
├── 26. 新成就系統（產業 + 關係相關）
└── 27. 平衡性調整
```

---

## 六、開羅遊戲參考要素

| 開羅特色 | RimTown 對應 |
|---------|-------------|
| 設施建造 | 工廠系統（建造 + 升級） |
| 原料→加工→成品 | 農場→工廠→成品販賣 |
| 員工分配 | NPC 分配到工廠崗位 |
| 訂單系統 | 隨機出現的特殊訂單 |
| 品質等級 | 作物品質 + 加工品質 |
| 設施升級 | 工廠 Lv1→Lv2→Lv3（未來版本） |
| 季節性需求 | 不同季節不同作物 + 需求波動 |
| 人氣/觀光 | 繁榮度系統（已在 v3 設計中） |

---

## 七、AI NPC 深度整合 — 充分利用核心特色

> **核心特色：AI NPC 對話獨立不重複、個性鮮明、可培養真實感情、每個任務多路徑解法**
> 以下設計確保新系統充分利用這些優勢，而非只是數字經營遊戲。

### 7.1 NPC 與產業的深度綁定

```
每個產業都有「代表 NPC」，好感度直接影響產業發展：

🪓 伐木業 — 代表：王大力（木匠）
   好感 10+：閒聊時透露哪片森林木材最好
   好感 30+：教你辨認木材品種（解鎖硬木採集捷徑）
   好感 50+：「有件事...我年輕時在北山發現過一棵千年古木...」→ 支線任務
   好感 70+：自願當伐木場主管（產量 +25%）
   好感 90+：「這把斧頭跟了我一輩子，現在交給你。」→ 傳說工具

⛏️ 採石業 — 代表：吳達（礦工）
   好感 30+：告訴你哪裡有好石頭
   好感 50+：「年輕時我在廢礦裡看到過會發光的石頭...」→ 大理石礦脈任務
   好感 70+：帶你去秘密礦脈（金礦或寶石）

🌾 農業 — 代表：劉俊（農夫）
   好感 30+：分享種植技巧（灌溉提示）
   好感 50+：「我爺爺留下一本種植手札...」→ 解鎖稀有作物
   好感 70+：自動幫你照顧農田

⚒️ 礦業 — 代表：鐵匠（新 NPC 或現有）
   好感 30+：打造的工具品質更高
   好感 50+：「傳說這座山下面有龍脈...」→ 深層採礦任務
```

### 7.2 多路徑解決方案 — 「出其不意」

每個產業任務都有**正規路線**和**NPC 社交路線**：

```
任務：「升級伐木場到 Lv3」
├── 正規路線：收集 120 銀 + 40 石頭 + 10 金屬 → 直接花錢建
├── 社交路線 A：跟吳達（礦工）關係好 → 他免費提供石頭
├── 社交路線 B：跟趙霞（商人）關係好 → 她幫你找到打折的建材
├── 出其不意路線：跟多個 NPC 聊天時提到你缺建材
│   → AI 會根據 NPC 性格做出獨特反應
│   → 劉俊可能說「我田邊有幾塊大石頭，你搬去用吧」
│   → 楊鋒可能說「上次趕走盜匪繳獲了一些物資，分你一些」
│   → 林美可能說「我認識山那邊的石匠，要不我幫你介紹？」
└── 完全意外路線：如果你正好跟某個 NPC 約會/結婚
    → 伴侶 NPC 主動幫你解決（「這是我們的家，我當然要幫忙！」）

關鍵：LLM 對話中注入任務狀態 →
prompt: "你知道玩家正在收集建材升級伐木場，但還差 30 石頭。
         根據你的性格和跟玩家的關係，自然地在對話中回應。
         如果你願意幫忙，用你自己的方式表達。"
```

### 7.3 NPC 對工廠/農場的「情感反應」

```javascript
// NPC 看到新工廠建成時的反應（根據個性不同）
const factoryReactions = {
    // 勤勞型：興奮
    hardworking: '太好了！新的{factory}建好了！我可以幫忙嗎？',
    // 悲觀型：擔憂
    pessimist: '{factory}建好了啊...希望不會出什麼問題...',
    // 貪婪型：算計
    greedy: '{factory}...嘿嘿，這下可以賺大錢了。',
    // 善良型：關心
    kind: '有了{factory}，大家的生活會更好吧！',
    // 浪漫型：感性
    romantic: '看著小鎮一天天成長，真是感動...',
};

// 但實際上不用模板！用 LLM：
// prompt 注入：「小鎮剛建好了一座麵包坊。以你的性格，你會怎麼看待這件事？」
// → 每次回應都不同，真正的 AI 個性化反應
```

### 7.4 「感情培養」→ 解鎖獨特經濟路線

```
與 NPC 關係深度影響經濟系統：

【約會中的 NPC】
→ 約會對象是農夫？→ 農場產量 +15%
→ 約會對象是商人？→ 所有交易價格 -10%
→ 約會時 NPC 會送你「小禮物」（稀有資源）

【結婚後的 NPC】
→ 配偶自動幫忙管理一個產業（免費主管）
→ 配偶的技能加成到對應產業
→ 特殊對話：「老公/老婆，今天收成不錯喔！」「要不要一起去看看農田？」
→ 吵架時產量下降（真實感！）

【親密好友（非戀愛）】
→ 好友 NPC 會主動分享情報（哪些商品漲價了、哪裡有資源）
→ 在對話中自然提供幫助（不是系統給的，是 AI 生成的）
→ 「欸，我聽說南邊來了個大商隊，你要不要去看看？」
```

### 7.5 日報與 NPC 感情的結合

```
AI 日報中，記者 NPC 會：
- 八卦你和某個 NPC 的關係進展
  「今天又看到鎮長和許瑩在河邊散步了...什麼時候請我們吃喜糖啊？」
- 評論你的經營決策
  「新建的麵包坊生意火爆！不過我覺得應該再開一家茶坊...」
- 帶有個人偏見
  趙霞（商人）當記者：更關注經濟新聞
  楊鋒（守衛）當記者：更關注安全問題
  林美（醫生）當記者：更關注居民健康
- 記住之前寫過的內容
  「上週我報導了劉俊和許瑩約會的消息，今天聽說他們吵架了...」

→ 日報不只是新聞，是 NPC 視角的「感情記錄」
→ 玩家每天回來看日報，就像看朋友圈一樣有情感連結
```

### 7.6 NPC 人際關係 → 城鎮事件連鎖系統

NPC 之間的關係不只是數字，會**真正影響城鎮運作和觸發真實事件**：

```javascript
const RELATIONSHIP_EVENTS = {
    // === 衝突類 ===
    fight_hospitalized: {
        trigger: (a, b) => a.getRelation(b).affinity < -30 && a.personality.traits.includes('abrasive'),
        event: '打架住院',
        effects: (world, a, b) => {
            // 被打的人住院 3 天，無法工作
            b.status = 'hospitalized';
            b.hospitalDays = 3;
            b.mood -= 30;
            // 如果 b 是工廠員工 → 工廠停產
            world.processing.removeWorker(b.agentId);
            // 全鎮反應
            world.logMessage('incident', `${a.name}和${b.name}大打出手！${b.name}被送進診所！`);
            // 其他 NPC 對打人者好感下降
            Object.values(world.agents).forEach(npc => {
                if (npc.agentId !== a.agentId && npc.agentId !== b.agentId) {
                    npc.getRelation(a).modifyAffinity(-5);  // 大家不喜歡暴力
                    if (npc.personality.traits.includes('kind')) npc.getRelation(a).modifyAffinity(-10);
                }
            });
            // 日報素材
            world.dailyNews.collectEvent('incident', `${a.name}把${b.name}打進了診所！原因不明...`, 9, [a.name, b.name]);
        },
    },

    missing_person: {
        trigger: (a) => a.mood < -50 && a.getRelation('all').averageAffinity < 10,
        event: 'NPC 失蹤',
        effects: (world, a) => {
            // 極度不開心的 NPC 可能離開
            a.status = 'missing';
            a.missingDays = 0;
            // 如果 ta 有職務 → 該崗位空缺
            world.logMessage('incident', `${a.name}不見了！有人昨晚看到他往山裡走去...`);
            // 搜救任務自動觸發
            world.activeTasks.push({
                type: 'rescue', target: a.name,
                description: `${a.name}失蹤了！去找找看吧。`,
                routes: [
                    { id:'search', label:'自己去找', conditions:[{type:'explore', zone:'mountain'}] },
                    { id:'ask_friends', label:'問 ta 的朋友', conditions:[{type:'talk', npc:a.bestFriend}] },
                    { id:'guard_help', label:'請守衛幫忙', conditions:[{type:'relationship', npc:'yang_feng', minAffinity:30}] },
                ],
            });
            world.dailyNews.collectEvent('incident', `${a.name}失蹤了！全鎮居民都很擔心。`, 10, [a.name]);
        },
    },

    cheating_discovered_fight: {
        trigger: (a, b, c) => a.isCheatingWith(c) && b.discoveredCheating,
        event: '劈腿被抓 → 全鎮大戲',
        effects: (world, cheater, partner, thirdParty) => {
            // 被戴綠帽的人爆發
            partner.mood -= 40;
            cheater.mood -= 20;

            // 可能打架
            if (partner.personality.traits.includes('abrasive') || Math.random() < 0.3) {
                cheater.status = 'hospitalized';
                cheater.hospitalDays = 2;
                world.logMessage('drama', `${partner.name}發現${cheater.name}劈腿，當街痛打了${cheater.name}一頓！`);
            }

            // 全鎮八卦爆炸
            world.gossipNetwork.addGossip({
                content: `${cheater.name}劈腿被${partner.name}抓到了！對象是${thirdParty.name}！`,
                importance: 10,
                spreadSpeed: 3,  // 傳播極快
            });

            // 派系影響：NPC 會選邊站
            Object.values(world.agents).forEach(npc => {
                if (npc.agentId === cheater.agentId) return;
                const relToCheater = npc.getRelation(cheater);
                const relToPartner = npc.getRelation(partner);
                // 善良的 NPC 同情被劈腿的
                if (npc.personality.traits.includes('kind')) relToPartner.modifyAffinity(5);
                // 大家對劈腿者好感下降
                relToCheater.modifyAffinity(-8);
                relToCheater.modifyTrust(-15);
            });

            // 產業影響：如果當事人是重要員工
            // 例：農夫心碎 → 農場產量暴跌一週
            if (partner.job?.key === 'farmer') {
                world.farm.moodPenalty = { agentId:partner.agentId, days:7, penalty:-0.3 };
            }

            world.dailyNews.collectEvent('drama', `轟動全鎮！${cheater.name}的秘密關係被揭穿了！`, 10, [cheater.name, partner.name, thirdParty.name]);
        },
    },

    // === 正面事件 ===
    wedding_town_boost: {
        trigger: (a, b) => a.getRelation(b).status === 'married',
        event: '婚禮全鎮加成',
        effects: (world, a, b) => {
            // 婚禮那天全鎮放假
            Object.values(world.agents).forEach(npc => {
                npc.mood = Math.min(100, npc.mood + 15);
            });
            // 婚禮消費帶動經濟
            world.stockpile.consume('food', 30, world.tickCount, '婚禮宴席');
            world.stockpile.consume('silver', 20, world.tickCount, '婚禮費用');
            // 但產量當天為零（大家都去喝喜酒了）
            world.skipProductionToday = true;
            // 婚後一週「蜜月效果」：新婚夫妻工作效率 +30%
            a.buffs.push({ type:'honeymoon', days:7, effect:{ productivity:1.3 } });
            b.buffs.push({ type:'honeymoon', days:7, effect:{ productivity:1.3 } });
        },
    },

    best_friends_collab: {
        trigger: (a, b) => a.getRelation(b).affinity > 60 && a.getRelation(b).trust > 50,
        event: '好友合作加成',
        effects: (world, a, b) => {
            // 如果兩個好友在同一個工廠工作 → 產量 +20%
            // 如果一個農夫一個廚師 → 食物加工效率 +15%
            world.logMessage('social', `${a.name}和${b.name}配合得越來越默契了！`);
        },
    },

    rivalry_sabotage: {
        trigger: (a, b) => a.getRelation(b).affinity < -20 && a.personality.traits.includes('neurotic'),
        event: '競爭對手搞破壞',
        effects: (world, a, b) => {
            // 仇人可能搞破壞
            if (b.job?.key === 'farmer' && Math.random() < 0.15) {
                // 偷偷破壞農田
                const plots = world.farm.plots.filter(p => p.state === 'growing');
                if (plots.length > 0) {
                    const target = pickRandom(plots);
                    target.state = 'withered';
                    world.logMessage('incident', `有人的農田被人破壞了！好像是深夜發生的事...`);
                    world.dailyNews.collectEvent('incident', `農田遭到不明破壞，村民們人心惶惶。`, 7);
                }
            }
        },
    },
};
```

### 7.7 「住院/失蹤/衝突」對城鎮的實際影響

```
NPC 狀態異常對城鎮的連鎖反應：

【住院 (hospitalized)】
├── 該 NPC 無法工作 → 對應產業/工廠產量下降
├── 醫生 NPC 需要照顧 → 醫療資源消耗（medicine -2/天）
├── 如果沒有醫生或藥品 → 住院天數延長
├── 好友 NPC 心情下降（擔心）
├── 如果住院者是鎮長 → 鎮務停擺
└── 玩家可以去探病 → 好感度大增

【失蹤 (missing)】
├── 該 NPC 的崗位空缺 → 產業缺人
├── 家人/伴侶心情崩潰
├── 守衛 NPC 組織搜索（如果好感夠）
├── 3 天未找到 → 可能永久離開（需搜救任務）
├── 找到後 → 感人劇情（NPC 用 AI 說出離開的原因）
└── 日報連續追蹤報導

【NPC 之間吵架 (conflict)】
├── 雙方好感度下降
├── 同一個工廠的兩人吵架 → 工廠效率 -20%
├── 派系可能分裂（各自的朋友選邊站）
├── 嚴重時升級為打架事件
├── 玩家可以調解 → 聲望提升
│   ├── 正面解決：兩人和好，對玩家好感+
│   └── 失敗：情況惡化
└── 日報八卦：「聽說張三和李四在市集大吵了一架...」
```

### 7.9 確保 AI 對話品質的設計

```javascript
// 對話 prompt 中注入的上下文（讓 NPC 知道經濟狀態）
function buildConversationContext(npc, world) {
    return {
        // 現有的：性格、記憶、關係
        ...existingContext,

        // 新增：產業/經濟相關
        town_industries: Object.keys(world.industry.industries).map(k => INDUSTRIES[k].name),
        town_level: world.industry.townLevel,
        recent_harvests: world.farm?.harvestLog.slice(-3),
        factory_products: world.processing?.recentOutput.slice(-3),

        // 新增：NPC 對經濟的看法（根據職業和性格）
        economic_opinion: npc.job?.key === 'farmer'
            ? '你很關心農場的收成狀況'
            : npc.job?.key === 'trader'
            ? '你關注市場價格和商機'
            : '你關心小鎮的整體發展',

        // 新增：NPC 可以主動提供幫助的事項
        can_help_with: getHelpableItems(npc, world),

        // 確保：「每個任務不止一條路徑可以解決」
        player_active_tasks: world.activeTasks?.map(t => ({
            task: t.description,
            hint: `如果玩家提到相關話題，你可以根據自己的能力和性格提供幫助或建議`
        })),
    };
}
```
