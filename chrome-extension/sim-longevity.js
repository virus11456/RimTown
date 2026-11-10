// v8.7.0 長生:兩條路線、兩種方向
// ⚙️ 蒸汽煉金(科技＋信仰)——賢者之石凝聚以太:
//   - 研究以太引擎以後,礦工才挖得到以太礦(礦工越多挖越多)
//   - 過生活要吃大量以太:療傷、驅動神奇造物(發條人偶、以太引擎、人造人、飛艇碼頭、浮空城區);供得夠,鎮上建造研究文化商隊都加成、大家心情好
//   - 研究賢者之石(還要煉金工坊、兩個研究員)以後,可以把以太存起來煉一顆:要 300 份,最後一步一半機會碎掉
//   - 存還是用,村民自己投票:信徒、想長生的老人、研究員想存;年輕家庭、工人、開店的、家裡有病人的想先過生活;日子苦了就會改回來
//   - 煉成的「完整的賢者之石」:戴在身上的那一個人老得很慢(能量滿時四年老一歲,傷病很快痊癒,沒有副作用);石頭會慢慢沒力,要用以太補;拿來點石成鋼會耗掉它的能量;給誰由國王、教團、有錢人、村民爭
//   - 石頭一離身(被偷、被奪、交給別人),原本的持有人立刻恢復正常:歲月一下子追上來,真實年紀太大的人會當場化為塵土
//   - 覬覦的人會去偷;有守衛小偷比較容易被抓;活累了的持有人會把石頭交給心愛的人,然後安靜地走
//   - 信徒把以太當成神聖的氣息,長生的人被尊為「天選之人」
// 🧬 基因生物(另一條進化路)——延壽療程:
//   - 研究延壽療法以後,人人都能花一點錢做療程(付給醫生),老死晚十五年;虔誠、謹慎的人多半拒絕
//   - 代價:有人基因失調(慢性病)、生育力下降、長輩不退位讓年輕人怨氣
// 不動銀幣(銀幣守恆):療程費、買賢者之石的錢都是村民→醫生/公庫的轉帳。存在 world.longev。
// 必須在 sim-steam.js、sim-health.js、sim-faith.js、sim-tech.js、sim-market.js 之後載入。
'use strict';

