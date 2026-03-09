# RimTown - AI Town Simulation

A RimWorld-inspired AI town simulation where every resident is an autonomous AI agent with unique personality, background, job, relationships, and daily life.

## Features

- **Autonomous AI Agents**: Each resident has personality traits, memories, moods, and psychological needs
- **Social Simulation**: Agents chat, gossip, form friendships, rivalries, and romantic relationships
- **Job System**: RimWorld-inspired jobs including farming, mining, cooking, crafting, doctoring, research, and more
- **Dynamic Events**: Random events, seasons, and emergencies that affect the town
- **Memory & Relationships**: Agents remember interactions and form opinions about each other
- **Web Visualization**: Real-time browser-based town visualization

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the simulation
python -m rimtown.main

# Open browser at http://localhost:8000
```

## Architecture

```
rimtown/
├── core/           # Simulation engine (world, time, events)
├── agents/         # AI agent system (personality, memory, behavior)
├── social/         # Social interactions (chat, gossip, relationships)
├── jobs/           # Job and economy system
├── town/           # Town map and locations
├── llm/            # LLM integration for agent conversations
├── web/            # Web visualization frontend
└── config/         # Town and agent configurations
```

## Configuration

Set your LLM API key in `.env`:

```
ANTHROPIC_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
```

Customize your town in `config/town.yaml` and residents in `config/residents.yaml`.

---

## Changelog

### v1.4.0 (2026-03-09)

**篝火之夜 / 全螢幕地圖 / 首頁**

- 夜晚效果重新設計：移除濃霧覆蓋，改用篝火、火把和極淡藍色調
- 篝火系統：廣場、酒館、守衛站、水井處有動態火焰動畫
- 建築旁自動放置閃爍火把，提供溫暖光暈
- 感情系統強化：新增自然浪漫吸引力（基於性格相容度）
- 降低交往/求婚門檻，增加每次對話的浪漫火花機率
- 地圖全螢幕顯示：Canvas 自動填滿容器，無邊框
- 新增雙指縮放（pinch-to-zoom）和拖曳平移
- 桌面支援滾輪縮放和拖曳平移
- 最小縮放自動計算，最大放大 4 倍
- 新增 `[rimtown_landing]` 首頁短碼：動畫像素背景、特色介紹、AI 模型展示
- 修復地圖消失問題：CSS class 重新命名避免 WordPress Astra 主題衝突

### v1.3.0 (2026-03-09)

**鎮長選舉系統**

- 新增鎮長選舉系統：居民根據個性、價值觀、關係投票
- 選舉流程：競選期（3天）→ 投票期（2天）→ 結果公告（3天）
- 6 種政策主張：經濟發展、社會福利、軍事防禦、文化教育、自然保育、個人自由
- 候選人根據個性與價值觀自動選擇政策
- 投票依據：關係親密度(40%)、價值觀契合(30%)、魅力能力(20%)、隨機(10%)
- 當選鎮長的政策會產生 30 天持續效果（透過新聞系統）
- 選舉 UI：即時票數、進度條、結果展示（事件頁籤）
- 選舉歷史記錄，可在存檔中保存/載入
- 修正 MiniMax API：模型更新為 M2.5、參數修正為 max_completion_tokens
- 更新 Gemini 預設模型為 gemini-2.5-flash

### v1.2.0 (2026-03-09)

**響應式設計 (RWD)**

- 新增 RWD 響應式設計，支援手機、平板、桌面三種佈局
- 手機版：側欄改為從底部滑出的覆蓋層，搭配浮動按鈕開關
- 手機版：點擊居民或開始聊天時自動開啟側欄
- 手機版：隱藏次要按鈕（匯出/匯入），節省畫面空間
- 手機版：Chat 輸入框使用 16px 字型，防止 iOS 自動縮放
- 小螢幕手機（≤480px）：隱藏速度控制與儲存按鈕
- 平板（≤1024px）：側欄縮窄至 300px
- 新增版本更新日誌系統，後台可查看完整更新記錄

### v1.1.0 (2026-03-09)

**WordPress 插件**

- 建立 WordPress 插件架構（rimtown.php）
- 支援 `[rimtown]` 短碼嵌入任意頁面
- 支援 `[rimtown height="800px"]` 自訂高度參數
- CSS 隔離：所有樣式限定在 `.rimtown-container` 內，不影響主題
- 事件委派隔離：點擊事件綁定遊戲容器，不干擾 WordPress
- 自動全寬：遊戲頁面隱藏 WordPress header/footer
- Modal z-index 設為 100000，確保在 WordPress admin bar 之上
- 新增 WordPress 後台設定頁面（使用說明）
- wp_enqueue_script/style 正確載入資源，支援快取清除

### v1.0.0 (2026-03-08)

**初始版本**

- AI 小鎮模擬核心功能
- Tilemap 地圖渲染引擎
- 居民 AI 自主行為系統
- 玩家聊天系統（支援多 LLM 供應商：Claude、GPT、Gemini、DeepSeek、Groq、Together、MiniMax）
- 經濟系統：資源、建築、研究、貿易
- 事件系統：突襲、連鎖事件、移民
- 聊天記錄存檔功能
- 多城鎮管理
- 匯出/匯入存檔
