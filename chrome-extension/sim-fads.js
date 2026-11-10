// v9.12.0 文化演變:流行會在鎮上慢慢傳開,也會退流行;撐得夠久的留下來變成習俗
// - 四種流行:👒 穿戴(地圖上看得到)、💬 口頭禪(聊天會講)、🎲 消遣、🍵 吃食
// - 誰帶起來:愛出風頭、有魅力、有創意的年輕人,或是階層高的人;穿戴常由裁縫帶起、吃食常由廚師帶起
// - 怎麼傳:聊天時、或跟家人好友相處時,沒跟上的人可能學起來——年輕人學得快、老人和保守的人慢;
//   大家愛學階層比自己高的人(上層的人不太學下層),討厭的人帶起來的就不學
// - 怎麼退:新鮮感過了就有人不跟了;太多人跟時,帶頭的人和上層的人會先不玩(「滿街都是,不稀罕了」)
// - 變習俗:消遣和吃食如果全鎮三成五以上的人跟了二十天,有三成五的機會留下來,寫進「本鎮的規矩」
// - 復古:退流行很久(120 天以上)的東西,可能又流行回來
// - 錢:跟穿戴付給裁縫、跟吃食付給廚師,錢從錢包到錢包(銀幣守恆);買不起的人就跟不上
// 存在 world.fads(最多同時三個流行)
'use strict';

