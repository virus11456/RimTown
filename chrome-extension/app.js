// RimTown - Frontend App

// === Account Manager ===
class AccountManager {
    constructor() {
        this.currentUser = null;
        this._loadSession();
    }
    _loadSession() {
        try {
            const session = localStorage.getItem('rimtown_session');
            if (session) {
                const data = JSON.parse(session);
                const users = this._getUsers();
                if (users[data.username]) { this.currentUser = data.username; }
            }
        } catch(e) {}
    }
    _getUsers() {
        try { return JSON.parse(localStorage.getItem('rimtown_users') || '{}'); } catch(e) { return {}; }
    }
    _saveUsers(users) {
        localStorage.setItem('rimtown_users', JSON.stringify(users));
    }
    isLoggedIn() { return !!this.currentUser; }
    getUsername() { return this.currentUser; }
    register(username, password) {
        if (!username || !password) return { ok:false, error:'帳號和密碼不能為空' };
        if (username.length < 2) return { ok:false, error:'帳號至少需要2個字元' };
        if (password.length < 4) return { ok:false, error:'密碼至少需要4個字元' };
        const users = this._getUsers();
        if (users[username]) return { ok:false, error:'此帳號已存在' };
        // Simple hash (not cryptographically secure, but sufficient for local storage)
        users[username] = { passwordHash: this._simpleHash(password), createdAt: new Date().toISOString() };
        this._saveUsers(users);
        this.currentUser = username;
        localStorage.setItem('rimtown_session', JSON.stringify({ username }));
        return { ok:true };
    }
    login(username, password) {
        const users = this._getUsers();
        if (!users[username]) return { ok:false, error:'帳號不存在' };
        if (users[username].passwordHash !== this._simpleHash(password)) return { ok:false, error:'密碼錯誤' };
        this.currentUser = username;
        localStorage.setItem('rimtown_session', JSON.stringify({ username }));
        return { ok:true };
    }
    logout() {
        this.currentUser = null;
        localStorage.removeItem('rimtown_session');
    }
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
        return 'h_' + Math.abs(hash).toString(36);
    }
    // User-scoped storage prefix
    storagePrefix() { return this.currentUser ? `rimtown_u_${this.currentUser}_` : 'rimtown_'; }

    // --- Multi-Town Management ---
    getTownList() {
        try {
            return JSON.parse(localStorage.getItem(this.storagePrefix() + 'town_list') || '[]');
        } catch(e) { return []; }
    }
    _saveTownList(list) {
        localStorage.setItem(this.storagePrefix() + 'town_list', JSON.stringify(list));
    }
    saveTown(townId, name, saveData) {
        const list = this.getTownList();
        const existing = list.find(t => t.id === townId);
        const clock = saveData.clock || {};
        const meta = {
            id: townId,
            name: name,
            savedAt: new Date().toISOString(),
            season: clock.season || '春季',
            year: clock.year || 1,
            day: clock.day || 1,
            population: Object.keys(saveData.agents || {}).length,
        };
        if (existing) Object.assign(existing, meta);
        else list.push(meta);
        this._saveTownList(list);
        localStorage.setItem(this.storagePrefix() + 'town_' + townId, JSON.stringify(saveData));
    }
    loadTown(townId) {
        try {
            const json = localStorage.getItem(this.storagePrefix() + 'town_' + townId);
            return json ? JSON.parse(json) : null;
        } catch(e) { return null; }
    }
    deleteTown(townId) {
        const list = this.getTownList().filter(t => t.id !== townId);
        this._saveTownList(list);
        localStorage.removeItem(this.storagePrefix() + 'town_' + townId);
        localStorage.removeItem(this.storagePrefix() + 'town_' + townId + '_archives');
    }
    renameTown(townId, newName) {
        const list = this.getTownList();
        const town = list.find(t => t.id === townId);
        if (town) { town.name = newName; this._saveTownList(list); }
    }
    // Chat archives scoped per town
    getTownArchives(townId) {
        try {
            return JSON.parse(localStorage.getItem(this.storagePrefix() + 'town_' + townId + '_archives') || '[]');
        } catch(e) { return []; }
    }
    saveTownArchives(townId, archives) {
        localStorage.setItem(this.storagePrefix() + 'town_' + townId + '_archives', JSON.stringify(archives));
    }
}

