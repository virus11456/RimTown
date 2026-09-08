# RimTown 3D Low-Poly 重寫指令書（給 GPT 代理人：Blender + Godot 4）

> 用法：把整份文件貼給 GPT（Codex／ChatGPT Agent 皆可），並給它這個 repo 的存取權。
> 它必須先讀完第 1、2 章再動手，每個 Phase 結束照第 7 章格式回報。
> 第 8 章是專案擁有者尚未拍板的事，代理人不可自行決定，遇到就停下來問。

---

## 0. 你的角色與工作方式

你是 RimTown 的 3D 重製工程師，同時負責 Blender 資產管線與 Godot 客戶端。你要把一款現有的 2D 像素 AI 小鎮模擬遊戲，重寫成 **low-poly 3D** 版本，但**沿用同一套後端、同一個帳號系統、同一個存檔格式**。

工作守則：
1. **不要碰 `api/`、`chrome-extension/`、`wordpress/` 任何檔案。** 現有網頁版持續營運，你的所有產出放在新資料夾 `godot/`。
2. 每個 Phase 都要能獨立驗收（第 4 章有 Definition of Done），做不完不要跳下一個 Phase。
3. 任何不確定的設計決定，先寫進 `godot/docs/DECISIONS.md` 標成「待確認」，用預設值繼續做，不要停工等答案，除非是第 8 章列的項目。
4. 所有 Blender 工作都用 **headless Python 腳本**（`blender -b -P script.py`）產生，不接受手工建模。資產要能一鍵重生。
5. 所有秘密（API 金鑰、資料庫連線）只存在 Vercel 環境變數，**不得寫進 repo、不得寫進 Godot 專案設定、不得出現在回報裡**。
6. 每個 Phase 結束都要 commit，訊息格式 `godot: <phase> <一句話>`；不要 force-push；不要 rebase 別人的分支。

---

## 1. 專案現況（事實，不要重新猜）

### 1.1 產品
- 網址 https://rimtown.cc ，純前端瀏覽器遊戲 + Vercel Serverless 後端 + Neon Postgres 存檔。
- 玩法：玩家是「旅人」，住進 AI 村民自主生活的小鎮；村民有記憶、需求、性格、人際關係、工作、婚戀、選舉、任務鏈；玩家可對話、送禮、耳語、蓋建築、經營產業、參選鎮長；有主線任務（5 章）、NPC 個人任務、每日目標、劇情名場面、多重結局。
- 兩座城鎮：**邊境鎮**（`townTheme: 'frontier'`，主線舞台）與**海風鎮**（`townTheme: 'harbor'`，漁村：碼頭、鹽場、燈塔）。玩家可搭馬車往返，村民會跨鎮互訪。
- 語言：繁體中文優先，另有英文（`chrome-extension/i18n.js`，約 2900 行字典）。

### 1.2 前端程式碼（`chrome-extension/`，與 `wordpress/` 互為鏡像）

| 檔案 | 行數 | 內容 |
|---|---|---|
| `simulation.js` | 9,772 | 整個模擬：43 個 class。`World` 是根；`Agent`/`PlayerAgent`、`Needs`、`Memory`、`RelationshipManager`、`Personality`、`SkillSet`、`Job`、`GameClock`、`ConversationEngine`、`LLMClient`、`TownMap`、`EventSystem`、`ElectionSystem`、`Stockpile`、`BuildingManager`、`TradeManager`、`ResearchManager`、`WorkOrderManager`、`FactionSystem`、`LifeGoalSystem`、`TownIdentitySystem`、`FestivalSystem`、`LifecycleSystem`、`ExplorationSystem`、`LegacySystem`、`ReputationSystem`、`WeatherSystem`、`CouncilSystem`、`DailyDecisionSystem`、`ShopSystem`、`EventChoiceSystem`、`RogueCardSystem`、`NPCHelpSystem`、`SeededRandom` 等 |
| `tilemap.js` | 5,001 | `PixelTileMap`：2D 像素地圖產生與繪製、建築子區、住房分配、選址、季節與天氣粒子、馬車站、碼頭 |
| `app.js` | 9,351 | UI 與流程：帳號、雲端存檔、城鎮列表、分頁（小鎮／居民／故事／設定）、聊天、任務引導、管理員面板、自動存檔 |
| `quest-system.js` | 1,475 | 主線 5 章、支線、每日目標、劇情事件 |
| `npc-quests.js` | 1,127 | NPC 個人任務鏈、產業加成 |
| `industry.js` / `farm.js` / `processing.js` / `prosperity.js` | 253 / 280 / 379 / 334 | 產業、農田、加工、繁榮度 |
| `npc-events.js` / `custom-npc.js` / `daily-news.js` | 269 / 702 / 257 | NPC 事件、自訂 NPC 與多重結局、每日新聞 |
| `chiptune.js` | 443 | 程序式 8-bit 背景音樂 |
| `style.css` / `index.html` | 4,144 / 382 | UI |

