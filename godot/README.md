# RimTown · 居民想法與社交試玩版

在 Phase 0–3 觀賞版上加入時鐘、需求、作息、技能成長、A* 尋路、進出建築與卡住復原。兩鎮範例可直接開啟；預設暫停，WASD／方向鍵可直接移動旅人，按「▶ 開始」則推進村民作息。這是分階段試玩版，現已加入 NPC 本地規則對話、八卦傳播、每日戀愛／分離、仇怨、派系事件與每日想法更新；尚未包含建設、AI 對話、經濟、婚禮演出及任務模擬。

不會向雲端寫入世界。「匯出原始存檔副本」保留原始 JSON；「匯出試玩進度」另存已推進的時間、居民與行走狀態。

## 開啟

使用 Godot 4.7.1 匯入本資料夾的 `project.godot`，等待資源匯入後按「執行專案」（macOS ⌘B）。不需要 Blender 或 Node 即可執行。首次匯入字型與模型可能需要一些時間。

- **WASD／方向鍵：移動旅人**，方向相對目前相機；對角線與直走同速。撞牆／屋頂／圍籬時會停止或沿牆滑行。
- **找旅人：定位並跟隨**。旅人頭上有「▼ 旅人」標記；拖曳地圖停止跟隨，再按方向鍵恢復跟隨。
- 拖曳平移相機、滾輪縮放、Q／E 或頂端按鈕轉向。世界暫停時仍可移動旅人；旅人速度為每秒 4.5 格，不受 4×／16× 世界加速影響。
- 輸入帳號／密碼、開啟選檔器或切換到其他視窗時，不會誤觸旅人移動。放開按鍵即停止；重新載入保留位置、不重播按鍵。
- 本次旅人移動支援桌面鍵盤；手機仍可操作相機與面板，螢幕方向控制尚未加入。
- 「▶ 開始／Ⅱ 暫停」控制運行；「＋15 分」前進一個模擬 tick 並暫停；速度按鈕切換 1×／4×／16×。1× 每 2 秒推進 15 遊戲分鐘。單步更新作息與目標，持續播放才會走完整段路。
- 「小鎮」可切換兩鎮、匯入 JSON、匯出原始副本或試玩進度。切換／匯入會替換目前試玩狀態並暫停，要保留進度請先匯出。
- 建議第一次按 4×，觀察上工、用餐、下班回家。選「居民」查看目前活動與變化中的需求。
- 「居民」可選人查看資料；「故事」顯示存檔紀錄；「設定」提供登入、雲端存檔讀取與語言切換。
- 桌面匯出路徑會顯示在畫面上；透過 Godot「專案→開啟使用者資料資料夾」亦可找到副本。
- 全部 83 個模型的排列展示位於 `scenes/showcase.tscn`。

## 驗證與重建

以下命令從 godot 資料夾執行；以 GODOT 環境變數指定實際執行檔，或把 godot 放到 PATH。

```sh
godot --headless --editor --import --path .
godot --headless --path . --script res://tests/test_layout.gd
godot --headless --path . --script res://tests/test_view.gd
godot --headless --path . --script res://tests/test_phase4a.gd
godot --headless --path . --script res://tests/test_motion.gd
godot --headless --path . --script res://tests/test_playtest.gd
godot --headless --path . --script res://tests/test_traveler.gd
GODOT=godot node tools/test_phase2.mjs
godot --headless --path . -- --smoke
BLENDER=blender GODOT=godot bash tools/build.sh
```

Blender 重建同時執行資產驗證。本機驗證使用 Blender 3.6.23；macOS 無 headless Metal 時可加 `BLENDER_FLAGS='--gpu-backend opengl'`。Godot 使用 Compatibility renderer。

已同步上游 v5.74.1（4eefc58）。原始六份完整世界 golden 保留 47c4440 基準，作為歷史回歸資料；不以重新產生預期值的方式接受差異。最新來源的 Phase 4a／地圖 oracle 與既有 24 份資料逐位元一致，來源雜湊見 docs/UPSTREAM_SYNC.json。

在完整儲存庫中，從 godot 資料夾驗證最新來源：

