// RimTown - sim-money.js(v7.7.0 錢從哪來、往哪去)
// 每一塊錢都講得出是誰付的;外地進來的錢一定對應到「賣了什麼東西給外地」:
// - 商人不再每天憑空產出銀幣:商人把倉庫裡多出來的貨運到外地賣,外地付的錢裡,貨的本錢進公庫(倉庫是公家的),加價的部分是商行的營收(有老闆的給老闆,老闆再發薪水)
// - 議會、提案、舊事件「加銀幣」的效果改成真的把多餘的貨賣給外地(沒有多的貨就賣不到錢)
// - 錢從哪來、往哪去月報:外地流入(出口、來訪商人、移民帶來的積蓄、探險)與流出(進口原料與奢侈品、外地包商工程款、向外地訂貨、搬走的人帶走),其餘算「其他」
// - 外地搬來的人跟鎮上的人同名:保留本名,前面加出生地(例如「河谷・林雅婷」);出生地不會變,再搬幾次也只會有一個前綴
'use strict';
const MONEY = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const r2 = (n) => Math.round(n * 100) / 100;
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'work', k, p || {}, imp || 4, []); } catch (e) {} };
    const IN = ['export', 'merchant', 'factory', 'caravan', 'surplus', 'immigrant', 'loot'];
    const OUT = ['import_raw', 'import_goods', 'shop', 'works', 'orders', 'proposals', 'emigrant'];
    const CAT = { export: '商人出口', merchant: '來訪商人買賣', surplus: '賣出多餘的貨', immigrant: '移民帶來的積蓄', loot: '探險帶回', factory: '工廠產品外銷', caravan: '往來商隊', shop: '鎮上商店進貨與賣貨', proposals: '提案（外銷商隊、外地材料）', import_raw: '向外地買原料', import_goods: '外地奢侈品', works: '外地包商的工程款', orders: '向外地訂貨', emigrant: '搬走的人帶走', other: '其他' };
    // 全鎮的錢:公庫＋每個人的錢包＋銀行準備金＋工會基金＋教團基金
    function total(w) { let s = (w.stockpile?.resources?.silver || 0) + (+w.bank?.reserve || 0) + (+w.union?.fund || 0); const B = w.wallet?.bal; if (B) for (const k in B) s += (+B[k] || 0); for (const R of (w.faith?.rels || [])) s += (+R.fund || 0); return s; }
    function S(w) { if (!w.money || typeof w.money !== 'object') w.money = {}; const M = w.money; M.days = M.days || {}; M.hist = M.hist || []; M.pend = M.pend || 0; M.st = M.st || { exportQty: 0, exportSale: 0, surplus: 0 }; return M; }
    function flow(w, cat, n) { if (!w || !(Math.abs(n) > 1e-6)) return; const M = S(w), d = day(w); const D = M.days[d] = M.days[d] || {}; D[cat] = r2((D[cat] || 0) + n); M.pend = r2(M.pend + n); }
    // 包一層:呼叫前後比對全鎮的錢,差額記到某一類(外地交易都經過這些地方)
    // 裡面已經記過的(例如外地包商的工程款、裡層的追蹤點)會扣掉,同一筆錢不會記兩次
    function track(obj, name, cat) { const f = obj?.[name]; if (typeof f !== 'function' || f.__money) return; const g = function (...args) { const w = (args[0] && args[0].agents) ? args[0] : (this && this.agents ? this : (typeof window !== 'undefined' ? window.rimtownApp?.world : null)); const b = w ? total(w) : 0, p0 = w ? S(w).pend : 0; const r = f.apply(this, args); try { if (w) flow(w, cat, (total(w) - b) - (S(w).pend - p0)); } catch (e) {} return r; }; g.__money = true; obj[name] = g; }
    // 每天結帳:總數變化裡沒被記到的部分算「其他」;順便記下每天的總數與人口(看人均)
    function close(w) {
        const M = S(w), d = day(w); if (M.lastClose === d) return; const T = total(w), pop = npcs(w).length;
        if (typeof M.lastT === 'number') { const other = r2((T - M.lastT) - M.pend); if (Math.abs(other) > 0.01) { const D = M.days[d] = M.days[d] || {}; D.other = r2((D.other || 0) + other); } }
        M.lastT = T; M.pend = 0; M.lastClose = d; M.hist.push([d, Math.round(T), pop]); if (M.hist.length > 62) M.hist.splice(0, M.hist.length - 62);
        for (const k of Object.keys(M.days)) if (+k < d - 61) delete M.days[k];
    }
    // ---------- 多餘的貨 ----------
    const PRICE = (r) => (typeof BASE_PRICES !== 'undefined' && BASE_PRICES[r]) || ({ food: 1, wood: 1.5, stone: 2, metal: 4, cloth: 3, herbs: 3.5, meals: 2.5, tools: 8, clothing: 6, medicine: 10, furniture: 7, paper: 3 }[r] || 0);
    // 只賣成品與多的糧食:原料(木、石、金屬、布、藥草)是鎮上做東西要用的,賣掉又得用更貴的價錢買回來
    function floors(w) { const pop = npcs(w).length; return { food: Math.max(120, pop * 12), meals: Math.max(20, pop * 3), /* 糧食要留夠(移民也看存糧),多的才賣 */ tools: Math.max(15, pop * 0.6), clothing: Math.max(12, pop * 0.5), furniture: 8, medicine: Math.max(10, pop * 0.3), paper: 20 }; }
    const GROUP = { food: 'food', meals: 'food', clothing: 'cloth' };
    const scarce = (w, r) => { try { return typeof PRICES !== 'undefined' && w.prices && GROUP[r] && PRICES.idx(w, GROUP[r]) > 1.0; } catch (e) { return false; } };
    function surplusList(w) { const sp = w.stockpile, F = floors(w); const out = []; for (const [r, f] of Object.entries(F)) { const have = sp?.get?.(r) || 0, p = PRICE(r), extra = Math.floor(have - f - (sp.reserved?.[r] || 0)); if (p > 0 && extra >= 1 && !scarce(w, r)) out.push({ r, extra, p, v: extra * p }); } return out.sort((a, b) => b.v - a.v); }
    // 把價值大約 n 銀幣的多餘貨賣給外地,錢進公庫;沒有多的貨就賣不到
    function sellSurplus(w, n, why) {
        const sp = w.stockpile; if (!sp || !(n > 0)) return 0; let left = n, got = 0;
        for (const g of surplusList(w)) { if (left <= 0.01) break; const qty = Math.min(g.extra, Math.ceil(left / g.p)); if (qty < 1 || !sp.consume(g.r, qty, w.tickCount, why || t('賣給外地'))) continue; const v = r2(qty * g.p); got += v; left -= v; }
        got = r2(got); if (got > 0) { sp.add('silver', got, w.tickCount, why || t('賣出多餘的貨')); flow(w, 'surplus', got); S(w).st.surplus = r2(S(w).st.surplus + got); }
        return got;
    }
    // ---------- 商人出口 ----------
    const MARKUP = 1.3, BUDGET = 12;
    function exportDaily(w) {
        const sp = w.stockpile; if (!sp) return; const Wl = typeof WALLET !== 'undefined' && w.wallet ? WALLET : null;
        const bonus = (w.buildings?.getEffect?.('trade_bonus', 0) || 0); const away = (a) => w.isAway?.(a.agentId) || a.currentLocation === 'exploration';
        for (const a of npcs(w).filter(x => x.job?.key === 'trader' && (x.age ?? 30) >= 16 && !away(x))) {
            let budget = BUDGET * (1 + bonus), base = 0, qtyAll = 0; const sold = [];
            for (const g of surplusList(w)) { if (budget <= 0.5) break; const qty = Math.min(g.extra, Math.floor(budget / g.p)); if (qty < 1 || !sp.consume(g.r, qty, w.tickCount, t('商人運去外地賣'))) continue; const v = qty * g.p; base += v; budget -= v; qtyAll += qty; sold.push([g.r, qty]); }
            if (!(base > 0)) continue; base = r2(base); const sale = r2(base * MARKUP), profit = r2(sale - base);
            sp.add('silver', base, w.tickCount, t('商人出口的貨款')); // 倉庫的貨是公家的,本錢歸公庫
            // 加價賺的是商行的營收:有老闆的付給老闆(老闆再發薪水給商人),公營的進公庫(公庫發商人薪水)
            if (typeof MARKET !== 'undefined' && w.market) MARKET.sell(w, 'trade', profit, t('商人出口')); else if (Wl) { if (Wl.bizIncome) Wl.bizIncome(w, a, profit); else Wl.add(w, a, profit); } else sp.add('silver', profit, w.tickCount, t('商人出口'));
            flow(w, 'export', sale); const M = S(w); M.st.exportQty += qtyAll; M.st.exportSale = r2(M.st.exportSale + sale);
            if (Math.random() < 0.15) { const [r, q] = sold[0]; log(w, '🐪 {a}把 {n} 份{g}運到外地賣了 {s} 銀幣。', { a: a.name, n: q, g: (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[r]) || r, s: Math.round(sale) }, a.name); mem(w, a, '把鎮上多出來的貨運到外地賣，替商行多賺了 {n} 銀幣。', { n: Math.round(profit) }, 4); }
        }
    }
    // ---------- 外地同名:出生地・本名 ----------
    const short = (bp) => { const s = String(bp || ''); return s.length > 2 && /[鎮村城港市堡]$/.test(s) ? s.slice(0, -1) : s; };
    const baseOf = (name) => String(name || '').split('・').pop();
    function prefixed(w, base, bp) { const name = `${short(bp)}・${base}`; try { if (typeof I18N !== 'undefined' && I18N.registerName) I18N.registerName(name, `${I18N.localizeName ? I18N.localizeName(base) : base} of ${t(bp)}`); } catch (e) {} if (w) { w.namePrefix = w.namePrefix || {}; w.namePrefix[name] = { base, bp }; } return name; }
    function originTown(w) { const T = (w.otherTowns || []).map(x => x?.name).filter(Boolean); return T.length ? T[Math.floor(Math.random() * T.length)] : ''; }
    function reRegister(w) { for (const [name, v] of Object.entries(w?.namePrefix || {})) { try { if (typeof I18N !== 'undefined') I18N.registerName(name, `${I18N.localizeName ? I18N.localizeName(v.base) : v.base} of ${t(v.bp)}`); } catch (e) {} } }
    // ---------- 每天 ----------
    function daily(w) { if (!w.observerMode) return; const M = S(w), d = day(w); if (M.lastDaily === d) return; M.lastDaily = d; try { exportDaily(w); } catch (e) { console.warn('[Money] export', e); } close(w); }
    function view(w, n = 30) {
        const M = S(w), d = day(w); const sum = {}; for (const [k, D] of Object.entries(M.days)) if (+k > d - n) for (const [c, v] of Object.entries(D)) sum[c] = r2((sum[c] || 0) + v);
        // 每一類照實際正負放到流入或流出(例如來訪商人那個月鎮上買得比賣得多,就算流出)
        const ALL = IN.concat(OUT); const ins = ALL.map(c => [c, sum[c] || 0]).filter(x => x[1] > 0.5).sort((a, b) => b[1] - a[1]), outs = ALL.map(c => [c, sum[c] || 0]).filter(x => x[1] < -0.5).sort((a, b) => a[1] - b[1]);
        const net = r2(Object.values(sum).reduce((s, v) => s + v, 0)); const T = Math.round(total(w)), pop = npcs(w).length; const old = M.hist.find(h => h[0] >= d - n) || M.hist[0];
        return { days: Math.min(n, M.hist.length), ins, outs, other: sum.other || 0, net, total: T, pop, per: pop ? Math.round(T / pop) : 0, perOld: old && old[2] ? Math.round(old[1] / old[2]) : null, label: (c) => CAT[c] || c, st: M.st };
    }
    function townBrief(w) { if (!w.money) return ''; const v = view(w); if (v.days < 7) return ''; return t('近 {n} 天鎮上的錢{dir} {m} 銀幣').replace('{n}', v.days).replace('{dir}', v.net >= 0 ? t('多了') : t('少了')).replace('{m}', Math.abs(Math.round(v.net))); }
    return { S, total, flow, track, close, sellSurplus, surplusList, floors, exportDaily, prefixed, baseOf, short, originTown, reRegister, daily, view, townBrief, CAT, IN, OUT, MARKUP, BUDGET };
})();

