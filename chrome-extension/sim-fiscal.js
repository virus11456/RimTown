// RimTown - sim-fiscal.js（v10.8.0 其他財政收入、公債、公職薪水）
// 10.7.0 讓公庫留得住錢。這一版處理另一半：稅基太窄、缺錢時沒有地方借、公職薪水跟民間脫節。
// 量過一個 115 人的鎮：全鎮六萬八千銀幣，最有錢的兩個人就有三萬三（現金加存款），財產幾乎不課稅；搬走的人把錢全部帶走；銀行有兩萬多準備金閒著。
// 四件事，前三件都是一般提案（全鎮投票 → 大事送議會 → 首長裁決），通過才有，之後可以再表決廢除：
//   離境稅  搬走的人帶走的現金與存款，超過免稅額的部分留兩成給公庫。有人帶著大筆錢搬走以後才會有人提
//   財產稅  現金加存款超過門檻的部分，每週繳 1%。公庫吃緊、所得稅已經不低、錢又集中在少數人手上時才會有人提
//   公債    公庫發不出薪水時向鎮上的銀行借，每天付利息，公庫緩過來以後分期還。銀行要留得住六成存款的準備金才借
//   公職薪水 跟著民間走：民間各行老闆發的薪水倍率取中位數（限制在八成到一成一之間），公職照這個倍率領。民間被砍薪，公職也跟著降
// 誰贊成誰反對會自己分邊：要繳的人反對，領公庫薪水的人和手頭緊的人贊成。開了完整智能體，村民發想提案時看得到這三樣還沒有、可以提
'use strict';
const FISCAL = (() => {
    const EXIT_RATE = 0.2, EXIT_FREE = 200, WEALTH_RATE = 0.01, WEALTH_FREE = 1000, HIDE = 0.4, GAP = 45, AIGAP = 5;
    const BOND_DAYS = 15, BOND_KEEP = 0.6, BOND_INT = 0.0008, BOND_BACK = 0.03, BOND_GAP = 60, CAP = 0.6;
    const KINDS = ['fisc_exit', 'fisc_wealth', 'fisc_bond'];
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const r2 = (n) => Math.round(n * 100) / 100;
    const tr = (s) => { try { return t(s); } catch (e) { return String(s || ''); } };
    const has = (a, x) => (a?.personality?.traits || []).includes(x);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, flatP(p), who || ''); } catch (e) {} };
    const flatP = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : v; return o; };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, flatP(p), imp, []); } catch (e) {} };
    const idx = () => { try { return (typeof WALLET !== 'undefined' && WALLET.wageIdx) ? WALLET.wageIdx() : 1; } catch (e) { return 1; } };
    function S(w) {
        if (!w.fiscal || typeof w.fiscal !== 'object') w.fiscal = { exit: 0, wealth: 0, last: {}, st: { exit: 0, exitN: 0, wealth: 0, wealthN: 0, hid: 0 }, bond: null, rate: 1, used: {} };
        const F = w.fiscal; F.last = F.last || {}; F.st = F.st || { exit: 0, exitN: 0, wealth: 0, wealthN: 0, hid: 0 }; F.used = F.used || {}; if (!(F.rate > 0)) F.rate = 1; return F;
    }
    const cash = (w, a) => { try { return typeof WALLET !== 'undefined' && w.wallet ? Math.max(0, WALLET.get(w, a)) : 0; } catch (e) { return 0; } };
    const dep = (w, a) => Math.max(0, +(w.bank?.dep?.[a?.agentId]) || 0);
    const wealth = (w, a) => cash(w, a) + dep(w, a);
    const exitFree = () => Math.round(EXIT_FREE * idx());
    const wealthFree = () => Math.round(WEALTH_FREE * idx());
    const TR = (w) => (typeof TREASURY !== 'undefined' && w.observerMode && w.wallet) ? TREASURY : null;
    const tight = (w) => { const T = TR(w); return !!T && (T.low(w) || (w.wallet?.shortDay ?? -99) >= day(w) - 7); };
    const isPub = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.PUBLIC.includes(a.job?.key) && !MARKET.privatePaid?.(w, a) && !(typeof CLERGY !== 'undefined' && CLERGY.paidBy(w, a)); } catch (e) { return false; } };
    const isBoss = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const busy = (w) => (w.proposals?.items || []).some(p => KINDS.includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status));
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', n, w.tickCount, tr(why), 'tax'); };

    // ================= 離境稅 =================
    // 搬走的人的現金與存款各自離開時呼叫。同一個人的免稅額只算一次
    function levy(w, id, amount) {
        const F = S(w); if (!F.exit || !(amount > 0) || !w.observerMode) return 0;
        const u = F.used[id]; const used = u ? u[0] : 0; const free = Math.max(0, exitFree() - used); F.used[id] = [used + Math.min(amount, free), day(w)]; // 現金在離開當下課、存款要等銀行結帳才領走，中間可能隔一天：免稅額記著幾天
        const n = r2(Math.max(0, amount - free) * EXIT_RATE); if (!(n > 0)) return 0;
        toTown(w, n, '離境稅'); F.st.exit = r2(F.st.exit + n); F.st.exitN++;
        log(w, '🧳 有人搬離小鎮，帶走的錢留下 {n} 銀幣的離境稅。', { n: Math.round(n) });
        return n;
    }
    // ================= 財產稅（每週一次） =================
    function weekly(w) {
        const F = S(w); if (!F.wealth || typeof WALLET === 'undefined' || !w.wallet) return 0; const free = wealthFree(); let sum = 0, n = 0;
        for (const a of adults(w)) {
            const base = wealth(w, a) - free; if (!(base > 0)) continue;
            const shady = has(a, 'greedy') || a.dark?.liar; const due = r2(base * (shady ? 1 - HIDE : 1) * WEALTH_RATE); if (shady) F.st.hid = r2(F.st.hid + base * HIDE * WEALTH_RATE); // 不老實的人少報四成（之後稅務員查得到）
            let left = due; const c = Math.min(left, cash(w, a)); if (c > 0 && WALLET.take(w, a, c)) left = r2(left - c);
            if (left > 0 && w.bank?.dep?.[a.agentId] > 0) { const B = w.bank; const x = Math.min(left, B.dep[a.agentId], Math.max(0, B.reserve || 0)); if (x > 0) { B.dep[a.agentId] = r2(B.dep[a.agentId] - x); B.reserve = r2(B.reserve - x); left = r2(left - x); } } // 現金不夠，從存款扣（銀行真的付出這筆錢）
            const paid = r2(due - left); if (!(paid > 0)) continue; toTown(w, paid, '財產稅'); sum = r2(sum + paid); n++;
            a.moodModifier = (a.moodModifier || 0) - 2; if (Math.random() < 0.5) mem(w, a, '這週繳了 {n} 銀幣的財產稅。錢放著也要被抽，心裡不痛快。', { n: Math.round(paid) }, 5);
        }
        if (sum > 0) { F.st.wealth = r2(F.st.wealth + sum); F.st.wealthN += n; log(w, '💰 這週有 {k} 人繳了財產稅，公庫進帳 {n} 銀幣。', { k: n, n: Math.round(sum) }); }
        return sum;
    }
    // ================= 公職薪水跟著民間走 =================
    function privateRate(w) {
        try { if (typeof MARKET === 'undefined' || !w.market) return 1; const M = MARKET.S(w); const v = Object.keys(MARKET.SECTORS).filter(k => M.owners?.[k]).map(k => (typeof M.pay?.[k] === 'number' ? M.pay[k] : 1)).sort((a, b) => a - b);
            if (v.length < 3) return 1; return Math.max(0.8, Math.min(1.1, v[Math.floor(v.length / 2)])); } catch (e) { return 1; } // 私人老闆不到三家：還看不出行情，照原價
    }
    const pubRate = (w) => (w?.observerMode && w.fiscal ? S(w).rate : 1);
    // 公職總薪水占公庫收入幾成；超過六成就不該再設新職位（之後的監管官員用這個判斷）
    function payShare(w) { const T = TR(w); if (!T) return null; const L = T.ledger(w); if (L.days < 10 || !(L.inSum > 0)) return null; return r2(T.payroll(w) / L.inSum); }
    const canHire = (w) => { const s = payShare(w); const T = TR(w); return s === null ? true : (s < CAP && !(T && T.low(w))); };
    // ================= 公債 =================
    const totalDep = (B) => { try { return typeof BANK !== 'undefined' ? BANK.totalDep(B) : Object.values(B.dep || {}).reduce((s, x) => s + (+x || 0), 0); } catch (e) { return 0; } };
    function bondOffer(w) {
        const T = TR(w), B = w.bank; if (!T || !B || !B.open || !B.banker || !w.agents[B.banker] || S(w).bond?.owed > 0) return 0;
        const room = (B.reserve || 0) - BOND_KEEP * totalDep(B); const n = Math.floor(Math.min(BOND_DAYS * T.fixed(w), room * 0.5)); return n >= 100 ? n : 0;
    }
    const debtDaily = (w) => { const b = w?.fiscal?.bond; return b && b.owed > 0 ? r2(b.owed * BOND_INT + Math.min(b.owed, Math.max(3, b.owed * BOND_BACK))) : 0; };
    function bondDaily(w) {
        const F = S(w), b = F.bond, B = w.bank, sp = w.stockpile; if (!b || !(b.owed > 0) || !B || !sp) return;
        const int = r2(b.owed * BOND_INT); if (int > 0) { if (sp.consume('silver', int, w.tickCount, tr('公債利息'))) { B.reserve = r2((B.reserve || 0) + int); B.earned = r2((B.earned || 0) + int); b.int = r2((b.int || 0) + int); } else { b.owed = r2(b.owed + int); missed(w); } } // 付不出利息就滾進本金（v11.12.0 記一筆：大家看得到公庫連利息都付不出來）
        const T = TR(w); if (T && T.low(w)) return; // 公庫還沒緩過來：只付利息，先不還本
        const pay = r2(Math.min(b.owed, Math.max(3, b.owed * BOND_BACK))); if (pay > 0 && sp.consume('silver', pay, w.tickCount, tr('償還公債'))) { B.reserve = r2((B.reserve || 0) + pay); b.owed = r2(b.owed - pay); b.paid = r2((b.paid || 0) + pay); }
        if (b.owed <= 0.01) { log(w, '🏦 公庫把向銀行借的 {n} 銀幣公債還清了，一共付了 {i} 銀幣的利息。', { n: Math.round(b.n), i: Math.round(b.int || 0) }); F.bondDone = (F.bondDone || 0) + 1; F.bond = null; }
    }
    // ================= 提案 =================
    const NAME = { fisc_exit: '離境稅', fisc_wealth: '財產稅', fisc_bond: '公債' };
    const on = (w, kind) => kind === 'fisc_exit' ? !!S(w).exit : kind === 'fisc_wealth' ? !!S(w).wealth : !!(S(w).bond?.owed > 0);
    function okNow(w, kind, ai) {
        const F = S(w), d = day(w); if (on(w, kind) || busy(w) || !w.wallet) return false; if (d - (F.last[kind] ?? -999) < (ai ? AIGAP : kind === 'fisc_bond' ? BOND_GAP : GAP)) return false;
        if (kind === 'fisc_bond') return bondOffer(w) > 0 && !liveBankAsk(w) && !(F.bankNo != null && d - F.bankNo < BANKNO_GAP); // v11.12.0 銀行家還在想、或剛拒絕過：先不再去碰
        try { if (typeof REPEAL !== 'undefined' && REPEAL.quiet?.(w, kind)) return false; } catch (e) {} // 剛被表決廢除的，先不再提
        return true;
    }
    function propose(w, kind, who, why, amt) {
        if (!who || typeof TECH === 'undefined' || !KINDS.includes(kind) || on(w, kind) || busy(w)) return null; const F = S(w); const T = TR(w); const d = T ? Math.floor(T.days(w)) : 0; let p = null;
        if (kind === 'fisc_exit') p = TECH.propose(w, kind, kind, who, '開徵離境稅', '{who}提議開徵離境稅。{why}搬離小鎮的人，帶走的現金與存款超過 {f} 銀幣的部分，留下 {r}% 給公庫。留在鎮上的人不受影響。', { why: why || '', f: exitFree(), r: Math.round(EXIT_RATE * 100) }, 'economy', {});
        else if (kind === 'fisc_wealth') p = TECH.propose(w, kind, kind, who, '開徵財產稅', '{who}提議開徵財產稅。{why}現金加存款超過 {f} 銀幣的人，超過的部分每週繳 {r}% 給公庫。現在全鎮有 {n} 人超過這個數。', { why: why || '', f: wealthFree(), r: Math.round(WEALTH_RATE * 100), n: adults(w).filter(a => wealth(w, a) > wealthFree()).length }, 'economy', {});
        else { const n = Math.floor(amt > 0 ? Math.min(amt, bondOffer(w)) : bondOffer(w)); if (!(n > 0)) return null; const at = burdenAt(w, n, 1); // v11.12.0 投票的人看得到借了之後的負擔、這一年借過幾次、有沒有付不出利息、有多少人不放心
            p = TECH.propose(w, kind, kind, who, '公庫向銀行借 {n} 銀幣', '{who}提議公庫向鎮上的銀行借 {n} 銀幣。{why}公庫現在只夠付 {d} 天的薪水與維護。借來的錢每天付利息，公庫緩過來以後分期還；還清之前，每天的固定支出會多一筆。借了之後，公庫欠的錢相當於 {di} 天的收入，負擔{lv}；這一年已經借過 {k} 次，{x} 次付不出利息；鎮上有 {u} 個人不放心首長管錢。', { why: why || '', n, d, di: at.days, lv: at.name, k: at.n1y - 1, x: at.m60, u: uneasy(w) }, 'economy', { n }); if (p) p.amt = n; }
        if (p) F.last[kind] = day(w);
        return p;
    }
    // 沒開智能體：看處境決定有沒有人提
    function daily(w) {
        const F = S(w), d = day(w); if (F.lastDay === d) return; F.lastDay = d; for (const k of Object.keys(F.used)) if (!Array.isArray(F.used[k]) || d - F.used[k][1] > 5) delete F.used[k];
        // 公職薪水倍率慢慢靠向民間行情（一天最多動 0.02）
        let target = privateRate(w); if (target > 1 && tight(w)) target = 1; // 公庫吃緊的時候不跟著民間加薪
        F.rate = r2(F.rate + Math.max(-0.02, Math.min(0.02, target - F.rate)));
        try { bondDaily(w); } catch (e) { console.warn('[Fiscal] bond', e); }
        if (d % 7 === 3 && F.wkDay !== d) { F.wkDay = d; try { weekly(w); } catch (e) { console.warn('[Fiscal] weekly', e); } }
        if (F.bankAsk && d - F.bankAsk.d >= 2) { const dc = F.tight?.dec; if (dc && dc.pick === 'bond' && !dc.res && F.bankAsk.src === 'tight') dc.res = { k: '銀行家一直沒有回話' }; F.bankAsk = null; } // 銀行家兩天都沒回話：這次就算了
        try { trustDaily(w); } catch (e) { console.warn('[Fiscal] trust', e); }
        try { tightDaily(w); } catch (e) { console.warn('[Fiscal] tight', e); }
        if (w.fullAgentMode || busy(w) || !w.wallet) return; const A = adults(w); if (A.length < 8) return; const T = TR(w); const short = (w.wallet.shortDay ?? -99) >= d - 3;
        // 公債：發不出薪水，或公庫只剩不到三天而且還在掉（緊急情況照舊自動有人提；v11.12.0 借不借先問銀行家）
        if (okNow(w, 'fisc_bond', false) && T && (short || (T.days(w) < 3 && (T.trend(w) ?? 1) <= 0))) { const who = A.find(a => a.job?.key === 'mayor') || A.find(a => isPub(w, a)); if (who && askBond(w, who, tr(short ? '這幾天公庫發不出全薪。' : '公庫快見底了。'), short ? 'short' : 'low')) return; }
        // 離境稅：最近 30 天有人帶著大筆錢搬走
        if (okNow(w, 'fisc_exit', false)) { let out = 0; try { for (const [k, D] of Object.entries(w.money?.days || {})) if (+k > d - 30) out += Math.max(0, -(D.emigrant || 0)); } catch (e) {}
            let total = 0; try { total = MONEY.total(w); } catch (e) {}
            if (out >= Math.max(300 * idx(), total * 0.02)) { const who = A.filter(a => wealth(w, a) < exitFree() * 2).sort((x, y) => (isPub(w, y) ? 1 : 0) - (isPub(w, x) ? 1 : 0))[0]; if (who && propose(w, 'fisc_exit', who, tr('這一個月搬走的人帶走了 {n} 銀幣，一毛都沒留下。').replace('{n}', Math.round(out)))) return; } }
        // 財產稅：公庫吃緊、所得稅已經不低、錢又集中在少數人手上
        if (okNow(w, 'fisc_wealth', false) && tight(w) && (w.wallet.tax || 0) >= 0.1) { const ws = A.map(a => wealth(w, a)).sort((a, b) => b - a); const tot = ws.reduce((s, x) => s + x, 0); const k = Math.max(1, Math.round(ws.length / 10)); const share = tot > 0 ? ws.slice(0, k).reduce((s, x) => s + x, 0) / tot : 0;
            if (share >= 0.6 && ws[0] > wealthFree()) { const who = A.filter(a => wealth(w, a) < 100 * idx()).sort((x, y) => (has(y, 'charismatic') ? 1 : 0) - (has(x, 'charismatic') ? 1 : 0))[0]; if (who) propose(w, 'fisc_wealth', who, tr('公庫吃緊，所得稅已經加到 {t}%，全鎮的錢卻有 {s}% 在最有錢的一成人手上。').replace('{t}', Math.round(w.wallet.tax * 100)).replace('{s}', Math.round(share * 100))); } }
    }
    // ---------- 投票（沒有 AI 時） ----------
    function vote(w, p, a) {
        const kind = p.kind; if (a.agentId === p.proposerId) return { v: 'for', why: 'fisc_mine' };
        const W = wealth(w, a), tg = tight(w), pub = isPub(w, a), poor = W < 100 * idx(), civic = a.job?.key === 'mayor' || has(a, 'hardworking') || has(a, 'stoic'); const r = Math.random();
        if (kind === 'fisc_exit') {
            if (W > exitFree() * 5) return { v: 'against', why: 'fisc_rich' };
            if (isBoss(w, a) && !civic) return r < 0.2 ? { v: 'for', why: 'fisc_fair' } : { v: 'against', why: 'fisc_boss' };
            if (pub && tg) return { v: 'for', why: 'fisc_pay' };
            return r < (poor ? 0.75 : tg ? 0.6 : 0.45) ? { v: 'for', why: poor ? 'fisc_fair' : 'fisc_town' } : { v: 'against', why: 'fisc_free' };
        }
        if (kind === 'fisc_wealth') {
            if (W > wealthFree()) return { v: 'against', why: 'fisc_rich' };
            if (W > wealthFree() * 0.5) return r < 0.25 ? { v: 'for', why: 'fisc_town' } : { v: 'against', why: 'fisc_next' };
            if (pub && tg) return { v: 'for', why: 'fisc_pay' };
            return r < (poor ? 0.8 : tg ? 0.6 : 0.4) ? { v: 'for', why: poor ? 'fisc_fair' : 'fisc_town' } : { v: 'against', why: has(a, 'greedy') ? 'fisc_next' : 'fisc_free' };
        }
        // 公債（v11.12.0 負擔偏重以上、或自己已經不放心首長管錢，贊成的機會往下；在意多少看個人）
        const BU = burden(w); const cc = concern(w, a, headOf(w)); const dis = TS(w).by[a.agentId] || 0; const hit = (BU.lv >= 1 ? 0.12 * BU.lv * cc : 0) + Math.min(0.25, dis / 120); const heavy = hit >= 0.1;
        if (pub) return (BU.lv < 2 || r >= 0.25 * cc) ? { v: 'for', why: 'fisc_pay' } : { v: 'against', why: 'fisc_burden' };
        if (dep(w, a) > 200 * idx() && !civic) return r < 0.3 - hit ? { v: 'for', why: 'fisc_town' } : { v: 'against', why: heavy ? 'fisc_burden' : 'fisc_bank' };
        return r < (tg ? 0.65 : 0.4) - hit ? { v: 'for', why: 'fisc_town' } : { v: 'against', why: heavy ? 'fisc_burden' : 'fisc_debt' };
    }
    // ---------- 通過 ----------
    function setLaw(w, kind) {
        const F = S(w), d = day(w);
        if (kind === 'fisc_exit') { F.exit = d; log(w, '🧳 離境稅開徵了：搬走的人帶走的錢，超過 {f} 銀幣的部分留下 {r}% 給公庫。', { f: exitFree(), r: Math.round(EXIT_RATE * 100) }); return tr('離境稅開徵了'); }
        if (kind === 'fisc_wealth') { F.wealth = d; log(w, '💰 財產稅開徵了：現金加存款超過 {f} 銀幣的人，超過的部分每週繳 {r}%。', { f: wealthFree(), r: Math.round(WEALTH_RATE * 100) }); for (const a of adults(w)) if (wealth(w, a) > wealthFree()) { a.moodModifier = (a.moodModifier || 0) - 4; mem(w, a, '鎮上開徵財產稅了，我的錢每週都要被抽一筆。', {}, 6); } return tr('財產稅開徵了'); }
        return '';
    }
    function enact(w, p) {
        if (p.kind !== 'fisc_bond') return setLaw(w, p.kind);
        const F = S(w), B = w.bank; const n = Math.min(p.amt || 0, bondOffer(w)); if (!(n >= 50) || !B) return '';
        B.reserve = r2(B.reserve - n); w.stockpile.add('silver', n, w.tickCount, tr('發行公債'), 'bond'); F.bond = { owed: n, n, day: day(w), paid: 0, int: 0 }; F.st.bonds = (F.st.bonds || 0) + 1;
        F.hist = (F.hist || []).filter(x => day(w) - x.d < 400); F.hist.push({ d: day(w), n }); try { feel(w, 'bond', n); } catch (e) { console.warn('[Fiscal] feel', e); } // v11.12.0 記下這一年借了幾次
        log(w, '🏦 公庫向銀行借了 {n} 銀幣的公債，每天付利息，之後分期還。', { n }); try { w.dailyNews?.collectEvent?.('economy', `${tr('公庫向銀行借了公債')} ${n}`, 7); } catch (e) {}
        return tr('借到了 {n} 銀幣').replace('{n}', n);
    }
    // ---------- 給 AI ----------
    function promptParts(w) {
        try { if (busy(w) || !w.wallet) return { ctx: '', fx: '' }; const L = [];
            if (okNow(w, 'fisc_exit', true)) L.push(`fisc_exit${tr('＝')}${tr('離境稅（搬走的人帶走的錢，超過 {f} 銀幣的部分留 {r}% 給公庫）').replace('{f}', exitFree()).replace('{r}', Math.round(EXIT_RATE * 100))}`);
            if (okNow(w, 'fisc_wealth', true)) L.push(`fisc_wealth${tr('＝')}${tr('財產稅（現金加存款超過 {f} 銀幣的部分每週繳 {r}%，現在有 {n} 人超過）').replace('{f}', wealthFree()).replace('{r}', Math.round(WEALTH_RATE * 100)).replace('{n}', adults(w).filter(a => wealth(w, a) > wealthFree()).length)}`);
            if (okNow(w, 'fisc_bond', true) && tight(w)) L.push(`fisc_bond${tr('＝')}${tr('公庫向銀行借 {n} 銀幣（每天付利息，之後分期還）').replace('{n}', bondOffer(w))}`);
            if (!L.length) return { ctx: '', fx: '' };
            return { ctx: `${tr('【鎮上還沒有、可以提案開辦的公庫財源】')}${L.join(tr('、'))}\n`, fx: `{"type":"fiscal","key":"${tr('上面「公庫財源」的代碼')}"}${tr('（替公庫開一項新的財源。要繳的人會反對，要有說得過去的理由）')}\n` };
        } catch (e) { return { ctx: '', fx: '' }; }
    }
    function fromAI(w, a, j) {
        const e = (Array.isArray(j?.effects) ? j.effects : []).find(o => String(o?.type || '').toLowerCase() === 'fiscal'); if (!e) return null;
        const kind = String(e.key || '').trim(); if (!KINDS.includes(kind) || !okNow(w, kind, true)) return null;
        if (kind === 'fisc_bond') { const r = askBond(w, a, '', 'ai'); return r?.p || null; } // v11.12.0 借不借先問銀行家
        return propose(w, kind, a, '');
    }
    // ================= v11.12.0 公債的負擔，與大家怎麼看 =================
    // 負擔看四件事：還沒還的公債相當於幾天的公庫收入（最近 30 天每天的收入，不算借來的錢）、每天還本付息占收入幾成、最近一年借了幾次、最近有沒有付不出利息。
    // 一次只能借一筆，一筆最多 15 天的固定支出（固定支出通常比收入少），所以剛借的那一筆多半不到 10 天的收入；照現在的還法（每天還 3%），一筆要五個月左右才還得清，一年最多借兩三次。門檻照這個規模訂：
    //   輕   ：有欠，上面幾項都還沒到
    //   偏重 ：欠的錢有 10 天以上的收入，或一年借了 2 次以上，或最近 30 天付不出利息過
    //   太重 ：欠的錢有 20 天以上的收入，或一年借了 3 次以上，或最近 60 天有 3 次付不出利息
    //   還清之後：一年借了 3 次以上或最近 60 天付不出利息 3 次的算輕，其餘就是沒有欠債
    const HEAVY_DAYS = 10, BAD_DAYS = 20, HEAVY_N = 2, BAD_N = 3, BAD_MISS = 3, CAPDROP = 30, UNEASY = 5;
    const LV_NAME = { '-1': '沒有欠債', 0: '輕', 1: '偏重', 2: '太重' };
    const r1 = (n) => Math.round(n * 10) / 10;
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fillK(x.k, x.p)) : (typeof x === 'string' ? tr(x) : (x == null ? '' : String(x)));
    const fillK = (k, p) => { let s = tr(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const income = (w) => { const T = TR(w); if (!T) return 0; const L = T.ledger(w); if (L.days < 5) return r2(T.fixed(w)); return r2(Math.max(0, L.inSum - (L.in.bond || 0))); }; // 帳還不滿五天：先拿固定支出當收入估
    function burdenAt(w, owed, extraN) {
        const F = S(w), d = day(w); const inc = income(w); const n1y = (F.hist || []).filter(x => d - x.d < 360).length + (extraN || 0);
        const miss = Array.isArray(F.miss) ? F.miss : []; const m30 = miss.filter(x => d - x < 30).length, m60 = miss.filter(x => d - x < 60).length;
        const dd = owed > 0 ? (inc > 0 ? owed / inc : 999) : 0; const svc = owed > 0 ? (inc > 0 ? r2(owed * BOND_INT + Math.min(owed, Math.max(3, owed * BOND_BACK))) / inc : 1) : 0;
        let lv = -1; if (owed > 0) { lv = 0; if (dd >= HEAVY_DAYS || n1y >= HEAVY_N || m30 >= 1) lv = 1; if (dd >= BAD_DAYS || n1y >= BAD_N || m60 >= BAD_MISS) lv = 2; } else if (n1y >= BAD_N || m60 >= BAD_MISS) lv = 0;
        return { owed: r2(owed), inc, days: r1(dd), svc: r2(svc), n1y, m30, m60, miss: S(w).st.miss || 0, lv, name: LV_NAME[lv] };
    }
    const burden = (w) => burdenAt(w, S(w).bond?.owed > 0 ? S(w).bond.owed : 0, 0);
    function burdenLine(w, B) {
        B = B || burden(w); if (B.owed <= 0) return B.n1y ? fillK('公債已經還清；這一年借過 {k} 次。', { k: B.n1y }) : tr('公庫沒有欠銀行錢。');
        return fillK('公庫還欠銀行 {n} 銀幣，相當於 {d} 天的公庫收入；每天的利息與還本約占收入 {p}%；這一年借了 {k} 次，{m}。負擔{lv}。', { n: Math.round(B.owed), d: B.days >= 999 ? '∞' : Math.round(B.days), p: Math.round(B.svc * 100), k: B.n1y, m: B.m60 ? { k: '最近 60 天有 {x} 次付不出利息、滾進本金', p: { x: B.m60 } } : '利息都按時付', lv: B.name });
    }
    function missed(w) { const F = S(w), d = day(w); F.miss = (Array.isArray(F.miss) ? F.miss : []).filter(x => d - x < 90); if (!F.miss.includes(d)) { F.miss.push(d); F.st.miss = (F.st.miss || 0) + 1; try { feel(w, 'miss'); } catch (e) { console.warn('[Fiscal] feel', e); } } }
    // 誰是管錢的人：在鎮上的正式首長（坐牢、出遠門、探險的不算）
    function headOf(w) { let m = null; try { const E = w.election; m = E?._realMayor ? E._realMayor(w) : (npcs(w).find(a => a.job?.key === 'mayor') || null); } catch (e) { m = null; } return m && !m.isDead && w.agents[m.agentId] === m && m.currentLocation !== 'exploration' && !w.isAway?.(m.agentId) ? m : null; }
    const holderOf = (w) => { try { return w.election?._officeHolder?.(w) || headOf(w); } catch (e) { return headOf(w); } }; // 大家怪的是掛著這個位子的人（出遠門也一樣）
    const kingOf = (w) => { try { return typeof CROWN !== 'undefined' && w.crown && !w.crown.republic ? CROWN.king(w) : null; } catch (e) { return null; } };
    const affTo = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    // 這個人對公庫欠債有多在意：節儉、謹慎、有存款在銀行、繳稅多的人在意得多；領公家薪水的人在意得少；跟首長交情好的人寬容一點
    function concern(w, a, M) {
        let c = 1; if (has(a, 'thrifty')) c += 0.6; if (has(a, 'neurotic')) c += 0.3; if (has(a, 'pessimist')) c += 0.3; if (has(a, 'perfectionist')) c += 0.2; if (has(a, 'optimist')) c -= 0.2;
        if (dep(w, a) > 100 * idx()) c += 0.5; if (isBoss(w, a) || wealth(w, a) > wealthFree()) c += 0.3;
        if (isPub(w, a)) c *= 0.4; const f = M ? affTo(a, M) : 0; if (f >= 40) c *= 0.5; else if (f >= 20) c *= 0.75;
        return r2(Math.max(0.1, c));
    }
    function TS(w) { const F = S(w); if (!F.trust || typeof F.trust !== 'object') F.trust = { head: null, by: {}, legit: 0, lv: -1, wk: null }; const X = F.trust; if (!X.by || typeof X.by !== 'object') X.by = {}; X.legit = +X.legit || 0; return X; }
    const uneasy = (w) => Object.values(w?.fiscal?.trust?.by || {}).filter(x => x >= UNEASY).length;
    // 對首長的好感往下（n<0）或回來（n>0）。往下最多 30；回來只還這件事扣掉的部分
    function nudge(w, a, M, n) {
        const X = TS(w); let r = null; try { r = a.relationships?.getOrCreate?.(M.agentId, M.name); } catch (e) {} if (!r) return 0; const b0 = r.affinity || 0; const had = X.by[a.agentId] || 0;
        const want = n < 0 ? -Math.min(-n, Math.max(0, CAPDROP - had)) : Math.min(n, had); if (!want) return 0;
        if (typeof r.modifyAffinity === 'function') r.modifyAffinity(want); else r.affinity = b0 + want; const got = r2((r.affinity || 0) - b0);
        const left = r2(had - got); if (left > 0.01) X.by[a.agentId] = left; else delete X.by[a.agentId]; return got;
    }
    function legitBy(w, n) { // 國王當政：民心（C.legit）跟著動；往下最多 20，回來只還這件事扣掉的
        const k = kingOf(w); const C = w.crown; if (!k || !C) return 0; const X = TS(w); const want = n < 0 ? -Math.min(-n, Math.max(0, 20 - X.legit)) : Math.min(n, X.legit); if (!want) return 0;
        const b0 = C.legit; C.legit = Math.max(0, Math.min(100, C.legit + want)); const got = C.legit - b0; X.legit = r2(Math.max(0, X.legit - got)); return got;
    }
    // 有事的那一刻（負擔變重、剛借一筆、付不出利息）：在意的人往下一點，在意得多的人記在心裡
    function feel(w, ev, n) {
        if (!w.observerMode || !w.wallet) return; const M = holderOf(w); const X = TS(w); if (M && X.head !== M.agentId) { X.head = M.agentId; X.by = {}; }
        const B = burden(w); if (ev === 'bond' && B.lv < 1) return; // 借得不多：大家沒什麼感覺
        const k = { lv: B.lv >= 2 ? '公庫欠銀行的錢太多了，我不放心{m}這樣管錢。' : '公庫欠銀行的錢越來越重，{m}到底打算怎麼還？', bond: '公庫又跟銀行借了 {n} 銀幣，這一年已經借了 {k} 次。', miss: '公庫連公債的利息都付不出來，{m}是怎麼管錢的？' }[ev];
        const xs = adults(w).filter(a => a !== M).map(a => [a, concern(w, a, M)]).sort((p, q) => q[1] - p[1]);
        if (ev === 'miss') { if (M) for (const [a, c] of xs) nudge(w, a, M, -2 * c); legitBy(w, -4); }
        let n0 = 0; for (const [a, c] of xs) { if (c < 1.2 || n0 >= 8) break; n0++; mem(w, a, k, { m: M ? M.name : tr('首長'), n: Math.round(n || 0), k: B.n1y }, ev === 'miss' ? 7 : 6); }
    }
    function trustDaily(w) {
        const F = S(w), d = day(w); const X = TS(w); const M = holderOf(w); if (M && X.head !== M.agentId) { X.head = M.agentId; X.by = {}; } // 換了首長：新的人從頭算（舊首長的好感留在原地）
        const B = burden(w); if (B.lv > X.lv && B.lv >= 1) { X.lv = B.lv; X.lvDay = d; feel(w, 'lv'); } else if (B.lv < X.lv) X.lv = B.lv;
        if (X.wk === d || d % 7 !== 5) return; X.wk = d;
        if (B.lv >= 1) { const per = B.lv >= 2 ? 2.5 : 1; if (M) for (const a of adults(w)) if (a !== M) nudge(w, a, M, -per * concern(w, a, M)); legitBy(w, B.lv >= 2 ? -2.5 : -1); }
        else { if (M) for (const id of Object.keys(X.by)) { const a = w.agents[id]; if (!a || a.isDead) { delete X.by[id]; continue; } nudge(w, a, M, 2); } legitBy(w, 1.5); } // 債還下來了：看法慢慢回來
    }

    // ================= v11.12.0 銀行家也有話語權：公庫來借錢，借不借由他決定（選擇點 bankDesk 的 ctx.t = 'bond'） =================
    const BANKNO_GAP = 15;
    const liveBankAsk = (w) => { const A = w?.fiscal?.bankAsk; return A && day(w) - A.d < 2 ? A : null; };
    const tellerOf = (w, who) => { try { return typeof BANK !== 'undefined' && BANK.teller && w.bank ? BANK.teller(w, w.bank, who) : null; } catch (e) { return null; } };
    // 首長（或緊急時領公家薪水的人）要借錢：銀行家在鎮上、決策核心開著就先問他；他點頭才開成提案，照樣要全鎮表決。銀行家不在鎮上（或決策核心沒開）照以前直接提
    function askBond(w, who, why, src) {
        if (!who || !okNow(w, 'fisc_bond', false)) return null; const F = S(w); const b = tellerOf(w, who);
        if (!b || typeof DECIDE === 'undefined' || !DECIDE.on(w)) { const p = propose(w, 'fisc_bond', who, why); return p ? { p } : null; }
        F.bankTok = (F.bankTok || 0) + 1; const d = day(w); F.bankAsk = { d, tok: F.bankTok, by: who.agentId, why: why || '', src: src || '', n: bondOffer(w) }; F.st.bankAsk = (F.st.bankAsk || 0) + 1;
        const ctx = { t: 'bond', tok: F.bankTok, d }; const n0 = (w.proposals?.items || []).length;
        if (DECIDE.inRun?.()) DECIDE.enqueue(w, b, 'bankDesk', ctx); else DECIDE.askNow(w, [{ a: b, kind: 'bankDesk', ctx }]);
        const p = (w.proposals?.items || []).slice(n0).find(x => x.kind === 'fisc_bond') || null; return { asked: true, b, p };
    }
    function liveBond(w, b, ctx) { const A = liveBankAsk(w); if (!A || !ctx || A.tok !== ctx.tok || tellerOf(w) !== b) return null; const M = w.agents[A.by]; if (!M || M.isDead || S(w).bond?.owed > 0) return null; const n = Math.floor(Math.min(A.n, bondOffer(w))); if (!(n >= 100)) return null; return { A, M, n, B: w.bank }; }
    function bankFacts(w, b, ctx) {
        const X = liveBond(w, b, ctx); if (!X) return ''; const { A, M, n, B } = X; const T = TR(w); const F = S(w); const BU = burden(w); const at = burdenAt(w, n, 1); const k = F.st.bonds || 0;
        const rec = !k ? tr('公庫以前沒有跟銀行借過錢') : fillK('公庫以前借過 {k} 次、還清 {c} 次，{m}', { k, c: F.bondDone || 0, m: F.st.miss ? { k: '有 {x} 次付不出利息、滾進本金', p: { x: F.st.miss } } : '利息都按時付' });
        return fillK('{m}想替公庫向銀行借 {n} 銀幣（你答應了還要全鎮表決）。{why}公庫現在 {s} 銀幣，只夠付 {d} 天的薪水與維護。這筆是銀行準備金的 {p}%（準備金 {r}、存款 {dep}）。利息每天 {i}%，公庫夠付 10 天以上時每天還本 3%。{rec}。借了之後，公庫欠的錢相當於 {di} 天的收入，負擔{lv}；這一年已經借過 {y} 次。鎮上有 {u} 個人不放心首長管錢。',
            { m: M.name, n, why: A.why ? { raw: A.why } : { raw: '' }, s: T ? Math.round(T.view(w).silver) : 0, d: T ? Math.floor(T.days(w)) : 0, p: Math.round(n / Math.max(1, B.reserve) * 100), r: Math.round(B.reserve), dep: Math.round(typeof BANK !== 'undefined' ? BANK.totalDep(B) : 0), i: Math.round(BOND_INT * 10000) / 100, rec: { raw: rec }, di: Math.round(at.days), lv: at.name, y: BU.n1y, u: uneasy(w) });
    }
    function bankOptions(w, b, ctx) {
        const X = liveBond(w, b, ctx); if (!X) return []; const { A, M, n, B } = X; const at = burdenAt(w, n, 1); const share = n / Math.max(1, B.reserve); const h = Math.floor(n / 2); const urg = A.src === 'short' ? 0.6 : 0; const m60 = Math.min(3, at.m60); const out = [];
        const go = (frac) => (w2, b2) => { const X2 = liveBond(w2, b2, ctx); if (!X2) return null; return bankYes(w2, b2, X2, Math.floor(X2.n * frac), frac < 1); };
        out.push({ id: 'lend', text: { k: '照借 {n} 銀幣', p: { n } }, say: '答應借錢給公庫', why: '公庫是鎮上的，借給它收得回來，利息也穩。', base: 1.4 + urg - at.lv * 0.9 - (at.lv >= 2 ? 2.5 : 0) - m60 * 0.5 - (share > 0.4 ? 0.5 : 0) + (affTo(b, M) >= 40 ? 0.3 : 0), lean: { gain: 0.3, bond: 0.2 }, run: go(1) });
        if (h >= 100) out.push({ id: 'half', text: { k: '只借一半（{n} 銀幣）', p: { n: h } }, say: '只肯借一半給公庫', why: '先借一半，看公庫還不還得起。', base: 0.3 + Math.max(0, at.lv) * 0.6 + (has(b, 'thrifty') ? 0.3 : 0) + (share > 0.3 ? 0.3 : 0), lean: { safe: 0.4 }, run: go(0.5) });
        out.push({ id: 'refuse', text: '不借', say: '不肯借錢給公庫', why: at.lv >= 2 ? '公庫已經欠太多了，再借收不回來。' : '銀行的錢是存戶的，不能拿去填公庫的洞。', base: -0.3 + Math.max(0, at.lv) * 0.9 + (at.lv >= 2 ? 2.2 : 0) + m60 * 0.6 + (share > 0.5 ? 0.6 : 0) - urg, lean: { safe: 0.4, face: 0.1 },
            run: (w2, b2) => { const X2 = liveBond(w2, b2, ctx); if (!X2) return null; return bankNo(w2, b2, X2); } });
        return out;
    }
    function bankYes(w, b, X, amt, half) {
        const F = S(w); F.bankAsk = null; const p = propose(w, 'fisc_bond', X.M, X.A.why, amt); if (!p) return { k: '這個案現在提不了' };
        p.bankBy = b.agentId; F.st.bankYes = (F.st.bankYes || 0) + 1; if (half) F.st.bankHalf = (F.st.bankHalf || 0) + 1;
        log(w, half ? '🏦 銀行家{b}只肯借公庫一半，{n} 銀幣，送交全鎮表決。' : '🏦 銀行家{b}答應借公庫 {n} 銀幣，送交全鎮表決。', { b: b.name, n: p.amt }, b.name);
        const dc = F.tight?.dec; if (dc && X.A.src === 'tight' && dc.pick === 'bond' && !dc.pid) { dc.pid = p.id; dc.bank = half ? 'half' : 'yes'; }
        return { k: '答應借 {n} 銀幣，等全鎮表決', p: { n: p.amt } };
    }
    function bankNo(w, b, X) {
        const F = S(w), d = day(w); F.bankAsk = null; F.bankNo = d; F.st.bankNo = (F.st.bankNo || 0) + 1;
        log(w, '🏦 銀行家{b}不肯借錢給公庫。', { b: b.name }, b.name); mem(w, X.M, '我想替公庫跟銀行借錢，銀行家{b}不肯借。', { b: b.name }, 7); mem(w, b, '{m}要替公庫借錢，我沒有答應。', { m: X.M.name }, 6);
        const dc = F.tight?.dec; if (dc && X.A.src === 'tight' && dc.pick === 'bond' && !dc.res) { dc.bank = 'no'; dc.res = { k: '銀行家{b}不肯借', p: { b: b.name } }; }
        return { k: '沒借' };
    }

    // ================= v11.12.0 公庫吃緊，首長怎麼辦（選擇點 fiscTight，登記在 sim-decide-pol.js） =================
    // 以前公庫不夠付 10 天，三個監管職位就一律不補人；要借錢只在發不出薪水、或不到 3 天還在掉的時候才會有人提。
    // 現在公庫吃緊一陣子（連續 5 天不到 10 天），或監管職位因為公庫吃緊空著，就問首長打算怎麼辦，選項只列當下做得到的：
    //   先撐著 ／ 先補稅務員（只放行這一個職位，照原本的提名與同意流程）／ 向銀行借（銀行家點頭後照樣全鎮表決）／ 提案加稅（照樣全鎮表決）
    // 最多十天問一次；借錢、加稅、稅務員的提名還在表決時不問。精簡公職沒有做：現有的裁員只裁人比職缺多的行業，沒有「首長把某一類公職減一兩人」的路
    const TIGHT_RUN = 5, TIGHT_GAP = 10, TAXMAN_DAYS = 30;
    const PEND = ['open', 'shelved', 'approved'];
    const pendKind = (w, f) => (w.proposals?.items || []).some(p => PEND.includes(p.status) && f(p));
    const OF = () => (typeof OFFICE !== 'undefined' && OFFICE ? OFFICE : null);
    const CV = () => (typeof CIVIC !== 'undefined' ? CIVIC : null);
    function TT(w) { const F = S(w); if (!F.tight || typeof F.tight !== 'object') F.tight = { last: -99, run: 0, tok: 0, dec: null, hist: [], tax: null, st: { asks: 0 } }; const X = F.tight; if (!Array.isArray(X.hist)) X.hist = []; X.st = Object.assign({ asks: 0 }, X.st || {}); return X; }
    // 因為公庫吃緊（canHire 為假）而空著的監管職位
    function blocked(w) { const O = OF(); if (!O || !O.on(w)) return []; let can = true; try { can = canHire(w); } catch (e) {} if (can) return []; return O.wanted(w).filter(p => !O.holder(w, p)); }
    const stillTight = (w) => { const T = TR(w); return !!T && (T.low(w) || blocked(w).length > 0); };
    const taxOpen = (w) => pendKind(w, p => p.kind === 'tax');
    const bondOpen = (w) => pendKind(w, p => p.kind === 'fisc_bond') || !!liveBankAsk(w);
    const nomOpen = (w, post) => pendKind(w, p => p.kind === 'office_appoint' && p.post === post);
    // 首長決定先補稅務員：這段時間（30 天）只放行稅務員這一個職位（sim-office.js 補人時看）
    const taxmanOk = (w) => { const X = w?.fiscal?.tight; return !!(X && X.tax && day(w) <= X.tax.until); };
    function tightInfo(w) {
        const T = TR(w); const v = T.view(w); const L = v.ledger; const net = r2(L.inSum - L.outSum); const lo = v.LOW_DAYS * v.fixed; const need = Math.max(0, lo - v.silver);
        return { v, L, net, lo, back: !v.low ? 0 : net > 0 ? Math.ceil(need / net) : null };
    }
    function bondWhyNot(w) {
        const F = S(w), d = day(w), B = w.bank;
        if (!B || !B.open) return { k: '鎮上沒有銀行' };
        if (!B.banker || !w.agents[B.banker]) return { k: '銀行家出遠門了，沒有人可以談' };
        if (F.bond?.owed > 0) return { k: '還有一筆公債沒還完（還欠 {n} 銀幣）', p: { n: Math.round(F.bond.owed) } };
        const ago = d - (F.last.fisc_bond ?? -999); if (ago < BOND_GAP) return { k: '{n} 天前才提過借錢，要隔 {g} 天才能再提', p: { n: ago, g: BOND_GAP } };
        if (F.bankNo != null && d - F.bankNo < BANKNO_GAP) return { k: '銀行家 {n} 天前才拒絕借錢給公庫', p: { n: d - F.bankNo } };
        if (bondOpen(w) || busy(w)) return { k: '借錢或開稅的案已經在表決' };
        if (!(bondOffer(w) > 0)) return { k: '銀行的準備金不夠，借不出錢' };
        if (!tellerOf(w)) return { k: '銀行家現在不在鎮上，沒有人可以談' };
        return null;
    }
    function taxHist(w) { const d = day(w); const xs = (w.proposals?.items || []).filter(p => p.kind === 'tax' && p.dir === 'up' && p.status === 'rejected' && d - (p.resolvedDay ?? p.createdDay ?? d) <= 180); return { n: xs.length, ago: xs.length ? d - Math.max(...xs.map(p => p.resolvedDay ?? p.createdDay ?? d)) : null }; }
    function taxWhyNot(w) {
        const C = CV(); if (!C || !C.taxUp || !w.wallet || !w.proposals?._createWith) return { k: '現在沒辦法提加稅' }; const tax = w.wallet.tax ?? 0.1;
        if (tax >= 0.25) return { k: '稅率已經 {t}%，不能再加', p: { t: Math.round(tax * 100) } }; if (taxOpen(w)) return { k: '稅率的案已經在表決' };
        const g = day(w) - (C.S(w).lastTax ?? -99); if (g < 15) return { k: '{n} 天前才有人提過稅率，要隔 15 天', p: { n: g } }; return null;
    }
    function taxmanWhyNot(w, M) {
        const O = OF(); if (!O || !O.on(w) || !O.wanted(w).includes('tax')) return { k: '鎮上還沒有稅務員這個職位' }; if (O.holder(w, 'tax')) return { k: '已經有稅務員了' };
        if (nomOpen(w, 'tax')) return { k: '稅務員的提名已經在表決' }; if (canHire(w) || taxmanOk(w)) return { k: '稅務員現在本來就補得了人' }; if (!O.candidates(w, M, 'tax').length) return { k: '找不到可以當稅務員的人' }; return null;
    }
    // 該不該問首長（每天一次，在 FISCAL.daily 裡）
    let hooked = false;
    function tightDaily(w) {
        const T = TR(w); if (!T || typeof DECIDE === 'undefined' || !DECIDE.on(w) || !DECIDE.KINDS?.fiscTight) return null; const X = TT(w), d = day(w);
        if (!hooked) { hooked = true; DECIDE.observe((ev, o) => { if (ev !== 'decided' || o?.K?.key !== 'fiscTight') return; const dc = o.w?.fiscal?.tight?.dec; if (dc && dc.d === day(o.w) && o.why) dc.why = o.why; }); } // AI 的理由回話時才有
        if (X.runDay !== d) { X.run = T.low(w) ? (X.run || 0) + 1 : 0; X.runDay = d; }
        follow(w, X, d); if (X.tax && d > X.tax.until) X.tax = null; if (X.pend && d - X.pend.d >= 2) X.pend = null;
        if (X.pend || d - (X.last ?? -99) < TIGHT_GAP) return null;
        const bl = blocked(w); if (!(X.run >= TIGHT_RUN || bl.length)) return null;
        if (taxOpen(w) || bondOpen(w) || nomOpen(w, 'tax')) return null; // 同類的案還在表決
        const M = headOf(w); if (!M) return null; // 首長不在（出遠門、坐牢、出缺）就不問
        X.last = d; X.tok = (X.tok || 0) + 1; const ctx = { d, tok: X.tok }; X.pend = { d, tok: X.tok, by: M.agentId }; X.st.asks++;
        if (DECIDE.inRun?.()) DECIDE.enqueue(w, M, 'fiscTight', ctx); else DECIDE.askNow(w, [{ a: M, kind: 'fiscTight', ctx }]);
        return ctx;
    }
    const liveTight = (w, a, ctx) => { const X = w.fiscal?.tight; return !!(ctx && X && X.pend && X.pend.tok === ctx.tok && day(w) - ctx.d <= 1 && headOf(w) === a && stillTight(w)); };
    function tightFacts(w, a, ctx) {
        if (!liveTight(w, a, ctx)) return ''; const I = tightInfo(w); const v = I.v; const X = TT(w); const d = day(w); const bl = blocked(w); const O = OF();
        const parts = [fillK('公庫現在 {s} 銀幣，每天固定支出約 {f}（公職薪水 {p}、建築維護 {u}{debt}），夠付 {d} 天{low}。最近 {n} 天平均每天收入 {i}、支出 {o}，{net}。', { s: v.silver, f: Math.round(v.fixed), p: Math.round(v.payroll), u: Math.round(v.upkeep), debt: v.debt ? { k: '、還債 {n}', p: { n: Math.round(v.debt) } } : { raw: '' }, d: v.days, low: v.low ? { k: '，低於 {lo} 天的門檻，已經連續 {k} 天', p: { lo: v.LOW_DAYS, k: X.run } } : { raw: '' }, n: I.L.days, i: Math.round(I.L.inSum), o: Math.round(I.L.outSum), net: I.net >= 0 ? { k: '每天還有 {n} 結餘', p: { n: Math.round(I.net) } } : { k: '每天少 {n}', p: { n: Math.round(-I.net) } } })];
        if (bl.length) parts.push(fillK('{list}因為公庫吃緊空著，沒有補人。', { list: { raw: bl.map(p => tr(O.pname(p))).join(tr('、')) } }));
        if (!v.low && bl.length) { const ps = payShare(w); if (ps != null) parts.push(fillK('公職薪水已經占公庫收入的 {p}%，超過 {c}% 就不再設新職位。', { p: Math.round(ps * 100), c: Math.round(CAP * 100) })); }
        parts.push(v.low ? (I.back != null ? fillK('照最近的結餘，大約 {n} 天後公庫自己回到 {lo} 天的門檻。', { n: I.back, lo: v.LOW_DAYS }) : fillK('照最近的結餘，公庫自己回不到 {lo} 天的門檻。', { lo: v.LOW_DAYS })) : '');
        const tw = taxmanWhyNot(w, a); if (!tw) { const Y = O.taxYield(w); parts.push(fillK('稅務員的津貼每天 {n} 銀幣。他每週查 {k} 家東家的帳；照現在鎮上 {f} 家店的東家估，照規定查、照規定罰的話，大約每週追回 {y} 銀幣（查不查、罰不罰由他自己決定）。', { n: Y.pay, k: Y.left, f: Y.firms, y: Math.round(Y.week) })); }
        const bw = bondWhyNot(w); if (!bw) { const n = bondOffer(w); const at = burdenAt(w, n, 1); const pay = r2(Math.min(n, Math.max(3, n * BOND_BACK))); parts.push(fillK('向鎮上的銀行借：最多 {n} 銀幣，每天利息約 {i}，公庫夠付 10 天以上時每天還本約 {b}；借到之後公庫夠付 {d} 天。銀行家要點頭，之後還要全鎮表決。借了之後，公庫欠的錢相當於 {di} 天的收入，負擔{lv}。', { n, i: r2(n * BOND_INT), b: Math.round(pay), d: Math.floor((v.silver + n) / (v.fixed + r2(n * BOND_INT + pay))), di: Math.round(at.days), lv: at.name })); }
        else parts.push(fillK('借錢現在不行：{x}。', { x: bw }));
        const xw = taxWhyNot(w); const th = taxHist(w); const tax = Math.round((w.wallet?.tax ?? 0.1) * 100);
        if (!xw) parts.push(fillK('所得稅現在是 {t}%，提案可以加到 {n}%。{h}', { t: tax, n: tax + 5, h: th.n ? { k: '最近半年有 {k} 次加稅提案被否決，最近一次在 {x} 天前。', p: { k: th.n, x: th.ago } } : '最近半年沒有加稅提案被否決。' }));
        else parts.push(fillK('加稅現在不行：{x}。', { x: xw }));
        const BU = burden(w); if (BU.owed > 0 || BU.n1y) parts.push(burdenLine(w, BU));
        const u = uneasy(w); if (u) parts.push(fillK('鎮上有 {n} 個人不放心你管錢。', { n: u }));
        const dc = X.dec; if (dc) parts.push(fillK('上次（{n} 天前）你決定{x}{why}，{res}。', { n: d - dc.d, x: PICK[dc.pick] || dc.pick, why: dc.why ? { k: '（「{y}」）', p: { y: dc.why } } : { raw: '' }, res: dc.res || '還沒有結果' }));
        return parts.filter(Boolean).join('');
    }
    const PICK = { wait: '先撐著', taxman: '先補稅務員', bond: '向銀行借錢', tax: '提案加稅' };
    function setDec(w, a, pick) { const X = TT(w); const d = day(w); if (X.dec) { X.hist.push(X.dec); if (X.hist.length > 6) X.hist.shift(); } X.dec = { pick, by: a.agentId, name: a.name, d, why: null, res: null, pid: null }; X.pend = null; X.st[pick] = (X.st[pick] || 0) + 1; return X.dec; }
    function tightOptions(w, a, ctx) {
        if (!liveTight(w, a, ctx)) return []; const I = tightInfo(w); const BU = burden(w); const u = uneasy(w); const pop = Math.max(1, adults(w).length); const out = []; const net = I.net; const X = TT(w);
        const againWait = X.dec?.pick === 'wait' && net <= 0 ? 0.8 : 0; const back = I.back;
        out.push({ id: 'wait', text: back != null ? { k: '先撐著，等公庫自己回來（照最近的結餘大約 {n} 天）', p: { n: back } } : '先撐著，等公庫自己回來（照最近的結餘回不來）', say: '公庫先撐著，等它自己回來', why: net > 0 ? '每天都還有結餘，再等一等就回來了。' : '現在動哪一樣都會得罪人，先看看再說。',
            base: 1.0 + (has(a, 'shy') ? 0.6 : 0) + (has(a, 'kind') ? 0.3 : 0) + (net > 0 && back != null && back <= 20 ? 0.5 : 0) - (net <= 0 ? 2.0 : 0) - againWait - (has(a, 'hardworking') ? 0.3 : 0), lean: { safe: 0.3, bond: 0.2 },
            run: (w2, a2) => { if (!liveTight(w2, a2, ctx)) return null; setDec(w2, a2, 'wait'); log(w2, '🏛️ {m}決定公庫先撐著，等它自己回來。', { m: a2.name }, a2.name); mem(w2, a2, '公庫吃緊，我決定先撐著，等它自己回來。', {}, 6); return { k: '先撐著，等公庫自己回來' }; } });
        const O = OF(); if (!taxmanWhyNot(w, a)) { const Y = O.taxYield(w); out.push({ id: 'taxman', text: { k: '先補一位稅務員（津貼每天 {n}，估計每週追回 {y}），其他職位照樣空著', p: { n: Y.pay, y: Math.round(Y.week) } }, say: '先補稅務員', why: '查帳追回來的錢比津貼多，這個位子不能省。',
            base: 0.7 + (has(a, 'hardworking') ? 0.6 : 0) + (has(a, 'perfectionist') ? 0.4 : 0) - (has(a, 'shy') ? 0.2 : 0) + (Y.week > Y.pay * 7 ? 0.5 : -0.5), lean: { gain: 0.3, face: 0.1 },
            run: (w2, a2) => { if (!liveTight(w2, a2, ctx)) return null; const dc = setDec(w2, a2, 'taxman'); const d2 = day(w2); TT(w2).tax = { d: d2, until: d2 + TAXMAN_DAYS, by: a2.agentId }; try { const OS = OFFICE.S(w2); OS.lastNom.tax = d2; DECIDE.enqueue(w2, a2, 'officeNominate', { post: 'tax' }); } catch (e) {} dc.post = 'tax';
                log(w2, '🧾 {m}決定公庫再緊也要先補一位稅務員，其他職位照樣空著。', { m: a2.name }, a2.name); mem(w2, a2, '公庫吃緊，我決定先補一位稅務員，查帳追回來的錢比津貼多。', {}, 6); return { k: '先補稅務員，開始找人' }; } }); }
        if (!bondWhyNot(w)) { const n = bondOffer(w); out.push({ id: 'bond', text: { k: '向鎮上的銀行借 {n} 銀幣（銀行家要點頭，還要全鎮表決）', p: { n } }, say: '想向銀行借錢', why: BU.n1y ? '先借錢撐過去，緩過來再還。' : '公庫從來沒借過錢，借一筆撐過去，緩過來再還。',
            base: 0.4 + (has(a, 'ambitious') ? 0.3 : 0) + (has(a, 'optimist') ? 0.3 : 0) + (net <= 0 ? 0.6 : 0) - (has(a, 'thrifty') ? 0.6 : 0) - Math.max(0, BU.lv) * 0.8 - (BU.lv >= 2 ? 4 : 0) - (u / pop) * 2, lean: { gain: 0.2, safe: -0.3 },
            run: (w2, a2) => { if (!liveTight(w2, a2, ctx)) return null; const dc = setDec(w2, a2, 'bond'); const r = askBond(w2, a2, tr('公庫吃緊。'), 'tight'); if (r?.p && !dc.pid) dc.pid = r.p.id; if (!r) dc.res = { k: '借錢的案提不出來' };
                log(w2, '🏦 {m}想替公庫向銀行借錢。', { m: a2.name }, a2.name); return r?.p ? { k: '提了借錢的案，等大家表決' } : r?.asked ? (dc.res ? dc.res : { k: '請銀行家{b}考慮', p: { b: r.b.name } }) : { k: '這個案現在提不了' }; } }); }
        if (!taxWhyNot(w)) { const th = taxHist(w); out.push({ id: 'tax', text: { k: '提案把所得稅從 {t}% 加到 {n}%（要全鎮表決）', p: { t: Math.round((w.wallet.tax ?? 0.1) * 100), n: Math.round((w.wallet.tax ?? 0.1) * 100) + 5 } }, say: '提案加稅', why: '公庫的錢要靠稅收，稅率太低了。',
            base: 0.3 + (has(a, 'hardworking') ? 0.5 : 0) + (has(a, 'stoic') ? 0.3 : 0) - (has(a, 'shy') ? 0.6 : 0) - (has(a, 'kind') ? 0.2 : 0) - 0.35 * th.n + (net <= 0 ? 0.6 : 0), lean: { safe: 0.2, bond: -0.3 },
            run: (w2, a2) => { if (!liveTight(w2, a2, ctx)) return null; const dc = setDec(w2, a2, 'tax'); const p = CIVIC.taxUp(w2, a2); if (p) dc.pid = p.id; else dc.res = { k: '加稅的案提不出來' }; return p ? { k: '提了加稅的案，等大家表決' } : { k: '加稅的案現在提不了' }; } }); }
        return out;
    }
    // 上次的決定後來怎麼了：提案過了沒有、稅務員補上了沒有、公庫回來了沒有。沒做成的記一筆（日誌、首長的記憶），下次問的時候寫進事實
    function follow(w, X, d) {
        const dc = X.dec; if (!dc || dc.res) return; const M = w.agents[dc.by]; const T = TR(w);
        const sad = (k, p) => { dc.res = { k, p: p || {} }; log(w, '🏛️ {m}上次決定{x}，結果{r}。', { m: dc.name, x: PICK[dc.pick], r: { k, p: p || {} } }, dc.name); if (M) mem(w, M, '公庫吃緊時我決定{x}，結果{r}。', { x: PICK[dc.pick], r: { k, p: p || {} } }, 6); };
        if ((dc.pick === 'bond' || dc.pick === 'tax') && dc.pid) { const p = (w.proposals?.items || []).find(x => x.id === dc.pid); if (!p) return;
            if (p.status === 'done') dc.res = dc.pick === 'bond' ? { k: '借到了 {n} 銀幣', p: { n: p.amt || 0 } } : { k: '稅率調成了 {n}%', p: { n: Math.round((w.wallet?.tax ?? 0) * 100) } };
            else if (['rejected', 'expired', 'failed'].includes(p.status)) sad(dc.pick === 'bond' ? '借錢的案被否決了' : '加稅的案被否決了'); return; }
        if (dc.pick === 'taxman') { const O = OF(); const h = O?.holder(w, 'tax'); if (h) { dc.res = { k: '{a}當上了稅務員', p: { a: h.name } }; return; }
            const p = (w.proposals?.items || []).filter(x => x.kind === 'office_appoint' && x.post === 'tax' && x.createdDay >= dc.d).pop(); if (p && ['rejected', 'expired', 'failed'].includes(p.status) && !nomOpen(w, 'tax') && d - dc.d >= 3) { sad('提名的人沒有通過'); return; }
            if (d - dc.d > TAXMAN_DAYS) sad('一直沒有補上人'); return; }
        if (dc.pick === 'wait' && T && !T.low(w)) dc.res = { k: '公庫在 {n} 天後回到門檻', p: { n: d - dc.d } };
    }
    // 監管職位空著的原因（sim-office.js 的 view 給介面）
    function vacancy(w, post) {
        const X = w.fiscal?.tight; const d = day(w);
        const ap = (w.proposals?.items || []).find(p => p.kind === 'office_appoint' && p.post === post && PEND.includes(p.status)); if (ap) return { k: 'nom', t: fillK('已提名{a}，等議會同意', { a: w.agents[ap.cand]?.name || '' }) };
        let can = true; try { can = canHire(w); } catch (e) {} if (can) return { k: 'open', t: tr('空缺，等首長提名') };
        if (post === 'tax' && taxmanOk(w)) return { k: 'taxman', t: tr('首長決定先補稅務員，等他提名') };
        if (liveBankAsk(w)) return { k: 'bank', t: tr('公庫吃緊，首長要借錢，等銀行家回話') };
        if (pendKind(w, p => p.kind === 'fisc_bond')) return { k: 'bond', t: tr('公庫吃緊，正在表決向銀行借錢') };
        if (taxOpen(w)) return { k: 'tax', t: tr('公庫吃緊，正在表決加稅') };
        const dc = X?.dec; if (dc && dc.pick === 'wait' && d - dc.d <= 30) return { k: 'wait', t: dc.why ? fillK('首長{m}決定先撐著：「{why}」', { m: dc.name, why: dc.why }) : fillK('首長{m}決定先撐著', { m: dc.name }) };
        return { k: 'none', t: tr('空缺，公庫吃緊，還沒有人決定怎麼辦') };
    }
    function tightView(w) { const X = w.fiscal?.tight; if (!X) return null; const dc = X.dec; return { last: X.last, run: X.run || 0, pend: !!X.pend, taxman: taxmanOk(w), st: Object.assign({}, X.st), dec: dc ? { pick: dc.pick, name: dc.name, d: dc.d, ago: day(w) - dc.d, why: dc.why ? tx(dc.why) : '', res: dc.res ? tx(dc.res) : '', bank: dc.bank || null } : null }; }

    function view(w) {
        const F = S(w); const A = adults(w); const ws = A.map(a => wealth(w, a)).sort((a, b) => b - a); const tot = ws.reduce((s, x) => s + x, 0); const k = Math.max(1, Math.round(ws.length / 10));
        return { exit: F.exit || 0, wealth: F.wealth || 0, exitFree: exitFree(), wealthFree: wealthFree(), exitRate: EXIT_RATE, wealthRate: WEALTH_RATE, st: Object.assign({}, F.st), bond: F.bond ? Object.assign({}, F.bond) : null, bondOffer: bondOffer(w), rate: F.rate, privateRate: privateRate(w), payShare: payShare(w), canHire: canHire(w),
            over: ws.filter(x => x > wealthFree()).length, share: tot > 0 ? Math.round(ws.slice(0, k).reduce((s, x) => s + x, 0) / tot * 100) : 0, CAP,
            burden: burden(w), burdenText: burdenLine(w), uneasy: uneasy(w), adults: A.length, bankAsk: !!liveBankAsk(w), bankNo: F.bankNo ?? null, tight: tightView(w) };
    }
    return { S, levy, weekly, privateRate, pubRate, payShare, canHire, bondOffer, debtDaily, bondDaily, on, okNow, propose, daily, vote, setLaw, enact, promptParts, fromAI, view, wealth, exitFree, wealthFree, NAME, KINDS, EXIT_RATE, WEALTH_RATE, CAP,
        burden, burdenAt, burdenLine, concern, uneasy, trustDaily, feel, TS, headOf, askBond, bankFacts, bankOptions, tightDaily, tightFacts, tightOptions, tightInfo, taxmanOk, vacancy, blocked, bondWhyNot, taxWhyNot, taxmanWhyNot, taxHist, TT, LV_NAME, PICK,
        TH: { HEAVY_DAYS, BAD_DAYS, HEAVY_N, BAD_N, BAD_MISS, CAPDROP, UNEASY, TIGHT_RUN, TIGHT_GAP, TAXMAN_DAYS, BANKNO_GAP } };
})();
if (typeof globalThis !== 'undefined') globalThis.FISCAL = FISCAL;

