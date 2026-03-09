<?php
/**
 * Plugin Name: RimTown - AI Town Simulation
 * Plugin URI: https://github.com/virus11456/RimTown
 * Description: RimWorld 風格的 AI 小鎮模擬遊戲。使用 [rimtown] 短碼嵌入頁面。
 * Version: 2.3.8
 * Author: RimTown Team
 * License: MIT
 * Text Domain: rimtown
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RIMTOWN_VERSION', '2.3.8');
define('RIMTOWN_DIR', plugin_dir_path(__FILE__));
define('RIMTOWN_URL', plugin_dir_url(__FILE__));

// =====================================================
// DATABASE SETUP — Custom tables for cloud saves
// =====================================================
function rimtown_activate() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $table = $wpdb->prefix . 'rimtown_saves';

    $sql = "CREATE TABLE $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        town_id VARCHAR(64) NOT NULL,
        town_name VARCHAR(128) NOT NULL DEFAULT '',
        season VARCHAR(16) NOT NULL DEFAULT '',
        year INT NOT NULL DEFAULT 1,
        day INT NOT NULL DEFAULT 1,
        population INT NOT NULL DEFAULT 0,
        save_data LONGTEXT NOT NULL,
        achievements TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY user_town (user_id, town_id),
        KEY user_id (user_id)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);

    // Achievements table
    $ach_table = $wpdb->prefix . 'rimtown_achievements';
    $sql2 = "CREATE TABLE $ach_table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        achievement_key VARCHAR(64) NOT NULL,
        unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        town_id VARCHAR(64) DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY user_ach (user_id, achievement_key),
        KEY user_id (user_id)
    ) $charset;";
    dbDelta($sql2);

    update_option('rimtown_db_version', '2.0');
}
register_activation_hook(__FILE__, 'rimtown_activate');

// Ensure tables exist on plugin load (handles upgrades)
function rimtown_check_db() {
    if (get_option('rimtown_db_version') !== '2.0') {
        rimtown_activate();
    }
}
add_action('plugins_loaded', 'rimtown_check_db');

// =====================================================
// REST API — Account, Cloud Saves, Achievements
// =====================================================
function rimtown_register_api() {
    $ns = 'rimtown/v1';

    // --- Auth endpoints ---
    register_rest_route($ns, '/register', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_register',
        'permission_callback' => '__return_true',
    ));
    register_rest_route($ns, '/login', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_login',
        'permission_callback' => '__return_true',
    ));
    register_rest_route($ns, '/logout', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_logout',
        'permission_callback' => '__return_true',
    ));
    register_rest_route($ns, '/reset-password', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_reset_password',
        'permission_callback' => '__return_true',
    ));
    register_rest_route($ns, '/me', array(
        'methods' => 'GET',
        'callback' => 'rimtown_api_me',
        'permission_callback' => '__return_true',
    ));

    // --- Cloud save endpoints ---
    register_rest_route($ns, '/saves', array(
        'methods' => 'GET',
        'callback' => 'rimtown_api_list_saves',
        'permission_callback' => 'is_user_logged_in',
    ));
    register_rest_route($ns, '/save', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_save',
        'permission_callback' => 'is_user_logged_in',
    ));
    register_rest_route($ns, '/save/(?P<town_id>[a-zA-Z0-9_]+)', array(
        'methods' => 'GET',
        'callback' => 'rimtown_api_load_save',
        'permission_callback' => 'is_user_logged_in',
    ));
    register_rest_route($ns, '/save/(?P<town_id>[a-zA-Z0-9_]+)', array(
        'methods' => 'DELETE',
        'callback' => 'rimtown_api_delete_save',
        'permission_callback' => 'is_user_logged_in',
    ));

    // --- Achievements ---
    register_rest_route($ns, '/achievements', array(
        'methods' => 'GET',
        'callback' => 'rimtown_api_get_achievements',
        'permission_callback' => 'is_user_logged_in',
    ));
    register_rest_route($ns, '/achievements', array(
        'methods' => 'POST',
        'callback' => 'rimtown_api_unlock_achievement',
        'permission_callback' => 'is_user_logged_in',
    ));
}
add_action('rest_api_init', 'rimtown_register_api');

// Allow registration even if WP settings disable it
function rimtown_api_register($request) {
    $username = sanitize_user($request->get_param('username'));
    $password = $request->get_param('password');
    $email = sanitize_email($request->get_param('email'));

    if (empty($username) || strlen($username) < 3) {
        return new WP_Error('bad_username', '使用者名稱至少3個字元', array('status' => 400));
    }
    if (empty($password) || strlen($password) < 6) {
        return new WP_Error('bad_password', '密碼至少6個字元', array('status' => 400));
    }
    if (username_exists($username)) {
        return new WP_Error('username_exists', '此使用者名稱已被使用', array('status' => 409));
    }
    if (!empty($email) && email_exists($email)) {
        return new WP_Error('email_exists', '此電子郵件已被使用', array('status' => 409));
    }

    $user_id = wp_create_user($username, $password, $email ?: $username . '@rimtown.local');
    if (is_wp_error($user_id)) {
        return new WP_Error('register_failed', $user_id->get_error_message(), array('status' => 500));
    }

    // Auto-login after registration
    wp_set_current_user($user_id);
    wp_set_auth_cookie($user_id, true);

    return rest_ensure_response(array(
        'success' => true,
        'user' => array('id' => $user_id, 'username' => $username),
        'nonce' => wp_create_nonce('wp_rest'),
    ));
}

function rimtown_api_login($request) {
    $username = sanitize_user($request->get_param('username'));
    $password = $request->get_param('password');

    $user = wp_authenticate($username, $password);
    if (is_wp_error($user)) {
        return new WP_Error('login_failed', '使用者名稱或密碼錯誤', array('status' => 401));
    }

    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, true);

    return rest_ensure_response(array(
        'success' => true,
        'user' => array('id' => $user->ID, 'username' => $user->user_login),
        'nonce' => wp_create_nonce('wp_rest'),
    ));
}

function rimtown_api_reset_password($request) {
    $username = sanitize_user($request->get_param('username'));
    $email = sanitize_email($request->get_param('email'));
    $new_password = $request->get_param('new_password');

    if (empty($username)) {
        return new WP_Error('missing_username', '請輸入使用者名稱', array('status' => 400));
    }
    if (empty($email)) {
        return new WP_Error('missing_email', '請輸入註冊時的電子郵件', array('status' => 400));
    }
    if (empty($new_password) || strlen($new_password) < 6) {
        return new WP_Error('bad_password', '新密碼至少6個字元', array('status' => 400));
    }

    $user = get_user_by('login', $username);
    if (!$user) {
        return new WP_Error('not_found', '找不到此使用者', array('status' => 404));
    }
    if (strtolower($user->user_email) !== strtolower($email)) {
        return new WP_Error('email_mismatch', '電子郵件不符合', array('status' => 403));
    }

    wp_set_password($new_password, $user->ID);

    return rest_ensure_response(array(
        'success' => true,
        'message' => '密碼已重設，請用新密碼登入',
    ));
}

function rimtown_api_logout($request) {
    wp_logout();
    return rest_ensure_response(array('success' => true));
}

function rimtown_api_me($request) {
    if (!is_user_logged_in()) {
        return rest_ensure_response(array('logged_in' => false));
    }
    $user = wp_get_current_user();
    return rest_ensure_response(array(
        'logged_in' => true,
        'user' => array('id' => $user->ID, 'username' => $user->user_login),
    ));
}

// --- Cloud Save CRUD ---
function rimtown_api_list_saves($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_saves';
    $user_id = get_current_user_id();

    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT town_id, town_name, season, year, day, population, updated_at FROM $table WHERE user_id = %d ORDER BY updated_at DESC",
        $user_id
    ));

    return rest_ensure_response(array('saves' => $rows));
}

function rimtown_api_save($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_saves';
    $user_id = get_current_user_id();

    $town_id = sanitize_text_field($request->get_param('town_id'));
    $town_name = sanitize_text_field($request->get_param('town_name'));
    $save_data = $request->get_param('save_data'); // JSON string
    $season = sanitize_text_field($request->get_param('season'));
    $year = intval($request->get_param('year'));
    $day = intval($request->get_param('day'));
    $population = intval($request->get_param('population'));

    if (empty($town_id) || empty($save_data)) {
        return new WP_Error('missing_data', '缺少必要資料', array('status' => 400));
    }

    // Check save size (max 5MB per town)
    if (strlen($save_data) > 5 * 1024 * 1024) {
        return new WP_Error('too_large', '存檔大小超過限制', array('status' => 413));
    }

    // Count user's saves (max 20 towns per user)
    $count = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE user_id = %d",
        $user_id
    ));
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE user_id = %d AND town_id = %s",
        $user_id, $town_id
    ));
    if (!$existing && $count >= 20) {
        return new WP_Error('too_many_saves', '每個帳號最多20個城鎮', array('status' => 400));
    }

    if ($existing) {
        $wpdb->update($table, array(
            'town_name' => $town_name,
            'save_data' => $save_data,
            'season' => $season,
            'year' => $year,
            'day' => $day,
            'population' => $population,
        ), array('user_id' => $user_id, 'town_id' => $town_id));
    } else {
        $wpdb->insert($table, array(
            'user_id' => $user_id,
            'town_id' => $town_id,
            'town_name' => $town_name,
            'save_data' => $save_data,
            'season' => $season,
            'year' => $year,
            'day' => $day,
            'population' => $population,
        ));
    }

    return rest_ensure_response(array('success' => true, 'town_id' => $town_id));
}

function rimtown_api_load_save($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_saves';
    $user_id = get_current_user_id();
    $town_id = sanitize_text_field($request->get_param('town_id'));

    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT save_data FROM $table WHERE user_id = %d AND town_id = %s",
        $user_id, $town_id
    ));

    if (!$row) {
        return new WP_Error('not_found', '找不到此存檔', array('status' => 404));
    }

    return rest_ensure_response(array('save_data' => $row->save_data));
}

function rimtown_api_delete_save($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_saves';
    $user_id = get_current_user_id();
    $town_id = sanitize_text_field($request->get_param('town_id'));

    $wpdb->delete($table, array('user_id' => $user_id, 'town_id' => $town_id));
    return rest_ensure_response(array('success' => true));
}

// --- Achievements ---
function rimtown_api_get_achievements($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_achievements';
    $user_id = get_current_user_id();

    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT achievement_key, unlocked_at, town_id FROM $table WHERE user_id = %d",
        $user_id
    ));

    return rest_ensure_response(array('achievements' => $rows));
}

function rimtown_api_unlock_achievement($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'rimtown_achievements';
    $user_id = get_current_user_id();
    $key = sanitize_text_field($request->get_param('key'));
    $town_id = sanitize_text_field($request->get_param('town_id'));

    if (empty($key)) {
        return new WP_Error('missing_key', '缺少成就代碼', array('status' => 400));
    }

    // Insert ignore — don't error on duplicate
    $wpdb->query($wpdb->prepare(
        "INSERT IGNORE INTO $table (user_id, achievement_key, town_id) VALUES (%d, %s, %s)",
        $user_id, $key, $town_id
    ));

    return rest_ensure_response(array('success' => true, 'key' => $key));
}

// Pass nonce and login state to frontend
function rimtown_localize_script() {
    $user = wp_get_current_user();
    wp_localize_script('rimtown-app', 'rimtownAuth', array(
        'restUrl' => esc_url_raw(rest_url('rimtown/v1/')),
        'nonce' => wp_create_nonce('wp_rest'),
        'loggedIn' => is_user_logged_in(),
        'username' => is_user_logged_in() ? $user->user_login : '',
        'userId' => is_user_logged_in() ? $user->ID : 0,
    ));
}

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
                    <label>備用 Groq API Key <span style="font-size:11px;color:var(--text-secondary)">（主 AI 超限時自動切換）</span></label>
                    <input type="password" id="fallback-groq-key" placeholder="gsk_... （選填，免費申請於 console.groq.com）">
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

        <!-- Auth Modal -->
        <div id="auth-modal" class="modal hidden">
            <div class="modal-content auth-content">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-auth-tab="login">登入</button>
                    <button class="auth-tab" data-auth-tab="register">註冊</button>
                </div>
                <div id="auth-login-form" class="auth-form">
                    <div class="setting-group"><label>使用者名稱</label><input type="text" id="auth-login-user" placeholder="輸入帳號..." autocomplete="username"></div>
                    <div class="setting-group"><label>密碼</label><input type="password" id="auth-login-pass" placeholder="輸入密碼..." autocomplete="current-password"></div>
                    <div id="auth-login-error" class="auth-error"></div>
                    <div class="modal-buttons"><button id="auth-login-btn" class="btn-accent">登入</button><button class="auth-close-btn">取消</button></div>
                    <div style="text-align:center;margin-top:8px"><a href="#" id="auth-forgot-link" style="font-size:0.72rem;color:var(--accent-light)">忘記密碼？</a></div>
                </div>
                <div id="auth-register-form" class="auth-form hidden">
                    <div class="setting-group"><label>使用者名稱</label><input type="text" id="auth-reg-user" placeholder="至少3個字元..." autocomplete="username"></div>
                    <div class="setting-group"><label>電子郵件（選填）</label><input type="email" id="auth-reg-email" placeholder="your@email.com" autocomplete="email"></div>
                    <div class="setting-group"><label>密碼</label><input type="password" id="auth-reg-pass" placeholder="至少6個字元..." autocomplete="new-password"></div>
                    <div class="setting-group"><label>確認密碼</label><input type="password" id="auth-reg-pass2" placeholder="再次輸入密碼..." autocomplete="new-password"></div>
                    <div id="auth-reg-error" class="auth-error"></div>
                    <div class="modal-buttons"><button id="auth-reg-btn" class="btn-accent">註冊</button><button class="auth-close-btn">取消</button></div>
                </div>
                <div id="auth-reset-form" class="auth-form hidden">
                    <h3 style="font-size:0.8rem;color:var(--text-primary);margin-bottom:8px">重設密碼</h3>
                    <p style="font-size:0.68rem;color:var(--text-muted);margin-bottom:10px">輸入您的帳號和註冊時的電子郵件來重設密碼</p>
                    <div class="setting-group"><label>使用者名稱</label><input type="text" id="auth-reset-user" placeholder="輸入帳號..." autocomplete="username"></div>
                    <div class="setting-group"><label>電子郵件</label><input type="email" id="auth-reset-email" placeholder="註冊時的信箱..." autocomplete="email"></div>
                    <div class="setting-group"><label>新密碼</label><input type="password" id="auth-reset-pass" placeholder="至少6個字元..." autocomplete="new-password"></div>
                    <div class="setting-group"><label>確認新密碼</label><input type="password" id="auth-reset-pass2" placeholder="再次輸入新密碼..." autocomplete="new-password"></div>
                    <div id="auth-reset-error" class="auth-error"></div>
                    <div id="auth-reset-success" class="auth-error" style="color:var(--accent)"></div>
                    <div class="modal-buttons"><button id="auth-reset-btn" class="btn-accent">重設密碼</button><button id="auth-reset-back" class="auth-close-btn">返回登入</button></div>
                </div>
            </div>
        </div>

        <!-- Achievement Toast -->
        <div id="achievement-toast" class="achievement-toast hidden"></div>

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
                    <button id="btn-account" class="btn-account" title="帳號">帳號</button>
                </div>
            </div>
        </div>

        <!-- Mobile Compact Header (only visible on mobile) -->
        <div class="mobile-header">
            <div class="mobile-header-row">
                <span class="mobile-title">邊境鎮</span>
                <span id="mobile-clock" class="mobile-clock">載入中...</span>
                <div class="mobile-header-actions">
                    <button id="mobile-btn-pause" class="mobile-ctrl-btn" title="暫停/播放">⏸</button>
                    <button id="mobile-btn-menu" class="mobile-ctrl-btn" title="選單">⋯</button>
                </div>
            </div>
            <div id="mobile-menu-dropdown" class="mobile-menu-dropdown hidden">
                <button data-action="show-towns">城鎮列表</button>
                <button id="mobile-new-game">新地圖</button>
                <button id="mobile-save">儲存</button>
                <button id="mobile-btn-settings">設定</button>
                <button id="mobile-btn-account">帳號</button>
                <div class="mobile-menu-speed">
                    <span>速度</span>
                    <div class="speed-controls">
                        <button class="btn-speed active" data-speed="1">1x</button>
                        <button class="btn-speed" data-speed="1.5">1.5</button>
                        <button class="btn-speed" data-speed="2">2x</button>
                        <button class="btn-speed" data-speed="3">3x</button>
                    </div>
                </div>
                <div class="mobile-menu-ai">
                    <span id="mobile-llm-status" class="llm-status" title="AI 狀態">AI:--</span>
                </div>
            </div>
        </div>

        <!-- Main Layout -->
        <div class="main-layout">
            <div class="map-panel">
                <canvas id="town-map-canvas"></canvas>
                <div class="town-map" id="town-map" style="display:none"></div>
            </div>
            <div class="rt-sidebar" id="rimtown-sidebar">
                <button class="mobile-back-to-map" id="mobile-back-to-map">&#9650; 返回地圖</button>
                <div class="mobile-drag-handle" id="mobile-drag-handle"></div>
                <div class="rt-sidebar-tabs">
                    <button data-tab="residents" class="active">居民</button>
                    <button data-tab="chat">聊天</button>
                    <button data-tab="detail">詳情</button>
                    <button data-tab="economy">經濟</button>
                    <button data-tab="log">日誌</button>
                    <button data-tab="events">事件</button>
                </div>
                <div class="rt-sidebar-content" id="sidebar-content"></div>
            </div>
            <button class="mobile-sidebar-toggle" id="mobile-sidebar-toggle" title="顯示側欄">&#9776;</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('rimtown', 'rimtown_shortcode');

/**
 * Landing page shortcode [rimtown_landing]
 * A cinematic intro/homepage for the RimTown game.
 */
