// RimTown - sim-myth.js(v7.5.0 神話基因)
// 第六時代「神話基因」:生技 6 項全部研究完＋王都＋基因實驗室。有錢人花大錢把上古神話的基因編進自己身上,
// 有好處也有副作用:月狼之血(滿月變狼人)、夜之血(吸血鬼)、雷神之血、智慧女神之瞳、太陽神之血、冥王之血、不死鳥之血、巨人之血。
// 出事(咬人、傷人、失火)會引發恐慌,可能被提案驅逐;出事多了有人提案禁止基因編輯,禁了以後只剩地下診所(更貴、更危險、被抓要罰)。
// 神裔的孩子一半機率遺傳。金流守恆:手術費一半給主持的學者、一半進公庫(基因實驗室公營);罰款進公庫。
'use strict';
const MYTH = (() => {
    const GENES = {
        wolf: { name: '月狼之血', icon: '🐺', good: '夜裡體力強，守衛效率高，走得快', bad: '滿月夜會變成狼人傷人', price: 900 },
        night: { name: '夜之血', icon: '🦇', good: '幾乎不會老，心臟不會衰退', bad: '白天虛弱，每週要吸血', price: 2000 },
        thunder: { name: '雷神之血', icon: '⚡', good: '力氣大，工作效率高', bad: '脾氣暴躁，雷雨天會失控傷人', price: 1000 },
        owl: { name: '智慧女神之瞳', icon: '🦉', good: '研究效率加倍，眼睛不會退化', bad: '失眠頭痛，可能發瘋', price: 1200 },
        sun: { name: '太陽神之血', icon: '☀️', good: '醫術大增，肺不會壞', bad: '怕冷，冬天虛弱', price: 1100 },
        hades: { name: '冥王之血', icon: '💀', good: '死時有一半機率復活一次', bad: '身邊的人心情變差，信徒視為邪物', price: 1800 },
        phoenix: { name: '不死鳥之血', icon: '🔥', good: '受傷會自己痊癒', bad: '體溫高，可能讓房子失火', price: 1500 },
        giant: { name: '巨人之血', icon: '🗿', good: '建造、搬運效率加倍', bad: '食量三倍，腳容易受傷', price: 800 },
    };
    const KEYS = Object.keys(GENES);
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const log = (w, k, p, who) => { try { w.logMessageT?.('myth', k, p, who); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'daily', k, p || {}, imp || 6, []); } catch (e) {} };
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const hasB = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k || (typeof BUILDING_TEMPLATES !== 'undefined' && b.name === BUILDING_TEMPLATES[k]?.name));
    const tier = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 3; } catch (e) { return 3; } };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const winter = (w) => w.clock?.season === '冬季' || w.clock?.season === 'winter';
    function S(w) { if (!w.myth || typeof w.myth !== 'object') w.myth = {}; const M = w.myth; M.g = M.g || {}; M.inc = M.inc || []; M.st = M.st || { edits: 0, fails: 0, deaths: 0, attacks: 0, bites: 0, fires: 0, revived: 0, exiled: 0, under: 0, fined: 0 }; MYTH.W = w; return M; }
    const geneOf = (w, a) => (w?.myth?.g?.[a?.agentId]?.k) || null;
    const open = (w) => done(w, 'myth_genome') && hasB(w, 'gene_lab');
    const stab = (w) => (done(w, 'gene_stabilizer') ? 0.5 : 1);
    // ---------- 好處:工作、走路、睡眠、壽命、醫術 ----------
    function workMult(w, a) {
        const g = geneOf(w, a); if (!g) return 1; const k = a.job?.key; const M = S(w);
        if (M.g[a.agentId].mad && day(w) < M.g[a.agentId].mad) return 0.1; // 發瘋了
        switch (g) {
            case 'wolf': return k === 'guard' ? 1.5 : 1.1;
            case 'night': return 0.6; // 白天虛弱
            case 'thunder': return 1.5;
            case 'owl': return k === 'researcher' ? 2 : 1;
            case 'sun': return winter(w) ? 0.5 : 1.1;
            case 'giant': return { carpenter: 1, miner: 1, farmer: 1 }[k] ? 2 : 1.2;
            default: return 1;
        }
    }
    // ---------- 做基因編輯 ----------
    function chief(w, a) { return npcs(w).filter(x => x !== a && x.job?.key === 'researcher').sort((x, y) => (y.skills?.get?.('智識')?.level || 0) - (x.skills?.get?.('智識')?.level || 0))[0] || null; }
    function pick(a) { const k = a.job?.key; const age = a.age || 30; const r = Math.random();
        if (age >= 55) return r < 0.4 ? 'night' : r < 0.7 ? 'hades' : 'phoenix';
        const m = { guard: 'wolf', researcher: 'owl', doctor: 'sun', carpenter: 'giant', miner: 'giant', farmer: 'giant', blacksmith: 'thunder' }[k];
        return m && r < 0.6 ? m : KEYS[Math.floor(Math.random() * KEYS.length)]; }
    function edit(w, a, g, opts) {
        const M = S(w), Wl = WL(), sp = w.stockpile; const G = GENES[g]; if (!G || M.g[a.agentId]) return null;
        const under = !!M.ban; const price = Math.round(G.price * (under ? 1.5 : 1));
        if (!opts?.free) { if (!Wl || Wl.get(w, a) < price || !Wl.take(w, a, price)) return null;
            if (under) { const doc = chief(w, a); if (doc) Wl.add(w, doc, price); else sp?.add?.('silver', price, w.tickCount, t('地下基因診所'), 'myth'); } // 地下診所的錢落入黑心學者口袋
            else { const doc = chief(w, a); const cut = doc ? Math.round(price * 0.5) : 0; if (cut) Wl.add(w, doc, cut); sp?.add?.('silver', price - cut, w.tickCount, t('基因實驗室收入'), 'myth'); } }
        const failP = (under ? 0.25 : 0.15) * (done(w, 'gene_stabilizer') ? 0.35 : 1);
        if (!opts?.free && Math.random() < failP) {
            M.st.fails++; if (typeof HEALTH !== 'undefined' && w.health !== undefined) { HEALTH.S(w); HEALTH.hurt(w, a, HEALTH.PARTS[Math.floor(Math.random() * 5)], 30); }
            if (Math.random() < 0.15) { M.st.deaths++; log(w, '☠️ {a}的基因編輯失敗，沒能撐過去。', { a: a.name }, a.name); a._deathCause = t('基因編輯失敗'); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {} return 'died'; }
            log(w, '🧪 {a}的基因編輯失敗，身體受了損傷。', { a: a.name }, a.name); mem(w, a, '基因編輯失敗了，身體變得更糟。', {}, 8); return 'fail';
        }
        M.g[a.agentId] = { k: g, d: day(w), bite: day(w) }; M.st.edits++; if (under) M.st.under++;
        mem(w, a, '我把{g}編進了自己的身體。{good}，但{bad}。', { g: t(G.name), good: t(G.good), bad: t(G.bad) }, 9);
        log(w, under ? '🕳️ {a}在地下診所編入了{g}。' : '🧬 {a}在基因實驗室編入了{g}，成了神裔。', { a: a.name, g: `${G.icon}${t(G.name)}` }, a.name);
        if (under && Math.random() < 0.3 && Wl) { const fine = Math.min(200, Wl.get(w, a)); if (fine > 0 && Wl.take(w, a, fine)) { sp?.add?.('silver', fine, w.tickCount, t('非法基因編輯罰款'), 'myth'); M.st.fined++; log(w, '👮 {a}去地下診所編基因被抓，罰了 {n} 銀幣。', { a: a.name, n: Math.round(fine) }, a.name); } }
        return 'ok';
    }
    // ---------- 副作用與出事 ----------
    function incident(w, a, kind, victim, exposed) {
        const M = S(w); M.inc.push([day(w), kind, a.agentId, exposed ? 1 : 0]); if (M.inc.length > 40) M.inc.splice(0, M.inc.length - 40);
        if (!exposed) return; for (const o of npcs(w)) { if (o === a) continue; o.addThought?.('monster_fear', w); const r = o.relationships?.getOrCreate?.(a.agentId, a.name); if (r) r.affinity = Math.max(-100, (r.affinity || 0) - (o === victim ? 25 : 6)); }
    }
    function injure(w, v, parts, why) { if (typeof HEALTH === 'undefined') return; HEALTH.S(w); const p = parts[Math.floor(Math.random() * parts.length)]; HEALTH.addAil(w, v, { p, k: 'injury', s: Math.random() < 0.35 ? 2 : 1, dmg: 15 }, why); return p; }
    function sides(w, a, g, M, d, all) {
        const S2 = stab(w) * (M.g[a.agentId]?.half ? 0.5 : 1); /* v7.6.0 混血副作用減半 */ const others = all.filter(o => o !== a); const victim = () => others[Math.floor(Math.random() * others.length)];
        if (g === 'wolf' && d % 15 === 7 && Math.random() < 0.6 * S2) { const v = victim(); if (!v) return; const p = injure(w, v, ['h', 'f', 'e'], '被狼人咬傷'); M.st.attacks++; const caught = Math.random() < 0.35;
            log(w, caught ? '🌕🐺 滿月夜，{a}變成狼人咬傷了{v}，被守衛當場認出來！' : '🌕🐺 滿月夜，有野獸咬傷了{v}，大家不知道是誰。', { a: a.name, v: v.name }, a.name); mem(w, v, '滿月夜被一頭狼咬傷了{p}。', { p: t(HEALTH?.PN?.[p] || '') }, 8); incident(w, a, 'wolf', v, caught); if (caught) injure(w, a, ['f'], '被守衛打傷'); }
        if (g === 'night' && d - (M.g[a.agentId].bite || 0) >= 7) { M.g[a.agentId].bite = d; const v = victim(); if (!v) return; M.st.bites++;
            if (typeof HEALTH !== 'undefined') { HEALTH.S(w); HEALTH.hurt(w, v, 'l', 10); HEALTH.hurt(w, v, 'c', 8); }
            const seen = Math.random() < 0.3; log(w, seen ? '🦇 {a}半夜吸了{v}的血，被人撞見了！' : '🦇 {v}早上醒來脖子上有兩個小洞，全身虛弱。', { a: a.name, v: v.name }, a.name); mem(w, v, '醒來脖子上有兩個小洞，渾身沒力。', {}, 8); incident(w, a, 'night', v, seen);
            if (!S(w).g[v.agentId] && Math.random() < 0.08 * S2) { edit(w, v, 'night', { free: true }); log(w, '🦇 {v}也變成了吸血鬼。', { v: v.name }, v.name); } }
        if (g === 'thunder') { const storm = /storm|thunder|暴風|雷/.test(String(w.weather?.type || w.weather?.name || '')); if (Math.random() < (storm ? 0.3 : 0.015) * S2) { const v = victim(); if (!v) return; injure(w, v, ['h', 'e'], '被雷神之血失控打傷'); M.st.attacks++; log(w, '⚡ {a}突然失控，一拳把{v}打傷了。', { a: a.name, v: v.name }, a.name); incident(w, a, 'thunder', v, true); } }
        if (g === 'owl') { if (!M.g[a.agentId].mad && Math.random() < 0.003 * S2) { M.g[a.agentId].mad = d + 10; a.moodModifier = (a.moodModifier || 0) - 10; log(w, '🌀 {a}被腦中的聲音逼得快瘋了，什麼事都做不了。', { a: a.name }, a.name); mem(w, a, '腦子裡的聲音停不下來，我快瘋了。', {}, 8); } else if (M.g[a.agentId].mad && d >= M.g[a.agentId].mad) delete M.g[a.agentId].mad; }
        if (g === 'hades') { for (let i = 0; i < 3; i++) { const o = victim(); if (o) o.moodModifier = (o.moodModifier || 0) - 2; } for (const o of others) if (devout(w, o)) { const r = o.relationships?.getOrCreate?.(a.agentId, a.name); if (r) r.affinity = Math.max(-100, (r.affinity || 0) - 1); } }
        if (g === 'phoenix') { if (typeof HEALTH !== 'undefined' && w.health) { const al = HEALTH.ails(w, a); for (let i = al.length - 1; i >= 0; i--) if (al[i].k === 'injury') al.splice(i, 1); for (const p of HEALTH.PARTS) HEALTH.setPart(w, a, p, HEALTH.body(w, a)[p] + 10); }
            if (Math.random() < 0.01 * S2) { const wood = Math.min(20, w.stockpile?.get?.('wood') || 0); if (wood > 0) w.stockpile.consume('wood', wood, w.tickCount, t('失火'), 'myth'); a.moodModifier = (a.moodModifier || 0) - 8; M.st.fires++; log(w, '🔥 {a}身上的熱度點著了屋子，燒掉了 {n} 木材。', { a: a.name, n: Math.round(wood) }, a.name); incident(w, a, 'phoenix', null, true); } }
        if (g === 'giant') { if (w.stockpile?.get?.('food') >= 2) w.stockpile.consume('food', 2, w.tickCount, t('巨人的食量'), 'myth'); if (Math.random() < 0.003) injure(w, a, ['f'], '巨人的腳承受不住'); }
    }
    // ---------- 提案:驅逐出事的神裔、禁止基因編輯 ----------
    function proposals(w, M, d) {
        const P = w.proposals; if (!P?._createWith) return; const recent = M.inc.filter(x => d - x[0] <= 30);
        const busy = (k) => (P.items || []).some(p => p.kind === k && ['open', 'shelved', 'approved'].includes(p.status));
        if (!busy('myth_exile')) { const cnt = {}; for (const x of recent) if (x[3]) cnt[x[2]] = (cnt[x[2]] || 0) + 1; const bad = Object.entries(cnt).filter(([id, n]) => n >= 2 && w.agents[id] && !w.agents[id].isDead).sort((a, b) => b[1] - a[1])[0];
            if (bad && d - (M.lastExile || -99) >= 15) { const tgt = w.agents[bad[0]]; const who = npcs(w).filter(o => o !== tgt).sort((x, y) => (x.relationships?.relationships?.[tgt.agentId]?.affinity || 0) - (y.relationships?.relationships?.[tgt.agentId]?.affinity || 0))[0]; if (who) { M.lastExile = d;
                const G = GENES[geneOf(w, tgt)] || {}; const cand = { kind: 'myth_exile', key: 'myth_exile:' + tgt.agentId, jobs: [], make: () => ({ kind: 'myth_exile', key: 'myth_exile:' + tgt.agentId, refKey: tgt.agentId, tk: '把{who}趕出小鎮', tp: { who: tgt.name }, dk: '{p}說{who}身上的{g}一再傷人，大家晚上都不敢出門，提議把{who}趕出小鎮。', dp: { p: who.name, who: tgt.name, g: t(G.name || '') }, cost: {}, category: 'people', jobBias: ['guard'] }) }; P._createWith(w, d, cand, who); } } }
        if (!M.ban && !busy('gene_ban') && recent.filter(x => x[3]).length >= 3 && d - (M.lastBan || -99) >= 30) { const who = npcs(w).find(o => devout(w, o)) || npcs(w).find(o => !geneOf(w, o) && o.job?.key === 'priest') || npcs(w).find(o => !geneOf(w, o)); if (who) { M.lastBan = d;
            const cand = { kind: 'gene_ban', key: 'gene_ban:' + d, jobs: [], make: () => ({ kind: 'gene_ban', key: 'gene_ban:' + d, tk: '禁止基因編輯', tp: {}, dk: '{who}說把神的血編進人身上是在玩火，最近接連出事。提議全面禁止基因編輯。', dp: { who: who.name }, cost: {}, category: 'people', jobBias: ['priest'] }) }; P._createWith(w, d, cand, who); } }
    }
    function vote(w, p, a) {
        const M = S(w); const mine = !!geneOf(w, a); let s = (Math.random() - 0.5) * 2 - (typeof MYTHSOC !== 'undefined' && w.mythsoc && !mine ? MYTHSOC.att(w, a) / 30 : 0); // v7.6.0 怕神裔的人更想驅逐、禁止
        if (p.kind === 'gene_ban') { s += (devout(w, a) ? 3 : 0) + (mine ? -4 : 0) + (M.inc.some(x => x[3] && day(w) - x[0] <= 30) ? 1 : 0) - ((WL()?.get(w, a) || 0) > 600 ? 2 : 0); }
        else { const tgt = w.agents[p.refKey]; const r = a.relationships?.relationships?.[p.refKey]; s += (r ? -(r.affinity || 0) / 30 : 0) + (mine ? -2 : 0) + (devout(w, a) ? 1 : 0); if (tgt && ((a._parentNames || []).includes(tgt.name) || (tgt._parentNames || []).includes(a.name) || r?.status === 'married')) s -= 5; }
        return { v: s > 0 ? 'for' : 'against', why: p.kind === 'gene_ban' ? (devout(w, a) ? 'faith' : 'safety') : 'safety' };
    }
    function exile(w, p) { const a = w.agents[p.refKey]; if (!a || a.isDead) return ''; S(w).st.exiled++; try { w.leaveTown?.(a.agentId, t('被全鎮投票驅逐（神話基因的副作用）')); } catch (e) {} return t('{a}被趕出了小鎮').replace('{a}', a.name); }
    function ban(w) { S(w).ban = true; log(w, '🚫 小鎮通過禁止基因編輯，想編的人只能去地下診所。', {}); return t('基因編輯從此禁止'); }
    // ---------- 每天 ----------
    function daily(w) {
        if (!w.observerMode || !w.research) return; const M = S(w), d = day(w); if (M.lastDay === d) return; M.lastDay = d;
        const all = npcs(w);
        // 遺傳:神裔的孩子一半機率帶著同樣的基因
        M.seen = M.seen || {}; for (const a of all) { if (M.seen[a.agentId]) continue; M.seen[a.agentId] = 1; if ((a.age ?? 30) > 1 || M.g[a.agentId]) continue; const par = all.find(o => (a._parentNames || []).includes(o.name) && M.g[o.agentId]); if (par && Math.random() < 0.5) { M.g[a.agentId] = { k: M.g[par.agentId].k, d, bite: d, born: 1 }; log(w, '👶 {a}一出生就帶著{p}的{g}。', { a: a.name, p: par.name, g: t(GENES[M.g[par.agentId].k].name) }, a.name); } }
        for (const id of Object.keys(M.g)) { const a = w.agents[id]; if (!a || a.isDead) { delete M.g[id]; continue; } sides(w, a, M.g[id].k, M, d, all); }
        if (open(w)) for (const a of all) { if (M.g[a.agentId] || (a.age || 30) < 18 || (a.age || 30) > 65 || devout(w, a)) continue; const g = pick(a); const price = GENES[g].price * (M.ban ? 1.5 : 1); if ((WL()?.get(w, a) || 0) < price + 50) continue; if (Math.random() < (M.ban ? 0.003 : 0.008)) { edit(w, a, g); break; } }
        proposals(w, M, d);
    }
    function view(w) { const M = S(w); const all = npcs(w); return { carriers: all.filter(a => M.g[a.agentId]).map(a => ({ id: a.agentId, name: t(a.name), g: M.g[a.agentId].k, icon: GENES[M.g[a.agentId].k].icon, gname: t(GENES[M.g[a.agentId].k].name), mad: !!M.g[a.agentId].mad })), st: M.st, ban: !!M.ban, open: open(w), recent: M.inc.filter(x => day(w) - x[0] <= 30).length }; }
    function brief(w, a) { const g = geneOf(w, a); if (!g) return ''; const G = GENES[g]; return `${t('我是神裔')}${t('（')}${t(G.name)}${t('）')}${t('：')}${t(G.good)}${t('；')}${t(G.bad)}`; }
    function townBrief(w) { if (!w.myth) return ''; const v = view(w); if (!v.carriers.length) return ''; return t('鎮上有 {n} 個神裔').replace('{n}', v.carriers.length) + (v.ban ? t('，基因編輯已被禁止') : ''); }
    return { W: null, GENES, KEYS, S, geneOf, open, workMult, edit, daily, view, brief, townBrief, vote, exile, ban, incident };
})();

