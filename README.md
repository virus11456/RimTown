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
- **Legacy / New Game+ System**: Player can have children, start a new generation inheriting resources, buildings, industries, and NPC memories
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

1. Download `rimtown-v3.6.9.zip` from Releases
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

### v3.6.9 (2026-03-15)

**NPC 智慧尋路 + UI 優化**
- NPC 智慧尋路：實作 A* 演算法，NPC 不再撞牆，會自動繞過建築物
- 建築入口優化：門口清出泥土空地，NPC 更容易進出建築
- NPC 提前出門：睡前 1 小時回家、上班前 1 小時出門，行為更像真人
- 城鎮列表按鈕美化：新建城鎮/關閉改為圓角大按鈕
- 移除設定面板暫停/繼續按鈕
- 版號同步：所有檔案統一為 3.6.9

### v3.6.8 (2026-03-15)

**登入後僅讀取雲端存檔 + 按鈕操作回饋**
- 登入後僅讀取雲端存檔，不再存取本地存檔，避免雲端與本地存檔衝突
- 所有按鈕操作新增成功/失敗回饋提示（視覺反饋）
- 版號同步：所有檔案統一為 3.6.8

### v3.6.7 (2026-03-15)

**未登入時自動顯示登入畫面 + 背景霧化城鎮地圖**
- 未登入時自動顯示登入畫面，不需手動點擊
- 背景霧化城鎮地圖：登入畫面背景使用模糊濾鏡顯示城鎮地圖
- 版號同步：所有檔案統一為 3.6.7

### v3.6.6 (2026-03-15)

**美化對話方塊 + 修復 NPC 卡牆 + 存檔管理簡化**
- 美化對話方塊：將瀏覽器原生 `alert()`/`confirm()` 替換為遊戲風格自訂彈窗
- 修復 NPC 卡牆加強版：屋頂(ROOF/ROOF2)與柵欄(FENCE)納入不可行走判定
- 修復碰撞滑動邏輯：正確拆分 X/Y 軸分量進行碰撞回避
- NPC 卡在牆內時自動傳送至最近可行走位置
- 可行走目標搜索半徑從 5 格擴大至 10 格
- 存檔管理 UI 精簡：合併「帳號」與「存檔管理」為「帳號與存檔」
- 移除匯出/匯入存檔按鈕，登入後存檔自動同步雲端
- 版號同步：所有檔案統一為 3.6.6

### v3.6.5 (2026-03-15)

**修復登入系統 + 走路撞牆 + 地圖自由點擊**
- 修復登入功能：新增缺失的 auth-modal HTML（登入/註冊/重設密碼表單）
- 新增 `wp_localize_script` 注入 `rimtownAuth` 前端認證變數
- 新增完整 REST API 端點：`login`、`register`、`reset-password`、`me`、`logout`、`saves`、`save`、`achievements`
- 認證端點速率限制：登入 5次/5分鐘、註冊 5次/5分鐘、重設密碼 3次/10分鐘
- 修復走路撞牆卡住：新增 `_isWalkableTile()` 牆壁碰撞檢測
- 新增 `_findWalkableTarget()` 自動尋找最近可行走位置，避免目標點落在牆內
- 走路時碰到牆壁會沿軸滑動避開，不再卡住原地
- 地圖自由點擊走路：點擊地圖任意位置都能讓玩家走過去
- 移動指示器顯示在實際點擊位置，而非區域中心
- 修復手機登入後地圖跑版：關閉 auth modal 時先 blur 輸入框、重設 viewport 縮放
- 防止 iOS 自動放大：登入表單 input font-size 設為 16px
- 版號同步：所有檔案統一為 3.6.5

### v3.6.4 (2026-03-15)

**腳本載入修復**
- 修復 WordPress 腳本載入順序：`i18n.js` 改為最先載入，所有模組加入依賴，修復 `t is not defined`
- 修復 `processing.js` 語法錯誤：移除 `dailyUpdate()` 中多餘的大括號，修復 `Illegal continue statement`
- 版號同步：所有檔案統一為 3.6.4

### v3.6.3 (2026-03-15)

