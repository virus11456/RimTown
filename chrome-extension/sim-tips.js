// v11.0.0 市場與第四權（第一段）之二：第四權——線索箱、記者自己選題、查證、被查的人怎麼反應、登不登、讀者信不信
// - 線索從哪來：有人爆料或投訴（sim-decide-deal.js）、記者自己身為居民看到或聽到的、公開的數字（壓薪、驅逐、銀行，原本由系統每週擲骰挑，現在只是線索）。
// - 記者自己選題（tipPick）→ 去問知道內情的人，對方自己決定說不說（tipAsked）→ 查了兩天，被查的人聽到風聲、自己決定怎麼辦（tipTarget：
//   道歉、悄悄改掉、塞錢給記者、找報社老闆、找首長、威脅告誹謗、不理）→ 第三天記者決定登不登（tipPrint：照登、淡化、撤稿、轉給別家）。
// - 登出來以後，訂這份報的人信幾分看報社信譽、證據、跟當事人的交情；信的人知道了這件事，自己決定怎麼辦（dealRead），之後幾天會講給別人聽。
// - 塞錢、施壓本身也是一件「有人做、有人知道」的事，會回到線索箱。
// 必須在 sim-decide-deal.js 之後載入。這一組用 'deal' 那份每日 AI 額度。
'use strict';
const TIPS = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined' || typeof DEALASK === 'undefined' || !DEALASK || typeof PRESS === 'undefined') return null;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1, G = 'deal', DIG = 3, HEAR = 2, STALE = 10, IDLE = 4;
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const live = (w, id) => { const a = w.agents[id]; return a && !a.isDead ? a : null; };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w) && papers(w).length > 0; } catch (e) { return false; } }; // 鎮上要有會登新聞的報社和記者（公告欄、官報不算）
    function S(w) {
        if (!w.tips || typeof w.tips !== 'object') w.tips = { box: [], n: 0, cases: {}, done: [], last: {}, spread: {}, lastDay: null, st: { picked: 0, printed: 0, soft: 0, killed: 0, bribed: 0, pressed: 0, passed: 0, fired: 0 } };
        const T = w.tips; T.box = T.box || []; T.cases = T.cases || {}; T.done = T.done || []; T.last = T.last || {}; T.spread = T.spread || {}; T.st = T.st || {}; return T;
    }
    const papers = (w) => (w.press?.papers || []).filter(P => !P.banned && P.st !== 'board' && P.st !== 'crown' && live(w, P.journo));
    const paper = (w, pid) => (w.press?.papers || []).find(P => P.id === pid) || null;
    const tipOf = (w, id) => S(w).box.find(x => x.id === id) || null;
    const owedTo = (w, pol, donor) => { try { return (typeof POWER !== 'undefined' && POWER.S(w).inf[pol.agentId]?.[donor.agentId]) || 0; } catch (e) { return 0; } }; // 這位金主前後給過這位官員多少
    const mayor = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    // 一條線索用一句話講
    function tipText(w, x) {
        if (x.fid) { const f = DEAL.factOf(w, x.fid); return f ? DEALASK.factText(w, f) : { raw: '' }; }
        const o = w.agents[x.about]?.name || '';
        return x.type === 'secret' ? { k: '{o}有事瞞著大家', p: { o } } : x.type === 'wage' ? { k: '{o}把工資壓得很低', p: { o } } : x.type === 'evict' ? '最近有好幾戶人家被趕出去' : x.type === 'bank' ? '銀行的準備金恐怕不夠' : x.type === 'bribe' ? { k: '{o}想用錢擺平報導', p: { o } } : x.type === 'cover' ? { k: '{o}出面要報社別登', p: { o } } : { raw: '' };
    }
    const srcText = (w, x) => (x.src === 'anon' ? '匿名來信' : x.src === 'self' ? '你自己看到的' : x.src === 'public' ? '公開的數字' : x.src === 'pass' ? '別家報社轉來的' : { k: '{a}來說的', p: { a: w.agents[x.by]?.name || '' } });
    function add(w, o) { const T = S(w); const x = Object.assign({ id: 'L' + (++T.n), d: day(w), st: 'new' }, o); T.box.push(x); if (T.box.length > 40) { const i = T.box.findIndex(y => y.st !== 'working'); T.box.splice(i >= 0 ? i : 0, 1); } return x; }
    // ---------- 線索進箱 ----------
    function gather(w, T, d) {
        const D = DEALASK.S(w);
        for (const x of D.tips) { if (x.in) continue; x.in = 1; const dup = T.box.find(y => y.fid === x.fid && y.st !== 'dropped'); if (dup) { dup.more = (dup.more || 0) + 1; continue; } add(w, { src: x.anon ? 'anon' : 'tip', by: x.by, about: x.about, fid: x.fid }); }
        try { if (typeof POWER !== 'undefined') for (const tp of POWER.topics(w)) { const key = tp.type + ':' + (tp.s?.id || tp.k || ''); if (T.box.some(y => y.topic === key && d - y.d < 30)) continue; add(w, { src: 'public', topic: key, type: tp.type, about: tp.ids?.[0] || null }); } } catch (e) {}
        for (const P of papers(w)) { const J = w.agents[P.journo]; for (const f of DEAL.knownBy(w, J)) { if (f.end != null || f.pub || (f.kind === 'hike' && (f.lv || 0) < 0.3)) continue; if (T.box.some(y => y.fid === f.id && y.st !== 'dropped')) continue; add(w, { src: 'self', by: J.agentId, about: f.by, fid: f.id }); } }
        for (const x of T.box) if (x.st === 'new' && d - x.d > 45) x.st = 'dropped';
    }
    const fresh = (w, T) => T.box.filter(x => x.st === 'new' && x.d <= day(w) && (!x.about || live(w, x.about)) && (!x.fid || (DEAL.factOf(w, x.fid) && !DEAL.factOf(w, x.fid).pub)));
    const level = (C) => (C.ev >= 2 ? 2 : C.ev >= 1 ? 1 : 0);
    const LV = ['還只有傳聞', '有人證', '有鐵證'];
    const note = (C, k, p) => { C.log.push({ d: C._d, k, p: p || {} }); };
    function close(w, T, P, C, out) { const x = tipOf(w, C.tid); if (x && x.st === 'working') x.st = out === 'pass' ? 'new' : out === 'print' || out === 'soft' ? 'printed' : 'dropped'; T.done.push({ pid: P.id, paper: P.name, tid: C.tid, text: x ? tipText(w, x) : { raw: '' }, about: x?.about || null, out, d: day(w), lv: level(C), log: C.log.slice(-12) }); if (T.done.length > 12) T.done.shift(); delete T.cases[P.id]; }
    // ---------- 每天 ----------
    function daily(w) {
        if (!on(w)) return; const T = S(w), d = day(w); if (T.lastDay === d) return; T.lastDay = d;
        gather(w, T, d);
        for (const P of papers(w)) {
            const J = w.agents[P.journo]; let C = T.cases[P.id];
            if (C && C.j !== J.agentId) { close(w, T, P, C, 'drop'); C = null; }
            if (!C) { const c = fresh(w, T).filter(x => x.about !== J.agentId); if (c.length && d - (T.last[P.id] ?? -99) >= IDLE) { T.last[P.id] = d; c.sort((x, y) => juicy(w, y) - juicy(w, x)); DECIDE.enqueue(w, J, 'tipPick', { pid: P.id, ids: c.slice(0, 3).map(x => x.id) }); } continue; }
            C._d = d; const x = tipOf(w, C.tid); const f = x?.fid ? DEAL.factOf(w, x.fid) : null; const target = live(w, x?.about);
            if (!x || d - C.d0 > STALE) { close(w, T, P, C, 'drop'); continue; }
            if (f) { let n = 0; for (const a of DEAL.knowers(w, f)) { if (n >= 2) break; if (a === J || C.asked[a.agentId]) continue; C.asked[a.agentId] = 1; n++; DECIDE.enqueue(w, a, 'tipAsked', { pid: P.id, tid: x.id }); } }
            if (!C.heard && d - C.d0 >= HEAR && target && target !== J) { C.heard = true; DECIDE.enqueue(w, target, 'tipTarget', { pid: P.id, tid: x.id }); }
            if (!C.printAsk && d - C.d0 >= DIG) { C.printAsk = true; DECIDE.enqueue(w, J, 'tipPrint', { pid: P.id, tid: x.id }); }
        }
        // 讀到的人這幾天會講給別人聽
        for (const [fid, sp] of Object.entries(T.spread)) { const f = DEAL.factOf(w, fid); if (!f || d > sp.until) { delete T.spread[fid]; continue; } for (const a of DEAL.knowers(w, f)) if (f.knows[a.agentId] === 'read' && Math.random() < 0.25) DEALASK.tell(w, a, f, 1); }
        try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) {}
    }
    // 這條線索有多值得查（給排序用；記者自己怎麼選是他的決定）
    function juicy(w, x) { const f = x.fid ? DEAL.factOf(w, x.fid) : null; return (f ? (f.dead || 0) * 5 + (f.harm || 0) + (f.kind === 'cut' ? 2 : f.kind === 'pact' ? 2 : (f.lv || 0) * 3) : x.type === 'secret' ? 3 : 1.5) + (x.more || 0) * 0.5; }
    function start(w, P, J, x, rush) {
        const T = S(w); x.st = 'working'; x.paper = P.id; T.st.picked = (T.st.picked || 0) + 1;
        const C = T.cases[P.id] = { tid: x.id, pid: P.id, j: J.agentId, d0: day(w), _d: day(w), ev: x.src === 'public' ? 2 : x.src === 'self' ? 0.5 : x.src === 'tip' ? 0.5 : 0.3, asked: {}, heard: false, printAsk: false, log: [] };
        if (x.src === 'pass') C.ev = Math.max(C.ev, x.ev || 0);
        if (x.type === 'cover' || (x.fid && DEAL.factOf(w, x.fid)?.open)) C.ev = 2; // 價錢是公開的、首長來打招呼是記者親身碰到的：不用再找人證
        note(C, '{j}決定查這件事：{x}（{src}）', { j: J.name, x: tipText(w, x), src: srcText(w, x) });
        if (rush) { C.rush = true; print(w, P, J, C, false); }
        return C;
    }
    // ---------- 登出來 ----------
    function print(w, P, J, C, soft) {
        const T = S(w), d = day(w); const x = tipOf(w, C.tid); if (!x) return close(w, T, P, C, 'drop'); const lv = level(C); const target = live(w, x.about);
        const f = x.fid ? DEAL.factOf(w, x.fid) : null;
        if (!f && x.type === 'cover') { // 首長出面護航：登出來，相信的讀者對首長的印象變差
            if (soft || !target) return close(w, T, P, C, soft ? 'soft' : 'drop'); const R0 = w.press; let n = 0;
            PRESS.story(w, P, 'expose', '調查報導：{x}', { x: tipText(w, x) }, target.agentId, { by: J.agentId, ev: 2 });
            for (const a of npcs(w)) { if (R0.reads[a.agentId] !== P.id || a === target || a === J) continue; if (Math.random() >= PRESS.trust(w, a, P) * (aff(a, target) >= 40 ? 0.5 : 1)) continue; n++; rel(a, target)?.modifyAffinity?.(-8); a.addThought?.('outraged', w); }
            try { const PW = POWER.S(w); PW.scandal[target.agentId] = (PW.scandal[target.agentId] || 0) + 1; } catch (e) {}
            const cf = x.cover ? DEAL.factOf(w, x.cover) : null; if (cf) cf.pub = d; P.cred = clampN(P.cred + 2, 15, 95); T.st.printed = (T.st.printed || 0) + 1; note(C, '{paper}登出來了（{lv}），{n} 個讀者相信', { paper: P.name[0], lv: LV[2], n }); mem(w, target, '{paper}把我的事登出來了。', { paper: P.name[0] }, 8);
            return close(w, T, P, C, 'print');
        }
        if (!f) { // 公開數字與祕密：沿用原本的後果
            try { const tp = POWER.topics(w).find(y => y.type + ':' + (y.s?.id || y.k || '') === x.topic); if (tp) { POWER.publish(w, P, J, tp, d); T.st.printed = (T.st.printed || 0) + 1; note(C, '{paper}登出來了', { paper: P.name[0] }); return close(w, T, P, C, 'print'); } } catch (e) { console.warn('[Tips] publish', e); }
            return close(w, T, P, C, 'drop');
        }
        const txt = DEALASK.factText(w, f); const R = w.press; let believed = 0; const who = [];
        if (soft) { PRESS.story(w, P, 'critic', '聽說{s}最近有些事，本報還在查證', { s: DEAL.sname(f.key) }, null, { by: J.agentId, fid: f.id, soft: true }); T.st.soft = (T.st.soft || 0) + 1; note(C, '{paper}只登了一小段，沒有指名道姓', { paper: P.name[0] }); if (target) for (const a of npcs(w)) if (R.reads[a.agentId] === P.id && a !== target && PRESS.trust(w, a, P) >= 0.6) rel(a, target)?.modifyAffinity?.(-1); return close(w, T, P, C, 'soft'); }
        PRESS.story(w, P, 'expose', C.sorry ? '調查報導：{x}。當事人已經道歉' : C.bribeTried ? '調查報導：{x}。當事人還想塞錢擺平' : '調查報導：{x}', { x: txt }, f.by, { by: J.agentId, fid: f.id, ev: lv });
        const hit = (f.kind === 'hike' ? 4 : f.dead ? 14 : 8) * (C.sorry ? 0.4 : 1) + (C.bribeTried ? 3 : 0);
        for (const a of npcs(w)) { if (R.reads[a.agentId] !== P.id || a === target || a === J) continue;
            const b = PRESS.trust(w, a, P) * [0.45, 0.75, 1][lv] * (target && aff(a, target) >= 40 ? 0.5 : 1); if (Math.random() >= b) continue;
            believed++; who.push(a); DEAL.learn(w, f, a, 'read'); if (target) rel(a, target)?.modifyAffinity?.(-Math.round(hit)); if (f.kind !== 'hike') a.addThought?.('outraged', w); }
        f.pub = d; try { DEAL.F(w, f.key).caught = d; } catch (e) {}
        if (f.dead) for (const dd of (DEAL.S(w).deaths || [])) if (dd.fid === f.id) dd.linked = true;
        P.cred = clampN(P.cred + (lv === 2 ? 2 : lv === 1 ? 0 : -2), 15, 95); P.fame = (P.fame || 0) + 1; T.st.printed = (T.st.printed || 0) + 1; T.spread[f.id] = { until: d + 3 };
        note(C, '{paper}登出來了（{lv}），{n} 個讀者相信', { paper: P.name[0], lv: LV[lv], n: believed });
        // 相信的讀者自己決定怎麼辦：出過事的先問，最多五位
        const D = DEAL.S(w); const hurt = new Set(D.harm.filter(h => h.key === f.key).map(h => h.id)); who.sort((a, b) => (hurt.has(b.agentId) ? 1 : 0) - (hurt.has(a.agentId) ? 1 : 0));
        for (const a of who.slice(0, 5)) DECIDE.enqueue(w, a, 'dealRead', { fid: f.id, pid: P.id });
        if (target) mem(w, target, '{paper}把我的事登出來了。', { paper: P.name[0] }, 8);
        close(w, T, P, C, 'print');
    }

    // ================= 記者選題 =================
    DECIDE.kind('tipPick', {
        title: '這禮拜查哪一件', scan: false, pri: 1.3, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const list = (c.ids || []).map(id => tipOf(w, id)).filter(x => x && x.st === 'new'); if (!P || !list.length) return '';
            const own = live(w, P.owner);
            return fill('你是{paper}的記者。手上有這幾條線索：{list}{own}查一件事要花好幾天，會得罪人；不查，知道的人就只有那幾個。', { paper: P.name[0], own: own ? { k: '報社老闆是{o}。', p: { o: own.name } } : { raw: '' },
                list: { raw: list.map((x, i) => fill('（{i}）{x}（{src}{more}）{rel}', { i: i + 1, x: tipText(w, x), src: srcText(w, x), more: x.more ? { k: '，另外還有 {n} 人來說', p: { n: x.more } } : { raw: '' }, rel: relText(w, a, P, x) })).join('') } }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); if (!P || P.journo !== a.agentId || T.cases[P.id]) return []; const list = (c.ids || []).map(id => tipOf(w, id)).filter(x => x && x.st === 'new'); if (!list.length) return [];
            const keen = (has(a, 'perfectionist') ? 1.4 : 1) * (has(a, 'lazy') ? 0.5 : 1);
            const out = [{ id: 'none', quiet: true, mute: true, text: '這禮拜都不碰', say: '沒有去查', why: '這些事查下去只會得罪人', base: REF, lean: { safe: 0.3 }, run: () => null }];
            for (const x of list) { const o = live(w, x.about); const cap = o && typeof POWER !== 'undefined' && POWER.captured(w, P, [o.agentId]); const j = juicy(w, x);
                out.push({ id: 'go:' + x.id, text: { k: '去查：{x}', p: { x: tipText(w, x) } }, say: { k: '開始查{x}', p: { x: tipText(w, x) } }, why: '這件事大家應該知道',
                    base: REF + tilt(clampN(0.25 * keen * (1 + Math.min(2, j / 4)) * (o && aff(a, o) >= 40 ? 0.3 : 1) * (o && aff(a, o) <= -20 ? 1.5 : 1) * (cap ? 0.5 : 1), 0.02, 0.92)), lean: { face: 0.3, safe: -0.3 },
                    run: (w2, a2) => { start(w2, P, a2, x, false); return { k: '開始查了' }; } });
                if (x.fid && has(a, 'gossip')) out.push({ id: 'rush:' + x.id, text: { k: '不查了，先登再說：{x}', p: { x: tipText(w, x) } }, say: { k: '沒查證就登了{x}', p: { x: tipText(w, x) } }, why: '這種事登出來就有人看',
                    base: REF + tilt(clampN(0.1 * (1 + Math.min(1, j / 6)), 0.01, 0.5)), lean: { face: 0.2, safe: -0.4 }, run: (w2, a2) => { start(w2, P, a2, x, true); return { k: '直接登了' }; } }); }
            return out;
        },
    });
    function relText(w, J, P, x) { const o = live(w, x.about); if (!o) return { raw: '' }; const v = aff(J, o); const cap = typeof POWER !== 'undefined' && POWER.captured(w, P, [o.agentId]);
        return { k: '你跟{o}{r}{c}。', p: { o: o.name, r: v >= 40 ? '交情不錯' : v <= -20 ? '有些過節' : '沒什麼交情', c: cap ? '，他跟報社老闆有往來' : { raw: '' } } }; }

    // ================= 記者來問你 =================
    DECIDE.kind('tipAsked', {
        title: '記者來問你知道的事', scan: false, pri: 1.2, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const x = tipOf(w, c.tid); const f = x?.fid ? DEAL.factOf(w, x.fid) : null; const J = live(w, P?.journo); if (!f || !J) return ''; const how = f.knows[a.agentId];
            return fill('{paper}的記者{j}來問你：{x}，是不是真的。{how}說了，這件事可能登上報；被{o}知道是你說的，他不會放過你。', { paper: P.name[0], j: J.name, x: DEALASK.factText(w, f), o: w.agents[f.by]?.name || '',
                how: how === 'staff' ? '你在那裡做事，內情你最清楚。' : how === 'party' ? '這件事你就是當事人之一。' : how === 'victim' ? '你自己出過事。' : '這件事你是聽別人說的。' }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const x = tipOf(w, c.tid); const f = x?.fid ? DEAL.factOf(w, x.fid) : null; const J = live(w, P?.journo); const o = live(w, f?.by); if (!C || C.tid !== c.tid || !f || !J || !o) return [];
            const how = f.knows[a.agentId]; const w8 = how === 'staff' || how === 'party' ? 1 : how === 'victim' ? 0.5 : 0.3; const hon = honesty(a); const paid = DEALASK.S(w).hush[a.agentId + '|' + f.id] ? 0.3 : 1; const mad = DEALASK.S(w).angry?.[a.agentId + '|' + f.id] ? 2 : 1;
            const tell = (anon) => (w2, a2) => { C.ev += w8 * (anon ? 0.7 : 1); note(C, anon ? '有人不具名證實了' : '{a}證實了', { a: a2.name }); if (!anon) mem(w2, a2, '我把{s}的事告訴了記者{j}。', { s: DEAL.sname(f.key), j: J.name }, 6); return { k: '說了' }; };
            const out = [
                { id: 'no', quiet: true, mute: true, text: '不說，請他別再來問', say: '什麼都沒跟記者說', why: '這種事我不想沾', base: REF + (how === 'staff' ? 0.3 : 0), lean: { safe: 0.4 }, run: () => { note(C, '有人不願意說'); return null; } },
                { id: 'talk', quiet: true, text: '照實說，可以寫我的名字', say: { k: '把知道的告訴了記者{j}', p: { j: J.name } }, why: '事情是真的，沒什麼不能說', base: REF + tilt(clampN(0.2 * (hon >= 4 ? 2 : hon <= 1.5 ? 0.5 : 1) * mad * paid * (aff(a, o) >= 40 ? 0.3 : 1) * (how === 'staff' ? 0.5 : 1), 0.01, 0.9)), lean: { face: 0.3, safe: -0.4 }, run: tell(false) },
                { id: 'anon', quiet: true, mute: true, text: '說，但不能寫是我說的', say: '私下跟記者說了一些', why: '該讓人知道，可是我得保住飯碗', base: REF + tilt(clampN(0.35 * (hon >= 4 ? 1.5 : 1) * mad * paid * (aff(a, o) >= 40 ? 0.4 : 1), 0.02, 0.9)), lean: { bond: 0.1, safe: -0.1 }, run: tell(true) },
            ];
            if (cash(w, J) >= 30) out.push({ id: 'money', quiet: true, mute: true, text: '要 8 銀幣才說', say: '跟記者要了點錢才開口', why: '我冒了險，總不能白說', base: REF + tilt(clampN(0.08 * (has(a, 'greedy') ? 3 : 1) * (hon >= 4 ? 0.2 : 1), 0.004, 0.6)), lean: { gain: 0.4, face: -0.2 },
                run: (w2, a2) => { if (!WALLET.pay(w2, J, a2, 8)) return null; C.ev += w8 * 0.7; note(C, '花錢買到一個不具名的說法'); return { k: '收了錢才說' }; } });
            return out;
        },
    });

    // ================= 被查的人聽到風聲 =================
    DECIDE.kind('tipTarget', {
        title: '記者在查你', scan: false, pri: 1.8, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const x = tipOf(w, c.tid); const J = live(w, P?.journo); const C = S(w).cases[c.pid]; if (!x || !J || !C) return ''; const own = live(w, P.owner); const M = mayor(w);
            return fill('你聽到風聲：{paper}的記者{j}在查{x}，已經問了 {n} 個人。你手上有 {c} 銀幣。{own}{m}', { paper: P.name[0], j: J.name, x: tipText(w, x), n: Object.keys(C.asked).length, c: Math.floor(cash(w, a)),
                own: own && own !== a ? { k: '報社老闆是{o}（你跟他{r}）。', p: { o: own.name, r: aff(a, own) >= 30 ? '彼此有交情' : '不熟' } } : { raw: '' }, m: M && M !== a ? { k: '現任首長是{o}（你跟他{r}）。', p: { o: M.name, r: owedTo(w, M, a) >= 20 ? '有金錢往來' : aff(a, M) >= 30 ? '彼此有交情' : '不熟' } } : { raw: '' } }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const x = tipOf(w, c.tid); const J = live(w, P?.journo); if (!C || C.tid !== c.tid || !x || !J || x.about !== a.agentId) return [];
            const f = x.fid ? DEAL.factOf(w, x.fid) : null; const soft = has(a, 'kind') || has(a, 'generous'), hard = has(a, 'abrasive') || has(a, 'greedy'); const own = live(w, P.owner); const M = mayor(w); const n = clampN(Math.round(cash(w, a) * 0.08), 10, 60);
            const out = [{ id: 'ignore', quiet: true, mute: true, text: '不理他', say: '沒有理會記者', why: '他沒有證據，登不出什麼', base: REF, lean: { safe: 0.1 }, run: () => { note(C, '{o}不理會', { o: a.name }); return null; } }];
            if (f && f.end == null) {
                out.push({ id: 'sorry', text: '公開道歉、賠錢給出事的人，把做法改回來', say: '公開道歉並改過', why: '與其被登出來，不如自己先認', base: REF + tilt(clampN(0.1 * (soft ? 2.5 : 1) * (hard ? 0.3 : 1) * (f.dead ? 1.5 : 1), 0.01, 0.8)), lean: { bond: 0.4, face: -0.2, gain: -0.4 },
                    run: (w2, a2) => { const D = DEAL.S(w2); const vs = [...new Set(D.harm.filter(h => h.key === f.key && !h.dead).map(h => h.id))].map(id => live(w2, id)).filter(Boolean).slice(0, 6); let paid = 0; for (const v of vs) { const m = Math.min(8, Math.floor(cash(w2, a2) / (vs.length + 1))); if (m > 0 && WALLET.pay(w2, a2, v, m)) { paid += m; rel(v, a2)?.modifyAffinity?.(6); } }
                        DEAL.setCut(w2, f.key, 0); DEAL.setUp(w2, f.key, 0); C.sorry = true; note(C, '{o}公開道歉，賠了 {n} 銀幣', { o: a2.name, n: paid }); log(w2, '🙇 {o}為{s}的事公開道歉，答應改過。', { o: a2.name, s: DEAL.sname(f.key) }, a2.name); return { k: '道歉並賠了 {n} 銀幣', p: { n: paid } }; } });
                if (f.kind !== 'pact') out.push({ id: 'fix', quiet: true, mute: true, text: '什麼都不說，悄悄把做法改回來', say: '悄悄改了回來', why: '改掉了，他就查不到現在的事', base: REF + tilt(clampN(0.2 * (hard ? 0.6 : 1), 0.02, 0.8)), lean: { safe: 0.3, gain: -0.2 },
                    run: (w2, a2) => { DEAL.setCut(w2, f.key, 0); if (f.kind === 'hike') DEAL.setUp(w2, f.key, 0); note(C, '{o}悄悄改了回來', { o: a2.name }); return { k: '悄悄改回來' }; } });
            }
            if (cash(w, a) >= n + 20) out.push({ id: 'bribe', quiet: true, mute: true, text: { k: '塞 {n} 銀幣給記者，請他別登', p: { n } }, say: '私下去找了記者', why: '花錢消災', base: REF + tilt(clampN(0.15 * (hard ? 2 : 1) * (soft ? 0.5 : 1) * (honesty(a) >= 4 ? 0.2 : 1), 0.01, 0.8)), lean: { gain: -0.1, safe: -0.2 },
                run: (w2, a2) => { DECIDE.enqueue(w2, J, 'tipBribe', { pid: P.id, tid: x.id, by: a2.agentId, n }); return { k: '去找記者了' }; } });
            if (own && own !== a) out.push({ id: 'boss', quiet: true, mute: true, text: { k: '去找報社老闆{o}，請他把稿子壓下來', p: { o: own.name } }, say: { k: '去找了{o}', p: { o: own.name } }, why: '記者也得聽老闆的', base: REF + tilt(clampN(0.12 * (aff(a, own) >= 30 ? 2.5 : 1) * (hard ? 1.5 : 1), 0.01, 0.8)), lean: { safe: -0.1 },
                run: (w2, a2) => { DECIDE.enqueue(w2, own, 'tipOwner', { pid: P.id, tid: x.id, by: a2.agentId }); return { k: '去找報社老闆了' }; } });
            if (M && M !== a && M !== J) { const owed = owedTo(w, M, a); out.push({ id: 'mayor', quiet: true, mute: true, text: { k: '去找{o}，請他出面叫報社別登', p: { o: M.name } }, say: { k: '去找了{o}', p: { o: M.name } }, why: '平常沒少照顧他，該他幫忙了',
                base: REF + tilt(clampN(0.06 * (owed >= 20 ? 4 : 1) * (aff(a, M) >= 30 ? 2 : 1), 0.004, 0.8)), lean: { safe: -0.1 }, run: (w2, a2) => { DECIDE.enqueue(w2, M, 'tipMayor', { pid: P.id, tid: x.id, by: a2.agentId }); return { k: '去找首長了' }; } }); }
            out.push({ id: 'libel', text: '放話：敢亂登就告他誹謗', say: '放話要告記者誹謗', why: '嚇一嚇，他就不敢亂寫', base: REF + tilt(clampN(0.12 * (hard ? 2 : 1) * (soft ? 0.4 : 1), 0.01, 0.7)), lean: { face: 0.2, bond: -0.2 },
                run: (w2, a2) => { C.libel = true; rel(J, a2)?.modifyAffinity?.(-6); note(C, '{o}放話要告誹謗', { o: a2.name }); return { k: '放話了' }; } });
            return out;
        },
    });

    // ================= 有人塞錢給記者 =================
    DECIDE.kind('tipBribe', {
        title: '有人塞錢請你別登', scan: false, pri: 1.9, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = live(w, c.by); const x = tipOf(w, c.tid); if (!o || !x) return ''; return fill('{o}私下來找你，拿出 {n} 銀幣，請你別再查{x}。你身上有 {c} 銀幣。收了，這件事就到此為止；這筆錢要是被人知道，你也完了。', { o: o.name, n: c.n, x: tipText(w, x), c: Math.floor(cash(w, a)) }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const o = live(w, c.by); const x = tipOf(w, c.tid); if (!C || C.tid !== c.tid || !o || !x || P?.journo !== a.agentId) return []; const hon = honesty(a);
            return [
                { id: 'refuse', quiet: true, text: '不收', say: { k: '沒有收{o}的錢', p: { o: o.name } }, why: '收了這個錢，我以後寫的東西就沒人信了', base: REF + (hon >= 4 ? 0.6 : 0), lean: { face: 0.3 }, run: () => { rel(o, a)?.modifyAffinity?.(-6); note(C, '{o}想塞錢，記者沒收', { o: o.name }); return null; } },
                { id: 'take', quiet: true, mute: true, text: { k: '收下 {n} 銀幣，不登了', p: { n: c.n } }, say: '收了一筆錢', why: '查下去也是得罪人，不如拿錢', base: REF + tilt(clampN(0.2 * (has(a, 'greedy') ? 2.5 : 1) * (hon >= 4 ? 0.1 : hon <= 1.5 ? 2 : 1) * (cash(w, a) < 30 ? 1.6 : 1), 0.004, 0.85)), lean: { gain: 0.5, face: -0.4 },
                    run: (w2, a2) => { if (!WALLET.pay(w2, o, a2, c.n)) return null; C.kill = 'bribe'; T.st.bribed = (T.st.bribed || 0) + 1; const f = DEAL.fact(w2, { kind: 'bribe', key: x.fid ? DEAL.factOf(w2, x.fid)?.key : null, by: o.agentId, with: a2.agentId, lv: c.n }); DEAL.learn(w2, f, a2, 'party'); try { DARK.secret(w2, { kind: 'cover', culprit: o.agentId, victim: null, k: '{o}塞錢給記者{j}，把一則報導壓了下來', p: { o: o.name, j: a2.name } }); } catch (e) {} note(C, '記者收了 {n} 銀幣', { n: c.n }); return { k: '收了 {n} 銀幣', p: { n: c.n } }; } },
                { id: 'expose', text: '不收，還要把他塞錢的事一起寫進去', say: { k: '沒有收{o}的錢，還記了一筆', p: { o: o.name } }, why: '想用錢擺平，這本身就是新聞', base: REF + tilt(clampN(0.15 * (hon >= 4 ? 2.5 : 1) * (has(a, 'perfectionist') ? 1.5 : 1), 0.01, 0.8)), lean: { face: 0.5, safe: -0.3 },
                    run: () => { C.bribeTried = true; C.ev += 0.5; rel(o, a)?.modifyAffinity?.(-12); note(C, '{o}想塞錢，記者要把這件事也寫進去', { o: o.name }); return { k: '記下來了' }; } },
            ];
        },
    });

    // ================= 有人找報社老闆壓稿 =================
    DECIDE.kind('tipOwner', {
        title: '有人請你把稿子壓下來', scan: false, pri: 1.7, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const o = live(w, c.by); const x = tipOf(w, c.tid); const J = live(w, P?.journo); if (!o || !x || !J) return ''; return fill('你是{paper}的老闆。{o}來找你，說你的記者{j}在查{x}，請你把稿子壓下來。壓了，報社的名聲會受損；不壓，就得罪{o}。', { paper: P.name[0], o: o.name, j: J.name, x: tipText(w, x) }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const o = live(w, c.by); if (!C || C.tid !== c.tid || !o || P?.owner !== a.agentId) return []; const cap = typeof POWER !== 'undefined' && POWER.captured(w, P, [o.agentId]);
            return [
                { id: 'let', quiet: true, text: '不管，讓記者自己決定', say: { k: '沒有答應{o}', p: { o: o.name } }, why: '報紙要有人信才賣得出去', base: REF + (has(a, 'perfectionist') ? 0.4 : 0), lean: { face: 0.3 }, run: () => { rel(o, a)?.modifyAffinity?.(-6); note(C, '報社老闆{b}沒有答應壓稿', { b: a.name }); return null; } },
                { id: 'kill', quiet: true, mute: true, text: '叫記者別登', say: '交代記者把一則稿子壓下來', why: '沒必要為了一則新聞得罪人', base: REF + tilt(clampN(0.25 * (cap ? 2.5 : 1) * (aff(a, o) >= 30 ? 1.8 : 1) * (honesty(a) >= 4 ? 0.4 : 1), 0.02, 0.92)), lean: { safe: 0.3, face: -0.3 },
                    run: (w2, a2) => { C.ownerKill = true; T.st.pressed = (T.st.pressed || 0) + 1; rel(o, a2)?.modifyAffinity?.(5); note(C, '報社老闆{b}叫記者別登', { b: a2.name }); return { k: '叫記者別登' }; } },
            ];
        },
    });

    // ================= 有人找首長出面 =================
    DECIDE.kind('tipMayor', {
        title: '有人請你出面叫報社別登', scan: false, pri: 1.7, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const o = live(w, c.by); const x = tipOf(w, c.tid); if (!o || !x || !P) return ''; const owed = owedTo(w, a, o);
            return fill('{o}來找你：{paper}在查{x}，請你出面叫報社別登。{owed}出面，這件事要是傳出去，大家會說你護著他；不出面，就得罪{o}。', { o: o.name, paper: P.name[0], x: tipText(w, x), owed: owed >= 20 ? { k: '他前後給過你 {n} 銀幣。', p: { n: Math.round(owed) } } : { raw: '' } }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const o = live(w, c.by); const J = live(w, P?.journo); const x = tipOf(w, c.tid); if (!C || C.tid !== c.tid || !o || !J || !x || mayor(w) !== a) return []; const owed = owedTo(w, a, o);
            return [
                { id: 'refuse', quiet: true, text: '不出面', say: { k: '沒有幫{o}出面', p: { o: o.name } }, why: '報社要登什麼不是我該管的', base: REF + (honesty(a) >= 4 ? 0.5 : 0), lean: { face: 0.3 }, run: () => { rel(o, a)?.modifyAffinity?.(-8); note(C, '{m}沒有答應出面', { m: a.name }); return null; } },
                { id: 'lean', quiet: true, mute: true, text: '出面跟報社說一聲，叫他們別登', say: '私下跟報社打了招呼', why: '他幫過我，這個忙不能不幫', base: REF + tilt(clampN(0.12 * (owed >= 20 ? 3.5 : 1) * (aff(a, o) >= 30 ? 2 : 1) * (honesty(a) >= 4 ? 0.3 : 1), 0.01, 0.9)), lean: { bond: 0.2, face: -0.4 },
                    run: (w2, a2) => { C.mayor = true; T.st.pressed = (T.st.pressed || 0) + 1; rel(o, a2)?.modifyAffinity?.(6); rel(J, a2)?.modifyAffinity?.(-8); const f = DEAL.fact(w2, { kind: 'cover', key: x.fid ? DEAL.factOf(w2, x.fid)?.key : null, by: a2.agentId, with: o.agentId, lv: 1 }); DEAL.learn(w2, f, J, 'party'); DEAL.learn(w2, f, o, 'party'); add(w2, { src: 'self', by: J.agentId, about: a2.agentId, type: 'cover', cover: f.id, d: day(w2) + 3 }); mem(w2, J, '{m}來打招呼，叫我別登{o}的事。', { m: a2.name, o: o.name }, 8); note(C, '{m}出面叫報社別登', { m: a2.name }); return { k: '跟報社打了招呼' }; } },
            ];
        },
    });

    // ================= 登不登 =================
    DECIDE.kind('tipPrint', {
        title: '這篇稿子登不登', scan: false, pri: 1.6, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const P = paper(w, c.pid); const C = S(w).cases[c.pid]; const x = tipOf(w, c.tid); if (!P || !C || !x) return ''; const o = live(w, x.about); const lv = level(C);
            return fill('你查了幾天：{x}。現在手上{lv}。{press}登出來，{o}會恨你；證據不夠就登，報社的信譽會掉。', { x: tipText(w, x), lv: LV[lv], o: o?.name || t('當事人'),
                press: { raw: [C.sorry ? t('當事人已經公開道歉。') : '', C.libel ? t('當事人放話要告你誹謗。') : '', C.ownerKill ? t('報社老闆叫你別登。') : '', C.mayor ? t('首長親自來打過招呼。') : '', C.kill === 'bribe' ? t('你收了他的錢。') : '', C.bribeTried ? t('他想塞錢給你，你沒收。') : ''].join('') } }); },
        options(w, a, c) {
            const P = paper(w, c.pid); const T = S(w); const C = T.cases[c.pid]; const x = tipOf(w, c.tid); if (!P || !C || C.tid !== c.tid || !x || P.journo !== a.agentId) return []; const lv = level(C); const brave = (has(a, 'perfectionist') ? 1.5 : 1) * (honesty(a) >= 4 ? 1.3 : 1);
            const press = (C.libel && lv < 2 ? 0.5 : 1) * (C.mayor ? 0.6 : 1) * (C.ownerKill ? (has(a, 'perfectionist') ? 0.5 : 0.15) : 1) * (C.kill === 'bribe' ? 0.05 : 1);
            const others = papers(w).filter(Q => Q.id !== P.id && !T.cases[Q.id]);
            const out = [
                { id: 'kill', quiet: true, mute: true, text: '不登了', say: '把稿子收進抽屜', why: C.kill === 'bribe' ? '拿了人家的錢' : '證據不夠，壓力又大', base: REF + (C.kill === 'bribe' ? 1 : 0) + (lv === 0 ? 0.3 : 0), lean: { safe: 0.4 }, run: (w2) => { T.st.killed = (T.st.killed || 0) + 1; note(C, '稿子沒有登'); close(w2, T, P, C, 'kill'); return { k: '沒有登' }; } },
                { id: 'print', text: C.ownerKill ? '不管老闆，照登（可能被開除）' : '照登，寫出名字', say: { k: '在{paper}登出了調查報導', p: { paper: P.name[0] } }, why: '查到的事就該讓大家知道', base: REF + tilt(clampN([0.15, 0.5, 0.78][lv] * brave * press, 0.01, 0.95)), lean: { face: 0.4, safe: -0.4 },
                    run: (w2, a2) => { const defy = C.ownerKill; print(w2, P, a2, C, false); if (defy) { const own = live(w2, P.owner); P.journo = null; P.cred = clampN(P.cred + 3, 15, 95); T.st.fired = (T.st.fired || 0) + 1; if (own) rel(a2, own)?.modifyAffinity?.(-25); mem(w2, a2, '我不顧老闆反對把報導登了出去，被開除了。', {}, 8); log(w2, '🚪 {j}不顧老闆反對登出了新聞，隨即被{paper}開除。', { j: a2.name, paper: P.name[0] }, a2.name); } return { k: '登出來了' }; } },
                { id: 'soft', quiet: true, text: '登一小段，不寫名字', say: { k: '在{paper}登了一小段', p: { paper: P.name[0] } }, why: '點到為止，誰都不得罪', base: REF + tilt(clampN(0.2 * (press < 1 ? 1.8 : 1) * (lv === 2 ? 0.5 : 1) * (C.kill === 'bribe' ? 0.2 : 1), 0.02, 0.8)), lean: { safe: 0.2 }, run: (w2, a2) => { print(w2, P, a2, C, true); return { k: '只登了一小段' }; } },
            ];
            if (others.length && x.fid) out.push({ id: 'pass', quiet: true, mute: true, text: { k: '自己不登，把線索轉給{paper}', p: { paper: others[0].name[0] } }, say: '把線索交給了別家', why: '我這裡登不了，總有人能登', base: REF + tilt(clampN(0.08 * (press < 1 ? 3.5 : 1) * (C.kill === 'bribe' ? 0.1 : 1), 0.004, 0.7)), lean: { face: 0.1, safe: 0.1 },
                run: (w2) => { T.st.passed = (T.st.passed || 0) + 1; x.src = 'pass'; x.ev = C.ev; x.paper = null; note(C, '把線索轉給了{paper}', { paper: others[0].name[0] }); close(w2, T, P, C, 'pass'); T.last[others[0].id] = -99; return { k: '轉給別家了' }; } });
            return out;
        },
    });

    // ================= 讀到報導、相信的人 =================
    DECIDE.kind('dealRead', {
        title: '報上登出了店家的事', scan: false, pri: 0.9, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const f = DEAL.factOf(w, c.fid); const P = paper(w, c.pid); if (!f || !P) return ''; const o = w.agents[f.by]; const hurt = DEAL.S(w).harm.some(h => h.id === a.agentId && h.key === f.key);
            return fill('你在{paper}讀到：{x}。{harm}{hurt}', { paper: P.name[0], x: DEALASK.factText(w, f), harm: f.harm ? { k: '報上說前後有 {n} 人出事{d}。', p: { n: f.harm, d: f.dead ? { k: '，{m} 人死了', p: { m: f.dead } } : { raw: '' } } } : { raw: '' }, hurt: hurt ? '你自己也出過事。' : { raw: '' }, o: o?.name || '' }); },
        options(w, a, c) {
            const f = DEAL.factOf(w, c.fid); const o = live(w, f?.by); if (!f || !o) return []; const alt = f.key ? DEAL.other(w, f.key) : null; const hurt = DEAL.S(w).harm.some(h => h.id === a.agentId && h.key === f.key) ? 2 : 1, dead = f.dead ? 2 : 1; const going = f.key && DEALASK.boycotters(w, f.key) > 0;
            const out = [{ id: 'shrug', quiet: true, mute: true, text: '看看就算了', say: '看了報導沒有多說什麼', why: '報上寫的也不一定全是真的', base: REF, lean: { safe: 0.2 }, run: () => null }];
            if (!f.key) return out;
            if (alt) out.push({ id: 'switch', quiet: true, text: { k: '以後改去{o}的店', p: { o: DEAL.owner(w, alt).name } }, say: { k: '不再去{s}買東西', p: { s: DEAL.sname(f.key) } }, why: '那家的東西我不敢再碰', base: REF + tilt(clampN(0.4 * hurt * (f.kind === 'cut' ? 1.3 : 0.8), 0.05, 0.95)), lean: { safe: 0.3 }, run: (w2, a2) => (DEALASK.switchTo(w2, a2, f.key) ? { k: '換了一家買' } : null) });
            out.push({ id: 'boycott', text: going ? { k: '跟著大家不去{s}買', p: { s: DEAL.sname(f.key) } } : { k: '號召大家別再去{s}買', p: { s: DEAL.sname(f.key) } }, say: { k: '號召大家別去{s}買東西', p: { s: DEAL.sname(f.key) } }, why: '不能讓這種店繼續賺錢',
                base: REF + tilt(clampN((going ? 0.3 : 0.06) * hurt * dead * (has(a, 'shy') ? 0.4 : 1), 0.01, 0.9)), lean: { face: 0.3, safe: -0.2 }, run: (w2, a2) => ((going ? DEALASK.join(w2, a2, f.key) : DEALASK.boycott(w2, a2, f.key)) ? { k: '不去買了' } : null) });
            out.push({ id: 'tell', quiet: true, text: '拿去講給沒看報的人聽', say: { k: '到處講{s}的事', p: { s: DEAL.sname(f.key) } }, why: '大家都該知道', base: REF + tilt(clampN(0.3 * (has(a, 'gossip') ? 1.6 : 1) * dead, 0.03, 0.9)), lean: { bond: 0.3 }, run: (w2, a2) => { const n = DEALASK.tell(w2, a2, f, 3); return n ? { k: '跟 {n} 個人說了', p: { n } } : { k: '身邊的人都知道了' }; } });
            return out;
        },
    });

    function view(w) {
        if (!w.tips) return null; const T = S(w);
        return { box: T.box.filter(x => x.st === 'new' || x.st === 'working').slice(-12).reverse().map(x => ({ id: x.id, text: tx(tipText(w, x)), src: tx(srcText(w, x)), st: x.st, ago: day(w) - x.d, more: x.more || 0, paper: x.paper ? (paper(w, x.paper)?.name || null) : null })),
            cases: Object.values(T.cases).map(C => ({ pid: C.pid, paper: paper(w, C.pid)?.name || null, j: w.agents[C.j]?.name || '', text: tx(tipText(w, tipOf(w, C.tid) || {})), days: day(w) - C.d0, lv: level(C), log: C.log.map(l => ({ d: l.d, text: fill(l.k, l.p) })) })),
            done: T.done.slice().reverse().map(x => ({ paper: x.paper, text: tx(x.text), out: x.out, ago: day(w) - x.d, lv: x.lv, log: x.log.map(l => ({ d: l.d, text: fill(l.k, l.p) })) })), st: Object.assign({}, T.st) };
    }
    return { S, on, daily, gather, add, start, print, close, tipOf, tipText, level, juicy, papers, view, LV };
})();
if (typeof globalThis !== 'undefined') globalThis.TIPS = TIPS;
if (TIPS && typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { TIPS.daily(w); } catch (e) { console.warn('[Tips] daily', e); } return r; };
}
if (TIPS && typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.tips = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.tips) d.tips = this.tips; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.tips = (data?.tips && typeof data.tips === 'object') ? data.tips : null; } catch (e) {} return r; };
}
