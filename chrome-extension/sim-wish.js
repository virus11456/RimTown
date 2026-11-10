// v9.15.0 自己打一句話當事件:神(玩家)寫下一句話,它就變成鎮上真的發生的一件事
// - 花 6 神力、一天一次;寫完照一般事件卡記進「反應追蹤」(村民的反應、事後的提案、七天後的變化)
// - 有 AI 時:AI 讀這句話、鎮況、村民名單,寫成標題、圖示、一小段經過、兩三個村民的反應,效果只能用白名單
//   (資源、連續幾天的產出、心情、兩人關係、政令加成、新傳統、地標、天氣、受傷生病、治好、送錢給某人),數值都夾在範圍內
// - 沒有 AI 時:看關鍵字(下雨、暴風、雪、流星、火災、豐收、寶藏、瘟疫、地震、慶典、吵架、戀愛、治病、商隊…)組出效果
// - 錢:送錢給某人算「神給的」,記進金流帳(跟事件卡一樣)
'use strict';

const WISH = (() => {
    const COST = 6, MAXLEN = 60;
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 14 && !w.isAway?.(a.agentId));
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const rnd = (L) => L[Math.floor(Math.random() * L.length)];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
    const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
    const powerOf = (w) => (typeof CALAMITY !== 'undefined' ? CALAMITY.power(w) : Infinity);
    const spend = (w, n) => (typeof CALAMITY !== 'undefined' ? CALAMITY.spend(w, n) : true);
    const byName = (w, n) => { n = String(n || '').trim(); if (!n) return null; const L = (x) => (typeof I18N !== 'undefined' && I18N.delocalizeNames) ? I18N.delocalizeNames(x) : x; return npcs(w).find(a => a.name === n || a.name === L(n) || t(a.name) === n) || null; };
    const WEATHER = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'wind', 'heatwave', 'drought', 'blizzard'];
    function S(w) { if (!w.wish || typeof w.wish !== 'object') w.wish = { n: 0, day: null, last: null, busy: false }; return w.wish; }
    function canCast(w) {
        const W = S(w); if (W.busy) return { ok: false, why: 'busy' };
        if (W.day === day(w)) return { ok: false, why: 'daily' };
        if (powerOf(w) < COST) return { ok: false, why: 'power' };
        return { ok: true };
    }

    // ---------- 效果:只留白名單、數值夾在範圍內 ----------
    function sanitize(w, raw) {
        const list = Array.isArray(raw) ? raw.slice(0, 8) : []; const out = [];
        const shared = list.filter(e => e && ['resource', 'daily', 'mood', 'relation', 'modifier', 'tradition', 'landmark'].includes(String(e.type || '').toLowerCase()));
        try { if (typeof FREEPROP !== 'undefined') for (const e of FREEPROP.sanitize(w, shared)) if (['resource', 'daily', 'mood', 'relation', 'modifier', 'tradition', 'landmark'].includes(e.type) && !((e.type === 'resource' || e.type === 'daily') && ['silver', 'research_points'].includes(e.res))) out.push(e); } catch (e) {} // 錢只能用「送錢給某人」(記進金流帳)
        for (const e of list) {
            if (!e || typeof e !== 'object') continue; const ty = String(e.type || '').toLowerCase();
            if (ty === 'weather' && WEATHER.includes(e.key)) out.push({ type: 'weather', key: e.key, days: Math.round(clamp(e.days || 2, 1, 3)) });
            else if (ty === 'hurt') { const a = byName(w, e.who); const kind = e.kind === 'fever' ? 'fever' : 'injury'; const n = a ? 1 : Math.round(clamp(e.n || 1, 1, 3)); out.push({ type: 'hurt', id: a?.agentId || null, name: a?.name || '', n, kind }); }
            else if (ty === 'heal') { const a = byName(w, e.who); out.push({ type: 'heal', id: a?.agentId || null, name: a?.name || '' }); }
            else if (ty === 'gift') { const a = byName(w, e.who); const n = Math.round(clamp(e.amount, 1, 100)); if (n) out.push({ type: 'gift', id: a?.agentId || null, name: a?.name || '', amount: n }); }
        }
        return out.slice(0, 6);
    }
    function describe(w, e) {
        const W = (typeof WEATHER_TYPES !== 'undefined') ? WEATHER_TYPES : {};
        if (e.type === 'weather') return t('天氣變成{x}（{d} 天）').replace('{x}', W[e.key]?.name?.() || e.key).replace('{d}', e.days);
        if (e.type === 'hurt') return (e.kind === 'fever' ? t('{who}病倒了') : t('{who}受了傷')).replace('{who}', e.name ? t(e.name) : t('{n} 個人').replace('{n}', e.n));
        if (e.type === 'heal') return t('{who}的病痛好了').replace('{who}', e.name ? t(e.name) : t('全鎮'));
        if (e.type === 'gift') return t('{who}得到 {n} 銀幣').replace('{who}', e.name ? t(e.name) : t('一個幸運的人')).replace('{n}', e.amount);
        try { return typeof FREEPROP !== 'undefined' ? FREEPROP.describe(w, e) : ''; } catch (x) { return ''; }
    }

    // ---------- 套用到世界 ----------
    const X = {
        apply(w, ev) {
            const out = [], hit = new Set(), d = day(w); const src = t('神蹟');
            for (const e of ev.fx) {
                try {
                    if (e.type === 'resource') { if (e.amount > 0) w.stockpile.add(e.res, e.amount, w.tickCount, src, 'event'); else w.stockpile.consume(e.res, Math.min(-e.amount, w.stockpile.get(e.res)), w.tickCount, src, 'event'); }
                    else if (e.type === 'daily') { const P = w.proposals; if (P) (P.ongoing || (P.ongoing = [])).push({ pid: 'W' + ev.n, res: e.res, amount: e.amount, until: d + e.days }); }
                    else if (e.type === 'mood') { for (const a of npcs(w).filter(a => e.who === 'all' || (e.who.startsWith('job:') && a.job?.key === e.who.slice(4)) || (e.who.startsWith('trait:') && a.personality?.traits?.includes(e.who.slice(6))) || (e.who.startsWith('id:') && a.agentId === e.who.slice(3)))) { a.moodModifier = (a.moodModifier || 0) + e.amount; if (e.who !== 'all') hit.add(a.agentId); } }
                    else if (e.type === 'relation') { const a = w.agents[e.a], b = w.agents[e.b]; if (a && b) { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(e.amount); b.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(e.amount); hit.add(a.agentId); hit.add(b.agentId); } }
                    else if (e.type === 'modifier') { if (w.council) { w.council.activeDecrees = w.council.activeDecrees || []; w.council.activeDecrees.push({ id: 'wish_' + ev.n + '_' + e.key, title: ev.title, effects: { [e.key]: e.value }, expiresDay: d + e.days }); w.council._aggregateDecrees?.(w); } }
                    else if (e.type === 'tradition') { const P = w.proposals; if (P) { const L = P.traditions || (P.traditions = []); L.push({ text: e.text, by: t('神蹟'), id: '', day: d }); if (L.length > 6) L.splice(0, L.length - 6); } }
                    else if (e.type === 'landmark') { const P = w.proposals; if (P) { const L = P.landmarks || (P.landmarks = []); L.push({ name: e.name, icon: e.icon, by: t('神蹟'), id: '', day: d }); if (L.length > 6) L.splice(0, L.length - 6); } }
                    else if (e.type === 'weather') { if (w.weather) { w.weather.current = e.key; w.weather.duration = e.days; } }
                    else if (e.type === 'hurt') { if (typeof HEALTH === 'undefined') continue; const who = e.id ? [w.agents[e.id]].filter(Boolean) : adults(w).sort(() => Math.random() - 0.5).slice(0, e.n); for (const a of who) { HEALTH.addAil(w, a, e.kind === 'fever' ? { p: 'l', k: 'fever', s: 1 } : { p: rnd(['h', 'f']), k: 'injury', s: 1, dmg: 8 }, ev.title); hit.add(a.agentId); } if (!e.name) e.name = who.map(a => a.name).join(t('、')); }
                    else if (e.type === 'heal') { if (typeof HEALTH === 'undefined') continue; const H = HEALTH.S(w); const ids = e.id ? [e.id] : Object.keys(H.a || {}); for (const id of ids) { if (H.a?.[id]) { delete H.a[id]; hit.add(id); } } }
                    else if (e.type === 'gift') { const a = e.id ? w.agents[e.id] : rnd(adults(w)); if (a && typeof WALLET !== 'undefined') { WALLET.add(w, a, e.amount); e.name = a.name; hit.add(a.agentId); } }
                    out.push(describe(w, e));
                } catch (err) { console.warn('[Wish] apply', e, err); }
            }
            return { lines: out.filter(Boolean), hit: [...hit] };
        },
    };
    try { if (typeof MONEY !== 'undefined' && MONEY.track) MONEY.track(X, 'apply', 'event'); } catch (e) {}

    // ---------- 沒有 AI:看關鍵字 ----------
    const RULES = [
        [/流星|彗星|星雨|meteor|comet|shooting star/i, '🌠', [{ type: 'mood', who: 'all', amount: 4 }, { type: 'tradition', text: '每年這一天，大家一起看星星' }]],
        [/暴風|颱風|狂風|storm|typhoon|hurricane/i, '⛈️', [{ type: 'weather', key: 'storm', days: 2 }, { type: 'resource', res: 'wood', amount: -40 }, { type: 'mood', who: 'all', amount: -3 }]],
        [/大雨|下雨|雨|rain/i, '🌧️', [{ type: 'weather', key: 'rain', days: 2 }, { type: 'resource', res: 'food', amount: 40 }, { type: 'mood', who: 'job:farmer', amount: 3 }]],
        [/雪|snow/i, '❄️', [{ type: 'weather', key: 'snow', days: 2 }, { type: 'mood', who: 'all', amount: 2 }]],
        [/晴|陽光|太陽|sunny|sunshine/i, '☀️', [{ type: 'weather', key: 'clear', days: 3 }, { type: 'mood', who: 'all', amount: 2 }]],
        [/火災|失火|大火|著火|fire|blaze/i, '🔥', [{ type: 'resource', res: 'wood', amount: -50 }, { type: 'hurt', n: 1, kind: 'injury' }, { type: 'mood', who: 'all', amount: -4 }]],
        [/豐收|大豐|五穀|harvest|bumper/i, '🌾', [{ type: 'resource', res: 'food', amount: 150 }, { type: 'mood', who: 'job:farmer', amount: 5 }]],
        [/寶藏|金幣|黃金|寶箱|treasure|gold|coins/i, '💰', [{ type: 'gift', amount: 60 }, { type: 'mood', who: 'all', amount: 1 }]],
        [/瘟疫|疫|風寒|生病|病倒|plague|flu|sick|fever/i, '🤧', [{ type: 'hurt', n: 3, kind: 'fever' }, { type: 'mood', who: 'all', amount: -3 }]],
        [/地震|earthquake/i, '🌋', [{ type: 'resource', res: 'stone', amount: -40 }, { type: 'hurt', n: 2, kind: 'injury' }, { type: 'mood', who: 'all', amount: -5 }]],
        [/慶典|節慶|派對|狂歡|festival|party|celebrat/i, '🎉', [{ type: 'mood', who: 'all', amount: 5 }, { type: 'modifier', key: 'festival_chance', value: 0.2, days: 10 }]],
        [/吵架|打架|爭執|翻臉|fight|quarrel|feud/i, '💢', [{ type: 'relation', a: '?', b: '?', amount: -15 }]],
        [/戀愛|愛上|告白|情書|love|romance|crush/i, '💘', [{ type: 'relation', a: '?', b: '?', amount: 15 }]],
        [/治好|神醫|奇蹟|痊癒|heal|cure|miracle/i, '✨', [{ type: 'heal' }, { type: 'mood', who: 'all', amount: 3 }]],
        [/商隊|商人|旅商|merchant|caravan|trader/i, '🐫', [{ type: 'modifier', key: 'merchant_chance', value: 0.3, days: 7 }, { type: 'resource', res: 'cloth', amount: 20 }]],
        [/詩人|音樂|唱歌|表演|bard|music|song|sing/i, '🎶', [{ type: 'mood', who: 'all', amount: 3 }]],
    ];
    function byRules(w, text) {
        const fx = [], icons = []; let k = 0;
        for (const [re, icon, list] of RULES) { if (!re.test(text)) continue; icons.push(icon); for (const e of list) { const c = Object.assign({}, e); if (c.type === 'relation') { const A = adults(w); const a = rnd(A), b = rnd(A.filter(x => x !== a)); if (!a || !b) continue; c.a = a.name; c.b = b.name; } fx.push(c); } if (++k >= 3) break; }
        if (!fx.length) { fx.push({ type: 'mood', who: 'all', amount: 1 }); icons.push('✨'); }
        const good = fx.reduce((s, e) => s + (e.type === 'mood' ? e.amount : e.type === 'hurt' ? -3 : e.type === 'gift' || e.type === 'heal' ? 3 : 0), 0);
        const A = adults(w).sort(() => Math.random() - 0.5).slice(0, 2);
        const lines = good > 0 ? ['真不敢相信，竟然真的發生了！', '這一定是好兆頭。'] : good < 0 ? ['這下可糟了……', '大家先別慌，一起想辦法。'] : ['你們看到了嗎？', '這到底是怎麼回事？'];
        return { title: clip(text, 16), icon: icons[0], story: { k: '鎮上真的發生了：{x}', p: { x: clip(text, MAXLEN) } }, fx: sanitize(w, fx), reactions: A.map((a, i) => ({ id: a.agentId, name: a.name, text: t(lines[i % lines.length]) })), ai: false };
    }

    // ---------- 有 AI:讓 AI 寫成一件事 ----------
    async function byAI(w, text) {
        const ce = w.conversationEngine; if (!ce?.llm || !ce._askJson || !(ce.llm._canMakeRequest?.(true, true))) return null;
        const ppl = adults(w).slice(0, 18).map(a => `${t(a.name)}(${t(a.job?.title || '')})`).join(t('、'));
        const tb = (() => { try { return ce._townBrief?.(w) || ''; } catch (e) { return ''; } })();
        const prompt = `${t('你是這個小鎮的命運。天上的神寫下了一句話，請把它變成鎮上今天真的發生的一件事（神不會出現，村民不知道是神做的）。')}
${t('鎮況')}${t('：')}${String(tb).slice(0, 400)}
${t('村民')}${t('：')}${ppl}
${t('神寫的話')}${t('：')}「${text}」
${t('只能用下面這些效果（最多 5 個），數值要合理，人名只能用上面的村民')}${t('：')}
{"type":"resource","res":"food|wood|stone|metal|cloth|herbs|tools|medicine","amount":-150~150}
{"type":"daily","res":"food|wood|stone|herbs","amount":-8~8,"days":3~20}
{"type":"mood","who":"all|job:farmer|name:${t('村民名')}","amount":-8~8}
{"type":"relation","a":"${t('村民名')}","b":"${t('村民名')}","amount":-25~25}
{"type":"modifier","key":"research_bonus|farm_bonus|merchant_chance|festival_chance|immigration_chance","value":-0.3~0.3,"days":5~30}
{"type":"tradition","text":"${t('一句新傳統')}"} {"type":"landmark","name":"${t('地標名')}","icon":"${t('一個表情符號')}"}
{"type":"weather","key":"clear|rain|storm|snow|fog|wind|heatwave","days":1~3}
{"type":"hurt","who":"${t('村民名或空白')}","n":1~3,"kind":"injury|fever"} {"type":"heal","who":"${t('村民名或空白（全鎮）')}"} {"type":"gift","who":"${t('村民名或空白')}","amount":1~100}
${t('只輸出 JSON')}${t('：')}{"title":"${t('12 字內的標題')}","icon":"${t('一個表情符號')}","story":"${t('60 字內，鎮上發生了什麼')}","effects":[...],"reactions":[{"name":"${t('村民名')}","line":"${t('他當下說的一句話')}"}]}`;
        try { ce._countNpcLlmUse?.(w); } catch (e) {}
        const j = await ce._askJson(prompt, 520); if (!j || typeof j !== 'object') return null;
        const fx = sanitize(w, j.effects); if (!fx.length && !j.story) return null;
        const reactions = (Array.isArray(j.reactions) ? j.reactions : []).slice(0, 3).map(r => { const a = byName(w, r?.name); return a && r.line ? { id: a.agentId, name: a.name, text: clip(r.line, 60) } : null; }).filter(Boolean);
        return { title: clip(j.title || text, 20), icon: clip(j.icon || '✨', 4) || '✨', story: clip(j.story || text, 90), fx, reactions, ai: true };
    }

    // ---------- 寫下一句話 ----------
    async function cast(w, text) {
        text = clip(text, MAXLEN); if (text.length < 2) return { ok: false, why: 'empty' };
        const can = canCast(w); if (!can.ok) return can;
        const W = S(w); W.busy = true;
        let ev = null; try { ev = await byAI(w, text); } catch (e) { ev = null; }
        if (!ev) ev = byRules(w, text);
        W.busy = false;
        if (!spend(w, COST)) return { ok: false, why: 'power' };
        W.day = day(w); ev.n = ++W.n; ev.text = text;
        const res = X.apply(w, ev); const story = typeof ev.story === 'string' ? ev.story : (() => { try { return Memory.render(ev.story.k, ev.story.p); } catch (e) { return text; } })();
        const affected = [...new Set([...res.hit, ...ev.reactions.map(r => r.id)])];
        // 跟事件卡一樣記進「反應追蹤」
        const EC = w.eventCards; const d = day(w);
        if (EC) {
            const good = ev.fx.reduce((s, e) => s + (e.type === 'mood' ? e.amount : e.type === 'hurt' ? -3 : e.type === 'gift' || e.type === 'heal' ? 3 : e.type === 'resource' ? Math.sign(e.amount) : 0), 0);
            const entry = { id: 'wish', day: d, cat: good < 0 ? 'disaster' : 'fortune', icon: ev.icon, name: ev.title, detail: [story, res.lines.length ? `${t('結果')}${t('：')}${res.lines.join(t('；'))}` : ''].filter(Boolean).join(' '), affected, loc: null, reactions: ev.reactions.map(r => ({ agentId: r.id, name: r.name, text: r.text })), proposals: [], snap: EC._snapshot ? EC._snapshot(w, d) : null, outcome: null, wish: text };
            EC.played = EC.played || []; EC.played.push(entry); if (EC.played.length > 30) EC.played = EC.played.slice(-30);
            EC.stats = EC.stats || {}; EC.stats.played = (EC.stats.played || 0) + 1;
        }
        // 全鎮都記得、日報、話題;有反應的人當下講出來
        for (const a of npcs(w)) a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', '鎮上出了事：{name}——{desc}', { name: ev.title, desc: story }, affected.includes(a.agentId) ? 9 : 5, []);
        for (const r of ev.reactions) { const a = w.agents[r.id]; if (a) { a.currentThought = r.text; a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', '那時候我說：「{x}」', { x: r.text }, 6, []); } }
        try { w.events?.conversationTopics?.push(ev.title); if (w.events) w.events.conversationTopics = w.events.conversationTopics.slice(-5); } catch (e) {}
        try { w.logMessageT?.('event', '✍️ {i} {name}：{desc}', { i: ev.icon, name: ev.title, desc: story }); } catch (e) {}
        try { w.dailyNews?.collectEvent?.('event', `${ev.title}${t('：')}${story}`, 9, ev.reactions.map(r => r.name)); } catch (e) {}
        W.last = { n: ev.n, d, text, title: ev.title, icon: ev.icon, story, lines: res.lines, reactions: ev.reactions.map(r => ({ name: r.name, text: r.text })), ai: ev.ai };
        return { ok: true, ev: Object.assign({}, W.last, { affected }) };
    }
    const EXAMPLES = ['今晚下起流星雨', '河邊撈到一箱金幣', '一場大雨救了乾枯的田', '有個吟遊詩人路過唱了一整夜', '兩個冤家被困在同一間屋子'];
    return { COST, MAXLEN, S, canCast, cast, sanitize, byRules, describe, EXAMPLES, _apply: X };
})();

if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.wish = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.wish) d.wish = { n: this.wish.n, day: this.wish.day, last: this.wish.last }; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.wish = (data?.wish && typeof data.wish === 'object') ? Object.assign({ busy: false }, data.wish) : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.WISH = WISH;
