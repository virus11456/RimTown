// RimTown - app-pages.js（v9.18.0）：全介面資訊改版。v9.17 把「小鎮概況」改成資訊卡以後，其他頁照同一套樣子整理：
//   · 村民列表：一人一列（頭像、名字、職業、正在做什麼、心情標籤），上面可篩選（不開心、身體不適、工作中、睡覺）；八點檔與頭條收進一張卡
//   · 村民詳情：上方人物卡＋大數字（心情、身上的錢、健康、技能），內容分成「近況／關係／能力／經歷」四個分頁；重複的紀錄合併成「×N」
//   · 其他分頁（物資、建設、科技、產業、提案的鎮況、消息、年表、成就）：長串文字拆成小格子、細項收進「展開」
// 資料全部照舊，只換排版；舊的 class 都保留（測試與其他程式會找）。用 Object.assign 掛到 RimTownApp.prototype，放在 app-cards.js 之後。
'use strict';

Object.assign(RimTownApp.prototype, {
    _pgState() { if (!this._pgS) { let s = {}; try { s = JSON.parse(localStorage.getItem('rimtown_pg') || '{}') || {}; } catch (e) {} this._pgS = s; } return this._pgS; },
    _pgSave() { try { localStorage.setItem('rimtown_pg', JSON.stringify(this._pgState())); } catch (e) {} },
    _pgClick(k, v) {
        const S = this._pgState();
        if (k === 'res-filter') { S.resF = v; this._pgSave(); this.renderSidebar(); }
        else if (k === 'dt-tab') { S.dtTab = v; this._pgSave(); const c = document.querySelector('.detail-panel'); if (c) this._dtApplyTab(c.parentElement || c, v); }
        else if (k === 'ach-filter') { S.achF = v; this._pgSave(); this.renderSidebar(); }
    },
    _moodTone(m) { return m >= 60 ? 'g' : m >= 40 ? '' : m >= 25 ? 'y' : 'r'; },
    _sickOf(id) { try { return typeof HEALTH !== 'undefined' && this.world ? (HEALTH.S(this.world).a?.[id] || []).length : 0; } catch (e) { return 0; } },

    // ---------- 村民列表 ----------
    _residentsV2(container) {
        if (!this.state) return;
        const esc = (x) => this._icEsc(x); const S = this._pgState(); const f = S.resF || 'all';
        const clock = this.state.clock || {};
        const ids = Object.keys(this.state.agents || {}).filter(id => id !== 'player');
        const travel = (this.state.travelling_agents || []).length;
        const townName = this._getCurrentTownName() || t('邊境鎮');
        let html = `<div class="town-info-bar"><span class="town-info-name">${esc(t(townName))}</span><span class="town-info-pop">👤 ${ids.length}${travel ? `${t('（')}+${travel}${t(' 外出）')}` : ''}</span><span class="town-info-clock">${esc(clock.time_str || '')}</span></div>`;
        // 八點檔＋頭條收成一張卡(以前直接攤在列表上面,要捲很久才看到人)
        try {
            const pros = this.state?.prosperity?.prosperity || 0;
            const story = (pros >= 10 ? this._renderStoryFeed() : '') + (pros >= 20 ? this._renderTownHeadlines() : '');
            if (story) html += this._ic({ id: 'res-story', icon: '📺', title: t('今天的故事'), sum: `<span class="ic-sum-t">${t('八點檔與頭條')}</span>`, defOpen: false, body: story });
        } catch (e) {}
        const A = (id) => this.state.agents[id];
        const isWork = (a) => /work|工作/.test(String(a.activity || '')) || a.activity_label === t('工作');
        const isSleep = (a) => /sleep|睡/.test(String(a.activity || '')) || a.activity_label === t('睡覺');
        const F = {
            all: { l: t('全部'), ok: () => true },
            sad: { l: '😟 ' + t('不開心'), ok: (id) => (A(id).mood || 0) < 40 },
            sick: { l: '🤒 ' + t('身體不適'), ok: (id) => this._sickOf(id) > 0 },
            work: { l: '💼 ' + t('工作中'), ok: (id) => isWork(A(id)) },
            sleep: { l: '💤 ' + t('睡覺'), ok: (id) => isSleep(A(id)) },
        };
        const cur = F[f] ? f : 'all';
        html += `<div class="pg-chips" role="tablist">${Object.entries(F).map(([k, x]) => { const n = ids.filter(x.ok).length; return (k !== 'all' && !n) ? '' : `<button type="button" class="pg-chip${k === cur ? ' on' : ''}" data-action="res-filter" data-val="${k}" aria-pressed="${k === cur}">${esc(x.l)} <b>${n}</b></button>`; }).join('')}</div>`;
        const list = ids.filter(F[cur].ok).sort((x, y) => cur === 'sad' ? (A(x).mood || 0) - (A(y).mood || 0) : 0);
        const avatar = (id) => { const a = A(id); let url = ''; try { url = this.tileMap?.renderAvatarDataURL?.(a.job?.key || a.jobKey, a.gender, a.name, this.world?.agents?.[id]?.look || null) || ''; } catch (e) {} return `<div class="pp-avatar">${url ? `<img src="${url}" alt="">` : '👤'}</div>`; };
        html += `<div class="pg-list">`;
        for (const id of list) {
            const a = A(id); const m = Math.round(a.mood || 0); const tone = this._moodTone(m); const sick = this._sickOf(id);
            const g = a.gender_label === t('男') ? '♂' : a.gender_label === t('女') ? '♀' : '';
            html += `<div class="resident-card pg-row${this.selectedAgent === id ? ' selected' : ''}" data-action="select-agent" data-val="${id}" role="button" tabindex="0">
                ${avatar(id)}<div class="pg-row-main"><div class="pg-row-t"><b>${esc(t(a.name))}</b><span class="pg-g">${g}</span><span class="pg-job">${esc(a.job?.title || t('無業'))}</span></div>
                <div class="pg-row-s">${esc(a.activity_label || a.activity || '')} · ${esc(this._locationLabel(a.current_location))}${sick ? ` · 🤒` : ''}</div>
                ${a.current_thought ? `<div class="pg-row-q">${t('「')}${esc(a.current_thought)}${t('」')}</div>` : ''}</div>
                <span class="ic-chip ic-${tone || 'n'} pg-mood" title="${esc(t('心情'))} ${m}">${esc(a.mood_label || a.mood_description || '')}</span>
                <button type="button" class="chat-with-btn pg-chat" data-action="start-chat" data-val="${id}" aria-label="${esc(t('對話'))}">💬</button></div>`;
        }
        if (!list.length) html += `<div class="ob-empty" style="margin:10px 4px"><span class="ob-empty-icon">🌤️</span>${t('目前沒有符合的村民')}</div>`;
        html += `</div>`;
        if (this.world?.customNPC) {
            const remaining = this.world.customNPC.getRemainingSlots(); const canCreate = this.world.customNPC.canCreate(this.world);
            html += remaining > 0
                ? `<button type="button" class="pg-add" data-action="show-custom-npc"${canCreate ? '' : ' disabled'}>${t('🧳 迎來一位新居民（剩 {n} 位）').replace('{n}', remaining)}</button><div class="pg-hint">${t('上帝的安排：一位新面孔聽說了這座小鎮搬進來，不花鎮上的錢')}</div>`
                : `<div class="pg-hint">${t('已達自訂居民上限 (')}${this.world.customNPC.maxCustomNPCs}/${this.world.customNPC.maxCustomNPCs})</div>`;
        }
        container.innerHTML = `<div class="pg-wrap">${html}</div>`;
    },

    // ---------- 村民詳情:分頁＋大數字 ----------
    _dtTabs() { return [['now', '🕐', t('近況')], ['rel', '💞', t('關係')], ['abl', '🧰', t('能力')], ['life', '📜', t('經歷')]]; },
    _dtEnhance(container) {
        const panel = container.querySelector('.detail-panel'); if (!panel || panel.dataset.pg) return; panel.dataset.pg = '1';
        const id = this.selectedAgent; const a = this.state?.agents?.[id]; const live = this.world?.agents?.[id]; if (!a) return;
        const secs = [...panel.querySelectorAll(':scope > .detail-section, :scope > .agent-factions, :scope > div[class*="section"]')];
        const hero = secs.shift(); if (!hero) return;
        const has = (el, keys) => { const h = (el.querySelector('h3')?.textContent || '').trim(); return keys.some(k => h.indexOf(t(k)) >= 0 || h.indexOf(k) >= 0); };
        const map = (el) => has(el, ['人際關係', '社交圈', '感情狀態', '小團體']) ? 'rel'
            : has(el, ['性格', '技能', '身體', '需求']) ? 'abl'
            : has(el, ['生計', '從政履歷', '近期記憶', '履歷', '產業']) ? 'life' : 'now';
        for (const el of secs) el.dataset.dt = map(el);
        // 重複的紀錄合併(以前同一句話一天出現好幾次):同一區塊裡內容一樣的只留第一筆，後面標「×N」
        panel.querySelectorAll('.detail-section').forEach(sec => {
            const first = {}, cnt = {};
            [...sec.querySelectorAll(':scope > .memory-item')].forEach(it => {
                const tx = (it.lastChild?.textContent || it.textContent || '').replace(/^\s*\d{1,2}:\d{2}\s*/, '').trim(); if (!tx) return;
                if (first[tx]) { cnt[tx] = (cnt[tx] || 1) + 1; it.remove(); let b = first[tx].querySelector('.pg-x'); if (!b) { b = document.createElement('span'); b.className = 'pg-x'; first[tx].appendChild(b); } b.textContent = '×' + cnt[tx]; }
                else first[tx] = it;
            });
        });
        // 大數字:心情、身上的錢、健康、技能
        let cash = null; try { if (typeof WALLET !== 'undefined' && live) cash = Math.round(WALLET.get(this.world, live)); } catch (e) {}
        const m = Math.round(a.mood || 0); const sick = this._sickOf(id);
        const kp = [{ v: m, l: t('心情'), tone: this._moodTone(m) }, cash != null ? { v: this._icNum(cash), u: '💰', l: t('身上的錢'), tone: cash <= 0 ? 'r' : '' } : null,
            { v: sick ? sick : '✓', l: sick ? t('病痛') : t('健康'), tone: sick ? 'y' : 'g' }, { v: a.skills?.total_level || 0, l: t('技能總和') }].filter(Boolean);
        const strip = document.createElement('div'); strip.className = 'ic-kpis pg-dt-kpis n' + Math.min(4, kp.length);
        strip.innerHTML = kp.map(k => `<div class="ic-kpi${k.tone ? ' ic-t-' + k.tone : ''}"><b>${k.v}${k.u ? `<small>${k.u}</small>` : ''}</b><span>${this._icEsc(k.l)}</span></div>`).join('');
        hero.appendChild(strip); hero.classList.add('pg-hero');
        const tabs = document.createElement('div'); tabs.className = 'pg-tabs'; tabs.setAttribute('role', 'tablist');
        const count = (k) => secs.filter(s => s.dataset.dt === k).length;
        tabs.innerHTML = this._dtTabs().filter(([k]) => count(k)).map(([k, ic, l]) => `<button type="button" role="tab" class="pg-tab" data-action="dt-tab" data-val="${k}">${ic} ${this._icEsc(l)}</button>`).join('');
        hero.after(tabs);
        const want = this._pgState().dtTab; this._dtApplyTab(container, count(want) ? want : 'now');
    },
    // ---------- 建設頁(v9.18.0 整頁重做):以前「已完成」是一長串名字＋星星，佔滿整頁又看不出重點 ----------
    //   最上面四個大數字 → 施工中(進度條) → 已蓋好(兩欄小方塊、圖示、等級圓點) → 可升級／可以蓋／相鄰組合(收合，材料小格子，缺的標紅)
    _BLD_IC: [[/倉庫/, '📦'], [/穀|糧/, '🌾'], [/磨坊|風車/, '🌬️'], [/染|紡|布/, '🧵'], [/井|水/, '💧'], [/鍛|鐵|爐/, '⚒️'], [/藥|草/, '🌿'], [/牆|城/, '🧱'], [/診|醫|病/, '🏥'], [/市集|商業|廣場|市場/, '🏪'], [/倉/, '📦'], [/文書|圖書|史/, '📜'], [/軍械|兵|訓練/, '🛡️'], [/酒/, '🍺'], [/路|道/, '🛣️'], [/講堂|學|教/, '🎓'], [/地圖/, '🗺️'], [/田|農|灌/, '🚜'], [/商隊|驛/, '🐪'], [/印刷/, '🖨️'], [/瞭望|塔/, '🗼'], [/浴|澡/, '🛁'], [/工坊|作坊|廠/, '🏭'], [/神|廟|教堂|祠/, '⛩️'], [/劇|雕|藝/, '🎭'], [/天文/, '🔭'], [/銀行|錢/, '🏦'], [/議事|鎮公所|政/, '🏛️']],
    _bldIcon(name) { const n = String(name || ''); for (const [re, ic] of this._BLD_IC) if (re.test(n)) return ic; return '🏠'; },
    _bldCost(costs) {
        const res = this.state?.stockpile?.resources || {}; const icons = { salt: '🧂', paper: '📄', food: '🌾', wood: '🪵', stone: '🪨', metal: '⚙️', cloth: '🧵', herbs: '🌿', silver: '💰', meals: '🍲', tools: '🔧', clothing: '👕', medicine: '💊', furniture: '🪑', research_points: '📚' };
        return `<span class="pg-costs">${Object.entries(costs || {}).map(([r, a]) => `<span class="pg-cost${(res[r] || 0) < a ? ' short' : ''}" title="${this._icEsc(this._resName ? this._resName(r) : r)} ${Math.floor(res[r] || 0)}/${a}">${icons[r] || ''}${a}</span>`).join('')}</span>`;
    },
    _pips(lv, max = 3) { return `<span class="pg-pips" aria-label="Lv.${lv}">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`; },
    _buildV2() {
        const esc = (x) => this._icEsc(x); const B = this.state.buildings || {}; const W = this.world.buildings;
        const prog = B.in_progress || [], done = (B.completed || []).slice().sort((a, b) => (b.level || 1) - (a.level || 1));
        let up = [], av = []; try { up = W.getUpgradeable(this.world); } catch (e) {} try { av = W.getAvailable(this.world); } catch (e) {}
        const upKeys = new Set(up.map(u => u.buildingKey));
        let h = this._ic({ id: 'bld-sum', icon: '🏗️', title: t('鎮上的建築'), defOpen: true, chip: prog.length ? { t: t('{n} 項施工中').replace('{n}', prog.length), tone: 'y' } : null,
            kpis: [{ v: done.length, u: t('棟'), l: t('已蓋好') }, { v: prog.length, l: t('施工中'), tone: prog.length ? 'y' : '' }, { v: up.length, l: t('可升級') }, { v: av.length, l: t('可以蓋') }] });
        // 施工中
        const pRows = prog.map(p => { const pct = Math.max(0, Math.min(100, Math.round((p.workDone / Math.max(1, p.workRequired)) * 100))); return `<div class="pg-prog"><span class="pg-prog-ic">${this._bldIcon(p.name)}</span><div class="pg-prog-m"><div class="pg-prog-t"><b>${esc(t(p.name))}</b>${p.upgradeKey ? `<small>${t('升級到 Lv.{n}').replace('{n}', p.targetLevel || '')}</small>` : ''}<span>${pct}%</span></div><div class="ic-bar"><i style="width:${Math.max(2, pct)}%"></i></div></div></div>`; }).join('');
        h += this._ic({ id: 'bld-prog', icon: '🚧', title: t('施工中'), defOpen: true, sum: prog.length ? `<b>${prog.length}</b>` : '', body: pRows || `<div class="ic-note">${t('目前沒有在蓋的工程。村民提案通過後才會開工。')}</div>` });
        // 已蓋好:小方塊
        const tiles = done.map(b => { const lv = b.level || 1; const canUp = upKeys.has(b.buildingKey); return `<div class="pg-tile${canUp ? ' up' : ''}" title="${esc(b.description || '')}"><span class="pg-tile-ic">${this._bldIcon(b.name)}</span><span class="pg-tile-m"><b>${esc(t(b.name))}</b>${this._pips(lv)}</span>${canUp ? `<span class="pg-tile-up" title="${esc(t('可升級'))}">⬆</span>` : ''}</div>`; }).join('');
        h += this._ic({ id: 'bld-done', icon: '🏘️', title: t('已蓋好'), defOpen: true, sum: `<b>${done.length}</b>`, body: tiles ? `<div class="pg-tiles">${tiles}</div><div class="pg-legend">${this._pips(1)} Lv.1　${this._pips(3)} Lv.3　<span class="pg-tile-up">⬆</span> ${t('可升級')}</div>` : `<div class="ic-note">${t('還沒有蓋好的建築。')}</div>` });
        // 可升級
        if (up.length) h += this._ic({ id: 'bld-up', icon: '⬆️', title: t('可升級'), defOpen: false, sum: `<b>${up.length}</b>`, body: up.map(u => `<div class="pg-opt${u.can_afford ? '' : ' cant'}"><div class="pg-opt-t"><span>${this._bldIcon(u.name)}</span><b>${esc(t(u.name))}</b><small>Lv.${u.currentLevel} → ${u.nextLevel}</small></div><div class="pg-opt-d">${esc(u.description || '')}</div><div class="pg-opt-f">${this._bldCost(u.costs)}${Object.entries(u.effects || {}).map(([k, v]) => `<span class="pg-eff">${esc(this._upEffText ? this._upEffText(k, v) : k)}</span>`).join('')}</div></div>`).join('') });
        // 可以蓋
        if (av.length) h += this._ic({ id: 'bld-av', icon: '📐', title: t('可以蓋'), defOpen: false, sum: `<b>${av.length}</b>`, body: av.map(p => `<div class="pg-opt${p.can_afford ? '' : ' cant'}"><div class="pg-opt-t"><span>${this._bldIcon(p.name)}</span><b>${esc(t(p.name))}</b>${p.can_afford ? `<small class="ok">${t('材料夠')}</small>` : `<small>${t('材料不夠')}</small>`}</div><div class="pg-opt-d">${esc(p.description || '')}</div><div class="pg-opt-f">${this._bldCost(p.costs)}</div></div>`).join('') + `<div class="ic-note">${t('紅色的材料是公庫目前還不夠的。')}</div>` });
        // 相鄰組合
        if (typeof COMBO_DEFS !== 'undefined') {
            const found = new Set(this.world?.combosFound || []); const F = COMBO_DEFS.filter(c => found.has(c.id));
            h += this._ic({ id: 'bld-combo', icon: '✨', title: t('相鄰組合'), defOpen: false, sum: `<b>${F.length}/${COMBO_DEFS.length}</b>`, info: t('把相配的建築和裝飾放在附近(4格內)會觸發組合,提升美觀與繁榮!組合配方要自己摸索'),
                body: (F.length ? `<div class="ic-rows">${F.map(c => `<div class="ic-row"><span>${c.icon} ${esc(c.name)}</span><small>${esc(c.desc)}</small></div>`).join('')}</div>` : '') + (COMBO_DEFS.length - F.length ? `<div class="ic-note">❓ ${t('還有 {n} 種組合沒發現').replace('{n}', COMBO_DEFS.length - F.length)}</div>` : '') });
        }
        return `<div class="ic-wrap pg-build">${h}</div>`;
    },

    // ---------- 通用:每個分頁畫完後整理一次 ----------
    // 1. 區塊(econ-section、pp-issues…)的標題列變成可以點的收合鈕，收起時只剩一行標題＋數量；開關記得住
    // 2. 一行裡用「 · 」接了三項以上的文字，拆成一格一格的小格子(以前一整串擠在一起很難讀)
    _PG_SKIP: { chat: 1, 'chat-archives': 1, settings: 1, relmap: 1 },
    _pgEnhance(root) {
        if (!root || !this.world?.observerMode || this._PG_SKIP[this.activeTab]) return;
        const tab = this.activeTab + (this.activeTab === 'proposals' ? ':' + (this._ppTab || '') : '');
        if (this.activeTab !== 'detail') this._pgBlocks(root, tab);
        if (this.activeTab === 'econ-tech') this._pgTechFold(root);
        if (this.activeTab === 'achievements') this._pgAch(root);
        if (this.activeTab === 'proposals') this._pgPropMini(root);
        this._pgDots(root);
    },
    _PG_BLK: '.econ-section, div.ach-category, .pp-issues, .news-section, .travelling-section, .quest-section, .festival-section, .faction-section, .explore-section, .chain-section',
    _pgBlocks(root, tab) {
        const S = this._pgState(); S.blk = S.blk || {};
        const blocks = [...root.querySelectorAll(this._PG_BLK)].filter(b => !b.closest('.ic-card') && !b.parentElement.closest(this._PG_BLK) && !b.dataset.pgb);
        let i = 0; const seen = {};
        for (const b of blocks) {
            const h = b.firstElementChild; if (!h || !/^H[34]$/.test(h.tagName)) continue;
            const label = (h.textContent || '').replace(/[\d,，.%()（）\/／:：+\-]+/g, '').trim().slice(0, 24); if (!label) continue;
            const key = tab + '|' + label; seen[key] = (seen[key] || 0) + 1; const k = key + '#' + seen[key];
            const urgent = b.matches('.pp-issues:not(.pp-tier):not(.pp-secrets)') && /⚠️|🚨|急/.test(h.textContent) || !!b.querySelector('.hot, .pp-tab-n.hot');
            const open = k in S.blk ? !!S.blk[k] : (i < 2 || urgent);
            b.dataset.pgb = k; b.classList.add('pg-blk'); b.classList.toggle('open', open);
            h.classList.add('pg-bh'); h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.setAttribute('aria-expanded', String(open)); h.dataset.action = 'blk-toggle'; h.dataset.val = k;
            if (!h.querySelector('.pg-arr')) { const a = document.createElement('span'); a.className = 'pg-arr'; a.setAttribute('aria-hidden', 'true'); h.appendChild(a); }
            // 收起時顯示有幾項(標題本身沒有數字的話)
            if (!/\d/.test(h.textContent)) { const n = b.querySelectorAll(':scope > div, :scope > p, :scope > ul > li').length - 0; if (n > 1) { const c = document.createElement('span'); c.className = 'pg-bn'; c.textContent = n; h.insertBefore(c, h.querySelector('.pg-arr')); } }
            i++;
        }
    },
    // 科技:每個時代的「已完成」「還沒解鎖」收成一行(以前全部攤開，要捲很久才看到正在研究的)
    _pgTechFold(root) {
        const S = this._pgState(); S.fold = S.fold || {};
        root.querySelectorAll('.tech-era').forEach((era, i) => {
            if (era.dataset.pgf) return; era.dataset.pgf = '1';
            const head = (era.querySelector('.tech-era-head')?.textContent || '').replace(/[\d\/]+/g, '').trim().slice(0, 20);
            for (const [st, icon, label] of [['done', '✅', t('已完成 {n} 項')], ['locked', '🔒', t('還沒解鎖 {n} 項')]]) {
                const nodes = [...era.querySelectorAll(':scope > .tech-node.tech-' + st)]; if (nodes.length < 2) continue;
                const k = head + '|' + st + '|' + i; const open = !!S.fold[k];
                const b = document.createElement('button'); b.type = 'button'; b.className = 'pg-fold' + (open ? ' open' : ''); b.dataset.action = 'fold-toggle'; b.dataset.val = k; b.setAttribute('aria-expanded', String(open));
                b.innerHTML = `<span>${icon} ${this._icEsc(label.replace('{n}', nodes.length))}</span><span class="pg-arr" aria-hidden="true"></span>`;
                nodes[0].before(b); nodes.forEach(n => { n.classList.add('pg-folded'); n.dataset.fold = k; n.classList.toggle('pg-hide2', !open); });
            }
        });
    },
    // 成就:上面可以只看已達成／還沒達成，每一類有進度條
    _pgAch(root) {
        const P = root.querySelector('.achievements-panel'); if (!P || P.dataset.pga) return; P.dataset.pga = '1';
        const on = P.querySelectorAll('.ach-category:not(.ach-legacy) .ach-card.unlocked').length, off = P.querySelectorAll('.ach-category:not(.ach-legacy) .ach-card.locked').length;
        const f = this._pgState().achF || 'all';
        const bar = document.createElement('div'); bar.className = 'pg-chips';
        bar.innerHTML = [['all', t('全部'), on + off], ['on', '🏆 ' + t('已達成'), on], ['off', '🔒 ' + t('還沒達成'), off]].map(([k, l, n]) => `<button type="button" class="pg-chip${k === f ? ' on' : ''}" data-action="ach-filter" data-val="${k}" aria-pressed="${k === f}">${this._icEsc(l)} <b>${n}</b></button>`).join('');
        (P.querySelector(':scope > h3') || P.firstChild)?.after(bar);
        P.classList.toggle('pg-f-on', f === 'on'); P.classList.toggle('pg-f-off', f === 'off');
        P.querySelectorAll('.ach-category:not(.ach-legacy) > h4').forEach(h => { const m = (h.querySelector('.ach-cat-n')?.textContent || '').match(/(\d+)\/(\d+)/); if (!m) return; const b = document.createElement('div'); b.className = 'ic-bar pg-achbar'; b.innerHTML = `<i style="width:${Math.max(2, Math.round(m[1] / Math.max(1, m[2]) * 100))}%"></i>`; h.after(b); });
    },
    // 提案:已定案的提案先收成「編號、標題、結果」一行，點「看全文」才展開(以前每件都是一大張卡)
    _pgPropMini(root) {
        const S = this._pgState(); S.pp = S.pp || {};
        root.querySelectorAll('.pp-card.pp-done, .pp-card.pp-failed, .pp-card.pp-rejected, .pp-card.pp-expired').forEach(c => {
            if (c.dataset.pgm) return; c.dataset.pgm = '1'; const id = c.dataset.pid || ''; const open = !!S.pp[id];
            c.classList.toggle('pg-mini', !open);
            const b = document.createElement('button'); b.type = 'button'; b.className = 'pg-ppt'; b.dataset.action = 'pp-mini'; b.dataset.val = id; b.setAttribute('aria-expanded', String(open));
            b.innerHTML = `<span class="pg-o">${t('看全文')} ▾</span><span class="pg-c">${t('收起')} ▴</span>`; c.appendChild(b);
        });
    },
    _pgPropToggle(id) {
        const S = this._pgState(); S.pp = S.pp || {}; const on = !S.pp[id]; if (on) S.pp[id] = 1; else delete S.pp[id]; this._pgSave();
        document.querySelectorAll('.pp-card').forEach(c => { if (c.dataset.pid === id) { c.classList.toggle('pg-mini', !on); c.querySelector('.pg-ppt')?.setAttribute('aria-expanded', String(on)); } });
    },
    _pgFoldToggle(k) {
        const S = this._pgState(); S.fold = S.fold || {}; const on = !S.fold[k]; S.fold[k] = on ? 1 : 0; this._pgSave();
        document.querySelectorAll('.pg-fold').forEach(b => { if (b.dataset.val === k) { b.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on)); } });
        document.querySelectorAll('.pg-folded').forEach(n => { if (n.dataset.fold === k) n.classList.toggle('pg-hide2', !on); });
    },
    _pgBlkToggle(k) {
        const S = this._pgState(); S.blk = S.blk || {};
        const b = [...document.querySelectorAll('[data-pgb]')].find(x => x.dataset.pgb === k); if (!b) return;
        const on = !b.classList.contains('open'); b.classList.toggle('open', on); b.firstElementChild?.setAttribute('aria-expanded', String(on)); S.blk[k] = on ? 1 : 0; this._pgSave();
    },
    // 「標籤 數字」的一段 → 數據格(數字大、說明小);其他照原文當小標籤。0 也照樣顯示，只是淡一點
    _PG_STAT: /^(|.*?[^\d\s.,+\-−＋])\s*[：:]?\s*([+\-−＋]?\d[\d.,]*)\s*(%|人|次|棟|筆|天|家|件|位|股|銀幣|個|份|名|席|條|篇|座|間|項|週|年|歲|點|種|處|起|門)?\s*$/,
    _pgStat(txt) {
        const m = String(txt).trim().match(this._PG_STAT); if (!m) return null;
        const l = m[1].replace(/[：:\s]+$/, '').trim(); if (l.length > 22 || /\d/.test(l)) return null; // 標籤裡還有數字(例如「價格 75% 對 100%」)就不拆,免得意思跑掉
        return { l, v: m[2], u: m[3] || '' };
    },
    _pgDots(root) {
        const SEP = /\s+·\s+|(?<=[\d%）)\]a-zA-Z])・(?=\S)/;
        const cands = root.querySelectorAll('div, p, span.pp-tier-line, span.market-num, span.market-holders, span.market-rival, .pp-tier-line > small, .pp-issue small');
        const plain = (g) => g.every(n => n.nodeType === 3 || /^(B|STRONG|SMALL|SPAN)$/.test(n.tagName) && !n.querySelector('*'));
        for (const el of cands) {
            if (el.dataset.pgd || el.closest('.ic-card, .ic-kpi, button, .memory-item, .chat-msg, .pp-card, .pg-row, .tech-node-head, .news-paper, .obs-paper, .ob-paper')) continue;
            if (el.querySelector('div, p, ul, ol, table, section, h3, h4, button, input, select')) continue;
            const txt = el.textContent || ''; if (txt.length < 12) continue;
            if (txt.length > 50 && (txt.match(/；/g) || []).length >= 2 && !el.closest('.pg-dots')) { // 用「；」串起來的長段 → 一條一條的清單
                const rows = [[]];
                for (const n of [...el.childNodes]) { if (n.nodeType === 3 && n.data.includes('；')) n.data.split('；').forEach((p, j) => { if (j > 0) rows.push([]); if (p.trim()) rows[rows.length - 1].push(document.createTextNode(p.trim())); }); else rows[rows.length - 1].push(n); }
                const R = rows.filter(r => r.some(n => (n.textContent || '').trim()));
                if (R.length >= 3) { el.textContent = ''; el.classList.add('pg-list2'); el.dataset.pgd = '1'; for (const r of R) { const d = document.createElement('span'); d.className = 'pg-li'; r.forEach(n => d.appendChild(n)); el.appendChild(d); } continue; }
            }
            const hits = txt.split(SEP).length - 1; if (hits < 1) continue;
            const groups = [[]];
            for (const n of [...el.childNodes]) {
                if (n.nodeType === 3 && SEP.test(n.data)) { n.data.split(SEP).forEach((p, j) => { if (j > 0) groups.push([]); if (p.trim()) groups[groups.length - 1].push(document.createTextNode(p.trim())); }); }
                else groups[groups.length - 1].push(n);
            }
            const G = groups.filter(g => g.some(n => (n.textContent || '').trim()));
            const gt = (g) => g.map(n => n.textContent || '').join('').trim();
            const noStat = el.matches('.market-holders, .pp-tier-line > small'); // 股東名單、店家說明照原文小標籤
            const stats = G.map(g => { if (noStat || !plain(g)) return null; const x = gt(g); const parts = x.split('／'); if (parts.length === 2) { const a = this._pgStat(parts[0]), b = this._pgStat(parts[1]); if (a && b) return [a, b]; } const st = this._pgStat(x); return st ? [st] : null; });
            const nStat = stats.filter(Boolean).length;
            if (G.length < 2 || (G.length === 2 && nStat < 2) || (G.length >= 3 && nStat === 0 && G.some(g => gt(g).length > 30)) || G.some((g, i) => !stats[i] && gt(g).length > 40)) continue; // 只拆短的事實(一段太長代表是句子,拆了反而難讀)
            el.textContent = ''; el.classList.add('pg-dots'); el.dataset.pgd = '1';
            G.forEach((g, i) => {
                if (stats[i]) for (const st of stats[i]) { const z = /^[+\-−＋]?0(\.0+)?$/.test(st.v); const s2 = document.createElement('span'); s2.className = 'pg-st' + (z ? ' zero' : ''); s2.innerHTML = `<b>${this._icEsc(st.v)}${st.u ? `<small>${this._icEsc(st.u)}</small>` : ''}</b>${st.l ? `<span>${this._icEsc(st.l)}</span>` : ''}`; el.appendChild(s2); }
                else { const s2 = document.createElement('span'); s2.className = 'pg-dot'; g.forEach(n => s2.appendChild(n)); el.appendChild(s2); }
            });
        }
    },
    _dtApplyTab(container, k) {
        const panel = container.querySelector('.detail-panel'); if (!panel) return;
        panel.querySelectorAll('[data-dt]').forEach(el => el.classList.toggle('pg-hide', el.dataset.dt !== k));
        panel.querySelectorAll('.pg-tab').forEach(b => { const on = b.dataset.val === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    },
});

// 掛上去:村民列表換新版;村民詳情畫完以後加上分頁
(function () {
    const P = RimTownApp.prototype;
    const _rl = P.renderResidentsList;
    P.renderResidentsList = function (container) { if (this.world?.observerMode) { try { return this._residentsV2(container); } catch (e) { console.warn('[pages] residents', e); } } return _rl.call(this, container); };
    const _re = P.renderEconomy;
    P.renderEconomy = function (container) { if (this.activeTab === 'econ-build' && this.world?.observerMode && this.state) { try { container.innerHTML = `<div class="economy-panel">${this._buildV2()}</div>`; return; } catch (e) { console.warn('[pages] build', e); } } return _re.call(this, container); };
    const _ad = P.renderAgentDetail;
    P.renderAgentDetail = function (container) { const r = _ad.call(this, container); try { this._dtEnhance(container); } catch (e) { console.warn('[pages] detail', e); } return r; };
})();