**NPC 墓園弔念系統 + PWA 支援 + 房屋系統 + 人生報告**
- NPC 弔念系統：城鎮有人過世後，NPC 會前往墓園弔念
- 家人年度弔念：配偶、子女、父母每年會固定前往墓園緬懷逝者
- 全鎮同悲：非親屬鎮民也有機率前往弔念
- 弔念行為產生記憶、心情變化與日誌訊息
- PWA 支援：新增 `pwa-manifest.json`、`sw.js`，可安裝到手機主畫面
- 全螢幕體驗：standalone 模式下隱藏瀏覽器 UI，雙擊標題可切換全螢幕
- 離線快取：核心遊戲資源離線可用
- 安裝提示橫幅：瀏覽器觸發 `beforeinstallprompt` 時顯示安裝按鈕
- NPC 睡眠凍結：睡眠中的 NPC 抵達家中後不再亂走
- 門進出系統：NPC 進出建築物會走門，不再穿牆
- 個別房屋系統：住宅區有 4 間可點擊的獨立房屋，每位 NPC 分配至特定房屋
- 人生總結報告：結局畫面新增豐富的人生統計、關係圖表、成就列表
- i18n 新增弔念與安裝相關中英翻譯
- 版號同步：所有檔案統一為 3.6.3

### v3.6.2 (2026-03-15)

**修復手機版多處 RWD 跑版問題**
- 教學卡片：改用 `calc(100vw - 32px)` 限制寬度，防止文字溢出螢幕
- 任務引導橫幅：使用 `min(500px, calc(100vw - 32px))` 避免超出手機螢幕
- 底部導覽列：加入 `max-width: 100vw` 防止水平溢出
- 版號同步：所有檔案統一為 3.6.2

### v3.6.1 (2026-03-14)

**修復手機登入狀態遺失**
- 修復手機瀏覽器重新整理後登入狀態被登出的問題
- 啟動時加入 `checkLogin()` 伺服器驗證，即使頁面被快取也能從 cookie 還原登入狀態
- 加入 `Cache-Control: no-cache` headers 防止手機瀏覽器快取含有過期登入狀態的頁面
- 版號同步：所有檔案統一為 3.6.1

### v3.6.0 (2026-03-14)

**支線任務 / 每日目標 / 故事事件系統**
- 新增 11 個支線任務（NPC 角色故事驅動）：
  - 第一章：王麗的私房菜、鐵匠的心事（張豪寫詩）、未寄出的情書（劉俊→許瑩）
  - 第二章：古代遺跡之謎（孫雨）、老礦工的秘密（吳達）、黃莉的歌聲
  - 第三章：楊鋒的戰爭記憶、趙霞的人脈
  - 第四章：浪子回頭（馬強）、許瑩的夢想
  - 第五章：老鎮長的心願（陳偉）
- 每個支線任務包含完整劇情文字（觸發故事 + 完成結語），增強故事沉浸感
- 支線任務根據主線進度 + NPC 好感度自動解鎖，無需手動觸發
- 任務面板新增「支線任務」區塊，橘色邊線區分主線
- 新增每日目標系統：根據章節動態生成短期目標（聊天/收集/交易/建造等），完成後自動換下一個
- 新增 7 個故事事件（自動觸發的沉浸式劇情文字）：第一個夜晚、第一個朋友、第一次豐收、小鎮漸成、風雨欲來、廢墟中的希望、「你是我們的一份子」
- 故事事件以 toast 通知形式顯示，停留 8 秒，增加劇情帶入感
- 引導橫幅新增支線任務提示
- 支線/每日/故事事件資料完整支援存檔/讀檔
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.5.0 (2026-03-14)

**對話泡泡優化 / 睡眠動畫 / 走路速度 / 任務引導系統**
- 對話泡泡過濾：思考泡泡不再顯示「技能進步中」「建築完成%」等狀態更新，只保留情緒與對話相關內容
- 泡泡proximity限制：對話泡泡和思考泡泡只在玩家附近 8 格範圍內顯示，遠處 NPC 對話仍正常進行可從紀錄查看
- NPC 睡覺時頭上顯示動態浮動 zzz 動畫（三個 z 以不同大小向上飄動漸隱）
- NPC 走路速度從 0.6 降到 0.3 像素/幀，節奏更自然悠閒
- 新增教學後任務引導系統：教學結束後畫面上方顯示當前任務目標橫幅
- 引導橫幅根據任務進度提供情境提示（如「點擊聊天頁籤找居民打招呼」「有多種方式過冬」等）
- 引導橫幅每 5 秒自動更新，玩家可按 ✕ 關閉，切換新任務時重新顯示
- 已完成教學的老玩家重新進入遊戲也會顯示引導
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.4.0 (2026-03-14)

