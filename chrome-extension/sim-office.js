// v11.0.0 市場與第四權（第一段）之四：管店家的公職——市場管理員、稅務員、衛生稽查員
// - 依城鎮大小出現：村莊沒有（告發的事落到村長頭上）；城鎮有市場管理員、稅務員（兼任）；城市起多一位衛生稽查員，三位都是專任。
//   這一版的「專任」只代表每週能查三家、津貼較高；離開原本的工作留到第二段。
// - 首長提名（officeNominate，他可以提能幹的人、自己的朋友、或給過他錢的人）→ 開成提案 office_appoint → 全鎮投票、議會表決。
// - 津貼從公庫出，算進公庫的固定支出；公庫付不起六成薪水上限時不補人（FISCAL.canHire）。任期跟著首長，首長換人就全部卸任。
// - 每週自己決定查誰（officeWork）：有人告發的、他想查的、或是不查。兼任的人可能管到自己的店。
// - 查到之後自己決定（officeFound）：照規定罰並公告／暗示對方花錢了事／私下警告／先壓著／交給首長。
// - 沒有官員管的告發，由首長自己決定查不查（headCase）。收錢、壓案都記成一件有人知道的事。
// 必須在 sim-decide-deal.js、sim-deallaw.js 之後載入。
'use strict';
const OFFICE = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined' || typeof DEALASK === 'undefined' || !DEALASK) return null;
    const POSTS = { market: { zh: '市場管理員', icon: '🧺', lv: 1, duty: '管價錢、貨色和店家有沒有私下講好' }, tax: { zh: '稅務員', icon: '🧾', lv: 1, duty: '查東家的帳、追少報的稅' }, health: { zh: '衛生稽查員', icon: '🩺', lv: 2, duty: '查吃的、穿的、燒的東西會不會害人' } };
    const PT_PAY = 1.5, FT_PAY = 4, NOM_GAP = 10;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const fam = (w, a, b) => { try { return !!(a && b && a !== b && (MONEY.familyOf(w, a) || []).some(f => f === b)); } catch (e) { return false; } }; // v11.0.0 真模型實測：稅務員查的是自己的伴侶，題目卻只寫「是你的朋友」
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1, G = 'deal';
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const r2 = (x) => Math.round(x * 100) / 100;
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const live = (w, id) => { const a = w.agents[id]; return a && !a.isDead ? a : null; };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'politics', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('politics', k, p || {}, who || ''); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const mayor = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    const tier = (w) => { try { return typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { return 0; } };
    const inf = (w, pol, donor) => { try { return (typeof POWER !== 'undefined' && pol && donor && POWER.S(w).inf[pol.agentId]?.[donor.agentId]) || 0; } catch (e) { return 0; } };
    const LW = () => (typeof DEALLAW !== 'undefined' && DEALLAW ? DEALLAW : null);
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w); } catch (e) { return false; } };
    function S(w) {
        if (!w.office || typeof w.office !== 'object') w.office = { posts: {}, mayor: null, lastNom: {}, lastDay: null, recs: [], st: { seated: 0, checks: 0, found: 0, fined: 0, graft: 0, warned: 0, sat: 0, up: 0, dismissed: 0 } };
        const O = w.office; O.posts = O.posts || {}; O.lastNom = O.lastNom || {}; O.recs = O.recs || []; O.st = O.st || {}; return O;
    }
    const wanted = (w) => Object.keys(POSTS).filter(k => tier(w) >= POSTS[k].lv);
    const full = (w) => tier(w) >= 2;
    const holder = (w, post) => live(w, w.office?.posts?.[post]?.id);
    const postOf = (w, a) => Object.keys(w.office?.posts || {}).find(k => w.office.posts[k]?.id === a?.agentId) || null;
    const officials = (w) => Object.keys(w.office?.posts || {}).map(k => holder(w, k)).filter(Boolean);
    const pname = (post) => POSTS[post]?.zh || post;
    // 這類事歸誰管：貨色歸衛生稽查員（沒有就歸市場管理員），價錢與講好歸市場管理員
    const dutyOf = (w, kind) => (kind === 'cut' ? (holder(w, 'health') || holder(w, 'market')) : kind === 'tax' ? holder(w, 'tax') : holder(w, 'market'));
    const stipend = (w) => r2((full(w) ? FT_PAY : PT_PAY) * (typeof WALLET !== 'undefined' && WALLET.wageIdx ? WALLET.wageIdx() : 1));
    const payDaily = (w) => (on(w) ? r2(officials(w).length * stipend(w)) : 0);
    const sameCamp = (w, a, b) => { try { const s = typeof CAMPS !== 'undefined' && CAMPS ? CAMPS.side(w, a) : null; return s && s === CAMPS.side(w, b) ? 0.4 : 0; } catch (e) { return 0; } }; // 自己這一邊的人比較會被提名
    const UN = () => (typeof UNREST !== 'undefined' && UNREST ? UNREST : null);
    const repOf = (w, fid, by) => DEALASK.S(w).reports.find(x => x.fid === fid && x.by === by) || null;
    const rec = (w, k, p) => { const O = S(w); O.recs.push({ d: day(w), k, p: p || {} }); if (O.recs.length > 30) O.recs.shift(); };
    function vacate(w, post, why) { const O = S(w); const a = holder(w, post); delete O.posts[post]; if (a) { mem(w, a, '我不再當{p}了。', { p: pname(post) }, 6); rec(w, '{a}卸下{p}（{why}）', { a: a.name, p: pname(post), why }); } }
    function seat(w, post, a, by) { const O = S(w); O.posts[post] = { id: a.agentId, since: day(w), by: by?.agentId || null, owe: 0, n: 0, found: 0 }; O.st.seated = (O.st.seated || 0) + 1; mem(w, a, '我當上了{p}。', { p: pname(post) }, 8); log(w, '{i} {a}當上了{p}。', { i: POSTS[post].icon, a: a.name, p: pname(post) }, a.name); rec(w, '{a}上任{p}（{m}提名）', { a: a.name, p: pname(post), m: by?.name || '' }); return t('{a}上任{p}').replace('{a}', t(a.name)).replace('{p}', t(pname(post))); }
    // ---------- 每天 ----------
    function daily(w) {
        if (!on(w)) return; const O = S(w), d = day(w); if (O.lastDay === d) return; O.lastDay = d; const M = mayor(w); const D = DEALASK.S(w);
        if (O.mayor && M && O.mayor !== M.agentId && Object.keys(O.posts).length) { for (const post of Object.keys(O.posts)) vacate(w, post, '首長換人'); log(w, '🏛️ 首長換人，原本的官員全部卸任，等新首長提名。', {}); }
        if (M) O.mayor = M.agentId;
        for (const post of Object.keys(O.posts)) { if (!wanted(w).includes(post)) vacate(w, post, '鎮變小了，裁掉這個職位'); else if (!holder(w, post) || w.isAway?.(O.posts[post].id)) vacate(w, post, '人不在了'); }
        // 發津貼：公庫付不出來就欠著（欠久了的人比較容易收錢）
        const n = stipend(w); for (const post of Object.keys(O.posts)) { const a = holder(w, post); const P = O.posts[post]; if (!a) continue; if (w.stockpile?.consume?.('silver', n, w.tickCount, t('公職津貼'))) { WALLET.add(w, a, n); P.owe = 0; } else P.owe = (P.owe || 0) + 1; }
        // 補人（v11.12.0 公庫吃緊時，首長決定先補稅務員的話只放行這一個職位）
        if (M) for (const post of wanted(w)) { if (O.posts[post]) continue; if ((w.proposals?.items || []).some(p => p.kind === 'office_appoint' && p.post === post && ['open', 'shelved', 'approved'].includes(p.status))) continue; if (d - (O.lastNom[post] ?? -99) < NOM_GAP) continue; let can = true; try { can = typeof FISCAL === 'undefined' || FISCAL.canHire(w) || (post === 'tax' && FISCAL.taxmanOk(w)); } catch (e) {} if (!can) continue; O.lastNom[post] = d; DECIDE.enqueue(w, M, 'officeNominate', { post }); }
        // 每週各查一輪
        for (const post of Object.keys(O.posts)) { const a = holder(w, post); if (a && (d + post.length * 3) % 7 === 0) DECIDE.enqueue(w, a, 'officeWork', { post, left: full(w) ? 3 : 1 }); }
        // 沒有官員管的告發：落到首長頭上
        if (M) for (const x of D.reports) { if (x.st !== 'new') continue; const f = DEAL.factOf(w, x.fid); if (!f || d - x.d > 60) { x.st = 'old'; continue; } if (dutyOf(w, f.kind)) continue; x.st = 'head'; DECIDE.enqueue(w, M, 'headCase', { fid: f.id, rby: x.by }); break; }
        try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) {}
    }
    // ---------- 提名 ----------
    function candidates(w, M, post) {
        const taken = new Set(officials(w).map(a => a.agentId)); for (const p of (w.proposals?.items || [])) if (p.kind === 'office_appoint' && ['open', 'shelved', 'approved'].includes(p.status)) taken.add(p.cand); // 已經在別的職位上、或正在表決要任命的人不再提（一個人不兼兩職）
        const js = new Set((w.press?.papers || []).map(P => P.journo));
        const pool = npcs(w).filter(a => a !== M && (a.age ?? 30) >= 20 && !taken.has(a.agentId) && !js.has(a.agentId) && !(w.isAway?.(a.agentId)));
        const top = (f) => pool.slice().sort((x, y) => f(y) - f(x))[0];
        const able = top(a => honesty(a) + (has(a, 'perfectionist') ? 1.5 : 0) - (has(a, 'lazy') ? 2 : 0) + ((a.skills?.totalLevel || 0) / 40));
        const friend = top(a => aff(M, a)); const donor = top(a => inf(w, M, a));
        const out = []; const add = (a, tag) => { if (a && !out.some(x => x.a === a)) out.push({ a, tag }); };
        add(able, 'able'); if (friend && aff(M, friend) >= 30) add(friend, 'friend'); if (donor && inf(w, M, donor) >= 15) add(donor, 'donor');
        return out;
    }
    const conflict = (w, a, post) => post !== 'tax' && DEAL.firmsOf(w, a.agentId).length > 0;
    function nominate(w, M, post, a) {
        if (typeof TECH === 'undefined') return null;
        const p = TECH.propose(w, 'office_appoint', post, M, '任命{a}當{p}', '{who}提名{a}當{p}：{duty}。津貼每天 {n} 銀幣，從公庫出。{c}', { a: a.name, p: pname(post), duty: POSTS[post].duty, n: stipend(w), c: conflict(w, a, post) ? '他自己也開店，等於自己管自己。' : { raw: '' } }, 'welfare', { a: a.name, p: pname(post) });
        if (p) { p.post = post; p.cand = a.agentId; } return p;
    }
    DECIDE.kind('officeNominate', {
        title: '提名誰來當官', scan: false, pri: 1.4, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const cs = candidates(w, a, c.post); if (!cs.length) return '';
            return fill('鎮上要有一位{p}：{duty}。津貼每天 {n} 銀幣，從公庫出；任命要議會同意，任期跟著你。可以考慮的人：{list}', { p: pname(c.post), duty: POSTS[c.post].duty, n: stipend(w),
                list: { raw: cs.map(x => fill('{a}（{tag}{own}）', { a: x.a.name, tag: x.tag === 'able' ? '做事認真、信得過' : x.tag === 'friend' ? '你的朋友' : { k: '前後給過你 {n} 銀幣', p: { n: Math.round(inf(w, a, x.a)) } }, own: conflict(w, x.a, c.post) ? '，自己也開店' : { raw: '' } })).join(t('；')) } }); },
        options(w, a, c) {
            if (mayor(w) !== a || S(w).posts[c.post] || !wanted(w).includes(c.post)) return []; const cs = candidates(w, a, c.post); if (!cs.length) return [];
            const out = [{ id: 'none', quiet: true, mute: true, text: '先不提名，這個位子空著', say: '沒有提名', why: '公庫的錢省著用', base: REF - 0.3, lean: { safe: 0.1 }, run: () => null }];
            for (const x of cs) out.push({ id: 'pick:' + x.a.agentId, text: { k: '提名{a}', p: { a: x.a.name } }, say: { k: '提名{a}當{p}', p: { a: x.a.name, p: pname(c.post) } }, why: x.tag === 'able' ? '這個位子要找信得過的人' : x.tag === 'friend' ? '自己人比較好說話' : '他幫過我，該還這個情',
                base: REF + sameCamp(w, a, x.a) + (x.tag === 'able' ? 0.5 + (honesty(a) >= 4 ? 0.5 : 0) : x.tag === 'friend' ? tilt(clampN(0.3 + aff(a, x.a) / 200, 0.05, 0.8)) : tilt(clampN(0.25 * Math.min(3, inf(w, a, x.a) / 30) * (has(a, 'greedy') ? 1.6 : 1) * (honesty(a) >= 4 ? 0.3 : 1), 0.02, 0.85))), lean: x.tag === 'able' ? { face: 0.2 } : { bond: 0.3, face: -0.2 },
                run: (w2, a2) => (nominate(w2, a2, c.post, x.a) ? { k: '送交表決' } : { k: '沒有提成' }) });
            return out;
        },
    });
    function vote(w, p, a) {
        const c = w.agents[p.cand]; if (a.agentId === p.proposerId) return { v: 'for', why: 'office_mine' }; if (!c) return { v: 'against', why: 'office_doubt' }; if (a === c) return { v: 'for', why: 'office_me' };
        if (aff(a, c) >= 30) return { v: 'for', why: 'office_like' }; if (aff(a, c) <= -20) return { v: 'against', why: 'office_dislike' };
        if (conflict(w, c, p.post) && Math.random() < 0.6) return { v: 'against', why: 'office_conflict' };
        const pr = 0.5 + (honesty(c) - 2) * 0.1 + aff(a, c) / 150; return Math.random() < pr ? { v: 'for', why: 'office_good' } : { v: 'against', why: 'office_doubt' };
    }
    const sway = (w, pol, p) => { if (!p || p.kind !== 'office_appoint') return null; const c = w.agents[p.cand]; const n = inf(w, pol, c); return n >= 15 ? Math.min(3, n / 20) : 0; };
    function enact(w, p) { const a = live(w, p.cand); if (!a || S(w).posts[p.post] || !wanted(w).includes(p.post) || postOf(w, a)) return ''; return seat(w, p.post, a, w.agents[p.proposerId]); }

    // ---------- 每週查誰 ----------
    function targets(w, a, post) {
        const D = DEALASK.S(w); const d = day(w); const out = [];
        if (post === 'tax') { const seen = new Set(); for (const key of DEAL.firms(w)) { const o = DEAL.owner(w, key); if (!o || o === a || seen.has(o.agentId)) continue; seen.add(o.agentId); out.push({ id: 'audit:' + o.agentId, o, key, rep: 0, why: 'tax' }); } return out.slice(0, 3); }
        for (const key of DEAL.firms(w)) { const o = DEAL.owner(w, key); if (!o) continue; if (LW()?.closedNow(w, key)) continue;
            const rep = D.reports.filter(x => (x.st === 'new' || x.st === 'head') && x.key === key && d - x.d <= 60 && (post === 'market' || x.kind === 'cut')).length; const ill = LW() ? LW().illegal(w, key) : {};
            const can = rep > 0 || (post === 'market' && ill.hike) || (LW()?.lawOn(w, 'deal_check')) || (post === 'market' && LW()?.lawOn(w, 'deal_cartel') && !!DEAL.other(w, key));
            if (can) out.push({ id: 'go:' + key, o, key, rep, ill: !!ill.hike }); }
        return out.sort((x, y) => (y.rep + (y.ill ? 1 : 0)) - (x.rep + (x.ill ? 1 : 0))).slice(0, 3);
    }
    function inspect(w, a, post, tg) {
        const O = S(w), D = DEALASK.S(w), d = day(w); const P = O.posts[post]; if (P) P.n = (P.n || 0) + 1; O.st.checks = (O.st.checks || 0) + 1; const found = []; let n = 0; const keen = has(a, 'perfectionist') ? 0.15 : has(a, 'lazy') ? -0.15 : 0;
        if (tg.why === 'tax') { const shady = has(tg.o, 'greedy') || (tg.o.personality?.values || []).includes('財富') || tg.o.dark?.liar; if (shady && Math.random() < 0.6 + keen) { found.push('tax'); n = clampN(Math.round(cash(w, tg.o) * 0.06), 8, 80); } }
        else { const st = DEAL.F(w, tg.key); const ill = LW() ? LW().illegal(w, tg.key) : {};
            for (const x of D.reports) if ((x.st === 'new' || x.st === 'head') && x.key === tg.key) x.st = 'checked';
            if (st.cut > 0 && (post === 'health' || !holder(w, 'health')) && Math.random() < 0.45 + 0.2 * st.cut + keen) found.push('cut');
            if (post === 'market' && ill.hike) found.push('hike');
            if (post === 'market' && ill.pact) { const pf = DEAL.factOf(w, st.pact); if (Math.random() < (pf?.leniency || tg.rep ? 0.85 : 0.3) + keen) found.push('pact'); }
            n = clampN(Math.round((st.gain || 0) * 0.5) + found.length * 10, 10, 120); }
        rec(w, found.length ? '{a}（{p}）查了{o}，查到問題' : '{a}（{p}）查了{o}，沒查到什麼', { a: a.name, p: pname(post), o: tg.o.name });
        if (!found.length) { mem(w, a, '我去查了{o}，沒查到什麼。', { o: tg.o.name }, 4); return null; }
        if (P) P.found = (P.found || 0) + 1; O.st.found = (O.st.found || 0) + 1;
        const ctx = { post, key: tg.key || null, oid: tg.o.agentId, what: found, n }; DECIDE.enqueue(w, a, 'officeFound', ctx); return ctx;
    }
    // v11.12.0 稅務員每週大約追回多少（首長決定要不要先補這個位子時看）：照 inspect 的規則估，東家少報（貪心、看重財富、愛說謊）的話六成查得到，追回他身上現金的 6%（8～80 銀幣）；
    // 他每週查 left 家（專任 3 家、兼任 1 家），在可以查的東家裡平均挑。查不查、罰不罰是他自己的決定，這裡算的是照規定查、照規定罰
    function taxYield(w) {
        const ts = targets(w, null, 'tax'); const left = full(w) ? 3 : 1;
        const ev = ts.map(x => { const o = x.o; const shady = has(o, 'greedy') || (o.personality?.values || []).includes('財富') || o.dark?.liar; return shady ? 0.6 * clampN(Math.round(cash(w, o) * 0.06), 8, 80) : 0; });
        const per = ev.length ? ev.reduce((s2, v) => s2 + v, 0) / ev.length : 0;
        return { firms: ts.length, shady: ev.filter(v => v > 0).length, week: r2(per * Math.min(left, ts.length)), left, pay: stipend(w) };
    }
    const WHAT = { cut: '在貨上偷工減料', hike: '漲價超過上限', pact: '跟同行講好一起漲', tax: '少報了該繳的稅' };
    const whatText = (what) => ({ raw: (what || []).map(x => t(WHAT[x] || x)).join(t('、')) });
    DECIDE.kind('officeWork', {
        title: '這禮拜查誰', scan: false, pri: 1.2, aiGroup: G, aiKind: 8,
        when() { return null; },
        facts(w, a, c) { const ts = targets(w, a, c.post); if (!ts.length) return ''; const M = mayor(w);
            return fill('你是{p}，{duty}。這禮拜還可以查 {n} 家。{owe}可以查的：{list}', { p: pname(c.post), duty: POSTS[c.post].duty, n: c.left || 1, owe: (S(w).posts[c.post]?.owe || 0) >= 3 ? { k: '公庫已經 {n} 天沒發你津貼。', p: { n: S(w).posts[c.post].owe } } : { raw: '' },
                list: { raw: ts.map(x => fill('{s}（東家{o}{me}{rep}{ill}{fr}{dn}）', { s: x.key ? DEAL.sname(x.key) : { raw: '' }, o: x.o.name, me: x.o === a ? '，就是你自己' : { raw: '' }, rep: x.rep ? { k: '，有 {n} 人告發', p: { n: x.rep } } : { raw: '' }, ill: x.ill ? '，價錢明顯超過上限' : { raw: '' }, fr: x.o !== a && fam(w, a, x.o) ? '，是你的家人' : x.o !== a && aff(a, x.o) >= 40 ? '，是你的朋友' : { raw: '' }, dn: M && inf(w, M, x.o) >= 20 ? '，給過首長不少錢' : { raw: '' } })).join(t('；')) } }); },
        options(w, a, c) {
            if (postOf(w, a) !== c.post) return []; const ts = targets(w, a, c.post); if (!ts.length) return []; const M = mayor(w); const lazy = has(a, 'lazy') ? 0.5 : has(a, 'perfectionist') ? 1.4 : 1;
            const out = [{ id: 'skip', quiet: true, mute: true, text: '這禮拜不查了', say: '這禮拜沒有去查', why: '沒事何必得罪人', base: REF, lean: { safe: 0.3 }, run: () => null }];
            for (const x of ts) out.push({ id: x.id, text: { k: '去查{o}', p: { o: x.o.name } }, say: { k: '去查了{o}', p: { o: x.o.name } }, why: x.rep ? '有人告發，不能不查' : '該查的就要查',
                base: REF + tilt(clampN((0.3 + (x.rep ? 0.3 : 0) + (x.ill ? 0.2 : 0)) * lazy * (x.o === a ? 0.05 : 1) * (aff(a, x.o) >= 40 ? 0.35 : aff(a, x.o) <= -20 ? 1.5 : 1) * (M && inf(w, M, x.o) >= 20 ? 0.5 : 1) * (honesty(a) >= 4 ? 1.3 : 1), 0.01, 0.95)), lean: { face: 0.2, safe: -0.2 },
                run: (w2, a2) => { const r = inspect(w2, a2, c.post, x); if ((c.left || 1) > 1) DECIDE.enqueue(w2, a2, 'officeWork', { post: c.post, left: c.left - 1, skip: (c.skip || []).concat([x.id]) }); return r ? { k: '查到問題了' } : { k: '沒查到什麼' }; } });
            return (c.skip || []).length ? out.filter(o => !c.skip.includes(o.id)) : out;
        },
    });
    // ---------- 查到之後 ----------
    function punish(w, a, c, quiet) {
        const o = live(w, c.oid); if (!o) return 0; const O = S(w); const d = day(w); let got = 0;
        if (c.key) { const st = DEAL.F(w, c.key);
            if (c.what.includes('pact')) { const pf = DEAL.factOf(w, st.pact); const ok2 = DEAL.other(w, c.key); const o2 = ok2 ? DEAL.owner(w, ok2) : null; if (pf) { if (o2 && pf.leniency !== o2.agentId && !pf.fake) LW()?.fine(w, o2, Math.round(c.n * 0.6)); DEAL.endPact(w, pf, 'fined'); pf.pub = d; if (ok2) DEAL.setUp(w, ok2, 0); } if (pf?.leniency === o.agentId) c.n = 0; }
            if (c.what.includes('cut')) { const f = DEAL.liveFact(w, c.key, 'cut'); if (f) f.pub = d; DEAL.setCut(w, c.key, 0); }
            if (c.what.includes('hike') || c.what.includes('pact')) DEAL.setUp(w, c.key, Math.min(st.up, 0.1));
            st.caught = d; st.gain = r2((st.gain || 0) * 0.5); }
        if (c.n > 0) got = LW() ? LW().fine(w, o, c.n) : 0; O.st.fined = r2((O.st.fined || 0) + got);
        if (!quiet) { log(w, '🔎 {a}（{p}）查到{o}{x}，罰了 {n} 銀幣並公告。', { a: a.name, p: pname(c.post), o: o.name, x: whatText(c.what), n: got }, o.name); for (const x of npcs(w)) if (x !== o && x !== a && Math.random() < 0.35) rel(x, o)?.modifyAffinity?.(-4); try { w.dailyNews?.collectEvent?.('politics', fill('{o}被查到{x}', { o: o.name, x: whatText(c.what) }), 6, [o.name]); } catch (e) {} }
        mem(w, o, '{a}來查，罰了我 {n} 銀幣。', { a: a.name, n: got }, 7); rel(o, a)?.modifyAffinity?.(-8); rec(w, '{a}照規定罰了{o} {n} 銀幣', { a: a.name, o: o.name, n: got }); return got;
    }
    function cover(w, by, o, key, kind, knower, n) {
        const f = kind === 'bribe' ? DEAL.fact(w, { kind: 'bribe', key: key || null, by: o.agentId, with: by.agentId, lv: n || 1 }) : DEAL.fact(w, { kind: 'cover', key: key || null, by: by.agentId, with: o.agentId, lv: 1 });
        DEAL.learn(w, f, kind === 'bribe' ? by : o, 'party'); if (knower) DEAL.learn(w, f, knower, 'party'); return f;
    }
    // 告發的人發現沒有下文：要不要算了、去跟報社說、還是到處講，由他自己決定
    function snub(w, by, f, key, how, only) {
        const D = DEALASK.S(w), d = day(w); let n = 0;
        for (const x of D.reports) { if (n >= 3) break; if (only ? x !== only : !(x.key === key && x.st === 'checked' && d - x.d <= 60)) continue; const r = live(w, x.by); if (!r || r === by) continue; x.st = 'snubbed'; n++; DEAL.learn(w, f, r, 'guess');
            mem(w, r, how === 'no' ? '我去告發{s}的事，{o}說沒有證據，不查。' : '我去告發{s}的事，{o}去查過了，卻一點下文都沒有。', { s: key ? DEAL.sname(key) : { raw: '' }, o: by.name }, 7); rel(r, by)?.modifyAffinity?.(-8);
            DECIDE.enqueue(w, r, 'reportSnub', { about: by.agentId, cover: f.id, key: key || null, how }); UN()?.anger(w, r, by, 2, 'snub'); }
        return n;
    }
    // 報上登出官員不辦事（或收錢）：他是首長提名的，留不留由首長決定
    function exposed(w, target, P, paid, n) {
        const O = S(w); const post = postOf(w, target); const M = mayor(w); O.st.exposed = (O.st.exposed || 0) + 1;
        rec(w, paid ? '{paper}登出{a}收錢不辦事' : '{paper}登出{a}接到告發卻不辦', { paper: P.name[0], a: target.name });
        if (post && M && M !== target) DECIDE.enqueue(w, M, 'officeScandal', { post, id: target.agentId, pid: P.id, paid: !!paid, n: n || 0 });
    }
    DECIDE.kind('officeFound', {
        title: '查到問題了，怎麼辦', scan: false, pri: 1.6, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = live(w, c.oid); if (!o) return ''; const P = S(w).posts[c.post]; const M = mayor(w);
            return fill('你查到{o}{s}{x}。照規定該罰 {n} 銀幣並公告。{o}手上有 {c} 銀幣。{fr}{dn}{owe}', { o: o.name, s: c.key ? { k: '的{s}', p: { s: DEAL.sname(c.key) } } : { raw: '' }, x: whatText(c.what), n: c.n, c: Math.floor(cash(w, o)), fr: fam(w, a, o) ? '他是你的家人。' : aff(a, o) >= 40 ? '他是你的朋友。' : { raw: '' }, dn: M && inf(w, M, o) >= 20 ? { k: '他給過{m}不少錢，你這個位子是{m}給的。', p: { m: M.name } } : { raw: '' }, owe: (P?.owe || 0) >= 3 ? { k: '公庫已經 {n} 天沒發你津貼。', p: { n: P.owe } } : { raw: '' } }); },
        options(w, a, c) {
            const o = live(w, c.oid); if (!o || postOf(w, a) !== c.post) return []; const P = S(w).posts[c.post]; const M = mayor(w); const hon = honesty(a); const fr = aff(a, o) >= 40; const dn = M && inf(w, M, o) >= 20; const m = Math.max(5, Math.round(c.n * 0.5));
            const out = [{ id: 'fine', text: { k: '照規定罰 {n} 銀幣並公告', p: { n: c.n } }, say: { k: '照規定罰了{o}', p: { o: o.name } }, why: '查到了就照規定辦', base: REF + 0.4 + (hon >= 4 ? 0.5 : 0), lean: { face: 0.3, safe: -0.1 }, run: (w2, a2) => { const g = punish(w2, a2, c, false); return { k: '罰了 {n} 銀幣', p: { n: g } }; } }];
            if (cash(w, o) >= m) out.push({ id: 'bribe', quiet: true, mute: true, text: { k: '暗示他：拿 {n} 銀幣出來，這件事就當沒看到', p: { n: m } }, say: '跟對方私下談了', why: '罰了錢進公庫，不如進我口袋', base: REF + tilt(clampN(0.08 * (has(a, 'greedy') ? 2.5 : 1) * (hon >= 4 ? 0.1 : hon <= 1.5 ? 2 : 1) * ((P?.owe || 0) >= 3 ? 1.8 : 1), 0.004, 0.8)), lean: { gain: 0.5, face: -0.4, safe: -0.2 },
                run: (w2, a2) => { if (!WALLET.pay(w2, o, a2, m)) return null; S(w2).st.graft = (S(w2).st.graft || 0) + 1; { const cf = cover(w2, a2, o, c.key, 'bribe', null, m); snub(w2, a2, cf, c.key, 'sit'); } try { DARK.secret(w2, { kind: 'kickback', culprit: a2.agentId, victim: null, k: '{a}收了{o}的 {n} 銀幣，查到的事沒有辦', p: { a: a2.name, o: o.name, n: m } }); } catch (e) {} mem(w2, o, '{a}來查，我塞了 {n} 銀幣，他就走了。', { a: a2.name, n: m }, 7); rec(w2, '{a}查到{o}的事，沒有辦', { a: a2.name, o: o.name }); return { k: '收了 {n} 銀幣', p: { n: m } }; } });
            out.push({ id: 'warn', quiet: true, text: '私下警告，不罰也不公告', say: { k: '私下警告了{o}', p: { o: o.name } }, why: '給他一次機會', base: REF + tilt(clampN(0.15 * (fr ? 2.5 : 1) * (has(a, 'kind') ? 1.5 : 1), 0.02, 0.8)), lean: { bond: 0.3 },
                run: (w2, a2) => { S(w2).st.warned = (S(w2).st.warned || 0) + 1; if (c.key) DEAL.F(w2, c.key).caught = day(w2); mem(w2, o, '{a}來查，私下警告我，沒有罰。', { a: a2.name }, 7); rel(o, a2)?.modifyAffinity?.(4); rec(w2, '{a}私下警告了{o}', { a: a2.name, o: o.name }); return { k: '警告了他' }; } });
            out.push({ id: 'sit', quiet: true, mute: true, text: '先壓著，當作沒查到', say: '把案子壓了下來', why: '這個人不好動', base: REF + tilt(clampN(0.06 * (dn ? 3.5 : 1) * (fr ? 2 : 1) * (hon >= 4 ? 0.2 : 1), 0.004, 0.8)), lean: { safe: 0.3, face: -0.3 },
                run: (w2, a2) => { S(w2).st.sat = (S(w2).st.sat || 0) + 1; { const cf = cover(w2, a2, o, c.key, 'cover'); snub(w2, a2, cf, c.key, 'sit'); } rec(w2, '{a}查到{o}的事，沒有辦', { a: a2.name, o: o.name }); return { k: '壓下來了' }; } });
            if (M && M !== a && M !== o) out.push({ id: 'up', quiet: true, text: { k: '交給{m}決定', p: { m: M.name } }, say: { k: '把{o}的事往上報', p: { o: o.name } }, why: '這件事我做不了主', base: REF + tilt(clampN(0.12 * (dn ? 2 : 1), 0.02, 0.7)), lean: { safe: 0.2 },
                run: (w2, a2) => { S(w2).st.up = (S(w2).st.up || 0) + 1; DECIDE.enqueue(w2, M, 'headCase', { found: c, from: a2.agentId }); rec(w2, '{a}把{o}的事交給首長', { a: a2.name, o: o.name }); return { k: '往上報了' }; } });
            return out;
        },
    });
    // ---------- 落到首長頭上的事 ----------
    DECIDE.kind('headCase', {
        title: '有一件店家的事要你決定', scan: false, pri: 1.7, aiGroup: G,
        when() { return null; },
        facts(w, a, c) {
            if (c.found) { const o = live(w, c.found.oid); const by = live(w, c.from); if (!o) return ''; return fill('{by}來報告：查到{o}{x}，照規定該罰 {n} 銀幣並公告，他不敢自己決定。{dn}', { by: by?.name || '', o: o.name, x: whatText(c.found.what), n: c.found.n, dn: inf(w, a, o) >= 20 ? { k: '{o}前後給過你 {n} 銀幣。', p: { o: o.name, n: Math.round(inf(w, a, o)) } } : { raw: '' } }); }
            const x = repOf(w, c.fid, c.rby); const f = DEAL.factOf(w, c.fid); const o = live(w, f?.by); const by = live(w, x?.by); if (!f || !o) return '';
            return fill('{by}來告發：{x}。鎮上沒有專門管這件事的人，要不要查由你決定。{dn}', { by: by?.name || '', x: DEALASK.factText(w, f), dn: inf(w, a, o) >= 20 ? { k: '{o}前後給過你 {n} 銀幣。', p: { o: o.name, n: Math.round(inf(w, a, o)) } } : { raw: '' } }); },
        options(w, a, c) {
            if (mayor(w) !== a) return []; const hon = honesty(a);
            if (c.found) { const o = live(w, c.found.oid); const by = live(w, c.from); if (!o) return []; const dn = Math.min(3, inf(w, a, o) / 30); const f = c.found.key ? (DEAL.liveFact(w, c.found.key, 'cut') || null) : null;
                const out = [{ id: 'fine', text: { k: '照規定罰 {n} 銀幣並公告', p: { n: c.found.n } }, say: { k: '下令照規定罰{o}', p: { o: o.name } }, why: '規定就是規定', base: REF + 0.3 + (hon >= 4 ? 0.5 : 0), lean: { face: 0.3 }, run: (w2, a2) => { const g = punish(w2, by || a2, c.found, false); return { k: '罰了 {n} 銀幣', p: { n: g } }; } },
                    { id: 'shelve', quiet: true, mute: true, text: '這件事先擱著，不要再提', say: '把一件案子擱了下來', why: '這個人動不得', base: REF + tilt(clampN(0.08 * (1 + dn * 1.5) * (aff(a, o) >= 40 ? 2 : 1) * (hon >= 4 ? 0.2 : 1), 0.004, 0.9)), lean: { bond: 0.2, face: -0.4 }, run: (w2, a2) => { S(w2).st.sat = (S(w2).st.sat || 0) + 1; { const cf = cover(w2, a2, o, c.found.key, 'cover', by); snub(w2, a2, cf, c.found.key, 'sit'); } rel(o, a2)?.modifyAffinity?.(6); if (by) mem(w2, by, '我把{o}的事報上去，{m}叫我別管了。', { o: o.name, m: a2.name }, 8); rec(w2, '{m}把{o}的案子擱了下來', { m: a2.name, o: o.name }); return { k: '擱下來了' }; } }];
                if (f && LW()) out.push({ id: 'trial', text: { k: '把{o}交付審判', p: { o: o.name } }, say: { k: '提案審判{o}', p: { o: o.name } }, why: '這件事要讓全鎮來評', base: REF + tilt(clampN(0.15 * (f.dead ? 3 : 1) * (dn > 0 ? 0.4 : 1), 0.02, 0.9)), lean: { face: 0.4 }, run: (w2, a2) => { f.pub = f.pub || day(w2); return LW().trial(w2, f, a2) ? { k: '提案送出去了' } : { k: '已經有人提了' }; } });
                return out; }
            const x = repOf(w, c.fid, c.rby); const f = DEAL.factOf(w, c.fid); const o = live(w, f?.by); const by = live(w, x?.by); if (!x || !f || !o) return []; const dn = Math.min(3, inf(w, a, o) / 30);
            return [
                { id: 'look', text: { k: '親自去查{o}', p: { o: o.name } }, say: { k: '親自去查了{o}', p: { o: o.name } }, why: '有人告發就該查', base: REF + tilt(clampN(0.4 * (hon >= 4 ? 1.5 : 1) * (dn > 0 ? 0.4 : 1) * (aff(a, o) >= 40 ? 0.4 : 1), 0.03, 0.95)), lean: { face: 0.3, safe: -0.2 },
                    run: (w2, a2) => { x.st = 'checked'; S(w2).st.checks = (S(w2).st.checks || 0) + 1; const st = f.key ? DEAL.F(w2, f.key) : null; const hit = f.end == null && ((f.kind === 'cut' && st?.cut > 0 && Math.random() < 0.4 + 0.15 * st.cut) || (f.kind === 'pact' && Math.random() < 0.4) || f.kind === 'hike');
                        if (!hit || f.kind === 'hike' && !(LW()?.illegal(w2, f.key).hike)) { if (by) mem(w2, by, '{m}去查了，說沒查到什麼。', { m: a2.name }, 6); rec(w2, '{m}親自查了{o}，沒查到什麼', { m: a2.name, o: o.name }); return { k: '沒查到什麼' }; }
                        const g = punish(w2, a2, { post: 'market', key: f.key, oid: o.agentId, what: [f.kind], n: clampN(Math.round((st?.gain || 0) * 0.5) + 10, 10, 120) }, false); return { k: '查到了，罰了 {n} 銀幣', p: { n: g } }; } },
                { id: 'no', quiet: true, text: '說沒有證據，不查', say: { k: '沒有受理對{o}的告發', p: { o: o.name } }, why: '沒憑沒據的事，查了只是擾民', base: REF + tilt(clampN(0.25 * (1 + dn) * (aff(a, o) >= 40 ? 1.8 : 1) * (hon >= 4 ? 0.4 : 1), 0.03, 0.95)), lean: { safe: 0.2, face: -0.2 },
                    run: (w2, a2) => { x.st = 'dismissed'; S(w2).st.dismissed = (S(w2).st.dismissed || 0) + 1; if (by && f.end == null && f.kind !== 'hike') { const cf = cover(w2, a2, o, f.key, 'cover'); snub(w2, a2, cf, f.key, 'no', x); } else if (by) { mem(w2, by, '我去告發{s}的事，{o}說沒有證據，不查。', { s: f.key ? DEAL.sname(f.key) : { raw: '' }, o: a2.name }, 7); rel(by, a2)?.modifyAffinity?.(-6); } rec(w2, '{m}沒有受理對{o}的告發', { m: a2.name, o: o.name }); return { k: '沒有查' }; } },
            ];
        },
    });
    // ---------- 告發沒有下文 ----------
    const hasPaper = (w) => typeof TIPS !== 'undefined' && TIPS && TIPS.papers(w).length > 0;
    DECIDE.kind('reportSnub', {
        title: '你告發的事沒有下文', scan: false, pri: 1.1, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = live(w, c.about); if (!o) return ''; const post = postOf(w, o);
            return fill(c.how === 'no' ? '你去告發{s}的事，{o}（{p}）說沒有證據，不肯查。{paper}' : '你去告發{s}的事，{o}（{p}）去查過了，卻一點下文都沒有，那家店照常做生意。{paper}', { s: c.key ? DEAL.sname(c.key) : { raw: '' }, o: o.name, p: post ? pname(post) : '首長', paper: hasPaper(w) ? '鎮上有報社收這種線索。' : { raw: '' } }); },
        options(w, a, c) {
            const o = live(w, c.about); const f = DEAL.factOf(w, c.cover); if (!o || !f) return []; const hon = honesty(a); const hurt = c.key && DEAL.S(w).harm.some(h => h.id === a.agentId && h.key === c.key) ? 2 : 1;
            const out = [{ id: 'drop', quiet: true, mute: true, text: '算了，胳臂扭不過大腿', say: '沒有再追究', why: '再鬧下去吃虧的是我', base: REF + (has(a, 'shy') ? 0.4 : 0), lean: { safe: 0.4 }, run: () => null }];
            if (hasPaper(w)) out.push({ id: 'paper', quiet: true, text: { k: '去跟報社說{o}不辦事', p: { o: o.name } }, say: { k: '把{o}不辦事的經過告訴了報社', p: { o: o.name } }, why: '官不管，就讓大家來評理', base: REF + tilt(clampN(0.3 * hurt * (hon >= 4 ? 1.5 : 1) * (has(a, 'shy') ? 0.4 : 1) * (aff(a, o) >= 40 ? 0.3 : 1), 0.02, 0.95)), lean: { face: 0.3, safe: -0.3 },
                run: (w2, a2) => { const T = TIPS.S(w2); if (T.box.some(x => x.cover === f.id && x.st !== 'dropped')) return { k: '報社已經知道了' }; TIPS.add(w2, { src: 'tip', by: a2.agentId, about: o.agentId, type: 'shield', cover: f.id }); S(w2).st.toPaper = (S(w2).st.toPaper || 0) + 1; return { k: '跟報社說了' }; } });
            out.push({ id: 'talk', quiet: true, text: { k: '逢人就講{o}不辦事', p: { o: o.name } }, say: { k: '到處說{o}收了告發卻不辦', p: { o: o.name } }, why: '這口氣我吞不下去', base: REF + tilt(clampN(0.25 * hurt * (has(a, 'gossip') ? 2 : 1) * (has(a, 'shy') ? 0.3 : 1), 0.02, 0.9)), lean: { bond: 0.2, face: 0.1, safe: -0.1 },
                run: (w2, a2) => { let n = 0; const fr = npcs(w2).filter(x => x !== a2 && x !== o && aff(a2, x) >= 20).sort((x, y) => aff(a2, y) - aff(a2, x)).slice(0, 4); for (const x of fr) { if (!DEAL.learn(w2, f, x, 'heard')) continue; n++; rel(x, o)?.modifyAffinity?.(-4); mem(w2, x, '{a}說他去告發，{o}卻不辦。', { a: a2.name, o: o.name }, 5); UN()?.anger(w2, x, o, 1, 'heard'); } S(w2).st.grumble = (S(w2).st.grumble || 0) + n; return { k: '講給 {n} 個人聽', p: { n } }; } });
            return out;
        },
    });
    // ---------- 官員被登上報 ----------
    DECIDE.kind('officeScandal', {
        title: '你提名的官員上了報', scan: false, pri: 1.8, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const o = live(w, c.id); const P = (w.press?.papers || []).find(x => x.id === c.pid); if (!o || !P) return '';
            return fill(c.paid ? '{paper}登出：{o}（{p}）收了店家的錢，查到的事沒有辦。{n} 個讀者相信了。他是你提名的。{fr}' : '{paper}登出：{o}（{p}）接到告發卻沒有辦。{n} 個讀者相信了。他是你提名的。{fr}', { paper: P.name[0], o: o.name, p: pname(c.post), n: c.n, fr: fam(w, a, o) ? '他是你的家人。' : aff(a, o) >= 40 ? '他是你的朋友。' : inf(w, a, o) >= 15 ? '他給過你錢。' : { raw: '' } }); },
        options(w, a, c) {
            const o = live(w, c.id); if (!o || mayor(w) !== a || postOf(w, o) !== c.post) return []; const hon = honesty(a); const tie = (aff(a, o) >= 40 ? 2 : 1) * (inf(w, a, o) >= 15 ? 1.8 : 1);
            return [
                { id: 'fire', text: { k: '撤掉{o}', p: { o: o.name } }, say: { k: '撤掉了{p}{o}', p: { p: pname(c.post), o: o.name } }, why: '留著他，倒楣的是我', base: REF + tilt(clampN((c.paid ? 0.6 : 0.35) * (hon >= 4 ? 1.4 : 1) / tie, 0.03, 0.97)), lean: { face: 0.4, bond: -0.3 },
                    run: (w2, a2) => { vacate(w2, c.post, '上報後被撤換'); S(w2).st.fired = (S(w2).st.fired || 0) + 1; rel(o, a2)?.modifyAffinity?.(-15); log(w2, '🪪 {m}撤掉了{p}{o}。', { m: a2.name, p: pname(c.post), o: o.name }, o.name); for (const x of npcs(w2)) if (x !== a2 && x !== o && Math.random() < 0.3) rel(x, a2)?.modifyAffinity?.(2); return { k: '撤掉了' }; } },
                { id: 'keep', text: { k: '說報上寫的不是事實，留任{o}', p: { o: o.name } }, say: { k: '說報上亂寫，留任{o}', p: { o: o.name } }, why: '他是我的人，不能說換就換', base: REF + tilt(clampN((c.paid ? 0.15 : 0.3) * tie * (hon >= 4 ? 0.4 : 1), 0.02, 0.95)), lean: { bond: 0.4, face: -0.3 },
                    run: (w2, a2) => { S(w2).st.kept = (S(w2).st.kept || 0) + 1; rel(o, a2)?.modifyAffinity?.(8); let n = 0; for (const x of npcs(w2)) { if (x === a2 || x === o || w2.press?.reads?.[x.agentId] !== c.pid) continue; if (Math.random() < 0.5) { rel(x, a2)?.modifyAffinity?.(c.paid ? -6 : -3); n++; UN()?.anger(w2, x, a2, 1, 'keep'); } } rec(w2, '{m}留任上了報的{o}', { m: a2.name, o: o.name }); log(w2, '🪪 {m}說報上寫的不是事實，{o}留任{p}。', { m: a2.name, o: o.name, p: pname(c.post) }, o.name); return { k: '留任，{n} 個讀者不以為然', p: { n } }; } },
            ];
        },
    });
    const vacWhy = (w, k) => { try { return typeof FISCAL !== 'undefined' && FISCAL.vacancy ? FISCAL.vacancy(w, k) : null; } catch (e) { return null; } }; // v11.12.0 空著的原因照實說
    function view(w) { if (!w.office) return null; const O = S(w), d = day(w); let hire = true; try { hire = typeof FISCAL === 'undefined' || FISCAL.canHire(w); } catch (e) {} return { hire, wanted: wanted(w).map(k => ({ post: k, name: t(pname(k)), icon: POSTS[k].icon, duty: t(POSTS[k].duty), holder: holder(w, k)?.name || null, holderId: holder(w, k)?.agentId || null, why: holder(w, k) ? null : vacWhy(w, k), days: O.posts[k] ? d - O.posts[k].since : 0, n: O.posts[k]?.n || 0, found: O.posts[k]?.found || 0, owe: O.posts[k]?.owe || 0, by: w.agents[O.posts[k]?.by]?.name || null })), pay: stipend(w), full: full(w), recs: O.recs.slice(-10).reverse().map(x => ({ ago: d - x.d, text: fill(x.k, x.p) })), st: Object.assign({}, O.st) }; }
    return { taxYield, S, on, POSTS, wanted, full, holder, postOf, officials, dutyOf, stipend, payDaily, seat, vacate, daily, candidates, nominate, vote, sway, enact, targets, inspect, punish, snub, exposed, view, pname };
})();
if (typeof globalThis !== 'undefined') globalThis.OFFICE = OFFICE;
if (OFFICE) {
    if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { office_appoint: { icon: '🪪', label: '任命官員' } });
    if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { office_mine: '這是我提名的人', office_me: '被提名的就是我', office_like: '我信得過他', office_dislike: '我跟他處不來', office_conflict: '他自己開店，不能自己管自己', office_good: '這個人做事認真', office_doubt: '我不放心把這件事交給他' });
    if (typeof ProposalSystem !== 'undefined') {
        const PS = ProposalSystem.prototype;
        const _daily = PS.daily; if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { OFFICE.daily(w); } catch (e) { console.warn('[Office] daily', e); } return r; };
        const _rv = PS._ruleVote; PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'office_appoint') { const r = OFFICE.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
    }
    if (typeof TIERS !== 'undefined' && TIERS.badge) { const _b = TIERS.badge; TIERS.badge = function (w, a) { const b = _b.call(this, w, a); if (b && b.cls !== 'former') return b; try { const post = OFFICE.postOf(w, a); if (post) return { cls: 'official', icon: OFFICE.POSTS[post].icon, text: t(OFFICE.pname(post)) }; } catch (e) {} return b; }; }
    if (typeof World !== 'undefined') {
        const WP = World.prototype;
        const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.office = null; return r; };
        const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.office) d.office = this.office; return d; };
        const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.office = (data?.office && typeof data.office === 'object') ? data.office : null; } catch (e) {} return r; };
    }
}
