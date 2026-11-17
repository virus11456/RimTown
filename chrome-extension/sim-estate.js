// v6.90.0 房產、資本與財富流動
// - 住宅市場:以「一戶」為單位(夫妻＋未成年子女一戶,成年單身自己一戶);房子數量有限,不夠就沒地方住
// - 房子有主人:自住的屋主繳一點地價稅;租屋的每週付房租給房東(公有房舍付給公庫);缺房時房租會漲
// - 付不起房租就欠著,欠太多被趕出去,睡在廣場;手頭有點錢、又有空屋才租得回來
// - 房產買賣:公有房舍標售給有錢人(房東階級)、手頭緊的屋主賣掉自住的房子變成租客、有錢人蓋新房出租
// - 抵押:屋主缺錢可以拿房子跟銀行借,還不出來房子被銀行收走
// - 有錢人請窮人當傭人(每天付工錢),主人沒錢了就辭退
// - 開局居民有家族:一部分大人是夫妻、小孩和年輕人有爸媽
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
    function S(w) {
        if (!w.estate || typeof w.estate.units !== 'object') w.estate = { units: {}, home: {}, orig: {}, homeless: {}, arrears: {}, servants: {}, lodge: {}, n: 0, lastDay: null, stats: { built: 0, evicted: 0, foreclosed: 0, sold: 0, rent: 0, ptax: 0 } };
        const E = w.estate; for (const k of ['units', 'home', 'orig', 'homeless', 'arrears', 'servants', 'lodge', 'll', 'llAsk', 'late', 'grace', 'cut']) E[k] = E[k] || {}; E.stats = E.stats || {}; // v11.6.0 ll 房東定的檔位、llAsk 上次問他的日子、late 欠租等房東回話、grace 寬限到哪天、cut 欠租期間打八折（舊存檔沒有這幾格，就是照行情、沒人在等）
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
    function scarcity(w) { const E = S(w); const hh = households(w).size; const n = Object.keys(E.units).length || 1; return Math.max(0.8, Math.min(2, hh / n)); }
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
    function weekly(w, hh) {
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
        market(w, hh);
        // 無家可歸的人存到錢、又有空屋,就租回來
        for (const hid of Object.keys(E.homeless)) {
            const members = hh.get(hid) || []; const payer = members.slice().sort((x, y) => cash(w, y) - cash(w, x))[0]; if (!payer) continue;
            const vac = Object.values(E.units).filter(u => !u.occ).sort((x, y) => rentOf(w, x) - rentOf(w, y))[0];
            if (vac && cash(w, payer) >= rentOf(w, vac) * (vac.owner ? 1.5 : 1)) { moveIn(w, hid, vac); mem(w, payer, '總算又租到房子了。', {}, 7); log(w, '🏠 {a}存了點錢，又租到房子了。', { a: payer.name }, payer.name); continue; }
            const slot = lodgeSlot(w); if (slot && cash(w, payer) >= Math.ceil(rentOf(w, slot) * 0.5) * 2) { lodgeIn(w, hid, slot); mem(w, payer, '找到地方寄住了，總比睡廣場好。', {}, 6); }
        }
        servants(w);
    }
    function market(w, hh) {
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
    // ---------- 傭人:有錢人請窮人幫傭 ----------
    function servants(w) {
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
        init(w); const hh = households(w); settle(w, hh); payServants(w);
        // 露宿:心情差、很冷;冬天有危險
        const winter = w.clock?.season === '冬季';
        for (const hid of Object.keys(E.homeless)) for (const a of hh.get(hid) || []) {
            a.addThought?.('homeless', w); if (a.needs) a.needs.comfort = Math.max(0, (a.needs.comfort ?? 50) - (winter ? 30 : 12));
            if (winter && Math.random() < 0.004 && w.lifecycle?._killNpc) { a._deathCause = t('凍死街頭'); log(w, '❄️ {a}在寒夜裡露宿街頭，沒能撐過去。', { a: a.name }, a.name); try { w.lifecycle._killNpc(w, a); } catch (e) {} }
        }
        if (d % 7 === 0) weekly(w, households(w));
        try { llDaily(w, d); } catch (e) { console.warn('[Estate] landlord', e); } // v11.6.0 房東定租金、欠租等回話的退路
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
    return { TIER_F, kinHH, llFacts, llOptions, llDaily, overdue, landlords, setTier, S, init, daily, weekly, market, settle, evict, moveIn, lodgeIn, lodgeSlot, foreclose, seedFamilies, households, headOf, unitOf, isHomeless, rentOf, valueOf, ownsOf, scarcity, brief, describe, view, servants, payServants, SERVANT_PAY, HOMELESS_AT, mortInfo, mortBy };
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
