// RimTown - sim-procure.js：v11.5.0 公庫的採購計畫（把寫死的規則交給村民，第一階段）
// 以前鎮上的料怎麼補，有三套各自獨立的自動規則，沒有任何人決定過：
//   1. 每天把木材、石材、金屬、布料、草藥向外地買到固定的下限，公庫留 50（sim-economy.js）
//   2. 商店補貨：糧食、藥、工具、布、草藥低於某個數就補，公庫留 60，日誌還掛名某位廚師或醫生「去補了」（sim-autonomy.js）
//   3. 行商在鎮上時，低於下限的貨買到一倍半，公庫留 80（sim-autonomy.js）
// 三套各有各的下限與保留金額，互相不知道對方買了什麼。升格缺料時也只會記一行字，沒有人負責備料；備回來的料還會被木匠和取暖用掉。
// 現在合成一份「採購計畫」，東西是公家倉庫的、由首長替公倉買：
//   - 計畫是什麼（照平常的量備／只備最要緊的／為升格備料並把料保留下來／這週不買），由首長決定：一週問一次，
//     有急事提早問（在用的料用完了、公庫發不出薪水、升格卡在料或卡在科技、還沒有人拿過主意）。選擇點 mayorWeek，登記在 sim-decide-pol.js。
//   - 每天照計畫補貨仍然是算術（daily → exec），不問任何人。
//   - 行商、跨鎮商隊來了，賣什麼、買什麼、做不做，由出面談的人決定（商人；私人商行是東家；都沒有就是首長）。選擇點 tradeRun。買貨不能超過首長計畫的預算。
//   - 沒有人拿主意、或計畫顧不到時不再偷偷補：缺的東西會變成提早問首長的理由，也會變成村民可以提的案（進一批某某）。
//   - 保留的料（首長為升格保留的、已批准提案保留的）真的留著：工匠、取暖、賣貨都拿不到（Stockpile.locked，sim-economy.js）。
// 銀幣都在真的帳戶之間移動：公庫付給外地（記進「向外地買原料」「鎮上商店進貨」「向外地訂貨」「來訪商人買賣」），沒有憑空多出或消失的錢。
// 舊存檔沒有計畫：先用跟以前一樣的量（照平常備、公庫留 50），直到首長第一次拿主意。
'use strict';