### 1.3 後端契約（全部沿用，禁止修改；Vercel Hobby 上限 12 個函式，已用滿）

| 端點 | 方法 | 用途 |
|---|---|---|
| `/api/register` | POST `{username,password,email?}` | 註冊，回 `{nonce(JWT), user}` |
| `/api/login` | POST `{username,password}` | 登入，回 `{nonce, user}` |
| `/api/me` | GET（Bearer） | `{logged_in, user, is_admin, record_missing}`；POST `{action:'repair', new_password}` 重建遺失帳號紀錄 |
| `/api/reset-password` | POST | 重設密碼 |
| `/api/saves` | GET（Bearer） | 雲端存檔清單 `[{town_id, town_name, season, year, day, population, updated_at}]` |
| `/api/save` | POST `{town_id, town_name, save_data(JSON 字串), season, year, day, population, force?}` | 寫存檔；雲端 tickCount 較新時回 `{success:true, stale:true}` 不覆寫 |
| `/api/save/<town_id>` | GET / DELETE | 讀／刪單一存檔（回 `{save_data}`） |
| `/api/settings` | GET / POST `{npc_llm_budget}` | 帳號設定（只有 NPC 每日 AI 額度） |
| `/api/achievements` | GET / POST | 成就 |
| `/api/leaderboard` | GET / POST | 排行榜 |
| `/api/chat` | POST `{prompt, max_tokens, temperature, lane:'chat'|'background'}` | **內建 AI 代理**。回 `{reply, remaining, provider, lane, model}`。`chat` 線（玩家對話、劇情）優先 Groq 免費額度，`background` 線（行程、反思）走付費主渠道，任一邊故障自動互退。訪客每日 10 則、登入 100 則。**客戶端永遠不持有任何 AI 金鑰。** |
| `/api/admin` | GET/POST（管理員） | 玩家列表、封鎖、刪除、搬遷 |

認證：`Authorization: Bearer <JWT>`，JWT 30 天。Godot 端用 `HTTPRequest` 即可，全部是 JSON。

### 1.4 存檔格式（必須相容，這是硬約束）
`save_data` 是 `World.serialize()` 的 JSON 字串。頂層鍵：

```
version _legacyGeneration savedAt clock tickCount paused messageLog townMap agents
npcConversationLog npcLlmUsedToday feudCooldown mediations workPolicy townTheme visitors
townName playerActions dailyEcho dailyFocus gossip townFeed events stockpile buildings
trade research workOrders news election factions festivals lifecycle exploration
decorations combosFound heartEventsFired industry farm processing dailyNews townIdentity
dramaArchive npcEvents questSystem prosperity npcQuests lifeGoals customNPC multiEnding
dailyDecision shop eventChoice rogueCards npcHelp reputationSystem weather council
```

