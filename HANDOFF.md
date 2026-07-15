# RimTown 任務交接文件（HANDOFF）

> 給下一個 Claude 對話視窗：請先完整讀完本文件再開始工作。
> 上一個 session 結束於 2026-07-15，本文件由該 session 產生。

---

## 1. 專案概況

- **RimTown**：RimWorld 風格 AI 小鎮模擬遊戲，純前端 JavaScript（無框架、無建置步驟）
- 兩種發佈形態，**程式碼完全同步**：
  - `wordpress/` — WordPress 外掛（`rimtown.php` 提供 shortcode、REST API：登入/註冊/雲端存檔/成就）
  - `chrome-extension/` — Chrome 擴充功能 / 獨立網頁版（`index.html` 直接開啟即可玩）
- 遊戲引擎核心：`simulation.js`（世界模擬）、`app.js`（UI）、`tilemap.js`（像素地圖）、`chiptune.js`（8-bit BGM）
- 存檔：未登入/訪客 → localStorage；已登入 → WordPress 雲端（user meta）
- 線上站點：rimtown.cc（WordPress）

## 2. Git / PR 狀態（2026-07-15 更新）

- 使用者要求整併分支：**PR #3 已合併**，所有開發現在集中在預設分支 **`claude/ai-town-simulation-EOWZ8`**，之後直接在此分支開發
- 已合併的舊分支 `claude/rimtown-feature-planning-qFoXd`、`claude/update-version-numbers-3HJR2` 內容已全數併入；遠端刪除被環境 proxy 擋（403），使用者可自行在 GitHub 網頁上刪除
- 工作樹乾淨，全部已推送

## 3. ⚠️ 版號同步規範（使用者非常在意，漏掉會被糾正）

目前版號:**4.3.5**。每次有任何變動都要 bump 版號並同步以下 **全部位置**：

| 檔案 | 位置 |
|---|---|
| `wordpress/rimtown.php` | header `* Version:`、`define('RIMTOWN_VERSION', ...)`、changelog 陣列新增一筆 |
| `chrome-extension/rimtown.php` | 同上（直接從 wordpress 複製過去即可） |
| `wordpress/app.js` + `chrome-extension/app.js` | 第 1 行註解 + 第 2 行 `RIMTOWN_APP_VERSION` |
| `chrome-extension/manifest.json` | `"version"` |
| `README.md` | 下載連結 `rimtown-vX.X.X.zip` + Changelog 新增段落 |

## 4. ⚠️ 雙目錄同步規範

改完 `wordpress/` 的檔案後，一律 `cp` 到 `chrome-extension/`（反之亦然）。兩邊的 js/css/html/php 必須完全一致。`icons/` 只存在於 chrome-extension。

其他曾踩過的坑：
- WordPress 版 HTML 在 `rimtown.php` shortcode 內，`index.html` 是獨立版——**新增 UI 元素兩邊都要加**（曾因 PHP 缺 overlay 元素導致通知全部失效）
- 避免用 inline style 寫定位，會蓋掉手機版 media query（guest-banner 踩過）
- 避免 `.header` 這種通用 class 名，會被 WP 主題 CSS 污染
- `t()` 是全域翻譯函數（i18n.js），小心區域變數遮蔽（`startProject` 踩過）

## 5. 已完成的主要功能（v4.0 → v4.1.6）

- v4.0：每日決策卡、商店、事件選擇、NPC 求助、職業動作按鈕、互動報紙、聲望系統（6 級 + 5 種效果）、mood 演算法修復
- v4.1.0：建築升級系統（12 棟 × 3 級）；另有動態天氣引擎（10 種天氣+災害）、NPC 議會（12 種提案）
- v4.1.1–4.1.3：WordPress 缺失 HTML 元素修復、每日決策改「請託型」敘事（村民來找你商量，非鎮長視角）
- v4.1.4：8-bit chiptune BGM（Web Audio 程序化合成，4 首曲目隨日夜切換；`bgm.loadCustomTrack(phase, url)` 可換自訂音檔——使用者說之後會提供音樂檔）
- v4.1.5–4.1.6：訪客試玩模式（登入彈窗「🎮 訪客試玩」按鈕、guest banner、手機版 banner 固定在底部 tab bar 上方 `bottom:52px`）

## 6. ✅ Vercel 部署（已完成 2026-07-15）

**結論**：可以跑。遊戲是純前端，靜態託管即可完整遊玩（訪客模式 + localStorage 存檔）。只有登入/雲端存檔/成就同步依賴 WordPress REST API，靜態版無法使用（登入會顯示失敗但不會壞掉遊戲）。

**進度（2026-07-15）**：部署設定檔已 commit 到 repo 根目錄，本地驗證過 build 產出正確：
- `vercel.json`（`outputDirectory: public`）
- `package.json`（`build: bash build.sh`）
- `build.sh` — 兩用：repo 已 checkout 時（GitHub import）直接複製；只有設定檔時（`deploy_to_vercel`）先 clone `claude/ai-town-simulation-EOWZ8` 分支。產出 = `wordpress/` 的 js/css/html + `pwa-manifest.json` + `chrome-extension/icons` → `public/`

**Blocker（仍未解）**：`deploy_to_vercel` 回 **403 "You don't have permission to create a project"**（team `team_SQDuwfJ6mh6QlhQdBWLfeWiV` / virus11456s-projects）。該 team 有 14 個專案但沒有 `rimtown`，整合權限無法建新專案。2026-07-15 重試仍是 403。

**下一步（擇一，都需要使用者操作）**：
1. 使用者在 Vercel dashboard 直接 **Import GitHub repo** `virus11456/RimTown`（Production Branch 設 `claude/ai-town-simulation-EOWZ8`）——設定檔已在 repo 根目錄，import 即可用，之後每次 push 自動部署（推薦）
2. 或使用者在 dashboard 手動建立空專案 `rimtown`，然後重試 `deploy_to_vercel`（部署到既有專案可能不需建立權限）
3. 或使用者重新授權 Vercel 整合、給予建立專案權限，然後重試

**✅ 帳號系統已移植(v4.1.8)**:`api/` 目錄的 Vercel Serverless Functions + Vercel Blob(store: rimtown-db)。JWT 認證(env: JWT_SECRET)、scrypt 密碼雜湊、blob 內容 AES-256-GCM 加密。前端 RimTownAuth 自動偵測:無 rimtownAuth 全域(靜態站)→ `/api/` + JWT(localStorage `rimtown_jwt`)。DNS:rimtown.cc 已指向 Vercel(A @ → 216.198.79.1),WordPress 已離線。GitHub push 到預設分支會自動部署。

## 7. 待辦 / 使用者提過的期望

- [x] **Vercel 部署** — 已上線 https://rimtown.vercel.app,GitHub push 自動部署已綁定
- [ ] 使用者之後會提供 8-bit 音樂檔，用 `bgm.loadCustomTrack()` 接上
- [ ] 完成任何變動後：bump 版號 + 更新 README/changelog + 同步兩目錄 + commit + push（第 3、4 節）
