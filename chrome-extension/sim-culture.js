// v6.71.0 文化、宗教、媒體深化
// - 記者選題:每天由一家報社挑當天最重要的事寫頭條,依報社立場下標(完整智能體模式由記者 AI 寫)
// - 讀者投書:立場很強的人投書表態,立場相反的人回嗆,掀起筆戰(兩人交情變差、讀者立場被拉動)
// - 藝術創作:有創意的人(或開畫坊的人)每隔一陣子完成作品(畫、詩、歌),有名字;傑作會變成傳奇藝術品
// - 吟遊詩人:把鎮上的大事(政變、婚禮、倒閉、翻案…)編成歌謠傳唱,成為城鎮傳說,村民日後會提起
// - 講道與神諭:宗教領袖每週依時事講道(信徒更虔誠、立場被影響);通靈型與修真型的人會給模稜兩可的神諭
// - 先知:新教派成立時有自己的教義;重要謠言傳開時,AI 會把它改寫得更離譜
const CULTURE = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    function S(w) { if (!w.culture || !Array.isArray(w.culture.works)) w.culture = { works: [], songs: [], letters: [], sermons: [], oracles: [], heads: [], lastDay: null, n: 0 }; return w.culture; }
    const topEvent = (w) => { const ev = (w.dailyNews?.todayEvents || []).slice().sort((x, y) => (y.importance || 0) - (x.importance || 0))[0]; return ev ? String(ev.content || '').slice(0, 80) : ''; };
    // ---------- 記者選題 ----------
    const SPIN = { cons: '本報認為應該穩住傳統：', prog: '本報認為該改變了：', gossip: '驚爆！', town: '本報報導：', crown: '王室公告：', board: '公告：' };
    async function headline(w, C, d) {
        const R = w.press; if (!R) return; const P = R.papers.filter(p => !p.banned && p.st !== 'board')[d % Math.max(1, R.papers.filter(p => !p.banned && p.st !== 'board').length)]; if (!P) return;
        const ev = topEvent(w); if (!ev) return;
        let k = '{s}{e}', p = { s: SPIN[P.st] || '', e: { k: '{x}', p: { x: ev } } };
        const ce = ai(w); const j0 = w.agents[P.journo];
        if (ce && j0) { try { const prompt = `${t('你是')}${t(P.name[0])}${t('的記者')}${j0.name}${t('（立場')}${t(PRESS.STANCE[P.st].zh)}${t('）。今天鎮上最重要的事')}${t('：')}${ev}${t('。請用報社的立場寫一句頭條（25 字內）。只輸出 JSON')}${t('：')}{"headline":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 90); const h = String(j?.headline || '').trim(); if (h) { k = '{x}'; p = { x: LLMClient.clip(h, 60) }; } } catch (e) {} }
        PRESS.story(w, P, 'headline', k, p, null);
        C.heads.push({ day: d, paper: P.id, k, p }); if (C.heads.length > 6) C.heads.shift();
    }
    // ---------- 讀者投書與筆戰 ----------
    function letters(w, C, d) {
        if (!w.mind || !w.press || Math.random() > 0.35) return; const M = w.mind; const all = npcs(w);
        const writers = all.filter(a => { const o = M.op[a.agentId]; return o && Object.values(o).some(v => Math.abs(v) >= 1.5); }); if (!writers.length) return;
        const a = pick(writers); const o = M.op[a.agentId]; const k = Object.keys(o).sort((x, y) => Math.abs(o[y]) - Math.abs(o[x]))[0];
        const P = PRESS.paperOf(w, a); if (!P || P.banned) return;
        const pro = o[k] > 0; const issue = MIND.ISSUES[k][0];
        PRESS.story(w, P, 'letter', '讀者{a}投書：我{s}{i}！', { a: a.name, s: pro ? '支持' : '反對', i: issue }, null);
        const L = { day: d, a: a.agentId, k, pro, reply: null };
        const foe = all.filter(b => b !== a && M.op[b.agentId] && (M.op[b.agentId][k] * o[k] < 0) && Math.abs(M.op[b.agentId][k]) >= 1)[0];
        if (foe) {
            PRESS.story(w, P, 'letter', '讀者{b}回嗆{a}：你根本不懂！我{s}{i}。', { a: a.name, b: foe.name, s: pro ? '反對' : '支持', i: issue }, null);
            a.relationships.getOrCreate(foe.agentId, foe.name).modifyAffinity(-5); foe.relationships.getOrCreate(a.agentId, a.name).modifyAffinity(-5);
            mem(w, a, '{b}在報上跟我筆戰，真氣人。', { b: foe.name }, 6); L.reply = foe.agentId;
            log(w, 'news', '✒️ {a}和{b}在{paper}上為了{i}打筆戰。', { a: a.name, b: foe.name, paper: P.name[0], i: issue }, a.name);
        }
        for (const r of all) if (w.press.reads[r.agentId] === P.id && r !== a) MIND.shift(w, r, k, (pro ? 0.05 : -0.05) * (L.reply ? 0.5 : 1));
        C.letters.push(L); if (C.letters.length > 8) C.letters.shift();
    }
    // ---------- 藝術創作 ----------
    const ADJ = [['寂靜', 'Silent'], ['燃燒', 'Burning'], ['遠方', 'Distant'], ['破曉', 'Breaking'], ['無名', 'Nameless'], ['金色', 'Golden'], ['雨中', 'Rain-soaked'], ['最後', 'Last']];
    const SUBJ = { painting: [['麥田', 'Wheatfield'], ['港口', 'Harbor'], ['母親', 'Mother'], ['廣場', 'Square'], ['山影', 'Mountain Shadow']], poem: [['離別', 'Farewell'], ['春夜', 'Spring Night'], ['舊友', 'Old Friend'], ['鐘聲', 'Bells']], song: [['歸鄉', 'Homecoming'], ['市集', 'Market Day'], ['燈火', 'Lanterns'], ['小河', 'Little River']] };
    const KINDS = { painting: ['畫作', 'painting', '🖼️'], poem: ['詩', 'poem', '📜'], song: ['歌', 'song', '🎵'] };
    async function art(w, C, d) {
        const makers = npcs(w).filter(a => has(a, 'creative') || (w.biz?.shops || []).some(s => s.owner === a.agentId && s.type === 'studio'));
        for (const a of makers) {
            if (Math.random() > 0.08) continue; const kind = pick(Object.keys(KINDS)); const ad = pick(ADJ), sb = pick(SUBJ[kind]);
            let title = [`${ad[0]}的${sb[0]}`, `The ${ad[1]} ${sb[1]}`];
            const ce = ai(w); if (ce) { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('村民藝術家「')}${b.name}${t('」（')}${b.traits}${t('）完成了一件')}${t(KINDS[kind][0])}${t('。依他最近的心事')}${t('：')}${(b.mem || []).slice(0, 3).join(' / ')}${t('，取一個作品名（10 字內）。只輸出 JSON')}${t('：')}{"title":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 60); const tt = LLMClient.clip(j?.title, 20, 60, true); if (tt) title = [tt, tt]; } catch (e) {} }
            try { I18N.registerName(title[0], title[1]); } catch (e) {}
            const q = Math.min(100, Math.round(40 + Math.random() * 45 + (a.skills?.skills?.藝術?.level || 0) * 2 + (has(a, 'perfectionist') ? 8 : 0)));
            const W = { id: 'A' + (++C.n), by: a.agentId, byName: a.name, kind, title, q, day: d, legend: false };
            C.works.push(W); if (C.works.length > 20) C.works.shift();
            mem(w, a, '我完成了一件{k}〈{t}〉。', { k: KINDS[kind][0], t: title[0] }, 7);
            log(w, 'social', '{i} {a}完成了{k}〈{t}〉。', { i: KINDS[kind][2], a: a.name, k: KINDS[kind][0], t: title[0] }, a.name);
            if (q >= 90) {
                W.legend = true; log(w, 'social', '🌟 〈{t}〉被譽為傳世傑作！', { t: title[0] }, a.name);
                try { const G = GOODS.S(w); (G.owned[a.agentId] || (G.owned[a.agentId] = [])).push({ id: 'G' + (++G.n), key: 'colossus', from: w.townName || '', day: d, price: 0, title: title[0], art: W.id }); if (w.classes) w.classes.lv[a.agentId] = CLASS.compute(w, a); } catch (e) {}
                for (const o of npcs(w)) if (o !== a && Math.random() < 0.3) mem(w, o, '大家都在談{a}的〈{t}〉。', { a: a.name, t: title[0] }, 5);
            }
            break;
        }
    }
    // ---------- 吟遊詩人 ----------
    const BIG = /政變|加冕|婚禮|倒閉|翻案|起義|繼承|聖物|結盟|禁運|擠兌|coup|crown|wedding|collapse|overturn|uprising|alliance|embargo/i;
    async function bard(w, C, d) {
        if (d - (C.lastSong ?? -99) < 7) return; const logs = (w.messageLog || []).slice(-120).map(m => m.content || '').filter(s => BIG.test(s)); if (!logs.length) return;
        const singer = npcs(w).filter(a => has(a, 'creative') || has(a, 'charismatic') || has(a, 'gossip')).sort(() => Math.random() - 0.5)[0]; if (!singer) return;
        const ev = logs[logs.length - 1].replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 60); C.lastSong = d;
        let title = ['{e}之歌', '']; let tp = { e: ev.slice(0, 12) };
        const ce = ai(w); let lyric = '';
        if (ce) { try { const prompt = `${t('你是吟遊詩人')}${singer.name}${t('。把這件鎮上的大事編成一首歌謠')}${t('：')}${ev}${t('。給歌名（8 字內）與一句歌詞（20 字內）。只輸出 JSON')}${t('：')}{"title":"...","line":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 100); if (j?.title) { title = ['{x}', '']; tp = { x: LLMClient.clip(j.title, 20, 60, true) }; lyric = LLMClient.clip(j.line, 50); } } catch (e) {} }
        const song = { day: d, by: singer.name, k: title[0], p: tp, lyric, ev };
        C.songs.push(song); if (C.songs.length > 8) C.songs.shift();
        log(w, 'social', '🎶 {a}把「{e}」編成歌謠〈{t}〉，在酒館傳唱。', { a: singer.name, e: ev, t: { k: song.k, p: song.p } }, singer.name);
        for (const o of npcs(w)) if (o !== singer && Math.random() < 0.4) mem(w, o, '我在酒館聽了{a}唱的〈{t}〉。', { a: singer.name, t: { k: song.k, p: song.p } }, 5);
    }
    // ---------- 講道與神諭 ----------
    function sermon(w, C, d) {
        if (!w.faith || d % 7 !== 3 || typeof FAITH2 === 'undefined') return; const ev = topEvent(w);
        for (const R of w.faith.rels) {
            const h = FAITH2.headOf(w, R); if (!h) continue; const bs = FAITH.believers(w, R);
            const lean = (w.mind?.op?.[h.agentId]?.tech || 0) < 0 ? 'tech' : 'faith';
            log(w, 'social', '⛪ {h}在{r}講道：{x}', { h: h.name, r: R.name[0], x: ev ? { k: '談到「{e}」，要大家守住信仰。', p: { e: ev.slice(0, 30) } } : '要大家彼此扶持、守住信仰。' }, h.name);
            for (const b of bs) { FAITH.bumpP(w, b, 1); if (w.mind && b !== h) MIND.shift(w, b, lean, lean === 'tech' ? -0.05 : 0.05); if (Math.random() < 0.3) mem(w, b, '我去聽了{h}講道。', { h: h.name }, 4); }
            C.sermons.push({ day: d, by: h.name, rel: R.id }); if (C.sermons.length > 6) C.sermons.shift();
        }
    }
    const ORACLE = [['東方會有客人帶來改變。', 'A guest from the east will bring change.'], ['水會說話，聽得懂的人會得到糧食。', 'The water will speak; whoever understands will be fed.'], ['高處的人會跌落，低處的人會抬頭。', 'Those on high will fall; those below will rise.'], ['今年冬天，火比金子珍貴。', 'This winter, fire is worth more than gold.'], ['一個名字會被遺忘，另一個會被歌頌。', 'One name will be forgotten, another sung.']];
    for (const o of ORACLE) { try { I18N.registerName(o[0], o[1]); } catch (e) {} }
    function oracle(w, C, d) {
        if (!w.faith || Math.random() > 0.08) return; const seer = npcs(w).find(a => { const R = FAITH.relOf(w, a); return R && (R.sk === 'ling' || R.sk === 'xiu') && FAITH.pietyOf(w, a) >= 70; }); if (!seer) return;
        const o = pick(ORACLE); C.oracles.push({ day: d, by: seer.name, text: o[0] }); if (C.oracles.length > 5) C.oracles.shift();
        log(w, 'social', '🔮 {a}得到神諭：「{x}」', { a: seer.name, x: o[0] }, seer.name);
        for (const b of npcs(w)) if (b !== seer && FAITH.pietyOf(w, b) >= 50 && Math.random() < 0.4) mem(w, b, '{a}說神諭是「{x}」，我一直在想是什麼意思。', { a: seer.name, x: o[0] }, 6);
    }
    // ---------- 先知與教義 ----------
    const CLAIMS = [['真神只在心中，不在廟裡', 'the divine lives in the heart, not in temples'], ['人人都能直接聽見神的聲音', 'everyone can hear the divine directly'], ['財富是罪，應該分給窮人', 'wealth is a sin and belongs to the poor'], ['勞動就是最好的祈禱', 'work is the truest prayer']];
    for (const c of CLAIMS) { try { I18N.registerName(c[0], c[1]); } catch (e) {} }
    async function doctrine(w, R2, founder) {
        let claim = pick(CLAIMS); const ce = ai(w);
        if (ce && founder) { try { const prompt = `${t('有魅力的村民')}${founder.name}${t('自立新教派「')}${R2.name[0]}${t('」。請替這個教派寫一句核心教義（20 字內）。只輸出 JSON')}${t('：')}{"claim":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 80); const c = LLMClient.clip(j?.claim, 40); if (c) { claim = [c, c]; try { I18N.registerName(c, c); } catch (e) {} } } catch (e) {} }
        R2.doctrine = claim; R2.pre = [claim, ...(R2.pre || []).slice(0, 1)];
        log(w, 'social', '📖 {a}為{r}立下教義：「{x}」', { a: founder?.name || '', r: R2.name[0], x: claim[0] }, founder?.name || '');
    }
    // ---------- 謠言變形 ----------
    async function mutate(w, C, d) {
        if (C.lastMut === d) return; C.lastMut = d; const ce = ai(w); if (!ce || !w.tidings) return;
        const T = w.tidings; const it = T.items.slice().reverse().find(x => x.dist && !x.alt && Object.values(T.known).filter(k => k.includes(x.id)).length >= 3); if (!it) return;
        try { const prompt = `${t('這則消息在鎮上越傳越離譜')}${t('：')}${TIDINGS.render(it)}${t('。請寫出現在傳成什麼樣子（25 字內，誇張但像真的謠言）。只輸出 JSON')}${t('：')}{"rumor":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 80); const s = String(j?.rumor || '').trim(); if (s) { it.alt = LLMClient.clip(s, 60); log(w, 'news', '🗯️ 謠言越傳越離譜：「{x}」', { x: it.alt }); } } catch (e) {}
    }
    function daily(w) {
        const C = S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        if (w.press) headline(w, C, d); letters(w, C, d); art(w, C, d); bard(w, C, d); sermon(w, C, d); oracle(w, C, d); mutate(w, C, d);
    }
    function brief(w) { const C = w.culture; if (!C || !C.songs.length) return ''; return `${t('鎮上傳唱的歌')}${t('：')}${C.songs.slice(-2).map(s => Memory.render(s.k, s.p)).join(t('、'))}`; }
    function view(w) { const C = S(w); return { works: C.works.slice(-5).reverse().map(x => ({ icon: KINDS[x.kind][2], title: en() ? x.title[1] : x.title[0], by: t(x.byName), q: x.q, legend: x.legend })), songs: C.songs.slice(-3).reverse().map(s => ({ title: Memory.render(s.k, s.p), by: t(s.by), lyric: s.lyric })), oracles: C.oracles.slice(-2).map(o => ({ by: t(o.by), text: t(o.text) })) }; }
    return { S, headline, letters, art, bard, sermon, oracle, doctrine, mutate, daily, brief, view, KINDS };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) CULTURE.daily(w); } catch (e) { console.warn('[Culture] daily', e); } return r; };
}
// 新教派的教義
if (typeof FAITH2 !== 'undefined') {
    const _sch = FAITH2.schism;
    FAITH2.schism = function (w, d) { const n0 = w.faith?.rels?.length || 0; const r = _sch.call(this, w, d); try { const rels = w.faith?.rels || []; if (rels.length > n0) { const R2 = rels[rels.length - 1]; CULTURE.doctrine(w, R2, w.agents[w.faith.heads?.[R2.id]]); } } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _tb = CE._townBrief;
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = CULTURE.brief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.culture = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.culture) d.culture = this.culture; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.culture = (data?.culture && Array.isArray(data.culture.works)) ? data.culture : null; for (const x of (this.culture?.works || [])) I18N.registerName(x.title[0], x.title[1]); } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.CULTURE = CULTURE;
