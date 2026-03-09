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
- **Achievement System**: 38+ achievements across social, romance, economy, survival, faction, exploration categories
- **NPC Conversation Visualization**: Speech bubbles on map when NPCs talk to each other
- **Player Interaction**: Choose jobs, vote in elections, flirt, propose, and marry NPCs
- **Multi-LLM Support**: Claude, GPT, Gemini, DeepSeek, Groq, Together AI, MiniMax (or play without AI) with automatic Groq fallback on rate limit
- **Pixel Art Map**: Animated tilemap with day/night cycle, campfires, particles

## WordPress Plugin Install

1. Download `rimtown-v2.0.zip` from Releases
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
