# RimTown 玩家老化系統與人生階段 — 實作計畫

## 目標
為玩家角色加入老化機制與人生階段系統，讓一場遊戲約 2-3 小時，體驗從 20 歲旅人到 65 歲的完整人生。
同時將 NPC 改為隨機生成（名字、個性、職業），僅保留一位鎮長為固定職業。

## 核心設定
- **起始年齡**: 20 歲（繼承遠房親戚遺產來到小鎮的旅人）
- **結束年齡**: 65 歲（觸發結算）
- **老化速率**: 每遊戲天 +1 歲（45 天 × 3.2 分 ≈ 2.4 小時）
- **主線**: 融入小鎮生活；職業/角色（含鎮長）皆為自由選擇的副線

---

## 人生階段定義

| 階段 | 年齡 | 特色 |
|------|------|------|
| 青年期 | 20-30 | 探索小鎮、結交鎮民、選職業、初戀 |
| 壯年期 | 31-45 | 結婚生子、建設城鎮、深耕職業、可參選鎮長 |
| 巔峰期 | 46-55 | 產業擴張、完成主線、聲望巔峰 |
| 晚年 | 56-65 | 回顧提示、傳承準備、告別事件、結算 |

---

## 實作步驟

### Step 0A: 100 條性格特徵系統
**檔案**: `wordpress/simulation.js` (TRAIT_POOL, ~line 178)

將現有 19 條特徵擴充至 100 條（約 50 正向 / 50 負向），每個村民隨機抓 7 條。

**保留現有 19 條**（被程式碼直接引用，不能改名）：
kind, abrasive, shy, charismatic, gossip, hardworking, lazy, perfectionist, creative, optimist, pessimist, neurotic, stoic, romantic, jealous, night_owl, early_bird, glutton, ascetic

**新增 81 條**，依類別分組：

#### 社交類（+12 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| empathetic | + | 共感 | social:2 | 能深刻感受他人情緒 |
| diplomatic | + | 圓滑 | social:2 | 善於化解衝突與協調 |
| generous | + | 慷慨 | social:1 | 樂於分享自己所有的一切 |
| loyal | + | 忠誠 | social:1 | 對朋友和承諾極為忠實 |
| hospitable | + | 好客 | social:2 | 熱情款待每一位訪客 |
| humorous | + | 幽默 | social:2 | 總能讓周圍的人開懷大笑 |
| cold | - | 冷漠 | social:-2 | 對他人的感受毫不在意 |
| manipulative | - | 操控 | social:-1 | 善於利用他人達到目的 |
| antisocial | - | 孤僻 | social:-3 | 極度排斥社交活動 |
| arrogant | - | 傲慢 | social:-2 | 認為自己比所有人都優秀 |
| sarcastic | - | 嘲諷 | social:-1 | 說話總帶著尖銳的諷刺 |
| clingy | - | 黏人 | social:1, romance:1 | 極度依賴他人的陪伴 |

#### 工作類（+12 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| resourceful | + | 足智多謀 | work:2 | 總能找到解決問題的方法 |
| methodical | + | 有條理 | work:1 | 做事井井有條 |
| ambitious | + | 野心勃勃 | work:2 | 渴望成就更大的事業 |
| disciplined | + | 自律 | work:2 | 嚴格遵守自己制定的規矩 |
| meticulous | + | 一絲不苟 | work:1 | 注重每一個細節 |
| efficient | + | 高效 | work:2 | 用最少的時間完成最多的事 |
| procrastinator | - | 拖延 | work:-2 | 總是把事情拖到最後一刻 |
| careless | - | 粗心 | work:-1 | 經常忽略重要的細節 |
| stubborn | - | 固執 | work:-1 | 一旦決定就不願改變 |
| distracted | - | 分心 | work:-1 | 很難長時間專注於一件事 |
| impatient | - | 急躁 | work:-1 | 缺乏等待的耐心 |
| reckless | - | 魯莽 | work:-2 | 不考慮後果就行動 |

