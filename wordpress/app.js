// RimTown - Frontend App (WordPress Plugin) v2.0
const ELECTION_POLICIES_LABELS = {economy:'經濟發展',welfare:'社會福利',defense:'軍事防禦',culture:'文化教育',nature:'自然保育',freedom:'個人自由'};

// =====================================================
// Achievement Definitions
// =====================================================
const ACHIEVEMENTS = {
    // Getting started
    first_chat: { name: '初次對話', desc: '第一次與居民聊天', icon: '💬', category: 'social' },
    chat_10: { name: '話癆', desc: '與居民聊天10次', icon: '🗣️', category: 'social' },
    chat_50: { name: '社交達人', desc: '與居民聊天50次', icon: '🎙️', category: 'social' },
    chat_all_npcs: { name: '全民好友', desc: '與每位居民都聊過天', icon: '🤝', category: 'social' },
    // Romance
    first_crush: { name: '心動', desc: '有人對你產生好感', icon: '💗', category: 'romance' },
    first_dating: { name: '初戀', desc: '開始與某人交往', icon: '💕', category: 'romance' },
    first_marriage: { name: '白頭偕老', desc: '與某人結婚', icon: '💍', category: 'romance' },
    heartbreaker: { name: '渣男/渣女', desc: '與3個以上的人交往過', icon: '💔', category: 'romance' },
    // Economy
    first_trade: { name: '商人初體驗', desc: '完成第一筆交易', icon: '💰', category: 'economy' },
    rich: { name: '富甲一方', desc: '銀幣超過500', icon: '🤑', category: 'economy' },
    builder: { name: '建設者', desc: '建造第一棟建築', icon: '🏗️', category: 'economy' },
    master_builder: { name: '建築大師', desc: '建造5棟建築', icon: '🏰', category: 'economy' },
    all_buildings: { name: '鎮之完善', desc: '建造所有建築', icon: '🌆', category: 'economy' },
    first_research: { name: '學者', desc: '完成第一項研究', icon: '📚', category: 'economy' },
    all_research: { name: '科技先驅', desc: '完成所有研究', icon: '🔬', category: 'economy' },
    // Survival
    survive_7: { name: '一週生存', desc: '存活7天', icon: '📅', category: 'survival' },
    survive_30: { name: '月生存者', desc: '存活30天', icon: '🗓️', category: 'survival' },
    survive_100: { name: '百日英雄', desc: '存活100天', icon: '🏆', category: 'survival' },
    survive_year: { name: '週年慶', desc: '存活一整年', icon: '🎉', category: 'survival' },
    repel_raid: { name: '防衛者', desc: '擊退第一次入侵', icon: '⚔️', category: 'survival' },
    repel_10: { name: '鐵壁防線', desc: '擊退10次入侵', icon: '🛡️', category: 'survival' },
    // Population
    pop_15: { name: '小鎮風光', desc: '人口達到15', icon: '🏘️', category: 'town' },
    pop_20: { name: '繁榮市鎮', desc: '人口達到20', icon: '🌇', category: 'town' },
    pop_25: { name: '邊境都市', desc: '人口達到25', icon: '🌃', category: 'town' },
    first_election: { name: '民主初體驗', desc: '參與第一次選舉', icon: '🗳️', category: 'town' },
    elected_mayor: { name: '當選鎮長', desc: '玩家當選鎮長', icon: '👑', category: 'town' },
    // Player interaction
    got_job: { name: '打工仔', desc: '選擇一份工作', icon: '💼', category: 'player' },
    job_master: { name: '職業達人', desc: '做過3種不同工作', icon: '🎯', category: 'player' },
    voted: { name: '公民責任', desc: '在選舉中投票', icon: '✅', category: 'player' },
    proposed: { name: '求婚', desc: '向某人求婚', icon: '💎', category: 'player' },
    // Special
    night_owl: { name: '夜貓子', desc: '在深夜（0-4點）仍在活動', icon: '🦉', category: 'special' },
    gossip_heard: { name: '八卦通', desc: '聽到10則村民對話', icon: '👂', category: 'special' },
    gossip_50: { name: '偷聽大師', desc: '聽到50則村民對話', icon: '🕵️', category: 'special' },
    all_seasons: { name: '四季輪轉', desc: '經歷春夏秋冬', icon: '🌸', category: 'special' },
    multi_town: { name: '開拓者', desc: '擁有3個以上城鎮', icon: '🗺️', category: 'special' },
    // Factions
    first_faction: { name: '結黨', desc: '加入第一個社交圈', icon: '👥', category: 'social' },
    faction_drama: { name: '戲劇性', desc: '見證派系衝突', icon: '🎭', category: 'social' },
    // Festivals
    first_festival: { name: '節慶參與', desc: '經歷第一個節日', icon: '🎉', category: 'special' },
    all_festivals: { name: '四季慶典', desc: '經歷所有四個節日', icon: '🎊', category: 'special' },
    // Life cycle
    first_birth: { name: '新生命', desc: '城鎮迎來第一個新生兒', icon: '👶', category: 'town' },
    first_death: { name: '永別', desc: '失去第一位居民', icon: '⚰️', category: 'town' },
    // Exploration
    first_explore: { name: '探險家', desc: '發現第一個探索區域', icon: '🗺️', category: 'survival' },
    expedition_success: { name: '凱旋歸來', desc: '完成第一次成功探險', icon: '🏆', category: 'survival' },
};

// =====================================================
// Cloud Auth Client
// =====================================================
class RimTownAuth {
    constructor() {
        this.loggedIn = false;
        this.username = '';
        this.userId = 0;
        this._restUrl = '';
        this._nonce = '';
        this._initFromWP();
    }

    _initFromWP() {
        if (typeof rimtownAuth !== 'undefined') {
            this._restUrl = rimtownAuth.restUrl;
            this._nonce = rimtownAuth.nonce;
            this.loggedIn = !!rimtownAuth.loggedIn;
            this.username = rimtownAuth.username || '';
            this.userId = rimtownAuth.userId || 0;
        }
    }

    async _fetch(endpoint, method = 'GET', body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this._nonce },
            credentials: 'same-origin',
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(this._restUrl + endpoint, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.code || 'API error');
        return data;
    }

    async register(username, password, email) {
        const data = await this._fetch('register', 'POST', { username, password, email });
        this.loggedIn = true;
        this.username = data.user.username;
        this.userId = data.user.id;
        return data;
    }

    async login(username, password) {
        const data = await this._fetch('login', 'POST', { username, password });
        this.loggedIn = true;
        this.username = data.user.username;
        this.userId = data.user.id;
        return data;
    }

    async logout() {
        await this._fetch('logout', 'POST');
        this.loggedIn = false;
        this.username = '';
        this.userId = 0;
    }

    async checkLogin() {
        const data = await this._fetch('me');
        this.loggedIn = data.logged_in;
        this.username = data.user?.username || '';
        this.userId = data.user?.id || 0;
        return data;
    }

    // Cloud save operations
    async listSaves() {
        const data = await this._fetch('saves');
        return data.saves || [];
    }

    async cloudSave(townId, townName, saveData, meta) {
        return this._fetch('save', 'POST', {
            town_id: townId,
            town_name: townName,
            save_data: typeof saveData === 'string' ? saveData : JSON.stringify(saveData),
            season: meta.season || '',
            year: meta.year || 1,
            day: meta.day || 1,
            population: meta.population || 0,
        });
    }

    async cloudLoad(townId) {
        const data = await this._fetch('save/' + townId);
        return typeof data.save_data === 'string' ? JSON.parse(data.save_data) : data.save_data;
    }

    async cloudDelete(townId) {
        return this._fetch('save/' + townId, 'DELETE');
    }

    // Achievements
    async getAchievements() {
        const data = await this._fetch('achievements');
        return data.achievements || [];
    }

    async unlockAchievement(key, townId) {
        return this._fetch('achievements', 'POST', { key, town_id: townId });
    }
}

class RimTownApp {
    constructor() {
        this.world = new World();
        this.state = null;
        this.selectedAgent = null;
        this.activeTab = 'residents';
        this.chatTarget = null;
        this.chatSending = false;
        this.agentColors = {};
        this.colorPalette = [
            '#e94560','#4ade80','#60a5fa','#fbbf24','#a78bfa',
            '#f472b6','#34d399','#38bdf8','#fb923c','#c084fc',
            '#22d3ee','#f87171',
        ];
        this.simInterval = null;
        this.simSpeed = 2000;
        this.llmClient = null;
        this.tileMap = null;
        this._mapGenerated = false;
        this._viewingArchive = null;
        this.currentTownId = null;
        // v2.0 — Auth + Achievements
        this.auth = new RimTownAuth();
        this._unlockedAchievements = new Set();
        this._achievementQueue = []; // Toast queue
        this._chatCount = 0;
        this._chattedNpcs = new Set();
        this._raidCount = 0;
        this._seasonsVisited = new Set();
        this._npcConvosSeen = 0;
        this._playerJobHistory = new Set();
        this._tradeCount = 0;
        this._datingHistory = new Set();
        this.init();
    }

    async init() {
        this.setupEventDelegation();
        await this.loadSettings();
        // Try to load saved game
        const lastTownId = localStorage.getItem('rimtown_last_town');
        let loaded = false;
        if (lastTownId) {
            loaded = this._loadTownById(lastTownId);
        }
        if (!loaded) {
            const legacyLoaded = await this.tryLoadGame();
            if (legacyLoaded) {
                this.currentTownId = this._generateTownId('邊境鎮');
                this._saveCurrentTown('邊境鎮');
            } else {
                this.world.reset();
                this.currentTownId = this._generateTownId('邊境鎮');
                this._saveCurrentTown('邊境鎮');
            }
        }
        if (this.llmClient) {
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
            console.log('[RimTown] ConversationEngine initialized with LLM:', this.llmClient.provider);
        } else {
            console.log('[RimTown] WARNING: No LLM client — conversations will use fallback templates');
        }
        this._hookConversationBubbles();
        this._updateLLMStatus();
        this.state = this.world.getState();
        this.setupTileMap();
        this.setupTabListeners();
        this.setupMobileSidebar();
        this.setupMobileHeader();
        this.setupControlListeners();
        this.setupSettingsListeners();
        this.setupAuthListeners();
        this._updateAccountButton();
        this._loadAchievementsFromCloud();
        // Auto-sync from cloud on startup if already logged in
        if (this.auth.loggedIn) {
            this._syncFromCloud();
        }
        this.startSimulation();
        this.setupAutoSave();
        this.render();
        this._startRenderLoop();
        this._startAchievementChecker();
    }

