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
        // v6.98.0 首頁改版:主視覺換成 3D 方塊村民(landing-3d.js,跟遊戲同一套長相);各玩法改成一段一段的介紹(左文右「遊戲裡你會看到」),截圖只留沒有 WebGL 時的備援
        const L = I18N.getLang() === 'en' ? 'en' : 'zh';
        const X = (zh, en) => (L === 'en' ? en : zh);
        const stats = [['57', X('項科技', 'technologies')], ['6', X('個時代', 'eras')], ['4', X('級城鎮', 'town tiers')], ['50+', X('張事件卡', 'event cards')], ['8', X('種神話基因', 'mythic genes')], ['6', X('級社會階層', 'social classes')]]; // v7.7.1 科技數與時代跟著第五、六時代更新
        // 每一段:錨點、圖示、顏色、小標、標題、導言、重點(標題＋說明)、遊戲裡會看到的紀錄、新功能版本
        const bands = [
            { id: 'people', ic: '🧑‍🤝‍🧑', c: '#f28c4a', k: X('村民', 'Villagers'), new: '6.97',
              h: X('每個人都不一樣，也都記得', 'Everyone is different, and everyone remembers'),
              lead: X('村民有個性、需求、記憶和自己的心事。他們聊天、八卦、交朋友、戀愛結婚，也會說謊、設局、記仇。長相跟著名字走：髮型、眼睛、鬍子、衣服、胖瘦高矮每人不同；小孩個子小、老人頭髮花白、窮人衣服打補丁。',
                  'Villagers have personalities, needs, memories and private worries. They chat, gossip, make friends, fall in love and marry; they also lie, scheme and hold grudges. Looks follow their name: hair, eyes, beards, clothes and build differ from person to person; children are small, elders go grey, the poor wear patched clothes.'),
              pts: [[X('記得誰對他好', 'Who was kind to them'), X('每人 500 條記憶。記仇比記恩久，太久沒來往的人會慢慢淡忘，最多只顧得上一百五十個人。', '500 memories each. Grudges last longer than favors; people they never see slowly fade, and nobody keeps track of more than about 150 others.')],
                    [X('戀愛、婚禮與葬禮', 'Love, weddings and funerals'), X('告白、訂婚、辦婚宴收禮金，前任可能來鬧場；有人過世，家屬辦葬禮、念悼詞，每年還有人去掃墓。', 'Confessions, engagements, wedding feasts and gifts, an ex who shows up uninvited; when someone dies the family holds a funeral, gives a eulogy, and people visit the grave each year.')],
                    [X('陰暗面', 'The dark side'), X('講壞話、說謊、栽贓、搶功都會發生，被拆穿就要道歉，不被原諒就報復。真相頁只有你看得到。', 'Badmouthing, lies, framing and stealing credit all happen; when caught they apologize, and if not forgiven they take revenge. Only you can see the truth page.')]],
              log: [['08:15', X('林美玲把烤好的麵包分給隔壁的小豆子。', 'Lin Meiling shares fresh bread with little Doudou next door.')], ['12:40', X('王大偉還記得去年冬天被借錢不還的事，對劉阿福冷冷的。', 'Wang Dawei still remembers the unpaid loan from last winter and gives Liu Afu the cold shoulder.')], ['19:20', X('陳婉君在廣場向黃淑芬告白，旁邊的人都在起鬨。', 'Chen Wanjun confesses to Huang Shufen in the square while the crowd cheers.')]] },
            { id: 'health', ic: '🩺', c: '#5ec2e6', k: X('身體與醫療', 'Health and medicine'), new: '7.4',
              h: X('會生病、會受傷，看病要花錢', 'People get sick and hurt — and care costs money'),
              lead: X('每個人有眼、手、腳、心、肺五個部位：眼睛不好研究得慢，手受傷做事慢，腳不好走得慢，心肺差的人活不久、睡不好。老化、職業病、打架、工傷和傳染病都會讓人生病受傷。看診、吃藥、動手術、器官移植都要錢：自己付、家人付、跟銀行借、工會互助，或是村民提案用公費補助。',
                  'Everyone has five body parts — eyes, hands, legs, heart and lungs. Poor eyes slow research, hurt hands slow work, bad legs slow walking, and a weak heart or lungs means a shorter life and poor sleep. Ageing, occupational illness, fights, workplace accidents and epidemics all take their toll. Check-ups, medicine, surgery and transplants cost money: paid by the patient, the family, a bank loan, the union fund, or public aid if the villagers vote for it.'),
              pts: [[X('眼鏡、拐杖、義肢', 'Glasses, canes, prosthetics'), X('治不好的部位可以補救一部分；殘疾會影響找工作，有些老闆就是不雇。', 'What cannot be cured can be partly made up for; disabilities make finding work harder, and some bosses simply will not hire.')],
                    [X('等候名單與插隊', 'Waiting lists and queue-jumping'), X('器官要等有人捐；有錢人會塞錢插隊，被發現就是醜聞。', 'Organs wait for donors; the rich slip money to jump the queue, and it is a scandal when it comes out.')],
                    [X('第五時代：生技', 'Fifth era: biotech'), X('城市研究完機械時代、蓋了研究院，就能研究器官移植、疫苗與基因工程。', 'Once a city finishes the machine era and builds an institute, it can research transplants, vaccines and genetic engineering.')]],
              log: [['09:10', X('礦工老陳咳了一整個月，醫生說是礦坑的粉塵傷了肺。', 'Old Chen the miner has coughed for a month; the doctor says the mine dust has damaged his lungs.')], ['13:30', X('王大偉跟人打了一架，手骨折了，這週沒辦法上工。', 'Wang Dawei got into a fight and broke his hand; he cannot work this week.')], ['16:00', X('心臟移植等候名單：富商塞了 200 銀幣，排到了最前面。', 'Heart transplant list: a rich merchant slips 200 silver and jumps to the front.')]] },
            { id: 'politics', ic: '🏛️', c: '#7fb3f5', k: X('政治', 'Politics'),
              h: X('提案、投票、選舉，全是村民自己來', 'Proposals, votes, elections — all by the villagers'),
              lead: X('想蓋穀倉、調稅率、訂最低工資，都是村民自己提案、全鎮投票，首長拍板並說出理由。大事要議會表決，首長否決可以被三分之二推翻；每年改選，有辯論和從政履歷。長成王都之後還有國王、王令、政變和起義。',
                  'Granaries, tax rates, a minimum wage: villagers propose, the town votes, and the leader decides and explains why. Big decisions go to the council, which can overturn a veto with two thirds; there are yearly elections with debates and political careers. Grow into a capital and there is a king, royal decrees, coups and uprisings.'),
              pts: [[X('L 編號提案', 'Numbered proposals'), X('每個提案都有編號、提案人、票數與每個人的投票理由，執行之後還追蹤成效。', 'Each proposal has a number, a proposer, a vote count and every voter\'s reason, and its results are tracked after it passes.')],
                    [X('議會與否決', 'Council and veto'), X('城鎮越大議會越大；議員每年春天改選，出缺由落選者遞補。', 'Bigger towns have bigger councils; seats are re-elected each spring and vacancies go to the runners-up.')],
                    [X('罷免與下台', 'Recall and resignation'), X('醜聞累積、民怨夠大就提前改選；被罷免的人兩個月內不能再參選。', 'Enough scandal and anger triggers an early election; a recalled leader cannot run again for two months.')]],
              log: [['10:00', X('L12「蓋第二座穀倉」通過：14 票贊成、5 票反對。', 'L12 "Build a second granary" passes: 14 for, 5 against.')], ['10:05', X('鎮長：「去年冬天差點斷糧，這筆錢該花。」', 'Mayor: "We almost ran out of food last winter. This is money well spent."')], ['16:30', X('議會以 4 比 1 推翻了鎮長對最低工資案的否決。', 'The council overturns the mayor\'s veto on the minimum wage, 4 to 1.')]] },
            { id: 'money', ic: '💰', c: '#f2c14e', k: X('經濟與階級', 'Money and class'), new: '8.9',
              h: X('錢會流動，也會往有錢人那邊流', 'Money moves — and it moves toward the rich'),
              lead: X('每個村民都有自己的錢包：領工資、繳稅，三餐、衣服、柴火自己買，付不起就挨餓受凍。產業有老闆，老闆發薪也會壓薪；房子有房東，租不起就被趕出去睡廣場。存款有利息、放款收利息，銀行也會擠兌。每一塊錢都講得出是誰付的，從外地進來的錢一定是賣了東西換來的。這是一個不會特別保護窮人的小鎮。',
                  'Every villager has a wallet: they earn wages, pay taxes, buy their own meals, clothes and firewood, and go hungry or cold when they can\'t. Businesses have owners who pay wages and squeeze them; houses have landlords, and those who can\'t pay rent end up sleeping in the square. Savings earn interest, loans charge it, and banks can suffer runs. Every coin can be traced to whoever paid it, and money from outside only comes in when something is sold. This town does not go out of its way to protect the poor.'),
              pts: [[X('通貨膨脹', 'Inflation'), X('大家手上的錢越多，東西就越貴；工資慢慢跟上但總是比物價慢，存錢的人吃虧。工資落後太多，工人就提「工資跟上物價」，老闆多半反對。', 'The more money people hold, the pricier everything gets; wages catch up slowly but always lag, so savers lose out. When wages fall too far behind, workers propose that wages keep up with prices, and owners mostly vote against.')],
                    [X('錢花去哪', 'Where money goes'), X('有才藝的人在廣場說書討賞，有錢人宴客、請畫師畫像、去外地旅遊，家裡出學費送孩子去外地讀書；繳不出學費就輟學，讀完回來工資高一成五。', 'Talented villagers perform in the square for tips; the rich host feasts, commission portraits and travel abroad, and families pay to send children to school out of town. Miss a payment and the child drops out; those who finish earn 15% more.')],
                    [X('包工程', 'Public works contracts'), X('公庫有錢就撥款修路、修橋、蓋水渠、築城牆，工匠競標、得標的人賺差價；跟貪心鎮長熟的人可能被內定，偷工減料的工程日後會出事。', 'A flush treasury funds roads, bridges, aqueducts and town walls; craftsmen bid and the winner keeps the margin. Friends of a greedy mayor may get the job, and corner-cutting projects fail later.')],
                    [X('跟銀行借錢創業', 'Bank loans to start up'), X('銀行拿存款放貸：想開店卻找不到合夥人的人跟銀行借本錢，缺房子時有工作的人借錢蓋出租屋，四十五天內慢慢還。', 'The bank lends out deposits: would-be shopkeepers without a partner borrow their start-up money, and when housing is short, working villagers borrow to build rentals and repay within 45 days.')]],
              log: [['07:00', X('劉阿福這個月欠了三週房租，被房東趕了出來。', 'Liu Afu is three weeks behind on rent and gets evicted.')], ['12:00', X('麵包店老闆把工資壓到每天 3 銀幣。', 'The bakery owner cuts wages to 3 silver a day.')], ['18:10', X('💹 物價水準到了原本的 1.5 倍，存了一輩子錢的老周心裡發慌。', '💹 The price level reaches 1.5× its start; old Zhou, who saved all his life, starts to panic.')], ['19:30', X('🌉 阿德標下修橋工程，偷偷少用了一成木料。', '🌉 Ade wins the bridge contract and quietly uses a tenth less timber.')]] },
            { id: 'casino', ic: '🎰', c: '#e85d8a', k: X('賭場', 'Casino'), new: '8.9',
              h: X('十賭九輸，偶爾有人一夕致富', 'The house wins, and now and then someone gets rich overnight'),
              lead: X('小鎮長成城鎮以後，有野心的有錢人可能開一家賭場。有錢人小賭當娛樂，窮人一把押上大半家當；輸了想翻本，越輸押越大，甚至跟銀行借錢去賭。長期下來莊家總是贏，但大獎太大時，莊家也會被搬空。',
                  'Once the village grows into a town, an ambitious rich villager may open a casino. The rich bet small for fun while the poor stake most of what they own; losers chase their losses with ever bigger bets, even borrowing from the bank. Over time the house always wins, but a big enough jackpot can clean out the house too.'),
              pts: [[X('一夕致富', 'Rich overnight'), X('中大獎的人上報紙，旁人眼紅也跑去試手氣；莊家付不出大獎就傾家蕩產、賭場關門。', 'Jackpot winners make the paper and envious neighbors rush to try their luck; if the house can\'t pay, the owner is ruined and the casino closes.')],
                    [X('家破人亡', 'Ruined families'), X('輸光的人心情跌到谷底，配偶可能帶著孩子離開，欠銀行錢的人連夜跑路。', 'Those who lose everything hit rock bottom; spouses may leave with the children, and those who owe the bank flee town at night.')],
                    [X('禁賭提案', 'A gambling ban'), X('輸垮的人多了，虔誠或家裡被害的人提「禁賭」；賭場老闆、常客和食堂老闆反對，全鎮投票決定。', 'When enough people are ruined, the devout or hurt families propose a ban; the owner, regulars and the canteen owner oppose it, and the town votes.')],
                    [X('城市的觀光客', 'Tourists in the city'), X('城市以上的賭場吸引外地賭客，順便在鎮上吃住，把外地的錢帶進來。', 'In a city the casino draws gamblers from out of town who eat and stay locally, bringing outside money in.')]],
              log: [['20:00', X('🎲 富商老李在「金滿堂」輸了 12 銀幣，笑笑說就當買個開心。', '🎲 Rich merchant Li loses 12 silver at the Golden Hall and laughs it off.')], ['21:15', X('🎉 阿明押中大獎，一夜之間贏了 300 銀幣！', '🎉 Aming hits the jackpot and wins 300 silver overnight!')], ['22:40', X('💔 小芳的丈夫把家當全輸在賭場，她帶著孩子離開了。', '💔 Xiaofang\'s husband gambles away everything; she leaves with the children.')], ['23:50', X('🌙 欠了銀行一屁股債的老吳，連夜離開了小鎮。', '🌙 Deep in debt to the bank, old Wu slips out of town in the night.')]] },
            { id: 'shares', ic: '📈', c: '#7fcf8f', k: X("股份與合夥", "Shares and partners"), new: '8.7',
              h: X("合夥做生意，最難的是分錢", "In business together, splitting the money is the hard part"),
              lead: X("沒人一個人買得起的產業，有野心的人會找交情好的朋友合股買下。股份最多的人當家，每週照股份分紅；生意好有人眼紅想入股，缺錢的股東只好賣股。", "When nobody can afford an industry alone, an ambitious villager brings in close friends to buy it together. The largest shareholder runs it and pays dividends every week; when business booms someone wants to buy in, and broke shareholders have to sell."),
              pts: [[X("做假帳與翻帳本", "Cooked books"), X("貪心的當家少分股東，細心的股東翻帳本抓到就當場拍桌；醜聞之後有人提案「產業帳本公開」。", "Greedy managers short the shareholders, and sharp-eyed shareholders who catch them slam the table; after a scandal someone proposes Open Books.")],
                    [X("股東會變天", "Boardroom coups"), X("不滿的股東加起來比當家多，就在股東會上把當家拉下來；翻臉的合夥人被買斷拆夥。", "When unhappy shareholders together outweigh the manager, they vote the manager out; partners who fall out get bought out.")],
                    [X("員工認股", "Worker shares"), X("工會提案讓工人用存款買自家產業的股份；分紅那週大家心情好，罷工也少了。", "Unions propose letting workers buy shares in their own industry with their savings; on dividend weeks people are happier and strikes are rarer.")]],
              log: [['10:00', X("阿德一個人買不起木作坊，找了兩個老朋友合股買下。", "Ade couldn't afford the timber yard alone, so he bought it with two old friends.")], ['17:30', X("小芳翻了帳本，發現當家這週少分了 12 銀幣，當場拍桌。", "Xiaofang went through the books, found the manager had shorted them 12 silver, and slammed the table.")], ['20:10', X("股東會上，大家聯手把當家拉了下來。", "At the shareholder meeting, everyone joined forces to vote the manager out.")]] },
            { id: 'union', ic: '✊', c: '#e5736b', k: X('工會', 'Unions'), new: '6.93',
              h: X('被壓榨的人會組織起來', 'The squeezed get organized'),
              lead: X('小鎮升格成城市以後，私人產業裡覺得被壓榨的工人一多，就有人出來組工會：收會費、存罷工基金、跟老闆談加薪。談不攏就罷工，老闆可能讓步、找工賊、開除帶頭的人，或私下收買工會領袖。帶領五人以上工會的領袖可以出來選舉。',
                  'Once the town becomes a city and enough private-sector workers feel squeezed, someone starts a union: dues, a strike fund, wage talks with the bosses. If talks fail they strike, and the boss may give in, hire scabs, fire the organizers or quietly bribe the union leader. A leader with five or more members can run for office.'),
              pts: [[X('集體談判', 'Collective bargaining'), X('老闆看利潤、個性和手上的現金決定要不要讓步。', 'Bosses weigh profit, temperament and cash on hand before giving in.')],
                    [X('罷工與工賊', 'Strikes and scabs'), X('罷工期間工會發補貼，基金見底就撐不下去。', 'The union pays strike pay; when the fund runs dry the strike collapses.')],
                    [X('收買與曝光', 'Bribes and exposure'), X('領袖收了老闆的錢，被發現就會被會員趕下台。', 'A leader who takes the boss\'s money gets thrown out once members find out.')]],
              log: [['09:00', X('磨坊工會要求每天加 1 銀幣，老闆拒絕。', 'The mill union asks for 1 more silver a day; the owner refuses.')], ['09:30', X('七名會員開始罷工，工會每天發 2 銀幣補貼。', 'Seven members walk out; the union pays 2 silver a day in strike pay.')], ['15:00', X('第四天，老闆讓步了。', 'On day four, the owner gives in.')]] },
            { id: 'power', ic: '📰', c: '#c39bd3', k: X('金權與第四權', 'Money and the press'), new: '6.95',
              h: X('有錢人買影響力，報社負責揭穿', 'The rich buy influence; the press digs it up'),
              lead: X('老闆和有錢人會捐政治獻金，正直的人拒收，收了錢的首長和議員就偏向金主。報社每天從真實發生的事裡找新聞：壓薪、驅逐潮、銀行呆帳、私下收錢。報導會讓讀者生氣、讓醜聞扣票、逼老闆加薪，甚至引發罷免；財團也可能直接買下報社，把新聞壓下來。',
                  'Owners and the wealthy make political donations; honest officials refuse, and those who accept lean toward their donors. The papers dig stories out of what really happens: wage cuts, waves of evictions, bad bank loans, money changing hands. A story can anger readers, cost votes, force a pay raise or even trigger a recall — and a rich owner might simply buy the paper and kill the story.'),
              pts: [[X('獻金與拒收', 'Donations and refusals'), X('誰收了誰的錢記在真相頁；收錢的人投票時會想到金主。', 'Who took money from whom is on the truth page, and it shows in their votes.')],
                    [X('報導有後果', 'Stories have consequences'), X('憤怒、扣票、罷免、加薪、救濟提案、銀行提款，都可能因為一篇報導發生。', 'Outrage, lost votes, recalls, raises, relief proposals and bank withdrawals can all follow one article.')],
                    [X('收編與骨氣', 'Captured papers, stubborn reporters'), X('被收購的報社會壓新聞；有骨氣的記者照登，然後被開除。', 'A bought paper buries stories; a principled reporter runs them anyway and gets fired.')]],
              log: [['06:30', X('《邊境日報》：鎮長收下鐵匠鋪老闆 80 銀幣獻金。', 'Frontier Daily: Mayor accepted 80 silver from the smithy owner.')], ['11:00', X('讀者氣炸了，三位議員提議罷免。', 'Readers are furious; three councillors call for a recall.')], ['20:00', X('鐵匠鋪老闆出 120 銀幣買下報社。', 'The smithy owner buys the paper for 120 silver.')]] },
            { id: 'growth', ic: '🔬', c: '#6fcf97', k: X('科技與成長', 'Technology and growth'),
              h: X('從村莊長成王都，要花好幾年', 'From village to capital takes years'),
              lead: X('科技分成拓荒、手工、工坊、機械、生技、神話基因六個時代，共 57 項，整棵樹要好幾年才研究得完。新技術在村民之間傳開，分出保守派和革新派；房子從木屋翻修成磚樓。人口、繁榮和時代都夠了，村莊才升格成城鎮、城市、王都；掉下來也會降級。',
                  'Technology spans six eras — Frontier, Craft, Workshop, Machine, Biotech and Mythic Genes — with 57 techs that take years to finish. New ideas spread from person to person and split the town into conservatives and reformers; houses get rebuilt from timber to brick. With enough people, prosperity and progress a village becomes a town, a city, a capital — and can fall back down.'),
              pts: [[X('六個時代', 'Six eras'), X('蒸汽動力、鐵路、現代金融在第四時代；器官移植在第五時代；神話基因要到第六時代。', 'Steam power, railways and modern finance arrive in the fourth era, transplants in the fifth, and mythic genes only in the sixth.')],
                    [X('保守與革新', 'Old ways and new'), X('失業的人會抗議新機器，選舉時也分成兩派。', 'People put out of work protest new machines, and elections split along the same line.')],
                    [X('四級城鎮', 'Four town tiers'), X('村莊 → 城鎮 → 城市 → 王都，議會和官職跟著變大。', 'Village → town → city → capital; the council and offices grow with it.')]],
              log: [['14:00', X('研究完成：輪作。農田收成提高了。', 'Research complete: crop rotation. Harvests improve.')], ['14:20', X('老農夫：「祖先那套也沒餓死誰。」', 'Old farmer: "The old ways never starved anyone."')], ['17:45', X('邊境鎮升格為城市！議會擴大到 7 席。', 'Frontier Town becomes a city! The council grows to 7 seats.')]] },
            { id: 'path', ic: '🧭', c: '#f0a35e', k: X('科技路線', 'Tech paths'), new: '8.0',
              h: X('走哪條路，就會遇到哪種問題', 'Every path brings its own troubles'),
              lead: X('工坊時代研究得差不多，村民就會開一場「路線大辯論」：⚙️ 電子機械、🧬 基因生物、🚂 蒸汽煉金，還是維持傳統？每個人投給自己想走的路，看小鎮的地形和經歷過什麼——貿易要道偏電子機械，礦山偏蒸汽煉金，森林和平原農地偏基因生物；剛撐過瘟疫的小鎮比較想走基因生物，工會強、礦工鐵匠多的小鎮比較想走蒸汽煉金。每條路線的第四、五時代大家都能研究，第六時代才是專屬：電子機械有火箭、核子武器、太空站、AI；基因生物有基因編輯、神話基因、延壽療法；蒸汽煉金有發條人偶、以太引擎、浮空城、賢者之石、人造人。',
                  'Once the workshop era is mostly researched, the town holds a tech path debate: ⚙️ Electro-mechanical, 🧬 Bio-genetic, 🚂 Steam Alchemy, or keep to tradition? Everyone votes for the path they want, shaped by the land and by what the town has been through: trade-route towns lean electro-mechanical, mining towns lean steam alchemy, forest and farmland towns lean bio-genetic; a town that just survived a plague leans bio-genetic, and one with a strong union and many miners and smiths leans steam alchemy. Anyone can research the fourth and fifth eras of every path; only the sixth era is exclusive: rockets, nuclear weapons, a space station and AI for electro-mechanical; gene editing, mythic genes and life extension for bio-genetic; clockwork automatons, the aether engine, a floating city, the philosopher\'s stone and homunculi for steam alchemy.'),
              pts: [[X('問題跟著科技走', 'Trouble follows the technology'), X('蓋了核電廠就可能核災；有了藥廠就會排污、藥價暴漲；研究院可能讓病原體外洩，變成一場真的瘟疫。偶爾出事，嚴重的機率很低但真的會發生。', 'Build a nuclear plant and a meltdown becomes possible; a pharmaceutical works brings pollution and price spikes; an institute can leak a pathogen into a real epidemic. Trouble happens now and then; the serious kind is rare, but real.')],
                    [X('村民自己立法', 'Villagers write the rules'), X('核安法、廢核、生物安全法、藥價管制、禁止基因作物、停止人體實驗：出了事之後，受害的人會帶頭提案。', 'Nuclear safety laws, abolishing nuclear power, biosafety laws, drug price controls, GM crop bans, halting human experiments: after something goes wrong, the people who were hurt lead the proposals.')],
                    [X('🚂 蒸汽煉金：很需要人手，代價是煤煙', '🚂 Steam Alchemy: plenty of jobs, paid for in smoke'), X('高壓鍋爐、齒輪工坊、蒸汽機甲讓礦工、鐵匠、木匠的職缺變多，不會被機器搶飯碗。代價是煤煙：煙越濃天空越暗、越多人咳嗽；冬天起霧、煙散不掉的時候可能變成大黑霧。村民會提清潔空氣法、工廠法（工時與童工），人造人問起自己能不能有名字時，還會吵要不要禁造。賢者之石只能把石頭變成鋼，變不出銀幣。', 'High-pressure boilers, gear workshops and steam mechs open more jobs for miners, smiths and carpenters instead of handing them to machines. The price is coal smoke: the thicker it gets, the darker the sky and the more people cough, and on a foggy winter day it can turn into a Great Smog. Villagers propose a Clean Air Act and a Factory Act (working hours and child labor), and when a homunculus asks whether it can have a name, the town argues over banning them. The philosopher\'s stone can turn stone into steel, but never into silver.')]],
              log: [['10:20', X('路線大辯論：電子機械 9 票、蒸汽煉金 14 票、維持傳統 4 票，小鎮決定走蒸汽煉金。', 'Path debate: Electro-mechanical 9, Steam Alchemy 14, keep tradition 4. The town chooses Steam Alchemy.')], ['14:05', X('氣動管道把阿明寫給小芳的情書送到了老陳家，全鎮笑了一整天。', 'The pneumatic tubes delivered A-Ming\'s love letter for Xiao-Fang to Old Chen instead. The town laughed about it all day.')], ['21:40', X('王嬸剛晾好的衣服被煤灰染成了灰色，抱著一籃髒衣服跑去找工坊老闆理論。', 'Auntie Wang\'s freshly hung laundry turned grey with soot, and she carried the basket over to complain to the workshop owner.')]] },
            { id: 'doom', ic: '🌍', c: '#ff8a65', k: X("世界級災厄", "World calamities"), new: '9.2',
              h: X("科技走到頂點，世界也可能走到盡頭", "At the peak of technology, the world may meet its end"),
              lead: X("每條科技路線的第六時代研究到六成，就可能遇上那條路線的末日：電子機械的核子大戰、外星入侵、AI 控制；基因生物的全球不孕與喪屍危機；蒸汽煉金的冰河期與以太裂隙。每場都走六段：徵兆、研究與爭論、口耳相傳、恐慌、降臨、災後世界，總長一兩個月。", "Once a town has researched 60% of its path's sixth era, that path's doomsday may come: nuclear war, alien invasion or an AI takeover on the electro path; global infertility or a zombie outbreak on the bio path; an ice age or an aether rift on the steam path. Each one runs through six phases (omens, research and debate, word spreads, panic, arrival, aftermath) over a month or two."),
              pts: [[X("跟降臨倒數賽跑", "Racing the countdown"), X("研究員要在降臨前做完主對策：停火斡旋、解讀訊號、斷網開關、生殖修復療法、喪屍解藥、生態方舟、封印裂隙。做完化解、做一半減輕、沒做到重創。", "Researchers must finish the countermeasure before it arrives: ceasefire talks, decoding the signal, a kill switch, fertility repair, a zombie cure, an eco-ark, sealing the rift. Finish and it is averted, get halfway and it is eased, fall short and the town is devastated.")],
                    [X("說沒事的和喊危險的", "Deniers and alarmists"), X("全鎮分成兩派吵；有錢人先搬走、信徒說是天譴；世界末日前有人和好、有人告白、有人把秘密說出來。災後當初說沒事的人抬不起頭。", "The town splits into two camps; the rich leave first and the devout call it divine punishment; before the end some make peace, some confess their love, some reveal their secrets. Afterwards the deniers can't look anyone in the eye.")],
                    [X("災厄會留下痕跡", "Scars that stay"), X("核子冬天、AI 管家的宵禁、一年生不出孩子、好幾個月的長冬、天上那道紫色的疤、墓園邊的新墳；撐過一次就解鎖（跟著帳號），之後在任何城鎮都能從手牌打出來。", "Nuclear winter, the AI steward's curfew, a year without births, a winter that lasts for months, a purple scar across the sky, new graves by the cemetery; survive one and it unlocks on your account, so you can play it from your hand in any town.")]],
              log: [['08:00', X("收音機裡外國的廣播越來越火爆，主持人說話的聲音都在發抖。", "The foreign broadcasts on the radio grow more heated; the host's voice is shaking.")], ['12:30', X("老王在酒館拍桌子：「什麼世界末日，我爺爺那一代也說過。」", "Old Wang bangs the tavern table: \"End of the world? My grandfather heard that too.\"")], ['19:40', X("冬季倉庫堆滿了木柴和醃菜，連小孩都來幫忙搬。", "The winter storehouse is piled with firewood and pickles; even the children help carry.")]] },
            { id: 'aftermath', ic: '🔥', c: '#e5736b', k: X('災後反應', 'After disaster'), new: '7.9',
              h: X('大事發生之後，每個人都有自己的反應', 'When disaster strikes, everyone reacts their own way'),
              lead: X('核災、實驗室外洩、瘟疫、基因衝突、藥價暴漲……出事之後，受害的人和他們的家人最痛，跟他們越親的人越受影響。每個村民依自己的個性、身上有多少錢、家人有沒有事、身邊的人在做什麼，自己決定怎麼反應：有人互助送糧，有人怪罪別人、傳謠言，有人上街抗議，有人囤貨、逃難，走投無路的人可能去搶。',
                  'Meltdowns, lab leaks, plagues, gene-caste clashes, drug price spikes... when something goes wrong, the victims and their families hurt most, and the closer you are to them the harder it hits. Each villager decides how to react from their personality, how much money they have, whether their family is safe and what the people around them are doing: some bring food to neighbors, some blame others or spread rumors, some take to the streets, some hoard or flee, and the desperate may loot.'),
              pts: [[X('像真的社會一樣會傳染', 'It spreads like in a real society'), X('情緒和行為沿著人際圈傳開：好朋友去抗議，自己也比較會去；派系的人彼此看齊；有魅力、有名望的人一帶頭，影響最大。', 'Feelings and actions spread through social circles: if close friends protest, you are more likely to join; factions follow their own; when a charismatic, respected person leads, it carries furthest.')],
                    [X('搶劫潮與門檻', 'Riots have a tipping point'), X('老實人要看到很多人在搶才會跟；走投無路的人不用等。一兩個人帶頭，就可能一發不可收拾。衛兵抓得到就還錢、關幾天，抓不到就變成只有你知道的秘密。', 'Honest people only join once many others are already looting; the desperate don\'t wait. One or two people starting can set it off. If the guards catch them, the money goes back and they spend a few days in jail; if not, it becomes a secret only you know.')],
                    [X('之後放什麼進去都能測', 'Drop in anything and watch'), X('所有災難共用同一個入口：之後加進來的事件、天災、世界級災厄，村民都會用同一套方式反應，看這個社會怎麼互相影響。開著完整智能體模式時，出大事那天壓力最大的幾個人由 AI 整批決定怎麼反應、各說一句話。', 'Every disaster uses the same entry point: future events, natural disasters and world catastrophes all get the same treatment, so you can watch how the society reacts. With full agent mode on, the most shaken villagers each decide with AI and say a line.')]],
              log: [['09:10', X('實驗室外洩之後，林美玲提著一籃吃的去看研究員一家。', 'After the lab leak, Lin Meiling brings a basket of food to the researcher\'s family.')], ['15:30', X('鎮民聚在廣場抗議，要鎮公所給個交代，帶頭的是失去父親的阿浩。', 'Townsfolk gather in the square to demand answers, led by Ahao, who lost his father.')], ['22:40', X('混亂中有人衝進公有糧倉，扛走了 8 份糧食。', 'In the chaos, someone breaks into the public granary and hauls off 8 food.')]] },
            { id: 'ways', ic: '🤝', c: '#e8b04b', k: X('人情世故', 'How people really are'), new: '8.1',
              h: X('面子、人情、嘴硬和冷戰，一點一點長出每個鎮的性格', 'Saving face, favors, stubbornness and cold shoulders slowly shape each town\'s character'),
              lead: X('提案被當眾大比數否決會丟面子：多數人從此不敢再提，有人脈的會私下拉票再試，朋友給個台階會被記一輩子。婚禮禮金、去送葬、災後幫忙都記在人情帳上，欠了人情投票時就不好意思反對。提案搞砸了，當初投贊成的人多半說「我當初就覺得怪怪的」；有人投票支持法律、私下自己照樣違反。每個人有固定的小去處，常碰面的人慢慢變成街坊；吵完架的人互不說話，共同的朋友被迫選邊。',
                  'Get a proposal voted down in public by a wide margin and you lose face: most people stop proposing for a while, the well-connected quietly lobby and try again, and a friend who offers a way to save face is remembered for life. Wedding gifts, showing up at funerals and help after a disaster all go on the favor ledger, and owing someone makes it awkward to vote against them. When a proposal goes wrong, the people who voted for it mostly say "I had a bad feeling about it from the start"; some vote for a law and quietly break it themselves. Everyone has their usual spot, and people who keep running into each other slowly become neighbors; after a fight two people stop speaking, and mutual friends have to pick a side.'),
              pts: [[X('每件小事都會反饋', 'Every small thing feeds back'), X('沉默的人一多，提案就變少，看不下去的人會提一場鄰里茶會；提案常失敗、有人說一套做一套，全鎮的信任下降，大家對提案更多疑；有人翻修房子，鄰居眼紅，手頭緊的借錢也要跟。', 'When enough people go quiet, proposals dry up until someone calls a neighborhood tea gathering; when proposals keep failing or hypocrites are caught, trust falls and people get suspicious of every proposal; when one family renovates, the neighbors get envious, and some borrow to keep up.')],
                    [X('不誇張，好笑來自真實', 'Nothing over the top, the humor is real life'), X('紅包包太少被親戚私下比較、老人懷念當年其實落選下台的首長、氣動管道把情書送錯人、冷戰的兩個人在婚宴上被排在同一桌。', 'Relatives quietly compare wedding gifts, elders miss a mayor who actually lost re-election, tube mail delivers a love letter to the wrong house, and two people who aren\'t speaking get seated at the same wedding table.')],
                    [X('每個鎮長出不同的性格', 'Every town grows its own character'), X('有的鎮人情重、投票看關係，有的鎮互不信任、提案都要附理由，有的鎮老人當家很保守。不是設定出來的，是從小毛病一路長出來的。', 'Some towns run on favors and vote by relationships, some trust no one and want reasons for everything, some are run by cautious elders. None of it is preset; it grows out of small habits.')]],
              log: [['09:15', X('李嬸的提案被大比數否決之後，逢人就說：「我本來就只是隨口提提。」', 'After her proposal was voted down by a wide margin, Auntie Li tells everyone: "I was only mentioning it in passing."')], ['12:40', X('王伯兩天沒出現在公園，賣菜的張嫂跑去敲門問候。', 'Uncle Wang hadn\'t shown up at the park for two days, so Mrs. Zhang from the vegetable stall went over and knocked to check in.')], ['19:30', X('冷戰中的阿明和小芳在婚宴上被排在同一桌，全場都在偷看。', 'A-Ming and Xiao-Fang, still not speaking, were seated at the same table at the wedding banquet, and everyone kept sneaking looks.')]] },
            { id: 'myth', ic: '🧬', c: '#d98be0', k: X('神話基因', 'Mythic genes'), new: '7.6',
              h: X('有錢人把神的血編進身體裡', 'The rich edit the blood of gods into their bodies'),
              lead: X('第六時代、王都和基因實驗室都到了，有錢人就能花大錢編入八種神話基因：月狼之血、夜之血、雷神之血、智慧女神之瞳、太陽神之血、冥王之血、不死鳥之血、巨人之血。能力很強，副作用也很真實：滿月變狼人、白天虛弱要吸血、雷雨天失控。被禁了就轉進地下診所，孩子還會遺傳。',
                  'With the sixth era, a capital and a gene lab, the rich can pay a fortune for one of eight mythic genes: the blood of the moon wolf, of the night, of the thunder god, the eye of the wisdom goddess, the blood of the sun god, of the king of the dead, of the phoenix and of the giants. The powers are real, and so are the side effects: turning into a wolf at full moon, weakness by day and a thirst for blood, rages in thunderstorms. Ban it and it moves to back-alley clinics; children inherit it.'),
              pts: [[X('純人派與神裔會', 'Pure Blood and the god-blooded'), X('每個人對神裔有自己的看法，出事、報紙、朋友都會改變；兩派投票、選舉一起行動。', 'Everyone has their own view of the god-blooded, shaped by incidents, the papers and friends; each side votes and campaigns as a bloc.')],
                    [X('獵人與冤案', 'Hunts and wrongful accusations'), X('獵人隊連夜搜捕常抓錯人；冤案揭曉後，帶頭的人會被提案審判。', 'Night hunts often seize the wrong person; once the truth comes out, the ringleader may be put on trial.')],
                    [X('宗教與平權', 'Faith and equal rights'), X('宗教認定基因是褻瀆或神選；被逐出教門的神裔會創立新神教，神裔會也會提案平權令。', 'Faiths call the genes blasphemy or a divine choice; the excommunicated found new faiths, and the god-blooded push for an equal rights act.')]],
              log: [['00:30', X('🌕 滿月夜，守衛隊長變成了狼人，咬傷了巡夜的人。', '🌕 Full moon: the guard captain turns into a wolf and bites the night watchman.')], ['07:00', X('《邊境日報》：純人派說神裔是怪物，要求驅逐。', 'Frontier Daily: Pure Blood calls the god-blooded monsters and demands expulsion.')], ['21:15', X('獵人隊抓錯了人，被冤枉的鐵匠今天放了出來。', 'The hunters got the wrong man; the wrongly accused blacksmith is released today.')]] },
            { id: 'aether', ic: '💎', c: '#7ec8e3', k: X("以太與長生", "Aether and longevity"), new: '8.7',
              h: X("存起來煉賢者之石，還是先把日子過好？", "Save for the philosopher's stone, or live well now?"),
              lead: X("蒸汽煉金的小鎮挖得到以太礦。以太讓發條人偶夜裡也做事、浮空城區升得更高、傷口一夜癒合；也能存起來煉一顆賢者之石，讓戴著它的人老得很慢。以太永遠不夠用，存還是用，村民自己投票。", "Steam towns can mine aether. It keeps clockwork automatons working through the night, lifts the floating district higher and heals wounds overnight; it can also be saved to make a philosopher's stone that makes its bearer age very slowly. There is never enough, and the villagers vote on whether to save it or use it."),
              pts: [[X("一顆，只給一個人", "One stone, one person"), X("國王想收走、有錢人想買、教團說該給神職、研究員說是自己的功勞，全鎮吵翻天。石頭一離身，被延緩的歲月一下子追上來。", "The king wants to seize it, the rich want to buy it, the clergy say it belongs to a priest, the researchers claim the credit, and the town is in an uproar. If the stone ever leaves its bearer, the held-back years catch up at once.")],
                    [X("基因延壽：人人都能做，但有代價", "Gene longevity: for everyone, at a price"), X("基因生物的小鎮可以花錢做延壽療程，多活十五年；代價是基因失調、生育力下降、長輩一直不退位。", "Bio towns can pay for a longevity treatment and live fifteen years longer, at the cost of gene disorders, lower fertility and elders who never step aside.")],
                    [X("點石成鋼也有代價", "Even transmutation has a price"), X("鎮上缺鋼時，大方的持有人會用賢者之石點石成鋼，但石頭的光會暗一點、自己也老得快一點；能量要靠以太補，又跟大家搶以太。", "When the town runs short of steel, a generous bearer may turn rock into steel with the stone, but its glow dims and they age a little faster; its power must be topped up with aether, which everyone else needs too.")]],
              log: [['06:40', X("礦工在礦坑深處挖到一條發著淡藍色光的礦脈。", "Deep in the mine, the miners strike a vein glowing pale blue.")], ['14:00', X("議會表決：以太先拿來過生活，賢者之石以後再說。", "The council votes: aether goes to daily life for now, the stone can wait.")], ['23:50', X("半夜有人摸進老楊的房間，賢者之石不見了。", "At midnight someone creeps into Old Yang's room, and the philosopher's stone is gone.")]] },
            { id: 'lab', ic: '🧪', c: '#e06c75', k: X('災厄工坊', 'Disaster workshop'), new: '8.2',
              h: X('你是神，可以親手設計一場災難', 'You are the god — design a catastrophe yourself'),
              lead: X('災厄工坊是神的工具，不是村民的路線。第一種災厄是病原體：自己設計傳播途徑、症狀、潛伏期、爆發速度和致死率，還能加上怪病特性（說謊就會爆炸、藏不住秘密、一見鍾情、易怒、失憶、守財、昏睡、性格反轉），花神力指定第一個病人釋放。之後會一直出事：徵兆、研究與爭論、流言、恐慌、高峰、災後。',
                  'The disaster workshop is the god\'s tool, not a path the villagers choose. The first calamity is the pathogen: design how it spreads, its symptoms, incubation, speed and lethality, add strange quirks (lying makes you explode, secrets slip out, love at first sight, rage, amnesia, miserliness, endless sleep, a flipped personality), then spend divine power to pick patient zero. Then events unfold: omens, research and debate, rumors, panic, the peak, and the aftermath.'),
              pts: [[X('人類會自救', 'Humans fight back'), X('村民自己提案隔離、戴口罩、關店、封城、研究疫苗，跟疫情賽跑；有錢人會先逃，有人囤藥。你只能推一把讓它更糟，不能阻止。', 'Villagers propose quarantine, masks, closing shops, lockdowns and vaccine research, racing the outbreak; the rich flee first and some hoard medicine. You can only make it worse, never stop it.')],
                    [X('疫情裡的人情世故', 'People in an epidemic'), X('每天在酒館碰面的人互相傳染；關太久就有人偷溜、投贊成的人自己不守被抓包；鄰居把飯放在門口欠下人情；有人趁機賣萬靈藥；吃過虧的小鎮下次更早防疫，兩年後又慢慢忘了。', 'Regulars at the tavern infect each other; when rules drag on people sneak out, and those who voted for them get caught breaking them; neighbors leave food at the door and favors are owed; someone sells a miracle cure; a town that suffered reacts faster next time, then slowly forgets.')],
                    [X('大災之後文明倒退', 'Civilization slips back'), X('死的、逃的人越多，失傳的科技越多，從最高的時代開始；文書房、印刷坊、學堂、研究院能保住學問，失傳的只剩殘卷。', 'The more people die or flee, the more knowledge is lost, starting from the highest era. Archives, presses, schools and institutes help keep it; what is lost leaves only fragments.')],
                    [X("神之書", "Book of Gods"), X("事件卡分普通、稀有、傳說、禁忌四級，小鎮發生過某些事才會寫進書裡、出現在手牌；打牌、託夢、工坊共用神力。", "Event cards come in four rarities (common, rare, legendary, forbidden) and are written into the book, and your hand, only after certain things happen in town; cards, dreams and the workshop share one divine power.")]],
              log: [['07:30', X('醫生發現三個人同時發燒咳嗽，懷疑是新的病。', 'The doctor notices three people with fever and cough at once and suspects a new disease.')], ['15:10', X('得了說謊病的老謝又撒了一次謊，冒出一陣黑煙。', 'Old Xie, sick with the liar\'s fever, lies again and puffs out black smoke.')], ['20:00', X('投票支持關酒館的老周，被人撞見從後門溜進去喝酒。', 'Old Zhou, who voted to close the tavern, is spotted sneaking in through the back door for a drink.')]] },
            { id: 'culture', ic: '⛪', c: '#9aa7ff', k: X('信仰與文化', 'Faith and culture'),
              h: X('每座鎮都有自己的神、節日和傳言', 'Every town has its own gods, festivals and rumors'),
              lead: X('宗教是隨機生成的：名字、神、經典、節日都不一樣。信徒禮拜、捐獻，教團濟貧，也會分裂出異端、跟新科技起衝突。消息會晚到、會走樣，越傳越離譜；藝術作品、吟遊詩人的歌和鎮史一起留下來。',
                  'Religions are generated at random: names, gods, scriptures and festivals all differ. Believers worship and give, the faith helps the poor, and it can split into heresies or clash with new technology. News arrives late and gets distorted; art, bards\' songs and the town chronicle remain.'),
              pts: [[X('教團的錢', 'Money of the faiths'), X('信徒捐獻進教團基金，拿去維護場所、辦節日、濟貧；宗教預設免稅，村民可以提案對捐獻課稅。', 'Offerings fill the faith\'s fund, which pays for upkeep, festivals and relief; religion is tax-exempt by default, but villagers can propose taxing donations.')],
                    [X('謠言會走樣', 'Rumors drift'), X('第二手開始有機會被誇大，有些八卦一開始就是假的。', 'From the second telling a story may be exaggerated, and some gossip was false from the start.')],
                    [X('鎮史', 'Town chronicle'), X('每一季寫成一章，記下誰當選、誰過世、發生過什麼大事。', 'Each season becomes a chapter: who was elected, who died, what happened.')]],
              log: [['06:00', X('張老伯帶著信徒在聖堂做晨禱。', 'Old Zhang leads the faithful in morning prayer.')], ['13:10', X('傳言：「聽說北邊的城鎮鬧饑荒，已經餓死好幾個人。」', 'Rumor: "They say the northern town has a famine and people are dying."')], ['21:00', X('吟遊詩人唱起去年那場大雪的歌。', 'A bard sings about last year\'s great snow.')]] },
            { id: 'world', ic: '🗺️', c: '#5fc4b8', k: X('世界', 'The world'), new: '7.1',
              h: X('小鎮外面還有一整個世界', 'There is a whole world outside town'),
              lead: X('每座鎮依地形擅長不同的東西：靠海才曬得出鹽、捕得到魚，森林邊的鎮木材多。缺什麼就靠商隊；搭馬車可以去其他城鎮，大雪、坍方、盜匪會封路。鎮與鎮之間有外交、聯姻和貿易戰。',
                  'Each town is good at different things depending on its land: only coastal towns make salt and catch fish, forest towns have timber. Whatever is missing comes by caravan; carriages travel between towns, and snow, landslides and bandits close the roads. Towns trade, marry into each other and fight trade wars.'),
              pts: [[X('地形決定物產', 'Land shapes the economy'), X('穀物、魚、肉、鹽、紙、工具、建材，各鎮產量不同。', 'Grain, fish, meat, salt, paper, tools and building materials vary from town to town.')],
                    [X('馬車與路況', 'Carriages and roads'), X('出遠門的人會離開地圖，回來時帶著外地的消息。', 'Travelers leave the map and come back with news from elsewhere.')],
                    [X('進出口與關稅', 'Trade and tariffs'), X('商行老闆看差價做進出口；便宜進口貨一多，本地生產者會提案課關稅。', 'The trading house imports and exports where the margins are; when cheap imports pile up, local producers push for a tariff.')]],
              log: [['15:00', X('海港的商隊到了，帶來魚和鹽。', 'A caravan from the harbor arrives with fish and salt.')], ['15:30', X('大雪封路，往山城的馬車停駛三天。', 'Heavy snow closes the road; carriages to the mountain town stop for three days.')], ['18:00', X('鄰鎮派人來談聯姻。', 'The neighboring town sends envoys to discuss a marriage.')]] },
            // v9.1.1 第七章「你」的兩個主題
            { id: 'watch', ic: '🔭', c: '#8fd3c7', k: X('觀看', 'Watching'),
              h: X('拉近看屋裡，翻開每個人的心事', 'Look inside the houses, and into people\'s heads'),
              lead: X('地圖上每位村民在做什麼都看得到：點一下，鏡頭就跟著他，資訊卡寫著心情從哪來、跟誰要好、欠誰錢。鏡頭拉近，屋頂會打開，看得到有人在床上睡、有人坐著吃飯、有人在鐵砧前打鐵。每天有一份日報，把昨天的大事、各報的評論、外地傳來的消息和記者專欄排在同一份。',
                  'You can see what every villager is doing: tap one and the camera follows them, with a card showing where their mood comes from, who they like and who they owe. Zoom in and the roofs open up, showing someone asleep in bed, someone eating at the table, someone hammering at the anvil. Every day there is one daily paper with yesterday\'s big news, what each paper said, news from afar and a reporter\'s column.'),
              pts: [[X('拉近看屋裡', 'Look inside'), X('拉遠有屋頂，拉近換成剖面，屋裡的人依在做什麼坐著、躺著或工作，名牌旁有小圖示。', 'From afar the roofs are on; zoom in and you get a cutaway where people sit, lie or work depending on what they are doing, with a small icon by their name.')],
                    [X('日報與鎮史', 'The daily and the town history'), X('日報整理昨天的大小事、各報怎麼說和外地消息；每一季寫成一章鎮史。', 'The daily sums up yesterday, what each paper said and news from afar; each season becomes a chapter of town history.')],
                    [X('真相頁', 'The truth page'), X('說謊、栽贓、做假帳、壓新聞，村民不知道的事你都看得到。', 'Lies, frame-ups, cooked books and buried stories: you see what the villagers do not.')]],
              log: [['07:00', X('觀察者日報：鎮長的稅率提案以 12 比 9 通過。', 'Observer\'s daily: the mayor\'s tax proposal passes 12 to 9.')], ['13:10', X('拉近一看，鐵鋪裡三個人在打鐵，老闆坐在角落算帳。', 'Zoom in: three people hammer away in the forge while the owner does the books in the corner.')], ['20:00', X('今晚八點檔：〈賭場門口的那場爭吵〉。', 'Tonight\'s 8 pm episode: "The quarrel outside the casino".')]] },
            { id: 'god', ic: '🃏', c: '#f2c14e', k: X('神之書', 'Book of Gods'),
              h: X('神力不多，要用在刀口上', 'Divine power is scarce — spend it well'),
              lead: X('神力每天慢慢回來，虔誠的人越多回得越快。神之書裡有五十多張事件卡，分普通、稀有、傳說、禁忌四級，稀有以上要小鎮發生過某些事才會寫進書裡。你也可以託夢給某個人，或化身路過的旅人跟人聊天，村民不知道你是神。',
                  'Divine power trickles back each day, faster when more people are devout. The Book of Gods holds over fifty event cards in four tiers — common, rare, legendary and forbidden — and the rarer ones are only written in after something has happened in town. You can also send someone a dream, or chat with people as a passing traveler; nobody knows you are a god.'),
              pts: [[X('事件卡', 'Event cards'), X('每天最多三張：豐年、彗星、善意接力、真話雨……村民用自己的方式解讀。', 'Up to three a day — a bumper harvest, a comet, a chain of kindness, a rain of truth… and villagers interpret each one in their own way.')],
                    [X('託夢', 'Dreams'), X('在某人夢裡說一句話，他醒來可能真的去做，也可能當作怪夢。', 'Say one sentence in someone\'s dream; they may act on it when they wake, or shrug it off as a strange dream.')],
                    [X('化身旅人', 'Walk among them'), X('跟村民聊天，你說的話會留在他的記憶裡、可能傳開，甚至變成提案。', 'Chat with villagers; what you say stays in their memory, may spread, and can even become a proposal.')]],
              log: [['06:30', X('你託夢給小豆子：「去圖書館看看」。他醒來想了很久。', 'You send little Doudou a dream: "Go to the library." He wakes up and thinks about it for a long time.')], ['10:00', X('你打出「彗星」：迷信的人心慌，學者的研究大有進展。', 'You play "Comet": the superstitious panic while scholars make a breakthrough.')], ['15:20', X('旅人隨口說的一句話，傳到了鎮長耳裡。', 'Something the traveler said in passing reaches the mayor\'s ears.')]] },
        ];
        // v9.1.1 首頁敘事改版：不再是十幾段並排的功能介紹，而是一條從小到大的故事線——先講這款遊戲的核心（三根柱子＋一件事怎麼牽動整個鎮），
        // 再分七章由一個人往外擴到整個世界，最後回到你；每章先講一句核心概念（淺），主題卡點開才看細節（深），章尾一句話接到下一章
        const B = Object.fromEntries(bands.map(b => [b.id, b]));
        const chapters = [
            { id: 'self', c: '#f28c4a', scale: X('一個人', 'One person'),
              h: X('先從一個人開始', 'It starts with one person'),
              lead: X('每位村民都是一個完整的人：有個性和價值觀，記得誰對他好，有自己的錢包，也有會生病的身體。餓了要吃飯，病了要看醫生，沒錢就得想辦法。', 'Every villager is a whole person: a personality and values, a memory of who was kind to them, a wallet of their own and a body that can fall ill. Hungry, they need food; sick, they need a doctor; broke, they need a plan.'),
              topics: ['people', 'health', 'myth'],
              bridge: X('一個人的處境和情緒，會變成他對別人的態度。', 'A person\'s situation and mood become how they treat others.') },
            { id: 'ties', c: '#e8b04b', scale: X('人與人', 'Between people'),
              h: X('人跟人之間，比規則複雜', 'People are messier than rules'),
              lead: X('面子、人情、八卦、冷戰、信仰：村民之間有一整套看不見的規矩。誰欠誰人情、誰跟誰鬧翻，都會影響他明天怎麼做事、怎麼投票。', 'Face, favors, gossip, cold wars, faith: villagers live by a whole set of unwritten rules. Who owes whom and who fell out with whom shapes how they work and vote tomorrow.'),
              topics: ['ways', 'culture'],
              bridge: X('交情和信任，決定了誰跟誰合夥、誰替誰做事。', 'Friendship and trust decide who goes into business with whom, and who works for whom.') },
            { id: 'living', c: '#f2c14e', scale: X('討生活', 'Making a living'),
              h: X('每一枚銀幣都有來處和去處', 'Every coin comes from somewhere and goes somewhere'),
              lead: X('鎮上的錢不會憑空出現，也不會憑空消失：工資、稅、分紅、利息、賭債，全是村民之間真的轉手。有人當老闆，有人當夥計，有人組工會，有人輸光家產。', 'Money in town never appears or vanishes out of thin air: wages, taxes, dividends, interest and gambling debts all really change hands between villagers. Some become owners, some workers, some organize unions, some lose everything.'),
              topics: ['money', 'shares', 'union', 'casino'],
              bridge: X('有錢的人想要話語權，沒錢的人想要改變。', 'The rich want a say; the poor want change.') },
            { id: 'power', c: '#7fb3f5', scale: X('誰說了算', 'Who decides'),
              h: X('規則是村民自己訂的', 'The villagers make the rules'),
              lead: X('要蓋什麼、稅收多少、禁不禁賭，都由村民提案、投票，再由首長拍板；報社監督，財團收買，議會可以推翻否決。你看得到檯面上的投票，也看得到檯面下的交易。', 'What to build, how much tax to collect, whether to ban gambling: villagers propose and vote, and the leader decides. The press keeps watch, money buys influence, and the council can overturn a veto. You see the votes on the table and the deals under it.'),
              topics: ['politics', 'power'],
              bridge: X('訂下的政策，決定了小鎮往哪裡長。', 'The policies they choose decide which way the town grows.') },
            { id: 'era', c: '#6fcf97', scale: X('小鎮長大', 'The town grows'),
              h: X('從二十幾個人的村莊，到有國王的王都', 'From a village of twenty to a capital with a king'),
              lead: X('研究推著時代往前走，人口和繁榮讓村莊升級成城鎮、城市、王都。到了第四時代，全鎮要投票選一條科技路線：電子機械、基因生物或蒸汽煉金，每條路都有自己的奇蹟和代價。', 'Research pushes the eras forward, and population and prosperity turn a village into a town, a city, a capital. In the fourth era the whole town votes on a path — electro-mechanical, bio-genetic or steam-alchemy — each with its own wonders and costs.'),
              topics: ['growth', 'path', 'aether'], tiers: true,
              bridge: X('走得越遠，牽連的就不只一個鎮。', 'The further they go, the more it reaches beyond one town.') },
            { id: 'world', c: '#5fc4b8', scale: X('世界與災難', 'The world, and its ends'),
              h: X('外面還有別的鎮，也有末日', 'There are other towns out there — and doomsdays'),
              lead: X('鄰鎮有自己的物產、外交和消息；商隊、旅人、聯姻把大家連在一起。走到第六時代，可能遇上核戰、外星入侵、冰河期這種世界級災厄，村民怎麼面對，是這個世界最大的考驗。', 'Neighboring towns have their own goods, diplomacy and news; caravans, travelers and marriages tie everyone together. In the sixth era a world-scale calamity may come — nuclear war, an alien invasion, an ice age — and how the villagers face it is this world\'s greatest test.'),
              topics: ['world', 'doom', 'aftermath'],
              bridge: X('而這一切，都在你眼前發生。', 'And all of it happens right in front of you.') },
            { id: 'you', c: '#c39bd3', scale: X('你', 'You'),
              h: X('你是觀察者，偶爾當神', 'You are the observer — and now and then, a god'),
              lead: X('你不控制任何人。你可以拉近看屋裡的人在做什麼，讀每天的日報，翻真相頁看誰在說謊；神力存夠了，就打一張事件卡、託一個夢、設計一場災難，然後看小鎮怎麼回應。', 'You control no one. Zoom in to see what people are doing indoors, read the daily paper, check the truth page to see who is lying; when you have enough divine power, play an event card, send a dream or design a disaster, then watch how the town responds.'),
              topics: ['watch', 'god', 'lab'],
              bridge: X('沒有劇本，也沒有結局。', 'No script, and no ending.') },
        ];
        const pillars = [
            ['🧠', X('他們自己做決定', 'They decide for themselves'), X('每位村民都有個性、記憶、錢包和身體。要不要提案、投給誰、去不去賭場、跟誰結婚，都是他自己依經歷想出來的，而且說得出理由。', 'Every villager has a personality, memories, a wallet and a body. Whether to propose, whom to vote for, whether to gamble, whom to marry: each decides from their own experience, and can tell you why.')],
            ['🔗', X('每件事都牽動別的事', 'Everything is connected'), X('經濟、政治、信仰、八卦、科技、災難不是各自獨立的小遊戲，而是同一群人的生活。一個人輸光了錢，會影響他的婚姻、工作、投票，還有整個鎮的輿論。', 'Money, politics, faith, gossip, technology and disaster are not separate mini-games; they are the same people\'s lives. When one man gambles away his savings, it touches his marriage, his job, his vote and the mood of the whole town.')],
            ['👁️', X('你只能看，偶爾當神', 'You watch, and sometimes play god'), X('你不是主角，也不能控制任何人。你看著小鎮長出自己的歷史，偶爾用神力推一把，再看它怎麼回應。', 'You are not the hero and you control no one. You watch the town grow its own history, nudge it now and then with divine power, and see how it responds.')],
        ];
        // 一件事怎麼牽動整個鎮：每一步標上它屬於哪一章（點了跳過去）
        const chain = [
            ['living', X('有錢的阿福在鎮上開了賭場，還雇了一個荷官。', 'Wealthy Afu opens a casino in town and hires a dealer.')],
            ['self', X('愛冒險的礦工老陳一週去三次，輸光積蓄，開始跟莊家賒帳。', 'Old Chen, a miner who loves a risk, goes three times a week, loses his savings and starts betting on credit.')],
            ['ties', X('太太勸他戒賭沒成功，兩人大吵一架；街坊開始說閒話。', 'His wife begs him to quit and fails; they have a blazing row, and the neighbors start to talk.')],
            ['power', X('討厭賭場的人越來越多，跑到門口抗議，有人提案禁賭，全鎮照自己的看法投票。', 'More and more people hate the casino; they protest at its door, someone proposes a ban, and the town votes its conscience.')],
            ['power', X('報社寫成專題，阿福花錢想把報導壓下來，只有你在真相頁看得到。', 'The paper runs a feature and Afu pays to bury it. Only you can see that, on the truth page.')],
            ['you', X('你可以什麼都不做，也可以打一張「善意接力」，看看有沒有人願意拉老陳一把。', 'You can do nothing, or play "A chain of kindness" and see whether anyone helps Old Chen back up.')],
        ];
        const CH = Object.fromEntries(chapters.map((c, i) => [c.id, { ...c, n: i + 1 }]));
        const tiers = [
            ['🏡', X('村莊', 'Village'), X('村長＋長老會 3 席', 'Chief + 3-seat elders'), X('一切的開始：二十幾個人、一間鎮公所。', 'Where it starts: twenty-some people and a hall.')],
            ['🏘️', X('城鎮', 'Town'), X('人口 30＋繁榮 50＋第一時代', 'Pop 30 + prosperity 50 + era 1'), X('鎮長與 5 席鎮議會，銀行與報社陸續出現。', 'A mayor and 5-seat council; banks and papers appear.')],
            ['🏙️', X('城市', 'City'), X('人口 60＋繁榮 65＋第二時代', 'Pop 60 + prosperity 65 + era 2'), X('市長與 7 席市議會，工會開始出現。', 'A city mayor and 7-seat council; unions form.')],
            ['🏰', X('王都', 'Capital'), X('人口 100＋繁榮 80＋第三時代', 'Pop 100 + prosperity 80 + era 3'), X('國王加冕、王令與政變，9 席王都議會。', 'A crowned king, decrees and coups; 9-seat council.')],
        ];
        const aiNotes = [
            ['🤖', X('完整智能體模式（預設開啟）', 'Full agent mode (on by default)'), X('村民要不要提案、怎麼投票、鎮長怎麼裁決，都交給 AI 依各自的記憶、性格和交情推理，並說出理由。', 'Whether to propose, how to vote and how the leader rules are all reasoned by AI from each villager\'s memories, personality and relationships, with reasons given.')],
            ['🔑', X('內建 AI，不用填金鑰', 'Built-in AI, no key needed'), X('所有玩家都用小鎮內建的 AI：先用 Claude，Claude 不能用才換 GPT，兩個都不能用才用 Groq 備援。每個帳號每天有使用上限；金鑰只放在伺服器，網頁原始碼和存檔裡都沒有。', 'Everyone uses the town\'s built-in AI: Claude first, GPT only if Claude is unavailable, and Groq as a last resort. Each account has a daily limit; keys live only on the server, never in the page source or saves.')],
        ];
        const faq = [
            ...aiNotes.map(n => [n[1], n[2]]), // v9.1.1 AI 與金鑰併進常見問題（首頁太長）
            [X('要下載或安裝嗎？', 'Do I need to install anything?'), X('不用。打開網頁就能玩，電腦、平板、手機都可以。', 'No. It runs in the browser on computers, tablets and phones.')],
            [X('我可以控制村民嗎？', 'Can I control the villagers?'), X('不行，這是觀察型遊戲。你能做的是打事件卡、託夢、化身旅人聊天，其他全由村民自己決定。', 'No, this is an observation game. You can play event cards, send dreams or chat as a traveler; the rest is up to them.')],
            [X('存檔會不會不見？', 'Will my save disappear?'), X('登入後存檔會自動同步到雲端，換裝置登入就能接著玩；本機也會留一份備份。', 'Once logged in, saves sync to the cloud so you can continue on another device; a local backup is kept too.')],
            [X('為什麼要邀請碼？', 'Why an invite code?'), X('小鎮的 AI 由伺服器負擔，目前用邀請制控制人數。', 'The server pays for the town\'s AI, so sign-ups are invite-only for now.')],
            [X('AI 會不會亂講話？', 'Will the AI say random things?'), X('村民只能根據自己的記憶、性格和鎮上真的發生的事說話；伺服器也會擋掉不像村民的回覆。', 'Villagers speak only from their own memories, personality and what really happened in town; the server also filters replies that don\'t sound like a villager.')],
            [X('一開始介面怎麼這麼少？', 'Why is the interface so bare at first?'), X('開局只看得到基本分頁，小鎮長大、時代前進、發生大事時，產業、真相、災厄工坊等分頁才會一個個打開，並跳出「解鎖了新分頁」提示。想一開始就全部打開，可以到設定勾選「一開始就顯示全部功能」。', 'You start with only the basic tabs. As the town grows, eras advance and big things happen, tabs like Industry, Truth and the Disaster Workshop open one by one with a notice. To see everything from the start, turn on "Show all features from the start" in Settings.')],
            [X('有英文版嗎？', 'Is there an English version?'), X('有。右上角切換中文／English，村民對話、日報、介面都會換。', 'Yes. Switch 中文／English at the top right; dialogue, the daily paper and the interface all change.')],
        ];
        // v8.5.0 路線圖改成時間軸:已上線只留最近三版(更早的看更新紀錄)、下一步是主角、構想是小標籤
        const roadmap = { // v9.13.2 待辦照目前的順序更新(下一步＝正在做、構想＝還沒排時程)
            done: [['v9.20', X('人際的事也自己拿主意', 'Own choices between people'), X('借的錢還不還、要不要道歉、原不原諒、放下還是報復、要不要在背後講壞話、冷戰誰先開口，都改由本人依自己的個性和交情決定，不再擲骰', 'Whether to repay a loan, apologize, forgive, let go or retaliate, talk behind someone\'s back, and who speaks first after a falling-out are now each villager\'s own choice from their personality and relationships, no longer dice rolls')],
                ['v9.19', X('村民自己拿主意', 'Villagers decide for themselves'), X('錢的事不再擲骰：手上有閒錢、手頭很緊、有人來借錢時，村民依自己的錢、立場和人際自己選；AI 會說出理由，也能想出選單以外的事；村民卡看得到最近的決定', 'Money matters are no longer dice rolls: with spare cash, when short, or when asked for a loan, villagers choose from their own money, stance and relationships; the AI gives its reasons and can think of things beyond the menu; villager cards show recent decisions')],
                ['v9.18', X('全介面資訊改版', 'Clearer screens everywhere'), X('村民一人一列可篩選、村民詳情分成近況／關係／能力／經歷、每個區塊可以收起、長串文字拆成小格子，順手修好幾個顯示錯誤', 'Villagers in one tidy list with filters, villager details split into Now / Relations / Skills / Story, every section folds away and long run-on lines become small tiles, plus several display fixes')]],
            next: [[X('政治也自己拿主意', 'Own choices in politics'), X('要不要加入工會、罷工、捐政治獻金、出來參選，也改成村民依自己的處境決定；立場會跟著日子過得好不好改變', 'Whether to join the union, strike, donate to a campaign or run for office will also be decided by each villager from their own situation, with views that shift as life gets better or worse')],
                [X('新科技帶來新行業', 'New trades from new tech'), X('研究出新東西，鎮上就多出做這行的人、開這種店的老闆，舊行業的人可能失業', 'New inventions create new jobs and new kinds of shops, and people in old trades may lose work')],
                [X('民間出資研究', 'Privately funded research'), X('有錢人自己出錢請研究員、搶先拿到新技術的好處，公家研究跟民間研究互相競爭', 'The wealthy hire researchers with their own money to get new tech first, competing with public research')]],
            ideas: [X('更多世界級災厄（神裔戰爭、生態崩潰、人造人叛亂）', 'More world calamities (demigod war, ecological collapse, android revolt)'), X('災厄工坊進階（突變、世界瘟疫）', 'Advanced calamity workshop (mutation, world plague)'), X('災後重建分得更細', 'More detailed aftermaths'), X('財團與財閥', 'Conglomerates and tycoons'), X('鎮與鎮之間的貨幣與匯率', 'Currencies between towns'), X('玩家之間互訪城鎮', 'Visit other players\' towns'), X('手機 App 版', 'Mobile app')],
        };
        // 主視覺背景:手繪低多邊形夜景(月亮、星星、山丘、亮著燈的房子)
        const sky = (() => {
            const stars = [[60, 40], [140, 90], [220, 30], [330, 70], [410, 25], [520, 60], [610, 35], [700, 85], [790, 45], [880, 20], [960, 70], [1050, 40], [1130, 95], [1180, 30], [260, 120], [470, 110], [740, 130], [1000, 125]]
                .map(([x, y], i) => [x, y, i % 3 ? 1.4 : 2.2, i % 3]); // v6.82.2 星星分三組，各一層整層變亮變暗(只動透明度，GPU 合成，不用每格重畫 SVG)
            const houses = [[90, 300, 70, 46], [190, 312, 54, 34], [300, 292, 80, 54], [420, 306, 60, 40], [560, 286, 96, 60], [700, 304, 64, 42], [800, 296, 76, 50], [930, 310, 58, 36], [1040, 298, 72, 48], [1150, 308, 60, 40]];
            const hs = houses.map(([x, y, w, h], i) => {
                const roof = `<polygon points="${x - 6},${y} ${x + w / 2},${y - h * 0.62} ${x + w + 6},${y}" fill="#3a2a3f"/>`;
                const body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a2235"/>`;
                const win = `<rect x="${x + w * 0.2}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}" class="lp-win"/>` + (w > 60 ? `<rect x="${x + w * 0.6}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}" class="lp-win"/>` : '');
                return roof + body + win;
            }).join('');
            // 窗燈明暗:同樣的窗戶在上面一層畫成橘色，整層慢慢淡入淡出
            const glow = houses.map(([x, y, w, h], i) => `<rect x="${x + w * 0.2}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}"/>` + (w > 60 ? `<rect x="${x + w * 0.6}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}"/>` : '')).join('');
            const layer = (cls, inner) => `<svg class="lp-sky lp-sky-l ${cls}" viewBox="0 0 1240 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${inner}</svg>`;
            const starG = (g) => stars.filter(s => s[3] === g).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
            const trees = [40, 250, 380, 510, 670, 880, 1000, 1220].map((x, i) => `<polygon points="${x - 16},350 ${x},${300 - (i % 2) * 14} ${x + 16},350" fill="#1f3a34"/>`).join('');
            return `<svg class="lp-sky" viewBox="0 0 1240 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
                <defs><linearGradient id="lpSkyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151230"/><stop offset="0.6" stop-color="#2b2350"/><stop offset="1" stop-color="#3d2f55"/></linearGradient></defs>
                <rect width="1240" height="360" fill="url(#lpSkyG)"/>
                <circle cx="760" cy="62" r="26" fill="#f6e7c1" opacity="0.92"/><circle cx="771" cy="55" r="23" fill="#1d1838"/>
                <polygon points="0,300 160,230 330,280 520,210 700,270 900,215 1080,265 1240,225 1240,360 0,360" fill="#241f3d"/>
                ${hs}${trees}<rect y="348" width="1240" height="12" fill="#1a1630"/></svg>`
                + layer('lp-stars lp-stars-0', starG(0)) + layer('lp-stars lp-stars-1', starG(1)) + layer('lp-stars lp-stars-2', starG(2))
                + layer('lp-glow-l', glow);
        })();
        // v5.81.0 更新紀錄(240KB)不再隨頁面載入:首頁第一次畫時才動態載 changelog.js,載完重畫一次;直接進遊戲的人完全不載
        // v6.82.2 再延後:捲到更新紀錄附近才載(550KB,大多數人不會往下捲到那裡)
        const loadLog = () => {
            if (typeof RIMTOWN_CHANGELOG !== 'undefined' || this._changelogLoading) return;
            this._changelogLoading = true;
            const sc = document.createElement('script');
            sc.src = 'changelog.js?v=' + encodeURIComponent(RIMTOWN_APP_VERSION);
            sc.onload = () => { if (!this._landingActive) return; try { if (!this._lpFillLog?.()) this._renderLanding(); } catch (e) {} }; // v6.98.0 只更新更新紀錄那一塊(整頁重畫會把 3D 主視覺和捲動位置都重來)
            document.head.appendChild(sc);
        };
        const log = (typeof RIMTOWN_CHANGELOG !== 'undefined' && Array.isArray(RIMTOWN_CHANGELOG)) ? RIMTOWN_CHANGELOG : [];
        const logHtml = log.map((e, i) => `<div class="landing-log-item${i >= 3 ? ' extra' : ''}">
                <div class="landing-log-head"><span>v${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('');
        const sec = (id, kicker, title, body, extra = '') => `<section class="landing-section lp-sec${extra}" id="${id}"><div class="lp-sec-head"><span class="lp-kicker">${kicker}</span><h2>${title}</h2></div>${body}</section>`;
        const num = (n) => String(n).padStart(2, '0');
        const first = (txt) => { const m = L === 'en' ? txt.match(/^.*?[.!?](?=\s|$)/) : txt.match(/^.*?。/); return m ? m[0] : txt; }; // 主題卡上只放第一句（淺），其餘點開看（深）
        const topic = (b) => `<article class="lp-topic" id="lp-${b.id}" style="--c:${b.c}">
                <div class="lp-topic-k"><span aria-hidden="true">${b.ic}</span>${b.k}</div>
                <h3>${b.h}</h3>
                <p class="lp-topic-sum">${first(b.lead)}</p>
                <details class="lp-topic-more"><summary>${X('看細節', 'More')}</summary>
                    ${(() => { const rest = b.lead.slice(first(b.lead).length).trim(); return rest ? `<p class="lp-band-lead">${rest}</p>` : ''; })()}
                    <dl class="lp-points">${b.pts.map(p => `<div><dt>${p[0]}</dt><dd>${p[1]}</dd></div>`).join('')}</dl>
                </details>
            </article>`;
        const tiersHtml = () => `<div class="lp-ch-tiers"><div class="lp-scene-head">${X('城鎮四級', 'Four town tiers')}</div><ol class="lp-tiers">${tiers.map((x, i) => `<li><span class="lp-tier-ic" aria-hidden="true">${x[0]}</span><h3>${x[1]}</h3><span class="lp-tier-reqs">${String(x[2]).split(/\s*[＋+]\s*/).map(q => `<span class="lp-tier-req">${q}</span>`).join('')}</span><p>${x[3]}</p>${i < tiers.length - 1 ? '<span class="lp-tier-arrow" aria-hidden="true">→</span>' : ''}</li>`).join('')}</ol><p class="lp-note">${X('人口、繁榮或時代掉下來，城鎮也會降級。', 'If population, prosperity or era drops, the town is demoted.')}</p></div>`;
        const chapter = (c, i) => {
            const ts = c.topics.map(id => B[id]).filter(Boolean);
            const scene = ts.map(b => b.log[0]).filter(Boolean).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 3);
            const next = chapters[i + 1];
            return `<section class="lp-chapter" id="lp-ch-${c.id}" style="--c:${c.c}" aria-labelledby="lp-ch-${c.id}-h">
            <div class="lp-ch-in">
                <div class="lp-ch-top">
                    <header class="lp-ch-head">
                        <span class="lp-kicker"><b class="lp-ch-num" aria-hidden="true">${num(i + 1)}</b>${X('第 {n} 章', 'Chapter {n}').replace('{n}', i + 1)} · ${c.scale}</span>
                        <h2 id="lp-ch-${c.id}-h">${c.h}</h2>
                        <p class="lp-ch-lead">${c.lead}</p>
                    </header>
                    <aside class="lp-scene" aria-label="${X('遊戲裡你會看到', 'What you\'ll see in the game')}">
                        <div class="lp-scene-head">${X('遊戲裡你會看到', 'What you\'ll see in the game')}</div>
                        <ol>${scene.map(l => `<li><time>${l[0]}</time><span>${l[1]}</span></li>`).join('')}</ol>
                    </aside>
                </div>
                <div class="lp-topics">${ts.map(topic).join('')}</div>
                ${c.tiers ? tiersHtml() : ''}
                <p class="lp-ch-bridge${next ? '' : ' is-end'}">${next ? `<a href="#lp-ch-${next.id}" data-lp-jump="lp-ch-${next.id}"><span class="lp-ch-bridge-txt">${c.bridge}</span><span class="lp-ch-bridge-go">${X('下一章', 'Next')} ${num(i + 2)} · ${next.scale} <span aria-hidden="true">↓</span></span></a>` : `<span class="lp-ch-bridge-txt">${c.bridge}</span>`}</p>
            </div>
        </section>`;
        };
        const core = `<section class="landing-section lp-sec lp-core" id="landing-core"><div class="lp-sec-head"><span class="lp-kicker">${X('這是什麼遊戲', 'What this game is')}</span><h2>${X('一座自己活著的小鎮', 'A town that lives on its own')}</h2></div>
                <ol class="lp-pillars">${pillars.map((p, i) => `<li class="lp-pillar"><span class="lp-pillar-ic" aria-hidden="true">${p[0]}</span><h3>${p[1]}</h3><p>${p[2]}</p></li>`).join('')}</ol>
                <div class="lp-chain" id="landing-chain">
                    <div class="lp-chain-head"><h3>${X('一件事怎麼牽動整個鎮', 'How one thing ripples through a town')}</h3><p>${X('以下沒有寫在劇本裡。每一步都是村民依自己的個性和處境決定的，換一局就不一樣。', 'None of this is scripted. Every step is decided by villagers according to their own character and circumstances, and it plays out differently every game.')}</p></div>
                    <ol>${chain.map(([cid, txt]) => `<li style="--c:${CH[cid].c}"><a class="lp-chain-tag" href="#lp-ch-${cid}" data-lp-jump="lp-ch-${cid}">${num(CH[cid].n)} ${CH[cid].scale}</a><span>${txt}</span></li>`).join('')}</ol>
                </div>
            </section>`;
        // v9.19.1 村民自己拿主意(決策核心)的完整介紹:改前改後、五個步驟、同一件事三種選擇、在遊戲裡哪裡看、做到哪
        const dSteps = [
            ['📒', X('先看自己的處境', 'Look at their own situation'), X('此刻的心情和身體、身上的錢和債、對鎮上大事的立場、家人朋友和處不來的人、最近發生的事，還有自己以前做過的決定。', 'How they feel right now, their money and debts, where they stand on town issues, family, friends and people they can\'t stand, what happened lately, and the decisions they made before.')],
            ['🔔', X('遇到要拿主意的事', 'Something comes up'), X('手上有閒錢、有人來借錢、借的錢到期了、對不起某人、有人來道歉、跟人冷戰。遊戲只列出「現在做得到的選項」，不替他選。', 'Spare money, someone asking for a loan, a debt coming due, owing someone an apology, someone coming to apologize, a silent feud. The game only lists what is possible right now. It does not choose for them.')],
            ['🤔', X('自己選，說出理由', 'Choose, and say why'), X('AI 依他自己的處境挑一個，用他的口吻說為什麼。也可以選「其他」，做一件選單上沒有的事。', 'The AI picks one from that villager\'s own situation and gives the reason in their voice. It can also pick "something else" and do a thing that is not on the list.')],
            ['⚖️', X('真的發生', 'It really happens'), X('錢真的從一個人到另一個人手上，交情真的變好或變壞。每一筆錢都有來源和去處，不會憑空多出來。', 'Money really moves from one person to another, and relationships really warm or cool. Every coin has a source and a destination; none appears from nowhere.')],
            ['🧠', X('記住結果', 'Remember how it went'), X('決定、理由、結果都記下來；下次再遇到事，他看得到自己上次怎麼選、後來怎樣，還會留下「接下來的打算」。', 'The decision, the reason and the outcome are all kept. Next time something comes up they can see what they chose before and how it went, and they leave themselves a plan for what comes next.')],
        ];
        const dPicks = [
            [X('愛冒險的獵人', 'An adventurous hunter'), X('去外地玩幾天', 'Takes a few days\' trip out of town'), X('「辛苦這麼久，想出去走走看看。」', '"After all this hard work, I want to get out and see things."')],
            [X('顧家的農夫', 'A family-minded farmer'), X('送孩子去外地讀書', 'Sends a child to school out of town'), X('「再苦也要讓孩子讀書。」', '"However hard it gets, the child must get schooling."')],
            [X('克己的守衛', 'A frugal guard'), X('存進銀行', 'Puts it in the bank'), X('「錢放銀行比較安心，還能生利息。」', '"It\'s safer in the bank, and it earns interest."')],
        ];
        const dProg = [
            ['done', X('✅ 已上線', '✅ Live'), X('錢的事', 'Money'), X('花、存、入股、旅遊、宴客、送孩子讀書、接濟親友、借錢與被借錢。', 'Spending, saving, buying shares, travel, feasts, schooling, helping people close to them, borrowing and being asked for a loan.')],
            ['done', X('✅ 已上線', '✅ Live'), X('人際', 'Relationships'), X('借的錢還不還、要不要道歉、原不原諒、放下還是報復、要不要在背後講壞話、冷戰誰先開口。', 'Whether to repay a loan, apologize, forgive, let go or retaliate, talk behind someone\'s back, and who speaks first after a falling-out.')],
            ['', X('🔜 下一步', '🔜 Next'), X('政治', 'Politics'), X('要不要加入工會、捐政治獻金、出來參選；立場會跟著日子過得好不好改變。', 'Whether to join the union, fund a campaign or run for office, with views that shift as life gets better or worse.')],
        ];
        const decide = `<section class="landing-section lp-sec lp-decide" id="landing-decide"><div class="lp-sec-head"><span class="lp-kicker">${X('v9.20 大更新・村民的大腦', 'v9.20 major update · the villager brain')}</span><h2>${X('村民開始自己拿主意', 'Villagers now make up their own minds')}</h2></div>
                <p class="lp-ch-lead">${X('以前，誰去旅遊、誰跟誰借錢、誰去道歉、誰記仇報復，是遊戲每天替他們擲骰決定的。現在改成：村民遇到事情時，先看自己的處境，再自己選，說得出理由，也記得後來怎樣。', 'Before, who travelled, who borrowed from whom, who apologized and who took revenge was decided by the game rolling dice for them every day. Now, when something comes up, a villager looks at their own situation, chooses for themselves, can say why, and remembers how it turned out.')}</p>
                <div class="lp-ba">
                    <div><b>${X('以前', 'Before')}</b><p>${X('「身上超過 100 銀幣的人，每天有 2% 的機率去旅遊。」', '"Anyone with more than 100 silver has a 2% chance each day of taking a trip."')}</p></div>
                    <div class="now"><b>${X('現在', 'Now')}</b><p>${X('「我手上有 600 銀幣，孩子還小，上次入股又被拒絕。這次先存起來。」', '"I have 600 silver, my child is still small, and my last offer to buy shares was turned down. This time I\'ll save it."')}</p></div>
                </div>
                <ol class="lp-steps lp-steps-5">${dSteps.map((x, i) => `<li class="lp-step"><span class="lp-step-num" aria-hidden="true">${i + 1}</span><div class="lp-step-ic" aria-hidden="true">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></li>`).join('')}</ol>
                <h3 class="lp-sub-h">${X('同樣一筆閒錢，三個人三種選擇', 'The same spare money, three people, three choices')}</h3>
                <ul class="lp-picks">${dPicks.map(x => `<li><span class="who">${x[0]}</span><h4>${x[1]}</h4><p>${x[2]}</p></li>`).join('')}</ul>
                <p class="lp-note">${X('以上是示意。實際上每個人的錢、家人、交情和記憶都不一樣，換一局結果就不同。', 'These are illustrations. In play, everyone\'s money, family, friendships and memories differ, so each game turns out differently.')}</p>
                <h3 class="lp-sub-h">${X('在遊戲裡哪裡看得到', 'Where to see it in the game')}</h3>
                <dl class="lp-points" style="--c:var(--lp-accent)">
                    <div><dt>🪪 ${X('村民卡的「最近的決定」', '"Recent decisions" on the villager card')}</dt><dd>${X('遇到什麼事、選了什麼、為什麼、結果怎樣，還有他接下來的打算。每一筆會標出是 AI 自己想的，還是依個性推估的。', 'What came up, what they chose, why, how it went, and what they plan next. Each entry says whether the AI decided or it was estimated from personality.')}</dd></div>
                    <div><dt>🧭 ${X('動態裡的決定', 'Decisions in the feed')}</dt><dd>${X('「某某想了想，決定……」是 AI 選的；「💭 某某自己拿了主意……」是他做了選單以外的事。', '"So-and-so thought it over and decided to..." is the AI\'s choice; "💭 So-and-so made up their own mind..." means they did something that was not on the list.')}</dd></div>
                    <div><dt>⚙️ ${X('設定裡的「完整智能體模式」', '"Full agent mode" in Settings')}</dt><dd>${X('開著時由 AI 決定，每天最多 10 人；其他人，或 AI 沒回話的時候，依他的個性和處境推估，不再是固定機率。', 'When on, the AI decides for up to 10 people a day. Everyone else, and anyone the AI doesn\'t answer for, is estimated from their personality and situation rather than fixed odds.')}</dd></div>
                </dl>
                <h3 class="lp-sub-h">${X('做到哪了', 'How far along this is')}</h3>
                <ul class="lp-prog">${dProg.map(x => `<li class="${x[0]}"><span class="st">${x[1]}</span><h4>${x[2]}</h4><p>${x[3]}</p></li>`).join('')}</ul>
            </section>`;
        const chnav = `<nav class="lp-chnav" aria-label="${X('章節', 'Chapters')}"><div class="lp-chnav-in"><span class="lp-chnav-k">${X('從一個人到整個世界', 'From one person to a whole world')}</span><ol>${chapters.map((c, i) => `<li style="--c:${c.c}"><a href="#lp-ch-${c.id}" data-lp-jump="lp-ch-${c.id}"><b>${num(i + 1)}</b>${c.scale}</a></li>`).join('')}</ol></div></nav>`;
        el.innerHTML = `<div class="lp">
            <header class="lp-hero">${sky}
                <div class="landing-lang" role="group" aria-label="Language">
                    <button type="button" data-lang="zh" class="${L === 'zh' ? 'active' : ''}">中文</button><button type="button" data-lang="en" class="${L === 'en' ? 'active' : ''}">EN</button>
                </div>
                <div class="lp-hero-grid landing-inner">
                    <div class="lp-hero-copy">
                        <span class="lp-kicker">${X('瀏覽器 3D・AI 小鎮沙盒', 'Browser 3D · AI town sandbox')}</span>
                        <h1 class="lp-title">${X('邊境鎮', 'RimTown')}<span>${L === 'en' ? 'Frontier Town' : 'RimTown'}</span></h1>
                        <p class="lp-tagline">${X('一座由 AI 村民自己過日子的 3D 小鎮。你在天上看著，偶爾推它一把。', 'A 3D town where AI villagers live their own lives. You watch from above and nudge it now and then.')}</p>
                        <p class="lp-lead">${X('每位村民都有自己的個性、記憶、錢包和身體，他們做的每個決定都會牽動別人：一場賭局可能拆散一個家、掀起一場抗議、改變一次選舉。小鎮可能從村莊長成王都，也可能因為一場饑荒散掉。沒有劇本，也沒有結局。', 'Every villager has their own personality, memories, wallet and body, and every choice they make ripples out to others: one bet can break up a family, spark a protest and swing an election. The town may grow from a village into a capital, or fall apart after one famine. No script, and no ending.')}</p>
                        <div class="landing-cta">${cta}</div>
                        <ul class="lp-badges">${[['🖥️', X('免安裝', 'No install')], ['📱', X('手機也能玩', 'Works on phones')], ['☁️', X('雲端存檔', 'Cloud saves')], ['🌐', X('中文／English', '中文／English')]].map(b => `<li><span aria-hidden="true">${b[0]}</span>${b[1]}</li>`).join('')}</ul>
                        <div class="landing-version">v${esc(ver)}${loggedIn ? ` · ${esc(this.auth.username)}` : ''}</div>
                    </div>
                    <div class="lp-stage" id="lp-stage" role="img" aria-label="${X('3D 方塊村民在小草島上聊天', '3D blocky villagers chatting on a small grassy island')}"><div class="lp-stage-ph" aria-hidden="true"></div></div>
                </div>
            </header>
            <div class="landing-inner">
                <ul class="lp-stats" aria-label="${X('遊戲規模', 'Game scale')}">${stats.map(s => `<li><b>${s[0]}</b><span>${s[1]}</span></li>`).join('')}</ul>
                ${core}
                ${decide}
            </div>
            ${chnav}
            <div id="landing-features" class="lp-chapters">${chapters.map(chapter).join('')}</div>
            <div class="landing-inner">
                ${this._renderBrainSection()}
                ${sec('landing-faq', X('常見問題', 'FAQ'), X('你可能想問', 'You might be wondering'), `<div class="lp-faq">${faq.map(q => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('')}</div>`)}
                <section class="landing-section lp-sec"><div class="lp-sec-head"><span class="lp-kicker">${X('一直在更新', 'Always updating')}</span><h2>${X('更新紀錄', 'Changelog')}</h2></div>
                    <div class="landing-log" id="landing-log">${logHtml || `<div class="landing-log-item">${typeof RIMTOWN_CHANGELOG === 'undefined' ? t('載入中…') : t('尚無紀錄')}</div>`}</div>
                    ${log.length > 3 ? `<button class="landing-more" id="landing-log-more">${t('顯示全部')} (${log.length})</button>` : ''}
                </section>
                <section class="landing-section lp-sec"><div class="lp-sec-head"><span class="lp-kicker">${X('接下來', 'Next')}</span><h2>${X('路線圖', 'Roadmap')}</h2></div>
                    <div class="lp-rm">
                        <div class="lp-rm-col lp-rm-done"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('已上線', 'Shipped')}<small>${X('最近三版', 'latest three')}</small></div>
                            ${roadmap.done.map(([v, h, d]) => `<div class="lp-rm-item"><span class="lp-rm-ver">${v}</span><div><b>${h}</b><p>${d}</p></div></div>`).join('')}
                            <a class="lp-rm-more" href="#landing-log" data-lp-log>${X('更早的版本看上面的更新紀錄 ↑', 'Earlier versions are in the changelog above ↑')}</a></div>
                        <div class="lp-rm-col lp-rm-next"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('下一步', 'Up next')}<small>${X('正在設計', 'in design')}</small></div>
                            ${roadmap.next.map(([h, d]) => `<div class="lp-rm-item"><div><b>${h}</b><p>${d}</p></div></div>`).join('')}</div>
                        <div class="lp-rm-col lp-rm-idea"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('構想', 'Ideas')}<small>${X('還沒排時程', 'not scheduled')}</small></div>
                            <div class="lp-rm-pills">${roadmap.ideas.map(x => `<span>${x}</span>`).join('')}</div></div>
                    </div>
                </section>
                <section class="lp-final"><h2>${X('去看看你的小鎮今天發生了什麼', 'Go see what happened in your town today')}</h2><p>${X('註冊需要邀請碼。存檔自動同步雲端，換裝置登入就能接著玩。', 'Sign-up needs an invite code. Saves sync to the cloud, so you can continue on any device.')}</p><div class="landing-cta">${loggedIn ? `<button class="landing-btn primary" data-lp-go="continue">▶ ${t('繼續遊戲')}</button>` : `<button class="landing-btn primary" data-lp-go="register">✨ ${t('註冊')}</button><button class="landing-btn secondary" data-lp-go="login">🔑 ${t('登入')}</button>`}</div></section>
                <footer class="landing-footer">${X('邊境鎮 RimTown', 'RimTown')} · v${esc(ver)}</footer>
            </div>
        </div>`;
        // v6.98.0 3D 方塊村民(閒置時才載 three.js;沒有 WebGL 改放一張實際畫面)
        try { if (typeof LANDING3D !== 'undefined') LANDING3D.mount(el.querySelector('#lp-stage')); } catch (e) {}
        // 目錄跳段:在 #landing 這個捲動容器裡平滑捲過去
        el.querySelectorAll('[data-lp-jump]').forEach(a => a.addEventListener('click', (ev) => { const tg = el.querySelector('#' + a.dataset.lpJump); if (!tg) return; ev.preventDefault(); tg.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }));
        this._wireBrainDemo(el);
        try { this._lpChObs?.disconnect(); const links = [...el.querySelectorAll('.lp-chnav a')]; if (links.length && 'IntersectionObserver' in window) { this._lpChObs = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; links.forEach(a => { const on = a.dataset.lpJump === e.target.id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }), { root: el, rootMargin: '-40% 0px -55% 0px' }); el.querySelectorAll('.lp-chapter').forEach(s => this._lpChObs.observe(s)); } } catch (e) {} // v9.1.1
        if (typeof RIMTOWN_CHANGELOG === 'undefined' && !this._changelogLoading) {
            const box = el.querySelector('#landing-log');
            if (box && 'IntersectionObserver' in window) { try { this._lpLogObs?.disconnect(); this._lpLogObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { this._lpLogObs.disconnect(); loadLog(); } }, { root: el, rootMargin: '900px 0px' }); this._lpLogObs.observe(box); } catch (e) { loadLog(); } } else loadLog();
            // v7.9.0 保險:有時(英文手機版重畫之後)觀察器沒觸發,捲到接近底部也載
            if (!el._logScroll) { el._logScroll = true; el.addEventListener('scroll', () => { if (typeof RIMTOWN_CHANGELOG === 'undefined' && el.scrollTop + el.clientHeight > el.scrollHeight - 2500) loadLog(); }, { passive: true }); }
        }
        // v6.82.2 主視覺捲出畫面就暫停星星與窗燈動畫
        try { this._lpHeroObs?.disconnect(); const hero = el.querySelector('.lp-hero'); if (hero && 'IntersectionObserver' in window) { this._lpHeroObs = new IntersectionObserver(es => es.forEach(e => hero.classList.toggle('lp-off', !e.isIntersecting))); this._lpHeroObs.observe(hero); } } catch (e) {}
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
        el.querySelectorAll('[data-lp-log]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); el.querySelector('#landing-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); })); // v8.5.0 路線圖 → 更新紀錄
        el.querySelectorAll('[data-lp-go]').forEach(btn => btn.addEventListener('click', () => { const g = btn.dataset.lpGo; if (g === 'continue') this._enterGame(); else this._openAuth(g); })); // v6.79.0 頁尾再放一次按鈕
        el.querySelector('#landing-logout')?.addEventListener('click', () => this._doLogout());
        el.querySelector('#landing-log-more')?.addEventListener('click', (ev) => {
            const box = el.querySelector('#landing-log'); if (!box) return;
            const expanded = box.classList.toggle('expanded');
            ev.currentTarget.textContent = expanded ? t('只看最近 3 版') : `${t('顯示全部')} (${log.length})`;
        });
        this._landingUpdateContinue();
    },
    // v6.98.0 更新紀錄載完只重畫那一塊
    _lpFillLog() {
        const el = document.getElementById('landing'); const box = el?.querySelector('#landing-log'); if (!box) return false;
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const log = (typeof RIMTOWN_CHANGELOG !== 'undefined' && Array.isArray(RIMTOWN_CHANGELOG)) ? RIMTOWN_CHANGELOG : [];
        box.innerHTML = log.map((e, i) => `<div class="landing-log-item${i >= 3 ? ' extra' : ''}">
                <div class="landing-log-head"><span>v${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('') || `<div class="landing-log-item">${t('尚無紀錄')}</div>`;
        if (log.length > 3 && !el.querySelector('#landing-log-more')) {
            const b = document.createElement('button'); b.className = 'landing-more'; b.id = 'landing-log-more'; b.textContent = `${t('顯示全部')} (${log.length})`; box.after(b);
            b.addEventListener('click', () => { const ex = box.classList.toggle('expanded'); b.textContent = ex ? t('只看最近 3 版') : `${t('顯示全部')} (${log.length})`; });
        }
        return true;
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
            ['💬', t('對話'), t('鏡頭附近的對話由 AI 生成（受每日額度限制）；遠處的對話走規則式模板，但同樣寫進記憶。')],
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
            <p class="landing-muted landing-brain-foot">${t('成本閘門：只有鏡頭附近的對話、重要人物與每日額度內的行程／反思會呼叫 AI，其餘一律規則式運算，所以一百多人的城鎮同時「活著」也不會燒錢。')}</p>
            ${this._renderTechDetails()}
        </details></section>`;
    },
    // v5.70.0 首頁「技術細節」摺疊區:一次 AI 請求的旅程、兩個 AI 怎麼協作
    _renderTechDetails() {
        const flow = [
            ['🗣️', t('鏡頭附近發生對話')],
            ['📝', t('組提示詞')],
            ['⚡', t('先問 Claude')],
            ['🤝', t('失敗依序換 GPT、Groq 接手')],
            ['🛡️', t('守門：拒答／洩漏／簡體')],
            ['🧠', t('寫回記憶與關係')],
        ];
        const ingredients = [
            [t('身分行'), t('「你是某某；跟你說話的是常路過的旅人（村民不知道祂是神）；現任鎮長是誰」——避免叫錯人')],
            [t('抽出的記憶'), t('用時近×相關×重要度挑出最該想起的 3 到 6 條，不是整本翻')],
            [t('關係數字'), t('對這個人的好感、信任、心動，以及目前的稱呼（朋友／對手／暗戀）')],
            [t('今天的計畫'), t('清晨排好的行程與現在正在做的事，讓對話有上下文')],
            [t('性格與心情'), t('三個特質、價值觀、當下心情與最近的想法')],
            [t('輸出格式'), t('只准輸出台詞與 EFFECTS 行（好感／心動／記憶變動），不准前言、分析、免責聲明')],
        ];
        const lanes = [
            [t('快車道 chat'), t('鏡頭附近的即時對話、完整智能體決策'), t('Claude'), t('GPT → Groq'), '15s → 15s → 12s'],
            [t('慢車道 background'), t('每日行程、深度反思、八卦與劇情'), t('Claude'), t('GPT → Groq'), '15s → 15s → 12s'],
        ];
        const handoff = [
            t('所有渠道共用一個 26 秒預算（無伺服器函式上限 30 秒），前面用掉多少，後面就只剩多少。'),
            t('逾時、限流（429）、伺服器錯誤：那條路冷卻。Groq 依回傳的重試時間冷卻，最短 5 分鐘；Claude 與 GPT 每失敗一次冷卻多 60 秒，上限 5 分鐘，成功即解除。'),
            t('回空白或拒絕扮演不算那條路壞掉，不冷卻，只是這一次換人。'),
            t('每次回應都帶著 provider、lane、model 與 fallback_from，出問題可以直接從紀錄看出是哪一段接手的。'),
        ];
        const quota = [
            t('每次 Groq 回應都會讀 x-ratelimit 標頭，記下剩餘 token、剩餘請求數與重置時間。'),
            t('下一次請求先估算要用多少：中文每字算 1 token，其他每 4 個字元算 1，再加輸出上限（至少 160）與 50 的緩衝。'),
            t('輪到 Groq 備援時，估算超過剩餘額度就排到最後，不會撞到 429 才發現。'),
            t('推理型模型（gpt-oss）固定輸出下限 160 token、推理強度 low、隱藏推理過程，避免它「想太久」回空白。'),
        ];
        const guard = [
            t('系統指示寫死：一律繁體中文（台灣用語）、不准自報 AI 身分、不准拒絕扮演、不准加前言。'),
            t('回覆若出現「I\'m Kiro / I am an AI / not designed for roleplay」這類句型，視同失敗，換另一條路重打。'),
            t('伺服器端先做簡轉繁（OpenCC 台灣用語），前端再掃一次；載入舊存檔時也會把殘留的簡體與洩漏句清掉。'),
            t('每位村民 500 條記憶上限，對話結束後只把「他會記住的那句話」寫進去，重要度 4 到 8。'),
        ];
        const cost = [
            t('只有鏡頭附近的村民才會呼叫 AI 對話，遠處的走規則式模板，但一樣寫進記憶、一樣影響好感。'),
            t('每天有 AI 額度：行程一批打包成一次請求（每人約 450 token），深度反思每天最多 3 位。'),
            t('Groq 免費層大約每分鐘 30 次、每天 1,000 次、每分鐘 8,000 token；只在 Claude 與 GPT 都故障時才用到，玩家不會感覺到斷線。'),
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
                <p class="landing-muted">${t('對話、行程、反思、投票與鎮長裁決一律先問 Claude，品質一致；Claude 不能用才換 GPT，兩個都不能用才用 Groq 備援。')}</p>
                <h4>③ ${t('互相接手與冷卻')}</h4>
                <ul class="landing-list">${handoff.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>④ ${t('免費額度保護')}</h4>
                <ul class="landing-list">${quota.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑤ ${t('品質守門')}</h4>
                <ul class="landing-list">${guard.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑥ ${t('成本閘門')}</h4>
                <ul class="landing-list">${cost.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <p class="landing-muted">${t('AI 金鑰全部放在伺服器環境變數，網頁原始碼與存檔裡都沒有；玩家不需要、也不能填自己的金鑰。')}</p>
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
