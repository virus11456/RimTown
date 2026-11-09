// RimTown - sim-steam.js：v8.0.0 科技路線 🚂 蒸汽煉金
// 三個時代：🚂 蒸汽（蒸汽動力、高壓鍋爐、齒輪工坊、氣動管道、煉金化學）→ ⚗️ 煉金（差分機、飛艇、蒸汽機甲、元素提煉、濾煙塔）
// → ✨ 以太（專屬：發條人偶、以太引擎、浮空城、賢者之石、人造人）。第四、五時代大家都能研究，第六時代只有走蒸汽煉金的小鎮能研究。
// 煉金要齒輪工坊；賢者之石、人造人要煉金工坊。新建築：齒輪工坊、煉金工坊、提煉廠、飛艇碼頭、浮空城區。
// 很需要人手：高壓鍋爐、齒輪工坊、蒸汽機甲讓礦工、鐵匠、木匠的職缺變多（電子機械是變少）；工會強的小鎮比較會選它。
// 代價是煤煙（world.tech.steam.smog，0～100）：鍋爐、工坊、提煉廠、發電廠每天排煙，煙每天散掉一點；煙越濃天空越暗（3D 畫面）、
// 越多人咳嗽得肺病。走蒸汽煉金的小鎮什麼都靠鍋爐（煙 ×1.6），走電子機械的改用電（×0.8）；清潔空氣法減半、濾煙塔少三成、以太引擎再減半。
// 社會問題跟著科技走（不看路線）：🟡 鍋爐燙傷、煤灰染黑衣服、礦工咳嗽、氣動管道送錯信、童工、煉金臭味、坐飛艇；
// 🟠 鍋爐爆炸、黑霧一週、點金騙局、蒸汽機甲失控、人造人要名字；🔴 大黑霧（倫敦 1952 那種：冬天起霧、煙散不掉，老人和肺不好的人撐不過）。
// 法律：清潔空氣法（煙減半、蓋東西慢一點）、工廠法（工時與童工：燙傷爆炸少一半、做工慢一點）、禁造人造人。
// v8.7.0 賢者之石凝聚以太（療癒、驅動造物、讓一個人長生，見 sim-longevity.js），不產銀幣（銀幣守恆）。點金騙局的錢從投資的人錢包轉到騙子錢包。存在 world.tech.steam。
'use strict';

