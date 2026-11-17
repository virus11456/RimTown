// RimTown - sim-board.js：v10.1.0 公告欄、信、流言
// 提案是公家的事，個人企劃是私下張羅的事；這裡是村民之間「一來一往」的三種東西，每一件都是有編號、看得到來回的卡片：
//   📌 公告（B 編號，全鎮看得到）：徵人幫忙、有東西要賣、尋物、抱怨、邀約；個人企劃裡不瞞人的活動也會貼出來
//      貼的人自己寫（開 AI 時是他自己的話，另外有一句不給別人看的盤算）；路過看到的人各自決定要不要回應
//   💌 信（B 編號，只有觀察者看得到）：約見面、道歉、表白、道謝、警告；收信的人自己決定答應、回絕、不回，或拿給別人看
//   🗣️ 流言（R 編號）：原本就有的八卦網路，這裡把「誰告訴誰、傳到第幾手、話變成什麼樣」記下來；
//      傳到本人耳裡時，由他自己決定對質、貼公告澄清、反過來傳對方的閒話、忍下來或一笑置之
// 回應的人都走決策核心，所以開 AI 時每一句話是他自己說的；AI 關著時照個性與交情推估。
// 必須在 sim-decide*.js、sim-things.js、sim-dark.js、sim-notes.js、sim-schemes.js 之後載入。
'use strict';

