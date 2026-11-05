// v6.73.0 歷史與傳承:史書、家族與世仇、傳說人物
// - 史書:每季結束由史官(研究員或最有學問的人)寫一章編年史,收錄這一季的大事(完整智能體模式由 AI 撰寫,否則依大事編排)
// - 家族:同姓的人是一家;三人以上的家族有家訓、家族名聲;兩家人結下的仇多了就成了世仇,代代相傳;兩家聯姻可以化解
// - 傳說:過世的名人(首長、國王、宗教領袖、傳世傑作的作者、創業有成的人…)成為傳說,大家會提起,鎮上可能為他立像
const LEGACY = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const SEASONS = ['春季', '夏季', '秋季', '冬季'];
    function S(w) { if (!w.legacy || !Array.isArray(w.legacy.chapters)) w.legacy = { chapters: [], legends: [], roles: {}, families: {}, feuds: [], lastSeason: null, lastGrave: (w.lifecycle?.graveyard || []).length, lastDay: null }; const L = w.legacy; L.roles = L.roles || {}; L.families = L.families || {}; return L; }
    const surname = (a) => String(a?.name || '').slice(0, 1);
    // ---------- 史書 ----------
    const BIG = /政變|加冕|婚禮|倒閉|翻案|起義|繼承|聖物|結盟|禁運|擠兌|升格|分裂|異端|創立|傳世|傳說|駕崩|離世|當選|coup|crown|wedding|collapse|overturn|uprising|alliance|embargo|grown|schism|founded|masterpiece|died|elected/i;
    function seasonEvents(w) { return (w.messageLog || []).slice(-400).map(m => String(m.content || '')).filter(s => BIG.test(s)).slice(-8); }
    async function chapter(w, L, year, season) {
        const evs = seasonEvents(w); const scribe = npcs(w).filter(a => a.job?.key === 'researcher').sort(() => Math.random() - 0.5)[0] || npcs(w).find(a => a.job?.key === 'priest') || npcs(w)[0]; if (!scribe) return null;
        let title = { k: '第 {y} 年{s}', p: { y: year, s: season } }, text = evs.length ? { k: '這一季鎮上發生了：{list}', p: { list: evs.slice(-5).map(s => s.replace(/^[^\p{L}\p{N}]+/u, '')).join(' / ') } } : { k: '這一季風平浪靜，大家過著平常的日子。', p: {} };
        const ce = ai(w);
        if (ce && evs.length) { try { const prompt = `${t('你是小鎮的史官')}${scribe.name}${t('。請用史書的口吻，把這一季的大事寫成一段編年史（60 字內），並給這一章一個標題（10 字內）。大事')}${t('：')}${evs.join(' / ')}${t('。只輸出 JSON')}${t('：')}{"title":"...","text":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 220); if (j?.text) { text = { k: '{x}', p: { x: String(j.text).slice(0, 160) } }; if (j.title) title = { k: '{x}', p: { x: String(j.title).slice(0, 24) } }; } } catch (e) {} }
        const C = { year, season, by: scribe.name, title, text, n: evs.length };
        L.chapters.push(C); if (L.chapters.length > 24) L.chapters.shift();
        log(w, 'system', '📚 史官{a}寫下了鎮史新的一章〈{t}〉。', { a: scribe.name, t: title }, scribe.name);
        mem(w, scribe, '我替鎮上寫了新的一章歷史。', {}, 6);
        return C;
    }
    // ---------- 名人登記與傳說 ----------
    function roleOf(w, a) {
        try { const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; if (k === a) return '國王'; } catch (e) {}
        try { const b = TIERS.badge(w, a); if ((b && b.cls === 'leader') || w.election?.currentMayor?.(w) === a) return TIERS.leaderTitle(w); } catch (e) {} // 官職標籤要等等級系統跑過一天;現任首長直接算
        try { if (typeof FAITH2 !== 'undefined' && FAITH2.headRel(w, a)) return '宗教領袖'; } catch (e) {}
        try { if ((w.culture?.works || []).some(x => x.by === a.agentId && x.legend)) return '藝術家'; } catch (e) {}
        try { if ((w.biz?.shops || []).some(s => s.owner === a.agentId && s.profit >= 200)) return '富商'; } catch (e) {}
        try { if ((TIERS.S(w).career[a.agentId] || []).some(c => c.role === 'leader')) return '前首長'; } catch (e) {}
        return null;
    }
    function register(w, L) { for (const a of npcs(w)) { const r = roleOf(w, a); if (r) L.roles[a.name] = { role: r, fam: surname(a) }; } }
    function legends(w, L, d) {
        const g = w.lifecycle?.graveyard || []; if (g.length <= (L.lastGrave || 0)) { L.lastGrave = g.length; return; }
        const dead = g.slice(L.lastGrave || 0); L.lastGrave = g.length;
        for (const x of dead) {
            const R = L.roles[x.name]; if (!R || L.legends.some(l => l.name === x.name)) continue;
            const lg = { name: x.name, role: R.role, day: d, fam: R.fam, statue: false };
            L.legends.push(lg); if (L.legends.length > 12) L.legends.shift();
            log(w, 'system', '🏛️ {a}（{r}）走了，成為小鎮的傳說。', { a: x.name, r: R.role }, x.name);
            for (const o of npcs(w)) if (Math.random() < 0.3) mem(w, o, '大家都在懷念{a}，他是鎮上的傳奇。', { a: x.name }, 6);
            // 公庫寬裕就立像
            const tr = w.stockpile?.get?.('silver') || 0;
            if (tr >= 150) { w.stockpile.consume('silver', 80, w.tickCount, t('立像紀念')); lg.statue = true; const P = w.proposals; if (P) { const Lm = P.landmarks || (P.landmarks = []); const sn = tpl('{a}像', { a: x.name }); try { I18N.registerName(sn, `Statue of ${I18N.localizeNames(x.name, true)}`); } catch (e) {} Lm.push({ name: sn, icon: '🗽', by: t('全鎮'), id: 'LG' + d, day: d }); if (Lm.length > 6) Lm.splice(0, Lm.length - 6); } log(w, 'system', '🗽 全鎮出錢在廣場為{a}立像。', { a: x.name }); }
        }
    }
    // ---------- 家族與世仇 ----------
    const MOTTO = [['勤儉持家', 'Thrift and hard work'], ['以誠待人', 'Deal honestly with all'], ['寧折不彎', 'Break, but never bend'], ['和氣生財', 'Harmony brings fortune'], ['讀書明理', 'Learn and understand'], ['一家同心', 'One family, one heart'], ['有恩必報', 'Repay every kindness'], ['不忘根本', 'Never forget our roots']];
    for (const m of MOTTO) { try { I18N.registerName(m[0], m[1]); } catch (e) {} }
    function families(w, L) {
        const groups = {}; for (const a of npcs(w)) { const s = surname(a); if (s) (groups[s] || (groups[s] = [])).push(a); }
        for (const [s, ms] of Object.entries(groups)) {
            if (ms.length < 3) continue; const F = L.families[s] || (L.families[s] = { name: s, motto: null, rep: 0, since: day(w) });
            const eld = ms.slice().sort((x, y) => (y.age || 0) - (x.age || 0))[0]; F.head = eld.name; // 用最年長的人代表這一家(英文名沒有姓氏;單字姓氏也不能登記成名字,會弄壞人名翻譯)
            if (!F.motto) { F.motto = MOTTO[Math.floor(Math.random() * MOTTO.length)]; log(w, 'social', '🏠 {a}一家立下家訓：「{m}」', { a: F.head, m: F.motto[0] }); for (const a of ms) mem(w, a, '我們家的家訓是「{m}」。', { m: F.motto[0] }, 6); }
            let rep = 0; for (const a of ms) { const r = w.dark?.rep?.[a.agentId] || {}; rep += (r.helped || 0) + (r.forgave || 0) - (r.exposed || 0) * 2; try { rep += CLASS.level(w, a) - 1; } catch (e) {} } F.rep = rep; F.n = ms.length;
        }
        // 世仇:兩家人之間互相看不順眼的組合多了
        const names = Object.keys(L.families);
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
            const A = groups[names[i]] || [], B = groups[names[j]] || []; if (!A.length || !B.length) continue;
            let bad = 0, wed = false; for (const a of A) for (const b of B) { if (aff(a, b) <= -40) bad++; const st = a.relationships?.relationships?.[b.agentId]?.status; if (st === 'married') wed = true; }
            const key = [names[i], names[j]].sort().join('|'); const ex = L.feuds.find(f => f.key === key && !f.ended);
            if (!ex && bad >= 2 && !wed) { const ha = L.families[names[i]]?.head || A[0].name, hb = L.families[names[j]]?.head || B[0].name; L.feuds.push({ key, a: names[i], b: names[j], ha, hb, since: day(w), ended: false }); log(w, 'social', '⚔️ {a}一家和{b}一家結下了世仇。', { a: ha, b: hb }); for (const x of [...A, ...B]) mem(w, x, '我們家跟{o}一家是世仇。', { o: A.includes(x) ? hb : ha }, 7); }
            if (ex && wed) { ex.ended = true; log(w, 'social', '💞 {a}一家和{b}一家聯姻，化解了多年的世仇。', { a: ex.ha || names[i], b: ex.hb || names[j] }); }
            if (ex && !ex.ended) for (const a of A) for (const b of B) if (Math.random() < 0.1) { a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(-1); }
        }
    }
    async function daily(w) {
        const L = S(w), d = day(w); if (L.lastDay === d) return; L.lastDay = d;
        register(w, L); legends(w, L, d);
        if (d % 5 === 0) families(w, L);
        const si = Math.floor((d - 1) / 15); if (L.lastSeason === null) L.lastSeason = si;
        if (si > L.lastSeason) { const prevIdx = L.lastSeason; L.lastSeason = si; const year = Math.floor(prevIdx / 4) + 1, season = SEASONS[prevIdx % 4]; await chapter(w, L, year, season); }
    }
    function famOf(w, a) { const L = w.legacy; return L ? L.families[surname(a)] || null : null; }
    function brief(w, a) {
        const L = w.legacy; if (!L) return ''; const F = famOf(w, a); const out = [];
        if (F) { out.push(`${t('你是{f}一家的人').replace('{f}', t(F.head || a.name))}${F.motto ? `${t('，')}${t('家訓')}${t('「')}${t(F.motto[0])}${t('」')}` : ''}`); const fe = L.feuds.filter(x => !x.ended && (x.a === F.name || x.b === F.name)).map(x => (x.a === F.name ? (x.hb || x.b) : (x.ha || x.a))); if (fe.length) out.push(t('跟{o}一家是世仇').replace('{o}', fe.map(n => t(n)).join(t('、')))); }
        return out.join(t('；'));
    }
    function townBrief(w) { const L = w.legacy; if (!L || !L.legends.length) return ''; return `${t('鎮上的傳說人物')}${t('：')}${L.legends.slice(-3).map(l => `${t(l.name)}${t('（')}${t(l.role)}${t('）')}`).join(t('、'))}`; }
    function view(w) { const L = S(w); return { chapters: L.chapters.slice(-4).reverse().map(c => ({ title: Memory.render(c.title.k, c.title.p), text: Memory.render(c.text.k, c.text.p), by: t(c.by) })), legends: L.legends.slice(-5).reverse().map(l => ({ name: t(l.name), role: t(l.role), statue: l.statue })), families: Object.values(L.families).filter(f => f.motto).sort((a, b) => (b.rep || 0) - (a.rep || 0)).slice(0, 5).map(f => ({ name: en() ? `${t(f.head || '')}'s family` : `${f.name}家`, motto: t(f.motto[0]), rep: f.rep || 0, n: f.n || 0 })), feuds: L.feuds.filter(f => !f.ended).map(f => en() ? `${t(f.ha || f.a)}'s family ⚔️ ${t(f.hb || f.b)}'s family` : `${f.a}家 ⚔️ ${f.b}家`) }; }
    return { S, chapter, roleOf, register, legends, families, daily, famOf, brief, townBrief, view, surname, MOTTO };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) LEGACY.daily(w); } catch (e) { console.warn('[Legacy] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief, _tb = CE._townBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.legacy && LEGACY.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = LEGACY.townBrief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.legacy = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.legacy) d.legacy = this.legacy; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.legacy = (data?.legacy && Array.isArray(data.legacy.chapters)) ? data.legacy : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.LEGACY = LEGACY;
