// RimTown - sim-aftermath.js：v7.9.0 災後反應（所有災難共用的入口：AFTERMATH.shock）
// 核災、實驗室外洩、疫情恐慌、基因階級衝突、藥價暴漲……任何衝擊都丟進來；之後新的變因（事件卡、天災、世界級災厄）也走同一個入口。
// 衝擊讓人有壓力：受害者和家人最大，跟受害者越親的人越大（v6.88 的 Dunbar 圈層），其他人看到聽到也會怕。
// 有壓力的人每天各自決定怎麼反應——自由發揮，沒有劇本：搶商店、囤貨、逃難、互助、怪罪別人、傳謠言、上街抗議、禱告、自願幫忙、陪家人。
// 群體動力學：
//   情緒與行為沿著人際圈傳染（內圈、好友做了什麼，自己就更可能跟著做）；派系（v6.52 小團體）成員彼此看齊；
//   有魅力、名聲好的人是意見領袖，他做了什麼影響比較大；
//   門檻模型（Granovetter）：搶商店要看身邊已經有多少人在搶——老實人的門檻高、走投無路的人門檻是零，於是一兩個人帶頭就可能一發不可收拾；
//   旁觀者效應：已經有很多人在幫忙時，個人出手的意願下降；
//   抗議人數夠多才會變成廣場上的集會，並把相關的提案提早推上議程（廢核、停止人體實驗、藥價管制）。
// 完整智能體模式：重要人物由 AI 依自己的個性、處境、朋友的行為決定反應並說一句話（每天最多兩人，失敗就用規則版）。
// 金流守恆：搶的是商店老闆錢櫃裡的錢（衛兵抓到就還回去、關幾天）；囤貨付錢給老闆；互助是自己的錢給別人。存在 world.crisis。
'use strict';