#### 情緒類（+12 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| cheerful | + | 開朗 | mood_base:8 | 天生就帶著笑容 |
| resilient | + | 堅韌 | mood_sensitivity:0.5 | 能從任何打擊中恢復 |
| carefree | + | 無憂無慮 | mood_base:5 | 從不為小事煩惱 |
| serene | + | 平靜 | mood_sensitivity:0.6 | 內心始終保持寧靜 |
| grateful | + | 感恩 | mood_base:5 | 珍惜生活中的每一份美好 |
| enthusiastic | + | 熱情 | mood_base:5 | 對生活充滿激情與活力 |
| melancholic | - | 憂鬱 | mood_base:-8 | 心中總有一抹揮之不去的哀愁 |
| anxious | - | 焦慮 | mood_sensitivity:1.5 | 對未來充滿不安 |
| irritable | - | 易怒 | mood_sensitivity:1.8 | 一點小事就能引爆怒火 |
| moody | - | 喜怒無常 | mood_sensitivity:2.0 | 情緒變化毫無預兆 |
| bitter | - | 怨恨 | mood_base:-8 | 對過去的傷痛念念不忘 |
| dramatic | - | 戲劇化 | mood_sensitivity:1.5 | 把每件事都放大十倍 |

#### 戀愛類（+8 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| flirtatious | + | 風騷 | romance:3 | 天生的調情高手 |
| devoted | + | 專情 | romance:1 | 一旦愛上就全心全意 |
| affectionate | + | 深情 | romance:2 | 善於表達愛意 |
| charming | + | 迷人 | romance:2, social:1 | 舉手投足都散發魅力 |
| commitment_phobic | - | 恐婚 | romance:-2 | 害怕穩定的感情關係 |
| possessive | - | 佔有慾強 | romance:-1 | 把伴侶視為自己的所有物 |
| prudish | - | 保守 | romance:-2 | 對感情表達極為拘謹 |
| fickle | - | 花心 | romance:2 | 容易對新對象產生興趣 |

#### 生活習慣類（+12 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| athletic | + | 健壯 | comfort:1 | 體格強健，精力充沛 |
| adventurous | + | 愛冒險 | - | 渴望探索未知的領域 |
| neat | + | 愛整潔 | comfort:1 | 保持環境一塵不染 |
| tough | + | 堅強 | comfort:1 | 能忍受惡劣的環境 |
| energetic | + | 精力旺盛 | comfort:1 | 似乎永遠不知疲倦 |
| outdoorsy | + | 熱愛戶外 | - | 在大自然中如魚得水 |
| frail | - | 體弱 | comfort:-1 | 身體孱弱，容易生病 |
| homebody | - | 宅 | social:-1 | 能不出門就不出門 |
| messy | - | 邋遢 | comfort:-1 | 周圍總是一片混亂 |
| sleepyhead | - | 嗜睡 | schedule:'late' | 怎麼睡都睡不夠 |
| picky_eater | - | 挑食 | food:-0.5 | 對食物極為挑剔 |
| heavy_drinker | - | 好酒 | food:1.5 | 嗜酒如命 |

#### 性格/智識類（+14 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| curious | + | 好奇 | work:1 | 對一切都充滿求知慾 |
| observant | + | 敏銳 | - | 總能注意到別人忽略的細節 |
| analytical | + | 善分析 | work:1 | 擅長拆解複雜問題 |
| philosophical | + | 哲思 | - | 喜歡思考人生的意義 |
| witty | + | 機智 | social:1 | 反應敏捷，妙語如珠 |
| wise | + | 睿智 | - | 擁有超越年齡的智慧 |
| scholarly | + | 好學 | work:1 | 沉迷於書本和知識 |
| forgetful | - | 健忘 | work:-1 | 經常忘記重要的事情 |
| dreamy | - | 愛幻想 | work:-1 | 總是沉浸在自己的世界裡 |
| naive | - | 天真 | social:-1 | 容易被人欺騙 |
| cunning | - | 狡猾 | social:-1 | 心機深沉，難以信任 |
| superstitious | - | 迷信 | - | 對各種禁忌深信不疑 |
| scatterbrained | - | 迷糊 | work:-1 | 思緒混亂，丟三落四 |
| pedantic | - | 學究 | social:-1 | 過度執著於細枝末節 |

#### 道德/價值觀類（+11 條）
| Key | 正/負 | Label | 效果 | 描述 |
|-----|--------|-------|------|------|
| honorable | + | 正直 | social:1 | 堅守道德原則不動搖 |
| selfless | + | 無私 | social:2 | 總是把別人的需要放在自己前面 |
| just | + | 公正 | social:1 | 對每個人都一視同仁 |
| honest | + | 誠實 | social:1 | 從不說謊，即使真話傷人 |
| merciful | + | 仁慈 | social:1 | 對犯錯的人總是寬大處理 |
| pious | + | 虔誠 | - | 對信仰無比忠誠 |
| devious | - | 奸詐 | social:-2 | 為達目的不擇手段 |
| greedy | - | 貪婪 | social:-1 | 對財富有無窮的渴望 |
| deceitful | - | 虛偽 | social:-1 | 表面一套背後一套 |
| cruel | - | 殘忍 | social:-3 | 從他人的痛苦中獲得快感 |
| hedonistic | - | 享樂主義 | comfort:1, work:-1 | 只追求感官上的享受 |

