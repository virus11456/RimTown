// RimTown - sim-decide.js：v9.19.0 決策核心（完整智能體模式的閉環，階段 0＋1）
// 目的：村民做什麼，不再由各系統擲骰決定；而是「遇到要拿主意的事」時，依自己的處境自己選。
//  1. 帳本：把每個人的處境整理成【現在】【錢】【立場】【人際】【近況】【鎮上】，再加【做過的決定】【打算】。
//     以前四十幾個系統各自往 AI 的資料裡塞一句話，全堆在「最近記得」裡不分輕重；這裡分門別類。
//     新系統只要 DECIDE.source('now'|'eco'|'pol'|'soc'|'self'|'world', fn) 登記一次，AI 就看得到。
//  2. 選擇點：各系統只說「這個人現在遇到什麼事、有哪些做得到的選項」（DECIDE.kind 登記），不決定他選哪一個。
//  3. 決定：完整智能體模式 → 同一類的幾個人一次問 AI（看帳本選、附理由；也可以選「其他：我想做的事」，
//          由白名單效果落地）；沒開、沒額度、AI 沒回 → 用同一份處境算每個選項的傾向分數
//          （安全感、享受、情義、面子、賺錢），不再是「每天有 2% 機率去旅遊」這種寫死的機率。
//  4. 結算：選項的 run() 呼叫原本系統的結算（錢包、銀行、股份……），銀幣守恆不變。
//  5. 回饋：決定、理由、結果寫進決策紀錄和記憶；下次拿主意時自己看得到，還可以留下「接下來的打算」。
// 階段 1 接上理財：手上有閒錢（留著／存銀行／入股／宴客／旅遊／畫像／送孩子讀書／接濟／捐公庫／請客）、
//                 手頭很緊（硬撐／跟朋友借／跟銀行借）、有人來借錢（借／直接給／婉拒）。
// 必須最後載入（要包住所有系統塞進 AI 資料的那一串）。
'use strict';

