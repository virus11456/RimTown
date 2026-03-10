# RimTown - AI Town Simulation 邊境鎮

A RimWorld-inspired AI town simulation where every resident is an autonomous AI agent with unique personality, background, job, relationships, and daily life. Available as a WordPress plugin.

## Features

- **Autonomous AI Agents**: 25+ residents with unique personality, memory, moods, and psychological needs
- **Social Simulation**: Agents chat, gossip, form friendships, rivalries, and romantic relationships
- **Job System**: 12 RimWorld-inspired jobs — farming, mining, cooking, crafting, doctoring, research, trading, and more
- **Dynamic Events**: Random events, seasons, raids, event chains, and merchant caravans
- **Memory & Relationships**: Agents remember interactions, form opinions, date, marry, cheat, and divorce
- **Election System**: Mayor elections with campaigns, voting, and policy effects
- **Economy**: Resources, buildings, research tech tree, trading
- **Account System**: Register/login, cloud saves, multi-device sync
- **Faction System**: NPCs form social circles (work buddies, drinking pals, gossip circles) with alliances and rivalries
- **Seasonal Festivals**: Spring Festival, Midsummer Bonfire, Harvest Festival, Winter Solstice with quests and decorations
- **NPC Lifecycle**: Aging, death (old age/disease/accidents), birth, graveyard with epitaphs
- **Exploration**: 6 discoverable zones outside town (forest, ruins, mine, mountain, cave, swamp) with expeditions
- **Achievement System**: 50+ achievements across social, romance, economy, survival, faction, exploration, industry categories
- **NPC Conversation Visualization**: Speech bubbles on map when NPCs talk to each other
- **Player Interaction**: Choose jobs, vote in elections, flirt, propose, and marry NPCs
- **Multi-LLM Support**: Claude, GPT, Gemini, DeepSeek, Groq, Together AI, MiniMax (or play without AI) with automatic Groq fallback on rate limit
- **Pixel Art Map**: Animated tilemap with day/night cycle, campfires, particles
- **Four Industries System**: Lumber, Quarry, Farming, Mining — choose your starting industry and unlock more as your town grows (v3)
- **Farm & Crop System**: Plant crops, manage plots, seasonal planting, quality system, NPC farmer bonuses (v3)
- **Factory Processing**: Build factories (bakery, textile mill, brewery, etc.), assign workers, craft goods, fulfill orders (v3)
- **AI Daily Newspaper**: LLM-generated town newspaper with NPC reporter personality, gossip, and event coverage (v3)
- **NPC Relationship Events**: Fights, hospitalizations, sabotage, cheating scandals with town-wide consequences (v3)
- **Town Level System**: 7 town levels from hamlet to city, unlocking industry slots as you grow (v3)

## WordPress Plugin Install

1. Download `rimtown-v3.1.1.zip` from Releases
2. WordPress Admin → Plugins → Add New → Upload Plugin
3. Activate the plugin
4. Create a page with shortcode `[rimtown]`
5. (Optional) Enable user registration: Settings → General → "Anyone can register"

## Shortcodes

- `[rimtown]` — Main game (default 100vh height)
- `[rimtown height="800px"]` — Custom height
- `[rimtown_landing]` — Landing page with intro animation

---

## Changelog

### v3.1.1 (2026-03-10)

**修復地圖消失問題**
- 修復 mobile-header 在桌面版被 WordPress 主題 CSS 覆蓋導致顯示，擠壓地圖空間
- 全面加強 map-panel / canvas / main-layout 的 CSS 防護（!important）防止主題覆蓋
- 新增地圖初始化 debug logging，方便診斷渲染問題
- 版號升級至 3.1.1 強制清除瀏覽器快取

### v3.1.0 (2026-03-10)

**大改版：多路線劇情 / 繁榮度系統 / NPC 個人故事線 / 自訂 NPC / 多結局系統**