const PROCURE = (() => {
    const RAWS = ['wood', 'stone', 'metal', 'cloth', 'herbs'];
    const IMPORT_PRICE = { wood: 3, stone: 4.5, metal: 7.5, cloth: 6, herbs: 7.5 }; // 向外地買原料的單價（含運費，大約是行情的兩倍）
    const SHOP_GOODS = ['food', 'medicine', 'tools']; // 這三樣照商店的價錢買
    const WATCH = ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'medicine', 'tools'];
    const MODES = ['usual', 'lean', 'tier', 'save'], PAYS = ['even', 'care', 'low'];
    const KEEP = 50, SEED_KEEP = 20, WEEK = 7, URG_GAP = 5, TECH_GAP = 20;
    const MODE_NAME = { usual: '照平常的量備貨', lean: '只備最要緊的', tier: '為升格備料', save: '這週不買，把錢存下來' };
    const PAY_NAME = { even: '大家照同一個比例少領', care: '先發守衛和醫生', low: '先發工資最低的人' };
    const ERA_ZH = { 4: '第四', 5: '第五' };
    const USERS = { wood: ['carpenter', 'blacksmith'], metal: ['blacksmith'], cloth: ['tailor'], herbs: ['doctor'], stone: ['miner', 'carpenter'], food: ['cook', 'farmer'], medicine: ['doctor'], tools: ['blacksmith', 'miner'] };
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
    const sp = (w) => w.stockpile;
    const get = (w, r) => sp(w)?.get?.(r) || 0;
    const silver = (w) => get(w, 'silver');
    const lockedOf = (w, r) => { try { return sp(w)?.locked?.(r) || 0; } catch (e) { return 0; } };
    const freeOf = (w, r) => get(w, r) - lockedOf(w, r); // 拿得到的量；保留的料還沒到齊時是負的
    const on = (w) => !!(w && w.observerMode && w.stockpile);
    const asking = (w) => on(w) && typeof DECIDE !== 'undefined' && DECIDE.on(w);
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : v; return o; };
    const log = (w, cat, k, p, who) => { try { w.logMessageT?.(cat, k, flat(p), who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5, cat = 'work') => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', cat, k, flat(p), imp, []); } catch (e) {} };
    const zh = (r) => (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[r]) || r;
    const nm = (r) => t(zh(r));
    const matText = (m) => Object.entries(m || {}).filter(([, n]) => n > 0).map(([r, n]) => `${nm(r)} ${Math.ceil(n)}`).join(t('、'));
    const listText = (xs) => xs.map(x => `${nm(x.r)}×${x.qty}`).join(t('、'));
    const flow = (w, cat, n) => { try { if (typeof MONEY !== 'undefined') MONEY.flow(w, cat, n); } catch (e) {} };
    // 馬上問這一個人這一件事（照個性的當場有答案；問 AI 的等回話）。決策核心的佇列是大家共用的：別的系統排進去、要等它自己的時間才處理的事（約人出去、來道歉…）先拿開，
    // 只處理這一件，再原樣放回去。不然這裡一問，別人排著的事就被提早決定掉了
    function askNow(w, a, kind, ctx) { const X = DECIDE.S(w); const keep = X.q.splice(0, X.q.length); try { DECIDE.enqueue(w, a, kind, ctx); DECIDE.drain(w, X, day(w)); } finally { if (keep.length) X.q.unshift(...keep); } }
    // 包一段會跟外地有銀幣往來的事：做完之後，全鎮的錢變了多少、其中還沒記帳的部分記到這一類（跟 MONEY.track 同一個算法；被 track 包住時也不會記兩次）
    function flowed(w, cat, fn) { if (typeof MONEY === 'undefined') return fn(); const b = MONEY.total(w), p0 = MONEY.S(w).pend; const out = fn(); try { MONEY.flow(w, cat, (MONEY.total(w) - b) - (MONEY.S(w).pend - p0)); } catch (e) {} return out; }

    function S(w) {
        if (!w.procure || typeof w.procure !== 'object') w.procure = { mode: 'usual', dflt: 1 }; // 沒有計畫（新鎮、舊存檔）：先照以前的量，等首長第一次拿主意
        const P = w.procure; if (!MODES.includes(P.mode)) P.mode = 'usual'; if (!PAYS.includes(P.pay)) P.pay = 'even';
        for (const k of ['urg', 'led', 'miss']) if (!P[k] || typeof P[k] !== 'object') P[k] = {};
        P.st = Object.assign({ spent: 0, asks: 0, runs: 0 }, P.st || {}); if (P.cap != null && !(P.cap >= 0)) P.cap = null;
        return P;
    }
    // 首長（照現有的規矩：人在鎮上能拍板的正式首長，不在就是代理）
    function headOf(w) { let m = null; try { m = w.proposals?._mayor?.(w) || w.election?.currentMayor?.(w) || null; } catch (e) { m = null; } return m && inTown(w, m) ? m : null; }

    // ================= 鎮上一天用多少 =================
    // 工匠照配方用掉的料（做得慢的時候少用）、冬天取暖的木材、木匠造紙的木材（紙不到 40 才造）、工具的磨損。算出來的是「照現在的人手，一天大約用掉多少」
    function useOf(w, r) {
        const all = npcs(w); let u = 0; const RC = (typeof JOB_PRODUCTION !== 'undefined') ? JOB_PRODUCTION : {};
        for (const a of all) { const n = RC[a.job?.key]?.inputs?.[r]; if (n) u += n * (typeof FLOW !== 'undefined' ? FLOW.jobDemand(w, a.job.key) : 1); }
        if (r === 'wood' && w.clock?.season === '冬季') u += all.length * 0.3;
        if (r === 'wood' && get(w, 'paper') < 40) { const carp = all.filter(a => a.job?.key === 'carpenter').length; let m = 1; try { m = typeof ECON !== 'undefined' ? ECON.mult(w, 'paper') : 1; } catch (e) {} u += carp * 2.5 * 0.7 * m; }
        if (r === 'tools') u += all.length * 0.05;
        return r1(u);
    }
    const sick = (w) => npcs(w).some(a => a.isSick || (a.health ?? 100) < 50);
    // 買一份多少錢：五種原料照進口價；糧食、藥、工具照商店的價錢；其他（升格要的家具）照向外地訂貨的價錢。買不到的回 null
    function priceOf(w, r) {
        if (IMPORT_PRICE[r]) return IMPORT_PRICE[r];
        const SI = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS[r] : null;
        if (SI && SHOP_GOODS.includes(r)) { let disc = 0; try { disc = w.reputationSystem ? (w.reputationSystem.getModifier('shop_discount') || 0) : 0; } catch (e) {} return Math.max(1, Math.round(SI.buyPrice * (1 - disc))); }
        const bp = (typeof BASE_PRICES !== 'undefined') ? BASE_PRICES[r] : null; return bp != null ? r1(bp * 1.6) : null;
    }

    // ================= 計畫：每樣東西備到多少 =================
    // 回傳 { min 拿得到的量低於這個數才補, upto 補到多少 }；這份計畫不備這一樣就回 null。
    // 「照平常的量」就是以前三套規則的量：原料備到 ECON.rawFloor、糧食低於 60 補到每人 4 份、有人生病時藥低於 3 補到 6、工具低於 2 補到 5
    function line(w, r, mode) {
        mode = mode || S(w).mode; if (mode === 'save') return null;
        if (RAWS.includes(r)) {
            const fl = (typeof ECON !== 'undefined') ? ECON.rawFloor(w, r) : 40;
            if (mode === 'lean') { const u = useOf(w, r); if (!(u > 0.05)) return null; const n = Math.min(fl, Math.max(10, Math.ceil(u * 2))); return { min: n, upto: n }; } // 只備在用的，留兩天份
            return { min: fl, upto: fl };
        }
        if (r === 'food') return { min: 60, upto: Math.max(60, Math.round(npcs(w).length * 4)) };
        if (r === 'medicine') return sick(w) ? { min: 3, upto: 6 } : null;
        if (r === 'tools') return mode === 'lean' ? null : { min: 2, upto: 5 };
        return null;
    }
    // 「只備最要緊的」一週最多花多少：在用的原料七天的量，再留一點給糧食和藥
    function leanCap(w) { let n = 30; for (const r of RAWS) n += useOf(w, r) * WEEK * IMPORT_PRICE[r]; return Math.max(40, Math.ceil(n / 10) * 10); }
    // 這份計畫現在還能動用多少銀幣：公庫留 50（以前三套各留 50、60、80）；計畫有每週上限的再扣掉這週已經花的
    function avail(w) { const P = S(w); if (P.mode === 'save') return 0; let n = silver(w) - KEEP; if (P.cap != null) n = Math.min(n, P.cap - (P.wk?.n || 0)); return Math.max(0, Math.floor(n * 100) / 100); }
    const spent7 = (w) => { const P = S(w), d = day(w); let n = 0; for (const [k, v] of Object.entries(P.led)) if (+k > d - WEEK) n += v; return Math.round(n); };

    // 照計畫今天該買的東西（急的排前面：糧食、藥、在用的原料照還夠幾天排、工具、沒人在用的原料、最後才是替升格多備的料）
    function wants(w) {
        const P = S(w), mode = P.mode, H = sp(w).hold || {}, out = []; if (mode === 'save') return out;
        for (const r of new Set([...WATCH, ...Object.keys(H)])) {
            const price = priceOf(w, r); if (price == null) continue;
            const L = line(w, r, mode), have = get(w, r), lock = lockedOf(w, r), u = useOf(w, r), int = !RAWS.includes(r);
            if (L && have - lock < L.min) {
                const forLine = Math.min(L.upto, L.upto - Math.max(0, have - lock)), forLock = Math.max(0, lock - have);
                const pri = r === 'food' ? 0 : r === 'medicine' ? 1 : r === 'tools' ? 3 : (u > 0.05 ? 2 : 4);
                if (forLine > 0) out.push({ r, need: forLine, price, pri, cover: u > 0.05 ? Math.max(0, have - lock) / u : 99, int, why: RAWS.includes(r) ? '原料進口' : '公庫備貨', cat: RAWS.includes(r) ? 'import_raw' : 'shop' });
                if (forLock > 0) out.push({ r, need: forLock, price, pri: 5, cover: 99, int, why: H[r] ? '為升格備料' : '原料進口', cat: RAWS.includes(r) ? 'import_raw' : 'orders' });
            } else if (!L && H[r] && mode === 'tier' && have < lock) out.push({ r, need: lock - have, price, pri: 5, cover: 99, int, why: '為升格備料', cat: RAWS.includes(r) ? 'import_raw' : 'orders' });
        }
        return out.sort((x, y) => (x.pri - y.pri) || (x.cover - y.cover));
    }
    // 照計畫補貨（算術）。錢不夠買齊就記下來（P.noCash），那是該讓首長知道的事
    function exec(w) {
        const P = S(w), d = day(w), S0 = sp(w); if (!S0) return 0; let total = 0; const shop = [];
        for (const x of wants(w)) {
            const can = avail(w); let q = Math.min(x.need, Math.floor(can / x.price)); if (x.int) q = Math.min(Math.ceil(x.need), Math.floor(can / x.price));
            if (q < x.need - 1e-6 && silver(w) - KEEP < x.need * x.price) P.noCash = d;
            if (!(q > 0)) continue;
            const cost = r1(q * x.price); if (!S0.consume('silver', cost, w.tickCount, t(x.why), 'import')) continue;
            flow(w, x.cat, -cost); S0.add(x.r, q, w.tickCount, t(x.why));
            total += cost; P.led[d] = r2((P.led[d] || 0) + cost); if (P.wk) P.wk.n = r2((P.wk.n || 0) + cost); P.st.spent = r2(P.st.spent + cost);
            if (x.cat === 'shop') shop.push({ r: x.r, qty: q, cost });
        }
        for (const b of shop) log(w, 'economy', '🛒 公庫照採購計畫補了{item} {n} 份（{cost} 銀幣）。', { item: zh(b.r), n: b.qty, cost: Math.round(b.cost) });
        return total;
    }
    // 在用的東西見底了沒有（補貨之後才看：計畫顧得到的，這時候已經補上了）
    function watch(w) {
        const P = S(w), d = day(w), pop = npcs(w).length; const mark = (r, out) => { if (out) { if (P.miss[r] == null) P.miss[r] = d; } else delete P.miss[r]; };
        for (const r of RAWS) { const u = useOf(w, r); mark(r, u > 0.05 && freeOf(w, r) < Math.max(1, u * 0.5)); }
        mark('food', get(w, 'food') < pop && get(w, 'meals') < pop * 1.5);
    }
    const outList = (w) => Object.keys(S(w).miss);

    // ================= 升格 =================
    const tierBusy = (w, st) => (w.proposals?.items || []).some(x => x.kind === 'tier_up' && (st ? x.status === st : (x.status === 'open' || x.status === 'shelved' || x.status === 'approved')));
    function tierInfo(w) {
        if (typeof TIERS === 'undefined' || !TIERS.progress) return null; let pr = null; try { pr = TIERS.progress(w); } catch (e) { return null; }
        if (!pr || !pr.next || !pr.mat || !(pr.streak >= 1)) return null;
        const lack = pr.matLack || {}; let cost = 0; for (const [r, n] of Object.entries(lack)) { const p = priceOf(w, r); if (p != null) cost += n * p; }
        return { next: pr.next, mat: pr.mat, lack, short: Object.keys(lack).length > 0, cost: Math.ceil(cost), ready: pr.streak >= pr.need, lv: (TIERS.S(w).lv || 0) + 1 };
    }
    const techBlock = (w) => { try { return typeof TIERS !== 'undefined' && TIERS.techBlock ? TIERS.techBlock(w) : null; } catch (e) { return null; } };
    // 首長交代學者先顧的科技（給 sim-tech.js 的學者自己挑、提案權重用）；升格不再卡在科技、或過了兩個月就不算數
    function techAsk(w) { const P = w?.procure; const a = P && P.tech; if (!a) return null; const b = techBlock(w); if (!b || b.era !== a.era || day(w) - (a.d || 0) > 60) { P.tech = null; return null; } return a; }
    // 首長保留的料 → 公倉的鎖（每天、以及計畫一改就對一次）。已經升格、升格案通過了（料改由那一案保留）、或鎮上已經一週不夠格，就放回去
    function sync(w) {
        const P = S(w), S0 = sp(w); if (!S0) return P; const d = day(w);
        if (P.hold) {
            let keep = P.mode === 'tier', quiet = P.mode !== 'tier'; const lv = (typeof TIERS !== 'undefined' && TIERS.S) ? (TIERS.S(w).lv || 0) : 0;
            if (P.holdLv != null && P.holdLv !== lv + 1) { keep = false; quiet = true; }
            if (keep && tierBusy(w, 'approved')) { keep = false; quiet = true; }
            if (keep) { let ok = false; try { const pr = TIERS.progress(w); ok = !!(pr && pr.next && pr.streak >= 1); } catch (e) {} if (ok) P.holdIdle = 0; else if (P.holdIdleD !== d) { P.holdIdleD = d; P.holdIdle = (P.holdIdle || 0) + 1; } if ((P.holdIdle || 0) >= WEEK) keep = false; }
            if (!keep) { if (!quiet) log(w, 'economy', '📦 鎮上已經一陣子不夠格升格，為升格保留的{m}放回倉裡，大家可以用了。', { m: { raw: matText(P.hold) } }); P.hold = null; P.holdLv = null; P.holdIdle = 0; if (P.mode === 'tier') P.mode = 'usual'; }
        }
        S0.hold = P.hold ? Object.assign({}, P.hold) : null;
        return P;
    }

    // ================= 該不該問首長 =================
    const planCovers = (w, r) => { const P = S(w); return !!line(w, r) && !(P.cap != null && (P.wk?.n || 0) >= P.cap); };
    function reasons(w) {
        const P = S(w), d = day(w), out = []; const add = (key, topic, gap) => { if (d - (P.urg[key] ?? -99) >= (gap || URG_GAP)) out.push({ key, topic }); };
        const miss = outList(w); const dd = daysOf(w); // 公庫見底：最近發不出全薪、連種子都買不起、在用的料照計畫該買卻買不起、或公庫的錢不夠付一天的薪水與維護
        const broke = (w.wallet?.shortDay ?? -99) >= d - 1 || P.seedMiss === d || (P.noCash === d && miss.some(r => planCovers(w, r))) || (dd != null && dd < 1);
        if (broke) add('broke', 'pay');
        for (const r of miss) if (!planCovers(w, r)) add('out:' + r, 'stock');
        const ti = tierInfo(w); if (ti && ti.ready && ti.short && P.mode !== 'tier' && !tierBusy(w)) add('tierMat', 'stock');
        const tb = techBlock(w); if (tb && !techAsk(w)) add('tierTech', 'tech', TECH_GAP);
        if (P.dflt) add('noplan', 'stock', 2);
        if (!P.dflt && d - (P.d ?? -99) >= WEEK) out.push({ key: 'week', topic: 'stock' });
        return out;
    }
    // 一天最多問一件；上一件還在等回話就先不問。先問最急的那一類：發不出薪水 → 料的事 → 科技
    function ask(w) {
        if (!asking(w)) return null; const P = S(w), d = day(w); const head = headOf(w); if (!head) return null;
        if (P.pend && d - P.pend.d < 2) return null; P.pend = null;
        if (P.lastAsk === d) return null;
        const rs = reasons(w); if (!rs.length) return null;
        const topic = ['pay', 'stock', 'tech'].find(tp => rs.some(x => x.topic === tp)); const why = rs.filter(x => x.topic === topic).map(x => x.key);
        const ctx = { topic, why, d }; P.lastAsk = d; P.pend = { d, topic }; for (const k of why) P.urg[k] = d; P.st.asks++;
        askNow(w, head, 'mayorWeek', ctx);
        return ctx;
    }
    function daily(w) {
        if (!on(w)) return; const P = S(w), d = day(w); if (P.lastDay === d) return; P.lastDay = d;
        for (const k of Object.keys(P.led)) if (+k < d - 14) delete P.led[k];
        sync(w); exec(w); watch(w);
        try { ask(w); } catch (e) { console.warn('[Procure] ask', e); }
    }
    function noteSeed(w) { if (on(w)) S(w).seedMiss = day(w); }

    // ================= 首長拿主意之後 =================
    function setPlan(w, a, mode) {
        const P = S(w), d = day(w); const old = P.mode, hadHold = P.hold; const ti = mode === 'tier' ? tierInfo(w) : null; if (mode === 'tier' && !ti) mode = 'usual';
        P.mode = mode; P.dflt = 0; P.by = a.agentId; P.byName = a.name; P.d = d; P.wk = { d0: d, n: 0 }; P.cap = mode === 'lean' ? leanCap(w) : null; P.pend = null;
        if (mode === 'tier') { P.hold = Object.assign({}, ti.mat); P.holdLv = ti.lv; P.holdIdle = 0; } else { P.hold = null; P.holdLv = null; }
        sync(w);
        if (old !== mode || !P.said) { P.said = 1; log(w, 'council', '📦 {a}定了公庫這週的採購：{x}。', { a: a.name, x: MODE_NAME[mode] }, a.name); }
        if (mode === 'tier' && !hadHold) { log(w, 'economy', '🔒 {a}把{m}留給鎮公所擴建，木匠和取暖都不能動這一批。', { a: a.name, m: { raw: matText(P.hold) } }, a.name); mem(w, a, '我把{m}留給鎮公所擴建，等料齊了就能升格。', { m: { raw: matText(P.hold) } }, 6); }
        else if (mode !== 'tier' && hadHold) log(w, 'economy', '📦 {a}把原本為升格保留的{m}放回倉裡。', { a: a.name, m: { raw: matText(hadHold) } }, a.name);
        const cost = exec(w); watch(w);
        return mode === 'tier' ? { k: '保留了{m}', p: { m: { raw: matText(P.hold) } } } : mode === 'save' ? { k: '這週公庫不買東西' } : cost > 0 ? { k: '照新的計畫補了 {n} 銀幣的貨', p: { n: Math.round(cost) } } : { k: '採購照這個辦' };
    }
    function setPay(w, a, how) {
        const P = S(w); const old = P.pay; P.pay = PAYS.includes(how) ? how : 'even'; P.payBy = a.agentId; P.payD = day(w); P.pend = null;
        if (old !== P.pay) { log(w, 'council', '💸 {a}交代：公庫發不出全薪的時候，{x}。', { a: a.name, x: PAY_NAME[P.pay] }, a.name); for (const o of npcs(w)) if (o !== a && (o.job?.key === 'guard' || o.job?.key === 'doctor') && P.pay === 'care' && Math.random() < 0.5) mem(w, o, '{a}說公庫錢不夠的時候，先發我們的薪水。', { a: a.name }, 5); }
        return { k: '之後錢不夠時：{x}', p: { x: PAY_NAME[P.pay] } };
    }
    // 發不出全薪的時候先發誰（sim-wallet.js 發薪時問）。回傳先領的人的 id；照同一個比例少領就回 null
    function payFirst(w, workers, netOf) {
        const P = w?.procure; if (!P || !on(w) || !P.pay || P.pay === 'even') return null;
        if (P.pay === 'care') return new Set(workers.filter(a => a.job?.key === 'guard' || a.job?.key === 'doctor').map(a => a.agentId));
        const xs = workers.slice().sort((x, y) => netOf(x) - netOf(y)); return new Set(xs.slice(0, Math.ceil(xs.length / 2)).map(a => a.agentId));
    }
    const surplus = (w) => { try { return typeof MONEY !== 'undefined' ? MONEY.surplusList(w) : []; } catch (e) { return []; } };
    const fixedOf = (w) => { try { return typeof TREASURY !== 'undefined' ? TREASURY.fixed(w) : 0; } catch (e) { return 0; } };
    const daysOf = (w) => { try { return typeof TREASURY !== 'undefined' && w.wallet ? TREASURY.days(w) : null; } catch (e) { return null; } };
    const lowNow = (w) => { const d = daysOf(w); return d != null && d < 10; };
    const sellSize = (w) => { const v = surplus(w).reduce((s, g) => s + g.v, 0); return Math.floor(Math.min(v, Math.max(100, fixedOf(w) * 14))); };
    const bondSize = (w) => { try { return typeof FISCAL !== 'undefined' && FISCAL.okNow(w, 'fisc_bond') ? FISCAL.bondOffer(w) : 0; } catch (e) { return 0; } };
    function setTech(w, a, era) {
        const P = S(w), d = day(w); P.pend = null; P.urg.tierTech = d;
        if (!era) { P.tech = null; return null; }
        P.tech = { era, by: a.agentId, d };
        log(w, 'research', '🔬 {a}請學者先把{e}時代的科技研究完：鎮上要升格，就差這幾項。', { a: a.name, e: ERA_ZH[era] || '' }, a.name);
        for (const o of npcs(w)) if (o.job?.key === 'researcher') mem(w, o, '{a}來拜託我們先把{e}時代的科技研究完，鎮上才升得了格。', { a: a.name, e: ERA_ZH[era] || '' }, 6);
        return { k: '學者知道了，下一個題目會先顧這幾項' };
    }

    // ================= 選擇點 mayorWeek：公庫這週怎麼用 =================
    function stockRows(w) {
        const out = [];
        for (const r of WATCH) {
            const have = get(w, r), lock = Math.min(have, lockedOf(w, r)), u = useOf(w, r), p = priceOf(w, r); const bits = [fill('存 {n}', { n: Math.round(have) })];
            if (lock >= 1) bits.push(fill('其中 {n} 是保留的', { n: Math.round(lock) }));
            if (u > 0.05) { bits.push(fill('一天用 {n}', { n: u })); bits.push(fill('夠 {n} 天', { n: Math.floor(Math.max(0, have - lock) / u) })); } else if (RAWS.includes(r)) bits.push(t('現在沒人在用'));
            if (p != null) bits.push(fill('買一份 {n} 銀幣', { n: p }));
            out.push(`${nm(r)}${t('：')}${bits.join(t('、'))}`);
        }
        return out.join(t('；'));
    }
    function waiting(w) {
        const PS = w.proposals; if (!PS?._approvedQueue) return [];
        return PS._approvedQueue().map(p => { const m = PS._shortfall(w, p); delete m.silver; return Object.keys(m).length ? `${p.id}${t('「')}${PS.title ? PS.title(p) : p.id}${t('」')}${t('還缺')}${matText(m)}` : ''; }).filter(Boolean).slice(0, 3);
    }
    function planText(w) {
        const P = S(w); if (P.dflt) return t('照老規矩走，還沒有人拿過主意');
        const cap = P.cap != null ? fill('（一週最多花 {n} 銀幣，已經花了 {m}）', { n: P.cap, m: Math.round(P.wk?.n || 0) }) : '';
        const hold = P.hold ? fill('（保留{m}）', { m: { raw: matText(P.hold) } }) : '';
        return t(MODE_NAME[P.mode]) + cap + hold;
    }
    function mayorFacts(w, a, ctx) {
        const P = S(w), d = day(w), why = ctx?.why || [], dd = daysOf(w);
        const days = dd != null ? fill('夠付 {d} 天的薪水與維護；', { d: Math.floor(dd) }) : '';
        if (ctx?.topic === 'pay') {
            const short = [(w.wallet?.shortDay ?? -99) >= d - 1 ? t('最近發不出全薪。') : '', P.noCash === d ? t('照計畫要買的料，錢不夠買齊。') : '', P.seedMiss === d ? t('連種子都買不起，有田空著。') : ''].join('');
            let pay = 0; try { pay = Math.round(TREASURY.payroll(w)); } catch (e) {}
            const sv = sellSize(w), bn = bondSize(w);
            return fill('公庫只剩 {s} 銀幣。{short}公職一天的薪水要 {p} 銀幣。現在錢不夠時的發法：{pay}。現在的採購：{plan}。{sell}{bond}', { s: Math.round(silver(w)), short: { raw: short }, p: pay, pay: PAY_NAME[P.pay], plan: { raw: planText(w) },
                sell: sv >= 30 ? { k: '倉裡多出來、可以賣到外地的貨大約值 {n} 銀幣（{list}）。', p: { n: sv, list: { raw: surplus(w).slice(0, 4).map(g => `${nm(g.r)} ${g.extra}`).join(t('、')) } } } : { raw: '' }, bond: bn > 0 ? { k: '鎮上的銀行最多可以借 {n} 銀幣，要表決。', p: { n: bn } } : { raw: '' } });
        }
        if (ctx?.topic === 'tech') {
            const tb = techBlock(w); if (!tb) return ''; const cur = w.research?.current ? w.research.projects?.[w.research.current] : null; const ti = (typeof TIERS !== 'undefined') ? TIERS.LV[(TIERS.S(w).lv || 0) + 1] : null;
            return fill('鎮上的人口和繁榮都夠升格為{tier}了，但{e}時代的科技要研究完 {n} 項，現在只有 {k} 項。學者{cur}。學者平常自己排題目，先顧自己那條路線。', { tier: ti ? ti.zh : '', e: ERA_ZH[tb.era] || '', n: tb.need, k: tb.done, cur: cur ? { k: '現在在研究「{p}」', p: { p: cur.name } } : '現在手上沒有題目' });
        }
        const head = why.map(k => k === 'week' ? t('又過了一週，該定公庫這週的採購了。') : k === 'noplan' ? t('公庫的採購一直照老規矩走，還沒有人拿過主意。') : k === 'tierMat' ? t('鎮上已經夠格升格，就差擴建鎮公所的料。') : k.startsWith('out:') ? fill('{item}見底了（已經 {n} 天），現在的採購沒有顧到這一樣。', { item: zh(k.slice(4)), n: Math.max(1, d - (P.miss[k.slice(4)] ?? d) + 1) }) : '').join('');
        const ti = tierInfo(w); const wt = waiting(w);
        return fill('{head}公庫現在 {s} 銀幣，{days}最近七天備貨花了 {n} 銀幣。現在的採購：{plan}。倉裡的情形：{rows}。{tier}{wait}', { head: { raw: head }, s: Math.round(silver(w)), days: { raw: days }, n: spent7(w), plan: { raw: planText(w) }, rows: { raw: stockRows(w) },
            tier: ti ? (ti.short ? { k: '鎮上夠格升格為{tier}：擴建鎮公所要{mat}，還缺{lack}，買齊大約 {n} 銀幣。', p: { tier: ti.next.zh, mat: { raw: matText(ti.mat) }, lack: { raw: matText(ti.lack) }, n: ti.cost } } : { k: '鎮上夠格升格為{tier}，擴建鎮公所的料已經齊了，等提案表決。', p: { tier: ti.next.zh } }) : { raw: '' },
            wait: wt.length ? { k: '通過了、還在等料的提案：{list}。', p: { list: { raw: wt.join(t('；')) } } } : { raw: '' } });
    }
    function mayorOptions(w, a, ctx) {
        if (!on(w) || !ctx || headOf(w) !== a || day(w) - (ctx.d ?? 0) > 2) return [];
        const P = S(w), low = lowNow(w), dd = daysOf(w), out = []; const anyOut = outList(w).length > 0;
        if (ctx.topic === 'pay') {
            out.push({ id: 'even', text: '薪水的發法照舊：錢不夠的時候，大家照同一個比例少領', say: '薪水不夠時大家一起少領', why: '有難大家一起擔，誰也不比誰重要。', base: 1.3, lean: { bond: 0.3, face: 0.2 }, run: (w2, a2) => setPay(w2, a2, 'even') });
            out.push({ id: 'care', text: '錢不夠的時候先發守衛和醫生的薪水，其他人分剩下的', say: '薪水不夠時先發守衛和醫生', why: '守衛和醫生留得住，鎮上才撐得下去。', base: 0.9 + (sick(w) ? 0.4 : 0), lean: { safe: 0.5 }, run: (w2, a2) => setPay(w2, a2, 'care') });
            out.push({ id: 'low', text: '錢不夠的時候先發工資最低的那一半人，其他人分剩下的', say: '薪水不夠時先發工資最低的人', why: '領最少的人最撐不住。', base: 0.5 + (has(a, 'kind') ? 0.6 : 0) + (has(a, 'generous') ? 0.4 : 0), lean: { bond: 0.5 }, run: (w2, a2) => setPay(w2, a2, 'low') });
            const sv = sellSize(w); if (sv >= 30) out.push({ id: 'sell', text: { k: '把倉裡多出來的貨賣到外地，換大約 {n} 銀幣', p: { n: sv } }, say: '把倉裡多出來的貨賣到外地換現金', why: '貨堆著不會生錢，先換成現金救急。', base: 1.6, lean: { gain: 0.4, safe: 0.2 },
                run: (w2) => { S(w2).pend = null; const got = MONEY.sellSurplus(w2, sellSize(w2), t('賣出多餘的貨')); return got > 0 ? { k: '賣了 {n} 銀幣的貨', p: { n: Math.round(got) } } : { k: '沒賣成' }; } });
            const bn = bondSize(w); if (bn > 0) out.push({ id: 'bond', text: { k: '提案向鎮上的銀行借 {n} 銀幣（要大家表決，之後每天付利息）', p: { n: bn } }, say: '提案向銀行借錢', why: '先借錢撐過去，緩過來再還。', base: 0.8, lean: { gain: 0.3, safe: -0.3 },
                run: (w2, a2) => { S(w2).pend = null; const r = FISCAL.askBond ? FISCAL.askBond(w2, a2, '', 'week') : null; const p = r ? r.p : null; return p ? { k: '提了借錢的案，等大家表決' } : r?.asked ? { k: '銀行家沒有答應借' } : { k: '這個案現在提不了' }; /* v11.12.0 借不借先問銀行家 */ } });
            if (P.mode !== 'save') out.push({ id: 'stop', text: '這週先不買料，錢留著發薪水', say: '這週不買料，錢留著發薪水', why: '人的薪水比倉裡的料要緊。', base: 0.9 - (anyOut ? 1.5 : 0), lean: { safe: 0.4 }, run: (w2, a2) => setPlan(w2, a2, 'save') });
            return out;
        }
        if (ctx.topic === 'tech') {
            const tb = techBlock(w); if (!tb) return [];
            return [{ id: 'ask', text: { k: '請學者先把{e}時代的科技研究完（升格還差 {n} 項）', p: { e: ERA_ZH[tb.era] || '', n: Math.max(1, tb.need - tb.done) } }, say: { k: '請學者先研究{e}時代的科技', p: { e: ERA_ZH[tb.era] || '' } }, why: '科技跟不上，鎮上就升不了格。', base: 1.6 + (has(a, 'ambitious') ? 0.5 : 0), lean: { face: 0.4, gain: 0.3 }, run: (w2, a2) => setTech(w2, a2, tb.era) },
                { id: 'leave', text: '研究的事讓學者自己安排', say: '研究的事讓學者自己排', why: '學問的事，外行人少插手。', base: 1.0 + (hasV(a, '自由') ? 0.4 : 0) + (hasV(a, '知識') ? 0.3 : 0), lean: { bond: 0.2 }, run: (w2, a2) => setTech(w2, a2, 0) }];
        }
        const ti = tierInfo(w); const busy = tierBusy(w, 'approved'); const veryLow = dd != null && dd < 3;
        const leanSet = RAWS.filter(r => useOf(w, r) > 0.05); const cap = leanCap(w);
        out.push({ id: 'usual', text: { k: '照平常的量備貨：每樣都備到平常的量，缺多少補多少，公庫至少留 {k} 銀幣', p: { k: KEEP } }, say: '這週照平常的量備貨', why: '料備足了，大家做事才不會停。', base: 1.7 + (anyOut ? 0.6 : 0) - (low ? 0.9 : 0), lean: { bond: 0.3, safe: 0.2 }, run: (w2, a2) => setPlan(w2, a2, 'usual') });
        out.push({ id: 'lean', text: { k: '只備最要緊的：糧食、藥，還有鎮上真的在用的料（{list}）各留兩天份；這週最多花 {n} 銀幣', p: { list: { raw: leanSet.length ? leanSet.map(nm).join(t('、')) : t('現在沒有') }, n: cap } }, say: '這週只備最要緊的料', why: '錢要省著用，先顧最要緊的。', base: 0.5 + (low ? 1.6 : 0) + (has(a, 'thrifty') ? 0.5 : 0) + (has(a, 'greedy') ? 0.3 : 0), lean: { safe: 0.7 }, run: (w2, a2) => setPlan(w2, a2, 'lean') });
        if (ti && !busy) { // 料已經齊了也可以選：把它留住，免得表決前被用掉
            const can = silver(w) - KEEP >= ti.cost;
            out.push({ id: 'tier', text: ti.short ? { k: '為升格備料：把{mat}留給鎮公所擴建（木匠、取暖都不能動），還缺的{lack}由公庫買齊，大約 {n} 銀幣；其他照平常備', p: { mat: { raw: matText(ti.mat) }, lack: { raw: matText(ti.lack) }, n: ti.cost } } : { k: '升格的料已經齊了：把{mat}留給鎮公所擴建（木匠、取暖都不能動），其他照平常備', p: { mat: { raw: matText(ti.mat) } } },
                say: { k: '為升格成{tier}備料', p: { tier: ti.next.zh } }, why: '鎮上夠格升格了，料備齊就能動工。', base: (ti.short ? 1.5 + (can ? 1.0 : -1.0) : 2.6) + (has(a, 'ambitious') ? 0.5 : 0) - (low ? 1.2 : 0), lean: { face: 0.5, gain: 0.4, safe: -0.3 }, run: (w2, a2) => setPlan(w2, a2, 'tier') });
        }
        out.push({ id: 'save', text: '這週什麼都不買，把錢存下來（料用完就沒有了）', say: '這週不買東西，把錢存下來', why: '公庫要先留得住錢。', base: -0.4 + (veryLow ? 2.2 : low ? 0.8 : 0) - (anyOut ? 2.5 : 0), lean: { safe: 0.6, bond: -0.5 }, run: (w2, a2) => setPlan(w2, a2, 'save') });
        return out;
    }

    // ================= 沒人顧到的缺口：村民可以提案 =================
    // 在用的東西見底、首長的計畫又沒顧到（或已經缺了兩天）：變成「進一批某某」的提案點子。提案系統本來就照誰最在意排（用這樣料的那一行、商人、首長）
    function candidates(w, PS, d, out) {
        if (!on(w)) return; const P = S(w); const SI = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : {}; const have = silver(w);
        for (const r of outList(w)) {
            if (!SI[r]) continue; const since = d - (P.miss[r] ?? d); if (planCovers(w, r) && since < 2) continue;
            const key = 'market:buy:' + r; const jobs = [...(USERS[r] || []), 'trader', 'mayor']; const ex = out.find(c => c.key === key);
            if (ex) { ex.weight = Math.max(ex.weight || 0, 4); ex.jobs = [...new Set([...(ex.jobs || []), ...jobs])]; continue; }
            const qty = Math.max(20, Math.ceil(useOf(w, r) * 5)), price = SI[r].buyPrice * qty; if (have < price || !PS._cool(d, key, 4)) continue;
            out.push({ kind: 'market', key, weight: 4, jobs, make: (a) => ({ kind: 'market', key, refKey: r, qty, side: 'buy', tk: '進一批{item}備料', tp: { item: SI[r].name() }, dk: '{item}見底了，公庫這週的採購沒有顧到這一樣。{who}提議從公庫撥 {n} 銀幣去商店進 {qty} 份。', dp: { item: SI[r].name(), who: a.name, n: price, qty }, cost: { silver: price }, category: 'economy', jobBias: jobs }) });
        }
    }

    // ================= 選擇點 tradeRun：這趟買賣什麼 =================
    const AUTO = () => (typeof VillagerAutonomy !== 'undefined' ? VillagerAutonomy.prototype : null);
    const keepOf = (w, r) => { const A = w.autonomy || AUTO(); return A && A._keepOf ? A._keepOf.call(A, w, r) : 20; };
    const lowOf = (w, r) => { const A = w.autonomy || AUTO(); return A && A._lowOf ? A._lowOf.call(A, w, r) : 5; };
    const skill = (a) => { try { return a.skills?.get?.('社交')?.level || 0; } catch (e) { return 0; } };
    // 誰出面談：私人商行是東家；公營的話是掌櫃（沒有掌櫃就手腕最好的商人）；鎮上沒有商人就是首長
    function dealerOf(w) {
        let own = null; try { own = (typeof MARKET !== 'undefined' && w.market && typeof WALLET !== 'undefined' && w.wallet) ? w.agents[MARKET.ownerOf(w, 'trade')] : null; } catch (e) { own = null; }
        if (own && inTown(w, own)) return { a: own, role: 'owner' };
        const ts = npcs(w).filter(a => a.job?.key === 'trader' && (a.age ?? 30) >= 16 && inTown(w, a));
        if (ts.length) return { a: ts.find(a => a.agentId === w.money?.mgr) || ts.sort((x, y) => skill(y) - skill(x) || (y.age || 0) - (x.age || 0))[0], role: 'trader' };
        const h = headOf(w); return h ? { a: h, role: 'head' } : null;
    }
    // 照首長的計畫，這樣貨想跟行商買幾份（0＝不買）。計畫本來就會備的東西，行商比公庫自己買便宜才跟他買；升格還缺的料也一樣
    function wantFrom(w, r, price) {
        const P = S(w), mode = P.mode; if (mode === 'save') return 0;
        const L = line(w, r), alt = priceOf(w, r), H = sp(w).hold || {}, free = freeOf(w, r), cheap = alt == null || price <= alt; let want = 0;
        if (L) { const low = mode === 'lean' ? L.min : Math.max(L.min, lowOf(w, r)); if (free < low && cheap) want = Math.ceil((mode === 'lean' ? L.upto : Math.max(L.upto, lowOf(w, r) * 1.5)) - free); }
        else if (!RAWS.includes(r) && mode !== 'lean') { const low = lowOf(w, r); if (free < low) want = Math.ceil(low * 1.5 - free); } // 計畫沒管的貨（作物、茶葉…）：用得到又見底才買
        if (H[r] && get(w, r) < lockedOf(w, r) && cheap) want = Math.max(want, Math.ceil(lockedOf(w, r) - get(w, r)));
        return Math.max(0, want);
    }
    // 跟行商這一天可以做的買賣（算術）。sell：'half' 多出來的賣一半（一天最多進帳 100）、'all' 多出來的全賣（最多 250）；buy：照計畫買
    function merchantPlan(w, m, how) {
        const sells = [], buys = [];
        if (how.sell) { const all = how.sell === 'all', cap = all ? 250 : 100; let earned = 0;
            for (let i = m.offers.length - 1; i >= 0; i--) { const o = m.offers[i]; if (!o || !o.isBuying || earned >= cap) continue;
                const extra = freeOf(w, o.resource) - keepOf(w, o.resource); const qty = Math.min(Math.floor(o.amount), Math.floor(extra * (all ? 1 : 0.5)), all ? 60 : 25);
                const q2 = Math.min(qty, Math.floor((cap - earned) / Math.max(0.1, o.price))); if (q2 >= 3) { sells.push({ o, r: o.resource, qty: q2, price: o.price }); earned += q2 * o.price; } } }
        if (how.buy) { let left = how.budget != null ? how.budget : avail(w);
            for (let i = m.offers.length - 1; i >= 0; i--) { const o = m.offers[i]; if (!o || o.isBuying) continue;
                const want = wantFrom(w, o.resource, o.price); if (!(want > 0)) continue;
                const qty = Math.min(Math.floor(o.amount), want, Math.floor(left / Math.max(0.1, o.price))); if (qty >= 2) { buys.push({ o, r: o.resource, qty, price: o.price }); left -= qty * o.price; } } }
        return { sells, buys, earn: Math.round(sells.reduce((s, x) => s + x.qty * x.price, 0)), cost: Math.round(buys.reduce((s, x) => s + x.qty * x.price, 0)) };
    }
    const HOW = { deal: { sell: 'half', buy: true }, sell: { sell: 'half', buy: false }, buy: { sell: '', buy: true }, clear: { sell: 'all', buy: true } };
    // 真的成交（先賣再買；買貨的錢不超過計畫還能動用的）。回傳成交的清單
    function dealMerchant(w, mode, who) {
        const tr = w.trade, m = tr?.merchant; if (!m || !m.offers?.length) return [];
        if (mode === 'refuse') return [];
        if (mode === 'house') { const o = { budget: avail(w) }; flowed(w, 'merchant', () => { try { TRADE.privateTrade(w, o); } catch (e) { console.warn('[Procure] house', e); } });
            const P = S(w), d = day(w), paid = r2((o.deals || []).reduce((s, x) => s + (x[4] || 0), 0)); if (paid > 0) { P.led[d] = r2((P.led[d] || 0) + paid); if (P.wk) P.wk.n = r2((P.wk.n || 0) + paid); P.st.spent = r2(P.st.spent + paid); } // 公庫收進口貨花的錢也算在這週的採購裡
            return (o.deals || []).map(x => ({ type: x[0] === 'imp' ? 'buy' : 'sell', r: x[1], qty: x[2], silver: x[3], house: 1 })); }
        const how = HOW[mode] || HOW.deal; const deals = [];
        const run = (x, type) => { const i = m.offers.indexOf(x.o); if (i < 0) return; const r = tr.executeTrade(i, x.qty, w); if (r?.ok) { deals.push({ type, r: x.r, qty: x.qty, silver: Math.round(x.qty * x.price) }); try { if (typeof TRADE !== 'undefined') TRADE.rec(w, type === 'sell' ? 'exp' : 'imp', x.r, x.qty, x.qty * x.price); } catch (e) {} if (type === 'buy') { const P = S(w), d = day(w), c = r2(x.qty * x.price); P.led[d] = r2((P.led[d] || 0) + c); if (P.wk) P.wk.n = r2((P.wk.n || 0) + c); P.st.spent = r2(P.st.spent + c); } } };
        flowed(w, 'merchant', () => {
            if (how.sell) for (const x of merchantPlan(w, m, { sell: how.sell }).sells) run(x, 'sell');
            if (how.buy) for (const x of merchantPlan(w, m, { buy: true }).buys) run(x, 'buy');
        });
        if (deals.length) { try { (w.autonomy || AUTO())?._dealNote?.call(w.autonomy || AUTO(), w, who, m, deals); } catch (e) { console.warn('[Procure] note', e); } }
        return deals;
    }
    const houseText = (d) => fill(d[0] === 'imp' ? '進口 {x}' : '出口 {x}', { x: { raw: `${nm(d[1])}×${d[2]}` } });
    const houseDeals = (w) => { try { return TRADE.privateTrade(w, { dry: true, budget: avail(w) }) || []; } catch (e) { return []; } };
    // 行商在鎮上的每一天：還沒人談過就去問出面的人（一趟問一次）；談定了就照他說的做（之後幾天是算術）
    function merchantDay(w) {
        const m = w.trade?.merchant; if (!m || !m.offers?.length) return; const d = day(w);
        if (m._run) { if (m._run.d !== d && m._run.mode !== 'refuse') dealMerchant(w, m._run.mode, w.agents[m._run.by] || null); return; }
        if (m._asked != null && d - m._asked < 2) return; // 還在等他回話
        const D = dealerOf(w); if (!D) return; // 鎮上沒有人可以出面：這趟就沒有人跟他談
        if (!asking(w)) { m._run = { mode: D.role === 'owner' ? 'house' : 'deal', by: D.a.agentId, d }; dealMerchant(w, m._run.mode, D.a); return; } // 決策核心還沒開（開鎮第一天錢包還沒建好）：照計畫做
        const any = D.role === 'owner' ? houseDeals(w).length : (() => { const p = merchantPlan(w, m, { sell: 'all', buy: true }); return p.sells.length + p.buys.length; })();
        if (!any) return; // 沒有可以賣的、計畫也沒有要買的：不用談，明天再看
        m._asked = d; S(w).st.runs++;
        askNow(w, D.a, 'tradeRun', { t: 'm', m: m.name, role: D.role, d });
    }
    // 跨鎮商隊到了：有人可以出面、決策核心開著，就交給他決定（回 true）；不然回 false，照老規矩換
    function caravanAsk(w, offer) {
        if (!asking(w)) return false; const D = dealerOf(w); if (!D) return false; const d = day(w);
        S(w).st.runs++; askNow(w, D.a, 'tradeRun', { t: 'c', o: offer, role: D.role, d }); return true;
    }
    const base = (r) => (typeof BASE_PRICES !== 'undefined' && BASE_PRICES[r]) || 0;
    // 這位行商的價錢好不好：他收貨的價錢跟外地行情比、他賣貨的價錢跟公庫自己買的價錢比。回傳 -1（很差）到 1（很好）
    function priceMood(w, m, pl) {
        const xs = []; for (const x of pl.sells) { const b = base(x.r); if (b) xs.push(Math.max(-1, Math.min(1, (x.price / b - 0.65) / 0.15))); }
        for (const x of pl.buys) { const alt = priceOf(w, x.r) || base(x.r) * 1.6; if (alt) xs.push(Math.max(-1, Math.min(1, (1 - x.price / alt) / 0.25))); }
        return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
    }
    // 真模型實測：出面談的人會把自己手頭緊（「身上只剩 2 銀幣、房租快到了」）當成這趟買賣的理由，甚至因此只換一半。講明白這趟動的是公庫的錢和貨
    const PUB = () => ({ raw: t('這是替鎮上做的買賣：付的是公庫的錢、動的是倉裡的貨，跟你自己口袋裡有多少錢沒有關係。') });
    function tradeFacts(w, a, ctx) {
        if (ctx?.t === 'c') { const o = ctx.o || {}; const u = (r) => { const n = useOf(w, r); return n > 0.05 ? { k: '（一天用 {n}）', p: { n } } : { raw: '' }; }; const hub = (o.mk ? Math.ceil(o.giveAmt * 0.2) : 0) + (o.rt ? Math.ceil(o.giveAmt * 0.2) : 0);
            return fill('{town}的商隊到了，想用他們的{r}換鎮上的{g}：{ga} 份{g}換 {ra} 份{r}。倉裡拿得到的{g}有 {n1}{u1}，{r}有 {n2}{u2}。公庫現在的採購：{plan}。{pub}', { pub: PUB(), town: o.town || '', g: zh(o.give), r: zh(o.recv), ga: o.giveAmt, ra: o.giveAmt + hub, n1: Math.round(Math.max(0, freeOf(w, o.give))), u1: u(o.give), n2: Math.round(Math.max(0, freeOf(w, o.recv))), u2: u(o.recv), plan: { raw: planText(w) } }); }
        const m = w.trade?.merchant; if (!m) return '';
        const mine = (r) => RAWS.includes(r) || SHOP_GOODS.includes(r) || !!(sp(w).hold || {})[r]; // 公庫自己會去買的東西才有得比價
        const rate = (o, isBuying) => { const alt = isBuying ? base(o.resource) : (mine(o.resource) ? priceOf(w, o.resource) : 0); return nm(o.resource) + ' ' + o.price + (alt ? fill(isBuying ? '（外地行情 {n}）' : '（公庫自己買 {n}）', { n: alt }) : ''); };
        const he = (isBuying) => m.offers.filter(o => !!o.isBuying === isBuying).slice(0, 7).map(o => rate(o, isBuying)).join(t('、')) || t('沒有');
        if (ctx?.role === 'owner') { const ds = houseDeals(w); const txt = ds.map(houseText).join(t('、')) || t('沒有');
            return fill('商人{m}到了，再待 {n} 天。他收的：{buys}。他賣的：{sells}。你的商行照老算盤（外地貨落地比本地便宜一成以上又缺才進，外地開價比本地高一成以上又多才出）算得出來的：{deals}，大約賺 {g} 銀幣。你手上有 {c} 銀幣；進口的貨由公庫照本地價收，照首長的採購計畫，公庫這趟最多拿 {b} 銀幣。', { m: m.name, n: m.daysRemaining || 1, buys: { raw: he(true) }, sells: { raw: he(false) }, deals: { raw: txt }, g: ds.reduce((s, d) => s + d[3], 0), c: Math.round(typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0), b: Math.round(avail(w)) }); }
        const pl = merchantPlan(w, m, { sell: 'half', buy: true });
        return fill('商人{m}到了，再待 {n} 天。他收的：{buys}。他賣的：{sells}。倉裡多出來、可以賣他的：{sur}。公庫現在的採購是「{plan}」；照計畫要跟他買的：{want}。買貨的預算還有 {b} 銀幣（公庫 {s} 銀幣）。{pub}', { pub: PUB(), m: m.name, n: m.daysRemaining || 1, buys: { raw: he(true) }, sells: { raw: he(false) }, sur: { raw: pl.sells.length ? listText(pl.sells) : t('沒有') }, plan: { raw: planText(w) }, want: { raw: pl.buys.length ? listText(pl.buys) : t('沒有') }, b: Math.round(avail(w)), s: Math.round(silver(w)) });
    }
    function tradeOptions(w, a, ctx) {
        if (!on(w) || !ctx || !inTown(w, a) || day(w) - (ctx.d ?? 0) > 2) return [];
        if (ctx.t === 'c') {
            const o = ctx.o; if (!o || ctx.done || !w._caravanSwap) return []; const freeG = Math.max(0, freeOf(w, o.give)); const amt = Math.min(o.giveAmt, Math.floor(freeG)); if (amt < 2) return [];
            const hubOf = (n) => (o.mk ? Math.ceil(n * 0.2) : 0) + (o.rt ? Math.ceil(n * 0.2) : 0); const half = Math.max(1, Math.floor(amt / 2));
            const Lg = line(w, o.give), Lr = line(w, o.recv); const giveShort = (Lg && freeG - amt < Lg.min) || outList(w).includes(o.give); const needRecv = (Lr && freeOf(w, o.recv) < Lr.upto * 1.5) || (typeof FLOW !== 'undefined' && FLOW.need(w, o.recv) > 0.3);
            const swap = (n) => (w2, a2) => { if (ctx.done) return null; ctx.done = 1; const r = flowed(w2, 'caravan', () => w2._caravanSwap(o, n)); if (!r) return { k: '沒換成' }; mem(w2, a2, '{town}的商隊來了，我作主拿 {ga} 份{g}換了 {ra} 份{r}。', { town: o.town, ga: r.giveAmt, g: zh(o.give), ra: r.recvAmt, r: zh(o.recv) }, 4); return { k: '換到 {n} 份{r}', p: { n: r.recvAmt, r: zh(o.recv) } }; };
            return [{ id: 'swap', text: { k: '照對方開的換：拿 {ga} 份{g}換 {ra} 份{r}', p: { ga: amt, g: zh(o.give), ra: amt + hubOf(amt), r: zh(o.recv) } }, say: { k: '跟{town}的商隊換貨', p: { town: o.town } }, why: '有來有往，兩邊都好。', base: 1.5 + (needRecv ? 0.5 : 0) - (giveShort ? 1.2 : 0), lean: { bond: 0.3, gain: 0.2 }, run: swap(amt) },
                { id: 'half', text: { k: '只換一半：拿 {ga} 份{g}換 {ra} 份{r}', p: { ga: half, g: zh(o.give), ra: half + hubOf(half), r: zh(o.recv) } }, say: { k: '跟{town}的商隊只換一半', p: { town: o.town } }, why: '換一點就好，自己的貨多留一些。', base: 0.8 + (giveShort ? 0.3 : 0), lean: { safe: 0.3 }, run: swap(half) },
                { id: 'refuse', text: { k: '不換，{g}自己留著', p: { g: zh(o.give) } }, say: { k: '沒跟{town}的商隊換貨', p: { town: o.town } }, why: { k: '{g}鎮上自己要用。', p: { g: zh(o.give) } }, base: 0.2 + (giveShort ? 1.4 : 0) + (needRecv ? 0 : 0.4), lean: { safe: 0.3, face: 0.2 },
                    run: (w2, a2) => { if (ctx.done) return null; ctx.done = 1; log(w2, 'trade', '🐪 {town}的商隊來了，{a}看了看，沒有換貨。', { town: o.town, a: a2.name }, a2.name); return { k: '商隊空手回去了' }; } }];
        }
        const m = w.trade?.merchant; if (!m || m.name !== ctx.m || m._run || !m.offers?.length) return [];
        const set = (mode) => (w2, a2) => { const m2 = w2.trade?.merchant; if (!m2 || m2._run) return null; m2._run = { mode, by: a2.agentId, d: day(w2) }; const deals = dealMerchant(w2, mode, a2);
            if (mode === 'refuse') { log(w2, 'trade', '🧭 {a}看了商人{m}的貨和價錢，這趟沒有跟他做生意。', { a: a2.name, m: m2.name }, a2.name); mem(w2, a2, '商人{m}來了，價錢我看不上，這趟沒跟他做生意。', { m: m2.name }, 4); return { k: '這趟沒有成交' }; }
            const sold = deals.filter(x => x.type === 'sell').reduce((s, x) => s + x.silver, 0), bought = deals.filter(x => x.type === 'buy').reduce((s, x) => s + x.silver, 0);
            return !deals.length ? { k: '今天沒談成什麼' } : mode === 'house' ? { k: '商行做成了 {n} 筆，賺了 {g} 銀幣', p: { n: deals.length, g: deals.reduce((s, x) => s + x.silver, 0) } } : { k: '賣了 {a} 銀幣的貨、買了 {b} 銀幣的貨', p: { a: sold, b: bought } }; };
        const low = lowNow(w), anyOut = outList(w).length > 0;
        if (ctx.role === 'owner') { const ds = houseDeals(w); if (!ds.length) return []; const g = ds.reduce((s, d) => s + d[3], 0);
            return [{ id: 'house', text: { k: '照商行的算盤做：{deals}（大約賺 {g} 銀幣）', p: { deals: { raw: ds.map(houseText).join(t('、')) }, g } }, say: { k: '商行跟商人{m}做進出口', p: { m: m.name } }, why: '有價差就做，商行靠的就是這個。', base: 1.6 + Math.min(0.8, g / 40), lean: { gain: 0.5 }, run: set('house') },
                { id: 'refuse', text: '這趟不做，等下一位商人', say: { k: '這趟沒跟商人{m}做生意', p: { m: m.name } }, why: '這點價差不值得跑一趟。', base: 0.3, lean: { safe: 0.3, face: 0.2 }, run: set('refuse') }]; }
        const pl = merchantPlan(w, m, { sell: 'half', buy: true }), all = merchantPlan(w, m, { sell: 'all', buy: true }); if (!all.sells.length && !all.buys.length) return [];
        const pm = priceMood(w, m, all); const out = []; const sT = (p) => ({ raw: listText(p.sells) }), bT = (p) => ({ raw: listText(p.buys) });
        if (pl.sells.length && pl.buys.length) {
            out.push({ id: 'deal', text: { k: '照計畫做：多出來的賣一半（{s}，約進帳 {e} 銀幣），計畫缺的買進來（{b}，約 {c} 銀幣）', p: { s: sT(pl), e: pl.earn, b: bT(pl), c: pl.cost } }, say: { k: '跟商人{m}照計畫買賣', p: { m: m.name } }, why: '多的賣掉、缺的買進來，照計畫走。', base: 1.5 + 0.4 * pm, lean: { gain: 0.3, bond: 0.2 }, run: set('deal') });
            out.push({ id: 'sell', text: { k: '只賣不買：{s}（約進帳 {e} 銀幣）', p: { s: sT(pl), e: pl.earn } }, say: { k: '只賣貨給商人{m}，不買', p: { m: m.name } }, why: '他賣的不划算，貨賣給他就好。', base: 0.6 + 0.2 * pm + (low ? 0.6 : 0), lean: { gain: 0.3, safe: 0.2 }, run: set('sell') });
            out.push({ id: 'buy', text: { k: '只買不賣：{b}（約 {c} 銀幣）', p: { b: bT(pl), c: pl.cost } }, say: { k: '只跟商人{m}買貨，不賣', p: { m: m.name } }, why: '他收的價錢太低，貨先留著。', base: 0.5 + 0.2 * pm + (anyOut ? 0.6 : 0), lean: { safe: 0.3 }, run: set('buy') });
        } else if (pl.sells.length) out.push({ id: 'sell', text: { k: '多出來的賣一半：{s}（約進帳 {e} 銀幣）', p: { s: sT(pl), e: pl.earn } }, say: { k: '把多出來的貨賣給商人{m}', p: { m: m.name } }, why: '貨堆著也是堆著，換成現金。', base: 1.5 + 0.4 * pm, lean: { gain: 0.3, bond: 0.2 }, run: set('sell') });
        else if (pl.buys.length) out.push({ id: 'buy', text: { k: '照計畫買：{b}（約 {c} 銀幣）', p: { b: bT(pl), c: pl.cost } }, say: { k: '照計畫跟商人{m}買貨', p: { m: m.name } }, why: '計畫要的料，他剛好有。', base: 1.5 + 0.4 * pm, lean: { safe: 0.3, bond: 0.2 }, run: set('buy') });
        if (all.sells.length && all.earn > pl.earn + 10) out.push({ id: 'clear', text: { k: '多賣一點：多出來的全賣（{s}，約進帳 {e} 銀幣）{b}', p: { s: sT(all), e: all.earn, b: all.buys.length ? { k: '，計畫缺的照買', p: {} } : { raw: '' } } }, say: { k: '把多出來的貨全賣給商人{m}', p: { m: m.name } }, why: '公庫要現金，多的全賣了。', base: 0.2 + 0.3 * pm + (low ? 1.3 : 0) + (has(a, 'greedy') ? 0.4 : 0), lean: { gain: 0.5 }, run: set('clear') });
        out.push({ id: 'refuse', text: '價錢不好，這趟不跟他做生意', say: { k: '這趟沒跟商人{m}做生意', p: { m: m.name } }, why: '這個價錢做了是吃虧。', base: 0.3 - 1.1 * pm + (has(a, 'abrasive') ? 0.3 : 0), lean: { face: 0.3, safe: 0.2 }, run: set('refuse') });
        return out;
    }

    // ================= v11.6.0 公倉多出來的貨賣不賣（選擇點 surplus，登記在 sim-decide-pol.js） =================
    // 以前倉裡超過門檻的啤酒、葡萄酒、家具、麵包、衣物每天自動賣 6 份（留 50），日誌隨機掛一位商人的名字，其實沒有人決定。
    // 現在有貨超過門檻時，問出面談生意的人（跟行商來時去談的是同一個人，dealerOf）：照原本的速度賣／只賣一半（一天 3 份，賣到剩門檻與 50 的中間）／先留著不賣。
    // 一週最多問一次，決定管七天；錢照舊進公庫。日誌只在他真的拿過主意時掛他的名字；沒人可問、決策核心沒開、等回話等到隔天，照原本的規則賣、不掛人名。
    // 提案「把多出來的貨賣掉」照舊（那是全鎮表決的結果，他選了留著也照賣）；提案當天剛賣過的那一樣，這裡不再自動賣
    const SUR = ['beer', 'wine', 'furniture', 'bread', 'clothing'];
    const SUR_NAME = { sell: '把多出來的賣掉', half: '只賣一半', keep: '先留著不賣' };
    const lineOf = (w, r, old) => (typeof FLOW !== 'undefined' && FLOW.keepLine) ? FLOW.keepLine(w, r, old) : old; // 跟原本一樣：城鎮以上看鎮上想備的量，村莊照舊 80／50
    const SIs = () => (typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : {});
    const overList = (w) => SUR.filter(r => SIs()[r] && get(w, r) > lineOf(w, r, 80)).sort((a, b) => get(w, b) - get(w, a));
    const midOf = (w, r) => Math.round((lineOf(w, r, 80) + lineOf(w, r, 50)) / 2);
    const soldByVote = (w, r, d) => (w.proposals?.items || []).some(p => p.kind === 'market' && p.side === 'sell' && p.refKey === r && p.status === 'done' && p.resolvedDay === d);
    function surPlan(w) { const X = S(w).sur; const d = day(w); return X && SUR_NAME[X.mode] && d - X.d < WEEK && d >= X.d ? X : null; }
    // 每天（商店那一段，sim-autonomy.js 呼叫）：回 true 表示這裡處理了（觀察者模式），原本那一段就不跑
    function surplusDay(w, A) {
        if (!on(w) || !w.shop?.sell) return false; const P = S(w), d = day(w); if (P.surDay === d) return true; P.surDay = d;
        const items = overList(w).filter(r => !soldByVote(w, r, d)); if (!items.length) return true;
        let plan = surPlan(w);
        if (!plan && asking(w)) {
            if (P.surAsk == null || d - P.surAsk >= WEEK) { const D = dealerOf(w); if (D) { P.surAsk = d; P.st.surAsks = (P.st.surAsks || 0) + 1; askNow(w, D.a, 'surplus', { d, by: D.a.agentId }); plan = surPlan(w); if (!plan) return true; } } // 問 AI 的等回話，今天先不賣
            else if (P.surAsk === d) return true;
        }
        const mode = plan ? plan.mode : 'sell'; if (mode === 'keep') return true;
        const r = items[0]; const floor = mode === 'half' ? midOf(w, r) : lineOf(w, r, 50); const qty = Math.min(mode === 'half' ? 3 : 6, Math.floor(get(w, r) - floor)); if (qty < 1) return true;
        const SI = SIs(); const res = w.shop.sell(r, qty, w); if (!res?.success) return true;
        const gain = qty * SI[r].sellPrice; P.st.surSold = (P.st.surSold || 0) + qty; P.st.surGain = r2((P.st.surGain || 0) + gain);
        const who = plan ? (w.agents[plan.by] || null) : null; const tp = { who: who?.name || '', item: SI[r].name(), n: qty, gain };
        try { if (who) A._note(w, who, '💰 {who}把倉裡多出來的{item} {n} 份拿去賣了，進帳 {gain} 銀幣。', tp, 4, 'economy', 3); else A._note(w, null, '💰 公倉把多出來的{item} {n} 份賣給商店，進帳 {gain} 銀幣。', tp, 4, 'economy', 3); } catch (e) {}
        return true;
    }
    const surLive = (w, a, ctx) => !!ctx && on(w) && inTown(w, a) && day(w) - (ctx.d ?? 0) <= 1 && dealerOf(w)?.a === a && !surPlan(w) && overList(w).length > 0;
    function surFacts(w, a, ctx) {
        if (!surLive(w, a, ctx)) return ''; const SI = SIs(); const dd = daysOf(w);
        const list = overList(w).map(r => fill('{item} {n} 份（超過 {line} 份算多，照老規矩賣到剩 {keep}；商店收一份 {p} 銀幣）', { item: SI[r].name(), n: Math.round(get(w, r)), line: Math.round(lineOf(w, r, 80)), keep: Math.round(lineOf(w, r, 50)), p: SI[r].sellPrice })).join(t('；'));
        return fill('倉裡有幾樣東西堆得比平常多：{list}。照老規矩，多出來的每天挑一樣拿去商店賣，一次最多 6 份，賣得的錢進公庫。{pub}公庫現在 {s} 銀幣{days}。這一週要不要賣、賣多少，由你決定。',
            { list: { raw: list }, pub: PUB(), s: Math.round(silver(w)), days: { raw: dd != null ? fill('，夠付 {d} 天的薪水與維護', { d: Math.floor(dd) }) : '' } });
    }
    function setSur(w, a, mode) { const P = S(w); P.sur = { mode, d: day(w), by: a.agentId, byName: a.name }; log(w, 'economy', '🧾 {a}看了倉裡多出來的貨，這一週決定{x}。', { a: a.name, x: SUR_NAME[mode] }, a.name); return { k: '這一週{x}', p: { x: SUR_NAME[mode] } }; }
    function surOptions(w, a, ctx) {
        if (!surLive(w, a, ctx)) return []; const items = overList(w); const low = lowNow(w); let need = false; try { need = typeof FLOW !== 'undefined' && items.some(r => FLOW.need(w, r) > 0.3); } catch (e) {}
        const go = (mode) => (w2, a2) => (surLive(w2, a2, ctx) ? setSur(w2, a2, mode) : null); const r0 = items[0];
        return [{ id: 'sell', text: '把多出來的賣掉：照平常的速度，一天最多 6 份', say: '把公倉多出來的貨賣掉', why: '貨堆著也是堆著，換成現金進公庫。', base: 1.6 + (low ? 0.5 : 0), lean: { gain: 0.3, bond: 0.1 }, run: go('sell') },
            { id: 'half', text: { k: '只賣一半：一天最多 3 份，{item}賣到剩 {n} 份就停', p: { item: SIs()[r0].name(), n: midOf(w, r0) } }, say: '公倉多出來的貨只賣一半', why: '賣一點換現金，也留一點備著。', base: 0.4 + (has(a, 'thrifty') ? 0.3 : 0) + (need ? 0.3 : 0), lean: { safe: 0.3 }, run: go('half') },
            { id: 'keep', text: '先留著不賣（這七天都不賣）', say: '公倉多出來的貨先留著', why: need ? '鎮上還用得到，先別賣。' : '過一陣子說不定用得上。', base: -0.2 + (need ? 0.8 : 0) - (low ? 0.6 : 0), lean: { safe: 0.4, face: 0.1 }, run: go('keep') }];
    }

    // ================= 給帳本與介面 =================
    function brief(w, a) {
        if (!on(w) || !a) return ''; const P = w.procure; if (!P) return ''; const head = headOf(w) === a; if (!head && a.job?.key !== 'trader') return '';
        if (P.dflt) return head ? t('公庫的採購還照老規矩走，你還沒拿過主意') : '';
        const ago = day(w) - (P.d ?? day(w)); return fill(head ? '公庫現在的採購是你 {n} 天前定的：{plan}' : '公庫現在的採購是首長 {n} 天前定的：{plan}', { n: ago, plan: { raw: planText(w) } });
    }
    function view(w) {
        const P = S(w), S0 = sp(w), d = day(w); const res = {}; for (const [r, n] of Object.entries(S0?.reserved || {})) { if (r === 'silver') continue; const k = Math.max(0, n - (S0.transit?.[r] || 0)); if (k > 0) res[r] = Math.ceil(k); }
        return { sur: surPlan(w) ? { mode: P.sur.mode, by: P.sur.byName || '', d: P.sur.d } : null, mode: P.mode, name: t(MODE_NAME[P.mode]), dflt: !!P.dflt, by: P.byName || '', ago: P.d != null ? d - P.d : null, cap: P.cap ?? null, week: Math.round(P.wk?.n || 0), spent7: spent7(w), hold: P.hold ? Object.assign({}, P.hold) : null, reserved: res, pay: P.pay, payName: t(PAY_NAME[P.pay]), tech: P.tech ? Object.assign({}, P.tech) : null, miss: Object.assign({}, P.miss), keep: KEEP, st: Object.assign({}, P.st) };
    }
    return { surplusDay, surFacts, surOptions, surPlan, overList, SUR, SUR_NAME, S, on, headOf, useOf, priceOf, line, leanCap, avail, wants, exec, watch, sync, daily, ask, reasons, noteSeed, setPlan, setPay, setTech, payFirst, techAsk, tierInfo, mayorFacts, mayorOptions, candidates, dealerOf, wantFrom, merchantPlan, dealMerchant, merchantDay, caravanAsk, tradeFacts, tradeOptions, brief, view, planText, matText, RAWS, IMPORT_PRICE, KEEP, SEED_KEEP, MODE_NAME, PAY_NAME };
})();
if (typeof globalThis !== 'undefined') globalThis.PROCURE = PROCURE;

// ---- 掛勾：缺口變成提案點子；存讀檔 ----
if (typeof ProposalSystem !== 'undefined' && !ProposalSystem.prototype._procureHooked) {
    const PS = ProposalSystem.prototype; PS._procureHooked = true; const _c = PS._candidates;
    PS._candidates = function (w, day) { const out = _c.call(this, w, day); try { PROCURE.candidates(w, this, day, out); } catch (e) { console.warn('[Procure] candidates', e); } return out; };
}
if (typeof World !== 'undefined' && !World.prototype._procureHooked) {
    const WP = World.prototype; WP._procureHooked = true;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.procure = null; if (this.stockpile) this.stockpile.hold = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); try { if (d && this.procure) d.procure = JSON.parse(JSON.stringify(this.procure)); } catch (e) {} return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { if (r) { this.procure = (data?.procure && typeof data.procure === 'object') ? JSON.parse(JSON.stringify(data.procure)) : null; if (this.stockpile) this.stockpile.hold = this.procure?.hold ? Object.assign({}, this.procure.hold) : null; } } catch (e) {} return r; };
}