```sh
node tools/verify_upstream.mjs
node tools/i18n.mjs
# 執行 test_playtest.gd 後，用最新版 JS 核對匯出的試玩資料：
node tools/test_js_reload.mjs
```

verify_upstream 會重新產生 scoped oracle 並比對原有雜湊；有差異會失敗，需檢查，不應直接接受。若需重建歷史完整世界 golden，請在獨立 checkout 使用 6171e94 的工具和 47c4440 的 chrome-extension 原始碼。

獨立專案包已含 golden、oracle 與全部模型；一般啟動和現有測試不需重新產生來源資料。

## Phase 4a 驗證

- 兩鎮各連續 2,880 ticks（30 個遊戲日）的原版 Agent.update 範圍對照；14 個檢查點核對時鐘、需求、作息、地點、心情、技能與亂數狀態，全過。
- 12 條 A* 路徑與 22 個移動檢查點全過，包含睡眠／清醒卡住復原。Godot Vector2 的浮點誤差實測最大 0.00231 原版像素（約 0.000145 格）；測試容許 0.05 像素。
- 開始／暫停／步進／加速、手機布局、模擬與行走續跑、原始與未知欄位保留共 458 個檢查通過。
- Godot 試玩進度經原版 JS loadSave 再讀取，時鐘、居民數、地點、活動、需求與技能一致。這不代表完整 Phase 4 的經濟／任務等狀態已與原版 30 天 golden 一致。
- 桌面實際運行後截圖 docs/playtest-desktop.png，以及 375×812 docs/playtest-mobile.png。

## 既有觀賞版證據

- 83 個模型通過幾何、UV、面數等驗證；兩次重建幾何雜湊一致。
- 49 個存檔／API／相機檢查通過，HTTP 本機端對端 12 次請求。
- 18 組格網案例，86,400 格與原版 JS 結果一致；房屋、地基及居民初始化位置同時比較。
- 36 個畫面／載入檢查通過；六份 JSON 經顯示後逐位元保持相同。
- Godot 桌面實際渲染兩鎮，以及真正 375×812 SubViewport 截圖。見 docs 中 PNG 與 JSON 報告。

## 驗收界線

目前完成 Phase 4a 的既有存檔運行核心與試玩入口；Phase 4b–4f、5、6 尚未完成。正式站登入／正式使用者存檔、2D 與 3D 人工截圖對照、Safari 觸控與效能、Web 匯出和 `/3d/` 部署未完成驗收。沒有推送 GitHub 或修改正式服務。

原版存檔不含連續行走座標，初次匯入時依地點／門口放置。Godot 試玩進度另以 `_godot4a` 保留行走與亂數狀態，重新載入可接續；原版會忽略此擴充。模型依原版 footprint 縮放，2×2 小屋資產在地圖上採原版 6×6 範圍。部分裝飾採共用造型（例如噴泉用井、雕像用石碑）。角色有移動、轉向、簡易步行起伏與睡眠姿勢，尚未完成完整五組骨架動畫；無音樂。日夜隨時鐘變化，天氣事件仍維持匯入值，季節渲染會隨換季更新。已匯入原版 5,498 個翻譯鍵，新介面仍以繁體中文為主，未宣稱完整英文在地化。

原版沒有保存 Math.random 狀態，首次匯入以固定 11456 啟動試玩亂數；因此不宣稱能還原網頁遊玩中的隨機未來。資源、關係、任務等保留原值，不參與本階段更新；試玩進度用於此階段測試，尚未驗收為完整遊戲回存。

正式帳號請由擁有者在「設定」自行登入；本機 HTTP 契約通過不等於正式站驗收通過。詳細範圍、決策與階段記錄見 docs/PHASE_REPORTS.md 和 docs/DECISIONS.md。

## 字型

Noto Sans TC 來源：https://github.com/google/fonts/tree/main/ofl/notosanstc ，授權為隨附的 assets/fonts/OFL.txt。交付字型由官方可變字型使用 FontTools `instantiateVariableFont(font, {"wght": 450}, inplace=True)` 固定為 450 字重；可使用 `python -m fontTools.varLib.instancer 'NotoSansTC[wght].ttf' wght=450 -o assets/fonts/NotoSansTC.ttf` 重建。

