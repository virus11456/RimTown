<?php
/**
 * Plugin Name: RimTown - AI Town Simulation
 * Plugin URI: https://github.com/virus11456/RimTown
 * Description: RimWorld 風格的 AI 小鎮模擬遊戲。使用 [rimtown] 短碼嵌入頁面。
 * Version: 5.67.4
 * Author: RimTown Team
 * License: MIT
 * Text Domain: rimtown
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RIMTOWN_VERSION', '5.67.4');
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
        <!-- Guest mode banner -->
        <div id="guest-banner" class="hidden">
            <span>🎮 訪客模式 — 存檔僅保留在本機</span>
            <button id="guest-register-btn">註冊帳號</button>
            <button id="guest-banner-close">✕</button>
        </div>
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
                        <option value="server">🏘️ 小鎮伺服器 AI（免金鑰）</option>
                        <option value="none">無（模擬對話）</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (gpt-4o-mini)</option>
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
                    <label><span data-i18n="備用 Groq API Key">備用 Groq API Key</span> <span style="font-size:11px;color:var(--text-secondary)" data-i18n="主 AI 超限時自動切換">（主 AI 超限時自動切換）</span></label>
                    <input type="password" id="fallback-groq-key" placeholder="gsk_...">
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
                <div class="setting-group">
                    <label data-i18n="語言">語言</label>
                    <select id="lang-select">
                        <option value="zh">繁體中文</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div class="setting-group">
                    <label>背景音樂</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <button id="bgm-toggle" class="btn-icon" title="靜音" style="font-size:18px;padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;">🔊</button>
                        <input id="bgm-volume" type="range" min="0" max="100" value="20" style="flex:1;">
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="settings-save" class="btn-accent">儲存</button>
                    <button id="settings-cancel">取消</button>
                </div>
            </div>
        </div>

        <!-- Header (desktop) -->
        <div class="header">
            <h1 data-i18n="邊境鎮">邊境鎮</h1>
            <div class="header-info">
                <span id="population-count">人口：--</span>
                <span id="clock-display" class="clock-display" data-i18n="載入中...">載入中...</span>
                <span id="terrain-display" class="terrain-display"></span>
                <span id="weather-display" class="weather-display"></span>
                <div class="controls">
                    <button class="btn-towns" data-action="show-towns" data-i18n="城鎮列表">城鎮列表</button>
                    <button id="btn-new-game" class="btn-new-game" data-i18n="新地圖">新地圖</button>
                    <button id="btn-save" class="btn-save" data-i18n="儲存">儲存</button>
                    <button id="btn-pause" data-i18n="暫停">暫停</button>
                    <button id="btn-resume" class="active" data-i18n="播放">播放</button>
                    <div class="speed-controls">
                        <button class="btn-speed active" data-speed="1">1x</button>
                        <button class="btn-speed" data-speed="1.5">1.5x</button>
                        <button class="btn-speed" data-speed="2">2x</button>
                        <button class="btn-speed" data-speed="3">3x</button>
                    </div>
                    <span id="llm-status" class="llm-status" data-i18n-title="AI 狀態" title="AI 狀態">AI:--</span>
                    <button id="btn-account" class="btn-account" data-i18n="帳號">帳號</button>
                    <button id="btn-settings" class="btn-settings" data-i18n="設定">設定</button>
                    <span id="version-display" class="version-display"></span>
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
                <div class="rt-sidebar-tabs">
                    <button data-tab="economy"><span class="tab-icon">🏙️</span><span class="tab-label">小鎮</span></button>
                    <button data-tab="residents" data-tab-badge="chat" class="active"><span class="tab-icon">👥</span><span class="tab-label">居民</span></button>
                    <button data-tab="quest"><span class="tab-icon">📖</span><span class="tab-label">故事</span></button>
                    <button data-tab="settings"><span class="tab-icon">⚙️</span><span class="tab-label">設定</span></button>
                </div>
                <div class="rt-sidebar-content" id="sidebar-content"></div>
            </div>
            <!-- mobile-sidebar-toggle removed: was non-functional -->
        </div>
        <!-- Tutorial Overlay -->
        <div id="tutorial-overlay" class="tutorial-overlay hidden">
            <div class="tutorial-card">
                <div class="tutorial-step" data-step="0">
                    <div class="tutorial-step-icon">🏘️</div>
                    <h3>歡迎來到邊境鎮</h3>
                    <div class="tutorial-step-text">
                        <p>作為這座 <strong>邊境鎮</strong> 的管理者，你需要引導居民們建設家園、發展經濟、抵禦外敵，並見證他們之間的愛恨情仇。</p>
                        <ul>
                            <li>📖 主線五章劇情，多路線自由選擇</li>
                            <li>🎭 20+ 位性格鮮明的居民</li>
                            <li>💬 AI 驅動的真實對話</li>
                        </ul>
                    </div>
                </div>
                <div class="tutorial-step hidden" data-step="1">
                    <div class="tutorial-step-icon">🗺️</div>
                    <h3>地圖與居民</h3>
                    <div class="tutorial-step-text">
                        <p>左側是即時更新的 <strong>城鎮地圖</strong>，居民們會在鎮上移動、工作、社交。</p>
                        <ul>
                            <li>👥 點擊「居民」查看所有鎮民</li>
                            <li>🏠 建築會出現在地圖上</li>
                            <li>🌙 日夜交替，天氣變化</li>
                        </ul>
                    </div>
                </div>
                <div class="tutorial-step hidden" data-step="2">
                    <div class="tutorial-step-icon">💬</div>
                    <h3>與居民聊天</h3>
                    <div class="tutorial-step-text">
                        <p>點擊「聊天」頁籤，選擇一位居民開始對話。</p>
                        <ul>
                            <li>💕 提升好感度，解鎖支線劇情</li>
                            <li>🤝 建立友誼、戀愛、甚至結婚</li>
                            <li>🧠 居民會記住你們的互動</li>
                            <li>📰 居民之間也會自己聊天、產生八卦</li>
                        </ul>
                    </div>
                </div>
                <div class="tutorial-step hidden" data-step="3">
                    <div class="tutorial-step-icon">💰</div>
                    <h3>經濟與產業</h3>
                    <div class="tutorial-step-text">
                        <p><strong>經濟</strong> 頁籤可以查看資源、建築、科技樹和貿易。</p>
                        <p><strong>產業</strong> 頁籤管理農場種植、工廠加工和產業發展。</p>
                        <ul>
                            <li>🌾 種植作物、收穫農產品</li>
                            <li>🏭 建造工廠加工原料</li>
                            <li>📈 隨著人口增長，城鎮等級提升</li>
                            <li>⚔️ 完成任務獲得獎勵</li>
                        </ul>
                    </div>
                </div>
                <div class="tutorial-step hidden" data-step="4">
                    <div class="tutorial-step-icon">📰</div>
                    <h3>事件與探索</h3>
                    <div class="tutorial-step-text">
                        <p>遊戲中會發生各種 <strong>隨機事件</strong>：</p>
                        <ul>
                            <li>🗳️ 鎮長選舉 —— 投票選出你支持的候選人</li>
                            <li>⚔️ 盜匪襲擊 —— 守衛和居民會奮力防禦</li>
                            <li>🎪 季節慶典 —— 春祭、仲夏篝火、豐收節、冬至</li>
                            <li>🗺️ 探索系統 —— 派遣探險隊探索鎮外區域</li>
                            <li>🗞️ AI 日報 —— 村莊記者會報導鎮上的大小事</li>
                        </ul>
                        <p style="color:var(--text-muted);font-size:0.72rem;margin-top:10px">提示：在設定中配置 AI 語言模型（如 Groq 免費），可以讓居民對話更加生動！</p>
                    </div>
                </div>
                <div class="tutorial-nav">
                    <button id="tutorial-prev" class="tutorial-btn hidden" onclick="window._rimtownApp?._tutorialPrev?.()">上一步</button>
                    <div class="tutorial-dots" id="tutorial-dots"></div>
                    <button id="tutorial-next" class="tutorial-btn tutorial-btn-primary" onclick="window._rimtownApp?._tutorialNext?.()">開始旅程</button>
                </div>
                <button id="tutorial-skip" class="tutorial-skip" onclick="window._rimtownApp?._dismissTutorial?.()">跳過引導</button>
            </div>
        </div>

        <!-- Game Dialog -->
        <div id="game-dialog" class="modal hidden">
            <div class="modal-content game-dialog-content">
                <div class="game-dialog-icon" id="game-dialog-icon">⚠️</div>
                <div class="game-dialog-msg" id="game-dialog-msg"></div>
                <div class="game-dialog-buttons" id="game-dialog-buttons"></div>
            </div>
        </div>

        <!-- Achievement Toast -->
        <div id="achievement-toast" class="achievement-toast hidden"></div>

        <!-- Center Notification Card Overlay -->
        <div id="center-notification-overlay" class="center-notification-overlay hidden">
            <div class="center-notification-backdrop"></div>
            <div class="center-notification-card" id="center-notification-card"></div>
        </div>

        <!-- Quest Guidance Banner -->
        <div id="quest-guidance" class="quest-guidance hidden">
            <div class="quest-guidance-icon">📋</div>
            <div class="quest-guidance-text">
                <div class="quest-guidance-title"></div>
                <div class="quest-guidance-hint"></div>
            </div>
            <button class="quest-guidance-dismiss" title="關閉提示">✕</button>
        </div>

        <!-- Mobile Header -->
        <div class="mobile-header">
            <div class="mobile-header-row">
                <span class="mobile-title" data-i18n="邊境鎮">邊境鎮</span>
                <span id="mobile-clock" class="mobile-clock" data-i18n="載入中...">載入中...</span>
                <span id="mobile-population" class="mobile-population">--</span>
                <div class="mobile-header-actions">
                    <button id="mobile-btn-pause" class="mobile-ctrl-btn">⏸</button>
                    <div class="mobile-menu-speed">
                        <button class="btn-speed active" data-speed="1">1x</button>
                        <button class="btn-speed" data-speed="1.5">1.5x</button>
                        <button class="btn-speed" data-speed="2">2x</button>
                        <button class="btn-speed" data-speed="3">3x</button>
                    </div>
                    <button id="mobile-btn-menu" class="mobile-ctrl-btn">☰</button>
                </div>
            </div>
            <div id="mobile-menu-dropdown" class="mobile-menu-dropdown hidden">
                <button id="mobile-new-game" data-i18n="新地圖">新地圖</button>
                <button id="mobile-save" data-i18n="儲存">儲存</button>
                <button id="mobile-btn-settings" data-i18n="設定">設定</button>
                <button id="mobile-btn-account" data-i18n="帳號">帳號</button>
                <span id="mobile-llm-status" class="llm-status disconnected">AI:--</span>
            </div>
        </div>

        <!-- Auth Modal -->
        <div id="auth-modal" class="modal hidden">
            <div class="modal-content login-content">
                <button class="auth-close-btn" style="position:absolute;top:8px;right:12px;background:none;border:none;color:var(--text-secondary);font-size:1.2rem;cursor:pointer">✕</button>
                <h2>👤 帳號</h2>
                <div style="display:flex;gap:0;margin-bottom:12px">
                    <button class="auth-tab active" data-auth-tab="login" style="flex:1;padding:6px;background:var(--bg-secondary);border:1px solid var(--border);border-bottom:2px solid var(--accent);color:var(--text-primary);cursor:pointer;font-size:0.8rem">登入</button>
                    <button class="auth-tab" data-auth-tab="register" style="flex:1;padding:6px;background:var(--bg-secondary);border:1px solid var(--border);border-bottom:2px solid transparent;color:var(--text-secondary);cursor:pointer;font-size:0.8rem">註冊</button>
                </div>
                <div id="auth-login-form">
                    <input type="text" id="auth-login-user" placeholder="帳號" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="password" id="auth-login-pass" placeholder="密碼" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <div id="auth-login-error" class="login-error"></div>
                    <button id="auth-login-btn" class="btn-accent" style="width:100%;padding:8px;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;margin-top:4px">登入</button>
                    <div style="margin-top:8px"><a href="#" id="auth-forgot-link" style="color:var(--text-secondary);font-size:0.75rem">忘記密碼？</a></div>
                    <div id="auth-guest-section" class="hidden" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);text-align:center">
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px">不想註冊？先體驗一下也行！</p>
                        <button id="auth-guest-btn" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:0.85rem;background:var(--bg-secondary);color:var(--text-primary)">🎮 訪客試玩</button>
                        <p style="font-size:0.65rem;color:var(--text-secondary);margin-top:4px">存檔僅保留在本機，註冊後可同步到雲端</p>
                    </div>
                </div>
                <div id="auth-register-form" class="hidden">
                    <input type="text" id="auth-reg-user" placeholder="帳號" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="email" id="auth-reg-email" placeholder="Email（選填）" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="password" id="auth-reg-pass" placeholder="密碼" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="password" id="auth-reg-pass2" placeholder="確認密碼" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <div id="auth-reg-error" class="login-error"></div>
                    <button id="auth-reg-btn" class="btn-accent" style="width:100%;padding:8px;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;margin-top:4px">註冊</button>
                </div>
                <div id="auth-reset-form" class="hidden">
                    <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px">輸入帳號和 Email 來重設密碼</p>
                    <input type="text" id="auth-reset-user" placeholder="帳號" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="email" id="auth-reset-email" placeholder="Email" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="password" id="auth-reset-pass" placeholder="新密碼" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <input type="password" id="auth-reset-pass2" placeholder="確認新密碼" style="width:100%;padding:8px;margin-bottom:6px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;box-sizing:border-box;font-size:0.85rem">
                    <div id="auth-reset-error" class="login-error"></div>
                    <div id="auth-reset-success" style="color:var(--positive);font-size:0.75rem;min-height:18px"></div>
                    <button id="auth-reset-btn" class="btn-accent" style="width:100%;padding:8px;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;margin-top:4px">重設密碼</button>
                    <div style="margin-top:8px"><a href="#" id="auth-reset-back" style="color:var(--text-secondary);font-size:0.75rem">← 返回登入</a></div>
                </div>
            </div>
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

    // i18n must load FIRST — all other scripts depend on t()
    wp_enqueue_script(
        'rimtown-i18n',
        RIMTOWN_URL . 'i18n.js',
        array(),
        RIMTOWN_VERSION,
        true
    );

    // v3 system modules (must load before simulation.js, after i18n)
    wp_enqueue_script(
        'rimtown-industry',
        RIMTOWN_URL . 'industry.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-farm',
        RIMTOWN_URL . 'farm.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-processing',
        RIMTOWN_URL . 'processing.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-daily-news',
        RIMTOWN_URL . 'daily-news.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-npc-events',
        RIMTOWN_URL . 'npc-events.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-npc-quests',
        RIMTOWN_URL . 'npc-quests.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-custom-npc',
        RIMTOWN_URL . 'custom-npc.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-prosperity',
        RIMTOWN_URL . 'prosperity.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-quest',
        RIMTOWN_URL . 'quest-system.js',
        array('rimtown-i18n'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-simulation',
        RIMTOWN_URL . 'simulation.js',
        array('rimtown-industry', 'rimtown-farm', 'rimtown-processing', 'rimtown-daily-news', 'rimtown-npc-events', 'rimtown-npc-quests', 'rimtown-custom-npc', 'rimtown-prosperity', 'rimtown-quest'),
        RIMTOWN_VERSION,
        true
    );

    wp_enqueue_script(
        'rimtown-chiptune',
        RIMTOWN_URL . 'chiptune.js',
        array('rimtown-simulation'),
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
        array('rimtown-simulation', 'rimtown-chiptune', 'rimtown-tilemap'),
        RIMTOWN_VERSION,
        true
    );

    // Inject auth data for the frontend
    wp_localize_script('rimtown-app', 'rimtownAuth', array(
        'restUrl'  => rest_url('rimtown/v1/'),
        'nonce'    => wp_create_nonce('wp_rest'),
        'loggedIn' => is_user_logged_in(),
        'username' => is_user_logged_in() ? wp_get_current_user()->user_login : '',
        'userId'   => get_current_user_id(),
    ));
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

// =====================================================
// REST API — Auth & Cloud Save
// =====================================================
add_action('rest_api_init', function () {
    $ns = 'rimtown/v1';

    // Rate limiting storage (transients)
    function rimtown_rate_limit($key, $max, $window) {
        $transient = 'rimtown_rl_' . md5($key);
        $data = get_transient($transient);
        if (!$data) $data = array('count' => 0, 'start' => time());
        if (time() - $data['start'] > $window) {
            $data = array('count' => 0, 'start' => time());
        }
        $data['count']++;
        set_transient($transient, $data, $window);
        return $data['count'] <= $max;
    }

    // Login
    register_rest_route($ns, '/login', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $params = $req->get_json_params();
            $username = sanitize_user($params['username'] ?? '');
            $password = $params['password'] ?? '';
            if (!$username || !$password) {
                return new WP_Error('missing_fields', '請輸入帳號和密碼', array('status' => 400));
            }
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!rimtown_rate_limit('login_' . $ip, 5, 300)) {
                return new WP_Error('rate_limited', '登入嘗試過多，請稍後再試', array('status' => 429));
            }
            $user = wp_authenticate($username, $password);
            if (is_wp_error($user)) {
                return new WP_Error('login_failed', '帳號或密碼錯誤', array('status' => 401));
            }
            wp_set_current_user($user->ID);
            wp_set_auth_cookie($user->ID, true);
            return array(
                'success' => true,
                'nonce' => wp_create_nonce('wp_rest'),
                'user' => array('id' => $user->ID, 'username' => $user->user_login),
            );
        },
        'permission_callback' => '__return_true',
    ));

    // Register
    register_rest_route($ns, '/register', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $params = $req->get_json_params();
            $username = sanitize_user($params['username'] ?? '');
            $password = $params['password'] ?? '';
            $email = sanitize_email($params['email'] ?? '');
            if (!$username || !$password) {
                return new WP_Error('missing_fields', '請填寫帳號和密碼', array('status' => 400));
            }
            if (strlen($password) < 6) {
                return new WP_Error('weak_password', '密碼至少6個字元', array('status' => 400));
            }
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!rimtown_rate_limit('register_' . $ip, 5, 300)) {
                return new WP_Error('rate_limited', '註冊嘗試過多，請稍後再試', array('status' => 429));
            }
            if (username_exists($username)) {
                return new WP_Error('username_exists', '此帳號已被使用', array('status' => 409));
            }
            if ($email && email_exists($email)) {
                return new WP_Error('email_exists', '此 Email 已被使用', array('status' => 409));
            }
            $user_id = wp_create_user($username, $password, $email ?: '');
            if (is_wp_error($user_id)) {
                return new WP_Error('register_failed', $user_id->get_error_message(), array('status' => 400));
            }
            wp_set_current_user($user_id);
            wp_set_auth_cookie($user_id, true);
            return array(
                'success' => true,
                'nonce' => wp_create_nonce('wp_rest'),
                'user' => array('id' => $user_id, 'username' => $username),
            );
        },
        'permission_callback' => '__return_true',
    ));

    // Reset password
    register_rest_route($ns, '/reset-password', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $params = $req->get_json_params();
            $username = sanitize_user($params['username'] ?? '');
            $email = sanitize_email($params['email'] ?? '');
            $new_password = $params['new_password'] ?? '';
            if (!$username || !$email || !$new_password) {
                return new WP_Error('missing_fields', '請填寫所有欄位', array('status' => 400));
            }
            if (strlen($new_password) < 6) {
                return new WP_Error('weak_password', '新密碼至少6個字元', array('status' => 400));
            }
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!rimtown_rate_limit('reset_' . $ip, 3, 600)) {
                return new WP_Error('rate_limited', '重設嘗試過多，請稍後再試', array('status' => 429));
            }
            $user = get_user_by('login', $username);
            if (!$user || strtolower($user->user_email) !== strtolower($email)) {
                return new WP_Error('not_found', '帳號或 Email 不正確', array('status' => 404));
            }
            wp_set_password($new_password, $user->ID);
            return array('success' => true);
        },
        'permission_callback' => '__return_true',
    ));

    // Check login status
    register_rest_route($ns, '/me', array(
        'methods' => 'GET',
        'callback' => function () {
            if (is_user_logged_in()) {
                $user = wp_get_current_user();
                return array('logged_in' => true, 'user' => array('id' => $user->ID, 'username' => $user->user_login));
            }
            return array('logged_in' => false);
        },
        'permission_callback' => '__return_true',
    ));

    // Logout
    register_rest_route($ns, '/logout', array(
        'methods' => 'POST',
        'callback' => function () {
            wp_logout();
            return array('success' => true);
        },
        'permission_callback' => '__return_true',
    ));

    // List saves
    register_rest_route($ns, '/saves', array(
        'methods' => 'GET',
        'callback' => function () {
            $user_id = get_current_user_id();
            $saves = get_user_meta($user_id, 'rimtown_saves', true);
            if (!$saves) $saves = array();
            // Return metadata only, not full save data
            $list = array();
            foreach ($saves as $town_id => $save) {
                $list[] = array(
                    'town_id' => $town_id,
                    'town_name' => $save['town_name'] ?? '',
                    'season' => $save['season'] ?? '',
                    'year' => $save['year'] ?? 1,
                    'day' => $save['day'] ?? 1,
                    'population' => $save['population'] ?? 0,
                    'updated_at' => $save['updated_at'] ?? '',
                );
            }
            return array('saves' => $list);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // Save
    register_rest_route($ns, '/save', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $user_id = get_current_user_id();
            $params = $req->get_json_params();
            $town_id = sanitize_text_field($params['town_id'] ?? '');
            if (!$town_id) return new WP_Error('missing_town_id', 'Missing town_id', array('status' => 400));
            $saves = get_user_meta($user_id, 'rimtown_saves', true);
            if (!$saves) $saves = array();
            $saves[$town_id] = array(
                'town_name' => sanitize_text_field($params['town_name'] ?? ''),
                'save_data' => $params['save_data'] ?? '',
                'season' => sanitize_text_field($params['season'] ?? ''),
                'year' => intval($params['year'] ?? 1),
                'day' => intval($params['day'] ?? 1),
                'population' => intval($params['population'] ?? 0),
                'updated_at' => current_time('mysql'),
            );
            update_user_meta($user_id, 'rimtown_saves', $saves);
            return array('success' => true);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // Load save
    register_rest_route($ns, '/save/(?P<town_id>[a-zA-Z0-9_-]+)', array(
        'methods' => 'GET',
        'callback' => function ($req) {
            $user_id = get_current_user_id();
            $town_id = $req['town_id'];
            $saves = get_user_meta($user_id, 'rimtown_saves', true);
            if (!$saves || !isset($saves[$town_id])) {
                return new WP_Error('not_found', 'Save not found', array('status' => 404));
            }
            return array('save_data' => $saves[$town_id]['save_data']);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // Delete save
    register_rest_route($ns, '/save/(?P<town_id>[a-zA-Z0-9_-]+)', array(
        'methods' => 'DELETE',
        'callback' => function ($req) {
            $user_id = get_current_user_id();
            $town_id = $req['town_id'];
            $saves = get_user_meta($user_id, 'rimtown_saves', true);
            if ($saves && isset($saves[$town_id])) {
                unset($saves[$town_id]);
                update_user_meta($user_id, 'rimtown_saves', $saves);
            }
            return array('success' => true);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // Get achievements
    register_rest_route($ns, '/achievements', array(
        'methods' => 'GET',
        'callback' => function () {
            $user_id = get_current_user_id();
            $achievements = get_user_meta($user_id, 'rimtown_achievements', true);
            return array('achievements' => $achievements ?: array());
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // Unlock achievement
    register_rest_route($ns, '/achievement', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $user_id = get_current_user_id();
            $params = $req->get_json_params();
            $key = sanitize_text_field($params['key'] ?? '');
            if (!$key) return new WP_Error('missing_key', 'Missing key', array('status' => 400));
            $achievements = get_user_meta($user_id, 'rimtown_achievements', true);
            if (!$achievements) $achievements = array();
            if (!isset($achievements[$key])) {
                $achievements[$key] = array(
                    'unlocked_at' => current_time('mysql'),
                    'town_id' => sanitize_text_field($params['town_id'] ?? ''),
                );
                update_user_meta($user_id, 'rimtown_achievements', $achievements);
            }
            return array('success' => true);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));

    // v5.33.0 帳號設定同步(AI 供應商/金鑰/額度隨帳號走,換裝置免重輸)
    register_rest_route($ns, '/settings', array(
        'methods' => 'GET',
        'callback' => function () {
            $settings = get_user_meta(get_current_user_id(), 'rimtown_settings', true);
            return array('settings' => $settings ?: null);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));
    register_rest_route($ns, '/settings', array(
        'methods' => 'POST',
        'callback' => function ($req) {
            $user_id = get_current_user_id();
            $params = $req->get_json_params();
            $prev = get_user_meta($user_id, 'rimtown_settings', true);
            if (!$prev) $prev = array();
            // 空值不覆寫既有欄位(與前端「空欄位不洗掉金鑰」同一原則)
            if (!empty($params['llm_provider'])) $prev['llm_provider'] = substr(sanitize_text_field($params['llm_provider']), 0, 20);
            if (!empty($params['llm_api_key'])) $prev['llm_api_key'] = substr(sanitize_text_field($params['llm_api_key']), 0, 300);
            if (isset($params['fallback_groq_key'])) $prev['fallback_groq_key'] = substr(sanitize_text_field($params['fallback_groq_key']), 0, 300);
            if (isset($params['npc_llm_budget']) && is_numeric($params['npc_llm_budget'])) $prev['npc_llm_budget'] = max(-1, min(9999, intval($params['npc_llm_budget']))); // v5.37.0 -1=無上限
            $prev['updated_at'] = current_time('mysql');
            update_user_meta($user_id, 'rimtown_settings', $prev);
            return array('success' => true);
        },
        'permission_callback' => function () { return is_user_logged_in(); },
    ));
});

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
            'version' => '5.67.4',
            'date'    => '2026-09-08',
            'changes' => array(
                '🧹 全存檔清理 AI 助理漏出的內容:中繼曾把「I\'m Kiro, an AI development environment…」這類拒絕/自報身分的句子當成村民台詞回來,已寫進聊天紀錄、村民對話、記憶、行程、名場面、新聞。現在每次載入存檔都深度掃描整份資料,命中的條目移除並提示「已清除 N 則」後回存;前端收到伺服器回覆也再檢查一次,漏網的直接當失敗退回內建模擬對話',
            ),
        ),
        array(
            'version' => '5.67.3',
            'date'    => '2026-09-08',
            'changes' => array(
                '⏱️ 中繼逾時修復:v5.67.2 對 Anthropic 格式送 system 欄位後,Kiro 系代理每次都卡到 15 秒被中止,全部退回 Groq。改為不送 system 欄位、把 RimTown 系統提示併進使用者訊息開頭;拒絕偵測與退回機制不變',
            ),
        ),
        array(
            'version' => '5.67.2',
            'date'    => '2026-09-08',
            'changes' => array(
                '🎭 村民對話冒出英文「I\'m Kiro, an AI development environment…」修復:付費中繼是 Kiro 系代理,會自己塞「程式開發助理、不做角色扮演」的系統提示。現在每次呼叫都附上 RimTown 自己的角色扮演系統提示(Anthropic 格式走 system 欄位、OpenAI/Groq 格式走 system 訊息),並偵測「拒絕扮演/自報 AI 身分」的回覆,視同失敗立刻改走另一條渠道,不冷卻;兩邊都拒絕才回錯,前端退回內建模擬對話',
            ),
        ),
        array(
            'version' => '5.67.1',
            'date'    => '2026-09-08',
            'changes' => array(
                '📱 手機離開時也沖存檔:原本只有 beforeunload 會把最後進度寫上雲端,手機切 App/滑掉分頁幾乎不觸發,雲端最多落後 5 分鐘,換裝置就會看到剛做完的任務又出現。現在 pagehide 與畫面隱藏(visibilitychange)也會同步沖本機+雲端,同一 tick 只沖一次',
            ),
        ),
        array(
            'version' => '5.67.0',
            'date'    => '2026-09-08',
            'changes' => array(
                '📊 Groq 免費額度感知:免費層 30 RPM / 1K RPD / 8K TPM / 200K TPD 是整把金鑰共用、不分玩家。伺服器每次 Groq 回應都讀 x-ratelimit-* 標頭記下剩餘額度與重置時間;下一次請求先估算需要的 token(提示詞+回覆),不夠就直接走付費主渠道,不去撞 429;真的撞到 429 照 retry-after 精準冷卻(上限 6 小時),不再一律 5 分鐘',
                '🔍 /api/chat 回應多帶 groq_quota(剩餘 token/請求數)與 groq_skipped(這次為何沒優先用 Groq),方便看免費額度用到哪',
            ),
        ),
        array(
            'version' => '5.66.6',
            'date'    => '2026-09-08',
            'changes' => array(
                '🚑 熱修「旅途出了點問題:this._newerSave is not a function」:v5.64.1 移除雲端去重時誤把相鄰的 _newerSave 一起刪掉,開機載入、切鎮、馬車過場三條路都會炸;已回填',
                '🧪 新增發版前稽核 scripts/method-audit.js:檢查前端所有 this._xxx() 呼叫都有對應定義,之後每版必跑',
            ),
        ),
        array(
            'version' => '5.66.5',
            'date'    => '2026-09-08',
            'changes' => array(
                '⏱️ 兩條 AI 渠道共用時間預算:原本 Groq 逾時 15 秒 + 主渠道逾時 20 秒最壞 35 秒,超過函式 30 秒上限會變 504 而不是退回。現在整個請求共用 26 秒,每個上游呼叫只能用剩下的時間(Groq 模型清單 8 秒、Groq 對話 12 秒、主渠道 15 秒各自封頂),預算不足就不再嘗試;最壞情況也是「退回另一邊」',
            ),
        ),
        array(
            'version' => '5.66.4',
            'date'    => '2026-09-08',
            'changes' => array(
                '🧠 Groq 推理模型空回覆根治:線上日誌確認原因是 groq_empty——gpt-oss 的思考段吃掉小額度 max_tokens(20 必空)。推理模型的 Groq 呼叫改給最低 160 token 餘裕(Groq 免費不計成本);空回覆只退回該次請求、不再觸發 5 分鐘冷卻,冷卻只留給 429/5xx/逾時',
            ),
        ),
        array(
            'version' => '5.66.3',
            'date'    => '2026-09-08',
            'changes' => array(
                '🔬 分流診斷:/api/chat 回應多帶 fallback_from(哪個渠道/模型因何失敗才退回),伺服器日誌同步記錄;Groq 偏好退回已驗證能用的 gpt-oss-20b 優先(120b 上線實測每次首發失敗,原因待日誌確認)',
            ),
        ),
        array(
            'version' => '5.66.2',
            'date'    => '2026-09-08',
            'changes' => array(
                '🎯 Groq 模型偏好:線上驗證這把金鑰的清單沒有 llama 系列,實際挑到 gpt-oss;改為 gpt-oss-120b 優先於 20b(對話品質較佳,免費額度相同)。實測 chat 線→Groq、background 線→付費主渠道,20 個 token 也能正常回覆',
            ),
        ),
        array(
            'version' => '5.66.1',
            'date'    => '2026-09-08',
            'changes' => array(
                '🛟 Groq 對話線回覆保底:上線實測 Groq 在小 max_tokens 下偶爾回空字串(推理模型把額度花在思考)。空回覆現在視同失敗直接退回付費主渠道,玩家不會拿到空白對話;模型偏好改為非推理模型優先(llama-3.3-70b → llama-3.1-8b → kimi-k2 → gpt-oss),gpt-oss 帶 reasoning_effort=low、qwen/deepseek 隱藏思考段,<think> 殘留一律剝掉',
                '⏱️ /api/chat 函式逾時上限設為 30 秒(vercel.json),Groq 呼叫本身 15 秒逾時;回應多帶 model 欄位方便驗證實際走的模型',
            ),
        ),
        array(
            'version' => '5.66.0',
            'date'    => '2026-09-08',
            'changes' => array(
                '🔀 智慧分流搬到伺服器(規則同 v5.39.0):前端把每次呼叫標成 chat(玩家與村民對話、劇情名場面)或 background(行程/反思/背景對話);chat 優先走 Groq 免費額度(GROQ_API_KEY),限流或故障退回付費主渠道並 5 分鐘後再試;background 走付費主渠道(LLM_*),失敗退回 Groq 並對主渠道累進冷卻(60 秒×次數,最多 5 分鐘),恢復即切回。兩邊都失敗才回錯',
                '🩹 帳號自救:開機向伺服器確認帳號狀態時,若帳號紀錄遺失(雲端儲存空間停權/搬遷缺漏),趁登入憑證仍有效請玩家設一組新密碼重建紀錄;存檔、成就、設定以帳號名為 key,不受影響。紀錄仍在時一律拒絕,不能拿來改別人的密碼',
            ),
        ),
        array(
            'version' => '5.65.0',
            'date'    => '2026-09-08',
            'changes' => array(
                '🔐 AI 全面內建:設定頁的「進階:自備 AI 金鑰」整段移除(供應商/API 金鑰/Groq 金鑰/測試連線都拿掉),所有玩家一律走小鎮內建 AI;金鑰只存在 Vercel 環境變數(LLM_* 主渠道 + GROQ_API_KEY 備援),玩家端不需要、也看不到任何金鑰欄位',
                '🧹 帳號設定不再保存玩家金鑰:伺服器讀取時過濾、寫入時清除舊版留下的 llm_api_key/fallback_groq_key;前端開機同步清掉本機與擴充功能儲存區的舊金鑰。設定頁只剩 NPC 每日 AI 額度、模擬速度、語言與音樂',
            ),
        ),
        array(
            'version' => '5.64.1',
            'date'    => '2026-09-08',
            'changes' => array(
                '🛡️ 存檔保護三件組(改版後紀錄不見的根治):① Service Worker 原本把同網域 /api/ 的 GET 當靜態資源 cache-first,第一次抓到的雲端存檔清單/內容會一直用到下次改版才更新——這就是「改版才變、進度好像不見」的真兇;/api/ 現在一律走網路不快取。② 伺服器端進度單調保護:較舊的存檔(舊分頁、舊裝置、備援 reset 出的 Day1 世界)不能再蓋過雲端較新的進度,匯入存檔等玩家明確意圖才可強制覆寫。③ 覆寫前自動保留前一版備份,主檔遺失時讀取端自動退回備份。',
                '🚫 程式絕不自動刪除任何雲端存檔:移除 v5.62.1 的雲端同名去重自動刪除;要刪只能由玩家或管理員手動操作',
            ),
        ),
        array(
            'version' => '5.64.0',
            'date'    => '2026-09-08',
            'changes' => array(
                '🗄️ 存檔後端可改用 Neon Postgres:設了環境變數 DATABASE_URL 後,所有玩家資料(帳號、存檔、成就、設定、排行榜、封鎖名單)改存 Postgres,徹底避開 Vercel Blob「每月 2K 次 list/put」的額度上限(之前雲端存檔爆額度被拒的根因)。沒設 DATABASE_URL 時行為與現在完全相同,部署不會壞;讀取時 PG 沒有會自動退回 Blob 並順手回填,城鎮列表在搬遷完成前聯集兩邊不漏檔',
                '📦 管理員一鍵搬遷:設定分頁「🛡️ 管理員」面板新增儲存後端狀態與「📦 搬資料到資料庫」按鈕,按一次就把既有 Blob 資料複製進 Postgres(可重複執行,不覆蓋較新的資料)',
                '🏘️ 內建小鎮 AI 改接付費渠道:/api/chat 主渠道改為可設定的付費 AI 中繼(env LLM_BASE_URL/LLM_API_KEY/LLM_MODEL/LLM_FORMAT,相容 Anthropic 與 OpenAI 格式),Groq 保留為備援;每日額度可用 env 調整。玩家端免填金鑰即可對話,標頭顯示「AI:小鎮內建」',
            ),
        ),
        array(
            'version' => '5.63.2',
            'date'    => '2026-09-08',
            'changes' => array(
                '📉 Vercel Blob 額度止血:Hobby 方案每月只有 2K 次 advanced operations,原本每次讀取都先 list() 找檔案、每 60 秒又寫兩次雲端,額度爆表後雲端寫入被拒(之前「雲端儲存失敗」的真正原因)——讀取改為直接打固定公開網址(只算流量不算次數),封鎖名單查詢加 60 秒記憶體快取;登入玩家本機仍每 60 秒存檔,雲端改為「有進度變化且距上次 ≥5 分鐘」才寫,關頁/手動存檔/切鎮照舊立即寫雲端',
            ),
        ),
        array(
            'version' => '5.63.1',
            'date'    => '2026-09-08',
            'changes' => array(
                '🚑 部署修復:v5.63.0 新增的管理員端點讓 Vercel Serverless Function 數量達 13,超過 Hobby 方案 12 個上限,正式站部署失敗仍停在 v5.62.1——移除無伺服器狀態的 /api/logout 函式(JWT 登出本來就只是前端丟棄 token),改以 rewrite 導向 /api/me,函式數回到 12',
            ),
        ),
        array(
            'version' => '5.63.0',
            'date'    => '2026-08-28',
            'changes' => array(
                '🛡️ 管理員帳號管理:在 Vercel 環境變數 ADMIN_USERS 填入自己的帳號後,設定分頁出現「管理員」面板,可列出所有玩家、封鎖/解封、刪除帳號(連同所有雲端存檔,名字不能再註冊);被封鎖或刪除的帳號立即無法登入、用 AI、存檔,舊登入狀態也會被踢下線',
                '✖️ 手機版「目前目標」提醒按 × 關不掉修復:× 的處理函式抓的是第一次顯示時的任務 id,任務換了之後按 × 記錯 id,下一秒又彈回來——改為讀當前任務 id,並直接吃手機 touch 事件、放大可點區域',
                '🔁 做過的任務又出現修復(存檔回捲):登入後自動存檔原本只寫雲端,雲端寫入失敗進度就沒存到任何地方,重新整理載到舊存檔任務自然重來——現在登入也同時寫本機,開機與切鎮都以 tickCount 比較雲端/本機挑最新的一份(同一天內也分得出),本機較新會自動回填雲端;任務系統讀檔前一律重建,不再殘留上一鎮的任務狀態',
            ),
        ),
        array(
            'version' => '5.62.1',
            'date'    => '2026-08-26',
            'changes' => array(
                '🗂️ 城鎮列表不再累積重複的邊境鎮:啟動失敗時的備援路徑每次都領一個新城鎮 id,配合 v5.59.1 的雙寫,每存一輪列表就多一筆「第1天」孤兒條目——現在啟動會優先回到上次玩的鎮(雲端拿不到就讀本地備份),真的要開新世界也沿用既有條目的 id 覆寫同一格;開機時自動清掉既有的同名 Day1 孤兒(本機+雲端),有實際進度的同名城鎮一律保留不動',
            ),
        ),
        array(
            'version' => '5.62.0',
            'date'    => '2026-08-26',
            'changes' => array(
                '🏠 住房制度重整:沒結婚的村民不再被塞進同一間房——只有夫妻同住一間,單身各自獨居;房間不夠時自動在空地加蓋單棟小屋並接上道路(邊境鎮約加蓋 8 間、海風鎮約 3 間,依實際人口動態計算);婚後兩人會自動搬進同一間;切換城鎮時舊鎮的住戶分配不再殘留',
            ),
        ),
        array(
            'version' => '5.61.0',
            'date'    => '2026-08-26',
            'changes' => array(
                '🧹 移除玩家職業選擇系統:選職業其實對村莊經濟毫無影響(全鎮產出都來自 NPC),卻用「你目前無業!」橫幅和 11 顆按鈕搶走新手第一天的注意力——整套面板(選職/辭職/手動生產鈕)與三個職業成就一併移除;玩家身分固定顯示「旅人」,當選鎮長時照樣顯示鎮長頭銜,參選鎮長玩法不受影響',
            ),
        ),
        array(
            'version' => '5.60.2',
            'date'    => '2026-08-26',
            'changes' => array(
                '🚪 村民卡在屋裡出不來修復:醒著的村民若在建築物內、目的地在外面,卻因為房間開口被牆擋住/找不到路而一直出不了門,約 6 秒後會自動安置到該建築的門口外並重新找路——與既有的「睡覺一定進屋」保險絲成對,保證不會有人永遠困在房子裡',
            ),
        ),
        array(
            'version' => '5.60.1',
            'date'    => '2026-08-23',
            'changes' => array(
                '🏭 工廠與選址互不侵犯:工廠預留地基計算現在會避開馬車站、玩家選址建築(施工中+完工)與裝飾;反過來蓋建築與擺裝飾也不能占用工廠地基(含空地基)或馬車站,兩套系統不再互相蓋在對方頭上',
                '🎨 工廠繪製像素化補完:空地基上的 🏗️ 表情符號改為像素木材堆,煙囪的圓形煙改為方塊像素煙',
            ),
        ),
        array(
            'version' => '5.60.0',
            'date'    => '2026-08-23',
            'changes' => array(
                '🏗️ 蓋建築選址引導:進入選址模式後,所有可以蓋的 2×2 格位會發出綠光脈動,滑鼠移動時有綠(可蓋)/紅(不可)的佔地預覽框跟著;點擊自動吸附到 2 格網格,所有建築落在同一格線上自然蓋得整齊,不用再憑感覺亂點',
            ),
        ),
        array(
            'version' => '5.59.5',
            'date'    => '2026-08-23',
            'changes' => array(
                '🚏 海風鎮回不了邊境鎮修復:城鎮名字改以「存檔內的鎮名」為權威——過去 meta 對不上 id 時會誤判自己叫「邊境鎮」,馬車名單因此把真正的回程踢掉、還列出海風鎮自己;現在出訪名單一律排除自己、以存檔內鎮名核對、切鎮後立即重建,存錯名字的舊 meta 也會在下次存檔時自動修正',
            ),
        ),
        array(
            'version' => '5.59.4',
            'date'    => '2026-08-23',
            'changes' => array(
                '🐎 馬車 UI 全面像素化:馬車站對話框標題、「前往」按鈕、旅途過場動畫裡的系統表情符號(🐴/🛺/🐎)全部換成方塊拼成的像素馬車 SVG,與地圖上的馬車站同款配色;過場動畫行進方向改為與馬頭朝向一致',
            ),
        ),
        array(
            'version' => '5.59.3',
            'date'    => '2026-08-22',
            'changes' => array(
                '🐎 馬車站改為純像素風繪製:表情符號小馬換成方塊拼成的像素馬(頭/鬃毛/尾巴/四腿/馬蹄),圓形車輪換成階梯八角方塊輪+輪轂,車廂加上車頂/車窗/車轅細節,站牌文字同步去掉表情符號',
            ),
        ),
        array(
            'version' => '5.59.2',
            'date'    => '2026-08-22',
            'changes' => array(
                '🎵 背景音樂開關搬進「設定」分頁:原本的靜音鈕與音量條放在一個沒有入口的舊版彈窗裡,玩家關不掉音樂——現在設定分頁的「遊戲控制」區可直接 🔇靜音/調音量,設定會記住',
            ),
        ),
        array(
            'version' => '5.59.1',
            'date'    => '2026-08-22',
            'changes' => array(
                '🏷️ TC-03 兩處殘留補修:今日焦點「去找陳偉聊聊天」不再跨鎮殘留(讀檔時上一鎮的焦點會被清掉並依新鎮重算);任何切鎮路徑(城鎮列表直切/馬車)完成後教學橫幅立即重繪,海風鎮不再顯示「落腳邊境」',
                '💾 切鎮前自動雙寫本地+雲端存檔:雲端寫入失敗時,切走前的進度不再蒸發',
            ),
        ),
        array(
            'version' => '5.59.0',
            'date'    => '2026-08-22',
            'changes' => array(
                '🚌 TC-01 回程死路修復:馬車目的地與城鎮列表改為「雲端+本地合併」——雲端寫入失敗也能導航;同名重複的殘留城鎮自動去重;登入時城鎮列表併入本機存檔(標📱本機),不再誤報「雲端尚無存檔」',
                '🕐 TC-02 抵達半重置修復:切鎮時比對雲端與本地存檔日期,一律載入較新的那份——訪客時期的 Day1 舊複本不會再蓋掉真實進度;抵達後任務/教學橫幅立即依新鎮重繪',
                '🏷️ TC-03 鎮名寫死修復:劇集標題「第N集·◯◯日常」、村民閒聊「◯◯的生活還不錯」改讀當前鎮名;海風鎮不再顯示「落腳邊境」任務(改為漁村故事頁)',
                '💬 TC-04 訪客抵達時聊天清單立即刷新,可直接私訊遠客;TC-05 人口顯示改為「常住 N(+M 訪客)」,訪客不灌水人口',
            ),
        ),
        array(
            'version' => '5.58.1',
            'date'    => '2026-08-22',
            'changes' => array(
                '🚌 修復「點了馬車卻沒真的前往」:登入狀態下切換城鎮只查雲端存檔,自動生成的海風鎮在本地 → 靜默失敗。現在雲端沒有就退回本地存檔(成功後自動補上雲端);切換失敗會明確提示,不再演「抵達」',
            ),
        ),
        array(
            'version' => '5.58.0',
            'date'    => '2026-08-22',
            'changes' => array(
                '🛤️ 海風鎮改為「本來就存在」:不用手動建立——沿海道路被風暴封住,小鎮發展到繁榮 20 修路隊打通道路(「道路重通!」事件),海風鎮在背景自動生成,馬車直達、兩鎮村民互訪立即可用;通車前車伕會告訴你路封著',
                '👪 跨鎮親緣網:王麗的姑婆海嬤在海風鎮、吳達與鹽工石叔是礦上老兄弟、孫雨與燈爺是筆友…6 對手寫羈絆,兩鎮居民從第一天就會在閒聊中提起海那頭的親友',
                '🐛 QA 修正:換鎮後「今日焦點還在講陳偉」的跨鎮鬼影(reset 清除敘事殘留);鎮名三處標題不再永遠寫死邊境鎮(townName 隨存檔);海風鎮不再顯示邊境鎮主線任務;建鎮加 loading 畫面+「兩鎮並存」提示',
            ),
        ),
        array(
            'version' => '5.57.0',
            'date'    => '2026-08-21',
            'changes' => array(
                '🐎 雙城第三波(馬車過場):地圖東側大路盡頭新增「馬車站」(木平台+馬車+站牌),點擊即可選擇前往別的城鎮——黑幕過場動畫(馬車行進+季節旁白)後抵達對方鎮的馬車站下車;雙城計畫 P0~P2 全數完成',
            ),
        ),
        array(
            'version' => '5.56.0',
            'date'    => '2026-08-21',
            'changes' => array(
                '🚌 雙城第二波(村民跨鎮互訪):有兩個鎮之後,村民會自動互訪——帶著完整人格與記憶到對方鎮作客幾天(名字標示原鎮),跟當地人聊天/八卦/動心,期滿返鄉並把外地見聞帶回記憶,流入反思與對話',
                '💬 新交談選項「🚌 邀去鄰鎮」:好感夠(20+)就能邀請村民去另一個鎮作客,切過去就能看到他作客的樣子',
                '📬 兩鎮交流靠「信箱」機制:出訪/返鄉見聞在切鎮或遊玩中自動送達;訪客名單隨存檔保存',
            ),
        ),
        array(
            'version' => '5.55.0',
            'date'    => '2026-08-21',
            'changes' => array(
                '🌊 雙城第一波:全新主題城鎮「海風鎮」——海岸漁村,15 位全新村民(海伯/阿潮/小鷗/燈爺…)各有背景與開局恩怨(三角戀/船難世仇/未完舊情),討海人的早起文化,海味居/鹽場/燈塔書房等專屬地名,漁獲豐但缺木材的互補經濟',
                '📖 劇情解鎖:繁榮 20(第二章)時「碼頭來信」通知,之後城鎮列表建立新城鎮可選海風鎮;主題隨存檔保存,舊存檔不受影響',
                '🌙 修復月亮動畫:月相陰影裁切進月盤(不再把黑盤畫到天空上),新月夜保留一彎月牙——不再出現「黑洞套白圈」',
            ),
        ),
        array(
            'version' => '5.54.1',
            'date'    => '2026-08-21',
            'changes' => array(
                '🏗️ 工廠地基:地圖自動規劃 7 塊不壓路/不壓水/不壓建築的「預留地」(虛線地基),工廠蓋在地基上成為正式建築(屋頂/煙囪/開工冒煙),不再懸浮在馬路中間',
                '👷 工廠自動上工:蓋好後村民自己來上班(優先本職、其次心情好的,鎮長不會來烤麵包),沒選配方自動開第一個——你是旅人,不用當人事主任;手動指派仍可覆蓋',
            ),
        ),
        array(
            'version' => '5.54.0',
            'date'    => '2026-08-21',
            'changes' => array(
                '⏸️ 暫停徹底可靠:按下立即顯示「已暫停/已繼續」角落回饋;全螢幕卡片開著時按的暫停會在關卡後生效(不再被還原邏輯蓋掉);城鎮列表關閉時還原你原本的暫停狀態(不再無條件恢復播放)',
                '🌙 半夜不再全鎮站廣場:村民約好的聚會若倒數到睡眠時段,直接取消不赴約(夜貓子不受影響)——春祭夜全鎮被拉去綠地站整晚的根因',
                '🛏️ 睡眠保險絲:睡著卻長時間在屋外(不論走路中或卡住)一律強制安置進屋,雙保險',
                '📖 章節節奏修正:繁榮度是現狀快照,新鎮第一晚就會跳到 ~40 導致第 1 章只活一天;現在前 5 天封頂在 天數×8(8/16/24/32/40),「先和村民相處」的第一章真的有 2-3 天可玩;舊存檔完全不受影響',
            ),
        ),
        array(
            'version' => '5.53.2',
            'date'    => '2026-08-20',
            'changes' => array(
                '🏭 工廠/產業成本與產出在地化:修復顯示英文 key(wood:20 stone:15)的 7 處漏翻,全部接上與全站一致的中文資源名稱(木材×20 石材×15)',
            ),
        ),
        array(
            'version' => '5.53.1',
            'date'    => '2026-08-20',
            'changes' => array(
                '🛏️ 徹底修復「睡在戶外」:睡著卻停在屋外的村民(小屋內部目標被路徑修正推到牆邊等情況)會直接安置進自家屋內;找不到自家就借宿最近的小屋——保證睡覺一定在房子裡',
            ),
        ),
        array(
            'version' => '5.53.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🌾 食物卡顯示「存量/糧倉容量」,超過容量時顯示 ⚠ 每日腐壞5% 警示(腐壞數學已用自動化測試拍板:1000/容量400 → 當晚 −30)',
                '🍲 餐食也會過期:超過三天需求量的部分每日 8% 倒掉,不再只漲不跌;廚師產出 12→9 收斂預設 3 廚師的過剩',
                '🪵 原料自動補給改為「補滿到 40」:固定 +12 補不上木材這種高需求原料,紅燈不再卡死',
                '📊 白天顯示「預估日產 +X(午夜結算)」,排班一下就有回饋,不再誤讀成 +0 沒生效',
                '💸 加班津貼 3→8 銀幣,sink 有存在感',
            ),
        ),
        array(
            'version' => '5.52.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '💰 經濟重構第三波(價值層收束):商人改以「收購加工品」為主(餐食/工具/衣物/藥品/家具賣出換銀幣),買賣原料退場;銀幣水龍頭收緊(商人職業 8→5、鎮長 3→2),加班要付津貼(銀幣新 sink,付不出就照常排班)',
                '🌾 食物稀缺曲線:超過糧倉容量(400+穀倉擴容)的存糧每日腐壞 5%,冷藏穀庫減緩——食物爆量不再無感,辦慶典/賣商人有了理由',
                '🔬 研究獨立成「科技」分頁(價值層長線投資),資源分頁更聚焦',
            ),
        ),
        array(
            'version' => '5.51.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '👷 經濟重構第二波(勞動力排班):5 條加工線顯示「誰在做」,鎮長可下 ⏸休工/▶正常/⏫加班 指令——休工村民心情變好、多時間社交;加班產量+50% 但村民會累。經濟從「囤貨」變成「排人」',
                '📦 原料層自動供給:木材/石材/金屬/布料/草藥低於安全線自動回補;材料短缺不再罷工,改為邊角料趕工(產能四折)',
                '💊 需求波動:心情低落的村民會找醫生拿藥(藥品有了真用途);冬季衣物耗損翻倍',
            ),
        ),
        array(
            'version' => '5.50.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '📦 經濟重構第一波(三層資源 UI):資源分頁改為「關鍵資源(食物+銀幣大卡)→ 加工產能(餐食/工具/衣物/藥品/家具,顯示今日產出/消耗流量與需求,而非純庫存)→ 原料倉庫(收成一顆綠黃紅燈號,細目摺疊)」',
                '🔬 研究點移出資源格,直接顯示在研究區標題——玩家要盯的數字從 13+ 種降到 2 種存量+5 條產能',
            ),
        ),
        array(
            'version' => '5.49.3',
            'date'    => '2026-08-19',
            'changes' => array(
                '🖥️ 桌面版聊天雙欄:進入對話時側欄自動加寬,左欄聯絡人清單(可直接點選切換對象)+右欄對話視窗;窄螢幕維持全屏對話+「‹」返回',
            ),
        ),
        array(
            'version' => '5.49.2',
            'date'    => '2026-08-19',
            'changes' => array(
                '📱 聊天版面重排:未選人時聯絡人清單撐滿高度(不再擠在小視窗+大片空白);進入對話後清單讓位給對話視窗,左上「‹」返回聯絡人',
            ),
        ),
        array(
            'version' => '5.49.1',
            'date'    => '2026-08-19',
            'changes' => array(
                '🔔 村民卡的追蹤按鈕加上「追蹤／追蹤中」文字標籤,一眼看懂功能',
            ),
        ),
        array(
            'version' => '5.49.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🎬 戲劇導演(張力保底):連續 4 天沒有名場面時,系統會從三種手法挑一種在後台輕推——暗戀萌芽/舊怨復發/嫉妒升溫(附對應的內心獨白記憶),確保小鎮的戲一直有得看;導演出手後至少醞釀 3 天,不會變成鬧劇',
                '✂️ 際遇卡停止每日抽:與「觀察居民愛恨糾葛」主軸無關的個人 roguelike;已排隊的舊卡仍可正常結算,經營線(資源/產業)維持全自動背景運轉',
            ),
        ),
        array(
            'version' => '5.48.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '📺 追劇首頁:首頁故事區升級為「第N集·邊境鎮日常」——本集看點(名場面/內心話/大事)+進行中的劇情線(戀愛第N天/婚姻/絕交/三角戀/你的調停進度)+下集預告(瀕臨絕交/心意快藏不住的伏筆)',
                '📜 關係時間軸:點劇情線任一對,打開兩人從認識到現在的完整故事——雙方記憶流互相相關的條目+名場面(可重播)+目前關係,按時間排序',
                '🔔 追蹤功能:村民快速卡新增追蹤鈕,你在追的 CP/冤家發生大事(重要度高的記憶)時角落通知你,20 人的鎮不再漏掉你在乎的那條線',
            ),
        ),
        array(
            'version' => '5.47.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🐛 BUG-01(High)修復「該去找 0 敘敘舊了」:外出村民返鄉時關係還原把陣列索引當名字建立關係;修正還原邏輯+讀檔自動清除舊檔壞資料+顯示端防護三層',
                '🕊️ BUG-02 調解回饋:優先鎖定「絕交」對象、每一步顯示「和解進度 N/2」與心防狀態,硬派對象不再看似白按',
                '💘 BUG-03 心動事件:改走玩家聊天限流(較寬鬆+Groq 分流),不再被背景額度擠掉;備援真心話 2→6 種並依職業/性格加味,跨村民不再一字不差',
                '📜 BUG-04 事件徵詢開場加入 4 種變體,乾旱/風暴/寒流不再逐字重複',
                '⏸️ BUG-05 暫停時抑制所有全螢幕彈窗(名場面/週報/決策卡),排隊等你恢復播放後再補播',
            ),
        ),
        array(
            'version' => '5.46.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '✂️ 移除祭典攤位小遊戲(猜燈謎/撈金魚/投壺):與「觀察居民之間的事件、關係與愛恨糾葛」的主軸脫節——不寫入記憶流、不影響關係,只是孤立的反應遊戲。祭典本身保留:村民行程/對話/氣氛加成照常',
            ),
        ),
        array(
            'version' => '5.45.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🦋 蝴蝶效應回顧:你的社交行動(耳語/安慰/示好/威脅/調解/說服/送禮…)會記下當下的關係快照,隔天首頁「昨日回響」用因果句告訴你發酵了什麼——「你種在X心裡的念頭發酵了,他對Y的態度明顯軟化」「昨天的威脅起了反效果,他對你起了戒心」,最多3條',
                '🧘 首頁分階段減壓:剛開村只看「今日焦點+昨日回響+居民列表」;「今天的故事」在小鎮成長10後展開、「今日頭條」在成長20(第二章)後展開——第一次進來不再被資訊牆壓迫',
                '🎁 送禮日誌殘留的「鎮長」稱謂改為「你」',
            ),
        ),
        array(
            'version' => '5.44.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '💬 修復對話被截斷:玩家聊天回覆 token 上限 400→600,且回覆若仍被砍斷會自動收斂到最後一個完整句子,不再出現「呃…最近我在算一個關於」這種半句話',
                '📺 彈窗節奏全面控管:名場面直播/週報等全螢幕內容卡之間至少間隔 45 秒、佇列上限 4 張+去重(名場面隨時可在小鎮劇場回看);AI 日報出刊改為角落通知,全文到「日報」分頁閱讀',
                '⏸️ 暫停保護:任何全螢幕卡顯示期間世界自動暫停,關閉後還原你原本的暫停狀態——看戲時時間不會偷跑,你按的暫停也不會被彈窗洗掉',
                '📝 日報手記結尾擴充至 12 種,並依「記者+期數」決定,連續兩期不同記者不再一字不差',
            ),
        ),
        array(
            'version' => '5.43.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '📚 小鎮編年史:每天換日自動把全鎮村民的近況/行程/足跡+所有對話逐字稿(含NPC間對話與你的聊天)歸檔進瀏覽器 IndexedDB 資料庫',
                '🔎 日誌分頁新增調閱介面:按日瀏覽、逐村民/逐場對話展開;一鍵匯出全部 JSON、對話 CSV、作息 CSV(含 BOM,Excel 開啟中文不亂碼);可清空資料庫(不影響遊戲存檔)',
            ),
        ),
        array(
            'version' => '5.42.1',
            'date'    => '2026-08-19',
            'changes' => array(
                '🔕 修復互動事件卡連環轟炸(10秒跳3-4張):原本答完一張立刻彈下一張、佇列無上限累積;現在互動卡之間至少間隔 90 秒(真實時間),佇列最多留 3 張且同標題去重,已被「逾時代選」結算的過期卡直接丟棄不再顯示',
            ),
        ),
        array(
            'version' => '5.42.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🗯️ 廣場對嗆名場面:互相仇視的兩人偶爾當眾大吵(AI 生成對嗆戲,每對至少隔5天),交情好的旁觀者會選邊站——對另一方觀感變差並寫入記憶,小鎮氣氛真的會僵',
                '💢 絕交事件:雙方好感都跌破 -60 時積怨爆發,當眾撂下重話正式絕交(名場面+全鎮日報+心情重挫),絕交狀態隨存檔保存',
                '🕊️ 和事佬和解線:對絕交等級的仇怨,「調解」升級為兩段式任務——分別勸過兩邊(需要基本信任),促成「世紀大和解」名場面:兩人好感大增、你獲得雙方好感+8與聲望+15、解鎖成就「和事佬」;今日焦點會引導你去調解',
            ),
        ),
        array(
            'version' => '5.41.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '⚡ 即時重規劃(移植 generative_agents react/replan):村民白天碰到夠重大的事,會「當場」改寫今天剩下的行程——對話裡約好「傍晚一起吃飯」就真的排進今天下午;耳語慫恿、跟你聊出強烈反應、告白/婚禮/抓姦等名場面都會觸發',
                '🎛️ 節流控制:每位村民每天最多臨時改 2 次、21:00 後不再改、共用每日 AI 額度;行程被調整過會在詳情頁標示「📝 已因今天的際遇臨時調整」,紀錄也會留下他改變安排的心聲',
            ),
        ),
        array(
            'version' => '5.40.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🕐 今日足跡全紀錄(零成本):村民的行程步驟/活動/地點一有變化就自動記一筆,詳情頁足跡變成 generative_agents 式的逐段時間軸——「揉麵團(15分鐘)→顧爐火(30分鐘)→跟熟客閒聊兩句(10分鐘)」,並與當日對話/觀察/反思記憶合併顯示',
                '👀 環境感知(零成本):村民偶爾把「看到誰正忙著什麼」寫進記憶流(每天最多6條),之後聊天會自然提起「早上看到你在打鐵」',
                '💾 足跡隨存檔保存;全部規則式生成,不增加任何 AI 費用',
            ),
        ),
        array(
            'version' => '5.39.1',
            'date'    => '2026-08-19',
            'changes' => array(
                '⏱️ AI 行程立即補生成:原本只在遊戲日換日(00:00)排隊生成,一天中途讀檔/開頁的玩家要等到隔天才看得到 AI 行程;現在讀檔後會立刻為「今天還沒有 AI 行程」的村民補排(已完成的不重做,不多花錢)',
            ),
        ),
        array(
            'version' => '5.39.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '💰 AI 成本優化三件組:村民行程改 3 人一批生成(共用規則前綴,輸入省約三成,含截斷救援);NPC 背景對話輸出上限 800→500(3-4 句)、行程收緊為 5-6 時段×2-3 步驟,總成本再砍約三成',
                '🔀 智慧分流:同時填主金鑰+Groq 金鑰時,「你與村民的對話/劇情名場面」優先走 Groq 免費額度,「行程/反思/背景對話」走主金鑰(gpt-4o-mini 便宜又不佔 Groq 限額);任一邊被限流自動切到另一邊(5 分鐘後重試)',
            ),
        ),
        array(
            'version' => '5.38.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '👑 旅人參選鎮長:每年秋季選舉的競選登記期(3天)內,滿足資格(第二章+3位好感40以上村民聯署)即可在「事件」分頁登記參選;選政見、用聊天「說服」向村民逐一拉票(每人一屆一次),聲望與人緣直接左右選情',
                '🏆 當選後你就是鎮長:施政方針實際生效30天,全鎮大事改由「鎮民等你拿主意」視角;落選則雖敗猶榮,寫入記憶下屆再戰;新增成就「初生之犢」(參選)與「民選鎮長」(當選)',
                '🗳️ 競選開跑時符合資格會收到角落提醒;今日焦點會引導參選/拉票',
            ),
        ),
        array(
            'version' => '5.37.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '📅 全鎮 LLM 行程(移植 generative_agents 階層式規劃):每位村民每天由 AI 生成「近況修訂+今日行程」,行程分解到小動作層級(揉麵團、跟熟客閒聊兩句),依性格/人際/昨日經歷/約定量身打造;排隊逐位生成避免瞬間打爆 API,額度用完自動退回規則式行程',
                '🧭 近況(currently)欄位:AI 每天根據昨天發生的事改寫村民的「人生此刻主線」,注入所有對話與反思——村民整天的行動會圍繞這條主線,像 Sam Moore 逢人就聊競選一樣',
                '🤝 對話計畫思考:AI 對話結尾若有約定/待辦,會寫成「接下來要…」備忘記憶,隔天生成行程時真的會排進去——「星期三見」不再是空話',
                '💰 AI 額度預設改為無上限(金鑰是你自己的):設定頁留空=無上限,想控費可填每日上限,填 0 關閉;上限設定也隨帳號雲端同步',
                '😴 修復「站在戶外睡著」:入睡瞬間人在屋外會被原地凍結;現在會先走進屋裡才睡',
            ),
        ),
        array(
            'version' => '5.36.0',
            'date'    => '2026-08-19',
            'changes' => array(
                '🎭 旅人視角敘事修正:你的角色是旅人不是鎮長——全鎮大事(野豬暴走等事件應對)改為「現任鎮長急匆匆來徵詢你的意見」;玩家放話的誇讚/壞話不再被冠上「鎮長」頭銜(改用你的名字);裝飾擺放日誌改「你」',
            ),
        ),
        array(
            'version' => '5.35.8',
            'date'    => '2026-08-19',
            'changes' => array(
                '😴 修復村民半夜不回家睡覺:原本「休息值滿(≥90)就不睡」+夜間衰減慢,導致大批村民凌晨還在外面閒逛;現在一般人睡眠時段(22:00-6:00)一律回家睡覺,夜貓子維持自己的作息(2:00 才睡)',
            ),
        ),
        array(
            'version' => '5.35.7',
            'date'    => '2026-08-19',
            'changes' => array(
                '🗺️ 探險選人清單移除「只列前 8 位」的限制:所有不在探險中的村民都可選(探險中的村民照樣自動排除,回鎮後恢復)',
            ),
        ),
        array(
            'version' => '5.35.6',
            'date'    => '2026-08-19',
            'changes' => array(
                '📱 修復手機點日報/焦點/故事流的人物連結沒反應:村民快速卡開在地圖層被浮動面板蓋住,現在會先收合面板再開卡',
            ),
        ),
        array(
            'version' => '5.35.5',
            'date'    => '2026-08-19',
            'changes' => array(
                '🗞️ 修復首頁「完整日報」按鈕跳錯分頁:原本跳到「紀錄」(只有對話日誌),改為正確跳到「事件」的 AI 日報區',
            ),
        ),
        array(
            'version' => '5.35.4',
            'date'    => '2026-08-18',
            'changes' => array(
                '⌨️ 修復手機打字時輸入框被蓋住:聊天輸入框聚焦(鍵盤開啟)時自動隱藏底部狀態帶與選單列,收鍵盤後恢復',
            ),
        ),
        array(
            'version' => '5.35.3',
            'date'    => '2026-08-18',
            'changes' => array(
                '📱 修復手機版點「詳情」沒反應:村民快速卡的詳情、今日焦點/頭條的分頁跳轉,在手機版會正確開啟浮動面板',
            ),
        ),
        array(
            'version' => '5.35.2',
            'date'    => '2026-08-18',
            'changes' => array(
                '👥 修復同名派系出現兩次(兩個「學者聯盟」):同型派系改為最多 1 個;既有存檔的重複派系自動合併(成員取聯集)',
            ),
        ),
        array(
            'version' => '5.35.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '💗 修復村民詳情頁「調情/告白」按鈕白底無字:補上遺漏的按鈕樣式(粉色系)',
            ),
        ),
        array(
            'version' => '5.35.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '🤫 耳語慫恿(generative_agents whisper 移植):聊天新增「耳語」意圖鈕,你低聲說的一句話會被 AI 轉寫成村民自己的內心念頭,植入記憶流——影響他之後的對話、反思與對特定村民的好感/心動',
                '💭 村民內心活動豐富化:每人每天規則式合成人際想法+生活想法(夢想/暗戀/天氣/祭典)+昨日印象觀察;LLM 深度反思從每天 1 位提高到 3 位(仍受每日額度限制)',
                '✕ 聊天對話視窗加關閉鈕,不再擋住聯絡人清單',
            ),
        ),
        array(
            'version' => '5.34.2',
            'date'    => '2026-08-18',
            'changes' => array(
                '🌐 修復新聞「生效中」效果直接顯示英文程式 key:補全 24 個 modifier 的中文標籤(農作加成/售價加成/移民機率/天氣影響等)',
                '🌡️ 修復天氣心情影響顯示成 -100% 的問題:它是心情點數不是百分比,改顯示 ±N',
            ),
        ),
        array(
            'version' => '5.34.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '🏆 修復開新局成就洗版:開場第一輪判定就達標的成就(人口/資源等)靜默入袋不彈通知,之後解鎖的才提醒;角落通知同時最多 3 張,多的擠掉最舊的',
            ),
        ),
        array(
            'version' => '5.34.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '⏳ 事件逾時代選:事件應對/每日決策/村民請託/際遇卡的選擇卡 60 秒沒選就由小鎮隨機代選;就算卡片被延後沒顯示,pending 滿一個遊戲日也會自動結算,事件線不再卡住',
                '🔔 資訊通知全面角落化:成就、章節推進、故事事件等純資訊卡改右下角小卡(手機版避開底部列),不再佔用整個版面;名場面直播、AI 日報等完整內容維持中央卡',
            ),
        ),
        array(
            'version' => '5.33.3',
            'date'    => '2026-08-18',
            'changes' => array(
                '🔄 Groq 模型不再寫死:自動查詢你的金鑰當下可用的模型清單並挑選(偏好 llama 系列),404 時自動重查換模型重試;前端與伺服器 AI(/api/chat)都套用',
            ),
        ),
        array(
            'version' => '5.33.2',
            'date'    => '2026-08-18',
            'changes' => array(
                '🔧 修復 Groq 金鑰測試一直失敗:預設模型 qwen3-32b(preview)已被 Groq 下架,改用正式版 llama-3.3-70b-versatile(與伺服器 AI 相同)',
                '🩺 測試連線失敗時顯示真實原因(HTTP 狀態 + API 錯誤訊息),不再籠統顯示「檢查金鑰」',
            ),
        ),
        array(
            'version' => '5.33.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '🚑 修復 Vercel 部署失敗:Hobby 方案 12 個 Functions 上限——成就查詢/解鎖合併為單一端點(rewrite 保持路徑不變)',
                '🏆 桌面版成就通知改右下角小卡,不再蓋住整個畫面;點擊或 6 秒後自動消失(手機版暫維持中央卡)',
            ),
        ),
        array(
            'version' => '5.33.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '☁️ AI 設定隨帳號同步:API 金鑰/供應商/NPC 對話額度存進帳號(伺服器端 AES-256-GCM 加密),換裝置登入自動帶入,不用重新輸入',
                '🔁 同步規則:登入時雲端有值就套用到本機;本機儲存設定時自動推上雲端;空值不互相覆寫',
            ),
        ),
        array(
            'version' => '5.32.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '🔑 修復切換 AI 供應商後按儲存會把已存 API 金鑰洗掉的問題:空欄位不再覆寫已存金鑰',
            ),
        ),
        array(
            'version' => '5.32.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '📖 章節制(劇情先、經營後):第一章只有「人」——村民/聊天/關係網/故事;第二章(繁榮20)開任務/事件/請託/決策;第三章(45)開經濟/商店/農場;第四章(70)開產業/工廠/研究/議會;章節推進有專屬慶祝卡',
                '🔕 第一章不再被系統轟炸:事件自動結算、決策卡/求助/際遇卡/議會依章節才啟動;關係網開局即可看(這是劇情核心)',
                '🔢 數值文字化:關係列不再顯示 +43 原始好感(類型即語意)、NPC 需求改一句話、派系團結度改緊密/普通/渙散;首頁繁榮度重新框成「章節進度」——玩家唯一要在意的成長數字',
            ),
        ),
        array(
            'version' => '5.31.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '🎯 今日焦點:首頁最上方每天給 2-3 個「有理由的具體行動」(有人等你幫忙/選舉拉票/名場面餘波去關心當事人/好感差一點到門檻/保底找摯友聊天),點了直達當事人或分頁',
                '📖 今天的故事:首頁新增故事流,村民反思、重大關係事件、名場面、AI 對話精華全拉到第一層,點任一則直達人物卡',
                '🃏 村民快速卡內心化:第一層改顯示「今天想做+心裡的話」,屬性條移到詳情頁——先看見人,再看見數字',
            ),
        ),
        array(
            'version' => '5.30.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '🗳️ 鎮長選舉改為固定每年秋季第 1 天開選(競選3天→投票2天→公布),不再靠機率觸發',
            ),
        ),
        array(
            'version' => '5.30.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '🧠 人物狀態頁(generative_agents 式):居民詳情卡新增「內心狀態(生活作息+近況)」「今日目標」「今日足跡」三區塊',
                '📅 今日目標每天早上依性格/職業/戀情/宿敵/夢想/祭典/選舉自動生成,每人每天都不同;近況綜合婚戀、夢想進度、最新反思與人際僵局',
                '🕐 今日足跡 = 當天真實發生的記憶時間軸(對話/事件/心情),點開就能看懂這個村民今天過得如何;全部規則式合成,零 API 成本',
            ),
        ),
        array(
            'version' => '5.29.3',
            'date'    => '2026-08-18',
            'changes' => array(
                '🎨 修復設定頁「開新局的村民」兩顆按鈕白底無字:補上 speed-controls 容器讓主題樣式生效',
            ),
        ),
        array(
            'version' => '5.29.2',
            'date'    => '2026-08-18',
            'changes' => array(
                '🔕 不再打斷操作:你正在跟村民聊天或打字時,事件/成就/報紙/名場面卡片不會跳出來,改排進佇列,右下角小提示告知,等你忙完(空閒 3 秒內)再依序補播',
                '✨ 日誌的村民對話加上「AI」標籤,一眼分辨哪些對話是 LLM 生成、哪些是內建模擬',
            ),
        ),
        array(
            'version' => '5.29.1',
            'date'    => '2026-08-18',
            'changes' => array(
                '💸 OpenAI 供應商鎖定 gpt-4o-mini:無論任何設定都不會呼叫更貴的 GPT 模型,設定頁選項同步標示',
            ),
        ),
        array(
            'version' => '5.29.0',
            'date'    => '2026-08-18',
            'changes' => array(
                '🧠 LLM 記憶流(移植 generative_agents):村民記憶依「時近+重要度+相關度」加權檢索,AI 對話會帶著最相關的過往記憶,聊完再各自寫下一句主觀記憶,越聊越有連續劇感',
                '💭 每日反思:村民每晚規則式合成人際想法(常互動對象→朋友/煩人),每天再挑一位「今天最精彩」的村民做一次 AI 深度反思,寫進他的內心',
                '💰 混合成本控制:只有玩家附近(8 格內)的村民對話才呼叫 AI,遠處對話走內建模擬照樣寫記憶;新增「NPC 對話每日 AI 額度」設定(預設 40 次/日,可設 0 全關),玩家聊天與劇情名場面不受限',
                '📝 AI 對話/反思全文存檔:村民對話紀錄與反思隨存檔保存,重新載入不再消失',
            ),
        ),
        array(
            'version' => '5.28.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🃏 肉鴿③局內際遇卡:每隔幾天會跳出一張「際遇卡」,二/三選一,每個選擇永久改變這一局 —— 旅行商隊、神秘祝福(全鎮屬性+1)、豐收抉擇、謠言火種(撮合/挑撥)、命運賭注、遊方醫者、豐年餘暉…',
                '⚙️ 效果直接作用在這一局:加減資源、全鎮心情、居民屬性、撮合/拆散關係、持續數天的增益,越選越有肉鴿 build 的感覺',
            ),
        ),
        array(
            'version' => '5.27.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🎲 肉鴿②每局隨機開局:設定裡可切「劇本卡司 / 隨機卡司」。選隨機後,每開一張新地圖都會抽出一批全新村民(名字/性格/職業/背景/屬性)+隨機生成的開局愛恨關係網(夫妻/前任/暗戀/三角/世仇/摯友),每一局的小鎮故事都不同',
                '📖 想玩原本的陳偉、林美等劇本村民?切回「劇本卡司」即可(預設)',
            ),
        ),
        array(
            'version' => '5.26.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🎲 肉鴿化第一步 —— 角色屬性數值化:每位村民有四項核心屬性(✨魅力/💪體魄/🧠智慧/🔥膽識,1-10),依性格與職業隨機生成,所以每位村民、每一局都不一樣',
                '⚙️ 屬性接進玩法:魅力越高越讓人心動(戀愛)、膽識越高心情越穩(抗壓)、智慧越高技能練得越快',
                '📊 點村民資訊卡可看到四條屬性長條;屬性完整存進存檔。(這是接下來「隨機開局/事件抽卡/傳承強化」的共同地基)',
            ),
        ),
        array(
            'version' => '5.25.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '👥 新村民包:小鎮迎來 4 位有戲的新居民 —— 糕點師傅蘇晴、老兵高朗、繡藝師柯薇、星象學者凌波',
                '💞 開局就有新戲:蘇晴傾心劉俊(和許瑩形成新三角)、高朗是吳達的老袍澤(把跟楊鋒的舊怨燒成兩派)、高朗暗戀黃莉(與張豪成情敵)、柯薇與凌波在星空下互相傾心(夜貓子的雙向暗戀)',
            ),
        ),
        array(
            'version' => '5.24.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🌤️ 雲影飄移:晴天/多雲的白天,幾片柔和雲影會緩緩掃過草地,小鎮更有生氣',
                '🍂 季節色調:四季各有一抹環境色 —— 春季嫩綠、夏季金黃、秋季琥珀橙、冬季清冷藍,一眼就知道現在是哪一季',
            ),
        ),
        array(
            'version' => '5.23.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🌙 月相變化:夜晚的月亮會依遊戲天數盈虧(新月→上弦→滿月→下弦,約 16 天一輪),取代原本固定的月牙',
                '🌧️ 天氣粒子:下雨會落下雨絲、下雪會飄下雪花,暴風雨/暴風雪更狂;雨雪只在可視範圍內生成,效能友善',
                '☄️ 流星:夜空偶爾會有一顆流星拖著尾巴劃過',
            ),
        ),
        array(
            'version' => '5.22.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🏳️‍🌈 戀愛不分性別:確認戀愛引擎本就不看性別,並在開局關係網加入同性戀情線(女醫生林美 × 焦慮學者孫雨、木匠馬強對遊唱周明又恨又迷),讓多元的愛從第一天就看得見',
                '🔥 愛恨更容易爆發:調高單戀嫉妒、情敵結怨、個性口角、偷情與東窗事發的機率,讓三角戀更常燒成仇敵、修羅場更容易上演(實測情侶照樣談得成,只是恩怨變多了)',
            ),
        ),
        array(
            'version' => '5.21.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🎭 小鎮劇場:村民的名場面(告白/婚禮/修羅場/分手/離婚)現在會存檔,在「故事→紀錄」分頁最上方可回顧',
                '📺 點任一名場面即可重播那段對話劇,補看你錯過的好戲;戲碼帶年份季節時間戳,完整存進存檔',
            ),
        ),
        array(
            'version' => '5.20.1',
            'date'    => '2026-07-20',
            'changes' => array(
                '🌙 月亮光暈改用圓形填充繪製,徹底杜絕夜晚月亮周圍偶爾出現的方形邊緣/破圖感',
            ),
        ),
        array(
            'version' => '5.20.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🧭 導覽收束成三大入口:小鎮(經濟/產業)、居民(居民/聊天/關係)、故事(任務/事件/紀錄/成就),外加設定,大幅降低新手看到一堆分頁的認知負擔',
                '📑 每個入口進去後,面板頂部有次級分頁列可切換組內項目;桌面與手機兩套介面都套用,操作一致',
                '🔔 聊天未讀徽章、功能解鎖鎖頭在新導覽下都正常運作,手機開羅底部列的快捷聊天鈕保留',
            ),
        ),
        array(
            'version' => '5.19.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🏙️ 城鎮身分/路線:小鎮會依你的長期經營自然長成一種樣貌 —— 商業自由鎮、軍事要塞、農業共同體、學術聚落、浪漫小鎮、龍蛇混雜之地',
                '📈 路線由職業分佈、經濟樣態、選舉政策、愛恨密度長期累積而成,近期權重更高,會隨玩法自然轉型(本來想建農業村,最後卻成了貿易城)',
                '🧲 成形的路線會吸引「氣味相投」的移民(依職業加權挑選),讓每一局的城鎮愈走愈有個性',
                '🔎 首頁新增城鎮身分徽章,點一下可看它是由哪些長期傾向形成的',
            ),
        ),
        array(
            'version' => '5.18.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🧭 第一天因果鏈:新手看完介紹後,會出現一張「第一天」引導卡,用一條可操作的動線教會核心循環 —— 認識居民 → 發現關係矛盾 → 出手互動 → 留下選擇 → 看見後果',
                '✨ 每一步都由你的真實操作解鎖(開資訊卡、看關係網、用意圖鈕、送禮/調解、點頭條),不是罐頭教學;走完會證明「這座小鎮會記得你做過的每一件事」',
                '🙅 引導卡隨時可按 ✕ 略過,略過或完成後就不再出現',
            ),
        ),
        array(
            'version' => '5.17.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🗞️ 日報變首頁:小鎮首頁最上方新增「今日頭條」,一進遊戲就看到最新一期 AI 日報的重點事件,不用再翻到紀錄分頁',
                '🧭 情境入口:每則頭條都能點 —— 點到跟居民有關的新聞,直接開他的資訊卡(看意圖+心情來源);點到建築/選舉/探索類,直接跳到對應分頁',
                '📰 完整日報裡的每則事件也都變成可點連結,把「模擬 → 新聞 → 玩家理解 → 下一步」串成一條可操作的動線',
            ),
        ),
        array(
            'version' => '5.16.0',
            'date'    => '2026-07-20',
            'changes' => array(
                '🧭 居民意圖面板:點村民資訊卡新增「當前行動 / 為什麼 / 接下來 / 對城鎮的意見」,一眼看懂這個 AI 現在在幹嘛、為什麼、接下來想做什麼、對小鎮最大的不滿',
                '💥 對話可見機械後果:每次聊完會浮現一張小結果卡(好感±、浪漫±、關係層級變化…),讓玩家清楚知道「這句話真的改變了什麼」,對話不再是純裝飾',
                '🗯️ 意圖化交談鈕:聊天列新增 安慰／打聽／說服／調解／示好／威脅／委託 七種意圖鈕,各有明確後果(安慰紓壓、打聽出真八卦、選舉期說服可拉票、調解化解仇恨、威脅重挫信任…),自由輸入照樣保留',
            ),
        ),
        array(
            'version' => '5.15.0',
            'date'    => '2026-07-19',
            'changes' => array(
                '🧠 記憶驅動情緒(RimWorld 式想法系統):村民現在會「記得」發生在自己身上的大事 —— 收到禮物、戀愛、結婚、被劈腿背叛、失戀、離婚、痛失至親、跟人結樑子、嫉妒、實現夢想、被鎮長誇獎或說壞話、祭典歡樂',
                '⏳ 每則記憶有隨時間衰退的心情影響,並持續每天微調對特定對象的好感(像真人一樣,背叛的怨恨會延燒好幾天才淡去)',
                '💭 點村民資訊卡可看到「心情來源」,一眼看懂他此刻為什麼開心或難過、對誰有情緒',
                '💾 記憶完整存進存檔,重新載入後情緒延續',
            ),
        ),
        array(
            'version' => '5.14.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🌊 水面美化(批次5):水面加入斜向流動的焦散亮線與整片緩慢起伏,不再是死板的靜態藍,像真的在流動',
                '🌳 樹冠層次:森林的樹冠依位置有深綠/亮綠/黃綠的變化與陽光亮點,一整片樹林不再像複製貼上',
            ),
        ),
        array(
            'version' => '5.13.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '💬 村民初次見面對話大幅增加變化:從 2 種罐頭擴充到 7 種(熱情招呼/一見如故/尷尬撞見/八卦拉近/被小物吸引/嘴硬心軟…),並依性格分歧。沒有 AI 額度時,開局那批「初次交談」的日誌不再千篇一律',
                '手機版全分頁體檢:經濟/任務/事件/紀錄/關係網/設定版面與字級皆確認正常',
            ),
        ),
        array(
            'version' => '5.12.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '📰 手機版小鎮日報字放大:AI 日報內容字級大幅提升、行距加寬,手機上終於看得清楚',
                '📱 全面修復「關不掉」的彈窗:送禮/爆料/排行榜等視窗點半透明背景即關、NPC 資訊卡點外面即關、祭典小遊戲加了 ✕ 隨時退出',
            ),
        ),
        array(
            'version' => '5.11.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '📱 修復手機版操作:聊天面板打開後,現在點地圖任意空白處就能收起(選單、浮動卡片也一樣),回到全螢幕地圖',
                '底部「聊天」按鈕改為切換:再點一次即收起',
            ),
        ),
        array(
            'version' => '5.10.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🧑‍🤝‍🧑 角色辨識度(批次4):每位村民依名字擁有不同的膚色、髮色與服裝深淺,同職業的居民也能一眼分辨,不再像複製人',
                '聊天聯絡人頭像同步套用,與地圖上的村民外觀一致',
            ),
        ),
        array(
            'version' => '5.9.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🌅 光影氛圍(批次3):加入時段色調 grading——清晨冷藍薄光帶一抹晨曦、黃昏黃金時刻暖橘斜照,不同時間畫面有明顯的「時段感」與電影味',
                '🎬 螢幕暗角:柔和暗化四角把視線收攏到中央(日間極淡不壓暗),整體更有質感',
            ),
        ),
        array(
            'version' => '5.8.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🏠 建築美化(批次2):整棟建築往東南投一圈柔和的落地陰影,房子有了重量感、不再像貼在地上的紙片',
                '🔺 屋頂立體感:屋頂依斜面漸層(屋脊亮、屋簷暗),看起來是有厚度的斜屋頂而非平板;屋簷陰影加深',
            ),
        ),
        array(
            'version' => '5.7.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🌿 地形美化(批次1):草地不再是一大片死綠——加了柔和的低頻明暗斑駁,更有草原的層次感',
                '🌳 植物落地陰影:灌木、樹、石頭下方的地面會承接柔影,草木不再像浮在地上',
                '🎨 破除重複貼磚:相鄰的灌木叢與花會依位置微調明暗與高光,不再像複製貼上的格子',
            ),
        ),
        array(
            'version' => '5.6.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '✨ 美術三輪 + 打擊感:好事發生時(送禮好感+、每日獎勵、夢想達成、發現組合、按讚)畫面會彈出帶黑色描邊的浮動數字/愛心,並噴出愛心/星星/金幣粒子——就像動作遊戲的傷害數字那樣有 juice',
                '🎨 全圖色彩更飽和鮮豔、對比更強;草地/土路加了細顆粒質感,不再死板平面',
                '🧍 村民角色加了深色描邊,從地圖背景中跳出來,更立體有份量',
            ),
        ),
        array(
            'version' => '5.5.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '👥 新村民包:小鎮從 12 人增至 16 人。新增周明(迷人的遊唱商人)、何昌與何秀(恩愛老夫妻)、鄭薇(暗戀成疾的年輕天才),每個都自帶戲劇鉤子',
                '💘 開局關係網:小鎮不再是一張白紙——一開始就種下暗戀(劉俊偷偷愛著許瑩)、前任(趙霞與馬強藕斷絲連)、世仇(吳達與楊鋒的舊怨)、摯友、恩愛夫妻,還有周明→趙霞→馬強的五角戀火藥庫',
                '一進遊戲就有八卦頭條在跑,戲劇比以前早非常多就開始上演(實測 Day 20 已有 4 對情侶,原本要等約 30 天才有第一對)',
            ),
        ),
        array(
            'version' => '5.4.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🌟 村民人生故事線:每個村民依價值觀/性格/職業擁有一個人生夢想(尋覓真愛/開店創業/技藝登峰/浪跡天涯/闔家團圓/名留青史),各有 4 個階段',
                '夢想隨真實遊戲狀態推進——「尋覓真愛」讀戀愛引擎(暗戀→交往→結婚)、「技藝登峰」讀技能等級、「闔家團圓」讀婚育、「名留青史」讀繁榮與議會。每個里程碑村民會發鎮民動態、進頭條',
                '✨ 點村民資訊卡可看夢想進度圓點,按「助夢」幫他加速並刷好感;夢想達成時全螢幕慶祝',
                '📰 本週小鎮頭條新增「夢想進行中」區塊,追蹤最接近實現夢想的村民,小鎮從八點檔升級成群像劇',
            ),
        ),
        array(
            'version' => '5.3.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '💗 愛恨引擎大修：修正一個核心 bug——村民的戀愛數值被固定衰退壓死,導致從來沒有人談得成戀愛。現在心動會在關係親密時持續累積、相配的人更快來電、還有「命中注定」的來電火花。實測 30 天內就會有情侶成對、告白名場面自然上演',
                '⚔️ 嫉妒與情敵：暗戀的人被追走會心碎並嫉妒情敵、兩人愛上同一人會暗自較勁,三角戀真的會燒成水火不容的死對頭',
                '🗞️ 八卦有內容了：以前八卦只顯示「X向Y八卦了全鎮的事」,現在會寫出實際內容(「你有沒有發現X看Y的眼神不太一樣...」→越傳越誇張→「X跟Y湊成一對了!」),還會針對真實的暗戀/交往/翻臉事件產生',
                '📰 本週小鎮頭條：每 7 天自動彈出愛恨糾葛摘要——本週新戀情、三角關係、暗戀進行中、水火不容、穩定放閃,一頁看懂全鎮八點檔',
            ),
        ),
        array(
            'version' => '5.2.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '📱 鎮民動態：聊天頁新增小鎮朋友圈——村民每天發文（AI 生成或模板）、朋友和死對頭會留言，分手發玻璃心文、結婚曬恩愛；玩家可按讚留言刷好感，作者會回覆你',
                '🗣️ 玩家放話：聊天時可偷偷爆料（誇讚／酸人／亂點鴛鴦），謠言進入傳播網路——誇讚傳回本人好感大增、壞話被抓到源頭是你就完了、亂點鴛鴦可能真的湊成一對',
                '📢 謠言傳話遊戲：謠言每經一手有機率越傳越誇張（最多變形兩次），傳到第四手當事人就會聽到——負面謠言引爆當面對質、雙方關係惡化，當事人還會發文暗諷',
            ),
        ),
        array(
            'version' => '5.1.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '📺 名場面直播：村民告白、婚禮、修羅場（劈腿被抓）、分手、離婚時，AI 即時生成 4-6 句戲劇對話並全螢幕直播，吃瓜第一排',
                '🎪 祭典攤位小遊戲：祭典期間地圖出現攤位按鈕——春祭/冬至猜燈謎、夏祭撈金魚、秋收投壺（計時停針），最高 70 銀幣+30 食物，每屆一次',
                '玩完攤位遊戲後，看到你成績的村民會用 AI 傳訊吐槽或膜拜',
            ),
        ),
        array(
            'version' => '5.0.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '💗 心動事件（礦石鎮式）：與村民的好感到達門檻（25/55/80、心動50）時，對方會用 AI 說出專屬真心話——告白、秘密、感謝，玩家二選一回應影響好感與心動值，每人每門檻限一次',
                '🎊 季節祭典 AI 化：祭典期間村民對話與聊天自然融入祭典話題，NPC 主動邀你逛祭典，與你感情最深的人（伴侶＞心動＞摯友）會第一個來約你',
                '送禮、聊天後即時檢查心動門檻，重要時刻不再錯過',
            ),
        ),
        array(
            'version' => '4.9.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🏗️ 建築選址制：蓋新建築時由玩家點地圖挑位置（需 2×2 空地），工地有鷹架與施工進度條，完工後建築實際蓋在你選的地點',
                '✨ 開羅式相鄰組合：把相配的建築和裝飾放在附近會觸發組合（浪漫街角、市集人氣、銅牆鐵壁等 8 種），提升美觀與繁榮，配方要自己摸索',
                '🤖 AI 深度整合：建築完工、組合發現時，相關職業的村民會用 AI 傳訊息給你發表感想（鐵匠評鍛造坊、守衛評城牆…）',
                '修復：完工建築的地圖圖示先前因欄位名稱不符從未顯示，現已修正',
            ),
        ),
        array(
            'version' => '4.8.0',
            'date'    => '2026-07-16',
            'changes' => array(
                '🌸 裝飾自由擺放：經濟頁新增「裝飾小鎮」目錄（花圃/長椅/路燈/雕像/小噴泉），選好後直接點地圖空地擺放，點已有裝飾可移除（退回一半材料）',
                '裝飾提升小鎮美觀度（繁榮度加分，上限 +35），路燈與噴泉夜晚會發光，噴泉有動態水花',
                '裝飾隨存檔保存，雲端/本機皆支援',
            ),
        ),
        array(
            'version' => '4.7.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '系統逐步解鎖（開羅式）：新手只看到居民/聊天/任務，經濟(繁榮12)→成就(20)→事件+關係網(28)→產業(38)隨發展開啟，解鎖時有慶祝動畫；老玩家已達標的自動開通',
                '關係網大改版：預設只顯示戀愛/單戀/敵對（摯友線可切換），點任何人進入個人視角，新增「本鎮八卦頭條」文字摘要（夫妻/三角關係/互相暗戀/死對頭一目瞭然）',
            ),
        ),
        array(
            'version' => '4.6.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '🎁 送禮系統：聊天視窗可送 5 種禮物給村民刷好感，投其所好效果加倍（每人每天一次）',
                '🏆 全球繁榮排行榜：登入玩家的繁榮度自動上榜，經濟頁可查看前 20 名',
                '⚡ 效能大幅優化：地形改用靜態底圖快取，每幀繪製從 4800 次降為 1 次，手機更省電流暢',
                '💾 存檔保護：localStorage 滿載時自動瘦身重試，避免存檔靜默失敗',
                '📖 教學文案更新為新版操作方式（走近交談、☰ 選單、💬 聊天）',
                '補齊張豪、趙霞的第二條個人故事線；密碼重設加上帳號級冷卻鎖定',
                '英文介面翻譯補齊',
            ),
        ),
        array(
            'version' => '4.5.1',
            'date'    => '2026-07-15',
            'changes' => array(
                '移除夜晚起霧感：夜色改用 multiply 混色，變暗但色彩保持飽和清晰',
                '日夜辨識強化：時鐘顯示 🌅☀️🌆🌙 階段圖示（桌面+手機）',
                '修復聊天面板點「日誌」子分頁沒反應的問題（自動轉為浮動卡呈現）',
            ),
        ),
        array(
            'version' => '4.5.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '決策卡延遲後果：做出決定 3 天後，村民會回來道謝（+銀幣+聲望）或抱怨（全鎮心情下降），並在八卦跑馬燈播報',
                '災害預警防災選擇：乾旱/暴風雪來襲前一天可選「全面防災/基本準備/聽天由命」，投入資源可大幅減輕災損',
                '美術二輪：角色四方向（往上走看到後腦勺、側走五官偏移）、屋頂 4 色配色（紅藍綠紫）、夜晚窗戶透出暖光',
                '關係網總覽圖：新「💞 關係」分頁，一張圖看全鎮誰愛誰恨誰（戀愛/單戀/摯友/敵對/出軌）',
                '每日登入獎勵：連續登入 7 天階梯獎勵（銀幣+食物）',
                '離線進度結算：離開超過 10 分鐘再回來，小鎮會補跑模擬（上限 2 天）並顯示結算摘要',
            ),
        ),
        array(
            'version' => '4.4.2',
            'date'    => '2026-07-15',
            'changes' => array(
                '選單去重：「產業」併入「經濟」卡片的子分頁（經濟｜產業），選單更精簡',
            ),
        ),
        array(
            'version' => '4.4.1',
            'date'    => '2026-07-15',
            'changes' => array(
                '手機版底部新增狀態帶（機場物語式）：繁榮度/銀幣/食物/人口一目瞭然，點擊直達經濟頁',
                '8-bit UI 音效：選單開關、按鈕點擊、成就解鎖都有短促音效（跟隨 BGM 音量與靜音設定）',
                '選單/按鈕按壓縮放回饋；搖桿與互動提示位置配合狀態帶調整',
            ),
        ),
        array(
            'version' => '4.4.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '手機版全面開羅化（機場物語式）：地圖永遠全螢幕，UI 全部浮在地圖上',
                '底部極簡列：只有「☰ 選單」與「💬 聊天」兩顆按鈕（聊天帶未讀徽章）',
                '左側浮動選單：居民/任務/經濟/產業/事件/成就/紀錄/設定 一覽',
                '分頁內容改為置中浮動卡片＋返回鈕，背後地圖持續運轉；聊天保留大面板方便打字',
            ),
        ),
        array(
            'version' => '4.3.7',
            'date'    => '2026-07-15',
            'changes' => array(
                '修復 iPhone 上按鈕文字變成系統藍色的問題（紅底藍字）：全域強制按鈕/輸入框使用主題文字色，強調按鈕白字',
            ),
        ),
        array(
            'version' => '4.3.6',
            'date'    => '2026-07-15',
            'changes' => array(
                '預設縮放拉近：手機 2 倍、桌面 1.6 倍，開場即可看清角色',
                '開場鏡頭自動對準玩家角色並跟隨',
            ),
        ),
        array(
            'version' => '4.3.5',
            'date'    => '2026-07-15',
            'changes' => array(
                '手機版改為開羅式抽屜介面：地圖為主體，面板高度 55vh→44vh（聊天分頁 62vh 方便打字）',
                '再點一次目前分頁即可收合面板回到全地圖；收合把手加粗更明顯',
            ),
        ),
        array(
            'version' => '4.3.4',
            'date'    => '2026-07-15',
            'changes' => array(
                '修復手機版互動提示文字直排疊字看不懂的問題（強制單列不換行）',
                '觸控裝置的互動提示改顯示 👆 點擊提示（取代無意義的 E 鍵標籤）',
            ),
        ),
        array(
            'version' => '4.3.3',
            'date'    => '2026-07-15',
            'changes' => array(
                '修復聊天訊息重複送出：AI 回覆期間遊戲時間前進導致去重失效，同一句話被記錄兩次',
                '設定頁簡化：AI 供應商/金鑰欄位收進「進階」摺疊區，一般玩家只看到「小鎮 AI 已啟用（免設定）」',
                '舊玩家自動升級：先前預設為模擬對話且未設金鑰者,自動改用小鎮伺服器 AI（一次性遷移）',
            ),
        ),
        array(
            'version' => '4.3.2',
            'date'    => '2026-07-15',
            'changes' => array(
                '修復手機版 Safari 上下留白:頁面底色改為深色、鎖定滿版高度、關閉過捲彈跳',
            ),
        ),
        array(
            'version' => '4.3.1',
            'date'    => '2026-07-15',
            'changes' => array(
                '背景音樂音量修正：改用感知音量曲線（不再刺耳），預設音量調低',
                '桌面版排版重整：單列緊湊 header、資訊改為圓角 chips、控制鈕群組靠右、訪客橫幅不再遮住標題',
                '手機版標題列壓縮：時間/人口不再擠壓重疊，窄螢幕自動隱藏 1.5x 檔位保住選單按鈕',
            ),
        ),
        array(
            'version' => '4.3.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '美術大升級(開羅遊戲風格):草地平整明亮、道路長出草鬚鑲邊、水岸有沙灘與動態浪花',
                '建築立體感:落影、屋脊高光、屋簷深緣、外緣描邊,不再是平面色塊',
                '小鎮伺服器 AI(免金鑰):不用自備 API 金鑰,選「🏘️ 小鎮伺服器 AI」即可讓村民用 AI 對話(Vercel 版預設開啟)',
                'AI 每日額度:訪客 20 則、登入玩家 100 則,超過自動回到模擬對話',
            ),
        ),
        array(
            'version' => '4.2.0',
            'date'    => '2026-07-15',
            'changes' => array(
                '礦石鎮物語式直接操作：WASD/方向鍵按住即可自由移動角色（像素級移動、撞牆滑行、鏡頭自動跟隨）',
                '手機版新增虛擬搖桿（地圖左下角），拖曳即可移動角色',
                '走近村民自動出現「交談」提示（含好感愛心等級），按 E 或點提示立即開聊',
                '點擊村民改為先顯示快速資訊卡：好感愛心、職業、心情，以及他目前愛誰恨誰的八卦',
                '愛恨糾葛看得見：戀愛/已婚/暗戀/出軌/敵對的村民頭上會輪播 💕💍💘🖤💢 表情',
                '新增八卦跑馬燈：鎮上發生戀情、劈腿、打架等大事時即時播報在地圖上方',
            ),
        ),
        array(
            'version' => '4.1.8',
            'date'    => '2026-07-15',
            'changes' => array(
                'Vercel 版新增完整帳號系統：註冊/登入/雲端存檔/成就同步改由 Vercel Serverless Functions + Blob 儲存提供，不再依賴 WordPress',
                '前端自動偵測執行環境：WordPress 用原 REST API，靜態站(rimtown.cc/Vercel)用 /api/ + JWT',
                '登入狀態以 JWT 保存於瀏覽器,重新整理頁面仍保持登入',
            ),
        ),
        array(
            'version' => '4.1.7',
            'date'    => '2026-07-15',
            'changes' => array(
                '修復重大 bug：旅行歸來居民的記憶還原欄位錯誤，導致每 3 天模擬崩潰（慶典/農場/任務等每日更新全部停擺）',
                '聲望系統 5 種效果全部真正生效：新增事件護盾（降低襲擊/災難機率）、移民吸引、商人交易價格加成、新居民初始信任',
                '修復深井減災永不觸發的 bug，抗旱效果隨深井升級（淨水系統）增強',
                '修復手機版出現兩個標題列的問題（桌面 header 未隱藏）',
                'WordPress 版補齊缺失的桌面/手機 header 控制列（時鐘、人口、暫停、儲存、速度、AI 狀態等 21 個元素）',
                '新增桌面版「帳號」按鈕（原本點手機選單的帳號沒有反應）',
                '修復設定頁籤「儲存設定」會把英文介面強制切回中文的 bug',
                '修復 Firefox/Safari 上 PWA 註冊直接報錯的問題（chrome 識別字未定義）',
                '教學提示卡移至 header 下方，不再遮住暫停/速度按鈕；訪客橫幅不再蓋住側欄內容',
                'Service Worker 快取版本同步 + 補上遺漏的 chiptune.js（離線時 BGM 也能用）',
                '新增網頁 favicon；header 新增天氣顯示元素',
                '版號同步：所有檔案統一為 4.1.7',
            ),
        ),
        array(
            'version' => '4.1.6',
            'date'    => '2026-03-25',
            'changes' => array(
                '手機版訪客模式橫幅移至底部 tab bar 上方，不再遮擋遊戲畫面',
                '版號同步：所有檔案統一為 4.1.6',
            ),
        ),
        array(
            'version' => '4.1.5',
            'date'    => '2026-03-25',
            'changes' => array(
                '新增訪客模式：不用註冊也能試玩，點「🎮 訪客試玩」即可進入遊戲',
                '訪客可體驗完整互動卡片（每日決策、事件選擇、NPC 求助、議會投票）',
                '訪客可觀看新手教學引導',
                '頂部顯示訪客模式提示橫幅，可隨時關閉或點「註冊帳號」升級',
                '登入/註冊後自動退出訪客模式、隱藏橫幅',
                '帳號按鈕顯示「訪客」文字，點擊可開啟登入視窗',
                '版號同步：所有檔案統一為 4.1.5',
            ),
        ),
        array(
            'version' => '4.1.4',
            'date'    => '2026-03-17',
            'changes' => array(
                '新增 8-bit chiptune 背景音樂系統（Web Audio API 程序化合成，無需音檔）',
                '4 首曲目隨日夜自動切換：白天（活潑冒險）、黃昏（溫暖放鬆）、夜晚（寧靜小調）、黎明（柔和甦醒）',
                'NES 四聲道音色：方波旋律、三角波低音、琶音和聲、噪音鼓組',
                '設定面板新增「背景音樂」音量滑桿與靜音按鈕',
                '預留 loadCustomTrack() 介面，可用自訂音檔替換程序化曲目',
                '版號同步：所有檔案統一為 4.1.4',
            ),
        ),
        array(
            'version' => '4.1.3',
            'date'    => '2026-03-17',
            'changes' => array(
                '每日決策改為請託型框架：村民主動找你商量，取代鎮長視角的命令式決策',
                '未登入時隱藏新手教學與互動圖卡（決策、事件、NPC求助、議會）',
                '版號同步：所有檔案統一為 4.1.3',
            ),
        ),
        array(
            'version' => '4.1.2',
            'date'    => '2026-03-17',
            'changes' => array(
                '修正插件 header 版本號與 RIMTOWN_VERSION 不一致',
            ),
        ),
        array(
            'version' => '4.1.1',
            'date'    => '2026-03-17',
            'changes' => array(
                '修復 WordPress 版本缺少通知 HTML 元素：成就彈窗、事件公告、任務引導、新手教學、遊戲對話框、手機版頭部全部補上',
                '版號同步：所有檔案統一為 4.1.1',
            ),
        ),
        array(
            'version' => '4.1.0',
            'date'    => '2026-03-17',
            'changes' => array(
                '建築升級系統：所有 12 棟建築支援 3 級升級（Lv.1→Lv.2→Lv.3），每級更強效果',
                '升級路徑：瞭望塔→強化瞭望塔→哨兵高塔、穀倉→大型穀倉→冷藏穀庫 等',
                '升級 UI：建築等級星星標示、升級區域含費用與效果預覽',
                '新成就：精益求精（首次升級）、登峰造極（最高等級）',
                '修復 startProject 變數遮蔽 bug：const t 遮蔽翻譯函數導致 TypeError',
                '修復 BuildingManager._counter 未序列化：存讀檔後 ID 計數器重置',
                '向下相容舊存檔：自動補全 buildingKey 與 level 欄位',
                '版號同步：所有檔案統一為 4.1.0',
            ),
        ),
        array(
            'version' => '4.0.0',
            'date'    => '2026-03-16',
            'changes' => array(
                '每日決策系統：每天一張選擇卡片，影響資源、居民心情與聲望',
                '商店系統：14 種商品可買賣，聲望等級享折扣優惠',
                '事件選擇系統：重大事件（盜匪、災害等）提供多種應對選項',
                'NPC 求助系統：居民會請求你的幫助，選擇影響好感度與聲望',
                '工作動作按鈕：手動執行工作獲得資源與技能經驗',
                '互動式報紙：可對每日新聞進行調查/支持/忽略反應',
                '聲望系統（完整版）：6 個等級（無名之輩→傳奇人物），影響交易價格、NPC 信任、商店折扣、事件減免、移民吸引力',
                '心情系統優化：夜間需求衰減放緩，心情懲罰改為漸進式而非斷崖式',
                '任務頁籤新增聲望面板：階級徽章、進度條、效果一覽、來源追蹤',
                '動態天氣引擎：10 種天氣類型按季節加權，3日預報，溫度/濕度/風速，影響農業、心情、NPC活動',
                '天然災害系統：嚴重乾旱/暴風雪/洪水，連續極端天氣觸發，預警機制，建築減災，災後恢復',
                'NPC 議會治理：自動組建議會，12 種提案，NPC 依性格投票，玩家可參與，政令持續 20 天',
                '版號同步：所有檔案統一為 4.0.0',
            ),
        ),
        array(
            'version' => '3.7.1',
            'date'    => '2026-03-16',
            'changes' => array(
                '修復儲存設定後 Groq API Key 被清空的問題',
                'fallbackGroqKey 讀取來源新增 settings tab input 與 localStorage fallback',
                '版號同步：所有檔案統一為 3.7.1',
            ),
        ),
        array(
            'version' => '3.7.0',
            'date'    => '2026-03-16',
            'changes' => array(
                '修復聊天對話持續閃爍問題：模擬 tick 時跳過聊天頁面完整重繪，改用 DOM 原地更新',
                '同步 WordPress 版本：像素頭像、style.css、app.js 與 Chrome Extension 完全一致',
                '版號同步：所有檔案統一為 3.7.0',
            ),
        ),
        array(
            'version' => '3.6.15',
            'date'    => '2026-03-16',
            'changes' => array(
                '聊天通訊錄頭像改為 NPC 像素風角色圖（職業服裝、髮型、性別、配件）',
                '修正聊天閃爍：新增 _renderChatMessages() 只更新訊息區域',
                '成就／事件通知改為螢幕中央大卡片覆蓋（含背景模糊效果）',
                '新增報紙通知與通知佇列系統',
                '版號同步：所有檔案統一為 3.6.15',
            ),
        ),
        array(
            'version' => '3.6.14',
            'date'    => '2026-03-16',
            'changes' => array(
                '修復地圖 NPC 名牌與聊天介面中職業顯示為 [object Object] 的 bug',
                '美化聊天介面：漸層背景、氣泡滑入動畫、未讀紅點脈動效果、輸入框聚焦光暈',
                'NPC 回覆前顯示打字中動畫並加入隨機延遲，對話更自然',
                '版號同步：所有檔案統一為 3.6.14',
            ),
        ),
        array(
            'version' => '3.6.13',
            'date'    => '2026-03-16',
            'changes' => array(
                '重新設計聊天介面為訊息 App 風格（Messaging App）',
                '移除 NPC 對話距離限制，任何地方都能與 NPC 交談',
                'NPC 主動訊息功能：NPC 會主動傳訊息給玩家',
                '地圖上所有 NPC 頭上顯示名字 + 職業卡片',
                '版號同步：所有檔案統一為 3.6.13',
            ),
        ),
        array(
            'version' => '3.6.12',
            'date'    => '2026-03-15',
            'changes' => array(
                '修正 API key 貼上/儲存時被清空的問題：renderSettings() 改為優先使用現有 DOM input 的值，只有在 input 元素不存在時才從 localStorage 讀取，避免 renderSidebar() 重繪時覆蓋使用者尚未儲存的輸入',
                '版號同步：所有檔案統一為 3.6.12',
            ),
        ),
        array(
            'version' => '3.6.10',
            'date'    => '2026-03-15',
            'changes' => array(
                '修復 API key 儲存時被清空的 race condition：render() 的 setInterval tick 會在點擊儲存按鈕時重新渲染 settings tab，導致未儲存的表單資料被覆蓋，現在 activeTab 為 settings 時跳過 sidebar 重繪',
                '修復 _escapeHtml 未跳脫雙引號的問題：API key 若含引號字元會破壞 HTML value 屬性',
                '版號同步：所有檔案統一為 3.6.10',
            ),
        ),
        array(
            'version' => '3.6.9',
            'date'    => '2026-03-15',
            'changes' => array(
                'NPC 智慧尋路：實作 A* 演算法，NPC 不再撞牆，會自動繞過建築物',
                '建築入口優化：門口清出 3x2 格泥土空地，NPC 更容易進出建築',
                'NPC 提前出門：睡前 1 小時回家、上班前 1 小時出門，行為更像真人',
                '城鎮列表按鈕美化：新建城鎮/關閉改為圓角大按鈕',
                '移除設定面板暫停/繼續按鈕',
                '版號同步：所有檔案統一為 3.6.9',
            ),
        ),
        array(
            'version' => '3.6.8',
            'date'    => '2026-03-15',
            'changes' => array(
                '登入畫面預設顯示登入表單',
                '設定 tab 新增遊戲控制區塊：暫停/繼續、速度倍率、城鎮列表、新地圖',
                '版號同步：所有檔案統一為 3.6.8',
            ),
        ),
        array(
            'version' => '3.6.7',
            'date'    => '2026-03-15',
            'changes' => array(
                '未登入時自動顯示登入畫面，不需手動點擊',
                '背景霧化城鎮地圖：登入畫面背景使用模糊濾鏡顯示城鎮地圖',
                '版號同步：所有檔案統一為 3.6.7',
            ),
        ),
        array(
            'version' => '3.6.6',
            'date'    => '2026-03-15',
            'changes' => array(
                '美化對話方塊：將瀏覽器原生 alert/confirm 替換為遊戲風格自訂彈窗',
                '修復 NPC 卡牆加強版：屋頂(ROOF/ROOF2)與柵欄(FENCE)納入不可行走判定',
                '修復碰撞滑動邏輯：正確拆分 X/Y 軸分量進行碰撞回避',
                'NPC 卡在牆內時自動傳送至最近可行走位置',
                '可行走目標搜索半徑從 5 格擴大至 10 格',
                '存檔管理 UI 精簡：合併「帳號」與「存檔管理」為「帳號與存檔」',
                '移除匯出/匯入存檔按鈕，登入後存檔自動同步雲端',
                '版號同步：所有檔案統一為 3.6.6',
            ),
        ),
        array(
            'version' => '3.6.5',
            'date'    => '2026-03-15',
            'changes' => array(
                '修復登入功能：新增缺失的 auth-modal HTML（登入/註冊/重設密碼表單）',
                '新增 wp_localize_script 注入 rimtownAuth 前端認證變數',
                '新增完整 REST API 端點：login、register、reset-password、me、logout、saves、save、achievements',
                '認證端點速率限制：登入 5次/5分鐘、註冊 5次/5分鐘、重設密碼 3次/10分鐘',
                '修復走路撞牆卡住：新增 _isWalkableTile() 牆壁碰撞檢測',
                '新增 _findWalkableTarget() 自動尋找最近可行走位置，避免目標點落在牆內',
                '走路時碰到牆壁會沿軸滑動避開，不再卡住原地',
                '地圖自由點擊走路：點擊地圖任意位置都能讓玩家走過去',
                '移動指示器顯示在實際點擊位置，而非區域中心',
                '修復手機登入後地圖跑版：關閉 auth modal 時先 blur 輸入框、重設 viewport 縮放',
                '防止 iOS 自動放大：登入表單 input font-size 設為 16px',
                '版號同步：所有檔案統一為 3.6.5',
            ),
        ),
        array(
            'version' => '3.6.4',
            'date'    => '2026-03-15',
            'changes' => array(
                '修復 WordPress 腳本載入順序：i18n.js 改為最先載入，所有模組加入依賴，修復 t is not defined',
                '修復 processing.js 語法錯誤：移除 dailyUpdate() 中多餘的大括號，修復 Illegal continue statement',
                '版號同步：所有檔案統一為 3.6.4',
            ),
        ),
        array(
            'version' => '3.6.3',
            'date'    => '2026-03-15',
            'changes' => array(
                'NPC 弔念系統：城鎮有人過世後，NPC 會前往墓園弔念',
                '家人年度弔念：配偶、子女、父母每年會固定前往墓園緬懷逝者',
                '全鎮同悲：非親屬鎮民也有機率前往弔念',
                '弔念行為產生記憶、心情變化與日誌訊息',
                'PWA 支援：新增 pwa-manifest.json、sw.js，可安裝到手機主畫面',
                '全螢幕體驗：standalone 模式下隱藏瀏覽器 UI，雙擊標題可切換全螢幕',
                '離線快取：核心遊戲資源離線可用',
                '安裝提示橫幅：瀏覽器觸發 beforeinstallprompt 時顯示安裝按鈕',
                'NPC 睡眠凍結：睡眠中的 NPC 抵達家中後不再亂走',
                '門進出系統：NPC 進出建築物會走門，不再穿牆',
                '個別房屋系統：住宅區有 4 間可點擊的獨立房屋，每位 NPC 分配至特定房屋',
                '人生總結報告：結局畫面新增豐富的人生統計、關係圖表、成就列表',
                'i18n 新增弔念與安裝相關中英翻譯',
                '版號同步：所有檔案統一為 3.6.3',
            ),
        ),
        array(
            'version' => '3.6.2',
            'date'    => '2026-03-15',
            'changes' => array(
                '修復手機版多處 RWD 跑版問題',
                '教學卡片：改用 calc(100vw - 32px) 限制寬度，防止文字溢出螢幕',
                '任務引導橫幅：使用 min(500px, calc(100vw - 32px)) 避免超出手機螢幕',
                '底部導覽列：加入 max-width: 100vw 防止水平溢出',
                '版號同步：所有檔案統一為 3.6.2',
            ),
        ),
        array(
            'version' => '3.6.1',
            'date'    => '2026-03-14',
            'changes' => array(
                '修復手機重新整理後登入狀態遺失的問題',
                '版號同步：所有檔案統一為 3.6.1',
            ),
        ),
        array(
            'version' => '3.4.0',
            'date'    => '2026-03-14',
            'changes' => array(
                '新增 5 步驟新手教學引導（劇情故事 → 地圖 → 居民聊天 → 經濟產業 → 事件探索）',
                'NPC 日程改版：工作時間留在工作地點，下班後社交，睡覺時待在家不聊天',
                '夜晚視覺加強：tint 15%→35%、新增月亮、星星 40→80 顆、營火/火把/窗燈光圈加大',
                '新增夜間暗角 vignette 效果',
                '版號同步：所有檔案統一為 3.4.0',
            ),
        ),
        array(
            'version' => '3.3.5',
            'date'    => '2026-03-14',
            'changes' => array(
                '新增全螢幕登入畫面：未登入用戶進入遊戲前顯示登入介面',
                '登入畫面包含帳號/密碼登入、註冊帳號、忘記密碼、訪客進入',
                '背景使用 backdrop-filter blur(12px) 模糊化底下的村莊地圖',
                '登入/註冊成功後畫面淡出動畫，顯示正常遊戲',
                '村民對話（紀錄 tab）改為預設展開',
                '版號同步：所有檔案統一為 3.3.5',
            ),
        ),
        array(
            'version' => '3.3.4',
            'date'    => '2026-03-14',
            'changes' => array(
                '職業按鈕邊框從 var(--border) #333 改為 rgba(255,255,255,0.25)，深色背景上清晰可見',
                '居民列表無業提示的職業按鈕 padding 加大、邊框加亮',
                '版號同步：所有檔案統一為 3.3.4',
            ),
        ),
        array(
            'version' => '3.3.3',
            'date'    => '2026-03-14',
            'changes' => array(
                '村民對話預設收合，只顯示時間+人名+摘要，點擊展開完整對話',
                '加入 ▶ 展開指示符，展開時旋轉 90° 提供視覺回饋',
                '每組對話改為卡片式排版（圓角邊框+背景色），群組間有間距',
                '展開後對話區加左側 accent 色邊線，對話行間距加大+分隔線',
                '修正 toggle handler: collapsed → expanded class',
                '版號同步：所有檔案統一為 3.3.3',
            ),
        ),
        array(
            'version' => '3.3.2',
            'date'    => '2026-03-14',
            'changes' => array(
                '桌面版：section 標題/按鈕 padding/居民名稱職業狀態字體全面放大',
                '手機版 (≤768px)：section 標題 1.05rem、按鈕 0.85rem、居民/資源/建築/新聞等放大',
                'iPad (769-1024px)：section 標題/按鈕/居民卡片/資源等中間尺寸',
                'sub-tab 按鈕手機版 0.85rem、iPad 0.8rem，增加觸控友善度',
                '設定面板 label 0.72→0.82rem，各 inline 小字 0.65→0.75rem',
                '版號同步：所有檔案統一為 3.3.2',
            ),
        ),
        array(
            'version' => '3.3.1',
            'date'    => '2026-03-14',
            'changes' => array(
                '全域加上 overflow-x: hidden，防止手機版/iPad 左右滑動偏移',
                '手機版 tab icon 從 1rem 放大到 1.35rem，小螢幕 1.2rem，iPad 1.1rem',
                'tab bar 高度提升（手機 42→48px、小螢幕 38→44px）改善觸控體驗',
                'sidebar content 加上 overflow-x: hidden + max-width 防止內容溢出',
                'sub-tab-bar 手機版取消負邊距避免水平溢出',
                '新增 iPad Portrait (769-1024px) 專用媒體查詢',
                '版號同步：所有檔案統一為 3.3.1',
            ),
        ),
        array(
            'version' => '3.3.0',
            'date'    => '2026-03-14',
            'changes' => array(
                'AI 日報從「紀錄」sub-tab 移入「事件」tab，與新聞公告、鎮長選舉等重要資訊整合',
                '「紀錄」tab 簡化為「日誌」，專門顯示 NPC 對話紀錄',
                'AI 日報 LLM prompt 大幅增強，新增天氣、資源、選舉、NPC 活動等上下文',
                '日報結構改為四段式：頭條標題 → 頭條報導 → 鎮務簡報 → 街頭巷尾 → 手記',
                'max_tokens 800→1200，產出更豐富的 NPC 視角日報內容',
                '經濟面板資源列表只顯示已取得的項目（amount > 0）',
                '為 30 種進階物品加上專屬 emoji icon 與中文標籤（木板、磚塊、農作物、加工品等）',
                '修正手機版點擊 API Key 輸入框時鍵盤會跳掉無法輸入的問題',
                '版號同步：所有檔案統一為 3.3.0',
            ),
        ),
        array(
            'version' => '3.2.9',
            'date'    => '2026-03-14',
            'changes' => array(
                '冬季農業產量乘數 0.2→0.4，避免每年冬季必然缺糧崩潰',
                'NPC 老化速度減半：每 2 季老 1 歲（原本每季 1 歲），延長 NPC 壽命一倍',
                '結婚門檻提高：交往時間 100→300 ticks、好感 40/35→50/45、浪漫 50/40→55/45、機率 15%→10%',
                '產業系統對 NPC 職業的壓制從 70%（×0.3）降為 50%（×0.5），NPC 職業仍有存在感',
                '觀星活動的浪漫值增長新增前提條件：好感度必須 >20 才會產生浪漫',
                '版號同步：所有檔案統一為 3.2.9',
            ),
        ),
        array(
            'version' => '3.2.8',
            'date'    => '2026-03-14',
            'changes' => array(
                '玩家-NPC 夫妻生育不受 20 人口上限限制，改為最多 3 個孩子',
                'NPC-NPC 夫妻仍維持原本的人口上限',
                '新增 Personality.compatibility() 靜態方法，根據特質組合計算 0.2x ~ 1.6x 倍率',
                '8 組增益配對 + 8 組衝突配對，套用至所有好感成長管道',
                '超過 50 ticks 未互動，好感每日 -0.8（情侶 -0.3），浪漫值每日 -0.5',
                '修復 _checkBirths 中 npc.age 應為 agent.age 的未定義變數 bug',
                '版號同步：所有檔案統一為 3.2.8',
            ),
        ),
        array(
            'version' => '3.2.7',
            'date'    => '2026-03-14',
            'changes' => array(
                '新增繼承/二周目系統：玩家可生子，結局後以下一代重新開始',
                '玩家婚後可觸發生育事件，孩子繼承父母特質',
                '結局畫面新增「開始新一代」按鈕，繼承部分資源與關係',
                '版號同步：所有檔案統一為 3.2.7',
            ),
        ),
        array(
            'version' => '3.2.6',
            'date'    => '2026-03-14',
            'changes' => array(
                '手機版移除「更多」彈出選單，改為各 Tab 內建群組 sub-tab',
                '居民+詳情、聊天+紀錄、任務+事件+成就、經濟+產業',
                '設定升級為第 5 個固定 Tab',
                '版號同步：所有檔案統一為 3.2.6',
            ),
        ),
        array(
            'version' => '3.2.5',
            'date'    => '2026-03-12',
            'changes' => array(
                '修復手機版「更多」按鈕未顯示的問題',
                '更多選單改為 3x2 網格佈局',
                '版號同步：所有檔案統一為 3.2.5',
            ),
        ),
        array(
            'version' => '3.2.4',
            'date'    => '2026-03-12',
            'changes' => array(
                '手機版導航重新設計：5 Tab + 更多彈出選單',
                '不再需要左右橫向滾動，操作更直覺',
                '版號同步：所有檔案統一為 3.2.4',
            ),
        ),
        array(
            'version' => '3.2.3',
            'date'    => '2026-03-11',
            'changes' => array(
                '修復手機版 mobile-header 仍然顯示的問題',
                '手機版與平板版 header 統一隱藏，整合至居民 Tab',
                'app.js 版號同步更新',
                '版號同步：所有檔案統一為 3.2.3',
            ),
        ),
        array(
            'version' => '3.2.2',
            'date'    => '2026-03-11',
            'changes' => array(
                'Header 資訊整合至居民 Tab（town-info-bar：城鎮名稱+人口+時鐘）',
                '移除桌面版頂端 Header 列，釋放更多地圖空間',
                'town-info-bar 即時更新：renderClock() 每 tick 同步刷新',
                '經濟頁繁榮度標題旁新增人口數顯示',
                '版號同步：所有檔案統一為 3.2.2',
            ),
        ),
        array(
            'version' => '3.2.1',
            'date'    => '2026-03-11',
            'changes' => array(
                '成就系統從 57 個擴展到 99 個（7 大分類全面覆蓋）',
                '修復新建城鎮按鈕：modal 自動關閉 + 取消暫停 + 確認訊息',
                'Header 城鎮名稱改為動態顯示',
                '修復節慶橫幅與城鎮廣場標籤重疊',
                '版號同步：所有檔案統一為 3.2.1',
            ),
        ),
        array(
            'version' => '3.2.0',
            'date'    => '2026-03-11',
            'changes' => array(
                '設定 tab 新增 1x/1.5x/2x/3x 加速倍率按鈕',
                '設定 tab 新增 AI 連線狀態指示器',
                'Header 中文化：Population→人口、travelling→外出',
                '移除 Header 中不必要的地形/種子碼顯示',
                '版號同步：所有檔案統一為 3.2.0',
            ),
        ),
        array(
            'version' => '3.1.9',
            'date'    => '2026-03-11',
            'changes' => array(
                '移除桌面版整條 toolbar 及手機版選單按鈕/下拉選單',
                '設定 tab 新增「🎮 遊戲控制」：暫停/繼續、城鎮列表、新地圖',
                'Header 精簡為只顯示城鎮名稱、人口、時間',
                '版號同步：所有檔案統一為 3.1.9',
            ),
        ),
        array(
            'version' => '3.1.8',
            'date'    => '2026-03-11',
            'changes' => array(
                '合併「🗞️ 日報」和「📝 日誌」為單一「📝 紀錄」tab，內含子 tab 切換',
                'Sidebar tab 從 11 個（3 行）回到 10 個（5×2 grid），設定不再獨佔一行',
                '版號同步：所有檔案統一為 3.1.8',
            ),
        ),
        array(
            'version' => '3.1.7',
            'date'    => '2026-03-11',
            'changes' => array(
                '新增 ⚙️ 設定 tab：整合帳號、AI 語言模型、遊戲設定、存檔管理於側邊欄',
                '工廠子標籤 icon 改為 🔧（避免與 🏭 產業 tab 重複）',
                '修復手機版 tab bar 右側被裁切（CSS specificity + 寬度約束）',
                '版號同步：WordPress / Chrome Extension / app.js / manifest.json 統一為 3.1.7',
            ),
        ),
        array(
            'version' => '3.1.6',
            'date'    => '2026-03-11',
            'changes' => array(
                '手機版 UI 大改版：移除無功能的漢堡 FAB 按鈕',
                '手機版底部面板重新設計：10 個 tab 改為單行水平滾動（原本 5×2 grid 佔太多空間）',
                '新增 Bottom Sheet 收合機制：預設只顯示 tab bar，點擊展開內容，再點同一 tab 收合',
                '手機版地圖可視範圍大幅提升（底部面板收合時幾乎全螢幕）',
                '支援拖拽手柄上滑展開/下滑收合',
                '版號同步：WordPress / Chrome Extension / manifest.json 統一為 3.1.6',
            ),
        ),
        array(
            'version' => '3.1.5',
            'date'    => '2026-03-10',
            'changes' => array(
                '詳情頁職業選擇區塊美化：3x grid 圖示按鈕 + 目前職業 badge + 辭職按鈕樣式',
                'AI 日報卡片化：期號/日期/記者分層排版 + 摺疊預覽 + 展開全文',
                '修復主線任務第一個任務（落腳邊境）可能卡在鎖定狀態的 bug',
                '版號同步：WordPress / Chrome Extension / manifest.json 統一為 3.1.5',
            ),
        ),
        array(
            'version' => '3.1.4',
            'date'    => '2026-03-10',
            'changes' => array(
                'WordPress sidebar tabs 加入 emoji 圖示 + tab-icon/tab-label 結構',
                '移除多餘的農場/工廠 tab（已合併至產業子 tab）',
                '新增任務 tab 和成就 tab',
                '手機版 mobile-header 加入獨立人口顯示',
                '加入 iPhone safe-area-inset（瀏海/底部 Home Indicator 適配）',
                '手機按鈕觸控區域 min-height 提升至 36-40px',
                '新增節慶/派系/任務/成就/繁榮度等新組件的 mobile RWD',
                '版號同步：WordPress / Chrome Extension / manifest.json 統一為 3.1.4',
            ),
        ),
        array(
            'version' => '3.1.3',
            'date'    => '2026-03-10',
            'changes' => array(
                '美化事件頁面：節慶區塊、任務進度條、派系卡片全面重新設計',
                '美化成就頁面：新增分類標籤篩選、成就卡片視覺升級',
                '改善 AI 日報 prompt：注入居民關係動態與最近對話精華',
                '日報寫作風格升級：場景細節、人物表情、記者個性更鮮明',
                '清理多餘的側邊欄導航項目',
                '版號同步：WordPress / Chrome Extension / app.js 統一為 3.1.3',
            ),
        ),
        array(
            'version' => '3.1.2',
            'date'    => '2026-03-10',
            'changes' => array(
                '修復地圖消失：mobile-header 在桌面版被 WordPress 主題 CSS 覆蓋導致顯示',
                '全面加強 map-panel / canvas / main-layout 的 CSS !important 防護',
                '新增地圖初始化 debug logging 方便診斷問題',
                '版號升級至 3.1.2 強制清除瀏覽器快取',
            ),
        ),
        array(
            'version' => '3.1.0',
            'date'    => '2026-03-10',
            'changes' => array(
                '多路線劇情系統：NPC 對話與事件可分支為不同故事線',
                '繁榮度系統（ProsperityEngine）：城鎮整體發展指標',
                'NPC 個人故事線（NPCQuestSystem）：每位 NPC 專屬任務鏈，透過好感度解鎖',
                '自訂 NPC 系統（CustomNPCSystem）：玩家可自行建立新 NPC',
                '多結局系統（MultiEndingSystem）：根據玩家選擇達成不同結局',
                '修復 .hidden CSS 類別僅作用於 modal 的問題',
                '修復手機版 header 在桌面版也顯示的 CSS 問題',
                '版號同步：WordPress / Chrome Extension / app.js 統一為 3.1.0',
                '補齊所有 v3 模組在 Chrome Extension 的 enqueue 載入',
            ),
        ),
        array(
            'version' => '3.0.3',
            'date'    => '2026-03-10',
            'changes' => array(
                '側邊欄標籤重新設計：擠壓的單行文字標籤改為 5×2 圖示+文字 grid 佈局',
                '標籤整合：產業+農場合併為一頁（子標籤切換）、工廠整合至經濟頁，總標籤從 10 減至 9',
                '主線任務系統：14 個任務、5 章節線性推進、13 種目標類型、完整 UI 含進度條與獎勵',
                '農場地圖視覺強化：13 種作物專屬色盤、4 階段生長視覺、土壤紋理、水分指示條',
                '農場動畫：成熟作物搖擺+發光脈衝、NPC 農作動畫（鋤地/翻土/澆水/採收）含工具精靈圖與粒子特效',
                '修復 mood 直接修改被每 tick 重算覆蓋（新增 moodModifier 機制）',
                '修復情侶關係事件重複處理（每對只處理一次）',
                '修復餐食消耗不完整（部分存量不被消耗）',
                '修復旅行者歸來丟失技能/記憶/關係',
                '修復選舉記憶存 agentId 而非 name',
                '修復 SeededRandom(0) 產生退化序列',
                '修復農場 sellValue 重複套用品質乘數',
                '修復工廠進度重置丟棄小數部分、不可用工人仍獲得效率加成',
                '修復住院/失蹤天數計算（2天週期但只計1天）',
                '修復 19:00-20:00 窗燈亮度為負值',
                '修復 XSS 漏洞（username 未轉義）',
                '修復 night_owl 成就在遊戲開始時立即解鎖',
                '修復 Chrome Extension manifest.json 版本號未同步（2.4.2→3.0.3）',
                '補齊 Chrome Extension changelog 缺少的 v3.0.0/v3.0.1/v3.0.2 記錄',
                '以上修正同步套用至 WordPress 與 Chrome Extension 版本',
            ),
        ),
        array(
            'version' => '3.0.2',
            'date'    => '2026-03-10',
            'changes' => array(
                '資安強化：Gemini API 金鑰從 URL 參數移至 x-goog-api-key header，防止金鑰洩漏至瀏覽器歷史和 referrer',
                '資安強化：認證端點新增伺服器端速率限制（登入 5次/5分鐘、註冊 5次/5分鐘、重設密碼 3次/10分鐘），防止暴力破解攻擊',
            ),
        ),
        array(
            'version' => '3.0.1',
            'date'    => '2026-03-10',
            'changes' => array(
                '修復全面代碼審查發現的 40+ 個 bug（simulation / app / tilemap / processing / daily-news）',
                '修正 JOB_PRODUCTION 技能鍵從英文改為中文，修復技能完全不影響生產效率的嚴重 bug',
                '修正 Researcher/Mayor 職稱比對從英文改為中文（研究員/鎮長）',
                '修正 toTimeString() 改為 timeStr，修復選舉系統崩潰',
                '修正 agentA.id 改為 agentA.agentId，修復對話記錄 ID 為 undefined',
                '修正選舉 fallbackJobs 中不存在的職業、plain object 改為 new Job() 實例',
                '修正 Festival Day 改為「慶典日」，修復慶典事件永遠不觸發',
                '修正選舉日計算 120→60（配合每年 60 天）',
                '修正 PlayerAgent 無效特質、loadSave 恢復 personality 和 job',
                '修正密碼重設使用不存在的 apiBase/nonce 變數',
                '修正多處 DOM getElementById null 防護',
                '修正 tilemap 道路座標與 generateLayout 一致',
                '修正工廠訂單清理邏輯與生產消耗先驗證再消耗',
                '修正 daily-news LLM 引用名稱',
                '新增 WordPress shortcode 缺少的 4 個側邊欄標籤（產業、農場、工廠、日報）',
                '新增 npc-events handleCheatingDiscovery null 防護，避免第三方已離鎮時崩潰',
            ),
        ),
        array(
            'version' => '3.0.0',
            'date'    => '2026-03-10',
            'changes' => array(
                '四大產業系統：開局四選一（伐木/採石/農業/礦業），Lv1-Lv5 獨立升級，產業協同加成',
                '城鎮等級系統：荒村→小村→村莊→小鎮→城鎮→大城鎮→城市，升級解鎖產業槽位',
                '農場種植系統：翻土→播種→生長→收穫，13 種作物，季節限制，品質系統',
                '工廠加工系統：7 座工廠可建造，配方系統，NPC 員工分配，訂單系統',
                'NPC 關係連鎖事件：打架住院、農田破壞、劈腿被抓，影響產業效率',
                'AI 日報系統：每天自動生成 AI 城鎮報紙，隨機 NPC 記者風格',
                '30+ 種新資源類型，15+ 新成就',
                '地圖渲染農場田地、工廠建築、產業徽章',
            ),
        ),
        array(
            'version' => '2.4.1',
            'date'    => '2026-03-10',
            'changes' => array(
                '更新 v2.4.0 changelog：補齊聊天焦點、登入驗證、存檔同步、版本顯示等 4 項修復記錄',
                'Chrome Extension 新增遊戲標題列版本號顯示（與 WordPress 版一致）',
            ),
        ),
        array(
            'version' => '2.4.0',
            'date'    => '2026-03-10',
            'changes' => array(
                '修復聊天輸入框搶焦點：每次 game tick 不再重設焦點，解決 WASD 移動被中斷的問題',
                '修復登入時 Cookie/nonce 驗證失敗：公開 API 端點不再發送 nonce header',
                '新增遊戲標題列版本號顯示：右上角顯示目前遊戲版本',
                '修復存檔按鈕：按下後同步至雲端並即時更新城鎮列表 UI',
                '修復 AI 回覆顯示分析文字：過濾 LLM 推理/思考過程，只顯示對話內容',
                '修復打字時聊天框失焦問題：輸入中不再重繪側邊欄',
                '改善附近 NPC 聊天：自動切換到同地點的 NPC，不再卡在遠方對象',
                '地圖點擊移動改善：點擊任何地方都會移動到最近的地點，並顯示移動指示圈',
                'NPC 工作行為改善：上班時間待在工作場所或附近，下班後回家或社交場所',
                'NPC 停留時間增加：工作 12-20 ticks、社交 6-10 ticks，減少頻繁走動',
                '新增好友約會系統：好感度高的 NPC 會互相邀約去特定地點（甚至翹班）',
                '地圖擴大為 80x60（原 64x48），建築物重新佈局，空間更寬敞',
                '住宅區升級：每個住宅區有 4 棟房屋（原 2 棟），NPC 的家更明顯',
            ),
        ),
        array(
            'version' => '2.3.8',
            'date'    => '2026-03-09',
            'changes' => array(
                '修復 NPC 移動抖動：新增位置停留機制，NPC 抵達後停留 3-12 ticks 再移動',
                '修復雲端存檔載入：換裝置或清除快取後，優先載入雲端存檔而非重置',
                '雲端同步間隔從 5 分鐘縮短為 2 分鐘',
                '修復 faction_drama（派系風雲）成就缺少觸發條件的問題',
            ),
        ),
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
