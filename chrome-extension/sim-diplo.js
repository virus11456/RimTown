// v6.66.0 外交:跟遠方地點(鄰鎮、王國首都、異國、探險找到的城鎮)的關係
// - 關係 -100～100;首長每十天左右派使節(有魅力的人效果好)、拿珍品當禮物
// - 關係好:簽貿易協定(商人多、賣價好)→ 結盟(盜匪少、災荒時盟友送糧)→ 聯姻(鎮上的人嫁娶過去,關係大升)
// - 關係差:貿易戰(賣價差、商人少)→ 禁運(商人幾乎不來);邊境摩擦、加稅王令、戰爭消息都會讓關係變差
// - 完整智能體模式由首長 AI 決定這次要做什麼;AI 知道鎮上的盟友與對頭
const DIPLO = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who || ''); } catch (e) {} };
    const newsDay = (w) => w.clock.year * 60 + (['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15) + w.clock.day;
    const clamp = (v) => Math.max(-100, Math.min(100, v));
    const ST = { embargo: ['🚫', '禁運', 'Embargo'], war: ['⚔️', '貿易戰', 'Trade war'], cold: ['❄️', '冷淡', 'Cool'], none: ['🤝', '往來', 'Neutral'], trade: ['📜', '貿易協定', 'Trade pact'], ally: ['🛡️', '同盟', 'Alliance'] };
    for (const v of Object.values(ST)) { try { I18N.registerName(v[1], v[2]); } catch (e) {} }
    const statusOf = (r, D, pid) => (D.status?.[pid] === 'ally' ? 'ally' : D.status?.[pid] === 'trade' ? 'trade' : r <= -60 ? 'embargo' : r <= -30 ? 'war' : r < 0 ? 'cold' : 'none');
    function S(w) {
        const T = typeof TIDINGS !== 'undefined' ? TIDINGS.S(w) : null;
        if (!w.diplo || typeof w.diplo.rel !== 'object') w.diplo = { rel: {}, status: {}, log: [], lastAct: -99, lastDay: null, wed: {} };
        const D = w.diplo; D.status = D.status || {}; D.wed = D.wed || {};
        for (const p of (T?.places || [])) if (D.rel[p.id] === undefined) D.rel[p.id] = p.kind === 'capital' ? 30 : p.kind === 'realm' ? 0 : p.id.startsWith('nb:') ? 20 : 10;
        return D;
    }
    const places = (w) => (w.tidings?.places || []);
    const pname = (p) => p.name[0];
    const leader = (w) => { try { const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; return k || w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    function note(w, D, k, p) { D.log.push({ day: day(w), k, p }); if (D.log.length > 12) D.log.splice(0, D.log.length - 12); log(w, k, p, p?.a || ''); }
    function bump(w, pid, n) { const D = S(w); D.rel[pid] = clamp((D.rel[pid] || 0) + n); settle(w, D, pid); }
    // 關係跨過門檻時更新狀態
    function settle(w, D, pid) {
        const r = D.rel[pid]; const p = places(w).find(x => x.id === pid); if (!p) return; const before = D.status[pid] || 'none';
        let st = before;
        if (st === 'ally' && r < 50) st = 'trade'; if (st === 'trade' && r < 20) st = 'none';
        if (st === 'none' && r >= 40) st = 'trade'; if (st === 'trade' && r >= 70) st = 'ally';
        if (st !== before) { D.status[pid] = st; const k = { trade: '📜 跟{p}簽了貿易協定，商人會更常來。', ally: '🛡️ 跟{p}正式結盟！', none: '📉 跟{p}的協定失效了。' }[st]; if (k) note(w, D, k, { p: pname(p) }); }
        const now = statusOf(r, D, pid), was = D._last?.[pid]; (D._last || (D._last = {}))[pid] = now;
        if (was && now !== was && (now === 'war' || now === 'embargo')) note(w, D, now === 'war' ? '⚔️ 跟{p}的關係惡化，打起了貿易戰。' : '🚫 {p}對我們實施禁運！', { p: pname(p) });
    }
    // 外交對經濟的影響(每天刷新一則新聞修正值)
    function effects(w, D) {
        if (!w.news?.bulletins) return; const nd = newsDay(w); const m = {};
        for (const p of places(w)) { const st = statusOf(D.rel[p.id] || 0, D, p.id);
            if (st === 'trade') { m.merchant_chance = (m.merchant_chance || 0) + 0.05; m.sell_bonus = (m.sell_bonus || 0) + 0.03; }
            if (st === 'ally') { m.merchant_chance = (m.merchant_chance || 0) + 0.06; m.sell_bonus = (m.sell_bonus || 0) + 0.04; m.raid_chance = (m.raid_chance || 0) - 0.03; }
            if (st === 'war') { m.sell_bonus = (m.sell_bonus || 0) - 0.05; m.merchant_chance = (m.merchant_chance || 0) - 0.05; }
            if (st === 'embargo') { m.merchant_chance = (m.merchant_chance || 0) - 0.12; m.buy_bonus = (m.buy_bonus || 0) - 0.05; } }
        w.news.bulletins = w.news.bulletins.filter(b => !b.diplo);
        if (Object.keys(m).length) { w.news.bulletins.push({ headline: t('外交關係'), category: 'remote', severity: 'info', flavor: [], modifiers: m, expiresDay: nd + 2, publishedDay: nd, diplo: true }); }
        w.news._rebuildModifiers?.(nd);
    }
    // 首長的外交行動
    function envoy(w, D, p, L) {
        const cand = npcs(w).filter(a => a !== L && a.age >= 20 && !w.events?.getTravellingAgents?.().some(x => x.agentId === a.agentId));
        const e = cand.sort((x, y) => (has(y, 'charismatic') ? 2 : 0) + (has(y, 'kind') ? 1 : 0) - (has(x, 'charismatic') ? 2 : 0) - (has(x, 'kind') ? 1 : 0))[0]; if (!e) return false;
        const gain = 5 + (has(e, 'charismatic') ? 6 : 0) + (has(e, 'abrasive') ? -6 : 0) + Math.floor(Math.random() * 5);
        try { w.events._sendAgentTravelling(w, e, tpl('出使{town}', { town: pname(p) }), Math.min(6, p.dist || 3)); } catch (x) {}
        bump(w, p.id, gain); note(w, D, '🕊️ {a}派{e}出使{p}，兩地關係{d}。', { a: L?.name || '', e: e.name, p: pname(p), d: gain >= 0 ? '變好了' : '更僵了' });
        mem(w, e, '我奉命出使{p}。', { p: pname(p) }, 7); return true;
    }
    function gift(w, D, p, L) {
        const G = w.goods; const it = G?.town?.find(x => !x.rel && !x.gift); if (!it) return false;
        it.gift = p.id; G.town = G.town.filter(x => x !== it); try { const lm = w.proposals?.landmarks; if (lm) w.proposals.landmarks = lm.filter(x => x.id !== it.id); } catch (e) {}
        bump(w, p.id, 20); note(w, D, '🎁 {a}把{g}送給{p}當外交禮物。', { a: L?.name || '', g: GOODS.CAT[it.key]?.zh || '', p: pname(p) }); return true;
    }
    function wed(w, D, p, L) {
        if (D.wed[p.id]) return false; const singles = npcs(w).filter(a => a.age >= 18 && a.age <= 40 && !a.relationships?.getPartner?.() && a !== L);
        const fam = singles.filter(a => L && ((a._parentNames || []).includes(L.name))); const pick = (fam.length ? fam : singles.filter(a => { try { return CLASS.level(w, a) >= 3; } catch (e) { return false; } }))[0]; if (!pick) return false;
        D.wed[p.id] = { name: pick.name, day: day(w) }; bump(w, p.id, 25);
        note(w, D, '💍 {a}遠嫁{p}，兩地結為親家。', { a: pick.name, p: pname(p) });
        for (const o of npcs(w)) if ((o._parentNames || []).includes(pick.name) || (pick._parentNames || []).includes(o.name)) mem(w, o, '{a}嫁到{p}去了，以後很難見面。', { a: pick.name, p: pname(p) }, 8);
        try { w.leaveTown?.(pick.agentId, tpl('聯姻嫁往{town}', { town: pname(p) })); } catch (e) {}
        return true;
    }
    function act(w, D, choice, pid) {
        const p = places(w).find(x => x.id === pid) || places(w)[0]; if (!p) return false; const L = leader(w);
        if (choice === 'gift') return gift(w, D, p, L) || envoy(w, D, p, L);
        if (choice === 'wed' && D.status[p.id] === 'ally') return wed(w, D, p, L) || envoy(w, D, p, L);
        return envoy(w, D, p, L);
    }
    function ruleChoice(w, D) {
        const ps = places(w); if (!ps.length) return null;
        const worst = ps.slice().sort((a, b) => (D.rel[a.id] || 0) - (D.rel[b.id] || 0))[0]; const ally = ps.find(p => D.status[p.id] === 'ally' && !D.wed[p.id]);
        if (ally && Math.random() < 0.3) return ['wed', ally.id];
        if ((D.rel[worst.id] || 0) < -20 && (w.goods?.town || []).some(x => !x.rel)) return ['gift', worst.id];
        const best = ps.filter(p => (D.rel[p.id] || 0) >= 25 && D.status[p.id] !== 'ally').sort((a, b) => (D.rel[b.id] || 0) - (D.rel[a.id] || 0))[0];
        return ['envoy', (best || worst).id];
    }
    async function decide(w, D) {
        const ce = w.conversationEngine; const L = leader(w);
        if (w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && L) {
            try {
                const b = ce._agentBrief(w, L, null); const list = places(w).map(p => `${p.id}=${t(pname(p))}(${Math.round(D.rel[p.id] || 0)}, ${t(ST[statusOf(D.rel[p.id] || 0, D, p.id)][1])})`).join(t('、'));
                const prompt = `${t('你正在扮演首長「')}${b.name}${t('」（')}${t('性格')}${t('：')}${b.traits}${t('）')}${t('。')}${t('外交關係')}${t('：')}${list}${t('。')}${t('珍品')} ${(w.goods?.town || []).length}${t('。')}${t('選一個對象與一種做法：envoy（派使節）、gift（送珍品）、wed（跟同盟聯姻）。只輸出 JSON')}${t('：')}{"pid":"...","act":"envoy","why":"..."}`;
                ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 120);
                if (j && places(w).some(p => p.id === j.pid) && ['envoy', 'gift', 'wed'].includes(j.act)) { D.why = String(j.why || '').slice(0, 60); return act(w, D, j.act, j.pid); }
            } catch (e) {}
        }
        const c = ruleChoice(w, D); return c ? act(w, D, c[0], c[1]) : false;
    }
    function daily(w) {
        const D = S(w), d = day(w); if (D.lastDay === d) return; D.lastDay = d; if (!places(w).length) return;
        // 邊境摩擦(首長脾氣差更容易)
        const L = leader(w); if (Math.random() < 0.04 + (L && has(L, 'abrasive') ? 0.04 : 0)) { const p = places(w)[Math.floor(Math.random() * places(w).length)]; bump(w, p.id, -10); note(w, D, '⚠️ 跟{p}的商人起了衝突，兩地關係變差。', { p: pname(p) }); }
        // 關係慢慢回到中間
        for (const p of places(w)) D.rel[p.id] = (D.rel[p.id] || 0) * 0.995;
        // 盟友在缺糧時送糧
        try { const food = w.stockpile?.get?.('food') || 0; const pop = npcs(w).length; const ally = places(w).find(p => D.status[p.id] === 'ally'); if (ally && food < pop * 2 && (D.aid || -99) < d - 15) { D.aid = d; w.stockpile.add('food', 60, w.tickCount, t('盟友送糧')); note(w, D, '🍞 盟友{p}聽說我們缺糧，送來了 60 份糧食。', { p: pname(ally) }); } } catch (e) {}
        if (d - D.lastAct >= 10) { D.lastAct = d; decide(w, D); }
        effects(w, D);
    }
    // 遠方消息影響關係
    function onTiding(w, it) { if (!it) return; const D = S(w); let n = 0;
        if (/加稅/.test(it.k)) n = -6; else if (/開戰/.test(it.k)) n = -4; else if (/和約|婚禮|壽宴|王子/.test(it.k)) n = 3; else if (/盜匪/.test(it.k)) n = -2;
        if (n) bump(w, it.pid, n); }
    function brief(w) { const D = w.diplo; if (!D) return ''; const ps = places(w); const al = ps.filter(p => D.status[p.id] === 'ally').map(p => t(pname(p))); const foe = ps.filter(p => (D.rel[p.id] || 0) <= -30).map(p => t(pname(p)));
        return [al.length ? `${t('盟友')}${t('：')}${al.join(t('、'))}` : '', foe.length ? `${t('對頭')}${t('：')}${foe.join(t('、'))}` : ''].filter(Boolean).join(t('；')); }
    function view(w) { const D = S(w); return { places: places(w).map(p => { const r = Math.round(D.rel[p.id] || 0); const st = statusOf(r, D, p.id); return { id: p.id, name: t(pname(p)), rel: r, icon: ST[st][0], status: t(ST[st][1]), wed: D.wed[p.id] ? t(D.wed[p.id].name) : null }; }), log: D.log.slice(-5).reverse().map(x => Memory.render(x.k, x.p)), why: D.why || '' }; }
    return { S, daily, act, bump, settle, decide, ruleChoice, onTiding, brief, view, statusOf, effects, ST };
})();
if (typeof TIDINGS !== 'undefined') {
    const _dl = TIDINGS.deliver;
    TIDINGS.deliver = function (w, T, x, ...rest) { const it = _dl.call(this, w, T, x, ...rest); try { if (it && w.diplo) DIPLO.onTiding(w, it); } catch (e) {} return it; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) DIPLO.daily(w); } catch (e) { console.warn('[Diplo] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _tb = CE._townBrief;
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = DIPLO.brief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.diplo = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.diplo) d.diplo = this.diplo; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.diplo = (data?.diplo && typeof data.diplo.rel === 'object') ? data.diplo : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.DIPLO = DIPLO;
