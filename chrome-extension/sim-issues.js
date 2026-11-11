// RimTown - sim-issues.js（v6.50.0）：鎮上急事。
// 系統每天看一次鎮況：缺糧、沒衣服穿、冬天沒柴燒、店裡缺貨、考驗、有人過不下去、結仇、士氣低落。
// 急事會真的影響村民（肚子餓、受凍、心情差、吵架、搬走），他們自己記得、自己感覺得到；
// AI 從三個地方知道：村民自身的狀態（_agentBrief）、鎮況（_townBrief）、提案發想時的急事清單（可在 addresses 填編號表示要處理哪一件）。
// 有人提了對應的提案就算「有人在處理」；拖著沒人管，抱怨、吵架、搬走會越來越多。
// 載入順序：sim-freeprop.js 之後（包 ProposalSystem 與 ConversationEngine 的原型）。
'use strict';
const TOWN_ISSUES = (() => {
    const MAX = 8;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const fill = (k, p) => { let s = t(k); for (const [x, v] of Object.entries(p || {})) s = s.split('{' + x + '}').join(String(v)); return s; };
    const rnd = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
    const name = (a) => (typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en' && typeof I18N !== 'undefined' && I18N.localizeNames) ? I18N.localizeNames(a.name, true) : a.name;
    // 村民自己感受到的(記憶想法:心情隨天數衰退)
    if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
        hungry:        { mood: -6, opinion: 0, days: 2, label: t('肚子吃不飽') },
        freezing:      { mood: -8, opinion: 0, days: 2, label: t('冷得發抖') },
        worn_clothes:  { mood: -3, opinion: 0, days: 2, label: t('衣服穿破了沒得換') },
        nothing_to_buy:{ mood: -3, opinion: 0, days: 2, label: t('想買的東西都買不到') },
        town_helpless: { mood: -4, opinion: 0, days: 2, label: t('鎮上出事了卻沒人想辦法') },
        ignored:       { mood: -6, opinion: 0, days: 3, label: t('覺得沒有人在乎我') },
        fought:        { mood: -8, opinion: -2, days: 4, label: t('跟人大吵一架') },
        no_materials:  { mood: -5, opinion: 0, days: 2, label: t('沒有原料，工作做不下去') },
        town_broke:    { mood: -3, opinion: 0, days: 2, label: t('公庫空了，大家都很擔心') },
    });
    if (typeof Memory !== 'undefined' && Memory.CATEGORY_CAP) Memory.CATEGORY_CAP.issue = 8; // 急事的記憶另外放,只留 8 筆
    const mem = (w, a, k, p, imp) => { try { a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'issue', k, p || {}, imp || 6, []); } catch (e) {} };

    // ---------- 偵測 ----------
    function detect(w) {
        const sp = w.stockpile; if (!sp) return [];
        const all = npcs(w), pop = Math.max(1, all.length), out = [];
        const g = (r) => sp.get(r) || 0;
        const winter = w.clock?.season === '冬季', autumn = w.clock?.season === '秋季';
        const food = g('food') + g('meals') * 2 + g('bread');
        if (food < pop * 4) out.push({ key: 'food', sev: food < pop * 1.5 ? 3 : 2, k: '存糧快見底了（剩 {n}，{p} 個人要吃）', p: { n: Math.round(food), p: pop } });
        const cl = g('clothing');
        if (cl < pop * 0.4) out.push({ key: 'clothing', sev: winter ? 3 : autumn ? 2 : 1, k: '衣服不夠穿（只剩 {n} 件）', p: { n: Math.round(cl) } });
        if (winter && g('wood') < pop * 3) out.push({ key: 'heating', sev: 3, k: '天冷了，取暖的木材快燒完了（剩 {n}）', p: { n: Math.round(g('wood')) } });
        const short = ['tools', 'medicine', 'furniture'].filter(r => g(r) < pop * 0.25);
        if (short.length >= 2) { const SI = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : {}; out.push({ key: 'goods', sev: 1, k: '鎮上缺東西，想買也買不到：{list}', p: { list: short.map(r => SI[r]?.name?.() || r).join(t('、')) } }); }
        // 經濟:工人缺原料(按缺的原料分組;受影響的就是那些工人本人)、公庫見底
        if (typeof JOB_PRODUCTION !== 'undefined') {
            const SI = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : {}, by = {};
            for (const a of all) { const rc = a.job && JOB_PRODUCTION[a.job.key]; if (!rc || !rc.inputs) continue; for (const [r, n] of Object.entries(rc.inputs)) if (r !== 'food' && g(r) < n * 2) { (by[r] || (by[r] = [])).push(a); break; } }
            for (const [r, ws] of Object.entries(by).sort((x, y) => y[1].length - x[1].length).slice(0, 2))
                out.push({ key: 'materials:' + r, sev: ws.length >= 2 ? 2 : 1, who: ws.map(a => a.agentId), k: '缺{item}：{list}的工作做不下去', p: { item: SI[r]?.name?.() || t(r), list: ws.slice(0, 3).map(name).join(t('、')) + (ws.length > 3 ? t('等') : '') } });
        }
        try { if (typeof WALLET !== 'undefined') out.push(...WALLET.issues(w)); } catch (e) {} // v6.54.0 村民窮到吃不起、公庫發不出薪水
        if (g('silver') < 30) out.push({ key: 'treasury', sev: 2, k: '公庫快空了（剩 {n} 銀幣），薪俸和修繕都發不出來', p: { n: Math.round(g('silver')) } });
        const tr = w.trials?.current;
        if (tr && tr.status === 'active' && typeof TRIAL_TYPES !== 'undefined' && TRIAL_TYPES[tr.type]) out.push({ key: 'trial:' + tr.type, sev: 3, k: '「{x}」正在考驗全鎮', p: { x: t(TRIAL_TYPES[tr.type].title) } });
        for (const a of all.filter(a => (a.mood || 0) < 15).sort((x, y) => (x.mood || 0) - (y.mood || 0)).slice(0, 2))
            out.push({ key: 'misery:' + a.agentId, sev: 2, who: [a.agentId], k: '{name}的日子快過不下去了（心情 {m}）', p: { name: name(a), m: Math.round(a.mood || 0) } });
        let worst = null;
        for (const x of all) for (const [tid, r] of Object.entries(x.relationships?.relationships || {})) {
            if ((r.affinity || 0) > -60) continue; const y = w.agents[tid]; if (!y || y.isPlayer || y.isDead || !all.includes(y)) continue;
            if (!worst || r.affinity < worst.aff) worst = { x, y, aff: r.affinity };
        }
        if (worst) { const key = [worst.x.agentId, worst.y.agentId].sort().join('|'); out.push({ key: 'feud:' + key, sev: 1, who: [worst.x.agentId, worst.y.agentId], k: '{a}和{b}的仇越結越深', p: { a: name(worst.x), b: name(worst.y) } }); }
        const avg = all.reduce((s, a) => s + (a.mood || 0), 0) / pop;
        if (all.length >= 3 && avg < 40) out.push({ key: 'gloom', sev: 2, k: '全鎮士氣低落（平均心情 {m}）', p: { m: Math.round(avg) } });
        return out.sort((a, b) => b.sev - a.sev).slice(0, MAX); // 最急的排前面
    }
    const text = (i) => fill(i.k, i.p);

    // ---------- 哪些提案算是在處理哪件急事 ----------
    function keysFor(w, p) {
        const out = new Set((p.addresses || []).filter(Boolean));
        const k = String(p.key || '');
        if (k.startsWith('trial:')) out.add(k);
        if (k.startsWith('relief:')) { out.add('misery:' + k.slice(7)); out.add('poverty'); }
        if (k.startsWith('mediate:')) out.add('feud:' + k.slice(8));
        if (k === 'feast' || k === 'festival' || k === 'honor') out.add('gloom');
        if (k.startsWith('market:buy:')) out.add('materials:' + k.slice(11));
        if (k.startsWith('market:sell:') || k === 'trade') { out.add('treasury'); out.add('wages'); }
        if (k.startsWith('market:buy:')) { const r = k.slice(11); if (r === 'food' || r === 'meals') out.add('food'); else if (r === 'clothing' || r === 'cloth') out.add('clothing'); else if (r === 'wood') out.add('heating'); else if (['tools', 'medicine', 'furniture'].includes(r)) out.add('goods'); }
        for (const e of (p.fx || [])) {
            const plus = (e.amount || e.value || 0) > 0;
            if ((e.type === 'resource' || e.type === 'daily') && plus) { out.add('materials:' + e.res); if (e.res === 'silver') out.add('treasury'); }
            if (e.type === 'modifier' && plus && (e.key === 'sell_bonus' || e.key === 'merchant_chance')) out.add('treasury');
            if ((e.type === 'resource' || e.type === 'daily') && plus) { if (['food', 'meals', 'bread'].includes(e.res)) out.add('food'); if (['clothing', 'cloth'].includes(e.res)) out.add('clothing'); if (e.res === 'wood') out.add('heating'); if (['tools', 'medicine', 'furniture'].includes(e.res)) out.add('goods'); }
            if (e.type === 'modifier' && plus && (e.key === 'farm_bonus' || e.key === 'gathering_bonus')) out.add('food');
            if (e.type === 'modifier' && plus && e.key === 'merchant_chance') out.add('goods');
            if (e.type === 'mood' && plus) { if (e.who === 'all') out.add('gloom'); else if (String(e.who).startsWith('id:')) out.add('misery:' + e.who.slice(3)); }
            if (e.type === 'relation' && plus) out.add('feud:' + [e.a, e.b].sort().join('|'));
            if (e.type === 'job' && e.job === 'farmer') out.add('food');
            if (e.type === 'job' && e.job === 'tailor') out.add('clothing');
        }
        return [...out];
    }
    function claim(w, P, p) {
        const I = P.issues || {}; let n = 0;
        for (const k of keysFor(w, p)) if (I[k]) { I[k].by = p.id; n++; }
        return n;
    }
    const ACTIVE = ['open', 'shelved', 'approved'];

    // ---------- 每天 ----------
    function daily(w, P, day, ch) {
        const I = P.issues || (P.issues = {});
        const now = detect(w), seen = new Set();
        const all = npcs(w); if (!all.length) return;
        for (const d of now) {
            seen.add(d.key);
            let it = I[d.key];
            if (!it) { it = I[d.key] = { key: d.key, since: day, idle: 0, by: null }; }
            Object.assign(it, { sev: d.sev, k: d.k, p: d.p, who: d.who || null, last: day });
            // 處理中的提案被否決/失敗,或做完了問題還在 → 又變成沒人管
            if (it.by) { const q = (P.items || []).find(x => x.id === it.by); if (!q || !ACTIVE.includes(q.status)) it.by = null; }
            if (!it.by) it.idle = (it.idle || 0) + 1;
            try { effect(w, P, it, day, all, ch); } catch (e) { console.warn('[Issues] effect', e); }
        }
        // 過去了
        for (const k of Object.keys(I)) {
            if (seen.has(k)) continue;
            const it = I[k]; delete I[k];
            if (day - (it.since || day) >= 2) {
                const x = text(it);
                w.logMessageT?.('council', '✅ 「{x}」總算過去了。', { x });
                for (const a of rnd(all, 3)) mem(w, a, '「{x}」總算過去了，鬆了一口氣。', { x }, 4);
            }
        }
    }
    // 真的發生在村民身上的事
    // v9.23.0 鎮上的事拖著沒人管時，要不要搬走交給本人決定(sim-decide-work.js「想不想離開這個鎮」)；這裡只剩「誰會動這個念頭」和結算。擲骰的版本留給直接呼叫 daily() 的情況
    const byChoice = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.work && !!DECIDE.on?.(w); } catch (e) { return false; } };
    // 這個人現在走得了嗎(小孩、鎮長不會自己走；鎮上只剩六個人不走；三天內已經有人為了這種事走了就先不走)
    const canLeave = (w, P, a, day, all) => !!a && (a.age ?? 30) >= 16 /* v9.9.4 小孩不會自己離鎮 */ && !String(a.agentId).startsWith('visit_') && all.length > 6 && (day - (P.issueLeaveDay ?? -99)) >= 3 && a.job?.key !== 'mayor';
    const LEAVE_WHY = { food: '鎮上沒東西吃', misery: '覺得沒人在乎自己', gloom: '鎮上氣氛太差' };
    // 這個人是不是正被鎮上的事逼得想走：缺糧嚴重、氣氛太差拖了五天以上(心情最差的三個人)；自己過得很慘、拖了七天沒人關心(本人)
    function leaveWhy(w, a) {
        const P = w.proposals; const I = P?.issues; if (!I || !a) return null; const day = P._abs ? P._abs(w) : 0; const all = npcs(w); if (!canLeave(w, P, a, day, all)) return null;
        const low = all.slice().sort((p, q) => (p.mood || 0) - (q.mood || 0)).slice(0, 3).includes(a);
        for (const it of Object.values(I)) { const idle = it.by ? 0 : (it.idle || 0); const k = String(it.key).split(':')[0];
            if (k === 'food' && it.sev >= 3 && idle >= 5 && low) return { key: 'food', idle, x: text(it) };
            if (k === 'misery' && it.who?.[0] === a.agentId && idle >= 7) return { key: 'misery', idle, x: text(it) };
            if (k === 'gloom' && idle >= 5 && low) return { key: 'gloom', idle, x: text(it) }; }
        return null;
    }
    // 本人決定搬走(由決策核心呼叫)
    function leaveBy(w, a, key) {
        const P = w.proposals; if (!P || !LEAVE_WHY[key]) return false; const day = P._abs ? P._abs(w) : 0; if (!canLeave(w, P, a, day, npcs(w))) return false;
        P.issueLeaveDay = day; return !!w.leaveTown?.(a.agentId, t(LEAVE_WHY[key]));
    }
    function effect(w, P, it, day, all, ch) {
        const idle = it.by ? 0 : (it.idle || 0), age = day - (it.since || day) + 1, x = text(it);
        const pick = (n) => rnd(all, n);
        const leave = (a, reason) => {
            if (ch || !canLeave(w, P, a, day, all)) return false;
            P.issueLeaveDay = day; return w.leaveTown?.(a.agentId, reason);
        };
        switch (it.key.split(':')[0]) {
            case 'food':
                for (const a of all) { a.needs && (a.needs.hunger = Math.max(0, a.needs.hunger - (it.sev >= 3 ? 18 : 10))); a.addThought?.('hungry', w); }
                if (age % 3 === 1) for (const a of all) mem(w, a, '存糧不夠，這幾天只能吃半飽，肚子一直餓。', {}, 6);
                if (it.sev >= 3 && idle >= 5 && Math.random() < 0.12) { const a = all.slice().sort((p, q) => (p.mood || 0) - (q.mood || 0))[0]; leave(a, t('鎮上沒東西吃')); }
                break;
            case 'clothing': {
                const cold = w.clock?.season === '冬季';
                for (const a of all) { if (a.needs) a.needs.comfort = Math.max(0, a.needs.comfort - (cold ? 14 : 6)); a.addThought?.(cold ? 'freezing' : 'worn_clothes', w); }
                if (age % 3 === 1) for (const a of pick(Math.ceil(all.length / 2))) mem(w, a, cold ? '天這麼冷，衣服卻破了沒得換，冷得發抖。' : '衣服都穿破了，鎮上也買不到新的。', {}, cold ? 6 : 4);
                break;
            }
            case 'heating':
                for (const a of all) { if (a.needs) a.needs.comfort = Math.max(0, a.needs.comfort - 12); a.addThought?.('freezing', w); }
                if (age % 3 === 1) for (const a of all) mem(w, a, '柴快燒完了，晚上屋裡冷得睡不著。', {}, 6);
                break;
            case 'goods':
                for (const a of pick(Math.ceil(all.length / 2))) { a.addThought?.('nothing_to_buy', w); if (age % 4 === 1) mem(w, a, '想買點東西，鎮上卻缺貨：{list}。', { list: it.p?.list || '' }, 4); }
                break;
            case 'trial':
                if (idle >= 3) for (const a of all) a.addThought?.('town_helpless', w);
                break;
            case 'misery': {
                const a = w.agents[it.who?.[0]]; if (!a) break;
                if (idle >= 3) { a.addThought?.('ignored', w); if (idle === 3) mem(w, a, '我都這樣了，鎮上卻沒有人來關心我。', {}, 7); }
                if (idle >= 7 && Math.random() < 0.15) leave(a, t('覺得沒人在乎自己'));
                break;
            }
            case 'feud': {
                const a = w.agents[it.who?.[0]], b = w.agents[it.who?.[1]]; if (!a || !b) break;
                if (idle >= 3 && Math.random() < 0.3) {
                    a.addThought?.('fought', w, b.agentId, b.name); b.addThought?.('fought', w, a.agentId, a.name);
                    a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(-6); b.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(-6);
                    w.logMessageT?.('social', '💢 {a}和{b}又在大街上吵起來，差點動手。', { a: a.name, b: b.name }, a.name);
                    w.dailyNews?.collectEvent?.('relationship', fill('{a}和{b}又在大街上吵起來，差點動手。', { a: a.name, b: b.name }), 5, [a.name, b.name]);
                    mem(w, a, '又跟{b}吵了一架，氣死我了。', { b: b.name }, 6); mem(w, b, '又跟{b}吵了一架，氣死我了。', { b: a.name }, 6);
                    for (const o of pick(2)) if (o !== a && o !== b) mem(w, o, '看到{a}和{b}在大街上吵架，鎮上沒人出來調解。', { a: a.name, b: b.name }, 4);
                }
                break;
            }
            case 'materials': {
                const ws = (it.who || []).map(id => w.agents[id]).filter(Boolean);
                for (const a of ws) { a.addThought?.('no_materials', w); if (age % 3 === 1) mem(w, a, '沒有{item}，我的工作根本做不下去，只能用邊角料將就。', { item: it.p?.item || '' }, 6); }
                break;
            }
            case 'treasury':
                if (age % 3 === 1) for (const a of pick(3)) { a.addThought?.('town_broke', w); mem(w, a, '公庫快見底了，聽說連守衛的薪俸都快發不出來。', {}, 5); }
                break;
            case 'gloom':
                if (idle >= 5 && Math.random() < 0.1) { const a = all.slice().sort((p, q) => (p.mood || 0) - (q.mood || 0))[0]; leave(a, t('鎮上氣氛太差')); }
                break;
        }
        // 拖著沒人管:第 3 天開始抱怨,之後每 4 天一次;鎮長被點名
        if (idle >= 3 && (idle - 3) % 4 === 0) {
            w.logMessageT?.('council', '🗣️ 「{x}」已經 {n} 天沒人提出辦法，村民開始抱怨。', { x, n: idle });
            w.dailyNews?.collectEvent?.('politics', fill('「{x}」已經 {n} 天沒人提出辦法，村民開始抱怨。', { x, n: idle }), 6, []);
            for (const a of pick(3)) mem(w, a, '「{x}」拖了 {n} 天都沒人想辦法，我對大家越來越失望。', { x, n: idle }, 6);
            const m = P._mayor?.(w); if (m) mem(w, m, '「{x}」拖了 {n} 天，大家開始怪我這個鎮長沒作為。', { x, n: idle }, 7);
        }
    }

    // ---------- 給 AI 看 ----------
    function list(P) { return Object.values(P?.issues || {}).sort((a, b) => (b.sev - a.sev) || ((b.idle || 0) - (a.idle || 0))).slice(0, MAX); }
    const status = (it) => it.by ? fill('（{id} 正在處理）', { id: it.by }) : (it.idle || 0) >= 3 ? fill('（{n} 天沒人處理，大家在抱怨）', { n: it.idle }) : '';
    function brief(w) { const L = list(w.proposals); if (!L.length) return ''; return `${t('；')}${t('急事')}${t('：')}${L.slice(0, 4).map(i => text(i) + status(i)).join(t('、'))}`; }
    function promptBlock(P) {
        const L = list(P); if (!L.length) return { txt: '', keys: [] };
        return { keys: L.map(i => i.key), txt: L.map((i, n) => `${n + 1}. ${text(i)}${status(i)}`).join('\n') };
    }
    // 村民自己身上的狀況與情緒(放在記憶最前面,AI 一定看得到):心情、身體需求、心裡掛著的事(開心的、難過的、嫉妒的…)
    function selfState(w, a) {
        const m = a.mood ?? 50, n = a.needs || {};
        const s = [m >= 75 ? t('心情很好') : m >= 55 ? t('心情不錯') : m >= 35 ? t('心情普通') : m >= 20 ? t('有點難過') : t('心情很差')];
        if ((n.hunger ?? 100) < 30) s.push(t('肚子很餓'));
        if ((n.rest ?? 100) < 25) s.push(t('累壞了'));
        if ((n.social ?? 100) < 25) s.push(t('覺得寂寞'));
        if ((n.comfort ?? 100) < 25) s.push(t('又冷又不舒服'));
        const now = w.clock?.totalDays || 0;
        const live = (a.thoughts || []).filter(x => now - x.start < x.days && x.mood);
        const feel = [...live.filter(x => x.mood < 0).sort((p, q) => p.mood - q.mood).slice(0, 2), ...live.filter(x => x.mood > 0).sort((p, q) => q.mood - p.mood).slice(0, 1)]
            .map(x => t(x.label) + (x.targetName ? `${t('（')}${name({ name: x.targetName })}${t('）')}` : '')).filter((x, i, arr) => arr.indexOf(x) === i);
        return t('我現在：') + s.join(t('、')) + (feel.length ? `${t('；')}${t('心裡掛著：')}${feel.join(t('、'))}` : '');
    }
    return { detect, daily, keysFor, claim, list, brief, promptBlock, selfState, text, status, leaveWhy, leaveBy, byChoice };
})();