- `tickCount` 單調遞增，伺服器用它擋「舊存檔蓋新存檔」。**你的版本每 tick 也必須遞增它。**
- 目標：**同一個帳號的同一份存檔，在網頁版和 Godot 版之間可以互相載入。** 所以 Godot 版的模擬要能讀寫這個 schema，未移植的子系統也要把原始 JSON 原封不動保留並回寫（round-trip），不能丟欄位。
- 專案有一份「存檔保護規範」在 `README.md`，五條規則同樣適用於你：不改儲存路徑與鍵名、絕不自動刪雲端存檔、只快取靜態資源、存檔只能往前走、載入要向下相容。

### 1.5 現有 2D 世界的資料模型（你要把它變 3D 的來源）
- `townMap`：格狀地圖，地形 `TERRAIN_TYPES`（草地、道路、水、沙、田、森林等），`CORE_LOCATIONS` / `WORK_LOCATIONS` / `SOCIAL_LOCATIONS` / `RESIDENTIAL_LOCATIONS` / `NATURE_LOCATIONS` 定義建築與地點。
- `PixelTileMap` 負責：住宅子區與住戶分配（已婚同住、單身獨居、不夠就加蓋 `residential_extra_*`）、工廠地基、馬車站、選址發光預覽（2 格對齊）、季節裝飾與粒子（雪、雨、落葉、螢火蟲、炊煙、慶典）。
- `TOWN_THEMES` 決定兩鎮差異；`CROSS_TOWN_TIES` 決定跨鎮人際。
- 村民：`JOB_DEFINITIONS`（農夫、礦工、廚師、工匠、醫生、研究員、商人、守衛、牧師、漁夫、鹽工等）、`TRAIT_POOL` 性格、`ACTIVITIES` 每日作息。

---

## 2. 目標與不可談判原則

1. **視覺**：low-poly 3D，平面著色（flat shading），單一調色盤貼圖，無寫實材質。參考語彙：Polytopia、Tunic、Townscaper、A Short Hike。細節規格見第 5 章。
2. **引擎**：Godot **4.3 以上**（4.4 可），GDScript 為主，不用 C#（web 匯出限制）。
3. **平台**：第一優先是 **Web 匯出**（要能放在 rimtown.cc 同網域，這樣才能直接打 `/api/*`）；第二是桌面（Win/mac）。手機瀏覽器要能玩（觸控操作）。
4. **後端零改動**：帳號、存檔、AI 代理全部沿用第 1.3 章的 API。
5. **存檔相容**：第 1.4 章。這是驗收的第一條。
6. **模擬邏輯逐字移植，不重新設計玩法。** 你的工作是換引擎與換畫面，不是做新遊戲。數值、機率、文案、任務條件一律照原碼。
7. **資產全部程序化生成**（Blender Python），可一鍵重生；不得引入第三方付費或授權不明的模型。
8. 中文優先，i18n 字典沿用 `chrome-extension/i18n.js` 的 key，轉成 Godot 的 `.csv`/`.po`。

---

## 3. 架構決策（照做，除非第 8 章另有指示）

### 3.1 資料夾
```
godot/
  project.godot
  addons/                 # 只放你自己寫的
  assets/
    models/               # Blender 產出 .glb（不手改）
    palette/palette.png   # 單一調色盤（16x16 色塊或 256x1 漸層條）
    fonts/
    audio/
  scenes/
    main.tscn
    world/                # 3D 世界、格子、建築、村民
    ui/                   # 分頁 UI（小鎮／居民／故事／設定）
  scripts/
    sim/                  # 模擬層（純 GDScript，無 Node 依賴，可單元測試）
    view/                 # 顯示層（把 sim 狀態畫成 3D）
    net/                  # HTTP 客戶端：auth / saves / chat
    i18n/
  tools/
    blender/              # bpy 腳本：gen_terrain.py gen_buildings.py gen_villagers.py ...
    build.sh              # 一鍵：產資產 → 匯入 → 匯出 web
  tests/                  # GUT 或內建 SceneTree 測試 + golden 檔
  docs/
    PORT_MAP.md           # JS class → GDScript 對照與進度
    DECISIONS.md
    ART_SPEC.md
```