const DECIDE = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const inTown = (w, a) => !!a && !a.isDead && w.agents[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (a && W() && w.wallet ? WALLET.get(w, a) : 0);
    const depOf = (w, a) => (a && w.bank?.open ? (w.bank.dep?.[a.agentId] || 0) : 0);
    const P = (w) => { try { return typeof INFL !== 'undefined' ? INFL.p(w) : 1; } catch (e) { return 1; } };
    const r2 = (n) => Math.round(n * 100) / 100;
    const pct1 = (y) => Math.round(y * 1000) / 10;
    // 日誌和記憶的模板只認字串和 {k,p}；AI 自己寫的話（{raw}）先攤成字串
    const flat = (p) => { const o = {}; for (const [k, v] of Object.entries(p || {})) o[k] = (v && typeof v === 'object' && v.raw != null) ? String(v.raw) : v; return o; };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, flat(p), who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5, cat = 'reflection') => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', cat, k, flat(p), imp, []); } catch (e) {} };
    // 翻譯鍵＋參數 → 一句話。參數可以再包一層 {k,p}；{raw} 是 AI 自己寫的話，原樣放進去不翻譯
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : (x.k != null ? fill(x.k, x.p) : '')) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const say = (x) => tx(x);
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const notable = (w, a) => { try { return typeof CROWD !== 'undefined' && CROWD.isNotable ? CROWD.isNotable(w, a) : true; } catch (e) { return true; } };
    const AI_MAX = 10, BATCH = 5, LOG_CAP = 5, NOISE = 1.8;
    const AI_RESERVE = 2; // 每天的名額留兩個給「別人找上門」的事(有人來借錢、來道歉、先開口)：不然早上掃一輪就用完，被找上的人只能照個性推估

    function S(w) {
        if (!w.decide || typeof w.decide !== 'object') w.decide = { log: {}, cool: {}, nw: {}, plan: {}, q: [], pick: {}, lastDay: null, st: { offer: 0, ai: 0, rule: 0, free: 0, aiMiss: 0 } };
        const X = w.decide; for (const k of ['log', 'cool', 'nw', 'plan', 'pick']) X[k] = X[k] && typeof X[k] === 'object' ? X[k] : {};
        X.q = Array.isArray(X.q) ? X.q : []; X.st = Object.assign({ offer: 0, ai: 0, rule: 0, free: 0, aiMiss: 0 }, X.st || {}); return X;
    }

    // ================= 1. 帳本 =================
    // 每個來源 fn(w, a) 回一句話、幾句話或空；出錯當作沒有。順序就是輕重：前面的先留。
    const SRC = { now: [], eco: [], pol: [], soc: [], self: [], world: [] };
    function source(dom, fn) { if (SRC[dom] && typeof fn === 'function') SRC[dom].push(fn); }
    const CAP = { now: 4, eco: 8, pol: 6, soc: 7, self: 5, world: 4, did: 3 };
    const HEAD = { now: '【現在】', eco: '【錢】', pol: '【立場】', soc: '【人際】', self: '【近況】', world: '【鎮上】', did: '【做過的決定】', plan: '【打算】' };
    // --- 既有系統的那一句話，照領域歸位 ---
    source('eco', (w, a) => W() ? WALLET.describe(w, a) : '');
    source('eco', (w, a) => w.bank && typeof BANK !== 'undefined' ? BANK.brief(w, a) : '');
    source('eco', (w, a) => debtLines(w, a));
    source('eco', (w, a) => trendLine(w, a));
    source('eco', (w, a) => w.market && typeof MARKET !== 'undefined' ? MARKET.brief(w, a) : '');
    source('eco', (w, a) => w.estate && typeof ESTATE !== 'undefined' ? ESTATE.brief(w, a) : '');
    source('eco', (w, a) => typeof LABOR !== 'undefined' ? LABOR.brief(w, a) : '');
    source('eco', (w, a) => typeof MONEY !== 'undefined' ? MONEY.fineBrief(w, a) : '');
    source('eco', (w, a) => typeof CLASS !== 'undefined' ? CLASS.describe(w, a) : '');
    source('eco', (w, a) => typeof MOBILITY !== 'undefined' ? MOBILITY.brief(w, a) : '');
    source('eco', (w, a) => typeof INFL !== 'undefined' ? INFL.brief(w) : '');
    source('eco', (w, a) => typeof SPEND !== 'undefined' ? SPEND.brief(w, a) : '');
    source('eco', (w, a) => typeof WORKS !== 'undefined' ? WORKS.brief(w, a) : '');
    source('eco', (w, a) => typeof CASINO !== 'undefined' ? CASINO.brief(w, a) : '');
    source('pol', (w, a) => w.mind && typeof MIND !== 'undefined' ? MIND.brief(w, a) : '');
    source('pol', (w, a) => typeof TIERS !== 'undefined' ? TIERS.careerBrief(w, a) : '');
    source('pol', (w, a) => w.union && typeof UNION !== 'undefined' ? UNION.brief(w, a) : '');
    source('pol', (w, a) => w.power && typeof POWER !== 'undefined' ? POWER.brief(w, a) : '');
    source('pol', (w, a) => w.faith && typeof FAITH !== 'undefined' ? FAITH.brief(w, a) : '');
    source('pol', (w, a) => typeof THINGS !== 'undefined' ? THINGS.brief(w, a) : '');
    source('pol', (w, a) => typeof TECH !== 'undefined' ? TECH.brief(w, a) : '');
    source('soc', (w, a) => kinLine(w, a));
    source('soc', (w, a) => darkLines(w, a));
    source('soc', (w, a) => typeof WAYS !== 'undefined' ? (WAYS.brief(w, a) || []).slice(0, 2) : '');
    source('soc', (w, a) => typeof PETS !== 'undefined' ? PETS.describe(w, a) : '');
    source('now', (w, a) => typeof EXILE !== 'undefined' ? EXILE.brief(w, a) : '');
    source('now', (w, a) => typeof TOWN_ISSUES !== 'undefined' ? TOWN_ISSUES.selfState(w, a) : '');
    source('now', (w, a) => typeof HEALTH !== 'undefined' ? HEALTH.brief(w, a) : '');
    source('now', (w, a) => typeof BIO !== 'undefined' ? BIO.brief(w, a) : '');
    source('now', (w, a) => w.longev && typeof LONGEV !== 'undefined' ? LONGEV.brief(w, a) : '');
    source('world', (w, a) => typeof CALAMITY !== 'undefined' ? CALAMITY.brief(w, a) : '');
    source('world', (w, a) => typeof WORLDCAL !== 'undefined' ? WORLDCAL.brief(w, a) : '');
    source('world', (w, a) => typeof AFTERMATH !== 'undefined' ? AFTERMATH.brief(w, a) : '');
    source('world', (w, a) => typeof STEAM !== 'undefined' ? STEAM.brief(w, a) : '');
    source('world', (w, a) => w.buzz && typeof BUZZ !== 'undefined' ? BUZZ.brief(w) : '');
    source('world', (w, a) => w.press && typeof PRESS !== 'undefined' ? PRESS.brief(w, a) : '');
    source('world', (w, a) => w.tidings && typeof TIDINGS !== 'undefined' ? TIDINGS.brief(w, a) : '');
    source('world', (w, a) => w.legacy && typeof LEGACY !== 'undefined' ? LEGACY.brief(w, a) : '');
    source('world', (w, a) => typeof MYTH !== 'undefined' ? MYTH.brief(w, a) : '');
    source('world', (w, a) => typeof MYTHSOC !== 'undefined' ? MYTHSOC.brief(w, a) : '');
    source('world', (w, a) => typeof FADS !== 'undefined' ? FADS.brief(w, a) : '');
    source('world', (w, a) => typeof EPIC !== 'undefined' ? EPIC.brief(w, a) : '');

    // --- 這裡補上以前沒有的 ---
    // 家人、最親的人、處不來的人（順便標出誰手頭很緊：要不要幫，他自己決定）
    function kinLine(w, a) {
        const R = a.relationships?.relationships || {}; const parts = []; const tag = (o) => `${o.name}${cash(w, o) < 6 && (o.age ?? 30) >= 16 ? t('（手頭很緊）') : ''}`;
        const fam = famOf(w, a); const sp = fam.filter(o => R[o.agentId]?.status === 'married'); const kids = npcs(w).filter(o => (o._parentNames || []).includes(a.name)); const par = fam.filter(o => (a._parentNames || []).includes(o.name));
        const lover = Object.values(R).find(r => r.status === 'dating' && w.agents[r.targetId] && !w.agents[r.targetId].isDead);
        const kin = [...sp.map(o => `${tag(o)}${t('（伴侶）')}`), ...(lover ? [`${tag(w.agents[lover.targetId])}${t('（交往中）')}`] : []), ...kids.slice(0, 4).map(o => `${tag(o)}${t('（孩子，{n} 歲）').replace('{n}', o.age ?? '?')}`), ...par.slice(0, 2).map(o => `${tag(o)}${t('（爸媽）')}`)];
        if (kin.length) parts.push(`${t('家人')}${t('：')}${kin.join(t('、'))}`);
        const skip = new Set([...sp, ...kids, ...par].map(o => o.agentId)); if (lover) skip.add(lover.targetId);
        const known = Object.values(R).map(r => [w.agents[r.targetId], r.affinity || 0]).filter(([o]) => o && !o.isDead && !o.isPlayer && !skip.has(o.agentId));
        const close = known.filter(x => x[1] >= 30).sort((x, y) => y[1] - x[1]).slice(0, 3); const foes = known.filter(x => x[1] <= -20).sort((x, y) => x[1] - y[1]).slice(0, 2);
        if (close.length) parts.push(`${t('最親的人')}${t('：')}${close.map(([o]) => tag(o)).join(t('、'))}`);
        if (foes.length) parts.push(`${t('處不來的人')}${t('：')}${foes.map(([o]) => o.name).join(t('、'))}`);
        if (!kin.length && !close.length) parts.push(t('在鎮上沒有特別親的人'));
        return parts.join(t('；'));
    }
    // 朋友之間借的錢（銀行的在銀行那一句）
    function debtLines(w, a) {
        const D = w.dark?.debts; if (!Array.isArray(D)) return ''; const d0 = day(w); const out = [];
        for (const x of D) { if (x.done || !x.cash) continue;
            if (x.r === a.agentId && w.agents[x.l]) out.push(fill('你欠{l} {n} 銀幣（{d}）', { l: w.agents[x.l].name, n: x.n, d: x.due > d0 ? { k: '{n} 天後要還', p: { n: x.due - d0 } } : '已經到期' }));
            else if (x.l === a.agentId && w.agents[x.r]) out.push(fill('{r}欠你 {n} 銀幣（{d}）', { r: w.agents[x.r].name, n: x.n, d: x.due > d0 ? { k: '{n} 天後要還', p: { n: x.due - d0 } } : '已經到期' })); }
        return out.slice(0, 3).join(t('；'));
    }
    // 身家（身上＋存款－欠銀行的）這一週是多了還是少了
    const worth = (w, a) => r2(cash(w, a) + depOf(w, a) - (w.bank?.loans?.[a.agentId]?.owed || 0));
    function trendLine(w, a) {
        const n = w.decide?.nw?.[a.agentId]; if (!n || n.prev == null) return ''; const dv = Math.round(n.v - n.prev); if (Math.abs(dv) < 5) return t('這一週你的身家沒什麼變化');
        return fill(dv > 0 ? '這一週你的身家多了 {n} 銀幣' : '這一週你的身家少了 {n} 銀幣', { n: Math.abs(dv) });
    }
    // 恩怨、秘密、名聲（跟 sim-dark.js 塞給 AI 的那幾句同一套字，才對得上、不會重複）
    function darkLines(w, a) {
        if (typeof DARK === 'undefined') return ''; const x = DARK.about(w, a); const add = [];
        if (x.grudge) add.push(t('心裡記恨{v}（{why}）').replace('{v}', x.grudge.name).replace('{why}', x.grudge.why));
        if (x.secrets.length) add.push(t('藏著秘密，怕被發現：') + x.secrets[0]);
        if (x.rep) add.push(t('大家眼中的我：') + x.rep);
        if (x.clique) add.push(t('我是{c}的人').replace('{c}', x.clique));
        if (x.owe.length) add.push(t('覺得對不起{v}，想找機會道歉').replace('{v}', x.owe.join(t('、'))));
        if (x.hurt.length) add.push(t('還在氣{v}').replace('{v}', x.hurt.join(t('、'))));
        return add;
    }
    // 做過的決定（最近的在前）
    function didLines(w, a) {
        const L = w.decide?.log?.[a.agentId]; if (!L?.length) return []; const d0 = day(w);
        return L.slice(-CAP.did).reverse().map(e => { const ago = d0 - e.d; const when = ago <= 0 ? t('今天') : fill('{n} 天前', { n: ago });
            return `${fill('{when}{what}', { when: { raw: when }, what: { raw: say(e.what) } })}${e.why ? `${t('（')}${say(e.why)}${t('）')}` : ''}${e.res ? `${t(' → ')}${say(e.res)}` : ''}`; });
    }
    // 帳本：pile 是各系統塞給 AI 的那一串（沒登記過領域的，例如最近的記憶，一律歸「近況」）
    function ledger(w, a, pile) {
        const L = { now: [], eco: [], pol: [], soc: [], self: [], world: [], did: [], plan: '' }; const seen = new Set();
        for (const dom of Object.keys(SRC)) for (const fn of SRC[dom]) {
            let v = null; try { v = fn(w, a); } catch (e) { v = null; }
            for (const s of [].concat(v || [])) if (s && typeof s === 'string' && !seen.has(s)) { seen.add(s); L[dom].push(s); }
        }
        for (const s of pile || []) if (s && typeof s === 'string' && !seen.has(s)) { seen.add(s); L.self.push(s); }
        try { L.did = didLines(w, a); } catch (e) {}
        const pl = w.decide?.plan?.[a.agentId]; if (pl && day(w) - pl.d <= 30) L.plan = say(pl.x);
        return L;
    }
    // 帳本 → 給 AI 的幾行字（每個領域一行，領域內用分號隔開）
    // o.cap 可以把某幾個領域收得更短；o.cut 是「近況」「鎮上」每一句最多幾個字（聊天摘要、傳聞很長，拿主意時不必整段看）
    function lines(L, o) {
        const out = []; const cp = Object.assign({}, CAP, o?.cap || {}); const cut = o?.cut || 0;
        const trim = (dom, s) => (cut && (dom === 'self' || dom === 'world') && s.length > cut) ? s.slice(0, cut) + '…' : s;
        for (const dom of ['now', 'eco', 'pol', 'soc', 'self', 'world', 'did']) if (L[dom]?.length) out.push(`${t(HEAD[dom])}${L[dom].slice(0, cp[dom]).map(s => trim(dom, s)).join(t('；'))}`);
        if (L.plan) out.push(`${t(HEAD.plan)}${L.plan}`);
        return out;
    }

    // ================= 2. 傾向（AI 不在時用；同一份處境，不同的人算出來不一樣） =================
    // 五個想要的東西：safe 安全感、joy 享受、bond 情義、face 面子、gain 賺更多。底是 1，個性、在乎的事、處境往上往下加。
    function lean(w, a) {
        const L = { safe: 1, joy: 1, bond: 1, face: 1, gain: 1 }; const add = (k, v) => { L[k] += v; };
        if (has(a, 'ascetic')) { add('safe', 0.5); add('joy', -0.6); add('face', -0.3); }
        if (has(a, 'stoic')) { add('safe', 0.4); add('joy', -0.3); }
        if (has(a, 'neurotic')) add('safe', 0.5);
        if (has(a, 'pessimist')) { add('safe', 0.4); add('joy', -0.2); }
        if (has(a, 'perfectionist')) add('safe', 0.2);
        if (has(a, 'hardworking')) { add('safe', 0.2); add('gain', 0.3); }
        if (has(a, 'lazy')) { add('joy', 0.3); add('gain', -0.3); }
        if (has(a, 'glutton')) add('joy', 0.6);
        if (has(a, 'optimist')) { add('joy', 0.4); add('safe', -0.3); add('gain', 0.2); }
        if (has(a, 'romantic')) { add('joy', 0.3); add('bond', 0.3); }
        if (has(a, 'kind')) add('bond', 0.7);
        if (has(a, 'generous')) { add('bond', 0.6); add('safe', -0.2); }
        if (has(a, 'charismatic')) { add('bond', 0.3); add('face', 0.5); }
        if (has(a, 'abrasive')) add('bond', -0.5);
        if (has(a, 'shy')) { add('face', -0.3); add('bond', -0.2); }
        if (has(a, 'jealous')) { add('face', 0.5); add('bond', -0.2); }
        if (has(a, 'creative')) add('joy', 0.2);
        if (has(a, 'greedy')) { add('gain', 0.7); add('bond', -0.5); }
        if (has(a, 'ambitious')) { add('gain', 0.5); add('face', 0.4); }
        if (has(a, 'thrifty')) { add('safe', 0.5); add('joy', -0.4); }
        if (hasV(a, '家庭')) { add('bond', 0.5); add('safe', 0.3); }
        if (hasV(a, '社群')) add('bond', 0.5);
        if (hasV(a, '財富')) { add('gain', 0.7); add('bond', -0.2); }
        if (hasV(a, '權力')) { add('face', 0.6); add('gain', 0.3); }
        if (hasV(a, '自由')) add('joy', 0.4);
        if (hasV(a, '冒險')) { add('joy', 0.5); add('safe', -0.4); add('gain', 0.2); }
        if (hasV(a, '藝術')) { add('joy', 0.3); add('face', 0.2); }
        if (hasV(a, '和平')) add('safe', 0.3);
        if (hasV(a, '傳統')) add('safe', 0.3);
        if (hasV(a, '自然')) add('face', -0.2);
        // 處境：欠著錢的人想先安穩；心情差的人想對自己好一點；家裡有小孩的人顧家
        if (w.bank?.loans?.[a.agentId] || (w.dark?.debts || []).some(x => !x.done && x.cash && x.r === a.agentId)) add('safe', 0.5);
        if ((a.mood ?? 50) < 35) add('joy', 0.4);
        if (npcs(w).some(o => (o.age ?? 30) < 16 && (o._parentNames || []).includes(a.name))) { add('safe', 0.3); add('bond', 0.2); }
        for (const k of Object.keys(L)) L[k] = Math.max(0.1, r2(L[k]));
        return L;
    }
    const score = (Ln, op) => { let s = op.base || 0; for (const k in (op.lean || {})) s += (Ln[k] || 0) * op.lean[k]; return s; };

    // ================= 3. 選擇點 =================
    // def: { title, cool 幾天內不再問同一件事, pri 先後, scan 是否每天掃(false = 只由別的決定引發),
    //        when(w,a) → ctx 或 null, facts(w,a,ctx) → 給 AI 的一句事實, options(w,a,ctx) → [選項] }
    // 選項: { id, text 選單上的字, say 記錄用的短句, why 傾向版的理由, base, lean, run(w,a) → 結果{k,p}（null = 沒有可說的結果） }
    const KINDS = {};
    function kind(key, def) { KINDS[key] = Object.assign({ key, cool: 6, pri: 1, scan: true }, def); return KINDS[key]; }
    const optsOf = (w, a, K, ctx) => { try { return (K.options(w, a, ctx) || []).filter(Boolean); } catch (e) { console.warn('[Decide] options', K.key, e); return []; } };
    const whenOf = (w, a, K) => { try { return K.when(w, a) || null; } catch (e) { return null; } };

    function record(w, X, a, K, op, why, res, src, d) {
        const e = { d, kind: K.key, id: op.id, what: op.say || op.text, why: why || null, res: res || null, ai: src === 'ai' ? 1 : 0 }; if (op.free) e.free = 1;
        // mute:「先不動」這類選項,照個性推估時不寫進紀錄(天天都是「放在心裡，不說」會把真正的決定擠掉);AI 自己想的照樣記(他有說理由)
        if (!(op.mute && src !== 'ai')) { const L = X.log[a.agentId] || (X.log[a.agentId] = []); L.push(e); if (L.length > LOG_CAP) L.splice(0, L.length - LOG_CAP); }
        const key = String(op.id).split(':')[0]; X.pick[K.key + '.' + key] = (X.pick[K.key + '.' + key] || 0) + 1;
        if (src === 'ai') X.st.ai++; else X.st.rule++;
        return e;
    }
    // 傾向版：算分、挑最高的（NOISE 是當天的心情起伏，不是「幾 % 機率會做」）
    function resolveRule(w, X, o, d, noise = NOISE) {
        const { a, K, ctx } = o; const opts = o.opts || optsOf(w, a, K, ctx); if (!opts.length) return null;
        const Ln = lean(w, a); let best = null, bs = -Infinity;
        for (const op of opts) { const s = score(Ln, op) + (Math.random() - 0.5) * noise; if (s > bs) { bs = s; best = op; } }
        let res = null; try { res = best.run(w, a, ctx) || null; } catch (e) { console.warn('[Decide] run', K.key, best.id, e); }
        return record(w, X, a, K, best, best.why || null, res, 'rule', d);
    }

    // ---------- AI 版 ----------
    function aiOn(w) { const ce = w.conversationEngine; return !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson && ce._agentBrief); }
    const PEND = new WeakMap(); // 每個世界各自一份「正在等 AI 回話的人」：id → { d 哪一天問的, K, ctx, tok }
    const pend = (X) => { let s = PEND.get(X); if (!s) { s = new Map(); PEND.set(X, s); } return s; };
    let _tok = 0;
    const _proms = [];
    const clean = (s, n) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').trim().replace(/^[「『"“]+|[」』"”]+$/g, '').slice(0, n);
    const cap = (zh, en) => { try { return typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en' ? en : zh; } catch (e) { return zh; } };
    function prompt(w, K, list) {
        // v9.23.2 放不進伺服器的長度上限就把每個人的帳本再收短（超過會被從尾巴截掉，「只輸出 JSON」跟著不見，整批退回傾向版）
        const ce = w.conversationEngine; const max = ce._promptMax ? ce._promptMax() : cap(5700, 17000); const bs = list.map(o => ce._agentBrief(w, o.a, null)); let p = '';
        for (let lv = 0; lv <= 2; lv++) { p = promptAt(w, K, list, bs, lv); if (p.length <= max) break; }
        return p;
    }
    const TIGHT = [() => ({ cap: { self: 4, world: 2 }, cut: cap(60, 150) }), () => ({ cap: { eco: 5, pol: 3, soc: 4, self: 2, world: 1, did: 2 }, cut: cap(40, 110) }), () => ({ cap: { now: 2, eco: 3, pol: 2, soc: 2, self: 1, world: 1, did: 1 }, cut: cap(30, 80) })];
    function promptAt(w, K, list, bs, lv) {
        const ce = w.conversationEngine; const sep = t('；');
        const people = list.map((o, i) => {
            const b = bs[i]; const L = b.ledger ? lines(b.ledger, TIGHT[lv]()) : (b.mem || []); // 一次問好幾個人：近況和鎮上的事收短一點，省字數
            // v9.23.2 選項用固定的代號（repay、extend…），不用 a、b、c：一次問好幾個人時每個人的選項不一樣，同一個字母對不同人是不同的事，
            // 真模型會搞混（實測：理由寫「帶點心意去道歉」，選的卻是別人清單裡的 c＝不道歉）
            const opts = o.opts.map((op) => `${op.id}＝${say(op.text)}`).concat(`other＝${t('其他：做一件上面沒有、但你真的想做的事')}`);
            return `=== ${i + 1}. ${b.name}${t('（')}${b.age}${t('歲')}${t('，')}${b.job}${sep}${t('性格')}${t('：')}${b.traits}${sep}${t('在乎')}${t('：')}${b.values}${sep}${t('心情')} ${b.mood}/100${t('）')}\n${L.join('\n')}\n${t('【遇到的事】')}${K.facts(w, o.a, o.ctx)}\n${t('【可以選】')}${opts.join(' ／ ')}`;
        }).join('\n\n');
        const en = (() => { try { return typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en' && typeof I18N !== 'undefined' && !!I18N.localizeNames; } catch (e) { return false; } })();
        const text = `${t('你是模擬小鎮的村民決策引擎。下面幾位村民各自遇到一件要拿主意的事。請替每個人依「他自己的」錢、立場、人際、個性和以前做過的決定，選出他真的會做的那一項。人不一定理性：小氣、衝動、愛面子、記仇、心軟都可以；不必討好任何人，也不必每個人選一樣。')}
${t('【鎮況】')}${String(ce._townBrief(w) || '').slice(0, cap(420, 1200))}

${people}

${t('只輸出 JSON 陣列，每人一個物件：')}{"n":1,"pick":"${t('代號')}","why":"…","next":"…"}
${t('n 是那個人的序號，pick 是「他自己那一列」選項的代號（＝前面的英文，照抄），why 是他自己口吻的一句理由（25 字內），要跟選的那一項對得上，講的是【遇到的事】裡那個人、那件事，別扯到不相干的人，next 是接下來的打算（沒有就省略，20 字內）。')}
${t('如果選 other（其他），再加 "do":"想做的事（30 字內）" 和 "fx":[最多 3 個效果]。效果只能從這幾種挑，寫不出效果就只留 do：')}
{"t":"give","to":"${t('人名')}","n":${t('銀幣')}} ${t('把錢給某人')}${sep}{"t":"town","n":${t('銀幣')}} ${t('捐給公庫')}${sep}{"t":"rel","to":"${t('人名')}","d":-10~10} ${t('對某人更好或更冷淡')}${sep}{"t":"mood","d":-5~5} ${t('自己的心情')}${sep}{"t":"goal","text":"${t('想存錢或努力去做的事')}"}`;
        return en ? I18N.localizeNames(text, true) : text; // 英文模式:帳本裡的人名一起換成英文(AI 回的人名用 byName 對回來)
    }
    // AI 選「其他」：他自己想做的事；做得到的部分用白名單效果落地，做不到的留成「打算」
    const byName = (w, s) => { const n = String(s || '').trim(); if (!n) return null; return npcs(w).find(o => o.name === n || t(o.name) === n || (typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(o.name, true) === n : false)) || null; };
    const FX = {
        give(w, a, e) { const b = byName(w, e.to); const n = Math.floor(Math.min(+e.n || 0, cash(w, a) * 0.5)); if (!b || b === a || !inTown(w, b) || n < 1 || !WALLET.pay(w, a, b, n)) return null; bump(b, a, Math.min(10, 2 + Math.round(n / 5))); mem(w, b, '{a}拿了 {n} 銀幣給我。', { a: a.name, n }, 6, 'social'); return { k: '給了{x} {n} 銀幣', p: { x: b.name, n } }; },
        town(w, a, e) { const n = Math.floor(Math.min(+e.n || 0, cash(w, a) * 0.5)); if (n < 1 || !WALLET.pay(w, a, null, n, t('{a}捐給公庫').replace('{a}', a.name))) return null; try { DARK.bump(w, a, 'helped'); } catch (x) {} return { k: '捐了 {n} 銀幣給公庫', p: { n } }; },
        rel(w, a, e) { const b = byName(w, e.to); const d = Math.max(-10, Math.min(10, Math.round(+e.d || 0))); if (!b || b === a || !d) return null; bump(a, b, d); return { k: d > 0 ? '對{x}更好了' : '對{x}冷淡了', p: { x: b.name } }; },
        mood(w, a, e) { const d = Math.max(-5, Math.min(5, Math.round(+e.d || 0))); if (!d) return null; a.moodModifier = (a.moodModifier || 0) + d; return { k: d > 0 ? '心裡舒坦了些' : '心裡更悶了', p: {} }; },
        goal(w, a, e) { const x = clean(e.text, cap(40, 120)); if (!x) return null; S(w).plan[a.agentId] = { x: { raw: x }, d: day(w) }; return { k: '立下目標：{x}', p: { x: { raw: x } } }; },
    };
    function freeAct(w, X, a, K, row, why, d) {
        const doing = clean(row.do, cap(60, 180)); if (!doing) return null; const outs = [];
        for (const e of (Array.isArray(row.fx) ? row.fx.slice(0, 3) : [])) { let r = null; try { r = e && FX[e.t] ? FX[e.t](w, a, e) : null; } catch (x) {} if (r) outs.push(r); }
        const res = outs.length ? { raw: outs.map(say).join(t('、')) } : { k: '這件事現在還做不到，先放在心裡' };
        if (!outs.length) X.plan[a.agentId] = { x: { raw: doing }, d }; // 做不到的先變成打算，下次拿主意時他自己看得到
        X.st.free++;
        if (why && why !== doing) log(w, 'social', '💭 {a}自己拿了主意：{x}——「{y}」', { a: a.name, x: { raw: doing }, y: { raw: why } }, a.name); else log(w, 'social', '💭 {a}自己拿了主意：{x}', { a: a.name, x: { raw: doing } }, a.name);
        mem(w, a, '我自己拿了主意：{x}。{y}', { x: { raw: doing }, y: { raw: why || '' } }, 6);
        return record(w, X, a, K, { id: 'other', say: { raw: doing }, free: true }, why ? { raw: why } : null, res, 'ai', d);
    }
    function applyAi(w, X, a, K, ctx, opts, row, d) {
        const pk = String(row?.pick ?? '').trim().toLowerCase(); const why = clean(row?.why, cap(50, 160)); const next = clean(row?.next, cap(40, 120));
        let e = null;
        if (pk === 'z' || pk === 'other') e = freeAct(w, X, a, K, row, why, d);
        else {
            const low = (o) => String(o.id).toLowerCase(); const head = opts.filter(o => low(o).split(':')[0] === pk); // 代號照抄；只抄了冒號前面那一段、而且只有一個對得上也算；舊的 a、b、c 照樣收
            const op = opts.find(o => low(o) === pk) || (head.length === 1 ? head[0] : null) || (pk.length === 1 ? opts[pk.charCodeAt(0) - 97] : null); if (!op) return null;
            let res = null; try { res = op.run(w, a, ctx) || null; } catch (x) { console.warn('[Decide] run', K.key, op.id, x); }
            e = record(w, X, a, K, op, why ? { raw: why } : (op.why || null), res, 'ai', d);
            if (!op.quiet) { log(w, 'social', '🧭 {a}想了想，決定{x}：「{y}」', { a: a.name, x: op.say || op.text, y: why ? { raw: why } : (op.why || '') }, a.name); if (why) mem(w, a, '我想過了，決定{x}：{y}', { x: op.say || op.text, y: { raw: why } }, 5); }
        }
        if (e && next) X.plan[a.agentId] = { x: { raw: next }, d };
        return e;
    }
    // 同一類的幾個人一次問；回來時處境可能變了，選項重新列一次；AI 沒回或答非所問 → 傾向版
    async function askBatch(w, X, K, list, d) {
        const ce = w.conversationEngine; const P0 = pend(X); let j = null;
        try { if (aiOn(w)) { ce._countNpcLlmUse?.(w); j = await ce._askJson(prompt(w, K, list), 140 + list.length * 120); } } catch (e) { j = null; }
        if (w.decide !== X) return;
        list.forEach((o, i) => {
            if (P0.get(o.a.agentId)?.tok !== o.tok) return; // 等太久，已經先照個性決定了
            P0.delete(o.a.agentId); const a = w.agents[o.a.agentId]; if (!a || a.isDead || !inTown(w, a)) return;
            const ctx = K.scan ? whenOf(w, a, K) : o.ctx; if (!ctx) return; // 等的這段時間事情已經過去了
            const opts = optsOf(w, a, K, ctx); if (!opts.length) return;
            const row = Array.isArray(j) ? (j.find(r => parseInt(r?.n, 10) === i + 1) || null) : null;
            let e = null; try { if (row) e = applyAi(w, X, a, K, ctx, opts, row, d); } catch (x) { console.warn('[Decide] ai', x); }
            if (!e) { if (aiOn(w) || j) X.st.aiMiss++; resolveRule(w, X, { a, K, ctx, opts }, d); }
        });
        drain(w, X, d);
    }
    // 把一批選擇點交出去：AI 開著就照先後問（每天有上限），其餘用傾向版
    function dispatch(w, X, offers, d) {
        const ai = aiOn(w); const P0 = pend(X); const groups = {};
        for (const o of offers) {
            // 別人找上門的事(來借錢、來道歉、先開口)比他自己正在想的事急：他若正在等 AI 想一件「自己的事」，那件先擱下(之後還會再遇到)，改問這一件
            const cur = P0.get(o.a.agentId); const bump = !!cur && !o.K.scan && cur.K.scan;
            if (ai && X._asked < (o.K.scan ? AI_MAX - AI_RESERVE : AI_MAX) && (!cur || bump)) { X._asked++; o.tok = ++_tok; P0.set(o.a.agentId, { d, K: o.K, ctx: o.ctx, tok: o.tok }); (groups[o.K.key] || (groups[o.K.key] = [])).push(o); }
            else if (!cur || !o.K.scan) resolveRule(w, X, o, d); // 沒名額、或他正在等的也是別人找上門的事：這一件照個性決定，不能沒下文
        }
        const batches = []; for (const k of Object.keys(groups)) for (let i = 0; i < groups[k].length; i += BATCH) batches.push([KINDS[k], groups[k].slice(i, i + BATCH)]);
        if (!batches.length) return;
        const pr = (async () => { for (const [K, list] of batches) await askBatch(w, X, K, list, d); })().catch(() => {}).finally(() => { if (w.decide === X) for (const [, list] of batches) for (const o of list) if (P0.get(o.a.agentId)?.tok === o.tok) P0.delete(o.a.agentId); });
        _proms.push(pr); if (_proms.length > 20) _proms.splice(0, _proms.length - 20);
    }
    // 別的決定引發的選擇點（例如有人來借錢）：排在 X.q，這裡處理
    function drain(w, X, d) {
        let guard = 0;
        while (X.q.length && guard++ < 40) {
            const batch = X.q.splice(0, X.q.length); const offers = [];
            for (const q of batch) { const a = w.agents[q.a]; const K = KINDS[q.kind]; if (!a || !K || !inTown(w, a)) continue; const opts = optsOf(w, a, K, q.ctx); if (opts.length) { X.st.offer++; offers.push({ a, K, ctx: q.ctx, opts }); } }
            if (offers.length) dispatch(w, X, offers, d);
        }
    }
    function enqueue(w, a, kindKey, ctx) { S(w).q.push({ a: a.agentId, kind: kindKey, ctx }); }

    // ================= 4. 每天 =================
    function daily(w) {
        if (!w.observerMode || !W() || !w.wallet) return; const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d; X._asked = 0;
        const all = npcs(w);
        // 昨天問 AI 的還沒回話（太慢、沒額度、遊戲開很快）：不讓人卡著，先照個性決定；晚到的回話就不算了
        { const P1 = pend(X); for (const [id, q] of [...P1]) { if (q.d >= d) continue; P1.delete(id); const a = w.agents[id]; if (!a || !inTown(w, a)) continue; const ctx = q.K.scan ? whenOf(w, a, q.K) : q.ctx; if (!ctx) continue; X.st.aiMiss++; resolveRule(w, X, { a, K: q.K, ctx }, d); } }
        // 每週記一次身家，帳本才說得出「這一週多了還是少了」
        for (const a of all) { const n = X.nw[a.agentId]; if (!n) X.nw[a.agentId] = { d, v: worth(w, a), prev: null }; else if (d - n.d >= 7) X.nw[a.agentId] = { d, v: worth(w, a), prev: n.v }; }
        // 不在了的人清掉（出遠門的留著）
        for (const key of ['log', 'nw', 'plan']) for (const id of Object.keys(X[key])) if (!w.agents[id] && !w.isAway?.(id)) delete X[key][id];
        for (const k of Object.keys(X.cool)) if (X.cool[k] <= d) delete X.cool[k];
        // 掃一遍：每人一天最多拿一件事的主意（急的先）
        const kinds = Object.values(KINDS).filter(K => K.scan).sort((x, y) => y.pri - x.pri); const offers = []; const P0 = pend(X);
        for (const a of here(w)) {
            if (P0.has(a.agentId) || (w.civic?.jail?.[a.agentId] > d)) continue;
            for (const K of kinds) {
                const ck = a.agentId + '|' + K.key; if (X.cool[ck] > d) continue;
                const ctx = whenOf(w, a, K); if (!ctx) continue; const opts = optsOf(w, a, K, ctx); if (opts.length < 2) continue;
                X.cool[ck] = d + K.cool; X.st.offer++; offers.push({ a, K, ctx, opts }); break;
            }
        }
        // AI 一天問得有限：急的事、鎮上的重要人物先
        offers.sort((x, y) => (y.K.pri + (notable(w, y.a) ? 0.5 : 0)) - (x.K.pri + (notable(w, x.a) ? 0.5 : 0)));
        dispatch(w, X, offers, d); drain(w, X, d);
    }
    // 立刻照個性替這個人決定一件事（測試、除錯用；steady = 不加當天的心情起伏）。回傳那筆紀錄
    function ruleOnce(w, a, key, steady) {
        const K = KINDS[key]; if (!K || !K.scan || !a) return null; const ctx = whenOf(w, a, K); if (!ctx) return null; const X = S(w), d = day(w);
        const e = resolveRule(w, X, { a, K, ctx }, d, steady ? 0 : NOISE); drain(w, X, d); return e;
    }
    // 測試用：等所有還在路上的 AI 回話都處理完
    async function flush() { await Promise.all(_proms.slice()); }

    // ================= 5. 給介面 =================
    function view(w, a) {
        const X = w.decide; const L = X?.log?.[a?.agentId] || []; const d0 = day(w);
        const rows = L.slice().reverse().map(e => ({ ago: d0 - e.d, what: say(e.what), why: e.why ? say(e.why) : '', res: e.res ? say(e.res) : '', ai: !!e.ai, free: !!e.free, kind: KINDS[e.kind] ? t(KINDS[e.kind].title) : '' }));
        const pl = X?.plan?.[a?.agentId]; return { rows, plan: pl && d0 - pl.d <= 30 ? say(pl.x) : '' };
    }
    function stats(w) { const X = S(w); return { ...X.st, pick: { ...X.pick } }; }

    // 決策核心有沒有在運作(其他系統用這個判斷「這件事是不是交給本人決定」)
    const on = (w) => !!(w?.observerMode && W() && w.wallet);
    return { S, source, kind, KINDS, ledger, lines, lean, score, daily, flush, ruleOnce, enqueue, drain, view, stats, aiOn, on, FX, record, kinLine, debtLines, trendLine, worth, prompt, AI_MAX, BATCH };
})();

// ================= 階段 1：理財的三個選擇點 =================
(() => {
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const depOf = (w, a) => (w.bank?.open ? (w.bank.dep?.[a.agentId] || 0) : 0);
    const P = (w) => { try { return typeof INFL !== 'undefined' ? INFL.p(w) : 1; } catch (e) { return 1; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const pct1 = (y) => Math.round(y * 1000) / 10; const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const bankOk = (w) => typeof BANK !== 'undefined' && w.bank?.open && w.bank.status === 'ok';
    const names = (arr) => arr.map(x => x.name).join(t('、'));

    // ---------- 手上有閒錢 ----------
    DECIDE.kind('spare', {
        title: '手上有閒錢', cool: 6, pri: 1,
        when(w, a) {
            const c = cash(w, a), dp = depOf(w, a), px = P(w);
            if (c >= 80 * px || (dp >= 100 && c + dp >= 150 * px)) return { c, dp, free: Math.max(0, Math.floor(c - 30 * px)) };
            return null;
        },
        facts(w, a, ctx) {
            return `${t('你手上有 {c} 銀幣').replace('{c}', Math.round(ctx.c))}${ctx.dp > 0 ? t('，銀行裡還有 {d}').replace('{d}', Math.round(ctx.dp)) : ''}${t('；留下這幾天的生活費，大概有 {f} 銀幣可以自己決定怎麼用。').replace('{f}', ctx.free)}`;
        },
        options(w, a, ctx) {
            const px = P(w), c = ctx.c, out = [];
            out.push({ id: 'keep', quiet: true, text: '先留在身上，什麼都不做', say: '先把錢留在身上', why: '錢留在身邊，要用隨時有。', base: 1.5, lean: { safe: 0.5 }, run: () => null });
            // 存銀行
            if (bankOk(w) && ctx.free >= 20) {
                const n = Math.floor(ctx.free * 0.6); const r = (() => { try { return pct1(INVEST.bankYield(w)); } catch (e) { return 0; } })();
                out.push({ id: 'deposit', text: { k: '把 {n} 銀幣存進銀行（一週利息大約 {r}%）', p: { n, r } }, say: { k: '把 {n} 銀幣存進銀行', p: { n } }, why: '錢放銀行比較安心，還能生利息。', base: 0.9 + Math.min(0.6, r * 0.3), lean: { safe: 0.9, gain: 0.2 },
                    run: (w2, a2) => { const got = BANK.deposit(w2, w2.bank, a2, n); if (!got) return { k: '銀行沒收下這筆錢' }; a2.memory?.addT?.(w2.tickCount, w2.clock?.timeStr || '', 'economy', '我把 {n} 銀幣存進銀行，放著也會生利息。', { n: got }, 4, []); return { k: '存了 {n} 銀幣', p: { n: got } }; } });
            }
            // 入股（最划算的兩家）
            try { if (typeof INVEST !== 'undefined') for (const q of INVEST.quotes(w, a).sort((x, y) => (y.y - x.y)).slice(0, 2)) {
                const sName = MARKET.name(q.k); const prem = clampN((q.y - q.by - INVEST.hurdle(a)) * 100, -2, 2); // 分紅比銀行利息好多少（已經扣掉這個人要的風險補貼）
                out.push({ id: 'invest:' + q.k, text: { k: '花 {n} 銀幣向{o}買{s} {p}% 的股份（照現在的生意，一週分紅大約是本錢的 {y}%；銀行存款一週 {r}%）', p: { n: q.price, o: q.boss.name, s: sName, p: q.p, y: pct1(q.y), r: pct1(q.by) } }, say: { k: '花 {n} 銀幣入股{s}', p: { n: q.price, s: sName } }, why: '分紅比銀行利息好，錢要拿去生錢。', base: 0.6 + prem * 0.5, lean: { gain: 0.9, safe: -0.3 },
                    run: (w2, a2) => { const r = INVEST.buy(w2, a2, q.k, true); /* v9.22.0 賣不賣由當家自己決定(sim-decide-life.js) */ return r.ok ? { k: '買到{s} {p}% 的股份', p: { s: sName, p: r.p } } : r.asked ? { k: '去找{o}談入股了', p: { o: r.boss.name } } : r.refused ? { k: '{o}不肯賣', p: { o: r.boss.name } } : { k: '沒談成' }; } });
            } } catch (e) {}
            if (typeof SPEND !== 'undefined') {
                // 宴客
                { const pl = SPEND.feastPlan(w, a); if (pl) out.push({ id: 'feast', text: { k: '花 {n} 銀幣在食堂擺一桌，請{g}吃飯', p: { n: Math.round(pl.cost), g: { raw: names(pl.guests.slice(0, 3)) } } }, why: '有錢了，該請朋友好好吃一頓。', base: 0.5, lean: { bond: 0.6, joy: 0.4, face: 0.3, safe: -0.4 },
                    run: (w2, a2) => { const r = SPEND.feast(w2, a2); return r ? { k: '請了 {m} 個人，花了 {n} 銀幣', p: { m: r.guests.length, n: Math.round(r.cost) } } : { k: '沒辦成' }; } }); }
                // 旅遊（越有錢越想出門）
                { const pl = SPEND.tripPlan(w, a); if (pl) out.push({ id: 'trip', text: { k: '花 {n} 銀幣去外地玩幾天', p: { n: Math.round(pl.cost) } }, why: '辛苦這麼久，想出去走走看看。', base: 0.3 + Math.min(1, c / (400 * px)) * 0.8, lean: { joy: 0.9, safe: -0.4 },
                    run: (w2, a2) => { const r = SPEND.trip(w2, a2); return r ? { k: '去了{t}，花了 {n} 銀幣', p: { t: r.where, n: Math.round(r.cost) } } : { k: '沒去成' }; } }); }
                // 畫像
                { const pl = SPEND.artPlan(w, a); if (pl) out.push({ id: 'art', text: { k: '花 {n} 銀幣請{p}替自己畫一張像', p: { n: Math.round(pl.cost), p: pl.painter.name } }, why: '想替自己留一張像，讓後人記得。', base: 0.7, lean: { face: 0.9, joy: 0.2, safe: -0.3 },
                    run: (w2, a2) => { const r = SPEND.art(w2, a2); return r ? { k: '{p}替我畫了一張像', p: { p: r.painter.name } } : { k: '沒畫成' }; } }); }
                // 送孩子去讀書
                { const pl = SPEND.enrolPlan(w, a); if (pl) for (const k of pl.kids.slice(0, 2)) out.push({ id: 'school:' + k.agentId, text: { k: '花 {n} 銀幣送{k}去外地讀書（之後每 30 天還要再繳 {m}；讀過書的孩子長大後工資比較高）', p: { n: Math.round(pl.cost), k: k.name, m: Math.round(pl.again) } }, say: { k: '花 {n} 銀幣送{k}去外地讀書', p: { n: Math.round(pl.cost), k: k.name } }, why: '再苦也要讓孩子讀書。', base: 0.8 + (hasV(a, '知識') ? 1.2 : 0) - (has(a, 'ascetic') ? 0.4 : 0), lean: { bond: 0.6, gain: 0.2 },
                    run: (w2, a2) => { const r = SPEND.enrol(w2, a2, k.agentId); return r ? { k: '{k}去外地讀書了', p: { k: r.kid.name } } : { k: '沒送成' }; } }); }
            }
            if (typeof WALLET !== 'undefined' && WALLET.giveTo) {
                // 接濟手頭很緊的親友（家人，或有交情的人）
                { const fam = famOf(w, a); const needy = here(w).filter(o => o !== a && cash(w, o) < 6 && (fam.includes(o) || aff(a, o) > -10)).sort((x, y) => (fam.includes(y) ? 100 : 0) + aff(a, y) - (fam.includes(x) ? 100 : 0) - aff(a, x)).slice(0, 2); const n = Math.round(15 * px);
                  if (c >= 120 * px) for (const x of needy) out.push({ id: 'help:' + x.agentId, text: { k: '塞 {n} 銀幣給手頭很緊的{x}（不用他還）', p: { n, x: x.name } }, say: { k: '塞 {n} 銀幣給{x}', p: { n, x: x.name } }, why: { k: '{x}有難，不能看著不管。', p: { x: x.name } }, base: 1.0 + (fam.includes(x) ? 0.8 : 0) + clampN(aff(a, x) / 60, -0.2, 1), lean: { bond: 0.9, safe: -0.3 },
                    run: (w2, a2) => { const got = WALLET.giveTo(w2, a2, w2.agents[x.agentId], n); return got ? { k: '給了{x} {n} 銀幣', p: { x: x.name, n: got } } : { k: '沒給成' }; } }); }
                // 公庫快空了，捐一點
                { const tr = w.stockpile?.get?.('silver') || 0; if (tr < 60 && c >= 160 * px) { const n = Math.round(40 * px); out.push({ id: 'town', text: { k: '捐 {n} 銀幣給公庫（公庫只剩 {m} 銀幣）', p: { n, m: Math.round(tr) } }, say: { k: '捐 {n} 銀幣給公庫', p: { n } }, why: '公庫空了大家都不好過，我出一份力。', base: 1.4, lean: { bond: 0.6, face: 0.5, safe: -0.2 },
                    run: (w2, a2) => { const got = WALLET.donateTown(w2, a2, n); return got ? { k: '捐了 {n} 銀幣給公庫', p: { n: got } } : { k: '沒捐成' }; } }); } }
                // 請最要好的朋友吃一頓
                { const f = here(w).filter(o => o !== a && aff(a, o) >= 20).sort((x, y) => aff(a, y) - aff(a, x))[0]; const n = Math.round(8 * px); if (f && c >= 120 * px) out.push({ id: 'treat:' + f.agentId, text: { k: '花 {n} 銀幣請{x}吃一頓好的', p: { n, x: f.name } }, why: { k: '好久沒跟{x}好好吃一頓了。', p: { x: f.name } }, base: 1.1, lean: { bond: 0.7, joy: 0.3, safe: -0.2 },
                    run: (w2, a2) => { const got = WALLET.treat(w2, a2, w2.agents[f.agentId], n); return got ? { k: '請{x}吃了一頓', p: { x: f.name } } : { k: '沒請成' }; } }); }
            }
            return out;
        },
    });

    // ---------- 手頭很緊 ----------
    const owes = (w, r, l) => (w.dark?.debts || []).some(x => !x.done && x.cash && x.r === r.agentId && (!l || x.l === l.agentId));
    DECIDE.kind('pinch', {
        title: '手頭很緊', cool: 5, pri: 2,
        when(w, a) { const c = cash(w, a); return c < 6 ? { c } : null; },
        facts(w, a, ctx) { return t('你身上只剩 {c} 銀幣，連吃飯都成問題。').replace('{c}', Math.round(ctx.c)); },
        options(w, a, ctx) {
            const out = [];
            out.push({ id: 'endure', quiet: true, text: '咬牙撐過去，不跟任何人開口', say: '咬牙撐過去', why: '跟人開口太難了，再撐幾天看看。', base: 1.0, lean: { face: 0.6, safe: 0.1 }, run: () => null });
            // 跟交情不錯、手頭寬裕的人借（還欠著他錢的，不好再跟同一個人開口）
            if (typeof WALLET !== 'undefined' && WALLET.lendTo) for (const l of here(w).filter(o => o !== a && cash(w, o) >= 40 && aff(o, a) >= 10 && !owes(w, a, o)).sort((x, y) => aff(y, a) - aff(x, a)).slice(0, 2)) {
                const n = WALLET.loanSize(w, l);
                out.push({ id: 'borrow:' + l.agentId, text: { k: '跟{l}開口借 {n} 銀幣（一週後要還）', p: { l: l.name, n } }, say: { k: '跟{l}開口借錢', p: { l: l.name } }, why: { k: '實在撐不下去了，只好跟{l}開口。', p: { l: l.name } }, base: 1.5 + clampN(aff(a, l) / 60, 0, 1), lean: { bond: 0.5, face: -0.4 },
                    run: (w2, a2) => { DECIDE.enqueue(w2, w2.agents[l.agentId], 'asked', { from: a2.agentId, n }); return { k: '去跟{l}開口了', p: { l: l.name } }; } });
            }
            // 跟銀行借（有工作、沒有還在還的貸款）
            if (bankOk(w) && a.job && !w.bank.loans[a.agentId] && BANK.lendable(w.bank) >= 25) {
                const r = Math.round((w.bank.rate || 0) * 100);
                out.push({ id: 'bankloan', text: { k: '跟銀行借 25 銀幣周轉（利息大約 {r}%，20 天內還清；還不出來會變呆帳、名聲掃地）', p: { r } }, say: '跟銀行借 25 銀幣周轉', why: '跟銀行借，至少不用看人臉色。', base: 1.3, lean: { face: 0.3, safe: -0.3 },
                    run: (w2, a2) => { const got = BANK.lend(w2, w2.bank, a2, 25, '周轉'); return got ? { k: '銀行借了我 {n} 銀幣', p: { n: got } } : { k: '銀行不肯借' }; } });
            }
            return out;
        },
    });

    // ---------- 有人來借錢（只由別人的決定引發） ----------
    const setRes = (w, id, optId, res) => { const L = w.decide?.log?.[id] || []; for (let i = L.length - 1; i >= 0; i--) if (L[i].id === optId) { L[i].res = res; break; } };
    DECIDE.kind('asked', {
        title: '有人來借錢', scan: false, pri: 3,
        when: () => null,
        facts(w, a, ctx) { const r = w.agents[ctx.from]; if (!r) return ''; return t('{r}手頭很緊（身上只剩 {c} 銀幣），來跟你借 {n} 銀幣，說一週後還。你對他的好感 {f}；你自己身上有 {m} 銀幣。').replace('{r}', r.name).replace('{c}', Math.round(cash(w, r))).replace('{n}', ctx.n).replace('{f}', Math.round(aff(a, r))).replace('{m}', Math.round(cash(w, a))); },
        options(w, a, ctx) {
            const r = w.agents[ctx.from]; if (!r || r.isDead || r === a) return []; const out = []; const c = cash(w, a); const fam = famOf(w, a).includes(r);
            const lentOut = (w.dark?.debts || []).filter(x => !x.done && x.cash && x.l === a.agentId).length; const burned = (w.dark?.wrongs || []).some(x => x.by === r.agentId && x.to === a.agentId && !x.forgiven);
            const tell = (res) => setRes(w, r.agentId, 'borrow:' + a.agentId, res);
            if (c >= WALLET.loanSize(w, a) + 10) out.push({ id: 'lend', text: { k: '借給他 {n} 銀幣', p: { n: WALLET.loanSize(w, a) } }, say: { k: '把錢借給{r}', p: { r: r.name } }, why: { k: '{r}有難，能幫就幫。', p: { r: r.name } }, base: 0.7 + clampN(aff(a, r) / 40, -1, 1.5) + (fam ? 0.8 : 0) - lentOut * 0.8 - (burned ? 2 : 0) - (c < 80 ? 0.5 : 0), lean: { bond: 0.9 },
                run: (w2, a2) => { const got = WALLET.lendTo(w2, a2, w2.agents[r.agentId]); tell(got ? { k: '{l}借了我 {n} 銀幣', p: { l: a2.name, n: got } } : { k: '{l}沒借成', p: { l: a2.name } }); return got ? { k: '借了 {n} 銀幣給{r}', p: { n: got, r: r.name } } : { k: '沒借成' }; } });
            if (c >= 120) out.push({ id: 'gift', text: '不用還，直接塞 15 銀幣給他', say: { k: '直接塞錢給{r}，不用他還', p: { r: r.name } }, why: '這點錢不用還了，誰沒有困難的時候。', base: -1.2 + clampN(aff(a, r) / 50, 0, 1) + (fam ? 1 : 0), lean: { bond: 0.9, gain: -0.3 },
                run: (w2, a2) => { const got = WALLET.giveTo(w2, a2, w2.agents[r.agentId], 15); tell(got ? { k: '{l}直接給了我 {n} 銀幣，說不用還', p: { l: a2.name, n: got } } : { k: '{l}沒給成', p: { l: a2.name } }); return got ? { k: '給了{r} {n} 銀幣', p: { r: r.name, n: got } } : { k: '沒給成' }; } });
            out.push({ id: 'refuse', text: '婉拒，說自己也不寬裕', say: { k: '婉拒了{r}', p: { r: r.name } }, why: '我自己也不寬裕，實在借不出來。', base: 0.9, lean: { safe: 0.5, gain: 0.4 },
                run: (w2, a2) => { WALLET.refuseLoan(w2, a2, w2.agents[r.agentId]); tell({ k: '{l}拒絕了', p: { l: a2.name } }); return { k: '沒借給{r}', p: { r: r.name } }; } });
            return out;
        },
    });
})();

// ================= 接上其他系統 =================
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { DECIDE.daily(w); } catch (e) { console.warn('[Decide] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    // 最後一層：把各系統塞進「最近記得」的那一串，整理成帳本的幾行（【錢】【立場】【人際】【近況】【鎮上】【做過的決定】【打算】）
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) {
        const b = _ab.call(this, world, a, other);
        try { if (b && world?.observerMode) { const L = DECIDE.ledger(world, a, b.mem); b.ledger = L; b.mem = DECIDE.lines(L); } } catch (e) { console.warn('[Decide] brief', e); }
        return b;
    };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.decide = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.decide) { const { _asked, ...rest } = this.decide; d.decide = rest; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.decide = (data?.decide && typeof data.decide === 'object') ? data.decide : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.DECIDE = DECIDE;