## 自動互動驗收（2026-09-09）

```sh
godot --headless --path . --script res://tests/test_interaction.gd
```

30 項事件驅動測試通過：透過 Control 座標送入滑鼠按下／釋放、鍵盘事件，覆蓋兩鎮切換、居民資料與定位、四入口、相機、檔案選擇器以 Enter 確認、JSON 匯入／匯出及錯誤輸入保留、375px 按鈕點擊。測試使用內嵌檔案視窗，會在 user:// 產生一份範例存檔副本。報告見 docs/INTERACTION_TESTS.json。

這是引擎內事件派送測試；電腦操作工具對 macOS Godot 嵌入視窗的原生點擊只觀察到游標／焦點變化，未能可靠完成操作，因此不列作 OS 滑鼠端對端通過。未測正式登入、Safari 或觸控硬體。

## 旅人操作追加驗收

50 項純碰撞／Godot 鍵盤事件測試全過：30／60／120 fps 同速、四向／對角線、七種阻擋地形、沿牆滑行／角落、地圖邊界、相機旋轉／跟隨、輸入欄位與選檔器抑制、焦點離開、世界加速、手動路線優先、位置續存與邏輯地點同步。458 項既有試玩、34 項 NPC 移動與 36 項畫面回歸測試通過。原 API 與原版 JS 未修改。

原版鍵盤對角線會比較快；此 3D 控制先正規化方向，維持每秒 4.5 格。視角相對方向與獨立於世界加速的旅人速度是本次操作選擇。碰撞保留原版 72 px/s、4 px 地圖邊界、逐軸滑行及阻擋格定義。

## 上游 v5.74.1 同步

GitHub 17 筆更新已合併進本機 codex/godot-viewer。新增推薦碼 register(invite)、chat(lang) 和 set_settings(dialogue_lang) 契約；省略設定語言時不覆寫既有偏好。這些是 API 能力，尚未新增註冊或 AI 對話介面。55 項 API／存檔／相機測試、16 次本機 HTTP 請求通過；既有旅人、試玩、畫面、地圖、模擬與 JS 讀回測試通過。

新版網頁的登入首頁、AI 語言生成／人名對照、載入時清理 AI 台詞及簡轉繁已在原始 JS 合併，但未全部移植成 Godot 功能。Godot 匯入與原始副本仍保留原文；試玩進度送回新版網頁時會接受網頁既有清理。Godot 新介面尚未完整英文化，完整 World.tick 的 30 天對照仍屬歷史基準。此次未推送 GitHub 或部署。

## Phase 4b 首批：記憶與關係

「居民」→選一人→「近期記憶」或「人際關係」。近期頁顯示最後 20 則；關係頁顯示居民對各人的好感、信任、戀慕與互動次數，並可檢索相關記憶或查看對方。空紀錄會顯示提示。兩鎮均可讀取；想看較多既有故事，可匯入 tests/golden/frontier-day-07.json。

SimMemory 提供容量、近期／人物／重要記憶／反思篩選、原版加權檢索（含 JS UTF-16 bigram）；SimRelationships 提供分類、限幅、互動／共同記憶、朋友與伴侶查詢。這些是純 RefCounted 資料層，未知欄位及原始存檔保留。尚未啟用 NPC 自動閒聊、婚戀或派系／八卦；此版本的操作是查看既有社交紀錄，不會新增關係變動，並非整個 Phase 4b 完成。

```sh
node tools/social_oracle.mjs
godot --headless --path . --script res://tests/test_social.gd
```

88 組記憶檢索、44 組關係邊界、修改／管理集合與居民頁面合計 695 項檢查通過。介面測試透過按鈕訊號觸發，非 OS 點擊端對端；另已實際渲染桌面及 375×812 截圖（docs/social-desktop.png、social-mobile.png）。458 項試玩、50 項旅人、36 項畫面回歸通過。

旅人動畫仍為簡易版本。後續統一調整左右手腳交替、步幅與每秒 4.5 格速度匹配、停走過渡，以及 work／sleep／talk 姿勢；本次未更改動畫。

