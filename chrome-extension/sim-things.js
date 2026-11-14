// v9.0.0 世界新事物（通用）：鎮上出現任何新東西（賭場、新建築、新店、新法律、新科技……），村民都會自己形成好惡、跟它互動
// - 各系統只要「登記」一次：名字、事實描述、地點、老闆、性質標籤（例如 vice 惡習、money 賺錢、risk 冒險、fun 娛樂、harm 會害人、faith 違背信仰、novelty 新奇、jobs 帶來工作、noise 吵鬧、prestige 體面、health 健康）
// - 村民聽說之後形成自己的看法：完整智能體模式交給 AI（拿這東西的描述＋每個人的個性、處境、記憶、跟老闆的交情來判斷），否則用「個性 × 性質」推估
// - 共用的行動：去用它、推薦給朋友、跟人抱怨、勸家人別碰、到門口抗議、提案禁止它；看法會隨親身經歷、家人遭遇、別人說的話慢慢改變
// - 東西自己的規則（例如賭場的輸贏）留在原本的系統；那邊只要回報經歷（feel）和受害者（victim），其他反應全部走這裡
const THINGS = (() => {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => (a.age ?? 30) >= 14 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const bump = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const news = (w, s, imp, nm) => { try { w.dailyNews?.collectEvent?.('social', s, imp || 7, nm || []); } catch (e) {} };
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const px = (w) => { try { return typeof INFL !== 'undefined' ? INFL.p(w) : 1; } catch (e) { return 1; } };
    const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));
    const pick = (arr) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const kidsOf = (w, a) => npcs(w).filter(o => (o._parentNames || []).includes(a.name) && (o.age ?? 30) < 18);
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    const isEn = () => { try { return typeof I18N !== 'undefined' && I18N.getLang?.() === 'en'; } catch (e) { return false; } };
    const nm = (T) => (Array.isArray(T.name) ? (isEn() ? T.name[1] : T.name[0]) : t(T.name));
    // 各類東西自己的「掛鉤」（不存檔）：canUse(w,T,a) 現在能不能用、ban(w,T) 被禁止時要做什麼、facts(w,T) 給 AI 的最新事實
    const HOOKS = {};
    function S(w) {
        if (!w.things || typeof w.things !== 'object') w.things = { list: {}, att: {}, why: {}, quit: {}, victims: {}, lastDay: null, n: 0, st: { formed: 0, ai: 0, use: 0, rec: 0, comp: 0, pers: 0, persOk: 0, prot: 0, protN: 0, ban: 0, press: 0, buried: 0, help: 0 } };
        const X = w.things; for (const k of ['list', 'att', 'why', 'quit', 'victims']) X[k] = X[k] || {}; X.st = X.st || {}; return X;
    }
    // ---------- 登記 ----------
    // o: { kind, key, name:[zh,en], icon, facts:'給 AI 的事實（中文，翻譯鍵）', place, owner, tags:{...}, usable }
    function register(w, o) {
        const X = S(w); const id = o.kind + ':' + (o.key || ++X.n);
        const old = X.list[id];
        X.list[id] = Object.assign(old || {}, { id, kind: o.kind, name: o.name, icon: o.icon || '🆕', facts: o.facts || '', place: o.place || null, owner: o.owner || null, tags: o.tags || {}, usable: !!o.usable, build: o.build || old?.build || null, site: old?.site || null, ttl: o.ttl || old?.ttl || 0, born: old?.born ?? day(w), gone: false, protest: old?.protest || null });
        X.att[id] = X.att[id] || {}; X.why[id] = X.why[id] || {};
        { const own = w.agents[o.owner]; if (own) { X.att[id][own.agentId] = 90; X.why[id][own.agentId] = { k: '這是我自己的心血。', p: {} }; } } // 老闆一定喜歡自己的東西（換了老闆也一樣）
        return X.list[id];
    }
    function retire(w, id) { const T = S(w).list[id]; if (T) { T.gone = true; T.goneDay = day(w); } }
    function get(w, id) { return S(w).list[id] || null; }
    const live = (w) => Object.values(S(w).list).filter(T => !T.gone);
    function att(w, id, a) { const v = S(w).att[id]?.[a?.agentId]; return v == null ? null : v; }
    // ---------- 規則版：個性 × 性質 ----------
    function prefs(w, a) {
        const P = {}; const add = (k, v) => { P[k] = (P[k] || 0) + v; };
        add('harm', -10); add('vice', -5); // 一般人多少都不喜歡害人、不喜歡惡習
        const V = (x) => (a.personality?.values || []).some(v => v === x || v === t(x));
        if (V('家庭')) { add('vice', -20); add('harm', -20); add('health', 10); }
        if (V('自由')) { add('vice', 12); add('tradition', -10); add('fun', 5); }
        if (V('知識')) { add('novelty', 15); add('fun', -5); }
        if (V('財富')) { add('money', 25); add('risk', 10); }
        if (V('權力')) { add('prestige', 15); add('money', 10); }
        if (V('藝術')) { add('fun', 10); add('prestige', 5); }
        if (V('自然')) { add('noise', -15); add('novelty', -5); }
        if (V('社群')) { add('harm', -15); add('jobs', 10); add('noise', -5); }
        if (V('冒險')) { add('risk', 25); add('novelty', 15); add('fun', 10); }
        if (V('和平')) { add('noise', -15); add('harm', -15); add('vice', -10); }
        if (has(a, 'hardworking')) { add('fun', -8); add('vice', -8); add('jobs', 10); }
        if (has(a, 'creative')) { add('novelty', 10); add('fun', 5); }
        if (has(a, 'shy')) { add('noise', -10); add('fun', -5); }
        if (has(a, 'night_owl')) { add('fun', 10); add('noise', 5); }
        if (has(a, 'early_bird')) { add('noise', -10); }
        if (has(a, 'neurotic')) { add('risk', -15); add('harm', -10); }
        if (devout(w, a)) { add('vice', -40); add('faith', -35); add('harm', -10); }
        if (a.job?.key === 'priest') { add('vice', -45); add('faith', -40); }
        if (has(a, 'greedy')) { add('money', 25); add('risk', 15); add('vice', 10); }
        if (has(a, 'optimist')) { add('risk', 15); add('fun', 10); add('novelty', 10); }
        if (has(a, 'pessimist')) { add('risk', -20); add('novelty', -10); }
        if (has(a, 'lazy')) { add('fun', 15); add('jobs', -5); }
        if (has(a, 'ascetic')) { add('fun', -20); add('vice', -30); add('prestige', -10); }
        if (has(a, 'stoic')) { add('fun', -10); add('vice', -10); }
        if (has(a, 'kind') || has(a, 'generous')) { add('harm', -30); add('jobs', 10); }
        if (has(a, 'ambitious')) { add('money', 15); add('prestige', 15); add('novelty', 5); }
        if (has(a, 'charismatic')) { add('fun', 10); }
        if (has(a, 'perfectionist')) { add('risk', -10); add('noise', -10); }
        if (has(a, 'romantic')) { add('fun', 8); }
        if (has(a, 'glutton')) { add('fun', 8); }
        if (has(a, 'jealous')) { add('prestige', -10); }
        if (a.techStance === 'conservative') { add('novelty', -20); add('tradition', 15); }
        if (a.techStance === 'progressive') { add('novelty', 20); add('tradition', -10); }
        const c = cash(w, a), p = px(w); if (c < 20 * p) { add('money', 10); add('risk', 10); add('jobs', 15); } else if (c > 200 * p) { add('fun', 10); add('noise', -5); }
        if (!a.job || a.job.key === 'unemployed') add('jobs', 20);
        if (kidsOf(w, a).length) { add('vice', -15); add('harm', -10); add('health', 10); }
        if ((a.age ?? 30) >= 60) { add('novelty', -10); add('tradition', 10); add('noise', -10); }
        if ((a.age ?? 30) < 25) { add('novelty', 10); add('fun', 10); }
        return P;
    }
    function ruleAtt(w, T, a) {
        if (a.agentId === T.owner) return { v: 90, k: '這是我自己的心血。', p: {} };
        const P = prefs(w, a); let v = 0, best = null, bestAbs = 0;
        for (const [tag, wt] of Object.entries(T.tags || {})) { const c = (P[tag] || 0) * wt; v += c; if (Math.abs(c) > bestAbs) { bestAbs = Math.abs(c); best = { tag, c }; } }
        const own = w.agents[T.owner]; if (own) v += aff(a, own) * 0.3;
        v += (Math.random() - 0.5) * 30;
        const W = WHY[best?.tag]; const k = !best || bestAbs < 8 ? (v >= 0 ? '聽起來還不錯，去看看也好。' : '說不上來，總覺得不太對勁。') : (best.c > 0 ? W[0] : W[1]);
        return { v: clamp(v), k, p: { x: nm(T) } };
    }
    const WHY = {
        vice: ['人生苦短，偶爾放縱一下有什麼關係。', '這種東西會帶壞人，尤其是年輕人。'],
        money: ['說不定是個賺錢的機會。', '這只是把大家口袋裡的錢搬到少數人手上。'],
        risk: ['不冒點險，日子哪會變好。', '風險太大了，我不想碰。'],
        fun: ['鎮上總算有點樂子了。', '花錢找樂子，不如把日子過踏實。'],
        harm: ['大人自己的選擇，自己負責。', '我看了就難過，這會害人家破人亡。'],
        faith: ['信仰是信仰，生活是生活。', '這違背了我們的信仰。'],
        novelty: ['新東西就該試試看。', '老祖宗沒這種東西，日子也過得好好的。'],
        jobs: ['多了工作機會，總是好事。', '它搶了別人的飯碗。'],
        noise: ['熱鬧一點才像個鎮。', '吵得人睡不著。'],
        prestige: ['這讓我們鎮上有面子。', '擺闊給誰看。'],
        health: ['對身體有好處。', '這對身體不好。'],
        tradition: ['這是老傳統，該留著。', '老規矩早該改了。'],
    };
    // ---------- 聽說了、形成看法 ----------
    function form(w, X, T, a, d, v, why, ai) {
        X.att[T.id][a.agentId] = clamp(v); X.why[T.id][a.agentId] = why; X.st.formed++; if (ai) X.st.ai++;
        if (Math.abs(v) >= 25 || ai) mem(w, a, '{x}：{y}', { x: { k: '我聽說了{t}', p: { t: nm(T) } }, y: why }, 5);
    }
    async function aiForm(w, X, T, who, d) {
        const ce = w.conversationEngine; if (!aiOn(w) || !who.length) return null;
        try {
            const own = w.agents[T.owner]; const facts = (HOOKS[T.kind]?.facts?.(w, T)) || t(T.facts);
            const lines = who.map((a, i) => { const b = ce._agentBrief(w, a, own || null); return `${i + 1}. ${b.name}${t('（')}${b.job}${t('，')}${t('性格')}${t('：')}${b.traits}${t('，')}${t('身上')} ${Math.round(cash(w, a))} ${t('銀幣')}${own ? `${t('，')}${t('跟老闆的交情')} ${Math.round(aff(a, own))}` : ''}${t('）')}${t('：')}${(b.mem || []).slice(0, 4).join(' / ')}`; }).join('\n');
            const prompt = `${t('鎮上出現了新東西')}${t('：')}${nm(T)}${t('。')}${facts}${own ? `${t('老闆是')}${own.name}${t('。')}` : ''}\n${t('以下幾位村民剛聽說這件事。請依每個人自己的個性、處境、記憶與人際關係，判斷他真實的感受（可以喜歡、討厭、無所謂，不必討好任何人），以及他最可能想做什麼。只輸出 JSON 陣列，每人一個物件')}${t('：')}{"v":-2~2 ${t('的整數')}, "why":"${t('第一人稱一句話，20 字內')}", "act":"use|recommend|complain|persuade|protest|ignore"}\n${lines}`;
            ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 90 + who.length * 70); return Array.isArray(j) ? j : null;
        } catch (e) { return null; }
    }
    const ACTS = ['use', 'recommend', 'complain', 'persuade', 'protest', 'ignore'];
    // 每天同步跑完；只有「問 AI」另外非同步送出，回來再補上那幾個人的看法（AI 失敗或太慢，隔天就照個性推估）
    const PENDING = new Set(); const _proms = [];
    function aiOn(w) { const ce = w.conversationEngine; return !!(w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson); }
    function learn(w, X, T, d) {
        const known = X.att[T.id]; const fresh = here(w).filter(a => known[a.agentId] == null && Math.random() < (d - T.born < 2 ? 0.35 : 0.2)); if (!fresh.length) return;
        let notable = [];
        if (aiOn(w) && !PENDING.has(T.id)) {
            notable = fresh.filter(a => { try { return typeof CROWD !== 'undefined' && CROWD.notable ? CROWD.notable(w).has(a.agentId) : true; } catch (e) { return true; } }).slice(0, 4);
            if (notable.length) {
                PENDING.add(T.id); const who = notable.slice();
                const pr = aiForm(w, X, T, who, d).then(ai => {
                    const X2 = w.things; if (!X2 || X2 !== X || !X.list[T.id] || !X.att[T.id]) return;
                    who.forEach((a, i) => {
                        if (!w.agents[a.agentId] || X.att[T.id][a.agentId] != null) return; const r = ai ? ai[i] : null;
                        if (r && Number.isFinite(+r.v) && typeof r.why === 'string' && r.why.trim()) {
                            form(w, X, T, a, d, Math.max(-2, Math.min(2, Math.round(+r.v))) * 40 + (Math.random() - 0.5) * 10, { k: '{x}', p: { x: LLMClient.clip(r.why, 60) } }, true);
                            if (ACTS.includes(r.act)) (X.intent || (X.intent = {}))[T.id + '|' + a.agentId] = r.act;
                        }
                    });
                }).catch(() => {}).finally(() => PENDING.delete(T.id));
                _proms.push(pr); if (_proms.length > 20) _proms.splice(0, _proms.length - 20);
            }
        }
        for (const a of fresh) { if (notable.includes(a) || known[a.agentId] != null) continue; const R = ruleAtt(w, T, a); form(w, X, T, a, d, R.v, { k: R.k, p: R.p }, false); }
    }
    // 測試用：等 AI 的回覆都回來
    function flush() { return Promise.all(_proms.slice()); }
    // ---------- 經歷改變看法（各系統呼叫） ----------
    function feel(w, id, a, delta, k, p) {
        const X = S(w); const T = X.list[id]; if (!T || !a || a.agentId === T.owner) return; const cur = X.att[id][a.agentId]; // 老闆不會因為別人說三道四就討厭自己的心血
        X.att[id][a.agentId] = clamp((cur == null ? 0 : cur) + delta); if (k) { X.why[id][a.agentId] = { k, p: p || {} }; mem(w, a, k, p || {}, Math.min(9, 5 + Math.round(Math.abs(delta) / 20))); }
    }
    // 受害者：家人跟著心寒；之後可能有人拉他一把
    function victim(w, id, a, k, p) {
        const X = S(w); if (!X.list[id] || !a) return; X.victims[a.agentId] = { id, day: day(w), k, p: p || {} };
        feel(w, id, a, -60, k, p); X.att[id][a.agentId] = Math.min(X.att[id][a.agentId] ?? -60, -50); // 被害慘了，再怎麼愛也會恨
        for (const o of [...famOf(w, a), ...kidsOf(w, a)]) if (o !== a) feel(w, id, o, -45, '{a}被{t}害慘了，我絕對不會原諒它。', { a: a.name, t: nm(X.list[id]) });
        for (const o of here(w)) if (o !== a && aff(o, a) >= 30 && Math.random() < 0.6) feel(w, id, o, -15, '{a}的遭遇讓我對{t}改觀了。', { a: a.name, t: nm(X.list[id]) });
    }
    const quitting = (w, id, a) => (S(w).quit[id + '|' + a.agentId] || -1) >= day(w);
    // 想不想去用（各系統乘上自己的機率）：0.15～2 倍
    function useMult(w, id, a) { if (quitting(w, id, a)) return 0; const v = att(w, id, a); if (v == null) return 0.5 * buyMult(w, id, a); return Math.max(0.15, Math.min(2, 1 + v / 70)) * buyMult(w, id, a); }
    // v9.9.0 抵制:討厭的人不去,跟帶頭的人交情好的也不好意思去
    function buyMult(w, id, a) {
        const T = S(w).list[id]; const B = T?.boycott; if (!B || day(w) > B.until || !a) return 1;
        const v = S(w).att[id]?.[a.agentId]; if (v != null && v <= -20) return 0.15;
        const lead = w.agents[B.lead]; if (lead && aff(a, lead) >= 30) return 0.6;
        return 0.9;
    }
    // ---------- 共用的行動 ----------
    const friendsOf = (w, a, min = 15, T) => here(w).filter(o => o !== a && aff(a, o) >= min && (!T || o.agentId !== T.owner));
    function recommend(w, X, T, a) {
        const f = pick(friendsOf(w, a, 15, T).filter(o => (X.att[T.id][o.agentId] ?? 0) < 50)); if (!f) return;
        const cur = X.att[T.id][f.agentId]; const sway = (has(a, 'charismatic') ? 1.4 : 1) * (0.5 + aff(f, a) / 100) * (has(f, 'stoic') ? 0.5 : 1);
        if (cur == null) { const R = ruleAtt(w, T, f); form(w, X, T, f, day(w), R.v + 15 * sway, { k: '{a}跟我推薦{t}，聽起來不錯。', p: { a: a.name, t: nm(T) } }, false); }
        else feel(w, T.id, f, 12 * sway, Math.random() < 0.5 ? '{a}一直跟我說{t}的好話。' : null, { a: a.name, t: nm(T) });
        X.st.rec++; if (Math.random() < 0.2 && day(w) - (T.recLog ?? -99) >= 4) { T.recLog = day(w); log(w, '💬 {a}跟{b}說：「{t}真的不錯，你也去看看。」', { a: a.name, b: f.name, t: nm(T) }, a.name); }
    }
    function complain(w, X, T, a) {
        const f = pick(friendsOf(w, a, 5, T)); if (!f) return;
        const sway = (has(a, 'charismatic') ? 1.4 : 1) * (0.5 + aff(f, a) / 100) * (has(f, 'gossip') ? 1.3 : 1);
        const cur = X.att[T.id][f.agentId];
        if (cur == null) { const R = ruleAtt(w, T, f); form(w, X, T, f, day(w), R.v - 15 * sway, { k: '{a}說{t}不是好東西。', p: { a: a.name, t: nm(T) } }, false); }
        else feel(w, T.id, f, -10 * sway, Math.random() < 0.5 ? '{a}一直說{t}的壞話。' : null, { a: a.name, t: nm(T) });
        X.st.comp++;
        // 順便講常去的人的八卦
        const reg = HOOKS[T.kind]?.regulars?.(w, T) || []; const g = pick(reg.filter(id => id !== a.agentId && id !== f.agentId).map(id => w.agents[id]).filter(Boolean));
        if (g && Math.random() < 0.5) { bump(f, g, -3); mem(w, f, '聽{a}說，{g}最近常往{t}跑。', { a: a.name, g: g.name, t: nm(T) }, 4); if (Math.random() < 0.3) log(w, '🗣️ {a}跟{b}咬耳朵：「{g}最近天天往{t}跑，家裡都不管了。」', { a: a.name, b: f.name, g: g.name, t: nm(T) }, a.name); }
        else if (Math.random() < 0.15 && day(w) - (T.compLog ?? -99) >= 4) { T.compLog = day(w); log(w, '🗣️ {a}跟{b}抱怨：「{t}遲早害死人。」', { a: a.name, b: f.name, t: nm(T) }, a.name); } // v9.9.0 同一樣東西四天最多一則(以前一年 150～250 則一樣的抱怨洗版)
    }
    function persTargets(w, X, T, a) {
        const reg = new Set(HOOKS[T.kind]?.regulars?.(w, T) || []);
        return [...famOf(w, a), ...npcs(w).filter(o => (a._parentNames || []).includes(o.name) || (o._parentNames || []).includes(a.name)), ...friendsOf(w, a, 25)].filter(o => o !== a && reg.has(o.agentId) && !quitting(w, T.id, o));
    }
    function persuade(w, X, T, a) {
        const tgt = pick(persTargets(w, X, T, a)); if (!tgt) return false;
        X.st.pers++; let p = 0.25 + aff(tgt, a) / 250 + (has(a, 'kind') ? 0.1 : 0) + (has(a, 'charismatic') ? 0.1 : 0) - (has(tgt, 'greedy') ? 0.15 : 0) - (has(tgt, 'abrasive') ? 0.1 : 0) - Math.max(0, (X.att[T.id][tgt.agentId] || 0)) / 400;
        if (X.victims[tgt.agentId]) p += 0.25;
        if (Math.random() < p) {
            X.st.persOk++; X.quit[T.id + '|' + tgt.agentId] = day(w) + 60; feel(w, T.id, tgt, -35, '{a}勸了我好久，我答應不再去{t}了。', { a: a.name, t: nm(T) }); bump(tgt, a, 4);
            log(w, '🤝 {a}苦勸{b}別再去{t}，{b}終於點頭答應了。', { a: a.name, b: tgt.name, t: nm(T) }, a.name);
        } else {
            bump(tgt, a, -6); bump(a, tgt, -4); feel(w, T.id, tgt, 6, '{a}又來管我去{t}的事，煩死了。', { a: a.name, t: nm(T) });
            log(w, '💢 {a}勸{b}別再去{t}，兩人大吵一架，{b}甩門出去了。', { a: a.name, b: tgt.name, t: nm(T) }, a.name);
        }
        return true;
    }
    // 到門口抗議：當天想抗議的人夠多（3 人以上）才成形；老闆依個性回應
    function protest(w, X, T, crowd, d, fans) {
        if (!crowd.length) return; const own = w.agents[T.owner]; const lead = crowd.slice().sort((x, y) => (has(y, 'charismatic') ? 1 : 0) - (has(x, 'charismatic') ? 1 : 0))[0];
        if (crowd.length < 3) { for (const a of crowd) mem(w, a, '我想去{t}門口抗議，可是沒幾個人願意跟。', { t: nm(T) }, 4); return; }
        X.st.prot++; X.st.protN += crowd.length; T.protest = { day: d, n: crowd.length, who: crowd.map(a => a.agentId), lead: lead.agentId };
        gather(w, T, crowd);
        counterRally(w, X, T, crowd, lead, d, fans); // v9.9.0 分邊站:支持的人也到場
        if (T.owner && w.agents[T.owner] && (T.kind === 'shop' || HOOKS[T.kind]?.boycott)) boycott(w, X, T, lead, crowd, d);
        if (T.place) log(w, '📢 {a}帶著 {n} 個鎮民到{t}門口抗議，舉著牌子喊「還我們安寧的小鎮」。', { a: lead.name, n: crowd.length, t: nm(T) }, lead.name); else log(w, '📢 {a}帶著 {n} 個鎮民在廣場集會，反對{t}。', { a: lead.name, n: crowd.length, t: nm(T) }, lead.name);
        news(w, `📢 ${lead.name}${t('帶著')} ${crowd.length} ${t('人到')}${nm(T)}${t('門口抗議')}`, 8, [lead.name]);
        for (const a of crowd) { mem(w, a, '我跟大家一起到{t}門口抗議。', { t: nm(T) }, 7); for (const b of crowd) if (a !== b) bump(a, b, 2); }
        // 圍觀的人：看法本來就接近的會被拉過去，喜歡的人覺得被冒犯
        for (const o of here(w)) { if (crowd.includes(o) || o === own) continue; const v = X.att[T.id][o.agentId]; if (v == null) continue; if (v < 0) feel(w, T.id, o, -6); else if (v > 30) { feel(w, T.id, o, 4); if (Math.random() < 0.3) bump(o, lead, -3); } }
        if (own) {
            for (const a of crowd) bump(own, a, -5);
            const soft = has(own, 'kind') || has(own, 'generous') || has(own, 'charismatic'); const big = crowd.length >= 6;
            if ((soft || big) && cash(w, own) >= 40 * px(w) && !has(own, 'abrasive')) {
                const n = Math.round(Math.min(cash(w, own) * 0.15, 30 * px(w))); if (n > 0 && typeof WALLET !== 'undefined' && WALLET.take(w, own, n)) { w.stockpile?.add?.('silver', n, w.tickCount, t('捐給鎮上')); for (const a of crowd) feel(w, T.id, a, has(a, 'greedy') ? 15 : 5); }
                log(w, '🎁 {o}出來安撫大家，當場捐了 {n} 銀幣給鎮上，說會「好好經營」。有人買帳，有人說這是封口費。', { o: own.name, n: Math.round(n) }, own.name); mem(w, own, '鎮民跑來抗議，我只好捐錢給鎮上息事寧人。', {}, 7);
            } else { log(w, '🙅 {o}站在門口冷冷地說：「我做正當生意，看不順眼別來。」', { o: own.name }, own.name); for (const a of crowd) feel(w, T.id, a, -8); mem(w, own, '一群人跑到我店門口鬧，我才不怕。', {}, 6); }
        }
        // 抗議之後：人多就把禁止提案推上議程
        if (crowd.length >= 4) banPropose(w, X, T, lead, d, crowd.length);
    }
    // ---------- v9.9.0 民意與派系動員 ----------
    // 兩邊各有多少人(只算還在鎮上的、看法夠明確的)
    function camps(w, X, T) {
        const A = Object.entries(X.att[T.id] || {}).filter(([id]) => w.agents[id] && id !== T.owner); const pro = A.filter(([, v]) => v >= 25).length, con = A.filter(([, v]) => v <= -25).length;
        return { n: pro + con, pro, con, all: A.length };
    }
    const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    // 沉默螺旋:自己是少數(不到兩成五)、又沒有看法相同的朋友撐腰,多半就不說出口
    function silent(w, X, T, a, v, cs) {
        if (cs.n < 6 || Math.abs(v) >= 70) return false; const mine = v > 0 ? cs.pro : cs.con; if (mine / cs.n >= 0.25) return false;
        if (friendsOf(w, a, 30, T).some(o => sign(X.att[T.id][o.agentId] || 0) === sign(v) && Math.abs(X.att[T.id][o.agentId]) >= 25)) return false;
        if (Math.random() > 0.7) return false;
        const sl = X.silent || (X.silent = {}); const k = T.id + '|' + a.agentId;
        if (!sl[k]) { X.st.silent = (X.st.silent || 0) + 1; mem(w, a, v > 0 ? '大家好像都討厭{t}，我喜歡也不敢講。' : '大家好像都很喜歡{t}，我不喜歡也不好說什麼。', { t: nm(T) }, 4); }
        sl[k] = day(w); return true;
    }
    const silentN = (w, X, T) => Object.entries(X.silent || {}).filter(([k, d]) => k.startsWith(T.id + '|') && day(w) - d <= 30 && w.agents[k.slice(T.id.length + 1)]).length;
    const board = (w) => { try { return typeof PRESS !== 'undefined' && w.press ? (w.press.papers || []).find(x => x.st === 'board' && !x.banned) || null : null; } catch (e) { return null; } };
    // 貼告示:帶頭的人在公告欄貼告示號召;看到告示、本來就不喜歡的人更容易跟來
    function notice(w, X, T, org, d) {
        X.st.notice = (X.st.notice || 0) + 1; T.notice = d;
        const k = T.place ? '📌 {a}在公告欄貼了告示：「反對{t}，到門口集合，有志一同的一起來！」' : '📌 {a}在公告欄貼了告示：「反對{t}，到廣場集合，有志一同的一起來！」';
        const P = board(w); let posted = false; if (P) { try { PRESS.story(w, P, 'notice', k, { a: org.name, t: nm(T) }); posted = true; } catch (e) {} }
        if (!posted) log(w, k, { a: org.name, t: nm(T) }, org.name);
        mem(w, org, '我在公告欄貼了告示，號召大家一起反對{t}。', { t: nm(T) }, 6);
    }
    // 支持的人也到場聲援(兩邊隔街對喊);支持者夠多才成形
    const fanOdds = (w, T, o) => { const own = w.agents[T.owner]; return 0.3 + (own && aff(o, own) >= 40 ? 0.25 : 0) + (has(o, 'abrasive') ? 0.1 : 0); };
    const isFan = (X, T, o, crowd) => !crowd.includes(o) && o.agentId !== T.owner && (X.att[T.id][o.agentId] ?? 0) >= 50;
    function counterRally(w, X, T, crowd, lead, d, pre) {
        const own = w.agents[T.owner];
        const fans = pre ? pre.filter(o => isFan(X, T, o, crowd)) : here(w).filter(o => isFan(X, T, o, crowd) && Math.random() < fanOdds(w, T, o)); // pre = 前一天已經答應到場聲援的人(交給本人決定時)
        if (fans.length < 3) return;
        const head = fans.slice().sort((x, y) => (has(y, 'charismatic') ? 1 : 0) - (has(x, 'charismatic') ? 1 : 0))[0];
        gather(w, T, fans); X.st.counter = (X.st.counter || 0) + 1; T.protest.counter = fans.length;
        log(w, '🙋 {b}帶著 {n} 個支持{t}的人也到場聲援，兩邊隔著街對喊。', { b: head.name, n: fans.length, t: nm(T) }, head.name);
        news(w, fill('🙋 {t}吵成兩派：{a} 人抗議、{b} 人聲援', { t: nm(T), a: crowd.length, b: fans.length }), 7, [lead.name, head.name]);
        for (const a of fans) { mem(w, a, '有人去{t}門口抗議，我也到場替它說話。', { t: nm(T) }, 6); for (const b of crowd) { if (Math.random() < 0.5) { bump(a, b, -4); bump(b, a, -4); } } }
    }
    // 抵制:有老闆、有人抗議過的店,帶頭的人號召大家兩週不去光顧;老闆看個性道歉或硬撐
    function boycott(w, X, T, lead, crowd, d) {
        if (T.boycott && d <= T.boycott.until) return; if (d - (T.boycott?.until ?? -99) < 30) return;
        const own = w.agents[T.owner]; if (!own) return;
        T.boycott = { from: d, until: d + 14, lead: lead.agentId, n: crowd.length };
        X.st.boycott = (X.st.boycott || 0) + 1;
        log(w, '🛒 {a}號召大家抵制{t}：兩個禮拜不去光顧，直到{o}給個交代。', { a: lead.name, t: nm(T), o: own.name }, lead.name);
        mem(w, own, '{a}號召大家抵制我的{t}，這下生意要難做了。', { a: lead.name, t: nm(T) }, 8);
    }
    const WAYS_ = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    function boycottTick(w, X, T, d) {
        const B = T.boycott; if (!B || B.done) return; const own = w.agents[T.owner]; if (!own) { B.done = true; return; }
        // 心軟、會做人的老闆撐不到兩週就出來道歉
        if (!B.answered && d - B.from >= 3 && d <= B.until && (has(own, 'kind') || has(own, 'generous') || has(own, 'charismatic')) && !has(own, 'stubborn') && Math.random() < 0.3) {
            B.answered = 'sorry'; B.until = d; X.st.boycottWon = (X.st.boycottWon || 0) + 1;
            log(w, '🙇 {o}出來跟大家道歉，答應會改進，{t}的抵制提早結束。', { o: own.name, t: nm(T) }, own.name);
            for (const a of here(w)) { const v = X.att[T.id][a.agentId]; if (v != null && v < 0) feel(w, T.id, a, 12); }
            try { WAYS_()?.loseFace?.(w, own, 6); } catch (e) {}
        }
        if (d > B.until && !B.done) {
            B.done = true;
            if (B.answered !== 'sorry') { const L = w.agents[B.lead]; log(w, '🛒 {t}被抵制了兩個禮拜，{o}硬撐過去，跟帶頭的{a}從此不說話。', { t: nm(T), o: own.name, a: L?.name || '' }, own.name); if (L) { bump(own, L, -15); bump(L, own, -8); } }
        }
    }
    // 逼首長表態:吵到有人抗議、或反對的人很多又是鎮上熱門話題,首長就得出來說話
    function mayorOf(w) { try { return w.proposals?._mayor?.(w) || w.election?.currentMayor?.(w) || null; } catch (e) { return null; } }
    function hot(w, T) { try { if (typeof BUZZ === 'undefined') return false; const n = nm(T); return BUZZ.attended(w).some(x => String(x.text || '').includes(n)); } catch (e) { return false; } }
    function pressMayor(w, X, T, d, cs) {
        if (d - (T.stance?.day ?? -99) < 30 || cs.n < 6) return; const recent = T.protest && d - T.protest.day <= 2;
        if (!recent && !(cs.con >= 6 && cs.con / cs.n >= 0.45 && hot(w, T))) return;
        const m = mayorOf(w); if (!m || m.agentId === T.owner || !w.agents[m.agentId]) return;
        const mv = X.att[T.id][m.agentId] ?? ruleAtt(w, T, m).v; const maj = cs.con > cs.pro ? -1 : 1;
        const follow = (has(m, 'charismatic') || has(m, 'ambitious') ? 0.6 : 0.3) - (has(m, 'stubborn') ? 0.3 : 0);
        const lean = mv * (1 - follow) + maj * 60 * follow; const dodge = Math.abs(lean) < 20 || ((has(m, 'shy') || has(m, 'neurotic')) && Math.random() < 0.4);
        const side = dodge ? 0 : sign(lean); T.stance = { day: d, side, who: m.agentId }; X.st.stance = (X.st.stance || 0) + 1;
        const k = side < 0 ? '🎙️ 首長{m}被問到{t}的事，公開表態：「我站在反對的鎮民這邊。」' : side > 0 ? '🎙️ 首長{m}被問到{t}的事，公開表態：「{t}對鎮上有好處，我支持。」' : '🎙️ 首長{m}被問到{t}的事，打了半天太極，誰都沒得罪、也誰都沒說服。';
        log(w, k, { m: m.name, t: nm(T) }, m.name); news(w, fill(k, { m: m.name, t: nm(T) }), 8, [m.name]);
        const P = board(w); if (P) { try { PRESS.story(w, P, 'stance', k, { m: m.name, t: nm(T) }); } catch (e) {} }
        for (const a of here(w)) {
            if (a === m) continue; const v = X.att[T.id][a.agentId]; if (v == null) continue;
            if (side) {
                if (sign(v) === side) bump(a, m, 4); else if (Math.abs(v) >= 25) bump(a, m, -6);
                if (aff(a, m) >= 30 && sign(v) !== side) feel(w, T.id, a, side * 10); // 信任首長的人會被說動一些
            } else if (Math.abs(v) >= 40) bump(a, m, -3);
        }
        mem(w, m, side ? '大家吵{t}吵到我得出面表態。' : '大家逼我對{t}表態，我不想得罪任何人。', { t: nm(T) }, 7);
    }
    // 派系(社團):同派系的人
    const mates = (w, a) => { try { return (w.factions?.getAgentFactions?.(a.agentId) || []).flatMap(f => f.members).filter(id => id !== a.agentId); } catch (e) { return []; } };
    // 兩群人對同一件東西看法相反(一邊平均 ≥30、一邊 ≤-30),回傳吵得最兇的那件
    function splitIssue(w, A, B) {
        const X = w.things; if (!X) return null; let best = null;
        for (const T of Object.values(X.list || {})) { if (T.gone) continue; const at = X.att[T.id] || {}; const avg = (ids) => { const v = ids.map(id => at[id]).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
            const a = avg(A), b = avg(B); if (a == null || b == null) continue; if (!((a >= 30 && b <= -30) || (a <= -30 && b >= 30))) continue; const gap = Math.abs(a - b); if (!best || gap > best.gap) best = { id: T.id, name: nm(T), a, b, gap }; }
        return best;
    }
    // 同派系的人看法慢慢靠攏(每天往派系平均挪一點)
    function factionPull(w, X, T) {
        try { for (const f of Object.values(w.factions?.factions || {})) { const at = X.att[T.id]; const ids = f.members.filter(id => at[id] != null && w.agents[id]); if (ids.length < 2) continue; const avg = ids.reduce((s, id) => s + at[id], 0) / ids.length; for (const id of ids) at[id] = clamp(at[id] + (avg - at[id]) * 0.05); } } catch (e) {}
    }
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    // 輿論翻轉、全鎮共識
    function tide(w, X, T, d, cs) {
        if (cs.n < 6) return; const diff = cs.pro - cs.con; const maj = Math.abs(diff) / cs.n >= 0.2 ? sign(diff) : 0;
        if (maj && T.maj && maj !== T.maj) {
            X.st.flip = (X.st.flip || 0) + 1;
            const k = maj > 0 ? '🔄 輿論翻轉：本來多數人反對{t}，現在支持的反而比較多（{p} 比 {c}）。' : '🔄 輿論翻轉：本來多數人支持{t}，現在反對的反而比較多（{c} 比 {p}）。';
            log(w, k, { t: nm(T), p: cs.pro, c: cs.con }); news(w, fill(k, { t: nm(T), p: cs.pro, c: cs.con }), 8, []);
        }
        if (maj) T.maj = maj;
        if (cs.pro >= 3 && cs.con >= 3) T.contested = true; // 吵過的事吵出結果才叫「共識」(沒爭議的新店不算,以前一年冒出二十幾次)
        const top = Math.max(cs.pro, cs.con); if (T.contested && cs.n >= 8 && top / cs.n >= 0.8 && !T.consensus) {
            T.consensus = cs.pro > cs.con ? 1 : -1; X.st.consensus = (X.st.consensus || 0) + 1;
            const k = T.consensus > 0 ? '🤝 全鎮共識：幾乎所有人都喜歡{t}（{n} 人裡 {m} 人）。' : '🤝 全鎮共識：幾乎所有人都受不了{t}（{n} 人裡 {m} 人）。';
            log(w, k, { t: nm(T), n: cs.n, m: top });
        }
    }
    // 視覺：抗議的人實際走到那棟建築門口（地圖那邊讀 a._thingGo）
    function gather(w, T, who) { const now = w.tickCount; for (const a of who) a._thingGo = { place: T.place ? T.place + '_front' : 'town_square', from: now, until: now + 16, why: 'protest', id: T.id }; }
    // 今晚去（各系統呼叫）：fromH～toH 點走到那棟建築；sit=true 時坐在門口（例如輸光的人）
    function goTonight(w, id, a, fromH, toH, sit) {
        const T = get(w, id); if (!T?.place || !a) return; const h = w.clock?.hour ?? 0, m = w.clock?.minute ?? 0; const d0 = w.tickCount - h * 4 - Math.floor(m / 15);
        a._thingGo = { place: T.place + (sit ? '_front' : ''), from: d0 + fromH * 4, until: d0 + toH * 4, why: sit ? 'sit' : 'use', id };
    }
    // 每格：在時間窗內就把目的地設成那裡（地圖會讓人走過去）
    function tick(w) {
        for (const a of Object.values(w.agents || {})) {
            const g = a._thingGo; if (!g) continue;
            if (w.tickCount >= g.until || a.isDead) { delete a._thingGo; if (a._thingAt) { delete a._thingAt; a._locationStayRemaining = 0; } continue; }
            const on = w.tickCount >= g.from; if (on && a._thingAt !== g.place) { a._thingAt = g.place; a._locationStayRemaining = 0; } else if (!on && a._thingAt) { delete a._thingAt; }
        }
    }
    // 地圖：有地點的新東西蓋一棟（存下位置，重開也在同一處）；門口留一塊空地給抗議或坐著的人
    function syncMap(w, tm) {
        if (!w?.things || !tm?.grid) return false; let changed = false;
        for (const T of Object.values(w.things.list || {})) {
            if (!T.place || !T.build) continue; const label = nm(T) + (T.gone ? t('（歇業）') : '');
            if (!tm.buildingZones[T.place]) {
                // 地圖密的話換小一點的樣式（存下用了哪個，重開時同一棟同一處）
                const TB = typeof TILE_BUILDING_TEMPLATES !== 'undefined' ? TILE_BUILDING_TEMPLATES : {}; let site = T.site, use = T.build.used;
                if (!site) for (const k of [T.build.tmpl, 'general_store', 'library', 'house'].filter(Boolean)) { const tp = TB[k]; if (!tp) continue; site = tm.findFreeSite?.(tp.w, tp.h + 1); if (site) { use = k; break; } }
                if (!site) continue; T.site = site; T.build.used = use || T.build.tmpl || 'house';
                try { if (typeof LOCATION_BUILDING !== 'undefined') LOCATION_BUILDING[T.place] = T.build.used; } catch (e) {}
                tm._placeBuilding(T.place, site.x, site.y, label); const z = tm.buildingZones[T.place];
                if (z) { const dx = Math.floor(z.doorPixelX / 16), dy = Math.floor(z.doorPixelY / 16); tm.natureZones = tm.natureZones || {}; tm.natureZones[T.place + '_front'] = { x: dx - 1, y: dy + 1, w: 3, h: 2 }; }
                try { if (w.townMap && !w.townMap.locations[T.place]) w.townMap.addLocation({ id: T.place, name: nm(T), description: t(T.facts), x: site.x * 16, y: site.y * 16, category: 'social', capacity: 20 }); } catch (e) {}
                changed = true;
            } else if (tm.labelPositions?.[T.place] && tm.labelPositions[T.place].name !== label) { tm.labelPositions[T.place].name = label; changed = true; }
            try { const L = w.townMap?.locations?.[T.place]; if (L) L.name = label; } catch (e) {}
        }
        if (changed) { tm._sceneSrc = null; tm._insideLUT = null; }
        return changed;
    }
    function banPropose(w, X, T, who, d, n, why) {
        const TT = typeof TECH !== 'undefined' ? TECH : null; if (!TT?.propose || !HOOKS[T.kind]?.ban || TT.busy?.(w, 'thing_ban')) return;
        if (d - (T.banProp ?? -99) < 30) return; T.banProp = d;
        TT.propose(w, 'thing_ban', T.id, who, '禁止{t}', why || '{who}說鎮上有 {n} 個人到{t}門口抗議，大家受夠了：提議禁止{t}。', { t: nm(T), n }, 'social', { t: nm(T) }, { thing: T.id });
    }
    // 民怨：被害的人夠多、或討厭的人佔了三成五以上，就有人站出來提案禁止
    function opinionBan(w, X, T, d) {
        if (!HOOKS[T.kind]?.ban || d - T.born < 10) return; const A = Object.entries(X.att[T.id]).filter(([id]) => w.agents[id]); if (A.length < 6) return;
        const hate = A.filter(([, v]) => v <= -40); const vict = Object.entries(X.victims).filter(([, x]) => x.id === T.id).length;
        if (!(vict >= 2 || (hate.length >= 5 && hate.length / A.length >= 0.35))) return;
        const cands = hate.map(([id, v]) => [w.agents[id], v]).filter(([a]) => a && a.agentId !== T.owner && here(w).includes(a)); if (!cands.length) return;
        const score = ([a, v]) => -v + (has(a, 'charismatic') ? 30 : 0) + (devout(w, a) || a.job?.key === 'priest' ? 20 : 0) + (famOf(w, a).some(o => X.victims[o.agentId]) ? 40 : 0);
        const who = cands.sort((x, y) => score(y) - score(x))[0][0];
        banPropose(w, X, T, who, d, vict >= 2 ? vict : hate.length, vict >= 2 ? '{who}說{t}開張以來已經有 {n} 個家庭被它害慘了：提議禁止{t}。' : '{who}說鎮上已經有 {n} 個人受不了{t}：提議禁止{t}。');
    }
    function vote(w, p, a) {
        const v = att(w, p.thing, a); const s = (v == null ? ruleAtt(w, get(w, p.thing) || { tags: {} }, a).v * 0.5 : v) + (Math.random() - 0.5) * 20;
        return { v: s < 0 ? 'for' : 'against', why: s < 0 ? (S(w).victims[a.agentId] || famOf(w, a).some(o => S(w).victims[o.agentId]) ? 'thing_hurt' : 'thing_bad') : (a.agentId === get(w, p.thing)?.owner ? 'thing_mine' : 'thing_good') };
    }
    function enact(w, p) {
        const X = S(w); const T = X.list[p.thing]; if (!T) return ''; X.st.ban++; const r = HOOKS[T.kind]?.ban?.(w, T); retire(w, T.id);
        if (!r) log(w, '🚫 小鎮投票決定禁止{t}。', { t: nm(T) }); for (const a of here(w)) { const v = X.att[T.id][a.agentId]; if (v != null) mem(w, a, v < 0 ? '{t}終於被禁了，鎮上總算清靜。' : '{t}被禁了，真可惜。', { t: nm(T) }, 6); }
        return r || `${t('禁止')}${nm(T)}`;
    }
    // 報社：吵得兇的東西會被寫成專題；老闆可能花錢把新聞壓下來（真相頁看得到）
    function press(w, X, T, d) {
        if (d - (T.pressDay ?? -99) < 25) return; const A = Object.values(X.att[T.id]); const pro = A.filter(v => v >= 40).length, con = A.filter(v => v <= -40).length;
        const vict = Object.values(X.victims).filter(x => x.id === T.id).length; if (con < 3 || (pro < 2 && vict < 1)) return;
        T.pressDay = d; const own = w.agents[T.owner];
        if (own && con > pro && (has(own, 'greedy') || has(own, 'ambitious')) && cash(w, own) >= 120 * px(w) && Math.random() < 0.5) {
            const n = Math.round(40 * px(w)); const ed = pick(here(w).filter(a => a !== own && ['writer', 'scholar', 'merchant'].includes(a.job?.key))) || pick(here(w).filter(a => a !== own));
            if (ed && typeof WALLET !== 'undefined' && WALLET.take(w, own, n)) { WALLET.add(w, ed, n); X.st.buried++; try { DARK.secret(w, { kind: 'cover', culprit: own.agentId, victim: null, k: '{o}塞了 {n} 銀幣給{e}，把{t}害人的報導壓了下來', p: { o: own.name, n, e: ed.name, t: nm(T) } }); } catch (e) {} mem(w, own, '我花錢把那篇報導壓下來了。', {}, 7); return; }
        }
        X.st.press++; const s = t('🗞️ 專題：「{t}」吵翻小鎮，{a} 人叫好、{b} 人反對，已經有 {c} 個家庭被它害慘。').replace('{t}', nm(T)).replace('{a}', pro).replace('{b}', con).replace('{c}', vict);
        news(w, s, 8, own ? [own.name] : []); log(w, '{s}', { s }); for (const a of here(w)) { const v = X.att[T.id][a.agentId]; if (v != null && Math.random() < 0.5) feel(w, T.id, a, v < 0 ? -5 : -2); }
    }
    // 拉人一把：被害慘的人，交情好的朋友可能給錢、幫忙找工作
    const rescuers = (w, a) => here(w).filter(o => o !== a && aff(o, a) >= 30 && cash(w, o) >= 50 * px(w) && (has(o, 'kind') || has(o, 'generous') || aff(o, a) >= 55));
    const needy = (v, d) => !v.helped && d - v.day >= 2 && d - v.day <= 40;
    const rescueAmt = (w, f) => Math.round(Math.min(cash(w, f) * 0.15, 25 * px(w)));
    function rescueDo(w, X, f, a, v, d) {
        const n = rescueAmt(w, f); if (!(n > 0) || !WALLET.take(w, f, n)) return 0; WALLET.add(w, a, n);
        v.helped = f.agentId; X.st.help++; X.quit[v.id + '|' + a.agentId] = d + 90; bump(a, f, 15); a.moodModifier = (a.moodModifier || 0) + 8;
        log(w, '🫱 {f}拿了 {n} 銀幣給{a}，說：「先把日子過下去，別再碰{t}了。」', { f: f.name, a: a.name, n, t: nm(X.list[v.id] || { name: '' }) }, f.name);
        mem(w, a, '我最落魄的時候，是{f}拉了我一把。', { f: f.name }, 9); mem(w, f, '我幫了{a}一把，希望他能重新站起來。', { a: a.name }, 6);
        return n;
    }
    function rescue(w, X, d) { // 要不要拉他一把,由交情好的朋友自己決定(rescueBy);這裡只清掉過期的紀錄
        for (const [id, v] of Object.entries(X.victims)) {
            const a = w.agents[id]; if (!a || a.isDead) { delete X.victims[id]; continue; } if (v.helped || d - v.day < 2 || d - v.day > 40) { if (d - v.day > 120) delete X.victims[id]; continue; }
        }
    }
    // ---------- v9.27.0 給決策核心 ----------
    const baseOk = (X, T) => { const A0 = Object.values(X.att[T.id] || {}); const hateN = A0.filter(v => v <= -40).length; return Object.values(X.victims).some(x => x.id === T.id) || (A0.length > 0 && hateN / A0.length >= 0.2); };
    const canCall = (X, T, d) => !T.call && d - (T.protest?.day ?? -99) >= 30 && d - (X.lastProtest ?? -99) >= 7 && baseOk(X, T);
    // 這個人最看不慣鎮上哪一樣新東西、現在可以做哪些有後果的事(勸常去的自己人別去、帶頭號召抗議)。跟以前擲骰的是同一批人:有看法、不是老闆、今天沒有因為自己是少數而不敢講
    function actInfo(w, a) {
        const X = S(w); const d = day(w); if (!a || !here(w).includes(a)) return null; let best = null;
        for (const T of live(w)) {
            const v = X.att[T.id]?.[a.agentId]; if (v == null || v > -25 || a.agentId === T.owner || X.intent?.[T.id + '|' + a.agentId]) continue;
            if (X.silent?.[T.id + '|' + a.agentId] === d) continue;
            const acts = []; const tg = persTargets(w, X, T, a); if (tg.length) acts.push('persuade'); if (v <= -55 && canCall(X, T, d)) acts.push('protest');
            if (acts.length && (!best || v < best.v)) best = { T, v, acts, tg };
        }
        if (!best) return null; const { T, v, acts, tg } = best; const cs = camps(w, X, T);
        return { T, v: Math.round(v), acts, p: Math.abs(v) / 100 * 0.18, pro: cs.pro, con: cs.con, name: nm(T), owner: w.agents[T.owner] || null, victim: !!X.victims[a.agentId], who: tg.slice(0, 3) };
    }
    function actBy(w, a, tid, act) {
        const I = actInfo(w, a); if (!I || I.T.id !== tid || !I.acts.includes(act)) return false;
        (S(w).intent || (S(w).intent = {}))[tid + '|' + a.agentId] = act; return true; // 隔天一早照他決定的去做
    }
    // 號召抗議:帶頭的人貼告示,不喜歡的人自己決定跟不跟、喜歡的人自己決定去不去聲援;隔天集合
    const rallyOdds = (w, X, T, o, crowd, org, mob) => { const v = X.att[T.id][o.agentId]; return (mob.has(o.agentId) ? 0.25 : 0) + 0.15 + (-v - 30) / 140 + Math.max(0, Math.max(...crowd.map(c => aff(o, c)))) / 150 + (has(o, 'shy') ? -0.15 : 0) + (has(org, 'charismatic') ? 0.1 : 0); };
    function callOut(w, X, T, crowd, d) {
        const org = crowd[0]; notice(w, X, T, org, d); T.call = { d, org: org.agentId, who: crowd.map(a => a.agentId), fans: [] };
        try {
            for (const o of here(w)) { if (crowd.includes(o) || o.agentId === T.owner) continue; const v = X.att[T.id][o.agentId] ?? 0; if (v <= -20) DECIDE.enqueue(w, o, 'rally', { tid: T.id, side: 'con' }); else if (v >= 50) DECIDE.enqueue(w, o, 'rally', { tid: T.id, side: 'pro' }); }
        } catch (e) { console.warn('[Things] rally', e); }
    }
    function rallyInfo(w, a, c) {
        const X = S(w); const T = X.list[c?.tid]; const C = T && !T.gone ? T.call : null; if (!a || !C || !here(w).includes(a) || a.agentId === T.owner || C.who.includes(a.agentId) || C.fans.includes(a.agentId)) return null;
        const v = X.att[T.id]?.[a.agentId] ?? 0; const org = w.agents[C.org]; if (!org) return null; const crowd = C.who.map(id => w.agents[id]).filter(Boolean);
        if (c.side === 'con') { if (v > -20) return null; return { T, side: 'con', v: Math.round(v), org, n: crowd.length, name: nm(T), p: Math.max(0.02, Math.min(0.95, rallyOdds(w, X, T, a, crowd, org, new Set(crowd.flatMap(x => mates(w, x)))))) }; }
        if (v < 50) return null; return { T, side: 'pro', v: Math.round(v), org, n: crowd.length, name: nm(T), owner: w.agents[T.owner] || null, p: Math.min(0.95, fanOdds(w, T, a)) };
    }
    function rallyBy(w, a, c) { const I = rallyInfo(w, a, c); if (!I) return null; (I.side === 'con' ? I.T.call.who : I.T.call.fans).push(a.agentId); return I; }
    // 朋友被新東西害慘了:要不要拿錢拉他一把
    function rescueInfo(w, f) {
        const X = S(w); const d = day(w); if (!f || typeof WALLET === 'undefined' || !w.wallet) return null;
        for (const [id, v] of Object.entries(X.victims)) { const a = w.agents[id]; if (!a || a.isDead || a === f || !needy(v, d) || !rescuers(w, a).includes(f)) continue; const n = rescueAmt(w, f); if (n > 0) return { a, v, n, name: nm(X.list[v.id] || { name: '' }), cash: Math.round(cash(w, f)), others: rescuers(w, a).length - 1 }; }
        return null;
    }
    function rescueBy(w, f, vid) { const I = rescueInfo(w, f); if (!I || I.a.agentId !== vid) return 0; return rescueDo(w, S(w), f, I.a, I.v, day(w)); }
    // ---------- 每天 ----------
    // 自動發現鎮上新出現的東西：新建築、新開的店、新研究出來的科技（第一次跑時現有的都當成本來就有）
    const BLD_TAGS = (k) => { k = String(k || ''); if (/brew|tavern|inn|bar/.test(k)) return { fun: 1, vice: 0.4, noise: 0.5 }; if (/school|library|academy|institute|lab/.test(k)) return { novelty: 1, jobs: 0.5, prestige: 0.4 }; if (/clinic|hospital|garden|bath/.test(k)) return { health: 1, jobs: 0.4 }; if (/market|shop|bank|trade/.test(k)) return { money: 1, jobs: 0.6, noise: 0.4 }; if (/wall|tower|guard|fort|training/.test(k)) return { prestige: 0.6, tradition: 0.5, money: -0.4 }; if (/chapel|temple|shrine|church/.test(k)) return { tradition: 1, faith: -0.6 }; if (/factory|mill|mine|forge|plant|boiler|work/.test(k)) return { jobs: 1, noise: 1, novelty: 0.6, health: -0.4 }; return { jobs: 0.5, novelty: 0.5, prestige: 0.5 }; };
    const SHOP_TAGS = { bakery: { fun: 0.6, jobs: 0.4 }, smithy: { jobs: 0.6, noise: 0.6 }, tailor: { prestige: 0.6, jobs: 0.4 }, apothecary: { health: 1 }, inn: { fun: 1, vice: 0.5, noise: 0.5 }, stall: { money: 0.6, jobs: 0.4 }, studio: { fun: 0.6, prestige: 0.6 } };
    function discover(w, X, d) {
        const seen = X.seen || (X.seen = { b: {}, s: {}, t: {}, base: false }); const first = !seen.base; seen.base = true;
        for (const [i, b] of (w.buildings?.completed || []).entries()) { const key = (b.id || b.buildingKey || 'b') + ':' + i; if (seen.b[key]) continue; seen.b[key] = 1; if (first) continue;
            register(w, { kind: 'building', key, name: b.name, icon: '🏗️', facts: b.description || '鎮上新蓋好的建築。', tags: BLD_TAGS(b.buildingKey || b.id), ttl: 45 }); }
        for (const sh of (w.biz?.shops || [])) { if (sh.closed || seen.s[sh.id]) continue; seen.s[sh.id] = 1; if (first) continue; const nmz = Array.isArray(sh.name) ? sh.name : [sh.name, sh.name];
            register(w, { kind: 'shop', key: sh.id, name: nmz, icon: '🏪', facts: '鎮上新開的店。', owner: sh.owner, tags: SHOP_TAGS[sh.type] || { money: 0.5, jobs: 0.5 }, ttl: 45 }); }
        // v9.9.0 新科技的支持與反對由觀念傳播(IdeaSystem 保守派／革新派)負責,這裡不再重複登記一份
        const R = {}; const TI = typeof TECH_IDEAS !== 'undefined' ? TECH_IDEAS : {};
        for (const [k, P] of Object.entries(R)) { if (P?.status !== 'complete' || seen.t[k]) continue; seen.t[k] = 1; if (first || !TI[k]) continue; const I = TI[k];
            register(w, { kind: 'tech', key: k, name: P.name || k, icon: '🔬', facts: I.idea || '新研究出來的技術。', tags: Object.assign({ novelty: 1 + (I.c || 0), tradition: -(I.c || 0) }, I.threat ? { jobs: -0.8 } : { jobs: 0.3 }), ttl: 45 }); }
    }
    function daily(w) {
        const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        try { discover(w, X, d); } catch (e) {}
        for (const T of live(w)) {
            if (HOOKS[T.kind]?.alive && !HOOKS[T.kind].alive(w, T)) { retire(w, T.id); continue; }
            if (T.ttl && d - T.born > T.ttl && !(d - (T.protest?.day ?? -99) <= 30 || (T.boycott && d <= T.boycott.until))) { retire(w, T.id); continue; } // 新鮮感過了，變成日常的一部分(v9.9.0 還在吵、還在抵制的不算)
            learn(w, X, T, d);
            if (T.call && d > T.call.d) { const C = T.call; delete T.call; const live1 = (ids) => ids.map(id => w.agents[id]).filter(a => a && !a.isDead && here(w).includes(a)); protest(w, X, T, live1(C.who), d, live1(C.fans)); } // v9.27.0 昨天貼告示號召的,今天集合
            const crowd = []; const cs = camps(w, X, T);
            for (const a of here(w)) {
                const v = X.att[T.id][a.agentId]; if (v == null || a.agentId === T.owner) continue;
                if (!X.intent?.[T.id + '|' + a.agentId] && silent(w, X, T, a, v, cs)) continue; // v9.9.0 沉默螺旋
                let act = X.intent?.[T.id + '|' + a.agentId]; if (act) delete X.intent[T.id + '|' + a.agentId];
                if (!act) { const p = Math.abs(v) / 100 * 0.18; if (Math.random() > p) continue; act = v > 0 ? (Math.random() < 0.7 ? 'use' : 'recommend') : (v <= -55 && d - (T.protest?.day ?? -99) >= 30 && Math.random() < 0.35 ? 'protest' : Math.random() < 0.5 ? 'persuade' : 'complain');
                    // v9.27.0 去用、推薦、抱怨是日常閒聊,照舊;勸自己人別去、帶頭號召抗議這兩件有後果的事由本人決定(決策核心「鎮上有你看不慣的東西」),這裡不替他做
                    if (act === 'persuade') { if (persTargets(w, X, T, a).length) continue; act = 'complain'; } else if (act === 'protest') { if (baseOk(X, T)) continue; act = 'complain'; } } // 抗議:有群眾基礎就留給本人決定(時機不對時以前也是不了了之);沒有群眾基礎的,以前就是改成抱怨
                if (act === 'use') { X.st.use++; continue; } // 真的去用，交給各系統看 useMult
                if (act === 'recommend') recommend(w, X, T, a);
                else if (act === 'complain') complain(w, X, T, a);
                else if (act === 'persuade') { if (!persuade(w, X, T, a)) complain(w, X, T, a); }
                else if (act === 'protest') { if (v <= -40) crowd.push(a); else complain(w, X, T, a); }
            }
            // 抗議要有群眾基礎：討厭的人至少兩成或已經有人被害；同一樣東西 30 天一次、全鎮一週最多一場
            const A0 = Object.values(X.att[T.id]); const hateN = A0.filter(v => v <= -40).length; const vict = Object.values(X.victims).some(x => x.id === T.id);
            if (crowd.length && !(vict || (A0.length && hateN / A0.length >= 0.2))) { for (const a of crowd) complain(w, X, T, a); crowd.length = 0; }
            if (crowd.length && d - (T.protest?.day ?? -99) >= 30 && d - (X.lastProtest ?? -99) >= 7) { X.lastProtest = d;
                // 帶頭的人去找看法相近的朋友、鄰居一起去；交情越好、越討厭的人越可能跟
                callOut(w, X, T, crowd, d); // 跟不跟由每個人自己決定,隔天才集合
            }
            press(w, X, T, d); opinionBan(w, X, T, d);
            try { factionPull(w, X, T); const cs2 = camps(w, X, T); boycottTick(w, X, T, d); pressMayor(w, X, T, d, cs2); tide(w, X, T, d, cs2); } catch (e) { console.warn('[Things] opinion', e); }
            for (const id of Object.keys(X.att[T.id])) if (!w.agents[id] && !w.isAway?.(id)) { delete X.att[T.id][id]; delete X.why[T.id][id]; }
        }
        rescue(w, X, d);
        for (const k of Object.keys(X.quit)) if (X.quit[k] < d - 30) delete X.quit[k];
        for (const T of Object.values(X.list)) if (T.gone && d - (T.goneDay || d) > 120) { delete X.list[T.id]; delete X.att[T.id]; delete X.why[T.id]; }
    }
    // ---------- 給 AI、介面 ----------
    function brief(w, a) {
        const X = w.things; if (!X) return ''; const out = [];
        for (const T of Object.values(X.list || {})) { if (T.gone) continue; const v = X.att?.[T.id]?.[a.agentId]; if (v == null || Math.abs(v) < 25) continue; const why = X.why?.[T.id]?.[a.agentId]; let ws = ''; try { ws = why ? Memory.render(why.k, why.p) : ''; } catch (e) {} out.push(`${t('你對{t}的看法').replace('{t}', nm(T))}${t('：')}${v >= 60 ? t('很喜歡') : v >= 25 ? t('還算喜歡') : v <= -60 ? t('很討厭') : t('不太喜歡')}${ws ? `${t('（')}${ws}${t('）')}` : ''}`); }
        return out.slice(0, 3).join(t('；'));
    }
    function view(w) {
        const X = w.things; if (!X) return [];
        return Object.values(X.list || {}).filter(T => !T.gone).map(T => { const A = Object.entries(X.att[T.id] || {}).filter(([id]) => w.agents[id]); const vs = A.map(x => x[1]); return { id: T.id, icon: T.icon, name: nm(T), love: vs.filter(v => v >= 40).length, like: vs.filter(v => v >= 10 && v < 40).length, meh: vs.filter(v => v > -10 && v < 10).length, dislike: vs.filter(v => v <= -10 && v > -40).length, hate: vs.filter(v => v <= -40).length, n: vs.length, protest: T.protest, silent: silentN(w, X, T), boycott: T.boycott && day(w) <= T.boycott.until ? { lead: t(w.agents[T.boycott.lead]?.name || ''), left: T.boycott.until - day(w) } : null, stance: T.stance ? { side: T.stance.side, who: t(w.agents[T.stance.who]?.name || '') } : null, consensus: T.consensus || 0, flip: T.maj || 0, quotes: A.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 2).map(([id, v]) => { const why = X.why[T.id]?.[id]; let s = ''; try { s = why ? Memory.render(why.k, why.p) : ''; } catch (e) {} return { who: t(w.agents[id].name), v, s }; }) }; });
    }
    return { S, register, retire, get, live, att, feel, victim, useMult, buyMult, camps, splitIssue, quitting, daily, flush, vote, enact, brief, view, ruleAtt, prefs, gather, goTonight, tick, syncMap, HOOKS, WHY, actInfo, actBy, rallyInfo, rallyBy, rescueInfo, rescueBy };
})();
// ---------- 接上其他系統 ----------
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { thing_ban: { icon: '🚫', label: '禁止新東西' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { thing_hurt: '我家被它害慘了', thing_bad: '這東西對鎮上不好', thing_good: '這東西對鎮上有好處', thing_mine: '這是我的心血' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { THINGS.daily(w); } catch (e) { console.warn('[Things] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'thing_ban') { const r = THINGS.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = THINGS.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof Agent !== 'undefined') {
    const AP = Agent.prototype; const _dl = AP._decideLocation;
    AP._decideLocation = function (...args) { const r = _dl.apply(this, args); if (this._thingAt && !this.isDead && !this._ceremony) { this.targetLocation = this._thingAt; this.activity = 'socializing'; } return r; };
}
if (typeof World !== 'undefined') {
    const _tick = World.prototype.tick;
    World.prototype.tick = function (...args) { const r = _tick.apply(this, args); try { if (this.things) THINGS.tick(this); } catch (e) {} return r; };
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.things = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.things) d.things = this.things; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.things = (data?.things && typeof data.things === 'object') ? data.things : null; } catch (e) {} return r; };
}
// v9.9.1 新開的店:抗議到最後可以提案勒令歇業(以前只有賭場能被禁,其他店的禁止提案永遠提不出來)
THINGS.HOOKS.shop = {
    alive: (w, T) => { try { return (w.biz?.shops || []).some(s => 'shop:' + s.id === T.id && !s.closed); } catch (e) { return true; } },
    ban: (w, T) => { try { const sh = (w.biz?.shops || []).find(s => 'shop:' + s.id === T.id && !s.closed); if (!sh || typeof BIZ === 'undefined') return ''; BIZ.close(w, sh, 'banned'); const o = w.agents[sh.owner];
        w.logMessageT?.('social', '🚫 小鎮投票決定讓「{n}」歇業，{o}只好收攤。', { n: sh.name[0], o: o?.name || '' }, o?.name || ''); if (o) { o.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '我的店「{n}」被鎮上投票勒令歇業了。', { n: sh.name[0] }, 9, []); o.moodModifier = (o.moodModifier || 0) - 10; }
        return `${t('勒令歇業')}${t('：')}${sh.name[0]}`; } catch (e) { return ''; } },
};
if (typeof globalThis !== 'undefined') globalThis.THINGS = THINGS;
