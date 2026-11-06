// RimTown - app-landing.js：從 app.js 拆出的 新手教學、第一天引導、任務引導、帳號選單、首頁（landing）、進入遊戲、登入視窗（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／sw.js 都要列）。
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
        // v6.79.0 首頁重新設計:主視覺(手繪夜景＋實際遊戲畫面)、數字、怎麼玩、小鎮的一天、特色、畫面一覽、成長路線、AI、常見問題
        const L = I18N.getLang() === 'en' ? 'en' : 'zh';
        const shot = (k) => `img/landing/${k}-${L}.jpg`;
        const stats = [['30', t('張事件卡')], ['28', t('項研究')], ['33', t('種建築')], ['4', t('級城鎮')], ['6', t('種宗教骨架')], ['500', t('條記憶／每人')]];
        const howto = [
            ['🏘️', t('開一個世界'), t('每場遊戲都是獨立的世界，從邊境鎮開始。鄰鎮、道路和遠方的城鎮只屬於這一場，跟其他存檔互不影響。'), t('例：開新遊戲 → 新的邊境鎮、新的鄰居、新的地圖')],
            ['👀', t('在天上看'), t('點村民，鏡頭就跟著他，看得到他在想什麼、跟誰要好、欠誰錢。提案頁看大家想做什麼，觀察者日報看昨天發生了什麼。'), t('例：點鐵匠 → 看到他暗戀麵包師、還欠酒館三天的帳')],
            ['🃏', t('偶爾推一把'), t('你能做的事很少：每天最多打 2 張事件卡（天災、人禍、機運、人際共 30 張），託夢給某位村民，或化身路過的旅人跟人聊天。'), t('例：打出「旱災」→ 農夫提案開水圳 → 全鎮投票')],
            ['📜', t('看小鎮怎麼回應'), t('「反應追蹤」記下每個人的反應、提了什麼案、七天後小鎮變成什麼樣；每一季寫成一章鎮史。沒有結局，可以一直玩下去。'), t('例：七天後糧價回穩，提案的農夫在下次選舉多拿了票')],
        ];
        const day = [
            ['06:00', '🌅', t('天亮開工'), t('農夫依地形去種田、捕魚或打獵，鐵匠打工具，木匠造紙做家具。')],
            ['10:00', '🏛️', t('提案與投票'), t('有人提議蓋穀倉、有人想調稅率；全鎮投票，村長拍板並說出理由。')],
            ['12:30', '🍲', t('酒館八卦'), t('午飯時間最熱鬧：誰暗戀誰、誰欠錢不還，消息一傳十、十傳百，越傳越走樣。')],
            ['15:00', '🐎', t('商隊進城'), t('海港帶來魚和鹽、林間村帶來木材和紙，缺什麼就靠貿易補。')],
            ['19:00', '💞', t('約會與吵架'), t('有人在廣場告白，有人當眾對嗆；派系在角落密謀下一次選舉。')],
            ['23:00', '🗞️', t('觀察者日報'), t('一天的八卦與大小事整理成一份報紙，隔天早上讀。')],
        ];
        const features = [
            ['🧠', '#f28c4a', t('像真人的村民'), t('每個人有個性、記憶、六項需求和自己的心事。他們聊天、八卦、交朋友、戀愛結婚，也會講壞話、說謊、設局；做錯事會道歉，不被原諒就報復。你在天上看得到真相。'), [t('記憶與反思'), t('戀愛與婚姻'), t('謊言與陰謀')]],
            ['🗳️', '#7fb3f5', t('自己治理小鎮'), t('提案全是村民自己想的，全鎮投票，鎮長拍板並說明理由。每年秋天改選，有辯論、議會、法庭；長成王都後還有國王、王令、政變與起義。'), [t('提案與投票'), t('選舉與議會'), t('國王與政變')]],
            ['🌾', '#6fcf97', t('各鎮物產與貿易'), t('食物分穀物、魚、肉，產多少看地形，不靠水就捕不了魚。只有靠海的鎮曬得出鹽，木匠把木頭做成紙給報社和研究用。工具好不好影響每個人的效率，翻修房子、城鎮升格都要木材和石材，缺的就得靠商隊。'), [t('地形決定物產'), t('商隊貿易'), t('建材與工具')]],
            ['💰', '#f2c14e', t('錢包、生意與銀行'), t('村民各有自己的銀幣：領工資、繳稅，三餐、衣服、柴火自己買，付不起就挨餓受凍。會借錢欠債、請客接濟、買票，也會創業開店；銀行放貸、遇上擠兌、發債紓困。'), [t('個人錢包'), t('創業開店'), t('擠兌與紓困')]],
            ['⛪', '#c39bd3', t('信仰、報紙與文化'), t('每座鎮有隨機生成的宗教、節日、分裂與異端；立場不同的報社在選舉時表態、揭弊；還有藝術作品、吟遊詩人的歌謠，和越傳越離譜的謠言。'), [t('宗教與節日'), t('報社與輿論'), t('藝術與謠言')]],
            ['🗺️', '#5fc4b8', t('一整個世界'), t('城鎮分村莊、城鎮、城市、王都四級。搭馬車去探索過的城鎮，大雪、坍方、盜匪會封路；外地消息會晚到、會走樣；鎮與鎮之間有外交、聯姻和貿易戰。'), [t('四級城鎮'), t('馬車與路況'), t('外交與聯姻')]],
            ['🔬', '#e5736b', t('科技與觀念'), t('三個時代、28 項研究、33 種建築。新技術在村民之間傳開，分出保守派和革新派，左右選舉；發明家會留下冠名的發明。'), [t('三個時代'), t('保守與革新'), t('冠名發明')]],
            ['🧊', '#9aa7ff', t('3D 小鎮'), t('three.js 低多邊形畫面：日夜、四季、雨雪雷暴、燈籠串燈、螢火蟲；房子從木屋翻修成磚樓。不用安裝，手機也能玩。'), [t('日夜四季'), t('天氣與夜景'), t('手機可玩')]],
        ];
        const gallery = [
            ['paper', t('觀察者日報'), t('每天的八卦與大小事整理成一份報紙，可以翻前幾期。')],
            ['proposals', t('提案與投票'), t('村民自己提案，票數、投票理由和村長裁決都看得到。')],
            ['villager', t('村民資訊卡'), t('點一下就知道他在做什麼、為什麼、心裡在想什麼。')],
            ['economy', t('本鎮物產'), t('這座鎮擅長產什麼、缺什麼、要靠商隊買什麼。')],
        ];
        const tiers = [
            ['🏡', t('村莊'), t('村長＋長老會 3 席'), t('一切的開始：二十幾個人、一間鎮公所。')],
            ['🏘️', t('城鎮'), t('人口 30＋繁榮 50＋第一時代'), t('鎮長與 5 席鎮議會，銀行與報社陸續出現。')],
            ['🏙️', t('城市'), t('人口 60＋繁榮 65＋第二時代'), t('市長與 7 席市議會，石板路、旗幟、更多移民。')],
            ['🏰', t('王都'), t('人口 100＋繁榮 80＋第三時代'), t('國王加冕、王令與政變，9 席王都議會。')],
        ];
        const aiNotes = [
            ['🤖', t('完整智能體模式（預設開啟）'), t('村民要不要提案、怎麼投票、鎮長怎麼裁決，都交給 AI 依各自的記憶、性格和交情推理，並說出理由。')],
            ['🔑', t('內建 AI，不用填金鑰'), t('所有玩家都用小鎮內建的 AI：先用 Claude，Claude 不能用才換 GPT，兩個都不能用才用 Groq 備援。每個帳號每天有使用上限；金鑰只放在伺服器，網頁原始碼和存檔裡都沒有。')],
        ];
        const faq = [
            [t('要下載或安裝嗎？'), t('不用。打開網頁就能玩，電腦、平板、手機都可以。')],
            [t('我可以控制村民嗎？'), t('不行，這是觀察型遊戲。你能做的是打事件卡、託夢、化身旅人聊天，其他全由村民自己決定。')],
            [t('存檔會不會不見？'), t('登入後存檔會自動同步到雲端，換裝置登入就能接著玩；本機也會留一份備份。')],
            [t('為什麼要邀請碼？'), t('小鎮的 AI 由伺服器負擔，目前用邀請制控制人數。')],
            [t('AI 會不會亂講話？'), t('村民只能根據自己的記憶、性格和鎮上真的發生的事說話；伺服器也會擋掉不像村民的回覆。')],
            [t('有英文版嗎？'), t('有。右上角切換中文／English，村民對話、日報、介面都會換。')],
        ];
        const roadmap = [
            [t('已上線'), '#34d399', [t('村民全自主、事件卡、完整智能體模式'), t('四級城鎮、世界地圖與馬車'), t('各鎮物產與貿易（穀物、魚、肉、鹽、紙、工具、建材）'), t('宗教、報社、銀行、國王')]],
            [t('構想'), '#60a5fa', [t('學校與工會'), t('自由輸入一句話當事件'), t('玩家之間互訪城鎮'), t('手機 App 版')]],
        ];
        // 主視覺背景:手繪低多邊形夜景(月亮、星星、山丘、亮著燈的房子)
        const sky = (() => {
            const stars = [[60, 40], [140, 90], [220, 30], [330, 70], [410, 25], [520, 60], [610, 35], [700, 85], [790, 45], [880, 20], [960, 70], [1050, 40], [1130, 95], [1180, 30], [260, 120], [470, 110], [740, 130], [1000, 125]]
                .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2.2}" class="lp-star" style="animation-delay:${(i % 6) * 0.7}s"/>`).join('');
            const houses = [[90, 300, 70, 46], [190, 312, 54, 34], [300, 292, 80, 54], [420, 306, 60, 40], [560, 286, 96, 60], [700, 304, 64, 42], [800, 296, 76, 50], [930, 310, 58, 36], [1040, 298, 72, 48], [1150, 308, 60, 40]];
            const hs = houses.map(([x, y, w, h], i) => {
                const roof = `<polygon points="${x - 6},${y} ${x + w / 2},${y - h * 0.62} ${x + w + 6},${y}" fill="#3a2a3f"/>`;
                const body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a2235"/>`;
                const win = `<rect x="${x + w * 0.2}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}" class="lp-win"/>` + (w > 60 ? `<rect x="${x + w * 0.6}" y="${y + h * 0.28}" width="${w * 0.18}" height="${h * 0.26}" class="lp-win" style="animation-delay:${i * 0.4}s"/>` : '');
                return roof + body + win;
            }).join('');
            const trees = [40, 250, 380, 510, 670, 880, 1000, 1220].map((x, i) => `<polygon points="${x - 16},350 ${x},${300 - (i % 2) * 14} ${x + 16},350" fill="#1f3a34"/>`).join('');
            return `<svg class="lp-sky" viewBox="0 0 1240 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
                <defs><linearGradient id="lpSkyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151230"/><stop offset="0.6" stop-color="#2b2350"/><stop offset="1" stop-color="#3d2f55"/></linearGradient></defs>
                <rect width="1240" height="360" fill="url(#lpSkyG)"/>${stars}
                <circle cx="760" cy="62" r="26" fill="#f6e7c1" opacity="0.92"/><circle cx="771" cy="55" r="23" fill="#1d1838"/>
                <polygon points="0,300 160,230 330,280 520,210 700,270 900,215 1080,265 1240,225 1240,360 0,360" fill="#241f3d"/>
                ${hs}${trees}<rect y="348" width="1240" height="12" fill="#1a1630"/></svg>`;
        })();
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
                <div class="landing-log-head"><span>v${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('');
        const sec = (id, kicker, title, body, extra = '') => `<section class="landing-section lp-sec${extra}" id="${id}"><div class="lp-sec-head"><span class="lp-kicker">${kicker}</span><h2>${title}</h2></div>${body}</section>`;
        el.innerHTML = `<div class="lp">
            <header class="lp-hero">${sky}
                <div class="landing-lang" role="group" aria-label="Language">
                    <button type="button" data-lang="zh" class="${L === 'zh' ? 'active' : ''}">中文</button><button type="button" data-lang="en" class="${L === 'en' ? 'active' : ''}">EN</button>
                </div>
                <div class="lp-hero-grid landing-inner">
                    <div class="lp-hero-copy">
                        <span class="lp-kicker">${t('瀏覽器 3D・AI 小鎮沙盒')}</span>
                        <h1 class="lp-title">${t('邊境鎮')}<span>RimTown</span></h1>
                        <p class="lp-tagline">${t('一座由 AI 村民自己過日子的 3D 小鎮。你在天上看著，偶爾推它一把。')}</p>
                        <p class="lp-lead">${t('每位村民都有個性、記憶、錢包和心事。他們自己工作、戀愛、吵架、提案、投票、選鎮長、做生意、蓋房子；小鎮可能從村莊長成王都，也可能因為一場饑荒散掉。沒有劇本，也沒有結局。')}</p>
                        <div class="landing-cta">${cta}</div>
                        <ul class="lp-badges">${[['🖥️', t('免安裝')], ['📱', t('手機也能玩')], ['☁️', t('雲端存檔')], ['🌐', t('中文／English')]].map(b => `<li><span aria-hidden="true">${b[0]}</span>${b[1]}</li>`).join('')}</ul>
                        <div class="landing-version">v${esc(ver)}${loggedIn ? ` · ${esc(this.auth.username)}` : ''}</div>
                    </div>
                    <figure class="lp-frame lp-hero-shot"><div class="lp-frame-bar" aria-hidden="true"><i></i><i></i><i></i><span>rimtown.cc</span></div><img src="${shot('proposals')}" width="1280" height="760" alt="${t('遊戲畫面：3D 小鎮與村民提案')}" fetchpriority="high"></figure>
                </div>
            </header>
            <div class="landing-inner">
                <ul class="lp-stats" aria-label="${t('遊戲規模')}">${stats.map(s => `<li><b>${s[0]}</b><span>${s[1]}</span></li>`).join('')}</ul>
                ${sec('landing-howto', t('第一步'), t('怎麼玩'), `<ol class="lp-steps landing-steps">${howto.map((s, i) => `<li class="lp-step landing-step"><div class="lp-step-num" aria-hidden="true">${i + 1}</div><div class="lp-step-ic" aria-hidden="true">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p><p class="lp-eg">${s[3]}</p></li>`).join('')}</ol>`)}
                ${sec('landing-day', t('一天的樣子'), t('小鎮的一天'), `<ol class="lp-day">${day.map(d => `<li><time>${d[0]}</time><span class="lp-day-ic" aria-hidden="true">${d[1]}</span><div><h3>${d[2]}</h3><p>${d[3]}</p></div></li>`).join('')}</ol>`)}
                ${sec('landing-features', t('沒有劇本'), t('小鎮裡會自己長出什麼'), `<div class="lp-feats landing-cards">${features.map(f => `<article class="lp-feat landing-card" style="--c:${f[1]}"><div class="lp-feat-ic" aria-hidden="true">${f[0]}</div><h3>${f[2]}</h3><p>${f[3]}</p><ul class="lp-tags">${f[4].map(x => `<li>${x}</li>`).join('')}</ul></article>`).join('')}</div>`)}
                ${sec('landing-gallery', t('實際畫面'), t('畫面一覽'), `<div class="lp-gallery">${gallery.map(g => `<figure class="lp-frame"><img src="${shot(g[0])}" width="1280" height="760" loading="lazy" decoding="async" alt="${esc(g[1])}"><figcaption><b>${g[1]}</b>${g[2]}</figcaption></figure>`).join('')}</div>`)}
                ${sec('landing-tiers', t('成長路線'), t('從村莊到王都'), `<ol class="lp-tiers">${tiers.map((x, i) => `<li><span class="lp-tier-ic" aria-hidden="true">${x[0]}</span><h3>${x[1]}</h3><span class="lp-tier-req">${x[2]}</span><p>${x[3]}</p>${i < tiers.length - 1 ? '<span class="lp-tier-arrow" aria-hidden="true">→</span>' : ''}</li>`).join('')}</ol><p class="lp-note">${t('人口、繁榮或時代掉下來，城鎮也會降級。')}</p>`)}
                ${sec('landing-ai', t('AI 怎麼運作'), t('AI 與金鑰'), `<div class="lp-ai landing-cards landing-ai">${aiNotes.map(f => `<div class="landing-card"><div class="ic" aria-hidden="true">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div><div class="lp-flow" aria-label="${t('AI 備援順序')}"><span class="lp-flow-chip on">Claude</span><span class="lp-flow-arrow" aria-hidden="true">→</span><span class="lp-flow-chip">GPT</span><span class="lp-flow-arrow" aria-hidden="true">→</span><span class="lp-flow-chip">Groq</span><span class="lp-flow-note">${t('前一個不能用才換下一個')}</span></div>`)}
                ${sec('landing-faq', t('常見問題'), t('你可能想問'), `<div class="lp-faq">${faq.map(q => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('')}</div>`)}
                ${this._renderBrainSection()}
                <section class="landing-section lp-sec"><div class="lp-sec-head"><span class="lp-kicker">${t('一直在更新')}</span><h2>${t('更新紀錄')}</h2></div>
                    <div class="landing-log" id="landing-log">${logHtml || `<div class="landing-log-item">${t('尚無紀錄')}</div>`}</div>
                    ${log.length > 5 ? `<button class="landing-more" id="landing-log-more">${t('顯示全部')} (${log.length})</button>` : ''}
                </section>
                <section class="landing-section lp-sec"><div class="lp-sec-head"><span class="lp-kicker">${t('接下來')}</span><h2>${t('即將實現')}</h2></div>
                    <div class="landing-roadmap">${roadmap.map(r => `<div class="landing-roadmap-col"><h3><span class="landing-tag" style="background:${r[1]};color:#111">${r[0]}</span></h3><ul>${r[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
                </section>
                <section class="lp-final"><h2>${t('去看看你的小鎮今天發生了什麼')}</h2><p>${t('註冊需要邀請碼。存檔自動同步雲端，換裝置登入就能接著玩。')}</p><div class="landing-cta">${loggedIn ? `<button class="landing-btn primary" data-lp-go="continue">▶ ${t('繼續遊戲')}</button>` : `<button class="landing-btn primary" data-lp-go="register">✨ ${t('註冊')}</button><button class="landing-btn secondary" data-lp-go="login">🔑 ${t('登入')}</button>`}</div></section>
                <footer class="landing-footer">${t('邊境鎮 RimTown')} · v${esc(ver)}</footer>
            </div>
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
        el.querySelectorAll('[data-lp-go]').forEach(btn => btn.addEventListener('click', () => { const g = btn.dataset.lpGo; if (g === 'continue') this._enterGame(); else this._openAuth(g); })); // v6.79.0 頁尾再放一次按鈕
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
