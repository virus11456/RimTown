// RimTown - app-towngen.js（v6.45.0）：種子隨機城鎮的介面與流程。
// 四個手寫鄰鎮都通車後，開始有新的城鎮被發現（商人帶消息、旅人傳聞、探險隊找到聚落）。
// 活著的鎮（含邊境鎮與四個鄰鎮）最多 10 個：發現時還有名額就開通馬車路線，第一次搭車過去才建立完整存檔；
// 名額滿了的只留城鎮卡，在背景慢慢變化、上日報跨鎮專欄、列在城鎮列表的「遠方城鎮」。
// 用 Object.assign 掛到 RimTownApp.prototype；放在 app-loop.js 之後（index.html／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    // 四個鄰鎮都通車了才開始發現新鎮
    _genTownsOpen() {
        try { return typeof NEIGHBOR_TOWNS !== 'undefined' && NEIGHBOR_TOWNS.every(d => localStorage.getItem(rimtownWorldKey(d.key)) === '1'); } catch (e) { return false; }
    },
    _genPlayerKey() {
        const wsuf = rimtownWorldId() === 'w0' ? '' : '#' + rimtownWorldId(); // v6.75.0 新世界會發現不同的遠方城鎮
        try { if (this.auth?.loggedIn && this.auth.username) return 'u:' + this.auth.username + wsuf; let k = localStorage.getItem('rimtown_gen_key'); if (!k) { k = 'g:' + Math.random().toString(36).slice(2, 12); localStorage.setItem('rimtown_gen_key', k); } return k; } catch (e) { return 'guest'; }
    },
    // 每個遊戲日跑一次:背景發展＋看看有沒有發現新鎮
    _genTownTick() {
        const w = this.world; if (!w || typeof TownGen === 'undefined' || !w.clock) return;
        const dayKey = `${w.clock.year}-${w.clock.season}-${w.clock.day}`;
        if (this._genDayKey === dayKey) return;
        const first = !this._genDayKey; this._genDayKey = dayKey;
        if (first) return; // 剛載入不算過了一天
        const reg = TownGen.registry();
        const days = (reg.days || 0) + 1; TownGen.bump('days', days);
        // 背景發展(只有城鎮卡、還沒建存檔的鎮)
        for (const c of TownGen.cards()) { if (c.townId) continue; const before = c.state ? c.state.news.length : 0; TownGen.drift(c, days); TownGen.setState(c.seed, c.state); if (c.state.news.length !== before) this._genCrossNewsAt = 0; }
        if (!this._genTownsOpen()) return;
        TownGen.bump('since', (reg.since || 0) + 1);
        // 探險隊凱旋:有機會發現新聚落
        let via = null, by = '';
        try {
            const log = w.exploration?.expeditionLog || []; const last = log[log.length - 1];
            if (last && last.success && (last.completedTick || 0) > (reg.seenExp || 0)) {
                TownGen.bump('seenExp', last.completedTick || 0);
                if (Math.random() < 0.35) { via = 'expedition'; by = (last.agentIds || []).map(id => w.agents[id]?.name).filter(Boolean).join(t('、')); }
            }
        } catch (e) {}
        const pros = w.prosperity?.prosperity || 0;
        if (!via && (reg.since || 0) >= 8 && pros >= 60 && Math.random() < 0.25) via = Math.random() < 0.5 ? 'merchant' : 'traveler';
        if (via) this._discoverGenTown(via, by);
    },
    _discoverGenTown(via, by = '') {
        const w = this.world; if (typeof TownGen === 'undefined') return null;
        const names = []; try { (this._getTownList() || []).forEach(tw => names.push(tw.name)); (this._cloudSaves || []).forEach(s => names.push(s.town_name)); } catch (e) {}
        const c = TownGen.discover(this._genPlayerKey(), { day: TownGen.registry().days || 0, via, by, names });
        if (!c) return null;
        const nm = TownGen.displayName(c);
        const how = via === 'expedition' ? t('探險隊（{who}）在野外找到一座聚落：{town}').replace('{who}', by || t('探險隊')).replace('{town}', nm)
            : via === 'merchant' ? t('路過的商人說起一座城鎮：{town}').replace('{town}', nm) : t('旅人帶來遠方的消息：{town}').replace('{town}', nm);
        const tail = t('馬車路線已經開通，去馬車站就能出發。'); // v6.76.0 探索過的都能去
        try { w.logMessage('system', `🗺️ ${how}${t('。')}${tail}`); } catch (e) {}
        try { w.dailyNews?.collectEvent?.('exploration', `🗺️ ${how}`, 6, by ? by.split(t('、')) : []); } catch (e) {}
        this._showCornerNotice?.({ icon: '🗺️', title: c.reachable ? t('發現新城鎮！') : t('遠方的傳聞'), name: nm, desc: `${TownGen.tags(c).slice(0, 3).join(' · ')}${t('。')}${tail}` });
        this._otherTownsAt = 0; this._genCrossNewsAt = 0;
        return c;
    },
    // ---------- v6.76.0 路況:探索過的城鎮都能搭馬車去,但下雪、坍方、淹水、盜匪會暫時封路 ----------
    _roadRoutes() {
        const w = this.world; const out = [];
        for (const tw of (w?.otherTowns || [])) { const th = (typeof themeKeyOfTownName === 'function' && themeKeyOfTownName(tw.name)) || this._guessTheme?.(tw.name) || ''; out.push({ name: tw.name, base: typeof baseThemeOf === 'function' ? baseThemeOf(th) : th }); }
        for (const c of (this._genReachableCards ? this._genReachableCards() : [])) out.push({ name: c.name, base: c.base || '' });
        return out;
    },
    _roadWhy: { snow: ['大雪封山', 'snowed in'], blizzard: ['暴風雪', 'blizzard'], landslide: ['土石坍塌', 'landslide'], flood: ['河水暴漲淹了路', 'flooded road'], bandits: ['盜匪攔路', 'bandits on the road'] },
    _roadInfo(name) {
        const w = this.world; const x = w?.roadClosures?.[rimtownCanonTown(name)]; if (!x) return null;
        const left = Math.max(1, x.until - (w._absDay?.() ?? 0));
        return { why: x.why, left, text: `${t(this._roadWhy[x.why]?.[0] || '路斷了')}${t('，')}${t('預計 {n} 天後通車').replace('{n}', left)}` };
    },
    _roadsTick() {
        const w = this.world; if (!w?.clock || !w._absDay) return; const d = w._absDay(); if (this._roadDay === d) return; this._roadDay = d;
        const R = w.roadClosures || (w.roadClosures = {});
        const name = (k) => (this._townDisplayName ? this._townDisplayName(k, this._guessTheme?.(k) || '') : t(k));
        for (const [k, x] of Object.entries(R)) if (x.until <= d) { delete R[k]; try { w.logMessageT?.('system', '🛤️ 往{town}的路通了，馬車恢復行駛。', { town: k }); } catch (e) {} }
        const wx = w.weather?.current || 'clear', dis = w.weather?.activeDisaster?.type || '';
        const tr = w.trials?.current; const bandits = (tr && tr.status === 'active' && /bandit/.test(String(tr.type || tr.key || ''))) || (w.news?.getModifier?.('raid_chance', 0) || 0) > 0;
        const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
        for (const r of this._roadRoutes()) {
            const k = rimtownCanonTown(r.name);
            if (R[k]) { if ((R[k].why === 'snow' && wx === 'snow') || (R[k].why === 'blizzard' && /blizzard/.test(dis))) R[k].until = Math.max(R[k].until, d + 1); continue; } // 還在下雪就繼續封
            let why = null, days = 0;
            if (/blizzard/.test(dis)) { why = 'blizzard'; days = 2; }
            else if (wx === 'snow' && (r.base === 'mountain' || Math.random() < 0.25)) { why = 'snow'; days = rnd(1, 2); }
            else if ((wx === 'rain' || wx === 'storm') && Math.random() < (r.base === 'mountain' ? 0.12 : 0.04) * (wx === 'storm' ? 1.5 : 1)) { why = 'landslide'; days = rnd(2, 4); }
            else if ((wx === 'rain' || wx === 'storm') && (r.base === 'harbor' || r.base === 'forest') && Math.random() < 0.05) { why = 'flood'; days = rnd(1, 3); }
            else if (bandits && Math.random() < 0.06) { why = 'bandits'; days = rnd(2, 3); }
            else if (Math.random() < 0.003) { why = 'landslide'; days = 2; } // 晴天也偶爾有落石
            if (!why) continue;
            R[k] = { why, until: d + days, since: d };
            try { w.logMessageT?.('system', '🚧 往{town}的路因為{why}暫時封了，預計 {n} 天後通車。', { town: k, why: this._roadWhy[why][0], n: days }); } catch (e) {}
            try { this._showCornerNotice?.({ icon: '🚧', title: t('封路'), name: name(k), desc: `${t(this._roadWhy[why][0])}${t('，')}${t('預計 {n} 天後通車').replace('{n}', days)}` }); } catch (e) {}
        }
        for (const tw of (w.otherTowns || [])) tw.closed = !!R[rimtownCanonTown(tw.name)]; // 村民出遠門也避開封路的鎮
    },
    // 馬車站的目的地:有存檔的鎮＋已開通但還沒去過的種子鎮
    _genReachableCards() {
        if (typeof TownGen === 'undefined') return [];
        return TownGen.cards().filter(c => c.reachable && !c.townId);
    },
    // 第一次搭車去:由種子建立完整存檔(本機＋雲端),之後就是一般城鎮
    async _visitGenTown(seed) {
        const c = TownGen.cards().find(x => x.seed === seed); if (!c) return;
        if (c.townId) { this._coachTravelTo(c.townId, c.name); return; }
        let tid = null;
        try {
            TownGen.register(c);
            const nw = new World();
            nw.townTheme = c.key; nw.townName = c.name; nw.rosterMode = 'random';
            nw.reset(); nw.worldId = rimtownWorldId(); // v6.75.0 新發現的鎮屬於目前的世界
            const blob = nw.serialize();
            // v6.48.1 先清掉以前存檔失敗留下的同名空殼(城鎮列表有、卻沒有任何存檔)
            this._genDropOrphans(c);
            tid = this._generateTownId(c.name);
            const meta = { season: blob.clock?.season || '春季', year: 1, day: 1, population: Object.keys(blob.agents || {}).length, theme: c.key, origin: 'generated', world: rimtownWorldId() };
            let stored = false; try { localStorage.setItem('rimtown_town_' + tid, JSON.stringify(blob)); stored = true; } catch (e) {}
            if (this.auth?.loggedIn) { try { await this.auth.cloudSave(tid, c.name, blob, meta); stored = true; this._cloudSaves = null; try { this._cloudSaves = await this.auth.listSaves(); } catch (e) {} } catch (e) {} }
            if (!stored) throw new Error(t('存檔空間不足'));
            // v6.48.1 存檔真的存到了才寫進城鎮列表(以前先寫列表,空間不足時每重試一次就多一座沒有存檔的同名鎮)
            const list = this._getTownList();
            if (!list.some(tw => tw.id === tid)) { list.push({ id: tid, name: c.name, savedAt: new Date().toISOString(), ...meta }); try { this._saveTownList(list); } catch (e) {} }
            TownGen.update(c.seed, { id: tid, r: 1 });
            this._otherTownsAt = 0;
        } catch (e) { this._gameAlert?.(t('建立城鎮失敗：') + e.message, '❌'); return; }
        this._coachTravelTo(tid, c.name);
    },
    _genDropOrphans(c) {
        try {
            const list = this._getTownList(); const cloud = new Set((this._cloudSaves || []).map(s => s.town_id));
            const keep = list.filter(tw => !(tw.origin === 'generated' && (tw.theme === c.key || tw.name === c.name) && !localStorage.getItem('rimtown_town_' + tw.id) && !cloud.has(tw.id)));
            if (keep.length !== list.length) this._saveTownList(keep);
        } catch (e) {}
    },
    // 日報跨鎮專欄:城鎮卡的傳聞(每鎮最新一則)
    _genCrossNews() {
        if (typeof TownGen === 'undefined') return [];
        const w = this.world; const out = [];
        for (const c of TownGen.cards()) {
            if (c.townId || !c.state || !c.state.news.length) continue;
            const n = c.state.news[c.state.news.length - 1];
            out.push({ town: TownGen.displayName(c), reporter: t('旅人傳聞'), year: w?.clock?.year, season: w?.clock?.season, day: w?.clock?.day, items: [TownGen.L(n)], _d: n.day || 0 });
        }
        return out.sort((a, b) => b._d - a._d).slice(0, 3).map(({ _d, ...x }) => x);
    },
    // 城鎮列表的「遠方城鎮」區塊
    _genTownSectionHtml() {
        if (typeof TownGen === 'undefined') return '';
        const cards = TownGen.cards(); if (!cards.length) return this._genTownsOpen() ? `<h4 class="town-section">🗺️ ${t('遠方城鎮')}</h4><p class="muted-text">${t('還沒有新的消息。小鎮夠繁榮時，商人、旅人和探險隊會帶回遠方城鎮的消息。')}</p>` : '';
        const esc = (x) => this._escapeHtml ? this._escapeHtml(String(x ?? '')) : String(x ?? '');
        const icon = { harbor: '🌊', mountain: '⛏️', forest: '🌲', market: '🏛️', frontier: '🌾' };
        const rows = cards.slice().reverse().map(c => {
            const status = c.townId ? t('已造訪') : c.reachable ? t('馬車可達・尚未造訪') : t('只有傳聞');
            const last = c.state?.news?.length ? TownGen.L(c.state.news[c.state.news.length - 1]) : '';
            const rc = this._roadInfo?.(c.name); const go = (!c.townId && c.reachable) ? (rc ? `<div class="town-meta" style="margin-top:6px">🚧 ${esc(rc.text)}</div>` : `<button class="town-btn town-btn-secondary" data-action="gen-visit" data-val="${c.seed}" style="margin-top:6px">🐴 ${t('搭馬車前往')}</button>`) : '';
            return `<div class="town-item gen-town"><div class="town-info" style="cursor:default">
                <div class="town-name">${icon[c.base] || '🏘️'} ${esc(TownGen.displayName(c))} <span class="town-tag">${esc(status)}</span></div>
                <div class="town-meta">${TownGen.tags(c).map(esc).join(' · ')}</div>
                <div class="town-meta" style="margin-top:4px;line-height:1.5">${esc(TownGen.blurb(c))}</div>
                ${last ? `<div class="town-meta" style="margin-top:4px">📰 ${esc(last)}</div>` : ''}${go}
            </div></div>`;
        }).join('');
        return `<h4 class="town-section">🗺️ ${t('遠方城鎮')} <span class="pp-count">${cards.length}</span></h4><p class="muted-text town-hint">${t('探索過的城鎮都能搭馬車去；遇到下雪、坍方、淹水或盜匪封路時，要等路通了才走得了。還沒去過的鎮會在背景慢慢變化。')}</p>` + rows;
    },
});
