// v9.5.0 鎮上話題:大事會經過「醞釀 → 正熱 → 餘波 → 淡出」,大家同時只會關注兩三件事
// - 來源:每一則上日報的大事(重要度 6 以上)都會進話題池;同一個人、同一類的事會疊在一起越燒越旺
// - 醞釀:一開始只有少數人在講,村民聊天時提起會加溫;太久沒人理就自己熄掉
// - 正熱:全鎮都在談;新的大事冒出來時,最冷的那件會被擠出大家的注意力(「X 的事漸漸沒人提了」)
// - 餘波:熱度退了,當事人終於鬆一口氣;最後淡出,寫進「最近談過的事」
// - 影響:村民閒聊會講到正在熱的話題(依個性反應)、AI 對話與提案裁決的提示詞會帶上、問鎮上近況時會講
const BUZZ = (() => {
    const CAP = 3, HOT = 60, MAX = 12; // v9.5.1 門檻 50→60:單一則大新聞要有人跟進或熱議才會變全鎮話題
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const PH = { brew: ['醞釀中', 'brewing'], hot: ['正熱', 'hot'], after: ['餘波', 'fading'] };
    const ICON = { politics: '🏛️', event: '⚡', economy: '💰', social: '💬', relationship: '💞', drama: '🎭', lifecycle: '🕯️', incident: '🚨', weather: '🌪️', research: '🔬', building: '🏗️', festival: '🎉', exploration: '🧭', industry: '🏭', gossip: '🗣️', town: '🏘️', milestone: '🏆', recovery: '🌱', news: '📰' };
    const SKIP = new Set(['quest']);
    function S(w) { if (!w.buzz || !Array.isArray(w.buzz.items)) w.buzz = { items: [], hist: [], n: 0 }; return w.buzz; }
    const phName = (ph) => t((PH[ph] || PH.brew)[0]);
    const norm = (s) => String(s || '').replace(/[\s，。、！？：「」『』（）()!?,.:;'"“”]/g, '');
    // 收進話題池(dailyNews.collectEvent 會呼叫);_quiet:自己寫的新聞不要再回頭餵自己
    function feed(w, cat, text, imp, who) {
        if (!w || !text || (imp || 0) < 7 || SKIP.has(cat) || S(w)._quiet) return null; // v9.5.1 6→7,小事不進話題池
        const X = S(w), d = day(w); who = (Array.isArray(who) ? who : []).filter(Boolean).slice(0, 3);
        const key = cat + '|' + (who[0] || norm(text).slice(0, 8));
        let it = X.items.find(x => x.key === key);
        if (it) {
            it.heat = Math.min(150, it.heat + imp * 4 * (it.fed >= 3 ? 0.5 : 1)); it.fed++; it.last = d;
            if (imp >= it.imp) { it.text = String(text).slice(0, 80); it.imp = imp; }
            for (const n of who) if (!it.who.includes(n) && it.who.length < 4) it.who.push(n);
        } else {
            it = { id: 'Z' + (++X.n), key, cat, text: String(text).slice(0, 80), who, heat: imp * 5, peak: 0, ph: 'brew', d0: d, last: d, imp, fed: 1, talk: 0 };
            X.items.push(it);
            if (X.items.length > MAX) { X.items.sort((a, b) => b.heat - a.heat); for (const o of X.items.splice(MAX)) if (o.peak >= HOT) toHist(w, o); } // v9.5.1 被擠出池子的熱門話題也記進「最近談過」
        }
        it.peak = Math.max(it.peak, it.heat);
        return it;
    }
    function toHist(w, it) { const X = S(w); X.hist.push({ text: it.text, cat: it.cat, peak: Math.round(it.peak), d0: it.d0, d1: day(w), talk: it.talk }); if (X.hist.length > 12) X.hist.splice(0, X.hist.length - 12); }
    const ranked = (w) => S(w).items.slice().sort((a, b) => b.heat - a.heat);
    const attended = (w) => ranked(w).slice(0, CAP);
    // 村民聊天時挑一個話題(越熱越常被講);講了就加溫
    function talk(w, a, b) {
        const top = attended(w).filter(x => x.ph !== 'after' || x.heat >= 15); if (!top.length) return null;
        const tot = top.reduce((s, x) => s + x.heat, 0); let r = Math.random() * tot, it = top[0];
        for (const x of top) { if ((r -= x.heat) <= 0) { it = x; break; } }
        it.heat = Math.min(150, it.heat + 1.5 + (has(a, 'gossip') ? 1 : 0) + (has(b, 'gossip') ? 1 : 0)); it.talk++; it.peak = Math.max(it.peak, it.heat);
        return it;
    }
    // 依個性對話題的反應(一句)
    function react(a, it) {
        const bad = /失敗|過世|罹難|死|災|火|劫|竊|偷|醜聞|下台|政變|倒閉|擠兌|罷工|瘟|病|餓|爆|揭穿|被捕|坐牢|入獄|處刑|fail|died|death|disaster|fire|raid|theft|scandal|coup|strike|plague|arrest|jail/i.test(it.text);
        if (has(a, 'gossip')) return t('我還聽說了更多內幕，改天再跟你講！');
        if (bad && has(a, 'pessimist')) return t('我就說會出事吧，接下來只會更糟。');
        if (bad && has(a, 'optimist')) return t('會過去的，大家一起撐一下就好。');
        if (bad && has(a, 'kind')) return t('希望當事人還好，有需要我可以幫忙。');
        if (!bad && has(a, 'jealous')) return t('哼，有什麼了不起的。');
        if (!bad && has(a, 'romantic')) return t('真好，聽了心裡暖暖的。');
        if (has(a, 'stoic')) return t('嗯，日子還是要過。');
        return bad ? t('唉，這種事誰也不想遇到。') : t('真的假的？我得去打聽看看。');
    }
    function daily(w) {
        const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        try { if (w.dailyNews && !w.dailyNews._bw) Object.defineProperty(w.dailyNews, '_bw', { value: w, writable: true, configurable: true, enumerable: false }); } catch (e) {}
        const before = new Set(X.att || []);
        const top = new Set(attended(w).map(x => x.id));
        for (const it of X.items.slice()) {
            const on = top.has(it.id);
            if (it.ph === 'brew') {
                if (it.heat < HOT) it.heat *= on ? 0.93 : 0.82; // 一爆出來就夠大的事(重要度 10)直接變熱門
                if (it.heat >= HOT) { it.ph = 'hot'; it.hotDay = d; if (!(X.hotLog > d - 2)) { X.hotLog = d; log(w, '🔥 全鎮都在談：{x}', { x: it.text }, it.who[0] || ''); } } // v9.5.1 兩天內只報一次
                else if (d - it.d0 >= 5 && it.heat < HOT * 0.35) { X.items = X.items.filter(x => x !== it); continue; } // 沒人理就熄了
            } else if (it.ph === 'hot') {
                it.heat *= on ? 0.88 : 0.72;
                const pushed = !on && before.has(it.id); // 被新的大事擠出大家的注意力
                if (pushed || it.heat < it.peak * 0.5) {
                    it.ph = 'after';
                    if (pushed) { const nw = attended(w).find(x => !before.has(x.id)) || attended(w)[0]; if (nw && nw !== it) log(w, '📢 大家都在談「{n}」，{x}的事漸漸沒人提了。', { n: nw.text, x: it.text }, ''); }
                    for (const n of it.who) { const a = Object.values(w.agents).find(o => o && o.name === n && !o.isDead && !o.isPlayer); if (a) { try { a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '大家終於不再追著我問「{x}」的事了。', { x: it.text }, 4, []); } catch (e) {} } }
                }
            } else {
                it.heat *= 0.8;
            }
            it.peak = Math.max(it.peak, it.heat);
            if (it.ph !== 'brew' && it.heat < 8) { X.items = X.items.filter(x => x !== it); if (it.peak >= HOT) toHist(w, it); }
        }
        X.att = attended(w).map(x => x.id);
        // 「最近鎮上在聊」也換成正在熱的話題(問村民鎮上近況時會講)
        try { const ev = w.events; if (ev) { const hot = attended(w).filter(x => x.ph !== 'after').map(x => x.text); if (hot.length) ev.conversationTopics = (ev.conversationTopics || []).filter(s => !hot.includes(s)).concat(hot).slice(-8); } } catch (e) {}
    }
    function view(w) {
        const X = S(w), top = new Set(attended(w).map(x => x.id));
        return {
            items: ranked(w).filter(x => x.heat >= 8).slice(0, 6).map(x => ({ id: x.id, icon: ICON[x.cat] || '🗣️', text: x.text, ph: x.ph, phName: phName(x.ph), heat: Math.round(x.heat), on: top.has(x.id), who: x.who.slice(), days: day(w) - x.d0 + 1, talk: x.talk })),
            hist: X.hist.slice(-4).reverse().map(h => ({ icon: ICON[h.cat] || '🗣️', text: h.text, days: Math.max(1, h.d1 - h.d0 + 1), peak: h.peak })),
        };
    }
    function brief(w) {
        const top = attended(w).filter(x => x.heat >= 15); if (!top.length) return '';
        return `${t('鎮上最近大家在談')}${t('：')}${top.map(x => `${x.text}${t('（')}${phName(x.ph)}${t('）')}`).join(t('；'))}`;
    }
    return { CAP, HOT, S, feed, talk, react, daily, view, brief, attended, ranked, phName, ICON };
})();
// ---- 掛上:日報素材 → 話題池;每日更新;村民閒聊;AI 提示詞;存讀檔 ----
if (typeof DailyNewsEngine !== 'undefined') {
    const DP = DailyNewsEngine.prototype; const _ce = DP.collectEvent;
    DP.collectEvent = function (category, content, importance, agents = []) {
        const r = _ce.call(this, category, content, importance, agents);
        try { const w = this._bw || (typeof window !== 'undefined' ? window.rimtownApp?.world : null); if (w && w.dailyNews === this && w.observerMode) BUZZ.feed(w, category, typeof content === 'string' ? content : String(content || ''), importance || 0, agents); } catch (e) {}
        return r;
    };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BUZZ.daily(w); } catch (e) { console.warn('[Buzz] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _fb = CE._fallbackConversation;
    // 規則對話:有正在熱的話題時,三成的閒聊會順便聊到它(對話紀錄多兩句;不另外記憶,免得存檔變大)
    CE._fallbackConversation = function (a, b, world, relA, relB) {
        const r = _fb.call(this, a, b, world, relA, relB);
        try {
            if (world.observerMode && world.buzz && Math.random() < 0.3 + (a.personality?.traits?.includes('gossip') ? 0.3 : 0)) {
                const it = BUZZ.talk(world, a, b);
                if (it) {
                    const ask = t('你聽說了嗎？{x}').replace('{x}', it.text), ans = BUZZ.react(b, it);
                    const L = this.npcConversationLog?.[this.npcConversationLog.length - 1];
                    if (L && L.agentA === a.name && L.agentB === b.name && Array.isArray(L.dialogue)) L.dialogue.push({ speaker: a.name, text: ask }, { speaker: b.name, text: ans });
                    if (r && Array.isArray(r.dialogue) && r.dialogue !== L?.dialogue) r.dialogue.push({ speaker: a.name, text: ask }, { speaker: b.name, text: ans });
                }
            }
        } catch (e) { console.warn('[Buzz] talk', e); }
        return r;
    };
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.buzz && BUZZ.brief(world); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.buzz = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.buzz) d.buzz = { items: this.buzz.items, hist: this.buzz.hist, n: this.buzz.n, lastDay: this.buzz.lastDay, att: this.buzz.att, hotLog: this.buzz.hotLog }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.buzz = (data?.buzz && Array.isArray(data.buzz.items)) ? data.buzz : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.BUZZ = BUZZ;