## Phase 4b 第二批：NPC 自動社交

按「開始」讓世界運行。NPC 在邏輯地點相同、清醒且符合社交作息／6 tick 冷卻時選擇對象；權重取決於好感與戀慕。沿用原版性格台詞，更新雙方好感、戀慕、互動次數和記憶。好友可能邀約至另一地點；尚未實作告白／結婚事件。對話判定依原版邏輯地點，並非 3D 角色實際距離。

「故事 → 村民對話紀錄」顯示最近 10 段完整對話（隨 tick 更新）；「居民」可追蹤記憶與關係變化。「設定 → NPC 本地社交」可開關新社交，已排定邀約仍按既有作息處理。新匯入預設開啟，匯出進度保留開關、冷卻、邀約與亂數狀態；原始副本仍逐位元保留。

這一批完全離線，不需要 Vercel 或 AI 額度。ApiClient 仍只會在使用者操作登入／雲端讀取時使用服務；正式 AI 對話與正式存檔驗收留待後續。八卦傳播、每日新聞收集、觀星社交、婚戀事件及其他 World.tick 子系統仍未啟用；此處只有 socializing 觸發及完整本地對話效果，並非全 Phase 4b 完成。

原版 3 個台詞函式以 tools/build_dialogue.mjs 轉成原生 GDScript（29 組話題函式），包含台詞與條件，不依賴遊戲執行期 JavaScript。產生器限定這三個函式使用的語法，遇不支援語法會停止；使用 Node 24.19.0 內附 Acorn。來源 SHA256 嵌入生成檔，不能手改生成的 sim_dialogue.gd。

```sh
node tools/build_dialogue.mjs
node tools/npc_oracle.mjs
node tools/npc_sim_oracle.mjs
godot --headless --path . --script res://tests/test_dialogue.gd
godot --headless --path . --script res://tests/test_npc_sim.gd
godot --headless --path . --script res://tests/test_npc_ui.gd
node tools/test_social_reload.mjs
```

- 320 組完整台詞／亂數案例，640 項通過。
- 兩鎮各 2,880 ticks，14 個檢查點共 2,949 項通過：核心狀態、關係、冷卻、邀約、記憶全文雜湊、全部對話行雜湊及社交日誌。JS oracle 關閉未移植的八卦、每日新聞、反思／足跡等；只比較社交日誌，排除 loadSave 的讀取成功提示與技能升級日誌。完整 World.tick golden 仍未驗收。
- 118 項社交開關／續存／對話頁面／375px 布局通過。匯出後原版 JS 讀回 126 段對話，108 項檢查通過。網頁引擎不執行 Godot 的亂數／模式擴充，也不還原其本身未保存的邀約，因此只保證所測欄位相容。
- 既有 4a、695 項社交基礎、458 項試玩、50 項旅人和36項畫面回歸通過。Phase 4a preservation 測試明確關閉社交；開啟模式由本批 oracle 與 UI 測試覆蓋。
- 桌面與 375×812 GPU 截圖已檢視（docs/npc-desktop.png、npc-mobile.png）。動畫本次未更改。

## Phase 4b 第三批：八卦傳播與對質

「開始」後，NPC 社交有機會轉述已載入的八卦；「故事 → 八卦與鎮民動態」可查看來源、轉述次數、被誇大標記及鎮民貼文。「設定」提供獨立八卦開關，必須同時開啟 NPC 本地社交才會傳播。開關與傳聞的 _mutated／_confronted 標記均隨試玩進度保存；初次匯入沒有設定時預設開啟。

遵循原版：不向八卦當事人直接轉述；八卦性格較容易傳話；第二手之後可能誇大一次；第四手觸發一次當事人回應。負面 NPC 消息來源可能被對質並降低雙方好感，當事人會發文；玩家作為消息來源時，會有稱讚／毀謗的好感、信任、想法與訊息效果；紅娘傳聞依雙方伴侶狀態可能增加戀慕。

