// RimTown - sim-autonomy.js：v6.37.0 村民全自主。上帝視角沙盒裡玩家不操作經濟，這裡把原本留給玩家按的事交給村民自己每天做：
// 農夫翻土／播種／澆水／施肥／收成、商人跟來訪的行商談買賣、工坊把成品入庫或拿去賣、鎮上缺什麼就有人去商店補。
// 規則版（完整智能體模式 v6.39 之後可改由 LLM 決定）。掛在 world.autonomy，每日由 World 的換日流程呼叫 daily(world)。
'use strict';

class VillagerAutonomy {
    constructor() { this.log = []; this._lastDay = null; }
    static FOOD_RESERVE_PER_NPC = 6;   // 食物保留量（每人份），多出來的才賣
    static RAW_RESERVE = 40;           // 原料保留量
    static GOOD_RESERVE = 20;          // 加工品保留量

    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && a.currentLocation !== 'exploration'); }
    _byJob(w, job, fallback = true) {
        const npcs = this._npcs(w);
        const pool = npcs.filter(a => a.job?.key === job);
        if (pool.length) return pool;
        return fallback ? npcs : [];
    }
    _pick(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
    _abs(w) { return w._absDay ? w._absDay() : (w.clock.year * 60 + ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15 + w.clock.day); }
    _note(w, who, tk, tp, importance = 3, newsCat = null, newsImp = 3) {
        // 一則訊息同時進日誌、提案人記憶與日報；tk 是翻譯鍵（含 {占位}）
        try { w.logMessageT?.('economy', tk, tp, who?.name); } catch (e) {}
        try { who?.memory?.addT?.(w.tickCount, w.clock.timeStr, 'work', tk, tp, importance, []); } catch (e) {}
        if (newsCat) { try { w.dailyNews?.collectEvent?.(newsCat, this._fill(tk, tp), newsImp, who ? [who.name] : []); } catch (e) {} }
        this.log.push({ day: this._abs(w), who: who?.name || '', text: this._fill(tk, tp) });
        if (this.log.length > 60) this.log = this.log.slice(-60);
    }
    _fill(k, p) { let s = (typeof t === 'function') ? t(k) : k; for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof t === 'function' && typeof b === 'string' ? t(b) : String(b)); return s; }

    daily(w) {
        const day = this._abs(w);
        if (this._lastDay === day) return;
        this._lastDay = day;
        try { this._farm(w); } catch (e) { console.warn('[Autonomy] farm', e); }
        try { this._factories(w); } catch (e) { console.warn('[Autonomy] factories', e); }
        try { this._merchant(w); } catch (e) { console.warn('[Autonomy] merchant', e); }
        try { this._shop(w); } catch (e) { console.warn('[Autonomy] shop', e); }
    }

    // ---------- 農田：農夫自己種 ----------
    _farm(w) {
        const farm = w.farm; if (!farm || !farm.plots?.length) return;
        const farmers = this._byJob(w, 'farmer', false);
        // 沒有農夫時，其他人偶爾幫忙照顧（一天只做一塊田）
        const workers = farmers.length ? farmers : (Math.random() < 0.5 ? [this._pick(this._npcs(w))].filter(Boolean) : []);
        if (!workers.length) return;
        const farmLevel = w.industry?.industries?.farming?.level || 1;
        const crops = farm.getAvailableCrops(farmLevel).filter(c => c.seasons.includes(w.clock.season));
        const food = w.stockpile.get('food'), silver = w.stockpile.get('silver');
        const foodCrop = (c) => ['grain', 'vegetable', 'fruit', 'legendary'].includes(c.category);
        const done = { planted: [], harvested: [], tended: 0, cleared: 0 };
        let budget = farmers.length ? 99 : 1; // 非農夫一天只顧一塊
        for (const plot of farm.plots) {
            if (budget <= 0) break;
            if (plot.state === 'withered') { farm.clearWithered(plot.id); done.cleared++; budget--; continue; }
            if (plot.state === 'ready') { const r = farm.harvestPlot(plot.id, w); if (r?.ok) done.harvested.push(r); budget--; continue; }
            if (plot.state === 'empty') { farm.tillPlot(plot.id); plot._tilledToday = true; }
            if (plot.state === 'tilled') {
                if (!crops.length) continue;
                // 缺糧優先種糧食；否則輪作（跟上一季不同）、等級高的作物優先、偶爾種經濟作物
                let pool = crops.slice();
                if (food < 120) { const f = pool.filter(foodCrop); if (f.length) pool = f; }
                const rot = pool.filter(c => c.key !== plot.lastCrop); if (rot.length) pool = rot;
                pool.sort((a, b) => b.reqLevel - a.reqLevel || b.sellPrice - a.sellPrice);
                const top = pool.slice(0, 3);
                const crop = Math.random() < 0.6 ? top[0] : this._pick(top);
                if (!crop) continue;
                if (silver - crop.sellPrice * 2 < 20) continue; // 種子錢要留一點給鎮上
                const r = farm.plantCrop(plot.id, crop.key, w);
                if (r?.ok) { done.planted.push(crop); budget--; }
                continue;
            }
            if (plot.state === 'growing') {
                if ((plot.waterLevel || 0) < 65) { farm.waterPlot(plot.id); done.tended++; }
                if (!plot.fertilized && w.stockpile.get('herbs') >= 8 && Math.random() < 0.35) { const r = farm.fertilizePlot(plot.id, w); if (r?.ok) done.tended++; }
            }
        }
        const who = this._pick(workers);
        if (done.harvested.length) {
            const total = done.harvested.reduce((s, h) => s + (h.amount || 0), 0);
            const names = [...new Set(done.harvested.map(h => h.cropName))].join(t('、'));
            this._note(w, who, '🌾 {who}帶大家收了{crops}，共 {n} 份進倉。', { who: who.name, crops: names, n: total }, 5, 'farm', 4);
        }
        if (done.planted.length) {
            const names = [...new Set(done.planted.map(c => c.name))].join(t('、'));
            this._note(w, who, '🌱 {who}在田裡種下了{crops}。', { who: who.name, crops: names }, 3);
        }
    }

    // ---------- 工坊：成品入庫或拿去賣 ----------
    _factories(w) {
        const pr = w.processing; if (!pr?.builtFactories) return;
        const SI = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : {};
        const hasMarket = (w.buildings?.completed || []).some(b => b.name === t('市集'));
        // 訂單先交（訂單是從工坊倉庫出貨），剩下的再入倉或賣
        for (const o of (pr.orders || []).filter(o => o.status === 'active')) {
            try {
                const r = pr.fulfillOrder?.(o.id, w);
                if (r?.ok) { const who = this._pick(this._byJob(w, 'trader')); this._note(w, who, '📋 {who}把「{order}」這張訂單交了貨，賺進 {n} 銀幣。', { who: who?.name || '', order: o.description || '', n: o.reward || 0 }, 5, 'economy', 5); }
            } catch (e) {}
        }
        for (const [key, f] of Object.entries(pr.builtFactories)) {
            if (f.status !== 'active' || !f.warehouse) continue;
            const worker = f.workers?.length ? w.agents[f.workers[0]] : null;
            for (const [r, amt] of Object.entries({ ...f.warehouse })) {
                if (!amt || amt < 1) continue;
                const stock = w.stockpile.get(r);
                // 鎮上已經很多（> 保留量）且賣得掉的拿去賣（有市集時 processing 自己會賣一點，這裡補足），其餘入倉大家用
                if (stock > VillagerAutonomy.GOOD_RESERVE && (SI[r] || hasMarket)) {
                    const sell = Math.min(Math.floor(amt), 6);
                    if (sell > 0 && pr.sellProduct(key, r, sell, w)) continue;
                }
                pr.collectProduct(key, r, Math.floor(amt), w);
            }
            if (worker && Math.random() < 0.15) worker.memory?.addT?.(w.tickCount, w.clock.timeStr, 'work', '今天把工坊做好的東西點了點，該入倉的入倉，多的拿去換錢。', {}, 2, []);
        }
    }

    // ---------- 行商：商人去談 ----------
    _merchant(w) {
        const tr = w.trade; const m = tr?.merchant; if (!m || !m.offers?.length) return;
        const who = this._pick(this._byJob(w, 'trader', false)) || this._pick(this._byJob(w, 'mayor', false)) || this._pick(this._npcs(w));
        if (!who) return;
        const pop = Math.max(1, this._npcs(w).length);
        const reserve = (r) => r === 'food' ? 150 + pop * VillagerAutonomy.FOOD_RESERVE_PER_NPC : r === 'medicine' ? 30 : r === 'tools' ? 25 : ['wood', 'stone', 'metal', 'cloth', 'herbs'].includes(r) ? VillagerAutonomy.RAW_RESERVE : VillagerAutonomy.GOOD_RESERVE; // 藥和工具多留一點
        const low = (r) => r === 'food' ? 100 : ['wood', 'stone', 'metal', 'cloth', 'herbs'].includes(r) ? 15 : 5;
        const deals = [];
        // 先賣（進帳），再買;v6.40.1 一天跟行商賣貨最多進帳 100 銀幣
        let earned = 0;
        for (let i = m.offers.length - 1; i >= 0; i--) {
            const o = m.offers[i]; if (!o || !o.isBuying || earned >= 100) continue;
            const surplus = w.stockpile.get(o.resource) - reserve(o.resource);
            const qty = Math.min(Math.floor(o.amount), Math.floor(surplus * 0.5), 25); // v6.40.1 一次只賣多出來的一半、每樣最多 25 份(上線實測一趟行商進帳上千)
            const q2 = Math.min(qty, Math.floor((100 - earned) / Math.max(0.1, o.price)));
            if (q2 >= 3) { const r = tr.executeTrade(i, q2, w); if (r?.ok) { deals.push({ type: 'sell', r: o.resource, qty: q2, silver: Math.round(q2 * o.price) }); earned += q2 * o.price; } }
        }
        for (let i = m.offers.length - 1; i >= 0; i--) {
            const o = m.offers[i]; if (!o || o.isBuying) continue;
            const have = w.stockpile.get(o.resource);
            if (have >= low(o.resource)) continue;
            const need = Math.min(Math.floor(o.amount), Math.ceil(low(o.resource) * 1.5 - have));
            const canPay = Math.floor((w.stockpile.get('silver') - 80) / Math.max(0.1, o.price));
            const qty = Math.min(need, canPay);
            if (qty >= 2) { const r = tr.executeTrade(i, qty, w); if (r?.ok) deals.push({ type: 'buy', r: o.resource, qty, silver: Math.round(qty * o.price) }); }
        }
        if (!deals.length) { if (Math.random() < 0.3) this._note(w, who, '🧭 {who}去看了商人{m}的貨，覺得價錢不划算，沒成交。', { who: who.name, m: m.name }, 2); return; }
        const rn = (r) => (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[r]) ? t(RESOURCE_NAMES_ZH[r]) : (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[r]) ? SHOP_ITEMS[r].name() : t(r);
        const sold = deals.filter(d => d.type === 'sell'), bought = deals.filter(d => d.type === 'buy');
        const parts = [];
        if (sold.length) parts.push(t('賣出') + ' ' + sold.map(d => `${rn(d.r)}×${d.qty}`).join(t('、')) + t('（進帳 ') + sold.reduce((s, d) => s + d.silver, 0) + t(' 銀幣）'));
        if (bought.length) parts.push(t('買進') + ' ' + bought.map(d => `${rn(d.r)}×${d.qty}`).join(t('、')) + t('（花了 ') + bought.reduce((s, d) => s + d.silver, 0) + t(' 銀幣）'));
        this._note(w, who, '🧭 {who}跟商人{m}談成了生意：{deal}', { who: who.name, m: m.name, deal: parts.join(t('；')) }, 6, 'economy', 6);
        tr.tradeHistory = tr.tradeHistory || []; tr.tradeHistory.push({ day: this._abs(w), who: who.name, merchant: m.name, deals }); if (tr.tradeHistory.length > 40) tr.tradeHistory = tr.tradeHistory.slice(-40);
    }

    // ---------- 商店：缺什麼有人去補、多的拿去賣 ----------
    _shop(w) {
        const shop = w.shop; if (!shop?.buy) return;
        const SI = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : {};
        const npcs = this._npcs(w); const pop = Math.max(1, npcs.length);
        const silver = () => w.stockpile.get('silver');
        const buys = [];
        const need = [
            { r: 'medicine', min: 3, want: 6, when: () => npcs.some(a => a.isSick || (a.health ?? 100) < 50), who: 'doctor' },
            { r: 'food', min: 60, want: Math.round(pop * 4), when: () => true, who: 'cook' },
            { r: 'tools', min: 2, want: 5, when: () => true, who: 'blacksmith' },
            { r: 'cloth', min: 5, want: 12, when: () => true, who: 'tailor' },
            { r: 'herbs', min: 4, want: 10, when: () => !!w.agents && npcs.some(a => a.job?.key === 'doctor'), who: 'doctor' },
        ];
        for (const n of need) {
            if (!SI[n.r] || w.stockpile.get(n.r) >= n.min || !n.when()) continue;
            const qty = Math.max(1, Math.min(n.want - w.stockpile.get(n.r), Math.floor((silver() - 60) / SI[n.r].buyPrice)));
            if (qty < 1) continue;
            const r = shop.buy(n.r, qty, w);
            if (r?.success) { const who = this._pick(this._byJob(w, n.who)); buys.push({ who, r: n.r, qty, cost: qty * SI[n.r].buyPrice }); }
        }
        for (const b of buys) this._note(w, b.who, '🛒 鎮上{item}快沒了，{who}去商店補了 {n} 份（{cost} 銀幣）。', { who: b.who?.name || '', item: SI[b.r].name(), n: b.qty, cost: b.cost }, 4, 'economy', 4);
        // 賣：沒人用得上、堆太多的（酒、傢俱、麵包…）留 15 賣掉其餘，一天最多兩樣
        const sellable = ['beer', 'wine', 'furniture', 'bread', 'clothing'].filter(r => SI[r] && w.stockpile.get(r) > 80).sort((a, b) => w.stockpile.get(b) - w.stockpile.get(a)).slice(0, 1); // v6.40.1 一天只賣一樣、存量 80 以上才賣
        for (const r of sellable) {
            const qty = Math.min(6, Math.floor(w.stockpile.get(r) - 50)); // 留 50、一次最多 6 份
            const res = shop.sell(r, qty, w);
            if (res?.success) { const who = this._pick(this._byJob(w, 'trader')); this._note(w, who, '💰 {who}把倉裡多出來的{item} {n} 份拿去賣了，進帳 {gain} 銀幣。', { who: who?.name || '', item: SI[r].name(), n: qty, gain: qty * SI[r].sellPrice }, 4, 'economy', 3); }
        }
    }

    toDict() { return { log: this.log.slice(-20) }; }
    serialize() { return { log: this.log.slice(-20) }; }
    loadFrom(d) { if (d?.log) this.log = d.log.slice(-60); }
}
if (typeof window !== 'undefined') window.VillagerAutonomy = VillagerAutonomy;
