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

## Phase 2 回報
- 完成：主場景、四入口 UI、四向相機／8–40 格縮放／滑鼠與觸控、ApiClient、SaveDocument、2,609 原版翻譯 key 的 PO、Noto Sans TC（OFL）。
- 未完成／延後：正式帳號登入及正式同網域 Web 驗收需擁有者自行操作；未取得／建立任何正式憑證。日夜燈光與世界一起於 Phase 3 接入。
- 驗證：本機真實 HTTP server 與 Godot HTTPRequest 端對端 12 次請求；49 個檢查全過，登入→Bearer me→存檔列表→下載→解析 Dictionary 成功。401 清除 session、stale 不視為覆寫、唯讀寫入攔截、兩個 chat lane 均驗證。主場景 headless smoke 成功。
- 存檔相容：6/6 原 JS 快照逐位元 round-trip 相同，未知巢狀欄位／未來版本測試成功；丟失鍵數 0。無 Godot 模擬 tick。
- 待確認決策：D-10 正式登入／部署驗收仍待確認；工程實作先使用本機端對端證據，並非宣稱正式站驗收通過。
- 下一步：Phase 3 格網重建、住宅與地基對照、兩鎮靜態 3D 顯示。

## Phase 3 回報
- 完成：TownLayout 依原版規則重建 80×60 格網；TownView 顯示兩鎮、道路、住宅／加蓋屋、工廠地基、碼頭與馬車站、建造中標記、裝飾及靜態居民。季節／時刻光照、雨雪、落葉與夏夜螢火蟲依存檔設定。四入口接入範例切換、居民資料、故事紀錄及原始 JSON 匯入／匯出。
- 驗證：18 組案例的 86,400 格與原版 JS oracle 一致，同時比較 buildings/houses/factories/agentHouse/agents；36 個畫面與六份快照載入檢查通過。實際 Godot 4.7.1 桌面渲染兩鎮，另以 375×812 SubViewport 檢視手機布局。截圖見 frontier-preview.png、harbor-preview.png、mobile-preview.png。
- 存檔相容：顯示六份快照前後 JSON 逐位元相同，無模擬 tick、無世界雲端寫入；既有 49 個 API／存檔／相機檢查維持通過。
- 未完成／延後：正式使用者存檔及人工 2D 截圖對照、美術認可仍待擁有者驗收；格網 oracle 是程式對照證據，並非正式站驗收。Safari 實機、Web 匯出／部署、效能門檻及完整英文介面未宣稱通過。Phase 4–6 不在本次範圍。
- 造型限制：噴泉／雕像等部分裝飾共用井／石碑模型；居民不播放動畫，無音樂。小屋採原版 footprint，居民座標採重新載入時的初始化位置（D-07／D-08）。
- 交付：可直接開啟的 Godot 專案原始碼包、三張實際渲染預覽、README 操作與重建說明。所有變更限定 godot/，api/、chrome-extension/、wordpress/ 無修改，未推送／部署。
- 下一步：由擁有者確認美術和 D-07／D-08，使用正式帳號驗收登入與自有存檔；取得後續授權才開始可操作玩法。

## 追加：AI 自動互動驗收
- 使用者要求 AI 自行操作測試後，先操作目前 Godot 除錯視窗；原生點擊僅觀察到游標／焦點變化，工具列亦未反應，故記為工具層結果不確定，不視為遊戲缺陷或通過證據。
- 新增 tests/test_interaction.gd，以引擎事件命中測試 UI，沒有直接發射按鈕 signal 或呼叫面板方法替代點擊。30 項全過，測試程式 exit 0；詳細清單見 INTERACTION_TESTS.json。
- 驗證兩鎮切換、居民詳情／返回／相機定位、故事／設定、遮罩密碼欄位、相機按鈕／鍵盤／滾輪／拖曳、檔案選擇器鍵盤確認、匯出實體 JSON 與匯入逐位元一致、錯誤 JSON 保留原世界，以及 375px 導覽與轉向命中。
- 測試環境啟用內嵌子視窗；設定目錄後以鍵盤輸入檔名並 Enter 確認。這不替代 macOS 原生檔案視窗／Safari／觸控硬體驗收。未向正式 API 發請求，未修改遊戲程式；本機生成一份測試 JSON 副本。

