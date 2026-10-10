// RimTown - app-loop.js：從 app.js 拆出的 核心玩法迴圈介面：季末回顧、押商隊、馬車出訪、管理員用戶、住房同步、跨鎮信箱、委託板／旅人／季度考驗、搬家提案（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    _showSeasonRecap() {
        const w = this.world; const d = w?.recap?.toDict?.(w); const r = d?.last; if (!r) return;
        document.getElementById('season-recap')?.remove();
        const esc = (x) => this._escapeHtml(String(x));
        const ov = document.createElement('div'); ov.id = 'season-recap';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,24,0.72);z-index:9999;display:flex;align-items:center;justify-content:center';
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;padding:18px;max-width:380px;width:90%;max-height:85vh;overflow-y:auto';
        const gradeCol = { S: '#ffd166', A: 'var(--positive, #4ade80)', B: 'var(--accent)', C: 'var(--negative, #f87171)' }[r.grade] || 'var(--accent)';
        let inner = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-weight:bold;font-size:1rem">📜 ${t('季末回顧')}</div><div style="font-size:1.4rem;font-weight:bold;color:${gradeCol}">${esc(r.grade)}</div></div>`;
        inner += `<div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:10px">${esc(r.title)} · ${esc(r.gradeText)}</div>`;
        inner += r.lines.map(l => `<div style="font-size:0.82rem;margin:5px 0;line-height:1.4">${l.icon} ${esc(l.text)}</div>`).join('');
        if (d.history.length > 1) inner += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:10px;border-top:1px solid var(--border);padding-top:6px">${t('之前幾季')}：${d.history.slice(1).map(h => `${esc(h.title)} ${esc(h.grade)}`).join(' · ')}</div>`;
        inner += `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:8px">${t('下一季：第 5 天公布新考驗，委託每天早上更新')}</div>`;
        inner += `<button class="trade-btn" data-action="recap-close" style="width:100%;padding:8px;margin-top:12px">${t('關閉')}</button>`;
        card.innerHTML = inner; ov.appendChild(card); document.body.appendChild(ov);
        ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-action="recap-close"]')) ov.remove(); });
    },
    _showCaravanDialog() {
        const w = this.world; if (!w) return;
        document.getElementById('caravan-dialog')?.remove();
        const towns = (w.otherTowns || []).filter(tw => tw.id !== this.currentTownId && tw.name !== w.townName).map(tw => ({ ...tw, theme: (typeof themeKeyOfTownName === 'function' ? themeKeyOfTownName(tw.name) : null) || 'frontier' }));
        const esc = (x) => this._escapeHtml(String(x));
        const resList = ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'tools'].filter(r => (w.stockpile.get(r) || 0) >= 10);
        const guards = w.availableGuards();
        const ov = document.createElement('div'); ov.id = 'caravan-dialog';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,24,0.72);z-index:9999;display:flex;align-items:center;justify-content:center';
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;padding:18px;max-width:360px;width:90%;max-height:85vh;overflow-y:auto';
        const a = w.playerCaravan?.active;
        let inner = `<div style="font-weight:bold;font-size:1rem;margin-bottom:6px">🐪 ${t('押商隊')}</div>`;
        if (a) {
            inner += `<div style="font-size:0.8rem;line-height:1.7">${t('商隊在路上：')}${a.amount} ${this._resLabel(a.res)} → ${esc(t(a.toTownName))}${a.guardName ? `（${esc(t(a.guardName))}${t('押車')}）` : ''}<br>${t('預計')} ${Math.max(0, a.returnAbsDay - w._absDay())} ${t('天後回報')}</div>`;
        } else if (!towns.length || !resList.length) {
            inner += `<div style="font-size:0.8rem;color:var(--text-secondary)">${!towns.length ? t('還沒有通車的鄰鎮。') : t('倉庫裡沒有夠的貨（至少 10 份）。')}</div>`;
        } else {
            const sel = (id, opts) => `<select id="${id}" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:0.85rem">${opts}</select>`;
            inner += `<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">${t('車伕掂掂貨：「要押什麼去哪？山路快一天，但不太平。」')}</div>`;
            inner += `<label style="font-size:0.75rem">${t('目的鎮')}</label>${sel('pc-town', towns.map((tw, i) => `<option value="${i}">${esc(t(tw.name))}</option>`).join(''))}`;
            inner += `<label style="font-size:0.75rem;margin-top:6px;display:block">${t('貨物')}</label>${sel('pc-res', resList.map(r => `<option value="${r}">${this._resLabel(r)}（${t('倉庫')} ${w.stockpile.get(r)}）</option>`).join(''))}`;
            inner += `<label style="font-size:0.75rem;margin-top:6px;display:block">${t('數量')} <span id="pc-amt-v">20</span></label><input type="range" id="pc-amt" min="10" max="200" step="10" value="20" style="width:100%">`;
            inner += `<label style="font-size:0.75rem;margin-top:6px;display:block">${t('護衛')}</label>${sel('pc-guard', `<option value="">${t('不派（省 20 銀幣）')}</option>` + guards.map(g => `<option value="${g.agentId}">${esc(t(g.name))}（${t('離鎮')} 1–2 ${t('天')}）</option>`).join(''))}`;
            inner += `<div style="margin-top:6px;font-size:0.8rem;display:flex;gap:12px"><label><input type="radio" name="pc-route" value="road" checked> ${t('大路（2 天）')}</label><label><input type="radio" name="pc-route" value="mountain"> ${t('山路（1 天）')}</label></div>`;
            inner += `<div id="pc-quote" style="margin-top:8px;font-size:0.78rem;line-height:1.7;background:rgba(255,255,255,0.05);border-radius:8px;padding:8px"></div>`;
            inner += `<button class="trade-btn btn-accent pc-go" style="width:100%;margin-top:8px;padding:9px">🐪 ${t('出發')}</button>`;
        }
        inner += `<button class="trade-btn pc-close" style="width:100%;margin-top:8px;padding:8px;opacity:0.8">${t('關閉')}</button>`;
        card.innerHTML = inner; ov.appendChild(card); document.body.appendChild(ov);
        const read = () => { const ti = parseInt(card.querySelector('#pc-town')?.value || '0', 10); const tw = towns[ti] || towns[0]; return { tw, res: card.querySelector('#pc-res')?.value, amount: parseInt(card.querySelector('#pc-amt')?.value || '20', 10), guardId: card.querySelector('#pc-guard')?.value || '', route: card.querySelector('input[name="pc-route"]:checked')?.value || 'road' }; };
        const quote = () => {
            const o = read(); if (!o.tw || !o.res) return;
            const amtEl = card.querySelector('#pc-amt'); const stock = w.stockpile.get(o.res) || 0; if (amtEl) { amtEl.max = Math.max(10, Math.min(200, Math.floor(stock / 10) * 10)); if (o.amount > +amtEl.max) { amtEl.value = amtEl.max; o.amount = +amtEl.max; } }
            card.querySelector('#pc-amt-v').textContent = o.amount;
            const q = w.playerCaravanQuote(o.tw.theme, o.res, o.amount, !!o.guardId, o.route);
            card.querySelector('#pc-quote').innerHTML = `${t('預估賣價')} <b>${q.value}</b> ${t('銀幣')}（${t('成本價')} ${q.base}，+${Math.round(q.margin * 100)}%${q.wanted ? ` · ${t('對方缺這個')}` : ''}）<br>${t('遇劫風險')} <b>${Math.round(q.risk * 100)}%</b> · ${q.days} ${t('天')}${q.fee ? ` · ${t('護衛費')} ${q.fee}` : ''}`;
        };
        card.querySelectorAll('select, input').forEach(el => el.addEventListener('input', quote)); quote();
        ov.addEventListener('click', (e) => {
            if (e.target.closest?.('.pc-go')) {
                const o = read(); if (!o.tw) return;
                const r = w.launchPlayerCaravan({ toTownId: o.tw.id, toTownName: o.tw.name, toTheme: o.tw.theme, res: o.res, amount: o.amount, guardId: o.guardId || null, route: o.route });
                this._showCornerNotice({ icon: r.ok ? '🐪' : '⚠️', title: t('押商隊'), name: '', desc: r.msg });
                if (r.ok) { ov.remove(); this.state = w.getState(); try { this.renderSidebar(); } catch (err) {} }
                return;
            }
            if (e.target.closest?.('.pc-close') || e.target === ov) ov.remove();
        });
    },
    _resLabel(res) { return (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[res]?.name) ? SHOP_ITEMS[res].name() : (res === 'silver' ? t('銀幣') : res); },
    _renderPlayerCaravan() {
        const pc = this.state?.playerCaravan; if (!pc) return '';
        const esc = (x) => this._escapeHtml(String(x));
        let html = `<div class="econ-section"><h3>🐪 ${t('押商隊')}</h3>`;
        if (pc.active) html += `<div style="font-size:0.8rem;line-height:1.7">${pc.active.amount} ${this._resLabel(pc.active.res)} → ${esc(t(pc.active.toTownName))}${pc.active.guardName ? `（${esc(t(pc.active.guardName))}${t('押車')}）` : ''} · ${t('預計')} ${pc.active.daysLeft} ${t('天後回報')}</div>`;
        else html += `<button class="trade-btn" data-action="open-caravan" style="width:100%;padding:8px">🐪 ${t('押一隊商隊去鄰鎮')}</button>`;
        if (pc.history.length) {
            html += `<div style="margin-top:6px;font-size:0.72rem;color:var(--text-secondary)">${t('最近戰績')}</div>`;
            pc.history.forEach(h => { html += `<div style="font-size:0.74rem">${h.raided ? '🏴' : '💰'} ${h.amount} ${this._resLabel(h.res)} → ${esc(t(h.toTownName))}：${h.raided ? `${t('遇劫，損失')} ${h.lost}` : `+${h.silver} ${t('銀幣')}`}</div>`; });
        }
        return html + '</div>';
    },
    async _coachTravelTo(townId, townName) {
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const season = this.world?.clock?.season || '';
        const seasonLine = { '冬季': t('風雪讓路程多花了些時候…'), '夏季': t('蟬聲一路相送…'), '秋季': t('沿途稻浪翻金…'), '春季': t('野花開了一路…') }[season] || '';
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:#0a0e1e;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .6s;overflow:hidden';
        ov.innerHTML = `<div style="animation:coachRide 2.4s ease-in-out forwards">${this._coachPixelSvg(4)}</div>
            <div style="color:#cfd8ea;margin-top:18px;font-size:1rem">${t('馬車顛簸了兩天…')}${seasonLine}</div>
            <div style="color:#8fa8c9;margin-top:8px;font-size:0.85rem">${t('前往')} ${esc(townName)}</div>
            <style>@keyframes coachRide{0%{transform:translateX(42vw)}100%{transform:translateX(-42vw)}}</style>`;
        document.body.appendChild(ov);
        requestAnimationFrame(() => { ov.style.opacity = '1'; });
        await new Promise(r => setTimeout(r, 2600));
        try {
            await this.switchTown(townId);
            // v5.58.1 確認真的切過去了——切換失敗就別演「抵達」
            if (this.currentTownId !== townId) throw new Error(t('找不到目的地的存檔'));
            // 抵達:把玩家放在對方鎮的馬車站,鏡頭跟過去
            const cs = this.tileMap?.coachStation;
            if (cs) {
                const pxx = (cs.x + 1.5) * 16, pyy = (cs.y + cs.h - 1) * 16;
                this.tileMap.agentPositions['player'] = { x: pxx, y: pyy, targetX: pxx, targetY: pyy, job: 'default', gender: 'male', walking: false, walkStep: 0, activity: '', atFarm: false, doorPhase: null };
                this.tileMap._centeredOnPlayer = false;
            }
            this._updateQuestGuidance?.(); // v5.59.0 TC-02:抵達後任務/教學橫幅立即依新鎮重繪,不殘留上一鎮的目標
            this._showCornerNotice({ icon: '🐎', title: `${t('抵達')}${t(townName)}`, name: '', desc: t('下車活動活動筋骨，去鎮上走走吧') });
        } catch (e) {
            this._gameAlert?.(t('旅途出了點問題：') + e.message, '❌');
        }
        ov.style.opacity = '0';
        setTimeout(() => ov.remove(), 700);
    },

    // ============================================================
    // v5.56.0 雙城P1:跨鎮互訪信箱
    // 兩鎮存檔各自獨立,交流靠 localStorage 信箱:出訪寫進對方鎮的
    // 訪客信箱、返鄉見聞寫進原鎮的回鄉信箱,各鎮載入時收信
    // ============================================================
    // v5.63.0 管理員面板:載入玩家列表 / 封鎖 / 解封 / 刪除
    async _adminLoadUsers() {
        const box = document.getElementById('admin-user-list');
        if (box) box.innerHTML = `<span style="color:var(--text-muted)">${t('載入中…')}</span>`;
        try {
            const { users, storage } = await this.auth.adminListUsers();
            const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
            const rows = users.map(u => {
                const name = esc(u.username);
                const status = u.deleted ? `<span style="color:#f87171">${t('已刪除·封鎖中')}</span>`
                    : u.banned ? `<span style="color:#fb923c">${t('封鎖中')}</span>`
                    : u.is_admin ? `<span style="color:#ffd700">${t('管理員')}</span>` : `<span style="color:#34d399">${t('正常')}</span>`;
                const date = u.created_at ? String(u.created_at).slice(0, 10) : '';
                const self = u.username.toLowerCase() === String(this.auth.username).toLowerCase();
                let btns = '';
                if (!self && !u.is_admin) {
                    btns += u.banned
                        ? `<button class="trade-btn" data-action="admin-unban-user" data-val="${name}" style="padding:3px 8px;font-size:0.7rem">${t('解封')}</button>`
                        : `<button class="trade-btn" data-action="admin-ban-user" data-val="${name}" style="padding:3px 8px;font-size:0.7rem">${t('封鎖')}</button>`;
                    if (!u.deleted) btns += ` <button class="trade-btn btn-danger" data-action="admin-delete-user" data-val="${name}" style="padding:3px 8px;font-size:0.7rem">🗑️ ${t('刪除')}</button>`;
                }
                return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
                    <div style="flex:1;min-width:0"><b>${name}</b> ${status}<div style="color:var(--text-muted);font-size:0.68rem">${date}${u.email ? ' · ' + esc(u.email) : ''} · ${t('存檔')} ${u.saves || 0}</div></div>
                    <div style="flex-shrink:0;white-space:nowrap">${btns}</div></div>`;
            });
            // v5.64.0 儲存後端狀態 + 一鍵搬遷按鈕
            let storageHtml = '';
            // v5.96.0 B8:最近七天 AI 用量(Groq / 付費中繼 / 退回次數)
            try {
                const days = await this.auth.adminUsage();
                if (days.length) storageHtml += `<div style="margin-bottom:6px"><div style="color:var(--text-secondary);font-size:0.72rem">${t('🤖 AI 用量（7 天）')}</div>${days.map(d => `<div style="font-size:0.7rem;display:flex;gap:8px"><span style="color:var(--text-muted);width:78px">${d.day}</span><span>Groq ${d.groq || 0}</span><span>${t('中繼')} ${d.relay || 0}</span><span style="color:${(d.fallbacks || 0) ? '#fb923c' : 'var(--text-muted)'}">${t('退回')} ${d.fallbacks || 0}</span><span style="color:${(d.blocked || 0) ? '#f87171' : 'var(--text-muted)'}">${t('額度滿')} ${d.blocked || 0}</span></div>`).join('')}</div>`;
            } catch (e) {}
            if (storage) {
                storageHtml = storageHtml + (storage.backend === 'postgres' ? `<div style="color:#34d399;margin-bottom:6px">${t('💾 儲存：Postgres')}</div>` : `<div style="color:#f87171;margin-bottom:6px">${t('💾 儲存：未設定資料庫（DATABASE_URL）')}</div>`); // v5.82.0 只剩 Postgres
            }
            this._adminUsersHtml = storageHtml + (rows.length ? `<div style="color:var(--text-secondary);margin-bottom:4px">${t('共')} ${users.length} ${t('個帳號')}</div>${rows.join('')}` : `<span style="color:var(--text-muted)">${t('目前沒有其他玩家')}</span>`);
        } catch (e) {
            this._adminUsersHtml = `<span style="color:#f87171">${t('載入失敗：')}${this._escapeHtml ? this._escapeHtml(e.message) : e.message}</span>`;
        }
        if (box) box.innerHTML = this._adminUsersHtml;
    },


    async _adminDo(action, username, confirmText) {
        if (!username) return;
        if (!window.confirm(`${confirmText} ${username}？`)) return;
        try {
            await this.auth.adminAction(action, username);
            this._showCornerNotice({ icon: '🛡️', title: t('管理員操作完成'), name: username, desc: { ban: t('已封鎖'), unban: t('已解除封鎖'), delete: t('帳號與存檔已刪除') }[action] || '' });
            await this._adminLoadUsers();
        } catch (e) {
            this._gameAlert?.(`${t('操作失敗：')}${e.message}`, '❌');
        }
    },

    // v5.62.0 住房同步:告訴地圖誰跟誰是夫妻(只有已婚才同住),並確保
    // 房間數夠「夫妻一間、其他人各一間(+玩家)」——不夠就在空地加蓋小屋。
    // 跟著當前載入的世界跑,邊境鎮/海風鎮切到哪就檢查哪
    _syncHousing() {
        const w = this.world, tm = this.tileMap;
        if (!w || !tm || !tm._houseSubZones || !tm.grid) return;
        const npcs = Object.values(w.agents).filter(a =>
            !a.isPlayer && !a.isDead && !String(a.agentId || '').startsWith('visit_'));
        const byName = {};
        npcs.forEach(a => { byName[a.name] = a.agentId; });
        const partners = {};
        const seen = new Set();
        let couples = 0;
        npcs.forEach(a => {
            const sp = a.relationships?.getSpouse?.();
            const pid = sp ? byName[sp.targetName] : null;
            if (pid && pid !== a.agentId) {
                partners[a.agentId] = pid;
                const key = [a.agentId, pid].sort().join('|');
                if (!seen.has(key)) { seen.add(key); couples++; }
            }
        });
        tm.agentPartners = partners;
        const needed = (npcs.length - couples * 2) + couples + 1; // 單身各一間+夫妻一間+玩家一間
        tm.ensureHouseCapacity?.(needed);
    },

    _visitorMailboxKey(townId) { return 'rimtown_visitors_' + townId; },
    _returnMailboxKey(townId) { return 'rimtown_returns_' + townId; },
    // v5.88.0 日報跨鎮專欄:從其他鎮的本機存檔撈最新一期日報的前兩則要聞(每鎮存檔只在長度改變時重新解析)
    _collectCrossTownNews(towns) {
        const out = [];
        const cache = this._crossNewsCache || (this._crossNewsCache = {});
        for (const tw of towns || []) {
            try {
                const raw = localStorage.getItem('rimtown_town_' + tw.id);
                if (!raw) continue;
                const c = cache[tw.id];
                if (!c || c.len !== raw.length) {
                    const blob = JSON.parse(raw);
                    const papers = blob?.dailyNews?.newspapers || [];
                    const last = papers[papers.length - 1];
                    const items = last ? (last.events || []).slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 2).map(e => e.content).filter(Boolean) : [];
                    cache[tw.id] = { len: raw.length, entry: last && items.length ? { town: blob.townName || tw.name, reporter: last.reporter, year: last.year, season: last.season, day: last.day, items } : null };
                }
                if (cache[tw.id].entry) out.push(cache[tw.id].entry);
            } catch (e) {}
        }
        return out;
    },
    _pushMailbox(key, entry) {
        try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); arr.push(entry); localStorage.setItem(key, JSON.stringify(arr.slice(-10))); } catch (e) {}
    },
    // v5.58.0 海風鎮本來就存在:道路重通(繁榮20)後在背景生成它的存檔——
    // 不用手動建立,馬車直達、兩鎮村民互訪立即可用
    // v5.76.0 泛化成任一主題鄰鎮(海風鎮/礦山鎮…),每個主題只生成一次、絕不自動刪任何存檔
    async _ensureNeighborTown(themeKey = 'harbor') {
        const def = NEIGHBOR_TOWNS.find(d => d.theme === themeKey);
        if (!def) return;
        this._neighborEnsured = this._neighborEnsured && typeof this._neighborEnsured === 'object' ? this._neighborEnsured : {};
        if (this._neighborEnsured[themeKey]) return;
        this._neighborEnsured[themeKey] = true;
        const townName = def.name;
        try {
            let exists = false;
            // v5.74.2 雲端清單沒載到(開機雲端讀取失敗)時先重新拉一次,不然會在已經有海風鎮的帳號再生一個
            if (this.auth.loggedIn && !Array.isArray(this._cloudSaves)) { try { this._cloudSaves = await this.auth.listSaves(); } catch (e) {} }
            if (this.auth.loggedIn && Array.isArray(this._cloudSaves)) exists = this._cloudSaves.some(s => def.match.test(s.town_name || ''));
            if (!exists) exists = this._getTownList().some(tw => def.match.test(tw.name || ''));
            if (exists || (this.world?.townTheme === themeKey)) return;
            const nw = new World();
            nw.townTheme = themeKey;
            nw.townName = townName;
            nw.rosterMode = 'scripted';
            nw.reset();
            const blob = nw.serialize();
            const tid = this._generateTownId(townName);
            const list = this._getTownList();
            if (!list.some(tw => tw.id === tid)) {
                list.push({ id: tid, name: townName, savedAt: new Date().toISOString(), season: blob.clock?.season || '春季', year: 1, day: 1, population: Object.keys(blob.agents || {}).length });
                this._saveTownList(list);
            }
            try { localStorage.setItem('rimtown_town_' + tid, JSON.stringify(blob)); } catch (e) {}
            if (this.auth.loggedIn) {
                try { await this.auth.cloudSave(tid, townName, blob, { season: blob.clock?.season, year: 1, day: 1, population: Object.keys(blob.agents || {}).length }); } catch (e) {}
            }
            this._otherTownsAt = 0; // 立即讓互訪/馬車看見新鄰鎮
        } catch (e) { console.warn('[RimTown] neighbor town gen failed', e); this._neighborEnsured[themeKey] = false; }
    },

    _visitorMailboxTick() {
        const w = this.world; if (!w || !this.currentTownId) return;
        // 道路已通(含老玩家補生成):確保海風鎮存在
        for (const def of NEIGHBOR_TOWNS) { if (localStorage.getItem(def.key) === '1' && !this._neighborEnsured?.[def.theme]) this._ensureNeighborTown(def.theme); } // v5.76.0
        // 掛鉤(冪等,換鎮/換世界後自動指向新世界)
        w.onSendVisitor = (agentData, town, stayDays) => this._pushMailbox(this._visitorMailboxKey(town.id),
            { agentData, stayDays, fromTownId: this.currentTownId, fromTownName: this._getCurrentTownName() });
        w.onVisitorReturn = (meta) => this._pushMailbox(this._returnMailboxKey(meta.fromTownId),
            { origId: meta.origId, origName: meta.origName, notes: meta.notes || [], visitedTownName: this._getCurrentTownName(), visitedTownId: this.currentTownId, romance: meta.romance || null }); // v5.90.0 帶回戀情
        w.onRelocate = (data) => this._doRelocate(data); // v5.90.0 搬家提案的決定
        w.onSeasonRecap = () => { try { this.state = w.getState(); this.renderSidebar(); } catch (e) {} this._showSeasonRecap(); }; // v5.98.0 季末回顧
        w.onGrowthEvent = (kind, v) => { if (kind === 'level') this._showCornerNotice({ icon: '⬆️', title: `${t('旅人升到')} ${v} ${t('級')}`, name: '', desc: t('到「故事」分頁選一個天賦') }); try { this.state = w.getState(); this.renderSidebar(); } catch (e) {} }; // v5.94.0
        w.onTrialEvent = (kind, title, desc) => { this._showCornerNotice({ icon: kind === 'passed' ? '🏅' : kind === 'failed' ? '💔' : '⚖️', title, name: '', desc }); try { this.state = w.getState(); this.renderSidebar(); } catch (e) {} }; // v5.93.0
        w.onPlayerCaravanReturn = (result, line) => { this._showCornerNotice({ icon: result.raided ? '🏴' : '💰', title: t('商隊回報'), name: t(result.toTownName), desc: line }); try { this.state = w.getState(); this.renderSidebar(); } catch (e) {} }; // v5.92.0
        // v5.80.0 跨鎮商隊:角落通知 + 地圖上馬車進城動畫
        w.onCaravan = (info) => {
            const label = (rs) => (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[rs]?.name) ? SHOP_ITEMS[rs].name() : (rs === 'silver' ? t('銀幣') : rs);
            this._showCornerNotice({ icon: '🐪', title: t('跨鎮商隊'), name: t(info.fromName), desc: `${info.giveAmt} ${label(info.give)} → ${info.recvAmt} ${label(info.recv)}${info.hub ? t('（市集城經手，多兩成）') : ''}` });
            try { this.tileMap?.showCaravan?.(`${t(info.fromName)}${t('的商隊')}`); } catch (e) {}
        };
        // 其他城鎮清單(出訪目的地),60 秒更新一次
        // v5.59.0 TC-01 修復:雲端+本地合併(雲端寫入失敗時本地仍可導航)、
        // 排除與當前鎮同名的重複 meta(訪客時期/登入後的殘留)、只列載得到存檔的鎮
        const now = Date.now();
        if (!this._otherTownsAt || now - this._otherTownsAt > 60000) {
            this._otherTownsAt = now;
            const currentName = this._getCurrentTownName();
            const seen = new Set();
            const towns = [];
            const push = (id, name) => {
                if (!id || !name) return;
                const hasLocal = !!localStorage.getItem('rimtown_town_' + id);
                const inCloud = Array.isArray(this._cloudSaves) && this._cloudSaves.some(s => s.town_id === id);
                if (!hasLocal && !inCloud) return;
                // v5.59.5 名字以本地存檔「內」的鎮名為準:meta 名字曾被錯寫成「邊境鎮」,
                // 會把海風鎮的分身當成回程目的地(每 id 只解析一次,結果快取整個 session)
                if (hasLocal) {
                    const cache = this._blobNameCache || (this._blobNameCache = {});
                    if (!(id in cache)) { try { cache[id] = JSON.parse(localStorage.getItem('rimtown_town_' + id))?.townName || null; } catch (e) { cache[id] = null; } }
                    if (cache[id]) name = cache[id];
                }
                // v5.59.5 也用世界鎮名擋自己:meta id 分裂時,同名的「自己」不再混進出訪名單
                if (id === this.currentTownId || name === currentName || name === w.townName) return;
                if (seen.has(name)) return;
                seen.add(name);
                towns.push({ id, name });
            };
            try {
                (Array.isArray(this._cloudSaves) ? this._cloudSaves : []).forEach(s => push(s.town_id, s.town_name));
                this._getTownList().forEach(tw => push(tw.id, tw.name));
            } catch (e) {}
            w.otherTowns = towns;
            w.crossTownNews = this._collectCrossTownNews(towns); // v5.88.0 日報跨鎮專欄素材
        }
        // 收訪客信箱:對方鎮派來的村民實體化
        try {
            const vk = this._visitorMailboxKey(this.currentTownId);
            const varr = JSON.parse(localStorage.getItem(vk) || '[]');
            if (varr.length) {
                localStorage.removeItem(vk);
                varr.forEach(e => {
                    try {
                        const ag = w.spawnVisitor(e);
                        if (ag) {
                            this._showCornerNotice({ icon: '🚌', title: t('遠客來訪'), name: '', desc: `${t(e.agentData?.name)}${t('（')}${e.fromTownName}${t('）來作客了，去打個招呼吧')}` });
                            // v5.59.0 TC-04:聊天分頁開著時清單立即刷新,訪客馬上可私訊
                            this.state = w.getState();
                            if (this.activeTab === 'chat') this.renderSidebar();
                        }
                    } catch (err) {}
                });
            }
        } catch (e) {}
        // 收回鄉信箱:本尊回來後把外地見聞灌進記憶(還在路上就留著下次收)
        try {
            const rk = this._returnMailboxKey(this.currentTownId);
            const rarr = JSON.parse(localStorage.getItem(rk) || '[]');
            if (rarr.length) {
                const keep = [];
                rarr.forEach(e => {
                    const ag = w.agents[e.origId];
                    if (!ag) { keep.push(e); return; }
                    (e.notes || []).slice(0, 3).forEach(nt => ag.memory?.add?.(w.tickCount, w.clock.timeStr, 'travel', `${t('在')}${e.visitedTownName}${t('時：')}${nt}`, 6, []));
                    w.logMessage('arrival', `${t(ag.name)}${t('從')}${e.visitedTownName}${t('回來了，帶回一肚子見聞。')}`);
                    if (e.romance) { if (!this._offerRelocation(w, ag, e)) { /* 另一個事件還掛著:下次再提 */ if (w.eventChoice?.pendingEvent && !w.eventChoice.pendingEvent.autoResolve) keep.push({ ...e, notes: [] }); } } // v5.90.0
                });
                if (keep.length) localStorage.setItem(rk, JSON.stringify(keep)); else localStorage.removeItem(rk);
            }
        } catch (e) {}
        // v5.90.0 收搬家信箱:別的鎮決定了搬家——有人搬來(in)或本鎮的人被接走(out)
        try {
            const mk = this._movesMailboxKey(this.currentTownId);
            const marr = JSON.parse(localStorage.getItem(mk) || '[]');
            if (marr.length) {
                localStorage.removeItem(mk);
                marr.forEach(e => {
                    try {
                        if (e.kind === 'in' && e.agentData) {
                            const ag = w.spawnResident(e.agentData, { fromTownId: e.fromTownId, fromTownName: e.fromTownName, partnerId: e.partnerId, partnerName: e.partnerName });
                            if (ag) this._showCornerNotice({ icon: '🏡', title: t('新居民搬來'), name: t(ag.name), desc: `${t('從')}${t(e.fromTownName || '')}${t('搬來，和')}${t(e.partnerName || '')}${t('在一起了')}` });
                        } else if (e.kind === 'out' && e.agentId) {
                            const snap = w.relocateOut(e.agentId, { toTownName: e.toTownName, partnerName: e.partnerName });
                            if (snap) this._showCornerNotice({ icon: '🧳', title: t('居民搬走了'), name: t(snap.name), desc: `${t('為了')}${t(e.partnerName || '')}${t('搬去')}${t(e.toTownName || '')}` });
                        }
                    } catch (err) {}
                });
                this.state = w.getState(); try { this._syncHousing?.(); } catch (err) {}
            }
        } catch (e) {}
    },
    _movesMailboxKey(townId) { return 'rimtown_moves_' + townId; },
    // ============================================================
    // v5.91.0 委託板(README H1):故事分頁區塊、按鈕動作、徽章與早上通知
    // ============================================================
    // v5.97.0 昨日結算一句話:委託完成/失敗、經驗、商隊回報、考驗進度
    _daySummaryText() {
        const w = this.world; const rb = w?.requests; const ld = rb?.lastDay; if (!ld) return '';
        const parts = [`${t('委託')} ${ld.done}/${ld.total}${ld.failed ? `（${t('過期')} ${ld.failed}）` : ''}`];
        const yday = (w.clock.day > 1 ? w.clock.day - 1 : (w.clock.DAYS_PER_SEASON || 15));
        const xp = (w.growth?.log || []).filter(e => e.day === yday).reduce((a, e) => a + (e.n || 0), 0); if (xp) parts.push(`${t('經驗')} +${xp}`);
        const abs = w._absDay?.() || 0; const cv = (w.playerCaravan?.history || []).find(h => h.resolvedAbsDay === abs - 1); if (cv) parts.push(cv.raided ? t('商隊遇劫') : `${t('商隊')} +${cv.silver}`);
        const tr = w.trials?.current; if (tr && w.trials.value) { const v = w.trials.value(tr.type, w); parts.push(`${t('考驗')} ${Math.min(100, Math.round(v / Math.max(1, tr.target) * 100))}%`); }
        return parts.join(' · ');
    },
    _renderRequestBoard() {
        const rb = this.world?.requests; if (!rb) return '';
        const d = rb.toDict(this.world);
        const pips = Array.from({ length: d.ap.max }, (_, i) => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:3px;background:${i < d.ap.left ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}"></span>`).join('');
        let html = `<div class="econ-section"><h3>📋 ${t('今日委託')} <span style="font-size:0.7rem;color:var(--text-secondary);font-weight:400">${t('連續全數完成')} ${d.stats.streak} ${t('天')}</span></h3>`;
        html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><div><span style="font-size:0.75rem;color:var(--text-secondary)">${t('行動點')} ${d.ap.left}/${d.ap.max}</span><div style="margin-top:3px">${pips}</div></div>
            <button class="trade-btn" data-action="req-buy-ap" style="font-size:0.7rem" ${d.ap.bought >= 2 ? 'disabled' : ''}>💰 ${t('買 1 點')}（30）</button></div>`;
        const sum = this._daySummaryText(); if (sum) html += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:6px">🌙 ${t('昨日結算')}：${this._escapeHtml(sum)}</div>`; // v5.97.0
        if (!d.board.length) html += `<p class="muted-text" style="font-size:0.78rem">${t('今天還沒有委託，明天早上村民會來找你。')}</p>`;
        for (const r of d.board) {
            const dim = r.status !== 'open';
            const rw = r.reward || {};
            const rwText = [rw.silver ? `💰${rw.silver}` : '', rw.pack ? `${t(REQUEST_RES_NAMES[rw.pack.res] || rw.pack.res)}+${rw.pack.amount}` : '', rw.aff ? `❤️+${rw.aff}` : '', rw.rep ? `⭐+${rw.rep}` : ''].filter(Boolean).join(' ');
            html += `<div class="news-card" style="margin-bottom:6px;${dim ? 'opacity:0.55' : ''}"><div style="display:flex;gap:8px;align-items:flex-start">
                <span style="font-size:1.1rem;flex:none">${r.icon}</span>
                <div style="flex:1;min-width:0"><div style="font-size:0.82rem">${this._escapeHtml(r.text)}</div>
                    <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px">${this._escapeHtml(r.progress || '')}${r.progress ? ' · ' : ''}${rwText} · ${t('耗')} ${r.apCost} ${t('點')}</div></div>
                ${rb.needsButton(r) ? `<button class="trade-btn" data-action="req-act" data-val="${r.id}" style="font-size:0.7rem;flex:none" ${r.can?.ok ? '' : 'disabled'} title="${this._escapeHtml(r.can?.reason || '')}">${r.type === 'mediate' ? `🤝 ${t('調解')}` : `📦 ${t('交付')}`}</button>` : (r.status === 'done' ? '<span style="flex:none">✅</span>' : r.status === 'failed' ? '<span style="flex:none">⌛</span>' : '')}
            </div>${rb.needsButton(r) && !r.can?.ok && r.can?.reason ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:4px">↳ ${this._escapeHtml(r.can.reason)}</div>` : ''}</div>`;
        }
        html += '</div>';
        return html;
    },
    // v5.94.0 旅人成長區塊:等級/經驗/屬性/天賦,升級後三選一
    _renderGrowth() {
        const g = this.state?.growth; if (!g) return '';
        const esc = (x) => this._escapeHtml(String(x));
        const AT = { charm: t('魅力值'), vigor: t('體力值'), wit: t('機智值'), grit: t('毅力值') };
        let html = `<div class="econ-section"><h3>🧭 ${t('旅人')} · Lv.${g.level}</h3>
            <div class="bar" style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden"><div style="width:${g.pct}%;height:100%;background:var(--accent)"></div></div>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:3px">${t('經驗')} ${g.xp}/${g.next} · ${g.attrs.map(a => `${AT[a.key]} ${a.base}${a.bonus ? `<span style="color:var(--positive,#4ade80)">+${a.bonus}</span>` : ''}`).join(' · ')}</div>`;
        if (g.pending.length) {
            html += `<div style="font-size:0.8rem;margin-top:8px">⬆️ ${t('升級了！選一個天賦')}${g.pendingLevels > 1 ? `（${t('還有 {n} 次').replace('{n}', g.pendingLevels)}）` : ''}</div><div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">`;
            g.pending.forEach(p => { html += `<button class="trade-btn" data-action="perk-pick" data-val="${p.id}" style="flex:1;min-width:90px;text-align:left;padding:6px 8px;font-size:0.72rem;line-height:1.4">${p.icon} <b>${esc(p.name)}</b><br><span style="color:var(--text-secondary)">${esc(p.desc)}</span></button>`; });
            html += '</div>';
        }
        if (g.perks.length) html += `<div style="font-size:0.74rem;margin-top:6px">${g.perks.map(p => `<span title="${esc(p.desc)}">${p.icon} ${esc(p.name)}</span>`).join(' · ')}</div>`;
        else if (!g.pending.length) html += `<div class="muted-text" style="font-size:0.72rem;margin-top:4px">${t('完成委託、撐過考驗、押商隊、推進故事都會累積經驗；每升一級選一個天賦。')}</div>`;
        return html + '</div>';
    },
    // v5.93.0 季度考驗區塊
    _renderSeasonTrial() {
        const tr = this.state?.trials; if (!tr) return '';
        const esc = (x) => this._escapeHtml(String(x));
        let html = `<div class="econ-section"><h3>⚖️ ${t('本季考驗')}${tr.failStreak ? ` <span style="font-size:0.7rem;color:var(--negative);font-weight:400">${t('已連續失敗')} ${tr.failStreak} ${t('季')}</span>` : ''}</h3>`;
        if (tr.current) {
            const c = tr.current; const col = c.pct >= 100 ? 'var(--positive, #4ade80)' : c.pct >= 60 ? 'var(--accent)' : 'var(--negative, #f87171)';
            html += `<div style="font-size:0.82rem">${c.icon} <b>${esc(c.title)}</b> · ${t('剩')} ${c.daysLeft} ${t('天')}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin:3px 0">${esc(c.goal)}</div>
                <div class="bar" style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden"><div style="width:${c.pct}%;height:100%;background:${col}"></div></div>
                <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:3px">${c.value} / ${c.target} ${esc(c.unit)} · ${t('撐過可得')}「${esc(c.perkName)}」：${esc(c.perkDesc)}</div>`;
        } else {
            html += `<div class="muted-text" style="font-size:0.78rem">${t('每季第 5 天公布這一季的考驗，季末結算：撐過有永久加成，沒撐過會有人搬走。')}</div>`;
        }
        if (tr.perks.length) html += `<div style="font-size:0.72rem;margin-top:6px">🏅 ${t('已得到')}：${tr.perks.map(p => `<b>${esc(p.name)}</b>`).join('、')}</div>`;
        if (tr.history.length) html += `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px">${tr.history.map(h => `${h.status === 'passed' ? '✅' : '❌'} ${esc(h.title)} ${h.value}/${h.target}`).join(' · ')}</div>`;
        if (this.state?.recap?.last) html += `<button class="trade-btn" data-action="recap-open" style="width:100%;padding:6px;margin-top:8px;font-size:0.78rem">📜 ${t('上一季回顧')}：${esc(this.state.recap.last.title)} · ${t('評等')} ${esc(this.state.recap.last.grade)}</button>`; // v5.98.0
        return html + '</div>';
    },
    _requestAct(id) {
        const rb = this.world?.requests; if (!rb) return;
        const r = rb.act(id, this.world);
        this._showCornerNotice({ icon: r.ok ? '✅' : '⚠️', title: r.ok ? t('委託') : t('還不能交付'), name: '', desc: r.msg || '' });
        this.state = this.world.getState(); try { this.renderSidebar(); } catch (e) {} this._updateRequestBadge();
    },
    _requestBuyAP() {
        const rb = this.world?.requests; if (!rb) return;
        const r = rb.buyAP(this.world);
        this._showCornerNotice({ icon: r.ok ? '💰' : '⚠️', title: t('行動點'), name: '', desc: r.msg || '' });
        this.state = this.world.getState(); try { this.renderSidebar(); } catch (e) {}
    },
    _updateRequestBadge() {
        const rb = this.world?.requests; if (!rb) return;
        try { rb.checkPassive(this.world); } catch (e) {} // v5.97.0 考驗衝刺被動達標
        if (this.world?.recap?.pendingShow) { this.world.recap.pendingShow = false; try { this._showSeasonRecap(); } catch (e) {} } // v5.98.0 讀檔回來還沒看過的季末回顧
        const n = rb.openCount();
        document.querySelectorAll('[data-tab="quest"]').forEach(tab => {
            let badge = tab.querySelector('.chat-badge');
            if (n > 0) { if (!badge) { badge = document.createElement('span'); badge.className = 'chat-badge'; tab.style.position = 'relative'; tab.appendChild(badge); } badge.textContent = n > 9 ? '9+' : n; }
            else if (badge) badge.remove();
        });
        if (rb.dayKey && rb._lastNoticeDay !== rb.dayKey && n > 0) {
            rb._lastNoticeDay = rb.dayKey;
            // v5.97.0 昨日結算:先報昨天,再報今天
            const sum = this._daySummaryText(); if (sum) this._showCornerNotice({ icon: '🌙', title: t('昨日結算'), name: '', desc: sum });
            this._showCornerNotice({ icon: '📋', title: t('今日委託'), name: `${n} ${t('件')}`, desc: `${t('行動點')} ${rb.ap.left}/${rb.ap.max} · ${t('到「故事」分頁查看')}` });
        }
    },
    // v5.90.0 搬家提案:村民作客回來後,和對方鎮某人兩情相悅→事件選擇(讓對方搬來/讓他搬過去/不干涉);三天不選就依兩人意願自動定案
    _offerRelocation(w, ag, e) {
        const r = e.romance; if (!r || !r.localData) return true;
        if (!localStorage.getItem('rimtown_town_' + e.visitedTownId)) return true; // 對方鎮不在本機:不提案(對方存檔改不到)
        if (w.eventChoice?.pendingEvent) return false;
        const full = Object.values(w.agents).filter(a => !a.isPlayer).length >= 30;
        const base = { romance: r, otherTownId: e.visitedTownId, otherTownName: e.visitedTownName, residentId: ag.agentId, residentName: ag.name };
        const choices = [];
        if (!full) choices.push({ label: t('讓對方搬來'), icon: '🏡', desc: `${t(r.localName)}${t('搬來本鎮，兩人在這裡交往')}`, effects: { relocate: { ...base, mode: 'in' } } });
        choices.push({ label: t('讓他搬過去'), icon: '🧳', desc: t('{a} 搬去 {b}，和 {c} 在一起').replace(/\{a\}/g, t(ag.name)).replace(/\{b\}/g, t(e.visitedTownName)).replace(/\{c\}/g, t(r.localName)), effects: { relocate: { ...base, mode: 'out' } } });
        choices.push({ label: t('不干涉'), icon: '🤷', desc: t('順其自然，兩人隔著一條路想念彼此'), effects: { relocate: { ...base, mode: 'none' } } });
        w.eventChoice.pendingEvent = {
            eventName: `${t('搬家提案：')}${t(ag.name)}${t('與')}${t(r.localName)}`,
            description: t('{a} 從 {b} 回來後魂不守舍——作客那幾天他和 {c} 走得很近，兩人都捨不得分開。要怎麼辦？（三天內不決定，就依兩人的意思自己安排）').replace(/\{a\}/g, t(ag.name)).replace(/\{b\}/g, t(e.visitedTownName)).replace(/\{c\}/g, t(r.localName)),
            severity: 'minor', choices, timestamp: w.tickCount,
            autoResolve: { absDay: w._absDay() + 3, choice: Math.random() < 0.5 ? 0 : Math.min(1, choices.length - 2) },
        };
        w.logMessage('event_choice', `💌 ${t('搬家提案：')}${t(ag.name)}${t('與')}${t(r.localName)}${t('想住在同一個鎮上，等你決定。')}`);
        this._showCornerNotice({ icon: '💌', title: t('搬家提案'), name: `${t(ag.name)} ♥ ${t(r.localName)}`, desc: t('到「事件」決定讓誰搬家') });
        return true;
    },
    _doRelocate(data) {
        const w = this.world; if (!w || !data) return;
        const r = data.romance || {};
        try {
            if (data.mode === 'in') {
                const ag = w.spawnResident(r.localData, { fromTownId: data.otherTownId, fromTownName: data.otherTownName, partnerId: data.residentId, partnerName: data.residentName });
                if (ag) this._pushMailbox(this._movesMailboxKey(data.otherTownId), { kind: 'out', agentId: r.localId, toTownName: this._getCurrentTownName(), partnerName: data.residentName });
                else { w.logMessage('event_choice', `⚠️ ${t('鎮上人口已滿，')}${t(r.localName)}${t('暫時搬不過來。')}`); }
            } else if (data.mode === 'out') {
                const snap = w.relocateOut(data.residentId, { toTownName: data.otherTownName, partnerName: r.localName });
                if (snap) this._pushMailbox(this._movesMailboxKey(data.otherTownId), { kind: 'in', agentData: snap, fromTownId: this.currentTownId, fromTownName: this._getCurrentTownName(), partnerId: r.localId, partnerName: r.localName });
            } else {
                const ag = w.agents[data.residentId];
                ag?.memory?.add?.(w.tickCount, w.clock.timeStr, 'romance', `${t('鎮長沒有插手，我和')}${r.localName}${t('只能隔著一條路想念彼此。')}`, 7, [r.localName]);
                w.logMessage('event_choice', `🤷 ${t('你決定不干涉')}${t(data.residentName)}${t('與')}${t(r.localName)}${t('的事。')}`);
            }
        } catch (e) { console.warn('[relocate]', e); }
        this.state = w.getState(); try { this._syncHousing?.(); } catch (e) {} try { this.renderSidebar(); } catch (e) {}
    },
});