**新手引導 / NPC 日程系統 / 夜間視覺加強**
- 新增 5 步驟新手教學引導：劇情故事介紹 → 地圖操作 → 居民聊天 → 經濟產業 → 事件探索
- 首次進入遊戲自動觸發教學，完成後不再顯示（localStorage 記錄）
- NPC 日程系統改版：工作時間必須留在工作地點，不可離開崗位去聊天
- 下班後到睡前為社交時間，可自由到酒館、廣場等地聊天
- 睡覺時間 NPC 待在家中，不會發起或參與對話
- 夜晚視覺大幅加強：藍色 tint 從 15% 提升到 35%，加入紫色深度層
- 新增月亮渲染（新月造型，東升西落動畫軌跡）
- 星星從 40 顆增加到 80 顆，亮星加光暈效果
- 營火光圈從 40px 擴大到 55px，亮度提升
- 火把光圈從 18px 擴大到 26px，增加中層漸層
- 窗燈光圈半徑和亮度提升，更早出現（nightAmount > 0.15）
- 新增夜間暗角（vignette）效果，畫面邊緣自然暗化
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.3.5 (2026-03-14)

**全螢幕登入畫面 / 村民對話預設展開**
- 新增 WordPress 全螢幕登入畫面：未登入用戶進入遊戲前會看到登入畫面
- 登入畫面包含帳號/密碼登入、註冊帳號、忘記密碼、訪客進入功能
- 背景使用 backdrop-filter blur(12px) 模糊化底下的村莊地圖
- 登入/註冊成功後畫面淡出動畫(0.6s)，顯示正常遊戲村莊
- 村民對話（紀錄 tab）改為預設展開，不需點擊即可看到完整對話
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.3.4 (2026-03-14)

**職業選擇按鈕邊框修正**
- 職業按鈕邊框從 var(--border) #333 改為 rgba(255,255,255,0.25)，深色背景上清晰可見
- 居民列表無業提示的職業按鈕 padding 加大、邊框加亮
- 版號同步：所有檔案統一為 3.3.4

### v3.3.3 (2026-03-14)

**村民對話面板改版 — 預設收合 + 卡片式排版**
- 村民對話預設收合，只顯示時間+人名+摘要，點擊展開完整對話
- 加入 ▶ 展開指示符，展開時旋轉 90° 提供視覺回饋
- 每組對話改為卡片式排版（圓角邊框+背景色），群組間有間距不再黏在一起
- 展開後的對話區加左側 accent 色邊線，與摘要明確區隔
- 對話行間距加大（margin 3→6px, line-height 1.4→1.5），每行加分隔線
- 修正 toggle handler: collapsed → expanded class（原本展開/收合邏輯不一致）
- 版號同步：所有檔案統一為 3.3.3

### v3.3.2 (2026-03-14)

**全平台 UI 字體與按鈕放大**
- 桌面版：section 標題 0.85→0.9rem、按鈕 padding/字體放大、居民名稱/職業/狀態字體提升
- 手機版 (≤768px)：section 標題 1.05rem、按鈕 0.85rem+min-height 36px、居民/資源/建築/新聞等全面放大
- 小螢幕 (≤480px)：繼承手機版放大規則，tab 標籤微調
- iPad (769-1024px)：section 標題/按鈕/居民卡片/資源等中間尺寸
- sub-tab 按鈕手機版 0.85rem、iPad 0.8rem，增加觸控友善度
- 設定面板 label 0.72→0.82rem，各 inline 小字 0.65→0.75rem
- 版號同步：所有檔案統一為 3.3.2

### v3.3.1 (2026-03-14)

**RWD 適配修正 & Tab Icon 放大**
- 全域加上 overflow-x: hidden，防止手機版/iPad 左右滑動偏移
- 手機版 tab icon 從 1rem 放大到 1.35rem，小螢幕 1.2rem，iPad 1.1rem
- tab bar 高度提升（手機 42→48px、小螢幕 38→44px）改善觸控體驗
- sidebar content 加上 overflow-x: hidden + max-width 防止內容溢出
- sub-tab-bar 手機版取消負邊距避免水平溢出
- 新增 iPad Portrait (769-1024px) 專用媒體查詢
- 版號同步：所有檔案統一為 3.3.1

