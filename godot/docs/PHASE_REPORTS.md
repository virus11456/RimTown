# 階段驗收

## Phase 0 回報
- 完成：PORT_MAP.md、ART_SPEC.md、DECISIONS.md；SOURCE_AUDIT.md 補充完整檔案／方法索引；tools/golden.mjs 與 tests/golden/ 六份快照、manifest。
- 未完成／延後：無 GDScript 模擬（屬 4）；原始碼逐方法語意驗證留待各移植子階段。
- 驗證：兩鎮 × 3 時點 × 2 次獨立 VM；6/6 快照逐位元一致，0 警告。58 頂層存檔鍵；tick=0/576/2784。
- 存檔相容：本階段只有原 JS serialize() 快照，未实现 Godot round-trip，不宣稱跨引擎相容已驗證。
- 待確認決策：D-07 尺寸／D-08 座標缺失／D-10 正式登入驗收；工程預設繼續。
- 下一步：Phase 1 程序資產與展示。

## Phase 1 回報
- 完成：83 個 GLB、單一 palette.png、tools/blender/build_all.py、verify.py、tools/build.sh、scenes/showcase.tscn。
- 未完成／延後：角色五段動畫屬後续可玩版；觀賞版角色靜止。
- 驗證：83/83 資產面數／尺寸／UV／實際面法線通過；兩次重建 geometry SHA256 一致。Godot 4.7.1 實際執行 showcase，截圖 docs/showcase.png。
- 存檔相容：未操作任何存檔；原 golden 檔不變。
- 待確認決策：D-07 以原版 footprint 顯示；83 資產是基礎造型，最終美術由擁有者驗收。
- 下一步：Phase 2 相機、UI 骨架、JSON 保留與 ApiClient。

建置環境：Blender 3.6.23（--factory-startup --gpu-backend opengl）；本機 Blender 4.5.0 無 headless Metal 支援而在初始化崩潰。替代版本僅影響建模工具，不影響 Godot 4.x 引擎。

## Phase 2 回報
- 完成：主場景、四入口 UI、四向相機／8–40 格縮放／滑鼠與觸控、ApiClient、SaveDocument、2,609 原版翻譯 key 的 PO、Noto Sans TC（OFL）。
- 未完成／延後：正式帳號登入及正式同網域 Web 驗收需擁有者自行操作；未取得／建立任何正式憑證。日夜燈光與世界一起於 Phase 3 接入。
- 驗證：本機真實 HTTP server 與 Godot HTTPRequest 端對端 12 次請求；49 個檢查全過，登入→Bearer me→存檔列表→下載→解析 Dictionary 成功。401 清除 session、stale 不視為覆寫、唯讀寫入攔截、兩個 chat lane 均驗證。主場景 headless smoke 成功。
- 存檔相容：6/6 原 JS 快照逐位元 round-trip 相同，未知巢狀欄位／未來版本測試成功；丟失鍵數 0。無 Godot 模擬 tick。
- 待確認決策：D-10 正式登入／部署驗收仍待確認；工程實作先使用本機端對端證據，並非宣稱正式站驗收通過。
- 下一步：Phase 3 格網重建、住宅與地基對照、兩鎮靜態 3D 顯示。