// ---------- 第六時代「神話基因」研究與基因實驗室 ----------
(function () {
    if (typeof RESEARCH_TREE === 'undefined') return;
    if (typeof RESEARCH_ERAS !== 'undefined') RESEARCH_ERAS[6] = { name: '神話基因', icon: '🧿' };
    const ERA5 = Object.entries(RESEARCH_TREE).filter(([, d]) => d.era === 5).map(([k]) => k);
    Object.assign(RESEARCH_TREE, {
        gene_editing: { era: 6, name: t('基因編輯'), description: t('改寫生命的密碼：可以蓋基因實驗室'), cost: 18000, prerequisites: ERA5.slice(), effects: {}, unlocks: ['gene_lab'] },
        myth_genome: { era: 6, name: t('神話基因譜'), description: t('從遠古遺骸找回神話的基因，開放八種神話基因'), cost: 20000, prerequisites: ['gene_editing'], effects: {}, unlocks: [] },
        gene_stabilizer: { era: 6, name: t('基因穩定劑'), description: t('副作用發作的機率減半，編輯失敗少很多'), cost: 22000, prerequisites: ['myth_genome'], effects: {}, unlocks: [] },
    });
    if (typeof BUILDING_TEMPLATES !== 'undefined') BUILDING_TEMPLATES.gene_lab = { name: t('基因實驗室'), description: t('把神話基因編進人身上的地方'), costs: { steel: 40, brick: 40, paper: 60, silver: 1500 }, work: 80, effects: {} };
    if (typeof RESEARCH_UNLOCKED_BY !== 'undefined') RESEARCH_UNLOCKED_BY.gene_lab = ['gene_editing'];
    const tier3 = (w) => { try { return typeof TIERS === 'undefined' || TIERS.level(w) >= 3; } catch (e) { return true; } };
    const lab = (w) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === 'gene_lab' || b.name === BUILDING_TEMPLATES?.gene_lab?.name);
    MYTH.eraOpen = (w) => !!w && tier3(w);
    MYTH.labOpen = (w) => MYTH.eraOpen(w) && lab(w);
    if (typeof HEALTH !== 'undefined') { const _cb = HEALTH.canBuild; HEALTH.canBuild = (w, key) => (key === 'gene_lab' ? tier3(w) : (_cb ? _cb(w, key) : true)); }
    if (typeof ResearchManager !== 'undefined') {
        const RM = ResearchManager.prototype; const _ga = RM.getAvailable; const W = () => (typeof window !== 'undefined' && window.rimtownApp?.world) || MYTH.W;
        const ok = (w, p) => { const e = p.era || 1; if (e < 6 || !w) return true; if (!MYTH.eraOpen(w)) return false; return p.key === 'gene_editing' || MYTH.labOpen(w); };
        RM.getAvailable = function () { const out = _ga.call(this); const w = W(); return out.filter(p => ok(w, p)); };
        const _sr = RM.startResearch; RM.startResearch = function (key) { const p = this.projects[key]; const w = W(); if (p && !ok(w, p)) return false; return _sr.call(this, key); };
    }
})();