// ---------- 接上其他系統 ----------
// 商人、鎮長不再每天憑空產出銀幣(商人改成真的出口;鎮長本來就有公庫發的薪水)
if (typeof JOB_PRODUCTION !== 'undefined') { if (JOB_PRODUCTION.trader) JOB_PRODUCTION.trader.outputs = {}; if (JOB_PRODUCTION.mayor) JOB_PRODUCTION.mayor.outputs = {}; }
// 外地交易:呼叫前後比對全鎮的錢,差額記進月報
if (typeof VillagerAutonomy !== 'undefined') MONEY.track(VillagerAutonomy.prototype, '_merchant', 'merchant');
if (typeof GOODS !== 'undefined') MONEY.track(GOODS, 'buy', 'import_goods');
if (typeof ExplorationSystem !== 'undefined') MONEY.track(ExplorationSystem.prototype, '_checkReturningExpeditions', 'loot');
if (typeof ProposalSystem !== 'undefined') MONEY.track(ProposalSystem.prototype, '_procure', 'orders');
if (typeof World !== 'undefined') { MONEY.track(World.prototype, 'leaveTown', 'emigrant'); MONEY.track(World.prototype, '_caravanDaily', 'caravan'); }
if (typeof VillagerAutonomy !== 'undefined') MONEY.track(VillagerAutonomy.prototype, '_shop', 'shop');
if (typeof ProcessingSystem !== 'undefined') MONEY.track(ProcessingSystem.prototype, 'sellProduct', 'factory');
if (typeof ProposalSystem !== 'undefined') MONEY.track(ProposalSystem.prototype, '_execute', 'proposals');
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { MONEY.daily(w); } catch (e) { console.warn('[Money] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = MONEY.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.money = null; this.namePrefix = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d) { if (this.money) { const M = this.money; d.money = { days: M.days, hist: M.hist, st: M.st, lastT: M.lastT, lastClose: M.lastClose, pend: M.pend || 0 }; } if (this.namePrefix) d.namePrefix = this.namePrefix; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.money = (data?.money && typeof data.money === 'object') ? data.money : null; this.namePrefix = (data?.namePrefix && typeof data.namePrefix === 'object') ? data.namePrefix : null; MONEY.reRegister(this); } } catch (e) {} return r; };
}
