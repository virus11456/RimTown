// v6.57.0 房子跟著時代升級:木屋(拓荒)→ 木骨石屋(手工)→ 磚造樓房(工坊)
// - 公共建築跟著全鎮的科技時代換樣式;民宅要住戶自己出錢翻修(有錢人先翻新,窮人的房子舊比較久)
// - 等級資料存在 world.housing,3D 依此重建(合併繪製,不多耗效能)
const HOUSING = (() => {
    const COST = [0, 60, 140];
    const STYLE = ['木屋', '木骨石屋', '磚造樓房'];
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const era = (w) => { try { return w.research?.currentEra?.() || 1; } catch (e) { return 1; } };
    const maxLv = (w) => Math.max(0, Math.min(2, era(w) - 1));
    // 村民實際住哪一棟(地圖把住宅區分成一棟棟房子,夫妻同住);地圖還沒好時退回住宅區
    function houseOf(w, a) {
        try { const tm = typeof window !== 'undefined' && window.rimtownApp?.world === w ? window.rimtownApp.tileMap : null; if (tm) bind(w, tm); const id = tm?.getAgentHouseId?.(a.agentId, a.homeLocation); if (id) return id; } catch (e) {}
        return a.homeLocation || null;
    }
    // v9.28.2 誰住哪一棟是這個鎮的狀態(跟著存檔走)，不是畫面的狀態。
    // 以前這張對照表只放在地圖層、不存檔：重新整理後照「誰先被問到」重排，大半的人換了房子，翻修過的房子變成別人在住。
    // 這裡把地圖層用的那張表換成世界自己的這一張；地圖重畫(換鎮、讀檔)後再接一次。
    function bind(w, tm) {
        if (!tm || !w) return; if (!w.housing || typeof w.housing.lv !== 'object') w.housing = { lv: {}, ver: 0 };
        const H = w.housing; if (!H.map || typeof H.map !== 'object') H.map = {};
        if (tm._agentHouseMap === H.map) return;
        const Z = () => tm._houseSubZones || {}; if (!Object.keys(Z()).length) return; // 地圖還沒畫好，晚點再接
        // 存檔裡有人住在加蓋的小屋：先把小屋蓋回來(一次蓋一棟)，還是沒有的才重新分配
        const need = () => Object.values(H.map).filter(h => !Z()[h]).length;
        for (let i = 0; i < 60 && need() > 0; i++) { const n0 = Object.keys(Z()).length; try { tm.ensureHouseCapacity?.(n0 + 1); } catch (e) { break; } if (Object.keys(Z()).length === n0) break; }
        for (const [id, h] of Object.entries(H.map)) if (!Z()[h]) delete H.map[id];
        tm._agentHouseMap = H.map;
    }
    // 人走了(過世、搬離)房子就空出來；出遠門的留著
    function prune(w) { const M = w.housing?.map; if (!M) return; for (const id of Object.keys(M)) { const a = w.agents?.[id]; if ((!a || a.isDead) && !w.isAway?.(id)) delete M[id]; } }
    function S(w) {
        if (!w.housing || typeof w.housing.lv !== 'object') w.housing = { lv: {}, ver: 0 };
        const H = w.housing; if (!H.map || typeof H.map !== 'object') H.map = {};
        for (const a of npcs(w)) { const h = houseOf(w, a); if (h && H.lv[h] === undefined) { H.lv[h] = maxLv(w); H.ver++; } } // 新房子照當下時代蓋
        return H;
    }
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    // v9.22.0 要不要翻修交給住戶本人決定(sim-decide-life.js)；這裡只剩「翻修要多少、料夠不夠」和結算
    const matOf = (lv) => ((typeof ECON !== 'undefined') ? ECON.houseMat(lv + 1) : null);
    const matOk = (w, mat) => !mat || !!(typeof FLOW !== 'undefined' ? FLOW.canPay(w, mat) : w.stockpile?.canAfford?.(mat));
    // 結算：付錢、用料、升一級、同住的人心情變好。回傳 true／false(錢不夠)／'mat'(鎮上料不夠)
    function renovate(w, home, people, payer, lv) {
        const H = S(w); const cost = COST[lv + 1];
        // v6.77.0 翻修要用建材(錢付給公庫＝跟鎮上買料);鎮上木材石材不夠就先等
        const mat = matOf(lv);
        if (!matOk(w, mat)) { H.waitMat = (H.waitMat || 0) + 1; if (H.waitMat % 5 === 1) { try { w.logMessageT?.('economy', '🔨 {a}想把家翻修成{s}，但鎮上{m}不夠，只好先等。', { a: payer.name, s: STYLE[lv + 1], m: ECON.matText(ECON.lack(w, mat)) }, payer.name); } catch (e) {} } return 'mat'; }
        if (!WALLET.pay(w, payer, null, cost, t('{a}翻修房子').replace('{a}', payer.name))) return false;
        if (mat) { if (typeof FLOW !== 'undefined') FLOW.pay(w, mat, t('{a}翻修房子').replace('{a}', payer.name)); else w.stockpile.pay(mat, w.tickCount, t('{a}翻修房子').replace('{a}', payer.name)); } // v6.79.0 木板／磚／硬木／大理石／精裝家具可代替原料
        H.lv[home] = lv + 1; H.ver++;
        for (const p of people) { p.moodModifier = (p.moodModifier || 0) + 4; mem(w, p, p === payer ? '我花了 {n} 銀幣把家翻修成{s}，住起來舒服多了。' : '{a}出錢把我們家翻修成{s}了。', { n: cost, s: STYLE[lv + 1], a: payer.name }, 5); }
        try { w.logMessageT?.('social', '🔨 {a}花了 {n} 銀幣，把家翻修成{s}。', { a: payer.name, n: cost, s: STYLE[lv + 1] }, payer.name); } catch (e) {}
        // 鄰居裡手頭緊的人會眼紅
        for (const o of npcs(w)) if (!people.includes(o) && WALLET.get(w, o) < 20 && Math.random() < 0.15) { o.addThought?.('envious', w, payer.agentId, payer.name); }
        return true;
    }
    // 這個人的家還能翻修嗎(家裡最有錢的人作主)：{ home, lv, cost, style, people, lack(鎮上缺的料) }；不能就回傳 null
    function info(w, a) {
        if (typeof WALLET === 'undefined' || !w.wallet || !a) return null; const H = S(w), top = maxLv(w); const home = houseOf(w, a); if (!home) return null;
        const lv = H.lv[home] ?? top; if (lv >= top) return null;
        const people = npcs(w).filter(o => houseOf(w, o) === home); const payer = people.slice().sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0]; if (payer !== a) return null;
        const mat = matOf(lv); let lack = ''; if (!matOk(w, mat)) { try { lack = ECON.matText(ECON.lack(w, mat)); } catch (e) { lack = '?'; } }
        return { home, lv, cost: COST[lv + 1], style: STYLE[lv + 1], people, lack };
    }
    // 本人決定翻修(由決策核心呼叫)。回傳 true／false／'mat'
    function renovateBy(w, a) {
        const I = info(w, a); if (!I) return false; const r = renovate(w, I.home, I.people, a, I.lv);
        if (r === true) { try { if (typeof WAYS !== 'undefined') WAYS.onRenovate(w, I.home, a); } catch (e) {} }
        return r;
    }
    function daily(w) { prune(w); S(w); } // 翻修由住戶自己決定(renovateBy)；這裡只把新蓋的房子記成當下時代的樣式
    const levels = (w) => S(w).lv;
    const styleOf = (w, home) => STYLE[S(w).lv[home] ?? maxLv(w)];
    const stats = (w) => { const H = S(w), top = maxLv(w); const v = Object.values(H.lv); return { top, total: v.length, upgraded: v.filter(x => x >= top).length, styles: [0, 1, 2].map(i => v.filter(x => x === i).length) }; };
    return { S, houseOf, bind, prune, daily, levels, maxLv, styleOf, stats, STYLE, COST, info, renovateBy };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { const d = this._abs(w); if (w.observerMode && this._houseDay !== d) { this._houseDay = d; HOUSING.daily(w); } } catch (e) { console.warn('[Housing] daily', e); } return r; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.housing = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.housing) d.housing = { lv: this.housing.lv, map: this.housing.map || {} }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.housing = (data?.housing && typeof data.housing.lv === 'object') ? { lv: data.housing.lv, ver: 1, map: (data.housing.map && typeof data.housing.map === 'object') ? data.housing.map : {} } : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.HOUSING = HOUSING;
