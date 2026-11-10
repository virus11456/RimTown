// v9.13.0 世界史詩:小鎮走到轉折點時,吟遊詩人把它寫成史詩的一篇;每個世界的史詩都不一樣
// - 什麼時候寫:開篇(第一次)、跨進新時代、選定科技路線、城鎮升格／降級、新國王加冕／王位空懸／推翻王室、
//   世界級災厄降臨與撐過、有人得到賢者之石／賢者之石被偷／化為塵土、名人過世成為傳說
//   (每天比對一次世界的狀態,不靠紀錄文字,中英文都一樣)
// - 怎麼寫:規則版用真實的人名、年份、人數寫四句;完整智能體模式交給 AI 寫成詩(用當下的語言)
// - 看得到的互動:被寫進史詩的人會記得、AI 對話會提、閒聊時會炫耀;有人會背史詩裡的句子;
//   鎮況「鎮史」有「翻開史詩」,一頁一篇,點人名鏡頭就跟過去;村民卡有「史詩人物」
// 存在 world.epic(最多 30 篇)
'use strict';

const EPIC = (() => {
    const MAX = 30;
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16);
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const townName = (w) => w.townName || w.townMap?.name || w.townConfig?.townName || '小鎮';
    // 參數:字串 → 翻譯;{zh,en} → 依語言挑;{k,p} → 巢狀模板;其他 → 原樣
    const val = (v) => (v && typeof v === 'object') ? ('zh' in v ? (en() ? (v.en || v.zh) : v.zh) : ('k' in v ? R(v.k, v.p) : '')) : (typeof v === 'string' ? t(v) : String(v ?? ''));
    function R(k, p) { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(val(y)); return s; }
    function S(w) { if (!w.epic || !Array.isArray(w.epic.cantos)) w.epic = { cantos: [], sn: null, lastDay: null, n: 0 }; return w.epic; }
    // ---------- 世界現在的樣子 ----------
    function snap(w) {
        const s = {};
        try { s.era = w.research?.currentEra?.() || 1; } catch (e) { s.era = 1; }
        s.path = w.tech?.path || null;
        try { s.lv = typeof TIERS !== 'undefined' ? TIERS.level(w) : 0; } catch (e) { s.lv = 0; }
        s.king = w.crown?.king || null; s.kingN = s.king ? (w.agents[s.king]?.name || null) : null; s.rep = !!w.crown?.republic;
        s.wc = w.worldcal?.cur?.kind || null;
        s.stone = w.longev?.held?.id || null; s.stoneN = s.stone ? (w.agents[s.stone]?.name || null) : null; s.stolen = w.longev?.st?.stolen || 0; s.dust = w.longev?.st?.dust || 0;
        s.leg = (w.legacy?.legends || []).map(l => l.name);
        s.grave = (w.lifecycle?.graveyard || []).length;
        return s;
    }
    const eraOf = (w, e) => { try { if (typeof TECH !== 'undefined' && TECH.eraName) return TECH.eraName(w, e); } catch (x) {} return (typeof RESEARCH_ERAS !== 'undefined' && RESEARCH_ERAS[e]) || { name: '', icon: '📜' }; };
    const pick = (L) => L[Math.floor(Math.random() * L.length)];
    const hero = (a) => a ? { id: a.agentId, name: a.name } : null;
    const leader = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    const scholar = (w) => npcs(w).filter(a => a.job?.key === 'researcher').sort((x, y) => (y.skills?.get?.('智識')?.xp || 0) - (x.skills?.get?.('智識')?.xp || 0))[0] || null;
    // ---------- 寫一篇 ----------
    function write(w, kind, icon, title, lines, heroes, facts) {
        const E = S(w), d = day(w), c = w.clock || {};
        const C = { n: ++E.n, d, y: c.year || 1, s: c.season || '', kind, icon, title, lines, heroes: (heroes || []).filter(Boolean).slice(0, 3) };
        E.cantos.push(C); if (E.cantos.length > MAX) E.cantos.shift();
        log(w, '📜 吟遊詩人把這件事寫進了史詩：第 {n} 篇〈{t}〉', { n: C.n, t: title }, C.heroes[0]?.name || '');
        try { w.dailyNews?.collectEvent?.('social', R('📜 吟遊詩人把這件事寫進了史詩：第 {n} 篇〈{t}〉', { n: C.n, t: title }), 6, C.heroes.map(h => h.name)); } catch (e) {}
        for (const h of C.heroes) { const a = w.agents[h.id]; try { a?.memory?.addT?.(w.tickCount, c.timeStr || '', 'social', '我被寫進了史詩〈{t}〉。', { t: title }, 7, []); } catch (e) {} }
        poem(w, C, facts); // 完整智能體模式:AI 寫成詩
        return C;
    }
    async function poem(w, C, facts) {
        const ce = ai(w); if (!ce) return;
        try {
            const prompt = `${t('你是小鎮的吟遊詩人。請把這件事寫成史詩的一篇：一個標題（12 字內）和四行詩句（每行 20 字內），要用到真實的人名和數字，口吻莊重但有人情味。事實')}${t('：')}${R(C.title.k, C.title.p)}${t('；')}${C.lines.map(l => R(l.k, l.p)).join(' ')}${facts ? t('；') + facts : ''}${t('。只輸出 JSON')}${t('：')}{"title":"...","lines":["...","...","...","..."]}`;
            ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 260);
            if (j && Array.isArray(j.lines) && j.lines.length) C.ai = { title: String(j.title || '').slice(0, 30), lines: j.lines.slice(0, 6).map(x => String(x).slice(0, 60)), lang: en() ? 'en' : 'zh' };
        } catch (e) {}
    }
    const T = (k, p) => ({ k, p: p || {} });
    function opening(w) {
        const A = adults(w).sort((x, y) => (y.age ?? 30) - (x.age ?? 30)); const a = A[0], b = npcs(w).find(x => x.job?.key === 'farmer' && x !== a) || A[1];
        return write(w, 'open', '🌅', T('開篇・{town}', { town: townName(w) }), [
            T('最初，{town}只是幾間屋子和一條泥土路。', { town: townName(w) }),
            a ? T('{a}是最早點起爐火的人，{b}帶著大家開墾了第一塊田。', { a: a.name, b: b?.name || a.name }) : T('最早的人點起了爐火，開墾了第一塊田。'),
            T('那時鎮上有 {n} 個人，誰也不知道往後會發生什麼。', { n: npcs(w).length }),
        ], [hero(a), hero(b)]);
    }
    // ---------- 每天比對 ----------
    function daily(w) {
        const E = S(w), d = day(w); if (E.lastDay === d) return; E.lastDay = d;
        const now = snap(w), was = E.sn; E.sn = now;
        if (!was) { if (!E.cantos.length && npcs(w).length) opening(w); return; }
        const c = w.clock || {}, yp = { y: c.year || 1, s: c.season || '' }, town = townName(w), pop = npcs(w).length;
        if (now.era > was.era) { const er = eraOf(w, now.era), a = scholar(w);
            write(w, 'era', er.icon || '📜', T('{era}時代', { era: er.name }), [
                T('第 {y} 年{s}，{town}跨進了{era}時代。', { ...yp, town, era: er.name }),
                a ? T('{a}在燈下熬過了無數個夜晚，才換來這一天。', { a: a.name }) : T('學者們在燈下熬過了無數個夜晚，才換來這一天。'),
                T('那一年，鎮上有 {n} 個人。', { n: pop }),
                T('老人搖頭說世道變了，孩子們卻早就習慣了新的東西。'),
            ], [hero(a)]); }
        if (now.path && now.path !== was.path) { const P = (typeof TECH !== 'undefined' && TECH.PATHS?.[now.path]) || { name: now.path, icon: '🛤️' }, a = leader(w);
            write(w, 'path', P.icon || '🛤️', T('{p}之路', { p: P.name }), [
                T('一場大辯論之後，{town}選擇了{p}。', { town, p: P.name }),
                a ? T('{a}站在廣場上說服了大家，也有人從此不再跟他說話。', { a: a.name }) : T('有人歡呼，也有人從此不再說話。'),
                T('從這天起，路只能往一個方向走。'),
            ], [hero(a)]); }
        if (now.lv !== was.lv && typeof TIERS !== 'undefined') { const up = now.lv > was.lv, F = TIERS.LV[was.lv] || {}, Tt = TIERS.LV[now.lv] || {}, a = leader(w);
            write(w, up ? 'up' : 'down', Tt.icon || '🏘️', up ? T('從{from}到{to}', { from: F.zh, to: Tt.zh }) : T('{to}的黃昏', { to: F.zh }), up ? [
                T('第 {y} 年{s}，{town}從{from}升格為{to}。', { ...yp, town, from: F.zh, to: Tt.zh }),
                a ? T('那時帶頭的是{a}。', { a: a.name }) : T('沒有人記得是誰帶的頭，只記得那天很熱鬧。'),
                T('街上的人多了，陌生的面孔也多了。'),
            ] : [
                T('第 {y} 年{s}，{town}從{from}降回了{to}。', { ...yp, town, from: F.zh, to: Tt.zh }),
                T('人一個個離開，空房子越來越多。'),
                a ? T('{a}還守著鎮公所，每天照樣開門。', { a: a.name }) : T('留下來的人還是每天開門。'),
            ], [hero(a)]); }
        if (now.king !== was.king || (now.rep && !was.rep)) {
            const k = now.king ? w.agents[now.king] : null, old = was.king ? (w.agents[was.king] || { name: was.kingN || '' }) : null;
            const dyn = w.crown?.dynasty ? { zh: w.crown.dynasty.zh, en: w.crown.dynasty.en } : '';
            if (now.rep && !was.rep) write(w, 'rep', '🏳️', T('王冠落地'), [T('第 {y} 年{s}，王室被推翻了。', yp), T('從此{town}由大家選出來的人治理。', { town }), old?.name ? T('前一任國王{b}的名字，只剩老人還會提起。', { b: old.name }) : T('王冠被收進了倉庫的角落。')], []);
            else if (k) write(w, 'king', '👑', dyn ? T('{d}', { d: dyn }) : T('{a}的王朝', { a: k.name }), [T('第 {y} 年{s}，{a}戴上了王冠。', { ...yp, a: k.name }), T('有人歡呼，也有人在背後低聲說話。'), old?.name ? T('前一任國王{b}，從此成了故事裡的人。', { b: old.name }) : T('這是{town}的第一頂王冠。', { town })], [hero(k)]);
            else if (was.king) write(w, 'void', '🕯️', T('王位空懸'), [T('第 {y} 年{s}，國王{b}不在了，王位空了出來。', { ...yp, b: old?.name || '' }), T('每個人都在猜，下一個坐上去的會是誰。')], []);
        }
        if (now.wc && now.wc !== was.wc) { const nm = w.worldcal?.cur ? (typeof WORLDCAL !== 'undefined' ? WORLDCAL.KINDS?.[now.wc]?.name : '') || now.wc : now.wc; E.wcGrave = now.grave; E.wcName = nm; E.wcPop = pop;
            write(w, 'wc', w.worldcal?.cur?.icon || '☄️', T('{x}降臨', { x: nm }), [T('第 {y} 年{s}，{x}降臨了。', { ...yp, x: nm }), T('鎮上 {n} 個人望著天色，不知道能不能撐過去。', { n: pop }), T('有人去教堂，有人去酒館，有人什麼都沒說。')], []); }
        if (!now.wc && was.wc) { const nm = E.wcName || was.wc, dead = Math.max(0, now.grave - (E.wcGrave ?? now.grave));
            write(w, 'wcEnd', '🌄', T('撐過{x}', { x: nm }), [T('第 {y} 年{s}，{x}終於過去了。', { ...yp, x: nm }), dead ? T('活下來的 {n} 個人，把走掉的 {m} 個人的名字刻在墓園。', { n: pop, m: dead }) : T('{n} 個人一個都沒少，大家抱在一起哭了。', { n: pop }), T('孩子們長大以後，會把這段日子講給下一代聽。')], []); }
        if (now.stone && now.stone !== was.stone) { const a = w.agents[now.stone], prev = was.stone ? w.agents[was.stone] : null, stolen = now.stolen > was.stolen;
            if (a) write(w, stolen ? 'theft' : 'stone', stolen ? '🗝️' : '💎', stolen ? T('竊石') : T('賢者之石篇'), stolen ? [T('第 {y} 年{s}，賢者之石被偷了。', yp), prev ? T('它從{b}身上，落到了{a}手裡。', { a: a.name, b: prev.name }) : T('最後它落到了{a}手裡。', { a: a.name }), T('這件事在鎮上被傳了好幾個版本。')] : [T('第 {y} 年{s}，{a}得到了賢者之石，從此老得很慢。', { ...yp, a: a.name }), T('有人羨慕，有人說：「憑什麼是他？」'), T('只有石頭自己知道，它會在誰身上待多久。')], [hero(a), hero(prev)]); }
        if (now.dust > was.dust && was.stone) { const nm = was.stoneN || w.agents[was.stone]?.name || '';
            write(w, 'dust', '⏳', T('塵歸塵'), [T('第 {y} 年{s}，賢者之石離了身。', yp), nm ? T('{a}在一夜之間化為塵土，像是把欠下的歲月一次還清。', { a: nm }) : T('它的主人在一夜之間化為塵土。'), T('從此再也沒有人提起長生。')], []); }
        const wasLeg = new Set(Array.isArray(was.leg) ? was.leg : []); if (Array.isArray(was.leg)) for (const lg of (w.legacy?.legends || []).filter(l => !wasLeg.has(l.name))) {
            write(w, 'legend', '🏛️', T('{a}的傳說', { a: lg.name }), [T('第 {y} 年{s}，{a}走了。', { ...yp, a: lg.name }), T('鎮上的人都說，他是一位了不起的{r}。', { r: lg.role }), T('後來的孩子沒見過他，卻都聽過他的故事。')], []); }
    }
    // ---------- 給畫面、村民卡、AI、聊天 ----------
    const textOf = (C) => { if (C.ai && C.ai.lang === (en() ? 'en' : 'zh')) return { title: C.ai.title || R(C.title.k, C.title.p), lines: C.ai.lines }; return { title: R(C.title.k, C.title.p), lines: (C.lines || []).map(l => R(l.k, l.p)) }; };
    function view(w) {
        const E = w.epic; if (!E) return null;
        return { n: E.cantos.length, total: E.n || E.cantos.length, cantos: E.cantos.map(C => { const x = textOf(C); return { n: C.n, icon: C.icon, title: x.title, lines: x.lines, y: C.y, s: C.s, heroes: C.heroes.map(h => ({ id: h.id, name: h.name, alive: !!w.agents[h.id] && !w.agents[h.id].isDead })), ai: !!C.ai }; }) };
    }
    const cantosOf = (w, a) => (w?.epic?.cantos || []).filter(C => C.heroes.some(h => h.id === a?.agentId));
    function tag(w, a) { const L = cantosOf(w, a); return L.length ? `📖 ${t('史詩人物')}${t('：')}${L.slice(-2).map(C => t('〈') + textOf(C).title + t('〉')).join('')}` : ''; }
    function brief(w, a) { const L = cantosOf(w, a); if (!L.length) return ''; return t('你的名字被寫進了鎮上的史詩') + L.slice(-2).map(C => t('〈') + textOf(C).title + t('〉')).join(''); }
    function townBrief(w) { const C = (w.epic?.cantos || []).slice(-1)[0]; return C ? t('鎮上史詩最新的一篇是') + t('〈') + textOf(C).title + t('〉') : ''; }
    // 閒聊:史詩人物會提;也有人會背一句
    function talk(w, a, b, push) {
        const E = w.epic; if (!E || !E.cantos.length || Math.random() > 0.12) return;
        const mine = cantosOf(w, a).slice(-1)[0];
        if (mine && Math.random() < 0.6) { const x = textOf(mine); push(a, R('你知道嗎？史詩〈{t}〉裡有寫到我。', { t: x.title })); push(b, (b.age ?? 30) < 16 ? R('真的嗎！那你是英雄嗎？') : R('知道啊，誰沒聽過那一篇。')); return; }
        const C = E.cantos[Math.floor(Math.random() * E.cantos.length)], x = textOf(C), line = x.lines[Math.floor(Math.random() * x.lines.length)]; if (!line) return;
        push(a, R('史詩〈{t}〉裡是這麼寫的：「{l}」', { t: x.title, l: line })); push(b, (a.age ?? 30) >= 55 ? R('那時候的事，我還記得。') : R('你背得真熟。'));
    }
    // ---------- 史詩書(一頁一篇,可以翻;點人名鏡頭跟過去) ----------
    function openBook(app, i) {
        if (typeof document === 'undefined' || !app?.world) return; const V = view(app.world); if (!V || !V.cantos.length) return;
        const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        let idx = Math.max(0, Math.min(V.cantos.length - 1, i == null ? V.cantos.length - 1 : i));
        let el = document.getElementById('epic-book'); if (el) el.remove();
        el = document.createElement('div'); el.id = 'epic-book'; el.className = 'epic-book'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', t('史詩'));
        const draw = () => {
            const C = V.cantos[idx];
            el.innerHTML = `<div class="epic-page"><button class="epic-x" data-epic="close" aria-label="${esc(t('關閉'))}">✕</button>
                <div class="epic-head">📖 ${esc(t('{town}史詩').replace('{town}', t(townName(app.world))))} <small>${idx + 1} / ${V.cantos.length}</small></div>
                <div class="epic-canto"><div class="epic-icon">${C.icon}</div><div class="epic-no">${esc(t('第 {n} 篇').replace('{n}', C.n))} · ${esc(t('第 {y} 年').replace('{y}', C.y))}${C.s ? esc(t(C.s)) : ''}</div>
                <h3 class="epic-title">${esc(C.title)}</h3>${C.lines.map(l => `<p class="epic-line">${esc(l)}</p>`).join('')}
                ${C.heroes.length ? `<div class="epic-heroes">${C.heroes.map(h => `<button class="epic-hero${h.alive ? '' : ' gone'}" data-epic="hero" data-id="${esc(h.id)}">${h.alive ? '👤' : '🕯️'} ${esc(t(h.name))}</button>`).join('')}</div>` : ''}
                ${C.ai ? `<div class="epic-ai">✍️ ${esc(t('吟遊詩人寫的'))}</div>` : ''}</div>
                <div class="epic-nav"><button data-epic="prev" ${idx <= 0 ? 'disabled' : ''}>‹ ${esc(t('上一篇'))}</button><button data-epic="next" ${idx >= V.cantos.length - 1 ? 'disabled' : ''}>${esc(t('下一篇'))} ›</button></div></div>`;
        };
        el.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-epic]'); if (!b) { if (ev.target === el) el.remove(); return; }
            const k = b.getAttribute('data-epic');
            if (k === 'close') el.remove(); else if (k === 'prev' && idx > 0) { idx--; draw(); } else if (k === 'next' && idx < V.cantos.length - 1) { idx++; draw(); }
            else if (k === 'hero') { const id = b.getAttribute('data-id'); const a = app.world.agents[id]; if (a && !a.isDead) { el.remove(); try { app.tileMap?.followAgent?.(id); app.selectedAgentId = id; } catch (e) {} } else { b.textContent = '🕯️ ' + t('已經不在了'); } }
        });
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') el.remove(); else if (ev.key === 'ArrowLeft' && idx > 0) { idx--; draw(); } else if (ev.key === 'ArrowRight' && idx < V.cantos.length - 1) { idx++; draw(); } });
        el.tabIndex = -1; draw(); document.body.appendChild(el); el.focus();
    }
    return { MAX, S, snap, daily, write, opening, view, tag, brief, townBrief, talk, openBook, textOf, R };
})();

