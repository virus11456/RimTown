// sim-econ.js — v6.77.0 經濟細緻化
// - 食物分三種:穀物／魚／肉。仍以 stockpile 的 food 當「可以吃的總量」(全遊戲二十多處讀寫 food 不必改),
//   另外記住存糧裡各佔多少(pantry),依地形決定誰去種田、捕魚、打獵,產量也依地形不同;飲食越多樣心情越好
// - 地形:靠海(港口)能捕魚、曬鹽;有河有湖只能捕一點魚;完全不靠水不能捕魚。林地肉多、平原穀物多、山地種田差
// - 工具:每個生產職業都看工具夠不夠(沒工具 7 成、夠用 10 成、充裕多 8%)
// - 紙:木匠用木頭造紙;報社出報、學者做研究、銀行記帳都要用紙,缺紙報紙會停刊、研究變慢
// - 鹽:只有靠海的鎮能曬;醃漬讓存糧腐壞減半、菜比較好吃;內陸要靠商隊買
// - 原料不再每天自動補到 40:只有本地產得出的原料保底 40,其他只保底 20,不夠就得靠貿易
// - 房子翻修與城鎮升格要用木材、石材(以前只花銀幣／只看人口繁榮)
const ECON = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (typeof w._absDay === 'function' ? w._absDay() : 0);
    const KINDS = ['grain', 'fish', 'meat'];
    const KIND_ZH = { grain: '穀物', fish: '魚', meat: '肉' };
    const KIND_ICON = { grain: '🌾', fish: '🐟', meat: '🥩' };
    const ROLE_TITLE = { grain: null, fish: '漁夫', meat: '獵人' };
    function S(w) {
        if (!w.econ || typeof w.econ !== 'object') w.econ = {};
        const E = w.econ;
        if (!E.pantry || typeof E.pantry !== 'object') E.pantry = { grain: 0, fish: 0, meat: 0 };
        for (const k of KINDS) if (!(E.pantry[k] >= 0)) E.pantry[k] = 0;
        if (!E.roles || typeof E.roles !== 'object') E.roles = {};
        if (!E.made || typeof E.made !== 'object') E.made = { grain: 0, fish: 0, meat: 0, salt: 0, paper: 0 };
        if (!E.notes || typeof E.notes !== 'object') E.notes = {};
        return E;
    }
    // ---------- 地形 ----------
    function baseOf(w) {
        const k = w.townTheme || 'frontier';
        const T = (typeof TOWN_THEMES !== 'undefined') ? TOWN_THEMES[k] : null;
        if (T && T.generated && T.base) return T.base;
        return T ? k : 'frontier';
    }
    function terrainOf(w) { const T = (typeof TOWN_THEMES !== 'undefined') ? TOWN_THEMES[w.townTheme] : null; return T?.terrain || w.townMap?.terrain || null; }
    function water(w) {
        const b = baseOf(w), tr = terrainOf(w), L = w.townMap?.locations || {};
        return { sea: b === 'harbor' || tr === 'coastal', fresh: !!(L.river || L.lake) || tr === 'riverside' };
    }
    const GRAIN = { frontier: 1.15, market: 1.0, harbor: 0.75, forest: 0.8, mountain: 0.6 };
    const MEAT = { forest: 1.3, mountain: 0.9, frontier: 0.7, harbor: 0.5, market: 0.5 };
    const WOOD = { forest: 1.4, frontier: 1.0, mountain: 0.8, harbor: 0.6, market: 0.6 };
    function mult(w, kind) {
        const b = baseOf(w);
        if (kind === 'grain') return GRAIN[b] ?? 1;
        if (kind === 'meat') return MEAT[b] ?? 0.6;
        if (kind === 'fish') { const W = water(w); return W.sea ? 1.4 : (W.fresh ? 0.7 : 0); }
        if (kind === 'salt') return water(w).sea ? 1 : 0;
        if (kind === 'paper') return WOOD[b] ?? 1;
        return 1;
    }
    // 本地產得出的原料(保底 40),其他只保底 12
    const NATURE_RAW = { forest: ['wood'], cave: ['stone', 'metal'], hill: ['stone'], meadow: ['herbs', 'cloth'] };
    const BASE_RAW = { frontier: ['wood', 'herbs'], harbor: ['cloth'], mountain: ['stone', 'metal'], forest: ['wood', 'herbs'], market: ['cloth'] };
    function localRaws(w) {
        const set = new Set(BASE_RAW[baseOf(w)] || []);
        const T = (typeof TOWN_THEMES !== 'undefined') ? TOWN_THEMES[w.townTheme] : null;
        for (const r of (T?.exports || [])) set.add(r);
        const L = w.townMap?.locations || {};
        for (const [loc, rs] of Object.entries(NATURE_RAW)) if (L[loc]) rs.forEach(r => set.add(r));
        return set;
    }
    function rawFloor(w, r) { return localRaws(w).has(r) ? 40 : 20; }
    // ---------- 誰去種田、捕魚、打獵 ----------
    function shares(w) {
        const W = water(w), b = baseOf(w);
        const s = { grain: GRAIN[b] ?? 1, meat: (MEAT[b] ?? 0.6) * 0.6, fish: W.sea ? 1.6 : (W.fresh ? 0.35 : 0) };
        const tot = s.grain + s.meat + s.fish; for (const k in s) s[k] /= tot; return s;
    }
    function workplaceFor(w, role) {
        const L = w.townMap?.locations || {};
        if (role === 'fish') return ['river', 'lake'].find(k => L[k]) || 'farm';
        if (role === 'meat') return ['forest', 'hill'].find(k => L[k]) || 'farm';
        return 'farm';
    }
    function applyRole(w, a, role) {
        if (!a.job || a.job.key !== 'farmer') return;
        a.foodRole = role;
        const def = (typeof JOB_DEFINITIONS !== 'undefined') ? JOB_DEFINITIONS.farmer : null;
        a.job.title = ROLE_TITLE[role] || def?.title || a.job.title;
        a.job.workplace = workplaceFor(w, role);
    }
    function assignRoles(w) {
        const E = S(w); const F = npcs(w).filter(a => a.job?.key === 'farmer');
        for (const id of Object.keys(E.roles)) if (!F.some(a => a.agentId === id)) delete E.roles[id];
        if (!F.length) return;
        const sh = shares(w), N = F.length, canFish = mult(w, 'fish') > 0;
        const tgt = {}; const sea = water(w).sea; tgt.fish = canFish ? Math.min(Math.max(sea ? 1 : 0, Math.round(N * sh.fish)), sea ? N : Math.max(0, N - 1)) : 0; // 靠海的鎮至少一人捕魚(只有一個農夫也是)
        tgt.meat = Math.min(Math.round(N * sh.meat), Math.max(0, N - 1 - tgt.fish));
        // 人少時也盡量讓飲食有變化:兩人以上至少一人去捕魚(有水)或打獵
        if (N >= 2 && tgt.fish + tgt.meat === 0) { if (canFish && sh.fish >= sh.meat) tgt.fish = 1; else tgt.meat = 1; }
        tgt.grain = N - tgt.fish - tgt.meat;
        const by = { grain: [], fish: [], meat: [] }, free = [];
        for (const a of F) { const r = E.roles[a.agentId]; if (r && by[r] && (r !== 'fish' || canFish)) by[r].push(a); else free.push(a); }
        for (const k of KINDS) while (by[k].length > tgt[k]) free.push(by[k].pop());
        for (const k of ['fish', 'meat', 'grain']) while (by[k].length < tgt[k] && free.length) by[k].push(free.shift());
        for (const a of free) by.grain.push(a);
        for (const k of KINDS) for (const a of by[k]) { if (E.roles[a.agentId] !== k && E.roles[a.agentId]) { try { a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'daily', k === 'fish' ? '鎮上缺人捕魚，我改去水邊撒網了。' : k === 'meat' ? '鎮上缺人打獵，我改進林子打獵了。' : '我回田裡種地了。', {}, 4, []); } catch (e) {} } E.roles[a.agentId] = k; applyRole(w, a, k); }
    }
    // processDailyProduction 用:農夫依角色換算產量(季節:魚冬天少、肉秋天多;已乘過的種田季節係數先除掉)
    const FISH_SEASON = { '春季': 1.0, '夏季': 1.1, '秋季': 1.0, '冬季': 0.7 };
    const MEAT_SEASON = { '春季': 0.9, '夏季': 1.0, '秋季': 1.2, '冬季': 0.8 };
    function foodMult(w, a) {
        const role = a.foodRole || S(w).roles[a.agentId] || 'grain';
        const m = mult(w, role); if (role === 'grain') return m;
        const season = w.clock?.season; const farmMod = (typeof SEASON_FARM_MOD !== 'undefined' && SEASON_FARM_MOD[season]) || 1;
        const own = (role === 'fish' ? FISH_SEASON : MEAT_SEASON)[season] || 1;
        return m * own / farmMod;
    }
    function noteFood(w, a, amount) {
        if (!(amount > 0)) return; const E = S(w); const role = a?.foodRole || E.roles[a?.agentId] || 'grain';
        E.pantry[role] = (E.pantry[role] || 0) + amount; E.made[role] = (E.made[role] || 0) + amount;
    }
    // ---------- 工具 ----------
    function toolFactor(w) {
        const E = S(w), d = day(w);
        if (E.tf && E.tf.day === d) return E.tf.f;
        const workers = npcs(w).filter(a => { const r = (typeof JOB_PRODUCTION !== 'undefined') ? JOB_PRODUCTION[a.job?.key] : null; return r && Object.keys(r.outputs || {}).length; }).length;
        const need = workers * 0.3, tools = w.stockpile?.get?.('tools') || 0;
        let f = 1; if (need > 0) { const r = tools / need; f = r >= 2 ? 1.08 : r >= 1 ? 1 : 0.7 + 0.3 * r; }
        E.tf = { day: d, f: Math.round(f * 100) / 100, need: Math.ceil(need) };
        return E.tf.f;
    }
    // ---------- 鹽 ----------
    function saltDecay(w) { return S(w).salted ? 0.5 : 1; }
    // ---------- 建材 ----------
    // v6.79.0 翻修與擴建也要家具;木板／硬木可代替木材、磚／大理石代替石材、鋼代替金屬、精裝家具代替家具(sim-flow.js)
    const HOUSE_MAT = [null, { wood: 15, stone: 20, furniture: 1 }, { wood: 10, stone: 35, furniture: 2 }];
    const TIER_MAT = [null, { wood: 60, stone: 60, furniture: 6 }, { wood: 100, stone: 140, metal: 20, furniture: 10 }, { wood: 150, stone: 220, metal: 40, furniture: 15 }];
    function houseMat(lv) { return HOUSE_MAT[lv] || null; }
    function tierMat(lv) { return TIER_MAT[lv] || null; }
    function lack(w, mat) { if (typeof FLOW !== 'undefined') return FLOW.lack(w, mat); const out = {}; if (!mat) return out; for (const [r, n] of Object.entries(mat)) { const h = w.stockpile?.get?.(r) || 0; if (h < n) out[r] = Math.ceil(n - h); } return out; }
    const RES_ZH = { wood: '木材', stone: '石材', metal: '金屬', brick: '磚塊', salt: '鹽', paper: '紙', food: '食物', cloth: '布料', herbs: '草藥', tools: '工具' };
    function matText(m) { return Object.entries(m || {}).map(([r, n]) => `${t(RES_ZH[r] || r)} ${n}`).join(t('、')); }
    // ---------- 每天 ----------
    function log(w, k, p) { try { w.logMessageT?.('economy', k, p || {}); } catch (e) {} }
    function once(w, key, every, fn) { const E = S(w), d = day(w); if (E.notes[key] != null && d - E.notes[key] < every) return; E.notes[key] = d; fn(); }
    function daily(w) {
        const E = S(w), d = day(w), sp = w.stockpile; if (!sp || E.lastDay === d) return; E.lastDay = d;
        const all = npcs(w), pop = all.length || 1, tf = toolFactor(w);
        assignRoles(w);
        // 鹽:靠海才曬得出來;每天醃漬用掉一點
        if (mult(w, 'salt') > 0) {
            const fishers = all.filter(a => a.job?.key === 'farmer' && (a.foodRole || E.roles[a.agentId]) === 'fish').length;
            const amt = Math.round((2 + fishers * 0.6) * tf * (w.clock?.season === '冬季' ? 0.5 : 1) * 10) / 10;
            if (amt > 0) { sp.add('salt', amt, w.tickCount, t('曬鹽')); E.made.salt = (E.made.salt || 0) + amt; }
        }
        const saltNeed = Math.round(pop * 0.05 * 10) / 10;
        const wasSalted = !!E.salted;
        E.salted = (sp.get('salt') || 0) >= saltNeed && sp.consume('salt', saltNeed, w.tickCount, t('醃漬與調味'));
        if (wasSalted !== E.salted && d > 1) once(w, 'salt', 5, () => log(w, E.salted ? '🧂 鎮上又有鹽了：魚肉醃起來放得久，菜也比較有味道。' : '🧂 鎮上的鹽用完了：存糧壞得比較快，飯菜也淡了；只有靠海的鎮曬得出鹽，得靠商隊買。'));
        // 紙:木匠用木頭造紙(木材留 20 給冬天取暖)
        const carp = all.filter(a => a.job?.key === 'carpenter');
        if (carp.length && (sp.get('paper') || 0) < 40) { // 紙存到 40 就先不造,木頭留給取暖與建設(多的可以外銷)
            const make = Math.round(carp.length * 2.5 * tf * mult(w, 'paper') * 10) / 10;
            const wood = Math.min(make * 0.7, Math.max(0, (sp.get('wood') || 0) - (E.paperShort ? 5 : 20))); // v6.79.0 缺紙時木頭只留 5(以前海港木材不夠，紙一直是 0)
            if (wood > 0.5) { sp.consume('wood', Math.round(wood * 10) / 10, w.tickCount, t('造紙')); const out = Math.round(wood / 0.7 * 10) / 10; sp.add('paper', out, w.tickCount, t('木匠造紙')); E.made.paper = (E.made.paper || 0) + out; }
        }
        const papers = (w.press?.papers?.length || 0) + 1;
        const scholars = all.filter(a => a.job?.key === 'researcher').length;
        const paperNeed = Math.round((papers * 1 + scholars * 0.3 + (w.bank?.open ? 0.5 : 0)) * 10) / 10;
        const hadPaper = (sp.get('paper') || 0) >= paperNeed;
        if (hadPaper) sp.consume('paper', paperNeed, w.tickCount, t('報紙、研究與帳本用紙')); else if ((sp.get('paper') || 0) > 0) sp.consume('paper', sp.get('paper'), w.tickCount, t('報紙、研究與帳本用紙'));
        const wasShort = !!E.paperShort; E.paperShort = !hadPaper;
        if (wasShort !== E.paperShort && d > 1) once(w, 'paper', 5, () => log(w, E.paperShort ? '📄 鎮上缺紙：報社可能停刊，學者的研究也慢了下來；木匠能用木頭造紙，林地的鎮紙最多。' : '📄 紙又夠用了：報紙照常出刊，研究恢復進度。'));
        // 天然水域的漁獲算進魚
        if (w.townMap?.locations?.river) E.pantry.fish += 1; if (w.townMap?.locations?.lake) E.pantry.fish += 0.75;
        // 存糧組成跟著總量:被吃掉就照比例減,其他來源(商隊、母雞、救濟)多出來的算穀物
        const food = sp.get('food') || 0, tracked = KINDS.reduce((s, k) => s + E.pantry[k], 0);
        if (tracked <= 0) { E.pantry = { grain: food, fish: 0, meat: 0 }; }
        else if (food < tracked) { const f = food / tracked; for (const k of KINDS) E.pantry[k] *= f; }
        else E.pantry.grain += food - tracked;
        for (const k of KINDS) E.pantry[k] = Math.round(E.pantry[k] * 10) / 10;
        // 飲食多樣
        const tot = Math.max(1, food); E.variety = KINDS.filter(k => E.pantry[k] / tot >= 0.12).length;
        if (food > pop) {
            if (E.variety >= 3) for (const a of all) a.moodModifier = (a.moodModifier || 0) + 1;
            else if (E.variety <= 1) {
                for (const a of all) a.moodModifier = (a.moodModifier || 0) - 0.5;
                const k = KINDS.slice().sort((x, y) => E.pantry[y] - E.pantry[x])[0];
                once(w, 'diet', 7, () => log(w, '🍽️ 鎮上天天只吃{k}，大家都吃膩了——別的食物要靠別的鎮的商隊帶來。', { k: KIND_ZH[k] }));
            }
            if (E.salted && E.variety >= 2) for (const a of all) a.moodModifier = (a.moodModifier || 0) + 0.5;
        }
        E.made = { grain: 0, fish: 0, meat: 0, salt: 0, paper: 0 };
    }
    // 商隊:帶來的食物依對方擅長算成魚／肉／穀物
    function noteTrade(w, give, giveAmt, recv, recvAmt, otherKey) {
        const E = S(w); const ob = (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[otherKey]?.base) || otherKey;
        if (recv === 'food' && recvAmt > 0) { const k = ob === 'harbor' ? 'fish' : ob === 'forest' ? 'meat' : 'grain'; E.pantry[k] = (E.pantry[k] || 0) + recvAmt; }
        if (give === 'food' && giveAmt > 0) { const tot = KINDS.reduce((s, k) => s + E.pantry[k], 0) || 1; for (const k of KINDS) E.pantry[k] = Math.max(0, E.pantry[k] - giveAmt * E.pantry[k] / tot); }
    }
    // ---------- 給介面與 AI ----------
    function specialty(w) {
        const good = [], bad = [];
        if (mult(w, 'fish') >= 1.2) good.push('魚'); else if (mult(w, 'fish') === 0) bad.push('魚');
        if (mult(w, 'salt') > 0) good.push('鹽'); else bad.push('鹽');
        if (mult(w, 'meat') >= 1.2) good.push('肉');
        if (mult(w, 'grain') >= 1.1) good.push('穀物'); else if (mult(w, 'grain') <= 0.65) bad.push('穀物');
        if (mult(w, 'paper') >= 1.3) good.push('紙');
        const L = localRaws(w); for (const r of ['wood', 'stone', 'metal']) { if (L.has(r)) good.push(RES_ZH[r]); else bad.push(RES_ZH[r]); }
        return { good: [...new Set(good)], bad: [...new Set(bad)] };
    }
    function view(w) {
        const E = S(w), sp = w.stockpile, food = sp?.get?.('food') || 0;
        const roles = { grain: 0, fish: 0, meat: 0 }; for (const a of npcs(w)) if (a.job?.key === 'farmer') roles[a.foodRole || E.roles[a.agentId] || 'grain']++;
        toolFactor(w);
        return { pantry: { ...E.pantry }, food, variety: E.variety ?? null, roles, salted: !!E.salted, salt: sp?.get?.('salt') || 0, paper: sp?.get?.('paper') || 0, paperShort: !!E.paperShort, tools: sp?.get?.('tools') || 0, toolNeed: E.tf?.need || 0, toolF: E.tf?.f || 1, spec: specialty(w), canFish: mult(w, 'fish') > 0, canSalt: mult(w, 'salt') > 0 };
    }
    function townBrief(w) {
        try { const V = view(w); const sp = V.spec; const parts = [];
            if (sp.good.length) parts.push(`${t('本鎮擅長')}${t('：')}${sp.good.map(x => t(x)).join(t('、'))}`);
            if (sp.bad.length) parts.push(`${t('得靠貿易')}${t('：')}${sp.bad.map(x => t(x)).join(t('、'))}`);
            if (!V.salted) parts.push(t('鎮上缺鹽')); if (V.paperShort) parts.push(t('鎮上缺紙')); if (V.toolF < 0.95) parts.push(t('工具不夠，大家做事慢'));
            return parts.join(t('；'));
        } catch (e) { return ''; }
    }
    return { S, baseOf, water, mult, localRaws, rawFloor, assignRoles, applyRole, foodMult, noteFood, toolFactor, saltDecay, houseMat, tierMat, lack, matText, daily, noteTrade, specialty, view, townBrief, KINDS, KIND_ZH, KIND_ICON };
})();
if (typeof globalThis !== 'undefined') globalThis.ECON = ECON;

