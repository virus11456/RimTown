// RimTown - app-mobile.js：從 app.js 拆出的 手機開羅模式：底部列、浮動選單與卡片、村民浮動卡、虛擬搖桿、地圖覆蓋層（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    _setupKairoUI() {
        const root = document.getElementById('rimtown-app');
        const sheet = document.getElementById('rimtown-sidebar');
        if (!root || !sheet || this._kairoReady) return;
        this._kairoReady = true;
        root.classList.add('kairo-mode');
        sheet.classList.add('kairo-hidden'); // 抽屜只在聊天時出現

        // 底部極簡列:☰ 選單 + 💬 聊天
        const bar = document.createElement('div');
        bar.id = 'kairo-bar';
        bar.innerHTML = `
            <button id="kairo-menu-btn">☰ <span>${t('選單')}</span></button>
            <button id="kairo-chat-btn" data-tab="chat">💬 <span>${t('聊天')}</span></button>`;
        root.appendChild(bar);

        // 底部狀態帶(機場物語式:繁榮/銀幣/食物/人口)
        const status = document.createElement('div');
        status.id = 'kairo-status';
        root.appendChild(status);
        status.addEventListener('click', () => { this.bgm?.sfx?.('click'); this._openKairoTab('economy'); });

        // 左側浮動選單
        const menu = document.createElement('div');
        menu.id = 'kairo-menu';
        menu.className = 'hidden';
        // v5.20.0 三大入口:每組進去後,卡片頂部的次級分頁列可切換組內其他分頁
        const ITEMS = [
            ['residents', '👥', t('居民')], ['quest', '📖', t('故事')],
            ['economy', '🏙️', t('小鎮')], ['settings', '⚙️', t('設定')],
        ];
        menu.innerHTML = ITEMS.map(([k, ic, lb]) => `<button data-kairo-tab="${k}"><span class="km-ic">${ic}</span>${lb}</button>`).join('');
        root.appendChild(menu);

        // 置中浮動卡片
        const card = document.createElement('div');
        card.id = 'kairo-card';
        card.className = 'hidden';
        card.innerHTML = `
            <div id="kairo-card-header">
                <span id="kairo-card-title"></span>
                <button id="kairo-card-back">↩ ${t('返回')}</button>
            </div>
            <div id="kairo-card-body"></div>`;
        root.appendChild(card);
        this._kairoTitles = Object.fromEntries(ITEMS.map(([k, ic, lb]) => [k, `${ic} ${lb}`]));
        Object.assign(this._kairoTitles, {
            detail: `📋 ${t('詳情')}`, relmap: `💞 ${t('關係網')}`,
            industry: `🏭 ${t('產業')}`, records: `📋 ${t('日誌')}`,
        });

        // 事件
        document.getElementById('kairo-menu-btn').addEventListener('click', () => {
            card.classList.add('hidden');
            this._kairoCardOpen = false;
            const willOpen = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');
            this.bgm?.sfx?.(willOpen ? 'open' : 'close');
        });
        document.getElementById('kairo-chat-btn').addEventListener('click', () => {
            // v5.11.0 切換:聊天已開 → 再點一次收起
            if (sheet.classList.contains('chat-open')) { this._dismissKairoPanels(); return; }
            menu.classList.add('hidden');
            this.activeTab = 'chat';
            this._updateTabHighlight('chat');
            this.renderSidebar();
        });

        // v5.11.0 點地圖任意處 → 收起開啟中的聊天/選單/卡片(修:聊天打開後沒法點空白收起)
        const mapPanel = document.querySelector('.map-panel');
        if (mapPanel) {
            mapPanel.addEventListener('pointerdown', (e) => {
                if (window.innerWidth > 768) return;
                if (this._dismissKairoPanels()) {
                    // 這一下只用來收面板,不觸發地圖移動/選取
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true); // capture:比 canvas 的 handler 先跑
        }
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-kairo-tab]');
            if (btn) this._openKairoTab(btn.dataset.kairoTab);
        });
        document.getElementById('kairo-card-back').addEventListener('click', () => {
            card.classList.add('hidden');
            this._kairoCardOpen = false;
            this.bgm?.sfx?.('close');
        });
    },

    _openKairoTab(tab) {
        if (this._isTabLocked(tab)) { this._lockedAlert(tab); return; }
        this.bgm?.sfx?.('click');
        document.getElementById('kairo-menu')?.classList.add('hidden');
        this._kairoCardOpen = true;
        const title = document.getElementById('kairo-card-title');
        if (title) title.textContent = this._kairoTitles?.[tab] || tab;
        this.activeTab = tab;
        this._updateTabHighlight(tab);
        this.renderSidebar();
    },

    // v5.11.0 收起手機版所有浮動面板(聊天抽屜/左側選單/浮動卡片),回到全螢幕地圖
    _dismissKairoPanels() {
        if (!this._kairoReady || window.innerWidth > 768) return false;
        const sheet = document.getElementById('rimtown-sidebar');
        const menu = document.getElementById('kairo-menu');
        const card = document.getElementById('kairo-card');
        let closed = false;
        if (menu && !menu.classList.contains('hidden')) { menu.classList.add('hidden'); closed = true; }
        if (card && !card.classList.contains('hidden')) { card.classList.add('hidden'); this._kairoCardOpen = false; closed = true; }
        if (sheet && sheet.classList.contains('chat-open')) { sheet.classList.remove('chat-open'); sheet.classList.add('kairo-hidden'); closed = true; }
        else if (sheet && !sheet.classList.contains('kairo-hidden')) { sheet.classList.add('kairo-hidden'); closed = true; }
        if (closed) {
            this.activeTab = null; // 不再是聊天/卡片,_syncKairoLayout 會維持隱藏
            this._kairoCardOpen = false;
            this.bgm?.sfx?.('close');
        }
        return closed;
    },

    // renderSidebar 每次呼叫時,依模式把 #sidebar-content 搬到正確容器
    _syncKairoLayout() {
        if (!this._kairoReady || window.innerWidth > 768) return;
        const content = document.getElementById('sidebar-content');
        const sheet = document.getElementById('rimtown-sidebar');
        const card = document.getElementById('kairo-card');
        const cardBody = document.getElementById('kairo-card-body');
        if (!content || !sheet || !card || !cardBody) return;
        if (this.activeTab === 'chat') {
            // 聊天:內容回到底部抽屜(要打字,給大面板)
            if (content.parentElement !== sheet) sheet.appendChild(content);
            card.classList.add('hidden');
            this._kairoCardOpen = false;
            sheet.classList.remove('kairo-hidden', 'mobile-collapsed');
            sheet.classList.add('chat-open');
        } else if (this._kairoCardOpen) {
            // 其他分頁:內容進浮動卡片,地圖保持全螢幕
            if (content.parentElement !== cardBody) cardBody.appendChild(content);
            const title = document.getElementById('kairo-card-title');
            if (title) title.textContent = this._kairoTitles?.[this.activeTab] || this._kairoTitles?.[this._mobileSubToMain?.[this.activeTab]] || '';
            card.classList.remove('hidden');
            sheet.classList.add('kairo-hidden');
        } else if (!sheet.classList.contains('kairo-hidden')) {
            // 從聊天面板切到其他子分頁(如日誌)→ 自動轉為浮動卡(修:點了沒反應)
            this._kairoCardOpen = true;
            if (content.parentElement !== cardBody) cardBody.appendChild(content);
            const title = document.getElementById('kairo-card-title');
            if (title) title.textContent = this._kairoTitles?.[this.activeTab] || this._kairoTitles?.[this._mobileSubToMain?.[this.activeTab]] || '';
            card.classList.remove('hidden');
            sheet.classList.add('kairo-hidden');
        } else {
            sheet.classList.add('kairo-hidden');
        }
    },

    // =====================================================
    // v4.2.0 礦石鎮式地圖覆蓋層:互動提示 / NPC 快速卡 / 八卦跑馬燈 / 虛擬搖桿
    // =====================================================
    _setupTownOverlays() {
        const panel = document.querySelector('.map-panel');
        if (!panel || this._overlaysReady) return;
        this._overlaysReady = true;

        // 走近 NPC 的互動提示(點擊 = E)
        const prompt = document.createElement('button');
        prompt.id = 'interact-prompt';
        prompt.className = 'interact-prompt hidden';
        prompt.addEventListener('click', () => this._interactNearby());
        panel.appendChild(prompt);

        // 八卦跑馬燈
        const ticker = document.createElement('div');
        ticker.id = 'drama-ticker';
        ticker.className = 'drama-ticker hidden';
        panel.appendChild(ticker);

        // NPC 快速資訊卡
        const card = document.createElement('div');
        card.id = 'npc-quick-card';
        card.className = 'npc-quick-card hidden';
        panel.appendChild(card);

        // 手機虛擬搖桿(僅觸控裝置)
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
            this._setupVirtualJoystick(panel);
        }
    },

    _setupVirtualJoystick(panel) {
        const base = document.createElement('div');
        base.id = 'vjoy';
        base.className = 'vjoy';
        const knob = document.createElement('div');
        knob.className = 'vjoy-knob';
        base.appendChild(knob);
        panel.appendChild(base);
        const R = 38; // 搖桿最大半徑(px)
        let active = null;
        const setInput = (dx, dy) => {
            const mag = Math.hypot(dx, dy);
            const c = mag > R ? R / mag : 1;
            knob.style.transform = `translate(${dx * c}px, ${dy * c}px)`;
            if (this.tileMap) this.tileMap.playerInput = { x: (dx * c) / R, y: (dy * c) / R };
        };
        base.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            active = e.pointerId;
            base.setPointerCapture(e.pointerId);
            const r = base.getBoundingClientRect();
            this._vjoyCX = r.left + r.width / 2; this._vjoyCY = r.top + r.height / 2;
            setInput(e.clientX - this._vjoyCX, e.clientY - this._vjoyCY);
        });
        base.addEventListener('pointermove', (e) => {
            if (e.pointerId !== active) return;
            e.preventDefault(); e.stopPropagation();
            setInput(e.clientX - this._vjoyCX, e.clientY - this._vjoyCY);
        });
        const end = (e) => {
            if (e.pointerId !== active) return;
            active = null;
            knob.style.transform = 'translate(0px, 0px)';
            if (this.tileMap) this.tileMap.playerInput = { x: 0, y: 0 };
        };
        base.addEventListener('pointerup', end);
        base.addEventListener('pointercancel', end);
    },

    // NPC 對玩家的好感 → 礦石鎮式愛心等級(0-10)
    _heartsFor(npcId) {
        const rel = this.state?.agents?.[npcId]?.relationships?.['player'];
        const aff = rel ? (rel.affinity || 0) : 0;
        return Math.max(0, Math.min(10, Math.round((aff + 100) / 20)));
    },

    // 每 frame 由 render loop 呼叫(內部節流)
    _updateTownOverlays() {
        const now = Date.now();
        if (this._overlayAt && now - this._overlayAt < 200) return;
        this._overlayAt = now;
        this._updateInteractPrompt();
        this._updateAgentEmotes();
        this._updateDramaTicker();
        this._updateKairoStatus();
        const nowU = Date.now();
        if (!this._unlockCheckAt || nowU - this._unlockCheckAt > 1500) {
            this._unlockCheckAt = nowU;
            this._checkUnlocks();
        }
    },

    // 底部狀態帶:🏆繁榮 💰銀幣 🍞食物 👥人口(每秒更新)
    _updateKairoStatus() {
        const el = document.getElementById('kairo-status');
        if (!el || !this.state) return;
        const now = Date.now();
        if (this._kairoStatusAt && now - this._kairoStatusAt < 1000) return;
        this._kairoStatusAt = now;
        const pr = this.state.prosperity || {};
        const res = this.state.stockpile?.resources || {};
        const pop = Object.keys(this.state.agents || {}).length;
        el.innerHTML = `
            <span>🏆 ${pr.level || '--'} ${Math.round(pr.prosperity || 0)}</span>
            <span>💰 ${Math.round(res.silver || 0)}</span>
            <span>🍞 ${Math.round(res.food || 0)}</span>
            <span>👥 ${pop}</span>`;
    },

    _updateInteractPrompt() {
        const el = document.getElementById('interact-prompt');
        if (!el || !this.tileMap) return;
        const near = this.tileMap.getNearbyNPC ? this.tileMap.getNearbyNPC() : null;
        if (!near || this.chatTarget === near.agentId) { el.classList.add('hidden'); return; }
        const npc = this.state?.agents?.[near.agentId];
        if (!npc) { el.classList.add('hidden'); return; }
        const lv = this._heartsFor(near.agentId);
        el.innerHTML = `💬 ${t('與')} <b>${t(npc.name)}</b> ${t('交談')} <span class="ip-hearts">❤${lv}</span><span class="ip-key">E</span>`;
        el.classList.remove('hidden');
    },

    // 愛恨糾葛頭上表情:每 NPC 取最強烈的關係狀態,錯開輪播(每 12 秒亮 3 秒)
    _updateAgentEmotes() {
        if (!this.tileMap || !this.state?.agents) return;
        const win = Math.floor(Date.now() / 3000);
        const emotes = {};
        for (const [aid, a] of Object.entries(this.state.agents)) {
            if (aid === 'player' || !a.relationships) continue;
            let best = null;
            for (const r of Object.values(a.relationships)) {
                if (r.target_id === 'player') continue;
                if (r.is_cheating) { best = '🖤'; break; }
                if (r.status === 'dating') best = best || '💕';
                else if (r.status === 'married') best = best || '💍';
                else if ((r.romantic_interest || 0) > 50 && !r.status) best = best || '💘';
                else if ((r.affinity || 0) < -60) best = best || '💢';
            }
            if (!best) continue;
            let h = 0;
            for (let i = 0; i < aid.length; i++) h = (h * 31 + aid.charCodeAt(i)) & 0xffff;
            if ((win + h) % 4 === 0) emotes[aid] = best;
        }
        this.tileMap.agentEmotes = emotes;
    },

    // 八卦跑馬燈:即時播報戀愛/衝突/八卦事件
    _updateDramaTicker() {
        const el = document.getElementById('drama-ticker');
        const log = this.world?.messageLog;
        if (!el || !log) return;
        if (this._dramaIdx == null) this._dramaIdx = log.length;
        const DRAMA_TYPES = { relationship: '💘', drama: '🎭', incident: '💥' };
        while (this._dramaIdx < log.length) {
            const m = log[this._dramaIdx++];
            const icon = DRAMA_TYPES[m.type];
            if (icon) {
                if (!this._dramaQueue) this._dramaQueue = [];
                if (this._dramaQueue.length < 6) this._dramaQueue.push(`${icon} ${m.content}`);
            }
        }
        const now = Date.now();
        if (this._dramaQueue?.length && (!this._dramaShownAt || now - this._dramaShownAt > 5500)) {
            el.textContent = this._dramaQueue.shift();
            el.classList.remove('hidden');
            el.classList.remove('drama-slide');
            void el.offsetWidth; // 重觸發動畫
            el.classList.add('drama-slide');
            this._dramaShownAt = now;
        } else if (this._dramaShownAt && now - this._dramaShownAt > 5000) {
            el.classList.add('hidden');
        }
    },

    _showNpcCard(agentId) {
        const card = document.getElementById('npc-quick-card');
        const a = this.state?.agents?.[agentId];
        if (!card || !a) return;
        // v5.35.6 手機版:快速卡開在地圖層,若浮動面板(故事/日報等)開著會蓋住它 → 先收合面板
        if (this._kairoReady && window.innerWidth <= 768) this._dismissKairoPanels?.();
        const lv = this._heartsFor(agentId);
        const hearts = '❤️'.repeat(Math.ceil(lv / 2)) + '🖤'.repeat(5 - Math.ceil(lv / 2));
        // 感情狀態掃描
        const lines = [];
        const rels = a.relationships || {};
        for (const r of Object.values(rels)) {
            if (r.target_id === 'player') continue;
            if (r.status === 'married') lines.push(`💍 ${t('與')} ${r.target_name} ${t('是夫妻')}${r.is_cheating ? ' 🖤' : ''}`);
            else if (r.status === 'dating') lines.push(`💕 ${t('與')} ${r.target_name} ${t('交往中')}${r.is_cheating ? ' 🖤' : ''}`);
            else if (r.status === 'ex') lines.push(`💔 ${t('與')} ${r.target_name} ${t('是前任')}`);
        }
        const crushes = Object.values(rels).filter(r => r.target_id !== 'player' && !r.status && (r.romantic_interest || 0) > 50).slice(0, 2);
        crushes.forEach(r => lines.push(`💘 ${t('暗戀')} ${r.target_name}`));
        const foes = Object.values(rels).filter(r => r.target_id !== 'player' && (r.affinity || 0) < -60).slice(0, 2);
        foes.forEach(r => lines.push(`💢 ${t('與')} ${r.target_name} ${t('是死對頭')}`));
        const relHtml = lines.length ? lines.map(l => `<div class="nqc-rel">${l}</div>`).join('') : `<div class="nqc-rel nqc-dim">${t('目前沒有戀愛或仇恨傳聞')}</div>`;
        // v5.4.0 人生夢想進度
        const goal = this.state?.lifeGoals?.[agentId];
        let goalHtml = '';
        if (goal) {
            const pips = Array.from({ length: goal.totalStages }, (_, i) => i < goal.stage || goal.done ? '●' : (i === goal.stage ? '◉' : '○')).join('');
            goalHtml = `<div class="nqc-rel" style="border-top:1px solid var(--border);margin-top:4px;padding-top:5px">
                ${goal.icon} <b>${t(goal.name)}</b> <span style="color:var(--text-secondary);font-size:0.72rem">${goal.done ? '🏆 ' + t('已實現') : goal.stageName}</span>
                <span style="letter-spacing:2px;color:var(--accent);font-size:0.7rem">${pips}</span></div>`;
        }
        // v5.15.0 心情來源:目前生效的記憶想法(RimWorld thoughts)
        let moodHtml = '';
        const now = this.world?.clock?.totalDays ?? 0;
        const live = (a.thoughts || [])
            .map(th => ({ ...th, cur: th.mood * Math.max(0, 1 - (now - th.start) / th.days) }))
            .filter(th => Math.abs(th.cur) >= 0.5)
            .sort((x, y) => Math.abs(y.cur) - Math.abs(x.cur))
            .slice(0, 4);
        if (live.length) {
            const rows = live.map(th => {
                const pos = th.cur >= 0;
                const who = th.targetName ? ` <span style="opacity:0.6">(${th.targetName})</span>` : '';
                return `<div class="nqc-mood-row"><span>${pos ? '🙂' : '😞'} ${th.label}${who}</span><span style="color:${pos ? '#5cc98f' : '#e07a7a'};font-weight:600">${pos ? '+' : ''}${Math.round(th.cur)}</span></div>`;
            }).join('');
            moodHtml = `<div class="nqc-mood" style="border-top:1px solid var(--border);margin-top:4px;padding-top:5px">
                <div class="nqc-mood-title">💭 ${t('心情來源')}</div>${rows}</div>`;
        }
        // v5.16.0 意圖面板:讓玩家看懂這個 AI 現在在做什麼、為什麼、接下來想幹嘛
        let intentHtml = '';
        const liveA = this.world?.agents?.[agentId];
        if (liveA && liveA.activityReason) {
            const rows = [
                ['🎯', t('當前行動'), `${liveA.activityLabel}${liveA.currentLocation ? '' : ''}`],
                ['💬', t('為什麼'), liveA.activityReason()],
                ['🧭', t('接下來'), liveA.nextIntent(this.world)],
                ['⚠️', t('對城鎮'), liveA.townConcern(this.world)],
            ].map(([ic, k, v]) => `<div class="nqc-intent-row"><span class="nqc-intent-k">${ic} ${k}</span><span class="nqc-intent-v">${v}</span></div>`).join('');
            intentHtml = `<div class="nqc-intent" style="border-top:1px solid var(--border);margin-top:4px;padding-top:5px">${rows}</div>`;
        }
        // v5.31.0 內心第一層:屬性條移到詳情頁,快速卡改放「今日目標 + 最新反思」(這才是這遊戲獨有的)
        let attrHtml = '';
        if (liveA && !liveA.isPlayer && liveA.generateDailyPlan) {
            try {
                const plan = liveA.generateDailyPlan(this.world);
                const refl = liveA.memory.getThoughts(1)[0];
                const bits = [];
                // v5.37.0 LLM 分解行程:顯示「此刻正在做的小動作」+ 下一個時段,比抽象目標更有生活感
                const cur = liveA.getCurrentPlanStep ? liveA.getCurrentPlanStep(this.world) : null;
                if (cur) {
                    const rows = [`<div class="nqc-mood-row"><span>🕐 ${this._escapeHtml(cur.step || cur.goal)}</span></div>`];
                    const nowMin = this.world.clock.hour * 60 + this.world.clock.minute;
                    const next = (plan.blocks || []).find(b => { const m = String(b.time).match(/(\d{1,2}):(\d{2})/); return m && (parseInt(m[1],10)*60+parseInt(m[2],10)) > nowMin; });
                    if (next) rows.push(`<div class="nqc-mood-row"><span>⏭ ${this._escapeHtml(next.time)} ${this._escapeHtml(next.text)}</span></div>`);
                    bits.push(`<div class="nqc-mood-title">📅 ${t('今天想做')}</div>` + rows.join(''));
                } else {
                    const goals = (plan?.goals || []).filter(g => !/^\d/.test(g)).slice(0, 2); // 挑非例行(不以時間開頭)的目標
                    if (goals.length) bits.push(`<div class="nqc-mood-title">📅 ${t('今天想做')}</div>` + goals.map(g => `<div class="nqc-mood-row"><span>${this._escapeHtml(g)}</span></div>`).join(''));
                }
                if (refl) bits.push(`<div class="nqc-mood-title" style="margin-top:3px">💭 ${t('心裡的話')}</div><div class="nqc-mood-row"><span>${this._escapeHtml(refl.content)}</span></div>`);
                if (bits.length) attrHtml = `<div class="nqc-mood" style="border-top:1px solid var(--border);margin-top:4px;padding-top:5px">${bits.join('')}</div>`;
            } catch (e) {}
        }
        const nudged = this.world?.lifeGoals?.getGoal?.(agentId)?._nudged;
        card.innerHTML = `
            <button class="nqc-close" data-nqc="close">✕</button>
            <div class="nqc-name">${t(a.name)} <span class="nqc-job">${a.job?.title || ''}</span></div>
            <div class="nqc-hearts" title="${t('對你的好感')}">${hearts} <span class="nqc-lv">${lv}/10</span></div>
            ${intentHtml}
            ${attrHtml}
            ${relHtml}
            ${moodHtml}
            ${goalHtml}
            <div class="nqc-btns">
                <button class="nqc-chat" data-nqc="chat">💬 ${t('交談')}</button>
                ${goal && !goal.done ? `<button class="nqc-detail" data-nqc="nudge" ${nudged ? 'disabled style="opacity:0.4"' : ''}>✨ ${t('助夢')}</button>` : ''}
                <button class="nqc-detail" data-nqc="follow">${this._followSet().has(agentId) ? '🔕 ' + t('追蹤中') : '🔔 ' + t('追蹤')}</button>
                <button class="nqc-detail" data-nqc="detail">📋 ${t('詳情')}</button>
            </div>`;
        card.onclick = (e) => {
            const act = e.target?.dataset?.nqc;
            if (act === 'close') this._hideNpcCard();
            else if (act === 'chat') { this._hideNpcCard(); this._walkToAndChat(agentId); }
            else if (act === 'nudge') { this._nudgeDream(agentId); }
            else if (act === 'follow') { this._toggleFollow(agentId); this._showNpcCard(agentId); } // v5.48.0 追蹤(重繪按鈕狀態)
            else if (act === 'detail') {
                this._hideNpcCard();
                this.selectedAgent = agentId;
                // v5.35.3 手機版:面板要靠浮動卡(_kairoCardOpen)才會顯示,否則點了沒反應
                if (this._kairoReady && window.innerWidth <= 768) this._kairoCardOpen = true;
                this.activeTab = 'detail';
                this._updateTabHighlight('detail');
                this.renderSidebar();
            }
        };
        card.classList.remove('hidden');
        if (agentId !== 'player') this._firstDayMark?.('meet'); // v5.18.0 第一天:認識一位居民
    },

    _hideNpcCard() {
        document.getElementById('npc-quick-card')?.classList.add('hidden');
    },

    // v5.4.0 助夢:替村民加速他的人生夢想,並加好感
    _nudgeDream(agentId) {
        const npc = this.world?.agents?.[agentId];
        if (!npc || !this.world.lifeGoals) return;
        if (!this.world.lifeGoals.nudge(this.world, agentId)) return;
        const rel = npc.relationships.getOrCreate('player', this.world.agents['player']?.name || t('旅人'));
        rel.modifyAffinity(4);
        const d = this.world.lifeGoals.describe(agentId);
        this.world.logMessage('milestone', `✨ ${playerTitle(this.world)}${t('為')}${t(npc.name)}${t('的夢想「')}${d?.name || ''}${t('」加了一把勁!')}`, npc.name);
        npc.memory.add(this.world.tickCount, this.world.clock.timeStr, 'social', `${playerTitle(this.world)}${t('支持我的夢想,好感動!')}`, 6, ['player']);
        this.bgm?.sfx?.('coin');
        this.tileMap?.spawnFxOnAgent?.(agentId, '✨', { color: '#6bd5a0', burst: '⭐', burstCount: 6 });
        this._gameAlert(`✨ ${t('你鼓勵了')}${t(npc.name)}${t('追逐「')}${d?.name || ''}${t('」的夢想!')}`, npc.icon || '✨');
        this.state = this.world.getState();
        this._showNpcCard(agentId);
    },
});
