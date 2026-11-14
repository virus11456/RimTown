// RimTown - app-landing.js：從 app.js 拆出的 新手教學、第一天引導、任務引導、帳號選單、首頁（landing）、進入遊戲、登入視窗（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    setupTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return;
        if (localStorage.getItem('rimtown_tutorial_done')) return;
        if (!this.auth?.loggedIn) return; // 登入後才顯示教學
        overlay.classList.remove('hidden');
        this._tutorialStep = 0;
        this._tutorialTotalSteps = 6; // v5.97.0 加「每天要做的事」
        const dotsEl = document.getElementById('tutorial-dots');
        if (dotsEl) {
            dotsEl.innerHTML = '';
            for (let i = 0; i < this._tutorialTotalSteps; i++) {
                const dot = document.createElement('span');
                dot.className = 'tutorial-dot' + (i === 0 ? ' active' : '');
                dotsEl.appendChild(dot);
            }
        }
        this._showTutorialStep = (step) => {
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
                nextBtn.textContent = step === 0 ? t('開始旅程') : (step === this._tutorialTotalSteps - 1 ? t('進入遊戲') : t('下一步'));
            }
        };
        // Expose for inline onclick fallback
        window._rimtownApp = this;
        document.getElementById('tutorial-next')?.addEventListener('click', () => this._tutorialNext());
        document.getElementById('tutorial-prev')?.addEventListener('click', () => this._tutorialPrev());
        document.getElementById('tutorial-skip')?.addEventListener('click', () => this._dismissTutorial());
        this._showTutorialStep(0);
    },

    _tutorialNext() {
        if (this._tutorialStep < (this._tutorialTotalSteps || 5) - 1) {
            this._showTutorialStep?.(this._tutorialStep + 1);
        } else {
            this._dismissTutorial();
        }
    },

    _tutorialPrev() {
        if (this._tutorialStep > 0) this._showTutorialStep?.(this._tutorialStep - 1);
    },

    _dismissTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return;
        localStorage.setItem('rimtown_tutorial_done', '1');
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
        // Show quest guidance after tutorial
        setTimeout(() => this._updateQuestGuidance(), 1000);
        // v5.18.0 介紹跑完 → 開始「第一天因果鏈」引導
        setTimeout(() => { this._initFirstDay(); this._renderFirstDayGuide(); }, 1400);
    },

    // =====================================================
    // v5.18.0 第一天因果鏈:用一條可操作的動線教會核心循環
    //   觀察居民 → 發現矛盾 → 出手干預 → 留下選擇 → 看見後果
    //   證明「這座小鎮會記得你做過的事」
    // =====================================================
    _firstDaySteps() {
        return [
            { key: 'meet',        icon: '👀', label: t('認識一位居民'), hint: t('點地圖上任何一位居民,打開資訊卡,看看他現在在做什麼、心情從何而來。') },
            { key: 'relations',   icon: '💘', label: t('發現一段關係'), hint: t('打開「關係網」,看看鎮上誰喜歡誰、誰又跟誰鬧彆扭。') },
            { key: 'interact',    icon: '💬', label: t('出手互動'),     hint: t('找一位居民聊天,試試「意圖鈕」(安慰/打聽/示好…),看看你的一句話造成了什麼。') },
            { key: 'mark',        icon: '🎁', label: t('留下你的選擇'), hint: t('送一份禮物,或用「調解」幫某人化解心結——做一件會被記住的事。') },
            { key: 'consequence', icon: '🗞️', label: t('看見後果'),     hint: t('翻開首頁「今日頭條」並點一則新聞,看看小鎮怎麼記錄你參與的故事。') },
        ];
    },
    _initFirstDay() {
        if (this._firstDay) return;
        try { this._firstDay = JSON.parse(localStorage.getItem('rimtown_firstday') || 'null'); } catch (e) { this._firstDay = null; }
        if (!this._firstDay || typeof this._firstDay !== 'object') this._firstDay = { steps: {}, done: false, dismissed: false };
        if (!this._firstDay.steps) this._firstDay.steps = {};
    },
    _saveFirstDay() { try { localStorage.setItem('rimtown_firstday', JSON.stringify(this._firstDay)); } catch (e) {} },
    _firstDayActive() {
        this._initFirstDay();
        // 只在介紹教學跑完後、且尚未完成/略過時顯示
        if (!localStorage.getItem('rimtown_tutorial_done')) return false;
        if (this.world?._absDay && this.world._absDay() >= 4) return false; // v6.11.0 第 4 天起不再掛著「第一天」引導(早安卡與委託板接手;_absDay 第 1 天是 1)
        return !this._firstDay.done && !this._firstDay.dismissed;
    },
    _renderFirstDayGuide() {
        if (this.world?.observerMode) { document.getElementById('firstday-guide')?.remove(); return; } // v6.25.0 觀察者沒有第一天任務卡
        if (!this._firstDayActive()) { document.getElementById('firstday-guide')?.remove(); return; }
        const steps = this._firstDaySteps();
        const cur = steps.find(s => !this._firstDay.steps[s.key]);
        if (!cur) { this._completeFirstDay(); return; }
        let el = document.getElementById('firstday-guide');
        if (!el) { el = document.createElement('div'); el.id = 'firstday-guide'; el.className = 'firstday-guide'; (document.getElementById('rimtown-app') || document.body).appendChild(el); }
        const doneCount = steps.filter(s => this._firstDay.steps[s.key]).length;
        const pips = steps.map(s => `<span class="fd-pip ${this._firstDay.steps[s.key] ? 'done' : (s.key === cur.key ? 'active' : '')}">${this._firstDay.steps[s.key] ? '✓' : s.icon}</span>`).join('');
        el.innerHTML = `
            <button class="fd-close" data-action="firstday-skip" title="${t('略過教學')}">✕</button>
            <div class="fd-head"><span class="fd-tag">${t('第一天')}</span> <b>${cur.icon} ${cur.label}</b> <span class="fd-count">${doneCount}/5</span></div>
            <div class="fd-hint">${cur.hint}</div>
            <div class="fd-pips">${pips}</div>`;
    },
    _firstDayMark(key) {
        this._initFirstDay();
        if (this._firstDay.done || this._firstDay.dismissed) return;
        if (this._firstDay.steps[key]) return;
        this._firstDay.steps[key] = true;
        this._saveFirstDay();
        this._renderFirstDayGuide();
    },
    _dismissFirstDay() {
        this._initFirstDay();
        this._firstDay.dismissed = true;
        this._saveFirstDay();
        document.getElementById('firstday-guide')?.remove();
    },
    _completeFirstDay() {
        this._initFirstDay();
        if (this._firstDay.done) { document.getElementById('firstday-guide')?.remove(); return; }
        this._firstDay.done = true;
        this._saveFirstDay();
        document.getElementById('firstday-guide')?.remove();
        this._gameAlert(t('觀察居民 → 發現矛盾 → 出手干預 → 小鎮回應。從今天起,這座小鎮會記得你做過的每一件事。'), '🎉');
    },

    // === Quest Guidance System (post-tutorial contextual hints) ===
    _updateQuestGuidance() {
        const el = document.getElementById('quest-guidance');
        if (!el) return;
        // Don't show if user explicitly dismissed all guidance
        if (localStorage.getItem('rimtown_guidance_off')) { el.classList.add('hidden'); return; }
        if (this._firstDayActive?.()) { el.classList.add('hidden'); return; } // v6.12.0 第一天引導卡還在時不疊上方目標橫幅(兩邊講同一件事)
        // v5.59.0 TC-03:邊境鎮主線任務不在海風鎮顯示(卡司是邊境鎮居民,海風鎮主題任務鏈待做)
        if (typeof questChainFor === 'function' && !questChainFor(this.world?.townTheme)) { el.classList.add('hidden'); return; } // v5.83.0 沒有任務鏈的主題鎮才隱藏

        const qs = this.world?.questSystem;
        if (!qs) return;
        qs.init();

        // Find current active quest
        const activeQuest = (qs._main ? qs._main() : (typeof MAIN_QUESTS !== 'undefined' ? MAIN_QUESTS : [])).find(q => qs.quests[q.id]?.status === 'active');
        this._updateRequestBadge(); // v5.91.0 委託徽章 + 早上通知(v6.22.4 起主要由 app.js 渲染迴圈每秒呼叫,這裡保留給橫幅立即一致)
        if (!activeQuest) { // v5.91.0 主線跑完後,橫幅改提示第一件委託
            const rq = this.world?.observerMode ? null : this.world?.requests?.firstOpen?.();
            if (rq) { el.classList.remove('hidden'); el.querySelector('.quest-guidance-icon').textContent = this.world.requests.icon(rq); el.querySelector('.quest-guidance-title').textContent = `${t('今日委託：')}${this.world.requests.describe(rq)}`; el.querySelector('.quest-guidance-hint').textContent = `${this.world.requests.progress(rq, this.world)} · ${t('行動點')} ${this.world.requests.ap.left}/${this.world.requests.ap.max}`; return; }
            el.classList.add('hidden'); return;
        }

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
                hint = t('走到村民身邊按「交談」，或開啟「聊天」（手機:底部💬），選一位居民打招呼吧！');
            } else if (talked < 3) {
                hint = `${t('已和 ')}${talked}${t('/3 位居民交談。繼續點擊居民聊天吧！')}`;
            } else {
                hint = t('快完成了！任務即將自動結算。');
            }
        } else if (activeQuest.id === 'ch1_survive') {
            icon = '❄️';
            hint = t('有多種方式過冬：囤物資、交朋友或蓋建築。開啟「任務」（手機:☰選單）查看詳情。');
        } else if (activeQuest.id === 'ch1_industry') {
            icon = '🏭';
            hint = t('試試在「經濟→產業」開啟第一個產業（手機:☰選單→經濟），或和更多居民交流。');
        } else if (activeQuest.chapter === 2) {
            icon = '🌱';
            hint = t('小鎮開始成長了！開啟「任務」（手機:☰選單）了解當前目標。');
        } else if (activeQuest.chapter === 3) {
            icon = '⚔️';
            hint = t('危機即將到來，做好準備！開啟「任務」（手機:☰選單）了解詳情。');
        } else {
            hint = activeQuest.hint || activeQuest.description; // v5.83.0 主題鏈的任務自帶引導提示
        }

        // If there are active side quests, mention them
        const activeSides = (qs._side ? qs._side() : (typeof SIDE_QUESTS !== 'undefined' ? SIDE_QUESTS : []))
            .filter(sq => qs.sideQuests?.[sq.id]?.status === 'active');
        if (activeSides.length > 0) {
            hint += `${t(' | 📖 支線：')}${activeSides[0].title}`;
        }

        el.querySelector('.quest-guidance-icon').textContent = icon;
        el.querySelector('.quest-guidance-title').textContent = `${t('目前目標：')}${title}`;
        el.querySelector('.quest-guidance-hint').textContent = hint;
        // v5.63.0 目前任務 id 記在元素上,× 的處理函式讀這裡——原本閉包抓的是第一次
        // 顯示時的任務 id,任務換了之後按 × 記錯 id,下一個 tick 又彈回來(手機版看起來就是關不掉)
        el.dataset.questId = activeQuest.id;
        // 這個任務的引導已被關掉就維持隱藏,不再先顯示再隱藏(避免閃一下)
        if (this._guidanceDismissedQuestId === activeQuest.id) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');

        // Wire up dismiss
        const dismissBtn = el.querySelector('.quest-guidance-dismiss');
        if (dismissBtn && !dismissBtn._wired) {
            dismissBtn._wired = true;
            const dismiss = (ev) => {
                ev.preventDefault(); ev.stopPropagation();
                el.classList.add('hidden');
                // Will re-show on next quest change, not permanently off
                this._guidanceDismissedQuestId = el.dataset.questId || activeQuest.id;
            };
            dismissBtn.addEventListener('click', dismiss);
            dismissBtn.addEventListener('touchend', dismiss, { passive: false }); // 手機版直接吃 touchend,不等 click 合成
        }
    },

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
        // v6.44.1 小手機橫放(568×320)時選單比畫面高,登出被切掉:超出就往上挪,再不夠就限高、選單內捲動
        // v6.48.1 選單開著時旋轉螢幕／縮放視窗也要重新排(以前只在打開那一刻算一次)
        const fit = () => {
            if (!popup.isConnected) { window.removeEventListener('resize', fit); window.visualViewport?.removeEventListener?.('resize', fit); window.removeEventListener('orientationchange', fit); return; }
            try {
                popup.style.top = ''; popup.style.maxHeight = '';
                const vh = window.visualViewport?.height || window.innerHeight, r = popup.getBoundingClientRect(), pad = 8;
                if (r.bottom > vh - pad) { popup.style.top = Math.max(pad, vh - pad - r.height) + 'px'; popup.style.maxHeight = (vh - pad * 2) + 'px'; }
            } catch (e) {}
        };
        fit();
        window.addEventListener('resize', fit); window.visualViewport?.addEventListener?.('resize', fit); window.addEventListener('orientationchange', fit);

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
    },

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
    },

    async _syncToCloud() {
        if (!this.auth.loggedIn) return;
        this._unlockAchievement('cloud_sync');
        try {
            const saveData = this.world.serialize();
            const clock = saveData.clock || {};
            const r = await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                season: clock.season, year: clock.year, day: clock.day,
                population: Object.keys(saveData.agents || {}).length,
            });
            // v6.43.9 以前只寫進紀錄,手機上看不到,按了像沒反應;現在一律跳通知
            if (r && r.stale) {
                this.world.logMessage('system', t('雲端已有較新的進度，這次沒有覆蓋。'));
                this._showCornerNotice?.({ icon: '☁️', title: t('雲端已有較新的進度'), name: '', desc: t('這次沒有覆蓋。要用較新的進度，請按「從雲端下載存檔」。') });
            } else {
                this.world.logMessage('system', t('已同步至雲端。'));
                this._showCornerNotice?.({ icon: '☁️', title: t('已上傳到雲端'), name: '', desc: `${t('第 {y} 年{s}').split('{y}').join(clock.year || 1).split('{s}').join(t(clock.season || '春季'))} ${t('第 {d} 天').split('{d}').join(clock.day || 1)}` });
            }
        } catch (e) {
            console.error('[RimTown] Cloud sync error:', e);
            this.world.logMessage('system', t('雲端同步失敗。'));
            this._gameAlert?.(t('上傳到雲端失敗，請稍後再試。本機存檔不受影響。'), '☁️');
        }
    },

    // 首頁的畫面在 landing-page.js(只有 index.html 載入);這裡只留顯示／隱藏、進入遊戲、登入視窗
    _showLanding() {
        const el = document.getElementById('landing');
        if (!el) return;
        el.classList.remove('hidden', 'fade-out');
        document.body.classList.add('landing-open');
        try { window.scrollTo(0, 0); } catch (e) {}
    },
    _hideLanding() {
        try { if (typeof LANDING3D !== 'undefined') LANDING3D.unmount(); } catch (e) {}
        const el = document.getElementById('landing');
        if (!el) return;
        el.classList.add('fade-out');
        document.body.classList.remove('landing-open');
        setTimeout(() => el.classList.add('hidden'), 420);
        this._landingActive = false;
    },
    // 已登入:世界載好後把「繼續遊戲」按鈕打開,附上城鎮與日期
    _landingUpdateContinue() {
        const btn = document.getElementById('landing-continue');
        if (!btn) return;
        if (!this._initReady) { btn.disabled = true; btn.innerHTML = `▶ ${t('載入中…')}`; return; }
        const meta = this._getTownList().find(tw => tw.id === this.currentTownId);
        const name = (meta && meta.name) || this._getCurrentTownName?.() || '邊境鎮';
        const c = this.world?.clock;
        const when = c ? `${t('第')}${c.year}${t('年')} ${c.season} ${t('第')}${c.day}${t('天')}` : '';
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        btn.disabled = false;
        btn.innerHTML = `▶ ${t('繼續遊戲')}<span class="landing-continue-sub">${esc(name)}${when ? ' · ' + esc(when) : ''}</span>`;
    },
    async _enterGame() {
        const btn = document.getElementById('landing-continue');
        if (!this._initReady) { if (btn) { btn.disabled = true; btn.innerHTML = `▶ ${t('載入中…')}`; } return; }
        this._hideLanding();
        if (this._pausedForLanding) { this._pausedForLanding = false; if (this.world) this.world.paused = false; }
        try { this.render(); } catch (e) {}
        try { this.setupTutorial(); } catch (e) {}
        if (this._afterLanding) { const f = this._afterLanding; this._afterLanding = null; try { f(); } catch (e) {} }
        // 手機:進遊戲後重算地圖尺寸
        setTimeout(() => { if (this.tileMap) this.tileMap._needsResize = true; try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 100);
    },
    // 開啟帳號視窗到指定分頁(首頁用)
    _openAuth(tab) {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const closeBtn = modal.querySelector('.auth-close-btn');
        if (closeBtn) closeBtn.style.display = '';
        document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === tab));
        document.getElementById('auth-login-form')?.classList.toggle('hidden', tab !== 'login');
        document.getElementById('auth-register-form')?.classList.toggle('hidden', tab !== 'register');
        document.getElementById('auth-reset-form')?.classList.add('hidden');
        setTimeout(() => document.getElementById(tab === 'login' ? 'auth-login-user' : 'auth-reg-user')?.focus(), 50);
    },
});
