// RimTown - app-relmap.js（v11.5.1）：村民 › 關係。
// 4.5.0 的「全鎮關係網」把所有人排成一圈、有關係就連線，十幾二十人時好用；城市一百多人時幾百條線疊成一團，名字擠在圓周上，點人也點不到。
// 改成三種看法：
//   清單（預設）：值得看的關係分區列出，有戲的排前面（最近的變化、三角關係、互有好感、死對頭；情侶夫妻只給總數、展開才列）
//   一個人的關係圖：他在中間，跟他有關係的人圍在四周；名字是一般按鈕（排版保證不重疊、手機點得到），線畫在底下的畫布
//   全鎮圖：只有 30 人以下的小鎮才提供（人一多就讀不出來）
// 只讀現有狀態，不動模擬、不改存檔。掛到 RimTownApp.prototype（放在 app.js、app-cards.js 之後載入）。
'use strict';

Object.assign(RimTownApp.prototype, {
    _RV_WEEK: 96 * 7,   // 一天 96 格；「最近」＝這一週
    _RV_MAX: 14,        // 個人圖最多畫幾個人：再多名字就排不下，先畫最有戲的
    _RV_TOWN_MAX: 30,   // 全鎮圖只給小鎮
    _RV_FIRST: 4,       // 每區先列幾筆，其餘收在「看全部」
    _RV_COL: { love: '#ff6b9d', affair: '#c084fc', crush: '#ff9ec6', foe: '#e05555', friend: '#5cc46a' },

    // ---------- 資料：一對人只算一種關係，結果快取到狀態變了才重算 ----------
    _rvName(id) { const a = this.world?.agents?.[id] || this.state?.agents?.[id]; const n = a?.name || id; try { return typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(n) : n; } catch (e) { return n; } },
    _rvData() {
        const w = this.world, st = this.state; if (!st?.agents) return null;
        const obs = !!w?.observerMode; const ids = Object.keys(st.agents).filter(id => !(obs && id === 'player') && !w?.agents?.[id]?.isDead);
        const lang = typeof I18N !== 'undefined' && I18N.getLang ? I18N.getLang() : 'zh';
        const sv = typeof Relationship !== 'undefined' ? Relationship._sv : 0;
        // 為什麼用這幾個當鍵：關係只會在模擬走一格（tickCount）或感情狀態改變（_sv）時變；暫停時、只切篩選、換人看都不必重算
        const key = `${w?.tickCount ?? ''}|${sv}|${ids.length}|${lang}`;
        if (this._rvC && this._rvC.key === key && this._rvC.st === st) return this._rvC.d;
        const d = this._rvBuild(ids); this._rvC = { key, st, d }; return d;
    },
    // 兩個方向的關係物件：有 world 用即時物件（才有 statusSince、isFeud、isCheating、記憶），沒有就用 state 的 toDict
    _rvRels(id) {
        const live = this.world?.agents?.[id]?.relationships?.relationships; if (live) return live;
        const out = {}; for (const r of Object.values(this.state?.agents?.[id]?.relationships || {})) if (r?.target_id) out[r.target_id] = { targetId: r.target_id, affinity: r.affinity, romanticInterest: r.romantic_interest, status: r.status, isCheating: r.is_cheating };
        return out;
    },
    _rvBuild(ids) {
        const W = this.world, now = W?.tickCount || 0, week = this._RV_WEEK; const has = new Set(ids);
        const relOf = {}; for (const id of ids) relOf[id] = this._rvRels(id);
        const pairs = [], byP = {}, seen = new Set(); const partner = {};
        const crushOn = (r) => r && !r.status && (r.romanticInterest || 0) > 55;
        const hates = (r) => r && ((r.affinity || 0) < -55 || r.isFeud);
        for (const a of ids) for (const b in relOf[a]) {
            if (!has.has(b) || a === b) continue; const k = a < b ? a + '|' + b : b + '|' + a; if (seen.has(k)) continue; seen.add(k);
            const ab = relOf[a][b], ba = relOf[b]?.[a]; const st = ab?.status || ba?.status;
            let p = null;
            if (st === 'dating' || st === 'married') { const m = ab?.status === 'married' || ba?.status === 'married'; p = { kind: 'love', sub: m ? 'married' : 'dating', since: Math.max(ab?.statusSince || 0, ba?.statusSince || 0), score: m ? 100 : 95 }; partner[a] = partner[a] || b; partner[b] = partner[b] || a; }
            else if (ab?.isCheating || ba?.isCheating) p = { kind: 'love', sub: 'affair', score: 98 };
            else if (crushOn(ab) || crushOn(ba)) { const x = crushOn(ab), y = crushOn(ba); p = { kind: 'crush', sub: x && y ? 'mutual' : x ? 'a2b' : 'b2a', score: x && y ? 85 : 70 + Math.max(ab?.romanticInterest || 0, ba?.romanticInterest || 0) / 20 }; }
            else if (hates(ab) || hates(ba)) { const x = hates(ab), y = hates(ba), feud = !!(ab?.isFeud || ba?.isFeud); p = { kind: 'foe', sub: feud ? 'feud' : x && y ? 'mutual' : x ? 'a2b' : 'b2a', mutual: feud || (x && y), score: feud ? 80 : x && y ? 75 : 60, heat: (ab?.affinity || 0) + (ba?.affinity || 0) }; }
            else if ((ab?.affinity || 0) > 70 || (ba?.affinity || 0) > 70) p = { kind: 'friend', sub: 'friend', score: 30 + Math.max(ab?.affinity || 0, ba?.affinity || 0) / 10 };
            // 剛分手／離婚：status 變成 ex 的那一刻記在 statusSince；太久以前的就不算「最近」
            const exSince = (ab?.status === 'ex' && ab.statusSince) || (ba?.status === 'ex' && ba.statusSince) || 0;
            if (exSince && now - exSince <= week) pairs.push({ a, b, kind: 'ex', since: exSince, divorce: this._rvDivorced(a, b, exSince) });
            if (!p) continue; p.a = a; p.b = b; // 排序用的原始數字：兩個方向的心動、好感，兩人最近一次往來是第幾格
            p.riA = ab?.romanticInterest || 0; p.riB = ba?.romanticInterest || 0; p.afA = ab?.affinity || 0; p.afB = ba?.affinity || 0; p.last = Math.max(ab?.lastInteractionTick || 0, ba?.lastInteractionTick || 0);
            pairs.push(p); (byP[a] = byP[a] || []).push(p); (byP[b] = byP[b] || []).push(p);
        }
        const name = {}; for (const id of ids) name[id] = this._rvName(id);
        const rel = pairs.filter(p => p.kind !== 'ex');
        const ago = (s) => Math.max(0, Math.floor((now - s) / 96));
        // 最近的變化：只用遊戲裡真的有時間的資料（statusSince、絕交那天寫進記憶的紀錄）
        const recent = [];
        for (const p of pairs) {
            if (p.kind === 'love' && p.since > 0 && now - p.since <= week) recent.push({ t: p.sub === 'married' ? 'wed' : 'date', a: p.a, b: p.b, f: 'love', ago: ago(p.since), at: p.since });
            else if (p.kind === 'ex') recent.push({ t: p.divorce ? 'divorce' : 'split', a: p.a, b: p.b, f: 'love', ago: ago(p.since), at: p.since });
            else if (p.kind === 'foe' && p.sub === 'feud') { const at = this._rvFeudAt(p.a, p.b); if (at && now - at <= week) recent.push({ t: 'feud', a: p.a, b: p.b, f: 'foe', ago: ago(at), at }); }
        }
        recent.sort((x, y) => y.at - x.at);
        // 排序：有戲的在前。fresh＝最近兩天還有往來 +15、這一週感情狀態才變過 +30（見回報裡的式子）
        const fresh = (p) => (p.last && now - p.last <= 192 ? 15 : 0) + (p.since > 0 && now - p.since <= week ? 30 : 0);
        const ri = (p, x) => (p.a === x ? p.riA : p.riB); // x 對另一個人的心動
        const crushes = rel.filter(p => p.kind === 'crush'); const pk = (x, y) => (x < y ? x + '|' + y : y + '|' + x);
        // 三角關係只留真的有拉扯的：偷偷交往、互相喜歡但其中一方有伴、同一個人被兩個以上的人喜歡而且他也對其中一位有意思
        const tri = [];
        for (const p of rel) if (p.kind === 'love' && p.sub === 'affair') { const pa = partner[p.a], pb = partner[p.b]; const s0 = 300 + (p.riA + p.riB) / 2 + fresh(p);
            tri.push(pa ? { t: 'affair', a: p.a, b: p.b, c: pa, f: 'love', s: s0, k: pk(p.a, p.b) } : pb ? { t: 'affair', a: p.b, b: p.a, c: pb, f: 'love', s: s0, k: pk(p.a, p.b) } : { t: 'secret', a: p.a, b: p.b, f: 'love', s: s0 - 20, k: pk(p.a, p.b) }); }
        for (const p of crushes) if (p.sub === 'mutual') { const [x, y] = partner[p.a] && partner[p.a] !== p.b ? [p.a, p.b] : [p.b, p.a];
            if (partner[x] && partner[x] !== y) tri.push({ t: 'mtaken', a: y, b: x, c: partner[x], f: 'crush', s: 200 + (p.riA + p.riB) / 2 + fresh(p), k: pk(x, y) }); }
        const fans = {}; for (const p of crushes) { if (p.sub !== 'b2a') (fans[p.b] = fans[p.b] || []).push({ who: p.a, p }); if (p.sub !== 'a2b') (fans[p.a] = fans[p.a] || []).push({ who: p.b, p }); }
        const taken = new Set(tri.map(x => x.k));
        for (const y in fans) { const F = fans[y]; if (F.length < 2) continue; const back = F.filter(f => f.p.sub === 'mutual' && !taken.has(pk(f.who, y))).sort((u, v) => ri(u.p, y) - ri(v.p, y)).pop(); if (!back) continue;
            const rival = F.filter(f => f.who !== back.who).sort((u, v) => ri(u.p, u.who) - ri(v.p, v.who)).pop();
            tri.push({ t: 'rival', a: back.who, b: y, c: rival.who, f: 'crush', s: 150 + (ri(back.p, back.who) + ri(rival.p, rival.who)) / 2 + 5 * (F.length - 2) + fresh(back.p), k: pk(back.who, y) }); taken.add(pk(back.who, y)); }
        tri.sort((x, y) => y.s - x.s);
        const inTri = new Set(tri.map(x => x.k));
        const byS = (L) => L.sort((x, y) => y.s - x.s);
        const mutual = byS(crushes.filter(p => p.sub === 'mutual' && !inTri.has(pk(p.a, p.b))).map(p => ({ t: 'mutual', a: p.a, b: p.b, f: 'crush', s: (p.riA + p.riB) / 2 + fresh(p) })));
        // 單戀：單方面的喜歡，句子寫出對方有沒有伴
        const crush = byS(crushes.filter(p => p.sub !== 'mutual').map(p => { const [x, y] = p.sub === 'a2b' ? [p.a, p.b] : [p.b, p.a]; const r = ri(p, x) + fresh(p);
            return partner[y] && partner[y] !== x ? { t: 'taken', a: x, b: y, c: partner[y], f: 'crush', s: r + 15 } : partner[x] && partner[x] !== y ? { t: 'stray', a: x, b: y, c: partner[x], f: 'crush', s: r + 10 } : { t: 'single', a: x, b: y, f: 'crush', s: r }; }));
        const foes = byS(rel.filter(p => p.kind === 'foe' && p.mutual).map(p => ({ t: p.sub === 'feud' ? 'feud2' : 'foe', a: p.a, b: p.b, f: 'foe', s: -(p.afA + p.afB) / 2 + (p.sub === 'feud' ? 40 : 0) + fresh(p) })));
        // 情侶夫妻：越接近出事（兩人裡比較冷淡的那一方好感越低）越前面
        const couples = byS(rel.filter(p => p.kind === 'love' && p.sub !== 'affair').map(p => ({ t: p.sub === 'married' ? 'married' : 'dating', a: p.a, b: p.b, f: 'love', days: p.since > 0 ? Math.max(1, ago(p.since)) : 0, s: 100 - Math.min(p.afA, p.afB) + fresh(p) })));
        const friends = byS(rel.filter(p => p.kind === 'friend').map(p => ({ t: 'friend', a: p.a, b: p.b, f: 'friend', s: Math.max(p.afA, p.afB) + fresh(p) })));
        return { ids, name, rel, byP, partner, recent, tri, mutual, crush, foes, couples, friends, any: rel.length + recent.length };
    },
    // 離婚還是分手：ex 不記得原本是交往還是結婚，看兩人那時候寫進記憶的那一句（「我和{x}離婚了」、劈腿被抓到時的「我們{action}了」）
    _rvDivorced(a, b, since) {
        for (const id of [a, b]) { const E = this.world?.agents?.[id]?.memory?.entries; if (!E) continue;
            for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; if (e.tick < since - 2) break; if (e.category !== 'relationship' || !e.k) continue;
                if (e.k.includes('離婚了') || (e.k.includes('{action}') && /離婚|divorc/i.test(String(e.p?.action || '')))) return true; } }
        return false;
    },
    // 絕交那天：isFeud 本身沒有時間，絕交當下兩人各寫了一筆記憶（simulation.js「徹底鬧翻,絕交了」），拿那一筆的 tick
    _rvFeudAt(a, b) {
        const nb = this.world?.agents?.[b]?.name; const E = this.world?.agents?.[a]?.memory?.entries; if (!E || !nb) return 0;
        for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; if (e.category === 'relationship' && e.k && e.k.includes('徹底鬧翻') && Object.values(e.p || {}).includes(nb)) return e.tick || 0; }
        return 0;
    },

    // ---------- 畫面 ----------
    _rvState() { if (!this._rv) this._rv = { view: 'list', who: null, from: 'list' }; if (!this._relmapFilters) this._relmapFilters = { love: true, crush: true, foe: true, friend: false }; return this._rv; },
    renderRelationMap(container) {
        if (!this.state) return;
        this._firstDayMark?.('relations'); // v5.18.0 第一天:發現一段關係
        const S = this._rvState(), D = this._rvData(); if (!D) return;
        const small = D.ids.length <= this._RV_TOWN_MAX;
        if (S.view === 'person' && !D.name[S.who]) S.view = S.from === 'town' && small ? 'town' : 'list'; // 人走了或過世了
        if (S.view === 'town' && !small) S.view = 'list';
        this._rvWire();
        let h = `<div class="rv-wrap">${this._rvTop(D, S, small)}`;
        if (S.view === 'person') h += this._rvPerson(D, S.who);
        else if (S.view === 'town') h += `<div class="rv-town"><canvas id="relmap-canvas" class="rv-tcv" aria-label="${this._icEsc(t('全鎮關係網'))}"></canvas><div class="ic-note">${t('點任何人，看他一個人的關係。')}</div></div>`;
        else h += this._rvList(D);
        container.innerHTML = h + '</div>';
        if (S.view !== 'list') { const go = S.view === 'person' ? () => this._rvPaint() : () => this._drawRelationMap(); if (!container.isConnected || go() === false) this._rvLater(go); } // 已經掛在畫面上就馬上畫（3D 畫面忙的時候下一個畫格可能要等很久）；自動重畫是先畫在還沒掛上去的容器，要等換上去之後的畫格
    },
    _rvTop(D, S, small) {
        const esc = (x) => this._icEsc(x), f = this._relmapFilters;
        const opts = D.ids.slice().sort((x, y) => D.name[x].localeCompare(D.name[y], 'zh-Hant')).map(id => { const n = (D.byP[id] || []).length; return `<option value="${esc(id)}"${S.view === 'person' && S.who === id ? ' selected' : ''}>${esc(D.name[id])}${n ? ` (${n})` : ''}</option>`; }).join('');
        const pick = `<label class="rv-pick"><span aria-hidden="true">🔍</span><select data-rv-pick aria-label="${esc(t('看某個人的關係'))}"><option value="">${esc(t('看某個人的關係…'))}</option>${opts}</select></label>`;
        const seg = small ? `<div class="rv-seg" role="group">${[['list', '📋', t('清單')], ['town', '🕸️', t('全鎮圖')]].map(([k, i, l]) => `<button type="button" data-action="rv-view" data-val="${k}" aria-pressed="${S.view === k || (k === 'list' && S.view === 'person' && S.from !== 'town') || (k === 'town' && S.view === 'person' && S.from === 'town')}">${i} ${esc(l)}</button>`).join('')}</div>` : '';
        const chip = (k, label) => `<button type="button" class="rv-chip k-${k}" data-action="relmap-filter" data-val="${k}" aria-pressed="${!!f[k]}">${esc(label)}</button>`; // 四個等寬一排：標籤用這一頁自己的短字串（英文 Best Friends 放不下）
        return `<div class="rv-top">${pick}${seg}<div class="rv-chips">${chip('love', t('💕 戀愛'))}${chip('crush', t('💘 單戀'))}${chip('foe', t('💢 敵對'))}${chip('friend', t('💚 摯友'))}</div></div>`;
    },
    // 句子：名字是可以點的按鈕（打開他的關係圖），整筆點了鏡頭跟到第一個人
    _rvNm(D, id) { return `<span class="rv-nm" role="button" tabindex="0" data-action="rv-person" data-val="${this._icEsc(id)}">${this._icEsc(D.name[id])}</span>`; }, // 行內連結：可點範圍用上下內距撐大，不撐高行距
    _RV_TXT: {
        date: ['💕', '{a}和{b}開始交往了'], wed: ['💍', '{a}和{b}結婚了'], split: ['💔', '{a}和{b}分手了'], divorce: ['💔', '{a}和{b}離婚了'], feud: ['💢', '{a}和{b}徹底鬧翻，絕交了'],
        affair: ['🖤', '{a}背著{c}，和{b}偷偷在一起'], secret: ['🖤', '{a}和{b}偷偷在一起'], taken: ['💔', '{a}暗戀{b}，可是{b}已經和{c}在一起了'], stray: ['💘', '{a}明明有{c}了，卻暗戀著{b}'], mtaken: ['💔', '{a}和{b}互相喜歡，可是{b}已經和{c}在一起了'], rival: ['💘', '{a}和{c}都喜歡{b}，{b}心裡偏向{a}'], single: ['💘', '{a}暗戀{b}，{b}目前單身'],
        mutual: ['💘', '{a}和{b}互相喜歡，誰都還沒說破'], foe: ['💢', '{a}和{b}是死對頭'], feud2: ['💢', '{a}和{b}是死對頭，已經絕交'],
        married: ['💍', '{a}和{b}是夫妻'], dating: ['💕', '{a}和{b}在交往'], friend: ['💚', '{a}和{b}是摯友'],
    },
    _rvRow(D, x) {
        const [icon, k] = this._RV_TXT[x.t]; let s = this._icEsc(t(k));
        for (const v of ['a', 'b', 'c']) if (x[v]) s = s.split('{' + v + '}').join(this._rvNm(D, x[v]));
        const when = x.ago != null ? (x.ago === 0 ? t('今天的事') : x.ago === 1 ? t('昨天的事') : t('{n} 天前的事').replace('{n}', x.ago)) : x.days ? (x.t === 'married' ? t('結婚 {n} 天') : t('交往 {n} 天')).replace('{n}', x.days) : '';
        if (when) { // 「幾天前」接在句尾：跟句子最後一小段（最後一個字詞或人名）包在一起不換行
            let cut = s.endsWith('</span>') ? s.lastIndexOf('<span class="rv-nm"') : (() => { const m = s.match(/[^\s<>]+$/); if (!m) return s.length; const seg = m[0]; return s.length - (/[\u3400-\u9fff]/.test(seg) ? Math.min(seg.length, 4) : seg.length); })();
            s = `${s.slice(0, cut)}<span class="rv-tail">${s.slice(cut)} <small class="rv-when">${this._icEsc(when)}</small></span>`;
        }
        return `<div class="rv-row" role="button" tabindex="0" data-action="rv-cam" data-val="${this._icEsc(x.a)}"><span class="rv-ri" aria-hidden="true">${icon}</span><span class="rv-tx">${s}</span><button type="button" class="rv-go" data-action="rv-cam" data-val="${this._icEsc(x.a)}" aria-label="${this._icEsc(t('鏡頭跟過去'))}">🎥</button></div>`;
    },
    _rvRows(D, list, first) {
        const n = first ?? this._RV_FIRST; const head = list.slice(0, n).map(x => this._rvRow(D, x)).join('');
        if (list.length <= n) return head;
        return head + `<details class="rv-all"><summary>${this._icEsc(t('看全部 {n} 筆').replace('{n}', list.length))}</summary>${list.slice(n).map(x => this._rvRow(D, x)).join('')}</details>`;
    },
    _rvList(D) {
        if (!D.any) return `<div class="ic-note rv-calm">${t('鎮上還很平靜...讓村民多相處幾天,八卦自然就來了。')}</div>`;
        const f = this._relmapFilters, on = (L) => L.filter(x => f[x.f]); const cards = [];
        const card = (id, icon, title, list, o = {}) => { if (!list.length) return; cards.push(this._ic({ id, icon, title, defOpen: o.open ?? true, chip: { t: o.chip || t('{n} 筆').replace('{n}', list.length), tone: o.tone || '' }, top: o.note ? `<div class="ic-note">${o.note}</div>` : '', body: `<div class="rv-rows">${this._rvRows(D, list, o.first)}</div>` })); };
        card('rv-recent', `<span class="rv-new">${t('新')}</span>`, t('最近的變化'), on(D.recent), { tone: 'y', note: t('這一週新在一起、分手、離婚、絕交的') });
        card('rv-tri', '💔', t('三角關係'), on(D.tri), { tone: 'r' });
        card('rv-mutual', '💘', t('互有好感還沒說破'), on(D.mutual));
        card('rv-crush', '💌', t('單戀'), on(D.crush), { open: false });
        card('rv-foe', '💢', t('死對頭'), on(D.foes));
        const cp = on(D.couples); if (cp.length) { const m = cp.filter(x => x.t === 'married').length; card('rv-couples', '💍', t('情侶與夫妻'), cp, { open: false, chip: t('{m} 對夫妻、{d} 對情侶').replace('{m}', m).replace('{d}', cp.length - m), first: 6 }); }
        card('rv-friend', '💚', t('摯友'), on(D.friends), { open: false, first: 6 });
        return cards.length ? `<div class="ic-wrap rv-list">${cards.join('')}</div>` : `<div class="ic-note rv-calm">${t('目前選的這幾種關係，鎮上還沒有。')}</div>`;
    },

    // ---------- 一個人的關係圖 ----------
    // 從他的角度講這一段（誰喜歡誰、誰討厭誰），寫在對方的名牌上
    _rvTag(p, me, D) {
        const out = p.a === me ? 'a2b' : 'b2a'; const c = D.name[me]; const fill = (k) => t(k).replace('{c}', c);
        if (p.kind === 'love') return p.sub === 'married' ? t('夫妻') : p.sub === 'dating' ? t('交往中') : t('偷偷在一起');
        if (p.kind === 'crush') return p.sub === 'mutual' ? t('互有好感') : p.sub === out ? fill('{c}暗戀的人') : fill('暗戀{c}');
        if (p.kind === 'foe') return p.sub === 'feud' ? t('絕交了') : p.sub === 'mutual' ? t('死對頭') : p.sub === out ? fill('{c}討厭的人') : fill('討厭{c}');
        return t('摯友');
    },
    _rvPerson(D, me) {
        const esc = (x) => this._icEsc(x), f = this._relmapFilters, S = this._rvState();
        const all = (D.byP[me] || []).filter(p => f[p.kind]).sort((x, y) => y.score - x.score);
        const shown = all.slice(0, this._RV_MAX), rest = all.length - shown.length;
        const back = `<button type="button" class="rv-back" data-action="rv-back">← ${esc(S.from === 'town' ? t('返回全鎮圖') : t('返回清單'))}</button>`;
        const cam = `<button type="button" class="rv-back rv-cam" data-action="rv-cam" data-val="${esc(me)}">🎥 ${esc(t('鏡頭跟過去'))}</button>`;
        let h = `<div class="rv-person"><div class="rv-ph">${back}${cam}</div><div class="rv-title">${esc(t('{c}的關係').replace('{c}', D.name[me]))}</div>`;
        if (!shown.length) return h + `<div class="ic-note rv-calm">${esc((D.byP[me] || []).length ? t('他的關係都被上面的篩選藏起來了。') : t('他現在沒有特別的感情或恩怨。'))}</div></div>`;
        // 位置：左右兩欄先放（離中間最近、線最短），其餘放上下兩排；一般排版排出來的，名字不會疊在一起
        const n = shown.length; const side = Math.min(4, Math.ceil(n / 4)); const slot = { L: [], R: [], T: [], B: [] };
        shown.forEach((p, i) => { const k = n <= 4 ? 'RLTB'[i] : slot.R.length < side && slot.R.length <= slot.L.length ? 'R' : slot.L.length < side ? 'L' : slot.T.length <= slot.B.length ? 'T' : 'B'; slot[k].push(p); });
        const pill = (p) => { const o = p.a === me ? p.b : p.a; const k = p.sub === 'affair' ? 'affair' : p.kind; const dir = p.sub === 'a2b' ? (p.a === me ? 'out' : 'in') : p.sub === 'b2a' ? (p.b === me ? 'out' : 'in') : '';
            return `<button type="button" class="rv-pill k-${k}" data-action="rv-person" data-val="${esc(o)}" data-rv-k="${k}" data-rv-d="${dir}"><b>${esc(D.name[o])}</b><small>${esc(this._rvTag(p, me, D))}</small></button>`; };
        const col = (L) => L.map(pill).join('');
        const sig = [me, n, ...shown.map(p => p.a + p.b + p.kind + p.sub)].join(',');
        h += `<div class="rv-graph" data-rv-sig="${esc(sig)}"><canvas class="rv-cv" aria-hidden="true"></canvas>`;
        if (slot.T.length) h += `<div class="rv-row2">${col(slot.T)}</div>`;
        h += `<div class="rv-mid"><div class="rv-col">${col(slot.L)}</div><div class="rv-ctr"><button type="button" class="rv-pill rv-me" data-action="rv-cam" data-val="${esc(me)}" aria-label="${esc(t('鏡頭跟過去'))}"><b>${esc(D.name[me])}</b></button></div><div class="rv-col">${col(slot.R)}</div></div>`;
        if (slot.B.length) h += `<div class="rv-row2">${col(slot.B)}</div>`;
        h += '</div>';
        h += `<div class="rv-legend">${[['love', '💕', t('戀愛')], ['affair', '🖤', t('偷偷在一起')], ['crush', '💘', t('單戀')], ['foe', '💢', t('敵對')], ['friend', '💚', t('摯友')]].filter(([k]) => shown.some(p => (p.sub === 'affair' ? 'affair' : p.kind) === k)).map(([k, i, l]) => `<span class="rv-lg k-${k}"><i></i>${i} ${esc(l)}</span>`).join('')}</div>`;
        if (rest > 0) h += `<div class="ic-note">${esc(t('另外還有 {n} 個人跟他有關係，先畫最有戲的 {m} 個。').replace('{n}', rest).replace('{m}', this._RV_MAX))}</div>`;
        h += `<div class="ic-note">${esc(t('點周圍的人，換成看他的關係。'))}</div>`;
        return h + '</div>';
    },
    // 畫面剛換上去時版面可能還沒排好（寬度 0），最多再等幾個畫格，不留下「沒畫出來」的空白圖
    _rvLater(fn, n = 0) { requestAnimationFrame(() => { if (fn() === false && n < 8) this._rvLater(fn, n + 1); }); },
    // 兩個方框彼此最近的兩個點：橫向有重疊就直直接過去，兩個方向都沒重疊就接最近的兩個角
    _rvNear(A, B) {
        const ax0 = Math.max(A.x0, B.x0), ax1 = Math.min(A.x1, B.x1), ay0 = Math.max(A.y0, B.y0), ay1 = Math.min(A.y1, B.y1);
        const [x1, x2] = ax0 <= ax1 ? [(ax0 + ax1) / 2, (ax0 + ax1) / 2] : B.x0 > A.x1 ? [A.x1, B.x0] : [A.x0, B.x1];
        const [y1, y2] = ay0 <= ay1 ? [(ay0 + ay1) / 2, (ay0 + ay1) / 2] : B.y0 > A.y1 ? [A.y1, B.y0] : [A.y0, B.y1];
        return [x1, y1, x2, y2];
    },
    // 線段碰不碰方框（Liang–Barsky 裁切）；方框內縮 1px，剛好擦過邊不算
    _rvHit(x1, y1, x2, y2, R) {
        const x0 = R.x0 + 1, X1 = R.x1 - 1, y0 = R.y0 + 1, Y1 = R.y1 - 1, dx = x2 - x1, dy = y2 - y1; let t0 = 0, t1 = 1;
        for (const [pp, q] of [[-dx, x1 - x0], [dx, X1 - x1], [-dy, y1 - y0], [dy, Y1 - y1]]) { if (pp === 0) { if (q < 0) return false; continue; } const r = q / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
        return t0 < t1;
    },
    // 線畫在名牌底下的畫布上：照 devicePixelRatio 放大；內容和大小都沒變就不重畫（面板每秒自動重畫一次，大多數時候什麼都不用做）
    // v11.5.1 線不能從第三個名牌底下穿過（露出來的幾小段會看起來像兩個不相干的人有關係）：先試直線，會碰到就改走名牌之間空隙的曲線
    _rvPaint() {
        const g = document.querySelector('#sidebar-content .rv-graph'); const cv = g?.querySelector('.rv-cv'); if (!cv) return;
        const W = g.clientWidth, H = g.clientHeight; if (!W || !H) return false;
        const dpr = window.devicePixelRatio || 1; const sig = `${g.dataset.rvSig}|${W}x${H}@${dpr}`; if (cv._rvSig === sig) return;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
        const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const G = g.getBoundingClientRect(); const box = (el) => { const r = el.getBoundingClientRect(); return { x0: r.left - G.left, y0: r.top - G.top, x1: r.right - G.left, y1: r.bottom - G.top, el }; };
        const meEl = g.querySelector('.rv-me'); if (!meEl) return; const M = box(meEl);
        const pills = [...g.querySelectorAll('.rv-pill[data-rv-k]')].map(box); const paths = [];
        const clear = (pts, own) => { for (let i = 1; i < pts.length; i++) for (const R of pills) if (R !== own && this._rvHit(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], R)) return false; return true; };
        const curve = (x1, y1, cx, cy, x2, y2) => { const out = []; for (let i = 0; i <= 20; i++) { const t = i / 20, u = 1 - t; out.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]); } return out; };
        for (const P of pills) {
            const [sx, sy, px, py] = this._rvNear(M, P); let pts = [[sx, sy], [px, py]];
            if (!clear(pts, P)) { // 直線會碰到別的名牌：控制點往兩側推，找一條穿過空隙的曲線
                const len = Math.hypot(px - sx, py - sy) || 1, nx = -(py - sy) / len, ny = (px - sx) / len, mx = (sx + px) / 2, my = (sy + py) / 2;
                for (const off of [24, -24, 48, -48, 72, -72, 100, -100, 140, -140]) { const c = curve(sx, sy, mx + nx * off, my + ny * off, px, py); if (clear(c, P)) { pts = c; break; } }
            }
            const el = P.el, k = el.dataset.rvK, d = el.dataset.rvD; paths.push({ id: el.dataset.val, pts });
            ctx.strokeStyle = this._RV_COL[k] || '#888'; ctx.lineWidth = k === 'love' ? 2.6 : k === 'friend' ? 1.6 : 2; ctx.setLineDash(k === 'crush' || k === 'affair' ? [5, 4] : []); ctx.globalAlpha = k === 'friend' ? 0.75 : 1;
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.setLineDash([]);
            if (d) { // 單方面的喜歡／討厭：箭頭指向被喜歡（被討厭）的那個人
                const n = pts.length; const [tx, ty, fx, fy] = d === 'out' ? [pts[n - 1][0], pts[n - 1][1], pts[n - 2][0], pts[n - 2][1]] : [pts[0][0], pts[0][1], pts[1][0], pts[1][1]]; const a = Math.atan2(ty - fy, tx - fx), L = 9;
                ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - L * Math.cos(a - 0.45), ty - L * Math.sin(a - 0.45)); ctx.lineTo(tx - L * Math.cos(a + 0.45), ty - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        g._rvPaths = paths; // 測試用：實際畫出來的每條線（相對於圖框的座標）
        cv._rvSig = sig; this._rvPaints = (this._rvPaints || 0) + 1;
    },

    // ---------- 全鎮圖（30 人以下）：沿用 4.5.0 的圓圖，點人改成打開他的關係圖 ----------
    _drawRelationMap() {
        const canvas = document.querySelector('#sidebar-content #relmap-canvas'); const D = this._rvData(); if (!canvas || !D) return;
        const W = canvas.clientWidth; if (!W) return false; const H = Math.max(300, Math.min(430, W)); const dpr = window.devicePixelRatio || 1; const f = this._relmapFilters;
        const sig = `${D.ids.join()}|${D.rel.filter(p => f[p.kind]).map(p => p.a + p.b + p.sub).join()}|${W}@${dpr}`; // 內容一樣就不重畫（模擬每走一格資料會重算，但關係通常沒變） if (canvas._rvSig === sig) return;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = H + 'px';
        const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34; const pos = {};
        D.ids.forEach((id, i) => { const ang = (i / D.ids.length) * Math.PI * 2 - Math.PI / 2; pos[id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) }; });
        this._relmapPos = pos;
        for (const p of D.rel) { if (!f[p.kind]) continue; const p1 = pos[p.a], p2 = pos[p.b]; if (!p1 || !p2) continue; const k = p.sub === 'affair' ? 'affair' : p.kind;
            ctx.strokeStyle = this._RV_COL[k]; ctx.lineWidth = p.sub === 'married' ? 2.6 : k === 'friend' ? 1 : 1.6; ctx.setLineDash(k === 'crush' || k === 'affair' ? [4, 3] : []); ctx.globalAlpha = k === 'friend' ? 0.6 : 1;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.setLineDash([]);
        for (const id of D.ids) { const p = pos[id]; ctx.fillStyle = '#3a5a94'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#dde6f5'; ctx.font = '11px sans-serif'; const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
            // 名字放在點的外側：左右兩邊靠齊點的外緣（以前置中，左右兩側的字會壓到點）
            if (ux > 0.35) { ctx.textAlign = 'left'; ctx.fillText(D.name[id], p.x + 11, p.y + 4); } else if (ux < -0.35) { ctx.textAlign = 'right'; ctx.fillText(D.name[id], p.x - 11, p.y + 4); } else { ctx.textAlign = 'center'; ctx.fillText(D.name[id], p.x, p.y + (uy < 0 ? -12 : 19)); } }
        canvas._rvSig = sig;
        if (!canvas._relmapBound) { canvas._relmapBound = true;
            canvas.addEventListener('click', (ev) => { const r = canvas.getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top; let hit = null, best = 26; // 點得到：離最近的人 26px 以內就算點到他
                for (const [id, p] of Object.entries(this._relmapPos || {})) { const d = Math.hypot(p.x - x, p.y - y); if (d < best) { best = d; hit = id; } }
                if (hit) this._rvOpen(hit, 'town'); }); }
    },

    // ---------- 操作 ----------
    _rvOpen(id, from) { const S = this._rvState(); if (S.view !== 'person') S.from = from || S.view || 'list'; else if (from) S.from = from; S.view = 'person'; S.who = id; this.bgm?.sfx?.('click'); this.renderSidebar(); document.querySelector('#sidebar-content .rv-wrap')?.scrollIntoView?.({ block: 'start' }); },
    _rvClick(action, val) {
        const S = this._rvState();
        if (action === 'rv-person') { if (val) this._rvOpen(val, S.view === 'person' ? null : S.view); }
        else if (action === 'rv-back') { S.view = S.from === 'town' && this._rvData()?.ids.length <= this._RV_TOWN_MAX ? 'town' : 'list'; S.who = null; this.renderSidebar(); }
        else if (action === 'rv-view') { S.view = val === 'town' ? 'town' : 'list'; S.from = S.view; S.who = null; this.renderSidebar(); }
        else if (action === 'rv-cam') { const id = val; if (!this.world?.agents?.[id]) return; // 跟拍：跟其他頁點人名一樣（鏡頭跟著他、開他的小卡）
            try { this.selectedAgent = id; this.selectedAgentId = id; this.tileMap?.followAgent?.(id); this._showNpcCard?.(id); } catch (e) {} }
    },
    // 下拉選人：點擊委派收不到 change，另外掛一次
    _rvWire() {
        if (this._rvWired) return; this._rvWired = true;
        document.addEventListener('change', (e) => { const s = e.target; if (!s?.matches?.('[data-rv-pick]')) return; if (s.value) this._rvOpen(s.value, null); });
    },
});
