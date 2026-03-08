// RimTown Chrome Extension - Frontend App

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
        this._viewingArchive = null; // current archive being viewed
        this.init();
    }

    async init() {
        await this.loadSettings();
        const loaded = await this.tryLoadGame();
        if (!loaded) {
            this.world.reset();
        }
        if (this.llmClient) {
            this.world.conversationEngine = new ConversationEngine(this.llmClient);
        }
        this.state = this.world.getState();
        this.setupTileMap();
        this.setupTabListeners();
        this.setupControlListeners();
        this.setupSettingsListeners();
        this.startSimulation();
        this.setupAutoSave();
        this.render();
        this._startRenderLoop();
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
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get(['llm_provider','llm_api_key','sim_speed']);
                if (data.sim_speed) this.simSpeed = parseInt(data.sim_speed);
                if (data.llm_provider && data.llm_provider !== 'none' && data.llm_api_key) {
                    this.llmClient = new LLMClient(data.llm_provider, data.llm_api_key);
                }
            }
        } catch(e) { console.log('No chrome.storage, using defaults'); }
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
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ llm_provider: provider, llm_api_key: apiKey, sim_speed: speed });
            }
        } catch(e) { console.log('Could not save to chrome.storage'); }
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

    setupControlListeners() {
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.world.paused = true; this.render();
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.world.paused = false; this.render();
        });
        document.getElementById('btn-new-game').addEventListener('click', async () => {
            if (confirm('Generate a new random town? All progress will be reset.\n(Chat history will be archived automatically)')) {
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
            // Load current values
            if (typeof chrome !== 'undefined' && chrome.storage) {
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
            const saveData = this.world.serialize();
            const json = JSON.stringify(saveData);
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ rimtown_save: json });
            } else {
                localStorage.setItem('rimtown_save', json);
            }
            this.world.logMessage('system', 'Game saved.');
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
                    alert('Failed to load save file.');
                }
            } catch(err) { alert('Invalid save file: ' + err.message); }
        };
        input.click();
    }

    // --- Chat Archive (per-session persistent storage) ---
    async _getStorage(key) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const data = await chrome.storage.local.get([key]);
            return data[key] || null;
        }
        return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : null;
    }
    async _setStorage(key, value) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ [key]: value });
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    async archiveChatHistory() {
        const player = this.world.agents?.get?.('player') || this.world.agents?.['player'];
        if (!player || !player.chatHistory || !player.chatHistory.length) return;

        const clock = this.world.clock;
        const archive = {
            id: Date.now(),
            savedAt: new Date().toISOString(),
            gameClock: `${clock.season || 'Spring'} Y${clock.year || 1} D${clock.day || 1}`,
            playerName: player.name,
            messageCount: player.chatHistory.length,
            npcNames: [...new Set(player.chatHistory.map(m => m.speaker === player.name ? m.target : m.speaker))],
            messages: [...player.chatHistory]
        };

        const archives = (await this._getStorage('rimtown_chat_archives')) || [];
        archives.push(archive);
        // Keep max 20 archives
        while (archives.length > 20) archives.shift();
        await this._setStorage('rimtown_chat_archives', archives);
        return archive;
    }

    async getChatArchives() {
        return (await this._getStorage('rimtown_chat_archives')) || [];
    }

    async deleteChatArchive(archiveId) {
        const archives = await this.getChatArchives();
        const filtered = archives.filter(a => a.id !== archiveId);
        await this._setStorage('rimtown_chat_archives', filtered);
    }

    exportChatLog(archive) {
        const lines = [];
        lines.push(`=== RimTown Chat Log ===`);
        lines.push(`Session: ${archive.gameClock}`);
        lines.push(`Player: ${archive.playerName}`);
        lines.push(`Saved: ${archive.savedAt}`);
        lines.push(`NPCs: ${archive.npcNames.join(', ')}`);
        lines.push(`Messages: ${archive.messageCount}`);
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

        let nearbyHtml = `<div class="chat-location">You are at: <strong>${playerLoc.replace(/_/g,' ')}</strong></div><div class="chat-nearby">`;
        if (nearbyNpcs.length) {
            nearbyHtml += '<div class="nearby-label">Nearby:</div><div class="nearby-list">';
            nearbyNpcs.forEach(npc => {
                nearbyHtml += `<button class="nearby-btn ${this.chatTarget===npc.id?'active':''}" onclick="app.startChatWith('${npc.id}')">
                    <span class="mood-indicator mood-${npc.mood_description}"></span>${npc.name}
                    <span class="nearby-job">${npc.job?.title||''}</span></button>`;
            });
            nearbyHtml += '</div>';
        } else {
            nearbyHtml += '<p class="muted-text">No one nearby.</p>';
        }

        // Show past chat contacts not currently nearby
        const nearbyIds = new Set(nearbyNpcs.map(n => n.id));
        const pastContacts = [...chattedNames].filter(name => {
            const id = nameToId[name];
            return id && !nearbyIds.has(id);
        });
        if (pastContacts.length) {
            nearbyHtml += '<div class="nearby-label" style="margin-top:6px">Chat History:</div><div class="nearby-list">';
            pastContacts.forEach(name => {
                const id = nameToId[name];
                const msgCount = chatHistory.filter(c => c.speaker === name || c.target === name).length;
                nearbyHtml += `<button class="nearby-btn history-btn ${this.chatTarget===id?'active':''}" onclick="app.startChatWith('${id}')">
                    ${name} <span class="nearby-job">${msgCount} msgs</span></button>`;
            });
            nearbyHtml += '</div>';
        }
        nearbyHtml += '</div>';

        let messagesHtml = '<div class="chat-messages" id="chat-messages">';
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const targetName = targetAgent?.name || this.chatTarget;
            const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
            if (!filtered.length) messagesHtml += `<p class="muted-text chat-hint">Start a conversation with ${targetName}...</p>`;
            filtered.forEach(msg => {
                const isP = msg.speaker === player.name;
                messagesHtml += `<div class="chat-bubble ${isP?'chat-player':'chat-npc'}">
                    <div class="chat-speaker">${msg.speaker}</div>
                    <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                    <div class="chat-time">${msg.time||''}</div></div>`;
            });
        } else messagesHtml += '<p class="muted-text chat-hint">Select someone to view conversation.</p>';
        messagesHtml += '</div>';

        let inputHtml = '';
        if (this.chatTarget) {
            const ta = this.state.agents[this.chatTarget];
            const isNearby = ta && ta.current_location === playerLoc;
            if (isNearby) {
                inputHtml = `<div class="chat-input-area">
                    <input type="text" id="chat-input" class="chat-input" placeholder="Type a message..."
                        onkeydown="if(event.key==='Enter') app._sendFromInput()" ${this.chatSending?'disabled':''}>
                    <button class="chat-send-btn" onclick="app._sendFromInput()" ${this.chatSending?'disabled':''}>${this.chatSending?'...':'Send'}</button></div>`;
            } else {
                inputHtml = `<div class="chat-input-area"><p class="muted-text" style="padding:8px">📜 Viewing past conversations with ${ta?.name||'them'}. Move to their location to chat.</p></div>`;
            }
        }
        // Archive actions bar
        let archiveBar = `<div class="chat-archive-bar">
            <button class="btn-archive-view" onclick="app.showChatArchives()">Past Sessions</button>
            <button class="btn-archive-save" onclick="app.manualArchiveChat()">Archive Now</button>
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
            <button class="btn-back" onclick="app.activeTab='chat'; app.renderSidebar();">&larr; Back to Chat</button>
            <h3>Chat Archives</h3>
        </div>`;
        if (!archives.length) {
            html += '<p class="muted-text" style="padding:12px">No archived sessions yet. Chat history is archived automatically when you start a new game.</p>';
        } else {
            html += '<div class="archive-list">';
            [...archives].reverse().forEach(a => {
                const date = new Date(a.savedAt).toLocaleDateString();
                html += `<div class="archive-item">
                    <div class="archive-info" onclick="app.viewArchive(${a.id})">
                        <div class="archive-title">${a.gameClock} - ${a.playerName}</div>
                        <div class="archive-meta">${date} | ${a.messageCount} messages | ${a.npcNames.length} NPCs</div>
                        <div class="archive-npcs">${a.npcNames.slice(0, 5).join(', ')}${a.npcNames.length > 5 ? '...' : ''}</div>
                    </div>
                    <div class="archive-actions">
                        <button onclick="app.exportArchivedChat(${a.id})" title="Export">Export</button>
                        <button onclick="app.deleteArchivedChat(${a.id})" title="Delete" class="btn-danger">Del</button>
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
            <button class="btn-back" onclick="app._viewingArchive=null; app.activeTab='chat-archives'; app.renderSidebar();">&larr; Back to Archives</button>
            <h3>${archive.gameClock}</h3>
            <div class="archive-meta">${archive.playerName} | ${archive.messageCount} msgs</div>
        </div>`;

        // NPC filter buttons
        html += '<div class="nearby-list" style="padding:4px 8px">';
        html += `<button class="nearby-btn ${!this._archiveNpcFilter?'active':''}" onclick="app._archiveNpcFilter=null; app.renderSidebar();">All</button>`;
        archive.npcNames.forEach(name => {
            html += `<button class="nearby-btn history-btn ${this._archiveNpcFilter===name?'active':''}" onclick="app._archiveNpcFilter='${name.replace(/'/g,"\\'")}'; app.renderSidebar();">${name}</button>`;
        });
        html += '</div>';

        // Messages
        let messages = archive.messages;
        if (this._archiveNpcFilter) {
            messages = messages.filter(m => m.speaker === this._archiveNpcFilter || m.target === this._archiveNpcFilter);
        }

        html += '<div class="chat-messages" id="chat-messages">';
        if (!messages.length) {
            html += '<p class="muted-text chat-hint">No messages found.</p>';
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
            <button class="btn-archive-save" onclick="app.exportArchivedChat(${archive.id})">Export This Log</button>
        </div>`;

        container.innerHTML = html;
        this._scrollChatToBottom();
    }

    async manualArchiveChat() {
        const result = await this.archiveChatHistory();
        if (result) {
            this.world.logMessage('system', `Chat archived (${result.messageCount} messages).`);
        } else {
            this.world.logMessage('system', 'No chat messages to archive.');
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
        if (!confirm('Delete this archived chat session?')) return;
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
        if (!skillsData?.skills) return '<p class="muted-text">No skills data</p>';
        const passionOrder = {burning:0,major:1,minor:2,none:3,incapable:4};
        const sorted = Object.entries(skillsData.skills).sort(([,a],[,b]) => {
            const pa=passionOrder[a.passion]??3, pb=passionOrder[b.passion]??3;
            if(pa!==pb) return pa-pb; return b.level-a.level;
        });
        let html = '<div class="skills-grid">';
        for (const [name, s] of sorted) {
            const barPct = s.incapable ? 0 : Math.max(0, Math.min(100, (s.level/20)*100 + s.progress*(100/20)));
            const passionLabel = {burning:'&#9733;&#9733;&#9733;',major:'&#9733;&#9733;',minor:'&#9733;',none:'',incapable:'&#10007;'}[s.passion]||'';
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
            html += `<div class="resident-card ${isSelected?'selected':''}" onclick="app.selectAgent('${aid}')">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${agent.name}${sameLoc?'<span class="nearby-badge">Nearby</span>':''}</span>
                    <span class="resident-job">${agent.job?.title||'Unemployed'}</span></div>
                <div class="resident-status"><span>${agent.activity} @ ${agent.current_location.replace(/_/g,' ')}</span><span>${agent.mood_description} (${agent.mood})</span></div>
                ${agent.current_thought?`<div style="font-size:0.7rem;color:#aaa;margin-top:4px;font-style:italic">"${agent.current_thought}"</div>`:''}
                ${sameLoc?`<button class="chat-with-btn" onclick="event.stopPropagation();app.startChatWith('${aid}')">Chat</button>`:''}</div>`;
        }
        container.innerHTML = html;
    }

    renderAgentDetail(container) {
        if (!this.selectedAgent || !this.state) { container.innerHTML = '<p class="muted-text" style="padding:20px">Select a resident to view details</p>'; return; }
        const agent = this.state.agents[this.selectedAgent]; if (!agent) return;
        const needs = agent.needs || {}, personality = agent.personality || {};
        const relationships = agent.relationships || [], memories = agent.recent_memories || [];
        const makeBar = (label, value) => {
            const cls = value > 60 ? 'high' : value > 30 ? 'medium' : 'low';
            return `<div class="needs-bar"><label>${label}</label><div class="bar"><div class="bar-fill ${cls}" style="width:${value}%"></div></div><span style="width:30px;text-align:right;font-size:0.6rem">${Math.round(value)}</span></div>`;
        };
        const player = this.state.agents['player'];
        const sameLoc = player && player.current_location === agent.current_location && this.selectedAgent !== 'player';
        const chatBtn = sameLoc ? `<button class="chat-with-btn" onclick="app.startChatWith('${this.selectedAgent}')">Chat with ${agent.name}</button>` : '';
        container.innerHTML = `<div class="detail-panel visible">
            <div class="detail-section"><h3>${agent.name} (Age ${agent.age})</h3>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||'Unemployed'} | ${agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${personality.background||''}</p>${chatBtn}</div>
            <div class="detail-section"><h3>Personality</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${t}</span>`).join('')}
                <div style="margin-top:4px;font-size:0.7rem;color:var(--text-secondary)">Values: ${(personality.values||[]).join(', ')}</div></div>
            <div class="detail-section"><h3>Needs</h3>${makeBar('Hunger',needs.hunger||0)}${makeBar('Rest',needs.rest||0)}${makeBar('Social',needs.social||0)}${makeBar('Comfort',needs.comfort||0)}${makeBar('Recreation',needs.recreation||0)}</div>
            <div class="detail-section"><h3>Skills (Total: ${agent.skills?.total_level||0})</h3>${this._renderSkills(agent.skills)}</div>
            <div class="detail-section"><h3>Relationships (${relationships.length})</h3>
                ${relationships.length===0?'<p style="font-size:0.7rem;color:var(--text-muted)">No relationships yet</p>':
                relationships.map(r=>`<div class="relationship-item"><span>${r.target_name}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type} (${r.affinity>0?'+':''}${r.affinity})${r.romantic_interest>0?' &#10084;'+r.romantic_interest:''}</span></div>`).join('')}</div>
            <div class="detail-section"><h3>Recent Memories</h3>
                ${memories.length===0?'<p style="font-size:0.7rem;color:var(--text-muted)">No memories yet</p>':
                memories.slice(-10).reverse().map(m=>`<div class="memory-item"><span class="memory-time">${m.time}</span>${m.content}</div>`).join('')}</div></div>`;
    }

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();
        let html = '';
        messages.forEach(msg => {
            html += `<div class="log-entry type-${msg.type}"><span class="log-time">${msg.time}</span>
                ${msg.agent?`<strong>${msg.agent}</strong>`:''} ${msg.content} ${msg.target?` &rarr; ${msg.target}`:''}</div>`;
        });
        container.innerHTML = html || '<p class="muted-text" style="padding:20px">No messages yet...</p>';
    }

    renderEvents(container) {
        if (!this.state) return;
        let html = '';

        // --- News Bulletins ---
        const news = this.state.news || {};
        const bulletins = news.bulletins || [];
        if (bulletins.length) {
            html += '<div class="news-section"><h4>📰 News Bulletins</h4><div class="news-ticker">';
            bulletins.forEach(b => {
                const severityIcon = {good:'🟢',info:'🔵',warning:'🟡',danger:'🔴'}[b.severity] || '⚪';
                const categoryIcon = {security:'🛡️',trade:'📦',weather:'🌤️',social:'👥',health:'🏥',discovery:'🔍',nature:'🌿',political:'⚔️'}[b.category] || '📋';
                const modKeys = Object.entries(news.active_modifiers || {}).filter(([k]) => {
                    return b.days_remaining > 0;
                });
                html += `<div class="news-bulletin severity-${b.severity}">
                    <div class="news-header">
                        <span class="news-severity">${severityIcon}</span>
                        <span class="news-category">${categoryIcon} ${b.category}</span>
                        <span class="news-duration">${b.days_remaining}d left</span>
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
                html += '<div class="news-effects"><span class="news-effects-label">Active Effects:</span> ';
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
            html += '<div class="chain-section"><h4>Active Event Chains</h4>';
            chains.forEach(c => { html += `<div>${c.current_event} (Stage ${c.stage}/${c.total_stages})</div>`; });
            html += '</div>';
        }
        const travelling = this.state.travelling_agents || [];
        if (travelling.length) {
            html += '<div class="travelling-section"><h4>Residents Travelling</h4>';
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
        container.innerHTML = html || '<p class="muted-text" style="padding:20px">No events yet. Events happen randomly each day.</p>';
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
        const labels = {food:'Food',wood:'Wood',stone:'Stone',metal:'Metal',cloth:'Cloth',herbs:'Herbs',silver:'Silver',meals:'Meals',tools:'Tools',clothing:'Clothing',medicine:'Medicine',furniture:'Furniture',research_points:'Research'};

        let html = '<div class="economy-panel">';

        // Resources
        html += '<div class="econ-section"><h3>Resources</h3><div class="resource-grid">';
        for (const [r, amount] of Object.entries(res)) {
            const icon = icons[r] || '📦';
            const label = labels[r] || r;
            const cls = amount < 10 ? 'res-low' : amount > 100 ? 'res-high' : '';
            html += `<div class="resource-item ${cls}"><span class="res-icon">${icon}</span><span class="res-label">${label}</span><span class="res-amount">${Math.round(amount)}</span></div>`;
        }
        html += '</div></div>';

        // Trade
        html += '<div class="econ-section"><h3>Trade</h3>';
        if (trade.merchant) {
            html += `<div class="merchant-card"><div class="merchant-name">${trade.merchant.name}</div>
                <div class="merchant-info">Specialty: ${trade.merchant.specialty} | Leaves in ${trade.merchant.daysRemaining} day(s)</div>
                <div class="trade-offers">`;
            trade.merchant.offers.forEach((offer, idx) => {
                const icon = icons[offer.resource] || '📦';
                const action = offer.isBuying ? 'Sell' : 'Buy';
                const actionCls = offer.isBuying ? 'trade-sell' : 'trade-buy';
                html += `<div class="trade-offer ${actionCls}">
                    <span>${icon} ${offer.resource}</span>
                    <span>×${Math.round(offer.amount)}</span>
                    <span>${offer.price}/ea</span>
                    <button class="trade-btn" onclick="app.executeTrade(${idx}, Math.min(5, ${offer.amount}))">${action} 5</button>
                    <button class="trade-btn" onclick="app.executeTrade(${idx}, ${offer.amount})">${action} All</button></div>`;
            });
            html += '</div></div>';
        } else {
            html += `<p class="muted-text">No merchant in town. One may arrive soon.</p>`;
        }
        html += '</div>';

        // Buildings
        html += '<div class="econ-section"><h3>Buildings</h3>';
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
            html += `<div class="completed-buildings">Completed: ${buildings.completed.map(p => p.name).join(', ')}</div>`;
        }
        // Available projects
        const available = this.world.buildings.getAvailable(this.world);
        if (available.length) {
            html += '<div class="available-buildings"><div class="build-label">Build:</div>';
            available.forEach(p => {
                const costStr = Object.entries(p.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                html += `<div class="build-option ${p.can_afford ? '' : 'cant-afford'}">
                    <div class="build-name">${p.name}</div>
                    <div class="build-desc">${p.description}</div>
                    <div class="build-cost">${costStr}</div>
                    <button class="build-btn" ${p.can_afford ? '' : 'disabled'} onclick="app.startBuilding('${p.key}')">Build</button></div>`;
            });
            html += '</div>';
        }
        html += '</div>';

        // Research
        html += '<div class="econ-section"><h3>Research</h3>';
        const projects = research.projects || {};
        const currentKey = research.current_research;
        if (currentKey && projects[currentKey]) {
            const cur = projects[currentKey];
            const pct = Math.round((cur.progress / cur.cost) * 100);
            html += `<div class="research-current">Researching: <strong>${cur.name}</strong>
                <div class="progress-bar"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>
                <span class="progress-text">${pct}%</span></div>`;
        }
        const availableResearch = Object.values(projects).filter(p => p.status === 'available');
        if (availableResearch.length) {
            html += '<div class="research-available"><div class="build-label">Available:</div>';
            availableResearch.forEach(p => {
                const isCurrent = p.key === currentKey;
                html += `<div class="research-option ${isCurrent ? 'active' : ''}">
                    <div class="build-name">${p.name}</div>
                    <div class="build-desc">${p.description} (Cost: ${p.cost})</div>
                    <button class="build-btn" onclick="app.startResearch('${p.key}')" ${isCurrent?'disabled':''}>Research</button></div>`;
            });
            html += '</div>';
        }
        const completedResearch = Object.values(projects).filter(p => p.status === 'complete');
        if (completedResearch.length) {
            html += `<div class="completed-buildings">Completed: ${completedResearch.map(p => p.name).join(', ')}</div>`;
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
