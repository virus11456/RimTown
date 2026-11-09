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
            tray.addEventListener('input', (e) => this._ghLabInput(e)); tray.addEventListener('change', (e) => this._ghLabInput(e)); // v7.9.0 災厄工坊的輸入框、選單
            host.appendChild(tray);
            document.addEventListener('keydown', (e) => this._ghKey(e));
            window.addEventListener('resize', () => { this._ghFab(); if (this._ghOpen) this._ghPlace(); });
        }
        this._ghFab();
    },
    _ghFab() {
        const fab = document.getElementById('gh-fab'); if (!fab) return; const d = this._ghData(); if (!d) { fab.hidden = true; return; }
        fab.hidden = false;
        // v6.53.0 手機:底部面板拉開時 🃏 先讓開,不蓋住面板內容
        { const kc = document.getElementById('kairo-card'); const under = this._ghIsMobile() && !this._ghOpen && kc && !kc.classList.contains('hidden') && kc.offsetParent !== null && kc.getBoundingClientRect().height > window.innerHeight * 0.35;
          const card = this._ghIsMobile() && [...document.querySelectorAll('#npc-quick-card, #loc-quick-card')].some(c => !c.classList.contains('hidden') && c.getClientRects().length); // 手機村民卡／建築卡開著也讓開
          fab.classList.toggle('gh-under-sheet', !!(under || card)); }
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
                <div class="gh-title">🃏 ${t('事件卡')}<span class="gh-pw-top" title="${t('打牌、託夢、災厄工坊共用的神力')}">🔮 <b>${d.sandbox ? '∞' : d.power}</b>${d.sandbox ? '' : `/${d.powerCap}`}</span><span class="gh-left ${d.todayLeft ? '' : 'none'}">${t('今天還能打')} <b>${d.todayLeft}</b>/${d.perDay}</span></div>
                <div class="gh-tabs" role="tablist">
                    <button role="tab" aria-selected="${this._ghTab === 'hand'}" class="${this._ghTab === 'hand' ? 'on' : ''}" data-gh="tab" data-v="hand">${t('手牌')}${d.book ? ` <small title="${t('神之書')}">📖 ${d.book.have}/${d.book.total}</small>` : ''}</button>
                    ${(this._uiOn?.('gh-track') ?? true) || this._ghTab === 'track' ? `<button role="tab" aria-selected="${this._ghTab === 'track'}" class="${this._ghTab === 'track' ? 'on' : ''}" data-gh="tab" data-v="track">${t('反應追蹤')}${newR ? `<span class="gh-badge">${newR}</span>` : ''}</button>` : ''}
                    ${typeof CALAMITY !== 'undefined' && CALAMITY.labOpen() && ((this._uiOn?.('gh-lab') ?? true) || this._ghTab === 'lab') ? `<button role="tab" aria-selected="${this._ghTab === 'lab'}" class="${this._ghTab === 'lab' ? 'on' : ''}" data-gh="tab" data-v="lab">🧪 ${t('災厄工坊')}${this.world?.calamity?.cur ? '<span class="gh-badge">🦠</span>' : ''}</button>` : ''}
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
                    <li>🔮 ${t('打牌花神力：⚪ 3、🔵 6、🟡 15、🟣 30；神力每天累積（小鎮興旺、虔誠的人多就更快），託夢和災厄工坊也用它')}</li>
                    <li>📖 ${t('稀有、傳說、禁忌卡要小鎮發生過某些事，才會寫進「神之書」、出現在手牌（換鎮也還在）；手牌最下面看得到還差哪些')}</li>
                    <li>⏳ ${t('每天最多打 {n} 張，打過的卡要冷卻幾天才能再用').replace('{n}', d.perDay)}</li>
                    <li>💬 ${t('村民會聊這件事、記在心裡、跟著提出提案；「反應追蹤」會記下他們的反應和七天後的變化')}</li>
                </ul>
                <button class="gh-intro-ok" data-gh="help-ok">${t('知道了，看手牌')}</button>
            </div>`;
        if (this._ghTab === 'book') this._ghTab = 'hand'; // v8.5.0 神之書併進手牌
        if (this._ghIntroOpen()) { tray.innerHTML = html; return; } // 說明頁取代手牌,不擠在一起
        if (this._ghTab === 'lab' && typeof CALAMITY !== 'undefined' && CALAMITY.labOpen()) { html += this._ghLabHtml(); tray.innerHTML = html; return; } // v7.9.0 災厄工坊
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
            const blocked = c.left > 0 || c.dailyFull || c.noPower || c.noCtx, sel = c.id === this._ghSel;
            html += `<button class="gh-card gh-${c.cat} gh-rar-${c.rar || 'common'}${sel ? ' sel' : ''}${blocked ? ' blocked' : ''}" role="option" aria-selected="${sel}" data-gh="sel" data-v="${c.id}">
                <span class="gh-band">${c.catIcon} ${esc(c.catLabel)}</span><span class="gh-cost" title="${esc(c.rarLabel || '')}">${c.rarIcon || ''}🔮${c.cost ?? ''}</span>
                <span class="gh-ic" aria-hidden="true">${c.icon}</span>
                <span class="gh-nm">${esc(c.name)}</span>
                ${c.left > 0 ? `<span class="gh-cd">⏳ ${c.left}${t('天')}</span>` : ''}
            </button>`;
        }
        html += `</div>`;
        const cur = list.find(c => c.id === this._ghSel);
        if (cur) {
            const blocked = cur.left > 0 || cur.dailyFull || cur.noPower || cur.noCtx;
            const why = cur.left > 0 ? t('冷卻中，還要 {n} 天').replace('{n}', cur.left) : cur.dailyFull ? t('今天的三張已經打完，明天再來') : cur.noCtx ? t('鎮上現在沒有這種事可以發生') : cur.noPower ? t('神力不夠（要 {n}）').replace('{n}', cur.cost) : t('打出後鏡頭會帶到現場；村民接下來幾天的反應會出現在「反應追蹤」。');
            html += `<div class="gh-detail gh-${cur.cat}">
                <div class="gh-d-head"><span class="gh-d-ic" aria-hidden="true">${cur.icon}</span><div><div class="gh-d-nm">${esc(cur.name)}</div><div class="gh-d-meta">${cur.rarIcon || ''} ${esc(cur.rarLabel || '')} · ${cur.catIcon} ${esc(cur.catLabel)} · 🔮 ${cur.cost ?? ''} · ${t('冷卻')} ${cur.cd} ${t('天')}</div></div></div>
                <div class="gh-d-desc">${esc(cur.desc)}</div>
                <div class="gh-d-fx">⚡ ${esc(cur.effect)}</div>
                <button class="gh-play" data-gh="play" data-v="${cur.id}" ${blocked ? 'disabled aria-disabled="true"' : ''}>🃏 ${t('打出（{n} 神力）').replace('{n}', cur.cost ?? 0)}</button>
                <div class="gh-d-note">${esc(why)}</div>
            </div>`;
        }
        html += this._ghLockedHtml(esc); // v8.5.0 神之書併進手牌:最下面列出還沒寫進書裡的卡
        html += `</div>`;
        tray.innerHTML = html;
    },

    // ---------- v7.9.0 災厄工坊:設計病原體、釋放、看疫情 ----------
    _ghLabSpec() { if (!this._ghLab) this._ghLab = { name: '', route: ['droplet'], sym: ['cough'], quirk: [], latency: 'mid', speed: 'mid', length: 'mid', lethal: 'low', resist: 'off', climate: 'none', target: 'none' }; return this._ghLab; },
    _ghLabHtml() {
        const w = this.world; const V = CALAMITY.view(w); const esc = (x) => this._escapeHtml(String(x ?? '')); const P = V.parts;
        const pw = V.sandbox ? '∞' : `${V.power}/${V.cap}`;
        let h = `<div class="gh-lab"><div class="gh-lab-top"><span class="gh-pw">🔮 ${t('神力')} <b>${pw}</b></span><label class="gh-sbx"><input type="checkbox" id="gh-lab-sbx" ${V.sandbox ? 'checked' : ''}> ${t('沙盒模式（神力無限）')}</label></div>`;
        h += `<div class="gh-lab-note">${t('你只能讓災厄更糟，不能阻止它。神力每天累積 1.5 點（小鎮越興旺、虔誠的人越多越快），最多 100。')}</div>`;
        if (V.cur) {
            const c = V.cur; const sp = c.spec;
            h += `<div class="gh-lab-cur"><div class="gh-lab-h"><span>🦠 <b>${esc(c.name)}</b></span><span class="gh-ph gh-ph-${c.phase}">${esc(c.phaseName)}</span><span class="gh-when">${t('第 {d} 天').replace('{d}', c.days + 1)}</span></div>`;
            h += `<div class="gh-lab-n"><span title="${t('只有你看得到')}">🕶️ ${t('潛伏')} <b>${c.E}</b></span><span>🤒 ${t('發病')} <b>${c.I}</b></span><span>💪 ${t('康復')} <b>${c.R}</b></span><span>⚰️ ${t('死亡')} <b>${c.D}</b></span>${c.fled ? `<span>🧳 ${t('逃走')} <b>${c.fled}</b></span>` : ''}<span>👥 ${t('鎮上')} ${c.pop}</span></div>`;
            // 曲線:發病(紅)、潛伏(橘虛線)、死亡累計(灰)
            const cv = c.curve; if (cv.length > 1) { const mx = Math.max(4, ...cv.map(x => Math.max(x[1], x[4], x[2]))); const W = 300, H = 70; const pt = (i, v) => `${(i / (cv.length - 1) * W).toFixed(1)},${(H - v / mx * (H - 4) - 2).toFixed(1)}`; const line = (j) => cv.map((x, i) => pt(i, x[j])).join(' ');
                h += `<svg class="gh-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('疫情曲線')}"><polyline points="${line(4)}" class="ln-e"/><polyline points="${line(2)}" class="ln-d"/><polyline points="${line(1)}" class="ln-i"/></svg><div class="gh-legend"><span class="lg-i">${t('發病')}</span><span class="lg-e">${t('潛伏（只有你看得到）')}</span><span class="lg-d">${t('死亡累計')}</span></div>`; }
            if (c.vax) h += `<div class="gh-vax">💉 ${c.vax.done ? t('疫苗研究出來了，已經 {n} 人打了疫苗').replace('{n}', c.vax.shots) : t('疫苗研究中')} <div class="progress-bar"><div class="progress-fill" style="width:${c.vax.pct}%"></div></div></div>`;
            const MS = { quar: '🏠 ' + t('病人隔離'), mask: '😷 ' + t('戴口罩'), close: '🚪 ' + t('酒館市集關閉'), lock: '🚧 ' + t('封城') };
            if (c.ms.length) h += `<div class="gh-ms">${c.ms.map(k => `<span>${MS[k] || k}</span>`).join('')}</div>`;
            h += this._ghLabWays(V.ways, esc); // v8.2.0 疫情裡的人情世故
            h += `<div class="gh-spec">${sp.route.map(k => P.route[k].icon + ' ' + t(P.route[k].name)).join(' · ')} ｜ ${sp.sym.map(k => P.sym[k].icon + ' ' + t(P.sym[k].name)).join(' · ')}${(sp.quirk || []).length ? ' ｜ ' + sp.quirk.map(k => P.quirk[k].icon + ' ' + t(P.quirk[k].name)).join(' · ') : ''}</div>`;
            const LG = { release: '🧪 在{x}身上釋放', found: '🩺 被發現了', rumor: '🗣️ 流言：「{x}」', panic: '😱 鎮上陷入恐慌', fading: '🌤️ 開始退燒', vax: '🔬 開始研究疫苗', vaxdone: '💉 疫苗問世', quar: '🏠 病人隔離', mask: '😷 口罩令', close: '🚪 酒館市集關閉', lock: '🚧 封城', reopen: '🍻 酒館市集重新開門', boost: '😈 你推了一把', boom: '💥 {x}說謊爆炸', smoke: '💨 {x}說謊冒煙', confess: '😰 {x}怕爆炸全招了', blurt: '🗣️ {x}說溜了秘密' };
            h += `<div class="gh-lab-log">${c.log.map(l => `<div><span class="gh-when">${t('第 {d} 天').replace('{d}', l[0] - c.day + 1)}</span> ${esc(t(LG[l[1]] || l[1]).replace('{x}', l[2] || ''))}</div>`).join('')}</div>`;
            if (c.scape) h += `<div class="gh-lab-note">🎯 ${t('鎮上有人把矛頭指向{a}').replace('{a}', esc(c.scape))}</div>`;
            const canB = !c.boosting && (V.sandbox || V.power >= V.boostCost);
            h += `<button class="gh-play gh-boost" data-gh="lab-boost" ${canB ? '' : 'disabled aria-disabled="true"'}>😈 ${c.boosting ? t('正在加速擴散') : t('推一把（{n} 神力）：三天內傳得更快').replace('{n}', V.boostCost)}</button></div>`;
            h += '</div>'; return h;
        }
        if (typeof WORLDCAL !== 'undefined' && WORLDCAL.active(w)) { h += this._wcBlock('lab'); h += '</div>'; return h; } // v8.5.0 世界級災厄進行中
        const S = this._ghLabSpec(); const pv = CALAMITY.preview(S);
        const chip = (g, k, d, on, multi) => `<button class="gh-chip${on ? ' on' : ''}" data-gh="${multi ? 'lab-multi' : 'lab-opt'}" data-g="${g}" data-v="${k}" aria-pressed="${on}" title="${esc(t(d.desc || ''))}">${d.icon ? d.icon + ' ' : ''}${esc(t(d.name))}<small>${d.cost ? '+' + d.cost : ''}</small></button>`;
        const LBL = { route: '傳播途徑（選 1～2）', sym: '症狀（最多 4 個）', quirk: '怪病特性（最多 2 個，可不選）', latency: '潛伏期', speed: '爆發速度', length: '持續時間', lethal: '致死率', resist: '抗藥性', climate: '季節', target: '偏好族群' };
        h += `<div class="gh-lab-form"><label class="gh-lab-row"><span>${t('名稱')}</span><input id="gh-lab-name" maxlength="12" value="${esc(S.name)}" placeholder="${t('例如：灰咳病')}"></label>`;
        for (const g of ['route', 'sym', 'quirk']) h += `<div class="gh-lab-row"><span>${t(LBL[g])}</span><div class="gh-chips">${Object.entries(P[g]).map(([k, d]) => chip(g, k, d, S[g].includes(k), true)).join('')}</div></div>`;
        for (const g of V.single) h += `<div class="gh-lab-row"><span>${t(LBL[g])}</span><div class="gh-chips">${Object.entries(P[g]).map(([k, d]) => chip(g, k, Object.assign({}, d, { name: d.name, desc: d.desc }), S[g] === k, false)).join('')}</div></div>`;
        const bar = (n, v) => `<div class="gh-bar"><span>${t(n)}</span><div class="progress-bar"><div class="progress-fill" style="width:${v}%"></div></div><b>${v}</b></div>`;
        h += `<div class="gh-pv">${bar('傳染力', pv.spread)}${bar('嚴重度', pv.sev)}${bar('致死率', pv.death)}${bar('隱蔽度', pv.stealth)}</div>`;
        const people = Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        h += `<label class="gh-lab-row"><span>${t('第一個病人')}</span><select id="gh-lab-zero"><option value="">🎲 ${t('隨機')}</option>${people.map(a => `<option value="${esc(a.agentId)}" ${this._ghLabZero === a.agentId ? 'selected' : ''}>${esc(t(a.name))}${a.job?.title ? '・' + esc(t(a.job.title)) : ''}</option>`).join('')}</select></label>`;
        const enough = V.sandbox || V.power >= pv.cost; const why = !V.can.ok ? (V.can.why === 'cooldown' ? t('上一場災厄剛結束，還要 {n} 天才能再放').replace('{n}', V.can.days) : '') : !enough ? t('神力不夠（要 {n}）').replace('{n}', pv.cost) : '';
        h += `<button class="gh-play" data-gh="lab-release" ${V.can.ok && enough ? '' : 'disabled aria-disabled="true"'}>🧪 ${t('釋放（{n} 神力）').replace('{n}', pv.cost)}</button>${why ? `<div class="gh-d-note">${esc(why)}</div>` : ''}</div>`;
        const L = V.ways?.lesson; if (L && (L.L > 0 || L.calm)) h += `<div class="gh-lab-note gh-lesson">📖 ${L.L > 0 ? esc(t('鎮上還記得{n}（{d} 人死去，{a} 天前）：下一場會更早發現、更早防疫，經歷過的人也更願意配合。').replace('{n}', t(L.name)).replace('{d}', L.died).replace('{a}', L.ago)) : esc(t('上次{n}沒死人，大家覺得「也沒怎樣」，下一場可能輕忽。').replace('{n}', t(L.name)))}</div>`; // v8.2.0 集體記憶
        h += this._wcBlock('lab'); // v8.5.0 撐過的世界級災厄可以在這裡發動
        if (V.hist.length) h += `<div class="gh-lab-hist"><div class="gh-lab-h">📜 ${t('過去的災厄')}</div>${V.hist.map(x => `<div>🦠 <b>${esc(x.name)}</b> · ${t('{i} 人染病、{d} 人死去').replace('{i}', x.inf).replace('{d}', x.died)}${x.fled ? ' · ' + t('{n} 人逃走').replace('{n}', x.fled) : ''} · ${t('{n} 天').replace('{n}', x.end - x.day)} · ${x.survived === false ? '💀 ' + t('全滅') : x.how === 'cure' ? '💉 ' + t('靠疫苗撐過') : '🛡️ ' + t('硬撐過來')}${x.reg ? ` · 📜 ${t('文明倒退')}${t('（')}${t(CALAMITY.REG_NAME[x.reg.tier] || '')}${t('）')}${x.reg.lost ? t('失傳 {n} 項').replace('{n}', x.reg.lost) : t('沒有失傳')}` : ''}</div>`).join('')}</div>`;
        h += '</div>'; return h;
    },
    // v8.5.0 世界級災厄:科技分頁與災厄工坊共用
    _wcBlock(where) {
        if (typeof WORLDCAL === 'undefined' || !this.world) return ''; const V = WORLDCAL.view(this.world); const esc = (x) => this._escapeHtml(String(x ?? '')); const c = V.cur;
        let h = '';
        if (c) {
            const LG = { omen: '🌫️ 出現了說不出的怪事', reveal: '🔬 {x}算出了真相', rumor: '🗣️ 消息傳遍全鎮', panic: '😱 鎮上陷入恐慌', fix: '🔬 研究員開始全力研究', fixdone: '✅ 主對策完成', shelter: '🏚️ 防空洞挖好了', unplug: '🧯 AI 全智能體拔掉了', bank: '🧊 精卵庫蓋好了', stock: '🪵 冬季倉庫堆滿了', evac: '🧳 裂隙周邊的人家搬走了', arrive_averted_kid: '🧬 降臨：化解了', arrive_eased_kid: '🍼 降臨：減輕了（孩子少了一半）', arrive_hit_kid: '🍼 降臨：重創（再也沒有孩子出生）', arrive_averted_van: '🔮 降臨：化解了', arrive_eased_van: '🌀 降臨：減輕了（{x} 人被吸走）', arrive_hit_van: '🌀 降臨：重創（{x} 人被吸走）', arrive_averted: '🕊️ 降臨：化解了', arrive_eased: '💥 降臨：減輕了（{x} 人罹難）', arrive_hit: '💥 降臨：重創（{x} 人罹難）', after: '🌅 開始收拾' };
            h += `<div class="wc-box wc-${c.kind}"><div class="wc-h"><span>🌍 ${t('世界級災厄')}${t('：')}<b>${c.icon} ${esc(c.name)}</b></span>${c.src === 'lab' ? `<span class="wc-src">🧪 ${t('工坊發動')}</span>` : ''}<span class="gh-when">${t('第 {d} 天').replace('{d}', c.day)}</span></div>`;
            h += `<div class="wc-steps">${c.phases.map((p, i) => `<span class="wc-step${i === c.idx ? ' on' : i < c.idx ? ' past' : ''}">${p.icon} ${esc(p.name)}</span>`).join('')}</div>`;
            h += `<div class="tech-desc">${esc(c.short)}${c.left > 0 ? ` · ⏳ <b>${t('還有 {n} 天降臨').replace('{n}', c.left)}</b><small>${t('（只有你看得到）')}</small>` : ''}</div>`;
            if (c.idx >= 1 && !c.out) h += `<div class="wc-bar"><span>${c.fixIcon} ${esc(c.fixName)}</span><div class="progress-bar"><div class="progress-fill" style="width:${c.prog}%"></div></div><b>${c.prog}%</b></div><div class="tech-desc wc-sub">${c.fix ? t('研究員放下手上的研究，全力在做') : t('還沒有提案通過，只有研究員零星在做')} · ${t('做完就能化解，做一半能減輕')}</div>`;
            if (c.out) h += `<div class="tech-desc">${t('結果')}${t('：')}<b class="wc-out-${c.out}">${esc(c.outName)}</b>${c.dead ? ` · ⚰️ ${t('{n} 人罹難').replace('{n}', c.dead)}` : ''}${c.van ? ` · 🌀 ${t('{n} 人被吸進裂隙').replace('{n}', c.van)}` : ''}${c.left2 > 0 ? ` · 🧳 ${t('{n} 人搬走').replace('{n}', c.left2)}` : ''}</div>`;
            h += `<div class="wc-chips"><span class="${c.prep ? 'on' : ''}">${c.prepIcon} ${esc(c.prepName)}${c.prep ? ' ✓' : ''}</span>${c.idx >= 1 ? `<span>🙄 ${t('說沒事')} ${c.deny}</span><span>😰 ${t('喊危險')} ${c.warn}</span>` : ''}</div>`;
            if (c.log.length) h += `<div class="gh-lab-log">${c.log.slice(-6).map(l => `<div><span class="gh-when">${t('第 {d} 天').replace('{d}', l[0] - (this.world._absDay() - c.day + 1) + 1)}</span> ${esc(t(LG[l[1]] || l[1]).replace('{x}', t(l[2] || '')))}</div>`).join('')}</div>`;
            h += '</div>';
        }
        if (V.sterile) h += `<div class="tech-desc wc-sterile">🍼 ${t('全球不孕還沒過去：想生的夫妻只有 {f}% 生得出來（還有 {d} 天）').replace('{f}', V.sterile.f).replace('{d}', V.sterile.left)}${V.sterile.blocked ? ` · ${t('已經有 {n} 次沒能懷上').replace('{n}', V.sterile.blocked)}` : ''}</div>`;
        if (where === 'lab' && !c) {
            const WHY = { locked: '小鎮撐過一次才能在這裡發動', active: '現在還有災厄沒結束', cooldown: '上一場剛結束，還要 {n} 天', small: '鎮上的人太少了', power: '神力不夠（要 {n}）' };
            h += `<div class="wc-lab"><div class="gh-lab-h">🌍 ${t('世界級災厄')}</div><div class="gh-lab-note">${t('每條科技路線的第六時代研究到六成，小鎮就可能自然遇上那條路線的世界級災厄；撐過一次，就能在這裡發動壓縮版（14～20 天）。')}</div>`;
            for (const k of V.kinds) { const why = k.can.ok ? '' : t(WHY[k.can.why] || '').replace('{n}', k.can.why === 'power' ? V.cost : k.can.days || '');
                h += `<div class="wc-kind${k.on ? '' : ' off'}"><div><b>${k.icon} ${esc(k.name)}</b> <small class="wc-path">${esc(k.pathName)}</small><div class="gh-book-fx">${esc(k.short)} · ${t('主對策')}${t('：')}${esc(k.fix)}</div></div>${k.on ? `<button class="gh-play" data-gh="lab-wc" data-v="${k.key}" ${k.can.ok ? '' : 'disabled aria-disabled="true"'}>${t('發動（{n} 神力）').replace('{n}', V.cost)}</button>` : ''}${why ? `<div class="gh-d-note">${k.on ? '' : '🔒 '}${esc(why)}</div>` : ''}</div>`; }
            h += '</div>';
        }
        if (V.hist.length && (where === 'tech' || !c)) h += `<div class="tech-desc wc-hist">📜 ${V.hist.slice(0, 3).map(x => `${x.icon} ${esc(x.name)}${t('（')}${esc(x.outName)}${x.dead ? t('，{n} 人罹難').replace('{n}', x.dead) : ''}${t('）')}`).join(' · ')}</div>`;
        return h;
    },
    // v8.2.0 疫情裡的人:偷溜、被抓、送飯、待在家、萬靈藥、防疫疲乏
    _ghLabWays(W, esc) {
        const c = W?.cur; if (!c) return '';
        const it = [];
        if (c.fatigue >= 1.5) it.push(`😮‍💨 ${t('規定實施太久，大家越來越撐不住（疲乏 ×{n}）').replace('{n}', c.fatigue)}`);
        if (c.sneak) it.push(`🤫 ${t('偷溜 {n} 次，被抓 {k} 次').replace('{n}', c.sneak).replace('{k}', c.caught)}${c.traced ? t('（{n} 次是病倒後醫生問出來的）').replace('{n}', c.traced) : ''}`);
        if (c.sneakers?.length) it.push(`🎭 ${t('投贊成又偷偷不守：{a}').replace('{a}', c.sneakers.map(x => esc(t(x))).join(t('、')))}`);
        if (c.food) it.push(`🍲 ${t('鄰居朋友送飯 {n} 次（病人欠下人情）').replace('{n}', c.food)}`);
        if (c.stay) it.push(`🏠 ${t('{n} 個人怕被傳染待在家，連常去的地方都不去了').replace('{n}', c.stay)}`);
        if (c.admit || c.stub) it.push(`😤 ${t('防疫被否決後又死了人：{a} 人認錯、{b} 人嘴硬').replace('{a}', c.admit).replace('{b}', c.stub)}`);
        if (c.pan) it.push(`🧴 ${esc(t('{s}賣「{x}」給 {n} 個人，收了 {m} 銀幣').replace('{s}', t(c.pan.seller)).replace('{x}', t(c.pan.name)).replace('{n}', c.pan.n).replace('{m}', c.pan.sum))}${c.pan.exp ? ' · ' + t('已被拆穿') + (c.pan.back ? t('，退了 {n} 銀幣').replace('{n}', c.pan.back) : '') : ''}`);
        return it.length ? `<div class="gh-lab-ways"><div class="gh-lab-h">👥 ${t('疫情裡的人')}</div>${it.map(x => `<div>${x}</div>`).join('')}</div>` : '';
    },
    _ghLabClick(k, v, b) {
        const w = this.world; const S = this._ghLabSpec(); const g = b.dataset.g;
        if (k === 'lab-multi') { const arr = S[g] || (S[g] = []); const i = arr.indexOf(v); const max = g === 'route' ? 2 : g === 'quirk' ? 2 : 4; if (i >= 0) { if (arr.length > 1 || g === 'quirk') arr.splice(i, 1); } else { if (arr.length >= max) arr.shift(); arr.push(v); } }
        else if (k === 'lab-opt') S[g] = v;
        else if (k === 'lab-release') { const r = CALAMITY.release(w, S, this._ghLabZero || null); if (r.ok) { try { this._showCornerNotice?.({ icon: '🧪', title: t('災厄已經釋放'), name: '', desc: t('一開始只有你知道。等村民自己發現、自己應對。') }); } catch (e) {} try { this.state = w.getState(); } catch (e) {} } }
        else if (k === 'lab-boost') CALAMITY.boost(w);
        else if (k === 'lab-wc' && typeof WORLDCAL !== 'undefined') { const r = WORLDCAL.release(w, v); if (r.ok) { try { this._showCornerNotice?.({ icon: WORLDCAL.KINDS[v]?.icon || '🌍', title: t('世界級災厄已經發動'), name: '', desc: t('一開始只有一些說不出的怪事。看村民怎麼發現、怎麼爭論、怎麼準備。') }); } catch (e) {} } }
        this._ghRender(); this._ghFab();
    },
    _ghLabInput(e) {
        const el = e.target; if (!el) return;
        if (el.id === 'gh-lab-name') { this._ghLabSpec().name = el.value; return; } // 打字時不重畫,免得游標跳走
        if (el.id === 'gh-lab-zero') { this._ghLabZero = el.value || null; return; }
        if (el.id === 'gh-lab-sbx' && e.type === 'change') { try { localStorage.setItem('rimtown_god_sandbox', el.checked ? '1' : '0'); } catch (er) {} this._ghRender(); }
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
        if (k === 'locked') { this._ghLockedOpen = !this._ghLockedOpen; this._ghRender(); return; } // v8.5.0
        if (k && k.startsWith('lab-')) return this._ghLabClick(k, v, b);
        if (k === 'random') { const d = this._ghData(); const h = (d?.hand || []).filter(c => c.left <= 0 && !c.dailyFull && !c.noPower && !c.noCtx); if (h.length) this._ghPlay(h[Math.floor(Math.random() * h.length)].id); return; }
        if (k === 'agent') { this._ghHide(); try { this.selectedAgent = v; this._goLook?.({ agentId: v }); this.renderSidebar?.(); } catch (err) {} }
    },
    // v8.4.0 神之書:全部的卡,依稀有度分頁;還沒寫進書裡的只看得到怎麼解鎖
    _ghLockedHtml(esc) {
        if (typeof GODBOOK === 'undefined' || !GODBOOK) return '';
        const B = GODBOOK.book(this.world); const off = B.map(g => ({ ...g, cards: g.cards.filter(c => !c.on) })).filter(g => g.cards.length);
        const n = off.reduce((s, g) => s + g.cards.length, 0); const tot = B.reduce((s, g) => s + g.cards.length, 0);
        if (!n) return `<div class="gh-locked done">📖 ${t('神之書全部寫滿了（{n} 張）').replace('{n}', tot)}</div>`;
        const open = !!this._ghLockedOpen;
        let h = `<div class="gh-locked${open ? ' open' : ''}"><button class="gh-locked-sum" data-gh="locked" aria-expanded="${open}">📖 ${t('還沒寫進神之書的卡')} <b>${n}</b> <small>${t('收集 {a}/{b}').replace('{a}', tot - n).replace('{b}', tot)}</small><span class="gh-locked-arrow" aria-hidden="true">${open ? '▴' : '▾'}</span></button>`;
        if (open) {
            h += `<div class="gh-lab-note">${t('小鎮發生過某些事，這些卡才會寫進書裡、出現在手牌；寫進去的卡換鎮也還在。')}</div>`;
            for (const g of off) {
                h += `<div class="gh-book-sec gh-rar-${g.rar}"><div class="gh-book-h">${g.icon} ${esc(g.label)} <small>🔮 ${g.cost} · ${g.cards.length}</small></div><div class="gh-book-grid">`;
                for (const c of g.cards) h += `<div class="gh-book-card off"><span class="gh-ic" aria-hidden="true">❔</span><div><b>${esc(c.name)}</b><div class="gh-book-fx">🔒 ${esc(c.hint)}</div></div></div>`;
                h += `</div></div>`;
            }
        }
        return h + '</div>';
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