### v3.3.0 (2026-03-14)

**AI 日報系統重構 & UI 整合 & Bug 修正**
- AI 日報從「紀錄」sub-tab 移入「事件」tab，與新聞公告、鎮長選舉等重要資訊整合
- 「紀錄」tab 簡化為「日誌」，專門顯示 NPC 對話紀錄
- AI 日報 LLM prompt 大幅增強，新增天氣、資源、選舉、NPC 活動等上下文
- 日報結構改為四段式：📰 頭條標題 → 🔥 頭條報導 → 📋 鎮務簡報 → 💬 街頭巷尾 → ✍️ 手記
- max_tokens 800→1200，產出更豐富的 NPC 視角日報內容
- 經濟面板資源列表只顯示已取得的項目（amount > 0）
- 為 30 種進階物品加上專屬 emoji icon 與中文標籤（木板、磚塊、農作物、加工品等）
- 修正手機版點擊 API Key 輸入框時鍵盤會跳掉無法輸入的問題
- 版號同步：所有檔案統一為 3.3.0

### v3.2.9 (2026-03-14)

**數據平衡性全面調整**
- 冬季農業產量乘數 0.2→0.4，避免每年冬季必然缺糧崩潰
- NPC 老化速度減半：每 2 季老 1 歲（原本每季 1 歲），延長 NPC 壽命一倍
- 結婚門檻提高：交往時間 100→300 ticks、好感 40/35→50/45、浪漫 50/40→55/45、機率 15%→10%
- 產業系統對 NPC 職業的壓制從 70%（×0.3）降為 50%（×0.5），NPC 職業仍有存在感
- 觀星活動的浪漫值增長新增前提條件：好感度必須 >20 才會產生浪漫
- 版號同步：所有檔案統一為 3.2.9

### v3.2.8 (2026-03-14)

**玩家生育限制調整**
- 玩家-NPC 夫妻生育不受 20 人口上限限制，改為最多 3 個孩子
- NPC-NPC 夫妻仍維持原本的人口上限

**性格相容度系統**
- 新增 `Personality.compatibility()` 靜態方法，根據特質組合計算 0.2x ~ 1.6x 倍率
- 8 組增益配對（善良+善良、浪漫+浪漫、魅力+害羞、沉穩+神經質等）
- 8 組衝突配對（刻薄+善良、懶惰+勤勞、嫉妒+魅力、神經質+神經質等）
- 套用至所有好感成長管道：NPC 對話、觀星活動、派系組成
- 個性不合的 NPC 好感成長極慢，個性相合的成長正常或略快

**關係自然衰減**
- 超過 50 ticks 未互動，好感每日 -0.8（情侶 -0.3）
- 非情侶的浪漫值每日 -0.5，好感 ≤ 5 時不再衰減
- 派系組成好感/信任基礎值下調（+3~8 → +2~5 / +2~5 → +1~3）

**Bug 修復**
- 修復 `_checkBirths` 中 `npc.age` 應為 `agent.age` 的未定義變數 bug（會導致生育系統完全無法運作）
- 版號同步：所有檔案統一為 3.2.8

### v3.2.7 (2026-03-14)

**玩家生育系統**
- 玩家與 NPC 結婚後可觸發生育事件（`_checkBirths` 支援玩家-NPC 夫妻）
- 孩子繼承父母特質（2 個）+ 1 個隨機新特質
- 孩子標記為 `_isPlayerChild`，用於繼承人選擇

**LegacySystem 繼承引擎**
- 收集繼承（collectLegacy）：50% 銀幣、30% 食物、已建建築（含效果）、已開發產業（清除工人）、60% 繁榮度、已完成研究、農地解鎖狀態、NPC 對玩家的好感/記憶
- 套用繼承（applyLegacy）：繼承人為玩家最年長孩子（無子嗣則新旅人帶遺產）、繼承 30% 技能經驗、NPC 好感轉移 50%、信任轉移 30%、NPC 新增「上一代的孩子來了」回憶、世代計數器 +1

