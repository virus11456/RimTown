# RimTown · Phase 4a 試玩版

在 Phase 0–3 觀賞版上加入時鐘、需求、作息、技能成長、A* 尋路、進出建築與卡住復原。兩鎮範例可直接開啟；預設暫停，按「▶ 開始」就能觀察村民活動。這是分階段試玩版，尚未包含建設、對話、經濟、關係與任務的完整模擬。

不會向雲端寫入世界。「匯出原始存檔副本」保留原始 JSON；「匯出試玩進度」另存已推進的時間、居民與行走狀態。

## 開啟

使用 Godot 4.7.1 匯入本資料夾的 `project.godot`，等待資源匯入後按「執行專案」（macOS ⌘B）。不需要 Blender 或 Node 即可執行。首次匯入字型與模型可能需要一些時間。

- 拖曳移動相機、滾輪縮放、Q／E 或頂端按鈕轉向；手機支援拖曳、雙指縮放與轉向按鈕。
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
GODOT=godot node tools/test_phase2.mjs
godot --headless --path . -- --smoke
BLENDER=blender GODOT=godot bash tools/build.sh
```

Blender 重建同時執行資產驗證。本機驗證使用 Blender 3.6.23；macOS 無 headless Metal 時可加 `BLENDER_FLAGS='--gpu-backend opengl'`。Godot 使用 Compatibility renderer。

如需重新產生來源 golden 與格網 oracle，將此 godot 資料夾放回原始 rimtown 儲存庫中，與 chrome-extension 並列，切換原始碼到基準 `47c44406ffe4ef705b5f8988a47e187e42a73602`，再執行：

```sh
node tools/golden.mjs
node tools/layout_oracle.mjs
node tools/i18n.mjs
node tools/phase4a_oracle.mjs
# 執行 test_playtest.gd 後，可用原版 JS 核對匯出的試玩資料：
node tools/test_js_reload.mjs
```

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

原版存檔不含連續行走座標，初次匯入時依地點／門口放置。Godot 試玩進度另以 `_godot4a` 保留行走與亂數狀態，重新載入可接續；原版會忽略此擴充。模型依原版 footprint 縮放，2×2 小屋資產在地圖上採原版 6×6 範圍。部分裝飾採共用造型（例如噴泉用井、雕像用石碑）。角色有移動、轉向、簡易步行起伏與睡眠姿勢，尚未完成完整五組骨架動畫；無音樂。日夜隨時鐘變化，天氣事件仍維持匯入值，季節渲染會隨換季更新。已匯入原版 2,609 個翻譯鍵，新介面仍以繁體中文為主，未宣稱完整英文在地化。

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