**Phase G — 主線任務升級為多路線系統**
- 每個任務支援多條完成路線（搜集/社交/建設），任選其一即可過關
- 5 章劇情重寫：12 個任務，每個有 2-4 條路線
- 新增聲望 (reputation) 系統和劇情旗標 (storyFlags)
- 第三章危機系統：隨機觸發蝗災/盜匪圍城/瘟疫
- NPC 對話 prompt 注入任務狀態和好感度門檻提示
- 任務 UI 升級：多路線進度顯示、危機橫幅、聲望顯示
- 向後兼容舊存檔（自動遷移舊任務結構）

**Phase H — 繁榮度系統 (ProsperityEngine)**
- 7 維度加權繁榮度計算（經濟/建設/人口/幸福/文化/防禦/美觀）
- 繁榮等級：荒涼→起步→發展中→繁榮→傳奇
- 繁榮度效果：影響目標人口（移民速率）、交易價格、心情、商人頻率
- 經濟面板頂部顯示繁榮度儀表板（7 維度進度條）
- NPC 對話 prompt 注入繁榮度狀態

**Phase I — NPC 個人故事線 (NPCQuestSystem)**
- 12 個 NPC 各有 2-3 條個人故事任務，透過好感度觸發
- 多路線完成、結果分支、連鎖觸發系統
- NPC 與產業深度綁定（好感度 → 產業加成）
- LLM prompt 注入個人心願，NPC 對話自然提及故事線
- 任務 tab 顯示 NPC 個人故事進度與產業加成

**Phase J — 自訂 NPC + 多結局系統**
- CustomNPCSystem：創建自訂 NPC（名字/性別/年齡/特質/職業/背景）
- 最多 3 位自訂居民，需 50 銀幣 + 30 食物
- 特質衝突檢查、名字重複檢查，創建後 AI 自動接管行為
- MultiEndingSystem：四種結局（繁榮/和平/傳奇/個人）
- 第五章完成時自動觸發結局判定，含統計數據與鎮史回顧
- 居民列表底部新增「創建新居民」按鈕

**玩家體驗改善**
- 玩家幸福感自動管理：夜間自動睡眠、低需求自動進食/社交/娛樂
- 場所被動恢復（酒館恢復飢餓、住宅恢復休息等）
- 無業時在居民列表直接顯示職業選擇按鈕（醒目黃色提示框）
- 場所英文名統一改中文（town_hall→鎮公所、clinic→診所、workshop→工坊等）

**Bug 修復**
- 修復 NPC 故事線 getIndustryBindingContext 中未定義的 world 參數引用
- 修復季節索引 -1 導致總天數計算錯誤
- 修復自訂 NPC 資源扣除非原子操作（失敗時未回滾）
- 修復夜間睡眠保護條件（rest < 95 才持續睡覺）
- 移除多處 dead code 和未使用變數
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.0.3 (2026-03-10)

**UI 重構 / 主線任務 / 農場視覺 / 20+ Bug 修復 / 版本同步**

- 側邊欄標籤重新設計：擠壓的單行文字標籤改為 5×2 圖示+文字 grid 佈局，RWD 支援桌面/平板/手機/小螢幕
- 標籤整合：產業+農場合併為一頁（子標籤切換）、工廠整合至經濟頁，總標籤從 10 減至 9
- 主線任務系統：14 個任務、5 章節線性推進、13 種目標類型（聊天/資源/產業/人口/農收/貿易等），完整 UI 含進度條、目標追蹤、獎勵顯示
- 農場地圖視覺強化：13 種作物專屬色盤、4 階段生長視覺、土壤紋理、水分指示條、肥料閃光、枯萎效果
- 農場動畫：成熟作物搖擺+發光脈衝、NPC 農作動畫（鋤地/翻土/澆水/採收）含工具精靈圖與粒子特效
- 修復 mood 直接修改被每 tick 重算覆蓋的問題（新增 moodModifier 機制）
- 修復情侶關係事件重複處理（每對只處理一次）
- 修復餐食消耗不完整（部分存量不被消耗）
- 修復旅行者歸來丟失技能/記憶/關係
- 修復選舉記憶存 agentId 而非 name
- 修復 SeededRandom(0) 產生退化序列
- 修復農場 sellValue 重複套用品質乘數
- 修復工廠進度重置丟棄小數部分、不可用工人仍獲得效率加成
- 修復住院/失蹤天數計算（2天週期但只計1天）
- 修復 19:00-20:00 窗燈亮度為負值
- 修復 XSS 漏洞（username 未轉義）
- 修復 night_owl 成就在遊戲開始時立即解鎖
- 修復 Chrome Extension manifest.json 版本號未同步（2.4.2→3.0.3）
- 補齊 Chrome Extension changelog 缺少的 v3.0.0/v3.0.1/v3.0.2 記錄
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.0.2 (2026-03-10)