// ---- 存讀檔:存檔帶 econ;讀檔時把角色(漁夫／獵人的職稱與工作地點)套回去
if (typeof World !== 'undefined' && !World.prototype._econHooked) {
    World.prototype._econHooked = true;
    const _ser = World.prototype.serialize, _load = World.prototype.loadSave, _reset = World.prototype.reset;
    World.prototype.serialize = function () { const d = _ser.call(this); try { if (d && this.econ) { const E = this.econ; d.econ = { pantry: E.pantry, roles: E.roles, salted: !!E.salted, paperShort: !!E.paperShort, variety: E.variety ?? null, notes: E.notes, lastDay: E.lastDay ?? null }; } } catch (e) {} return d; };
    World.prototype.loadSave = function (data) {
        const r = _load.call(this, data);
        try { if (r) { this.econ = (data && data.econ && typeof data.econ === 'object') ? JSON.parse(JSON.stringify(data.econ)) : null; const E = ECON.S(this); for (const a of Object.values(this.agents || {})) { const role = E.roles[a.agentId]; if (role && a.job?.key === 'farmer') ECON.applyRole(this, a, role); } } } catch (e) {}
        return r;
    };
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.econ = null; return r; };
}
// ---- AI 知道本鎮擅長什麼、缺什麼
if (typeof ConversationEngine !== 'undefined' && ConversationEngine.prototype._townBrief && !ConversationEngine.prototype._townBrief._econ) {
    const _tb = ConversationEngine.prototype._townBrief;
    const wrapped = function (world, ...rest) { const base = _tb.call(this, world, ...rest); try { const x = ECON.townBrief(world); if (x && typeof base === 'string') return base ? `${base}${t('；')}${x}` : x; } catch (e) {} return base; };
    wrapped._econ = true; ConversationEngine.prototype._townBrief = wrapped;
}
