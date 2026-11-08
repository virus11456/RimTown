// RimTown - sim-calamity.js：v7.9.0 災厄引擎＋神力＋災厄工坊第一版（病原體）
// 引擎（以後所有災厄共用）：神力點數（每天累積、上限 100，設定可開沙盒無限）、六段劇情（徵兆→研究→流言→恐慌→降臨→災後）、
// 小鎮應對提案（隔離、關店、口罩、封城、研究對策）、恐慌行為（有錢人逃走、囤藥、聚眾禱告、找代罪羔羊）、災後紀錄、面板資料。
// 災厄內容掛在 KINDS 裡：這一版只有「病原體」——觀察者設計傳播途徑、症狀、特性與節奏（潛伏期、爆發速度、持續時間），指定第一個病人釋放；
// 病在家人、同事、聊天、水源、動物、蚊蟲之間傳，症狀接到身體五部位，醫生看診（費用走醫療金流，銀幣守恆），研究員研究疫苗跟疫情賽跑。
// 觀察者只能花神力「推一把」讓它更糟，不能阻止。小鎮剩五個人時剩下的人自然免疫（不會滅村）。
'use strict';

const CALAMITY = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const here = (w) => npcs(w).filter(a => !(w.isAway?.(a.agentId)) && a.currentLocation !== 'exploration');
    const adults = (w) => here(w).filter(a => (a.age ?? 30) >= 18);
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who); } catch (e) {} };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('event', fill(k, p), imp || 7, names || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp || 5, []); } catch (e) {} };
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const BT = () => (typeof BUILDING_TEMPLATES !== 'undefined' ? BUILDING_TEMPLATES : {});
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k || b.name === BT()[k]?.name);
    const wal = (w, a) => (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 50);
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const family = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const season = (w) => { const s = String(w.clock?.season || ''); return /夏|summer/i.test(s) ? 'summer' : /冬|winter/i.test(s) ? 'winter' : 'mild'; };
    const aff = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const names = (arr) => arr.map(a => t(a.name)).join(t('、'));

    // ---------- 神力 ----------
    const CAP = 100;
    const sandbox = () => { try { return localStorage.getItem('rimtown_god_sandbox') === '1'; } catch (e) { return false; } };
    function S(w) {
        if (!w.calamity || typeof w.calamity !== 'object') w.calamity = {};
        const C = w.calamity; if (C.power == null) C.power = 20; C.hist = C.hist || []; C.st = C.st || { released: 0, infected: 0, died: 0 };
        CALAMITY.W = w; return C;
    }
    const power = (w) => (sandbox() ? Infinity : S(w).power);
    function spend(w, n) { const C = S(w); if (sandbox()) return true; if (C.power < n) return false; C.power = Math.round((C.power - n) * 10) / 10; return true; }
    function powerDaily(w, C, d) {
        if (C.pDay === d) return; C.pDay = d;
        const pros = w.prosperity?.prosperity || 0; C.power = Math.min(CAP, Math.round((C.power + 1 + (pros >= 60 ? 0.5 : 0)) * 10) / 10); // 樹大招風:越興旺累積越快
    }

    // ---------- 病原體零件(神力成本) ----------
    const P = {
        route: { // 傳播途徑(選 1～2)
            droplet: { icon: '💨', name: '飛沫', desc: '聊天、待在同一個地方就會傳', cost: 10 },
            contact: { icon: '🤝', name: '接觸', desc: '同一家人、同一個工作場所', cost: 6 },
            water: { icon: '💧', name: '水源', desc: '井和食堂，一次中一大批人', cost: 12 },
            animal: { icon: '🐾', name: '動物', desc: '寵物和雞群，養動物的人先中', cost: 6 },
            insect: { icon: '🦟', name: '蚊蟲', desc: '夏天猖狂、冬天幾乎停', cost: 8 },
        },
        sym: { // 症狀(最多 4)
            cough: { icon: '😷', name: '咳嗽', desc: '傷肺，傳得更快', cost: 4, part: 'l', dmg: 1.2 },
            fever: { icon: '🤒', name: '高燒', desc: '病著的時候只能做三成的工', cost: 6 },
            rash: { icon: '🔴', name: '皮疹', desc: '一看就知道，病人會被排擠，也比較早被發現', cost: 3 },
            blind: { icon: '🙈', name: '失明', desc: '傷眼睛，研究員、裁縫做不了事', cost: 8, part: 'e', dmg: 2.5 },
            joint: { icon: '🦴', name: '關節痛', desc: '傷手腳，做工走路都慢', cost: 5, part: 'h', dmg: 1.5 },
            heart: { icon: '💔', name: '心臟衰竭', desc: '傷心臟，致死率更高', cost: 12, part: 'c', dmg: 2 },
            delirium: { icon: '😵', name: '譫妄', desc: '神智不清，會跟人打架', cost: 8 },
            sleepy: { icon: '😪', name: '嗜睡', desc: '整天昏睡，睡不飽', cost: 4 },
        },
        latency: { short: { name: '短', desc: '1～2 天', cost: 0, d: [1, 2] }, mid: { name: '中', desc: '3～5 天', cost: 5, d: [3, 5] }, long: { name: '長', desc: '6～9 天，沒發病也會傳', cost: 12, d: [6, 9] } },
        speed: { slow: { name: '慢', desc: '傳染力低', cost: 0, m: 0.6 }, mid: { name: '中', desc: '一般', cost: 8, m: 1 }, fast: { name: '快', desc: '傳染力高', cost: 18, m: 1.6 } },
        length: { short: { name: '短', desc: '病 3～4 天', cost: 0, d: [3, 4] }, mid: { name: '中', desc: '病 5～7 天', cost: 4, d: [5, 7] }, long: { name: '長', desc: '病 8～12 天', cost: 8, d: [8, 12] } },
        lethal: { low: { name: '低', desc: '約 2%', cost: 0, p: 0.02 }, mid: { name: '中', desc: '約 10%', cost: 10, p: 0.1 }, high: { name: '高', desc: '約 25%', cost: 25, p: 0.25 } },
        resist: { off: { name: '沒有', desc: '藥有效', cost: 0 }, on: { name: '有', desc: '看醫生吃藥效果變差', cost: 10 } },
        climate: { none: { name: '不挑', desc: '四季一樣', cost: 0 }, cold: { name: '耐寒', desc: '冬天更猖狂', cost: 6 }, heat: { name: '耐熱', desc: '夏天更猖狂', cost: 6 } },
        target: { none: { name: '不挑', desc: '人人都會中', cost: 0 }, elder: { name: '老人', desc: '老人特別容易中、容易死', cost: 4 }, child: { name: '小孩', desc: '小孩特別容易中', cost: 4 }, poor: { name: '窮人', desc: '窮人區傳得特別快', cost: 5 }, rich: { name: '富人', desc: '富貴病，宴席傳染', cost: 5 } },
    };
    const SINGLE = ['latency', 'speed', 'length', 'lethal', 'resist', 'climate', 'target'];
    const BASE_COST = 5;
    function norm(spec) {
        const s = spec || {}; const out = { name: String(s.name || '').replace(/[<>{}"'`\\]/g, '').trim().slice(0, 12) || t('無名怪病') };
        out.route = [...new Set((s.route || []).filter(k => P.route[k]))].slice(0, 2); if (!out.route.length) out.route = ['droplet'];
        out.sym = [...new Set((s.sym || []).filter(k => P.sym[k]))].slice(0, 4); if (!out.sym.length) out.sym = ['cough'];
        for (const k of SINGLE) out[k] = P[k][s[k]] ? s[k] : Object.keys(P[k])[k === 'speed' || k === 'latency' || k === 'length' ? 1 : 0];
        return out;
    }
    function cost(spec) { const s = norm(spec); let c = BASE_COST; for (const r of s.route) c += P.route[r].cost; for (const y of s.sym) c += P.sym[y].cost; for (const k of SINGLE) c += P[k][s[k]].cost; return c; }
    const visible = (s) => s.sym.some(y => y === 'rash' || y === 'blind' || y === 'fever');
    function preview(spec) {
        const s = norm(spec); const RW = { droplet: 1, water: 0.9, insect: 0.8, contact: 0.6, animal: 0.5 };
        const spread = Math.min(100, Math.round(s.route.reduce((x, r) => x + RW[r], 0) * 45 * P.speed[s.speed].m * (s.sym.includes('cough') ? 1.2 : 1)));
        const sev = Math.min(100, Math.round(s.sym.reduce((x, y) => x + ({ cough: 10, fever: 18, rash: 6, blind: 22, joint: 14, heart: 28, delirium: 18, sleepy: 8 })[y], 0) * (s.length === 'long' ? 1.3 : s.length === 'short' ? 0.8 : 1)));
        const death = Math.min(100, Math.round((P.lethal[s.lethal].p + (s.sym.includes('heart') ? 0.08 : 0)) * 280));
        const stealth = Math.max(0, Math.min(100, ({ short: 15, mid: 40, long: 75 })[s.latency] + (visible(s) ? -20 : 15)));
        return { spread, sev, death, stealth, cost: cost(s) };
    }

    // ---------- 釋放 ----------
    const COOL = 20; // 結束後冷卻天數
    function canRelease(w) { const C = S(w); if (C.cur) return { ok: false, why: 'active' }; const left = (C.coolTo || 0) - day(w); if (left > 0) return { ok: false, why: 'cooldown', days: left }; return { ok: true }; }
    function release(w, spec, zeroId) {
        const can = canRelease(w); if (!can.ok) return can; const s = norm(spec); const c = cost(s);
        if (!spend(w, c)) return { ok: false, why: 'power', need: c };
        const pool = adults(w); const zero = (zeroId && w.agents[zeroId] && !w.agents[zeroId].isDead) ? w.agents[zeroId] : rnd(pool.length ? pool : here(w)); if (!zero) return { ok: false, why: 'nobody' };
        const C = S(w); const d = day(w);
        C.cur = { kind: 'pathogen', spec: s, day: d, cost: c, st: {}, found: 0, phase: 'hidden', ms: {}, curve: [], log: [], peak: 0, boost: 0, rumors: 0, fled: 0, died: 0, inf: 0, hoard: 0, scape: null, vax: null };
        infect(w, C.cur, zero, d); C.st.released++;
        C.cur.log.push([d, 'release', t(zero.name)]);
        return { ok: true, cost: c, zero: zero.agentId };
    }
    function boost(w) { const C = S(w); if (!C.cur) return { ok: false, why: 'none' }; if (C.cur.boost > day(w)) return { ok: false, why: 'boosting' }; if (!spend(w, 15)) return { ok: false, why: 'power', need: 15 }; C.cur.boost = day(w) + 3; C.cur.log.push([day(w), 'boost', '']); return { ok: true }; }

    // ---------- 病原體擴散 ----------
    const rr = (a) => a[0] + Math.floor(Math.random() * (a[1] - a[0] + 1));
    function infect(w, X, a, d) {
        if (X.st[a.agentId]) return false; const s = X.spec;
        const on = d + rr(P.latency[s.latency].d); X.st[a.agentId] = { s: 'E', d, on, end: on + rr(P.length[s.length].d) }; X.inf++; S(w).st.infected++; return true;
    }
    const isTarget = (w, X, a) => { const tg = X.spec.target; if (tg === 'elder') return (a.age ?? 30) >= 55; if (tg === 'child') return (a.age ?? 30) < 14; if (tg === 'poor') return wal(w, a) < 25; if (tg === 'rich') return wal(w, a) > 200; return false; };
    function spreadMult(w, X, route) {
        const s = X.spec; let m = P.speed[s.speed].m * (s.sym.includes('cough') && (route === 'droplet' || route === 'contact') ? 1.2 : 1);
        const se = season(w); if (s.climate === 'cold') m *= se === 'winter' ? 1.5 : se === 'summer' ? 0.6 : 1; else if (s.climate === 'heat') m *= se === 'summer' ? 1.5 : se === 'winter' ? 0.6 : 1; else if (route === 'droplet' && se === 'winter') m *= 1.1;
        if (route === 'droplet' && X.ms.mask) m *= 0.5;
        if ((route === 'droplet' || route === 'contact') && done(w, 'sanitation')) m *= 0.85;
        if (route === 'water') m *= (built(w, 'sewers') ? 0.4 : 1) * (built(w, 'bathhouse') ? 0.8 : 1) * (done(w, 'sanitation') ? 0.6 : 1) * (X.ms.close ? 0.6 : 1);
        if (route === 'insect') m *= se === 'summer' ? 1.6 : se === 'winter' ? 0.15 : 0.8;
        if (X.boost > day(w)) m *= 1.5;
        if (X.pray) m *= 1.2;
        return m;
    }
    function spreadDaily(w, X, d) {
        const s = X.spec; const all = here(w); const byId = {}; for (const a of all) byId[a.agentId] = a; const n = all.length || 1;
        const st = (a) => X.st[a.agentId]; const sus = (a) => !st(a) && !X.vx?.[a.agentId];
        const spreaders = all.filter(a => { const x = st(a); return x && (x.s === 'I' || (x.s === 'E' && s.latency === 'long' && d >= x.on - 2)); });
        const nI = spreaders.length; if (!nI) return;
        const tgt = (a) => (s.target === 'none' ? 1 : isTarget(w, X, a) ? 1.8 : 0.7);
        const tryInf = (a, p) => { if (a && sus(a) && Math.random() < p * tgt(a)) infect(w, X, a, d); };
        const quar = X.ms.quar;
        for (const a of spreaders) {
            const sick = st(a).s === 'I';
            const fam = family(w, a).filter(x => byId[x.agentId]); const home = all.filter(x => x !== a && x.homeLocation && x.homeLocation === a.homeLocation).slice(0, 5); const house = [...new Set([...fam, ...home])];
            const cow = (sick && quar) ? [] : all.filter(x => x !== a && x.job?.key && x.job.key === a.job?.key).slice(0, 4);
            const soc = (sick && quar) ? [] : Array.from({ length: X.ms.close ? 2 : 3 }, () => rnd(all)).filter(x => x !== a);
            if (s.route.includes('droplet')) { const m = spreadMult(w, X, 'droplet'); house.forEach(x => tryInf(x, 0.12 * m)); cow.forEach(x => tryInf(x, 0.08 * m)); soc.forEach(x => tryInf(x, 0.05 * m)); }
            if (s.route.includes('contact')) { const m = spreadMult(w, X, 'contact'); house.forEach(x => tryInf(x, 0.15 * m)); cow.forEach(x => tryInf(x, 0.06 * m)); }
            if (s.rich === undefined && s.target === 'rich' && !X.ms.close && Math.random() < 0.3) all.filter(x => wal(w, x) > 200).slice(0, 3).forEach(x => tryInf(x, 0.08)); // 富貴病:宴席
        }
        const frac = Math.min(1, nI / n * 8);
        if (s.route.includes('water')) { const m = spreadMult(w, X, 'water'); for (const a of all) tryInf(a, 0.015 * frac * m); }
        if (s.route.includes('animal')) { const m = spreadMult(w, X, 'animal'); const pets = new Set((w.pets?.list || []).map(p => p.owner).filter(Boolean)); for (const a of all) tryInf(a, (pets.has(a.agentId) || a.job?.key === 'farmer' ? 0.03 : 0.005) * frac * m); }
        if (s.route.includes('insect')) { const m = spreadMult(w, X, 'insect'); for (const a of all) tryInf(a, 0.02 * frac * m); }
    }
    function progressDaily(w, X, d) {
        const s = X.spec; const alive = npcs(w).length;
        for (const [id, x] of Object.entries(X.st)) {
            const a = w.agents[id]; if (!a || a.isDead) { if (x.s === 'E' || x.s === 'I') x.s = 'R'; continue; }
            if (x.s === 'E' && d >= x.on) { x.s = 'I'; a.addThought?.('cal_sick', w); mem(w, a, X.found ? '我染上了{n}，渾身不舒服。' : '我這幾天身體很不對勁，不知道怎麼了。', { n: s.name }, 6); }
            if (x.s !== 'I') continue;
            for (const y of s.sym) { const Y = P.sym[y]; if (Y.part && typeof HEALTH !== 'undefined') { HEALTH.hurt(w, a, Y.part, Y.dmg); if (y === 'joint') HEALTH.hurt(w, a, 'f', 1); } }
            if (d < x.end - (x.tr ? 1 : 0)) continue;
            // 病程結束:康復或死亡
            const age = a.age ?? 30; let p = P.lethal[s.lethal].p + (s.sym.includes('heart') ? 0.08 : 0);
            p *= (age >= 60 ? 2 : age < 12 ? 1.4 : 1) * (x.tr ? (s.resist === 'on' ? 0.75 : 0.5) : 1) * (isTarget(w, X, a) ? 1.3 : 1);
            if (alive <= 5) p = 0; // 最後幾個人自然免疫
            if (Math.random() < p) { x.s = 'D'; X.died++; S(w).st.died++; die(w, X, a); }
            else { x.s = 'R'; a.addThought?.('cured', w); mem(w, a, X.found ? '我撐過了{n}，總算好起來了。' : '病了一場，總算好起來了。', { n: s.name }, 6); }
        }
    }
    function die(w, X, a) {
        const fam = family(w, a).filter(f => !f.isDead);
        a._deathCause = X.spec.name;
        log(w, X.found ? '⚰️ {a}死於{n}。' : '⚰️ {a}病了幾天就走了，沒人知道是什麼病。', { a: a.name, n: X.spec.name }, a.name);
        try { w.lifecycle?._killNpc?.(w, a); } catch (e) {}
        for (const f of fam) { f.addThought?.('cal_grief', w); mem(w, f, X.found ? '{n}奪走了我的家人{a}。' : '{a}病死了，我好難過。', { n: X.spec.name, a: a.name }, 9); (X.bereaved = X.bereaved || []).push(f.agentId); }
        if (!X.found) found(w, X, day(w), true);
    }
    // 醫生看診:費用走醫療金流,有藥的話康復快、死得少
    function treatDaily(w, X, d) {
        const docs = here(w).filter(a => a.job?.key === 'doctor' && X.st[a.agentId]?.s !== 'I'); if (!docs.length) return;
        let slots = docs.length * 3; const pts = here(w).filter(a => X.st[a.agentId]?.s === 'I' && !X.st[a.agentId].tr).sort((x, y) => (y.age ?? 30) - (x.age ?? 30));
        for (const a of pts) {
            if (slots <= 0) break; const doc = docs[slots % docs.length]; slots--;
            const r = typeof HEALTH !== 'undefined' ? HEALTH.pay(w, a, 6, '看診', doc) : { ok: true }; if (!r.ok) continue;
            w.stockpile?.consume?.('medicine', 1, w.tickCount, t('看病'), 'medical'); X.st[a.agentId].tr = 1;
            if (!X.st[doc.agentId] && Math.random() < (X.ms.mask ? 0.02 : 0.04)) infect(w, X, doc, d); // 醫生被傳染
        }
    }

    // ---------- 劇情階段 ----------
    const count = (X, k) => Object.values(X.st).filter(x => x.s === k).length;
    function found(w, X, d, byDeath) {
        if (X.found) return; X.found = d; X.phase = 'found';
        const doc = here(w).find(a => a.job?.key === 'doctor'); const sick = here(w).filter(a => X.st[a.agentId]?.s === 'I');
        const k = doc ? '🩺 {doc}看了幾個病人之後確定：鎮上出現了新的傳染病，大家叫它「{n}」。' : '🩺 接連有人病倒{dead}，鎮上的人開始說這是一種新的怪病，叫它「{n}」。';
        const p = { doc: doc?.name || '', n: X.spec.name, dead: byDeath ? t('，還死了人') : '' };
        log(w, k, p, doc?.name); news(w, k, p, 9, doc ? [doc.name] : []); X.log.push([d, 'found', doc ? t(doc.name) : '']);
        for (const a of sick) mem(w, a, '醫生說我得的是{n}。', { n: X.spec.name }, 7);
        for (const a of here(w)) if (!X.st[a.agentId]) mem(w, a, '鎮上出現了一種叫「{n}」的怪病，大家都很擔心。', { n: X.spec.name }, 6);
    }
    const OMEN = ['🤧 {a}說最近老是覺得累，提不起勁。', '🤧 酒館裡有人在說，最近怎麼好多人在咳。', '🤧 {a}請了一天假，說是身體不舒服。'];
    const RUMOR = [['水井被人下了毒', 'well'], ['是外地商人帶進來的', 'trader'], ['是神在懲罰我們', 'god'], ['是新搬來的{x}帶來的', 'newcomer'], ['喝酒可以預防', 'drink'], ['醫生其實早就知道，故意不說', 'doctor']];
    function storyDaily(w, X, d) {
        const s = X.spec; const nI = count(X, 'I'), nE = count(X, 'E'), pop = here(w).length || 1;
        X.curve.push([d, nI, X.died, count(X, 'R'), nE]); if (X.curve.length > 120) X.curve = X.curve.slice(-120);
        X.peak = Math.max(X.peak, nI); X.pray = false;
        // ① 徵兆:還沒人知道
        if (!X.found) {
            if (nI && Math.random() < 0.35) { const a = rnd(here(w).filter(x => X.st[x.agentId]?.s === 'I')); if (a) log(w, rnd(OMEN), { a: a.name }, a.name); }
            const thr = (here(w).some(a => a.job?.key === 'doctor') ? 2 : 4) + (s.latency === 'long' ? 1 : 0) - (visible(s) ? 1 : 0) - (s.sym.includes('rash') ? 1 : 0);
            if (nI >= Math.max(1, thr)) found(w, X, d, false);
            return;
        }
        // ② 研究 ③ 流言
        if (d - X.found >= 1 && X.rumors < 4 && Math.random() < 0.45) rumor(w, X, d);
        // ④ 恐慌
        const panic = nI / pop >= 0.15 || X.died >= 2;
        if (panic) {
            if (X.phase === 'found' || X.phase === 'rumor') { X.phase = 'panic'; X.log.push([d, 'panic', '']); log(w, '😱 {n}越傳越兇，鎮上人心惶惶。', { n: s.name }); news(w, '😱 {n}擴散，鎮上陷入恐慌', { n: s.name }, 9, []); }
            for (const a of here(w)) if (!X.st[a.agentId] || X.st[a.agentId].s === 'R') a.addThought?.('cal_fear', w);
            if (!X.ms.lock) { const rich = adults(w).filter(a => !X.st[a.agentId] && wal(w, a) > 120 && Math.random() < 0.03).slice(0, 2); for (const a of rich) { try { if (w.leaveTown?.(a.agentId, fill('怕染上{n}，帶著家當逃走了', { n: s.name }))) { X.fled++; log(w, '🧳 {a}怕染上{n}，收拾家當逃離了小鎮。', { a: a.name, n: s.name }, a.name); } } catch (e) {} } }
            if (!X.hoard) { const med = w.stockpile?.get?.('medicine') || 0; const k = Math.round(med * 0.3); if (k > 0) w.stockpile.consume('medicine', k, w.tickCount, t('囤藥'), 'event'); X.hoard = d; const who = adults(w).sort((x, y) => wal(w, y) - wal(w, x))[0]; log(w, '💊 藥鋪的藥被搶走了三成，{a}家裡囤了一整櫃。', { a: who?.name || t('有人') }, who?.name); }
            const dv = here(w).filter(a => devout(w, a)); if (dv.length >= 3 && Math.random() < 0.25) { X.pray = true; log(w, '🙏 {n}個虔誠的信徒聚在一起為病人祈禱——擠在一起反而讓病傳得更快。', { n: dv.length }); }
        } else if (X.phase === 'found' && X.rumors) X.phase = 'rumor';
        if (X.phase === 'panic' && nI < X.peak * 0.6 && X.peak >= 3) { X.phase = 'fading'; X.log.push([d, 'fading', '']); log(w, '🌤️ {n}的病人一天比一天少，鎮上慢慢鬆了一口氣。', { n: s.name }); }
        // 症狀帶來的人際問題
        for (const a of here(w).filter(x => X.st[x.agentId]?.s === 'I')) {
            if (s.sym.includes('rash')) for (const o of [rnd(here(w)), rnd(here(w))]) if (o && o !== a && !X.st[o.agentId]) aff(o, a, -2);
            if (s.sym.includes('delirium') && Math.random() < 0.12) { const o = rnd(here(w).filter(x => x !== a)); if (o) { try { HEALTH?.hurt?.(w, o, 'h', 8); } catch (e) {} aff(o, a, -12); log(w, '😵 {a}燒得神智不清，對{b}動了手。', { a: a.name, b: o.name }, a.name); } }
        }
    }
    function rumor(w, X, d) {
        const r = rnd(RUMOR); const who = rnd(adults(w)); if (!who) return; X.rumors++;
        let x = ''; let target = null;
        if (r[1] === 'newcomer') { target = adults(w).filter(a => a !== who).sort((p, q) => (q.arrivedDay ?? q._arrive ?? 0) - (p.arrivedDay ?? p._arrive ?? 0))[0] || rnd(adults(w).filter(a => a !== who)); x = target ? target.name : ''; if (!target) return; }
        if (r[1] === 'doctor') target = here(w).find(a => a.job?.key === 'doctor');
        if (r[1] === 'trader') target = here(w).find(a => a.job?.key === 'trader' && a !== who);
        const txt = fill(r[0], { x });
        log(w, '🗣️ 鎮上開始流傳：「{r}」——{a}說得煞有其事。', { r: txt, a: who.name }, who.name);
        if (target && target !== who) { X.scape = target.agentId; for (const o of here(w).filter(y => y !== target && Math.random() < 0.3)) aff(o, target, -6); mem(w, target, '大家在背後說{n}是我害的，我根本沒有！', { n: X.spec.name }, 8); }
        X.log.push([d, 'rumor', txt]); if (X.phase === 'found') X.phase = 'rumor';
    }
    function endCheck(w, X, d) {
        const active = Object.values(X.st).some(x => x.s === 'E' || x.s === 'I'); if (active) { X.quiet = 0; return false; }
        X.quiet = (X.quiet || 0) + 1; if (X.quiet < 2) return false;
        const C = S(w); const s = X.spec; const rec = { name: s.name, day: X.day, end: d, inf: X.inf, died: X.died, fled: X.fled, peak: X.peak, vax: !!X.vax?.done, found: X.found ? X.found - X.day : null, cost: X.cost };
        C.hist.unshift(rec); C.hist = C.hist.slice(0, 8); C.cur = null; C.coolTo = d + COOL;
        const k = X.died ? '🕯️ {n}終於過去了：{i} 人染病、{d} 人死去、{f} 人逃走。鎮上為死者辦了追思會。' : '🌈 {n}終於過去了：{i} 人染病，沒有人死。';
        log(w, k, { n: s.name, i: X.inf, d: X.died, f: X.fled }); news(w, k, { n: s.name, i: X.inf, d: X.died, f: X.fled }, 9, []);
        for (const a of here(w)) mem(w, a, X.died ? '{n}帶走了 {d} 條人命，我們撐過來了，但不會忘記。' : '{n}過去了，大家總算鬆了一口氣。', { n: s.name, d: X.died }, 7);
        if (X.ms.lock || X.ms.close || X.ms.mask || X.ms.quar) log(w, '📋 疫情過去，封城、關店、口罩、隔離這些規定都解除了。', {});
        try { w.chronicle?.add?.(w, fill('{n}流行：{i} 人染病、{d} 人死去', { n: s.name, i: X.inf, d: X.died })); } catch (e) {}
        return true;
    }

    // ---------- 小鎮應對:提案 ----------
    const busy = (w, kind) => (w.proposals?.items || []).some(p => p.kind === kind && ['open', 'shelved', 'approved'].includes(p.status));
    function propose(w, kind, who, tk, dk, dp, cat) {
        const PS = w.proposals; if (!PS?._createWith || !who) return null; const d = PS._abs ? PS._abs(w) : day(w);
        const cand = { kind, key: kind + ':' + d, jobs: [], make: () => ({ kind, key: kind + ':' + d, refKey: kind, tk, tp: dp || {}, dk, dp: Object.assign({ who: who.name }, dp || {}), cost: {}, category: cat || 'welfare', jobBias: [] }) };
        try { return PS._createWith(w, d, cand, who); } catch (e) { console.warn('[Calamity] propose', e); return null; }
    }
    const pickBy = (w, f) => adults(w).slice().sort((x, y) => f(y) - f(x))[0];
    function measuresDaily(w, X, d) {
        if (!X.found) return; const s = X.spec; const nI = count(X, 'I'), pop = here(w).length || 1; const ms = X.ms; X.asked = X.asked || {};
        const ask = (k, cond, who, tk, dk, cat) => { if (ms[k] || X.asked[k] && d - X.asked[k] < 6 || !cond || busy(w, 'cal_' + k)) return; if (propose(w, 'cal_' + k, who, tk, dk, { n: s.name }, cat)) X.asked[k] = d; };
        const doctor = here(w).find(a => a.job?.key === 'doctor'); const res = here(w).find(a => a.job?.key === 'researcher');
        ask('vax', !X.vax, res || doctor || pickBy(w, a => hasV(a, '知識') ? 2 : 0), '研究{n}的對策', '{who}說要想辦法對付{n}：研究員先停下手上的研究，全力研究疫苗和治法。', 'culture');
        ask('quar', nI >= 2, doctor || pickBy(w, a => hasT(a, 'pessimist') ? 2 : 0), '隔離{n}的病人', '{who}提議把得了{n}的人留在家裡，不准出門上工，家人送飯就好。', 'welfare');
        ask('mask', s.route.includes('droplet') && nI >= 2, doctor || pickBy(w, a => a.job?.key === 'tailor' ? 2 : 0), '出門戴口罩', '{who}說{n}靠飛沫傳，提議大家出門都戴口罩，裁縫用庫存的布趕工。', 'welfare');
        ask('close', nI / pop >= 0.1, doctor || pickBy(w, a => a.job?.key === 'mayor' ? 2 : 0), '暫時關閉酒館與市集', '{who}說人擠人的地方最容易傳{n}，提議酒館和市集先關，等疫情過去再開。', 'welfare');
        ask('lock', nI / pop >= 0.15, pickBy(w, a => (a.job?.key === 'guard' ? 2 : 0) + (a.job?.key === 'mayor' ? 1.5 : 0)), '封城：不准進出', '{who}提議封城：商隊、外人不准進來，鎮上的人也不准出去，免得{n}越傳越廣。', 'defense');
    }
    function enact(w, kind) {
        const C = S(w); const X = C.cur; if (!X) return ''; const k = kind.replace(/^cal_/, ''); const n = X.spec.name;
        if (k === 'vax') { const cx = X.spec.route.length + X.spec.sym.length + (X.spec.resist === 'on' ? 2 : 0) + (X.spec.latency === 'long' ? 1 : 0); let need = 300 + 70 * cx; for (const [tk, m] of [['vaccination', 0.6], ['microbiology', 0.7], ['immunology', 0.7], ['genetics', 0.8]]) if (done(w, tk)) need *= m; X.vax = { p: 0, need: Math.round(need), done: 0 }; log(w, '🔬 研究員放下手上的研究，全力研究{n}的疫苗。', { n }); X.log.push([day(w), 'vax', '']); return t('開始研究疫苗'); }
        X.ms[k] = day(w);
        if (k === 'mask') { const cl = w.stockpile?.get?.('cloth') || 0; if (cl > 0) w.stockpile.consume('cloth', Math.min(cl, 10), w.tickCount, t('做口罩'), 'event'); }
        if (k === 'close') for (const a of here(w)) a.moodModifier = (a.moodModifier || 0) - 2;
        X.log.push([day(w), k, '']);
        return t({ quar: '病人開始隔離', mask: '大家出門戴口罩', close: '酒館與市集暫時關閉', lock: '小鎮封城了' }[k] || '');
    }
    function vaxDaily(w, X, d) {
        const V = X.vax; if (!V) return;
        if (!V.done) {
            const R = w.research; const pts = (R?._scholarPts ? R._scholarPts(w) : 0) + here(w).filter(a => a.job?.key === 'doctor').length * 2 + 2;
            V.p = Math.min(V.need, V.p + pts);
            if (V.p >= V.need) { V.done = d; log(w, '💉 {n}的疫苗研究出來了！醫生開始幫大家打針。', { n: X.spec.name }); news(w, '💉 {n}疫苗問世', { n: X.spec.name }, 9, []); X.log.push([d, 'vaxdone', '']); }
            return;
        }
        X.vx = X.vx || {}; for (const a of here(w)) if (!X.st[a.agentId] && !X.vx[a.agentId] && Math.random() < 0.3) X.vx[a.agentId] = d; // 每天三成的人打到疫苗
    }
    function vote(w, p, a) {
        const X = S(w).cur; const k = p.kind.replace(/^cal_/, ''); const x = X?.st?.[a.agentId]; const fam = X ? family(w, a).some(f => X.st[f.agentId]?.s === 'I') : false;
        const scared = X && (X.died > 0 || count(X, 'I') >= 3);
        let s = 0.5 + (scared ? 1 : 0) + (hasT(a, 'pessimist') ? 1 : 0) + (a.job?.key === 'doctor' ? 1.5 : 0) + (hasV(a, '家庭') ? 0.6 : 0) - (hasT(a, 'optimist') ? 0.6 : 0);
        let why = s > 0 ? 'cal_fear' : 'gut';
        if (k === 'quar') { if (x?.s === 'I' || fam) { s -= 3; why = 'cal_family'; } if (hasT(a, 'kind')) s -= 0.5; }
        if (k === 'close') { if (a.job?.key === 'cook' || a.job?.key === 'trader' || owner(w, a)) { s -= 2.5; why = 'cal_business'; } if (hasT(a, 'glutton')) s -= 0.5; }
        if (k === 'lock') { s -= 0.6; if (a.job?.key === 'trader' || owner(w, a)) { s -= 2.5; why = 'cal_business'; } if (hasV(a, '自由')) { s -= 1.5; why = 'cal_freedom'; } }
        if (k === 'mask') { s += 0.5; if (hasT(a, 'lazy')) s -= 1; if (hasV(a, '自由')) { s -= 1; why = 'cal_freedom'; } }
        if (k === 'vax') { s += 1; if (a.job?.key === 'researcher') s += 1; if (devout(w, a) && Math.random() < 0.4) { s -= 2.5; why = 'faith'; } }
        s += Math.random() - 0.5;
        return { v: s > 0 ? 'for' : 'against', why: s > 0 && why !== 'faith' && why !== 'cal_business' && why !== 'cal_family' && why !== 'cal_freedom' ? 'cal_fear' : why };
    }

    // ---------- 每天 ----------
    function daily(w) {
        const C = S(w); const d = day(w); powerDaily(w, C, d);
        const X = C.cur; if (!X || X.lastDay === d) return; X.lastDay = d;
        if (X.kind === 'pathogen') { spreadDaily(w, X, d); progressDaily(w, X, d); treatDaily(w, X, d); }
        storyDaily(w, X, d); measuresDaily(w, X, d); vaxDaily(w, X, d);
        endCheck(w, X, d);
    }

    // ---------- 給身體系統、AI、介面 ----------
    const stOf = (w, a) => w?.calamity?.cur?.st?.[a?.agentId] || null;
    function workMult(w, a) { const X = w?.calamity?.cur; const x = X?.st?.[a.agentId]; if (!x || x.s !== 'I') return 1; let m = 1; if (X.spec.sym.includes('fever')) m *= 0.3; if (X.spec.sym.includes('sleepy')) m *= 0.8; if (X.ms.quar) m *= 0.5; return m; }
    function sleepMult(w, a) { const X = w?.calamity?.cur; const x = X?.st?.[a.agentId]; return x?.s === 'I' && X.spec.sym.includes('sleepy') ? 0.6 : 1; }
    function brief(w, a) {
        const C = w?.calamity; if (!C) return ''; const X = C.cur; const x = X?.st?.[a.agentId];
        if (X && (X.bereaved || []).includes(a.agentId)) return fill(X.found ? '{n}奪走了我的家人' : '我的家人病死了', { n: X.spec.name });
        if (x?.s === 'I') return X.found ? fill('我得了{n}，渾身不舒服', { n: X.spec.name }) : t('我這幾天身體很不對勁');
        if (x?.s === 'R' && X.found) return fill('我得過{n}，撐過來了', { n: X.spec.name });
        if (X?.scape === a.agentId) return fill('大家在背後說{n}是我帶來的', { n: X.spec.name });
        return '';
    }
    function townBrief(w) {
        const X = w?.calamity?.cur; if (!X?.found) { const h = w?.calamity?.hist?.[0]; return h && day(w) - h.end <= 30 ? fill('不久前鎮上流行過{n}，死了 {d} 個人', { n: h.name, d: h.died }) : ''; }
        let s = fill('鎮上正在流行{n}：{i} 人病著，已經 {d} 人死了', { n: X.spec.name, i: count(X, 'I'), d: X.died });
        const ms = Object.keys(X.ms).map(k => t({ quar: '病人隔離', mask: '戴口罩', close: '酒館市集關閉', lock: '封城' }[k] || '')).filter(Boolean); if (ms.length) s += t('（') + ms.join(t('、')) + t('）');
        return s;
    }
    const PHASE = { hidden: '潛伏中（只有你知道）', found: '剛被發現', rumor: '流言四起', panic: '恐慌', fading: '退燒中' };
    function view(w) {
        const C = S(w); const X = C.cur; const sb = sandbox(); const can = canRelease(w);
        const base = { power: sb ? null : Math.floor(C.power), cap: CAP, sandbox: sb, can, cool: Math.max(0, (C.coolTo || 0) - day(w)), hist: C.hist.slice(0, 5), parts: P, single: SINGLE, base: BASE_COST, boostCost: 15 };
        if (!X) return base;
        const s = X.spec; const E = count(X, 'E'), I = count(X, 'I'), R = count(X, 'R');
        return Object.assign(base, { cur: { name: s.name, spec: s, day: X.day, days: day(w) - X.day, phase: X.phase, phaseName: t(PHASE[X.phase] || ''), found: !!X.found, E, I, R, D: X.died, fled: X.fled, inf: X.inf, peak: X.peak, ms: Object.keys(X.ms), vax: X.vax ? { pct: Math.round(X.vax.p / X.vax.need * 100), done: !!X.vax.done, shots: Object.keys(X.vx || {}).length } : null, curve: X.curve.slice(-60), log: X.log.slice(-10).reverse(), boosting: X.boost > day(w), pop: here(w).length, scape: X.scape ? t(w.agents[X.scape]?.name || '') : '' } });
    }
    return { W: null, CAP, P, SINGLE, BASE_COST, S, power, spend, sandbox, norm, cost, preview, canRelease, release, boost, daily, enact, vote, workMult, sleepMult, brief, townBrief, view, stOf, count, found, infect, COOL, PHASE };
})();

// ---------- 接上其他系統 ----------
if (typeof HEALTH !== 'undefined') {
    const _wm = HEALTH.workMult; HEALTH.workMult = (w, a) => _wm(w, a) * CALAMITY.workMult(w, a);
    const _sl = HEALTH.sleepMult; HEALTH.sleepMult = (w, a) => _sl(w, a) * CALAMITY.sleepMult(w, a);
}
// 疫苗研究期間,研究員的研究點都拿去研究疫苗(平常的研究暫停)
if (typeof ResearchManager !== 'undefined') {
    const RM = ResearchManager.prototype; const _du = RM.dailyUpdate;
    RM.dailyUpdate = function (world) { const V = world?.calamity?.cur?.vax; if (V && !V.done) return; return _du.call(this, world); };
}
// 封城:商人、商隊、移民都進不來(快滅村時照舊補人)
const CAL_LOCKED = (w) => !!w?.calamity?.cur?.ms?.lock;
if (typeof TradeManager !== 'undefined') { const TM = TradeManager.prototype; const _sm = TM._spawnMerchant; TM._spawnMerchant = function (world, ...r) { if (CAL_LOCKED(world)) return null; return _sm.call(this, world, ...r); }; }
if (typeof EventSystem !== 'undefined') { const ES = EventSystem.prototype; const _im = ES._spawnImmigrant; ES._spawnImmigrant = function (world, ...r) { if (CAL_LOCKED(world) && Object.values(world.agents || {}).filter(a => !a.isPlayer && !a.isDead).length >= 6) return null; return _im.call(this, world, ...r); }; }
if (typeof World !== 'undefined') { const _cd = World.prototype._caravanDaily; if (_cd) World.prototype._caravanDaily = function (...r) { if (CAL_LOCKED(this)) return; return _cd.apply(this, r); }; }
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    cal_sick: { mood: -6, opinion: 0, days: 4, label: t('染上了怪病') },
    cal_fear: { mood: -3, opinion: 0, days: 2, label: t('怕被傳染') },
    cal_grief: { mood: -15, opinion: 0, days: 15, label: t('家人病死了') },
});
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, {
    cal_vax: { icon: '💉', label: '研究疫苗' }, cal_quar: { icon: '🏠', label: '隔離病人' }, cal_mask: { icon: '😷', label: '口罩令' }, cal_close: { icon: '🚪', label: '關閉酒館市集' }, cal_lock: { icon: '🚧', label: '封城' },
});
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { cal_fear: '怕被傳染', cal_family: '家人正在生病', cal_business: '生意會做不下去', cal_freedom: '不想被管', faith: '信仰的關係' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) CALAMITY.daily(w); } catch (e) { console.warn('[Calamity] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (/^cal_/.test(p.kind)) { const r = CALAMITY.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = CALAMITY.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = CALAMITY.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.calamity = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.calamity) { const C = this.calamity; d.calamity = { power: C.power, pDay: C.pDay ?? null, hist: C.hist, st: C.st, coolTo: C.coolTo || 0, cur: C.cur || null }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.calamity = (data?.calamity && typeof data.calamity === 'object') ? data.calamity : null; } catch (e) {} return r; };
}
if (typeof window !== 'undefined') window.CALAMITY = CALAMITY;