**資安強化：Gemini API 金鑰保護 + 認證端點速率限制**

- Gemini API 金鑰從 URL query param 移至 x-goog-api-key header，防止洩漏至瀏覽器歷史/referrer
- WordPress 認證端點新增伺服器端速率限制（登入/註冊 5次/5分鐘、重設密碼 3次/10分鐘）
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.0.1 (2026-03-10)

**Bug 修復：40+ 項代碼審查修復 / WordPress 側邊欄補齊 / NPC 事件防護**

- 修復全面代碼審查發現的 40+ 個 bug（simulation / app / tilemap / processing / daily-news）
- 修正 JOB_PRODUCTION 技能鍵從英文改為中文，修復技能完全不影響生產效率的嚴重 bug
- 修正 Researcher/Mayor 職稱比對從英文改為中文（研究員/鎮長）
- 修正 toTimeString() 改為 timeStr，修復選舉系統崩潰
- 修正 agentA.id 改為 agentA.agentId，修復對話記錄 ID 為 undefined
- 修正選舉 fallbackJobs 中不存在的職業、plain object 改為 new Job() 實例
- 修正 Festival Day 改為「慶典日」，修復慶典事件永遠不觸發
- 修正選舉日計算 120→60（配合每年 60 天）
- 修正 PlayerAgent 無效特質、loadSave 恢復 personality 和 job
- 修正密碼重設使用不存在的 apiBase/nonce 變數
- 修正多處 DOM getElementById null 防護
- 修正 tilemap 道路座標與 generateLayout 一致
- 修正工廠訂單清理邏輯與生產消耗先驗證再消耗
- 修正 daily-news LLM 引用名稱
- 新增 WordPress shortcode 缺少的 4 個側邊欄標籤（產業、農場、工廠、日報）
- 新增 npc-events handleCheatingDiscovery null 防護，避免第三方已離鎮時崩潰
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.0.0 (2026-03-10)

**大改版：四大產業 / 農場種植 / 工廠加工 / AI 日報 / NPC 事件連鎖**

**四大產業系統 (IndustrySystem)**
- 開局四選一起始產業：伐木業🪓、採石業⛏️、農業🌾、礦業⚒️
- 每個產業 Lv1-Lv5 獨立升級路線，消耗資源升級，解鎖更高產出
- 城鎮等級系統（荒村→小村→村莊→小鎮→城鎮→大城鎮→城市），由人口與建築數決定
- 城鎮升級自動解鎖新產業槽位（最多同時四大產業全開）
- 產業協同加成：農林複合、營建雙雄、工業基礎、地下霸主等 10 種組合效果
- 產業 NPC 工人自動計算效率，匹配職業的 NPC 效率更高
- 地圖上顯示產業等級徽章

**農場種植系統 (FarmSystem)**
- 完整農田管理：翻土→播種→生長→收穫→清除枯萎
- 13 種作物，依農業等級解鎖（Lv1 小麥/馬鈴薯 → Lv5 金色小麥/火龍果）
- 季節限制：不同作物只能在特定季節種植，非當季自動枯萎
- 品質系統：普通/優良/極品三級，受灌溉、施肥、輪作、NPC 農夫好感影響
- 灌溉系統：農業 Lv3 後自動灌溉 +30% 生長速度
- 施肥系統：消耗草藥製作肥料，加速 20% 生長
- 收穫超過 3 天未採收自動枯萎
- 農場 UI 頁籤：田地格子、作物選擇、收穫紀錄