**互斥對更新**（在現有基礎上擴充）：
```javascript
const INCOMPATIBLE = [
    ['optimist','pessimist'], ['hardworking','lazy'], ['shy','charismatic'],
    ['night_owl','early_bird'], ['kind','cruel'], ['honest','deceitful'],
    ['generous','greedy'], ['brave','cowardly'], ['neat','messy'],
    ['selfless','greedy'], ['cheerful','melancholic'], ['resilient','neurotic'],
    ['disciplined','procrastinator'], ['stoic','dramatic'], ['serene','anxious'],
    ['devoted','fickle'], ['athletic','frail'], ['energetic','sleepyhead'],
    ['methodical','scatterbrained'], ['observant','forgetful'],
    ['diplomatic','abrasive'], ['loyal','manipulative'], ['merciful','cruel'],
    ['honorable','devious'], ['empathetic','cold'], ['ambitious','lazy'],
    ['efficient','procrastinator'], ['carefree','anxious'],
    ['affectionate','prudish'], ['adventurous','homebody'],
];
```

**Personality.random() 更新**：
- 從 100 條中隨機抽取 **7 條**（取代現有的 3 條）
- 檢查互斥對，確保不會同時抽到矛盾的特徵

### Step 0B: NPC 隨機生成系統
**檔案**: `wordpress/simulation.js` (`_loadDefaultResidents` 方法, ~line 4347)

取代現有的 12 個寫死居民，改為隨機生成：

**名字池**（擴充現有 BABY_NAMES）：
```javascript
const NPC_SURNAMES = ['陳','林','張','王','劉','趙','楊','孫','吳','黃','馬','許','周','鄭','謝','郭','蔡','曾','李','何'];
const NPC_GIVEN_MALE = ['偉','豪','俊','達','強','鋒','明','浩','文','志','宇','軒','博','翰','傑','凱','瑞','國','承','建'];
const NPC_GIVEN_FEMALE = ['美','霞','雨','莉','瑩','琪','涵','欣','婷','雅','詩','萱','怡','芳','月','穎','蓉','慧','佳','敏'];
```

**隨機生成邏輯**：
1. 固定生成 **1 位鎮長**（隨機名字+個性，職業固定 mayor，年齡 35-55）
2. 隨機生成 **11 位居民**：
   - 名字：從姓+名池隨機組合，不重複
   - 性別：隨機（約各半）
   - 年齡：18-55 隨機
   - 個性：使用更新後的 `Personality.random(7)`（抽 7 條）
   - 職業：從 11 個非 mayor 職業中隨機分配（確保職業多樣性）
   - 住所：從 3 個住宅區隨機分配
3. 背景故事：根據職業+個性生成簡短模板背景

**職業分配規則**：
- 必填職業（各 1 人）：doctor, guard, farmer, cook, trader — 確保基本城鎮功能
- 剩餘 6 人從 miner, blacksmith, carpenter, tailor, priest, researcher 中隨機分配

### Step 1: 修改 PlayerAgent 起始設定
**檔案**: `wordpress/simulation.js` (PlayerAgent class, ~line 758)

- 起始年齡改為 20
- 背景故事改為「繼承遠房親戚遺產來到小鎮」
- 增加 `lifeStage` 屬性（'youth' | 'prime' | 'peak' | 'elder'）

```javascript
class PlayerAgent extends Agent {
    constructor(name = '旅人', age = 20) {
        super('player', name, age,
              new Personality(['creative','kind'], '繼承了遠房親戚的遺產，來到這個邊境小鎮重新開始。', ['冒險','友情']),
              null, 'residential_north');  // 繼承的房子
        this.isPlayer = true;
        this.chatHistory = [];
        this._recentChatTick = 0;
        this.lifeStage = 'youth';
    }
}
```

### Step 2: 加入玩家老化邏輯
**檔案**: `wordpress/simulation.js` (LifecycleSystem._processAging, ~line 3602)

