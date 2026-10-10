// RimTown - app-towns.js：從 app.js 拆出的 城鎮列表與本機／雲端存檔管理：切鎮、建鎮、改名、刪除、瘦身（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    _getTownList() {
        try { return JSON.parse(localStorage.getItem('rimtown_town_list') || '[]'); } catch(e) { return []; }
    },
    _saveTownList(list) {
        localStorage.setItem('rimtown_town_list', JSON.stringify(list));
    },
    // v5.62.1 一次性遷移+開機守護:清掉同名重複的「第1天孤兒」城鎮條目。
    // 根因:啟動 fallback 每次用 _generateTownId 領新 id(同名加 _2/_3 字尾),
    // v5.59.1 雙寫後這些 id 每存一輪就在列表多一筆 Day1 邊境鎮。
    // 規則:同名分組,留進度最多的那筆;其餘只刪「絕對第1天、非目前鎮、
    // 非 last_town」的孤兒(含其存檔 blob),有實際進度的同名鎮一律保留
    _dedupeTownList() {
        try {
            const list = this._getTownList();
            if (list.length < 2) return;
            const absDay = (id) => {
                try {
                    const d = JSON.parse(localStorage.getItem('rimtown_town_' + id) || 'null');
                    if (!d) return 0;
                    const si = ['春季', '夏季', '秋季', '冬季'].indexOf(d?.clock?.season);
                    return ((d?.clock?.year || 1) - 1) * 60 + Math.max(0, si) * 15 + (d?.clock?.day || 1);
                } catch (e) { return 0; }
            };
            const lastTown = localStorage.getItem('rimtown_last_town');
            const byName = {};
            list.forEach(tw => { (byName[tw.name] = byName[tw.name] || []).push(tw); });
            const keep = new Set();
            const drop = [];
            for (const group of Object.values(byName)) {
                if (group.length === 1) { keep.add(group[0].id); continue; }
                const scored = group.map(tw => ({ tw, day: absDay(tw.id) }));
                scored.sort((a, b) => (b.day - a.day)
                    || ((b.tw.id === lastTown) - (a.tw.id === lastTown))
                    || String(b.tw.savedAt || '').localeCompare(String(a.tw.savedAt || '')));
                keep.add(scored[0].tw.id);
                for (const s of scored.slice(1)) {
                    if (s.day <= 1 && s.tw.id !== this.currentTownId && s.tw.id !== lastTown) drop.push(s.tw.id);
                    else keep.add(s.tw.id);
                }
            }
            if (drop.length) {
                this._saveTownList(list.filter(tw => keep.has(tw.id)));
                drop.forEach(id => { try { localStorage.removeItem('rimtown_town_' + id); } catch (e) {} });
                console.log('[RimTown] 城鎮列表去重:移除', drop.length, '筆 Day1 孤兒條目');
            }
        } catch (e) {}
    },

    // v5.63.0 兩份同鎮存檔挑較新的:先比 tickCount(每 tick 遞增,同一天內也分得出先後),
    // 沒有 tickCount 的舊檔退回比日期;平手才偏雲端
    // v5.66.6 回填:v5.64.1 移除 _dedupeCloudSaves 時誤連這個方法一起刪掉,開機/切鎮/馬車過場都會炸
    _newerSave(cloudData, localData) {
        if (!cloudData || !localData) return cloudData || localData || null;
        const tc = Number(cloudData.tickCount), tl = Number(localData.tickCount);
        if (Number.isFinite(tc) && Number.isFinite(tl) && tc !== tl) return tl > tc ? localData : cloudData;
        const absDay = d => { const si = ['春季', '夏季', '秋季', '冬季'].indexOf(d?.clock?.season); return ((d?.clock?.year || 1) - 1) * 60 + Math.max(0, si) * 15 + (d?.clock?.day || 1); };
        return absDay(localData) > absDay(cloudData) ? localData : cloudData;
    },

    _loadTownById(townId) {
        try {
            const json = localStorage.getItem('rimtown_town_' + townId);
            if (!json) return false;
            const loaded = this.world.loadSave(JSON.parse(json));
            if (loaded) {
                this.currentTownId = townId;
                localStorage.setItem('rimtown_last_town', townId);
            }
            return loaded;
        } catch(e) { return false; }
    },
    _saveCurrentTown(name) {
        if (!this.currentTownId) this.currentTownId = 'town_' + Date.now();
        const saveData = this.world.serialize();
        const clock = saveData.clock || {};
        const list = this._getTownList();
        const existing = list.find(t => t.id === this.currentTownId);
        const meta = {
            id: this.currentTownId,
            // v5.59.5 名字優先序:呼叫方指定 > 世界自己的鎮名 > 舊 meta。原本沒條目又沒傳名字時
            // 一律寫「邊境鎮」,海風鎮的存檔就這樣被掛錯名,馬車回程名單跟著壞;世界名也能修復舊的錯名 meta
            name: name || this.world?.townName || existing?.name || '邊境鎮',
            savedAt: new Date().toISOString(),
            season: clock.season || '春季',
            year: clock.year || 1,
            day: clock.day || 1,
            population: Object.keys(saveData.agents || {}).length,
        };
        if (existing) Object.assign(existing, meta);
        else list.push(meta);
        this._saveTownList(list);
        this._submitLeaderboard();
        // v4.6.0 存檔配額保護:寫入失敗(localStorage 滿)時自動瘦身重試,再失敗才警告
        // v5.69.3 重寫:舊版瘦身裁的是不存在的欄位(memories/recent_memories),等於沒瘦,登入玩家也被彈
        // 「請註冊登入」。現在依序:清聊天封存 → 依真實欄位瘦身 → (登入者)清其他鎮的本機副本 → 仍失敗時
        // 登入者只提示一次「本機備份空間不足,已改為只存雲端」,訪客才跳警告
        const key = 'rimtown_town_' + this.currentTownId;
        const tryWrite = (data) => { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (_) { return false; } };
        if (!tryWrite(saveData)) {
            let ok = false;
            const removeKeys = (pred) => { let n = 0; for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && pred(k)) { localStorage.removeItem(k); n++; } } return n; };
            // 1) 聊天封存(純紀錄,可重新產生)
            if (removeKeys(k => k.startsWith('rimtown_town_') && k.endsWith('_archives'))) ok = tryWrite(saveData);
            // 2) 依真實欄位瘦身:村民記憶、全鎮日誌、對話紀錄、八卦、名場面
            if (!ok) { this._slimSaveForLocal(saveData); ok = tryWrite(saveData); if (ok) console.warn('[RimTown] 存檔空間不足,已自動瘦身後儲存本機備份'); }
            // 3) 登入者:其他城鎮的本機副本雲端都有,讓位給目前的鎮
            if (!ok && this.auth?.loggedIn) {
                if (removeKeys(k => k.startsWith('rimtown_town_') && k !== key && k !== 'rimtown_town_list')) ok = tryWrite(saveData);
            }
            if (!ok) {
                if (this.auth?.loggedIn) {
                    if (!this._localQuotaNoticeShown) {
                        this._localQuotaNoticeShown = true;
                        console.warn('[RimTown] 本機備份空間不足,改為只存雲端');
                        try { this._showCornerNotice({ icon: '☁️', title: t('本機備份空間不足'), name: '', desc: t('存檔已改為只存雲端，進度安全。') }); } catch (e) {}
                    }
                } else {
                    this._gameAlert(t('儲存空間已滿！請到「城鎮列表」刪除舊城鎮，或登入改用雲端存檔。'), '💾');
                }
            }
        }
        localStorage.setItem('rimtown_last_town', this.currentTownId);
    },
    // v5.69.3 本機備份瘦身:只裁「可重新累積」的紀錄,不動關係/任務/資源等狀態
    _slimSaveForLocal(saveData) {
        try {
            for (const a of Object.values(saveData.agents || {})) {
                if (Array.isArray(a.memory)) a.memory = a.memory.slice(-120);
                if (Array.isArray(a.chatHistory)) a.chatHistory = a.chatHistory.slice(-200);
                if (Array.isArray(a.chat_history)) a.chat_history = a.chat_history.slice(-200);
                for (const r of Object.values(a.relationships || {})) {
                    if (r && Array.isArray(r.sharedMemories)) r.sharedMemories = r.sharedMemories.slice(-30);
                }
            }
            if (Array.isArray(saveData.messageLog)) saveData.messageLog = saveData.messageLog.slice(-300);
            if (Array.isArray(saveData.npcConversationLog)) saveData.npcConversationLog = saveData.npcConversationLog.slice(-300);
            if (Array.isArray(saveData.gossip)) saveData.gossip = saveData.gossip.slice(-200);
            if (Array.isArray(saveData.dramaArchive)) saveData.dramaArchive = saveData.dramaArchive.slice(-20);
            if (saveData.townFeed && Array.isArray(saveData.townFeed.posts)) saveData.townFeed.posts = saveData.townFeed.posts.slice(-40);
        } catch (e) {}
        return saveData;
    },
    showTownManager() {
        // v5.54.0 記住開窗前的暫停狀態,關窗時還原——不再無條件恢復播放蓋掉你按的暫停
        this._pausedBeforeTownModal = !!this.world.paused;
        this.world.paused = true;
        const modal = document.getElementById('town-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this._renderTownList();
    },
    _renderTownList() {
        const container = document.getElementById('town-list-content');
        if (!container) return;
        // When logged in, show cloud saves; otherwise show local saves
        if (this.auth.loggedIn) {
            this._renderCloudTownList(container);
            return;
        }
        const towns = this._getTownList();
        let html = '';
        if (!towns.length) {
            html = t('<p class="muted-text">尚無城鎮存檔。</p>');
        } else {
            towns.forEach(_tw => {
                const isActive = _tw.id === this.currentTownId;
                const date = new Date(_tw.savedAt).toLocaleString();
                html += `<div class="town-item ${isActive?'active':''}">
                    <div class="town-info" data-action="switch-town" data-val="${_tw.id}">
                        <div class="town-name">${t(_tw.name)} ${isActive?t('<span class="current-badge">目前</span>'):''}</div>
                        <div class="town-meta">${t(_tw.season)}${t(' 第')}${_tw.year}${t('年 第')}${_tw.day}${t('天 | 人口')}${_tw.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="rename-town" data-val="${_tw.id}" title="${t('重新命名')}">✏️</button>
                        ${!isActive?`<button data-action="delete-town" data-val="${_tw.id}" title="${t('刪除')}" class="btn-danger">🗑️</button>`:''}
                    </div>
                </div>`;
            });
        }
        html += `<div class="town-modal-actions">
            <button class="town-btn town-btn-primary" data-action="create-town">${t('新建城鎮')}</button>
            <button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button>
        </div>`;
        container.innerHTML = html;
    },
    async _renderCloudTownList(container) {
        container.innerHTML = `<p class="muted-text">${t('載入雲端存檔...')}</p>`;
        try {
            const saves = await this.auth.listSaves();
            this._cloudSaves = saves;
            // v5.59.0 TC-01:雲端寫入失敗時本地存檔仍在——併入「只存在本機」的城鎮,
            // 不再誤報「雲端尚無城鎮存檔」把玩家鎖死
            // v5.96.0 B13:以 town_id 為主鍵——只要雲端沒有這個 id 就列為「本機」,同名只標註不再隱藏(多裝置/分身一眼可見、可刪本機副本)
            const cloudIds = new Set(saves.map(s => s.town_id));
            const cloudNames = new Set(saves.map(s => s.town_name));
            const localOnly = this._getTownList().filter(tw => !cloudIds.has(tw.id) && localStorage.getItem('rimtown_town_' + tw.id));
            let html = '';
            if (!saves.length && !localOnly.length) {
                html = t('<p class="muted-text">尚無城鎮存檔。</p>');
            } else {
                saves.forEach(_tw => {
                    const isActive = _tw.town_id === this.currentTownId;
                    const date = _tw.updated_at ? new Date(_tw.updated_at).toLocaleString() : '';
                    html += `<div class="town-item ${isActive?'active':''}">
                        <div class="town-info" data-action="switch-town" data-val="${_tw.town_id}">
                            <div class="town-name">${t(_tw.town_name)} ${isActive?t('<span class="current-badge">目前</span>'):''}</div>
                            <div class="town-meta">${_tw.season||''}${t(' 第')}${_tw.year||1}${t('年 第')}${_tw.day||1}${t('天 | 人口')}${_tw.population||0} | ${date}</div>
                        </div>
                        <div class="town-actions">
                            <button data-action="rename-town" data-val="${_tw.town_id}" title="${t('重新命名')}">✏️</button>
                            ${!isActive?`<button data-action="delete-town" data-val="${_tw.town_id}" title="${t('刪除')}" class="btn-danger">🗑️</button>`:''}
                        </div>
                    </div>`;
                });
            }
            localOnly.forEach(_tw => {
                const isActive = _tw.id === this.currentTownId;
                html += `<div class="town-item ${isActive?'active':''}">
                    <div class="town-info" data-action="switch-town" data-val="${_tw.id}">
                        <div class="town-name">${t(_tw.name)} <span style="font-size:0.65rem;color:var(--text-muted)">📱 ${t('本機')}${cloudNames.has(_tw.name) ? `（${t('與雲端同名')}）` : ''}</span> ${isActive?t('<span class="current-badge">目前</span>'):''}</div>
                        <div class="town-meta">${_tw.season||''}${t(' 第')}${_tw.year||1}${t('年 第')}${_tw.day||1}${t('天 | 人口')}${_tw.population||0}</div>
                    </div>
                    <div class="town-actions">${!isActive ? `<button data-action="delete-local-town" data-val="${_tw.id}" title="${t('刪除本機副本')}" class="btn-danger">🗑️</button>` : ''}</div>
                </div>`;
            });
            html += `<div class="town-modal-actions">
                <button class="town-btn town-btn-primary" data-action="create-town">${t('新建城鎮')}</button>
                <button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button>
            </div>`;
            container.innerHTML = html;
        } catch (e) {
            console.error('[RimTown] Cloud town list error:', e);
            container.innerHTML = `<p class="muted-text">${t('載入雲端存檔失敗。')}</p>
                <div class="town-modal-actions"><button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button></div>`;
        }
    },
    async switchTown(townId) {
        if (townId === this.currentTownId) {
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = !!this._pausedBeforeTownModal;
            return;
        }
        if (this.auth.loggedIn) {
            // When logged in, save current to cloud then load target from cloud
            // v5.59.1 切鎮前同時寫一份本地存檔——雲端寫入失敗時進度不再蒸發(QA:海風玩到第2天切走就沒了)
            try { this._saveCurrentTown(); } catch (e) {}
            await this.saveGame();
            // v5.59.0 雲端與本地都拿出來,比日期挑「較新」的那份——
            // 訪客時期的舊複本(Day1 存檔)不會再蓋掉真實進度(TC-02 半重置根因)
            let cloudData = null, localData = null;
            try { cloudData = await this.auth.cloudLoad(townId); } catch (e) { console.error('[RimTown] Cloud switch town error:', e); }
            try { const j = localStorage.getItem('rimtown_town_' + townId); if (j) localData = JSON.parse(j); } catch (e) {}
            const pickData = this._newerSave(cloudData, localData); // v5.63.0 以 tickCount 比新舊(同一天內也分得出)
            let loaded = false;
            if (pickData) { try { loaded = !!this.world.loadSave(pickData); } catch (e) { console.error('[RimTown] switch load error:', e); } }
            if (loaded) setTimeout(() => this._notifyScrubbedLeaks(), 1500); // v5.67.4
            if (loaded) {
                localStorage.setItem('rimtown_last_town', townId);
                if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                this.currentTownId = townId;
                this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                const cloudMeta = this._cloudSaves?.find(s => s.town_id === townId);
                const localMeta = this._getTownList().find(tw => tw.id === townId);
                this._updateHeaderTownName(cloudMeta?.town_name || localMeta?.name || this.world.townName);
                this.render();
                // 本地載入的鎮順手補上雲端,跨裝置也看得到
                try { await this.saveGame(); } catch (e) {}
            } else {
                this._gameAlert?.(t('切換城鎮失敗：找不到該城鎮的存檔。'), '❌');
                this.world.logMessage('system', t('切換城鎮失敗。'));
            }
        } else {
            // Not logged in — use local saves
            this._saveCurrentTown();
            if (this._loadTownById(townId)) {
                if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                const townMeta = this._getTownList().find(t => t.id === townId);
                this._updateHeaderTownName(townMeta?.name);
                this.render();
            }
        }
        document.getElementById('town-modal')?.classList.add('hidden');
        this.world.paused = !!this._pausedBeforeTownModal;
        // v5.59.1 任何切鎮路徑(城鎮列表直切/馬車)完成後,教學橫幅與今日焦點立即依新鎮重算
        this._otherTownsAt = 0; // v5.59.5 抵達後立即依新鎮重建出訪名單,不沿用上一鎮的(否則海風鎮的馬車會列出海風鎮自己)
        this._updateQuestGuidance?.();
        try { if (this.world?.generateDailyFocus && !this.world.dailyFocus) this.world.generateDailyFocus(); } catch (e) {}
    },
    _generateTownId(name) {
        // Generate stable town_id based on user_id + town name for cross-device sync
        if (this.auth.loggedIn && this.auth.userId) {
            // Simple hash from the name
            let hash = 0;
            const str = name || '';
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            let baseId = 'town_u' + this.auth.userId + '_' + Math.abs(hash).toString(36);
            // If this ID already exists locally (same-name town), add suffix
            const existing = this._getTownList();
            let id = baseId;
            let suffix = 2;
            while (existing.some(t => t.id === id)) {
                id = baseId + '_' + suffix;
                suffix++;
            }
            return id;
        }
        return 'town_' + Date.now();
    },
    async createNewTown() {
        const defaultSuffix = this.auth.loggedIn
            ? ((this._cloudSaves?.length || 0) + 1)
            : (this._getTownList().length + 1);
        // v5.58.0 建立新城鎮恢復原行為(邊境鎮);海風鎮不用建立——它本來就存在,搭馬車去即可
        const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + defaultSuffix);
        if (!name) return;
        this._showBusyOverlay(`🏗️ ${t('新城鎮建立中，原本的城鎮會先自動儲存…')}`);
        if (this.auth.loggedIn) {
            // When logged in, save current town to cloud before creating new one
            if (this.currentTownId) await this.saveGame();
        } else {
            if (this.currentTownId) this._saveCurrentTown();
        }
        // (在舊鎮存檔之後才改 theme/name,避免把新名字蓋到舊存檔上)
        this.world.townTheme = 'frontier';
        this.world.townName = name;
        this.world.rosterMode = (localStorage.getItem('rimtown_roster_mode') === 'random') ? 'random' : 'scripted'; // v5.27.0 肉鴿隨機開局
        this.world.reset();
        if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
        this.currentTownId = this._generateTownId(name);
        if (this.auth.loggedIn) {
            // Save new town to cloud immediately
            await this.saveGame();
        } else {
            this._saveCurrentTown(name);
        }
        this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
        this.state = this.world.getState();
        this._generateTileMapLayout();
        if (this.tileMap) this.tileMap.agentPositions = {};
        // Close modal and unpause
        document.getElementById('town-modal')?.classList.add('hidden');
        this.world.paused = !!this._pausedBeforeTownModal;
        this._updateHeaderTownName(name);
        this.world.logMessage('system', `${t('🏘️ 新城鎮「')}${name}${t('」已建立！')}`);
        this._hideBusyOverlay();
        this._showCornerNotice({ icon: '🏘️', title: `${name}${t('已建立')}`, name: '', desc: t('原本的城鎮已自動儲存，「城鎮列表」隨時可切換，兩鎮並存') });
        this.render();
    },

    // v5.58.0 忙碌遮罩:建鎮/生成期間顯示,長時間作業不再像當機
    _showBusyOverlay(text) {
        this._hideBusyOverlay();
        const ov = document.createElement('div');
        ov.id = 'busy-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,24,0.85);z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px';
        ov.innerHTML = `<div style="font-size:2.2rem;animation:busySpin 1.2s linear infinite">⏳</div>
            <div style="color:#cfd8ea;font-size:0.95rem">${text || t('處理中…')}</div>
            <div style="color:#8fa8c9;font-size:0.75rem">${t('請稍候，不要重新整理頁面')}</div>
            <style>@keyframes busySpin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(ov);
    },
    _hideBusyOverlay() { document.getElementById('busy-overlay')?.remove(); },
    async renameTownPrompt(townId) {
        let currentName = '邊境鎮';
        if (this.auth.loggedIn && this._cloudSaves) {
            const cloud = this._cloudSaves.find(s => s.town_id === townId);
            if (cloud) currentName = cloud.town_name;
        } else {
            const towns = this._getTownList();
            const town = towns.find(t => t.id === townId);
            if (town) currentName = town.name;
        }
        const newName = prompt(t('新名稱：'), currentName);
        if (newName && newName.trim()) {
            if (this.auth.loggedIn) {
                // When logged in, re-save to cloud with new name
                try {
                    const saveData = await this.auth.cloudLoad(townId);
                    if (saveData) {
                        const clock = saveData.clock || {};
                        await this.auth.cloudSave(townId, newName.trim(), saveData, {
                            season: clock.season, year: clock.year, day: clock.day,
                            population: Object.keys(saveData.agents || {}).length,
                        });
                        // Update local cache
                        if (this._cloudSaves) {
                            const cs = this._cloudSaves.find(s => s.town_id === townId);
                            if (cs) cs.town_name = newName.trim();
                        }
                    }
                } catch (e) {
                    console.error('[RimTown] Cloud rename error:', e);
                }
            } else {
                const towns = this._getTownList();
                const town = towns.find(t => t.id === townId);
                if (town) {
                    town.name = newName.trim();
                    this._saveTownList(towns);
                }
            }
            if (townId === this.currentTownId) {
                this._updateHeaderTownName(newName.trim());
            }
            this._renderTownList();
        }
    },
    async deleteTownConfirm(townId) {
        if (!await this._gameConfirm(t('確定要刪除這個城鎮？所有存檔和聊天記錄都會消失。'), '🗑️')) return;
        if (this.auth.loggedIn) {
            // When logged in, delete from cloud
            try {
                await this.auth.cloudDelete(townId);
            } catch (e) {
                console.error('[RimTown] Cloud delete error:', e);
            }
        } else {
            // Not logged in — delete from local storage
            const list = this._getTownList().filter(t => t.id !== townId);
            this._saveTownList(list);
            localStorage.removeItem('rimtown_town_' + townId);
            localStorage.removeItem('rimtown_town_' + townId + '_archives');
        }
        this._renderTownList();
    },

    // v5.96.0 B13:登入狀態下刪除「只在本機」的城鎮副本(不碰雲端)
    async deleteLocalTownConfirm(townId) {
        if (!townId || townId === this.currentTownId) return;
        if (!await this._gameConfirm(t('只刪除這份本機副本（雲端存檔不受影響）？'), '🗑️')) return;
        const list = this._getTownList().filter(tw => tw.id !== townId);
        this._saveTownList(list);
        localStorage.removeItem('rimtown_town_' + townId);
        localStorage.removeItem('rimtown_town_' + townId + '_archives');
        this._blobNameCache = {}; this._otherTownsAt = 0;
        this._renderTownList();
    },
});