**工廠加工系統 (ProcessingSystem)**
- 7 座工廠可建造：麵包坊、紡織廠、釀酒廠、草藥工坊、茶坊、製糖廠、家具工坊
- 建造需消耗資源＋等待天數，建築工匠 NPC 可加速建造
- 配方系統：每座工廠 2 種配方可切換（如小麥→麵包 或 小麥+糖→糕點）
- NPC 員工分配：拖曳分配，對應職業效率 100%，其他 60%
- 工廠倉庫：成品暫存，可收取至 stockpile 或直接販賣
- 訂單系統：隨機生成限時高價訂單，完成獲得額外獎勵
- 市集自動販賣：建了市集後每日自動售出少量成品
- 30+ 種新資源類型：木板、硬木、磚塊、大理石、鋼、金、麵包、啤酒、葡萄酒、香水等
- 工廠 UI 頁籤：建造、配方選擇、工人管理、倉庫操作、訂單列表

**NPC 關係連鎖事件 (NPCEventSystem)**
- 打架住院事件：仇恨值高的 NPC 可能動手打人，受害者住院 3-7 天
- 住院期間消耗藥品，有醫生加速康復，無醫無藥延長住院
- 好友探病機制：好友 NPC 心情連帶下降
- 農田破壞事件：心情極差的神經質 NPC 可能深夜破壞農田
- 劈腿被抓事件：發現劈腿→可能當街毆打→全鎮八卦→派系選邊站
- 好友合作加成：高好感 NPC 在同一工廠工作效率 +20%
- 事件結果影響產業效率（如農夫心碎→農場產量 -30% 一週）
- 所有事件自動收集為 AI 日報素材

**AI 日報系統 (DailyNewsEngine)**
- 每天遊戲結束自動生成一篇 AI 城鎮報紙
- 隨機選擇 NPC 當記者，帶有個人風格和偏見
- 素材自動收集：對話、經濟、事件、關係、建築、探索、生命週期等
- LLM 生成時注入記者性格、職業、鎮況、八卦等完整上下文
- 無 LLM 時使用模板生成保底日報
- 日報永久保存，可回顧歷史
- 日報 UI 頁籤：展開/收合、歷史瀏覽、記者資訊

**打磨與平衡**
- 地圖上渲染農場田地格子（顯示生長狀態、成熟閃爍）
- 地圖上渲染工廠建築（建造進度條、煙囪、窗戶燈光）
- 地圖上渲染產業等級徽章
- NPC 對話注入經濟上下文：產業、農場、工廠狀態影響對話內容
- 產業系統與舊生產系統平衡：已有產業的 NPC 減少 70% 舊式產出，避免疊加
- 15+ 新成就：創業家、產業帝國、初次收穫、極品農產、工廠主、訂單達人、暴力事件、八點檔、讀報人、日報收藏家、城鎮等級等
- 修復產業選擇 UI 返回值格式
- 修復產業面板工人數顯示
- 修復產業協同加成顯示

### v2.4.1 (2026-03-10)

**Bug 修復 / Chrome Extension 版本顯示 / Changelog 更新**

- 更新 v2.4.0 changelog：補齊聊天焦點、登入驗證、存檔同步、版本顯示等 4 項修復記錄
- Chrome Extension 新增遊戲標題列版本號顯示（與 WordPress 版一致）
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v2.4.0 (2026-03-10)

**地圖擴大 / NPC 行為改善 / 點擊移動 / 好友約會系統**

- 修復聊天輸入框搶焦點：每次 game tick 不再重設焦點，解決 WASD 移動被中斷的問題
- 修復登入時 Cookie/nonce 驗證失敗：公開 API 端點不再發送 nonce header
- 新增遊戲標題列版本號顯示：右上角顯示目前遊戲版本
- 修復存檔按鈕：按下後同步至雲端並即時更新城鎮列表 UI
- 修復 AI 回覆顯示分析文字：過濾 LLM 推理/思考過程，只顯示對話內容
- 修復打字時聊天框失焦問題：輸入中不再重繪側邊欄
- 改善附近 NPC 聊天：自動切換到同地點的 NPC，不再卡在遠方對象
- 地圖點擊移動改善：點擊任何地方都會移動到最近的地點，並顯示移動指示圈
- NPC 工作行為改善：上班時間待在工作場所或附近，下班後回家或社交場所
- NPC 停留時間增加：工作 12-20 ticks、社交 6-10 ticks，減少頻繁走動
- 新增好友約會系統：好感度高的 NPC 會互相邀約去特定地點（甚至翹班）
- 地圖擴大為 80x60（原 64x48），建築物重新佈局，空間更寬敞
- 住宅區升級：每個住宅區有 4 棟房屋（原 2 棟），NPC 的家更明顯
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v2.3.8 (2026-03-09)