**UI**
- 結局畫面新增「開始二周目」按鈕（含確認對話框）
- 城鎮資訊列顯示「第 N 代」金色標籤（第 2 代起顯示）
- 3 個新成就：為人父母（👶 生下第一個孩子）、二周目（🔄 開始第二代）、三代傳承（👑 進入第三代）
- 版號同步：所有檔案統一為 3.2.7

### v3.2.6 (2026-03-14)

**手機版導航整合：移除「更多」彈出選單**
- 移除「更多」按鈕及彈出選單，改為各 Tab 內建群組 sub-tab
- 居民 Tab 整合「詳情」、聊天 Tab 整合「紀錄」
- 任務 Tab 整合「事件」+「成就」、經濟 Tab 整合「產業」
- 「設定」升級為第 5 個固定 Tab，不再隱藏
- 減少一次點擊即可到達所有功能
- 版號同步：所有檔案統一為 3.2.6

### v3.2.5 (2026-03-12)

**修復手機版「更多」按鈕未顯示**
- 移除 inline style 衝突，修復更多按鈕不顯示的問題
- 將更多選單移出 tab 容器，避免 flex 佈局干擾
- 更多選單改為 3x2 網格，操作更直覺
- 版號同步：所有檔案統一為 3.2.5

### v3.2.4 (2026-03-12)

**手機版導航重新設計：5 Tab + 更多選單**
- 手機版底部改為 5 個固定 Tab（居民、聊天、任務、經濟、⋯更多）
- 點擊「⋯更多」彈出選單顯示其餘功能（詳情、產業、事件、紀錄、成就、設定）
- 不再需要左右橫向滾動，操作更直覺
- 版號同步：所有檔案統一為 3.2.4

### v3.2.3 (2026-03-11)

**手機/平板 Header 隱藏 + 版號全面同步**
- 修復手機版 mobile-header 仍然顯示的問題（≤768px display:block 覆蓋未移除）
- 手機版與平板版 header 統一隱藏，資訊整合至居民 Tab 的 town-info-bar
- app.js 版號同步更新（之前遺漏）
- 版號同步：所有檔案統一為 3.2.3

### v3.2.2 (2026-03-11)

**Header 整合至居民頁 + 人口顯示優化**
- 頂端 Header 資訊（城鎮名稱、人口、時鐘）整合至居民 Tab 頂部的 town-info-bar
- 移除桌面版頂端 Header 列，釋放更多地圖空間
- town-info-bar 即時更新：時鐘與人口每 tick 同步刷新
- 經濟頁繁榮度標題旁新增人口數顯示
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.2.1 (2026-03-11)

**99 成就系統 + 新城鎮修復 + 節慶標籤修復**
- 成就從 57 個擴展到 99 個，涵蓋 7 大分類：社交(13)、戀愛(10)、經濟(24)、生存(12)、城鎮(14)、玩家(12)、特殊(14)
- 新增成就自動解鎖觸發器（每5秒檢查一次）
- 修復新建城鎮按鈕：modal 自動關閉 + 取消暫停 + 顯示確認訊息
- Header 城鎮名稱改為動態顯示（不再寫死「邊境鎮」）
- 修復節慶橫幅與城鎮廣場標籤重疊問題
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.2.0 (2026-03-11)

**設定 Tab 補齊遺漏功能 + Header 中文化**
- 設定 tab 新增 1x/1.5x/2x/3x 加速倍率按鈕（toolbar 遷移時遺漏）
- 設定 tab 新增 AI 連線狀態指示器（AI:已連接/未連接）
- Header「Population: 13」改為「人口：13」
- Header「(+N travelling)」改為「（+N 外出）」
- 移除 Header 中不必要的「plains #513119」地形/種子碼顯示
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.1.9 (2026-03-11)

**移除頂部工具列 — 所有控制整合至設定 Tab**
- 移除桌面版整條 toolbar（城鎮列表、新地圖、儲存、匯出、匯入、暫停、播放、速度、AI狀態、設定、帳號）
- 移除手機版 ⋯ 選單按鈕及下拉選單
- 設定 tab 新增「🎮 遊戲控制」區塊：暫停/繼續、城鎮列表、新地圖
- Header 精簡為只顯示城鎮名稱、人口、時間
- 版號同步：所有檔案統一為 3.1.9

### v3.1.8 (2026-03-11)