    // =====================================================
    // AUTH SYSTEM
    // =====================================================
    setupAuthListeners() {
        const accountBtn = document.getElementById('btn-account');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => {
                if (this.auth.loggedIn) {
                    this._showAccountMenu();
                } else {
                    document.getElementById('auth-modal')?.classList.remove('hidden');
                }
            });
        }

        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.authTab === 'login';
                document.getElementById('auth-login-form')?.classList.toggle('hidden', !isLogin);
                document.getElementById('auth-register-form')?.classList.toggle('hidden', isLogin);
                document.getElementById('auth-reset-form')?.classList.add('hidden');
            });
        });

        // Close buttons
        document.querySelectorAll('.auth-close-btn').forEach(btn => {
            btn.addEventListener('click', () => document.getElementById('auth-modal')?.classList.add('hidden'));
        });

        // Login
        document.getElementById('auth-login-btn')?.addEventListener('click', () => this._doLogin());
        document.getElementById('auth-login-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doLogin(); });

        // Register
        document.getElementById('auth-reg-btn')?.addEventListener('click', () => this._doRegister());
        document.getElementById('auth-reg-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doRegister(); });

        // Forgot password
        document.getElementById('auth-forgot-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('auth-login-form')?.classList.add('hidden');
            document.getElementById('auth-register-form')?.classList.add('hidden');
            document.getElementById('auth-reset-form')?.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        });
        document.getElementById('auth-reset-back')?.addEventListener('click', () => {
            document.getElementById('auth-reset-form')?.classList.add('hidden');
            document.getElementById('auth-login-form')?.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.authTab === 'login');
            });
        });
        document.getElementById('auth-reset-btn')?.addEventListener('click', () => this._doResetPassword());
        document.getElementById('auth-reset-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doResetPassword(); });
    }

    async _doLogin() {
        const user = document.getElementById('auth-login-user')?.value?.trim();
        const pass = document.getElementById('auth-login-pass')?.value;
        const errEl = document.getElementById('auth-login-error');
        if (!user || !pass) { if (errEl) errEl.textContent = '請輸入帳號和密碼'; return; }
        try {
            if (errEl) errEl.textContent = '登入中...';
            await this.auth.login(user, pass);
            document.getElementById('auth-modal')?.classList.add('hidden');
            this._updateAccountButton();
            this.world.logMessage('system', `歡迎回來，${this.auth.username}！`);
            this._syncFromCloud();
        } catch (e) {
            if (errEl) errEl.textContent = e.message || '登入失敗';
        }
    }

    async _doRegister() {
        const user = document.getElementById('auth-reg-user')?.value?.trim();
        const email = document.getElementById('auth-reg-email')?.value?.trim();
        const pass = document.getElementById('auth-reg-pass')?.value;
        const pass2 = document.getElementById('auth-reg-pass2')?.value;
        const errEl = document.getElementById('auth-reg-error');
        if (!user || !pass) { if (errEl) errEl.textContent = '請填寫帳號和密碼'; return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = '兩次密碼不一致'; return; }
        try {
            if (errEl) errEl.textContent = '註冊中...';
            await this.auth.register(user, pass, email);
            document.getElementById('auth-modal')?.classList.add('hidden');
            this._updateAccountButton();
            // New user gets a fresh world — clear all old local data
            const oldTowns = this._getTownList();
            oldTowns.forEach(t => {
                localStorage.removeItem('rimtown_town_' + t.id);
                localStorage.removeItem('rimtown_town_' + t.id + '_archives');
            });
            localStorage.removeItem('rimtown_town_list');
            localStorage.removeItem('rimtown_last_town');
            localStorage.removeItem('rimtown_achievements');
            localStorage.removeItem('rimtown_raid_count');
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
            const townName = `${user}的邊境鎮`;
            this.currentTownId = this._generateTownId(townName);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            if (this.tileMap) this.tileMap.agentPositions = {};
            this._saveCurrentTown(townName);
            this.render();
            this._renderTownList();
            this.world.logMessage('system', `註冊成功！歡迎，${this.auth.username}！你的全新城鎮已建立。`);
            this._syncToCloud();
        } catch (e) {
            if (errEl) errEl.textContent = e.message || '註冊失敗';
        }
    }

    async _doResetPassword() {
        const user = document.getElementById('auth-reset-user')?.value?.trim();
        const email = document.getElementById('auth-reset-email')?.value?.trim();
        const pass = document.getElementById('auth-reset-pass')?.value;
        const pass2 = document.getElementById('auth-reset-pass2')?.value;
        const errEl = document.getElementById('auth-reset-error');
        const successEl = document.getElementById('auth-reset-success');
        if (errEl) errEl.textContent = '';
        if (successEl) successEl.textContent = '';
        if (!user) { if (errEl) errEl.textContent = '請輸入使用者名稱'; return; }
        if (!email) { if (errEl) errEl.textContent = '請輸入註冊時的電子郵件'; return; }
        if (!pass || pass.length < 6) { if (errEl) errEl.textContent = '新密碼至少6個字元'; return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = '兩次密碼不一致'; return; }
        try {
            if (errEl) errEl.textContent = '重設中...';
            const resp = await fetch(`${this.auth.apiBase}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.auth.nonce },
                body: JSON.stringify({ username: user, email, new_password: pass }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || '重設失敗');
            if (errEl) errEl.textContent = '';
            if (successEl) successEl.textContent = '密碼已重設！請用新密碼登入';
            setTimeout(() => {
                document.getElementById('auth-reset-form')?.classList.add('hidden');
                document.getElementById('auth-login-form')?.classList.remove('hidden');
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.authTab === 'login'));
                if (successEl) successEl.textContent = '';
            }, 2000);
        } catch (e) {
            if (errEl) errEl.textContent = e.message || '重設失敗';
        }
    }

    _showAccountMenu() {
        const existing = document.getElementById('account-menu-popup');
        if (existing) { existing.remove(); return; }

        const popup = document.createElement('div');
        popup.id = 'account-menu-popup';
        popup.className = 'account-menu-popup';
        popup.innerHTML = `
            <div class="account-menu-header">${this.auth.username}</div>
            <button data-action="cloud-sync-up">上傳存檔到雲端</button>
            <button data-action="cloud-sync-down">從雲端下載存檔</button>
            <button data-action="show-achievements">成就</button>
            <button data-action="auth-logout" class="btn-danger-text">登出</button>
        `;
        document.getElementById('rimtown-app')?.appendChild(popup);

        // Auto close on click outside
        setTimeout(() => {
            const handler = (e) => {
                if (!popup.contains(e.target) && e.target.id !== 'btn-account') {
                    popup.remove();
                    document.removeEventListener('click', handler);
                }
            };
            document.addEventListener('click', handler);
        }, 10);
    }

    _updateAccountButton() {
        const btn = document.getElementById('btn-account');
        if (!btn) return;
        if (this.auth.loggedIn) {
            btn.textContent = this.auth.username;
            btn.className = 'btn-account logged-in';
        } else {
            btn.textContent = '帳號';
            btn.className = 'btn-account';
        }
    }

    async _syncToCloud() {
        if (!this.auth.loggedIn) return;
        try {
            this._saveCurrentTown();
            const saveData = this.world.serialize();
            const clock = saveData.clock || {};
            await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                season: clock.season, year: clock.year, day: clock.day,
                population: Object.keys(saveData.agents || {}).length,
            });
            this.world.logMessage('system', '已同步至雲端。');
        } catch (e) {
            console.error('[RimTown] Cloud sync error:', e);
        }
    }

    async _syncFromCloud() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (saves.length === 0) {
                // No cloud data — upload current local data
                await this._syncToCloud();
                return;
            }
            this._cloudSaves = saves;

            // Find the cloud save matching current town_id, or the most recent one
            let cloudMatch = saves.find(s => s.town_id === this.currentTownId);
            if (!cloudMatch) cloudMatch = saves[0]; // saves are sorted by updated_at DESC

            // Compare timestamps: load from cloud if it's newer than local
            const localTown = this._getTownList().find(t => t.id === this.currentTownId);
            const localTime = localTown?.savedAt ? new Date(localTown.savedAt).getTime() : 0;
            const cloudTime = cloudMatch.updated_at ? new Date(cloudMatch.updated_at).getTime() : 0;

            if (cloudTime > localTime) {
                // Cloud is newer — auto-load it
                const saveData = await this.auth.cloudLoad(cloudMatch.town_id);
                if (this.world.loadSave(saveData)) {
                    if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                    this.currentTownId = cloudMatch.town_id;
                    this._saveCurrentTown(cloudMatch.town_name);
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    this.tileMap.agentPositions = {};
                    this.render();
                    this.world.logMessage('system', `已從雲端同步最新存檔（${cloudMatch.town_name}）。`);
                }
            } else {
                this.world.logMessage('system', `雲端有 ${saves.length} 個城鎮存檔（本地已是最新）。`);
            }
        } catch (e) {
            console.error('[RimTown] Cloud load error:', e);
        }
    }

    _getCurrentTownName() {
        const list = this._getTownList();
        const town = list.find(t => t.id === this.currentTownId);
        return town?.name || '邊境鎮';
    }

    // =====================================================
    // ACHIEVEMENT SYSTEM
    // =====================================================
    async _loadAchievementsFromCloud() {
        // Load from localStorage first
        try {
            const local = JSON.parse(localStorage.getItem('rimtown_achievements') || '[]');
            local.forEach(k => this._unlockedAchievements.add(k));
        } catch (e) {}

        // Load from cloud if logged in
        if (this.auth.loggedIn) {
            try {
                const cloudAch = await this.auth.getAchievements();
                cloudAch.forEach(a => this._unlockedAchievements.add(a.achievement_key));
            } catch (e) {}
        }
    }

    _unlockAchievement(key) {
        if (this._unlockedAchievements.has(key)) return;
        const def = ACHIEVEMENTS[key];
        if (!def) return;
        this._unlockedAchievements.add(key);

        // Save locally
        localStorage.setItem('rimtown_achievements', JSON.stringify([...this._unlockedAchievements]));

        // Save to cloud
        if (this.auth.loggedIn) {
            this.auth.unlockAchievement(key, this.currentTownId).catch(() => {});
        }

        // Show toast
        this._showAchievementToast(def);
        this.world.logMessage('system', `成就解鎖：${def.icon} ${def.name}`);
    }

    _showAchievementToast(def) {
        const toast = document.getElementById('achievement-toast');
        if (!toast) return;
        toast.innerHTML = `<div class="ach-toast-icon">${def.icon}</div><div class="ach-toast-info"><div class="ach-toast-title">成就解鎖！</div><div class="ach-toast-name">${def.name}</div><div class="ach-toast-desc">${def.desc}</div></div>`;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); toast.classList.add('hidden'); }, 4000);
    }

    _startAchievementChecker() {
        // Check achievements every 5 seconds
        setInterval(() => this._checkAchievements(), 5000);
    }

    _checkAchievements() {
        if (!this.state) return;
        const agents = this.state.agents || {};
        const player = agents['player'];
        if (!player) return;
        const clock = this.state.clock || {};
        const chatHistory = player.chat_history || [];
        const totalDays = ((clock.year || 1) - 1) * 60 + (clock.day || 1);

        // Chat achievements
        if (chatHistory.length >= 2) this._unlockAchievement('first_chat');
        if (chatHistory.length >= 20) this._unlockAchievement('chat_10');
        if (chatHistory.length >= 100) this._unlockAchievement('chat_50');

        // Track chatted NPCs
        const chattedNpcs = new Set();
        chatHistory.forEach(m => {
            if (m.speaker !== player.name) chattedNpcs.add(m.speaker);
            if (m.target !== player.name) chattedNpcs.add(m.target);
        });
        const totalNpcs = Object.keys(agents).filter(id => id !== 'player').length;
        if (chattedNpcs.size >= totalNpcs && totalNpcs >= 5) this._unlockAchievement('chat_all_npcs');

        // Survival
        if (totalDays >= 7) this._unlockAchievement('survive_7');
        if (totalDays >= 30) this._unlockAchievement('survive_30');
        if (totalDays >= 100) this._unlockAchievement('survive_100');
        if ((clock.year || 1) >= 2) this._unlockAchievement('survive_year');

        // Population
        const pop = Object.keys(agents).length;
        if (pop >= 15) this._unlockAchievement('pop_15');
        if (pop >= 20) this._unlockAchievement('pop_20');
        if (pop >= 25) this._unlockAchievement('pop_25');

        // Economy
        const res = this.state.stockpile?.resources || {};
        if ((res.silver || 0) >= 500) this._unlockAchievement('rich');
        const completedBuildings = this.state.buildings?.completed || [];
        if (completedBuildings.length >= 1) this._unlockAchievement('builder');
        if (completedBuildings.length >= 5) this._unlockAchievement('master_builder');
        const availBuildings = this.world.buildings?.getAvailable?.(this.world) || [];
        if (completedBuildings.length > 0 && availBuildings.length === 0) this._unlockAchievement('all_buildings');
        const researchProjects = this.state.research?.projects || {};
        const completedResearch = Object.values(researchProjects).filter(p => p.status === 'complete');
        if (completedResearch.length >= 1) this._unlockAchievement('first_research');
        const allResearch = Object.values(researchProjects);
        if (allResearch.length > 0 && completedResearch.length === allResearch.length) this._unlockAchievement('all_research');

        // Seasons
        if (clock.season) this._seasonsVisited.add(clock.season);
        if (this._seasonsVisited.size >= 4) this._unlockAchievement('all_seasons');

        // Night owl
        if (clock.hour !== undefined && (clock.hour >= 0 && clock.hour < 4)) this._unlockAchievement('night_owl');

        // Election
        const election = this.state.election;
        if (election?.electionHistory?.length >= 1) this._unlockAchievement('first_election');

        // Multi-town
        if (this._getTownList().length >= 3) this._unlockAchievement('multi_town');

        // NPC conversations seen (from log)
        const npcConvos = this.state.npc_conversations || [];
        this._npcConvosSeen = Math.max(this._npcConvosSeen, npcConvos.length);
        if (this._npcConvosSeen >= 10) this._unlockAchievement('gossip_heard');
        if (this._npcConvosSeen >= 50) this._unlockAchievement('gossip_50');

        // Player relationships
        const playerRels = player.relationships || [];
        playerRels.forEach(r => {
            if (r.romantic_interest > 30) this._unlockAchievement('first_crush');
            if (r.status === 'dating') { this._unlockAchievement('first_dating'); this._datingHistory.add(r.target_name); }
            if (r.status === 'married') this._unlockAchievement('first_marriage');
        });
        if (this._datingHistory.size >= 3) this._unlockAchievement('heartbreaker');

        // Player job
        if (player.job?.title && player.job.title !== '無業') {
            this._unlockAchievement('got_job');
            this._playerJobHistory.add(player.job.title);
        }
        if (this._playerJobHistory.size >= 3) this._unlockAchievement('job_master');

        // Raid repel
        const raidEvents = (this.state.recent_events || []).filter(e => e.event_type === 'raid');
        if (raidEvents.length >= 1) this._unlockAchievement('repel_raid');
        // Track cumulative raids across sessions
        const raidCount = parseInt(localStorage.getItem('rimtown_raid_count') || '0');
        const currentRaids = raidEvents.length;
        if (currentRaids > this._raidCount) {
            const newRaids = currentRaids - this._raidCount;
            const totalRaids = raidCount + newRaids;
            localStorage.setItem('rimtown_raid_count', totalRaids.toString());
            if (totalRaids >= 10) this._unlockAchievement('repel_10');
            this._raidCount = currentRaids;
        }

        // New system achievements
        const factionList = Object.values(this.state.factions?.factions || {});
        if (factionList.length >= 1) this._unlockAchievement('first_faction');
        if ((this.state.lifecycle?.graveyard || []).length >= 1) this._unlockAchievement('first_death');
        if ((this.state.lifecycle?.births || []).length >= 1) this._unlockAchievement('first_birth');
        const festLog = this.state.festivals?.festivalLog || [];
        if (festLog.length >= 1) this._unlockAchievement('first_festival');
        const festSeasons = new Set(festLog.map(f => f.season));
        if (festSeasons.size >= 4) this._unlockAchievement('all_festivals');
        const discoveredZones = Object.keys(this.state.exploration?.discoveredZones || {});
        if (discoveredZones.length >= 1) this._unlockAchievement('first_explore');
        const successExpeditions = (this.state.exploration?.expeditionLog || []).filter(e => e.success);
        if (successExpeditions.length >= 1) this._unlockAchievement('expedition_success');
    }

    // Hook conversation engine to push speech bubbles to tilemap
    _hookConversationBubbles() {
        // Set up a periodic check since ConversationEngine may be re-created
        setInterval(() => {
            if (this.world.conversationEngine && !this.world.conversationEngine._bubbleHooked) {
                this.world.conversationEngine._bubbleHooked = true;
                this.world.conversationEngine.onConversation = (aId, bId, aName, bName, textA, textB) => {
                    if (this.tileMap) {
                        this.tileMap.addConversationBubble(aId, bId, aName, bName, textA, textB);
                    }
                };
            }
        }, 2000);
    }

    // === Auth Actions ===
    async _doLogout() {
        try {
            await this.auth.logout();
            this._updateAccountButton();
            this.world.logMessage('system', '已登出。');
        } catch(e) { console.error(e); }
    }

    async _showCloudSaves() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (!saves.length) {
                alert('雲端沒有存檔。請先上傳存檔。');
                return;
            }
            // Show in town modal
            const modal = document.getElementById('town-modal');
            const container = document.getElementById('town-list-content');
            if (!modal || !container) return;
            modal.classList.remove('hidden');
            let html = '<h3 style="margin-bottom:8px">雲端存檔</h3>';
            saves.forEach(s => {
                const date = new Date(s.updated_at).toLocaleString();
                html += `<div class="town-item">
                    <div class="town-info" data-action="load-cloud-save" data-val="${s.town_id}">
                        <div class="town-name">☁️ ${s.town_name}</div>
                        <div class="town-meta">${s.season} 第${s.year}年 第${s.day}天 | 人口${s.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="delete-cloud-save" data-val="${s.town_id}" class="btn-danger" title="刪除雲端存檔">🗑️</button>
                    </div>
                </div>`;
            });
            html += '<div style="margin-top:12px"><button data-action="close-town-modal">關閉</button></div>';
            container.innerHTML = html;
        } catch(e) { alert('載入雲端存檔失敗：' + e.message); }
    }

    async _loadCloudSave(townId) {
        try {
            const saveData = await this.auth.cloudLoad(townId);
            if (this.world.loadSave(saveData)) {
                if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                this.currentTownId = townId;
                this._saveCurrentTown();
                this.state = this.world.getState();
                this._generateTileMapLayout();
                this.tileMap.agentPositions = {};
                this.render();
                this.world.logMessage('system', '已從雲端載入存檔。');
            }
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = false;
        } catch(e) { alert('載入失敗：' + e.message); }
    }

    async _deleteCloudSave(townId) {
        if (!confirm('確定刪除雲端存檔？')) return;
        try {
            await this.auth.cloudDelete(townId);
            this._showCloudSaves(); // Refresh list
        } catch(e) { alert('刪除失敗：' + e.message); }
    }

    // === Achievements Tab ===
    _showAchievementsTab() {
        this.activeTab = 'achievements';
        document.querySelectorAll('.rt-sidebar-tabs button').forEach(b => b.classList.remove('active'));
        this.renderSidebar();
    }

    renderAchievements(container) {
        const categories = { social: '社交', romance: '愛情', economy: '經濟', survival: '生存', town: '城鎮', player: '玩家', special: '特殊' };
        let html = '<div class="achievements-panel"><h3>成就 <span class="ach-count">' +
            this._unlockedAchievements.size + '/' + Object.keys(ACHIEVEMENTS).length + '</span></h3>';

        for (const [catKey, catName] of Object.entries(categories)) {
            const achs = Object.entries(ACHIEVEMENTS).filter(([,a]) => a.category === catKey);
            if (!achs.length) continue;
            html += `<div class="ach-category"><h4>${catName}</h4><div class="ach-grid">`;
            achs.forEach(([key, def]) => {
                const unlocked = this._unlockedAchievements.has(key);
                html += `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
                    <span class="ach-icon">${unlocked ? def.icon : '🔒'}</span>
                    <div class="ach-info"><div class="ach-name">${unlocked ? def.name : '???'}</div>
                    <div class="ach-desc">${unlocked ? def.desc : '尚未解鎖'}</div></div></div>`;
            });
            html += '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    // === Player Deep Interaction ===
    _renderPlayerJobPanel(player) {
        const currentJob = player.job?.title || '無業';
        // Get jobs from JOB_DEFINITIONS (global from simulation.js), excluding mayor
        let JOBS;
        if (typeof JOB_DEFINITIONS !== 'undefined') {
            JOBS = {};
            for (const [k, v] of Object.entries(JOB_DEFINITIONS)) {
                if (k !== 'mayor') JOBS[k] = v.title;
            }
        } else {
            JOBS = { farmer:'農夫', miner:'礦工', cook:'廚師', blacksmith:'鐵匠', doctor:'醫生', researcher:'研究員', trader:'商人', guard:'守衛', carpenter:'木匠', tailor:'裁縫', priest:'牧師' };
        }
        let html = '<div class="detail-section"><h3>你的工作</h3>';
        html += `<p style="font-size:0.8rem;margin-bottom:8px">目前職業：<strong>${currentJob}</strong></p>`;
        if (player.job?.key && player.job.key !== 'none') {
            html += `<button class="btn-quit-job" data-action="player-quit-job">辭職</button>`;
        }
        html += '<div class="job-grid">';
        for (const [key, title] of Object.entries(JOBS)) {
            const isActive = player.job?.key === key;
            html += `<button class="job-btn ${isActive ? 'active' : ''}" data-action="player-choose-job" data-val="${key}" ${isActive ? 'disabled' : ''}>${title}</button>`;
        }
        html += '</div></div>';
        return html;
    }

    _playerChooseJob(jobKey) {
        const player = this.world.agents['player'];
        if (!player) return;
        // Use the Job class from simulation.js (available globally)
        try {
            player.job = new Job(jobKey);
            this.world.logMessage('player_action', `你選擇了${player.job.title}的工作。`, player.name);
        } catch(e) {
            // Fallback if Job class not available
            player.job = { key: jobKey, title: jobKey, workplace: jobKey, workHours: [8,17] };
            this.world.logMessage('player_action', `你選擇了${jobKey}的工作。`, player.name);
        }
        this._unlockAchievement('got_job');
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerQuitJob() {
        const player = this.world.agents['player'];
        if (!player) return;
        const oldJob = player.job?.title || '無業';
        player.job = null;
        this.world.logMessage('player_action', `你辭去了${oldJob}的工作。`, player.name);
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerVote(candidateId) {
        const election = this.world.election;
        if (!election || !election.active || election.phase !== 'voting') return;
        const candidate = election.candidates?.find(c => c.agentId === candidateId);
        if (!candidate) return;
        // Check if player already voted
        if (election._playerVoted) {
            this.world.logMessage('system', '你已經投過票了。');
            return;
        }
        candidate.votes = (candidate.votes || 0) + 1;
        election._playerVoted = true;
        this._unlockAchievement('voted');
        this.world.logMessage('player_action', `你投票給了 ${candidate.name}。`, 'player');
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerFlirt(targetId) {
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) return;
        if (player.currentLocation !== npc.currentLocation) {
            this.world.logMessage('system', '你需要在對方身邊才能調情。');
            return;
        }
        // Increase romantic interest based on charisma
        const rel = player.relationships?.get?.(targetId) || player.getRelationship?.(targetId);
        if (rel) {
            const boost = 5 + Math.floor(Math.random() * 10);
            rel.modifyRomantic(boost);
            rel.modifyAffinity(2);
            const npcRel = npc.relationships?.get?.('player') || npc.getRelationship?.('player');
            if (npcRel) {
                // NPC may or may not reciprocate
                const npcBoost = Math.floor(Math.random() * 8) + (npc.personality?.traits?.includes('romantic') ? 5 : 0);
                npcRel.modifyRomantic(npcBoost);
                npcRel.modifyAffinity(1);
            }
            this.world.logMessage('player_action', `你對${npc.name}調情。`, player.name, npc.name);
            player.memory?.add?.(this.world.tickCount, this.world.clock.timeStr, 'social', `對${npc.name}調情`, 3, [npc.name]);
        }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerPropose(targetId) {
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) return;
        const rel = player.relationships?.get?.(targetId) || player.getRelationship?.(targetId);
        const npcRel = npc.relationships?.get?.('player') || npc.getRelationship?.('player');
        if (!rel || !npcRel) {
            this.world.logMessage('system', '你跟這個人不夠熟。');
            return;
        }
        this._unlockAchievement('proposed');
        // Check if NPC accepts (based on affinity and romantic interest)
        const accept = npcRel.affinity > 30 && npcRel.romantic > 20 && Math.random() < 0.7;
        if (accept) {
            // Start dating or upgrade to marriage
            if (rel.status === 'dating') {
                rel.status = 'married';
                if (npcRel) npcRel.status = 'married';
                this.world.logMessage('event', `${player.name}與${npc.name}結婚了！`, player.name, npc.name);
                this._unlockAchievement('first_marriage');
            } else {
                rel.status = 'dating';
                if (npcRel) npcRel.status = 'dating';
                this.world.logMessage('event', `${player.name}與${npc.name}開始交往！`, player.name, npc.name);
                this._unlockAchievement('first_dating');
            }
        } else {
            this.world.logMessage('event', `${npc.name}拒絕了你的告白。`, player.name, npc.name);
        }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    // === Town Management ===
    _getTownList() {
        try { return JSON.parse(localStorage.getItem('rimtown_town_list') || '[]'); } catch(e) { return []; }
    }
    _saveTownList(list) {
        localStorage.setItem('rimtown_town_list', JSON.stringify(list));
    }
    _loadTownById(townId) {
        try {
            const json = localStorage.getItem('rimtown_town_' + townId);
            if (!json) return false;
            const loaded = this.world.loadSave(JSON.parse(json));
            if (loaded) {
                this.currentTownId = townId;
                localStorage.setItem('rimtown_last_town', townId);
            }
            return loaded;
        } catch(e) { return false; }
    }
    _saveCurrentTown(name) {
        if (!this.currentTownId) this.currentTownId = 'town_' + Date.now();
        const saveData = this.world.serialize();
        const clock = saveData.clock || {};
        const list = this._getTownList();
        const existing = list.find(t => t.id === this.currentTownId);
        const meta = {
            id: this.currentTownId,
            name: existing?.name || name || '邊境鎮',
            savedAt: new Date().toISOString(),
            season: clock.season || '春季',
            year: clock.year || 1,
            day: clock.day || 1,
            population: Object.keys(saveData.agents || {}).length,
        };
        if (existing) Object.assign(existing, meta);
        else list.push(meta);
        this._saveTownList(list);
        localStorage.setItem('rimtown_town_' + this.currentTownId, JSON.stringify(saveData));
        localStorage.setItem('rimtown_last_town', this.currentTownId);
    }
    showTownManager() {
        this.world.paused = true;
        const modal = document.getElementById('town-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this._renderTownList();
    }
    _renderTownList() {
        const container = document.getElementById('town-list-content');
        if (!container) return;
        const towns = this._getTownList();
        let html = '';
        if (!towns.length) {
            html = '<p class="muted-text">尚無城鎮存檔。</p>';
        } else {
            towns.forEach(t => {
                const isActive = t.id === this.currentTownId;
                const date = new Date(t.savedAt).toLocaleString();
                html += `<div class="town-item ${isActive?'active':''}">
                    <div class="town-info" data-action="switch-town" data-val="${t.id}">
                        <div class="town-name">${t.name} ${isActive?'<span class="current-badge">目前</span>':''}</div>
                        <div class="town-meta">${t.season} 第${t.year}年 第${t.day}天 | 人口${t.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="rename-town" data-val="${t.id}" title="重新命名">✏️</button>
                        ${!isActive?`<button data-action="delete-town" data-val="${t.id}" title="刪除" class="btn-danger">🗑️</button>`:''}
                    </div>
                </div>`;
            });
        }
        html += `<div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn-accent" data-action="create-town">新建城鎮</button>
            <button data-action="close-town-modal">關閉</button>
        </div>`;
        container.innerHTML = html;
    }
    async switchTown(townId) {
        if (townId === this.currentTownId) {
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = false;
            return;
        }
        this._saveCurrentTown();
        if (this._loadTownById(townId)) {
            if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            this.tileMap.agentPositions = {};
            this.render();
        }
        document.getElementById('town-modal')?.classList.add('hidden');
        this.world.paused = false;
    }
    _generateTownId(name) {
        // Generate stable town_id based on user_id + town name for cross-device sync
        if (this.auth.loggedIn && this.auth.userId) {
            // Simple hash from the name
            let hash = 0;
            const str = name || '';
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            let baseId = 'town_u' + this.auth.userId + '_' + Math.abs(hash).toString(36);
            // If this ID already exists locally (same-name town), add suffix
            const existing = this._getTownList();
            let id = baseId;
            let suffix = 2;
            while (existing.some(t => t.id === id)) {
                id = baseId + '_' + suffix;
                suffix++;
            }
            return id;
        }
        return 'town_' + Date.now();
    }
    createNewTown() {
        const name = prompt('為新城鎮命名：', '邊境鎮 ' + (this._getTownList().length + 1));
        if (!name) return;
        if (this.currentTownId) this._saveCurrentTown();
        this.world.reset();
        if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
        this.currentTownId = this._generateTownId(name);
        this._saveCurrentTown(name);
        this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
        this.state = this.world.getState();
        this._generateTileMapLayout();
        this.tileMap.agentPositions = {};
        this.render();
        this._renderTownList();
    }
    renameTownPrompt(townId) {
        const towns = this._getTownList();
        const town = towns.find(t => t.id === townId);
        if (!town) return;
        const newName = prompt('新名稱：', town.name);
        if (newName && newName.trim()) {
            town.name = newName.trim();
            this._saveTownList(towns);
            this._renderTownList();
        }
    }
    deleteTownConfirm(townId) {
        if (!confirm('確定要刪除這個城鎮？所有存檔和聊天記錄都會消失。')) return;
        const list = this._getTownList().filter(t => t.id !== townId);
        this._saveTownList(list);
        localStorage.removeItem('rimtown_town_' + townId);
        localStorage.removeItem('rimtown_town_' + townId + '_archives');
        this._renderTownList();
    }

    setupTileMap() {
        const canvas = document.getElementById('town-map-canvas');
        this.tileMap = new PixelTileMap(canvas);
        this.tileMap.onClick = (locId) => this.playerMoveTo(locId);
        this.tileMap.onAgentClick = (agentId) => this.onAgentClick(agentId);
        this._generateTileMapLayout();
    }

    _generateTileMapLayout() {
        const locations = this.state.locations?.locations || {};
        this.tileMap.generateLayout(locations);
        this._mapGenerated = true;
    }

    _startRenderLoop() {
        const loop = () => {
            if (this.tileMap && this._mapGenerated) {
                const agents = this.state?.agents || {};
                const player = agents['player'];
                this.tileMap.updateAgents(agents, this.state.locations?.locations || {}, this.chatTarget);
                // Pass time to tilemap for day/night cycle
                if (this.state.clock) {
                    this.tileMap.timeHour = this.state.clock.hour ?? 12;
                    this.tileMap.timeMinute = this.state.clock.minute ?? 0;
                }
                this.tileMap.explorationData = this.state.exploration || {};
                this.tileMap.graveyardData = (this.state.lifecycle || {}).graveyard || [];
                this.tileMap.festivalData = this.state.festivals || {};
                this.tileMap.render(agents, this.selectedAgent, player?.current_location, this.world?.buildings?.completed || []);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    async loadSettings() {
        try {
            let provider = localStorage.getItem('llm_provider');
            let apiKey = localStorage.getItem('llm_api_key');
            const speed = localStorage.getItem('sim_speed');
            console.log('[RimTown] loadSettings: provider=', provider, 'hasKey=', !!apiKey, 'speed=', speed);
            if (speed) this.simSpeed = parseInt(speed);
            if (provider && provider !== 'none' && apiKey) {
                this.llmClient = new LLMClient(provider, apiKey);
                console.log('[RimTown] LLM client created from localStorage:', provider);
            }
            // Also try chrome.storage if localStorage didn't have it
            if (!this.llmClient && typeof chrome !== 'undefined' && chrome.storage) {
                try {
                    const data = await chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed']);
                    if (data.sim_speed && !speed) this.simSpeed = parseInt(data.sim_speed);
                    if (data.llm_provider && data.llm_provider !== 'none' && data.llm_api_key) {
                        this.llmClient = new LLMClient(data.llm_provider, data.llm_api_key);
                        console.log('[RimTown] LLM client created from chrome.storage:', data.llm_provider);
                    }
                } catch(e2) { console.log('[RimTown] chrome.storage read error:', e2); }
            }
        } catch(e) { console.log('[RimTown] Settings load error:', e); }
    }

    async saveSettings(provider, apiKey, speed) {
        this.simSpeed = parseInt(speed);
        this.baseSimSpeed = this.simSpeed;
        // Reset speed buttons to 1x
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        const btn1x = document.querySelector('.btn-speed[data-speed="1"]');
        if (btn1x) btn1x.classList.add('active');
        if (provider && provider !== 'none' && apiKey) {
            this.llmClient = new LLMClient(provider, apiKey);
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        } else {
            this.llmClient = null;
            this.world.conversationEngine = new ConversationEngine();
        }
        this.restartSimulation();
        this._updateLLMStatus();
        localStorage.setItem('llm_provider', provider);
        localStorage.setItem('llm_api_key', apiKey);
        localStorage.setItem('sim_speed', speed);
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ llm_provider: provider, llm_api_key: apiKey, sim_speed: speed });
            }
        } catch(e) {}
    }

    _updateLLMStatus() {
        const el = document.getElementById('llm-status');
        if (!el) return;
        if (this.llmClient && this.world.conversationEngine?.llm) {
            el.textContent = 'AI:' + this.llmClient.provider;
            el.className = 'llm-status connected';
            el.title = 'AI 已連接：' + this.llmClient.provider;
        } else {
            el.textContent = 'AI:未連接';
            el.className = 'llm-status disconnected';
            el.title = '請在設定中配置 AI 提供商和 API Key';
        }
    }

    startSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.simInterval = setInterval(() => {
            this.world.tick();
            this.state = this.world.getState();
            this.render();
        }, this.simSpeed);
    }

    restartSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.startSimulation();
    }

    setupTabListeners() {
        document.querySelectorAll('.rt-sidebar-tabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.dataset.tab;
                document.querySelectorAll('.rt-sidebar-tabs button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderSidebar();
            });
        });
    }

    setupMobileSidebar() {
        const sidebar = document.getElementById('rimtown-sidebar');
        if (!sidebar) return;

        // Drag handle: toggle expanded/collapsed
        const dragHandle = document.getElementById('mobile-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.toggle('mobile-expanded');
                }
            });
            // Touch drag support
            let startY = 0;
            let startFlex = 0;
            dragHandle.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
                startY = e.touches[0].clientY;
                startFlex = sidebar.classList.contains('mobile-expanded') ? 3 : 1;
                e.preventDefault();
            }, { passive: false });
            dragHandle.addEventListener('touchend', (e) => {
                if (window.innerWidth > 768) return;
                const endY = e.changedTouches[0].clientY;
                const diff = startY - endY;
                // Swipe up = expand, swipe down = collapse
                if (diff > 30) {
                    sidebar.classList.add('mobile-expanded');
                } else if (diff < -30) {
                    sidebar.classList.remove('mobile-expanded');
                }
            });
        }
    }

    setupMobileHeader() {
        if (window.innerWidth > 768) return;

        // Pause/play toggle
        const mobilePauseBtn = document.getElementById('mobile-btn-pause');
        if (mobilePauseBtn) {
            mobilePauseBtn.addEventListener('click', () => {
                this.world.paused = !this.world.paused;
                mobilePauseBtn.textContent = this.world.paused ? '▶' : '⏸';
                mobilePauseBtn.classList.toggle('paused', this.world.paused);
                this.render();
            });
        }

        // Menu dropdown toggle
        const menuBtn = document.getElementById('mobile-btn-menu');
        const menuDropdown = document.getElementById('mobile-menu-dropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
            });
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menuDropdown.contains(e.target) && e.target !== menuBtn) {
                    menuDropdown.classList.add('hidden');
                }
            });
        }

        // Wire mobile menu buttons to existing functionality
        // Close menu when any data-action button inside is clicked
        menuDropdown?.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
        });
        document.getElementById('mobile-new-game')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-new-game')?.click();
        });
        document.getElementById('mobile-save')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-save')?.click();
        });
        document.getElementById('mobile-btn-settings')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-settings')?.click();
        });
        document.getElementById('mobile-btn-account')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-account')?.click();
        });

        // Speed controls in mobile menu
        menuDropdown?.querySelectorAll('.btn-speed').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const speed = btn.dataset.speed;
                // Sync with desktop speed buttons
                document.querySelectorAll('.controls .btn-speed').forEach(b => {
                    if (b.dataset.speed === speed) b.click();
                });
                // Update mobile speed button styles
                menuDropdown.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // Global event delegation - handles all dynamic clicks via data-action attributes
    setupEventDelegation() {
        const container = document.getElementById('rimtown-app') || document.body;
        container.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const val = el.dataset.val || '';
            e.stopPropagation();
            switch(action) {
                // Town management
                case 'show-towns': this.showTownManager(); break;
                case 'switch-town': this.switchTown(val); break;
                case 'rename-town': this.renameTownPrompt(val); break;
                case 'delete-town': this.deleteTownConfirm(val); break;
                case 'create-town': this.createNewTown(); break;
                case 'close-town-modal': document.getElementById('town-modal')?.classList.add('hidden'); this.world.paused = false; break;
                // Chat
                case 'start-chat': this.startChatWith(val); break;
                case 'send-chat': this._sendFromInput(); break;
                case 'show-archives': this.showChatArchives(); break;
                case 'manual-archive': this.manualArchiveChat(); break;
                case 'back-to-chat': this.activeTab = 'chat'; this.renderSidebar(); break;
                case 'view-archive': this.viewArchive(parseInt(val)); break;
                case 'export-archive': this.exportArchivedChat(parseInt(val)); break;
                case 'delete-archive': this.deleteArchivedChat(parseInt(val)); break;
                case 'back-to-archives': this._viewingArchive = null; this.activeTab = 'chat-archives'; this.renderSidebar(); break;
                case 'filter-archive-npc': this._archiveNpcFilter = val || null; this.renderSidebar(); break;
                // Agent
                case 'select-agent': this.selectAgent(val); break;
                // NPC conversation expand
                case 'toggle-convo': el.classList.toggle('collapsed'); break;
                // Economy
                case 'trade': { const [idx, amount] = val.split(','); this.executeTrade(parseInt(idx), parseInt(amount)); this._unlockAchievement('first_trade'); this._tradeCount++; } break;
                case 'build': this.startBuilding(val); break;
                case 'research': this.startResearch(val); break;
                case 'send-expedition': this.sendExpedition(val); break;
                // Auth & Cloud
                case 'cloud-sync-up': document.getElementById('account-menu-popup')?.remove(); this._syncToCloud(); break;
                case 'cloud-sync-down': document.getElementById('account-menu-popup')?.remove(); this._showCloudSaves(); break;
                case 'show-achievements': document.getElementById('account-menu-popup')?.remove(); this._showAchievementsTab(); break;
                case 'auth-logout': document.getElementById('account-menu-popup')?.remove(); this._doLogout(); break;
                case 'load-cloud-save': this._loadCloudSave(val); break;
                case 'delete-cloud-save': this._deleteCloudSave(val); break;
                // Player interaction
                case 'player-choose-job': this._playerChooseJob(val); break;
                case 'player-quit-job': this._playerQuitJob(); break;
                case 'player-vote': this._playerVote(val); break;
                case 'player-propose': this._playerPropose(val); break;
                case 'player-flirt': this._playerFlirt(val); break;
                default: console.log('Unknown action:', action, val);
            }
        });
        // Handle Enter key in chat input via delegation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'chat-input') { this._sendFromInput(); return; }
            // Don't handle movement keys when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            // Only handle keys when game container is visible
            if (!document.getElementById('rimtown-app')) return;
            this._handleMovementKey(e);
        });
    }

    setupControlListeners() {
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.world.paused = true; this.render();
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.world.paused = false; this.render();
        });
        // Speed control buttons
        this.baseSimSpeed = this.simSpeed;
        const speedBtns = document.querySelectorAll('.btn-speed');
        console.log('[RimTown] Speed buttons found:', speedBtns.length, '| baseSimSpeed:', this.baseSimSpeed);
        speedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const multiplier = parseFloat(btn.dataset.speed);
                console.log('[RimTown] Speed button clicked:', multiplier, 'x | baseSpeed:', this.baseSimSpeed, '| newSpeed:', Math.round(this.baseSimSpeed / multiplier));
                document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.simSpeed = Math.round(this.baseSimSpeed / multiplier);
                if (this.simInterval) clearInterval(this.simInterval);
                this.simInterval = setInterval(() => {
                    this.world.tick();
                    this.state = this.world.getState();
                    this.render();
                }, this.simSpeed);
            });
        });
        document.getElementById('btn-new-game').addEventListener('click', async () => {
            const name = prompt('為新城鎮命名：', '邊境鎮 ' + (this._getTownList().length + 1));
            if (!name) return;
            await this.archiveChatHistory();
            this._saveCurrentTown();
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
            this.currentTownId = 'town_' + Date.now();
            this._saveCurrentTown(name);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            this.tileMap.agentPositions = {};
            this.render();
        });
        document.getElementById('btn-save').addEventListener('click', async () => {
            await this.saveGame();
            this.state = this.world.getState();
            this.renderSidebar();
        });
        document.getElementById('btn-export').addEventListener('click', () => this.exportSave());
        document.getElementById('btn-import').addEventListener('click', () => this.importSave());
    }

    setupSettingsListeners() {
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('hidden');
            const provider = localStorage.getItem('llm_provider');
            const apiKey = localStorage.getItem('llm_api_key');
            const speed = localStorage.getItem('sim_speed');
            if (provider) document.getElementById('llm-provider').value = provider;
            if (apiKey) document.getElementById('llm-api-key').value = apiKey;
            if (speed) document.getElementById('sim-speed').value = speed;
            if (!provider && typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed'], data => {
                    if (data.llm_provider) document.getElementById('llm-provider').value = data.llm_provider;
                    if (data.llm_api_key) document.getElementById('llm-api-key').value = data.llm_api_key;
                    if (data.sim_speed) document.getElementById('sim-speed').value = data.sim_speed;
                });
            }
        });
        // When switching provider, clear the API key input to enforce one-AI-at-a-time
        document.getElementById('llm-provider').addEventListener('change', () => {
            const provEl = document.getElementById('llm-provider');
            const keyEl = document.getElementById('llm-api-key');
            const savedProvider = localStorage.getItem('llm_provider');
            // If user switched to a different provider, clear the key field
            if (provEl.value !== savedProvider) {
                keyEl.value = '';
                keyEl.placeholder = provEl.value === 'none' ? '不需要 API 金鑰' : '請輸入新的 API 金鑰...';
            }
        });
        document.getElementById('settings-save').addEventListener('click', () => {
            const provider = document.getElementById('llm-provider').value;
            const apiKey = document.getElementById('llm-api-key').value;
            const speed = document.getElementById('sim-speed').value;
            if (provider !== 'none' && !apiKey) {
                alert('請輸入 API 金鑰，或選擇「無（模擬對話）」。');
                return;
            }
            this.saveSettings(provider, apiKey, speed);
            document.getElementById('settings-modal').classList.add('hidden');
        });
        document.getElementById('settings-cancel').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.add('hidden');
        });
    }

    // --- Save / Load ---
    async saveGame() {
        try {
            if (this.currentTownId) {
                this._saveCurrentTown();
            }
            const saveData = this.world.serialize();
            const json = JSON.stringify(saveData);
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ rimtown_save: json });
            } else {
                localStorage.setItem('rimtown_save', json);
            }
            this.world.logMessage('system', '遊戲已儲存。');
            return true;
        } catch(e) { console.error('Save failed:', e); return false; }
    }

    async tryLoadGame() {
        try {
            let json = null;
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get(['rimtown_save']);
                json = data.rimtown_save;
            } else {
                json = localStorage.getItem('rimtown_save');
            }
            if (!json) return false;
            const saveData = JSON.parse(json);
            return this.world.loadSave(saveData);
        } catch(e) { console.error('Load failed:', e); return false; }
    }

    async deleteSave() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.remove('rimtown_save');
            } else {
                localStorage.removeItem('rimtown_save');
            }
        } catch(e) {}
    }

    setupAutoSave() {
        // Auto-save every 60 seconds (local + cloud)
        this._autoSaveInterval = setInterval(() => {
            if (!this.world.paused) {
                this.saveGame();
                // Cloud sync every 5 minutes
                if (this.auth.loggedIn && Date.now() - (this._lastCloudSync || 0) > 300000) {
                    this._lastCloudSync = Date.now();
                    this._syncToCloud();
                }
            }
        }, 60000);
        // Also save when tab is closing
        window.addEventListener('beforeunload', () => {
            try {
                if (this.currentTownId) {
                    this._saveCurrentTown();
                }
                const saveData = this.world.serialize();
                const json = JSON.stringify(saveData);
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.set({ rimtown_save: json });
                } else {
                    localStorage.setItem('rimtown_save', json);
                }
                // Sync to cloud on tab close using fetch keepalive
                if (this.auth.loggedIn && this.auth._restUrl) {
                    const clock = saveData.clock || {};
                    const payload = JSON.stringify({
                        town_id: this.currentTownId,
                        town_name: this._getCurrentTownName(),
                        save_data: json,
                        season: clock.season || '',
                        year: clock.year || 1,
                        day: clock.day || 1,
                        population: Object.keys(saveData.agents || {}).length,
                    });
                    fetch(this.auth._restUrl + 'save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.auth._nonce },
                        credentials: 'same-origin',
                        body: payload,
                        keepalive: true,
                    }).catch(() => {});
                }
            } catch(e) {}
        });
    }

    async exportSave() {
        const saveData = this.world.serialize();
        const json = JSON.stringify(saveData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rimtown_save_${saveData.clock.season}_Y${saveData.clock.year}D${saveData.clock.day}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importSave() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const saveData = JSON.parse(text);
                if (this.world.loadSave(saveData)) {
                    if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    this.tileMap.agentPositions = {};
                    this.render();
                    await this.saveGame();
                } else {
                    alert('讀取存檔失敗。');
                }
            } catch(err) { alert('無效的存檔：' + err.message); }
        };
        input.click();
    }

    // --- Chat Archive (per-town persistent storage) ---
    _getArchiveKey() {
        return this.currentTownId ? 'rimtown_town_' + this.currentTownId + '_archives' : 'rimtown_chat_archives';
    }
    _getArchives() {
        try { return JSON.parse(localStorage.getItem(this._getArchiveKey()) || '[]'); } catch(e) { return []; }
    }
    _saveArchives(archives) {
        localStorage.setItem(this._getArchiveKey(), JSON.stringify(archives));
    }

    async archiveChatHistory() {
        const player = this.world.agents?.get?.('player') || this.world.agents?.['player'];
        if (!player || !player.chatHistory || !player.chatHistory.length) return;

        const clock = this.world.clock;
        const archive = {
            id: Date.now(),
            savedAt: new Date().toISOString(),
            gameClock: `${clock.season || '春季'} 第${clock.year || 1}年 第${clock.day || 1}天`,
            townId: this.currentTownId,
            playerName: player.name,
            messageCount: player.chatHistory.length,
            npcNames: [...new Set(player.chatHistory.map(m => m.speaker === player.name ? m.target : m.speaker))],
            messages: [...player.chatHistory]
        };

        const archives = this._getArchives();
        archives.push(archive);
        while (archives.length > 30) archives.shift();
        this._saveArchives(archives);
        return archive;
    }

    async getChatArchives() {
        return this._getArchives();
    }

    async deleteChatArchive(archiveId) {
        const archives = this._getArchives().filter(a => a.id !== archiveId);
        this._saveArchives(archives);
    }

    exportChatLog(archive) {
        const lines = [];
        lines.push(`=== 邊境鎮聊天記錄 ===`);
        lines.push(`遊戲進度：${archive.gameClock}`);
        lines.push(`玩家：${archive.playerName}`);
        lines.push(`存檔時間：${archive.savedAt}`);
        lines.push(`NPC：${archive.npcNames.join('、')}`);
        lines.push(`訊息數：${archive.messageCount}`);
        lines.push('');
        archive.messages.forEach(m => {
            lines.push(`[${m.time || '??:??'}] ${m.speaker} → ${m.target}: ${m.text}`);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rimtown_chat_${archive.gameClock.replace(/\s+/g,'_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    assignAgentColor(agentId) {
        if (agentId === 'player') return '#ffffff';
        if (!this.agentColors[agentId]) {
            const idx = Object.keys(this.agentColors).length % this.colorPalette.length;
            this.agentColors[agentId] = this.colorPalette[idx];
        }
        return this.agentColors[agentId];
    }

    // --- Player Actions ---
    playerMoveTo(locationId) {
        const player = this.world.agents['player'];
        if (player && player.moveTo(locationId, this.world)) {
            this.state = this.world.getState();
            this.render();
        }
    }

    _handleMovementKey(e) {
        if (!this.tileMap || !this.world) return;
        const key = e.key.toLowerCase();
        // WASD / Arrow keys for directional movement
        const dirMap = { w:'up', arrowup:'up', s:'down', arrowdown:'down', a:'left', arrowleft:'left', d:'right', arrowright:'right' };
        const dir = dirMap[key];
        if (dir) {
            e.preventDefault();
            const target = this._getAdjacentLocation(dir);
            if (target) this.playerMoveTo(target);
            return;
        }
        // E key: interact with nearest NPC at same location
        if (key === 'e') {
            e.preventDefault();
            const player = this.state?.agents?.['player'];
            if (!player) return;
            const npcsHere = Object.entries(this.state.agents)
                .filter(([id, a]) => id !== 'player' && a.current_location === player.current_location)
                .map(([id]) => id);
            if (npcsHere.length) {
                // Chat with the first NPC found, or cycle through if already chatting
                const nextIdx = this.chatTarget ? (npcsHere.indexOf(this.chatTarget) + 1) % npcsHere.length : 0;
                this.startChatWith(npcsHere[nextIdx]);
            }
            return;
        }
    }

    _getAdjacentLocation(direction) {
        if (!this.tileMap) return null;
        const player = this.world.agents['player'];
        if (!player) return null;
        const currentLoc = player.currentLocation;

        // Get all zone centers
        const allZones = { ...this.tileMap.buildingZones, ...this.tileMap.natureZones };
        const currentZone = allZones[currentLoc];
        if (!currentZone) return null;

        const cx = currentZone.x + currentZone.w / 2;
        const cy = currentZone.y + currentZone.h / 2;

        // Find the best location in the given direction
        // Very forgiving: allow up to 120 degrees cone in the direction
        let best = null;
        let bestScore = Infinity;

        for (const [locId, zone] of Object.entries(allZones)) {
            if (locId === currentLoc) continue;
            const tx = zone.x + zone.w / 2;
            const ty = zone.y + zone.h / 2;
            const dx = tx - cx;
            const dy = ty - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.5) continue;

            // Check direction with wide cone (120 degrees = cos(60) = 0.5)
            let valid = false;
            switch (direction) {
                case 'up': valid = dy < 0 && -dy / dist > 0.3; break;    // At least 30% upward
                case 'down': valid = dy > 0 && dy / dist > 0.3; break;
                case 'left': valid = dx < 0 && -dx / dist > 0.3; break;
                case 'right': valid = dx > 0 && dx / dist > 0.3; break;
            }
            if (!valid) continue;

            // Score: distance with slight alignment bonus (prefer more aligned)
            const alignment = direction === 'up' || direction === 'down'
                ? Math.abs(dx) / (Math.abs(dy) + 0.1)
                : Math.abs(dy) / (Math.abs(dx) + 0.1);
            const score = dist * (1 + alignment * 0.3);

            if (score < bestScore) {
                bestScore = score;
                best = locId;
            }
        }

        // If no location found in direction, try wrapping around (find ANY closest unused direction)
        if (!best) {
            let fallbackBest = null, fallbackDist = Infinity;
            for (const [locId, zone] of Object.entries(allZones)) {
                if (locId === currentLoc) continue;
                const tx = zone.x + zone.w / 2;
                const ty = zone.y + zone.h / 2;
                const dist = Math.sqrt((tx-cx)**2 + (ty-cy)**2);
                if (dist < fallbackDist) { fallbackDist = dist; fallbackBest = locId; }
            }
            // Only use fallback if the nearest location is reasonably close
            if (fallbackBest && fallbackDist < 20) best = fallbackBest;
        }

        return best;
    }

    async playerSendMessage(targetId, message) {
        if (this.chatSending || !message.trim()) return;
        this.chatSending = true;
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) { this.chatSending = false; return; }
        if (player.currentLocation !== npc.currentLocation) {
            this._appendChatBubble('system', 'They are not at your location.');
            this.chatSending = false; return;
        }
        try {
            await this.world.conversationEngine.generatePlayerReply(player, npc, message.trim(), this.world);
            this.state = this.world.getState();
            if (this.activeTab === 'chat') { this.renderSidebar(); this._scrollChatToBottom(); }
        } catch(e) { console.error('Chat error:', e); }
        this.chatSending = false;
    }

    startChatWith(agentId) {
        // Auto-move to NPC's location if not already there
        const npc = this.world?.agents?.[agentId];
        const player = this.world?.agents?.['player'];
        if (npc && player && player.currentLocation !== npc.currentLocation) {
            player.moveTo(npc.currentLocation, this.world);
            this.state = this.world.getState();
        }
        this.chatTarget = agentId;
        this.selectedAgent = agentId;
        this.activeTab = 'chat';
        document.querySelectorAll('.rt-sidebar-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'chat'));
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.add('mobile-expanded');
        this.renderSidebar();
        this.render();
    }

    // --- Render ---
    render() {
        if (!this.state) return;
        this.renderClock();
        this.renderMap();
        this.renderSidebar();
    }

    renderClock() {
        const clock = this.state.clock;
        document.getElementById('clock-display').textContent = clock.time_str;
        const pauseBtn = document.getElementById('btn-pause');
        const resumeBtn = document.getElementById('btn-resume');
        if (this.state.paused) { pauseBtn.classList.add('active'); resumeBtn.classList.remove('active'); }
        else { pauseBtn.classList.remove('active'); resumeBtn.classList.add('active'); }
        const agentCount = Object.keys(this.state.agents).length;
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? ` (+${travelCount} travelling)` : '';
        document.getElementById('population-count').textContent = `Population: ${agentCount}${travelText}`;
        const terrain = this.state.locations?.terrain || '';
        const seed = this.state.locations?.seed ?? '';
        const terrainEl = document.getElementById('terrain-display');
        if (terrainEl && terrain) terrainEl.textContent = `${terrain} #${seed}`;

        // Update mobile header clock
        const mobileClock = document.getElementById('mobile-clock');
        if (mobileClock) {
            const h = String(clock.hour || 0).padStart(2, '0');
            const m = String(clock.minute || 0).padStart(2, '0');
            mobileClock.textContent = `Y${clock.year} ${clock.season} D${clock.day} ${h}:${m} | ${agentCount}人`;
        }
        // Update mobile pause button state
        const mobilePauseBtn = document.getElementById('mobile-btn-pause');
        if (mobilePauseBtn) {
            mobilePauseBtn.textContent = this.state.paused ? '▶' : '⏸';
            mobilePauseBtn.classList.toggle('paused', this.state.paused);
        }
        // Sync mobile LLM status
        const mobileLlm = document.getElementById('mobile-llm-status');
        const desktopLlm = document.getElementById('llm-status');
        if (mobileLlm && desktopLlm) {
            mobileLlm.textContent = desktopLlm.textContent;
            mobileLlm.className = desktopLlm.className;
        }
    }

    renderMap() {
        // Map rendering is now handled by the canvas animation loop (_startRenderLoop)
        // This method is kept as a no-op for compatibility
    }

    onAgentClick(agentId) {
        const player = this.state?.agents?.['player'];
        const target = this.state?.agents?.[agentId];
        if (!player || !target) return;
        if (player.current_location === target.current_location) {
            this.startChatWith(agentId);
        } else {
            // Move to NPC's location and start chat
            this.playerMoveTo(target.current_location);
            this.startChatWith(agentId);
        }
    }

    renderSidebar() {
        const content = document.getElementById('sidebar-content');
        switch (this.activeTab) {
            case 'residents': this.renderResidentsList(content); break;
            case 'chat':
                if (this._viewingArchive) this.renderChatArchiveView(content);
                else this.renderChat(content);
                break;
            case 'chat-archives': this.renderChatArchiveList(content); break;
            case 'detail': this.renderAgentDetail(content); break;
            case 'economy': this.renderEconomy(content); break;
            case 'log': this.renderLog(content); break;
            case 'events': this.renderEvents(content); break;
            case 'achievements': this.renderAchievements(content); break;
        }
    }

    renderChat(container) {
        const player = this.state?.agents?.['player'];
        if (!player) { container.innerHTML = '<p class="muted-text">Player not found.</p>'; return; }
        const playerLoc = player.current_location;
        const chatHistory = player.chat_history || [];
        const nearbyNpcs = Object.entries(this.state.agents)
            .filter(([id, a]) => id !== 'player' && a.current_location === playerLoc)
            .map(([id, a]) => ({ id, ...a }));

        // Build set of all NPCs player has chatted with (for history)
        const chattedNames = new Set();
        chatHistory.forEach(c => {
            if (c.speaker !== player.name) chattedNames.add(c.speaker);
            if (c.target !== player.name) chattedNames.add(c.target);
        });
        // Map names to agent IDs for past contacts
        const nameToId = {};
        for (const [id, a] of Object.entries(this.state.agents)) {
            if (id !== 'player') nameToId[a.name] = id;
        }

        let nearbyHtml = `<div class="chat-location">你在：<strong>${playerLoc.replace(/_/g,' ')}</strong></div><div class="chat-nearby">`;
        if (nearbyNpcs.length) {
            nearbyHtml += '<div class="nearby-label">附近：</div><div class="nearby-list">';
            nearbyNpcs.forEach(npc => {
                nearbyHtml += `<button class="nearby-btn ${this.chatTarget===npc.id?'active':''}" data-action="start-chat" data-val="${npc.id}">
                    <span class="mood-indicator mood-${npc.mood_description}"></span>${npc.name}
                    <span class="nearby-job">${npc.job?.title||''}</span></button>`;
            });
            nearbyHtml += '</div>';
        } else {
            nearbyHtml += '<p class="muted-text">附近沒有人。</p>';
        }

        // Show past chat contacts not currently nearby
        const nearbyIds = new Set(nearbyNpcs.map(n => n.id));
        const pastContacts = [...chattedNames].filter(name => {
            const id = nameToId[name];
            return id && !nearbyIds.has(id);
        });
        if (pastContacts.length) {
            nearbyHtml += '<div class="nearby-label" style="margin-top:6px">聊天記錄：</div><div class="nearby-list">';
            pastContacts.forEach(name => {
                const id = nameToId[name];
                const msgCount = chatHistory.filter(c => c.speaker === name || c.target === name).length;
                nearbyHtml += `<button class="nearby-btn history-btn ${this.chatTarget===id?'active':''}" data-action="start-chat" data-val="${id}">
                    ${name} <span class="nearby-job">${msgCount}則</span></button>`;
            });
            nearbyHtml += '</div>';
        }
        nearbyHtml += '</div>';

        let messagesHtml = '<div class="chat-messages" id="chat-messages">';
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const targetName = targetAgent?.name || this.chatTarget;
            const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
            if (!filtered.length) messagesHtml += `<p class="muted-text chat-hint">開始與${targetName}對話...</p>`;
            filtered.forEach(msg => {
                const isP = msg.speaker === player.name;
                messagesHtml += `<div class="chat-bubble ${isP?'chat-player':'chat-npc'}">
                    <div class="chat-speaker">${msg.speaker}</div>
                    <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                    <div class="chat-time">${msg.time||''}</div></div>`;
            });
        } else messagesHtml += '<p class="muted-text chat-hint">選擇一個人來查看對話。</p>';
        messagesHtml += '</div>';

        let inputHtml = '';
        if (this.chatTarget) {
            const ta = this.state.agents[this.chatTarget];
            const isNearby = ta && ta.current_location === playerLoc;
            if (isNearby) {
                inputHtml = `<div class="chat-input-area">
                    <input type="text" id="chat-input" class="chat-input" placeholder="輸入訊息..."
                        ${this.chatSending?'disabled':''}>
                    <button class="chat-send-btn" data-action="send-chat" ${this.chatSending?'disabled':''}>${this.chatSending?'...':'送出'}</button></div>`;
            } else {
                inputHtml = `<div class="chat-input-area"><p class="muted-text" style="padding:8px">📜 查看與${ta?.name||'對方'}的過去對話。前往他們的位置即可聊天。</p></div>`;
            }
        }
        // Archive actions bar
        let archiveBar = `<div class="chat-archive-bar">
            <button class="btn-archive-view" data-action="show-archives">歷史對話</button>
            <button class="btn-archive-save" data-action="manual-archive">立即存檔</button>
        </div>`;

        container.innerHTML = nearbyHtml + messagesHtml + inputHtml + archiveBar;
        this._scrollChatToBottom();
        const input = document.getElementById('chat-input');
        if (input && !this.chatSending) input.focus();
    }

    async showChatArchives() {
        this.activeTab = 'chat-archives';
        this._viewingArchive = null;
        this.renderSidebar();
    }

    async renderChatArchiveList(container) {
        const archives = await this.getChatArchives();
        let html = `<div class="archive-header">
            <button class="btn-back" data-action="back-to-chat">&larr; 返回聊天</button>
            <h3>聊天存檔</h3>
        </div>`;
        if (!archives.length) {
            html += '<p class="muted-text" style="padding:12px">尚無存檔。開始新遊戲時聊天記錄會自動存檔。</p>';
        } else {
            html += '<div class="archive-list">';
            [...archives].reverse().forEach(a => {
                const date = new Date(a.savedAt).toLocaleDateString();
                html += `<div class="archive-item">
                    <div class="archive-info" data-action="view-archive" data-val="${a.id}">
                        <div class="archive-title">${a.gameClock} - ${a.playerName}</div>
                        <div class="archive-meta">${date} | ${a.messageCount}則訊息 | ${a.npcNames.length}位NPC</div>
                        <div class="archive-npcs">${a.npcNames.slice(0, 5).join(', ')}${a.npcNames.length > 5 ? '...' : ''}</div>
                    </div>
                    <div class="archive-actions">
                        <button data-action="export-archive" data-val="${a.id}" title="匯出">匯出</button>
                        <button data-action="delete-archive" data-val="${a.id}" title="刪除" class="btn-danger">刪除</button>
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        container.innerHTML = html;
    }

    async viewArchive(archiveId) {
        const archives = await this.getChatArchives();
        this._viewingArchive = archives.find(a => a.id === archiveId) || null;
        if (this._viewingArchive) {
            this.activeTab = 'chat';
            this._archiveNpcFilter = null;
            this.renderSidebar();
        }
    }

    renderChatArchiveView(container) {
        const archive = this._viewingArchive;
        if (!archive) { this._viewingArchive = null; this.renderChat(container); return; }

        let html = `<div class="archive-header">
            <button class="btn-back" data-action="back-to-archives">&larr; 返回列表</button>
            <h3>${archive.gameClock}</h3>
            <div class="archive-meta">${archive.playerName} | ${archive.messageCount}則訊息</div>
        </div>`;

        // NPC filter buttons
        html += '<div class="nearby-list" style="padding:4px 8px">';
        html += `<button class="nearby-btn ${!this._archiveNpcFilter?'active':''}" data-action="filter-archive-npc" data-val="">All</button>`;
        archive.npcNames.forEach(name => {
            html += `<button class="nearby-btn history-btn ${this._archiveNpcFilter===name?'active':''}" data-action="filter-archive-npc" data-val="${name}">${name}</button>`;
        });
        html += '</div>';

        // Messages
        let messages = archive.messages;
        if (this._archiveNpcFilter) {
            messages = messages.filter(m => m.speaker === this._archiveNpcFilter || m.target === this._archiveNpcFilter);
        }

        html += '<div class="chat-messages" id="chat-messages">';
        if (!messages.length) {
            html += '<p class="muted-text chat-hint">找不到訊息。</p>';
        }
        messages.forEach(msg => {
            const isP = msg.speaker === archive.playerName;
            html += `<div class="chat-bubble ${isP?'chat-player':'chat-npc'}">
                <div class="chat-speaker">${msg.speaker}</div>
                <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                <div class="chat-time">${msg.time||''}</div></div>`;
        });
        html += '</div>';

        html += `<div class="chat-archive-bar">
            <button class="btn-archive-save" data-action="export-archive" data-val="${archive.id}">匯出此對話記錄</button>
        </div>`;

        container.innerHTML = html;
        this._scrollChatToBottom();
    }

    async manualArchiveChat() {
        const result = await this.archiveChatHistory();
        if (result) {
            this.world.logMessage('system', `聊天已存檔（${result.messageCount}則訊息）。`);
        } else {
            this.world.logMessage('system', '沒有聊天訊息可存檔。');
        }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    async exportArchivedChat(archiveId) {
        const archives = await this.getChatArchives();
        const archive = archives.find(a => a.id === archiveId);
        if (archive) this.exportChatLog(archive);
    }

    async deleteArchivedChat(archiveId) {
        if (!confirm('確定刪除此聊天存檔？')) return;
        await this.deleteChatArchive(archiveId);
        this.renderSidebar();
    }

    _sendFromInput() {
        const input = document.getElementById('chat-input');
        if (!input || !this.chatTarget) return;
        const msg = input.value.trim(); if (!msg) return;
        input.value = '';
        this.playerSendMessage(this.chatTarget, msg);
    }
    _scrollChatToBottom() { requestAnimationFrame(() => { const el = document.getElementById('chat-messages'); if(el) el.scrollTop=el.scrollHeight; }); }
    _appendChatBubble(type, text) { const el = document.getElementById('chat-messages'); if(!el) return; const div=document.createElement('div'); div.className=`chat-bubble chat-${type}`; div.innerHTML=`<div class="chat-text">${this._escapeHtml(text)}</div>`; el.appendChild(div); el.scrollTop=el.scrollHeight; }
    _escapeHtml(str) { const div=document.createElement('div'); div.textContent=str; return div.innerHTML; }

    _renderSkills(skillsData) {
        if (!skillsData?.skills) return '<p class="muted-text">沒有技能資料</p>';
        const passionOrder = {'狂熱':0,'大':1,'微':2,'無':3,'無能':4};
        const sorted = Object.entries(skillsData.skills).sort(([,a],[,b]) => {
            const pa=passionOrder[a.passion]??3, pb=passionOrder[b.passion]??3;
            if(pa!==pb) return pa-pb; return b.level-a.level;
        });
        let html = '<div class="skills-grid">';
        for (const [name, s] of sorted) {
            const barPct = s.incapable ? 0 : Math.max(0, Math.min(100, (s.level/20)*100 + s.progress*(100/20)));
            const passionLabel = {'狂熱':'&#9733;&#9733;&#9733;','大':'&#9733;&#9733;','微':'&#9733;','無':'','無能':'&#10007;'}[s.passion]||'';
            html += `<div class="skill-row passion-${s.passion}"><span class="skill-name">${name}</span>
                <span class="skill-passion">${passionLabel}</span>
                <div class="skill-bar"><div class="skill-bar-fill" style="width:${barPct}%"></div></div>
                <span class="skill-level">${s.incapable?'-':s.level}</span></div>`;
        }
        return html + '</div>';
    }

    renderResidentsList(container) {
        if (!this.state) return;
        let html = '';
        // Player card at top
        const playerAgent = this.state.agents['player'];
        if (playerAgent) {
            const isSelected = this.selectedAgent === 'player';
            html += `<div class="resident-card player-card ${isSelected?'selected':''}" data-action="select-agent" data-val="player">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${playerAgent.mood_description}"></span>⭐ ${playerAgent.name}（你）</span>
                    <span class="resident-job">${playerAgent.job?.title||'無業'}</span></div>
                <div class="resident-status"><span>@ ${(playerAgent.current_location||'').replace(/_/g,' ')}</span><span>${playerAgent.mood_label||playerAgent.mood_description} (${playerAgent.mood})</span></div></div>`;
        }
        for (const [aid, agent] of Object.entries(this.state.agents)) {
            if (aid === 'player') continue;
            const isSelected = this.selectedAgent === aid;
            const player = this.state.agents['player'];
            const sameLoc = player && player.current_location === agent.current_location;
            const genderIcon = agent.gender_label === '男' ? '♂' : agent.gender_label === '女' ? '♀' : '';
            html += `<div class="resident-card ${isSelected?'selected':''}" data-action="select-agent" data-val="${aid}">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${genderIcon} ${agent.name}${sameLoc?'<span class="nearby-badge">附近</span>':''}</span>
                    <span class="resident-job">${agent.job?.title||'無業'}</span></div>
                <div class="resident-status"><span>${agent.activity_label||agent.activity} @ ${agent.current_location.replace(/_/g,' ')}</span><span>${agent.mood_label||agent.mood_description} (${agent.mood})</span></div>
                ${agent.current_thought?`<div style="font-size:0.7rem;color:#aaa;margin-top:4px;font-style:italic">「${agent.current_thought}」</div>`:''}
                <button class="chat-with-btn" data-action="start-chat" data-val="${aid}">${sameLoc?'對話':'前往對話'}</button></div>`;
        }
        container.innerHTML = html;
    }

    renderAgentDetail(container) {
        if (!this.selectedAgent || !this.state) { container.innerHTML = '<p class="muted-text" style="padding:20px">選擇一位居民查看詳情</p>'; return; }
        const agent = this.state.agents[this.selectedAgent]; if (!agent) return;
        const needs = agent.needs || {}, personality = agent.personality || {};
        const relationships = agent.relationships || [], memories = agent.recent_memories || [];
        const TRAIT_LABELS = {kind:'善良',abrasive:'刻薄',shy:'害羞',charismatic:'魅力',gossip:'八卦',hardworking:'勤勞',lazy:'懶惰',perfectionist:'完美主義',creative:'有創意',optimist:'樂觀',pessimist:'悲觀',neurotic:'神經質',stoic:'沉穩',romantic:'浪漫',jealous:'嫉妒',night_owl:'夜貓子',early_bird:'早起鳥',glutton:'貪吃',ascetic:'苦行',curious:'好奇'};
        const makeBar = (label, value) => {
            const cls = value > 60 ? 'high' : value > 30 ? 'medium' : 'low';
            return `<div class="needs-bar"><label>${label}</label><div class="bar"><div class="bar-fill ${cls}" style="width:${value}%"></div></div><span style="width:30px;text-align:right;font-size:0.6rem">${Math.round(value)}</span></div>`;
        };
        const player = this.state.agents['player'];
        const sameLoc = player && player.current_location === agent.current_location && this.selectedAgent !== 'player';
        let interactionBtns = '';
        if (sameLoc) {
            interactionBtns += `<button class="chat-with-btn" data-action="start-chat" data-val="${this.selectedAgent}">對話</button>`;
            // Flirt / Propose buttons
            const playerRel = player.relationships?.find(r => r.target_id === this.selectedAgent || r.target_name === agent.name);
            if (playerRel) {
                interactionBtns += ` <button class="btn-flirt" data-action="player-flirt" data-val="${this.selectedAgent}">調情</button>`;
                if (playerRel.romantic_interest > 30 && !playerRel.status) {
                    interactionBtns += ` <button class="btn-propose" data-action="player-propose" data-val="${this.selectedAgent}">告白</button>`;
                }
                if (playerRel.status === 'dating') {
                    interactionBtns += ` <button class="btn-propose" data-action="player-propose" data-val="${this.selectedAgent}">求婚</button>`;
                }
            } else {
                interactionBtns += ` <button class="btn-flirt" data-action="player-flirt" data-val="${this.selectedAgent}">調情</button>`;
            }
        }
        const chatBtn = interactionBtns;
        // Build relationship status summary
        const partner = relationships.find(r => r.status === 'dating' || r.status === 'married');
        const exes = relationships.filter(r => r.status === 'ex');
        const cheating = relationships.filter(r => r.is_cheating);
        const crushes = relationships.filter(r => r.romantic_interest > 30 && !r.status);
        let loveStatus = '單身';
        if (partner) {
            loveStatus = partner.status === 'married'
                ? `已與<b>${partner.target_name}</b>結婚`
                : `正在與<b>${partner.target_name}</b>交往`;
        }
        if (cheating.length) {
            loveStatus += ` <span style="color:var(--negative)">（同時與${cheating.map(c=>c.target_name).join('、')}有秘密關係）</span>`;
        }
        if (crushes.length && !partner) {
            loveStatus += `，暗戀${crushes.map(c=>`<b>${c.target_name}</b>`).join('、')}`;
        }
        if (exes.length) {
            loveStatus += `（前任：${exes.map(e=>e.target_name).join('、')}）`;
        }

        // Sort relationships: partners first, then by affinity
        const sortedRels = [...relationships].sort((a, b) => {
            const statusOrder = { married: 0, dating: 1, ex: 2 };
            const sa = statusOrder[a.status] ?? 99;
            const sb = statusOrder[b.status] ?? 99;
            if (sa !== sb) return sa - sb;
            if (a.is_cheating !== b.is_cheating) return a.is_cheating ? -1 : 1;
            return b.affinity - a.affinity;
        });

        container.innerHTML = `<div class="detail-panel visible">
            <div class="detail-section"><h3>${agent.name}（${agent.gender_label === '男' ? '♂' : agent.gender_label === '女' ? '♀' : ''}${agent.gender_label} · ${agent.age}歲）</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||'無業'} | ${agent.mood_label||agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${personality.background||''}</p>${chatBtn}</div>
            <div class="detail-section"><h3>性格</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${TRAIT_LABELS[t]||t}</span>`).join('')}
                <div style="margin-top:4px;font-size:0.7rem;color:var(--text-secondary)">價值觀：${(personality.values||[]).join('、')}</div></div>
            <div class="detail-section"><h3>感情狀態</h3>
                <p style="font-size:0.8rem">${loveStatus}</p></div>
            ${this.selectedAgent === 'player' ? this._renderPlayerJobPanel(agent) : ''}
            <div class="detail-section"><h3>需求</h3>${makeBar('飢餓',needs.hunger||0)}${makeBar('休息',needs.rest||0)}${makeBar('社交',needs.social||0)}${makeBar('舒適',needs.comfort||0)}${makeBar('娛樂',needs.recreation||0)}</div>
            <div class="detail-section"><h3>技能（總計：${agent.skills?.total_level||0}）</h3>${this._renderSkills(agent.skills)}</div>
            <div class="detail-section"><h3>人際關係（${relationships.length}）</h3>
                ${sortedRels.length===0?'<p style="font-size:0.7rem;color:var(--text-muted)">尚無人際關係</p>':
                sortedRels.map(r=>{
                    let badge = '';
                    if (r.status === 'married') badge = '<span class="rel-status-badge rel-married">💍 已婚</span>';
                    else if (r.status === 'dating') badge = '<span class="rel-status-badge rel-dating">💕 交往中</span>';
                    else if (r.status === 'ex') badge = '<span class="rel-status-badge rel-ex">💔 前任</span>';
                    if (r.is_cheating) badge += ' <span class="rel-status-badge rel-cheating">🤫 秘密關係</span>';
                    const romHeart = r.romantic_interest > 0 ? ` <span style="color:#f472b6">&#10084;${r.romantic_interest}</span>` : '';
                    const crushIcon = r.romantic_interest > 30 && !r.status ? ' <span style="color:#f472b6;font-size:0.65rem">暗戀</span>' : '';
                    return `<div class="relationship-item${r.status?' rel-has-status':''}"><span>${r.target_name} ${badge}${crushIcon}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type}（${r.affinity>0?'+':''}${r.affinity}）${romHeart}</span></div>`;
                }).join('')}</div>
            ${this._renderAgentFactions(this.selectedAgent)}
            <div class="detail-section"><h3>近期記憶</h3>
                ${memories.length===0?'<p style="font-size:0.7rem;color:var(--text-muted)">尚無記憶</p>':
                memories.slice(-10).reverse().map(m=>`<div class="memory-item"><span class="memory-time">${m.time}</span>${m.content}</div>`).join('')}</div></div>`;
    }

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();
        let html = '';

        // Show recent NPC conversations at the top
        const npcConvos = (this.state.npc_conversations || []).slice().reverse();
        if (npcConvos.length) {
            html += '<div class="npc-convo-section"><h4 style="padding:6px 10px;color:var(--accent);font-size:0.75rem;border-bottom:1px solid var(--border)">村民對話</h4>';
            npcConvos.slice(0, 8).forEach(c => {
                html += `<div class="npc-convo-entry" data-action="toggle-convo">
                    <div class="npc-convo-header"><span class="log-time">${c.time}</span><strong>${c.agentA}</strong> &amp; <strong>${c.agentB}</strong>
                    <span style="font-size:0.6rem;color:var(--text-muted);margin-left:4px">@ ${(c.location||'').replace(/_/g,' ')}</span></div>
                    <div class="npc-convo-summary">${c.summary}</div>
                    <div class="npc-convo-dialogue" style="display:block">`;
                (c.dialogue || []).forEach(d => {
                    html += `<div class="npc-convo-line"><span class="npc-convo-speaker">${d.speaker}:</span> ${this._escapeHtml(d.text)}</div>`;
                });
                html += '</div></div>';
            });
            html += '</div>';
        }

        // Standard log messages
        html += '<div class="log-messages-section">';
        messages.forEach(msg => {
            html += `<div class="log-entry type-${msg.type}"><span class="log-time">${msg.time}</span>
                ${msg.agent?`<strong>${msg.agent}</strong>`:''} ${msg.content} ${msg.target?` &rarr; ${msg.target}`:''}</div>`;
        });
        html += '</div>';
        container.innerHTML = html || '<p class="muted-text" style="padding:20px">尚無訊息...</p>';
    }

    renderEvents(container) {
        if (!this.state) return;
        let html = '';

        // --- Election ---
        const election = this.state.election;
        if (election && election.active) {
            html += '<div class="election-section">';
            if (election.phase === 'campaign') {
                html += `<h4>📢 鎮長選舉 — 競選期間</h4>`;
                html += `<div class="election-info">剩餘 ${election.campaignDaysLeft} 天競選期</div>`;
                election.candidates.forEach(c => {
                    html += `<div class="election-candidate" data-action="select-agent" data-val="${c.agentId}">
                        <div class="candidate-header">
                            <span class="candidate-name">${c.name}</span>
                            <span class="candidate-policy">${c.policyIcon} ${c.policyLabel}</span>
                        </div>
                        <div class="candidate-speech">"${c.speech}"</div>
                    </div>`;
                });
            } else if (election.phase === 'voting') {
                html += `<h4>🗳️ 鎮長選舉 — 投票進行中</h4>`;
                html += `<div class="election-info">剩餘 ${election.votingDaysLeft} 天投票</div>`;
                const playerVoted = this.world.election?._playerVoted;
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    html += `<div class="election-candidate">
                        <div class="candidate-header">
                            <span class="candidate-name">${c.name}</span>
                            <span class="candidate-policy">${c.policyIcon} ${c.policyLabel}</span>
                            <span class="candidate-votes">${c.votes} 票（${pct}%）</span>
                        </div>
                        <div class="election-bar"><div class="election-bar-fill" style="width:${pct}%"></div></div>
                        ${!playerVoted ? `<button class="btn-vote" data-action="player-vote" data-val="${c.agentId}">投票給${c.name}</button>` : ''}
                    </div>`;
                });
                html += `<div class="election-total">已投票：${totalVotes} 人${playerVoted ? ' (你已投票)' : ''}</div>`;
            } else if (election.phase === 'results') {
                const winner = election.candidates[0];
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                html += `<h4>🏆 選舉結果</h4>`;
                if (winner) {
                    html += `<div class="election-winner">
                        <div class="winner-name">${winner.name} 當選鎮長！</div>
                        <div class="winner-policy">施政方針：${winner.policyIcon} ${winner.policyLabel}</div>
                    </div>`;
                }
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    const isWinner = c === election.candidates[0];
                    html += `<div class="election-candidate ${isWinner ? 'election-winner-card' : ''}">
                        <span class="candidate-name">${isWinner ? '👑 ' : ''}${c.name}</span>
                        <span class="candidate-policy">${c.policyIcon}</span>
                        <span class="candidate-votes">${c.votes} 票（${pct}%）</span>
                        <div class="election-bar"><div class="election-bar-fill ${isWinner ? 'winner' : ''}" style="width:${pct}%"></div></div>
                    </div>`;
                });
            }
            html += '</div>';
        }
        // Election history
        if (election?.electionHistory?.length && !election.active) {
            const last = election.electionHistory[election.electionHistory.length - 1];
            html += `<div class="election-history-brief">
                <span>上次選舉：${last.winner.name} 當選（${last.winner.policyIcon || ''}${ELECTION_POLICIES_LABELS[last.winner.policy] || last.winner.policy}，${last.winner.votes}/${last.totalVotes} 票）</span>
            </div>`;
        }

        // --- News Bulletins ---
        const news = this.state.news || {};
        const bulletins = news.bulletins || [];
        if (bulletins.length) {
            html += '<div class="news-section"><h4>📰 新聞公告</h4><div class="news-ticker">';
            const CATEGORY_LABELS = {security:'安全',trade:'貿易',weather:'天氣',social:'社會',health:'健康',discovery:'發現',nature:'自然',political:'政治'};
            bulletins.forEach(b => {
                const severityIcon = {good:'🟢',info:'🔵',warning:'🟡',danger:'🔴'}[b.severity] || '⚪';
                const categoryIcon = {security:'🛡️',trade:'📦',weather:'🌤️',social:'👥',health:'🏥',discovery:'🔍',nature:'🌿',political:'⚔️'}[b.category] || '📋';
                const modKeys = Object.entries(news.active_modifiers || {}).filter(([k]) => {
                    return b.days_remaining > 0;
                });
                html += `<div class="news-bulletin severity-${b.severity}">
                    <div class="news-header">
                        <span class="news-severity">${severityIcon}</span>
                        <span class="news-category">${categoryIcon} ${CATEGORY_LABELS[b.category]||b.category}</span>
                        <span class="news-duration">剩餘${b.days_remaining}天</span>
                    </div>
                    <div class="news-headline">${b.headline}</div>
                    <div class="news-headline-en">${b.headline_en}</div>
                    <div class="news-flavor">${b.flavor}</div>
                    <div class="news-time">${b.published_time}</div>
                </div>`;
            });
            html += '</div>';
            // Active modifier effects summary
            const mods = news.active_modifiers || {};
            const modEntries = Object.entries(mods).filter(([k]) => k !== 'mood_modifier');
            if (modEntries.length) {
                html += '<div class="news-effects"><span class="news-effects-label">生效中：</span> ';
                modEntries.forEach(([key, val]) => {
                    const label = key.replace(/_/g,' ');
                    const cls = (typeof val === 'number' && val > 0) ? 'effect-positive' : (typeof val === 'number' && val < 0) ? 'effect-negative' : 'effect-neutral';
                    const display = typeof val === 'number' ? (val > 0 ? '+' : '') + Math.round(val*100) + '%' : (val ? 'Yes' : 'No');
                    html += `<span class="news-effect ${cls}">${label}: ${display}</span> `;
                });
                html += '</div>';
            }
            html += '</div>';
        }

        const chains = this.state.active_chains || [];
        if (chains.length) {
            html += '<div class="chain-section"><h4>進行中的事件鏈</h4>';
            chains.forEach(c => { html += `<div>${c.current_event}（階段 ${c.stage}/${c.total_stages}）</div>`; });
            html += '</div>';
        }
        const travelling = this.state.travelling_agents || [];
        if (travelling.length) {
            html += '<div class="travelling-section"><h4>外出中的居民</h4>';
            travelling.forEach(t => { html += `<div class="travelling-item">${t.name} — ${t.reason}</div>`; });
            html += '</div>';
        }
        const events = (this.state.recent_events || []).slice().reverse();
        events.forEach(evt => {
            const typeBadge = evt.event_type && evt.event_type !== 'random'
                ? `<span class="event-type-badge type-${evt.event_type}">${evt.event_type}</span>` : '';
            html += `<div class="event-card severity-${evt.severity}">
                <div style="font-weight:bold">${evt.name}${typeBadge}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${evt.time}</div>
                <div style="margin-top:4px">${evt.description}</div></div>`;
        });
        // === Festivals ===
        const festivals = this.state.festivals || {};
        if (festivals.activeFestival) {
            const f = festivals.activeFestival;
            html += `<div class="festival-section"><h4>${f.icon} ${f.name}進行中！</h4>
                <div style="padding:4px 8px;color:var(--text-secondary)">${f.description}</div></div>`;
        }
        if (festivals.activeQuest) {
            const q = festivals.activeQuest;
            const pct = Math.round((q.progress / q.goal) * 100);
            html += `<div class="quest-section"><h4>🎯 節日任務：${q.name}</h4>
                <div style="padding:4px 8px">${q.desc}</div>
                <div class="quest-progress"><div class="quest-bar" style="width:${pct}%"></div><span>${pct}%</span></div></div>`;
        }

        // === Factions ===
        const factionData = this.state.factions || {};
        const factionList = Object.values(factionData.factions || {});
        if (factionList.length) {
            html += '<div class="faction-section"><h4>👥 派系 / 社交圈</h4>';
            factionList.forEach(f => {
                const memberNames = f.members.map(id => {
                    const a = this.state.agents[id];
                    return a ? a.name : '?';
                }).join('、');
                const cohesionCls = f.cohesion > 70 ? 'cohesion-high' : f.cohesion < 30 ? 'cohesion-low' : '';
                let relHtml = '';
                if (f.rivalFactionId) {
                    const rival = factionList.find(x => x.id === f.rivalFactionId);
                    if (rival) relHtml += `<span class="faction-rival">⚔️ 敵對：${rival.name}</span> `;
                }
                if (f.allyFactionId) {
                    const ally = factionList.find(x => x.id === f.allyFactionId);
                    if (ally) relHtml += `<span class="faction-ally">🤝 結盟：${ally.name}</span>`;
                }
                html += `<div class="faction-card">
                    <div class="faction-header">${f.icon} <strong>${f.name}</strong>
                        <span class="faction-cohesion ${cohesionCls}">團結度：${Math.round(f.cohesion)}</span></div>
                    <div class="faction-members">${memberNames}</div>
                    ${relHtml ? '<div class="faction-relations">' + relHtml + '</div>' : ''}</div>`;
            });
            html += '</div>';
        }

        // === Exploration ===
        const exploreData = this.state.exploration || {};
        const discovered = Object.entries(exploreData.discoveredZones || {});
        const expeditions = exploreData.activeExpeditions || [];
        if (discovered.length || expeditions.length) {
            html += '<div class="explore-section"><h4>🗺️ 探索區域</h4>';
            if (expeditions.length) {
                html += '<div class="expedition-active"><strong>進行中的探險：</strong>';
                expeditions.forEach(e => {
                    const ticksLeft = Math.max(0, e.returnTick - (this.state.tick || 0));
                    const daysLeft = Math.ceil(ticksLeft / 96);
                    html += `<div class="expedition-item">${e.zoneIcon} ${e.zoneName} — ${e.agentNames.join('、')} (${daysLeft}天後返回)</div>`;
                });
                html += '</div>';
            }
            discovered.forEach(([zoneId, info]) => {
                const zoneDef = this._getExplorationZone(zoneId);
                if (!zoneDef) return;
                const canSend = !expeditions.some(e => e.zoneId === zoneId);
                const availableNpcs = Object.entries(this.state.agents)
                    .filter(([id, a]) => !a.is_player && a.activity_label !== '探險中' && id !== 'player')
                    .slice(0, 8);
                html += `<div class="explore-zone">
                    <div class="zone-header">${zoneDef.icon} <strong>${zoneDef.name}</strong>
                        <span class="zone-diff">難度：${'⭐'.repeat(zoneDef.difficulty)}</span></div>
                    <div class="zone-desc">${zoneDef.description}</div>
                    <div class="zone-stats">已探索 ${info.timesExplored} 次</div>
                    ${canSend ? `<div class="zone-send">
                        <select class="explore-select" id="explore-select-${zoneId}" multiple size="3">
                            ${availableNpcs.map(([id, a]) => `<option value="${id}">${a.name} (${a.job?.title||'無'})</option>`).join('')}
                        </select>
                        <button class="explore-btn" data-action="send-expedition" data-val="${zoneId}">派遣探險</button>
                    </div>` : '<div class="zone-busy">探險進行中...</div>'}
                </div>`;
            });
            html += '</div>';
        }

        // === Graveyard ===
        const lifecycle = this.state.lifecycle || {};
        const graveyard = lifecycle.graveyard || [];
        const births = lifecycle.births || [];
        if (graveyard.length || births.length) {
            html += '<div class="lifecycle-section">';
            if (births.length) {
                html += '<h4>🎒 近期出生</h4>';
                births.slice(-5).reverse().forEach(b => {
                    html += `<div class="birth-item">${b.name} — ${b.parentNames.join('與')}的孩子 <span class="birth-time">${b.birthTime}</span></div>`;
                });
            }
            if (graveyard.length) {
                html += '<h4>⚰️ 墓園</h4>';
                graveyard.slice(-10).reverse().forEach(g => {
                    html += `<div class="grave-item">
                        <div class="grave-name">${g.name}（${g.age}歲）</div>
                        <div class="grave-info">${g.job} — ${g.deathCause}</div>
                        <div class="grave-epitaph">${g.epitaph}</div>
                        <div class="grave-time">${g.deathTime}</div></div>`;
                });
            }
            html += '</div>';
        }

        container.innerHTML = html || '<p class="muted-text" style="padding:20px">尚無事件。事件每天會隨機發生。</p>';
    }

    _getExplorationZone(id) {
        const zones = {
            deep_forest: { icon:'🌲', name:'幽深森林', difficulty:2, description:'城鎮外的茂密森林，傳說中有稀有草藥和野生動物。' },
            ancient_ruins: { icon:'🏛️', name:'古代遺跡', difficulty:4, description:'神秘的古代建築遺址，可能藏有珍貴的知識和寶物。' },
            abandoned_mine: { icon:'⛏️', name:'廢棄礦坑', difficulty:3, description:'一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。' },
            mountain_pass: { icon:'⛰️', name:'山間隘口', difficulty:5, description:'通往外界的危險山路，但可能找到貿易路線和珍稀資源。' },
            riverside_cave: { icon:'🕳️', name:'河畔洞窟', difficulty:2, description:'河邊的一個神秘洞穴，經常有奇怪的回音。' },
            cursed_swamp: { icon:'🌿', name:'詛咒沼澤', difficulty:4, description:'傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。' },
        };
        return zones[id] || null;
    }

    // --- Economy Tab ---
    renderEconomy(container) {
        if (!this.state) return;
        const sp = this.state.stockpile || {};
        const res = sp.resources || {};
        const buildings = this.state.buildings || {};
        const trade = this.state.trade || {};
        const research = this.state.research || {};

        // Resource icons
        const icons = {food:'🌾',wood:'🪵',stone:'🪨',metal:'⚙️',cloth:'🧵',herbs:'🌿',silver:'💰',meals:'🍲',tools:'🔧',clothing:'👕',medicine:'💊',furniture:'🪑',research_points:'📚'};
        const labels = {food:'食物',wood:'木材',stone:'石材',metal:'金屬',cloth:'布料',herbs:'草藥',silver:'銀幣',meals:'餐食',tools:'工具',clothing:'衣物',medicine:'藥品',furniture:'家具',research_points:'研究'};

        let html = '<div class="economy-panel">';

        // Resources
        html += '<div class="econ-section"><h3>資源</h3><div class="resource-grid">';
        for (const [r, amount] of Object.entries(res)) {
            const icon = icons[r] || '📦';
            const label = labels[r] || r;
            const cls = amount < 10 ? 'res-low' : amount > 100 ? 'res-high' : '';
            html += `<div class="resource-item ${cls}"><span class="res-icon">${icon}</span><span class="res-label">${label}</span><span class="res-amount">${Math.round(amount)}</span></div>`;
        }
        html += '</div></div>';

        // Trade
        html += '<div class="econ-section"><h3>交易</h3>';
        if (trade.merchant) {
            html += `<div class="merchant-card"><div class="merchant-name">${trade.merchant.name}</div>
                <div class="merchant-info">專長：${trade.merchant.specialty} | ${trade.merchant.daysRemaining}天後離開</div>
                <div class="trade-offers">`;
            trade.merchant.offers.forEach((offer, idx) => {
                const icon = icons[offer.resource] || '📦';
                const resLabel = labels[offer.resource] || offer.resource;
                const action = offer.isBuying ? '賣出' : '買入';
                const actionCls = offer.isBuying ? 'trade-sell' : 'trade-buy';
                html += `<div class="trade-offer ${actionCls}">
                    <span>${icon} ${resLabel}</span>
                    <span>×${Math.round(offer.amount)}</span>
                    <span>${offer.price}/個</span>
                    <button class="trade-btn" data-action="trade" data-val="${idx},${Math.min(5, offer.amount)}">${action}5</button>
                    <button class="trade-btn" data-action="trade" data-val="${idx},${offer.amount}">全${action}</button></div>`;
            });
            html += '</div></div>';
        } else {
            html += `<p class="muted-text">鎮上沒有商人，可能很快就會來一位。</p>`;
        }
        html += '</div>';

        // Buildings
        html += '<div class="econ-section"><h3>建築</h3>';
        if (buildings.in_progress?.length) {
            html += '<div class="building-progress">';
            buildings.in_progress.forEach(p => {
                const pct = Math.round((p.workDone / p.workRequired) * 100);
                html += `<div class="building-item"><span>${p.name}</span>
                    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span></div>`;
            });
            html += '</div>';
        }
        if (buildings.completed?.length) {
            html += `<div class="completed-buildings">已完成：${buildings.completed.map(p => p.name).join('、')}</div>`;
        }
        const available = this.world.buildings.getAvailable(this.world);
        if (available.length) {
            html += '<div class="available-buildings"><div class="build-label">建造：</div>';
            available.forEach(p => {
                const costStr = Object.entries(p.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                html += `<div class="build-option ${p.can_afford ? '' : 'cant-afford'}">
                    <div class="build-name">${p.name}</div>
                    <div class="build-desc">${p.description}</div>
                    <div class="build-cost">${costStr}</div>
                    <button class="build-btn" ${p.can_afford ? '' : 'disabled'} data-action="build" data-val="${p.key}">建造</button></div>`;
            });
            html += '</div>';
        }
        html += '</div>';

        // Research
        html += '<div class="econ-section"><h3>研究</h3>';
        const projects = research.projects || {};
        const currentKey = research.current_research;
        if (currentKey && projects[currentKey]) {
            const cur = projects[currentKey];
            const pct = Math.round((cur.progress / cur.cost) * 100);
            html += `<div class="research-current">研究中：<strong>${cur.name}</strong>
                <div class="progress-bar"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>
                <span class="progress-text">${pct}%</span></div>`;
        }
        const availableResearch = Object.values(projects).filter(p => p.status === 'available');
        if (availableResearch.length) {
            html += '<div class="research-available"><div class="build-label">可研究：</div>';
            availableResearch.forEach(p => {
                const isCurrent = p.key === currentKey;
                html += `<div class="research-option ${isCurrent ? 'active' : ''}">
                    <div class="build-name">${p.name}</div>
                    <div class="build-desc">${p.description}（消耗：${p.cost}）</div>
                    <button class="build-btn" data-action="research" data-val="${p.key}" ${isCurrent?'disabled':''}>研究</button></div>`;
            });
            html += '</div>';
        }
        const completedResearch = Object.values(projects).filter(p => p.status === 'complete');
        if (completedResearch.length) {
            html += `<div class="completed-buildings">已完成：${completedResearch.map(p => p.name).join('、')}</div>`;
        }
        html += '</div></div>';

        container.innerHTML = html;
    }

    executeTrade(offerIdx, qty) {
        const result = this.world.trade.executeTrade(offerIdx, qty, this.world);
        if (result.error) console.warn('Trade failed:', result.error);
        this.state = this.world.getState();
        this.renderSidebar();
    }

    startBuilding(key) {
        this.world.buildings.startProject(key, this.world);
        this.state = this.world.getState();
        this.renderSidebar();
    }

    startResearch(key) {
        this.world.research.startResearch(key);
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _renderAgentFactions(agentId) {
        const factionData = this.state?.factions || {};
        const factions = Object.values(factionData.factions || {}).filter(f => f.members.includes(agentId));
        if (!factions.length) return '';
        let html = '<div class="detail-section"><h3>社交圈</h3>';
        factions.forEach(f => {
            const others = f.members.filter(id => id !== agentId).map(id => {
                const a = this.state.agents[id]; return a ? a.name : '?';
            }).join('、');
            html += `<div class="faction-mini">${f.icon} <strong>${f.name}</strong> <span style="font-size:0.7rem;color:var(--text-secondary)">同伴：${others}</span></div>`;
        });
        html += '</div>';
        return html;
    }

    sendExpedition(zoneId) {
        const selectEl = document.getElementById(`explore-select-${zoneId}`);
        if (!selectEl) return;
        const selectedIds = Array.from(selectEl.selectedOptions).map(o => o.value);
        if (selectedIds.length === 0) { alert('請選擇至少一名居民！'); return; }
        const result = this.world.exploration.sendExpedition(this.world, zoneId, selectedIds);
        if (!result) { alert('無法派遣探險隊。'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    selectAgent(agentId) {
        this.selectedAgent = agentId;
        this.activeTab = 'detail';
        document.querySelectorAll('.rt-sidebar-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'detail'));
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.add('mobile-expanded');
        this.render();
    }
}

// Initialize — only when the game container exists (WordPress shortcode loaded)
(function() {
    const init = () => {
        if (!document.getElementById('rimtown-app') && !document.getElementById('town-map-canvas')) return;
        const app = new RimTownApp();
        window.addEventListener('resize', () => { if (app.state) app.renderMap(); });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