**修復 NPC 移動抖動 / 雲端存檔持久化 / 派系成就**

- 新增 NPC 位置停留機制：NPC 抵達目的地後會停留 3-12 ticks 再移動，解決不斷抖動的問題，也讓社交互動/對話能正常進行
- 修復雲端存檔載入：換裝置或清除快取後，優先嘗試載入雲端存檔而非直接重置，避免覆蓋雲端進度
- 雲端同步間隔從 5 分鐘縮短為 2 分鐘
- 修復 `faction_drama`（派系風雲）成就缺少觸發條件的問題
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v2.3.7 (2026-03-09)

**修復 LLM 回覆顯示 think 標籤 / 強制繁體中文**

- 修復 DeepSeek、Qwen 等模型回覆包含 `<think>...</think>` 推理標籤直接顯示在聊天中的問題
- 新增 `_stripThinkTags()` 統一在 LLM 回傳結果時過濾推理標籤
- 強化所有 AI prompt 的繁體中文（台灣用語）要求，避免模型回覆簡體中文
- 修正插件 header 版本號與 `RIMTOWN_VERSION` 不一致（2.2.0 → 2.3.7）
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v2.3.6 (2026-03-09)

**Groq 自動備援 / 模型升級**

- Groq 預設模型從 Llama 3.3 70B 改為 Qwen3-32B（中文對話品質大幅提升）
- 新增自動 Groq 備援機制：主 AI 遇到 429 rate limit 或錯誤時，自動切換到備用 Groq
- 設定頁面新增「備用 Groq API Key」欄位（選填，免費申請於 console.groq.com）
- 只填備用 Groq Key 不設主 AI 時，直接使用 Groq 作為主要 AI
- 主 AI 冷卻機制：首次失敗冷卻 60 秒，重複失敗逐步延長至最多 5 分鐘
- 主 AI 恢復正常後自動切回，無需手動操作
- 狀態列顯示「AI:gemini+備用」表示已啟用備援

### v2.3.5 (2026-03-09)

**統一 AI 速率限制為 20 次/分鐘**

- 所有 AI provider 統一速率限制為 20 次/分鐘（原先為 12 次/分鐘）
- 移除 MiniMax 特殊限制（NPC 冷卻、token 上限回歸與其他 provider 一致）

### v2.3.4 (2026-03-09)

**MiniMax 省額度模式（40 prompts/5hrs 方案適用）**

- MiniMax API 每分鐘限制 2 次請求（Gemini 等其他 provider 保持 12 次/分鐘不變）
- MiniMax NPC 自動 AI 對話冷卻提升至 150 ticks（約每 5 分鐘 1 次），優先把額度留給玩家對話
- MiniMax NPC 對話 output token 上限降至 400（其他 provider 保持 800）

### v2.3.3 (2026-03-09)

**修復登入後雲端存檔 403 錯誤**

- 修復 AJAX 登入/註冊後 WordPress REST API nonce 過期導致 403 Forbidden（Cookie 驗證失敗）
- PHP 登入/註冊 API 回傳新 nonce，前端自動更新認證令牌

### v2.3.2 (2026-03-09)

**修復 MiniMax 選項未在設定下拉選單顯示**

- 修復 wordpress/rimtown.php 和 chrome-extension/rimtown.php 的設定 Modal HTML 缺少 MiniMax `<option>`
- 實際渲染的設定面板來自 PHP 而非 index.html，之前只修了 index.html 導致選項未出現

