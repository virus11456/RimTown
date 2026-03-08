// RimTown - AI Town Simulation Frontend

class RimTownApp {
    constructor() {
        this.ws = null;
        this.state = null;
        this.selectedAgent = null;
        this.activeTab = 'residents';
        this.chatTarget = null;       // Agent ID we're chatting with
        this.chatSending = false;     // Prevent double-send
        this.agentColors = {};
        this.colorPalette = [
            '#e94560', '#4ade80', '#60a5fa', '#fbbf24', '#a78bfa',
            '#f472b6', '#34d399', '#38bdf8', '#fb923c', '#c084fc',
            '#22d3ee', '#f87171',
        ];
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupTabListeners();
        this.setupControlListeners();
        // Fallback: poll API if WebSocket fails
        setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.fetchState();
            }
        }, 3000);
    }

    connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${location.host}/ws`);

        this.ws.onmessage = (event) => {
            this.state = JSON.parse(event.data);
            this.render();
        };

        this.ws.onclose = () => {
            console.log('WebSocket closed, reconnecting in 3s...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }

    async fetchState() {
        try {
            const res = await fetch('/api/state');
            this.state = await res.json();
            this.render();
        } catch (e) {
            console.error('Failed to fetch state:', e);
        }
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
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ action: 'pause' }));
            }
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ action: 'resume' }));
            }
        });
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

    async playerMoveTo(locationId) {
        try {
            const res = await fetch('/api/player/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: locationId }),
            });
            const data = await res.json();
            if (data.error) {
                console.error('Move failed:', data.error);
                return;
            }
            // Refresh state
            await this.fetchState();
        } catch (e) {
            console.error('Move error:', e);
        }
    }

    async playerSendMessage(targetId, message) {
        if (this.chatSending || !message.trim()) return;
        this.chatSending = true;

        try {
            const res = await fetch('/api/player/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetId, message: message.trim() }),
            });
            const data = await res.json();
            this.chatSending = false;

            if (data.error) {
                this._appendChatBubble('system', data.error);
                return;
            }

            // NPC reply is returned - re-render chat to show updated history
            await this.fetchState();
            // Re-render chat tab
            if (this.activeTab === 'chat') {
                this.renderSidebar();
                this._scrollChatToBottom();
            }
        } catch (e) {
            this.chatSending = false;
            console.error('Chat error:', e);
        }
    }

    startChatWith(agentId) {
        this.chatTarget = agentId;
        this.activeTab = 'chat';
        document.querySelectorAll('.sidebar-tabs button').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === 'chat');
        });
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
        if (this.state.paused) {
            pauseBtn.classList.add('active');
            resumeBtn.classList.remove('active');
        } else {
            pauseBtn.classList.remove('active');
            resumeBtn.classList.add('active');
        }

        const agentCount = Object.keys(this.state.agents).length;
        document.getElementById('population-count').textContent = `Population: ${agentCount}`;
    }

    renderMap() {
        const mapEl = document.getElementById('town-map');
        const locations = this.state.locations?.locations || {};
        const agents = this.state.agents || {};
        const player = agents['player'];
        const playerLoc = player?.current_location;

        // Count agents per location
        const locationCounts = {};
        for (const [aid, agent] of Object.entries(agents)) {
            const loc = agent.current_location;
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        }

        // Render locations (clickable for player movement)
        let locHtml = '';
        for (const [lid, loc] of Object.entries(locations)) {
            const count = locationCounts[lid] || 0;
            const mapWidth = mapEl.clientWidth || 800;
            const mapHeight = mapEl.clientHeight || 600;
            const x = (loc.x / 800) * mapWidth;
            const y = (loc.y / 600) * mapHeight;
            const isPlayerHere = lid === playerLoc;

            locHtml += `
                <div class="location cat-${loc.category} ${isPlayerHere ? 'player-here' : ''}"
                     style="left: ${x}px; top: ${y}px; transform: translate(-50%, -50%)"
                     data-location="${lid}"
                     onclick="app.playerMoveTo('${lid}')">
                    <div class="location-name">${loc.name}</div>
                    <div class="location-count">${count} people ${isPlayerHere ? '(You)' : ''}</div>
                </div>
            `;
        }

        // Render agent dots
        let agentHtml = '';
        const agentsByLocation = {};
        for (const [aid, agent] of Object.entries(agents)) {
            const loc = agent.current_location;
            if (!agentsByLocation[loc]) agentsByLocation[loc] = [];
            agentsByLocation[loc].push({ id: aid, ...agent });
        }

        for (const [lid, locAgents] of Object.entries(agentsByLocation)) {
            const loc = locations[lid];
            if (!loc) continue;
            const mapWidth = mapEl.clientWidth || 800;
            const mapHeight = mapEl.clientHeight || 600;
            const baseX = (loc.x / 800) * mapWidth;
            const baseY = (loc.y / 600) * mapHeight;

            locAgents.forEach((agent, i) => {
                const angle = (i / locAgents.length) * Math.PI * 2;
                const radius = 20 + (locAgents.length > 4 ? 10 : 0);
                const ax = baseX + Math.cos(angle) * radius;
                const ay = baseY + Math.sin(angle) * radius + 20;
                const isPlayer = agent.id === 'player';
                const color = this.assignAgentColor(agent.id);

                const isSelected = this.selectedAgent === agent.id;
                const dotSize = isPlayer ? 16 : 12;
                const border = isPlayer
                    ? '3px solid #fff'
                    : isSelected ? '3px solid white' : `2px solid ${color}`;

                const clickAction = isPlayer
                    ? ''
                    : `onclick="app.onAgentClick('${agent.id}')"`;

                agentHtml += `
                    <div class="agent-dot ${isPlayer ? 'player-dot' : ''}"
                         style="left:${ax}px; top:${ay}px; background:${color}; border:${border};
                                width:${dotSize}px; height:${dotSize}px"
                         ${clickAction} data-agent="${agent.id}">
                        <div class="tooltip">${isPlayer ? 'You' : agent.name} - ${agent.activity}</div>
                    </div>
                `;

                // Thought bubble (not for player)
                if (!isPlayer && agent.current_thought && Math.random() > 0.5) {
                    agentHtml += `
                        <div class="thought-bubble visible" style="left:${ax - 30}px; top:${ay - 20}px">
                            ${agent.current_thought}
                        </div>
                    `;
                }
            });
        }

        mapEl.innerHTML = locHtml + agentHtml;
    }

    onAgentClick(agentId) {
        const player = this.state?.agents?.['player'];
        const target = this.state?.agents?.[agentId];
        if (!player || !target) return;

        // If same location, start chat; otherwise show detail
        if (player.current_location === target.current_location) {
            this.startChatWith(agentId);
        } else {
            this.selectAgent(agentId);
        }
    }

    renderSidebar() {
        const content = document.getElementById('sidebar-content');

        switch (this.activeTab) {
            case 'residents':
                this.renderResidentsList(content);
                break;
            case 'chat':
                this.renderChat(content);
                break;
            case 'detail':
                this.renderAgentDetail(content);
                break;
            case 'log':
                this.renderLog(content);
                break;
            case 'events':
                this.renderEvents(content);
                break;
        }
    }

    // --- Chat Tab ---

    renderChat(container) {
        const player = this.state?.agents?.['player'];
        if (!player) {
            container.innerHTML = '<p class="muted-text">Player not found.</p>';
            return;
        }

        const playerLoc = player.current_location;
        const chatHistory = player.chat_history || [];

        // Get NPCs at player's location
        const nearbyNpcs = Object.entries(this.state.agents)
            .filter(([id, a]) => id !== 'player' && a.current_location === playerLoc)
            .map(([id, a]) => ({ id, ...a }));

        // Nearby agents selector
        let nearbyHtml = `
            <div class="chat-location">
                You are at: <strong>${playerLoc.replace(/_/g, ' ')}</strong>
            </div>
            <div class="chat-nearby">
        `;

        if (nearbyNpcs.length === 0) {
            nearbyHtml += '<p class="muted-text">No one else is here. Move to another location.</p>';
        } else {
            nearbyHtml += '<div class="nearby-label">Talk to:</div><div class="nearby-list">';
            for (const npc of nearbyNpcs) {
                const isActive = this.chatTarget === npc.id;
                nearbyHtml += `
                    <button class="nearby-btn ${isActive ? 'active' : ''}"
                            onclick="app.startChatWith('${npc.id}')">
                        <span class="mood-indicator mood-${npc.mood_description}"></span>
                        ${npc.name}
                        <span class="nearby-job">${npc.job?.title || ''}</span>
                    </button>
                `;
            }
            nearbyHtml += '</div>';
        }
        nearbyHtml += '</div>';

        // Chat messages
        let messagesHtml = '<div class="chat-messages" id="chat-messages">';

        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const targetName = targetAgent?.name || this.chatTarget;

            // Filter chat history for this target
            const filtered = chatHistory.filter(
                c => c.target === targetName || c.speaker === targetName
            );

            if (filtered.length === 0) {
                messagesHtml += `<p class="muted-text chat-hint">Start a conversation with ${targetName}...</p>`;
            }

            for (const msg of filtered) {
                const isPlayer = msg.speaker === player.name;
                messagesHtml += `
                    <div class="chat-bubble ${isPlayer ? 'chat-player' : 'chat-npc'}">
                        <div class="chat-speaker">${msg.speaker}</div>
                        <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                        <div class="chat-time">${msg.time || ''}</div>
                    </div>
                `;
            }
        } else {
            messagesHtml += '<p class="muted-text chat-hint">Select someone nearby to start chatting.</p>';
        }
        messagesHtml += '</div>';

        // Input area
        let inputHtml = '';
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const isNearby = targetAgent && targetAgent.current_location === playerLoc;

            if (isNearby) {
                inputHtml = `
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" class="chat-input"
                               placeholder="Type a message..."
                               onkeydown="if(event.key==='Enter') app._sendFromInput()"
                               ${this.chatSending ? 'disabled' : ''}>
                        <button class="chat-send-btn" onclick="app._sendFromInput()"
                                ${this.chatSending ? 'disabled' : ''}>
                            ${this.chatSending ? '...' : 'Send'}
                        </button>
                    </div>
                `;
            } else {
                inputHtml = `
                    <div class="chat-input-area">
                        <p class="muted-text" style="padding:8px">${targetAgent?.name || 'They'} left this area.</p>
                    </div>
                `;
            }
        }

        container.innerHTML = nearbyHtml + messagesHtml + inputHtml;

        // Auto-scroll and focus
        this._scrollChatToBottom();
        const input = document.getElementById('chat-input');
        if (input && !this.chatSending) input.focus();
    }

    _sendFromInput() {
        const input = document.getElementById('chat-input');
        if (!input || !this.chatTarget) return;
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        this.playerSendMessage(this.chatTarget, msg);
    }

    _scrollChatToBottom() {
        requestAnimationFrame(() => {
            const el = document.getElementById('chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    _appendChatBubble(type, text) {
        const el = document.getElementById('chat-messages');
        if (!el) return;
        const div = document.createElement('div');
        div.className = `chat-bubble chat-${type}`;
        div.innerHTML = `<div class="chat-text">${this._escapeHtml(text)}</div>`;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Other Tabs ---

    renderResidentsList(container) {
        if (!this.state) return;
        const agents = Object.entries(this.state.agents);

        let html = '';
        for (const [aid, agent] of agents) {
            if (aid === 'player') continue; // Skip player in residents list
            const color = this.assignAgentColor(aid);
            const isSelected = this.selectedAgent === aid;
            const player = this.state.agents['player'];
            const sameLoc = player && player.current_location === agent.current_location;

            html += `
                <div class="resident-card ${isSelected ? 'selected' : ''}"
                     onclick="app.selectAgent('${aid}')">
                    <div class="resident-header">
                        <span class="resident-name">
                            <span class="mood-indicator mood-${agent.mood_description}"></span>
                            ${agent.name}
                            ${sameLoc ? '<span class="nearby-badge">Nearby</span>' : ''}
                        </span>
                        <span class="resident-job">${agent.job?.title || 'Unemployed'}</span>
                    </div>
                    <div class="resident-status">
                        <span>${agent.activity} @ ${agent.current_location.replace(/_/g, ' ')}</span>
                        <span>${agent.mood_description} (${agent.mood})</span>
                    </div>
                    ${agent.current_thought ? `<div style="font-size:0.7rem; color:#aaa; margin-top:4px; font-style:italic">"${agent.current_thought}"</div>` : ''}
                    ${sameLoc ? `<button class="chat-with-btn" onclick="event.stopPropagation(); app.startChatWith('${aid}')">Chat</button>` : ''}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderAgentDetail(container) {
        if (!this.selectedAgent || !this.state) {
            container.innerHTML = '<p class="muted-text" style="padding:20px">Select a resident to view details</p>';
            return;
        }

        const agent = this.state.agents[this.selectedAgent];
        if (!agent) return;

        const needs = agent.needs || {};
        const personality = agent.personality || {};
        const relationships = agent.relationships || [];
        const memories = agent.recent_memories || [];

        const makeBar = (label, value) => {
            const cls = value > 60 ? 'high' : value > 30 ? 'medium' : 'low';
            return `
                <div class="needs-bar">
                    <label>${label}</label>
                    <div class="bar"><div class="bar-fill ${cls}" style="width:${value}%"></div></div>
                    <span style="width:30px; text-align:right; font-size:0.6rem">${Math.round(value)}</span>
                </div>
            `;
        };

        // Chat button if nearby
        const player = this.state.agents['player'];
        const sameLoc = player && player.current_location === agent.current_location && this.selectedAgent !== 'player';
        const chatBtn = sameLoc
            ? `<button class="chat-with-btn" onclick="app.startChatWith('${this.selectedAgent}')">Chat with ${agent.name}</button>`
            : '';

        let html = `
            <div class="detail-panel visible">
                <div class="detail-section">
                    <h3>${agent.name} (Age ${agent.age})</h3>
                    <p style="font-size:0.8rem; color:var(--text-secondary)">${agent.job?.title || 'Unemployed'} | ${agent.mood_description}</p>
                    <p style="font-size:0.75rem; margin-top:6px">${personality.background || ''}</p>
                    ${chatBtn}
                </div>

                <div class="detail-section">
                    <h3>Personality</h3>
                    ${(personality.traits || []).map(t => `<span class="trait-tag">${t}</span>`).join('')}
                    <div style="margin-top:4px; font-size:0.7rem; color:var(--text-secondary)">
                        Values: ${(personality.values || []).join(', ')}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Needs</h3>
                    ${makeBar('Hunger', needs.hunger || 0)}
                    ${makeBar('Rest', needs.rest || 0)}
                    ${makeBar('Social', needs.social || 0)}
                    ${makeBar('Comfort', needs.comfort || 0)}
                    ${makeBar('Recreation', needs.recreation || 0)}
                </div>

                <div class="detail-section">
                    <h3>Relationships (${relationships.length})</h3>
                    ${relationships.length === 0 ? '<p style="font-size:0.7rem; color:var(--text-muted)">No relationships yet</p>' :
                    relationships.map(r => `
                        <div class="relationship-item">
                            <span>${r.target_name}</span>
                            <span style="color: ${r.affinity > 0 ? 'var(--positive)' : r.affinity < 0 ? 'var(--negative)' : 'var(--text-muted)'}">
                                ${r.type} (${r.affinity > 0 ? '+' : ''}${r.affinity})
                                ${r.romantic_interest > 0 ? ' &#10084;' + r.romantic_interest : ''}
                            </span>
                        </div>
                    `).join('')}
                </div>

                <div class="detail-section">
                    <h3>Recent Memories</h3>
                    ${memories.length === 0 ? '<p style="font-size:0.7rem; color:var(--text-muted)">No memories yet</p>' :
                    memories.slice(-10).reverse().map(m => `
                        <div class="memory-item">
                            <span class="memory-time">${m.time}</span>
                            ${m.content}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();

        let html = '';
        for (const msg of messages) {
            html += `
                <div class="log-entry type-${msg.type}">
                    <span class="log-time">${msg.time}</span>
                    ${msg.agent ? `<strong>${msg.agent}</strong>` : ''}
                    ${msg.content}
                    ${msg.target ? ` &rarr; ${msg.target}` : ''}
                </div>
            `;
        }

        container.innerHTML = html || '<p class="muted-text" style="padding:20px">No messages yet...</p>';
    }

    renderEvents(container) {
        if (!this.state) return;
        const events = (this.state.recent_events || []).slice().reverse();

        let html = '';
        for (const evt of events) {
            html += `
                <div class="event-card severity-${evt.severity}">
                    <div style="font-weight:bold">${evt.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary)">${evt.time}</div>
                    <div style="margin-top:4px">${evt.description}</div>
                </div>
            `;
        }

        container.innerHTML = html || '<p class="muted-text" style="padding:20px">No events yet. Events happen randomly each day.</p>';
    }

    selectAgent(agentId) {
        this.selectedAgent = agentId;
        this.activeTab = 'detail';
        document.querySelectorAll('.sidebar-tabs button').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === 'detail');
        });
        this.render();
    }
}

// Initialize
const app = new RimTownApp();

// Handle window resize
window.addEventListener('resize', () => {
    if (app.state) app.renderMap();
});