### 3.2 模擬層移植策略
- `scripts/sim/` 是**純邏輯**：只用 `RefCounted`，不碰 Node、不碰渲染，`tick()` 一次推進一步，輸入輸出都是 Dictionary，方便和 JS 版對照。
- 移植順序（由核心到外圍）：`SeededRandom` → `GameClock` → `Needs`/`Personality`/`SkillSet`/`Job` → `Memory`/`Relationship` → `Agent` 作息與移動 → `Stockpile`/`BuildingManager`/`Industry`/`Farm`/`Processing` → `EventSystem`/`WeatherSystem`/`FestivalSystem` → `QuestSystem`/`NPCQuestSystem` → `ConversationEngine`（接 `/api/chat`）→ 其餘。
- **Golden test**：用 Node 跑原版 `simulation.js`，以固定 seed 產生「第 1、7、30 天」的 `serialize()` 快照放進 `godot/tests/golden/`。GDScript 版用同 seed 跑到同 tick，比對關鍵欄位（人口、資源、關係值、任務狀態）。允許的差異只有浮點誤差與 LLM 文字。
- 尚未移植的子系統：載入時把該鍵的原始 JSON 存成 `Dictionary` 保留，序列化時原樣寫回。這樣任何 Phase 的版本都能安全存檔。

### 3.3 顯示層
- 世界用 **GridMap**（地形與道路）+ **MultiMeshInstance3D**（樹、作物、裝飾）+ 個別 `Node3D`（建築、村民）。格子尺寸 1 單位 = 原版 1 tile。
- 相機：**正交投影、3/4 俯視（約 35° 俯角、45° 方位）**，可 90° 一格一格旋轉、縮放、拖曳平移；手機雙指縮放、單指拖曳。
- 燈光：一盞 DirectionalLight3D 隨 `clock` 走日夜（色溫與角度），環境光用單色天空。陰影開低解析度即可。
- 季節與天氣：粒子用 `GPUParticles3D`，雪／雨／落葉／螢火蟲四種，對應原版；冬季地面材質切換為調色盤裡的白色區。
- 村民：模組化 low-poly 人偶（身體、頭、髮型、帽子／工具），依職業與性別配色；動畫只需 idle、walk、work、sleep、talk 五個，用簡單骨架或程序式擺動皆可。
- UI：沿用原版資訊架構（小鎮／居民／故事／設定四個入口），Godot `Control` 重做；手機版底部浮動選單。

### 3.4 Blender 管線
- 每個資產一支 bpy 函式，統一入口 `tools/blender/build_all.py`，輸出 `assets/models/<name>.glb`，全部共用 `palette.png`，UV 只指到色塊中心（一個面一個色）。
- 命名：`bld_house_a.glb`、`bld_factory.glb`、`bld_coach_station.glb`、`bld_dock.glb`、`bld_lighthouse.glb`、`ter_grass.glb`…、`chr_body_m.glb`、`chr_hair_01.glb`、`prop_tree_pine.glb`…
- 每個 GLB 帶原點在底面中心、Y 軸向上、單位公尺、1 格 = 1 公尺。
- 產出後跑 `tools/blender/verify.py` 檢查三角面數與尺寸不超標（第 5 章）。

---

## 4. 分階段任務

### Phase 0：盤點與對照表（不寫遊戲碼）
- 讀完 `simulation.js`、`tilemap.js`、`app.js`、`quest-system.js`、`npc-quests.js`。
- 產出 `godot/docs/PORT_MAP.md`：每個 JS class 一列，欄位：職責、依賴、存檔鍵、預計移植 Phase、狀態。
- 產出 `godot/docs/ART_SPEC.md`：列出所有需要的 3D 資產（建築、地形、村民部件、道具、粒子），每項附三角面預算與調色盤色號。
- 用 Node 產出 golden 快照（seed 固定，第 1／7／30 天）到 `godot/tests/golden/`。
- **DoD**：三份文件齊全；golden 檔可重現（同 seed 兩次輸出相同）。

