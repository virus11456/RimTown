// RimTown - sim-episode.js：v6.78.1 每日報紙——把一天的八卦與大小事整理成一份報紙(日報 › 日誌最上面)
// v6.78.0 原本做成「八點檔」旁白，v6.78.1 依使用者意思改回報紙形式：頭版要聞、鎮公所、感情與恩怨、八卦與傳聞、街坊大小事、民生經濟、人物、明日看點。
// 素材：當天的日誌(依 d 標記的絕對日)、名場面(原「小鎮劇場」，同類合併成一則)、提案、村民對話、技能升級。
// 規則整理，不另外呼叫 AI；換日時把昨天定稿存進 world.episodes(最多 10 期)。
// 掛在 World.prototype：tick(換日定稿)、serialize/loadSave/reset(存讀檔)。名稱沿用 EPISODE／episodes 以相容 v6.78.0 存檔。
'use strict';

const EPISODE = (() => {
    const KEEP = 10, MAX_ITEMS = 22;
    // 日誌類型 → 版面、權重
    const SEC_OF = {
        death: 'main', birth: 'main', raid: 'main', departure: 'main', arrival: 'main', immigration: 'main', festival: 'main', event: 'main', chain_event: 'main', mourning: 'main', milestone: 'main', town: 'main',
        drama: 'love', relationship: 'love', romance: 'love',
        council: 'hall', decision: 'hall', order: 'hall', faction: 'hall',
        gossip: 'gossip', mischief: 'gossip', whisper: 'gossip',
        conversation: 'street', social: 'street',
        economy: 'life', trade: 'life', building: 'life', factory: 'life', industry: 'life', farm: 'life', research: 'life', news: 'life', exploration: 'life', discovery: 'life',
    };
    const W8 = { death: 95, birth: 90, raid: 90, departure: 80, mourning: 72, festival: 70, chain_event: 70, arrival: 68, immigration: 66, milestone: 65, town: 65, event: 62, drama: 75,
        romance: 72, relationship: 64, council: 58, decision: 58, order: 52, faction: 50, mischief: 55, gossip: 46, whisper: 44, discovery: 56, exploration: 50, building: 48, research: 45,
        news: 40, press: 42, away: 41, trade: 38, factory: 38, industry: 38, economy: 34, farm: 30, social: 36, conversation: 22 };
    const SECS = ['main', 'hall', 'love', 'gossip', 'street', 'life', 'press', 'away'];
    // v9.6.0 新聞整合:報社的報導、外地消息各自一版(以前混在「民生經濟」裡,跟消息頁、報社區塊重複)
    const PRESS_K = '{i} {paper}：{s}', AWAY_K = '📨 {via}帶來{p}的消息：{n}';
    const SEC_META = {
        main: { icon: '🗞️', label: '頭版要聞', max: 4 },
        hall: { icon: '🏛️', label: '鎮公所', max: 4 },
        love: { icon: '💞', label: '感情與恩怨', max: 4 },
        gossip: { icon: '🗣️', label: '八卦與傳聞', max: 4 },
        street: { icon: '🏘️', label: '街坊大小事', max: 3 },
        life: { icon: '🌾', label: '民生經濟', max: 4 },
        press: { icon: '📰', label: '各報怎麼說', max: 4 },
        away: { icon: '🐎', label: '外地消息', max: 3 },
    };

    const absDay = (w) => (typeof w._absDay === 'function' ? w._absDay() : 0);
    const isEn = () => typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en';
    const nm = (s) => { if (!s) return ''; try { return (isEn() && I18N.localizeName) ? I18N.localizeName(s) : t(s); } catch (e) { return String(s); } };
    const textOf = (m) => { try { return String(typeof World !== 'undefined' && World.logText ? World.logText(m) : (m.content || '')); } catch (e) { return String(m.content || ''); } };
    // 去掉開頭的 emoji、[MAJOR] 之類標記與多餘空白，句尾補句號
    const clean = (s) => {
        let x = String(s || '').replace(/\s+/g, ' ').trim();
        x = x.replace(/^\[[A-Z]+\]\s*/, '');
        x = x.replace(/^(?:[\p{Extended_Pictographic}☀-➿️‍]\s*)+/u, '').trim();
        if (/[一-鿿]/.test(x)) x = x.replace(/([^\s\d]): /g, '$1：');
        const max = isEn() ? 200 : 90; if (x.length > max) x = x.slice(0, max - 2) + '…';
        if (x && !/[。！？!?…」』.)）]$/.test(x)) x += (/[一-鿿]$/.test(x) ? '。' : '.');
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
            const sec = m.k === PRESS_K ? 'press' : m.k === AWAY_K ? 'away' : SEC_OF[ty]; if (!sec) continue;
            if (sec === 'gossip' || sec === 'street') { // 同一則八卦被好幾個人轉述：只留第一次
                const raw = clean(textOf(m)); const q = raw.indexOf('「'); const key = (q >= 0 ? raw.slice(q + 1) : raw).replace(/^(我跟你說|千真萬確|你敢信嗎|聽說)[，！？、\s]*/, '').slice(0, 14);
                if (seen.has(key)) continue; seen.add(key);
            }
            if (sec === 'main') counts.events++;
            let score = sec === 'press' || sec === 'away' ? W8[sec] : (W8[ty] || 30);
            if (ty === 'event' && /^\[(CRITICAL|MAJOR)\]/.test(m.k ? String(m.p?.v ? `[${m.p.v}]` : '') : String(m.content || ''))) score += 15;
            if (ty === 'council' && (m.k ? /^📜/.test(m.k) : /^📜/.test(String(m.content || '')))) counts.proposal++;
            items.push(Object.assign({ sec, ty, s: score, tk: m.tick || 0, i: items.length }, m.k ? { k: m.k, p: m.p } : { c: String(m.content || '') }));
        }
        // 名場面(原「小鎮劇場」)：同一種場面合併成一則(「廣場對嗆 5 起：A×B、C×D…」)，並留一句台詞當引言
        let quote = null; const scenes = {};
        for (const sc of (w.dramaArchive || [])) {
            if (sceneDay(sc) !== day) continue;
            const g = scenes[sc.title] || (scenes[sc.title] = { title: sc.title, pairs: [], tk: sc.tick || 0 });
            g.pairs.push([sc.aName, sc.bName]);
            const ln = (sc.lines || []).find(l => l && l.text);
            if (ln && !quote) quote = { who: ln.speaker, text: String(ln.text).slice(0, 60) };
        }
        for (const g of Object.values(scenes)) items.push({ sec: 'love', ty: 'drama', s: W8.drama + Math.min(10, g.pairs.length), tk: g.tk, i: items.length, scene: { title: g.title, pairs: g.pairs.slice(0, 6), n: g.pairs.length } });
        // 每版有上限、整份最多 MAX_ITEMS 則(重要的先)，再依時間排回去
        const bySec = {};
        items.sort((a, b) => b.s - a.s || a.tk - b.tk);
        const kept = [];
        for (const it of items) { bySec[it.sec] = (bySec[it.sec] || 0) + 1; if (bySec[it.sec] <= SEC_META[it.sec].max && kept.length < MAX_ITEMS) kept.push(it); }
        const head = kept.find(i => i.sec === 'main' || i.sec === 'hall' || i.sec === 'love') || kept.find(i => i.sec === 'life') || kept[0] || null; // 頭條優先用大事、公事、感情；八卦最後才用
        kept.sort((a, b) => a.tk - b.tk || a.i - b.i);
        const topSkill = Object.entries(skill).sort((a, b) => b[1] - a[1])[0];
        // v9.6.0 每週感情線(以前每 7 天跳一個要按掉的大視窗):觀察者模式改成刊在當天報紙
        const wk = (w._weeklyPaper && w._weeklyPaper.d === day) ? w._weeklyPaper.lines : null;
        return { day, items: kept, head, quote, counts, weather, weekly: wk, topSkill: topSkill ? topSkill[0] : '', people: Object.keys(w.agents || {}).length };
    }

    // 明日看點：還在等的提案、選舉、災情
    function teaser(w, mat) {
        const out = [];
        try {
            const open = w.proposals?.pending?.() || [];
            const p = open.find(x => x.status === 'open') || open[0];
            if (p) out.push({ k: '提案 {id}（{title}）還在等表決。', p: { id: p.id, title: w.proposals.title(p) } });
        } catch (e) {}
        try { if (w.election?.active) out.push({ k: '鎮長選舉進行中。', p: {} }); } catch (e) {}
        try { const dz = w.weather?.activeDisaster; if (dz?.name) out.push({ k: '{name}還沒過去。', p: { name: dz.name } }); } catch (e) {}
        return out.slice(0, 3);
    }

    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(['who', 'name'].includes(a) ? nm(b) : t(String(b))); return s; };
    const pairText = (pairs) => pairs.map(([a, b]) => `${nm(a)}×${nm(b)}`).join(t('、'));
    const itemText = (it) => {
        if (it.scene) {
            const n = it.scene.n || it.scene.pairs.length;
            return n > 1 ? fill('{title} {n} 起：{pairs}{more}', { title: it.scene.title, n, pairs: pairText(it.scene.pairs), more: n > it.scene.pairs.length ? t('等') : '' })
                : fill('{title}：{pairs}。', { title: it.scene.title, pairs: pairText(it.scene.pairs) });
        }
        return clean(it.k ? textOf({ k: it.k, p: it.p, content: '' }) : it.c);
    };

    // 各版：每則一行
    function sections(mat) {
        const out = [];
        for (const s of SECS) {
            const its = mat.items.filter(i => i.sec === s && i !== mat.head); if (!its.length) continue;
            out.push({ key: s, icon: SEC_META[s].icon, label: t(SEC_META[s].label), items: its.map(itemText) });
        }
        if (mat.weekly && mat.weekly.length) out.push({ key: 'weekly', icon: '💞', label: t('本週感情線'), items: mat.weekly.map(x => t(x)) });
        if (mat.counts.skill) out.push({ key: 'people', icon: '📈', label: t('人物'), items: [fill('今天有 {n} 次手藝進步，最勤快的是{who}。', { n: mat.counts.skill, who: mat.topSkill })] });
        return out;
    }

    function headline(mat) {
        const h = mat.head; if (!h) return t('平靜的一天');
        let s = itemText(h).replace(/[。.!！]$/, '');
        const max = isEn() ? 80 : 34; if (s.length > max) s = s.slice(0, max - 1) + '…';
        return s;
    }

    function label(w, day) {
        const si = Math.floor((day - 1) / 15) % 4, yr = Math.floor((day - 1) / 60) + 1, d = ((day - 1) % 15) + 1;
        return `${t('第 {y} 年{s}').split('{y}').join(yr).split('{s}').join(t(['春季', '夏季', '秋季', '冬季'][si]))} ${t('第 {d} 天').split('{d}').join(d)}`;
    }

    // 今天(編輯中)或已定稿的某一期 → 顯示用
    function view(w, ep) {
        const mat = ep.mat;
        const head = mat.head ? (mat.items.find(i => i.tk === mat.head.tk && i.i === mat.head.i) || null) : null; // 讀檔後 head 與 items 不是同一個物件
        const m2 = Object.assign({}, mat, { head });
        return {
            day: ep.day, no: ep.day, label: label(w, ep.day), live: !!ep.live, title: headline(m2), lead: head ? itemText(head) : '',
            sections: sections(m2), teaser: (ep.teaser || []).map(x => fill(x.k, x.p)), weather: mat.weather ? clean(mat.weather) : '',
            quote: mat.quote ? { who: nm(mat.quote.who), text: t(mat.quote.text) } : null,
            counts: mat.counts, people: mat.people, empty: !mat.items.length && !mat.counts.skill, ai: aiFor(w, ep.day),
        };
    }
    // v9.6.0 AI 記者寫的那份(換日時寫前一天的事,所以報上日期是隔天)併進同一期,當作「記者專欄」
    function aiFor(w, day) {
        const ps = w.dailyNews?.newspapers || []; if (!ps.length) return null;
        const abs = (p) => { const si = ['春季', '夏季', '秋季', '冬季'].indexOf(p.season); return ((p.year - 1) * 4 + Math.max(0, si)) * 15 + p.day; };
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; const a = abs(p); if (a - 1 === day) return p.content ? { id: p.id, reporter: p.reporter || '', job: p.reporterJob || '', content: String(p.content), cross: Array.isArray(p.crossTown) ? p.crossTown : [] } : null; if (a - 1 < day) break; }
        return null;
    }
    function today(w) { const day = absDay(w); const mat = collect(w, day); return { day, live: true, mat, teaser: teaser(w, mat) }; }
    function list(w) { return Array.isArray(w.episodes) ? w.episodes : []; }

    // 換日：把昨天定稿
    function finalize(w, day) {
        if (!day || day < 1) return null;
        w.episodes = list(w).filter(e => e.day !== day);
        const mat = collect(w, day);
        if (!mat.items.length && !mat.counts.skill) return null;
        const ep = { day, mat, teaser: teaser(w, mat) };
        w.episodes.push(ep);
        if (w.episodes.length > KEEP) w.episodes = w.episodes.slice(-KEEP);
        return ep;
    }

    return { collect, view, today, list, finalize, clean, dayOfMsg, label, aiFor, KEEP, PRESS_K, AWAY_K };
})();
if (typeof window !== 'undefined') window.EPISODE = EPISODE;

