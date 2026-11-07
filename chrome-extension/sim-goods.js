// v6.65.0 探索四級城鎮＋分級商品
// - 種子生成的城鎮也有等級:村莊常見、城鎮次之、城市少見、王都極稀有;遠方城鎮繁榮又人多時會慢慢升級
// - 分級商品:村莊農產原料、城鎮工具布料(原本的資源);城市多了工業品與基礎藝術品,王都有史詩商品與傳奇藝術品
// - 城市與王都來的商人會帶珍品:公庫買下就成為廣場地標(全鎮心情),聖物獻給信徒最多的宗教(虔誠、朝聖),有錢人買來撐場面(社會地位)
// - 珍品也是外交禮物的來源(v6.66.0 外交會用到)
const GOODS = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('trade', k, p || {}, who || ''); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    // 商品:tier 2 城市、3 王都
    const CAT = {
        glass:    { tier: 2, kind: 'industrial', icon: '🫙', zh: '玻璃器皿', en: 'glassware', price: 80, mood: 2 },
        clock:    { tier: 2, kind: 'industrial', icon: '🕰️', zh: '機械鐘', en: 'clockwork', price: 120, mood: 3, research: 20 },
        steel:    { tier: 2, kind: 'industrial', icon: '🗡️', zh: '精鋼工具', en: 'fine steel tools', price: 90, tools: 15 },
        painting: { tier: 2, kind: 'art', icon: '🖼️', zh: '油畫', en: 'oil painting', price: 100, mood: 4 },
        statue:   { tier: 2, kind: 'art', icon: '🗿', zh: '石雕', en: 'stone statue', price: 140, mood: 5 },
        tapestry: { tier: 3, kind: 'epic', icon: '🧵', zh: '史詩掛毯', en: 'epic tapestry', price: 260, mood: 8 },
        porcelain:{ tier: 3, kind: 'epic', icon: '🏺', zh: '王室瓷器', en: 'royal porcelain', price: 220, mood: 6 },
        colossus: { tier: 3, kind: 'legend', icon: '🗽', zh: '傳奇雕像', en: 'legendary statue', price: 400, mood: 12 },
        relic:    { tier: 3, kind: 'legend', icon: '📿', zh: '聖物', en: 'holy relic', price: 320, piety: 15, sacred: true },
    };
    for (const g of Object.values(CAT)) { try { I18N.registerName(g.zh, g.en); } catch (e) {} }
    const KIND = { industrial: ['工業品', 'industrial goods'], art: ['藝術品', 'art'], epic: ['史詩商品', 'epic goods'], legend: ['傳奇藝術品', 'legendary art'] };
    for (const k of Object.values(KIND)) { try { I18N.registerName(k[0], k[1]); } catch (e) {} }
    // ---------- 城鎮等級(種子決定,極少數會長大) ----------
    function tierOf(seed) { const r = (() => { let a = (seed ^ 0x5bd1e995) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; })(); const v = r(); return v < 0.55 ? 0 : v < 0.85 ? 1 : v < 0.97 ? 2 : 3; }
    const LVN = () => (typeof TIERS !== 'undefined' ? TIERS.LV : []);
    function S(w) { if (!w.goods || !Array.isArray(w.goods.town)) w.goods = { town: [], owned: {}, offers: [], lastDay: null, n: 0 }; const G = w.goods; G.owned = G.owned || {}; G.offers = G.offers || []; return G; }
    // 已知的城市與王都(遠方消息的地點＋探險找到的城鎮)
    function richPlaces(w) {
        const out = [];
        try { for (const p of (w.tidings?.places || [])) if (p.lv >= 2) out.push({ name: p.name[0], lv: p.lv }); } catch (e) {}
        try { for (const c of (TownGen.cards() || [])) { const lv = c.tier ?? 0; if (c.found && lv >= 2) out.push({ name: c.name, lv }); } } catch (e) {}
        return out;
    }
    // 城市或王都來的商人帶珍品
    function onMerchant(w, m) {
        if (!w.observerMode || !m) return; const places = richPlaces(w); if (!places.length || Math.random() > 0.45) return;
        const p = places[Math.floor(Math.random() * places.length)];
        const pool = Object.entries(CAT).filter(([, g]) => g.tier <= p.lv); const n = p.lv >= 3 ? 2 : 1;
        const items = pool.sort(() => Math.random() - 0.5).slice(0, n).map(([k]) => k);
        const G = S(w); G.offers = items.map(k => ({ key: k, from: p.name, lv: p.lv, price: Math.round(CAT[k].price * (0.9 + Math.random() * 0.3)), day: day(w) }));
        m.from = p.name; m.rare = items;
        log(w, '🐪 來自{p}的商人帶了珍品：{list}。', { p: p.name, list: items.map(k => CAT[k].zh).join(' / ') });
    }
    function buy(w, G, o, who) {
        const g = CAT[o.key]; const id = 'G' + (++G.n); const it = { id, key: o.key, from: o.from, day: day(w), price: o.price };
        if (who === 'town') {
            if (!w.stockpile?.consume?.('silver', o.price, w.tickCount, t('購買珍品'))) return null;
            G.town.push(it); place(w, it); return it;
        }
        if (!WALLET.take(w, who, o.price)) return null;
        (G.owned[who.agentId] || (G.owned[who.agentId] = [])).push(it);
        log(w, '💎 {a}花了 {n} 銀幣買下{g}。', { a: who.name, n: o.price, g: g.zh }, who.name);
        mem(w, who, '我花了 {n} 銀幣買下來自{p}的{g}，誰看了都羨慕。', { n: o.price, p: o.from, g: g.zh }, 7);
        try { if (w.classes) w.classes.lv[who.agentId] = CLASS.compute(w, who); } catch (e) {}
        for (const x of npcs(w)) if (x !== who && cash(w, x) < 20 && Math.random() < 0.1) x.addThought?.('envious', w, who.agentId, who.name);
        return it;
    }
    // 公庫買下的珍品:聖物獻給宗教,其他放在廣場當地標
    function place(w, it) {
        const g = CAT[it.key];
        if (g.sacred && w.faith?.rels?.length) {
            const R = w.faith.rels.slice().sort((x, y) => FAITH.believers(w, y).length - FAITH.believers(w, x).length)[0]; it.rel = R.id; R.relic = it.key;
            for (const a of FAITH.believers(w, R)) FAITH.bumpP(w, a, g.piety || 10);
            log(w, '📿 {r}迎來了來自{p}的聖物，信徒們激動不已，遠方的朝聖者也會慕名而來。', { r: R.name[0], p: it.from });
            try { if (w.news?.bulletins) { const nd = w.clock.year * 60 + (['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15) + w.clock.day; w.news.bulletins.push({ headline: t('聖物吸引朝聖者'), category: 'remote', severity: 'good', flavor: [], modifiers: { immigration_chance: 0.15, mood_modifier: 2 }, expiresDay: nd + 10, publishedDay: nd, remote: true }); w.news._rebuildModifiers?.(nd); } } catch (e) {}
            return;
        }
        const P = w.proposals; if (P) { const L = P.landmarks || (P.landmarks = []); L.push({ name: g.zh, icon: g.icon, by: t('公庫'), id: it.id, day: day(w) }); if (L.length > 6) L.splice(0, L.length - 6); }
        for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + (g.mood || 3);
        if (g.research && w.stockpile) w.stockpile.add?.('research_points', g.research, w.tickCount, t('購買珍品'));
        if (g.tools && w.stockpile) w.stockpile.add?.('tools', g.tools, w.tickCount, t('購買珍品'));
        log(w, '🏛️ 公庫買下來自{p}的{g}，擺在廣場上，大家都來看。', { p: it.from, g: g.zh });
    }
    function daily(w) {
        const G = S(w), d = day(w); if (G.lastDay === d) return; G.lastDay = d;
        G.offers = G.offers.filter(o => d - o.day <= 3); if (!G.offers.length) return;
        for (const o of G.offers.slice()) {
            const g = CAT[o.key]; let sold = null;
            // 有錢人先(撐場面);公庫有餘裕才買(地標、聖物、工業品)
            const rich = npcs(w).filter(a => cash(w, a) >= o.price * 1.5 && !g.sacred).sort((x, y) => cash(w, y) - cash(w, x))[0];
            if (rich && Math.random() < 0.35) sold = GOODS.buy(w, G, o, rich); // 走公開的 buy,殺價等模組才接得到
            if (!sold && (w.stockpile?.get?.('silver') || 0) >= o.price * 2 && Math.random() < 0.5) sold = GOODS.buy(w, G, o, 'town');
            if (sold) G.offers = G.offers.filter(x => x !== o);
        }
    }
    const prestige = (w, a) => (w.goods?.owned?.[a?.agentId] || []).some(it => ['epic', 'legend', 'art'].includes(CAT[it.key]?.kind));
    function chip(w, a) { const own = w.goods?.owned?.[a?.agentId] || []; if (!own.length) return ''; const g = CAT[own[own.length - 1].key]; return `${g.icon} ${t('收藏')}${t('：')}${t(g.zh)}${own.length > 1 ? ` +${own.length - 1}` : ''}`; }
    function view(w) { const G = S(w); return { town: G.town.map(it => ({ icon: CAT[it.key].icon, name: t(CAT[it.key].zh), kind: t(KIND[CAT[it.key].kind][0]), from: t(it.from) })), offers: G.offers.map(o => ({ icon: CAT[o.key].icon, name: t(CAT[o.key].zh), from: t(o.from), price: o.price })), collectors: Object.entries(G.owned).filter(([id]) => w.agents[id]).map(([id, l]) => ({ name: t(w.agents[id].name), n: l.length })) }; }
    return { CAT, KIND, S, tierOf, richPlaces, onMerchant, buy, place, daily, prestige, chip, view };
})();
// 城鎮卡加上等級;遠方城鎮繁榮又人多時慢慢升級
if (typeof TownGen !== 'undefined') {
    const _card = TownGen.card;
    TownGen.card = function (seed) { const c = _card.call(this, seed); try { c.tier = c.state?.tier ?? c.size ?? GOODS.tierOf(seed); if (c.tier >= 2) c.pop = Math.max(c.pop || 0, c.tier === 3 ? 40 : 30); } catch (e) {} return c; };
    const _cards = TownGen.cards;
    TownGen.cards = function () { const list = _cards.call(this); for (const c of list) { try { if (c.tier === undefined) c.tier = c.size ?? GOODS.tierOf(c.seed); if (c.state && c.state.tier !== undefined) c.tier = c.state.tier; } catch (e) {} } return list; };
    const _drift = TownGen.drift;
    TownGen.drift = function (c, d) { const r = _drift.call(this, c, d); try { const st = c?.state; if (st) { if (st.tier === undefined) st.tier = c.tier ?? GOODS.tierOf(c.seed); if (st.tier < 3 && st.prosperity > 65 && (st.pop || 0) >= 25 && Math.random() < 0.02) { st.tier++; st.news = st.news || []; st.news.push({ zh: `${c.name}升格為${TIERS?.LV?.[st.tier]?.zh || ''}了`, en: `${c.nameEn || c.name} has grown into a ${TIERS?.LV?.[st.tier]?.en || ''}`, day: d }); st.news = st.news.slice(-3); } c.tier = st.tier; } } catch (e) {} return r; };
    const _tags = TownGen.tags;
    TownGen.tags = function (c) { const tg = _tags.call(this, c); try { const L = TIERS.LV[c.tier ?? GOODS.tierOf(c.seed)]; if (L) tg.unshift(`${L.icon} ${(typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? L.en : L.zh}`); } catch (e) {} return tg; };
}
if (typeof TradeManager !== 'undefined') {
    const _sp = TradeManager.prototype._spawnMerchant;
    TradeManager.prototype._spawnMerchant = function (world, ...rest) { const r = _sp.call(this, world, ...rest); try { GOODS.onMerchant(world, this.merchant); } catch (e) { console.warn('[Goods] merchant', e); } return r; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) GOODS.daily(w); } catch (e) { console.warn('[Goods] daily', e); } return r; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.goods = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.goods) d.goods = this.goods; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.goods = (data?.goods && Array.isArray(data.goods.town)) ? data.goods : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.GOODS = GOODS;