const STEAM = (function () {
    const S = (w) => { const T = TECH.S(w); if (!T.steam || typeof T.steam !== 'object') T.steam = {}; const X = T.steam; X.smog = X.smog || 0; X.st = X.st || {}; return X; };
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const built = (w, k) => TECH.built(w, k);
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const day = (w) => TECH.day(w);
    const ad = (w) => TECH.adults(w);
    const pick = (w, f) => TECH.pick(w, f); const pickN = (w, n, f) => TECH.pickN(w, n, f);
    const aff = (a, b, n) => TECH.aff(a, b, n);
    const mem = (w, a, k, p, imp) => TECH.mem(w, a, k, p, imp);
    const names = (arr) => TECH.names(arr);
    const owner = (w, a) => TECH.owner(w, a);
    const member = (w, a) => { try { return typeof UNION !== 'undefined' && UNION.isMember(w, a); } catch (e) { return false; } };
    const lungBad = (w, a) => { try { if (typeof HEALTH === 'undefined' || !w.health) return false; return (HEALTH.ails(w, a) || []).some(x => x.p === 'l') || HEALTH.body(w, a).l < 60; } catch (e) { return false; } };
    const MK_RANK = { lung: 1, burn: 2, scammed: 2, boiler_grief: 3, smog_grief: 3, bereaved: 3, leak0: 3 }; // 重的事蓋過輕的(家人過世 > 被騙、燙傷 > 咳嗽)
    const mark = (w, a, m) => { const T = TECH.S(w); const cur = T.mk[a.agentId]; if (!cur || (MK_RANK[m] || 1) >= (MK_RANK[cur] || 2)) T.mk[a.agentId] = m; };
    const WORK = ['miner', 'blacksmith', 'carpenter'];

    // ---------- 門檻:煉金要齒輪工坊;賢者之石、人造人要煉金工坊;禁造人造人 ----------
    TECH.GATES.steam = (w, p, e) => {
        if (e === 5) return built(w, 'gear_workshop');
        if (e >= 6) { if (p.key === 'homunculus' && S(w).homunban) return false; if (['philosopher_stone', 'homunculus'].includes(p.key)) return built(w, 'alchemy_lab'); }
        return true;
    };

    // ---------- 村民傾向、小鎮吸引力、投票理由 ----------
    TECH.PREFER.steam = (w, a) => {
        let s = 0.3; const k = a.job?.key;
        s += ({ miner: 1.8, blacksmith: 1.6, carpenter: 1, tailor: 0.6, researcher: 0.4, trader: 0.3, guard: 0.2, farmer: -0.6, fisher: -0.3, doctor: -1.2, priest: -0.6 })[k] || 0;
        if (member(w, a)) s += 1.5; // 蒸汽要人手:工會的人知道這條路不會被機器搶飯碗
        if (TECH.S(w).mk[a.agentId] === 'laid') s += 1.5; // 被電子機械的機器裁過員
        const st = a.techStance || 'moderate'; s += st === 'progressive' ? 0.5 : st === 'conservative' ? -0.3 : 0;
        if (hasV(a, '冒險')) s += 1.2; if (hasV(a, '財富')) s += 0.4; if (hasV(a, '傳統')) s += 0.3; if (hasV(a, '知識')) s += 0.3; if (hasV(a, '自然')) s -= 1.5; if (hasV(a, '健康')) s -= 0.8;
        if (hasT(a, 'hardworking')) s += 0.6; if (hasT(a, 'lazy')) s -= 0.4; if (hasT(a, 'optimist')) s += 0.3;
        if (lungBad(w, a)) s -= 1;
        const age = a.age ?? 30; if (age < 30) s += 0.4; else if (age >= 55) s -= 0.3; // 年輕人想坐飛艇
        return s;
    };
    TECH.APPEAL.steam = (w, A, share) => {
        let s = 0; const U = w.union;
        if (U?.on) { const m = share(a => member(w, a)); s += m >= 0.35 ? 0.8 : m >= 0.2 ? 0.5 : 0.2; }
        if (share(a => WORK.includes(a.job?.key)) >= 0.2) s += 0.4;
        if ((TECH.S(w).st?.laid || 0) > 0) s += 0.3;
        if ((w.stockpile?.get?.('stone') || 0) >= A.length * 4) s += 0.2; // 石頭和礦多
        return s;
    };
    TECH.WHY_FOR.steam = (w, a) => member(w, a) || WORK.includes(a.job?.key) || TECH.S(w).mk[a.agentId] === 'laid' ? 'steam_hands' : hasV(a, '冒險') || (a.age ?? 30) < 30 ? 'steam_sky' : 'growth';
    TECH.WHY_NO.push((w, a, opts) => opts.includes('steam') && (['farmer', 'doctor'].includes(a.job?.key) || hasV(a, '自然') || lungBad(w, a)) ? 'steam_smoke' : null);
    // 很需要人手:職缺變多(蒸汽);發條人偶、人造人才會搶工作
    const HANDS = { high_pressure: { miner: 1.15, blacksmith: 1.1 }, gear_works: { blacksmith: 1.1, carpenter: 1.05 }, steam_mech: { carpenter: 1.1, miner: 1.05 } };
    TECH.JOBX.push((w, k) => { let m = 1; for (const [tk, map] of Object.entries(HANDS)) if (map[k] && done(w, tk)) m *= map[k]; return m; });
    Object.assign(TECH.AUTO, { clockwork_automaton: { miner: 0.85, cook: 0.9 }, homunculus: { farmer: 0.9, carpenter: 0.9 } });
    const homunOn = (w) => done(w, 'homunculus') && !S(w).homunban;
    TECH.JOBX.push((w, k) => (done(w, 'homunculus') && S(w).homunban && TECH.AUTO.homunculus[k] ? 1 / TECH.AUTO.homunculus[k] : 1)); // 禁造之後人造人不再搶工作

    // ---------- 煤煙 ----------
    const SMOG_SRC = [['steam_power', 0.2, 'tech'], ['high_pressure', 0.3, 'tech'], ['steam_mech', 0.2, 'tech'], ['gear_workshop', 0.3, 'b'], ['refinery', 0.5, 'b'], ['airship_dock', 0.1, 'b'], ['power_plant', 0.3, 'b']];
    function smogAdd(w) {
        let a = 0; for (const [k, v, ty] of SMOG_SRC) if (ty === 'tech' ? done(w, k) : built(w, k)) a += v;
        const X = S(w); const P = TECH.pathOf(w); let m = P === 'steam' ? 1.6 : P === 'electro' ? 0.8 : 1; // 走蒸汽煉金:什麼都靠燒煤的鍋爐;走電子機械:改用電,鍋爐少
        if (X.air) m *= 0.5; if (done(w, 'smoke_filter')) m *= 0.7; if (done(w, 'aether_engine')) m *= 0.5;
        return a * m;
    }
    const smogLv = (w) => { const v = S(w).smog; return v >= 40 ? 'black' : v >= 25 ? 'grey' : v >= 10 ? 'haze' : 'clear'; };
    const SMOG_WORD = { clear: '天空乾淨', haze: '有一點煙', grey: '天空灰濛濛', black: '天空被煤煙燻黑' };
    function smogDaily(w, X, d) {
        X.smog = Math.max(0, Math.min(100, X.smog * 0.96 + smogAdd(w)));
        if (X.smog < 30) return;
        // 煙越濃越多人咳嗽:老人、小孩、礦工、本來肺就不好的人先倒
        const f = X.smog / 30;
        for (const a of TECH.npcs(w)) {
            const age = a.age ?? 30; let p = 0.001 * f * (age >= 60 || age < 10 ? 2 : 1) * (a.job?.key === 'miner' ? 1.5 : 1) * (lungBad(w, a) ? 1.5 : 1);
            if (Math.random() < p) { TECH.addAil(w, a, { p: 'l', k: 'disease', s: 1, dmg: 6 }, '煤煙'); mark(w, a, 'lung'); X.st.lung = (X.st.lung || 0) + 1; }
        }
        if (X.smog >= 40 && d % 7 === 0) for (const a of ad(w)) if (hasV(a, '自然') || hasV(a, '健康')) a.moodModifier = (a.moodModifier || 0) - 2;
    }

    // ---------- 🟡🟠🔴 社會問題 ----------
    const factory = (w) => !!S(w).factory;
    const EVENTS = [
        { id: 'scald', path: 'steam', lv: 'minor', icon: '♨️', need: (w) => done(w, 'high_pressure'), run(w) {
            if (factory(w) && Math.random() < 0.5) return null; const a = pick(w, x => WORK.includes(x.job?.key)); if (!a) return null;
            TECH.addAil(w, a, { p: 'h', k: 'injury', s: 1, dmg: 10 }, '被鍋爐的蒸汽燙傷'); mark(w, a, 'burn'); mem(w, a, '鍋爐的閥門沒鎖緊，一口蒸汽噴在我手上。', {}, 6);
            return { k: '♨️ {a}被鍋爐噴出的蒸汽燙傷了手，包著繃帶還是得回去上工。', p: { a: a.name }, who: [a] }; } },
        { id: 'soot', path: 'steam', lv: 'minor', icon: '🧺', need: (w) => S(w).smog >= 25, run(w) {
            const a = pick(w, x => !WORK.includes(x.job?.key)); const o = pick(w, x => owner(w, x) && x !== a); if (!a) return null;
            a.moodModifier = (a.moodModifier || 0) - 3; if (o) { aff(a, o, -6); aff(o, a, -2); }
            return { k: o ? '🧺 {a}剛晾好的衣服被煤灰染成了灰色，抱著一籃髒衣服跑去找{b}理論。{b}說：「煙又不是只有我家在冒。」' : '🧺 {a}剛晾好的衣服被煤灰染成了灰色，只好全部重洗。', p: { a: a.name, b: o?.name || '' }, who: o ? [a, o] : [a] }; } },
        { id: 'cough', path: 'steam', lv: 'minor', icon: '😷', need: (w) => done(w, 'high_pressure'), run(w) {
            const a = pick(w, x => x.job?.key === 'miner') || pick(w, x => WORK.includes(x.job?.key)); if (!a) return null; const d = pick(w, x => x.job?.key === 'doctor' && x !== a);
            TECH.addAil(w, a, { p: 'l', k: 'disease', s: 1, dmg: 6 }, '吸了太多煤灰'); mark(w, a, 'lung'); mem(w, a, '最近咳出來的痰都是黑的。', {}, 6);
            return { k: d ? '😷 {a}咳出來的痰都是黑的。{b}叫他少下礦坑，{a}說不下礦坑家裡就沒飯吃。' : '😷 {a}咳出來的痰都是黑的，還是每天照常上工。', p: { a: a.name, b: d?.name || '' }, who: d ? [a, d] : [a] }; } },
        { id: 'tube_mix', path: 'steam', lv: 'minor', icon: '📨', need: (w) => done(w, 'pneumatic_tubes'), run(w) {
            // 氣動管道把一封信送錯了人:暗戀的信最好笑
            for (const a of ad(w)) for (const [id, rel] of Object.entries(a.relationships?.relationships || a.relationships?.map || {})) {
                const b = w.agents[id]; if (!b || b.isDead || (rel.romanticInterest || 0) < 25 || a.relationships?.getSpouse?.() === id) continue;
                const c = pick(w, x => x !== a && x !== b); if (!c) continue;
                aff(c, a, Math.random() < 0.5 ? 4 : -3); mem(w, a, '寫給{b}的信被管道送到{c}家去了，我想找個地洞鑽進去。', { b: b.name, c: c.name }, 7); mem(w, c, '收到{a}寄錯的情書，寫給{b}的。', { a: a.name, b: b.name }, 6);
                if (Math.random() < 0.4) aff(b, a, 5);
                return { k: '📨 氣動管道把{a}寫給{b}的情書送到了{c}家。{c}讀完才發現收件人不是自己，全鎮笑了一整天。', p: { a: a.name, b: b.name, c: c.name }, who: [a, b, c] };
            }
            const a = pick(w, () => true); const c = pick(w, x => x !== a); if (!a || !c) return null;
            return { k: '📨 氣動管道把{a}的帳單送到了{b}家，{b}嚇了一跳，以為自己欠了一大筆錢。', p: { a: a.name, b: c.name }, who: [a, c] }; } },
        { id: 'child_labor', path: 'steam', lv: 'minor', icon: '🧒', need: (w) => built(w, 'gear_workshop') && !factory(w), run(w) {
            const kid = TECH.npcs(w).find(x => (x.age ?? 30) >= 9 && (x.age ?? 30) < 15); if (!kid) return null; const o = pick(w, x => owner(w, x)); const c = pick(w, x => hasT(x, 'kind') || x.job?.key === 'doctor' || x.job?.key === 'priest');
            if (Math.random() < 0.3) TECH.addAil(w, kid, { p: 'h', k: 'injury', s: 1, dmg: 6 }, '被齒輪夾到');
            if (c && o) aff(c, o, -8); const X = S(w); X.kids = (X.kids || 0) + 1; if (X.kids >= 2 && Math.random() < 0.6) X.pendFactory = day(w) + 2;
            return { k: c ? '🧒 才{n}歲的{a}在齒輪工坊裡鑽進機器底下撿零件。{b}看了直搖頭：「這種年紀應該在學堂。」' : '🧒 才{n}歲的{a}在齒輪工坊裡鑽進機器底下撿零件，一天賺兩個銅板。', p: { n: Math.floor(kid.age ?? 12), a: kid.name, b: c?.name || '' }, who: c ? [kid, c] : [kid] }; } },
        { id: 'alch_smell', path: 'steam', lv: 'minor', icon: '🟣', need: (w) => built(w, 'alchemy_lab'), run(w) {
            const r = pick(w, x => x.job?.key === 'researcher'); const n = pick(w, x => x !== r && x.job?.key !== 'researcher'); if (!n) return null; if (r) aff(n, r, -5); n.moodModifier = (n.moodModifier || 0) - 2;
            return { k: r ? '🟣 煉金工坊冒出一陣紫色的臭煙，{a}捏著鼻子去敲門，{b}探出頭說：「快成功了，再三天。」他上個月也這麼說。' : '🟣 煉金工坊冒出一陣紫色的臭煙，整條街都聞得到。', p: { a: n.name, b: r?.name || '' }, who: r ? [n, r] : [n] }; } },
        { id: 'airship_ride', path: 'steam', lv: 'minor', icon: '🎈', need: (w) => built(w, 'airship_dock'), run(w) {
            const kids = TECH.npcs(w).filter(x => (x.age ?? 30) < 15); for (const k of kids) k.moodModifier = (k.moodModifier || 0) + 4;
            const y = pick(w, x => (x.age ?? 30) < 40); const o = pick(w, x => (x.age ?? 30) >= 60); if (y) { y.moodModifier = (y.moodModifier || 0) + 3; mem(w, y, '坐上飛艇往下看，小鎮小得像玩具。', {}, 6); }
            return { k: o && y ? '🎈 飛艇載著鎮民繞小鎮一圈，{a}從上面往下揮手，孩子們追著影子跑。{b}站在地上說什麼也不肯上去：「人就該踩在地上。」' : '🎈 飛艇載著鎮民繞了小鎮一圈，孩子們追著影子跑。', p: { a: y?.name || '', b: o?.name || '' }, who: [y, o].filter(Boolean) }; } },
        // 🟠 中事
        { id: 'boiler_burst', path: 'steam', lv: 'mid', icon: '💥', need: (w) => done(w, 'high_pressure') && (built(w, 'gear_workshop') || built(w, 'refinery')), run(w) {
            if (factory(w) && Math.random() < 0.5) return null;
            const hit = pickN(w, 2 + (Math.random() < 0.4 ? 1 : 0), x => WORK.includes(x.job?.key)); if (!hit.length) return null; const X = S(w); const T = TECH.S(w);
            for (const a of hit) { TECH.addAil(w, a, { p: Math.random() < 0.5 ? 'h' : 'f', k: 'injury', s: 2, dmg: 18 }, '鍋爐爆炸'); mark(w, a, 'burn'); }
            let dead = null; if (Math.random() < 0.2) { dead = hit[0]; dead._deathCause = t('鍋爐爆炸'); try { w.lifecycle?._killNpc?.(w, dead); } catch (e) {} T.st.died++; for (const f of (typeof MONEY !== 'undefined' ? MONEY.familyOf(w, dead) : [])) if (!f.isDead && f !== dead) { mark(w, f, 'boiler_grief'); mem(w, f, '鍋爐爆炸奪走了我的家人。', {}, 9); } }
            const o = pick(w, x => owner(w, x)); if (o) for (const a of hit) if (!a.isDead) aff(a, o, -12);
            X.st.burst = (X.st.burst || 0) + 1; if (Math.random() < 0.7) X.pendFactory = day(w) + 2;
            return { k: dead ? '💥 工坊的鍋爐爆炸了！{dead}當場罹難，{n}被燙傷抬了出來。大家都說那個鍋爐早就該換了。' : '💥 工坊的鍋爐爆炸了！{n}被燙傷抬了出來。大家都說那個鍋爐早就該換了。', p: { dead: dead ? t(dead.name) : '', n: names(hit.filter(a => a !== dead)) }, who: hit, blame: o, sev: dead ? 2 : 1 }; } },
        { id: 'smog_week', path: 'steam', lv: 'mid', icon: '🌫️', need: (w) => S(w).smog >= 40, run(w) {
            const X = S(w); const hit = pickN(w, 3 + Math.floor(Math.random() * 2), x => (x.age ?? 30) >= 55 || lungBad(w, x) || x.job?.key === 'miner'); if (!hit.length) return null;
            for (const a of hit) { TECH.addAil(w, a, { p: 'l', k: 'disease', s: 1 + (Math.random() < 0.3 ? 1 : 0), dmg: 10 }, '黑霧'); mark(w, a, 'lung'); }
            TECH.moodAll(w, -3); if (Math.random() < 0.7) X.pendAir = day(w) + 2;
            return { k: '🌫️ 一整個星期太陽都沒露臉，煤煙壓在鎮上散不掉。{n}咳得睡不著，醫生那裡排滿了人。', p: { n: names(hit) }, who: hit, sev: 1 }; } },
        { id: 'gold_fever', path: 'steam', lv: 'mid', icon: '🪙', need: (w) => (done(w, 'element_refining') || done(w, 'philosopher_stone')) && typeof WALLET !== 'undefined' && !S(w).scam, run(w) {
            const q = pick(w, x => (hasT(x, 'charismatic') || hasT(x, 'greedy') || hasT(x, 'abrasive') || x.job?.key === 'researcher') && (x.age ?? 30) < 60); if (!q) return null;
            const inv = pickN(w, 2 + Math.floor(Math.random() * 2), x => x !== q && WALLET.get(w, x) >= 20 && (hasT(x, 'greedy') || hasV(x, '財富') || hasT(x, 'optimist') || Math.random() < 0.3)); if (!inv.length) return null;
            let sum = 0; const paid = []; for (const a of inv) { const n = Math.min(40, Math.max(8, Math.round(WALLET.get(w, a) * 0.25))); if (WALLET.pay(w, a, q, n, t('點金術投資'))) { sum += n; paid.push(a.agentId); mem(w, a, '把 {n} 銀幣交給{q}去煉銀子，說好一個月後翻倍。', { n, q: q.name }, 6); } }
            if (!paid.length) return null; S(w).scam = { q: q.agentId, v: paid, d: day(w), sum }; mem(w, q, '說自己會用煉金術把鉛變成銀子，收了一筆投資。', {}, 7);
            return { k: '🪙 {q}說自己找到把鉛變成銀子的配方，{n}一共投了 {s} 銀幣，等著一個月後翻倍。', p: { q: q.name, n: names(inv.filter(a => paid.includes(a.agentId))), s: sum }, who: [q, ...inv.filter(a => paid.includes(a.agentId))], sev: 1 }; } },
        { id: 'mech_rampage', path: 'steam', lv: 'mid', icon: '🦾', need: (w) => done(w, 'steam_mech') && day(w) - (S(w).lastMech ?? -99) >= 60, run(w) { // 一陣子才一次(不要每個月都撞牆)
            S(w).lastMech = day(w); const op = pick(w, x => ['carpenter', 'miner'].includes(x.job?.key)); if (!op) return null; const v = pick(w, x => x !== op);
            if (v && Math.random() < 0.5) TECH.addAil(w, v, { p: 'f', k: 'injury', s: 1, dmg: 8 }, '被機甲撞到');
            for (const [r, n] of [['wood', 15], ['stone', 15]]) { const have = w.stockpile?.get?.(r) || 0; const k = Math.min(have, n); if (k > 0) w.stockpile.consume(r, k, w.tickCount, t('機甲失控'), 'event'); }
            if (v) aff(v, op, -10); mem(w, op, '蒸汽機甲的煞車卡住了，我怎麼拉都拉不住。', {}, 7);
            return { k: v ? '🦾 {a}操作的蒸汽機甲煞車卡死，一路撞穿了倉庫的牆，{b}閃得慢被擦傷。{a}從駕駛座爬出來只說了一句：「它自己要走的。」' : '🦾 {a}操作的蒸汽機甲煞車卡死，一路撞穿了倉庫的牆。', p: { a: op.name, b: v?.name || '' }, who: v ? [op, v] : [op], sev: 1 }; } },
        { id: 'homun_ask', path: 'steam', lv: 'mid', icon: '🧪', need: (w) => homunOn(w), run(w) {
            const X = S(w); const pr = pick(w, x => TECH.devoutA(w, x) || x.job?.key === 'priest'); const k = pick(w, x => hasT(x, 'kind') && x !== pr); const o = pick(w, x => owner(w, x));
            if (pr && k) { aff(pr, k, -5); aff(k, pr, -5); } if (o && k) aff(k, o, -4); TECH.moodAll(w, -1); if (Math.random() < 0.6) X.pendHomun = day(w) + 3;
            return { k: '🧪 在田裡幹活的人造人放下鋤頭，問工頭它能不能有一個名字。{a}說它根本不是人，{b}說會問這種問題的就是人。鎮上吵成一團。', p: { a: pr?.name || t('有人'), b: k?.name || t('也有人') }, who: [pr, k].filter(Boolean), sev: 1 }; } },
        // 🔴 大災:大黑霧(自己的機率:煙越濃越危險,冬天和起霧的日子加倍,清潔空氣法降到三分之一)
        { id: 'great_smog', path: 'steam', lv: 'big', icon: '🌑', own: (w) => {
            const X = S(w); if (X.smog < 35 || day(w) - (X.lastGreat ?? -999) < 120) return 0;
            const wt = w.weather?.current; const cold = (w.clock?.season === '冬季' ? 2 : 1) * (wt === 'fog' ? 2 : 1);
            return 0.05 / 60 * Math.pow(X.smog / 40, 2) * cold * (X.air ? 0.33 : 1); },
            need: (w) => S(w).smog >= 35, run(w) { return greatSmog(w); } },
    ];
    for (const e of EVENTS) TECH.EVENTS.push(e);
    TECH.BIG_TXT.great_smog = '不久前大黑霧';
    function greatSmog(w) {
        const X = S(w); const T = TECH.S(w); const d = day(w); const pop0 = TECH.npcs(w).length; if (pop0 < 4) return null;
        // 最先撐不過的:老人、肺不好的人、小孩
        const weak = TECH.npcs(w).filter(a => (a.age ?? 30) >= 65 || lungBad(w, a) || (a.age ?? 30) < 4).sort(() => Math.random() - 0.5);
        const nD = Math.min(weak.length, 1 + Math.floor(Math.random() * 3)); const dead = weak.slice(0, nD);
        const fam = new Set(); for (const a of dead) for (const f of (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : [])) fam.add(f);
        for (const a of dead) { a._deathCause = t('大黑霧'); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {} T.st.died++; }
        for (const f of fam) if (!f.isDead) { mark(w, f, 'smog_grief'); f.addThought?.('smog_grief', w); mem(w, f, '大黑霧那幾天，家人一口氣沒喘上來就走了。', {}, 9); }
        const sick = pickN(w, Math.max(2, Math.round(ad(w).length * (0.25 + Math.random() * 0.15))), () => true);
        for (const a of sick) { TECH.addAil(w, a, { p: 'l', k: 'disease', s: 2, dmg: 14 }, '大黑霧'); mark(w, a, 'lung'); }
        TECH.moodAll(w, -15); for (const a of TECH.npcs(w)) if (!fam.has(a)) { a.addThought?.('smog_fear', w); mem(w, a, '大黑霧罩了鎮上四天，伸手不見五指，到處都是咳嗽聲。', {}, 8); }
        // 有錢有孩子的先搬走
        const alive = ad(w).filter(a => !a.isDead).sort((x, y) => TECH.wal(w, y) - TECH.wal(w, x)); const leave = alive.slice(0, Math.ceil(alive.length / 2)).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(alive.length * (0.04 + Math.random() * 0.06))));
        for (const a of leave) { try { if (w.leaveTown?.(a.agentId, t('受不了煤煙，搬去空氣好的地方'))) T.st.left++; } catch (e) {} }
        // 當初反對清潔空氣法的老闆被怪罪
        for (const f of fam) for (const id of (X.airNo || [])) { const o = w.agents[id]; if (o && !o.isDead && o !== f) aff(f, o, -15); }
        try { if (typeof CALAMITY !== 'undefined' && CALAMITY.regress) CALAMITY.regress(w, t('大黑霧'), 8 + (dead.length / Math.max(1, pop0)) * 200 + (leave.length / Math.max(1, pop0)) * 80); } catch (e) {}
        X.lastGreat = d; X.smog *= 0.7; X.st.great = (X.st.great || 0) + 1; X.pendAir = X.air ? null : d + 1 + Math.floor(Math.random() * 3);
        const blame = (X.airNo || []).map(id => w.agents[id]).find(o => o && !o.isDead && owner(w, o)) || TECH.adults(w).filter(o => owner(w, o)).sort((x, y) => TECH.wal(w, y) - TECH.wal(w, x))[0] || null;
        return { k: '🌑 大黑霧！煤煙和濃霧在鎮上壓了四天，白天跟晚上一樣黑。{dead}沒撐過去，{s}人咳到下不了床，{l}人搬去空氣好的地方。', p: { dead: dead.length ? names(dead) : t('沒有人'), s: sick.length, l: leave.length }, who: dead, imp: 10, blame, sev: 3 };
    }

    // ---------- 法律 ----------
    const LAW = { steam_air: { icon: '🌫️', label: '清潔空氣法' }, steam_factory: { icon: '🏭', label: '工廠法' }, steam_homun: { icon: '🧪', label: '禁造人造人' } };
    function lawDaily(w, X, d) {
        const A = ad(w); if (!A.length) return; const top = (f) => A.slice().sort((x, y) => f(y) - f(x))[0];
        // 清潔空氣法:黑霧之後,或煙一直很濃、醫生看不下去
        if (!X.air && !TECH.busy(w, 'steam_air') && ((X.pendAir && d >= X.pendAir) || (X.smog >= 38 && d - (X.lastAirProp ?? -99) >= 45 && Math.random() < 0.04))) {
            X.pendAir = null; X.lastAirProp = d; const who = top(a => (a.job?.key === 'doctor' ? 3 : 0) + (TECH.S(w).mk[a.agentId] === 'smog_grief' ? 4 : 0) + (lungBad(w, a) ? 2 : 0) + (hasV(a, '自然') ? 1 : 0));
            TECH.propose(w, 'steam_air', 'steam', who, '制定清潔空氣法', '{who}說煤煙把鎮上燻得像煙囪裡一樣，提議訂清潔空氣法：工坊改燒乾淨一點的燃料、煙囪要加濾網。蓋東西會慢一點、老闆要多花錢，但煙會少一半。', {}, 'welfare');
        }
        // 工廠法:鍋爐爆炸、童工之後,通常由工會或醫生提
        if (!X.factory && !TECH.busy(w, 'steam_factory') && X.pendFactory && d >= X.pendFactory) {
            X.pendFactory = null; const lead = w.union?.on && w.agents[w.union.leader] && !w.agents[w.union.leader].isDead ? w.agents[w.union.leader] : null;
            const who = lead || top(a => (member(w, a) ? 2 : 0) + (TECH.S(w).mk[a.agentId] === 'burn' || TECH.S(w).mk[a.agentId] === 'boiler_grief' ? 3 : 0) + (hasT(a, 'kind') ? 1 : 0));
            TECH.propose(w, 'steam_factory', 'steam', who, '制定工廠法', '{who}提議訂工廠法：一天最多做十個鐘頭、十四歲以下不准進工坊、鍋爐每月檢查。燙傷和爆炸會少一半，工坊做事會慢一點。', {}, 'welfare');
        }
        // 禁造人造人
        if (!X.homunban && !TECH.busy(w, 'steam_homun') && X.pendHomun && d >= X.pendHomun) {
            X.pendHomun = null; const who = top(a => (TECH.devoutA(w, a) ? 3 : 0) + (TECH.mythGroup(w, a) === 'pure' ? 2 : 0) + (member(w, a) ? 1.5 : 0) + (hasV(a, '傳統') ? 1 : 0));
            TECH.propose(w, 'steam_homun', 'steam', who, '禁造人造人', '{who}提議禁止再造人造人：造出來的那些讓它們做到壞為止，不准再造新的。田裡和工地會少一些人手，但也不會再有「它算不算人」的問題。', {}, 'culture');
        }
    }
    function setLaw(w, kind) {
        const X = S(w); const d = day(w);
        if (kind === 'steam_air') { X.air = d; try { w.buildings?.recomputeEffects?.(w); } catch (e) {} TECH.log(w, '🌫️ 清潔空氣法上路：工坊改燒乾淨的燃料、煙囪加了濾網，煙少了一半，蓋東西也慢了一點。', {}); TECH.news(w, '🌫️ 清潔空氣法上路', {}, 7, []); return t('清潔空氣法上路'); }
        if (kind === 'steam_factory') { X.factory = d; try { w.buildings?.recomputeEffects?.(w); } catch (e) {} TECH.log(w, '🏭 工廠法上路：一天最多做十個鐘頭、孩子不准進工坊、鍋爐每月檢查。', {}); TECH.news(w, '🏭 工廠法上路', {}, 7, []); for (const a of ad(w)) if (member(w, a) || WORK.includes(a.job?.key)) a.moodModifier = (a.moodModifier || 0) + 3; return t('工廠法上路'); }
        if (kind === 'steam_homun') { X.homunban = d; const R = w.research; if (R?.current === 'homunculus') { R.projects.homunculus.status = 'available'; R.current = null; } try { w.buildings?.recomputeEffects?.(w); } catch (e) {} TECH.log(w, '🧪 禁造人造人：已經造好的照常做工，不准再造新的。', {}); TECH.news(w, '🧪 小鎮禁造人造人', {}, 8, []); return t('禁造人造人'); }
        return '';
    }
    function vote(w, p, a) {
        const X = S(w); const k = a.job?.key; const m = TECH.S(w).mk[a.agentId]; let s = 0, why = 'gut';
        if (p.kind === 'steam_air') {
            s = 0.3 + (k === 'doctor' ? 2 : 0) + (m === 'smog_grief' ? 4 : 0) + (lungBad(w, a) ? 2 : 0) + (hasV(a, '自然') || hasV(a, '健康') ? 1.2 : 0) + (hasV(a, '家庭') ? 0.6 : 0) + (X.smog >= 40 ? 0.8 : 0)
                - (owner(w, a) ? 2 : 0) - (hasT(a, 'greedy') ? 1 : 0) - (k === 'blacksmith' ? 0.6 : 0);
            why = s > 0 ? (m === 'smog_grief' || lungBad(w, a) ? 'tech_victim' : 'steam_smoke') : (owner(w, a) ? 'boss' : 'growth');
        } else if (p.kind === 'steam_factory') {
            s = 0.2 + (member(w, a) ? 2.5 : 0) + (m === 'burn' || m === 'boiler_grief' ? 3 : 0) + (WORK.includes(k) ? 1 : 0) + (hasT(a, 'kind') ? 0.8 : 0) + (k === 'doctor' || k === 'priest' ? 0.8 : 0)
                - (owner(w, a) ? 2.5 : 0) - (hasT(a, 'greedy') ? 1 : 0) - (hasT(a, 'hardworking') && !member(w, a) ? 0.4 : 0);
            why = s > 0 ? (m ? 'tech_victim' : member(w, a) ? 'steam_union' : 'kind') : (owner(w, a) ? 'boss' : 'growth');
        } else if (p.kind === 'steam_homun') {
            const fear = TECH.AUTO.homunculus[k] ? 1.5 : 0; // 怕人造人搶工作
            s = (TECH.devoutA(w, a) ? 2 : 0) + (TECH.mythGroup(w, a) === 'pure' ? 1.5 : 0) + (hasV(a, '傳統') ? 1 : 0) + fear + (member(w, a) ? 0.8 : 0)
                - (owner(w, a) ? 2 : 0) - (k === 'researcher' ? 1.5 : 0) - (hasT(a, 'kind') ? 0.5 : 0) - 0.4;
            why = s > 0 ? (fear ? 'path_job' : TECH.devoutA(w, a) ? 'bio_god' : 'oldways') : (owner(w, a) ? 'boss' : k === 'researcher' ? 'tech_slow' : 'growth');
        }
        s += Math.random() - 0.5; return { v: s > 0 ? 'for' : 'against', why };
    }

    // ---------- 每天:煤煙、法律、提煉廠與賢者之石、點金騙局拆穿 ----------
    function daily(w) {
        if (!w?.research) return; const X = S(w); const d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        smogDaily(w, X, d); lawDaily(w, X, d);
        const sp = w.stockpile; const stone = () => sp?.get?.('stone') || 0;
        if (built(w, 'refinery') && stone() >= 3) { sp.consume('stone', 3, w.tickCount, t('提煉廠'), 'production'); sp.add('metal', 1, w.tickCount, t('提煉廠')); }
        // v8.7.0 賢者之石改成凝聚以太(療癒、驅動造物、讓一個人長生),見 sim-longevity.js
        // 點金騙局:一個月後該翻倍的銀子沒出現
        const q = X.scam; if (q && d - q.d >= 30) { X.scam = null; const k = w.agents[q.q]; if (k && !k.isDead) {
            const vs = q.v.map(id => w.agents[id]).filter(v => v && !v.isDead); for (const v of vs) { aff(v, k, -25); mark(w, v, 'scammed'); mem(w, v, '交給{q}的錢一毛都沒回來，鉛還是鉛。', { q: k.name }, 8); }
            for (const x of ad(w)) if (!vs.includes(x) && x !== k && Math.random() < 0.3) aff(x, k, -6); X.st.scam = (X.st.scam || 0) + 1;
            TECH.log(w, '🪙 說好一個月翻倍的銀子沒出現。{n}找上{q}，{q}說配方「差一味材料」。鉛還是鉛。', { n: names(vs), q: k.name }, k.name);
            try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: 'gold_fever', sev: 1, cause: t('點金騙局'), who: vs, blame: k }); } catch (e) {}
        } }
        for (const p of (w.proposals?.items || [])) if (p.kind === 'steam_air' && !p._noted && p.status !== 'open' && p.status !== 'shelved') { p._noted = true; X.airNo = Object.entries(p.votes || {}).filter(([, v]) => v === 'against').map(([id]) => id).slice(0, 40); }
    }
    function view(w) {
        const X = S(w); return { smog: Math.round(X.smog), lv: smogLv(w), word: t(SMOG_WORD[smogLv(w)]), add: Math.round(smogAdd(w) * 100) / 100, air: !!X.air, factory: !!X.factory, homunban: !!X.homunban, st: X.st, scam: !!X.scam, stone: done(w, 'philosopher_stone') };
    }
    function brief(w, a) {
        const m = TECH.S(w).mk?.[a.agentId];
        return m === 'lung' ? t('我被煤煙嗆得一直咳') : m === 'burn' ? t('我被鍋爐燙傷過') : m === 'boiler_grief' ? t('鍋爐爆炸奪走了我的家人') : m === 'smog_grief' ? t('大黑霧奪走了我的家人') : m === 'scammed' ? t('我把積蓄交給人煉銀子，全賠光了') : '';
    }
    function townBrief(w) {
        const X = w.tech?.steam; if (!X) return ''; const out = [];
        if (X.smog >= 25) out.push(t(SMOG_WORD[smogLv(w)])); if (X.air) out.push(t('有清潔空氣法')); if (X.factory) out.push(t('有工廠法')); 
        return out.join(t('，'));
    }
    // 3D 畫面:煙越濃天空越暗(0～1)
    const sky = (w) => { const v = w?.tech?.steam?.smog || 0; return Math.max(0, Math.min(1, (v - 12) / 40)); };
    return { S, EVENTS, LAW, HANDS, SMOG_SRC, smogAdd, smogLv, greatSmog, setLaw, vote, daily, view, brief, townBrief, sky, homunOn };
})();

