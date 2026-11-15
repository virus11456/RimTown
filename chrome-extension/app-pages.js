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

    // ---------- 產業頁(v9.19.1 整頁重做) ----------
    // 以前:「產業與老闆」是一長串用「·」接起來的字,被自動拆成沒有標題的數字格(看不出那個 0 是什麼的 0);
    //       農田掉在卡片外面(收起農場還看得到);工廠配方是空的;工廠、店、銀行、產業等級、農場各用各的樣子
    // 現在:一件事一張資訊卡,每個數字都有說明,細項收進「展開詳細」。資料全部照舊。
    //       產業與老闆 → 鎮上的店 → 工廠 → 基礎產業 → 農場 → 銀行 → 貧富與住房 → 金權與報社 → 工會 → 離鎮
    _PG_RI: { salt: '🧂', paper: '📄', food: '🌾', wood: '🪵', stone: '🪨', metal: '⚙️', cloth: '🧵', herbs: '🌿', silver: '💰', meals: '🍲', tools: '🔧', clothing: '👕', medicine: '💊', furniture: '🪑', research_points: '📚',
        plank: '🪵', hardwood: '🪓', brick: '🧱', marble: '🏛️', steel: '⚔️', gold: '🥇', wheat: '🌾', rice: '🍚', corn: '🌽', potato: '🥔', cotton: '🧶', flowers: '🌸', mushroom: '🍄', sugarcane: '🎋', tea: '🍵', grapes: '🍇', golden_wheat: '✨', dragon_fruit: '🐉',
        bread: '🍞', pastry: '🧁', beer: '🍺', wine: '🍷', perfume: '🌹', fine_tea: '🫖', herbal_tea: '🍃', sugar: '🍬', jam: '🫙', luxury_furniture: '🛋️' },
    // 一排小數字:數字在上、說明在下(一家店一排,不會再出現沒有說明的數字)
    _indNums(items) { const L = items.filter(Boolean); return L.length ? `<div class="pg-nums n${Math.min(4, L.length)}">${L.map(x => `<span${x[2] ? ` class="ic-t-${x[2]}"` : ''}><b>${x[0]}</b><i>${this._icEsc(x[1])}</i></span>`).join('')}</div>` : ''; },
    _indRes(costs, check) { const res = this.state?.stockpile?.resources || {}; return this._icPills(Object.entries(costs || {}).map(([r, a]) => `<span class="${check && (res[r] || 0) < a ? 'pg-short' : ''}">${this._PG_RI[r] || '📦'} ${this._icEsc(this._resName(r))} <b>×${Math.round(a * 10) / 10}</b></span>`)); },
    _indHead(name, tag, tone) { return `<div class="pg-firm-h"><span class="market-name">${name}</span>${tag ? `<span class="ic-pill${tone ? ' pg-' + tone : ''}">${tag}</span>` : ''}</div>`; },
    _indKv(k, v) { return v ? `<div class="pg-kv"><span>${k}</span>${v}</div>` : ''; },
    _industryV2() {
        this._icAlerts = []; const cards = [];
        const add = (fn) => { try { const h = fn.call(this, cards.length); if (h) cards.push(h); } catch (e) { console.warn('[industry]', e); } };
        [this._indBiz, this._indShops, this._indFactory, this._indBase, this._indFarm, this._indBank, this._indLife, this._indPower, this._indUnion, this._indExile].forEach(add);
        const A = this._icAlerts; this._icAlerts = null;
        return `<div class="ic-wrap pg-ind">${A.length ? this._icBrief(A) : ''}${cards.join('')}</div>`;
    },
    // 產業與老闆:每家一格(名稱、老闆、人數／工資／七天營收／薪水、股東、對手);競爭、股份、入股統計收進詳細
    _indBiz() {
        const w = this.world; if (typeof MARKET === 'undefined' || !w?.market) return '';
        const esc = (x) => this._icEsc(x), N = (n) => this._icNum(n); const rows = MARKET.view(w);
        const firm = (r) => { const rv = r.rival; const hs = String(r.holders || '').split(t('・')).filter(Boolean);
            return `<div class="market-row pg-firm">` + this._indHead(`${r.icon} ${esc(r.name)}`, r.owner ? `<span class="market-owner">${esc(r.owner)}</span>` : `<span class="market-owner">${t('公營')}</span>`, r.owner ? 'own' : '')
                + `<div class="market-num">` + this._indNums([[r.workers, t('人數')], [r.pay + '%', t('工資水準'), r.pay < 100 ? 'y' : ''], [N(r.rev7), t('七天營收')], [N(r.cost7), t('七天薪水')]]) + `</div>`
                + (hs.length ? `<div class="market-holders pg-firm-x"><span class="pg-firm-k">🤝 ${t('股東')}</span>${this._icPills(hs.map(esc))}</div>` : '')
                + (rv ? `<div class="market-rival pg-firm-x"><span class="pg-firm-k">⚔️ ${t('對手')}${t('：')}${esc(rv.owner)}</span>${this._icPills([t('搶到 {p}% 客人').replace('{p}', rv.share), `${t('價格')} ${rv.incPrice}% ${t('對')} ${rv.price}%`, t('{n} 人').replace('{n}', rv.staff), `${t('工資')} ${rv.pay}%`, rv.partners ? `🤝 ${t('合夥')}${t('：')}${esc(rv.partners)}` : ''])}</div>` : '') + `</div>`; };
        let d = '';
        if (typeof COMPETE !== 'undefined') { const v = COMPETE.view(w), c = v.st || {}; if (c.opened || v.cap || c.mgr) d += this._icSub('⚔️ ' + t('競爭'), `<div class="compete-meta">` + this._icGrid([{ v: c.opened || 0, l: t('新開對手店') }, { v: c.closed || 0, l: t('收攤') }, { v: c.merged || 0, l: t('併購') }, { v: c.wars || 0, l: t('價格戰') }, { v: c.poach || 0, l: t('跳槽') }, v.saved ? { v: N(v.saved), u: t('銀幣'), l: t('村民省下') } : null, c.mgr ? { v: c.mgr, l: '👔 ' + t('請掌櫃') } : null, c.mgr && c.caught ? { v: c.caught, l: t('抓到揩油') } : null, c.lobby ? { v: c.lobby, l: '💰 ' + t('遊說') } : null, c.lobby && c.exposed ? { v: c.exposed, l: t('被揭發') } : null]) + (v.cap ? `<div class="ic-note">⚖️ ${t('反壟斷：一人最多 {n} 家').replace('{n}', v.cap)}</div>` : '') + `</div>`); }
        if (typeof SHARES !== 'undefined') { const v = SHARES.view(w), s = v.st || {}; if (s.syn || s.sold || s.buy || s.out || s.caught || s.split || s.inh) d += this._icSub('📜 ' + t('股份'), `<div class="shares-meta">` + this._icGrid([{ v: s.syn || 0, l: t('合股買下') }, { v: s.sold || 0, l: t('賣股') }, { v: s.buy || 0, l: t('入股') }, { v: N(s.div || 0), l: t('分紅累計') }, s.caught ? { v: s.caught, l: t('抓到做假帳') } : null, s.out ? { v: s.out, l: t('股東會奪權') } : null, s.split ? { v: s.split, l: t('拆夥') } : null]) + `</div>`
            + (v.hist.length ? `<div class="shares-hist pg-hist">${v.hist.slice(0, 4).map(h => `<span><b>${esc(h.s)}</b>${t('：')}${esc(h.txt)}${h.a ? `<small>${t('（')}${esc(h.a)}${h.b ? ' / ' + esc(h.b) : ''}${t('）')}</small>` : ''}</span>`).join('')}</div>` : '')); }
        if (typeof INVEST !== 'undefined') { const v = INVEST.view(w), s = v.st || {}; if (s.buy || s.out || s.coop || v.bank) d += this._icSub('📊 ' + t('入股還是存銀行'), `<div class="invest-meta">` + this._icRows([[t('銀行存款一週'), v.bank + '%'], ...v.best.map(b => [`${esc(b.s)} <small>${t('每 1% 股份一週分紅')}</small>`, b.y])]) + this._icGrid([s.buy ? { v: s.buy, l: t('看利息入股') } : null, s.out ? { v: s.out, l: t('退股存銀行') } : null, s.coop ? { v: s.coop, l: '🤝 ' + t('合夥開店') } : null, s.coop && s.coopDiv ? { v: N(s.coopDiv), l: t('合夥店分紅') } : null]) + `</div>`); }
        const priv = rows.filter(r => r.owner).length; const rev = rows.reduce((s, r) => s + (r.rev7 || 0), 0);
        return this._ic({ id: 'ind-biz', cls: 'market-section', icon: '🏭', title: t('產業與老闆'), defOpen: true, sum: `<b>${rows.length}</b> ${t('家')}`,
            kpis: rows.length ? [{ v: rows.length, u: t('家'), l: t('產業') }, { v: priv, u: t('家'), l: t('有老闆') }, { v: N(rev), l: t('七天營收') }] : null,
            body: rows.length ? `<div class="pg-firms">${rows.map(firm).join('')}</div>` : `<div class="ic-note">${t('還沒有人經營產業。')}</div>`, detail: d,
            info: t('產業是大家每天都要買的民生行業（三餐、衣服、柴火、建材），一行一家，老闆會換，行業一直都在。') + t('公營的產業由公庫發薪水；有老闆的由老闆發薪水，賺的錢歸老闆和股東。「工資水準」是照標準工資的幾成在發。') });
    },
    // 鎮上的店(村民自己開的):前幾家直接看,其他收進詳細
    _indShops() {
        const w = this.world; if (typeof BIZ === 'undefined' || !w?.biz) return ''; const V = BIZ.view(w); if (!V.shops.length && !V.closed.length) return '';
        const esc = (x) => this._icEsc(x), N = (n) => this._icNum(n); const SHOW = 4;
        const row = (s) => `<div class="pg-firm pp-tier-line">` + this._indHead(`${s.icon} ${esc(s.name)}`, esc(s.type)) + this._indNums([[esc(s.owner), t('老闆')], s.partner ? [esc(s.partner), t('合夥人')] : null, [s.price, t('定價')], [N(s.profit), t('累計盈虧'), s.profit < 0 ? 'r' : s.profit > 0 ? 'g' : '']]) + `</div>`;
        const lose = V.shops.filter(s => s.profit < 0).length; const rest = V.shops.slice(SHOW);
        return this._ic({ id: 'ind-shops', cls: 'pp-biz', icon: '🏪', title: t('鎮上的店'), defOpen: false, sum: `<b>${V.shops.length}</b> ${t('家')}`,
            kpis: [{ v: V.shops.length, u: t('家'), l: t('營業中') }, { v: lose, u: t('家'), l: t('虧錢中'), tone: lose ? 'y' : '' }, { v: V.closed.length, u: t('家'), l: t('最近倒閉'), tone: V.closed.length ? 'r' : '' }],
            body: (V.shops.length ? `<div class="pg-firms">${V.shops.slice(0, SHOW).map(row).join('')}</div>` : `<div class="ic-note">${t('現在沒有店在營業。')}</div>`) + (rest.length ? `<div class="ic-note pg-more-n">${t('還有 {n} 家，點「展開詳細」看').replace('{n}', rest.length)}</div>` : ''),
            detail: (rest.length ? `<div class="pg-firms">${rest.map(row).join('')}</div>` : '') + (V.closed.length ? this._icSub(t('倒閉的店'), this._icPills(V.closed.map(c => esc(c.name)))) : ''),
            info: t('店是村民自己開的小生意，賣大家有閒錢才會買的東西（聽書喝茶、首飾、字畫、藥材），沒有夥計，生意不好就會倒。跟產業不一樣：產業賣的是每天都要買的東西。') });
    },
    // 工廠:每座一格(狀態、配方、工人、生產進度、倉庫)、訂單;可以蓋的收進詳細
    _indFactory() {
        const w = this.world, st = this.state; const esc = (x) => this._icEsc(x); const proc = st.processing || {}; const F = proc.builtFactories || {}; const FD = typeof FACTORIES !== 'undefined' ? FACTORIES : {};
        const keys = Object.keys(F).filter(k => FD[k]); const act = keys.filter(k => F[k].status === 'active').length, bld = keys.filter(k => F[k].status === 'building').length;
        const orders = (proc.orders || []).filter(o => o.status === 'active'); let avail = []; try { avail = w.processing?.getAvailableFactories?.(w) || []; } catch (e) {}
        const one = (k) => { const f = F[k], def = FD[k]; let h = `<div class="pg-firm pg-fac2">`;
            if (f.status === 'building') { const p = Math.round(f.buildProgress / Math.max(1, f.buildRequired) * 100); return h + this._indHead(`${def.icon} ${esc(t(def.name))}`, `${t('建造中')} ${p}%`, 'y') + `<div class="ic-bar"><i style="width:${Math.max(2, p)}%"></i></div></div>`; }
            h += this._indHead(`${def.icon} ${esc(t(def.name))}`, f.status === 'active' ? t('運作中') : esc(f.status || ''), f.status === 'active' ? 'g' : '');
            if (f.status !== 'active') return h + `</div>`;
            const rc = (def.recipes || []).find(r => r.id === f.recipe); const names = (f.workers || []).map(id => esc(t(st.agents?.[id]?.name || id)));
            h += this._indKv(t('配方'), this._icPills((def.recipes || []).map(r => `<span class="${r.id === f.recipe ? 'pg-on' : 'pg-off'}">${r.id === f.recipe ? '▶ ' : ''}${esc(r.label)}</span>`)) || `<span class="ic-note">${t('還沒選配方')}</span>`);
            h += this._indKv(`${t('工人')} ${names.length}/${def.workerSlots}`, names.length ? this._icPills(names) : `<span class="ic-note">${t('（村民明早會自動上工）')}</span>`);
            if (rc) { const p = Math.min(100, Math.round(f.productionProgress / Math.max(1, rc.time) * 100)); h += `<div class="pg-stage"><span>${t('生產進度')}</span><div class="ic-bar"><i style="width:${Math.max(2, p)}%"></i></div><b>${p}%</b></div>`; }
            const wh = Object.entries(f.warehouse || {}); if (wh.length) h += this._indKv(t('倉庫'), this._icPills(wh.map(([r, a]) => `${this._PG_RI[r] || '📦'} ${esc(this._resName(r))} <b>${a}</b>`)));
            return h + `</div>`; };
        const ord = orders.length ? this._icSub('📋 ' + t('訂單') + ` <small>${t('有貨時村民自己交')}</small>`, `<div class="pg-firms">${orders.map(o => `<div class="pg-firm">` + this._indHead(esc(o.description), '') + this._icPills([`💰 ${t('獎勵')} <b>${o.reward}</b> ${t('銀幣')}`, `⏳ ${t('剩 {n} 天').replace('{n}', o.daysLeft)}`]) + `</div>`).join('')}</div>`) : '';
        const can = avail.length ? this._icSub(t('可建造工廠（等村民提案）'), `<div class="pg-firms">${avail.map(f => `<div class="pg-firm pg-fac${f.canAfford ? '' : ' short'}">` + this._indHead(`${f.icon} ${esc(t(f.name))}`, `⏱️ ${t('建造天數：')}${f.buildDays}`) + this._indRes(f.cost, true) + `</div>`).join('')}</div>`) : '';
        return this._ic({ id: 'ind-fac', icon: '🏭', title: t('工廠'), defOpen: false, sum: `<b>${keys.length}</b> ${t('座')}`, chip: bld ? { t: `${t('建造中')} ${bld}`, tone: 'y' } : null,
            kpis: [{ v: act, u: t('座'), l: t('運作中') }, { v: bld, u: t('座'), l: t('建造中') }, { v: orders.length, u: t('張'), l: t('訂單') }],
            body: (keys.length ? `<div class="pg-firms">${keys.map(one).join('')}</div>` : `<div class="ic-note">${avail.length ? t('鎮上還沒有工廠。可以蓋哪些在「展開詳細」裡，等村民提案。') : t('鎮上還沒有工廠，也還沒研究出可以蓋的工廠。')}</div>`) + ord, detail: can });
    },
    // 基礎產業:小鎮等級、每個產業(等級、效果、工人、每天產出、升級要什麼)、產業加成
    _indBase(before) {
        const ind = this.state.industry || {}; const esc = (x) => this._icEsc(x); const ID = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES : {};
        const list = Object.entries(ind.industries || {}); const syn = ind.activeSynergies || [];
        const one = ([key, data]) => { const def = ID[key]; const lv = def?.levels?.find(l => l.lv === data.level), nx = def?.levels?.find(l => l.lv === data.level + 1); const wk = Array.isArray(data.workers) ? data.workers.length : (data.workers || 0); const out = Object.entries(data.dailyOutput || {});
            return `<div class="pg-firm build-card">` + this._indHead(`${def?.icon || '?'} ${esc(def?.name || key)}`, `Lv${data.level}`, 'own')
                + (lv ? `<div class="ic-note">${esc(lv.bonus || lv.name)}</div>` : '')
                + this._indKv(t('工人'), `<span><b>${wk}</b>/${lv?.workers || '?'}</span>`)
                + (out.length ? this._indKv(t('每天產出'), this._indRes(Object.fromEntries(out))) : '')
                + (nx ? this._indKv(t('升下一級要'), this._indRes(nx.cost, true)) : '') + `</div>`; };
        let avail = []; if (ind.needsIndustryChoice || ind._pendingUnlock) { try { avail = this.world.industry.getAvailableIndustries(this.world) || []; } catch (e) {} }
        const pick = avail.length ? this._icSub(ind.needsIndustryChoice ? t('第一個產業（等村民提案）') : t('可開啟新產業（等村民提案）'), `<div class="pg-firms">${avail.map(i => `<div class="pg-firm build-card">` + this._indHead(`${i.icon} ${esc(t(i.name))}`, '') + `<div class="ic-note">${esc(i.desc)}</div></div>`).join('')}</div>`) : '';
        return this._ic({ id: 'ind-base', icon: '🏘️', title: t('基礎產業'), defOpen: !before || !!(ind.needsIndustryChoice || ind._pendingUnlock), /* 前面沒有別的卡(剛開鎮)或正等著選產業時先展開 */ chip: { t: `${ind.townLevelName || t('荒村')} Lv${ind.townLevel || 1}`, tone: '' }, sum: `<b>${list.length}</b>/${ind.maxIndustries || 1}`,
            kpis: [{ v: `Lv${ind.townLevel || 1}`, l: `${t('小鎮等級')}・${ind.townLevelName || t('荒村')}` }, { v: ind.maxIndustries || 1, l: t('產業上限') }, { v: list.length, l: t('已開啟') }],
            body: (list.length ? `<div class="pg-firms">${list.map(one).join('')}</div>` : (pick ? '' : `<div class="ic-note">${t('還沒有開啟任何產業。')}</div>`)) + pick
                + (syn.length ? this._icSub('✨ ' + t('產業加成') + ` <small>${syn.length}</small>`, this._icPills(syn.map(s => `${s.icon} ${esc(t(s.name))}`))) : '') });
    },
    // 農場:每塊田一格(狀態、作物、進度條、水分),收穫紀錄收進詳細
    _indFarm() {
        const st = this.state; const farm = st.farm || {}; const plots = farm.plots || []; if (!plots.length && !st.industry?.industries?.agriculture && !st.industry?.industries?.farming) return '';
        const esc = (x) => this._icEsc(x); const CR = typeof CROPS !== 'undefined' ? CROPS : {};
        const SI = { empty: '🟫', tilled: '🟤', growing: '🌱', ready: '✅', withered: '🥀' }, SL = { empty: t('空地'), tilled: t('已翻土'), growing: t('生長中'), ready: t('可收穫'), withered: t('枯萎') }, ST = { growing: 'g', ready: 'own', withered: 'r' };
        const cnt = (s) => plots.filter(p => p.state === s).length; const wd = cnt('withered'), rd = cnt('ready'), dry = plots.filter(p => p.state === 'growing' && p.waterLevel < 30).length;
        const one = (p) => { const crop = p.crop ? CR[p.crop] : null; let h = `<div class="pg-firm pg-plot build-card">` + this._indHead(`${SI[p.state] || '?'}${t(' 田地 #')}${p.id}`, esc(SL[p.state] || p.state), ST[p.state] || '');
            if (crop && (p.state === 'growing' || p.state === 'ready')) h += `<div class="pg-plot-c">${crop.icon} ${esc(t(crop.name))}${p.fertilized ? ` <span class="ic-pill">🧪 ${t('已施肥')}</span>` : ''}</div>`;
            if (crop && p.state === 'growing') { const g = Math.round(p.growthProgress), wl = Math.round(p.waterLevel); h += `<div class="pg-stage"><span>${t('進度')}</span><div class="ic-bar"><i style="width:${Math.max(2, g)}%"></i></div><b>${g}%</b></div><div class="pg-stage pg-water${wl < 30 ? ' low' : ''}"><span>💧 ${t('水分')}</span><div class="ic-bar"><i style="width:${Math.max(2, wl)}%"></i></div><b>${wl}%</b></div>`; }
            return h + `</div>`; };
        const log = (farm.harvestLog || []).slice(-5).reverse();
        return this._ic({ id: 'ind-farm', icon: '🌾', title: t('農場'), defOpen: false, chip: { t: `${plots.length}/${farm.maxPlots || 0} ${t('塊田')}`, tone: wd ? 'r' : '' }, sum: rd ? `✅ ${rd}` : '',
            alert: wd ? { t: t('{n} 塊田枯萎了').replace('{n}', wd), tone: 'y' } : dry ? { t: t('{n} 塊田快沒水了').replace('{n}', dry), tone: 'y' } : null,
            kpis: plots.length ? [{ v: cnt('growing'), u: t('塊'), l: t('生長中') }, { v: rd, u: t('塊'), l: t('可收穫'), tone: rd ? 'g' : '' }, { v: cnt('empty') + cnt('tilled'), u: t('塊'), l: t('空地') }].concat(wd ? [{ v: wd, u: t('塊'), l: t('枯萎'), tone: 'r' }] : []) : null,
            body: plots.length ? `<div class="pg-plots">${plots.map(one).join('')}</div>` : `<div class="ic-note">${t('需要先開啟農業產業才能使用農場。')}</div>`,
            detail: log.length ? this._icSub(t('收穫紀錄'), this._icRows(log.map(h => [`${esc(t(h.cropName))} <b>×${h.amount}</b> <small>${esc(t(h.quality))}</small>`, `${esc(t(h.season))}・${t('第 {n} 天').replace('{n}', h.day)}`]), 'pg-harv')) : '' });
    },
    // 銀行:狀態、存款／放款／準備金,其他一列一項
    _indBank() {
        const w = this.world; if (typeof BANK === 'undefined' || !w?.bank) return ''; const V = BANK.view(w); const esc = (x) => this._icEsc(x), N = (n) => this._icNum(n);
        const chip = V.status === 'run' ? { t: t('擠兌中'), tone: 'r' } : V.status === 'failed' ? { t: t('已倒閉'), tone: 'r' } : V.open ? { t: t('營業中'), tone: 'g' } : { t: t('還沒開'), tone: '' };
        const P = (n) => `${n} ${t('人')}`; let body = '';
        if (V.open) body += this._icRows([[t('銀行家'), esc(V.banker || '')], [t('放款利率'), `${V.rate}%${V.why ? ` <small>${t('（')}${esc(V.why)}${t('）')}</small>` : ''}`], [t('呆帳'), N(V.bad), V.bad > 0 ? 'y' : ''],
            V.bizLent ? [`🏗️ ${t('創業與蓋房貸款')}・${t('累計')}`, `${N(V.bizLent)} ${t('銀幣')}`] : null, V.bizLent && V.biz ? [`🏗️ ${t('創業與蓋房貸款')}・${t('還在還')}`, P(V.biz)] : null]);
        else if (V.failed) body += `<div class="ic-note">${t('上次倒閉讓存戶損失 {n} 銀幣').replace('{n}', V.failed.lost)}</div>`;
        else body += `<div class="ic-note">${t('升格為城鎮後就會有銀行。')}</div>`;
        if (V.pending) body += `<div class="ic-note">⏳ ${t('銀行暫停營業，等鎮長決定要不要紓困')}</div>`;
        const more = this._icRows([V.bonds ? [`📜 ${t('流通中的債券')}`, `${N(V.bonds)} ${t('銀幣')} <small>${t('（')}${P(V.bondHolders)} · ${t('利息')} ${V.bondRate}%${t('）')}</small>`] : null, V.bonds && V.defaults ? [t('違約'), V.defaults, 'r'] : null,
            V.debt ? [`🏛️ ${t('鎮公所紓困債')}`, `${N(V.debt.owed)} ${t('銀幣')} <small>${t('（')}${t('已還')} ${N(V.debt.paid)}${V.debt.late ? ` · ⚠️ ${t('逾期 {n} 天').replace('{n}', V.debt.late)}` : ''}${t('）')}</small>`, V.debt.late ? 'r' : ''] : null]);
        if (V.bail) body += `<div class="ic-note pg-bail">${V.bail.yes ? '🛟' : '🚫'} ${esc((V.bail.yes ? t('{m}決定紓困（{n} 銀幣）') : t('{m}拒絕紓困')).replace('{m}', V.bail.by).replace('{n}', V.bail.n))}${V.bail.why ? ` <small>${t('「')}${esc(V.bail.why)}${t('」')}</small>` : ''}</div>`;
        if (!V.debt && V.debtDone) body += `<div class="ic-note">🎉 ${t('紓困債已還清（共 {n} 銀幣）').replace('{n}', V.debtDone.paid)}</div>`;
        return this._ic({ id: 'ind-bank', cls: 'pp-bank', icon: '🏦', title: t('銀行'), defOpen: false, chip,
            alert: V.status === 'run' ? { t: t('銀行正在擠兌'), tone: 'r' } : V.pending ? { t: t('銀行暫停營業，等鎮長決定要不要紓困'), tone: 'y' } : null,
            kpis: V.open ? [{ v: N(V.dep), l: `${t('存款')}${t('（')}${P(V.savers)}${t('）')}` }, { v: N(V.loan), l: `${t('放款')}${t('（')}${P(V.borrowers)}${t('）')}` }, { v: N(V.reserve), l: t('準備金') }] : null, body: body + more });
    },
    // 貧富與住房:貧富差距、今天沒飯吃、無家可歸;房屋數字一格一項
    _indLife() {
        const w = this.world; if (typeof MARKET === 'undefined' || !w?.market) return ''; const N = (n) => this._icNum(n);
        const gini = MARKET.gini(w); const hung = Object.values(w.market.hungry || {}).filter(n => n >= 1).length; const e = (typeof ESTATE !== 'undefined' && w.estate) ? ESTATE.view(w) : null; const B = w.bank;
        const grid = e ? this._icSub('🏠 ' + t('房屋'), this._icGrid([{ v: e.units, u: t('棟'), l: t('房屋') }, { v: e.vacant, u: t('棟'), l: t('空屋') }, { v: e.townOwned, u: t('棟'), l: t('公有') }, { v: e.landlords, u: t('人'), l: t('房東') }, { v: e.rent, l: t('平均週租') }, { v: e.servants, u: t('人'), l: t('傭人') },
            e.stats?.foreclosed ? { v: e.stats.foreclosed, u: t('棟'), l: t('被銀行收走'), tone: 'y' } : null, w.market.strikes ? { v: w.market.strikes, l: t('罷工') } : null, B?.bankerProfit ? { v: N(B.bankerProfit), l: t('銀行家利潤') } : null])) : '';
        return this._ic({ id: 'ind-life', cls: 'market-life', icon: '⚖️', title: t('貧富與住房'), defOpen: false, sum: `${t('吉尼')} <b>${gini}</b>`,
            alert: hung ? { t: t('今天有 {n} 人沒飯吃').replace('{n}', hung), tone: 'r' } : (e && e.homelessPeople) ? { t: t('{n} 人無家可歸').replace('{n}', e.homelessPeople), tone: 'y' } : null,
            kpis: [{ v: gini, l: t('吉尼係數'), tone: gini >= 0.6 ? 'y' : '' }, { v: hung, u: t('人'), l: t('今天沒飯吃'), tone: hung ? 'r' : '' }, e ? { v: e.homelessPeople, u: t('人'), l: t('無家可歸'), tone: e.homelessPeople ? 'y' : '' } : null].concat(w.market.deaths ? [{ v: w.market.deaths, u: t('人'), l: t('餓死'), tone: 'r' }] : []).filter(Boolean),
            body: grid, info: t('吉尼係數量的是貧富差距：0 代表大家一樣有錢，越接近 1 代表錢越集中在少數人手上。') });
    },
    // 金權與報社
    _indPower() {
        const w = this.world; if (typeof POWER === 'undefined' || !w?.power) return ''; const v = POWER.view(w); if (!v.gifts && !v.exposed && !v.spiked && !v.bought && !v.refused) return '';
        const esc = (x) => this._icEsc(x), N = (n) => this._icNum(n);
        return this._ic({ id: 'ind-power', cls: 'power-meta', icon: '💰', title: t('金權與報社'), defOpen: false, sum: `${t('政治獻金')} <b>${v.gifts}</b>`,
            kpis: [{ v: v.gifts, u: t('筆'), l: t('政治獻金') }, { v: v.exposed, l: '📰 ' + t('揭弊') }, { v: v.spiked, l: t('新聞被壓下'), tone: v.spiked ? 'y' : '' }],
            body: this._icGrid([{ v: N(v.donated), u: t('銀幣'), l: t('獻金總額') }, { v: v.refused, l: t('拒收') }, v.fired ? { v: v.fired, l: t('記者被開除') } : null, v.raised ? { v: v.raised, l: t('報導後加薪') } : null, v.recalls ? { v: v.recalls, l: t('罷免改選') } : null])
                + (v.owned.length ? `<div class="pg-owners">` + this._icSub('📰 ' + t('報社老闆'), this._icRows(v.owned.map(x => [esc(x[0]), esc(x[1])]))) + `</div>` : '') });
    },
    // 工會
    _indUnion() {
        const w = this.world; if (typeof UNION === 'undefined' || !w?.union?.on) return ''; const u = UNION.view(w); const esc = (x) => this._icEsc(x), N = (n) => this._icNum(n);
        return this._ic({ id: 'ind-union', cls: 'union-meta', icon: '✊', title: u.name, defOpen: false, chip: u.striking ? { t: t('罷工中'), tone: 'r' } : null, sum: `${t('會員')} <b>${u.members}</b>`,
            alert: u.striking ? { t: t('工會正在罷工'), tone: 'r' } : null,
            kpis: [{ v: u.members, u: t('人'), l: t('會員') }, { v: N(u.fund), l: t('罷工基金') }, { v: u.won, l: t('談成加薪') }],
            body: this._icRows([[t('領袖'), esc(t(u.leader))], [t('罷工失敗'), u.lost], u.fired ? [t('被開除'), `${u.fired} ${t('人')}`, 'y'] : null]) });
    },
    // 離鎮
    _indExile() {
        const w = this.world; if (typeof EXILE === 'undefined' || !w?.exile) return ''; const v = EXILE.view(w); if (!v || (!v.pending.length && !v.hist.length)) return ''; const esc = (x) => this._icEsc(x);
        return this._ic({ id: 'ind-exile', cls: 'exile-meta', icon: '⏳', title: t('離鎮'), defOpen: false, sum: v.pending.length ? `${t('限期離鎮')} <b>${v.pending.length}</b>` : '',
            body: (v.pending.length ? this._icSub(t('限期離鎮'), this._icRows(v.pending.map(p => [esc(p.name), `${t('剩 {n} 天').replace('{n}', p.left)}${p.n ? ` <small>${t('{n} 樣家當待處理').replace('{n}', p.n)}</small>` : ''}`]))) : '')
                + (v.hist.length ? this._icSub(t('最近離鎮'), this._icRows(v.hist.slice(0, 3).map(h => [`${esc(h.name)}${h.crime ? ' ⚖️' : ''}`, t('帶走 {n} 銀幣').replace('{n}', h.carried)]))) : '') });
    },

    // ---------- 科技頁底部(v9.19.1):支持與反對、發明名人堂改成資訊卡 ----------
    // 以前:革新派、保守派各是一整段名字(一百人的鎮就是一整面字);名人堂是一行一行的字
    // 現在:三派人數＋比例條,名字先列前幾位、全部名單收進「展開詳細」;名人堂一項一格
    _techIdeaCards(IS, projects) {
        const w = this.world; const esc = (x) => this._icEsc(x); const fx = IS.factions(w); const SHOW = 8;
        const P = fx.progressive.length, M = fx.moderate.length, C = fx.conservative.length, T = Math.max(1, P + M + C); const pc = (n) => Math.round(n / T * 100);
        const names = (arr, n) => this._icPills(arr.slice(0, n).map(x => esc(t(x))).concat(arr.length > n ? [`<span class="pg-off">+${arr.length - n}</span>`] : [])) || `<div class="ic-note">${t('（沒有）')}</div>`;
        const bar = `<div class="pg-split" role="img" aria-label="${esc(`${t('革新派')} ${P}, ${t('中間派')} ${M}, ${t('保守派')} ${C}`)}"><i class="a" style="flex:${P}"></i><i class="m" style="flex:${M}"></i><i class="c" style="flex:${C}"></i></div>`;
        let h = this._ic({ id: 'tc-fx', cls: 'pg-fx', icon: '⚖️', title: t('新技術的支持與反對'), defOpen: false, sum: `🚀 <b>${P}</b> · 🏺 <b>${C}</b>`, top: bar,
            kpis: [{ v: P, u: t('人'), l: `🚀 ${t('革新派')} ${pc(P)}%`, tone: 'g' }, { v: M, u: t('人'), l: `🤔 ${t('中間派')} ${pc(M)}%` }, { v: C, u: t('人'), l: `🏺 ${t('保守派')} ${pc(C)}%`, tone: 'y' }],
            body: this._icSub(`🚀 ${t('革新派')}`, names(fx.progressive, SHOW)) + this._icSub(`🏺 ${t('保守派')}`, names(fx.conservative, SHOW)),
            detail: (P > SHOW || C > SHOW) ? (P > SHOW ? this._icSub(`🚀 ${t('革新派')} <small>${P}</small>`, names(fx.progressive, 9999)) : '') + (C > SHOW ? this._icSub(`🏺 ${t('保守派')} <small>${C}</small>`, names(fx.conservative, 9999)) : '') : '',
            info: t('研究完成會帶來新觀念，靠村民聊天傳開；個性、年紀、職業和鎮上民風決定誰接受、誰反對。立場會影響競選政見，被新工坊搶了飯碗的匠人可能提案抗議。') });
        const all = (IS.inventions || []).slice().reverse();
        const one = (v) => `<div class="pg-firm pg-inv"><div class="pg-firm-h"><span class="market-name">${t('「')}${esc(t('{name}式{thing}').replace('{name}', t(v.by)).replace('{thing}', t(v.thing)))}${t('」')}</span></div>`
            + this._icPills([v.tech && projects[v.tech] ? `🔬 ${t('推進了')}${esc(t(projects[v.tech].name))}` : '', v.disputedBy ? `😤 ${esc(t('{who}說是他先想到的').replace('{who}', t(v.disputedBy)))}` : '']) + `</div>`;
        h += this._ic({ id: 'tc-inv', cls: 'pg-invs', icon: '✨', title: t('發明名人堂'), defOpen: false, sum: `<b>${all.length}</b>`,
            body: all.length ? `<div class="pg-firms">${all.slice(0, SHOW).map(one).join('')}</div>` + (all.length > SHOW ? `<div class="ic-note pg-more-n">${t('還有 {n} 項，點「展開詳細」看').replace('{n}', all.length - SHOW)}</div>` : '') : `<div class="ic-note">${t('還沒有人靈光一閃。有創意、勤快的村民工作時偶爾會想出新東西。')}</div>`,
            detail: all.length > SHOW ? `<div class="pg-firms">${all.slice(SHOW).map(one).join('')}</div>` : '' });
        return `<div class="ic-wrap pg-ind pg-ideas">${h}</div>`;
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
            // v9.18.1 連續的數字格收進同一個等寬格線(不再跟長文字擠在同一行、大小不一);長文字單獨一行，順序照原文
            let grid = null;
            G.forEach((g, i) => {
                if (stats[i]) { if (!grid) { grid = document.createElement('span'); grid.className = 'pg-stg'; el.appendChild(grid); } for (const st of stats[i]) { const z = /^[+\-−＋]?0(\.0+)?$/.test(st.v); const s2 = document.createElement('span'); s2.className = 'pg-st' + (z ? ' zero' : ''); s2.innerHTML = `<b>${this._icEsc(st.v)}${st.u ? `<small>${this._icEsc(st.u)}</small>` : ''}</b>${st.l ? `<span>${this._icEsc(st.l)}</span>` : ''}`; grid.appendChild(s2); } }
                else { grid = null; const s2 = document.createElement('span'); s2.className = 'pg-dot' + (gt(g).length > 12 ? ' wide' : ''); g.forEach(n => s2.appendChild(n)); el.appendChild(s2); }
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
    P.renderEconomy = function (container) { if (this.activeTab === 'econ-build' && this.world?.observerMode && this.state) { try { container.innerHTML = `<div class="economy-panel">${this._buildV2()}</div>`; return; } catch (e) { console.warn('[pages] build', e); } }
        if (this.activeTab === 'industry' && this.world?.observerMode && this.state) { try { container.innerHTML = `<div class="economy-panel">${this._industryV2()}</div>`; return; } catch (e) { console.warn('[pages] industry', e); } } // v9.19.1 產業頁改成資訊卡
        return _re.call(this, container); };
    const _ad = P.renderAgentDetail;
    P.renderAgentDetail = function (container) { const r = _ad.call(this, container); try { this._dtEnhance(container); } catch (e) { console.warn('[pages] detail', e); } return r; };
})();
