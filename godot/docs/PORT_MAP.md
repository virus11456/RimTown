# 移植對照表

基準 commit: `47c44406ffe4ef705b5f8988a47e187e42a73602`。範圍為使用者確認的 Phase 0–3 觀賞版，模擬維持原始 JSON、不 tick。以下為全部前端 JS class（含外部子系統）。方法與檔案雜湊見 SOURCE_AUDIT.md。

| JS class | 職責 | 建構／World 依賴（摘要） | 存檔鍵 | Phase | 狀態 |
|---|---|---|---|---|---|
| [RimTownAuth](../../chrome-extension/app.js#L126) | 帳號HTTP | —; world: — | `rimtown_jwt（localStorage）` | 2 / 5 | 已盤點，尚未移植 |
| [RimTownApp](../../chrome-extension/app.js#L292) | 前端流程與UI | Blob, ChiptuneEngine, ConversationEngine, Event, LLMClient, PixelTileMap, RimTownApp, RimTownAuth, World; world: _feedUnread, _lastRumorDay, _legacyGeneration, _pendingComboNotifs, _pendingDramaScenes, _pendingHeartEvents, _pendingMilestones, _pendingWeeklyDigest, agents, buildings, checkCombos, checkHeartEvents, clock, conversationEngine | `城鎮索引 / 存檔 / IndexedDB 編年史` | 2 / 5 | 已盤點，尚未移植 |
| [ChiptuneEngine](../../chrome-extension/chiptune.js#L5) | 程序音樂 | —; world: — | `音量及靜音偏好` | 6 | 已盤點，尚未移植 |
| [CustomNPCSystem](../../chrome-extension/custom-npc.js#L49) | 自訂居民 | Agent, Job, Personality; world: addAgent, agents, clock, dailyNews, logMessage, stockpile, tickCount | `customNPC` | 4e | 已盤點，尚未移植 |
| [MultiEndingSystem](../../chrome-extension/custom-npc.js#L250) | 多重結局 | —; world: agents, buildings, clock, customNPC, dailyNews, industry, lifecycle, logMessage, npcQuests, prosperity, questSystem, stockpile | `multiEnding` | 4e | 已盤點，尚未移植 |
| [DailyNewsEngine](../../chrome-extension/daily-news.js#L6) | 每日報紙 | —; world: agents, clock, conversationEngine, election, gossipNetwork, industry, news, stockpile, tickCount | `dailyNews` | 4f | 已盤點，尚未移植 |
| [FarmSystem](../../chrome-extension/farm.js#L24) | 農田種植 | —; world: agents, clock, dailyNews, industry, logMessage, stockpile, tickCount | `farm` | 4c | 已盤點，尚未移植 |
| [IndustryManager](../../chrome-extension/industry.js#L82) | 產業與城鎮等級 | —; world: agents, buildings, dailyNews, logMessage, stockpile, tickCount | `industry` | 4c | 已盤點，尚未移植 |
| [NPCEventSystem](../../chrome-extension/npc-events.js#L5) | NPC衝突 | —; world: agents, clock, dailyNews, farm, gossipNetwork, logMessage, processing, removeAgent, stockpile, tickCount | `npcEvents` | 4d | 已盤點，尚未移植 |
| [NPCQuestSystem](../../chrome-extension/npc-quests.js#L703) | NPC個人任務 | —; world: agents, buildings, clock, dailyNews, industry, logMessage, questSystem, stockpile, tickCount | `npcQuests` | 4e | 已盤點，尚未移植 |
| [ProcessingSystem](../../chrome-extension/processing.js#L71) | 加工配方 | —; world: agents, buildings, clock, dailyNews, logMessage, stockpile, tickCount | `processing` | 4c | 已盤點，尚未移植 |
| [ProsperityEngine](../../chrome-extension/prosperity.js#L7) | 繁榮度 | —; world: agents, buildings, clock, decorations, events, farm, festivals, getActiveCombos, industry, lifecycle, processing, questSystem, stockpile | `prosperity` | 4c | 已盤點，尚未移植 |
| [QuestSystem](../../chrome-extension/quest-system.js#L734) | 主支線每日任務 | —; world: agents, buildings, clock, dailyNews, industry, logMessage, multiEnding, processing, stockpile, tickCount | `questSystem` | 4e | 已盤點，尚未移植 |
| [GameClock](../../chrome-extension/simulation.js#L6) | 時鐘與季節 | —; world: — | `clock` | 4a | 已盤點，尚未移植 |
| [Needs](../../chrome-extension/simulation.js#L58) | 六種需求與心情 | —; world: — | `agents.*.needs` | 4a | 已盤點，尚未移植 |
| [MemoryEntry](../../chrome-extension/simulation.js#L103) | 單則記憶 | —; world: — | `agents.*.memory[]` | 4b | 已盤點，尚未移植 |
| [Memory](../../chrome-extension/simulation.js#L114) | 記憶流與檢索 | MemoryEntry; world: — | `agents.*.memory` | 4b | 已盤點，尚未移植 |
| [Relationship](../../chrome-extension/simulation.js#L170) | 雙人關係 | —; world: — | `agents.*.relationships.*` | 4b | 已盤點，尚未移植 |
| [RelationshipManager](../../chrome-extension/simulation.js#L215) | 關係集合 | Relationship; world: — | `agents.*.relationships` | 4b | 已盤點，尚未移植 |
| [Personality](../../chrome-extension/simulation.js#L256) | 性格特質 | Personality; world: — | `agents.*.personality` | 4a | 已盤點，尚未移植 |
| [Skill](../../chrome-extension/simulation.js#L305) | 單項技能 | —; world: — | `agents.*.skills.*` | 4a | 已盤點，尚未移植 |
| [SkillSet](../../chrome-extension/simulation.js#L329) | 技能集合 | Skill, SkillSet; world: — | `agents.*.skills` | 4a | 已盤點，尚未移植 |
| [Job](../../chrome-extension/simulation.js#L402) | 職業 | —; world: — | `agents.*.jobKey` | 4a | 已盤點，尚未移植 |
| [Agent](../../chrome-extension/simulation.js#L438) | 村民需求作息 | Memory, Needs, RelationshipManager; world: agents, buildings, clock, conversationEngine, election, events, festivals, getAgentsAtLocation, gossipNetwork, logMessage, news, reputationSystem, stockpile, tickCount | `agents.*` | 4a | 已盤點，尚未移植 |
| [PlayerAgent](../../chrome-extension/simulation.js#L1210) | 玩家狀態 | Personality; world: clock, logMessage, tickCount, townMap | `agents.player` | 4a | 已盤點，尚未移植 |
| [TownFeedSystem](../../chrome-extension/simulation.js#L1272) | 鎮民動態 | —; world: _feedUnread, clock, tickCount | `townFeed` | 4b | 已盤點，尚未移植 |
| [GossipNetwork](../../chrome-extension/simulation.js#L1291) | 八卦傳播 | —; world: agents, clock, conversationEngine, dailyNews, logMessage, tickCount, townFeed | `gossip` | 4b | 已盤點，尚未移植 |
| [ConversationEngine](../../chrome-extension/simulation.js#L1441) | 對話、反思、行程 | RegExp; world: _pendingDramaScenes, _pendingHeartEvents, _pendingMilestones, agents, checkHeartEvents, clock, dailyNews, dramaArchive, election, events, farm, festivals, gossipNetwork, industry | `npcConversationLog / npcLlmUsedToday / agents.*.memory` | 4f | 已盤點，尚未移植 |
| [LLMClient](../../chrome-extension/simulation.js#L3367) | AI 網路通道 | —; world: — | `不存 AI 金鑰` | 4f | 已盤點，尚未移植 |
| [TownMap](../../chrome-extension/simulation.js#L3721) | 邏輯地點 | SeededRandom, TownMap; world: — | `townMap` | 3 / 4a | 已盤點，尚未移植 |
| [EventSystem](../../chrome-extension/simulation.js#L3857) | 隨機事件 | Agent, Job, Personality; world: agents, buildings, clock, dailyNews, logMessage, news, questSystem, reputationSystem, stockpile, tickCount, townIdentity | `events` | 4d | 已盤點，尚未移植 |
| [ElectionSystem](../../chrome-extension/simulation.js#L4155) | 選舉與政策 | Job; world: agents, clock, dailyNews, events, logMessage, news, prosperity, questSystem, reputationSystem, tickCount | `election` | 4d | 已盤點，尚未移植 |
| [Stockpile](../../chrome-extension/simulation.js#L4427) | 資源庫 | —; world: agents, buildings, clock, industry, logMessage, news, stockpile, tickCount, townMap, weather, workPolicy | `stockpile` | 4c | 已盤點，尚未移植 |
| [BuildingManager](../../chrome-extension/simulation.js#L4670) | 建築升級與效果 | —; world: agents, checkCombos, conversationEngine, dailyNews, logMessage, stockpile, tickCount | `buildings` | 4c | 已盤點，尚未移植 |
| [TradeManager](../../chrome-extension/simulation.js#L4776) | 商隊貿易 | —; world: buildings, logMessage, news, reputationSystem, stockpile, tickCount | `trade` | 4c | 已盤點，尚未移植 |
| [ResearchManager](../../chrome-extension/simulation.js#L4835) | 研究 | —; world: agents, buildings, logMessage, news, stockpile, tickCount | `research` | 4c | 已盤點，尚未移植 |
| [WorkOrderManager](../../chrome-extension/simulation.js#L4873) | 工單 | —; world: — | `workOrders` | 4c | 已盤點，尚未移植 |
| [NewsSystem](../../chrome-extension/simulation.js#L4962) | 規則新聞 | —; world: agents, clock, events, logMessage | `news` | 4d | 已盤點，尚未移植 |
| [Faction](../../chrome-extension/simulation.js#L5075) | 單一派系 | —; world: — | `factions.*` | 4b | 已盤點，尚未移植 |
| [FactionSystem](../../chrome-extension/simulation.js#L5098) | 派系互動 | Faction; world: agents, clock, events, gossipNetwork, logMessage, tickCount | `factions` | 4b | 已盤點，尚未移植 |
| [LifeGoalSystem](../../chrome-extension/simulation.js#L5453) | 人生目標 | —; world: agents, clock, conversationEngine | `lifeGoals` | 4e | 已盤點，尚未移植 |
| [TownIdentitySystem](../../chrome-extension/simulation.js#L5552) | 城鎮發展身分 | —; world: agents, clock, dailyNews, election, logMessage, research, stockpile | `townIdentity` | 4c | 已盤點，尚未移植 |
| [FestivalSystem](../../chrome-extension/simulation.js#L5615) | 節慶 | —; world: agents, clock, conversationEngine, events, gossipNetwork, logMessage, stockpile, tickCount | `festivals` | 4d | 已盤點，尚未移植 |
| [LifecycleSystem](../../chrome-extension/simulation.js#L5777) | 生命週期 | Agent, Personality; world: addAgent, agents, clock, dailyNews, events, factions, gossipNetwork, logMessage, processing, removeAgent, tickCount | `lifecycle` | 4d | 已盤點，尚未移植 |
| [ExplorationSystem](../../chrome-extension/simulation.js#L6086) | 探索 | —; world: agents, clock, dailyNews, events, logMessage, stockpile, tickCount | `exploration` | 4d | 已盤點，尚未移植 |
| [LegacySystem](../../chrome-extension/simulation.js#L6250) | 世代傳承 | Personality; world: _legacyGeneration, agents, buildings, farm, industry, logMessage, multiEnding, prosperity, research, stockpile | `_legacyGeneration / player / resources` | 4e | 已盤點，尚未移植 |
| [World](../../chrome-extension/simulation.js#L6457) | 世界更新與序列化 | Agent, BuildingManager, ConversationEngine, CouncilSystem, CustomNPCSystem, DailyDecisionSystem, DailyNewsEngine, ElectionSystem, EventChoiceSystem, EventSystem, ExplorationSystem, Faction, FactionSystem, FarmSystem, FestivalSystem, GameClock, GossipNetwork, IndustryManager, Job, LifeGoalSystem, LifecycleSystem, MultiEndingSystem, NPCEventSystem, NPCHelpSystem, NPCQuestSystem, NewsSystem, Personality, PlayerAgent, ProcessingSystem, ProsperityEngine, QuestSystem, ReputationSystem, ResearchManager, RogueCardSystem, ShopSystem, Stockpile, TownFeedSystem, TownIdentitySystem, TownMap, TradeManager, WeatherSystem, WorkOrderManager; world: — | `58 頂層鍵` | 3 / 4a–4f | 已盤點，尚未移植 |
| [ReputationSystem](../../chrome-extension/simulation.js#L8216) | 聲望 | —; world: agents, dailyNews, questSystem | `reputationSystem` | 4d | 已盤點，尚未移植 |
| [WeatherSystem](../../chrome-extension/simulation.js#L8406) | 天氣災害 | —; world: agents, buildings, clock, dailyNews, eventChoice, logMessage, news, stockpile, tickCount | `weather` | 4d | 已盤點，尚未移植 |
| [CouncilSystem](../../chrome-extension/simulation.js#L8766) | 議會 | —; world: agents, clock, dailyNews, logMessage, news, reputationSystem, stockpile, tickCount | `council` | 4d | 已盤點，尚未移植 |
| [DailyDecisionSystem](../../chrome-extension/simulation.js#L9099) | 每日決策 | —; world: agents, clock, dailyNews, logMessage, reputationSystem, stockpile, tickCount | `dailyDecision` | 4d | 已盤點，尚未移植 |
| [ShopSystem](../../chrome-extension/simulation.js#L9272) | 商店 | —; world: logMessage, reputationSystem, stockpile, tickCount | `shop` | 4d | 已盤點，尚未移植 |
| [EventChoiceSystem](../../chrome-extension/simulation.js#L9327) | 事件選擇 | —; world: agents, dailyNews, logMessage, stockpile, tickCount, weather | `eventChoice` | 4d | 已盤點，尚未移植 |
| [RogueCardSystem](../../chrome-extension/simulation.js#L9476) | 際遇卡 | —; world: agents, clock, dailyNews, logMessage, stockpile, tickCount | `rogueCards` | 4d | 已盤點，尚未移植 |
| [NPCHelpSystem](../../chrome-extension/simulation.js#L9600) | NPC 求助 | —; world: agents, logMessage, reputationSystem, stockpile, tickCount | `npcHelp` | 4d | 已盤點，尚未移植 |
| [SeededRandom](../../chrome-extension/simulation.js#L9767) | 地圖種子亂數 | —; world: — | `待確認` | 4a | 已盤點，尚未移植 |
| [PixelTileMap](../../chrome-extension/tilemap.js#L225) | 格網住房尋路渲染 | —; world: — | `無；格網與 agentPositions 屬執行期` | 3 / 4a | 已盤點，尚未移植 |

## 與 brief 不一致之處

- townMap.width/height 是 800×600 邏輯空間；PixelTileMap 是 80×60、TILE=16。generateLayout 使用固定格子位置，不能把存檔的地點 x/y 直接當成 tile。terrain 是 biome 字串，不是格網。
- 原碼小屋 6×6 格（含屋頂）、議事廳 9×8，與 brief 小屋 2×2 衝突。模型可用 2×2 建模尺寸，顯示需縮放到原版 footprint，確保位置/門口相符。見 D-07。
- World.serialize 不保存 agentPositions；currentLocation 才是存檔位置來源。觀賞版可重建載入位置，無法還原未保存的逐格行走中座標。
- simulation.js 實際 43 classes；角色名冊是 20 NPC＋旅人，海風鎮 15 NPC＋旅人，非兩鎮均 25 NPC。
- SeededRandom 僅控制地圖；模擬大量使用 Math.random。golden harness 在 VM 注入固定 Park–Miller random、虛擬時間，不修改原碼。
- 尋路／進出屋／住房與部分移動在 PixelTileMap；不是全在 Agent。應先重建相同格網，再移植 4a。
- 保留目前停用的玩法狀態，但不要恢復原碼已移除的玩家職業 UI、每日 rogueCards 抽卡。

## 非 class 移植項目

- 所有常數表（JOB_DEFINITIONS、TRAIT_POOL、TOWN_THEMES、CORE/WORK/SOCIAL/RESIDENTIAL/NATURE_LOCATIONS、BUILDING_TEMPLATES/UPGRADES、QUEST 等）保留原值與文字。
- processDailyProduction / generateRandomSkills / randInt / pickRandom / weightedChoice / shuffle 按更新順序移植，避免亂數消耗次序變動。
- RimTownApp._syncHousing / _getFactoryPlots / generateLayout 決定住宅、道路與工廠地基；需與 JS oracle 比較。
- App 的帳號、雙寫、stale、IndexedDB 編年史、訪客信箱、任務引導與跨鎮流程分屬 2/3/5，不能只移植 World。

## Golden 驗收範圍

node godot/tools/golden.mjs：兩次獨立 VM 執行、兩個主題、各 1/7/30 天 06:00；tick 0/576/2784，30 日是夏季第 15 天。所有 6 份序列化結果逐位元相同，來源雜湊與結果位於 tests/golden/manifest.json。無 LLM／玩家行動／渲染幀；因此這是 offline 模擬基準，不是完整互動或網路驗證。尚未有 GDScript 模擬，不宣稱 Phase 4 golden 通過。
