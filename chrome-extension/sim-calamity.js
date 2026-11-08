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
    const ping = (w, kind, icon, title, desc) => { try { w.onCalamity?.(kind, { icon, title, desc }); } catch (e) {} };

    // ---------- 神力 ----------
    const CAP = 100;
    // v7.9.0 災厄工坊(神的工具)延到基因生物、蒸汽煉金都上線之後才開放;引擎照樣跑(實驗室外洩用)。測試可用 localStorage rimtown_lab=1 打開
    const labOpen = () => true; // v8.2.0 災厄工坊正式開放
    // v8.2.0 掛勾:疫情裡的人情世故(sim-plague-ways.js)接在這裡
    const H = { reg: null, mult: null, sus: null, brk: null, mask: null, thr: null, lesson: null, vote: null, daily: null, pre: null, die: [], end: [] };
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
        // v8.4.0 神力統一(打牌、託夢、工坊共用):每天 1.5,越興旺越快(樹大招風),虔誠的人越多越快(信仰就是神力,最多 +1)
        const pros = w.prosperity?.prosperity || 0; let devout = 0; try { if (typeof FAITH !== 'undefined' && w.faith) for (const a of here(w)) if (FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 60) devout++; } catch (e) {}
        C.gain = Math.round((1.5 + (pros >= 60 ? 0.5 : 0) + Math.min(1, devout * 0.04)) * 10) / 10; C.power = Math.min(CAP, Math.round((C.power + C.gain) * 10) / 10);
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
        quirk: { // 怪病特性(最多 2):接到村民原本的行為(說謊、秘密、戀愛、吵架、記憶、花錢、睡眠、性格)
            liar: { icon: '💥', name: '謊言病', desc: '一說謊身上就冒煙，第二次說謊就爆炸', cost: 14 },
            blurt: { icon: '🗣️', name: '藏不住話', desc: '守不住秘密，會把知道的事說出來', cost: 10 },
            love: { icon: '💞', name: '戀愛病', desc: '會愛上下一個遇到的人，也會傳給對方', cost: 8 },
            rage: { icon: '💢', name: '怒火病', desc: '動不動就吵架，吵架會傳染、越吵病越久', cost: 10 },
            amnesia: { icon: '🔁', name: '失憶病', desc: '忘掉最近的人際關係，仇人變陌生人', cost: 12 },
            miser: { icon: '💰', name: '守財病', desc: '只存錢不花錢，經手錢幣的人容易被傳染', cost: 8 },
            sleep: { icon: '😴', name: '長眠病', desc: '一睡好幾天，家人來探望才會醒', cost: 10 },
            flip: { icon: '🪞', name: '換性格病', desc: '性格反轉（善良變刻薄），病好了才變回來', cost: 10 },
        },
        target: { none: { name: '不挑', desc: '人人都會中', cost: 0 }, elder: { name: '老人', desc: '老人特別容易中、容易死', cost: 4 }, child: { name: '小孩', desc: '小孩特別容易中', cost: 4 }, poor: { name: '窮人', desc: '窮人區傳得特別快', cost: 5 }, rich: { name: '富人', desc: '富貴病，宴席傳染', cost: 5 } },
    };
    const SINGLE = ['latency', 'speed', 'length', 'lethal', 'resist', 'climate', 'target'];
    const BASE_COST = 5;
    function norm(spec) {
        const s = spec || {}; const out = { name: String(s.name || '').replace(/[<>{}"'`\\]/g, '').trim().slice(0, 12) || t('無名怪病') };
        out.route = [...new Set((s.route || []).filter(k => P.route[k]))].slice(0, 2); if (!out.route.length) out.route = ['droplet'];
        out.sym = [...new Set((s.sym || []).filter(k => P.sym[k]))].slice(0, 4); if (!out.sym.length) out.sym = ['cough'];
        out.quirk = [...new Set((s.quirk || []).filter(k => P.quirk[k]))].slice(0, 2);
        for (const k of SINGLE) out[k] = P[k][s[k]] ? s[k] : Object.keys(P[k])[k === 'speed' || k === 'latency' || k === 'length' ? 1 : 0];
        return out;
    }
    function cost(spec) { const s = norm(spec); let c = BASE_COST; for (const r of s.route) c += P.route[r].cost; for (const y of s.sym) c += P.sym[y].cost; for (const q of s.quirk) c += P.quirk[q].cost; for (const k of SINGLE) c += P[k][s[k]].cost; return c; }
    const visible = (s) => s.sym.some(y => y === 'rash' || y === 'blind' || y === 'fever');
    function preview(spec) {
        const s = norm(spec); const RW = { droplet: 1, water: 0.9, insect: 0.8, contact: 0.6, animal: 0.5 };
        const spread = Math.min(100, Math.round(s.route.reduce((x, r) => x + RW[r], 0) * 45 * P.speed[s.speed].m * (s.sym.includes('cough') ? 1.2 : 1)));
        const sev = Math.min(100, Math.round((s.sym.reduce((x, y) => x + ({ cough: 10, fever: 18, rash: 6, blind: 22, joint: 14, heart: 28, delirium: 18, sleepy: 8 })[y], 0) + s.quirk.length * 12) * (s.length === 'long' ? 1.3 : s.length === 'short' ? 0.8 : 1)));
        const death = Math.min(100, Math.round((P.lethal[s.lethal].p + (s.sym.includes('heart') ? 0.08 : 0)) * 280));
        const stealth = Math.max(0, Math.min(100, ({ short: 15, mid: 40, long: 75 })[s.latency] + (visible(s) ? -20 : 15)));
        return { spread, sev, death, stealth, cost: cost(s) };
    }

    // ---------- 釋放 ----------
    const COOL = 20; // 結束後冷卻天數
    function canRelease(w) { const C = S(w); if (C.cur) return { ok: false, why: 'active' }; const left = (C.coolTo || 0) - day(w); if (left > 0) return { ok: false, why: 'cooldown', days: left }; return { ok: true }; }
    // v7.9.0 opts.natural:人類自己闖的禍(實驗室外洩):不花神力、不看冷卻,只要現在沒有別的疫情
    function release(w, spec, zeroId, opts) {
        opts = opts || {}; const s = norm(spec); let c = 0;
        if (opts.natural) { if (S(w).cur) return { ok: false, why: 'active' }; }
        else { const can = canRelease(w); if (!can.ok) return can; c = cost(s); if (!spend(w, c)) return { ok: false, why: 'power', need: c }; }
        const pool = adults(w); const zero = (zeroId && w.agents[zeroId] && !w.agents[zeroId].isDead) ? w.agents[zeroId] : rnd(pool.length ? pool : here(w)); if (!zero) return { ok: false, why: 'nobody' };
        const C = S(w); const d = day(w);
        C.cur = { kind: 'pathogen', spec: s, day: d, cost: c, st: {}, found: 0, phase: 'hidden', ms: {}, curve: [], log: [], peak: 0, boost: 0, rumors: 0, fled: 0, died: 0, inf: 0, hoard: 0, scape: null, vax: null, pop0: here(w).length, natural: opts.natural ? (opts.cause || '1') : null };
        C.cur.sn = w.dark?.n ?? 0; infect(w, C.cur, zero, d); if (!opts.natural) C.st.released++;
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
        if (route === 'droplet' && X.ms.mask) m *= H.mask ? H.mask(w, X) : 0.5; // v8.2.0 戴久了會鬆懈
        if ((route === 'droplet' || route === 'contact') && done(w, 'sanitation')) m *= 0.85;
        if (route === 'water') m *= (built(w, 'sewers') ? 0.4 : 1) * (built(w, 'bathhouse') ? 0.8 : 1) * (done(w, 'sanitation') ? 0.6 : 1) * (X.ms.close ? 0.6 : 1);
        if (route === 'insect') m *= se === 'summer' ? 1.6 : se === 'winter' ? 0.15 : 0.8;
        if (X.boost > day(w)) m *= 1.5;
        if (X.pray) m *= 1.2;
        if (H.mult) m *= H.mult(w, X, route); // v8.2.0 煤煙
        return m;
    }
    function spreadDaily(w, X, d) {
        const s = X.spec; const all = here(w); const byId = {}; for (const a of all) byId[a.agentId] = a; const n = all.length || 1;
        const st = (a) => X.st[a.agentId]; const sus = (a) => !st(a) && !X.vx?.[a.agentId];
        const spreaders = all.filter(a => { const x = st(a); return x && (x.s === 'I' || (x.s === 'E' && s.latency === 'long' && d >= x.on - 2)); });
        const nI = spreaders.length; if (!nI) return;
        const tgt = (a) => (s.target === 'none' ? 1 : isTarget(w, X, a) ? 1.8 : 0.7);
        const sm = (a) => (H.sus ? H.sus(w, X, a) : 1); const brk = (a) => !!(H.brk && H.brk(w, X, a)); // v8.2.0 肺不好的人、偷溜的人比較容易染上
        const tryInf = (a, p) => { if (a && sus(a) && Math.random() < p * tgt(a) * sm(a)) infect(w, X, a, d); };
        const quar = X.ms.quar; const epi = quar && done(w, 'epidemiology'); // v7.9.0 流行病學:隔離時連同住的外人也不會被傳
        for (const a of spreaders) {
            const sick = st(a).s === 'I';
            const fam = family(w, a).filter(x => byId[x.agentId]); const home = (sick && epi) ? [] : all.filter(x => x !== a && x.homeLocation && x.homeLocation === a.homeLocation).slice(0, 5); const house = [...new Set([...fam, ...home])];
            const cow = (sick && quar && !brk(a)) ? [] : all.filter(x => x !== a && x.job?.key && x.job.key === a.job?.key).slice(0, 4);
            const soc = (sick && quar && !brk(a)) ? [] : Array.from({ length: X.ms.close ? 2 : 3 }, () => rnd(all)).filter(x => x !== a);
            const reg = H.reg ? H.reg(w, X, a, sick) : []; // v8.2.0 每天固定在同一個地方碰面的人
            if (s.route.includes('droplet')) { const m = spreadMult(w, X, 'droplet'); house.forEach(x => tryInf(x, 0.12 * m)); cow.forEach(x => tryInf(x, 0.08 * m)); soc.forEach(x => tryInf(x, 0.05 * m)); reg.forEach(x => tryInf(x, 0.06 * m)); }
            if (s.route.includes('contact')) { const m = spreadMult(w, X, 'contact'); house.forEach(x => tryInf(x, 0.15 * m)); cow.forEach(x => tryInf(x, 0.06 * m)); reg.forEach(x => tryInf(x, 0.03 * m)); }
            if (s.target === 'rich' && !X.ms.close && Math.random() < 0.3) all.filter(x => wal(w, x) > 200).slice(0, 3).forEach(x => tryInf(x, 0.08)); // 富貴病:宴席
        }
        if (s.quirk.includes('miser')) { const handlers = all.filter(x => ['trader', 'cook'].includes(x.job?.key)); for (const a of spreaders) for (const h of handlers) tryInf(h, 0.06); } // 守財病:經手錢幣的人
        if (s.quirk.includes('love')) for (const a of spreaders) { const tg = X.st[a.agentId]?.lv && byId[X.st[a.agentId].lv]; if (tg) tryInf(tg, 0.25); } // 戀愛病:傳給愛上的人
        const frac = Math.min(1, nI / n * 8);
        if (s.route.includes('water')) { const m = spreadMult(w, X, 'water'); for (const a of all) tryInf(a, 0.015 * frac * m); }
        if (s.route.includes('animal')) { const m = spreadMult(w, X, 'animal'); const pets = new Set((w.pets?.list || []).map(p => p.owner).filter(Boolean)); for (const a of all) tryInf(a, (pets.has(a.agentId) || a.job?.key === 'farmer' ? 0.03 : 0.005) * frac * m); }
        if (s.route.includes('insect')) { const m = spreadMult(w, X, 'insect'); for (const a of all) tryInf(a, 0.02 * frac * m); }
    }
    function progressDaily(w, X, d) {
        const s = X.spec; const alive = npcs(w).length;
        for (const [id, x] of Object.entries(X.st)) {
            const a = w.agents[id]; if (!a || a.isDead) { if (x.s === 'E' || x.s === 'I') { x.s = 'R'; if (a) try { quirkEnd(w, X, a, x); } catch (e) {} } continue; }
            if (x.s === 'E' && d >= x.on) { x.s = 'I'; a.addThought?.('cal_sick', w); mem(w, a, X.found ? '我染上了{n}，渾身不舒服。' : '我這幾天身體很不對勁，不知道怎麼了。', { n: s.name }, 6); try { quirkOnset(w, X, a, x, d); } catch (e) { console.warn('[Calamity] quirk', e); } }
            if (x.s !== 'I') continue;
            for (const y of s.sym) { const Y = P.sym[y]; if (Y.part && typeof HEALTH !== 'undefined') { HEALTH.hurt(w, a, Y.part, Y.dmg); if (y === 'joint') HEALTH.hurt(w, a, 'f', 1); } }
            if (d < x.end - (x.tr ? 1 : 0)) continue;
            // 病程結束:康復或死亡
            const age = a.age ?? 30; let p = P.lethal[s.lethal].p + (s.sym.includes('heart') ? 0.08 : 0);
            p *= (age >= 60 ? 2 : age < 12 ? 1.4 : 1) * (x.tr ? (s.resist === 'on' ? 0.75 : 0.5) : 1) * (isTarget(w, X, a) ? 1.3 : 1);
            if (alive <= 5) p = 0; // 最後幾個人自然免疫
            try { quirkEnd(w, X, a, x); } catch (e) {}
            if (Math.random() < p) { x.s = 'D'; X.died++; S(w).st.died++; die(w, X, a); }
            else { x.s = 'R'; a.addThought?.('cured', w); mem(w, a, X.found ? '我撐過了{n}，總算好起來了。' : '病了一場，總算好起來了。', { n: s.name }, 6); }
        }
    }
    function die(w, X, a) {
        const fam = family(w, a).filter(f => !f.isDead);
        a._deathCause = X.spec.name;
        log(w, X.found ? '⚰️ {a}死於{n}。' : '⚰️ {a}病了幾天就走了，沒人知道是什麼病。', { a: a.name, n: X.spec.name }, a.name);
        try { w.lifecycle?._killNpc?.(w, a); } catch (e) {}
        for (const f of fam) { f._calLoss = day(w); f.addThought?.('cal_grief', w); mem(w, f, X.found ? '{n}奪走了我的家人{a}。' : '{a}病死了，我好難過。', { n: X.spec.name, a: a.name }, 9); (X.bereaved = X.bereaved || []).push(f.agentId); }
        for (const f of H.die) try { f(w, X, a); } catch (e) { console.warn('[Calamity] die hook', e); }
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

    // ---------- 怪病特性 ----------
    const FLIP = { kind: 'abrasive', abrasive: 'kind', shy: 'charismatic', charismatic: 'shy', hardworking: 'lazy', lazy: 'hardworking', optimist: 'pessimist', pessimist: 'optimist', glutton: 'ascetic', ascetic: 'glutton', stoic: 'neurotic', neurotic: 'stoic', early_bird: 'night_owl', night_owl: 'early_bird' };
    const hasQ = (X, q) => (X.spec.quirk || []).includes(q);
    const honest = (a) => { try { return typeof DARK !== 'undefined' && DARK.honesty ? DARK.honesty(a) : 1.5; } catch (e) { return 1.5; } };
    function quirkOnset(w, X, a, x, d) {
        const s = X.spec;
        if (hasQ(X, 'love')) { const tg = rnd(adults(w).filter(o => o !== a && !family(w, a).includes(o))); if (tg) { x.lv = tg.agentId; const r = a.relationships?.getOrCreate?.(tg.agentId, tg.name); r?.modifyRomantic?.(70); r?.modifyAffinity?.(25); mem(w, a, '我突然滿腦子都是{b}，好想見到對方。', { b: tg.name }, 7); const sp = a.relationships?.getSpouse?.(); const spA = sp && w.agents[sp.targetId]; if (spA && spA !== tg) { aff(spA, a, -15); mem(w, spA, '{a}最近魂不守舍，一直往{b}那裡跑。', { a: a.name, b: tg.name }, 7); } log(w, '💞 {a}突然瘋狂愛上了{b}。', { a: a.name, b: tg.name }, a.name); } }
        if (hasQ(X, 'amnesia')) { let n = 0; for (const r of Object.values(a.relationships?.relationships || {})) { if (r.status === 'married') continue; r.affinity = Math.round((r.affinity || 0) * 0.3); r.trust = Math.round((r.trust || 0) * 0.3); n++; } x.amn = 1; mem(w, a, '我好像忘了很多人、很多事，大家看起來都好陌生。', {}, 8); if (n) log(w, '🔁 {a}醒來之後認不得好多人，連以前的仇人也忘了。', { a: a.name }, a.name); }
        if (hasQ(X, 'flip')) { const tr = a.personality?.traits; if (Array.isArray(tr) && tr.some(k => FLIP[k])) { x.tr0 = tr.slice(); a.personality.traits = tr.map(k => FLIP[k] || k); log(w, '🪞 {a}像變了一個人，平常的個性全反了過來。', { a: a.name }, a.name); } }
        if (hasQ(X, 'miser')) { const tr = a.personality?.traits; if (Array.isArray(tr) && !tr.includes('greedy')) { tr.push('greedy'); x.mg = 1; } mem(w, a, '錢一定要存起來，一分都不能花。', {}, 6); }
        if (hasQ(X, 'sleep')) log(w, '😴 {a}睡著之後就叫不醒了。', { a: a.name }, a.name);
    }
    function quirkEnd(w, X, a, x) {
        if (x.tr0) { a.personality.traits = x.tr0; delete x.tr0; }
        if (x.mg) { const tr = a.personality?.traits; if (Array.isArray(tr)) { const i = tr.indexOf('greedy'); if (i >= 0) tr.splice(i, 1); } delete x.mg; }
    }
    function explode(w, X, a, d) {
        const near = here(w).filter(o => o !== a && (o.currentLocation === a.currentLocation || Math.random() < 0.1)).slice(0, 2);
        for (const o of near) { try { HEALTH?.hurt?.(w, o, 'h', 15); } catch (e) {} mem(w, o, '{a}說了謊之後當場爆炸，我被波及受了傷。', { a: a.name }, 8); }
        X.st[a.agentId].s = 'D'; X.died++; S(w).st.died++; X.boom = (X.boom || 0) + 1;
        log(w, '💥 {a}又說了謊——砰！當場爆炸了。{n}', { a: a.name, n: near.length ? fill('{b}被波及受傷。', { b: names(near) }) : '' }, a.name); news(w, '💥 {a}說謊爆炸，全鎮嚇壞了', { a: a.name }, 10, [a.name]);
        X.log.push([d, 'boom', t(a.name)]); a._deathCause = fill('{n}（說謊爆炸）', { n: X.spec.name });
        const fam = family(w, a).filter(f => !f.isDead); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {}
        for (const f of fam) { f.addThought?.('cal_grief', w); (X.bereaved = X.bereaved || []).push(f.agentId); }
        for (const o of here(w)) if (o !== a && !near.includes(o)) mem(w, o, '{a}一說謊就爆炸了，我以後什麼謊都不敢說。', { a: a.name }, 7);
        ping(w, 'boom', '💥', fill('{a}說謊爆炸', { a: a.name }), fill('{a}又說了謊——砰！當場爆炸了。', { a: a.name }));
    }
    function strike(w, X, a, d) {
        const x = X.st[a.agentId]; x.lies = (x.lies || 0) + 1;
        if (x.lies >= 2 && npcs(w).length > 5) return explode(w, X, a, d);
        try { HEALTH?.hurt?.(w, a, 'c', 10); } catch (e) {} a.moodModifier = (a.moodModifier || 0) - 8;
        log(w, '💨 {a}說了謊，身上立刻冒出白煙，旁邊的人嚇得退開。', { a: a.name }, a.name); mem(w, a, '我一說謊身上就冒煙……再說一次會怎樣？', {}, 8); X.log.push([d, 'smoke', t(a.name)]);
    }
    const SMALL_LIES = ['🤥 {b}問{a}是不是偷吃了東西，{a}說「沒有啊」——', '🤥 {a}跟{b}說「我身體很好，一點事都沒有」——', '🤥 {a}跟{b}誇口自己以前多風光——'];
    function quirkDaily(w, X, d) {
        const s = X.spec; if (!(s.quirk || []).length) return; const D = w.dark; const sick = here(w).filter(a => X.st[a.agentId]?.s === 'I');
        if (hasQ(X, 'liar')) {
            if (D && Array.isArray(D.secrets)) { const n0 = X.sn ?? D.n; for (const sc of D.secrets) { const k = +String(sc.id).slice(1); if (k > n0 && X.st[sc.culprit]?.s === 'I') { const a = w.agents[sc.culprit]; if (a && !a.isDead) strike(w, X, a, d); } } X.sn = D.n; }
            const scared = (X.boom || 0) > 0 ? 0.5 : 1; // 有人爆炸過,大家更不敢說謊
            for (const a of sick) { if (a.isDead || X.st[a.agentId]?.s !== 'I') continue; const hn = honest(a); const pl = (hn <= 1 ? 0.12 : hn < 2 ? 0.05 : 0.01) * scared; if (Math.random() < pl) { const o = rnd(here(w).filter(y => y !== a)); log(w, rnd(SMALL_LIES), { a: a.name, b: o?.name || t('鄰居') }, a.name); strike(w, X, a, d); } }
            for (const a of sick) { if (a.isDead || X.st[a.agentId]?.s !== 'I') continue; const mine = (D?.secrets || []).filter(sc => !sc.found && sc.stage !== 'off' && sc.culprit === a.agentId && sc.kind !== 'white'); if (!mine.length || Math.random() > 0.2) continue;
                const asker = rnd(adults(w).filter(o => o !== a)); if (!asker) continue;
                if (honest(a) >= 2 || hasT(a, 'pessimist')) { try { DARK.reveal(w, mine[0], asker); } catch (e) {} log(w, '😰 {b}當面逼問，{a}怕說謊會爆炸，只好全招了。', { a: a.name, b: asker.name }, a.name); X.log.push([d, 'confess', t(a.name)]); }
                else { log(w, '🤥 {b}當面逼問，{a}硬是說了謊……', { a: a.name, b: asker.name }, a.name); strike(w, X, a, d); } }
        }
        if (hasQ(X, 'blurt')) for (const a of sick) { if (Math.random() > 0.35 || !D) continue; const pool = (D.secrets || []).filter(sc => !sc.found && sc.stage !== 'off' && sc.kind !== 'white'); const mine = pool.filter(sc => sc.culprit === a.agentId); const sc = mine[0] || (Math.random() < 0.5 ? rnd(pool) : null); if (!sc) continue; log(w, '🗣️ {a}燒得迷迷糊糊，忍不住把秘密說溜了嘴。', { a: a.name }, a.name); try { DARK.reveal(w, sc, a); } catch (e) {} X.log.push([d, 'blurt', t(a.name)]); }
        if (hasQ(X, 'rage')) for (const a of sick) { if (Math.random() > 0.18) continue; const o = rnd(here(w).filter(y => y !== a)); if (!o) continue; aff(a, o, -8); aff(o, a, -8); const x = X.st[a.agentId]; if ((x.rg || 0) < 4) { x.end++; x.rg = (x.rg || 0) + 1; } log(w, '💢 {a}為了一點小事跟{b}大吵一架。', { a: a.name, b: o.name }, a.name); if (!X.st[o.agentId] && !X.vx?.[o.agentId] && Math.random() < 0.35) infect(w, X, o, d); }
        if (hasQ(X, 'sleep')) for (const a of sick) { const x = X.st[a.agentId]; const fam = family(w, a).filter(f => !f.isDead && here(w).includes(f) && X.st[f.agentId]?.s !== 'I'); if (fam.length && Math.random() < 0.4) { x.end = Math.min(x.end, d); x.woke = 1; mem(w, a, '{b}一直守在床邊叫我，我終於醒了。', { b: fam[0].name }, 8); log(w, '🌅 {b}守在床邊一直叫，長眠的{a}終於醒了。', { a: a.name, b: fam[0].name }, a.name); } else if (!fam.length && d >= x.end - 1 && (x.ext || 0) < 3) { x.end += 2; x.ext = (x.ext || 0) + 1; } }
    }

    // ---------- 劇情階段 ----------
    const count = (X, k) => Object.values(X.st).filter(x => x.s === k).length;
    function found(w, X, d, byDeath) {
        if (X.found) return; X.found = d; X.phase = 'found';
        const doc = here(w).find(a => a.job?.key === 'doctor'); const sick = here(w).filter(a => X.st[a.agentId]?.s === 'I');
        const k = doc ? '🩺 {doc}看了幾個病人之後確定：鎮上出現了新的傳染病，大家叫它「{n}」。' : '🩺 接連有人病倒{dead}，鎮上的人開始說這是一種新的怪病，叫它「{n}」。';
        const p = { doc: doc?.name || '', n: X.spec.name, dead: byDeath ? t('，還死了人') : '' };
        log(w, k, p, doc?.name); news(w, k, p, 9, doc ? [doc.name] : []); X.log.push([d, 'found', doc ? t(doc.name) : '']); ping(w, 'found', '🩺', fill('{n}被發現了', { n: X.spec.name }), fill(k, p));
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
            const thr = (here(w).some(a => a.job?.key === 'doctor') ? 2 : 4) + (s.latency === 'long' ? 1 : 0) - (visible(s) ? 1 : 0) - (s.sym.includes('rash') ? 1 : 0) - (done(w, 'epidemiology') ? 1 : 0) - (H.thr ? H.thr(w, X) : 0); // v8.2.0 上次疫情的教訓也會早一點發現;v7.9.0 流行病學:早一點發現
            if (nI >= Math.max(2, thr)) found(w, X, d, false); // 至少兩個病例才看得出是傳染病(有人死了也會被發現)
            return;
        }
        // ② 研究 ③ 流言
        if (d - X.found >= 1 && X.rumors < 4 && Math.random() < 0.45) rumor(w, X, d);
        // ④ 恐慌
        const panic = nI / pop >= 0.15 || X.died >= 2;
        if (panic) {
            if (X.phase === 'found' || X.phase === 'rumor') { X.phase = 'panic'; X.log.push([d, 'panic', '']); try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: 'epidemic', sev: X.died >= 3 || nI / pop >= 0.3 ? 3 : 2, cause: s.name, who: (X.bereaved || []).map(id => w.agents[id]).filter(Boolean) }); } catch (e) {} log(w, '😱 {n}越傳越兇，鎮上人心惶惶。', { n: s.name }); news(w, '😱 {n}擴散，鎮上陷入恐慌', { n: s.name }, 9, []); ping(w, 'panic', '😱', fill('{n}擴散，鎮上陷入恐慌', { n: s.name }), fill('{n}越傳越兇，鎮上人心惶惶。', { n: s.name })); }
            for (const a of here(w)) if (!X.st[a.agentId] || X.st[a.agentId].s === 'R') a.addThought?.('cal_fear', w);
            if (!X.ms.lock) { const ws = adults(w).map(a => wal(w, a)).sort((x, y) => y - x); const top = ws[Math.floor(ws.length / 4)] ?? 999; const rich = adults(w).filter(a => !X.st[a.agentId] && wal(w, a) >= Math.max(40, top) && Math.random() < 0.04).slice(0, 2); /* 最有錢的四分之一先逃 */ for (const a of rich) { try { if (w.leaveTown?.(a.agentId, fill('怕染上{n}，帶著家當逃走了', { n: s.name }))) { X.fled++; log(w, '🧳 {a}怕染上{n}，收拾家當逃離了小鎮。', { a: a.name, n: s.name }, a.name); } } catch (e) {} } }
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
        for (const [id, x] of Object.entries(X.st)) { const a = w.agents[id]; if (a) try { quirkEnd(w, X, a, x); } catch (e) {} } // 換性格、守財的人一律變回來
        const C = S(w); const s = X.spec; const rec = { name: s.name, day: X.day, end: d, inf: X.inf, died: X.died, fled: X.fled, peak: X.peak, vax: !!X.vax?.done, found: X.found ? X.found - X.day : null, cost: X.cost, survived: npcs(w).length > 0, how: X.vax?.done ? 'cure' : 'endure' }; // 撐過災難:研發出對策成功,或鎮上還有人活著
        for (const f of H.end) try { f(w, X, rec); } catch (e) { console.warn('[Calamity] end hook', e); }
        C.hist.unshift(rec); C.hist = C.hist.slice(0, 8); C.cur = null; C.coolTo = d + COOL;
        const k = X.died ? '🕯️ {n}終於過去了：{i} 人染病、{d} 人死去、{f} 人逃走。鎮上為死者辦了追思會。' : '🌈 {n}終於過去了：{i} 人染病，沒有人死。';
        log(w, k, { n: s.name, i: X.inf, d: X.died, f: X.fled }); news(w, k, { n: s.name, i: X.inf, d: X.died, f: X.fled }, 9, []); ping(w, 'end', X.died ? '🕯️' : '🌈', fill('{n}過去了', { n: s.name }), fill(k, { n: s.name, i: X.inf, d: X.died, f: X.fled }));
        for (const a of here(w)) mem(w, a, X.died ? '{n}帶走了 {d} 條人命，我們撐過來了，但不會忘記。' : '{n}過去了，大家總算鬆了一口氣。', { n: s.name, d: X.died }, 7);
        if (X.ms.lock || X.ms.close || X.ms.mask || X.ms.quar) log(w, '📋 疫情過去，封城、關店、口罩、隔離這些規定都解除了。', {});
        // 大災之後的文明倒退:死的人、逃的人佔原本人口多少決定摧毀程度;疫苗做出來了最多輕度
        const p0 = Math.max(1, X.pop0 || (npcs(w).length + X.died + X.fled)); const sc = Math.round(X.died / p0 * 200 + X.fled / p0 * 80);
        if (sc >= 15) { const rg = regress(w, s.name, sc, { countered: !!X.vax?.done }); if (rg) rec.reg = { tier: rg.tier, lost: rg.lost.length, saved: rg.saved }; }
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
        const f = H.lesson ? H.lesson(w, X) : 1; const n2 = Math.max(1, Math.round(2 * f)); // v8.2.0 吃過虧的小鎮會早一點開始防疫
        ask('vax', !X.vax, res || doctor || pickBy(w, a => hasV(a, '知識') ? 2 : 0), '研究{n}的對策', '{who}說要想辦法對付{n}：研究員先停下手上的研究，全力研究疫苗和治法。', 'culture');
        ask('quar', nI >= n2, doctor || pickBy(w, a => hasT(a, 'pessimist') ? 2 : 0), '隔離{n}的病人', '{who}提議把得了{n}的人留在家裡，不准出門上工，家人送飯就好。', 'welfare');
        ask('mask', s.route.includes('droplet') && nI >= n2, doctor || pickBy(w, a => a.job?.key === 'tailor' ? 2 : 0), '出門戴口罩', '{who}說{n}靠飛沫傳，提議大家出門都戴口罩，裁縫用庫存的布趕工。', 'welfare');
        ask('close', nI / pop >= 0.1 * f, doctor || pickBy(w, a => a.job?.key === 'mayor' ? 2 : 0), '暫時關閉酒館與市集', '{who}說人擠人的地方最容易傳{n}，提議酒館和市集先關，等疫情過去再開。', 'welfare');
        ask('lock', nI / pop >= 0.15 * f, pickBy(w, a => (a.job?.key === 'guard' ? 2 : 0) + (a.job?.key === 'mayor' ? 1.5 : 0)), '封城：不准進出', '{who}提議封城：商隊、外人不准進來，鎮上的人也不准出去，免得{n}越傳越廣。', 'defense');
        // v8.2.0 關太久了:做生意的人提議先重開
        const lastDeath = X.pw?.fear ?? X.day; if (ms.close && d - ms.close >= 20 && nI <= 1 && d - lastDeath >= 10 && !busy(w, 'cal_reopen') && !(X.asked.reopen && d - X.asked.reopen < 8)) { const who = pickBy(w, a => (a.job?.key === 'cook' ? 2 : 0) + (a.job?.key === 'trader' ? 2 : 0) + (owner(w, a) ? 2.5 : 0)); if (propose(w, 'cal_reopen', who, '重開酒館與市集', '{who}說酒館和市集已經關了 {k} 天，這幾天幾乎沒有新病人，再不開大家都撐不下去了，提議先重開。', { n: s.name, k: d - ms.close }, 'economy')) X.asked.reopen = d; }
    }
    function enact(w, kind) {
        const C = S(w); const X = C.cur; if (!X) return ''; const k = kind.replace(/^cal_/, ''); const n = X.spec.name;
        if (k === 'vax') { const cx = X.spec.route.length + X.spec.sym.length + (X.spec.resist === 'on' ? 2 : 0) + (X.spec.latency === 'long' ? 1 : 0); let need = 300 + 70 * cx; for (const [tk, m] of [['vaccination', 0.6], ['mass_vaccine', 0.7], ['microbiology', 0.7], ['immunology', 0.7], ['genetics', 0.8]]) if (done(w, tk)) need *= m; X.vax = { p: 0, need: Math.round(need), done: 0 }; log(w, '🔬 研究員放下手上的研究，全力研究{n}的疫苗。', { n }); X.log.push([day(w), 'vax', '']); return t('開始研究疫苗'); }
        if (k === 'reopen') { if (!X.ms.close) return ''; delete X.ms.close; for (const a of here(w)) a.moodModifier = (a.moodModifier || 0) + 2; X.log.push([day(w), 'reopen', '']); log(w, '🍻 酒館和市集重新開門了，第一天就擠滿了人。', {}); return t('酒館與市集重新開門'); }
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
            if (V.p >= V.need) { V.done = d; log(w, '💉 {n}的疫苗研究出來了！醫生開始幫大家打針。', { n: X.spec.name }); news(w, '💉 {n}疫苗問世', { n: X.spec.name }, 9, []); X.log.push([d, 'vaxdone', '']); ping(w, 'vax', '💉', fill('{n}疫苗問世', { n: X.spec.name }), fill('{n}的疫苗研究出來了！醫生開始幫大家打針。', { n: X.spec.name })); }
            return;
        }
        X.vx = X.vx || {}; for (const a of here(w)) if (!X.st[a.agentId] && !X.vx[a.agentId] && Math.random() < 0.3) X.vx[a.agentId] = d; // 每天三成的人打到疫苗
    }
    function vote(w, p, a) {
        const X = S(w).cur; const k = p.kind.replace(/^cal_/, ''); const x = X?.st?.[a.agentId]; const fam = X ? family(w, a).some(f => X.st[f.agentId]?.s === 'I') : false;
        const scared = X && (X.died > 0 || count(X, 'I') >= 3);
        let s = 0.5 + (scared ? 1 : 0) + (hasT(a, 'pessimist') ? 1 : 0) + (a.job?.key === 'doctor' ? 1.5 : 0) + (hasV(a, '家庭') ? 0.6 : 0) - (hasT(a, 'optimist') ? 0.6 : 0);
        let why = s > 0 ? 'cal_fear' : 'gut';
        if (k === 'quar') { if (x?.s === 'I' || fam) { s -= 4; why = 'cal_family'; } if (hasT(a, 'kind')) s -= 0.5; }
        if (k === 'close') { if (a.job?.key === 'cook' || a.job?.key === 'trader' || owner(w, a)) { s -= 2.5; why = 'cal_business'; } if (hasT(a, 'glutton')) s -= 0.5; }
        if (k === 'lock') { s -= 0.6; if (a.job?.key === 'trader' || owner(w, a)) { s -= 2.5; why = 'cal_business'; } if (hasV(a, '自由')) { s -= 1.5; why = 'cal_freedom'; } }
        if (k === 'mask') { s += 0.5; if (hasT(a, 'lazy')) s -= 1; if (hasV(a, '自由')) { s -= 1; why = 'cal_freedom'; } }
        if (k === 'reopen') { s = 0.2 - (a.job?.key === 'doctor' ? 2 : 0) - (X && day(w) - (X.pw?.fear ?? -99) < 10 ? 1.5 : 0) - (hasT(a, 'pessimist') ? 1 : 0); why = 'cal_fear'; if (a.job?.key === 'cook' || a.job?.key === 'trader' || owner(w, a)) { s += 3; why = 'cal_business'; } if (hasT(a, 'glutton') || hasT(a, 'charismatic')) s += 0.8; s += Math.random() - 0.5; return s > 0 ? { v: 'for', why: why === 'cal_fear' ? 'cal_tired' : why } : { v: 'against', why: 'cal_fear' }; }
        if (H.vote && X) { const r = H.vote(w, X, a, k); if (r) { s += r.s; if (r.why && Math.abs(r.s) >= 0.5) why = r.why; } } // v8.2.0 上次疫情的記憶、防疫疲乏
        if (k === 'vax') { s += 1; if (a.job?.key === 'researcher') s += 1; if (devout(w, a) && Math.random() < 0.4) { s -= 2.5; why = 'faith'; } }
        s += Math.random() - 0.5;
        return s > 0 ? { v: 'for', why: why === 'cal_lesson' ? why : 'cal_fear' } : { v: 'against', why: why === 'cal_fear' || why === 'cal_lesson' ? 'gut' : why }; // 理由跟票的方向一致
    }

    // ---------- 每天 ----------
    function daily(w) {
        const C = S(w); const d = day(w); powerDaily(w, C, d);
        const X = C.cur; if (!X || X.lastDay === d) return; X.lastDay = d;
        if (X.kind === 'pathogen') { if (H.pre) try { H.pre(w, X, d); } catch (e) { console.warn('[Calamity] pre hook', e); } spreadDaily(w, X, d); quirkDaily(w, X, d); progressDaily(w, X, d); treatDaily(w, X, d); }
        storyDaily(w, X, d); measuresDaily(w, X, d); vaxDaily(w, X, d); if (H.daily) try { H.daily(w, X, d); } catch (e) { console.warn('[Calamity] daily hook', e); }
        endCheck(w, X, d); ping(w, 'day');
    }

    // ---------- 給身體系統、AI、介面 ----------
    const stOf = (w, a) => w?.calamity?.cur?.st?.[a?.agentId] || null;
    function workMult(w, a) { const X = w?.calamity?.cur; const x = X?.st?.[a.agentId]; if (!x || x.s !== 'I') return 1; let m = 1; if (X.spec.sym.includes('fever')) m *= 0.3; if (X.spec.sym.includes('sleepy')) m *= 0.8; if (X.ms.quar) m *= 0.5; if ((X.spec.quirk || []).includes('sleep')) m *= 0.05; return m; }
    function sleepMult(w, a) { const X = w?.calamity?.cur; const x = X?.st?.[a.agentId]; return x?.s === 'I' && X.spec.sym.includes('sleepy') ? 0.6 : 1; }
    function brief(w, a) {
        const C = w?.calamity; if (!C) return ''; const X = C.cur; const x = X?.st?.[a.agentId];
        if (X && (X.bereaved || []).includes(a.agentId)) return fill(X.found ? '{n}奪走了我的家人' : '我的家人病死了', { n: X.spec.name });
        if (x?.s === 'I') { const q = X.spec.quirk || []; const extra = q.includes('liar') ? t('，一說謊身上就會冒煙，不敢亂說話') : q.includes('amnesia') ? t('，很多人和事都想不起來') : q.includes('love') && x.lv ? fill('，滿腦子都是{b}', { b: w.agents[x.lv]?.name || '' }) : q.includes('miser') ? t('，捨不得花任何一分錢') : ''; return (X.found ? fill('我得了{n}，渾身不舒服', { n: X.spec.name }) : t('我這幾天身體很不對勁')) + extra; }
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
    // ---------- 大災之後的文明倒退(所有世界級災厄共用) ----------
    // 摧毀分數 0~100 → 輕度(<20)、中度(20~45)、重度(45~70)、毀滅(≥70);第一、二時代的基本功不會失傳;人類的對策成功了最多輕度。
    // 文書房、印刷坊、學堂、研究院、活下來的研究員、文字與印刷術讓每一項有機會保住;失傳的科技留下殘卷(三到六成進度),
    // 靠它開的建築停擺到重新研究出來為止。重新研究出來會寫進日誌與史書。
    const REG_TIER = [[70, 'catastrophic', 0.55], [45, 'heavy', 0.32], [20, 'moderate', 0.15], [0, 'light', 0.06]];
    const REG_NAME = { light: '輕度', moderate: '中度', heavy: '重度', catastrophic: '毀滅性' };
    const KEEP_BLD = [['archive', 0.1], ['press', 0.12], ['school', 0.08], ['institute', 0.12]];
    function keepChance(w) {
        let p = 0.05; for (const [k, v] of KEEP_BLD) if (built(w, k)) p += v;
        if (done(w, 'writing')) p += 0.05; if (done(w, 'printing')) p += 0.08;
        p += Math.min(0.15, here(w).filter(a => a.job?.key === 'researcher').length * 0.03);
        return Math.min(0.75, p);
    }
    const lostOf = (w) => { const C = S(w); C.lost = C.lost || {}; return C.lost; };
    function regress(w, cause, score, opts) {
        const R = w.research; if (!R?.projects) return null; opts = opts || {};
        let sc = Math.max(0, Math.min(100, Math.round(score || 0))); if (opts.countered) sc = Math.min(sc, 19);
        const [, tier, frac] = REG_TIER.find(([m]) => sc >= m); const L = lostOf(w); const d = day(w); const C = S(w);
        const cand = Object.values(R.projects).filter(p => p.status === 'complete' && (p.era || 1) >= 3 && p.key !== 'refine' && (!opts.only || opts.only.includes(p.key)));
        const want = Math.min(cand.length, Math.floor(cand.length * frac + (tier === 'light' ? Math.random() * 0.9 : 0.5)));
        cand.sort((a, b) => (b.era || 1) - (a.era || 1) || Math.random() - 0.5);
        const kp = opts.keep ?? keepChance(w); const lost = []; let saved = 0;
        const lose = (p, why) => { p.status = 'locked'; p.progress = Math.round(p.cost * (0.3 + Math.random() * 0.3)); L[p.key] = { d, c: cause, why }; lost.push(p); };
        const vault = built(w, 'seed_vault'); // v7.9.0 種子庫:農業的學問保得住
        for (const p of cand.slice(0, want)) { if (Math.random() < kp || (vault && (p.effects?.farm_bonus || 0) > 0)) { saved++; continue; } lose(p, 'lost'); }
        // 前置失傳了,後面的也跟著做不出來
        for (let again = true; again;) { again = false; for (const p of Object.values(R.projects)) if (p.status === 'complete' && (p.era || 1) >= 3 && p.key !== 'refine' && (p.prerequisites || []).some(k => L[k] && R.projects[k]?.status !== 'complete')) { lose(p, 'chain'); again = true; } }
        if (R.current && R.projects[R.current]?.status !== 'researching') R.current = null;
        try { R.refreshLocks?.(); } catch (e) {} try { w.buildings?.recomputeEffects?.(w); } catch (e) {}
        const rec = { c: cause, d, sc, tier, lost: lost.map(p => p.key), saved, kp: Math.round(kp * 100) };
        C.regs = [rec].concat(C.regs || []).slice(0, 8);
        const nm = lost.slice(0, 5).map(p => t(p.name)).join(t('、')) + (lost.length > 5 ? fill('等 {n} 項', { n: lost.length }) : '');
        if (lost.length) {
            const k = '📜 {c}之後，文明倒退（{t}）：{list}失傳了，只剩下殘卷。'; const pp = { c: cause, t: REG_NAME[tier], list: nm };
            log(w, k, pp); news(w, k, pp, 9, []); ping(w, 'regress', '📜', t('文明倒退'), fill(k, pp));
            const dead = dormant(w); if (dead.length) log(w, '🏚️ 沒有人懂得怎麼操作，{list}停擺了。', { list: dead.slice(0, 5).map(b => t(b.name)).join(t('、')) });
            for (const a of here(w).filter(a => a.job?.key === 'researcher')) mem(w, a, '{c}之後，好多學問都失傳了，只剩下殘缺的手稿。', { c: cause }, 7);
        } else if (saved) log(w, '📚 {c}之後，靠著留下來的書和學者，鎮上的學問一項都沒有失傳。', { c: cause });
        return rec;
    }
    // 靠失傳科技開的建築:解鎖它的科技都還沒重新研究出來 → 停擺(效果不算)
    function dormantB(w, b) {
        const L = w?.calamity?.lost; if (!L) return false; const k = b.buildingKey || b.key; const by = (typeof RESEARCH_UNLOCKED_BY !== 'undefined' && RESEARCH_UNLOCKED_BY[k]) || [];
        return by.length > 0 && by.some(x => L[x]) && !by.some(x => w.research?.projects?.[x]?.status === 'complete');
    }
    const dormant = (w) => (w.buildings?.completed || []).filter(b => dormantB(w, b));
    // 每天看看有沒有失傳的科技重新研究出來
    function rediscover(w) {
        const L = w?.calamity?.lost; if (!L) return; const C = S(w);
        for (const [k, x] of Object.entries(L)) { const p = w.research?.projects?.[k]; if (!p) { delete L[k]; continue; } if (p.status !== 'complete') continue;
            delete L[k]; C.redisc = (C.redisc || 0) + 1; const pp = { p: t(p.name), c: x.c, n: Math.max(0, day(w) - x.d) };
            log(w, '📜 失傳的「{p}」重新研究出來了！（{n} 天前在{c}中失傳）', pp); news(w, '📜 失傳的「{p}」重新研究出來了！（{n} 天前在{c}中失傳）', pp, 7, []); }
    }
    function view(w) {
        const C = S(w); const X = C.cur; const sb = sandbox(); const can = canRelease(w);
        const base = { power: sb ? null : Math.floor(C.power), cap: CAP, sandbox: sb, can, cool: Math.max(0, (C.coolTo || 0) - day(w)), hist: C.hist.slice(0, 5), regs: (C.regs || []).slice(0, 5), lost: Object.keys(C.lost || {}), redisc: C.redisc || 0, parts: P, single: SINGLE, base: BASE_COST, boostCost: 15 };
        if (!X) return base;
        const s = X.spec; const E = count(X, 'E'), I = count(X, 'I'), R = count(X, 'R');
        return Object.assign(base, { cur: { name: s.name, spec: s, day: X.day, days: day(w) - X.day, phase: X.phase, phaseName: t(PHASE[X.phase] || ''), found: !!X.found, E, I, R, D: X.died, fled: X.fled, inf: X.inf, peak: X.peak, ms: Object.keys(X.ms), vax: X.vax ? { pct: Math.round(X.vax.p / X.vax.need * 100), done: !!X.vax.done, shots: Object.keys(X.vx || {}).length } : null, curve: X.curve.slice(-60), log: X.log.slice(-10).reverse(), boosting: X.boost > day(w), pop: here(w).length, scape: X.scape ? t(w.agents[X.scape]?.name || '') : '' } });
    }
    return { H, here, adults, propose, _q: { strike, onset: quirkOnset, end: quirkEnd, daily: quirkDaily }, W: null, CAP, P, SINGLE, BASE_COST, S, power, spend, sandbox, norm, cost, preview, canRelease, release, boost, daily, enact, vote, workMult, sleepMult, brief, townBrief, view, stOf, count, found, infect, COOL, PHASE, labOpen, regress, keepChance, dormant, dormantB, rediscover, REG_NAME };
})();