function rimtown_landing_shortcode($atts) {
    $atts = shortcode_atts(array(
        'game_url' => '/rimtown/',
    ), $atts, 'rimtown_landing');

    $game_url = esc_url($atts['game_url']);

    ob_start();
    ?>
    <div class="rt-landing">

        <!-- Pixel art canvas background (animated) -->
        <canvas id="rt-landing-bg" class="rt-landing-bg"></canvas>

        <!-- Hero Section -->
        <section class="rt-hero">
            <div class="rt-hero-content">
                <div class="rt-logo-group">
                    <div class="rt-pixel-icon">
                        <canvas id="rt-logo-canvas" width="64" height="64"></canvas>
                    </div>
                    <h1 class="rt-title">
                        <span class="rt-title-zh">邊境鎮</span>
                        <span class="rt-title-en">RimTown</span>
                    </h1>
                </div>
                <p class="rt-tagline">AI 驅動的像素風小鎮模擬 — 每個居民都有自己的靈魂</p>
                <div class="rt-hero-buttons">
                    <a href="<?php echo $game_url; ?>" class="rt-btn rt-btn-primary">
                        <span class="rt-btn-icon">&#9654;</span> 開始遊玩
                    </a>
                    <a href="#rt-features" class="rt-btn rt-btn-secondary">了解更多</a>
                </div>
                <div class="rt-hero-badges">
                    <span class="rt-badge">免費遊玩</span>
                    <span class="rt-badge">無需下載</span>
                    <span class="rt-badge">支援手機</span>
                </div>
            </div>
            <div class="rt-scroll-hint">
                <span>&#9660;</span>
            </div>
        </section>

        <!-- Features Section -->
        <section id="rt-features" class="rt-section rt-features">
            <h2 class="rt-section-title">遊戲特色</h2>
            <div class="rt-features-grid">
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x1F9E0;</div>
                    <h3>AI 驅動的居民</h3>
                    <p>每位居民擁有獨特的性格、記憶與情感。他們會自主社交、爭吵、戀愛、結婚，甚至劈腿被發現而分手。所有對話都由 AI 即時生成。</p>
                </div>
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x1F3D8;</div>
                    <h3>經營你的小鎮</h3>
                    <p>管理資源、建造設施、發展經濟與貿易。從一個小村落開始，打造繁榮的邊境城鎮。每個決策都會影響居民的生活。</p>
                </div>
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x1F5F3;</div>
                    <h3>鎮長選舉</h3>
                    <p>居民會根據關係、價值觀和候選人魅力投票選舉鎮長。當選者的政策會實際影響鎮上的經濟、文化與安全。</p>
                </div>
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x1F4AC;</div>
                    <h3>與居民對話</h3>
                    <p>直接和任何居民聊天。問他們對鄰居的看法、最近的八卦、或是人生煩惱。每個人的回答都基於他們真實的記憶與感受。</p>
                </div>
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x2764;</div>
                    <h3>複雜的人際關係</h3>
                    <p>友情、暗戀、交往、結婚、外遇、離婚⋯⋯居民之間的感情由性格相容度、互動頻率和事件自然發展，產生真實的人間戲劇。</p>
                </div>
                <div class="rt-feature-card">
                    <div class="rt-feature-pixel">&#x1F30D;</div>
                    <h3>動態世界事件</h3>
                    <p>季節變化、隨機事件、商隊來訪、盜賊襲擊⋯⋯世界不會靜止。每一天都可能發生改變小鎮命運的事件。</p>
                </div>
            </div>
        </section>

        <!-- How It Works Section -->
        <section class="rt-section rt-how">
            <h2 class="rt-section-title">如何運作</h2>
            <div class="rt-steps">
                <div class="rt-step">
                    <div class="rt-step-number">1</div>
                    <div class="rt-step-content">
                        <h3>開啟遊戲</h3>
                        <p>直接在瀏覽器中遊玩，不需要下載任何東西。支援電腦、平板和手機。</p>
                    </div>
                </div>
                <div class="rt-step">
                    <div class="rt-step-number">2</div>
                    <div class="rt-step-content">
                        <h3>觀察與互動</h3>
                        <p>看著居民自主生活、工作和社交。點擊任何居民查看詳細資訊，或直接和他們聊天。</p>
                    </div>
                </div>
                <div class="rt-step">
                    <div class="rt-step-number">3</div>
                    <div class="rt-step-content">
                        <h3>經營與發展</h3>
                        <p>管理資源、建造新設施、研究新科技，讓你的小鎮從邊境村落成長為繁華城鎮。</p>
                    </div>
                </div>
                <div class="rt-step">
                    <div class="rt-step-number">4</div>
                    <div class="rt-step-content">
                        <h3>連接 AI（選用）</h3>
                        <p>設定你的 AI API 金鑰（Claude、GPT、Gemini 等），解鎖更豐富、更有深度的居民對話。不設定也能完整遊玩。</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- AI Providers Section -->
        <section class="rt-section rt-ai-section">
            <h2 class="rt-section-title">支援的 AI 模型</h2>
            <p class="rt-section-subtitle">連接你喜歡的 AI 服務，讓居民對話更生動</p>
            <div class="rt-ai-grid">
                <div class="rt-ai-card">
                    <div class="rt-ai-name">Anthropic</div>
                    <div class="rt-ai-model">Claude</div>
                </div>
                <div class="rt-ai-card">
                    <div class="rt-ai-name">OpenAI</div>
                    <div class="rt-ai-model">GPT</div>
                </div>
                <div class="rt-ai-card">
                    <div class="rt-ai-name">Google</div>
                    <div class="rt-ai-model">Gemini</div>
                </div>
                <div class="rt-ai-card">
                    <div class="rt-ai-name">DeepSeek</div>
                    <div class="rt-ai-model">DeepSeek</div>
                </div>
                <div class="rt-ai-card">
                    <div class="rt-ai-name">Groq</div>
                    <div class="rt-ai-model">Groq</div>
                </div>
                <div class="rt-ai-card">
                    <div class="rt-ai-name">Together AI</div>
                    <div class="rt-ai-model">Together</div>
                </div>
            </div>
            <p class="rt-ai-note">* 不設定 AI 也能遊玩！內建模擬對話系統可產生豐富的互動內容。</p>
        </section>

        <!-- Screenshots / Preview Section -->
        <section class="rt-section rt-preview">
            <h2 class="rt-section-title">遊戲畫面</h2>
            <div class="rt-preview-grid">
                <div class="rt-preview-card">
                    <div class="rt-preview-mock rt-mock-map">
                        <canvas id="rt-preview-map" width="320" height="200"></canvas>
                    </div>
                    <p>像素風格的即時地圖</p>
                </div>
                <div class="rt-preview-card">
                    <div class="rt-preview-mock rt-mock-chat">
                        <div class="rt-mock-msg rt-mock-npc">
                            <strong>林美</strong>
                            <span>最近診所來的病人越來越多了，我都快忙不過來了。</span>
                        </div>
                        <div class="rt-mock-msg rt-mock-player">
                            <span>辛苦了！需要什麼幫助嗎？</span>
                        </div>
                        <div class="rt-mock-msg rt-mock-npc">
                            <strong>林美</strong>
                            <span>如果能多蓋一間藥房就好了⋯⋯對了，你有聽說陳偉和王麗的事嗎？</span>
                        </div>
                    </div>
                    <p>和居民即時對話</p>
                </div>
                <div class="rt-preview-card">
                    <div class="rt-preview-mock rt-mock-relations">
                        <div class="rt-mock-rel">
                            <span class="rt-rel-names">陳偉 &amp; 王麗</span>
                            <span class="rt-rel-status rt-rel-dating">交往中</span>
                        </div>
                        <div class="rt-mock-rel">
                            <span class="rt-rel-names">張豪 &amp; 劉俊</span>
                            <span class="rt-rel-status rt-rel-friend">好友</span>
                        </div>
                        <div class="rt-mock-rel">
                            <span class="rt-rel-names">趙霞 &amp; 楊鋒</span>
                            <span class="rt-rel-status rt-rel-rival">敵對</span>
                        </div>
                    </div>
                    <p>複雜的人際關係網</p>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="rt-section rt-cta">
            <div class="rt-cta-content">
                <h2>準備好了嗎？</h2>
                <p>你的邊境小鎮正在等你。居民們已經準備好迎接新的鎮長了。</p>
                <a href="<?php echo $game_url; ?>" class="rt-btn rt-btn-primary rt-btn-lg">
                    <span class="rt-btn-icon">&#9654;</span> 立即開始
                </a>
            </div>
        </section>

        <!-- Footer -->
        <footer class="rt-footer">
            <div class="rt-footer-content">
                <div class="rt-footer-brand">
                    <span class="rt-footer-logo">邊境鎮</span>
                    <span class="rt-footer-ver">v<?php echo RIMTOWN_VERSION; ?></span>
                </div>
                <div class="rt-footer-links">
                    <a href="https://github.com/virus11456/RimTown" target="_blank" rel="noopener">GitHub</a>
                    <span class="rt-footer-sep">|</span>
                    <span>MIT License</span>
                    <span class="rt-footer-sep">|</span>
                    <span>Made with AI</span>
                </div>
            </div>
        </footer>
    </div>

    <script>
    (function() {
        // === Animated pixel background ===
        const canvas = document.getElementById('rt-landing-bg');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w, h, cols, rows;
        const S = 16;
        const grassColors = ['#3a7d2c','#4a8c3a','#5a9a4a','#3d8030','#4d9040'];
        const darkGrass = ['#2a5d1c','#356828','#2e6020','#385e2a'];
        let grid = [];
        let frame = 0;

        function resize() {
            w = canvas.parentElement.clientWidth;
            h = canvas.parentElement.clientHeight;
            canvas.width = w;
            canvas.height = h;
            cols = Math.ceil(w / S) + 1;
            rows = Math.ceil(h / S) + 1;
            grid = [];
            for (let y = 0; y < rows; y++) {
                grid[y] = [];
                for (let x = 0; x < cols; x++) {
                    grid[y][x] = Math.random();
                }
            }
        }
        resize();
        window.addEventListener('resize', resize);

        function draw() {
            frame++;
            ctx.clearRect(0, 0, w, h);
            // Draw grass tiles
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const r = grid[y][x];
                    ctx.fillStyle = grassColors[Math.floor(r * grassColors.length)];
                    ctx.fillRect(x * S, y * S, S, S);
                    // Blade detail
                    ctx.fillStyle = darkGrass[Math.floor(r * darkGrass.length)];
                    ctx.fillRect(x * S + (r * 8 | 0), y * S + 2, 1, 4);
                    ctx.fillRect(x * S + (r * 12 | 0), y * S + 6, 1, 3);
                }
            }
            // Subtle animated light sweep
            const sweep = (Math.sin(frame * 0.005) * 0.5 + 0.5) * w;
            const grad = ctx.createRadialGradient(sweep, h * 0.3, 0, sweep, h * 0.3, w * 0.6);
            grad.addColorStop(0, 'rgba(255,255,200,0.03)');
            grad.addColorStop(1, 'rgba(255,255,200,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            // Dark overlay to not distract from content
            ctx.fillStyle = 'rgba(10,10,30,0.75)';
            ctx.fillRect(0, 0, w, h);
            requestAnimationFrame(draw);
        }
        draw();

        // === Pixel art logo ===
        const logoCanvas = document.getElementById('rt-logo-canvas');
        if (logoCanvas) {
            const lc = logoCanvas.getContext('2d');
            lc.imageSmoothingEnabled = false;
            // Draw a simple house icon
            const px = (x, y, c) => { lc.fillStyle = c; lc.fillRect(x * 4, y * 4, 4, 4); };
            // Roof
            for (let i = 0; i < 7; i++) { px(5 + i, 2 + Math.abs(i - 3), '#b71c1c'); }
            for (let i = 0; i < 5; i++) { px(6 + i, 3 + Math.abs(i - 2), '#c62828'); }
            // Walls
            for (let y = 6; y < 12; y++) for (let x = 4; x < 12; x++) px(x, y, '#8d6e63');
            for (let y = 7; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, '#a1887f');
            // Door
            px(7, 9, '#4e342e'); px(8, 9, '#4e342e'); px(7, 10, '#4e342e'); px(8, 10, '#4e342e'); px(7, 11, '#4e342e'); px(8, 11, '#4e342e');
            // Window
            px(5, 8, '#64b5f6'); px(6, 8, '#64b5f6'); px(10, 8, '#64b5f6'); px(10, 9, '#64b5f6');
            // Chimney
            px(10, 2, '#795548'); px(10, 3, '#795548'); px(10, 1, '#9e9e9e');
            // Ground
            for (let x = 2; x < 14; x++) px(x, 12, '#4caf50');
            for (let x = 1; x < 15; x++) px(x, 13, '#388e3c');
            // Tree
            px(2, 8, '#2e7d32'); px(2, 9, '#388e3c'); px(1, 9, '#2e7d32'); px(3, 9, '#2e7d32');
            px(2, 10, '#4e342e'); px(2, 11, '#4e342e');
            // Person
            px(13, 9, '#ffcc80'); // head
            px(13, 10, '#e94560'); px(13, 11, '#1565c0'); // body + legs
        }

        // === Preview map mini canvas ===
        const mapCanvas = document.getElementById('rt-preview-map');
        if (mapCanvas) {
            const mc = mapCanvas.getContext('2d');
            mc.imageSmoothingEnabled = false;
            const S2 = 8;
            const cols2 = 40, rows2 = 25;
            for (let y = 0; y < rows2; y++) {
                for (let x = 0; x < cols2; x++) {
                    const r = Math.random();
                    if (x > 15 && x < 25 && y > 8 && y < 17) {
                        // Buildings area
                        if (r < 0.3) mc.fillStyle = '#8d6e63';
                        else if (r < 0.5) mc.fillStyle = '#b71c1c';
                        else mc.fillStyle = '#a1887f';
                    } else if ((x === 15 || x === 25) && y > 5 && y < 20) {
                        mc.fillStyle = '#9e9e9e'; // path
                    } else if (y === 12 && x > 5 && x < 35) {
                        mc.fillStyle = '#9e9e9e'; // path
                    } else if (x > 30 && y < 8) {
                        mc.fillStyle = r < 0.5 ? '#1565c0' : '#1976d2'; // water
                    } else if (x < 6 && y > 15) {
                        mc.fillStyle = r < 0.5 ? '#2e7d32' : '#1b5e20'; // forest
                    } else {
                        mc.fillStyle = grassColors[Math.floor(r * grassColors.length)];
                    }
                    mc.fillRect(x * S2, y * S2, S2, S2);
                }
            }
            // Little agent dots
            const dots = [[18,10,'#ffcc80'],[20,12,'#e94560'],[22,14,'#64b5f6'],[24,11,'#ffd54f'],[17,15,'#ce93d8']];
            dots.forEach(([x,y,c]) => {
                mc.fillStyle = c;
                mc.fillRect(x*S2+2, y*S2+1, 4, 6);
                mc.fillStyle = '#ffcc80';
                mc.fillRect(x*S2+2, y*S2-1, 4, 3);
            });
        }

        // === Smooth scroll for anchor links ===
        document.querySelectorAll('.rt-landing a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                const target = document.querySelector(a.getAttribute('href'));
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });

        // === Scroll-triggered animations ===
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('rt-visible');
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.rt-feature-card, .rt-step, .rt-ai-card, .rt-preview-card').forEach(el => {
            observer.observe(el);
        });
    })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('rimtown_landing', 'rimtown_landing_shortcode');

