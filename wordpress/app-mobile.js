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
        // v6.25.0 觀察者沙盒:底部直接放四大入口 + 聊天(☰ 選單保留為設定入口)
        bar.innerHTML = `
            <button data-kairo-tab="economy">🏙️ <span>${t('動態')}</span></button>
            <button data-kairo-tab="residents">👥 <span>${t('村民')}</span></button>
            <button data-kairo-tab="proposals">📜 <span>${t('提案')}</span></button>
            <button data-kairo-tab="records">📰 <span>${t('日報')}</span></button>
            <button id="kairo-chat-btn" data-tab="chat">💬 <span>${t('聊天')}</span></button>
            <button id="kairo-menu-btn">⚙️ <span>${t('設定')}</span></button>`;
        root.appendChild(bar);
        bar.addEventListener('click', (e) => { const b = e.target.closest('[data-kairo-tab]'); if (b) { this._openKairoTab(b.dataset.kairoTab); bar.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); } });

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
            ['economy', '🏙️', t('動態')], ['residents', '👥', t('村民')],
            ['proposals', '📜', t('提案')], ['records', '📰', t('日報')], ['settings', '⚙️', t('設定')],
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
        document.getElementById('kairo-menu-btn').addEventListener('click', () => { this._openKairoTab('settings'); }); // v6.25.0 直接開設定
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
        // v6.29.0 抽屜可拖:拉把手(標題列)上下拖,放開吸附 46vh／86vh;點兩下切換
        (() => {
            const hdr = document.getElementById('kairo-card-header'); if (!hdr) return;
            let startY = 0, startH = 0, dragging = false, lastTap = 0;
            hdr.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragging = true; startY = e.clientY; startH = card.getBoundingClientRect().height; hdr.setPointerCapture?.(e.pointerId); });
            hdr.addEventListener('pointermove', (e) => { if (!dragging) return; const h = Math.max(window.innerHeight * 0.25, Math.min(window.innerHeight * 0.92, startH + (startY - e.clientY))); card.style.height = h + 'px'; });
            const end = (e) => { if (!dragging) return; dragging = false; const h = card.getBoundingClientRect().height; const moved = Math.abs(e.clientY - startY) > 6; card.style.height = ''; if (moved) card.classList.toggle('tall', h > window.innerHeight * 0.62); else { const now = Date.now(); if (now - lastTap < 350) card.classList.toggle('tall'); lastTap = now; } };
            hdr.addEventListener('pointerup', end); hdr.addEventListener('pointercancel', end);
        })();
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
        if (this.world?.observerMode === false && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) { // v6.25.0 觀察者沒有搖桿
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
        const pop = Object.keys(this.state.agents || {}).filter(id => id !== 'player').length; // v6.25.0
        el.innerHTML = `
            <span>🏆 ${pr.level || '--'} ${Math.round(pr.prosperity || 0)}</span>
            <span>💰 ${Math.round(res.silver || 0)}</span>
            <span>🍞 ${Math.round(res.food || 0)}</span>
            <span>👥 ${pop}</span>`;
    },

    _updateInteractPrompt() {
        const el = document.getElementById('interact-prompt');
        if (!el || !this.tileMap) return;
        if (this.world?.observerMode !== false) { el.classList.add('hidden'); return; } // v6.25.0
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
        // v6.30.0 提案戰績(有提過才顯示)
        try { const rec = this.world?.proposals?.record?.(agentId); if (rec && rec.made) intentHtml += `<div class="nqc-intent-row"><span class="nqc-intent-k">📜 ${t('提案戰績')}</span><span class="nqc-intent-v">${t('提 {m} 件、落實 {d} 件、被否決 {r} 件').replace('{m}', rec.made).replace('{d}', rec.done || 0).replace('{r}', rec.rejected || 0)}</span></div>`; } catch (e) {}
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
                    const goals = (typeof Agent !== 'undefined' && Agent.planGoalTexts ? Agent.planGoalTexts(plan) : (plan?.goals || [])).filter(g => !/^\d/.test(g)).slice(0, 2); // 挑非例行(不以時間開頭)的目標;v6.21.0 依當下語言
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
            ${this.world?.observerMode ? '' : `<div class="nqc-hearts" title="${t('對你的好感')}">${hearts} <span class="nqc-lv">${lv}/10</span></div>`}
            ${intentHtml}
            ${attrHtml}
            ${relHtml}
            ${moodHtml}
            ${goalHtml}
            <div class="nqc-btns">
                <button class="nqc-chat" data-nqc="chat">💬 ${t('交談')}</button>
                ${goal && !goal.done && !this.world?.observerMode ? `<button class="nqc-detail" data-nqc="nudge" ${nudged ? 'disabled style="opacity:0.4"' : ''}>✨ ${t('助夢')}</button>` : ''}
                ${this.tileMap?.followAgent ? `<button class="nqc-detail" data-nqc="cam">${this.tileMap.isFollowing?.(agentId) ? '🎥 ' + t('停止跟拍') : '🎥 ' + t('跟拍')}</button>` : ''}
                <button class="nqc-detail" data-nqc="follow">${this._followSet().has(agentId) ? '🔕 ' + t('追蹤中') : '🔔 ' + t('追蹤')}</button>
                <button class="nqc-detail" data-nqc="detail">📋 ${t('詳情')}</button>
            </div>`;
        card.onclick = (e) => {
            const act = e.target?.dataset?.nqc;
            if (act === 'close') this._hideNpcCard();
            else if (act === 'chat') { this._hideNpcCard(); this._walkToAndChat(agentId); }
            else if (act === 'nudge') { this._nudgeDream(agentId); }
            else if (act === 'follow') { this._toggleFollow(agentId); this._showNpcCard(agentId); } // v5.48.0 追蹤(重繪按鈕狀態)
            else if (act === 'cam') { const on = this.tileMap?.isFollowing?.(agentId); this.tileMap?.followAgent?.(on ? null : agentId); this.bgm?.sfx?.('click'); this._showNpcCard(agentId); } // v6.29.0 跟拍
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
        document.getElementById('loc-quick-card')?.classList.add('hidden');
    },

    // v6.29.0 建築資訊卡:點地圖上的建築／名牌 → 誰在裡面、在做什麼、住戶、相關產業與提案
    _showLocationCard(locId) {
        const panel = document.querySelector('.map-panel'); const tm = this.tileMap; const w = this.world;
        if (!panel || !tm || !w || !locId) return;
        let card = document.getElementById('loc-quick-card');
        if (!card) { card = document.createElement('div'); card.id = 'loc-quick-card'; card.className = 'npc-quick-card loc-quick-card hidden'; panel.appendChild(card); }
        document.getElementById('npc-quick-card')?.classList.add('hidden');
        if (this._kairoReady && window.innerWidth <= 768) this._dismissKairoPanels?.();
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const sub = tm._houseSubZones?.[locId];
        const baseLoc = sub ? sub.parentLocId : locId;
        const zone = tm.buildingZones[locId] || tm.natureZones[locId];
        const lp = tm.labelPositions?.[baseLoc];
        const title = sub ? `${lp?.name ? t(lp.name) : this._locationLabel(baseLoc)} · ${t('房屋')} #${sub.houseIndex + 1}` : (lp?.name ? t(lp.name) : this._locationLabel(locId));
        const num = tm._labelIndex?.[baseLoc] || '';
        const loc = w.townMap?.locations?.[baseLoc];
        // 現在在這裡的人(以地圖上的實際位置判定,不是行程上的「去向」)
        const inside = [];
        for (const [aid, pos] of Object.entries(tm.agentPositions || {})) {
            if (aid === 'player') continue;
            const z = tm._isInsideBuilding?.(pos.x, pos.y);
            let here = false;
            if (sub) here = z === locId;
            else if (z) here = z === locId || tm.buildingZones[z]?.parentLocId === locId;
            else if (zone) here = pos.x >= zone.x * 16 && pos.x < (zone.x + zone.w) * 16 && pos.y >= zone.y * 16 && pos.y < (zone.y + zone.h) * 16;
            if (here) inside.push(aid);
        }
        const residents = sub && tm.getHouseResidents ? tm.getHouseResidents(locId) : [];
        const row = (aid) => { const a = this.state?.agents?.[aid]; if (!a) return ''; return `<div class="nqc-mood-row lqc-agent" data-lqc="agent" data-val="${aid}"><span>👤 ${esc(t(a.name))} <small>${esc(a.job?.title || '')}</small></span><span class="lqc-act">${esc(a.activity_label || a.activity || '')}</span></div>`; };
        // 相關:產業等級、工廠、建成建築、進行中／待決的建設提案
        const bits = [];
        const IND_LOC = { lumber: 'workshop', quarry: 'workshop', farming: 'farm', mining: 'workshop' };
        for (const [k, ind] of Object.entries(w.industry?.industries || {})) { const def = (typeof INDUSTRIES !== 'undefined') ? INDUSTRIES[k] : null; if (def && IND_LOC[k] === baseLoc) bits.push(`${def.icon} ${esc(t(def.name))} Lv${ind.level}`); }
        const PLACE = { watchtower: 'guardpost', granary: 'farm', marketplace: 'town_square', well_upgrade: 'well', training_ground: 'guardpost', brewery: 'tavern', garden: 'clinic', school: 'library', farm_irrigation: 'farm', forge_bellows: 'workshop', clinic_upgrade: 'clinic', town_walls: 'town_square' };
        for (const b of (w.buildings?.completed || [])) { const key = b.buildingKey || b.key; if (PLACE[key] === baseLoc) bits.push(`🏗️ ${esc(t(b.name))}`); }
        for (const p of (w.buildings?.projects || [])) { if (p.status === 'building' && PLACE[p.buildingKey || p.key] === baseLoc) bits.push(`🚧 ${esc(t(p.name))} ${Math.round((p.workDone || 0) / (p.workRequired || 1) * 100)}%`); }
        const props = (w.proposals?.items || []).filter(p => (p.status === 'open' || p.status === 'approved' || p.status === 'shelved') && p.kind === 'build' && PLACE[p.refKey] === baseLoc);
        for (const p of props) bits.push(`📜 ${p.id} ${esc(w.proposals.title(p))}${p.status === 'open' ? ` · ${t('待你決定')}` : ''}`);
        let html = `<button class="nqc-close" data-lqc="close">✕</button>
            <div class="nqc-name">${num ? `<span class="lqc-num">${num}</span>` : ''}${esc(title)}${loc?.category ? ` <span class="nqc-job">${esc(({ social: t('社交'), work: t('工作場所'), residential: t('住宅'), nature: t('自然') })[loc.category] || loc.category)}</span>` : ''}</div>`;
        if (loc?.description) html += `<div class="nqc-rel nqc-dim">${esc(t(loc.description))}</div>`;
        html += `<div class="nqc-mood-title">📍 ${t('現在在這裡')} <span class="lqc-count">${inside.length}</span></div>`;
        html += inside.length ? inside.slice(0, 8).map(row).join('') + (inside.length > 8 ? `<div class="nqc-rel nqc-dim">+${inside.length - 8}</div>` : '') : `<div class="nqc-rel nqc-dim">${t('這裡現在沒有人')}</div>`;
        if (sub) { html += `<div class="nqc-mood-title" style="margin-top:4px">🏠 ${t('住戶')} <span class="lqc-count">${residents.length}</span></div>`; html += residents.length ? residents.map(row).join('') : `<div class="nqc-rel nqc-dim">${t('這間房子目前沒有住戶。')}</div>`; }
        if (bits.length) html += `<div class="nqc-mood-title" style="margin-top:4px">${t('🔗 相關')}</div>` + bits.map(b => `<div class="nqc-rel">${b}</div>`).join('');
        html += `<div class="nqc-btns"><button class="nqc-detail" data-lqc="focus">🎥 ${t('定位')}</button>${props.some(p => p.status === 'open') ? `<button class="nqc-detail" data-lqc="proposals">📜 ${t('看提案')}</button>` : ''}</div>`;
        card.innerHTML = html;
        card.onclick = (e) => {
            const el = e.target.closest('[data-lqc]'); if (!el) return; const act = el.dataset.lqc;
            if (act === 'close') this._hideNpcCard();
            else if (act === 'agent') { this._hideNpcCard(); this._showNpcCard(el.dataset.val); }
            else if (act === 'focus') { tm.focusLocation?.(locId); }
            else if (act === 'proposals') { this._hideNpcCard(); this._goTab?.('proposals'); }
        };
        card.classList.remove('hidden');
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
        npc.memory.addT(this.world.tickCount, this.world.clock.timeStr, 'social', '{v}支持我的夢想,好感動!', { v: playerTitle(this.world) }, 6, ['player']);
        this.bgm?.sfx?.('coin');
        this.tileMap?.spawnFxOnAgent?.(agentId, '✨', { color: '#6bd5a0', burst: '⭐', burstCount: 6 });
        this._gameAlert(`✨ ${t('你鼓勵了')}${t(npc.name)}${t('追逐「')}${d?.name || ''}${t('」的夢想!')}`, npc.icon || '✨');
        this.state = this.world.getState();
        this._showNpcCard(agentId);
    },
});
