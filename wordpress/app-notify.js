// RimTown - app-notify.js：從 app.js 拆出的 管理員邀請碼、雲端設定同步、成就、通知卡片（里程碑／週報／名場面／心動／決策／事件／議會）、角落通知（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    async _adminLoadInvites() {
        const box = document.getElementById('admin-invite-list');
        if (box) box.innerHTML = `<span style="color:var(--text-muted)">${t('載入中…')}</span>`;
        try {
            const invites = await this.auth.adminInvites();
            const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
            const rows = invites.map(v => {
                const code = esc(v.code);
                const used = `${v.uses || 0}/${v.maxUses > 0 ? v.maxUses : '∞'}`;
                const exhausted = v.maxUses > 0 && (v.uses || 0) >= v.maxUses;
                const status = v.disabled ? `<span style="color:#fb923c">${t('已停用')}</span>` : exhausted ? `<span style="color:#f87171">${t('已用完')}</span>` : `<span style="color:#34d399">${t('可用')}</span>`;
                const last = (v.usedBy || []).slice(-3).map(u => esc(u.u)).join(', ');
                return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
                    <div style="flex:1;min-width:0"><b style="font-family:monospace;letter-spacing:1px">${code}</b> ${status}
                        <div style="color:var(--text-muted);font-size:0.68rem">${t('已用')} ${used}${v.note ? ' · ' + esc(v.note) : ''}${last ? ' · ' + t('最近：') + last : ''}</div></div>
                    <div style="flex-shrink:0;white-space:nowrap">
                        <button class="trade-btn" data-action="admin-invite-toggle" data-val="${code}" style="padding:3px 8px;font-size:0.7rem">${v.disabled ? t('啟用') : t('停用')}</button>
                        <button class="trade-btn btn-danger" data-action="admin-invite-delete" data-val="${code}" style="padding:3px 8px;font-size:0.7rem">🗑️</button>
                    </div></div>`;
            });
            this._adminInvitesHtml = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
                    <input id="admin-invite-code" placeholder="${t('自訂代碼（留空自動產生）')}" maxlength="24" style="flex:1;min-width:140px;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem;text-transform:uppercase">
                    <input id="admin-invite-max" type="number" min="0" max="9999" value="10" title="${t('可用次數，0＝無上限')}" style="width:70px;padding:6px 8px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;font-size:0.8rem">
                    <button class="trade-btn btn-accent" data-action="admin-invite-create" style="padding:6px 10px">➕ ${t('建立推薦碼')}</button>
                </div>
                <div style="color:var(--text-muted);font-size:0.68rem;margin-bottom:6px">${t('次數欄＝這組代碼可以註冊幾個帳號，0 代表無上限。註冊時必須輸入有效的推薦碼。')}</div>
                ${rows.length ? rows.join('') : `<span style="color:var(--text-muted)">${t('還沒有推薦碼，先建立一組給朋友吧。')}</span>`}`;
            if (box) box.innerHTML = this._adminInvitesHtml;
        } catch (e) {
            if (box) box.innerHTML = `<span style="color:#f87171">${t('載入失敗：')}${this._escapeHtml ? this._escapeHtml(e.message || '') : ''}</span>`;
        }
    },
    async _adminInviteCreate() {
        const code = document.getElementById('admin-invite-code')?.value?.trim() || '';
        const max = parseInt(document.getElementById('admin-invite-max')?.value, 10);
        try {
            const r = await this.auth.adminInvite('invite_create', { code, max_uses: Number.isFinite(max) ? max : 10 });
            this._gameAlert(`${t('推薦碼已建立：')}${r.code}`, '🎟️');
            await this._adminLoadInvites();
        } catch (e) { this._gameAlert(t('建立失敗：') + (e.message || ''), '❌'); }
    },
    async _adminInviteToggle(code) {
        try { await this.auth.adminInvite('invite_toggle', { code }); await this._adminLoadInvites(); }
        catch (e) { this._gameAlert(t('操作失敗：') + (e.message || ''), '❌'); }
    },
    async _adminInviteDelete(code) {
        if (!await this._gameConfirm(`${t('確定刪除推薦碼')} ${code}？`, '🗑️')) return;
        try { await this.auth.adminInvite('invite_delete', { code }); await this._adminLoadInvites(); }
        catch (e) { this._gameAlert(t('操作失敗：') + (e.message || ''), '❌'); }
    },

    // v5.67.4 存檔清理提示(loadSave 清掉 AI 助理漏出的錯誤回覆後,提示一次並存回)
    _notifyScrubbedLeaks() {
        const n = (this.world && this.world._scrubbedLeaks) || 0;
        const c = (this.world && this.world._s2tFixed) || 0;
        if (!n && !c) return;
        if (this.world) { this.world._scrubbedLeaks = 0; this.world._s2tFixed = 0; }
        try {
            if (n) this.world.logMessage('system', `🧹 ${t('已清除')} ${n} ${t('則 AI 服務誤回的英文/自報身分內容，存檔已修正。')}`);
            if (c) this.world.logMessage('system', `🈶 ${t('已把')} ${c} ${t('段簡體字台詞轉成繁體，存檔已修正。')}`);
        } catch (e) {}
        this.saveGame().catch(() => {});
    },

    // v5.66.0 帳號自救流程:伺服器回報帳號紀錄遺失 → 請玩家設新密碼 → 重建
    async _repairAccountFlow() {
        if (this._repairing) return;
        this._repairing = true;
        try {
            const pw = prompt(t('偵測到你的帳號紀錄遺失（雲端儲存空間故障）。請設定一組新密碼（至少 6 字元）重建帳號，存檔與成就不受影響：'));
            if (pw === null) { this._gameAlert(t('帳號尚未重建。在重建前請不要登出，下次開啟遊戲會再提醒。'), '⚠️'); return; }
            if (String(pw).length < 6) { this._gameAlert(t('新密碼至少 6 個字元，請重新開啟遊戲再試。'), '🔑'); return; }
            await this.auth.repairAccount(String(pw));
            this._gameAlert(t('帳號已重建，之後請用新密碼登入。'), '✅');
        } catch (e) {
            this._gameAlert(t('帳號重建失敗：') + (e.message || ''), '❌');
        } finally { this._repairing = false; }
    },

    // v5.33.0 帳號設定同步:雲端有值就套用到本機(換裝置登入免重輸金鑰)
    async _pullCloudSettings() {
        if (!this.auth.loggedIn) return false;
        try {
            const s = await this.auth.getCloudSettings();
            if (!s) return false;
            let changed = false;
            // v5.65.0 AI 全面內建:金鑰/供應商不再隨帳號同步(伺服器端也已不再保存),只同步額度
            // v5.37.0 -1 = 無上限(預設):同步時清掉本機上限
            if (s.npc_llm_budget != null) {
                if (Number(s.npc_llm_budget) < 0) { try { localStorage.removeItem('rimtown_npc_llm_budget'); } catch (e) {} }
                else localStorage.setItem('rimtown_npc_llm_budget', String(s.npc_llm_budget));
            }
            if (s.dialogue_lang === 'auto' || s.dialogue_lang === 'zh' || s.dialogue_lang === 'en') this._setDialogueLang(s.dialogue_lang); // v5.73.0
            if (changed) console.log('[RimTown] AI settings synced from account');
            return changed;
        } catch (e) { console.log('[RimTown] cloud settings pull skipped:', e.message); return false; }
    },

    // 本機設定推上帳號(fire-and-forget;端點不存在或未登入時靜默略過)
    _pushCloudSettings() {
        if (!this.auth.loggedIn) return;
        // v5.65.0 AI 全面內建:只推額度;伺服器收到後會順手清掉帳號裡舊版存的金鑰
        const payload = {};
        const budgetRaw = localStorage.getItem('rimtown_npc_llm_budget');
        const budget = parseInt(budgetRaw, 10);
        // v5.37.0 本機未設上限 → 推 -1(無上限),讓其他裝置也同步成無上限
        payload.npc_llm_budget = (budgetRaw !== null && budgetRaw !== '' && Number.isFinite(budget)) ? budget : -1;
        try { payload.dialogue_lang = localStorage.getItem('rimtown_dialogue_lang') || 'auto'; } catch (e) {} // v5.73.0
        this.auth.saveCloudSettings(payload).catch(e => console.log('[RimTown] cloud settings push skipped:', e.message));
    },

    // 雲端設定套用後重建 LLM client 與對話引擎
    async _applySettingsFromStorage() {
        await this.loadSettings();
        if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
        this._updateLLMStatus?.();
    },

    async _syncFromCloud() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (saves.length === 0) {
                // No cloud data — upload current game state to cloud
                await this._syncToCloud();
                return;
            }
            this._cloudSaves = saves;

            // Find the cloud save matching current town_id, or the most recent one
            let cloudMatch = saves.find(s => s.town_id === this.currentTownId);
            if (!cloudMatch) cloudMatch = saves[0]; // saves are sorted by updated_at DESC

            // Always load from cloud when logged in
            const saveData = await this.auth.cloudLoad(cloudMatch.town_id);
            if (this.world.loadSave(saveData)) {
                if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                this.currentTownId = cloudMatch.town_id;
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                this.render();
                this.world.logMessage('system', `${t('已從雲端同步最新存檔（')}${t(cloudMatch.town_name)}）。`);
            }
        } catch (e) {
            console.error('[RimTown] Cloud load error:', e);
        }
    },

    _getCurrentTownName() {
        // v5.59.5 世界自己的鎮名最權威(隨存檔攜帶):同名鎮的 meta id 分裂時,用 id 查表
        // 會誤報「邊境鎮」——馬車名單因此把回程的鎮踢掉、雲端存檔還會存錯鎮名
        if (this.world?.townName) return this.world.townName;
        if (this.auth.loggedIn && this._cloudSaves) {
            const cloud = this._cloudSaves.find(s => s.town_id === this.currentTownId);
            if (cloud) return cloud.town_name || t('邊境鎮');
        }
        const list = this._getTownList();
        const town = list.find(t => t.id === this.currentTownId);
        return town?.name || t('邊境鎮');
    },

    // =====================================================
    // ACHIEVEMENT SYSTEM
    // =====================================================
    async _loadAchievementsFromCloud() {
        // Load from localStorage first
        try {
            const local = JSON.parse(localStorage.getItem('rimtown_achievements') || '[]');
            local.forEach(k => this._unlockedAchievements.add(k));
        } catch (e) {}

        // Load from cloud if logged in
        if (this.auth.loggedIn) {
            try {
                const cloudAch = await this.auth.getAchievements();
                cloudAch.forEach(a => this._unlockedAchievements.add(a.achievement_key));
            } catch (e) {}
        }
    },

    _unlockAchievement(key) {
        if (this._unlockedAchievements.has(key)) return;
        const def = ACHIEVEMENTS[key];
        if (!def) return;
        this._unlockedAchievements.add(key);

        // Save locally
        localStorage.setItem('rimtown_achievements', JSON.stringify([...this._unlockedAchievements]));

        // Save to cloud
        if (this.auth.loggedIn) {
            this.auth.unlockAchievement(key, this.currentTownId).catch(() => {});
        }

        // v5.34.1 開局第一輪判定的成就靜默入袋(新地圖開場就達標的一批不洗版),之後的才彈通知
        if (this._achFirstCheckDone) this._showAchievementToast(def);
        this.world.logMessage('system', `${t('成就解鎖：')}${def.icon} ${t(def.name)}`);
    },

    _showAchievementToast(def) {
        this.bgm?.sfx?.('coin');
        // v5.33.1 桌面版:成就改右下角非阻擋 toast,不再硬控整個畫面;手機版暫維持中央卡
        if (window.innerWidth > 768) {
            let host = document.getElementById('achv-toast-host');
            if (!host) {
                host = document.createElement('div');
                host.id = 'achv-toast-host';
                host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9500;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none';
                document.body.appendChild(host);
            }
            // v5.34.1 同時最多 3 張,多的擠掉最舊的
            while (host.childElementCount >= 3) host.firstElementChild.remove();
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(22,22,32,0.95);border:1px solid rgba(245,197,66,0.45);border-radius:10px;padding:10px 14px;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transform:translateY(8px);transition:opacity 0.3s,transform 0.3s;pointer-events:auto;cursor:pointer';
            el.innerHTML = `<span style="font-size:1.6rem">${def.icon}</span><span><span style="display:block;color:#f5c542;font-size:0.72rem;font-weight:bold">🏆 ${t('成就解鎖！')}</span><span style="display:block;color:#fff;font-size:0.85rem;font-weight:bold">${t(def.name)}</span><span style="display:block;color:rgba(255,255,255,0.65);font-size:0.68rem">${def.desc}</span></span>`;
            host.appendChild(el);
            requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
            const remove = () => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 350); };
            el.addEventListener('click', remove);
            setTimeout(remove, 6000);
            return;
        }
        this._showCenterNotification({
            icon: def.icon,
            title: t('成就解鎖！'),
            name: def.name,
            desc: def.desc,
            autoDismiss: 6000
        });
    },

    // v5.12.0 全域彈窗關閉:點 modal 半透明背景即關;npc 快速卡點外面即關(避免面板關不掉)
    _setupGlobalDismiss() {
        if (this._globalDismissReady) return;
        this._globalDismissReady = true;
        document.addEventListener('pointerdown', (e) => {
            // 1) modal(送禮/爆料/排行榜等):點到背景(不是 modal-content)就關;auth-modal 除外
            const modal = e.target.classList?.contains('modal') ? e.target : null;
            if (modal && modal.id !== 'auth-modal' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                this.bgm?.sfx?.('close');
                return;
            }
            // 3) NPC 快速卡:點卡片以外任何地方就關(點到別的 NPC 會由地圖流程重開)
            const nqc = document.getElementById('npc-quick-card');
            if (nqc && !nqc.classList.contains('hidden') && !nqc.contains(e.target)) {
                nqc.classList.add('hidden');
            }
        }, true);
    },

    _startAchievementChecker() {
        this._setupGlobalDismiss();
        // Check achievements every 5 seconds
        setInterval(() => this._checkAchievements(), 5000);
        // Check story events every 3 seconds
        setInterval(() => this._checkStoryEventDisplay(), 3000);
        // Check newspaper every 10 seconds
        setInterval(() => this._checkNewspaperNotification(), 10000);
        // v4.0: Check interactive notifications every 4 seconds
        setInterval(() => this._checkV4Notifications(), 4000);
        // v5.48.0 追蹤的村民有大事 → 角落通知
        setInterval(() => { try { this._checkFollowedNpcs(); } catch (e) {} try { this._visitorMailboxTick(); } catch (e) {} }, 5000);
    },

    // v4.0: Check for pending decisions, event choices, and NPC help requests
    _checkV4Notifications() {
        if (!this.world) return;
        // Don't show interactive cards before login or guest mode
        if (!this.auth?.loggedIn && !this.guestMode) return;

        // Daily decision
        const dd = this.world.dailyDecision;
        if (dd?.pendingDecision && !this._shownDecisionId) {
            this._shownDecisionId = dd.pendingDecision.dayKey;
            this._showDecisionCard(dd.pendingDecision);
        } else if (!dd?.pendingDecision) {
            this._shownDecisionId = null;
        }

        // Event choice
        const ec = this.world.eventChoice;
        if (ec?.pendingEvent && !this._shownEventChoiceId) {
            this._shownEventChoiceId = ec.pendingEvent.timestamp;
            this._showEventChoiceCard(ec.pendingEvent);
        } else if (!ec?.pendingEvent) {
            this._shownEventChoiceId = null;
        }

        // NPC help
        const nh = this.world.npcHelp;
        if (nh?.pendingRequest && !this._shownHelpId) {
            this._shownHelpId = nh.pendingRequest.timestamp;
            this._showNPCHelpCard(nh.pendingRequest);
        } else if (!nh?.pendingRequest) {
            this._shownHelpId = null;
        }

        // Council proposal
        const cc = this.world.council;
        if (cc?.pendingProposal && !cc.pendingProposal.playerVoted && !this._shownCouncilId) {
            this._shownCouncilId = cc.pendingProposal.id + '_' + cc._daysSinceProposal;
            this._showCouncilCard(cc.pendingProposal);
        } else if (!cc?.pendingProposal || cc.pendingProposal.playerVoted) {
            this._shownCouncilId = null;
        }

        // Weather disaster warning notification
        const ww = this.world.weather;
        if (ww?.activeDisaster && !this._shownDisasterId) {
            this._shownDisasterId = ww.activeDisaster.type;
            this._showInteractiveNotification({
                icon: '🚨',
                title: ww.activeDisaster.name,
                desc: ww.activeDisaster.desc,
                buttons: [{ label: t('了解'), action: () => { this.activeTab = 'events'; this.state = this.world.getState(); this.renderSidebar(); } }],
            });
        } else if (!ww?.activeDisaster) {
            this._shownDisasterId = null;
        }
    },

    // v5.4.0 夢想達成慶祝
    _showMilestoneCard(ms) {
        this.bgm?.sfx?.('coin');
        this.tileMap?.spawnFxOnAgent?.(ms.npcId, '🏆', { color: '#ffd166', burst: '⭐', burstCount: 10, size: 14 });
        this._showCenterNotification({
            icon: ms.icon,
            title: `🏆 ${t('夢想成真')}`,
            name: `${ms.npcName} — ${ms.goalName}`,
            desc: `${ms.npcName}${t('：「')}${ms.text}${t('」')}`,
            autoDismiss: 0,
        });
    },

    // v5.3.0 本週小鎮頭條:浮現的愛恨糾葛摘要
    _showWeeklyDigest(dg) {
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const section = (title, arr, color) => arr && arr.length
            ? `<div style="margin:8px 0"><div style="font-size:0.72rem;color:${color};font-weight:bold;margin-bottom:3px">${title}</div>${arr.map(l => `<div style="font-size:0.82rem;line-height:1.5">${esc(l)}</div>`).join('')}</div>`
            : '';
        let body = '';
        body += section(`🎉 ${t('本週新戀情')}`, dg.newCouples, '#ff6b9d');
        body += section(`🔺 ${t('三角關係')}`, dg.triangles, '#ffb84d');
        body += section(`💘 ${t('暗戀進行中')}`, dg.crushes, '#ff8fb3');
        body += section(`⚔️ ${t('水火不容')}`, dg.rivals, '#ff6b6b');
        body += section(`❤️ ${t('穩定放閃')}`, dg.couples, '#c86bff');
        body += section(`🌟 ${t('夢想進行中')}`, dg.dreams, '#6bd5a0');
        if (!body) return;
        this._showCenterNotification({
            icon: '📰',
            title: `📰 ${t('本週小鎮頭條')}`,
            content: `<div style="text-align:left;max-height:46vh;overflow-y:auto;padding:2px 4px">${body}<div style="font-size:0.68rem;color:var(--text-secondary);margin-top:8px;text-align:center">${t('去「關係」頁看完整愛恨網路,或找當事人聊聊八卦!')}</div></div>`,
            autoDismiss: 0,
        });
    },

    // v5.1.0 名場面直播:NPC 感情大事件的 AI 對話劇
    _showDramaScene(s) {
        this.bgm?.sfx?.('open');
        const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const palette = ['#ff6b9d', '#6bc5ff', '#ffd166', '#95e06c'];
        const colors = {};
        let ci = 0;
        const linesHtml = s.lines.map(l => {
            if (!colors[l.speaker]) colors[l.speaker] = palette[ci++ % palette.length];
            return `<div style="margin:7px 0;text-align:left;line-height:1.5"><span style="color:${colors[l.speaker]};font-weight:bold">${esc(l.speaker)}</span><span style="opacity:0.6">：</span>${esc(l.text)}</div>`;
        }).join('');
        this._showCenterNotification({
            icon: s.icon,
            title: `📺 ${t('名場面直播')} — ${s.title}`,
            name: `${s.aName} × ${s.bName}`,
            content: `<div style="font-size:0.82rem;max-height:42vh;overflow-y:auto;padding:4px 2px">${linesHtml}</div>`,
            autoDismiss: 0,
        });
    },

    // =====================================================
    // v5.46.0 祭典攤位小遊戲已移除:與「觀察居民愛恨糾葛」的主軸脫節(祭典本身保留:村民行程/對話/氣氛)

    // v5.0.0 心動事件卡:NPC 的真心話 + 玩家二選一回應(影響好感/心動)
    _showHeartEventCard(h) {
        this.bgm?.sfx?.('open');
        const respond = (reply, aff, rom) => {
            const world = this.world;
            const npc = world?.agents?.[h.npcId];
            const player = Object.values(world?.agents || {}).find(a => a.isPlayer);
            if (!npc || !player) return;
            const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
            relNpc.modifyAffinity(aff);
            if (rom) relNpc.modifyRomantic(rom);
            relNpc.addSharedMemory(`${h.evName}${t('：')}${reply}`);
            player.chatHistory.push({ speaker: player.name, target: npc.name, text: reply, time: world.clock.timeStr });
            npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t(player.name)}${t('回應了我的真心話：')}${reply}`, 8, [player.name]);
            world.logMessage('player_chat', `${t(player.name)} → ${t(npc.name)}: ${reply}`, player.name, npc.name);
            this.bgm?.sfx?.('send');
            this.state = world.getState();
            this.renderSidebar();
        };
        const optA = h.romance ? t('我也是。其實我早就想告訴你了') : t('能認識你真的很好,這是我的真心話');
        const optB = h.romance ? t('謝謝你...可以讓我想一想嗎?') : t('哈哈,突然這麼肉麻我會不好意思啦!');
        this._showInteractiveNotification({
            icon: h.icon,
            title: `${h.icon} ${t('心動事件')}——${h.evName}`,
            desc: `${h.npcName}${t('：「')}${h.text}${t('」')}`,
            buttons: [
                { label: `💬 ${optA}`, action: () => respond(optA, 6, h.romance ? 8 : 0) },
                { label: `😅 ${optB}`, action: () => respond(optB, 2, 0) },
            ],
        });
    },

    _showDecisionCard(decision) {
        this._showInteractiveNotification({
            icon: '🏛️',
            title: decision.title,
            desc: decision.desc,
            buttons: [
                { label: `A. ${decision.optionA.label}`, desc: decision.optionA.desc, action: () => {
                    this.world.dailyDecision.resolveDecision('A', this.world);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
                { label: `B. ${decision.optionB.label}`, desc: decision.optionB.desc, action: () => {
                    this.world.dailyDecision.resolveDecision('B', this.world);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
            ],
            stillValid: () => this.world.dailyDecision?.pendingDecision === decision, // v5.42.1 逾時代選後丟棄
        });
    },

    _showEventChoiceCard(event) {
        const buttons = event.choices.map((choice, i) => ({
            label: `${choice.icon} ${choice.label}`,
            desc: choice.desc,
            action: () => {
                this.world.eventChoice.resolveChoice(i, this.world);
                this.state = this.world.getState(); this.renderSidebar();
            }
        }));
        this._showInteractiveNotification({
            icon: '⚡',
            title: event.eventName,
            desc: event.description,
            buttons: buttons,
            stillValid: () => this.world.eventChoice?.pendingEvent?.timestamp === event.timestamp, // v5.42.1
        });
    },

    _showNPCHelpCard(request) {
        this._showInteractiveNotification({
            icon: '💬',
            title: request.title,
            desc: request.desc,
            buttons: [
                { label: request.optionA.label, action: () => {
                    this.world.npcHelp.resolveRequest('A', this.world);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
                { label: request.optionB.label, action: () => {
                    this.world.npcHelp.resolveRequest('B', this.world);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
            ],
            stillValid: () => this.world.npcHelp?.pendingRequest?.timestamp === request.timestamp, // v5.42.1
        });
    },

    _showCouncilCard(proposal) {
        this._showInteractiveNotification({
            icon: '🏛️',
            title: `${t('議會提案')}：${proposal.title}`,
            desc: proposal.desc,
            buttons: [
                { label: `👍 ${t('贊成')}`, action: () => {
                    this.world.council.playerVote('for');
                    this.world.logMessage('council', `🏛️ ${t('你對議會提案投了贊成票。')}`);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
                { label: `👎 ${t('反對')}`, action: () => {
                    this.world.council.playerVote('against');
                    this.world.logMessage('council', `🏛️ ${t('你對議會提案投了反對票。')}`);
                    this.state = this.world.getState(); this.renderSidebar();
                }},
            ],
            stillValid: () => { const p = this.world.council?.pendingProposal; return !!p && p.id === proposal.id && !p.playerVoted; }, // v5.42.1
        });
    },

    // v5.29.2 玩家忙碌判定:正在跟村民聊天、或正在任何輸入框打字時,事件卡先排隊不打斷
    _isPlayerBusy() {
        if (this.activeTab === 'chat' && this.chatTarget) return true;
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return true;
        return false;
    },

    // 忙碌時把通知排進佇列 + 角落小提示(不擋操作),空閒時由 flusher 補播
    _queueNotifDeferred(notif) {
        if (!this._centerNotifQueue) this._centerNotifQueue = [];
        // v5.42.1 去重:同標題的互動卡不重複排隊 / v5.44.0 內容卡也去重
        if (notif._interactive && this._centerNotifQueue.some(q => q._interactive && q.title === notif.title)) return;
        if (!notif._interactive && notif.content && this._centerNotifQueue.some(q => !q._interactive && q.title === notif.title && q.name === notif.name)) return;
        this._centerNotifQueue.push(notif);
        // v5.42.1 佇列上限:互動卡最多留 3 張——被擠掉的世界狀態會由「逾時代選」自行結算,不會卡住事件線
        const inter = this._centerNotifQueue.filter(q => q._interactive);
        if (inter.length > 3) {
            const drop = inter[0];
            this._centerNotifQueue = this._centerNotifQueue.filter(q => q !== drop);
        }
        // v5.44.0 內容卡(名場面/週報)最多留 4 張——名場面隨時能在「小鎮劇場」回看,擠掉不心疼
        const contentQ = this._centerNotifQueue.filter(q => !q._interactive && q.content);
        if (contentQ.length > 4) {
            const drop2 = contentQ[0];
            this._centerNotifQueue = this._centerNotifQueue.filter(q => q !== drop2);
        }
        this._showNotifBadgeToast();
        this._startNotifFlusher();
    },

    // v5.42.1 取下一則「還有效」的通知;互動卡受 90 秒真實時間冷卻保護,冷卻中先留在佇列
    _dequeueNotif() {
        // v5.47.0 BUG-05:玩家按了暫停就不出任何全螢幕卡,恢復播放後 flusher 再補播
        if (this.world?.paused) return null;
        const q = this._centerNotifQueue || [];
        const INTERACTIVE_GAP = 90000;
        for (let i = 0; i < q.length; i++) {
            const n = q[i];
            if (n._interactive && typeof n.stillValid === 'function' && !n.stillValid()) { q.splice(i, 1); i--; continue; } // 世界裡已被結算 → 直接丟棄
            if (n._interactive && Date.now() - (this._lastInteractiveShownAt || 0) < INTERACTIVE_GAP) continue; // 冷卻中,跳過互動卡找後面的一般通知
            if (!n._interactive && n.content && Date.now() - (this._lastCenterShownAt || 0) < 45000) continue; // v5.44.0 內容卡也有 45 秒冷卻
            q.splice(i, 1);
            return n;
        }
        return null;
    },

    _showNotifBadgeToast() {
        const now = Date.now();
        if (this._lastNotifToastAt && now - this._lastNotifToastAt < 10000) return; // 10 秒內不重複提示
        this._lastNotifToastAt = now;
        let toast = document.getElementById('notif-defer-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'notif-defer-toast';
            toast.style.cssText = 'position:fixed;right:12px;bottom:64px;z-index:9000;background:rgba(20,20,28,0.92);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 12px;font-size:0.78rem;pointer-events:none;opacity:0;transition:opacity 0.3s';
            document.body.appendChild(toast);
        }
        const n = this._centerNotifQueue?.length || 1;
        toast.textContent = `📬 ${n} ${t('件小鎮動態,等你忙完再看')}`;
        toast.style.opacity = '1';
        clearTimeout(this._notifToastTimer);
        this._notifToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    },

    // 關掉一張卡後補播下一張;玩家又在忙就交給 flusher 等空閒再播
    // v5.42.1 走 _dequeueNotif:互動卡受 90 秒冷卻,答完一張不會立刻又彈下一張(改由 flusher 之後補播)
    _showNextQueuedNotif() {
        if (!this._centerNotifQueue?.length) return;
        this._startNotifFlusher();
        if (this._isPlayerBusy()) return;
        const next = this._dequeueNotif();
        if (!next) return;
        setTimeout(() => {
            if (next._interactive) this._showInteractiveNotification(next);
            else this._showCenterNotification(next);
        }, 300);
    },

    _startNotifFlusher() {
        if (this._notifFlusher) return;
        this._notifFlusher = setInterval(() => {
            if (!this._centerNotifQueue?.length) return;
            const overlay = document.getElementById('center-notification-overlay');
            if (!overlay || !overlay.classList.contains('hidden')) return;
            if (this._isPlayerBusy()) return;
            const next = this._dequeueNotif();
            if (!next) return;
            if (next._interactive) this._showInteractiveNotification(next);
            else this._showCenterNotification(next);
        }, 3000);
    },

    _showInteractiveNotification({ icon, title, desc, buttons, stillValid }) {
        const overlay = document.getElementById('center-notification-overlay');
        if (!overlay) return;
        if (typeof stillValid === 'function' && !stillValid()) return; // v5.42.1 已被世界結算的卡不再顯示
        // Queue if already showing, busy, or an interactive card was shown within the last 90s (v5.42.1 防轟炸)
        if (!this._centerNotifQueue) this._centerNotifQueue = [];
        if (!overlay.classList.contains('hidden') || this._isPlayerBusy()
            || (this.world?.paused) // v5.47.0 BUG-05:暫停中不彈,排隊等恢復
            || Date.now() - (this._lastInteractiveShownAt || 0) < 90000) {
            this._queueNotifDeferred({ _interactive: true, icon, title, desc, buttons, stillValid });
            return;
        }
        this._lastInteractiveShownAt = Date.now();
        // v5.44.0 互動卡顯示期間暫停世界,關閉後還原原本的暫停狀態
        this._pausedBeforeNotif = !!this.world?.paused;
        this._notifCardOpen = true; // v5.54.0 卡片開著時手動按暫停/播放會改寫 _pausedBeforeNotif
        if (this.world) this.world.paused = true;
        const card = document.getElementById('center-notification-card');
        if (!card) return;
        let html = '';
        if (icon) html += `<div class="center-notif-icon">${icon}</div>`;
        if (title) html += `<div class="center-notif-title">${title}</div>`;
        if (desc) html += `<div class="center-notif-desc" style="margin:8px 0;font-size:0.85rem;line-height:1.5">${desc}</div>`;
        html += '<div class="decision-buttons" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">';
        buttons.forEach((btn, i) => {
            html += `<button class="decision-btn" data-choice="${i}" style="padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text-primary);cursor:pointer;text-align:left;transition:all 0.2s">`;
            html += `<div style="font-weight:bold;font-size:0.85rem">${btn.label}</div>`;
            if (btn.desc) html += `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px">${btn.desc}</div>`;
            html += `</button>`;
        });
        html += '</div>';
        // v5.34.0 60 秒沒選就由小鎮代選(隨機),事件線不再卡在等玩家
        html += `<div id="interactive-cd" style="margin-top:8px;font-size:0.68rem;color:var(--text-muted);text-align:center"></div>`;
        card.innerHTML = html;
        overlay.classList.remove('hidden');

        clearInterval(this._interactiveCdTimer);
        let cdRemain = 60;
        const cdEl = card.querySelector('#interactive-cd');
        const cdShow = () => { if (cdEl) cdEl.textContent = `⏳ ${cdRemain} ${t('秒後由小鎮自行決定')}`; };
        cdShow();
        this._interactiveCdTimer = setInterval(() => {
            cdRemain--;
            if (cdRemain <= 0) {
                clearInterval(this._interactiveCdTimer);
                const btns = card.querySelectorAll('.decision-btn');
                if (btns.length && !overlay.classList.contains('hidden')) btns[Math.floor(Math.random() * btns.length)].click();
                return;
            }
            cdShow();
        }, 1000);

        // Attach button handlers
        card.querySelectorAll('.decision-btn').forEach((el, i) => {
            el.addEventListener('click', () => {
                clearInterval(this._interactiveCdTimer);
                overlay.classList.add('hidden');
                this._notifCardOpen = false;
                if (this.world) this.world.paused = this._pausedBeforeNotif; // v5.44.0 還原暫停狀態
                if (buttons[i]?.action) buttons[i].action();
                this._showNextQueuedNotif();
            });
            // Hover effect
            el.addEventListener('mouseenter', () => { el.style.background = 'rgba(255,255,255,0.12)'; });
            el.addEventListener('mouseleave', () => { el.style.background = 'rgba(255,255,255,0.06)'; });
        });
    },

    _checkStoryEventDisplay() {
        if (!this.world?.questSystem) return;
        const event = this.world.questSystem.getPendingStoryEvent();
        if (!event) return;
        this._showStoryEventToast(event);
    },

    _showStoryEventToast(event) {
        this._showCenterNotification({
            icon: event.icon,
            title: event.title,
            desc: event.text,
            autoDismiss: 0 // manual dismiss for story events
        });
    },

    // v5.34.0 角落通知:純資訊(無長內容)不再佔用整個版面,改右下角小卡堆疊
    _showCornerNotice({ icon, title, name, desc }) {
        let host = document.getElementById('achv-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'achv-toast-host';
            host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9500;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none';
            document.body.appendChild(host);
        }
        // 手機版避開底部 tab bar
        const fd = document.getElementById('firstday-guide'); const fdH = (fd && fd.offsetParent !== null) ? fd.getBoundingClientRect().height : 0; // v5.99.0 避開第一天引導卡
        host.style.bottom = window.innerWidth <= 768 ? `${64 + (fdH ? fdH + 18 : 0)}px` : `${14 + (fdH ? fdH + 14 : 0)}px`;
        // v5.34.1 同時最多 3 張,多的擠掉最舊的,避免洗版
        while (host.childElementCount >= 3) host.firstElementChild.remove();
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(22,22,32,0.95);border:1px solid rgba(255,255,255,0.22);border-radius:10px;padding:10px 14px;max-width:min(320px,calc(100vw - 28px));box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transform:translateY(8px);transition:opacity 0.3s,transform 0.3s;pointer-events:auto;cursor:pointer';
        el.innerHTML = `<span style="font-size:1.5rem">${icon || '🔔'}</span><span><span style="display:block;color:var(--accent,#e94560);font-size:0.72rem;font-weight:bold">${title || ''}</span>${name ? `<span style="display:block;color:#fff;font-size:0.85rem;font-weight:bold">${name}</span>` : ''}${desc ? `<span style="display:block;color:rgba(255,255,255,0.65);font-size:0.68rem">${desc}</span>` : ''}</span>`;
        host.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        const remove = () => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 350); };
        el.addEventListener('click', remove);
        setTimeout(remove, 8000);
    },

    // Center-screen notification card (like tutorial cards)
    _showCenterNotification({ icon, title, name, desc, content, autoDismiss }) {
        // v5.34.0 純資訊卡(無完整內容)改角落通知;名場面/日報等長內容維持中央卡
        if (!content) { this._showCornerNotice({ icon, title, name, desc }); return; }
        // Queue notifications if one is already showing, or if the player is busy (chatting / typing)
        // v5.44.0 全螢幕內容卡(名場面/週報等)之間至少間隔 45 秒,不再連環轟炸
        if (!this._centerNotifQueue) this._centerNotifQueue = [];
        const notif = { icon, title, name, desc, content, autoDismiss };
        const overlay = document.getElementById('center-notification-overlay');
        if (!overlay) return;
        if (!overlay.classList.contains('hidden') || this._isPlayerBusy()
            || (this.world?.paused) // v5.47.0 BUG-05:暫停中不彈,排隊等恢復
            || Date.now() - (this._lastCenterShownAt || 0) < 45000) {
            this._queueNotifDeferred(notif);
            return;
        }
        this._lastCenterShownAt = Date.now();
        // v5.44.0 全螢幕卡顯示期間暫停世界,關閉後還原你原本的暫停狀態——看戲時時間不會偷跑,你按的暫停也不會被彈窗洗掉
        this._pausedBeforeNotif = !!this.world?.paused;
        this._notifCardOpen = true; // v5.54.0
        if (this.world) this.world.paused = true;
        const card = document.getElementById('center-notification-card');
        if (!card) return;
        let html = '';
        if (icon) html += `<div class="center-notif-icon">${icon}</div>`;
        if (title) html += `<div class="center-notif-title">${title}</div>`;
        if (name) html += `<div class="center-notif-name">${name}</div>`;
        if (desc) html += `<div class="center-notif-desc">${desc}</div>`;
        if (content) html += `<div class="center-notif-content">${content}</div>`;
        html += `<button class="center-notif-dismiss">${t('確認')}</button>`;
        card.innerHTML = html;
        overlay.classList.remove('hidden');
        const dismissBtn = card.querySelector('.center-notif-dismiss');
        const dismiss = () => {
            overlay.classList.add('hidden');
            this._notifCardOpen = false;
            if (this.world) this.world.paused = this._pausedBeforeNotif; // 還原暫停狀態
            this._showNextQueuedNotif();
        };
        dismissBtn.addEventListener('click', dismiss);
        overlay.querySelector('.center-notification-backdrop').addEventListener('click', dismiss);
        if (autoDismiss > 0) {
            setTimeout(dismiss, autoDismiss);
        }
    },

    // Check and show daily newspaper as center notification
    _checkNewspaperNotification() {
        if (!this.world?.dailyNews?.newspapers?.length) return;
        const papers = this.world.dailyNews.newspapers;
        const latest = papers[papers.length - 1];
        if (this._lastShownNewspaperId === latest.id) return;
        this._lastShownNewspaperId = latest.id;
        this._newsReacted = false; // Reset reaction for new newspaper
        // v5.44.0 日報出刊改角落通知,不再全螢幕打斷;全文在「日報」分頁隨時可讀
        this._showCornerNotice({
            icon: '📰',
            title: t('AI 日報出刊'),
            name: `${t('第')}${latest.id}${t('期')} — ${t('記者')}：${latest.reporter}`,
            desc: t('到「日報」分頁閱讀全文'),
        });
    },

    _checkAchievements() {
        if (!this.state) return;
        const agents = this.state.agents || {};
        const player = agents['player'];
        if (!player) return;
        const clock = this.state.clock || {};
        const chatHistory = player.chat_history || [];
        const totalDays = ((clock.year || 1) - 1) * 60 + (clock.day || 1);

        // Chat achievements
        if (chatHistory.length >= 2) this._unlockAchievement('first_chat');
        if (chatHistory.length >= 20) this._unlockAchievement('chat_10');
        if (chatHistory.length >= 100) this._unlockAchievement('chat_50');
        if (chatHistory.length >= 200) this._unlockAchievement('chat_100');

        // Track chatted NPCs
        const chattedNpcs = new Set();
        chatHistory.forEach(m => {
            if (m.speaker !== player.name) chattedNpcs.add(m.speaker);
            if (m.target !== player.name) chattedNpcs.add(m.target);
        });
        const totalNpcs = Object.keys(agents).filter(id => id !== 'player').length;
        if (chattedNpcs.size >= totalNpcs && totalNpcs >= 5) this._unlockAchievement('chat_all_npcs');

        // Survival
        if (totalDays >= 7) this._unlockAchievement('survive_7');
        if (totalDays >= 30) this._unlockAchievement('survive_30');
        if (totalDays >= 100) this._unlockAchievement('survive_100');
        if ((clock.year || 1) >= 2) this._unlockAchievement('survive_year');
        if ((clock.year || 1) >= 4) this._unlockAchievement('survive_3years');

        // Population
        const pop = Object.keys(agents).length;
        if (pop >= 15) this._unlockAchievement('pop_15');
        if (pop >= 20) this._unlockAchievement('pop_20');
        if (pop >= 25) this._unlockAchievement('pop_25');
        if (pop >= 30) this._unlockAchievement('pop_30');
        if (pop >= 40) this._unlockAchievement('pop_40');

        // Economy
        const res = this.state.stockpile?.resources || {};
        if ((res.silver || 0) >= 500) this._unlockAchievement('rich');
        const completedBuildings = this.state.buildings?.completed || [];
        if (completedBuildings.length >= 1) this._unlockAchievement('builder');
        if (completedBuildings.length >= 5) this._unlockAchievement('master_builder');
        const availBuildings = this.world.buildings?.getAvailable?.(this.world) || [];
        if (completedBuildings.length > 0 && availBuildings.length === 0) this._unlockAchievement('all_buildings');
        if (completedBuildings.some(b => (b.level || 1) >= 2)) this._unlockAchievement('first_upgrade');
        if (completedBuildings.some(b => (b.level || 1) >= 3)) this._unlockAchievement('max_upgrade');
        const researchProjects = this.state.research?.projects || {};
        const completedResearch = Object.values(researchProjects).filter(p => p.status === 'complete');
        if (completedResearch.length >= 1) this._unlockAchievement('first_research');
        if (completedResearch.length >= 5) this._unlockAchievement('research_5');
        const allResearch = Object.values(researchProjects);
        if (allResearch.length > 0 && completedResearch.length === allResearch.length) this._unlockAchievement('all_research');
        if ((res.silver || 0) >= 2000) this._unlockAchievement('ultra_rich');
        // Resource hoarder
        for (const amt of Object.values(res)) { if (amt >= 200) { this._unlockAchievement('resource_hoarder'); break; } }

        // Seasons
        if (clock.season) this._seasonsVisited.add(clock.season);
        if (this._seasonsVisited.size >= 4) this._unlockAchievement('all_seasons');

        // Night owl / Early bird
        if (clock.hour !== undefined && clock.hour >= 0 && clock.hour < 4 && this.world?.tickCount > 0) this._unlockAchievement('night_owl');
        if (clock.hour !== undefined && clock.hour >= 5 && clock.hour <= 6 && this.world?.tickCount > 0) this._unlockAchievement('early_bird');

        // Election
        const election = this.state.election;
        if (election?.electionHistory?.length >= 1) this._unlockAchievement('first_election');
        if (election?.electionHistory?.length >= 3) this._unlockAchievement('election_3');
        // v5.38.0 旅人參選/當選
        if (election?.candidates?.some(c => c.agentId === 'player') || election?.electionHistory?.some(h => h.candidates?.some(c => c.agentId === 'player'))) this._unlockAchievement('ran_for_mayor');
        if (election?.electionHistory?.some(h => h.winner?.agentId === 'player')) this._unlockAchievement('elected_mayor');
        // v5.38.0 競選開跑提醒(角落通知,一屆一次;符合資格才提)
        const elx = this.world?.election;
        if (elx?.phase === 'campaign' && !elx.candidates?.some(c => c.agentId === 'player')) {
            const yearKey = `run-${this.world.clock.year}`;
            if (this._electionNoticeKey !== yearKey && elx.playerEligibility?.(this.world)?.ok) {
                this._electionNoticeKey = yearKey;
                this._showCornerNotice({ icon: '🗳️', title: t('秋季選舉開跑'), name: '', desc: t('你已符合參選資格!到「事件」分頁登記參選,登記期只有 3 天') });
            }
        }

        // v5.55.0 海風鎮劇情解鎖,v5.58.0 改為「道路重通」:海風鎮本來就存在,
        // 只是沿海道路一直封著;小鎮發展起來(繁榮 20)後修路隊打通道路,馬車通車
        // v5.76.0 鄰鎮解鎖改成表驅動:海風鎮(繁榮 20)、礦山鎮(繁榮 40),之後的林間村/市集城照表加
        const prosNow = this.state?.prosperity?.prosperity || 0;
        for (const def of NEIGHBOR_TOWNS) {
            if (prosNow < def.prosperity || localStorage.getItem(def.key) === '1') continue;
            localStorage.setItem(def.key, '1');
            this._ensureNeighborTown(def.theme);
            this.world?.logMessage?.('system', def.log());
            this._showCornerNotice({ icon: def.icon, title: def.title(), name: '', desc: def.desc() });
        }

        // Multi-town
        if (this._getTownList().length >= 3) this._unlockAchievement('multi_town');

        // NPC conversations seen (from log)
        const npcConvos = this.state.npc_conversations || [];
        this._npcConvosSeen = Math.max(this._npcConvosSeen, npcConvos.length);
        if (this._npcConvosSeen >= 10) this._unlockAchievement('gossip_heard');
        if (this._npcConvosSeen >= 50) this._unlockAchievement('gossip_50');
        if (this._npcConvosSeen >= 200) this._unlockAchievement('gossip_200');

        // Player relationships
        const playerRels = player.relationships || [];
        playerRels.forEach(r => {
            if (r.romantic_interest > 30) this._unlockAchievement('first_crush');
            if (r.status === 'dating') { this._unlockAchievement('first_dating'); this._datingHistory.add(r.target_name); }
            if (r.status === 'married') this._unlockAchievement('first_marriage');
            if (r.affinity >= 80) this._unlockAchievement('high_affinity');
            if (r.affinity <= -50) this._unlockAchievement('enemy_made');
            if (r.status === 'married' && r.affinity >= 90) this._unlockAchievement('golden_couple');
        });
        if (this._datingHistory.size >= 3) this._unlockAchievement('heartbreaker');
        // NPC romance tracking
        const allNpcs = Object.values(agents).filter(a => !a.is_player);
        let npcCouples = 0;
        let hasNpcWedding = false;
        let hasNpcBreakup = false;
        allNpcs.forEach(npc => {
            (npc.relationships || []).forEach(r => {
                if (r.status === 'dating' || r.status === 'married') npcCouples++;
                if (r.status === 'married') hasNpcWedding = true;
                if (r.status === 'ex') hasNpcBreakup = true;
            });
        });
        if (hasNpcWedding) this._unlockAchievement('npc_wedding');
        if (hasNpcBreakup) this._unlockAchievement('npc_breakup');
        if (npcCouples / 2 >= 5) this._unlockAchievement('npc_couple_5');

        // Raid repel
        const raidEvents = (this.state.recent_events || []).filter(e => e.event_type === 'raid');
        if (raidEvents.length >= 1) this._unlockAchievement('repel_raid');
        // Track cumulative raids across sessions
        const raidCount = parseInt(localStorage.getItem('rimtown_raid_count') || '0');
        const currentRaids = raidEvents.length;
        if (currentRaids > this._raidCount) {
            const newRaids = currentRaids - this._raidCount;
            const totalRaids = raidCount + newRaids;
            localStorage.setItem('rimtown_raid_count', totalRaids.toString());
            if (totalRaids >= 5) this._unlockAchievement('repel_5');
            if (totalRaids >= 10) this._unlockAchievement('repel_10');
            this._raidCount = currentRaids;
        }

        // New system achievements
        const factionList = Object.values(this.state.factions?.factions || {});
        if (factionList.length >= 1) this._unlockAchievement('first_faction');
        if (factionList.length >= 3) this._unlockAchievement('faction_3');
        // Check for faction drama (rivalry or internal conflict events)
        const hasDrama = factionList.some(f => f.rivalFactionId || f.cohesion < 30);
        if (hasDrama) this._unlockAchievement('faction_drama');
        if ((this.state.lifecycle?.graveyard || []).length >= 1) this._unlockAchievement('first_death');
        if ((this.state.lifecycle?.births || []).length >= 1) this._unlockAchievement('first_birth');
        if ((this.state.lifecycle?.births || []).length >= 5) this._unlockAchievement('births_5');
        if ((this.state.lifecycle?.playerChildren || []).length >= 1) this._unlockAchievement('first_child');
        if ((this.world._legacyGeneration || 1) >= 2) this._unlockAchievement('new_game_plus');
        if ((this.world._legacyGeneration || 1) >= 3) this._unlockAchievement('generation_3');
        const festLog = this.state.festivals?.festivalLog || [];
        if (festLog.length >= 1) this._unlockAchievement('first_festival');
        const festSeasons = new Set(festLog.map(f => f.season));
        if (festSeasons.size >= 4) this._unlockAchievement('all_festivals');
        if (festLog.length >= 5) this._unlockAchievement('festival_5');
        const discoveredZones = Object.keys(this.state.exploration?.discoveredZones || {});
        if (discoveredZones.length >= 1) this._unlockAchievement('first_explore');
        const totalExploreZones = Object.keys(this.world.exploration?.zones || {}).length;
        if (totalExploreZones > 0 && discoveredZones.length >= totalExploreZones) this._unlockAchievement('explore_all');
        const successExpeditions = (this.state.exploration?.expeditionLog || []).filter(e => e.success);
        if (successExpeditions.length >= 1) this._unlockAchievement('expedition_success');

        // v3 Industry achievements
        const ind = this.state.industry || {};
        const indKeys = Object.keys(ind.industries || {});
        if (indKeys.length >= 1) this._unlockAchievement('first_industry');
        if (indKeys.length >= 2) this._unlockAchievement('two_industries');
        if (indKeys.length >= 4) this._unlockAchievement('four_industries');
        for (const data of Object.values(ind.industries || {})) {
            if (data.level >= 3) this._unlockAchievement('industry_lv3');
            if (data.level >= 5) this._unlockAchievement('industry_lv5');
        }
        // Town level
        if ((ind.townLevel || 1) >= 3) this._unlockAchievement('town_lv3');
        if ((ind.townLevel || 1) >= 5) this._unlockAchievement('town_lv5');
        if ((ind.townLevel || 1) >= 7) this._unlockAchievement('town_lv7');

        // v3 Farm achievements
        const farm = this.state.farm || {};
        const totalHarvested = farm.totalHarvested || {};
        const harvestTotal = Object.values(totalHarvested).reduce((s, v) => s + v, 0);
        if (harvestTotal >= 1) this._unlockAchievement('first_harvest');
        if (harvestTotal >= 1) this._unlockAchievement('player_farmer');
        if (harvestTotal >= 100) this._unlockAchievement('harvest_100');
        if (harvestTotal >= 500) this._unlockAchievement('harvest_500');
        const harvestLog = farm.harvestLog || [];
        if (harvestLog.some(h => h.quality === 'excellent')) this._unlockAchievement('excellent_crop');

        // v3 Factory achievements
        const proc = this.state.processing || {};
        if (Object.keys(proc.builtFactories || {}).length >= 1) this._unlockAchievement('first_factory');
        const completedOrders = (proc.orders || []).filter(o => o.status === 'completed');
        if (completedOrders.length >= 1) this._unlockAchievement('factory_order');
        if (completedOrders.length >= 10) this._unlockAchievement('factory_order_10');

        // v3 Daily news achievements
        const newsData = this.state.dailyNews || {};
        if ((newsData.newspapers || []).length >= 1) this._unlockAchievement('read_newspaper');
        if ((newsData.newspapers || []).length >= 10) this._unlockAchievement('newspaper_10');
        if ((newsData.newspapers || []).length >= 30) this._unlockAchievement('newspaper_30');

        // v3 NPC event achievements
        const npcEvt = this.state.npcEvents || {};
        const incidents = npcEvt.recentIncidents || [];
        if (incidents.some(i => i.type === 'fight')) this._unlockAchievement('npc_fight');
        if (incidents.some(i => i.type === 'cheating_discovered')) this._unlockAchievement('npc_cheating');

        // v3.2 new achievement checks
        // Trade count
        if ((this._tradeCount || 0) >= 50) this._unlockAchievement('trade_50');
        if ((this._tradeCount || 0) >= 1000) this._unlockAchievement('player_trader');
        // Flirt count
        if ((this._flirtCount || 0) >= 5) this._unlockAchievement('flirt_master');
        // Player explorer
        if (successExpeditions.length >= 3) this._unlockAchievement('player_explorer');
        // Speed runner (5 buildings within 30 days)
        if (totalDays <= 30 && completedBuildings.length >= 5) this._unlockAchievement('speed_runner');
        // Pacifist (30 days, no fights)
        if (totalDays >= 30 && !incidents.some(i => i.type === 'fight') && raidEvents.length === 0) this._unlockAchievement('pacifist');
        // Save collector
        const saveCount = parseInt(localStorage.getItem('rimtown_save_count') || '0');
        if (saveCount >= 10) this._unlockAchievement('save_collector');
        // Prosperity max
        const prosData = this.state.prosperity || {};
        if (prosData.level === t('傳奇') || prosData.level === 'legendary') this._unlockAchievement('prosperity_max');
        // Achievement meta-achievements
        const unlockedCount = Object.keys(this._achievements || {}).length;
        if (unlockedCount >= 25) this._unlockAchievement('achievement_25');
        if (unlockedCount >= 50) this._unlockAchievement('achievement_50');
        if (unlockedCount >= 96) this._unlockAchievement('achievement_99'); // 96 + the 3 meta = 99
        // v5.34.1 第一輪判定結束後才開始彈成就通知(開場即達標的一批已靜默入袋)
        this._achFirstCheckDone = true;
    },
});
