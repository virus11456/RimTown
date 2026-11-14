# 本地 D1 修訂驗證

來源：GitHub RimTown commit b3a004047029bda9b0971deed5f2a20adb1c675e。此資料夾只包含必要檔案，不是完整 git checkout；未包含第三輪本機追溯資料。`.baseline` 為四份修改檔的原版，`changes.patch` 為差異，`SHA256SUMS` 為檔案雜湊。

本地執行：`/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/psy_d1_unit_test.js`（Node v24.22.1）：140 passed, 0 failed；輸出見 `unit-test-result.txt`。後續另依下列設定執行瀏覽器影子長跑；舊長跑結果不可視為此修訂的結果。沒有呼叫線上 AI。

玩家可見健康消息目前一律不提供；角色本人記憶仍可檢索。要支援可證明已收到的消息，需新增遊戲側接收者證據與讀取接口，這輪未修改遊戲。撤回狀態記為 withdrawn，確認後再次提出未評估方案記為 pending；沒有自動循環或選擇。

## 瀏覽器影子長跑（本地修訂）

- 30 天、種子 22、等級 2：57 passed、0 failed；AI 關閉組 24 次執行皆有快照，固定回覆的 AI 開啟組 3 次執行皆有快照或去重紀錄。
- 90 天、種子 7、等級 3：57 passed、0 failed；AI 關閉組 150 次執行皆有快照；固定回覆的 AI 開啟組 148 次執行皆有快照或去重紀錄，225 份快照中 77 份為新版本，略過 56 次。
- 各組各跑「關、關、開」：存檔（排除 savedAt）、可見決策狀態、列出與執行順序、種子亂數取用次數及 tick 比對相同。私有等待名單未直接比對；渲染畫面和渲染亂數不在比較範圍。
- 使用 Node v24.22.1、Playwright 1.57.0、本機 Google Chrome。沙箱不允許監聽埠，因此 `scripts/psy_d1_shadow_local_test.js` 是獨立測試副本，透過 Playwright route 直接提供本機檔案；所有外部請求中止，遊戲 API 以本機固定資料回應。AI 開啟組是本機固定且延遲的回覆，並非真實 AI。
- 遊戲 JS、CSS、HTML、JSON、SVG 及未修改的 D1 測試必要檔案均與 b3a0040 的 Git blob 核對；不含二進位圖像，缺少的檔案回 404；本資料夾不是完整 checkout。人工記錄的結論以原始摘要 `test-results/shadow_30/shadow_summary.json`、`test-results/shadow_90/shadow_summary.json` 為準。
- 環境控制包括清除遊戲既有殘留住房對照、固定時鐘和種子；不能推論所有種子、真實 AI 時序或私有佇列均一致。
- 一天短測因未發生借錢與延遲回覆，覆蓋斷言 7 項失敗，不能作為驗收；其餘開關比對通過。