SimGossip 的一般／關係／玩家來源建立方法已依原版移植並測試，但本次未加入玩家放話按鈕，也未啟用產生新婚戀事件的系統。正常遊玩目前傳播載入存檔的既有傳聞，並不新增任意頻率的造謠事件。每日新聞收集、完整 TownFeed 的其他互動、婚戀／派系、AI 對話與正式服務仍待後續。TownFeed 對質發文保留原版 120 篇執行期上限／80 篇序列化上限；未知欄位保留。

```sh
node tools/gossip_oracle.mjs
node tools/npc_sim_oracle.mjs --gossip
godot --headless --path . --script res://tests/test_gossip.gd
godot --headless --path . --script res://tests/test_npc_sim.gd -- --gossip
godot --headless --path . --script res://tests/test_gossip_ui.gd
node tools/test_gossip_reload.mjs
```

- 104 組原版八卦情境，1,768 項通過：建立、傳播、誇大、對質、玩家來源、紅娘及鎮民動態。
- 兩鎮各 2,880 ticks 的社交＋八卦限定對照，2,977 項通過。原版 oracle 明確保留 gossip.spreadGossip；每日新聞與其他尚未移植子系統仍停用，不宣稱完整 World.tick golden。
- 八卦開關、第四手續跑、未知欄位及手機頁面 33 項通過；原版 JS 讀回 68 項通過。既有 NPC 社交、操作及畫面回歸通過。
- 桌面／375×812 的對質測試情境截圖已檢視（docs/gossip-desktop.png、gossip-mobile.png）。這是固定测试情境，非正常一天內必定發生的劇情。重建截圖先執行 test_gossip_ui.gd，再使用 capture_gossip.flag；正式試玩包不含旗標或臨時測試存檔。
- 本次無 Vercel 呼叫、無 AI 額度使用、無部署。旅人動畫保持現狀。


## Phase 4b 第四批：每日關係事件

每天午夜、居民更新之前處理關係：疏遠衰退、日久生情、心動回應、單戀嫉妒、情敵與個性摩擦、交往、結婚、秘密關係、劈腿發現、分手與離婚。沿用上游 v5.74.1 的門檻、機率、配對順序、文字與亂數消耗；事件更新雙向關係、記憶、想法、心情與傳聞。婚禮記錄是事件文字，目前没有角色婚禮演出。

「故事 → 關係事件」查看最新 30 則關係事件；「居民 → 人際關係／近期記憶」查看結果。「設定 → 每日關係事件」可單獨開關，初次匯入預設開啟。關閉八卦傳播只停止轉述；關係事件仍會產生傳聞。要停用每日關係變化請關閉每日關係事件；聊天的好感效果另由 NPC 本地社交控制。

`_godot4a.romance_enabled` 保存模式；Godot 同時保存心情修正與一次性情敵傳聞旗標。新增 `relationship_precision`，只對 JSON 解析會偏移的好感／信任／心動值保存 double 位元與可見值校驗，避免續跑跨過數值門檻。外部修改普通數值時不套用舊精度補充。原版 JS 不使用此擴充，也不還原其原本未序列化的 `_rivalGossiped`；跨引擎只保證已測的存檔欄位讀回。

```sh
node tools/romance_oracle.mjs
node tools/npc_sim_oracle.mjs --romance
"$GODOT" --headless --path . --script tests/test_romance.gd
"$GODOT" --headless --path . --script tests/test_npc_sim.gd -- --romance
"$GODOT" --headless --path . --script tests/test_romance_ui.gd
node tools/test_romance_reload.mjs
```

- 360 組原版情境、7,008 項檢查：涵蓋七種事件想法、秘密關係、衰退、玩家排除、缺失對象與續跑。
- 兩鎮各 2,880 ticks、3,495 項限定社交＋八卦＋每日關係對照與續跑通過。
- 午夜判定／模式／375px 頁面／精確數值續存 43 項；原版 JS 讀回婚姻、婚禮記憶／想法／傳聞 66 項通過。
- 既有社交 2,949、社交＋八卦 2,977、台詞 640、八卦 1,768、社交基礎 695、NPC UI 118、八卦 UI 33、試玩 458、旅人 50、畫面 36 項回歸通過。

