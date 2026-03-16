// RimTown - Frontend App (WordPress Plugin) v3.6.14
const RIMTOWN_APP_VERSION = '3.6.14';
const ELECTION_POLICIES_LABELS = {economy:t('經濟發展'),welfare:t('社會福利'),defense:t('軍事防禦'),culture:t('文化教育'),nature:t('自然保育'),freedom:t('個人自由')};

// =====================================================
// Achievement Definitions (99 achievements)
// =====================================================
const ACHIEVEMENTS = {
    // === Social (13) ===
    first_chat: { name: t('初次對話'), desc: t('第一次與居民聊天'), icon: '💬', category: 'social' },
    chat_10: { name: t('話癆'), desc: t('與居民聊天10次'), icon: '🗣️', category: 'social' },
    chat_50: { name: t('社交達人'), desc: t('與居民聊天50次'), icon: '🎙️', category: 'social' },
    chat_100: { name: t('聊天之王'), desc: t('與居民聊天100次'), icon: '👄', category: 'social' },
    chat_all_npcs: { name: t('全民好友'), desc: t('與每位居民都聊過天'), icon: '🤝', category: 'social' },
    high_affinity: { name: t('知己'), desc: t('與任一居民好感度達到80'), icon: '🫂', category: 'social' },
    enemy_made: { name: t('結怨'), desc: t('與任一居民好感度低於-50'), icon: '😤', category: 'social' },
    first_faction: { name: t('結黨'), desc: t('加入第一個社交圈'), icon: '👥', category: 'social' },
    faction_3: { name: t('社交蝴蝶'), desc: t('城鎮出現3個以上派系'), icon: '🦋', category: 'social' },
    faction_drama: { name: t('戲劇性'), desc: t('見證派系衝突'), icon: '🎭', category: 'social' },
    npc_fight: { name: t('暴力事件'), desc: t('目擊 NPC 打架住院'), icon: '🤕', category: 'social' },
    npc_cheating: { name: t('八點檔'), desc: t('目擊劈腿被抓事件'), icon: '😱', category: 'social' },
    npc_breakup: { name: t('分手見證人'), desc: t('目擊一對情侶分手'), icon: '💢', category: 'social' },
    // === Romance (10) ===
    first_crush: { name: t('心動'), desc: t('有人對你產生好感'), icon: '💗', category: 'romance' },
    first_dating: { name: t('初戀'), desc: t('開始與某人交往'), icon: '💕', category: 'romance' },
    first_marriage: { name: t('白頭偕老'), desc: t('與某人結婚'), icon: '💍', category: 'romance' },
    heartbreaker: { name: t('渣男/渣女'), desc: t('與3個以上的人交往過'), icon: '💔', category: 'romance' },
    npc_wedding: { name: t('婚禮祝福'), desc: t('見證一對NPC結婚'), icon: '💒', category: 'romance' },
    npc_couple_5: { name: t('月老'), desc: t('城鎮中同時有5對情侶'), icon: '🏹', category: 'romance' },
    rejected: { name: t('心碎'), desc: t('求婚被拒絕'), icon: '😢', category: 'romance' },
    flirt_master: { name: t('調情高手'), desc: t('成功調情5次'), icon: '😘', category: 'romance' },
    golden_couple: { name: t('模範夫妻'), desc: t('結婚後好感度維持90以上'), icon: '👫', category: 'romance' },
    // === Economy (24) ===
    first_trade: { name: t('商人初體驗'), desc: t('完成第一筆交易'), icon: '💰', category: 'economy' },
    trade_50: { name: t('交易老手'), desc: t('完成50筆交易'), icon: '💳', category: 'economy' },
    rich: { name: t('富甲一方'), desc: t('銀幣超過500'), icon: '🤑', category: 'economy' },
    ultra_rich: { name: t('富可敵國'), desc: t('銀幣超過2000'), icon: '💎', category: 'economy' },
    builder: { name: t('建設者'), desc: t('建造第一棟建築'), icon: '🏗️', category: 'economy' },
    master_builder: { name: t('建築大師'), desc: t('建造5棟建築'), icon: '🏰', category: 'economy' },
    all_buildings: { name: t('鎮之完善'), desc: t('建造所有建築'), icon: '🌆', category: 'economy' },
    first_research: { name: t('學者'), desc: t('完成第一項研究'), icon: '📚', category: 'economy' },
    research_5: { name: t('博學多才'), desc: t('完成5項研究'), icon: '🎓', category: 'economy' },
    all_research: { name: t('科技先驅'), desc: t('完成所有研究'), icon: '🔬', category: 'economy' },
    first_industry: { name: t('創業家'), desc: t('開啟第一個產業'), icon: '🏭', category: 'economy' },
    industry_lv3: { name: t('產業升級'), desc: t('任一產業升到 Lv3'), icon: '⚒️', category: 'economy' },
    industry_lv5: { name: t('產業帝國'), desc: t('任一產業升到 Lv5'), icon: '👑', category: 'economy' },
    two_industries: { name: t('雙線發展'), desc: t('同時擁有兩個產業'), icon: '🔀', category: 'economy' },
    four_industries: { name: t('完全體'), desc: t('解鎖全部四大產業'), icon: '🌟', category: 'economy' },
    first_harvest: { name: t('初次收穫'), desc: t('第一次收穫農作物'), icon: '🌾', category: 'economy' },
    harvest_100: { name: t('豐收之王'), desc: t('累計收穫 100 單位作物'), icon: '🌽', category: 'economy' },
    harvest_500: { name: t('農業大亨'), desc: t('累計收穫 500 單位作物'), icon: '🚜', category: 'economy' },
    excellent_crop: { name: t('極品農產'), desc: t('收穫極品品質作物'), icon: '✨', category: 'economy' },
    first_factory: { name: t('工廠主'), desc: t('建造第一座工廠'), icon: '🏭', category: 'economy' },
    factory_order: { name: t('訂單達人'), desc: t('完成第一筆工廠訂單'), icon: '📋', category: 'economy' },
    factory_order_10: { name: t('量產專家'), desc: t('完成10筆工廠訂單'), icon: '📦', category: 'economy' },
    resource_hoarder: { name: t('囤積狂'), desc: t('任一資源超過200單位'), icon: '🏪', category: 'economy' },
    // === Survival (12) ===
    survive_7: { name: t('一週生存'), desc: t('存活7天'), icon: '📅', category: 'survival' },
    survive_30: { name: t('月生存者'), desc: t('存活30天'), icon: '🗓️', category: 'survival' },
    survive_100: { name: t('百日英雄'), desc: t('存活100天'), icon: '🏆', category: 'survival' },
    survive_year: { name: t('週年慶'), desc: t('存活一整年'), icon: '🎉', category: 'survival' },
    survive_3years: { name: t('老居民'), desc: t('存活三年'), icon: '🧓', category: 'survival' },
    repel_raid: { name: t('防衛者'), desc: t('擊退第一次入侵'), icon: '⚔️', category: 'survival' },
    repel_5: { name: t('常勝將軍'), desc: t('擊退5次入侵'), icon: '🎖️', category: 'survival' },
    repel_10: { name: t('鐵壁防線'), desc: t('擊退10次入侵'), icon: '🛡️', category: 'survival' },
    first_explore: { name: t('探險家'), desc: t('發現第一個探索區域'), icon: '🗺️', category: 'survival' },
    explore_all: { name: t('全境探索'), desc: t('發現所有探索區域'), icon: '🧭', category: 'survival' },
    expedition_success: { name: t('凱旋歸來'), desc: t('完成第一次成功探險'), icon: '🏆', category: 'survival' },
    // === Town (14) ===
    pop_15: { name: t('小鎮風光'), desc: t('人口達到15'), icon: '🏘️', category: 'town' },
    pop_20: { name: t('繁榮市鎮'), desc: t('人口達到20'), icon: '🌇', category: 'town' },
    pop_25: { name: t('邊境都市'), desc: t('人口達到25'), icon: '🌃', category: 'town' },
    pop_30: { name: t('人口爆發'), desc: t('人口達到30'), icon: '🏙️', category: 'town' },
    pop_40: { name: t('大都會'), desc: t('人口達到40'), icon: '🌐', category: 'town' },
    first_election: { name: t('民主初體驗'), desc: t('參與第一次選舉'), icon: '🗳️', category: 'town' },
    elected_mayor: { name: t('當選鎮長'), desc: t('玩家當選鎮長'), icon: '👑', category: 'town' },
    election_3: { name: t('政壇老手'), desc: t('經歷3次選舉'), icon: '🏛️', category: 'town' },
    first_birth: { name: t('新生命'), desc: t('城鎮迎來第一個新生兒'), icon: '👶', category: 'town' },
    births_5: { name: t('嬰兒潮'), desc: t('累計5個新生兒出生'), icon: '🍼', category: 'town' },
    first_death: { name: t('永別'), desc: t('失去第一位居民'), icon: '⚰️', category: 'town' },
    town_lv3: { name: t('村莊崛起'), desc: t('城鎮升級到村莊'), icon: '🏘️', category: 'town' },
    town_lv5: { name: t('城鎮繁榮'), desc: t('城鎮升級到城鎮'), icon: '🏙️', category: 'town' },
    town_lv7: { name: t('大都市'), desc: t('城鎮升級到城市'), icon: '🌆', category: 'town' },
    // === Player (12) ===
    got_job: { name: t('打工仔'), desc: t('選擇一份工作'), icon: '💼', category: 'player' },
    job_master: { name: t('職業達人'), desc: t('做過3種不同工作'), icon: '🎯', category: 'player' },
    job_all: { name: t('全職通'), desc: t('做過所有種類的工作'), icon: '🏅', category: 'player' },
    voted: { name: t('公民責任'), desc: t('在選舉中投票'), icon: '✅', category: 'player' },
    proposed: { name: t('求婚'), desc: t('向某人求婚'), icon: '💎', category: 'player' },
    player_farmer: { name: t('自耕農'), desc: t('親手種植並收穫一次作物'), icon: '🧑‍🌾', category: 'player' },
    player_trader: { name: t('商賈'), desc: t('累計交易額達到1000銀幣'), icon: '🪙', category: 'player' },
    player_explorer: { name: t('冒險王'), desc: t('完成3次成功探險'), icon: '⛰️', category: 'player' },
    speed_runner: { name: t('速通玩家'), desc: t('在30天內建造5棟建築'), icon: '⚡', category: 'player' },
    pacifist: { name: t('和平主義者'), desc: t('存活30天且零衝突事件'), icon: '☮️', category: 'player' },
    save_collector: { name: t('存檔狂'), desc: t('儲存遊戲10次以上'), icon: '💾', category: 'player' },
    multi_town: { name: t('開拓者'), desc: t('擁有3個以上城鎮'), icon: '🗺️', category: 'player' },
    // === Special (14) ===
    night_owl: { name: t('夜貓子'), desc: t('在深夜（0-4點）仍在活動'), icon: '🦉', category: 'special' },
    early_bird: { name: t('早起的鳥'), desc: t('在清晨（5-6點）開始活動'), icon: '🐓', category: 'special' },
    gossip_heard: { name: t('八卦通'), desc: t('聽到10則村民對話'), icon: '👂', category: 'special' },
    gossip_50: { name: t('偷聽大師'), desc: t('聽到50則村民對話'), icon: '🕵️', category: 'special' },
    gossip_200: { name: t('情報局長'), desc: t('聽到200則村民對話'), icon: '📡', category: 'special' },
    all_seasons: { name: t('四季輪轉'), desc: t('經歷春夏秋冬'), icon: '🌸', category: 'special' },
    first_festival: { name: t('節慶參與'), desc: t('經歷第一個節日'), icon: '🎪', category: 'special' },
    all_festivals: { name: t('四季慶典'), desc: t('經歷所有四個節日'), icon: '🎊', category: 'special' },
    festival_5: { name: t('慶典常客'), desc: t('累計經歷5次節慶'), icon: '🥳', category: 'special' },
    read_newspaper: { name: t('讀報人'), desc: t('閱讀第一篇 AI 日報'), icon: '📰', category: 'special' },
    newspaper_10: { name: t('日報收藏家'), desc: t('累計 10 篇日報'), icon: '📚', category: 'special' },
    newspaper_30: { name: t('媒體狂熱'), desc: t('累計 30 篇日報'), icon: '🗞️', category: 'special' },
    cloud_sync: { name: t('雲端玩家'), desc: t('首次使用雲端同步'), icon: '☁️', category: 'special' },
    prosperity_max: { name: t('傳奇小鎮'), desc: t('繁榮度達到「傳奇」等級'), icon: '⭐', category: 'special' },
    achievement_25: { name: t('成就獵人'), desc: t('解鎖25個成就'), icon: '🏅', category: 'special' },
    achievement_50: { name: t('成就大師'), desc: t('解鎖50個成就'), icon: '🥇', category: 'special' },
    achievement_99: { name: t('完美主義者'), desc: t('解鎖全部99個成就'), icon: '💯', category: 'special' },
    // === Legacy (3) ===
    first_child: { name: t('為人父母'), desc: t('生下第一個孩子'), icon: '👶', category: 'legacy' },
    new_game_plus: { name: t('二周目'), desc: t('開始第二代的旅程'), icon: '🔄', category: 'legacy' },
    generation_3: { name: t('三代傳承'), desc: t('進入第三代'), icon: '👑', category: 'legacy' },
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
        const isPublic = ['login', 'register', 'reset-password', 'me'].includes(endpoint);
        const headers = { 'Content-Type': 'application/json' };
        if (!isPublic && this._nonce) headers['X-WP-Nonce'] = this._nonce;
        const opts = {
            method,
            headers,
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
        if (data.nonce) this._nonce = data.nonce;
        this.loggedIn = true;
        this.username = data.user.username;
        this.userId = data.user.id;
        return data;
    }

    async login(username, password) {
        const data = await this._fetch('login', 'POST', { username, password });
        if (data.nonce) this._nonce = data.nonce;
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
        this._chatUnread = new Set();
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
        this._flirtCount = 0;
        this._datingHistory = new Set();
        this.init();
    }

    async init() {
        this.setupEventDelegation();
        await this.loadSettings();
        // Try to load saved game
        let loaded = false;
        if (this.auth.loggedIn) {
            // When logged in, only load from cloud — skip local saves
            try {
                const saves = await this.auth.listSaves();
                if (saves.length > 0) {
                    const cloudMatch = saves[0];
                    const saveData = await this.auth.cloudLoad(cloudMatch.town_id);
                    if (saveData && this.world.loadSave(saveData)) {
                        this.currentTownId = cloudMatch.town_id;
                        this._cloudSaves = saves;
                        loaded = true;
                        console.log('[RimTown] Loaded from cloud on init:', cloudMatch.town_name);
                    }
                }
            } catch (e) {
                console.error('[RimTown] Cloud load on init failed:', e);
            }
            if (!loaded) {
                this.world.reset();
                this.currentTownId = this._generateTownId(t('邊境鎮'));
            }
        } else {
            // Not logged in — use local saves
            const lastTownId = localStorage.getItem('rimtown_last_town');
            if (lastTownId) {
                loaded = this._loadTownById(lastTownId);
            }
            if (!loaded) {
                const legacyLoaded = await this.tryLoadGame();
                if (legacyLoaded) {
                    this.currentTownId = this._generateTownId(t('邊境鎮'));
                    this._saveCurrentTown(t('邊境鎮'));
                } else {
                    this.world.reset();
                    this.currentTownId = this._generateTownId(t('邊境鎮'));
                    this._saveCurrentTown(t('邊境鎮'));
                }
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
        this.setupMobileInputFix();
        this.setupMobileHeader();
        this.setupControlListeners();
        this.setupSettingsListeners();
        this.setupAuthListeners();
        this.setupTutorial();
        this._updateAccountButton();
        this._loadAchievementsFromCloud();
        // Cloud data is already loaded in init() when logged in, no need to sync again
        this.startSimulation();
        this.setupAutoSave();
        // Update header town name from saved metadata
        const currentMeta = this._getTownList().find(t => t.id === this.currentTownId);
        this._updateHeaderTownName(currentMeta?.name);
        this.render();
        this._startRenderLoop();
        // Show version in header
        const verEl = document.getElementById('version-display');
        if (verEl && !verEl.textContent) verEl.textContent = 'v' + RIMTOWN_APP_VERSION;
        this._startAchievementChecker();
        // Show quest guidance for returning players (tutorial already done)
        if (localStorage.getItem('rimtown_tutorial_done')) {
            setTimeout(() => this._updateQuestGuidance(), 2000);
        }
        // Auto-show login modal if not logged in
        if (!this.auth.loggedIn) {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.classList.remove('hidden');
                // Hide close button so user must login/register
                const closeBtn = authModal.querySelector('.auth-close-btn');
                if (closeBtn) closeBtn.style.display = 'none';
            }
        }
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
                    const authModal = document.getElementById('auth-modal');
                    if (authModal) {
                        authModal.classList.remove('hidden');
                        // Show close button when manually opened
                        const closeBtn = authModal.querySelector('.auth-close-btn');
                        if (closeBtn) closeBtn.style.display = '';
                    }
                }
            });
        }

        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.authTab === 'login';
                document.getElementById('auth-login-form')?.classList.toggle('hidden', !isLogin);
                document.getElementById('auth-register-form')?.classList.toggle('hidden', isLogin);
                document.getElementById('auth-reset-form')?.classList.add('hidden');
            });
        });

        // Close buttons
        document.querySelectorAll('.auth-close-btn').forEach(btn => {
            btn.addEventListener('click', () => this._closeAuthModal());
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
            document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.remove('active'));
        });
        document.getElementById('auth-reset-back')?.addEventListener('click', () => {
            document.getElementById('auth-reset-form')?.classList.add('hidden');
            document.getElementById('auth-login-form')?.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(_tw => {
                _tw.classList.toggle('active', _tw.dataset.authTab === 'login');
            });
        });
        document.getElementById('auth-reset-btn')?.addEventListener('click', () => this._doResetPassword());
        document.getElementById('auth-reset-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doResetPassword(); });
    }

    async _doLogin() {
        const user = document.getElementById('auth-login-user')?.value?.trim();
        const pass = document.getElementById('auth-login-pass')?.value;
        const errEl = document.getElementById('auth-login-error');
        if (!user || !pass) { if (errEl) errEl.textContent = t('請輸入帳號和密碼'); return; }
        try {
            if (errEl) errEl.textContent = t('登入中...');
            await this.auth.login(user, pass);
            this._closeAuthModal();
            this._updateAccountButton();
            this.world.logMessage('system', `${t('歡迎回來，')}${this.auth.username}！`);
            this._syncFromCloud();
            // Show tutorial for new players after login
            if (!localStorage.getItem('rimtown_tutorial_done')) {
                this.setupTutorial();
            }
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('登入失敗');
        }
    }

    // Close auth modal and reset mobile viewport zoom
    _closeAuthModal() {
        // Blur active input first to dismiss keyboard and prevent zoom stuck
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
        document.getElementById('auth-modal')?.classList.add('hidden');
        // Force viewport reset on mobile to fix zoom stuck after keyboard dismiss
        if (window.innerWidth <= 768) {
            window.scrollTo(0, 0);
            // Trigger resize recalculation for tilemap
            setTimeout(() => {
                if (this.tileMap) this.tileMap._needsResize = true;
                window.dispatchEvent(new Event('resize'));
            }, 100);
        }
    }

    // Custom game-style alert (replaces browser alert)
    _gameAlert(msg, icon = '⚠️') {
        return new Promise(resolve => {
            const dlg = document.getElementById('game-dialog');
            document.getElementById('game-dialog-icon').textContent = icon;
            document.getElementById('game-dialog-msg').textContent = msg;
            const btns = document.getElementById('game-dialog-buttons');
            btns.innerHTML = `<button class="game-dialog-ok">${t('確定')}</button>`;
            btns.querySelector('.game-dialog-ok').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve();
            });
            dlg.classList.remove('hidden');
        });
    }

    // Custom game-style confirm (replaces browser confirm)
    _gameConfirm(msg, icon = '❓') {
        return new Promise(resolve => {
            const dlg = document.getElementById('game-dialog');
            document.getElementById('game-dialog-icon').textContent = icon;
            document.getElementById('game-dialog-msg').textContent = msg;
            const btns = document.getElementById('game-dialog-buttons');
            btns.innerHTML = `<button class="game-dialog-cancel">${t('取消')}</button><button class="game-dialog-ok">${t('確定')}</button>`;
            btns.querySelector('.game-dialog-cancel').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve(false);
            });
            btns.querySelector('.game-dialog-ok').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve(true);
            });
            dlg.classList.remove('hidden');
        });
    }

    async _doRegister() {
        const user = document.getElementById('auth-reg-user')?.value?.trim();
        const email = document.getElementById('auth-reg-email')?.value?.trim();
        const pass = document.getElementById('auth-reg-pass')?.value;
        const pass2 = document.getElementById('auth-reg-pass2')?.value;
        const errEl = document.getElementById('auth-reg-error');
        if (!user || !pass) { if (errEl) errEl.textContent = t('請填寫帳號和密碼'); return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = t('兩次密碼不一致'); return; }
        try {
            if (errEl) errEl.textContent = t('註冊中...');
            await this.auth.register(user, pass, email);
            this._closeAuthModal();
            this._updateAccountButton();
            // New user gets a fresh world — clear all old local data
            const oldTowns = this._getTownList();
            oldTowns.forEach(_tw => {
                localStorage.removeItem('rimtown_town_' + _tw.id);
                localStorage.removeItem('rimtown_town_' + _tw.id + '_archives');
            });
            localStorage.removeItem('rimtown_town_list');
            localStorage.removeItem('rimtown_last_town');
            localStorage.removeItem('rimtown_achievements');
            localStorage.removeItem('rimtown_raid_count');
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
            const townName = `${user}${t('的邊境鎮')}`;
            this.currentTownId = this._generateTownId(townName);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            if (this.tileMap) this.tileMap.agentPositions = {};
            this._saveCurrentTown(townName);
            this.render();
            this._renderTownList();
            this.world.logMessage('system', `${t('註冊成功！歡迎，')}${this.auth.username}${t('！你的全新城鎮已建立。')}`);
            this._syncToCloud();
            // Show tutorial for new players after registration
            if (!localStorage.getItem('rimtown_tutorial_done')) {
                this.setupTutorial();
            }
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('註冊失敗');
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
        if (!user) { if (errEl) errEl.textContent = t('請輸入使用者名稱'); return; }
        if (!email) { if (errEl) errEl.textContent = t('請輸入註冊時的電子郵件'); return; }
        if (!pass || pass.length < 6) { if (errEl) errEl.textContent = t('新密碼至少6個字元'); return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = t('兩次密碼不一致'); return; }
        try {
            if (errEl) errEl.textContent = t('重設中...');
            const resp = await fetch(`${this.auth._restUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.auth._nonce },
                body: JSON.stringify({ username: user, email, new_password: pass }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || t('重設失敗'));
            if (errEl) errEl.textContent = '';
            if (successEl) successEl.textContent = t('密碼已重設！請用新密碼登入');
            setTimeout(() => {
                document.getElementById('auth-reset-form')?.classList.add('hidden');
                document.getElementById('auth-login-form')?.classList.remove('hidden');
                document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === 'login'));
                if (successEl) successEl.textContent = '';
            }, 2000);
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('重設失敗');
        }
    }

    // =====================================================
    // TUTORIAL — New player intro & story guide
    // =====================================================
    setupTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return;
        if (localStorage.getItem('rimtown_tutorial_done')) return;
        // Don't show tutorial when login screen is active
        if (!this.auth.loggedIn) return;
        overlay.classList.remove('hidden');
        this._tutorialStep = 0;
        const totalSteps = 5;
        const dotsEl = document.getElementById('tutorial-dots');
        if (dotsEl) {
            dotsEl.innerHTML = '';
            for (let i = 0; i < totalSteps; i++) {
                const dot = document.createElement('span');
                dot.className = 'tutorial-dot' + (i === 0 ? ' active' : '');
                dotsEl.appendChild(dot);
            }
        }
        const showStep = (step) => {
            this._tutorialStep = step;
            overlay.querySelectorAll('.tutorial-step').forEach(s => {
                s.classList.toggle('hidden', parseInt(s.dataset.step) !== step);
            });
            dotsEl?.querySelectorAll('.tutorial-dot').forEach((d, i) => {
                d.classList.toggle('active', i === step);
            });
            const prevBtn = document.getElementById('tutorial-prev');
            const nextBtn = document.getElementById('tutorial-next');
            if (prevBtn) prevBtn.classList.toggle('hidden', step === 0);
            if (nextBtn) {
                nextBtn.textContent = step === 0 ? t('開始旅程') : (step === totalSteps - 1 ? t('進入遊戲') : t('下一步'));
            }
        };
        document.getElementById('tutorial-next')?.addEventListener('click', () => {
            if (this._tutorialStep < totalSteps - 1) showStep(this._tutorialStep + 1);
            else this._dismissTutorial();
        });
        document.getElementById('tutorial-prev')?.addEventListener('click', () => {
            if (this._tutorialStep > 0) showStep(this._tutorialStep - 1);
        });
        document.getElementById('tutorial-skip')?.addEventListener('click', () => this._dismissTutorial());
        showStep(0);
    }

    _dismissTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return;
        localStorage.setItem('rimtown_tutorial_done', '1');
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
        // Show quest guidance after tutorial
        setTimeout(() => this._updateQuestGuidance(), 1000);
    }

    // === Quest Guidance System (post-tutorial contextual hints) ===
    _updateQuestGuidance() {
        const el = document.getElementById('quest-guidance');
        if (!el) return;
        // Don't show if user explicitly dismissed all guidance
        if (localStorage.getItem('rimtown_guidance_off')) { el.classList.add('hidden'); return; }

        const qs = this.world?.questSystem;
        if (!qs) return;
        qs.init();

        // Find current active quest
        const activeQuest = (typeof MAIN_QUESTS !== 'undefined' ? MAIN_QUESTS : []).find(q => qs.quests[q.id]?.status === 'active');
        if (!activeQuest) { el.classList.add('hidden'); return; }

        const questState = qs.quests[activeQuest.id];
        let icon = '📋';
        let title = activeQuest.title;
        let hint = '';

        // Generate contextual hint based on quest and game state
        const chatCount = qs.chatCount || 0;
        const player = this.world?.agents?.['player'];

        if (activeQuest.id === 'ch1_settle') {
            icon = '👋';
            const talked = Math.min(chatCount, 3);
            if (talked === 0) {
                hint = t('點擊右側「聊天」頁籤，選一位居民打個招呼吧！');
            } else if (talked < 3) {
                hint = `${t('已和 ')}${talked}${t('/3 位居民交談。繼續點擊居民聊天吧！')}`;
            } else {
                hint = t('快完成了！任務即將自動結算。');
            }
        } else if (activeQuest.id === 'ch1_survive') {
            icon = '❄️';
            hint = t('有多種方式過冬：囤物資、交朋友或蓋建築。點「任務」頁籤查看詳情。');
        } else if (activeQuest.id === 'ch1_industry') {
            icon = '🏭';
            hint = t('試試在「產業」頁籤開啟第一個產業，或和更多居民交流提升人脈。');
        } else if (activeQuest.chapter === 2) {
            icon = '🌱';
            hint = t('小鎮開始成長了！查看「任務」頁籤了解當前目標。');
        } else if (activeQuest.chapter === 3) {
            icon = '⚔️';
            hint = t('危機即將到來，做好準備！查看「任務」頁籤了解詳情。');
        } else {
            hint = activeQuest.description;
        }

        // If there are active side quests, mention them
        const activeSides = (typeof SIDE_QUESTS !== 'undefined' ? SIDE_QUESTS : [])
            .filter(sq => qs.sideQuests?.[sq.id]?.status === 'active');
        if (activeSides.length > 0) {
            hint += `${t(' | 📖 支線：')}${activeSides[0].title}`;
        }

        el.querySelector('.quest-guidance-icon').textContent = icon;
        el.querySelector('.quest-guidance-title').textContent = `${t('目前目標：')}${title}`;
        el.querySelector('.quest-guidance-hint').textContent = hint;
        el.classList.remove('hidden');

        // Wire up dismiss
        const dismissBtn = el.querySelector('.quest-guidance-dismiss');
        if (dismissBtn && !dismissBtn._wired) {
            dismissBtn._wired = true;
            dismissBtn.addEventListener('click', () => {
                el.classList.add('hidden');
                // Will re-show on next quest change, not permanently off
                this._guidanceDismissedQuestId = activeQuest.id;
            });
        }
        // Don't re-show if user dismissed this specific quest's guidance
        if (this._guidanceDismissedQuestId === activeQuest.id) {
            el.classList.add('hidden');
        }
    }

    _showAccountMenu() {
        const existing = document.getElementById('account-menu-popup');
        if (existing) { existing.remove(); return; }

        const popup = document.createElement('div');
        popup.id = 'account-menu-popup';
        popup.className = 'account-menu-popup';
        popup.innerHTML = `
            <div class="account-menu-header">${this._escapeHtml(this.auth.username)}</div>
            <button data-action="cloud-sync-up">${t('上傳存檔到雲端')}</button>
            <button data-action="cloud-sync-down">${t('從雲端下載存檔')}</button>
            <button data-action="show-achievements">${t('成就')}</button>
            <button data-action="auth-logout" class="btn-danger-text">${t('登出')}</button>
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
            btn.textContent = t('帳號');
            btn.className = 'btn-account';
        }
    }

    async _syncToCloud() {
        if (!this.auth.loggedIn) return;
        this._unlockAchievement('cloud_sync');
        try {
            const saveData = this.world.serialize();
            const clock = saveData.clock || {};
            await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                season: clock.season, year: clock.year, day: clock.day,
                population: Object.keys(saveData.agents || {}).length,
            });
            this.world.logMessage('system', t('已同步至雲端。'));
        } catch (e) {
            console.error('[RimTown] Cloud sync error:', e);
            this.world.logMessage('system', t('雲端同步失敗。'));
        }
    }

    async _syncFromCloud() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (saves.length === 0) {
                // No cloud data — upload current game state to cloud
                await this._syncToCloud();
                return;
            }
            this._cloudSaves = saves;

            // Find the cloud save matching current town_id, or the most recent one
            let cloudMatch = saves.find(s => s.town_id === this.currentTownId);
            if (!cloudMatch) cloudMatch = saves[0]; // saves are sorted by updated_at DESC

            // Always load from cloud when logged in
            const saveData = await this.auth.cloudLoad(cloudMatch.town_id);
            if (this.world.loadSave(saveData)) {
                if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                this.currentTownId = cloudMatch.town_id;
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                this.render();
                this.world.logMessage('system', `${t('已從雲端同步最新存檔（')}${cloudMatch.town_name}）。`);
            }
        } catch (e) {
            console.error('[RimTown] Cloud load error:', e);
        }
    }

    _getCurrentTownName() {
        if (this.auth.loggedIn && this._cloudSaves) {
            const cloud = this._cloudSaves.find(s => s.town_id === this.currentTownId);
            if (cloud) return cloud.town_name || t('邊境鎮');
        }
        const list = this._getTownList();
        const town = list.find(t => t.id === this.currentTownId);
        return town?.name || t('邊境鎮');
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
        this.world.logMessage('system', `${t('成就解鎖：')}${def.icon} ${def.name}`);
    }

    _showAchievementToast(def) {
        this._showCenterNotification({
            icon: def.icon,
            title: t('成就解鎖！'),
            name: def.name,
            desc: def.desc,
            autoDismiss: 6000
        });
    }

    _startAchievementChecker() {
        // Check achievements every 5 seconds
        setInterval(() => this._checkAchievements(), 5000);
        // Check story events every 3 seconds
        setInterval(() => this._checkStoryEventDisplay(), 3000);
        // Check newspaper every 10 seconds
        setInterval(() => this._checkNewspaperNotification(), 10000);
    }

    _checkStoryEventDisplay() {
        if (!this.world?.questSystem) return;
        const event = this.world.questSystem.getPendingStoryEvent();
        if (!event) return;
        this._showStoryEventToast(event);
    }

    _showStoryEventToast(event) {
        this._showCenterNotification({
            icon: event.icon,
            title: event.title,
            desc: event.text,
            autoDismiss: 0 // manual dismiss for story events
        });
    }

    // Center-screen notification card (like tutorial cards)
    _showCenterNotification({ icon, title, name, desc, content, autoDismiss }) {
        // Queue notifications if one is already showing
        if (!this._centerNotifQueue) this._centerNotifQueue = [];
        const notif = { icon, title, name, desc, content, autoDismiss };
        const overlay = document.getElementById('center-notification-overlay');
        if (!overlay) return;
        if (!overlay.classList.contains('hidden')) {
            this._centerNotifQueue.push(notif);
            return;
        }
        const card = document.getElementById('center-notification-card');
        if (!card) return;
        let html = '';
        if (icon) html += `<div class="center-notif-icon">${icon}</div>`;
        if (title) html += `<div class="center-notif-title">${title}</div>`;
        if (name) html += `<div class="center-notif-name">${name}</div>`;
        if (desc) html += `<div class="center-notif-desc">${desc}</div>`;
        if (content) html += `<div class="center-notif-content">${content}</div>`;
        html += `<button class="center-notif-dismiss">${t('確認')}</button>`;
        card.innerHTML = html;
        overlay.classList.remove('hidden');
        const dismissBtn = card.querySelector('.center-notif-dismiss');
        const dismiss = () => {
            overlay.classList.add('hidden');
            // Show next queued notification
            if (this._centerNotifQueue?.length) {
                setTimeout(() => this._showCenterNotification(this._centerNotifQueue.shift()), 300);
            }
        };
        dismissBtn.addEventListener('click', dismiss);
        overlay.querySelector('.center-notification-backdrop').addEventListener('click', dismiss);
        if (autoDismiss > 0) {
            setTimeout(dismiss, autoDismiss);
        }
    }

    // Check and show daily newspaper as center notification
    _checkNewspaperNotification() {
        if (!this.world?.dailyNews?.newspapers?.length) return;
        const papers = this.world.dailyNews.newspapers;
        const latest = papers[papers.length - 1];
        if (this._lastShownNewspaperId === latest.id) return;
        this._lastShownNewspaperId = latest.id;
        this._showCenterNotification({
            icon: '📰',
            title: t('AI 日報'),
            name: `${t('第')}${latest.id}${t('期')} — ${t('記者')}：${latest.reporter}`,
            content: latest.content || '',
            autoDismiss: 0
        });
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
        if (chatHistory.length >= 200) this._unlockAchievement('chat_100');

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
        if ((clock.year || 1) >= 4) this._unlockAchievement('survive_3years');

        // Population
        const pop = Object.keys(agents).length;
        if (pop >= 15) this._unlockAchievement('pop_15');
        if (pop >= 20) this._unlockAchievement('pop_20');
        if (pop >= 25) this._unlockAchievement('pop_25');
        if (pop >= 30) this._unlockAchievement('pop_30');
        if (pop >= 40) this._unlockAchievement('pop_40');

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
        if (completedResearch.length >= 5) this._unlockAchievement('research_5');
        const allResearch = Object.values(researchProjects);
        if (allResearch.length > 0 && completedResearch.length === allResearch.length) this._unlockAchievement('all_research');
        if ((res.silver || 0) >= 2000) this._unlockAchievement('ultra_rich');
        // Resource hoarder
        for (const amt of Object.values(res)) { if (amt >= 200) { this._unlockAchievement('resource_hoarder'); break; } }

        // Seasons
        if (clock.season) this._seasonsVisited.add(clock.season);
        if (this._seasonsVisited.size >= 4) this._unlockAchievement('all_seasons');

        // Night owl / Early bird
        if (clock.hour !== undefined && clock.hour >= 0 && clock.hour < 4 && this.world?.tickCount > 0) this._unlockAchievement('night_owl');
        if (clock.hour !== undefined && clock.hour >= 5 && clock.hour <= 6 && this.world?.tickCount > 0) this._unlockAchievement('early_bird');

        // Election
        const election = this.state.election;
        if (election?.electionHistory?.length >= 1) this._unlockAchievement('first_election');
        if (election?.electionHistory?.length >= 3) this._unlockAchievement('election_3');

        // Multi-town
        if (this._getTownList().length >= 3) this._unlockAchievement('multi_town');

        // NPC conversations seen (from log)
        const npcConvos = this.state.npc_conversations || [];
        this._npcConvosSeen = Math.max(this._npcConvosSeen, npcConvos.length);
        if (this._npcConvosSeen >= 10) this._unlockAchievement('gossip_heard');
        if (this._npcConvosSeen >= 50) this._unlockAchievement('gossip_50');
        if (this._npcConvosSeen >= 200) this._unlockAchievement('gossip_200');

        // Player relationships
        const playerRels = player.relationships || [];
        playerRels.forEach(r => {
            if (r.romantic_interest > 30) this._unlockAchievement('first_crush');
            if (r.status === 'dating') { this._unlockAchievement('first_dating'); this._datingHistory.add(r.target_name); }
            if (r.status === 'married') this._unlockAchievement('first_marriage');
            if (r.affinity >= 80) this._unlockAchievement('high_affinity');
            if (r.affinity <= -50) this._unlockAchievement('enemy_made');
            if (r.status === 'married' && r.affinity >= 90) this._unlockAchievement('golden_couple');
        });
        if (this._datingHistory.size >= 3) this._unlockAchievement('heartbreaker');
        // NPC romance tracking
        const allNpcs = Object.values(agents).filter(a => !a.is_player);
        let npcCouples = 0;
        let hasNpcWedding = false;
        let hasNpcBreakup = false;
        allNpcs.forEach(npc => {
            (npc.relationships || []).forEach(r => {
                if (r.status === 'dating' || r.status === 'married') npcCouples++;
                if (r.status === 'married') hasNpcWedding = true;
                if (r.status === 'ex') hasNpcBreakup = true;
            });
        });
        if (hasNpcWedding) this._unlockAchievement('npc_wedding');
        if (hasNpcBreakup) this._unlockAchievement('npc_breakup');
        if (npcCouples / 2 >= 5) this._unlockAchievement('npc_couple_5');

        // Player job
        if (player.job?.title && player.job.title !== t('無業')) {
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
            if (totalRaids >= 5) this._unlockAchievement('repel_5');
            if (totalRaids >= 10) this._unlockAchievement('repel_10');
            this._raidCount = currentRaids;
        }

        // New system achievements
        const factionList = Object.values(this.state.factions?.factions || {});
        if (factionList.length >= 1) this._unlockAchievement('first_faction');
        if (factionList.length >= 3) this._unlockAchievement('faction_3');
        // Check for faction drama (rivalry or internal conflict events)
        const hasDrama = factionList.some(f => f.rivalFactionId || f.cohesion < 30);
        if (hasDrama) this._unlockAchievement('faction_drama');
        if ((this.state.lifecycle?.graveyard || []).length >= 1) this._unlockAchievement('first_death');
        if ((this.state.lifecycle?.births || []).length >= 1) this._unlockAchievement('first_birth');
        if ((this.state.lifecycle?.births || []).length >= 5) this._unlockAchievement('births_5');
        if ((this.state.lifecycle?.playerChildren || []).length >= 1) this._unlockAchievement('first_child');
        if ((this.world._legacyGeneration || 1) >= 2) this._unlockAchievement('new_game_plus');
        if ((this.world._legacyGeneration || 1) >= 3) this._unlockAchievement('generation_3');
        const festLog = this.state.festivals?.festivalLog || [];
        if (festLog.length >= 1) this._unlockAchievement('first_festival');
        const festSeasons = new Set(festLog.map(f => f.season));
        if (festSeasons.size >= 4) this._unlockAchievement('all_festivals');
        if (festLog.length >= 5) this._unlockAchievement('festival_5');
        const discoveredZones = Object.keys(this.state.exploration?.discoveredZones || {});
        if (discoveredZones.length >= 1) this._unlockAchievement('first_explore');
        const totalExploreZones = Object.keys(this.world.exploration?.zones || {}).length;
        if (totalExploreZones > 0 && discoveredZones.length >= totalExploreZones) this._unlockAchievement('explore_all');
        const successExpeditions = (this.state.exploration?.expeditionLog || []).filter(e => e.success);
        if (successExpeditions.length >= 1) this._unlockAchievement('expedition_success');

        // v3 Industry achievements
        const ind = this.state.industry || {};
        const indKeys = Object.keys(ind.industries || {});
        if (indKeys.length >= 1) this._unlockAchievement('first_industry');
        if (indKeys.length >= 2) this._unlockAchievement('two_industries');
        if (indKeys.length >= 4) this._unlockAchievement('four_industries');
        for (const data of Object.values(ind.industries || {})) {
            if (data.level >= 3) this._unlockAchievement('industry_lv3');
            if (data.level >= 5) this._unlockAchievement('industry_lv5');
        }
        // Town level
        if ((ind.townLevel || 1) >= 3) this._unlockAchievement('town_lv3');
        if ((ind.townLevel || 1) >= 5) this._unlockAchievement('town_lv5');
        if ((ind.townLevel || 1) >= 7) this._unlockAchievement('town_lv7');

        // v3 Farm achievements
        const farm = this.state.farm || {};
        const totalHarvested = farm.totalHarvested || {};
        const harvestTotal = Object.values(totalHarvested).reduce((s, v) => s + v, 0);
        if (harvestTotal >= 1) this._unlockAchievement('first_harvest');
        if (harvestTotal >= 1) this._unlockAchievement('player_farmer');
        if (harvestTotal >= 100) this._unlockAchievement('harvest_100');
        if (harvestTotal >= 500) this._unlockAchievement('harvest_500');
        const harvestLog = farm.harvestLog || [];
        if (harvestLog.some(h => h.quality === 'excellent')) this._unlockAchievement('excellent_crop');

        // v3 Factory achievements
        const proc = this.state.processing || {};
        if (Object.keys(proc.builtFactories || {}).length >= 1) this._unlockAchievement('first_factory');
        const completedOrders = (proc.orders || []).filter(o => o.status === 'completed');
        if (completedOrders.length >= 1) this._unlockAchievement('factory_order');
        if (completedOrders.length >= 10) this._unlockAchievement('factory_order_10');

        // v3 Daily news achievements
        const newsData = this.state.dailyNews || {};
        if ((newsData.newspapers || []).length >= 1) this._unlockAchievement('read_newspaper');
        if ((newsData.newspapers || []).length >= 10) this._unlockAchievement('newspaper_10');
        if ((newsData.newspapers || []).length >= 30) this._unlockAchievement('newspaper_30');

        // v3 NPC event achievements
        const npcEvt = this.state.npcEvents || {};
        const incidents = npcEvt.recentIncidents || [];
        if (incidents.some(i => i.type === 'fight')) this._unlockAchievement('npc_fight');
        if (incidents.some(i => i.type === 'cheating_discovered')) this._unlockAchievement('npc_cheating');

        // v3.2 new achievement checks
        // Trade count
        if ((this._tradeCount || 0) >= 50) this._unlockAchievement('trade_50');
        if ((this._tradeCount || 0) >= 1000) this._unlockAchievement('player_trader');
        // Job all (12 default job types)
        const JOB_TYPES = ['mayor','doctor','blacksmith','cook','farmer','trader','guard','researcher','miner','priest','carpenter','tailor'];
        if (this._playerJobHistory.size >= JOB_TYPES.length) this._unlockAchievement('job_all');
        // Flirt count
        if ((this._flirtCount || 0) >= 5) this._unlockAchievement('flirt_master');
        // Player explorer
        if (successExpeditions.length >= 3) this._unlockAchievement('player_explorer');
        // Speed runner (5 buildings within 30 days)
        if (totalDays <= 30 && completedBuildings.length >= 5) this._unlockAchievement('speed_runner');
        // Pacifist (30 days, no fights)
        if (totalDays >= 30 && !incidents.some(i => i.type === 'fight') && raidEvents.length === 0) this._unlockAchievement('pacifist');
        // Save collector
        const saveCount = parseInt(localStorage.getItem('rimtown_save_count') || '0');
        if (saveCount >= 10) this._unlockAchievement('save_collector');
        // Prosperity max
        const prosData = this.state.prosperity || {};
        if (prosData.level === t('傳奇') || prosData.level === 'legendary') this._unlockAchievement('prosperity_max');
        // Achievement meta-achievements
        const unlockedCount = Object.keys(this._achievements || {}).length;
        if (unlockedCount >= 25) this._unlockAchievement('achievement_25');
        if (unlockedCount >= 50) this._unlockAchievement('achievement_50');
        if (unlockedCount >= 96) this._unlockAchievement('achievement_99'); // 96 + the 3 meta = 99
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
            this.world.logMessage('system', t('已登出。'));
        } catch(e) { console.error(e); }
    }

    async _showCloudSaves() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (!saves.length) {
                this._gameAlert(t('雲端沒有存檔。請先上傳存檔。'), '☁️');
                return;
            }
            // Show in town modal
            const modal = document.getElementById('town-modal');
            const container = document.getElementById('town-list-content');
            if (!modal || !container) return;
            modal.classList.remove('hidden');
            let html = t('<h3 style="margin-bottom:8px">雲端存檔</h3>');
            saves.forEach(s => {
                const date = new Date(s.updated_at).toLocaleString();
                html += `<div class="town-item">
                    <div class="town-info" data-action="load-cloud-save" data-val="${s.town_id}">
                        <div class="town-name">☁️ ${s.town_name}</div>
                        <div class="town-meta">${s.season}${t(' 第')}${s.year}${t('年 第')}${s.day}${t('天 | 人口')}${s.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="delete-cloud-save" data-val="${s.town_id}" class="btn-danger" title="${t('刪除雲端存檔')}">🗑️</button>
                    </div>
                </div>`;
            });
            html += `<div class="town-modal-actions"><button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button></div>`;
            container.innerHTML = html;
        } catch(e) { this._gameAlert(t('載入雲端存檔失敗：') + e.message, '❌'); }
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
                if (this.tileMap) this.tileMap.agentPositions = {};
                this.render();
                this.world.logMessage('system', t('已從雲端載入存檔。'));
            }
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = false;
        } catch(e) { this._gameAlert(t('載入失敗：') + e.message, '❌'); }
    }

    async _deleteCloudSave(townId) {
        if (!await this._gameConfirm(t('確定刪除雲端存檔？'), '🗑️')) return;
        try {
            await this.auth.cloudDelete(townId);
            this.world.logMessage('system', t('雲端存檔已刪除。'));
            this._showCloudSaves(); // Refresh list
        } catch(e) { this._gameAlert(t('刪除失敗：') + e.message, '❌'); }
    }

    // === Achievements Tab ===
    _showAchievementsTab() {
        this.activeTab = 'achievements';
        if (this._updateTabHighlight) this._updateTabHighlight('achievements');
        this.renderSidebar();
    }

    renderAchievements(container) {
        const categories = { social: t('社交'), romance: t('愛情'), economy: t('經濟'), survival: t('生存'), town: t('城鎮'), player: t('玩家'), special: t('特殊') };
        let html = t('<div class="achievements-panel"><h3>成就 <span class="ach-count">') +
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
                    <div class="ach-desc">${unlocked ? def.desc : t('尚未解鎖')}</div></div></div>`;
            });
            html += '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    // === Player Deep Interaction ===
    _renderPlayerJobPanel(player) {
        const currentJob = player.job?.title || t('無業');
        // Get jobs from JOB_DEFINITIONS (global from simulation.js), excluding mayor
        let JOBS;
        const JOB_ICONS = { farmer:'🌾', miner:'⛏️', cook:'🍳', blacksmith:'🔨', doctor:'💊', researcher:'🔬', trader:'💰', guard:'⚔️', carpenter:'🪵', tailor:'🧵', priest:'⛪' };
        if (typeof JOB_DEFINITIONS !== 'undefined') {
            JOBS = {};
            for (const [k, v] of Object.entries(JOB_DEFINITIONS)) {
                if (k !== 'mayor') JOBS[k] = v.title;
            }
        } else {
            JOBS = { farmer:t('農夫'), miner:t('礦工'), cook:t('廚師'), blacksmith:t('鐵匠'), doctor:t('醫生'), researcher:t('研究員'), trader:t('商人'), guard:t('守衛'), carpenter:t('木匠'), tailor:t('裁縫'), priest:t('牧師') };
        }
        let html = t('<div class="detail-section"><h3>你的工作</h3>');
        html += `${t('<div class="job-current-badge"><span class="job-current-label">目前職業</span><span class="job-current-name">')}${currentJob}</span></div>`;
        if (player.job?.key && player.job.key !== 'none') {
            html += t('<button class="btn-quit-job" data-action="player-quit-job">✋ 辭職</button>');
        }
        html += '<div class="job-grid">';
        for (const [key, title] of Object.entries(JOBS)) {
            const isActive = player.job?.key === key;
            const icon = JOB_ICONS[key] || '💼';
            html += `<button class="job-btn ${isActive ? 'active' : ''}" data-action="player-choose-job" data-val="${key}" ${isActive ? 'disabled' : ''}><span class="job-btn-icon">${icon}</span><span class="job-btn-title">${title}</span></button>`;
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
            this.world.logMessage('player_action', `${t('你選擇了')}${player.job.title}${t('的工作。')}`, player.name);
        } catch(e) {
            // Fallback if Job class not available
            player.job = { key: jobKey, title: jobKey, workplace: jobKey, workHours: [8,17] };
            this.world.logMessage('player_action', `${t('你選擇了')}${jobKey}${t('的工作。')}`, player.name);
        }
        this._unlockAchievement('got_job');
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerQuitJob() {
        const player = this.world.agents['player'];
        if (!player) return;
        const oldJob = player.job?.title || t('無業');
        player.job = null;
        this.world.logMessage('player_action', `${t('你辭去了')}${oldJob}${t('的工作。')}`, player.name);
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
            this.world.logMessage('system', t('你已經投過票了。'));
            return;
        }
        candidate.votes = (candidate.votes || 0) + 1;
        election._playerVoted = true;
        this._unlockAchievement('voted');
        this.world.logMessage('player_action', `${t('你投票給了 ')}${candidate.name}。`, 'player');
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerFlirt(targetId) {
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) return;
        if (player.currentLocation !== npc.currentLocation) {
            this.world.logMessage('system', t('你需要在對方身邊才能調情。'));
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
            this._flirtCount = (this._flirtCount || 0) + 1;
            this.world.logMessage('player_action', `${t('你對')}${npc.name}${t('調情。')}`, player.name, npc.name);
            player.memory?.add?.(this.world.tickCount, this.world.clock.timeStr, 'social', `${t('對')}${npc.name}${t('調情')}`, 3, [npc.name]);
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
            this.world.logMessage('system', t('你跟這個人不夠熟。'));
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
                this.world.logMessage('event', `${player.name}${t('與')}${npc.name}${t('結婚了！')}`, player.name, npc.name);
                this._unlockAchievement('first_marriage');
            } else {
                rel.status = 'dating';
                if (npcRel) npcRel.status = 'dating';
                this.world.logMessage('event', `${player.name}${t('與')}${npc.name}${t('開始交往！')}`, player.name, npc.name);
                this._unlockAchievement('first_dating');
            }
        } else {
            this.world.logMessage('event', `${npc.name}${t('拒絕了你的告白。')}`, player.name, npc.name);
            this._unlockAchievement('rejected');
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
            name: existing?.name || name || t('邊境鎮'),
            savedAt: new Date().toISOString(),
            season: clock.season || t('春季'),
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
        // When logged in, show cloud saves; otherwise show local saves
        if (this.auth.loggedIn) {
            this._renderCloudTownList(container);
            return;
        }
        const towns = this._getTownList();
        let html = '';
        if (!towns.length) {
            html = t('<p class="muted-text">尚無城鎮存檔。</p>');
        } else {
            towns.forEach(_tw => {
                const isActive = _tw.id === this.currentTownId;
                const date = new Date(_tw.savedAt).toLocaleString();
                html += `<div class="town-item ${isActive?'active':''}">
                    <div class="town-info" data-action="switch-town" data-val="${_tw.id}">
                        <div class="town-name">${_tw.name} ${isActive?t('<span class="current-badge">目前</span>'):''}</div>
                        <div class="town-meta">${_tw.season}${t(' 第')}${_tw.year}${t('年 第')}${_tw.day}${t('天 | 人口')}${_tw.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="rename-town" data-val="${_tw.id}" title="${t('重新命名')}">✏️</button>
                        ${!isActive?`<button data-action="delete-town" data-val="${_tw.id}" title="${t('刪除')}" class="btn-danger">🗑️</button>`:''}
                    </div>
                </div>`;
            });
        }
        html += `<div class="town-modal-actions">
            <button class="town-btn town-btn-primary" data-action="create-town">${t('新建城鎮')}</button>
            <button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button>
        </div>`;
        container.innerHTML = html;
    }
    async _renderCloudTownList(container) {
        container.innerHTML = `<p class="muted-text">${t('載入雲端存檔...')}</p>`;
        try {
            const saves = await this.auth.listSaves();
            this._cloudSaves = saves;
            let html = '';
            if (!saves.length) {
                html = t('<p class="muted-text">雲端尚無城鎮存檔。</p>');
            } else {
                saves.forEach(_tw => {
                    const isActive = _tw.town_id === this.currentTownId;
                    const date = _tw.updated_at ? new Date(_tw.updated_at).toLocaleString() : '';
                    html += `<div class="town-item ${isActive?'active':''}">
                        <div class="town-info" data-action="switch-town" data-val="${_tw.town_id}">
                            <div class="town-name">${_tw.town_name} ${isActive?t('<span class="current-badge">目前</span>'):''}</div>
                            <div class="town-meta">${_tw.season||''}${t(' 第')}${_tw.year||1}${t('年 第')}${_tw.day||1}${t('天 | 人口')}${_tw.population||0} | ${date}</div>
                        </div>
                        <div class="town-actions">
                            <button data-action="rename-town" data-val="${_tw.town_id}" title="${t('重新命名')}">✏️</button>
                            ${!isActive?`<button data-action="delete-town" data-val="${_tw.town_id}" title="${t('刪除')}" class="btn-danger">🗑️</button>`:''}
                        </div>
                    </div>`;
                });
            }
            html += `<div class="town-modal-actions">
                <button class="town-btn town-btn-primary" data-action="create-town">${t('新建城鎮')}</button>
                <button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button>
            </div>`;
            container.innerHTML = html;
        } catch (e) {
            console.error('[RimTown] Cloud town list error:', e);
            container.innerHTML = `<p class="muted-text">${t('載入雲端存檔失敗。')}</p>
                <div class="town-modal-actions"><button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button></div>`;
        }
    }
    async switchTown(townId) {
        if (townId === this.currentTownId) {
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = false;
            return;
        }
        if (this.auth.loggedIn) {
            // When logged in, save current to cloud then load target from cloud
            await this.saveGame();
            try {
                const saveData = await this.auth.cloudLoad(townId);
                if (saveData && this.world.loadSave(saveData)) {
                    if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                    this.currentTownId = townId;
                    this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    if (this.tileMap) this.tileMap.agentPositions = {};
                    const cloudMeta = this._cloudSaves?.find(s => s.town_id === townId);
                    this._updateHeaderTownName(cloudMeta?.town_name);
                    this.render();
                }
            } catch (e) {
                console.error('[RimTown] Cloud switch town error:', e);
                this.world.logMessage('system', t('切換城鎮失敗。'));
            }
        } else {
            // Not logged in — use local saves
            this._saveCurrentTown();
            if (this._loadTownById(townId)) {
                if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                const townMeta = this._getTownList().find(t => t.id === townId);
                this._updateHeaderTownName(townMeta?.name);
                this.render();
            }
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
    async createNewTown() {
        const defaultSuffix = this.auth.loggedIn
            ? ((this._cloudSaves?.length || 0) + 1)
            : (this._getTownList().length + 1);
        const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + defaultSuffix);
        if (!name) return;
        if (this.auth.loggedIn) {
            // When logged in, save current town to cloud before creating new one
            if (this.currentTownId) await this.saveGame();
        } else {
            if (this.currentTownId) this._saveCurrentTown();
        }
        this.world.reset();
        if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
        this.currentTownId = this._generateTownId(name);
        if (this.auth.loggedIn) {
            // Save new town to cloud immediately
            await this.saveGame();
        } else {
            this._saveCurrentTown(name);
        }
        this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
        this.state = this.world.getState();
        this._generateTileMapLayout();
        if (this.tileMap) this.tileMap.agentPositions = {};
        // Close modal and unpause
        document.getElementById('town-modal')?.classList.add('hidden');
        this.world.paused = false;
        this._updateHeaderTownName(name);
        this.world.logMessage('system', `${t('🏘️ 新城鎮「')}${name}${t('」已建立！')}`);
        this.render();
    }
    async renameTownPrompt(townId) {
        let currentName = t('邊境鎮');
        if (this.auth.loggedIn && this._cloudSaves) {
            const cloud = this._cloudSaves.find(s => s.town_id === townId);
            if (cloud) currentName = cloud.town_name;
        } else {
            const towns = this._getTownList();
            const town = towns.find(t => t.id === townId);
            if (town) currentName = town.name;
        }
        const newName = prompt(t('新名稱：'), currentName);
        if (newName && newName.trim()) {
            if (this.auth.loggedIn) {
                // When logged in, re-save to cloud with new name
                try {
                    const saveData = await this.auth.cloudLoad(townId);
                    if (saveData) {
                        const clock = saveData.clock || {};
                        await this.auth.cloudSave(townId, newName.trim(), saveData, {
                            season: clock.season, year: clock.year, day: clock.day,
                            population: Object.keys(saveData.agents || {}).length,
                        });
                        // Update local cache
                        if (this._cloudSaves) {
                            const cs = this._cloudSaves.find(s => s.town_id === townId);
                            if (cs) cs.town_name = newName.trim();
                        }
                    }
                } catch (e) {
                    console.error('[RimTown] Cloud rename error:', e);
                }
            } else {
                const towns = this._getTownList();
                const town = towns.find(t => t.id === townId);
                if (town) {
                    town.name = newName.trim();
                    this._saveTownList(towns);
                }
            }
            if (townId === this.currentTownId) {
                this._updateHeaderTownName(newName.trim());
            }
            this._renderTownList();
        }
    }
    async deleteTownConfirm(townId) {
        if (!await this._gameConfirm(t('確定要刪除這個城鎮？所有存檔和聊天記錄都會消失。'), '🗑️')) return;
        if (this.auth.loggedIn) {
            // When logged in, delete from cloud
            try {
                await this.auth.cloudDelete(townId);
            } catch (e) {
                console.error('[RimTown] Cloud delete error:', e);
            }
        } else {
            // Not logged in — delete from local storage
            const list = this._getTownList().filter(t => t.id !== townId);
            this._saveTownList(list);
            localStorage.removeItem('rimtown_town_' + townId);
            localStorage.removeItem('rimtown_town_' + townId + '_archives');
        }
        this._renderTownList();
    }

    setupTileMap() {
        const canvas = document.getElementById('town-map-canvas');
        const mapPanel = document.querySelector('.map-panel');
        const mainLayout = document.querySelector('.main-layout');
        console.log('[RimTown] setupTileMap: canvas=', !!canvas,
            'mapPanel=', mapPanel ? `${mapPanel.offsetWidth}x${mapPanel.offsetHeight}` : 'null',
            'mainLayout=', mainLayout ? `${mainLayout.offsetWidth}x${mainLayout.offsetHeight}` : 'null');
        if (mapPanel) {
            const rect = mapPanel.getBoundingClientRect();
            console.log('[RimTown] mapPanel rect:', JSON.stringify({top:rect.top,left:rect.left,width:rect.width,height:rect.height}));
        }
        this.tileMap = new PixelTileMap(canvas);
        this.tileMap.onClick = (locId) => this.playerMoveTo(locId);
        this.tileMap.onAgentClick = (agentId) => this.onAgentClick(agentId);
        this._generateTileMapLayout();
    }

    _updateHeaderTownName(name) {
        const h1 = document.querySelector('#rimtown-app .header h1');
        if (h1) h1.textContent = name || t('邊境鎮');
    }

    _generateTileMapLayout() {
        const locations = this.state.locations?.locations || {};
        console.log('[RimTown] _generateTileMapLayout: locationCount=', Object.keys(locations).length);
        this.tileMap.generateLayout(locations);
        this._mapGenerated = true;
    }

    _startRenderLoop() {
        let _renderLogCount = 0;
        let _guidanceFrameCount = 0;
        const loop = () => {
            // Update quest guidance banner every ~300 frames (~5 seconds)
            if (++_guidanceFrameCount % 300 === 0) this._updateQuestGuidance();
            if (this.tileMap && this._mapGenerated) {
                if (_renderLogCount < 3) {
                    const parent = this.tileMap.canvas?.parentElement;
                    const rect = parent?.getBoundingClientRect();
                    console.log('[RimTown] renderLoop frame', _renderLogCount, ': parent=', rect ? `${rect.width}x${rect.height}` : 'null',
                        'canvas=', `${this.tileMap.canvas?.width}x${this.tileMap.canvas?.height}`,
                        'grid=', !!this.tileMap.grid);
                    _renderLogCount++;
                }
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
                this.tileMap.render(agents, this.selectedAgent, player?.current_location, this.world?.buildings?.completed || [], {
                    farm: this.state?.farm, processing: this.state?.processing, industry: this.state?.industry,
                });
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
            const fallbackGroqKey = localStorage.getItem('fallback_groq_key');
            console.log('[RimTown] loadSettings: provider=', provider, 'hasKey=', !!apiKey, 'speed=', speed, 'hasFallback=', !!fallbackGroqKey);
            if (speed) this.simSpeed = parseInt(speed);
            if (provider && provider !== 'none' && apiKey) {
                this.llmClient = new LLMClient(provider, apiKey);
                console.log('[RimTown] LLM client created from localStorage:', provider);
            }
            // No primary AI but has fallback Groq key → use Groq as primary
            if (!this.llmClient && fallbackGroqKey) {
                this.llmClient = new LLMClient('groq', fallbackGroqKey);
                console.log('[RimTown] No primary AI — using fallback Groq as primary');
            }
            // Set fallback key on client
            if (this.llmClient && fallbackGroqKey) {
                this.llmClient.setFallbackGroqKey(fallbackGroqKey);
            }
            // Also try chrome.storage if localStorage didn't have it
            if (!this.llmClient && typeof chrome !== 'undefined' && chrome.storage) {
                try {
                    const data = await chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed','fallback_groq_key']);
                    if (data.sim_speed && !speed) this.simSpeed = parseInt(data.sim_speed);
                    if (data.llm_provider && data.llm_provider !== 'none' && data.llm_api_key) {
                        this.llmClient = new LLMClient(data.llm_provider, data.llm_api_key);
                        console.log('[RimTown] LLM client created from chrome.storage:', data.llm_provider);
                    }
                    if (!this.llmClient && data.fallback_groq_key) {
                        this.llmClient = new LLMClient('groq', data.fallback_groq_key);
                        console.log('[RimTown] No primary AI — using fallback Groq from chrome.storage');
                    }
                    if (this.llmClient && (data.fallback_groq_key || fallbackGroqKey)) {
                        this.llmClient.setFallbackGroqKey(data.fallback_groq_key || fallbackGroqKey);
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
        const fallbackGroqKey = document.getElementById('fallback-groq-key')?.value?.trim() || '';
        if (provider && provider !== 'none' && apiKey) {
            this.llmClient = new LLMClient(provider, apiKey);
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        } else if (fallbackGroqKey) {
            // No primary AI selected but has fallback → use Groq as primary
            this.llmClient = new LLMClient('groq', fallbackGroqKey);
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        } else {
            this.llmClient = null;
            this.world.conversationEngine = new ConversationEngine();
        }
        // Attach fallback key
        if (this.llmClient && fallbackGroqKey) {
            this.llmClient.setFallbackGroqKey(fallbackGroqKey);
        }
        this.restartSimulation();
        this._updateLLMStatus();
        localStorage.setItem('llm_provider', provider);
        localStorage.setItem('llm_api_key', apiKey);
        localStorage.setItem('sim_speed', speed);
        if (fallbackGroqKey) localStorage.setItem('fallback_groq_key', fallbackGroqKey);
        else localStorage.removeItem('fallback_groq_key');
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ llm_provider: provider, llm_api_key: apiKey, sim_speed: speed, fallback_groq_key: fallbackGroqKey });
            }
        } catch(e) {}
    }

    _saveSettingsFromTab() {
        const provider = document.getElementById('settings-tab-provider')?.value || 'none';
        const apiKey = document.getElementById('settings-tab-apikey')?.value || '';
        const speed = document.getElementById('settings-tab-speed')?.value || '2000';
        const fallbackKey = document.getElementById('settings-tab-groq')?.value?.trim() || '';
        if (provider !== 'none' && !apiKey && !fallbackKey) {
            this._gameAlert(t('請輸入 API 金鑰，或填寫備用 Groq Key，或選擇「無（模擬對話）」。'), '🔑');
            return;
        }
        // Store fallback key so saveSettings can read it
        const fallbackEl = document.getElementById('fallback-groq-key');
        if (fallbackEl) fallbackEl.value = fallbackKey;
        localStorage.setItem('fallback_groq_key', fallbackKey || '');
        this.saveSettings(provider, apiKey, speed);
        const langSelect = document.getElementById('lang-select') || document.getElementById('settings-tab-lang');
        if (langSelect) {
            I18N.setLang(langSelect.value);
            if (typeof renderCurrentTab === 'function') renderCurrentTab();
        }
        this.world.logMessage('system', t('設定已儲存'));
        this.renderSidebar();
        // Auto-test API key connection after save
        if (provider !== 'none' && apiKey) {
            setTimeout(() => this._testApiKeyConnection('main'), 300);
        }
        if (fallbackKey) {
            setTimeout(() => this._testApiKeyConnection('groq'), 500);
        }
    }

    _updateLLMStatus() {
        const el = document.getElementById('llm-status');
        if (!el) return;
        if (this.llmClient && this.world.conversationEngine?.llm) {
            const hasFallback = !!this.llmClient.fallbackGroqKey;
            const providerLabel = this.llmClient.provider + (hasFallback ? t('+備用') : '');
            el.textContent = 'AI:' + providerLabel;
            el.className = 'llm-status connected';
            el.title = t('AI 已連接：') + this.llmClient.provider + (hasFallback ? t('（備用：Groq）') : '');
        } else {
            el.textContent = t('AI:未連接');
            el.className = 'llm-status disconnected';
            el.title = t('請在設定中配置 AI 提供商和 API Key');
        }
    }

    async _testApiKeyConnection(type) {
        const isMain = type === 'main';
        const statusEl = document.getElementById(isMain ? 'apikey-status' : 'groqkey-status');
        const btnEl = document.getElementById(isMain ? 'btn-test-apikey' : 'btn-test-groq');
        if (!statusEl) return;

        const provider = isMain
            ? (document.getElementById('settings-tab-provider')?.value || 'none')
            : 'groq';
        const apiKey = isMain
            ? (document.getElementById('settings-tab-apikey')?.value || '')
            : (document.getElementById('settings-tab-groq')?.value?.trim() || '');

        if (!apiKey || (isMain && provider === 'none')) {
            statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444"></span><span style="color:#ef4444">${t('請先選擇供應商並輸入 API 金鑰')}</span>`;
            return;
        }

        // Show loading state
        statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;animation:pulse 1s infinite"></span><span style="color:#f59e0b">${t('測試中...')}</span>`;
        if (btnEl) btnEl.disabled = true;

        const tester = new LLMClient(provider, apiKey);
        const result = await tester.testConnection(provider, apiKey);

        if (result.ok) {
            statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e"></span><span style="color:#22c55e">${t('連線成功')}</span>`;
        } else {
            statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444"></span><span style="color:#ef4444">${t('連線失敗')}${result.error ? ' — ' + result.error : ''}</span>`;
        }
        if (btnEl) btnEl.disabled = false;
    }

    startSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.simInterval = setInterval(() => {
            this.world.tick();
            this.state = this.world.getState();
            this.render();
            // Check for ending trigger
            if (this.world.multiEnding?.endingTriggered && !this._endingShown) {
                this._endingShown = true;
                this._showEndingOverlay();
            }
        }, this.simSpeed);
    }

    restartSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.startSimulation();
    }

    setupTabListeners() {
        // Mobile tab groups: main tab -> [sub-tabs]
        this._mobileTabGroups = {
            residents: [
                { key: 'residents', label: t('居民'), icon: '👥' },
                { key: 'detail', label: t('詳情'), icon: '📋' },
            ],
            chat: [
                { key: 'chat', label: t('聊天'), icon: '💬' },
                { key: 'records', label: t('日誌'), icon: '📋' },
            ],
            quest: [
                { key: 'quest', label: t('任務'), icon: '⚔️' },
                { key: 'events', label: t('事件'), icon: '📰' },
                { key: 'achievements', label: t('成就'), icon: '🏆' },
            ],
            economy: [
                { key: 'economy', label: t('經濟'), icon: '💰' },
                { key: 'industry', label: t('產業'), icon: '🏭' },
            ],
        };
        // Reverse lookup: sub-tab -> parent main tab
        this._mobileSubToMain = {};
        for (const [main, subs] of Object.entries(this._mobileTabGroups)) {
            for (const sub of subs) {
                this._mobileSubToMain[sub.key] = main;
            }
        }

        const updateTabHighlight = (tabName) => {
            document.querySelectorAll('.rt-sidebar-tabs > button[data-tab]').forEach(b => b.classList.remove('active'));
            // On mobile, highlight the parent main tab
            const isMobile = window.innerWidth <= 768;
            const highlightTab = isMobile ? (this._mobileSubToMain[tabName] || tabName) : tabName;
            const mainBtn = document.querySelector(`.rt-sidebar-tabs > button[data-tab="${highlightTab}"]`);
            if (mainBtn) mainBtn.classList.add('active');
        };

        // Main tab bar buttons (including hidden ones for desktop)
        document.querySelectorAll('.rt-sidebar-tabs > button[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sidebar = document.getElementById('rimtown-sidebar');
                const isMobile = window.innerWidth <= 768;

                // On mobile, clicking a main tab resets to the first sub-tab of the group
                const targetTab = isMobile && this._mobileTabGroups[btn.dataset.tab]
                    ? this._mobileTabGroups[btn.dataset.tab][0].key
                    : btn.dataset.tab;

                if (isMobile) {
                    const currentMain = this._mobileSubToMain[this.activeTab] || this.activeTab;
                    if (currentMain === btn.dataset.tab && sidebar && !sidebar.classList.contains('mobile-collapsed')) {
                        sidebar.classList.add('mobile-collapsed');
                        return;
                    }
                    if (sidebar) sidebar.classList.remove('mobile-collapsed');
                }

                this.activeTab = targetTab;
                updateTabHighlight(targetTab);
                this.renderSidebar();
            });
        });

        // Store helper for external use (selectAgent, startChat etc.)
        this._updateTabHighlight = updateTabHighlight;
    }

    setupMobileSidebar() {
        const sidebar = document.getElementById('rimtown-sidebar');
        if (!sidebar) return;

        // Start collapsed on mobile (only tab bar visible)
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-collapsed');
        }

        // Drag handle: toggle expanded/collapsed
        const dragHandle = document.getElementById('mobile-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.toggle('mobile-collapsed');
                }
            });
            // Touch drag support: swipe up = expand, swipe down = collapse
            let startY = 0;
            dragHandle.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
                startY = e.touches[0].clientY;
                e.preventDefault();
            }, { passive: false });
            dragHandle.addEventListener('touchend', (e) => {
                if (window.innerWidth > 768) return;
                const endY = e.changedTouches[0].clientY;
                const diff = startY - endY;
                if (diff > 30) {
                    sidebar.classList.remove('mobile-collapsed');
                } else if (diff < -30) {
                    sidebar.classList.add('mobile-collapsed');
                }
            });
        }
    }

    setupMobileInputFix() {
        if (window.innerWidth > 768) return;
        const sidebar = document.querySelector('.rt-sidebar');
        if (!sidebar) return;

        // When an input/select inside sidebar gains focus, scroll it into view
        // and expand sidebar so the virtual keyboard doesn't hide the field
        sidebar.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                sidebar.classList.add('keyboard-open');
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        });
        sidebar.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                sidebar.classList.remove('keyboard-open');
            }
        });
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
                case 'toggle-convo': el.classList.toggle('expanded'); break;
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
                // Mobile group sub-tab switching
                case 'mobile-group-tab':
                    this.activeTab = val;
                    if (this._updateTabHighlight) this._updateTabHighlight(val);
                    this.renderSidebar();
                    break;
                // Industry sub-tabs
                case 'industry-subtab': this._industrySubTab = val; this.renderSidebar(); break;
                case 'economy-subtab': this._economySubTab = val; this.renderSidebar(); break;
                case 'records-subtab': this._recordsSubTab = val; this.renderSidebar(); break;
                // Industry
                case 'choose-industry': this._chooseIndustry(val); break;
                case 'upgrade-industry': this._upgradeIndustry(val); break;
                // Farm
                case 'till-plot': this._tillPlot(parseInt(val)); break;
                case 'plant-crop': { const [plotId, cropKey] = val.split(','); this._plantCrop(parseInt(plotId), cropKey); } break;
                case 'water-plot': this._waterPlot(parseInt(val)); break;
                case 'fertilize-plot': this._fertilizePlot(parseInt(val)); break;
                case 'harvest-plot': this._harvestPlot(parseInt(val)); break;
                case 'clear-withered': this._clearWithered(parseInt(val)); break;
                // Factory
                case 'build-factory': this._buildFactory(val); break;
                case 'set-recipe': { const [fKey, rId] = val.split(','); this._setRecipe(fKey, rId); } break;
                case 'assign-worker': { const [fKey, aId] = val.split(','); this._assignWorker(fKey, aId); } break;
                case 'collect-product': { const [fKey, res, amt] = val.split(','); this._collectProduct(fKey, res, parseInt(amt)); } break;
                case 'sell-product': { const [fKey, res, amt] = val.split(','); this._sellProduct(fKey, res, parseInt(amt)); } break;
                case 'fulfill-order': this._fulfillOrder(val); break;
                // Newspaper
                case 'view-newspaper': this._viewNewspaper(parseInt(val)); break;
                // Custom NPC
                case 'show-custom-npc': this._showCustomNPCModal(); break;
                case 'create-custom-npc': this._createCustomNPC(); break;
                case 'close-custom-npc': document.getElementById('custom-npc-modal')?.remove(); break;
                // Ending
                case 'close-ending': document.getElementById('ending-overlay')?.remove(); break;
                case 'start-newgame-plus': this._startNewGamePlus(); break;
                // Settings tab actions
                case 'settings-save-all': this._saveSettingsFromTab(); break;
                case 'test-apikey': this._testApiKeyConnection('main'); break;
                case 'test-groqkey': this._testApiKeyConnection('groq'); break;
                case 'settings-login': document.getElementById('auth-modal')?.classList.remove('hidden'); break;
                case 'settings-register': {
                    document.getElementById('auth-modal')?.classList.remove('hidden');
                    document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === 'register'));
                    document.getElementById('auth-login-form')?.classList.add('hidden');
                    document.getElementById('auth-register-form')?.classList.remove('hidden');
                    break;
                }
                case 'settings-logout': this._doLogout(); this.renderSidebar(); break;
                case 'settings-sync-cloud': this._syncToCloud(); break;
                case 'settings-save-game': this.saveGame(); break;
                case 'settings-export': this.exportSave(); break;
                case 'settings-import': this.importSave(); break;
                case 'settings-toggle-pause': this.world.paused = !this.world.paused; this.world.logMessage('system', this.world.paused ? t('遊戲已暫停。') : t('遊戲已繼續。')); this.renderSidebar(); break;
                case 'settings-speed-mult': {
                    const mult = parseFloat(val) || 1;
                    this._speedMultiplier = mult;
                    if (!this.baseSimSpeed) this.baseSimSpeed = this.simSpeed;
                    this.simSpeed = Math.round(this.baseSimSpeed / mult);
                    if (this.simInterval) clearInterval(this.simInterval);
                    this.simInterval = setInterval(() => {
                        this.world.tick(); this.state = this.world.getState(); this.render();
                    }, this.simSpeed);
                    this.renderSidebar();
                    break;
                }
                case 'settings-new-map': {
                    const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + (this._getTownList().length + 1));
                    if (!name) break;
                    this.archiveChatHistory();
                    this._saveCurrentTown();
                    this.world.reset();
                    if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                    this.currentTownId = this._generateTownId(name);
                    this._saveCurrentTown(name);
                    this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    if (this.tileMap) this.tileMap.agentPositions = {};
                    this._updateHeaderTownName(name);
                    this.world.logMessage('system', `${t('🏘️ 新城鎮「')}${name}${t('」已建立！')}`);
                    this.render();
                    break;
                }
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
        document.getElementById('btn-pause')?.addEventListener('click', () => {
            this.world.paused = true; this.render();
        });
        document.getElementById('btn-resume')?.addEventListener('click', () => {
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
        document.getElementById('btn-new-game')?.addEventListener('click', async () => {
            const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + (this._getTownList().length + 1));
            if (!name) return;
            await this.archiveChatHistory();
            this._saveCurrentTown();
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
            this.currentTownId = this._generateTownId(name);
            this._saveCurrentTown(name);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            if (this.tileMap) this.tileMap.agentPositions = {};
            this.render();
        });
        document.getElementById('btn-save')?.addEventListener('click', async () => {
            await this.saveGame();
            this.state = this.world.getState();
            this.renderSidebar();
            this._renderTownList();
            // Sync to cloud if logged in
            if (this.auth.loggedIn) {
                this._syncToCloud();
            }
        });
        // Export/import buttons removed — save auto-syncs to cloud when logged in
    }

    setupSettingsListeners() {
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.remove('hidden');
            const provider = localStorage.getItem('llm_provider');
            const apiKey = localStorage.getItem('llm_api_key');
            const speed = localStorage.getItem('sim_speed');
            const fallbackKey = localStorage.getItem('fallback_groq_key');
            if (provider) document.getElementById('llm-provider').value = provider;
            if (apiKey) document.getElementById('llm-api-key').value = apiKey;
            if (speed) document.getElementById('sim-speed').value = speed;
            if (fallbackKey) document.getElementById('fallback-groq-key').value = fallbackKey;
            if (!provider && typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed','fallback_groq_key'], data => {
                    if (data.llm_provider) document.getElementById('llm-provider').value = data.llm_provider;
                    if (data.llm_api_key) document.getElementById('llm-api-key').value = data.llm_api_key;
                    if (data.sim_speed) document.getElementById('sim-speed').value = data.sim_speed;
                    if (data.fallback_groq_key) document.getElementById('fallback-groq-key').value = data.fallback_groq_key;
                });
            }
            const langSelect = document.getElementById('lang-select');
            if (langSelect) langSelect.value = I18N.getLang();
        });
        // When switching provider, clear the API key input to enforce one-AI-at-a-time
        document.getElementById('llm-provider')?.addEventListener('change', () => {
            const provEl = document.getElementById('llm-provider');
            const keyEl = document.getElementById('llm-api-key');
            const savedProvider = localStorage.getItem('llm_provider');
            // If user switched to a different provider, clear the key field
            if (provEl.value !== savedProvider) {
                keyEl.value = '';
                keyEl.placeholder = provEl.value === 'none' ? t('不需要 API 金鑰') : t('請輸入新的 API 金鑰...');
            }
        });
        document.getElementById('settings-save')?.addEventListener('click', () => {
            const provider = document.getElementById('llm-provider').value;
            const apiKey = document.getElementById('llm-api-key').value;
            const speed = document.getElementById('sim-speed').value;
            const fallbackKey = document.getElementById('fallback-groq-key')?.value?.trim() || '';
            if (provider !== 'none' && !apiKey && !fallbackKey) {
                this._gameAlert(t('請輸入 API 金鑰，或填寫備用 Groq Key，或選擇「無（模擬對話）」。'), '🔑');
                return;
            }
            this.saveSettings(provider, apiKey, speed);
            const langSelect = document.getElementById('lang-select');
            if (langSelect) {
                I18N.setLang(langSelect.value);
                if (typeof renderCurrentTab === 'function') renderCurrentTab();
            }
            document.getElementById('settings-modal')?.classList.add('hidden');
            this._gameAlert(t('設定已儲存。'), '✅');
        });
        document.getElementById('settings-cancel')?.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.add('hidden');
        });
    }

    // --- Save / Load ---
    async saveGame() {
        try {
            // Track save count for achievement
            const sc = parseInt(localStorage.getItem('rimtown_save_count') || '0') + 1;
            localStorage.setItem('rimtown_save_count', sc.toString());
            const saveData = this.world.serialize();
            if (this.auth?.loggedIn) {
                // When logged in, only save to cloud — skip local storage
                try {
                    const clock = saveData.clock || {};
                    await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                        season: clock.season, year: clock.year, day: clock.day,
                        population: Object.keys(saveData.agents || {}).length,
                    });
                    this.world.logMessage('system', t('遊戲已儲存至雲端。'));
                } catch (e) {
                    console.error('[RimTown] Cloud save error:', e);
                    this.world.logMessage('system', t('雲端儲存失敗。'));
                }
            } else {
                // Not logged in — save locally
                if (this.currentTownId) {
                    this._saveCurrentTown();
                }
                const json = JSON.stringify(saveData);
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ rimtown_save: json });
                } else {
                    localStorage.setItem('rimtown_save', json);
                }
                this.world.logMessage('system', t('遊戲已儲存。'));
            }
            return true;
        } catch(e) {
            console.error('Save failed:', e);
            this.world.logMessage('system', t('儲存失敗。'));
            return false;
        }
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
        // Auto-save every 60 seconds (saveGame already handles cloud sync when logged in)
        this._autoSaveInterval = setInterval(() => {
            if (!this.world.paused) {
                this.saveGame();
            }
        }, 60000);
        // Also save when tab is closing
        window.addEventListener('beforeunload', () => {
            try {
                const saveData = this.world.serialize();
                const json = JSON.stringify(saveData);
                if (this.auth.loggedIn && this.auth._restUrl) {
                    // When logged in, only sync to cloud — skip local storage
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
                } else {
                    // Not logged in — save locally
                    if (this.currentTownId) {
                        this._saveCurrentTown();
                    }
                    if (typeof chrome !== 'undefined' && chrome.storage) {
                        chrome.storage.local.set({ rimtown_save: json });
                    } else {
                        localStorage.setItem('rimtown_save', json);
                    }
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
        const ck = saveData.clock || {};
        a.download = `rimtown_save_${ck.season || 'unknown'}_Y${ck.year || 1}D${ck.day || 1}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._gameAlert(t('存檔已匯出。'), '✅');
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
                    if (this.tileMap) this.tileMap.agentPositions = {};
                    this.render();
                    await this.saveGame();
                    this._gameAlert(t('存檔已匯入。'), '✅');
                } else {
                    this._gameAlert(t('讀取存檔失敗。'), '❌');
                }
            } catch(err) { this._gameAlert(t('無效的存檔：') + err.message, '❌'); }
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
            gameClock: `${clock.season || t('春季')}${t(' 第')}${clock.year || 1}${t('年 第')}${clock.day || 1}${t('天')}`,
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
        lines.push(t('=== 邊境鎮聊天記錄 ==='));
        lines.push(`${t('遊戲進度：')}${archive.gameClock}`);
        lines.push(`${t('玩家：')}${archive.playerName}`);
        lines.push(`${t('存檔時間：')}${archive.savedAt}`);
        lines.push(`NPC：${archive.npcNames.join('、')}`);
        lines.push(`${t('訊息數：')}${archive.messageCount}`);
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
        // Handle individual house sub-zone clicks — move to parent residential area
        let actualLocId = locationId;
        if (this.tileMap && this.tileMap._houseSubZones && this.tileMap._houseSubZones[locationId]) {
            actualLocId = this.tileMap._houseSubZones[locationId].parentLocId;
            this._selectedHouseSubZone = locationId; // Track which house was clicked
            // Show house detail panel after moving
            if (player && player.moveTo(actualLocId, this.world)) {
                this.state = this.world.getState();
                this.activeTab = 'detail';
                if (this._updateTabHighlight) this._updateTabHighlight('detail');
                this.selectedAgent = null; // Clear agent selection to show house view
                this.render();
            }
            return;
        }
        this._selectedHouseSubZone = null;
        if (player && player.moveTo(actualLocId, this.world)) {
            // Clear chat target when moving to a different location
            if (this.chatTarget && player.currentLocation !== this.state?.agents?.[this.chatTarget]?.current_location) {
                this.chatTarget = null;
                this.selectedAgent = null;
                if (this.activeTab === 'chat') {
                    this.activeTab = 'residents';
                    if (this._updateTabHighlight) this._updateTabHighlight('residents');
                }
            }
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
        // No proximity restriction — can message any NPC from anywhere

        // Add player message to history immediately so it renders before typing indicator
        const trimmedMsg = message.trim();
        const timeStr = this.world.clock?.timeStr || '';
        player.chatHistory.push({speaker:player.name, target:npc.name, text:trimmedMsg, time:timeStr});

        // Render player message immediately, then show typing indicator
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }

        // Show typing indicator
        this._showTypingIndicator(npc.name);

        try {
            // Add a natural delay (1.5-3s) so NPC doesn't reply instantly
            const typingDelay = 1500 + Math.random() * 1500;
            const [reply] = await Promise.all([
                this.world.conversationEngine.generatePlayerReply(player, npc, trimmedMsg, this.world),
                new Promise(r => setTimeout(r, typingDelay))
            ]);
            if (this.world.questSystem) this.world.questSystem.onChat();
            // Clear unread for this NPC
            if (this._chatUnread) this._chatUnread.delete(targetId);
            this.state = this.world.getState();
            this._hideTypingIndicator();
            if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
        } catch(e) {
            console.error('Chat error:', e);
            this._hideTypingIndicator();
        }
        this.chatSending = false;
    }

    // Update only chat messages area without full sidebar re-render (prevents flickering)
    _renderChatMessages() {
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl || !this.chatTarget) return;
        const player = this.state?.agents?.['player'];
        if (!player) return;
        const chatHistory = player.chat_history || [];
        const targetAgent = this.state.agents[this.chatTarget];
        const targetName = targetAgent?.name || this.chatTarget;
        const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
        let html = '';
        if (!filtered.length) {
            html = `<p class="muted-text chat-hint">${t('開始與')}${targetName}${t('對話吧！')}</p>`;
        }
        filtered.forEach(msg => {
            const isP = msg.speaker === player.name;
            html += `<div class="chat-bubble ${isP ? 'chat-player' : 'chat-npc'}">
                <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                <div class="chat-time">${msg.time || ''}</div></div>`;
        });
        msgEl.innerHTML = html;
    }

    _showTypingIndicator(name) {
        this._typingName = name;
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl) return;
        const existing = msgEl.querySelector('.chat-typing');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'chat-typing';
        div.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>';
        msgEl.appendChild(div);
        msgEl.scrollTop = msgEl.scrollHeight;
    }

    _hideTypingIndicator() {
        this._typingName = null;
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl) return;
        const existing = msgEl.querySelector('.chat-typing');
        if (existing) existing.remove();
    }

    startChatWith(agentId) {
        this.chatTarget = agentId;
        this.selectedAgent = agentId;
        this.activeTab = 'chat';
        this._focusChatInput = true;
        // Clear unread for this NPC
        if (this._chatUnread) this._chatUnread.delete(agentId);
        if (this._updateTabHighlight) this._updateTabHighlight('chat');
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('mobile-collapsed');
        this.renderSidebar();
        this.render();
    }

    // --- Render ---
    render() {
        if (!this.state) return;
        // Ensure NPC proactive message callback is set
        if (this.world?.conversationEngine && !this.world.conversationEngine.onNpcMessage) {
            this.world.conversationEngine.onNpcMessage = (npcId) => {
                if (!this._chatUnread) this._chatUnread = new Set();
                // Don't mark as unread if player is already chatting with this NPC
                if (this.activeTab === 'chat' && this.chatTarget === npcId) return;
                this._chatUnread.add(npcId);
                this._updateChatBadge();
            };
        }
        this.renderClock();
        this.renderMap();
        // Skip sidebar re-render when user is actively focused on any input/textarea/select
        // to prevent losing focus (especially on mobile where keyboard would dismiss)
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
            return; // preserve input focus
        }
        // Skip settings tab re-render during simulation ticks to prevent
        // unsaved form data (API keys etc.) from being wiped by innerHTML replacement
        if (this.activeTab === 'settings') return;
        this.renderSidebar();
    }

    renderClock() {
        const clock = this.state.clock;
        const clockEl = document.getElementById('clock-display');
        if (clockEl) clockEl.textContent = clock.time_str;
        const pauseBtn = document.getElementById('btn-pause');
        const resumeBtn = document.getElementById('btn-resume');
        if (this.state.paused) { pauseBtn?.classList.add('active'); resumeBtn?.classList.remove('active'); }
        else { pauseBtn?.classList.remove('active'); resumeBtn?.classList.add('active'); }
        const agentCount = Object.keys(this.state.agents).length;
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? `（+${travelCount}${t(' 外出）')}` : '';
        const popEl = document.getElementById('population-count');
        if (popEl) popEl.textContent = `${t('人口：')}${agentCount}${travelText}`;

        // Update town-info-bar in residents tab (real-time)
        const infoClockEl = document.querySelector('.town-info-clock');
        if (infoClockEl) infoClockEl.textContent = clock.time_str;
        const infoPopEl = document.querySelector('.town-info-pop');
        if (infoPopEl) infoPopEl.textContent = `👤 ${agentCount}${travelText}`;

        // Update mobile header clock & population
        const mobileClock = document.getElementById('mobile-clock');
        if (mobileClock) {
            const h = String(clock.hour || 0).padStart(2, '0');
            const m = String(clock.minute || 0).padStart(2, '0');
            mobileClock.textContent = `Y${clock.year} ${clock.season} D${clock.day} ${h}:${m}`;
        }
        const mobilePop = document.getElementById('mobile-population');
        if (mobilePop) mobilePop.textContent = `${agentCount}${t('人')}`;
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

        // Mobile sub-tab bar
        const isMobile = window.innerWidth <= 768;
        const mainTab = this._mobileSubToMain?.[this.activeTab] || this.activeTab;
        const group = isMobile && this._mobileTabGroups?.[mainTab];
        if (group && group.length > 1) {
            let subBar = '<div class="sub-tab-bar mobile-group-tabs">';
            group.forEach(_tw => {
                const active = this.activeTab === _tw.key ? ' class="active"' : '';
                subBar += `<button${active} data-action="mobile-group-tab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
            });
            subBar += '</div>';
            content.innerHTML = subBar;
            const subContent = document.createElement('div');
            content.appendChild(subContent);
            this._renderTabContent(subContent);
        } else {
            this._renderTabContent(content);
        }
    }

    _renderTabContent(content) {
        switch (this.activeTab) {
            case 'residents': this.renderResidentsList(content); break;
            case 'chat':
                if (this._viewingArchive) this.renderChatArchiveView(content);
                else this.renderChat(content);
                break;
            case 'chat-archives': this.renderChatArchiveList(content); break;
            case 'detail': this.renderAgentDetail(content); break;
            case 'economy': this.renderEconomy(content); break;
            case 'records': this.renderRecords(content); break;
            case 'events': this.renderEvents(content); break;
            case 'achievements': this.renderAchievements(content); break;
            case 'industry': this.renderIndustryAndFarm(content); break;
            case 'quest': this.renderQuest(content); break;
            case 'settings': this.renderSettings(content); break;
        }
    }

    renderChat(container) {
        const player = this.state?.agents?.['player'];
        if (!player) { container.innerHTML = '<p class="muted-text">Player not found.</p>'; return; }
        const chatHistory = player.chat_history || [];
        if (!this._chatUnread) this._chatUnread = new Set();

        // Job color map for avatars
        const JOB_AVATAR_COLORS = {
            mayor:'#c83040', doctor:'#e8e8f0', blacksmith:'#607080', cook:'#e88030',
            farmer:'#6a9a40', trader:'#8030a0', guard:'#3a5060', researcher:'#2868b8',
            miner:'#6a5040', priest:'#f0e070', carpenter:'#907060', tailor:'#d06080', default:'#8090a0'
        };

        // Build all NPC list with last message info
        const allNpcs = Object.entries(this.state.agents)
            .filter(([id]) => id !== 'player')
            .map(([id, a]) => {
                const msgs = chatHistory.filter(c => c.speaker === a.name || c.target === a.name);
                const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
                const jobKey = a.job?.key || 'default';
                const avatarColor = JOB_AVATAR_COLORS[jobKey] || JOB_AVATAR_COLORS.default;
                return { id, name: a.name, job: a.job?.title || '', jobKey, avatarColor, gender: a.gender || 'male', mood: a.mood_description, location: a.current_location, currentThought: a.current_thought || '', lastMsg, msgCount: msgs.length, hasUnread: this._chatUnread.has(id) };
            });

        // Sort: unread first, then by last message time (most recent first), then no-history alphabetically
        allNpcs.sort((a, b) => {
            if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
            if (a.lastMsg && b.lastMsg) return 0; // keep original order for both having messages
            if (a.lastMsg) return -1;
            if (b.lastMsg) return 1;
            return a.name.localeCompare(b.name);
        });

        // --- Contact list ---
        let contactsHtml = '<div class="chat-contacts">';
        contactsHtml += `<div class="chat-contacts-header">${t('聯絡人')}<span class="chat-contacts-count">${allNpcs.length}</span></div>`;
        contactsHtml += '<div class="chat-contacts-list">';
        allNpcs.forEach(npc => {
            const isActive = this.chatTarget === npc.id;
            const lastText = npc.lastMsg ? (npc.lastMsg.speaker === player.name ? `${t('你')}：${npc.lastMsg.text}` : npc.lastMsg.text) : t('尚未對話');
            const truncated = lastText.length > 20 ? lastText.slice(0, 20) + '...' : lastText;
            const avatarDataUrl = this.tileMap ? this.tileMap.renderAvatarDataURL(npc.jobKey, npc.gender) : null;
            const thoughtText = npc.currentThought ? this._escapeHtml(npc.currentThought.length > 18 ? npc.currentThought.slice(0, 18) + '...' : npc.currentThought) : '';
            contactsHtml += `<button class="chat-contact ${isActive ? 'active' : ''}" data-action="start-chat" data-val="${npc.id}">
                <div class="chat-contact-avatar chat-contact-avatar-pixel" style="background:${npc.avatarColor}">${avatarDataUrl ? `<img src="${avatarDataUrl}" class="avatar-pixel-art" alt="${npc.name}">` : `<span class="avatar-initial" style="color:#fff;font-weight:bold;font-size:1rem;text-shadow:0 1px 2px rgba(0,0,0,0.4)">${npc.name.charAt(0)}</span>`}<span class="mood-indicator mood-${npc.mood}"></span></div>
                <div class="chat-contact-info">
                    <div class="chat-contact-name">${npc.name}${npc.hasUnread ? '<span class="chat-unread-dot"></span>' : ''}</div>
                    <div class="chat-contact-job">${npc.job || t('無業')}</div>
                    ${thoughtText ? `<div class="chat-contact-thought">${thoughtText}</div>` : ''}
                    <div class="chat-contact-preview">${this._escapeHtml(truncated)}</div>
                </div>
                ${npc.lastMsg?.time ? `<div class="chat-contact-time">${npc.lastMsg.time}</div>` : ''}
            </button>`;
        });
        contactsHtml += '</div></div>';

        // --- Chat area ---
        let chatAreaHtml = '';
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const targetName = targetAgent?.name || this.chatTarget;
            const targetJob = targetAgent?.job?.title || '';
            const targetLoc = targetAgent?.current_location || '';

            // Chat header with NPC info
            chatAreaHtml += `<div class="chat-conv-header">
                <div class="chat-conv-name">${targetName}</div>
                <div class="chat-conv-detail">${targetJob}${targetLoc ? ' · ' + this._locationLabel(targetLoc) : ''}</div>
            </div>`;

            // Messages
            chatAreaHtml += '<div class="chat-messages" id="chat-messages">';
            const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
            if (!filtered.length) {
                chatAreaHtml += `<p class="muted-text chat-hint">${t('開始與')}${targetName}${t('對話吧！')}</p>`;
            }
            filtered.forEach(msg => {
                const isP = msg.speaker === player.name;
                chatAreaHtml += `<div class="chat-bubble ${isP ? 'chat-player' : 'chat-npc'}">
                    <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                    <div class="chat-time">${msg.time || ''}</div></div>`;
            });
            chatAreaHtml += '</div>';

            // Input — always available
            chatAreaHtml += `<div class="chat-input-area">
                <input type="text" id="chat-input" class="chat-input" placeholder="${t('輸入訊息')}..." ${this.chatSending ? 'disabled' : ''}>
                <button class="chat-send-btn" data-action="send-chat" ${this.chatSending ? 'disabled' : ''}>${this.chatSending ? '...' : t('送出')}</button></div>`;
        } else {
            chatAreaHtml += `<div class="chat-messages" id="chat-messages"><p class="muted-text chat-hint">${t('選擇一個居民開始聊天')}</p></div>`;
        }

        // Archive bar
        chatAreaHtml += `<div class="chat-archive-bar">
            <button class="btn-archive-view" data-action="show-archives">${t('歷史對話')}</button>
            <button class="btn-archive-save" data-action="manual-archive">${t('立即存檔')}</button>
        </div>`;

        container.innerHTML = contactsHtml + chatAreaHtml;
        this._scrollChatToBottom();
        const input = document.getElementById('chat-input');
        if (input && !this.chatSending && this._focusChatInput) {
            input.focus();
            this._focusChatInput = false;
        }
    }

    async showChatArchives() {
        this.activeTab = 'chat-archives';
        this._viewingArchive = null;
        this.renderSidebar();
    }

    async renderChatArchiveList(container) {
        const archives = await this.getChatArchives();
        let html = `<div class="archive-header">
            <button class="btn-back" data-action="back-to-chat">&larr; ${t('返回聊天')}</button>
            <h3>${t('聊天存檔')}</h3>
        </div>`;
        if (!archives.length) {
            html += t('<p class="muted-text" style="padding:12px">尚無存檔。開始新遊戲時聊天記錄會自動存檔。</p>');
        } else {
            html += '<div class="archive-list">';
            [...archives].reverse().forEach(a => {
                const date = new Date(a.savedAt).toLocaleDateString();
                html += `<div class="archive-item">
                    <div class="archive-info" data-action="view-archive" data-val="${a.id}">
                        <div class="archive-title">${a.gameClock} - ${a.playerName}</div>
                        <div class="archive-meta">${date} | ${a.messageCount}${t('則訊息 | ')}${a.npcNames.length}${t('位')}NPC</div>
                        <div class="archive-npcs">${a.npcNames.slice(0, 5).join(', ')}${a.npcNames.length > 5 ? '...' : ''}</div>
                    </div>
                    <div class="archive-actions">
                        <button data-action="export-archive" data-val="${a.id}" title="${t('匯出">')}${t('匯出')}</button>
                        <button data-action="delete-archive" data-val="${a.id}" title="${t('刪除')}" class="btn-danger">${t('刪除')}</button>
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
            <button class="btn-back" data-action="back-to-archives">&larr; ${t('返回列表')}</button>
            <h3>${archive.gameClock}</h3>
            <div class="archive-meta">${archive.playerName} | ${archive.messageCount}${t('則訊息')}</div>
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
            html += t('<p class="muted-text chat-hint">找不到訊息。</p>');
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
            <button class="btn-archive-save" data-action="export-archive" data-val="${archive.id}">${t('匯出此對話記錄')}</button>
        </div>`;

        container.innerHTML = html;
        this._scrollChatToBottom();
    }

    async manualArchiveChat() {
        const result = await this.archiveChatHistory();
        if (result) {
            this.world.logMessage('system', `${t('聊天已存檔（')}${result.messageCount}${t('則訊息）。')}`);
        } else {
            this.world.logMessage('system', t('沒有聊天訊息可存檔。'));
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
        if (!await this._gameConfirm(t('確定刪除此聊天存檔？'), '🗑️')) return;
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

    _updateChatBadge() {
        const count = this._chatUnread ? this._chatUnread.size : 0;
        const tab = document.querySelector('[data-tab="chat"]');
        if (!tab) return;
        let badge = tab.querySelector('.chat-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                tab.style.position = 'relative';
                tab.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : count;
        } else if (badge) {
            badge.remove();
        }
    }

    _renderSkills(skillsData) {
        if (!skillsData?.skills) return t('<p class="muted-text">沒有技能資料</p>');
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

    // ============================================================
    // Custom NPC Creation Modal
    // ============================================================
    _showCustomNPCModal() {
        if (!this.world.customNPC) return;

        // Remove existing modal if any
        document.getElementById('custom-npc-modal')?.remove();

        const traits = typeof CUSTOM_NPC_TRAITS !== 'undefined' ? CUSTOM_NPC_TRAITS : [];
        const jobs = typeof CUSTOM_NPC_JOBS !== 'undefined' ? CUSTOM_NPC_JOBS : [];
        const values = typeof CUSTOM_NPC_VALUES !== 'undefined' ? CUSTOM_NPC_VALUES : [];

        let html = `<div id="custom-npc-modal" class="modal" style="display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999">`;
        html += `<div class="modal-content" style="max-width:450px;width:90%;max-height:85vh;overflow-y:auto;padding:24px">`;
        html += t('<h2>👤 創建新居民</h2>');

        // Name
        html += t('<div class="setting-group"><label>名字</label>');
        html += t('<input type="text" id="custom-npc-name" maxlength="10" placeholder="輸入名字（最多10字）" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:inherit"></div>');

        // Gender
        html += t('<div class="setting-group"><label>性別</label>');
        html += `<div style="display:flex;gap:12px">`;
        html += t('<label style="cursor:pointer"><input type="radio" name="custom-npc-gender" value="male" checked> ♂ 男</label>');
        html += t('<label style="cursor:pointer"><input type="radio" name="custom-npc-gender" value="female"> ♀ 女</label>');
        html += `</div></div>`;

        // Age
        html += t('<div class="setting-group"><label>年齡 <span id="custom-npc-age-display" style="color:var(--accent)">25</span></label>');
        html += `<input type="range" id="custom-npc-age" min="16" max="60" value="25" style="width:100%" oninput="document.getElementById('custom-npc-age-display').textContent=this.value"></div>`;

        // Traits (checkboxes, max 3)
        html += t('<div class="setting-group"><label>性格特質（選 1-3 個）</label>');
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
        for (const t of traits) {
            html += `<label style="cursor:pointer;font-size:0.8rem;padding:4px"><input type="checkbox" class="custom-npc-trait" value="${t.key}"> ${t.icon} ${t.label}</label>`;
        }
        html += `</div></div>`;

        // Job
        html += t('<div class="setting-group"><label>職業偏好</label>');
        html += `<select id="custom-npc-job" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:inherit">`;
        for (const j of jobs) {
            html += `<option value="${j.key}">${j.icon} ${j.label}</option>`;
        }
        html += `</select></div>`;

        // Values
        html += t('<div class="setting-group"><label>在意的事（選 1-3 個）</label>');
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
        for (const v of values) {
            html += `<label style="cursor:pointer;font-size:0.8rem;padding:4px"><input type="checkbox" class="custom-npc-value" value="${v}"> ${v}</label>`;
        }
        html += `</div></div>`;

        // Background
        html += t('<div class="setting-group"><label>背景故事（選填，最多 200 字）</label>');
        html += t('<textarea id="custom-npc-background" maxlength="200" rows="3" placeholder="從遠方來的旅人，帶著一段不願提起的過去..." style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:inherit;resize:vertical"></textarea></div>');

        // Error display
        html += `<div id="custom-npc-error" style="color:var(--negative);font-size:0.8rem;min-height:20px;margin-bottom:8px"></div>`;

        // Buttons
        html += `<div class="modal-buttons">`;
        html += t('<button class="btn-accent" data-action="create-custom-npc">創建</button>');
        html += t('<button data-action="close-custom-npc">取消</button>');
        html += `</div>`;

        html += `</div></div>`;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    _createCustomNPC() {
        if (!this.world.customNPC) return;

        const name = document.getElementById('custom-npc-name')?.value?.trim();
        const gender = document.querySelector('input[name="custom-npc-gender"]:checked')?.value || 'male';
        const age = parseInt(document.getElementById('custom-npc-age')?.value || '25');
        const job = document.getElementById('custom-npc-job')?.value || 'farmer';
        const background = document.getElementById('custom-npc-background')?.value?.trim() || '';

        const traits = Array.from(document.querySelectorAll('.custom-npc-trait:checked')).map(cb => cb.value);
        const values = Array.from(document.querySelectorAll('.custom-npc-value:checked')).map(cb => cb.value);

        const config = { name, gender, age, job, traits, values, background };
        const result = this.world.customNPC.createCustomNPC(config, this.world);

        if (!result.success) {
            const errorEl = document.getElementById('custom-npc-error');
            if (errorEl) errorEl.textContent = result.error;
            return;
        }

        // Success — close modal and refresh
        document.getElementById('custom-npc-modal')?.remove();
        this.state = this.world.getState();
        this.renderSidebar();
    }

    // ============================================================
    // Ending overlay
    // ============================================================
    _showEndingOverlay() {
        if (!this.world.multiEnding?.endingData) return;
        document.getElementById('ending-overlay')?.remove();

        const html = this.world.multiEnding.renderEndingHTML();

        const wrapper = document.createElement('div');
        wrapper.id = 'ending-overlay';
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    }

    async _startNewGamePlus() {
        // Confirm
        if (!await this._gameConfirm(t('確定要開始二周目嗎？\n\n將繼承：50% 銀幣、已建建築、已開發產業、部分繁榮度\n鎮民會記得上一代的故事。\n\n當前遊戲進度將被覆蓋。'), '🔄')) return;

        // Remove ending overlay
        document.getElementById('ending-overlay')?.remove();
        this._endingShown = false;

        // Pause simulation during transition
        if (this.simInterval) clearInterval(this.simInterval);

        // Start new game plus
        const legacy = this.world.startNewGamePlus();

        // Re-init conversation engine
        if (this.llmClient) {
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        }

        // Reset app state
        this.chatTarget = null;
        this.selectedAgent = null;
        this.agentColors = {};
        this.state = this.world.getState();

        // Regenerate tile map
        this._generateTileMapLayout();
        if (this.tileMap) this.tileMap.agentPositions = {};

        // Save
        this._saveCurrentTown();

        // Restart simulation
        this.startSimulation();

        // Update UI
        this.render();

        // Show transition message
        const gen = this.world._legacyGeneration || 2;
        const heirName = legacy.heir?.name || t('新旅人');
        const msg = legacy.heir
            ? `${t('第')}${gen}${t('代開始！')}${heirName}${t('繼承了')}${legacy.previousPlayerName}${t('的一切，踏上了新的旅程。')}`
            : `${t('第')}${gen}${t('代開始！一位新的旅人帶著')}${legacy.previousPlayerName}${t('的遺產來到了邊境鎮。')}`;

        setTimeout(() => {
            this.world.logMessage('system', `🌅 ═══════════════════════════`);
            this.world.logMessage('system', `🔄 ${msg}`);
            this.world.logMessage('system', `🌅 ═══════════════════════════`);
            this.state = this.world.getState();
            this.render();
        }, 500);
    }

    renderResidentsList(container) {
        if (!this.state) return;
        let html = '';
        // Town info bar (moved from header)
        const clock = this.state.clock || {};
        const popCount = Object.keys(this.state.agents || {}).length;
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? `（+${travelCount}${t(' 外出）')}` : '';
        const townName = this._getCurrentTownName() || t('邊境鎮');
        const gen = this.world._legacyGeneration || 1;
        const genText = gen > 1 ? `${t(' <span style="font-size:10px;color:#f0c040;margin-left:4px">第')}${gen}${t('代</span>')}` : '';
        html += `<div class="town-info-bar">
            <span class="town-info-name">${townName}${genText}</span>
            <span class="town-info-pop">👤 ${popCount}${travelText}</span>
            <span class="town-info-clock">${clock.time_str || ''}</span>
        </div>`;
        // Player card at top
        const playerAgent = this.state.agents['player'];
        if (playerAgent) {
            const isSelected = this.selectedAgent === 'player';
            const playerJobTitle = playerAgent.job?.title || t('無業');
            const playerIsJobless = !playerAgent.job?.key;
            html += `<div class="resident-card player-card ${isSelected?'selected':''}" data-action="select-agent" data-val="player">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${playerAgent.mood_description}"></span>⭐ ${playerAgent.name}${t('（你）')}</span>
                    <span class="resident-job">${playerJobTitle}</span></div>
                <div class="resident-status"><span>@ ${this._locationLabel(playerAgent.current_location)}</span><span>${playerAgent.mood_label||playerAgent.mood_description} (${playerAgent.mood})</span></div>`;
            if (playerIsJobless) {
                html += t('<div style="margin-top:6px;padding:6px 8px;background:rgba(255,200,50,0.1);border:1px solid rgba(255,200,50,0.3);border-radius:6px;font-size:0.75rem;color:#ffc832">💡 你目前無業！點擊下方職業按鈕選擇工作：</div>');
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`;
                const jobDefs = typeof JOB_DEFINITIONS !== 'undefined' ? JOB_DEFINITIONS : {};
                for (const [k, v] of Object.entries(jobDefs)) {
                    if (k === 'mayor') continue;
                    html += `<button class="job-btn" data-action="player-choose-job" data-val="${k}" style="font-size:0.7rem;padding:5px 10px;border:1px solid rgba(255,255,255,0.3)">${v.title}</button>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }
        for (const [aid, agent] of Object.entries(this.state.agents)) {
            if (aid === 'player') continue;
            const isSelected = this.selectedAgent === aid;
            const player = this.state.agents['player'];
            const sameLoc = player && player.current_location === agent.current_location;
            const genderIcon = agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : '';
            html += `<div class="resident-card ${isSelected?'selected':''}" data-action="select-agent" data-val="${aid}">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${genderIcon} ${agent.name}${sameLoc?t('<span class="nearby-badge">附近</span>'):''}</span>
                    <span class="resident-job">${agent.job?.title||t('無業')}</span></div>
                <div class="resident-status"><span>${agent.activity_label||agent.activity} @ ${this._locationLabel(agent.current_location)}</span><span>${agent.mood_label||agent.mood_description} (${agent.mood})</span></div>
                ${agent.current_thought?`<div style="font-size:0.7rem;color:#aaa;margin-top:4px;font-style:italic">「${agent.current_thought}」</div>`:''}
                <button class="chat-with-btn" data-action="start-chat" data-val="${aid}">${sameLoc?t('對話'):t('前往對話')}</button></div>`;
        }

        // Custom NPC creation button
        if (this.world.customNPC) {
            const remaining = this.world.customNPC.getRemainingSlots();
            const canCreate = this.world.customNPC.canCreate(this.world);
            const cost = this.world.customNPC.creationCost;
            html += `<div style="margin-top:12px;padding:10px;border-top:1px solid rgba(255,255,255,0.1)">`;
            if (remaining > 0) {
                html += `<button class="btn-accent" data-action="show-custom-npc" style="width:100%;padding:8px;font-size:0.85rem"${!canCreate ? ' disabled style="opacity:0.5;width:100%;padding:8px;font-size:0.85rem"' : ''}>`;
                html += `${t('👤 創建新居民 (剩餘 ')}${remaining}${t(' 位)')}`;
                html += `</button>`;
                html += `${t('<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;text-align:center">需要 ')}${cost.silver}${t(' 銀幣 + ')}${cost.food}${t(' 食物</div>')}`;
            } else {
                html += `${t('<div style="font-size:0.8rem;color:var(--text-muted);text-align:center">已達自訂居民上限 (')}${this.world.customNPC.maxCustomNPCs}/${this.world.customNPC.maxCustomNPCs})</div>`;
            }
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    renderAgentDetail(container) {
        // Show house detail if a house sub-zone was clicked
        if (!this.selectedAgent && this._selectedHouseSubZone && this.tileMap) {
            this._renderHouseDetail(container, this._selectedHouseSubZone);
            return;
        }
        if (!this.selectedAgent || !this.state) { container.innerHTML = t('<p class="muted-text" style="padding:20px">選擇一位居民查看詳情</p>'); return; }
        const agent = this.state.agents[this.selectedAgent]; if (!agent) return;
        const needs = agent.needs || {}, personality = agent.personality || {};
        const relationships = agent.relationships || [], memories = agent.recent_memories || [];
        const TRAIT_LABELS = {kind:t('善良'),abrasive:t('刻薄'),shy:t('害羞'),charismatic:t('魅力'),gossip:t('八卦'),hardworking:t('勤勞'),lazy:t('懶惰'),perfectionist:t('完美主義'),creative:t('有創意'),optimist:t('樂觀'),pessimist:t('悲觀'),neurotic:t('神經質'),stoic:t('沉穩'),romantic:t('浪漫'),jealous:t('嫉妒'),night_owl:t('夜貓子'),early_bird:t('早起鳥'),glutton:t('貪吃'),ascetic:t('苦行'),curious:t('好奇')};
        const makeBar = (label, value) => {
            const cls = value > 60 ? 'high' : value > 30 ? 'medium' : 'low';
            return `<div class="needs-bar"><label>${label}</label><div class="bar"><div class="bar-fill ${cls}" style="width:${value}%"></div></div><span style="width:30px;text-align:right;font-size:0.6rem">${Math.round(value)}</span></div>`;
        };
        const player = this.state.agents['player'];
        const sameLoc = player && player.current_location === agent.current_location && this.selectedAgent !== 'player';
        let interactionBtns = '';
        if (sameLoc) {
            interactionBtns += `<button class="chat-with-btn" data-action="start-chat" data-val="${this.selectedAgent}${t('">對話</button>')}`;
            // Flirt / Propose buttons
            const playerRel = player.relationships?.find(r => r.target_id === this.selectedAgent || r.target_name === agent.name);
            if (playerRel) {
                interactionBtns += ` <button class="btn-flirt" data-action="player-flirt" data-val="${this.selectedAgent}${t('">調情</button>')}`;
                if (playerRel.romantic_interest > 30 && !playerRel.status) {
                    interactionBtns += ` <button class="btn-propose" data-action="player-propose" data-val="${this.selectedAgent}${t('">告白</button>')}`;
                }
                if (playerRel.status === 'dating') {
                    interactionBtns += ` <button class="btn-propose" data-action="player-propose" data-val="${this.selectedAgent}${t('">求婚</button>')}`;
                }
            } else {
                interactionBtns += ` <button class="btn-flirt" data-action="player-flirt" data-val="${this.selectedAgent}${t('">調情</button>')}`;
            }
        }
        const chatBtn = interactionBtns;
        // Build relationship status summary
        const partner = relationships.find(r => r.status === 'dating' || r.status === 'married');
        const exes = relationships.filter(r => r.status === 'ex');
        const cheating = relationships.filter(r => r.is_cheating);
        const crushes = relationships.filter(r => r.romantic_interest > 30 && !r.status);
        let loveStatus = t('單身');
        if (partner) {
            loveStatus = partner.status === 'married'
                ? `${t('已與<b>')}${partner.target_name}${t('</b>結婚')}`
                : `${t('正在與<b>')}${partner.target_name}${t('</b>交往')}`;
        }
        if (cheating.length) {
            loveStatus += `${t(' <span style="color:var(--negative)">（同時與')}${cheating.map(c=>c.target_name).join('、')}${t('有秘密關係）</span>')}`;
        }
        if (crushes.length && !partner) {
            loveStatus += `${t('，暗戀')}${crushes.map(c=>`<b>${c.target_name}</b>`).join('、')}`;
        }
        if (exes.length) {
            loveStatus += `${t('（前任：')}${exes.map(e=>e.target_name).join('、')}）`;
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
            <div class="detail-section"><h3>${agent.name}（${agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : ''}${agent.gender_label} · ${agent.age}${t('歲）')}</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||t('無業')} | ${agent.mood_label||agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${personality.background||''}</p>${chatBtn}</div>
            <div class="detail-section"><h3>${t('性格')}</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${TRAIT_LABELS[t]||t}</span>`).join('')}
                <div style="margin-top:4px;font-size:0.7rem;color:var(--text-secondary)">${t('價值觀：')}${(personality.values||[]).join('、')}</div></div>
            <div class="detail-section"><h3>${t('感情狀態')}</h3>
                <p style="font-size:0.8rem">${loveStatus}</p></div>
            ${this.selectedAgent === 'player' ? this._renderPlayerJobPanel(agent) : ''}
            <div class="detail-section"><h3>${t('需求')}</h3>${makeBar(t('飢餓'),needs.hunger||0)}${makeBar(t('休息'),needs.rest||0)}${makeBar(t('社交'),needs.social||0)}${makeBar(t('舒適'),needs.comfort||0)}${makeBar(t('娛樂'),needs.recreation||0)}</div>
            <div class="detail-section"><h3>${t('技能（總計：')}${agent.skills?.total_level||0}）</h3>${this._renderSkills(agent.skills)}</div>
            <div class="detail-section"><h3>${t('人際關係（')}${relationships.length}）</h3>
                ${sortedRels.length===0?t('<p style="font-size:0.7rem;color:var(--text-muted)">尚無人際關係</p>'):
                sortedRels.map(r=>{
                    let badge = '';
                    if (r.status === 'married') badge = t('<span class="rel-status-badge rel-married">💍 已婚</span>');
                    else if (r.status === 'dating') badge = t('<span class="rel-status-badge rel-dating">💕 交往中</span>');
                    else if (r.status === 'ex') badge = t('<span class="rel-status-badge rel-ex">💔 前任</span>');
                    if (r.is_cheating) badge += t(' <span class="rel-status-badge rel-cheating">🤫 秘密關係</span>');
                    const romHeart = r.romantic_interest > 0 ? ` <span style="color:#f472b6">&#10084;${r.romantic_interest}</span>` : '';
                    const crushIcon = r.romantic_interest > 30 && !r.status ? t(' <span style="color:#f472b6;font-size:0.75rem">暗戀</span>') : '';
                    return `<div class="relationship-item${r.status?' rel-has-status':''}"><span>${r.target_name} ${badge}${crushIcon}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type}（${r.affinity>0?'+':''}${r.affinity}）${romHeart}</span></div>`;
                }).join('')}</div>
            ${this._renderAgentFactions(this.selectedAgent)}
            <div class="detail-section"><h3>${t('近期記憶')}</h3>
                ${memories.length===0?t('<p style="font-size:0.7rem;color:var(--text-muted)">尚無記憶</p>'):
                memories.slice(-10).reverse().map(m=>`<div class="memory-item"><span class="memory-time">${m.time}</span>${m.content}</div>`).join('')}</div></div>`;
    }

    // =====================================================
    // HOUSE DETAIL (when clicking individual houses)
    // =====================================================
    _renderHouseDetail(container, houseSubId) {
        const sub = this.tileMap._houseSubZones?.[houseSubId];
        if (!sub) { container.innerHTML = t('<p class="muted-text" style="padding:20px">選擇一位居民查看詳情</p>'); return; }
        const residents = this.tileMap.getHouseResidents(houseSubId);
        const areaLabels = { residential_north: t('北區住宅'), residential_south: t('南區住宅'), residential_east: t('東區住宅') };
        const areaName = areaLabels[sub.parentLocId] || sub.parentLocId;
        const houseNum = sub.houseIndex + 1;
        let html = `<div class="detail-panel visible">`;
        html += `<div class="detail-section"><h3>🏠 ${areaName} - ${t('房屋')} #${houseNum}</h3></div>`;
        html += `<div class="detail-section"><h3>${t('住戶')}（${residents.length}）</h3>`;
        if (residents.length === 0) {
            html += `<p style="font-size:0.8rem;color:var(--text-secondary)">${t('這間房子目前沒有住戶。')}</p>`;
        } else {
            html += `<div class="resident-list">`;
            for (const aid of residents) {
                const agent = this.state?.agents[aid];
                if (!agent) continue;
                const jobTitle = agent.job?.title || t('無業');
                const moodIcon = agent.mood > 70 ? '😊' : agent.mood > 30 ? '😐' : '😢';
                html += `<div class="res-item" data-action="select-agent" data-val="${aid}" style="cursor:pointer;padding:8px;margin:4px 0;border-radius:6px;background:var(--bg-secondary)">
                    <div style="font-weight:600">${moodIcon} ${agent.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary)">${jobTitle} · ${agent.age}${t('歲')} · ${agent.activity_label || agent.activity || ''}</div>
                </div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;
        container.innerHTML = html;
    }

    // =====================================================
    // SETTINGS TAB (consolidated AI + Account + Game settings)
    // =====================================================
    renderSettings(container) {
        // Preserve unsaved form values from existing DOM inputs (prevents
        // renderSidebar() calls from wiping user-typed/pasted API keys)
        const existingProvider = document.getElementById('settings-tab-provider');
        const existingApiKey = document.getElementById('settings-tab-apikey');
        const existingSpeed = document.getElementById('settings-tab-speed');
        const existingGroq = document.getElementById('settings-tab-groq');
        const provider = existingProvider ? existingProvider.value : (localStorage.getItem('llm_provider') || 'none');
        const apiKey = existingApiKey ? existingApiKey.value : (localStorage.getItem('llm_api_key') || '');
        const speed = existingSpeed ? existingSpeed.value : (localStorage.getItem('sim_speed') || '2000');
        const fallbackKey = existingGroq ? existingGroq.value : (localStorage.getItem('fallback_groq_key') || '');
        const loggedIn = this.auth.loggedIn;
        const username = this.auth.username;
        const paused = this.world?.paused;

        let html = '';

        // --- Game Control Section ---
        const currentMultiplier = this._speedMultiplier || 1;
        html += t('<div class="econ-section"><h3>🎮 遊戲控制</h3>');
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
            <div class="speed-controls">
                ${[1, 1.5, 2, 3].map(s => `<button class="btn-speed${currentMultiplier===s?' active':''}" data-action="settings-speed-mult" data-val="${s}">${s}x</button>`).join('')}
            </div>
        </div>`;
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="trade-btn" data-action="show-towns">📋 ${t('城鎮列表')}</button>
            <button class="trade-btn" data-action="settings-new-map">🗺️ ${t('新地圖')}</button>
        </div>`;
        html += '</div>';

        // --- Account & Save Section (merged) ---
        html += t('<div class="econ-section"><h3>💾 帳號與存檔</h3>');
        if (loggedIn) {
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <span style="color:var(--positive)">● ${t('已登入')}</span>
                <strong>${this._escapeHtml(username)}</strong>
            </div>
            <p style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:8px">${t('存檔會自動同步至雲端，在任何裝置登入即可讀取。')}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="trade-btn btn-accent" data-action="settings-save-game">${t('儲存遊戲')}</button>
                <button class="trade-btn" data-action="settings-logout" style="background:var(--negative);color:#fff">${t('登出')}</button>
            </div>`;
        } else {
            html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <button class="trade-btn btn-accent" data-action="settings-save-game">${t('儲存遊戲')}</button>
            </div>
            <p style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:8px">${t('登入後存檔會自動同步至雲端，在任何裝置都能讀取。')}</p>
            <div style="display:flex;gap:6px">
                <button class="trade-btn" data-action="settings-login">${t('登入')}</button>
                <button class="trade-btn" data-action="settings-register">${t('註冊')}</button>
            </div>`;
        }
        html += '</div>';

        // --- AI Settings Section ---
        const aiConnected = !!(this.llmClient && this.world?.conversationEngine?.llm);
        const aiLabel = aiConnected ? 'AI:' + this.llmClient.provider + (this.llmClient.fallbackGroqKey ? t('+備用') : '') : t('AI:未連接');
        html += t('<div class="econ-section"><h3>🤖 AI 語言模型</h3>');
        html += `<div style="margin-bottom:8px"><span class="llm-status ${aiConnected ? 'connected' : 'disconnected'}">${aiLabel}</span></div>`;
        html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">AI ${t('供應商')}</label>
            <select id="settings-tab-provider" style="width:100%;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem">
                <option value="none"${provider==='none'?' selected':''}>${t('無（模擬對話）')}</option>
                <option value="anthropic"${provider==='anthropic'?' selected':''}>Anthropic (Claude)</option>
                <option value="openai"${provider==='openai'?' selected':''}>OpenAI (GPT)</option>
                <option value="gemini"${provider==='gemini'?' selected':''}>Google (Gemini)</option>
                <option value="deepseek"${provider==='deepseek'?' selected':''}>DeepSeek</option>
                <option value="groq"${provider==='groq'?' selected':''}>Groq</option>
                <option value="together"${provider==='together'?' selected':''}>Together AI</option>
                <option value="minimax"${provider==='minimax'?' selected':''}>MiniMax (${t('海螺')}AI)</option>
            </select>
        </div>
        <div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">API ${t('金鑰')}</label>
            <div style="display:flex;gap:6px;align-items:center">
                <input type="password" id="settings-tab-apikey" value="${this._escapeHtml(apiKey)}" placeholder="${t('輸入你的')} API ${t('金鑰')}..." style="flex:1;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem;box-sizing:border-box">
                <button id="btn-test-apikey" data-action="test-apikey" style="padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);cursor:pointer;font-size:0.75rem;white-space:nowrap">${t('測試連線')}</button>
            </div>
            <div id="apikey-status" style="margin-top:4px;font-size:0.75rem;display:flex;align-items:center;gap:4px"></div>
        </div>
        <div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">${t('備用')} Groq API Key <span style="font-size:0.75rem">${t('（主 AI ')}${t('超限時自動切換）')}</span></label>
            <div style="display:flex;gap:6px;align-items:center">
                <input type="password" id="settings-tab-groq" value="${this._escapeHtml(fallbackKey)}" placeholder="gsk_...${t('（選填）')}" style="flex:1;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem;box-sizing:border-box">
                <button id="btn-test-groq" data-action="test-groqkey" style="padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);cursor:pointer;font-size:0.75rem;white-space:nowrap">${t('測試連線')}</button>
            </div>
            <div id="groqkey-status" style="margin-top:4px;font-size:0.75rem;display:flex;align-items:center;gap:4px"></div>
        </div>`;
        html += '</div>';

        // --- Game Settings Section ---
        html += t('<div class="econ-section"><h3>⚡ 模擬速度</h3>');
        html += `<div class="setting-group" style="margin-bottom:8px">
            <select id="settings-tab-speed" style="width:100%;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem">
                <option value="3000"${speed==='3000'?' selected':''}>${t('慢速（3')}${t('秒）')}</option>
                <option value="2000"${speed==='2000'?' selected':''}>${t('正常（2')}${t('秒）')}</option>
                <option value="1000"${speed==='1000'?' selected':''}>${t('快速（1')}${t('秒）')}</option>
                <option value="500"${speed==='500'?' selected':''}>${t('極快（')}0.5${t('秒）')}</option>
            </select>
        </div>`;
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            <button class="trade-btn btn-accent" data-action="settings-save-all">${t('儲存設定')}</button>
        </div>`;
        html += '</div>';

        // (Save section merged into Account section above)

        // --- Version ---
        html += `<div style="text-align:center;padding:10px;font-size:0.75rem;color:var(--text-muted)">v${typeof RIMTOWN_APP_VERSION!=='undefined'?RIMTOWN_APP_VERSION:'?'}</div>`;

        container.innerHTML = html;
    }

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();
        let html = '';

        // Show recent NPC conversations at the top
        const npcConvos = (this.state.npc_conversations || []).slice().reverse();
        if (npcConvos.length) {
            html += t('<div class="npc-convo-section"><h4 style="padding:8px 10px;color:var(--accent);font-size:0.8rem;margin:0">村民對話</h4>');
            npcConvos.slice(0, 8).forEach(c => {
                html += `<div class="npc-convo-entry expanded" data-action="toggle-convo">
                    <div class="npc-convo-header"><span class="npc-convo-toggle">▶</span><span class="log-time">${c.time}</span><strong>${c.agentA}</strong> &amp; <strong>${c.agentB}</strong>
                    <span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px">@ ${this._locationLabel(c.location)}</span></div>
                    <div class="npc-convo-summary">${c.summary}</div>
                    <div class="npc-convo-dialogue">`;
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
        container.innerHTML = html || t('<p class="muted-text" style="padding:20px">尚無訊息...</p>');
    }

    renderEvents(container) {
        if (!this.state) return;
        let html = '';

        // --- Election ---
        const election = this.state.election;
        if (election && election.active) {
            html += '<div class="election-section">';
            if (election.phase === 'campaign') {
                html += t('<h4>📢 鎮長選舉 — 競選期間</h4>');
                html += `${t('<div class="election-info">剩餘 ')}${election.campaignDaysLeft}${t(' 天競選期</div>')}`;
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
                html += t('<h4>🗳️ 鎮長選舉 — 投票進行中</h4>');
                html += `${t('<div class="election-info">剩餘 ')}${election.votingDaysLeft}${t(' 天投票</div>')}`;
                const playerVoted = this.world.election?._playerVoted;
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    html += `<div class="election-candidate">
                        <div class="candidate-header">
                            <span class="candidate-name">${c.name}</span>
                            <span class="candidate-policy">${c.policyIcon} ${c.policyLabel}</span>
                            <span class="candidate-votes">${c.votes}${t(' 票（')}${pct}%）</span>
                        </div>
                        <div class="election-bar"><div class="election-bar-fill" style="width:${pct}%"></div></div>
                        ${!playerVoted ? `<button class="btn-vote" data-action="player-vote" data-val="${c.agentId}">投票給${c.name}</button>` : ''}
                    </div>`;
                });
                html += `${t('<div class="election-total">已投票：')}${totalVotes}${t(' 人')}${playerVoted ? t(' (你已投票)') : ''}</div>`;
            } else if (election.phase === 'results') {
                const winner = election.candidates[0];
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                html += t('<h4>🏆 選舉結果</h4>');
                if (winner) {
                    html += `<div class="election-winner">
                        <div class="winner-name">${winner.name} ${t('當選鎮長！')}</div>
                        <div class="winner-policy">${t('施政方針：')}${winner.policyIcon} ${winner.policyLabel}</div>
                    </div>`;
                }
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    const isWinner = c === election.candidates[0];
                    html += `<div class="election-candidate ${isWinner ? 'election-winner-card' : ''}">
                        <span class="candidate-name">${isWinner ? '👑 ' : ''}${c.name}</span>
                        <span class="candidate-policy">${c.policyIcon}</span>
                        <span class="candidate-votes">${c.votes}${t(' 票（')}${pct}%）</span>
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
                <span>${t('上次選舉：')}${last.winner.name}${t(' 當選（')}${last.winner.policyIcon || ''}${ELECTION_POLICIES_LABELS[last.winner.policy] || last.winner.policy}，${last.winner.votes}/${last.totalVotes} ${t('票）')}</span>
            </div>`;
        }

        // --- News Bulletins ---
        const news = this.state.news || {};
        const bulletins = news.bulletins || [];
        if (bulletins.length) {
            html += t('<div class="news-section"><h4>📰 新聞公告</h4><div class="news-ticker">');
            const CATEGORY_LABELS = {security:t('安全'),trade:t('貿易'),weather:t('天氣'),social:t('社會'),health:t('健康'),discovery:t('發現'),nature:t('自然'),political:t('政治')};
            bulletins.forEach(b => {
                const severityIcon = {good:'🟢',info:'🔵',warning:'🟡',danger:'🔴'}[b.severity] || '⚪';
                const categoryIcon = {security:'🛡️',trade:'📦',weather:'🌤️',social:'👥',health:'🏥',discovery:'🔍',nature:'🌿',political:'⚔️'}[b.category] || '📋';
                html += `<div class="news-bulletin severity-${b.severity}">
                    <div class="news-header">
                        <span class="news-severity">${severityIcon}</span>
                        <span class="news-category">${categoryIcon} ${CATEGORY_LABELS[b.category]||b.category}</span>
                        <span class="news-duration">${t('剩餘')}${b.days_remaining}${t('天')}</span>
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
                html += t('<div class="news-effects"><span class="news-effects-label">生效中：</span> ');
                modEntries.forEach(([key, val]) => {
                    const effectLabels = {food_production:t('食物產量'),mine_output:t('礦產產出'),trade_prices:t('交易價格'),construction_speed:t('建設速度'),mood_bonus:t('心情加成'),crop_growth:t('作物生長'),merchant_frequency:t('商人頻率')};
                    const label = effectLabels[key] || key.replace(/_/g,' ');
                    const cls = (typeof val === 'number' && val > 0) ? 'effect-positive' : (typeof val === 'number' && val < 0) ? 'effect-negative' : 'effect-neutral';
                    const display = typeof val === 'number' ? (val > 0 ? '+' : '') + Math.round(val*100) + '%' : (val ? t('是') : t('否'));
                    html += `<span class="news-effect ${cls}">${label}: ${display}</span> `;
                });
                html += '</div>';
            }
            html += '</div>';
        }

        // --- AI 日報 ---
        const dailyNews = this.state.dailyNews || {};
        const papers = dailyNews.newspapers || [];
        if (papers.length > 0) {
            html += t('<div class="news-section"><h4>🗞️ AI 日報</h4>');
            const display = papers.slice().reverse().slice(0, 10);
            for (let i = 0; i < display.length; i++) {
                const paper = display[i];
                const isExpanded = this._expandedNewspaper === paper.id;
                const isLatest = i === 0;
                html += `<div class="news-card ${isExpanded ? 'news-expanded' : ''} ${isLatest ? 'news-latest' : ''}" data-action="view-newspaper" data-val="${paper.id}">`;
                html += `<div class="news-card-header">`;
                html += `<div class="news-card-issue">#${paper.id}</div>`;
                html += `<div class="news-card-meta">`;
                html += `${t('<div class="news-card-date">第')}${paper.year}${t('年 ')}${paper.season}${t(' 第')}${paper.day}${t('天</div>')}`;
                html += `<div class="news-card-reporter">✍️ ${paper.reporter}（${paper.reporterJob}）</div>`;
                html += `</div>`;
                html += `<div class="news-card-toggle">${isExpanded ? '▲' : '▼'}</div>`;
                html += `</div>`;
                if (!isExpanded && paper.content) {
                    const firstLine = paper.content.split('\n').find(l => l.trim().length > 0) || '';
                    const preview = firstLine.length > 40 ? firstLine.substring(0, 40) + '…' : firstLine;
                    html += `<div class="news-card-preview">${this._escapeHtml(preview)}</div>`;
                }
                if (isExpanded) {
                    html += `<div class="news-card-content">${this._escapeHtml(paper.content)}</div>`;
                }
                html += '</div>';
            }
            if (papers.length > 10) {
                html += `${t('<p class="muted-text" style="text-align:center;padding:4px 0;font-size:0.7rem">顯示最近 10 期（共 ')}${papers.length}${t(' 期）</p>')}`;
            }
            html += '</div>';
        }

        const chains = this.state.active_chains || [];
        if (chains.length) {
            html += t('<div class="chain-section"><h4>進行中的事件鏈</h4>');
            chains.forEach(c => { html += `<div>${c.current_event}${t('（階段 ')}${c.stage}/${c.total_stages}）</div>`; });
            html += '</div>';
        }
        const travelling = this.state.travelling_agents || [];
        if (travelling.length) {
            html += t('<div class="travelling-section"><h4>外出中的居民</h4>');
            travelling.forEach(_tw => { html += `<div class="travelling-item">${_tw.name} — ${_tw.reason}</div>`; });
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
            html += `<div class="festival-section"><h4>${f.icon} ${f.name}${t('進行中！')}</h4>
                <div style="padding:4px 8px;color:var(--text-secondary)">${f.description}</div></div>`;
        }
        if (festivals.activeQuest) {
            const q = festivals.activeQuest;
            const pct = Math.round((q.progress / q.goal) * 100);
            html += `${t('<div class="quest-section"><h4>🎯 節日任務：')}${q.name}</h4>
                <div style="padding:4px 8px">${q.desc}</div>
                <div class="quest-progress"><div class="quest-bar" style="width:${pct}%"></div><span>${pct}%</span></div></div>`;
        }

        // === Factions ===
        const factionData = this.state.factions || {};
        const factionList = Object.values(factionData.factions || {});
        if (factionList.length) {
            html += t('<div class="faction-section"><h4>👥 派系 / 社交圈</h4>');
            factionList.forEach(f => {
                const memberNames = f.members.map(id => {
                    const a = this.state.agents[id];
                    return a ? a.name : '?';
                }).join('、');
                const cohesionCls = f.cohesion > 70 ? 'cohesion-high' : f.cohesion < 30 ? 'cohesion-low' : '';
                let relHtml = '';
                if (f.rivalFactionId) {
                    const rival = factionList.find(x => x.id === f.rivalFactionId);
                    if (rival) relHtml += `${t('<span class="faction-rival">⚔️ 敵對：')}${rival.name}</span> `;
                }
                if (f.allyFactionId) {
                    const ally = factionList.find(x => x.id === f.allyFactionId);
                    if (ally) relHtml += `${t('<span class="faction-ally">🤝 結盟：')}${ally.name}</span>`;
                }
                html += `<div class="faction-card">
                    <div class="faction-header">${f.icon} <strong>${f.name}</strong>
                        <span class="faction-cohesion ${cohesionCls}${t('">團結度：')}${Math.round(f.cohesion)}</span></div>
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
            html += t('<div class="explore-section"><h4>🗺️ 探索區域</h4>');
            if (expeditions.length) {
                html += t('<div class="expedition-active"><strong>進行中的探險：</strong>');
                expeditions.forEach(e => {
                    const ticksLeft = Math.max(0, e.returnTick - (this.state.tick || 0));
                    const daysLeft = Math.ceil(ticksLeft / 96);
                    html += `<div class="expedition-item">${e.zoneIcon} ${e.zoneName} — ${e.agentNames.join('、')} (${daysLeft}${t('天後返回)</div>')}`;
                });
                html += '</div>';
            }
            discovered.forEach(([zoneId, info]) => {
                const zoneDef = this._getExplorationZone(zoneId);
                if (!zoneDef) return;
                const canSend = !expeditions.some(e => e.zoneId === zoneId);
                const availableNpcs = Object.entries(this.state.agents)
                    .filter(([id, a]) => !a.is_player && a.activity_label !== t('探險中') && id !== 'player')
                    .slice(0, 8);
                html += `<div class="explore-zone">
                    <div class="zone-header">${zoneDef.icon} <strong>${zoneDef.name}</strong>
                        <span class="zone-diff">${t('難度：')}${'⭐'.repeat(zoneDef.difficulty)}</span></div>
                    <div class="zone-desc">${zoneDef.description}</div>
                    <div class="zone-stats">${t('已探索')} ${info.timesExplored} ${t('次')}</div>
                    ${canSend ? `<div class="zone-send">
                        <select class="explore-select" id="explore-select-${zoneId}" multiple size="3">
                            ${availableNpcs.map(([id, a]) => `<option value="${id}">${a.name} (${a.job?.title||t('無')})</option>`).join('')}
                        </select>
                        <button class="explore-btn" data-action="send-expedition" data-val="${zoneId}">派遣探險</button>
                    </div>` : t('<div class="zone-busy">探險進行中...</div>')}
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
                html += t('<h4>🎒 近期出生</h4>');
                births.slice(-5).reverse().forEach(b => {
                    html += `<div class="birth-item">${b.name} — ${b.parentNames.join(t('與'))}${t('的孩子 <span class="birth-time">')}${b.birthTime}</span></div>`;
                });
            }
            if (graveyard.length) {
                html += t('<h4>⚰️ 墓園</h4>');
                graveyard.slice(-10).reverse().forEach(g => {
                    html += `<div class="grave-item">
                        <div class="grave-name">${g.name}（${g.age}${t('歲）')}</div>
                        <div class="grave-info">${g.job} — ${g.deathCause}</div>
                        <div class="grave-epitaph">${g.epitaph}</div>
                        <div class="grave-time">${g.deathTime}</div></div>`;
                });
            }
            html += '</div>';
        }

        container.innerHTML = html || t('<p class="muted-text" style="padding:20px">尚無事件。事件每天會隨機發生。</p>');
    }

    _getExplorationZone(id) {
        const zones = {
            deep_forest: { icon:'🌲', name:t('幽深森林'), difficulty:2, description:t('城鎮外的茂密森林，傳說中有稀有草藥和野生動物。') },
            ancient_ruins: { icon:'🏛️', name:t('古代遺跡'), difficulty:4, description:t('神秘的古代建築遺址，可能藏有珍貴的知識和寶物。') },
            abandoned_mine: { icon:'⛏️', name:t('廢棄礦坑'), difficulty:3, description:t('一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。') },
            mountain_pass: { icon:'⛰️', name:t('山間隘口'), difficulty:5, description:t('通往外界的危險山路，但可能找到貿易路線和珍稀資源。') },
            riverside_cave: { icon:'🕳️', name:t('河畔洞窟'), difficulty:2, description:t('河邊的一個神秘洞穴，經常有奇怪的回音。') },
            cursed_swamp: { icon:'🌿', name:t('詛咒沼澤'), difficulty:4, description:t('傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。') },
        };
        return zones[id] || null;
    }

    // --- Economy Tab (with factory sub-tab) ---
    renderEconomy(container) {
        if (!this.state) return;
        if (!this._economySubTab) this._economySubTab = 'resources';

        let html = '<div class="economy-panel">';

        // Prosperity summary
        const prosp = this.state.prosperity;
        if (prosp) {
            const pColor = prosp.prosperity >= 80 ? '#ffd700' : prosp.prosperity >= 60 ? 'var(--positive)' : prosp.prosperity >= 40 ? 'var(--accent)' : prosp.prosperity >= 20 ? 'var(--text-secondary)' : 'var(--negative)';
            html += `<div class="econ-section" style="padding:8px 12px">`;
            const popCount = Object.keys(this.state.agents || {}).length;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
            html += `${t('<span style="font-weight:bold;font-size:0.85rem">🏛️ 繁榮度 <span style="font-weight:normal;font-size:0.75rem;color:var(--text-muted)">👤 ')}${popCount}${t(' 人</span></span>')}`;
            html += `<span style="color:${pColor};font-weight:bold">${prosp.prosperity} — ${prosp.level}</span>`;
            html += `</div>`;
            html += `<div class="progress-bar" style="height:8px;margin-bottom:6px"><div class="progress-fill" style="width:${prosp.prosperity}%;background:${pColor}"></div></div>`;
            // Dimension bars
            const dimLabels = { economy:t('💰經濟'), buildings:t('🏗️建設'), population:t('👥人口'), happiness:t('😊幸福'), culture:t('🎭文化'), defense:t('🛡️防禦'), beauty:t('🌺美觀') };
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:0.7rem">`;
            for (const [key, dim] of Object.entries(prosp.dimensions || {})) {
                const label = dimLabels[key] || key;
                html += `<div style="display:flex;align-items:center;gap:4px">`;
                html += `<span style="width:52px;flex-shrink:0">${label}</span>`;
                html += `<div class="progress-bar" style="height:4px;flex:1"><div class="progress-fill" style="width:${dim.value}%;background:var(--accent)"></div></div>`;
                html += `<span style="width:20px;text-align:right;color:var(--text-muted)">${dim.value}</span>`;
                html += `</div>`;
            }
            html += `</div></div>`;
        }

        // Sub-tab navigation
        html += '<div class="sub-tab-bar">';
        const subTabs = [
            { key:'resources', label:t('資源'), icon:'📦' },
            { key:'building', label:t('建築'), icon:'🏗️' },
            { key:'factory', label:t('工廠'), icon:'🔧' },
        ];
        subTabs.forEach(_tw => {
            const active = this._economySubTab === _tw.key ? ' class="active"' : '';
            html += `<button${active} data-action="economy-subtab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
        });
        html += '</div>';

        const sp = this.state.stockpile || {};
        const res = sp.resources || {};
        const icons = {food:'🌾',wood:'🪵',stone:'🪨',metal:'⚙️',cloth:'🧵',herbs:'🌿',silver:'💰',meals:'🍲',tools:'🔧',clothing:'👕',medicine:'💊',furniture:'🪑',research_points:'📚',
            plank:'🪵',hardwood:'🪓',brick:'🧱',marble:'🏛️',steel:'⚔️',gold:'🥇',
            wheat:'🌾',rice:'🍚',corn:'🌽',potato:'🥔',cotton:'🧶',flowers:'🌸',mushroom:'🍄',sugarcane:'🎋',tea:'🍵',grapes:'🍇',golden_wheat:'✨',dragon_fruit:'🐉',
            bread:'🍞',pastry:'🧁',beer:'🍺',wine:'🍷',perfume:'🌹',fine_tea:'🫖',herbal_tea:'🍃',sugar:'🍬',jam:'🫙',luxury_furniture:'🛋️'};
        const labels = {food:t('食物'),wood:t('木材'),stone:t('石材'),metal:t('金屬'),cloth:t('布料'),herbs:t('草藥'),silver:t('銀幣'),meals:t('餐食'),tools:t('工具'),clothing:t('衣物'),medicine:t('藥品'),furniture:t('家具'),research_points:t('研究'),
            plank:t('木板'),hardwood:t('硬木'),brick:t('磚塊'),marble:t('大理石'),steel:t('鋼鐵'),gold:t('黃金'),
            wheat:t('小麥'),rice:t('稻米'),corn:t('玉米'),potato:t('馬鈴薯'),cotton:t('棉花'),flowers:t('花卉'),mushroom:t('蘑菇'),sugarcane:t('甘蔗'),tea:t('茶葉'),grapes:t('葡萄'),golden_wheat:t('金色小麥'),dragon_fruit:t('火龍果'),
            bread:t('麵包'),pastry:t('糕點'),beer:t('啤酒'),wine:t('葡萄酒'),perfume:t('香水'),fine_tea:t('精品茶'),herbal_tea:t('草本茶'),sugar:t('砂糖'),jam:t('果醬'),luxury_furniture:t('高級家具')};

        if (this._economySubTab === 'resources') {
            // Resources
            html += t('<div class="econ-section"><h3>資源</h3><div class="resource-grid">');
            const resEntries = Object.entries(res).filter(([, amount]) => Math.round(amount) > 0);
            if (resEntries.length === 0) {
                html += t('<p class="muted-text" style="grid-column:1/-1;text-align:center;padding:12px 0">目前沒有任何資源</p>');
            }
            for (const [r, amount] of resEntries) {
                const icon = icons[r] || '📦';
                const label = labels[r] || r;
                const cls = amount < 10 ? 'res-low' : amount > 100 ? 'res-high' : '';
                html += `<div class="resource-item ${cls}"><span class="res-icon">${icon}</span><span class="res-label">${label}</span><span class="res-amount">${Math.round(amount)}</span></div>`;
            }
            html += '</div></div>';
            // Trade
            const trade = this.state.trade || {};
            html += t('<div class="econ-section"><h3>交易</h3>');
            if (trade.merchant) {
                html += `<div class="merchant-card"><div class="merchant-name">${trade.merchant.name}</div>
                    <div class="merchant-info">${t('專長：')}${trade.merchant.specialty} | ${trade.merchant.daysRemaining}${t('天後離開')}</div>
                    <div class="trade-offers">`;
                trade.merchant.offers.forEach((offer, idx) => {
                    const icon = icons[offer.resource] || '📦';
                    const resLabel = labels[offer.resource] || offer.resource;
                    const action = offer.isBuying ? t('賣出') : t('買入');
                    const actionCls = offer.isBuying ? 'trade-sell' : 'trade-buy';
                    html += `<div class="trade-offer ${actionCls}">
                        <span>${icon} ${resLabel}</span>
                        <span>×${Math.round(offer.amount)}</span>
                        <span>${offer.price}/${t('個')}</span>
                        <button class="trade-btn" data-action="trade" data-val="${idx},${Math.min(5, offer.amount)}">${action}5</button>
                        <button class="trade-btn" data-action="trade" data-val="${idx},${offer.amount}${t('">全')}${action}</button></div>`;
                });
                html += '</div></div>';
            } else {
                html += t('<p class="muted-text">鎮上沒有商人，可能很快就會來一位。</p>');
            }
            html += '</div>';
            // Research
            const research = this.state.research || {};
            html += t('<div class="econ-section"><h3>研究</h3>');
            const projects = research.projects || {};
            const currentKey = research.current_research;
            if (currentKey && projects[currentKey]) {
                const cur = projects[currentKey];
                const pct = Math.round((cur.progress / cur.cost) * 100);
                html += `${t('<div class="research-current">研究中：<strong>')}${cur.name}</strong>
                    <div class="progress-bar"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span></div>`;
            }
            const availableResearch = Object.values(projects).filter(p => p.status === 'available');
            if (availableResearch.length) {
                html += t('<div class="research-available"><div class="build-label">可研究：</div>');
                availableResearch.forEach(p => {
                    const isCurrent = p.key === currentKey;
                    html += `<div class="research-option ${isCurrent ? 'active' : ''}">
                        <div class="build-name">${p.name}</div>
                        <div class="build-desc">${p.description}${t('（消耗：')}${p.cost}）</div>
                        <button class="build-btn" data-action="research" data-val="${p.key}" ${isCurrent?'disabled':''}${t('>研究</button></div>')}`;
                });
                html += '</div>';
            }
            const completedResearch = Object.values(projects).filter(p => p.status === 'complete');
            if (completedResearch.length) {
                html += `${t('<div class="completed-buildings">已完成：')}${completedResearch.map(p => p.name).join('、')}</div>`;
            }
            html += '</div>';
        } else if (this._economySubTab === 'building') {
            // Buildings
            const buildings = this.state.buildings || {};
            html += t('<div class="econ-section"><h3>建築</h3>');
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
                html += `${t('<div class="completed-buildings">已完成：')}${buildings.completed.map(p => p.name).join('、')}</div>`;
            }
            const available = this.world.buildings.getAvailable(this.world);
            if (available.length) {
                html += t('<div class="available-buildings"><div class="build-label">建造：</div>');
                available.forEach(p => {
                    const costStr = Object.entries(p.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                    html += `<div class="build-option ${p.can_afford ? '' : 'cant-afford'}">
                        <div class="build-name">${p.name}</div>
                        <div class="build-desc">${p.description}</div>
                        <div class="build-cost">${costStr}</div>
                        <button class="build-btn" ${p.can_afford ? '' : 'disabled'} data-action="build" data-val="${p.key}${t('">建造</button></div>')}`;
                });
                html += '</div>';
            }
            html += '</div>';
        } else if (this._economySubTab === 'factory') {
            // Factory (merged from old factory tab)
            const proc = this.state.processing || {};
            const factories = proc.builtFactories || {};
            html += t('<div class="econ-section"><h3>🏭 工廠加工</h3></div>');
            for (const [key, factory] of Object.entries(factories)) {
                const def = typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
                if (!def) continue;
                html += `<div class="econ-section"><h3>${def.icon} ${def.name}`;
                if (factory.status === 'building') html += `${t(' (建造中 ')}${Math.round(factory.buildProgress / factory.buildRequired * 100)}%)`;
                html += '</h3>';
                if (factory.status === 'active') {
                    html += t('<div style="margin:4px 0"><strong>配方：</strong>');
                    def.recipes.forEach(r => {
                        const active = factory.recipe === r.id ? ' style="background:var(--accent-gold);color:#000"' : '';
                        html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem"${active} data-action="set-recipe" data-val="${key},${r.id}">${r.label}</button>`;
                    });
                    html += '</div>';
                    html += `${t('<div style="margin:4px 0;font-size:0.8rem"><strong>工人：</strong>')}${factory.workers.length}/${def.workerSlots}`;
                    factory.workers.forEach(wId => {
                        const a = this.state.agents[wId];
                        html += ` <span style="color:var(--accent-gold)">${a?.name || wId}</span>`;
                    });
                    if (factory.workers.length < def.workerSlots) {
                        const avail = Object.entries(this.state.agents).filter(([id, a]) =>
                            id !== 'player' && !factory.workers.includes(id) && (!a.status_text || a.status_text === 'normal')
                        );
                        if (avail.length > 0) {
                            html += '<br>';
                            avail.slice(0, 5).forEach(([id, a]) => {
                                html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="assign-worker" data-val="${key},${id}">+${a.name}</button>`;
                            });
                        }
                    }
                    html += '</div>';
                    if (factory.recipe) {
                        const recipe = def.recipes.find(r => r.id === factory.recipe);
                        if (recipe) {
                            const pct = Math.round(factory.productionProgress / recipe.time * 100);
                            html += `${t('<div style="font-size:0.75rem;margin:4px 0">生產進度：')}${pct}%</div>`;
                        }
                    }
                    const wh = factory.warehouse || {};
                    if (Object.keys(wh).length > 0) {
                        html += t('<div style="margin:4px 0;font-size:0.8rem"><strong>倉庫：</strong>');
                        for (const [r, amt] of Object.entries(wh)) {
                            html += `<span style="margin-right:8px">${r}: ${amt}`;
                            html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="collect-product" data-val="${key},${r},${amt}${t('">收</button>')}`;
                            html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="sell-product" data-val="${key},${r},${amt}${t('">賣</button></span>')}`;
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';
            }
            // Available to build
            const availFac = this.world.processing.getAvailableFactories(this.world);
            if (availFac.length > 0) {
                html += t('<div class="econ-section"><h3>可建造工廠</h3>');
                availFac.forEach(f => {
                    const costStr = Object.entries(f.cost).map(([r,a]) => `${r}:${a}`).join(' ');
                    const canBuild = f.canAfford ? '' : ' disabled';
                    html += `<div class="build-card"><div><strong>${f.icon} ${f.name}</strong>
                        <br><span style="font-size:0.7rem">${costStr}${t(' | 建造天數：')}${f.buildDays}</span></div>
                        <button class="trade-btn"${canBuild} data-action="build-factory" data-val="${f.key}${t('">建造</button></div>')}`;
                });
                html += '</div>';
            }
            // Active orders
            const orders = (proc.orders || []).filter(o => o.status === 'active');
            if (orders.length > 0) {
                html += t('<div class="econ-section"><h3>📋 訂單</h3>');
                orders.forEach(o => {
                    html += `<div class="build-card"><div><strong>${o.description}</strong>
                        <br><span style="font-size:0.7rem">${t('獎勵：')}${o.reward}${t('銀幣 | 剩餘')}${o.daysLeft}${t('天')}</span></div>
                        <button class="trade-btn" data-action="fulfill-order" data-val="${o.id}${t('">完成</button></div>')}`;
                });
                html += '</div>';
            }
        }
        html += '</div>';
        container.innerHTML = html;
    }

    executeTrade(offerIdx, qty) {
        const result = this.world.trade.executeTrade(offerIdx, qty, this.world);
        if (result.error) console.warn('Trade failed:', result.error);
        else if (this.world.questSystem) this.world.questSystem.onTrade();
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
        let html = t('<div class="detail-section"><h3>社交圈</h3>');
        factions.forEach(f => {
            const others = f.members.filter(id => id !== agentId).map(id => {
                const a = this.state.agents[id]; return a ? a.name : '?';
            }).join('、');
            html += `<div class="faction-mini">${f.icon} <strong>${f.name}${t('</strong> <span style="font-size:0.7rem;color:var(--text-secondary)">同伴：')}${others}</span></div>`;
        });
        html += '</div>';
        return html;
    }

    sendExpedition(zoneId) {
        const selectEl = document.getElementById(`explore-select-${zoneId}`);
        if (!selectEl) return;
        const selectedIds = Array.from(selectEl.selectedOptions).map(o => o.value);
        if (selectedIds.length === 0) { this._gameAlert(t('請選擇至少一名居民！'), '👥'); return; }
        const result = this.world.exploration.sendExpedition(this.world, zoneId, selectedIds);
        if (!result) { this._gameAlert(t('無法派遣探險隊。'), '❌'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    selectAgent(agentId) {
        this.selectedAgent = agentId;
        this.activeTab = 'detail';
        if (this._updateTabHighlight) this._updateTabHighlight('detail');
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('mobile-collapsed');
        this.render();
    }

    // ============================================================
    // Industry Tab
    // ============================================================
    // ============================================================
    // Merged Industry + Farm Tab (產業總覽)
    // ============================================================
    renderIndustryAndFarm(container) {
        if (!this.state) return;
        const ind = this.state.industry || {};
        const farm = this.state.farm || {};
        const plots = farm.plots || [];
        // Sub-tab state
        if (!this._industrySubTab) this._industrySubTab = 'overview';
        let html = '<div class="economy-panel">';
        // Sub-tab navigation
        html += '<div class="sub-tab-bar">';
        const subTabs = [
            { key:'overview', label:t('總覽'), icon:'🏘️' },
            { key:'farm', label:t('農場'), icon:'🌾' },
        ];
        subTabs.forEach(_tw => {
            const active = this._industrySubTab === _tw.key ? ' class="active"' : '';
            html += `<button${active} data-action="industry-subtab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
        });
        html += '</div>';
        if (this._industrySubTab === 'overview') {
            // Town level
            html += `${t('<div class="econ-section"><h3>🏘️ 小鎮等級：')}${ind.townLevelName || t('荒村')} (Lv${ind.townLevel || 1})</h3>`;
            html += `${t('<div style="font-size:0.8rem;color:var(--text-secondary)">產業上限：')}${ind.maxIndustries || 1}${t(' | 已開啟：')}${Object.keys(ind.industries || {}).length}</div></div>`;
            // Needs initial industry choice
            if (ind.needsIndustryChoice) {
                html += t('<div class="econ-section"><h3>選擇你的第一個產業</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${i.name}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">選擇</button></div>')}`;
                });
                html += '</div>';
            }
            // Active industries
            if (ind.industries && Object.keys(ind.industries).length > 0) {
                html += t('<div class="econ-section"><h3>產業列表</h3>');
                for (const [key, data] of Object.entries(ind.industries)) {
                    const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
                    const lvDef = def?.levels?.find(l => l.lv === data.level);
                    const nextLv = def?.levels?.find(l => l.lv === data.level + 1);
                    html += `<div class="build-card"><div><strong>${def?.icon || '?'} ${def?.name || key} Lv${data.level}</strong>`;
                    if (lvDef) html += `<br><span style="font-size:0.75rem">${lvDef.bonus || lvDef.name}</span>`;
                    html += `${t('<br><span style="font-size:0.75rem;color:var(--text-secondary)">工人：')}${Array.isArray(data.workers) ? data.workers.length : data.workers}/${lvDef?.workers || '?'}</span>`;
                    if (data.dailyOutput && Object.keys(data.dailyOutput).length) {
                        const outputStr = Object.entries(data.dailyOutput).map(([r,a]) => `${r}:${Math.round(a*10)/10}`).join(' ');
                        html += `<br><span style="font-size:0.7rem;color:var(--accent-gold)">📦 ${outputStr}</span>`;
                    }
                    html += '</div>';
                    if (nextLv) {
                        const costStr = Object.entries(nextLv.cost).map(([r,a]) => `${r}:${a}`).join(' ');
                        html += `<div><button class="trade-btn" data-action="upgrade-industry" data-val="${key}${t('">升級 Lv')}${nextLv.lv}</button>
                            <div style="font-size:0.75rem;color:var(--text-secondary)">${costStr}</div></div>`;
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            // Pending unlock
            if (ind._pendingUnlock) {
                html += t('<div class="econ-section"><h3>可開啟新產業！</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${i.name}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">開啟</button></div>')}`;
                });
                html += '</div>';
            }
            // Synergies
            if (ind.activeSynergies && ind.activeSynergies.length > 0) {
                html += t('<div class="econ-section"><h3>產業加成</h3>');
                ind.activeSynergies.forEach(s => {
                    html += `<div style="font-size:0.8rem;margin:4px 0">${s.icon} ${s.name}</div>`;
                });
                html += '</div>';
            }
        } else if (this._industrySubTab === 'farm') {
            // Farm sub-tab content
            const stateIcons = { empty:'🟫', tilled:'🟤', growing:'🌱', ready:'✅', withered:'🥀' };
            const stateLabels = { empty:t('空地'), tilled:t('已翻土'), growing:t('生長中'), ready:t('可收穫'), withered:t('枯萎') };
            html += `${t('<div class="econ-section"><h3>🌾 農場（')}${plots.length}/${farm.maxPlots || 0}${t(' 塊田）</h3></div>')}`;
            if (plots.length === 0) {
                html += t('<div class="econ-section"><p class="muted-text">需要先開啟農業產業才能使用農場。</p></div>');
            }
            for (const plot of plots) {
                const crop = plot.crop ? (typeof CROPS !== 'undefined' ? CROPS[plot.crop] : null) : null;
                html += `<div class="build-card"><div>`;
                html += `<strong>${stateIcons[plot.state] || '?'}${t(' 田地 #')}${plot.id}</strong> — ${stateLabels[plot.state] || plot.state}`;
                if (crop && plot.state === 'growing') {
                    html += `<br><span style="font-size:0.75rem">${crop.icon} ${crop.name}${t(' | 進度：')}${Math.round(plot.growthProgress)}${t('% | 水分：')}${Math.round(plot.waterLevel)}%</span>`;
                    if (plot.fertilized) html += ' 🧪';
                } else if (crop && plot.state === 'ready') {
                    html += `<br><span style="font-size:0.75rem">${crop.icon} ${crop.name}${t(' — 可收穫！</span>')}`;
                }
                html += '</div><div>';
                if (plot.state === 'empty') {
                    html += `<button class="trade-btn" data-action="till-plot" data-val="${plot.id}${t('">翻土</button>')}`;
                } else if (plot.state === 'tilled') {
                    const farmInd = this.world.industry?.industries?.farming;
                    const farmLevel = farmInd?.level || 1;
                    const crops = this.world.farm.getAvailableCrops(farmLevel);
                    const seasonCrops = crops.filter(c => c.seasons.includes(this.world.clock.season));
                    if (seasonCrops.length > 0) {
                        html += '<div style="font-size:0.7rem">';
                        seasonCrops.forEach(c => {
                            html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="plant-crop" data-val="${plot.id},${c.key}">${c.icon}${c.name}</button>`;
                        });
                        html += '</div>';
                    } else {
                        html += t('<span style="font-size:0.7rem;color:var(--text-secondary)">本季無可種作物</span>');
                    }
                } else if (plot.state === 'growing') {
                    html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="water-plot" data-val="${plot.id}${t('">💧澆水</button>')}`;
                    if (!plot.fertilized) html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="fertilize-plot" data-val="${plot.id}${t('">🧪施肥</button>')}`;
                } else if (plot.state === 'ready') {
                    html += `<button class="trade-btn" data-action="harvest-plot" data-val="${plot.id}${t('">🌾收穫</button>')}`;
                } else if (plot.state === 'withered') {
                    html += `<button class="trade-btn" data-action="clear-withered" data-val="${plot.id}${t('">清除</button>')}`;
                }
                html += '</div></div>';
            }
            // Recent harvests
            const log = farm.harvestLog || [];
            if (log.length > 0) {
                html += t('<div class="econ-section"><h3>收穫紀錄</h3>');
                log.slice(-5).reverse().forEach(h => {
                    html += `<div style="font-size:0.75rem;margin:2px 0">${h.cropName} x${h.amount}（${h.quality}）— ${h.season}${t(' 第')}${h.day}${t('天</div>')}`;
                });
                html += '</div>';
            }
        }
        html += '</div>';
        container.innerHTML = html;
    }

    renderIndustry(container) {
        if (!this.state) return;
        const ind = this.state.industry || {};
        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>🏘️ 小鎮等級：')}${ind.townLevelName || t('荒村')} (Lv${ind.townLevel || 1})</h3>`;
        html += `${t('<div style="font-size:0.8rem;color:var(--text-secondary)">產業上限：')}${ind.maxIndustries || 1}${t(' | 已開啟：')}${Object.keys(ind.industries || {}).length}</div></div>`;

        // Needs initial industry choice
        if (ind.needsIndustryChoice) {
            html += t('<div class="econ-section"><h3>選擇你的第一個產業</h3>');
            const available = this.world.industry.getAvailableIndustries(this.world);
            available.forEach(i => {
                html += `<div class="build-card"><div><strong>${i.icon} ${i.name}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                    <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">選擇</button></div>')}`;
            });
            html += '</div>';
        }

        // Active industries
        if (ind.industries && Object.keys(ind.industries).length > 0) {
            html += t('<div class="econ-section"><h3>產業列表</h3>');
            for (const [key, data] of Object.entries(ind.industries)) {
                const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
                const lvDef = def?.levels?.find(l => l.lv === data.level);
                const nextLv = def?.levels?.find(l => l.lv === data.level + 1);
                html += `<div class="build-card"><div><strong>${def?.icon || '?'} ${def?.name || key} Lv${data.level}</strong>`;
                if (lvDef) html += `<br><span style="font-size:0.75rem">${lvDef.bonus || lvDef.name}</span>`;
                html += `${t('<br><span style="font-size:0.75rem;color:var(--text-secondary)">工人：')}${Array.isArray(data.workers) ? data.workers.length : data.workers}/${lvDef?.workers || '?'}</span>`;
                if (data.dailyOutput && Object.keys(data.dailyOutput).length) {
                    const outputStr = Object.entries(data.dailyOutput).map(([r,a]) => `${r}:${Math.round(a*10)/10}`).join(' ');
                    html += `<br><span style="font-size:0.7rem;color:var(--accent-gold)">📦 ${outputStr}</span>`;
                }
                html += '</div>';
                if (nextLv) {
                    const costStr = Object.entries(nextLv.cost).map(([r,a]) => `${r}:${a}`).join(' ');
                    html += `<div><button class="trade-btn" data-action="upgrade-industry" data-val="${key}${t('">升級 Lv')}${nextLv.lv}</button>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${costStr}</div></div>`;
                }
                html += '</div>';
            }
            html += '</div>';
        }

        // Pending unlock
        if (ind._pendingUnlock) {
            html += t('<div class="econ-section"><h3>可開啟新產業！</h3>');
            const available = this.world.industry.getAvailableIndustries(this.world);
            available.forEach(i => {
                html += `<div class="build-card"><div><strong>${i.icon} ${i.name}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                    <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">開啟</button></div>')}`;
            });
            html += '</div>';
        }

        // Synergies
        if (ind.activeSynergies && ind.activeSynergies.length > 0) {
            html += t('<div class="econ-section"><h3>產業加成</h3>');
            ind.activeSynergies.forEach(s => {
                html += `<div style="font-size:0.8rem;margin:4px 0">${s.icon} ${s.name}</div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    _chooseIndustry(key) {
        const result = this.world.industry.chooseIndustry(key, this.world);
        if (!result.ok) { this._gameAlert(result.error, '⚠️'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    }
    _upgradeIndustry(key) {
        const result = this.world.industry.upgradeIndustry(key, this.world);
        if (!result.ok) { this._gameAlert(result.error, '⚠️'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    // ============================================================
    // Farm Tab
    // ============================================================
    renderFarm(container) {
        if (!this.state) return;
        const farm = this.state.farm || {};
        const plots = farm.plots || [];
        const stateIcons = { empty:'🟫', tilled:'🟤', growing:'🌱', ready:'✅', withered:'🥀' };
        const stateLabels = { empty:t('空地'), tilled:t('已翻土'), growing:t('生長中'), ready:t('可收穫'), withered:t('枯萎') };

        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>🌾 農場（')}${plots.length}/${farm.maxPlots || 0}${t(' 塊田）</h3></div>')}`;

        if (plots.length === 0) {
            html += t('<div class="econ-section"><p class="muted-text">需要先開啟農業產業才能使用農場。</p></div>');
        }

        // Plots
        for (const plot of plots) {
            const crop = plot.crop ? (typeof CROPS !== 'undefined' ? CROPS[plot.crop] : null) : null;
            html += `<div class="build-card"><div>`;
            html += `<strong>${stateIcons[plot.state] || '?'}${t(' 田地 #')}${plot.id}</strong> — ${stateLabels[plot.state] || plot.state}`;
            if (crop && plot.state === 'growing') {
                html += `<br><span style="font-size:0.75rem">${crop.icon} ${crop.name}${t(' | 進度：')}${Math.round(plot.growthProgress)}${t('% | 水分：')}${Math.round(plot.waterLevel)}%</span>`;
                if (plot.fertilized) html += ' 🧪';
            } else if (crop && plot.state === 'ready') {
                html += `<br><span style="font-size:0.75rem">${crop.icon} ${crop.name}${t(' — 可收穫！</span>')}`;
            }
            html += '</div><div>';
            if (plot.state === 'empty') {
                html += `<button class="trade-btn" data-action="till-plot" data-val="${plot.id}${t('">翻土</button>')}`;
            } else if (plot.state === 'tilled') {
                // Show crop selection
                const farmInd = this.world.industry?.industries?.farming;
                const farmLevel = farmInd?.level || 1;
                const crops = this.world.farm.getAvailableCrops(farmLevel);
                const seasonCrops = crops.filter(c => c.seasons.includes(this.world.clock.season));
                if (seasonCrops.length > 0) {
                    html += '<div style="font-size:0.7rem">';
                    seasonCrops.forEach(c => {
                        html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="plant-crop" data-val="${plot.id},${c.key}">${c.icon}${c.name}</button>`;
                    });
                    html += '</div>';
                } else {
                    html += t('<span style="font-size:0.7rem;color:var(--text-secondary)">本季無可種作物</span>');
                }
            } else if (plot.state === 'growing') {
                html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="water-plot" data-val="${plot.id}${t('">💧澆水</button>')}`;
                if (!plot.fertilized) html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="fertilize-plot" data-val="${plot.id}${t('">🧪施肥</button>')}`;
            } else if (plot.state === 'ready') {
                html += `<button class="trade-btn" data-action="harvest-plot" data-val="${plot.id}${t('">🌾收穫</button>')}`;
            } else if (plot.state === 'withered') {
                html += `<button class="trade-btn" data-action="clear-withered" data-val="${plot.id}${t('">清除</button>')}`;
            }
            html += '</div></div>';
        }

        // Recent harvests
        const log = farm.harvestLog || [];
        if (log.length > 0) {
            html += t('<div class="econ-section"><h3>收穫紀錄</h3>');
            log.slice(-5).reverse().forEach(h => {
                html += `<div style="font-size:0.75rem;margin:2px 0">${h.cropName} x${h.amount}（${h.quality}）— ${h.season}${t(' 第')}${h.day}${t('天</div>')}`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    _tillPlot(plotId) {
        const r = this.world.farm.tillPlot(plotId);
        if (!r.ok) { this._gameAlert(r.error || t('無法翻土'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    }
    _plantCrop(plotId, cropKey) {
        const r = this.world.farm.plantCrop(plotId, cropKey, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法種植'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    }
    _waterPlot(plotId) {
        this.world.farm.waterPlot(plotId);
        this.state = this.world.getState(); this.renderSidebar();
    }
    _fertilizePlot(plotId) {
        const r = this.world.farm.fertilizePlot(plotId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法施肥'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    }
    _harvestPlot(plotId) {
        const r = this.world.farm.harvestPlot(plotId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法收穫'), '⚠️'); return; }
        if (this.world.questSystem) this.world.questSystem.onHarvest();
        this.state = this.world.getState(); this.renderSidebar();
    }
    _clearWithered(plotId) {
        this.world.farm.clearWithered(plotId);
        this.state = this.world.getState(); this.renderSidebar();
    }

    // ============================================================
    // Factory Tab
    // ============================================================
    renderFactory(container) {
        if (!this.state) return;
        const proc = this.state.processing || {};
        const factories = proc.builtFactories || {};

        let html = '<div class="economy-panel">';
        html += t('<div class="econ-section"><h3>🏭 工廠加工</h3></div>');

        // Built factories
        for (const [key, factory] of Object.entries(factories)) {
            const def = typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
            if (!def) continue;
            html += `<div class="econ-section"><h3>${def.icon} ${def.name}`;
            if (factory.status === 'building') {
                html += `${t(' (建造中 ')}${Math.round(factory.buildProgress / factory.buildRequired * 100)}%)`;
            }
            html += '</h3>';

            if (factory.status === 'active') {
                // Recipe selection
                html += t('<div style="margin:4px 0"><strong>配方：</strong>');
                def.recipes.forEach(r => {
                    const active = factory.recipe === r.id ? ' style="background:var(--accent-gold);color:#000"' : '';
                    html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem"${active} data-action="set-recipe" data-val="${key},${r.id}">${r.label}</button>`;
                });
                html += '</div>';

                // Workers
                html += `${t('<div style="margin:4px 0;font-size:0.8rem"><strong>工人：</strong>')}${factory.workers.length}/${def.workerSlots}`;
                factory.workers.forEach(wId => {
                    const a = this.state.agents[wId];
                    html += ` <span style="color:var(--accent-gold)">${a?.name || wId}</span>`;
                });
                if (factory.workers.length < def.workerSlots) {
                    // Show assignable NPCs
                    const available = Object.entries(this.state.agents).filter(([id, a]) =>
                        id !== 'player' && !factory.workers.includes(id) &&
                        (!a.status_text || a.status_text === 'normal')
                    );
                    if (available.length > 0) {
                        html += '<br>';
                        available.slice(0, 5).forEach(([id, a]) => {
                            html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="assign-worker" data-val="${key},${id}">+${a.name}</button>`;
                        });
                    }
                }
                html += '</div>';

                // Production progress
                if (factory.recipe) {
                    const recipe = def.recipes.find(r => r.id === factory.recipe);
                    if (recipe) {
                        const pct = Math.round(factory.productionProgress / recipe.time * 100);
                        html += `${t('<div style="font-size:0.75rem;margin:4px 0">生產進度：')}${pct}%</div>`;
                    }
                }

                // Warehouse
                const wh = factory.warehouse || {};
                if (Object.keys(wh).length > 0) {
                    html += t('<div style="margin:4px 0;font-size:0.8rem"><strong>倉庫：</strong>');
                    for (const [res, amt] of Object.entries(wh)) {
                        html += `<span style="margin-right:8px">${res}: ${amt}`;
                        html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="collect-product" data-val="${key},${res},${amt}${t('">收</button>')}`;
                        html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="sell-product" data-val="${key},${res},${amt}${t('">賣</button>')}`;
                        html += '</span>';
                    }
                    html += '</div>';
                }
            }
            html += '</div>';
        }

        // Available to build
        const available = this.world.processing.getAvailableFactories(this.world);
        if (available.length > 0) {
            html += t('<div class="econ-section"><h3>可建造工廠</h3>');
            available.forEach(f => {
                const costStr = Object.entries(f.cost).map(([r,a]) => `${r}:${a}`).join(' ');
                const canBuild = f.canAfford ? '' : ' disabled';
                html += `<div class="build-card"><div><strong>${f.icon} ${f.name}</strong>
                    <br><span style="font-size:0.7rem">${costStr}${t(' | 建造天數：')}${f.buildDays}</span></div>
                    <button class="trade-btn"${canBuild} data-action="build-factory" data-val="${f.key}${t('">建造</button></div>')}`;
            });
            html += '</div>';
        }

        // Active orders
        const orders = (proc.orders || []).filter(o => o.status === 'active');
        if (orders.length > 0) {
            html += t('<div class="econ-section"><h3>📋 訂單</h3>');
            orders.forEach(o => {
                html += `<div class="build-card"><div><strong>${o.description}</strong>
                    <br><span style="font-size:0.7rem">${t('獎勵：')}${o.reward}${t('銀幣 | 剩餘')}${o.daysLeft}${t('天')}</span></div>
                    <button class="trade-btn" data-action="fulfill-order" data-val="${o.id}${t('">完成</button></div>')}`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    _buildFactory(key) {
        const r = this.world.processing.buildFactory(key, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法建造'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    }
    _setRecipe(factoryKey, recipeId) {
        this.world.processing.setRecipe(factoryKey, recipeId);
        this.state = this.world.getState(); this.renderSidebar();
    }
    _assignWorker(factoryKey, agentId) {
        this.world.processing.assignWorker(factoryKey, agentId);
        this.state = this.world.getState(); this.renderSidebar();
    }
    _collectProduct(factoryKey, resource, amount) {
        this.world.processing.collectProduct(factoryKey, resource, amount, this.world);
        this.state = this.world.getState(); this.renderSidebar();
    }
    _sellProduct(factoryKey, resource, amount) {
        this.world.processing.sellProduct(factoryKey, resource, amount, this.world);
        this.state = this.world.getState(); this.renderSidebar();
    }
    _fulfillOrder(orderId) {
        const r = this.world.processing.fulfillOrder(orderId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法完成訂單'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    }

    // ============================================================
    // Records Tab (日報 + 日誌)
    // ============================================================
    renderRecords(container) {
        this.renderLog(container);
    }

    // ============================================================
    // Newspaper Tab
    // ============================================================
    renderNewspaper(container) {
        if (!this.state) return;
        const news = this.state.dailyNews || {};
        const papers = news.newspapers || [];

        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>📰 AI 日報（共 ')}${papers.length}${t(' 期）</h3></div>')}`;

        if (papers.length === 0) {
            html += t('<div class="econ-section"><p class="muted-text">還沒有日報。每天結束時會自動發佈。</p></div>');
        }

        // Show latest first
        const display = papers.slice().reverse().slice(0, 20);
        for (let i = 0; i < display.length; i++) {
            const paper = display[i];
            const isExpanded = this._expandedNewspaper === paper.id;
            const isLatest = i === 0;

            html += `<div class="news-card ${isExpanded ? 'news-expanded' : ''} ${isLatest ? 'news-latest' : ''}" data-action="view-newspaper" data-val="${paper.id}">`;
            html += `<div class="news-card-header">`;
            html += `<div class="news-card-issue">#${paper.id}</div>`;
            html += `<div class="news-card-meta">`;
            html += `${t('<div class="news-card-date">第')}${paper.year}${t('年 ')}${paper.season}${t(' 第')}${paper.day}${t('天</div>')}`;
            html += `<div class="news-card-reporter">✍️ ${paper.reporter}（${paper.reporterJob}）</div>`;
            html += `</div>`;
            html += `<div class="news-card-toggle">${isExpanded ? '▲' : '▼'}</div>`;
            html += `</div>`;

            // Show headline preview when collapsed
            if (!isExpanded && paper.content) {
                const firstLine = paper.content.split('\n').find(l => l.trim().length > 0) || '';
                const preview = firstLine.length > 40 ? firstLine.substring(0, 40) + '…' : firstLine;
                html += `<div class="news-card-preview">${this._escapeHtml(preview)}</div>`;
            }

            if (isExpanded) {
                html += `<div class="news-card-content">${this._escapeHtml(paper.content)}</div>`;
            }
            html += '</div>';
        }

        if (papers.length > 20) {
            html += `${t('<div class="econ-section"><p class="muted-text">顯示最近 20 期（共 ')}${papers.length}${t(' 期）</p></div>')}`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    _viewNewspaper(id) {
        this._expandedNewspaper = this._expandedNewspaper === id ? null : id;
        this.renderSidebar();
    }

    // ============================================================
    // Quest Tab (主線任務)
    // ============================================================
    renderQuest(container) {
        if (!this.state) return;
        // Trigger quest check on view
        if (this.world.questSystem) this.world.questSystem.checkProgress(this.world);
        this.state = this.world.getState();
        const qs = this.state.questSystem;
        if (!qs) {
            container.innerHTML = t('<div class="economy-panel"><p class="muted-text">任務系統尚未載入。</p></div>');
            return;
        }

        const chapterNames = typeof CHAPTER_NAMES !== 'undefined' ? CHAPTER_NAMES : {};
        const rewardLabels = { silver: '💰', food: '🍖', wood: '🪵', stone: '🪨', metal: '⛓️', reputation: '⭐' };
        let html = '<div class="economy-panel">';

        // Header with reputation
        html += t('<div class="econ-section"><h3>⚔️ 主線任務</h3>');
        html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進度：')}${qs.completedCount}/${qs.totalCount}${t(' 完成')}`;
        if (qs.reputation) html += `${t(' | ⭐ 聲望：')}${qs.reputation}`;
        html += `</div></div>`;

        // Crisis banner
        if (qs.activeCrisis) {
            const crisisLabels = { locust: t('🦗 蝗災'), bandit: t('⚔️ 盜匪圍城'), plague: t('🏥 瘟疫') };
            html += `<div class="econ-section" style="background:rgba(255,80,80,0.1);border-left:3px solid var(--negative);padding:8px 12px">`;
            html += `${t('<div style="font-weight:bold;color:var(--negative)">⚠️ 當前危機：')}${crisisLabels[qs.activeCrisis] || qs.activeCrisis}</div>`;
            html += `</div>`;
        }

        // Overall progress bar
        const overallPct = Math.round((qs.completedCount / qs.totalCount) * 100);
        html += `<div class="econ-section"><div class="progress-bar" style="height:10px;margin-bottom:8px"><div class="progress-fill" style="width:${overallPct}%;background:var(--accent)"></div></div></div>`;

        // Group quests by chapter
        const chapters = {};
        for (const [qId, qData] of Object.entries(qs.quests)) {
            const ch = qData.chapter || 1;
            if (!chapters[ch]) chapters[ch] = [];
            chapters[ch].push({ id: qId, ...qData });
        }

        for (const [chNum, quests] of Object.entries(chapters)) {
            const chName = chapterNames[chNum] || `${t('第')}${chNum}${t('章')}`;
            const allCompleted = quests.every(q => q.status === 'completed');
            const hasActive = quests.some(q => q.status === 'active');

            html += `<div class="econ-section">`;
            html += `<h3 style="color:${allCompleted ? 'var(--positive)' : hasActive ? 'var(--accent)' : 'var(--text-muted)'}">${allCompleted ? '✅' : hasActive ? '📖' : '🔒'} ${chName}</h3>`;

            for (const quest of quests) {
                if (quest.status === 'locked') {
                    html += t('<div class="quest-card quest-locked"><div class="quest-title">🔒 ???</div><div class="quest-desc">完成前置任務後解鎖</div></div>');
                    continue;
                }

                const isActive = quest.status === 'active';
                const isComplete = quest.status === 'completed';
                const cardClass = isComplete ? 'quest-completed' : isActive ? 'quest-active' : '';

                html += `<div class="quest-card ${cardClass}">`;
                html += `<div class="quest-title">${isComplete ? '✅' : quest.isCrisis ? '⚠️' : quest.isFinale ? '🏆' : '⚔️'} ${quest.title}</div>`;
                html += `<div class="quest-desc">${quest.description}</div>`;

                // Completed route badge
                if (isComplete && quest.completedRoute && quest.routes) {
                    const route = quest.routes.find(r => r.id === quest.completedRoute);
                    if (route) {
                        html += `${t('<div style="margin:4px 0;font-size:0.75rem;color:var(--positive)">✓ 以「')}${route.icon || ''} ${route.label}${t('」完成</div>')}`;
                    }
                }

                // Multi-route display
                if (quest.routes && isActive) {
                    html += '<div class="quest-routes" style="margin-top:6px">';
                    html += t('<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">選擇任一路線完成即可：</div>');
                    for (const route of quest.routes) {
                        // Calculate route overall progress
                        const condCount = route.conditions.length;
                        const condDone = route.conditions.filter(c => c.completed).length;
                        const routePct = condCount > 0 ? Math.round((condDone / condCount) * 100) : 0;
                        const routeComplete = condDone === condCount;

                        html += `<div class="quest-route" style="margin:6px 0;padding:6px 8px;border-radius:6px;background:${routeComplete ? 'rgba(80,200,120,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${routeComplete ? 'var(--positive)' : 'rgba(255,255,255,0.08)'}">`;
                        html += `<div style="font-weight:bold;font-size:0.8rem;margin-bottom:3px">${route.icon || '📋'} ${route.label}</div>`;
                        html += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:4px">${route.description}</div>`;

                        for (const cond of route.conditions) {
                            const pct = Math.min(100, Math.round((cond.progress / cond.target) * 100));
                            html += `<div class="quest-objective ${cond.completed ? 'done' : ''}" style="margin:2px 0">`;
                            html += `<span style="font-size:0.75rem">${cond.completed ? '☑' : '☐'} ${cond.label}</span>`;
                            html += `<span class="quest-obj-progress" style="font-size:0.7rem">${cond.progress}/${cond.target}</span>`;
                            html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${cond.completed ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                            html += '</div>';
                        }
                        html += '</div>';
                    }
                    html += '</div>';
                }

                // Multi-route display for completed quests (collapsed)
                if (quest.routes && isComplete) {
                    const completedRoute = quest.routes.find(r => r.id === quest.completedRoute);
                    if (completedRoute) {
                        html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">`;
                        html += `${t('其他路線：')}${quest.routes.filter(r => r.id !== quest.completedRoute).map(r => `${r.icon || ''} ${r.label}`).join('、') || t('無')}`;
                        html += `</div>`;
                    }
                }

                // Legacy objectives (for ch1_settle)
                if (quest.objectives && !quest.routes) {
                    html += '<div class="quest-objectives">';
                    for (const obj of quest.objectives) {
                        const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
                        const done = obj.completed;
                        html += `<div class="quest-objective ${done ? 'done' : ''}">`;
                        html += `<span>${done ? '☑' : '☐'} ${obj.label}</span>`;
                        html += `<span class="quest-obj-progress">${obj.progress}/${obj.target}</span>`;
                        html += `<div class="progress-bar" style="height:4px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${done ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                        html += '</div>';
                    }
                    html += '</div>';
                }

                // Rewards
                if (isActive && quest.rewards) {
                    const rewardStr = Object.entries(quest.rewards)
                        .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                        .join('  ');
                    html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                }

                // Completion message
                if (isComplete && quest.onComplete) {
                    html += `<div class="quest-complete-msg">${quest.onComplete}</div>`;
                }

                html += '</div>';
            }
            html += '</div>';
        }

        // ============================================================
        // 每日目標
        // ============================================================
        if (qs.dailyObjective) {
            html += `<div class="econ-section">`;
            html += t('<h3>⭐ 每日目標</h3>');
            html += `<div class="quest-card quest-active" style="border-left:3px solid var(--accent)">`;
            html += `<div class="quest-title">${qs.dailyObjective.icon || '📋'} ${qs.dailyObjective.text}</div>`;
            if (qs.dailyObjective.reward) {
                const rewardStr = Object.entries(qs.dailyObjective.reward)
                    .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                    .join('  ');
                html += `${t('<div class="quest-rewards" style="margin-top:2px;font-size:0.72rem">獎勵：')}${rewardStr}</div>`;
            }
            html += `</div></div>`;
        }

        // ============================================================
        // 支線任務
        // ============================================================
        const sideQuests = qs.sideQuests || {};
        const activeSides = Object.values(sideQuests).filter(q => q.status === 'active');
        const completedSides = Object.values(sideQuests).filter(q => q.status === 'completed');
        if (activeSides.length > 0 || completedSides.length > 0) {
            html += t('<div class="econ-section"><h3>📖 支線任務</h3>');
            html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進行中：')}${activeSides.length}${t(' | 已完成：')}${completedSides.length}</div>`;
            html += `</div>`;

            for (const quest of activeSides) {
                html += `<div class="quest-card quest-active" style="border-left:3px solid #e88d3f">`;
                html += `<div class="quest-title">📖 ${quest.title}</div>`;
                html += `<div class="quest-desc">${quest.description}</div>`;
                if (quest.story) {
                    html += `<div style="font-size:0.72rem;color:var(--text-secondary);font-style:italic;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(232,141,63,0.4);background:rgba(232,141,63,0.05)">${quest.story}</div>`;
                }
                if (quest.objectives) {
                    html += '<div class="quest-objectives">';
                    for (const obj of quest.objectives) {
                        const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
                        const done = obj.completed;
                        html += `<div class="quest-objective ${done ? 'done' : ''}">`;
                        html += `<span style="font-size:0.75rem">${done ? '☑' : '☐'} ${obj.label}</span>`;
                        html += `<span class="quest-obj-progress" style="font-size:0.7rem">${obj.progress}/${obj.target}</span>`;
                        html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${done ? 'var(--positive)' : '#e88d3f'}"></div></div>`;
                        html += '</div>';
                    }
                    html += '</div>';
                }
                if (quest.rewards) {
                    const rewardStr = Object.entries(quest.rewards)
                        .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                        .join('  ');
                    html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                }
                html += '</div>';
            }

            for (const quest of completedSides) {
                html += `<div class="quest-card quest-completed">`;
                html += `<div class="quest-title">✅ ${quest.title}</div>`;
                if (quest.onComplete) {
                    html += `<div class="quest-complete-msg">${quest.onComplete}</div>`;
                }
                html += '</div>';
            }
        }

        // ============================================================
        // NPC 個人故事線
        // ============================================================
        const nq = this.state.npcQuests;
        if (nq) {
            html += t('<div class="econ-section"><h3>💫 NPC 個人故事</h3>');
            html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進行中：')}${nq.activeCount}${t(' | 已完成：')}${nq.completedCount}/${nq.totalDefinedCount}</div>`;
            html += `</div>`;

            // Active personal quests
            if (nq.active && nq.active.length > 0) {
                for (const quest of nq.active) {
                    html += `<div class="quest-card quest-active">`;
                    html += `<div class="quest-title">${quest.icon || '💫'} ${quest.title}</div>`;

                    // Show NPC name
                    const npcName = quest.npcId ? (this.state.agents?.[quest.npcId]?.name || quest.npcId) : '';
                    if (npcName) html += `${t('<div style="font-size:0.7rem;color:var(--accent);margin-bottom:2px">來自：')}${npcName}</div>`;

                    html += `<div class="quest-desc">${quest.description}</div>`;

                    // Routes
                    if (quest.routes) {
                        html += '<div class="quest-routes" style="margin-top:6px">';
                        for (const route of quest.routes) {
                            const condCount = route.conditions.length;
                            const condDone = route.conditions.filter(c => c.completed).length;
                            const routeComplete = condDone === condCount;

                            html += `<div class="quest-route" style="margin:6px 0;padding:6px 8px;border-radius:6px;background:${routeComplete ? 'rgba(80,200,120,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${routeComplete ? 'var(--positive)' : 'rgba(255,255,255,0.08)'}">`;
                            html += `<div style="font-weight:bold;font-size:0.8rem;margin-bottom:3px">${route.icon || '📋'} ${route.label}</div>`;

                            for (const cond of route.conditions) {
                                const pct = cond.target > 0 ? Math.min(100, Math.round((cond.progress / cond.target) * 100)) : 0;
                                html += `<div class="quest-objective ${cond.completed ? 'done' : ''}" style="margin:2px 0">`;
                                html += `<span style="font-size:0.75rem">${cond.completed ? '☑' : '☐'} ${cond.label}</span>`;
                                if (cond.target > 1) html += `<span class="quest-obj-progress" style="font-size:0.7rem">${cond.progress}/${cond.target}</span>`;
                                html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${cond.completed ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                                html += '</div>';
                            }
                            html += '</div>';
                        }
                        html += '</div>';
                    }

                    // Rewards
                    if (quest.rewards) {
                        const rewardStr = Object.entries(quest.rewards)
                            .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                            .join('  ');
                        html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                    }
                    html += '</div>';
                }
            } else {
                html += t('<div class="econ-section"><p class="muted-text" style="font-size:0.8rem">提升與 NPC 的好感度來觸發個人故事線。</p></div>');
            }

            // Completed personal quests
            if (nq.completed && nq.completed.length > 0) {
                html += t('<div class="econ-section"><h3 style="color:var(--positive)">✅ 已完成的個人故事</h3>');
                for (const quest of nq.completed) {
                    const npcName = quest.npcId ? (this.state.agents?.[quest.npcId]?.name || quest.npcId) : '';
                    const route = quest.routes?.find(r => r.id === quest.completedRoute);
                    html += `<div class="quest-card quest-completed">`;
                    html += `<div class="quest-title">✅ ${quest.icon || '💫'} ${quest.title}</div>`;
                    if (npcName) html += `${t('<div style="font-size:0.7rem;color:var(--text-muted)">來自：')}${npcName}</div>`;
                    if (route) html += `${t('<div style="font-size:0.7rem;color:var(--positive);margin-top:2px">✓ 以「')}${route.icon || ''} ${route.label}${t('」完成</div>')}`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Industry bonuses from NPC affinity
            const bonusEntries = Object.entries(nq.industryBonuses || {}).filter(([,v]) => v > 0);
            if (bonusEntries.length > 0) {
                const indLabels = { woodcutting: t('🪓 伐木'), mining: t('⛏️ 採礦'), farming: t('🌾 農業'), smithing: t('⚒️ 鍛造'), trade: t('💰 貿易') };
                html += t('<div class="econ-section"><h3>📈 NPC 產業加成</h3>');
                for (const [ind, bonus] of bonusEntries) {
                    const pct = Math.round(bonus * 100);
                    html += `<div style="font-size:0.8rem;margin:2px 0">${indLabels[ind] || ind}：+${pct}%</div>`;
                }
                html += '</div>';
            }
        }

        html += '</div>';
        container.innerHTML = html;
    }

    _locationLabel(locId) {
        if (!locId) return '';
        const labels = {
            town_hall: t('鎮公所'), clinic: t('診所'), workshop: t('工坊'),
            farm: t('農場'), tavern: t('酒館'), guardpost: t('哨站'),
            chapel: t('教堂'), library: t('圖書館'), general_store: t('雜貨店'),
            quarry: t('礦場'), town_square: t('廣場'), park: t('公園'),
            well: t('水井'), residential_north: t('北區住宅'),
            residential_south: t('南區住宅'), residential_east: t('東區住宅'),
            exploration: t('探險中'),
        };
        // Try the town map for custom location names
        if (this.state?.locations?.[locId]?.name) return this.state.locations[locId].name;
        return labels[locId] || locId.replace(/_/g, ' ');
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

// Initialize — only when the game container exists (WordPress shortcode loaded)
(function() {
    const init = () => {
        if (!document.getElementById('rimtown-app') && !document.getElementById('town-map-canvas')) return;
        const app = new RimTownApp();
        window.addEventListener('resize', () => { if (app.state) app.renderMap(); });
        if (I18N.getLang() !== 'zh') {
            I18N.setLang(I18N.getLang());
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