### Phase 1：Blender 資產工具
- `tools/blender/` 完成第 3.4 章；至少產出：地形 8 種、道路 4 種（直、彎、丁、十）、房屋 3 款、議事廳、市場、農舍、工廠、礦坑口、教堂、診所、研究所、馬車站、碼頭、鹽場、燈塔、樹 3 款、作物 3 階段、圍籬、路燈、井、篝火；村民身體 2 款、頭髮 6 款、帽子／工具 10 款。
- `verify.py` 全過。
- **DoD**：`blender -b -P tools/blender/build_all.py` 一鍵重生所有 GLB；在 Godot 開一個 `showcase.tscn` 把所有資產排一排截圖。

### Phase 2：Godot 骨架
- 專案設定、主場景、相機控制（含手機觸控）、日夜燈光、UI 四入口空殼、i18n 匯入。
- `scripts/net/`：`ApiClient` 完成 register/login/me/saves/save/load/settings/chat，含 JWT 保存與 `stale` 處理。
- **DoD**：能登入、能列出雲端存檔清單、能下載一份存檔並把 JSON 解析成 Dictionary 不報錯。

### Phase 3：世界渲染
- 讀 `townMap` 與 `buildings` 產生 3D 世界；兩種主題都要；住宅子區與加蓋屋、工廠地基、馬車站、碼頭位置與原版一致。
- 季節、天氣粒子、裝飾（`decorations`）。
- 村民放到 `agents` 的座標上，依職業穿戴，先不動。
- **DoD**：載入網頁版存檔，3D 世界與 2D 截圖對得上（建築位置、道路走向、村民人數）。

### Phase 4：模擬移植（最大的一段，分子階段提交）
- 4a：時鐘、隨機、需求、作息、移動與尋路（A*，含進出建築、卡屋保險絲）。
- 4b：記憶、關係、閒聊、婚戀、派系、八卦。
- 4c：資源、建築、產業、農田、加工、貿易、研究、工單、繁榮度。
- 4d：事件、天氣、節慶、生命週期、探索、選舉、議會、每日決策。
- 4e：任務（主線／支線／每日／NPC 個人）、劇情名場面、多重結局、成就。
- 4f：對話引擎接 `/api/chat`（`lane` 正確：玩家對話與名場面 `chat`，行程與反思 `background`；訪客／登入額度提示；429 與 502 的降級文案照原版）。
- 每個子階段：golden test 通過該範圍欄位；存檔 round-trip 不丟鍵。
- **DoD**：同 seed 跑 30 天，人口、資源、關係、任務狀態與 golden 一致；網頁版存檔載入後可繼續玩並回存，網頁版再載入不壞。

### Phase 5：UI 與玩法操作
- 四入口全部功能：小鎮（資源、建築、產業、天氣、新聞）、居民（列表、詳情、關係圖、時間軸、聊天、送禮、耳語）、故事（任務、名場面、編年史、結局）、設定（帳號、額度、速度、語言、音樂、管理員面板）。
- 選址蓋建築：可蓋處發光、2 格對齊，與原版規則相同。
- 馬車過場：兩鎮切換。
- **DoD**：對照原版 UI 逐項打勾清單全綠；手機 375px 寬可操作。

### Phase 6：匯出與效能
- Web 匯出（threads 關閉以相容 Safari），放進 `godot/export/web/`；桌面匯出。
- 效能目標：手機 Safari 30 fps、桌機 60 fps，25 村民 + 兩鎮資產；首次載入 < 25 MB。
- 音樂：把 `chiptune.js` 的程序式旋律移植成 `AudioStreamGenerator`，或改用預先渲染的 OGG（先問第 8 章）。
- **DoD**：匯出物可在 rimtown.cc 的 `/3d/` 路徑載入並登入遊玩（由專案擁有者部署）。

---

## 5. Low-poly 美術規範（硬數字）