// ---- 掛上:每日、聊天、AI 提示詞、存讀檔 ----
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) EPIC.daily(w); } catch (e) { console.warn('[Epic] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _fb = CE._fallbackConversation;
    CE._fallbackConversation = function (a, b, world, relA, relB) {
        const r = _fb.call(this, a, b, world, relA, relB);
        try {
            if (world.observerMode && world.epic) {
                const L = this.npcConversationLog?.[this.npcConversationLog.length - 1];
                const target = (L && L.agentA === a.name && L.agentB === b.name && Array.isArray(L.dialogue)) ? L.dialogue : (r && Array.isArray(r.dialogue) ? r.dialogue : null);
                if (target) EPIC.talk(world, a, b, (who, text) => { target.push({ speaker: who.name, text }); if (r && Array.isArray(r.dialogue) && r.dialogue !== target) r.dialogue.push({ speaker: who.name, text }); });
            }
        } catch (e) { console.warn('[Epic] talk', e); }
        return r;
    };
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = EPIC.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    if (CE._townBrief) { const _tb = CE._townBrief; CE._townBrief = function (world, ...rest) { const base = _tb.call(this, world, ...rest); try { const x = EPIC.townBrief(world); if (x && typeof base === 'string') return base ? `${base}${t('；')}${x}` : x; } catch (e) {} return base; }; }
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.epic = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.epic) d.epic = this.epic; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.epic = (data?.epic && Array.isArray(data.epic.cantos)) ? data.epic : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.EPIC = EPIC;
