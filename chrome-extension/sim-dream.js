// v6.72.0 你（上帝）與 AI
// - 爆不爆料:有人發現別人的祕密時,依交情與為人決定公開、幫忙掩護,或私下勒索(完整智能體模式由 AI 決定並說明理由)
// - 原諒的理由:道歉之後原不原諒,當事人用一句話說出理由(AI 撰寫;規則版依個性)
// - 禱詞:村民祈禱時,完整智能體模式由 AI 寫出真正的禱詞
// - 託夢:你寫一句話託夢給某人;他醒來依自己的個性解讀(可能誤解),據此行動,宗教領袖可能把它寫進教義
// - 預言:選舉或政變前押注結果,系統記下你的準確率(純觀察趣味)
const DREAM = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    function S(w) { if (!w.dream || !Array.isArray(w.dream.dreams)) w.dream = { dreams: [], bets: [], hits: 0, misses: 0, lastDream: -99, lastDay: null, choices: [] }; return w.dream; }
    // ---------- 爆不爆料 ----------
    function ruleChoice(w, f, c) {
        let honest = 3; try { honest = DARK.honesty(f); } catch (e) {}
        if (aff(f, c) >= 40 && Math.random() < 0.5) return { act: 'cover', why: '{c}是我的朋友，我不想毀了他。' };
        if (honest < 2.5 && cash(w, c) >= 40 && Math.random() < 0.4) return { act: 'blackmail', why: '這個祕密值不少錢。' };
        return { act: 'expose', why: honest >= 3.5 ? '做錯事就該讓大家知道。' : '這種事瞞不住的。' };
    }
    async function secrets(w, Sd, d) {
        if (typeof DARK === 'undefined') return; const D = DARK.S(w);
        for (const s of (D.secrets || [])) {
            if (!s.found || s.decided || !s.foundBy || d - (s.foundDay ?? d) > 1 || s.kind === 'white') continue; s.decided = true;
            const f = w.agents[s.foundBy], c = w.agents[s.culprit]; if (!f || !c || f === c) continue;
            let ch = ruleChoice(w, f, c); const ce = ai(w);
            if (ce) { try { const b = ce._agentBrief(w, f, c); const prompt = `${t('你是')}${b.name}${t('（')}${b.traits}${t('）。你發現了一個祕密')}${t('：')}${Memory.render(s.k, s.p)}${t('。你和')}${c.name}${t('的交情')} ${Math.round(aff(f, c))}${t('。要 expose（公開）、cover（幫忙掩護）還是 blackmail（私下勒索）？用一句話說理由。只輸出 JSON')}${t('：')}{"act":"expose","why":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 120); if (j && ['expose', 'cover', 'blackmail'].includes(j.act)) ch = { act: j.act, why: LLMClient.clip(j.why, 60), ai: true }; } catch (e) {} }
            const why = ch.ai ? { k: '{x}', p: { x: ch.why } } : { k: ch.why, p: { c: c.name } };
            if (ch.act === 'cover') {
                try { const r = w.dark.rep[c.agentId]; if (r && r.exposed) r.exposed = Math.max(0, r.exposed - 1); } catch (e) {}
                c.relationships.getOrCreate(f.agentId, f.name).modifyAffinity(15); const v = w.agents[s.victim]; if (v && v !== f) v.relationships.getOrCreate(f.agentId, f.name).modifyAffinity(-6);
                log(w, 'social', '🤐 {f}幫{c}掩護，跟大家說是誤會一場。🕵️「{why}」', { f: f.name, c: c.name, why }, f.name);
                mem(w, c, '{f}幫我把事情壓下來了，我欠他一次。', { f: f.name }, 7);
            } else if (ch.act === 'blackmail') {
                const n = Math.min(30, Math.floor(cash(w, c) * 0.4)); if (n > 0 && W()) WALLET.pay(w, c, f, n);
                try { DARK.secret(w, { kind: 'scheme', culprit: f.agentId, victim: c.agentId, k: '{f}拿{c}的把柄勒索了 {n} 銀幣', p: { f: f.name, c: c.name, n } }); } catch (e) {}
                c.relationships.getOrCreate(f.agentId, f.name).modifyAffinity(-25); mem(w, c, '{f}拿我的把柄勒索我。', { f: f.name }, 8);
                log(w, 'social', '💰 {f}私下拿{c}的把柄勒索。🕵️「{why}」', { f: f.name, c: c.name, why }, f.name);
            } else {
                try { DARK.bump(w, f, 'helped'); } catch (e) {}
                log(w, 'social', '📢 {f}決定公開{c}的事：「{why}」', { f: f.name, c: c.name, why }, f.name);
            }
            Sd.choices.push({ day: d, f: f.name, c: c.name, act: ch.act }); if (Sd.choices.length > 8) Sd.choices.shift();
        }
    }
    // ---------- 原諒的理由 ----------
    async function forgiveness(w, d) {
        if (typeof DARK === 'undefined') return; const D = DARK.S(w);
        const fresh = (D.wrongs || []).filter(x => x.last === d && !x.why && w.agents[x.by] && w.agents[x.to]).slice(0, 3); if (!fresh.length) return;
        const rule = (x) => { const b = w.agents[x.to]; return x.forgiven ? (has(b, 'kind') ? '人都會犯錯，我不想記恨。' : '他是真心的，我就給他一次機會。') : (has(b, 'jealous') || has(b, 'abrasive') ? '這種事哪是一句對不起就算了？' : '我需要一點時間。'); };
        const ce = ai(w); let lines = null;
        if (ce) { try { const list = fresh.map((x, i) => `${i + 1}. ${w.agents[x.to].name}${t(x.forgiven ? '原諒了' : '還不肯原諒')}${w.agents[x.by].name}`).join('\n'); const prompt = `${t('以下每一對村民，道歉之後一方原諒或不原諒。請用被道歉的人的口吻各寫一句理由（20 字內）。只輸出 JSON 陣列')}${t('：')}["..."]\n${list}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 160); if (Array.isArray(j)) lines = j; } catch (e) {} }
        fresh.forEach((x, i) => { const b = w.agents[x.to]; if (!b) return; /* v9.7.1 等 AI 回話時原諒的人已經離開或過世 */ const s = lines && typeof lines[i] === 'string' && lines[i].trim() ? { k: '{x}', p: { x: LLMClient.clip(LLMClient.unname(lines[i], b.name), 60) } } : { k: rule(x), p: {} }; x.why = s; log(w, 'social', '💬 {b}：「{s}」', { b: b.name, s }, b.name); mem(w, b, s.k, s.p, 5); });
    }
    // ---------- 禱詞 ----------
    async function prayers(w, d) {
        const F = w.faith; const ce = ai(w); if (!F || !ce) return;
        const fresh = Object.entries(F.prayers || {}).filter(([id, p]) => p.day === d && !p.text && w.agents[id]).slice(0, 3); if (!fresh.length) return;
        try { const list = fresh.map(([id, p], i) => { const a = w.agents[id]; const R = F.rels.find(r => r.id === p.rel); return `${i + 1}. ${a.name}${t('向')}${R ? R.deity[0] : ''}${t('祈求')}${t('：')}${t(p.wish)}`; }).join('\n'); const prompt = `${t('請替每位村民寫一句真誠的禱詞（25 字內，第一人稱）。只輸出 JSON 陣列')}${t('：')}["..."]\n${list}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 180);
            if (Array.isArray(j)) fresh.forEach(([id, p], i) => { if (typeof j[i] === 'string' && j[i].trim()) { p.text = LLMClient.clip(LLMClient.unname(j[i], w.agents[id]?.name), 70); log(w, 'social', '🙏 {a}的禱詞：「{x}」', { a: w.agents[id].name, x: p.text }, w.agents[id].name); } });
        } catch (e) {}
    }
    // ---------- 託夢 ----------
    const KEY = [[/蓋|建|造|build/i, 'build'], [/和好|原諒|道歉|forgive|reconcile/i, 'reconcile'], [/離開|遠方|出發|leave|journey/i, 'journey'], [/愛|喜歡|love/i, 'love'], [/錢|財|rich|money/i, 'wealth'], [/小心|危險|災|danger|beware/i, 'warning']];
    function ruleRead(text, a) { const k = (KEY.find(([re]) => re.test(text)) || [null, 'vague'])[1]; const wrong = (has(a, 'neurotic') || has(a, 'pessimist')) && Math.random() < 0.35; return { kind: wrong ? (k === 'warning' ? 'build' : 'warning') : k, wrong }; }
    async function send(w, agentId, text) {
        const Sd = S(w), d = day(w); const a = w.agents[agentId]; text = String(text || '').trim().slice(0, 80);
        if (!a || a.isDead || !text) return { ok: false, why: 'bad' }; if (d - Sd.lastDream < 1) return { ok: false, why: 'cooldown' };
        Sd.lastDream = d;
        mem(w, a, '我夢見有個聲音對我說：「{x}」', { x: text }, 9);
        let read = ruleRead(text, a), meaning = null; const ce = ai(w);
        if (ce) { try { const b = ce._agentBrief(w, a, null); const prompt = `${t('你是')}${b.name}${t('（')}${b.traits}${t('）。昨晚你夢見有個聲音對你說')}${t('：')}${t('「')}${text}${t('」')}${t('。依你的個性與處境，你怎麼解讀？可能誤會。用第一人稱一句話說你的解讀，並選一個行動類型：build、reconcile、journey、love、wealth、warning、vague。只輸出 JSON')}${t('：')}{"meaning":"...","kind":"vague"}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 140); if (j?.meaning) { meaning = LLMClient.clip(j.meaning, 70); if (KEY.some(([, k]) => k === j.kind) || j.kind === 'vague') read = { kind: j.kind, wrong: false }; } } catch (e) {} }
        const dr = { day: d, to: agentId, toName: a.name, text, kind: read.kind, wrong: read.wrong, meaning };
        Sd.dreams.push(dr); if (Sd.dreams.length > 10) Sd.dreams.shift();
        act(w, a, dr);
        log(w, 'social', '🌙 {a}醒來，想起昨晚的夢：「{x}」', { a: a.name, x: text }, a.name);
        if (meaning) log(w, 'social', '💭 {a}：「{m}」', { a: a.name, m: meaning }, a.name);
        try { if (typeof FAITH2 !== 'undefined' && FAITH2.headRel(w, a)) { const R = FAITH2.headRel(w, a); R.pre = [[text, text], ...(R.pre || []).slice(0, 2)]; log(w, 'social', '📖 {a}把夢裡的話寫進{r}的教誨。', { a: a.name, r: R.name[0] }, a.name); dr.doctrine = true; } } catch (e) {}
        try { if (typeof TRAVELER !== 'undefined' && w.traveler) TRAVELER.S(w).sus[a.agentId] = (TRAVELER.S(w).sus[a.agentId] || 0) + 1; } catch (e) {}
        return { ok: true, dream: dr };
    }
    function act(w, a, dr) {
        a.moodModifier = (a.moodModifier || 0) + (dr.kind === 'warning' ? -3 : 4);
        if (dr.kind === 'reconcile') { const foe = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity < 0 && w.agents[r.targetId]).sort((x, y) => x.affinity - y.affinity)[0]; if (foe) { a.relationships.getOrCreate(foe.targetId, foe.targetName).modifyAffinity(15); const o = w.agents[foe.targetId]; o?.relationships?.getOrCreate(a.agentId, a.name)?.modifyAffinity(8); log(w, 'social', '🕊️ {a}受夢啟發，主動去找{b}和好。', { a: a.name, b: o?.name || '' }, a.name); } }
        if (dr.kind === 'build' || dr.kind === 'wealth') { try { const P = w.proposals; if (P?._inventLLM && w.fullAgentMode && w.conversationEngine?.fullAgentOk?.(w)) P._inventLLM(w, P._abs(w), a, () => {}, [{ title: t('夢裡的啟示'), desc: dr.text }]); } catch (e) {} mem(w, a, '那個夢一定是要我做點什麼。', {}, 6); }
        if (dr.kind === 'love') { const c = Object.values(a.relationships?.relationships || {}).sort((x, y) => (y.romanticInterest || 0) - (x.romanticInterest || 0))[0]; if (c) { c.romanticInterest = Math.min(100, (c.romanticInterest || 0) + 15); mem(w, a, '那個夢讓我更確定自己喜歡{b}。', { b: c.targetName }, 7); } }
        if (dr.kind === 'warning') { mem(w, a, '夢裡的警告讓我很不安，最近要小心點。', {}, 7); for (const o of npcs(w)) if (o !== a && aff(o, a) >= 30 && Math.random() < 0.5) mem(w, o, '{a}說他做了個不祥的夢。', { a: a.name }, 5); }
        if (dr.kind === 'journey') mem(w, a, '夢裡叫我去遠方，我開始想離開這裡的事。', {}, 6);
        if (w.mind && a) { const A = w.mind.amb?.[a.agentId]; if (A && dr.kind === 'wealth') A.key = 'rich'; }
    }
    // ---------- 預言(押注) ----------
    function bet(w, kind, pick) { const Sd = S(w); const key = kind === 'election' ? 'E' + (w.election?.lastElectionDay ?? 0) + ':' + (w.election?.candidates || []).map(c => c.agentId).join(',') : 'C' + (w.crown?.plot?.start ?? 0); if (Sd.bets.some(b => b.key === key && !b.done)) return false; Sd.bets.push({ kind, key, pick, day: day(w), done: false }); if (Sd.bets.length > 20) Sd.bets.shift(); return true; }
    function settle(w, kind, outcome) { const Sd = S(w); for (const b of Sd.bets) if (!b.done && b.kind === kind) { b.done = true; b.outcome = outcome; b.hit = b.pick === outcome; if (b.hit) Sd.hits++; else Sd.misses++; try { w.logMessageT?.('system', b.hit ? '🔮 你的預言應驗了！' : '🔮 你的預言落空了。', {}); } catch (e) {} } }
    function accuracy(w) { const Sd = S(w); const n = Sd.hits + Sd.misses; return { hits: Sd.hits, misses: Sd.misses, pct: n ? Math.round(Sd.hits / n * 100) : null, open: Sd.bets.filter(b => !b.done) }; }
    async function daily(w) { const Sd = S(w), d = day(w); if (Sd.lastDay === d) return; Sd.lastDay = d; if (Sd.bets.some(b => b.kind === 'coup' && !b.done) && !w.crown?.plot) settle(w, 'coup', 'fail'); /* 密謀消失又沒改朝換代 = 失敗 */ await secrets(w, Sd, d); forgiveness(w, d); prayers(w, d); }
    function view(w) { const Sd = S(w); return { dreams: Sd.dreams.slice(-3).reverse().map(x => ({ to: t(x.toName), text: x.text, meaning: x.meaning, wrong: x.wrong })), acc: accuracy(w), choices: Sd.choices.slice(-3) }; }
    return { S, ruleChoice, secrets, forgiveness, prayers, send, act, ruleRead, bet, settle, accuracy, daily, view };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) DREAM.daily(w); } catch (e) { console.warn('[Dream] daily', e); } return r; };
}
// 選舉開票、政變結果 → 結算押注
if (typeof ElectionSystem !== 'undefined') {
    const ES = ElectionSystem.prototype; const _ar = ES._announceResults;
    ES._announceResults = function (world, ...rest) { const r = _ar.call(this, world, ...rest); try { if (r && world.dream) DREAM.settle(world, 'election', this.candidates?.[0]?.agentId || null); } catch (e) {} return r; };
}
if (typeof World !== 'undefined') {
    const _oc = World.prototype.onCrown;
    World.prototype.onCrown = function (a, how) { try { _oc?.call(this, a, how); } catch (e) {} try { if (this.dream && this.dream.bets.some(b => b.kind === 'coup' && !b.done)) DREAM.settle(this, 'coup', how === 'coup' ? 'success' : 'other'); } catch (e) {} };
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.dream = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.dream) d.dream = this.dream; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.dream = (data?.dream && Array.isArray(data.dream.dreams)) ? data.dream : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.DREAM = DREAM;