// ---- 提案系統掛勾 ----
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w) {
        try { if (w.observerMode) { const day = this._abs(w); if (this._issueDay !== day) { this._issueDay = day; TOWN_ISSUES.daily(w, this, day, TOWN_ISSUES.byChoice(w)); } } } catch (e) { console.warn('[Issues] daily', e); }
        return _daily.call(this, w);
    };
    const _createWith = PS._createWith;
    PS._createWith = function (w, day, cand, a) { const p = _createWith.call(this, w, day, cand, a); try { if (p) TOWN_ISSUES.claim(w, this, p); } catch (e) {} return p; };
    // 規則模式也要有對策可提:缺糧/缺衣/缺柴時,進貨排在前面
    const _cands = PS._candidates;
    PS._candidates = function (w, day) {
        const out = _cands.call(this, w, day);
        try {
            const I = this.issues || {}, SI = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : {}, silver = w.stockpile?.get?.('silver') || 0;
            const need = [['food', 'food', 40], ['clothing', 'clothing', 10], ['heating', 'wood', 40]];
            for (const [ik, r, qty] of need) {
                if (!I[ik] || I[ik].by || !SI[r] || out.some(c => c.key === 'market:buy:' + r) || !this._cool(day, 'market:buy:' + r, 4)) continue;
                const price = SI[r].buyPrice * qty; if (silver < price) continue;
                out.push({ kind: 'market', key: 'market:buy:' + r, weight: 2.5 + I[ik].sev, jobs: ['trader', 'mayor', 'cook', 'tailor', 'carpenter'], make: (a) => ({ kind: 'market', key: 'market:buy:' + r, refKey: r, qty, side: 'buy', tk: '進一批{item}備料', tp: { item: SI[r].name() }, dk: '{item}快見底了，{who}提議從公庫撥 {n} 銀幣去商店進 {qty} 份。', dp: { item: SI[r].name(), who: a.name, n: price, qty }, cost: { silver: price }, category: 'economy', jobBias: ['trader'] }) });
            }
        } catch (e) {}
        return out;
    };
    // 規則投票:正在受苦的人,傾向支持處理那件急事的提案
    const _ruleVote = PS._ruleVote;
    PS._ruleVote = function (w, p, a) {
        _ruleVote.call(this, w, p, a);
        try { const I = this.issues || {}; const hit = TOWN_ISSUES.keysFor(w, p).map(k => I[k]).filter(Boolean); if (hit.some(i => i.sev >= 2) && p.votes[a.agentId] === 'against' && Math.random() < 0.5) p.votes[a.agentId] = 'for'; } catch (e) {}
    };
    const _serialize = PS.serialize;
    PS.serialize = function () { const d = _serialize.call(this); d.issues = this.issues || {}; d.issueLeaveDay = this.issueLeaveDay ?? null; return d; };
    const _loadFrom = PS.loadFrom;
    PS.loadFrom = function (d) { _loadFrom.call(this, d); this.issues = (d && typeof d.issues === 'object' && !Array.isArray(d.issues)) ? d.issues : {}; this.issueLeaveDay = d?.issueLeaveDay ?? null; };
    const _toDict = PS.toDict;
    PS.toDict = function (w) { const d = _toDict.call(this, w); d.issues = TOWN_ISSUES.list(this).map(i => ({ key: i.key, sev: i.sev, text: TOWN_ISSUES.text(i), status: TOWN_ISSUES.status(i), by: i.by || null, idle: i.idle || 0 })); return d; };
}
// ---- AI 引擎 ----
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _tb = CE._townBrief;
    CE._townBrief = function (world) { return _tb.call(this, world) + TOWN_ISSUES.brief(world); };
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = TOWN_ISSUES.selfState(world, a); if (s) b.mem = [s, ...(b.mem || [])]; } catch (e) {} return b; };
}
if (typeof globalThis !== 'undefined') globalThis.TOWN_ISSUES = TOWN_ISSUES;
