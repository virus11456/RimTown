// v6.63.0 報社與媒體:媒體是一股力量
// - 媒體隨城鎮等級:村莊只有公告欄;城鎮有鎮報;城市多了保守、革新、八卦三家有立場的報社;王都再加皇家官報
// - 村民各讀一份(看個性與年紀),信任度不同:愛八卦的容易信、悲觀的多疑;跟候選人有交情就看自己經驗
// - 選舉期間報社每天出一則:表態支持、民調(牆頭草跟風)、揭弊(挖出真相頁的祕密)、抹黑假新聞(可能被拆穿、更正、反噬)
// - 有錢的候選人可能收買報社(真相頁看得到);記者揭弊會成名,也會被記恨;國王可以查禁批評他的報社(民心降、轉成地下報紙)
// - AI 投票會看「最近讀到的報導」;規則投票也算進去
const PRESS = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('news', k, p || {}, who || ''); } catch (e) {} };
    const reg = (zh, e) => { try { if (typeof I18N !== 'undefined') I18N.registerName(zh, e); } catch (x) {} };
    const tierLv = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const money = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const STANCE = { board: { icon: '📌', zh: '公告欄', en: 'notice board', cred: 55 }, town: { icon: '📰', zh: '中立', en: 'neutral', cred: 65 }, cons: { icon: '🏛️', zh: '保守', en: 'conservative', cred: 60 }, prog: { icon: '🌱', zh: '革新', en: 'progressive', cred: 60 }, gossip: { icon: '🗞️', zh: '八卦', en: 'tabloid', cred: 35 }, crown: { icon: '👑', zh: '官方', en: 'official', cred: 70 } };
    const PRE = [['晨', 'Morning'], ['北辰', 'Polaris'], ['新', 'New'], ['大', 'Grand'], ['明', 'Bright'], ['鐘', 'Bell']];
    function wanted(w) { const lv = tierLv(w); const s = ['board']; if (lv >= 1) s.push('town'); if (lv >= 2) s.push('cons', 'prog', 'gossip'); if (lv >= 3) s.push('crown'); return s; }
    function makePaper(w, st, i) {
        const town = w.townName || '邊境鎮', h = (typeof TownGen !== 'undefined' ? TownGen.hash(town + st) : i * 7), p = PRE[h % PRE.length];
        const townEn = (typeof t === 'function' ? t(town) : town);
        const N = { board: ['鎮公所公告欄', 'Town Hall Notice Board'], town: [`${town}日報`, `${townEn} Daily`], cons: [`${p[0]}時報`, `The ${p[1]} Times`], prog: [`${p[0]}新報`, `The ${p[1]} Herald`], gossip: [`${p[0]}閒話報`, `The ${p[1]} Tattler`], crown: ['皇家官報', 'Royal Gazette'] }[st];
        reg(N[0], N[1]);
        const P = { id: 'P' + (i + 1), st, name: N, cred: STANCE[st].cred, owner: null, journo: null, bribedBy: null, banned: false, underground: false, stories: [], fame: 0 };
        P.journo = pickJourno(w, P); return P;
    }
    function pickJourno(w, P) {
        const used = new Set((w.press?.papers || []).map(x => x.journo)); const c = npcs(w).filter(a => !used.has(a.agentId) && a.job?.key !== 'mayor');
        const score = (a) => (has(a, 'gossip') ? 3 : 0) + (has(a, 'charismatic') ? 2 : 0) + (has(a, 'perfectionist') ? 1 : 0) + (a.job?.key === 'researcher' ? 1 : 0) + Math.random();
        return c.sort((x, y) => score(y) - score(x))[0]?.agentId || null;
    }
    function S(w) {
        if (!w.press || !Array.isArray(w.press.papers)) w.press = { papers: [], reads: {}, n: 0, lastDay: null, elec: null };
        const R = w.press; if (!R._reg) { R._reg = true; for (const P of R.papers) reg(P.name[0], P.name[1]); }
        const want = wanted(w);
        for (const st of want) if (!R.papers.some(P => P.st === st)) { R.papers.push(makePaper(w, st, R.papers.length)); try { if (st !== 'board') log(w, '📰 {n}創刊了！', { n: R.papers[R.papers.length - 1].name[0] }); } catch (e) {} }
        for (const a of npcs(w)) if (!R.reads[a.agentId] || !R.papers.some(P => P.id === R.reads[a.agentId] && !P.closed)) R.reads[a.agentId] = choosePaper(w, R, a);
        return R;
    }
    function choosePaper(w, R, a) {
        const ok = R.papers.filter(P => !P.closed); const by = (st) => ok.find(P => P.st === st);
        const pious = (w.faith?.of?.[a.agentId]?.piety || 0) >= 60;
        if (has(a, 'gossip') && by('gossip')) return by('gossip').id;
        if ((a.age >= 45 || has(a, 'ascetic') || has(a, 'stoic') || pious) && by('cons')) return by('cons').id;
        if ((has(a, 'creative') || has(a, 'optimist') || a.age <= 27) && by('prog')) return by('prog').id;
        if ((CLASS_LV(w, a) >= 4) && by('crown')) return by('crown').id;
        return (by('town') || by('board') || ok[0])?.id || null;
    }
    const CLASS_LV = (w, a) => { try { return typeof CLASS !== 'undefined' && w.classes ? CLASS.level(w, a) : 1; } catch (e) { return 1; } };
    const paperOf = (w, a) => { const R = w.press; return R ? R.papers.find(P => P.id === R.reads[a?.agentId]) || null : null; };
    function trust(w, a, P) { if (!P) return 0; let s = P.cred / 100; if (has(a, 'gossip')) s += 0.2; if (has(a, 'pessimist') || has(a, 'stoic')) s -= 0.15; if (has(a, 'perfectionist')) s -= 0.05; if (P.underground) s += 0.1; return Math.max(0.05, Math.min(1, s)); }
    function story(w, P, kind, k, p, cand, extra) {
        const R = w.press; const s = Object.assign({ id: 'S' + (++R.n), day: day(w), kind, k, p, cand: cand || null, paper: P.id }, extra || {});
        P.stories.push(s); if (P.stories.length > 12) P.stories.splice(0, P.stories.length - 12);
        // 讀者看到(進記憶,AI 投票看得到)
        for (const a of npcs(w)) if (R.reads[a.agentId] === P.id && Math.random() < 0.7) mem(w, a, '我在{paper}讀到：{s}', { paper: P.name[0], s: { k, p } }, 5);
        log(w, '{i} {paper}：{s}', { i: STANCE[P.st].icon, paper: P.name[0], s: { k, p } });
        return s;
    }
    // ---------- 選舉 ----------
    function leanOf(w, P, cands) {
        const sc = (c) => { const a = w.agents[c.agentId]; if (!a) return -99; let s = 0;
            if (P.st === 'cons') s += (a.age || 30) / 10 + (has(a, 'stoic') ? 3 : 0) + (has(a, 'ascetic') ? 2 : 0) + (a.job?.key === 'priest' ? 3 : 0);
            if (P.st === 'prog') s += (60 - (a.age || 30)) / 10 + (has(a, 'creative') ? 3 : 0) + (a.job?.key === 'researcher' ? 3 : 0) + (has(a, 'optimist') ? 2 : 0);
            if (P.st === 'gossip') s += (has(a, 'charismatic') ? 4 : 0) + (has(a, 'romantic') ? 2 : 0);
            if (P.st === 'crown') { const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; s += k ? aff(k, a) / 10 : 0; }
            if (P.owner) s += aff(w.agents[P.owner], a) / 10; return s; };
        return cands.slice().sort((x, y) => sc(y) - sc(x))[0];
    }
    function poll(w, cands) {
        const tally = {}; for (const c of cands) tally[c.agentId] = 0;
        for (const v of npcs(w)) { const best = cands.map(c => ({ c, s: aff(v, w.agents[c.agentId]) + Math.random() * 10 })).sort((a, b) => b.s - a.s)[0]; if (best) tally[best.c.agentId]++; }
        return cands.map(c => ({ c, n: tally[c.agentId] })).sort((a, b) => b.n - a.n);
    }
    // 收買報社(擲骰版與決策核心共用):隨便找一家還沒被買走的,記者有原則就不收
    const BRIBE = 60;
    const freePapers = (R) => R.papers.filter(P => P.st !== 'board' && P.st !== 'crown' && !P.bribedBy && !P.banned);
    function elecOf(w, R, E, d) {
        const cands = (E.candidates || []).filter(c => w.agents[c.agentId]); if (cands.length < 2) return null;
        const key = (E.lastElectionDay || 0) + ':' + cands.map(c => c.agentId).join(','); if (!R.elec || R.elec.key !== key) R.elec = { key, start: d, endorsed: {}, bribes: {} };
        return cands;
    }
    function bribePaper(w, R, a) {
        const P = freePapers(R).sort(() => Math.random() - 0.5)[0]; if (!P) return null;
        const ed = w.agents[P.journo]; if (!ed || has(ed, 'perfectionist')) return { P, ed: ed || null, refused: true };
        if (!WALLET.pay(w, a, ed, BRIBE)) return null;
        P.bribedBy = a.agentId; R.elec.bribes[a.agentId] = P.id;
        try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: ed.agentId, k: '{a}花錢收買了{paper}', p: { a: a.name, paper: P.name[0] } }); } catch (e) {}
        return { P, ed };
    }
    // v9.26.0 給決策核心:這個候選人現在能不能收買報社(跟以前擲骰的是同一批人:手上有 150 銀幣、不是特別老實、還有報社沒被買走、這次選舉還沒買過)
    function bribeInfo(w, a) {
        const E = w.election; if (!a || !E || !E.active || E.phase !== 'campaign' || typeof WALLET === 'undefined' || !w.wallet) return null;
        const R = S(w); const cands = elecOf(w, R, E, day(w)); if (!cands || !cands.some(c => c.agentId === a.agentId) || R.elec.bribes[a.agentId] || money(w, a) < 150) return null;
        let honest = 3; try { honest = DARK.honesty(a); } catch (e) {} if (honest >= 3) return null;
        const n = freePapers(R).length; return n ? { n, cost: BRIBE } : null;
    }
    function bribeBy(w, a) {
        if (!bribeInfo(w, a)) return null; const r = bribePaper(w, S(w), a); if (!r) return null;
        if (r.refused) { mem(w, a, '我想塞錢給{paper}，被擋了回來。', { paper: r.P.name[0] }, 5); if (r.ed) mem(w, r.ed, '{a}想塞錢要我替他說好話，我沒收。', { a: a.name }, 6); }
        else { mem(w, a, '我花了 {n} 銀幣，讓{paper}替我說話。', { n: BRIBE, paper: r.P.name[0] }, 6); mem(w, r.ed, '{a}塞了 {n} 銀幣，要報上替他說好話。我收了。', { a: a.name, n: BRIBE }, 6); }
        return r;
    }
    function electionDay(w, R, E, d) {
        const cands = elecOf(w, R, E, d); if (!cands) return;
        // 收買:要不要花錢買報社,由有錢又不老實的候選人自己決定(bribeBy)
        for (const P of R.papers) {
            if (P.banned && !P.underground) continue; if (P.st === 'board') { if (!R.elec.endorsed[P.id]) { R.elec.endorsed[P.id] = 'none'; story(w, P, 'platform', '候選人：{list}', { list: cands.map(c => c.name).join(' / ') }); } continue; }
            const ed = w.agents[P.journo];
            // 揭弊:記者挖出候選人的祕密
            if (ed && typeof DARK !== 'undefined') {
                const D = DARK.S(w); const sec = (D.secrets || []).find(s => !s.found && cands.some(c => c.agentId === s.culprit) && s.kind !== 'white');
                let ins = 1; try { ins = DARK.insight(ed); } catch (e) {}
                if (sec && P.bribedBy !== sec.culprit && Math.random() < 0.15 + ins * 0.1) {
                    sec.found = true; const c = w.agents[sec.culprit]; P.fame = (P.fame || 0) + 1; P.cred = Math.min(95, P.cred + 5);
                    try { DARK.bump(w, c, 'exposed'); } catch (e) {}
                    story(w, P, 'expose', '揭弊！{c}被爆：{what}', { c: c.name, what: { k: sec.k, p: sec.p } }, c.agentId);
                    mem(w, ed, '我在{paper}揭了{c}的底，大家都在談。', { paper: P.name[0], c: c.name }, 8); c.relationships.getOrCreate(ed.agentId, ed.name).modifyAffinity(-30); mem(w, c, '{e}在報上揭我的底，這筆帳我記住了。', { e: ed.name }, 8);
                    continue;
                }
            }
            // 抹黑:八卦報或被收買的報社捏造對手醜聞
            if ((P.st === 'gossip' || P.bribedBy) && Math.random() < 0.25) {
                const friend = P.bribedBy ? cands.find(c => c.agentId === P.bribedBy) : null; const victim = cands.filter(c => c !== friend).sort(() => Math.random() - 0.5)[0];
                if (victim) { const lie = ['{c}私下收了商人的好處', '{c}在酒館說鎮民的壞話', '{c}偷偷挪用了公款'][Math.floor(Math.random() * 3)]; story(w, P, 'smear', lie, { c: victim.name }, victim.agentId, { fake: true, by: P.bribedBy || null }); continue; }
            }
            // 表態支持
            if (!R.elec.endorsed[P.id]) { const c = P.bribedBy ? cands.find(x => x.agentId === P.bribedBy) || leanOf(w, P, cands) : leanOf(w, P, cands); R.elec.endorsed[P.id] = c.agentId; story(w, P, 'endorse', '本報支持{c}', { c: c.name }, c.agentId); continue; }
            // 民調
            if (Math.random() < 0.5) { const pl = poll(w, cands); story(w, P, 'poll', '民調：{a}領先（{n} 票），{b}緊追在後', { a: pl[0].c.name, n: pl[0].n, b: pl[1].c.name }, pl[0].c.agentId); }
        }
        // 假新聞被拆穿 → 更正、反噬
        for (const P of R.papers) for (const s of P.stories) if (s.fake && !s.corrected && d - s.day >= 1 && Math.random() < 0.3) {
            s.corrected = true; P.cred = Math.max(5, P.cred - 20);
            story(w, P, 'correct', '更正：先前關於{c}的報導並非事實', { c: w.agents[s.cand]?.name || '' }, s.cand);
            const v = w.agents[s.cand]; if (v) mem(w, v, '{paper}造謠抹黑我，還好被拆穿了。', { paper: P.name[0] }, 7);
            if (s.by && w.agents[s.by]) for (const a of npcs(w)) if (R.reads[a.agentId] === P.id) a.relationships.getOrCreate(s.by, w.agents[s.by].name).modifyAffinity(-6);
        }
    }
    // 規則投票的報紙影響(讀者對各候選人的加減分)
    function bias(w, voter, cid) {
        const R = w.press; if (!R) return 0; const P = paperOf(w, voter); if (!P) return 0; const tr = trust(w, voter, P), d = day(w);
        const cand = w.agents[cid]; const known = cand ? Math.abs(aff(voter, cand)) >= 30 : false; const k = known ? 0.4 : 1; // 有交情的人看自己經驗
        let s = 0;
        for (const x of P.stories) { if (d - x.day > 8) continue;
            if (x.kind === 'endorse' && x.cand === cid) s += 8 * tr * k;
            if (x.kind === 'expose' && x.cand === cid) s -= 14 * tr * k;
            if (x.kind === 'smear' && x.cand === cid && !x.corrected) s -= 10 * tr * k;
            if (x.kind === 'correct' && x.cand === cid) s += 3;
            if (x.kind === 'poll' && x.cand === cid) { const strong = Object.values(voter.relationships?.relationships || {}).some(r => r.affinity >= 40); if (!strong) s += 4 * tr; } // 牆頭草跟風
        }
        return s;
    }
    // ---------- 平日:報導國王與首長;國王查禁 ----------
    function weekday(w, R, d) {
        const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null;
        if (k && w.crown && w.crown.legit < 40) for (const P of R.papers) {
            if (P.banned || !['prog', 'gossip'].includes(P.st) || Math.random() > 0.3) continue;
            story(w, P, 'critic', '民怨沸騰，國王{k}該聽聽百姓的聲音', { k: k.name }, k.agentId);
            if (Math.random() < 0.35) { P.banned = true; w.crown.legit = Math.max(0, w.crown.legit - 5); log(w, '🚫 國王{k}查禁了{paper}。', { k: k.name, paper: P.name[0] }, k.name); for (const a of npcs(w)) if (R.reads[a.agentId] === P.id) mem(w, a, '{paper}被國王查禁了，太過分了。', { paper: P.name[0] }, 6); }
        }
        // 被查禁的報社轉成地下報紙(過幾天)
        for (const P of R.papers) if (P.banned && !P.underground && Math.random() < 0.2) { P.underground = true; P.cred = Math.min(95, P.cred + 10); log(w, '🕯️ {paper}轉入地下，私下流傳得更廣了。', { paper: P.name[0] }); }
    }
    function daily(w) {
        const R = S(w), d = day(w); if (R.lastDay === d) return; R.lastDay = d;
        if (w.econ?.paperShort && Math.random() < 0.5) return; // v6.77.0 缺紙:約一半的日子停刊
        for (const P of R.papers) if (!w.agents[P.journo] || w.agents[P.journo].isDead) P.journo = pickJourno(w, P);
        const E = w.election; if (E && E.active && (E.phase === 'campaign' || E.phase === 'voting')) electionDay(w, R, E, d); else { weekday(w, R, d); for (const P of R.papers) P.bribedBy = null; }
    }
    function brief(w, a) { const P = paperOf(w, a); if (!P) return ''; const ss = P.stories.slice(-2); if (!ss.length) return ''; return `${t('你最近在{paper}讀到').replace('{paper}', t(P.name[0]))}${t('：')}${ss.map(s => Memory.render(s.k, s.p)).join(t('；'))}`; }
    function view(w) {
        const R = S(w);
        return R.papers.map(P => ({ id: P.id, icon: STANCE[P.st].icon, name: t(P.name[0]), stance: t(STANCE[P.st].zh), cred: Math.round(P.cred), readers: Object.values(R.reads).filter(x => x === P.id).length, journo: w.agents[P.journo] ? t(w.agents[P.journo].name) : null, banned: P.banned, underground: P.underground, last: P.stories.length ? Memory.render(P.stories[P.stories.length - 1].k, P.stories[P.stories.length - 1].p) : '', fame: P.fame || 0 }));
    }
    return { S, STANCE, daily, bias, trust, paperOf, brief, view, poll, electionDay, weekday, story, bribeInfo, bribeBy };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) PRESS.daily(w); } catch (e) { console.warn('[Press] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.press && PRESS.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.press = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.press) { const { _reg, ...x } = this.press; d.press = x; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.press = (data?.press && Array.isArray(data.press.papers)) ? Object.assign({}, data.press) : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.PRESS = PRESS;
