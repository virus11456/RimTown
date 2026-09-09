# RimTown · 立體小鎮觀賞版

Phase 0–3 觀賞版原型：讀取 RimTown JSON，以低多邊形 3D 顯示邊境鎮與海風鎮。包含兩鎮第 1／7／30 天範例，啟動預設載入邊境鎮。此版本不推進模擬、不向雲端儲存世界；匯出會保留匯入 JSON 原始內容。

## 開啟

使用 Godot 4.7.1 匯入本資料夾的 `project.godot`，等待資源匯入後按「執行專案」（macOS ⌘B）。不需要 Blender 或 Node 即可執行。首次匯入字型與模型可能需要一些時間。

- 拖曳移動相機、滾輪縮放、Q／E 或頂端按鈕轉向；手機支援拖曳、雙指縮放與轉向按鈕。
- 「小鎮」可切換兩個範例、匯入 JSON、匯出原始副本。
- 「居民」可選人查看資料；「故事」顯示存檔紀錄；「設定」提供登入、雲端存檔讀取與語言切換。
- 桌面匯出路徑會顯示在畫面上；透過 Godot「專案→開啟使用者資料資料夾」亦可找到副本。
- 全部 83 個模型的排列展示位於 `scenes/showcase.tscn`。

## 驗證與重建

以下命令從 godot 資料夾執行；以 GODOT 環境變數指定實際執行檔，或把 godot 放到 PATH。

```sh
godot --headless --editor --import --path .
godot --headless --path . --script res://tests/test_layout.gd
godot --headless --path . --script res://tests/test_view.gd
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
```

獨立專案包已含 golden、oracle 與全部模型；一般啟動和現有測試不需重新產生來源資料。

## 已取得的證據

- 83 個模型通過幾何、UV、面數等驗證；兩次重建幾何雜湊一致。
- 49 個存檔／API／相機檢查通過，HTTP 本機端對端 12 次請求。
- 18 組格網案例，86,400 格與原版 JS 結果一致；房屋、地基及居民初始化位置同時比較。
- 36 個畫面／載入檢查通過；六份 JSON 經顯示後逐位元保持相同。
- Godot 桌面實際渲染兩鎮，以及真正 375×812 SubViewport 截圖。見 docs 中 PNG 與 JSON 報告。

## 驗收界線

這是待擁有者驗收的觀賞版原型，尚未開始 Phase 4–6。正式站登入／正式使用者存檔、2D 與 3D 人工截圖對照、Safari 觸控與效能、Web 匯出和 `/3d/` 部署未完成驗收。沒有推送 GitHub 或修改正式服務。

原存檔不含連續行走座標，因此居民依原版重新載入時的地點／門口放置；不能對齊任意遊玩中的移動瞬間。模型依原版 footprint 縮放，2×2 小屋資產在地圖上採原版 6×6 範圍。部分裝飾採共用造型（例如噴泉用井、雕像用石碑）。角色靜止、無音樂；日夜與天氣反映存檔而不自行推進。已匯入原版 2,609 個翻譯鍵，新介面仍以繁體中文為主，未宣稱完整英文在地化。

正式帳號請由擁有者在「設定」自行登入；本機 HTTP 契約通過不等於正式站驗收通過。詳細範圍、決策與階段記錄見 docs/PHASE_REPORTS.md 和 docs/DECISIONS.md。

## 字型

Noto Sans TC 來源：https://github.com/google/fonts/tree/main/ofl/notosanstc ，授權為隨附的 assets/fonts/OFL.txt。交付字型由官方可變字型使用 FontTools `instantiateVariableFont(font, {"wght": 450}, inplace=True)` 固定為 450 字重；可使用 `python -m fontTools.varLib.instancer 'NotoSansTC[wght].ttf' wght=450 -o assets/fonts/NotoSansTC.ttf` 重建。