class RimTownApp {
    constructor() {
        this.account = new AccountManager();
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
        this.init();
    }

    async init() {
        // Show login screen if not logged in
        if (!this.account.isLoggedIn()) {
            this._showLoginScreen();
            return;
        }
        this._hideLoginScreen();
        this._updateUserDisplay();
        await this.loadSettings();
        // Try to load last active town
        const lastTownId = localStorage.getItem(this.account.storagePrefix() + 'last_town');
        let loaded = false;
        if (lastTownId) {
            loaded = this._loadTownById(lastTownId);
        }
        if (!loaded) {
            // Try legacy save
            const legacyLoaded = await this.tryLoadGame();
            if (legacyLoaded) {
                this.currentTownId = 'town_' + Date.now();
                this._saveCurrentTown('邊境鎮');
            } else {
                this.world.reset();
                this.currentTownId = 'town_' + Date.now();
                this._saveCurrentTown('邊境鎮');
            }
        }
        if (this.llmClient) {
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        }
        this.state = this.world.getState();
        this.setupTileMap();
        this.setupTabListeners();
        this.setupControlListeners();
        this.setupSettingsListeners();
        this.setupEventDelegation();
        this.startSimulation();
        this.setupAutoSave();
        this.render();
        this._startRenderLoop();
    }