// ---- 掛勾 ----
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { fisc_exit: { icon: '🧳', label: '離境稅' }, fisc_wealth: { icon: '💰', label: '財產稅' }, fisc_bond: { icon: '🏦', label: '公債' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { fisc_mine: '這是我提的', fisc_rich: '這筆錢要從我身上出', fisc_boss: '怕做生意的人待不住', fisc_pay: '公庫沒錢，我的薪水就發不出來', fisc_fair: '有錢的人該多出一點', fisc_town: '公庫需要這筆錢', fisc_free: '自己的錢該由自己作主', fisc_next: '怕哪天輪到自己', fisc_bank: '怕銀行的錢被借走，自己的存款領不出來', fisc_debt: '借了總是要還' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { FISCAL.daily(w); } catch (e) { console.warn('[Fiscal] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (FISCAL.KINDS.includes(p.kind)) { const r = FISCAL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
// 兩種稅通過以後就是鎮上的規定：可以再表決廢除、廢除以後可以再表決恢復（公債是一次性的借款，不在這裡）
if (typeof REPEAL !== 'undefined' && REPEAL.LAWS) {
    const rich = (w, a, f) => { try { return FISCAL.wealth(w, a) > f() ? 3 : 0; } catch (e) { return 0; } };
    REPEAL.LAWS.fisc_exit = { icon: '🧳', name: '離境稅', cat: 'economy', ok: () => true, on: (w) => !!w.fiscal?.exit, since: (w) => w.fiscal?.exit || null, off: (w) => { FISCAL.S(w).exit = 0; },
        vote: (w, a) => FISCAL.vote(w, { kind: 'fisc_exit' }, a), lead: (w, a) => rich(w, a, () => FISCAL.exitFree() * 5),
        why: '有錢的人說，辛苦賺來的錢要帶去哪裡是自己的事。', after: '廢除以後，搬走的人可以把錢全部帶走。', set: (w) => FISCAL.setLaw(w, 'fisc_exit'), back: '有人說少了這條規定，錢又一筆一筆被帶出鎮外。' };
    REPEAL.LAWS.fisc_wealth = { icon: '💰', name: '財產稅', cat: 'economy', ok: () => true, on: (w) => !!w.fiscal?.wealth, since: (w) => w.fiscal?.wealth || null, off: (w) => { FISCAL.S(w).wealth = 0; },
        vote: (w, a) => FISCAL.vote(w, { kind: 'fisc_wealth' }, a), lead: (w, a) => rich(w, a, () => FISCAL.wealthFree()),
        why: '要繳的人說，錢放著也要被抽，等於罰存錢的人。', after: '廢除以後，現金與存款不再每週課稅。', set: (w) => FISCAL.setLaw(w, 'fisc_wealth'), back: '有人說少了這條規定，公庫又少了一筆穩定的收入。' };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.fiscal = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.fiscal) d.fiscal = this.fiscal; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.fiscal = (data?.fiscal && typeof data.fiscal === 'object') ? data.fiscal : null; } catch (e) {} return r; };
}