const LONGEV = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k || (typeof BUILDING_TEMPLATES !== 'undefined' && b.name === BUILDING_TEMPLATES[k]?.name));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who || ''); } catch (e) {} };
    const news = (w, k, p, imp, nm) => { try { w.dailyNews?.collectEvent?.('event', fill(k, p), imp || 8, nm || []); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp, []); } catch (e) {} };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const pious = (w, a, n) => { try { if (typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a)) FAITH.bumpP(w, a, n); } catch (e) {} };
    const cash = (w, a) => { try { return typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0; } catch (e) { return 0; } };
    const face = (w, a) => { try { return typeof WAYS !== 'undefined' ? (WAYS.faceOf(w, a) || 50) : 50; } catch (e) { return 50; } };
    const tech = () => (typeof TECH !== 'undefined' ? TECH : null);
    const AE_CAP = 120, GREAT = 300, FEE = 20;
    const WONDERS = [['clockwork_automaton', 'r', '發條人偶'], ['aether_engine', 'r', '以太引擎'], ['homunculus', 'r', '人造人'], ['airship_dock', 'b', '飛艇碼頭'], ['sky_isle', 'b', '浮空城區']];

    function S(w) {
        if (!w.longev || typeof w.longev !== 'object') w.longev = {};
        const L = w.longev; L.ae = L.ae || 0; L.gw = L.gw || 0; L.held = L.held || null; L.past = L.past || []; L.gene = L.gene || {}; L.prio = (L.prio === 'stone') ? 'stone' : 'life'; L.tried = L.tried || [];
        L.st = L.st || { made: 0, fail: 0, boom: 0, heal: 0, stones: 0, given: 0, treated: 0, disorder: 0, blocked: 0, gripe: 0, refused: 0, stolen: 0, caught: 0, dust: 0, passed: 0 };
        return L;
    }
    const isImm = (w, a) => !!a && w.longev?.held?.id === a.agentId;
    const isGene = (w, a) => !!a && !!w.longev?.gene?.[a.agentId];
    // 老死看的年紀:延壽療程晚十五年;長生的人不會老死
    function ageEff(w, a) { return (a.age ?? 30) - (isGene(w, a) ? 15 : 0); } // 戴著賢者之石的人外表年紀本來就長得慢(見 immDaily)
    const wondersOf = (w) => WONDERS.filter(([k, kind]) => kind === 'r' ? (done(w, k) && !(k === 'homunculus' && w.tech?.steam?.homunban)) : built(w, k));
    const researchers = (w) => adults(w).filter(a => a.job?.key === 'researcher');
    const patients = (w) => { if (typeof HEALTH === 'undefined' || !w.health) return []; return adults(w).filter(a => !isImm(w, a) && HEALTH.ails(w, a).some(x => x.s >= 2)); };

    // ---------- ⚙️ 挖以太礦(研究以太引擎以後,礦工才挖得到) ----------
    function mine(w, L) {
        if (!done(w, 'aether_engine')) return; const ms = adults(w).filter(a => a.job?.key === 'miner');
        const prod = 0.5 + 0.35 * Math.min(6, ms.length); L.ae = Math.min(AE_CAP, Math.round((L.ae + prod) * 100) / 100); L.st.made = Math.round(((L.st.made || 0) + prod) * 10) / 10;
        if (!L.first) { L.first = 1; log(w, '✨ 礦工在礦坑深處挖到一條發著淡藍色光的礦脈——是以太礦。信徒說那是神的氣息。'); for (const a of adults(w)) if (devout(w, a)) { pious(w, a, 3); if (Math.random() < 0.3) mem(w, a, '礦坑裡挖出了以太，那一定是神的氣息。', {}, 6); } }
        // 以太礦坑偶爾出事
        if (ms.length && Math.random() < 0.006) { const r = ms[Math.floor(Math.random() * ms.length)]; L.st.boom++; log(w, '💥 以太礦坑冒出一陣藍光，{a}被震倒在地，頭髮豎了一整天。', { a: r.name }, r.name); try { if (typeof HEALTH !== 'undefined' && w.health) HEALTH.addAil(w, r, { p: 'h', k: 'injury', s: 1, dmg: 4 }, '以太礦坑'); } catch (e) {} }
    }
    // 以太的用途:過生活(造物、療傷)還是存起來煉賢者之石——村民投票決定(L.prio: life / stone)
    function useAether(w, L, d) {
        const ws = wondersOf(w); const need = ws.length * 0.8; const pats = patients(w); const saving = L.prio === 'stone' && canStone(w);
        // 療傷:兩份以太治好一個(存石頭的時候只救重的)
        if (L.ae >= 2 && pats.length && (!saving || pats.some(a => HEALTH.ails(w, a).some(x => x.s >= 3)))) {
            const a = pats.sort((x, y) => Math.max(...HEALTH.ails(w, y).map(z => z.s)) - Math.max(...HEALTH.ails(w, x).map(z => z.s)))[0];
            const H = HEALTH.S(w); const list = H.a[a.agentId] || []; if (list.length) { list.sort((p, q) => q.s - p.s); const x = list.shift(); try { HEALTH.hurt(w, a, x.p, -15); } catch (e) {}
                L.ae -= 2; L.st.heal++; a.moodModifier = (a.moodModifier || 0) + 4; if (Math.random() < 0.4) log(w, '✨ 研究員把一滴以太點在{a}的傷口上，一個晚上就好了，連疤都沒留。', { a: a.name }, a.name);
                mem(w, a, '一滴以太就把我治好了，一點後遺症都沒有。', {}, 7); if (devout(w, a)) pious(w, a, 4); }
        }
        // 造物:過生活就盡量供;存石頭的時候只供一半
        const was = L.pw || 0; let give = need ? Math.min(L.ae, saving ? need * 0.5 : need) : 0; L.ae = Math.round((L.ae - give) * 100) / 100; L.pw = need ? Math.round(give / need * 100) / 100 : 0;
        L.powered = L.pw >= 0.6; if ((was >= 0.6) !== L.powered) { try { w.buildings?.recomputeEffects?.(w); } catch (e) {} if (!L.powered && was) log(w, '⚙️ 以太不夠用了：發條人偶停在半路、浮空城區慢慢往下沉，大家這才發現以前有多方便。'); else if (L.powered) log(w, '✨ 以太灌進了鎮上的造物：發條人偶夜裡也在做事，浮空城區又升高了一點。'); }
        if (need && d % 5 === 0) { const all = adults(w); if (L.pw >= 0.9) for (const a of all) a.moodModifier = (a.moodModifier || 0) + 1; else if (L.pw < 0.4 && (L.wasGood || 0) > 0) for (const a of all) if (Math.random() < 0.5) a.moodModifier = (a.moodModifier || 0) - 1; L.wasGood = L.pw >= 0.9 ? 1 : (L.wasGood || 0); }
        // 存進賢者之石:存石頭時剩下的全存;過生活時只有多到快滿才存一點
        if (canStone(w) && !L.ready && !L.held) {
            const put = saving ? L.ae : Math.max(0, L.ae - AE_CAP * 0.8) * 0.5; if (put > 0) { L.ae = Math.round((L.ae - put) * 100) / 100; L.gw = Math.round((L.gw + put) * 100) / 100; }
            if (L.gw >= GREAT) {
                if (Math.random() < 0.5) { L.gw = Math.round(GREAT * 0.4); L.st.shatter = (L.st.shatter || 0) + 1; const r = researchers(w)[0]; log(w, '💔 賢者之石凝到最後一刻，「喀」一聲裂成了碎片。{a}蹲在地上撿了一整夜，只救回一小半。', { a: r?.name || t('研究員') }, r?.name); if (r) mem(w, r, '存了好久的以太，最後一刻碎了。', {}, 9); for (const a of adults(w)) if (Math.random() < 0.2) mem(w, a, '大家省吃儉用存的以太，賢者之石最後還是碎了。', {}, 6); }
                else { L.gw = 0; L.ready = d; L.st.stones++; log(w, '💎 研究員把存了好久的以太凝成一顆完整的賢者之石。戴著它的人會老得很慢——但只有一個人能戴。全鎮都在問：給誰？'); news(w, '💎 鎮上煉成了一顆完整的賢者之石', {}, 10, []); }
            }
        }
        if (canStone(w) && Math.random() < 0.06) usePropose(w, L, pats, need);
    }
    const canStone = (w) => done(w, 'philosopher_stone') && built(w, 'alchemy_lab') && researchers(w).length >= 2;
    // 存還是用:兩派輪流提案
    function usePropose(w, L, pats, need) {
        const T = tech(); if (!T || T.busy(w, 'ae_use') || L.held || L.ready) return; const all = adults(w);
        const toStone = L.prio !== 'stone';
        if (toStone && L.lastUse && day(w) - L.lastUse < 40) return;
        if (!toStone && !(L.pw < 0.5 || pats.length >= 2 || Math.random() < 0.15)) return; // 日子苦了才會有人喊改回來
        const who = toStone ? (all.filter(a => devout(w, a) || (a.age ?? 30) >= 55 || a.job?.key === 'researcher').sort((x, y) => (y.age || 0) - (x.age || 0))[0]) : (all.find(a => a.job?.key === 'doctor' && pats.length) || all.filter(a => (a.age ?? 30) <= 40 && (has(a, 'hardworking') || a.job?.key === 'miner' || (() => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } })()))[0]);
        if (!who) return; L.lastUse = day(w);
        T.propose(w, 'ae_use', 'longev', who, toStone ? '以太存起來煉賢者之石' : '以太先拿來過生活', toStone ? '{who}說以太是神的氣息，不該全燒在機器上：提議大家省著點用，把以太存起來煉一顆賢者之石（已經存了 {p}%）。造物會只剩一半力氣。' : '{who}說造物停擺、病人等著治，日子都快過不下去了：提議以太先拿來過生活，賢者之石以後再說（已經存了 {p}%）。', { p: Math.round(L.gw / GREAT * 100) }, 'welfare', {}, { aeTo: toStone ? 'stone' : 'life' });
    }

    // ---------- 💎 完整的賢者之石:給誰 ----------
    function grantFlow(w, L, d) {
        if (!L.ready || L.held) return; const T = tech(); const all = adults(w).filter(a => !isImm(w, a)); if (!all.length || !T) return;
        // 已經有人在等表決
        if ((w.proposals?.items || []).some(p => p.kind === 'ae_grant' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        for (const p of (w.proposals?.items || [])) if (p.kind === 'ae_grant' && !p._lgNoted && ['rejected', 'vetoed', 'failed'].includes(p.status)) { p._lgNoted = 1; L.tried.push(p.aeWho); }
        if (d - (L.lastTry || -99) < 7) return; L.lastTry = d;
        // 國王直接要走
        const C = w.crown; const king = C?.king ? w.agents[C.king] : null;
        if (king && !king.isDead && !isImm(w, king) && !L.tried.includes(king.agentId) && Math.random() < 0.6) {
            log(w, '👑 國王{a}派人把賢者之石收進王宮：「這是王室的東西。」鎮上一片譁然。', { a: king.name }, king.name);
            try { C.legit = Math.max(0, (C.legit || 60) - 12); } catch (e) {}
            for (const a of all) if (a !== king && Math.random() < 0.3) { bump(a, king, -8); mem(w, a, '國王把全鎮的賢者之石據為己有。', {}, 6); }
            return give(w, L, king, 'king');
        }
        if (L.tried.length >= 3) { // 吵了三輪都沒結果:煉出它的研究員自己吞了
            const r = researchers(w).filter(a => !isImm(w, a)).sort((x, y) => (y.skills?.get?.('智識')?.level || 0) - (x.skills?.get?.('智識')?.level || 0) /* v9.10.1 以前寫成不存在的「研究」,等於隨便挑 */)[0] || all[0];
            log(w, '🤫 大家為了賢者之石吵了好幾個禮拜。某天早上，石頭不見了——{a}的白頭髮一夜之間全黑了。', { a: r.name }, r.name);
            for (const a of all) if (a !== r && Math.random() < 0.4) { bump(a, r, -15); mem(w, a, '{a}偷偷把全鎮的賢者之石吞了。', { a: r.name }, 7); }
            try { WAYS?.loseFace?.(w, r, 20); } catch (e) {}
            return give(w, L, r, 'stolen');
        }
        // 候選人:最受敬重的長輩、教團的神職、出得起錢的有錢人、做出它的研究員
        const pool = all.filter(a => !L.tried.includes(a.agentId));
        const elder = pool.filter(a => (a.age ?? 30) >= 55).sort((x, y) => face(w, y) + (y.age || 0) - face(w, x) - (x.age || 0))[0];
        const priest = pool.find(a => a.job?.key === 'priest' && devout(w, a));
        const rich = pool.filter(a => cash(w, a) >= 250).sort((x, y) => cash(w, y) - cash(w, x))[0];
        const res = pool.filter(a => a.job?.key === 'researcher').sort((x, y) => face(w, y) - face(w, x))[0];
        const opts = [elder && ['elder', elder], priest && ['priest', priest], rich && ['rich', rich], res && ['res', res]].filter(Boolean); if (!opts.length) return;
        const [why, c] = opts[Math.floor(Math.random() * opts.length)];
        const who = why === 'rich' ? c : (why === 'priest' ? c : (all.filter(a => a !== c && aff(a, c) >= 30).sort((x, y) => aff(y, c) - aff(x, c))[0] || c));
        const D = { elder: '{who}提議把賢者之石給{c}：{c}在鎮上活了一輩子、受人敬重，該讓這樣的人多留些年。', priest: '{who}說以太是神的氣息，賢者之石該交給神職{c}，讓神的話一直有人傳下去。', rich: '{who}說願意拿出 250 銀幣給公庫，換這顆賢者之石。公庫可以拿這筆錢修路、蓋學堂。', res: '{who}提議把賢者之石給{c}：沒有研究員熬夜煉，根本不會有這顆石頭。' };
        T.propose(w, 'ae_grant', 'longev', who, '賢者之石給{c}', D[why], { c: c.name }, 'culture', { c: c.name }, { aeWho: c.agentId, aeWhy: why });
    }
    function give(w, L, a, why) {
        if (L.held && L.held.id !== a.agentId) { const o = w.agents[L.held.id]; if (o && !o.isDead) lose(w, L, o, why === 'stolen' ? 'stolen' : 'taken'); }
        L.ready = null; L.gw = 0; L.held = { id: a.agentId, d0: day(w), age0: a.age ?? 30, vis: a.age ?? 30, real: a.age ?? 30, charge: 100 }; L.st.given++; L.tried = [];
        try { if (typeof HEALTH !== 'undefined' && w.health) { const H = HEALTH.S(w); H.a[a.agentId] = []; for (const p of HEALTH.PARTS) HEALTH.setPart?.(w, a, p, 100); } } catch (e) {}
        a.moodModifier = (a.moodModifier || 0) + 10;
        if (why === 'stolen') return true; // 偷的人不聲張
        log(w, '💎 {a}握住了賢者之石。光從指縫裡透出來，皺紋淡了一些——只要石頭還在身上，{a}就會老得很慢很慢。', { a: a.name }, a.name);
        news(w, '💎 {a}得到了賢者之石，從此老得很慢', { a: a.name }, 10, [a.name]);
        mem(w, a, '我拿到了賢者之石。只要它在我身上，歲月就拿我沒辦法。', {}, 10);
        for (const o of adults(w)) { if (o === a) continue; if (devout(w, o)) { pious(w, o, 5); if (Math.random() < 0.4) mem(w, o, '{a}是天選之人，神讓他留在我們身邊。', { a: a.name }, 7); } else if (has(o, 'jealous') || ((o.age ?? 30) >= 60 && Math.random() < 0.4)) { bump(o, a, -8); mem(w, o, '憑什麼是{a}可以不老，不是我？', { a: a.name }, 6); } }
        return true;
    }
    // 石頭離身:歲月一下子追上來
    function lose(w, L, a, why) {
        const H = L.held; if (!H || H.id !== a.agentId) return; L.held = null; const real = Math.floor(H.real ?? (H.age0 + (H.extra || 0))); const gap = Math.max(0, real - (a.age ?? real)); H.extra = gap; L.past.push({ id: a.agentId, name: a.name, years: gap, why }); L.past = L.past.slice(-6);
        a.age = real;
        if (real >= 85 || (real >= 75 && Math.random() < 0.5)) {
            L.st.dust++; log(w, '⏳ 賢者之石一離開{a}的身體，{n} 年的歲月一下子追了上來。{a}的頭髮瞬間全白，還來不及說話就化成了一捧灰。', { a: a.name, n: Math.round(H.extra || 0) }, a.name);
            news(w, '⏳ 賢者之石離身，{a}化為塵土', { a: a.name }, 10, [a.name]);
            a._deathCause = t('賢者之石離身，歲月一下子追上來'); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {}
        } else if ((H.extra || 0) >= 1) {
            log(w, '⏳ 賢者之石離開了{a}，{a}一夜之間老了 {n} 歲。', { a: a.name, n: Math.round(H.extra || 0) }, a.name); a.moodModifier = (a.moodModifier || 0) - 10;
            mem(w, a, '石頭不在了，一照鏡子，我老了 {n} 歲。', { n: Math.round(H.extra || 0) }, 9);
        }
    }
    function enact(w, p) {
        const L = S(w);
        if (p.kind === 'ae_use') { L.prio = p.aeTo === 'stone' ? 'stone' : 'life'; log(w, L.prio === 'stone' ? '💎 全鎮決定把以太省下來煉賢者之石。造物只剩一半力氣，大家咬著牙過日子。' : '⚙️ 全鎮決定以太先拿來過生活，賢者之石以後再說。'); return t(L.prio === 'stone' ? '以太開始存起來煉賢者之石' : '以太先拿來過生活'); }
        if (p.kind === 'ae_grant') {
            const a = w.agents[p.aeWho]; if (!a || a.isDead || !L.ready) return '';
            if (p.aeWhy === 'rich') { if (!(typeof WALLET !== 'undefined' && WALLET.take(w, a, 250))) return ''; w.stockpile?.add?.('silver', 250, w.tickCount, t('賣賢者之石')); for (const o of adults(w)) if (o !== a && cash(w, o) < 20 && Math.random() < 0.4) { bump(o, a, -10); mem(w, o, '有錢就能買長生，窮人只能老死。', {}, 7); } }
            give(w, L, a, p.aeWhy); return fill('{a}得到了賢者之石', { a: a.name });
        }
        return '';
    }
    function vote(w, p, a) {
        const L = S(w); let s = 0, why = 'gut';
        if (p.kind === 'ae_use') {
            const sickFam = patients(w).some(x => x === a || aff(a, x) >= 40); const boss = (() => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } })();
            const old = (a.age ?? 30) >= 55; const young = (a.age ?? 30) <= 35;
            const stoneSide = (devout(w, a) ? 1.6 : 0) + (old ? 1.4 : 0) + (a.job?.key === 'researcher' ? 1 : 0) + (has(a, 'ambitious') || has(a, 'greedy') ? 0.6 : 0) + (L.gw >= GREAT * 0.7 ? 0.8 : 0);
            const lifeSide = (sickFam ? 1.6 : 0) + (boss ? 1.2 : 0) + (young ? 0.8 : 0) + (a.job?.key === 'miner' ? 0.6 : 0) + ((a.mood ?? 60) < 40 ? 0.8 : 0) + (L.pw < 0.5 ? 0.8 : 0);
            s = (p.aeTo === 'stone' ? 1 : -1) * (stoneSide - lifeSide);
            why = (p.aeTo === 'stone') === (s > 0) ? (devout(w, a) ? 'ae_holy' : old ? 'ae_long' : 'ae_stone') : (sickFam ? 'ae_sick' : boss ? 'ae_wonder' : 'ae_life');
        } else if (p.kind === 'ae_grant') {
            const c = w.agents[p.aeWho]; if (!c) return { v: 'against', why: 'gut' };
            const close = aff(a, c); const dv = devout(w, a);
            s = 0.2 + close / 25 + (p.aeWhy === 'priest' && dv ? 2 : 0) + (p.aeWhy === 'elder' ? 0.6 : 0) + (p.aeWhy === 'rich' ? (w.stockpile?.get?.('silver') < 150 ? 0.8 : 0) - (cash(w, a) < 30 ? 1.5 : 0) : 0) + (p.aeWhy === 'res' && a.job?.key === 'researcher' ? 1.5 : 0)
                - (has(a, 'jealous') ? 1.2 : 0) - ((a.age ?? 30) >= 60 && a !== c ? 0.6 : 0) + (a === c ? 5 : 0);
            why = s > 0 ? (close >= 30 ? 'relgood' : dv && p.aeWhy === 'priest' ? 'ae_holy' : 'ae_fair') : (close <= -20 ? 'relbad' : p.aeWhy === 'rich' ? 'ae_money' : 'ae_envy');
        }
        s += Math.random() - 0.5; return { v: s > 0 ? 'for' : 'against', why };
    }
    // 持有人:外表不再老(真實年紀照算)、傷病很快痊癒;會被偷;活累了會交出去
    function immDaily(w, L, d) {
        const H = L.held; if (!H) return; const a = w.agents[H.id];
        if (!a || a.isDead) { if (a?.isDead || !w.isAway?.(H.id)) { L.held = null; if (a?.isDead || !a) { if (a?.isDead) { L.ready = d; L.tried = []; log(w, '💎 {a}走了，賢者之石從他身上滾了下來。全鎮又要決定給誰。', { a: a.name }, a.name); } else log(w, '💎 握著賢者之石的人離開了小鎮，石頭也跟著走了。'); } } return; }
        // 戴著石頭老得很慢:能量滿時四年才老一歲,能量越少老得越快;真實年紀另外記著
        if (H.vis == null) { H.vis = a.age ?? 30; H.real = (H.age0 ?? H.vis) + (H.extra || 0); H.charge = H.charge ?? 100; }
        const shown = Math.floor(H.vis); if ((a.age ?? 30) > shown) { const dy = a.age - shown; const rate = 1 - 0.75 * (H.charge / 100); H.real += dy; H.vis += dy * rate; a.age = Math.floor(H.vis); }
        H.extra = Math.round((H.real - H.vis) * 10) / 10;
        // 石頭的能量:每天慢慢流失,用鎮上的以太補(過生活的時候只有以太多才補)
        H.charge = Math.max(0, H.charge - 0.15);
        if (H.charge <= 98 && L.ae >= 1 && (L.prio === 'stone' || L.ae > 20)) { L.ae -= 1; H.charge = Math.min(100, H.charge + 2); }
        // 點石成鋼:鎮上缺鋼,鎮長來拜託;大方的持有人會答應,但石頭的能量會掉
        const steel = w.stockpile?.get?.('steel') || 0;
        if (steel < 5 && H.charge >= 20 && d % 7 === 3 && Math.random() < 0.5) {
            const mayor = adults(w).find(o => o.job?.key === 'mayor' && o !== a); const yes = has(a, 'kind') || has(a, 'generous') || (mayor && aff(a, mayor) >= 20) || Math.random() < 0.25;
            if (yes) { w.stockpile.add('steel', 3, w.tickCount, t('賢者之石點石成鋼')); H.charge = Math.max(0, H.charge - 10); L.st.steel = (L.st.steel || 0) + 3; log(w, '⚗️ 鎮上缺鋼，{a}把賢者之石按在一堆石頭上，石頭變成了閃亮的鋼——石頭的光也暗了一點。', { a: a.name }, a.name); mem(w, a, '幫鎮上點石成鋼，石頭的光又暗了一點，我大概會老得快一些。', {}, 6); }
            else if (Math.random() < 0.5) { log(w, '🙅 鎮上缺鋼，{a}捨不得用賢者之石點石成鋼：「它的光是我的命。」', { a: a.name }, a.name); for (const o of adults(w)) if (o !== a && Math.random() < 0.2) bump(o, a, -4); }
        }
        // 覬覦的人去偷
        const thief = adults(w).filter(o => o !== a && (has(o, 'greedy') || has(o, 'jealous') || !!o.dark?.liar) && aff(o, a) < 10).sort(() => Math.random() - 0.5)[0];
        if (thief && Math.random() < 0.006) {
            L.st.stolen++; L.theft = { thief: thief.agentId, from: a.agentId, d }; const victim = a;
            log(w, '🦹 半夜裡有人摸進{a}的房間，賢者之石不見了。', { a: victim.name }, victim.name);
            give(w, L, thief, 'stolen'); mem(w, thief, '我偷了{a}的賢者之石。只要不被發現……', { a: victim.name }, 9);
            return;
        }
        // 活累了:真的老了很多年,把石頭交給心愛的人
        const real = H.real;
        if ((H.extra || 0) >= 8 && real >= 80 && Math.random() < 0.004) {
            const heir = (typeof MARKET !== 'undefined' ? MARKET.heirsOf(w, a) : []).find(o => !o.isDead) || adults(w).filter(o => o !== a).sort((x, y) => aff(a, y) - aff(a, x))[0];
            if (heir) { L.st.passed++; log(w, '🕯️ {a}說：「我活得夠久了。」把賢者之石放進{b}的手心，閉上了眼睛。', { a: a.name, b: heir.name }, a.name); mem(w, heir, '{a}把賢者之石交給了我，然後安靜地走了。', { a: a.name }, 10); give(w, L, heir, 'passed'); return; }
        }
    }
    // 竊案:幾天後小偷可能被抓(有守衛比較容易),石頭還給原主(原主不在了就重新決定給誰)
    function theftDaily(w, L, d) {
        const T = L.theft; if (!T || d - T.d < 3) return; if (d - T.d > 12) { L.theft = null; return; }
        if (Math.random() > 0.2) return;
        const guards = adults(w).filter(a => a.job?.key === 'guard').length; const thief = w.agents[T.thief];
        if (!thief || thief.isDead) { L.theft = null; return; }
        if (Math.random() < 0.4 + Math.min(0.4, guards * 0.15)) {
            L.st.caught++; L.theft = null; const owner = w.agents[T.from];
            log(w, '🚨 守衛在{a}的枕頭底下找到了賢者之石。全鎮的人都跑來看小偷長什麼樣子。', { a: thief.name }, thief.name);
            news(w, '🚨 偷賢者之石的竟然是{a}', { a: thief.name }, 9, [thief.name]);
            try { WAYS?.loseFace?.(w, thief, 25); } catch (e) {} for (const o of adults(w)) if (o !== thief && Math.random() < 0.4) bump(o, thief, -15);
            if (owner && !owner.isDead) { give(w, L, owner, 'returned'); log(w, '💎 賢者之石回到了{a}手上。', { a: owner.name }, owner.name); }
            else { lose(w, L, thief, 'caught'); L.ready = d; L.tried = []; }
        }
    }

    // ---------- 🧬 延壽療程 ----------
    function geneWeekly(w, L, d) {
        if (!done(w, 'life_extension')) return;
        // 舊存檔:研究完延壽療法的小鎮,最有錢的三分之一成年人當作已經做過
        if (!L.v87) { L.v87 = 1; const rich = adults(w).filter(a => (a.age ?? 30) >= 30).sort((x, y) => cash(w, y) - cash(w, x)); for (const a of rich.slice(0, Math.ceil(rich.length / 3))) L.gene[a.agentId] = d; }
        const doc = adults(w).filter(a => a.job?.key === 'doctor')[0] || null; const all = adults(w).filter(a => (a.age ?? 30) >= 30 && !L.gene[a.agentId] && !isImm(w, a));
        let n = 0; const max = Math.max(2, Math.ceil(adults(w).length * 0.15));
        for (const a of all.sort(() => Math.random() - 0.5)) {
            if (n >= max) break; let p = 0.25 * ((a.age ?? 30) >= 50 ? 1.5 : 1) * (has(a, 'neurotic') || has(a, 'pessimist') ? 0.5 : 1) * (has(a, 'optimist') ? 1.4 : 1) * (a.techStance === 'progressive' ? 1.4 : a.techStance === 'conservative' ? 0.5 : 1);
            if (devout(w, a)) { if (Math.random() < 0.15) { L.st.refused++; if (Math.random() < 0.3) mem(w, a, '改寫自己的身體活得更久？那是違背天命。', {}, 5); } continue; }
            if (Math.random() >= p || cash(w, a) < FEE + 5) continue;
            if (!(typeof WALLET !== 'undefined' && WALLET.take(w, a, FEE))) continue;
            if (doc && doc !== a) WALLET.add(w, doc, FEE); else w.stockpile?.add?.('silver', FEE, w.tickCount, t('延壽療程'));
            L.gene[a.agentId] = d; L.st.treated++; n++;
            mem(w, a, '我做了延壽療程，醫生說我可以多活十幾年——只是會有一些副作用。', {}, 6);
        }
        if (n >= 3) log(w, '🧬 這週又有 {n} 個人去做了延壽療程，診所門口排起了隊。', { n });
        // 長輩做了延壽、一直不退位:年輕人怨氣
        const oldHold = adults(w).filter(a => L.gene[a.agentId] && (a.age ?? 30) >= 70 && (['mayor', 'priest'].includes(a.job?.key) || (() => { try { return typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } })()));
        if (oldHold.length >= 1) { const young = adults(w).filter(a => (a.age ?? 30) >= 20 && (a.age ?? 30) <= 35).sort(() => Math.random() - 0.5).slice(0, 2); for (const y of young) { y.moodModifier = (y.moodModifier || 0) - 1; if (Math.random() < 0.5) mem(w, y, '{o}做了延壽，七十幾歲還占著位子不放，我們年輕人哪有機會？', { o: oldHold[0].name }, 5); bump(y, oldHold[0], -2); } L.st.gripe++; }
    }
    // 基因失調:做過療程的人,每年約六%出問題
    function geneDaily(w, L) {
        if (typeof HEALTH === 'undefined' || !w.health) return;
        for (const id of Object.keys(L.gene)) {
            const a = w.agents[id]; if (!a) { if (!w.isAway?.(id)) delete L.gene[id]; continue; } if (a.isDead) { delete L.gene[id]; continue; }
            if (Math.random() < 0.06 / 365 * 6) { // 一年約 6%(每天檢查;乘 6 是因為很多人不到一年就過世或搬走,讓代價看得到)
                const p = HEALTH.PARTS[Math.floor(Math.random() * HEALTH.PARTS.length)]; L.st.disorder++;
                try { HEALTH.addAil(w, a, { p, k: 'disease', s: 2, dmg: 12 }, '基因失調'); } catch (e) {}
                mem(w, a, '延壽療程的副作用找上門了，醫生說是基因失調。', {}, 7);
                if (Math.random() < 0.3) log(w, '🧬 {a}做過延壽療程，最近出現了基因失調的毛病。', { a: a.name }, a.name);
            }
        }
    }

    function daily(w) {
        if (!w?.observerMode) return; const L = S(w); const d = day(w); if (L.lastDay === d) return; L.lastDay = d;
        try { mine(w, L); useAether(w, L, d); grantFlow(w, L, d); immDaily(w, L, d); theftDaily(w, L, d); } catch (e) { console.warn('[Longev] aether', e); }
        try { geneDaily(w, L); if (d % 7 === 0) geneWeekly(w, L, d); } catch (e) { console.warn('[Longev] gene', e); }
    }

    // ---------- 給畫面與 AI ----------
    function view(w) {
        const L = S(w); const ws = wondersOf(w);
        return { mine: done(w, 'aether_engine'), stone: done(w, 'philosopher_stone'), canStone: canStone(w), lab: built(w, 'alchemy_lab'), ae: Math.floor(L.ae), cap: AE_CAP, gw: Math.round(L.gw / GREAT * 100), ready: !!L.ready, prio: L.prio, powered: !!L.powered, pw: Math.round((L.pw || 0) * 100), wonders: ws.map(x => t(x[2])), need: ws.length,
            holder: L.held ? t(w.agents[L.held.id]?.name || '') : '', heldYears: L.held ? Math.round(L.held.extra || 0) : 0, charge: L.held ? Math.round(L.held.charge ?? 100) : 0, past: L.past.map(x => ({ name: t(x.name), years: x.years, why: x.why })), gene: done(w, 'life_extension'), treated: Object.keys(L.gene).filter(id => w.agents[id]).length, st: L.st };
    }
    function brief(w, a) {
        const L = w.longev; if (!L) return ''; const out = [];
        if (isImm(w, a)) out.push(fill('你身上戴著賢者之石，老得很慢（石頭的能量還有 {c}%，其實你已經 {r} 歲）；石頭一離身，歲月會一下子追上來。', { c: Math.round(L.held.charge ?? 100), r: Math.floor(L.held.real ?? a.age) }));
        if (isGene(w, a)) out.push(t('你做過基因延壽療程，可以多活十幾年，但擔心副作用。'));
        return out.join(' ');
    }
    function townBrief(w) {
        const L = w.longev; if (!L) return ''; const out = [];
        if (done(w, 'aether_engine')) out.push(fill('礦坑挖出的以太還有 {n} 份', { n: Math.floor(L.ae) }) + (L.prio === 'stone' ? t('，大家省著用、想存起來煉賢者之石') : '') + (L.ready ? t('，還有一顆完整的賢者之石不知道該給誰') : ''));
        if (L.held && w.agents[L.held.id]) out.push(fill('{a}身上戴著賢者之石，老得很慢', { a: w.agents[L.held.id].name }));
        const n = Object.keys(L.gene || {}).length; if (n) out.push(fill('{n} 個人做過延壽療程', { n }));
        return out.join(t('，'));
    }
    return { S, AE_CAP, GREAT, FEE, WONDERS, isImm, isGene, ageEff, wondersOf, mine, useAether, canStone, usePropose, grantFlow, give, enact, vote, immDaily, theftDaily, lose, geneWeekly, geneDaily, daily, view, brief, townBrief, patients };
})();

