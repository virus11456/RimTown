// v6.70.0 經濟深化:創業開店、合夥與分紅糾紛、討價還價、銀行家審核放貸
// - 創業:想發財、勤快或有創意又存了點錢的人會開店(依職業或專長:藥鋪、小酒館、畫坊、說書茶館、首飾鋪、繡坊、古玩鋪);
//   v9.30.0 店只做「有閒錢才會買」的行當,不跟七個產業(農莊、食堂、布莊、木作坊、礦場、鐵鋪、商行)賣一樣的東西;
//   店名由 AI 取(完整智能體模式)或照老闆的名字取;每天有客人上門,賺錢或虧錢,撐不下去就倒閉
// - 合夥:錢不夠時找交情好的朋友出資,每七天分紅;生意不好、有人愛計較或偷懶,可能鬧翻拆夥
// - 討價還價:有錢人買珍品時跟商人殺價,有魅力、會說話的人殺得比較多
// - 銀行家審核:名聲差(被揭過底)或跟銀行家處不好的人借不到錢;完整智能體模式下大筆貸款由銀行家 AI 決定
const BIZ = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('trade', k, p || {}, who || ''); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    // v9.30.0 店種改成不跟產業重疊的七種。產業是大家每天都要買的民生行業(三餐、衣服、柴火、建材);店是個人小生意,賣有閒錢才會買的東西。
    const TYPES = {
        apothecary: { icon: '🌿', zh: '藥鋪', en: 'Apothecary', job: 'doctor', price: 5 }, inn: { icon: '🍺', zh: '小酒館', en: 'Tavern', job: null, price: 3 }, studio: { icon: '🎨', zh: '畫坊', en: 'Studio', job: null, price: 6 },
        teahouse: { icon: '🍵', zh: '說書茶館', en: 'Teahouse', job: 'cook', price: 3 }, jeweler: { icon: '💍', zh: '首飾鋪', en: 'Jeweller', job: 'blacksmith', price: 6 },
        embroidery: { icon: '🪡', zh: '繡坊', en: 'Embroidery shop', job: 'tailor', price: 5 }, curio: { icon: '🏺', zh: '古玩鋪', en: 'Curio shop', job: 'trader', price: 3 },
    };
    // 9.30.0 以前的店種(跟產業重疊,已拿掉) → [接手的新店種, 舊中文名, 舊英文名]。定價沿用被取代的那一種,經濟平衡不變。
    const LEGACY = { bakery: ['teahouse', '麵包店', 'Bakery'], smithy: ['jeweler', '鐵匠鋪', 'Smithy'], tailor: ['embroidery', '裁縫店', 'Tailor'], stall: ['curio', '雜貨攤', 'Stall'] };
    for (const v of Object.values(TYPES)) { try { I18N.registerName(v.zh, v.en); } catch (e) {} }
    for (const v of Object.values(LEGACY)) { try { I18N.registerName(v[1], v[2]); } catch (e) {} } // 舊日誌、舊記憶裡還有這些店名
    // 讀到不認得的店種(舊存檔、別的系統塞進來的)也不會壞:先照舊店種對應,再不行當古玩鋪
    const typeOf = (s) => TYPES[s?.type] || TYPES[LEGACY[s?.type]?.[0]] || TYPES.curio;
    // 舊存檔的店換成新店種:照老闆名字取的預設店名(「王記麵包店」)跟著換,AI 取的店名不動。回傳換了幾家。
    function migrate(w) {
        const B = w?.biz; if (!B || !Array.isArray(B.shops)) return 0; let n = 0;
        for (const s of [...B.shops, ...(Array.isArray(B.closed) ? B.closed : [])]) {
            const L = LEGACY[s?.type]; if (!L) continue; const T = TYPES[L[0]];
            if (Array.isArray(s.name)) { const zh = String(s.name[0] || ''), e2 = String(s.name[1] || '');
                if (zh.endsWith('記' + L[1])) s.name[0] = zh.slice(0, -L[1].length) + T.zh;
                if (e2.endsWith("'s " + L[2])) s.name[1] = e2.slice(0, -L[2].length) + T.en; }
            s.type = L[0]; n++; }
        return n;
    }
    function S(w) { if (!w.biz || !Array.isArray(w.biz.shops)) w.biz = { shops: [], n: 0, lastDay: null, closed: [] }; return w.biz; }
    const shopOf = (w, a) => S(w).shops.find(s => !s.closed && (s.owner === a?.agentId || s.partner === a?.agentId)) || null;
    // 他會開哪一種店:有創意的開畫坊,其他照職業;職業對不上的,照這個人固定挑一種。
    // v9.30.0 以前對不上的人每問一次就擲一次骰(小酒館／雜貨攤),跟他說要開小酒館、真的開的時候又擲一次,可能開成別的。現在同一個人問幾次都一樣。
    const POOL = ['inn', 'teahouse', 'curio'];
    const idHash = (id) => { let h = 7; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    function typeFor(a) { if (has(a, 'creative')) return 'studio'; for (const [k, T] of Object.entries(TYPES)) if (T.job && a.job?.key === T.job) return k; return POOL[idHash(a?.agentId) % POOL.length]; }
    function defaultName(a, k) { const T = TYPES[k]; const zhName = `${a.name.slice(0, 1)}記${T.zh}`; const enName = `${(typeof I18N !== 'undefined' ? I18N.localizeNames(a.name, true) : a.name).split(' ')[0]}'s ${T.en}`; return [zhName, enName]; }
    // v8.8.0 創業貸款:銀行有放得出去的存款、這個人沒有欠款,就借;還款期比周轉長(45 天)
    function bizLoan(w, a, n, why) {
        if (typeof BANK === 'undefined' || !w.bank) return 0; const BK = BANK.S(w); if (!BK.open || BK.status === 'run' || BK.loans?.[a.agentId] || BANK.lendable(BK) < n + 20) return 0;
        const got = BANK.lend(w, BK, a, Math.ceil(n), t(why)); const L = BK.loans?.[a.agentId]; if (got && L) bizTerms(w, BK, L, got); return got;
    }
    const bizTerms = (w, BK, L, got) => { L.due = Math.max(L.due || 0, day(w) + 45); L.kind = 'biz'; BK.bizLent = Math.round((BK.bizLent || 0) + got); };
    // v9.30.0 這筆創業貸款現在借得到嗎。條件跟 bizLoan、BANK.lend 會當場拒絕的完全一樣:沒有銀行、銀行沒開、擠兌中、這個人已經有欠款、
    // 銀行放得出去的錢不夠、銀行家不肯借(名聲太差或兩人處不好)。以前出選項前沒查,已經欠銀行錢的人照樣被問「要不要借錢開店」,選了也開不成。
    function loanOk(w, a, n) {
        if (typeof BANK === 'undefined' || !w.bank || !a) return false; const BK = w.bank;
        if (!BK.open || BK.status === 'run' || BK.loans?.[a.agentId] || Math.ceil(n) < 5 || BANK.lendable(BK) < n + 20) return false;
        return vet(w, BK, a).ok;
    }
    // 這筆貸款是不是要等銀行家(AI)點頭:完整智能體模式下 40 銀幣以上的貸款由銀行家決定(見檔尾 BANK.lend)
    const loanAsks = (w, n) => { const ce = w.conversationEngine; return Math.ceil(n) >= 40 && !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && w.agents[w.bank?.banker]); };
    const replyOf = (w, a) => { try { return (typeof BANK !== 'undefined' && w.bank && BANK.lendReply) ? BANK.lendReply(w.bank, a) : null; } catch (e) { return null; } };
    // out.why:沒開成(或還沒開成)的原因 → 'noloan' 銀行借不到、'wait' 等銀行家回話、'nocash' 本錢沒湊齊、'full' 等回話期間店位滿了
    async function open(w, B, a, d, out) {
        out = out || {}; const k = typeFor(a); const T = TYPES[k]; const cost = 60; let partner = null;
        if (cash(w, a) < cost) { partner = npcs(w).filter(o => o !== a && cash(w, o) >= 60 && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a))[0];
            // v8.8.0 找不到合夥人,就拿存款大家放在銀行的錢:跟銀行借開店的本錢,之後慢慢用店裡的進帳還
            if (!partner) { const r0 = replyOf(w, a); let got = bizLoan(w, a, cost - cash(w, a) + 5, '開店');
                if (!got) { const wait = replyOf(w, a); if (!wait || wait === r0) { out.why = 'noloan'; return null; }
                    // v9.30.0 大筆貸款在完整智能體模式下要等銀行家(AI)回話。以前這裡當成沒借到就算了,銀行家之後點頭,錢照借、店卻沒開。現在等他回話再決定。
                    out.why = 'wait'; mem(w, a, '我去銀行談開店的貸款，等銀行家回話。', {}, 5); const g0 = w._gen;
                    try { await wait; } catch (e) {}
                    if (w._gen !== g0 || w.biz !== B || w.agents[a.agentId] !== a || a.isDead) return null; // 換了鎮、人不在了
                    const L = w.bank?.loans?.[a.agentId];
                    if (!L) { mem(w, a, '銀行不肯借我開店的本錢，店沒開成。', {}, 6); return null; }
                    got = L.principal || 0; if (L.kind !== 'biz') bizTerms(w, w.bank, L, got);
                    if (shopOf(w, a) || !room(w, B)) { out.why = 'full'; mem(w, a, '開店的錢借到了，可是鎮上已經沒有店位，店沒開成。', {}, 6); return null; } }
                if (cash(w, a) < cost) { out.why = 'nocash'; return null; } log(w, '🏦 {a}跟銀行借了 {n} 銀幣當開店的本錢。', { a: a.name, n: got }, a.name); } }
        const mine = Math.min(cash(w, a), partner ? cost - 40 : cost); if (!WALLET.take(w, a, mine)) { out.why = 'nocash'; return null; } if (partner && !WALLET.take(w, partner, 40)) { WALLET.add(w, a, mine); out.why = 'nocash'; return null; }
        { const paid = mine + (partner ? 40 : 0); const hand = npcs(w).filter(o => o !== a && o !== partner && ['builder', 'carpenter'].includes(o.job?.key)); const h = hand[Math.floor(Math.random() * hand.length)]; if (h) WALLET.add(w, h, paid); else w.stockpile?.add?.('silver', paid, w.tickCount, t('開店的材料與執照')); } // v8.8.0 開店的錢付給鎮上的工匠(沒有就進公庫),不再憑空消失
        let name = defaultName(a, k);
        const S2 = { id: 'B' + (++B.n), type: k, owner: a.agentId, partner: partner?.agentId || null, name, price: T.price + (has(a, 'jealous') ? 1 : 0), till: 0, profit: 0, week: 0, opened: d, lossDays: 0, closed: false };
        B.shops.push(S2);
        const ce = ai(w);
        if (ce) { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('村民「')}${b.name}${t('」（')}${b.traits}${t('）要開一家')}${t(T.zh)}${t('。請幫他取一個有個人色彩的店名（8 字內），只輸出 JSON')}${t('：')}{"name":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 60); const nm = LLMClient.clip(j?.name, 16, 40, true); if (nm) { S2.name = [nm, nm]; } } catch (e) {} }
        try { I18N.registerName(S2.name[0], S2.name[1]); } catch (e) {}
        log(w, '{i} {a}開了一家{t}「{n}」{p}！', { i: T.icon, a: a.name, t: T.zh, n: S2.name[0], p: partner ? { k: '（跟{b}合夥）', p: { b: partner.name } } : '' }, a.name);
        mem(w, a, '我開了自己的店「{n}」，希望生意興隆。', { n: S2.name[0] }, 8);
        if (partner) mem(w, partner, '我出錢跟{a}合夥開「{n}」。', { a: a.name, n: S2.name[0] }, 7);
        return S2;
    }
    function trade(w, B, d) {
        const all = npcs(w);
        for (const s of B.shops) {
            if (s.closed) continue; const o = w.agents[s.owner]; if (!o && w.isAway?.(s.owner)) continue; if (!o || o.isDead) { close(w, s, 'gone'); continue; } // v6.87.0 老闆出遠門就先歇業,回來照開
            const same = B.shops.filter(x => !x.closed && x.type === s.type).length;
            let sales = 0;
            for (const c of all) { if (c === o || cash(w, c) < s.price + 5) continue; const p = 0.08 / same * (6 / (s.price + 2)) * (1 + (has(o, 'charismatic') ? 0.3 : 0) + (aff(c, o) > 30 ? 0.3 : 0) - (aff(c, o) < -20 ? 0.6 : 0)) * (typeof THINGS !== 'undefined' ? THINGS.buyMult(w, 'shop:' + s.id, c) : 1); /* v9.9.0 被抵制時討厭的人不來 */ if (Math.random() < p && WALLET.take(w, c, s.price)) { s.till += s.price; sales++; } }
            const upkeep = 2; s.till -= upkeep; s.week += sales * s.price - upkeep; s.profit += sales * s.price - upkeep;
            s.lossDays = s.till < 0 ? s.lossDays + 1 : 0;
            let paidOut = 0; if (s.till > 0) { const pay = (a, n) => (WALLET.bizIncome ? WALLET.bizIncome(w, a, n) : WALLET.add(w, a, n)); const pp = s.partner && w.agents[s.partner] && !w.agents[s.partner].isDead ? w.agents[s.partner] : null; pay(o, s.till * (pp ? 0.5 : 1)); if (pp) pay(pp, s.till * 0.5); paidOut = s.till; s.till = 0; }
            { const kept = sales * s.price - paidOut; if (kept > 0.001) w.stockpile?.add?.('silver', Math.round(kept * 100) / 100, w.tickCount, t('店租與營業開銷')); } // v8.8.0 每天的開銷(攤位、柴火、進貨)付給公庫,不再憑空消失 // v6.81.0 店裡的進帳先繳營業稅
            if (s.lossDays >= 15 || (s.till < -40)) close(w, s, 'broke');
            if (d % 7 === 0) weekly(w, s);
        }
    }
    // 拆夥的結算：兩人翻臉，店由老闆自己開下去
    function split(w, s) {
        const o = w.agents[s.owner], p = s.partner ? w.agents[s.partner] : null; if (!o || !p || s.closed) return false;
        o.relationships.getOrCreate(p.agentId, p.name).modifyAffinity(-20); p.relationships.getOrCreate(o.agentId, o.name).modifyAffinity(-20);
        log(w, '💢 {a}和{b}為了「{n}」分錢不公鬧翻，拆夥了。', { a: o.name, b: p.name, n: s.name[0] }, o.name);
        mem(w, o, '{b}嫌分紅不公平，跟我拆夥了。', { b: p.name }, 8); mem(w, p, '跟{a}合夥開店，錢都被他拿走了，我不幹了。', { a: o.name }, 8);
        s.partner = null; s.split = true; return true;
    }
    // 給決策核心：他合夥的店上週是不是賺不到錢(老闆或合夥人都可能先開口)
    function splitInfo(w, a) {
        const B = S(w); const s = B.shops.find(x => !x.closed && x.partner && (x.owner === a.agentId || x.partner === a.agentId) && x.last != null && x.last < 5); if (!s) return null;
        const other = w.agents[s.owner === a.agentId ? s.partner : s.owner]; if (!other || other.isDead) return null;
        return { s, other, mine: s.owner === a.agentId, last: Math.round(s.last) };
    }
    function splitBy(w, a) { const I = splitInfo(w, a); return I ? split(w, I.s) : false; }
    // 要不要拆夥交給本人決定(sim-decide-work.js「合夥的店不賺錢」)
    function weekly(w, s) { // 合夥人要不要拆夥由他自己決定(splitBy)
        const o = w.agents[s.owner];
        if (s.week >= 25 && Math.random() < 0.5) mem(w, o, '「{n}」這週生意很好，賺了 {m} 銀幣。', { n: s.name[0], m: Math.round(s.week) }, 5);
        s.last = s.week; s.week = 0; // v9.23.0 記下這一週賺多少(合夥人看這個決定要不要拆夥)
    }
    function close(w, s, why) {
        if (s.closed) return; s.closed = true; s.closedDay = day(w); const o = w.agents[s.owner];
        if (why === 'broke' && o) { log(w, '🏚️ 「{n}」撐不下去，倒閉了。', { n: s.name[0] }, o.name); mem(w, o, '我的店「{n}」倒了，好不甘心。', { n: s.name[0] }, 8); o.moodModifier = (o.moodModifier || 0) - 8; }
        const B = S(w); B.closed.push({ name: s.name, type: s.type, profit: Math.round(s.profit), day: day(w) }); if (B.closed.length > 6) B.closed.shift(); B.shops = B.shops.filter(x => !x.closed);
    }
    function daily(w) { // 想不想自己開店由本人決定(見 sim-decide-life.js「想不想自己開店」)
        if (!W() || !w.wallet) return; const B = S(w), d = day(w); if (B.lastDay === d) return; B.lastDay = d;
        trade(w, B, d);
    }
    // 鎮上還容得下新店嗎(每六個人一家，最少兩家)
    const room = (w, B) => B.shops.length < Math.max(2, Math.floor(npcs(w).length / 6));
    // 這個人是會想創業、也湊得出本錢的人嗎(銀行借得到錢，手頭少一點也敢)
    function canOpen(w, a) {
        const amb = w.mind?.amb || {};
        return (a.age || 30) >= 20 && !shopOf(w, a) && a.job?.key !== 'mayor' && (amb[a.agentId]?.key === 'rich' || has(a, 'hardworking') || has(a, 'creative') || a.job?.key === 'trader') && cash(w, a) >= ((w.bank?.open && typeof BANK !== 'undefined' && BANK.lendable(w.bank) >= 80) ? 15 : 30); // v8.8.0 銀行借得到錢,手頭少一點也敢創業
    }
    // 給決策核心：他現在開得成店嗎 → { type(店的種類), cost, partner(本錢不夠時找得到的合夥人), loan(要跟銀行借) }
    function startInfo(w, a) {
        if (!W() || !w.wallet || !a) return null; const B = S(w); if (!room(w, B) || !canOpen(w, a)) return null;
        const k = typeFor(a); const short = cash(w, a) < 60; const partner = short ? npcs(w).filter(o => o !== a && cash(w, o) >= 60 && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a))[0] || null : null;
        const need = 60 - cash(w, a) + 5; const loan = short && !partner;
        if (loan && !loanOk(w, a, need)) return null; // v9.30.0 得跟銀行借、銀行卻借不到:不出這個選擇(以前照出,選了也開不成)
        return { type: TYPES[k].zh, key: k, cost: 60, partner, loan, loanAsk: loan && loanAsks(w, need) };
    }
    // v9.30.0 去開店,回傳 { shop } 或 { why }:'full' 鎮上店位滿了、'noloan' 銀行借不到、'wait' 等銀行家回話(他點頭店才開)、'nocash' 本錢沒湊齊、'gone' 情況變了(已經有店、手頭的錢花掉了)
    function startTry(w, a) {
        const B = S(w); if (!W() || !w.wallet || !a) return { why: 'gone' }; if (!room(w, B)) return { why: 'full' }; if (!canOpen(w, a)) return { why: 'gone' };
        if (!startInfo(w, a)) return { why: 'noloan' };
        const n0 = B.shops.length, out = {}; const pr = open(w, B, a, day(w), out); try { pr?.catch?.(() => {}); } catch (e) {}
        return B.shops.length > n0 ? { shop: B.shops[B.shops.length - 1] } : { why: out.why || 'nocash' };
    }
    function start(w, a) { return startTry(w, a).shop || null; }
    // 討價還價
    function haggle(w, buyer, price) { if (!buyer || buyer === 'town') return { price, saved: 0 }; const skill = (has(buyer, 'charismatic') ? 0.08 : 0) + (has(buyer, 'perfectionist') ? 0.04 : 0) + (has(buyer, 'shy') ? -0.03 : 0) + Math.random() * 0.05; const cut = Math.max(0, Math.min(0.15, skill)); const np = Math.round(price * (1 - cut)); return { price: np, saved: price - np }; }
    // 銀行家審核
    function vet(w, B, a) {
        const banker = w.agents[B.banker]; const rep = w.dark?.rep?.[a.agentId] || {};
        if ((rep.exposed || 0) >= 2) return { ok: false, why: 'rep' };
        if (banker && aff(banker, a) < -20) return { ok: false, why: 'dislike' };
        return { ok: true };
    }
    // v9.18.1 老闆出遠門、過世或搬走時，名字不再是空白
    const whoName = (w, id) => { const a = w.agents[id]; if (a && !a.isDead && a.name) return t(a.name); const tr = (w.events?._travellingAgents || []).find(x => x?.agentData?.agentId === id)?.agentData?.name; if (tr) return t(tr) + t('（出遠門）'); const nm = a?.name || w.departedNames?.[id] || w._nameCache?.[id]; return nm ? t(nm) + t('（已不在鎮上）') : t('已不在鎮上的人'); };
    function view(w) { const B = S(w); return { shops: B.shops.map(s => ({ icon: typeOf(s).icon, name: en() ? s.name[1] : s.name[0], type: t(typeOf(s).zh), owner: whoName(w, s.owner), partner: s.partner ? whoName(w, s.partner) : null, profit: Math.round(s.profit), price: s.price })), closed: B.closed.slice(-3).map(c => ({ name: en() ? c.name[1] : c.name[0], profit: c.profit })) }; }
    function chip(w, a) { const s = shopOf(w, a); if (!s) return ''; return `${typeOf(s).icon} ${s.owner === a.agentId ? t('老闆') : t('合夥人')}${t('：')}${en() ? s.name[1] : s.name[0]}`; }
    return { TYPES, LEGACY, S, open, trade, weekly, close, daily, haggle, vet, view, chip, shopOf, bizLoan, loanOk, typeFor, typeOf, migrate, startInfo, start, startTry, split, splitInfo, splitBy };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BIZ.daily(w); } catch (e) { console.warn('[Biz] daily', e); } return r; };
}
// 珍品殺價
if (typeof GOODS !== 'undefined') {
    const _buy = GOODS.buy;
    GOODS.buy = function (w, G, o, who) { if (who && who !== 'town') { const h = BIZ.haggle(w, who, o.price); if (h.saved > 0) { o = Object.assign({}, o, { price: h.price }); try { w.logMessageT?.('trade', '🗣️ {a}跟商人殺價，省下 {n} 銀幣。', { a: who.name, n: h.saved }, who.name); } catch (e) {} } } return _buy.call(this, w, G, o, who); };
}
// 銀行家審核;完整智能體模式大筆貸款問 AI
// v6.74.0 等待旗標改放記憶體(以前放在銀行狀態裡會被存檔,讀回後永遠「等待中」→ 之後的大額貸款都跳過 AI);
//          回覆回來時確認還是同一個世代、同一家銀行、同一個人才放款(以前換鎮後舊回覆會讓新鎮居民憑空多 80 銀幣)
if (typeof BANK !== 'undefined') {
    const _lend = BANK.lend; const asking = new WeakMap(); // 銀行狀態 → 開始等待的世代
    const waits = new WeakMap(); // v9.30.0 銀行狀態 → { id, p }:誰的貸款正在等銀行家回話(放記憶體,不存檔)。開店要等這個回話才知道借不借得到
    BANK.lendReply = (B, a) => { const x = B ? waits.get(B) : null; return x && a && x.id === a.agentId ? x.p : null; };
    BANK.lend = function (w, B, a, n, why) {
        const v = BIZ.vet(w, B, a);
        if (!v.ok && B.refused?.[a.agentId] != null && (w._absDay?.() ?? 0) - B.refused[a.agentId] < 10) return 0; // v8.8.0 被拒絕過的人十天內不會再去碰釘子(以前同一個人天天被拒、天天記一筆)
        if (!v.ok) { (B.refused = B.refused || {})[a.agentId] = w._absDay?.() ?? 0; try { w.logMessageT?.('trade', '🏦 銀行家拒絕借錢給{a}{r}。', { a: a.name, r: v.why === 'rep' ? '（名聲太差）' : '（兩人處不好）' }, a.name); } catch (e) {} try { a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '銀行不肯借我錢。', {}, 6, []); } catch (e) {} return 0; }
        const ce = w.conversationEngine; const banker = w.agents[B.banker];
        if (n >= 40 && w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && banker && asking.get(B) !== w._gen) {
            asking.set(B, w._gen); const g0 = w._gen; const live = () => w._gen === g0 && w.bank === B && w.agents[a.agentId] === a && !a.isDead;
            let p = null; p = (async () => { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('你是銀行家「')}${banker.name}${t('」。')}${b.name}${t('想借')} ${Math.round(n)} ${t('銀幣')}${t('（')}${t(why || '周轉')}${t('）')}${t('。')}${t('他的狀況')}${t('：')}${(b.mem || []).slice(0, 4).join(' / ')}${t('。')}${t('要借嗎？只輸出 JSON')}${t('：')}{"lend":true,"why":"${t('一句理由，20 字內')}"}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 140); /* v9.23.2 理由限長:以前沒寫,AI 一寫就一大段、被字數上限切斷 */ if (!live()) return; if (j && j.lend === false) { w.logMessageT?.('trade', '🏦 銀行家{b}拒絕了{a}的貸款：{x}', { b: banker.name, a: a.name, x: String(j.why || '').slice(0, 50) }, banker.name); } else _lend.call(BANK, w, B, a, n, why); } catch (e) { if (live()) _lend.call(BANK, w, B, a, n, why); } finally { if (asking.get(B) === g0) asking.delete(B); if (p && waits.get(B)?.p === p) waits.delete(B); } })(); waits.set(B, { id: a.agentId, p });
            return 0;
        }
        return _lend.call(this, w, B, a, n, why);
    };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.biz = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.biz) d.biz = this.biz; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.biz = (data?.biz && Array.isArray(data.biz.shops)) ? data.biz : null; const moved = BIZ.migrate(this); /* v9.30.0 舊店種換成新店種 */ for (const s of (this.biz?.shops || [])) I18N.registerName(s.name[0], s.name[1]); if (moved) { try { this.logMessageT?.('trade', '🏪 鎮上有 {n} 家老店換了招牌，改做不跟產業搶生意的買賣。', { n: moved }, ''); } catch (e) {} } } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.BIZ = BIZ;
