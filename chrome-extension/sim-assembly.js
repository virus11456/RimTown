// v6.82.0 議會實權:大事要議會表決、首長否決可被三分之二推翻、議員每年春天改選、出缺由落選者遞補、議事紀錄
// - 村民投票是民意;「大事」(花 100 銀幣以上,或建設／產業／工廠／升級／稅率／政令／升格)投票後先送議會表決,議會過了才給首長
//   村莊等級只有升格與稅率要送長老會
// - 秘密用 kickback 類(預設被看穿機率),往前記 10 天讓揭穿窗口只剩 5 天:大約一半會被揭穿
// - 議員投票看自己的意見、民意、私下交換條件(sim-politics),也可能收了提案人的錢(🕵️ 秘密,會被揭穿)
// - 首長否決議會通過的案子,議會贊成達三分之二就推翻否決
// - 每年春季第 3 天開始改選:現任與自己想選的人登記參選、拉票(不老實又有錢的會買票),第 6 天開票,票數前幾名當選
//   任內有人離開或辭職,由上次落選者票數最高的人遞補;沒有落選者才照舊由大家推舉(sim-tiers)
// - 議事紀錄:每位議員支持過哪些案子、十天後成效好壞、收錢被揭穿幾次,影響改選
const ASSEMBLY = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => a && !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || (typeof t === 'function' && vs.includes(t(v))); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const honest = (a) => { try { return DARK.honesty(a); } catch (e) { return 3; } };
    const money = (w, a) => { try { return w.wallet ? WALLET.get(w, a) : 0; } catch (e) { return 0; } };
    const lv = (w) => { try { return TIERS.level(w); } catch (e) { return 1; } };
    const L = (w) => { try { return TIERS.LV[TIERS.level(w)]; } catch (e) { return { council: '鎮議會', member: '鎮議員', leader: '鎮長', seats: 5 }; } };
    const leaderId = (w) => { try { return w.election?._officeHolder?.(w)?.agentId || w.election?.currentMayor?.(w)?.agentId || null; } catch (e) { return null; } };
    const away = (w) => new Set((w.events?._travellingAgents || []).map(x => x?.agentData?.agentId).filter(Boolean));
    const wantSeats = (w) => { let s = 5; try { s = TIERS.seats(w); } catch (e) {} return Math.min(s, Math.max(3, Math.floor(npcs(w).length / 3))); };
    const rnd = (arr) => arr.slice().sort(() => Math.random() - 0.5);
    const ELEC_DAY = 3, CAMPAIGN = 3;

    function S(w) {
        if (!w.assembly || typeof w.assembly !== 'object') w.assembly = { elec: null, last: null, runners: [], rec: {}, elections: 0, lastYear: null, formedDay: null };
        const A = w.assembly; A.rec = A.rec || {}; A.runners = A.runners || []; return A;
    }
    const R = (w, id) => { const A = S(w); return A.rec[id] || (A.rec[id] = { terms: 0, since: null, votes: [], nv: 0, ns: 0, good: 0, bad: 0, bribes: 0, exposed: 0, bought: 0 }); };

    // ---------- 哪些案子算大事 ----------
    const MAJOR = new Set(['build', 'industry', 'factory', 'upgrade', 'industry_up', 'tax', 'policy', 'tier_up']);
    const VILLAGE = new Set(['tier_up', 'tax']);
    function seated(w) {
        const C = w.council; if (!C?._formed) return [];
        const lid = leaderId(w);
        return (C.members || []).map(id => w.agents[id]).filter(a => a && !a.isDead && a.agentId !== lid && a.currentLocation !== 'exploration');
    }
    function isMajor(w, p) {
        if (!p || p.kind === 'verdict') return false;
        let cost = 0; try { cost = w.proposals?._cost?.(p)?.silver || 0; } catch (e) {}
        if (lv(w) === 0) return VILLAGE.has(p.kind);
        return MAJOR.has(p.kind) || cost >= 100;
    }
    const needs = (w, p) => isMajor(w, p) && seated(w).length >= 2;

    // ---------- 議員投票 ----------
    // 有錢又不老實的提案人私下塞錢給會投反對的議員(上帝視角看得到,之後可能被揭穿)
    function lobby(w, p, ms) {
        const payer = w.agents[p.proposerId]; if (!payer || !w.wallet) return;
        if (honest(payer) > 2 && !has(payer, 'greedy')) return;
        if (money(w, payer) < 60 || Math.random() > 0.5) return;
        const targets = ms.filter(m => m !== payer && p.votes?.[m.agentId] !== 'for' && (honest(m) <= 2 || has(m, 'greedy'))).slice(0, 2);
        const Lw = L(w);
        for (const m of targets) {
            const n = 15 + Math.floor(Math.random() * 11);
            if (!WALLET.pay(w, payer, m, n)) break;
            (p._bribe || (p._bribe = {}))[m.agentId] = payer.agentId; R(w, m.agentId).bribes++;
            log(w, 'council', '💰 {a}私下塞了 {n} 銀幣給{m}，要他在{council}挺「{title}」。🕵️', { a: payer.name, n, m: m.name, council: Lw.council, title: w.proposals.title(p) }, payer.name);
            mem(w, m, '{a}私下給了我 {n} 銀幣，要我在{council}投他的提案。', { a: payer.name, n, council: Lw.council }, 6);
            try { DARK.secret(w, { kind: 'kickback', day: day(w) - 10, culprit: m.agentId, victim: null, asm: 'bribe', k: '{c}收了{a}的 {n} 銀幣，在議會投票支持{id}', p: { c: m.name, a: payer.name, n, id: p.id } }); } catch (e) {}
        }
    }
    function memberVote(w, p, a, pub) {
        const ps = w.proposals;
        if (!p.votes[a.agentId]) { try { ps._ruleVote(w, p, a); } catch (e) {} }
        if (p._bribe?.[a.agentId]) return { v: 'for', why: 'bribe' };
        try { const pv = (typeof POLITICS !== 'undefined') ? POLITICS.pactVote(w, p, a) : null; if (pv) return { v: pv, why: 'pact' }; } catch (e) {}
        let s = p.votes[a.agentId] === 'for' ? 1.5 : p.votes[a.agentId] === 'against' ? -1.5 : 0;
        const total = pub.f + pub.a; let pubPart = 0;
        if (total >= 3) { // 議員也看民意:心軟、重視社群的人比較會順著大家
            const lean = (pub.f - pub.a) / total;
            const k = (has(a, 'kind') || hasV(a, '社群') ? 1.3 : 1) * (has(a, 'abrasive') || hasV(a, '權力') ? 0.6 : 1);
            pubPart = lean * 3.5 * k; s += pubPart;
        }
        s += 0.7; // 送到議會的案子多半已經過了民意一關,議員傾向放行
        let cost = 0; try { cost = ps._cost(p).silver || 0; } catch (e) {}
        if (cost >= 100 && (has(a, 'greedy') || hasV(a, '財富'))) s -= 0.6;
        const rel = aff(a, w.agents[p.proposerId]); s += rel / 60;
        s += (Math.random() - 0.5) * 1.6;
        const v = s >= 0 ? 'for' : 'against';
        const why = (Math.abs(pubPart) >= 1 && Math.sign(pubPart) === (v === 'for' ? 1 : -1)) ? 'public' : 'own';
        return { v, why };
    }
    function councilVote(w, p, d) {
        const ms = seated(w); if (ms.length < 2) return null;
        const ps = w.proposals; p.votes = p.votes || {};
        try { lobby(w, p, ms); } catch (e) { console.warn('[Assembly] lobby', e); }
        const pub = { f: ps._count(p, 'for'), a: ps._count(p, 'against') };
        const votes = {}, why = {}, names = {}; let f = 0;
        for (const m of ms) { const r = memberVote(w, p, m, pub); votes[m.agentId] = r.v; why[m.agentId] = r.why; names[m.agentId] = m.name; if (r.v === 'for') f++; }
        const n = ms.length, ag = n - f;
        p.council = { day: d, for: f, against: ag, n, votes, why, names, pass: f >= ag, sup: f >= Math.ceil(n * 2 / 3), lv: lv(w) };
        const title = ps.title(p);
        for (const m of ms) { const r = R(w, m.agentId); r.nv = (r.nv || 0) + 1; if (votes[m.agentId] === 'for') r.ns = (r.ns || 0) + 1; r.votes.push({ pid: p.id, title, v: votes[m.agentId], day: d, kind: p.kind }); if (r.votes.length > 12) r.votes.splice(0, r.votes.length - 12); }
        const Lw = L(w);
        log(w, 'council', '🏛️ {council}表決{id}「{title}」：{f} 贊成 / {a} 反對，{res}。', { council: Lw.council, id: p.id, title, f, a: ag, res: p.council.pass ? '送交鎮長拍板' : '議會否決' });
        try { w.dailyNews?.collectEvent?.('politics', `${t(Lw.council)}${t('表決')}${p.id}${t('（')}${f}:${ag}${t('）')}${t('：')}${t(p.council.pass ? '通過' : '否決')}`, 6, []); } catch (e) {}
        return p.council;
    }

    // ---------- 十天後成效記到議員頭上 ----------
    function onOutcome(w, p) {
        const o = p.outcome, C = p.council; if (!o || !C) return;
        const sc = (o.mood || 0) + (o.silver || 0) / 15 + (o.food || 0) / 25 + (o.pop || 0) * 2;
        const good = sc > 0.5, bad = sc < -0.5; if (!good && !bad) return;
        for (const [id, v] of Object.entries(C.votes || {})) {
            if (v !== 'for') continue; const r = R(w, id); if (good) r.good++; else r.bad++;
            const e = r.votes.find(x => x.pid === p.id); if (e) e.res = good ? 'good' : 'bad';
        }
    }

    // ---------- 秘密被揭穿 ----------
    function scanSecrets(w) {
        const D = w.dark; if (!D?.secrets) return;
        const Lw = L(w);
        for (const s of D.secrets) {
            if (!s.asm || !s.found || s._asmDone) continue; s._asmDone = true;
            const c = w.agents[s.culprit]; const r = R(w, s.culprit); r.exposed++;
            if (!c) continue;
            if (s.asm === 'bribe') {
                log(w, 'council', '📰 {c}在{council}收錢投票的事傳開了，大家議論紛紛。', { c: c.name, council: Lw.council }, c.name);
                const inC = (w.council?.members || []).includes(c.agentId);
                if (inC && (r.exposed >= 2 || Math.random() < 0.5)) {
                    w.council.members = w.council.members.filter(id => id !== c.agentId);
                    log(w, 'council', '🙇 {c}收錢的事被揭穿，辭去了{member}。', { c: c.name, member: Lw.member }, c.name);
                    mem(w, c, '收錢的事被揭穿，我只好辭去{member}，丟臉丟到家了。', { member: Lw.member }, 8);
                    c.moodModifier = (c.moodModifier || 0) - 8;
                    try { w.dailyNews?.collectEvent?.('politics', `${t(c.name)}${t('收錢的事被揭穿，辭去了')}${t(Lw.member)}`, 8, [c.name]); } catch (e) {}
                }
            } else if (s.asm === 'buy') {
                log(w, 'council', '📰 {c}在{member}選舉時買票的事傳開了。', { c: c.name, member: Lw.member }, c.name);
            }
        }
    }

    // ---------- 春季改選 ----------
    function ambition(w, a, inc) {
        let s = inc ? 2.5 : 0;
        if (has(a, 'charismatic')) s += 2; if (has(a, 'hardworking')) s += 1; if (has(a, 'shy')) s -= 2; if (has(a, 'lazy')) s -= 1.5;
        if (hasV(a, '權力')) s += 2; if (hasV(a, '社群')) s += 1;
        s += (a.skills?.skills?.社交?.level || 0) * 0.5;
        try { if (typeof CLASS !== 'undefined' && w.classes) s += CLASS.level(w, a) * 0.4; } catch (e) {}
        if (money(w, a) >= 60) s += 0.5; if ((a.mood ?? 50) < 30) s -= 1; if ((a.age || 0) >= 30) s += 0.5;
        if (inc) { const r = R(w, a.agentId); s += Math.min(2, (r.good - r.bad) * 0.4); if (r.exposed) s -= r.exposed * 1.5; }
        return s + Math.random() * 2.5;
    }
    const PITCH = [
        ['權力', '我會把大家的意見帶進{council}，說到做到。'], ['財富', '每一枚銀幣都要花在刀口上，我會替大家守好公庫。'], ['社群', '鎮上的事大家一起扛，窮人也該過好日子。'],
        ['知識', '要讓鎮上越來越進步，學校、研究都不能少。'], ['冒險', '別老是守著舊規矩，我們該往外闖一闖。'], ['家庭', '我想讓每個家都住得安心、吃得飽。'], ['和平', '少吵架、多商量，鎮上才會好。'],
    ];
    function pitchOf(a) { for (const [v, k] of PITCH) if (hasV(a, v)) return k; return has(a, 'hardworking') ? '我不會說好聽話，但我會做事。' : '請大家給我一個機會。'; }
    function start(w) {
        const A = S(w), d = day(w), lid = leaderId(w), C = w.council; const inc = new Set(C.members || []);
        const pool = npcs(w).filter(a => (a.age || 0) >= 18 && a.agentId !== lid && a.currentLocation !== 'exploration');
        const want = Math.max(1, wantSeats(w) - (C.members || []).filter(id => !w.agents[id] && away(w).has(id)).length);
        const scored = pool.map(a => [a, ambition(w, a, inc.has(a.agentId))]).sort((x, y) => y[1] - x[1]);
        const maxC = Math.min(pool.length, want + Math.max(2, Math.ceil(want * 0.6)));
        const cands = []; for (const [a, s] of scored) { if (cands.length >= maxC) break; if (s > 1.5 || cands.length < want + 1) cands.push(a); }
        if (cands.length <= want) { A.lastYear = w.clock.year; return null; } // 人太少,不用選
        A.elec = { start: d, year: w.clock.year, phase: 'campaign', left: CAMPAIGN, seats: want, cands: cands.map(a => ({ id: a.agentId, name: a.name, inc: inc.has(a.agentId), pitch: pitchOf(a) })) };
        const Lw = L(w);
        log(w, 'council', '🗳️ {council}改選開始！{n} 人搶 {s} 席：{names}', { council: Lw.council, n: cands.length, s: want, names: cands.map(a => t(a.name)).join(t('、')) });
        try { w.dailyNews?.collectEvent?.('politics', `${t(Lw.council)}${t('改選開始')}${t('：')}${cands.length} ${t('人搶')} ${want} ${t('席')}`, 7, cands.slice(0, 3).map(a => a.name)); } catch (e) {}
        for (const a of cands) mem(w, a, inc.has(a.agentId) ? '我要爭取連任{member}。' : '我登記參選{member}了，希望大家支持。', { member: Lw.member }, 6);
        return A.elec;
    }
    function campaign(w, E) {
        const Lw = L(w), all = npcs(w);
        const cs = E.cands.map(c => w.agents[c.id]).filter(Boolean);
        for (const a of rnd(cs).slice(0, 2)) {
            const c = E.cands.find(x => x.id === a.agentId);
            log(w, 'council', '📣 {a}拉票：「{s}」', { a: a.name, s: { k: c.pitch, p: { council: Lw.council } } }, a.name);
            for (const v of rnd(all.filter(x => x !== a)).slice(0, 4)) { const same = (v.personality?.values || []).some(x => (a.personality?.values || []).includes(x)); if (same) v.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(3); }
        }
        // 買票:不老實又有點錢的候選人私下塞錢給窮人
        if (!w.wallet) return;
        for (const a of cs) {
            if (honest(a) > 1.8 || money(w, a) < 40 || Math.random() > 0.4) continue;
            const voters = rnd(all.filter(v => v !== a && money(w, v) < 30 && aff(v, a) > -30 && !E.cands.some(c => c.id === v.agentId))).slice(0, 1 + Math.floor(Math.random() * 3));
            let n = 0;
            for (const v of voters) {
                if (!WALLET.pay(w, a, v, 6)) break; n++;
                v.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(12); v.addThought?.('bribed', w, a.agentId, a.name);
                (E.bought || (E.bought = {}))[v.agentId] = a.agentId;
                mem(w, v, '{c}私下塞了 6 銀幣給我，要我在{member}選舉投他。', { c: a.name, member: Lw.member }, 5);
            }
            if (n) {
                R(w, a.agentId).bought += n;
                log(w, 'council', '💰 {a}私下塞錢給 {n} 個窮人，要他們投自己當{member}。🕵️', { a: a.name, n, member: Lw.member }, a.name);
                try { DARK.secret(w, { kind: 'kickback', day: day(w) - 10, culprit: a.agentId, victim: null, asm: 'buy', k: '{c}在{m}選舉時私下塞錢買票', p: { c: a.name, m: Lw.member } }); } catch (e) {}
            }
        }
    }
    function score(w, v, c, E) {
        if (v === c) return 100;
        let s = aff(v, c) / 25;
        s += (v.personality?.values || []).filter(x => (c.personality?.values || []).includes(x)).length * 0.8;
        const r = R(w, c.agentId);
        s += Math.max(-2, Math.min(2, (r.good - r.bad) * 0.5)) - r.exposed * 2.5;
        try { const tg = DARK.reputation(w, c); if (tg.includes('scheming')) s -= 1.5; if (tg.includes('honest')) s += 0.5; if (tg.includes('helpful')) s += 0.5; } catch (e) {}
        if (has(c, 'charismatic')) s += 1; s += (c.skills?.skills?.社交?.level || 0) * 0.3;
        if (E.cands.find(x => x.id === c.agentId)?.inc) s += 0.4;
        if (E.bought?.[v.agentId] === c.agentId) s += 1.5;
        return s + Math.random();
    }
    function tally(w, E) {
        const A = S(w), d = day(w), Lw = L(w), C = w.council;
        const cs = E.cands.map(c => w.agents[c.id]).filter(a => a && a.currentLocation !== 'exploration');
        if (cs.length <= E.seats) { A.elec = null; A.lastYear = E.year; return null; }
        const votes = {}; let turnout = 0, voters = 0;
        for (const v of npcs(w).filter(a => (a.age || 0) >= 16 && a.currentLocation !== 'exploration')) {
            voters++;
            const p = 0.82 + ((v.mood ?? 50) > 60 ? 0.08 : 0) - (has(v, 'lazy') ? 0.2 : 0) - ((v.mood ?? 50) < 25 ? 0.15 : 0);
            if (!cs.includes(v) && Math.random() > p) continue;
            turnout++;
            // 依好感程度抽一位(分數高的機率大,但不是全鎮都投同一人)
            let best = null;
            if (cs.includes(v)) best = v;
            else { const ws = cs.map(c => Math.exp(Math.max(-6, Math.min(6, score(w, v, c, E))))); let x = Math.random() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < cs.length; i++) { x -= ws[i]; if (x <= 0) { best = cs[i]; break; } } best = best || cs[cs.length - 1]; }
            votes[best.agentId] = (votes[best.agentId] || 0) + 1;
        }
        const ranked = cs.map(a => ({ id: a.agentId, name: a.name, votes: votes[a.agentId] || 0, inc: !!E.cands.find(x => x.id === a.agentId)?.inc, r: Math.random() })).sort((x, y) => y.votes - x.votes || y.r - x.r);
        const win = ranked.slice(0, E.seats), lose = ranked.slice(E.seats);
        const keepAway = (C.members || []).filter(id => !w.agents[id] && away(w).has(id));
        C.members = win.map(x => x.id).concat(keepAway);
        for (const x of win) { const r = R(w, x.id); if (!x.inc || r.since === null) { r.since = d; } r.terms++; x.won = true; }
        A.runners = lose.filter(x => x.votes > 0).map(x => x.id);
        for (const x of ranked) delete x.r;
        A.last = { year: E.year, day: d, seats: E.seats, turnout, voters, results: ranked };
        A.elections++; A.lastYear = E.year; A.elec = null;
        const fmt = (arr) => arr.map(x => `${t(x.name)}${t('（')}${x.votes}${t('）')}`).join(t('、'));
        log(w, 'council', '🗳️ {council}改選開票（投票率 {p}%）：{win} 當選。', { council: Lw.council, p: voters ? Math.round(turnout / voters * 100) : 0, win: fmt(win) });
        if (lose.length) log(w, 'council', '落選：{lose}。之後有人出缺，由落選者票數高的遞補。', { lose: fmt(lose) });
        try { w.dailyNews?.collectEvent?.('politics', `${t(Lw.council)}${t('改選')}${t('：')}${win.map(x => t(x.name)).join(t('、'))}${t('當選')}`, 8, win.slice(0, 3).map(x => x.name)); } catch (e) {}
        for (const x of win) { const a = w.agents[x.id]; if (!a) continue; a.moodModifier = (a.moodModifier || 0) + 6; mem(w, a, x.inc ? '我連任{member}了，拿到 {n} 票。' : '我選上{member}了！拿到 {n} 票。', { member: Lw.member, n: x.votes }, 7); }
        for (const x of lose) { const a = w.agents[x.id]; if (!a) continue; a.moodModifier = (a.moodModifier || 0) - 4; mem(w, a, x.inc ? '我沒能連任{member}，只拿到 {n} 票。' : '我沒選上{member}，只拿到 {n} 票。', { member: Lw.member, n: x.votes }, 6); }
        return A.last;
    }
    function daily(w) {
        const A = S(w), d = day(w); if (A._day === d) return; A._day = d;
        try { scanSecrets(w); } catch (e) { console.warn('[Assembly] secrets', e); }
        const C = w.council; if (!C?._formed) { if (A.elec) A.elec = null; return; }
        if (A.formedDay === null || A.formedDay === undefined) A.formedDay = d;
        const cl = w.clock; if (!cl) return;
        if (A.elec) {
            const E = A.elec;
            if (E.phase === 'campaign') { campaign(w, E); if (--E.left <= 0) E.phase = 'voting'; }
            else tally(w, E);
            return;
        }
        if (cl.season === '春季' && cl.day >= ELEC_DAY && cl.day <= ELEC_DAY + 3 && A.lastYear !== cl.year && !w.election?.active && npcs(w).length >= 6) {
            if (d - A.formedDay < 20) { A.lastYear = cl.year; return; } // 議會剛成立,明年再選
            start(w);
        }
    }
    // ---------- 出缺:落選者遞補 ----------
    function fillFromRunners(world) {
        const A = world.assembly; if (!this._formed || !A?.runners?.length) return 0;
        const aw = away(world), lid = leaderId(world), Lw = L(world);
        const present = (this.members || []).filter(id => world.agents[id] && !world.agents[id].isDead);
        const keep = (this.members || []).filter(id => !world.agents[id] && aw.has(id));
        const want = wantSeats(world); let n = 0;
        while (present.length + keep.length < want && A.runners.length) {
            const id = A.runners.shift(); const a = world.agents[id];
            if (!a || a.isDead || present.includes(id) || id === lid || a.currentLocation === 'exploration') continue;
            present.push(id); n++; const r = R(world, id); r.since = day(world); r.terms++;
            log(world, 'council', '🏛️ {name}是上次{council}改選票數最高的落選者，遞補空出來的席次。', { name: a.name, council: Lw.council }, a.name);
            mem(world, a, '有人出缺，我以上次落選第一高票遞補進{council}。', { council: Lw.council }, 7);
        }
        if (n) this.members = present.concat(keep);
        return n;
    }
    // ---------- 給介面 ----------
    function view(w) {
        const A = S(w); const E = A.elec; const Lw = L(w);
        const cl = w.clock; let next = null;
        if (!E && w.council?._formed) next = (A.lastYear === cl?.year || (cl?.season !== '春季')) ? '明年春季' : '今年春季';
        return { council: Lw.council, member: Lw.member, elec: E ? { phase: E.phase, left: E.left, seats: E.seats, cands: E.cands.map(c => ({ id: c.id, name: c.name, inc: c.inc, pitch: c.pitch })) } : null, last: A.last, next, runners: A.runners.map(id => w.agents[id]?.name).filter(Boolean) };
    }
    function recordText(w, a) {
        const r = w.assembly?.rec?.[a?.agentId]; if (!r) return '';
        const inC = (w.council?.members || []).includes(a.agentId); const Lw = L(w);
        const nv = r.nv ?? r.votes.length, sup = r.ns ?? r.votes.filter(x => x.v === 'for').length;
        const parts = [];
        if (inC) parts.push(r.since !== null && r.since !== undefined ? t('{m}，第 {n} 任（第 {d} 天起）').replace('{m}', t(Lw.member)).replace('{n}', Math.max(1, r.terms)).replace('{d}', r.since) : t(Lw.member));
        if (nv) parts.push(t('表決 {n} 件、支持 {s} 件').replace('{n}', nv).replace('{s}', sup));
        if (r.good || r.bad) parts.push(t('支持的案子成效好 {g}、差 {b}').replace('{g}', r.good).replace('{b}', r.bad));
        if (r.exposed) parts.push(t('醜聞 {n} 次').replace('{n}', r.exposed));
        return parts.join(t('；'));
    }
    function truthText(w, a) { // 上帝視角:收錢、買票(不管有沒有被揭穿)
        const r = w.assembly?.rec?.[a?.agentId]; if (!r) return '';
        const out = []; if (r.bribes) out.push(t('在議會收過 {n} 次錢').replace('{n}', r.bribes)); if (r.bought) out.push(t('選舉時買過 {n} 張票').replace('{n}', r.bought));
        return out.join(t('、'));
    }
    const WHY = { own: '自己的看法', public: '順著民意', pact: '私下交換條件 🕵️', bribe: '收了好處 🕵️' };
    return { S, R, isMajor, needs, seated, councilVote, onOutcome, scanSecrets, daily, start, tally, campaign, fillFromRunners, view, recordText, truthText, wantSeats, WHY };
})();

