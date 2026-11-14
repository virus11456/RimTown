# D1 交接：借錢研究接口（Anthropic adapter，線上預設關閉）

接續 `2ba423a`（借錢配對資料、評估器接口、預算控制）。本輪準備真實 AI 研究接口，但**沒有發出任何供應商 API 請求**：沒有測試金鑰、沒有列出模型、沒有遠端計算 token。不接管遊戲行為、不擴充失火情境、不開始 D2、不合併正式分支、不手動部署。

## 本輪完成

- **研究設定**：`research/anthropic-research.json`
  - Anthropic 官方 API、`claude-sonnet-5-5`、`https://api.anthropic.com`。
  - 金鑰環境變數 `RIMTOWN_RESEARCH_API_KEY`；workspace ID 環境變數 `RIMTOWN_RESEARCH_WORKSPACE_ID`（非秘密）。
  - US$5、60 次、同時 1 個、`max_tokens` 4096、零重試、不換模型、不快取。
  - 費率、API 版本、參數支援都在 2026-11-14 依官方文件核對；來源 URL 寫在設定檔。
- **adapter**：`scripts/psy_research_live.js`
  - 用官方 SDK `@anthropic-ai/sdk` 1.8.0（`research/package.json`，不在網站建置內）。
  - 四個階段都經過同一個 `createEvaluator` 與預算入口。
  - 有請求本文、回應解析、usage 記帳（nano-USD）、截斷與錯誤分類、獨立的線上帳本、離線重播、來源標記。
- **核心介面**：`scripts/psy_research.js`
  - `createEvaluator` 同時接手寫回應與供應商格式的 transport；未通過驗證的 transport 一律拒絕。
  - `run()` 可傳研究專用逾時；遊戲核心與原本的 2 秒預設都沒改。
- **離線測試**：`scripts/psy_research_live_test.js`，32 項通過，詳見下方「測試結果」。

## 測試結果（本輪實跑，Node v22.22.0）

| 指令 | 結果 |
|---|---|
| `node scripts/psy_research_live_test.js` | 32 checks passed；全域 fetch 呼叫 0 |
| `node scripts/psy_research_test.js` | 21 checks passed |
| `node scripts/psy_d1_unit_test.js` | 140 passed, 0 failed |
| 以上三項在 `unshare -rn`（沒有網路的命名空間，連線回 `ENETUNREACH`）重跑 | 結果相同 |
| `node scripts/psy_research_live.js --check` | 列出 5 個擋下原因：network_gate_closed、cli_live_flag_missing、live_confirmation_missing、api_key_env_missing、input_bound_assumption_unacknowledged |
| `--live`（含設了假金鑰的情況） | 拒絕，exit 3 |
| `--fake-provider` 演練 | 12 份評估、24 次請求（假回應，未連線）；單次預留 US$0.071～0.076；模擬結算 US$0.107（假 usage，不是真實費用） |
| `--replay` 該次演練 | 24 次、評估結果完全相同、不記帳 |

32 項離線測試涵蓋：
- 四階段正常流程；補評估後維持、修改、撤回。
- 解析：fenced JSON、壞 JSON、截斷、拒答、模型不符。
- 錯誤：429、500、529、400、401、網路錯誤、逾時。每種都只送一次，保留預留額度，不產生選擇。
- 預算不足時完全不呼叫傳送函式；達到請求上限就停。
- 重啟、重複執行、程序崩潰時沒結算的預留；同時兩個請求、兩個程序搶同一批次。
- 同一輸入三次重複是三次獨立請求。
- 來源標記；手寫紀錄與供應商紀錄互相不能重播；離線重播零花費。
- 全程不需要金鑰；閘門缺任一條件都擋。
- 選擇不同的固定回應都能通過，驗證器不偏好任何答案。

## 真實測試前還缺的條件

1. **使用者明確下令開始真實測試。** 沒有這個指令，維持關閉。
2. **金鑰存放位置確認**：程式只讀 `RIMTOWN_RESEARCH_API_KEY`。請確認這個名稱或其他安全存放方式，不要把值貼進聊天、檔案或 GitHub。
3. **金鑰是否已綁定研究 workspace**：
   - 已綁定：不用填 workspace ID。
   - 未綁定：提供研究 workspace ID（非秘密）。
4. **輸入 token 上限的依據**：目前用「請求本文 UTF-8 位元組數＋2048」，前提是每個計費 token 至少對應一個位元組。官方文件沒有寫明這一點，所以 `inputBound.assumptionAcknowledged` 預設 `false`，線上模式被擋。可以選：
   - 接受這個前提。
   - 改用免費的 token counting 端點（官方說是估計值，而且每次也算一個 API 請求，預算入口要另外設計）。
5. **研究 workspace 的 `inference_geo` 預設**：未知時一律以 ×1.1 預留；若確認是 global，可以只當作紀錄。
6. **Console 支出上限（建議）**：本機帳本是批次控制，不是帳戶層級保證。建議在 Console 對研究 workspace 另設支出上限。
7. **開啟動作**：上述條件都齊了以後，才把 `network.allowLive` 改成 `true`，設 `RIMTOWN_RESEARCH_LIVE_CONFIRM=loan-pairs-sonnet55-r1`，再執行 `node scripts/psy_research_live.js --live`。

## 已知限制

- 4096 token 包含 thinking；effort `high` 下有可能被 thinking 用完而截斷。截斷記成技術待處理，不會改答案，也不會自動重試。
- 回應若不是單一 JSON 物件（前後夾說明文字）就算 `bad_json`；只接受整段被單一 ```json 區塊包住的情況。
- 逾時（含 SDK 逾時與核心的每階段逾時）一律保留預留額度。核心逾時時 SDK 請求可能還在跑，下一個請求會因 `concurrent_request_open` 被擋，批次停止，不會兩個請求同時在途。
- 拒答（`refusal`）記成技術待處理，不切換到其他模型。
- 手寫回應與假回應的結果都不是人物心理成果；不得宣稱擬人化有成果。
- 失火情境暫停；住房殘留狀態、舊流程用放款人現金算借款金額的問題，仍然只記錄。

## 檔案

| 檔案 | 用途 |
|---|---|
| `research/anthropic-research.json` | 研究設定（閘門關閉） |
| `research/package.json`、`research/package-lock.json` | SDK 依賴（只在 research/） |
| `research/README.md` | 研究說明、費率依據、閘門、預算規則、執行方式 |
| `research/provenance.json` | 檔案雜湊與本輪測試紀錄 |
| `scripts/psy_research_live.js` | Anthropic adapter 與 CLI |
| `scripts/psy_research_live_test.js` | 離線測試 |
| `scripts/psy_research.js` | 共用研究接口（手寫回應與供應商格式） |

本機輸出放在 `test-results/`，不進版控。
