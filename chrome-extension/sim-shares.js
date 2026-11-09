// v8.7.0 股份與合夥經營:鎮上的七種產業(農莊、食堂、布莊、木作坊、礦場、鐵鋪、商行)可以好幾個人一起擁有
// - 招股:公營產業標售時沒有人一個人買得起,就由一個有野心的人帶頭,找交情好、手頭寬裕的朋友一起出錢,照出資比例拿股份
// - 當家:股份最多的人當家(就是原本的「老闆」),收營收、發工資;其他人是股東
// - 分紅:每週由當家把利潤的六成照股份分給股東;貪心、愛說謊的當家會做假帳少分,細心的股東有機會翻帳本抓到
// - 賣股週轉:當家欠薪、手頭沒錢時,先賣一部分股份給有錢人,而不是整家被賣掉
// - 眼紅入股:生意好的產業,有錢又眼紅的人會出高一點的價錢買股份;吝嗇的當家不一定肯
// - 缺錢賣股:股東自己快吃不上飯時,把股份賣回給當家(或別的有錢人)
// - 拆夥:當家和股東翻臉,當家買斷對方的股份
// - 股東會奪權:不滿的股東(被抓到做假帳、連幾週沒分紅、欠薪)股份加起來比當家多,就聯手把當家拉下來
// - 繼承:股東過世,股份由配偶或成年子女繼承;沒有家人就照比例分給其他股東
// - 搬走:股東搬走,股份照比例分給留下的股東;當家搬走就由股份最多的接手(原本會直接變公營)
// - 不動銀幣(銀幣守恆):全部是錢包之間轉帳,標售的錢照舊進公庫
// 存在 world.market.shares(各產業的持股)與 world.market.sh(紀錄)。必須在 sim-market.js 之後載入。
'use strict';

