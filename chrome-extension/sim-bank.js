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
    const treasury = (w) => w.stockpile?.get?.('silver') || 0;
    const INTEREST = 0.1; // 紓困借款利息
    function S(w) {
        if (!w.bank || typeof w.bank.dep !== 'object') w.bank = { open: false, banker: null, dep: {}, loans: {}, reserve: 0, rate: 0.08, depRate: 0.01, status: 'ok', bad: 0, runDay: null, lastDay: null, history: [] };
        const B = w.bank; B.dep = B.dep || {}; B.loans = B.loans || {}; B.bonds = Array.isArray(B.bonds) ? B.bonds : []; return B;
    }
    const totalDep = (B) => Object.values(B.dep).reduce((s, v) => s + v, 0);
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
        // v6.87.0 呆帳慢慢沖銷(約三週減半),以前只增不減,呆帳一過 40 就天天有擠兌風險
        B.bad = Math.max(0, Math.round(((B.bad || 0) * 0.97 - 0.5) * 10) / 10);
        // 搬走的人把存款領走(出遠門的人存款留著)
        for (const id of Object.keys(B.dep)) if (!w.agents[id] && !w.isAway?.(id)) { const v = B.dep[id] || 0; const out = Math.min(v, Math.max(0, B.reserve)); B.reserve -= out; /* 不再把負的準備金拉回 0(會憑空生錢) */ delete B.dep[id]; if (out > 0 && typeof MONEY !== 'undefined') MONEY.flow(w, 'emigrant', -out); } // v8.8.0 搬走的人帶走的存款記到「搬走帶走」
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
            if (typeof HOUSING !== 'undefined' && w.housing && Math.random() < 0.03) { const h = HOUSING.houseOf(w, a); const lv = w.housing.lv?.[h]; const top = HOUSING.maxLv(w); if (h && lv !== undefined && lv < top) { const cost = HOUSING.COST[lv + 1]; if (c < cost * 1.2 && c + lendable(B) >= cost * 1.2) BANK.lend(w, B, a, cost * 1.2 - c + 5, '翻修房子'); } }
        }
        // 還款:每天從手上的錢還一點;逾期又還不出來就變呆帳
        for (const [id, L] of Object.entries(B.loans)) {
            const a = w.agents[id]; if (!a && w.isAway?.(id)) continue; // v6.87.0 出遠門的人回來再還
            if (!a || a.isDead) { if (!(typeof ESTATE !== 'undefined' && ESTATE.foreclose(w, id, L))) B.bad += L.owed; delete B.loans[id]; continue; } // v6.90.0 有抵押品就收房子
            const pay = Math.min(L.owed, Math.max(1, Math.floor(cash(w, a) * 0.2))); if (cash(w, a) >= pay && pay > 0 && WALLET.take(w, a, pay)) { L.owed -= pay; B.reserve += pay; B.earned = (B.earned || 0) + pay * (L.rate || 0) / (1 + (L.rate || 0)); } // v6.90.0 記下利息收入
            if (L.owed <= 0) { delete B.loans[id]; mem(w, a, '終於把銀行的錢還清了。', {}, 5); continue; }
            if (d > L.due + 10 && cash(w, a) < 3) { const seized = typeof ESTATE !== 'undefined' && ESTATE.foreclose(w, id, L); if (!seized) B.bad += L.owed; delete B.loans[id]; try { DARK.bump(w, a, 'exposed'); } catch (e) {} log(w, '📉 {a}還不出銀行的 {n} 銀幣，成了呆帳。', { a: a.name, n: L.owed }, a.name); mem(w, a, '我欠銀行的錢還不出來，大家都知道了，好丟臉。', {}, 7); a.moodModifier = (a.moodModifier || 0) - 6; }
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
        if (totalDep(B) >= 60 && d - (B.lastRunEnd ?? -99) >= 20 && (ratio > 0.65 || badNews || B.bad > 40) && Math.random() < (gossip ? 0.12 : 0.05)) startRun(w, B, d, gossip);
    }
    async function setRate(w, B) {
        const ce = w.conversationEngine; const banker = w.agents[B.banker];
        const rule = () => { const ratio = totalDep(B) ? totalLoan(B) / totalDep(B) : 0; B.rate = r1(Math.max(0.04, Math.min(0.2, 0.06 + ratio * 0.08 + (B.bad > 30 ? 0.03 : 0))) * 100) / 100; };
        if (w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && banker) {
            try {
                const b = ce._agentBrief(w, banker, null);
                const prompt = `${t('你正在扮演銀行家「')}${b.name}${t('」（')}${t('性格')}${t('：')}${b.traits}${t('）')}${t('。')}${t('存款')} ${Math.round(totalDep(B))}${t('，')}${t('放款')} ${Math.round(totalLoan(B))}${t('，')}${t('準備金')} ${Math.round(B.reserve)}${t('，')}${t('呆帳')} ${Math.round(B.bad)}${t('，')}${t('目前放款利率')} ${Math.round(B.rate * 100)}%${t('。')}${t('依你的性格決定新的放款利率（4～20）與一句理由。只輸出 JSON')}${t('：')}{"rate":8,"why":"..."}`;
                ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 120);
                if (j && Number.isFinite(+j.rate)) { B.rate = Math.max(0.04, Math.min(0.2, +j.rate / 100)); B.rateWhy = String(j.why || '').slice(0, 60); return; }
            } catch (e) {}
        }
        rule();
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
        if (!R.injected && banker && !banker.isDead && B.reserve < totalDep(B)) inject(w, B, banker, R);
        if (!R.bonds && banker && !banker.isDead && B.reserve < totalDep(B) * 0.8) { R.bonds = issueBonds(w, B, d, Math.ceil(totalDep(B) - B.reserve), true) || -1; }
        if (!R.asked && B.reserve < totalDep(B) * 0.6) { askBailout(w, B, d, R); if (R.asked === 'pending') return; }
        for (const id of Object.keys(B.dep)) { const a = w.agents[id]; if (!a || Math.random() > 0.6) continue; withdraw(w, B, a, B.dep[id]); }
        if (totalDep(B) > 0 && B.reserve < 1 && !R.asked) { askBailout(w, B, d, R); if (R.asked === 'pending') return; } // 一天就被領光:倒閉前還是要先問政府
        if (totalDep(B) > 0 && B.reserve < 1) return fail(w, B, d);
        if (d - B.runDay >= 3) { B.status = 'ok'; B.run = null; B.bad = Math.round((B.bad || 0) * 0.3); B.lastRunEnd = d; log(w, '🏦 銀行撐過了擠兌，大家慢慢放心了。', {}); }
    }
    // 銀行家掏自己的錢補準備金(最多手上的七成)
    function inject(w, B, banker, R) {
        const n = Math.floor(Math.min(cash(w, banker) * 0.7, Math.ceil(totalDep(B) - B.reserve)));
        if (n >= 1 && WALLET.take(w, banker, n)) {
            B.reserve += n; R.injected = n;
            log(w, '💰 銀行家{a}掏出自己的 {n} 銀幣補進銀行，想穩住人心。', { a: banker.name, n }, banker.name);
            mem(w, banker, '擠兌的時候我把自己的 {n} 銀幣都押進銀行了，不能讓它倒。', { n }, 8);
        } else R.injected = -1;
    }
    // 債券:三十天到期;擠兌時利息較高(一成二)才有人敢買,平時八分
    function issueBonds(w, B, d, goal, inRun) {
        const banker = w.agents[B.banker]; if (!banker || goal < 5) return 0;
        const rate = inRun ? 0.12 : 0.08; B.lastIssue = d; let raised = 0, buyers = 0;
        log(w, '📜 銀行家{a}發行債券：三十天到期，利息 {r}%{why}。', { a: banker.name, r: Math.round(rate * 100), why: inRun ? '（想撐過擠兌）' : '（補充準備金）' }, banker.name);
        const cands = npcs(w).filter(a => a !== banker && cash(w, a) >= 20).sort((x, y) => cash(w, y) - cash(w, x));
        for (const a of cands) {
            if (raised >= goal) break;
            const trust = aff(a, banker); const prudent = has(a, 'stoic') || has(a, 'hardworking') || has(a, 'perfectionist');
            if (trust < -10) continue;
            let p = (inRun ? 0.2 : 0.25) + (trust > 30 ? 0.25 : trust > 10 ? 0.1 : 0) + (prudent ? 0.1 : 0) + (has(a, 'optimist') ? 0.1 : 0) - (has(a, 'pessimist') || has(a, 'neurotic') ? 0.15 : 0);
            if (inRun && (B.dep[a.agentId] || 0) > 0) p -= 0.1; // 自己的存款都在擔心了
            if (Math.random() > p) continue;
            const n = Math.floor(Math.min(cash(w, a) * 0.4, goal - raised)); if (n < 5 || !WALLET.take(w, a, n)) continue;
            B.bonds.push({ id: 'BD' + (B.bondN = (B.bondN || 0) + 1), holder: a.agentId, n, rate, issued: d, due: d + 30 });
            B.reserve += n; raised += n; buyers++;
            mem(w, a, '我買了 {n} 銀幣的銀行債券，三十天後連本帶利拿回來。', { n }, 5);
        }
        if (buyers) log(w, '📜 {k} 個人買了債券，銀行籌到 {n} 銀幣。', { k: buyers, n: raised }, banker.name);
        else log(w, '📜 沒有人敢買銀行的債券。', {}, banker.name);
        mem(w, banker, buyers ? '我發行債券籌到了 {n} 銀幣。' : '我發行債券，結果沒有人買。', { n: raised }, 6);
        return raised;
    }
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
                        + `${t('不紓困，銀行就會倒，存戶的錢全沒了')}${t('。')}${t('你要紓困嗎？依你的性格與立場決定，只輸出 JSON')}${t('：')}{"bailout":true,"why":"..."}`;
                    ce._countNpcLlmUse?.(w); j = await ce._askJson(prompt, 120);
                } catch (e) {}
                if (!live()) return;
                if (j && typeof j.bailout === 'boolean') done(j.bailout, String(j.why || '').slice(0, 60) || ruleBailout(w, B, m, need).why);
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
    }
    function brief(w, a) { const B = w.bank; if (!B || !B.open) return ''; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; const bs = bondsOf(B, a); if (bs.length && !dv && !L) return `${t('銀行')}${t('：')}${t('持有債券 {n} 銀幣').replace('{n}', bs.reduce((s, x) => s + x.n, 0))}`; if (!dv && !L) return a.agentId === B.banker ? t('你經營鎮上的銀行') : ''; return `${t('銀行')}${t('：')}${dv ? t('存款 {n} 銀幣').replace('{n}', dv) : ''}${dv && L ? t('，') : ''}${L ? t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed)) : ''}`; }
    function chip(w, a) { const B = w.bank; if (!B || !B.open) return ''; if (a.agentId === B.banker) return `🏦 ${t('銀行家')}`; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; if (L) return `🏦 ${t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed))}`; if (dv) return `🏦 ${t('存款 {n} 銀幣').replace('{n}', dv)}`; const bs = bondsOf(B, a); if (bs.length) return `📜 ${t('債券 {n} 銀幣').replace('{n}', bs.reduce((s, x) => s + x.n, 0))}`; return ''; }
    function view(w) { const B = S(w); return { open: B.open, status: B.status, banker: w.agents[B.banker] ? t(w.agents[B.banker].name) : null, dep: Math.round(totalDep(B)), loan: Math.round(totalLoan(B)), reserve: Math.round(B.reserve), rate: Math.round(B.rate * 100), bad: Math.round(B.bad), savers: Object.keys(B.dep).length, borrowers: Object.keys(B.loans).length, biz: Object.values(B.loans).filter(L => L.kind === 'biz').length, bizLent: Math.round(B.bizLent || 0), why: B.rateWhy || '', failed: B.history.slice(-1)[0] || null, pending: B.run?.asked === 'pending', debt: B.debt ? { owed: Math.round(B.debt.owed), paid: Math.round(B.debt.paid), late: B.debt.late || 0 } : null, bail: B.lastBail ? { by: t(B.lastBail.by), yes: B.lastBail.yes, n: B.lastBail.n, why: t(B.lastBail.why || ''), day: B.lastBail.day } : null, debtDone: (B.debtHist || []).slice(-1)[0] || null, bonds: (B.bonds || []).reduce((s, x) => s + x.n, 0), bondHolders: new Set((B.bonds || []).map(x => x.holder)).size, bondRate: B.bonds?.length ? Math.round(B.bonds[B.bonds.length - 1].rate * 100) : 0, defaults: B.defaults || 0 }; }
    return { S, daily, deposit, withdraw, lend, startRun, bankRun, fail, setRate, brief, chip, view, totalDep, totalLoan, lendable, inject, ruleBailout, askBailout, decide, repayDebt, townBrief, leader, INTEREST, issueBonds, matureBonds, bondsOf };
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
