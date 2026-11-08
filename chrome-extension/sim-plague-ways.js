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
        const p = X.pw || (X.pw = {}); for (const k of ['brk', 'home', 'hyp', 'said', 'cd']) if (!p[k] || typeof p[k] !== 'object') p[k] = {};
        for (const k of ['sneak', 'caught', 'traced', 'food', 'stay', 'admit', 'stub', 'sorry', 'grudge']) p[k] = p[k] || 0; p.deaths = p.deaths || []; p.lost = p.lost || []; return p;
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
    function sneakDaily(w, X, d) {
        const p = P(X); const ks = active(X); if (!ks.length) return; const f = fatigue(w, X);
        const guard = here(w).some(a => a.job?.key === 'guard');
        for (const a of adults(w)) {
            if (p.home[a.agentId] > d) continue;
            const sick = sickI(X, a); let k = null, base = 0;
            if (sick && X.ms.quar) { k = 'quar'; base = hasT(a, 'pessimist') || hasT(a, 'kind') ? 0.005 : 0.02; }
            else if (!sick && X.ms.lock && a.job?.key === 'trader') { k = 'lock'; base = 0.04; }
            else if (!sick && X.ms.close) { const r = ways()?.routineOf?.(w, a); k = 'close'; base = (r && (r.s === 'tavern' || r.s === 'market') ? 0.02 : 0.006) + (hasT(a, 'glutton') || hasT(a, 'charismatic') ? 0.03 : 0); }
            else if (!sick && X.ms.mask) { k = 'mask'; base = 0.01; }
            if (!k) continue;
            if (hasT(a, 'lazy')) base += 0.02; if (hasV(a, '自由')) base += 0.02; if (hasT(a, 'pessimist')) base *= 0.4; if (a.job?.key === 'doctor') base *= 0.2;
            if (Math.random() >= Math.min(0.25, base * f)) continue;
            p.brk[a.agentId] = d; p.sneak++;
            // 投贊成票還偷溜:說一套做一套(v8.1)
            const vp = votedFor(w, X, a, k); const W = ways();
            if (vp && W && !p.hyp[a.agentId]) { const X8 = W.S(w); let title = vp.id; try { title = w.proposals.title(vp); } catch (e) {} const h = { a: a.agentId, k: 'cal_' + k, t: title, d }; X8.hyp.push(h); if (X8.hyp.length > 12) X8.hyp = X8.hyp.slice(-12); p.hyp[a.agentId] = 1; mem(w, a, '「{t}」我是投了贊成，不過……就這一次，沒人看見。', { t: title }, 4); }
            // 被抓:有衛兵的話機會大一點
            if (Math.random() < (guard ? 0.06 : 0.04)) caught(w, X, a, k, d, false);
        }
        // 太久以前的紀錄清掉
        for (const [id, v] of Object.entries(p.brk)) if (d - v > 8) delete p.brk[id];
    }
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
            const admit = hasT(a, 'kind') || hasT(a, 'honest') || (typeof DARK !== 'undefined' && DARK.honesty && DARK.honesty(a) >= 2);
            if (admit) { p.admit++; if (prop) addAff(prop, a, 3); log(w, '😔 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}低著頭說：「早知道就該聽{b}的。」', { t: title, n: after, a: a.name, b: prop?.name || t('醫生') }, a.name); }
            else { p.stub++; for (const b of adults(w).filter(x => x !== a && Math.random() < 0.2)) addAff(b, a, -2); log(w, '😤 「{t}」被否決之後又走了 {n} 個人。當初投反對的{a}還是說：「人本來就會死，跟那個有什麼關係。」', { t: title, n: after, a: a.name }, a.name); }
        }
    }

    // ---------- ⑧ 萬靈藥 ----------
    function panaceaDaily(w, X, d) {
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
        const p = P(X); const pn = p.pan; if (!pn || pn.exp) return; const s = w.agents[pn.s]; if (!s) { pn.exp = d; return; }
        const hit = pn.b.map(([id]) => w.agents[id]).find(b => b && (b.isDead || sickI(X, b)));
        if (!hit) { if (atEnd) { pn.exp = -1; const fan = pn.b.map(([id]) => w.agents[id]).find(b => b && !b.isDead); if (fan) log(w, '🧴 {a}逢人就說：「還好我有喝{s}的{x}，才沒染上。」', { a: fan.name, s: s.name, x: pn.nm }, fan.name); } return; }
        pn.exp = d; const W = ways(); const stuff = pn.steam ? '糖水加一點煤灰' : '泡過的樹皮水';
        log(w, '🧴 喝了「{x}」的{a}還是病倒了。大家這才知道，{s}賣的只是{y}。', { x: pn.nm, a: hit.name, s: s.name, y: stuff }, s.name, hit.name);
        news(w, '🧴 「{x}」是假的：{s}賣的只是{y}', { x: pn.nm, s: s.name, y: stuff }, 7, [s.name]);
        if (W) { W.loseFace(w, s, 20); const X8 = W.S(w); X8.trust = Math.max(20, X8.trust - 2); }
        const bs = pn.b.map(([id, n]) => [w.agents[id], n]).filter(([b]) => b && !b.isDead);
        for (const [b] of bs) { addAff(b, s, -10); mem(w, b, '被{s}的{x}騙了，下次再也不買這種東西。', { s: s.name, x: pn.nm }, 7); }
        const C = w.calamity; C.burned = [...new Set([...(C.burned || []), ...bs.map(([b]) => b.agentId)])].slice(-40); C.sold = [...new Set([...(C.sold || []), s.agentId])].slice(-10);
        if (!s.isDead && (hasT(s, 'kind') || Math.random() < 0.4)) { // 被罵到受不了,把錢退回去
            let back = 0; for (const [b, n] of bs) { const m = Math.min(n, wal(w, s)); if (m > 0 && WALLET.pay(w, s, b, m, t('退錢'))) back += m; } pn.back = back;
            if (back > 0) { if (W) W.setFace(w, s, W.faceOf(w, s) + 8); log(w, '💸 {s}被罵到受不了，把 {n} 銀幣一一退給大家。', { s: s.name, n: back }, s.name); }
        } else if (W && bs.length) { const angry = bs.sort((x, y) => y[1] - x[1])[0][0]; W.quarrel(w, angry, s); }
    }

    // ---------- 每天 ----------
    H.pre = (w, X, d) => { stayDaily(w, X, d); sneakDaily(w, X, d); }; // 傳染之前先決定今天誰待在家、誰偷溜
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
        rec.ms = Object.keys(X.ms); rec.pw = { sneak: p.sneak, caught: p.caught, food: p.food, pan: p.pan ? (p.pan.exp > 0 ? 'fake' : 'fan') : null };
        panaceaCheck(w, X, d, true);
        if (W) { const X8 = W.S(w); X8.hyp = (X8.hyp || []).filter(h => !(/^cal_/.test(h.k || '') && !h.exp)); } // 疫情過去,沒被抓到的偷溜大家也不追究了
        // ⑥ 怪罪與平反
        const sc = X.scape && w.agents[X.scape]; if (sc && !sc.isDead) {
            const blamers = adults(w).filter(a => a !== sc && aff(a, sc) < 0).sort((x, y) => aff(x, sc) - aff(y, sc));
            if (Math.random() < 0.55 && blamers.length) { const who = blamers.slice(-3); for (const a of who) { addAff(a, sc, 6); addAff(sc, a, 3); } p.sorry++; log(w, '🙇 {n}過去之後，{a}跑去跟{x}道歉：「那時候不該怪你。」', { n: X.spec.name, a: who[0].name, x: sc.name }, who[0].name, sc.name); mem(w, sc, '{a}來跟我道歉了，說那時候不該怪我。', { a: who[0].name }, 6); }
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

    return { P, lessonOf, fatigue, view, anniv, caught, H, _t: { stayDaily, sneakDaily, traceDaily, foodDaily, stubDaily, panaceaDaily, panaceaCheck } };
})();
if (PLAGUEWAYS && typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _d = PS.daily;
    PS.daily = function (w, ...rest) { const r = _d.call(this, w, ...rest); try { if (w.observerMode) PLAGUEWAYS.anniv(w); } catch (e) { console.warn('[PlagueWays] anniv', e); } return r; };
}
if (typeof window !== 'undefined') window.PLAGUEWAYS = PLAGUEWAYS;
