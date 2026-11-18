// v6.64.0 銀行:存款、放貸、利息、擠兌與倒閉
// - 城鎮以上才有銀行;銀行家是鎮上最有錢的商人(沒有就最有錢的大人)
// - 手頭寬裕又謹慎的人把錢存進去,每七天拿利息;手頭緊或想翻修房子的人來借錢,每天從收入還一點
// - 銀行最多貸出存款的七成;利率由銀行家決定(完整智能體模式由 AI 依銀行狀況決定,否則依放款風險)
// - 還不出錢就變呆帳,借款人名聲受損;謠言(八卦的人、放款太多、外地壞消息)會引發擠兌,準備金不夠就倒閉,存戶血本無歸
// - v6.74.0 擠兌紓困:銀行家先掏自己的錢補;還不夠就由鎮長(沒有鎮長就國王)決定要不要紓困(完整智能體模式由 AI 決定並說理由)
//   紓困的錢以鎮公所名義向外地錢莊借,連本帶利一成,每天從公庫還;公庫還不出就加罰息。不紓困,銀行照舊倒閉
// - v6.74.0 債券:銀行家可以發行債券(三十天到期、付利息);擠兌時順序是 銀行家自掏腰包 → 發債券 → 請鎮長紓困;平時準備金太低也會發
//   買債券的錢鎖到到期,擠兌時領不走;信任銀行家、手頭寬裕的人才會買;到期付不出來就違約,銀行倒了債券變廢紙
const BANK = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('trade', k, p || {}, who || ''); } catch (e) {} };
    const tierLv = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    const r1 = (n) => Math.round(n * 10) / 10;
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    // v9.24.0 擠兌時領不領、債券買不買，交給本人決定(sim-decide-share.js)
    const treasury = (w) => w.stockpile?.get?.('silver') || 0;
    const INTEREST = 0.1; // 紓困借款利息
    function S(w) {
        if (!w.bank || typeof w.bank.dep !== 'object') w.bank = { open: false, banker: null, dep: {}, loans: {}, reserve: 0, rate: 0.08, depRate: 0.01, status: 'ok', bad: 0, runDay: null, lastDay: null, history: [] };
        const B = w.bank; B.dep = B.dep || {}; B.loans = B.loans || {}; B.bonds = Array.isArray(B.bonds) ? B.bonds : []; return B;
    }
    const totalDep = (B) => Object.values(B.dep).reduce((s, v) => s + v, 0);
    // v11.3.0 呆帳多少才會引發擠兌：以前固定 40 銀幣（城市存款幾千，一筆倒帳就一直掛著擠兌的機率）；現在是 40 與存款的 5% 取大的（存款 800 以內照舊）
    const badLine = (B) => Math.max(40, totalDep(B) * 0.05);
    const totalLoan = (B) => Object.values(B.loans).reduce((s, l) => s + (l.owed || 0), 0);
    function pickBanker(w) { const all = npcs(w).filter(a => a.age >= 20); const tr = all.filter(a => a.job?.key === 'trader'); return (tr.length ? tr : all).sort((x, y) => cash(w, y) - cash(w, x))[0] || null; }
    function openBank(w, B) {
        const b = pickBanker(w); if (!b) return; B.open = true; B.status = 'ok'; B.banker = b.agentId; B.openDay = day(w); B.bad = 0; // v6.87.0 重新開張,舊呆帳不算
        const seed = Math.min(150, Math.floor(cash(w, b) * 0.4)); if (seed > 0 && WALLET.take(w, b, seed)) B.reserve += seed; // 銀行家出本錢
        log(w, '🏦 {a}開了鎮上第一家銀行，存錢有利息，也可以借錢。', { a: b.name }, b.name);
        mem(w, b, '我開了銀行，鎮上的錢都會經過我手上。', {}, 8);
    }
    const lendable = (B) => Math.max(0, B.reserve - totalDep(B) * 0.3); // 準備金留三成給存戶
    function deposit(w, B, a, n) { n = Math.floor(n); if (n < 1 || !WALLET.take(w, a, n)) return 0; B.dep[a.agentId] = (B.dep[a.agentId] || 0) + n; B.reserve += n; return n; }
    function withdraw(w, B, a, n) { const have = B.dep[a.agentId] || 0; n = Math.min(have, Math.floor(n)); const paid = Math.min(n, Math.floor(B.reserve)); if (paid <= 0) return 0; B.reserve -= paid; B.dep[a.agentId] = have - paid; if (B.dep[a.agentId] <= 0) delete B.dep[a.agentId]; WALLET.add(w, a, paid); return paid; }
    function lend(w, B, a, n, why) {
        n = Math.floor(Math.min(n, lendable(B))); if (n < 5 || B.loans[a.agentId]) return 0;
        const risk = (a.job ? 0 : 0.05) + (has(a, 'lazy') ? 0.04 : 0) + (cash(w, a) < 5 ? 0.02 : 0); const rate = r1((B.rate + risk) * 100) / 100;
        B.reserve -= n; WALLET.add(w, a, n); B.loans[a.agentId] = { owed: Math.round(n * (1 + rate)), principal: n, rate, day: day(w), due: day(w) + 20, why: why || '' };
        mem(w, a, '我跟銀行借了 {n} 銀幣（{why}），利息 {r}%。', { n, why: why || '周轉', r: Math.round(rate * 100) }, 6);
        return n;
    }
    function daily(w) {
        if (!W() || !w.wallet) return; const B = S(w), d = day(w); if (B.lastDay === d) return; B.lastDay = d;
        repayDebt(w, B, d); // v6.74.0 紓困債:銀行倒了也照樣要還
        if (!B.open) { if (tierLv(w) >= 1 && B.status !== 'failed') openBank(w, B); else if (B.status === 'failed' && d - (B.failDay || d) >= 30 && tierLv(w) >= 1) { B.status = 'ok'; openBank(w, B); } return; }
        const banker = w.agents[B.banker]; if ((!banker && !w.isAway?.(B.banker)) || banker?.isDead) { /* v9.9.4 銀行家出遠門不換人 */ const nb = pickBanker(w); if (nb) { B.banker = nb.agentId; log(w, '🏦 {a}接手經營銀行。', { a: nb.name }, nb.name); } }
        matureBonds(w, B, d); // v6.74.0 債券到期
        if (B.offer && d > B.offer.until) closeOffer(w, B); // v9.24.0 債券開賣兩天後結算賣了多少
        // v6.87.0 呆帳慢慢沖銷(約三週減半),以前只增不減,呆帳一過 40 就天天有擠兌風險
        B.bad = Math.max(0, Math.round(((B.bad || 0) * 0.97 - 0.5) * 10) / 10);
        // 搬走的人把存款領走(出遠門的人存款留著)
        for (const id of Object.keys(B.dep)) if (!w.agents[id] && !w.isAway?.(id)) { const v = B.dep[id] || 0; const out = Math.min(v, Math.max(0, B.reserve)); B.reserve -= out; /* 不再把負的準備金拉回 0(會憑空生錢) */ delete B.dep[id]; let lv = 0; try { lv = (typeof FISCAL !== 'undefined') ? FISCAL.levy(w, id, out) : 0; } catch (e) {} /* v10.8.0 離境稅 */ if (out - lv > 0 && typeof MONEY !== 'undefined') MONEY.flow(w, 'emigrant', -(out - lv)); } // v8.8.0 搬走的人帶走的存款記到「搬走帶走」
        deskDaily(w, B, d); // v11.6.0 掛著沒回音的借錢申請、利率：隔天照原本的規則
        if (B.status === 'run') { bankRun(w, B, d); return; }
        if (B.reserve < totalDep(B) * 0.35 && totalDep(B) >= 40 && !B.bonds.length && d - (B.lastIssue ?? -99) >= 20 && Math.random() < 0.3) issueBonds(w, B, d, 80, false);
        const all = npcs(w);
        // v9.19.0 存款不再在這裡擲骰:村民「手上有閒錢」時由決策核心(sim-decide.js)自己決定要不要存、存多少
        // 需要錢的人提款
        for (const a of all) if ((B.dep[a.agentId] || 0) > 0 && cash(w, a) < 5) withdraw(w, B, a, 15);
        // 借錢:手頭緊有工作的人周轉;想翻修房子的人
        for (const a of all) {
            if (B.loans[a.agentId]) continue; const c = cash(w, a);
            /* v9.19.0 周轉貸款改由決策核心在村民「手頭很緊」時自己決定 */
            /* v9.22.0 借錢翻修改由住戶本人決定(sim-decide-life.js「家裡的房子舊了」) */
        }
        // 還款:每天從手上的錢還一點;逾期又還不出來就變呆帳
        for (const [id, L] of Object.entries(B.loans)) {
            const a = w.agents[id]; if (!a && w.isAway?.(id)) continue; // v6.87.0 出遠門的人回來再還
            if (!a || a.isDead) { if (!(typeof ESTATE !== 'undefined' && ESTATE.foreclose(w, id, L))) B.bad += L.owed; delete B.loans[id]; continue; } // v6.90.0 有抵押品就收房子
            const pay = Math.min(L.owed, Math.max(1, Math.floor(cash(w, a) * 0.2))); if (cash(w, a) >= pay && pay > 0 && WALLET.take(w, a, pay)) { L.owed -= pay; B.reserve += pay; B.earned = (B.earned || 0) + pay * (L.rate || 0) / (1 + (L.rate || 0)); } // v6.90.0 記下利息收入
            if (L.owed <= 0) { delete B.loans[id]; mem(w, a, '終於把銀行的錢還清了。', {}, 5); continue; }
            if (d > L.due + 10 && cash(w, a) < 3) { if (!lateAsk(w, B, id, L, d)) lateRule(w, B, id, L, a); } else if (L.ask) L.ask = null; // v11.6.0 逾期的人怎麼辦由銀行家決定；等回話的這一天先不動，隔天沒回音照原本的規則
        }
        // 每七天付存款利息、銀行家調整利率
        if (d % 7 === 0) {
            // v6.90.0 存款利息從放款賺到的利息裡付(最多七成),賺不到就付不出;剩下的是銀行家的利潤
            { const want = Object.values(B.dep).reduce((s, v) => s + v * B.depRate, 0); const pool = Math.max(0, (B.earned || 0) * 0.7); const ratio = want > 0 ? Math.min(1, pool / want) : 0;
              let paid = 0; if (ratio > 0) for (const [id, v] of Object.entries(B.dep)) { const it = Math.round(v * B.depRate * ratio * 100) / 100; if (it > 0) { B.dep[id] = v + it; paid += it; } }
              B.earned = Math.max(0, (B.earned || 0) - paid); B.interestPaid = (B.interestPaid || 0) + paid;
              const bk = w.agents[B.banker]; const profit = Math.floor(Math.min(B.earned || 0, Math.max(0, B.reserve - totalDep(B) * 0.4))); if (bk && profit >= 1) { B.reserve -= profit; B.earned -= profit; WALLET.add(w, bk, profit); B.bankerProfit = (B.bankerProfit || 0) + profit; } }
            setRate(w, B);
        }
        // 謠言 → 擠兌
        const ratio = totalDep(B) ? totalLoan(B) / totalDep(B) : 0; const gossip = all.find(a => has(a, 'gossip') && (B.dep[a.agentId] || 0) > 0);
        const badNews = (w.news?.getModifier?.('mood_modifier', 0) || 0) <= -4;
        if (totalDep(B) >= 60 && d - (B.lastRunEnd ?? -99) >= 20 && (ratio > 0.65 || badNews || B.bad > badLine(B)) && Math.random() < (gossip ? 0.12 : 0.05)) startRun(w, B, d, gossip);
    }
    // 原本的公式：放款佔存款越多、呆帳越多，利率越高（4%～20%）
    function rateTarget(B) { const ratio = totalDep(B) ? totalLoan(B) / totalDep(B) : 0; return r1(Math.max(0.04, Math.min(0.2, 0.06 + ratio * 0.08 + (B.bad > 30 ? 0.03 : 0))) * 100) / 100; }
    // v11.6.0 每週定利率：銀行家在鎮上、決策核心開著就由他決定（調高調低一兩成、或不動）；以前開智能體時直接問模型、不經決策核心，現在拿掉
    function setRate(w, B) {
        const b = teller(w, B); const d = day(w);
        if (b) { if (B.rateAsk?.d === d) return; B.rateAsk = { d, done: 0 }; hook(); askNow(w, b, { t: 'rate', d }); return; }
        B.rate = rateTarget(B);
    }
    function startRun(w, B, d, by) {
        B.status = 'run'; B.runDay = d; B.run = { injected: 0, asked: null };
        log(w, '😱 謠言說銀行快撐不住了，存戶擠到銀行門口要領錢！', {}, by?.name || '');
        if (by) mem(w, by, '我聽說銀行要倒了，趕快跟大家說。', {}, 6);
        try { w.dailyNews?.collectEvent?.('event', t('銀行擠兌'), 9, []); } catch (e) {}
    }
    function bankRun(w, B, d) {
        // 存戶搶著領錢;撐過三天謠言平息,準備金領光就倒閉
        // v6.74.0 銀行家先拿自己的錢補;還不夠就請鎮長決定要不要紓困
        const R = B.run || (B.run = { injected: 0, asked: null });
        if (R.asked === 'pending') { if (d - (R.askDay ?? d) < 2) return; const m = leader(w); if (m) { const need = Math.min(500, Math.ceil(totalDep(B) - B.reserve)); const r = ruleBailout(w, B, m, need); decide(w, B, d, m, need, r.yes, r.why, R); } else R.asked = 'none'; } // 鎮長還在考慮,銀行先關門一天;兩天都沒回音就照規則決定
        const banker = w.agents[B.banker];
        if (!R.injected && banker && !banker.isDead && B.reserve < totalDep(B) && injAsk(w, B, banker, R, d)) return; // v11.6.0 押多少自己的錢由銀行家決定；等他回話，銀行先關門一天
        if (!R.injected && banker && !banker.isDead && B.reserve < totalDep(B)) inject(w, B, banker, R);
        if (!R.bonds && banker && !banker.isDead && B.reserve < totalDep(B) * 0.8) { R.bonds = issueBonds(w, B, d, Math.ceil(totalDep(B) - B.reserve), true) || -1; }
        if (!R.asked && B.reserve < totalDep(B) * 0.6) { askBailout(w, B, d, R); if (R.asked === 'pending') return; }
        // 要不要去領，由存戶自己決定(runBy)
        if (totalDep(B) > 0 && B.reserve < 1 && !R.asked) { askBailout(w, B, d, R); if (R.asked === 'pending') return; } // 一天就被領光:倒閉前還是要先問政府
        if (totalDep(B) > 0 && B.reserve < 1) return fail(w, B, d);
        if (d - B.runDay >= 3) { B.status = 'ok'; B.run = null; B.bad = Math.round((B.bad || 0) * 0.3); B.lastRunEnd = d; log(w, '🏦 銀行撐過了擠兌，大家慢慢放心了。', {}); }
    }
    // 銀行家掏自己的錢補準備金(最多手上的七成)。v11.6.0 frac：他決定押手上的幾成（全押是七成，押一半是三成五）
    function inject(w, B, banker, R, frac = 0.7) {
        const n = Math.floor(Math.min(cash(w, banker) * frac, Math.ceil(totalDep(B) - B.reserve)));
        if (n >= 1 && WALLET.take(w, banker, n)) {
            B.reserve += n; R.injected = n;
            log(w, '💰 銀行家{a}掏出自己的 {n} 銀幣補進銀行，想穩住人心。', { a: banker.name, n }, banker.name);
            mem(w, banker, frac < 0.7 ? '擠兌的時候我拿了 {n} 銀幣補進銀行，剩下的留給自己。' : '擠兌的時候我把自己的 {n} 銀幣都押進銀行了，不能讓它倒。', { n }, 8);
        } else R.injected = -1;
        return R.injected;
    }
    // 債券:三十天到期;擠兌時利息較高(一成二)才有人敢買,平時八分
    function issueBonds(w, B, d, goal, inRun) {
        const banker = w.agents[B.banker]; if (!banker || goal < 5) return 0;
        const rate = inRun ? 0.12 : 0.08; B.lastIssue = d;
        log(w, '📜 銀行家{a}發行債券：三十天到期，利息 {r}%{why}。', { a: banker.name, r: Math.round(rate * 100), why: inRun ? '（想撐過擠兌）' : '（補充準備金）' }, banker.name);
        if (B.offer) closeOffer(w, B); B.offer = { id: 'OF' + (B.offerN = (B.offerN || 0) + 1), d, until: d + 2, goal: Math.ceil(goal), rate, inRun: !!inRun, raised: 0, buyers: 0, got: {} }; return 0; // 開賣兩天，誰要買由本人決定(bondBy)，到期再結算(closeOffer)
    }
    // ---------- v9.24.0 交給本人決定的版本 ----------
    // 債券的認購期結束：公布賣了多少
    function closeOffer(w, B) {
        const O = B.offer; if (!O) return; B.offer = null; const banker = w.agents[B.banker];
        if (O.buyers) log(w, '📜 {k} 個人買了債券，銀行籌到 {n} 銀幣。', { k: O.buyers, n: O.raised }, banker?.name || '');
        else log(w, '📜 沒有人敢買銀行的債券。', {}, banker?.name || '');
        if (banker) mem(w, banker, O.buyers ? '我發行債券籌到了 {n} 銀幣。' : '我發行債券，結果沒有人買。', { n: O.raised }, 6);
    }
    // 這個人現在能不能買債券、最多買多少
    function bondInfo(w, a) {
        const B = w.bank; const O = B?.offer; if (!O || !B.open || day(w) > O.until || !a || O.got[a.agentId]) return null;
        const banker = w.agents[B.banker]; if (!banker || banker === a || cash(w, a) < 20 || aff(a, banker) < -10) return null;
        const n = Math.floor(Math.min(cash(w, a) * 0.4, O.goal - O.raised)); if (n < 5) return null;
        return { id: O.id, n, rate: O.rate, inRun: O.inRun, banker, dep: Math.floor(B.dep[a.agentId] || 0) };
    }
    function bondBy(w, a, oid) {
        const B = w.bank; const I = bondInfo(w, a); if (!I || I.id !== oid || !WALLET.take(w, a, I.n)) return 0; const O = B.offer; const d = day(w);
        B.bonds.push({ id: 'BD' + (B.bondN = (B.bondN || 0) + 1), holder: a.agentId, n: I.n, rate: O.rate, issued: d, due: d + 30 });
        B.reserve += I.n; O.raised += I.n; O.buyers++; O.got[a.agentId] = I.n;
        mem(w, a, '我買了 {n} 銀幣的銀行債券，三十天後連本帶利拿回來。', { n: I.n }, 5);
        return I.n;
    }
    // 擠兌中、銀行有開門、他在銀行有存款
    function runInfo(w, a) {
        const B = w.bank; if (!B || !B.open || B.status !== 'run' || !a || B.run?.asked === 'pending' || B.run?.inj) return null; /* v11.6.0 銀行家還在想要不要押錢：銀行先關門 */ const dep = Math.floor(B.dep[a.agentId] || 0); if (dep < 1) return null;
        const banker = w.agents[B.banker]; return { dep, day: Math.max(0, day(w) - (B.runDay ?? day(w))), banker: banker && banker !== a ? banker : null, injected: (B.run?.injected || 0) > 0 };
    }
    // 領出存款的幾成(銀行剩多少準備金就只領得到多少)
    function runBy(w, a, frac) { const B = w.bank; const I = runInfo(w, a); if (!I) return 0; return withdraw(w, B, a, Math.max(1, Math.floor(I.dep * Math.max(0, Math.min(1, frac))))); }
    function matureBonds(w, B, d) {
        if (!B.bonds?.length) return;
        for (const bd of B.bonds.filter(x => x.due <= d && !(!w.agents[x.holder] && w.isAway?.(x.holder)))) { // v9.9.4 持有人出遠門:等回來再兌現
            const a = w.agents[bd.holder]; const owe = Math.round(bd.n * (1 + bd.rate)); B.bonds = B.bonds.filter(x => x !== bd); if (!a || a.isDead) continue; // v7.6.0 持有人不在了,錢不能憑空消失
            const paid = Math.min(owe, Math.floor(B.reserve)); B.reserve -= paid;
            WALLET.add(w, a, paid);
            if (paid >= owe) mem(w, a, '銀行債券到期，連本帶利拿回 {n} 銀幣。', { n: paid }, 5);
            else { const banker = w.agents[B.banker]; if (banker) a.relationships?.getOrCreate?.(banker.agentId, banker.name)?.modifyAffinity?.(-15); B.defaults = (B.defaults || 0) + 1; log(w, '📉 銀行付不出{a}的債券，只還了 {p}／{n} 銀幣。', { a: a.name, p: paid, n: owe }, a.name); mem(w, a, '銀行債券到期只拿回 {p} 銀幣，說好的 {n} 呢？', { p: paid, n: owe }, 7); }
        }
    }
    const bondsOf = (B, a) => (B.bonds || []).filter(x => x.holder === a?.agentId);
    const leader = (w) => npcs(w).find(a => a.job?.key === 'mayor') || (typeof CROWN !== 'undefined' ? CROWN.king?.(w) : null) || null;
    // 規則:存戶多、公庫撐得住、跟銀行家交情好、自己也有存款 → 傾向紓困;已經背債、生性節儉、跟銀行家不和 → 傾向不救
    function ruleBailout(w, B, m, need) {
        const all = npcs(w), banker = w.agents[B.banker]; const savers = Object.keys(B.dep).filter(id => w.agents[id]).length;
        const many = savers >= Math.max(3, all.length * 0.25); let s = 0;
        if (many) s += 2; else if (savers >= 2) s += 1;
        if (treasury(w) >= need * 0.5) s += 1;
        if ((B.debt?.owed || 0) > 0) s -= 2;
        if (has(m, 'kind')) s += 1; if (has(m, 'stoic') || has(m, 'ascetic') || has(m, 'perfectionist')) s -= 1;
        if (banker && banker !== m) { const f = aff(m, banker); if (f > 30) s += 1; else if (f < -20) s -= 2; }
        if ((B.dep[m.agentId] || 0) > 0) s += 1;
        const yes = s >= 2;
        const why = yes ? (many ? '存錢的人太多，銀行倒了全鎮都要遭殃' : '銀行倒了，鎮上的生意也會跟著垮')
            : ((B.debt?.owed || 0) > 0 ? '鎮公所已經欠了一屁股債，不能再借了' : (banker && aff(m, banker) < -20 ? '銀行家自己闖的禍，自己收拾' : '公庫不該替銀行的錯誤買單'));
        return { yes, why };
    }
    function askBailout(w, B, d, R) {
        const need = Math.min(500, Math.ceil(totalDep(B) - B.reserve)); if (need < 5) { R.asked = 'skip'; return; }
        const m = leader(w); if (!m) { R.asked = 'none'; return; }
        const ce = w.conversationEngine; const done = (yes, why) => decide(w, B, d, m, need, yes, why, R);
        if (w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson) {
            R.asked = 'pending'; R.askDay = d; const g0 = w._gen; const live = () => w._gen === g0 && w.bank === B && B.run === R && R.asked === 'pending';
            log(w, '🏦 銀行暫停營業一天，等{m}決定要不要紓困。', { m: m.name }, m.name);
            (async () => {
                let j = null;
                try {
                    const b = ce._agentBrief(w, m, null); const banker = w.agents[B.banker]; const savers = Object.keys(B.dep).filter(id => w.agents[id]).length;
                    const prompt = `${t('你正在扮演')}${t(m.job?.title || '鎮長')}${t('「')}${b.name}${t('」（')}${t('性格')}${t('：')}${b.traits}${t('）')}${t('。')}`
                        + `${t('銀行正在擠兌')}${t('：')}${t('存戶')} ${savers} ${t('人')}${t('，')}${t('存款')} ${Math.round(totalDep(B))}${t('，')}${t('準備金只剩')} ${Math.round(B.reserve)}${t('，')}${t('缺口')} ${need} ${t('銀幣')}${t('。')}`
                        + (banker && R.injected > 0 ? `${t('銀行家')}${banker.name}${t('已經拿自己的')} ${R.injected} ${t('銀幣補過了')}${t('。')}` : '')
                        + `${t('紓困要以鎮公所的名義向外地錢莊借錢，連本帶利要還')} ${Math.round(need * (1 + INTEREST))} ${t('銀幣')}${t('，')}${t('每天從公庫還')}${t('；')}${t('公庫目前有')} ${Math.round(treasury(w))} ${t('銀幣')}`
                        + ((B.debt?.owed || 0) > 0 ? `${t('，')}${t('鎮公所已經欠債')} ${Math.round(B.debt.owed)} ${t('銀幣')}` : '') + `${t('。')}`
                        + `${t('不紓困，銀行就會倒，存戶的錢全沒了')}${t('。')}${t('你要紓困嗎？依你的性格與立場決定，只輸出 JSON')}${t('：')}{"bailout":true,"why":"${t('一句話，25 字內')}"}`;
                    ce._countNpcLlmUse?.(w); j = await ce._askJson(prompt, 200); // v9.23.5 理由寫太長被切斷就拿不到(真模型實測)→ 要求寫短、額度放寬
                } catch (e) {}
                if (!live()) return;
                if (j && typeof j.bailout === 'boolean') done(j.bailout, LLMClient.clip(j.why, 60) || ruleBailout(w, B, m, need).why);
                else { const r = ruleBailout(w, B, m, need); done(r.yes, r.why); }
            })();
            return;
        }
        const r = ruleBailout(w, B, m, need); done(r.yes, r.why);
    }
    function decide(w, B, d, m, need, yes, why, R) {
        R.asked = yes ? 'yes' : 'no';
        const savers = Object.keys(B.dep).map(id => w.agents[id]).filter(a => a && a !== m);
        B.lastBail = { day: d, n: need, by: m.name, yes, why };
        if (yes) {
            const owed = Math.round(need * (1 + INTEREST));
            const D = B.debt || (B.debt = { owed: 0, borrowed: 0, paid: 0, since: d, late: 0, lastPay: null });
            D.owed += owed; D.borrowed += need; B.reserve += need; B.bailouts = (B.bailouts || 0) + 1; if (typeof MONEY !== 'undefined') MONEY.flow(w, 'xloan', need); /* v8.8.0 從外地借進來的錢記帳 */
            log(w, '🏛️ {m}決定紓困：向外地錢莊借 {n} 銀幣救銀行，鎮公所背下 {o} 銀幣的債（含利息）。', { m: m.name, n: need, o: owed }, m.name);
            log(w, '🗣️ {m}：「{x}」', { m: m.name, x: why }, m.name);
            mem(w, m, '我決定以鎮公所的名義借錢救銀行，背了 {o} 銀幣的債。理由是：{x}', { o: owed, x: why }, 8);
            for (const a of savers) { a.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyAffinity?.(8); mem(w, a, '{m}出手救了銀行，我的存款保住了。', { m: m.name }, 6); }
            for (const a of npcs(w)) if (a !== m && !(B.dep[a.agentId] > 0) && Math.random() < 0.35) { a.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyAffinity?.(-3); mem(w, a, '鎮公所借錢救銀行，最後還不是大家的稅錢在還。', {}, 4); }
            if ((B.dep[m.agentId] || 0) > 0) { try { DARK.secret(w, { kind: 'scheme', culprit: m.agentId, k: '{a}自己在銀行存了 {n} 銀幣，紓困也救了自己的錢', p: { a: m.name, n: Math.round(B.dep[m.agentId]) } }); } catch (e) {} }
            try { w.dailyNews?.collectEvent?.('event', t('鎮公所紓困銀行'), 8, [m.name]); } catch (e) {}
        } else {
            log(w, '🏛️ {m}拒絕紓困銀行：「{x}」', { m: m.name, x: why }, m.name);
            mem(w, m, '我拒絕用鎮公所的名義借錢救銀行。理由是：{x}', { x: why }, 7);
            for (const a of savers) { a.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyAffinity?.(-10); mem(w, a, '{m}見死不救，我存在銀行的錢恐怕要沒了。', { m: m.name }, 7); }
        }
    }
    // 紓困債:每天從公庫還本金的 3%(至少 2 銀幣);還不出來就加 1% 罰息
    function repayDebt(w, B, d) {
        const D = B.debt; if (!D || D.owed <= 0 || D.lastPay === d) return; D.lastPay = d;
        const pay = Math.min(D.owed, Math.max(2, Math.ceil(D.owed * 0.03)));
        if (treasury(w) >= pay && w.stockpile.consume('silver', pay, w.tickCount, t('償還紓困債'), 'upkeep')) {
            D.owed = Math.max(0, D.owed - pay); D.paid += pay; D.late = 0; if (typeof MONEY !== 'undefined') MONEY.flow(w, 'xrepay', -pay); /* v8.8.0 還給外地錢莊 */
            if (D.owed <= 0) { log(w, '🎉 鎮公所還清了紓困銀行的債，連本帶利一共 {n} 銀幣。', { n: Math.round(D.paid) }); (B.debtHist || (B.debtHist = [])).push({ since: D.since, done: d, paid: Math.round(D.paid) }); if (B.debtHist.length > 4) B.debtHist.shift(); B.debt = null; }
        } else {
            // v9.4.0 還不了整筆就先還一部分(還到一半以上不罰息);罰息最多加到原本欠款的 1.5 倍,之後錢莊改派人來催債
            D.cap = D.cap || Math.ceil(D.owed * 1.5); const part = Math.floor(Math.min(treasury(w), pay));
            if (part > 0 && w.stockpile.consume('silver', part, w.tickCount, t('償還紓困債'), 'upkeep')) { D.owed = Math.max(0, D.owed - part); D.paid += part; if (typeof MONEY !== 'undefined') MONEY.flow(w, 'xrepay', -part); }
            if (part >= pay / 2) { D.late = Math.max(0, D.late - 1); return; }
            D.late++;
            if (D.owed < D.cap) { D.owed = Math.min(D.cap, Math.ceil(D.owed * 1.01)); if (D.late === 1 || D.late % 7 === 0) log(w, '💸 公庫還不出紓困債，欠款加上罰息變成 {n} 銀幣。', { n: Math.round(D.owed) }); }
            else if (D.late % 10 === 0) { const L = leader(w); log(w, '🧾 外地錢莊派了兩個催債的人來鎮上，在鎮公所門口一坐就是一整天。{l}只能陪著笑臉，說公庫一有錢就還。', { l: L?.name || t('鎮長') }, L?.name);
                if (L) { try { if (typeof WAYS !== 'undefined') WAYS.loseFace?.(w, L, 6); } catch (e) {} L.moodModifier = (L.moodModifier || 0) - 3; try { L.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '催債的人又來了，全鎮都看到我低聲下氣。', {}, 7, []); } catch (e) {} } }
        }
    }
    function townBrief(w) {
        const B = w.bank; if (!B) return ''; const out = [];
        if (B.status === 'run') out.push(t('銀行正在擠兌'));
        if (B.debt?.owed > 0) out.push(t('鎮公所為了紓困銀行，欠外地錢莊 {n} 銀幣').replace('{n}', Math.round(B.debt.owed)));
        return out.join(t('；'));
    }
    function fail(w, B, d) {
        const lost = totalDep(B); const banker = w.agents[B.banker];
        for (const [id, v] of Object.entries(B.dep)) { const a = w.agents[id]; if (!a) continue; a.moodModifier = (a.moodModifier || 0) - 10; mem(w, a, '銀行倒了，我存的 {n} 銀幣全沒了。', { n: Math.round(v) }, 9); if (banker) a.relationships.getOrCreate(banker.agentId, banker.name).modifyAffinity(-25); }
        log(w, '💥 銀行倒閉了！存戶損失 {n} 銀幣。', { n: Math.round(lost) }, banker?.name || '');
        if (banker) { mem(w, banker, '我的銀行倒了，大家都在罵我。', {}, 10); try { DARK.bump(w, banker, 'exposed'); } catch (e) {} }
        B.history.push({ day: d, lost: Math.round(lost), banker: banker?.name || '' });
        { const tot = totalDep(B), cashLeft = Math.floor(B.reserve || 0); if (tot > 0 && cashLeft > 0) { let paid = 0; for (const [id, v] of Object.entries(B.dep)) { const a = w.agents[id]; if (!a || a.isDead) continue; const n = Math.floor(cashLeft * v / tot); if (n > 0) { WALLET.add(w, a, n); paid += n; mem(w, a, '銀行清算，我只拿回 {n} 銀幣。', { n }, 7); } } B.reserve -= paid; B.liquidated = paid; } } // v7.6.0 清算:剩下的錢照存款比例還給存戶
        { const left = Math.round((B.reserve || 0) * 100) / 100; if (left > 0) { if (banker && !banker.isDead) WALLET.add(w, banker, left); else w.stockpile?.add?.('silver', left, w.tickCount, t('銀行清算剩下的錢')); B.reserve -= left; } } // 零頭歸銀行家(以前只給整數、銀行家不在就整筆消失,接著準備金歸零,錢憑空不見;現在剩多少給多少,沒有銀行家就進公庫)
        B.dep = {}; B.reserve = 0; B.open = false; B.status = 'failed'; B.failDay = d; B.bad = 0; // 放款還是要還,但銀行沒了就一筆勾銷
        for (const bd of (B.bonds || [])) { const a = w.agents[bd.holder]; if (a) mem(w, a, '銀行倒了，我買的 {n} 銀幣債券變成廢紙。', { n: bd.n }, 8); }
        B.loans = {}; B.run = null; B.bonds = [];
        if (B.desk?.apply) { for (const id of Object.keys(B.desk.apply)) endWait(B, id); B.desk.apply = {}; } // v11.6.0 掛著的借錢申請跟著作廢
    }
    // ================= v11.6.0 銀行的事由銀行家本人決定（選擇點 bankDesk，登記在 sim-decide-work.js） =================
    // 以前銀行家從來沒被問過：借不借看兩條規則（被揭過兩次底、或他對這個人的好感低於 -20 就不借）、利率照公式（開智能體時直接問模型）、
    // 逾期十天又身上不到 3 銀幣就自動收房或打成呆帳、擠兌時自動掏出手上的七成。現在這四件事攤在他面前，由他自己拿主意（ctx.t 分四種）：
    //   loan 有人來借錢：申請先掛在 B.desk.apply，他點頭才撥款 ／ rate 每週定利率 ／ late 逾期的人怎麼辦 ／ run 擠兌時押多少自己的錢
    // 沒問到的（決策核心沒開、銀行家不在鎮上、自己跟自己借、舊存檔）照原本的規則；問 AI 時要等回話，隔天還沒回音也照原本的規則。
    // 結算的數字（利息、期限、呆帳、收房、補進去的錢）沿用原本的；錢只在借款人、銀行、銀行家之間動
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) && !(w.civic?.jail?.[a.agentId] > day(w));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : v; return o; };
    const logF = (w, k, p, who) => log(w, k, flat(p), who);
    const memF = (w, a, k, p, imp) => mem(w, a, k, flat(p), imp);
    const bumpA = (a, b, n) => { try { a?.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const jobT = (a) => { try { return a.job ? (a.job.title || (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[a.job.key]?.title) || a.job.key) : ''; } catch (e) { return ''; } };
    const DK = () => (typeof DECIDE !== 'undefined' ? DECIDE : null);
    const deskOn = (w) => !!(w?.observerMode && w.wallet && DK() && DECIDE.on(w) && DECIDE.KINDS?.bankDesk);
    // 能拿主意的銀行家：人在鎮上；跟自己的銀行借錢的不算（照原本的規則）
    function teller(w, B, a) { if (!deskOn(w) || !B || w.bank !== B || !B.open) return null; const b = w.agents[B.banker]; if (!b || !inTown(w, b) || (b.age ?? 30) < 16 || (a && b === a)) return null; return b; }
    function D(B) { const X = (B.desk && typeof B.desk === 'object') ? B.desk : (B.desk = {}); if (!X.apply || typeof X.apply !== 'object') X.apply = {}; if (!X.burnt || typeof X.burnt !== 'object') X.burnt = {}; X.n = X.n || 0; X.st = Object.assign({ asks: 0, lent: 0, half: 0, coll: 0, refused: 0, rule: 0, late: 0, ext: 0, waive: 0, seize: 0, bad: 0, run: 0 }, X.st || {}); return X; }
    // 馬上問銀行家（跟 PROCURE、BOSS 一樣：別的系統排著的事先拿開，問完原樣放回去）。只在每天的流程裡用，不在別人的選項 run 裡用
    function askNow(w, a, ctx) { const X = DECIDE.S(w); const keep = X.q.splice(0, X.q.length); try { DECIDE.enqueue(w, a, 'bankDesk', ctx); DECIDE.drain(w, X, day(w)); } finally { if (keep.length) X.q.unshift(...keep); } }
    // 照個性當場決定，不碰決策核心的佇列：借錢的申請常常是在別人拿主意的半途送來的（「手頭很緊」選了跟銀行借），這時不能再去動佇列
    function ruleNow(w, a, ctx) {
        const K = DECIDE.KINDS.bankDesk; const opts = deskOptions(w, a, ctx); if (!opts.length) return null; const Ln = DECIDE.lean(w, a); let best = null, bs = -Infinity;
        for (const op of opts) { const s = DECIDE.score(Ln, op) + (Math.random() - 0.5) * 1.8; if (s > bs) { bs = s; best = op; } } // 1.8：跟決策核心一樣的當天心情起伏
        let res = null; try { res = best.run(w, a, ctx) || null; } catch (e) { console.warn('[Bank] desk', e); }
        const X = DECIDE.S(w); X.st.offer++; return DECIDE.record(w, X, a, K, best, best.why || null, res, 'rule', day(w), ctx);
    }
    const queued = (w, tok) => { try { return DK() ? DECIDE.S(w).q.some(q => q.kind === 'bankDesk' && q.ctx?.tok === tok) : false; } catch (e) { return false; } };
    // 利率的理由（介面顯示）：決定記下來的那一刻才拿得到（AI 的理由是回話時才有）
    let hooked = false; function hook() { if (hooked || !DK()) return; hooked = true; DECIDE.observe((ev, o) => { if (ev !== 'decided' || o?.K?.key !== 'bankDesk' || o.ctx?.t !== 'rate') return; const B = o.w?.bank; if (B && o.why) { B.rateWhy = o.why; B.rateBy = o.a?.agentId || null; } }); }

    // ---------- 交情與底細 ----------
    function tieOf(w, b, a) {
        const v = Math.round(aff(b, a)); const fam = famOf(w, b).includes(a);
        if (fam) return { k: 'fam', v, s: v <= -20 ? '是你的家人，不過你們處得很差' : '是你的家人' };
        if (v >= 40) return { k: 'friend', v, s: '是你的好朋友' }; if (v >= 10) return { k: 'known', v, s: '跟你還算熟' }; if (v <= -20) return { k: 'foe', v, s: '跟你有過節' };
        return { k: 'none', v, s: '跟你不熟' };
    }
    const tieW = (T) => ({ fam: 1.2, friend: 0.8, known: 0.3, none: 0, foe: -1 })[T.k] - (T.k === 'fam' && T.v <= -20 ? 1 : 0);
    function riskOf(w, B, a) {
        const exp = w.dark?.rep?.[a.agentId]?.exposed || 0; const burnt = B.desk?.burnt?.[a.agentId] || 0; const d0 = day(w);
        const ds = (w.dark?.debts || []).filter(x => !x.done && x.cash && x.r === a.agentId); const owe = Math.round(ds.reduce((s, x) => s + (x.n || 0), 0)); const late = ds.some(x => x.due <= d0);
        let arr = 0; try { if (typeof ESTATE !== 'undefined' && w.estate) arr = Math.round(w.estate.arrears?.[ESTATE.headOf(w, a).agentId] || 0); } catch (e) {}
        const kids = npcs(w).filter(o => (o.age ?? 30) < 16 && (o._parentNames || []).includes(a.name)).length;
        return { exp, burnt, owe, late, arr, kids, r: (a.job ? 0 : 0.6) + Math.min(1.2, burnt * 0.8) + (late ? 0.4 : 0) + (arr > 0 ? 0.3 : 0) + (exp >= 1 ? 0.3 : 0) + (has(a, 'lazy') ? 0.2 : 0) };
    }
    const houseOf = (w, a) => { try { return typeof ESTATE !== 'undefined' && w.estate ? ESTATE.ownsOf(w, a.agentId)[0] || null : null; } catch (e) { return null; } };
    const worthOf = (w, u) => { try { return ESTATE.valueOf(w, u); } catch (e) { return 0; } };
    const bankLine = (B) => fill('銀行現在：存款 {dep}、放款 {loan}、準備金 {res}（還放得出去 {can}）、呆帳 {bad}。', { dep: Math.round(totalDep(B)), loan: Math.round(totalLoan(B)), res: Math.round(B.reserve), can: Math.floor(lendable(B)), bad: Math.round(B.bad || 0) });
    function whoLine(w, B, a) {
        const R = riskOf(w, B, a); const bits = [];
        if (R.owe > 0) bits.push(fill(R.late ? '還欠別人 {n} 銀幣（有的已經到期）' : '還欠別人 {n} 銀幣', { n: R.owe }));
        if (R.arr > 0) bits.push(fill('房租欠了 {n} 銀幣', { n: R.arr }));
        const job = a.job ? fill('做{j}', { j: jobT(a) }) : t('沒有工作');
        const rep = (R.exp ? fill('他被揭過 {n} 次底。', { n: R.exp }) : '') + (R.burnt ? fill('他以前跟銀行借錢沒還，打成呆帳過 {n} 次。', { n: R.burnt }) : '');
        return { R, s: fill('他{job}，身上有 {c} 銀幣{debt}。{rep}', { job: { raw: job }, c: Math.floor(cash(w, a)), debt: { raw: bits.length ? t('，') + bits.join(t('，')) : t('，沒有別的欠債') }, rep: { raw: rep } }) };
    }

    // ---------- 1. 有人來借錢 ----------
    const waits = new WeakMap(); // 銀行 → Map(借款人 → { p, done })：問 AI 還沒回話時，開店的人等這個（放記憶體，不存檔）
    function makeWait(B, id) { let m = waits.get(B); if (!m) { m = new Map(); waits.set(B, m); } let done = null; const p = new Promise(r => { done = r; }); m.set(id, { p, done }); return p; }
    function endWait(B, id) { const m = waits.get(B); const x = m && m.get(id); if (x) { m.delete(id); try { x.done(); } catch (e) {} } }
    const deskReply = (B, a) => { const m = B && a ? waits.get(B) : null; return m?.get(a.agentId)?.p || null; };
    const pendingOf = (w, a) => (a && w?.bank?.desk?.apply?.[a.agentId]) || null;
    // 申請：回 null 表示這筆不歸銀行家管（照原本的規則）；照個性的當場就有答案，回撥款金額；問 AI 的先掛著，回 0
    function apply(w, B, a, n, why, opt) {
        const b = a ? teller(w, B, a) : null; if (!b) return null; const id = a.agentId, d = day(w); const X = D(B);
        n = Math.floor(Math.min(n, lendable(B))); if (n < 5 || B.loans[id]) return 0; // 原本 lend 就會當場拒絕的，不用麻煩銀行家
        if (B.refused?.[id] != null && d - B.refused[id] < 10) return 0; // v8.8.0 被拒絕過的人十天內不會再去碰釘子
        if (X.apply[id]) return 0; // 已經有一筆在等回話
        const ap = X.apply[id] = { n, why: why || '', d, tok: ++X.n, coll: opt?.coll || null, biz: opt?.biz ? 1 : 0 }; X.st.asks++;
        const ctx = { t: 'loan', id, tok: ap.tok, d };
        // 不到 40 銀幣、或是看病的急用：銀行家當場照個性（含交情）決定，不等 AI（跟以前一樣，大筆的才值得他想；看病的人當下就要錢）
        const urgent = n < 40 || why === '看病' || why === t('看病');
        if (!urgent && DECIDE.aiOn(w)) { makeWait(B, id); if (DECIDE.inRun?.()) DECIDE.enqueue(w, b, 'bankDesk', ctx); else askNow(w, b, ctx); } // 要問 AI：別人選的那一項正在執行時排進佇列（這一輪處理完就送去問），不然當場送出；回話來了才撥款（今天的額度用完了就當場照個性）
        else { ruleNow(w, b, ctx); if (X.apply[id]?.tok === ap.tok) ruleLoan(w, B, ap, id); }
        const L = B.loans[id]; return L && L.tok === ap.tok ? L.principal : 0;
    }
    function grant(w, B, ap, id, frac, coll, b) {
        const X = D(B); if (X.apply[id] === ap) delete X.apply[id]; const a = w.agents[id]; if (!a || a.isDead) { endWait(B, id); return 0; }
        const got = lend(w, B, a, Math.max(5, Math.floor(ap.n * frac)), ap.why); const L = B.loans[id];
        if (got && L) { L.tok = ap.tok; if (b) L.by = b.agentId; const cu = coll || ap.coll; if (cu) L.collateral = cu;
            if (ap.biz) { L.due = Math.max(L.due || 0, day(w) + 45); L.kind = 'biz'; B.bizLent = Math.round((B.bizLent || 0) + got); } X.st.lent++; } // 開店、蓋房的貸款四十五天（跟 BIZ.bizLoan 一樣）
        endWait(B, id); return got;
    }
    function refuse(w, B, ap, id, b, old) {
        const X = D(B); if (X.apply[id] === ap) delete X.apply[id]; (B.refused = B.refused || {})[id] = day(w); X.st.refused++; endWait(B, id); const a = w.agents[id]; if (!a) return;
        if (!b) { log(w, '🏦 銀行家拒絕借錢給{a}{r}。', { a: a.name, r: old === 'rep' ? '（名聲太差）' : old === 'dislike' ? '（兩人處不好）' : '' }, a.name); mem(w, a, '銀行不肯借我錢。', {}, 6); return; } // 原本的規則（一字不改）
        log(w, '🏦 銀行家{b}拒絕借錢給{a}。', { b: b.name, a: a.name }, b.name); mem(w, a, '銀行家{b}不肯借我錢。', { b: b.name }, 6); bumpA(a, b, -4);
    }
    // 原本的規則：名聲太差（被揭過兩次底）或銀行家跟他處不好（好感低於 -20）就不借，其餘照借
    function ruleLoan(w, B, ap, id) { const a = w.agents[id]; D(B).st.rule++; if (!a) { const X = D(B); if (X.apply[id] === ap) delete X.apply[id]; endWait(B, id); return 0; } const v = (typeof BIZ !== 'undefined' && BIZ.vet) ? BIZ.vet(w, B, a) : { ok: true }; if (!v.ok) { refuse(w, B, ap, id, null, v.why); return 0; } return grant(w, B, ap, id, 1, null, null); }
    function liveLoan(w, b, ctx) { const B = w.bank; if (!B || !ctx || teller(w, B) !== b) return null; const ap = B.desk?.apply?.[ctx.id]; if (!ap || ap.tok !== ctx.tok) return null; const a = w.agents[ctx.id]; if (!a || a.isDead || a === b) return null; return { B, ap, a }; }
    const rateFor = (w, B, a) => Math.round(((B.rate || 0) + (a.job ? 0 : 0.05) + (has(a, 'lazy') ? 0.04 : 0) + (cash(w, a) < 5 ? 0.02 : 0)) * 100); // 跟 lend 加的風險一樣
    function loanFacts(w, b, ctx) {
        const L = liveLoan(w, b, ctx); if (!L) return ''; const { B, ap, a } = L; const T = tieOf(w, b, a); const W0 = whoLine(w, B, a); const u = houseOf(w, a);
        const coll = ap.coll ? fill('他拿自己的房子來抵押（大約值 {v} 銀幣），還不出來房子歸銀行。', { v: u ? worthOf(w, u) : 0 }) : u ? fill('他名下有一棟房子（大約值 {v} 銀幣），這筆沒有抵押。', { v: worthOf(w, u) }) : t('他名下沒有房子。');
        return fill('{a}來銀行申請借 {n} 銀幣，說是要拿去{why}。{who}{a}{tie}（你對他的好感 {v}）。{coll}照現在的利率，這筆利息大約 {r}%，{due}天內要還清。{bank}', { a: a.name, n: ap.n, why: ap.why || '周轉', who: { raw: W0.s }, tie: T.s, v: T.v, coll: { raw: coll }, r: rateFor(w, B, a), due: ap.biz ? 45 : 20, bank: { raw: bankLine(B) } });
    }
    function loanOptions(w, b, ctx) {
        const L = liveLoan(w, b, ctx); if (!L) return []; const { B, ap, a } = L; const T = L.T = tieOf(w, b, a); const tw = tieW(T); const R = riskOf(w, B, a); const n = Math.floor(Math.min(ap.n, lendable(B))); if (n < 5) return [];
        const vetBad = R.exp >= 2 || aff(b, a) < -20; const u = houseOf(w, a); const h = Math.floor(n / 2); const out = [];
        const go = (fn) => (w2, b2) => { const L2 = liveLoan(w2, b2, ctx); return L2 ? fn(w2, b2, L2) : null; };
        out.push({ id: 'lend', text: { k: '照借 {n} 銀幣', p: { n } }, say: { k: '借了 {n} 銀幣給{a}', p: { n, a: a.name } }, why: '他要用錢，銀行就是做這個的。', base: 1.6 + tw * 0.5 - (vetBad ? 3.2 : 0) - R.r * 0.7, lean: { bond: 0.4, gain: 0.3 },
            run: go((w2, b2, L2) => { const got = grant(w2, L2.B, L2.ap, ctx.id, 1, null, b2); return got ? { k: '借出 {n} 銀幣', p: { n: got } } : { k: '沒借成' }; }) });
        if (h >= 5) out.push({ id: 'half', text: { k: '只借一半（{n} 銀幣）', p: { n: h } }, say: { k: '只借給{a}一半', p: { a: a.name } }, why: '先借一半，看他還不還得起。', base: 0.1 + R.r * 0.8 + (has(b, 'thrifty') ? 0.3 : 0) - (vetBad ? 1 : 0), lean: { safe: 0.4 },
            run: go((w2, b2, L2) => { const got = grant(w2, L2.B, L2.ap, ctx.id, 0.5, null, b2); if (got) { D(L2.B).st.half++; memF(w2, L2.a, '銀行家{b}只肯借我一半，{n} 銀幣。', { b: b2.name, n: got }, 6); } return got ? { k: '只借出 {n} 銀幣', p: { n: got } } : { k: '沒借成' }; }) });
        if (u && !ap.coll) out.push({ id: 'coll', text: { k: '要他拿房子抵押才借（{n} 銀幣，還不出來就收他的房子）', p: { n } }, say: { k: '要{a}拿房子抵押才借', p: { a: a.name } }, why: '有房子押著，不怕他不還。', base: -0.1 + R.r * 0.9 + (has(b, 'greedy') ? 0.3 : 0) - (vetBad ? 0.8 : 0) - (T.k === 'fam' ? 0.6 : 0), lean: { safe: 0.3, gain: 0.3 },
            run: go((w2, b2, L2) => { const u2 = houseOf(w2, L2.a); if (!u2) return { k: '他已經沒有房子可以抵押' }; const got = grant(w2, L2.B, L2.ap, ctx.id, 1, u2.id, b2); if (got) { D(L2.B).st.coll++; memF(w2, L2.a, '銀行家{b}要我拿房子抵押，才肯借我 {n} 銀幣。', { b: b2.name, n: got }, 6); } return got ? { k: '借出 {n} 銀幣，拿他的房子抵押', p: { n: got } } : { k: '沒借成' }; }) });
        out.push({ id: 'refuse', text: '不借', say: { k: '沒借錢給{a}', p: { a: a.name } }, why: vetBad ? (R.exp >= 2 ? '他的名聲太差，借了收不回來。' : '我跟他處不來，不借。') : '這筆錢借出去，我不放心。', base: -0.3 + (vetBad ? 3.0 : 0) + R.r * 0.6 + (T.k === 'foe' ? 0.5 : 0), lean: { safe: 0.3, face: 0.1 },
            run: go((w2, b2, L2) => { refuse(w2, L2.B, L2.ap, ctx.id, b2); return { k: '沒借' }; }) });
        return out;
    }

    // ---------- 2. 每週定利率 ----------
    function rateFacts(w, b, ctx) {
        const B = w.bank; if (!B?.open || teller(w, B) !== b) return ''; const dep = totalDep(B), loan = totalLoan(B); const borrowers = Object.keys(B.loans).length; const late = Object.values(B.loans).filter(L => day(w) > (L.due || 0)).length;
        return fill('又過了一週，該定銀行的放款利率了，現在是 {r}%（最低 4%、最高 20%）。存款 {dep} 銀幣（{sv} 個人存），放款 {loan} 銀幣（{bw} 個人借，{late} 個人逾期），放款是存款的 {ratio}%；準備金 {res}、呆帳 {bad}。照銀行的帳算，合理的利率大約是 {tg}%。利率高，借的人付得多、比較容易還不出來；利率低，銀行賺得少，存戶的利息也少。你自己身上有 {c} 銀幣，經營銀行累計賺了 {p} 銀幣。',
            { r: Math.round(B.rate * 100), dep: Math.round(dep), sv: Object.keys(B.dep).length, loan: Math.round(loan), bw: borrowers, late, ratio: dep ? Math.round(loan / dep * 100) : 0, res: Math.round(B.reserve), bad: Math.round(B.bad || 0), tg: Math.round(rateTarget(B) * 100), c: Math.floor(cash(w, b)), p: Math.round(B.bankerProfit || 0) });
    }
    function rateOptions(w, b, ctx) {
        const B = w.bank; if (!B?.open || teller(w, B) !== b || !ctx || day(w) - (ctx.d ?? 0) > 1 || B.rateAsk?.d !== ctx.d || B.rateAsk.done) return [];
        const cur = Math.round(B.rate * 100), tg = Math.round(rateTarget(B) * 100), diff = tg - cur; const greedy = has(b, 'greedy'), soft = has(b, 'kind') || has(b, 'generous'); const out = [];
        const ID = { 2: 'up2', 1: 'up1', 0: 'keep', '-1': 'down1', '-2': 'down2' };
        for (const dl of [2, 1, 0, -1, -2]) {
            const nv = cur + dl; if (dl && (nv < 4 || nv > 20)) continue;
            const why = dl > 0 ? (diff > 0 ? '放出去的錢太多了，利率要高一點才穩。' : '利息收高一點，銀行多賺一點。') : dl < 0 ? (diff < 0 ? '錢放不出去，利率降一點大家才會來借。' : '利率低一點，大家才還得起。') : '現在這樣剛好，不用動。';
            // 離原本公式算出來的目標越遠越想往那邊調；貪心的偏高、心腸好的偏低
            out.push({ id: ID[dl], text: dl ? { k: dl > 0 ? '把放款利率調高到 {r}%' : '把放款利率調低到 {r}%', p: { r: nv } } : { k: '放款利率不動，維持 {r}%', p: { r: cur } }, say: dl ? { k: '把銀行的利率從 {a}% 調到 {r}%', p: { a: cur, r: nv } } : { k: '銀行的利率維持 {r}%', p: { r: cur } }, why, quiet: !dl,
                base: 1.5 - 0.7 * Math.abs(diff - dl) + (greedy ? 0.3 * dl : 0) - (soft ? 0.3 * dl : 0), lean: dl > 0 ? { gain: 0.15 * dl } : dl < 0 ? { bond: -0.15 * dl } : { safe: 0.2 },
                run: (w2, b2) => { const B2 = w2.bank; if (!B2?.open || B2.rateAsk?.d !== ctx.d || B2.rateAsk.done) return null; B2.rateAsk.done = 1; const old = Math.round(B2.rate * 100); const v = Math.max(4, Math.min(20, old + dl)); B2.rate = v / 100;
                    if (v !== old) logF(w2, '🏦 銀行家{b}把放款利率從 {a}% 調到 {c}%。', { b: b2.name, a: old, c: v }, b2.name); return { k: '利率定在 {r}%', p: { r: v } }; } });
        }
        return out;
    }

    // ---------- 3. 逾期還不出來的人 ----------
    function lateAsk(w, B, id, L, d) { // 回 true：這筆交給銀行家（或正在等他回話），今天先不動
        if (L.ask) { if (d - L.ask.d < 1) return true; L.ask = null; return false; } // 隔天還沒回音：照原本的規則
        const b = teller(w, B, w.agents[id]); if (!b) return false;
        const X = D(B); L.ask = { d, tok: ++X.n }; X.st.late++; askNow(w, b, { t: 'late', id, tok: L.ask.tok, d }); return true;
    }
    // 原本的規則（一字不改）：有抵押品就收房子，沒有就打成呆帳；都會公開、名聲受損
    function lateRule(w, B, id, L, a) {
        const seized = typeof ESTATE !== 'undefined' && ESTATE.foreclose(w, id, L); if (!seized) B.bad += L.owed; delete B.loans[id]; const X = D(B); X.burnt[id] = (X.burnt[id] || 0) + 1; X.st[seized ? 'seize' : 'bad']++;
        try { DARK.bump(w, a, 'exposed'); } catch (e) {} log(w, '📉 {a}還不出銀行的 {n} 銀幣，成了呆帳。', { a: a.name, n: L.owed }, a.name); mem(w, a, '我欠銀行的錢還不出來，大家都知道了，好丟臉。', {}, 7); a.moodModifier = (a.moodModifier || 0) - 6;
        return seized;
    }
    function liveLate(w, b, ctx) { const B = w.bank; if (!B || !ctx || teller(w, B) !== b) return null; const L = B.loans[ctx.id]; if (!L || L.ask?.tok !== ctx.tok) return null; const a = w.agents[ctx.id]; if (!a || a.isDead || a === b) return null; return { B, L, a }; }
    const collOk = (w, id, L) => { try { const u = L.collateral && w.estate?.units?.[L.collateral]; return !!u && u.owner === id; } catch (e) { return false; } };
    const interestOf = (L) => Math.max(0, L.owed - Math.round(L.owed / (1 + (L.rate || 0))));
    function lateFacts(w, b, ctx) {
        const X = liveLate(w, b, ctx); if (!X) return ''; const { B, L, a } = X; const T = tieOf(w, b, a); const W0 = whoLine(w, B, a); const R = W0.R;
        let homeless = false; try { homeless = typeof ESTATE !== 'undefined' && w.estate && ESTATE.isHomeless(w, a); } catch (e) {}
        const situ = [a.isSick || (a.health ?? 100) < 50 ? t('他身體不好。') : '', R.kids ? fill('他家裡有 {n} 個還小的孩子。', { n: R.kids }) : '', homeless ? t('他現在無家可歸。') : ''].join('');
        const coll = collOk(w, a.agentId, L) ? t('這筆有拿他的房子抵押。') : t('這筆沒有抵押品。');
        return fill('{a}跟銀行借的 {p} 銀幣（{why}）已經逾期 {late} 天，還欠 {owed} 銀幣（其中利息大約 {it}）。{who}{situ}{coll}{a}{tie}（你對他的好感 {v}）。這筆已經寬限過 {ext} 次。照規矩，有抵押就收房，沒有就打成呆帳並公開。{bank}',
            { a: a.name, p: L.principal || 0, why: L.why || '周轉', late: Math.max(0, day(w) - (L.due || 0)), owed: Math.round(L.owed), it: interestOf(L), who: { raw: W0.s }, situ: { raw: situ }, coll: { raw: coll }, tie: T.s, v: T.v, ext: L.ext || 0, bank: { raw: bankLine(B) } });
    }
    function lateOptions(w, b, ctx) {
        const X0 = liveLate(w, b, ctx); if (!X0) return []; const { L, a } = X0; const T = tieOf(w, b, a); const tw = tieW(T); const R = riskOf(w, X0.B, a); const coll = collOk(w, a.agentId, L); const it = interestOf(L); const out = [];
        const sick = a.isSick || (a.health ?? 100) < 50; const kind = has(b, 'kind'), gen = has(b, 'generous');
        const go = (fn) => (w2, b2) => { const X2 = liveLate(w2, b2, ctx); if (!X2) return null; X2.L.ask = null; return fn(w2, b2, X2); };
        if ((L.ext || 0) < 2) out.push({ id: 'extend', text: { k: '再寬限十天（同一筆最多兩次，這是第 {n} 次）', p: { n: (L.ext || 0) + 1 } }, say: { k: '讓{a}欠銀行的錢再緩十天', p: { a: a.name } }, why: '再給他一點時間，逼死他錢也拿不回來。',
            base: 0.2 + tw * 0.9 + (a.job ? 0.4 : 0) + (kind ? 0.4 : 0) + (R.kids ? 0.3 : 0) + (sick ? 0.3 : 0) - (L.ext || 0) * 0.5 - R.burnt * 0.5, lean: { bond: 0.5 },
            run: go((w2, b2, X2) => { X2.L.due = day(w2); X2.L.ext = (X2.L.ext || 0) + 1; D(X2.B).st.ext++; logF(w2, '🏦 銀行家{b}讓{a}欠的錢再緩十天。', { b: b2.name, a: X2.a.name }, b2.name); memF(w2, X2.a, '銀行家{b}讓我欠的錢再緩十天。', { b: b2.name }, 6); bumpA(X2.a, b2, 5); return { k: '再給他十天' }; }) });
        if (!L.waived && it >= 1) out.push({ id: 'waive', text: { k: '利息不要了，只收本金（少收 {n} 銀幣，再給十天）', p: { n: it } }, say: { k: '免了{a}欠銀行的利息', p: { a: a.name } }, why: '利息就算了，本金還回來就好。',
            base: -0.3 + tw * 0.8 + (gen ? 0.5 : 0) + (kind ? 0.3 : 0), lean: { bond: 0.5, gain: -0.3 },
            run: go((w2, b2, X2) => { const n = interestOf(X2.L); X2.L.owed = Math.max(0, X2.L.owed - n); X2.L.waived = 1; X2.L.due = day(w2); D(X2.B).st.waive++; logF(w2, '🏦 銀行家{b}免了{a}欠銀行的 {n} 銀幣利息，只收本金。', { b: b2.name, a: X2.a.name, n }, b2.name); memF(w2, X2.a, '銀行家{b}把利息免了，只要我還本金。', { b: b2.name }, 7); bumpA(X2.a, b2, 8); if (X2.L.owed <= 0) delete X2.B.loans[ctx.id]; return { k: '免了 {n} 銀幣利息', p: { n } }; }) });
        if (coll) out.push({ id: 'seize', text: '收房：他抵押的房子歸銀行', say: { k: '收了{a}抵押的房子', p: { a: a.name } }, why: '說好的，還不出來就拿房子抵。', base: 1.8 - tw * 0.6, lean: { gain: 0.3, safe: 0.2 },
            run: go((w2, b2, X2) => { lateRule(w2, X2.B, ctx.id, X2.L, X2.a); bumpA(X2.a, b2, -10); return { k: '房子收回來了' }; }) });
        out.push({ id: 'writeoff', text: '打成呆帳，公開他欠錢不還', say: { k: '把{a}的欠款打成呆帳', p: { a: a.name } }, why: '欠錢不還，就該讓大家知道。', base: (coll ? 0.2 : 1.6) - tw * 0.6, lean: { face: 0.2, safe: 0.2 },
            run: go((w2, b2, X2) => { const L2 = X2.L; const keep = L2.collateral; if (coll) L2.collateral = null; lateRule(w2, X2.B, ctx.id, L2, X2.a); L2.collateral = keep; bumpA(X2.a, b2, -10); return { k: '打成呆帳了' }; }) });
        return out;
    }

    // ---------- 4. 擠兌時押多少自己的錢 ----------
    function injAsk(w, B, banker, R, d) { // 回 true：等他回話，銀行今天先關門
        if (R.inj) { if (d - R.inj.d < 1) return true; R.inj = null; return false; } // 隔天還沒回音：照原本的規則（下一行自動掏七成）
        const b = teller(w, B); if (!b || b !== banker) return false;
        R.inj = { d, tok: ++D(B).n }; D(B).st.run++; askNow(w, b, { t: 'run', tok: R.inj.tok, d }); return !!R.inj;
    }
    function liveRun(w, b, ctx) { const B = w.bank; if (!B || B.status !== 'run' || !ctx || teller(w, B) !== b) return null; const R = B.run; if (!R || R.inj?.tok !== ctx.tok || R.injected) return null; return { B, R }; }
    const injN = (w, B, b, frac) => Math.floor(Math.min(cash(w, b) * frac, Math.ceil(totalDep(B) - B.reserve)));
    function runFacts(w, b, ctx) {
        const X = liveRun(w, b, ctx); if (!X) return ''; const { B } = X; const savers = Object.keys(B.dep).map(id => w.agents[id]).filter(o => o && o !== b);
        const kin = savers.filter(o => famOf(w, b).includes(o) || aff(b, o) >= 40); const m = leader(w); const own = Math.round(B.dep[b.agentId] || 0);
        return fill('銀行正在擠兌（第 {k} 天）：存款 {dep} 銀幣，準備金只剩 {res}，還差 {gap} 銀幣才付得出所有存款。存錢的有 {sv} 個人{kin}。你身上有 {c} 銀幣{own}。你可以拿自己的錢補進銀行：全押是 {n} 銀幣（手上的七成）。補進去的錢就是銀行的了，銀行撐過去慢慢賺回來；銀行倒了，就跟存款一起沒了。之後還不夠，會先發債券，再請{m}決定要不要用鎮公所的名義紓困。',
            { k: Math.max(1, day(w) - (B.runDay ?? day(w)) + 1), dep: Math.round(totalDep(B)), res: Math.round(B.reserve), gap: Math.ceil(totalDep(B) - B.reserve), sv: savers.length, kin: { raw: kin.length ? fill('，其中有你的家人朋友{x}', { x: { raw: kin.slice(0, 3).map(o => t(o.name)).join(t('、')) } }) : '' }, c: Math.floor(cash(w, b)), own: { raw: own ? fill('，自己在銀行也存了 {n}', { n: own }) : '' }, n: injN(w, B, b, 0.7), m: m ? m.name : t('鎮長') });
    }
    function runOptions(w, b, ctx) {
        const X = liveRun(w, b, ctx); if (!X) return []; const { B } = X; const n = injN(w, B, b, 0.7), h = injN(w, B, b, 0.35); const out = [];
        const kin = Object.keys(B.dep).map(id => w.agents[id]).filter(o => o && o !== b && (famOf(w, b).includes(o) || aff(b, o) >= 40)).length;
        const go = (frac) => (w2, b2) => { const X2 = liveRun(w2, b2, ctx); if (!X2) return null; X2.R.inj = null; const got = inject(w2, X2.B, b2, X2.R, frac); return got > 0 ? { k: '補了 {n} 銀幣進銀行', p: { n: got } } : { k: '沒補成' }; };
        if (n >= 1) out.push({ id: 'all', text: { k: '全押：拿出 {n} 銀幣補進銀行', p: { n } }, say: '把自己的錢全押進銀行', why: '銀行倒了，我什麼都沒了，不能讓它倒。', base: 1.6 + (B.dep[b.agentId] ? 0.3 : 0) + Math.min(0.6, kin * 0.3) - (has(b, 'greedy') ? 0.6 : 0) - (has(b, 'thrifty') ? 0.3 : 0), lean: { bond: 0.3, face: 0.3 }, run: go(0.7) });
        if (h >= 1 && h < n) out.push({ id: 'half', text: { k: '押一半：拿出 {n} 銀幣', p: { n: h } }, say: '拿一半的錢補進銀行', why: '補一點撐場面，自己也要留條後路。', base: 0.4 + (has(b, 'thrifty') ? 0.4 : 0) + (has(b, 'greedy') ? 0.3 : 0), lean: { safe: 0.4 }, run: go(0.35) });
        out.push({ id: 'none', text: '不押，自己的錢留著', say: '沒有拿自己的錢補銀行', why: '銀行的事歸銀行，我的錢要留給自己。', base: -0.3 + (has(b, 'greedy') ? 0.6 : 0) + (has(b, 'thrifty') ? 0.3 : 0), lean: { safe: 0.5, bond: -0.3 },
            run: (w2, b2) => { const X2 = liveRun(w2, b2, ctx); if (!X2) return null; X2.R.inj = null; X2.R.injected = -1; logF(w2, '🏦 銀行家{a}沒有拿自己的錢補銀行。', { a: b2.name }, b2.name); mem(w2, b2, '擠兌的時候，我沒有把自己的錢押進銀行。', {}, 7);
                for (const id of Object.keys(X2.B.dep)) { const o = w2.agents[id]; if (o && o !== b2) bumpA(o, b2, -4); } return { k: '一毛都沒押' }; } });
        return out;
    }

    // ---------- 選擇點的入口 ----------
    function deskFacts(w, b, ctx) { try { return ctx?.t === 'loan' ? loanFacts(w, b, ctx) : ctx?.t === 'rate' ? rateFacts(w, b, ctx) : ctx?.t === 'late' ? lateFacts(w, b, ctx) : ctx?.t === 'run' ? runFacts(w, b, ctx) : ctx?.t === 'bond' && typeof FISCAL !== 'undefined' ? FISCAL.bankFacts(w, b, ctx) : ''; } catch (e) { console.warn('[Bank] facts', e); return ''; } }
    function deskOptions(w, b, ctx) { return ctx?.t === 'loan' ? loanOptions(w, b, ctx) : ctx?.t === 'rate' ? rateOptions(w, b, ctx) : ctx?.t === 'late' ? lateOptions(w, b, ctx) : ctx?.t === 'run' ? runOptions(w, b, ctx) : ctx?.t === 'bond' && typeof FISCAL !== 'undefined' ? FISCAL.bankOptions(w, b, ctx) : []; } // v11.12.0 公庫來借錢（sim-fiscal.js）
    // 每天：掛著的申請隔天還沒回音（問 AI 沒回、讀檔後回話不見了）就照原本的規則；還排在決策核心佇列裡、等它送出去的，多等一天
    function deskDaily(w, B, d) {
        const X = B.desk; if (X?.apply) for (const [id, ap] of Object.entries(X.apply)) {
            if (!w.agents[id] && !w.isAway?.(id)) { delete X.apply[id]; endWait(B, id); continue; } if (w.isAway?.(id)) continue;
            if ((d - ap.d >= 1 && !queued(w, ap.tok)) || d - ap.d >= 2) ruleLoan(w, B, ap, id);
        }
        if (B.rateAsk && !B.rateAsk.done && d - B.rateAsk.d >= 1) { B.rateAsk.done = 1; B.rate = rateTarget(B); }
    }
    function brief(w, a) { const B = w.bank; if (!B || !B.open) return ''; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; const bs = bondsOf(B, a); if (bs.length && !dv && !L) return `${t('銀行')}${t('：')}${t('持有債券 {n} 銀幣').replace('{n}', bs.reduce((s, x) => s + x.n, 0))}`; if (!dv && !L) return a.agentId === B.banker ? t('你經營鎮上的銀行') : ''; return `${t('銀行')}${t('：')}${dv ? t('存款 {n} 銀幣').replace('{n}', dv) : ''}${dv && L ? t('，') : ''}${L ? t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed)) : ''}`; }
    function chip(w, a) { const B = w.bank; if (!B || !B.open) return ''; if (a.agentId === B.banker) return `🏦 ${t('銀行家')}`; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; if (L) return `🏦 ${t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed))}`; if (dv) return `🏦 ${t('存款 {n} 銀幣').replace('{n}', dv)}`; const bs = bondsOf(B, a); if (bs.length) return `📜 ${t('債券 {n} 銀幣').replace('{n}', bs.reduce((s, x) => s + x.n, 0))}`; return ''; }
    function view(w) { const B = S(w); return { open: B.open, status: B.status, banker: w.agents[B.banker] ? t(w.agents[B.banker].name) : null, dep: Math.round(totalDep(B)), loan: Math.round(totalLoan(B)), reserve: Math.round(B.reserve), rate: Math.round(B.rate * 100), bad: Math.round(B.bad), savers: Object.keys(B.dep).length, borrowers: Object.keys(B.loans).length, biz: Object.values(B.loans).filter(L => L.kind === 'biz').length, bizLent: Math.round(B.bizLent || 0), why: B.rateWhy ? tx(B.rateWhy) : '', rateBy: B.rateBy && w.agents[B.rateBy] ? t(w.agents[B.rateBy].name) : '', desk: B.desk ? Object.assign({ pending: Object.keys(B.desk.apply || {}).length }, B.desk.st || {}) : null, failed: B.history.slice(-1)[0] || null, pending: B.run?.asked === 'pending', debt: B.debt ? { owed: Math.round(B.debt.owed), paid: Math.round(B.debt.paid), late: B.debt.late || 0 } : null, bail: B.lastBail ? { by: t(B.lastBail.by), yes: B.lastBail.yes, n: B.lastBail.n, why: t(B.lastBail.why || ''), day: B.lastBail.day } : null, debtDone: (B.debtHist || []).slice(-1)[0] || null, bonds: (B.bonds || []).reduce((s, x) => s + x.n, 0), bondHolders: new Set((B.bonds || []).map(x => x.holder)).size, bondRate: B.bonds?.length ? Math.round(B.bonds[B.bonds.length - 1].rate * 100) : 0, defaults: B.defaults || 0 }; }
    return { rawLend: lend, lateAsk, injAsk, deskDaily, tieOf, apply, deskReply, pendingOf, teller, deskFacts, deskOptions, rateTarget, lateRule, ruleLoan, D, S, daily, deposit, withdraw, lend, startRun, bankRun, fail, setRate, brief, chip, view, totalDep, badLine, totalLoan, lendable, inject, ruleBailout, askBailout, decide, repayDebt, townBrief, leader, INTEREST, issueBonds, matureBonds, bondsOf, closeOffer, bondInfo, bondBy, runInfo, runBy };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BANK.daily(w); } catch (e) { console.warn('[Bank] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.bank && BANK.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief; // v6.74.0 擠兌與紓困債
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = world.bank && BANK.townBrief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.bank = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.bank) d.bank = this.bank; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.bank = (data?.bank && typeof data.bank.dep === 'object') ? data.bank : null; const B = this.bank; if (B) { delete B._asking; if (B.run?.asked === 'pending') B.run.asked = null; } } } catch (e) {} return r; }; // v6.74.0 舊存檔的等待旗標清掉、紓困改成讀檔後重問
}
if (typeof globalThis !== 'undefined') globalThis.BANK = BANK;
