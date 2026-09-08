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