現有 NPC 老化：每季第 1 天 +1 歲。
玩家老化：**每遊戲天 +1 歲**（獨立於 NPC 老化）。

```javascript
_processAging(world) {
    // 玩家老化：每天 +1 歲
    const player = world.agents['player'];
    if (player) {
        player.age += 1;
        this._updatePlayerLifeStage(player, world);
    }

    // NPC 老化：維持原有邏輯（每季第 1 天）
    if (world.clock.day !== 1) return;
    Object.values(world.agents).forEach(a => {
        if (!a.isPlayer) {
            a.age += 1;
            if (a.age >= 60) a.needs.rest = Math.max(0, a.needs.rest - 3);
            if (a.age >= 70) a.needs.comfort = Math.max(0, a.needs.comfort - 2);
        }
    });
}
```

### Step 3: 人生階段轉換與事件
**檔案**: `wordpress/simulation.js` (LifecycleSystem 新增方法)

新增 `_updatePlayerLifeStage(player, world)` 方法：

- **進入青年期 (20)**: 歡迎訊息，介紹小鎮
- **進入壯年期 (31)**: 提示可以考慮成家、深耕職業
- **進入巔峰期 (46)**: 提示聲望巔峰、可嘗試更大目標
- **進入晚年 (56)**: 回顧提示、開始出現體力下降效果
- **到達 65 歲**: 觸發人生結算

每次階段轉換時：
1. 更新 `player.lifeStage`
2. 記錄到 `world.log`
3. 產生新聞事件（透過 dailyNews）
4. 觸發特定的階段效果（如晚年體力下降）

### Step 4: 晚年效果
**檔案**: `wordpress/simulation.js`

玩家 56 歲後逐漸體力下降：
- 56-60 歲：rest 需求每天額外 -2
- 61-65 歲：rest 需求每天額外 -4，comfort -2

### Step 5: 人生結算系統
**檔案**: `wordpress/simulation.js` + `wordpress/app.js`

65 歲時觸發結算：
1. 收集統計數據（同現有 multi-ending 系統的統計方式）：
   - 在鎮天數、交友數、結婚對象、子女數
   - 職業經歷、擔任過鎮長否
   - 城鎮繁榮度、完成的任務
   - 建造的建築、開發的產業
2. 生成「人生回顧報告」
3. 顯示結算 UI（複用/擴充現有 multi-ending 的結算畫面）

### Step 6: 結算 UI
**檔案**: `wordpress/app.js`

在現有 multi-ending 結算畫面基礎上，新增/調整：
- 人生時間軸（關鍵里程碑）
- 各項統計數據展示
- 最終評價（基於成就、人際、城鎮發展等綜合評分）

### Step 7: 里程碑事件系統
**檔案**: `wordpress/simulation.js` (LifecycleSystem)

在特定年齡觸發里程碑提示（透過 world.log）：
- 25 歲：「你在小鎮已經小有名氣了」
- 30 歲：「三十而立，是時候考慮未來了」
- 40 歲：「不惑之年，你對這個小鎮的感情越來越深」
- 50 歲：「知天命，回首來時路...」
- 60 歲：「花甲之年，開始思考要留下什麼給這個小鎮」

### Step 8: 序列化支援
**檔案**: `wordpress/simulation.js`

確保 `player.lifeStage` 和新增的老化相關資料能正確序列化/反序列化，支援存檔讀檔。

### Step 9: Chrome Extension 同步
**檔案**: `chrome-extension/` 對應檔案

將所有修改同步到 Chrome Extension 版本（兩邊程式碼相同）。

---

## 不做的事
- 不修改 NPC 老化速率（維持每季 +1 歲）
- 不新增繼承/二周目系統（留待未來）
- 不修改遊戲時間系統本身（tick/day/season 不變）
- 不新增額外的 UI 標籤頁

## 風險與注意事項
- 玩家和 NPC 老化速率不同（玩家每天+1歲 vs NPC每季+1歲），需確保結婚/生子等系統能正常運作
- 結算觸發要和現有 multi-ending 系統相容，不衝突
- 存檔相容性：舊存檔載入時要能處理缺少 `lifeStage` 的情況
- NPC 隨機生成後，需確保選舉系統仍能正常找到鎮長
- 隨機名字不能重複，也不能和玩家名字衝突
- 特徵從 19→100 條，現有程式碼直接引用的 19 個 trait key 不能改名
- 7 條特徵需確保互斥檢查正常運作，避免矛盾組合
