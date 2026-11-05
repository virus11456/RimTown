// v6.62.0 消息傳遞:遠方的事有來源、有時差、會走樣
// - 遠方地點:四個鄰鎮、探險找到的城鎮、王國的首都、更遠的異國(只是「城鎮卡＋數字＋傳聞」,不模擬每個人)
// - 每個地點偶爾發生事(豐收、饑荒、瘟疫、盜匪、市集、升格、加稅王令、皇家婚禮、戰爭、和約、新發明…)
// - 消息經由商隊、旅人、朝聖者、信差帶進鎮,越遠越晚到;口耳相傳會誇大走樣,信差最準
// - 帶消息的人先知道,再沿著交情一個傳一個;AI 只知道自己聽過的
// - 消息到了才生效:物價、商人來不來、移民、盜匪、瘟疫、心情(接到原本的新聞修正值)
const TIDINGS = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const reg = (zh, e) => { try { if (typeof I18N !== 'undefined') I18N.registerName(zh, e); } catch (x) {} };
    const newsDay = (w) => w.clock.year * 60 + (['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15) + w.clock.day; // 跟原本新聞系統同一套日子
    const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const CHAN = {
        merchant: { icon: '🐴', zh: '商隊', en: 'a caravan', acc: 0.8, job: 'trader' },
        traveler: { icon: '🎒', zh: '旅人', en: 'a traveler', acc: 0.5, job: null },
        pilgrim: { icon: '🕯️', zh: '朝聖者', en: 'pilgrims', acc: 0.7, job: 'priest' },
        courier: { icon: '📯', zh: '驛站信差', en: 'the royal courier', acc: 1, job: 'mayor' },
    };
    const EV = {
        town: [
            { k: '{p}今年大豐收，糧價跌了', ch: 'merchant', m: { buy_bonus: 0.1 } },
            { k: '{p}鬧饑荒，不少人往外逃', ch: 'traveler', m: { immigration_chance: 0.15, mood_modifier: -2 } },
            { k: '{p}爆發了瘟疫', ch: 'traveler', m: { plague_chance: 0.08, merchant_chance: -0.1, mood_modifier: -4 } },
            { k: '{p}挖到新礦脈，金屬便宜了', ch: 'merchant', m: { buy_bonus: 0.08 } },
            { k: '{p}附近的山道出現盜匪', ch: 'merchant', m: { raid_chance: 0.08, merchant_chance: -0.1 } },
            { k: '{p}辦了一場熱鬧的市集，商人都往這邊來', ch: 'merchant', m: { merchant_chance: 0.15 } },
            { k: '{p}升格了', ch: 'traveler', m: { mood_modifier: -1 }, up: true },
            { k: '{p}的寺廟出了神蹟，朝聖的人絡繹不絕', ch: 'pilgrim', m: { mood_modifier: 2 } },
        ],
        capital: [
            { k: '國王在{p}大擺壽宴', ch: 'courier', m: { mood_modifier: 1 } },
            { k: '{p}傳來王令：全國加稅', ch: 'courier', m: { mood_modifier: -4, sell_bonus: -0.05 } },
            { k: '{p}舉行了皇家婚禮', ch: 'courier', m: { mood_modifier: 3, festival_chance: 0.2 } },
            { k: '{p}的王室添了一位王子', ch: 'courier', m: { mood_modifier: 2 } },
            { k: '{p}的大學有人發明了新東西', ch: 'traveler', m: { research_bonus: 0.15 } },
        ],
        realm: [
            { k: '{p}跟鄰國開戰了', ch: 'traveler', m: { raid_chance: 0.05, immigration_chance: 0.2, mood_modifier: -3, sell_bonus: 0.1 } },
            { k: '{p}跟鄰國簽了和約', ch: 'merchant', m: { merchant_chance: 0.1, mood_modifier: 2 } },
            { k: '{p}大旱，那邊的人搶著買糧', ch: 'merchant', m: { sell_bonus: 0.15 } },
            { k: '{p}的大教團派了傳教士往這邊來', ch: 'pilgrim', m: { mood_modifier: 1 } },
        ],
    };
    const LVN = () => (typeof TIERS !== 'undefined' ? TIERS.LV : [{ zh: '村莊', icon: '🏡' }, { zh: '城鎮', icon: '🏘️' }, { zh: '城市', icon: '🏙️' }, { zh: '王都', icon: '🏰' }]);
    const PRE = [['金', 'Gold'], ['銀', 'Silver'], ['赤', 'Red'], ['青', 'Azure'], ['白', 'White'], ['玄', 'Black'], ['曦', 'Dawn'], ['霜', 'Frost']];
    const SUF = [['陽', 'sun'], ['輝', 'light'], ['嶽', 'peak'], ['河', 'river'], ['原', 'field'], ['城', 'hold']];
    function makePlaces(w) {
        const h = (typeof TownGen !== 'undefined' ? TownGen.hash(w.townName || 'town') : 7);
        const P = [];
        const NB = typeof NEIGHBOR_TOWNS !== 'undefined' ? NEIGHBOR_TOWNS : [];
        const nbLv = { harbor: 1, mountain: 1, forest: 0, market: 2 }, nbD = { harbor: 2, mountain: 3, forest: 3, market: 4 };
        for (const n of NB) if (n.name !== w.townName) P.push({ id: 'nb:' + n.theme, name: [n.name, ''], lv: nbLv[n.theme] ?? 1, dist: nbD[n.theme] ?? 3, kind: 'town' });
        try { for (const c of (TownGen.cards() || []).slice(0, 6)) if (c.found && c.name !== w.townName) P.push({ id: 'tg:' + c.seed, name: [c.name, c.nameEn || ''], lv: c.tier ?? ((c.pop || 15) >= 22 ? 1 : 0), dist: rnd(3, 6), kind: 'town' }); } catch (e) {}
        const a = PRE[h % PRE.length], b = SUF[(h >> 3) % SUF.length], c = PRE[(h >> 6) % PRE.length], d = SUF[(h >> 9) % SUF.length];
        P.push({ id: 'capital', name: [`${a[0]}${b[0]}京`, `${a[1]}${b[1]} Royal City`], lv: 3, dist: 6, kind: 'capital' });
        P.push({ id: 'realm', name: [`${c[0]}${d[0]}王國`, `Kingdom of ${c[1]}${d[1]}`], lv: 3, dist: 12, kind: 'realm' });
        for (const p of P) if (p.name[1]) reg(p.name[0], p.name[1]);
        return P;
    }
    function S(w) {
        if (!w.tidings || !Array.isArray(w.tidings.places)) w.tidings = { places: makePlaces(w), inbox: [], items: [], known: {}, n: 0, lastDay: null };
        const T = w.tidings; if (!T._reg) { T._reg = true; for (const p of T.places) if (p.name[1]) reg(p.name[0], p.name[1]); }
        // 如果自己升格成王都,首都就是自己;遠方王都改成「舊都」
        return T;
    }
    const placeName = (p) => (en() ? (p.name[1] || t(p.name[0])) : p.name[0]); // 鄰鎮的英文名在字典裡
    const nk = (it) => ({ k: '{x}{s}', p: { x: { k: it.k, p: { p: it.pn } }, s: it.dist ? '（聽說越傳越誇張）' : '' } }); // 巢狀樣板:存檔不帶文字,依當下語言重算
    function render(it) { try { const n = nk(it); return Memory.render(n.k, n.p); } catch (e) { return it.k; } }
    function carrierFor(w, ch) {
        const C = CHAN[ch]; const all = npcs(w); if (!all.length) return null;
        const byJob = C.job ? all.filter(a => a.job?.key === C.job) : [];
        if (byJob.length) return byJob[Math.floor(Math.random() * byJob.length)];
        if (ch === 'pilgrim' && w.faith) { const pious = all.filter(a => (w.faith.of?.[a.agentId]?.piety || 0) >= 60); if (pious.length) return pious[Math.floor(Math.random() * pious.length)]; }
        return all[Math.floor(Math.random() * all.length)];
    }
    function learn(w, T, a, it) { const k = T.known[a.agentId] || (T.known[a.agentId] = []); if (k.includes(it.id)) return false; k.push(it.id); if (k.length > 6) k.splice(0, k.length - 6); return true; }
    const knows = (T, a, it) => (T.known[a.agentId] || []).includes(it.id);
    function deliver(w, T, x) {
        const p = T.places.find(q => q.id === x.pid); if (!p) return null;
        const C = CHAN[x.ch]; const dist = Math.random() > C.acc; // 不準的管道會走樣
        const by = carrierFor(w, x.ch); const id = 'N' + (++T.n);
        const it = { id, pid: p.id, pn: p.name[0], k: x.k, ch: x.ch, dist, made: x.made, day: day(w), by: by ? by.name : null, m: x.m };
        if (x.up && p.lv < 3) { p.lv++; it.k = '{p}升格為' + (LVN()[p.lv]?.zh || '') + '了'; }
        T.items.push(it); if (T.items.length > 30) T.items.splice(0, T.items.length - 30);
        if (by) { learn(w, T, by, it); mem(w, by, '我從{via}那裡聽到{p}的消息：{n}', { via: C.zh, p: p.name[0], n: nk(it) }, 6); }
        try { w.logMessageT?.('news', '📨 {via}帶來{p}的消息：{n}', { via: C.zh, p: p.name[0], n: nk(it) }, by?.name || ''); } catch (e) {}
        // 生效:走樣的消息讓人更慌(心情影響放大),但物價等實際效果照舊
        try {
            if (w.news && Array.isArray(w.news.bulletins)) {
                const m = Object.assign({}, x.m); if (dist && m.mood_modifier < 0) m.mood_modifier = Math.round(m.mood_modifier * 1.5);
                const nd = newsDay(w); w.news.bulletins.push({ headline: render(it), headline_en: render(it), category: 'remote', severity: (m.mood_modifier || 0) < 0 ? 'warning' : 'info', flavor: [], modifiers: m, expiresDay: nd + 5, publishedDay: nd, publishedTime: w.clock?.timeStr || '', remote: true });
                w.news._rebuildModifiers?.(nd);
                if (m.mood_modifier) for (const a of npcs(w)) if (knows(T, a, it)) a.moodModifier = (a.moodModifier || 0) + m.mood_modifier;
            }
        } catch (e) { console.warn('[Tidings] effect', e); }
        try { w.dailyNews?.collectEvent?.('news', render(it), 6, []); } catch (e) {}
        return it;
    }
    function daily(w) {
        const T = S(w), d = day(w); if (T.lastDay === d) return; T.lastDay = d;
        // 遠方發生事
        for (const p of T.places) {
            if (Math.random() > (p.kind === 'town' ? 0.1 : 0.07)) continue;
            const pool = EV[p.kind] || EV.town; const e = pool[Math.floor(Math.random() * pool.length)];
            if (e.up && p.lv >= 3) continue;
            const lag = e.ch === 'courier' ? Math.ceil(p.dist * 0.6) : p.dist + rnd(0, 2);
            T.inbox.push({ pid: p.id, k: e.k, ch: e.ch, m: e.m, up: !!e.up, made: d, arrive: d + lag });
        }
        // 消息到了
        const due = T.inbox.filter(x => x.arrive <= d); T.inbox = T.inbox.filter(x => x.arrive > d);
        for (const x of due.slice(0, 3)) deliver(w, T, x);
        spread(w, T, d);
    }
    // 口耳相傳:知道的人跟交情好的人說;旅人的版本傳著傳著更誇張
    function spread(w, T, d) {
        const live = T.items.filter(it => d - it.day <= 6); if (!live.length) return;
        for (const a of npcs(w)) for (const it of live) {
            if (!knows(T, a, it) || Math.random() > 0.35) continue;
            const r = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 15 && w.agents[r.targetId] && !w.agents[r.targetId].isDead && !w.agents[r.targetId].isPlayer && !knows(T, w.agents[r.targetId], it));
            const o = r.length ? w.agents[r[Math.floor(Math.random() * r.length)].targetId] : null; if (!o) continue;
            learn(w, T, o, it); if (it.ch === 'traveler' && !it.dist && Math.random() < 0.1) it.dist = true;
            mem(w, o, '{a}跟我說：{n}', { a: a.name, n: nk(it) }, 4);
        }
    }
    const heardBy = (w, a) => { const T = w.tidings; if (!T || !a) return []; const ids = T.known[a.agentId] || []; return T.items.filter(it => ids.includes(it.id)); };
    function brief(w, a) { const hs = heardBy(w, a).slice(-2); if (!hs.length) return ''; return `${t('你聽說的外地消息')}${t('：')}${hs.map(render).join(t('；'))}`; }
    function view(w) {
        const T = S(w), d = day(w), L = LVN();
        const places = T.places.map(p => { const last = T.items.filter(it => it.pid === p.id).slice(-1)[0]; return { id: p.id, name: placeName(p), lv: p.lv, lvName: t(L[p.lv]?.zh || ''), icon: L[p.lv]?.icon || '🏘️', dist: p.dist, kind: p.kind, last: last ? d - last.day : null, by: last?.by ? t(last.by) : null }; });
        const items = T.items.slice(-6).reverse().map(it => ({ text: render(it), via: `${CHAN[it.ch].icon} ${t(CHAN[it.ch].zh)}`, rumor: !!it.dist || CHAN[it.ch].acc < 0.7, ago: d - it.day, lag: it.day - it.made, knowers: Object.values(T.known).filter(k => k.includes(it.id)).length }));
        return { places, items, pending: T.inbox.length };
    }
    return { S, daily, deliver, spread, heardBy, brief, view, render, CHAN, EV, makePlaces };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) TIDINGS.daily(w); } catch (e) { console.warn('[Tidings] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.tidings && TIDINGS.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.tidings = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.tidings) { const { _reg, ...x } = this.tidings; d.tidings = x; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.tidings = (data?.tidings && Array.isArray(data.tidings.places)) ? Object.assign({}, data.tidings) : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.TIDINGS = TIDINGS;
