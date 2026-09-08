# 階段驗收

## Phase 0 回報
- 完成：PORT_MAP.md、ART_SPEC.md、DECISIONS.md；SOURCE_AUDIT.md 補充完整檔案／方法索引；tools/golden.mjs 與 tests/golden/ 六份快照、manifest。
- 未完成／延後：無 GDScript 模擬（屬 4）；原始碼逐方法語意驗證留待各移植子階段。
- 驗證：兩鎮 × 3 時點 × 2 次獨立 VM；6/6 快照逐位元一致，0 警告。58 頂層存檔鍵；tick=0/576/2784。
- 存檔相容：本階段只有原 JS serialize() 快照，未实现 Godot round-trip，不宣稱跨引擎相容已驗證。
- 待確認決策：D-07 尺寸／D-08 座標缺失／D-10 正式登入驗收；工程預設繼續。
- 下一步：Phase 1 程序資產與展示。