// 老死:延壽療程晚十五年;長生的人不會老死(災難、意外照樣會死)
// (sim-society.js 的 _checkDeaths 會問 LONGEV.ageEff;長生的人在那裡直接跳過)
// 以太驅動造物:建造、研究、文化、商隊加成
if (typeof BuildingManager !== 'undefined') {
    const BM = BuildingManager.prototype; const _re = BM.recomputeEffects;
    BM.recomputeEffects = function (world, ...rest) {
        const r = _re.call(this, world, ...rest);
        try { if (world?.longev?.powered && this.activeEffects) { const E = this.activeEffects; const add = (k, v, base) => { E[k] = (E[k] ?? base) + v; }; add('build_speed', 0.1, 1); add('research_bonus', 0.05, 0); add('culture_bonus', 5, 0); add('merchant_frequency', 0.1, 1); } } catch (e) {}
        return r;
    };
}
// 延壽療程的代價:做過的人生育力下降
if (typeof LifecycleSystem !== 'undefined' && LifecycleSystem.prototype._birthChild) {
    const _bc = LifecycleSystem.prototype._birthChild;
    LifecycleSystem.prototype._birthChild = function (world, pa, pb, ...rest) {
        try { const G = world?.longev?.gene; if (G && (G[pa?.agentId] || G[pb?.agentId]) && Math.random() < 0.4) { world.longev.st.blocked = (world.longev.st.blocked || 0) + 1; return null; } } catch (e) {}
        return _bc.call(this, world, pa, pb, ...rest);
    };
}
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { ae_use: { icon: '✨', label: '以太存還是用' }, ae_grant: { icon: '💎', label: '賢者之石給誰' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { ae_sick: '病人等不了', ae_wonder: '造物停了整個鎮都慢下來', ae_life: '日子要先過下去', ae_long: '想活久一點', ae_stone: '想看到賢者之石煉成', ae_holy: '以太是神的氣息', ae_fair: '覺得給這個人公平', ae_money: '有錢就能買長生太不公平', ae_envy: '憑什麼是他' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) LONGEV.daily(w); } catch (e) { console.warn('[Longev] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'ae_use' || p.kind === 'ae_grant') { const r = LONGEV.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.longev && LONGEV.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.longev = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.longev) d.longev = this.longev; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.longev = (data?.longev && typeof data.longev === 'object') ? data.longev : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.LONGEV = LONGEV;