桌面與 375px GPU 截圖 `docs/romance-*.png` 使用刻意設定成熟感情後，從午夜判定產生的婚禮測試情境；不代表自然遊玩一定在該日結婚。AI 劇情、每日新聞、NPC 事件鏈回呼、派系及其他尚未移植 World.tick 子系統明確排除，完整 Phase 4b 尚未完成。本次不需要 Vercel；未推送 GitHub、未部署。


## Phase 4b 第五批：絕交、爭吵與旁觀選邊

每天換日、戀愛事件後執行 `World._processFeuds` 的本地規則。双方好感均 ≤ -60 時正式絕交並留下記憶與心情效果；双方均 ≤ -35 時有機會公開爭吵，好感下降，旁觀者可能替朋友抱不平並記住事件。遵循原版，並未按 3D 距離挑選旁觀者；新聞與 AI 劇情演出尚未接入。

「故事 → 關係事件」同時显示戀愛、絕交和爭吵；「居民 → 人際關係」增加「已絕交」標記，近期記憶可看到旁觀者立場。「設定 → 每日仇怨事件」獨立開關，初次匯入預設開啟。關閉後保留已存在的記憶與標記。`_godot4a.feuds_enabled` 保存模式，原版的 `feudCooldown` 和 `isFeud` 保存冷卻／絕交狀態。

原版冷卻使用 `clock.day + (year - 1) * 60`，未計入季節；因此跨季節不保證剛好五天即可再次爭吵。此批沿用並以跨季／跨年情境驗證，未另改規則。原版不序列化活躍角色的 isDead；死亡排除單元情境明確注入執行期狀態。

```sh
node tools/feuds_oracle.mjs
node tools/npc_sim_oracle.mjs --feuds
"$GODOT" --headless --path . --script tests/test_feuds.gd
"$GODOT" --headless --path . --script tests/test_npc_sim.gd -- --feuds
"$GODOT" --headless --path . --script tests/test_feuds_ui.gd
node tools/test_feuds_reload.mjs
```

- 192 組原版情境、21,312 項檢查通過：雙向門檻、缺失反向關係、玩家／死亡排除、冷卻邊界、季節／年份切換、旁觀者立場與續存。
- 兩鎮各 2,880 ticks，3,509 項社交＋八卦＋戀愛＋仇怨限定整合對照與續存通過。
- UI 22 項；原版 JS 讀回絕交、冷卻、記憶與事件日誌 66 項通過。未知關係欄位由 Godot 保留，原版 JS 仍依自身載入規則忽略。
- 既有戀愛 7,008、戀愛整合 3,495、社交＋八卦 2,977、社交 2,949、戀愛 UI 43、八卦 UI 33、NPC UI 118、試玩 458、旅人 50、畫面 36、社交基礎 695 項回歸通過。

`docs/feuds-*.png` 是刻意準備敵對關係後，由每日規則觸發爭吵／絕交的實際 GPU 畫面，已檢查桌面與 375px 寬度。沒有加入肢體爭吵動畫或玩家勸和操作。派系組成／結盟／衝突為下一批，完整 Phase 4b 及 World.tick 仍未驗收；不需要 Vercel，本次未推送或部署。


## Phase 4b 第六批：派系與吵架對話框

`SimFactions` 接入原版三日檢查：八種派系形成（同職業、酒友、八卦圈、學者、戀愛同盟、搗蛋鬼、長者與夜貓族）、每人最多兩個新派系、同型合併、凝聚力、退出、結盟、跨派系爭執、內部衝突及人數不足解散。保留原版更新順序及重疊成員的效果計算，派系衝突會加入 conversationTopics，內部衝突產生傳聞。

「故事 → 居民派系」查看成員、凝聚力、盟友、對立與近期事件。「設定 → 居民派系」獨立開關；初次匯入預設啟用。`factions` 原版欄位與三日計數器照常保存，`_godot4a.factions_enabled` 保存 Godot 模式。關閉模式也暫停三日計數器。

