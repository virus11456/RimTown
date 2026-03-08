// RimTown - AI Town Simulation Frontend

class RimTownApp {
    constructor() {
        this.ws = null;
        this.state = null;
        this.selectedAgent = null;
        this.activeTab = 'residents';
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
        if (!this.agentColors[agentId]) {
            const idx = Object.keys(this.agentColors).length % this.colorPalette.length;
            this.agentColors[agentId] = this.colorPalette[idx];
        }
        return this.agentColors[agentId];
    }

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

        // Update population count
        const agentCount = Object.keys(this.state.agents).length;
        document.getElementById('population-count').textContent = `Population: ${agentCount}`;
    }

    renderMap() {
        const mapEl = document.getElementById('town-map');
        const locations = this.state.locations?.locations || {};
        const agents = this.state.agents || {};

        // Count agents per location
        const locationCounts = {};
        for (const [aid, agent] of Object.entries(agents)) {
            const loc = agent.current_location;
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        }

        // Render locations
        let locHtml = '';
        for (const [lid, loc] of Object.entries(locations)) {
            const count = locationCounts[lid] || 0;
            const mapWidth = mapEl.clientWidth || 800;
            const mapHeight = mapEl.clientHeight || 600;
            const x = (loc.x / 800) * mapWidth;
            const y = (loc.y / 600) * mapHeight;

            locHtml += `
                <div class="location cat-${loc.category}"
                     style="left: ${x}px; top: ${y}px; transform: translate(-50%, -50%)"
                     data-location="${lid}">
                    <div class="location-name">${loc.name}</div>
                    <div class="location-count">${count} people</div>
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
                // Spread agents around the location
                const angle = (i / locAgents.length) * Math.PI * 2;
                const radius = 20 + (locAgents.length > 4 ? 10 : 0);
                const ax = baseX + Math.cos(angle) * radius;
                const ay = baseY + Math.sin(angle) * radius + 20;
                const color = this.assignAgentColor(agent.id);

                const isSelected = this.selectedAgent === agent.id;
                const border = isSelected ? '3px solid white' : `2px solid ${color}`;

                agentHtml += `
                    <div class="agent-dot" style="left:${ax}px; top:${ay}px; background:${color}; border:${border}"
                         onclick="app.selectAgent('${agent.id}')" data-agent="${agent.id}">
                        <div class="tooltip">${agent.name} - ${agent.activity}</div>
                    </div>
                `;

                // Thought bubble
                if (agent.current_thought && Math.random() > 0.5) {
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

    renderSidebar() {
        const content = document.getElementById('sidebar-content');

        switch (this.activeTab) {
            case 'residents':
                this.renderResidentsList(content);
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

    renderResidentsList(container) {
        if (!this.state) return;
        const agents = Object.entries(this.state.agents);

        let html = '';
        for (const [aid, agent] of agents) {
            const color = this.assignAgentColor(aid);
            const isSelected = this.selectedAgent === aid;
            html += `
                <div class="resident-card ${isSelected ? 'selected' : ''}"
                     onclick="app.selectAgent('${aid}')">
                    <div class="resident-header">
                        <span class="resident-name">
                            <span class="mood-indicator mood-${agent.mood_description}"></span>
                            ${agent.name}
                        </span>
                        <span class="resident-job">${agent.job?.title || 'Unemployed'}</span>
                    </div>
                    <div class="resident-status">
                        <span>${agent.activity}</span>
                        <span>${agent.mood_description} (${agent.mood})</span>
                    </div>
                    ${agent.current_thought ? `<div style="font-size:0.7rem; color:#aaa; margin-top:4px; font-style:italic">"${agent.current_thought}"</div>` : ''}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderAgentDetail(container) {
        if (!this.selectedAgent || !this.state) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:20px">Select a resident to view details</p>';
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

        let html = `
            <div class="detail-panel visible">
                <div class="detail-section">
                    <h3>${agent.name} (Age ${agent.age})</h3>
                    <p style="font-size:0.8rem; color:var(--text-secondary)">${agent.job?.title || 'Unemployed'} | ${agent.mood_description}</p>
                    <p style="font-size:0.75rem; margin-top:6px">${personality.background || ''}</p>
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
                                ${r.romantic_interest > 0 ? ' ❤' + r.romantic_interest : ''}
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
                    ${msg.target ? ` → ${msg.target}` : ''}
                </div>
            `;
        }

        container.innerHTML = html || '<p style="color:var(--text-muted); padding:20px">No messages yet...</p>';
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

        container.innerHTML = html || '<p style="color:var(--text-muted); padding:20px">No events yet. Events happen randomly each day.</p>';
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
