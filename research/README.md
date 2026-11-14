# 借錢情境的小批研究

研究接口是獨立的 Node 工具，不載入遊戲、不執行角色行動。這不是 D2。

目前有三種回應來源，每筆紀錄都標明是哪一種，不能混用：

| 來源標記 | 是什麼 | 有沒有網路 | 帳本 |
|---|---|---|---|
| `TEST_FIXTURE_HANDWRITTEN` | 手寫固定回應（`scripts/psy_research.js`） | 無 | 模擬帳本 `test-results/loan-research-fixture/budget.json`（micro-USD） |
| `FAKE_PROVIDER_FORMAT` | 本機產生、Anthropic Messages API 格式的假回應，走真的 SDK 路徑（離線演練與測試用） | 無（注入的 fetch） | `test-results/loan-research-fake-provider/<batchId>/ledger.json` |
| `LIVE_ANTHROPIC` | 真實 Anthropic API 回應 | 有，**預設關閉** | `test-results/loan-research-live/<batchId>/ledger.json`（nano-USD） |
| `REPLAY_LIVE_RECORDING` | 重播上面兩種供應商格式的錄製結果 | 無 | 不記帳、不寫任何帳本 |

手寫回應和假回應的通過，只代表流程可以運作，不是人物心理成果，也不是正式後備。

---

## 配對資料（`loan-pairs.json`）

人工建立的小世界快照，共四份，每份重複三次。人物、現金 50、借款請求 30、選項和好感等設定都相同。

| 版本 | 唯一改動 | 連帶資料 |
|---|---|---|
| baseline | 無 | 無 |
| repaid_memory | 本人記得阿華曾依約還款 | 記憶來源編號、知識版本 |
| known_expense | 本人已確認孩子明天看病由自己付 40 | 支出、確定算術、狀態版本 |
| stated_purpose | 阿華親口說要修屋頂 | 本人聽到的說法、知識版本 |

- 醫療日期與付款安排是明確建立的研究事實，不是從遊戲健康表讀來的。
- 沒有設定正確動作，也不要求角色因為某個版本改變選擇。
- 送給評估器的只有輸入和契約說明，沒有版本名稱、配對目的、重複序號、稽核紀錄或期望答案。

---

## 研究設定（`anthropic-research.json`）