const SHARES = (function () {
    const M_ = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const news = (w, k, p, imp, nm) => { try { w.dailyNews?.collectEvent?.('economy', fill(k, p), imp || 7, nm || []); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const W8 = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const WAYS_ = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const present = (w, id) => !!id && (!!w.agents?.[id] || !!w.isAway?.(id));
    const bal = (w, id) => Math.max(0, (w.wallet?.bal?.[id]) || 0);
    const addId = (w, id, n) => { const B = w.wallet?.bal; if (!B || !id || !(n > 0)) return; B[id] = Math.round(((B[id] || 0) + n) * 100) / 100; };
    const takeId = (w, id, n) => { const B = w.wallet?.bal; if (!B || !id || !(n > 0)) return n <= 0; const b = B[id] || 0; if (b + 1e-6 < n) return false; B[id] = Math.round((b - n) * 100) / 100; return true; };
    const pay = (w, from, to, n) => { n = Math.round(n * 100) / 100; if (!(n > 0) || !takeId(w, from, n)) return false; addId(w, to, n); return true; };
    const toTown = (w, n, why) => { if (n > 0) w.stockpile?.add?.('silver', Math.round(n * 100) / 100, w.tickCount, why); };
    const nm = (k) => M_().name(k);
    const nameOf = (w, id) => w.agents?.[id]?.name || '';
    const SEC = () => Object.keys(M_().SECTORS);
    const MAXH = 4; // 一家最多四個股東(通過員工認股以後,自家工人另外可以認股,最多六個)
    const maxH = (w) => (S(w).sh.law.staff ? 6 : MAXH);

    function S(w) {
        const M = M_().S(w); M.shares = M.shares && typeof M.shares === 'object' ? M.shares : {};
        if (!M.sh || typeof M.sh !== 'object') M.sh = {};
        const X = M.sh; X.st = X.st || { syn: 0, sold: 0, buy: 0, out: 0, cheat: 0, caught: 0, div: 0, split: 0, inh: 0 };
        X.cheat = X.cheat || {}; X.angry = X.angry || {}; X.dry = X.dry || {}; X.lastDiv = X.lastDiv || {}; X.hist = X.hist || []; X.basis = X.basis || {}; X.law = X.law || {};
        return M;
    }
    // 某家產業的持股({ id: 百分比 }),當家一定在裡面;舊存檔或剛被整家買下的產業 = 當家一人 100%
    function stakes(w, k) {
        const M = S(w); const own = M.owners[k]; if (!own) { delete M.shares[k]; return {}; }
        let s = M.shares[k]; if (!s || !(own in s)) s = M.shares[k] = { [own]: 100 };
        return s;
    }
    const holders = (w, k) => Object.keys(stakes(w, k));
    const pctOf = (w, k, id) => stakes(w, k)[id] || 0;
    const holdings = (w, id) => SEC().filter(k => pctOf(w, k, id) > 0).map(k => [k, pctOf(w, k, id), S(w).owners[k] === id]);
    // 把百分比整理成整數、加起來 100、拿掉 0
    function norm(s) {
        const ks = Object.keys(s).filter(id => s[id] > 0.0001); const tot = ks.reduce((x, id) => x + s[id], 0) || 1; const out = {}; let left = 100;
        ks.sort((a, b) => s[b] - s[a]).forEach((id, i) => { const v = i === ks.length - 1 ? left : Math.max(1, Math.round(s[id] / tot * 100)); out[id] = Math.max(0, v); left -= out[id]; });
        for (const id of Object.keys(out)) if (out[id] <= 0) delete out[id];
        return out;
    }
    // 股份最多的人當家
    function setBoss(w, k, why) {
        const M = S(w); const s = M.shares[k]; if (!s || !Object.keys(s).length) return null;
        const top = Object.keys(s).filter(id => present(w, id)).sort((a, b) => s[b] - s[a])[0] || null; const old = M.owners[k];
        if (top && top !== old) { M.owners[k] = top; if (why) log(w, why, { a: nameOf(w, top), o: nameOf(w, old), s: nm(k) }, nameOf(w, top)); }
        return top;
    }
    // 估價:沿用產業估價;一成股份的價錢 = 估價的一成
    const valueOf = (w, k) => { try { return M_().value(w, k, npcs(w)); } catch (e) { return 60; } };
    const priceOf = (w, k, pct, prem = 1) => Math.max(5, Math.round(valueOf(w, k) * pct / 100 * prem));
    // 一家產業最近七天的利潤(扣營業稅與工資)
    const profit7 = (w, k) => { const h = S(w).hist[k] || []; return h.reduce((s, [r, c]) => s + r * (1 - M_().TAX) - c, 0); };
    const shady = (a) => has(a, 'greedy') || hasV(a, '財富') || !!a?.dark?.liar;
    const sharp = (a) => has(a, 'perfectionist') || hasV(a, '知識') || ['trader', 'researcher', 'banker'].includes(a?.job?.key);
    const note = (w, k, txt, p) => { const X = S(w).sh; X.hist.unshift([day(w), k, txt, p || {}]); X.hist = X.hist.slice(0, 12); };

    // 轉讓股份:from 賣 pct 給 to,錢從 to 付給 from
    function transfer(w, k, from, to, pct, price) {
        const s = stakes(w, k); pct = Math.min(pct, s[from] || 0); if (!(pct > 0)) return false;
        if (price > 0 && !pay(w, to, from, price)) return false;
        s[from] -= pct; s[to] = (s[to] || 0) + pct; S(w).shares[k] = norm(s);
        const X = S(w).sh; const B = X.basis[k] = X.basis[k] || {}; if (price > 0) B[to] = Math.round(((B[to] || 0) + price) * 100) / 100;
        return true;
    }

    // ---------- 招股:公營產業標售,沒人一個人買得起時合股買下 ----------
    function syndicate(w, all, d) {
        const M = S(w);
        for (const k of SEC()) {
            if (M.owners[k] || !M_().workersOf(w, k, all).length) continue;
            const price = valueOf(w, k);
            if (all.some(a => bal(w, a.agentId) >= price * 2) || M_().workersOf(w, k, all).some(a => bal(w, a.agentId) >= price)) continue; // 有人一個人買得起,照原本的標售
            const amb = w.mind?.amb || {};
            const leads = all.filter(a => (a.age ?? 30) >= 18 && bal(w, a.agentId) >= price * 0.3 && (has(a, 'hardworking') || has(a, 'greedy') || has(a, 'ambitious') || amb[a.agentId]?.key === 'rich' || a.job?.key === 'trader' || M_().JOB2S[a.job?.key] === k))
                .sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId));
            const lead = leads[0]; if (!lead || Math.random() > 0.5) continue;
            const mine = Math.min(bal(w, lead.agentId) * 0.9, price * 0.7); let need = price - mine; const parts = [[lead, mine]];
            const friends = all.filter(o => o !== lead && aff(o, lead) >= 30 && bal(w, o.agentId) >= 15).sort((x, y) => aff(y, lead) - aff(x, lead) || bal(w, y.agentId) - bal(w, x.agentId));
            for (const f of friends) { if (need <= 0.5 || parts.length >= MAXH) break; const put = Math.min(need, bal(w, f.agentId) * (has(f, 'thrifty') ? 0.4 : 0.6), price * 0.45); if (put < price * 0.08) continue; parts.push([f, put]); need -= put; }
            if (need > 0.5 || parts.length < 2) continue;
            const paid = []; let ok = true;
            for (const [a, n] of parts) { if (takeId(w, a.agentId, Math.round(n * 100) / 100)) paid.push([a, Math.round(n * 100) / 100]); else { ok = false; break; } }
            if (!ok) { for (const [a, n] of paid) addId(w, a.agentId, n); continue; }
            toTown(w, price, t('公營產業標售'));
            const s = {}; for (const [a, n] of paid) s[a.agentId] = n; M.shares[k] = norm(s); M.owners[k] = lead.agentId; M.pay[k] = has(lead, 'greedy') ? 0.85 : 1;
            const X = M.sh; X.st.syn++; X.basis[k] = {}; for (const [a, n] of paid) X.basis[k][a.agentId] = n;
            const others = paid.slice(1).map(([a]) => a);
            log(w, '🤝 {a}一個人買不起{s}，找了{b}一起合股，湊足 {n} 銀幣買了下來，由{a}當家。', { a: lead.name, b: others.map(x => x.name).join(t('、')), s: nm(k), n: price }, lead.name);
            news(w, '🤝 {a}和{b}合股買下了{s}', { a: lead.name, b: others.map(x => x.name).join(t('、')), s: nm(k) }, 7, [lead.name, ...others.map(x => x.name)]);
            mem(w, lead, '我找朋友合股買下了{s}，由我當家。', { s: nm(k) }, 8);
            for (const o of others) { mem(w, o, '我出錢跟{a}合股買下{s}，拿到 {p}% 的股份。', { a: lead.name, s: nm(k), p: M.shares[k][o.agentId] || 0 }, 7); bump(o, lead, 5); bump(lead, o, 5); }
            note(w, k, '合股買下', { a: lead.name });
        }
    }

    // ---------- 當家欠薪、沒錢:先賣股週轉 ----------
    function rescue(w, all) {
        const M = S(w);
        for (const k of SEC()) {
            const id = M.owners[k]; if (!id || !w.agents[id]) continue; const s = stakes(w, k);
            if ((M.unpaid[id] || 0) < 2 || bal(w, id) >= 10 || (s[id] || 0) < 45) continue;
            const pct = Math.min(25, (s[id] || 0) - 30); if (pct < 10) continue; const price = priceOf(w, k, pct, 0.85); // 急著賣,賣便宜一點
            const buyer = all.filter(a => a.agentId !== id && bal(w, a.agentId) >= price + 20 && (holders(w, k).length < maxH(w) || s[a.agentId])).sort((x, y) => (s[y.agentId] ? 1 : 0) - (s[x.agentId] ? 1 : 0) || bal(w, y.agentId) - bal(w, x.agentId))[0];
            if (!buyer || !transfer(w, k, id, buyer.agentId, pct, price)) continue;
            M.unpaid[id] = 0; M.sh.st.sold++; const boss = w.agents[id];
            log(w, '📜 {o}週轉不過來，把{s} {p}% 的股份以 {n} 銀幣賣給了{b}，先把工資發出去。', { o: boss.name, s: nm(k), p: pct, n: price, b: buyer.name }, boss.name);
            mem(w, boss, '{s}撐不下去，只好賣了一部分股份給{b}。', { s: nm(k), b: buyer.name }, 7); mem(w, buyer, '我趁{o}缺錢，買了{s} {p}% 的股份。', { o: boss.name, s: nm(k), p: pct }, 6);
            setBoss(w, k, '🔁 {a}的股份比{o}還多，{s}改由{a}當家。');
            note(w, k, '賣股週轉', { a: boss.name, b: buyer.name });
        }
    }

    // ---------- 搬走、過世以外的人事異動(MARKET 每天跑之前) ----------
    function departures(w) {
        const M = S(w);
        for (const k of SEC()) {
            const s = M.shares[k]; if (!s) continue; const gone = Object.keys(s).filter(id => !present(w, id)); if (!gone.length) continue;
            const left = Object.keys(s).filter(id => present(w, id)); if (!left.length) { delete M.shares[k]; continue; }
            for (const id of gone) delete s[id]; M.shares[k] = norm(s);
            if (!present(w, M.owners[k])) { const top = setBoss(w, k); if (top) log(w, '🔁 原本的當家搬走了，{s}由股份最多的{a}接手。', { a: nameOf(w, top), s: nm(k) }, nameOf(w, top)); }
        }
    }

    // MARKET 整家賣掉(週轉不靈)或交給繼承人以後,把錢和股份對齊
    function reconcile(w, before) {
        const M = S(w);
        for (const k of SEC()) {
            const b = before[k]; if (!b) continue; const now = M.owners[k];
            if (!b.s || Object.keys(b.s).length < 2) { if (now !== b.own) delete M.shares[k]; continue; }
            if (now === b.own) continue;
            if (!now) { delete M.shares[k]; continue; }
            if (b.s[now] !== undefined) { M.shares[k] = b.s; continue; } // 股東之間換人當家
            // 整家被賣給外人:賣價全進了舊當家的口袋,照股份分給其他股東
            const price = valueOf(w, k); const old = b.own;
            for (const [id, p] of Object.entries(b.s)) { if (id === old || !present(w, id)) continue; const cut = Math.min(bal(w, old), price * p / 100); if (cut > 0) pay(w, old, id, cut); mem(w, w.agents[id], '{s}整家被賣掉了，我照股份分到 {n} 銀幣。', { s: nm(k), n: Math.round(cut) }, 6); }
            M.shares[k] = { [now]: 100 };
        }
    }

    // ---------- 每週:分紅、做假帳、入股、賣股、拆夥、奪權 ----------
    function weekly(w, all, d) {
        const M = S(w); const X = M.sh;
        for (const k of SEC()) {
            const id = M.owners[k]; if (!id) continue; const boss = w.agents[id]; if (!boss) continue; const s = stakes(w, k); const others = Object.keys(s).filter(h => h !== id && present(w, h));
            const prof = profit7(w, k);
            // 分紅
            if (others.length) {
                const pool = Math.max(0, prof) * 0.6; let reported = pool; let cheat = 0;
                if (pool > 4 && shady(boss) && Math.random() < (X.law.audit ? 0.1 : 0.5)) { /* 帳本公開以後,很少人敢動手腳 */ reported = pool * (0.45 + Math.random() * 0.25); cheat = pool - reported; }
                let paidAll = 0;
                for (const h of others) {
                    const due = reported * (s[h] || 0) / 100; const a = w.agents[h];
                    if (due >= 0.5 && pay(w, id, h, due)) { paidAll += due; X.dry[k + '|' + h] = 0; if (a && due >= 5 && Math.random() < 0.3) mem(w, a, '{s}這週分紅，我拿到 {n} 銀幣。', { s: nm(k), n: Math.round(due) }, 4); }
                    else { X.dry[k + '|' + h] = (X.dry[k + '|' + h] || 0) + 1; if (a && X.dry[k + '|' + h] === 3) mem(w, a, '{s}已經三週沒分紅了，{o}到底在搞什麼？', { s: nm(k), o: boss.name }, 6); }
                }
                X.lastDiv[k] = Math.round(paidAll * 10) / 10; X.st.div = Math.round((X.st.div + paidAll) * 10) / 10;
                if (cheat > 0) {
                    X.st.cheat++; const owed = {}; for (const h of others) owed[h] = Math.round(cheat * (s[h] || 0) / 100 * 10) / 10;
                    X.cheat[k] = { d, owed }; if (Math.random() < 0.4) mem(w, boss, '{s}這週帳上動了點手腳，股東少分了一些。', { s: nm(k) }, 4);
                    // 細心的股東翻帳本
                    const eye = others.map(h => w.agents[h]).filter(a => a && sharp(a)).sort(() => Math.random() - 0.5)[0];
                    if (eye && Math.random() < (X.law.audit ? 0.8 : 0.35)) caught(w, k, boss, eye, owed); else if (X.law.audit && Math.random() < 0.5) { const any = others.map(h => w.agents[h]).find(Boolean); if (any) caught(w, k, boss, any, owed); }
                }
            }
            if (!w.agents[id]) continue;
            // 拆夥:當家和股東翻臉,當家買斷
            for (const h of Object.keys(stakes(w, k)).filter(h => h !== id)) {
                const a = w.agents[h]; if (!a || aff(boss, a) > -30 && aff(a, boss) > -30) continue;
                const price = priceOf(w, k, pctOf(w, k, h)); if (bal(w, id) < price || Math.random() > 0.5) continue;
                const p = pctOf(w, k, h); if (!transfer(w, k, h, id, p, price)) continue; X.st.split++;
                log(w, '💢 {o}和{b}吵到合不來，{o}出 {n} 銀幣買斷了{b}手上{s}的股份，從此各走各的。', { o: boss.name, b: a.name, n: price, s: nm(k) }, boss.name);
                mem(w, boss, '我買斷了{b}的股份，{s}不用再看他臉色。', { b: a.name, s: nm(k) }, 7); mem(w, a, '{o}把我{s}的股份買斷了，拆夥了也好。', { o: boss.name, s: nm(k) }, 7);
                note(w, k, '拆夥', { a: boss.name, b: a.name });
            }
            // 股東會奪權
            oust(w, k, d);
            // 缺錢的股東賣股
            for (const h of Object.keys(stakes(w, k)).filter(h => h !== M.owners[k])) {
                const a = w.agents[h]; if (!a || bal(w, h) >= 8 || !(M.hungry?.[h] >= 1 || bal(w, h) < 3)) continue;
                const p = pctOf(w, k, h); const price = priceOf(w, k, p, 0.9); const cur = M.owners[k];
                const buyer = bal(w, cur) >= price + 10 ? w.agents[cur] : all.filter(o => o.agentId !== h && bal(w, o.agentId) >= price + 20).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
                if (!buyer || !transfer(w, k, h, buyer.agentId, p, price)) continue; X.st.sold++;
                log(w, '🍞 {a}手頭緊到快吃不上飯，把{s} {p}% 的股份以 {n} 銀幣賣給了{b}。', { a: a.name, s: nm(k), p, n: price, b: buyer.name }, a.name);
                mem(w, a, '餓肚子的時候，股份也只能賣了。', {}, 6); setBoss(w, k, '🔁 {a}的股份比{o}還多，{s}改由{a}當家。');
            }
            // 眼紅入股:生意好就有人想分一杯羹
            const s2 = stakes(w, k); const cur = M.owners[k]; const b2 = w.agents[cur];
            if (b2 && prof > 30 && Object.keys(s2).length < maxH(w) && (s2[cur] || 0) >= 40 && Math.random() < 0.35) {
                const pct = 15 + Math.floor(Math.random() * 11); const price = priceOf(w, k, pct, 1.15);
                const amb = w.mind?.amb || {};
                const fan = all.filter(a => !s2[a.agentId] && a.agentId !== cur && bal(w, a.agentId) >= price + 25 && (has(a, 'jealous') || has(a, 'greedy') || amb[a.agentId]?.key === 'rich' || a.job?.key === 'trader' || aff(a, b2) >= 40))
                    .sort((x, y) => (aff(y, b2) - aff(x, b2)) + (bal(w, y.agentId) - bal(w, x.agentId)) * 0.1)[0];
                if (fan) {
                    const yes = bal(w, cur) < 30 || has(b2, 'greedy') ? 0.8 : (has(b2, 'stubborn') || hasV(b2, '傳統')) ? 0.15 : aff(b2, fan) >= 30 ? 0.6 : 0.35;
                    if (Math.random() < yes && transfer(w, k, cur, fan.agentId, Math.min(pct, (s2[cur] || 0) - 30), price)) {
                        X.st.buy++; log(w, '📈 {b}看{s}生意好，出 {n} 銀幣向{o}買了 {p}% 的股份。', { b: fan.name, s: nm(k), n: price, o: b2.name, p: pct }, fan.name);
                        mem(w, fan, '我入股了{s}，以後每週有分紅。', { s: nm(k) }, 7); mem(w, b2, '{b}出高價買了{s}的一部分股份。', { b: fan.name, s: nm(k) }, 5); note(w, k, '入股', { a: fan.name });
                    } else if (Math.random() < 0.5) {
                        log(w, '🙅 {b}想入股{s}，{o}說：「這是我一手做起來的，不賣。」', { b: fan.name, s: nm(k), o: b2.name }, b2.name); bump(fan, b2, -4); mem(w, fan, '{o}不肯讓我入股{s}，小氣。', { o: b2.name, s: nm(k) }, 4);
                    }
                }
            }
        }
        staffBuy(w, all); staffPropose(w, all);
        // 自家工人當了股東,分紅那週心情好一點(罷工也比較少)
        for (const k of SEC()) { const id = M.owners[k]; if (!id || !(X.lastDiv[k] > 0)) continue; for (const a of M_().workersOf(w, k, all)) if (a.agentId !== id && pctOf(w, k, a.agentId) > 0) a.moodModifier = (a.moodModifier || 0) + 2; }
    }
    // 員工認股:通過以後,自家工人可以用存款買一小份股份(當家至少留 35%)
    function staffBuy(w, all) {
        const M = S(w); const X = M.sh; if (!X.law.staff) return;
        for (const k of SEC()) {
            const id = M.owners[k]; const boss = w.agents[id]; if (!boss || Math.random() > 0.4) continue; const s = stakes(w, k);
            if (Object.keys(s).length >= maxH(w) || (s[id] || 0) < 40) continue; const price = priceOf(w, k, 5);
            const wk = M_().workersOf(w, k, all).filter(a => a.agentId !== id && !s[a.agentId] && bal(w, a.agentId) >= price + 30).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
            if (!wk || !transfer(w, k, id, wk.agentId, 5, price)) continue; X.st.staff = (X.st.staff || 0) + 1;
            log(w, '👷 {a}用存了很久的錢，認購了自己上工的{s} 5% 股份。', { a: wk.name, s: nm(k) }, wk.name);
            mem(w, wk, '我現在也是{s}的股東了，做起事來感覺不一樣。', { s: nm(k) }, 7); wk.moodModifier = (wk.moodModifier || 0) + 3;
        }
    }
    function staffPropose(w, all) {
        const M = S(w); const X = M.sh; if (X.law.staff || typeof TECH === 'undefined' || TECH.busy(w, 'sh_staff') || Math.random() > 0.06) return;
        const owned = SEC().filter(k => M.owners[k]); if (owned.length < 2) return;
        const unionOn = !!w.union?.on; const strikes = M.strikes || 0; if (!unionOn && strikes < 1 && Math.random() > 0.3) return;
        const lead = (w.union?.leader && w.agents[w.union.leader]) || all.filter(a => owned.some(k => M_().workersOf(w, k, all).includes(a)) && M.owners[M_().JOB2S[a.job?.key]] !== a.agentId).sort((x, y) => bal(w, y.agentId) - bal(w, x.agentId))[0];
        if (!lead) return;
        TECH.propose(w, 'sh_staff', 'shares', lead, '員工認股', '{who}提議讓在產業做工的人，可以用自己的存款認購上工那家產業的股份：大家都是股東，就不用天天跟當家吵工資。當家們大多不想讓出股份。', {}, 'economy');
    }
    // 提案通過了做什麼、怎麼投
    function enact(w, p) {
        const X = S(w).sh;
        if (p.kind === 'sh_audit') { X.law.audit = day(w); log(w, '📒 「產業帳本公開」通過了：各產業的帳本每季攤開給股東和公庫看。'); return t('產業帳本開始公開'); }
        if (p.kind === 'sh_staff') { X.law.staff = day(w); log(w, '👷 「員工認股」通過了：在產業做工的人可以認購自家產業的股份。'); return t('員工可以認股了'); }
        return '';
    }
    function vote(w, p, a) {
        const M = S(w); const own = SEC().some(k => M.owners[k] === a.agentId); const minor = SEC().some(k => pctOf(w, k, a.agentId) > 0 && M.owners[k] !== a.agentId);
        const k = M_().JOB2S[a.job?.key]; const worker = !!k && !!M.owners[k] && M.owners[k] !== a.agentId; const mem2 = (() => { try { return typeof UNION !== 'undefined' && UNION.isMember(w, a); } catch (e) { return false; } })();
        let s = 0, why = 'gut';
        if (p.kind === 'sh_audit') { s = 0.3 + (minor ? 2 : 0) + (sharp(a) ? 0.8 : 0) + (has(a, 'honest') ? 0.6 : 0) - (own ? 2.2 : 0) - (shady(a) ? 1 : 0); why = s > 0 ? (minor ? 'sh_minor' : 'sh_fair') : (own ? 'boss' : 'sh_hassle'); }
        else if (p.kind === 'sh_staff') { s = 0.2 + (worker ? 1.8 : 0) + (mem2 ? 1 : 0) + (has(a, 'kind') || has(a, 'generous') ? 0.5 : 0) - (own ? 2.5 : 0) - (minor ? 0.6 : 0) - (has(a, 'greedy') ? 0.6 : 0); why = s > 0 ? (worker ? 'sh_worker' : 'sh_fair') : (own ? 'boss' : 'sh_dilute'); }
        s += Math.random() - 0.5; return { v: s > 0 ? 'for' : 'against', why };
    }
    // 抓到做假帳:吵一架;當家看個性決定吐錢還是死不認帳
    function caught(w, k, boss, eye, owed) {
        const M = S(w); const X = M.sh; X.st.caught++; const all = owed[eye.agentId] || 0; const tot = Object.values(owed).reduce((a, b) => a + b, 0);
        bump(eye, boss, -25); bump(boss, eye, -12);
        const angry = X.angry[k] = X.angry[k] || {}; angry[eye.agentId] = day(w);
        log(w, '🧾 {b}翻了{s}的帳本，發現{o}這週少分了股東 {n} 銀幣，當場拍桌。', { b: eye.name, s: nm(k), o: boss.name, n: Math.round(tot) }, eye.name);
        news(w, '🧾 {s}的股東抓到當家{o}做假帳', { s: nm(k), o: boss.name }, 8, [boss.name, eye.name]);
        mem(w, eye, '我抓到{o}在{s}的帳上動手腳，少分了我們的錢。', { o: boss.name, s: nm(k) }, 8);
        const stub = has(boss, 'stubborn') || !!boss.dark?.liar;
        if (!stub && bal(w, boss.agentId) >= tot) {
            for (const [h, n] of Object.entries(owed)) if (n > 0 && present(w, h)) pay(w, boss.agentId, h, n);
            log(w, '😓 {o}紅著臉把少分的錢補了回去，說是「算錯了」。', { o: boss.name }, boss.name); try { WAYS_()?.loseFace?.(w, boss, 10); } catch (e) {}
            mem(w, boss, '做假帳被{b}抓到，只好把錢吐回去，丟臉死了。', { b: eye.name }, 7);
        } else {
            log(w, '😤 {o}死不認帳：「帳本是你自己看錯了。」{b}氣得說要找其他股東討公道。', { o: boss.name, b: eye.name }, boss.name);
            try { WAYS_()?.quarrel?.(w, boss, eye); } catch (e) {}
            for (const h of Object.keys(owed)) if (h !== eye.agentId && present(w, h)) { const o = w.agents[h]; if (o) { bump(o, boss, -10); angry[h] = day(w); mem(w, o, '{b}說{o}在{s}的帳上做手腳。', { b: eye.name, o: boss.name, s: nm(k) }, 6); } }
        }
        delete X.cheat[k];
        // 醜聞之後有人提案:帳本公開
        if (!X.law.audit && Math.random() < 0.6) { try { if (typeof TECH !== 'undefined' && !TECH.busy(w, 'sh_audit')) TECH.propose(w, 'sh_audit', 'shares', eye, '產業帳本公開', '{who}說{o}在{s}的帳上動手腳被抓到，提議以後各產業的帳本每季公開，股東和公庫都能查。當家們恐怕不會高興。', { o: boss.name, s: nm(k) }, 'economy'); } catch (e) {} }
    }
    // 股東會:不滿的股東加起來比當家多,就換人當家
    function oust(w, k, d) {
        const M = S(w); const X = M.sh; const id = M.owners[k]; const boss = w.agents[id]; if (!boss) return;
        const s = stakes(w, k); const angry = X.angry[k] || {};
        const unhappy = Object.keys(s).filter(h => h !== id && present(w, h) && ((angry[h] && d - angry[h] <= 60) || (X.dry[k + '|' + h] || 0) >= 3 || (M.unpaid[id] || 0) >= 2 || aff(w.agents[h], boss) <= -35));
        const sum = unhappy.reduce((x, h) => x + (s[h] || 0), 0); if (!unhappy.length || sum <= (s[id] || 0)) return;
        const next = unhappy.sort((a, b) => (s[b] || 0) - (s[a] || 0))[0]; const nb = w.agents[next]; if (!nb) return;
        M.owners[k] = next; X.st.out++; delete X.angry[k];
        log(w, '🗳️ {s}開股東會，{b}聯合其他股東把{o}拉下來，從今天起由{b}當家。', { s: nm(k), b: nb.name, o: boss.name }, nb.name);
        news(w, '🗳️ {s}股東會變天：{o}被拉下來，換{b}當家', { s: nm(k), o: boss.name, b: nb.name }, 9, [boss.name, nb.name]);
        mem(w, boss, '我在股東會上被{b}他們聯手拉下來了，{s}不再歸我管。', { b: nb.name, s: nm(k) }, 9); mem(w, nb, '我們在股東會上把{o}拉下來，{s}改由我當家。', { o: boss.name, s: nm(k) }, 8);
        try { WAYS_()?.loseFace?.(w, boss, 15); } catch (e) {}
        for (const h of unhappy) { const a = w.agents[h]; if (a) { bump(boss, a, -15); bump(a, nb, 5); } }
        note(w, k, '股東會奪權', { a: nb.name, b: boss.name });
    }

    // ---------- 掛上 MARKET 的每天 ----------
    function daily(w, orig, args) {
        const M = S(w); const d = day(w); const ran = M.lastDay !== d; const all = npcs(w);
        if (ran && w.wallet) { try { departures(w); rescue(w, all); syndicate(w, all, d); } catch (e) { console.warn('[Shares] pre', e); } }
        const before = {}; for (const k of SEC()) before[k] = { own: M.owners[k], s: M.shares[k] ? JSON.parse(JSON.stringify(M.shares[k])) : null };
        const r = orig.apply(M_(), args);
        if (ran && w.wallet) { try { reconcile(w, before); if (d % 7 === 0) weekly(w, all, d); } catch (e) { console.warn('[Shares] post', e); } }
        return r;
    }

    // ---------- 繼承:股東過世 ----------
    function inherit(w, npc, heir0) {
        const M = w.market; if (!M?.shares) return; const X = S(w).sh;
        for (const k of SEC()) {
            const s = M.shares[k]; if (!s || !(npc.agentId in s)) continue; const p = s[npc.agentId]; delete s[npc.agentId];
            const heir = heir0 !== undefined ? (heir0 && present(w, heir0.agentId) ? heir0 : null) : ((M_().heirsOf(w, npc) || []).find(o => present(w, o.agentId)) || null);
            if (heir) { s[heir.agentId] = (s[heir.agentId] || 0) + p; X.st.inh++; if (M.owners[k] !== npc.agentId) { log(w, '📜 {h}繼承了{o}在{s}的 {p}% 股份。', { h: heir.name, o: npc.name, s: nm(k), p }, heir.name); mem(w, heir, '我繼承了{o}在{s}的股份。', { o: npc.name, s: nm(k) }, 7); } }
            const left = Object.keys(s).filter(id => present(w, id)); if (!left.length) { delete M.shares[k]; continue; }
            M.shares[k] = norm(s);
        }
    }

    // ---------- 給 AI 與觀察者 ----------
    function brief(w, a) {
        if (!w.market) return ''; const hs = holdings(w, a.agentId); const out = [];
        for (const [k, p, boss] of hs) {
            const s = stakes(w, k); const others = Object.keys(s).filter(h => h !== a.agentId);
            if (!others.length) continue;
            if (boss) out.push(fill('你是{s}的當家（{p}%），其他股東：{o}。', { s: nm(k), p, o: others.map(h => `${t(nameOf(w, h))} ${s[h]}%`).join(t('、')) }));
            else out.push(fill('你持有{s} {p}% 的股份，當家是{o}，上週分紅一共 {n} 銀幣。', { s: nm(k), p, o: nameOf(w, S(w).owners[k]), n: Math.round(S(w).sh.lastDiv[k] || 0) }));
        }
        return out.join(' ');
    }
    function describe(w, a) {
        const out = []; for (const [k, p, boss] of holdings(w, a.agentId)) { if (holders(w, k).length < 2) continue; out.push(fill(boss ? '{s}當家（{p}%）' : '{s}股東（{p}%）', { s: nm(k), p })); }
        return out.join(t('、'));
    }
    function row(w, k) { const s = stakes(w, k); const ks = Object.keys(s); if (ks.length < 2) return ''; return ks.sort((a, b) => s[b] - s[a]).map(h => `${t(nameOf(w, h))} ${s[h]}%`).join(t('・')); }
    function view(w) { const X = S(w).sh; return { st: X.st, hist: X.hist.map(([d, k, txt, p]) => ({ d, k, s: nm(k), txt: t(txt), a: t(p.a || ''), b: t(p.b || '') })), lastDiv: X.lastDiv }; }

    return { S, enact, vote, staffBuy, staffPropose, stakes, holders, holdings, pctOf, norm, transfer, priceOf, valueOf, profit7, syndicate, rescue, departures, reconcile, weekly, caught, oust, daily, inherit, brief, describe, row, view, MAXH };
})();

