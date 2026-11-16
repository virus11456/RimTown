// RimTown - sim-day.js：v11.2.0 一天怎麼過，由本人決定
// 以前：幾點睡、幾點上工、下班去哪，全照鐘點的規則走（sim-agent.js 的 _decideActivity）。有工作的人上工時間一定在工作地點，
//       沒有喝醉、沒有喝太晚、沒有翹班；每天的產出和工資照「有這份工作」算，不看人有沒有到。
// 現在：一天裡要拿主意的地方交給本人（決策核心 sim-decide.js；開智能體由 AI 選，沒開照個性與處境算傾向，選項相同）：
//   今天去不去上工(workday)      照常／晚點到／請一天假／裝病請假／不說一聲就不去     ← 有理由才會問：宿醉、沒睡飽、心情很差、身體不舒服、
//                                                                              跟朋友約好、鎮上有節慶、工資被壓、親人剛走、本來就懶
//   今晚怎麼過(evening)          沒特別安排／早點睡／找某人吃飯／去酒館喝幾杯／自己待著／陪家人／留下來多做一點
//   酒館裡，要不要再喝(lastcall)  回家／再喝幾杯／喝到關門                           ← 喝多了隔天宿醉
//   要不要約他明天溜出去(planout)  不約／約他明天上工時間出去                         ← 晚上跟好朋友在一起時才會想到
//   朋友約你明天翹班(outing)      好，一起去／上工不行，放工後吧／不要，你也別翹
//   夥計沒來上工(noshow)          算了／當面訓一頓／扣工資／開除                     ← 東家（公職是首長）決定
// 這裡負責：把決定變成人真的去哪裡（steer）、出勤連到產出與工資（workMult、noPay）、宿醉、請病假被撞見、約好的人來不來。
// 意外仍然是運氣（宿醉的人想去上工卻睡過頭）；要不要做是本人選的。銀幣守恆：酒錢付給酒館的東家（沒有東家就進公庫），罰的工資付給東家。
// 必須在 sim-decide.js 之後載入。
'use strict';