| 項目 | 設定 | 依據（2026-11-14 核對官方文件） |
|---|---|---|
| 供應商與入口 | Anthropic 官方 API，`https://api.anthropic.com`，只呼叫 `/v1/messages` | 不經正式站 `/api/chat` |
| 模型 | `claude-sonnet-5-5` | 模型總覽：Claude API ID 與別名相同，無日期後綴 |
| SDK | `@anthropic-ai/sdk` 1.8.0，裝在 `research/`（網站建置只複製 `chrome-extension/`，不含它） | 1.0.0 起預設送 `anthropic-version: 2026-10-21`；實測 1.8.0 送的就是這個版本 |
| 驗證 | 金鑰只從環境變數 `RIMTOWN_RESEARCH_API_KEY` 讀，以 `Authorization: Bearer` 送出 | 驗證文件。程式明確傳入金鑰，SDK 就不會再讀 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN` 或磁碟上的設定檔 |
| Workspace | 金鑰若未綁定 workspace，填研究 workspace ID（環境變數 `RIMTOWN_RESEARCH_WORKSPACE_ID`，或設定檔 `credentials.workspaceId`），送 `anthropic-workspace-id` | 驗證文件：未綁定的金鑰不帶這個 header 會回 400 |
| 預算 | 整批 US$5、最多 60 次請求、同時最多 1 個請求 | 使用者指定 |
| 輸出上限 | `max_tokens` 4096 | thinking token 計入 `max_tokens`，以輸出計費 |
| 重試、換模型、快取 | SDK `maxRetries: 0`；不送 `fallbacks`；不用評估結果快取；不送 `cache_control` | 使用者指定；錯誤文件：SDK 預設會自動重試 2 次 |
| 推理設定 | 全部不送，採官方預設：adaptive thinking、effort `high`、`display: omitted` | 模型總覽與 thinking 文件 |
| temperature／top_p／top_k | 不送 | API 2026-10-21 起送了就回 400；Sonnet 5.5 原本也不接受非預設值 |
| seed | 不適用 | Messages API 沒有這個參數 |
| 逾時 | SDK 單次 120 秒；研究核心每階段 150 秒（遊戲原本的 2 秒逾時沒改，只在研究呼叫時另外傳入） | 錯誤文件：非串流請求的 SDK 上限是 10 分鐘；4096 token 不需串流 |

`providerSettings` 必須是空的。放進任何設定（例如 temperature）都會讓線上模式被擋，不會被靜默丟掉。

### 費率（`pricing`，單位 nano-USD／token）

來源：<https://platform.claude.com/docs/en/about-claude/pricing>（2026-11-14）

| 計費項目 | 每百萬 token | 程式內數值 |
|---|---|---|
| 基本輸入 | $2 | 2000 |
| 輸出（含 thinking token，即使 thinking 內容沒回傳） | $10 | 10000 |
| 5 分鐘快取寫入 | $2.50 | 2500 |
| 1 小時快取寫入 | $4 | 4000 |
| 快取讀取 | $0.10 | 100 |
| `inference_geo: "us"` | 以上全部 ×1.1 | `[11, 10]` |

- 1M context 全程同價，沒有長文加價。
- 沒有用工具、伺服器工具、批次、fast mode。萬一回應的 usage 出現網路搜尋、fast mode 或 priority，就記為 `unexpected_billing` 並鎖住帳本。
- 未指定 `inference_geo` 時，用 workspace 的預設地區，程式事前不知道是哪一區，所以一律用 ×1.1 預留。

---

## 預算入口

appraisal、choice、supplement、confirmation 四個階段都經過同一個 `createEvaluator` → `budget.reserve` → `transport.send` → `budget.settle`。補評估、確認、失敗的嘗試，以及將來若授權的重試，都算進同一份額度。

**送出前預留最大成本**
- 輸入上限＝請求本文的 UTF-8 位元組數＋2048，用最高的輸入單價（1 小時快取寫入 $4）計算。
- 輸出上限＝4096，含 thinking。
- 兩者合計再 ×1.1。
- 預留額度不夠，或已經有一個請求還沒結算，就不送出；傳送函式完全不會被呼叫。

目前四份配對資料的單次預留約 US$0.071～0.076。60 次全部按上限扣，也只有約 US$4.6。

**結算**
- 有完整 usage：照實際用量計，退回差額。
- usage 缺漏、逾時、限流、伺服器錯誤、網路錯誤、程序崩潰：保留整筆預留，不假設沒收費。
- 實際用量超過預留：記帳並鎖住帳本，之後不再送。

**跨程序**
- 帳本以原子替換寫入，同一批次重啟後沿用累積支出與請求次數。
- 崩潰時還沒結算的預留，重新載入後標成 `interrupted_reserved`，照樣計費。
- 同一批次用獨占鎖（`batch.lock`）。第二個程序直接拒絕，不會重複使用額度。
- 鎖若因崩潰殘留，要人工確認沒有其他程序在跑，再刪除。不要改批次名稱來繞過上限：改了上限或費率，舊帳本就載入失敗，不會被重設。

**輸入上限還不是官方保證**

官方文件沒有寫明「每個計費 token 至少對應一個位元組」，所以 `inputBound.assumptionAcknowledged` 預設為 `false`，線上模式因此被擋。可以選兩條路：
- 接受這個前提（改成 `true`）。
- 改用 token counting 端點（官方寫明免費，但結果是「估計值」，而且每次也是一個 API 請求），預算入口要另外設計。

這是本機的批次控制，不是帳戶層級的支出保證。建議另外在 Console 對研究 workspace 設支出上限。

---

## 線上閘門（預設全部關閉）

`checkLive()` 列出所有擋下的原因；只要有任何一項就不建立線上 transport，也不會呼叫 `fetch`。需要同時滿足：

1. 使用者明確下令開始真實測試。
2. `network.allowLive` 改為 `true`（目前是 `false`）。
3. CLI 加 `--live`。
4. 環境變數 `RIMTOWN_RESEARCH_LIVE_CONFIRM` 等於 `batchId`（`loan-pairs-sonnet55-r1`）。
5. 環境變數 `RIMTOWN_RESEARCH_API_KEY` 有值。
6. `inputBound.assumptionAcknowledged` 為 `true`。
7. 模型、入口、上限、零重試、不換模型、不快取、`providerSettings` 為空、費率已核對、SDK 版本相符，全部符合。
8. 沒有設定 `ANTHROPIC_CUSTOM_HEADERS`（SDK 會把它加進每個請求）。

只有金鑰、只選線上模式、或只執行腳本，都不會連線。測試裡逐一驗證過：缺任何一項都會被擋。

---

## 紀錄與重播

每次呼叫記錄：
- 來源標記、階段、請求與請求本文的雜湊和全文。
- 原始回應、usage（含 `output_tokens_details.thinking_tokens`、`inference_geo`）。
- request-id、HTTP 狀態、實際回應模型、停止原因、耗時、錯誤分類。

不記錄任何 header。錯誤訊息裡若出現金鑰樣式的字串，會換成 `[REDACTED]`。

技術待處理的分類：`timeout`、`bad_json`、`truncated`（`max_tokens`）、`refusal`、`model_mismatch`、`rate_limited`、`server_error`、`invalid_request`、`auth_error`、`network_error`。這些都不會替角色選答案，也不會退回預設的固定回應。

重播（`replayLiveTransport`）完全離線：
- 依原順序逐筆核對完整請求與請求本文的雜湊；順序不同就是 `replay_mismatch`。
- 手寫回應的紀錄不能拿來當供應商錄製重播，反過來也不行。
- 重播不花錢、不寫帳本，新紀錄標為 `REPLAY_LIVE_RECORDING`，並註明原本的來源。

---

## 執行（在 repo 根目錄）

```sh
(cd research && npm ci)                              # 安裝 SDK（只在 research/ 底下）
node scripts/psy_loan_pairs.js                       # 重建配對資料（內容不變）
node scripts/psy_research_test.js                    # 手寫回應流程與模擬預算
node scripts/psy_research_live_test.js               # Anthropic adapter 的離線測試（不需要金鑰）
node scripts/psy_research_live.js --check            # 只列出線上閘門狀態，不連線
node scripts/psy_research_live.js --fake-provider    # 用假回應走一遍 SDK 路徑，獨立帳本
node scripts/psy_research_live.js --replay <run.json># 離線重播
```

`--live` 目前一定被拒絕（exit 3），並列出缺少的條件。

---

## 將來的人工判讀

- 先檢查評估有沒有注意到本人可知的變動、引用是否支持說法、是否分清事實／推測／承諾、提案是否一致，再看理由和選擇。
- 選擇可以不變；不以「有醫療支出就必須拒絕」之類的答案驗收。
- 相同輸入的三次回應用來觀察模型本身的變異，不能解釋成人格變化。
- 手動插入記憶的配對，不能證明遊戲裡經歷形成記憶後的完整行為鏈。
