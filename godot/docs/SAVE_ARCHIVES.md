# 長期存檔與續玩

「匯出試玩進度」現在輸出 .rimtown 壓縮檔，不刪除聊天、記憶、任務或未知欄位。匯入同時接受新格式與舊 JSON。「匯出進度 JSON 相容版」保留跨版本使用途徑，「匯出原始存檔副本」仍保留原始 JSON 字串。

原本 20 MiB 限制位於 Godot 本機／瀏覽器檔案選擇入口，不是 Vercel 規格。新入口限制檔案及解壓後資料各 64 MiB，以限制解析與重建世界時的記憶體使用。本機匯入不傳送至伺服器；雲端 API 與 Vercel 的資料大小限制未改動。壓縮不等於可以無限大，超過上限會說明並保留當前遊戲。

格式為 RIMTOWN1 magic、8-byte little-endian 原始 UTF-8 長度、32-byte SHA-256 摘要與 gzip 資料。解壓前檢查宣告大小，解壓後驗長度和摘要，再由既有 SaveDocument 解析。檢查失敗不取代目前世界。摘要用於毀損檢測，不是防篡改簽章。

本機寫入使用唯一時間戳／程序編號檔名，先寫 .writing 暫存、flush、讀回比較，成功才更名；現有正式檔或同名暫存檔不覆寫。失敗時顯示錯誤，保留目前進度。這避免將未完成寫入當作正式存檔，不保證硬體故障下的絕對保存。Web 則使用瀏覽器下載機制。

實測使用上一包第 130 天原始進度，選擇傳奇結局後再模擬十天：

| 進度 | JSON bytes | .rimtown bytes |
|---|---:|---:|
| 第 130 天結局前 | 20,896,534 | 1,931,897 |
| 第 140 天結局後 | 21,660,298 | 1,967,498 |

結局統計保持凍結，完整世界狀態、隨機數與續存後下一 tick 一致。第140天結局後.rimtown 為測試產生的續玩檔，不是使用者正式存檔。SAVE_ARCHIVE_TESTS.json、SAVE_ARCHIVE_UI_TESTS.json 驗證格式、原生按鈕／檔案回呼、毀損拒絕、位置與住家保存、原始 JSON；SAVE_BROWSER_ADAPTER_TESTS.json 只驗證實際 JS 在 mock DOM/FileReader 下的位元組傳遞、大小上限及取消，不代表已完成 Web 發行版實機驗收。

測試重現需先跑 test_main_route_progression.gd 產生第 130 天 fixture，再跑 test_save_archive.gd 與 test_save_archive_ui.gd；瀏覽器轉接測試從 repo 根目錄跑 node godot/tools/test_save_browser.mjs。
