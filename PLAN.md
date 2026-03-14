# RimTown 玩家老化系統與人生階段 — 實作計畫

## 目標
為玩家角色加入老化機制與人生階段系統，讓一場遊戲約 2-3 小時，體驗從 20 歲旅人到 65 歲的完整人生。

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
