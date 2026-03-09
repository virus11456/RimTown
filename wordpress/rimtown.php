<?php
/**
 * Plugin Name: RimTown - AI Town Simulation
 * Plugin URI: https://github.com/virus11456/RimTown
 * Description: RimWorld 風格的 AI 小鎮模擬遊戲。使用 [rimtown] 短碼嵌入頁面。
 * Version: 1.2.0
 * Author: RimTown Team
 * License: MIT
 * Text Domain: rimtown
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RIMTOWN_VERSION', '1.2.0');
define('RIMTOWN_DIR', plugin_dir_path(__FILE__));
define('RIMTOWN_URL', plugin_dir_url(__FILE__));

/**
 * Register shortcode [rimtown]
 * Usage: Create a WordPress page and add [rimtown] to the content.
 * Optional: [rimtown height="800px"] to set custom height.
 */
function rimtown_shortcode($atts) {
    $atts = shortcode_atts(array(
        'height' => '100vh',
    ), $atts, 'rimtown');

    // Enqueue assets only when shortcode is used
    rimtown_enqueue_assets();

    $height = esc_attr($atts['height']);

    // Load template HTML
    ob_start();
    ?>
    <div id="rimtown-app" class="rimtown-container" style="height:<?php echo $height; ?>">
        <!-- Town Manager Modal -->
        <div id="town-modal" class="modal hidden">
            <div class="modal-content town-content">
                <h2>🏘️ 城鎮列表</h2>
                <div id="town-list-content"></div>
            </div>
        </div>

        <!-- Settings Modal -->
        <div id="settings-modal" class="modal hidden">
            <div class="modal-content">
                <h2>設定</h2>
                <div class="setting-group">
                    <label>AI 語言模型</label>
                    <select id="llm-provider">
                        <option value="none">無（模擬對話）</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (GPT)</option>
                        <option value="gemini">Google (Gemini)</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="groq">Groq</option>
                        <option value="together">Together AI</option>
                        <option value="minimax">MiniMax (海螺AI)</option>
                    </select>
                </div>
                <div class="setting-group" id="api-key-group">
                    <label>API 金鑰</label>
                    <input type="password" id="llm-api-key" placeholder="輸入你的 API 金鑰...">
                </div>
                <div class="setting-group">
                    <label>模擬速度</label>
                    <select id="sim-speed">
                        <option value="3000">慢速（3秒）</option>
                        <option value="2000" selected>正常（2秒）</option>
                        <option value="1000">快速（1秒）</option>
                        <option value="500">極快（0.5秒）</option>
                    </select>
                </div>
                <div class="modal-buttons">
                    <button id="settings-save" class="btn-accent">儲存</button>
                    <button id="settings-cancel">取消</button>
                </div>
            </div>
        </div>

        <!-- Header -->
        <div class="header">
            <h1>邊境鎮</h1>
            <div class="header-info">
                <span id="population-count">人口：--</span>
                <span id="clock-display" class="clock-display">載入中...</span>
                <span id="terrain-display" class="terrain-display"></span>
                <div class="controls">
                    <button class="btn-towns" data-action="show-towns">城鎮列表</button>
                    <button id="btn-new-game" class="btn-new-game">新地圖</button>
                    <button id="btn-save" class="btn-save">儲存</button>
                    <button id="btn-export" class="btn-export" title="匯出存檔">匯出</button>
                    <button id="btn-import" class="btn-import" title="匯入存檔">匯入</button>
                    <button id="btn-pause">暫停</button>
                    <button id="btn-resume" class="active">播放</button>
                    <div class="speed-controls">
                        <button class="btn-speed active" data-speed="1">1x</button>
                        <button class="btn-speed" data-speed="1.5">1.5x</button>
                        <button class="btn-speed" data-speed="2">2x</button>
                        <button class="btn-speed" data-speed="3">3x</button>
                    </div>
                    <span id="llm-status" class="llm-status" title="AI 狀態">AI:--</span>
                    <button id="btn-settings" class="btn-settings">設定</button>
                </div>
            </div>
        </div>

        <!-- Main Layout -->
        <div class="main-layout">
            <div class="map-panel">
                <canvas id="town-map-canvas"></canvas>
                <div class="town-map" id="town-map" style="display:none"></div>
            </div>
            <div class="sidebar" id="rimtown-sidebar">
                <button class="mobile-back-to-map" id="mobile-back-to-map">&#9650; 返回地圖</button>
                <div class="sidebar-tabs">
                    <button data-tab="residents" class="active">居民</button>
                    <button data-tab="chat">聊天</button>
                    <button data-tab="detail">詳情</button>
                    <button data-tab="economy">經濟</button>
                    <button data-tab="log">日誌</button>
                    <button data-tab="events">事件</button>
                </div>
                <div class="sidebar-content" id="sidebar-content"></div>
            </div>
            <button class="mobile-sidebar-toggle" id="mobile-sidebar-toggle" title="顯示側欄">&#9776;</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('rimtown', 'rimtown_shortcode');

/**
 * Enqueue scripts and styles
 */
function rimtown_enqueue_assets() {
    wp_enqueue_style(
        'rimtown-style',
        RIMTOWN_URL . 'style.css',
        array(),
        RIMTOWN_VERSION
    );

    wp_enqueue_script(
        'rimtown-simulation',
        RIMTOWN_URL . 'simulation.js',
        array(),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-tilemap',
        RIMTOWN_URL . 'tilemap.js',
        array('rimtown-simulation'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-app',
        RIMTOWN_URL . 'app.js',
        array('rimtown-simulation', 'rimtown-tilemap'),
        RIMTOWN_VERSION,
        true
    );
}

/**
 * Add full-width page template option
 */
function rimtown_body_class($classes) {
    global $post;
    if ($post && has_shortcode($post->post_content, 'rimtown')) {
        $classes[] = 'rimtown-page';
    }
    return $classes;
}
add_filter('body_class', 'rimtown_body_class');

/**
 * Optional: Add admin menu page for instructions
 */
function rimtown_admin_menu() {
    add_options_page(
        'RimTown 設定',
        'RimTown',
        'manage_options',
        'rimtown-settings',
        'rimtown_settings_page'
    );
}
add_action('admin_menu', 'rimtown_admin_menu');

/**
 * Changelog data — 每次更新在此新增版本記錄
 */
function rimtown_get_changelog() {
    return array(
        array(
            'version' => '1.2.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '新增 RWD 響應式設計，支援手機、平板、桌面三種佈局',
                '手機版：側欄改為從底部滑出的覆蓋層，搭配浮動按鈕開關',
                '手機版：點擊居民或開始聊天時自動開啟側欄',
                '手機版：隱藏次要按鈕（匯出/匯入），節省畫面空間',
                '手機版：Chat 輸入框使用 16px 字型，防止 iOS 自動縮放',
                '小螢幕手機（≤480px）：隱藏速度控制與儲存按鈕',
                '平板（≤1024px）：側欄縮窄至 300px',
                '新增版本更新日誌系統，後台可查看完整更新記錄',
            ),
        ),
        array(
            'version' => '1.1.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '建立 WordPress 插件架構（rimtown.php）',
                '支援 [rimtown] 短碼嵌入任意頁面',
                '支援 [rimtown height="800px"] 自訂高度參數',
                'CSS 隔離：所有樣式限定在 .rimtown-container 內，不影響主題',
                '事件委派隔離：點擊事件綁定遊戲容器，不干擾 WordPress',
                '自動全寬：遊戲頁面隱藏 WordPress header/footer',
                'Modal z-index 設為 100000，確保在 WordPress admin bar 之上',
                '新增 WordPress 後台設定頁面（使用說明）',
                'wp_enqueue_script/style 正確載入資源，支援快取清除',
            ),
        ),
        array(
            'version' => '1.0.0',
            'date'    => '2026-03-08',
            'changes' => array(
                '初始版本：AI 小鎮模擬核心功能',
                'Tilemap 地圖渲染引擎',
                '居民 AI 自主行為系統',
                '玩家聊天系統（支援多 LLM 供應商）',
                '經濟系統：資源、建築、研究、貿易',
                '事件系統：突襲、連鎖事件、移民',
                '聊天記錄存檔功能',
                '多城鎮管理',
                '匯出/匯入存檔',
            ),
        ),
    );
}