const FADS = (() => {
    const MAX = 3, RETRO = 120;
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 10 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const lvOf = (w, a) => { try { return typeof CLASS !== 'undefined' && w.classes ? CLASS.level(w, a) : 1; } catch (e) { return 1; } };
    const affOf = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof y === 'string' ? t(y) : y); return s; };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('social', fill(k, p), imp || 5, names || []); } catch (e) {} };
    const KINDS = {
        wear: { icon: '👒', zh: '穿戴', pay: 'tailor', price: 4 },
        word: { icon: '💬', zh: '口頭禪' },
        play: { icon: '🎲', zh: '消遣' },
        food: { icon: '🍵', zh: '吃食', pay: 'cook', price: 2 },
    };
    // 穿戴:s = 形狀(圍巾、胸花、羽毛、耳邊花、頭巾),c = 顏色;消遣與吃食:c = 變成習俗時寫進規矩的一句話
    const LIST = [
        { k: 'wear', zh: '紅圍巾', s: 'scarf', c: '#C8362F' },
        { k: 'wear', zh: '藍圍巾', s: 'scarf', c: '#2F5FA8' },
        { k: 'wear', zh: '胸前別花', s: 'brooch', c: '#F2C14E' },
        { k: 'wear', zh: '羽毛頭飾', s: 'feather', c: '#3FA9F5' },
        { k: 'wear', zh: '耳邊插花', s: 'flower', c: '#F06292' },
        { k: 'wear', zh: '綠頭巾', s: 'band', c: '#3E8E4F' },
        { k: 'word', zh: '「穩啦！」' },
        { k: 'word', zh: '「先吃飯再說。」' },
        { k: 'word', zh: '「說好的呢？」' },
        { k: 'word', zh: '「天公疼憨人。」' },
        { k: 'word', zh: '「慢慢來比較快。」' },
        { k: 'word', zh: '「這個我可以！」' },
        { k: 'play', zh: '下棋', c: '傍晚在廣場下兩盤棋' },
        { k: 'play', zh: '放風箏', c: '起風的日子一起放風箏' },
        { k: 'play', zh: '打水漂', c: '到水邊比賽打水漂' },
        { k: 'play', zh: '聽人說故事', c: '晚上圍著聽人說故事' },
        { k: 'play', zh: '黃昏散步', c: '黃昏時全家出門散步' },
        { k: 'play', zh: '踢毽子', c: '午後踢毽子' },
        { k: 'food', zh: '綠豆湯', c: '夏天煮綠豆湯分著喝' },
        { k: 'food', zh: '烤番薯', c: '天冷時圍著烤番薯' },
        { k: 'food', zh: '蜂蜜茶', c: '早上一杯蜂蜜茶' },
        { k: 'food', zh: '糖葫蘆', c: '市集日買糖葫蘆給小孩' },
        { k: 'food', zh: '麥芽餅', c: '做麥芽餅送鄰居' },
        { k: 'food', zh: '酸梅湯', c: '午後喝一碗酸梅湯' },
    ];
    const PH = { new: '剛開始', hot: '正流行', fade: '開始退燒' };
    const START = { wear: '👒 {a}戴起了{x}，走在街上特別顯眼。', word: '💬 {a}最近開口閉口都是{x}', play: '🎲 {a}迷上了{x}，常拉著朋友一起。', food: '🍵 {a}帶起了吃{x}的風氣。' };
    const MINE = { wear: '戴{x}', word: '常把{x}掛在嘴邊', play: '迷上{x}', food: '愛吃{x}' };
    function S(w) { if (!w.fads || !Array.isArray(w.fads.list)) w.fads = { list: [], hist: [], n: 0, lastDay: null, st: {} }; return w.fads; }
    const nm = (f) => LIST[f.ix]?.zh || '';
    const kindOf = (f) => LIST[f.ix]?.k || 'word';
    const adopted = (f, a) => !!(f && a && f.ad[a.agentId]);
    const mine = (w, a) => (w?.fads?.list || []).filter(f => f.ad[a?.agentId]);

    // ---------- 誰容易跟流行 ----------
    function open(w, a, f) {
        const age = a.age ?? 30, k = kindOf(f);
        let p = age < 16 ? 1.5 : age < 26 ? 1.5 : age < 41 ? 1 : age < 61 ? 0.6 : 0.3;
        if (has(a, 'charismatic')) p *= 1.2; if (has(a, 'gossip')) p *= 1.3; if (has(a, 'creative')) p *= 1.3; if (has(a, 'shy')) p *= 0.7; if (has(a, 'stoic')) p *= 0.6;
        if (k === 'wear' && has(a, 'romantic')) p *= 1.3; if ((k === 'wear' || k === 'food') && has(a, 'ascetic')) p *= 0.4;
        if (k === 'food' && has(a, 'glutton')) p *= 1.8; if (k === 'play' && has(a, 'lazy')) p *= 1.3; if (k === 'play' && has(a, 'hardworking')) p *= 0.8;
        if (a.techStance === 'conservative') p *= 0.7; else if (a.techStance === 'progressive') p *= 1.2;
        return p;
    }
    function imit(w, from, to) {
        const cf = lvOf(w, from), ct = lvOf(w, to); let p = cf > ct ? 1 + 0.25 * (cf - ct) : cf < ct ? Math.pow(0.45, ct - cf) : 1; // 學上不學下
        const af = affOf(to, from); p *= af >= 40 ? 1.4 : af >= 15 ? 1.1 : af < -10 ? 0.2 : 1;
        return p;
    }
    // 跟上:穿戴要跟裁縫買、吃食要跟廚師買(小孩不用付);買不起就跟不上
    function adopt(w, f, a, d) {
        if (adopted(f, a)) return false; const K = KINDS[kindOf(f)];
        if (K.pay && (a.age ?? 30) >= 16 && typeof WALLET !== 'undefined' && w.wallet) {
            const seller = npcs(w).filter(b => b !== a && b.job?.key === K.pay && !w.isAway?.(b.agentId))[0];
            if (seller) { if (WALLET.get(w, a) < K.price + 15) { F0(w).poor = (F0(w).poor || 0) + 1; return false; } if (!WALLET.pay(w, a, seller, K.price, t('跟流行'))) return false; F0(w).sold = (F0(w).sold || 0) + K.price; }
        }
        f.ad[a.agentId] = d; return true;
    }
    const F0 = (w) => { const F = S(w); if (!F.st) F.st = {}; return F.st; };
    function tryAdopt(w, f, from, to, k, d) {
        if (!f || f.ph === 'gone' || adopted(f, to) || !adopted(f, from)) return false;
        if ((to.age ?? 30) < 10 || w.isAway?.(to.agentId)) return false;
        const p = 0.12 * k * open(w, to, f) * imit(w, from, to) * (f.ph === 'fade' ? 0.25 : 1);
        return Math.random() < p && adopt(w, f, to, d);
    }

    // ---------- 新流行冒出來 ----------
    function pickOrigin(w, ppl, k) {
        let tot = 0; const ws = ppl.map(a => { const age = a.age ?? 30; let x = (lvOf(w, a) + 1) * (age >= 16 && age <= 35 ? 2 : age < 16 ? 0.5 : age < 50 ? 1 : 0.4);
            if (has(a, 'charismatic')) x *= 2; if (has(a, 'creative')) x *= 1.6; if (has(a, 'gossip')) x *= 1.3;
            const master = typeof MOBILITY !== 'undefined' && MOBILITY.isMaster?.(a, w);
            if (k === 'wear' && a.job?.key === 'tailor') x *= master ? 4 : 2; if (k === 'food' && a.job?.key === 'cook') x *= master ? 4 : 2;
            tot += x; return x; });
        let r = Math.random() * tot; for (let i = 0; i < ppl.length; i++) { r -= ws[i]; if (r <= 0) return ppl[i]; } return ppl[0];
    }
    function spawn(w, F, ppl, d, opt) {
        const act = new Set(F.list.map(f => kindOf(f))); const busy = new Set(F.list.map(f => f.ix));
        const recent = (ix) => F.hist.some(h => h.ix === ix && d - (h.d1 || 0) < RETRO);
        const cands = LIST.map((x, ix) => ix).filter(ix => !busy.has(ix) && !recent(ix) && (opt?.k ? LIST[ix].k === opt.k : !act.has(LIST[ix].k)) && (opt?.ix == null || opt.ix === ix));
        if (!cands.length) return null;
        const ix = cands[Math.floor(Math.random() * cands.length)], k = LIST[ix].k;
        const o = opt?.by || pickOrigin(w, ppl, k); if (!o) return null;
        const retro = F.hist.some(h => h.ix === ix);
        const f = { id: ++F.n, ix, by: o.agentId, byN: o.name, d0: d, ph: 'new', ad: {}, max: 1, hd: 0, life: 12 + Math.floor(Math.random() * 18), retro: retro ? 1 : 0 };
        f.ad[o.agentId] = d; F.list.push(f);
        log(w, START[k], { a: o.name, x: nm(f) }, o.name);
        if (retro) log(w, '🔁 {x}又流行回來了，老一輩笑說：「我們年輕時就這樣了。」', { x: nm(f) }, o.name);
        try { o.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '我開始{v}，沒想到大家都在看。', { v: { k: MINE[k], p: { x: nm(f) } } }, 4, []); } catch (e) {}
        // 帶頭的人先影響身邊最熟的兩個人
        const close = ppl.filter(b => b !== o && affOf(o, b) >= 20).sort((x, y) => affOf(o, y) - affOf(o, x)).slice(0, 2);
        for (const b of close) tryAdopt(w, f, o, b, 2, d);
        return f;
    }

    // ---------- 每天:傳開、有人不跟、換階段、變習俗、新流行 ----------
    function daily(w) {
        const F = S(w), d = day(w); if (F.lastDay === d) return; F.lastDay = d;
        const ppl = here(w), N = ppl.length; if (N < 4) return; const byId = new Map(ppl.map(a => [a.agentId, a]));
        for (const f of F.list.slice()) {
            for (const id of Object.keys(f.ad)) if (!w.agents[id]) delete f.ad[id];
            const ad = Object.keys(f.ad).map(id => byId.get(id)).filter(Boolean);
            // 跟家人、好朋友相處時傳開(聊天時另外會傳)
            for (const a of ad) { const rs = a.relationships?.relationships || {}; const ks = Object.keys(rs).filter(id => byId.has(id) && !f.ad[id] && (rs[id].affinity || 0) >= 20); if (!ks.length) continue; tryAdopt(w, f, a, byId.get(ks[Math.floor(Math.random() * ks.length)]), 1, d); }
            // 有人不跟了:新鮮感過了;太多人跟時,帶頭的人和上層的人先不玩
            let n = Object.keys(f.ad).filter(id => byId.has(id)).length; const share = n / N, age = d - f.d0;
            for (const a of Object.keys(f.ad).map(id => byId.get(id)).filter(Boolean)) {
                let pd = 0.006 + Math.max(0, age - f.life) * 0.01 + (f.ph === 'fade' ? 0.05 : 0);
                const leader = a.agentId === f.by || lvOf(w, a) >= 3 || has(a, 'creative') || has(a, 'charismatic');
                if (share > 0.5 && leader) pd += 0.12;
                if (Math.random() < pd) {
                    delete f.ad[a.agentId];
                    if (share > 0.5 && leader && !f.qd) { f.qd = 1; log(w, '🎩 {a}說滿街都是{x}，不稀罕了。', { a: a.name, x: nm(f) }, a.name); }
                }
            }
            n = Object.keys(f.ad).filter(id => byId.has(id)).length; f.max = Math.max(f.max || 1, n); const sh = n / N;
            if (f.ph === 'new' && sh >= 0.25) { f.ph = 'hot'; log(w, '🔥 {x}在鎮上流行起來了，{n} 個人都跟著。', { x: nm(f), n }, f.byN); news(w, '🔥 {x}在鎮上流行起來了，{n} 個人都跟著。', { x: nm(f), n }, 5, [f.byN]); }
            else if (f.ph === 'hot' && age > 8 && n < f.max * 0.7) f.ph = 'fade';
            else if (f.ph === 'new' && age > 20) f.ph = 'fade';
            f.hd = (f.ph === 'hot' && sh >= 0.35) ? (f.hd || 0) + 1 : 0;
            // 變習俗(消遣、吃食)
            const L = LIST[f.ix];
            if (L.c && (L.k === 'play' || L.k === 'food') && f.hd >= 20 && !f.cx) {
                f.cx = 1;
                if (Math.random() < 0.35 && w.proposals) {
                    const T = w.proposals.traditions || (w.proposals.traditions = []);
                    if (!T.some(x => x.text === L.c)) { T.push({ text: L.c, by: f.byN, id: '', day: d, fad: 1 }); if (T.length > 6) T.shift(); }
                    log(w, '🏮 {x}留了下來，成了鎮上的習俗：「{c}」。', { x: nm(f), c: L.c }, f.byN); news(w, '🏮 {x}留了下來，成了鎮上的習俗：「{c}」。', { x: nm(f), c: L.c }, 6, [f.byN]);
                    F0(w).cust = (F0(w).cust || 0) + 1; end(w, F, f, d, true); continue;
                }
            }
            if ((f.ph === 'fade' && n <= 1) || age > 90) { if (f.max >= 3) log(w, f.ph === 'fade' && f.max >= N * 0.25 ? '🍂 {x}退流行了，現在還跟的人會被笑土。' : '🍂 {x}沒能流行起來。', { x: nm(f) }, ''); end(w, F, f, d, false); }
        }
        const rate = F.list.length === 0 ? 0.08 : F.list.length < MAX ? 0.035 : 0;
        if (Math.random() < rate) spawn(w, F, ppl, d);
    }
    function end(w, F, f, d, cust) {
        F.list = F.list.filter(x => x !== f);
        F.hist.unshift({ ix: f.ix, d0: f.d0, d1: d, max: f.max || 0, by: f.byN, cust: cust ? 1 : 0 }); if (F.hist.length > 12) F.hist.length = 12;
        F0(w).ended = (F0(w).ended || 0) + 1;
    }

    // ---------- 聊天:會傳開,規則對話多一兩句 ----------
    const LINES = {
        wear: { adopt: [['你這{x}哪裡來的？我也想要。', '{w}'], ['你戴{x}好好看！', '那你也去弄一個嘛。']], snob: '滿街都是{x}，我早就不戴了。' },
        word: { adopt: [['{x}', '{x}……這句話好順口，我也要學。']], same: ['{x}', '哈哈，你也說這個！{x}'], old: ['{x}', '最近年輕人怎麼都愛說{x}……'], snob: '又是{x}，聽到耳朵都長繭了。' },
        play: { adopt: [['今天要不要一起去{x}？', '好啊！聽說最近大家都在玩。']], snob: '{x}？那是小孩子玩的。' },
        food: { adopt: [['你吃過{x}了嗎？最近大家都在吃。', '真的？我也去買一碗。']], snob: '{x}有什麼好吃的，大家只是跟風。' },
    };
    function contact(w, a, b, push) {
        const F = w.fads; if (!F || !F.list.length || !a || !b) return; const d = day(w);
        for (const f of F.list) {
            const A = adopted(f, a), B = adopted(f, b); if (A === B && !(A && kindOf(f) === 'word')) continue;
            const k = kindOf(f), Ls = LINES[k], x = t(nm(f));
            if (A && B) { if (push && Math.random() < 0.3) { push(a, fill(Ls.same[0], { x })); push(b, fill(Ls.same[1], { x })); } return; }
            const [X, Y] = A ? [a, b] : [b, a];
            if (tryAdopt(w, f, X, Y, 0.5, d)) {
                if (push) { const L = Ls.adopt[Math.floor(Math.random() * Ls.adopt.length)]; const seller = k === 'wear' ? t('裁縫鋪就有，現在大家都在戴！') : ''; push(X, fill(L[0], { x })); push(Y, fill(L[1], { x, w: seller || t('自己做的，你也可以試試。') })); }
                return;
            }
            if (!push || Math.random() > 0.35) continue;
            if (k === 'word') { push(X, x); if ((Y.age ?? 30) >= 55) push(Y, fill(Ls.old[1], { x })); else if (f.ph === 'fade' || lvOf(w, Y) > lvOf(w, X)) push(Y, fill(Ls.snob, { x })); else continue; return; }
            if (f.ph !== 'new' && lvOf(w, Y) >= 3 && lvOf(w, Y) > lvOf(w, X)) { push(Y, fill(Ls.snob, { x })); return; }
        }
    }

    // ---------- 給畫面、村民卡、AI ----------
    function wearOf(w, a) { const f = mine(w, a).find(x => kindOf(x) === 'wear'); return f ? f.ix : null; }
    function wearDef(ix) { const L = LIST[ix]; return L && L.k === 'wear' ? L : null; }
    function tag(w, a) { const L = mine(w, a); return L.length ? `${KINDS[kindOf(L[0])].icon} ${t('跟流行')}${t('：')}${L.map(f => t(nm(f))).join(t('、'))}` : ''; }
    function brief(w, a) {
        if (!w.fads || !a) return ''; const L = mine(w, a);
        if (L.length) return t('你最近跟著鎮上的流行：') + L.map(f => fill(MINE[kindOf(f)], { x: nm(f) })).join(t('、'));
        const hot = w.fads.list.find(f => f.ph === 'hot'); if (hot && (a.age ?? 30) >= 55) return fill('你看不慣年輕人最近流行的{x}', { x: nm(hot) });
        return '';
    }
    function townBrief(w) {
        const L = (w.fads?.list || []).filter(f => f.ph === 'hot'); if (!L.length) return '';
        return t('鎮上最近流行') + t('：') + L.map(f => t(nm(f))).join(t('、'));
    }
    function view(w) {
        const F = w.fads; if (!F) return null; const ppl = here(w), ids = new Set(ppl.map(a => a.agentId)), N = Math.max(1, ppl.length);
        const items = F.list.map(f => { const n = Object.keys(f.ad).filter(id => ids.has(id)).length; return { icon: KINDS[kindOf(f)].icon, name: nm(f), kind: KINDS[kindOf(f)].zh, n, pct: Math.round(n / N * 100), ph: f.ph, phName: PH[f.ph] || '', by: f.byN, retro: !!f.retro }; });
        const hist = F.hist.slice(0, 4).map(h => ({ icon: KINDS[LIST[h.ix]?.k]?.icon || '', name: LIST[h.ix]?.zh || '', max: h.max, days: Math.max(1, (h.d1 || 0) - (h.d0 || 0)), cust: !!h.cust }));
        return { items, hist, st: F.st || {} };
    }
    return { MAX, KINDS, LIST, PH, S, daily, spawn, adopt, tryAdopt, contact, open, imit, mine, wearOf, wearDef, tag, brief, townBrief, view, nm };
})();