// ---------- 科技樹 ----------
(function () {
    if (typeof RESEARCH_TREE === 'undefined') return;
    const T = RESEARCH_TREE;
    if (T.steam_power) T.steam_power.path = ['electro', 'steam']; // 蒸汽動力是兩條路線共同的起點
    const has = (k) => !!T[k]; const pre = (...ks) => ks; // v8.0.0 先照寫的保留,整批加進去之後才濾掉不存在的(以前同一批裡互相依賴的前置會被濾掉)
    const ADD = {
        // ---- 🚂 蒸汽(第四時代) ----
        high_pressure: { era: 4, path: 'steam', name: t('高壓鍋爐'), description: t('鍋爐壓得更緊、火燒得更旺：礦工和鐵匠要更多人手；煙也更多'), cost: 5600, prerequisites: pre('steam_power', 'metallurgy'), effects: { smithing_bonus: 1.1, stone_efficiency: 1.1 }, unlocks: [] },
        gear_works: { era: 4, path: 'steam', name: t('齒輪工坊'), description: t('大大小小的齒輪咬在一起：可以蓋齒輪工坊，鐵匠和木匠要更多人手'), cost: 5800, prerequisites: pre('steam_power', 'toolmaking'), effects: { smithing_bonus: 1.1, build_speed: 1.05 }, unlocks: ['gear_workshop'] },
        pneumatic_tubes: { era: 4, path: 'steam', name: t('氣動管道'), description: t('信件和小包裹咻一聲送到每一戶——偶爾會送錯人'), cost: 6000, prerequisites: pre('steam_power', 'engineering'), effects: { trade_bonus: 0.04, storage_bonus: 1.05 }, unlocks: [] },
        alchemy: { era: 4, path: 'steam', name: t('煉金化學'), description: t('坩堝、蒸餾瓶和一本寫滿符號的筆記：可以蓋煉金工坊'), cost: 6200, prerequisites: pre('chemistry', 'herbalism'), effects: { healing_bonus: 1.05, stone_efficiency: 1.05 }, unlocks: ['alchemy_lab'] },
        // ---- ⚗️ 煉金(第五時代) ----
        difference_engine: { era: 5, path: 'steam', name: t('差分機'), description: t('用齒輪算數學的機器：帳算得準、研究快一點'), cost: 12000, prerequisites: pre('gear_works', 'accounting'), effects: { research_bonus: 0.05, trade_bonus: 0.03 }, unlocks: [] },
        airship: { era: 5, path: 'steam', name: t('飛艇'), description: t('煉金氣體撐起的大氣囊：可以蓋飛艇碼頭，商隊和遠方的消息都來得快'), cost: 13000, prerequisites: pre('high_pressure', 'alchemy'), effects: { merchant_frequency: 0.2, discover_bonus: 0.05 }, unlocks: ['airship_dock'] },
        steam_mech: { era: 5, path: 'steam', name: t('蒸汽機甲'), description: t('兩個人操作的鋼鐵巨人：蓋房、搬石頭快很多，但很需要人手；煞車偶爾會卡'), cost: 14000, prerequisites: pre('high_pressure', 'gear_works'), effects: { build_speed: 1.15, stone_efficiency: 1.1, defense_bonus: 2 }, unlocks: [] },
        element_refining: { era: 5, path: 'steam', name: t('元素提煉'), description: t('從礦石裡提煉出純的金屬：可以蓋提煉廠（三份石頭換一份金屬）'), cost: 13500, prerequisites: pre('alchemy', 'high_pressure'), effects: { smithing_bonus: 1.15 }, unlocks: ['refinery'] },
        smoke_filter: { era: 5, path: 'steam', name: t('濾煙塔'), description: t('煙囪頂上加一層煉金濾網：煤煙少三成'), cost: 11500, prerequisites: pre('alchemy', 'engineering'), effects: { healing_bonus: 1.05 }, unlocks: [] },
        // ---- ✨ 以太(第六時代,專屬) ----
        clockwork_automaton: { era: 6, path: 'steam', name: t('發條人偶'), description: t('上緊發條就會做事的人偶：最危險的礦坑交給它，礦工和廚師的缺少一些'), cost: 22000, prerequisites: pre('difference_engine', 'steam_mech'), effects: { build_speed: 1.1, smithing_bonus: 1.1 }, unlocks: [] },
        aether_engine: { era: 6, path: 'steam', name: t('以太引擎'), description: t('不燒煤的引擎：研究和建造都快，煤煙再少一半；礦工從此挖得到以太礦'), cost: 24000, prerequisites: pre('element_refining', 'airship'), effects: { research_bonus: 0.08, build_speed: 1.1 }, unlocks: [] },
        floating_city: { era: 6, path: 'steam', name: t('浮空城'), description: t('用以太撐起來的城區：可以蓋浮空城區，遠方的人都會來看'), cost: 27000, prerequisites: pre('aether_engine', 'airship'), effects: { culture_bonus: 10, beauty_bonus: 8, merchant_frequency: 0.2, defense_bonus: 3 }, unlocks: ['sky_isle'] },
        philosopher_stone: { era: 6, path: 'steam', name: t('賢者之石'), description: t('把礦坑挖出的以太凝成一顆完整的賢者之石：戴著它的那一個人老得很慢，也能點石成鋼（會耗掉它的能量）。要存非常多以太，而以太也是大家過生活要用的'), cost: 25000, prerequisites: pre('element_refining', 'alchemy'), effects: { stone_efficiency: 1.1 }, unlocks: [] },
        homunculus: { era: 6, path: 'steam', name: t('人造人'), description: t('燒瓶裡長出來的人：不吃不睡地種田蓋房，農夫和木匠的缺少一些；它們會不會想要名字？'), cost: 28000, prerequisites: pre('philosopher_stone', 'clockwork_automaton'), effects: { farm_bonus: 1.1, build_speed: 1.1 }, unlocks: [] },
    };
    Object.assign(T, ADD); for (const k of Object.keys(ADD)) T[k].prerequisites = T[k].prerequisites.filter(has);
    if (typeof RESEARCH_UNLOCKED_BY !== 'undefined') Object.assign(RESEARCH_UNLOCKED_BY, { gear_workshop: ['gear_works'], alchemy_lab: ['alchemy'], airship_dock: ['airship'], refinery: ['element_refining'], sky_isle: ['floating_city'] });
    if (typeof BUILDING_TEMPLATES !== 'undefined') Object.assign(BUILDING_TEMPLATES, {
        gear_workshop: { name: t('齒輪工坊'), description: t('做齒輪、鍋爐零件的工坊，很需要人手；煙囪整天冒煙'), costs: { wood: 20, stone: 30, steel: 10, silver: 300 }, work: 40, effects: { build_speed: 0.05 } },
        alchemy_lab: { name: t('煉金工坊'), description: t('坩堝和蒸餾瓶的工坊；偶爾冒出紫色的臭煙'), costs: { brick: 25, stone: 20, paper: 10, silver: 400 }, work: 40, effects: { healing_bonus: 0.05, research_bonus: 0.03 } },
        refinery: { name: t('提煉廠'), description: t('每天把三份石頭提煉成一份金屬；煙最多的地方'), costs: { brick: 30, steel: 15, stone: 30, silver: 500 }, work: 50, effects: {} },
        airship_dock: { name: t('飛艇碼頭'), description: t('飛艇在這裡起降，孩子們最愛來這裡看'), costs: { steel: 40, wood: 40, cloth: 30, silver: 900 }, work: 70, effects: { culture_bonus: 5 } },
        sky_isle: { name: t('浮空城區'), description: t('浮在鎮上的一小塊城區，遠方的人都會來看'), costs: { steel: 80, brick: 40, paper: 20, silver: 1500 }, work: 100, effects: { culture_bonus: 10, research_bonus: 0.05 } },
    });
    if (typeof PROPOSAL_JOB_BUILDINGS !== 'undefined') { const add = (j, ks) => { PROPOSAL_JOB_BUILDINGS[j] = [...(PROPOSAL_JOB_BUILDINGS[j] || []), ...ks]; }; add('blacksmith', ['gear_workshop', 'refinery']); add('miner', ['refinery']); add('researcher', ['alchemy_lab']); add('trader', ['airship_dock']); add('mayor', ['airship_dock', 'sky_isle']); }
    if (typeof TECH_IDEAS !== 'undefined') Object.assign(TECH_IDEAS, {
        high_pressure: { idea: '鍋爐燒旺一點，什麼都做得出來', c: 0.4 },
        airship: { idea: '人也可以在天上飛', c: 0.6 },
        alchemy: { idea: '石頭裡藏著別的東西', c: 0.5 },
        homunculus: { idea: '燒瓶裡長出來的也算是人', c: 1.0, threat: ['farmer', 'carpenter'] },
    });
})();

