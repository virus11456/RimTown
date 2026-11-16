// v10.5.0 智能體認得鎮上已經有什麼；已經有的、剛提過的不再提
// 起因：一個 115 人的鎮裡，現行規矩有五條幾乎一樣的「寒冬夜裡，廣場爐火常燃…」、地標有兩個「貓之石像」。
//   查下來不只是 AI 偷懶：發想提案時它拿到的鎮況只有季節、人口、公庫、食物、心情，鎮上有哪些建築、產業、店家它根本不知道；
//   已經立下的規矩混在鎮況那一長串裡，反而像是在提示它「大家都在談這個」。提示詞裡寫「不要重複」也擋不住。
// 做法分三層：
//   一、認知：發想提案時多一段【鎮上已經有的】（建築、產業與工廠、店家、規矩、地標、正在表決的案子），講明已經有的不要再提，想改掉就提廢除
//   二、硬擋：AI 想出來的案子跟已經有的規矩／地標、正在表決或最近提過的案子幾乎一樣，或是已經有兩個案子在補同一種物資 → 不成案；告訴它撞到哪一個，請它換一件事（只多問一次）
//   三、整理：存檔裡已經重複的規矩與地標合併成一條（留最早的編號、最完整的文字）
const AWARE = (() => {
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const tr = (s) => { try { return t(s); } catch (e) { return String(s || ''); } };
    const en = () => { try { return typeof LLM_LANG !== 'undefined' ? LLM_LANG.get() === 'en' : (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'); } catch (e) { return false; } };
    const cut = (s, n) => (typeof clipText === 'function' ? clipText(String(s || ''), n) : String(s || '').slice(0, n));
    const SEP = () => tr('、');

    // ---------- 像不像 ----------
    // 中文切成兩個字一組，英文切成單字（去掉虛字）；看「短的那一邊有幾成出現在長的那一邊」。
    // 用短的當分母：一條新規矩只是把舊的兩條湊在一起、或只取其中半句，都算重複。
    const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'is', 'be', 'are', 'with', 'by', 'our', 'we', 'it', 'its', 'that', 'this', 'as', 'so', 'who', 'can', 'any', 'all', 'one', 'every', 'each', 'town']);
    function grams(s) {
        const out = new Set(); const str = String(s || '').toLowerCase();
        for (const m of str.match(/[a-z0-9]+/g) || []) if (m.length >= 2 && !STOP.has(m)) out.add(m.replace(/(ing|ed|es|s)$/, ''));
        for (const run of str.match(/[㐀-鿿]+/g) || []) { if (run.length === 1) out.add(run); for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2)); }
        return out;
    }
    const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');
    function sim(a, b) {
        const fa = flat(a), fb = flat(b); if (!fa || !fb) return 0; if (fa === fb) return 1;
        const A = grams(a), B = grams(b); const n = Math.min(A.size, B.size); if (n < 3) return 0; // 太短的只認一模一樣
        let hit = 0; const [S, L] = A.size <= B.size ? [A, B] : [B, A]; for (const g of S) if (L.has(g)) hit++;
        return hit / n;
    }
    const TH = { rule: 0.5, title: 0.75 }; // 規矩是一整句話，半數相同就是同一回事；標題短又常帶套話（「在鎮上蓋…」），要四分之三才算
    // 名字（地標）：一模一樣，或其中一個整個包在另一個裡面
    function sameName(a, b) { const fa = flat(a), fb = flat(b); if (!fa || !fb) return false; if (fa === fb) return true; const [s, l] = fa.length <= fb.length ? [fa, fb] : [fb, fa]; return s.length >= 3 && l.includes(s); }

    // ---------- 鎮上已經有的 ----------
    function have(w) {
        const H = { built: [], building: [], works: [], shops: [], rules: [], marks: [], open: [], recent: [] };
        try { for (const b of w.buildings?.completed || []) H.built.push(tr(b.name) + ((b.level || 1) > 1 ? ` Lv${b.level}` : '')); for (const p of w.buildings?.projects || []) H.building.push(tr(p.name)); } catch (e) {}
        try { if (typeof INDUSTRIES !== 'undefined') for (const k of Object.keys(w.industry?.industries || {})) if (INDUSTRIES[k]) H.works.push(tr(INDUSTRIES[k].name)); } catch (e) {}
        try { if (typeof FACTORIES !== 'undefined') for (const [k, f] of Object.entries(w.processing?.builtFactories || {})) if (FACTORIES[k]) (f.status === 'building' ? H.building : H.works).push(tr(FACTORIES[k].name)); } catch (e) {}
        try { if (typeof BIZ !== 'undefined' && w.biz) for (const s of BIZ.view(w).shops || []) H.shops.push(s.name); } catch (e) {}
        try { for (const T of Object.values(w.things?.list || {})) { if (T.gone) continue; const n = Array.isArray(T.name) ? (en() ? T.name[1] : T.name[0]) : tr(T.name); if (n && !H.shops.includes(n)) H.shops.push(n); } } catch (e) {}
        const P = w.proposals;
        try { for (const x of P?.traditions || []) if (x?.text) H.rules.push(String(x.text)); for (const x of P?.landmarks || []) if (x?.name) H.marks.push(String(x.name)); } catch (e) {}
        try {
            const d = day(w);
            for (const p of P?.items || []) { let ti = ''; try { ti = P.title(p); } catch (e) {} if (!ti) continue;
                if (['open', 'shelved', 'approved'].includes(p.status)) H.open.push({ title: ti, id: p.id });
                else if (d - (p.decidedDay ?? p.createdDay ?? d) <= RECENT) H.recent.push({ title: ti, id: p.id, status: p.status }); }
        } catch (e) {}
        return H;
    }
    const RECENT = 30; // 最近三十天提過的案子都算「剛提過」
    const SAME_N = 2, SAME_DAYS = 5; // 正在辦、或五天內才辦完的案子裡，已經有兩個在補同一種物資
    const resName = (r) => { try { return (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[r]) ? SHOP_ITEMS[r].name() : tr(r); } catch (e) { return String(r); } };
    // 一串東西只留前 n 個，多的寫「等 N 個」
    const some = (arr, n, w) => { const a = arr.slice(0, n).map(x => cut(x, w || 14)); return a.join(SEP()) + (arr.length > n ? tr('等 {n} 個').replace('{n}', arr.length) : ''); };
    // 給 AI 的一段：鎮上已經有的
    function block(w) {
        const H = have(w); const L = [];
        if (H.built.length) L.push(`${tr('建築')}${tr('：')}${some(H.built, 16)}${H.building.length ? `${tr('（蓋到一半：')}${some(H.building, 4)}${tr('）')}` : ''}`);
        else if (H.building.length) L.push(`${tr('蓋到一半的')}${tr('：')}${some(H.building, 4)}`);
        if (H.works.length) L.push(`${tr('產業與工廠')}${tr('：')}${some(H.works, 12)}`);
        if (H.shops.length) L.push(`${tr('店家')}${tr('：')}${some(H.shops, 8)}`);
        const rules = uniq(H.rules, (a, b) => sim(a, b) >= TH.rule), marks = uniq(H.marks, sameName);
        if (rules.length) L.push(`${tr('規矩與傳統')}${tr('：')}${rules.slice(-6).map(x => `${tr('「')}${cut(tr(x), 32)}${tr('」')}`).join('')}`);
        if (marks.length) L.push(`${tr('地標')}${tr('：')}${some(marks.slice(-6), 6, 12)}`);
        if (H.open.length) L.push(`${tr('正在表決或已經通過等著辦的')}${tr('：')}${H.open.slice(-6).map(x => cut(x.title, 20)).join(tr('；'))}`);
        if (!L.length) return '';
        return `${tr('【鎮上已經有的（這些都已經存在或正在辦，不要再提一次、也不要換個說法再提；真的想改掉，就提廢除或恢復）】')}\n${L.join('\n')}\n`;
    }
    function uniq(arr, same) { const out = []; for (const x of arr) if (!out.some(y => same(x, y))) out.push(x); return out; }

    // ---------- 硬擋：這個案子是不是已經有了 ----------
    // 回傳撞到的東西 { what: 'rule'|'mark'|'open'|'recent'|'gone', text }；沒撞到回 null
    function dupOf(w, title, fx) {
        const H = have(w); const P = w.proposals;
        for (const e of fx || []) {
            if (e?.type === 'tradition' && e.text) { const hit = H.rules.find(x => sim(x, e.text) >= TH.rule); if (hit) return { what: 'rule', text: hit }; const g = gone(w, 'trad').find(x => sim(x, e.text) >= TH.rule); if (g) return { what: 'gone', text: g }; }
            if (e?.type === 'landmark' && e.name) { const hit = H.marks.find(x => sameName(x, e.name)); if (hit) return { what: 'mark', text: hit }; const g = gone(w, 'mark').find(x => sameName(x, e.name)); if (g) return { what: 'gone', text: g }; }
        }
        // 同一種補法已經有兩個案子在辦了（缺柴的那幾天，人人提的都是買柴、送柴、添炭）：再來一個只是換個名字
        try { const d = day(w); const cnt = {};
            for (const p of P?.items || []) { if (!Array.isArray(p.fx)) continue; const live = ['open', 'shelved', 'approved'].includes(p.status) || (p.status === 'done' && d - (p.decidedDay ?? d) <= SAME_DAYS); if (!live) continue;
                for (const r of new Set(p.fx.filter(e => (e.type === 'resource' || e.type === 'daily') && e.amount > 0).map(e => e.res))) cnt[r] = (cnt[r] || 0) + 1; }
            const hit = (fx || []).find(e => (e?.type === 'resource' || e?.type === 'daily') && e.amount > 0 && e.res !== 'silver' && (cnt[e.res] || 0) >= SAME_N);
            if (hit) return { what: 'same', text: resName(hit.res), n: cnt[hit.res] };
        } catch (e) {}
        if (title) {
            const o = H.open.find(x => sim(x.title, title) >= TH.title); if (o) return { what: 'open', text: o.title };
            const r = H.recent.find(x => sim(x.title, title) >= TH.title); if (r) return { what: 'recent', text: r.title, status: r.status };
        }
        return null;
    }
    // 被表決廢除、還收著的規矩與地標：想要它回來是提「恢復」，不是另立一條一樣的
    function gone(w, k) { try { return Object.entries(w.repeal?.shelf || {}).filter(([id]) => id.startsWith(k + ':')).map(([, o]) => String(k === 'trad' ? o?.text : o?.name) || '').filter(Boolean); } catch (e) { return []; } }
    // 告訴 AI 撞到什麼（接在下一次發想的題目最後）
    function avoidLine(title, dup) {
        const K = { rule: '鎮上已經有這條規矩：「{x}」', mark: '鎮上已經有這個地標：{x}', open: '已經有人提了，正在表決：「{x}」', recent: '最近才有人提過：「{x}」', gone: '這是被表決廢除的：「{x}」（想要它回來，要提恢復）', same: '已經有好幾個案子在補{x}了' };
        return `${tr('你剛才想提「{t}」，可是').replace('{t}', cut(title, 20))}${tr(K[dup.what] || K.recent).replace('{x}', cut(tr(dup.text), 30))}${tr('。這次請提一件完全不同的事；想不到就輸出 {"skip":true}。')}`;
    }
    function logSkip(w, a, title, dup) {
        const K = { rule: '鎮上已經有差不多的規矩了', mark: '鎮上已經有這個地標了', open: '已經有人提了、正在表決', recent: '最近才有人提過', gone: '那是大家表決廢除的', same: '已經有好幾個案子在補同一樣東西了' };
        try { w.logMessageT?.('council', '🤔 {who}想提「{t}」，可是{why}，就沒再提。', { who: a.name, t: cut(title, 20), why: tr(K[dup.what] || K.recent) }, a.name); } catch (e) {}
        try { S(w).blocked++; } catch (e) {}
    }

    // ---------- 整理：存檔裡已經重複的合併成一條 ----------
    function S(w) { if (!w.aware || typeof w.aware !== 'object') w.aware = { blocked: 0, merged: 0, tidyDay: -99 }; return w.aware; }
    function tidy(w) {
        const P = w.proposals; if (!P) return 0; const A = S(w); const d = day(w); if (A.tidyDay === d) return 0; A.tidyDay = d;
        // 正在表決要不要廢除的那一條先不動，等表決完
        const busy = new Set((P.items || []).filter(p => (p.kind === 'law_repeal' || p.kind === 'law_restore') && ['open', 'shelved', 'approved'].includes(p.status)).map(p => String(p.refKey || '').split(':').slice(1).join(':')));
        let n = 0;
        const run = (list, text, same, set) => {
            if (!Array.isArray(list) || list.length < 2) return;
            const keep = [];
            for (const x of list) {
                const v = text(x); if (!v) { keep.push(x); continue; }
                const k = keep.find(y => text(y) && same(text(y), v));
                if (!k || busy.has(String(x.id || '')) || busy.has(String(k.id || ''))) { keep.push(x); continue; }
                if (flat(v).length > flat(text(k)).length) set(k, v); // 留最早的那一條（編號、日期不變），文字換成比較完整的
                n++;
            }
            if (keep.length !== list.length) list.splice(0, list.length, ...keep);
        };
        run(P.traditions, (x) => (typeof x?.text === 'string' ? x.text : ''), (a, b) => sim(a, b) >= TH.rule, (k, v) => { k.text = v; });
        run(P.landmarks, (x) => (typeof x?.name === 'string' ? x.name : ''), sameName, () => {});
        if (n) { A.merged += n; try { w.logMessageT?.('council', '📜 鎮上把內容重複的規矩與地標整併了 {n} 條。', { n }); } catch (e) {} }
        return n;
    }
    return { sim, grams, sameName, have, block, dupOf, avoidLine, logSkip, tidy, S, TH, RECENT, SAME_N, SAME_DAYS };
})();
if (typeof globalThis !== 'undefined') globalThis.AWARE = AWARE;

// ---- 掛勾 ----
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { try { AWARE.tidy(w); } catch (e) { console.warn('[Aware] tidy', e); } return _daily.call(this, w, ...rest); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _ser = WP.serialize; if (typeof _ser === 'function') WP.serialize = function (...a) { const d = _ser.apply(this, a); try { if (this.aware) d.aware = this.aware; } catch (e) {} return d; };
    const _load = WP.loadSave; if (typeof _load === 'function') WP.loadSave = function (d, ...a) { const r = _load.call(this, d, ...a); try { this.aware = (d && typeof d.aware === 'object' && d.aware) ? d.aware : null; } catch (e) {} return r; };
    const _reset = WP.reset; if (typeof _reset === 'function') WP.reset = function (...a) { const r = _reset.apply(this, a); this.aware = null; return r; };
}
