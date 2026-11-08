// v6.58.0 社會階層與貴族頭銜
// - 六階:底層／平民／工匠商人／士紳／貴族／王族;依錢包、職業、官職、頭銜、名聲每天重算
// - 城鎮以上:相差兩階以上的人不會隨機閒聊(熟人、家人、伴侶除外),要靠中間人引薦才認識得到大人物
// - 城市以上:首長會冊封有功的人(騎士 → 男爵 → 子爵 → 伯爵),有錢人也可以花錢買爵位(被舊貴族看不起)
// - AI 知道自己的階層與頭銜;角色卡顯示階層標籤
const CLASS = (() => {
    const NAMES = [
        { zh: '底層', en: 'Underclass', icon: '🥀' }, { zh: '平民', en: 'Commoner', icon: '🧺' }, { zh: '工匠商人', en: 'Craftsfolk & Merchants', icon: '🛠️' },
        { zh: '士紳', en: 'Gentry', icon: '🎩' }, { zh: '貴族', en: 'Nobility', icon: '⚜️' }, { zh: '王族', en: 'Royalty', icon: '👑' },
    ];
    const RANKS = [{ zh: '騎士', en: 'Knight' }, { zh: '男爵', en: 'Baron' }, { zh: '子爵', en: 'Viscount' }, { zh: '伯爵', en: 'Count' }];
    const CRAFT = ['blacksmith', 'carpenter', 'tailor', 'cook', 'trader', 'doctor', 'researcher', 'miner'];
    const BUY_PRICE = 300;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const tier = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const money = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 30);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who); } catch (e) {} };
    const rel = (a, b) => a?.relationships?.relationships?.[b?.agentId];
    function S(w) { if (!w.classes || typeof w.classes.lv !== 'object') w.classes = { lv: {}, titles: {}, day: -1 }; const C = w.classes; C.titles = C.titles || {}; return C; }
    // 一個人現在是哪一階
    function compute(w, a) {
        const C = S(w); if (C.titles[a.agentId]?.royal) return 5;
        if (C.titles[a.agentId]) return 4;
        const m = money(w, a); let lv = a.job ? 1 : 0;
        if (!a.job && m >= 20) lv = 1;
        if (CRAFT.includes(a.job?.key) && m >= 40) lv = 2;
        if (m >= 200) lv = Math.max(lv, 3);
        try { const b = typeof TIERS !== 'undefined' ? TIERS.badge(w, a) : null; if (b && b.cls !== 'former') lv = Math.max(lv, 3); if (b && b.cls === 'former') lv = Math.max(lv, 2); if (b && b.cls === 'clergy' && b.high) lv = Math.max(lv, 4); } catch (e) {} // v6.61.0 城市以上的宗教領袖算貴族
        if ((a.job?.key === 'doctor' || a.job?.key === 'researcher' || a.job?.key === 'priest') && m >= 80) lv = Math.max(lv, 3);
        try { if (typeof GOODS !== 'undefined' && GOODS.prestige(w, a)) lv = Math.max(lv, 3); } catch (e) {} // v6.65.0 收藏藝術珍品的人算士紳
        try { if (typeof MYTHSOC !== 'undefined' && w.mythsoc && MYTHSOC.elite(w, a)) lv = Math.max(lv, 3); } catch (e) {} // v7.6.0 神裔世家
        try { const r = w.dark?.rep?.[a.agentId]; if (r && (r.exposed || 0) >= 2) lv = Math.max(0, lv - 1); } catch (e) {}
        return lv;
    }
    const level = (w, a) => (a ? (S(w).lv[a.agentId] ?? compute(w, a)) : 1);
    const label = (w, a) => { const n = NAMES[level(w, a)]; return en() ? n.en : n.zh; };
    const titleOf = (w, a) => { const T = S(w).titles[a?.agentId]; if (!T || T.royal) return ''; const r = RANKS[Math.min(RANKS.length - 1, T.rank || 0)]; return en() ? r.en : r.zh; };
    // 相差兩階以上,而且不熟、不是家人伴侶 → 不會隨機閒聊
    function canMingle(w, a, b) {
        if (tier(w) < 1 || !a || !b) return true;
        if (Math.abs(level(w, a) - level(w, b)) < 2) return true;
        const r = rel(a, b), r2 = rel(b, a);
        return !!(r && (r.status || (r.affinity || 0) >= 30)) || !!(r2 && (r2.status || (r2.affinity || 0) >= 30)) || (a.homeLocation && a.homeLocation === b.homeLocation && a.job?.key === b.job?.key);
    }
    // ---------- 每天 ----------
    function daily(w) {
        const C = S(w), d = day(w); const all = npcs(w);
        for (const a of all) { const old = C.lv[a.agentId]; const nv = compute(w, a); C.lv[a.agentId] = nv; if (old !== undefined && nv !== old && Math.abs(nv - old) >= 1 && Math.random() < 0.5) mem(w, a, nv > old ? '我現在也算是{c}了，走在路上別人看我的眼神不一樣。' : '從{c}掉了下來，以前的朋友好像不太跟我往來了。', { c: NAMES[nv > old ? nv : old].zh }, 6); }
        for (const id of Object.keys(C.lv)) if (!w.agents[id] && !w.isAway?.(id)) delete C.lv[id]; // v6.87.0 出遠門的人頭銜、階層留著
        for (const id of Object.keys(C.titles)) if (!w.agents[id] && !w.isAway?.(id) && !C.titles[id].royal) delete C.titles[id];
        if (tier(w) >= 1) introduce(w, all);
        if (tier(w) >= 2) titles(w, all, d);
    }
    // 引薦:想往上爬的人,透過兩邊都熟的中間人認識上層的人
    function introduce(w, all) {
        if (Math.random() > 0.35) return;
        const climbers = all.filter(a => level(w, a) <= 2 && ((a.personality?.traits || []).some(t => ['charismatic', 'hardworking', 'creative'].includes(t)) || money(w, a) >= 100));
        const a = climbers[Math.floor(Math.random() * climbers.length)]; if (!a) return;
        for (const c of all) {
            if (c === a || (rel(a, c)?.affinity || 0) < 25) continue;
            const targets = all.filter(b => b !== a && b !== c && level(w, b) >= level(w, a) + 2 && (rel(c, b)?.affinity || 0) >= 25 && !(rel(a, b) && (rel(a, b).affinity || 0) >= 10));
            const b = targets[0]; if (!b) continue;
            a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(12); b.relationships.getOrCreate(a.agentId, a.name).modifyAffinity(6);
            mem(w, a, '{c}幫我引薦，終於認識了{b}。', { c: c.name, b: b.name }, 7); mem(w, b, '{c}介紹了{a}給我認識，看起來是個有心人。', { c: c.name, a: a.name }, 4);
            log(w, '🤝 {c}引薦{a}認識了{b}。', { c: c.name, a: a.name, b: b.name }, a.name);
            return;
        }
    }
    // 冊封與買爵位(城市以上)
    function titles(w, all, d) {
        const C = S(w); let leader = null; try { leader = w.election?.currentMayor?.(w); } catch (e) {}
        // 首長每季冊封一位有功的人;已有頭銜的人立功再晉升
        if (leader && (C.lastGrant ?? -99) <= d - 15 && Math.random() < 0.3) {
            const rec = (a) => { try { const r = w.proposals?.record?.(a.agentId); return (r?.done || 0) * 3 + (r?.approved || 0); } catch (e) { return 0; } };
            const help = (a) => { try { return (w.dark?.rep?.[a.agentId]?.helped || 0) * 2; } catch (e) { return 0; } };
            const cand = all.filter(a => a !== leader).map(a => ({ a, s: rec(a) + help(a) })).filter(x => x.s >= 4).sort((x, y) => y.s - x.s)[0];
            if (cand) {
                const T = C.titles[cand.a.agentId]; C.lastGrant = d;
                if (T && !T.bought) T.rank = Math.min(RANKS.length - 1, (T.rank || 0) + 1);
                else if (!T) C.titles[cand.a.agentId] = { rank: 0, since: d, how: 'granted' };
                const r = RANKS[C.titles[cand.a.agentId].rank]; C.lv[cand.a.agentId] = compute(w, cand.a);
                cand.a.moodModifier = (cand.a.moodModifier || 0) + 10;
                mem(w, cand.a, '{l}冊封我為{r}，這是我一輩子的榮耀。', { l: leader.name, r: r.zh }, 9);
                log(w, '⚜️ {l}冊封{a}為{r}，表彰對鎮上的貢獻。', { l: leader.name, a: cand.a.name, r: r.zh }, cand.a.name);
                try { w.dailyNews?.collectEvent?.('politics', `${cand.a.name}${t('獲封')}${t(r.zh)}`, 7, [cand.a.name]); } catch (e) {}
            }
        }
        // 有錢人花錢買爵位(錢進公庫);舊貴族看不起
        if (Math.random() < 0.15 && typeof WALLET !== 'undefined' && w.wallet) {
            const buyer = all.filter(a => !C.titles[a.agentId] && money(w, a) >= BUY_PRICE * 1.3).sort((x, y) => money(w, y) - money(w, x))[0];
            if (buyer && WALLET.pay(w, buyer, null, BUY_PRICE, t('{a}買爵位').replace('{a}', buyer.name))) {
                C.titles[buyer.agentId] = { rank: 0, since: d, how: 'bought', bought: true }; C.lv[buyer.agentId] = compute(w, buyer);
                mem(w, buyer, '我花了 {n} 銀幣買到騎士頭銜，以後也能出入上流的場合了。', { n: BUY_PRICE }, 8);
                log(w, '💰 {a}花了 {n} 銀幣買下騎士頭銜。', { a: buyer.name, n: BUY_PRICE }, buyer.name);
                for (const o of all) if (C.titles[o.agentId] && !C.titles[o.agentId].bought && o !== buyer) { o.relationships.getOrCreate(buyer.agentId, buyer.name).modifyAffinity(-6); if (Math.random() < 0.5) mem(w, o, '{a}的頭銜是花錢買來的，算什麼貴族。', { a: buyer.name }, 4); }
                try { DARK.secret(w, { kind: 'cover', culprit: buyer.agentId, victim: buyer.agentId, k: '{a}的騎士頭銜是花錢買來的', p: { a: buyer.name } }); } catch (e) {}
            }
        }
    }
    function describe(w, a) {
        if (!a) return ''; const tt = titleOf(w, a);
        return (en() ? 'Social standing: ' : '社會地位' + t('：')) + label(w, a) + (tt ? t('（') + tt + t('）') : '');
    }
    function pyramid(w) { const out = [0, 0, 0, 0, 0, 0]; for (const a of npcs(w)) out[level(w, a)]++; return out; }
    return { NAMES, RANKS, S, compute, level, label, titleOf, canMingle, daily, describe, pyramid, BUY_PRICE };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { const d = this._abs(w); if (w.observerMode && this._classDay !== d) { this._classDay = d; CLASS.daily(w); } } catch (e) { console.warn('[Class] daily', e); } return r; };
}
// 隨機閒聊只找「階層差不多、或本來就熟」的人
if (typeof Agent !== 'undefined' && Agent.prototype._trySocialInteraction) {
    const AP = Agent.prototype; const _try = AP._trySocialInteraction;
    AP._trySocialInteraction = function (world) {
        if (typeof TIERS === 'undefined' || TIERS.level(world) < 1) return _try.call(this, world);
        const me = this; const orig = world.getAgentsAtLocation;
        world.getAgentsAtLocation = function (loc) { return orig.call(this, loc).filter(o => o === me || CLASS.canMingle(world, me, o)); };
        try { return _try.call(this, world); } finally { world.getAgentsAtLocation = orig; }
    };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.classes = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.classes) d.classes = { lv: this.classes.lv, titles: this.classes.titles, lastGrant: this.classes.lastGrant }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.classes = (data?.classes && typeof data.classes.lv === 'object') ? Object.assign({ titles: {} }, data.classes) : null; } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = CLASS.describe(world, a); if (s) { const m = b.mem || []; b.mem = [...m.slice(0, 1), s, ...m.slice(1)]; /* 第一行留給自己的心情與身體狀況 */ } } catch (e) {} return b; };
    const _cp = CE._buildCharacterProfile;
    CE._buildCharacterProfile = function (agent) { const p = _cp.call(this, agent); try { const w = this._world || (typeof window !== 'undefined' && window.rimtownApp?.world); const s = w && CLASS.describe(w, agent); if (s) p.status = `${p.status}${t('；')}${s}`; } catch (e) {} return p; };
}
if (typeof globalThis !== 'undefined') globalThis.CLASS = CLASS;