    // === Login / Account UI ===
    _showLoginScreen() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.classList.remove('hidden');
        // Hide main game UI
        document.querySelector('.header')?.classList.add('hidden');
        document.querySelector('.main-layout')?.classList.add('hidden');
    }
    _hideLoginScreen() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.classList.add('hidden');
        document.querySelector('.header')?.classList.remove('hidden');
        document.querySelector('.main-layout')?.classList.remove('hidden');
    }
    _updateUserDisplay() {
        const el = document.getElementById('user-display');
        if (el && this.account.isLoggedIn()) {
            el.innerHTML = `<span class="user-name">${this.account.getUsername()}</span>
                <button class="btn-towns" data-action="show-towns">城鎮列表</button>
                <button class="btn-logout" data-action="logout">登出</button>`;
        }
    }
    doLogin() {
        const u = document.getElementById('login-username')?.value?.trim();
        const p = document.getElementById('login-password')?.value;
        const errEl = document.getElementById('login-error');
        const result = this.account.login(u, p);
        if (result.ok) {
            this.init();
        } else {
            if (errEl) errEl.textContent = result.error;
        }
    }
    doRegister() {
        const u = document.getElementById('login-username')?.value?.trim();
        const p = document.getElementById('login-password')?.value;
        const errEl = document.getElementById('login-error');
        const result = this.account.register(u, p);
        if (result.ok) {
            this.init();
        } else {
            if (errEl) errEl.textContent = result.error;
        }
    }
    doLogout() {
        if (!confirm('確定要登出嗎？（遊戲會自動儲存）')) return;
        this.saveGame();
        if (this.simInterval) clearInterval(this.simInterval);
        this.account.logout();
        this.currentTownId = null;
        this._showLoginScreen();
    }

    // === Town Management ===
    _loadTownById(townId) {
        const saveData = this.account.loadTown(townId);
        if (!saveData) return false;
        const loaded = this.world.loadSave(saveData);
        if (loaded) {
            this.currentTownId = townId;
            localStorage.setItem(this.account.storagePrefix() + 'last_town', townId);
        }
        return loaded;
    }
    _saveCurrentTown(name) {
        if (!this.currentTownId) this.currentTownId = 'town_' + Date.now();
        const saveData = this.world.serialize();
        const list = this.account.getTownList();
        const existing = list.find(t => t.id === this.currentTownId);
        this.account.saveTown(this.currentTownId, existing?.name || name || '邊境鎮', saveData);
        localStorage.setItem(this.account.storagePrefix() + 'last_town', this.currentTownId);
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
        const towns = this.account.getTownList();
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
        // Save current town first
        this._saveCurrentTown();
        // Load new town
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
    createNewTown() {
        const name = prompt('為新城鎮命名：', '邊境鎮 ' + (this.account.getTownList().length + 1));
        if (!name) return;
        // Save current town first
        if (this.currentTownId) this._saveCurrentTown();
        // Create new town
        this.world.reset();
        if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
        this.currentTownId = 'town_' + Date.now();
        this._saveCurrentTown(name);
        this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
        this.state = this.world.getState();
        this._generateTileMapLayout();
        this.tileMap.agentPositions = {};
        this.render();
        this._renderTownList();
    }
    renameTownPrompt(townId) {
        const towns = this.account.getTownList();
        const town = towns.find(t => t.id === townId);
        if (!town) return;
        const newName = prompt('新名稱：', town.name);
        if (newName && newName.trim()) {
            this.account.renameTown(townId, newName.trim());
            this._renderTownList();
        }
    }
    deleteTownConfirm(townId) {
        if (!confirm('確定要刪除這個城鎮？所有存檔和聊天記錄都會消失。')) return;
        this.account.deleteTown(townId);
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
                this.tileMap.updateAgents(agents, this.state.locations?.locations || {});
                this.tileMap.render(agents, this.selectedAgent, player?.current_location);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    async loadSettings() {
        try {
            const prefix = this.account.storagePrefix();
            // Try user-scoped settings first, fall back to legacy
            const provider = localStorage.getItem(prefix + 'llm_provider') || localStorage.getItem('llm_provider');
            const apiKey = localStorage.getItem(prefix + 'llm_api_key') || localStorage.getItem('llm_api_key');
            const speed = localStorage.getItem(prefix + 'sim_speed') || localStorage.getItem('sim_speed');
            if (speed) this.simSpeed = parseInt(speed);
            if (provider && provider !== 'none' && apiKey) {
                this.llmClient = new LLMClient(provider, apiKey);
            }
            // Also try chrome.storage as fallback
            if (!provider && typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed']);
                if (data.sim_speed) this.simSpeed = parseInt(data.sim_speed);
                if (data.llm_provider && data.llm_provider !== 'none' && data.llm_api_key) {
                    this.llmClient = new LLMClient(data.llm_provider, data.llm_api_key);
                }
            }
        } catch(e) { console.log('Settings load error:', e); }
    }

    async saveSettings(provider, apiKey, speed) {
        this.simSpeed = parseInt(speed);
        if (provider && provider !== 'none' && apiKey) {
            this.llmClient = new LLMClient(provider, apiKey);
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        } else {
            this.llmClient = null;
            this.world.conversationEngine = new ConversationEngine();
        }
        this.restartSimulation();
        const prefix = this.account.storagePrefix();
        localStorage.setItem(prefix + 'llm_provider', provider);
        localStorage.setItem(prefix + 'llm_api_key', apiKey);
        localStorage.setItem(prefix + 'sim_speed', speed);
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ llm_provider: provider, llm_api_key: apiKey, sim_speed: speed });
            }
        } catch(e) {}
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
        document.querySelectorAll('.sidebar-tabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.dataset.tab;
                document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderSidebar();
            });
        });
    }

    // Global event delegation - handles all dynamic clicks via data-action attributes
    setupEventDelegation() {
        document.body.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const val = el.dataset.val || '';
            e.stopPropagation();
            switch(action) {
                // Account
                case 'show-towns': this.showTownManager(); break;
                case 'logout': this.doLogout(); break;
                case 'login': this.doLogin(); break;
                case 'register': this.doRegister(); break;
                // Town management
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
                case 'trade': { const [idx, amount] = val.split(','); this.executeTrade(parseInt(idx), parseInt(amount)); } break;
                case 'build': this.startBuilding(val); break;
                case 'research': this.startResearch(val); break;
                default: console.log('Unknown action:', action, val);
            }
        });
        // Handle Enter key in chat input via delegation
        document.body.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'chat-input') { this._sendFromInput(); }
            if (e.key === 'Enter' && (e.target.id === 'login-password' || e.target.id === 'login-username')) { this.doLogin(); }
        });
    }

    setupControlListeners() {
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.world.paused = true; this.render();
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.world.paused = false; this.render();
        });
        document.getElementById('btn-new-game').addEventListener('click', async () => {
            if (this.account.isLoggedIn()) {
                // Save current town and create new one
                const name = prompt('為新城鎮命名：', '邊境鎮 ' + (this.account.getTownList().length + 1));
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
            } else {
                if (confirm('產生新的隨機小鎮？所有進度將重置。\n（聊天記錄會自動存檔）')) {
                    await this.archiveChatHistory();
                    this.world.reset();
                    if (this.llmClient) this.world.conversationEngine = new ConversationEngine(this.llmClient);
                    this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    this.tileMap.agentPositions = {};
                    this.deleteSave();
                    this.render();
                }
            }
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
            // Load current values from user-scoped or legacy storage
            const prefix = this.account.storagePrefix();
            const provider = localStorage.getItem(prefix + 'llm_provider');
            const apiKey = localStorage.getItem(prefix + 'llm_api_key');
            const speed = localStorage.getItem(prefix + 'sim_speed');
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
        document.getElementById('settings-save').addEventListener('click', () => {
            const provider = document.getElementById('llm-provider').value;
            const apiKey = document.getElementById('llm-api-key').value;
            const speed = document.getElementById('sim-speed').value;
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
            if (this.account.isLoggedIn() && this.currentTownId) {
                this._saveCurrentTown();
            }
            // Legacy fallback
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
        // Auto-save every 60 seconds
        this._autoSaveInterval = setInterval(() => {
            if (!this.world.paused) this.saveGame();
        }, 60000);
        // Also save when tab is closing
        window.addEventListener('beforeunload', () => {
            try {
                if (this.account.isLoggedIn() && this.currentTownId) {
                    this._saveCurrentTown();
                }
                const json = JSON.stringify(this.world.serialize());
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.set({ rimtown_save: json });
                } else {
                    localStorage.setItem('rimtown_save', json);
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
    async _getStorage(key) {
        // User-scoped storage
        const scopedKey = this.account.storagePrefix() + key;
        try {
            const val = localStorage.getItem(scopedKey);
            if (val) return JSON.parse(val);
        } catch(e) {}
        // Fallback to legacy key
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get([key]);
                return data[key] || null;
            }
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : null;
        } catch(e) { return null; }
    }
    async _setStorage(key, value) {
        const scopedKey = this.account.storagePrefix() + key;
        localStorage.setItem(scopedKey, JSON.stringify(value));
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ [key]: value });
            }
        } catch(e) {}
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

        // Save to town-specific archives if logged in
        if (this.account.isLoggedIn() && this.currentTownId) {
            const archives = this.account.getTownArchives(this.currentTownId);
            archives.push(archive);
            while (archives.length > 30) archives.shift();
            this.account.saveTownArchives(this.currentTownId, archives);
        }
        // Also save to generic key for legacy
        const archives = (await this._getStorage('rimtown_chat_archives')) || [];
        archives.push(archive);
        while (archives.length > 20) archives.shift();
        await this._setStorage('rimtown_chat_archives', archives);
        return archive;
    }

    async getChatArchives() {
        // Prefer town-specific archives
        if (this.account.isLoggedIn() && this.currentTownId) {
            const townArchives = this.account.getTownArchives(this.currentTownId);
            if (townArchives.length) return townArchives;
        }
        return (await this._getStorage('rimtown_chat_archives')) || [];
    }

    async deleteChatArchive(archiveId) {
        if (this.account.isLoggedIn() && this.currentTownId) {
            const archives = this.account.getTownArchives(this.currentTownId).filter(a => a.id !== archiveId);
            this.account.saveTownArchives(this.currentTownId, archives);
        }
        const archives = (await this._getStorage('rimtown_chat_archives')) || [];
        const filtered = archives.filter(a => a.id !== archiveId);
        await this._setStorage('rimtown_chat_archives', filtered);
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
        this.chatTarget = agentId;
        this.activeTab = 'chat';
        document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'chat'));
        this.renderSidebar();
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
    }

    renderMap() {
        // Map rendering is now handled by the canvas animation loop (_startRenderLoop)
        // This method is kept as a no-op for compatibility
    }

    onAgentClick(agentId) {
        const player = this.state?.agents?.['player'];
        const target = this.state?.agents?.[agentId];
        if (!player || !target) return;
        if (player.current_location === target.current_location) this.startChatWith(agentId);
        else this.selectAgent(agentId);
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
        for (const [aid, agent] of Object.entries(this.state.agents)) {
            if (aid === 'player') continue;
            const isSelected = this.selectedAgent === aid;
            const player = this.state.agents['player'];
            const sameLoc = player && player.current_location === agent.current_location;
            html += `<div class="resident-card ${isSelected?'selected':''}" data-action="select-agent" data-val="${aid}">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${agent.name}${sameLoc?'<span class="nearby-badge">附近</span>':''}</span>
                    <span class="resident-job">${agent.job?.title||'無業'}</span></div>
                <div class="resident-status"><span>${agent.activity_label||agent.activity} @ ${agent.current_location.replace(/_/g,' ')}</span><span>${agent.mood_label||agent.mood_description} (${agent.mood})</span></div>
                ${agent.current_thought?`<div style="font-size:0.7rem;color:#aaa;margin-top:4px;font-style:italic">「${agent.current_thought}」</div>`:''}
                ${sameLoc?`<button class="chat-with-btn" data-action="start-chat" data-val="${aid}">對話</button>`:''}</div>`;
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
        const chatBtn = sameLoc ? `<button class="chat-with-btn" data-action="start-chat" data-val="${this.selectedAgent}">與${agent.name}對話</button>` : '';
        container.innerHTML = `<div class="detail-panel visible">
            <div class="detail-section"><h3>${agent.name}（${agent.age}歲）</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||'無業'} | ${agent.mood_label||agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${personality.background||''}</p>${chatBtn}</div>
            <div class="detail-section"><h3>性格</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${TRAIT_LABELS[t]||t}</span>`).join('')}
                <div style="margin-top:4px;font-size:0.7rem;color:var(--text-secondary)">價值觀：${(personality.values||[]).join('、')}</div></div>
            <div class="detail-section"><h3>需求</h3>${makeBar('飢餓',needs.hunger||0)}${makeBar('休息',needs.rest||0)}${makeBar('社交',needs.social||0)}${makeBar('舒適',needs.comfort||0)}${makeBar('娛樂',needs.recreation||0)}</div>
            <div class="detail-section"><h3>技能（總計：${agent.skills?.total_level||0}）</h3>${this._renderSkills(agent.skills)}</div>
            <div class="detail-section"><h3>人際關係（${relationships.length}）</h3>
                ${relationships.length===0?'<p style="font-size:0.7rem;color:var(--text-muted)">尚無人際關係</p>':
                relationships.map(r=>{
                    const statusBadge = r.status_label ? `<span class="rel-status-badge rel-${r.status||''}">${r.status_label}</span>` : '';
                    const cheatingBadge = r.is_cheating ? '<span class="rel-status-badge rel-cheating">秘密關係</span>' : '';
                    return `<div class="relationship-item"><span>${r.target_name} ${statusBadge}${cheatingBadge}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type}（${r.affinity>0?'+':''}${r.affinity}）${r.romantic_interest>0?' &#10084;'+r.romantic_interest:''}</span></div>`;
                }).join('')}</div>
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
        container.innerHTML = html || '<p class="muted-text" style="padding:20px">尚無訊息...</p>';
    }

    renderEvents(container) {
        if (!this.state) return;
        let html = '';

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
        container.innerHTML = html || '<p class="muted-text" style="padding:20px">尚無事件。事件每天會隨機發生。</p>';
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

    selectAgent(agentId) {
        this.selectedAgent = agentId;
        this.activeTab = 'detail';
        document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'detail'));
        this.render();
    }
}

// Initialize
const app = new RimTownApp();
window.addEventListener('resize', () => { if (app.state) app.renderMap(); });
