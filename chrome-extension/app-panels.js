// RimTown - app-panels.js：從 app.js 拆出的 側欄分頁：技能、自訂村民、結局、城鎮身分、每日焦點、故事動態、居民列表、村民詳情、設定、日誌、事件（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
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
            html += `<div class="skill-row passion-${s.passion}"><span class="skill-name">${t(name)}</span>
                <span class="skill-passion">${passionLabel}</span>
                <div class="skill-bar"><div class="skill-bar-fill" style="width:${barPct}%"></div></div>
                <span class="skill-level">${s.incapable?'-':s.level}</span></div>`;
        }
        return html + '</div>';
    },

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
        // v5.81.0 選填英文名:英文介面的地圖名牌、對話與日誌都用它,不填就顯示原名
        html += `<input type="text" id="custom-npc-name-en" maxlength="20" placeholder="${t('英文名（選填，英文介面顯示用）')}" style="width:100%;margin-top:6px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem">`;

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
    },

    // ============================================================
    // v5.89.0 村民資訊卡頭像(v6.80.2 起不能自己改外觀)
    // ============================================================
    _agentAvatarImg(agentId, agentState) {
        try {
            const live = this.world?.agents?.[agentId];
            const url = this.tileMap?.renderAvatarDataURL?.(agentState?.job?.key || live?.job?.key, agentState?.gender || live?.gender, agentState?.name || live?.name, live?.look || null);
            return url ? `<img src="${url}" alt="" style="width:32px;height:56px;image-rendering:pixelated;flex:none">` : '';
        } catch (e) { return ''; }
    },
    // v6.80.2 拿掉「改外觀」：玩家不能自己改村民長相(新居民也是依名字與職業自動配外觀)

    _createCustomNPC() {
        if (!this.world.customNPC) return;

        const name = document.getElementById('custom-npc-name')?.value?.trim();
        const gender = document.querySelector('input[name="custom-npc-gender"]:checked')?.value || 'male';
        const age = parseInt(document.getElementById('custom-npc-age')?.value || '25');
        const job = document.getElementById('custom-npc-job')?.value || 'farmer';
        const background = document.getElementById('custom-npc-background')?.value?.trim() || '';

        const traits = Array.from(document.querySelectorAll('.custom-npc-trait:checked')).map(cb => cb.value);
        const values = Array.from(document.querySelectorAll('.custom-npc-value:checked')).map(cb => cb.value);

        const nameEn = (document.getElementById('custom-npc-name-en')?.value || '').trim().replace(/[^A-Za-z .'-]/g, '').slice(0, 20); // v5.81.0
        const look = null; // v6.80.2 外觀不給玩家選，依名字與職業自動配
        const config = { name, gender, age, job, traits, values, background, nameEn, look };
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
    },

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
        (document.getElementById('rimtown-app') || document.body).appendChild(wrapper); // v6.58.1 放進事件代理的範圍內,按鈕才點得動
    },

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
            this.world.conversationEngine = this._makeConversationEngine();
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
            this.world.logMessageT('system', '🔄 {msg}', { msg });
            this.world.logMessage('system', `🌅 ═══════════════════════════`);
            this.state = this.world.getState();
            this.render();
        }, 500);
    },

    // v5.19.0 城鎮身分詳情:讓玩家看懂「小鎮為什麼長成這樣」
    _showTownIdentity() {
        const ident = this.state?.townIdentity;
        if (!ident || !ident.route) return;
        const meta = { commerce: ['💰', t('商業')], military: ['🛡️', t('軍事')], agrarian: ['🌾', t('農業')], scholarly: ['📚', t('學術')], romance: ['💕', t('浪漫')], crime: ['🗡️', t('江湖')] };
        const scores = ident.scores || {};
        const max = Math.max(1, ...Object.values(scores).map(Number));
        const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
            const [ic, label] = meta[k] || ['·', k];
            const pct = Math.max(2, Math.round((v / max) * 100));
            const isTop = k === ident.route;
            return `<div class="ti-bar-row"><span class="ti-bar-label">${ic} ${label}</span>
                <span class="ti-bar-track"><span class="ti-bar-fill${isTop ? ' ti-bar-top' : ''}" style="width:${pct}%"></span></span></div>`;
        }).join('');
        this._showCenterNotification({
            icon: ident.routeIcon,
            title: ident.routeName,
            desc: ident.routeDesc,
            content: `<div class="ti-detail"><div class="ti-detail-head">${t('小鎮的長期傾向(近期權重)')}</div>${rows}<div class="ti-detail-foot">${t('路線會隨你的長期經營自然轉變——它記錄的是這座小鎮的故事。')}</div></div>`,
        });
    },

    // v5.17.0 情境入口:分類 → 圖示 / 目的地分頁
    _newsCatIcon(cat) {
        return { gossip:'💬', drama:'🔥', milestone:'🌟', social:'🤝', lifecycle:'🌱', building:'🏗️', exploration:'🗺️', event:'⚡', politics:'🗳️', relationship:'💕' }[cat] || '📌';
    },
    // v5.31.0 今日焦點:回答「我現在該做什麼、為什麼」——每天 2-3 個可點的具體行動
    _renderDailyFocus() {
        let focus = this.world?.dailyFocus;
        const clock = this.world?.clock;
        const key = clock ? `${clock.year}-${clock.season}-${clock.day}` : '';
        if ((!focus || focus.key !== key) && this.world?.generateDailyFocus) {
            try { focus = this.world.generateDailyFocus(); } catch (e) { focus = null; }
        }
        if (!focus?.items?.length) return '';
        const rows = focus.items.map((it, i) => `
            <button class="headline-row" data-action="focus-go" data-val="${i}">
                <span class="headline-ic">${it.icon}</span>
                <span class="headline-text">${this._escapeHtml(it.text)}<span style="display:block;font-size:0.65rem;color:var(--text-muted);margin-top:1px">${this._escapeHtml(it.reason || '')}</span></span>
                <span class="headline-go">›</span>
            </button>`).join('');
        return `<div class="town-headlines" style="border-left:3px solid var(--accent)">
            <div class="headlines-title"><span>🎯 ${t('今日焦點')}</span></div>
            ${rows}
        </div>`;
    },

    _focusGo(idx) {
        const it = this.world?.dailyFocus?.items?.[parseInt(idx, 10)];
        if (!it) return;
        if (it.npcId && this.world?.agents?.[it.npcId]) { this._showNpcCard(it.npcId); return; }
        if (it.tab) {
            if (this._isTabLocked?.(it.tab)) { this._lockedAlert(it.tab); return; }
            if (this._kairoReady && window.innerWidth <= 768) this._kairoCardOpen = true; // v5.35.3 手機版開浮動卡
            this.activeTab = it.tab; this._updateTabHighlight?.(it.tab);
            this.state = this.world.getState(); this.renderSidebar();
        }
    },

    // v5.31.0 今天的故事:把最獨特的記憶流/反思/AI 對話拉到首頁第一層
    // v5.48.0 關係時間軸:兩個人從認識到現在的完整故事線(記憶流+名場面+現狀,零成本)
    _showRelTimeline(pairKey) {
        const [idA, idB] = String(pairKey).split('|');
        const w = this.world;
        const a = w?.agents?.[idA], b = w?.agents?.[idB];
        if (!a || !b) return;
        const rows = [];
        for (const [own, other] of [[a, b], [b, a]]) {
            for (const m of own.memory.entries) {
                if ((m.relatedAgents || []).includes(other.name)) {
                    rows.push({ tick: m.tick || 0, time: m.timeStr || '', who: own.name, text: m.text ? m.text() : m.content, cat: m.category }); // v6.17.0 依當下語言
                }
            }
        }
        (w.dramaArchive || []).forEach((s, i) => {
            if ((s.aName === a.name && s.bName === b.name) || (s.aName === b.name && s.bName === a.name)) {
                rows.push({ tick: s.tick || 0, time: `${t('第 {y} 年{s}').split('{y}').join(s.year).split('{s}').join(t(s.season))} ${t('第 {d} 天').split('{d}').join(s.day)}`, who: '', text: `${s.icon || '🎭'} ${s.title}`, drama: i });
            }
        });
        rows.sort((x, y) => x.tick - y.tick);
        const rel = a.relationships.relationships[idB];
        const statusLine = rel?.status === 'married' ? `💍 ${t('已婚')}` : rel?.status === 'dating' ? `💗 ${t('交往中')}`
            : rel?.isFeud ? `💢 ${t('絕交中')}` : (rel?.affinity ?? 0) >= 40 ? `🤝 ${t('好友')}`
            : (rel?.affinity ?? 0) <= -30 ? `⚔️ ${t('交惡')}` : `👋 ${t('相識')}`;
        const catIc = { conversation: '💬', relationship: '💥', whisper: '🤫', reflection: '💭', election: '🗳️', observation: '👀', plan: '🗓️', gift: '🎁' };
        document.getElementById('rel-timeline-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'rel-timeline-modal';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
        const items = rows.slice(-40).map(r => {
            const tm = (String(r.time).match(/(\d{2}:\d{2})$/) || [])[1] || r.time;
            const body = r.drama != null
                ? `<button data-rt-drama="${r.drama}" style="background:none;border:none;color:#ffd166;cursor:pointer;padding:0;font-size:0.74rem;text-align:left">📺 ${this._escapeHtml(r.text)}${t('（')}${t('點我重播')}${t('）')}</button>`
                : `${catIc[r.cat] || '·'} <b>${this._escapeHtml(r.who)}</b>${t('：')}${this._escapeHtml(r.text)}`;
            return `<div style="margin:7px 0;font-size:0.72rem;line-height:1.5"><span style="color:var(--text-muted);font-size:0.6rem">${this._escapeHtml(r.time)}</span><br>${body}</div>`;
        }).join('');
        ov.innerHTML = `<div style="background:var(--bg-card,#20222c);border:1px solid var(--border,#444);border-radius:12px;max-width:400px;width:100%;max-height:78vh;display:flex;flex-direction:column;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:700;font-size:0.92rem">📜 ${t(a.name)} × ${t(b.name)}</div>
                <button data-rt-close="1" style="background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer">✕</button>
            </div>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin:2px 0 8px">${t('目前關係：')}${statusLine}</div>
            <div style="overflow-y:auto;flex:1;border-top:1px solid var(--border,#333);padding-top:4px">${items || `<p style="font-size:0.72rem;color:var(--text-muted)">${t('兩人還沒有共同的故事。')}</p>`}</div>
        </div>`;
        ov.addEventListener('click', (e) => {
            const d = e.target.closest?.('[data-rt-drama]');
            if (d) { const s = (this.world?.dramaArchive || [])[parseInt(d.dataset.rtDrama, 10)]; if (s) { ov.remove(); this._showDramaScene(s); } return; }
            if (e.target.closest?.('[data-rt-close]') || e.target === ov) ov.remove();
        });
        (document.getElementById('rimtown-app') || document.body).appendChild(ov); // v6.46.0
    },

    // v5.48.0 追蹤村民:訂閱你在追的 CP/冤家,大事角落通知
    _followSet() {
        if (!this._follows) {
            try { this._follows = new Set(JSON.parse(localStorage.getItem('rimtown_follows_' + this.currentTownId) || '[]')); }
            catch (e) { this._follows = new Set(); }
        }
        return this._follows;
    },
    _toggleFollow(npcId) {
        const s = this._followSet();
        if (s.has(npcId)) s.delete(npcId); else s.add(npcId);
        try { localStorage.setItem('rimtown_follows_' + this.currentTownId, JSON.stringify([...s])); } catch (e) {}
        const npc = this.world?.agents?.[npcId];
        if (npc) this._showCornerNotice({ icon: s.has(npcId) ? '🔔' : '🔕', title: s.has(npcId) ? t('已追蹤') : t('取消追蹤'), name: npc.name, desc: s.has(npcId) ? t('他有大事發生時會通知你') : '' });
    },
    _checkFollowedNpcs() {
        const w = this.world;
        if (!w) return;
        const s = this._followSet();
        if (!s.size) return;
        this._followSeen = this._followSeen || {};
        let shown = 0;
        for (const id of s) {
            const npc = w.agents[id];
            if (!npc || npc.isDead) continue;
            if (this._followSeen[id] == null) { this._followSeen[id] = w.tickCount; continue; } // 剛追蹤:從現在開始,不倒灌舊事
            const fresh = (npc.memory?.entries || []).filter(m => m.tick > this._followSeen[id] && (m.importance || 0) >= 7).slice(-1)[0];
            this._followSeen[id] = w.tickCount;
            if (fresh && shown < 2) {
                shown++;
                this._showCornerNotice({ go: { agentId: id }, icon: '🔔', title: `${t('你追蹤的')}${t(npc.name)}`, name: '', desc: String(fresh.content).slice(0, 48) });
            }
        }
    },

    // v5.45.0 昨日回響:蝴蝶效應回饋卡
    _renderDailyEcho() {
        const lines = this.world?.dailyEcho || [];
        if (!lines.length) return '';
        return `<div class="town-identity" style="cursor:default;display:block">
            <span class="ti-badge">🦋 ${t('昨日回響')}</span>
            ${lines.map(l => `<div style="font-size:0.72rem;line-height:1.5;margin-top:4px;color:var(--text-primary)">· ${this._escapeHtml(l)}</div>`).join('')}
            <div style="font-size:0.6rem;color:var(--text-muted);margin-top:4px">${t('你昨天的舉動,正在改變這個小鎮')}</div>
        </div>`;
    },

    _renderStoryFeed() {
        if (!this.world) return '';
        const w = this.world;
        const dayStart = w.tickCount - (w.clock.hour * 4 + Math.floor(w.clock.minute / 15));
        const rows = [];
        const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
        // 名場面(今天)
        const arc = (w.dramaArchive || []).slice(-2);
        arc.forEach((s, i) => {
            if (s.year === w.clock.year && s.season === w.clock.season && Math.abs(w.clock.day - s.day) <= 1) {
                const realIdx = (w.dramaArchive || []).length - arc.length + i;
                rows.push({ icon: s.icon || '🎭', text: `${s.title}:${s.aName} × ${s.bName}`, action: 'replay-drama', val: String(realIdx) });
            }
        });
        // 反思(今天):村民的內心話
        for (const npc of npcs) {
            const refl = npc.memory.entries.filter(e => e.category === 'reflection' && e.tick >= dayStart).slice(-1)[0];
            if (refl) rows.push({ icon: '💭', text: `${t(npc.name)}:${refl.content}`, action: 'story-npc', val: npc.agentId });
            if (rows.length >= 6) break;
        }
        // 重大關係事件(今天,重要度>=9:交往/結婚/分手/背叛)
        if (rows.length < 6) {
            for (const npc of npcs) {
                const big = npc.memory.entries.filter(e => e.category === 'relationship' && e.tick >= dayStart && e.importance >= 9).slice(-1)[0];
                if (big) rows.push({ icon: '💥', text: `${t(npc.name)}:${big.content}`, action: 'story-npc', val: npc.agentId });
                if (rows.length >= 6) break;
            }
        }
        // AI 生成的村民對話(今天,最近 2 場)
        const convos = (w.conversationEngine?.npcConversationLog || []).slice(-30).filter(c => c.llm).slice(-2);
        for (const c of convos) {
            if (rows.length >= 6) break;
            rows.push({ icon: '✨', text: `${c.agentA} & ${c.agentB}:${c.summary}`, action: 'story-npc', val: c.agentAId });
        }
        // v5.48.0 追劇首頁:本集看點 + 進行中的劇情線 + 下集預告——每天像一集連續劇
        const storylines = this._computeStorylines();
        const teasers = this._computeTeasers();
        if (!rows.length && !storylines.length && !teasers.length) return '';
        const html = rows.slice(0, 4).map(r => `
            <button class="headline-row" data-action="${r.action}" data-val="${this._escapeHtml(r.val)}">
                <span class="headline-ic">${r.icon}</span>
                <span class="headline-text">${this._escapeHtml(r.text)}</span>
                <span class="headline-go">›</span>
            </button>`).join('');
        const slHtml = storylines.length ? `<div style="padding:5px 8px 2px;font-size:0.66rem;color:var(--text-secondary);font-weight:bold">📈 ${t('進行中的劇情線')}</div>` +
            storylines.map(s => `<button class="headline-row" data-action="rel-timeline" data-val="${this._escapeHtml(s.val)}">
                <span class="headline-ic">${s.icon}</span><span class="headline-text">${this._escapeHtml(s.text)}</span><span class="headline-go">📜</span></button>`).join('') : '';
        const tsHtml = teasers.length ? `<div style="padding:5px 8px 2px;font-size:0.66rem;color:var(--text-secondary);font-weight:bold">🔮 ${t('下集預告')}</div>` +
            teasers.map(s => `<div class="headline-row" style="cursor:default"><span class="headline-ic">${s.icon}</span><span class="headline-text" style="font-style:italic">${this._escapeHtml(s.text)}</span></div>`).join('') : '';
        const day = this.world.clock;
        return `<div class="town-headlines">
            <div class="headlines-title"><span>📺 ${t('第 {n} 集').replace('{n}', this.world._absDay ? this.world._absDay() : day.day)}·${t('{town}日常').replace('{town}', t(this.world?.townName || '邊境鎮'))}</span>
                <button class="headlines-more" data-action="goto-tab" data-val="records">${t('更多')} ›</button></div>
            ${html ? `<div style="padding:5px 8px 2px;font-size:0.66rem;color:var(--text-secondary);font-weight:bold">🔥 ${t('本集看點')}</div>${html}` : ''}
            ${slHtml}${tsHtml}
        </div>`;
    },

    // v5.48.0 進行中的劇情線:戀愛/婚姻/絕交/三角/和解調停,點了直接開兩人的故事時間軸
    _computeStorylines() {
        const w = this.world;
        if (!w) return [];
        const out = [];
        const seen = new Set();
        const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
        const days = (since) => Math.max(1, Math.floor((w.tickCount - (since || 0)) / 96));
        for (const a of npcs) {
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                const b = w.agents[tid];
                if (!b || b.isPlayer || b.isDead) continue;
                const key = [a.agentId, tid].sort().join('|');
                if (seen.has(key)) continue;
                if (rel.status === 'married') { seen.add(key); out.push({ icon: '💍', text: `${t(a.name)} × ${t(b.name)} — ${t('婚姻第')}${days(rel.statusSince)}${t('天')}`, val: key }); }
                else if (rel.status === 'dating') { seen.add(key); out.push({ icon: '💗', text: `${t(a.name)} × ${t(b.name)} — ${t('戀愛第')}${days(rel.statusSince)}${t('天')}`, val: key }); }
                else if (rel.isFeud) {
                    seen.add(key);
                    const med = w.mediations?.[key]?.sides;
                    const medN = med ? Object.keys(med).length : 0;
                    out.push({ icon: '💢', text: `${t(a.name)} × ${t(b.name)} — ${t('絕交中')}${medN ? `${t('（')}${t('你調停到')} ${medN}/2${t('）')}` : ''}`, val: key });
                }
            }
        }
        // 三角關係:單戀名花有主的人
        for (const c of npcs) {
            if (out.length >= 5) break;
            for (const r of c.relationships.getRomanticInterests()) {
                if (r.status) continue;
                const b = w.agents[r.targetId];
                if (!b || b.isDead) continue;
                const partner = b.relationships.getPartner?.();
                if (partner && r.romanticInterest > 40) {
                    const key = [c.agentId, r.targetId].sort().join('|');
                    if (seen.has(key)) continue;
                    seen.add(key);
                    out.push({ icon: '🔺', text: `${t(c.name)}${t('單戀名花有主的')}${t(b.name)}`, val: key });
                    break;
                }
            }
        }
        return out.slice(0, 5);
    },

    // v5.48.0 下集預告:接近門檻的關係伏筆
    _computeTeasers() {
        const w = this.world;
        if (!w) return [];
        const out = [];
        const seen = new Set();
        const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
        for (const a of npcs) {
            if (out.length >= 2) break;
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                const b = w.agents[tid];
                if (!b || b.isPlayer || b.isDead) continue;
                const key = [a.agentId, tid].sort().join('|');
                if (seen.has(key)) continue;
                if (!rel.isFeud && rel.affinity <= -48 && rel.affinity > -60) { seen.add(key); out.push({ icon: '⚡', text: `${t(a.name)}${t('和')}${t(b.name)}${t('的關係瀕臨絕交…')}` }); break; }
                if (!rel.status && rel.romanticInterest >= 35 && rel.romanticInterest < 50) { seen.add(key); out.push({ icon: '💘', text: `${t(a.name)}${t('對')}${t(b.name)}${t('的心意,快藏不住了…')}` }); break; }
            }
        }
        return out.slice(0, 2);
    },

    // v5.17.0 今日頭條:把最新一期日報的重點事件做成可點的情境入口,擺在首頁最上方
    _renderTownHeadlines() {
        const papers = this.state?.dailyNews?.newspapers || [];
        if (!papers.length) return '';
        const latest = papers[papers.length - 1];
        const evs = (latest.events || []).slice(0, 4);
        if (!evs.length) return '';
        const rows = evs.map((e, i) => `
            <button class="headline-row" data-action="news-goto" data-val="${latest.id}:${i}">
                <span class="headline-ic">${this._newsCatIcon(e.category)}</span>
                <span class="headline-text">${this._escapeHtml(e.content)}</span>
                <span class="headline-go">›</span>
            </button>`).join('');
        return `<div class="town-headlines">
            <div class="headlines-title">
                <span>🗞️ ${t('今日頭條')} <span class="headlines-sub">${t('第 {y} 年{s}').split('{y}').join(latest.year).split('{s}').join(t(latest.season))} ${t('第 {d} 天').split('{d}').join(latest.day)}</span></span>
                <button class="headlines-more" data-action="goto-tab" data-val="events">${t('完整日報')} ›</button>
            </div>
            ${rows}
        </div>`;
    },
    // 點頭條 → 跳到相關情境:有關聯居民就開他的資訊卡(意圖+心情),否則依分類跳到對應分頁
    _newsGoto(val) {
        const [pid, idxStr] = String(val).split(':');
        const papers = this.state?.dailyNews?.newspapers || [];
        const paper = papers.find(p => String(p.id) === pid);
        const ev = paper?.events?.[parseInt(idxStr, 10)];
        if (!ev) return;
        for (const nm of (ev.agents || [])) {
            const found = Object.values(this.world?.agents || {}).find(a => !a.isPlayer && a.name === nm);
            if (found) { this._showNpcCard(found.agentId); return; }
        }
        let tab = null;
        const cat = ev.category;
        if (cat === 'building') tab = 'industry';
        else if (cat === 'politics' || cat === 'event' || cat === 'exploration') tab = 'events';
        else if (cat === 'drama' || cat === 'relationship' || cat === 'gossip') tab = 'relmap';
        if (tab) { this.activeTab = tab; this._updateTabHighlight?.(tab); this.state = this.world.getState(); this.renderSidebar(); }
    },

    renderResidentsList(container) {
        if (!this.state) return;
        let html = '';
        // Town info bar (moved from header)
        const clock = this.state.clock || {};
        const popCount = Object.keys(this.state.agents || {}).filter(id => id !== 'player').length; // v6.25.0
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? `${t('（')}+${travelCount}${t(' 外出）')}` : '';
        const townName = this._getCurrentTownName() || t('邊境鎮');
        const gen = this.world._legacyGeneration || 1;
        const genText = gen > 1 ? `${t(' <span style="font-size:10px;color:#f0c040;margin-left:4px">第')}${gen}${t('代</span>')}` : '';
        html += `<div class="town-info-bar">
            <span class="town-info-name">${t(townName)}${genText}</span>
            <span class="town-info-pop">👤 ${popCount}${travelText}</span>
            <span class="town-info-clock">${clock.time_str || ''}</span>
        </div>`;
        // v5.32.0 章節徽章:把繁榮度重新框成「章節進度」——這是玩家唯一需要在意的成長數字
        const curCh = this.currentChapter();
        const nextCh = this._chapterDefs().find(c => c.n === curCh.n + 1);
        const prosNow = this.state?.prosperity?.prosperity || 0;
        html += `<div class="town-identity" style="cursor:default">
            <span class="ti-badge">${curCh.icon} ${t('第')}${curCh.n}${t('章')}·${t(curCh.name)}</span>
            ${nextCh ? `<span class="ti-desc">${t('小鎮成長')} ${Math.min(prosNow, nextCh.need)}/${nextCh.need} → ${nextCh.icon}${t(nextCh.name)}</span>` : `<span class="ti-desc">${t('小鎮已完全成熟')}</span>`}
        </div>`;
        // v5.19.0 城鎮身分:小鎮長成的路線,點一下看它是怎麼形成的
        const ident = this.state.townIdentity;
        if (ident && ident.route) {
            html += `<div class="town-identity" data-action="show-identity" title="${this._escapeHtml(ident.routeDesc || '')}">
                <span class="ti-badge">${ident.routeIcon} ${ident.routeName}</span>
                <span class="ti-desc">${this._escapeHtml(ident.routeDesc || '')}</span>
                <span class="ti-go">›</span>
            </div>`;
        }
        // v5.31.0 今日焦點:先回答「我現在該做什麼」,再看故事與頭條
        if (!this.world?.observerMode) html += this._renderDailyFocus(); // v6.25.0 觀察者沒有「該去找誰」
        // v5.45.0 昨日回響:你昨天的舉動在小鎮發酵了什麼(蝴蝶效應回饋)
        if (!this.world?.observerMode) html += this._renderDailyEcho();
        // v5.45.0 首頁分階段減壓:剛開村只看焦點+回響+居民;故事流(成長10)與頭條(成長20)隨小鎮成長逐步展開
        const prosHome = this.state?.prosperity?.prosperity || 0;
        // v5.31.0 今天的故事:記憶流/反思/名場面/AI 對話的精華,首頁第一層
        if (prosHome >= 10) html += this._renderStoryFeed();
        // v5.17.0 今日頭條:日報成為首頁第一眼看到的內容,點頭條直達當事人/相關分頁
        if (prosHome >= 20) html += this._renderTownHeadlines();
        // Player card at top
        const playerAgent = this.state.agents['player'];
        if (playerAgent && !this.world?.observerMode) { // v6.25.0 觀察者不列在居民裡
            const isSelected = this.selectedAgent === 'player';
            // v5.61.0 職業選擇系統已移除:玩家身分固定為「旅人」,當選鎮長時顯示鎮長頭銜
            const playerJobTitle = playerAgent.job?.title || t('旅人');
            html += `<div class="resident-card player-card ${isSelected?'selected':''}" data-action="select-agent" data-val="player">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${playerAgent.mood_description}"></span>⭐ ${t(playerAgent.name)}${t('（你）')}</span>
                    <span class="resident-job">${playerJobTitle}</span></div>
                <div class="resident-status"><span>@ ${this._locationLabel(playerAgent.current_location)}</span><span>${playerAgent.mood_label||playerAgent.mood_description} (${playerAgent.mood})</span></div>`;
            html += `</div>`;
        }
        for (const [aid, agent] of Object.entries(this.state.agents)) {
            if (aid === 'player') continue;
            const isSelected = this.selectedAgent === aid;
            const player = this.state.agents['player'];
            const sameLoc = !this.world?.observerMode && player && player.current_location === agent.current_location;
            const genderIcon = agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : '';
            html += `<div class="resident-card ${isSelected?'selected':''}" data-action="select-agent" data-val="${aid}">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${genderIcon} ${t(agent.name)}${sameLoc?t('<span class="nearby-badge">附近</span>'):''}</span>
                    <span class="resident-job">${agent.job?.title||t('無業')}</span></div>
                <div class="resident-status"><span>${agent.activity_label||agent.activity} @ ${this._locationLabel(agent.current_location)}</span><span>${agent.mood_label||agent.mood_description} (${agent.mood})</span></div>
                ${agent.current_thought?`<div style="font-size:0.7rem;color:#aaa;margin-top:4px;font-style:italic">${t('「')}${agent.current_thought}${t('」')}</div>`:''}
                <button class="chat-with-btn" data-action="start-chat" data-val="${aid}">${(sameLoc || this.world?.observerMode)?t('對話'):t('前往對話')}</button></div>`;
        }

        // Custom NPC creation button
        if (this.world.customNPC) {
            const remaining = this.world.customNPC.getRemainingSlots();
            const canCreate = this.world.customNPC.canCreate(this.world);
            const cost = this.world.customNPC.costFor ? this.world.customNPC.costFor(this.world) : this.world.customNPC.creationCost; const obs = !!this.world.observerMode;
            html += `<div style="margin-top:12px;padding:10px;border-top:1px solid rgba(255,255,255,0.1)">`;
            if (remaining > 0) {
                html += `<button class="btn-accent" data-action="show-custom-npc" style="width:100%;padding:8px;font-size:0.85rem"${!canCreate ? ' disabled style="opacity:0.5;width:100%;padding:8px;font-size:0.85rem"' : ''}>`;
                html += obs ? `${t('🧳 迎來一位新居民（剩 {n} 位）').replace('{n}', remaining)}` : `${t('👤 創建新居民 (剩餘 ')}${remaining}${t(' 位)')}`;
                html += `</button>`;
                if (obs) html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;text-align:center">${t('上帝的安排：一位新面孔聽說了這座小鎮搬進來，不花鎮上的錢')}</div>`;
                else html += `${t('<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;text-align:center">需要 ')}${cost.silver}${t(' 銀幣 + ')}${cost.food}${t(' 食物</div>')}`;
            } else {
                html += `${t('<div style="font-size:0.8rem;color:var(--text-muted);text-align:center">已達自訂居民上限 (')}${this.world.customNPC.maxCustomNPCs}/${this.world.customNPC.maxCustomNPCs})</div>`;
            }
            html += `</div>`;
        }

        container.innerHTML = html;
    },

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
        if (this.world?.observerMode) { if (this.selectedAgent !== 'player') interactionBtns += `<button class="chat-with-btn" data-action="start-chat" data-val="${this.selectedAgent}${t('">對話</button>')}`; } // v6.25.0 觀察者只有聊天
        else if (sameLoc) {
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
            loveStatus += `${t(' <span style="color:var(--negative)">（同時與')}${cheating.map(c=>c.target_name).join(t('、'))}${t('有秘密關係）</span>')}`;
        }
        if (crushes.length && !partner) {
            loveStatus += `${t('，暗戀')}${crushes.map(c=>`<b>${c.target_name}</b>`).join(t('、'))}`;
        }
        if (exes.length) {
            loveStatus += `${t('（前任：')}${exes.map(e=>e.target_name).join(t('、'))}${t('）')}`;
        }

        // Sort relationships: partners first, then by affinity
        const sortedRels = [...relationships].filter(r => !(this.world?.observerMode && r.target_id === 'player')).sort((a, b) => { // v6.83.0 觀察者不在鎮上的人際關係裡
            const statusOrder = { married: 0, dating: 1, ex: 2 };
            const sa = statusOrder[a.status] ?? 99;
            const sb = statusOrder[b.status] ?? 99;
            if (sa !== sb) return sa - sb;
            if (a.is_cheating !== b.is_cheating) return a.is_cheating ? -1 : 1;
            return b.affinity - a.affinity;
        });

        // v5.30.0 人物狀態頁(generative_agents 式):生活作息/近況/今日目標/今日足跡
        let personaHtml = '';
        const liveAgent = this.world?.agents?.[this.selectedAgent];
        if (liveAgent && !liveAgent.isPlayer && liveAgent.generateDailyPlan) {
            try {
                const plan = liveAgent.generateDailyPlan(this.world);
                const status = liveAgent.getPersonaStatus(this.world);
                const lifestyle = liveAgent.getLifestyleText();
                const timeline = liveAgent.getTodayTimeline(this.world, 12);
                const timeOf = (s) => (String(s).match(/(\d{2}:\d{2})\s*$/) || [])[1] || '';
                const nowLine = `<div class="memory-item"><span class="memory-time">${t('現在')}</span>${liveAgent.activityLabel} @ ${this._locationLabel(liveAgent.currentLocation)}</div>`;
                personaHtml = `
            <div class="detail-section"><h3>🧠 ${t('內心狀態')}</h3>
                <div style="font-size:0.75rem;margin-bottom:6px"><span style="color:var(--text-secondary)">${t('生活作息：')}</span>${lifestyle}</div>
                <div style="font-size:0.75rem"><span style="color:var(--text-secondary)">${t('近況：')}</span>${status}</div></div>
            <div class="detail-section"><h3>📅 ${t('今日目標')}</h3>
                <ol style="font-size:0.75rem;padding-left:18px;margin:2px 0;line-height:1.6">${plan.blocks?.length
                    ? plan.blocks.map(b => `<li>${this._escapeHtml(b.time)} ${this._escapeHtml(b.text)}${(b.steps || []).length ? `<div style="font-size:0.68rem;color:var(--text-secondary);line-height:1.5">${b.steps.map(s => `· ${this._escapeHtml(s)}`).join('　')}</div>` : ''}</li>`).join('')
                    : Agent.planGoalTexts(plan).map(g => `<li>${g}</li>`).join('')}</ol>
                ${plan.llm ? `<div style="font-size:0.62rem;color:var(--text-muted)">🤖 ${t('由 AI 依他的性格與昨日經歷生成')}${plan.replanned ? `　📝 ${t('已因今天的際遇臨時調整')}` : ''}</div>` : ''}</div>
            <div class="detail-section"><h3>🕐 ${t('今日足跡')}</h3>
                ${nowLine}${(() => {
                    // v5.40.0 密集時間軸(generative_agents 式):行動軌跡(含時長)+今日記憶合併,新的在上
                    const fmtM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                    const rows = [];
                    const trace = liveAgent.todayTrace || [];
                    trace.forEach((e, i) => {
                        const dur = i < trace.length - 1 ? trace[i + 1].m - e.m : null;
                        rows.push({ m: e.m, html: `${this._escapeHtml(e.text)}${dur > 0 ? ` <span style="color:var(--text-muted)">${t('（')}${dur} ${t('分鐘）')}</span>` : ''}` });
                    });
                    timeline.forEach(mm => {
                        const tm = timeOf(mm.timeStr);
                        const pm = tm ? parseInt(tm.slice(0, 2), 10) * 60 + parseInt(tm.slice(3, 5), 10) : 0;
                        const ic = mm.category === 'conversation' ? '💬' : mm.category === 'observation' ? '👀' : mm.category === 'reflection' ? '💭' : mm.category === 'whisper' ? '🤫' : '✨';
                        rows.push({ m: pm, mem: true, html: `${ic} ${this._escapeHtml(mm.content)}` });
                    });
                    rows.sort((a, b) => b.m - a.m || (a.mem === b.mem ? 0 : a.mem ? -1 : 1));
                    if (!rows.length) return `<p style="font-size:0.7rem;color:var(--text-muted)">${t('今天還沒發生什麼事')}</p>`;
                    return rows.slice(0, 40).map(r => `<div class="memory-item"><span class="memory-time">${fmtM(r.m)}</span>${r.html}</div>`).join('');
                })()}</div>`;
            } catch (e) { console.warn('[RimTown] persona state render failed:', e); }
        }
        container.innerHTML = `<div class="detail-panel visible">
            <div class="detail-section"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${this._agentAvatarImg(this.selectedAgent, agent)}<h3 style="margin:0;flex:1">${t(agent.name)}（${agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : ''}${agent.gender_label} · ${agent.age}${t('歲）')}</h3></div>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||(this.selectedAgent==='player'?t('旅人'):t('無業'))} | ${agent.mood_label||agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${t(personality.background||'')}</p>${chatBtn}</div>
            <div class="detail-section"><h3>${t('性格')}</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${TRAIT_LABELS[t]||t}</span>`).join('')}${(() => { const st = this.world?.agents?.[this.selectedAgent]?.techStance; return st === 'progressive' ? `<span class="trait-tag" title="${t('接受的新觀念比反對的多')}">🚀 ${t('革新派')}</span>` : st === 'conservative' ? `<span class="trait-tag" title="${t('對新技術存疑')}">🏺 ${t('保守派')}</span>` : ''; })()}
                <div style="margin-top:4px;font-size:0.7rem;color:var(--text-secondary)">${t('價值觀：')}${(personality.values||[]).map(v => t(v)).join(I18N.getLang() === 'en' ? ', ' : '、')}</div>
                ${agent.attributes && Object.keys(agent.attributes).length ? `<div class="nqc-attr" style="margin-top:6px">${[['charm','✨',t('魅力')],['vigor','💪',t('體魄')],['wit','🧠',t('智慧')],['grit','🔥',t('膽識')]].map(([k,ic,lb]) => { const v = Math.max(1, Math.min(10, agent.attributes[k] || 5)); return `<div class="nqc-attr-cell"><span class="nqc-attr-lb">${ic}${lb}</span><span class="nqc-attr-bar"><span class="nqc-attr-fill" style="width:${v*10}%"></span></span><span class="nqc-attr-val">${v}</span></div>`; }).join('')}</div>` : ''}</div>
            ${personaHtml}
            <div class="detail-section"><h3>${t('感情狀態')}</h3>
                <p style="font-size:0.8rem">${loveStatus}</p></div>
            ${this.selectedAgent === 'player'
                ? `<div class="detail-section"><h3>${t('需求')}</h3>${makeBar(t('飢餓'),needs.hunger||0)}${makeBar(t('休息'),needs.rest||0)}${makeBar(t('社交'),needs.social||0)}${makeBar(t('舒適'),needs.comfort||0)}${makeBar(t('娛樂'),needs.recreation||0)}</div>`
                : `<div class="detail-section"><h3>${t('狀態')}</h3><p style="font-size:0.78rem">${(() => {
                    // v5.32.0 數值文字化:NPC 需求改為一句話,玩家自己才看數值條
                    const bits = [];
                    if ((needs.hunger||0) < 30) bits.push(t('肚子很餓'));
                    if ((needs.rest||0) < 30) bits.push(t('很疲倦'));
                    if ((needs.social||0) < 30) bits.push(t('渴望有人陪'));
                    if ((needs.recreation||0) < 25) bits.push(t('悶得發慌'));
                    return bits.length ? bits.join(t('、')) + t('。') : t('過得還不錯,沒什麼匱乏。');
                })()}</p></div>`}
            <div class="detail-section"><h3>${t('技能（總計：')}${agent.skills?.total_level||0}）</h3>${this._renderSkills(agent.skills)}</div>
            <div class="detail-section"><h3>${t('人際關係（')}${sortedRels.length}）</h3>
                ${(() => { try { const wa = this.world?.agents?.[this.selectedAgent]; if (typeof SOCIAL === 'undefined' || !wa || wa.isPlayer) return ''; const v = SOCIAL.view(this.world, wa); return `<p class="social-circles">${t('家人')} ${v.family}${t('・')}${t('內圈')} ${v.inner}${t('・')}${t('好友')} ${v.good}${t('・')}${t('朋友')} ${v.friends}${t('・')}${t('點頭之交')} ${v.acquaint}</p>`; } catch (e) { return ''; } })()}
                ${sortedRels.length===0?t('<p style="font-size:0.7rem;color:var(--text-muted)">尚無人際關係</p>'):
                sortedRels.map(r=>{
                    let badge = '';
                    if (r.status === 'married') badge = t('<span class="rel-status-badge rel-married">💍 已婚</span>');
                    else if (r.status === 'dating') badge = t('<span class="rel-status-badge rel-dating">💕 交往中</span>');
                    else if (r.status === 'ex') badge = t('<span class="rel-status-badge rel-ex">💔 前任</span>');
                    if (r.is_cheating) badge += t(' <span class="rel-status-badge rel-cheating">🤫 秘密關係</span>');
                    // v5.32.0 數值文字化:關係類型本身就是好感區間的語意(朋友/摯友/對手…),不再曝露原始數字
                    const romHeart = r.romantic_interest > 30 ? ' <span style="color:#f472b6">&#10084;</span>' : '';
                    const crushIcon = r.romantic_interest > 30 && !r.status ? t(' <span style="color:#f472b6;font-size:0.75rem">暗戀</span>') : '';
                    let circ = ''; try { const wa = this.world?.agents?.[this.selectedAgent]; if (typeof SOCIAL !== 'undefined' && wa && !wa.isPlayer) { const k = SOCIAL.circleOf(this.world, wa, r.target_id); if (k !== null) circ = ` <span class="rel-circle rel-circle-${k}">${SOCIAL.circleName(k)}</span>`; } } catch (e) {} // v6.88.0 圈層
                    return `<div class="relationship-item${r.status?' rel-has-status':''}"><span>${r.target_name} ${badge}${crushIcon}${circ}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type}${romHeart}</span></div>`;
                }).join('')}</div>
            ${this._renderAgentFactions(this.selectedAgent)}
            ${(() => { try { const wa = this.world?.agents?.[this.selectedAgent]; if (!wa || wa.isPlayer) return ''; const s = [typeof MARKET !== 'undefined' && this.world?.market ? MARKET.describe(this.world, wa) : '', typeof ESTATE !== 'undefined' && this.world?.estate ? ESTATE.describe(this.world, wa) : '', typeof UNION !== 'undefined' && this.world?.union?.on ? UNION.describe(this.world, wa) : ''].filter(Boolean).join(t('；')); return s ? `<div class="detail-section market-detail"><h3>🏭 ${t('生計')}</h3><p>${this._escapeHtml ? this._escapeHtml(s) : s}</p></div>` : ''; } catch (e) { return ''; } })()}
            ${this._renderBody(this.selectedAgent)}
            ${this._renderCareer(this.selectedAgent)}
            <div class="detail-section"><h3>${t('近期記憶')}</h3>
                ${memories.length===0?t('<p style="font-size:0.7rem;color:var(--text-muted)">尚無記憶</p>'):
                memories.slice(-10).reverse().map(m=>`<div class="memory-item"><span class="memory-time">${m.time}</span>${m.content}</div>`).join('')}</div></div>`;
    },

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
        html += `<div class="detail-section"><h3>${t('住戶')}${t('（')}${residents.length}${t('）')}</h3>`;
        if (residents.length === 0) {
            html += `<p style="font-size:0.8rem;color:var(--text-secondary)">${t('這間房子目前沒有住戶。')}</p>`;
        } else {
            html += `<div class="resident-list">`;
            for (const aid of residents) {
                const agent = this.state?.agents[aid];
                if (!agent) continue;
                const jobTitle = agent.job?.title || (aid === 'player' ? t('旅人') : t('無業'));
                const moodIcon = agent.mood > 70 ? '😊' : agent.mood > 30 ? '😐' : '😢';
                html += `<div class="res-item" data-action="select-agent" data-val="${aid}" style="cursor:pointer;padding:8px;margin:4px 0;border-radius:6px;background:var(--bg-secondary)">
                    <div style="font-weight:600">${moodIcon} ${t(agent.name)}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary)">${jobTitle} · ${agent.age}${t('歲')} · ${agent.activity_label || agent.activity || ''}</div>
                </div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;
        container.innerHTML = html;
    },

    // =====================================================
    // SETTINGS TAB (consolidated AI + Account + Game settings)
    // =====================================================
    // v6.26.0 提案分頁:待決定／擱置中／進行中／已定案
    // v7.3.0 鎮況的各區塊拆開,提案／小鎮／日報各取所需(同一份資料只在一個地方出現)
    _townBlocks(d, want) {
        const W = (k) => !want || want.includes(k);
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        d = d || this.state?.proposals || { issues: [], traditions: [], landmarks: [], stats: { made: 0, approved: 0, rejected: 0, done: 0 } };
        const B = { tier: '', legacy: '', dream: '', culture: '', politics: '', mind: '', civic: '', goods: '', biz: '', bank: '', press: '', diplo: '', tidings: '', faith: '', issues: '', cliques: '', lore: '', stats: '' };
        if (!this.world) return B;
        if (W('tier')) {
            // v6.56.0 城鎮等級與升格進度
            try {
                if (this.world && typeof TIERS !== 'undefined') {
                    const I = TIERS.info(this.world), pg = TIERS.progress(this.world); const L = TIERS.LV;
                    const bar = (v, m) => `<span class="pp-tier-req${v >= m ? ' ok' : ''}">${v}/${m}</span>`;
                    B.tier += `<div class="pp-issues pp-tier"><h4 class="pp-h">${I.icon} ${esc(TIERS.name(this.world))} <span class="pp-tier-steps">${L.map((x, i) => `<i class="${i <= TIERS.level(this.world) ? 'on' : ''}" title="${esc(t(x.zh))}">${x.icon}</i>`).join('')}</span></h4>`;
                    B.tier += `<div class="pp-tier-line">${t('首長')}${t('：')}${esc(TIERS.leaderTitle(this.world))} · ${t('議會')}${t('：')}${esc(t(I.council))} ${TIERS.seats(this.world)} ${t('席')}</div>`;
                    { // v6.81.0 寫出現任議員(點名字開村民卡);沒坐滿就寫還空幾席
                        const ms = (this.world.council?.members || []).map(id => this.world.agents[id]).filter(Boolean);
                        const btn = (a) => `<button type="button" class="pp-mayor-name" data-action="select-agent" data-val="${esc(a.agentId)}">${esc(t(a.name))}</button>`;
                        const empty = Math.max(0, TIERS.seats(this.world) - ms.length);
                        B.tier += `<div class="pp-tier-line">🏛️ ${esc(t(I.member))}${t('：')}${ms.length ? ms.map(btn).join(t('、')) : t('還沒成立')}${ms.length && empty ? `${t('（')}${t('空 {n} 席').replace('{n}', empty)}${t('）')}` : ''}</div>`;
                    }
                    { // v6.78.1 現任首長是誰(人不在鎮上時寫出代理人);點名字開村民卡
                        const E = this.world.election, title = esc(TIERS.leaderTitle(this.world));
                        const holder = E?._officeHolder?.(this.world), acting = E?.acting && this.world.agents[E.acting.agentId], cur = E?.currentMayor?.(this.world);
                        const who = (a) => `<button type="button" class="pp-mayor-name" data-action="select-agent" data-val="${esc(a.agentId)}">${esc(t(a.name))}</button>`;
                        let line;
                        if (holder && cur === holder) line = who(holder);
                        else if (holder && acting && cur === acting) line = `${who(holder)}${t('（')}${E.acting.reason === 'explore' ? t('出去探險') : t('出遠門')}${t('，')}${who(acting)}${t('代理')}${t('）')}`;
                        else if (!holder && acting && cur === acting) line = `${t('從缺')}${t('（')}${who(acting)}${t('代理')}${t('）')}`;
                        else line = t('從缺');
                        B.tier += `<div class="pp-tier-line">👤 ${t('現任{title}').split('{title}').join(title)}${t('：')}${line}</div>`;
                    }
                    if (pg) B.tier += `<div class="pp-tier-line">${t('升格為{n}還差').replace('{n}', `${pg.next.icon} ${esc(t(pg.next.zh))}`)}${t('：')}${t('人口')} ${bar(pg.pop[0], pg.pop[1])} · ${t('繁榮')} ${bar(pg.pros[0], pg.pros[1])} · ${t('時代')} ${bar(pg.era[0], pg.era[1])}${pg.streak ? ` · ${t('已連續達標 {n}／{m} 天').replace('{n}', pg.streak).replace('{m}', pg.need)}` : ''}</div>`;
                    if (pg && pg.mat) { const lk = pg.matLack || {}; B.tier += `<div class="pp-tier-line">🏗️ ${t('擴建鎮公所要用')}${t('：')}${Object.entries(pg.mat).map(([r, n]) => `<span class="pp-tier-req${lk[r] ? '' : ' ok'}">${esc(this._resName ? this._resName(r) : r)} ${n}</span>`).join(' ')}${Object.keys(lk).length ? '' : ` · ${t('建材已備齊')}`}</div>`; } // v6.77.0
                    else B.tier += `<div class="pp-tier-line">${t('已經是最高等級。')}</div>`;
                    try { if (typeof CLASS !== 'undefined' && this.world.classes) { const py = CLASS.pyramid(this.world); B.tier += `<div class="pp-tier-line">${t('社會階層')}${t('：')}${CLASS.NAMES.map((n, i) => py[i] ? `${n.icon} ${esc(t(n.zh))} ${py[i]}` : '').filter(Boolean).join(' · ')}</div>`; } } catch (e) {} // v6.58.0
                    try { const V = typeof CROWN !== 'undefined' ? CROWN.view(this.world) : null; if (V && (V.king || V.crisis || V.republic)) { // v6.59.0 王室
                        const DN = (k) => { const D = CROWN.DECREES[k]; return D ? `${D.icon} ${esc(t(D.zh))}` : ''; };
                        B.tier += `<div class="pp-crown">`;
                        if (V.republic) B.tier += `<div class="pp-tier-line">🏳️ ${t('王都已推翻王室，改為共和')}</div>`;
                        else if (V.king) B.tier += `<div class="pp-tier-line">👑 ${t('國王')}${t('：')}<b>${esc(V.king)}</b> · ${esc(V.dynasty)} · ${t('民心')} <span class="pp-legit${V.legit < 35 ? ' low' : ''}">${V.legit}/100</span></div>`;
                        if (V.crisis) B.tier += `<div class="pp-tier-line">⚔️ ${t('王位空懸，繼承危機中')}${t('：')}${esc(V.crisis.join(t('、')))}</div>`;
                        if (V.decrees.length) B.tier += `<div class="pp-tier-line">📜 ${t('最近的王令')}${t('：')}${V.decrees.map(x => `${DN(x.key)}${x.text ? ' ' + t('「') + esc(x.text) + t('」') : ''}`).join(' · ')}</div>`;
                        B.tier += `</div>`; } } catch (e) {}
                    B.tier += `<div class="pp-issue-hint">${t('城鎮以上，要當過下一級的首長，或在本級議會當過一季議員，才能參選首長。')}</div></div>`;
                }
            } catch (e) {}
        }
        if (W('legacy')) {
            // v6.73.0 鎮史:史書、傳說、家族、世仇
            try { if (typeof LEGACY !== 'undefined' && this.world.legacy) { const V = LEGACY.view(this.world); if (V.chapters.length || V.legends.length || V.families.length) {
                B.legacy += `<div class="pp-issues pp-legacy"><h4 class="pp-h">📚 ${t('鎮史')}</h4>`;
                for (const c of V.chapters) B.legacy += `<details class="pp-chap"><summary>📖 ${esc(c.title)} <small>${t('史官')} ${esc(c.by)}</small></summary><div class="pp-tier-line">${esc(c.text)}</div></details>`;
                if (V.legends.length) B.legacy += `<div class="pp-tier-line">🏛️ ${t('傳說人物')}${t('：')}${V.legends.map(l => `${esc(l.name)}${t('（')}${esc(l.role)}${t('）')}${l.statue ? ' 🗽' : ''}`).join(t('、'))}</div>`;
                if (V.families.length) B.legacy += `<div class="pp-tier-line">🏠 ${t('家族')}${t('：')}${V.families.map(f => `${esc(f.name)} ×${f.n} ${t('「')}${esc(f.motto)}${t('」')}`).join(' · ')}</div>`;
                if (V.feuds.length) B.legacy += `<div class="pp-tier-line">⚔️ ${t('世仇')}${t('：')}${V.feuds.map(esc).join(' · ')}</div>`;
                B.legacy += `</div>`; } } } catch (e) {}
        }
        if (W('dream')) {
            // v6.72.0 託夢與預言
            try { if (typeof DREAM !== 'undefined' && this.world.dream !== undefined) { const V = DREAM.view(this.world); const E = this.world.election; const plot = this.world.crown?.plot;
                const canE = E?.active && (E.candidates || []).length >= 2, canC = !!plot;
                if (V.dreams.length || canE || canC || V.acc.hits + V.acc.misses) {
                    B.dream += `<div class="pp-issues pp-dream"><h4 class="pp-h">🔮 ${t('託夢與預言')}${V.acc.pct !== null ? ` <small>${t('準確率')} ${V.acc.pct}%${t('（')}${V.acc.hits}/${V.acc.hits + V.acc.misses}${t('）')}</small>` : ''}</h4>`;
                    for (const d2 of V.dreams) B.dream += `<div class="pp-tier-line">🌙 ${esc(d2.to)}${t('：')}${t('「')}${esc(d2.text)}${t('」')}${d2.meaning ? ` → ${esc(d2.meaning)}` : ''}${d2.wrong ? ` <small>${t('（誤解了）')}</small>` : ''}</div>`;
                    const open = V.acc.open;
                    if (canE && !open.some(b => b.kind === 'election')) B.dream += `<div class="pp-tier-line">${t('押注誰會當選')}${t('：')}${E.candidates.map(c => `<button class="pp-more" data-action="dream-bet" data-val="election|${c.agentId}">${esc(t(c.name))}</button>`).join(' ')}</div>`;
                    if (canC && !open.some(b => b.kind === 'coup')) B.dream += `<div class="pp-tier-line">${t('政變會成功嗎')}${t('：')}<button class="pp-more" data-action="dream-bet" data-val="coup|success">${t('會')}</button> <button class="pp-more" data-action="dream-bet" data-val="coup|fail">${t('不會')}</button></div>`;
                    for (const b of open) B.dream += `<div class="pp-issue-hint">${t('已押注')}${t('：')}${b.kind === 'election' ? esc(t(this.world.agents[b.pick]?.name || '')) : t(b.pick === 'success' ? '政變成功' : '政變失敗')}</div>`;
                    B.dream += `</div>`; } } } catch (e) {}
        }
        if (W('culture')) {
            // v6.71.0 文化
            try { if (typeof CULTURE !== 'undefined' && this.world.culture) { const V = CULTURE.view(this.world); if (V.works.length || V.songs.length || V.oracles.length) {
                B.culture += `<div class="pp-issues pp-culture"><h4 class="pp-h">🎭 ${t('文化')}</h4>`;
                for (const x of V.works) B.culture += `<div class="pp-tier-line">${x.icon} ${t('〈')}${esc(x.title)}${t('〉')} <small>${esc(x.by)} · ${t('評價')} ${x.q}${x.legend ? ' · 🌟 ' + t('傳世傑作') : ''}</small></div>`;
                for (const x of V.songs) B.culture += `<div class="pp-tier-line">🎶 ${t('〈')}${esc(x.title)}${t('〉')} <small>${esc(x.by)}${x.lyric ? ' · ' + t('「') + esc(x.lyric) + t('」') : ''}</small></div>`;
                for (const x of V.oracles) B.culture += `<div class="pp-tier-line">🔮 ${esc(x.by)}${t('：')}${t('「')}${esc(x.text)}${t('」')}</div>`;
                B.culture += `</div>`; } } } catch (e) {}
        }
        if (W('politics')) {
            // v6.69.0 政壇:辯論、議會人情、法庭
            try { if (typeof POLITICS !== 'undefined' && this.world.politics) { const V = POLITICS.view(this.world); if (V.debates.length || V.trials.length || V.pacts || V.betrayals) {
                B.politics += `<div class="pp-issues pp-politics"><h4 class="pp-h">🏛️ ${t('政壇')}</h4>`;
                for (const d of V.debates) { B.politics += `<div class="pp-tier-line">🎤 ${t('最近的辯論')}${t('：')}${t('{a}表現最好').replace('{a}', esc(d.winner))}</div>`; for (const l of d.lines) B.politics += `<div class="pp-tid-item">${esc(l)}</div>`; }
                if (V.pacts || V.betrayals) B.politics += `<div class="pp-tier-line">🤝 ${t('議會私下的人情')} ${V.pacts} · 🔄 ${t('倒戈')} ${V.betrayals}</div>`;
                for (const x of V.trials) B.politics += `<div class="pp-tier-line">⚖️ ${t('控方')} ${esc(x.pro)} · ${t('辯方')} ${esc(x.def)} · ${t('法官')} ${esc(x.judge)}</div>`;
                if (V.appeals) B.politics += `<div class="pp-tier-line">🔍 ${t('翻案')} ${V.appeals}</div>`;
                B.politics += `</div>`; } } } catch (e) {}
        }
        if (W('mind')) {
            // v6.68.0 民意
            try { if (typeof MIND !== 'undefined' && this.world.mind) { const V = MIND.poll(this.world);
                B.mind += `<div class="pp-issues pp-mind"><h4 class="pp-h">🗣️ ${t('民意')}</h4>`;
                for (const x of V) { const pct = Math.round((x.avg + 2) / 4 * 100); B.mind += `<div class="pp-op-row"><span>${esc(x.name)}</span><span class="pp-op-bar"><i style="left:${pct}%"></i></span><small>${t('支持')} ${x.pro} · ${t('反對')} ${x.con}</small></div>`; }
                B.mind += `</div>`; } } catch (e) {}
        }
        if (W('civic')) {
            // v6.67.0 治安與民生
            try { if (typeof CIVIC !== 'undefined' && this.world.civic) { const V = CIVIC.view(this.world);
                B.civic += `<div class="pp-issues pp-civic"><h4 class="pp-h">👮 ${t('治安與民生')}${V.slum ? ` <small>🏚️ ${t('貧民區')}</small>` : ''}</h4>`;
                B.civic += `<div class="pp-tier-line">${t('衛兵')} ${V.guards} · ${t('竊案')} ${V.thefts}${t('（')}${t('破案')} ${V.caught}${t('）')}${V.jailed.length ? ` · ⛓️ ${V.jailed.map(esc).join(t('、'))}` : ''}</div>`;
                B.civic += `<div class="pp-tier-line">${t('稅率')} ${V.tax}% · ${t('地價')} ${V.land} · ${t('上週房租')} ${V.rent}</div></div>`; } } catch (e) {}
        }
        if (W('goods')) {
            // v6.65.0 珍品
            try { if (typeof GOODS !== 'undefined' && this.world.goods) { const V = GOODS.view(this.world); if (V.town.length || V.offers.length || V.collectors.length) {
                B.goods += `<div class="pp-issues pp-goods"><h4 class="pp-h">🏺 ${t('珍品')}</h4>`;
                if (V.town.length) B.goods += `<div class="pp-tier-line">${t('公庫收藏')}${t('：')}${V.town.map(x => `${x.icon} ${esc(x.name)} <small>${esc(x.from)}</small>`).join(' · ')}</div>`;
                if (V.offers.length) B.goods += `<div class="pp-tier-line">${t('商人帶來的珍品')}${t('：')}${V.offers.map(x => `${x.icon} ${esc(x.name)} ${x.price} <small>${esc(x.from)}</small>`).join(' · ')}</div>`;
                if (V.collectors.length) B.goods += `<div class="pp-tier-line">${t('收藏家')}${t('：')}${V.collectors.map(x => `${esc(x.name)} ×${x.n}`).join(' · ')}</div>`;
                B.goods += `</div>`; } } } catch (e) {}
        }
        if (W('biz')) {
            // v6.70.0 商店
            try { if (typeof BIZ !== 'undefined' && this.world.biz) { const V = BIZ.view(this.world); if (V.shops.length || V.closed.length) {
                B.biz += `<div class="pp-issues pp-biz"><h4 class="pp-h">🏪 ${t('鎮上的店')} <span class="pp-count">${V.shops.length}</span></h4>`;
                for (const s2 of V.shops) B.biz += `<div class="pp-tier-line">${s2.icon} <b>${esc(s2.name)}</b> <small>${esc(s2.type)} · ${t('老闆')}${t('：')}${esc(s2.owner)}${s2.partner ? ' · ' + t('合夥人') + t('：') + esc(s2.partner) : ''} · ${t('定價')} ${s2.price} · ${t('累計盈虧')} ${s2.profit}</small></div>`;
                if (V.closed.length) B.biz += `<div class="pp-issue-hint">${t('倒閉的店')}${t('：')}${V.closed.map(c => esc(c.name)).join(t('、'))}</div>`;
                B.biz += `</div>`; } } } catch (e) {}
        }
        if (W('bank')) {
            // v6.64.0 銀行
            try { if (typeof BANK !== 'undefined' && this.world.bank) { const V = BANK.view(this.world);
                const st = V.status === 'run' ? `😱 ${t('擠兌中')}` : V.status === 'failed' ? `💥 ${t('已倒閉')}` : V.open ? `✅ ${t('營業中')}` : t('還沒開');
                B.bank += `<div class="pp-issues pp-bank"><h4 class="pp-h">🏦 ${t('銀行')} <small>${st}</small></h4>`;
                if (V.open) B.bank += `<div class="pp-tier-line">${t('銀行家')}${t('：')}${esc(V.banker || '')} · ${t('放款利率')} ${V.rate}%${V.why ? ` ${t('（')}${esc(V.why)}${t('）')}` : ''}</div><div class="pp-tier-line">${t('存款')} ${V.dep}${t('（')}${V.savers} ${t('人')}${t('）')} · ${t('放款')} ${V.loan}${t('（')}${V.borrowers} ${t('人')}${t('）')} · ${t('準備金')} ${V.reserve} · ${t('呆帳')} ${V.bad}</div>`;
                else if (V.failed) B.bank += `<div class="pp-tier-line">${t('上次倒閉讓存戶損失 {n} 銀幣').replace('{n}', V.failed.lost)}</div>`;
                else B.bank += `<div class="pp-issue-hint">${t('升格為城鎮後就會有銀行。')}</div>`;
                // v6.74.0 債券、紓困、鎮公所背債
                if (V.pending) B.bank += `<div class="pp-issue-hint">⏳ ${t('銀行暫停營業，等鎮長決定要不要紓困')}</div>`;
                if (V.bonds) B.bank += `<div class="pp-tier-line">📜 ${t('流通中的債券')} ${V.bonds} ${t('銀幣')}${t('（')}${V.bondHolders} ${t('人')} · ${t('利息')} ${V.bondRate}%${t('）')}${V.defaults ? ` · ${t('違約')} ${V.defaults}` : ''}</div>`;
                if (V.bail) B.bank += `<div class="pp-tier-line">${V.bail.yes ? '🛟' : '🚫'} ${esc((V.bail.yes ? t('{m}決定紓困（{n} 銀幣）') : t('{m}拒絕紓困')).replace('{m}', V.bail.by).replace('{n}', V.bail.n))}${V.bail.why ? ` <small>${t('「')}${esc(V.bail.why)}${t('」')}</small>` : ''}</div>`;
                if (V.debt) B.bank += `<div class="pp-tier-line">🏛️ ${t('鎮公所紓困債')} ${V.debt.owed} ${t('銀幣')}${t('（')}${t('已還')} ${V.debt.paid}${V.debt.late ? ` · ⚠️ ${t('逾期 {n} 天').replace('{n}', V.debt.late)}` : ''}${t('）')}</div>`;
                else if (V.debtDone) B.bank += `<div class="pp-issue-hint">🎉 ${t('紓困債已還清（共 {n} 銀幣）').replace('{n}', V.debtDone.paid)}</div>`;
                B.bank += `</div>`; } } catch (e) {}
        }
        if (W('press')) {
            // v6.63.0 報社
            try { if (typeof PRESS !== 'undefined' && this.world.press) { const V = PRESS.view(this.world);
                B.press += `<div class="pp-issues pp-press"><h4 class="pp-h">📰 ${t('報社')} <span class="pp-count">${V.length}</span></h4>`;
                for (const P of V) B.press += `<div class="pp-press-row${P.banned && !P.underground ? ' banned' : ''}"><b>${P.icon} ${esc(P.name)}</b> <small>${esc(P.stance)} · ${t('讀者')} ${P.readers} · ${t('可信度')} ${P.cred}${P.journo ? ' · ' + t('記者') + t('：') + esc(P.journo) : ''}${P.banned ? ' · ' + (P.underground ? t('地下報紙') : t('被查禁')) : ''}</small>${P.last ? `<div class="pp-tier-line">${t('「')}${esc(P.last)}${t('」')}</div>` : ''}</div>`;
                B.press += `</div>`; } } catch (e) {}
        }
        if (W('diplo')) {
            // v6.66.0 外交
            try { if (typeof DIPLO !== 'undefined' && this.world.diplo) { const V = DIPLO.view(this.world); if (V.places.length) {
                B.diplo += `<div class="pp-issues pp-diplo"><h4 class="pp-h">🤝 ${t('外交')}</h4><div class="pp-tid-places">`;
                for (const p of V.places) B.diplo += `<span class="pp-tid-place pp-dip${p.rel >= 40 ? ' good' : p.rel <= -30 ? ' bad' : ''}">${p.icon} ${esc(p.name)} <b>${p.rel > 0 ? '+' : ''}${p.rel}</b> <small>${esc(p.status)}${p.wed ? ' · 💍 ' + esc(p.wed) : ''}</small></span>`;
                B.diplo += `</div>`; for (const x of V.log) B.diplo += `<div class="pp-tid-item">${esc(x)}</div>`;
                if (V.why) B.diplo += `<div class="pp-issue-hint">${t('首長的想法')}${t('：')}${esc(V.why)}</div>`;
                B.diplo += `</div>`; } } } catch (e) {}
        }
        if (W('tidings')) {
            // v6.62.0 外地消息:遠方地點、上次消息幾天前、誰帶回來;最近的消息與可信度
            try { if (typeof TIDINGS !== 'undefined' && this.world.tidings) { const V = TIDINGS.view(this.world);
                B.tidings += `<div class="pp-issues pp-tidings"><h4 class="pp-h">📨 ${t('外地消息')} <span class="pp-count">${V.places.length}</span></h4>`;
                B.tidings += `<div class="pp-tid-places">${V.places.map(p => `<span class="pp-tid-place" title="${esc(p.lvName)}">${p.icon} ${esc(p.name)} <small>${p.last === null ? t('還沒有消息') : t('{n} 天前').replace('{n}', p.last)}${p.by ? ' · ' + esc(p.by) : ''}</small></span>`).join('')}</div>`;
                for (const x of V.items.filter((y, i, a) => a.findIndex(z => z.text === y.text) === i)) B.tidings += `<div class="pp-tid-item${x.rumor ? ' rumor' : ''}">${x.via} ${esc(x.text)} <small>${x.rumor ? t('傳聞') : t('可靠')} · ${t('路上走了 {n} 天').replace('{n}', x.lag)} · ${t('{n} 人知道').replace('{n}', x.knowers)}</small></div>`;
                if (!V.items.length) B.tidings += `<div class="pp-issue-hint">${t('遠方的消息要等商隊、旅人或信差帶進鎮。')}</div>`;
                B.tidings += `</div>`; } } catch (e) {}
        }
        if (W('faith')) {
            // v6.60.0 宗教一覽
            try { if (typeof FAITH !== 'undefined' && this.world.faith) { const V = FAITH.view(this.world); const nb = FAITH.nonBelievers(this.world);
                B.faith += `<div class="pp-issues pp-faith"><h4 class="pp-h">🛕 ${t('宗教')} <span class="pp-count">${V.length}</span></h4>`;
                for (const R of V) B.faith += `<div class="pp-faith-row" style="border-left-color:${R.color}"><b>${R.icon} ${esc(R.name)}</b> <small>${esc(R.sk)} · ${t('信徒')} ${R.n} · ${esc(R.place)}${R.head ? ' · ' + esc(R.head) : ''}${R.founder ? ' · ' + t('創立者') + t('：') + esc(R.founder) : ''}</small><div class="pp-tier-line">${t('主神')}${t('：')}${esc(R.deity)} · ${t('經典')}${t('：')}${esc(R.book)} · ${t('節日')}${t('：')}${esc(R.fest)}${t('（')}${esc(R.festWhen)}${t('）')}</div><div class="pp-tier-line">${t('戒律')}${t('：')}${R.pre.map(esc).join(t('；'))} · ${t('奉獻基金')} ${R.fund}${R.spent ? ` · ${t('維護、辦桌、濟貧共花')} ${R.spent}` : ''}</div></div>`;
                { const F = this.world.faith; B.faith += `<div class="pp-issue-hint">${t('沒有信仰的人')}${t('：')}${nb} · ${F.tax ? t('宗教捐獻抽 {n}% 稅').replace('{n}', Math.round((FAITH.TAX_RATE || 0.15) * 100)) + (F.taxPaid ? `${t('（')}${t('已繳')} ${Math.round(F.taxPaid)}${t('）')}` : '') : t('宗教免稅')}</div></div>`; } } } catch (e) {}
        }
        if (W('issues')) {
            // v6.50.0 鎮上急事:村民正受影響,拖著沒人管會抱怨、吵架、搬走
            if ((d.issues || []).length) {
                B.issues += `<div class="pp-issues"><h4 class="pp-h">⚠️ ${t('鎮上急事')} <span class="pp-count">${d.issues.length}</span></h4>`;
                for (const x of d.issues) B.issues += `<div class="pp-issue sev${x.sev}${x.by ? ' on' : ''}${!x.by && x.idle >= 3 ? ' late' : ''}">${x.sev >= 3 ? '🔴' : x.sev === 2 ? '🟠' : '🟡'} <span>${esc(x.text)}<small>${esc(x.status || t('（剛發生）'))}</small></span></div>`;
                B.issues += `<div class="pp-issue-hint">${t('村民會餓、會冷、會抱怨；有人提出對策前，拖越久影響越大。')}</div></div>`;
            }
        }
        if (W('cliques')) {
            // v6.52.0 小團體與恩怨連載(大家都看得到)
            try {
                const dv = (typeof DARK !== 'undefined' && this.world) ? DARK.view(this.world) : null;
                if (dv && ((dv.cliques || []).length || (dv.feuds || []).length)) {
                    B.cliques += `<div class="pp-issues"><h4 class="pp-h">🫂 ${t('小團體與恩怨')}</h4>`;
                    for (const c of dv.cliques) B.cliques += `<div class="pp-issue">🫂 <span>${esc(c.name)}${t('：')}${esc(c.members.map(n => t(n)).join(t('、')))}${c.against.length ? `<small>${esc(t('跟{v}不對盤').replace('{v}', c.against.map(n => t(n)).join(t('、'))))}</small>` : ''}</span></div>`;
                    for (const f of dv.feuds) B.cliques += `<div class="pp-issue">⚔️ <span>${esc(f.names.map(n => t(n)).join(' vs '))}<small>${esc(t('恩怨連載第 {n} 回').replace('{n}', f.n))}</small></span></div>`;
                    B.cliques += `</div>`;
                }
            } catch (e) {}
        }
        if (W('lore') || W('stats')) {
            // v6.47.0 村民提案留下的傳統與地標
            if ((d.traditions || []).length || (d.landmarks || []).length) {
                B.lore += `<div class="pp-lore"><h4 class="pp-h">🏮 ${t('本鎮的規矩與地標')}</h4>`;
                for (const x of (d.traditions || []).slice().reverse()) B.lore += `<div class="pp-lore-row">📜 ${t('「')}${esc(x.text)}${t('」')} <small>${esc(t(x.by || ''))} · ${esc(x.id || '')}</small></div>`;
                for (const x of (d.landmarks || []).slice().reverse()) B.lore += `<div class="pp-lore-row">${esc(x.icon)} ${esc(x.name)} <small>${esc(t(x.by || ''))} · ${esc(x.id || '')}</small></div>`;
                B.lore += `</div>`;
            }
            B.stats += `<h4 class="pp-h">📊 ${t('提案統計')}</h4><div class="pp-summary">${t('提出')} ${d.stats.made} · ${t('已批准')} ${d.stats.approved} · ${t('已否決')} ${d.stats.rejected} · ${t('已完成')} ${d.stats.done}</div>`;
        }
        return B;
    },

    renderProposals(container) {
        const d = this.state?.proposals;
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        if (!d) { container.innerHTML = `<div class="ob-empty"><span class="ob-empty-icon">📜</span><b>${t('村民的提案會出現在這裡')}</b>${t('村民會依性格、職業與小鎮近況主動提出提案，大家投票，再由鎮長自己拍板並說明理由。你在一旁看就好。')}</div>`; return; }
        const resLabel = (r) => this._resLabel ? this._resLabel(r) : r;
        const costText = (c) => Object.entries(c || {}).map(([r, n]) => `${resLabel(r)} ${n}`).join(t('、'));
        const avatar = (id) => { const a = this.state.agents?.[id]; if (!a) return ''; let url = ''; try { if (this.tileMap?.renderAvatarDataURL) url = this.tileMap.renderAvatarDataURL(a.job?.key || a.jobKey, a.gender, a.name, this.world?.agents?.[id]?.look || null); } catch (e) {} return `<div class="pp-avatar">${url ? `<img src="${url}" alt="">` : '👤'}</div>`; };
        // v6.53.2 蓋章動畫只在真的看到時才算「看過」:換鎮(新的提案系統)重算;停在別的子分頁不算
        if (this._stampSeenSys !== this.world?.proposals) { this._stampSeen = new Set(); this._stampSeenSys = this.world?.proposals; }
        const stampShown = [];
        const card = (p, mode) => {
            const total = p.forCount + p.againstCount; const pct = total ? Math.round(p.forCount / total * 100) : 0;
            const st = { open: t('待決定'), shelved: t('擱置中'), approved: t('進行中'), done: t('已完成'), failed: t('失敗'), rejected: t('已否決'), expired: t('已收回') }[p.status] || p.status;
            // v6.53.1 定案的提案蓋章:核准(綠)／否決(紅)／收回(灰),署名裁決的鎮長;第一次出現時有蓋下去的動畫
            const stampKind = ['approved', 'done', 'failed'].includes(p.status) ? 'ok' : p.status === 'rejected' ? 'no' : p.status === 'expired' ? 'off' : '';
            let stamp = '';
            if (stampKind) {
                const seen = this._stampSeen || (this._stampSeen = new Set()); const fresh = !seen.has(p.id + stampKind); stampShown.push(p.id + stampKind);
                const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
                const word = (en ? { ok: 'APPROVED', no: 'REJECTED', off: 'WITHDRAWN' } : { ok: '核准', no: '否決', off: '收回' })[stampKind];
                const by = (p.decidedBy === 'override' || p.decidedBy === 'council') ? t((typeof TIERS !== 'undefined' && this.world) ? TIERS.LV[TIERS.level(this.world)].council : '議會') : p.mayorName ? `${p.mayorActing ? t('代理鎮長') : t('鎮長')} ${t(p.mayorName)}` : (p.decidedBy === 'auto' ? t('依票數定案') : ''); // v6.82.0 議會否決／推翻首長否決時章上寫議會
                stamp = `<div class="pp-stamp pp-stamp-${stampKind}${fresh ? ' pp-stamp-new' : ''}${en ? ' pp-stamp-en' : ''}" aria-label="${esc(word)}"><b>${esc(word)}</b>${by ? `<small>${esc(by)}</small>` : ''}</div>`;
            }
            let html = `<div class="pp-card pp-${p.status}${stampKind ? ' pp-stamped' : ''}" data-pid="${p.id}">${stamp}
                <div class="pp-head"><span class="pp-id">${esc(p.id)}</span><span class="pp-kind">${p.icon} ${esc(p.kindLabel)}</span>${p.llm ? `<span class="pp-llm" title="${t('這件案子的投票／裁決由 AI 依記憶與性格推理')}">🧠</span>` : ''}<span class="pp-status">${st}</span></div>
                <div class="pp-title">${esc(p.title)}</div>
                <div class="pp-by">${avatar(p.proposerId)}<span><b>${esc(t(p.proposerName))}</b> <small>${esc(p.proposerJob)}</small></span></div>
                <div class="pp-desc">${esc(p.pitch || p.desc)}</div>`;
            if (p.effectsText && p.effectsText.length) html += `<div class="pp-fx">${p.effectsText.map(x => `<span>${esc(x)}</span>`).join('')}</div>`; // v6.47.0 村民自己的點子:實際效果
            if (p.cost && Object.keys(p.cost).length) html += `<div class="pp-cost ${p.affordable || (p.fundBy && p.fundBy !== 'town') ? '' : 'short'}">💰 ${t('需要')}${t('：')}${esc(costText(p.cost))}${p.affordable || (p.fundBy && p.fundBy !== 'town') ? '' : ` · ${t('公庫目前不夠')}`}</div>`;
            if (p.fundText) html += `<div class="pp-fund pp-fund-${p.fundBy}">${p.fundBy === 'self' ? '👛' : p.fundBy === 'crowd' ? '🤝' : '🏛️'} ${esc(p.fundText)}</div>`; // v6.54.0 誰出錢
            html += `<div class="pp-votes" title="${esc(t('贊成：') + (p.forNames || []).map(n => t(n)).join(t('、')))}&#10;${esc(t('反對：') + (p.againstNames || []).map(n => t(n)).join(t('、')))}"><span class="pp-for">👍 ${p.forCount}</span><i><b style="width:${pct}%"></b></i><span class="pp-against">👎 ${p.againstCount}</span></div>`;
            if (p.options?.length) { const tot = Math.max(1, p.options.reduce((x, o) => x + o.n, 0)); html += `<div class="pp-opts">${p.options.map(o => `<div class="pp-opt"><span>${o.icon} ${esc(o.name)}</span><i><b style="width:${Math.round(o.n / tot * 100)}%"></b></i><em>${o.n}</em></div>`).join('')}</div>`; } // v7.9.0 路線大辯論:多選一
            // v6.30.0 投票理由(各取前兩名)
            const whyText = (arr) => (arr || []).map(x => x.llm ? `${x.who ? esc(t(x.who)) : ''}${t('「')}${esc(x.why)}${t('」')}` : `${esc(x.why)} ×${x.n}`).join(t('、')); // v6.41.2 村民自己說的話用引號＋名字
            if ((p.forWhy && p.forWhy.length) || (p.againstWhy && p.againstWhy.length)) html += `<div class="pp-why">${p.forWhy?.length ? `<span>👍 ${whyText(p.forWhy)}</span>` : ''}${p.againstWhy?.length ? `<span>👎 ${whyText(p.againstWhy)}</span>` : ''}</div>`;
            // v6.82.0 大事要議會表決:每位議員怎麼投、首長否決有沒有被推翻
            const cName = (typeof TIERS !== 'undefined' && this.world) ? TIERS.LV[TIERS.level(this.world)].council : '議會';
            if (p.council) { const C = p.council; html += `<div class="pp-council"><div class="pp-council-h">🏛️ ${esc(t(cName))}${t('表決')} <b>${C.for}:${C.against}</b> · ${C.pass ? (C.sup ? t('通過（超過三分之二）') : t('通過')) : t('否決')}</div><div class="pp-council-list">${(C.list || []).map(x => `<span class="pp-cv pp-cv-${x.v === 'for' ? 'for' : 'against'}" title="${esc(x.why)}">${x.v === 'for' ? '👍' : '👎'} ${esc(t(x.name))}${String(x.why).includes('🕵️') ? ' 🕵️' : ''}</span>`).join('')}</div></div>`; }
            else if (p.needsCouncil) html += `<div class="pp-stage">🏛️ ${t('大事：村民投票後先送{council}表決，再由鎮長拍板').replace('{council}', esc(t(cName)))}</div>`;
            if (p.veto) html += `<div class="pp-veto">${p.veto.over ? '⚔️ ' + t('鎮長否決，被{council}以三分之二推翻').replace('{council}', esc(t(cName))) : '✋ ' + t('鎮長否決，{council}未達三分之二，否決成立').replace('{council}', esc(t(cName)))}</div>`;
            if (mode === 'decide') {
                // v6.37.0 上帝視角:觀察者只看,投票兩天後由 NPC 鎮長裁決
                html += `<div class="pp-deadline">${p.status === 'open' ? t('投票中，鎮長 {n} 天內裁決').replace('{n}', Math.max(1, p.daysLeft)) : t('鎮長先擱著，過幾天會重新拍板')}</div>`;
            } else if (p.status === 'approved') {
                html += `<div class="pp-deadline">${p.affordable ? t('已批准，等待執行') : t('已批准，等公庫湊齊資源（{n}/7 天）').replace('{n}', p.waitDays)}</div>`;
                if (!p.affordable) html += `<div class="pp-cost short">${p.order ? '📦 ' + esc(t('已向外地訂購{what}，{n} 天後到').replace('{what}', p.order.what).replace('{n}', p.order.days)) : p.short ? '🧱 ' + esc(t('還缺{miss}').replace('{miss}', p.short)) + (p.buyShort ? ` · ${esc(t('公庫的錢不夠買'))}` : '') : ''}</div>`; // v7.2.1 缺什麼、訂了什麼
            } else if (p.result) {
                html += `<div class="pp-result">${esc(p.result)}${p.decidedBy === 'auto' ? ` · ${t('依票數自動定案')}` : ''}</div>`;
                if (p.mayorName || p.mayorWhy) html += `<div class="pp-mayor">🏛️ ${p.mayorActing ? t('代理鎮長') : t('鎮長')}${p.mayorName ? ' ' + esc(t(p.mayorName)) : ''}${t('：')}${esc(p.mayorWhy || '')}</div>`; // v6.37.0
                if (p.outcomeText) html += `<div class="pp-outcome">📈 ${t('十天後')}${t('：')}${esc(p.outcomeText)}</div>`; // v6.30.0 成效
            }
            return html + '</div>';
        };
        // v6.53.0 分成三個子分頁:提案(投票與進度)、鎮況(急事、派系、規矩與統計)、真相(只有你知道的)
        let P = '', T = '', S = '';
        P += this._electionCardHtml(); // v6.42.0 鎮長選舉／代理鎮長
        P += this._assemblyCardHtml(); // v6.82.0 議會改選
        P += `<h4 class="pp-h">🗳️ ${t('投票中')} <span class="pp-count">${d.open.length}</span></h4>`;
        if (!d.open.length) P += `<div class="ob-empty" style="margin:10px 4px"><span class="ob-empty-icon">☕</span>${t('現在沒有投票中的提案。村民會依鎮上的情況陸續提出，通常每天一兩件。')}</div>`;
        else d.open.forEach(p => { P += card(p, 'decide'); });
        if (d.shelved.length) { P += `<h4 class="pp-h">📥 ${t('擱置中')} <span class="pp-count">${d.shelved.length}</span></h4>`; d.shelved.forEach(p => { P += card(p, 'decide'); }); }
        if (d.active.length) { P += `<h4 class="pp-h">🔨 ${t('進行中')}</h4>`; d.active.forEach(p => { P += card(p, 'view'); }); }
        if (d.history.length) { // v6.54.0 已定案只先列最近 8 件(玩久了會有上百件,全部畫出來會讓整個畫面卡住)
            const HN = 8, showAll = !!this._ppHistAll, hist = showAll ? d.history : d.history.slice(0, HN);
            P += `<h4 class="pp-h">📚 ${t('已定案')} <span class="pp-count">${d.history.length}</span></h4>`; hist.forEach(p => { P += card(p, 'view'); });
            if (d.history.length > HN) P += `<button type="button" class="pp-more" data-pp-more="1">${showAll ? t('收起，只看最近 {n} 件').replace('{n}', HN) : t('顯示更早的 {n} 件').replace('{n}', d.history.length - HN)}</button>`;
        }
        const B = this._townBlocks(d, ['issues', 'tier', 'politics', 'mind', 'civic', 'faith', 'cliques', 'dream', 'lore', 'stats']);
        T = [B.issues, B.tier, this._councilHtml(), B.politics, B.mind, B.civic, B.faith, B.cliques, this._eventPieces(['factions']).factions, B.dream, B.lore, B.stats].join(''); // v7.3.0 急事放最上面;鎮史文化珍品→日報年表、外交報社外地消息→日報消息、店與銀行→小鎮產業
        // v6.51.0 只有你知道的真相:還沒被拆穿的謊言、陰謀,還沒解開的誤會
        try {
            const dv = (typeof DARK !== 'undefined' && this.world) ? DARK.view(this.world) : null;
            if (dv && (dv.secrets.length || dv.mis.length)) {
                const MIS = { cold: '{a}以為{b}很冷漠（其實只是害羞）', jealous: '{a}以為{b}劈腿（其實只是普通朋友）', overheard: '{a}以為{b}在說自己壞話（其實不是）', price: '{a}以為{b}賣東西坑人（其實是原料漲價）' };
                S += `<div class="pp-issues pp-secrets"><h4 class="pp-h">🕵️ ${t('只有你知道的真相')} <span class="pp-count">${dv.secrets.length + dv.mis.length}</span></h4>`;
                for (const s of dv.secrets) S += `<div class="pp-issue">${s.plan ? '🕵️' : s.kind === 'white' ? '💗' : '🎭'} <span>${esc(s.text)}<small>${s.plan ? t('正在籌劃') : t('村民還不知道')}</small></span></div>`;
                for (const m of dv.mis) S += `<div class="pp-issue">😶 <span>${esc(t(MIS[m.kind] || '').replace('{a}', t(m.a)).replace('{b}', t(m.b)))}<small>${t('誤會還沒解開')}</small></span></div>`;
                S += `<div class="pp-issue-hint">${t('眼力好的人（守衛、鎮長、學者…）比較容易看穿；被拆穿的人會失去大家的信任。')}</div></div>`;
            }
        } catch (e) {}
        const nIss = (d.issues || []).length, hot = (d.issues || []).some(x => x.sev >= 3 || (!x.by && x.idle >= 3));
        let nSec = 0; try { const dv = (typeof DARK !== 'undefined' && this.world) ? DARK.view(this.world) : null; nSec = dv ? dv.secrets.length + dv.mis.length : 0; } catch (e) {}
        if (!T) T = `<div class="ob-empty" style="margin:10px 4px"><span class="ob-empty-icon">🌤️</span>${t('鎮上目前風平浪靜，沒有急事。')}</div>`;
        if (!S) S = `<div class="ob-empty" style="margin:10px 4px"><span class="ob-empty-icon">🕊️</span>${t('目前沒有人在說謊、設局或誤會別人。')}</div>`;
        let tab = this._ppTab; if (!tab) { try { tab = localStorage.getItem('rimtown_pp_tab'); } catch (e) {} } if (!['props', 'town', 'truth'].includes(tab)) tab = 'props';
        const tabBtn = (k, icon, label, n, dot) => `<button type="button" role="tab" class="pp-tab${tab === k ? ' on' : ''}" aria-selected="${tab === k}" data-pp-tab="${k}">${icon} ${t(label)}${n ? ` <span class="pp-tab-n${dot ? ' hot' : ''}">${n}</span>` : ''}</button>`;
        let html = `<div class="proposals-panel"><div class="pp-tabs" role="tablist">${tabBtn('props', '🗳️', '提案', d.open.length)}${tabBtn('town', '🏘️', '鎮況', nIss, hot)}${tabBtn('truth', '🕵️', '真相', nSec)}</div>`;
        html += `<div class="pp-tabhint">${t({ props: '村民自己提案、全鎮投票，大事再送議會表決，最後鎮長裁決。你只看。', town: '鎮上正在發生的事：急事、小團體、規矩與統計。', truth: '只有你看得到：誰在說謊、設局，誰誤會了誰。' }[tab])}</div>`;
        html += tab === 'town' ? T : tab === 'truth' ? S : P;
        if (tab === 'props') for (const k of stampShown) this._stampSeen.add(k);
        html += '</div>';
        // v6.54.0 內容沒變就不重畫(側欄每格都會呼叫;以前每次都整頁重建,提案一多就卡)。剛蓋的章(pp-stamp-new)不算變化,讓動畫播完
        const sig = html.replace(/ pp-stamp-new/g, '');
        if (container._ppSig === sig && container.firstElementChild?.classList?.contains('proposals-panel')) return;
        container._ppSig = sig;
        container.innerHTML = html;
        container.querySelector('[data-pp-more]')?.addEventListener('click', (e) => { e.stopPropagation(); this._ppHistAll = !this._ppHistAll; this.renderProposals(container); });
        container.querySelectorAll('[data-pp-tab]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this._ppTab = b.dataset.ppTab; try { localStorage.setItem('rimtown_pp_tab', this._ppTab); } catch (er) {} this.renderProposals(container); container.scrollTop = 0; }));
    },

    // v6.42.0 提案分頁頂端的選舉卡:代理鎮長、選舉／補選進度(候選人政見與演說、得票、支持者說的話)、上一屆結果
    // v6.82.0 議會改選卡:競選中列候選人與政見,開票後十天內列結果
    _assemblyCardHtml() {
        const W = this.world; if (!W || typeof ASSEMBLY === 'undefined' || !W.council?._formed) return '';
        const esc = (x) => this._escapeHtml(String(x ?? '')); const nm = (n) => esc(t(n || ''));
        let v; try { v = ASSEMBLY.view(W); } catch (e) { return ''; }
        const cn = esc(t(v.council)); let html = '';
        if (v.elec) {
            const E = v.elec;
            const phase = E.phase === 'campaign' ? t('競選中，還有 {n} 天').replace('{n}', E.left) : t('明天開票');
            html += `<div class="el-card as-card"><div class="el-head">🗳️ <b>${cn}${t('改選')}</b><span class="el-phase">${phase}</span></div><div class="as-sub">${t('{n} 人搶 {s} 席').replace('{n}', E.cands.length).replace('{s}', E.seats)}</div>`;
            for (const c of E.cands) html += `<div class="el-cand" data-action="select-agent" data-val="${esc(c.id)}"><div class="el-row"><span class="el-name">${nm(c.name)}</span>${c.inc ? `<span class="el-pol">${t('現任')}</span>` : ''}</div><div class="el-speech">${t('「')}${esc(t(c.pitch).split('{council}').join(t(v.council)))}${t('」')}</div></div>`;
            return html + '</div>';
        }
        const L = v.last; const d = W._absDay ? W._absDay() : 0;
        if (L && d - L.day <= 10) {
            html += `<div class="el-card as-card"><div class="el-head">🗳️ <b>${cn}${t('改選結果')}</b><span class="el-phase">${t('投票率 {p}%').replace('{p}', L.voters ? Math.round(L.turnout / L.voters * 100) : 0)}</span></div>`;
            const top = Math.max(1, ...L.results.map(x => x.votes));
            for (const x of L.results) html += `<div class="el-cand${x.won ? ' el-win' : ''}" data-action="select-agent" data-val="${esc(x.id)}"><div class="el-row"><span class="el-name">${x.won ? '🏛️ ' : ''}${nm(x.name)}</span>${x.inc ? `<span class="el-pol">${t('現任')}</span>` : ''}<span class="el-votes">${x.votes}${t(' 票')}</span></div><div class="election-bar"><div class="election-bar-fill${x.won ? ' winner' : ''}" style="width:${Math.round(x.votes / top * 100)}%"></div></div></div>`;
            if (v.runners.length) html += `<div class="as-sub">${t('出缺時依序遞補')}${t('：')}${v.runners.slice(0, 4).map(nm).join(t('、'))}</div>`;
            return html + '</div>';
        }
        return '';
    },
    _electionCardHtml() {
        const el = this.state?.election; const W = this.world; if (!el || !W) return '';
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const nm = (n) => esc(t(n || ''));
        let html = '';
        // v6.43.6 代理提示看即時狀態(state 可能是舊快照):正式鎮長已經回到鎮上就不顯示;依原因分開寫,只有鎮長真的離開才寫「補選」
        const live = W.election; const acting = live?.acting; const back = !!live?._realMayor?.(W);
        if (acting && !back) {
            const rs = acting.reason;
            const msg = rs === 'travel'
                ? t('鎮長{mayor}出遠門，由{acting}代理鎮長。').replace('{mayor}', nm(acting.mayorName)).replace('{acting}', nm(acting.name))
                : rs === 'explore'
                ? t('鎮長{mayor}出去探險了，由{acting}代理鎮長，回來後交還。').replace('{mayor}', nm(acting.mayorName)).replace('{acting}', nm(acting.name))
                : (live.active && live.byElection)
                ? t('鎮上暫時沒有鎮長，由{acting}代理，補選進行中。').replace('{acting}', nm(acting.name))
                : t('鎮上暫時沒有鎮長，由{acting}代理，即將補選。').replace('{acting}', nm(acting.name));
            html += `<div class="el-acting">🏛️ ${msg}</div>`;
        }
        if (el.active && el.candidates?.length) {
            const title = el.byElection ? t('鎮長補選') : t('鎮長選舉');
            const phase = el.phase === 'campaign' ? t('競選中，還有 {n} 天').replace('{n}', el.campaignDaysLeft)
                : el.phase === 'voting' ? t('投票中，還有 {n} 天').replace('{n}', el.votingDaysLeft) : t('結果出爐');
            const total = el.candidates.reduce((s, c) => s + (c.votes || 0), 0);
            html += `<div class="el-card"><div class="el-head">🗳️ <b>${title}</b><span class="el-phase">${phase}</span></div>`;
            const ranked = el.phase === 'results' ? el.candidates : el.candidates.slice();
            ranked.forEach((c, i) => {
                const pct = total ? Math.round((c.votes || 0) / total * 100) : 0;
                const win = el.phase === 'results' && i === 0;
                const quotes = (W.election?.quotes?.(W, c.agentId) || []).map(q => `<div class="el-quote">${nm(q.who)}${t('「')}${esc(q.why)}${t('」')}</div>`).join('');
                html += `<div class="el-cand${win ? ' el-win' : ''}" data-action="select-agent" data-val="${esc(c.agentId)}">
                    <div class="el-row"><span class="el-name">${win ? '👑 ' : ''}${nm(c.name)}</span><span class="el-pol">${c.policyIcon || ''} ${esc(t(c.policyLabel || ''))}</span>${c.llm ? `<span class="pp-llm" title="${t('政見與演說由 AI 依這位村民的性格與記憶寫成')}">🧠</span>` : ''}${el.phase !== 'campaign' ? `<span class="el-votes">${c.votes || 0}${t(' 票')}${total ? ` · ${pct}%` : ''}</span>` : ''}</div>
                    ${c.speech ? `<div class="el-speech">${t('「')}${esc(c.speech)}${t('」')}</div>` : ''}
                    ${el.phase !== 'campaign' ? `<div class="election-bar"><div class="election-bar-fill${win ? ' winner' : ''}" style="width:${pct}%"></div></div>` : ''}
                    ${quotes}
                </div>`;
            });
            html += '</div>';
        } else if (el.electionHistory?.length) {
            const last = el.electionHistory[el.electionHistory.length - 1];
            const pol = (typeof ELECTION_POLICIES_LABELS !== 'undefined' && ELECTION_POLICIES_LABELS[last.winner.policy]) || last.winner.policy;
            html += `<div class="el-last">🏛️ ${last.byElection ? t('上次補選') : t('上次選舉')}${t('：')}${nm(last.winner.name)} ${t('當選')}${t('（')}${esc(pol)}${t('，')}${last.winner.votes}/${last.totalVotes} ${t('票')}${t('）')}${t('。')}${t('下次選舉在秋季第 1 天。')}</div>`;
        } else {
            html += `<div class="el-last">🏛️ ${t('鎮長每年秋季第 1 天改選；鎮長永久離開小鎮會馬上補選。')}</div>`;
        }
        if (W.council?._formed && typeof TIERS !== 'undefined' && !W.assembly?.elec) html += `<div class="el-last">🏛️ ${t('{council}每年春季第 3 天改選；有人出缺由上次落選者依票數遞補。').replace('{council}', esc(t(TIERS.LV[TIERS.level(W)].council)))}</div>`; // v6.82.0
        return html;
    },

    renderSettings(container) {
        // Preserve unsaved form values from existing DOM inputs (prevents
        // renderSidebar() calls from wiping user-typed/pasted API keys)
        const loggedIn = this.auth.loggedIn;
        const username = this.auth.username;
        const paused = this.world?.paused;

        let html = '';

        // v5.63.0 管理員面板(只有 ADMIN_USERS 名單裡的帳號看得到):列出玩家、封鎖、刪除帳號
        if (this.auth._serverless && this.auth.isAdmin) {
            html += `<div class="econ-section" style="border:1px solid rgba(233,69,96,0.5)"><h3>🛡️ ${t('管理員')}</h3>
                <p style="font-size:0.72rem;color:var(--text-secondary);margin:0 0 6px">${t('封鎖＝該帳號無法登入、無法用 AI 與存檔；刪除＝連同所有雲端存檔一併清除，且名字不能再註冊。')}</p>
                <button class="trade-btn" data-action="admin-load-users" style="padding:6px 12px">👥 ${t('載入玩家列表')}</button>
                <button class="trade-btn" data-action="admin-load-invites" style="padding:6px 12px">🎟️ ${t('推薦碼管理')}</button>
                <div id="admin-user-list" style="margin-top:8px;font-size:0.75rem">${this._adminUsersHtml || ''}</div>
                <div id="admin-invite-list" style="margin-top:8px;font-size:0.75rem">${this._adminInvitesHtml || ''}</div>
            </div>`;
        }

        // --- Game Control Section ---
        const currentMultiplier = this._speedMultiplier || 1;
        html += t('<div class="econ-section"><h3>🎮 遊戲控制</h3>');
        // v6.54.0 速度只在上方控制列調(倍率),設定頁不再重複
        // v6.27.0 3D 畫質:自動(卡頓就降)／高／低;2D 開關已移除(WebGL 不可用時自動退回)
        let qPref = 'auto'; try { qPref = localStorage.getItem('rimtown_3d_quality') || 'auto'; if (qPref === 'low' && localStorage.getItem('rimtown_3d_q_by') !== 'user') qPref = 'auto'; } catch (e) {} // v6.43.3 自動降級留下的 low 不算玩家選的
        html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">${t('3D 畫質')}</label>
            <select id="settings-quality" style="width:100%;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem" onchange="try{if(this.value==='auto'){localStorage.removeItem('rimtown_3d_quality');localStorage.removeItem('rimtown_3d_q_by')}else{localStorage.setItem('rimtown_3d_quality',this.value);localStorage.setItem('rimtown_3d_q_by','user')}}catch(e){};location.reload()">
                <option value="auto"${qPref==='auto'?' selected':''}>${t('自動（手機 1.5 倍解析度，卡頓就自動降低）')}</option>
                <option value="high"${qPref==='high'?' selected':''}>${t('高（陰影、抗鋸齒、原生解析度）')}</option>
                <option value="low"${qPref==='low'?' selected':''}>${t('低（無陰影、1x 解析度，省電）')}</option>
            </select>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">${t('切換後會重新整理頁面；手機預設不開陰影。')}</div>
        </div>`;
        // v6.29.0 介面配色與自動帶鏡頭
        let themePref = 'night'; try { themePref = localStorage.getItem('rimtown_theme') || 'night'; } catch (e) {} // v6.41.1 拿掉「自動」
        let autocam = false; try { autocam = localStorage.getItem('rimtown_autocam') === '1'; } catch (e) {}
        let idlecam = true; try { idlecam = localStorage.getItem('rimtown_idlecam') !== '0'; } catch (e) {} // v6.32.0
        html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">${t('介面配色')}</label>
            <select id="settings-theme" style="width:100%;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem" onchange="try{localStorage.setItem('rimtown_theme',this.value)}catch(e){};window.rimtownApp?._applyTheme?.()">
                <option value="night"${themePref!=='day'?' selected':''}>${t('夜色')}</option>
                <option value="day"${themePref==='day'?' selected':''}>${t('日光')}</option>
            </select>
        </div>
        <div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary);display:flex;align-items:center;gap:8px"><input type="checkbox" id="settings-autocam" ${autocam ? 'checked' : ''} onchange="try{localStorage.setItem('rimtown_autocam',this.checked?'1':'0')}catch(e){}"> ${t('事件發生時自動帶鏡頭')}</label>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">${t('新提案、搬來、商隊進城、考驗公布時鏡頭自動飛過去；關掉的話通知上仍有「去看」鈕。')}</div>
        </div>
        <div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary);display:flex;align-items:center;gap:8px"><input type="checkbox" id="settings-idlecam" ${idlecam ? 'checked' : ''} onchange="try{localStorage.setItem('rimtown_idlecam',this.checked?'1':'0')}catch(e){};if(window.rimtownApp&&window.rimtownApp.tileMap){window.rimtownApp.tileMap.idleCam=this.checked;window.rimtownApp.tileMap._lastInputAt=Date.now();}"> ${t('閒置時鏡頭慢慢環繞小鎮')}</label>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">${t('45 秒沒操作就開始環繞，動一下滑鼠或螢幕就停。')}</div>
        </div>`;
        // v5.59.2 背景音樂開關搬進設定分頁(原本只在無入口的舊版彈窗裡,玩家關不掉音樂)
        html += `<div style="margin-top:8px">
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:4px">🎵 ${t('背景音樂')}</div>
            <div style="display:flex;align-items:center;gap:8px">
                <button class="trade-btn" data-action="settings-bgm-mute" style="padding:6px 12px">${this.bgm?.muted ? '🔇 ' + t('已靜音') : '🔊 ' + t('播放中')}</button>
                <input id="settings-bgm-volume" type="range" min="0" max="100" value="${Math.round((this.bgm?.volume ?? 0.2) * 100)}" style="flex:1">
            </div>
        </div>`;
        // v5.27.0 肉鴿:開新局的卡司模式
        const rosterMode = (localStorage.getItem('rimtown_roster_mode') === 'random') ? 'random' : 'scripted';
        html += `<div style="margin-top:4px">
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:4px">🎲 ${t('開新局的村民')}</div>
            <div class="speed-controls">
                <button class="btn-speed${rosterMode==='scripted'?' active':''}" data-action="settings-roster" data-val="scripted">📖 ${t('劇本卡司')}</button>
                <button class="btn-speed${rosterMode==='random'?' active':''}" data-action="settings-roster" data-val="random">🎲 ${t('隨機卡司')}</button>
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:3px">${rosterMode==='random'?t('每開一張新地圖都隨機抽一批全新村民與愛恨關係,每局故事都不同'):t('用陳偉、林美等固定劇本村民與開局關係網')}</div>
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
                <button class="trade-btn" data-action="settings-export" title="${t('把目前這個小鎮的存檔下載成一個檔案')}">💾 ${t('匯出存檔')}</button>
                <button class="trade-btn" data-action="settings-logout" style="background:var(--negative);color:#fff">${t('登出')}</button>
            </div>`;
        } else {
            html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <button class="trade-btn btn-accent" data-action="settings-save-game">${t('儲存遊戲')}</button>
                <button class="trade-btn" data-action="settings-export" title="${t('把目前這個小鎮的存檔下載成一個檔案')}">💾 ${t('匯出存檔')}</button>
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
        const isServerAI = this.llmClient?.provider === 'server';
        const aiLabel = isServerAI ? t('AI:小鎮內建') : (aiConnected ? t('AI:自備') + ' ' + this._byokLabel(this.llmClient.provider) : t('AI:未連接'));
        html += t('<div class="econ-section"><h3>🤖 AI 語言模型</h3>');
        html += `<div style="margin-bottom:8px"><span class="llm-status ${aiConnected ? 'connected' : 'disconnected'}">${aiLabel}</span></div>`;
        // v5.65.0 AI 全面內建:金鑰由伺服器統一保管;v6.36.0 玩家可改填自己的金鑰(只存本機)
        // v6.76.4 改成條列卡片;額度依伺服器實際回報(登入玩家預設沒有每日上限,不再寫死 300 則)
        {
            const q = this.llmClient?._quota; const today = new Date().toISOString().slice(0, 10);
            const quotaLine = (q && q.limit && q.day === today) ? t('今天的 AI 額度：剩 {r}／{l} 則').replace('{r}', Math.max(0, q.remaining)).replace('{l}', q.limit) : t('登入玩家沒有每日次數上限');
            const li = (x) => `<li>${x}</li>`;
            if (isServerAI) html += `<div class="set-card"><div class="set-card-title">🏘️ ${t('內建小鎮 AI 已啟用，免填金鑰')}</div><ul class="set-list">${li(quotaLine)}${li(t('金鑰由小鎮伺服器統一保管，你不會看到任何金鑰欄位'))}${li(t('對話、行程、反思與完整智能體決策先走 Claude；故障時依序改用 GPT、Groq'))}</ul></div>`;
            else html += `<div class="set-card"><div class="set-card-title">💤 ${t('此站沒有內建 AI 代理端點，村民對話走內建模擬')}</div></div>`;
        }
        // v6.39.0 完整智能體模式
        {
            let fa = null; try { fa = localStorage.getItem('rimtown_full_agent'); } catch (e) {}
            const on = this._fullAgentOn ? this._fullAgentOn() : false; const auto = fa !== '1' && fa !== '0';
            const capNote = this.llmClient?._quota?.limit ? ' ' + t('內建 AI 設了每日上限時，剩不到三成會先改用規則版，把額度留給你的聊天與事件卡；隔天恢復。') : '';
            html += `<div class="set-card set-toggle-card">
            <label class="set-toggle" for="settings-fullagent"><input type="checkbox" id="settings-fullagent" ${on ? 'checked' : ''} onchange="try{localStorage.setItem('rimtown_full_agent',this.checked?'1':'0')}catch(e){};window.rimtownApp?._applyFullAgent?.()"><span class="set-toggle-title">🧠 ${t('完整智能體模式')}</span>${auto ? `<span class="set-chip">${t('預設開')}</span>` : ''}</label>
            <div class="set-help">${t('開啟後，村民投票、要不要提案與提什麼、鎮長批准與否，都由 AI 依各自的記憶、性格、交情與鎮況推理並說明理由；AI 失敗時才用規則版墊底。每件提案約多 2～4 次 AI 呼叫，每天另多 1 次。')}${capNote}</div>
            </div>`;
        }
        // v5.73.0 AI 對話語言:跟隨介面 / 繁體中文 / English(村民台詞、行程、反思、日報)
        {
            const existingDl = document.getElementById('settings-tab-dialoglang');
            let dl = 'auto'; try { dl = existingDl ? existingDl.value : (localStorage.getItem('rimtown_dialogue_lang') || 'auto'); } catch (e) {}
            const optSel = (v) => dl === v ? ' selected' : '';
            html += `<div class="setting-group set-field">
            <label for="settings-tab-dialoglang" class="set-label">🗣️ ${t('AI 對話語言')}</label>
            <select id="settings-tab-dialoglang" class="set-input">
                <option value="auto"${optSel('auto')}>${t('跟隨介面語言')}</option>
                <option value="zh"${optSel('zh')}>繁體中文</option>
                <option value="en"${optSel('en')}>English</option>
            </select>
            <div class="set-help">${t('村民對話、行程、反思與日報由 AI 生成時使用的語言，不影響介面文字。')}</div></div>`;
        }
        // v5.29.0 混合成本控制:NPC 之間的對話只有在玩家附近才用 LLM,並受每日額度限制
        const existingBudget = document.getElementById('settings-tab-npcbudget');
        const npcBudget = existingBudget ? existingBudget.value : (localStorage.getItem('rimtown_npc_llm_budget') ?? '');
        const npcUsed = this.world?.npcLlmUsedToday || 0;
        html += `<div class="setting-group set-field">
            <label for="settings-tab-npcbudget" class="set-label">💰 ${t('村民背景 AI 每日上限')}</label>
            <div class="set-row">
                <input type="number" id="settings-tab-npcbudget" class="set-input set-input-num" value="${this._escapeHtml(String(npcBudget))}" placeholder="${t('無上限')}" min="0" max="9999" inputmode="numeric">
                <span class="set-meta">${t('今日已用')} ${npcUsed} ${t('次')}</span>
            </div>
            <div class="set-help">${t('留空＝無上限，填 0＝完全關閉。村民的每日行程、鏡頭附近的村民對話與夜間反思會用到 AI；遠處對話改用內建模擬，照樣寫進記憶。你和村民的聊天、事件卡反應不算在內。')}</div>
        </div>`;
        html += '</div>';

        // --- Save All & Version ---
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
            <button class="trade-btn btn-accent" data-action="settings-save-all">${t('儲存設定')}</button>
        </div>`;

        // --- Version ---
        html += `<div style="text-align:center;padding:10px;font-size:0.75rem;color:var(--text-muted)">v${typeof RIMTOWN_APP_VERSION!=='undefined'?RIMTOWN_APP_VERSION:'?'}</div>`;

        container.innerHTML = html;
        // v5.59.2 音量滑桿即時生效並記憶(設定分頁在模擬 tick 時不重繪,拖曳不會被打斷)
        document.getElementById('settings-bgm-volume')?.addEventListener('input', (e) => {
            if (!this.bgm) return;
            this.bgm.setVolume(parseInt(e.target.value, 10) / 100);
            if (this.bgm.muted) { this.bgm.toggleMute(); this.renderSidebar(); }
        });
    },

    // v6.78.1 每日報紙:把一天的八卦與大小事整理成一份報紙(sim-episode.js),上一期／下一期可翻
    _renderEpisode() {
        const w = this.world; if (!w || typeof EPISODE === 'undefined') return '';
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const lang = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'zh';
        const eps = EPISODE.list(w); const todayDay = w._absDay ? w._absDay() : 0;
        const log = w.messageLog || []; const last = log[log.length - 1];
        const liveKey = `${log.length}|${last?.tick}|${lang}|${(w.dramaArchive || []).length}|${todayDay}`;
        if (this._epLiveKey !== liveKey) { this._epLive = EPISODE.view(w, EPISODE.today(w)); this._epLiveKey = liveKey; }
        let sel = this._epSel; const force = sel === 'today'; if (force) sel = null;
        if (sel == null && !force && this._epLive.empty && eps.length) sel = eps[eps.length - 1].day; // 剛換日、今天還沒什麼事:先看昨天那份
        const ep = sel != null ? eps.find(e => e.day === sel) : null;
        let v = this._epLive;
        if (ep) { const k = `${ep.day}|${lang}`; if (this._epViewKey !== k) { this._epView = EPISODE.view(w, ep); this._epViewKey = k; } v = this._epView; }
        const days = eps.map(e => e.day).filter(d => d !== todayDay).sort((a, b) => a - b);
        const prev = days.filter(d => d < v.day).pop();
        const next = v.live ? null : (days.find(d => d > v.day) ?? 'today');
        const c = v.counts || {};
        const stats = [[c.convo, '場對話'], [c.gossip, '則八卦'], [c.proposal, '件新提案'], [c.skill, '次手藝進步']].filter(x => x[0]).map(x => `${x[0]} ${t(x[1])}`).join(' · ');
        let body;
        if (v.empty) body = `<p class="np-empty">${t('今天的報紙還在等新聞，過一會兒再來看。')}</p>`;
        else body = `<h3 class="np-headline">${esc(v.title)}</h3>`
            + (v.quote ? `<blockquote class="np-quote">${t('「')}${esc(v.quote.text)}${t('」')}<cite>— ${esc(v.quote.who)}</cite></blockquote>` : '')
            + v.sections.map(sec => `<div class="np-sec np-${sec.key}"><h4>${sec.icon} ${esc(sec.label)}</h4><ul>${sec.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')
            + (v.teaser.length ? `<div class="np-sec np-next"><h4>🔭 ${t('明日看點')}</h4><ul>${v.teaser.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
        return `<div role="region" class="np-paper${v.live ? ' live' : ''}" aria-label="${t('每日報紙')}">
            <div class="np-mast"><div class="np-name">${t('觀察者日報')}</div>
            <div class="np-meta"><span>${t('第 {n} 期').split('{n}').join(v.no)}</span><span>${esc(v.label)}</span>${v.live ? `<span class="np-live">${t('今日・編輯中')}</span>` : ''}</div>
            ${v.weather ? `<div class="np-weather">${esc(v.weather)}</div>` : ''}</div>
            <div class="np-body">${body}</div>
            ${stats ? `<div class="np-stats">${stats}</div>` : ''}
            <div class="np-nav">
                <button type="button" class="np-btn" data-action="ep-nav" data-val="${prev ?? ''}" ${prev == null ? 'disabled' : ''}>‹ ${t('上一期')}</button>
                <button type="button" class="np-btn" data-action="ep-nav" data-val="${next ?? ''}" ${next == null ? 'disabled' : ''}>${next === 'today' ? t('今天') : t('下一期')} ›</button>
            </div>
        </div>`;
    },

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();
        let html = this._renderEpisode();

        // v6.78.1 「小鎮劇場」拿掉:名場面改成報紙「感情與恩怨」版的一則(同類合併)

        // Show recent NPC conversations at the top
        const npcConvos = (this.state.npc_conversations || []).slice().reverse();
        if (npcConvos.length) {
            // v6.78.0 對話與逐筆紀錄收進摺疊區,預設收起(八點檔已經講過一遍)
            html += `<details class="log-fold npc-convo-section"><summary>💬 ${t('村民對話')}${t('（')}${Math.min(8, npcConvos.length)}${t('）')}</summary>`;
            npcConvos.slice(0, 8).forEach(c => {
                html += `<div class="npc-convo-entry" data-action="toggle-convo">
                    <div class="npc-convo-header"><span class="npc-convo-toggle">▶</span><span class="log-time">${c.time}</span><strong>${c.agentA}</strong> &amp; <strong>${c.agentB}</strong>
                    <span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px">@ ${this._locationLabel(c.location)}</span>${c.llm ? `<span style="font-size:0.62rem;margin-left:6px;padding:1px 5px;border-radius:6px;background:rgba(140,120,255,0.25);color:#c9bfff">✨ AI</span>` : ''}</div>
                    <div class="npc-convo-summary">${c.summary}</div>
                    <div class="npc-convo-dialogue">`;
                (c.dialogue || []).forEach(d => {
                    html += `<div class="npc-convo-line"><span class="npc-convo-speaker">${d.speaker}:</span> ${this._escapeHtml(d.text)}</div>`;
                });
                html += '</div></div>';
            });
            html += '</details>';
        }

        // Standard log messages(v6.78.0 收進「逐筆紀錄」;技能升級太多,合併成一行)
        const shown = messages.filter(m => m.type !== 'skill_up'); const skillN = messages.length - shown.length;
        if (messages.length) {
            html += `<details class="log-fold log-messages-section"><summary>📋 ${t('逐筆紀錄')}${t('（')}${shown.length}${t('）')}</summary>`;
            if (skillN) html += `<div class="log-entry type-skill_up">📈 ${t('另有 {n} 則技能升級，已合併不列出。').split('{n}').join(skillN)}</div>`;
            shown.forEach(msg => {
                html += `<div class="log-entry type-${msg.type}"><span class="log-time">${msg.time}</span>
                ${msg.agent?`<strong>${msg.agent}</strong>`:''} ${msg.content} ${msg.target?` &rarr; ${msg.target}`:''}</div>`;
            });
            html += '</details>';
        }
        container.innerHTML = html || t('<p class="muted-text" style="padding:20px">尚無訊息...</p>');
    },

    // v7.3.0 舊「事件」分頁拆成各區塊:天氣與節慶→小鎮、新聞與事件→日報消息、AI 日報→日報、出生與墓園→年表、派系→鎮況;選舉與議會已在提案分頁
    _eventPieces(want) {
        const W = (k) => !want || want.includes(k);
        const E = { mods: '', weather: '', news: '', aidaily: '', happen: '', festival: '', factions: '', explore: '', life: '' };
        if (!this.state) return E;
        if (W('weather')) {
            // --- Weather Panel ---
            const weather = this.state.weather;
            if (weather) {
                E.weather += '<div class="weather-section" style="margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px">';
                E.weather += `<h4>${weather.icon} ${t('天氣')}${t('：')}${t(weather.name)}</h4>`;
                E.weather += `<div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0">${weather.desc}</div>`;
                E.weather += `<div style="display:flex;gap:12px;font-size:0.75rem;margin:6px 0">`;
                E.weather += `<span>🌡️ ${weather.temperature}°C</span>`;
                E.weather += `<span>💧 ${t('濕度')} ${weather.humidity}%</span>`;
                E.weather += `<span>💨 ${t('風速')} ${weather.windSpeed}</span>`;
                E.weather += `</div>`;
                // Farm & mood modifiers
                const farmPct = Math.round(weather.farmModifier * 100);
                const moodVal = weather.moodModifier;
                E.weather += `<div style="display:flex;gap:12px;font-size:0.75rem;margin:4px 0">`;
                E.weather += `<span style="color:${farmPct >= 0 ? 'var(--positive)' : 'var(--negative)'}">🌾 ${t('農業')} ${farmPct >= 0 ? '+' : ''}${farmPct}%</span>`;
                E.weather += `<span style="color:${moodVal >= 0 ? 'var(--positive)' : 'var(--negative)'}">😊 ${t('心情')} ${moodVal >= 0 ? '+' : ''}${moodVal}</span>`;
                E.weather += `</div>`;
                // Forecast
                if (weather.forecast?.length) {
                    E.weather += `<div style="display:flex;gap:8px;margin-top:6px;font-size:0.72rem;color:var(--text-muted)">`;
                    E.weather += `<span>${t('預報')}${t('：')}</span>`;
                    weather.forecast.forEach(f => { E.weather += `<span title="${t(f.name)}">${f.icon}</span>`; });
                    E.weather += `</div>`;
                }
                // Disaster warning
                if (weather.disasterWarning) {
                    E.weather += `<div style="margin-top:6px;padding:4px 8px;background:rgba(255,80,80,0.1);border-left:3px solid var(--negative);border-radius:4px;font-size:0.75rem">`;
                    E.weather += `⚠️ ${t('災害預警')}${t('：')}${weather.disasterWarning.type === 'drought_severe' ? t('嚴重乾旱') : weather.disasterWarning.type === 'blizzard_severe' ? t('極端暴風雪') : t('洪水')}`;
                    if (weather.disasterWarning.daysUntil > 0) E.weather += ` (${weather.disasterWarning.daysUntil} ${t('天後')})`;
                    E.weather += `</div>`;
                }
                // Active disaster
                if (weather.activeDisaster) {
                    E.weather += `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,40,40,0.15);border-left:3px solid var(--negative);border-radius:4px;font-size:0.8rem;font-weight:bold">`;
                    E.weather += `🚨 ${t(weather.activeDisaster.name)}${t('（')}${t('剩餘')} ${weather.activeDisaster.daysLeft} ${t('天')}${t('）')}`;
                    E.weather += `<div style="font-weight:normal;font-size:0.72rem;margin-top:2px">${weather.activeDisaster.desc}</div>`;
                    E.weather += `</div>`;
                }
                E.weather += '</div>';
            }

        }
        if (W('news')) {
            // --- News Bulletins --- v7.3.0 只列本鎮的(外地的走「外地消息」,不重複);中文不再露出英文副標、undefined、REMOTE
            const news = this.state.news || {};
            const en = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
            const bulletins = (news.bulletins || []).filter(b => b.category !== 'remote');
            if (bulletins.length) {
                E.news += `<div class="news-section"><h4>📢 ${t('本鎮公告')} <span class="pp-count">${bulletins.length}</span></h4><div class="news-ticker">`;
                const CATEGORY_LABELS = {security:t('安全'),trade:t('貿易'),weather:t('天氣'),social:t('社會'),health:t('健康'),discovery:t('發現'),nature:t('自然'),political:t('政治')};
                bulletins.forEach(b => {
                    const severityIcon = {good:'🟢',info:'🔵',warning:'🟡',danger:'🔴'}[b.severity] || '⚪';
                    const categoryIcon = {security:'🛡️',trade:'📦',weather:'🌤️',social:'👥',health:'🏥',discovery:'🔍',nature:'🌿',political:'⚔️'}[b.category] || '📋';
                    const head = en ? (b.headline_en || t(b.headline || '')) : (b.headline || '');
                    const flavor = b.flavor ? t(b.flavor) : '';
                    E.news += `<div class="news-bulletin severity-${b.severity}">
                        <div class="news-header">
                            <span class="news-severity">${severityIcon}</span>
                            <span class="news-category">${categoryIcon} ${CATEGORY_LABELS[b.category] || t('消息')}</span>
                            ${Number.isFinite(b.days_remaining) ? `<span class="news-duration">${t('剩餘')}${b.days_remaining}${t('天')}</span>` : ''}
                        </div>
                        <div class="news-headline">${this._escapeHtml(head)}</div>
                        ${flavor && flavor !== head ? `<div class="news-flavor">${this._escapeHtml(flavor)}</div>` : ''}
                        ${b.published_time ? `<div class="news-time">${this._escapeHtml(b.published_time)}</div>` : ''}
                    </div>`;
                });
                E.news += '</div></div>';
            }
        }
        if (W('mods')) {
            // v7.3.0 生效中的影響(新聞、天氣帶來的加減成)→ 小鎮概況
            {
                const mods = (this.state.news || {}).active_modifiers || {};
                const modEntries = Object.entries(mods).filter(([k]) => k !== 'mood_modifier');
                if (modEntries.length) {
                    E.mods += `<div class="news-effects"><span class="news-effects-label">${t('生效中')}${t('：')}</span> `;
                    modEntries.forEach(([key, val]) => {
                        const effectLabels = {
                            food_production:t('食物產量'), mine_output:t('礦產產出'), trade_prices:t('交易價格'),
                            construction_speed:t('建設速度'), mood_bonus:t('心情加成'), crop_growth:t('作物生長'),
                            merchant_frequency:t('商人頻率'), farm_bonus:t('農作加成'), sell_bonus:t('售價加成'),
                            buy_bonus:t('買價優惠'), trade_bonus:t('貿易加成'), mining_bonus:t('採礦加成'),
                            gathering_bonus:t('採集加成'), research_bonus:t('研究加成'), skill_bonus:t('技能成長'),
                            guard_bonus:t('守衛戰力'), immigration_chance:t('移民機率'), departure_chance:t('離鄉機率'),
                            raid_chance:t('襲擊機率'), raid_severity:t('襲擊強度'), animal_raid_chance:t('野獸襲擊機率'),
                            plague_chance:t('疫病機率'), storm_chance:t('風暴機率'), drought_chance:t('乾旱機率'),
                            chain_chance:t('連鎖事件機率'), festival_chance:t('慶典機率'), merchant_chance:t('商隊機率'),
                            supply_shortage:t('物資短缺'), weather_farm_bonus:t('天氣農作影響'), weather_mood:t('天氣心情影響'),
                        };
                        const label = effectLabels[key] || key.replace(/_/g, ' ');
                        const cls = (typeof val === 'number' && val > 0) ? 'effect-positive' : (typeof val === 'number' && val < 0) ? 'effect-negative' : 'effect-neutral';
                        const flatKeys = { weather_mood: 1 };
                        const display = typeof val === 'number'
                            ? (flatKeys[key] ? (val > 0 ? '+' : '') + Math.round(val) : (val > 0 ? '+' : '') + Math.round(val * 100) + '%')
                            : (val ? t('是') : t('否'));
                        E.mods += `<span class="news-effect ${cls}">${label}: ${display}</span> `;
                    });
                    E.mods += '</div>';
                }
            }
        }
        if (W('aidaily') || W('happen')) {
            // --- AI 日報 ---
            const dailyNews = this.state.dailyNews || {};
            const papers = dailyNews.newspapers || [];
            if (papers.length > 0) {
                E.aidaily += t('<div class="news-section"><h4>🗞️ AI 日報</h4>');
                const display = papers.slice().reverse().slice(0, 10);
                for (let i = 0; i < display.length; i++) {
                    const paper = display[i];
                    const isExpanded = this._expandedNewspaper === paper.id;
                    const isLatest = i === 0;
                    E.aidaily += `<div class="news-card ${isExpanded ? 'news-expanded' : ''} ${isLatest ? 'news-latest' : ''}" data-action="view-newspaper" data-val="${paper.id}">`;
                    E.aidaily += `<div class="news-card-header">`;
                    E.aidaily += `<div class="news-card-issue">#${paper.id}</div>`;
                    E.aidaily += `<div class="news-card-meta">`;
                    E.aidaily += `<div class="news-card-date">${t('第 {y} 年{s}').split('{y}').join(paper.year).split('{s}').join(t(paper.season))} ${t('第 {d} 天').split('{d}').join(paper.day)}</div>`;
                    E.aidaily += `<div class="news-card-reporter">✍️ ${paper.reporter}${t('（')}${paper.reporterJob}${t('）')}</div>`;
                    E.aidaily += `</div>`;
                    E.aidaily += `<div class="news-card-toggle">${isExpanded ? '▲' : '▼'}</div>`;
                    E.aidaily += `</div>`;
                    if (!isExpanded && paper.content) {
                        const firstLine = paper.content.split('\n').find(l => l.trim().length > 0) || '';
                        const preview = clipText(firstLine, 41); // v6.43.6
                        E.aidaily += `<div class="news-card-preview">${this._escapeHtml(preview)}</div>`;
                    }
                    if (isExpanded) {
                        E.aidaily += `<div class="news-card-content">${this._escapeHtml(paper.content)}</div>`;
                        // v5.17.0 情境入口:把本期事件做成可點連結,直達當事人資訊卡或相關分頁
                        const pevs = paper.events || [];
                        if (pevs.length) {
                            E.aidaily += `<div class="news-card-events">`;
                            pevs.forEach((e, ei) => {
                                E.aidaily += `<button class="headline-row" data-action="news-goto" data-val="${paper.id}:${ei}">
                                    <span class="headline-ic">${this._newsCatIcon(e.category)}</span>
                                    <span class="headline-text">${this._escapeHtml(e.content)}</span>
                                    <span class="headline-go">›</span></button>`;
                            });
                            E.aidaily += `</div>`;
                        }
                        // v5.88.0 跨鎮專欄:其他鎮日報的要聞
                        if (Array.isArray(paper.crossTown) && paper.crossTown.length) {
                            E.aidaily += `<div class="news-card-events" style="margin-top:8px"><div class="muted-text" style="font-size:0.72rem;margin-bottom:4px">🐎 ${t('跨鎮專欄')}</div>`;
                            paper.crossTown.forEach(ct => { (ct.items || []).forEach(line => { E.aidaily += `<div class="headline-row" style="cursor:default"><span class="headline-ic">📰</span><span class="headline-text"><b>${this._escapeHtml(t(ct.town))}</b>｜${this._escapeHtml(t(line))}</span></div>`; }); });
                            E.aidaily += `</div>`;
                        }
                        // v4.0: Interactive newspaper reaction buttons (only for latest)
                        if (isLatest && !this._newsReacted && !this.world.observerMode) { // v6.83.0 觀察者不對日報表態
                            E.aidaily += `<div style="display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">`;
                            E.aidaily += `<button class="trade-btn" data-action="news-react" data-val="investigate" style="flex:1;font-size:0.72rem">🔍 ${t('調查')}</button>`;
                            E.aidaily += `<button class="trade-btn" data-action="news-react" data-val="support" style="flex:1;font-size:0.72rem">👍 ${t('支持')}</button>`;
                            E.aidaily += `<button class="trade-btn" data-action="news-react" data-val="ignore" style="flex:1;font-size:0.72rem">🤷 ${t('忽略')}</button>`;
                            E.aidaily += `</div>`;
                        }
                    }
                    E.aidaily += '</div>';
                }
                if (papers.length > 10) {
                    E.aidaily += `${t('<p class="muted-text" style="text-align:center;padding:4px 0;font-size:0.7rem">顯示最近 10 期（共 ')}${papers.length}${t(' 期）</p>')}`;
                }
                E.aidaily += '</div>';
            }

            const chains = this.state.active_chains || [];
            if (chains.length) {
                E.happen += t('<div class="chain-section"><h4>進行中的事件鏈</h4>');
                chains.forEach(c => { E.happen += `<div>${c.current_event}${t('（階段 ')}${c.stage}/${c.total_stages}${t('）')}</div>`; });
                E.happen += '</div>';
            }
            const travelling = this.state.travelling_agents || [];
            if (travelling.length) {
                E.happen += t('<div class="travelling-section"><h4>外出中的居民</h4>');
                travelling.forEach(_tw => { E.happen += `<div class="travelling-item">${t(_tw.name)} — ${_tw.reason}</div>`; });
                E.happen += '</div>';
            }
            const events = (this.state.recent_events || []).slice().reverse();
            if (events.length) { // v7.3.0 鎮上發生的事:合成一張卡、一行一件(以前一件一張大卡,還露出英文類別)
                const sevIc = { danger: '🔴', warning: '🟡', good: '🟢', positive: '🟢', info: '🔵' };
                E.happen += `<div class="news-section"><h4>📌 ${t('鎮上發生的事')} <span class="pp-count">${events.length}</span></h4>`;
                events.slice(0, 12).forEach(evt => { E.happen += `<div class="pp-tier-line">${sevIc[evt.severity] || '•'} <b>${t(evt.name)}</b>${t('：')}${evt.description} <small>${evt.time || ''}</small></div>`; });
                E.happen += '</div>';
            }
        }
        if (W('festival')) {
            // === Festivals ===
            const festivals = this.state.festivals || {};
            if (festivals.activeFestival) {
                const f = festivals.activeFestival;
                E.festival += `<div class="festival-section"><h4>${f.icon} ${t(f.name)}${t('進行中！')}</h4>
                    <div style="padding:4px 8px;color:var(--text-secondary)">${f.description}</div>${this._festivalSponsorHtml()}</div>`; // v6.15.0 贊助列
            }
            if (festivals.activeQuest) {
                const q = festivals.activeQuest;
                const pct = Math.round((q.progress / q.goal) * 100);
                E.festival += `${t('<div class="quest-section"><h4>🎯 節日任務：')}${t(q.name)}</h4>
                    <div style="padding:4px 8px">${q.desc}</div>
                    <div class="quest-progress"><div class="quest-bar" style="width:${pct}%"></div><span>${pct}%</span></div>${festivals.activeFestival ? '' : this._festivalSponsorHtml()}</div>`; // v6.15.0 前夕的贊助列(節慶開始後只在上面那塊顯示)
            }

        }
        if (W('factions')) {
            // === Factions ===
            const factionData = this.state.factions || {};
            const factionList = Object.values(factionData.factions || {});
            if (factionList.length) {
                E.factions += t('<div class="faction-section"><h4>👥 派系 / 社交圈</h4>');
                factionList.forEach(f => {
                    const memberNames = f.members.map(id => {
                        const a = this.state.agents[id];
                        return a ? a.name : '?';
                    }).join('、');
                    const cohesionCls = f.cohesion > 70 ? 'cohesion-high' : f.cohesion < 30 ? 'cohesion-low' : '';
                    let relHtml = '';
                    if (f.rivalFactionId) {
                        const rival = factionList.find(x => x.id === f.rivalFactionId);
                        if (rival) relHtml += `${t('<span class="faction-rival">⚔️ 敵對：')}${t(rival.name)}</span> `;
                    }
                    if (f.allyFactionId) {
                        const ally = factionList.find(x => x.id === f.allyFactionId);
                        if (ally) relHtml += `${t('<span class="faction-ally">🤝 結盟：')}${t(ally.name)}</span>`;
                    }
                    E.factions += `<div class="faction-card">
                        <div class="faction-header">${f.icon} <strong>${t(f.name)}</strong>
                            <span class="faction-cohesion ${cohesionCls}${t('">團結度：')}${f.cohesion > 70 ? t('緊密') : f.cohesion < 30 ? t('渙散') : t('普通')}</span></div>
                        <div class="faction-members">${memberNames}</div>
                        ${relHtml ? '<div class="faction-relations">' + relHtml + '</div>' : ''}</div>`;
                });
                E.factions += '</div>';
            }

        }
        if (W('explore')) {
            // === Exploration ===
            const exploreData = this.state.exploration || {};
            const discovered = Object.entries(exploreData.discoveredZones || {});
            const expeditions = exploreData.activeExpeditions || [];
            if (discovered.length || expeditions.length) {
                E.explore += t('<div class="explore-section"><h4>🗺️ 探索區域</h4>');
                if (expeditions.length) {
                    E.explore += t('<div class="expedition-active"><strong>進行中的探險：</strong>');
                    expeditions.forEach(e => {
                        const ticksLeft = Math.max(0, e.returnTick - (this.state.tick || 0));
                        const daysLeft = Math.ceil(ticksLeft / 96);
                        E.explore += `<div class="expedition-item">${e.zoneIcon} ${e.zoneName} — ${e.agentNames.join(t('、'))} (${daysLeft}${t('天後返回)</div>')}`;
                    });
                    E.explore += '</div>';
                }
                discovered.forEach(([zoneId, info]) => {
                    const zoneDef = this._getExplorationZone(zoneId);
                    if (!zoneDef) return;
                    const canSend = !expeditions.some(e => e.zoneId === zoneId);
                    // v5.35.7 移除只列前 8 位的限制:全部不在探險中的村民都可選
                    const availableNpcs = Object.entries(this.state.agents)
                        .filter(([id, a]) => !a.is_player && a.activity_label !== t('探險中') && id !== 'player');
                    E.explore += `<div class="explore-zone">
                        <div class="zone-header">${zoneDef.icon} <strong>${t(zoneDef.name)}</strong>
                            <span class="zone-diff">${t('難度：')}${'⭐'.repeat(zoneDef.difficulty)}</span></div>
                        <div class="zone-desc">${zoneDef.description}</div>
                        <div class="zone-stats">${t('已探索')} ${info.timesExplored} ${t('次')}</div>
                        ${this.world.observerMode ? (canSend ? `<div class="zone-stats">${t('要不要派人探險由村民提案決定')}</div>` : t('<div class="zone-busy">探險進行中...</div>')) : canSend ? `<div class="zone-send">
                            <select class="explore-select" id="explore-select-${zoneId}" multiple size="3">
                                ${availableNpcs.map(([id, a]) => `<option value="${id}">${t(a.name)} (${a.job?.title||t('無')})</option>`).join('')}
                            </select>
                            <button class="explore-btn" data-action="send-expedition" data-val="${zoneId}">${t('派遣探險')}</button>
                        </div>` : t('<div class="zone-busy">探險進行中...</div>')}
                    </div>`;
                });
                E.explore += '</div>';
            }

        }
        if (W('life')) {
            // === Graveyard ===
            const lifecycle = this.state.lifecycle || {};
            const graveyard = lifecycle.graveyard || [];
            const births = lifecycle.births || [];
            if (graveyard.length || births.length) {
                E.life += '<div class="lifecycle-section">';
                if (births.length) {
                    E.life += t('<h4>🎒 近期出生</h4>');
                    births.slice(-5).reverse().forEach(b => {
                        E.life += `<div class="birth-item">${t(b.name)} — ${b.parentNames.join(t('與'))}${t('的孩子 <span class="birth-time">')}${b.birthTime}</span></div>`;
                    });
                }
                if (graveyard.length) {
                    E.life += t('<h4>⚰️ 墓園</h4>');
                    graveyard.slice(-10).reverse().forEach(g => {
                        E.life += `<div class="grave-item">
                            <div class="grave-name">${t(g.name)}（${g.age}${t('歲）')}</div>
                            <div class="grave-info">${g.job} — ${g.deathCause}</div>
                            <div class="grave-epitaph">${g.epitaph}</div>
                            <div class="grave-time">${g.deathTime}</div></div>`;
                    });
                }
                E.life += '</div>';
            }

        }
        return E;
    },
    // v7.3.0 政令與議案(從舊「事件」分頁搬來,議員名單已在城鎮等級區塊,這裡只列政令與決議)
    _councilHtml() {
        const c = this.state?.council; if (!c || !c.formed) return '';
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const dec = c.activeDecrees || [], log = (c.proposalLog || []).slice(-5).reverse(), p = c.pendingProposal;
        if (!dec.length && !log.length && !p) return '';
        let h = `<div class="pp-issues pp-council-box"><h4 class="pp-h">📋 ${t('政令與議案')}${dec.length ? ` <span class="pp-count">${dec.length}</span>` : ''}</h4>`;
        for (const d of dec) h += `<div class="pp-tier-line">📋 ${esc(t(d.title))}</div>`;
        if (p) h += `<div class="pp-tier-line">🗳️ ${esc(p.title)} <small>${esc(t(p.proposerName || ''))} · 👍 ${p.forCount} · 👎 ${p.againstCount} · ${t('剩餘')} ${p.daysLeft} ${t('天投票')}</small></div>`;
        if (log.length) h += `<div class="pp-issue-hint">${t('近期決議')}${t('：')}${log.map(x => `${x.passed ? '✅' : '❌'} ${esc(x.title)}(${x.forVotes}:${x.againstVotes})`).join(' ')}</div>`;
        return h + '</div>';
    },
    // v7.4.0 村民卡:五個部位、病痛、輔具、排隊移植
    _renderBody(aid) {
        const w = this.world, a = w?.agents?.[aid]; if (!a || a.isPlayer || typeof HEALTH === 'undefined' || !w.health) return '';
        const v = HEALTH.agentView(w, a); const sevW = ['', t('輕'), t('中'), t('重')];
        const AIDN = { glasses: '👓 ' + t('眼鏡'), crutch: '🦯 ' + t('拐杖'), arm: '🦾 ' + t('義手'), leg: '🦿 ' + t('義腿'), heart: '❤️‍🔥 ' + t('人工心臟'), lung: '🫁 ' + t('人工肺') };
        const bar = (x) => { const c = x.eff >= 70 ? 'var(--positive)' : x.eff >= 40 ? 'var(--warning, #e8b030)' : 'var(--negative)'; return `<div class="hb-row"><span>${HEALTH.PI[x.p]} ${t(HEALTH.PN[x.p])}</span><i><b style="width:${x.eff}%;background:${c}"></b></i><em>${x.eff}${x.eff !== x.v ? `<small>(${x.v})</small>` : ''}</em></div>`; };
        let h = `<div class="detail-section body-section"><h3>🩺 ${t('身體')}</h3>${v.parts.map(bar).join('')}`;
        if (v.ails.length) h += `<div class="hb-tags">${v.ails.map(x => `<span class="hb-tag sev${x.s}">${HEALTH.PI[x.p]} ${t(HEALTH.PN[x.p])}${t(HEALTH.KN[x.k])}・${sevW[x.s]}</span>`).join('')}</div>`;
        if (v.aids.length) h += `<div class="hb-tags">${v.aids.map(k => `<span class="hb-tag aid">${AIDN[k] || k}</span>`).join('')}</div>`;
        if (v.queued) h += `<div class="hb-note">⏳ ${t('排隊等移植中')}</div>`;
        try { const g = typeof MYTH !== 'undefined' ? MYTH.geneOf(w, a) : null; if (g) { const G = MYTH.GENES[g]; h += `<div class="hb-gene"><b>${G.icon} ${t('神裔')}${t('：')}${t(G.name)}</b><div>✨ ${t(G.good)}</div><div>⚠️ ${t(G.bad)}</div></div>`; } } catch (e) {} // v7.5.0
        try { const m = typeof MYTHSOC !== 'undefined' ? MYTHSOC.agentView(w, a) : null; if (m && w.mythsoc) { const bits = []; if (m.label) bits.push(`🧿 ${t(m.label)}`); if (m.group) bits.push(m.group === 'pure' ? `🛡️ ${t('純人派')}` : `🧬 ${t('神裔會')}`); if (m.half) bits.push(`🌗 ${t('混血神裔')}`); if (m.elite) bits.push(`🏛️ ${t('神裔世家')}`); if (bits.length) h += `<div class="hb-tags">${bits.map(x => `<span class="hb-tag myth">${x}</span>`).join('')}</div>`; } } catch (e) {} // v7.6.0
        return h + '</div>';
    },
    // v7.4.0 小鎮概況的健康卡
    _healthCardHtml() {
        const w = this.world; if (!w || typeof HEALTH === 'undefined' || !w.observerMode) return '';
        const v = HEALTH.view(w); const esc = (x) => this._escapeHtml(String(x ?? ''));
        const RN = { ok: '✅ ' + t('手術成功'), part: '🟡 ' + t('部分恢復'), fail: '❌ ' + t('手術失敗'), died: '⚰️ ' + t('過世'), tx: '🫀 ' + t('移植成功'), reject: '😞 ' + t('排斥') };
        let h = `<div class="econ-section health-section"><h3>🩺 ${t('健康')}${v.patients.length ? ` <span class="pp-count">${v.patients.length}</span>` : ''}${v.flu ? ` <small>🤧 ${t('風寒流行中')}</small>` : ''}</h3>`;
        h += `<div class="market-meta">${t('病人')} ${v.patients.length} · ${t('身體有殘疾')} ${v.disabled} · ${t('等移植')} ${v.queue.length} · ${t('可用器官')} ${v.bank}${v.avgLife ? ` · ${t('近來過世平均')} ${v.avgLife} ${t('歲')}` : ''}</div>`;
        h += `<div class="market-meta">${t('看診')} ${v.st.treat || 0} · ${t('手術')} ${v.st.ops || 0}${t('（')}${t('成功')} ${v.st.ok || 0} / ${t('失敗')} ${v.st.fail || 0} / ${t('死亡')} ${v.st.died || 0}${t('）')} · ${t('移植')} ${v.st.tx || 0} · ${t('打架')} ${v.st.fights || 0}</div>`;
        h += `<div class="market-meta">${v.surgery ? '🏥 ' + t('醫院可以開刀') : '⛔ ' + t('還不能開刀（要醫院＋外科醫學）')} · ${v.tx.organ ? t('心肺也能移植') : v.tx.limb ? t('眼手腳可以移植') : t('還不能移植')} · ${v.medaid ? '🏛️ ' + t('公費醫療補助中') : t('沒有公費醫療')}${v.st.bribes ? ` · 💰 ${t('插隊紅包')} ${v.st.bribes}` : ''}</div>`;
        if (v.patients.length) h += `<div class="hb-tags">${v.patients.slice(0, 8).map(p => `<button type="button" class="hb-tag sev${Math.max(...p.ails.map(x => x.s))}" data-action="select-agent" data-val="${esc(p.id)}">${esc(p.name)} ${p.ails.map(x => HEALTH.PI[x.p]).join('')}</button>`).join('')}</div>`;
        if (v.log.length) h += `<div class="muted-text" style="font-size:0.72rem;margin-top:4px">${v.log.map(x => `${RN[x[2]] || x[2]} ${esc(t(x[1]))}${t('（')}${t(HEALTH.PN[x[3]] || '')}${t('）')}`).join(' · ')}</div>`;
        return h + '</div>';
    },
    // v7.5.0 小鎮概況:神話基因卡(研究到神話基因譜或鎮上有神裔才出現)
    _mythCardHtml() {
        const w = this.world; if (!w || typeof MYTH === 'undefined' || !w.observerMode) return '';
        const v = MYTH.view(w); if (!v.open && !v.carriers.length) return ''; const esc = (x) => this._escapeHtml(String(x ?? ''));
        let h = `<div class="econ-section myth-section"><h3>🧿 ${t('神話基因')}${v.carriers.length ? ` <span class="pp-count">${v.carriers.length}</span>` : ''}${v.ban ? ` <small>🚫 ${t('已禁止')}</small>` : ''}</h3>`;
        h += `<div class="market-meta">${t('編輯')} ${v.st.edits || 0} · ${t('失敗')} ${v.st.fails || 0} · ${t('死亡')} ${v.st.deaths || 0} · ${t('傷人')} ${v.st.attacks || 0} · ${t('吸血')} ${v.st.bites || 0} · ${t('失火')} ${v.st.fires || 0} · ${t('復活')} ${v.st.revived || 0} · ${t('驅逐')} ${v.st.exiled || 0}${v.st.under ? ` · 🕳️ ${t('地下診所')} ${v.st.under}` : ''}</div>`;
        if (v.carriers.length) h += `<div class="hb-tags">${v.carriers.map(c => `<button type="button" class="hb-tag${c.mad ? ' sev3' : ''}" data-action="select-agent" data-val="${esc(c.id)}">${c.icon} ${esc(c.name)}</button>`).join('')}</div>`;
        else h += `<div class="muted-text" style="font-size:0.72rem">${t('還沒有人做基因編輯。要很有錢的人才付得起。')}</div>`;
        try { if (typeof MYTHSOC !== 'undefined' && w.mythsoc && v.carriers.length) h += this._mythSocHtml(MYTHSOC.view(w)); } catch (e) {} // v7.6.0
        return h + '</div>';
    },
    // v7.7.0 錢從哪來、往哪去(近 30 天):外地流入與流出、其他、淨變化、人均
    _moneyCardHtml() {
        const w = this.world; if (!w || typeof MONEY === 'undefined' || !w.observerMode || !w.money) return '';
        const v = MONEY.view(w); if (v.days < 2) return ''; const fmt = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString()}`;
        const row = (c, n) => `<div class="mf-row"><span>${t(v.label(c))}</span><b class="${n >= 0 ? 'mf-in' : 'mf-out'}">${fmt(n)}</b></div>`;
        let h = `<div class="econ-section money-section"><h3>💱 ${t('錢從哪來、往哪去')} <small>${t('近 {n} 天').replace('{n}', v.days)}</small></h3>`;
        h += `<div class="market-meta">${t('全鎮的錢')} ${v.total.toLocaleString()} · ${t('每人平均')} ${v.per}${v.perOld != null ? ` ${t('（')}${t('{n} 天前').replace('{n}', v.days)} ${v.perOld}${t('）')}` : ''}</div>`;
        h += `<div class="mf-grid"><div><div class="mf-h">⬇️ ${t('外地流入')}</div>${v.ins.length ? v.ins.map(([c, n]) => row(c, n)).join('') : `<div class="muted-text mf-none">${t('沒有')}</div>`}</div>`;
        h += `<div><div class="mf-h">⬆️ ${t('流出鎮外')}</div>${v.outs.length ? v.outs.map(([c, n]) => row(c, n)).join('') : `<div class="muted-text mf-none">${t('沒有')}</div>`}</div></div>`;
        if (Math.abs(v.other) >= 1) h += row('other', v.other);
        h += `<div class="mf-row mf-net"><span>${t('淨變化')}</span><b class="${v.net >= 0 ? 'mf-in' : 'mf-out'}">${fmt(v.net)}</b></div>`;
        return h + '</div>';
    },
    // v7.6.0 神裔社會:看法分布、派系、宗教立場、平權令、階級與職業、獵人隊
    _mythSocHtml(s) {
        const esc = (x) => this._escapeHtml(String(x ?? '')); const tot = s.dist.fear + s.dist.mid + s.dist.ok || 1; const pc = (n) => Math.round(n / tot * 100);
        let h = `<div class="ms-block"><div class="ms-bar" role="img" aria-label="${esc(t('鎮民對神裔的看法'))}"><span class="ms-fear" style="width:${pc(s.dist.fear)}%"></span><span class="ms-mid" style="width:${pc(s.dist.mid)}%"></span><span class="ms-ok" style="width:${pc(s.dist.ok)}%"></span></div>`;
        h += `<div class="market-meta">😨 ${t('怕神裔')} ${s.dist.fear} · 😐 ${t('沒意見')} ${s.dist.mid} · 🤝 ${t('支持')} ${s.dist.ok}${s.rights ? ` · ✅ ${t('平權令')}` : ''}</div>`;
        const grp = (g, icon, name) => g ? `<button type="button" class="hb-tag myth" data-action="select-agent" data-val="${esc(g.lid)}">${icon} ${t(name)} ${g.n} ${t('人')}${t('（')}${esc(g.leader)}${t('帶頭')}${t('）')}</button>` : '';
        const gs = grp(s.pure, '🛡️', '純人派') + grp(s.guild, '🧬', '神裔會'); if (gs) h += `<div class="hb-tags">${gs}</div>`;
        if (s.rels.length) h += `<div class="market-meta">⛪ ${s.rels.map(r => `${esc(r.name)}${t('：')}${r.cult ? `✨ ${t('崇拜')}${esc(r.saint)}` : r.st === 'blas' ? t('視為褻瀆') : t('視為神選')}`).join(' · ')}</div>`;
        const JN = (k) => { try { return JOB_DEFINITIONS[k]?.title || k; } catch (e) { return k; } };
        const jobs = Object.entries(s.jobs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${esc(JN(k))} ${n}`).join('、');
        h += `<div class="market-meta">💰 ${t('神裔平均')} ${s.wealth.c} · ${t('一般人')} ${s.wealth.o} · 🏛️ ${t('士紳以上')} ${s.gentry.c}/${s.gentry.cn} ${t('對')} ${s.gentry.o}/${s.gentry.on}${s.elite ? ` · ${t('神裔世家')} ${s.elite}` : ''}${s.half ? ` · 🌗 ${t('混血')} ${s.half}` : ''}</div>`;
        if (jobs) h += `<div class="market-meta">🛠️ ${t('神裔的工作')}${t('：')}${jobs}${s.st.night ? ` · 🌙 ${t('夜班津貼')} ${Math.round(s.st.night)}` : ''}</div>`;
        const st = s.st; const bits = [[st.badmouth, '講壞話'], [st.fired, '被辭退'], [st.outcast, '逐出教門'], [st.boycott, '拒絕出席婚禮'], [st.panic, '恐慌報導'], [st.fair, '平反報導'], [st.deeds, '幫上忙']].filter(x => x[0]).map(x => `${t(x[1])} ${x[0]}`);
        if (bits.length) h += `<div class="market-meta">${bits.join(' · ')}</div>`;
        if (s.hunts.length) h += `<div class="muted-text" style="font-size:0.72rem;margin-top:4px">🔦 ${t('獵人隊')}${t('：')}${s.hunts.map(x => `${esc(x.sus)} ${x.right ? '🎯 ' + t('抓對了') : x.wrong ? '⚖️ ' + t('冤案') : '❔ ' + t('還不知道')}`).join(' · ')}</div>`;
        return h + '</div>';
    },
});