### v2.3.1 (2026-03-09)

**Chrome Extension 版恢復 MiniMax 支援**

- 修復 Chrome Extension 版缺少 MiniMax provider 的問題
- 新增 MiniMax API 端點與專屬請求處理（max_completion_tokens、base_resp 錯誤處理）
- 移除 chrome-extension/app.js 中誤將 minimax 標記為 deprecated 的清除邏輯

### v2.3.0 (2026-03-09)

**MiniMax 恢復 / AI 單一綁定 / Fallback 對話大改版**

- 恢復 MiniMax（中國版）LLM provider：端點 api.minimaxi.com，模型 MiniMax-M2.5
- AI 設定強制單一綁定：切換 provider 時自動清空 API Key，防止誤綁多個
- 儲存時驗證：選了 AI 供應商就必須填入 API Key
- Fallback 對話模板全面重寫：所有對話更長、更有戲劇張力
- 新增豐富細節池：季節美食、場景描寫、禮物清單、鎮上傳聞
- 情侶對話：美食讚美打鬧、醋意風波、禮物驚喜、浪漫散步
- 敵對對話：針鋒相對的正面交鋒、流言質問、試圖和解
- 曖昧對話：落葉場景心動、星空邀約告白
- 摯友對話：分享八卦冒險、傾訴煩惱、回憶往事笑淚交織
- 陌生人對話：熱情推薦美食、小鎮消息初印象
- 一般對話：神秘發現分享、工作驚險趣事、送禮感謝、傳聞討論
- 所有對話摘要改為小說風格，包含地點/季節/情感描寫

### v2.2.0 (2026-03-09)

**派系系統 / 季節節慶 / NPC 生死老化 / 探索系統**

- 派系/社交圈系統：NPC 自動組成小團體（工作夥伴、酒友、八卦圈等），含凝聚力、競爭、結盟與內部戲劇
- 季節節慶系統：春季慶典、仲夏篝火、豐收祭、冬至節，含特殊任務、裝飾與全鎮慶祝活動
- NPC 生死/老化系統：NPC 每季老化，可因老年/疾病/意外死亡，已婚夫妻可生育子女
- 墓園系統：死亡 NPC 安葬於墓園，附墓誌銘紀念
- 探索/地圖擴展：城鎮外 6 個可發現區域（森林、遺跡、礦坑、山脈、洞穴、沼澤）
- 探險隊派遣機制：選派居民出征探索，帶回資源與發現
- 事件頁籤新增派系、節慶、墓園、探索 UI 面板
- 地圖渲染：探索標記、墓碑、節慶裝飾
- 新增 8 個成就（派系、節慶、生死、探索相關）

### v2.1.0 (2026-03-09)

**忘記密碼 / 手機版大改版**

- 忘記密碼功能：透過帳號+電子郵件驗證重設密碼
- 新註冊用戶自動獲得全新村莊，不帶任何舊資料或對話
- 手機版排版大改版：地圖佔 75%、功能區佔 25%
- 手機版新頂部欄：標題+時間+人口合併為一行，控制按鈕收進下拉選單
- 功能面板改為底部常駐（標籤頁永遠可見），上滑展開、下滑收合
- 新增拖拽手柄，支援觸控滑動展開/收合功能面板
- 桌面版完全不受影響

### v2.0.0 (2026-03-09)

**帳號系統 / 成就 / NPC 對話可視化 / 玩家互動**

- 帳號系統：使用者註冊/登入，雲端存檔自動同步（每 5 分鐘）
- 雲端存檔：每帳號最多 20 個城鎮，5MB/城鎮
- 成就系統：30+ 成就里程碑，遊戲內動畫 Toast 通知
- 成就類別：社交、愛情、經濟、生存、城鎮、玩家、特殊
- NPC 對話可視化：NPC 聊天時地圖顯示圓角語音氣泡（8 秒淡出）
- 玩家深度互動：選擇 11 種職業、辭職、換工作
- 戀愛系統：調情、告白、求婚、結婚
- 選舉投票：玩家可在投票期直接投票
- 居民列表顯示玩家卡片（可查看自己的詳情和技能）
- 地圖移動改善：點擊空白處自動移向最近地點，WASD 方向判定更寬容
- Gemini API 速率限制優化：429 時暫停 60 秒，NPC 不重試

