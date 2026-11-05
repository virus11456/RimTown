// RimTown - app-towns.js：從 app.js 拆出的 城鎮列表與本機／雲端存檔管理：切鎮、建鎮、改名、刪除、瘦身（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／sw.js 都要列）。
'use strict';
// v6.75.0 世界 id 存進存檔;舊存檔沒有就是原本的世界 w0。reset() 不動它(換鎮名、新地圖仍在同一個世界)
if (typeof World !== 'undefined' && !World.prototype._worldIdHooked) {
    World.prototype._worldIdHooked = true;
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d) { d.worldId = this.worldId || 'w0'; if (this.roadClosures && Object.keys(this.roadClosures).length) d.roadClosures = this.roadClosures; } return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); if (r) { this.worldId = (data && typeof data.worldId === 'string' && data.worldId) || 'w0'; this.roadClosures = (data?.roadClosures && typeof data.roadClosures === 'object') ? data.roadClosures : {}; } return r; }; // v6.76.0 路況跟著存檔
    const _reset = World.prototype.reset; World.prototype.reset = function (...a) { const r = _reset.apply(this, a); this.roadClosures = {}; return r; };
}
Object.assign(RimTownApp.prototype, {
    // v6.75.0 某個存檔屬於哪個世界:雲端 meta → 本機列表 → 預設 w0
    _townWorld(id) {
        if (!id) return 'w0';
        if (id === this.currentTownId) return rimtownWorldId();
        const c = Array.isArray(this._cloudSaves) ? this._cloudSaves.find(s => s.town_id === id) : null; if (c?.world_id) return c.world_id;
        const l = this._getTownList().find(tw => tw.id === id); return l?.world || 'w0';
    },
    _newWorldId() { let r = ''; try { r = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { r = Math.random().toString(36).slice(2, 14); } return 'w_' + r; },
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
            list.forEach(tw => { const k = (tw.world || 'w0') + '|' + tw.name; (byName[k] = byName[k] || []).push(tw); }); // v6.75.0 同一個世界裡的同名鎮才算重複
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
            theme: this.world?.townTheme || existing?.theme || '', // v6.35.0 主題鍵
            origin: existing?.origin || 'user',                   // v6.35.0 自己建的;鄰鎮由 _ensureNeighborTown 標 neighbor
            world: this.world?.worldId || existing?.world || 'w0', // v6.75.0
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
    // v6.35.0 顯示名:知道主題就用主題的正名(依語言翻),不管當初存的是中文還英文;自訂名照原樣;舊的英文預設名翻回中文
    _townDisplayName(name, theme) {
        const s = String(name || '');
        const TT = (typeof TOWN_THEMES !== 'undefined') ? TOWN_THEMES : {};
        const EN2ZH = [['Frontier Town', '邊境鎮'], ['Seabreeze Harbor', '海風鎮'], ['Mine Ridge', '礦山鎮'], ['Greenwood', '林間村'], ['Market City', '市集城']];
        let zh = s; for (const [en, z] of EN2ZH) if (s.startsWith(en)) { zh = z + s.slice(en.length); break; }
        const def = theme && TT[theme]?.townName;
        if (def && (zh === def || zh.replace(/\s+\d+$/, '') === def)) { const suffix = zh.slice(def.length); return t(def) + suffix; }
        const lang = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'zh';
        return lang === 'zh' ? zh : t(zh);
    },
    // v6.35.0 城鎮列表資料:雲端＋只在本機的,補主題／來源,標鄰鎮與疑似重複
    _isNeighborTown(e) {
        if (e.origin === 'neighbor' || e.origin === 'generated') return true; if (e.origin === 'user') return false;
        if (e.theme && typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[e.theme]?.generated) return true; // v6.45.0 種子鎮
        return (typeof NEIGHBOR_TOWNS !== 'undefined') && NEIGHBOR_TOWNS.some(d => d.match.test(e.name || '')) && (!e.theme || e.theme !== 'frontier');
    },
    _guessTheme(name) {
        if (typeof NEIGHBOR_TOWNS !== 'undefined') for (const d of NEIGHBOR_TOWNS) if (d.match.test(name || '')) return d.theme;
        return /邊境鎮|Frontier Town/i.test(name || '') ? 'frontier' : '';
    },
    _townEntries(saves) {
        const local = this._getTownList(); const entries = [];
        if (saves) {
            const cloudIds = new Set(saves.map(x => x.town_id));
            for (const x of saves) { const lm = local.find(tw => tw.id === x.town_id); entries.push({ id: x.town_id, name: x.town_name || '', theme: x.town_theme || lm?.theme || '', origin: x.origin || lm?.origin || '', season: x.season || '', year: x.year || 1, day: x.day || 1, population: x.population || 0, at: x.updated_at || '', source: 'cloud' }); }
            for (const tw of local) if (!cloudIds.has(tw.id) && localStorage.getItem('rimtown_town_' + tw.id)) entries.push({ id: tw.id, name: tw.name || '', theme: tw.theme || '', origin: tw.origin || '', season: tw.season || '', year: tw.year || 1, day: tw.day || 1, population: tw.population || 0, at: tw.savedAt || '', source: 'local', sameNameCloud: saves.some(x => x.town_name === tw.name) });
        } else for (const tw of local) entries.push({ id: tw.id, name: tw.name || '', theme: tw.theme || '', origin: tw.origin || '', season: tw.season || '', year: tw.year || 1, day: tw.day || 1, population: tw.population || 0, at: tw.savedAt || '', source: 'local' });
        for (const e of entries) { e.world = this._townWorld(e.id); e.theme = e.theme || this._guessTheme(e.name); e.isNeighbor = this._isNeighborTown(e); e.isActive = e.id === this.currentTownId; e.display = this._townDisplayName(e.name, e.theme); }
        { const prog = (e) => ((e.year || 1) - 1) * 60 + Math.max(0, ['春季', '夏季', '秋季', '冬季'].indexOf(e.season)) * 15 + (e.day || 1); const g = {}; for (const e of entries.filter(x => x.isNeighbor)) (g[e.world + '|' + rimtownCanonTown(e.name)] = g[e.world + '|' + rimtownCanonTown(e.name)] || []).push(e); for (const list of Object.values(g)) if (list.length > 1) { list.sort((a, b) => prog(b) - prog(a)); for (const e of list.slice(1)) if (!e.isActive) e.dupNb = true; } } // v6.76.0
        const mine = entries.filter(e => !e.isNeighbor);
        for (const e of mine) e.dup = e.year <= 1 && e.day <= 1 && mine.some(o => o !== e && o.world === e.world && o.year <= 1 && o.day <= 1 && (o.display === e.display || (o.theme && o.theme === e.theme)));
        return entries;
    },
    _townRow(e) {
        const icon = ({ frontier: '🏡', harbor: '🌊', mountain: '⛏️', forest: '🌲', market: '🏛️' })[e.theme] || (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[e.theme]?.generated ? ({ harbor: '🌊', mountain: '⛏️', forest: '🌲', market: '🏛️', frontier: '🌾' })[TOWN_THEMES[e.theme].base] : '') || '🏘️';
        const esc = (x) => this._escapeHtml ? this._escapeHtml(String(x ?? '')) : String(x ?? '');
        const tags = [];
        if (e.source === 'local' && this.auth.loggedIn) tags.push(`📱 ${t('本機')}${e.sameNameCloud ? `${t('（')}${t('與雲端同名')}${t('）')}` : ''}`);
        if (e.dup) tags.push(`⚠️ ${t('疑似重複：還在第 1 天')}`);
        if (e.dupNb) tags.push(`⚠️ ${t('重複的鄰鎮：馬車不會去這座，可以刪除')}`); // v6.76.0
        const date = e.at ? new Date(e.at).toLocaleString() : '';
        const actions = (e.source === 'cloud' || !this.auth.loggedIn)
            ? `<button data-action="rename-town" data-val="${e.id}" title="${t('重新命名')}">✏️</button>${!e.isActive ? `<button data-action="delete-town" data-val="${e.id}" title="${t('刪除')}" class="btn-danger">🗑️</button>` : ''}`
            : (!e.isActive ? `<button data-action="delete-local-town" data-val="${e.id}" title="${t('刪除本機副本')}" class="btn-danger">🗑️</button>` : '');
        return `<div class="town-item ${e.isActive ? 'active' : ''}${e.dup ? ' town-dup' : ''}">
            <div class="town-info" data-action="switch-town" data-val="${e.id}">
                <div class="town-name">${icon} ${esc(e.display)} ${e.isActive ? t('<span class="current-badge">目前</span>') : ''}${tags.map(x => ` <span class="town-tag">${x}</span>`).join('')}</div>
                <div class="town-meta">${t(e.season)}${t(' 第')}${e.year}${t('年 第')}${e.day}${t('天 | 人口')}${e.population}${date ? ' | ' + date : ''}</div>
            </div>
            <div class="town-actions">${actions}</div>
        </div>`;
    },
    _renderTownSections(container, entries) {
        // v6.75.0 依世界分組:目前這場遊戲的城鎮與鄰鎮在上面,其他遊戲(其他世界)的存檔另外列
        const cur = rimtownWorldId(); const others = entries.filter(e => e.world !== cur); entries = entries.filter(e => e.world === cur);
        const mine = entries.filter(e => !e.isNeighbor), nb = entries.filter(e => e.isNeighbor);
        let html = '';
        if (!entries.length && !others.length) html = t('<p class="muted-text">尚無城鎮存檔。</p>');
        else {
            html += `<h4 class="town-section">🏡 ${t('我的城鎮')} <span class="pp-count">${mine.length}</span></h4>` + (mine.length ? mine.map(e => this._townRow(e)).join('') : `<p class="muted-text">${t('還沒有自己建立的城鎮。')}</p>`);
            if (nb.length) html += `<h4 class="town-section">🛤️ ${t('鄰鎮（道路開通後自動生成）')} <span class="pp-count">${nb.length}</span></h4>` + nb.map(e => this._townRow(e)).join('');
            if (others.length) {
                const byW = {}; for (const e of others) (byW[e.world] = byW[e.world] || []).push(e);
                html += `<h4 class="town-section">🌍 ${t('其他遊戲（各自獨立的世界）')} <span class="pp-count">${Object.keys(byW).length}</span></h4><p class="muted-text town-hint">${t('每場遊戲是一個獨立的世界，鄰鎮、道路和馬車只在同一個世界裡；點城鎮就能切過去玩。')}</p>`;
                for (const list of Object.values(byW)) { const head = list.find(e => !e.isNeighbor) || list[0]; html += `<div class="town-world">` + [head, ...list.filter(e => e !== head)].map(e => this._townRow(e)).join('') + `</div>`; }
            }
            if (mine.some(e => e.dup)) html += `<p class="muted-text town-hint">${t('⚠️ 標「疑似重複」的是兩座都還在第 1 天的同名或同主題城鎮，多半是以前按「新地圖」或切換語言時多建的；確定不要的那座按 🗑️ 刪掉。不會自動刪除任何存檔。')}</p>`;
        }
        try { html += this._genTownSectionHtml ? this._genTownSectionHtml() : ''; } catch (e) {} // v6.45.0 遠方城鎮
        html += `<div class="town-modal-actions">
            <button class="town-btn town-btn-primary" data-action="create-town">${t('開新遊戲（新世界）')}</button>
            <button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button>
        </div>`;
        container.innerHTML = html;
    },
    _renderTownList() {
        const container = document.getElementById('town-list-content');
        if (!container) return;
        if (this.auth.loggedIn) { this._renderCloudTownList(container); return; }
        this._renderTownSections(container, this._townEntries(null));
    },
    async _renderCloudTownList(container) {
        container.innerHTML = `<p class="muted-text">${t('載入雲端存檔...')}</p>`;
        try {
            const saves = await this.auth.listSaves();
            this._cloudSaves = saves;
            // v5.59.0 TC-01:雲端寫入失敗時本地存檔仍在——併入「只存在本機」的城鎮;v5.96.0 以 town_id 為主鍵;v6.35.0 分區＋主題＋疑似重複
            this._renderTownSections(container, this._townEntries(saves));
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
        // v6.35.0 城鎮身分改用隨機 id:之前用「使用者 id + 鎮名」雜湊,換語言或改名就變成另一座(英文介面下會長出 Frontier Town);
        // 舊存檔的 id 不動、照常可讀;名字只是標籤
        let rnd = '';
        try { rnd = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')).slice(0, 16); } catch (e) { rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
        const existing = this._getTownList();
        let id = 'town_' + rnd; while (existing.some(t => t.id === id)) id = 'town_' + rnd + '_' + Math.random().toString(36).slice(2, 5);
        return id;
    },
    async createNewTown() {
        const defaultSuffix = this.auth.loggedIn
            ? ((this._cloudSaves?.length || 0) + 1)
            : (this._getTownList().length + 1);
        // v5.58.0 建立新城鎮恢復原行為(邊境鎮);海風鎮不用建立——它本來就存在,搭馬車去即可
        if (!confirm(t('這會開一場全新的遊戲：新的世界、新的鄰鎮與道路，跟目前的存檔完全分開、互不影響。目前這場會保留在「城鎮列表」裡，隨時可以切回來。確定要開新遊戲嗎？'))) return; // v6.75.0 開新遊戲＝新世界
        const name = prompt(t('為新城鎮命名：'), '邊境鎮 ' + defaultSuffix); // v6.34.1 預設名存中文正名,顯示時再翻
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
        this.world.worldId = this._newWorldId(); // v6.75.0 新的世界:鄰鎮、道路、遠方城鎮從頭開始
        this._otherTownsAt = 0; this._neighborEnsured = {}; this._blobNameCache = {}; this._genDayKey = null; this._genCrossNewsAt = 0; this.world.otherTowns = []; this.world.crossTownNews = [];
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
        this.world.logMessageT('system', '🏘️ 新城鎮「{name}」已建立！', { name });
        this._hideBusyOverlay();
        this._showCornerNotice({ icon: '🏘️', title: `${name}${t('已建立')}`, name: '', desc: t('新的世界開始了！原本那場遊戲已自動儲存，「城鎮列表」隨時可以切回去，兩邊互不影響') });
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