const DAY = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && inTown(w, a));
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const wage = (a) => { try { return typeof WALLET !== 'undefined' ? (WALLET.wageOf(a) || 4) : 4; } catch (e) { return 4; } };
    const P = (w) => { try { return typeof INFL !== 'undefined' ? INFL.p(w) : 1; } catch (e) { return 1; } };
    const r2 = (n) => Math.round(n * 100) / 100;
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5, who = []) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'daily', k, p || {}, imp, who); } catch (e) {} };
    const on = (w) => !!(w && typeof DECIDE !== 'undefined' && DECIDE.on(w));
    const SPOT = { park: '公園', town_square: '廣場', tavern: '酒館', library: '圖書館', forest: '森林', graveyard: '墓園', home: '家裡' };
    const CUP = 1.5; // 一杯酒的價錢（照物價調整）
    const ST0 = { asked: 0, go: 0, late: 0, leave: 0, sick: 0, skip: 0, overslept: 0, drink: 0, more: 0, close: 0, hang1: 0, hang2: 0, meal: 0, pact: 0, pactKept: 0, pactBroken: 0, caught: 0, scold: 0, dock: 0, fire: 0, let: 0, brawl: 0, hosp: 0, free: 0, planLed: 0, invite: 0, inviteNo: 0 };

    function S(w) {
        if (!w.dayx || typeof w.dayx !== 'object') w.dayx = {};
        const X = w.dayx; for (const k of ['t', 'y', 'hang', 'pact', 'rec', 'warn', 'inv']) X[k] = X[k] && typeof X[k] === 'object' ? X[k] : {};
        X.st = Object.assign({}, ST0, X.st || {}); if (X.d == null) X.d = day(w); return X;
    }
    const rec = (w, a) => { const X = S(w); return X.t[a.agentId] || (X.t[a.agentId] = {}); };
    const bedOf = (a) => (has(a, 'night_owl') ? 26 : has(a, 'early_bird') ? 20 : 22);
    const eveOf = (a) => (a.job ? Math.max(15, a.job.workHours[1]) : 17);
    const hangOf = (w, a) => { const X = S(w); const g = X.hang[a.agentId]; return g && g.d === X.d ? g.lv : 0; };
    const strikes = (w, a) => { const X = S(w); const d = day(w); const L = (X.rec[a.agentId] || []).filter(x => d - x <= 30); X.rec[a.agentId] = L; return L.length; };
    const ill = (w, a) => { try { return typeof HEALTH !== 'undefined' && w.health ? Math.max(0, ...(HEALTH.ails(w, a) || []).map(x => x.s || 0)) : 0; } catch (e) { return 0; } };

    // 這個人的東家：私人產業是老闆（對手店的夥計是對手老闆），公職是首長；自己當家、找不到人 → 沒有
    function bossOf(w, a) {
        if (!a?.job) return null; let b = null;
        try {
            if (typeof MARKET !== 'undefined' && w.market) {
                const k = MARKET.JOB2S[a.job.key];
                if (k) { const R = MARKET.rivalOf(w, k); const id = (R && R.emp?.[a.agentId]) ? R.owner : MARKET.ownerOf(w, k); b = id ? w.agents[id] : null; }
            }
            if (!b) b = w.election?.currentMayor?.(w) || null;
        } catch (e) {}
        return b && b !== a && inTown(w, b) ? b : null;
    }
    const works = (w, a) => { // 今天本來該上工的人
        if (!a?.job || !Array.isArray(a.job.workHours)) return false; const d = day(w);
        if (w.civic?.jail?.[a.agentId] > d || a.status === 'hospitalized') return false;
        try { if (typeof MARKET !== 'undefined' && w.market && MARKET.onStrike(w, a)) return false; } catch (e) {}
        return ill(w, a) < 2;
    };

    // ================= 今天有什麼事讓他不想上工 =================
    function reasons(w, a) {
        const X = S(w), out = [], hg = hangOf(w, a);
        if (hg >= 2) out.push({ k: 'hang2', s: '昨晚喝到很晚，現在頭痛得厲害。' }); else if (hg === 1) out.push({ k: 'hang1', s: '昨晚多喝了幾杯，頭有點沉。' });
        if ((a.needs?.rest ?? 100) < 30) out.push({ k: 'tired', s: '沒睡飽，全身沒力。' });
        if ((a.mood ?? 50) < 30) out.push({ k: 'low', s: '這陣子心情很差，什麼都提不起勁。' });
        if (ill(w, a) === 1) out.push({ k: 'ill', s: '身體有點不舒服。' });
        const pc = X.pact[a.agentId]; const pb = pc && pc.d === X.d ? w.agents[pc.with] : null;
        if (pb && inTown(w, pb)) out.push({ k: 'pact', s: { k: '昨天跟{b}約好，今天上工時間溜去{spot}。', p: { b: pb.name, spot: SPOT[pc.spot] || '廣場' } }, b: pb, spot: pc.spot });
        const fest = w.festivals?.activeFestival; if (fest?.name && (DECIDE.lean(w, a).joy >= 1.5 || hasV(a, '傳統') || hasV(a, '社群'))) out.push({ k: 'fest', s: { k: '今天鎮上有{f}。', p: { f: fest.name } } });
        try {
            const k = typeof MARKET !== 'undefined' && w.market ? MARKET.JOB2S[a.job?.key] : null;
            if (k && MARKET.privatePaid(w, a) && MARKET.payRate(w, k) < 0.75) out.push({ k: 'sour', s: '東家把工資壓得很低，做得很不甘願。' });
            else if (!k && (w.wallet?.unpaid || 0) > 0) out.push({ k: 'sour', s: '公庫上次沒發足薪水。' });
        } catch (e) {}
        const gone = (a._mourningTargets || [])[0]; if (gone) out.push({ k: 'grief', s: { k: '{n}剛走，心裡放不下。', p: { n: gone.name || gone } } });
        if (has(a, 'lazy') && ((a.mood ?? 50) < 40 || (a.needs?.rest ?? 100) < 40 || (w.weather?.moodModifier || 0) <= -5)) out.push({ k: 'lazy', s: '本來就不愛做事，今天特別不想動。' });
        return out;
    }
    const whyHas = (ctx, k) => (ctx?.why || []).includes(k);

    // ================= 結算：決定變成今天的安排 =================
    function setWork(w, a, how, ctx) {
        const X = S(w), r = rec(w, a); if (r.work) return null; const hg = hangOf(w, a); const [ws] = a.job.workHours;
        // 意外：宿醉的人想照常去，還是可能睡過頭
        if (how === 'go' && hg && Math.random() < (hg >= 2 ? 0.35 : 0.1)) { r.work = 'late'; r.hang = hg; r.acc = 1; X.st.overslept++; X.st.late++; mem(w, a, '明明想照常去上工，一睜眼太陽已經老高，遲到了。', {}, 4); return { k: '想照常去，結果睡過頭，晚了兩個鐘頭才到' }; }
        r.work = how; r.hang = hg; X.st[how] = (X.st[how] || 0) + 1;
        const pc = X.pact[a.agentId]; const pb = pc && pc.d === X.d ? w.agents[pc.with] : null;
        if (how === 'go') return pb ? { k: '還是去上工了，沒去赴{b}的約', p: { b: pb.name } } : { k: '撐著去上工' };
        if (how === 'late') { mem(w, a, hg ? '頭太痛了，多躺了兩個鐘頭才去上工。' : '實在爬不起來，晚了兩個鐘頭才去上工。', {}, 3); return { k: '晚了兩個鐘頭才到' }; }
        r.bed = hg >= 2 ? 3 : (hg || (a.needs?.rest ?? 100) < 30) ? 1 : 0;
        if (how === 'leave') {
            r.spot = whyHas(ctx, 'grief') ? 'graveyard' : (hg || whyHas(ctx, 'ill') || whyHas(ctx, 'tired')) ? 'home' : whyHas(ctx, 'fest') ? 'town_square' : rnd(['park', 'town_square', 'home']);
            mem(w, a, '今天跟東家說了一聲，請了一天假，沒有工資。', {}, 4); return { k: '請了一天假，這一天沒有工資' };
        }
        const out = pb && inTown(w, pb) ? pc.spot : has(a, 'glutton') || has(a, 'charismatic') ? 'tavern' : has(a, 'curious') ? 'library' : whyHas(ctx, 'fest') ? 'town_square' : rnd(['park', 'town_square', 'forest']);
        if (how === 'sick') { r.spot = (has(a, 'shy') || has(a, 'neurotic')) ? 'home' : out; r.homeTill = ws + 3; mem(w, a, '今天跟東家說身體不舒服，其實是不想去上工。', {}, 5); return { k: '說自己病了，請了一天假' }; }
        r.spot = out; if (pb) r.with = pb.agentId; (X.rec[a.agentId] || (X.rec[a.agentId] = [])).push(day(w));
        mem(w, a, '今天沒去上工，也沒跟東家說。', {}, 5); return { k: '沒去上工，也沒說一聲；這一天沒有工資' };
    }
    function setEve(w, a, how, o) {
        const X = S(w), r = rec(w, a); if (r.eve) return null; r.eve = how; const e0 = eveOf(a);
        if (how === 'meal' && o) {
            const ro = rec(w, o); if (ro.eve && ro.eve !== 'free') { r.eve = 'free'; return { k: '{b}今晚另有安排，沒約成', p: { b: o.name } }; }
            ro.eve = 'meal'; ro.with = a.agentId; ro.e0 = e0; r.with = o.agentId; r.e0 = e0; X.st.meal++; bump(a, o, 2); bump(o, a, 2);
            mem(w, a, '下工後找{b}一起吃飯，聊了一晚上。', { b: o.name }, 3, [o.name]); mem(w, o, '{a}下工後來找我吃飯，聊了一晚上。', { a: a.name }, 3, [a.name]);
            return { k: '跟{b}吃飯聊天', p: { b: o.name } };
        }
        if (how === 'drink') { r.until = 21; r.cups = 0; if (!round(w, a, 2)) { r.eve = 'free'; return { k: '錢不夠，沒去成' }; } X.st.drink++; return { k: '去酒館喝了兩杯' }; }
        if (how === 'alone') { r.spot = has(a, 'curious') || has(a, 'creative') ? 'library' : 'park'; return null; }
        if (how === 'over') { r.over = 1; a.moodModifier = (a.moodModifier || 0) - 1; return { k: '留下來多做了兩個鐘頭' }; }
        return null;
    }
    // 喝 n 杯：錢付給酒館的東家（沒有東家進公庫），鎮上有酒就真的喝掉
    function round(w, a, n) {
        const r = rec(w, a); const cost = r2(n * CUP * P(w)); if (typeof WALLET === 'undefined' || !w.wallet || !WALLET.take(w, a, cost)) return false;
        try { if (typeof MARKET !== 'undefined' && w.market) MARKET.sell(w, 'kitchen', cost, t('酒錢')); else w.stockpile?.add?.('silver', cost, w.tickCount, t('酒錢')); } catch (e) {}
        try { const sp = w.stockpile; const r0 = (sp.get('beer') || 0) >= n / 2 ? 'beer' : (sp.get('wine') || 0) >= n / 2 ? 'wine' : null; if (r0) sp.consume(r0, n / 2, w.tickCount, t('酒館的客人')); } catch (e) {}
        r.cups = (r.cups || 0) + n; r.spent = r2((r.spent || 0) + cost); a.moodModifier = (a.moodModifier || 0) + n; if (a.needs) a.needs.social = Math.min(100, (a.needs.social || 0) + 6 * n);
        return true;
    }
    function setLast(w, a, how, ctx) {
        const X = S(w), r = rec(w, a); if (r.eve !== 'drink') return null; const base = ctx?.round === 2 ? 23 : 21;
        if (how === 'home') { r.until = base; return { k: '喝完這杯就回家了' }; }
        const n = how === 'close' ? 4 : 2; if (!round(w, a, n)) { r.until = base; return { k: '錢不夠再喝，回家了' }; }
        r.until = how === 'close' ? 25 : base + 2; X.st[how === 'close' ? 'close' : 'more']++;
        if (r.until >= 25) { log(w, '🍺 {a}在酒館喝到關門，才搖搖晃晃走回家。', { a: a.name }, a.name); mem(w, a, '昨晚在酒館喝到關門，怎麼回家的都不太記得。', {}, 5); }
        return how === 'close' ? { k: '喝到酒館關門' } : { k: '又喝了兩杯，待到 {h} 點', p: { h: r.until } };
    }
    function setPact(w, a, b, spot) {
        const X = S(w); const d = X.d + 1; X.pact[a.agentId] = { d, with: b.agentId, spot }; X.pact[b.agentId] = { d, with: a.agentId, spot }; X.st.pact++;
        mem(w, a, '跟{b}約好明天上工時間溜去{spot}。', { b: b.name, spot: SPOT[spot] }, 5, [b.name]); mem(w, b, '跟{b}約好明天上工時間溜去{spot}。', { b: a.name, spot: SPOT[spot] }, 5, [a.name]);
    }
    function punish(w, boss, x, how, ctx) {
        const X = S(w); X.st[how] = (X.st[how] || 0) + 1; const r = X.t[x.agentId]; if (r) r.boss = how;
        if (how === 'let') { bump(x, boss, 2); return null; }
        if (how === 'scold') { X.warn[x.agentId] = day(w); bump(x, boss, -3); x.moodModifier = (x.moodModifier || 0) - 4; mem(w, x, '沒去上工，被{b}當面訓了一頓。', { b: boss.name }, 6, [boss.name]); mem(w, boss, '{x}沒來上工，我當面說了他一頓。', { x: x.name }, 4, [x.name]); return { k: '當面訓了{x}一頓', p: { x: x.name } }; }
        if (how === 'dock') {
            const amt = Math.min(cash(w, x), r2(wage(x) * 2)); X.warn[x.agentId] = day(w); bump(x, boss, -5);
            if (amt > 0 && typeof WALLET !== 'undefined') WALLET.pay(w, x, boss, amt, t('扣工資'));
            mem(w, x, '沒去上工，被{b}扣了 {n} 銀幣。', { b: boss.name, n: amt }, 6, [boss.name]); log(w, '💢 {x}沒去上工，被{b}扣了 {n} 銀幣的工資。', { x: x.name, b: boss.name, n: amt }, boss.name);
            return { k: '扣了{x} {n} 銀幣', p: { x: x.name, n: amt } };
        }
        const title = x.job?.title || ''; x.job = null; try { if (typeof LABOR !== 'undefined') LABOR.S(w).jobless[x.agentId] = day(w); } catch (e) {}
        bump(x, boss, -15); x.moodModifier = (x.moodModifier || 0) - 10; delete X.rec[x.agentId];
        mem(w, x, ctx?.lie ? '裝病請假被拆穿，{b}把我開除了。' : '三番兩次沒去上工，{b}把我開除了。', { b: boss.name }, 8, [boss.name]); mem(w, boss, '{x}老是不來上工，我請他走人了。', { x: x.name }, 6, [x.name]);
        log(w, '🚪 {x}老是不來上工，被{b}開除了，丟了{j}的工作。', { x: x.name, b: boss.name, j: title }, boss.name);
        return { k: '把{x}開除了', p: { x: x.name } };
    }

    // ================= 打架 =================
    // 以前有兩套各擲各的（sim-health.js 的 fights、npc-events.js 的 _checkFights），「住院」也只是個標籤。
    // 現在：動不動手是本人選的（碰上死對頭、喝多了死對頭就在旁邊）；被打的人自己決定還手或退開；誰輸、傷多重仍然是運氣。
    // 重傷的人真的躺在診所，那幾天不能上工（出院照原本的規則：有藥、有醫生比較快）。
    const tipsy = (w, a) => ((S(w).t[a.agentId]?.cups || 0) >= 4 ? 1 : 0);
    function hospitalize(w, a) { if (a.status === 'hospitalized') return; a.status = 'hospitalized'; a._hospitalDays = 0; S(w).st.hosp++; try { w.processing?.removeWorker?.(a.agentId); } catch (e) {} }
    function hurt(w, a, s, part) { try { if (typeof HEALTH !== 'undefined' && w.health) HEALTH.addAil(w, a, { p: part, k: 'injury', s, dmg: 8 + s * 10 }, '打架'); } catch (e) {} if (s >= 2) hospitalize(w, a); }
    function strike(w, a, o, ctx) { if (!inTown(w, o) || o.activity === 'sleeping') return null; DECIDE.enqueue(w, o, 'struck', { by: a.agentId, drunk: ctx?.drunk ? 1 : 0 }); mem(w, a, '我忍不住對{b}動了手。', { b: o.name }, 7, [o.name]); return { k: '對{b}動了手', p: { b: o.name } }; }
    function brawl(w, a, o, back) {
        const X = S(w); X.st.brawl++; const part = rnd(['h', 'f', 'e']); const PN = (typeof HEALTH !== 'undefined' && HEALTH.PN) || {}; const pn = PN[part] || '手';
        const lvl = (x) => (x.skills?.get?.('近戰')?.level || 0) + Math.random() * 6 - tipsy(w, x) * 1.5;
        let loser = o, winner = a, sev = Math.random() < (back ? 0.3 : 0.15) ? 2 : 1;
        if (back) { if (lvl(a) < lvl(o)) { loser = a; winner = o; } if (Math.random() < 0.4) hurt(w, winner, 1, 'h'); }
        hurt(w, loser, sev, part); bump(a, o, -10); bump(o, a, back ? -10 : -15); a.moodModifier = (a.moodModifier || 0) - 6; o.moodModifier = (o.moodModifier || 0) - 10;
        const here = adults(w).filter(x => x !== a && x !== o && x.currentLocation === o.currentLocation && x.activity !== 'sleeping').slice(0, 12);
        for (const x of here) { bump(x, a, has(x, 'kind') ? -8 : -4); mem(w, x, '親眼看到{a}對{b}動手。', { a: a.name, b: o.name }, 5, [a.name, o.name]); }
        try { if (typeof WAYS !== 'undefined') WAYS.loseFace(w, a, here.length ? 2 : 1); } catch (e) {}
        const hosp = sev >= 2;
        mem(w, loser, hosp ? '跟{x}打了一架，{p}傷得不輕，被抬進診所。' : '跟{x}打了一架，{p}被打傷了。', { x: winner.name, p: pn }, 8, [winner.name]);
        mem(w, winner, back || winner === a ? '跟{x}打了一架，把他打傷了。' : '{x}對我動手，我沒還手。', { x: loser.name }, 7, [loser.name]);
        log(w, hosp ? '👊 {a}對{b}動手，兩人打成一團，{l}的{p}傷得不輕，被抬進診所。' : back ? '👊 {a}對{b}動手，{b}還了手，{l}的{p}受了傷。' : '👊 {a}對{b}動手，{b}沒有還手，{p}受了傷。', { a: a.name, b: o.name, l: loser.name, p: pn }, a.name);
        try { w.gossipNetwork?.activeGossip?.push({ about: a.name, content: fill('{a}對{b}動了手', { a: a.name, b: o.name }), source: t('目擊者'), spreadCount: 0, tickCreated: w.tickCount, isTrue: true }); } catch (e) {}
        try { w.dailyNews?.collectEvent?.('incident', fill(hosp ? '{a}把{b}打進了診所' : '{a}和{b}打了一架', { a: winner.name, b: loser.name }), hosp ? 9 : 7, [a.name, o.name]); } catch (e) {}
        return { loser, winner, sev };
    }

    // ================= 每天、每小時 =================
    // 換日：今天的安排變成「昨天」（產出與工資照它算），算出誰今天宿醉
    function roll(w) {
        if (!on(w)) return; const X = S(w); const d = day(w); if (X.d === d) { X._rolled = d; return; } // 同一天（讀檔、開頁）不換
        X.y = d - X.d === 1 ? (X.t || {}) : {}; X.t = {}; X.d = d; X._rolled = d;
        for (const id of Object.keys(X.hang)) if (X.hang[id].d < d) delete X.hang[id];
        for (const id of Object.keys(X.pact)) if (X.pact[id].d < d) delete X.pact[id];
        for (const id of Object.keys(X.warn)) if (d - X.warn[id] > 30) delete X.warn[id];
        for (const k of Object.keys(X.inv)) if (d - X.inv[k] > 7) delete X.inv[k];
        for (const [id, y] of Object.entries(X.y)) {
            const a = w.agents[id]; if (!a || a.isDead) continue; const cups = y.cups || 0, un = y.until || 0;
            const lv = (un >= 25 || cups >= 6) ? 2 : (cups >= 4 || un >= 23) ? 1 : 0; if (!lv) continue;
            X.hang[id] = { d, lv }; X.st['hang' + lv]++; a.moodModifier = (a.moodModifier || 0) - (lv - 1) * 4; try { a.addThought?.('hangover', w); } catch (e) {}
        }
    }
    const q = (w, a, kind, ctx) => { S(w).st.asked++; DECIDE.enqueue(w, a, kind, ctx); };
    function tick(w) {
        if (!on(w) || (w.clock?.minute || 0) !== 0) return; const X = S(w); const d = day(w); if (X._rolled !== d) roll(w);
        const h = w.clock.hour; const all = adults(w); let asked = 0;
        for (const a of all) {
            const id = a.agentId; const r = X.t[id] || (X.t[id] = {});
            if (a.status === 'hospitalized' && !r.work) r.work = 'hosp';
            // 喝多了，死對頭就在同一間酒館
            if (h === 22 && r.eve === 'drink' && (r.cups || 0) >= 4 && !r.dr && a.currentLocation === 'tavern') { const foe = all.filter(o => o !== a && o.currentLocation === 'tavern' && o.activity !== 'sleeping' && aff(a, o) <= -40).sort((x, y) => aff(a, x) - aff(a, y))[0]; if (foe) { r.dr = 1; q(w, a, 'drunkrow', { d, o: foe.agentId }); asked++; } }
            if (works(w, a)) {
                const [ws, we] = a.job.workHours;
                // 上工前一小時：有理由才問去不去
                if (h === (ws + 23) % 24 && !r.work && !r.wq) { const why = reasons(w, a); if (why.length) { r.wq = 1; for (const x of why) X.st['r_' + x.k] = (X.st['r_' + x.k] || 0) + 1; q(w, a, 'workday', { d, why: why.map(x => x.k), ws }); asked++; } else r.work = 'go'; }
                // 沒說一聲就不來：兩個鐘頭後東家發現
                if (h === ws + 2 && r.work === 'skip' && !r.bq) { r.bq = 1; const b = bossOf(w, a); if (b) { q(w, b, 'noshow', { d, x: id, n: strikes(w, a) }); asked++; } }
                // 請了病假卻在外面晃：被東家看到，或被愛說話、跟他不對盤的人看到
                if (r.work === 'sick' && !r.seen && h >= ws && h < we && a.currentLocation !== a.homeLocation) {
                    const b = bossOf(w, a); const here = all.filter(o => o !== a && o.currentLocation === a.currentLocation && o.activity !== 'sleeping');
                    const wit = here.find(o => o === b) || here.find(o => has(o, 'gossip') || aff(o, a) < -10);
                    if (wit && b) {
                        r.seen = wit.agentId; X.st.caught++; (X.rec[id] || (X.rec[id] = [])).push(d); try { if (typeof WAYS !== 'undefined') WAYS.loseFace(w, a, 2); } catch (e) {}
                        const sp = SPOT[a.currentLocation] || '外面';
                        log(w, wit === b ? '👀 {a}請了病假，卻被東家{b}在{s}撞個正著。' : '👀 {a}請了病假，卻被{b}看到在{s}，話傳到東家耳裡。', { a: a.name, b: wit.name, s: sp }, a.name);
                        mem(w, a, '請了病假出來晃，被{b}看到了。', { b: wit.name }, 6, [wit.name]); mem(w, wit, '{a}說是病了沒上工，我卻看到他在{s}。', { a: a.name, s: sp }, 5, [a.name]);
                        q(w, b, 'noshow', { d, x: id, n: strikes(w, a), lie: 1 }); asked++;
                    }
                }
            }
            // 下工：今晚怎麼過
            if (h === eveOf(a) && !r.eve && !r.eq) { r.eq = 1; q(w, a, 'evening', { d }); asked++; }
            // 酒館裡：九點、十一點各問一次要不要再喝
            if (r.eve === 'drink' && ((h === 21 && r.until === 21 && !r.l1) || (h === 23 && r.until === 23 && !r.l2))) { if (h === 21) r.l1 = 1; else r.l2 = 1; q(w, a, 'lastcall', { d, round: h === 21 ? 1 : 2 }); asked++; }
        }
        // 晚上八點：跟好朋友在一起的人，可能約對方明天溜出去
        if (h === 20) {
            const done = new Set();
            for (const a of all) {
                const r = X.t[a.agentId]; if (!r || done.has(a.agentId) || !a.job || X.pact[a.agentId]?.d > d || d - (X.warn['q' + a.agentId] ?? -99) < 6) continue;
                const b = r.with ? w.agents[r.with] : (r.eve === 'drink' ? all.find(o => o !== a && X.t[o.agentId]?.eve === 'drink' && aff(a, o) >= 35 && !done.has(o.agentId)) : null);
                if (!b || !b.job || !inTown(w, b) || aff(a, b) < 35 || X.pact[b.agentId]?.d > d) continue; done.add(a.agentId); done.add(b.agentId);
                const La = DECIDE.lean(w, a).joy, Lb = DECIDE.lean(w, b).joy; const [x, y] = La >= Lb ? [a, b] : [b, a]; X.warn['q' + x.agentId] = d; q(w, x, 'planout', { d, b: y.agentId }); asked++;
            }
        }
        // 中午：約好的兩個人，誰來了誰沒來
        if (h === 12) {
            const seen = new Set();
            for (const [id, pc] of Object.entries(X.pact)) {
                if (pc.d !== d || seen.has(id)) continue; seen.add(id); seen.add(pc.with); const a = w.agents[id], b = w.agents[pc.with]; if (!a || !b) continue;
                const ca = ['skip', 'sick'].includes(X.t[id]?.work), cb = ['skip', 'sick'].includes(X.t[pc.with]?.work); const sp = SPOT[pc.spot] || '廣場';
                if (ca && cb) { X.st.pactKept++; bump(a, b, 4); bump(b, a, 4); a.moodModifier = (a.moodModifier || 0) + 6; b.moodModifier = (b.moodModifier || 0) + 6; mem(w, a, '跟{b}翹了班去{s}，玩得很痛快。', { b: b.name, s: sp }, 6, [b.name]); mem(w, b, '跟{b}翹了班去{s}，玩得很痛快。', { b: a.name, s: sp }, 6, [a.name]); log(w, '🎣 {a}和{b}今天都沒去上工，一起跑去{s}了。', { a: a.name, b: b.name, s: sp }, a.name); }
                else if (ca !== cb) { X.st.pactBroken++; const [came, no] = ca ? [a, b] : [b, a]; bump(came, no, -5); came.moodModifier = (came.moodModifier || 0) - 3; mem(w, came, '約好一起溜出去，{b}卻沒來，我一個人在{s}等了半天。', { b: no.name, s: sp }, 6, [no.name]); mem(w, no, '答應了{b}要溜出去，最後還是去上工了。', { b: came.name }, 4, [came.name]); }
                delete X.pact[id]; delete X.pact[pc.with];
            }
        }
        if (asked) { try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) { console.warn('[Day] drain', e); } }
    }

    // 人真的去哪裡：照今天的安排蓋過鐘點規則（餓壞、累垮時不管）
    function steer(w, a) {
        a._dayLoc = null; a._dayWhy = null; if (!on(w) || a.isPlayer || a.isDead || !a.needs) return;
        if (a.status === 'hospitalized' && a.needs.hunger >= 15) { a.activity = 'sleeping'; a._dayLoc = w.townMap?.locations?.clinic ? 'clinic' : a.homeLocation; a._dayWhy = '受了傷，躺在診所'; return; }
        if (a.needs.hunger < 15 || a.needs.rest < 10) return; const X = S(w), id = a.agentId, h = w.clock.hour;
        const set = (act, loc, why) => { a.activity = act; a._dayLoc = loc === 'home' ? a.homeLocation : loc; a._dayWhy = why; };
        const y = X.y[id]; if (h < 6 && y && (y.until || 0) > h + 24) return set('socializing', 'tavern', '在酒館喝到半夜');
        const r = X.t[id]; if (!r) return freeSteer(w, a);
        if (a.job && Array.isArray(a.job.workHours)) {
            const [ws, we] = a.job.workHours;
            if (r.work === 'late' && h >= ws - 1 && h < ws + 2) return set('sleeping', 'home', r.hang ? '宿醉，還在睡' : '爬不起來，還在睡');
            if ((r.work === 'skip' || r.work === 'sick' || r.work === 'leave') && h >= ws - 1 && h < we) {
                const why = r.work === 'skip' ? '翹班' : r.work === 'sick' ? '請了病假' : '請假';
                if (r.bed && h < ws + r.bed) return set('sleeping', 'home', r.hang ? '宿醉，還在睡' : '還在補眠');
                if (r.work === 'sick' && h < (r.homeTill || 0)) return set('recreation', 'home', why);
                if (r.spot === 'graveyard') return set('mourning', 'graveyard', why);
                return set(r.with ? 'socializing' : 'recreation', r.spot || 'home', why);
            }
            if (r.over && h >= we && h < we + 2) return set('working', a.job.workplace, '留下來多做一點');
        }
        const hx = h < 6 ? h + 24 : h; const e0 = r.e0 ?? eveOf(a); const bed = bedOf(a);
        if (r.eve === 'drink' && hx >= Math.max(19, e0) && hx < (r.until || 21)) return set('socializing', 'tavern', (r.cups || 0) >= 4 ? '在酒館喝多了' : '在酒館喝酒');
        if (hx >= bed - 1) return freeSteer(w, a);
        if (r.eve === 'meal' && hx >= e0 && hx < e0 + 2) return set('eating', 'tavern', '跟朋友吃飯');
        if (r.eve === 'alone' && hx >= e0 + 1 && hx < 21) return set('recreation', r.spot || 'park', '想一個人待著');
        if (r.eve === 'family' && hx >= e0 + 1 && hx < 21) return set('socializing', 'home', '陪家人');
        if (r.eve === 'rest' && hx >= e0 + 1) return set(hx >= 20 ? 'sleeping' : 'heading_home', 'home', '今天早點睡');
        return freeSteer(w, a);
    }
    // 沒有特別安排的空閒：照個性與當下狀況挑一件事、一個地方，待上一陣子
    const FREEACT = ['socializing', 'wandering', 'recreation'], NIGHTACT = ['stargazing', 'night_stroll', 'night_mischief'];
    function freeSteer(w, a) {
        if (a._hangHold) { if (a._hangHold.n-- > 0 && a.activity !== 'sleeping' && a.activity !== 'working') { a.activity = a._hangHold.act; a._dayLoc = a._hangHold.loc; a._dayWhy = '跟朋友約好了'; return; } a._hangHold = null; }
        if (a._pendingHangout) return; const base = a.activity; const isN = NIGHTACT.includes(base); if (!isN && !FREEACT.includes(base)) return;
        if (a.job && Array.isArray(a.job.workHours)) { const [ws, we] = a.job.workHours; const h = w.clock.hour; if (ws <= h && h < we) return; }
        const p = freePick(w, a, isN || w.clock.hour >= 21 || w.clock.hour < 5); if (!p) return; a.activity = p.act; a._dayLoc = p.loc;
    }
    // ================= 空閒時做什麼、去哪、找誰（v11.3.0） =================
    // 以前：空閒時每 15 分鐘擲一次骰決定社交、閒逛或娛樂，去哪裡從幾個地點隨機挑，找誰聊照好感加權隨機，12% 機率約人、被約的人不能拒絕。
    // 現在：照這個人的個性、此刻缺什麼、誰在那裡（朋友在就想去、仇人在就避開）、平常愛去的地方、天氣，還有今天行程上寫的地方來挑；
    //       一次挑定待上一陣子，不會每一刻換主意。這些小事一天上萬次，不問 AI；AI 的影響來自清晨寫的行程。
    const DAYSET = [['socializing', 'tavern'], ['socializing', 'town_square'], ['socializing', 'park'], ['socializing', 'chapel'], ['socializing', 'home'], ['recreation', 'park'], ['recreation', 'library'], ['recreation', 'tavern'], ['wandering', 'town_square'], ['wandering', 'park'], ['wandering', 'home']];
    const NIGHTSET = [['stargazing', 'park'], ['stargazing', 'hill'], ['night_stroll', 'park'], ['night_stroll', 'town_square'], ['socializing', 'tavern'], ['recreation', 'library'], ['recreation', 'tavern']];
    const PLANWORD = { tavern: /酒館|喝一杯|小酌|tavern|inn|pub|drink/i, library: /圖書館|看書|讀書|翻書|library|read/i, park: /公園|散步|park|walk|stroll/i, town_square: /廣場|市集|square|market/i, chapel: /禮拜|教堂|祈禱|chapel|pray|temple|shrine/i, home: /回家|家裡|在家|陪家人|home|family/i };
    const realLoc = (a, loc) => (loc === 'home' ? a.homeLocation : loc);
    const hasLoc = (w, loc) => loc === 'home' || !w.townMap?.locations || !!w.townMap.locations[loc];
    function freeCtx(w, a) {
        const friends = {}, foes = {}; const R = a.relationships?.relationships || {};
        for (const id in R) { const v = R[id].affinity || 0; if (v < 30 && v > -30) continue; const o = w.agents[id]; if (!o || o.isDead || o.activity === 'sleeping') continue; const L = o.currentLocation; if (v >= 30) friends[L] = (friends[L] || 0) + 1; else foes[L] = (foes[L] || 0) + 1; }
        let piety = 0; try { piety = typeof FAITH !== 'undefined' && w.faith ? (FAITH.pietyOf(w, a) || 0) : 0; } catch (e) {}
        let habit = null; try { habit = typeof WAYS !== 'undefined' ? WAYS.routineOf(w, a)?.s : null; } catch (e) {}
        let planLoc = null; try { if (a.dailyPlan?.llm) { const cur = a.getCurrentPlanStep(w); const txt = cur ? `${cur.goal} ${cur.step}` : ''; if (txt) { for (const k of Object.keys(PLANWORD)) { const nm = w.townMap?.locations?.[k]?.name; if (PLANWORD[k].test(txt) || (nm && txt.includes(nm))) { planLoc = k; break; } } } } } catch (e) {}
        return { friends, foes, piety, habit, planLoc, tired: (a.needs?.rest ?? 60) < 35, bad: (w.weather?.moodModifier || 0) <= -5, hang: hangOf(w, a) };
    }
    function freeScore(w, a, act, loc, c) {
        const n = a.needs || {}; let s = 0; const L = realLoc(a, loc);
        if (act === 'socializing') s += 1 + (60 - (n.social ?? 60)) / 40 + ((a.personality?.socialModifier || 0) > 0 ? 0.4 : 0) - (has(a, 'shy') ? 0.5 : 0);
        else if (act === 'recreation') s += 0.9 + (60 - (n.recreation ?? 60)) / 40 + (has(a, 'creative') || has(a, 'curious') ? 0.3 : 0);
        else if (act === 'wandering') s += 0.7 + (has(a, 'curious') ? 0.2 : 0);
        else if (act === 'stargazing') s += 1.1 + (has(a, 'romantic') || has(a, 'creative') ? 0.4 : 0);
        else if (act === 'night_stroll') s += 0.9 + ((a.mood ?? 50) < 30 ? 0.6 : 0);
        if (loc === 'tavern') s += (has(a, 'glutton') ? 0.5 : 0) + (has(a, 'charismatic') || has(a, 'gossip') ? 0.4 : 0) - (has(a, 'shy') ? 0.4 : 0) - (has(a, 'ascetic') ? 0.6 : 0) - (c.hang ? 0.4 : 0);
        else if (loc === 'library') s += (has(a, 'curious') ? 0.6 : 0) + (has(a, 'shy') ? 0.3 : 0) + (has(a, 'creative') ? 0.2 : 0);
        else if (loc === 'chapel') s += c.piety >= 60 ? 0.8 : c.piety >= 30 ? 0 : -0.6;
        else if (loc === 'home') s += (hasV(a, '家庭') ? 0.4 : 0) + (c.tired ? 0.5 : 0) + (c.bad ? 0.5 : 0);
        else s += c.bad ? -0.6 : (hasV(a, '自然') && loc !== 'town_square' ? 0.4 : 0);
        if (c.habit === loc) s += 0.5; if (c.planLoc === loc) s += 1.2;
        return s + Math.min(0.9, (c.friends[L] || 0) * 0.3) - Math.min(1.2, (c.foes[L] || 0) * 0.6);
    }
    function freePick(w, a, night) {
        const X = S(w); const h = w.clock.hour; const key = X.d + ':' + (h >> 1) + ':' + (night ? 'n' : 'd') + ':' + (a.needs?.mostUrgent || '');
        if (a._free && a._free.key === key) return a._free; const c = freeCtx(w, a); let set0 = (night ? NIGHTSET : DAYSET).filter(x => hasLoc(w, x[1]));
        if (night && (has(a, 'abrasive') || has(a, 'gossip')) && has(a, 'night_owl')) set0 = set0.concat([['night_mischief', 'town_square']]);
        let best = null, bs = -Infinity; for (const [act, loc] of set0) { const s = freeScore(w, a, act, loc, c) + (act === 'night_mischief' ? 0.9 : 0) + Math.random() * 0.5; if (s > bs) { bs = s; best = [act, loc]; } } // 最後那一點是當下的心情起伏
        if (!best) return null; X.st.free++; if (c.planLoc && best[1] === c.planLoc) X.st.planLed++;
        a._free = { key, act: best[0], loc: realLoc(a, best[1]) }; return a._free;
    }
    // 找誰聊：交情、心意、今天聊過幾次（聊過的往後排）、正在冷戰的不找
    function pickTalk(w, a, others) {
        const r = rec(w, a); const T = r.talk || (r.talk = {}); let best = null, bs = -Infinity;
        for (const o of others) { const rel = a.relationships?.relationships?.[o.agentId]; const v = rel?.affinity || 0; let cold = false; try { cold = typeof WAYS !== 'undefined' && !!WAYS.coldWith?.(w, a, o); } catch (e) {}
            const s = v / 12 + (rel?.romanticInterest || 0) / 12 + (rel?.status ? 1 : 0) - (v < -30 ? 1 : 0) - (cold ? 3 : 0) - 1.5 * (T[o.agentId] || 0) + Math.random() * 0.5; if (s > bs) { bs = s; best = o; } }
        if (best) T[best.agentId] = (T[best.agentId] || 0) + 1; return best;
    }
    // 約人出去：想不想約看自己；去不去由對方照交情、累不累、今晚有沒有別的安排決定（以前 12% 機率、被約的人不能拒絕）
    function invite(w, a, o) {
        const X = S(w); if (a._pendingHangout || o._pendingHangout || a._hangHold || o._hangHold) return false; const v = aff(a, o); if (v < 30) return false;
        const key = [a.agentId, o.agentId].sort().join('|'); if (X.inv[key] != null && X.d - X.inv[key] < 2) return false;
        if (!((a.needs?.social ?? 60) < 55 || v >= 55 || has(a, 'charismatic')) || (a.needs?.rest ?? 60) < 30) return false; X.inv[key] = X.d;
        const eo = X.t[o.agentId]?.eve; const yes = aff(o, a) / 40 + ((o.needs?.social ?? 60) < 50 ? 0.5 : 0) - ((o.needs?.rest ?? 60) < 35 ? 0.8 : 0) - (has(o, 'shy') ? 0.3 : 0) - (hangOf(w, o) ? 0.5 : 0) - (eo && eo !== 'free' ? 1 : 0);
        if (yes < 1) { X.st.inviteNo++; mem(w, a, '想約{b}出去走走，他說改天。', { b: o.name }, 3, [o.name]); mem(w, o, '{a}約我出去，我今天不太想動，跟他說改天。', { a: a.name }, 3, [a.name]); return false; }
        const ca = freeCtx(w, a), co = freeCtx(w, o); let spot = 'park', bs = -Infinity; for (const loc of ['tavern', 'park', 'town_square', 'chapel', 'library'].filter(x => hasLoc(w, x))) { const s = freeScore(w, a, 'socializing', loc, ca) + freeScore(w, o, 'socializing', loc, co); if (s > bs) { bs = s; spot = loc; } }
        const act = (a.relationships?.relationships?.[o.agentId]?.romanticInterest || 0) > 40 ? 'recreation' : 'socializing'; const delay = 3; X.st.invite++;
        a._pendingHangout = { location: spot, activity: act, tick: delay, withAgent: o.name }; o._pendingHangout = { location: spot, activity: act, tick: delay, withAgent: a.name };
        try { const nm = typeof locName === 'function' ? locName(w, spot) : (SPOT[spot] || spot); const d = typeof tpl === 'function' ? tpl('{me}約了{target}一起去{spot}', { me: a.name, target: o.name, spot: nm }) : null;
            if (d) { w.logMessageT('social', '{d}', { d }, a.name, o.name); a.memory.addT(w.tickCount, w.clock.timeStr, 'social', d.k, d.p, 5, [o.name]); o.memory.addT(w.tickCount, w.clock.timeStr, 'social', d.k, d.p, 5, [a.name]); } } catch (e) {}
        return true;
    }
    // 說閒話：愛說話的人逢人就說，其他人只跟要好的說（以前每次三成機率）
    const gossips = (w, a, o) => has(a, 'gossip') || (aff(a, o) >= 40 && !has(a, 'stoic'));

    // 昨天的出勤 → 今天結算的產出與工資
    function workMult(w, a) {
        if (!on(w)) return 1; const X = S(w); const y = X.y[a.agentId]; if (!y) return 1;
        if (y.work === 'skip' || y.work === 'sick' || y.work === 'leave' || y.work === 'hosp') return 0;
        let m = y.work === 'late' ? 0.75 : 1; if (y.hang >= 2) m *= 0.7; else if (y.hang === 1) m *= 0.85; if (y.over) m *= 1.15; return m;
    }
    const noPay = (w, a) => { if (!on(w)) return false; const y = S(w).y[a.agentId]; return !!y && (y.work === 'skip' || y.work === 'sick' || y.work === 'leave'); };

    // 清晨排行程時 AI 順便決定今天去不去上工（有理由的人才會被問到）
    function planAsk(w, a) {
        if (!on(w) || !works(w, a) || rec(w, a).work) return ''; const why = reasons(w, a); if (!why.length) return '';
        return fill('【今天要拿主意】{why}上工的事在 JSON 多寫一個 "work"：go 照常去、late 晚兩個鐘頭到、leave 跟東家請一天假（沒工資）、skip 不說一聲就不去（沒工資，東家會知道）。', { why: { raw: why.map(x => tx(x.s)).join('') } });
    }
    function fromPlan(w, a, v) {
        v = String(v || '').trim().toLowerCase(); if (!['go', 'late', 'leave', 'skip'].includes(v) || !on(w) || !works(w, a)) return false; const r = rec(w, a); if (r.work || r.wq) return false;
        const h = w.clock.hour, [ws] = a.job.workHours; if (h >= ws) return false; const why = reasons(w, a); if (!why.length) return false;
        const res = setWork(w, a, v, { why: why.map(x => x.k) }); r.ai = 1;
        try { const K = DECIDE.KINDS.workday; const op = K.options(w, a, { d: day(w), why: why.map(x => x.k), dry: 1 }).find(o => o.id === v); if (op) DECIDE.record(w, DECIDE.S(w), a, K, op, null, res, 'ai', day(w), null); } catch (e) {}
        return true;
    }
    // 帳本上的一句話：今天的狀況
    function line(w, a) {
        if (!on(w)) return ''; const X = S(w); const r = X.t[a.agentId] || {}; const out = []; const hg = hangOf(w, a);
        if (hg) out.push(t(hg >= 2 ? '昨晚喝到很晚，今天宿醉得厲害。' : '昨晚多喝了幾杯，今天頭有點沉。'));
        if (r.work === 'skip') out.push(t('今天沒去上工，也沒說一聲。')); else if (r.work === 'sick') out.push(t('今天裝病請了假。')); else if (r.work === 'leave') out.push(t('今天請了假。')); else if (r.work === 'late') out.push(t('今天上工遲到了。'));
        if (r.eve === 'drink') out.push(fill('今晚在酒館，已經喝了 {n} 杯。', { n: r.cups || 0 }));
        const n = strikes(w, a); if (n) out.push(fill('這個月已經 {n} 次沒去上工。', { n })); if (X.warn[a.agentId] != null) out.push(t('東家為了沒上工的事警告過你。'));
        return out.join('');
    }
    function view(w) {
        const X = S(w); const names = (f) => Object.entries(X.t).filter(([, r]) => f(r)).map(([id]) => w.agents[id]?.name).filter(Boolean);
        return { off: names(r => ['skip', 'sick', 'leave'].includes(r.work)), late: names(r => r.work === 'late'), drink: names(r => r.eve === 'drink'), hang: Object.keys(X.hang).filter(id => X.hang[id].d === X.d).map(id => w.agents[id]?.name).filter(Boolean), st: { ...X.st } };
    }
    return { S, on, roll, tick, steer, workMult, noPay, reasons, bossOf, works, hangOf, strikes, setWork, setEve, setLast, setPact, punish, round, strike, brawl, hospitalize, freePick, freeScore, freeCtx, pickTalk, invite, gossips, planAsk, fromPlan, line, view, SPOT, CUP, eveOf, bedOf };
})();