// ---- 掛上:每日、聊天、AI 提示詞、3D 外觀、存讀檔 ----
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) FADS.daily(w); } catch (e) { console.warn('[Fads] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _fb = CE._fallbackConversation, _pc = CE._parseConversation;
    CE._fallbackConversation = function (a, b, world, relA, relB) {
        const r = _fb.call(this, a, b, world, relA, relB);
        try {
            if (world.observerMode && world.fads) {
                const L = this.npcConversationLog?.[this.npcConversationLog.length - 1];
                const target = (L && L.agentA === a.name && L.agentB === b.name && Array.isArray(L.dialogue)) ? L.dialogue : (r && Array.isArray(r.dialogue) ? r.dialogue : null);
                FADS.contact(world, a, b, target ? (who, text) => { target.push({ speaker: who.name, text }); if (r && Array.isArray(r.dialogue) && r.dialogue !== target) r.dialogue.push({ speaker: who.name, text }); } : null);
            }
        } catch (e) { console.warn('[Fads] talk', e); }
        return r;
    };
    if (_pc) CE._parseConversation = function (response, a, b, world, relA, relB) { const r = _pc.call(this, response, a, b, world, relA, relB); try { if (world?.observerMode && world.fads) FADS.contact(world, a, b, null); } catch (e) {} return r; };
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = FADS.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    if (CE._townBrief) { const _tb = CE._townBrief; CE._townBrief = function (world, ...rest) { const base = _tb.call(this, world, ...rest); try { const x = FADS.townBrief(world); if (x && typeof base === 'string') return base ? `${base}${t('；')}${x}` : x; } catch (e) {} return base; }; }
}
if (typeof LOOK !== 'undefined') {
    const _of = LOOK.of, _sig = LOOK.sig;
    LOOK.of = function (w, a) { const r = _of(w, a); try { const ix = FADS.wearOf(w, a); if (r && ix != null) r.fd = ix; } catch (e) {} return r; };
    LOOK.sig = (p) => _sig(p) + (p?.fd != null ? 'F' + p.fd : '');
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.fads = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.fads) d.fads = this.fads; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.fads = (data?.fads && Array.isArray(data.fads.list)) ? data.fads : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.FADS = FADS;
