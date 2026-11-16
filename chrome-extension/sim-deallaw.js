// v11.0.0 市場與第四權（第一段）之三：三條規定與審判
// - 價格上限（deal_cap）：三餐、衣服、柴火不得比原價貴超過 12%。超過的照樣漲得上去，但是違法，被查到要罰。
// - 品質檢查（deal_check）：管市場的官員可以主動抽查店家（沒有這條，只能等有人告發才查）。
// - 禁止聯合定價（deal_cartel）：兩家講好一起漲是違法的；先去告發的那一方不罰。
// - 審判（deal_trial）：把東家的事交給全鎮表決。通過：退錢給出事的人、沒收一半不當所得；出過人命的再勒令歇業 14 天，歇業期間店由公所代管。
// 四種都走提案 → 全鎮投票 → 議會 → 首長裁決；三條規定通過後可以再表決廢除（接 sim-repeal.js）。
// 收了東家錢的議員與首長，審到這些案子時會偏向東家（sim-power.js 的 sway 會來問這裡）。
const DEALLAW = (() => {
    if (typeof DEAL === 'undefined') return null;
    const LAWS = ['deal_cap', 'deal_check', 'deal_cartel'], KINDS = LAWS.concat(['deal_trial']);
    const FIELD = { deal_cap: 'cap', deal_check: 'check', deal_cartel: 'cartel' };
    const CAP = 0.12, GAP = 30, AIGAP = 5, CLOSE_DAYS = 14, REFUND = 10, DEATH_FINE = 30;
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const r2 = (x) => Math.round(x * 100) / 100;
    const has = (a, x) => (a?.personality?.traits || []).includes(x);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const log = (w, k, p, who) => { try { w.logMessageT?.('politics', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'politics', k, p || {}, imp, []); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const on = (w) => DEAL.on(w);
    function S(w) {
        if (!w.deallaw || typeof w.deallaw !== 'object') w.deallaw = { cap: 0, check: 0, cartel: 0, last: {}, closed: {}, lastDay: null, st: { fines: 0, refunds: 0, taken: 0, closures: 0, trials: 0 } };
        const L = w.deallaw; L.last = L.last || {}; L.closed = L.closed || {}; L.st = L.st || {}; return L;
    }
    const lawOn = (w, kind) => !!(w.deallaw && w.deallaw[FIELD[kind]]);
    const closedNow = (w, key) => { const u = w.deallaw?.closed?.[key]; return !!u && u >= day(w); };
    // 這家店現在有沒有違法的事
    const illegal = (w, key) => { const st = DEAL.F(w, key); return { hike: lawOn(w, 'deal_cap') && st.up > CAP + 1e-9, pact: lawOn(w, 'deal_cartel') && !!st.pact }; };
    const openProps = (w, kinds) => (w.proposals?.items || []).filter(p => kinds.includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status));
    function okNow(w, kind, ai) {
        if (!on(w) || !LAWS.includes(kind) || lawOn(w, kind) || openProps(w, [kind]).length) return false; const L = S(w), d = day(w);
        try { if (typeof REPEAL !== 'undefined' && REPEAL.quiet && REPEAL.quiet(w, kind)) return false; } catch (e) {}
        return d - (L.last[kind] ?? -999) >= (ai ? AIGAP : GAP);
    }
    const TITLE = { deal_cap: '訂價格上限', deal_check: '店家品質檢查', deal_cartel: '禁止店家講好一起漲價' };
    const DESC = {
        deal_cap: '{who}提議：三餐、衣服、柴火不得比原價貴超過 {p}%。{why}超過的東家被查到要罰。',
        deal_check: '{who}提議：讓管市場的人可以主動到店裡抽查貨色，不必等有人告發。{why}查到偷工減料要罰，並且公告。',
        deal_cartel: '{who}提議：店家私下講好一起漲價算違法。{why}被查到兩家都罰；先去告發的那一方不罰。',
    };
    function propose(w, kind, who, why) {
        if (!okNow(w, kind, !!w.fullAgentMode) || !who || typeof TECH === 'undefined') return null; const L = S(w);
        const p = TECH.propose(w, kind, kind, who, TITLE[kind], DESC[kind], { why: why || '', p: Math.round(CAP * 100) }, 'economy'); if (p) L.last[kind] = day(w); return p;
    }
    // 把一件事交付審判。f＝sim-deal.js 的一筆事
    function trial(w, f, who) {
        if (!on(w) || !f || !who || typeof TECH === 'undefined') return null; const o = w.agents[f.by]; if (!o || o.isDead || f.tried) return null;
        if (openProps(w, ['deal_trial']).some(p => p.fid === f.id || p.accused === f.by)) return null;
        const pen = f.dead ? 'close' : 'refund';
        const p = TECH.propose(w, 'deal_trial', f.id, who, '審判{o}：{s}的事', pen === 'close' ? '{who}提議審判{o}：{x}，前後 {n} 人出事、{m} 人死了。通過的話，{o}要退錢給出事的人、交出一半的不當所得，{s}勒令歇業 {d} 天，由公所代管。' : '{who}提議審判{o}：{x}。通過的話，{o}要退錢給出事的人、交出一半的不當所得，並且改回來。',
            { o: o.name, s: DEAL.sname(f.key), x: (typeof DEALASK !== 'undefined' && DEALASK) ? DEALASK.factText(w, f) : '', n: f.harm || 0, m: f.dead || 0, d: CLOSE_DAYS }, 'welfare', { o: o.name, s: DEAL.sname(f.key) });
        if (p) { p.fid = f.id; p.accused = f.by; p.pen = pen; f.tried = day(w); S(w).st.trials = (S(w).st.trials || 0) + 1; }
        return p;
    }
    // ---------- 投票（沒開智能體時照個性與處境；開了由 AI 決定，這裡是備用） ----------
    function vote(w, p, a) {
        const D = DEAL.S(w); const owner = DEAL.firmsOf(w, a.agentId).length > 0; const hurt = D.harm.some(h => h.id === a.agentId);
        if (a.agentId === p.proposerId) return { v: 'for', why: 'deal_mine' };
        if (p.kind === 'deal_trial') {
            const f = DEAL.factOf(w, p.fid); const o = w.agents[p.accused];
            if (a.agentId === p.accused) return { v: 'against', why: 'deal_me' };
            if (f && D.harm.some(h => h.id === a.agentId && h.key === f.key)) return { v: 'for', why: 'deal_hurt' };
            if (o && aff(a, o) >= 40) return { v: 'against', why: 'deal_friend' };
            if (owner && Math.random() < 0.7) return { v: 'against', why: 'deal_boss' };
            if (f && f.knows[a.agentId]) return { v: 'for', why: 'deal_know' };
            const pr = (f?.pub ? 0.72 : 0.42) + (f?.dead ? 0.15 : 0) - (o ? aff(a, o) / 200 : 0);
            return Math.random() < pr ? { v: 'for', why: f?.dead ? 'deal_dead' : 'deal_fair' } : { v: 'against', why: 'deal_doubt' };
        }
        if (owner) return { v: 'against', why: 'deal_boss' };
        if (hurt && p.kind !== 'deal_cap') return { v: 'for', why: 'deal_hurt' };
        if (p.kind === 'deal_cap' && cash(w, a) < 30) return { v: 'for', why: 'deal_poor' };
        const pr = 0.62 + (honesty(a) >= 4 ? 0.15 : 0) - (has(a, 'greedy') ? 0.2 : 0);
        return Math.random() < pr ? { v: 'for', why: 'deal_fair' } : { v: 'against', why: 'deal_free' };
    }
    // 金主的影響：審到這些案子時，收過東家錢的人偏向東家。回 null＝不關我的事
    function sway(w, pol, p) {
        if (!pol || !p || !KINDS.includes(p.kind) || typeof POWER === 'undefined' || !w.power) return null; const inf = POWER.S(w).inf[pol.agentId] || {};
        let n = 0; if (p.kind === 'deal_trial') n = (inf[p.accused] || 0) * 1.5; else for (const key of DEAL.firms(w)) n += inf[DEAL.ownerId(w, key)] || 0;
        return n >= 20 ? -Math.min(3, n / 30) : 0;
    }
    // ---------- 通過以後 ----------
    function setLaw(w, kind) { const L = S(w); if (!FIELD[kind]) return ''; L[FIELD[kind]] = day(w); log(w, '⚖️ 鎮上多了一條規定：{t}。', { t: TITLE[kind] }); return t(TITLE[kind]); }
    function punish(w, p) {
        const L = S(w), D = DEAL.S(w), d = day(w); const f = DEAL.factOf(w, p.fid); const o = w.agents[p.accused]; if (!f || !o || o.isDead) return t('當事人不在鎮上了');
        const key = f.key; const st = key ? DEAL.F(w, key) : null; const mine = st && st.by === o.agentId;
        const vs = [...new Set(D.harm.filter(h => h.key === key && !h.dead).map(h => h.id))].map(id => w.agents[id]).filter(a => a && !a.isDead && a !== o);
        let refund = 0; for (const v of vs) { const n = Math.min(REFUND, Math.floor(cash(w, o))); if (n > 0 && WALLET.pay(w, o, v, n)) { refund += n; mem(w, v, '審判通過，{o}退了我 {n} 銀幣。', { o: o.name, n }, 6); rel(v, o)?.modifyAffinity?.(3); } }
        const want = r2((mine ? (st.gain || 0) * 0.5 : 0) + (f.dead || 0) * DEATH_FINE + (f.kind === 'pact' || f.kind === 'hike' ? 15 : 0)); const take = Math.min(want, Math.floor(cash(w, o)));
        if (take > 0 && WALLET.take(w, o, take)) w.stockpile?.add?.('silver', take, w.tickCount, t('罰款與沒收')); if (mine) st.gain = 0;
        if (key && mine) { DEAL.setCut(w, key, 0); if (f.kind !== 'cut' || lawOn(w, 'deal_cap')) DEAL.setUp(w, key, Math.min(st.up, lawOn(w, 'deal_cap') ? 0.1 : st.up)); if (f.kind === 'pact') DEAL.endPact(w, f, 'trial'); }
        if (f.end == null && f.kind !== 'hike') f.end = d;
        let closed = false; if (p.pen === 'close' && key && mine) { L.closed[key] = d + CLOSE_DAYS; closed = true; L.st.closures = (L.st.closures || 0) + 1; }
        L.st.refunds = r2((L.st.refunds || 0) + refund); L.st.taken = r2((L.st.taken || 0) + take); o.moodModifier = (o.moodModifier || 0) - 8; f.judged = d;
        mem(w, o, closed ? '審判通過：我賠了 {n} 銀幣，店還被勒令歇業。' : '審判通過：我賠了 {n} 銀幣。', { n: Math.round(refund + take) }, 9);
        log(w, closed ? '⚖️ 審判通過：{o}退錢 {a}、罰沒 {b} 銀幣，{s}勒令歇業 {d} 天，由公所代管。' : '⚖️ 審判通過：{o}退錢 {a}、罰沒 {b} 銀幣。', { o: o.name, a: Math.round(refund), b: Math.round(take), s: key ? DEAL.sname(key) : '', d: CLOSE_DAYS }, o.name);
        try { w.dailyNews?.collectEvent?.('politics', t('{o}被審判定罪').replace('{o}', t(o.name)), 8, [o.name]); } catch (e) {}
        return t(closed ? '退錢、罰沒，並勒令歇業' : '退錢並罰沒');
    }
    function enact(w, p) { return p.kind === 'deal_trial' ? punish(w, p) : setLaw(w, p.kind); }
    // 官員開罰（不經審判）：罰款進公庫。回傳實際罰到多少
    function fine(w, o, n, why) { n = Math.min(Math.round(n), Math.floor(cash(w, o))); if (!(n > 0) || !WALLET.take(w, o, n)) return 0; w.stockpile?.add?.('silver', n, w.tickCount, t('罰款與沒收')); const L = S(w); L.st.fines = r2((L.st.fines || 0) + n); return n; }
    // ---------- 每天：沒開智能體時，什麼情況會有人提 ----------
    function daily(w) {
        if (!on(w)) return; const L = S(w), d = day(w); if (L.lastDay === d) return; L.lastDay = d;
        for (const [key, u] of Object.entries(L.closed)) if (u < d) { delete L.closed[key]; const o = DEAL.owner(w, key); if (o) log(w, '🔓 {s}歇業期滿，交還給{o}。', { s: DEAL.sname(key), o: o.name }, o.name); }
        if (w.fullAgentMode || d % 3 !== 1) return; const D = DEAL.S(w);
        const pick = (list) => list.filter(a => a && !a.isDead && (a.age ?? 30) >= 16)[0] || null;
        if (okNow(w, 'deal_cap')) { const f = D.facts.find(x => x.kind === 'hike' && x.end == null && (x.lv || 0) >= 0.3 && d - x.d >= 7); if (f) { const st = DEAL.F(w, f.key); const who = pick([w.agents[D.boy?.[f.key]?.lead]].concat(npcs(w).filter(a => D.seen[a.agentId + '|' + f.key] === st.v && a.agentId !== f.by).sort((x, y) => cash(w, x) - cash(w, y)))); if (who) return void propose(w, 'deal_cap', who, t('{s}已經貴了 {p}%。').replace('{s}', t(DEAL.sname(f.key))).replace('{p}', Math.round(f.lv * 100))); } }
        if (okNow(w, 'deal_check')) { const recent = D.harm.filter(h => d - h.d <= 30); if (recent.length >= 3 || recent.some(h => h.dead)) { const who = pick(recent.filter(h => !h.dead).map(h => w.agents[h.id]).concat(npcs(w).filter(a => a.job?.key === 'doctor'))); if (who) return void propose(w, 'deal_check', who, t('這個月已經有 {n} 個人用了店裡的東西出事。').replace('{n}', recent.length)); } }
        if (okNow(w, 'deal_cartel')) { const f = D.facts.find(x => x.kind === 'pact' && d - x.d <= 45 && (x.pub || DEAL.knowers(w, x).filter(a => x.knows[a.agentId] !== 'party').length >= 2)); if (f) { const who = pick(DEAL.knowers(w, f).filter(a => a.agentId !== f.with)); if (who) return void propose(w, 'deal_cartel', who, t('大家都聽說{s}兩家講好一起漲。').replace('{s}', t(DEAL.sname(f.key)))); } }
    }
    // ---------- 開了智能體：發想提案時看得到還沒有的規定 ----------
    function promptParts(w) {
        if (!on(w)) return { ctx: '', fx: '' }; const tr = (x) => t(x); const Ls = [];
        if (okNow(w, 'deal_cap', true)) Ls.push('deal_cap' + tr('＝') + tr('價格上限（三餐、衣服、柴火不得比原價貴超過 12%）'));
        if (okNow(w, 'deal_check', true)) Ls.push('deal_check' + tr('＝') + tr('品質檢查（讓管市場的人可以主動到店裡抽查）'));
        if (okNow(w, 'deal_cartel', true)) Ls.push('deal_cartel' + tr('＝') + tr('禁止店家講好一起漲價（先告發的不罰）'));
        if (!Ls.length) return { ctx: '', fx: '' };
        return { ctx: `\n${tr('【管店家的規定，鎮上還沒有的】')}${Ls.join(tr('；'))}`, fx: `\n{"type":"deal","key":"${tr('上面「管店家的規定」的代碼')}"}${tr('＝提議訂這條管店家的規定')}` };
    }
    function fromAI(w, a, j) {
        const e = (j?.effects || []).find(x => x && x.type === 'deal'); if (!e) return null; const kind = String(e.key || ''); if (!LAWS.includes(kind) || !okNow(w, kind, true)) return null;
        return propose(w, kind, a, '');
    }
    function view(w) { if (!w.deallaw) return null; const L = S(w), d = day(w); return { laws: LAWS.map(k => ({ kind: k, name: t(TITLE[k]), on: lawOn(w, k), days: lawOn(w, k) ? d - L[FIELD[k]] : 0 })), closed: Object.entries(L.closed).filter(([, u]) => u >= d).map(([key, u]) => ({ key, name: t(DEAL.sname(key)), left: u - d })), st: Object.assign({}, L.st) }; }
    return { S, on, LAWS, KINDS, CAP, TITLE, lawOn, closedNow, illegal, okNow, propose, trial, vote, sway, setLaw, punish, enact, fine, daily, promptParts, fromAI, view, CLOSE_DAYS };
})();
if (typeof globalThis !== 'undefined') globalThis.DEALLAW = DEALLAW;
if (DEALLAW) {
    if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { deal_cap: { icon: '🏷️', label: '價格上限' }, deal_check: { icon: '🔎', label: '品質檢查' }, deal_cartel: { icon: '🤝', label: '禁止聯合定價' }, deal_trial: { icon: '⚖️', label: '審判店家' } });
    if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { deal_mine: '這是我提的', deal_me: '被審的就是我', deal_boss: '這是衝著做生意的人來的', deal_hurt: '我自己就出過事', deal_poor: '東西再漲我買不起', deal_friend: '他是我朋友，我不信他會這樣', deal_know: '這件事我知道是真的', deal_dead: '都出人命了，不能就這樣算了', deal_fair: '做生意也要有規矩', deal_free: '買賣是兩邊情願的事，不必管這麼多', deal_doubt: '沒有證據，不能隨便定人的罪' });
    if (typeof ProposalSystem !== 'undefined') {
        const PS = ProposalSystem.prototype;
        const _daily = PS.daily; if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { DEALLAW.daily(w); } catch (e) { console.warn('[DealLaw] daily', e); } return r; };
        const _rv = PS._ruleVote; PS._ruleVote = function (w, p, a, ...rest) { if (DEALLAW.KINDS.includes(p.kind)) { const r = DEALLAW.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
    }
    if (typeof REPEAL !== 'undefined' && REPEAL.LAWS) {
        const boss = (w, a) => (DEAL.firmsOf(w, a.agentId).length ? 3 : 0);
        const mk = (kind, icon, name, why, after, back) => { REPEAL.LAWS[kind] = { icon, name, cat: 'economy', ok: () => true, on: (w) => DEALLAW.lawOn(w, kind), since: (w) => (w.deallaw && w.deallaw[{ deal_cap: 'cap', deal_check: 'check', deal_cartel: 'cartel' }[kind]]) || null, off: (w) => { DEALLAW.S(w)[{ deal_cap: 'cap', deal_check: 'check', deal_cartel: 'cartel' }[kind]] = 0; }, vote: (w, a) => DEALLAW.vote(w, { kind }, a), lead: boss, why, after, set: (w) => DEALLAW.setLaw(w, kind), back }; };
        mk('deal_cap', '🏷️', '價格上限', '做生意的人說，成本漲了卻不能漲價，只能賠本賣。', '廢除以後，店家要漲多少就漲多少。', '有人說少了這條規定，東西又一天比一天貴。');
        mk('deal_check', '🔎', '品質檢查', '做生意的人說，三天兩頭有人上門查，生意沒辦法做。', '廢除以後，只有被人告發才會有人來查。', '有人說少了這條規定，吃的用的又沒人把關。');
        mk('deal_cartel', '🤝', '禁止聯合定價', '做生意的人說，同行之間講講價錢也算犯法，太過分了。', '廢除以後，店家講好一起漲價不再違法。', '有人說少了這條規定，幾家店又聯手漲價。');
    }
    if (typeof World !== 'undefined') {
        const WP = World.prototype;
        const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.deallaw = null; return r; };
        const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.deallaw) d.deallaw = this.deallaw; return d; };
        const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.deallaw = (data?.deallaw && typeof data.deallaw === 'object') ? data.deallaw : null; } catch (e) {} return r; };
    }
}