// ================= 選擇點 =================
(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const today = (w, ctx) => !ctx || ctx.d == null || ctx.d === (w._absDay ? w._absDay() : 0);
    const wageDay = (a) => { try { return WALLET.wageOf(a) || 4; } catch (e) { return 4; } };
    const poor = (w, a) => cash(w, a) < wageDay(a) * 3;
    DECIDE.AI_GROUP.day = 12; // 日常這一組一天最多問 AI 12 件，不擠掉原本的名額
    const G = { scan: false, cool: 0, aiGroup: 'day' };

    // ---------- 今天去不去上工 ----------
    DECIDE.kind('workday', Object.assign({}, G, {
        title: '今天去不去上工', aiKind: 4,
        facts(w, a, ctx) {
            const why = DAY.reasons(w, a); const b = DAY.bossOf(w, a); const n = DAY.strikes(w, a);
            return fill('再過一個鐘頭就要上工（{job}）。{why}{boss}一天的工資大約 {p} 銀幣，沒去就沒有；你手上有 {c} 銀幣。{n}{warn}', { job: a.job?.title || '', why: { raw: why.map(x => tx(x.s)).join('') }, boss: b ? { k: '東家是{b}（{tie}）。', p: { b: b.name, tie: aff(b, a) >= 30 ? '跟你交情不錯' : aff(b, a) < -10 ? '跟你處不來' : '交情普通' } } : { raw: '' }, p: Math.round(wageDay(a) * 10) / 10, c: Math.round(cash(w, a)), n: n ? { k: '這個月你已經 {n} 次沒去。', p: { n } } : { raw: '' }, warn: DAY.S(w).warn[a.agentId] != null ? '東家為這件事警告過你。' : '' });
        },
        options(w, a, ctx) {
            if (!ctx?.dry && (!today(w, ctx) || !DAY.works(w, a) || DAY.S(w).t[a.agentId]?.work)) return [];
            const y = (k) => (ctx?.why || []).includes(k) ? 1 : 0; const hg = y('hang2') ? 2 : y('hang1') ? 1 : 0; const warned = DAY.S(w).warn[a.agentId] != null ? 1 : 0; const pr = poor(w, a) ? 1 : 0;
            const run = (how) => (w2, a2) => (today(w2, ctx) ? DAY.setWork(w2, a2, how, ctx) : null);
            const out = [{ id: 'go', text: '照常去上工', say: '照常去上工', why: '該做的事還是要做。', mute: !y('pact') && !hg,
                base: 1.9 + (has(a, 'hardworking') ? 0.6 : 0) + (has(a, 'perfectionist') ? 0.3 : 0) + pr * 0.6 + warned * 0.8 - (hg === 2 ? 0.9 : hg ? 0.3 : 0) - y('tired') * 0.4 - y('low') * 0.4 - y('ill') * 0.3 - y('pact') * 1.0 - y('fest') * 0.3 - y('sour') * 0.5 - y('grief') * 0.5 - y('lazy') * 0.5, lean: { safe: 0.5, gain: 0.4 }, run: run('go') }];
            if (hg || y('tired')) out.push({ id: 'late', text: '多睡兩個鐘頭，晚點再去', say: '晚點再去上工', why: '這樣子去了也做不了事，多躺一下。', base: 1.3 + (hg === 2 ? 0.5 : 0) - warned * 0.4, lean: { joy: 0.3, safe: 0.3 }, run: run('late') });
            out.push({ id: 'leave', text: '跟東家說一聲，請一天假（沒有工資）', say: '請了一天假', why: '今天真的不行，老實跟東家說。', base: 0.4 + y('ill') * 0.9 + y('grief') * 1.0 + (hg === 2 ? 0.5 : 0) + y('low') * 0.4 + y('fest') * 0.3 - pr * 0.4, lean: { safe: 0.3, joy: 0.3, face: 0.2 }, run: run('leave') });
            if (!y('ill')) out.push({ id: 'sick', text: '跟東家說自己病了（其實沒有）', say: '裝病請假', why: '說實話不好聽，就說身體不舒服吧。', base: 0.3 + (hg ? 0.5 : 0) + y('pact') * 0.7 + y('fest') * 0.4 + y('lazy') * 0.4 - (has(a, 'kind') ? 0.2 : 0) - warned * 0.3, lean: { joy: 0.5, face: -0.3 }, run: run('sick') });
            out.push({ id: 'skip', text: '不說一聲，今天就不去了', say: '沒去上工，也沒說一聲', why: '今天就是不想去，管他的。', base: 0.2 + y('pact') * 1.2 + y('sour') * 0.6 + y('lazy') * 0.5 + y('low') * 0.3 + (hg === 2 ? 0.3 : 0) + y('fest') * 0.3 + (hasV(a, '自由') ? 0.3 : 0) - warned * 1.0 - pr * 0.3, lean: { joy: 0.6, safe: -0.5, gain: -0.3 }, run: run('skip') });
            return out;
        },
    }));

    // ---------- 今晚怎麼過 ----------
    DECIDE.kind('evening', Object.assign({}, G, {
        title: '今晚怎麼過', aiKind: 3,
        facts(w, a, ctx) {
            const hg = DAY.hangOf(w, a); const c = Math.round(cash(w, a)); const [ws] = a.job?.workHours || [];
            return fill('下工了。{st}一杯酒 {p} 銀幣，你手上有 {c} 銀幣。{tm}', { st: hg ? '昨晚喝多了，今天還不太舒服。' : (a.needs?.rest ?? 100) < 40 ? '今天很累。' : (a.mood ?? 50) < 35 ? '今天心情不好。' : '', p: Math.round(DAY.CUP * 10) / 10, c, tm: ws != null ? { k: '明天 {h} 點要上工。', p: { h: ws } } : { raw: '' } });
        },
        options(w, a, ctx) {
            if (!today(w, ctx) || DAY.S(w).t[a.agentId]?.eve) return [];
            const hg = DAY.hangOf(w, a); const tired = (a.needs?.rest ?? 100) < 40; const low = (a.mood ?? 50) < 35; const pr = poor(w, a) ? 1 : 0; const X = DAY.S(w);
            const run = (how, o) => (w2, a2) => (today(w2, ctx) ? DAY.setEve(w2, a2, how, o ? w2.agents[o] : null) : null);
            const out = [{ id: 'free', text: '沒特別安排，想到什麼做什麼', say: '隨意過了一晚', why: '', mute: true, base: 1.5, lean: { safe: 0.3 }, run: run('free') }];
            if (hg || tired) out.push({ id: 'rest', text: '早點回家睡覺', say: '早早回家睡了', why: '今天撐不住了，早點睡。', mute: true, base: 1.2 + (hg ? 0.5 : 0) + (tired ? 0.4 : 0), lean: { safe: 0.4 }, run: run('rest') });
            const pal = Object.values(w.agents).filter(o => o !== a && !o.isPlayer && !o.isDead && (o.age ?? 30) >= 16 && o.currentLocation !== 'exploration' && !w.isAway?.(o.agentId) && aff(a, o) >= 25 && !(X.t[o.agentId]?.eve && X.t[o.agentId].eve !== 'free') && !(typeof WAYS !== 'undefined' && WAYS.coldWith?.(w, a, o))).sort((x, y) => aff(a, y) - aff(a, x))[0];
            if (pal) out.push({ id: 'meal:' + pal.agentId, text: { k: '找{b}一起吃飯聊天', p: { b: pal.name } }, say: { k: '找{b}吃飯', p: { b: pal.name } }, why: '好一陣子沒跟他好好聊了。', base: 0.3 + Math.min(0.5, aff(a, pal) / 120) + ((a.needs?.social ?? 100) < 40 ? 0.4 : 0) - (X.y[a.agentId]?.eve === 'meal' ? 0.6 : 0), lean: { bond: 0.6 }, run: run('meal', pal.agentId) });
            if (cash(w, a) >= DAY.CUP * 2 * 1.2 && !has(a, 'ascetic')) out.push({ id: 'drink', text: '去酒館喝幾杯', say: '去酒館喝酒', why: low ? '心裡悶，想喝一杯。' : '忙了一天，去喝一杯。', base: 0.5 + (has(a, 'glutton') ? 0.5 : 0) + (has(a, 'charismatic') ? 0.3 : 0) + (low ? 0.5 : 0) - (hg ? 0.6 : 0) - pr * 0.5, lean: { joy: 0.7, safe: -0.3 }, run: run('drink') });
            out.push({ id: 'alone', text: '自己找個地方待著', say: '一個人待了一晚', why: '想安靜一下。', mute: true, base: 0.7 + (has(a, 'shy') ? 0.6 : 0) + (has(a, 'curious') || has(a, 'creative') ? 0.3 : 0), lean: { joy: 0.3 }, run: run('alone') });
            if (a.relationships?.getPartner?.() || Object.values(w.agents).some(o => (o.age ?? 30) < 16 && (o._parentNames || []).includes(a.name))) out.push({ id: 'family', text: '回家陪家人', say: '回家陪家人', why: '一天沒見到家裡的人了。', mute: true, base: 1.0 + (hasV(a, '家庭') ? 0.6 : 0), lean: { bond: 0.5 }, run: run('family') });
            if (a.job && !hg && !tired) out.push({ id: 'over', text: '留下來多做兩個鐘頭', say: '留下來多做了一點', why: '多做一點是一點。', base: 0.2 + (has(a, 'hardworking') ? 0.7 : 0) + (has(a, 'ambitious') ? 0.4 : 0) + pr * 0.4 + (has(a, 'perfectionist') ? 0.3 : 0), lean: { gain: 0.6, joy: -0.4 }, run: run('over') });
            return out;
        },
    }));

    // ---------- 酒館裡，要不要再喝 ----------
    DECIDE.kind('lastcall', Object.assign({}, G, {
        title: '要不要再喝', aiKind: 3,
        facts(w, a, ctx) {
            const r = DAY.S(w).t[a.agentId] || {}; const [ws] = a.job?.workHours || []; const pal = Object.values(w.agents).find(o => o !== a && DAY.S(w).t[o.agentId]?.eve === 'drink' && aff(a, o) >= 25);
            return fill('現在 {h} 點，你在酒館已經喝了 {n} 杯，花了 {s} 銀幣，手上還有 {c}。{tm}{pal}喝越多、越晚回家，明天越難受。', { h: ctx?.round === 2 ? 23 : 21, n: r.cups || 0, s: Math.round((r.spent || 0) * 10) / 10, c: Math.round(cash(w, a)), tm: ws != null ? { k: '明天 {h} 點要上工。', p: { h: ws } } : { k: '明天不用上工。' }, pal: pal ? { k: '{b}也還在喝。', p: { b: pal.name } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const r = DAY.S(w).t[a.agentId]; if (!today(w, ctx) || !r || r.eve !== 'drink') return [];
            const low = (a.mood ?? 50) < 35; const pal = Object.values(w.agents).some(o => o !== a && DAY.S(w).t[o.agentId]?.eve === 'drink' && aff(a, o) >= 25) ? 1 : 0; const tipsy = (r.cups || 0) >= 4 ? 1 : 0; const r2 = ctx?.round === 2 ? 1 : 0; const pr = poor(w, a) ? 1 : 0;
            const run = (how) => (w2, a2) => (today(w2, ctx) ? DAY.setLast(w2, a2, how, ctx) : null);
            const out = [{ id: 'home', text: '喝完這杯就回家', say: '喝完就回家', why: '明天還有事，差不多了。', mute: true, base: 1.8 + r2 * 0.5 + (has(a, 'hardworking') ? 0.4 : 0) + pr * 0.4 + (a.job ? 0 : -0.3), lean: { safe: 0.6 }, run: run('home') },
                { id: 'more', text: '再喝兩杯', say: '又喝了兩杯', why: pal ? '大家都還在，再陪一輪。' : '還沒喝夠，再來兩杯。', base: 0.8 + pal * 0.5 + (low ? 0.4 : 0) + (has(a, 'glutton') ? 0.5 : 0) + tipsy * 0.3, lean: { joy: 0.6, bond: 0.2 }, run: run('more') }];
            if (!r2) out.push({ id: 'close', text: '今晚喝到關門', say: '喝到酒館關門', why: low ? '今晚不想清醒。' : '難得開心，喝個痛快。', base: 0.1 + (low ? 0.6 : 0) + (has(a, 'glutton') ? 0.4 : 0) + pal * 0.3 + tipsy * 0.3 + (a.job ? 0 : 0.4), lean: { joy: 0.7, safe: -0.6 }, run: run('close') });
            return out;
        },
    }));

    // ---------- 要不要約他明天上工時間溜出去 ----------
    DECIDE.kind('planout', Object.assign({}, G, {
        title: '要不要約他明天溜出去', aiKind: 1,
        facts(w, a, ctx) { const b = w.agents[ctx.b]; return fill('今晚跟{b}在一起，聊得很開心。你們明天都要上工；沒去上工就沒有那天的工資，東家也會知道。', { b: b ? b.name : '' }); },
        options(w, a, ctx) {
            const b = w.agents[ctx?.b]; if (!today(w, ctx) || !b || !a.job || !b.job) return []; const r = DAY.S(w).t[a.agentId] || {}; const spot = has(a, 'glutton') ? 'tavern' : hasV(a, '自然') || hasV(a, '冒險') ? 'forest' : 'park';
            return [{ id: 'no', text: '不約，明天各自上工', say: '沒約', why: '', mute: true, base: 1.6 + (has(a, 'hardworking') ? 0.5 : 0), lean: { safe: 0.5, gain: 0.3 }, run: () => null },
                { id: 'ask', text: { k: '約{b}明天上工時間溜去{s}', p: { b: b.name, s: DAY.SPOT[spot] } }, say: { k: '約{b}明天翹班去{s}', p: { b: b.name, s: DAY.SPOT[spot] } }, why: '天天上工有什麼意思，偷一天閒吧。', base: -0.2 + (has(a, 'lazy') ? 0.5 : 0) + (hasV(a, '自由') ? 0.3 : 0) + (hasV(a, '冒險') ? 0.4 : 0) + ((r.cups || 0) >= 4 ? 0.5 : 0) + Math.min(0.4, aff(a, b) / 150), lean: { joy: 0.7, bond: 0.3, safe: -0.4 },
                    run: (w2, a2) => { if (!today(w2, ctx)) return null; DECIDE.enqueue(w2, b, 'outing', { d: ctx.d, b: a2.agentId, spot }); return { k: '開口約了{b}', p: { b: b.name } }; } }];
        },
    }));
    // ---------- 朋友約你明天翹班 ----------
    DECIDE.kind('outing', Object.assign({}, G, {
        title: '朋友約你明天翹班', aiKind: 1,
        facts(w, a, ctx) { const b = w.agents[ctx.b]; const n = DAY.strikes(w, a); return fill('{b}約你明天上工時間一起溜去{s}。沒去上工就沒有那天的工資，東家也會知道。{n}', { b: b ? b.name : '', s: DAY.SPOT[ctx.spot] || '廣場', n: n ? { k: '這個月你已經 {n} 次沒去上工。', p: { n } } : { raw: '' } }); },
        options(w, a, ctx) {
            const b = w.agents[ctx?.b]; if (!today(w, ctx) || !b) return []; const r = DAY.S(w).t[a.agentId] || {}; const warned = DAY.S(w).warn[a.agentId] != null ? 1 : 0;
            return [{ id: 'yes', text: '好，一起去', say: { k: '答應{b}明天一起翹班', p: { b: b.name } }, why: '他都開口了，就偷一天閒。', base: 0.4 + Math.min(0.7, aff(a, b) / 80) + (has(a, 'lazy') ? 0.4 : 0) + ((r.cups || 0) >= 4 ? 0.4 : 0) - warned * 0.8 - (poor(w, a) ? 0.4 : 0), lean: { joy: 0.5, bond: 0.5, safe: -0.5 }, run: (w2, a2) => { if (!today(w2, ctx)) return null; DAY.setPact(w2, a2, b, ctx.spot); return { k: '跟{b}約好了', p: { b: b.name } }; } },
                { id: 'after', text: '上工不行，放工後再去', say: { k: '跟{b}說放工後再聚', p: { b: b.name } }, why: '想去，但不能不上工。', base: 1.2, lean: { bond: 0.4, safe: 0.3 }, run: (w2, a2) => { try { b.memory?.addT?.(w2.tickCount, w2.clock?.timeStr || '', 'daily', '約{a}明天翹班，他說放工後再說。', { a: a2.name }, 3, [a2.name]); } catch (e) {} return null; } },
                { id: 'no', text: '不要，也勸他別翹', say: { k: '拒絕了{b}，還勸他別翹班', p: { b: b.name } }, why: '這種事被東家知道不好。', base: 0.7 + (has(a, 'hardworking') ? 0.6 : 0) + warned * 0.5, lean: { safe: 0.5, gain: 0.3 }, run: (w2, a2) => { try { b.relationships?.getOrCreate?.(a2.agentId, a2.name)?.modifyAffinity?.(-1); b.memory?.addT?.(w2.tickCount, w2.clock?.timeStr || '', 'daily', '約{a}明天翹班，被他念了一頓。', { a: a2.name }, 4, [a2.name]); } catch (e) {} return null; } }];
        },
    }));

    // ---------- 夥計沒來上工：東家怎麼辦 ----------
    DECIDE.kind('noshow', Object.assign({}, G, {
        title: '夥計沒來上工', aiKind: 2,
        facts(w, a, ctx) { const x = w.agents[ctx.x]; return fill(ctx.lie ? '{x}今天說身體不舒服請了假，卻有人看到他在外面晃。{n}{tie}' : '{x}今天沒來上工，也沒說一聲。{n}{tie}', { x: x ? x.name : '', n: { k: '這是他這個月第 {n} 次。', p: { n: Math.max(1, ctx.n || 1) } }, tie: x ? (aff(a, x) >= 30 ? '你跟他交情不錯。' : aff(a, x) < -10 ? '你本來就看他不順眼。' : '') : '' }); },
        options(w, a, ctx) {
            const x = w.agents[ctx?.x]; if (!x || !x.job || x.isDead || DAY.S(w).t[x.agentId]?.boss) return []; const n = Math.max(1, ctx.n || 1), lie = ctx.lie ? 1 : 0;
            const run = (how) => (w2, a2) => DAY.punish(w2, a2, x, how, ctx);
            const out = [{ id: 'let', text: '算了，誰沒有不想動的日子', say: { k: '沒跟{x}計較', p: { x: x.name } }, why: '', mute: true, base: 1.0 + Math.min(0.6, aff(a, x) / 60) + (has(a, 'kind') ? 0.4 : 0) - (n - 1) * 0.4 - lie * 0.4, lean: { bond: 0.5 }, run: run('let') },
                { id: 'scold', text: '當面訓他一頓', say: { k: '訓了{x}一頓', p: { x: x.name } }, why: '不說他，下次還會再犯。', base: 1.0 + (n - 1) * 0.2 + (has(a, 'abrasive') ? 0.4 : 0) + lie * 0.3, lean: { face: 0.4 }, run: run('scold') },
                { id: 'dock', text: '扣他兩天工資', say: { k: '扣了{x}的工資', p: { x: x.name } }, why: '沒做事還想領錢？', base: 0.6 + (n - 1) * 0.4 + (has(a, 'greedy') ? 0.5 : 0) + lie * 0.5, lean: { gain: 0.5 }, run: run('dock') }];
            if (n >= 3 || (lie && n >= 2)) out.push({ id: 'fire', text: '請他走人', say: { k: '開除了{x}', p: { x: x.name } }, why: '三番兩次這樣，留不得。', base: 0.3 + (n - 2) * 0.5 + lie * 0.4 - Math.min(0.6, Math.max(0, aff(a, x)) / 60), lean: { face: 0.3, gain: 0.2, bond: -0.6 }, run: run('fire') });
            return out;
        },
    }));

    // ---------- 喝多了，死對頭就在旁邊 ----------
    DECIDE.kind('drunkrow', Object.assign({}, G, {
        title: '喝多了，死對頭就在旁邊', aiKind: 2,
        facts(w, a, ctx) { const o = w.agents[ctx.o]; const r = DAY.S(w).t[a.agentId] || {}; return fill('你在酒館已經喝了 {n} 杯，{o}就坐在不遠的地方（你對他 {f}）。動手的話兩個人都可能受傷，在場的人都看得到。', { n: r.cups || 0, o: o ? o.name : '', f: Math.round(aff(a, o)) }); },
        options(w, a, ctx) {
            const o = w.agents[ctx?.o]; if (!today(w, ctx) || !o || o.isDead || o.currentLocation !== a.currentLocation) return []; const r = DAY.S(w).t[a.agentId] || {};
            return [{ id: 'ignore', text: '當作沒看到，喝自己的', say: '沒理他', why: '', mute: true, base: 1.6 + (has(a, 'stoic') ? 0.3 : 0), lean: { safe: 0.4 }, run: () => null },
                { id: 'taunt', text: { k: '過去嗆{o}幾句', p: { o: o.name } }, say: { k: '借著酒意嗆了{o}', p: { o: o.name } }, why: '喝了酒，話就藏不住了。', base: 0.9 + (has(a, 'abrasive') ? 0.3 : 0) - (has(a, 'shy') ? 0.3 : 0), lean: { face: 0.3, safe: -0.2 }, run: (w2, a2) => { try { w2.publicFeud(a2, o); } catch (e) {} return { k: '跟{o}吵了起來', p: { o: o.name } }; } },
                { id: 'hit', text: { k: '對{o}動手', p: { o: o.name } }, say: { k: '對{o}動了手', p: { o: o.name } }, why: '看到他那張臉就一肚子火。', base: 0.2 + (has(a, 'abrasive') ? 0.5 : 0) + (has(a, 'jealous') ? 0.2 : 0) - (has(a, 'kind') ? 0.5 : 0) - (has(a, 'stoic') ? 0.4 : 0) + ((r.cups || 0) >= 6 ? 0.4 : 0) + (aff(a, o) <= -55 ? 0.3 : 0), lean: { face: 0.4, safe: -0.6, bond: -0.3 }, run: (w2, a2) => DAY.strike(w2, a2, o, { drunk: 1 }) }];
        },
    }));
    // ---------- 有人對你動手 ----------
    DECIDE.kind('struck', Object.assign({}, G, {
        title: '有人對你動手', aiKind: 2,
        facts(w, a, ctx) { const b = w.agents[ctx.by]; const n = Object.values(w.agents).filter(x => x !== a && x !== b && !x.isPlayer && !x.isDead && x.currentLocation === a.currentLocation && x.activity !== 'sleeping').length; return fill('{b}{dr}對你動手了。旁邊有 {n} 個人看著。還手的話誰輸誰贏很難說，兩個人都可能受傷。', { b: b ? b.name : '', dr: ctx.drunk ? '喝多了，' : '', n }); },
        options(w, a, ctx) {
            const b = w.agents[ctx?.by]; if (!b || b.isDead) return []; const sk = a.skills?.get?.('近戰')?.level || 0;
            return [{ id: 'back', text: '還手', say: { k: '還手跟{b}打了起來', p: { b: b.name } }, why: '不能讓人這樣欺負。', base: 1.0 + (has(a, 'abrasive') ? 0.4 : 0) + Math.min(0.5, sk * 0.05) - (has(a, 'shy') ? 0.4 : 0) - ((a.age ?? 30) >= 60 ? 0.5 : 0), lean: { face: 0.5, safe: -0.4 }, run: (w2, a2) => { const x = DAY.brawl(w2, b, a2, true); return { k: x.loser === a2 ? '還了手，但是打輸了' : '還了手，把{b}打退了', p: { b: b.name } }; } },
                { id: 'cover', text: '護著自己退開，不還手', say: { k: '沒有還手，從{b}面前退開', p: { b: b.name } }, why: '跟這種人打起來不值得。', base: 1.0 + (has(a, 'kind') ? 0.3 : 0) + (has(a, 'shy') ? 0.3 : 0) + (has(a, 'stoic') ? 0.2 : 0), lean: { safe: 0.6 }, run: (w2, a2) => { DAY.brawl(w2, b, a2, false); return { k: '挨了打，沒有還手' }; } }];
        },
    }));
    // ---------- 碰上死對頭：多一個「動手」（以前打架是每天擲骰） ----------
    { const K = DECIDE.KINDS.feud; if (K && typeof K.options === 'function') { const _o = K.options;
        K.options = function (w, a, ctx) {
            const out = _o.call(this, w, a, ctx) || []; if (!DAY.on(w) || !out.length) return out; const calm = out[0]; const r = DAY.S(w).t[a.agentId] || {};
            for (const op of out.slice()) { const m = /^go:(.+)$/.exec(String(op.id)); const b = m && w.agents[m[1]]; if (!b || aff(a, b) > -55) continue;
                out.push({ id: 'hit:' + b.agentId, quiet: true, text: { k: '對{o}動手', p: { o: b.name } }, say: { k: '對{o}動了手', p: { o: b.name } }, why: '跟他講不通，只有拳頭他才懂。',
                    base: (calm.base || 0) - 1.3 + (has(a, 'abrasive') ? 0.5 : 0) + (has(a, 'jealous') ? 0.2 : 0) + (has(a, 'neurotic') ? 0.2 : 0) - (has(a, 'stoic') ? 0.4 : 0) - (has(a, 'kind') ? 0.5 : 0) + ((r.cups || 0) >= 4 ? 0.6 : 0) + (aff(a, b) <= -80 ? 0.3 : 0), lean: { face: 0.4, safe: -0.7, bond: -0.3 },
                    run: (w2, a2) => { if (!w2.feudCands(a2).some(y => y.b === b)) return { k: '沒有碰上' }; return DAY.strike(w2, a2, b, {}); } }); }
            return out; }; } }

    DECIDE.source('now', (w, a) => DAY.line(w, a));
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, { hangover: { mood: -4, opinion: 0, days: 1, label: t('宿醉') } });
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.dayx = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.dayx) { const { _rolled, ...rest } = this.dayx; d.dayx = rest; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.dayx = (data?.dayx && typeof data.dayx === 'object') ? data.dayx : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.DAY = DAY;
