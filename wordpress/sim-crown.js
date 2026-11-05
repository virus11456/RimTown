// v6.59.0 國王(只有王都才有)
// - 升格王都時,由聲望最高的前首長／貴族加冕,議會投票確認;之後世襲(子女繼承),沒有子嗣就繼承危機、議會推舉
// - 正當性(民心)0–100:飢荒、窮困、重稅、醜聞會掉;豐收、繁榮、慈善、盛典會升
// - 王令:國王每十天左右頒布一道(加減稅、節慶、大赦、賑災、禁令),完整智能體模式由 AI 依國況決定並寫詔書
// - 正當性太低:野心家密謀政變(真相頁看得到),成功就改朝換代,失敗走審判;長期民不聊生會爆發起義,可能推翻王室
const CROWN = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const mem = (w, a, k, p, imp = 7) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who); } catch (e) {} };
    const news = (w, s, imp = 9, who = []) => { try { w.dailyNews?.collectEvent?.('politics', s, imp, who); } catch (e) {} };
    const isCapital = (w) => typeof TIERS !== 'undefined' && TIERS.level(w) >= 3;
    const aff = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const money = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const DYN = ['金', '晨', '霜', '鷹', '橡', '曦', '岩', '銀'], DYN2 = ['冠', '輝', '岸', '原', '嶺', '星'];
    const DYN_EN = ['Gold', 'Dawn', 'Frost', 'Hawk', 'Oak', 'Sun', 'Stone', 'Silver'], DYN2_EN = ['crown', 'light', 'shore', 'field', 'ridge', 'star'];
    function S(w) { if (!w.crown || typeof w.crown !== 'object') w.crown = { king: null, legit: 60, history: [], decrees: [], plot: null, unrest: 0, crisis: null, republic: false, lastDecree: -99, poverty: 0 }; return w.crown; }
    const king = (w) => { const C = w.crown; const k = C && C.king ? w.agents[C.king] : null; return k && !k.isDead ? k : null; }; // 國王過世或離開 → 王位空出
    const prestige = (w, a) => {
        let s = 0; try { const c = TIERS.S(w).career[a.agentId] || []; s += c.filter(x => x.role === 'leader').length * 15 + c.filter(x => x.role === 'council').length * 4; } catch (e) {}
        try { const T = CLASS.S(w).titles[a.agentId]; if (T && !T.royal) s += 20 + (T.rank || 0) * 8; } catch (e) {}
        try { const r = w.dark?.rep?.[a.agentId] || {}; s += (r.helped || 0) * 2 - (r.exposed || 0) * 10; } catch (e) {}
        s += Math.min(30, money(w, a) / 20) + (a.age >= 35 ? 5 : 0); return s;
    };
    function setRoyal(w, a, on) { try { const C = CLASS.S(w); if (on) C.titles[a.agentId] = Object.assign(C.titles[a.agentId] || {}, { royal: true }); else if (C.titles[a.agentId]?.royal) { delete C.titles[a.agentId].royal; if (!C.titles[a.agentId].rank && C.titles[a.agentId].rank !== 0) delete C.titles[a.agentId]; } C.lv[a.agentId] = CLASS.compute(w, a); } catch (e) {} }
    function crown(w, a, how) {
        const C = S(w), d = day(w); const old = king(w);
        if (old && old !== a) setRoyal(w, old, false);
        C.king = a.agentId; C.crownedDay = d; C.plot = null; C.crisis = null;
        if (!C.dynasty || how === 'coup' || how === 'elected') { const i = Math.floor(Math.random() * DYN.length), j = Math.floor(Math.random() * DYN2.length); C.dynasty = { zh: DYN[i] + DYN2[j] + '王朝', en: `House of ${DYN_EN[i]}${DYN2_EN[j]}`, founder: a.name }; } try { I18N.registerName(C.dynasty.zh, C.dynasty.en); } catch (e) {}
        C.legit = how === 'coup' ? 45 : how === 'heir' ? Math.max(50, C.legit) : 65;
        C.history.push({ id: a.agentId, name: a.name, from: d, how }); if (C.history.length > 20) C.history.shift();
        setRoyal(w, a, true);
        for (const o of npcs(w)) if ((o._parentNames || []).includes(a.name)) setRoyal(w, o, true);
        const dyn = en() ? C.dynasty.en : C.dynasty.zh;
        const k = { first: '👑 {a}在議會確認下加冕為王，{d}由此開始！', heir: '👑 {a}繼承王位，成為新國王。', elected: '👑 繼承危機落幕，議會推舉{a}登基。', coup: '⚔️ 政變成功！{a}推翻舊王，自立為王，建立{d}。' }[how] || '👑 {a}加冕為王。';
        log(w, 'event', k, { a: a.name, d: dyn }, a.name); news(w, `${a.name}${t('加冕為王')}`, 10, [a.name]);
        mem(w, a, '我加冕為王了。從今天起，整個王都都看著我。', {}, 10);
        for (const o of npcs(w)) if (o !== a) { o.moodModifier = (o.moodModifier || 0) + (how === 'coup' ? -3 : 4); if (Math.random() < 0.3) mem(w, o, '{a}成了國王。', { a: a.name }, 6); }
        try { w.onCrown?.(a, how); } catch (e) {}
    }
    // ---------- 每天 ----------
    function daily(w) {
        const C = S(w), d = day(w);
        if (!isCapital(w)) { if (C.king && !C.republic) { const k = king(w); if (k) setRoyal(w, k, false); log(w, 'event', '🏚️ 王都降級，王室失去了王位。', {}); C.king = null; } return; }
        if (C.republic) return;
        const k = king(w);
        if (!k && C.king) { const old = w.agents[C.king]; if (old) setRoyal(w, old, false); log(w, 'event', '🕯️ 國王{a}駕崩，王位空了出來。', { a: C.history[C.history.length - 1]?.name || '' }); C.king = null; }
        if (!k) { if (!C.crisis) startSuccession(w, C, d, !C.history.length); else resolveCrisis(w, C, d); return; }
        legitimacy(w, C, k);
        royalKids(w, k);
        if (d - (C.lastDecree ?? -99) >= 10) decree(w, C, k, d);
        plot(w, C, k, d);
        uprising(w, C, k, d);
    }
    function startSuccession(w, C, d, first) {
        const prev = C.history[C.history.length - 1];
        // 世襲:先找王室子女
        if (prev) { const heirs = npcs(w).filter(o => (o._parentNames || []).includes(prev.name) && o.age >= 16).sort((x, y) => y.age - x.age); if (heirs[0]) return crown(w, heirs[0], 'heir'); }
        const cands = npcs(w).map(a => ({ a, s: prestige(w, a) })).sort((x, y) => y.s - x.s).slice(0, 3).map(x => x.a);
        if (!cands.length) return;
        if (first) {
            // 第一位國王:聲望最高的人,議會投票確認(多數不反對就加冕)
            const c = cands[0]; const council = (w.council?.members || []).map(id => w.agents[id]).filter(Boolean);
            const yes = council.filter(m => aff(m, c) > -20).length;
            if (!council.length || yes * 2 >= council.length) return crown(w, c, 'first');
            C.crisis = { claimants: cands.map(a => a.agentId), until: d + 3 };
            log(w, 'event', '🏛️ 議會沒能確認第一位國王，三位人選展開角逐。', {});
            return;
        }
        C.crisis = { claimants: cands.map(a => a.agentId), until: d + 3 };
        log(w, 'event', '⚔️ 國王沒有留下子嗣，{list}爭奪王位，繼承危機爆發！', { list: cands.map(a => a.name).join(t('、')) });
        news(w, t('王位繼承危機'), 10, cands.map(a => a.name));
        for (const a of cands) mem(w, a, '王位空著，我要爭這個位子。', {}, 8);
    }
    function resolveCrisis(w, C, d) {
        const cl = (C.crisis.claimants || []).map(id => w.agents[id]).filter(a => a && !a.isDead);
        if (!cl.length) { C.crisis = null; return; }
        // 爭位期間各自拉票(花錢、拉交情)
        for (const a of cl) for (const m of (w.council?.members || []).map(id => w.agents[id]).filter(Boolean)) if (Math.random() < 0.3) { m.relationships.getOrCreate(a.agentId, a.name).modifyAffinity(3); try { if (money(w, a) > 50 && Math.random() < 0.4) { WALLET.pay(w, a, m, 10); try { DARK.secret(w, { kind: 'scheme', culprit: a.agentId, victim: m.agentId, k: '{a}私下塞錢給{m}拉票爭王位', p: { a: a.name, m: m.name } }); } catch (e) {} } } catch (e) {} }
        if (d < C.crisis.until) return;
        const council = (w.council?.members || []).map(id => w.agents[id]).filter(Boolean);
        const votes = cl.map(a => ({ a, v: council.reduce((s, m) => s + (aff(m, a) + prestige(w, a) * 0.3 > 0 ? 1 : 0) + aff(m, a) / 200, 0) + Math.random() })).sort((x, y) => y.v - x.v);
        crown(w, votes[0].a, 'elected');
        for (const x of votes.slice(1)) { mem(w, x.a, '王位被{a}搶走了，這筆帳我記下了。', { a: votes[0].a.name }, 8); x.a.relationships.getOrCreate(votes[0].a.agentId, votes[0].a.name).modifyAffinity(-25); }
    }
    function legitimacy(w, C, k) {
        let delta = (60 - C.legit) * 0.03;
        try { const I = w.proposals?.issues || {}; for (const [key, i] of Object.entries(I)) { if (/^(food|heating|poverty|wages)$/.test(key)) delta -= (i.sev || 1) * 0.6; } } catch (e) {}
        if ((w.wallet?.tax ?? 0.1) > 0.15) delta -= 1.2;
        if ((w.prosperity?.prosperity || 0) >= 80) delta += 0.6;
        try { const r = w.dark?.rep?.[k.agentId] || {}; delta -= (r.exposed || 0) * 0.5; } catch (e) {}
        const avg = npcs(w).reduce((s, a) => s + (a.mood || 50), 0) / Math.max(1, npcs(w).length); delta += (avg - 50) * 0.02;
        C.legit = Math.max(0, Math.min(100, C.legit + delta));
        try { C.poverty = (w.proposals?.issues?.poverty || w.proposals?.issues?.food) ? (C.poverty || 0) + 1 : 0; } catch (e) {}
    }
    function royalKids(w, k) { for (const o of npcs(w)) if ((o._parentNames || []).includes(k.name)) { try { if (!CLASS.S(w).titles[o.agentId]?.royal) setRoyal(w, o, true); } catch (e) {} } }
    // ---------- 王令 ----------
    const DECREES = {
        tax_down: { zh: '減稅令', en: 'Tax Relief Decree', icon: '📉', legit: 6, apply: (w) => { if (w.wallet) w.wallet.tax = Math.max(0.03, (w.wallet.tax ?? 0.1) - 0.05); } },
        tax_up: { zh: '加稅令', en: 'Tax Increase Decree', icon: '📈', legit: -8, apply: (w) => { if (w.wallet) w.wallet.tax = Math.min(0.3, (w.wallet.tax ?? 0.1) + 0.05); } },
        festival: { zh: '王室慶典', en: 'Royal Festival', icon: '🎉', legit: 5, apply: (w) => { for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + 6; w.stockpile?.consume?.('silver', Math.min(80, w.stockpile.get('silver') || 0), w.tickCount, t('王室慶典')); } },
        relief: { zh: '賑災令', en: 'Relief Decree', icon: '🍞', legit: 8, apply: (w) => { if (typeof WALLET === 'undefined' || !w.wallet) return; const poor = npcs(w).filter(a => WALLET.get(w, a) < 10); const per = Math.min(15, Math.floor((w.stockpile?.get?.('silver') || 0) / Math.max(1, poor.length) / 2)); for (const a of poor) if (per > 0 && w.stockpile.consume('silver', per, w.tickCount, t('賑災'))) WALLET.add(w, a, per); } },
        amnesty: { zh: '大赦令', en: 'Amnesty Decree', icon: '🕊️', legit: 4, apply: (w) => { try { const D = w.dark; if (D) { D.labor = []; } } catch (e) {} } },
        curfew: { zh: '宵禁令', en: 'Curfew Decree', icon: '🌙', legit: -5, apply: (w) => { for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) - 3; } },
    };
    function ruleDecree(w, C) {
        const I = w.proposals?.issues || {}; const tr = w.stockpile?.get?.('silver') || 0;
        if ((I.poverty || I.food) && tr > 60) return 'relief';
        if (tr < 40) return 'tax_up';
        if (C.legit < 40 && (w.wallet?.tax ?? 0.1) > 0.06) return 'tax_down';
        if (C.legit < 50 && tr > 120) return 'festival';
        return ['festival', 'amnesty', 'tax_down', 'curfew'][Math.floor(Math.random() * 4)];
    }
    function decree(w, C, k, d) {
        C.lastDecree = d;
        const issue = (key, text) => {
            const D = DECREES[key] || DECREES.festival; try { D.apply(w); } catch (e) {}
            C.legit = Math.max(0, Math.min(100, C.legit + D.legit));
            const rec = { key, day: d, king: k.name, text: text || '' }; C.decrees.push(rec); if (C.decrees.length > 12) C.decrees.shift();
            log(w, 'event', '📜 {k}頒布{n}{q}', { k: k.name, n: D.zh, q: text ? `${t('：')}${t('「')}${text}${t('」')}` : '' }, k.name);
            news(w, `${t(D.zh)}${text ? `${t('：')}${text}` : ''}`, 9, [k.name]);
            for (const a of npcs(w)) if (Math.random() < 0.15) mem(w, a, D.legit >= 0 ? '國王頒布了{n}，這下日子好過一點。' : '國王頒布了{n}，大家都在抱怨。', { n: D.zh }, 5);
        };
        const ce = w.conversationEngine;
        if (w.fullAgentMode && ce?.decideDecree && ce.fullAgentOk?.(w)) { ce.decideDecree(w, k, C, Object.keys(DECREES)).then(r => { if (r && DECREES[r.key]) issue(r.key, r.text); else issue(ruleDecree(w, C)); }).catch(() => issue(ruleDecree(w, C))); }
        else issue(ruleDecree(w, C));
    }
    // ---------- 政變 ----------
    function plot(w, C, k, d) {
        if (!C.plot) {
            if (C.legit >= 35 || Math.random() > 0.2) return;
            const am = npcs(w).filter(a => a !== k && prestige(w, a) >= 20 && aff(a, k) < 10).sort((x, y) => (aff(x, k) - prestige(w, x)) - (aff(y, k) - prestige(w, y)))[0];
            if (!am) return;
            C.plot = { leader: am.agentId, members: [am.agentId], start: d, ready: d + 6 + Math.floor(Math.random() * 5) };
            mem(w, am, '國王失去民心，是時候了。我要聯絡幾個信得過的人。', {}, 9);
            try { const sc = DARK.secret(w, { kind: 'scheme', plan: true, culprit: am.agentId, victim: k.agentId, k: '{a}正在密謀推翻國王{k}', p: { a: am.name, k: k.name } }); C.plot.sec = sc?.id || null; } catch (e) {}
            return;
        }
        const P = C.plot, L = w.agents[P.leader]; if (!L || L.isDead) { C.plot = null; return; }
        // 拉人:跟主謀交好、跟國王處不好的人
        for (const o of npcs(w)) if (o !== k && !P.members.includes(o.agentId) && aff(o, L) > 20 && aff(o, k) < 0 && Math.random() < 0.25) { P.members.push(o.agentId); mem(w, o, '{l}拉我加入推翻國王的計畫，我答應了。', { l: L.name }, 8); }
        // 被忠臣識破
        const loyal = npcs(w).filter(o => o !== L && !P.members.includes(o.agentId) && aff(o, k) > 30);
        let caught = false; try { caught = loyal.some(o => Math.random() < 0.02 * DARK.insight(o)); } catch (e) { caught = Math.random() < 0.04; }
        if (caught) { foiled(w, C, k, L, P, 'caught'); return; }
        if (d < P.ready) return;
        const chance = Math.min(0.85, P.members.length * 0.12 + (40 - C.legit) / 100);
        if (Math.random() < chance) { log(w, 'event', '⚔️ 深夜裡{l}帶著 {n} 人衝進王宮……', { l: L.name, n: P.members.length }, L.name); for (const id of P.members) { const m = w.agents[id]; if (m) mem(w, m, '我們成功了，舊王被趕下台。', {}, 9); } mem(w, k, '我被{l}推翻了，王位沒了。', { l: L.name }, 10); try { DARK.bump(w, L, 'scheme'); } catch (e) {} crown(w, L, 'coup'); }
        else foiled(w, C, k, L, P, 'failed');
    }
    function foiled(w, C, k, L, P, how) {
        C.plot = null; C.legit = Math.min(100, C.legit + 6);
        log(w, 'event', how === 'caught' ? '🛡️ 忠臣識破了{l}的政變陰謀，同謀 {n} 人全數落網。' : '🛡️ {l}發動政變失敗，同謀 {n} 人被捕。', { l: L.name, n: P.members.length }, L.name);
        news(w, `${L.name}${t('政變失敗')}`, 10, [L.name]);
        mem(w, L, '政變失敗了，我會被怎麼處置……', {}, 10); mem(w, k, '{l}想推翻我，幸好及時發現。', { l: L.name }, 9);
        L.relationships.getOrCreate(k.agentId, k.name).modifyAffinity(-30); k.relationships.getOrCreate(L.agentId, L.name).modifyAffinity(-50);
        try { DARK.wrong(w, L, k, 3, '密謀推翻{v}', { v: k.name }); } catch (e) {}
        try { if (typeof DARK !== 'undefined') { const D = DARK.S(w); let sc = (D.secrets || []).find(x => x.id === P.sec); if (!sc) sc = DARK.secret(w, { kind: 'scheme', culprit: L.agentId, victim: k.agentId, k: '{a}正在密謀推翻國王{k}', p: { a: L.name, k: k.name } }); sc.found = true; D.exposedCount[L.agentId] = Math.max(2, (D.exposedCount[L.agentId] || 0) + 1); DARK.bump(w, L, 'exposed'); DARK.proposeVerdict(w, sc, L, k, k); } } catch (e) { console.warn('[Crown] verdict', e); } // 政變是重罪:至少公共勞役
    }
    // ---------- 起義 ----------
    function uprising(w, C, k, d) {
        if (C.legit >= 20 || (C.poverty || 0) < 5 || Math.random() > 0.25) return;
        const angry = npcs(w).filter(a => a !== k && (a.mood || 50) < 40); const guards = npcs(w).filter(a => a.job?.key === 'guard' && aff(a, k) > 0).length;
        if (angry.length < 5) return;
        const win = angry.length * 0.04 + (20 - C.legit) * 0.02 - guards * 0.05;
        log(w, 'event', '🔥 {n} 個走投無路的平民衝上街頭，要國王{k}給個交代！', { n: angry.length, k: k.name });
        if (Math.random() < win) {
            C.republic = true; setRoyal(w, k, false); for (const o of npcs(w)) { try { if (CLASS.S(w).titles[o.agentId]?.royal) setRoyal(w, o, false); } catch (e) {} }
            C.history.push({ id: null, name: '', from: d, how: 'republic' }); C.king = null;
            log(w, 'event', '🏳️ 起義成功，王室被推翻！王都改由民選的市長治理。', {}); news(w, t('起義推翻王室'), 10, []);
            for (const a of angry) { a.moodModifier = (a.moodModifier || 0) + 10; mem(w, a, '我們推翻了國王，從今以後自己當家作主。', {}, 9); }
            mem(w, k, '我被人民趕下王位了。', {}, 10);
        } else {
            C.legit = Math.max(0, C.legit - 5); for (const a of angry) { a.moodModifier = (a.moodModifier || 0) - 8; if (Math.random() < 0.3) mem(w, a, '起義被衛兵鎮壓了，朋友被抓走……', {}, 8); }
            log(w, 'event', '🛡️ 衛兵鎮壓了起義，街上一片狼藉。', {});
        }
    }
    function brief(w) { const C = w.crown; if (!C) return ''; if (C.republic) return t('王都已推翻王室，改為共和'); const k = king(w); if (!k) return C.crisis ? t('王位空懸，繼承危機中') : ''; return `${t('國王')}${t('：')}${t(k.name)}${t('（')}${en() ? C.dynasty?.en || '' : C.dynasty?.zh || ''}${t('，')}${t('民心')} ${Math.round(C.legit)}/100${t('）')}`; }
    function view(w) { const C = w.crown; if (!C) return null; const k = king(w); return { king: k ? t(k.name) : null, dynasty: C.dynasty ? (en() ? C.dynasty.en : C.dynasty.zh) : '', legit: Math.round(C.legit), decrees: (C.decrees || []).slice(-3).reverse(), crisis: C.crisis ? C.crisis.claimants.map(id => w.agents[id]?.name).filter(Boolean).map(n => t(n)) : null, republic: !!C.republic, plot: C.plot ? { leader: w.agents[C.plot.leader]?.name, n: C.plot.members.length } : null, history: C.history.slice(-5) }; }
    return { S, daily, king, crown, brief, view, DECREES, prestige };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { const d = this._abs(w); if (w.observerMode && this._crownDay !== d) { this._crownDay = d; CROWN.daily(w); } } catch (e) { console.warn('[Crown] daily', e); } return r; };
}
// 國王的官職標籤;國王不再參選市長
if (typeof TIERS !== 'undefined') {
    const _q = TIERS.qualified;
    TIERS.qualified = function (w, a) { try { const k = CROWN.king(w); if (k && a && k.agentId === a.agentId) return false; } catch (e) {} return _q.call(this, w, a); };
    const _badge = TIERS.badge;
    TIERS.badge = function (w, a) { try { const k = CROWN.king(w); if (k && a && k.agentId === a.agentId) return { cls: 'king', icon: '👑', text: t('國王') }; } catch (e) {} return _badge.call(this, w, a); };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.crown = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.crown) d.crown = this.crown; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.crown = (data?.crown && typeof data.crown === 'object') ? data.crown : null; if (this.crown?.dynasty) I18N.registerName(this.crown.dynasty.zh, this.crown.dynasty.en); } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _tb = CE._townBrief;
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = CROWN.brief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
    // 完整智能體:國王依國況選王令並寫一句詔書
    CE.decideDecree = async function (world, king, C, keys) {
        if (!this.fullAgentOk?.(world)) return null;
        const b = this._agentBrief(world, king, null);
        const list = keys.map(k => `${k}=${t(CROWN.DECREES[k].zh)}`).join(t('、'));
        const prompt = `${t('你正在扮演國王「')}${b.name}${t('」（')}${t('性格')}${t('：')}${b.traits}${t('；')}${t('在乎')}${t('：')}${b.values}${t('）')}${t('。')}
${t('【國況】')}${this._townBrief(world)}${t('；')}${t('民心')} ${Math.round(C.legit)}/100${t('；')}${t('公庫')} ${Math.round(world.stockpile?.get?.('silver') || 0)}${t('；')}${t('稅率')} ${Math.round((world.wallet?.tax ?? 0.1) * 100)}%
${t('請依你的性格與國況，從這些王令選一道頒布')}${t('：')}${list}${t('。')}${t('再用國王的口吻寫一句詔書（25 字內）。')}
${t('只輸出 JSON')}${t('：')}{"key":"…","text":"…"}`;
        try { this._countNpcLlmUse?.(world); const j = await this._askJson(prompt, 160); if (j && typeof j.key === 'string') return { key: j.key, text: String(j.text || '').slice(0, 60) }; } catch (e) {}
        return null;
    };
}
if (typeof globalThis !== 'undefined') globalThis.CROWN = CROWN;