// ---------- 接上身體系統、死亡、外觀、AI、存檔 ----------
if (typeof HEALTH !== 'undefined') {
    const H = HEALTH; const g = (w, a) => MYTH.geneOf(w, a);
    const _wm = H.workMult; H.workMult = (w, a) => _wm(w, a) * MYTH.workMult(w, a);
    const _sp = H.speed; H.speed = (aid) => { const w = H.W || MYTH.W; const a = w?.agents?.[aid]; return _sp(aid) * (a && g(w, a) === 'wolf' ? 1.4 : 1); };
    const _sl = H.sleepMult; H.sleepMult = (w, a) => _sl(w, a) * (g(w, a) === 'owl' ? 0.6 : 1);
    const _dm = H.deathMult; H.deathMult = (w, a) => _dm(w, a) * (g(w, a) === 'night' ? 0.2 : 1);
    const _hu = H.hurt; H.hurt = (w, a, p, n) => { const k = g(w, a); if ((k === 'owl' && p === 'e') || (k === 'night' && p === 'c') || (k === 'sun' && p === 'l')) return; return _hu(w, a, p, n); };
    const _sr = H.successRate; H.successRate = (w, a, doc, sev) => Math.min(0.97, _sr(w, a, doc, sev) + (doc && g(w, doc) === 'sun' ? 0.2 : 0));
}
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) { // 冥王之血:死時一半機率復活一次
        try { const M = world.myth; const e = M?.g?.[npc.agentId]; if (e && e.k === 'hades' && !e.rev && Math.random() < 0.5) { e.rev = 1; M.st.revived++; npc._deathCause = null; npc.moodModifier = (npc.moodModifier || 0) - 5; world.logMessageT?.('myth', '💀 {a}斷氣之後又睜開了眼睛——冥王之血讓{a}活了回來。', { a: npc.name }, npc.name); for (const o of Object.values(world.agents)) if (o !== npc && !o.isDead && !o.isPlayer) o.addThought?.('monster_fear', world); return; } } catch (e) {}
        return _kill.call(this, world, npc, ...rest);
    };
}
if (typeof LOOK !== 'undefined') {
    const _of = LOOK.of, _sig = LOOK.sig;
    LOOK.of = function (w, a) { const r = _of(w, a); try { const k = MYTH.geneOf(w, a); if (r && k) r.gn = k; } catch (e) {} return r; };
    LOOK.sig = (p) => _sig(p) + (p?.gn ? 'G' + p.gn : '');
}
if (typeof THOUGHT_DEFS !== 'undefined') THOUGHT_DEFS.monster_fear = { mood: -3, opinion: 0, days: 3, label: t('鎮上有怪物，晚上不敢出門') };
if (typeof PROPOSAL_KINDS !== 'undefined') { PROPOSAL_KINDS.gene_ban = { icon: '🚫', label: '禁止基因編輯' }; PROPOSAL_KINDS.myth_exile = { icon: '🐺', label: '驅逐神裔' }; }
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) MYTH.daily(w); } catch (e) { console.warn('[Myth] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'gene_ban' || p.kind === 'myth_exile') { const r = MYTH.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = MYTH.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = MYTH.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.myth = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.myth) { const M = this.myth; d.myth = { g: M.g, inc: M.inc, st: M.st, ban: M.ban || false, lastBan: M.lastBan || 0, lastExile: M.lastExile || 0 }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.myth = (data?.myth && typeof data.myth === 'object') ? data.myth : null; } catch (e) {} return r; };
}
