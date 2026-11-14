# 事件追蹤板（離線原型）

把 RimTown 鎮上「持續進行的一件事」整理成一條事件：誰發起、問了誰、誰答應、誰真的去了、結果與後續。不用逐一翻村民日誌。

這是觀察工具的原型，不是遊戲的一部分。正式站沒有載入它。設計與限制見 [DESIGN_EVENT_BOARD.md](../../DESIGN_EVENT_BOARD.md)。

## 打開

用瀏覽器直接打開 `tools/event-board/index.html`（檔案路徑即可，不用開伺服器，也不會連網）。

右上角「資料來源」可以切換：

| 標示 | 意思 |
|---|---|
| 真實遊戲紀錄 | 固定種子建一座城、照原本的遊戲跑出來的。沒有人為介入 |
| 測試場景 | 起始條件是人為設定的（例如指定某行的工資被壓、某人手頭很緊），之後的過程由真實遊戲程式跑出。用來穩定重現特定分支 |
| 展示資料 | 手寫的。目前沒有附任何展示資料 |

## 怎麼用

- 左邊是事件清單。預設只列多人的事（工資爭議、工會組織、抗議集合）；打架、守衛各自是單一事件，點上方的種類可以看。
- 點一件事，右邊依序是：
  - 摘要：發生什麼、在哪裡、進行到哪一步、結果。走過的步驟亮起來，沒發生的步驟劃掉。
  - 參與的人：被問到、回答、實際行動、結果四欄分開。
  - 現場：有現場的事（抗議集合）可以拖時間軸或按「重看」，看每個時間點誰在哪裡。沒有現場的事會直接說明。
  - 時間線：每一筆都標來源，點「來源」看原始紀錄。同一天很多人回答一樣時合併成一列，點開看名單。
  - 錢與制度的變化、還沒了結的事。
- 點任何人的名字：只看這個人。上方會多一張表，列出他在所有事件裡的先後；清單只剩他參與的事；地圖上他會變成橘色。再點一次取消。

## 自己錄一段

```sh
python3 -m http.server 8126 -d chrome-extension &       # 本機服務遊戲檔案
node scripts/watch_record.js record 240 3 7              # 天數、城鎮等級、種子；輸出到 tools/event-board/data/
node scripts/watch_test.js --no-compare                  # 重新產生測試場景，並更新 data/manifest.js
```

全程 AI 關閉、不連線。遊戲本身會嘗試呼叫 `/api/chat`（日報等功能），這些請求都在本機攔下。

## 資料格式（`data/*.js`）

每個檔案往 `window.RIMTOWN_EVENT_DATA` 推一筆：

```
{ format, source, meta: { app, town, from, to, ai, label, ... },
  map: [{ id, name, x, y }],
  threads: [{ id, type, title, place, status, stage, outcome, opened, closed,
              people: [{ id, name, roles, asked[], answered[], acted[], result[] }],
              timeline: [{ d, tick, time, kind, text, why, whySrc, res, src }],
              resources[], open[], scene: { place, who[], sides, frames[] } }] }
```

`src.type` 只有三種：`log`（遊戲日誌原句）、`decision`（決策核心的紀錄）、`state`（讀到的遊戲狀態）。
