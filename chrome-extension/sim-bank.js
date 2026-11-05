// v6.64.0 銀行:存款、放貸、利息、擠兌與倒閉
// - 城鎮以上才有銀行;銀行家是鎮上最有錢的商人(沒有就最有錢的大人)
// - 手頭寬裕又謹慎的人把錢存進去,每七天拿利息;手頭緊或想翻修房子的人來借錢,每天從收入還一點
// - 銀行最多貸出存款的七成;利率由銀行家決定(完整智能體模式由 AI 依銀行狀況決定,否則依放款風險)
// - 還不出錢就變呆帳,借款人名聲受損;謠言(八卦的人、放款太多、外地壞消息)會引發擠兌,準備金不夠就倒閉,存戶血本無歸
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
    function S(w) {
        if (!w.bank || typeof w.bank.dep !== 'object') w.bank = { open: false, banker: null, dep: {}, loans: {}, reserve: 0, rate: 0.08, depRate: 0.01, status: 'ok', bad: 0, runDay: null, lastDay: null, history: [] };
        const B = w.bank; B.dep = B.dep || {}; B.loans = B.loans || {}; return B;
    }
    const totalDep = (B) => Object.values(B.dep).reduce((s, v) => s + v, 0);
    const totalLoan = (B) => Object.values(B.loans).reduce((s, l) => s + (l.owed || 0), 0);
    function pickBanker(w) { const all = npcs(w).filter(a => a.age >= 20); const tr = all.filter(a => a.job?.key === 'trader'); return (tr.length ? tr : all).sort((x, y) => cash(w, y) - cash(w, x))[0] || null; }
    function openBank(w, B) {
        const b = pickBanker(w); if (!b) return; B.open = true; B.status = 'ok'; B.banker = b.agentId; B.openDay = day(w);
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
        if (!B.open) { if (tierLv(w) >= 1 && B.status !== 'failed') openBank(w, B); else if (B.status === 'failed' && d - (B.failDay || d) >= 30 && tierLv(w) >= 1) { B.status = 'ok'; openBank(w, B); } return; }
        const banker = w.agents[B.banker]; if (!banker || banker.isDead) { const nb = pickBanker(w); if (nb) { B.banker = nb.agentId; log(w, '🏦 {a}接手經營銀行。', { a: nb.name }, nb.name); } }
        if (B.status === 'run') { bankRun(w, B, d); return; }
        const all = npcs(w);
        // 存款:寬裕又謹慎的人
        for (const a of all) { const c = cash(w, a); const prudent = has(a, 'stoic') || has(a, 'hardworking') || has(a, 'ascetic') || has(a, 'perfectionist'); if (c > 80 && Math.random() < (prudent ? 0.25 : 0.08)) { const n = deposit(w, B, a, c * 0.5); if (n && Math.random() < 0.3) mem(w, a, '我把 {n} 銀幣存進銀行，放著也會生利息。', { n }, 4); } }
        // 需要錢的人提款
        for (const a of all) if ((B.dep[a.agentId] || 0) > 0 && cash(w, a) < 5) withdraw(w, B, a, 15);
        // 借錢:手頭緊有工作的人周轉;想翻修房子的人
        for (const a of all) {
            if (B.loans[a.agentId]) continue; const c = cash(w, a);
            if (c < 3 && a.job && Math.random() < 0.15) lend(w, B, a, 25, '周轉');
            else if (typeof HOUSING !== 'undefined' && w.housing && Math.random() < 0.03) { const h = HOUSING.houseOf(w, a); const lv = w.housing.lv?.[h]; const top = HOUSING.maxLv(w); if (h && lv !== undefined && lv < top) { const cost = HOUSING.COST[lv + 1]; if (c < cost * 1.2 && c + lendable(B) >= cost * 1.2) lend(w, B, a, cost * 1.2 - c + 5, '翻修房子'); } }
        }
        // 還款:每天從手上的錢還一點;逾期又還不出來就變呆帳
        for (const [id, L] of Object.entries(B.loans)) {
            const a = w.agents[id]; if (!a || a.isDead) { B.bad += L.owed; delete B.loans[id]; continue; }
            const pay = Math.min(L.owed, Math.max(1, Math.floor(cash(w, a) * 0.2))); if (cash(w, a) >= pay && pay > 0 && WALLET.take(w, a, pay)) { L.owed -= pay; B.reserve += pay; }
            if (L.owed <= 0) { delete B.loans[id]; mem(w, a, '終於把銀行的錢還清了。', {}, 5); continue; }
            if (d > L.due + 10 && cash(w, a) < 3) { B.bad += L.owed; delete B.loans[id]; try { DARK.bump(w, a, 'exposed'); } catch (e) {} log(w, '📉 {a}還不出銀行的 {n} 銀幣，成了呆帳。', { a: a.name, n: L.owed }, a.name); mem(w, a, '我欠銀行的錢還不出來，大家都知道了，好丟臉。', {}, 7); a.moodModifier = (a.moodModifier || 0) - 6; }
        }
        // 每七天付存款利息、銀行家調整利率
        if (d % 7 === 0) {
            for (const [id, v] of Object.entries(B.dep)) { const it = Math.floor(v * B.depRate); if (it >= 1 && B.reserve > it) { B.dep[id] = v + it; } }
            setRate(w, B);
        }
        // 謠言 → 擠兌
        const ratio = totalDep(B) ? totalLoan(B) / totalDep(B) : 0; const gossip = all.find(a => has(a, 'gossip') && (B.dep[a.agentId] || 0) > 0);
        const badNews = (w.news?.getModifier?.('mood_modifier', 0) || 0) <= -4;
        if (totalDep(B) >= 60 && (ratio > 0.65 || badNews || B.bad > 40) && Math.random() < (gossip ? 0.12 : 0.05)) startRun(w, B, d, gossip);
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
        B.status = 'run'; B.runDay = d;
        log(w, '😱 謠言說銀行快撐不住了，存戶擠到銀行門口要領錢！', {}, by?.name || '');
        if (by) mem(w, by, '我聽說銀行要倒了，趕快跟大家說。', {}, 6);
        try { w.dailyNews?.collectEvent?.('event', t('銀行擠兌'), 9, []); } catch (e) {}
    }
    function bankRun(w, B, d) {
        // 存戶搶著領錢;撐過三天謠言平息,準備金領光就倒閉
        for (const id of Object.keys(B.dep)) { const a = w.agents[id]; if (!a || Math.random() > 0.6) continue; withdraw(w, B, a, B.dep[id]); }
        if (totalDep(B) > 0 && B.reserve < 1) return fail(w, B, d);
        if (d - B.runDay >= 3) { B.status = 'ok'; log(w, '🏦 銀行撐過了擠兌，大家慢慢放心了。', {}); }
    }
    function fail(w, B, d) {
        const lost = totalDep(B); const banker = w.agents[B.banker];
        for (const [id, v] of Object.entries(B.dep)) { const a = w.agents[id]; if (!a) continue; a.moodModifier = (a.moodModifier || 0) - 10; mem(w, a, '銀行倒了，我存的 {n} 銀幣全沒了。', { n: Math.round(v) }, 9); if (banker) a.relationships.getOrCreate(banker.agentId, banker.name).modifyAffinity(-25); }
        log(w, '💥 銀行倒閉了！存戶損失 {n} 銀幣。', { n: Math.round(lost) }, banker?.name || '');
        if (banker) { mem(w, banker, '我的銀行倒了，大家都在罵我。', {}, 10); try { DARK.bump(w, banker, 'exposed'); } catch (e) {} }
        B.history.push({ day: d, lost: Math.round(lost), banker: banker?.name || '' });
        B.dep = {}; B.reserve = 0; B.open = false; B.status = 'failed'; B.failDay = d; // 放款還是要還,但銀行沒了就一筆勾銷
        B.loans = {};
    }
    function brief(w, a) { const B = w.bank; if (!B || !B.open) return ''; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; if (!dv && !L) return a.agentId === B.banker ? t('你經營鎮上的銀行') : ''; return `${t('銀行')}${t('：')}${dv ? t('存款 {n} 銀幣').replace('{n}', dv) : ''}${dv && L ? t('，') : ''}${L ? t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed)) : ''}`; }
    function chip(w, a) { const B = w.bank; if (!B || !B.open) return ''; if (a.agentId === B.banker) return `🏦 ${t('銀行家')}`; const dv = Math.round(B.dep[a.agentId] || 0), L = B.loans[a.agentId]; if (L) return `🏦 ${t('欠銀行 {n} 銀幣').replace('{n}', Math.round(L.owed))}`; if (dv) return `🏦 ${t('存款 {n} 銀幣').replace('{n}', dv)}`; return ''; }
    function view(w) { const B = S(w); return { open: B.open, status: B.status, banker: w.agents[B.banker] ? t(w.agents[B.banker].name) : null, dep: Math.round(totalDep(B)), loan: Math.round(totalLoan(B)), reserve: Math.round(B.reserve), rate: Math.round(B.rate * 100), bad: Math.round(B.bad), savers: Object.keys(B.dep).length, borrowers: Object.keys(B.loans).length, why: B.rateWhy || '', failed: B.history.slice(-1)[0] || null }; }
    return { S, daily, deposit, withdraw, lend, startRun, bankRun, fail, setRate, brief, chip, view, totalDep, totalLoan, lendable };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BANK.daily(w); } catch (e) { console.warn('[Bank] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.bank && BANK.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.bank = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.bank) d.bank = this.bank; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.bank = (data?.bank && typeof data.bank.dep === 'object') ? data.bank : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.BANK = BANK;