// ---- 掛進提案流程
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _mr = PS._mayorRule;
    PS._mayorRule = function (w, p, day, final) {
        try {
            if (!p.council && (p.status === 'open' || p.status === 'shelved') && ASSEMBLY.needs(w, p)) {
                const c = ASSEMBLY.councilVote(w, p, day);
                if (c && !c.pass) { p.mayorName = ''; p.mayorWhy = ''; this._decide(w, p, 'reject', 'council'); return; }
            }
        } catch (e) { console.warn('[Assembly] council', e); }
        return _mr.call(this, w, p, day, final);
    };
    const _d = PS._decide;
    PS._decide = function (w, p, action, by) {
        try {
            const C = p.council;
            if (by === 'mayor' && action === 'reject' && C?.pass) {
                const Lw = (typeof TIERS !== 'undefined') ? TIERS.LV[TIERS.level(w)] : { council: '鎮議會' };
                if (C.sup) {
                    p.veto = { name: p.mayorName || '', why: p.mayorWhy || '', over: true };
                    w.logMessageT?.('council', '⚔️ 鎮長{m}否決了{id}，但{council}以 {f}:{a} 超過三分之二推翻否決，提案照樣通過！', { m: p.mayorName || '', id: p.id, council: Lw.council, f: C.for, a: C.against }, p.mayorName || '');
                    try { w.dailyNews?.collectEvent?.('politics', `${t(Lw.council)}${t('推翻鎮長否決')}${t('：')}${p.id}`, 8, [p.mayorName].filter(Boolean)); } catch (e) {}
                    const m = Object.values(w.agents).find(a => a.name === p.mayorName);
                    if (m) { m.moodModifier = (m.moodModifier || 0) - 3; try { m.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '我否決了{id}，卻被{council}推翻了。', { id: p.id, council: Lw.council }, 6, []); } catch (e) {} for (const id of Object.keys(C.votes)) if (C.votes[id] === 'for') { try { m.relationships?.getOrCreate?.(id, w.agents[id]?.name || '')?.modifyAffinity?.(-3); } catch (e) {} } }
                    return _d.call(this, w, p, 'approve', 'override');
                }
                p.veto = { name: p.mayorName || '', why: p.mayorWhy || '', over: false };
            }
        } catch (e) { console.warn('[Assembly] veto', e); }
        const r = _d.call(this, w, p, action, by);
        if (by === 'council' && action === 'reject') p.result = '議會否決';
        else if (p.veto && !p.veto.over && action === 'reject' && by === 'mayor') p.result = '鎮長否決（議會未達三分之二，否決成立）';
        return r;
    };
    const _oc = PS._outcome;
    PS._outcome = function (w, p, day) { const r = _oc.call(this, w, p, day); try { ASSEMBLY.onOutcome(w, p); } catch (e) {} return r; };
    const _ti = PS.toItem;
    PS.toItem = function (w, p) {
        const it = _ti.call(this, w, p);
        try {
            const C = p.council;
            if (C) it.council = { for: C.for, against: C.against, n: C.n, pass: C.pass, sup: C.sup, list: Object.keys(C.votes).map(id => ({ id, name: C.names?.[id] || w.agents[id]?.name || '', v: C.votes[id], why: t(ASSEMBLY.WHY[C.why?.[id]] || '') })) };
            else if ((p.status === 'open' || p.status === 'shelved') && ASSEMBLY.needs(w, p)) it.needsCouncil = true;
            if (p.veto) it.veto = p.veto;
        } catch (e) {}
        return it;
    };
    // v6.82.1 政令(原本議會自己那一套固定清單)改由議員在提案頁提出
    const _cands = PS._candidates;
    PS._candidates = function (w, day, ...rest) {
        const out = _cands.call(this, w, day, ...rest);
        try {
            const seat = ASSEMBLY.seated(w), ms = new Set(seat.map(a => a.agentId));
            const free = seat.filter(a => (day - (this.proposerCooldown?.[a.agentId] ?? -99)) >= 5);
            if (ms.size && !free.length) return (out || []).filter(c => !(c && c.kind === 'policy' && String(c.key || '').startsWith('policy:'))); // 議員這幾天都提過案了,政令改天再提
            if (ms.size) {
                const mjobs = new Set([...ms].map(id => w.agents[id]?.job?.key).filter(Boolean));
                for (const c of out || []) if (c && c.kind === 'policy' && String(c.key || '').startsWith('policy:')) {
                    c.pred = (a) => ms.has(a.agentId);
                    c.jobs = (c.jobs || []).filter(j => mjobs.has(j)); // 沒有議員做這行時就不限職業,由任一位議員提
                }
            }
        } catch (e) {}
        return out;
    };
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) {
        const r = _daily.call(this, w, ...rest);
        try { if (w.observerMode) ASSEMBLY.daily(w); } catch (e) { console.warn('[Assembly] daily', e); }
        return r;
    };
}
// ---- 完整智能體:首長的 AI 也知道議會怎麼表決
if (typeof ConversationEngine !== 'undefined' && ConversationEngine.prototype.decideMayor) {
    const CE = ConversationEngine.prototype; const _dm = CE.decideMayor;
    CE.decideMayor = function (w, p, m, tally) {
        try {
            const C = p?.council;
            if (C && tally) { const Lw = TIERS.LV[TIERS.level(w)]; const s = `${t(Lw.council)} ${C.for}:${C.against} ${t('通過')}${C.sup ? t('（超過三分之二，否決會被推翻）') : ''}`; tally.forWhy = (tally.forWhy || []).concat([s]); }
        } catch (e) {}
        return _dm.call(this, w, p, m, tally);
    };
}
// ---- 議會:出缺先由落選者遞補;升格擴席時保留選上的議員
if (typeof CouncilSystem !== 'undefined') {
    const CS = CouncilSystem.prototype; const _du = CS.dailyUpdate, _f = CS._formCouncil;
    CS.dailyUpdate = function (world) {
        try { ASSEMBLY.fillFromRunners.call(this, world); } catch (e) { console.warn('[Assembly] fill', e); }
        if (world.observerMode && this.pendingProposal) this.pendingProposal = null; // v6.82.1 舊的議會自訂提案(要觀察者投票)不再跑;政令改走提案頁
        return _du.call(this, world);
    };
    const _gen = CS._generateProposal;
    CS._generateProposal = function (world) { if (world.observerMode) { this._daysSinceProposal = 0; return; } return _gen.call(this, world); };
    CS._formCouncil = function (world) {
        const A = world.assembly;
        if (!A?.elections || !(this.members || []).some(id => world.agents[id])) return _f.call(this, world);
        // 已經選過:保留現任,席次變多由落選者遞補(不夠的隔天照舊推舉),變少就把多的人排到遞補名單最前面
        const keep = this.members.filter(id => world.agents[id]); const want = ASSEMBLY.wantSeats(world);
        if (keep.length > want) { const out = keep.splice(want); A.runners = out.concat(A.runners || []); }
        this.members = keep; this._formed = true;
        try { ASSEMBLY.fillFromRunners.call(this, world); } catch (e) {}
    };
}
// ---- 存讀檔
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.assembly = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.assembly) d.assembly = this.assembly; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.assembly = (data?.assembly && typeof data.assembly.rec === 'object') ? data.assembly : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.ASSEMBLY = ASSEMBLY;