### v1.5.0 (2026-03-09)

**篝火之夜 / 全螢幕地圖 / 首頁 / 速率限制**

- 夜晚效果重新設計：移除濃霧覆蓋，改用篝火、火把和極淡藍色調
- 篝火系統：廣場、酒館、守衛站、水井處有動態火焰動畫
- 建築旁自動放置閃爍火把，提供溫暖光暈
- 感情系統強化：新增自然浪漫吸引力（基於性格相容度）
- 降低交往/求婚門檻，增加每次對話的浪漫火花機率
- 地圖全螢幕顯示：Canvas 自動填滿容器，無邊框
- 新增雙指縮放（pinch-to-zoom）和拖曳平移
- 桌面支援滾輪縮放和拖曳平移
- 最小縮放自動計算，最大放大 4 倍
- 新增 `[rimtown_landing]` 首頁短碼：動畫像素背景、特色介紹、AI 模型展示
- 修復地圖消失問題：CSS class 重新命名避免 WordPress Astra 主題衝突

### v1.3.0 (2026-03-09)

**鎮長選舉系統**

- 新增鎮長選舉系統：居民根據個性、價值觀、關係投票
- 選舉流程：競選期（3天）→ 投票期（2天）→ 結果公告（3天）
- 6 種政策主張：經濟發展、社會福利、軍事防禦、文化教育、自然保育、個人自由
- 候選人根據個性與價值觀自動選擇政策
- 投票依據：關係親密度(40%)、價值觀契合(30%)、魅力能力(20%)、隨機(10%)
- 當選鎮長的政策會產生 30 天持續效果（透過新聞系統）
- 選舉 UI：即時票數、進度條、結果展示（事件頁籤）
- 選舉歷史記錄，可在存檔中保存/載入
- 修正 MiniMax API：模型更新為 M2.5、參數修正為 max_completion_tokens
- 更新 Gemini 預設模型為 gemini-2.5-flash

### v1.2.0 (2026-03-09)

**響應式設計 (RWD)**

- 新增 RWD 響應式設計，支援手機、平板、桌面三種佈局
- 手機版：側欄改為從底部滑出的覆蓋層，搭配浮動按鈕開關
- 手機版：點擊居民或開始聊天時自動開啟側欄
- 手機版：隱藏次要按鈕（匯出/匯入），節省畫面空間
- 手機版：Chat 輸入框使用 16px 字型，防止 iOS 自動縮放
- 小螢幕手機（≤480px）：隱藏速度控制與儲存按鈕
- 平板（≤1024px）：側欄縮窄至 300px
- 新增版本更新日誌系統，後台可查看完整更新記錄

### v1.1.0 (2026-03-09)

**WordPress 插件**

- 建立 WordPress 插件架構（rimtown.php）
- 支援 `[rimtown]` 短碼嵌入任意頁面
- 支援 `[rimtown height="800px"]` 自訂高度參數
- CSS 隔離：所有樣式限定在 `.rimtown-container` 內，不影響主題
- 事件委派隔離：點擊事件綁定遊戲容器，不干擾 WordPress
- 自動全寬：遊戲頁面隱藏 WordPress header/footer
- Modal z-index 設為 100000，確保在 WordPress admin bar 之上
- 新增 WordPress 後台設定頁面（使用說明）
- wp_enqueue_script/style 正確載入資源，支援快取清除

### v1.0.0 (2026-03-08)

**初始版本**

- AI 小鎮模擬核心功能
- Tilemap 地圖渲染引擎
- 居民 AI 自主行為系統
- 玩家聊天系統（支援多 LLM 供應商：Claude、GPT、Gemini、DeepSeek、Groq、Together、MiniMax）
- 經濟系統：資源、建築、研究、貿易
- 事件系統：突襲、連鎖事件、移民
- 聊天記錄存檔功能
- 多城鎮管理
- 匯出/匯入存檔