function rimtown_settings_page() {
    $changelog = rimtown_get_changelog();
    ?>
    <div class="wrap">
        <h1>RimTown - AI Town Simulation <small style="color:#999;">v<?php echo RIMTOWN_VERSION; ?></small></h1>

        <div class="card" style="max-width:700px;padding:20px;margin-bottom:20px;">
            <h2>使用方式</h2>
            <ol>
                <li>建立一個新的 WordPress 頁面</li>
                <li>在頁面內容中加入短碼：<code>[rimtown]</code></li>
                <li>發佈頁面即可開始遊玩</li>
            </ol>
            <h3>選項</h3>
            <ul>
                <li><code>[rimtown height="800px"]</code> — 自訂遊戲高度（預設 100vh）</li>
            </ul>
            <h3>建議</h3>
            <ul>
                <li>使用全寬頁面模板（Full Width）以獲得最佳體驗</li>
                <li>在遊戲內點擊「設定」按鈕配置 AI 語言模型</li>
                <li>遊戲資料儲存在瀏覽器的 localStorage 中</li>
            </ul>
        </div>

        <div class="card" style="max-width:700px;padding:20px;">
            <h2>版本更新日誌</h2>
            <?php foreach ($changelog as $release) : ?>
                <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #ddd;">
                    <h3 style="margin:0 0 4px;">
                        v<?php echo esc_html($release['version']); ?>
                        <span style="color:#999;font-size:13px;font-weight:normal;margin-left:8px;">
                            <?php echo esc_html($release['date']); ?>
                        </span>
                        <?php if ($release['version'] === RIMTOWN_VERSION) : ?>
                            <span style="background:#e94560;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;">目前版本</span>
                        <?php endif; ?>
                    </h3>
                    <ul style="margin:8px 0 0 16px;">
                        <?php foreach ($release['changes'] as $change) : ?>
                            <li style="margin-bottom:3px;"><?php echo esc_html($change); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
}