| 項目 | 規格 |
|---|---|
| 著色 | 全部 flat shading；材質只有一個 `StandardMaterial3D`，貼圖 `palette.png`，`roughness 1.0`、`metallic 0`，不用法線貼圖 |
| 調色盤 | 32 色以內，分「地形 8、建築 8、村民 8、道具 4、季節 4」；冬季用同一張圖的白色區 |
| 三角面 | 地形塊 ≤ 12；道路 ≤ 24；小屋 ≤ 300；大型建築（議事廳、工廠、燈塔）≤ 800；樹 ≤ 60；作物 ≤ 30；村民全身 ≤ 600；道具 ≤ 80 |
| 尺寸 | 1 格 = 1 公尺；小屋 2×2 格、大建築 3×3 或 4×3，與原版佔格一致 |
| 輪廓 | 允許輕微傾斜與不對稱增添手作感，但不得有懸空面或反向法線 |
| 村民 | 頭大身小（頭約全身 1/3），無手指、無五官貼圖，眼睛用兩個深色小面 |
| 動畫 | idle（呼吸）、walk（腿擺）、work（依職業一個動作）、sleep（躺）、talk（點頭）；每段 ≤ 1 秒循環 |
| 相機 | 正交，俯角 35°、方位 45°，四向旋轉，縮放範圍 8 到 40 格寬 |
| 後處理 | 只允許輕微 SSAO 與 vignette；不用 bloom、DOF、motion blur |

---

## 6. 驗收清單（專案擁有者會逐項檢查）

- [ ] 用網頁版帳號登入 Godot 版，看到相同的城鎮列表。
- [ ] 載入網頁版存檔，3D 世界與 2D 一致（位置、人數、天數、資源）。
- [ ] 在 Godot 版玩 10 分鐘後存檔，回網頁版載入不壞、進度延續。
- [ ] Golden test 30 天一致。
- [ ] 和村民對話走 `/api/chat`，`lane` 正確，額度用完顯示原版文案。
- [ ] 兩鎮都能進、能搭馬車往返。
- [ ] 蓋建築有發光引導與對齊。
- [ ] 手機 Safari 可玩、30 fps。
- [ ] `blender -b -P tools/blender/build_all.py` 一鍵重生全部資產且 `verify.py` 全過。
- [ ] repo 內沒有任何金鑰；`api/`、`chrome-extension/`、`wordpress/` 零改動。

---

## 7. 每個 Phase 的回報格式

```
## Phase N 回報
- 完成：<條列，附檔案路徑>
- 未完成／延後：<條列，原因>
- 驗證：<跑了哪些測試、結果數字、截圖路徑>
- 存檔相容：<round-trip 測試結果；丟失鍵數必須是 0>
- 待確認決策：<引用 DECISIONS.md 條目>
- 下一步：<一句話>
```

---

## 8. 專案擁有者尚未拍板的事（代理人不可自行決定）

1. **Web 版是否要取代現有 2D 版？** 目前預設：**並行**，Godot 版放在 `/3d/` 子路徑，2D 版維持原位。
2. **首個可玩里程碑只做邊境鎮，海風鎮後補？** 目前預設：**是**（海風鎮資產在 Phase 1 就先做，但玩法 Phase 5 再接）。
3. **音樂**：移植程序式 chiptune，或改用預渲染音檔？目前預設：**先用預渲染 OGG**，較省工。
4. **相機**：固定四向 3/4 俯視，還是自由旋轉？目前預設：**四向**（low-poly 在固定角度最好看，也省效能）。
5. **村民外觀**：要不要在 Blender 階段就做「依性格／年齡」的細節差異（年長者駝背、小孩比例）？目前預設：**要**，因為原版有生命週期（出生、老化、死亡）。
6. **完整移植 vs. 先做「觀賞版」**：觀賞版＝只做 Phase 0–3（3D 看網頁版的世界，不能操作），先確認美術方向再投入 Phase 4。目前預設：**先做觀賞版給擁有者看過再繼續**。