**合併日報+日誌為紀錄 Tab — 回到 5×2 整齊排版**
- 合併「🗞️ 日報」和「📝 日誌」為單一「📝 紀錄」tab，內含子 tab 切換
- Sidebar tab 從 11 個（3 行）回到 10 個（5×2 grid），設定不再獨佔一行
- 版號同步：所有檔案統一為 3.1.8

### v3.1.7 (2026-03-11)

**新增設定 Tab + 修復手機 Tab Bar 裁切**
- 新增 ⚙️ 設定 tab：整合帳號登入/登出、AI 語言模型設定、遊戲速度、存檔管理於側邊欄
- 工廠子標籤 icon 改為 🔧（避免與 🏭 產業 tab 重複）
- 修復手機版 tab bar 右側被裁切的問題（CSS specificity 衝突 + 寬度約束）
- 版號同步：WordPress / Chrome Extension / app.js / manifest.json 統一為 3.1.7

### v3.1.6 (2026-03-11)

**手機版 UI 大改版 — Bottom Sheet + 水平 Tab Bar + 移除漢堡按鈕**
- 移除右下角無功能的漢堡 FAB 按鈕（☰）
- 手機版底部面板重新設計：10 個 tab 改為單行水平滾動（原本 5×2 grid 佔太多螢幕空間）
- 新增 Bottom Sheet 收合機制：預設只顯示 tab bar，點擊展開內容面板，再點同一 tab 收合
- 手機版地圖可視範圍大幅提升（底部面板收合時幾乎全螢幕地圖）
- 支援拖拽手柄上滑展開 / 下滑收合
- 版號同步：WordPress / Chrome Extension / manifest.json 統一為 3.1.6

### v3.1.5 (2026-03-10)

**UI 美化 — 職業面板 + 日報卡片化 + 主線任務修復**
- 詳情頁職業選擇區塊美化：3x grid 圖示按鈕 + 目前職業 badge + 辭職按鈕樣式
- AI 日報卡片化：期號/日期/記者分層排版 + 摺疊預覽 + 展開全文
- 修復主線任務第一個任務（落腳邊境）可能卡在鎖定狀態的 bug
- 版號同步：WordPress / Chrome Extension / manifest.json 統一為 3.1.5

### v3.1.4 (2026-03-10)

**RWD 全面修復 — tabs 圖示化 + 成就 tab + 手機人口 + safe-area + 觸控優化**
- WordPress sidebar tabs 加入 emoji 圖示 + tab-icon/tab-label 結構（與 Chrome Extension 一致）
- 移除多餘的農場/工廠 tab（已合併至產業子 tab）
- 新增 ⚔️任務 tab 和 🏆成就 tab
- 手機版 mobile-header 加入獨立人口顯示
- 加入 iPhone safe-area-inset（瀏海/底部 Home Indicator 適配）
- 手機按鈕觸控區域 min-height 提升至 36-40px
- 新增節慶/派系/任務/成就/繁榮度等新組件的 mobile RWD responsive 樣式
- 目前 tab 結構（10 個，5×2 grid）：👥居民 💬聊天 📋詳情 💰經濟 🏭產業 ⚔️任務 🏆成就 📰事件 🗞️日報 📝日誌
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.1.3 (2026-03-10)

**美化事件/成就頁面 + 改善AI日報內容 + 清理導航**
- 美化事件頁面：節慶區塊、任務進度條、派系卡片全面重新設計
- 美化成就頁面：新增分類標籤篩選、成就卡片視覺升級
- 改善 AI 日報 prompt：注入居民關係動態與最近對話精華，產出更生動的報導
- 日報寫作風格升級：場景細節、人物表情、記者個性更鮮明
- 清理多餘的側邊欄導航項目（移除重複的農場/工廠 tab）
- 以上修正同步套用至 WordPress 與 Chrome Extension 版本

### v3.1.2 (2026-03-10)

**修復地圖消失問題（根本原因：.main-layout 寬度被主題 CSS 壓為 0）**
- 修復 `.main-layout` 寬度被 WordPress 主題覆蓋為 0 的問題（加上 width: 100% !important）
- 修復 mobile-header 在桌面版被主題 CSS 覆蓋顯示
- 全面加強 map-panel / canvas / main-layout 的 CSS !important 防護
- 新增地圖初始化 debug logging

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