## Phase 4a 回報
- 完成：純 RefCounted 的 SimClock／SimRandom／SimNeeds／SimWorld／SimPath／SimMotion；既有角色的睡眠、緊急需求、上工與回家、夜貓子／早起性格、地點停留、技能 XP；八向 A*、不切角、門口分段、睡眠屋外與清醒卡屋保險絲。移動以固定 60 Hz 驅動，加入路徑快取。
- 試玩入口：開始／暫停、＋15 分單步、1×／4×／16×，居民活動與需求、動態日夜／換季。保留原始副本，另可匯出含 `_godot4a` 狀態的試玩進度；不寫入雲端。
- 驗證：兩鎮各 2,880 ticks、14 個原版 Agent.update 範圍檢查點通過；12 路徑＋22 移動檢查點通過；最大座標誤差 0.00231 原版像素。試玩／續跑／未知欄位等 458 個檢查通過，既有 36 個畫面檢查通過。原 JS 可載入試玩進度，核對時鐘、居民數、地點、活動、需求、技能一致。
- 本輪修正：JSON 預設排序及數值精度會改變續跑結果，改為保留順序與完整精度；續跑保存住宅分配與行走狀態。實際 GPU 畫面抓到時間標題自動換行撐高問題，改為緊湊單行，桌面／375px 重新驗證。
- 原版差異與範圍：4b–f 副作用在 oracle 和 Godot 同樣禁用；經濟、關係變更、任務、事件、LLM 不更新。完整 World.tick 的人口／資源／關係／任務 30 天一致性與正式回存 DoD 仍未達成。不新增玩家直接控制、建設或對話功能。
- 動畫限制：已接步行起伏、朝向、睡眠姿勢，尚非完整 idle/walk/work/sleep/talk 五組骨架動畫。Godot Vector2 引入微量浮點差異，測試保留容差與實測值。
- 畫面證據：playtest-desktop.png 為實際 GPU 運行至 08:00 後暫停；playtest-mobile.png 為真正 375×812 子視窗。擷取使用明示測試旗標，交付前移除，正常開啟不自動播放／截圖。
- 尚待：正式帳號、Safari／觸控硬體、完整美術與效能驗收。這是可提早上手的 Phase 4a 試玩包，不是完整遊戲移植完成。沒有修改 api/、chrome-extension/、wordpress/，未推送或部署。

## 追加：旅人直接操作
- 完成：TravelerControls 接 WASD／方向鍵，SimMotion 純資料移動與分軸牆壁碰撞，TownCamera 平滑跟隨／拖曳解除，找旅人按鈕與頭頂標記。方向隨四向相機旋轉，對角線正規化。暫停時間仍可走，世界加速不加快旅人。
- 維護邊界：旅人手動狀態讓自動地點尋路略過玩家；所在建築／自然區同步邏輯 currentLocation。進度保存手動位置與模式，不保存按鍵；載入／切鎮／失焦和文字輸入處理避免持續誤走。
- 驗證：50 項旅人碰撞與引擎輸入事件檢查全過；458 試玩／續跑、34 NPC 移動、36 畫面回歸通過。traveler-preview.png 為 Godot GPU 定位旅人後的實際畫面；截圖旗標在交付前移除。
- 與原版差異：原版鍵盤斜走較快，這版維持與直走同速；方向改為 3D 視角相對。碰撞格定義、4 px 邊界及 72 px/s 基速保留。這次未做完整逐幀 JS 手動控制 oracle，證據是純碰撞及引擎事件測試。
- 尚未包含：近身 NPC 互動／對話、手機螢幕方向控制、完整 Phase 5 玩法；正式登入與 Safari／觸控硬體驗收仍待後續。沒有修改 api/、chrome-extension/、wordpress/，未推送或部署。
