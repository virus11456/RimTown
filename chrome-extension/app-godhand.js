// RimTown - app-godhand.js（v6.48.0）：事件卡獨立介面「上帝之手」。
// 事件卡是觀察者唯一能出手的地方，以前埋在「事件」分頁裡。現在地圖上有一顆 🃏 按鈕（顯示今天還能打幾張），
// 點開是一副手牌：桌機浮在地圖下方（卡牌一列＋右邊詳情），手機是底部抽屜（卡牌橫向滑動＋下方詳情與大按鈕）。
// 選卡看說明與效果、按「打出」；打出後抽屜收起、鏡頭帶到現場；村民反應累積在「反應追蹤」分頁，按鈕上會亮紅點。
// 快捷鍵：E 開關、Esc 關閉、←→ 換卡、Enter 打出。用 Object.assign 掛到 RimTownApp.prototype（放在 app-loop.js 之後）。
'use strict';
Object.assign(RimTownApp.prototype, {
    _ghData() { const w = this.world; try { return w?.eventCards ? w.eventCards.toDict(w) : null; } catch (e) { return null; } },
    _ghIsMobile() { return window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : window.innerWidth <= 768; },
    // 建立地圖上的按鈕與抽屜(只建一次)
    _ghEnsure() {
        const host = document.getElementById('rimtown-app'); if (!host || !this.world?.eventCards) return;
        if (!document.getElementById('gh-fab')) {
            const fab = document.createElement('button');
            fab.id = 'gh-fab'; fab.className = 'gh-fab'; fab.type = 'button';
            fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-controls', 'gh-tray');
            fab.innerHTML = `<span class="gh-fab-ic" aria-hidden="true">🃏</span><span class="gh-fab-txt">${t('事件卡')}</span><span class="gh-fab-n"></span><span class="gh-fab-dot" hidden></span>`;
            fab.addEventListener('click', (e) => { e.stopPropagation(); this._ghToggle(); });
            host.appendChild(fab);
        }
        if (!document.getElementById('gh-tray')) {
            const tray = document.createElement('div');
            tray.id = 'gh-tray'; tray.className = 'gh-tray'; tray.setAttribute('role', 'dialog'); tray.setAttribute('aria-label', t('事件卡')); tray.hidden = true;
            tray.addEventListener('click', (e) => this._ghClick(e));
            host.appendChild(tray);
            document.addEventListener('keydown', (e) => this._ghKey(e));
            window.addEventListener('resize', () => { this._ghFab(); if (this._ghOpen) this._ghPlace(); });
        }
        this._ghFab();
    },
    _ghFab() {
        const fab = document.getElementById('gh-fab'); if (!fab) return; const d = this._ghData(); if (!d) { fab.hidden = true; return; }
        fab.hidden = false;
        // 桌機:放在地圖區右下角(左下角有操作提示);手機交給 CSS
        if (!this._ghIsMobile()) { const a = this._ghArea(); fab.style.left = 'auto'; fab.style.right = Math.max(12, window.innerWidth - a.right + 16) + 'px'; } else { fab.style.left = ''; fab.style.right = ''; }
        const n = fab.querySelector('.gh-fab-n'); if (n) n.textContent = `${d.todayLeft}/${d.perDay}`;
        fab.classList.toggle('is-empty', d.todayLeft <= 0);
        const reacts = (d.played || []).reduce((s, e) => s + (e.reactions?.length || 0), 0);
        const dot = fab.querySelector('.gh-fab-dot'); if (dot) dot.hidden = !(reacts > (this._ghSeenReacts || 0) && !this._ghOpen);
        fab.setAttribute('aria-expanded', this._ghOpen ? 'true' : 'false');
        fab.title = t('事件卡：今天還能打 {n} 張（E）').replace('{n}', d.todayLeft);
    },
    _ghToggle(force) { const open = force !== undefined ? force : !this._ghOpen; open ? this._ghShow() : this._ghHide(); },
    _ghShow() {
        this._ghEnsure(); const tray = document.getElementById('gh-tray'); if (!tray) return;
        this._ghOpen = true; this._ghTab = this._ghTab || 'hand';
        const d = this._ghData(); if (!this._ghSel || !d?.hand?.some(c => c.id === this._ghSel)) { const first = d?.hand?.find(c => c.left <= 0) || d?.hand?.[0]; this._ghSel = first?.id || null; }
        this._ghRender(); tray.hidden = false; this._ghPlace();
        requestAnimationFrame(() => { tray.classList.add('open'); tray.querySelector('.gh-card.sel')?.focus({ preventScroll: true }); this._ghScrollSel(); });
        this._ghFab();
    },
    _ghHide() {
        const tray = document.getElementById('gh-tray'); this._ghOpen = false; if (!tray) return;
        tray.classList.remove('open'); setTimeout(() => { if (!this._ghOpen) tray.hidden = true; }, 220);
        this._ghFab(); document.getElementById('gh-fab')?.focus?.({ preventScroll: true });
    },
    // 桌機:浮在地圖下方(對齊地圖區);手機:CSS 處理成底部抽屜
    // 桌機可用的地圖範圍:地圖區扣掉浮在右邊的側欄
    _ghArea() {
        const map = document.querySelector('.map-panel'); const r = map?.getBoundingClientRect(); let left = r?.width ? r.left : 0, right = r?.width ? r.right : window.innerWidth;
        const sb = document.getElementById('rimtown-sidebar') || document.querySelector('.sidebar');
        const s = sb?.getBoundingClientRect(); if (s && s.width > 0 && s.height > 0 && getComputedStyle(sb).display !== 'none' && s.left > left + 200 && s.left < right) right = s.left;
        return { left, right, width: right - left };
    },
    _ghPlace() {
        const tray = document.getElementById('gh-tray'); if (!tray) return;
        if (this._ghIsMobile()) { tray.style.left = ''; tray.style.width = ''; return; }
        const a = this._ghArea(); const w = Math.max(320, Math.min(920, a.width - 32)); tray.style.width = w + 'px'; tray.style.left = (a.left + Math.max(16, (a.width - w) / 2)) + 'px';
    },
    _ghRefresh() { if (this._ghOpen) { this._ghRender(); } this._ghFab(); },
    _ghRender() {
        const tray = document.getElementById('gh-tray'); const d = this._ghData(); if (!tray || !d) return;
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const cats = (typeof EVENT_CARD_CATS !== 'undefined') ? EVENT_CARD_CATS : {};
        const f = this._ghFilter || 'all';
        const reacts = (d.played || []).reduce((s, e) => s + (e.reactions?.length || 0), 0);
        if (this._ghTab === 'track') this._ghSeenReacts = reacts;
        const newR = Math.max(0, reacts - (this._ghSeenReacts || 0));
        let html = `<div class="gh-grab" aria-hidden="true"></div>
            <div class="gh-head">
                <div class="gh-title">🃏 ${t('事件卡')}<span class="gh-left ${d.todayLeft ? '' : 'none'}">${t('今天還能打')} <b>${d.todayLeft}</b>/${d.perDay}</span></div>
                <div class="gh-tabs" role="tablist">
                    <button role="tab" aria-selected="${this._ghTab === 'hand'}" class="${this._ghTab === 'hand' ? 'on' : ''}" data-gh="tab" data-v="hand">${t('手牌')}</button>
                    <button role="tab" aria-selected="${this._ghTab === 'track'}" class="${this._ghTab === 'track' ? 'on' : ''}" data-gh="tab" data-v="track">${t('反應追蹤')}${newR ? `<span class="gh-badge">${newR}</span>` : ''}</button>
                </div>
                <button class="gh-help${this._ghIntroOpen() ? ' on' : ''}" data-gh="help" aria-label="${t('事件卡是什麼？')}" aria-expanded="${this._ghIntroOpen()}" title="${t('事件卡是什麼？')}">?</button>
                <button class="gh-x" data-gh="close" aria-label="${t('關閉')}">✕</button>
            </div>`;
        // v6.50.0 第一次打開(或按 ?)先說明事件卡是做什麼的
        if (this._ghIntroOpen()) html += `<div class="gh-intro" role="note">
                <div class="gh-intro-t">🃏 ${t('事件卡是什麼？')}</div>
                <p>${t('你不在鎮上，只在天上看著村民過日子。事件卡是你唯一能「動手」的地方：打出一張，就讓一件事發生在鎮上，然後看村民怎麼反應。')}</p>
                <ul>
                    <li>🌪️ ${t('天災、🕳️ 人禍、🍀 機運、💞 人際四類；每張卡下方寫著會發生什麼')}</li>
                    <li>⏳ ${t('每天最多打 {n} 張，打過的卡要冷卻幾天才能再用').replace('{n}', d.perDay)}</li>
                    <li>💬 ${t('村民會聊這件事、記在心裡、跟著提出提案；「反應追蹤」會記下他們的反應和七天後的變化')}</li>
                </ul>
                <button class="gh-intro-ok" data-gh="help-ok">${t('知道了，看手牌')}</button>
            </div>`;
        if (this._ghIntroOpen()) { tray.innerHTML = html; return; } // 說明頁取代手牌,不擠在一起
        if (this._ghTab === 'track') {
            html += `<div class="gh-track">`;
            if (!d.played?.length) html += `<div class="gh-empty">📼 ${t('還沒打過事件卡。打出一張，村民接下來幾天的反應、提案和七天後的變化都會記在這裡。')}</div>`;
            for (const e of (d.played || [])) {
                html += `<div class="gh-tr gh-${e.cat}"><div class="gh-tr-head"><span>${e.icon} <b>${esc(e.name)}</b></span><span class="gh-when">${e.daysAgo === 0 ? t('今天') : t('{n} 天前').replace('{n}', e.daysAgo)}</span></div>
                    <div class="gh-tr-detail">${esc(e.detail)}</div>
                    ${e.reactions.length ? e.reactions.map(r => `<div class="gh-react"><button class="gh-who" data-gh="agent" data-v="${esc(r.agentId)}">${esc(t(r.name))}</button>${esc(r.text)}</div>`).join('') : `<div class="gh-react muted">${t('村民還在消化這件事…')}</div>`}
                    ${e.proposals?.length ? `<div class="gh-props">📜 ${t('事後三天內的提案')}${t('：')}${e.proposals.map(p => esc(p.id + ' ' + p.title)).join(t('、'))}</div>` : ''}
                    ${e.outcomeText ? `<div class="gh-out">📈 ${t('七天後')}${t('：')}${esc(e.outcomeText)}</div>` : ''}
                </div>`;
            }
            html += `</div>`;
            tray.innerHTML = html; return;
        }
        html += `<div class="gh-filters" role="toolbar"><button class="${f === 'all' ? 'on' : ''}" data-gh="filter" data-v="all">${t('全部')}</button>${Object.entries(cats).map(([k, c]) => `<button class="gh-f-${k} ${f === k ? 'on' : ''}" data-gh="filter" data-v="${k}">${c.icon} ${t(c.label)}</button>`).join('')}<button class="gh-rand" data-gh="random" ${d.todayLeft ? '' : 'disabled'}>🎲 ${t('隨機打一張')}</button></div>`;
        const list = d.hand.filter(c => f === 'all' || c.cat === f);
        if (!list.some(c => c.id === this._ghSel)) this._ghSel = (list.find(c => c.left <= 0) || list[0])?.id || null;
        html += `<div class="gh-body"><div class="gh-hand" role="listbox" aria-label="${t('手牌')}">`;
        for (const c of list) {
            const blocked = c.left > 0 || c.dailyFull, sel = c.id === this._ghSel;
            html += `<button class="gh-card gh-${c.cat}${sel ? ' sel' : ''}${blocked ? ' blocked' : ''}" role="option" aria-selected="${sel}" data-gh="sel" data-v="${c.id}">
                <span class="gh-band">${c.catIcon} ${esc(c.catLabel)}</span>
                <span class="gh-ic" aria-hidden="true">${c.icon}</span>
                <span class="gh-nm">${esc(c.name)}</span>
                ${c.left > 0 ? `<span class="gh-cd">⏳ ${c.left}${t('天')}</span>` : ''}
            </button>`;
        }
        html += `</div>`;
        const cur = list.find(c => c.id === this._ghSel);
        if (cur) {
            const blocked = cur.left > 0 || cur.dailyFull;
            const why = cur.left > 0 ? t('冷卻中，還要 {n} 天').replace('{n}', cur.left) : cur.dailyFull ? t('今天的兩張已經打完，明天再來') : t('打出後鏡頭會帶到現場；村民接下來幾天的反應會出現在「反應追蹤」。');
            html += `<div class="gh-detail gh-${cur.cat}">
                <div class="gh-d-head"><span class="gh-d-ic" aria-hidden="true">${cur.icon}</span><div><div class="gh-d-nm">${esc(cur.name)}</div><div class="gh-d-meta">${cur.catIcon} ${esc(cur.catLabel)} · ${t('冷卻')} ${cur.cd} ${t('天')}</div></div></div>
                <div class="gh-d-desc">${esc(cur.desc)}</div>
                <div class="gh-d-fx">⚡ ${esc(cur.effect)}</div>
                <button class="gh-play" data-gh="play" data-v="${cur.id}" ${blocked ? 'disabled aria-disabled="true"' : ''}>🃏 ${t('打出')}</button>
                <div class="gh-d-note">${esc(why)}</div>
            </div>`;
        }
        html += `</div>`;
        tray.innerHTML = html;
    },
    _ghIntroOpen() { if (this._ghIntro != null) return this._ghIntro; try { return localStorage.getItem('rimtown_gh_intro') !== '1'; } catch (e) { return true; } },
    _ghIntroSeen() { try { localStorage.setItem('rimtown_gh_intro', '1'); } catch (e) {} },
    _ghScrollSel() { const el = document.querySelector('#gh-tray .gh-card.sel'); if (el) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); },
    _ghClick(e) {
        const b = e.target.closest('[data-gh]'); if (!b) return; e.stopPropagation();
        const k = b.dataset.gh, v = b.dataset.v;
        if (k === 'close') return this._ghHide();
        if (k === 'help') { this._ghIntro = !this._ghIntroOpen(); if (!this._ghIntro) this._ghIntroSeen(); this._ghRender(); return; }
        if (k === 'help-ok') { this._ghIntro = false; this._ghIntroSeen(); this._ghRender(); return; }
        if (k === 'tab') { this._ghTab = v; this._ghRender(); return; }
        if (k === 'filter') { this._ghFilter = v; this._ghRender(); this._ghScrollSel(); return; }
        if (k === 'sel') { this._ghSel = v; this._ghRender(); document.querySelector('#gh-tray .gh-card.sel')?.focus({ preventScroll: true }); this._ghScrollSel(); return; }
        if (k === 'play') return this._ghPlay(v);
        if (k === 'random') { const d = this._ghData(); const h = (d?.hand || []).filter(c => c.left <= 0 && !c.dailyFull); if (h.length) this._ghPlay(h[Math.floor(Math.random() * h.length)].id); return; }
        if (k === 'agent') { this._ghHide(); try { this.selectedAgent = v; this._goLook?.({ agentId: v }); this.renderSidebar?.(); } catch (err) {} }
    },
    _ghPlay(id) {
        const before = this._ghData()?.todayLeft;
        this._playEventCard(id);
        const after = this._ghData()?.todayLeft;
        if (after < before) { this._ghHide(); } else this._ghRender();
        this._ghFab();
    },
    _ghKey(e) {
        const tag = (e.target?.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
        if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) { if (!this.world?.eventCards || !this.world.observerMode) return; e.preventDefault(); this._ghToggle(); return; } // 非觀察者模式的 E 是「和身邊的人說話」,不搶
        if (!this._ghOpen) return;
        if (e.key === 'Escape') { e.preventDefault(); this._ghHide(); return; }
        if (this._ghTab !== 'hand') return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const d = this._ghData(); const f = this._ghFilter || 'all'; const list = (d?.hand || []).filter(c => f === 'all' || c.cat === f); const i = list.findIndex(c => c.id === this._ghSel);
            const n = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; if (n) { e.preventDefault(); this._ghSel = n.id; this._ghRender(); document.querySelector('#gh-tray .gh-card.sel')?.focus({ preventScroll: true }); this._ghScrollSel(); }
        } else if (e.key === 'Enter' && document.activeElement?.closest?.('#gh-tray .gh-card')) { e.preventDefault(); this._ghPlay(this._ghSel); }
    },
});