if (typeof MARKET !== 'undefined') {
    const _d = MARKET.daily;
    MARKET.daily = function (w, ...args) { return SHARES.daily(w, _d, [w, ...args]); };
    const _v = MARKET.view;
    MARKET.view = function (w) { const rows = _v.call(this, w); try { for (const r of rows) r.holders = SHARES.row(w, r.k); } catch (e) {} return rows; };
    const _br = MARKET.brief;
    MARKET.brief = function (w, a) { const b = _br.call(this, w, a); let s = ''; try { s = SHARES.brief(w, a); } catch (e) {} return [b, s].filter(Boolean).join(' '); };
    const _ds = MARKET.describe;
    MARKET.describe = function (w, a) { const b = _ds.call(this, w, a); let s = ''; try { s = SHARES.describe(w, a); } catch (e) {} return [b, s].filter(Boolean).join(t('；')); };
}
// 股東過世:股份由家人繼承(當家的產業由 MARKET 交給繼承人,這裡把其他股東的份對齊)
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let snap = null, heir = null; try { if (world.market?.shares && npc && Object.values(world.market.shares).some(s => s && npc.agentId in s)) { snap = JSON.parse(JSON.stringify(world.market.shares)); heir = (MARKET.heirsOf(world, npc) || [])[0] || null; } } catch (e) {} // 繼承人要在過世之前找好(過世後配偶的關係會改掉)
        const r = _kill.call(this, world, npc, ...rest);
        try { if (snap && npc) { world.market.shares = snap; SHARES.inherit(world, npc, heir); for (const k of Object.keys(MARKET.SECTORS)) { const s = world.market.shares[k]; if (s && Object.keys(s).length && (!world.market.owners[k] || !(world.market.owners[k] in s))) { const top = Object.keys(s).sort((a, b) => s[b] - s[a])[0]; if (top) world.market.owners[k] = top; } } } } catch (e) { console.warn('[Shares] inherit', e); }
        return r;
    };
}
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { sh_audit: { icon: '📒', label: '產業帳本公開' }, sh_staff: { icon: '👷', label: '員工認股' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { sh_minor: '自己是小股東，怕被當家坑', sh_fair: '覺得這樣比較公平', sh_hassle: '覺得太麻煩', sh_worker: '自己也想當股東', sh_dilute: '股份會被稀釋' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'sh_audit' || p.kind === 'sh_staff') { const r = SHARES.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof globalThis !== 'undefined') globalThis.SHARES = SHARES;
