// RimTown - app-panels.js：從 app.js 拆出的 側欄分頁：技能、自訂村民與外觀編輯、結局、城鎮身分、每日焦點、故事動態、居民列表、村民詳情、設定、日誌、事件（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
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

        this._lookDraft = {}; this._lookTarget = null; // v5.89.0 外觀草稿
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
        // v5.89.0 外觀
        html += `<div class="setting-group"><label>🎨 ${t('外觀')}</label><div id="look-body">${this._lookEditorBody()}</div></div>`;

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
    // v5.89.0 村民自訂外觀:資訊卡頭像、改外觀面板(也給建立村民表單用)
    // ============================================================
    _agentAvatarImg(agentId, agentState) {
        try {
            const live = this.world?.agents?.[agentId];
            const url = this.tileMap?.renderAvatarDataURL?.(agentState?.job?.key || live?.job?.key, agentState?.gender || live?.gender, agentState?.name || live?.name, live?.look || null);
            return url ? `<img src="${url}" alt="" style="width:32px;height:56px;image-rendering:pixelated;flex:none">` : '';
        } catch (e) { return ''; }
    },
    _lookPreviewArgs() {
        if (this._lookTarget) { const ag = this.world?.agents?.[this._lookTarget]; return ag ? [ag.job?.key, ag.gender, ag.name] : ['farmer', 'male', 'x']; }
        const job = document.getElementById('custom-npc-job')?.value || 'farmer';
        const gender = document.querySelector('input[name="custom-npc-gender"]:checked')?.value || 'male';
        return [job, gender, document.getElementById('custom-npc-name')?.value || 'new'];
    },
    _lookEditorBody() {
        const d = this._lookDraft || {};
        const look = Object.keys(d).length ? d : null;
        const [job, gender, name] = this._lookPreviewArgs();
        let url = ''; try { url = this.tileMap?.renderAvatarDataURL?.(job, gender, name, look) || ''; } catch (e) {}
        const sw = (k, i, color, cur) => `<button type="button" class="look-opt" data-action="look-set" data-val="${k}:${i}" title="${i}" style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid ${cur ? '#fff' : 'rgba(255,255,255,0.15)'};cursor:pointer;padding:0"></button>`;
        const chip = (k, i, label, cur) => `<button type="button" class="look-opt" data-action="look-set" data-val="${k}:${i}" style="font-size:0.72rem;padding:3px 8px;border-radius:12px;border:1px solid ${cur ? 'var(--accent)' : 'rgba(255,255,255,0.15)'};background:${cur ? 'var(--accent)' : 'transparent'};color:${cur ? '#fff' : 'var(--text-primary)'};cursor:pointer">${label}</button>`;
        const row = (label, inner) => `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0"><span style="font-size:0.75rem;color:var(--text-secondary);width:40px;flex:none">${label}</span>${inner}</div>`;
        const skins = (typeof LOOK_SKINS !== 'undefined' ? LOOK_SKINS : []).map((c, i) => sw('skin', i, c, d.skin === i)).join('');
        const hairs = [t('短髮'), t('長髮'), t('馬尾'), t('齊瀏海'), t('平頭'), t('捲髮')].map((l, i) => chip('hair', i, l, d.hair === i)).join('');
        const hcs = (typeof LOOK_HAIR_COLORS !== 'undefined' ? LOOK_HAIR_COLORS : []).map((c, i) => sw('hairColor', i, c, d.hairColor === i)).join('');
        const shirts = chip('shirt', 'null', t('職業預設'), d.shirt == null) + (typeof LOOK_SHIRTS !== 'undefined' ? LOOK_SHIRTS : []).map((c, i) => sw('shirt', i, c, d.shirt === i)).join('');
        const accs = [t('無'), t('帽子'), t('眼鏡'), t('圍巾')].map((l, i) => chip('acc', i, l, (d.acc || 0) === i)).join('');
        return `<div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:none;background:rgba(0,0,0,0.25);border-radius:8px;padding:6px">${url ? `<img src="${url}" alt="" style="width:48px;height:84px;image-rendering:pixelated;display:block">` : ''}</div>
            <div style="flex:1;min-width:0">${row(t('膚色'), skins)}${row(t('髮型'), hairs)}${row(t('髮色'), hcs)}${row(t('上衣'), shirts)}${row(t('配件'), accs)}</div></div>`;
    },
    _openLookEditor(agentId) {
        const ag = this.world?.agents?.[agentId]; if (!ag || ag.isPlayer) return;
        document.getElementById('look-modal')?.remove();
        this._lookDraft = ag.look ? { ...ag.look } : {}; this._lookTarget = agentId;
        const html = `<div id="look-modal" class="modal" style="display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000">
            <div class="modal-content" style="max-width:440px;width:92%;max-height:85vh;overflow-y:auto;padding:20px">
            <h2 style="margin-top:0">🎨 ${t('改外觀')} — ${t(ag.name)}</h2>
            <div id="look-body">${this._lookEditorBody()}</div>
            <div class="modal-buttons" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                <button data-action="look-random">🎲 ${t('隨機')}</button>
                <button data-action="look-reset">${t('恢復預設')}</button>
                <button class="btn-accent" data-action="look-save">${t('儲存外觀')}</button>
                <button data-action="look-cancel">${t('取消')}</button>
            </div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    _setLookDraft(val) {
        const [k, v] = String(val || '').split(':'); if (!k) return;
        this._lookDraft = this._lookDraft || {};
        if (v === 'null' || v === undefined) delete this._lookDraft[k]; else this._lookDraft[k] = parseInt(v, 10) || 0;
        const body = document.getElementById('look-body'); if (body) body.innerHTML = this._lookEditorBody();
    },
    _randomLookDraft() {
        const r = (n) => Math.floor(Math.random() * n);
        this._lookDraft = { skin: r(6), hair: r(6), hairColor: r(9), acc: r(4) };
        if (Math.random() < 0.6) this._lookDraft.shirt = r(8);
        const body = document.getElementById('look-body'); if (body) body.innerHTML = this._lookEditorBody();
    },
    _applyLookDraft(mode) {
        const ag = this.world?.agents?.[this._lookTarget];
        if (ag) {
            ag.look = mode === 'reset' ? null : (this._lookDraft && Object.keys(this._lookDraft).length ? { ...this._lookDraft } : null);
            if (this.tileMap) { this.tileMap._colorCache = {}; this.tileMap._avatarCache = {}; }
            this.state = this.world.getState();
            this._showCornerNotice?.({ icon: '🎨', title: t('外觀已更新'), name: t(ag.name), desc: '' });
            try { this.renderSidebar(); } catch (e) {}
        } else if (mode === 'reset') { this._lookDraft = {}; const body = document.getElementById('look-body'); if (body) body.innerHTML = this._lookEditorBody(); return; }
        document.getElementById('look-modal')?.remove();
    },

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
        const look = this._lookDraft && Object.keys(this._lookDraft).length ? { ...this._lookDraft } : null; // v5.89.0
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
        document.body.appendChild(wrapper);
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
            this.world.logMessage('system', `🔄 ${msg}`);
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
                    rows.push({ tick: m.tick || 0, time: m.timeStr || '', who: own.name, text: m.content, cat: m.category });
                }
            }
        }
        (w.dramaArchive || []).forEach((s, i) => {
            if ((s.aName === a.name && s.bName === b.name) || (s.aName === b.name && s.bName === a.name)) {
                rows.push({ tick: s.tick || 0, time: `${t('第')}${s.year}${t('年 ')}${t(s.season)} ${t('第')}${s.day}${t('天')}`, who: '', text: `${s.icon || '🎭'} ${s.title}`, drama: i });
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
                ? `<button data-rt-drama="${r.drama}" style="background:none;border:none;color:#ffd166;cursor:pointer;padding:0;font-size:0.74rem;text-align:left">📺 ${this._escapeHtml(r.text)}（${t('點我重播')}）</button>`
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
        document.body.appendChild(ov);
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
                this._showCornerNotice({ icon: '🔔', title: `${t('你追蹤的')}${t(npc.name)}`, name: '', desc: String(fresh.content).slice(0, 48) });
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
            <div class="headlines-title"><span>📺 ${t('第')}${(day.year - 1) * 60 + day.day}${t('集')}·${this.world?.townName || t('邊境鎮')}${t('日常')}</span>
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
                    out.push({ icon: '💢', text: `${t(a.name)} × ${t(b.name)} — ${t('絕交中')}${medN ? `（${t('你調停到')} ${medN}/2）` : ''}`, val: key });
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
                <span>🗞️ ${t('今日頭條')} <span class="headlines-sub">${t('第')}${latest.year}${t('年 ')}${latest.season}${t(' 第')}${latest.day}${t('天')}</span></span>
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
        const popCount = Object.keys(this.state.agents || {}).length;
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? `（+${travelCount}${t(' 外出）')}` : '';
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
        html += this._renderDailyFocus();
        // v5.45.0 昨日回響:你昨天的舉動在小鎮發酵了什麼(蝴蝶效應回饋)
        html += this._renderDailyEcho();
        // v5.45.0 首頁分階段減壓:剛開村只看焦點+回響+居民;故事流(成長10)與頭條(成長20)隨小鎮成長逐步展開
        const prosHome = this.state?.prosperity?.prosperity || 0;
        // v5.31.0 今天的故事:記憶流/反思/名場面/AI 對話的精華,首頁第一層
        if (prosHome >= 10) html += this._renderStoryFeed();
        // v5.17.0 今日頭條:日報成為首頁第一眼看到的內容,點頭條直達當事人/相關分頁
        if (prosHome >= 20) html += this._renderTownHeadlines();
        // Player card at top
        const playerAgent = this.state.agents['player'];
        if (playerAgent) {
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
            const sameLoc = player && player.current_location === agent.current_location;
            const genderIcon = agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : '';
            html += `<div class="resident-card ${isSelected?'selected':''}" data-action="select-agent" data-val="${aid}">
                <div class="resident-header">
                    <span class="resident-name"><span class="mood-indicator mood-${agent.mood_description}"></span>${genderIcon} ${t(agent.name)}${sameLoc?t('<span class="nearby-badge">附近</span>'):''}</span>
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
                    : plan.goals.map(g => `<li>${g}</li>`).join('')}</ol>
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
            <div class="detail-section"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${this._agentAvatarImg(this.selectedAgent, agent)}<h3 style="margin:0;flex:1">${t(agent.name)}（${agent.gender_label === t('男') ? '♂' : agent.gender_label === t('女') ? '♀' : ''}${agent.gender_label} · ${agent.age}${t('歲）')}</h3>${this.selectedAgent !== 'player' ? `<button class="trade-btn" data-action="edit-look" data-val="${this.selectedAgent}" style="font-size:0.7rem">🎨 ${t('改外觀')}</button>` : ''}</div>
                <p style="font-size:0.8rem;color:var(--text-secondary)">${agent.job?.title||(this.selectedAgent==='player'?t('旅人'):t('無業'))} | ${agent.mood_label||agent.mood_description}</p>
                <p style="font-size:0.75rem;margin-top:6px">${t(personality.background||'')}</p>${chatBtn}</div>
            <div class="detail-section"><h3>${t('性格')}</h3>
                ${(personality.traits||[]).map(t=>`<span class="trait-tag">${TRAIT_LABELS[t]||t}</span>`).join('')}
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
            <div class="detail-section"><h3>${t('人際關係（')}${relationships.length}）</h3>
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
                    return `<div class="relationship-item${r.status?' rel-has-status':''}"><span>${r.target_name} ${badge}${crushIcon}</span>
                    <span style="color:${r.affinity>0?'var(--positive)':r.affinity<0?'var(--negative)':'var(--text-muted)'}">${r.type}${romHeart}</span></div>`;
                }).join('')}</div>
            ${this._renderAgentFactions(this.selectedAgent)}
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
        html += `<div class="detail-section"><h3>${t('住戶')}（${residents.length}）</h3>`;
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
    renderSettings(container) {
        // Preserve unsaved form values from existing DOM inputs (prevents
        // renderSidebar() calls from wiping user-typed/pasted API keys)
        const existingSpeed = document.getElementById('settings-tab-speed');
        const speed = existingSpeed ? existingSpeed.value : (localStorage.getItem('sim_speed') || '2000');
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
        html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">${t('模擬速度')}</label>
            <select id="settings-tab-speed" style="width:100%;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem">
                <option value="3000"${speed==='3000'?' selected':''}>${t('慢速（3秒）')}</option>
                <option value="2000"${speed==='2000'?' selected':''}>${t('正常（2秒）')}</option>
                <option value="1000"${speed==='1000'?' selected':''}>${t('快速（1秒）')}</option>
                <option value="500"${speed==='500'?' selected':''}>${t('極快（0.5秒）')}</option>
            </select>
        </div>`;
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">${t('速度倍率')}</label>
            <div class="speed-controls">
                ${[1, 1.5, 2, 3].map(s => `<button class="btn-speed${currentMultiplier===s?' active':''}" data-action="settings-speed-mult" data-val="${s}">${s}x</button>`).join('')}
            </div>
        </div>`;
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="trade-btn" data-action="settings-toggle-pause">${paused ? '▶ ' + t('繼續') : '⏸ ' + t('暫停')}</button>
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
        const isServerAI = this.llmClient?.provider === 'server';
        const aiLabel = isServerAI ? t('AI:小鎮內建') : (aiConnected ? 'AI:' + this.llmClient.provider : t('AI:未連接'));
        html += t('<div class="econ-section"><h3>🤖 AI 語言模型</h3>');
        html += `<div style="margin-bottom:8px"><span class="llm-status ${aiConnected ? 'connected' : 'disconnected'}">${aiLabel}</span></div>`;
        // v5.65.0 AI 全面內建:金鑰由伺服器統一保管,玩家端沒有任何可填的金鑰欄位
        html += `<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:8px">${isServerAI
            ? t('🏘️ 內建小鎮 AI 已啟用，不需填任何金鑰（登入每日 100 則）') + ' ' + t('所有 AI 金鑰由小鎮伺服器統一保管，你不需要、也不會看到任何金鑰欄位。') + ' ' + t('智慧分流：你與村民的對話、劇情名場面優先走 Groq 免費額度；行程／反思／背景對話走付費主渠道；任一邊故障自動切到另一邊。')
            : t('此站沒有內建 AI 代理端點，村民對話走內建模擬')}</div>`;
        // v5.73.0 AI 對話語言:跟隨介面 / 繁體中文 / English(村民台詞、行程、反思、日報)
        {
            const existingDl = document.getElementById('settings-tab-dialoglang');
            let dl = 'auto'; try { dl = existingDl ? existingDl.value : (localStorage.getItem('rimtown_dialogue_lang') || 'auto'); } catch (e) {}
            const optSel = (v) => dl === v ? ' selected' : '';
            html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">🗣️ ${t('AI 對話語言')}</label>
            <select id="settings-tab-dialoglang" style="padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px">
                <option value="auto"${optSel('auto')}>${t('跟隨介面語言')}</option>
                <option value="zh"${optSel('zh')}>繁體中文</option>
                <option value="en"${optSel('en')}>English</option>
            </select>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">${t('村民對話、行程、反思與日報由 AI 生成時使用的語言，不影響介面文字。')}</div></div>`;
        }
        // v5.29.0 混合成本控制:NPC 之間的對話只有在玩家附近才用 LLM,並受每日額度限制
        const existingBudget = document.getElementById('settings-tab-npcbudget');
        const npcBudget = existingBudget ? existingBudget.value : (localStorage.getItem('rimtown_npc_llm_budget') ?? '');
        const npcUsed = this.world?.npcLlmUsedToday || 0;
        html += `<div class="setting-group" style="margin-bottom:8px">
            <label style="font-size:0.82rem;color:var(--text-secondary)">💰 ${t('NPC 每日 AI 額度')}</label>
            <div style="display:flex;gap:6px;align-items:center">
                <input type="number" id="settings-tab-npcbudget" value="${this._escapeHtml(String(npcBudget))}" placeholder="${t('無上限')}" min="0" max="9999" style="width:80px;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem">
                <span style="font-size:0.72rem;color:var(--text-muted)">${t('今日已用')} ${npcUsed} ${t('次')}</span>
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:3px">${t('留空＝無上限。村民的每日行程、你附近的村民對話與夜間反思會呼叫 AI；遠處對話走內建模擬並照樣寫入記憶。與你的聊天、劇情名場面不受此額度限制。想控制費用可填每日次數上限，填 0 完全關閉。')}</div>
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

    renderLog(container) {
        if (!this.state) return;
        const messages = (this.state.recent_messages || []).slice().reverse();
        let html = '';

        // v5.21.0 小鎮劇場:回顧錯過的名場面(告白/婚禮/修羅場/分手/離婚)
        const archive = this.state.dramaArchive || this.world?.dramaArchive || [];
        if (archive.length) {
            html += `<div class="news-section drama-theater"><h4>🎭 ${t('小鎮劇場')} <span class="dt-count">${archive.length}</span></h4>`;
            archive.slice().reverse().slice(0, 20).forEach((s, i) => {
                const realIdx = archive.length - 1 - i;
                html += `<button class="drama-replay-row" data-action="replay-drama" data-val="${realIdx}">
                    <span class="dt-ic">${s.icon}</span>
                    <span class="dt-body"><span class="dt-title">${this._escapeHtml(s.title)}</span>
                    <span class="dt-who">${this._escapeHtml(s.aName)} × ${this._escapeHtml(s.bName)}</span></span>
                    <span class="dt-date">${t('第')}${s.year}${t('年')}${s.season}${s.day}${t('天')}</span>
                    <span class="dt-play">▶</span></button>`;
            });
            html += '</div>';
        }

        // Show recent NPC conversations at the top
        const npcConvos = (this.state.npc_conversations || []).slice().reverse();
        if (npcConvos.length) {
            html += t('<div class="npc-convo-section"><h4 style="padding:8px 10px;color:var(--accent);font-size:0.8rem;margin:0">村民對話</h4>');
            npcConvos.slice(0, 8).forEach(c => {
                html += `<div class="npc-convo-entry expanded" data-action="toggle-convo">
                    <div class="npc-convo-header"><span class="npc-convo-toggle">▶</span><span class="log-time">${c.time}</span><strong>${c.agentA}</strong> &amp; <strong>${c.agentB}</strong>
                    <span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px">@ ${this._locationLabel(c.location)}</span>${c.llm ? `<span style="font-size:0.62rem;margin-left:6px;padding:1px 5px;border-radius:6px;background:rgba(140,120,255,0.25);color:#c9bfff">✨ AI</span>` : ''}</div>
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
    },

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
                            <span class="candidate-name">${c.agentId === 'player' ? '👑 ' : ''}${t(c.name)}${c.agentId === 'player' ? t('（你）') : ''}</span>
                            <span class="candidate-policy">${c.policyIcon} ${c.policyLabel}</span>
                        </div>
                        <div class="candidate-speech">"${c.speech}"</div>
                    </div>`;
                });
                // v5.38.0 旅人參選:競選登記期內可親自出馬
                const isPlayerCand = election.candidates.some(c => c.agentId === 'player');
                if (!isPlayerCand) {
                    const elig = this.world.election?.playerEligibility?.(this.world);
                    if (elig?.ok) {
                        html += `<button class="btn-vote" data-action="run-for-mayor" style="width:100%;margin-top:6px">👑 ${t('我要參選鎮長！')}</button>`;
                    } else if (elig) {
                        html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">🗳️ ${t('想自己選鎮長？')}${this._escapeHtml(elig.msg || '')}</div>`;
                    }
                } else {
                    const canvassed = Object.keys(this.world.election?.playerCanvassed || {}).length;
                    html += `<div style="font-size:0.72rem;color:#ffd700;margin-top:6px">👑 ${t('你正在競選！已向')} ${canvassed} ${t('位村民拉票——去聊天用「說服」繼續爭取支持')}</div>`;
                }
            } else if (election.phase === 'voting') {
                html += t('<h4>🗳️ 鎮長選舉 — 投票進行中</h4>');
                html += `${t('<div class="election-info">剩餘 ')}${election.votingDaysLeft}${t(' 天投票</div>')}`;
                const playerVoted = this.world.election?._playerVoted;
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    html += `<div class="election-candidate">
                        <div class="candidate-header">
                            <span class="candidate-name">${t(c.name)}</span>
                            <span class="candidate-policy">${c.policyIcon} ${c.policyLabel}</span>
                            <span class="candidate-votes">${c.votes}${t(' 票（')}${pct}%）</span>
                        </div>
                        <div class="election-bar"><div class="election-bar-fill" style="width:${pct}%"></div></div>
                        ${!playerVoted ? `<button class="btn-vote" data-action="player-vote" data-val="${c.agentId}">投票給${t(c.name)}</button>` : ''}
                    </div>`;
                });
                html += `${t('<div class="election-total">已投票：')}${totalVotes}${t(' 人')}${playerVoted ? t(' (你已投票)') : ''}</div>`;
            } else if (election.phase === 'results') {
                const winner = election.candidates[0];
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                html += t('<h4>🏆 選舉結果</h4>');
                if (winner) {
                    html += `<div class="election-winner">
                        <div class="winner-name">${t(winner.name)} ${t('當選鎮長！')}</div>
                        <div class="winner-policy">${t('施政方針：')}${winner.policyIcon} ${winner.policyLabel}</div>
                    </div>`;
                }
                election.candidates.forEach(c => {
                    const pct = totalVotes > 0 ? Math.round(c.votes / totalVotes * 100) : 0;
                    const isWinner = c === election.candidates[0];
                    html += `<div class="election-candidate ${isWinner ? 'election-winner-card' : ''}">
                        <span class="candidate-name">${isWinner ? '👑 ' : ''}${t(c.name)}</span>
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
                <span>${t('上次選舉：')}${t(last.winner.name)}${t(' 當選（')}${last.winner.policyIcon || ''}${ELECTION_POLICIES_LABELS[last.winner.policy] || last.winner.policy}，${last.winner.votes}/${last.totalVotes} ${t('票）')}</span>
            </div>`;
        }

        // --- Weather Panel ---
        const weather = this.state.weather;
        if (weather) {
            html += '<div class="weather-section" style="margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px">';
            html += `<h4>${weather.icon} ${t('天氣')}：${t(weather.name)}</h4>`;
            html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0">${weather.desc}</div>`;
            html += `<div style="display:flex;gap:12px;font-size:0.75rem;margin:6px 0">`;
            html += `<span>🌡️ ${weather.temperature}°C</span>`;
            html += `<span>💧 ${t('濕度')} ${weather.humidity}%</span>`;
            html += `<span>💨 ${t('風速')} ${weather.windSpeed}</span>`;
            html += `</div>`;
            // Farm & mood modifiers
            const farmPct = Math.round(weather.farmModifier * 100);
            const moodVal = weather.moodModifier;
            html += `<div style="display:flex;gap:12px;font-size:0.75rem;margin:4px 0">`;
            html += `<span style="color:${farmPct >= 0 ? 'var(--positive)' : 'var(--negative)'}">🌾 ${t('農業')} ${farmPct >= 0 ? '+' : ''}${farmPct}%</span>`;
            html += `<span style="color:${moodVal >= 0 ? 'var(--positive)' : 'var(--negative)'}">😊 ${t('心情')} ${moodVal >= 0 ? '+' : ''}${moodVal}</span>`;
            html += `</div>`;
            // Forecast
            if (weather.forecast?.length) {
                html += `<div style="display:flex;gap:8px;margin-top:6px;font-size:0.72rem;color:var(--text-muted)">`;
                html += `<span>${t('預報')}：</span>`;
                weather.forecast.forEach(f => { html += `<span title="${t(f.name)}">${f.icon}</span>`; });
                html += `</div>`;
            }
            // Disaster warning
            if (weather.disasterWarning) {
                html += `<div style="margin-top:6px;padding:4px 8px;background:rgba(255,80,80,0.1);border-left:3px solid var(--negative);border-radius:4px;font-size:0.75rem">`;
                html += `⚠️ ${t('災害預警')}：${weather.disasterWarning.type === 'drought_severe' ? t('嚴重乾旱') : weather.disasterWarning.type === 'blizzard_severe' ? t('極端暴風雪') : t('洪水')}`;
                if (weather.disasterWarning.daysUntil > 0) html += ` (${weather.disasterWarning.daysUntil} ${t('天後')})`;
                html += `</div>`;
            }
            // Active disaster
            if (weather.activeDisaster) {
                html += `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,40,40,0.15);border-left:3px solid var(--negative);border-radius:4px;font-size:0.8rem;font-weight:bold">`;
                html += `🚨 ${t(weather.activeDisaster.name)}（${t('剩餘')} ${weather.activeDisaster.daysLeft} ${t('天')}）`;
                html += `<div style="font-weight:normal;font-size:0.72rem;margin-top:2px">${weather.activeDisaster.desc}</div>`;
                html += `</div>`;
            }
            html += '</div>';
        }

        // --- Council Panel ---
        const council = this.state.council;
        if (council && council.formed) {
            html += '<div class="council-section" style="margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px">';
            html += `<h4>🏛️ ${t('小鎮議會')}</h4>`;
            html += `<div style="font-size:0.75rem;color:var(--text-secondary);margin:4px 0">${t('成員')}：${council.memberNames.join(t('、'))}</div>`;
            // Pending proposal
            if (council.pendingProposal) {
                const p = council.pendingProposal;
                html += `<div style="margin-top:8px;padding:8px;background:rgba(255,200,60,0.08);border:1px solid rgba(255,200,60,0.2);border-radius:6px">`;
                html += `<div style="font-weight:bold;font-size:0.85rem">📜 ${p.title}</div>`;
                html += `<div style="font-size:0.72rem;color:var(--text-secondary);margin:4px 0">${p.desc}</div>`;
                html += `<div style="font-size:0.72rem;color:var(--text-muted)">${t('提案者')}：${p.proposerName} | ${t('剩餘')} ${p.daysLeft} ${t('天投票')}</div>`;
                html += `<div style="display:flex;gap:8px;margin-top:4px;font-size:0.75rem">`;
                html += `<span style="color:var(--positive)">👍 ${p.forCount} ${t('贊成')}</span>`;
                html += `<span style="color:var(--negative)">👎 ${p.againstCount} ${t('反對')}</span>`;
                html += `</div>`;
                if (!p.playerVoted) {
                    html += `<div style="display:flex;gap:6px;margin-top:8px">`;
                    html += `<button class="btn-accent" data-action="council-vote" data-val="for" style="flex:1;padding:6px">👍 ${t('贊成')}</button>`;
                    html += `<button style="flex:1;padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,80,80,0.1);color:var(--text-primary);cursor:pointer" data-action="council-vote" data-val="against">👎 ${t('反對')}</button>`;
                    html += `</div>`;
                } else {
                    html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">✅ ${t('你已投票')}</div>`;
                }
                html += `</div>`;
            } else {
                html += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${t('目前沒有待表決的議案。')}</div>`;
            }
            // Active decrees
            if (council.activeDecrees?.length) {
                html += `<div style="margin-top:8px;font-size:0.75rem">`;
                html += `<div style="font-weight:bold;margin-bottom:4px">${t('生效中的政令')}：</div>`;
                council.activeDecrees.forEach(d => {
                    html += `<div style="padding:2px 0;color:var(--text-secondary)">📋 ${d.title}</div>`;
                });
                html += `</div>`;
            }
            // Proposal log
            if (council.proposalLog?.length) {
                html += `<div style="margin-top:8px;font-size:0.7rem;color:var(--text-muted)">`;
                html += `${t('近期決議')}：`;
                council.proposalLog.slice(-5).reverse().forEach(p => {
                    html += `<span style="color:${p.passed ? 'var(--positive)' : 'var(--negative)'}"> ${p.passed ? '✅' : '❌'} ${p.title}(${p.forVotes}:${p.againstVotes})</span>`;
                });
                html += `</div>`;
            }
            html += '</div>';
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
                    // v5.34.2 補全 modifier 中文標籤(原本只有 7 個,其餘直接露出英文 key)
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
                    // weather_mood 是心情點數(±N),不是百分比
                    const flatKeys = { weather_mood: 1 };
                    const display = typeof val === 'number'
                        ? (flatKeys[key] ? (val > 0 ? '+' : '') + Math.round(val) : (val > 0 ? '+' : '') + Math.round(val * 100) + '%')
                        : (val ? t('是') : t('否'));
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
                    // v5.17.0 情境入口:把本期事件做成可點連結,直達當事人資訊卡或相關分頁
                    const pevs = paper.events || [];
                    if (pevs.length) {
                        html += `<div class="news-card-events">`;
                        pevs.forEach((e, ei) => {
                            html += `<button class="headline-row" data-action="news-goto" data-val="${paper.id}:${ei}">
                                <span class="headline-ic">${this._newsCatIcon(e.category)}</span>
                                <span class="headline-text">${this._escapeHtml(e.content)}</span>
                                <span class="headline-go">›</span></button>`;
                        });
                        html += `</div>`;
                    }
                    // v5.88.0 跨鎮專欄:其他鎮日報的要聞
                    if (Array.isArray(paper.crossTown) && paper.crossTown.length) {
                        html += `<div class="news-card-events" style="margin-top:8px"><div class="muted-text" style="font-size:0.72rem;margin-bottom:4px">🐎 ${t('跨鎮專欄')}</div>`;
                        paper.crossTown.forEach(ct => { (ct.items || []).forEach(line => { html += `<div class="headline-row" style="cursor:default"><span class="headline-ic">📰</span><span class="headline-text"><b>${this._escapeHtml(t(ct.town))}</b>｜${this._escapeHtml(t(line))}</span></div>`; }); });
                        html += `</div>`;
                    }
                    // v4.0: Interactive newspaper reaction buttons (only for latest)
                    if (isLatest && !this._newsReacted) {
                        html += `<div style="display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08)">`;
                        html += `<button class="trade-btn" data-action="news-react" data-val="investigate" style="flex:1;font-size:0.72rem">🔍 ${t('調查')}</button>`;
                        html += `<button class="trade-btn" data-action="news-react" data-val="support" style="flex:1;font-size:0.72rem">👍 ${t('支持')}</button>`;
                        html += `<button class="trade-btn" data-action="news-react" data-val="ignore" style="flex:1;font-size:0.72rem">🤷 ${t('忽略')}</button>`;
                        html += `</div>`;
                    }
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
            travelling.forEach(_tw => { html += `<div class="travelling-item">${t(_tw.name)} — ${_tw.reason}</div>`; });
            html += '</div>';
        }
        const events = (this.state.recent_events || []).slice().reverse();
        events.forEach(evt => {
            const typeBadge = evt.event_type && evt.event_type !== 'random'
                ? `<span class="event-type-badge type-${evt.event_type}">${evt.event_type}</span>` : '';
            html += `<div class="event-card severity-${evt.severity}">
                <div style="font-weight:bold">${t(evt.name)}${typeBadge}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${evt.time}</div>
                <div style="margin-top:4px">${evt.description}</div></div>`;
        });
        // === Festivals ===
        const festivals = this.state.festivals || {};
        if (festivals.activeFestival) {
            const f = festivals.activeFestival;
            html += `<div class="festival-section"><h4>${f.icon} ${t(f.name)}${t('進行中！')}</h4>
                <div style="padding:4px 8px;color:var(--text-secondary)">${f.description}</div></div>`;
        }
        if (festivals.activeQuest) {
            const q = festivals.activeQuest;
            const pct = Math.round((q.progress / q.goal) * 100);
            html += `${t('<div class="quest-section"><h4>🎯 節日任務：')}${t(q.name)}</h4>
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
                    if (rival) relHtml += `${t('<span class="faction-rival">⚔️ 敵對：')}${t(rival.name)}</span> `;
                }
                if (f.allyFactionId) {
                    const ally = factionList.find(x => x.id === f.allyFactionId);
                    if (ally) relHtml += `${t('<span class="faction-ally">🤝 結盟：')}${t(ally.name)}</span>`;
                }
                html += `<div class="faction-card">
                    <div class="faction-header">${f.icon} <strong>${t(f.name)}</strong>
                        <span class="faction-cohesion ${cohesionCls}${t('">團結度：')}${f.cohesion > 70 ? t('緊密') : f.cohesion < 30 ? t('渙散') : t('普通')}</span></div>
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
                // v5.35.7 移除只列前 8 位的限制:全部不在探險中的村民都可選
                const availableNpcs = Object.entries(this.state.agents)
                    .filter(([id, a]) => !a.is_player && a.activity_label !== t('探險中') && id !== 'player');
                html += `<div class="explore-zone">
                    <div class="zone-header">${zoneDef.icon} <strong>${t(zoneDef.name)}</strong>
                        <span class="zone-diff">${t('難度：')}${'⭐'.repeat(zoneDef.difficulty)}</span></div>
                    <div class="zone-desc">${zoneDef.description}</div>
                    <div class="zone-stats">${t('已探索')} ${info.timesExplored} ${t('次')}</div>
                    ${canSend ? `<div class="zone-send">
                        <select class="explore-select" id="explore-select-${zoneId}" multiple size="3">
                            ${availableNpcs.map(([id, a]) => `<option value="${id}">${t(a.name)} (${a.job?.title||t('無')})</option>`).join('')}
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
                    html += `<div class="birth-item">${t(b.name)} — ${b.parentNames.join(t('與'))}${t('的孩子 <span class="birth-time">')}${b.birthTime}</span></div>`;
                });
            }
            if (graveyard.length) {
                html += t('<h4>⚰️ 墓園</h4>');
                graveyard.slice(-10).reverse().forEach(g => {
                    html += `<div class="grave-item">
                        <div class="grave-name">${t(g.name)}（${g.age}${t('歲）')}</div>
                        <div class="grave-info">${g.job} — ${g.deathCause}</div>
                        <div class="grave-epitaph">${g.epitaph}</div>
                        <div class="grave-time">${g.deathTime}</div></div>`;
                });
            }
            html += '</div>';
        }

        container.innerHTML = html || t('<p class="muted-text" style="padding:20px">尚無事件。事件每天會隨機發生。</p>');
    },
});
