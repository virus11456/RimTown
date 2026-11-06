// v6.70.0 經濟深化:創業開店、合夥與分紅糾紛、討價還價、銀行家審核放貸
// - 創業:想發財、勤快或有創意又存了點錢的人會開店(依職業:麵包店、鐵匠鋪、裁縫店、藥鋪、小酒館、雜貨攤、畫坊);
//   店名由 AI 取(完整智能體模式)或照老闆的名字取;每天有客人上門,賺錢或虧錢,撐不下去就倒閉
// - 合夥:錢不夠時找交情好的朋友出資,每七天分紅;生意不好、有人愛計較或偷懶,可能鬧翻拆夥
// - 討價還價:有錢人買珍品時跟商人殺價,有魅力、會說話的人殺得比較多
// - 銀行家審核:名聲差(被揭過底)或跟銀行家處不好的人借不到錢;完整智能體模式下大筆貸款由銀行家 AI 決定
const BIZ = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('trade', k, p || {}, who || ''); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const TYPES = {
        bakery: { icon: '🥖', zh: '麵包店', en: 'Bakery', job: 'cook', price: 3 }, smithy: { icon: '⚒️', zh: '鐵匠鋪', en: 'Smithy', job: 'blacksmith', price: 6 },
        tailor: { icon: '🧵', zh: '裁縫店', en: 'Tailor', job: 'tailor', price: 5 }, apothecary: { icon: '🌿', zh: '藥鋪', en: 'Apothecary', job: 'doctor', price: 5 },
        inn: { icon: '🍺', zh: '小酒館', en: 'Tavern', job: null, price: 3 }, stall: { icon: '🧺', zh: '雜貨攤', en: 'Stall', job: 'trader', price: 3 }, studio: { icon: '🎨', zh: '畫坊', en: 'Studio', job: null, price: 6 },
    };
    for (const v of Object.values(TYPES)) { try { I18N.registerName(v.zh, v.en); } catch (e) {} }
    function S(w) { if (!w.biz || !Array.isArray(w.biz.shops)) w.biz = { shops: [], n: 0, lastDay: null, closed: [] }; return w.biz; }
    const shopOf = (w, a) => S(w).shops.find(s => !s.closed && (s.owner === a?.agentId || s.partner === a?.agentId)) || null;
    function typeFor(a) { if (has(a, 'creative')) return 'studio'; for (const [k, T] of Object.entries(TYPES)) if (T.job && a.job?.key === T.job) return k; return Math.random() < 0.5 ? 'inn' : 'stall'; }
    function defaultName(a, k) { const T = TYPES[k]; const zhName = `${a.name.slice(0, 1)}記${T.zh}`; const enName = `${(typeof I18N !== 'undefined' ? I18N.localizeNames(a.name, true) : a.name).split(' ')[0]}'s ${T.en}`; return [zhName, enName]; }
    async function open(w, B, a, d) {
        const k = typeFor(a); const T = TYPES[k]; const cost = 60; let partner = null;
        if (cash(w, a) < cost) { partner = npcs(w).filter(o => o !== a && cash(w, o) >= 60 && aff(o, a) >= 40 && !shopOf(w, o)).sort((x, y) => aff(y, a) - aff(x, a))[0]; if (!partner) return null; }
        const mine = Math.min(cash(w, a), partner ? cost - 40 : cost); if (!WALLET.take(w, a, mine)) return null; if (partner && !WALLET.take(w, partner, 40)) { WALLET.add(w, a, mine); return null; }
        let name = defaultName(a, k);
        const S2 = { id: 'B' + (++B.n), type: k, owner: a.agentId, partner: partner?.agentId || null, name, price: T.price + (has(a, 'jealous') ? 1 : 0), till: 0, profit: 0, week: 0, opened: d, lossDays: 0, closed: false };
        B.shops.push(S2);
        const ce = ai(w);
        if (ce) { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('村民「')}${b.name}${t('」（')}${b.traits}${t('）要開一家')}${t(T.zh)}${t('。請幫他取一個有個人色彩的店名（8 字內），只輸出 JSON')}${t('：')}{"name":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 60); const nm = String(j?.name || '').trim().slice(0, 16); if (nm) { S2.name = [nm, nm]; } } catch (e) {} }
        try { I18N.registerName(S2.name[0], S2.name[1]); } catch (e) {}
        log(w, '{i} {a}開了一家{t}「{n}」{p}！', { i: T.icon, a: a.name, t: T.zh, n: S2.name[0], p: partner ? { k: '（跟{b}合夥）', p: { b: partner.name } } : '' }, a.name);
        mem(w, a, '我開了自己的店「{n}」，希望生意興隆。', { n: S2.name[0] }, 8);
        if (partner) mem(w, partner, '我出錢跟{a}合夥開「{n}」。', { a: a.name, n: S2.name[0] }, 7);
        return S2;
    }
    function trade(w, B, d) {
        const all = npcs(w);
        for (const s of B.shops) {
            if (s.closed) continue; const o = w.agents[s.owner]; if (!o || o.isDead) { close(w, s, 'gone'); continue; }
            const same = B.shops.filter(x => !x.closed && x.type === s.type).length;
            let sales = 0;
            for (const c of all) { if (c === o || cash(w, c) < s.price + 5) continue; const p = 0.08 / same * (6 / (s.price + 2)) * (1 + (has(o, 'charismatic') ? 0.3 : 0) + (aff(c, o) > 30 ? 0.3 : 0) - (aff(c, o) < -20 ? 0.6 : 0)); if (Math.random() < p && WALLET.take(w, c, s.price)) { s.till += s.price; sales++; } }
            const upkeep = 2; s.till -= upkeep; s.week += sales * s.price - upkeep; s.profit += sales * s.price - upkeep;
            s.lossDays = s.till < 0 ? s.lossDays + 1 : 0;
            if (s.till > 0) { const pay = (a, n) => (WALLET.bizIncome ? WALLET.bizIncome(w, a, n) : WALLET.add(w, a, n)); pay(o, s.till * (s.partner ? 0.5 : 1)); if (s.partner && w.agents[s.partner]) pay(w.agents[s.partner], s.till * 0.5); s.till = 0; } // v6.81.0 店裡的進帳先繳營業稅
            if (s.lossDays >= 15 || (s.till < -40)) close(w, s, 'broke');
            if (d % 7 === 0) weekly(w, s);
        }
    }
    function weekly(w, s) {
        const o = w.agents[s.owner], p = s.partner ? w.agents[s.partner] : null;
        if (p && !s.closed) {
            const grumpy = has(p, 'jealous') || has(o, 'jealous') || has(o, 'lazy') || has(p, 'lazy');
            if (s.week < 5 && grumpy && Math.random() < 0.3) {
                o.relationships.getOrCreate(p.agentId, p.name).modifyAffinity(-20); p.relationships.getOrCreate(o.agentId, o.name).modifyAffinity(-20);
                log(w, '💢 {a}和{b}為了「{n}」分錢不公鬧翻，拆夥了。', { a: o.name, b: p.name, n: s.name[0] }, o.name);
                mem(w, o, '{b}嫌分紅不公平，跟我拆夥了。', { b: p.name }, 8); mem(w, p, '跟{a}合夥開店，錢都被他拿走了，我不幹了。', { a: o.name }, 8);
                s.partner = null; s.split = true;
            }
        }
        if (s.week >= 25 && Math.random() < 0.5) mem(w, o, '「{n}」這週生意很好，賺了 {m} 銀幣。', { n: s.name[0], m: Math.round(s.week) }, 5);
        s.week = 0;
    }
    function close(w, s, why) {
        if (s.closed) return; s.closed = true; s.closedDay = day(w); const o = w.agents[s.owner];
        if (why === 'broke' && o) { log(w, '🏚️ 「{n}」撐不下去，倒閉了。', { n: s.name[0] }, o.name); mem(w, o, '我的店「{n}」倒了，好不甘心。', { n: s.name[0] }, 8); o.moodModifier = (o.moodModifier || 0) - 8; }
        const B = S(w); B.closed.push({ name: s.name, type: s.type, profit: Math.round(s.profit), day: day(w) }); if (B.closed.length > 6) B.closed.shift(); B.shops = B.shops.filter(x => !x.closed);
    }
    function daily(w) {
        if (!W() || !w.wallet) return; const B = S(w), d = day(w); if (B.lastDay === d) return; B.lastDay = d;
        trade(w, B, d);
        // 有人想創業
        if (B.shops.length < Math.max(2, Math.floor(npcs(w).length / 6))) {
            const amb = w.mind?.amb || {};
            const c = npcs(w).filter(a => (a.age || 30) >= 20 && !shopOf(w, a) && a.job?.key !== 'mayor' && (amb[a.agentId]?.key === 'rich' || has(a, 'hardworking') || has(a, 'creative') || a.job?.key === 'trader') && cash(w, a) >= 30);
            const a = c.sort(() => Math.random() - 0.5)[0]; if (a && Math.random() < 0.15) open(w, B, a, d);
        }
    }
    // 討價還價
    function haggle(w, buyer, price) { if (!buyer || buyer === 'town') return { price, saved: 0 }; const skill = (has(buyer, 'charismatic') ? 0.08 : 0) + (has(buyer, 'perfectionist') ? 0.04 : 0) + (has(buyer, 'shy') ? -0.03 : 0) + Math.random() * 0.05; const cut = Math.max(0, Math.min(0.15, skill)); const np = Math.round(price * (1 - cut)); return { price: np, saved: price - np }; }
    // 銀行家審核
    function vet(w, B, a) {
        const banker = w.agents[B.banker]; const rep = w.dark?.rep?.[a.agentId] || {};
        if ((rep.exposed || 0) >= 2) return { ok: false, why: 'rep' };
        if (banker && aff(banker, a) < -20) return { ok: false, why: 'dislike' };
        return { ok: true };
    }
    function view(w) { const B = S(w); return { shops: B.shops.map(s => ({ icon: TYPES[s.type].icon, name: en() ? s.name[1] : s.name[0], type: t(TYPES[s.type].zh), owner: t(w.agents[s.owner]?.name || ''), partner: s.partner ? t(w.agents[s.partner]?.name || '') : null, profit: Math.round(s.profit), price: s.price })), closed: B.closed.slice(-3).map(c => ({ name: en() ? c.name[1] : c.name[0], profit: c.profit })) }; }
    function chip(w, a) { const s = shopOf(w, a); if (!s) return ''; return `${TYPES[s.type].icon} ${s.owner === a.agentId ? t('老闆') : t('合夥人')}${t('：')}${en() ? s.name[1] : s.name[0]}`; }
    return { TYPES, S, open, trade, weekly, close, daily, haggle, vet, view, chip, shopOf };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BIZ.daily(w); } catch (e) { console.warn('[Biz] daily', e); } return r; };
}
// 珍品殺價
if (typeof GOODS !== 'undefined') {
    const _buy = GOODS.buy;
    GOODS.buy = function (w, G, o, who) { if (who && who !== 'town') { const h = BIZ.haggle(w, who, o.price); if (h.saved > 0) { o = Object.assign({}, o, { price: h.price }); try { w.logMessageT?.('trade', '🗣️ {a}跟商人殺價，省下 {n} 銀幣。', { a: who.name, n: h.saved }, who.name); } catch (e) {} } } return _buy.call(this, w, G, o, who); };
}
// 銀行家審核;完整智能體模式大筆貸款問 AI
// v6.74.0 等待旗標改放記憶體(以前放在銀行狀態裡會被存檔,讀回後永遠「等待中」→ 之後的大額貸款都跳過 AI);
//          回覆回來時確認還是同一個世代、同一家銀行、同一個人才放款(以前換鎮後舊回覆會讓新鎮居民憑空多 80 銀幣)
if (typeof BANK !== 'undefined') {
    const _lend = BANK.lend; const asking = new WeakMap(); // 銀行狀態 → 開始等待的世代
    BANK.lend = function (w, B, a, n, why) {
        const v = BIZ.vet(w, B, a);
        if (!v.ok) { try { w.logMessageT?.('trade', '🏦 銀行家拒絕借錢給{a}{r}。', { a: a.name, r: v.why === 'rep' ? '（名聲太差）' : '（兩人處不好）' }, a.name); } catch (e) {} try { a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '銀行不肯借我錢。', {}, 6, []); } catch (e) {} return 0; }
        const ce = w.conversationEngine; const banker = w.agents[B.banker];
        if (n >= 40 && w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && banker && asking.get(B) !== w._gen) {
            asking.set(B, w._gen); const g0 = w._gen; const live = () => w._gen === g0 && w.bank === B && w.agents[a.agentId] === a && !a.isDead;
            (async () => { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('你是銀行家「')}${banker.name}${t('」。')}${b.name}${t('想借')} ${Math.round(n)} ${t('銀幣')}${t('（')}${t(why || '周轉')}${t('）')}${t('。')}${t('他的狀況')}${t('：')}${(b.mem || []).slice(0, 4).join(' / ')}${t('。')}${t('要借嗎？只輸出 JSON')}${t('：')}{"lend":true,"why":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 100); if (!live()) return; if (j && j.lend === false) { w.logMessageT?.('trade', '🏦 銀行家{b}拒絕了{a}的貸款：{x}', { b: banker.name, a: a.name, x: String(j.why || '').slice(0, 50) }, banker.name); } else _lend.call(BANK, w, B, a, n, why); } catch (e) { if (live()) _lend.call(BANK, w, B, a, n, why); } finally { if (asking.get(B) === g0) asking.delete(B); } })();
            return 0;
        }
        return _lend.call(this, w, B, a, n, why);
    };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.biz = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.biz) d.biz = this.biz; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.biz = (data?.biz && Array.isArray(data.biz.shops)) ? data.biz : null; for (const s of (this.biz?.shops || [])) I18N.registerName(s.name[0], s.name[1]); } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.BIZ = BIZ;