使用者要求以頭上對話框呈現爭吵，已加入淡底紅邊、姓名與短句的對話框，套用公開爭吵、絕交、派系爭執與內部衝突。框隨角色及相機移動，優先左右避讓，避開頂部／底部操作区；六秒實際時間後消失，世界加速不縮短閱讀時間，暫停仍會消失。離開畫面或空間不足時隱藏；不攔截滑鼠、不同步重播舊存檔事件。台詞為固定表現用短句，不使用 AI、不写入對話／記憶、不消耗模擬亂數。跨派系事件選兩名有效且不同的成員作畫面代表；未增加集合走位或肢體動作。

```sh
node tools/factions_oracle.mjs
node tools/npc_sim_oracle.mjs --factions
"$GODOT" --headless --path . --script tests/test_factions.gd
"$GODOT" --headless --path . --script tests/test_npc_sim.gd -- --factions
"$GODOT" --headless --path . --script tests/test_factions_ui.gd
node tools/test_factions_reload.mjs
```

- 96 組原版情境、6,624 項通過，八種派系均覆蓋，包含組成、合併、凝聚力、退出／解散、結盟／衝突與續跑。
- 兩鎮各 2,880 ticks 的社交／八卦／戀愛／仇怨／派系限定整合對照與續跑 3,537 項通過。其他 World.tick 子系統仍明確排除。
- UI／三日模式續存／對話框 29 項通過；原版 JS 讀回 68 項通過。
- 既有仇怨 21,312、戀愛 7,008、四種舊整合模式、各 UI／旅人／試玩／畫面回歸通過。

`docs/factions-*.png` 與 `docs/dispute-*.png` 是實際 Godot GPU 渲染，桌面與 375px 均已檢視。對話框截圖以固定站位清楚示範，仍由新爭吵事件觸發，不代表自動集合走位。派系表與效果已移植；完整 Phase 4b、AI 演出、玩家對話／勸和、經濟／任務尚未全部完成。此批無需 Vercel、未推送 GitHub／部署。


## Phase 4b 第七批：每日想法更新與查閱

換日依序處理戀愛、仇怨、派系後，執行原版 `World._processThoughts`：先清除 `today - start >= days` 的想法，再將有效想法的 opinion 套用到已存在的目標關係。不同想法可以累加；不會替缺失的關係新建關係，玩家與死亡角色不處理。此步不消耗亂數。新生成的想法也按原版順序參與當天更新。

「居民 → 選人 → 目前想法」顯示心情、想法標籤、剩餘天數、當前心情影響，以及對某人的每日好感變化。心情影響沿用既有按天淡化公式；每日好感變化不淡化，直到到期。頁面隨時間更新且維持所選居民。「設定 → 每日想法更新」可獨立開關，新匯入預設開啟，以 `_godot4a.thoughts_enabled` 保存。停用只停止清理與每日好感變化，心情淡化仍持續；重新啟用後不追補關閉期間的好感。

```sh
node tools/thoughts_oracle.mjs
node tools/npc_sim_oracle.mjs --thoughts
"$GODOT" --headless --path . --script tests/test_thoughts.gd
"$GODOT" --headless --path . --script tests/test_npc_sim.gd -- --thoughts
"$GODOT" --headless --path . --script tests/test_thoughts_ui.gd
node tools/test_thoughts_reload.mjs
```

- 15 組原版想法情境、931 項通過：到期日、疊加、缺失關係／人物、無目標、空想法、玩家／死亡排除、上下限、未來起日、跨季／跨年與續存。
- 兩鎮各 2,880 ticks 的社交／八卦／戀愛／仇怨／派系／每日想法限定整合對照與續跑 3,537 項通過。
- UI、午夜判定、模式續存、原始／未知欄位與 375px 布局 23 項；原版 JS 讀回 68 項通過。
- 舊派系與仇怨整合模式、派系／吵架對話框／仇怨／戀愛／社交 UI、旅人、試玩、畫面與社交基礎回歸通過。

`docs/thoughts-*.png` 使用人工準備的想法效果情境，並經實際 GPU 桌面與 375px 檢視。本批只完善現有想法的後續效果與查閱，不代表完整日常想法生成、AI 對話或完整 World.tick 移植完成。旅人及吵架對話框保留，正式 API 未使用、未推送／部署。