if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, STEAM.LAW);
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { steam_hands: '蒸汽要人手，工作不會被機器搶', steam_sky: '想坐飛艇看看天上', steam_smoke: '怕煤煙把天空燻黑', steam_union: '工人不該拿命換工錢' });
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    smog_fear: { mood: -6, opinion: 0, days: 8, label: t('大黑霧之後一直咳') },
    smog_grief: { mood: -15, opinion: 0, days: 20, label: t('家人死在大黑霧裡') },
});
if (typeof AFTERMATH !== 'undefined') Object.assign(AFTERMATH.CAUSE, { boiler_burst: '鍋爐爆炸', smog_week: '黑霧', gold_fever: '點金騙局', mech_rampage: '機甲失控', homun_ask: '人造人爭議', great_smog: '大黑霧' });
// 法律效果:清潔空氣法蓋東西慢一點、工廠法做工慢一點、禁造人造人之後效果不算
if (typeof BuildingManager !== 'undefined') {
    const BM = BuildingManager.prototype; const _rc = BM.recomputeEffects;
    BM.recomputeEffects = function (world) {
        const eff = _rc.call(this, world); const X = world?.tech?.steam;
        if (X?.air) eff.build_speed = (eff.build_speed || 0) - 0.05;
        if (X?.factory) eff.smithing_bonus = (eff.smithing_bonus || 0) - 0.05;
        if (X?.homunban && world.research?.projects?.homunculus?.status === 'complete') { eff.farm_bonus = (eff.farm_bonus || 0) - 0.1; eff.build_speed = (eff.build_speed || 0) - 0.1; }
        this.activeEffects = eff; return eff;
    };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) STEAM.daily(w); } catch (e) { console.warn('[Steam] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (STEAM.LAW[p.kind]) { const r = STEAM.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof TECH !== 'undefined') {
    const _view = TECH.view; TECH.view = function (w) { const v = _view.call(this, w); try { v.steam = STEAM.view(w); } catch (e) {} return v; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = STEAM.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = STEAM.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof window !== 'undefined') window.STEAM = STEAM;
