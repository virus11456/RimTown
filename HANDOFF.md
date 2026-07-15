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

## 2. Git / PR 狀態

- **PR #3 已合併**（2026-07-15）：v4.0–v4.1.6 全部功能已進入預設分支 `claude/ai-town-simulation-EOWZ8`
- **工作分支**：`claude/rimtown-feature-planning-qFoXd`，已從合併後的預設分支重新建立（合併過的 PR 不能再堆 commit，後續工作視為全新變更、開新 PR）
- push 用 `git push -u origin claude/rimtown-feature-planning-qFoXd`；push 後若無 open PR 要開新的 draft PR（base：`claude/ai-town-simulation-EOWZ8`）
- 工作樹乾淨，全部已推送

## 3. ⚠️ 版號同步規範（使用者非常在意，漏掉會被糾正）

目前版號：**4.1.6**。每次有任何變動都要 bump 版號並同步以下 **全部位置**：

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

## 6. 🚧 進行中任務：搬到 Vercel（未完成，最優先）

**結論**：可以跑。遊戲是純前端，靜態託管即可完整遊玩（訪客模式 + localStorage 存檔）。只有登入/雲端存檔/成就同步依賴 WordPress REST API，靜態版無法使用（登入會顯示失敗但不會壞掉遊戲）。

**已嘗試**：用 Vercel MCP `deploy_to_vercel` 部署，方案是傳一個小 `build.sh`（因為遊戲檔案 ~1.4MB 無法 inline 傳），build 時從 GitHub clone 公開 repo、把 `wordpress/` 靜態檔 + `chrome-extension/icons` 複製到 `public/` 輸出：

```bash
git clone --depth 1 -b claude/ai-town-simulation-EOWZ8 https://github.com/virus11456/RimTown.git repo
# （PR #3 已合併，改 clone 預設分支——內容包含全部 v4.1.6 功能）
mkdir -p public
cp repo/wordpress/*.js repo/wordpress/*.css repo/wordpress/*.html public/
cp repo/wordpress/pwa-manifest.json public/
cp -r repo/chrome-extension/icons public/icons
```

（搭配 `package.json` 的 `"build": "bash build.sh"` 和 `vercel.json` 的 `"outputDirectory": "public"`）

**Blocker**：Vercel API 回 **403 "You don't have permission to create a project"**（team `team_SQDuwfJ6mh6QlhQdBWLfeWiV` / virus11456s-projects）。該 team 已有 14 個專案但沒有 `rimtown`，整合的權限無法建新專案。

**下一步（擇一）**：
1. 請使用者到 Vercel dashboard 手動建立空專案 `rimtown`，然後重試上面的 `deploy_to_vercel`（部署到既有專案可能不需要建立權限）
2. 或請使用者在 Vercel dashboard 直接 Import GitHub repo `virus11456/RimTown`，Root Directory 設 `wordpress/`（但 icons 會缺，需另外處理）
3. 或請使用者重新授權 Vercel 整合、給予建立專案權限

**後續（如果使用者想要完整功能）**：把 WordPress REST API（login/register/saves/achievements，見 `rimtown.php` 約 826-1074 行）移植成 Vercel serverless functions + 資料庫（如 Vercel Postgres / Supabase），前端 `RimTownAuth` 的 `_restUrl` 指向新端點。

## 7. 待辦 / 使用者提過的期望

- [ ] **Vercel 部署**（上節，最優先）
- [ ] 使用者之後會提供 8-bit 音樂檔，用 `bgm.loadCustomTrack()` 接上
- [ ] 完成任何變動後：bump 版號 + 更新 README/changelog + 同步兩目錄 + commit + push（第 3、4 節）
