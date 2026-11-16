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
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
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
    const isPub = (w, a) => { try { return typeof MARKET !== 'undefined' && MARKET.PUBLIC.includes(a.job?.key) && !MARKET.privatePaid?.(w, a); } catch (e) { return false; } };
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
        const int = r2(b.owed * BOND_INT); if (int > 0) { if (sp.consume('silver', int, w.tickCount, tr('公債利息'))) { B.reserve = r2((B.reserve || 0) + int); B.earned = r2((B.earned || 0) + int); b.int = r2((b.int || 0) + int); } else b.owed = r2(b.owed + int); } // 付不出利息就滾進本金
        const T = TR(w); if (T && T.low(w)) return; // 公庫還沒緩過來：只付利息，先不還本
        const pay = r2(Math.min(b.owed, Math.max(3, b.owed * BOND_BACK))); if (pay > 0 && sp.consume('silver', pay, w.tickCount, tr('償還公債'))) { B.reserve = r2((B.reserve || 0) + pay); b.owed = r2(b.owed - pay); b.paid = r2((b.paid || 0) + pay); }
        if (b.owed <= 0.01) { log(w, '🏦 公庫把向銀行借的 {n} 銀幣公債還清了，一共付了 {i} 銀幣的利息。', { n: Math.round(b.n), i: Math.round(b.int || 0) }); F.bondDone = (F.bondDone || 0) + 1; F.bond = null; }
    }
    // ================= 提案 =================
    const NAME = { fisc_exit: '離境稅', fisc_wealth: '財產稅', fisc_bond: '公債' };
    const on = (w, kind) => kind === 'fisc_exit' ? !!S(w).exit : kind === 'fisc_wealth' ? !!S(w).wealth : !!(S(w).bond?.owed > 0);
    function okNow(w, kind, ai) {
        const F = S(w), d = day(w); if (on(w, kind) || busy(w) || !w.wallet) return false; if (d - (F.last[kind] ?? -999) < (ai ? AIGAP : kind === 'fisc_bond' ? BOND_GAP : GAP)) return false;
        if (kind === 'fisc_bond') return bondOffer(w) > 0;
        try { if (typeof REPEAL !== 'undefined' && REPEAL.quiet?.(w, kind)) return false; } catch (e) {} // 剛被表決廢除的，先不再提
        return true;
    }
    function propose(w, kind, who, why) {
        if (!who || typeof TECH === 'undefined' || !KINDS.includes(kind) || on(w, kind) || busy(w)) return null; const F = S(w); const T = TR(w); const d = T ? Math.floor(T.days(w)) : 0; let p = null;
        if (kind === 'fisc_exit') p = TECH.propose(w, kind, kind, who, '開徵離境稅', '{who}提議開徵離境稅。{why}搬離小鎮的人，帶走的現金與存款超過 {f} 銀幣的部分，留下 {r}% 給公庫。留在鎮上的人不受影響。', { why: why || '', f: exitFree(), r: Math.round(EXIT_RATE * 100) }, 'economy', {});
        else if (kind === 'fisc_wealth') p = TECH.propose(w, kind, kind, who, '開徵財產稅', '{who}提議開徵財產稅。{why}現金加存款超過 {f} 銀幣的人，超過的部分每週繳 {r}% 給公庫。現在全鎮有 {n} 人超過這個數。', { why: why || '', f: wealthFree(), r: Math.round(WEALTH_RATE * 100), n: adults(w).filter(a => wealth(w, a) > wealthFree()).length }, 'economy', {});
        else { const n = bondOffer(w); if (!n) return null; p = TECH.propose(w, kind, kind, who, '公庫向銀行借 {n} 銀幣', '{who}提議公庫向鎮上的銀行借 {n} 銀幣。{why}公庫現在只夠付 {d} 天的薪水與維護。借來的錢每天付利息，公庫緩過來以後分期還；還清之前，每天的固定支出會多一筆。', { why: why || '', n, d }, 'economy', { n }); if (p) p.amt = n; }
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
        if (w.fullAgentMode || busy(w) || !w.wallet) return; const A = adults(w); if (A.length < 8) return; const T = TR(w); const short = (w.wallet.shortDay ?? -99) >= d - 3;
        // 公債：發不出薪水，或公庫只剩不到三天而且還在掉
        if (okNow(w, 'fisc_bond', false) && T && (short || (T.days(w) < 3 && (T.trend(w) ?? 1) <= 0))) { const who = A.find(a => a.job?.key === 'mayor') || A.find(a => isPub(w, a)); if (who && propose(w, 'fisc_bond', who, tr(short ? '這幾天公庫發不出全薪。' : '公庫快見底了。'))) return; }
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
        // 公債
        if (pub) return { v: 'for', why: 'fisc_pay' };
        if (dep(w, a) > 200 * idx() && !civic) return r < 0.3 ? { v: 'for', why: 'fisc_town' } : { v: 'against', why: 'fisc_bank' };
        return r < (tg ? 0.65 : 0.4) ? { v: 'for', why: 'fisc_town' } : { v: 'against', why: 'fisc_debt' };
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
        const kind = String(e.key || '').trim(); if (!KINDS.includes(kind) || !okNow(w, kind, true)) return null; return propose(w, kind, a, '');
    }
    function view(w) {
        const F = S(w); const A = adults(w); const ws = A.map(a => wealth(w, a)).sort((a, b) => b - a); const tot = ws.reduce((s, x) => s + x, 0); const k = Math.max(1, Math.round(ws.length / 10));
        return { exit: F.exit || 0, wealth: F.wealth || 0, exitFree: exitFree(), wealthFree: wealthFree(), exitRate: EXIT_RATE, wealthRate: WEALTH_RATE, st: Object.assign({}, F.st), bond: F.bond ? Object.assign({}, F.bond) : null, bondOffer: bondOffer(w), rate: F.rate, privateRate: privateRate(w), payShare: payShare(w), canHire: canHire(w),
            over: ws.filter(x => x > wealthFree()).length, share: tot > 0 ? Math.round(ws.slice(0, k).reduce((s, x) => s + x, 0) / tot * 100) : 0, CAP };
    }
    return { S, levy, weekly, privateRate, pubRate, payShare, canHire, bondOffer, debtDaily, bondDaily, on, okNow, propose, daily, vote, setLaw, enact, promptParts, fromAI, view, wealth, exitFree, wealthFree, NAME, KINDS, EXIT_RATE, WEALTH_RATE, CAP };
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
