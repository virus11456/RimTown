// v8.2.0 疫情裡的人情世故:災厄工坊的病原體接上 v8.1 的人情世故與 v8.0 的煤煙。
// 每一項都有反饋:
//  ① 固定地點傳染:每天同一時段在同一個地方碰面的人互相傳;關酒館市集就斷掉這條線;怕被傳染的人待在家(點頭之交也斷了);
//     疫情過去後老地方重新熱鬧,少了的人留下空位子。
//  ② 偷溜:規定生效越久越多人撐不住(防疫疲乏);死了人、有人被抓大家又收斂;投贊成票又偷溜的人算「說一套做一套」;
//     偷溜的人比較容易染病,染病後醫生一問就露餡。
//  ③ 關太久:做生意的人提議重開酒館市集(在 sim-calamity.js);重開後又爆發,提案人照 v8.1 的嘴硬機制丟臉。
//  ④ 送飯:鄰居朋友把飯放在病人家門口 → 欠人情(婚喪禮金、投票都會還);送飯的人自己也可能染上。
//  ⑤ 嘴硬:防疫提案被否決後接連死人,反對的人丟臉,有人認錯、有人嘴硬;提案的醫生被說「早該聽他的」。
//  ⑥ 怪罪與平反:流言裡被怪的人,疫情過後有人去道歉,也有人一直記恨變冷戰。
//  ⑦ 集體記憶:上次死過人,這次早一點發現、早一點防疫、經歷過的人更願意配合;兩年後慢慢忘了;上次沒事的話反而輕忽。
//     每年疫情週年點蠟燭。
//  ⑧ 萬靈藥:有人趁機賣「萬靈藥」(有煉金工坊)或「祖傳偏方」,喝了照樣病倒就被拆穿,賣的人丟臉、可能退錢;上次被騙過的人不再買。
// 煤煙(蒸汽煉金):空氣越髒飛沫傳得越兇、肺不好的人更容易染上。
// 銀幣守恆:萬靈藥與退錢都用 WALLET.pay(錢只在村民之間移動)。
const PLAGUEWAYS = (function () {
    if (typeof CALAMITY === 'undefined' || !CALAMITY.H) return null;
    const C0 = CALAMITY; const H = C0.H;
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const here = (w) => C0.here(w); const adults = (w) => C0.adults(w);
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const aff = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const addAff = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const log = (w, k, p, who, who2) => { try { w.logMessageT?.('social', k, p || {}, who, who2); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp || 5, []); } catch (e) {} };
    const news = (w, k, p, imp, names) => { try { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof y === 'string' ? t(y) : y); w.dailyNews?.collectEvent?.('event', s, imp || 6, names || []); } catch (e) {} };
    const wal = (w, a) => (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 0);
    const ways = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k);
    const stOf = (X, a) => X.st[a.agentId];
    const sickI = (X, a) => stOf(X, a)?.s === 'I';
    const SPOT_NAME = { town_square: '廣場', tavern: '酒館', park: '公園', chapel: '禮拜堂', market: '市集' };
    const SLOT_NAME = { am: '早上', pm: '傍晚' };
    const MS_NAME = { close: '酒館市集關閉', mask: '戴口罩', quar: '病人隔離', lock: '封城' };

    // 每場疫情自己的狀態(跟著 calamity.cur 一起存檔)
    function P(X) {
        const p = X.pw || (X.pw = {}); for (const k of ['brk', 'home', 'hyp', 'said', 'cd', 'go', 'ask', 'feed']) if (!p[k] || typeof p[k] !== 'object') p[k] = {};
        for (const k of ['sneak', 'caught', 'traced', 'food', 'stay', 'admit', 'stub', 'sorry', 'grudge', 'foodNo', 'vaxNo', 'back']) p[k] = p[k] || 0; p.deaths = p.deaths || []; p.lost = p.lost || []; return p;
    }
    const cool = (p, k, d, n) => { if (d - (p.cd[k] ?? -99) < n) return false; p.cd[k] = d; return true; };

    // ---------- ⑦ 集體記憶 ----------
    // 上一場疫情:死過人 → 教訓深;兩年(720 天)後淡掉;上次沒死人 → 有點輕忽
    function prev(w, X) { const h = (w.calamity?.hist || [])[0]; return h && h.end != null && h.end <= (X?.day ?? day(w)) ? h : null; }
    function lessonOf(w, X) {
        const h = prev(w, X); if (!h) return { L: 0, calm: false, h: null };
        const fade = Math.max(0, 1 - ((X?.day ?? day(w)) - h.end) / 720);
        const pop = Math.max(1, (h.ppl || []).length + (h.died || 0));
        const L = h.died > 0 ? Math.min(1, 0.5 + h.died / pop * 4) * fade : 0;
        return { L: Math.round(L * 100) / 100, calm: h.died === 0 && fade > 0.3, h };
    }
    const livedThrough = (h, a) => !!h && (h.ppl || []).includes(a.agentId);
    H.lesson = (w, X) => 1 - 0.5 * lessonOf(w, X).L; // 防疫門檻打折(最多一半)
    H.thr = (w, X) => (lessonOf(w, X).L >= 0.4 ? 1 : 0);
    H.vote = (w, X, a, k) => {
        if (k === 'reopen') return null; const { L, calm, h } = lessonOf(w, X); let s = 0, why = null;
        if (L > 0 && livedThrough(h, a)) { s += 0.9 * L + ((a.age ?? 30) >= 55 ? 0.3 : 0); why = 'cal_lesson'; }
        else if (calm && livedThrough(h, a) && k !== 'vax') { s -= 0.5; why = 'cal_calm'; }
        if (['close', 'lock', 'mask'].includes(k) && X.ms.close && k !== 'close') s -= 0.15 * (fatigue(w, X) - 1); // 已經關很久的,再加新規定就有人受不了
        return s ? { s, why } : null;
    };

    // ---------- ② 偷溜與防疫疲乏 ----------
    const active = (X) => ['close', 'mask', 'quar', 'lock'].filter(k => X.ms[k]);
    function fatigue(w, X) {
        const p = P(X); const ks = active(X); if (!ks.length) return 1; const d = day(w);
        const start = Math.max(Math.min(...ks.map(k => X.ms[k])), p.fear ?? -99, p.shame ?? -99); // 死了人或有人被抓,大家又收斂一陣子
        return Math.max(1, Math.min(3, 1 + (d - start) / 15));
    }
    H.mask = (w, X) => { const f = fatigue(w, X); return 1 - 0.5 * Math.max(0.6, Math.min(1, 1.15 - 0.15 * f)); }; // 戴久了有人拉到下巴
    H.brk = (w, X, a) => P(X).brk[a.agentId] === day(w);
    function votedFor(w, X, a, k) {
        const ps = (w.proposals?.items || []).filter(p => p.kind === 'cal_' + k && (p.createdDay ?? 0) >= (X.day ?? 0) - 1); const p = ps[ps.length - 1];
        return p && p.votes?.[a.agentId] === 'for' ? p : null;
    }
    // 這個人今天受哪一條規定管、有多想溜(以前擲骰用的那個機率)
    function sneakOdds(w, X, a, d, f) {
        const p = P(X); if (p.home[a.agentId] > d) return null;
        const sick = sickI(X, a); let k = null, base = 0;
        if (sick && X.ms.quar) { k = 'quar'; base = hasT(a, 'pessimist') || hasT(a, 'kind') ? 0.005 : 0.02; }
        else if (!sick && X.ms.lock && a.job?.key === 'trader') { k = 'lock'; base = 0.04; }
        else if (!sick && X.ms.close) { const r = ways()?.routineOf?.(w, a); k = 'close'; base = (r && (r.s === 'tavern' || r.s === 'market') ? 0.02 : 0.006) + (hasT(a, 'glutton') || hasT(a, 'charismatic') ? 0.03 : 0); }
        else if (!sick && X.ms.mask) { k = 'mask'; base = 0.01; }
        if (!k) return null;
        if (hasT(a, 'lazy')) base += 0.02; if (hasV(a, '自由')) base += 0.02; if (hasT(a, 'pessimist')) base *= 0.4; if (a.job?.key === 'doctor') base *= 0.2;
        return { k, p: Math.min(0.25, base * f) };
    }
    function sneakDo(w, X, a, k, d, guard) {
        const p = P(X); p.brk[a.agentId] = d; p.sneak++;
        // 投贊成票還偷溜:說一套做一套(v8.1)
        const vp = votedFor(w, X, a, k); const W = ways();
        if (vp && W && !p.hyp[a.agentId]) { const X8 = W.S(w); let title = vp.id; try { title = w.proposals.title(vp); } catch (e) {} const h = { a: a.agentId, k: 'cal_' + k, t: title, d }; X8.hyp.push(h); if (X8.hyp.length > 12) X8.hyp = X8.hyp.slice(-12); p.hyp[a.agentId] = 1; mem(w, a, '「{t}」我是投了贊成，不過……就這一次，沒人看見。', { t: title }, 4); }
        // 被抓:有衛兵的話機會大一點
        if (Math.random() < (guard ? 0.06 : 0.04)) caught(w, X, a, k, d, false);
    }
    function sneakDaily(w, X, d) {
        const p = P(X); const ks = active(X); if (!ks.length) return; const f = fatigue(w, X);
        const guard = here(w).some(a => a.job?.key === 'guard');
        // 溜不溜由本人決定(sneakBy):昨天打定主意要溜的人,今天真的溜(規定撤了、病倒了就算了)
        for (const [id, g] of Object.entries(p.go)) { delete p.go[id]; const a = w.agents[id]; if (!a || a.isDead || d - g.d > 2 || !adults(w).includes(a)) continue; const o = sneakOdds(w, X, a, d, f); if (o) sneakDo(w, X, a, o.k, d, guard); }
        // 太久以前的紀錄清掉
        for (const [id, v] of Object.entries(p.brk)) if (d - v > 8) delete p.brk[id];
    }
    // v9.26.0 給決策核心:這個人現在受哪條規定管、溜出去的念頭有多強(p 是以前每天擲骰的機率,讓照個性推估時的頻率跟以前差不多)
    function sneakInfo(w, a) {
        const X = w?.calamity?.cur; if (!a || !X || X.kind !== 'pathogen' || !active(X).length || !adults(w).includes(a)) return null; const p = P(X); const d = day(w);
        if (p.go[a.agentId] || p.brk[a.agentId] === d) return null; const f = fatigue(w, X); const o = sneakOdds(w, X, a, d, f); if (!o) return null;
        return { k: o.k, p: o.p, rule: MS_NAME[o.k], days: Math.max(0, d - (X.ms[o.k] || d)), tired: f >= 2, voted: !!votedFor(w, X, a, o.k), sick: sickI(X, a), guard: here(w).some(x => x.job?.key === 'guard') };
    }
    function sneakBy(w, a) { const I = sneakInfo(w, a); if (!I) return null; P(w.calamity.cur).go[a.agentId] = { k: I.k, d: day(w) }; return I; }
    function caught(w, X, a, k, d, traced) {
        const p = P(X); const W = ways(); const deed = W?.DEED?.['cal_' + k] || '私下自己照樣不守'; p.caught++; if (traced) p.traced++; p.shame = d;
        const h = W ? (W.S(w).hyp || []).find(x => x.a === a.agentId && x.k === 'cal_' + k && !x.exp) : null;
        if (h) { W.expose(w, h); if (traced) log(w, '🔍 醫生問了一圈才知道，{a}是在{deed}之後病倒的。', { a: a.name, deed }, a.name); return; } // 說一套做一套被拆穿(丟臉、全鎮信任下降)
        if (W) W.loseFace(w, a, traced ? 8 : 5);
        for (const o of adults(w).filter(x => x !== a && Math.random() < 0.25)) addAff(o, a, -2);
        mem(w, a, traced ? '醫生一問，大家都知道我偷溜出去才染上的。' : '{deed}被人逮個正著，好丟臉。', { deed }, 6);
        if (cool(p, 'caught', d, 3)) log(w, traced ? '🔍 醫生問了一圈才知道，{a}是在{deed}之後病倒的。' : '🚨 {a}{deed}，被人逮個正著。', { a: a.name, deed }, a.name);
    }
    // 偷溜的人病倒了 → 醫生追問就露餡
    function traceDaily(w, X, d) {
        if (!X.found) return; const p = P(X);
        for (const [id, v] of Object.entries(p.brk)) { const a = w.agents[id]; if (!a || a.isDead || p.said['tr' + id]) continue; const x = X.st[id]; if (x && x.s === 'I' && x.d >= v - 1 && Math.random() < 0.5) { p.said['tr' + id] = 1; const k = ['quar', 'lock', 'close', 'mask'].find(m => X.ms[m]) || 'close'; caught(w, X, a, k, d, true); } }
    }

    // ---------- ① 固定地點傳染、怕得待在家 ----------
    let regCache = null;
    function groupsOf(w, X, d) {
        if (regCache && regCache.w === w && regCache.d === d && regCache.X === X) return regCache.g;
        const W = ways(); const g = {}; if (!W) return g; const p = P(X);
        for (const a of here(w)) { if ((a.age ?? 30) < 14) continue; const r = W.routineOf(w, a); if (!r) continue;
            if (p.home[a.agentId] > d) continue; // 待在家
            const brk = p.brk[a.agentId] === d;
            if (sickI(X, a) && X.ms.quar && !brk) continue; // 隔離中
            if (X.ms.close && (r.s === 'tavern' || r.s === 'market') && !brk) continue; // 關了,只有偷溜的人還去
            const key = r.s + ':' + r.t; (g[key] || (g[key] = [])).push(a); }
        regCache = { w, X, d, g }; return g;
    }
    H.reg = (w, X, a, sick) => {
        const W = ways(); if (!W) return []; const d = day(w); const r = W.routineOf(w, a); if (!r) return [];
        const g = groupsOf(w, X, d)[r.s + ':' + r.t] || []; if (!g.includes(a)) return [];
        return g.filter(x => x !== a).slice(0, 5);
    };
    function stayDaily(w, X, d) {
        const p = P(X); if (!X.found || !['rumor', 'panic'].includes(X.phase)) return;
        if (deciding(w, 'calStay')) { stayAsk(w, X, d, p); for (const [id, v] of Object.entries(p.home)) if (v <= d) delete p.home[id]; return; } // v11.7.0 怕的人自己決定待不待在家
        for (const a of adults(w)) { if (p.home[a.agentId] > d || stOf(X, a)) continue; const scared = hasT(a, 'pessimist') || (a.age ?? 30) >= 60 || (X.bereaved || []).includes(a.agentId); if (!scared || Math.random() > (X.phase === 'panic' ? 0.25 : 0.1)) continue; p.home[a.agentId] = d + 5 + Math.floor(Math.random() * 6); p.stay++; if (p.stay <= 3 || cool(p, 'stay', d, 6)) mem(w, a, '怕被傳染，這幾天哪裡都不去，連{spot}都沒去。', { spot: SPOT_NAME[ways()?.routineOf?.(w, a)?.s] || '廣場' }, 4); }
        for (const [id, v] of Object.entries(p.home)) if (v <= d) delete p.home[id];
    }
    if (ways()?.ABSENT) ways().ABSENT.push((w, a) => { const X = w?.calamity?.cur; return !!X?.pw?.home && X.pw.home[a.agentId] > day(w); });

    // ---------- 煤煙、肺病、偷溜的人比較容易染上 ----------
    H.mult = (w, X, route) => { if (route !== 'droplet') return 1; const sm = w.tech?.steam?.smog || 0; return sm > 20 ? 1 + Math.min(0.3, (sm - 20) / 100) : 1; };
    H.sus = (w, X, a) => (w.tech?.mk?.[a.agentId] === 'lung' ? 1.4 : 1) * (P(X).brk[a.agentId] != null ? 1.3 : 1);

    // ---------- ④ 送飯 ----------
    function foodDaily(w, X, d) {
        if (!X.found) return; const p = P(X); const W = ways(); let n = 0;
        if (deciding(w, 'calFood')) return foodAsk(w, X, d, p); // v11.7.0 被想到的那個人自己決定送不送
        const sick = here(w).filter(a => sickI(X, a)).sort(() => Math.random() - 0.5);
        for (const a of sick) {
            if (n >= 2) break; if (Math.random() > (X.ms.quar ? 0.3 : 0.15)) continue;
            const fam = (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []).map(x => x.agentId);
            const helper = adults(w).filter(b => b !== a && !fam.includes(b.agentId) && !stOf(X, b) && aff(b, a) >= 25 && !hasT(b, 'pessimist') && !(p.home[b.agentId] > d) && !(W?.coldWith?.(w, a, b)))
                .sort((x, y) => (aff(y, a) + (hasT(y, 'kind') ? 20 : 0) + (hasV(y, '社群') ? 10 : 0)) - (aff(x, a) + (hasT(x, 'kind') ? 20 : 0) + (hasV(x, '社群') ? 10 : 0)))[0];
            if (!helper) continue; n++; p.food++;
            if (W) W.owe(w, a, helper, 2); addAff(a, helper, 4); addAff(helper, a, 2);
            mem(w, a, '生病的時候，{b}每天把飯放在我家門口。這份情我記著。', { b: helper.name }, 7); mem(w, helper, '{a}病著，我送了飯過去，放在門口就走。', { a: a.name }, 4);
            if (cool(p, 'food', d, 3)) log(w, '🍲 {b}把一鍋熱湯放在{a}家門口，敲了兩下門就走。', { a: a.name, b: helper.name }, helper.name, a.name);
            const s = X.spec; if ((s.route.includes('droplet') || s.route.includes('contact')) && !X.vx?.[helper.agentId] && Math.random() < 0.03) C0.infect(w, X, helper, d); // 送飯的人自己也冒著風險
        }
    }

    // ---------- ⑤ 嘴硬 ----------
    function stubDaily(w, X, d) {
        const p = P(X); const W = ways(); if (!W) return;
        for (const pr of (w.proposals?.items || [])) {
            if (!/^cal_(quar|mask|close|lock)$/.test(pr.kind) || pr.status !== 'rejected' || p.said[pr.id] || (pr.createdDay ?? 0) < (X.day ?? 0)) continue;
            const after = p.deaths.filter(x => x >= (pr.createdDay ?? 0) + 1 && x <= (pr.createdDay ?? 0) + 14).length; if (after < 2) continue;
            p.said[pr.id] = 1; let title = pr.id; try { title = w.proposals.title(pr); } catch (e) {}
            const against = Object.entries(pr.votes || {}).filter(([, v]) => v === 'against').map(([id]) => w.agents[id]).filter(a => a && !a.isDead);
            for (const a of against) W.loseFace(w, a, 4);
            const prop = w.agents[pr.proposerId]; if (prop && !prop.isDead) { W.setFace(w, prop, W.faceOf(w, prop) + 8); mem(w, prop, '當初提「{t}」被否決了，現在大家都說早該聽我的。', { t: title }, 6); }
            const a = rnd(against); if (!a) continue;
            if (deciding(w, 'calStub')) { ask(w, [{ a, kind: 'calStub', ctx: { pr: pr.id, t: title, n: after, by: prop?.agentId || null, d } }]); continue; } // v11.7.0 被追問的人自己決定認錯還是嘴硬
            const admit = hasT(a, 'kind') || hasT(a, 'honest') || (typeof DARK !== 'undefined' && DARK.honesty && DARK.honesty(a) >= 2);
            if (admit) { p.admit++; if (prop) addAff(prop, a, 3); log(w, '😔 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}低著頭說：「早知道就該聽{b}的。」', { t: title, n: after, a: a.name, b: prop?.name || t('醫生') }, a.name); }
            else { p.stub++; for (const b of adults(w).filter(x => x !== a && Math.random() < 0.2)) addAff(b, a, -2); log(w, '😤 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}還是說：「人本來就會死，跟那個有什麼關係。」', { t: title, n: after, a: a.name }, a.name); }
        }
    }

    // ---------- ⑧ 萬靈藥 ----------
    function panaceaDaily(w, X, d) {
        if (deciding(w, 'calPanSell')) return panSellDaily(w, X, d); // v11.7.0 賣不賣由有動機的人自己決定，買不買由買的人決定
        const p = P(X); if (!X.found || p.pan || !['rumor', 'panic'].includes(X.phase) || Math.random() > 0.12) return;
        const steam = built(w, 'alchemy_lab'); const nm = steam ? '萬靈藥' : '祖傳偏方';
        const C = w.calamity; if ((C.hist || [])[0]?.pw?.pan === 'fake' && Math.random() < 0.5) return; // 上次才被騙過,大家學乖了一點
        const sold = new Set(C.sold || []); // 被拆穿過的人不敢再賣
        const pool = adults(w).filter(a => !sickI(X, a) && wal(w, a) >= 20 && !sold.has(a.agentId));
        const seller = pool.filter(a => hasT(a, 'greedy') || hasT(a, 'charismatic') || a.job?.key === 'trader').sort((x, y) => (hasT(y, 'greedy') ? 2 : 0) - (hasT(x, 'greedy') ? 2 : 0))[0]; if (!seller) return;
        const burned = new Set(C.burned || []); // 上次被騙過的人不買
        const buyers = adults(w).filter(a => a !== seller && !burned.has(a.agentId) && wal(w, a) >= 8 && (hasT(a, 'pessimist') || (a.age ?? 30) >= 55 || (X.bereaved || []).includes(a.agentId) || Math.random() < 0.15)).sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 5));
        const paid = []; let sum = 0;
        for (const b of buyers) { const n = Math.max(5, Math.min(20, Math.round(wal(w, b) * 0.15))); if (typeof WALLET !== 'undefined' && WALLET.pay(w, b, seller, n, t(nm))) { paid.push([b.agentId, n]); sum += n; mem(w, b, '花了 {n} 銀幣跟{s}買了{x}，說喝了就不會染上。', { n, s: seller.name, x: nm }, 5); } }
        if (paid.length < 2) { // 沒什麼人買,錢退回去
            for (const [id, n] of paid) { const b = w.agents[id]; if (b) WALLET.pay(w, seller, b, n, t('退錢')); } return; }
        p.pan = { s: seller.agentId, b: paid, sum, d, nm, steam: steam ? 1 : 0, exp: 0 };
        mem(w, seller, '這陣子賣{x}賺了 {n} 銀幣。', { x: nm, n: sum }, 5);
        log(w, '🧴 {s}在市集擺攤賣「{x}」，說喝了就不會染上{n}。{k} 個人掏錢買了，一共 {m} 銀幣。', { s: seller.name, x: nm, n: X.spec.name, k: paid.length, m: sum }, seller.name);
    }
    function panaceaCheck(w, X, d, atEnd) {
        const p = P(X); const pn = p.pan; if (!pn || pn.exp || pn.open) return; const s = w.agents[pn.s]; if (!s) { pn.exp = d; return; }
        const hit = pn.b.map(([id]) => w.agents[id]).find(b => b && (b.isDead || sickI(X, b)));
        if (!hit) { if (atEnd) { pn.exp = -1; const fan = pn.b.map(([id]) => w.agents[id]).find(b => b && !b.isDead); if (fan) log(w, '🧴 {a}逢人就說：「還好我有喝{s}的{x}，才沒染上。」', { a: fan.name, s: s.name, x: pn.nm }, fan.name); } return; }
        pn.exp = d; const W = ways(); const stuff = pn.steam ? '糖水加一點煤灰' : '泡過的樹皮水';
        log(w, '🧴 喝了「{x}」的{a}還是病倒了。大家這才知道，{s}賣的只是{y}。', { x: pn.nm, a: hit.name, s: s.name, y: stuff }, s.name, hit.name);
        news(w, '🧴 「{x}」是假的：{s}賣的只是{y}', { x: pn.nm, s: s.name, y: stuff }, 7, [s.name]);
        if (W) { W.loseFace(w, s, 20); const X8 = W.S(w); X8.trust = Math.max(20, X8.trust - 2); }
        const bs = pn.b.map(([id, n]) => [w.agents[id], n]).filter(([b]) => b && !b.isDead);
        for (const [b] of bs) { addAff(b, s, -10); mem(w, b, '被{s}的{x}騙了，下次再也不買這種東西。', { s: s.name, x: pn.nm }, 7); }
        const C = w.calamity; C.burned = [...new Set([...(C.burned || []), ...bs.map(([b]) => b.agentId)])].slice(-40); C.sold = [...new Set([...(C.sold || []), s.agentId])].slice(-10);
        if (!s.isDead && deciding(w, 'calRefund') && C0.here(w).includes(s) && bs.length) { pn.ask = d; ask(w, [{ a: s, kind: 'calRefund', ctx: { b: bs.map(([b, n]) => [b.agentId, n]), nm: pn.nm, d } }]); } // v11.7.0 退不退錢由賣的人自己決定
        else if (!s.isDead && (hasT(s, 'kind') || Math.random() < 0.4)) { // 被罵到受不了,把錢退回去
            let back = 0; for (const [b, n] of bs) { const m = Math.min(n, wal(w, s)); if (m > 0 && WALLET.pay(w, s, b, m, t('退錢'))) back += m; } pn.back = back;
            if (back > 0) { if (W) W.setFace(w, s, W.faceOf(w, s) + 8); log(w, '💸 {s}被罵到受不了，把 {n} 銀幣一一退給大家。', { s: s.name, n: back }, s.name); }
        } else if (W && bs.length) { const angry = bs.sort((x, y) => y[1] - x[1])[0][0]; W.quarrel(w, angry, s); }
    }

    // ================= v11.7.0 災難裡的人 =================
    // 以前怕的人待不待在家、送不送飯、打不打疫苗、賣不賣假藥、買不買、退不退錢、道不道歉、認不認錯、有錢人逃不逃，都是擲骰替人決定；
    // 現在交給當事人自己決定（選擇點登記在 sim-decide-calam.js）。這裡只管「誰才會被問、多久問一次」，選了之後真的去做也在這裡。
    // 疫情本身（誰被傳染、病多重、死不死、偷溜會不會被抓）照舊看天。決策核心沒開、舊存檔照原本的機率。
    const deciding = (w, k) => { try { return !!(w?.observerMode && typeof DECIDE !== 'undefined' && DECIDE.on(w) && DECIDE.KINDS?.[k]); } catch (e) { return false; } };
    const ask = (w, list) => { try { DECIDE.askNow(w, list); } catch (e) { console.warn('[PlagueWays] ask', e); } };
    const recent = (p, k, a, d, gap) => d - (p.ask[k + a.agentId] ?? -99) < gap;
    const curX = (w) => { const X = w?.calamity?.cur; return X && X.kind === 'pathogen' ? X : null; };
    const nSick = (X) => Object.values(X.st).filter(x => x.s === 'I').length;
    // 家人：配偶、爸媽、孩子（MONEY.familyOf 不含孩子；送飯、躲在家都要算孩子）
    const kin = (w, a) => { const R = a?.relationships?.relationships || {}; return here(w).filter(o => o !== a && (R[o.agentId]?.status === 'married' || (a._parentNames || []).includes(o.name) || (o._parentNames || []).includes(a.name))); };
    const tie = (w, a, b) => (kin(w, a).includes(b) ? '家人' : (ways()?.coldWith?.(w, a, b) || aff(a, b) <= -15) ? '有過節' : aff(a, b) >= 60 ? '很要好' : aff(a, b) >= 25 ? '有交情' : '交情普通');
    const dep = (w, a) => (w.bank?.open ? (w.bank.dep?.[a.agentId] || 0) : 0);
    const wage = (w, a) => !!a.job && a.job.key !== 'mayor' && wal(w, a) + dep(w, a) < 40; // 靠每天的工錢吃飯：沒什麼積蓄
    const within = (q, n) => 1 - Math.pow(1 - q, n);
    const scared = (X, a) => hasT(a, 'pessimist') || (a.age ?? 30) >= 60 || (X.bereaved || []).includes(a.agentId);

    // ---------- ① 怕的人待不待在家：恐慌期每人四天問一次，一天最多問八個（最怕的先） ----------
    const STAY_GAP = 4, STAY_MAX = 8;
    const fear = (w, X, a) => (hasT(a, 'pessimist') ? 1 : 0) + ((a.age ?? 30) >= 60 ? 1 : 0) + ((X.bereaved || []).includes(a.agentId) ? 1.5 : 0) + (kin(w, a).some(f => sickI(X, f)) ? 1 : 0) + (hasT(a, 'neurotic') ? 0.5 : 0) + Math.random() * 0.5;
    function stayAsk(w, X, d, p) {
        const c = adults(w).filter(a => !(p.home[a.agentId] > d) && !stOf(X, a) && scared(X, a) && !recent(p, 'st', a, d, STAY_GAP)).map(a => [a, fear(w, X, a)]).sort((x, y) => y[1] - x[1]).slice(0, STAY_MAX).map(x => x[0]);
        for (const a of c) p.ask['st' + a.agentId] = d;
        p.stayAsk = (p.stayAsk || 0) + c.length; ask(w, c.map(a => ({ a, kind: 'calStay', ctx: { d } })));
    }
    function stayInfo(w, a) {
        const X = curX(w); if (!X || !a || !X.found || !['rumor', 'panic', 'fading'].includes(X.phase) || stOf(X, a)) return null; const p = P(X); const d = day(w);
        if (p.home[a.agentId] > d) return null; const fam = kin(w, a);
        return { X, n: X.spec.name, sick: nSick(X), died: X.died, panic: X.phase === 'panic', famSick: fam.filter(f => sickI(X, f)), fam: fam.filter(f => !(p.home[f.agentId] > d) && !sickI(X, f)), c: Math.floor(wal(w, a)), wage: wage(w, a),
            old: (a.age ?? 30) >= 60, lost: (X.bereaved || []).includes(a.agentId), pess: hasT(a, 'pessimist'), q: X.phase === 'panic' ? 0.25 : 0.1, gap: STAY_GAP };
    }
    function stayBy(w, a, withFam) {
        const I = stayInfo(w, a); if (!I) return null; const p = P(I.X); const d = day(w); const who = [a].concat(withFam ? I.fam : []); const until = d + 5 + Math.floor(Math.random() * 6);
        for (const x of who) { p.home[x.agentId] = Math.max(p.home[x.agentId] || 0, until); p.stay++; } regCache = null;
        mem(w, a, withFam ? '怕被傳染，我把一家人都關在家裡，這幾天誰也不准出門。' : '怕被傳染，這幾天哪裡都不去，連{spot}都沒去。', { spot: SPOT_NAME[ways()?.routineOf?.(w, a)?.s] || '廣場' }, 4);
        if (withFam && who.length > 1) log(w, '🚪 {a}怕家裡有人染上{n}，把一家 {k} 口都關在家裡，門口掛著「暫不見客」。', { a: a.name, n: I.n, k: who.length }, a.name);
        return { who, until };
    }

    // ---------- ④ 送飯：病人身邊交情最好的那一位被想到，自己決定送不送 ----------
    // 一天最多想到兩個病人（跟以前「每天最多兩個病人有人送飯」一樣；誰先被想到看天）；同一個病人兩天內不再想；答應了就連送兩天（病好了就停）。
    // 被想到的是交情最好的那一位，答應的比以前隨便一個人高；一天兩個病人、各送兩天，整場疫情送飯的次數跟以前差不多
    const FOOD_GAP = 2, FOOD_MAX = 2, FOOD_DAYS = 2;
    function thoughtOf(w, X, a, d) {
        const p = P(X); const fam = kin(w, a); const W = ways(); const r0 = W?.routineOf?.(w, a);
        const ok = (b) => b !== a && (b.age ?? 30) >= 16 && !sickI(X, b) && !(p.home[b.agentId] > d) && !(w.civic?.jail?.[b.agentId] > d);
        return adults(w).filter(b => ok(b) && ((fam.includes(b) && b.homeLocation !== a.homeLocation) || aff(b, a) >= 25 || (r0 && (W.routineOf(w, b)?.s === r0.s && W.routineOf(w, b)?.t === r0.t))))
            .map(b => [b, aff(b, a) + (fam.includes(b) ? 40 : 0)]).sort((x, y) => y[1] - x[1]).map(x => x[0]);
    }
    function foodAsk(w, X, d, p) {
        for (const [sid, f] of Object.entries(p.feed)) { const a = w.agents[sid], b = w.agents[f.by]; if (!a || !b || a.isDead || b.isDead || !sickI(X, a) || d > f.until || sickI(X, b) || !adults(w).includes(b)) { delete p.feed[sid]; continue; } if (f.last !== d) feedOnce(w, X, a, b, d, false); }
        const sick = here(w).filter(a => sickI(X, a) && !p.feed[a.agentId] && !recent(p, 'fd', a, d, FOOD_GAP)).sort(() => Math.random() - 0.5); const list = [];
        for (const a of sick) { if (list.length >= FOOD_MAX) break; p.ask['fd' + a.agentId] = d; const b = thoughtOf(w, X, a, d)[0]; if (b) list.push({ a: b, kind: 'calFood', ctx: { s: a.agentId, d } }); }
        p.foodAsk = (p.foodAsk || 0) + list.length; ask(w, list);
    }
    function foodInfo(w, b, ctx) {
        const X = curX(w); const a = X && ctx ? w.agents[ctx.s] : null; if (!a || a.isDead || !b || b === a || !sickI(X, a) || sickI(X, b) || day(w) - (ctx.d ?? 0) > 2) return null; const p = P(X); if (p.feed[a.agentId]) return null;
        const via = ctx.via ? w.agents[ctx.via] : null; const x = X.st[a.agentId];
        return { X, a, via, n: X.spec.name, days: Math.max(1, day(w) - (x.on ?? day(w)) + 1), alone: !kin(w, a).some(f => f.homeLocation === a.homeLocation && !sickI(X, f)), tie: tie(w, b, a), fam: kin(w, b).includes(a), af: aff(b, a), cold: !!ways()?.coldWith?.(w, a, b) || aff(b, a) <= -15,
            quar: !!X.ms.quar, died: X.died, sick: nSick(X), risk: X.spec.route.includes('droplet') || X.spec.route.includes('contact'), q: X.ms.quar ? 0.3 : 0.15,
            pass: ctx.via ? null : adults(w).filter(o => o !== a && o !== b && !sickI(X, o) && !(p.home[o.agentId] > day(w)) && aff(b, o) >= 30 && aff(o, a) >= 0).sort((x2, y2) => aff(b, y2) - aff(b, x2))[0] || null };
    }
    function feedOnce(w, X, a, b, d, first) {
        const p = P(X); const W = ways(); const f = p.feed[a.agentId]; if (f) f.last = d; p.food++;
        if (first) { if (W) W.owe(w, a, b, 2); addAff(a, b, 4); addAff(b, a, 2); mem(w, a, '生病的時候，{b}每天把飯放在我家門口。這份情我記著。', { b: b.name }, 7); mem(w, b, '{a}病著，我送了飯過去，放在門口就走。', { a: a.name }, 4); }
        if (first || cool(p, 'food', d, 3)) log(w, '🍲 {b}把一鍋熱湯放在{a}家門口，敲了兩下門就走。', { a: a.name, b: b.name }, b.name, a.name);
        const s = X.spec; if ((s.route.includes('droplet') || s.route.includes('contact')) && !X.vx?.[b.agentId] && Math.random() < 0.03) C0.infect(w, X, b, d); // 送飯的人自己也冒著風險(看天)
    }
    function feedBy(w, b, ctx) { const I = foodInfo(w, b, ctx); if (!I) return null; const p = P(I.X); const d = day(w); p.feed[I.a.agentId] = { by: b.agentId, until: d + FOOD_DAYS - 1, last: null }; feedOnce(w, I.X, I.a, b, d, true); if (I.via) { addAff(I.a, I.via, 2); mem(w, I.a, '{v}託{b}送飯過來，我知道是誰的心意。', { v: I.via.name, b: b.name }, 5); } return I; }
    function foodNo(w, b, ctx, cold) {
        const I = foodInfo(w, b, ctx); if (!I) return null; const p = P(I.X); p.foodNo++;
        if (cold) { addAff(I.a, b, -5); mem(w, I.a, '我病得下不了床，{b}就住在附近，連問一聲都沒有。', { b: b.name }, 6); }
        else if (I.fam || I.af >= 25) { addAff(I.a, b, -2); mem(w, I.a, '我病著的時候，{b}一次都沒來過。我知道大家都怕，可是……', { b: b.name }, 5); mem(w, b, '{a}病著，我不敢過去，心裡一直過意不去。', { a: I.a.name }, 4); }
        return I;
    }
    function foodPass(w, b, ctx) { const I = foodInfo(w, b, ctx); if (!I || !I.pass) return null; P(I.X).ask['fd' + I.a.agentId] = day(w); ask(w, [{ a: I.pass, kind: 'calFood', ctx: { s: I.a.agentId, d: day(w), via: b.agentId } }]); mem(w, b, '{a}病著，我不敢自己去，託{c}幫忙送飯。', { a: I.a.name, c: I.pass.name }, 4); return I; }

    // ---------- 疫苗：打不打由本人決定，醫生一天打得完的人數照舊（還沒打的人的三成），想打的人排隊 ----------
    // 一個人最多問三次（說「再等等」的三天後再問）；說不打的不再問。小孩跟著爸媽：爸媽去打就一起帶去，爸媽不打孩子也不打，爸媽不在鎮上的由大人帶去
    const VAX_WAIT = 3, VAX_ASKS = 3;
    const vxN = (X) => Object.keys(X.vx || {}).length;
    const docOf = (w) => here(w).filter(a => a.job?.key === 'doctor');
    const pious = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) ? FAITH.pietyOf(w, a) : 0; } catch (e) { return 0; } };
    const distrust = (w, X, a) => a.job?.key !== 'doctor' && ((X.scape && w.agents[X.scape]?.job?.key === 'doctor' && aff(a, w.agents[X.scape]) < 0) || docOf(w).some(o => o !== a && aff(a, o) <= -20));
    function vaxDaily(w, X, d) {
        if (!deciding(w, 'calVax')) return false; X.vx = X.vx || {}; const q = X.vq = Array.isArray(X.vq) ? X.vq : []; const A = X.va = (X.va && typeof X.va === 'object') ? X.va : {};
        const ppl = here(w); const elig = ppl.filter(a => !X.st[a.agentId] && !X.vx[a.agentId]); const cap = Math.max(1, Math.round(elig.length * 0.3)); // 以前每天三成的人打到：醫生一天打得完的就這麼多
        // 小孩：爸媽排了就一起排；爸媽都說不打的不排；爸媽不在鎮上的由大人帶去
        for (const k of elig) { if ((k.age ?? 30) >= 16 || q.includes(k.agentId) || A[k.agentId]?.no) continue; const ps = ppl.filter(o => (k._parentNames || []).includes(o.name) && (o.age ?? 30) >= 16);
            if (!ps.length || ps.some(o => q.includes(o.agentId) || X.vx[o.agentId])) q.push(k.agentId); else if (ps.every(o => A[o.agentId]?.at === null)) A[k.agentId] = { n: 0, at: null, no: 1 }; }
        // 先問：還沒想過的、說「再等等」到期的（最有關係的先：家裡死過人、家裡有人病、老人、醫生）
        const rel = (a) => ((X.bereaved || []).includes(a.agentId) ? 3 : 0) + (kin(w, a).some(f => sickI(X, f)) ? 2 : 0) + ((a.age ?? 30) >= 60 ? 1.5 : 0) + (a.job?.key === 'doctor' ? 4 : 0) + Math.random();
        const want = elig.filter(a => (a.age ?? 30) >= 16 && !q.includes(a.agentId) && (!A[a.agentId] || (A[a.agentId].at != null && A[a.agentId].at <= d && A[a.agentId].n < VAX_ASKS))).map(a => [a, rel(a)]).sort((x, y) => y[1] - x[1]).slice(0, cap + 5).map(x => x[0]);
        for (const a of want) { const r = A[a.agentId] || (A[a.agentId] = { n: 0, at: d }); r.n++; r.at = d + VAX_WAIT; } X.vaAsk = (X.vaAsk || 0) + want.length;
        ask(w, want.map(a => ({ a, kind: 'calVax', ctx: { d } })));
        // 再打：排在前面的先打，一天最多 cap 個
        let n = 0; for (const id of q.slice()) { if (n >= cap) break; q.splice(q.indexOf(id), 1); const a = w.agents[id]; if (!a || a.isDead || X.st[id] || X.vx[id] || !ppl.includes(a)) continue; X.vx[id] = d; n++; }
        X.vxDay = (X.vxDay || 0) + n; if (n && !X.vxDone && elig.length - n <= Math.max(1, ppl.length * 0.05)) X.vxDone = d; // 幾乎都打完了的那一天（新舊對照用）
        return true;
    }
    function vaxInfo(w, a) {
        const X = curX(w); if (!X || !X.vax?.done || !a || X.st[a.agentId] || X.vx?.[a.agentId] || (X.vq || []).includes(a.agentId)) return null; const r = X.va?.[a.agentId];
        const elig = here(w).filter(o => !X.st[o.agentId] && !X.vx?.[o.agentId]).length;
        return { X, n: X.spec.name, shots: vxN(X), pop: here(w).length, sick: nSick(X), died: X.died, asks: r?.n || 1, famSick: kin(w, a).filter(f => sickI(X, f)), lost: (X.bereaved || []).includes(a.agentId), piety: pious(w, a), distrust: distrust(w, X, a), old: (a.age ?? 30) >= 60,
            kids: kin(w, a).filter(k => (k.age ?? 30) < 16 && (k._parentNames || []).includes(a.name) && !X.st[k.agentId] && !X.vx?.[k.agentId]), cap: Math.max(1, Math.round(elig * 0.3)), queue: (X.vq || []).length };
    }
    function vaxBy(w, a, pick) {
        const I = vaxInfo(w, a); if (!I) return null; const X = I.X; const A = X.va = X.va || {}; const r = A[a.agentId] || (A[a.agentId] = { n: 1, at: null }); const q = X.vq = Array.isArray(X.vq) ? X.vq : [];
        if (pick === 'go') { q.push(a.agentId); for (const k of I.kids) if (!q.includes(k.agentId)) { q.push(k.agentId); delete A[k.agentId]; } r.at = null; return { q: q.length, kids: I.kids.length }; }
        if (pick === 'no') { r.at = null; P(X).vaxNo++; for (const k of I.kids) if (!q.includes(k.agentId) && !(k._parentNames || []).some(nm => { const o = here(w).find(x => x.name === nm && x !== a); return o && (q.includes(o.agentId) || X.vx?.[o.agentId]); })) A[k.agentId] = { n: 0, at: null, no: 1 };
            mem(w, a, '大家都去打{n}的疫苗，我不打。', { n: I.n }, 5); return { no: 1 }; }
        r.at = r.n >= VAX_ASKS ? null : day(w) + VAX_WAIT; return { wait: r.at }; // 再等等：三天後再問（問滿三次就不再問）
    }

    // ---------- ⑧ 萬靈藥：有動機的人自己決定賣不賣，買的人自己決定買不買 ----------
    // 流言或恐慌期每天問一個最有動機的人（貪心、缺錢、愛說謊、會說話、做買賣的；同一個人六天內不再問）；決定賣了，再問最可能買的八個人
    const motive = (w, a) => (hasT(a, 'greedy') ? 2 : 0) + (typeof DARK !== 'undefined' && DARK.honesty && DARK.honesty(a) <= 1 ? 1 : 0) + (wal(w, a) < 40 ? 0.7 : 0) + (hasT(a, 'charismatic') ? 0.8 : 0) + (a.job?.key === 'trader' ? 1 : 0);
    function panSellDaily(w, X, d) {
        const p = P(X); if (p.pan?.open && d - p.pan.d >= 1) panClose(w, X, d); // 擺了一天：沒什麼人買就收攤退錢
        if (!X.found || p.pan || !['rumor', 'panic'].includes(X.phase)) return;
        const C = w.calamity; const sold = new Set(C.sold || []);
        const c = adults(w).filter(a => !sickI(X, a) && wal(w, a) >= 20 && !sold.has(a.agentId) && motive(w, a) > 0 && !recent(p, 'pn', a, d, 6)).sort((x, y) => motive(w, y) - motive(w, x))[0]; if (!c) return;
        p.ask['pn' + c.agentId] = d; p.panAsk = (p.panAsk || 0) + 1; ask(w, [{ a: c, kind: 'calPanSell', ctx: { d } }]);
    }
    const panName = (w) => (built(w, 'alchemy_lab') ? '萬靈藥' : '祖傳偏方');
    function panSellInfo(w, a) {
        const X = curX(w); if (!X || !a || !X.found || sickI(X, a)) return null; const p = P(X); if (p.pan) return null; const C = w.calamity;
        return { X, n: X.spec.name, nm: panName(w), c: Math.floor(wal(w, a)), sick: nSick(X), died: X.died, burned: C.hist?.[0]?.pw?.pan === 'fake', motive: motive(w, a), greedy: hasT(a, 'greedy'), liar: typeof DARK !== 'undefined' && DARK.honesty ? DARK.honesty(a) <= 1 : false, poor: wal(w, a) < 40 };
    }
    // 最可能買的人：怕的、上了年紀的、家裡死過人或有人病的、跟賣的人有交情的
    function buyers(w, X, s) { const burned = new Set(w.calamity.burned || []); return adults(w).filter(b => b !== s && !burned.has(b.agentId) && wal(w, b) >= 8).map(b => [b, (hasT(b, 'pessimist') ? 1 : 0) + ((b.age ?? 30) >= 55 ? 1 : 0) + ((X.bereaved || []).includes(b.agentId) ? 1.5 : 0) + (kin(w, b).some(f => sickI(X, f)) ? 1 : 0) + Math.max(0, aff(b, s)) / 40 + Math.random()]).sort((x, y) => y[1] - x[1]).slice(0, 8).map(x => x[0]); }
    function panOpen(w, a) {
        const I = panSellInfo(w, a); if (!I) return null; const p = P(I.X); const d = day(w);
        p.pan = { s: a.agentId, b: [], sum: 0, d, nm: I.nm, steam: built(w, 'alchemy_lab') ? 1 : 0, exp: 0, open: 1 };
        mem(w, a, '我在市集擺了攤賣{x}，說喝了就不會染上。', { x: I.nm }, 5);
        log(w, '🧴 {s}在市集擺了個攤賣「{x}」，說喝了就不會染上{n}。', { s: a.name, x: I.nm, n: I.n }, a.name);
        const list = buyers(w, I.X, a).map(b => ({ a: b, kind: 'calPanBuy', ctx: { s: a.agentId, d } })); p.panAsked = (p.panAsked || 0) + list.length;
        ask(w, list); // 在賣的人選的那一項裡時排進佇列（這一輪處理完就輪到），不然當場問
        return { n: list.length };
    }
    function panBuyInfo(w, b, ctx) {
        const X = curX(w); const p = X ? P(X) : null; const pn = p?.pan; const s = pn ? w.agents[pn.s] : null; if (!pn || !pn.open || !s || s.isDead || !ctx || ctx.s !== pn.s || b === s || pn.b.some(([id]) => id === b.agentId)) return null;
        const n = Math.max(5, Math.min(20, Math.round(wal(w, b) * 0.15))); if (wal(w, b) < n) return null;
        return { X, pn, s, n, nm: pn.nm, dis: X.spec.name, c: Math.floor(wal(w, b)), tie: tie(w, b, s), af: aff(b, s), sick: nSick(X), died: X.died, lost: (X.bereaved || []).includes(b.agentId), famSick: kin(w, b).filter(f => sickI(X, f)), others: pn.b.length };
    }
    function panBuy(w, b, ctx) {
        const I = panBuyInfo(w, b, ctx); if (!I) return null; if (!WALLET.pay(w, b, I.s, I.n, t(I.nm))) return null;
        I.pn.b.push([b.agentId, I.n]); I.pn.sum += I.n; mem(w, b, '花了 {n} 銀幣跟{s}買了{x}，說喝了就不會染上。', { n: I.n, s: I.s.name, x: I.nm }, 5); return I;
    }
    function panClose(w, X, d) {
        const p = P(X); const pn = p.pan; if (!pn?.open) return; pn.open = 0; const s = w.agents[pn.s];
        if (pn.b.length < 2 || !s) { for (const [id, n] of pn.b) { const b = w.agents[id]; if (b && s) WALLET.pay(w, s, b, n, t('退錢')); } p.pan = null; if (s) mem(w, s, '擺了一天攤，{x}沒什麼人買，錢退回去了。', { x: pn.nm }, 4); return; } // 沒什麼人買,錢退回去
        mem(w, s, '這陣子賣{x}賺了 {n} 銀幣。', { x: pn.nm, n: pn.sum }, 5);
        log(w, '🧴 {s}在市集擺攤賣「{x}」，說喝了就不會染上{n}。{k} 個人掏錢買了，一共 {m} 銀幣。', { s: s.name, x: pn.nm, n: X.spec.name, k: pn.b.length, m: pn.sum }, s.name);
    }
    // 被拆穿以後退不退錢（ctx.b：買的人和各付了多少）
    function refundBy(w, s, ctx, frac) {
        const W = ways(); const bs = (ctx?.b || []).map(([id, n]) => [w.agents[id], n]).filter(([b]) => b && !b.isDead); let back = 0;
        for (const [b, n] of bs) { const m = Math.min(Math.round(n * frac), Math.floor(wal(w, s))); if (m > 0 && WALLET.pay(w, s, b, m, t('退錢'))) back += m; }
        const X = curX(w); if (X) { const p = P(X); if (p.pan) p.pan.back = back; p.back += back; }
        if (back > 0) { if (W) W.setFace(w, s, W.faceOf(w, s) + (frac >= 1 ? 8 : 3)); log(w, frac >= 1 ? '💸 {s}被罵到受不了，把 {n} 銀幣一一退給大家。' : '💸 {s}被罵了好幾天，退了一半的錢，一共 {n} 銀幣。', { s: s.name, n: back }, s.name); }
        return { back, n: bs.length };
    }
    function refundNo(w, s, ctx) { const W = ways(); const bs = (ctx?.b || []).map(([id, n]) => [w.agents[id], n]).filter(([b]) => b && !b.isDead).sort((x, y) => y[1] - x[1]); if (W && bs.length) W.quarrel(w, bs[0][0], s); if (W) W.loseFace(w, s, 5); log(w, '😤 {s}不肯退錢：「藥是好藥，是你們自己身子虛。」', { s: s.name }, s.name); return { angry: bs[0]?.[0] || null }; }
    // ⑤ 被追問的人：認錯、嘴硬、躲著不說話
    function stubBy(w, a, ctx, pick) {
        const X = curX(w); const W = ways(); const prop = ctx?.by ? w.agents[ctx.by] : null; const p = X ? P(X) : null; const ttl = ctx?.t || '';
        if (pick === 'admit') { if (p) p.admit++; if (prop) addAff(prop, a, 3); log(w, '😔 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}低著頭說：「早知道就該聽{b}的。」', { t: ttl, n: ctx.n, a: a.name, b: prop?.name || t('醫生') }, a.name); return 'admit'; }
        if (pick === 'stub') { if (p) p.stub++; for (const b of adults(w).filter(x => x !== a && Math.random() < 0.2)) addAff(b, a, -2); log(w, '😤 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}還是說：「人本來就會死，跟那個有什麼關係。」', { t: ttl, n: ctx.n, a: a.name }, a.name); return 'stub'; }
        if (W) W.loseFace(w, a, 2); mem(w, a, '「{t}」被否決之後又走了 {n} 個人。大家問起來，我只能低頭走開。', { t: ttl, n: ctx.n }, 6); return 'quiet';
    }
    // ⑥ 怪過他的人：道歉、不說話、照樣怪
    function sorryBy(w, a, ctx, pick) {
        const sc = w.agents[ctx?.sc]; if (!sc || sc.isDead) return null; const W = ways(); const X = curX(w); const p = X ? P(X) : null; const C = w.calamity; C.pw7 = C.pw7 || { sorry: 0, grudge: 0 };
        if (pick === 'sorry') { addAff(a, sc, 6); addAff(sc, a, 3); if (p) p.sorry++; C.pw7.sorry++; log(w, '🙇 {n}過去之後，{a}跑去跟{x}道歉：「那時候不該怪你。」', { n: ctx.n, a: a.name, x: sc.name }, a.name, sc.name); mem(w, sc, '{a}來跟我道歉了，說那時候不該怪我。', { a: a.name }, 6); return 'sorry'; }
        if (pick === 'still') { if (p) p.grudge++; C.pw7.grudge++; mem(w, sc, '到現在{a}還把{n}算在我頭上。', { a: a.name, n: ctx.n }, 7); if (W) W.quarrel(w, a, sc); return 'still'; }
        mem(w, a, '{n}的時候我也怪過{x}，現在想想有點過意不去，可是開不了口。', { n: ctx.n, x: sc.name }, 4); return 'quiet';
    }

    // ---------- 有錢人逃不逃（恐慌期；以前最有錢的四分之一每天 4%，一天最多兩個） ----------
    // 每人六天問一次，一天最多問三個；照「以前一段時間裡大概有多少機會走」算傾向
    const FLEE_GAP = 6, FLEE_MAX = 3;
    function fleeAsk(w, X, d, rich) {
        if (!deciding(w, 'calFlee')) return false; const p = P(X);
        const c = rich.filter(a => !recent(p, 'fl', a, d, FLEE_GAP)).sort(() => Math.random() - 0.5).slice(0, FLEE_MAX); const span = Math.max(FLEE_GAP, rich.length / FLEE_MAX);
        for (const a of c) p.ask['fl' + a.agentId] = d; ask(w, c.map(a => ({ a, kind: 'calFlee', ctx: { src: 'plague', t: 'plague', d, q: Math.round(within(0.04, span) * 1000) / 1000 } })));
        return true;
    }

    // ---------- 每天 ----------
    H.pre = (w, X, d) => { stayDaily(w, X, d); sneakDaily(w, X, d); };
    H.vax = (w, X, d) => vaxDaily(w, X, d); // v11.7.0 疫苗做出來以後，打不打由本人決定（sim-calamity.js 的 vaxDaily 先問這裡）
    H.flee = (w, X, d, rich) => fleeAsk(w, X, d, rich); // v11.7.0 有錢人走不走 // 傳染之前先決定今天誰待在家、誰偷溜
    H.daily = (w, X, d) => {
        const p = P(X); if (!p.L0 && X.found) { // 剛發現時:想起上一場疫情
            p.L0 = 1; const { L, calm, h } = lessonOf(w, X); p.L = L;
            if (L >= 0.3 && h) log(w, '📖 老一輩想起{p}那年，{d} 個人走了——這次大家一聽到有人發燒就緊張起來。', { p: h.name, d: h.died });
            else if (calm && h) { p.calm = 1; log(w, '😌 「上次{p}不也沒事？」大家都沒太當一回事。', { p: h.name }); }
        }
        traceDaily(w, X, d); foodDaily(w, X, d); stubDaily(w, X, d); panaceaDaily(w, X, d); panaceaCheck(w, X, d, false);
        // 煤煙讓咳嗽更嚴重(一場疫情最多說一次)
        if (!p.said.smog && (w.tech?.steam?.smog || 0) >= 30 && X.spec.sym.includes('cough')) { const a = rnd(here(w).filter(x => sickI(X, x))); if (a) { p.said.smog = 1; log(w, '🌫️ 煤煙加上{n}，{a}咳得整條街都聽得到。', { n: X.spec.name, a: a.name }, a.name); } }
    };
    H.die.push((w, X, a) => {
        const p = P(X); const d = day(w); p.fear = d; p.deaths.push(d); if (p.deaths.length > 40) p.deaths = p.deaths.slice(-40);
        const r = ways()?.S?.(w)?.rt?.[a.agentId]; if (r) { p.lost.push({ id: a.agentId, n: a.name, s: r.s, t: r.t }); if (p.lost.length > 12) p.lost = p.lost.slice(-12); }
    });

    // ---------- 疫情過去 ----------
    H.end.push((w, X, rec) => {
        const p = P(X); const d = day(w); const W = ways();
        rec.ppl = here(w).map(a => a.agentId).slice(0, 150); for (const h of (w.calamity.hist || [])) delete h.ppl; // 只有最近一場記得誰經歷過
        if (p.pan?.open) panClose(w, X, d); // v11.7.0 疫情過去時還擺著的攤子先收
        rec.ms = Object.keys(X.ms); rec.pw = { sneak: p.sneak, caught: p.caught, food: p.food, pan: p.pan ? (p.pan.exp > 0 ? 'fake' : 'fan') : null };
        panaceaCheck(w, X, d, true);
        if (W) { const X8 = W.S(w); X8.hyp = (X8.hyp || []).filter(h => !(/^cal_/.test(h.k || '') && !h.exp)); } // 疫情過去,沒被抓到的偷溜大家也不追究了
        // ⑥ 怪罪與平反
        const sc = X.scape && w.agents[X.scape]; if (sc && !sc.isDead) {
            const blamers = adults(w).filter(a => a !== sc && aff(a, sc) < 0).sort((x, y) => aff(x, sc) - aff(y, sc));
            if (deciding(w, 'calSorry') && blamers.length) { const who = [...new Set([blamers[0], ...blamers.slice(-2).reverse()])]; ask(w, who.map(a => ({ a, kind: 'calSorry', ctx: { sc: sc.agentId, n: X.spec.name, d } }))); } // v11.7.0 怪過他的人自己決定道不道歉（最怪他的那一位、和怪得最輕的兩位）
            else if (Math.random() < 0.55 && blamers.length) { const who = blamers.slice(-3); for (const a of who) { addAff(a, sc, 6); addAff(sc, a, 3); } p.sorry++; log(w, '🙇 {n}過去之後，{a}跑去跟{x}道歉：「那時候不該怪你。」', { n: X.spec.name, a: who[0].name, x: sc.name }, who[0].name, sc.name); mem(w, sc, '{a}來跟我道歉了，說那時候不該怪我。', { a: who[0].name }, 6); }
            else if (blamers[0] && W) { p.grudge++; mem(w, sc, '到現在{a}還把{n}算在我頭上。', { a: blamers[0].name, n: X.spec.name }, 7); W.quarrel(w, blamers[0], sc); }
        }
        // ① 老地方重新熱鬧、空位子
        if (W) {
            const g = {}; for (const a of adults(w)) { const r = W.routineOf(w, a); if (r) (g[r.s + ':' + r.t] || (g[r.s + ':' + r.t] = [])).push(a); }
            const big = Object.entries(g).sort((x, y) => y[1].length - x[1].length)[0];
            if (big && big[1].length >= 2) { const [spot, slot] = big[0].split(':'); const [a, b] = big[1]; for (let i = 0; i < Math.min(big[1].length, 6); i++) for (let j = i + 1; j < Math.min(big[1].length, 6); j++) { addAff(big[1][i], big[1][j], 3); addAff(big[1][j], big[1][i], 3); }
                log(w, '🍻 {n}過去後的第一個{slot}，{spot}又熱鬧起來，{a}和{b}點頭點了好久。', { n: X.spec.name, slot: SLOT_NAME[slot], spot: SPOT_NAME[spot], a: a.name, b: b.name }, a.name, b.name); }
            for (const L of p.lost.slice(-2)) { const mate = (g[L.s + ':' + L.t] || [])[0]; if (!mate) continue; mem(w, mate, '每天{slot}去{spot}，{b}常坐的那個位子一直空著。', { slot: SLOT_NAME[L.t], spot: SPOT_NAME[L.s], b: L.n }, 7); log(w, '🪑 {a}還是每天{slot}去{spot}，旁邊{b}常坐的位子空著。', { a: mate.name, slot: SLOT_NAME[L.t], spot: SPOT_NAME[L.s], b: L.n }, mate.name); }
        }
    });

    // ---------- ⑦ 週年:死過人的疫情,三年內每年點蠟燭 ----------
    function anniv(w) {
        const C = w?.calamity; if (!C?.hist?.length) return; const d = day(w);
        for (const h of C.hist) { if (!h.died || h.end == null) continue; const y = Math.round((d - h.end) / 360); if (y < 1 || y > 3 || d - h.end !== y * 360) continue;
            const W = ways(); const spot = W ? (() => { const c = {}; for (const a of adults(w)) { const r = W.routineOf(w, a); if (r) c[r.s] = (c[r.s] || 0) + 1; } return Object.entries(c).sort((x, z) => z[1] - x[1])[0]?.[0]; })() : null;
            log(w, '🕯️ {n}過去 {y} 年了。傍晚，鎮上的人在{spot}點了 {d} 根蠟燭。', { n: h.name, y, spot: SPOT_NAME[spot] || '廣場', d: h.died });
            for (const a of adults(w)) if (h.ppl?.includes?.(a.agentId) || y === 1) a.moodModifier = (a.moodModifier || 0) - 1; }
    }

    // ---------- 給介面、AI ----------
    function view(w) {
        const X = w?.calamity?.cur; const out = { lesson: null, cur: null };
        const l = lessonOf(w, X || null); if (l.h) out.lesson = { name: l.h.name, died: l.h.died, L: l.L, calm: l.calm, ago: Math.max(0, day(w) - l.h.end) };
        if (X) { const p = P(X); out.cur = { fatigue: Math.round(fatigue(w, X) * 10) / 10, sneak: p.sneak, caught: p.caught, traced: p.traced, food: p.food, stay: Object.keys(p.home).length, admit: p.admit, stub: p.stub, sorry: p.sorry, grudge: p.grudge,
            pan: p.pan ? { name: p.pan.nm, seller: w.agents[p.pan.s]?.name || '', n: p.pan.b.length, sum: p.pan.sum, exp: p.pan.exp > 0, back: p.pan.back || 0 } : null,
            sneakers: Object.keys(p.hyp).map(id => w.agents[id]?.name).filter(Boolean).slice(0, 6) }; }
        return out;
    }
    const _brief = C0.brief; C0.brief = function (w, a) {
        const b = _brief.call(this, w, a); if (b) return b; const X = w?.calamity?.cur; if (!X) return ''; const p = P(X);
        if (p.hyp[a.agentId]) return t('防疫規定我投了贊成，自己卻偷偷沒守');
        if (p.home[a.agentId] > day(w)) return t('怕被傳染，這幾天都待在家裡');
        if (p.pan && p.pan.s === a.agentId) return fillT('我這陣子在賣{x}', { x: p.pan.nm });
        return '';
    };
    const fillT = (k, p) => { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof y === 'string' ? t(y) : y); return s; };
    const _tb = C0.townBrief; C0.townBrief = function (w) {
        let s = _tb.call(this, w); const X = w?.calamity?.cur; if (!X?.found) return s; const p = P(X); const l = lessonOf(w, X); const add = [];
        if (l.L >= 0.3 && l.h) add.push(fillT('大家還記得{p}那年死了 {d} 個人，這次特別小心', { p: l.h.name, d: l.h.died }));
        if (fatigue(w, X) >= 2) add.push(t('規定實施太久，越來越多人偷偷不守'));
        if (p.pan && !p.pan.exp) add.push(fillT('{s}在賣{x}', { s: w.agents[p.pan.s]?.name || '', x: p.pan.nm }));
        return add.length ? `${s}${t('；')}${add.join(t('；'))}` : s;
    };
    const _view = C0.view; C0.view = function (w) { const v = _view.call(this, w); try { v.ways = view(w); } catch (e) {} return v; };

    return { P, lessonOf, fatigue, view, anniv, caught, sneakInfo, sneakBy, H, kin, tie, stayInfo, stayBy, foodInfo, feedBy, foodNo, foodPass, vaxInfo, vaxBy, panSellInfo, panOpen, panBuyInfo, panBuy, panClose, refundBy, refundNo, stubBy, sorryBy, STAY_GAP, FOOD_DAYS, _t: { stayDaily, sneakDaily, traceDaily, foodDaily, stubDaily, panaceaDaily, panaceaCheck, vaxDaily, fleeAsk } };
})();
if (PLAGUEWAYS && typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _d = PS.daily;
    PS.daily = function (w, ...rest) { const r = _d.call(this, w, ...rest); try { if (w.observerMode) PLAGUEWAYS.anniv(w); } catch (e) { console.warn('[PlagueWays] anniv', e); } return r; };
}
if (typeof window !== 'undefined') window.PLAGUEWAYS = PLAGUEWAYS;