/**
 * Enqueue landing page styles when shortcode is used
 */
function rimtown_landing_assets() {
    global $post;
    if ($post && has_shortcode($post->post_content, 'rimtown_landing')) {
        wp_enqueue_style(
            'rimtown-landing-style',
            RIMTOWN_URL . 'landing.css',
            array(),
            RIMTOWN_VERSION
        );
    }
}
add_action('wp_enqueue_scripts', 'rimtown_landing_assets');

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

    // Pass auth data to frontend
    rimtown_localize_script();
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
 * Inject critical inline CSS for mobile viewport lock (runs before theme CSS)
 */
function rimtown_head_styles() {
    global $post;
    if (!$post || !has_shortcode($post->post_content, 'rimtown')) return;
    echo '<style>
        html.rimtown-active, html.rimtown-active body {
            overflow: hidden !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        html.rimtown-active .rimtown-container {
            position: fixed !important;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 99990;
            background: #1a1a2e;
        }
    </style>';
    echo '<script>document.documentElement.classList.add("rimtown-active");</script>';
}
add_action('wp_head', 'rimtown_head_styles', 1);

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
            'version' => '2.3.7',
            'date'    => '2026-03-09',
            'changes' => array(
                '修復 DeepSeek、Qwen 等模型回覆包含 <think> 推理標籤直接顯示在聊天中的問題',
                '新增 _stripThinkTags() 統一過濾 LLM 回傳的推理標籤',
                '強化所有 AI prompt 的繁體中文（台灣用語）要求，避免模型回覆簡體中文',
                '修正插件 header 版本號與 RIMTOWN_VERSION 不一致',
            ),
        ),
        array(
            'version' => '2.3.6',
            'date'    => '2026-03-09',
            'changes' => array(
                'Groq 預設模型從 Llama 3.3 70B 改為 Qwen3-32B（中文對話品質大幅提升）',
                '新增自動 Groq 備援機制：主 AI 遇到 429 rate limit 或錯誤時，自動切換到備用 Groq',
                '設定頁面新增「備用 Groq API Key」欄位（選填，免費申請於 console.groq.com）',
                '只填備用 Groq Key 不設主 AI 時，直接使用 Groq 作為主要 AI',
                '主 AI 冷卻機制：首次失敗冷卻 60 秒，重複失敗逐步延長至最多 5 分鐘',
                '主 AI 恢復正常後自動切回，無需手動操作',
            ),
        ),
        array(
            'version' => '2.3.5',
            'date'    => '2026-03-09',
            'changes' => array(
                '統一所有 AI provider 速率限制為 20 次/分鐘',
                '移除 MiniMax 特殊限制（NPC 冷卻、token 上限）',
            ),
        ),
        array(
            'version' => '2.3.4',
            'date'    => '2026-03-09',
            'changes' => array(
                'MiniMax 省額度模式：API 每分鐘限 2 次（其他 provider 保持 12 次）',
                'MiniMax NPC 自動對話冷卻提升至 150 ticks（約每 5 分鐘 1 次），優先保留額度給玩家對話',
                'MiniMax NPC 對話 token 上限降至 400（其他 provider 保持 800）',
            ),
        ),
        array(
            'version' => '2.3.3',
            'date'    => '2026-03-09',
            'changes' => array(
                '修復登入後雲端存檔/成就 403 錯誤（Cookie 驗證失敗）',
                '登入/註冊 API 回傳新 nonce，前端自動更新認證令牌',
            ),
        ),
        array(
            'version' => '2.3.2',
            'date'    => '2026-03-09',
            'changes' => array(
                '修復設定面板下拉選單缺少 MiniMax 選項（rimtown.php HTML）',
            ),
        ),
        array(
            'version' => '2.3.1',
            'date'    => '2026-03-09',
            'changes' => array(
                '修復 Chrome Extension 版缺少 MiniMax provider 的問題',
                '新增 MiniMax API 端點與專屬請求處理',
                '移除 chrome-extension/app.js 中誤將 minimax 標記為 deprecated 的清除邏輯',
            ),
        ),
        array(
            'version' => '2.3.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '恢復 MiniMax（中國版）LLM provider：端點 api.minimaxi.com，模型 MiniMax-M2.5',
                'AI 設定強制單一綁定：切換 provider 時自動清空 API Key，防止誤綁多個',
                '儲存時驗證：選了 AI 供應商就必須填入 API Key',
                'Fallback 對話模板全面重寫：所有對話更長、更有戲劇張力',
                '新增豐富細節池：季節美食、場景描寫、禮物清單、鎮上傳聞',
                '所有對話摘要改為小說風格，包含地點/季節/情感描寫',
            ),
        ),
        array(
            'version' => '2.2.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '派系/社交圈系統：NPC 自動組成小團體（工作夥伴、酒友、八卦圈等），含凝聚力、競爭、結盟與內部戲劇',
                '季節節慶系統：春季慶典、仲夏篝火、豐收祭、冬至節，含特殊任務、裝飾與全鎮慶祝活動',
                'NPC 生死/老化系統：NPC 每季老化，可因老年/疾病/意外死亡，已婚夫妻可生育子女',
                '墓園系統：死亡 NPC 安葬於墓園，附墓誌銘紀念',
                '探索/地圖擴展：城鎮外 6 個可發現區域（森林、遺跡、礦坑、山脈、洞穴、沼澤）',
                '探險隊派遣機制：選派居民出征探索，帶回資源與發現',
                '事件頁籤新增派系、節慶、墓園、探索 UI 面板',
                '地圖渲染：探索標記、墓碑、節慶裝飾',
                '新增 8 個成就（派系、節慶、生死、探索相關）',
            ),
        ),
        array(
            'version' => '2.1.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '忘記密碼功能：透過帳號+電子郵件驗證重設密碼',
                '新註冊用戶自動獲得全新村莊，不帶任何舊資料或對話',
                '手機版排版大改版：地圖佔 75%、功能區佔 25%',
                '手機版新頂部欄：標題+時間+人口合併為一行，控制按鈕收進下拉選單',
                '功能面板改為底部常駐（標籤頁永遠可見），上滑展開、下滑收合',
                '新增拖拽手柄，支援觸控滑動展開/收合功能面板',
                '桌面版完全不受影響',
            ),
        ),
        array(
            'version' => '2.0.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '帳號系統：使用者註冊/登入，雲端存檔自動同步',
                '成就系統：30+ 成就里程碑，遊戲內通知',
                'NPC 對話可視化：地圖對話氣泡 + 偷聽日誌',
                '玩家深度互動：選擇職業、工作、投票、戀愛求婚',
                '雲端存檔：多裝置同步，最多20個城鎮',
            ),
        ),
        array(
            'version' => '1.5.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '夜晚效果重新設計：移除濃霧覆蓋，改用篝火、火把和極淡藍色調',
                '篝火系統：廣場、酒館、守衛站、水井處有動態火焰動畫',
                '建築旁自動放置閃爍火把，提供溫暖光暈',
                '感情系統強化：新增自然浪漫吸引力（基於性格相容度）',
                '降低交往/求婚門檻，增加每次對話的浪漫火花機率',
                '地圖全螢幕顯示：Canvas 自動填滿容器，無邊框',
                '新增雙指縮放（pinch-to-zoom）和拖曳平移',
                '桌面支援滾輪縮放和拖曳平移',
                '最小縮放自動計算，最大放大 4 倍',
                '新增 [rimtown_landing] 首頁短碼：動畫像素背景、特色介紹、AI 模型展示',
                '提供獨立 landing.html 單檔首頁，無需 WordPress',
            ),
        ),
        array(
            'version' => '1.3.0',
            'date'    => '2026-03-09',
            'changes' => array(
                '新增鎮長選舉系統：居民根據個性、價值觀、關係投票',
                '選舉流程：競選期（3天）→ 投票期（2天）→ 結果公告（3天）',
                '6 種政策主張：經濟發展、社會福利、軍事防禦、文化教育、自然保育、個人自由',
                '候選人根據個性與價值觀自動選擇政策',
                '投票依據：關係親密度(40%)、價值觀契合(30%)、魅力能力(20%)、隨機(10%)',
                '當選鎮長的政策會產生 30 天持續效果（透過新聞系統）',
                '選舉 UI：即時票數、進度條、結果展示（事件頁籤）',
                '選舉歷史記錄，可在存檔中保存/載入',
                '修正 MiniMax API：模型更新為 M2.5、參數修正為 max_completion_tokens',
                '更新 Gemini 預設模型為 gemini-2.5-flash',
            ),
        ),
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
