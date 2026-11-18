// v6.70.0 經濟深化:創業開店、合夥與分紅糾紛、討價還價、銀行家審核放貸
// - 創業:想發財、勤快或有創意又存了點錢的人會開店(依職業或專長:藥鋪、小酒館、畫坊、說書茶館、首飾鋪、繡坊、古玩鋪);
//   v9.30.0 店只做「有閒錢才會買」的行當,不跟七個產業(農莊、食堂、布莊、木作坊、礦場、鐵鋪、商行)賣一樣的東西;
//   店名由 AI 取(完整智能體模式)或照老闆的名字取;每天有客人上門,賺錢或虧錢,撐不下去就倒閉
// - 合夥:錢不夠時找交情好的朋友出資,每七天分紅;生意不好、有人愛計較或偷懶,可能鬧翻拆夥
// - 討價還價:有錢人買珍品時跟商人殺價,有魅力、會說話的人殺得比較多
// - 銀行家審核:名聲差(被揭過底)或跟銀行家處不好的人借不到錢;完整智能體模式下大筆貸款由銀行家 AI 決定
// v11.6.0 小店有自己的店面，撐不撐、接不接由當事人決定：
// - 店面：每家店在廣場周圍佔一格攤位（w.biz.fronts，跟著存檔走）；離廣場近的先用，十格內都沒空地就沒有攤位、店照開（以前的樣子）
// - 一直虧：連虧 10 天或店裡欠到 25，問店主一次（之後每 7 天最多一次，選擇點 shopFail）：自己貼錢、降價、找朋友合夥（對方也要答應，shopJoin）、收掉、頂讓；
//   原本「連虧 15 天或欠到 40 就倒」留著當最後的底線
// - 空店面：店收了攤位留著；想開店的人頂下來只要 35（上一任還在鎮上就付給他當頂讓金，不在了付給木匠），沒有空的才蓋新的（60）
// - 老闆過世或搬走：先問合夥人、再問配偶、成年子女要不要接（shopHeir）；都不接就收掉、攤位掛空。出遠門照舊先歇業
// - 空超過 30 天的店面可以提案拆掉（走 sim-demolish.js 同一套表決），通過後那一格還給空地
// 決策核心沒開、問不到人時照原本的規則（自動倒閉、老闆不在就收）
const BIZ = (() => {
    const npcs0 = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    // 每天掃一輪「誰有事要拿主意」、付三餐那一圈（SCAN.run 包住的段落）沒有人進出鎮上、也沒有人過世：全鎮名單同一輪只篩一次，每次給一份新的陣列（跟 sim-market.js 一樣的做法）
    const npcs = (w) => SCAN.on() ? SCAN.memo('biz.npcs', () => npcs0(w)).slice() : npcs0(w);
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
    function S(w) { if (!w.biz || !Array.isArray(w.biz.shops)) w.biz = { shops: [], n: 0, lastDay: null, closed: [] }; const B = w.biz; if (!Array.isArray(B.fronts)) B.fronts = []; if (!Array.isArray(B.closed)) B.closed = []; if (!(B.fn >= 0)) B.fn = B.fronts.length; return B; }
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
        const got = BANK.lend(w, BK, a, Math.ceil(n), t(why), { biz: 1 }); const L = BK.loans?.[a.agentId]; if (got && L && L.kind !== 'biz') bizTerms(w, BK, L, got); return got; // v11.6.0 銀行家撥款時已經照四十五天、記進創業貸款（kind 是 biz），不再記兩次
    }
    const bizTerms = (w, BK, L, got) => { L.due = Math.max(L.due || 0, day(w) + 45); L.kind = 'biz'; BK.bizLent = Math.round((BK.bizLent || 0) + got); };
    // v9.30.0 這筆創業貸款現在借得到嗎。條件跟 bizLoan、BANK.lend 會當場拒絕的完全一樣:沒有銀行、銀行沒開、擠兌中、這個人已經有欠款、
    // 銀行放得出去的錢不夠、銀行家不肯借(名聲太差或兩人處不好)。以前出選項前沒查,已經欠銀行錢的人照樣被問「要不要借錢開店」,選了也開不成。
    function loanOk(w, a, n) {
        if (typeof BANK === 'undefined' || !w.bank || !a) return false; const BK = w.bank;
        if (!BK.open || BK.status === 'run' || BK.loans?.[a.agentId] || Math.ceil(n) < 5 || BANK.lendable(BK) < n + 20) return false;
        // v11.6.0 借不借由銀行家決定（sim-bank.js 的 bankDesk）；這裡只是「要不要出這個選擇」：名聲太差、跟銀行家處不好的人自己知道去了也借不到，
        // 十天內才被他拒絕過、已經有一筆在等他回話的，也不再出這個選擇
        if (BANK.teller && BANK.teller(w, BK, a)) { const d = day(w); if ((BK.refused?.[a.agentId] != null && d - BK.refused[a.agentId] < 10) || BANK.pendingOf(w, a)) return false; }
        return vet(w, BK, a).ok;
    }
    // 這筆貸款是不是要等銀行家(AI)點頭:完整智能體模式下 40 銀幣以上的貸款由銀行家決定(見檔尾 BANK.lend)
    const loanAsks = (w, n) => { if (typeof BANK !== 'undefined' && BANK.teller && BANK.teller(w, w.bank, null)) return typeof DECIDE !== 'undefined' && DECIDE.aiOn(w); /* v11.6.0 銀行家決定：開智能體時每一筆都要等他回話 */ const ce = w.conversationEngine; return Math.ceil(n) >= 40 && !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && w.agents[w.bank?.banker]); };
    const replyOf = (w, a) => { try { return (typeof BANK !== 'undefined' && w.bank && BANK.lendReply) ? BANK.lendReply(w.bank, a) : null; } catch (e) { return null; } };
    // out.why:沒開成(或還沒開成)的原因 → 'noloan' 銀行借不到、'wait' 等銀行家回話、'nocash' 本錢沒湊齊、'full' 等回話期間店位滿了
    async function open(w, B, a, d, out, kind) {
        out = out || {}; const k = (kind && TYPES[kind]) ? kind : typeFor(a); const T = TYPES[k];
        // v11.6.0 有空店面就頂下來（35），沒有才蓋新的（60）；合夥人出三分之二（蓋新的時跟以前一樣是 40）
        const vf0 = vacant(w)[0] || null; const cost = vf0 ? TAKE_COST : NEW_COST, pShare = Math.round(cost * 2 / 3); let partner = null;
        if (cash(w, a) < cost) { partner = npcs(w).filter(o => o !== a && cash(w, o) >= cost && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a))[0];
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
        // 等銀行家回話的期間空店面被別人頂走了：本錢是照頂店算的，這次就不開（不會用 35 蓋出一間新的）
        const vf = vf0 ? (vf0.shop || !fronts(w).includes(vf0) ? vacant(w)[0] || null : vf0) : null; if (vf0 && !vf) { out.why = 'gone'; return null; }
        const mine = Math.min(cash(w, a), partner ? cost - pShare : cost); if (!WALLET.take(w, a, mine)) { out.why = 'nocash'; return null; } if (partner && !WALLET.take(w, partner, pShare)) { WALLET.add(w, a, mine); out.why = 'nocash'; return null; }
        { const paid = mine + (partner ? pShare : 0); const prev = vf?.last?.owner ? w.agents[vf.last.owner] : null; const seller = prev && !prev.isDead && !prev.isPlayer && prev !== a && prev !== partner ? prev : null;
            if (seller) { WALLET.add(w, seller, paid); log(w, '🔑 {a}付了 {n} 銀幣頂讓金給{b}，頂下了「{s}」留下的店面。', { a: a.name, n: Math.round(paid), b: seller.name, s: vf.last.name?.[0] || '' }, a.name); mem(w, seller, '{a}付了 {n} 銀幣，頂下了我以前的店面。', { a: a.name, n: Math.round(paid) }, 6); } // v11.6.0 上一任店主還在鎮上：頂讓金付給他
            else { const hand = npcs(w).filter(o => o !== a && o !== partner && ['builder', 'carpenter'].includes(o.job?.key)); const h = hand[Math.floor(Math.random() * hand.length)]; if (h) WALLET.add(w, h, paid); else w.stockpile?.add?.('silver', paid, w.tickCount, t('開店的材料與執照')); } } // v8.8.0 開店的錢付給鎮上的工匠(沒有就進公庫),不再憑空消失
        const S2 = mkShop(w, B, a, k, partner, d, vf, true);
        const ce = ai(w);
        if (ce) { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('村民「')}${b.name}${t('」（')}${b.traits}${t('）要開一家')}${t(T.zh)}${t('。請幫他取一個有個人色彩的店名（8 字內），只輸出 JSON')}${t('：')}{"name":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 60); const nm = LLMClient.clip(j?.name, 16, 40, true); if (nm) { S2.name = [nm, nm]; } } catch (e) {} }
        try { I18N.registerName(S2.name[0], S2.name[1]); } catch (e) {}
        hello(w, S2, a, partner);
        return S2;
    }
    // 開一家店（錢已經付過了）：記進清單、拿一格店面（vf＝要頂下來的空店面；沒有就找一格新的，找不到就沒有攤位）、日誌與記憶
    function mkShop(w, B, a, k, partner, d, vf, quiet) {
        const T = TYPES[k];
        const S2 = { id: 'B' + (++B.n), type: k, owner: a.agentId, partner: partner?.agentId || null, name: defaultName(a, k), price: T.price + (has(a, 'jealous') ? 1 : 0), till: 0, profit: 0, week: 0, opened: d, lossDays: 0, closed: false, front: null, h: [] };
        B.shops.push(S2); if (vf && !vf.shop) occupy(w, vf, S2); else placeFront(w, S2);
        try { I18N.registerName(S2.name[0], S2.name[1]); } catch (e) {}
        if (!quiet) hello(w, S2, a, partner); // 開店時先等 AI 取好店名才寫日誌（跟以前一樣）
        return S2;
    }
    function hello(w, S2, a, partner) {
        log(w, '{i} {a}開了一家{t}「{n}」{p}！', { i: typeOf(S2).icon, a: a.name, t: typeOf(S2).zh, n: S2.name[0], p: partner ? { k: '（跟{b}合夥）', p: { b: partner.name } } : '' }, a.name);
        mem(w, a, '我開了自己的店「{n}」，希望生意興隆。', { n: S2.name[0] }, 8);
        if (partner) mem(w, partner, '我出錢跟{a}合夥開「{n}」。', { a: a.name, n: S2.name[0] }, 7);
    }
    function trade(w, B, d) {
        const all = npcs(w);
        for (const s of B.shops) {
            if (s.closed) continue; const o = w.agents[s.owner]; if (!o && w.isAway?.(s.owner)) continue; // v6.87.0 老闆出遠門就先歇業,回來照開
            if (!o || o.isDead) { if (heirStep(w, s, d)) continue; close(w, s, 'gone'); continue; } // v11.6.0 老闆不在了：先問合夥人、家人接不接（等回話的這幾天先歇業）；沒人接才收
            if (s.heir || s.gone) { s.heir = null; s.gone = null; } // 老闆還在（出遠門回來了）
            const same = B.shops.filter(x => !x.closed && x.type === s.type).length;
            let sales = 0;
            for (const c of all) { if (c === o || cash(w, c) < s.price + 5) continue; const p = 0.08 / same * (6 / (s.price + 2)) * (1 + (has(o, 'charismatic') ? 0.3 : 0) + (aff(c, o) > 30 ? 0.3 : 0) - (aff(c, o) < -20 ? 0.6 : 0)) * (typeof THINGS !== 'undefined' ? THINGS.buyMult(w, 'shop:' + s.id, c) : 1); /* v9.9.0 被抵制時討厭的人不來 */ if (Math.random() < p && WALLET.take(w, c, s.price)) { s.till += s.price; sales++; } }
            const upkeep = 2; s.till -= upkeep; s.week += sales * s.price - upkeep; s.profit += sales * s.price - upkeep;
            s.lossDays = s.till < 0 ? s.lossDays + 1 : 0; (s.h = Array.isArray(s.h) ? s.h : []).push(Math.round((sales * s.price - upkeep) * 100) / 100); if (s.h.length > 7) s.h.splice(0, s.h.length - 7); // v11.6.0 最近七天的賺賠（給店主、資訊卡看）
            let paidOut = 0; if (s.till > 0) { const pay = (a, n) => (WALLET.bizIncome ? WALLET.bizIncome(w, a, n) : WALLET.add(w, a, n)); const pp = s.partner && w.agents[s.partner] && !w.agents[s.partner].isDead ? w.agents[s.partner] : null; pay(o, s.till * (pp ? 0.5 : 1)); if (pp) pay(pp, s.till * 0.5); paidOut = s.till; s.till = 0; }
            { const kept = sales * s.price - paidOut; if (kept > 0.001) w.stockpile?.add?.('silver', Math.round(kept * 100) / 100, w.tickCount, t('店租與營業開銷')); } // v8.8.0 每天的開銷(攤位、柴火、進貨)付給公庫,不再憑空消失 // v6.81.0 店裡的進帳先繳營業稅
            if (failDue(w, s, d)) { try { askFail(w, s, d); } catch (e) { console.warn('[Biz] shopFail', e); } if (s.closed) continue; } // v11.6.0 一直虧：先問店主怎麼辦
            if (s.lossDays >= 15 || (s.till < -40)) close(w, s, 'broke'); // 最後的底線照舊
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
        if (s.closed) return; s.closed = true; s.closedDay = day(w); s.closeWhy = why || ''; /* v11.6.0 記下為什麼收（對照、除錯用） */ const o = w.agents[s.owner];
        if (why === 'broke' && o) { log(w, '🏚️ 「{n}」撐不下去，倒閉了。', { n: s.name[0] }, o.name); mem(w, o, '我的店「{n}」倒了，好不甘心。', { n: s.name[0] }, 8); o.moodModifier = (o.moodModifier || 0) - 8; }
        if (why === 'quit' && o) { log(w, '🔒 {a}決定把「{n}」收掉，不再硬撐。', { a: o.name, n: s.name[0] }, o.name); mem(w, o, '我把「{n}」收掉了，至少不用再賠下去。', { n: s.name[0] }, 7); o.moodModifier = (o.moodModifier || 0) - 3; }
        if (why === 'gone' && s.heir?.q?.length) log(w, '🔒 {o}留下的「{n}」沒有人接，收掉了。', { o: s.heir.name || '', n: s.name[0] }, '');
        s.heir = null; s.gone = null; const B = S(w); B.closed.push({ name: s.name, type: s.type, profit: Math.round(s.profit), day: day(w) }); if (B.closed.length > 6) B.closed.shift(); B.shops = B.shops.filter(x => !x.closed);
        const f = frontOf(w, s); if (f) { f.shop = null; f.icon = null; f.type = null; f.idle = day(w); f.last = { name: s.name, type: s.type, owner: s.owner, opened: s.opened, closed: day(w) }; } // v11.6.0 店收了，攤位留著掛空
    }
    function daily(w) { // 想不想自己開店由本人決定(見 sim-decide-life.js「想不想自己開店」)
        if (!W() || !w.wallet) return; const B = S(w), d = day(w); if (B.lastDay === d) return; B.lastDay = d;
        trade(w, B, d);
        try { demoDaily(w); } catch (e) { console.warn('[Biz] demolish', e); } // v11.6.0 空太久的店面
    }
    // 鎮上還容得下新店嗎(每六個人一家，最少兩家)
    const room = (w, B) => B.shops.length < Math.max(2, Math.floor(npcs(w).length / 6));
    // 這個人是會想創業、也湊得出本錢的人嗎(銀行借得到錢，手頭少一點也敢)
    function canOpen(w, a) {
        return wants(w, a) && !shopOf(w, a) && cash(w, a) >= ((w.bank?.open && typeof BANK !== 'undefined' && BANK.lendable(w.bank) >= 80) ? 15 : 30); // v8.8.0 銀行借得到錢,手頭少一點也敢創業
    }
    // v11.1.0 開哪一種店由本人挑。以前每個人只有一種：有創意的一律畫坊、商人一律古玩鋪，開店時也不知道鎮上已經有幾家，
    // 九個鎮看下來畫坊加古玩鋪佔六到九成(一個 117 人的城市 19 家裡 18 家)。現在把鎮上各種店有幾家寫給他，他能開的種類都列出來讓他選。
    // 他能開的：自己拿手的那一種(typeFor)、本行對應的店、有創意的人可以開畫坊、不需要手藝的三種(小酒館、說書茶館、古玩鋪)。最多四種，拿手的排第一。
    const countOf = (w) => { const c = {}; for (const k of Object.keys(TYPES)) c[k] = 0; for (const sh of S(w).shops) { const k = TYPES[sh.type] ? sh.type : (LEGACY[sh.type]?.[0] || 'curio'); c[k] = (c[k] || 0) + 1; } return c; };
    function kindsFor(w, a) {
        const nat = typeFor(a), c = countOf(w), set = [nat];
        for (const [k, T] of Object.entries(TYPES)) if (T.job && a.job?.key === T.job && !set.includes(k)) set.push(k);
        if (has(a, 'creative') && !set.includes('studio')) set.push('studio');
        for (const k of POOL.slice().sort((x, y) => c[x] - c[y])) if (!set.includes(k)) set.push(k); // 鎮上少的排前面
        return set.slice(0, 4).map(k => ({ key: k, zh: TYPES[k].zh, n: c[k] || 0, own: k === nat }));
    }
    // 給決策核心：他現在開得成店嗎 → { type(店的種類), cost, partner(本錢不夠時找得到的合夥人), loan(要跟銀行借), kinds(能開的種類與鎮上各有幾家), counts }
    function startInfo(w, a) {
        if (!W() || !w.wallet || !a) return null; const B = S(w); if (!room(w, B) || !canOpen(w, a)) return null;
        const vf = vacant(w)[0] || null; const cost = vf ? TAKE_COST : NEW_COST; // v11.6.0 有空店面就頂下來
        const k = typeFor(a); const short = cash(w, a) < cost; const partner = short ? npcs(w).filter(o => o !== a && cash(w, o) >= cost && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a))[0] || null : null;
        const need = cost - cash(w, a) + 5; const loan = short && !partner;
        if (loan && !loanOk(w, a, need)) return null; // v9.30.0 得跟銀行借、銀行卻借不到:不出這個選擇(以前照出,選了也開不成)
        return { type: TYPES[k].zh, key: k, cost, partner, loan, loanAsk: loan && loanAsks(w, need), kinds: kindsFor(w, a), counts: countOf(w), front: vf ? { prev: vf.last?.name?.[0] || '', idle: vf.idle != null ? day(w) - vf.idle : 0 } : null };
    }
    // v9.30.0 去開店,回傳 { shop } 或 { why }:'full' 鎮上店位滿了、'noloan' 銀行借不到、'wait' 等銀行家回話(他點頭店才開)、'nocash' 本錢沒湊齊、'gone' 情況變了(已經有店、手頭的錢花掉了)
    function startTry(w, a, kind) {
        const B = S(w); if (!W() || !w.wallet || !a) return { why: 'gone' }; if (!room(w, B)) return { why: 'full' }; if (!canOpen(w, a)) return { why: 'gone' };
        if (!startInfo(w, a)) return { why: 'noloan' };
        if (kind && !kindsFor(w, a).some(x => x.key === kind)) kind = null; // 不是他開得了的種類就照他拿手的開
        const n0 = B.shops.length, out = {}; const pr = open(w, B, a, day(w), out, kind); try { pr?.catch?.(() => {}); } catch (e) {}
        return B.shops.length > n0 ? { shop: B.shops[B.shops.length - 1] } : { why: out.why || 'nocash' };
    }
    function start(w, a) { return startTry(w, a).shop || null; }
    // ================= v11.6.0 店面（攤位） =================
    // 店面是地圖上的一格（不寫進地圖格子，3D 另外畫；蓋房子、蓋新東西時會避開它）。資料：{ id, x, y, r 離廣場幾格, face 朝哪邊, shop 現在是哪家店, icon, type, since, idle 從哪天開始空著, last 上一家 }
    const NEW_COST = 60, TAKE_COST = 35, JOIN_COST = 30, FRONT_R = 10, FAIL_DAYS = 10, FAIL_DEBT = 25, FAIL_GAP = 7, IDLE_DEMO = 30, HEIR_WAIT = 3;
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const st = (w) => { const B = S(w); B.st = Object.assign({ fail: 0, prop: 0, cut: 0, join: 0, sold: 0, quit: 0, heir: 0, took: 0, razed: 0 }, B.st || {}); return B.st; };
    const fronts = (w) => S(w).fronts;
    const frontOf = (w, s) => (s?.front ? fronts(w).find(f => f.id === s.front) || null : null);
    const idNum = (f) => +String(f?.id || '').slice(1) || 0;
    const vacant = (w) => fronts(w).filter(f => !f.shop).sort((x, y) => (x.r ?? 9) - (y.r ?? 9) || idNum(x) - idNum(y)); // 離廣場近的先頂出去
    const weekNet = (s) => (Array.isArray(s?.h) ? s.h.reduce((m, x) => m + (+x || 0), 0) : (s?.last ?? 0));
    const tmOf = (w) => { try { const app = typeof window !== 'undefined' ? window.rimtownApp : null; const tm = app && app.world === w ? app.tileMap : null; return tm?.grid?.length ? tm : null; } catch (e) { return null; } };
    const square = (tm) => tm?.buildingZones?.town_square || tm?.natureZones?.town_square || null;
    // 這一格能不能放攤位：只放在草地上；不壓路、水、建築、農田、地標與別的保留區（建築與地點範圍、工廠地基、工地、選址建築、裝飾、馬車站），門口一格內也不放（門口有燈籠，人要進出）
    function freeOf(w, tm, skip) {
        const TL = typeof T !== 'undefined' ? T : null; if (!tm?.grid?.length || !TL) return null; const G = tm.grid, H = G.length, W0 = G[0].length;
        const OK = new Set([TL.GRASS, TL.GRASS2, TL.GRASS3].filter(v => v != null));
        const rects = [...Object.values(tm.buildingZones || {}), ...Object.values(tm.natureZones || {})].filter(z => z && Number.isFinite(z.x)).map(z => ({ x: z.x, y: z.y, w: z.w || 1, h: z.h || 1 }));
        try { for (const p of (tm._getFactoryPlots?.() || [])) rects.push(p); } catch (e) {}
        for (const p of (tm.constructionSites || [])) rects.push({ x: p.siteX, y: p.siteY, w: 2, h: 2 }); for (const b of (tm.sitedCompleted || [])) rects.push({ x: b.siteX, y: b.siteY, w: 2, h: 2 });
        for (const dc of (tm.decorations || [])) rects.push({ x: dc.x, y: dc.y, w: 1, h: 1 }); if (tm.coachStation) rects.push(tm.coachStation);
        const doors = Object.values(tm.buildingZones || {}).filter(z => z && z.doorPixelX !== undefined).map(z => [Math.floor(z.doorPixelX / 16), Math.floor(z.doorPixelY / 16)]);
        const taken = new Set(fronts(w).filter(f => f !== skip).map(f => f.x + ',' + f.y));
        const fn = (x, y, any) => x >= 1 && y >= 1 && x < W0 - 1 && y < H - 1 && OK.has(G[y][x]) && (any || !taken.has(x + ',' + y)) && !rects.some(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) && !doors.some(([dx, dy]) => Math.abs(dx - x) <= 1 && Math.abs(dy - y) <= 1);
        fn.taken = taken; return fn;
    }
    const ringOf = (sq, x, y) => Math.max(sq.x - x, x - (sq.x + sq.w - 1), sq.y - y, y - (sq.y + sq.h - 1));
    // 店面朝廣場開：0 朝南(+y)、1 朝東(+x)、2 朝北、3 朝西
    function faceOf(sq, x, y) { const ax = x < sq.x ? sq.x - x : x >= sq.x + sq.w ? -(x - sq.x - sq.w + 1) : 0, ay = y < sq.y ? sq.y - y : y >= sq.y + sq.h ? -(y - sq.y - sq.h + 1) : 0; if (ay && Math.abs(ay) >= Math.abs(ax)) return ay > 0 ? 0 : 2; return ax > 0 ? 1 : ax < 0 ? 3 : 0; }
    // 廣場周圍離廣場最近的一格空地（一樣近的，不跟別的攤位黏在一起的先）；十格內都沒有就回 null
    function spot(w, tm, skip) {
        const sq = square(tm); const free = sq ? freeOf(w, tm, skip) : null; if (!free) return null; let best = null, bs = Infinity;
        for (let y = sq.y - FRONT_R; y < sq.y + sq.h + FRONT_R; y++) for (let x = sq.x - FRONT_R; x < sq.x + sq.w + FRONT_R; x++) {
            const r = ringOf(sq, x, y); if (r < 1 || r > FRONT_R || !free(x, y)) continue;
            const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => free.taken.has((x + a) + ',' + (y + b))).length;
            const sc = r * 10 + nb * 4 + ((x * 7 + y * 13) % 5) * 0.01; if (sc < bs) { bs = sc; best = { x, y, r, face: faceOf(sq, x, y) }; }
        }
        return best;
    }
    function occupy(w, f, s) { f.shop = s.id; f.icon = typeOf(s).icon; f.type = TYPES[s.type] ? s.type : (LEGACY[s.type]?.[0] || 'curio'); f.since = s.opened ?? day(w); f.idle = null; s.front = f.id; s.nf = null; }
    function placeFront(w, s, tm0) {
        const tm = tm0 || tmOf(w); const p = tm ? spot(w, tm, null) : null; if (!p) { s.front = null; s.nf = day(w); return null; } // 找不到空地（或地圖還沒好）：這家店先沒有攤位，照以前只存在清單裡
        const B = S(w); const f = { id: 'F' + (++B.fn), x: p.x, y: p.y, r: p.r, face: p.face, shop: null, icon: null, type: null, since: null, idle: null, last: null }; B.fronts.push(f); occupy(w, f, s); return f;
    }
    // 地圖跟資料對齊（app 每 5 秒叫一次）：沒有攤位的店補一格（舊存檔、當時沒空地的，一天試一次）；一天檢查一次攤位有沒有被後來的東西壓到，壓到就換一格
    function syncMap(w, tm) {
        if (!w || !tm?.grid?.length) return false; const B = S(w), d = day(w); let ch = false; tm.bizFronts = B.fronts;
        if (tm._bizDay !== d || tm._bizOf !== B) { tm._bizDay = d; tm._bizOf = B; const free = freeOf(w, tm, null);
            if (free) for (const f of B.fronts.slice()) { if (free(f.x, f.y, true)) continue; const p = spot(w, tm, f); const s = f.shop ? B.shops.find(x => x.id === f.shop) : null;
                if (p) Object.assign(f, p); else { B.fronts.splice(B.fronts.indexOf(f), 1); if (s) { s.front = null; s.nf = d; } } ch = true; } }
        for (const s of B.shops) if (!s.closed && !frontOf(w, s) && s.nf !== d) { if (placeFront(w, s, tm)) ch = true; }
        return ch;
    }
    function frontName(f) { const n = idNum(f); const zh = `第 ${n} 號空店面`; try { I18N.registerName(zh, `Empty shopfront No. ${n}`); } catch (e) {} return zh; }
    // 資訊卡：營業中的（店名、老闆、合夥人、開了多久、這週賺賠）；空著的（空了幾天、上一家是誰）
    function frontInfo(w, id) {
        const f = fronts(w).find(x => x.id === id); if (!f) return null; const d = day(w); const s = f.shop ? S(w).shops.find(x => x.id === f.shop && !x.closed) : null;
        if (s) { const T0 = typeOf(s); return { open: true, id: f.id, x: f.x, y: f.y, icon: T0.icon, name: en() ? s.name[1] : s.name[0], type: t(T0.zh), owner: whoName(w, s.owner), partner: s.partner ? whoName(w, s.partner) : null, days: d - (s.opened ?? d), week: Math.round(weekNet(s)), price: s.price, lossDays: s.lossDays || 0, debt: debtOf(s), heir: !!s.heir }; }
        const L = f.last; return { open: false, id: f.id, x: f.x, y: f.y, idle: f.idle != null ? d - f.idle : 0, prev: L ? { name: en() ? (L.name?.[1] || L.name?.[0] || '') : (L.name?.[0] || ''), type: t(typeOf(L).zh), owner: whoName(w, L.owner), icon: typeOf(L).icon } : null, cost: TAKE_COST };
    }

    // ================= v11.6.0 一直虧：由店主決定（選擇點 shopFail，登記在 sim-decide-work.js） =================
    const deciding = (w, kind) => !!(w?.observerMode && typeof DECIDE !== 'undefined' && DECIDE.on(w) && DECIDE.KINDS?.[kind]);
    const here = (w, a) => !!a && !a.isDead && !a.isPlayer && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) && !(w.civic?.jail?.[a.agentId] > day(w));
    // 馬上問這一個人（跟 BOSS、PROCURE 一樣：排著還沒輪到的事先拿開，問完原樣放回去）
    function askNow(w, a, kind, ctx) { const X = DECIDE.S(w); const keep = X.q.splice(0, X.q.length); try { DECIDE.enqueue(w, a, kind, ctx); DECIDE.drain(w, X, day(w)); } finally { if (keep.length) X.q.unshift(...keep); } }
    const nm = (s) => (s?.name ? s.name[0] : ''); // 交給 t()：英文模式換成英文店名（開店時 registerName 過）
    const plOf = (n) => (n >= 0 ? { k: '賺了 {n} 銀幣', p: { n: Math.round(n) } } : { k: '賠了 {n} 銀幣', p: { n: Math.round(-n) } });
    const debtOf = (s) => (s && s.till < 0 ? Math.ceil(-s.till - 1e-9) : 0);
    const partnerOf = (w, s) => { const p = s?.partner ? w.agents[s.partner] : null; return p && !p.isDead ? p : null; };
    const tie = (a, b) => { const v = aff(a, b); return v >= 40 ? '交情很好' : v >= 10 ? '還算熟' : v > -10 ? '沒什麼交情' : '處不來'; };
    // 想自己當老闆的人（跟 canOpen 同一套條件，不看錢）
    const wants = (w, a) => { const amb = w.mind?.amb || {}; return (a.age || 30) >= 20 && a.job?.key !== 'mayor' && (amb[a.agentId]?.key === 'rich' || has(a, 'hardworking') || has(a, 'creative') || a.job?.key === 'trader'); };
    function failDue(w, s, d) {
        if (s.closed || !((s.lossDays || 0) >= FAIL_DAYS || s.till <= -FAIL_DEBT)) return false;
        if (s.failAsk != null && d >= s.failAsk && d - s.failAsk < FAIL_GAP) return false; // 問過的，七天內不再問
        return deciding(w, 'shopFail') && here(w, w.agents[s.owner]);
    }
    function askFail(w, s, d) { s.failAsk = d; st(w).fail++; askNow(w, w.agents[s.owner], 'shopFail', { s: s.id, d }); }
    const liveFail = (w, a, ctx) => { const s = ctx ? S(w).shops.find(x => x.id === ctx.s && !x.closed) : null; return s && a && s.owner === a.agentId && here(w, a) && day(w) - (ctx.d ?? 0) <= 2 ? s : null; };
    function failFacts(w, a, ctx) {
        const s = liveFail(w, a, ctx); if (!s) return ''; const T0 = typeOf(s); const same = S(w).shops.filter(x => !x.closed && typeOf(x) === T0).length; const p = partnerOf(w, s);
        return fill('你的「{n}」（{ty}）開了 {days} 天，已經連虧 {ld} 天，店裡欠了 {debt} 銀幣（連虧 15 天或欠到 40 就撐不下去了）。最近一週{wk}。鎮上做{ty}的連你有 {same} 家。{pt}你身上有 {c} 銀幣。',
            { n: nm(s), ty: T0.zh, days: day(w) - (s.opened ?? day(w)), ld: s.lossDays || 0, debt: debtOf(s), wk: plOf(weekNet(s)), same, pt: p ? { k: '你跟{p}合夥，進帳兩人對分。', p: { p: p.name } } : '你沒有合夥人。', c: Math.floor(cash(w, a)) });
    }
    // 可以找誰合夥：交情好（40 以上）、手頭寬裕、自己沒有店的人
    const joiners = (w, a) => npcs(w).filter(o => o !== a && here(w, o) && (o.age ?? 30) >= 18 && cash(w, o) >= JOIN_COST + 10 && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a));
    // 想接手的人：想自己當老闆、自己沒有店、付得出頂讓金
    const taker = (w, a, s) => npcs(w).filter(o => o !== a && o.agentId !== s?.partner && here(w, o) && wants(w, o) && !shopOf(w, o) && cash(w, o) >= TAKE_COST + 5).sort((x, y) => aff(y, a) - aff(x, a) || cash(w, y) - cash(w, x))[0] || null;
    // 傾向：不服輸、愛面子的會撐（貼錢）；節儉、謹慎的早點收（有人要接就頂讓，拿點錢走）
    function failOptions(w, a, ctx) {
        const s = liveFail(w, a, ctx); if (!s) return []; const out = []; const c = cash(w, a); const debt = Math.round(Math.max(0, -s.till) * 100) / 100; const T0 = typeOf(s); const sn = nm(s);
        const go = (fn) => (w2, a2) => { const s2 = liveFail(w2, a2, ctx); return s2 ? fn(w2, a2, s2) : null; };
        const stub = has(a, 'ambitious') || has(a, 'jealous'), thrifty = has(a, 'thrifty'), wary = has(a, 'neurotic') || has(a, 'pessimist'), late = (s.lossDays || 0) >= 13;
        if (debt >= 1 && c >= debt + 5) out.push({ id: 'prop', text: { k: '自己掏 {n} 銀幣把店裡欠的補上，撐下去', p: { n: Math.ceil(debt) } }, say: { k: '自己掏 {n} 銀幣貼進「{s}」', p: { n: Math.ceil(debt), s: sn } }, why: '這家店是我的心血，不能就這樣認輸。',
            base: 0.9 + (stub ? 0.4 : 0) + (has(a, 'optimist') ? 0.2 : 0) - (thrifty ? 0.6 : 0) - (wary ? 0.3 : 0) + clampN((c / debt - 2) * 0.05, -0.2, 0.3), lean: { face: 0.6, safe: -0.3 }, run: go(prop) });
        if (s.price > Math.max(1, T0.price - 2)) out.push({ id: 'cut', text: { k: '降價：一份從 {a} 銀幣降到 {b} 銀幣，拉客人回來', p: { a: s.price, b: s.price - 1 } }, say: { k: '把「{s}」降價到 {b} 銀幣', p: { s: sn, b: s.price - 1 } }, why: '便宜一點，客人才會上門。',
            base: 0.6 + (s.price > T0.price ? 0.4 : 0) + (has(a, 'kind') ? 0.2 : 0) - (has(a, 'greedy') ? 0.4 : 0), lean: { gain: 0.2, bond: 0.1 }, run: go(cutPrice) });
        if (!partnerOf(w, s)) for (const f of joiners(w, a).slice(0, 2)) out.push({ id: 'partner:' + f.agentId, text: { k: '找{p}合夥：他出 {n} 銀幣，之後進帳兩人對分（要他答應才算）', p: { p: f.name, n: JOIN_COST } }, say: { k: '找{p}合夥撐「{s}」', p: { p: f.name, s: sn } }, why: { k: '{p}跟我交情好，手頭也寬裕，兩個人一起撐比較撐得住。', p: { p: f.name } },
            base: 0.7 + clampN(aff(a, f) / 80, 0, 0.6) - (has(a, 'jealous') ? 0.3 : 0) - (has(a, 'greedy') ? 0.3 : 0), lean: { bond: 0.5, face: -0.2 }, run: go((w2, a2, s2) => askJoin(w2, a2, s2, w2.agents[f.agentId])) });
        const tk = taker(w, a, s); if (tk) out.push({ id: 'sell:' + tk.agentId, text: { k: '把店面頂讓給{t}：他付 {n} 銀幣，改開他自己的{ty}', p: { t: tk.name, n: TAKE_COST, ty: TYPES[typeFor(tk)].zh } }, say: { k: '把「{s}」頂讓給{t}', p: { s: sn, t: tk.name } }, why: '撐下去只會越賠越多，趁還有人要接，拿點錢走。',
            base: 0.9 + (thrifty ? 0.7 : 0) + (wary ? 0.3 : 0) - (stub ? 0.4 : 0) + (late ? 0.3 : 0), lean: { safe: 0.6, face: -0.4, gain: 0.2 }, run: go((w2, a2, s2) => sell(w2, a2, s2, w2.agents[tk.agentId])) });
        out.push({ id: 'close', text: '把店收掉，不再賠下去', say: { k: '把「{s}」收掉', p: { s: sn } }, why: '再撐下去只是把錢往水裡丟。',
            base: 0.5 + (thrifty ? 0.7 : 0) + (wary ? 0.3 : 0) - (stub ? 0.4 : 0) + (late ? 0.3 : 0) + (c < debt ? 0.4 : 0), lean: { safe: 0.6, face: -0.4 }, run: go((w2, a2, s2) => { close(w2, s2, 'quit'); st(w2).quit++; return { k: '店收掉了' }; }) });
        out.push({ id: 'wait', quiet: true, mute: true, text: '先不動，再撐幾天看看', say: { k: '「{s}」再撐幾天看看', p: { s: sn } }, why: '生意有起有落，說不定過幾天就好了。', base: 0.5 + (has(a, 'optimist') ? 0.3 : 0), lean: { face: 0.3, safe: 0.1 }, run: () => ({ k: '先不動，再撐幾天看看' }) });
        return out;
    }
    // 自己掏錢把店裡欠的補上：欠的是攤位、柴火、進貨的開銷，錢付給公庫（跟每天的開銷同一個去處）
    function prop(w, a, s) {
        const n = Math.round(Math.max(0, -s.till) * 100) / 100; if (!(n > 0) || !WALLET.take(w, a, n)) return { k: '錢不夠，沒貼成' };
        w.stockpile?.add?.('silver', n, w.tickCount, t('店租與營業開銷')); s.till = 0; s.lossDays = 0; st(w).prop++;
        log(w, '💪 {a}自己掏了 {n} 銀幣貼進「{s}」，咬牙撐下去。', { a: a.name, n: Math.round(n), s: nm(s) }, a.name); mem(w, a, '我自己掏了 {n} 銀幣貼進「{s}」，一定要撐過去。', { n: Math.round(n), s: nm(s) }, 7);
        return { k: '貼了 {n} 銀幣進店裡', p: { n: Math.round(n) } };
    }
    function cutPrice(w, a, s) {
        const T0 = typeOf(s); if (!(s.price > Math.max(1, T0.price - 2))) return null; s.price -= 1; st(w).cut++;
        log(w, '🏷️ 「{s}」降價了，一份只要 {b} 銀幣。', { s: nm(s), b: s.price }, a.name); return { k: '降價到一份 {b} 銀幣', p: { b: s.price } };
    }
    // 找朋友合夥：對方也要被問、答應才算（選擇點 shopJoin）
    function askJoin(w, a, s, f) {
        if (!f || !here(w, f) || shopOf(w, f) || partnerOf(w, s)) return { k: '沒找成' };
        s.joinAsk = { by: f.agentId, d: day(w) }; DECIDE.enqueue(w, f, 'shopJoin', { s: s.id, from: a.agentId, d: day(w) });
        return { k: '去找{p}商量合夥', p: { p: f.name } };
    }
    const liveJoin = (w, a, ctx) => { const s = ctx ? S(w).shops.find(x => x.id === ctx.s && !x.closed) : null; const o = s ? w.agents[s.owner] : null; return s && o && !o.isDead && s.owner === ctx.from && s.joinAsk?.by === a?.agentId && !partnerOf(w, s) && here(w, a) && !shopOf(w, a) && day(w) - (ctx.d ?? 0) <= 2 ? s : null; };
    function joinFacts(w, a, ctx) {
        const s = liveJoin(w, a, ctx); if (!s) return ''; const o = w.agents[s.owner];
        return fill('{o}開的「{n}」（{ty}）生意不好：已經連虧 {ld} 天，店裡欠了 {debt} 銀幣，最近一週{wk}。他想找你合夥：你出 {m} 銀幣，先拿去補店裡欠的，剩下的給他；之後每天的進帳兩人對分。你跟{o}{tie}。你身上有 {c} 銀幣。',
            { o: o.name, n: nm(s), ty: typeOf(s).zh, ld: s.lossDays || 0, debt: debtOf(s), wk: plOf(weekNet(s)), m: JOIN_COST, tie: tie(a, o), c: Math.floor(cash(w, a)) });
    }
    function joinOptions(w, a, ctx) {
        const s = liveJoin(w, a, ctx); if (!s) return []; const o = w.agents[s.owner]; const go = (fn) => (w2, a2) => { const s2 = liveJoin(w2, a2, ctx); return s2 ? fn(w2, a2, s2) : null; };
        const out = [];
        if (cash(w, a) >= JOIN_COST) out.push({ id: 'join', text: { k: '答應，出 {n} 銀幣跟{o}合夥', p: { n: JOIN_COST, o: o.name } }, say: { k: '出錢跟{o}合夥開「{s}」', p: { o: o.name, s: nm(s) } }, why: { k: '{o}有難，朋友就該拉一把。', p: { o: o.name } },
            base: 0.6 + clampN(aff(a, o) / 60, 0, 1) * 0.8 + (has(a, 'generous') ? 0.4 : 0) + (has(a, 'kind') ? 0.3 : 0) + (has(a, 'ambitious') ? 0.2 : 0) - (has(a, 'thrifty') ? 0.5 : 0) - (has(a, 'greedy') ? 0.3 : 0) + (weekNet(s) > 0 ? 0.3 : -0.2), lean: { bond: 0.6, gain: 0.1, safe: -0.3 }, run: go(join) });
        out.push({ id: 'no', text: '婉拒，這筆錢不想冒險', say: { k: '婉拒了{o}的合夥', p: { o: o.name } }, why: '那家店在賠錢，錢放進去多半拿不回來。', base: 1.0, lean: { safe: 0.5 },
            run: go((w2, a2, s2) => { s2.joinAsk = null; const o2 = w2.agents[s2.owner]; mem(w2, o2, '{p}不想跟我合夥撐「{s}」。', { p: a2.name, s: nm(s2) }, 5); return { k: '沒答應{o}', p: { o: o2?.name || '' } }; }) });
        return out;
    }
    function join(w, p, s) {
        const o = w.agents[s.owner]; const m = JOIN_COST; if (!o || !WALLET.take(w, p, m)) return { k: '錢不夠，沒合夥成' };
        const debt = Math.min(m, Math.round(Math.max(0, -s.till) * 100) / 100); if (debt > 0) { w.stockpile?.add?.('silver', debt, w.tickCount, t('店租與營業開銷')); s.till = Math.min(0, Math.round((s.till + debt) * 100) / 100); } // 先補店裡欠的（付給公庫），剩下的給老闆
        if (m - debt > 0.001) WALLET.add(w, o, Math.round((m - debt) * 100) / 100); if (s.till >= 0) { s.till = 0; s.lossDays = 0; }
        s.partner = p.agentId; s.joinAsk = null; st(w).join++;
        log(w, '🤝 {b}出了 {n} 銀幣，跟{a}合夥撐「{s}」。', { b: p.name, n: m, a: o.name, s: nm(s) }, p.name); mem(w, p, '我出錢跟{a}合夥撐「{s}」。', { a: o.name, s: nm(s) }, 7); mem(w, o, '{b}答應跟我合夥，「{s}」有救了。', { b: p.name, s: nm(s) }, 7);
        return { k: '出了 {n} 銀幣跟{o}合夥', p: { n: m, o: o.name } };
    }
    // 頂讓：想接的人付頂讓金給店主，舊店收掉，新店主在同一個店面開他自己那一行的店（鎮上店數不變）
    function sell(w, a, s, tk) {
        if (!tk || !here(w, tk) || shopOf(w, tk) || cash(w, tk) < TAKE_COST || !WALLET.take(w, tk, TAKE_COST)) return { k: '對方沒接成' };
        WALLET.add(w, a, TAKE_COST); const f = frontOf(w, s); const old = nm(s); close(w, s, 'sold'); st(w).sold++;
        log(w, '🔑 {a}把「{n}」的店面頂讓給{b}，收了 {m} 銀幣頂讓金。', { a: a.name, n: old, b: tk.name, m: TAKE_COST }, a.name);
        mem(w, a, '我把「{n}」頂讓給{b}，收了 {m} 銀幣，總算不用再賠。', { n: old, b: tk.name, m: TAKE_COST }, 7); mem(w, tk, '我花 {m} 銀幣頂下了{a}的店面。', { m: TAKE_COST, a: a.name }, 7);
        const s2 = mkShop(w, S(w), tk, typeFor(tk), null, day(w), f && !f.shop ? f : null);
        return { k: '頂讓給{t}了，收了 {n} 銀幣', p: { t: tk.name, n: TAKE_COST }, shop: s2.id };
    }

    // ================= v11.6.0 老闆不在了：合夥人、配偶、成年子女接不接（選擇點 shopHeir） =================
    const ownerName = (w, id) => w.agents[id]?.name || w.departedNames?.[id] || w._nameCache?.[id] || (w.movedOut || []).find(x => x?.id === id)?.name || '';
    const ownerDead = (w, id) => { const n = ownerName(w, id); return !!w.agents[id]?.isDead || (w.lifecycle?.graveyard || []).some(g => g && (g.agentId === id || (n && g.name === n))); };
    // 先問合夥人；再來是配偶、成年子女（跟產業繼承同一套：結了婚的先、年紀大的先）。接手的人如果已經有自己的店就不問
    // leaving＝老闆活著搬走或被驅逐：照 sim-exile.js 原本的順序，家人在前（不用錢）、合夥人在後（要照八折付錢買下，錢讓老闆帶走）
    function heirsFor(w, s, leaving) {
        const id = s.owner, oname = ownerName(w, id); const out = [], seen = new Set([id]);
        const add = (a, r, price) => { if (!a || seen.has(a.agentId) || a.isPlayer || a.isDead || (a.age ?? 30) < 16) return; seen.add(a.agentId); out.push(price != null ? { id: a.agentId, r, price } : { id: a.agentId, r }); };
        if (!leaving) add(partnerOf(w, s), 'partner');
        const wed = (o) => o.relationships?.relationships?.[id]?.status === 'married';
        const fam = npcs(w).filter(o => o.agentId !== id && (wed(o) || (oname && (o._parentNames || []).includes(oname) && (o.age || 0) >= 16))).sort((x, y) => wed(y) - wed(x) || (y.age || 0) - (x.age || 0));
        for (const o of fam) add(o, wed(o) ? 'spouse' : 'child');
        if (leaving) add(partnerOf(w, s), 'buyer', buyPrice(w, s));
        return out;
    }
    // 合夥人買下搬走老闆的店：價錢沿用 sim-exile.js 的估價八折（EXILE.partnerPrice），不另寫一套
    const buyPrice = (w, s) => { try { return typeof EXILE !== 'undefined' && EXILE.partnerPrice ? EXILE.partnerPrice(w, { t: 'shop', s, boss: true, name: s.name?.[0] || '' }) : 0; } catch (e) { return 0; } };
    function heirStep(w, s, d) {
        if (!deciding(w, 'shopHeir')) return false; // 決策核心沒開：照舊收掉
        if (!s.heir) { const G = s.gone && s.gone.id === s.owner ? s.gone : null; const q = G ? G.q : heirsFor(w, s); if (!q.length) return false;
            s.heir = { q: q.map(x => x.id), r: q.map(x => x.r), p: q.map(x => x.price || 0), i: 0, at: null, from: s.owner, name: G?.name || ownerName(w, s.owner), dead: G ? !!G.dead : ownerDead(w, s.owner) }; st(w).heir++; }
        const H = s.heir;
        for (let g = 0; g < 8 && s.heir === H && !s.closed; g++) {
            if (H.i >= H.q.length) return false;
            if (H.at != null) { if (d >= H.at && d - H.at < HEIR_WAIT) return true; H.i++; H.at = null; continue; } // 問了好幾天沒下文：問下一位
            const c = w.agents[H.q[H.i]]; const own = c ? shopOf(w, c) : null;
            if (!here(w, c) || (own && own !== s)) { H.i++; continue; }
            H.at = d; askNow(w, c, 'shopHeir', { s: s.id, d });
        }
        return s.heir !== H || s.closed ? true : H.i < H.q.length;
    }
    // 老闆要走了（過世、搬走）：這家店要不要留給「問接不接」處理（決策核心開著、也有人可以問）。sim-exile.js 看這個決定要不要照舊直接交給合夥人或家人
    const deferHeir = (w, s) => !!s && !s.closed && deciding(w, 'shopHeir') && (s.gone && s.gone.id === s.owner && s.gone.d === day(w) ? s.gone.q.length > 0 : heirsFor(w, s, true).length > 0);
    // 老闆過世、搬走的那一刻記下誰可以接（過世以後配偶的關係會被改成「前任」、人也會從鎮上移除，事後就找不到了）
    // 同一天已經記過的不蓋掉（搬走時 sim-exile.js 會在拆散婚姻之前先記一次，之後 leaveTown 再叫一次時配偶已經是前任了）
    function noteGone(w, a, dead) { if (!w?.biz || !a) return; const d = day(w); for (const s of S(w).shops) if (!s.closed && s.owner === a.agentId && !(s.gone && s.gone.id === a.agentId && s.gone.d === d && !!s.gone.dead === !!dead)) s.gone = { id: a.agentId, name: a.name, dead: !!dead, d, q: heirsFor(w, s, !dead) }; }
    const liveHeir = (w, a, ctx) => { const s = ctx ? S(w).shops.find(x => x.id === ctx.s && !x.closed) : null; const H = s?.heir; if (!H || !a || H.q[H.i] !== a.agentId || !here(w, a) || day(w) - (ctx.d ?? 0) > 2) return null; const own = shopOf(w, a); return own && own !== s ? null : s; };
    const ROLE = { partner: '你是這家店的合夥人。', spouse: '你是{o}的配偶。', child: '你是{o}的孩子。', buyer: '你是這家店的合夥人。{o}的家人沒有接，你要接下來，得照八折付他 {p} 銀幣買下他那一份（錢讓他帶走）。' };
    const priceNow = (H) => +(H?.p?.[H.i] || 0);
    function heirFacts(w, a, ctx) {
        const s = liveHeir(w, a, ctx); if (!s) return ''; const H = s.heir; const r = H.r?.[H.i] || 'child'; const dt = debtOf(s);
        return fill('{o}{how}，留下了「{n}」（{ty}，開了 {days} 天，最近一週{wk}，{debt}）。{rel}接下來就是你自己開，店名照舊；不接的話店就收掉，店面空下來。你身上有 {c} 銀幣。',
            { o: H.name || '', how: H.dead ? '過世了' : '搬離小鎮了', n: nm(s), ty: typeOf(s).zh, days: day(w) - (s.opened ?? day(w)), wk: plOf(weekNet(s)), debt: dt ? { k: '店裡欠了 {n} 銀幣', p: { n: dt } } : '店裡沒有欠錢', rel: { k: ROLE[r] || ROLE.child, p: { o: H.name || '', p: priceNow(H) } }, c: Math.floor(cash(w, a)) });
    }
    function heirOptions(w, a, ctx) {
        const s = liveHeir(w, a, ctx); if (!s) return []; const H = s.heir; const r = H.r?.[H.i] || 'child'; const sn = nm(s); const wk = weekNet(s); const amb = w.mind?.amb?.[a.agentId]?.key;
        const go = (fn) => (w2, a2) => { const s2 = liveHeir(w2, a2, ctx); return s2 ? fn(w2, a2, s2) : null; };
        const price = r === 'buyer' ? priceNow(H) : 0; const out = [];
        if (!(price > 0) || cash(w, a) >= price) out.push( // 合夥人買下要付錢：錢不夠就不列「接下來」，只能不接
            price > 0 ? { id: 'take', text: { k: '花 {p} 銀幣買下「{n}」，自己開下去（店名照舊）', p: { n: sn, p: price } }, say: { k: '花 {p} 銀幣買下{o}留下的「{n}」', p: { o: H.name || '', n: sn, p: price } }, why: '這家店我也出過力，不能讓它就這樣收掉。',
                base: 0.6 + 0.8 + (has(a, 'ambitious') ? 0.3 : 0) + (has(a, 'hardworking') ? 0.3 : 0) + (amb === 'rich' ? 0.4 : 0) - (has(a, 'lazy') ? 0.6 : 0) + (wk > 0 ? 0.3 : wk < 0 ? -0.4 : 0) - ((a.age ?? 30) >= 65 ? 0.5 : 0) - (has(a, 'thrifty') ? 0.3 : 0) - Math.min(0.6, price / Math.max(1, cash(w, a))), lean: { bond: 0.3, gain: 0.3, safe: -0.2 }, run: go(inherit) } :
            { id: 'take', text: { k: '接下「{n}」，自己開下去（店名照舊）', p: { n: sn } }, say: { k: '接下{o}留下的「{n}」', p: { o: H.name || '', n: sn } }, why: { k: '{o}的心血不能就這樣收掉。', p: { o: H.name || '' } },
                base: 0.6 + ({ partner: 0.8, spouse: 0.5, child: 0.3 }[r] || 0) + (has(a, 'ambitious') ? 0.3 : 0) + (has(a, 'hardworking') ? 0.3 : 0) + (amb === 'rich' ? 0.4 : 0) - (has(a, 'lazy') ? 0.6 : 0) + (wk > 0 ? 0.3 : wk < 0 ? -0.4 : 0) - ((a.age ?? 30) >= 65 ? 0.5 : 0), lean: { bond: 0.4, gain: 0.3 }, run: go(inherit) });
        out.push(
            { id: 'no', text: '不接，讓店收掉', say: { k: '沒有接{o}留下的「{n}」', p: { o: H.name || '', n: sn } }, why: '我沒有心力開店。', base: 1.0 + ((a.age ?? 30) >= 60 ? 0.4 : 0), lean: { safe: 0.4, joy: 0.2 },
                run: go((w2, a2, s2) => { const H2 = s2.heir; H2.i++; H2.at = null; mem(w2, a2, '{o}留下的「{n}」，我沒有接。', { o: H2.name || '', n: nm(s2) }, 6); return { k: '沒有接「{n}」', p: { n: nm(s2) } }; }) });
        return out;
    }
    function inherit(w, a, s) {
        const H = s.heir; const was = H?.name || ''; const price = H?.r?.[H.i] === 'buyer' ? priceNow(H) : 0;
        // 合夥人買下搬走老闆的店：錢從他身上付到老闆留在錢包帳上的那一格（人已經走了）。跟 sim-exile.js 原本「老闆帶著賣店的錢走」同一條帳：
        // 錢包模組（sim-wallet.js daily）看到不在鎮上的人還有錢，扣離境稅後記成「搬走的人帶走」(MONEY.flow 'emigrant')
        if (price > 0) { const W0 = w.wallet; if (!W0?.bal || !WALLET.take(w, a, price)) return { k: '錢不夠，沒買成' }; W0.bal[H.from] = Math.round(((+W0.bal[H.from] || 0) + price) * 100) / 100; st(w).bought = (st(w).bought || 0) + 1;
            log(w, '🤝 {a}照八折付了 {n} 銀幣給搬走的{o}，買下「{s}」。', { a: a.name, n: price, o: was, s: nm(s) }, a.name); } if (s.partner === a.agentId) s.partner = null; s.owner = a.agentId; s.heir = null; s.gone = null; st(w).took++;
        log(w, '🏪 {a}接下了{o}留下的「{n}」，店名照舊。', { a: a.name, o: was, n: nm(s) }, a.name); mem(w, a, '我接下了{o}留下的「{n}」，要好好開下去。', { o: was, n: nm(s) }, 8);
        return { k: '接下了「{n}」', p: { n: nm(s) } };
    }

    // ================= v11.6.0 空太久的店面：提案拆掉（走 sim-demolish.js 同一套表決） =================
    function demoList(w) { const d = day(w); return fronts(w).filter(f => !f.shop && f.idle != null).map(f => ({ id: 'p:' + f.id, kind: 'p', key: f.id, name: frontName(f), icon: '🪧', level: 1, upkeep: 0, costs: {}, jobs: [], workers: [], age: d - f.idle })); }
    function demoEnact(w, key) { const B = S(w); const i = B.fronts.findIndex(f => f.id === key && !f.shop); if (i < 0) return false; B.fronts.splice(i, 1); st(w).razed++; return true; }
    // 住在附近的人（家在店面六格內）
    function nearIds(w, f) {
        const out = new Set(); const tm = tmOf(w); const M = tm?._agentHouseMap; if (!M || !f) return out;
        for (const [aid, hid] of Object.entries(M)) { const z = tm.buildingZones?.[hid]; if (z && Math.max(Math.abs(z.x + z.w / 2 - f.x - 0.5), Math.abs(z.y + z.h / 2 - f.y - 0.5)) <= 6) out.add(aid); }
        return out;
    }
    // 在意這件事的程度：住附近、看重整潔（完美主義）或傳統、想把那裡還給花草；想自己開店的人捨不得拆
    function care(w, a, near) { return (near.has(a.agentId) ? 1.0 : 0) + (has(a, 'perfectionist') ? 0.8 : 0) + (hasV(a, '傳統') ? 0.6 : 0) + (hasV(a, '自然') ? 0.5 : 0) - (wants(w, a) && !shopOf(w, a) ? 1.0 : 0); }
    function demoVote(w, p, a, x) {
        if (a.agentId === p.proposerId) return { v: 'for', why: 'demolish_mine' };
        const f = fronts(w).find(o => o.id === x?.key); const near = nearIds(w, f); const rel = (a.relationships?.relationships?.[p.proposerId]?.affinity || 0) / 40; const keen = wants(w, a) && !shopOf(w, a);
        const sc = -0.3 + rel + (Math.random() - 0.5) * 2 + (near.has(a.agentId) ? 1.0 : 0) + (has(a, 'perfectionist') ? 0.6 : 0) + (hasV(a, '傳統') ? 0.4 : 0) + (hasV(a, '自然') ? 0.3 : 0) - (keen ? 1.2 : 0);
        const why = sc > 0 ? (near.has(a.agentId) || has(a, 'perfectionist') ? 'demolish_eyesore' : rel >= 0.75 ? 'demolish_friend' : 'demolish_fine') : (keen ? 'demolish_spare' : rel <= -0.75 ? 'demolish_foe' : 'demolish_spare');
        return { v: sc > 0 ? 'for' : 'against', why };
    }
    // 每天：空滿 30 天的店面，鎮上最在意的那個人（夠在意才提）提案拆掉；一週最多提一次，同一間被否決後照拆除案的規矩 20 天內不再提
    function demoDaily(w) {
        const DM = typeof DEMOLISH !== 'undefined' ? DEMOLISH : null; if (!DM || typeof TECH === 'undefined' || !w.observerMode) return null; const B = S(w), d = day(w);
        if (!B.fronts.some(f => !f.shop && f.idle != null && d - f.idle >= IDLE_DEMO) || d - (B.demoAt ?? -99) < 7) return null;
        const L = DM.list(w).filter(x => x.kind === 'p' && DM.okNow(w, x, false)).sort((p, q) => q.age - p.age); if (!L.length) return null;
        const x = L[0]; const f = B.fronts.find(o => o.id === x.key); const near = nearIds(w, f); let best = null, bs = 0.99;
        for (const a of npcs(w)) { if ((a.age ?? 30) < 16 || !here(w, a) || String(a.agentId).startsWith('visit_')) continue; const c = care(w, a, near); if (c > bs) { bs = c; best = a; } }
        if (!best) return null; B.demoAt = d;
        const why = near.has(best.agentId) ? t('那間空店面就在我家附近，一直空著沒人用，擺著難看。') : hasV(best, '自然') && !has(best, 'perfectionist') ? t('空店面一直沒人用，不如拆掉還給空地，長點花草。') : t('空店面一直沒人用，風吹雨打快塌了，留著礙眼。');
        return DM.propose(w, x.id, best, why);
    }

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
    function view(w) { const B = S(w); return { shops: B.shops.map(s => ({ icon: typeOf(s).icon, name: en() ? s.name[1] : s.name[0], type: t(typeOf(s).zh), owner: whoName(w, s.owner), partner: s.partner ? whoName(w, s.partner) : null, profit: Math.round(s.profit), price: s.price })), closed: B.closed.slice(-3).map(c => ({ name: en() ? c.name[1] : c.name[0], profit: c.profit })), fronts: { n: B.fronts.length, open: B.fronts.filter(f => f.shop).length, idle: B.fronts.filter(f => !f.shop).length } }; } // v11.6.0 店面幾間、空著幾間
    function chip(w, a) { const s = shopOf(w, a); if (!s) return ''; return `${typeOf(s).icon} ${s.owner === a.agentId ? t('老闆') : t('合夥人')}${t('：')}${en() ? s.name[1] : s.name[0]}`; }
    return { TYPES, LEGACY, S, open, trade, weekly, close, daily, haggle, vet, view, chip, shopOf, bizLoan, loanOk, typeFor, typeOf, kindsFor, countOf, migrate, startInfo, start, startTry, split, splitInfo, splitBy,
        fronts, frontOf, vacant, spot, noteGone, deferHeir, freeOf, placeFront, syncMap, frontInfo, frontName, weekNet, failDue, askFail, failFacts, failOptions, joinFacts, joinOptions, heirsFor, heirStep, heirFacts, heirOptions, demoList, demoEnact, demoVote, demoDaily, nearIds, wants,
        NEW_COST, TAKE_COST, JOIN_COST, FRONT_R, FAIL_DAYS, FAIL_DEBT, FAIL_GAP, IDLE_DEMO, HEIR_WAIT };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BIZ.daily(w); } catch (e) { console.warn('[Biz] daily', e); } return r; };
}
// v11.6.0 老闆過世、搬走的那一刻記下誰可以接店（BIZ.noteGone）
if (typeof LifecycleSystem !== 'undefined') { const LS = LifecycleSystem.prototype; const _kill = LS._killNpc; if (typeof _kill === 'function') LS._killNpc = function (world, npc, ...rest) { try { BIZ.noteGone(world, npc, true); } catch (e) {} return _kill.call(this, world, npc, ...rest); }; }
if (typeof World !== 'undefined') for (const m of ['leaveTown', 'relocateOut']) { const f = World.prototype[m]; if (typeof f === 'function') World.prototype[m] = function (id, ...rest) { try { BIZ.noteGone(this, this.agents?.[id], false); } catch (e) {} return f.call(this, id, ...rest); }; }
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
    BANK.lendReply = (B, a) => { const r = BANK.deskReply ? BANK.deskReply(B, a) : null; if (r) return r; const x = B ? waits.get(B) : null; return x && a && x.id === a.agentId ? x.p : null; }; // v11.6.0 先看是不是在等銀行家（決策核心）回話
    BANK.lend = function (w, B, a, n, why, opt) {
        { const r = BANK.apply ? BANK.apply(w, B, a, n, why, opt) : null; if (r != null) return r; } // v11.6.0 銀行家在鎮上、決策核心開著：借不借由他決定（sim-bank.js 的 bankDesk）；下面是原本的規則
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