// ---------- 接上其他系統 ----------
if (typeof HEALTH !== 'undefined') {
    const _wm = HEALTH.workMult; HEALTH.workMult = (w, a) => _wm(w, a) * CALAMITY.workMult(w, a);
    const _sl = HEALTH.sleepMult; HEALTH.sleepMult = (w, a) => _sl(w, a) * CALAMITY.sleepMult(w, a);
}
// 疫苗研究期間,研究員的研究點都拿去研究疫苗(平常的研究暫停)
if (typeof ResearchManager !== 'undefined') {
    const RM = ResearchManager.prototype; const _du = RM.dailyUpdate;
    RM.dailyUpdate = function (world) { const V = world?.calamity?.cur?.vax; if (V && !V.done) return; const r = _du.call(this, world); try { CALAMITY.rediscover(world); } catch (e) {} return r; };
}
// 文明倒退:靠失傳科技開的建築停擺,效果先不算
if (typeof BuildingManager !== 'undefined') {
    const BM = BuildingManager.prototype; const _rc = BM.recomputeEffects;
    BM.recomputeEffects = function (world) { const L = world?.calamity?.lost; if (!L || !Object.keys(L).length) return _rc.call(this, world); const all = this.completed; this.completed = (all || []).filter(b => !CALAMITY.dormantB(world, b)); try { return _rc.call(this, world); } finally { this.completed = all; } };
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
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { cal_fear: '怕被傳染', cal_family: '家人正在生病', cal_business: '生意會做不下去', cal_freedom: '不想被管', faith: '信仰的關係', cal_lesson: '上次的疫情還記得', cal_tired: '關太久了，撐不下去', cal_calm: '上次也沒怎樣' });
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
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.calamity) { const C = this.calamity; d.calamity = { power: C.power, pDay: C.pDay ?? null, hist: C.hist, st: C.st, coolTo: C.coolTo || 0, cur: C.cur || null, lost: C.lost || {}, regs: C.regs || [], redisc: C.redisc || 0, burned: C.burned || [], sold: C.sold || [] }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.calamity = (data?.calamity && typeof data.calamity === 'object') ? data.calamity : null; if (this.calamity?.lost && Object.keys(this.calamity.lost).length) this.buildings?.recomputeEffects?.(this); } } catch (e) {} return r; };
}
if (typeof window !== 'undefined') window.CALAMITY = CALAMITY;