const BOARD = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const adult = (a) => (a.age ?? 30) >= 16;
    const ok = (w, a) => inTown(w, a) && adult(a);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { if (a && b && a !== b) a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const mood = (a, n) => { if (a) a.moodModifier = (a.moodModifier || 0) + n; };
    const safe = (f, d = null) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
    const cash = (w, a) => safe(() => (a && typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0), 0);
    const c01 = (v) => Math.max(0, Math.min(1, v));
    const hon = (a) => c01(safe(() => DARK.honesty(a), 3) / 6);   // 0 很不老實 ～ 1 很老實
    const mal = (a) => c01(safe(() => DARK.malice(a), 1) / 5);    // 0 沒有惡意 ～ 1 很記仇
    const render = (k, p) => { try { return Memory.render(k, p || {}); } catch (e) { return String(k); } };
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : (v && typeof v === 'object' && v.k) ? say(v) : v; return o; };
    function say(x) { return x == null ? '' : typeof x === 'string' ? render(x, {}) : x.raw != null ? String(x.raw) : x.k ? render(x.k, flat(x.p)) : ''; }
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, flat(p), who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, flat(p), imp, []); } catch (e) {} };
    const clean = (s, n) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').trim().replace(/^[「『"“]+|[」』"”]+$/g, '').slice(0, n);
    const en = () => { try { return typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en'; } catch (e) { return false; } };
    const nameL = (n) => { try { return typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(String(n), typeof I18N.getLang === 'function' && I18N.getLang() === 'en') : n; } catch (e) { return n; } };
    const byName = (w, s) => { const n = String(s || '').trim(); if (!n) return null; return npcs(w).find(o => o.name === n || (typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(o.name, true) === n : false)) || null; };
    const places = (w) => Object.keys(w.townMap?.locations || {}).filter(id => !/^residential|_front$|exploration/.test(id));
    const placeName = (w, id) => safe(() => (typeof locName === 'function' ? locName(w, id) : id), id);
    const pad = (n) => String(n).padStart(3, '0');
    const pick = (L) => L[Math.floor(Math.random() * L.length)];

    const KINDS = {
        hire: { icon: '🧰', name: '徵人幫忙' }, sell: { icon: '🏷️', name: '有東西要賣' }, lost: { icon: '🔎', name: '尋物' }, gripe: { icon: '💢', name: '抱怨' },
        invite: { icon: '🍻', name: '邀約' }, event: { icon: '🎪', name: '活動' }, clear: { icon: '📣', name: '澄清' }, letter: { icon: '💌', name: '信', priv: true },
    };
    const WANTS = { meet: '約見面', sorry: '道歉', love: '表白', thanks: '道謝', warn: '警告' };
    const STAGE = { open: '等回應', set: '說定了', done: '有結果了', gone: '沒下文' };
    // 回應的種類（卡片上顯示的字）
    const ANS = {
        asked: '還沒回話', pass: '看了，沒理會', take: '接下了', late: '來晚了一步', buy: '買下了', haggle: '嫌貴', found: '幫忙找到了', look: '幫忙找了，沒找到', kept: '撿到了，沒有還',
        agree: '附和', defend: '替被講的人說話', sorry: '出面道歉', fire: '當眾回嗆', join: '說要去', yes: '答應了', no: '回絕了', ignore: '沒有回', show: '拿給別人看了', back: '相信他',
    };

    function S(w) { if (!w.board || !Array.isArray(w.board.list)) w.board = { v: 1, n: 0, rn: 0, list: [], rumors: [], day: -1 }; if (!Array.isArray(w.board.rumors)) w.board.rumors = []; return w.board; }
    const get = (w, id) => S(w).list.find(x => x.id === id) || null;
    const getR = (w, id) => S(w).rumors.find(x => x.id === id) || null;
    const live = (w) => S(w).list.filter(B => B.stage === 'open' || B.stage === 'set');
    const tell = (w, ev, B) => { try { w.onBoard?.(ev, B); } catch (e) {} };
    const entry = (B, x) => { let q = B.re.find(e => e.id === x.agentId); if (!q) { q = { id: x.agentId, nm: x.name, s: 'asked', y: null }; B.re.push(q); } return q; };
    function ans(w, B, x, s) { const q = entry(B, x); q.s = s; q.d = day(w); return q; }

    // ---------- 1. 貼公告／寫信 ----------
    // o：{ kind, text, why, to, about, price, place, hour, want, ai, sid, readers }；text／why 可以是字串（AI 寫的）或 {k,p}（樣板）
    function create(w, a, o) {
        if (!w.observerMode || !ok(w, a) || !KINDS[o.kind]) return null;
        const X = S(w); const K = KINDS[o.kind]; const who = (x) => (x && x.agentId ? x : byName(w, x));
        const text = typeof o.text === 'string' ? { raw: clean(o.text, en() ? 320 : 120) } : o.text; if (!say(text)) return null;
        const why = typeof o.why === 'string' ? (clean(o.why, en() ? 240 : 90) ? { raw: clean(o.why, en() ? 240 : 90) } : null) : (o.why || null);
        let to = who(o.to); if (to && (to === a || !ok(w, to))) to = null; if (K.priv && !to) return null;
        let about = who(o.about); if (about && (about === a || !inTown(w, about))) about = null;
        const locs = w.townMap?.locations || {}; const place = locs[o.place] ? o.place : (locs.tavern ? 'tavern' : 'town_square');
        const want = K.priv ? (WANTS[o.want] ? o.want : 'meet') : '';
        const B = { id: 'B' + pad(++X.n), d0: day(w), kind: o.kind, by: a.agentId, byName: a.name, text, why, to: to ? to.agentId : null, toName: to ? to.name : '', about: about ? about.agentId : null, aboutName: about ? about.name : '',
            price: Math.max(0, Math.min(20, Math.floor(+o.price || 0))), place, hour: Math.max(8, Math.min(21, Math.floor(+o.hour || 18))), when: day(w) + 1, want, sid: o.sid || '', rid: o.rid || '', re: [], stage: 'open', out: null, ai: !!o.ai, taker: null };
        X.list.push(B); if (X.list.length > 50) X.list.splice(0, X.list.length - 50);
        if (K.priv) { log(w, '💌 {a}寫了一封信給{b}。', { a: a.name, b: to.name }, a.name); mem(w, a, '我寫了一封信給{b}：「{x}」', { b: to.name, x: text }, 6); mem(w, to, '{a}寫信給我：「{x}」', { a: a.name, x: text }, 6); }
        else { log(w, '📌 {a}在公告欄貼了一張告示：{x}', { a: a.name, x: text }, a.name); mem(w, a, '我在公告欄貼了告示：「{x}」', { x: text }, 5); }
        // 誰會看到：信只有收信人；公告是被點名的人，加上幾個跟貼的人或被講的人有交情（或過節）的
        const rs = K.priv ? [to] : (o.readers || readers(w, B, a, about));
        for (const x of rs) { entry(B, x); if (typeof DECIDE !== 'undefined') DECIDE.enqueue(w, x, K.priv ? 'letterGot' : 'boardRead', { bid: B.id }); }
        tell(w, 'new', B); return B;
    }
    function readers(w, B, a, about) {
        const pool = npcs(w).filter(x => x !== a && x !== about && ok(w, x)); const poor = B.kind === 'hire', rich = B.kind === 'sell';
        const sc = pool.map(x => [x, Math.abs(aff(x, a)) / 20 + (about ? Math.abs(aff(x, about)) / 20 : 0) + (poor && cash(w, x) < 15 ? 1 : 0) + (rich && cash(w, x) > 40 ? 1 : 0) + Math.random() * 1.5]).sort((p, q) => q[1] - p[1]).slice(0, B.kind === 'event' ? 3 : 4).map(p => p[0]);
        return about && ok(w, about) && B.kind === 'gripe' ? [about, ...sc.slice(0, 3)] : sc;
    }
    // 照個性與處境套樣板（AI 關著時，或 AI 沒回話時）
    function ruleWrite(w, a) {
        // text／why 一律給 {k}（樣板）：直接給字串會被當成 AI 寫的原文存起來，英文介面再也翻不回來，還會原樣進到題目裡
        const others = npcs(w).filter(x => x !== a && ok(w, x)); if (!others.length) return null; const c = cash(w, a); const r = Math.random(); const n = 3 + Math.floor(Math.random() * 6);
        const foe = others.filter(x => aff(a, x) < -25).sort((x, y) => aff(a, x) - aff(a, y))[0]; const pal = others.filter(x => aff(a, x) > 30).sort((x, y) => aff(a, y) - aff(a, x))[0];
        const sore = others.filter(x => aff(a, x) < -5 && aff(a, x) >= -25 && aff(x, a) < 0)[0]; const pl = places(w); const p = pl.includes('tavern') ? 'tavern' : (pl[0] || 'town_square');
        if (foe && r < 0.18 + mal(a) * 0.25) return has(a, 'shy') || mal(a) > 0.6 ? { kind: 'letter', want: 'warn', to: foe, text: { k: '離我的事遠一點，別怪我沒先說。' }, why: { k: '當面講不出口，寫下來比較敢' } } : { kind: 'gripe', about: foe, text: { k: '{b}做人太不厚道，請大家評評理。', p: { b: foe.name } }, why: { k: '想讓大家知道他是什麼樣的人' } };
        if (sore && r < 0.35 && hon(a) > 0.45) return { kind: 'letter', want: 'sorry', to: sore, text: { k: '上次是我不對，想跟你說聲對不起。' }, why: { k: '一直擱在心上' } };
        if (c < 10 && r < 0.6) return { kind: 'sell', price: n, text: { k: '家裡多了{x}，{n} 銀幣讓出。', p: { x: { k: pick(['一張舊椅子', '一口鍋子', '一件厚外套', '一把鋤頭']) }, n } }, why: { k: '手頭緊，能換一點是一點' } };
        if (c > 50 && r < 0.6) return { kind: 'hire', price: n + 3, text: { k: '找人幫忙{x}，酬勞 {n} 銀幣。', p: { x: { k: pick(['修屋頂', '搬貨', '整理後院', '挑水']) }, n: n + 3 } }, why: { k: '自己忙不過來' } };
        if (pal && r < 0.75) return r < 0.68 ? { kind: 'letter', want: 'thanks', to: pal, text: { k: '那次多虧有你，一直想跟你說謝謝。' }, why: { k: '有些話當面說不出口' } } : { kind: 'letter', want: 'meet', to: pal, place: p, hour: 18, text: { k: '有些話想當面跟你說，明天 {h} 點在{p}等你。', p: { h: 18, p: placeName(w, p) } }, why: { k: '想找個人說說話' } };
        if (r < 0.88) return { kind: 'invite', place: p, hour: 18, price: 4, text: { k: '明天傍晚在{p}，想找人喝一杯聊聊，我請客。', p: { p: placeName(w, p) } }, why: { k: '一個人悶得慌' } };
        return { kind: 'lost', price: 3, text: { k: '我的{x}不見了，撿到的人請還我，酬謝 {n} 銀幣。', p: { x: { k: pick(['錢袋', '帽子', '菸斗', '鑰匙']) }, n: 3 } }, why: { k: '找了半天找不到' } };
    }
    // 問 AI：讓他自己寫一張告示或一封信
    async function aiWrite(w, a) {
        const ce = w.conversationEngine; if (!ce?.fullAgentOk?.(w) || !ce._askJson || !ce._agentBrief) return null;
        const b = ce._agentBrief(w, a, null); const L = b.ledger && typeof DECIDE !== 'undefined' ? DECIDE.lines(b.ledger, { cap: { self: 4, world: 2 }, cut: en() ? 150 : 60 }) : (b.mem || []);
        const loc = (n) => (en() && typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(n, true) : n);
        const known = npcs(w).filter(x => x !== a && ok(w, x)).map(x => [x, aff(a, x)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 10).map(([x, v]) => `${loc(x.name)}${t('（')}${t(v > 40 ? '很要好' : v > 10 ? '有交情' : v < -25 ? '有過節' : v < -5 ? '不太對盤' : '普通')}${t('）')}`).join(t('、'));
        const pls = places(w).slice(0, 12).map(id => `${id}${t('＝')}${placeName(w, id)}`).join(t('、'));
        const recent = S(w).list.slice(-5).map(x => say(x.text)).filter(Boolean).join(t('；'));
        const prompt = `${t('你正在扮演「')}${b.name}${t('」（')}${b.age}${t('歲，')}${b.job}${t('；')}${t('性格')}${t('：')}${b.traits}${t('；')}${t('在乎')}${t('：')}${b.values}${t('；')}${t('心情')} ${b.mood}/100${t('）。')}${t('你身上有 {n} 銀幣。').replace('{n}', Math.floor(cash(w, a)))}
${t('你可以在鎮上的公告欄貼一張告示（全鎮都看得到），或私下寫一封信給某一個人（只有他看得到）。從你最近真的遇到的事出發，用你自己的口氣寫：缺錢、缺人手、東西不見了、看誰不順眼、想找人作伴、想跟誰道歉、喜歡誰、想警告誰都可以。邀約和約見面都是約明天。寫出來的話可以跟你心裡真正的盤算不一樣。')}
${L.join('\n')}
${t('【你認識的人】')}${known}
${t('【可以約的地方】')}${pls}
${recent ? `${t('【公告欄上最近已經有的（不要一樣）】')}${recent}\n` : ''}${t('只輸出 JSON：{"kind":"hire|sell|lost|gripe|invite|letter","text":"告示或信的內容，你自己的口氣（60 字內，話要講完）","to":"收信人的名字（只有 letter 要填）","want":"meet|sorry|love|thanks|warn（只有 letter 要填）","about":"你在抱怨的那個人（只有 gripe，抱怨的是事情就留空）","price":酬勞或賣價 0~20,"place":"地點代號（邀約或約見面才填）","hour":幾點 8~21,"why":"你心裡真正的盤算，不會給別人看（40 字內）"}；現在沒有想寫的就輸出 {"skip":true}')}
${t('kind 的意思：hire 徵人幫忙、sell 有東西要賣、lost 東西不見了、gripe 公開抱怨、invite 公開邀大家、letter 私下寫信給一個人。')}`;
        try { ce._countNpcLlmUse?.(w); } catch (e) {}
        const j = await ce._askJson(en() && typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(prompt, true) : prompt, 360);
        if (j && j.skip === true) return { skip: true };
        if (!j || typeof j !== 'object' || Array.isArray(j) || !j.text || !KINDS[j.kind] || j.kind === 'event' || j.kind === 'clear') return null;
        return { kind: String(j.kind), text: String(j.text), why: String(j.why || ''), to: j.to, about: j.about, want: String(j.want || ''), price: +j.price || 0, place: String(j.place || ''), hour: +j.hour || 18, ai: true };
    }
    // 個人企劃裡不瞞人的熱鬧事：順手貼到公告欄，看到的人可以自己報名（sim-schemes.js 的 create 會呼叫）
    function onScheme(w, P) {
        if (!P || P.secret || (P.tone !== 'fun' && P.tone !== 'show') || !w.observerMode) return null; const a = w.agents[P.by]; if (!ok(w, a)) return null;
        const asked = new Set(P.ask.map(q => q.id)); const tg = P.target ? w.agents[P.target] : null;
        const B = create(w, a, { kind: 'event', text: P.title, why: P.why, place: P.place, hour: P.hour, sid: P.id, ai: P.ai, readers: readers(w, { kind: 'event' }, a, tg).filter(x => !asked.has(x.agentId)) });
        if (B) P.bid = B.id; return B;
    }

    // ---------- 2. 看到的人自己決定 ----------
    const pay = (w, a, b, n) => (n > 0 ? !!safe(() => WALLET.pay(w, a, b, n), false) : true);
    const gossip = (w, about, src, k, p, isTrue) => { try { w.gossipNetwork?.activeGossip?.push({ about: about.name, content: render(k, flat(p)), contentT: { k, p: flat(p) }, source: src.name, spreadCount: 0, tickCreated: w.tickCount, isTrue: !!isTrue, tone: 'diss', juicy: true }); } catch (e) {} };
    function factsOf(w, B) {
        const K = KINDS[B.kind]; const f = (k, p) => { let s = t(k); for (const [n, v] of Object.entries(p)) s = s.split('{' + n + '}').join(v); return s; };
        if (K.priv) return f('{a}寫了一封信給你：「{x}」', { a: B.byName, x: say(B.text) });
        return f('公告欄上，{a}貼了一張告示（{k}）：「{x}」', { a: B.byName, k: t(K.name), x: say(B.text) }) + (B.price && (B.kind === 'hire' || B.kind === 'sell' || B.kind === 'lost') ? f(B.kind === 'sell' ? '要價 {n} 銀幣。' : '酬勞 {n} 銀幣。', { n: B.price }) : '') + (B.kind === 'invite' || B.kind === 'event' ? f('時間是明天 {h} 點，在{p}。', { h: B.hour, p: placeName(w, B.place) }) : '');
    }
    function optsOf(w, x, B) {
        const a = w.agents[B.by]; const q = B.re.find(e => e.id === x.agentId); if (!a || !q || q.s !== 'asked' || B.stage !== 'open') return []; const f = aff(x, a) / 25; const hx = hon(x); const c = cash(w, x);
        const A = (s, r) => (w2) => { ans(w2, B, x, s); return r ? r(w2) : null; }; const N = { a: a.name };
        const pass = { id: 'pass', text: '看看就好，不回應', say: { k: '看了{a}的告示，沒有理會', p: N }, why: '不關我的事', base: 0.8 - Math.abs(f) * 0.2, lean: { safe: 0.3 }, run: A('pass', () => ({ k: '沒有回應' })) };
        if (B.kind === 'hire') return [{ id: 'take', text: '去接這份差事', say: { k: '去接了{a}的差事', p: N }, why: c < 15 ? '正缺錢' : '幫個忙', base: 0.25 + (c < 15 ? 0.8 : 0) + f * 0.5 + B.price / 20, lean: { money: 0.5, bond: 0.2 }, run: (w2) => {
            if (B.taker) { ans(w2, B, x, 'late'); return { k: '已經有人接了' }; } B.taker = x.agentId; ans(w2, B, x, 'take'); const n = Math.min(B.price, Math.floor(cash(w2, a)));
            if (n > 0 && pay(w2, a, x, n)) { B.paid = n; bump(a, x, 3); bump(x, a, 2); mem(w2, x, '我接了{a}貼在公告欄的差事，拿到 {n} 銀幣。', { a: a.name, n }, 5); return { k: '做完拿到 {n} 銀幣', p: { n } }; }
            B.paid = 0; bump(x, a, -5); mem(w2, x, '我幫{a}做完了事，他卻拿不出說好的酬勞。', { a: a.name }, 7); return { k: '做完了，{a}卻付不出錢', p: N }; } }, pass];
        if (B.kind === 'sell') return [{ id: 'buy', text: { k: '花 {n} 銀幣買下', p: { n: B.price } }, say: { k: '買了{a}賣的東西', p: N }, why: '用得上', base: (c >= B.price ? 0.1 : -2) + f * 0.6 + (c > 40 ? 0.5 : 0) - B.price / 25, lean: { joy: 0.3, bond: 0.2 }, run: (w2) => {
            if (B.taker) { ans(w2, B, x, 'late'); return { k: '已經被買走了' }; } if (cash(w2, x) < B.price || !pay(w2, x, a, B.price)) { ans(w2, B, x, 'pass'); return { k: '錢不夠，買不成' }; }
            B.taker = x.agentId; B.paid = B.price; ans(w2, B, x, 'buy'); bump(a, x, 2); mood(x, 1); mem(w2, a, '{x}買走了我貼在公告欄上賣的東西，收了 {n} 銀幣。', { x: x.name, n: B.price }, 5); return { k: '花了 {n} 銀幣', p: { n: B.price } }; } },
            { id: 'haggle', text: '留一句：太貴了', say: { k: '嫌{a}賣得太貴', p: N }, why: '這價錢不值', base: 0.15 - f * 0.3 + (has(x, 'frugal') ? 0.4 : 0) + B.price / 40, lean: { money: 0.3 }, run: A('haggle', () => { bump(a, x, -1); return { k: '留了話' }; }) }, pass];
        if (B.kind === 'lost') { const o = [{ id: 'look', text: '幫忙找找看', say: { k: '幫{a}找東西', p: N }, why: '舉手之勞', base: 0.3 + f * 0.6 + hx * 0.3, lean: { bond: 0.5 }, run: (w2) => {
            if (!B.taker && Math.random() < 0.4) { B.taker = x.agentId; ans(w2, B, x, 'found'); const n = Math.min(B.price, Math.floor(cash(w2, a))); if (n > 0 && pay(w2, a, x, n)) B.paid = n; bump(a, x, 6); bump(x, a, 2); mood(a, 3); mem(w2, a, '{x}幫我把丟掉的東西找回來了。', { x: x.name }, 6); return { k: '找到了，送回去給{a}', p: N }; }
            ans(w2, B, x, 'look'); bump(a, x, 2); return { k: '找了一圈，沒找到' }; } }, pass];
            if (hx < 0.5 && !B.taker) o.push({ id: 'kept', text: '其實是我撿到的，不還', say: { k: '撿到了{a}的東西，沒有還', p: N }, why: '撿到就是我的', base: -0.4 + (1 - hx) * 0.9 + (c < 10 ? 0.3 : 0) - f * 0.5, lean: { money: 0.4 }, run: (w2) => {
                B.taker = x.agentId; B.kept = 1; ans(w2, B, x, 'kept'); safe(() => DARK.secret(w2, { kind: 'theft', culprit: x.agentId, victim: a.agentId, k: '{x}撿到了{a}丟的東西，沒有還', p: { x: x.name, a: a.name } })); return { k: '自己留下了' }; } });
            return o; }
        if (B.kind === 'gripe' || B.kind === 'clear') { const b = B.about ? w.agents[B.about] : null; const NB = { a: a.name, b: b ? b.name : '' };
            if (b && x === b) return [
                { id: 'sorry', text: '出面說聲抱歉', say: { k: '看到{a}的告示，出面道歉', p: N }, why: '是我理虧', base: 0.15 + hx * 0.6 + f * 0.4, lean: { bond: 0.4, face: -0.3 }, run: A('sorry', (w2) => { bump(a, x, 6); bump(x, a, 1); mood(x, -2); mem(w2, a, '我在公告欄抱怨{b}，他出面跟我道歉了。', { b: x.name }, 6); return { k: '道了歉' }; }) },
                { id: 'fire', text: '在底下回嗆', say: { k: '在{a}的告示底下回嗆', p: N }, why: '憑什麼這樣講我', base: 0.45 - hx * 0.2 + mal(x) * 0.5 - f * 0.4, lean: { face: 0.5 }, run: A('fire', (w2) => { bump(a, x, -6); bump(x, a, -6); mem(w2, a, '{b}在我的告示底下回嗆我。', { b: x.name }, 6); mem(w2, x, '{a}在公告欄公開講我，我當場回了他。', N, 6); return { k: '吵起來了' }; }) },
                { id: 'pass', text: '當作沒看見', say: { k: '看到{a}在公告欄講他，沒有回應', p: N }, why: '越描越黑', base: 0.5 + (has(x, 'shy') ? 0.4 : 0), lean: { safe: 0.4 }, run: A('pass', (w2) => { mood(x, -2); bump(x, a, -3); mem(w2, x, '{a}在公告欄公開講我，我忍下來了。', N, 6); return { k: '悶在心裡' }; }) }];
            if (!b) return [{ id: 'agree', text: '留一句：我也這麼覺得', say: { k: '附和了{a}的抱怨', p: N }, why: '說到我心坎裡', base: 0.4 + f * 0.6, lean: { bond: 0.4 }, run: A(B.kind === 'clear' ? 'back' : 'agree', () => { bump(a, x, 3); return { k: '附和了' }; }) }, pass];
            return [
                { id: 'agree', text: B.kind === 'clear' ? '相信他說的' : { k: '留一句：{b}確實是這樣', p: NB }, say: B.kind === 'clear' ? { k: '相信{a}的澄清', p: N } : { k: '附和{a}，也說了{b}的不是', p: NB }, why: B.kind === 'clear' ? '他不像會做那種事' : '我也看他不順眼', base: 0.3 + f * 0.6 - aff(x, b) / 40, lean: { bond: 0.3 },
                    run: A(B.kind === 'clear' ? 'back' : 'agree', () => { bump(a, x, 3); bump(x, b, B.kind === 'clear' ? -2 : -3); return { k: B.kind === 'clear' ? '信了' : '附和了' }; }) },
                { id: 'defend', text: { k: '留一句：{b}不是這種人', p: NB }, say: { k: '在{a}的告示底下替{b}說話', p: NB }, why: '看不下去', base: 0.05 + aff(x, b) / 30 - f * 0.3 + hx * 0.2, lean: { bond: 0.3, face: 0.2 }, run: A('defend', () => { bump(b, x, 4); bump(a, x, -3); bump(x, a, -2); return { k: '替他說了話' }; }) }, pass];
        }
        if (B.kind === 'invite' || B.kind === 'event') return [{ id: 'join', text: '說要去', say: { k: '說要去{a}約的那一場', p: N }, why: '去湊個熱鬧', base: 0.35 + f * 0.8 + (has(x, 'charismatic') ? 0.2 : 0) - (has(x, 'shy') ? 0.3 : 0), lean: { joy: 0.4, bond: 0.3 }, run: A('join', (w2) => {
            if (B.sid && typeof SCHEME !== 'undefined') { const P = SCHEME.get(w2, B.sid); if (P && P.stage === 'recruit' && !P.ask.some(e => e.id === x.agentId)) P.ask.push({ id: x.agentId, nm: x.name, s: 'yes', y: null, walk: 1, d: day(w2) }); } bump(a, x, 2); return { k: '說好了' }; }) }, pass];
        return [];
    }
    function letterOpts(w, x, B) {
        const a = w.agents[B.by]; const q = B.re.find(e => e.id === x.agentId); if (!a || !q || q.s !== 'asked' || B.stage !== 'open') return []; const f = aff(x, a) / 25; const hx = hon(x); const N = { a: a.name };
        const A = (s, r) => (w2) => { ans(w2, B, x, s); return r ? r(w2) : null; };
        const ignore = { id: 'ignore', text: '看完收起來，不回', say: { k: '收到{a}的信，沒有回', p: N }, why: '不知道該回什麼', base: 0.45 - f * 0.3 + (has(x, 'shy') ? 0.3 : 0), lean: { safe: 0.4 }, run: A('ignore', () => { bump(a, x, -2); return { k: '沒有回信' }; }) };
        const show = (k) => ({ id: 'show', text: '拿給別人看', say: { k: '把{a}寫的信拿給別人看', p: N }, why: '這種事不能只有我知道', base: -0.5 + (1 - hx) * 0.7 + mal(x) * 0.5 - f * 0.6 + (has(x, 'gossip') ? 0.5 : 0), lean: { face: 0.3 }, run: A('show', (w2) => { B.leak = 1; gossip(w2, a, x, k, { a: a.name, b: x.name }, true); bump(a, x, -10); mood(a, -5); mem(w2, a, '我寫給{b}的信，被他拿給別人看了。', { b: x.name }, 8); return { k: '信的內容傳開了' }; }) });
        const W = B.want;
        if (W === 'meet') return [{ id: 'yes', text: '回信說會去', say: { k: '答應了{a}的約', p: N }, why: '聽聽他要說什麼', base: 0.5 + f * 0.9, lean: { bond: 0.5 }, run: A('yes', () => { bump(a, x, 2); return { k: '說好了' }; }) },
            { id: 'no', text: '回信說不去', say: { k: '回絕了{a}的約', p: N }, why: '沒什麼好談的', base: 0.3 - f * 0.7, lean: { safe: 0.3 }, run: A('no', () => { bump(a, x, -3); mood(a, -2); return { k: '回絕了' }; }) }, ignore];
        if (W === 'sorry') return [{ id: 'yes', text: '回信說算了，不計較', say: { k: '原諒了{a}', p: N }, why: '他都低頭了', base: 0.45 + f * 0.5 + hx * 0.3 - mal(x) * 0.5, lean: { bond: 0.5 }, run: A('yes', (w2) => { bump(x, a, 8); bump(a, x, 4); mood(a, 3); mem(w2, a, '我寫信跟{b}道歉，他說不計較了。', { b: x.name }, 6); return { k: '和好了' }; }) },
            { id: 'no', text: '回信說沒那麼容易', say: { k: '不接受{a}的道歉', p: N }, why: '一句對不起就想了事', base: 0.2 + mal(x) * 0.7 - f * 0.4, lean: { face: 0.4 }, run: A('no', (w2) => { bump(a, x, -2); mood(a, -3); mem(w2, a, '我寫信跟{b}道歉，他不接受。', { b: x.name }, 6); return { k: '沒有原諒' }; }) }, ignore];
        if (W === 'love') return [{ id: 'yes', text: '回信說我也是', say: { k: '回信給{a}，說自己也有意思', p: N }, why: '其實我也在等這句話', base: -0.2 + f * 1.1 - (x.relationships?.getPartner?.() ? 1.2 : 0), lean: { bond: 0.6, joy: 0.3 }, run: A('yes', (w2) => { bump(x, a, 8); bump(a, x, 6); mood(a, 6); mood(x, 3); safe(() => { x.relationships.getOrCreate(a.agentId, a.name).modifyRomantic(8); a.relationships.getOrCreate(x.agentId, x.name).modifyRomantic(8); }); mem(w2, a, '我寫信向{b}表白，他說他也有意思。', { b: x.name }, 8); return { k: '兩人都動了心' }; }) },
            { id: 'no', text: '回信婉拒', say: { k: '婉拒了{a}的心意', p: N }, why: '沒有那個意思，但不想傷他', base: 0.5 - f * 0.4 + hx * 0.2, lean: { safe: 0.3 }, run: A('no', (w2) => { mood(a, -5); mem(w2, a, '我寫信向{b}表白，他婉拒了。', { b: x.name }, 8); return { k: '婉拒了' }; }) }, ignore, show('{b}說，{a}寫了情書給他。')];
        if (W === 'thanks') return [{ id: 'yes', text: '回一封信', say: { k: '回信給{a}', p: N }, why: '被記得的感覺很好', base: 0.7 + f * 0.4, lean: { bond: 0.5 }, run: A('yes', () => { bump(x, a, 4); bump(a, x, 3); mood(x, 2); return { k: '回了信' }; }) }, ignore];
        return [{ id: 'yes', text: '回信說知道了，會避開', say: { k: '收到{a}的警告，退了一步', p: N }, why: '不想把事情鬧大', base: 0.3 + (has(x, 'shy') ? 0.5 : 0) - mal(x) * 0.4, lean: { safe: 0.6, face: -0.3 }, run: A('yes', (w2) => { mood(x, -3); bump(x, a, -4); mem(w2, x, '{a}寫信警告我，我先退一步。', N, 7); return { k: '退了一步' }; }) },
            { id: 'no', text: '回信嗆回去', say: { k: '回信嗆了{a}', p: N }, why: '我不吃這一套', base: 0.35 + mal(x) * 0.6 - (has(x, 'shy') ? 0.4 : 0), lean: { face: 0.6 }, run: A('no', (w2) => { bump(a, x, -6); bump(x, a, -6); mem(w2, a, '我寫信警告{b}，他回信嗆我。', { b: x.name }, 7); return { k: '梁子結得更深了' }; }) }, ignore, show('{b}說，{a}寫信威脅他。')];
    }

    // ---------- 3. 流言：記下誰告訴誰、傳成什麼樣；傳到本人耳裡由他自己決定怎麼辦 ----------
    const gText = (g) => (g.contentT && g.contentT.k ? { k: g.contentT.k, p: g.contentT.p || {} } : { raw: String(g.content || '') });
    const gNeg = (g) => g.tone === 'diss' || g.isTrue === false || /奇怪|劈腿|背著|懶散|不厚道|威脅|情書/.test(g.contentT ? JSON.stringify(g.contentT) : String(g.content || ''));
    function hop(w, g, sp, li) {
        if (!w.observerMode || !g || !sp || !li || sp.isPlayer || li.isPlayer) return null; const X = S(w); let R = g.rid ? getR(w, g.rid) : null;
        if (!R) { const sub = npcs(w).find(a => a.name === g.about); const src = npcs(w).find(a => a.name === g.source);
            R = { id: 'R' + pad(++X.rn), d0: day(w), about: sub ? sub.agentId : null, aboutName: String(g.about || ''), src: src ? src.agentId : null, srcName: src ? src.name : '', text0: gText(g), neg: gNeg(g), fake: g.isTrue === false, hops: [], st: 'going', last: day(w), re: null };
            g.rid = R.id; X.rumors.push(R); if (X.rumors.length > 30) X.rumors.splice(0, X.rumors.length - 30); }
        const cur = JSON.stringify(gText(g)); const changed = cur !== (R._cur || JSON.stringify(R.text0)); R._cur = cur;
        if (R.st === 'dead') R.st = 'going';
        const H = { f: sp.agentId, fn: sp.name, t: li.agentId, tn: li.name, d: day(w), x: changed ? gText(g) : null }; R.hops.push(H); R.last = day(w); if (R.hops.length > 8) R.hops.shift();
        // 開 AI 時：傳到第二手以後，讓轉述的人用自己的話講一次（一則流言一次、一天最多兩次）
        if (R.hops.length >= 2 && !R.aiTold && w.fullAgentMode && (X.rtDay !== day(w) || (X.rtN || 0) < 2)) { if (X.rtDay !== day(w)) { X.rtDay = day(w); X.rtN = 0; } X.rtN++; R.aiTold = 1; aiRetell(w, X, g, R, H, sp, li).catch(() => {}); }
        return R;
    }
    async function aiRetell(w, X, g, R, H, sp, li) {
        const ce = w.conversationEngine; if (!ce?.fullAgentOk?.(w) || !ce._askJson) return; const sub = R.about ? w.agents[R.about] : null;
        const loc = (n) => (en() && typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(n, true) : n); const v = sub ? aff(sp, sub) : 0;
        const prompt = `${t('你正在扮演「')}${sp.name}${t('」（')}${t('性格')}${t('：')}${(sp.personality?.traits || []).map(x => t(x)).join(t('、'))}${t('）。')}${t('你聽來一件關於{b}的事：「{x}」').replace('{b}', R.aboutName).replace('{x}', say(gText(g)))}
${t('你跟{b}的交情：{v}。').replace('{b}', R.aboutName).replace('{v}', t(v > 40 ? '很要好' : v > 10 ? '有交情' : v < -25 ? '有過節' : v < -5 ? '不太對盤' : '普通'))}${t('現在你要把這件事講給{c}聽。').replace('{c}', li.name)}
${t('照你的個性和你跟當事人的交情，你會怎麼講？可以照實說、加油添醋、替他講好話，或講歪。{b}的名字一定要留在句子裡。不要稱呼聽你說話的人、也不要寫他的名字（這句話之後還會被別人拿去轉述）。只輸出 JSON：{"say":"你轉述時說的話（40 字內）","spin":"照實|誇大|淡化|講歪"}').split('{b}').join(R.aboutName)}`;
        try { ce._countNpcLlmUse?.(w); } catch (e) {}
        const j = await ce._askJson(loc(prompt), 160); if (!j || typeof j !== 'object' || !j.say || w.board !== X || !X.rumors.includes(R)) return;
        const s = clean(j.say, en() ? 200 : 70); if (!s) return; const named = s.includes(R.aboutName) || s.includes(nameL(R.aboutName)) || (en() && typeof I18N !== 'undefined' && I18N.localizeNames && s.includes(I18N.localizeNames(R.aboutName, true)));
        if (!named) return; // 把被講的人的名字講丟了：這一句不採用，八卦照原樣傳下去
        H.x = { raw: s }; H.spin = clean(j.spin, 12); H.ai = 1; g.content = s; g.contentT = null; R._cur = JSON.stringify(gText(g)); tell(w, 'rumor', R);
    }
    // 傳到本人耳裡：負面的由他自己決定（回傳 true 表示已經接手，原本寫死的「當面對質」先不跑）
    function reach(w, g) {
        if (!w.observerMode || typeof DECIDE === 'undefined' || !g || g.tone === 'ship' || g.tone === 'praise' || !gNeg(g)) return false;
        const sub = npcs(w).find(a => a.name === g.about); if (!sub || !ok(w, sub)) return false; const src = npcs(w).find(a => a.name === g.source); if (src === sub) return false;
        let R = g.rid ? getR(w, g.rid) : null; if (!R) { R = hop(w, g, src || sub, sub); if (!R) return false; R.hops.pop(); }
        if (R.st === 'reached' || R.st === 'answered') return true; R.st = 'reached'; R.dr = day(w); R.re = { s: 'asked', y: null };
        mem(w, sub, '有人在傳我的閒話：「{x}」', { x: gText(g) }, 7); DECIDE.enqueue(w, sub, 'rumorHit', { rid: R.id }); tell(w, 'reached', R); return true;
    }
    const RANS = { asked: '還在想怎麼辦', confront: '找上門對質', trace: '追查是誰先說的', clear: '貼公告澄清', back: '也去傳對方的閒話', swallow: '忍下來', laugh: '一笑置之' };
    function rumorOpts(w, x, R) {
        if (!R || R.st !== 'reached' || !R.re || R.re.s !== 'asked') return []; const src = R.src ? w.agents[R.src] : null; const first = R.hops[0] ? w.agents[R.hops[0].f] : null; const who = src && ok(w, src) ? src : null;
        const done = (s, r) => (w2) => { R.re.s = s; R.re.d = day(w2); R.st = 'answered'; const out = r ? r(w2) : null; tell(w2, 'answered', R); return out; }; const m = mal(x); const o = [];
        if (who) o.push({ id: 'confront', text: { k: '去找{s}當面對質', p: { s: who.name } }, say: { k: '為了閒話去找{s}對質', p: { s: who.name } }, why: '這口氣嚥不下去', base: 0.55 + m * 0.4 - (has(x, 'shy') ? 0.5 : 0), lean: { face: 0.5 }, run: done('confront', (w2) => {
            const G = w2.gossipNetwork; const g = G?.activeGossip?.find(e => e.rid === R.id); const v0 = aff(x, who); if (g && G._reachOrig) { try { G._reachOrig(g, w2); } catch (e) {} } if (aff(x, who) === v0) { bump(x, who, -12); bump(who, x, -8); mem(w2, x, '我為了那些閒話去找{s}對質。', { s: who.name }, 7); mem(w2, who, '{b}為了閒話找上門來跟我對質。', { b: x.name }, 7); } return { k: '兩人撕破臉' }; }) });
        else if (first && ok(w, first) && first !== x) o.push({ id: 'trace', text: '去問是誰先說的', say: '追查閒話是從誰嘴裡出來的', why: '總要知道是誰', base: 0.35 + m * 0.3 - (has(x, 'shy') ? 0.3 : 0), lean: { face: 0.4 }, run: done('trace', (w2) => { R.re.who = first.agentId; bump(x, first, -8); bump(first, x, -3); mem(w2, x, '我查到那些閒話最早是{s}在講。', { s: first.name }, 7); mem(w2, first, '{b}跑來質問我是不是在傳他的閒話。', { b: x.name }, 6); return { k: '問到是{s}在講', p: { s: first.name } }; }) });
        o.push({ id: 'clear', text: '在公告欄貼一張澄清', say: '貼公告澄清閒話', why: '不講清楚，大家會當真', base: 0.25 + (R.fake ? 0.35 : -0.15) + (has(x, 'charismatic') ? 0.3 : 0) - (has(x, 'shy') ? 0.3 : 0), lean: { face: 0.4 }, run: done('clear', (w2) => {
            const heard = [...new Set(R.hops.map(h => h.t))].map(id => w2.agents[id]).filter(y => y && y !== x && ok(w2, y)).slice(0, 4); const B = create(w2, x, { kind: 'clear', text: { k: '最近有人在傳我的閒話，那不是真的。' }, about: who, rid: R.id, readers: heard });
            if (B) R.re.bid = B.id; return { k: '貼了澄清' }; }) });
        if (who) o.push({ id: 'back', text: { k: '也去講{s}的閒話', p: { s: who.name } }, say: { k: '反過來傳{s}的閒話', p: { s: who.name } }, why: '他怎麼對我，我就怎麼對他', base: -0.1 + m * 0.9 - hon(x) * 0.3, lean: { face: 0.3 }, run: done('back', (w2) => { gossip(w2, who, x, '說真的,{who}私底下跟表面不太一樣喔...', { who: who.name }, false); bump(x, who, -6); return { k: '閒話又多了一則' }; }) });
        o.push({ id: 'swallow', text: '忍下來，不出聲', say: '聽到自己的閒話，忍下來了', why: '越解釋越像真的', base: 0.4 + (has(x, 'shy') ? 0.4 : 0) - m * 0.2, lean: { safe: 0.6 }, run: done('swallow', (w2) => { mood(x, -4); if (who) bump(x, who, -5); mem(w2, x, '那些閒話我沒有回應，但我記著。', {}, 6); return { k: '悶在心裡' }; }) });
        o.push({ id: 'laugh', text: '笑一笑就算了', say: '聽到自己的閒話，一笑置之', why: '嘴長在別人臉上', base: 0.2 + (has(x, 'optimist') ? 0.5 : 0) - m * 0.4 + (R.fake ? 0 : -0.1), lean: { joy: 0.3, safe: 0.2 }, run: done('laugh', () => { mood(x, 1); return { k: '沒放在心上' }; }) });
        return o;
    }

    if (typeof DECIDE !== 'undefined') {
        DECIDE.kind('boardRead', { title: '看到公告欄上的告示', scan: false, pri: 1.5, cool: 0, aiOwn: 4, when: () => null, facts: (w, x, ctx) => { const B = get(w, ctx.bid); return B ? factsOf(w, B) : ''; }, options: (w, x, ctx) => { const B = get(w, ctx.bid); return B ? optsOf(w, x, B) : []; } });
        DECIDE.kind('letterGot', { title: '收到一封信', scan: false, pri: 2, cool: 0, aiOwn: 2, when: () => null, facts: (w, x, ctx) => { const B = get(w, ctx.bid); return B ? factsOf(w, B) : ''; }, options: (w, x, ctx) => { const B = get(w, ctx.bid); return B ? letterOpts(w, x, B) : []; } });
        DECIDE.kind('rumorHit', { title: '聽到有人在傳自己的閒話', scan: false, pri: 2, cool: 0, when: () => null,
            facts: (w, x, ctx) => { const R = getR(w, ctx.rid); if (!R) return ''; const last = [...R.hops].reverse().find(h => h.x); return t('鎮上有人在傳你的閒話：「{x}」').replace('{x}', say(last ? last.x : R.text0)) + (R.srcName ? t('聽說最早是{s}講的。').replace('{s}', R.srcName) : t('不知道是誰先說的。')) + t(R.fake ? '這件事不是真的。' : '這件事不算冤枉你。') + t('已經傳了 {n} 手。').replace('{n}', R.hops.length); },
            options: (w, x, ctx) => rumorOpts(w, x, getR(w, ctx.rid)) });
        // 他自己說的話（AI 寫的）收進卡片：心裡想的放 y，嘴上說的放 pub
        DECIDE.observe((ev, o) => {
            if (ev !== 'decided' || !o?.w || !o.a || !o.ctx) return; const own = o.src === 'ai' && o.why && o.why.raw != null ? { raw: String(o.why.raw) } : null; const pub = o.src === 'ai' && o.pub ? String(o.pub) : '';
            if ((o.K?.key === 'boardRead' || o.K?.key === 'letterGot') && o.ctx.bid) { const q = get(o.w, o.ctx.bid)?.re.find(e => e.id === o.a.agentId); if (q) { if (own) q.y = own; if (pub) q.pub = pub; if (o.op?.free) { q.s = 'own'; q.own = say(o.op.say || o.op.text); } tell(o.w, 'reply', get(o.w, o.ctx.bid)); } }
            else if (o.K?.key === 'rumorHit' && o.ctx.rid) { const R = getR(o.w, o.ctx.rid); if (R?.re) { if (own) R.re.y = own; if (pub) R.re.pub = pub; if (o.op?.free) { R.re.s = 'own'; R.re.own = say(o.op.say || o.op.text); R.st = 'answered'; tell(o.w, 'answered', R); }
                const B = R.re.bid ? get(o.w, R.re.bid) : null; if (B && pub) { B.text = { raw: clean(pub, en() ? 220 : 80) }; B.ai = true; } } }
        });
    }

    // ---------- 4. 每天半夜：昨天的告示有了結果；再看今天有沒有人想寫 ----------
    function finish(w, B, good, k, p) { B.stage = 'done'; B.out = { ok: !!good, k, p: p || {} }; tell(w, 'done', B); }
    function settle(w, B) {
        const a = w.agents[B.by]; const d = day(w); const nm = (id) => w.agents[id]?.name || B.re.find(q => q.id === id)?.nm || '';
        if (B.kind === 'event') { const P = typeof SCHEME !== 'undefined' ? SCHEME.get(w, B.sid) : null; if (P && (P.stage === 'recruit' || P.stage === 'set') && d - B.d0 < 4) return; for (const q of B.re) if (q.s === 'asked') q.s = 'pass';
            const n = B.re.filter(q => q.s === 'join').length; const came = P ? B.re.filter(q => q.s === 'join' && (P.came || []).includes(q.id)).length : 0; return finish(w, B, !!(P?.out?.ok), n ? '看到告示說要去的有 {n} 個，真的到場 {m} 個' : '沒有人看了告示報名', { n, m: came }); }
        if (B.re.some(q => q.s === 'asked') && d - B.d0 < 2) return; // 還有人沒回話（多半是 AI 還沒回）：再等一天
        for (const q of B.re) if (q.s === 'asked') q.s = KINDS[B.kind].priv ? 'ignore' : 'pass';
        const has1 = (s) => B.re.find(q => q.s === s); const cnt = (s) => B.re.filter(q => q.s === s).length;
        if (B.kind === 'hire') { if (B.taker) return finish(w, B, B.paid > 0, B.paid > 0 ? '{x}接下了，拿到 {n} 銀幣' : '{x}做完了，卻沒拿到酬勞', { x: nm(B.taker), n: B.paid || 0 }); mood(a, -2); return finish(w, B, false, '沒有人來接'); }
        if (B.kind === 'sell') { if (B.taker) return finish(w, B, true, '{x}花 {n} 銀幣買走了', { x: nm(B.taker), n: B.paid || B.price }); mood(a, -2); return finish(w, B, false, cnt('haggle') ? '沒賣掉，還被嫌貴' : '沒有人要買'); }
        if (B.kind === 'lost') { if (has1('found')) return finish(w, B, true, '{x}幫他找回來了', { x: nm(B.taker) }); mood(a, -2); return finish(w, B, false, '一直沒有找到'); }
        if (B.kind === 'gripe') { const n = cnt('agree'), m = cnt('defend'); const b = B.about ? w.agents[B.about] : null; const r = b ? B.re.find(q => q.id === b.agentId) : null; const good = n > m || r?.s === 'sorry';
            mood(a, good ? 2 : -3); if (b && n > m && r?.s !== 'sorry') { mood(b, -3); safe(() => DARK.bump(w, b, 'exposed')); }
            return finish(w, B, good, r?.s === 'sorry' ? '{b}出面道了歉' : r?.s === 'fire' ? '{b}當眾回嗆，{n} 個人附和、{m} 個人替他說話' : b ? '{n} 個人附和，{m} 個人替{b}說話' : '{n} 個人附和', { b: B.aboutName, n, m }); }
        if (B.kind === 'clear') { const n = cnt('back'), m = cnt('defend'); mood(a, n >= m && n ? 2 : -2); return finish(w, B, n >= m && n > 0, n ? '{n} 個人相信他的說法' : '沒有人理會他的澄清', { n }); }
        if (B.kind === 'invite') { const yes = B.re.filter(q => q.s === 'join').map(q => w.agents[q.id]).filter(x => x && ok(w, x)); if (!yes.length || !ok(w, a)) { mood(a, -3); if (a) mem(w, a, '我貼告示約人，結果沒有人要來。', {}, 6); return finish(w, B, false, '沒有人說要來'); } return gather(w, B, a, yes); }
        // 信
        const q = B.re[0]; const b = B.to ? w.agents[B.to] : null; if (!q) return finish(w, B, false, '信沒有送到');
        if (q.s === 'own') return finish(w, B, true, '{b}有自己的回法：{x}', { b: B.toName, x: q.own || '' });
        if (B.want === 'meet' && q.s === 'yes' && b && ok(w, b) && ok(w, a)) return gather(w, B, a, [b]);
        const T = { yes: { meet: '{b}答應了，人卻不在鎮上', sorry: '{b}說不計較了', love: '{b}說他也有意思', thanks: '{b}回了信', warn: '{b}退了一步' }[B.want], no: { meet: '{b}回絕了', sorry: '{b}不接受道歉', love: '{b}婉拒了', warn: '{b}回信嗆了回去' }[B.want] || '{b}回絕了', ignore: '{b}沒有回信', show: '{b}把信拿給別人看了' }[q.s] || '{b}沒有回信';
        return finish(w, B, q.s === 'yes' && B.want !== 'meet', T, { b: B.toName });
    }
    // 說定了要見面／聚一聚：當天真的走過去（地圖讀 a._thingGo）
    function gather(w, B, a, yes) {
        B.stage = 'set'; B.when = day(w); const h0 = w.clock?.hour ?? 0, m0 = w.clock?.minute ?? 0; const base = w.tickCount - h0 * 4 - Math.floor(m0 / 15); try { if (typeof THINGS !== 'undefined') THINGS.S(w); } catch (e) {}
        const go = [a]; for (const x of yes) { const q = B.re.find(e => e.id === x.agentId); if (B.kind === 'invite' && Math.random() < 0.15 - aff(x, a) / 400) { if (q) q.ns = 1; continue; } go.push(x); }
        B.going = go.map(x => x.agentId); for (const x of go) if (!x._ceremony) x._thingGo = { place: B.place, from: base + B.hour * 4 - 2, until: base + (B.hour + 2) * 4, why: 'board', id: B.id };
        tell(w, 'set', B);
    }
    function meet(w, B) {
        const a = w.agents[B.by]; const came = (B.going || []).map(id => w.agents[id]).filter(x => x && inTown(w, x) && !x._ceremony); B.came = came.map(x => x.agentId); const others = came.filter(x => x !== a);
        for (const q of B.re) if ((q.s === 'join' || q.s === 'yes') && !B.came.includes(q.id)) q.ns = 1;
        if (!a || !came.includes(a) || !others.length) { if (a) { mood(a, -4); mem(w, a, '說好的人沒有來，我白等了一場。', {}, 6); } return finish(w, B, false, '說好的人沒有出現'); }
        if (B.kind === 'invite') { const n = Math.min(B.price * others.length, Math.floor(cash(w, a))); if (n > 0) pay(w, a, null, n); for (const x of came) mood(x, 3); for (const x of others) { bump(x, a, 4); bump(a, x, 3); mem(w, x, '我去了{a}約的那一場，聊得不錯。', { a: a.name }, 5); } mem(w, a, '我貼告示約人，來了 {n} 個。', { n: others.length }, 6); return finish(w, B, true, '來了 {n} 個人，聊得不錯', { n: others.length }); }
        const b = others[0]; const good = Math.random() < c01(0.55 + aff(b, a) / 120);
        if (good) { bump(a, b, 6); bump(b, a, 6); mood(a, 3); mood(b, 2); mem(w, a, '我約{b}出來把話說開了。', { b: b.name }, 6); mem(w, b, '{a}約我出來，把話說開了。', { a: a.name }, 6); return finish(w, B, true, '兩人見了面，把話說開了'); }
        bump(a, b, -2); bump(b, a, -2); mood(a, -2); mem(w, a, '我約{b}出來，話不投機。', { b: b.name }, 5); return finish(w, B, false, '見了面，話不投機');
    }
    function daily(w) {
        if (!w.observerMode || typeof DECIDE === 'undefined') return; const X = S(w); const d = day(w); if (X.day === d) return; X.day = d;
        for (const B of X.list) { try { if (B.stage === 'open' && B.d0 < d) settle(w, B); else if (B.stage === 'set' && B.when < d) meet(w, B); } catch (e) { console.warn('[Board] settle', e); B.stage = 'gone'; } }
        for (const R of X.rumors) { if (R.st === 'going' && d - R.last >= 5) R.st = 'dead'; else if (R.st === 'reached' && d - (R.dr ?? d) >= 2) { R.st = 'answered'; if (R.re && R.re.s === 'asked') R.re.s = 'swallow'; } }
        if (X.quiet || live(w).filter(B => B.kind !== 'event' && B.kind !== 'clear').length >= 3) return; // quiet：不自己冒出新的（測試用）
        const pool = npcs(w).filter(a => ok(w, a) && !X.list.some(B => B.by === a.agentId && d - B.d0 < 5)); if (!pool.length) return;
        // 誰比較會動筆：手頭特別緊或特別寬、有過節、心情特別差的
        const wt = (a) => { const c = cash(w, a); return 1 + (c < 10 ? 0.8 : 0) + (c > 50 ? 0.5 : 0) + (npcs(w).some(x => aff(a, x) < -25) ? 0.8 : 0) + (has(a, 'gossip') ? 0.4 : 0) + ((a.mood ?? 50) < 35 ? 0.5 : 0); };
        let tot = 0; const ws = pool.map(a => { const v = Math.max(0.1, wt(a)); tot += v; return v; }); let r = Math.random() * tot; let a = pool[0]; for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { a = pool[i]; break; } }
        const ce = w.conversationEngine; const ai = !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson); const roll = Math.random();
        if (ai) { aiWrite(w, a).catch(() => null).then(o => { if (w.board !== X || !ok(w, a) || o?.skip) return; if (!o) o = roll < 0.6 ? ruleWrite(w, a) : null; if (o && create(w, a, o)) { try { DECIDE.drain(w, DECIDE.S(w), day(w)); } catch (e) {} } }).catch(() => {}); return; }
        if (roll < 0.6) { const o = ruleWrite(w, a); if (o) create(w, a, o); }
    }
    function tick(w) {
        const X = w.board; if (!X || !X.list.length) return; const d = day(w); const h = w.clock?.hour ?? 0, m = w.clock?.minute ?? 0;
        for (const B of X.list) { if (B.stage !== 'set' || B.when !== d) continue;
            if (!B.started && h === B.hour && m < 15) { B.started = 1; tell(w, 'start', B); }
            if (h > B.hour || (h === B.hour && m >= 45)) { try { meet(w, B); } catch (e) { console.warn('[Board] meet', e); B.stage = 'done'; } } }
    }

    // ---------- 給畫面看 ----------
    function view1(w, B) {
        const K = KINDS[B.kind] || KINDS.gripe; const nm = (id, fb) => nameL(w.agents[id]?.name || fb || id); const p = { b: nm(B.about, B.aboutName) };
        return { id: B.id, kind: B.kind, icon: K.icon, kindName: render(K.name, {}) + (B.want ? render('：', {}) + render(WANTS[B.want], {}) : ''), priv: !!K.priv, stage: B.stage, stageName: render(STAGE[B.stage] || B.stage, {}), ai: !!B.ai, d0: B.d0,
            by: B.by, byName: nm(B.by, B.byName), here: inTown(w, w.agents[B.by]), to: B.to, toName: B.to ? nm(B.to, B.toName) : '', about: B.about, aboutName: B.about ? nm(B.about, B.aboutName) : '',
            text: say(B.text), why: say(B.why), price: B.price || 0, showPrice: B.kind === 'hire' || B.kind === 'sell' || B.kind === 'lost', place: B.place, placeName: placeName(w, B.place), hour: B.hour, when: B.when, meet: B.kind === 'invite' || B.kind === 'event' || B.want === 'meet', sid: B.sid || '', rid: B.rid || '', leak: !!B.leak, kept: !!B.kept,
            re: B.re.map(q => ({ id: q.id, name: nm(q.id, q.nm), s: q.s, label: q.s === 'own' ? (q.own || '') : render(q.s === 'defend' && B.about ? '替{b}說話' : (ANS[q.s] || q.s), p), y: say(q.y), pub: q.pub || '', own: q.s === 'own', came: (B.came || []).includes(q.id), noShow: !!q.ns && B.stage === 'done', here: !!w.agents[q.id] })),
            out: B.out ? { ok: !!B.out.ok, text: say(B.out) } : null };
    }
    function viewR(w, R) {
        const nm = (id, fb) => nameL(w.agents[id]?.name || fb || id || '');
        return { id: R.id, d0: R.d0, st: R.st, stName: render({ going: '還在傳', reached: '傳到本人耳裡了', answered: '本人有反應了', dead: '沒人再講了' }[R.st] || R.st, {}), about: R.about, aboutName: nm(R.about, R.aboutName), here: !!R.about && inTown(w, w.agents[R.about]), src: R.src, srcName: R.src ? nm(R.src, R.srcName) : '', text: say(R.text0), neg: !!R.neg, fake: !!R.fake,
            hops: R.hops.map(h => ({ f: h.f, from: nm(h.f, h.fn), t: h.t, to: nm(h.t, h.tn), d: h.d, text: h.x ? say(h.x) : '', spin: h.spin || '', ai: !!h.ai })),
            re: R.re ? { s: R.re.s, label: R.re.s === 'own' ? (R.re.own || '') : render(RANS[R.re.s] || R.re.s, {}), y: say(R.re.y), pub: R.re.pub || '', who: R.re.who ? nm(R.re.who) : '', bid: R.re.bid || '' } : null };
    }
    const view = (w, n = 24, only) => S(w).list.filter(B => !only || (only === 'letter' ? B.kind === 'letter' : B.kind !== 'letter')).slice(-n).reverse().map(B => view1(w, B));
    // 值得看的流言：傳到本人耳裡的、傳了三手以上的、傳的過程中話變了的（只傳一兩手就沒下文的不列，不然整頁都是閒話）
    const worth = (R) => R.st === 'reached' || R.st === 'answered' || R.hops.length >= 3 || R.hops.some(h => h.x);
    const rumors = (w, n = 12) => S(w).rumors.filter(worth).slice(-n).reverse().map(R => viewR(w, R));
    const stats = (w) => { const X = S(w); const L = X.list; return { notes: L.filter(B => B.kind !== 'letter').length, letters: L.filter(B => B.kind === 'letter').length, rumors: X.rumors.filter(worth).length, live: L.filter(B => B.stage === 'open' || B.stage === 'set').length + X.rumors.filter(R => R.st === 'reached').length }; };
    const ofAgent = (w, id) => S(w).list.filter(B => B.by === id).map(B => view1(w, B));

    return { S, get, getR, create, ruleWrite, onScheme, hop, reach, daily, tick, settle, meet, view, rumors, stats, ofAgent, live, KINDS, WANTS };
})();

