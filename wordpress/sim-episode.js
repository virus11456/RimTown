// RimTown - sim-episode.js：v6.78.0 「今晚八點檔」——把一天的日誌整合成一集旁白
// 素材：當天的日誌(依 d 標記的絕對日)、名場面、提案、村民對話、技能升級；依類型分成幾幕(重頭戲／感情線與恩怨／鎮公所／暗潮／街頭巷尾／民生)，
// 由規則式旁白串成段落，最後接「下集預告」。換日時把昨天定稿存進 world.episodes(最多 10 集)，
// 有 AI 而且背景額度還夠時，再請 AI 用八點檔旁白口吻重寫一次(每天最多 1 次)；AI 失敗就用規則版。
// 掛在 World.prototype：tick(換日定稿)、serialize/loadSave/reset(存讀檔)。
'use strict';

const EPISODE = (() => {
    const KEEP = 10, MAX_ITEMS = 16;
    // 類型 → 幕、權重
    const ACT_OF = {
        death: 'main', birth: 'main', raid: 'main', departure: 'main', arrival: 'main', immigration: 'main', festival: 'main', event: 'main', chain_event: 'main', mourning: 'main', milestone: 'main', town: 'main', drama: 'love',
        relationship: 'love', romance: 'love',
        council: 'hall', decision: 'hall', order: 'hall', faction: 'hall',
        gossip: 'dark', mischief: 'dark', whisper: 'dark',
        conversation: 'street', social: 'street',
        economy: 'life', trade: 'life', building: 'life', factory: 'life', industry: 'life', farm: 'life', research: 'life', news: 'life', exploration: 'life', discovery: 'life',
    };
    const W8 = { death: 95, birth: 90, raid: 90, departure: 80, mourning: 72, festival: 70, chain_event: 70, arrival: 68, immigration: 66, milestone: 65, town: 65, event: 62, drama: 75,
        romance: 72, relationship: 64, council: 58, decision: 58, order: 52, faction: 50, mischief: 55, gossip: 46, whisper: 44, discovery: 56, exploration: 50, building: 48, research: 45,
        news: 40, trade: 38, factory: 38, industry: 38, economy: 34, farm: 30, social: 36, conversation: 22 };
    const ACTS = ['main', 'love', 'hall', 'dark', 'street', 'life'];
    const ACT_META = {
        main: { icon: '🎬', label: '重頭戲', lead: ['今晚的重頭戲：', '這一集最大的事：'] },
        love: { icon: '💘', label: '感情線與恩怨', lead: ['感情線上，', '說到兒女情長與恩怨，'] },
        hall: { icon: '🏛️', label: '鎮公所', lead: ['鎮公所裡，', '公事這邊，'] },
        dark: { icon: '🤫', label: '暗潮', lead: ['檯面下暗潮洶湧——', '沒人看見的地方，'] },
        street: { icon: '💬', label: '街頭巷尾', lead: ['街頭巷尾，', '走在街上，'] },
        life: { icon: '🌾', label: '民生', lead: ['日子還是要過：', '柴米油鹽方面，'] },
    };
    const JOIN = ['', '接著，', '同一時間，', '另一頭，', '沒想到，', '緊接著，'];
    const HOOKS = ['誰會先開口？誰又會先低頭？', '平靜的日子，還能撐多久？', '有人笑了，就有人睡不著。', '這座小鎮的秘密，才剛開始。'];

    const absDay = (w) => (typeof w._absDay === 'function' ? w._absDay() : 0);
    const isEn = () => typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en';
    const nm = (s) => { if (!s) return ''; try { return (isEn() && I18N.localizeName) ? I18N.localizeName(s) : t(s); } catch (e) { return String(s); } };
    const textOf = (m) => { try { return String(typeof World !== 'undefined' && World.logText ? World.logText(m) : (m.content || '')); } catch (e) { return String(m.content || ''); } };
    // 去掉開頭的 emoji、[MAJOR] 之類標記與多餘空白，句尾補句號
    const clean = (s) => {
        let x = String(s || '').replace(/\s+/g, ' ').trim();
        x = x.replace(/^\[[A-Z]+\]\s*/, '');
        x = x.replace(/^(?:[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\u200D]\s*)+/u, '').trim();
        if (/[\u4e00-\u9fff]/.test(x)) x = x.replace(/([^\s\d]): /g, '$1：');
        const max = isEn() ? 200 : 90; if (x.length > max) x = x.slice(0, max - 2) + '…';
        if (x && !/[。！？!?…」』.)）]$/.test(x)) x += (/[\u4e00-\u9fff]$/.test(x) ? '。' : '.');
        else if (/[」』]$/.test(x) && !/[：:]「/.test(x)) x += '。';
        return x;
    };
    // 一則日誌屬於哪一天：v6.78.0 起寫入 d；舊紀錄用 tick 往回推(1 天 96 tick)
    const dayOfMsg = (w, m) => {
        if (m.d != null) return m.d;
        if (m.tick == null) return null;
        const now = w.tickCount || 0, today = absDay(w);
        const minsToday = (w.clock?.hour || 0) * 60 + (w.clock?.minute || 0);
        const startTick = now - Math.floor(minsToday / 15);
        if (m.tick >= startTick) return today;
        return today - Math.ceil((startTick - m.tick) / 96);
    };
    const sceneDay = (s) => { const si = ['春季', '夏季', '秋季', '冬季'].indexOf(s.season); return ((s.year - 1) * 4 + Math.max(0, si)) * 15 + s.day; };
    const seeded = (day, i, arr) => arr[Math.abs((day * 7 + i * 13) % arr.length)];

    // 收集某一天的素材(存成跟語言無關的形式：模板日誌留 k/p，其他留原文)
    function collect(w, day) {
        const items = []; const counts = { convo: 0, gossip: 0, skill: 0, proposal: 0, events: 0 }; const skill = {};
        let weather = ''; const seen = new Set();
        for (const m of (w.messageLog || [])) {
            if (dayOfMsg(w, m) !== day) continue;
            const ty = m.type || '';
            if (ty === 'skill_up') { counts.skill++; if (m.agent) skill[m.agent] = (skill[m.agent] || 0) + 1; continue; }
            if (ty === 'weather') { weather = textOf(m); continue; }
            if (ty === 'conversation') counts.convo++;
            if (ty === 'gossip' || ty === 'whisper') counts.gossip++;
            const act = ACT_OF[ty]; if (!act) continue;
            if (act === 'dark' || act === 'street') { // 同一則八卦被好幾個人轉述:只留第一次
                const raw = clean(textOf(m)); const q = raw.indexOf('「'); const key = (q >= 0 ? raw.slice(q + 1) : raw).replace(/^(我跟你說|千真萬確|你敢信嗎|聽說)[，！？、\s]*/, '').slice(0, 14);
                if (seen.has(key)) continue; seen.add(key);
            }
            if (act === 'main' || ty === 'raid') counts.events++;
            let score = W8[ty] || 30;
            if (ty === 'event' && /^\[(CRITICAL|MAJOR)\]/.test(m.k ? String(m.p?.v ? `[${m.p.v}]` : '') : String(m.content || ''))) score += 15;
            if (ty === 'council' && (m.k ? /^📜/.test(m.k) : /^📜/.test(String(m.content || '')))) counts.proposal++;
            items.push(Object.assign({ act, ty, s: score, tk: m.tick || 0, i: items.length }, m.k ? { k: m.k, p: m.p } : { c: String(m.content || '') }));
        }
        // 名場面(告白／婚禮／分手／修羅場…)
        let quote = null;
        for (const sc of (w.dramaArchive || [])) {
            if (sceneDay(sc) !== day) continue;
            items.push({ act: 'love', ty: 'drama', s: W8.drama, tk: sc.tick || 0, i: items.length, scene: { title: sc.title, a: sc.aName, b: sc.bName } });
            const ln = (sc.lines || []).find(l => l && l.text);
            if (ln && (!quote || (sc.kind || '') !== 'reunion')) quote = { who: ln.speaker, to: ln.speaker === sc.aName ? sc.bName : sc.aName, text: String(ln.text).slice(0, 70) };
        }
        // 對話太多：同一幕最多留 3 則，整集最多 MAX_ITEMS 則(高分優先)，再依時間排回去
        const byAct = {};
        items.sort((a, b) => b.s - a.s || a.tk - b.tk);
        const kept = [];
        for (const it of items) { byAct[it.act] = (byAct[it.act] || 0) + 1; if (byAct[it.act] <= 3 && kept.length < MAX_ITEMS) kept.push(it); }
        const head = kept.find(i => i.act === 'main' || i.act === 'love' || i.act === 'hall') || kept.find(i => i.act === 'life') || kept[0] || null; // 標題優先用大事、感情、公事；八卦引號多，最後才用
        kept.sort((a, b) => a.tk - b.tk || a.i - b.i);
        const topSkill = Object.entries(skill).sort((a, b) => b[1] - a[1])[0];
        return { day, items: kept, head, quote, counts, weather, topSkill: topSkill ? topSkill[0] : '', people: Object.keys(w.agents || {}).length };
    }

    // 下集預告：看還在等的提案、選舉、災情
    function teaser(w, mat) {
        const out = [];
        try {
            const open = w.proposals?.pending?.() || [];
            const p = open.find(x => x.status === 'open') || open[0];
            if (p) out.push({ k: '提案 {id}（{title}）還在等表決，明天會過嗎？', p: { id: p.id, title: w.proposals.title(p) } });
        } catch (e) {}
        try { if (w.election?.active) out.push({ k: '選舉正打得火熱，誰會坐上鎮長的位子？', p: {} }); } catch (e) {}
        try { const dz = w.weather?.activeDisaster; if (dz?.name) out.push({ k: '{name}還沒過去，小鎮撐得住嗎？', p: { name: dz.name } }); } catch (e) {}
        const love = mat.items.filter(i => i.act === 'love');
        const sc = love.find(i => i.scene);
        if (sc) out.push({ k: '{a}和{b}的故事，接下來會怎麼走？', p: { a: sc.scene.a, b: sc.scene.b } });
        if (!out.length) out.push({ k: seeded(mat.day, 1, HOOKS), p: {} });
        return out.slice(0, 2);
    }

    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(['a', 'b', 'who', 'to', 'name'].includes(a) ? nm(b) : t(String(b))); return s; };
    const itemText = (it) => it.scene ? fill('{a}和{b}上演「{title}」。', { a: it.scene.a, b: it.scene.b, title: it.scene.title }) : clean(it.k ? textOf({ k: it.k, p: it.p, content: '' }) : it.c);

    // 規則版旁白：每幕一段
    function narrate(mat) {
        const acts = [];
        let j = 0;
        for (const a of ACTS) {
            const its = mat.items.filter(i => i.act === a); if (!its.length) continue;
            const meta = ACT_META[a];
            const parts = its.map((it, i) => (i === 0 ? '' : t(seeded(mat.day, ++j, JOIN.slice(1)))) + itemText(it));
            let text = t(seeded(mat.day, acts.length, meta.lead)) + parts.join('');
            if (a === 'love' && mat.quote) text += fill('{who}對{to}說：「{line}」', { who: mat.quote.who, to: mat.quote.to, line: mat.quote.text });
            acts.push({ icon: meta.icon, label: t(meta.label), text });
        }
        if (mat.counts.skill) acts.push({ icon: '📈', label: t('小人物'), text: fill('這一天有 {n} 次手藝進步，練得最勤的是{who}。', { n: mat.counts.skill, who: mat.topSkill }) });
        return acts;
    }

    function headline(mat) {
        const h = mat.head; if (!h) return t('平靜的一天');
        let s = itemText(h).replace(/[。.!！]$/, '');
        const max = isEn() ? 60 : 26; if (s.length > max) s = s.slice(0, max - 1) + '…';
        return s;
    }

    function label(w, day) {
        const si = Math.floor((day - 1) / 15) % 4, yr = Math.floor((day - 1) / 60) + 1, d = ((day - 1) % 15) + 1;
        return `${t('第 {y} 年{s}').split('{y}').join(yr).split('{s}').join(t(['春季', '夏季', '秋季', '冬季'][si]))} ${t('第 {d} 天').split('{d}').join(d)}`;
    }

    // 今天(播出中)或已定稿的某一集 → 顯示用
    function view(w, ep) {
        const mat = ep.mat;
        return {
            day: ep.day, no: ep.day, label: label(w, ep.day), live: !!ep.live, title: headline(mat), acts: narrate(mat),
            teaser: (ep.teaser || []).map(x => fill(x.k, x.p)), weather: mat.weather ? clean(mat.weather) : '',
            ai: ep.ai && ep.aiLang === ((typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'zh') ? ep.ai : '',
            counts: mat.counts, people: mat.people, empty: !mat.items.length && !mat.counts.skill,
        };
    }
    function today(w) { const day = absDay(w); const mat = collect(w, day); return { day, live: true, mat, teaser: teaser(w, mat) }; }
    function list(w) { return Array.isArray(w.episodes) ? w.episodes : []; }

    // AI 改寫(每天最多 1 次，算在村民背景 AI 額度裡)
    function aiPrompt(w, v) {
        const town = t(w.townName || '邊境鎮');
        const facts = v.acts.map(a => `【${a.label}】${a.text}`).join('\n');
        const zh = `你是電視台八點檔連續劇的旁白，要用旁白口吻講完「${town}」${v.label}這一集發生的事。
素材(只能用這些，不准捏造沒發生的事，人名照抄)：
${facts}
${(v.weather ? '天氣：' + v.weather + '\n' : '') + '下集伏筆：' + v.teaser.join(' ')}

寫法：
- 4 到 6 段，每段 1 到 3 句，總長 250 到 450 字；第一段先交代這天的氣氛，最重要的事放前面。
- 語氣像八點檔旁白：有懸念、有情緒、會吊胃口，但不浮誇亂編。
- 不要標題、不要清單、不要 markdown 符號。
- 最後一段用「下集預告：」開頭，以「敬請鎖定明晚八點。」結尾。
${(typeof LLM_LANG !== 'undefined') ? LLM_LANG.rule('- 繁體中文（台灣口語）', '- Natural English') : '- 繁體中文（台灣口語）'}`;
        const en = `You are the narrator of a prime-time TV drama. In a narrator's voice, recap what happened in "${town}" on ${v.label}.
Material (use only this; do not invent events; copy names exactly):
${facts}
${v.weather ? `Weather: ${v.weather}\n` : ''}Hooks for next time: ${v.teaser.join(' ')}

How to write:
- 4 to 6 short paragraphs, 1 to 3 sentences each, 150 to 280 words; open with the mood of the day and lead with the biggest event.
- Sound like a soap-opera narrator: suspense, emotion, cliffhangers, but no made-up facts.
- No headings, no lists, no markdown.
- The last paragraph starts with "Next time:" and ends with "Same time tomorrow night."
- Natural English`;
        return (typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en') ? en : zh;
    }
    function aiPolish(w, ep) {
        try {
            const ce = w.conversationEngine, llm = ce?.llm; if (!llm || typeof llm.chat !== 'function') return;
            if (ce.npcLlmDailyBudget && (w.npcLlmUsedToday || 0) >= ce.npcLlmDailyBudget()) return;
            if (llm._canMakeRequest && !llm._canMakeRequest(false)) return;
            if (ep.ai || ep.aiTry) return; // 每集最多送一次；換日那刻在冷卻沒送出，才由 retryAi 補送
            const v = view(w, ep); if (v.empty) return;
            ce._countNpcLlmUse?.(w); ep.aiTry = (ep.aiTry || 0) + 1;
            const lang = (typeof I18N !== 'undefined' && I18N.getLang) ? I18N.getLang() : 'zh';
            Promise.resolve(llm.chat([{ role: 'user', content: aiPrompt(w, v) }], { max_tokens: 900 })).then(r => {
                const s = String(r || '').trim();
                if (s.length < 60 || /EFFECTS|```/.test(s)) return;
                ep.ai = s.slice(0, 1600); ep.aiLang = lang;
            }).catch(() => {});
        } catch (e) {}
    }

    // 換日：把昨天定稿
    function finalize(w, day) {
        if (!day || day < 1) return null;
        w.episodes = list(w).filter(e => e.day !== day);
        const mat = collect(w, day);
        if (!mat.items.length && !mat.counts.skill) return null;
        const ep = { day, mat, teaser: teaser(w, mat) };
        w.episodes.push(ep);
        if (w.episodes.length > KEEP) w.episodes = w.episodes.slice(-KEEP);
        aiPolish(w, ep);
        return ep;
    }

    function retryAi(w) { const eps = list(w); const ep = eps[eps.length - 1]; if (ep && !ep.ai && ep.day === absDay(w) - 1) aiPolish(w, ep); }

    return { collect, narrate, view, today, list, finalize, retryAi, clean, dayOfMsg, label, KEEP };
})();
if (typeof window !== 'undefined') window.EPISODE = EPISODE;

if (typeof World !== 'undefined' && !World.prototype._episodeHooked) {
    World.prototype._episodeHooked = true;
    const _tick = World.prototype.tick;
    World.prototype.tick = function (...args) {
        const before = this.paused ? null : (typeof this._absDay === 'function' ? this._absDay() : null);
        const r = _tick.apply(this, args);
        try {
            if (before != null && this._absDay() !== before) EPISODE.finalize(this, before);
            else if (before != null && this.clock?.minute === 0 && this.clock.hour >= 1) EPISODE.retryAi(this); // 換日那刻 AI 在冷卻沒送出：之後每小時再試(每集最多送一次)
        } catch (e) { console.warn('[Episode] finalize', e); }
        return r;
    };
    const _ser = World.prototype.serialize, _load = World.prototype.loadSave, _reset = World.prototype.reset;
    World.prototype.serialize = function () { const d = _ser.call(this); try { if (d && Array.isArray(this.episodes) && this.episodes.length) d.episodes = this.episodes.slice(-EPISODE.KEEP).map(e => ({ day: e.day, mat: e.mat, teaser: e.teaser, ...(e.ai ? { ai: e.ai, aiLang: e.aiLang } : {}) })); } catch (e) {} return d; };
    World.prototype.loadSave = function (data) {
        const r = _load.call(this, data);
        try { if (r) this.episodes = Array.isArray(data?.episodes) ? data.episodes.filter(e => e && e.day && e.mat && Array.isArray(e.mat.items)).slice(-EPISODE.KEEP) : []; } catch (e) { this.episodes = []; }
        return r;
    };
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.episodes = []; return r; };
}
