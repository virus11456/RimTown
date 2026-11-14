// RimTown - sim-notes.js：v9.31.0 鎮民手記
// 把村民「自己想出來的東西」收成一本書，每個人一章，讓觀察者看得到他們的心思，而不是只看數字。
// 收什麼：
//   1. 他自己拿的主意（不在現成選項裡，AI 自己想的）
//   2. 他做決定時自己說的理由（AI 回答時親口寫的；程式內建的固定句子不收）
//   3. 他提過的案、寫過的日記，以及其他系統已經存著的作品（由 SOURCES 讀，不另外複製一份）
// 不做什麼：不替任何人做決定、不用亂數、不寫記憶、不改好感與錢。只多存一份手記（w.notes，進存檔）。
// 必須在 simulation.js、sim-decide.js、sim-proposals.js、sim-mind.js、sim-epic.js 之後載入。
'use strict';

const NOTES = (() => {
    const PER = 24, TOTAL = 900; // 每人最多留幾筆、全鎮最多幾筆（自己拿的主意優先留）
    const day = (w) => { try { return w._absDay ? w._absDay() : 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const render = (k, p) => { try { return Memory.render(k, p || {}); } catch (e) { return String(k); } };
    const say = (x) => (x == null ? '' : typeof x === 'string' ? render(x, {}) : x.raw != null ? String(x.raw) : x.k ? render(x.k, x.p || {}) : '');
    const quote = (x) => (en() ? '\u201c' + x + '\u201d' : '\u300c' + x + '\u300d'); // 引號照語言換
    const nameOf = (w, id, fb) => { const a = w.agents?.[id]; const n = a?.name || fb || id; try { return typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(String(n), en()) : n; } catch (e) { return n; } };
    function S(w) { if (!w.notes || !Array.isArray(w.notes.list)) w.notes = { v: 1, n: 0, list: [] }; return w.notes; }

    // ---------- 記下來 ----------
    function add(w, e) {
        const N = S(w); e.i = ++N.n; e.d = day(w); e.tm = w.clock?.timeStr || ''; N.list.push(e);
        // 同一個人超過上限：先丟最舊的「理由」，自己拿的主意留久一點
        const mine = N.list.filter(x => x.who === e.who); if (mine.length > PER) { const drop = mine.find(x => x.t === 'pick') || mine[0]; N.list.splice(N.list.indexOf(drop), 1); }
        if (N.list.length > TOTAL) { const drop = N.list.find(x => x.t === 'pick') || N.list[0]; N.list.splice(N.list.indexOf(drop), 1); }
        return e;
    }
    // 決策核心通知：只收 AI 回答的，而且要有他自己寫的內容
    function onDecided(o) {
        const w = o.w; if (!w || !w.observerMode || o.src !== 'ai' || !o.a) return;
        const own = o.why && typeof o.why === 'object' && o.why.raw != null && String(o.why.raw).trim();
        if (o.op.free) { add(w, { who: o.a.agentId, nm: o.a.name, t: 'idea', q: o.K.title || '', x: o.op.say || o.op.text, y: own ? { raw: String(o.why.raw) } : null, r: o.res || null }); return; }
        if (!own) return; // AI 沒寫理由時用的是選項內建的句子，那不是他說的，不收
        add(w, { who: o.a.agentId, nm: o.a.name, t: 'pick', q: o.K.title || '', x: o.op.say || o.op.text, y: { raw: String(o.why.raw) }, r: o.res || null });
    }

    // ---------- 其他系統已經存著的東西（看的時候才讀，不另外複製） ----------
    // 每個來源回傳這個人的條目：{ d, t, icon, label, title, text, ai, ref }
    const SOURCES = [
        function proposals(w, id) {
            const PS = w.proposals; const out = []; for (const p of (PS?.items || [])) { if (p.proposerId !== id) continue; let title = ''; try { title = PS.title(p); } catch (e) {} let desc = ''; try { desc = PS.desc(p); } catch (e) {}
                out.push({ d: p.createdDay ?? 0, t: 'prop', title: p.id + ' ' + title, text: p.pitch || desc || '', ai: !!p.llm, own: !!(p.llm && p.pitch), status: p.status, ref: { prop: p.id } }); }
            return out;
        },
        function diary(w, id) { return ((w.mind?.diary || {})[id] || []).map(x => ({ d: x.day ?? 0, t: 'diary', title: '', text: x.k ? render(x.k, x.p || {}) : '', ai: !!x.ai, own: !!x.ai })); },
        // 日記的 ai 旗標不可靠（一天挑 6 個人、只問 AI 前 4 個，卻 6 個都標成 AI），所以不標「他自己寫的」
        function votes(w, id) { const PS = w.proposals; const out = []; for (const p of (PS?.items || [])) { const y = p.why?.[id]; if (typeof y !== 'string' || !y.startsWith('llm:')) continue; let title = ''; try { title = PS.title(p); } catch (e) {} const v = p.votes?.[id];
            out.push({ d: p.decidedDay ?? p.createdDay ?? 0, t: 'vote', title: p.id + ' ' + title + (v != null ? ' (' + render(v === 'yes' || v === true || v === 1 ? '贊成' : v === 'no' || v === false || v === -1 ? '反對' : String(v), {}) + ')' : ''), text: y.slice(4), ai: true, own: true, ref: { prop: p.id } }); } return out; },
        function speeches(w, id) { const out = []; for (const c of (w.election?.candidates || [])) if (c.agentId === id && c.speech) out.push({ d: w.election.startDay ?? day(w), t: 'speech', title: render('競選演說', {}), text: String(c.speech), ai: !!c.llm, own: !!c.llm });
            for (const c of (w.ceremony?.list || [])) if (c.speakerId === id && c.speech) out.push({ d: c.day ?? 0, t: 'speech', title: render(c.kind === 'funeral' ? '悼詞' : '致詞', {}), text: typeof c.speech === 'string' ? c.speech : say(c.speech), ai: !!c.ai, own: !!c.ai }); return out; },
        function posts(w, id) { return (w.townFeed?.posts || []).filter(x => x.authorId === id && x.text).map(x => ({ d: x.day ?? 0, t: 'post', title: '', text: String(x.text), ai: false, own: false })); },
        function drama(w, id) { return (w.dramaArchive || []).filter(x => x.aId === id || x.bId === id).map(x => ({ d: x.day ?? 0, t: 'drama', title: typeof x.title === 'string' ? x.title : say(x.title), text: (x.lines || []).slice(0, 4).map(l => (l.speaker || '') + render('：', {}) + (l.text || '')).join(' / '), ai: false, own: false })); },
        function reactions(w, id) { const out = []; for (const c of (w.eventCards?.played || [])) for (const r of (c.reactions || [])) if (r.agentId === id && r.text) out.push({ d: c.day ?? 0, t: 'react', title: typeof c.name === 'string' ? render(c.name, {}) : say(c.name || c.title), text: String(r.text), ai: !r.fb, own: !r.fb }); return out; },
        function works(w, id) { return (w.culture?.works || []).filter(x => x.by === id).map(x => ({ d: x.day ?? 0, t: 'work', title: Array.isArray(x.title) ? (en() ? x.title[1] : x.title[0]) : String(x.title || ''), text: '', ai: false, own: false })); },
        function dreams(w, id) { return (w.dream?.dreams || []).filter(x => x.to === id && (x.meaning || x.text)).map(x => ({ d: x.day ?? 0, t: 'dream', title: typeof x.text === 'string' ? x.text : say(x.text), text: x.meaning ? (typeof x.meaning === 'string' ? x.meaning : say(x.meaning)) : '', ai: !!x.meaning, own: !!x.meaning })); },
        function shops(w, id) { return (w.biz?.shops || []).filter(x => x.owner === id && x.name).map(x => ({ d: x.opened ?? 0, t: 'shop', title: Array.isArray(x.name) ? (en() ? x.name[1] : x.name[0]) : String(x.name), text: '', ai: false, own: false })); },
        // 反思：AI 寫的沒有翻譯鍵（k），照個性寫的有；只有前者標成他自己寫的
        function reflections(w, id) { const a = w.agents?.[id]; return (a?.memory?.entries || []).filter(e => e.category === 'reflection' && !e.k && e.content).slice(-8).map(e => ({ d: Math.floor((e.tick || 0) / 96), t: 'reflect', title: '', text: String(e.content), ai: true, own: true })); },
        function epic(w, id) { return (w.epic?.cantos || []).filter(C => (C.heroes || []).some(h => h.id === id)).map(C => { let x = { title: '', lines: [] }; try { x = EPIC.textOf(C); } catch (e) {} return { d: C.d ?? 0, t: 'epic', title: x.title, text: (x.lines || [])[0] || '', ai: !!C.ai, own: false, ref: { canto: C.n } }; }); },
    ];
    const KIND = {
        idea: ['💡', '自己拿的主意'], pick: ['🧭', '做決定時說的話'], prop: ['🗳️', '提過的案'], diary: ['📔', '日記'], epic: ['📜', '被寫進史詩'],
        vote: ['✋', '投票時說的話'], speech: ['🎤', '演說與致詞'], post: ['📮', '貼過的動態'], drama: ['🎭', '鬧過的場面'], react: ['⚡', '遇到大事的反應'], work: ['🎨', '作品'], dream: ['🌙', '夢與解讀'], shop: ['🏪', '開的店'], reflect: ['🪞', '反思'],
    };
    function entriesOf(w, id) {
        const out = [];
        for (const e of S(w).list) if (e.who === id) out.push({ d: e.d, tm: e.tm, t: e.t, q: e.q ? render(e.q, {}) : '', title: say(e.x), text: say(e.y), res: say(e.r), ai: true, own: true });
        for (const f of SOURCES) { try { for (const x of f(w, id) || []) if (x && (x.title || x.text)) out.push(x); } catch (err) {} }
        return out.sort((a, b) => (b.d - a.d) || ((b.i || 0) - (a.i || 0)));
    }
    // 有東西可看的人，寫得多的排前面
    function people(w) {
        const N = S(w); const own = {}; const names = {}; for (const e of N.list) { own[e.who] = (own[e.who] || 0) + 1; names[e.who] = e.nm; }
        const ids = new Set([...Object.keys(own), ...Object.keys(w.agents || {}).filter(id => !w.agents[id].isPlayer)]);
        for (const p of (w.proposals?.items || [])) if (p.proposerId) { ids.add(p.proposerId); names[p.proposerId] = names[p.proposerId] || p.proposerName; }
        const out = []; for (const id of ids) { const L = entriesOf(w, id); if (!L.length) continue; out.push({ id, name: nameOf(w, id, names[id]), n: L.length, last: L[0].d, here: !!w.agents?.[id] && !w.agents[id].isDead, own: L.filter(e => e.own).length }); }
        return out.sort((a, b) => (b.own - a.own) || (b.n - a.n) || (b.last - a.last));
    }
    const count = (w) => { try { return S(w).list.length; } catch (e) { return 0; } };
    // 最近幾筆「自己拿的主意」（給面板上的入口用）
    function latest(w, n = 3) { return S(w).list.filter(e => e.t === 'idea').slice(-n).reverse().map(e => ({ who: e.who, name: nameOf(w, e.who, e.nm), text: say(e.x), d: e.d })); }

    // ---------- 書 ----------
    function openBook(app, startId) {
        if (typeof document === 'undefined' || !app?.world) return; const w = app.world;
        const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const P = people(w); let cur = (startId && P.find(p => p.id === startId)) ? startId : (startId || P[0]?.id || null); let filter = 'all';
        let el = document.getElementById('notes-book'); if (el) el.remove();
        el = document.createElement('div'); el.id = 'notes-book'; el.className = 'notes-book'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', t('鎮民手記'));
        const draw = () => {
            const me = P.find(p => p.id === cur) || (cur ? { id: cur, name: nameOf(w, cur), n: 0, here: !!w.agents?.[cur] && !w.agents[cur].isDead } : null);
            const L = cur ? entriesOf(w, cur) : []; const kinds = [...new Set(L.map(e => e.t))]; const shown = L.filter(e => filter === 'all' || e.t === filter);
            const a = cur ? w.agents?.[cur] : null; const job = a?.job?.name ? t(a.job.name) : '';
            const list = P.length ? P.map(p => `<button type="button" class="nb-person${p.id === cur ? ' on' : ''}" data-nb="who" data-id="${esc(p.id)}"><span class="nb-pn">${p.here ? '' : '🕯️ '}${esc(p.name)}</span><span class="nb-pc">${p.n}</span></button>`).join('') : '';
            const body = !me ? `<p class="nb-empty">${esc(t('還沒有人留下東西。開著「完整智能體模式」過幾天再來翻。'))}</p>`
                : `<div class="nb-who"><h3 class="nb-name">${me.here ? '' : '🕯️ '}${esc(me.name)}</h3><span class="nb-job">${esc(job)}</span>${me.here ? `<button type="button" class="nb-go" data-nb="go">👁 ${esc(t('去看他'))}</button>` : `<span class="nb-gone">${esc(t('已經不在鎮上'))}</span>`}</div>
                   <div class="nb-chips" role="tablist"><button type="button" class="nb-chip${filter === 'all' ? ' on' : ''}" data-nb="f" data-k="all">${esc(t('全部'))} ${L.length}</button>${kinds.map(k => `<button type="button" class="nb-chip${filter === k ? ' on' : ''}" data-nb="f" data-k="${k}">${KIND[k][0]} ${esc(t(KIND[k][1]))} ${L.filter(e => e.t === k).length}</button>`).join('')}</div>
                   ${shown.length ? shown.map(e => `<article class="nb-entry nb-${e.t}"><div class="nb-meta"><span class="nb-kind">${KIND[e.t][0]} ${esc(t(KIND[e.t][1]))}</span><span class="nb-day">${esc(t('第 {n} 天').replace('{n}', e.d))}</span>${e.own ? `<span class="nb-own" title="${esc(t('這是他自己寫的，不是程式內建的句子'))}">✍️ ${esc(t('他自己寫的'))}</span>` : ''}</div>
                        ${e.q ? `<div class="nb-q">${esc(t('遇到的事'))}${esc(t('：'))}${esc(e.q)}</div>` : ''}${e.title ? `<div class="nb-title">${esc(e.title)}</div>` : ''}${e.text ? `<p class="nb-text">${e.t === 'pick' || e.t === 'idea' ? quote(esc(e.text)) : esc(e.text)}</p>` : ''}${e.res ? `<div class="nb-res">${esc(t('後來'))}${esc(t('：'))}${esc(e.res)}</div>` : ''}</article>`).join('') : `<p class="nb-empty">${esc(t('這一類還沒有東西。'))}</p>`}`;
            el.innerHTML = `<div class="nb-page"><button type="button" class="nb-x" data-nb="close" aria-label="${esc(t('關閉'))}">✕</button>
                <div class="nb-head">📓 ${esc(t('鎮民手記'))} <small>${esc(t('他們各自想了什麼'))}</small></div>
                <div class="nb-cols"><nav class="nb-people" aria-label="${esc(t('鎮民'))}">${P.length > 1 ? `<select class="nb-select" data-nb="sel" aria-label="${esc(t('選一個人'))}">${P.map(p => `<option value="${esc(p.id)}"${p.id === cur ? ' selected' : ''}>${esc(p.name)} (${p.n})</option>`).join('')}</select>` : ''}<div class="nb-plist">${list}</div></nav><section class="nb-body">${body}</section></div></div>`;
        };
        el.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-nb]'); if (!b) { if (ev.target === el) el.remove(); return; } const k = b.getAttribute('data-nb');
            if (k === 'close') el.remove(); else if (k === 'who') { cur = b.getAttribute('data-id'); filter = 'all'; draw(); el.querySelector('.nb-body')?.scrollTo?.(0, 0); }
            else if (k === 'f') { filter = b.getAttribute('data-k'); draw(); }
            else if (k === 'go') { const a = w.agents?.[cur]; if (a && !a.isDead) { el.remove(); try { app.tileMap?.followAgent?.(cur); app.selectedAgentId = cur; } catch (e) {} } }
        });
        el.addEventListener('change', (ev) => { if (ev.target.matches?.('[data-nb="sel"]')) { cur = ev.target.value; filter = 'all'; draw(); } });
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') el.remove(); });
        el.tabIndex = -1; draw(); document.body.appendChild(el); el.focus();
    }

    if (typeof DECIDE !== 'undefined' && DECIDE.observe) DECIDE.observe((ev, o) => { if (ev === 'decided') { try { onDecided(o); } catch (e) { console.warn('[Notes]', e); } } });
    return { S, add, entriesOf, people, count, latest, openBook, SOURCES, KIND };
})();

// ---- 存讀檔 ----
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.notes = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.notes && this.notes.list?.length) d.notes = this.notes; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.notes = (data?.notes && Array.isArray(data.notes.list)) ? data.notes : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.NOTES = NOTES;