const AFTERMATH = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const here = (w) => npcs(w).filter(a => !(w.isAway?.(a.agentId)) && a.currentLocation !== 'exploration' && (a.age ?? 30) >= 14);
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who); } catch (e) {} };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('event', fill(k, p), imp || 7, names || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp || 6, []); } catch (e) {} };
    const aff = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 30);
    const family = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a).filter(f => f !== a) : []; } catch (e) { return []; } };
    const circle = (w, a, b) => { try { return typeof SOCIAL !== 'undefined' ? SOCIAL.circleOf(w, a, b.agentId) : null; } catch (e) { return null; } }; // 0 家人 1 內圈 2 好友 3 朋友 4 點頭之交
    const honesty = (a) => { try { return typeof DARK !== 'undefined' ? DARK.honesty(a) : 3; } catch (e) { return 3; } };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const jailed = (w, a) => !!(w.civic?.jail?.[a?.agentId] > day(w));
    const leader = (w, a) => { if (hasT(a, 'charismatic')) return true; try { return typeof DARK !== 'undefined' && (DARK.reputation(w, a)?.score ?? 0) >= 60; } catch (e) { return false; } };
    const CAUSE = { meltdown: '核災', leak: '輻射外洩', layoff: '機器裁員', smash: '砸機器', watch: 'AI 監控', caste: '基因階級衝突', black_clinic: '黑市改造出事', price_storm: '藥價暴漲', superbug: '抗藥性病菌', lableak: '實驗室外洩', epidemic: '疫情' };
    const R = {
        loot: { icon: '🛒', name: '搶商店' }, hoard: { icon: '🧺', name: '囤貨' }, flee: { icon: '🏃', name: '逃難' }, help: { icon: '🤝', name: '互助' }, blame: { icon: '👉', name: '怪罪' },
        rumor: { icon: '🗣️', name: '傳謠言' }, protest: { icon: '📢', name: '抗議' }, pray: { icon: '🙏', name: '禱告' }, volunteer: { icon: '🩺', name: '自願幫忙' }, comfort: { icon: '🫂', name: '陪家人' },
    };

    function S(w) { if (!w.crisis || typeof w.crisis !== 'object') w.crisis = {}; const C = w.crisis; C.cur = C.cur || []; C.did = C.did || {}; C.stress = C.stress || {}; C.st = C.st || {}; C.hist = C.hist || []; return C; }

    // ---------- 衝擊 ----------
    function shock(w, o) {
        if (!w || !o) return null; const C = S(w); const d = day(w); const sev = Math.max(1, Math.min(3, o.sev || 1));
        const who = (o.who || []).filter(Boolean); const vic = new Set(who.filter(a => w.agents[a.agentId] && !a.isDead).map(a => a.agentId)); // 死去的人不算,但他的家人算
        for (const a of who) for (const f of family(w, a)) if (w.agents[f.agentId] && !f.isDead) vic.add(f.agentId);
        const cr = { id: 'K' + ((C.n = (C.n || 0) + 1)), kind: o.kind || 'event', cause: o.cause || t(CAUSE[o.kind] || '災難'), sev, d, until: d + sev * 3, vic: [...vic], blame: o.blame?.agentId || null, n: {} };
        C.cur = C.cur.filter(x => x.until >= d).concat(cr).slice(-4);
        for (const a of here(w)) {
            let s = vic.has(a.agentId) ? 30 * sev : 6 * sev;
            if (!vic.has(a.agentId)) for (const v of who) { const c = circle(w, a, v); if (c != null && c <= 2) { s += 12 * sev; break; } if (c === 3) s += 4 * sev; }
            if (hasT(a, 'neurotic') || hasT(a, 'pessimist')) s *= 1.3; if (hasT(a, 'stoic')) s *= 0.6;
            C.stress[a.agentId] = Math.min(100, Math.max(C.stress[a.agentId] || 0, s));
        }
        return cr;
    }

    // ---------- 群體:朋友、派系、意見領袖做了什麼 ----------
    function social(w, a, r, d) {
        const C = S(w); let close = 0, did = 0, lead = 0;
        for (const [id, x] of Object.entries(C.did)) {
            if (id === a.agentId || d - x[0] > 3) continue; const b = w.agents[id]; if (!b) continue; const c = circle(w, a, b);
            if (c != null && c <= 2) { close++; if (x[1] === r) { did++; if (leader(w, b)) lead = 1; } }
        }
        let fac = 0; try { const q = typeof DARK !== 'undefined' ? DARK.cliqueOf(w, a.agentId) : null; if (q) { const m = q.members.filter(id => id !== a.agentId); fac = m.length ? m.filter(id => C.did[id] && d - C.did[id][0] <= 3 && C.did[id][1] === r).length / m.length : 0; } } catch (e) {}
        return { share: close ? did / close : 0, fac, lead, n: did };
    }
    // 門檻模型:身邊已經在搶的比例要超過自己的門檻(走投無路的人門檻是零)
    function lootThr(w, a) { const h = honesty(a); const desperate = cash(w, a) < 5 && (w.stockpile?.get?.('food') || 0) < here(w).length * 2; if (desperate) return 0; return h < 2.5 ? 0.05 : h > 3.5 ? 0.6 : 0.3; }

    function scores(w, a, cr, d) {
        const c = cash(w, a), poor = c < 15, rich = c >= 80; const fv = cr.vic.includes(a.agentId); const kids = family(w, a).some(f => (f.age ?? 30) < 14);
        const guards = here(w).filter(x => x.job?.key === 'guard').length; const sev = cr.sev;
        const out = {
            loot: (poor ? 2 : c < 40 ? 0 : -1.5) + (honesty(a) < 2.5 ? 1.5 : honesty(a) > 3.5 ? -2 : 0) + (hasT(a, 'lazy') || hasT(a, 'jealous') || hasT(a, 'abrasive') ? 0.5 : 0) + sev * 0.4 - 1.6 - (guards > 2 ? 0.8 : 0),
            hoard: (rich ? 1.5 : c >= 40 ? 0.9 : -3) + (hasT(a, 'pessimist') || hasT(a, 'neurotic') ? 0.8 : 0) + (hasT(a, 'greedy') || hasT(a, 'glutton') ? 0.8 : 0) + sev * 0.3 - 1.1 + (fv ? 0.3 : 0),
            flee: sev >= 3 ? (rich ? 1.2 : c >= 50 ? 0 : -2) + (kids ? 0.8 : 0) + (hasT(a, 'pessimist') ? 0.5 : 0) - 1.6 : -9,
            help: (hasT(a, 'kind') ? 1.2 : 0) + (hasT(a, 'ascetic') || hasT(a, 'optimist') ? 0.3 : 0) + (c >= 15 ? 0.3 : -2) + (hasV(a, '家庭') ? 0.3 : 0) + (cr.vic.some(id => { const b = w.agents[id]; const q = b && circle(w, a, b); return q != null && q <= 1; }) ? 0.9 : 0) - (hasT(a, 'greedy') ? 1 : 0) - 1.0 - 0.12 * (cr.n.help || 0),
            blame: (hasT(a, 'abrasive') ? 1 : 0) + (hasT(a, 'jealous') ? 0.8 : 0) + (hasT(a, 'pessimist') ? 0.5 : 0) + (fv ? 1 : 0) + (cr.blame ? 0.8 : 0) - 0.7,
            rumor: (hasT(a, 'gossip') ? 1.5 : 0) + (honesty(a) < 2.5 ? 0.5 : 0) + (hasT(a, 'neurotic') ? 0.5 : 0) - 0.8,
            protest: (hasT(a, 'charismatic') ? 0.8 : 0) + (a.techStance === 'progressive' ? 0.4 : 0) + (fv ? 1.2 : 0) + (hasT(a, 'abrasive') ? 0.3 : 0) + (['meltdown', 'lableak', 'price_storm', 'layoff', 'watch'].includes(cr.kind) ? 0.4 : -0.6) - 0.8,
            pray: devout(w, a) ? 1.5 : -2,
            volunteer: (a.job?.key === 'doctor' ? 2 : a.job?.key === 'guard' ? 1 : 0) + (hasT(a, 'kind') ? 0.8 : 0) - 0.6,
            comfort: fv ? 1.5 : -1,
            none: 0.8,
        };
        if (cr.blame === a.agentId) { out.blame = -9; out.protest -= 3; out.comfort += 0.5; out.flee += 0.6; } // 被大家怪罪的人:不會帶頭抗議,反而想躲
        out.blame -= 0.35 * (cr.n.blame || 0); out.rumor -= 0.25 * (cr.n.rumor || 0); // 同一件事講到大家都聽過了,再講的人就少了
        for (const r of Object.keys(R)) { const s = social(w, a, r, d); out[r] += (r === 'blame' || r === 'rumor' ? 1.2 : 2) * s.share + 1 * s.fac + 0.8 * s.lead; if (r === 'volunteer') out[r] -= 0.15 * (cr.n.volunteer || 0); /* 旁觀者效應 */ if (r === 'loot' && s.share < lootThr(w, a) && !(cr.n.loot || 0) && lootThr(w, a) > 0) out[r] -= 3; else if (r === 'loot' && s.share < lootThr(w, a)) out[r] -= 1.5; }
        return out;
    }
    function decide(w, a, cr, d) { const sc = scores(w, a, cr, d); let best = 'none', bs = -99; for (const [r, v] of Object.entries(sc)) { const x = v + (Math.random() - 0.5) * 1.2; if (x > bs) { bs = x; best = r; } } return best; }

    // ---------- 做出反應 ----------
    function act(w, a, r, cr, line) {
        const C = S(w); const d = day(w); if (!R[r]) return false; const ad = here(w);
        const say = line ? `${t('「')}${line}${t('」')}` : '';
        const pickV = () => cr.vic.map(id => w.agents[id]).filter(b => b && b !== a && !b.isDead);
        let done = true;
        if (r === 'loot') {
            let shop = ad.filter(x => x !== a && owner(w, x) && cash(w, x) >= 20 && !family(w, a).includes(x)).sort(() => Math.random() - 0.5)[0]; const fam = family(w, a);
            if (!shop) { // 沒有私人商店:先搶公有糧倉,糧倉也空了就闖有錢人家
                const food = w.stockpile?.get?.('food') || 0;
                if (food >= 10) { const n = Math.min(12, Math.round(food * 0.08)); w.stockpile.consume('food', n, w.tickCount, t('糧倉被搶'), 'event'); a.moodModifier = (a.moodModifier || 0) + 2; mem(w, a, '{c}那時候大家都慌了，我也跟著去糧倉扛了一袋糧食。', { c: cr.cause }, 7);
                    const guards = ad.filter(x => x.job?.key === 'guard').length; if (Math.random() < Math.min(0.6, (0.15 + guards * 0.2) * 0.6) && w.civic) { (w.civic.jail || (w.civic.jail = {}))[a.agentId] = d + 2; log(w, '🛒 {c}的混亂中，{a}衝進公有糧倉扛走糧食，被衛兵當場抓住。{say}', { c: cr.cause, a: a.name, say }, a.name); }
                    else if ((cr.n.loot || 0) < 2) log(w, '🛒 {c}的混亂中，有人衝進公有糧倉，扛走了 {n} 份糧食。{say}', { c: cr.cause, n, say });
                    cr.n.loot = (cr.n.loot || 0) + 1; S(w).st.loot = (S(w).st.loot || 0) + 1; S(w).did[a.agentId] = [d, 'loot', cr.id]; return true; }
                shop = ad.filter(x => x !== a && cash(w, x) >= 40 && !fam.includes(x)).sort((x, y) => cash(w, y) - cash(w, x))[0];
            }
            if (!shop || typeof WALLET === 'undefined') return false;
            const n = Math.min(25, Math.max(4, Math.floor(cash(w, shop) * 0.2))); if (!WALLET.take(w, shop, n)) return false; WALLET.add(w, a, n);
            const guards = ad.filter(x => x.job?.key === 'guard').length; const caught = Math.random() < Math.min(0.7, (0.15 + guards * 0.2) * 0.6); // 一片混亂,衛兵顧不過來
            if (caught) { const back = Math.min(n, cash(w, a)); if (back > 0 && WALLET.take(w, a, back)) WALLET.add(w, shop, back); if (w.civic) { (w.civic.jail || (w.civic.jail = {}))[a.agentId] = d + 3; } aff(shop, a, -25); try { DARK.bump(w, a, 'exposed'); } catch (e) {}
                log(w, '🛒 {c}的混亂中，{a}衝進{s}的店裡搶錢，當場被衛兵抓住，關進牢裡。{say}', { c: cr.cause, a: a.name, s: shop.name, say }, a.name); mem(w, a, '{c}那時候我昏了頭，去搶了{s}的店，被抓了。', { c: cr.cause, s: shop.name }, 8); }
            else { aff(shop, a, -5); mem(w, shop, '{c}那幾天，店裡的錢櫃被搶了 {n} 銀幣。', { c: cr.cause, n }, 8); mem(w, a, '{c}那時候大家都在搶，我也拿了{s}店裡的 {n} 銀幣。', { c: cr.cause, s: shop.name, n }, 8);
                try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: shop.agentId, k: '{a}趁{c}搶了{s}店裡的 {n} 銀幣', p: { a: a.name, c: cr.cause, s: shop.name, n } }); } catch (e) {}
                if ((cr.n.loot || 0) < 2) log(w, '🛒 {c}的混亂中，{s}的店被搶了，錢櫃裡少了 {n} 銀幣。🕵️', { c: cr.cause, s: shop.name, n }, shop.name); }
        } else if (r === 'hoard') {
            const shop = ad.filter(x => x !== a && owner(w, x)).sort(() => Math.random() - 0.5)[0]; const n = Math.min(12, Math.max(4, Math.round(cash(w, a) * 0.1)));
            if (!shop || typeof WALLET === 'undefined' || !WALLET.pay(w, a, shop, n, t('囤貨'))) return false;
            for (const x of ad) if (x !== a && cash(w, x) < 15) { const q = circle(w, x, a); if (q != null && q <= 3) aff(x, a, -3); }
            mem(w, a, '{c}讓我很不安，我花了 {n} 銀幣把糧食和藥都囤起來。', { c: cr.cause, n }, 6);
            if ((cr.n.hoard || 0) < 1) log(w, '🧺 {a}跑去{s}的店裡大買特買，把糧食和藥都囤回家。旁人看了直搖頭。{say}', { a: a.name, s: shop.name, say }, a.name);
        } else if (r === 'flee') {
            if ((cr.n.flee || 0) >= Math.max(1, Math.round(ad.length * 0.08))) return false;
            try { if (!w.leaveTown?.(a.agentId, fill('{c}之後不敢住了', { c: cr.cause }))) return false; } catch (e) { return false; }
            log(w, '🏃 {a}收拾細軟，帶著家人連夜離開了小鎮。{say}', { a: a.name, say }, a.name);
        } else if (r === 'help') {
            const v = pickV().sort((x, y) => cash(w, x) - cash(w, y))[0] || ad.filter(x => x !== a && cash(w, x) < 10)[0]; if (!v || typeof WALLET === 'undefined') return false;
            const n = Math.min(10, Math.max(3, Math.round(cash(w, a) * 0.1))); if (!WALLET.pay(w, a, v, n, t('互助'))) return false;
            aff(v, a, 12); aff(a, v, 5); mem(w, v, '{c}之後，{a}送了 {n} 銀幣和一籃吃的過來，我會記得。', { c: cr.cause, a: a.name, n }, 8); mem(w, a, '{c}之後，我拿了點錢和吃的去給{v}。', { c: cr.cause, v: v.name }, 6);
            log(w, '🤝 {a}提著一籃吃的、塞了 {n} 銀幣給{v}。{say}', { a: a.name, v: v.name, n, say }, a.name);
        } else if (r === 'blame') {
            const tgt = (cr.blame && w.agents[cr.blame] && cr.blame !== a.agentId ? w.agents[cr.blame] : null) || ad.filter(x => x !== a && !cr.vic.includes(x.agentId) && (owner(w, x) || x.job?.key === 'researcher' || x.job?.key === 'mayor')).sort((x, y) => ((a.relationships?.relationships?.[x.agentId]?.affinity || 0) - (a.relationships?.relationships?.[y.agentId]?.affinity || 0)))[0]; if (!tgt) return false;
            aff(a, tgt, -10); for (const x of ad) { if (x === a || x === tgt) continue; const q = circle(w, x, a); if (q != null && q <= 2) aff(x, tgt, -3); }
            mem(w, tgt, '大家都在說{c}是我害的。', { c: cr.cause }, 7); mem(w, a, '{c}這件事，{b}脫不了關係。', { c: cr.cause, b: tgt.name }, 6);
            const nb = (cr.n.blame || 0) + 1; cr.bt = cr.bt || {}; cr.bt[tgt.agentId] = (cr.bt[tgt.agentId] || 0) + 1;
            if (nb <= 2 || say) log(w, '👉 {a}到處跟人說：{c}都是{b}害的。{say}', { a: a.name, b: tgt.name, c: cr.cause, say }, a.name);
            else if (cr.bt[tgt.agentId] === 5) log(w, '👉 話越傳越難聽，鎮上已經有好幾個人都說{c}是{b}害的，{b}出門都抬不起頭。', { b: tgt.name, c: cr.cause }, tgt.name);
        } else if (r === 'rumor') {
            const RUM = ['聽說{c}是有人故意的', '聽說鎮長早就知道了，還瞞著大家', '聽說喝井水也會出事', '聽說外地人帶了更糟的東西進來', '聽說最嚴重的還沒來'];
            const k = rnd(RUM); let n = 0; for (const x of ad) { if (x === a) continue; const q = circle(w, x, a); if (q != null && q <= 2) { mem(w, x, k, { c: cr.cause }, 5); x.moodModifier = (x.moodModifier || 0) - 1; n++; } }
            if (!n) return false; if ((cr.n.rumor || 0) < 2) log(w, '🗣️ {a}到處傳：{r}。', { a: a.name, r: fill(k, { c: cr.cause }) }, a.name);
        } else if (r === 'protest') {
            mem(w, a, '{c}之後，我跟大家一起上街，要鎮公所給個交代。', { c: cr.cause }, 6);
            if ((cr.n.protest || 0) + 1 === 3) { // 夠多人才變成集會,把相關提案提早推上議程
                log(w, '📢 {c}之後，鎮民聚在廣場抗議，要鎮公所給個交代。帶頭的是{a}。', { c: cr.cause, a: a.name }, a.name); news(w, '📢 {c}之後，鎮民上街抗議', { c: cr.cause }, 8, [a.name]);
                const T = w.tech; if (T) { if (cr.kind === 'meltdown' || cr.kind === 'leak') T.pendAbandon = d; if (T.bio && cr.kind === 'lableak') T.bio.pendHalt = d; if (T.bio && cr.kind === 'price_storm') T.bio.pendPrice = d; }
                for (const x of ad) { const q = x.job?.key === 'mayor'; if (q) x.moodModifier = (x.moodModifier || 0) - 4; }
            }
        } else if (r === 'pray') {
            a.moodModifier = (a.moodModifier || 0) + 3; for (const [id, x] of Object.entries(C.did)) { if (x[1] === 'pray' && d - x[0] <= 1 && w.agents[id] && id !== a.agentId) aff(a, w.agents[id], 3); }
            if ((cr.n.pray || 0) === 2) log(w, '🙏 {c}之後，信徒們聚在一起禱告，希望一切快點過去。', { c: cr.cause });
        } else if (r === 'volunteer') {
            const vs = pickV().slice(0, 3); if (!vs.length) return false; for (const v of vs) aff(v, a, 10); a.moodModifier = (a.moodModifier || 0) + 2;
            mem(w, a, '{c}之後，我去幫忙照顧受害的人。', { c: cr.cause }, 6); if ((cr.n.volunteer || 0) < 2) log(w, '🩺 {a}自願去照顧{v}。{say}', { a: a.name, v: TECH?.names ? TECH.names(vs) : vs.map(x => t(x.name)).join(t('、')), say }, a.name);
        } else if (r === 'comfort') {
            const fam = family(w, a).filter(f => !f.isDead); for (const f of fam) { aff(a, f, 4); aff(f, a, 4); f.moodModifier = (f.moodModifier || 0) + 2; } if (!fam.length) return false;
        } else done = false;
        if (!done) return false;
        cr.n[r] = (cr.n[r] || 0) + 1; C.st[r] = (C.st[r] || 0) + 1; C.did[a.agentId] = [d, r, cr.id];
        C.stress[a.agentId] = Math.max(0, (C.stress[a.agentId] || 0) - (r === 'pray' || r === 'comfort' || r === 'help' ? 25 : 12));
        return true;
    }

    // ---------- AI:重要人物自己決定(每天最多兩人) ----------
    function askAI(w, a, cr) {
        const ce = w.conversationEngine; if (!ce?._askJson || !ce.fullAgentOk?.(w)) return false;
        const C = S(w); const d = day(w); if (C.aiDay !== d) { C.aiDay = d; C.aiN = 0; } if (C.aiN >= 2) return false;
        try { if (typeof CROWD !== 'undefined' && CROWD.isNotable && !CROWD.isNotable(w, a)) return false; } catch (e) {}
        C.aiN++;
        const friends = Object.entries(C.did).filter(([id, x]) => d - x[0] <= 3 && w.agents[id] && (circle(w, a, w.agents[id]) ?? 9) <= 2).map(([id, x]) => `${t(w.agents[id].name)}${t('：')}${t(R[x[1]]?.name || '')}`).slice(0, 5).join(t('、')) || t('沒有');
        const opts = Object.entries(R).map(([k, v]) => `${k}=${t(v.name)}`).join(', ');
        const prompt = `${t('你是小鎮村民')}${t(a.name)}${t('（')}${t(a.job?.title || '')}${t('；性格：')}${(a.personality?.traits || []).map(x => t(x)).join(t('、'))}${t('；身上有')} ${Math.round(cash(w, a))} ${t('銀幣')}${t('）')}${t('。鎮上剛發生')}${t(cr.cause)}${cr.vic.includes(a.agentId) ? t('，你的家人受害了') : ''}${t('。你身邊的人在做：')}${friends}${t('。照你的個性和處境，你現在會怎麼做？從這些選一個：')}${opts}${t('，或 none（照常過日子）。只回 JSON：{"r":"選項","line":"你說的一句話（20 字內）"}')}`;
        ce._askJson(prompt, 90).then(j => { const r = j?.r; if (!w.agents[a.agentId] || a.isDead) return; if (r && R[r]) act(w, a, r, cr, String(j.line || '').replace(/[<>]/g, '').slice(0, 30)); }).catch(() => {});
        return true;
    }

    // ---------- 每天 ----------
    function daily(w) {
        const C = S(w); const d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        for (const id of Object.keys(C.stress)) { C.stress[id] = Math.round((C.stress[id] || 0) * 0.85); if (C.stress[id] < 3 || !w.agents[id]) delete C.stress[id]; }
        for (const [id, x] of Object.entries(C.did)) if (d - x[0] > 10 || !w.agents[id]) delete C.did[id];
        const live = C.cur.filter(x => x.until >= d); const ended = C.cur.filter(x => x.until < d);
        for (const cr of ended) { const top = Object.entries(cr.n).filter(([k, v]) => v > 0 && R[k]).sort((x, y) => y[1] - x[1]).slice(0, 4); C.hist.unshift({ cause: cr.cause, kind: cr.kind, d: cr.d, end: d, sev: cr.sev, n: cr.n }); C.hist = C.hist.slice(0, 10); if (top.length) log(w, '📊 {c}過後，鎮上的人各自怎麼面對：{list}。', { c: cr.cause, list: top.map(([k, v]) => `${R[k].icon}${t(R[k].name)} ${v}`).join(t('、')) }); }
        C.cur = live; if (!live.length) return;
        const cr = live.slice().sort((x, y) => y.sev - x.sev)[0];
        for (const a of here(w).sort(() => Math.random() - 0.5)) {
            if (jailed(w, a)) continue; const s = C.stress[a.agentId] || 0; if (s <= 0) continue;
            const last = C.did[a.agentId]; if (last && d - last[0] < 2) continue;
            if (Math.random() > Math.min(0.85, s / 110)) continue;
            if (askAI(w, a, cr)) continue;
            const r = decide(w, a, cr, d); if (r !== 'none') act(w, a, r, cr);
        }
        const lootN = cr.n.loot || 0; if (lootN >= 3 && !cr.riot) { cr.riot = 1; log(w, '🔥 {c}之後秩序大亂，已經有 {n} 家店被搶，衛兵忙得焦頭爛額。', { c: cr.cause, n: lootN }); news(w, '🔥 {c}之後，鎮上爆發搶劫潮', { c: cr.cause }, 9, []); }
    }
    function view(w) { const C = S(w); return { cur: C.cur.map(x => ({ cause: x.cause, sev: x.sev, n: x.n, days: day(w) - x.d })), hist: C.hist.slice(0, 5), st: C.st, R }; }
    function brief(w, a) { const x = S(w).did[a.agentId]; if (!x || day(w) - x[0] > 6) return ''; return fill('剛發生大事，我選擇了{r}', { r: R[x[1]]?.name || '' }); }
    return { S, R, CAUSE, shock, scores, decide, act, social, lootThr, daily, view, brief };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) AFTERMATH.daily(w); } catch (e) { console.warn('[Aftermath] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = AFTERMATH.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.crisis = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.crisis) { const C = this.crisis; d.crisis = { cur: C.cur || [], did: C.did || {}, stress: C.stress || {}, st: C.st || {}, hist: C.hist || [], n: C.n || 0 }; } return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.crisis = (data?.crisis && typeof data.crisis === 'object') ? data.crisis : null; } catch (e) {} return r; };
}
if (typeof window !== 'undefined') window.AFTERMATH = AFTERMATH;
