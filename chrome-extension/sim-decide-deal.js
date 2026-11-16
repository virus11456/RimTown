// v11.0.0 市場與第四權（第一段）：跟買賣有關的決定，全部交給當事人
//   dealRun    老闆每週決定怎麼做生意：照舊／漲價／偷工減料／找同行講好／恢復原樣
//   dealPact   同行來找你一起漲價：答應／拒絕／假裝答應／說出去
//   dealCust   客人發現變貴了：照買／換一家／跟朋友抱怨／號召大家別買／向報社投訴
//   dealJoin   有人號召別去買：跟不跟
//   dealVictim 出了事又起疑的人：算了／換一家／跟親近的人說／找老闆理論／向報社爆料／去告發
//   dealStaff  看得到內情的員工：裝不知道／跟朋友講／匿名爆料／告發／要封口費／辭職
//   dealFaced  被人找上門的老闆：賠錢／不認／認錯改過／（對員工）開除
// 這一組用自己的每日 AI 額度（aiGroup: 'deal'）。必須在 sim-decide.js 與 sim-deal.js 之後載入。
'use strict';
const DEALASK = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined') return null;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1, G = 'deal';
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w); } catch (e) { return false; } };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const pct = (x) => Math.round(x * 100);
    const friends = (w, a, min = 30) => Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= min).map(r => w.agents[r.targetId]).filter(o => o && !o.isDead && !o.isPlayer).sort((x, y) => aff(a, y) - aff(a, x));
    // 鎮上有沒有會登新聞的報社（公告欄與官報不算）：沒有的話，就沒有「向報社說」這條路
    const hasPaper = (w) => (w.press?.papers || []).some(P => !P.banned && P.st !== 'board' && P.st !== 'crown');
    const sn = (key) => DEAL.sname(key);
    const gname = (key) => DEAL.GNAME[DEAL.GOOD[DEAL.kOf(key)]];
    // 一件事用一句話講
    const factText = (w, f) => { const o = w.agents[f.by]?.name || ''; return f.kind === 'hike' ? { k: '{o}把{s}的價錢漲了 {p}%', p: { o, s: sn(f.key), p: pct(f.lv) } } : f.kind === 'cut' ? { k: '{o}的{s}偷工減料', p: { o, s: sn(f.key) } } : { k: '{o}找{b}講好兩家一起漲價', p: { o, b: w.agents[f.with]?.name || '', s: sn(f.key) } }; };

    // ---------- 做了之後發生什麼 ----------
    // 跟朋友講：朋友知道這件事，對老闆的印象變差
    function tell(w, a, f, n = 2) {
        const o = w.agents[f.by]; let told = 0;
        for (const fr of friends(w, a).filter(x => x.agentId !== f.by).slice(0, n)) {
            if (!f.open && !DEAL.learn(w, f, fr, 'told')) continue; told++;
            mem(w, fr, '{a}跟我說：{x}。', { a: a.name, x: factText(w, f) }, 5); if (o) rel(fr, o)?.modifyAffinity?.(f.kind === 'hike' ? -3 : -6);
        }
        return told;
    }
    const S = (w) => { const D = DEAL.S(w); D.tips = D.tips || []; D.reports = D.reports || []; D.boy = D.boy || {}; D.hush = D.hush || {}; return D; };
    // 向報社投訴／爆料：進線索箱（記者之後自己決定查不查）
    function tip(w, a, f, anon) { const D = S(w); if (D.tips.some(x => x.fid === f.id && x.by === a.agentId)) return null; const x = { id: 'T' + (D.tips.length + 1) + '_' + day(w), fid: f.id, by: a.agentId, anon: !!anon, d: day(w), about: f.by, key: f.key, kind: f.kind }; D.tips.push(x); if (D.tips.length > 60) D.tips.shift(); f.tipped = (f.tipped || 0) + 1; mem(w, a, anon ? '我匿名向報社說了{s}的事。' : '我向報社說了{s}的事。', { s: sn(f.key) }, 6); return x; }
    // 去告發：進申訴名單（管這件事的官員或首長之後自己決定辦不辦）
    function report(w, a, f) { const D = S(w); if (D.reports.some(x => x.fid === f.id && x.by === a.agentId)) return null; const x = { fid: f.id, by: a.agentId, d: day(w), about: f.by, key: f.key, kind: f.kind, st: 'new' }; D.reports.push(x); if (D.reports.length > 60) D.reports.shift(); mem(w, a, '我去告發了{s}的事，看上面的人管不管。', { s: sn(f.key) }, 6); return x; }
    // 號召大家別去買
    function boycott(w, lead, key) {
        const D = S(w), d = day(w); const k = DEAL.kOf(key); const o = DEAL.owner(w, key); if (!o || (D.boy[key] && D.boy[key].until >= d)) return null;
        const alt = DEAL.other(w, key); const to = alt ? (DEAL.isRiv(alt) ? 'r' : 'i') : 'none';
        D.boy[key] = { lead: lead.agentId, d, until: d + 14, n: 1, to }; DEAL.setPref(w, lead, k, to, 'boycott');
        log(w, '✊ {a}號召大家別再去{o}的{s}買東西。', { a: lead.name, o: o.name, s: sn(key) }, lead.name);
        const st = DEAL.F(w, key); const cand = npcs(w).filter(x => x !== lead && x !== o && (x.age ?? 30) >= 16 && (aff(x, lead) >= 20 || aff(x, o) <= -10 || D.seen[x.agentId + '|' + key] === st.v)).sort((x, y) => aff(y, lead) - aff(x, lead)).slice(0, 10);
        for (const x of cand) DECIDE.enqueue(w, x, 'dealJoin', { key, lead: lead.agentId });
        return D.boy[key];
    }
    function join(w, a, key) { const D = S(w); const B = D.boy[key]; if (!B || B.until < day(w)) return false; DEAL.setPref(w, a, DEAL.kOf(key), B.to, 'boycott'); B.n++; const o = DEAL.owner(w, key); if (o) rel(a, o)?.modifyAffinity?.(-3); return true; }
    const boycotters = (w, key) => { const D = S(w); const B = D.boy?.[key]; return B && B.until >= day(w) ? B.n : 0; };
    // 改去另一家
    function switchTo(w, a, key) { const alt = DEAL.other(w, key); if (!alt) return false; DEAL.setPref(w, a, DEAL.kOf(key), DEAL.isRiv(alt) ? 'r' : 'i', 'switch'); return true; }
    // 找老闆理論／要封口費：輪到老闆決定
    function face(w, a, f, type) { const o = w.agents[f.by]; if (!o || o.isDead) return false; const n = type === 'hush' ? clampN(Math.round(cash(w, o) * 0.08), 8, 40) : clampN(Math.round(cash(w, o) * 0.05), 5, 25); DECIDE.enqueue(w, o, 'dealFaced', { fid: f.id, by: a.agentId, type, n }); return true; }
    function quit(w, a, f) { const o = w.agents[f.by]; a.job = null; try { if (typeof LABOR !== 'undefined') LABOR.S(w).jobless[a.agentId] = day(w); } catch (e) {} if (o) rel(a, o)?.modifyAffinity?.(-10); log(w, '🚪 {a}辭掉了{s}的工作。', { a: a.name, s: sn(f.key) }, a.name); return true; }
    const angry = (w, a, f) => { const D = S(w); (D.angry || (D.angry = {}))[a.agentId + '|' + f.id] = day(w); };
    const isAngry = (w, a, f) => !!S(w).angry?.[a.agentId + '|' + f.id];

    // ---------- 誰該被問 ----------
    function ask(w, D, a, kind, ctx, tag, gap = 14) { const d = day(w); if (!a || a.isDead || (D.asked[tag] != null && d - D.asked[tag] < gap)) return false; D.asked[tag] = d; DECIDE.enqueue(w, a, kind, ctx); return true; }
    function daily(w, D, d) {
        if (!on(w)) return; S(w);
        // 剛知道內情的人
        for (const [fid, id] of (D.newKnow || [])) { const f = DEAL.factOf(w, fid); const a = w.agents[id]; if (!f || f.end != null || !a) continue; const how = f.knows[id]; ask(w, D, a, how === 'staff' ? 'dealStaff' : 'dealVictim', { fid }, id + '|' + fid); }
        for (const f of D.facts) {
            if (f.end != null) continue; const key = f.key; const st = DEAL.F(w, key);
            // 發現變貴的客人：每家店每天最多問三位，手頭緊的先問
            if (f.kind === 'hike') { let n = 0; const seen = npcs(w).filter(a => D.seen[a.agentId + '|' + key] === st.v && a.agentId !== f.by && (a.age ?? 30) >= 16).sort((x, y) => cash(w, x) - cash(w, y)); for (const a of seen) { if (n >= 3) break; if (ask(w, D, a, 'dealCust', { key, fid: f.id }, 'c|' + a.agentId + '|' + key + '|' + st.v, 60)) n++; } }
            // 知道內情很久的員工、受害人，隔一陣子再想一次
            if (f.kind === 'cut' && d % 7 === (f.d % 7)) { const ks = DEAL.knowers(w, f); const a = ks[Math.floor(Math.random() * ks.length)]; if (a) ask(w, D, a, f.knows[a.agentId] === 'staff' ? 'dealStaff' : 'dealVictim', { fid: f.id }, a.agentId + '|' + f.id, 21); }
        }
        for (const [key, B] of Object.entries(D.boy || {})) if (B.until < d) { const o = DEAL.owner(w, key); if (o && B.n >= 3) log(w, '✊ 抵制{o}的{s}告一段落，前後有 {n} 人不去買。', { o: o.name, s: sn(key), n: B.n }, o.name); delete D.boy[key]; }
        if (D.angry) for (const k of Object.keys(D.angry)) if (d - D.angry[k] > 60) delete D.angry[k];
    }

    // ================= 老闆每週怎麼做生意 =================
    const P_UP = { 0.1: 0.16, 0.2: 0.08, 0.3: 0.03, 0.5: 0.01 }, P_CUT = { 1: 0.06, 2: 0.02 }; // 一週裡大約有幾成機會選這一項（個性與處境會再調）
    function runInfo(w, a) {
        if (!on(w)) return null; const keys = DEAL.firmsOf(w, a.agentId); if (!keys.length) return null; const d = day(w); const key = keys[d % keys.length]; const k = DEAL.kOf(key);
        const st = DEAL.F(w, key); const alt = DEAL.other(w, key); const M = MARKET.S(w); const R = MARKET.rivalOf(w, k); const hist = (DEAL.isRiv(key) ? R?.hist : M.hist?.[k]) || [];
        const rev = Math.round(hist.reduce((s, x) => s + (x[0] || 0), 0)), cost = Math.round(hist.reduce((s, x) => s + (x[1] || 0), 0));
        const idx = (typeof PRICES !== 'undefined' && w.prices) ? PRICES.idx(w, { kitchen: 'food', textile: 'cloth', timber: 'fuel' }[k]) : 1;
        const fc = DEAL.liveFact(w, key, 'cut'); const pf = st.pact ? DEAL.factOf(w, st.pact) : null;
        return { key, k, st, alt, altSt: alt ? DEAL.F(w, alt) : null, altOwner: alt ? DEAL.owner(w, alt) : null, rev, cost, cash: Math.floor(cash(w, a)), short: idx >= 1.3, harm: fc?.harm || 0, dead: fc?.dead || 0, boy: boycotters(w, key), pact: pf && pf.end == null ? pf : null, days: st.cut ? d - st.cutD : 0 };
    }
    DECIDE.kind('dealRun', {
        title: '這禮拜怎麼做生意', cool: 7, pri: 1.2, aiGroup: G,
        when(w, a) { const I = runInfo(w, a); return I ? { key: I.key } : null; },
        facts(w, a) {
            const I = runInfo(w, a); if (!I) return ''; const g = gname(I.key);
            return fill('你是{s}的東家，賣{g}給鎮上的人。這七天收進 {rev} 銀幣、付出工資 {cost}，你手上有 {c} 銀幣。{riv}{now}{short}{harm}{boy}{pact}', { s: sn(I.key), g, rev: I.rev, cost: I.cost, c: I.cash,
                riv: I.alt ? { k: '對面是{o}的店，他現在{x}。', p: { o: I.altOwner?.name || '', x: I.altSt.up ? { k: '比原價貴 {p}%', p: { p: pct(I.altSt.up) } } : '照原價賣' } } : '鎮上只有你這一家，客人沒有別處可去。',
                now: I.st.cut ? { k: '你現在{u}，而且偷工減料已經 {n} 天。', p: { u: I.st.up ? { k: '比原價貴 {p}%', p: { p: pct(I.st.up) } } : '照原價賣', n: I.days } } : I.st.up ? { k: '你現在比原價貴 {p}%，料用足。', p: { p: pct(I.st.up) } } : '你現在照原價賣，料也用足。',
                short: I.short ? { k: '最近{g}缺貨，大家搶著買。', p: { g } } : { raw: '' },
                harm: I.harm ? { k: '已經有 {n} 個客人用了你的東西出事{d}。', p: { n: I.harm, d: I.dead ? { k: '，其中 {m} 人死了', p: { m: I.dead } } : { raw: '' } } } : { raw: '' },
                boy: I.boy ? { k: '有人號召別來你這裡買，現在有 {n} 人不來了。', p: { n: I.boy } } : { raw: '' },
                pact: I.pact ? { k: '你跟{o}講好了兩家一起漲。', p: { o: I.altOwner?.name || '' } } : { raw: '' } });
        },
        options(w, a) {
            const I = runInfo(w, a); if (!I) return []; const { key, st } = I; const greedy = has(a, 'greedy') ? 2 : 1, soft = (has(a, 'kind') || has(a, 'generous')) ? 0.3 : 1, hon = honesty(a);
            const out = [{ id: 'keep', quiet: true, mute: true, text: '照現在這樣做', say: '生意照舊', why: '現在這樣就好', base: REF, lean: { safe: 0.2 }, run: () => null }];
            if (st.up > 0 || st.cut > 0) out.push({ id: 'fair', quiet: true, text: '恢復原價，把料用足', say: { k: '把{s}改回原價、料用足', p: { s: sn(key) } }, why: '這樣賺的錢拿得不安穩',
                base: REF + tilt(clampN(0.12 + (soft < 1 ? 0.2 : 0) + (I.harm ? 0.2 : 0) + (I.dead ? 0.3 : 0) + Math.min(0.3, I.boy * 0.05), 0.02, 0.9)), lean: { bond: 0.3, safe: 0.3, gain: -0.3 },
                run: (w2) => { const p = st.pact ? DEAL.factOf(w2, st.pact) : null; if (p) DEAL.endPact(w2, p, 'quit'); DEAL.setCut(w2, key, 0); DEAL.setUp(w2, key, 0); return { k: '改回原本的做法' }; } });
            for (const u of DEAL.UPS) { if (u <= st.up + 1e-9) continue;
                out.push({ id: 'up:' + u, text: { k: '把價錢漲到比原價貴 {p}%', p: { p: pct(u) } }, say: { k: '把{s}的價錢漲了 {p}%', p: { s: sn(key), p: pct(u) } }, why: '東西是我的，能賣多少就賣多少',
                    base: REF + tilt(clampN(P_UP[u] * greedy * soft * (I.alt ? 1 : 1.6) * (I.short ? 1.5 : 1) * (I.cash < 30 ? 1.5 : 1) * (I.boy ? 0.4 : 1), 0.004, 0.6)), lean: { gain: 0.5, bond: -0.4, face: -0.2 },
                    run: (w2) => { DEAL.setUp(w2, key, u); return { k: '價錢漲了 {p}%', p: { p: pct(u) } }; } }); }
            for (const lv of [1, 2]) { if (lv <= st.cut) continue;
                out.push({ id: 'cut:' + lv, quiet: true, mute: true, text: lv === 1 ? '料用少一點、換便宜的貨（客人可能出事）' : '能省就省，壞掉的也照賣（客人可能出人命）', say: '在貨上動了手腳', why: '省下來的都是賺的',
                    base: REF + tilt(clampN(P_CUT[lv] * greedy * soft * (hon >= 4 ? 0.2 : hon <= 1.5 ? 2 : 1) * (I.cash < 30 ? 2 : 1) * (I.dead ? 0.2 : 1), 0.004, 0.5)), lean: { gain: 0.5, safe: -0.4, bond: -0.3 },
                    run: (w2) => { DEAL.setCut(w2, key, lv); return { k: '開始偷工減料' }; } }); }
            if (I.alt && I.altOwner && !I.pact && I.st.up < DEAL.PACT_UP) out.push({ id: 'pact', quiet: true, mute: true, text: { k: '私下找{o}講好，兩家一起漲 {p}%', p: { o: I.altOwner.name, p: pct(DEAL.PACT_UP) } }, say: { k: '私下去找了{o}', p: { o: I.altOwner.name } }, why: '兩家別再互相殺價，大家都好過',
                base: REF + tilt(clampN(0.06 * (greedy > 1 ? 1.5 : 1) * (has(a, 'charismatic') ? 1.3 : 1) * (aff(a, I.altOwner) < -20 ? 0.3 : 1) * soft, 0.004, 0.5)), lean: { gain: 0.4, safe: -0.3 },
                run: (w2, a2) => { DECIDE.enqueue(w2, I.altOwner, 'dealPact', { key, by: a2.agentId }); return { k: '去找{o}談了', p: { o: I.altOwner.name } }; } });
            return out;
        },
    });

    // ================= 同行來找你一起漲價 =================
    DECIDE.kind('dealPact', {
        title: '同行找你一起漲價', scan: false, pri: 1.5, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = w.agents[c.by]; return fill('{o}私下來找你：兩家別再互相殺價，一起把{g}漲 {p}%，客人反正沒有第三家可去。這種事傳出去會很難看。', { o: o?.name || '', g: gname(c.key), p: pct(DEAL.PACT_UP) }); },
        options(w, a, c) {
            const o = w.agents[c.by]; if (!o || o.isDead || !DEAL.other(w, c.key) || DEAL.ownerId(w, DEAL.other(w, c.key)) !== a.agentId) return []; const hon = honesty(a), g = has(a, 'greedy') ? 1.5 : 1;
            return [
                { id: 'no', quiet: true, text: '不答應', say: { k: '沒有答應{o}', p: { o: o.name } }, why: '生意各做各的', base: REF, lean: { safe: 0.2 }, run: () => { rel(o, a)?.modifyAffinity?.(-4); return null; } },
                { id: 'yes', quiet: true, mute: true, text: '答應，兩家一起漲', say: { k: '跟{o}談妥了', p: { o: o.name } }, why: '有錢大家賺', base: REF + tilt(clampN(0.4 * g * (aff(a, o) < -20 ? 0.4 : 1) * (has(a, 'kind') ? 0.5 : 1) * (hon >= 4 ? 0.5 : 1), 0.02, 0.9)), lean: { gain: 0.5, safe: -0.2 },
                    run: (w2) => { DEAL.pact(w2, c.key, false); rel(o, a)?.modifyAffinity?.(4); return { k: '兩家講好一起漲' }; } },
                { id: 'fake', quiet: true, mute: true, text: '嘴上答應，自己照原價賣，把他的客人搶過來', say: { k: '跟{o}談妥了', p: { o: o.name } }, why: '他漲我不漲，客人自然往我這邊來', base: REF + tilt(clampN(0.12 * (hon <= 1.5 ? 2 : 1) * (aff(a, o) < 0 ? 1.6 : 1) * (hon >= 4 ? 0.3 : 1), 0.01, 0.6)), lean: { gain: 0.4, bond: -0.4 },
                    run: (w2) => { DEAL.pact(w2, c.key, true); return { k: '假裝答應' }; } },
                { id: 'tell', quiet: true, text: '不答應，還把這件事說出去', say: { k: '把{o}來談的事說了出去', p: { o: o.name } }, why: '這種事不該瞞著大家', base: REF + tilt(clampN(0.06 * (hon >= 4 ? 2.5 : 1) * (aff(a, o) < -20 ? 2 : 1), 0.01, 0.6)), lean: { face: 0.3, bond: -0.2 },
                    run: (w2, a2) => { const f = DEAL.fact(w2, { kind: 'pact', key: c.key, k: DEAL.kOf(c.key), by: o.agentId, with: a2.agentId, lv: DEAL.PACT_UP, attempt: true, end: day(w2) }); DEAL.learn(w2, f, a2, 'party'); tell(w2, a2, f, 3); tip(w2, a2, f, false); rel(o, a2)?.modifyAffinity?.(-12); return { k: '把事情說出去了' }; } },
            ];
        },
    });

    // ================= 客人發現變貴了 =================
    DECIDE.kind('dealCust', {
        title: '常買的東西變貴了', scan: false, pri: 0.8, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const st = DEAL.F(w, c.key); const o = DEAL.owner(w, c.key); const alt = DEAL.other(w, c.key); const as = alt ? DEAL.F(w, alt) : null;
            return fill('{s}的{g}比原本貴了 {p}%，是東家{o}自己漲的。{alt}你身上有 {c} 銀幣。', { s: sn(c.key), g: gname(c.key), p: pct(st.up), o: o?.name || '', c: Math.floor(cash(w, a)),
                alt: alt ? { k: '對面{o}的店{x}。', p: { o: DEAL.owner(w, alt)?.name || '', x: as.up ? { k: '也比原價貴 {p}%', p: { p: pct(as.up) } } : '照原價賣' } } : '鎮上賣這個的只有這一家。' }); },
        options(w, a, c) {
            const st = DEAL.F(w, c.key); const o = DEAL.owner(w, c.key); const f = DEAL.factOf(w, c.fid); if (!o || !f || f.end != null || st.up <= 0) return []; const alt = DEAL.other(w, c.key); const cheaper = alt && DEAL.F(w, alt).up < st.up; const poor = cash(w, a) < 30;
            const out = [{ id: 'pay', quiet: true, mute: true, text: '照舊去買，貴就貴', say: '東西貴了還是照買', why: '日子總要過', base: REF, lean: { safe: 0.2 }, run: () => null }];
            if (cheaper) out.push({ id: 'switch', quiet: true, text: { k: '以後改去{o}的店買', p: { o: DEAL.owner(w, alt).name } }, say: { k: '改去{o}的店買東西', p: { o: DEAL.owner(w, alt).name } }, why: '同樣的東西，哪裡便宜去哪裡',
                base: REF + tilt(clampN(0.35 + st.up + (poor ? 0.2 : 0) - (aff(a, o) >= 40 ? 0.3 : 0), 0.05, 0.95)), lean: { gain: 0.3 }, run: (w2, a2) => (switchTo(w2, a2, c.key) ? { k: '換了一家買' } : null) });
            out.push({ id: 'gripe', quiet: true, text: '跟朋友抱怨這件事', say: { k: '跟朋友抱怨{s}變貴了', p: { s: sn(c.key) } }, why: '不講出來心裡不痛快', base: REF + tilt(clampN(0.25 * (has(a, 'gossip') ? 1.6 : 1) * (has(a, 'shy') ? 0.5 : 1), 0.02, 0.8)), lean: { bond: 0.2 },
                run: (w2, a2) => { const n = tell(w2, a2, f); return n ? { k: '跟 {n} 個朋友說了', p: { n } } : { k: '沒找到人說' }; } });
            out.push({ id: 'boycott', text: { k: '號召大家別再去{s}買', p: { s: sn(c.key) } }, say: { k: '號召大家別去{s}買東西', p: { s: sn(c.key) } }, why: '沒人買，他就知道不能亂漲',
                base: REF + tilt(clampN(0.04 * (has(a, 'abrasive') || has(a, 'charismatic') ? 1.8 : 1) * (st.up >= 0.3 ? 2.5 : 1) * (poor ? 1.5 : 1) * (has(a, 'shy') ? 0.3 : 1), 0.004, 0.6)), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => (boycott(w2, a2, c.key) ? { k: '開始號召大家別去買' } : { k: '已經有人在號召了' }) });
            if (hasPaper(w)) out.push({ id: 'tip', quiet: true, text: '向報社投訴', say: { k: '向報社投訴{s}亂漲價', p: { s: sn(c.key) } }, why: '讓大家都知道',
                base: REF + tilt(clampN(0.05 * (st.up >= 0.3 ? 2 : 1), 0.004, 0.5)), lean: { face: 0.2 }, run: (w2, a2) => (tip(w2, a2, f, false) ? { k: '向報社說了' } : null) });
            return out;
        },
    });

    // ================= 有人號召別去買 =================
    DECIDE.kind('dealJoin', {
        title: '有人號召別去那家店買', scan: false, pri: 0.7, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = DEAL.owner(w, c.key); const L = w.agents[c.lead]; const alt = DEAL.other(w, c.key); const st = DEAL.F(w, c.key);
            return fill('{l}號召大家別再去{o}的{s}買{g}（{why}）。{alt}', { l: L?.name || '', o: o?.name || '', s: sn(c.key), g: gname(c.key), why: st.up ? { k: '他把價錢漲了 {p}%', p: { p: pct(st.up) } } : '大家對他不滿',
                alt: alt ? { k: '不去那家，可以改去{o}的店。', p: { o: DEAL.owner(w, alt)?.name || '' } } : '鎮上只有這一家，不去買就得自己少吃少用。' }); },
        options(w, a, c) {
            const o = DEAL.owner(w, c.key); const L = w.agents[c.lead]; if (!o || !L) return []; const alt = DEAL.other(w, c.key); const st = DEAL.F(w, c.key);
            return [
                { id: 'no', quiet: true, mute: true, text: '不跟，照舊去買', say: '沒有跟著抵制', why: '我還是得買東西', base: REF, lean: { safe: 0.2 }, run: () => null },
                { id: 'join', quiet: true, text: '跟著不去買', say: { k: '跟著不去{s}買東西', p: { s: sn(c.key) } }, why: '大家一起才有用',
                    base: REF + tilt(clampN(0.3 + aff(a, L) / 200 - aff(a, o) / 150 + st.up * 0.6 - (alt ? 0 : 0.2), 0.02, 0.95)), lean: { bond: 0.3, safe: -0.2 }, run: (w2, a2) => (join(w2, a2, c.key) ? { k: '加入了' } : null) },
            ];
        },
    });

    // ================= 出了事又起疑的人 =================
    DECIDE.kind('dealVictim', {
        title: '懷疑店裡的東西有問題', scan: false, pri: 1.6, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const f = DEAL.factOf(w, c.fid); const o = w.agents[f?.by]; if (!f) return '';
            return fill('你用了{s}的{g}以後出了事，而且聽說不只你一個（前後 {n} 人{d}）。你懷疑是東家{o}在貨上動了手腳，但沒有證據。{deny}', { s: sn(f.key), g: gname(f.key), n: f.harm || 1, o: o?.name || '', d: f.dead ? { k: '，其中 {m} 人死了', p: { m: f.dead } } : { raw: '' }, deny: isAngry(w, a, f) ? '你去找過他，他不認帳。' : { raw: '' } }); },
        options(w, a, c) {
            const f = DEAL.factOf(w, c.fid); const o = w.agents[f?.by]; if (!f || !o || o.isDead) return []; const alt = DEAL.other(w, f.key); const mad = isAngry(w, a, f) ? 2 : 1, dead = f.dead ? 2 : 1, shy = has(a, 'shy') ? 0.4 : 1;
            const out = [{ id: 'swallow', quiet: true, mute: true, text: '算了，自認倒楣', say: '沒有追究', why: '沒有證據，說了也沒用', base: REF, lean: { safe: 0.3 }, run: () => null }];
            if (alt) out.push({ id: 'switch', quiet: true, text: { k: '以後改去{o}的店', p: { o: DEAL.owner(w, alt).name } }, say: { k: '不再去{s}買東西', p: { s: sn(f.key) } }, why: '那家的東西我不敢再碰', base: REF + tilt(0.6), lean: { safe: 0.3 }, run: (w2, a2) => (switchTo(w2, a2, f.key) ? { k: '換了一家買' } : null) });
            out.push({ id: 'tell', quiet: true, text: '跟親近的人說，要他們小心', say: { k: '要親近的人小心{s}的東西', p: { s: sn(f.key) } }, why: '不能讓他們也出事', base: REF + tilt(clampN(0.45 * dead, 0.05, 0.9)), lean: { bond: 0.4 }, run: (w2, a2) => { const n = tell(w2, a2, f, 3); return n ? { k: '跟 {n} 個人說了', p: { n } } : { k: '身邊的人都知道了' }; } });
            if (!isAngry(w, a, f)) out.push({ id: 'confront', text: { k: '去找{o}理論，要他給個交代', p: { o: o.name } }, say: { k: '去找{o}理論', p: { o: o.name } }, why: '錢和身體都賠了，不能就這樣算了', base: REF + tilt(clampN(0.2 * dead * shy * (has(a, 'abrasive') ? 1.6 : 1), 0.02, 0.8)), lean: { face: 0.3, safe: -0.3 }, run: (w2, a2) => (face(w2, a2, f, 'confront') ? { k: '找上門去了' } : null) });
            if (hasPaper(w)) out.push({ id: 'tip', quiet: true, text: '向報社爆料', say: { k: '向報社說了{s}的事', p: { s: sn(f.key) } }, why: '登出來大家才會小心', base: REF + tilt(clampN(0.1 * mad * dead, 0.02, 0.8)), lean: { face: 0.2 }, run: (w2, a2) => (tip(w2, a2, f, false) ? { k: '向報社說了' } : null) });
            out.push({ id: 'report', quiet: true, text: '去告發，要上面的人來查', say: { k: '去告發{s}', p: { s: sn(f.key) } }, why: '該有人來管', base: REF + tilt(clampN(0.08 * mad * dead, 0.02, 0.8)), lean: { face: 0.2, safe: -0.1 }, run: (w2, a2) => (report(w2, a2, f) ? { k: '去告發了' } : null) });
            return out;
        },
    });

    // ================= 看得到內情的員工 =================
    DECIDE.kind('dealStaff', {
        title: '東家在貨上動手腳', scan: false, pri: 1.4, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const f = DEAL.factOf(w, c.fid); const o = w.agents[f?.by]; if (!f) return '';
            return fill(c.ex ? '你以前在{s}做事，被東家{o}開除了。他怎麼做你都看過：{lv}。{harm}{hush}' : '你在{s}做事，東家{o}怎麼做你都看在眼裡：{lv}。{harm}這件事外面沒有人知道。說出去，你可能丟工作。{hush}', { s: sn(f.key), o: o?.name || '', lv: (f.lv || 1) >= 2 ? '壞掉的東西也照賣' : '料用得少、換了便宜貨',
                harm: f.harm ? { k: '已經有 {n} 個客人出事{d}。', p: { n: f.harm, d: f.dead ? { k: '，{m} 人死了', p: { m: f.dead } } : { raw: '' } } } : { raw: '' }, hush: S(w).hush[a.agentId + '|' + f.id] ? '你收過他的封口費。' : { raw: '' } }); },
        options(w, a, c) {
            const f = DEAL.factOf(w, c.fid); const o = w.agents[f?.by]; if (!f || !o || o.isDead || f.end != null) return []; const hon = honesty(a), paid = S(w).hush[a.agentId + '|' + f.id] ? 0.3 : 1, dead = f.dead ? 3 : f.harm ? 1.5 : 1, loyal = aff(a, o) >= 40 ? 0.4 : aff(a, o) <= -20 ? 2 : 1, H = hon >= 4 ? 2.5 : hon <= 1.5 ? 0.4 : 1;
            const out = [{ id: 'quiet', quiet: true, mute: true, text: '裝作不知道', say: '什麼都沒說', why: '我只是領薪水做事的', base: REF + 0.3, lean: { safe: 0.4 }, run: () => null },
                { id: 'tell', quiet: true, text: '私下跟朋友講', say: { k: '私下說了{s}的事', p: { s: sn(f.key) } }, why: '悶在心裡難受', base: REF + tilt(clampN(0.1 * (has(a, 'gossip') ? 2 : 1) * dead * paid, 0.01, 0.8)), lean: { bond: 0.2, safe: -0.2 }, run: (w2, a2) => { const n = tell(w2, a2, f); return n ? { k: '跟 {n} 個朋友說了', p: { n } } : { k: '朋友都知道了' }; } }];
            if (hasPaper(w)) out.push({ id: 'tip', quiet: true, mute: true, text: '匿名向報社爆料', say: '匿名寫了一封信', why: '不能讓更多人出事', base: REF + tilt(clampN(0.05 * H * dead * loyal * paid, 0.005, 0.8)), lean: { face: 0.2, safe: -0.3 }, run: (w2, a2) => (tip(w2, a2, f, true) ? { k: '匿名爆料了' } : null) });
            out.push({ id: 'report', quiet: true, text: '去告發東家', say: { k: '去告發了{o}', p: { o: o.name } }, why: '這是害人的事', base: REF + tilt(clampN(0.025 * H * dead * loyal * paid, 0.004, 0.7)), lean: { face: 0.3, safe: -0.4 }, run: (w2, a2) => (report(w2, a2, f) ? { k: '去告發了' } : null) });
            if (c.ex) return out;
            if (paid === 1) out.push({ id: 'hush', quiet: true, mute: true, text: { k: '跟{o}要封口費', p: { o: o.name } }, say: '跟東家談了一筆錢', why: '他賺黑心錢，分我一點也不為過', base: REF + tilt(clampN(0.04 * (has(a, 'greedy') ? 2.5 : 1) * (hon <= 1.5 ? 2 : hon >= 4 ? 0.2 : 1), 0.004, 0.6)), lean: { gain: 0.5, bond: -0.3 }, run: (w2, a2) => (face(w2, a2, f, 'hush') ? { k: '開口要錢了' } : null) });
            out.push({ id: 'quit', text: '不想再幫他做這種事，辭職', say: { k: '辭掉了{s}的工作', p: { s: sn(f.key) } }, why: '這種錢我賺不下去', base: REF + tilt(clampN(0.02 * H * dead, 0.004, 0.6)), lean: { face: 0.2, gain: -0.5 }, run: (w2, a2) => (quit(w2, a2, f) ? { k: '辭職了' } : null) });
            return out;
        },
    });

    // ================= 被人找上門的老闆 =================
    DECIDE.kind('dealFaced', {
        title: '有人找上門', scan: false, pri: 1.8, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const x = w.agents[c.by]; const f = DEAL.factOf(w, c.fid); if (!f) return '';
            return c.type === 'hush' ? fill('你店裡的{a}說，你在貨上動手腳的事他都知道，要 {n} 銀幣才不說出去。你手上有 {c} 銀幣。', { a: x?.name || '', n: c.n, c: Math.floor(cash(w, a)) })
                : fill('{a}找上門，說用了你{s}的東西出事，要你給個交代。他沒有證據，但出事的不只他一個（{m} 人）。你手上有 {c} 銀幣。', { a: x?.name || '', s: sn(f.key), m: f.harm || 1, c: Math.floor(cash(w, a)) }); },
        options(w, a, c) {
            const x = w.agents[c.by]; const f = DEAL.factOf(w, c.fid); if (!x || x.isDead || !f) return []; const can = cash(w, a) >= c.n, soft = has(a, 'kind') || has(a, 'generous'), hard = has(a, 'abrasive') || has(a, 'greedy');
            const out = [{ id: 'deny', quiet: true, text: c.type === 'hush' ? '不給，叫他少胡說' : '不認帳，說東西沒問題', say: { k: '沒有理會{a}', p: { a: x.name } }, why: '沒有證據，憑什麼要我賠', base: REF + (hard ? 0.4 : 0), lean: { gain: 0.3, bond: -0.3 },
                run: (w2, a2) => { rel(x, a2)?.modifyAffinity?.(-12); angry(w2, x, f); mem(w2, x, '我去找{o}，他不認帳。', { o: a2.name }, 7); DECIDE.enqueue(w2, x, c.type === 'hush' ? 'dealStaff' : 'dealVictim', { fid: f.id }); return { k: '沒有認' }; /* 被拒絕的人再想一次要怎麼辦 */ } }];
            if (can) out.push({ id: 'pay', quiet: true, mute: c.type === 'hush', text: c.type === 'hush' ? { k: '給他 {n} 銀幣，叫他閉嘴', p: { n: c.n } } : { k: '賠他 {n} 銀幣了事', p: { n: c.n } }, say: c.type === 'hush' ? '私下給了一筆錢' : { k: '賠了{a} {n} 銀幣', p: { a: x.name, n: c.n } }, why: '花點錢把事情壓下來',
                base: REF + tilt(clampN((c.type === 'hush' ? 0.55 : 0.35) * (soft ? 1.4 : 1) * (hard ? 0.6 : 1) * (f.dead ? 1.5 : 1), 0.05, 0.95)), lean: { safe: 0.4, gain: -0.3 },
                run: (w2, a2) => { if (!WALLET.pay(w2, a2, x, c.n)) return null; if (c.type === 'hush') S(w2).hush[x.agentId + '|' + f.id] = day(w2); else rel(x, a2)?.modifyAffinity?.(4); mem(w2, x, c.type === 'hush' ? '{o}給了我 {n} 銀幣，要我別說出去。' : '{o}賠了我 {n} 銀幣，但沒有承認東西有問題。', { o: a2.name, n: c.n }, 6); return { k: '付了 {n} 銀幣', p: { n: c.n } }; } });
            if (c.type !== 'hush') out.push({ id: 'fix', text: '認錯，賠錢，把料改回來', say: { k: '向{a}認錯，把{s}的料改回來', p: { a: x.name, s: sn(f.key) } }, why: '再做下去會出大事',
                base: REF + tilt(clampN(0.12 * (soft ? 2.5 : 1) * (hard ? 0.3 : 1) * (f.dead ? 2 : 1), 0.01, 0.9)), lean: { bond: 0.4, safe: 0.3, gain: -0.4 },
                run: (w2, a2) => { const n = Math.min(c.n, Math.floor(cash(w2, a2))); if (n > 0) WALLET.pay(w2, a2, x, n); DEAL.setCut(w2, f.key, 0); rel(x, a2)?.modifyAffinity?.(10); mem(w2, x, '{o}認了錯，賠了我 {n} 銀幣，說以後不會了。', { o: a2.name, n }, 7); return { k: '認錯並把料改回來' }; } });
            else out.push({ id: 'fire', text: '把他開除', say: { k: '把{a}開除了', p: { a: x.name } }, why: '留這種人在店裡是禍害', base: REF + tilt(clampN(0.12 * (hard ? 2 : 1) * (soft ? 0.3 : 1), 0.01, 0.7)), lean: { safe: -0.3, bond: -0.4 },
                run: (w2, a2) => { x.job = null; try { if (typeof LABOR !== 'undefined') LABOR.S(w2).jobless[x.agentId] = day(w2); } catch (e) {} rel(x, a2)?.modifyAffinity?.(-25); angry(w2, x, f); mem(w2, x, '我跟{o}開口，他把我開除了。', { o: a2.name }, 8); log(w2, '🚪 {o}把{a}開除了。', { o: a2.name, a: x.name }, a2.name); DECIDE.enqueue(w2, x, 'dealStaff', { fid: f.id, ex: true }); return { k: '開除了他' }; } });
            return out;
        },
    });

    DECIDE.deal = true;
    return { daily, tell, tip, report, boycott, join, boycotters, switchTo, face, quit, factText, runInfo, S };
})();
if (typeof globalThis !== 'undefined') globalThis.DEALASK = DEALASK;
