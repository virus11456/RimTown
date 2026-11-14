// RimTown - sim-schemes.js：v9.33.0 個人企劃
// 提案是公家的事（花公庫、全鎮表決、管到每個人）；個人企劃是私人的事：自己出錢、自己找人、只牽涉答應的人和被針對的人。
// 一件企劃的一生：
//   1. 發起：某個村民想到一件事（AI 自己想；或他在別的事上自己拿的主意；AI 關著時照個性套樣板）
//   2. 找人：他去問幾個人，被問的人各自決定（走決策核心，所以開 AI 時是他自己說理由）：答應／推掉／嘴上答應其實不去／去告訴被針對的人
//   3. 當天：答應的人不一定到；到的人真的走到那個地點
//   4. 結果：成不成看來了幾個人、有沒有走漏風聲；成敗都有後果（心情、交情、名聲、被拆穿）
// 答應、到場、成功是分開記的三件事。暗著來的企劃只有觀察者看得到。
// 必須在 sim-decide*.js、sim-things.js、sim-dark.js、sim-notes.js 之後載入。
'use strict';

const SCHEME = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const adult = (a) => (a.age ?? 30) >= 16;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const mood = (a, n) => { if (a) a.moodModifier = (a.moodModifier || 0) + n; };
    const cash = (w, a) => { try { return a && typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0; } catch (e) { return 0; } };
    const safe = (f, d = null) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : (v && typeof v === 'object' && v.k) ? say(v) : v; return o; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, flat(p), who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, flat(p), imp, []); } catch (e) {} };
    const render = (k, p) => { try { return Memory.render(k, p || {}); } catch (e) { return String(k); } };
    function say(x) { return x == null ? '' : typeof x === 'string' ? render(x, {}) : x.raw != null ? String(x.raw) : x.k ? render(x.k, flat(x.p)) : ''; }
    const clean = (s, n) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').trim().replace(/^[「『"“]+|[」』"”]+$/g, '').slice(0, n);
    const en = () => { try { return typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en'; } catch (e) { return false; } };
    const nameL = (n) => { try { return typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(String(n), typeof I18N.getLang === 'function' && I18N.getLang() === 'en') : n; } catch (e) { return n; } };
    const byName = (w, s) => { const n = String(s || '').trim(); if (!n) return null; return npcs(w).find(o => o.name === n || (typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(o.name, true) === n : false)) || null; };
    const places = (w) => Object.keys(w.townMap?.locations || {}).filter(id => !/^residential|_front$|exploration/.test(id));
    const placeName = (w, id) => safe(() => (typeof locName === 'function' ? locName(w, id) : id), id);

    // 六種調性：決定預設時間、要不要瞞著人、成敗各有什麼後果
    const TONES = {
        fun: { icon: '🎪', name: '熱鬧一下', hour: 16, need: 1 },
        bond: { icon: '🤝', name: '拉人結伴', hour: 18, need: 1 },
        court: { icon: '💐', name: '追求', hour: 17, need: 0, target: true },
        show: { icon: '🎭', name: '出風頭', hour: 12, need: 0 },
        prank: { icon: '🃏', name: '惡作劇', hour: 14, need: 0, target: true, secret: true },
        spite: { icon: '🗡️', name: '算計', hour: 20, need: 0, target: true, secret: true },
    };
    const STAGE = { recruit: '找人中', set: '說定了', done: '辦完了', dropped: '作罷' };
    const ANS = { asked: '還沒回話', yes: '答應', no: '推掉', fake: '嘴上答應，其實不打算去', told: '推掉，還去告訴了當事人' };

    function S(w) { if (!w.schemes || !Array.isArray(w.schemes.list)) w.schemes = { v: 1, n: 0, list: [], last: -9 }; return w.schemes; }
    const get = (w, id) => S(w).list.find(x => x.id === id) || null;
    const active = (w) => S(w).list.filter(x => x.stage === 'recruit' || x.stage === 'set');
    const busy = (w, id) => active(w).some(x => x.by === id);
    const tell = (w, ev, P) => { try { w.onScheme?.(ev, P); } catch (e) {} };
    const note = (w, P, k, p) => { P.log.push({ d: day(w), k, p: p || {} }); if (P.log.length > 12) P.log.shift(); };

    // ---------- 1. 發起 ----------
    // o：{ title, why, tone, target, helpers:[agent|name], place, cost, ai, from }；title／why 可以是字串（AI 寫的）或 {k,p}（樣板）
    function create(w, a, o) {
        if (!w.observerMode || !inTown(w, a) || !adult(a) || busy(w, a.agentId)) return null;
        let tone = TONES[o.tone] ? o.tone : 'fun'; const pick = (x) => (x && x.agentId ? x : byName(w, x));
        let b = pick(o.target); if (b && (b === a || !inTown(w, b) || !adult(b))) b = null;
        if (TONES[tone].target && !b) tone = tone === 'court' ? 'fun' : 'show'; // 沒有對象就做不成這一類，改成不針對誰的
        const T = TONES[tone]; const X = S(w);
        const title = typeof o.title === 'string' ? { raw: clean(o.title, en() ? 180 : 60) } : o.title; const why = typeof o.why === 'string' ? { raw: clean(o.why, en() ? 160 : 60) } : (o.why || null);
        if (!say(title)) return null;
        let helpers = (o.helpers || []).map(pick).filter(x => x && x !== a && x !== b && inTown(w, x) && adult(x));
        if (!helpers.length && tone !== 'court') helpers = npcs(w).filter(x => x !== a && x !== b && inTown(w, x) && adult(x) && aff(a, x) > 15).sort((x, y) => aff(a, y) - aff(a, x)).slice(0, tone === 'spite' ? 1 : 2);
        helpers = [...new Set(helpers)].slice(0, 3);
        const ask = helpers.map(x => ({ id: x.agentId, nm: x.name, s: 'asked', y: null })); if (tone === 'court') ask.push({ id: b.agentId, nm: b.name, s: 'asked', y: null, guest: 1 });
        const locs = w.townMap?.locations || {}; const place = locs[o.place] ? o.place : (tone === 'bond' && locs.tavern ? 'tavern' : 'town_square');
        const P = { id: 'P' + String(++X.n).padStart(3, '0'), d0: day(w), when: day(w) + 1, hour: T.hour, by: a.agentId, byName: a.name, title, why, tone, secret: !!T.secret, target: b ? b.agentId : null, targetName: b ? b.name : '',
            place, cost: Math.max(0, Math.min(30, Math.floor(+o.cost || 0))), need: Math.min(T.need, ask.length), ask, came: [], stage: 'recruit', warned: false, out: null, ai: !!o.ai, from: o.from || '', log: [] };
        X.list.push(P); X.last = day(w); if (X.list.length > 40) X.list.splice(0, X.list.length - 40);
        note(w, P, '{a}想到一件事', { a: a.name });
        if (P.secret) log(w, '🤫 {a}私下打著主意：{x}', { a: a.name, x: title }, a.name); else log(w, '🎯 {a}想辦一件事：{x}', { a: a.name, x: title }, a.name);
        mem(w, a, '我打算{x}。', { x: title }, 6);
        for (const q of ask) { const x = w.agents[q.id]; if (x && typeof DECIDE !== 'undefined') DECIDE.enqueue(w, x, 'schemeAsk', { sid: P.id }); }
        tell(w, 'new', P); return P;
    }
    // 照個性套樣板（AI 關著時）：有仇人的想算計或捉弄、有心上人的想約、其餘想熱鬧或結伴
    function ruleInvent(w, a) {
        const others = npcs(w).filter(x => x !== a && inTown(w, x) && adult(x)); if (!others.length) return null;
        const foe = others.filter(x => aff(a, x) < -25).sort((x, y) => aff(a, x) - aff(a, y))[0]; const mal = safe(() => DARK.malice(a), 0.3);
        let crush = safe(() => { const c = w.confessCands?.(a); const x = Array.isArray(c) ? c[0] : c; return x?.agentId ? x : (x?.b || x?.target || null); });
        if (crush && !inTown(w, crush)) crush = null;
        const r = Math.random(); const pl = places(w); const p = pl.length ? pl[Math.floor(Math.random() * pl.length)] : 'town_square';
        if (foe && r < 0.25 + mal * 0.5) return mal > 0.55 ? { tone: 'spite', target: foe, title: { k: '設個局讓{b}出醜', p: { b: foe.name } }, why: '這口氣嚥不下去' } : r < 0.2 ? { tone: 'prank', target: foe, title: { k: '捉弄{b}一下', p: { b: foe.name } }, why: '看他不順眼，鬧他一下' } : { tone: 'show', target: foe, title: { k: '當眾露一手，讓{b}看看', p: { b: foe.name } }, why: '不想被比下去' };
        if (crush && r < 0.7) return { tone: 'court', target: crush, title: { k: '約{b}出來走走', p: { b: crush.name } }, why: '心裡放不下他' };
        if (r < 0.6) return { tone: 'fun', place: p, cost: 4, title: { k: '在{p}辦一場小比賽', p: { p: placeName(w, p) } }, why: '日子太悶了' };
        return { tone: 'bond', title: '找幾個信得過的人結伴互相照應', why: '多個朋友多條路' };
    }
    // 問 AI：讓他自己想一件私事
    async function aiInvent(w, a) {
        const ce = w.conversationEngine; if (!ce?.fullAgentOk?.(w) || !ce._askJson || !ce._agentBrief) return null;
        const b = ce._agentBrief(w, a, null); const L = b.ledger && typeof DECIDE !== 'undefined' ? DECIDE.lines(b.ledger, { cap: { self: 4, world: 2 }, cut: en() ? 150 : 60 }) : (b.mem || []);
        const loc = (n) => (en() && typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(n, true) : n);
        const known = npcs(w).filter(x => x !== a && inTown(w, x) && adult(x)).map(x => [x, aff(a, x)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 10).map(([x, v]) => `${loc(x.name)}${t('（')}${t(v > 40 ? '很要好' : v > 10 ? '有交情' : v < -25 ? '有過節' : v < -5 ? '不太對盤' : '普通')}${t('）')}`).join(t('、'));
        const pls = places(w).slice(0, 12).map(id => `${id}${t('＝')}${placeName(w, id)}`).join(t('、'));
        const recent = S(w).list.slice(-5).map(x => say(x.title)).filter(Boolean).join(t('；'));
        const prompt = `${t('你正在扮演「')}${b.name}${t('」（')}${b.age}${t('歲，')}${b.job}${t('；')}${t('性格')}${t('：')}${b.traits}${t('；')}${t('在乎')}${t('：')}${b.values}${t('；')}${t('心情')} ${b.mood}/100${t('）。')}
${t('你想私下辦一件自己的事。不是向全鎮提案，不花公家的錢，只找你自己信得過的人。可以是好玩的、溫暖的，也可以是小心眼的、愛面子的、想出一口氣的：辦比賽、組個小圈子、追一個人、出風頭、捉弄人、設局讓誰難看都行。要像你這個人，從你最近真的遇到的事出發。')}
${L.join('\n')}
${t('【你認識的人】')}${known}
${t('【可以去的地方】')}${pls}
${recent ? `${t('【鎮上最近已經有人做過的（不要一樣）】')}${recent}\n` : ''}${t('只輸出 JSON：{"title":"要做的事（15 字內）","why":"你自己口吻的一句心裡話（30 字內）","tone":"fun|bond|court|show|prank|spite","target":"針對或追求的人名（沒有就空字串）","helpers":["想找來幫忙或一起的人名，最多 3 個"],"place":"地點代號","cost":你自己願意花的銀幣 0~30}；現在沒有想做的事就輸出 {"skip":true}')}
${t('tone 的意思：fun 熱鬧好玩、bond 拉人結伴、court 追求某人、show 出風頭、prank 惡作劇、spite 算計某人。court、prank、spite 一定要有 target。')}`;
        try { ce._countNpcLlmUse?.(w); } catch (e) {}
        const j = await ce._askJson(en() && typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(prompt, true) : prompt, 260);
        if (j && j.skip === true) return { skip: true }; // 他自己說現在沒有想做的事
        if (!j || typeof j !== 'object' || Array.isArray(j) || !j.title) return null; // AI 沒回或答非所問
        return { title: String(j.title), why: String(j.why || ''), tone: String(j.tone || 'fun'), target: j.target, helpers: Array.isArray(j.helpers) ? j.helpers : [], place: String(j.place || ''), cost: +j.cost || 0, ai: true };
    }
    // 他在別的事上自己拿的主意（決策核心的「其他」）：讓它真的發生。調性和對象從他寫的那句話裡猜
    const KW = [['spite', /報復|教訓|設局|陷害|整他|讓.{0,6}難看|八卦|謠言|造謠|抹黑|壞話|出醜|難堪|revenge|frame|get back at|rumou?r|smear|humiliate/i], ['prank', /捉弄|惡作劇|嚇|prank|trick/i], ['court', /表白|追求|送花|約.{0,4}出來|court|confess|woo/i], ['show', /展示|炫|風頭|讓.{0,12}看|比下去|壓過|show off|outshine|prove/i], ['bond', /結盟|拉攏|聯手|結伴|ally|team up/i], ['fun', /比賽|聚|請客|慶祝|辦一場|contest|party|feast/i]];
    function fromIdea(w, a, text, why) {
        const s = String(text || ''); if (!s || busy(w, a.agentId) || active(w).length >= 3) return null;
        const tone = (KW.find(([, re]) => re.test(s)) || ['show'])[0];
        const named = npcs(w).filter(x => x !== a && (s.includes(x.name) || s.includes(nameL(x.name)))); const target = named.sort((x, y) => aff(a, x) - aff(a, y))[0] || null;
        const pl = places(w).find(id => s.includes(placeName(w, id))) || '';
        return create(w, a, { title: s, why: why || '', tone, target, place: pl, ai: true, from: 'idea' });
    }

    // ---------- 2. 找人：被問的人自己決定 ----------
    function answer(w, P, x, s) { const q = P.ask.find(e => e.id === x.agentId); if (!q || q.s !== 'asked') return; q.s = s; q.d = day(w); }
    if (typeof DECIDE !== 'undefined') {
        DECIDE.kind('schemeAsk', {
            title: '有人來找他一起做件事', scan: false, pri: 2, cool: 0, when: () => null,
            facts(w, x, ctx) {
                const P = get(w, ctx.sid); if (!P) return ''; const q = P.ask.find(e => e.id === x.agentId);
                const base = t(q?.guest ? '{a}約你{h}點到{p}，他想：{x}。' : '{a}來找你，想請你一起：{x}（{h}點在{p}）。').replace('{a}', P.byName).replace('{h}', P.hour).replace('{p}', placeName(w, P.place)).replace('{x}', say(P.title));
                return base + (P.why ? t('他說：「{y}」').replace('{y}', say(P.why)) : '') + (P.target && !q?.guest ? t('這件事是衝著{b}來的。').replace('{b}', P.targetName) + (P.secret ? t('要瞞著他。') : '') : '');
            },
            options(w, x, ctx) {
                const P = get(w, ctx.sid); if (!P || P.stage !== 'recruit') return []; const a = w.agents[P.by]; const q = P.ask.find(e => e.id === x.agentId); if (!a || !q || q.s !== 'asked') return [];
                const f = aff(x, a) / 25; const b = P.target ? w.agents[P.target] : null; const dark = P.tone === 'spite' || P.tone === 'prank'; const hon = safe(() => DARK.honesty(x), 0.5);
                const o = [
                    { id: 'join', text: q.guest ? '答應赴約' : '答應，到時候去', say: { k: '答應了{a}', p: { a: a.name } }, why: q.guest ? '去看看也好' : '他都開口了', base: 0.9 + f - (dark ? hon * 0.6 : 0) - (b && !q.guest ? Math.max(0, aff(x, b)) / 40 : 0), lean: { bond: 0.5, joy: 0.3 }, run: (w2) => { answer(w2, P, x, 'yes'); bump(a, x, 2); return { k: '說好了' }; } },
                    { id: 'no', text: q.guest ? '婉拒' : '推掉', say: { k: '推掉了{a}', p: { a: a.name } }, why: q.guest ? '沒有那個意思' : '不想攪和', base: 0.8 - f * 0.5 + (dark ? hon * 0.5 : 0), lean: { safe: 0.5 }, run: (w2) => { answer(w2, P, x, 'no'); return { k: '沒有答應' }; } },
                ];
                if (!q.guest) o.push({ id: 'fake', text: '嘴上答應，到時候不去', say: { k: '嘴上答應了{a}，心裡沒打算去', p: { a: a.name } }, why: '不好當面拒絕', base: 0.3 - f * 0.4 - hon * 0.4 + (has(x, 'shy') ? 0.3 : 0), lean: { face: 0.5, safe: 0.2 }, run: (w2) => { answer(w2, P, x, 'fake'); return { k: '嘴上說好' }; } });
                if (!q.guest && b && dark && inTown(w, b)) o.push({ id: 'tell', text: { k: '推掉，並且去告訴{b}', p: { b: b.name } }, say: { k: '把{a}的打算告訴了{b}', p: { a: a.name, b: b.name } }, why: '不能眼看他被算計', base: -0.2 + aff(x, b) / 30 - f * 0.5 + hon * 0.5, lean: { bond: 0.3 }, run: (w2) => { answer(w2, P, x, 'told'); P.warned = true; bump(b, x, 6); bump(b, a, -8); mem(w2, b, '{x}來告訴我，{a}打算{y}。我記下了。', { x: x.name, a: a.name, y: P.title }, 7); note(w2, P, '{x}把事情告訴了{b}', { x: x.name, b: b.name }); return { k: '{b}知道了', p: { b: b.name } }; } });
                return o;
            },
        });
        // 被問的人自己說的理由（AI 寫的）收進企劃卡片；他在別的事上自己拿的主意，變成一件企劃
        DECIDE.observe((ev, o) => {
            if (ev !== 'decided' || !o?.w || !o.a) return;
            if (o.K?.key === 'schemeAsk' && o.ctx?.sid) { const P = get(o.w, o.ctx.sid); const q = P?.ask.find(e => e.id === o.a.agentId); if (q && o.src === 'ai' && o.why && o.why.raw != null) q.y = { raw: String(o.why.raw) }; return; }
            if (o.src === 'ai' && o.op?.free && o.w.observerMode) { try { fromIdea(o.w, o.a, say(o.op.say || o.op.text), o.why && o.why.raw != null ? String(o.why.raw) : ''); } catch (e) { console.warn('[Scheme] idea', e); } }
        });
    }

    // ---------- 3. 每天半夜：昨天找的人有回音了，說定或作罷；再看今天有沒有人想到新的事 ----------
    function drop(w, P, k, p) { P.stage = 'dropped'; P.out = { ok: false, k, p: p || {} }; note(w, P, k, p); const a = w.agents[P.by]; mood(a, -3); log(w, '🎯 {a}想辦的事（{x}）沒辦成：{y}', { a: P.byName, x: P.title, y: { k, p: p || {} } }, P.byName); tell(w, 'done', P); }
    function settle(w, P) {
        const a = w.agents[P.by]; if (!inTown(w, a)) return drop(w, P, '人不在鎮上，作罷');
        if (P.ask.some(q => q.s === 'asked') && day(w) - P.d0 < 2) return; // 還有人沒回話：再等一天
        for (const q of P.ask) if (q.s === 'asked') q.s = 'no'; // 兩天了還沒回話，當作沒答應
        const guest = P.ask.find(q => q.guest); if (guest && guest.s !== 'yes') { P.stage = 'done'; return finish(w, P, false, '{b}沒有答應赴約', { b: P.targetName }); }
        const yes = P.ask.filter(q => !q.guest && (q.s === 'yes' || q.s === 'fake'));
        if (yes.length < P.need) return drop(w, P, '找不到人一起，作罷');
        if (P.cost > 0) { const n = Math.min(P.cost, Math.floor(cash(w, a))); P.cost = n > 0 && safe(() => WALLET.pay(w, a, null, n, t('{a}辦事的花費').replace('{a}', a.name)), false) ? n : 0; }
        P.stage = 'set'; P.when = day(w); note(w, P, '說定了：今天 {h} 點在{p}', { h: P.hour, p: placeName(w, P.place) });
        // 答應的人不一定到：嘴上答應的不去；真心答應的也可能臨時不來（交情越淺越容易）
        const h0 = w.clock?.hour ?? 0, m0 = w.clock?.minute ?? 0; const base = w.tickCount - h0 * 4 - Math.floor(m0 / 15); try { if (typeof THINGS !== 'undefined') THINGS.S(w); } catch (e) {}
        const go = [a]; for (const q of P.ask) { const x = w.agents[q.id]; if (!x || q.s !== 'yes') continue; if (!q.guest && Math.random() < 0.18 - aff(x, a) / 400) { q.ns = 1; continue; } go.push(x); }
        P.going = go.map(x => x.agentId);
        for (const x of go) if (!x._ceremony) x._thingGo = { place: P.place, from: base + P.hour * 4 - 2, until: base + (P.hour + 2) * 4, why: 'scheme', id: P.id };
        tell(w, 'set', P);
    }
    function daily(w) {
        if (!w.observerMode || typeof DECIDE === 'undefined') return; const X = S(w); const d = day(w); if (X.day === d) return; X.day = d;
        for (const P of X.list) { if (P.stage === 'recruit' && P.d0 < d) { try { settle(w, P); } catch (e) { console.warn('[Scheme] settle', e); P.stage = 'dropped'; } } else if (P.stage === 'set' && P.when < d) { try { resolve(w, P); } catch (e) { P.stage = 'done'; } } }
        if (X.quiet || active(w).length >= 2) return; // quiet：不自己冒出新的（測試用）
        const pool = npcs(w).filter(a => inTown(w, a) && adult(a) && !busy(w, a.agentId) && !X.list.some(P => P.by === a.agentId && d - P.d0 < 6)); if (!pool.length) return;
        // 誰比較會想搞事：外向、有野心、有仇人、心情特別好或特別差的
        const wt = (a) => 1 + (has(a, 'charismatic') ? 1 : 0) + (has(a, 'ambitious') ? 0.8 : 0) + (has(a, 'shy') ? -0.6 : 0) + (npcs(w).some(x => aff(a, x) < -25) ? 0.8 : 0);
        let tot = 0; const ws = pool.map(a => { const v = Math.max(0.1, wt(a)); tot += v; return v; }); let r = Math.random() * tot; let a = pool[0]; for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { a = pool[i]; break; } }
        const ce = w.conversationEngine; const ai = !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson);
        const roll = Math.random(); // 先擲好：AI 沒回話時要不要照個性補一件（機率跟 AI 關著時一樣）
        if (ai) { aiInvent(w, a).catch(() => null).then(o => { if (w.schemes !== X || !inTown(w, a) || o?.skip) return; if (!o) o = roll < 0.5 ? ruleInvent(w, a) : null; // AI 沒回或答非所問：照個性
            if (o && create(w, a, o)) { try { DECIDE.drain(w, DECIDE.S(w), day(w)); } catch (e) {} } }).catch(() => {}); return; } // 半夜的每日處理已經跑完了，邀請自己送出去
        if (roll < 0.5) { const o = ruleInvent(w, a); if (o) create(w, a, o); }
    }

    // ---------- 4. 當天：到了時間，看誰真的來了，分出成敗 ----------
    const pairs = (L, n) => { let k = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length && k < 12; j++, k++) { bump(L[i], L[j], n); bump(L[j], L[i], n); } };
    function finish(w, P, ok, k, p) {
        P.stage = 'done'; P.out = { ok, k, p: p || {} }; note(w, P, k, p); const a = w.agents[P.by];
        const who = P.came.map(id => w.agents[id]).filter(Boolean); const text = { k, p: p || {} };
        if (a) mem(w, a, ok ? '我想做的事辦成了：{x}。{y}' : '我想做的事沒成：{x}。{y}', { x: P.title, y: text }, 7);
        for (const x of who) if (x !== a) mem(w, x, '我去了{a}辦的事（{x}）。{y}', { a: P.byName, x: P.title, y: text }, 5);
        if (!P.secret || !ok) log(w, ok ? '🎯 {a}的事辦成了（{x}）：{y}' : '🎯 {a}的事沒成（{x}）：{y}', { a: P.byName, x: P.title, y: text }, P.byName);
        tell(w, 'done', P);
    }
    function resolve(w, P) {
        const a = w.agents[P.by]; if (!inTown(w, a)) return drop(w, P, '人不在鎮上，作罷');
        const b = P.target ? w.agents[P.target] : null; const came = (P.going || []).map(id => w.agents[id]).filter(x => x && inTown(w, x) && !x._ceremony);
        P.came = came.map(x => x.agentId); const helpers = came.filter(x => x !== a && x !== b); const n = helpers.length;
        for (const q of P.ask) if (q.s === 'yes' && !P.came.includes(q.id)) q.ns = 1;
        const p = Math.max(0.08, Math.min(0.92, 0.5 + n * 0.12 + (has(a, 'charismatic') ? 0.1 : 0) - (P.warned ? 0.45 : 0) - (P.need > n ? 0.3 : 0))); const ok = Math.random() < p; P.p = Math.round(p * 100);
        const T = P.tone;
        if (T === 'fun') { if (ok) { for (const x of came) mood(x, 4); pairs(came, 2); safe(() => DARK.bump(w, a, 'helped')); return finish(w, P, true, '辦成了，來了 {n} 個人，大家玩得開心', { n: came.length }); } mood(a, -4); return finish(w, P, false, '場面冷清，草草收場'); }
        if (T === 'bond') { if (ok && n) { pairs(came, 6); for (const x of came) mood(x, 2); return finish(w, P, true, '幾個人說好往後互相照應'); } mood(a, -3); return finish(w, P, false, '話不投機，沒談成'); }
        if (T === 'court') { if (ok && b && P.came.includes(b.agentId)) { bump(b, a, 10); bump(a, b, 4); mood(a, 6); mood(b, 3); return finish(w, P, true, '{b}被打動了', { b: b.name }); } mood(a, -6); if (b) bump(b, a, -2); return finish(w, P, false, '{b}沒有接受', { b: P.targetName }); }
        if (T === 'show') { if (ok) { mood(a, 5); for (const x of helpers) bump(x, a, 3); if (b) { mood(b, -4); bump(b, a, -6); mem(w, b, '{a}當眾出了風頭（{x}），擺明是做給我看的。', { a: a.name, x: P.title }, 6); return finish(w, P, true, '出了風頭，{b}臉上掛不住', { b: b.name }); } return finish(w, P, true, '出了風頭'); } mood(a, -6); for (const x of helpers) bump(x, a, -1); return finish(w, P, false, '沒人捧場，反倒丟了臉'); }
        // 暗著來的兩種：走漏風聲就敗露
        if (!b) return finish(w, P, false, '找不到人，沒得手');
        if (P.warned) { bump(b, a, -12); mood(a, -5); safe(() => DARK.bump(w, a, 'exposed')); safe(() => DARK.wrong(w, a, b, 2, '{a}想{x}，被我事先知道了', { a: a.name, x: say(P.title) })); mem(w, b, '{a}想算計我（{x}），幸好有人先告訴我。', { a: a.name, x: P.title }, 8); return finish(w, P, false, '{b}早有防備，事情敗露', { b: b.name }); }
        if (T === 'prank') { if (ok) { mood(b, -4); bump(b, a, -5); for (const x of came) mood(x, 3); mem(w, b, '我被{a}捉弄了（{x}）。', { a: a.name, x: P.title }, 6); return finish(w, P, true, '{b}被整到了', { b: b.name }); } mood(a, -3); mood(b, 2); return finish(w, P, false, '被{b}識破，反被笑了一頓', { b: b.name }); }
        if (ok) { mood(b, -6); safe(() => DARK.bump(w, a, 'scheme')); safe(() => DARK.secret(w, { kind: 'sabotage', culprit: a.agentId, victim: b.agentId, k: '{a}暗中算計了{b}：{x}', p: { a: a.name, b: b.name, x: say(P.title) } })); mem(w, b, '我最近吃了個悶虧，不知道是誰在背後搞鬼。', {}, 6); return finish(w, P, true, '{b}吃了悶虧，還不知道是誰做的', { b: b.name }); }
        mood(a, -3); return finish(w, P, false, '沒有得手');
    }
    function tick(w) {
        const X = w.schemes; if (!X || !X.list.length) return; const d = day(w); const h = w.clock?.hour ?? 0, m = w.clock?.minute ?? 0;
        for (const P of X.list) { if (P.stage !== 'set' || P.when !== d) continue;
            if (!P.started && h === P.hour && m < 15) { P.started = 1; tell(w, 'start', P); }
            if (h > P.hour || (h === P.hour && m >= 45)) { try { resolve(w, P); } catch (e) { console.warn('[Scheme] resolve', e); P.stage = 'done'; } } }
    }

    // ---------- 給畫面看 ----------
    function view1(w, P) {
        const T = TONES[P.tone] || TONES.fun; const nm = (id, fb) => nameL(w.agents[id]?.name || fb || id);
        return { id: P.id, stage: P.stage, stageName: render(STAGE[P.stage] || P.stage, {}), tone: P.tone, icon: T.icon, toneName: render(T.name, {}), secret: !!P.secret, ai: !!P.ai, from: P.from || '',
            title: say(P.title), why: say(P.why), by: P.by, byName: nm(P.by, P.byName), here: inTown(w, w.agents[P.by]), target: P.target, targetName: P.target ? nm(P.target, P.targetName) : '', warned: !!P.warned,
            place: P.place, placeName: placeName(w, P.place), d0: P.d0, when: P.when, hour: P.hour, cost: P.cost || 0,
            ask: P.ask.map(q => ({ id: q.id, name: nm(q.id, q.nm), s: q.s, label: render(q.guest ? ({ asked: '還沒回話', yes: '答應赴約', no: '婉拒' }[q.s] || q.s) : (ANS[q.s] || q.s), {}), y: say(q.y), guest: !!q.guest, came: P.came.includes(q.id), noShow: !!q.ns && P.stage === 'done' })),
            came: P.came.map(id => nm(id)), out: P.out ? { ok: !!P.out.ok, text: say(P.out) } : null, log: P.log.map(e => ({ d: e.d, text: say(e) })) };
    }
    const view = (w, n = 20) => S(w).list.slice(-n).reverse().map(P => view1(w, P));
    const stats = (w) => { const L = S(w).list; return { all: L.length, live: L.filter(P => P.stage === 'recruit' || P.stage === 'set').length }; };
    const ofAgent = (w, id) => S(w).list.filter(P => P.by === id).map(P => view1(w, P));

    return { S, get, create, ruleInvent, fromIdea, daily, tick, settle, resolve, view, stats, ofAgent, active, TONES };
})();

if (typeof ProposalSystem !== 'undefined') {
    // 排在決策核心的每日處理之前：半夜發出去的邀請，當晚就輪到被問的人拿主意
    const _d = ProposalSystem.prototype.daily;
    ProposalSystem.prototype.daily = function (w, ...rest) { try { SCHEME.daily(w); } catch (e) { console.warn('[Scheme] daily', e); } return _d.call(this, w, ...rest); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _tick = WP.tick; WP.tick = function (...a) { const r = _tick.apply(this, a); try { if (this.schemes) SCHEME.tick(this); } catch (e) {} return r; };
    const _reset = WP.reset; WP.reset = function (...a) { const r = _reset.apply(this, a); this.schemes = null; return r; };
    const _ser = WP.serialize; WP.serialize = function () { const d = _ser.call(this); if (d && this.schemes && this.schemes.list?.length) d.schemes = this.schemes; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.schemes = (data?.schemes && Array.isArray(data.schemes.list)) ? data.schemes : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.SCHEME = SCHEME;
