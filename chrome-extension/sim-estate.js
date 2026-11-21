// v6.90.0 房產、資本與財富流動
// - 住宅市場:以「一戶」為單位(夫妻＋未成年子女一戶,成年單身自己一戶);房子數量有限,不夠就沒地方住
// - 房子有主人:自住的屋主繳一點地價稅;租屋的每週付房租給房東(公有房舍付給公庫);缺房時房租會漲
// - 付不起房租就欠著,欠太多被趕出去,睡在廣場;手頭有點錢、又有空屋才租得回來
// - 房產買賣:公有房舍標售給有錢人(房東階級)、手頭緊的屋主賣掉自住的房子變成租客、有錢人蓋新房出租
// - 抵押:屋主缺錢可以拿房子跟銀行借,還不出來房子被銀行收走
// - 有錢人請窮人當傭人(每天付工錢),主人沒錢了就辭退
// - 開局居民有家族:一部分大人是夫妻、小孩和年輕人有爸媽
// v11.14.0 買房賣房、蓋出租屋、公庫蓋不蓋公有房舍、請不請幫傭，都交給本人決定（見檔案中段「房子」那一節）；決策核心沒開時照原本的規則
const ESTATE = (() => {
    const DAY = 96;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / DAY));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const cash = (w, a) => (WL() && a ? WL().get(w, a) : 0);
    // v9.24.0 屋主要不要拿房子去抵押，交給本人決定(sim-decide-share.js：「手頭很緊」多一個選項)
    const tier = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { return 0; } };
    const land = (w) => { try { return typeof CIVIC !== 'undefined' && CIVIC.landPrice ? CIVIC.landPrice(w) : 50; } catch (e) { return 50; } };
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', Math.round(n * 100) / 100, w.tickCount, why); };
    // 公有房舍的租金:三成五拿去請木作坊修繕(錢流回民間),其餘進公庫
    const pubRent = (w, n) => { if (n <= 0) return; const fix = Math.round(n * 0.35 * 100) / 100;
        if (typeof MARKET !== 'undefined' && w.market && MARKET.sell) { MARKET.sell(w, 'timber', fix, t('公有房舍修繕')); toTown(w, n - fix, t('公有房舍租金')); } else toTown(w, n, t('公有房舍租金')); };
    const HOMELESS_AT = 'town_square';
    const HS_KEYS = ['buyNo', 'bldNo', 'sale', 'svAsk', 'svKeep', 'svOff', 'svNo'];
    function S(w) {
        if (!w.estate || typeof w.estate.units !== 'object') w.estate = { units: {}, home: {}, orig: {}, homeless: {}, arrears: {}, servants: {}, lodge: {}, n: 0, lastDay: null, stats: { built: 0, evicted: 0, foreclosed: 0, sold: 0, rent: 0, ptax: 0 } };
        const E = w.estate; for (const k of ['units', 'home', 'orig', 'homeless', 'arrears', 'servants', 'lodge', 'll', 'llAsk', 'late', 'grace', 'cut']) E[k] = E[k] || {}; E.stats = E.stats || {}; if (!E.hs || typeof E.hs !== 'object') E.hs = {}; for (const k of HS_KEYS) if (!E.hs[k] || typeof E.hs[k] !== 'object') E.hs[k] = {}; if (!(E.hs.n >= 0)) E.hs.n = 0; /* v11.14.0 hs：買賣房子、蓋屋、幫傭這幾件事問過誰、掛著哪幾筆（舊存檔沒有，就是都沒問過） */ // v11.6.0 ll 房東定的檔位、llAsk 上次問他的日子、late 欠租等房東回話、grace 寬限到哪天、cut 欠租期間打八折（舊存檔沒有這幾格，就是照行情、沒人在等）
        return E;
    }
    // ---------- 一戶 ----------
    const spouseOf = (w, a) => { const R = a.relationships?.relationships || {}; for (const id in R) if (R[id].status === 'married' && w.agents[id] && !w.agents[id].isDead) return w.agents[id]; return null; };
    const parentsOf = (w, a) => (a._parentNames || []).map(n => npcs(w).find(o => o.name === n)).filter(Boolean);
    function headOf(w, a) {
        if ((a.age || 30) < 18) { const p = parentsOf(w, a)[0]; if (p) return headOf(w, p); }
        const sp = spouseOf(w, a); if (sp) return String(sp.agentId) < String(a.agentId) ? sp : a;
        return a;
    }
    function households(w) { const m = new Map(); for (const a of npcs(w)) { const h = headOf(w, a); if (!m.has(h.agentId)) m.set(h.agentId, []); m.get(h.agentId).push(a); } return m; }
    const unitOf = (w, a) => { const E = S(w); const h = headOf(w, a); return E.home[h.agentId] || null; };
    const isHomeless = (w, a) => { const h = headOf(w, a); return S(w).homeless[h.agentId] !== undefined; };
    // ---------- 價格 ----------
    // v11.10.0 每天安置與收租時，「缺不缺房」這個數字會被問上千次（排房租高低時每比一次就問兩次），每問一次都把全鎮重新分一遍戶。
    // 這段期間戶數不會變，所以記住一次；房子數變了就重算。只在 scarOnce 包住的那一段有效，其他時候照舊每次都算
    let _scar = null; const scarOnce = (w, fn) => { _scar = { w, n: -1, v: 0 }; try { return fn(); } finally { _scar = null; } };
    function scarcity(w) { const E = S(w); const n = Object.keys(E.units).length || 1; if (_scar && _scar.w === w && _scar.n === n) return _scar.v; const hh = households(w).size; const v = Math.max(0.8, Math.min(2, hh / n)); if (_scar && _scar.w === w) { _scar.n = n; _scar.v = v; } return v; }
    // 房租跟著鎮上的工資水準走:基本的房子約是一週基本工資的兩成上下,缺房時漲、房子好的貴;公有房舍打八折(公營住宅)
    const WEEK_WAGE = 4.5 * 7;
    // v11.6.0 私人房東自己定檔位（貴一點 ×1.15／照行情／便宜一點 ×0.85，只管他名下出租的房子；公有房舍照舊）。hid：這一週付租的那一戶；
    // 有給 hid 才算「給自己人便宜」（房客是他的家人或好朋友再打八五折）和欠租時講好的八折。找房、寄住、排便宜的房子用的是掛牌價（不給 hid）
    const TIER_F = { hi: 1.15, mid: 1, lo: 0.85 };
    const rawRent = (w, u) => WEEK_WAGE * (0.15 + (u.lv || 0) * 0.06 + tier(w) * 0.015) * scarcity(w) + land(w) / 80;
    const rentOf = (w, u, hid) => { let f = u.owner ? 1 : 0.8; if (u.owner) { const P = w.estate?.ll?.[u.owner]; if (P) { f *= TIER_F[P.tier] || 1; if (hid && P.kin && kinHH(w, u.owner, hid)) f *= 0.85; } if (hid && w.estate?.cut?.[hid]?.uid === u.id) f *= 0.8; }
        return Math.max(2, Math.round(rawRent(w, u) * f)); };
    const valueOf = (w, u) => Math.round(80 + (u.lv || 0) * 70 + land(w) * 0.6);
    const ownerAgent = (w, u) => (u.owner && w.agents[u.owner]) ? w.agents[u.owner] : null;
    const ownsOf = (w, id) => Object.values(S(w).units).filter(u => u.owner === id);

    // ---------- 開局:分房、決定屋主 ----------
    function init(w) {
        const E = S(w); if (Object.keys(E.units).length) return;
        const hh = households(w); const n = Math.ceil(hh.size * 1.05) + 2;
        for (let i = 0; i < n; i++) { const id = 'U' + (++E.n); E.units[id] = { id, owner: null, occ: null, lv: 0 }; }
        const free = Object.values(E.units);
        for (const [hid, mem_] of hh) {
            const u = free.shift(); if (!u) break; u.occ = hid; E.home[hid] = u.id;
            const head = w.agents[hid]; const rich = mem_.slice().sort((x, y) => cash(w, y) - cash(w, x))[0];
            if (rich && cash(w, rich) >= 40 && Math.random() < 0.6) u.owner = rich.agentId; // 有點積蓄的人家住自己的房子,其餘是公有房舍租來的
        }
    }
    // 寄住(分租):沒有空屋時,一棟房子可以再住 1～2 戶,付一半房租
    const lodgeCap = (u) => 1 + ((u.lv || 0) >= 1 ? 1 : 0);
    const lodgersOf = (u) => (u.lodgers = u.lodgers || []);
    function moveOut(w, hid) {
        const E = S(w); const uid = E.home[hid]; const u = uid && E.units[uid];
        if (u) { if (u.occ === hid) { u.occ = null; const L = lodgersOf(u); if (L.length) { u.occ = L.shift(); delete E.lodge[u.occ]; } } else u.lodgers = lodgersOf(u).filter(x => x !== hid); }
        delete E.home[hid]; delete E.lodge[hid];
    }
    function lodgeIn(w, hid, u) { const E = S(w); moveOut(w, hid); lodgersOf(u).push(hid); E.home[hid] = u.id; E.lodge[hid] = 1; delete E.arrears[hid]; unHomeless(w, hid); }
    function unHomeless(w, hid) { const E = S(w); if (E.homeless[hid] === undefined) return; delete E.homeless[hid]; for (const a of households(w).get(hid) || []) { if (E.orig[a.agentId]) { a.homeLocation = E.orig[a.agentId]; delete E.orig[a.agentId]; } } }
    const lodgeSlot = (w) => Object.values(S(w).units).filter(u => u.occ && lodgersOf(u).length < lodgeCap(u)).sort((x, y) => rentOf(w, x) - rentOf(w, y))[0];
    function moveIn(w, hid, u) { const E = S(w); moveOut(w, hid); u.occ = hid; E.home[hid] = u.id; delete E.arrears[hid];
        if (E.homeless[hid] !== undefined) { delete E.homeless[hid]; for (const a of households(w).get(hid) || []) { if (E.orig[a.agentId]) { a.homeLocation = E.orig[a.agentId]; delete E.orig[a.agentId]; } } } }
    function evict(w, hid, why) {
        const E = S(w); const members = households(w).get(hid) || []; const uid = E.home[hid]; const u = E.units[uid]; const owner = u && ownerAgent(w, u);
        moveOut(w, hid); E.homeless[hid] = day(w); E.stats.evicted = (E.stats.evicted || 0) + 1;
        for (const a of members) { if (a.homeLocation !== HOMELESS_AT) { E.orig[a.agentId] = a.homeLocation; a.homeLocation = HOMELESS_AT; } a.addThought?.('homeless', w); mem(w, a, why === 'rent' ? '付不出房租，被{o}趕出來了，今晚只能睡廣場。' : '沒有地方住了，只能睡在廣場。', { o: owner?.name || t('房東') }, 8); }
        const head = w.agents[hid]; if (head) log(w, '🏚️ {a}一家付不出房租，被趕出了家門。', { a: head.name }, head.name);
    }
    // 新的一戶(長大、搬來、離婚)找房子;夫妻合住後空出的房子屋主可以出租
    function settle(w, hh) {
        const E = S(w);
        for (const hid of Object.keys(E.home)) if (!hh.has(hid) && !w.isAway?.(hid)) moveOut(w, hid);           // 這一戶不存在了(搬走、併入配偶家);v9.9.4 一個人住的出遠門,房子留著
        for (const hid of Object.keys(E.homeless)) if (!hh.has(hid)) delete E.homeless[hid];
        for (const [hid, members] of hh) {
            if (E.home[hid] || E.homeless[hid] !== undefined) continue;
            // 自己(或家人)名下有空房就住進去
            const ownVac = Object.values(E.units).find(u => !u.occ && members.some(m => m.agentId === u.owner));
            if (ownVac) { moveIn(w, hid, ownVac); continue; }
            const vac = Object.values(E.units).filter(u => !u.occ).sort((x, y) => rentOf(w, x) - rentOf(w, y))[0];
            const payer = members.slice().sort((x, y) => cash(w, y) - cash(w, x))[0];
            if (vac && payer && cash(w, payer) >= rentOf(w, vac)) { moveIn(w, hid, vac); continue; }
            // 沒空屋(或租不起整棟):找人家分租寄住
            const slot = lodgeSlot(w); if (slot && payer && cash(w, payer) >= Math.ceil(rentOf(w, slot) * 0.5)) { lodgeIn(w, hid, slot); continue; }
            // 租不起也沒地方寄住:無家可歸
            E.homeless[hid] = day(w); for (const a of members) if (a.homeLocation !== HOMELESS_AT) { E.orig[a.agentId] = a.homeLocation; a.homeLocation = HOMELESS_AT; }
        }
    }
    // ---------- 每週:收租、地價稅、房產買賣、蓋新房、重新租房 ----------
    function weekly(w, hh, ch) { // ch＝買賣房子、蓋屋、幫傭交給本人決定（每日流程在決策核心開著時傳 true；直接呼叫不帶就是原本的規則）
        const E = S(w); const Wl = WL(); if (!Wl) return;
        for (const u of Object.values(E.units)) {
            if (!u.occ) continue; const members = hh.get(u.occ) || []; if (!members.length) continue;
            const owner = ownerAgent(w, u);
            if (u.owner && members.some(m => m.agentId === u.owner)) { // 自住:繳地價稅
                const tax = Math.round(valueOf(w, u) * 0.005 * 100) / 100; const payer = members.find(m => m.agentId === u.owner);
                const amt = Math.min(tax, cash(w, payer)); if (amt > 0 && Wl.take(w, payer, amt)) { toTown(w, amt, t('地價稅')); E.stats.ptax = Math.round(((E.stats.ptax || 0) + amt) * 100) / 100; }
                continue;
            }
            const rent = rentOf(w, u, u.occ), list = rentOf(w, u); const payer = members.slice().sort((x, y) => cash(w, y) - cash(w, x))[0];
            const paid = Math.min(rent, Math.floor(cash(w, payer)));
            if (paid > 0 && Wl.take(w, payer, paid)) { if (owner) Wl.add(w, owner, paid); else pubRent(w, paid); E.stats.rent = (E.stats.rent || 0) + paid; }
            const short = rent - paid;
            if (short > 0) { E.arrears[u.occ] = (E.arrears[u.occ] || 0) + short; if (Math.random() < 0.5) mem(w, payer, '這週房租差了 {n} 銀幣，{o}已經在催了。', { n: short, o: owner?.name || t('鎮公所') }, 6); }
            else if (E.arrears[u.occ] && cash(w, payer) > rent) { const back = Math.min(E.arrears[u.occ], Math.floor(cash(w, payer) - rent)); if (back > 0 && Wl.take(w, payer, back)) { if (owner) Wl.add(w, owner, back); else pubRent(w, back); E.arrears[u.occ] -= back; } }
            if (E.cut[u.occ]?.uid === u.id && !(E.arrears[u.occ] > 0)) { delete E.cut[u.occ]; mem(w, payer, '欠的房租還清了，{o}的房租恢復原價。', { o: owner?.name || t('房東') }, 4); } // v11.6.0 欠租還清：八折到此為止
            overdue(w, u, u.occ, list); // v11.6.0 欠到三倍租金：私人房東在鎮上就由他決定（原本直接趕人）
        }
        // 寄住的人付一半房租給屋主(公有房舍付給公庫)
        for (const u of Object.values(E.units)) for (const hid of lodgersOf(u).slice()) {
            const members = hh.get(hid) || []; const payer = members.slice().sort((x, y) => cash(w, y) - cash(w, x))[0]; if (!payer) continue;
            const rent = Math.ceil(rentOf(w, u, hid) * 0.5), list = Math.ceil(rentOf(w, u) * 0.5); const owner = ownerAgent(w, u); const paid = Math.min(rent, Math.floor(cash(w, payer)));
            if (paid > 0 && Wl.take(w, payer, paid)) { if (owner) Wl.add(w, owner, paid); else pubRent(w, paid); E.stats.rent = (E.stats.rent || 0) + paid; }
            if (rent - paid > 0) { E.arrears[hid] = (E.arrears[hid] || 0) + rent - paid; overdue(w, u, hid, list); }
            else if (E.cut[hid]?.uid === u.id && !(E.arrears[hid] > 0)) { delete E.cut[hid]; mem(w, payer, '欠的房租還清了，{o}的房租恢復原價。', { o: owner?.name || t('房東') }, 4); }
        }
        market(w, hh, ch);
        rehouse(w, hh);
        servants(w, ch);
    }
    // 無家可歸的人存到錢、又有空屋,就租回來（每週一次；v11.14.0 本人決定蓋的房子晚一點才蓋好時，蓋好當下也跑一次，不用等到下週）
    function rehouse(w, hh) {
        const E = S(w); hh = hh || households(w);
        for (const hid of Object.keys(E.homeless)) {
            const members = hh.get(hid) || []; const payer = members.slice().sort((x, y) => cash(w, y) - cash(w, x))[0]; if (!payer) continue;
            const vac = Object.values(E.units).filter(u => !u.occ).sort((x, y) => rentOf(w, x) - rentOf(w, y))[0];
            if (vac && cash(w, payer) >= rentOf(w, vac) * (vac.owner ? 1.5 : 1)) { moveIn(w, hid, vac); mem(w, payer, '總算又租到房子了。', {}, 7); log(w, '🏠 {a}存了點錢，又租到房子了。', { a: payer.name }, payer.name); continue; }
            const slot = lodgeSlot(w); if (slot && cash(w, payer) >= Math.ceil(rentOf(w, slot) * 0.5) * 2) { lodgeIn(w, hid, slot); mem(w, payer, '找到地方寄住了，總比睡廣場好。', {}, 6); }
        }
    }
    function market(w, hh, ch) {
        if (ch === true && hsOn(w)) return marketBy(w, hh); // v11.14.0 買不買、賣不賣、蓋不蓋由本人決定；下面是原本的規則（決策核心沒開、或直接呼叫）
        const E = S(w); const Wl = WL(); const all = npcs(w); let sales = 0;
        const richest = (min, not) => all.filter(a => !not.includes(a) && cash(w, a) >= min && ownsOf(w, a.agentId).length < 1 + Math.floor(cash(w, a) / 250)).sort((x, y) => cash(w, y) - cash(w, x))[0];
        // 公有房舍標售給有錢人
        for (const u of Object.values(E.units)) {
            if (u.owner || sales >= 2) continue; const price = valueOf(w, u); const b = richest(price * 1.3, []);
            if (!b || !Wl.take(w, b, price)) continue; u.owner = b.agentId; toTown(w, price, t('公有房舍標售')); sales++; E.stats.sold = (E.stats.sold || 0) + 1;
            log(w, '🏘️ {a}出 {n} 銀幣買下一棟公有房舍{x}。', { a: b.name, n: price, x: u.occ ? t('，房客改付房租給新屋主') : '' }, b.name); mem(w, b, '我買了一棟房子，可以收租了。', {}, 6);
        }
        // 手頭緊的屋主賣掉自住的房子,變成租客
        for (const u of Object.values(E.units)) {
            if (sales >= 3) break; const o = ownerAgent(w, u); if (!o || u.occ !== headOf(w, o).agentId) continue;
            const broke = cash(w, o) < 3 && ((typeof MARKET !== 'undefined' && MARKET.isHungry(w, o) >= 2) || (w.bank?.loans?.[o.agentId]));
            if (!broke) continue; const price = valueOf(w, u); const b = richest(price, [o]); if (!b || !Wl.take(w, b, price)) continue;
            Wl.add(w, o, price); u.owner = b.agentId; sales++; E.stats.sold = (E.stats.sold || 0) + 1;
            log(w, '📉 {o}撐不下去，把自己住的房子以 {n} 銀幣賣給{b}，從此改付房租。', { o: o.name, n: price, b: b.name }, o.name); mem(w, o, '把房子賣給{b}了，以後住在這裡要付房租。', { b: b.name }, 8);
        }
        // 缺房時有錢人蓋新房出租(錢付給木作坊、礦場老闆;要用木材和石材)
        const vacant = Object.values(E.units).filter(u => !u.occ).length; const homeless = Object.keys(E.homeless).length;
        const short = (vacant < 2 && (homeless > 0 || hh.size >= Object.keys(E.units).length)) ? Math.max(1, Math.ceil((hh.size - Object.keys(E.units).length) / 3) + Math.ceil(homeless / 2)) : 0;
        for (let k = 0; k < Math.min(2, short); k++) {
            const cost = 110, mat = { wood: 12, stone: 8 }; let b = all.filter(a => cash(w, a) >= cost + 50).sort((x, y) => cash(w, y) - cash(w, x))[0];
            // v8.8.0 沒人自己出得起,就由有工作、手上有點錢的人跟銀行借錢來蓋(以後收房租還)
            if (!b && w.stockpile?.canAfford?.(mat) && typeof BIZ !== 'undefined' && BIZ.bizLoan) { const c = all.filter(a => a.job && (a.age ?? 30) >= 22 && cash(w, a) >= 35 && !w.bank?.loans?.[a.agentId]).sort((x, y) => cash(w, y) - cash(w, x))[0];
                if (c) { const got = BIZ.bizLoan(w, c, cost + 15 - cash(w, c), '蓋出租屋'); if (got && cash(w, c) >= cost) { b = c; log(w, '🏦 {a}跟銀行借了 {n} 銀幣，要蓋一棟房子出租。', { a: c.name, n: got }, c.name); } } }
            if (b && w.stockpile?.canAfford?.(mat) && Wl.take(w, b, cost)) {
                w.stockpile.pay(mat, w.tickCount, t('蓋出租屋')); if (typeof MARKET !== 'undefined' && w.market) { MARKET.sell(w, 'timber', cost * 0.6, t('蓋出租屋')); MARKET.sell(w, 'mine', cost * 0.4, t('蓋出租屋')); } else toTown(w, cost, t('蓋出租屋'));
                const id = 'U' + (++E.n); E.units[id] = { id, owner: b.agentId, occ: null, lv: 0, built: day(w) }; E.stats.built = (E.stats.built || 0) + 1;
                log(w, '🏗️ {a}花 {n} 銀幣蓋了一棟出租屋。', { a: b.name, n: cost }, b.name); mem(w, b, '我蓋了一棟房子出租。', {}, 6);
            }
        }
        // 公有房舍:還是缺房、公庫又有錢,鎮上自己蓋(工程款大半付給承包商)
        { const left = short - Object.values(E.units).filter(u => u.built === day(w)).length; const sp = w.stockpile;
          const needPub = homeless > 0 && !Object.values(E.units).some(u => !u.occ); // 真的有人睡街上、又一間空屋都沒有才蓋
          for (let k = 0; needPub && k < Math.min(2, left); k++) {
            const cost = 100, mat = { wood: 10, stone: 6 }; if (!sp || ((typeof TREASURY !== 'undefined' && w.observerMode && w.wallet) ? TREASURY.budget(w) < cost : sp.get('silver') < cost + 400) || !sp.canAfford(mat)) break; // v10.7.0 用公庫可以動用的錢蓋
            sp.consume('silver', cost, w.tickCount, t('興建公有房舍'), 'upkeep'); sp.pay(mat, w.tickCount, t('興建公有房舍'));
            const id = 'U' + (++E.n); E.units[id] = { id, owner: null, occ: null, lv: 0, built: day(w), pub: 1 }; E.stats.publicBuilt = (E.stats.publicBuilt || 0) + 1;
            if (k === 0) log(w, '🏗️ 鎮上缺房子，公庫出錢蓋了公有房舍。', {}, '');
          } }
        // 抵押:屋主缺錢要不要拿房子跟銀行借，由他自己決定(mortBy)
    }
    function mortDo(w, B, o, u) {
        const n = BANK.lend(w, B, o, Math.round(valueOf(w, u) * 0.4), '房屋抵押', { coll: u.id }); if (n && B.loans[o.agentId]) { B.loans[o.agentId].collateral = u.id; mem(w, o, '拿房子去銀行抵押，借了 {n} 銀幣。', { n }, 7); } // v11.6.0 抵押的房子也寫在申請上：銀行家晚一點才點頭時，撥款那一刻一起記上
        return n || 0;
    }
    // 這個人名下有沒有房子可以抵押、借得到多少(銀行有開、他沒有還在還的貸款)
    function mortInfo(w, a) {
        const B = w.bank; if (!B || !B.open || typeof BANK === 'undefined' || !a || B.loans?.[a.agentId]) return null;
        const u = Object.values(S(w).units).find(x => x.owner === a.agentId); if (!u) return null;
        const n = Math.floor(Math.min(Math.round(valueOf(w, u) * 0.4), BANK.lendable(B))); if (n < 5) return null;
        return { u, n };
    }
    const mortBy = (w, a) => { const I = mortInfo(w, a); return I ? mortDo(w, w.bank, a, I.u) : 0; };
    // 銀行收走抵押品(sim-bank 的呆帳處理會叫這裡)
    function foreclose(w, id, L) {
        const E = S(w); const u = L?.collateral && E.units[L.collateral]; if (!u || u.owner !== id) return false;
        const banker = w.bank?.banker && w.agents[w.bank.banker] ? w.agents[w.bank.banker] : null; const o = w.agents[id];
        u.owner = banker ? banker.agentId : null; E.stats.foreclosed = (E.stats.foreclosed || 0) + 1;
        log(w, '🏦 {o}還不出房屋抵押貸款，房子被銀行收走了。', { o: o?.name || '' }, o?.name || ''); if (o) mem(w, o, '還不出貸款，房子被銀行收走了。', {}, 9);
        return true;
    }
    // ================= v11.6.0 房東自己定租金、自己決定欠租的房客怎麼辦（選擇點 landlord，登記在 sim-decide-work.js） =================
    // 以前全鎮同一條公式，房東不定價；房客欠到三倍租金就自動被趕。現在：
    //   rent 每位有房客的私人房東每 28 天看一次（照人錯開；剛變成房東時先問一次）：比行情貴一點／照行情／便宜一點，或給自己人（家人、好朋友）再打八五折
    //   late 房客欠到三倍租金、房東在鎮上：趕出去／再寬限四週／欠租期間打八折／欠的免掉一半。等回話的這段時間先不趕，隔天沒回音照原本的規則
    // 公有房舍、房東不在鎮上、決策核心沒開：照原本的規則。錢照舊從房客的錢包付給房東，免掉的欠租只是不用付，沒有錢憑空多出來
    const TIER_NAME = { hi: '比行情貴一點', mid: '照行情', lo: '比行情便宜一點' };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bumpA = (a, b, n) => { try { a?.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) && !(w.civic?.jail?.[a.agentId] > day(w));
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : v; return o; };
    const llOn = (w) => !!(w?.observerMode && w.wallet && typeof DECIDE !== 'undefined' && DECIDE.on(w) && DECIDE.KINDS?.landlord);
    const memberOf = (w, hid) => households(w).get(hid) || (w.agents[hid] ? [w.agents[hid]] : []);
    // 這一戶裡有沒有房東的家人或好朋友（好感 40 以上）
    function kinHH(w, oid, hid) { const o = w.agents[oid]; if (!o) return false; const fam = famOf(w, o); return memberOf(w, hid).some(m => m !== o && (fam.includes(m) || aff(o, m) >= 40)); }
    // 房東跟這一戶的交情：看全家裡最親的那一個（家人 > 好朋友 > 還算熟 > 不熟；有過節看戶長）
    function tieHH(w, o, hid) {
        const ms = memberOf(w, hid).filter(m => m !== o); const fam = famOf(w, o); const head = w.agents[hid] || ms[0]; const v = Math.round(aff(o, head));
        const f = ms.find(m => fam.includes(m)); if (f) return { k: 'fam', v, s: '是你的家人' };
        const best = ms.reduce((m, x) => Math.max(m, aff(o, x)), -999);
        if (best >= 40) return { k: 'friend', v, s: '跟你是好朋友' }; if (v <= -20) return { k: 'foe', v, s: '跟你有過節' }; if (best >= 10) return { k: 'known', v, s: '跟你還算熟' };
        return { k: 'none', v, s: '跟你不熟' };
    }
    const tieW = (T) => ({ fam: 1.6, friend: 1.0, known: 0.3, none: 0, foe: -0.8 })[T.k];
    // 每位私人房東名下「租給別人」的房子（主戶不是自己家，或有人寄住）
    function landlords(w) {
        const E = S(w); const hh = households(w); const m = new Map();
        for (const u of Object.values(E.units)) { if (!u.owner) continue; const own = u.occ && (hh.get(u.occ) || []).some(x => x.agentId === u.owner); const rented = (u.occ && !own) || lodgersOf(u).length;
            if (rented) { if (!m.has(u.owner)) m.set(u.owner, []); m.get(u.owner).push(u); } }
        return m;
    }
    const slotOf = (id) => { let h = 7; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 28; };
    function askNow(w, a, ctx) { const X = DECIDE.S(w); const keep = X.q.splice(0, X.q.length); try { DECIDE.enqueue(w, a, 'landlord', ctx); DECIDE.drain(w, X, day(w)); } finally { if (keep.length) X.q.unshift(...keep); } }
    // 這一戶這週付給他的房子多少（tier/kin 不給就照他現在定的）
    const payOf = (w, u, hid, P) => { const E = S(w); const old = E.ll[u.owner]; if (P) E.ll[u.owner] = P; try { const r = rentOf(w, u, hid); return u.occ === hid ? r : Math.ceil(r * 0.5); } finally { if (P) { if (old) E.ll[u.owner] = old; else delete E.ll[u.owner]; } } };
    function tenantsOf(w, o, us) { const out = []; const hh = households(w); for (const u of us) { if (u.occ && !(hh.get(u.occ) || []).includes(o)) out.push({ u, hid: u.occ, lodger: 0 }); for (const hid of lodgersOf(u)) out.push({ u, hid, lodger: 1 }); } return out; }
    const weekSum = (w, ts, P) => ts.reduce((s, x) => s + payOf(w, x.u, x.hid, P), 0);
    // 欠到三倍租金（寄住的是一半租金的三倍）
    function overdue(w, u, hid, list) {
        const E = S(w), d = day(w); if (!((E.arrears[hid] || 0) > list * 3)) { delete E.late[hid]; return; }
        const G = E.grace[hid]; if (G && G.uid === u.id && d < G.until) return; // 房東答應寬限的這幾週先不趕
        const o = ownerAgent(w, u); const ask = llOn(w) && o && inTown(w, o) && (o.age ?? 30) >= 16 && !memberOf(w, hid).includes(o);
        if (!ask) { delete E.late[hid]; return evict(w, hid, 'rent'); } // 公有房舍、房東不在鎮上、決策核心沒開：照原本的規則
        const P = E.late[hid]; if (P && P.uid === u.id) { if (d - P.d < 1) return; delete E.late[hid]; return evict(w, hid, 'rent'); } // 等回話的這一天先不趕；隔天沒回音照原本的規則
        E.late[hid] = { uid: u.id, d, tok: (E.lt = (E.lt || 0) + 1), lodger: u.occ !== hid ? 1 : 0 };
        askNow(w, o, { t: 'late', hid, uid: u.id, tok: E.late[hid].tok, d });
    }
    function llDaily(w, d) {
        const E = S(w);
        for (const [hid, P] of Object.entries(E.late)) { if (d - P.d < 1) continue; delete E.late[hid]; const u = E.units[P.uid]; if (!u || !(u.occ === hid || lodgersOf(u).includes(hid))) continue;
            const list = P.lodger ? Math.ceil(rentOf(w, u) * 0.5) : rentOf(w, u); const G = E.grace[hid]; if ((E.arrears[hid] || 0) > list * 3 && !(G && G.uid === u.id && d < G.until)) evict(w, hid, 'rent'); }
        for (const k of ['grace', 'cut']) for (const [hid, G] of Object.entries(E[k])) { const u = E.units[G.uid]; if (!u || !(u.occ === hid || lodgersOf(u).includes(hid)) || (k === 'grace' && d >= G.until + 28)) delete E[k][hid]; } // 搬走了、或寬限過完一陣子：清掉（寬限次數留一個月，免得剛過期又重新算）
        if (!llOn(w)) return;
        let n = 0; for (const [id] of landlords(w)) { if (n >= 3) break; const a = w.agents[id]; if (!a || !inTown(w, a) || (a.age ?? 30) < 18) continue;
            const last = E.llAsk[id]; const fresh = !E.ll[id] && last == null; const due = slotOf(id) === d % 28 && (last == null || d - last >= 20); if (!fresh && !due) continue;
            E.llAsk[id] = d; n++; askNow(w, a, { t: 'rent', d }); }
    }
    function setTier(w, o, tierK, kin) {
        const E = S(w); const us = landlords(w).get(o.agentId) || []; const ts = tenantsOf(w, o, us); const before = ts.map(x => payOf(w, x.u, x.hid)); const cur = E.ll[o.agentId];
        E.ll[o.agentId] = { tier: tierK, kin: kin ? 1 : 0, d: day(w), by: o.agentId }; let up = 0, down = 0;
        ts.forEach((x, i) => { const now = payOf(w, x.u, x.hid); const was = before[i]; if (now === was) return; const h = w.agents[x.hid]; const payer = memberOf(w, x.hid).filter(m => (m.age ?? 30) >= 16).sort((p, q) => (WL() ? WL().get(w, q) - WL().get(w, p) : 0))[0] || h; if (!payer) return;
            if (now > was) { up++; mem(w, payer, '{o}把房租從 {a} 漲到 {b} 銀幣。', { o: o.name, a: was, b: now }, 6); for (const m of memberOf(w, x.hid)) if ((m.age ?? 30) >= 16) bumpA(m, o, -5); }
            else { down++; mem(w, payer, '{o}把房租從 {a} 降到 {b} 銀幣。', { o: o.name, a: was, b: now }, 5); for (const m of memberOf(w, x.hid)) if ((m.age ?? 30) >= 16) bumpA(m, o, 4); } });
        if (up || down) log(w, up && !down ? '🏠 {o}把名下房子的房租調高了（{n} 戶）。' : down && !up ? '🏠 {o}把名下房子的房租調低了（{n} 戶）。' : '🏠 {o}重新定了名下房子的房租（{n} 戶有變）。', { o: o.name, n: up + down }, o.name);
        E.stats.llSet = (E.stats.llSet || 0) + 1; if (!cur || cur.tier !== tierK) E.stats['ll_' + tierK] = (E.stats['ll_' + tierK] || 0) + 1;
        return up + down ? { k: '房租有 {n} 戶跟著變了', p: { n: up + down } } : { k: '房租照舊' };
    }
    function liveRent(w, o, ctx) { if (!ctx || ctx.t !== 'rent' || !llOn(w) || !inTown(w, o) || day(w) - (ctx.d ?? 0) > 1) return null; const us = landlords(w).get(o.agentId); return us && us.length ? us : null; }
    function rentFacts(w, o, us) {
        const E = S(w); const hh = households(w); const own = ownsOf(w, o.agentId); const P = E.ll[o.agentId]; const ts = tenantsOf(w, o, us);
        const rows = ts.slice(0, 6).map(x => { const h = w.agents[x.hid]; const T = tieHH(w, o, x.hid); const ar = Math.round(E.arrears[x.hid] || 0);
            return fill(x.lodger ? '{a}一家寄住（{tie}，每週 {r} 銀幣{ar}）' : '{a}一家租（{tie}，每週 {r} 銀幣{ar}）', { a: h?.name || '', tie: T.s, r: payOf(w, x.u, x.hid), ar: { raw: ar ? fill('，欠了 {n}', { n: ar }) : '' } }); });
        const self = own.filter(u => u.occ && (hh.get(u.occ) || []).includes(o)).length, vac = own.filter(u => !u.occ).length;
        const homeless = Object.keys(E.homeless).length, allVac = Object.values(E.units).filter(u => !u.occ).length;
        const town = fill('鎮上 {hh} 戶人家、{n} 棟房子，空屋 {v} 棟{hl}。', { hh: hh.size, n: Object.keys(E.units).length, v: allVac, hl: { raw: homeless ? fill('，{n} 戶人家無家可歸', { n: homeless }) : '' } });
        const sums = { hi: weekSum(w, ts, { tier: 'hi', kin: P?.kin || 0 }), mid: weekSum(w, ts, { tier: 'mid', kin: P?.kin || 0 }), lo: weekSum(w, ts, { tier: 'lo', kin: P?.kin || 0 }) };
        return fill('又到了定房租的時候。你名下有 {n} 棟房子：{list}{self}{vac}。{town}照行情，租出去的這幾戶一週合計收 {mid} 銀幣；比行情貴一點（一成五）是 {hi}，便宜一點是 {lo}。你現在的定法：{cur}{kin}。你身上有 {c} 銀幣。',
            { n: own.length, list: { raw: rows.join(t('；')) }, self: { raw: self ? fill('；{n} 棟自己住', { n: self }) : '' }, vac: { raw: vac ? fill('；{n} 棟空著租不出去', { n: vac }) : '' }, town: { raw: town }, mid: sums.mid, hi: sums.hi, lo: sums.lo, cur: TIER_NAME[P?.tier || 'mid'], kin: { raw: P?.kin ? t('，房客是自己人的再打八五折') : '' }, c: Math.floor(cash(w, o)) });
    }
    function rentOptions(w, o, ctx, us) {
        const E = S(w); const P = E.ll[o.agentId]; const cur = P?.tier || 'mid', kin = P?.kin ? 1 : 0; const ts = tenantsOf(w, o, us);
        const kinTs = ts.filter(x => kinHH(w, o.agentId, x.hid)); const famT = kinTs.some(x => tieHH(w, o, x.hid).k === 'fam'); const vacOwn = ownsOf(w, o.agentId).some(u => !u.occ); const sc = scarcity(w); const arrT = ts.some(x => (E.arrears[x.hid] || 0) > 0);
        const greedy = has(o, 'greedy'), kind = has(o, 'kind'), gen = has(o, 'generous'); const out = [];
        const go = (tierK, k2) => (w2, o2) => liveRent(w2, o2, ctx) ? setTier(w2, o2, tierK, k2) : null;
        // 照行情佔多數：貪心的、看重錢的、缺房時偏貴；心腸好、慷慨的、有房子空著租不出去時偏便宜
        out.push({ id: 'mid', text: { k: '照行情收（一週合計 {n} 銀幣）{now}', p: { n: weekSum(w, ts, { tier: 'mid', kin }), now: { raw: cur === 'mid' ? t('（跟現在一樣）') : '' } } }, say: '房租照行情收', why: '照行情收，大家都沒話說。', quiet: cur === 'mid',
            base: 1.4 + (cur === 'mid' ? 0.3 : 0), lean: { safe: 0.2 }, run: go('mid', kin) });
        out.push({ id: 'hi', text: { k: '比行情貴一點（一週合計 {n} 銀幣）{now}', p: { n: weekSum(w, ts, { tier: 'hi', kin }), now: { raw: cur === 'hi' ? t('（跟現在一樣）') : '' } } }, say: '房租收得比行情貴一點', why: sc >= 1.2 ? '房子不夠住，貴一點也有人租。' : '房子是我的，租金我說了算。', quiet: cur === 'hi',
            base: (greedy ? 1.3 : 0) + (hasV(o, '財富') ? 0.5 : 0) + (sc >= 1.3 ? 0.5 : 0) - (vacOwn ? 0.6 : 0) - (famT ? 0.4 : 0) + (cur === 'hi' ? 0.3 : 0), lean: { gain: 0.4 }, run: go('hi', kin) });
        out.push({ id: 'lo', text: { k: '比行情便宜一點（一週合計 {n} 銀幣）{now}', p: { n: weekSum(w, ts, { tier: 'lo', kin }), now: { raw: cur === 'lo' ? t('（跟現在一樣）') : '' } } }, say: '房租收得比行情便宜一點', why: vacOwn ? '房子空著也是空著，便宜一點才租得出去。' : '大家日子都不好過，少收一點。', quiet: cur === 'lo',
            base: (kind ? 0.8 : 0) + (gen ? 0.8 : 0) + (vacOwn ? 0.7 : 0) + (arrT ? 0.3 : 0) - (greedy ? 0.8 : 0) + (cur === 'lo' ? 0.3 : 0), lean: { bond: 0.3 }, run: go('lo', kin) });
        if (!kin && kinTs.length) out.push({ id: 'kin', text: { k: '房客是自己人的那幾戶再打八五折（{names}）', p: { names: { raw: kinTs.slice(0, 3).map(x => t(w.agents[x.hid]?.name || '')).join(t('、')) } } }, say: '給租房子的自己人打八五折', why: '自己人，不好意思收那麼多。',
            base: 0.2 + (famT ? 0.6 : 0) + (hasV(o, '家庭') ? 0.5 : 0) + (kind ? 0.4 : 0) + (gen ? 0.3 : 0) - (greedy ? 0.5 : 0), lean: { bond: 0.4 }, run: go(cur, 1) });
        if (kin) out.push({ id: 'nokin', text: '自己人也照一樣的價錢收', say: '自己人的房租也照一樣收', why: '親兄弟明算帳。', base: 0.3 + (greedy ? 0.6 : 0) + (has(o, 'thrifty') ? 0.3 : 0), lean: { gain: 0.3 }, run: go(cur, 0) });
        return out;
    }
    function liveLate(w, o, ctx) {
        if (!ctx || ctx.t !== 'late' || !llOn(w) || !inTown(w, o)) return null; const E = S(w); const P = E.late[ctx.hid]; if (!P || P.tok !== ctx.tok) return null; const u = E.units[ctx.uid];
        if (!u || u.owner !== o.agentId || !(u.occ === ctx.hid || lodgersOf(u).includes(ctx.hid))) return null; const list = P.lodger ? Math.ceil(rentOf(w, u) * 0.5) : rentOf(w, u);
        if (!((E.arrears[ctx.hid] || 0) > list * 3)) return null; return { E, P, u, list, hid: ctx.hid };
    }
    function lateFacts(w, o, X) {
        const { E, P, u, hid } = X; const ms = memberOf(w, hid); const h = w.agents[hid] || ms[0]; const T = tieHH(w, o, hid); const best = ms.reduce((m, x) => Math.max(m, cash(w, x)), 0); const jobs = ms.filter(m => m.job).length;
        const kids = ms.filter(m => (m.age ?? 30) < 16).length, sick = ms.some(m => m.isSick || (m.health ?? 100) < 50); const G = E.grace[hid]; const allVac = Object.values(E.units).filter(x => !x.occ).length;
        const situ = (kids ? fill('他們家有 {n} 個還小的孩子。', { n: kids }) : '') + (sick ? t('家裡有人生病。') : '') + (jobs ? '' : t('家裡沒有人有工作。'));
        return fill('{a}一家{how}你的房子，每週 {r} 銀幣，已經欠了 {n} 銀幣房租，超過三週的租金。他們家身上最多只有 {c} 銀幣。{situ}{a}{tie}（你對他的好感 {v}）。{grace}照規矩可以把他們趕出去，他們就得去睡廣場（{vac}）。你身上有 {m} 銀幣。',
            { a: h?.name || '', how: P.lodger ? '寄住在' : '租', r: P.lodger ? Math.ceil(rentOf(w, u, hid) * 0.5) : rentOf(w, u, hid), n: Math.round(E.arrears[hid] || 0), c: Math.floor(best), situ: { raw: situ }, tie: T.s, v: T.v, grace: { raw: G && G.uid === u.id ? fill('你已經寬限過他們 {n} 次。', { n: G.n || 1 }) : '' }, vac: allVac ? { k: '鎮上現在還有 {n} 棟空屋', p: { n: allVac } } : '鎮上已經沒有空屋了', m: Math.floor(cash(w, o)) });
    }
    function lateOptions(w, o, ctx, X) {
        const { E, u, hid } = X; const ms = memberOf(w, hid); const h = w.agents[hid] || ms[0]; const T = tieHH(w, o, hid); const tw = tieW(T); const n = Math.round(E.arrears[hid] || 0); const G = E.grace[hid]; const gn = G && G.uid === u.id ? (G.n || 1) : 0;
        const kids = ms.some(m => (m.age ?? 30) < 16), sick = ms.some(m => m.isSick || (m.health ?? 100) < 50); const kind = has(o, 'kind'), gen = has(o, 'generous'); const out = [];
        const go = (fn) => (w2, o2) => { const X2 = liveLate(w2, o2, ctx); if (!X2) return null; delete X2.E.late[hid]; return fn(w2, o2, X2); };
        const tell = (w2, o2, k, p, dv) => { for (const m of memberOf(w2, hid)) if ((m.age ?? 30) >= 16) { mem(w2, m, k, Object.assign({ o: o2.name }, p || {}), 6); bumpA(m, o2, dv); } };
        out.push({ id: 'evict', text: { k: '把{a}一家趕出去（欠了 {n} 銀幣）', p: { a: h?.name || '', n } }, say: { k: '把欠租的{a}一家趕出去', p: { a: h?.name || '' } }, why: '欠了三週的房租，不能再讓他們白住。', base: 1.6 - tw, lean: { gain: 0.3 },
            run: go((w2, o2, X2) => { evict(w2, hid, 'rent'); for (const m of memberOf(w2, hid)) if ((m.age ?? 30) >= 16) bumpA(m, o2, -12); mem(w2, o2, '{a}一家欠了三週的房租，我把他們趕出去了。', { a: h?.name || '' }, 6); X2.E.stats.llEvict = (X2.E.stats.llEvict || 0) + 1; return { k: '趕出去了' }; }) });
        if (gn < 2) out.push({ id: 'grace', text: '再寬限四週', say: { k: '讓{a}一家的房租再緩四週', p: { a: h?.name || '' } }, why: '再給他們一點時間，人總有難處。', base: 0.2 + tw + (kind ? 0.5 : 0) + (kids ? 0.5 : 0) + (sick ? 0.3 : 0) - gn * 0.5, lean: { bond: 0.5 },
            run: go((w2, o2, X2) => { X2.E.grace[hid] = { uid: X2.u.id, until: day(w2) + 28, n: gn + 1 }; tell(w2, o2, '{o}說欠的房租可以再緩四週。', {}, 6); log(w2, '🏠 {o}讓欠房租的{a}一家再緩四週。', { o: o2.name, a: h?.name || '' }, o2.name); X2.E.stats.llGrace = (X2.E.stats.llGrace || 0) + 1; return { k: '再緩四週' }; }) });
        if (E.cut[hid]?.uid !== u.id) out.push({ id: 'cut', text: '這戶的房租打八折，直到欠的還清（這四週先不趕）', say: { k: '給{a}一家的房租打八折', p: { a: h?.name || '' } }, why: '少收一點，他們才還得出來。', base: tw * 0.8 + (gen ? 0.4 : 0) + (kind ? 0.2 : 0), lean: { bond: 0.4, gain: 0.1 },
            run: go((w2, o2, X2) => { X2.E.cut[hid] = { uid: X2.u.id, d: day(w2) }; X2.E.grace[hid] = { uid: X2.u.id, until: day(w2) + 28, n: gn }; tell(w2, o2, '{o}說欠的房租還清以前，房租先打八折。', {}, 8); log(w2, '🏠 {o}給欠房租的{a}一家打八折，等他們還清。', { o: o2.name, a: h?.name || '' }, o2.name); X2.E.stats.llCut = (X2.E.stats.llCut || 0) + 1; return { k: '房租打八折' }; }) });
        out.push({ id: 'halve', text: { k: '欠的 {n} 銀幣免掉一半', p: { n } }, say: { k: '免了{a}一家一半的欠租', p: { a: h?.name || '' } }, why: '能收回一半就好，人留著比較要緊。', base: -0.2 + tw * 0.9 + (gen ? 0.6 : 0) + (kind ? 0.3 : 0), lean: { bond: 0.5, gain: -0.3 },
            run: go((w2, o2, X2) => { const was = Math.round(X2.E.arrears[hid] || 0); const off = Math.floor(was / 2); X2.E.arrears[hid] = Math.max(0, (X2.E.arrears[hid] || 0) - off); tell(w2, o2, '{o}把我們欠的房租免了一半（{n} 銀幣）。', { n: off }, 10); log(w2, '🏠 {o}免了{a}一家一半的欠租（{n} 銀幣）。', { o: o2.name, a: h?.name || '', n: off }, o2.name); X2.E.stats.llHalve = (X2.E.stats.llHalve || 0) + 1; return { k: '免了 {n} 銀幣', p: { n: off } }; }) });
        return out;
    }
    function llFacts(w, o, ctx) { try { if (ctx?.t === 'rent') { const us = liveRent(w, o, ctx); return us ? rentFacts(w, o, us) : ''; } const X = liveLate(w, o, ctx); return X ? lateFacts(w, o, X) : ''; } catch (e) { console.warn('[Estate] facts', e); return ''; } }
    function llOptions(w, o, ctx) { if (ctx?.t === 'rent') { const us = liveRent(w, o, ctx); return us ? rentOptions(w, o, ctx, us) : []; } const X = liveLate(w, o, ctx); return X ? lateOptions(w, o, ctx, X) : []; }
    // ================= v11.14.0 房子：買賣、蓋屋、公有房舍與幫傭由本人決定 =================
    // 以前（寫死的規則，沒有人被問過）：
    //   公有房舍每週標售，一律賣給最有錢、出得起 1.3 倍的人；身上不到 3 銀幣又挨餓或欠銀行的屋主，一定把自住的房子賣給最有錢的人；
    //   缺房時一律由最有錢的人（不夠就借錢）蓋出租屋；有人睡街上又沒空屋，公庫自動蓋公有房舍；
    //   身上 300 銀幣以上的人自動請最窮的人幫傭，被請的人一定去，主人錢少了自動辭退。
    // 現在：什麼時候輪到、誰夠格、要多少錢照舊，做不做由本人決定（七個選擇點，登記在 sim-decide-life.js 與 sim-decide-pol.js）：
    //   houseBuy  有一棟房子可以買        公有房舍標售（t:'pub'）：不買／買，前三有錢又夠格的人各自決定，先說要的買到；
    //                                    屋主賣自住的房子（t:'home'）：不買／照開價買／只出八折，看屋主答不答應
    //   homeSell  撐不下去，房子賣不賣    屋主（t:'ask'）：咬牙撐著／拿出來賣／拿去銀行抵押；有人只出八折（t:'bid'）：不賣這個價／接受
    //   buildRent 鎮上缺房子，蓋不蓋      夠格的人：不蓋／自己出錢蓋／跟銀行借錢蓋（銀行家晚一點才點頭時，錢到了再動工）
    //   townSale  公有房舍這陣子賣不賣    首長（有人出得起才問，28 天一次，換了首長重新問）：照常標售／只標售空著的／這陣子都不標售
    //   townBuild 有人睡在廣場，公庫蓋不蓋 首長（有人睡街上又一間空屋都沒有的那一週）：公庫先不蓋／蓋一棟／蓋兩棟；首長不在鎮上就照原本的規則直接蓋
    //   hireHelp  要不要請人到家裡幫傭    主人（t:'hire'，28 天一次）：不請／請某一位（最窮的三位裡挑）；錢少了（t:'keep'）：再撐一陣子／辭退
    //   helpOffer 有人請你去幫傭          被請的人：不去／去
    // 回話晚到（問 AI 要等）：每個選項動手前都重新對一次現況，房子已經被別人買走、已經不缺房、人不在了就作廢，不動錢、不動住處。
    // 賣房子只換屋主：屋主一家照樣住在原地、改付房租，所以不會有人因此沒地方住或同時住兩處。錢都是錢包對錢包或錢包對公庫，沒有憑空多出來的錢。
    // 決策核心沒開（weekly 的 ch 不是 true）或直接呼叫 ESTATE.market(w, hh)／ESTATE.servants(w)：照原本的規則，一字不改。
    const hsOn = (w) => !!(w?.observerMode && w.wallet && typeof DECIDE !== 'undefined' && DECIDE.on(w) && DECIDE.KINDS?.houseBuy && DECIDE.KINDS?.hireHelp);
    const visitor = (a) => String(a?.agentId || '').startsWith('visit_');
    const adult = (w, a, n = 18) => !!a && !a.isPlayer && !visitor(a) && inTown(w, a) && (a.age ?? 30) >= n;
    const st = (w, k, n = 1) => { const E = S(w); E.stats[k] = (E.stats[k] || 0) + n; };
    const askMany = (w, list) => { try { if (list.length) DECIDE.askNow(w, list); } catch (e) { console.warn('[Estate] ask', e); } };
    // 首長：跟「公庫這週怎麼用」問的是同一位（正式首長不在就是代理），人要在鎮上
    const leaderOf = (w) => { let m = null; try { m = w.proposals?._mayor?.(w) || w.election?.currentMayor?.(w) || null; } catch (e) { m = null; } return m && adult(w, m, 16) ? m : null; };
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const leanSum = (l) => Object.values(l || {}).reduce((x, y) => x + y, 0);
    // 照個性那條路的起跑分數：一般人選到每一項的機會大約是 ps（算法用 sim-decide-order.js 的 tiltN），再加上這個人自己的加減（adj）
    const calib = (opts, ps) => { let b = null; try { b = typeof ORDER !== 'undefined' && ORDER.tiltN ? ORDER.tiltN(ps) : null; } catch (e) {} opts.forEach((op, i) => { op.base = (b ? b[i] : 1) - leanSum(op.lean) + (op.adj || 0); delete op.adj; }); return opts; };
    const hungryOf = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.isHungry ? MARKET.isHungry(w, a) || 0 : 0; } catch (e) { return 0; } };
    const kidsOf = (w, a) => npcs(w).filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(a.name)).length;
    const tieP = (a, b) => { const v = Math.round(aff(a, b)); return v >= 40 ? { v, k: 'friend', s: '跟你是好朋友' } : v <= -20 ? { v, k: 'foe', s: '跟你有過節' } : v >= 10 ? { v, k: 'known', s: '跟你還算熟' } : { v, k: 'none', s: '跟你不熟' }; };
    const namesOf = (list) => list.map(o => t(o.name)).join(t('、'));
    const jobOf = (a) => { try { return a.job ? (a.job.title || (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[a.job.key]?.title) || a.job.key) : ''; } catch (e) { return ''; } };
    const townLine = (w, hh) => { const E = S(w); const hl = Object.keys(E.homeless).length; return fill('鎮上 {hh} 戶人家、{n} 棟房子，空屋 {v} 棟{hl}。', { hh: hh.size, n: Object.keys(E.units).length, v: Object.values(E.units).filter(u => !u.occ).length, hl: { raw: hl ? fill('，{n} 戶人家無家可歸', { n: hl }) : '' } }); };
    // 這棟房子在這個人手上、照他現在定的檔位，一週大約收多少房租
    const rentEst = (w, u, oid) => Math.max(2, Math.round(rawRent(w, u) * (TIER_F[S(w).ll[oid]?.tier] || 1)));
    const ownTxt = (w, a) => { const n = ownsOf(w, a.agentId).length; return n ? { k: '你名下已經有 {n} 棟房子', p: { n } } : '你名下還沒有房子'; };
    const othersTxt = (w, a, c, k) => { const os = (c?.q || []).filter(id => id !== a.agentId).map(id => w.agents[id]).filter(o => o && !o.isDead); return os.length ? { k, p: { x: { raw: namesOf(os) } } } : { raw: '' }; };
    const cooled = (m, id, d, n) => d - (m[id] ?? -999) < n;
    const weekOf = (w) => { const H = S(w).hs; return H.wk || (H.wk = { d: day(w), pub: 0, all: 0 }); };
    // 誰夠格買房（跟原本一樣：出得起、名下的房子還不算多；另外要成年、人在鎮上、不是外鎮來的訪客）
    const capOk = (w, a) => ownsOf(w, a.agentId).length < 1 + Math.floor(cash(w, a) / 250);
    const buyersOf = (w, min, not) => npcs(w).filter(a => adult(w, a) && !(not || []).includes(a) && cash(w, a) >= min && capOk(w, a)).sort((x, y) => cash(w, y) - cash(w, x));
    const pubMode = (w) => S(w).hs.pub?.mode || 'open';
    const BLD_COST = 110, BLD_MAT = { wood: 12, stone: 8 }, PUB_COST = 100, PUB_MAT = { wood: 10, stone: 6 };
    const brokeOwner = (w, o) => cash(w, o) < 3 && (hungryOf(w, o) >= 2 || !!w.bank?.loans?.[o.agentId]);
    // 缺幾棟房（算法跟原本一樣）：空屋不到兩棟，而且有人無家可歸或戶數不比房子少
    const shortOf = (w, hh) => { const E = S(w); hh = hh || households(w); const n = Object.keys(E.units).length; const vacant = Object.values(E.units).filter(u => !u.occ).length; const homeless = Object.keys(E.homeless).length;
        return (vacant < 2 && (homeless > 0 || hh.size >= n)) ? Math.max(1, Math.ceil((hh.size - n) / 3) + Math.ceil(homeless / 2)) : 0; };

    // ---------- 每週：該問誰 ----------
    function marketBy(w, hh) {
        const E = S(w), H = E.hs, d = day(w); H.wk = { d, pub: 0, all: 0 };
        // 1) 公有房舍標售：首長先定這陣子賣不賣（有人出得起才問，28 天一次，換了首長重新問），再問出得起的人
        const pubs = Object.values(E.units).filter(u => !u.owner);
        if (pubs.length) {
            const L = leaderOf(w); const any = buyersOf(w, Math.min(...pubs.map(u => valueOf(w, u))) * 1.3).length > 0;
            if (L && any && !(H.pubAsk && H.pubAsk.by === L.agentId && d - H.pubAsk.d < 28)) { H.pubAsk = { by: L.agentId, d }; askMany(w, [{ a: L, kind: 'townSale', ctx: { t: 'sale', d } }]); }
            const mode = pubMode(w); let n = 0;
            if (any && mode !== 'hold') for (const u of pubs) {
                if (n >= 2) break; if (u.owner || (mode === 'vacant' && u.occ)) continue; const price = valueOf(w, u);
                const q = buyersOf(w, price * 1.3).filter(a => !cooled(H.buyNo, a.agentId, d, 21)).slice(0, 3); if (!q.length) continue; // 說過不買的人三週內不再問
                n++; const ids = q.map(a => a.agentId); askMany(w, q.map(a => ({ a, kind: 'houseBuy', ctx: { t: 'pub', uid: u.id, price, d, q: ids } })));
            }
        }
        // 2) 手頭緊的屋主：要不要賣掉自住的房子（條件跟原本一樣；一週最多問三戶）
        { let n = 0; for (const u of Object.values(E.units)) {
            if (n >= 3) break; const o = ownerAgent(w, u); if (!o || !adult(w, o, 16) || u.occ !== headOf(w, o).agentId || !brokeOwner(w, o) || H.sale[u.id]) continue;
            const c = { t: 'ask', uid: u.id, d }; if (sellOptions(w, o, c).length < 2) continue; // 沒有人買得起、也不能抵押：沒有什麼好決定的
            n++; askMany(w, [{ a: o, kind: 'homeSell', ctx: c }]);
        } }
        // 3) 缺房：私人蓋不蓋；4) 還是有人睡街上、一間空屋都沒有：公庫蓋不蓋
        const short = shortOf(w, hh); askBuild(w, short); askPubBuild(w, short);
    }
    function hsDaily(w, d) {
        const E = S(w), H = E.hs;
        for (const [uid, L] of Object.entries(H.sale)) { if (d - L.d < 2) continue; delete H.sale[uid]; const o = w.agents[L.by]; st(w, 'hsUnsold'); if (o) mem(w, o, '房子掛了兩天沒有人買，先不賣了。', {}, 5); }
        for (const [sid, O] of Object.entries(H.svOff)) if (d - O.d >= 2) delete H.svOff[sid];
        for (const k of ['buyNo', 'bldNo', 'svAsk', 'svKeep', 'svNo']) for (const [id, x] of Object.entries(H[k])) if (d - x > 60) delete H[k][id];
    }

    // ---------- 公有房舍標售：買不買（houseBuy t:'pub'） ----------
    function livePub(w, a, c) {
        if (!c || c.t !== 'pub' || !hsOn(w) || !adult(w, a) || day(w) - (c.d ?? 0) > 1) return null; const E = S(w); const u = E.units[c.uid]; if (!u || u.owner) return null;
        const mode = pubMode(w); if (mode === 'hold' || (mode === 'vacant' && u.occ) || weekOf(w).pub >= 2) return null; // 首長後來說不賣了、這週已經賣了兩棟
        if (cash(w, a) < c.price || !capOk(w, a)) return null;
        return { E, u, price: c.price, self: !!u.occ && memberOf(w, u.occ).includes(a) };
    }
    function pubBuyFacts(w, a, c) {
        const X = livePub(w, a, c); if (!X) return ''; const { u, price } = X; const hh = households(w); const r = rentEst(w, u, a.agentId); const head = u.occ ? w.agents[u.occ] || memberOf(w, u.occ)[0] : null;
        const occ = X.self ? { k: '這就是你們家現在租的那一棟，買下來以後不用再付每週 {r} 銀幣的房租，改成每週繳一點地價稅。', p: { r: rentOf(w, u, u.occ) } }
            : u.occ ? { k: '現在是{a}一家租著（{tie}），你買下以後他們改付房租給你。照行情一週大約收 {r} 銀幣，大約 {wk} 週回本。', p: { a: head?.name || '', tie: tieHH(w, a, u.occ).s, r, wk: Math.ceil(price / r) } }
            : { k: '這一棟現在空著，買下以後要等有人來租。照行情一週大約收 {r} 銀幣，大約 {wk} 週回本。', p: { r, wk: Math.ceil(price / r) } };
        return fill('鎮上有一棟公有房舍要標售，{n} 銀幣，錢進公庫。{occ}你身上有 {c} 銀幣，買下以後剩 {left}。{own}。{town}{others}', { n: price, occ, c: Math.floor(cash(w, a)), left: Math.floor(cash(w, a) - price), own: ownTxt(w, a), town: { raw: townLine(w, hh) }, others: othersTxt(w, a, c, '{x}也在看這棟房子，誰先開口就是誰的。') });
    }
    function pubBuyOptions(w, a, c) {
        const X = livePub(w, a, c); if (!X) return []; const { u, price } = X; const m = cash(w, a); const vacTown = Object.values(X.E.units).filter(x => !x.occ).length; const T = u.occ && !X.self ? tieHH(w, a, u.occ) : null;
        return calib([
            { id: 'pass', quiet: true, mute: true, text: '不買', say: '沒有買標售的公有房舍', why: '錢留在身上比較安心。', lean: { safe: 0.1 }, run: (w2, a2) => { S(w2).hs.buyNo[a2.agentId] = day(w2); st(w2, 'hsPubPass'); return null; } },
            { id: 'buy', quiet: true, text: { k: '花 {n} 銀幣買下來', p: { n: price } }, say: X.self ? '把自己租的公有房舍買下來' : '買下一棟公有房舍', why: X.self ? '自己住的房子，買下來才安心。' : '房子買下來收租，錢才會生錢。', lean: { gain: 0.2, safe: -0.1 },
                adj: (has(a, 'greedy') ? 0.25 : 0) + (hasV(a, '財富') ? 0.25 : 0) + (has(a, 'ambitious') ? 0.15 : 0) - (has(a, 'thrifty') ? 0.3 : 0) - (has(a, 'ascetic') ? 0.4 : 0) + (X.self ? 0.5 : 0)
                    + (m >= price * 3 ? 0.2 : m < price * 1.6 ? -0.2 : 0) + (!u.occ && vacTown >= 3 ? -0.4 : 0) + (T && (T.k === 'fam' || T.k === 'friend') ? 0.15 : 0) - (ownsOf(w, a.agentId).length >= 2 ? 0.1 : 0),
                run: (w2, a2) => pubBuy(w2, a2, c) },
        ], [0.45, 0.55]);
    }
    function pubBuy(w, a, c) {
        const E = S(w); const u = E.units[c?.uid]; if (!u) return null;
        if (u.owner) { const o = w.agents[u.owner]; return o && o !== a ? { k: '晚了一步，那棟房子已經被{o}買走了', p: { o: o.name } } : null; }
        const X = livePub(w, a, c); if (!X || !WL().take(w, a, X.price)) return { k: '後來沒買成' };
        u.owner = a.agentId; toTown(w, X.price, t('公有房舍標售')); weekOf(w).pub++; weekOf(w).all++; E.stats.sold = (E.stats.sold || 0) + 1; st(w, 'hsPub');
        log(w, '🏘️ {a}出 {n} 銀幣買下一棟公有房舍{x}。', { a: a.name, n: X.price, x: X.self ? '，就是他們家租的那一棟' : u.occ ? '，房客改付房租給新屋主' : '' }, a.name);
        if (X.self) mem(w, a, '我把我們家租的房子買下來了，以後不用再付房租。', {}, 7);
        else { mem(w, a, '我買了一棟房子，可以收租了。', {}, 6); if (u.occ) for (const x of memberOf(w, u.occ)) if ((x.age ?? 30) >= 16) mem(w, x, '我們租的公有房舍被{b}買下了，以後房租要付給他。', { b: a.name }, 5); }
        return { k: X.self ? '把自己租的房子買下來了' : '買下了一棟公有房舍' };
    }

    // ---------- 公有房舍這陣子標不標售（townSale，首長） ----------
    const PUB_NAME = { open: '照常標售，誰出得起就賣', vacant: '只標售空著的，有人住的留著當公宅', hold: '這陣子都不標售' };
    function liveSale(w, a, c) { if (!c || c.t !== 'sale' || !hsOn(w) || leaderOf(w) !== a || day(w) - (c.d ?? 0) > 1) return null; const E = S(w); const pubs = Object.values(E.units).filter(u => !u.owner); return pubs.length ? { E, pubs } : null; }
    const daysOfTr = (w) => { try { return typeof TREASURY !== 'undefined' && w.wallet ? TREASURY.days(w) : null; } catch (e) { return null; } };
    const silverOf = (w) => Math.floor(w.stockpile?.get?.('silver') || 0);
    function saleFacts(w, a, c) {
        const X = liveSale(w, a, c); if (!X) return ''; const { E, pubs } = X; const occ = pubs.filter(u => u.occ); const r = occ.reduce((s, u) => s + rentOf(w, u, u.occ), 0); const price = Math.round(pubs.reduce((s, u) => s + valueOf(w, u), 0) / pubs.length);
        const b = buyersOf(w, Math.min(...pubs.map(u => valueOf(w, u))) * 1.3).length; const dd = daysOfTr(w); const hl = Object.keys(E.homeless).length;
        return fill('鎮上有 {n} 棟公有房舍，{k} 棟有人租（房租是行情的八折，一週合計收 {r} 銀幣，三成五拿去修繕，其餘進公庫），{v} 棟空著。鎮上現在有 {b} 個人出得起、可以買去收租，一棟大約賣 {p} 銀幣，錢進公庫。賣給私人以後，房客改付房租給新屋主，租金由新屋主定。公庫現在 {s} 銀幣{days}。{hl}現在的做法：{cur}。',
            { n: pubs.length, k: occ.length, r, v: pubs.length - occ.length, b, p: price, s: silverOf(w), days: dd != null ? { k: '，夠付 {d} 天的薪水與維護', p: { d: Math.floor(dd) } } : { raw: '' }, hl: hl ? { k: '鎮上有 {n} 戶人家無家可歸。', p: { n: hl } } : { raw: '' }, cur: PUB_NAME[pubMode(w)] });
    }
    function setPub(w, a, mode) {
        const H = S(w).hs; const old = pubMode(w); H.pub = { mode, by: a.agentId, d: day(w) }; st(w, 'hsPol_' + mode);
        if (old !== mode) { log(w, '🏘️ {a}決定：公有房舍{x}。', { a: a.name, x: PUB_NAME[mode] }, a.name); mem(w, a, '我決定公有房舍{x}。', { x: PUB_NAME[mode] }, 5); }
        return { k: '公有房舍{x}', p: { x: PUB_NAME[mode] } };
    }
    function saleOptions(w, a, c) {
        const X = liveSale(w, a, c); if (!X) return []; const cur = pubMode(w); const dd = daysOfTr(w); const tight = dd != null && dd < 15; const hl = Object.keys(X.E.homeless).length > 0;
        const kind = has(a, 'kind'), greedy = has(a, 'greedy'); const mine = cash(w, a) >= Math.min(...X.pubs.map(u => valueOf(w, u))) * 1.3 && capOk(w, a); // 首長自己也買得起
        const go = (mode) => (w2, a2) => liveSale(w2, a2, c) ? setPub(w2, a2, mode) : null; const now = (k) => ({ raw: cur === k ? t('（跟現在一樣）') : '' });
        return calib([
            { id: 'open', quiet: true, mute: cur === 'open', text: { k: '照常標售，誰出得起就賣（一週最多兩棟）{now}', p: { now: now('open') } }, say: '公有房舍照常標售', why: tight ? '公庫缺錢，房子賣了才有錢周轉。' : '房子賣給出得起的人，公庫多一筆錢。', lean: { gain: 0.1 },
                adj: (tight ? 0.4 : 0) + (greedy ? 0.2 : 0) + (hasV(a, '財富') ? 0.2 : 0) + (mine && greedy ? 0.2 : 0) + (cur === 'open' ? 0.15 : 0), run: go('open') },
            { id: 'vacant', quiet: true, mute: cur === 'vacant', text: { k: '只標售空著的，有人住的留著當公宅{now}', p: { now: now('vacant') } }, say: '公有房舍只標售空著的', why: '有人住的留著，房客才不會被漲房租。', lean: { bond: 0.1 },
                adj: (kind ? 0.2 : 0) + (hasV(a, '社群') ? 0.2 : 0) + (cur === 'vacant' ? 0.15 : 0), run: go('vacant') },
            { id: 'hold', quiet: true, mute: cur === 'hold', text: { k: '這陣子都不標售，留著便宜租給大家{now}', p: { now: now('hold') } }, say: '公有房舍這陣子不標售', why: '房子留在鎮上手裡，窮人才租得起。', lean: { bond: 0.1 },
                adj: (kind ? 0.2 : 0) + (has(a, 'generous') ? 0.2 : 0) + (hasV(a, '社群') ? 0.3 : 0) + (hl ? 0.2 : 0) - (tight ? 0.3 : 0) - (greedy ? 0.2 : 0) + (cur === 'hold' ? 0.15 : 0), run: go('hold') },
        ], [0.55, 0.25, 0.2]);
    }

    // ---------- 撐不下去的屋主：房子賣不賣（homeSell t:'ask'）；有人只出八折（t:'bid'） ----------
    function liveSell(w, o, c) {
        if (!c || c.t !== 'ask' || !hsOn(w) || !adult(w, o, 16) || day(w) - (c.d ?? 0) > 1) return null; const E = S(w); const u = E.units[c.uid];
        if (!u || u.owner !== o.agentId || u.occ !== headOf(w, o).agentId || !brokeOwner(w, o) || E.hs.sale[u.id]) return null; // 等回話的這段時間有了錢、搬走了、已經掛出去了：這件事就過去了
        const price = valueOf(w, u); let mort = null; try { mort = mortInfo(w, o); } catch (e) {}
        return { E, u, price, low: Math.round(price * 0.8), buyers: weekOf(w).all >= 3 ? [] : buyersOf(w, price, memberOf(w, u.occ)).slice(0, 3), mort };
    }
    const debtTxt = (w, o) => { const L = w.bank?.loans?.[o.agentId]; if (!L) return { raw: '' }; return { k: '，還欠銀行 {n} 銀幣（{d} 天內要還{coll}）', p: { n: Math.round(L.owed || 0), d: Math.max(0, (L.due ?? day(w)) - day(w)), coll: L.collateral ? '，押的是房子，還不出來會被收走' : { raw: '' } } }; };
    function sellFacts(w, o, c) {
        const X = liveSell(w, o, c); if (!X) return ''; const { u, price } = X; const hg = hungryOf(w, o); const kids = memberOf(w, u.occ).filter(m => (m.age ?? 30) < 16).length; const r = Math.max(2, Math.round(rawRent(w, u)));
        return fill('你身上只剩 {c} 銀幣{hungry}{debt}。你們家住的房子是自己的，照行情大約值 {p} 銀幣。{kids}{sell}{mort}撐著不賣的話，房子還是你的，日子照舊。', { c: Math.floor(cash(w, o)), hungry: hg >= 1 ? { k: '，已經 {n} 天沒吃飽了', p: { n: hg } } : { raw: '' }, debt: debtTxt(w, o), p: price, kids: kids ? { k: '家裡有 {n} 個還小的孩子。', p: { n: kids } } : { raw: '' },
            sell: X.buyers.length ? { k: '鎮上出得起的人有{x}。把房子拿出來賣，照開價可以拿到 {p} 銀幣（有人可能只肯出八折，{l} 銀幣）；賣了以後你們一家照樣住在這裡，改成每週付大約 {r} 銀幣房租給新屋主。', p: { x: { raw: namesOf(X.buyers) }, p: price, l: X.low, r } } : '鎮上現在沒有人買得起這棟房子。',
            mort: X.mort ? { k: '也可以拿房子去銀行抵押，借 {n} 銀幣，20 天內還清；還不出來房子會被銀行收走。', p: { n: X.mort.n } } : { raw: '' } });
    }
    function sellOptions(w, o, c) {
        const X = liveSell(w, o, c); if (!X) return []; const hg = hungryOf(w, o); const kids = memberOf(w, X.u.occ).some(m => (m.age ?? 30) < 16); const L = w.bank?.loans?.[o.agentId]; const due = L && (L.due ?? 999) - day(w) <= 5;
        const need = clampN((hg - 2) * 0.12, 0, 0.5) + (kids ? 0.2 : 0) + (due ? 0.25 : 0);
        const out = [{ id: 'hold', quiet: true, mute: true, text: '咬牙撐著，房子不賣', say: '咬牙撐著，沒有賣房子', why: '房子是最後的依靠，再苦也不能賣。', lean: { safe: 0.2 }, adj: (has(o, 'stoic') ? 0.2 : 0) + (has(o, 'ascetic') ? 0.2 : 0) + (hasV(o, '傳統') ? 0.2 : 0) - need * 0.5, m: 'hold', run: (w2) => { st(w2, 'hsHeld'); return null; } }];
        if (X.buyers.length) out.push({ id: 'sell', quiet: true, text: { k: '把房子拿出來賣（開價 {p} 銀幣，賣了以後照樣住、改付房租）', p: { p: X.price } }, say: '把自己住的房子拿出來賣', why: '先讓一家人吃飽，房子以後再想辦法。', lean: { face: -0.2, safe: 0.1 },
            adj: need - (hasV(o, '傳統') ? 0.25 : 0) - (hasV(o, '家庭') ? 0.1 : 0) - (has(o, 'ambitious') ? 0.15 : 0), m: 'sell', run: (w2, o2) => listHome(w2, o2, c) });
        if (X.mort) out.push({ id: 'mortgage', quiet: true, text: { k: '拿自己的房子去銀行抵押，借 {n} 銀幣（20 天內還清；還不出來房子會被銀行收走）', p: { n: X.mort.n } }, say: '拿房子去銀行抵押借錢', why: '房子還在，總比餓肚子好', lean: { safe: -0.2 },
            adj: need * 0.6 + (has(o, 'optimist') ? 0.2 : 0) - (has(o, 'neurotic') ? 0.2 : 0) - (has(o, 'pessimist') ? 0.2 : 0), m: 'mort',
            run: (w2, o2) => { if (!liveSell(w2, o2, c)) return null; const got = mortBy(w2, o2); if (got) st(w2, 'hsMort'); return got ? { k: '抵押借到 {n} 銀幣', p: { n: got } } : (typeof BANK !== 'undefined' && BANK.pendingOf?.(w2, o2)) ? { k: '去銀行申請了，等銀行家回話' } : { k: '銀行不肯借' }; } });
        if (out.length < 2) return []; // 沒有人買得起、也不能抵押：沒有什麼好決定的，不問
        return calib(out, out.length === 3 ? [0.4, 0.35, 0.25] : out[1].m === 'sell' ? [0.5, 0.5] : [0.55, 0.45]);
    }
    function listHome(w, o, c) {
        const X = liveSell(w, o, c); if (!X) return null; if (!X.buyers.length) return { k: '想賣房子，可是鎮上沒有人買得起' };
        const E = X.E, H = E.hs, d = day(w); const L = H.sale[X.u.id] = { by: o.agentId, d, price: X.price, low: X.low, tok: ++H.n, bids: {} }; st(w, 'hsListed');
        mem(w, o, '實在撐不下去，我把自己住的房子拿出來賣了。', {}, 7); log(w, '📉 {o}撐不下去，把自己住的房子拿出來賣，開價 {n} 銀幣。', { o: o.name, n: X.price }, o.name);
        const ids = X.buyers.map(a => a.agentId); askMany(w, X.buyers.map(a => ({ a, kind: 'houseBuy', ctx: { t: 'home', uid: X.u.id, tok: L.tok, by: o.agentId, d, q: ids } })));
        return { k: '把房子拿出來賣了，等人出價' };
    }
    // 掛著的這一筆還在、屋主還住在裡面
    function liveList(w, c) {
        if (!c || !hsOn(w)) return null; const E = S(w); const L = E.hs.sale[c.uid]; const u = E.units[c.uid]; if (!L || !u || L.tok !== c.tok || day(w) - L.d > 1 || u.owner !== L.by) return null;
        const o = w.agents[L.by]; if (!o || o.isDead || u.occ !== headOf(w, o).agentId || weekOf(w).all >= 3) return null; return { E, L, u, o };
    }
    function liveHome(w, b, c) {
        if (!c || c.t !== 'home' || !adult(w, b)) return null; const X = liveList(w, c); if (!X || memberOf(w, X.u.occ).includes(b) || X.L.bids[b.agentId] != null) return null;
        if (cash(w, b) < X.L.low || !capOk(w, b)) return null; return Object.assign(X, { full: cash(w, b) >= X.L.price });
    }
    function homeBuyFacts(w, b, c) {
        const X = liveHome(w, b, c); if (!X) return ''; const { L, u, o } = X; const T = tieHH(w, b, u.occ); const hg = hungryOf(w, o); const r = rentEst(w, u, b.agentId);
        return fill('{o}撐不下去，要賣自己住的房子，開價 {p} 銀幣。{why}對你來說，{o}{tie}（你對他的好感 {v}）。買下以後{o}一家照樣住在那裡，改成每週付你大約 {r} 銀幣房租，大約 {wk} 週回本。你也可以只出八折（{l} 銀幣），答不答應看他；別人照開價買的話，房子就是別人的。你身上有 {c} 銀幣，{own}。{others}',
            { o: o.name, p: L.price, why: hg >= 2 ? { k: '他已經 {n} 天沒吃飽了。', p: { n: hg } } : w.bank?.loans?.[o.agentId] ? '他還欠著銀行的錢。' : { raw: '' }, tie: T.s, v: T.v, r, wk: Math.ceil(L.price / r), l: L.low, c: Math.floor(cash(w, b)), own: ownTxt(w, b), others: othersTxt(w, b, c, '{x}也被問到了。') });
    }
    function homeBuyOptions(w, b, c) {
        const X = liveHome(w, b, c); if (!X) return []; const { L, o } = X; const tw = tieW(tieHH(w, b, X.u.occ)); const greedy = has(b, 'greedy'), thr = has(b, 'thrifty'), kind = has(b, 'kind');
        const out = [{ id: 'pass', quiet: true, mute: true, text: '不買', say: { k: '沒有買{o}的房子', p: { o: o.name } }, why: '現在不想把錢壓在房子上。', lean: { safe: 0.1 }, adj: (thr ? 0.2 : 0) + (has(b, 'ascetic') ? 0.3 : 0), m: 'pass', run: (w2) => { st(w2, 'hsHomePass'); return null; } }];
        if (X.full) out.push({ id: 'full', quiet: true, text: { k: '照開價 {p} 銀幣買下來', p: { p: L.price } }, say: { k: '照開價買下{o}的房子', p: { o: o.name } }, why: tw >= 1 ? { k: '{o}有難，照價買下來也算幫他一把。', p: { o: o.name } } : '價錢公道，買下來收租。', lean: { gain: 0.1, bond: 0.1 },
            adj: tw * 0.3 + (kind ? 0.2 : 0) + (has(b, 'generous') ? 0.2 : 0) - (greedy ? 0.3 : 0) - (thr ? 0.2 : 0), m: 'full', run: (w2, b2) => homeBuy(w2, b2, c) });
        out.push({ id: 'low', quiet: true, text: { k: '只出 {l} 銀幣（八折），看他答不答應', p: { l: L.low } }, say: { k: '只肯出八折買{o}的房子', p: { o: o.name } }, why: '他急著用錢，便宜一點也會賣。', lean: { gain: 0.2 },
            adj: (greedy ? 0.35 : 0) + (thr ? 0.2 : 0) + (hasV(b, '財富') ? 0.15 : 0) - tw * 0.25 - (kind ? 0.2 : 0), m: 'low', run: (w2, b2) => homeBid(w2, b2, c) });
        return calib(out, out.length === 3 ? [0.35, 0.35, 0.3] : [0.5, 0.5]);
    }
    const lateSold = (w, b, c) => { const E = S(w); const u = E.units[c?.uid]; const x = u && u.owner && u.owner !== c.by && u.owner !== b.agentId ? w.agents[u.owner] : null; const o = w.agents[c?.by]; return x && o && !E.hs.sale[c.uid] ? { k: '晚了一步，{o}的房子已經被{x}買走了', p: { o: o.name, x: x.name } } : null; };
    // 成交：錢從買的人到屋主，房子過戶；屋主一家照樣住在原地，從下一次收租起改付房租給新屋主
    function homeDeal(w, X, b, n, low) {
        const { E, L, u, o } = X; const Wl = WL(); if (!Wl || cash(w, b) < n || !Wl.take(w, b, n)) return false; Wl.add(w, o, n);
        u.owner = b.agentId; delete E.hs.sale[u.id]; weekOf(w).all++; E.stats.sold = (E.stats.sold || 0) + 1; st(w, 'hsHome'); if (low) st(w, 'hsHaggled');
        if (low) log(w, '📉 {o}撐不下去，把自己住的房子以 {n} 銀幣賣給{b}（開價的八折），從此改付房租。', { o: o.name, n, b: b.name }, o.name); else log(w, '📉 {o}撐不下去，把自己住的房子以 {n} 銀幣賣給{b}，從此改付房租。', { o: o.name, n, b: b.name }, o.name);
        mem(w, o, '把房子賣給{b}了，以後住在這裡要付房租。', { b: b.name }, 8); mem(w, b, '我花 {n} 銀幣買下{o}住的房子，他們一家改付房租給我。', { n, o: o.name }, 6);
        for (const m of memberOf(w, u.occ)) if (m !== o && (m.age ?? 30) >= 16) mem(w, m, '家裡的房子賣給{b}了，以後要付房租。', { b: b.name }, 7);
        bumpA(o, b, low ? -6 : 4); // 照價買是幫了一把；趁人落難殺價，屋主記在心裡
        return true;
    }
    function homeBuy(w, b, c) { const X = liveHome(w, b, c); if (!X || !X.full) return lateSold(w, b, c) || { k: '後來沒買成' }; return homeDeal(w, X, b, X.L.price, false) ? { k: '花 {n} 銀幣買下了{o}的房子', p: { n: X.L.price, o: X.o.name } } : { k: '後來沒買成' }; }
    function homeBid(w, b, c) {
        const X = liveHome(w, b, c); if (!X) return lateSold(w, b, c) || { k: '後來沒談成' }; const { L, o } = X; L.bids[b.agentId] = L.low; st(w, 'hsBid');
        mem(w, b, '{o}要賣房子，我只肯出 {n} 銀幣。', { o: o.name, n: L.low }, 5);
        askMany(w, [{ a: o, kind: 'homeSell', ctx: { t: 'bid', uid: c.uid, tok: L.tok, by: b.agentId, n: L.low, d: day(w) } }]);
        return { k: '出價 {n} 銀幣，等{o}回話', p: { n: L.low, o: o.name } };
    }
    function liveBid(w, o, c) {
        if (!c || c.t !== 'bid' || !adult(w, o, 16)) return null; const X = liveList(w, c); if (!X || X.o !== o || X.L.bids[c.by] !== c.n) return null; const b = w.agents[c.by];
        if (!adult(w, b) || cash(w, b) < c.n || !capOk(w, b)) return null; return Object.assign(X, { b, n: c.n });
    }
    function bidFacts(w, o, c) {
        const X = liveBid(w, o, c); if (!X) return ''; const { L, u, b, n } = X; const T = tieP(o, b); const hg = hungryOf(w, o); const r = rentEst(w, u, b.agentId);
        return fill('你的房子開價 {p} 銀幣，{b}說他只肯出 {n} 銀幣（八折）。對你來說，{b}{tie}（你對他的好感 {v}）。你身上只剩 {c} 銀幣{hungry}{debt}。答應的話房子過戶給他，你們一家照樣住，每週付他大約 {r} 銀幣房租；不答應的話，房子再掛一天，看有沒有人照開價買。',
            { p: L.price, b: b.name, n, tie: T.s, v: T.v, c: Math.floor(cash(w, o)), hungry: hg >= 1 ? { k: '，已經 {n} 天沒吃飽了', p: { n: hg } } : { raw: '' }, debt: debtTxt(w, o), r });
    }
    function bidOptions(w, o, c) {
        const X = liveBid(w, o, c); if (!X) return []; const { b, n, u } = X; const T = tieP(o, b); const hg = hungryOf(w, o); const kids = memberOf(w, u.occ).some(m => (m.age ?? 30) < 16); const L = w.bank?.loans?.[o.agentId]; const due = L && (L.due ?? 999) - day(w) <= 5;
        return calib([
            { id: 'refuse', quiet: true, text: '不賣這個價', say: { k: '沒有答應{b}的八折價', p: { b: b.name } }, why: '房子不能這樣賤賣。', lean: { face: 0.2 },
                run: (w2, o2) => { const X2 = liveBid(w2, o2, c); if (!X2) return null; st(w2, 'hsBidNo'); mem(w2, X2.b, '我出八折想買{o}的房子，他沒答應。', { o: o2.name }, 5); bumpA(o2, X2.b, -3); return { k: '沒有賣給{b}', p: { b: X2.b.name } }; } },
            { id: 'take', quiet: true, text: { k: '接受，{n} 銀幣賣給{b}', p: { n, b: b.name } }, say: { k: '答應用八折把房子賣給{b}', p: { b: b.name } }, why: '少一點就少一點，先拿到錢要緊。', lean: { face: -0.2, safe: 0.2 },
                adj: clampN((hg - 2) * 0.12, 0, 0.5) + (kids ? 0.2 : 0) + (due ? 0.2 : 0) - (T.k === 'foe' ? 0.4 : 0) - (has(o, 'ambitious') ? 0.15 : 0) + (T.k === 'friend' ? 0.1 : 0),
                run: (w2, o2) => { const X2 = liveBid(w2, o2, c); if (!X2) return null; return homeDeal(w2, X2, X2.b, X2.n, true) ? { k: '用 {n} 銀幣把房子賣給{b}了', p: { n: X2.n, b: X2.b.name } } : { k: '後來沒賣成' }; } },
        ], [0.4, 0.6]);
    }

    // ---------- 鎮上缺房子：蓋不蓋出租屋（buildRent） ----------
    const lendReply = (w, a) => { try { return (typeof BANK !== 'undefined' && w.bank && BANK.lendReply) ? BANK.lendReply(w.bank, a) : null; } catch (e) { return null; } };
    // 蓋房子要跟銀行借多少（借不到就是 0）：條件跟 BIZ.bizLoan 會當場拒絕的一樣
    function loanFor(w, a) {
        if (cash(w, a) >= BLD_COST + 50 || typeof BIZ === 'undefined' || !BIZ.bizLoan || typeof BANK === 'undefined' || !w.bank) return 0; const B = w.bank; if (!B.open || B.status === 'run' || B.loans?.[a.agentId] || BANK.pendingOf?.(w, a)) return 0;
        const n = Math.max(20, Math.ceil(BLD_COST + 15 - cash(w, a))); return BANK.lendable(B) >= n + 20 ? n : 0;
    }
    function askBuild(w, short) {
        const E = S(w), H = E.hs, d = day(w); const want = Math.min(2, short); if (want <= 0 || !w.stockpile?.canAfford?.(BLD_MAT)) return;
        H.bld = { d, need: want, got: 0, tok: ++H.n };
        const free = (a) => adult(w, a) && !cooled(H.bldNo, a.agentId, d, 21); const byCash = (x, y) => cash(w, y) - cash(w, x); // 說過不蓋的人三週內不再問
        let q = npcs(w).filter(a => free(a) && cash(w, a) >= BLD_COST + 50).sort(byCash).slice(0, 3);
        // 沒有人自己出得起（或出得起的都說過不蓋）：問有工作、手上有點錢、借得到錢的人
        if (!q.length) q = npcs(w).filter(a => free(a) && a.job && (a.age ?? 30) >= 22 && cash(w, a) >= 35 && loanFor(w, a) > 0).sort(byCash).slice(0, 2);
        if (!q.length) return; const ids = q.map(a => a.agentId); askMany(w, q.map(a => ({ a, kind: 'buildRent', ctx: { d, tok: H.bld.tok, q: ids } })));
    }
    // how：不給＝還在問（要嘛自己出得起、要嘛借得到）；'go'＝錢已經在手上；'late'＝銀行家晚一點才點頭，這週的名額不管了，只看現在還缺不缺房
    function liveBuild(w, a, c, how) {
        if (!c || !hsOn(w) || !adult(w, a)) return null; const E = S(w), B = E.hs.bld;
        if (how !== 'late' && (day(w) - (c.d ?? 0) > 1 || !B || B.tok !== c.tok || B.got >= B.need)) return null;
        if (!w.stockpile?.canAfford?.(BLD_MAT)) return null; const hh = households(w); if (shortOf(w, hh) <= 0) return null;
        const own = cash(w, a) >= BLD_COST + 50; const loan = own ? 0 : loanFor(w, a); if (!how && !own && !loan) return null;
        return { E, hh, own, loan };
    }
    function buildFacts(w, a, c) {
        const X = liveBuild(w, a, c); if (!X) return ''; const { E, hh } = X; const r = rentEst(w, { lv: 0 }, a.agentId); const lod = Object.values(E.units).reduce((n, u) => n + lodgersOf(u).length, 0); const rate = Math.round((w.bank?.rate || 0) * 100);
        return fill('鎮上房子不夠住。{town}{lod}蓋一棟出租屋要 {n} 銀幣（木材和石材用鎮上倉裡的，工錢付給木作坊和礦場）。照現在的行情，新房子租出去一週大約收 {r} 銀幣，大約 {wk} 週回本。你身上有 {c} 銀幣，{own}。{loan}{others}',
            { town: { raw: townLine(w, hh) }, lod: lod ? { k: '有 {n} 戶人家擠在別人家寄住。', p: { n: lod } } : { raw: '' }, n: BLD_COST, r, wk: Math.ceil(BLD_COST / r), c: Math.floor(cash(w, a)), own: ownTxt(w, a),
                loan: X.own ? { raw: '' } : { k: '你的錢不夠，要蓋得先跟銀行借 {n} 銀幣（利息大約 {r}%，45 天內還清，還不出來名聲會受損）。', p: { n: X.loan, r: rate } }, others: othersTxt(w, a, c, '{x}也被問到了，這週最多蓋兩棟。') });
    }
    function buildOptions(w, a, c) {
        const X = liveBuild(w, a, c); if (!X) return []; const hl = Object.keys(X.E.homeless).length > 0; const m = cash(w, a);
        const want = (has(a, 'greedy') ? 0.2 : 0) + (hasV(a, '財富') ? 0.25 : 0) + (has(a, 'ambitious') ? 0.2 : 0) + (has(a, 'hardworking') ? 0.1 : 0) - (has(a, 'thrifty') ? 0.3 : 0) - (has(a, 'ascetic') ? 0.4 : 0) - (has(a, 'lazy') ? 0.15 : 0) + (hl && has(a, 'kind') ? 0.2 : 0) + (landlords(w).has(a.agentId) ? 0.15 : 0);
        const out = [{ id: 'pass', quiet: true, mute: true, text: '不蓋', say: '沒有蓋出租屋', why: '蓋房子要壓一大筆錢，先不要。', lean: { safe: 0.1 }, run: (w2, a2) => { S(w2).hs.bldNo[a2.agentId] = day(w2); st(w2, 'hsBldPass'); return null; } }];
        if (X.own) out.push({ id: 'build', quiet: true, text: { k: '花 {n} 銀幣蓋一棟出租屋', p: { n: BLD_COST } }, say: '出錢蓋一棟出租屋', why: '鎮上缺房子，蓋了一定租得出去。', lean: { gain: 0.2, safe: -0.1 }, adj: want + (m >= BLD_COST * 3 ? 0.2 : 0),
            run: (w2, a2) => buildDo(w2, a2, c, 'go') || lateBuilt(w2, c) });
        else out.push({ id: 'loan', quiet: true, text: { k: '跟銀行借 {n} 銀幣，蓋一棟出租屋', p: { n: X.loan } }, say: '跟銀行借錢蓋出租屋', why: '借錢蓋房子，以後用房租慢慢還。', lean: { gain: 0.2, safe: -0.3 }, adj: want + (has(a, 'optimist') ? 0.2 : 0) - (has(a, 'neurotic') ? 0.3 : 0) - (has(a, 'pessimist') ? 0.2 : 0),
            run: (w2, a2) => buildLoan(w2, a2, c) });
        return calib(out, X.own ? [0.5, 0.5] : [0.6, 0.4]);
    }
    const lateBuilt = (w, c) => { const B = S(w).hs.bld; return B && B.tok === c?.tok && B.got >= B.need ? { k: '晚了一步，這週要蓋的房子已經有人蓋了' } : { k: '後來沒蓋成' }; };
    function buildDo(w, a, c, how) {
        const X = liveBuild(w, a, c, how || 'go'); const Wl = WL(); if (!X || !Wl || cash(w, a) < BLD_COST || !Wl.take(w, a, BLD_COST)) return null; const E = X.E;
        w.stockpile.pay(BLD_MAT, w.tickCount, t('蓋出租屋')); if (typeof MARKET !== 'undefined' && w.market) { MARKET.sell(w, 'timber', BLD_COST * 0.6, t('蓋出租屋')); MARKET.sell(w, 'mine', BLD_COST * 0.4, t('蓋出租屋')); } else toTown(w, BLD_COST, t('蓋出租屋'));
        const id = 'U' + (++E.n); E.units[id] = { id, owner: a.agentId, occ: null, lv: 0, built: day(w) }; E.stats.built = (E.stats.built || 0) + 1; st(w, 'hsBuilt'); if (E.hs.bld && E.hs.bld.tok === c.tok) E.hs.bld.got++;
        log(w, '🏗️ {a}花 {n} 銀幣蓋了一棟出租屋。', { a: a.name, n: BLD_COST }, a.name); mem(w, a, '我蓋了一棟房子出租。', {}, 6);
        rehouse(w, X.hh); // 蓋好了：睡在廣場、租得起的人當下就可以搬進去
        return { k: '蓋了一棟出租屋' };
    }
    function buildLoan(w, a, c) {
        const X = liveBuild(w, a, c); if (!X || !X.loan) return null; const r0 = lendReply(w, a); const got = BIZ.bizLoan(w, a, X.loan, '蓋出租屋');
        const said = (n) => log(w, '🏦 {a}跟銀行借了 {n} 銀幣，要蓋一棟房子出租。', { a: a.name, n }, a.name);
        if (got) { said(got); st(w, 'hsLoan'); return buildDo(w, a, c, 'go') || { k: '借到 {n} 銀幣，房子還沒蓋成', p: { n: got } }; }
        const wait = lendReply(w, a); if (!wait || wait === r0) return { k: '銀行不肯借，房子沒蓋成' };
        // 大筆貸款在開著 AI 時要等銀行家回話：他點頭、錢到了再動工；那時已經不缺房就不蓋（錢照借了，跟開店的貸款一樣）
        const E = X.E, g0 = w._gen; mem(w, a, '我去銀行談蓋房子的貸款，等銀行家回話。', {}, 5);
        Promise.resolve(wait).catch(() => {}).then(() => { try {
            if (w._gen !== g0 || w.estate !== E || w.agents[a.agentId] !== a || a.isDead) return; const L = w.bank?.loans?.[a.agentId];
            if (!L) { mem(w, a, '銀行不肯借我蓋房子的錢，房子沒蓋成。', {}, 6); return; }
            said(L.principal || 0); st(w, 'hsLoan'); if (!buildDo(w, a, c, 'late')) mem(w, a, '蓋房子的錢借到了，可是鎮上已經不缺房子，就沒有蓋。', {}, 6);
        } catch (e) { console.warn('[Estate] build loan', e); } });
        return { k: '去銀行談蓋房子的貸款，等銀行家回話' };
    }

    // ---------- 有人睡街上、一間空屋都沒有：公庫蓋不蓋（townBuild，首長） ----------
    const pubRoom = (w) => { const sp = w.stockpile; return !sp ? 0 : (typeof TREASURY !== 'undefined' && w.observerMode && w.wallet) ? TREASURY.budget(w) : sp.get('silver') - 400; }; // v10.7.0 公庫可以動用的錢
    function pubCan(w) { const sp = w.stockpile; if (!sp) return 0; const room = pubRoom(w); let k = 0; while (k < 2 && room >= PUB_COST * (k + 1) && sp.canAfford({ wood: PUB_MAT.wood * (k + 1), stone: PUB_MAT.stone * (k + 1) })) k++; return k; }
    const needPub = (w) => { const E = S(w); return Object.keys(E.homeless).length > 0 && !Object.values(E.units).some(u => !u.occ); }; // 真的有人睡街上、又一間空屋都沒有
    function pubBuildDo(w, k, by) {
        const E = S(w), sp = w.stockpile; let n = 0;
        for (; n < k; n++) { if (!sp || pubRoom(w) < PUB_COST || !sp.canAfford(PUB_MAT)) break;
            sp.consume('silver', PUB_COST, w.tickCount, t('興建公有房舍'), 'upkeep'); sp.pay(PUB_MAT, w.tickCount, t('興建公有房舍'));
            const id = 'U' + (++E.n); E.units[id] = { id, owner: null, occ: null, lv: 0, built: day(w), pub: 1 }; E.stats.publicBuilt = (E.stats.publicBuilt || 0) + 1; }
        if (n) { if (by) log(w, '🏗️ {a}決定由公庫出錢，蓋了 {n} 棟公有房舍給沒地方住的人。', { a: by.name, n }, by.name); else log(w, '🏗️ 鎮上缺房子，公庫出錢蓋了公有房舍。', {}, ''); }
        return n;
    }
    function askPubBuild(w, short) {
        const E = S(w), H = E.hs, d = day(w); const left = short - Object.values(E.units).filter(u => u.built === d).length; const n = Math.min(2, left, pubCan(w)); if (!needPub(w) || n <= 0) return;
        const L = leaderOf(w); if (!L) { pubBuildDo(w, n, null); return; } // 首長不在鎮上、或鎮上還沒有首長：照原本的規則，公庫直接蓋
        if (H.pubNo && H.pubNo.by === L.agentId && d - H.pubNo.d < 21) return; // 同一位首長說過先不蓋：三週內不再問（換了首長就重新問），不然每週都問、每週都讓睡廣場的人再失望一次
        H.pubB = { d, n, tok: ++H.n }; askMany(w, [{ a: L, kind: 'townBuild', ctx: { t: 'build', d, n, tok: H.pubB.tok } }]);
    }
    function livePubBuild(w, a, c) {
        if (!c || c.t !== 'build' || !hsOn(w) || leaderOf(w) !== a || day(w) - (c.d ?? 0) > 1) return null; const E = S(w); if (E.hs.pubB?.tok !== c.tok || !needPub(w)) return null; // 等回話的這段時間有人蓋了房、有空屋了：不用蓋了
        const n = Math.min(c.n || 1, pubCan(w)); if (n < 1) return null; const hids = Object.keys(E.homeless); return { E, n, hids, people: hids.reduce((s, hid) => s + (memberOf(w, hid).length || 1), 0) };
    }
    function pubBuildFacts(w, a, c) {
        const X = livePubBuild(w, a, c); if (!X) return ''; const { E, hids } = X; const dd = daysOfTr(w); const priv = Object.values(E.units).filter(u => u.built === day(w) && !u.pub).length; const fam = famOf(w, a);
        const near = hids.some(hid => memberOf(w, hid).some(m => m !== a && (fam.includes(m) || aff(a, m) >= 40)));
        return fill('鎮上有 {h} 戶人家（{p} 個人）沒有地方住，晚上睡在廣場，一間空屋都沒有。{winter}{near}公庫出錢蓋一棟公有房舍要 {c} 銀幣，另外用掉倉裡 {wd} 份木材、{sn} 份石材；蓋好以後便宜租給沒地方住的人。公庫現在 {s} 銀幣，可以動用的大約 {b} 銀幣{days}。{priv}',
            { h: hids.length, p: X.people, winter: w.clock?.season === '冬季' ? '現在是冬天，露宿的人有凍死的危險。' : { raw: '' }, near: near ? '裡面有你的家人或好朋友。' : { raw: '' }, c: PUB_COST, wd: PUB_MAT.wood, sn: PUB_MAT.stone, s: silverOf(w), b: Math.floor(pubRoom(w)),
                days: dd != null ? { k: '，夠付 {d} 天的薪水與維護', p: { d: Math.floor(dd) } } : { raw: '' }, priv: priv ? { k: '這週私人蓋了 {n} 棟出租屋，還是不夠住。', p: { n: priv } } : '這週沒有私人蓋房子。' });
    }
    function pubBuildOptions(w, a, c) {
        const X = livePubBuild(w, a, c); if (!X) return []; const dd = daysOfTr(w); const fam = famOf(w, a); const near = X.hids.some(hid => memberOf(w, hid).some(m => m !== a && (fam.includes(m) || aff(a, m) >= 40)));
        const care = (has(a, 'kind') ? 0.25 : 0) + (has(a, 'generous') ? 0.2 : 0) + (hasV(a, '社群') ? 0.2 : 0) + (near ? 0.3 : 0) + (w.clock?.season === '冬季' ? 0.3 : 0) + clampN((X.hids.length - 1) * 0.1, 0, 0.3) - (has(a, 'thrifty') ? 0.3 : 0) - (has(a, 'greedy') ? 0.25 : 0) - (dd != null && dd < 15 ? 0.3 : 0);
        const tell = (w2, a2, k, dv) => { for (const hid of X.hids) for (const m of memberOf(w2, hid)) if (m !== a2 && (m.age ?? 30) >= 16) { mem(w2, m, k, { a: a2.name }, 6); bumpA(m, a2, dv); } };
        const go = (k) => (w2, a2) => { const X2 = livePubBuild(w2, a2, c); if (!X2) return null; delete X2.E.hs.pubB; const n = pubBuildDo(w2, Math.min(k, X2.n), a2); if (!n) return { k: '公庫的錢或料不夠，沒蓋成' };
            st(w2, 'hsPubYes'); mem(w2, a2, '有人睡在廣場，我決定由公庫出錢蓋公有房舍。', {}, 6); tell(w2, a2, '{a}決定由公庫蓋房子給沒地方住的人。', 5); rehouse(w2); return { k: '公庫蓋了 {n} 棟公有房舍', p: { n } }; };
        const out = [{ id: 'no', quiet: true, text: '公庫先不蓋，錢留著', say: '決定公庫先不蓋公有房舍', why: '公庫的錢要留著發薪水，房子的事再等等。', lean: { safe: 0.2 }, adj: -care * 0.5,
            run: (w2, a2) => { const X2 = livePubBuild(w2, a2, c); if (!X2) return null; delete X2.E.hs.pubB; X2.E.hs.pubNo = { by: a2.agentId, d: day(w2) }; st(w2, 'hsPubNo'); log(w2, '🏚️ {a}決定公庫先不蓋房子，{n} 戶人家還睡在廣場。', { a: a2.name, n: X2.hids.length }, a2.name); tell(w2, a2, '我們沒地方住，{a}卻說公庫先不蓋房子。', -6); return { k: '公庫先不蓋' }; } },
            { id: 'one', quiet: true, text: { k: '公庫出 {n} 銀幣，蓋一棟公有房舍', p: { n: PUB_COST } }, say: '由公庫出錢蓋一棟公有房舍', why: '不能讓人睡在廣場上。', lean: { bond: 0.2 }, adj: care * 0.5, run: go(1) }];
        if (X.n >= 2) out.push({ id: 'two', quiet: true, text: { k: '公庫出 {n} 銀幣，蓋兩棟公有房舍', p: { n: PUB_COST * 2 } }, say: '由公庫出錢蓋兩棟公有房舍', why: '缺的不只一棟，一次蓋夠。', lean: { bond: 0.2 }, adj: care * 0.5 + (X.hids.length >= 2 ? 0.1 : -0.3), run: go(2) });
        return calib(out, X.n >= 2 ? [0.18, 0.32, 0.5] : [0.2, 0.8]);
    }

    // ---------- 幫傭：請不請（hireHelp t:'hire'）、去不去（helpOffer）、錢少了辭不辭退（hireHelp t:'keep'） ----------
    const svCount = (E, mid) => Object.values(E.servants).filter(x => x === mid).length;
    const svOf = (w, mid) => Object.entries(S(w).servants).filter(([, m]) => m === mid).map(([sid]) => w.agents[sid]).filter(Boolean);
    const svFam = (a, b) => (a._parentNames || []).includes(b.name) || (b._parentNames || []).includes(a.name) || a.relationships?.relationships?.[b.agentId]?.status === 'married';
    const svSlots = (w, m) => { const E = S(w); return Math.min(3, Math.floor(cash(w, m) / 300)) - svCount(E, m.agentId) - Object.values(E.hs.svOff).filter(x => x.m === m.agentId).length; };
    // 可以來幫傭的人（條件跟原本一樣：身上不到 15 銀幣、16 歲以上、不是家人、名下沒有房子、自己沒有請人也沒有在幫傭），從最窮的排起
    function poolOf(w, m) {
        const E = S(w), H = E.hs, d = day(w); const masters = new Set(Object.values(E.servants));
        return npcs(w).filter(s => s !== m && adult(w, s, 16) && cash(w, s) < 15 && !E.servants[s.agentId] && !masters.has(s.agentId) && !svFam(m, s) && !ownsOf(w, s.agentId).length && !H.svOff[s.agentId] && !cooled(H.svNo, s.agentId + '|' + m.agentId, d, 28)).sort((x, y) => cash(w, x) - cash(w, y));
    }
    function servantsBy(w) {
        const E = S(w), H = E.hs, d = day(w);
        for (const [sid, mid] of Object.entries(E.servants)) if (!w.agents[mid] || !w.agents[sid]) delete E.servants[sid]; // 人不在了
        // 主人錢少了（原本不到 150 就自動辭退）：兩週問一次，辭不辭退由他決定；真的付不出工錢那天，幫傭的人照舊會走（payServants）
        for (const mid of new Set(Object.values(E.servants))) { const m = w.agents[mid]; if (!m || cash(w, m) >= 150 || !adult(w, m, 16) || cooled(H.svKeep, mid, d, 14)) continue; H.svKeep[mid] = d; askMany(w, [{ a: m, kind: 'hireHelp', ctx: { t: 'keep', d } }]); }
        // 身上 300 銀幣以上、還請得起的人：28 天問一次（一週最多問四位，從最有錢的問起）
        let n = 0; for (const m of npcs(w).filter(a => adult(w, a) && cash(w, a) >= 300 && !E.servants[a.agentId]).sort((x, y) => cash(w, y) - cash(w, x))) {
            if (n >= 4) break; if (svSlots(w, m) <= 0 || cooled(H.svAsk, m.agentId, d, 28) || !poolOf(w, m).length) continue;
            H.svAsk[m.agentId] = d; n++; askMany(w, [{ a: m, kind: 'hireHelp', ctx: { t: 'hire', d } }]);
        }
    }
    function liveHire(w, m, c) { if (!c || c.t !== 'hire' || !hsOn(w) || !adult(w, m) || day(w) - (c.d ?? 0) > 1 || cash(w, m) < 300 || svSlots(w, m) <= 0) return null; const pool = poolOf(w, m).slice(0, 3); return pool.length ? { E: S(w), pool } : null; }
    function hireFacts(w, m, c) {
        const X = liveHire(w, m, c); if (!X) return ''; const have = svCount(X.E, m.agentId);
        const rows = X.pool.map(s => fill('{s}（身上 {n} 銀幣，{job}，{tie}）', { s: s.name, n: Math.floor(cash(w, s)), job: s.job ? { k: '做{j}', p: { j: jobOf(s) } } : '沒有工作', tie: tieP(m, s).s })).join(t('、'));
        return fill('你身上有 {c} 銀幣，請得起人到家裡幫傭：一個人一天 {p} 銀幣（一週 {w7} 銀幣），家裡的事有人做。{have}鎮上手頭最緊、可以來的人有：{list}。請了以後，錢少了可以辭退。', { c: Math.floor(cash(w, m)), p: SERVANT_PAY, w7: SERVANT_PAY * 7, have: have ? { k: '你家已經請了 {n} 個人。', p: { n: have } } : { raw: '' }, list: { raw: rows } });
    }
    function hireOptions(w, m, c) {
        const X = liveHire(w, m, c); if (!X) return []; const k = X.pool.length; const mood = (has(m, 'lazy') ? 0.2 : 0) + (hasV(m, '權力') ? 0.15 : 0) - (has(m, 'thrifty') ? 0.35 : 0) - (has(m, 'ascetic') ? 0.5 : 0) + (cash(w, m) >= 900 ? 0.15 : 0);
        const out = [{ id: 'no', quiet: true, mute: true, text: '不請，家裡的事自己來', say: '沒有請人幫傭', why: '家裡的事自己做就好，不必花這個錢。', lean: { safe: 0.1 }, run: (w2) => { st(w2, 'hsHireNo'); return null; } }];
        for (const s of X.pool) out.push({ id: 'hire:' + s.agentId, quiet: true, text: { k: '請{s}來幫傭（一天 {p} 銀幣）', p: { s: s.name, p: SERVANT_PAY } }, say: { k: '開口請{s}來家裡幫傭', p: { s: s.name } }, why: aff(m, s) >= 40 ? { k: '{s}手頭緊，請他來也算幫他一把。', p: { s: s.name } } : '家裡的事有人做，日子輕鬆一點。', lean: { face: 0.2 },
            adj: mood + clampN(aff(m, s) / 60, -0.6, 0.4) + (has(m, 'kind') ? 0.15 : 0), run: (w2, m2) => helpAsk(w2, m2, s.agentId, c) });
        return calib(out, [0.4].concat(X.pool.map(() => 0.6 / k)));
    }
    function helpAsk(w, m, sid, c) {
        const X = liveHire(w, m, c); const s = X && poolOf(w, m).find(x => x.agentId === sid); if (!s) return { k: '後來沒請成' }; const H = X.E.hs, d = day(w);
        const O = H.svOff[sid] = { m: m.agentId, d, tok: ++H.n }; H.svAsk[m.agentId] = d - 21; st(w, 'hsHireAsk'); // 開了口：下週就可以再問（還有名額、或這次沒請成）
        askMany(w, [{ a: s, kind: 'helpOffer', ctx: { m: m.agentId, tok: O.tok, d } }]);
        return { k: '開口請{s}來幫傭，等他回話', p: { s: s.name } };
    }
    function liveOffer(w, s, c) {
        if (!c || !hsOn(w) || !adult(w, s, 16)) return null; const E = S(w); const O = E.hs.svOff[s.agentId]; if (!O || O.tok !== c.tok || O.m !== c.m || day(w) - O.d > 1 || E.servants[s.agentId]) return null;
        const m = w.agents[O.m]; if (!m || m.isDead || m === s || cash(w, m) < 150 || svCount(E, m.agentId) >= 3) return null; return { E, O, m }; // 等回話的這段時間主人不在了、錢少了、已經請滿了：這件事就過去了
    }
    function offerFacts(w, s, c) {
        const X = liveOffer(w, s, c); if (!X) return ''; const { m } = X; const T = tieP(s, m); const hg = hungryOf(w, s);
        return fill('{m}想請你到他家幫傭，一天 {p} 銀幣，一週就是 {w7} 銀幣；幫傭不影響你原本的工作。你身上只剩 {c} 銀幣{hungry}，{job}。對你來說，{m}{tie}（你對他的好感 {v}）。他身上大約有 {mc} 銀幣；他錢少了可能會辭退你。',
            { m: m.name, p: SERVANT_PAY, w7: SERVANT_PAY * 7, c: Math.floor(cash(w, s)), hungry: hg >= 1 ? { k: '，已經 {n} 天沒吃飽了', p: { n: hg } } : { raw: '' }, job: s.job ? { k: '你現在做{j}', p: { j: jobOf(s) } } : '你現在沒有工作', tie: T.s, v: T.v, mc: Math.round(cash(w, m) / 50) * 50 });
    }
    function offerOptions(w, s, c) {
        const X = liveOffer(w, s, c); if (!X) return []; const { m } = X; const T = tieP(s, m); const hg = hungryOf(w, s);
        return calib([
            { id: 'no', quiet: true, text: '不去', say: { k: '沒有答應去{m}家幫傭', p: { m: m.name } }, why: T.k === 'foe' ? { k: '再窮也不去{m}家看他臉色。', p: { m: m.name } } : '到別人家裡聽人使喚，我做不來。', lean: { face: 0.2 },
                run: (w2, s2) => { const X2 = liveOffer(w2, s2, c); if (!X2) return null; const H = X2.E.hs; delete H.svOff[s2.agentId]; H.svNo[s2.agentId + '|' + X2.m.agentId] = day(w2); st(w2, 'hsHelpNo');
                    mem(w2, X2.m, '我想請{s}來家裡幫傭，他沒答應。', { s: s2.name }, 5); mem(w2, s2, '{m}想請我去他家幫傭，我沒答應。', { m: X2.m.name }, 5); bumpA(X2.m, s2, -2); return { k: '沒有去{m}家幫傭', p: { m: X2.m.name } }; } },
            { id: 'go', quiet: true, text: { k: '去{m}家幫傭（一天 {p} 銀幣）', p: { m: m.name, p: SERVANT_PAY } }, say: { k: '答應去{m}家幫傭', p: { m: m.name } }, why: '有錢賺總比餓肚子好。', lean: { gain: 0.2, face: -0.2 },
                adj: clampN(aff(s, m) / 60, -0.8, 0.3) + (hg >= 1 ? 0.2 : 0) + (kidsOf(w, s) ? 0.15 : 0) - (has(s, 'ambitious') ? 0.15 : 0) - (hasV(s, '權力') ? 0.2 : 0) - (hasV(s, '自由') ? 0.15 : 0) + (s.job ? -0.1 : 0.1),
                run: (w2, s2) => { const X2 = liveOffer(w2, s2, c); if (!X2) return null; const m2 = X2.m; delete X2.E.hs.svOff[s2.agentId]; X2.E.servants[s2.agentId] = m2.agentId; st(w2, 'hsHelpGo');
                    mem(w2, s2, '我到{m}家幫傭，一天 {n} 銀幣。', { m: m2.name, n: SERVANT_PAY }, 6); mem(w2, m2, '家裡請了{s}來幫傭。', { s: s2.name }, 4); log(w2, '🧹 {m}請了{s}到家裡幫傭。', { m: m2.name, s: s2.name }, m2.name); bumpA(s2, m2, 3); return { k: '到{m}家幫傭了', p: { m: m2.name } }; } },
        ], [0.2, 0.8]);
    }
    function liveKeep(w, m, c) { if (!c || c.t !== 'keep' || !hsOn(w) || !adult(w, m, 16) || day(w) - (c.d ?? 0) > 1 || cash(w, m) >= 150) return null; const ss = svOf(w, m.agentId); return ss.length ? { E: S(w), ss } : null; }
    function keepFacts(w, m, c) {
        const X = liveKeep(w, m, c); if (!X) return ''; const per = SERVANT_PAY * X.ss.length;
        return fill('你身上只剩 {c} 銀幣，家裡還請著 {n} 個人幫傭（{names}），一天要付 {p} 銀幣，照這樣大約 {d} 天就付不出工錢。辭退的話他們少了這份收入；留著的話，哪天付不出工錢，他們就會走。', { c: Math.floor(cash(w, m)), n: X.ss.length, names: { raw: namesOf(X.ss) }, p: per, d: Math.floor(cash(w, m) / per) });
    }
    function keepOptions(w, m, c) {
        const X = liveKeep(w, m, c); if (!X) return []; const close = X.ss.some(s => aff(m, s) >= 40); const nm = { raw: namesOf(X.ss) };
        return calib([
            { id: 'keep', quiet: true, mute: true, text: '再撐一陣子，先不辭退', say: '沒有辭退家裡的幫傭', why: '他們也要吃飯，能撐就再撐一下。', lean: { bond: 0.2 }, run: (w2) => { st(w2, 'hsKept'); return null; } },
            { id: 'fire', quiet: true, text: { k: '辭退{names}', p: { names: nm } }, say: { k: '辭退了家裡的幫傭{names}', p: { names: nm } }, why: '自己都快沒錢了，請不起了。', lean: { safe: 0.2 },
                adj: (has(m, 'thrifty') ? 0.3 : 0) + (has(m, 'greedy') ? 0.2 : 0) + (cash(w, m) < 60 ? 0.4 : 0) - (has(m, 'kind') ? 0.3 : 0) - (has(m, 'generous') ? 0.3 : 0) - (close ? 0.4 : 0),
                run: (w2, m2) => { const X2 = liveKeep(w2, m2, c); if (!X2) return null; st(w2, 'hsFired', X2.ss.length);
                    for (const s of X2.ss) { mem(w2, s, '{m}說請不起了，我被辭退了。', { m: m2.name }, 6); delete X2.E.servants[s.agentId]; log(w2, '🧹 {m}手頭緊了，辭退了來家裡幫傭的{s}。', { m: m2.name, s: s.name }, m2.name); }
                    return { k: '辭退了 {n} 個人', p: { n: X2.ss.length } }; } },
        ], [0.3, 0.7]);
    }
    // ---------- 給決策核心的入口：七個選擇點的事實與選項（登記在 sim-decide-life.js、sim-decide-pol.js） ----------
    const HSK = {
        houseBuy: { facts: (w, a, c) => (c?.t === 'home' ? homeBuyFacts(w, a, c) : pubBuyFacts(w, a, c)), options: (w, a, c) => (c?.t === 'home' ? homeBuyOptions(w, a, c) : pubBuyOptions(w, a, c)) },
        homeSell: { facts: (w, a, c) => (c?.t === 'bid' ? bidFacts(w, a, c) : sellFacts(w, a, c)), options: (w, a, c) => (c?.t === 'bid' ? bidOptions(w, a, c) : sellOptions(w, a, c)) },
        buildRent: { facts: buildFacts, options: buildOptions },
        townSale: { facts: saleFacts, options: saleOptions },
        townBuild: { facts: pubBuildFacts, options: pubBuildOptions },
        hireHelp: { facts: (w, a, c) => (c?.t === 'keep' ? keepFacts(w, a, c) : hireFacts(w, a, c)), options: (w, a, c) => (c?.t === 'keep' ? keepOptions(w, a, c) : hireOptions(w, a, c)) },
        helpOffer: { facts: offerFacts, options: offerOptions },
    };
    function hsFacts(kind, w, a, c) { try { return HSK[kind] ? HSK[kind].facts(w, a, c) || '' : ''; } catch (e) { console.warn('[Estate] facts', kind, e); return ''; } }
    function hsOptions(kind, w, a, c) { return HSK[kind] ? HSK[kind].options(w, a, c) || [] : []; }
    // ---------- 傭人:有錢人請窮人幫傭 ----------
    function servants(w, ch) {
        if (ch === true && hsOn(w)) return servantsBy(w); // v11.14.0 請不請、去不去、辭不辭退由本人決定；下面是原本的規則
        const E = S(w); const all = npcs(w); const Wl = WL();
        for (const [sid, mid] of Object.entries(E.servants)) { const m = w.agents[mid], s = w.agents[sid]; if (!m || !s || cash(w, m) < 150) { if (s && m) mem(w, s, '{m}說請不起了，我被辭退了。', { m: m.name }, 6); delete E.servants[sid]; } }
        const count = (mid) => Object.values(E.servants).filter(x => x === mid).length;
        const fam = (a, b) => (a._parentNames || []).includes(b.name) || (b._parentNames || []).includes(a.name) || a.relationships?.relationships?.[b.agentId]?.status === 'married';
        for (const m of all.filter(a => cash(w, a) >= 300).sort((x, y) => cash(w, y) - cash(w, x))) {
            const slots = Math.min(3, Math.floor(cash(w, m) / 300)) - count(m.agentId); if (slots <= 0) continue;
            const pool = all.filter(s => s !== m && (s.age || 30) >= 16 && cash(w, s) < 15 && !E.servants[s.agentId] && !Object.values(E.servants).includes(s.agentId) && !fam(m, s) && !ownsOf(w, s.agentId).length).sort((x, y) => cash(w, x) - cash(w, y));
            for (const s of pool.slice(0, slots)) { E.servants[s.agentId] = m.agentId; mem(w, s, '我到{m}家幫傭，一天 {n} 銀幣。', { m: m.name, n: SERVANT_PAY }, 6); mem(w, m, '家裡請了{s}來幫傭。', { s: s.name }, 4); log(w, '🧹 {m}請了{s}到家裡幫傭。', { m: m.name, s: s.name }, m.name); }
        }
    }
    const SERVANT_PAY = 3;
    function payServants(w) {
        const E = S(w); const Wl = WL(); if (!Wl) return;
        for (const [sid, mid] of Object.entries(E.servants)) { const m = w.agents[mid], s = w.agents[sid]; if (!m || !s) { delete E.servants[sid]; continue; } if (Wl.take(w, m, SERVANT_PAY)) Wl.add(w, s, SERVANT_PAY); else delete E.servants[sid]; }
    }
    // ---------- 每天 ----------
    function daily(w) {
        const E = S(w), d = day(w); if (E.lastDay === d) return; E.lastDay = d;
        init(w); const hh = households(w); scarOnce(w, () => { settle(w, hh); payServants(w); });
        // 露宿:心情差、很冷;冬天有危險
        const winter = w.clock?.season === '冬季';
        for (const hid of Object.keys(E.homeless)) for (const a of hh.get(hid) || []) {
            a.addThought?.('homeless', w); if (a.needs) a.needs.comfort = Math.max(0, (a.needs.comfort ?? 50) - (winter ? 30 : 12));
            if (winter && Math.random() < 0.004 && w.lifecycle?._killNpc) { a._deathCause = t('凍死街頭'); log(w, '❄️ {a}在寒夜裡露宿街頭，沒能撐過去。', { a: a.name }, a.name); try { w.lifecycle._killNpc(w, a); } catch (e) {} }
        }
        scarOnce(w, () => { // 上面露宿那一段可能有人過世（戶數會變），所以這裡重新記一次
            if (d % 7 === 0) weekly(w, households(w), hsOn(w));
            try { hsDaily(w, d); } catch (e) { console.warn('[Estate] house', e); } // v11.14.0 掛了兩天沒人買的房子、沒回音的幫傭邀約：收掉
            try { llDaily(w, d); } catch (e) { console.warn('[Estate] landlord', e); } // v11.6.0 房東定租金、欠租等回話的退路
        });
    }
    // ---------- 開局家族:一部分大人是夫妻,小孩與年輕人有爸媽 ----------
    function seedFamilies(w) {
        const all = npcs(w); if (all.length < 4) return 0; let n = 0;
        const single = (a) => !spouseOf(w, a) && !Object.values(a.relationships?.relationships || {}).some(r => r.status === 'dating' || r.status === 'married');
        const adults = all.filter(a => (a.age || 30) >= 22 && (a.age || 30) <= 62 && single(a));
        const men = adults.filter(a => a.gender !== 'female').sort(() => Math.random() - 0.5), women = adults.filter(a => a.gender === 'female').sort(() => Math.random() - 0.5);
        const couples = [];
        for (const m of men) {
            if (Math.random() > 0.45) continue; const i = women.findIndex(f => Math.abs((f.age || 30) - (m.age || 30)) <= 9); if (i < 0) continue; const f = women.splice(i, 1)[0];
            for (const [x, y] of [[m, f], [f, m]]) { const r = x.relationships.getOrCreate(y.agentId, y.name); r.status = 'married'; r.statusSince = 0; r.modifyAffinity(Math.max(0, 55 - (r.affinity || 0))); r.modifyTrust(Math.max(0, 40 - (r.trust || 0))); r.interactionCount = Math.max(r.interactionCount || 0, 20); r.lastInteractionTick = w.tickCount || 1; }
            f.homeLocation = m.homeLocation; couples.push([m, f]); n++;
        }
        // 小孩與年輕人:找年紀差 20～38 歲的夫妻當爸媽
        const kids = all.filter(a => !(a._parentNames || []).length && !couples.some(([m, f]) => m === a || f === a) && ((a.age || 30) < 18 || ((a.age || 30) < 32 && Math.random() < 0.5)));
        // 喪偶或單親的長輩(40 歲以上的單身)也可以是爸媽
        const singles = all.filter(a => (a.age || 30) >= 40 && single(a) && !couples.some(([m, f]) => m === a || f === a)).map(a => [a]);
        const parents = [...couples, ...singles];
        for (const k of kids) {
            const opts = parents.filter(ps => { const g = Math.min(...ps.map(p => p.age || 40)) - (k.age || 10); return g >= 18 && g <= 40 && !ps.includes(k); }); if (!opts.length) continue;
            const ps = opts[Math.floor(Math.random() * opts.length)]; k._parentNames = ps.map(p => p.name); if ((k.age || 10) < 18) k.homeLocation = ps[0].homeLocation;
            for (const p of ps) { const r1 = k.relationships.getOrCreate(p.agentId, p.name); r1.modifyAffinity(Math.max(0, 45 - (r1.affinity || 0))); r1.lastInteractionTick = w.tickCount || 1; const r2 = p.relationships.getOrCreate(k.agentId, k.name); r2.modifyAffinity(Math.max(0, 55 - (r2.affinity || 0))); r2.lastInteractionTick = w.tickCount || 1; }
            n++;
        }
        return n;
    }
    // ---------- 給 AI 與觀察者看的 ----------
    function brief(w, a) {
        const E = S(w); const out = []; const own = ownsOf(w, a.agentId); const h = headOf(w, a);
        if (E.homeless[h.agentId] !== undefined) out.push(t('你無家可歸，晚上睡在廣場。'));
        else if (E.lodge[h.agentId]) { const u = E.units[E.home[h.agentId]]; out.push(t('你寄住在別人家，每週分租 {r} 銀幣。').replace('{r}', u ? Math.ceil(rentOf(w, u, h.agentId) * 0.5) : 0)); }
        else { const u = E.units[E.home[h.agentId]]; if (u) { const o = ownerAgent(w, u); if (u.owner && (u.owner === a.agentId || (households(w).get(h.agentId) || []).some(m => m.agentId === u.owner))) out.push(t('你住在自家的房子。')); else out.push(t('你租{o}的房子，每週房租 {r} 銀幣。').replace('{o}', o ? t(o.name) : t('鎮公所')).replace('{r}', rentOf(w, u, h.agentId))); if (E.arrears[h.agentId]) out.push(t('你還欠 {n} 銀幣房租。').replace('{n}', Math.round(E.arrears[h.agentId]))); } }
        const rented = own.filter(u => u.occ && !(households(w).get(u.occ) || []).some(m => m.agentId === a.agentId)).length; if (rented) out.push(t('你有 {n} 棟房子租給別人。').replace('{n}', rented));
        if (E.servants[a.agentId]) out.push(t('你在{m}家幫傭。').replace('{m}', t(w.agents[E.servants[a.agentId]]?.name || '')));
        const sv = Object.values(E.servants).filter(x => x === a.agentId).length; if (sv) out.push(t('你家請了 {n} 個傭人。').replace('{n}', sv));
        return out.join(' ');
    }
    function describe(w, a) {
        const E = S(w); const out = []; const own = ownsOf(w, a.agentId); const h = headOf(w, a);
        if (E.homeless[h.agentId] !== undefined) out.push(t('無家可歸，睡在廣場'));
        else if (E.lodge[h.agentId]) { const u = E.units[E.home[h.agentId]]; const o = u && ownerAgent(w, u); out.push(t('寄住在別人家（分租 {r}）').replace('{r}', u ? Math.ceil(rentOf(w, u, h.agentId) * 0.5) : 0)); }
        else { const u = E.units[E.home[h.agentId]]; if (u) { const o = ownerAgent(w, u); const self = u.owner && (households(w).get(h.agentId) || []).some(m => m.agentId === u.owner); out.push(self ? t('住自家的房子') : t('租{o}的房子（週租 {r}）').replace('{o}', o ? t(o.name) : t('鎮公所')).replace('{r}', rentOf(w, u, h.agentId))); if (E.arrears[h.agentId]) out.push(t('欠房租 {n}').replace('{n}', Math.round(E.arrears[h.agentId]))); } }
        if (own.length > 1 || (own.length === 1 && !own.some(u => u.id === E.home[h.agentId]))) out.push(t('名下 {n} 棟房子').replace('{n}', own.length));
        if (E.servants[a.agentId]) out.push(t('在{m}家幫傭').replace('{m}', t(w.agents[E.servants[a.agentId]]?.name || '')));
        const sv = Object.values(E.servants).filter(x => x === a.agentId).length; if (sv) out.push(t('請了 {n} 個傭人').replace('{n}', sv));
        return out.join(t('；'));
    }
    function view(w) {
        const E = S(w); const units = Object.values(E.units); const landlords = new Set(units.filter(u => u.owner && u.occ && !(households(w).get(u.occ) || []).some(m => m.agentId === u.owner)).map(u => u.owner));
        const rents = units.filter(u => u.occ).map(u => rentOf(w, u, u.occ)); // v11.6.0 實際收的（房東的檔位、自己人的折扣都算進去）
        return { units: units.length, lodgers: units.reduce((n, u) => n + lodgersOf(u).length, 0), vacant: units.filter(u => !u.occ).length, homeless: Object.values(E.homeless).length, homelessPeople: Object.keys(E.homeless).reduce((s, hid) => s + ((households(w).get(hid) || []).length || 1), 0), landlords: landlords.size, townOwned: units.filter(u => !u.owner).length, rent: rents.length ? Math.round(rents.reduce((s, x) => s + x, 0) / rents.length) : 0, servants: Object.keys(E.servants).length, stats: { ...E.stats } };
    }
    return { hsOn, hsFacts, hsOptions, hsDaily, hsLeader: leaderOf, hsBuyers: buyersOf, hsPool: poolOf, hsShort: shortOf, marketBy, servantsBy, rehouse, pubMode, BLD_COST, PUB_COST, TIER_F, kinHH, llFacts, llOptions, llDaily, overdue, landlords, setTier, S, init, daily, weekly, market, settle, evict, moveIn, lodgeIn, lodgeSlot, foreclose, seedFamilies, households, headOf, unitOf, isHomeless, rentOf, valueOf, ownsOf, scarcity, brief, describe, view, servants, payServants, SERVANT_PAY, HOMELESS_AT, mortInfo, mortBy };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, { homeless: { mood: -10, opinion: 0, days: 2, label: t('無家可歸') } });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.wallet) ESTATE.daily(w); } catch (e) { console.warn('[Estate] daily', e); } return r; };
}
// 過世:房子由配偶或成年子女繼承,沒人就歸公有
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let own = [], heir = null;
        try { if (world.estate && npc) { own = ESTATE.ownsOf(world, npc.agentId); if (own.length) heir = typeof MARKET !== 'undefined' && MARKET.heirsAll ? (MARKET.heirsAll(world, npc)[0] || null) : Object.values(world.agents).filter(o => o !== npc && !o.isDead && !o.isPlayer && (o.relationships?.relationships?.[npc.agentId]?.status === 'married' || ((o._parentNames || []).includes(npc.name) && (o.age || 0) >= 16))).sort((x, y) => (y.age || 0) - (x.age || 0))[0] || null; } } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest);
        try { for (const u of own) u.owner = heir ? heir.agentId : null; if (heir && own.length) heir.memory?.addT?.(world.tickCount, world.clock.timeStr, 'economy', '我繼承了{o}的 {n} 棟房子。', { o: npc.name, n: own.length }, 8, [npc.name]); if (world.estate?.servants) { delete world.estate.servants[npc.agentId]; for (const [s, m] of Object.entries(world.estate.servants)) if (m === npc.agentId) delete world.estate.servants[s]; } } catch (e) {}
        return r;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.estate && ESTATE.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.estate = null; try { if (this.rosterMode !== 'empty') ESTATE.seedFamilies(this); } catch (e) { console.warn('[Estate] families', e); } return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.estate) d.estate = this.estate; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.estate = (data?.estate && typeof data.estate.units === 'object') ? data.estate : null; } catch (e) {} return r; };
}
if (typeof ORIGIN !== 'undefined' && ORIGIN.seed) { const _seed = ORIGIN.seed; ORIGIN.seed = function (w, ...rest) { const r = _seed.call(this, w, ...rest); try { ESTATE.seedFamilies(w); } catch (e) {} return r; }; }
if (typeof globalThis !== 'undefined') globalThis.ESTATE = ESTATE;
