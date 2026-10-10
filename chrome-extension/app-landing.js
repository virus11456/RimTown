// RimTown - app-landing.js：從 app.js 拆出的 新手教學、第一天引導、任務引導、帳號選單、首頁（landing）、進入遊戲、登入視窗（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    setupTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return;
        if (localStorage.getItem('rimtown_tutorial_done')) return;
        // Don't show tutorial before login or guest mode
        if (!this.auth?.loggedIn && !this.guestMode) return;
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
        return !this._firstDay.done && !this._firstDay.dismissed;
    },
    _renderFirstDayGuide() {
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
        // v5.59.0 TC-03:邊境鎮主線任務不在海風鎮顯示(卡司是邊境鎮居民,海風鎮主題任務鏈待做)
        if (typeof questChainFor === 'function' && !questChainFor(this.world?.townTheme)) { el.classList.add('hidden'); return; } // v5.83.0 沒有任務鏈的主題鎮才隱藏

        const qs = this.world?.questSystem;
        if (!qs) return;
        qs.init();

        // Find current active quest
        const activeQuest = (qs._main ? qs._main() : (typeof MAIN_QUESTS !== 'undefined' ? MAIN_QUESTS : [])).find(q => qs.quests[q.id]?.status === 'active');
        this._updateRequestBadge(); // v5.91.0 委託徽章 + 早上通知
        if (!activeQuest) { // v5.91.0 主線跑完後,橫幅改提示第一件委託
            const rq = this.world?.requests?.firstOpen?.();
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
        } else if (this.guestMode) {
            btn.textContent = t('訪客');
            btn.className = 'btn-account guest-mode';
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
            await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                season: clock.season, year: clock.year, day: clock.day,
                population: Object.keys(saveData.agents || {}).length,
            });
            this.world.logMessage('system', t('已同步至雲端。'));
        } catch (e) {
            console.error('[RimTown] Cloud sync error:', e);
            this.world.logMessage('system', t('雲端同步失敗。'));
        }
    },

    // ============================================================
    // v5.68.0 首頁(Landing):遊戲介紹 + 更新紀錄 + 路線圖;一律要登入才能進遊戲
    // 未登入:只顯示註冊/登入;已登入:顯示「繼續遊戲」(世界在底下載好、暫停等你按)
    // ============================================================
    _renderLanding() {
        const el = document.getElementById('landing');
        if (!el) return;
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const ver = typeof RIMTOWN_APP_VERSION !== 'undefined' ? RIMTOWN_APP_VERSION : '';
        const loggedIn = !!this.auth.loggedIn;
        const cta = loggedIn
            ? `<button class="landing-btn primary" id="landing-continue" disabled>▶ ${t('載入中…')}</button>
               <button class="landing-btn secondary" id="landing-logout">${t('登出')}</button>`
            : `<button class="landing-btn primary" id="landing-register">✨ ${t('註冊')}</button>
               <button class="landing-btn secondary" id="landing-login">🔑 ${t('登入')}</button>`;
        const features = [
            ['🧠', t('會記得你的村民'), t('五座城鎮、近百位村民各有性格、記憶與人際關係。你說過的話、送過的禮，他們都記得，也會拿去跟別人八卦。')],
            ['💬', t('真的在聊天'), t('對話由內建 AI 生成，不用填任何金鑰。安慰、打聽、說服、調解、示好、威脅，每一句都會改變關係。')],
            ['🐎', t('多鎮往返'), t('邊境鎮之外還有漁村海風鎮、山上的礦山鎮、密林裡的林間村、平原樞紐市集城，五座城鎮各有自己的地圖、卡司與故事。搭馬車過去作客，村民也會跨鎮互訪，把別鎮的故事帶回來。')],
            ['📖', t('任務與多重結局'), t('每天有委託要排、商隊要押、季度考驗要撐；五座城鎮各有五章主線與專屬災難，每章兩條路線。旅人會升級選天賦，每句話都有成功率。你可以參選鎮長，也可以只當個看戲的旅人。')],
        ];
        const roadmap = [
            [t('開發中'), '#34d399', [t('3D low-poly 版（Blender + Godot 重製）') + ' · ' + t('已可操作旅人，建設／任務／人口持續驗證')]],
            [t('構想'), '#60a5fa', [t('玩家之間互訪城鎮'), t('手機 App 版')]],
        ];
        // v5.81.0 更新紀錄(240KB)不再隨頁面載入:首頁第一次畫時才動態載 changelog.js,載完重畫一次;直接進遊戲的人完全不載
        if (typeof RIMTOWN_CHANGELOG === 'undefined' && !this._changelogLoading) {
            this._changelogLoading = true;
            const sc = document.createElement('script');
            sc.src = 'changelog.js?v=' + encodeURIComponent(RIMTOWN_APP_VERSION);
            sc.onload = () => { if (this._landingActive) { try { this._renderLanding(); } catch (e) {} } };
            document.head.appendChild(sc);
        }
        const log = (typeof RIMTOWN_CHANGELOG !== 'undefined' && Array.isArray(RIMTOWN_CHANGELOG)) ? RIMTOWN_CHANGELOG : [];
        const logHtml = log.map((e, i) => `<div class="landing-log-item${i >= 5 ? ' extra' : ''}">
                <div class="landing-log-head"><span>${String(e.version).startsWith('Godot') ? '' : 'v'}${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('');
        el.innerHTML = `<div class="landing-inner">
            <header class="landing-hero">
                <div class="landing-pixel-bg" aria-hidden="true"></div>
                <div class="landing-lang" role="group" aria-label="Language">
                    <button type="button" data-lang="zh" class="${I18N.getLang() === 'zh' ? 'active' : ''}">中文</button><button type="button" data-lang="en" class="${I18N.getLang() === 'en' ? 'active' : ''}">EN</button>
                </div>
                <div class="landing-hero-content">
                    <div class="landing-logo">🏘️</div>
                    <h1>${t('邊境鎮')}<span>RimTown</span></h1>
                    <p class="landing-tagline">${t('一座由 AI 村民自己過日子的小鎮。你是剛到的旅人。')}</p>
                    <p class="landing-sub">${t('村民有記憶、有個性、有人際關係；他們會工作、戀愛、吵架、選鎮長。你可以聊天、送禮、耳語、蓋房子、開產業，甚至參選。')}</p>
                    <div class="landing-cta">${cta}</div>
                    <div class="landing-version">v${esc(ver)} · ${t('免安裝，手機也能玩')}${loggedIn ? ` · ${esc(this.auth.username)}` : ''}</div>
                </div>
            </header>
            <section class="landing-section"><h2>${t('這是什麼遊戲')}</h2>
                <div class="landing-cards">${features.map(f => `<div class="landing-card"><div class="ic">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div>
            </section>
            ${this._renderBrainSection()}
            <section class="landing-section"><h2>${t('更新紀錄')}</h2>
                <div class="landing-log" id="landing-log">${logHtml || `<div class="landing-log-item">${t('尚無紀錄')}</div>`}</div>
                ${log.length > 5 ? `<button class="landing-more" id="landing-log-more">${t('顯示全部')} (${log.length})</button>` : ''}
            </section>
            <section class="landing-section"><h2>${t('即將實現')}</h2>
                <div class="landing-roadmap">${roadmap.map(r => `<div class="landing-roadmap-col"><h3><span class="landing-tag" style="background:${r[1]};color:#111">${r[0]}</span></h3><ul>${r[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
            </section>
            <section class="landing-section landing-preview" id="landing-preview"><h2>🧊 ${t('3D 測試圖集・開發中')}</h2>
                <p>${t('實際 Godot 測試截圖，含預設測試情境。官網目前仍是 2D 版；以下功能屬於獨立 3D 測試版。')}</p>
                <div class="landing-test-gallery">
                    <figure><a href="img/godot-site-preview-desktop.png" target="_blank" rel="noopener"><img src="img/godot-site-preview-desktop.png" alt="${t('建設選址：確認空地後才扣料施工。')}" loading="lazy"></a><figcaption>${t('建設選址：確認空地後才扣料施工。')}</figcaption></figure>
                    <figure><a href="img/godot-quests-personal-desktop.png" target="_blank" rel="noopener"><img src="img/godot-quests-personal-desktop.png" alt="${t('居民任務：查看故事、好感與章節門檻。')}" loading="lazy"></a><figcaption>${t('居民任務：查看故事、好感與章節門檻。')}</figcaption></figure>
                    <figure><a href="img/godot-population-family-desktop.png" target="_blank" rel="noopener"><img src="img/godot-population-family-desktop.png" alt="${t('人口與家庭：出生紀錄、移入及住宅容量。')}" loading="lazy"></a><figcaption>${t('人口與家庭：出生紀錄、移入及住宅容量。')}</figcaption></figure>
                    <figure><a href="img/godot-hearts-desktop.png" target="_blank" rel="noopener"><img src="img/godot-hearts-desktop.png" alt="${t('友情與心動：已觸發事件與關係里程碑。')}" loading="lazy"></a><figcaption>${t('友情與心動：已觸發事件與關係里程碑。')}</figcaption></figure>
                </div>
                <p>${t('點圖片可查看原圖。任務與關係畫面含測試資料，不代表自然通關。')}</p>
                <p>${t('3D 版 AI 聊天邀約尚未建立赴約行程；全路線自然通關仍在驗證。')}</p>
            </section>
            <footer class="landing-footer">${t('邊境鎮 RimTown')} · v${esc(ver)}<br>${t('存檔自動同步雲端，換裝置登入即可繼續。')}</footer>
        </div>`;
        this._wireBrainDemo(el);
        // v5.74.1 首頁語言切換:切完整頁重畫(首頁本身全部字串都有英文對照)
        el.querySelectorAll('.landing-lang [data-lang]').forEach(b => b.addEventListener('click', () => {
            const v = b.getAttribute('data-lang');
            if (v === I18N.getLang()) return;
            I18N.setLang(v);
            this._renderLanding();
            if (typeof renderCurrentTab === 'function') { try { renderCurrentTab(); } catch (e) {} }
        }));
        el.querySelector('#landing-register')?.addEventListener('click', () => this._openAuth('register'));
        el.querySelector('#landing-login')?.addEventListener('click', () => this._openAuth('login'));
        el.querySelector('#landing-continue')?.addEventListener('click', () => this._enterGame());
        el.querySelector('#landing-logout')?.addEventListener('click', () => this._doLogout());
        el.querySelector('#landing-log-more')?.addEventListener('click', (ev) => {
            const box = el.querySelector('#landing-log'); if (!box) return;
            const expanded = box.classList.toggle('expanded');
            ev.currentTarget.textContent = expanded ? t('只看最近 5 版') : `${t('顯示全部')} (${log.length})`;
        });
        this._landingUpdateContinue();
    },
    // ============================================================
    // v5.69.0 首頁「村民的大腦」:村民怎麼社交——感知/挑人/八卦/對話/效果/記憶/反思/計畫
    // 內容直接讀遊戲常數(TRAIT_POOL / THOUGHT_DEFS / REL_TYPES),數字與程式一致
    // ============================================================
    _renderBrainSection() {
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const steps = [
            ['👀', t('感知'), t('每 15 分鐘（1 tick）看一次同地點還醒著的人。睡覺的人不會主動搭話。')],
            ['🎯', t('挑對象'), t('權重 = 5 ＋ 好感÷10 ＋ 心動÷10；好感低於 −30 的人權重大減。互動後冷卻 6 tick。')],
            ['🗣️', t('八卦'), t('30% 機率先講一則八卦。八卦性格的人一定講，其他人 30%。傳到第 2 手有 40% 會被誇大，20% 的八卦本來就是假的。')],
            ['🍻', t('約出去'), t('好感 ≥ 30 時 12% 機率相約去酒館、公園、廣場、教堂、森林或圖書館；心動 > 40 就算約會。')],
            ['💬', t('對話'), t('玩家附近的對話由內建 AI 生成（受每日額度限制）；遠處的對話走規則式模板，但同樣寫進記憶。')],
            ['📈', t('效果'), t('對話改變雙方好感（−2 到 +5）與心動；正向增幅乘上性格相容度 0.2 到 1.6。約定會寫成「計畫」記憶，情緒波動大就當場改寫今天剩下的行程。')],
            ['🧠', t('記憶'), t('每人 500 條記憶流。對話寫進「他會記住的那句話」，重要度 4 到 8。')],
            ['🌙', t('反思與計畫'), t('每晚合成 1 到 2 條想法（跟誰走得近、暗戀、夢想）；每天最多 3 位由 AI 深度反思。清晨依記憶排今日行程。')],
        ];
        const traitFx = tr => {
            const d = tr || {}; const out = [];
            if (d.social) out.push(`${t('社交')} ${d.social > 0 ? '+' : ''}${d.social}`);
            if (d.work) out.push(`${t('工作')} ${d.work > 0 ? '+' : ''}${d.work}`);
            if (d.mood_base) out.push(`${t('基礎心情')} ${d.mood_base > 0 ? '+' : ''}${d.mood_base}`);
            if (d.mood_sensitivity) out.push(`${t('情緒敏感')} ×${d.mood_sensitivity}`);
            if (d.romance) out.push(`${t('戀愛')} ${d.romance > 0 ? '+' : ''}${d.romance}`);
            if (d.schedule) out.push(d.schedule === 'late' ? t('晚睡') : t('早起'));
            if (d.food) out.push(`${t('食量')} ×${d.food}`);
            if (d.comfort) out.push(`${t('舒適')} ${d.comfort}`);
            return out.join(' · ');
        };
        const traits = (typeof TRAIT_POOL !== 'undefined') ? Object.entries(TRAIT_POOL) : [];
        const traitChips = traits.map(([k, d]) => `<span class="landing-chip" title="${esc(d.description || '')}">${esc(t(d.label || k))}<small>${esc(traitFx(d))}</small></span>`).join('');
        const incompat = (typeof INCOMPATIBLE !== 'undefined') ? INCOMPATIBLE.map(([a, b]) => `${esc(t(TRAIT_POOL[a]?.label || a))} × ${esc(t(TRAIT_POOL[b]?.label || b))}`).join(t('、')) : '';
        const values = ['家庭', '自由', '知識', '財富', '權力', '藝術', '自然', '社群', '冒險', '和平'].map(v => `<span class="landing-chip small">${t(v)}</span>`).join('');
        const thoughts = (typeof THOUGHT_DEFS !== 'undefined') ? Object.values(THOUGHT_DEFS) : [];
        const thoughtRows = thoughts.map(d => `<tr><td>${esc(t(d.label))}</td><td class="${d.mood >= 0 ? 'pos' : 'neg'}">${d.mood > 0 ? '+' : ''}${d.mood}</td><td>${d.days}</td><td>${d.opinion ? (d.opinion > 0 ? '+' : '') + d.opinion : '—'}</td></tr>`).join('');
        const ladder = [
            ['≥ 61', t('摯友')], ['21 ~ 60', t('朋友')], ['−19 ~ 20', t('認識 / 陌生人')], ['−59 ~ −20', t('對手')], ['≤ −60', t('敵人')],
        ].map(([r, l]) => `<div class="landing-ladder-row"><span>${r}</span><b>${l}</b></div>`).join('');
        return `<section class="landing-section landing-brain" id="landing-brain"><details class="landing-fold"><summary><h2>${t('村民的大腦：他們是怎麼社交的')}</h2><span class="landing-fold-hint">${t('點開看完整的運作方式')}</span></summary>
            <p class="landing-brain-intro">${t('沒有劇本。每位村民每 15 分鐘做一次決定，靠的是自己的記憶、性格和跟對方的關係。下面是一輪社交的完整流程，數字都是遊戲裡實際用的參數。')}</p>
            <div class="landing-steps">${steps.map((s, i) => `<div class="landing-step"><div class="landing-step-no">${i + 1}</div><div class="landing-step-ic">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join('')}</div>

            <div class="landing-brain-grid">
                <div class="landing-card">
                    <h3>🧠 ${t('記憶流與檢索')}</h3>
                    <p>${t('每條記憶有時間、類別、內容、重要度（1 到 10）、涉及的人。要說話或做計畫時，不是翻全部，而是用三個分數挑出最該想起的幾條：')}</p>
                    <div class="landing-formula">${t('分數')} = 0.5 × ${t('時近')} + 3 × ${t('相關')} + 2 × ${t('重要度')}</div>
                    <ul class="landing-list">
                        <li><b>${t('時近')}</b>：0.85 ^ ${t('已過天數')}${t('，一週前的事只剩三成份量。')}</li>
                        <li><b>${t('相關')}</b>：${t('內容與當下話題的字元重疊度，加上「有沒有提到眼前這個人」。')}</li>
                        <li><b>${t('重要度')}</b>：${t('表白、絕交、劈腿這類事件是 8 到 10；日常觀察只有 2。')}</li>
                    </ul>
                    <div class="landing-demo" id="landing-mem-demo">
                        <div class="landing-demo-title">${t('自己調調看：一條記憶會被想起來嗎？')}</div>
                        <label>${t('已過天數')} <span data-out="age">3</span><input type="range" min="0" max="30" value="3" data-k="age"></label>
                        <label>${t('重要度')} <span data-out="imp">6</span><input type="range" min="1" max="10" value="6" data-k="imp"></label>
                        <label>${t('相關程度')} <span data-out="rel">0.5</span><input type="range" min="0" max="100" value="50" data-k="rel"></label>
                        <div class="landing-demo-score">${t('分數')} <b data-out="score">—</b> <span data-out="verdict"></span></div>
                    </div>
                </div>
                <div class="landing-card">
                    <h3>🎭 ${t('性格參數')}</h3>
                    <p>${t('每人出生時抽 3 個特質（互斥的不會同時出現），加上 1 到 3 個價值觀。特質決定社交加成、工作效率、基礎心情、情緒敏感度與戀愛傾向。')}</p>
                    <div class="landing-chips">${traitChips}</div>
                    <p class="landing-muted">${t('互斥：')}${incompat}</p>
                    <p><b>${t('價值觀')}</b>：${values}</p>
                    <p><b>${t('相容度')}</b>：${t('善良配善良、魅力配害羞、沉穩配神經質會加分；刻薄配害羞、樂觀配悲觀、懶惰配勤勞會扣分。換算成 0.2 到 1.6 的倍率，乘在每次好感增幅上。')}</p>
                    <p><b>${t('六項需求')}</b>：${t('飢餓、休息、社交、舒適、娛樂、美感。白天每 tick 飢餓 −2、休息 −1.5、社交 −1；夜裡衰減放慢。任一項見底就拖累心情，心情又決定他今天想不想理人。')}</p>
                </div>
                <div class="landing-card">
                    <h3>💞 ${t('關係階梯')}</h3>
                    <p>${t('對每個人各記三個數：好感（−100 到 100）、信任、心動（0 到 100）。好感決定稱呼，心動超過 50 就是暗戀。')}</p>
                    <div class="landing-ladder">${ladder}</div>
                    <ul class="landing-list">
                        <li>${t('50 tick 沒互動，好感每天往 0 漂 0.8；情侶夫妻只漂 0.3。')}</li>
                        <li>${t('好感 > 20 且互動超過 3 次，相配的人每天 45% 機率心動 +1 到 +5；高好感高相配還有 6% 的「來電火花」+8 到 +16。')}</li>
                        <li>${t('雙方好感 ≤ −35：每隔 5 天 15% 機率在廣場對嗆；雙方 ≤ −60：正式絕交，觸發劇情名場面。')}</li>
                        <li>${t('聽到自己被造謠會當面對質，造謠者好感 −12；紅娘式八卦會讓兩位當事人開始注意彼此。')}</li>
                        <li>${t('戲劇導演每天看一眼全鎮：太平靜就悄悄推一把暗戀、舊帳或吃醋。')}</li>
                    </ul>
                </div>
                <div class="landing-card">
                    <h3>🌤️ ${t('想法與心情')}</h3>
                    <p>${t('事件會留下有期限的「想法」，直接加減心情，有些還會改變對當事人的看法：')}</p>
                    <div class="landing-table-wrap"><table class="landing-table"><thead><tr><th>${t('想法')}</th><th>${t('心情')}</th><th>${t('持續天數')}</th><th>${t('對人看法')}</th></tr></thead><tbody>${thoughtRows}</tbody></table></div>
                </div>
            </div>
            <p class="landing-muted landing-brain-foot">${t('成本閘門：只有玩家附近的對話與每日額度內的行程／反思會呼叫 AI，其餘一律規則式運算，所以一整鎮 20 多人同時「活著」也不會燒錢。')}</p>
            ${this._renderTechDetails()}
        </details></section>`;
    },
    // v5.70.0 首頁「技術細節」摺疊區:一次 AI 請求的旅程、兩個 AI 怎麼協作
    _renderTechDetails() {
        const flow = [
            ['🗣️', t('玩家附近發生對話')],
            ['📝', t('組提示詞')],
            ['⚡', t('快車道 Groq')],
            ['🤝', t('失敗就換 Claude 接手')],
            ['🛡️', t('守門：拒答／洩漏／簡體')],
            ['🧠', t('寫回記憶與關係')],
        ];
        const ingredients = [
            [t('身分行'), t('「你是某某，對面是來到鎮上的旅人，不是鎮長；現任鎮長是誰」——避免叫錯人')],
            [t('抽出的記憶'), t('用時近×相關×重要度挑出最該想起的 3 到 6 條，不是整本翻')],
            [t('關係數字'), t('對這個人的好感、信任、心動，以及目前的稱呼（朋友／對手／暗戀）')],
            [t('今天的計畫'), t('清晨排好的行程與現在正在做的事，讓對話有上下文')],
            [t('性格與心情'), t('三個特質、價值觀、當下心情與最近的想法')],
            [t('輸出格式'), t('只准輸出台詞與 EFFECTS 行（好感／心動／記憶變動），不准前言、分析、免責聲明')],
        ];
        const lanes = [
            [t('快車道 chat'), t('玩家附近的即時對話'), t('Groq（開源模型）'), t('Claude'), '12s → 15s'],
            [t('慢車道 background'), t('每日行程、深度反思、八卦與劇情'), t('Claude'), t('Groq'), '15s → 12s'],
        ];
        const handoff = [
            t('兩條路共用一個 26 秒預算（無伺服器函式上限 30 秒），第一條用掉多少，第二條就只剩多少。'),
            t('逾時、限流（429）、伺服器錯誤：那條路冷卻。Groq 依回傳的重試時間冷卻，最短 5 分鐘；Claude 每失敗一次冷卻多 60 秒，上限 5 分鐘，成功即解除。'),
            t('回空白或拒絕扮演不算那條路壞掉，不冷卻，只是這一次換人。'),
            t('每次回應都帶著 provider、lane、model 與 fallback_from，出問題可以直接從紀錄看出是哪一段接手的。'),
        ];
        const quota = [
            t('每次 Groq 回應都會讀 x-ratelimit 標頭，記下剩餘 token、剩餘請求數與重置時間。'),
            t('下一次請求先估算要用多少：中文每字算 1 token，其他每 4 個字元算 1，再加輸出上限（至少 160）與 50 的緩衝。'),
            t('估算超過剩餘額度就直接跳過 Groq 改走 Claude，不會撞到 429 才發現。'),
            t('推理型模型（gpt-oss）固定輸出下限 160 token、推理強度 low、隱藏推理過程，避免它「想太久」回空白。'),
        ];
        const guard = [
            t('系統指示寫死：一律繁體中文（台灣用語）、不准自報 AI 身分、不准拒絕扮演、不准加前言。'),
            t('回覆若出現「I\'m Kiro / I am an AI / not designed for roleplay」這類句型，視同失敗，換另一條路重打。'),
            t('伺服器端先做簡轉繁（OpenCC 台灣用語），前端再掃一次；載入舊存檔時也會把殘留的簡體與洩漏句清掉。'),
            t('每位村民 500 條記憶上限，對話結束後只把「他會記住的那句話」寫進去，重要度 4 到 8。'),
        ];
        const cost = [
            t('只有玩家附近的村民才會呼叫 AI 對話，遠處的走規則式模板，但一樣寫進記憶、一樣影響好感。'),
            t('每天有 AI 額度：行程一批打包成一次請求（每人約 450 token），深度反思每天最多 3 位。'),
            t('Groq 免費層大約每分鐘 30 次、每天 1,000 次、每分鐘 8,000 token；超過就自動改走付費的 Claude，玩家不會感覺到斷線。'),
        ];
        const esc = (x) => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        return `<details class="landing-tech" id="landing-tech">
            <summary>🔧 ${t('想看更深的技術細節：一次 AI 請求的旅程、兩個 AI 怎麼協作')}</summary>
            <div class="landing-tech-body">
                <div class="landing-flow">${flow.map((f, i) => `<div class="landing-flow-step"><span class="landing-flow-ico">${f[0]}</span><span>${esc(f[1])}</span></div>${i < flow.length - 1 ? '<span class="landing-flow-arrow">→</span>' : ''}`).join('')}</div>
                <h4>① ${t('提示詞怎麼組')}</h4>
                <p class="landing-muted">${t('一次對話只打一個請求，裡面把村民「此刻腦子裡的東西」全部塞進去：')}</p>
                <dl class="landing-dl">${ingredients.map(x => `<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl>
                <h4>② ${t('兩條車道：誰先上')}</h4>
                <div class="landing-table-wrap"><table class="landing-table"><thead><tr><th>${t('車道')}</th><th>${t('用在哪')}</th><th>${t('先問誰')}</th><th>${t('備援')}</th><th>${t('時限')}</th></tr></thead><tbody>${lanes.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                <p class="landing-muted">${t('即時對話要快，所以先問回應最快的 Groq；行程與反思要寫得細，所以先問 Claude。兩邊互為備援。')}</p>
                <h4>③ ${t('互相接手與冷卻')}</h4>
                <ul class="landing-list">${handoff.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>④ ${t('免費額度保護')}</h4>
                <ul class="landing-list">${quota.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑤ ${t('品質守門')}</h4>
                <ul class="landing-list">${guard.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑥ ${t('成本閘門')}</h4>
                <ul class="landing-list">${cost.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <p class="landing-muted">${t('金鑰全部放在伺服器環境變數，前端與存檔裡都沒有；玩家不需要、也不能填自己的金鑰。')}</p>
            </div>
        </details>`;
    },
    _wireBrainDemo(root) {
        const box = root.querySelector('#landing-mem-demo');
        if (!box) return;
        const upd = () => {
            const age = parseFloat(box.querySelector('[data-k="age"]').value);
            const imp = parseFloat(box.querySelector('[data-k="imp"]').value);
            const rel = parseFloat(box.querySelector('[data-k="rel"]').value) / 100;
            const score = 0.5 * Math.pow(0.85, age) + 3 * rel + 2 * (imp / 10);
            box.querySelector('[data-out="age"]').textContent = age;
            box.querySelector('[data-out="imp"]').textContent = imp;
            box.querySelector('[data-out="rel"]').textContent = rel.toFixed(2);
            box.querySelector('[data-out="score"]').textContent = score.toFixed(2);
            const v = box.querySelector('[data-out="verdict"]');
            v.textContent = score >= 3.2 ? t('→ 幾乎一定會想起來') : score >= 2.2 ? t('→ 有機會被想起') : t('→ 大概忘了');
            v.style.color = score >= 3.2 ? '#34d399' : score >= 2.2 ? '#fbbf24' : '#f87171';
        };
        box.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', upd));
        upd();
    },

    _showLanding() {
        const el = document.getElementById('landing');
        if (!el) return;
        el.classList.remove('hidden', 'fade-out');
        document.body.classList.add('landing-open');
        try { window.scrollTo(0, 0); } catch (e) {}
    },
    _hideLanding() {
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
        const name = (meta && meta.name) || this._getCurrentTownName?.() || t('邊境鎮');
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
    // 開啟帳號視窗到指定分頁(首頁用):不顯示訪客試玩
    _openAuth(tab) {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        const closeBtn = modal.querySelector('.auth-close-btn');
        if (closeBtn) closeBtn.style.display = '';
        document.getElementById('auth-guest-section')?.classList.add('hidden');
        document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === tab));
        document.getElementById('auth-login-form')?.classList.toggle('hidden', tab !== 'login');
        document.getElementById('auth-register-form')?.classList.toggle('hidden', tab !== 'register');
        document.getElementById('auth-reset-form')?.classList.add('hidden');
        setTimeout(() => document.getElementById(tab === 'login' ? 'auth-login-user' : 'auth-reg-user')?.focus(), 50);
    },
});