if (typeof ProposalSystem !== 'undefined') {
    // 排在決策核心的每日處理之前：半夜貼出去的告示，當晚就輪到看到的人拿主意
    const _d = ProposalSystem.prototype.daily;
    ProposalSystem.prototype.daily = function (w, ...rest) { try { BOARD.daily(w); } catch (e) { console.warn('[Board] daily', e); } return _d.call(this, w, ...rest); };
}
if (typeof GossipNetwork !== 'undefined') {
    // 八卦網路原本的規則一行都不改：只在每傳一手時記一筆，傳到本人耳裡時讓他自己決定
    const GP = GossipNetwork.prototype;
    const _sp = GP.spreadGossip; GP.spreadGossip = function (speaker, listener, world) { const g = _sp.call(this, speaker, listener, world); try { if (g && world?.observerMode) BOARD.hop(world, g, speaker, listener); } catch (e) {} return g; };
    GP._reachOrig = GP._handleGossipReachesSubject;
    GP._handleGossipReachesSubject = function (g, world) { let took = false; try { took = BOARD.reach(world, g); } catch (e) {} if (!took) return GP._reachOrig.call(this, g, world); };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _tick = WP.tick; WP.tick = function (...a) { const r = _tick.apply(this, a); try { if (this.board) BOARD.tick(this); } catch (e) {} return r; };
    const _reset = WP.reset; WP.reset = function (...a) { const r = _reset.apply(this, a); this.board = null; return r; };
    const _ser = WP.serialize; WP.serialize = function () { const d = _ser.call(this); if (d && this.board && (this.board.list?.length || this.board.rumors?.length)) d.board = this.board; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.board = (data?.board && Array.isArray(data.board.list)) ? data.board : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.BOARD = BOARD;