if (typeof World !== 'undefined' && !World.prototype._episodeHooked) {
    World.prototype._episodeHooked = true;
    const _tick = World.prototype.tick;
    World.prototype.tick = function (...args) {
        const before = this.paused ? null : (typeof this._absDay === 'function' ? this._absDay() : null);
        const r = _tick.apply(this, args);
        try { if (before != null && this._absDay() !== before) EPISODE.finalize(this, before); } catch (e) { console.warn('[Paper] finalize', e); }
        return r;
    };
    const _ser = World.prototype.serialize, _load = World.prototype.loadSave, _reset = World.prototype.reset;
    World.prototype.serialize = function () { const d = _ser.call(this); try { if (d && Array.isArray(this.episodes) && this.episodes.length) d.episodes = this.episodes.slice(-EPISODE.KEEP).map(e => ({ day: e.day, mat: e.mat, teaser: e.teaser })); } catch (e) {} return d; };
    World.prototype.loadSave = function (data) {
        const r = _load.call(this, data);
        // v6.78.0 的舊集數用 act 分幕、可能有 ai 欄位：一律丟掉重新累積，避免版面對不上
        try { if (r) this.episodes = Array.isArray(data?.episodes) ? data.episodes.filter(e => e && e.day && e.mat && Array.isArray(e.mat.items) && e.mat.items.every(i => i.sec)).slice(-EPISODE.KEEP) : []; } catch (e) { this.episodes = []; }
        return r;
    };
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.episodes = []; this._weeklyPaper = null; return r; };
    // v9.6.0 觀察者模式的每週感情線改刊在報紙上,不再跳出要按掉的大視窗
    const _wd = World.prototype.generateWeeklyDigest;
    if (typeof _wd === 'function') World.prototype.generateWeeklyDigest = function (...args) {
        const dg = _wd.apply(this, args);
        try { if (dg && this.observerMode) { const lines = [].concat(dg.newCouples || [], dg.triangles || [], (dg.crushes || []).slice(0, 2), (dg.rivals || []).slice(0, 2)).map(String).slice(0, 6); if (lines.length) this._weeklyPaper = { d: this._absDay(), lines }; this._pendingWeeklyDigest = null; } } catch (e) {}
        return dg;
    };
}
