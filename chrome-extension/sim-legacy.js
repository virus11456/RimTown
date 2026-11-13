// v6.73.0 歷史與傳承:史書、家族與世仇、傳說人物
// - 史書:每季結束由史官(研究員或最有學問的人)寫一章編年史,收錄這一季的大事(完整智能體模式由 AI 撰寫,否則依大事編排)
// - 家族:同姓的人是一家;三人以上的家族有家訓、家族名聲;兩家人結下的仇多了就成了世仇,代代相傳;兩家聯姻可以化解
// - 傳說:過世的名人(首長、國王、宗教領袖、傳世傑作的作者、創業有成的人…)成為傳說,大家會提起,鎮上可能為他立像
const LEGACY = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const ai = (w) => { const ce = w.conversationEngine; return w.fullAgentMode && ce?.fullAgentOk?.(w) && ce._askJson ? ce : null; };
    const SEASONS = ['春季', '夏季', '秋季', '冬季'];
    function S(w) { if (!w.legacy || !Array.isArray(w.legacy.chapters)) w.legacy = { chapters: [], legends: [], roles: {}, families: {}, feuds: [], lastSeason: null, lastGrave: (w.lifecycle?.graveyard || []).length, lastDay: null }; const L = w.legacy; L.roles = L.roles || {}; L.families = L.families || {}; return L; }
    const surname = (a) => String(a?.name || '').slice(0, 1);
    // ---------- 史書 ----------
    const BIG = /撐過了|失傳|文明倒退|政變|加冕|婚禮|倒閉|翻案|起義|繼承|聖物|結盟|禁運|擠兌|升格|分裂|異端|創立|傳世|傳說|駕崩|離世|當選|coup|crown|wedding|collapse|overturn|uprising|alliance|embargo|grown|schism|founded|masterpiece|died|elected|rediscovered|regress|survived/i;
    function seasonEvents(w) { return (w.messageLog || []).slice(-400).map(m => String(m.content || '')).filter(s => BIG.test(s)).slice(-8); }
    async function chapter(w, L, year, season) {
        const evs = seasonEvents(w); const scribe = npcs(w).filter(a => a.job?.key === 'researcher').sort(() => Math.random() - 0.5)[0] || npcs(w).find(a => a.job?.key === 'priest') || npcs(w)[0]; if (!scribe) return null;
        let title = { k: '第 {y} 年{s}', p: { y: year, s: season } }, text = evs.length ? { k: '這一季鎮上發生了：{list}', p: { list: evs.slice(-5).map(s => s.replace(/^[^\p{L}\p{N}]+/u, '')).join(' / ') } } : { k: '這一季風平浪靜，大家過著平常的日子。', p: {} };
        const ce = ai(w);
        if (ce && evs.length) { try { const prompt = `${t('你是小鎮的史官')}${scribe.name}${t('。請用史書的口吻，把這一季的大事寫成一段編年史（60 字內），並給這一章一個標題（10 字內）。大事')}${t('：')}${evs.join(' / ')}${t('。只輸出 JSON')}${t('：')}{"title":"...","text":"..."}`; ce._countNpcLlmUse?.(w); const j = await ce._askJson(prompt, 220); if (j?.text) { text = { k: '{x}', p: { x: LLMClient.clip(j.text, 160) } }; if (j.title) title = { k: '{x}', p: { x: LLMClient.clip(j.title, 24, 70, true) } }; } } catch (e) {} }
        const C = { year, season, by: scribe.name, title, text, n: evs.length };
        L.chapters.push(C); if (L.chapters.length > 24) L.chapters.shift();
        log(w, 'system', '📚 史官{a}寫下了鎮史新的一章〈{t}〉。', { a: scribe.name, t: title }, scribe.name);
        mem(w, scribe, '我替鎮上寫了新的一章歷史。', {}, 6);
        return C;
    }
    // ---------- 名人登記與傳說 ----------
    function roleOf(w, a) {
        try { const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; if (k === a) return '國王'; } catch (e) {}
        try { const b = TIERS.badge(w, a); if ((b && b.cls === 'leader') || w.election?.currentMayor?.(w) === a) return TIERS.leaderTitle(w); } catch (e) {} // 官職標籤要等等級系統跑過一天;現任首長直接算
        try { if (typeof FAITH2 !== 'undefined' && FAITH2.headRel(w, a)) return '宗教領袖'; } catch (e) {}
        try { if ((w.culture?.works || []).some(x => x.by === a.agentId && x.legend)) return '藝術家'; } catch (e) {}
        try { if ((w.biz?.shops || []).some(s => s.owner === a.agentId && s.profit >= 200)) return '富商'; } catch (e) {}
        try { if ((TIERS.S(w).career[a.agentId] || []).some(c => c.role === 'leader')) return '前首長'; } catch (e) {}
        return null;
    }
    function register(w, L) { for (const a of npcs(w)) { const r = roleOf(w, a); if (r) L.roles[a.name] = { role: r, fam: surname(a) }; } }
    function legends(w, L, d) {
        const g = w.lifecycle?.graveyard || []; if (g.length <= (L.lastGrave || 0)) { L.lastGrave = g.length; return; }
        const dead = g.slice(L.lastGrave || 0); L.lastGrave = g.length;
        for (const x of dead) {
            const R = L.roles[x.name]; if (!R || L.legends.some(l => l.name === x.name)) continue;
            const lg = { name: x.name, role: R.role, day: d, fam: R.fam, statue: false };
            L.legends.push(lg); if (L.legends.length > 12) L.legends.shift();
            log(w, 'system', '🏛️ {a}（{r}）走了，成為小鎮的傳說。', { a: x.name, r: R.role }, x.name);
            incident(w, 'hero', x.name, { a: x.name, r: R.role, f: R.fam }); // v9.9.2 事蹟會越傳越神
            for (const o of npcs(w)) if (Math.random() < 0.3) mem(w, o, '大家都在懷念{a}，他是鎮上的傳奇。', { a: x.name }, 6);
            // 公庫寬裕就立像
            const tr = w.stockpile?.get?.('silver') || 0;
            if (tr >= 150) { w.stockpile.consume('silver', 80, w.tickCount, t('立像紀念'), 'upkeep'); /* v8.8.0 雕像工錢付給本地工匠 */ lg.statue = true; const P = w.proposals; if (P) { const Lm = P.landmarks || (P.landmarks = []); const sn = `${x.name}像`; /* v9.7.0 修：以前存成模板物件，名牌顯示 [object Object] */ statueName(sn, x.name); Lm.push({ name: sn, of: x.name, icon: '🗽', by: t('全鎮'), id: 'LG' + d, day: d }); if (Lm.length > 6) Lm.splice(0, Lm.length - 6); } log(w, 'system', '🗽 全鎮出錢在廣場為{a}立像。', { a: x.name }); }
        }
    }
    // ---------- 家族與世仇 ----------
    const MOTTO = [['勤儉持家', 'Thrift and hard work'], ['以誠待人', 'Deal honestly with all'], ['寧折不彎', 'Break, but never bend'], ['和氣生財', 'Harmony brings fortune'], ['讀書明理', 'Learn and understand'], ['一家同心', 'One family, one heart'], ['有恩必報', 'Repay every kindness'], ['不忘根本', 'Never forget our roots']];
    for (const m of MOTTO) { try { I18N.registerName(m[0], m[1]); } catch (e) {} }
    function families(w, L) {
        const groups = {}; for (const a of npcs(w)) { const s = surname(a); if (s) (groups[s] || (groups[s] = [])).push(a); }
        for (const [s, ms] of Object.entries(groups)) {
            if (ms.length < 3) continue; const F = L.families[s] || (L.families[s] = { name: s, motto: null, rep: 0, since: day(w) });
            const eld = ms.slice().sort((x, y) => (y.age || 0) - (x.age || 0))[0]; F.head = eld.name; // 用最年長的人代表這一家(英文名沒有姓氏;單字姓氏也不能登記成名字,會弄壞人名翻譯)
            if (!F.motto) { F.motto = MOTTO[Math.floor(Math.random() * MOTTO.length)]; log(w, 'social', '🏠 {a}一家立下家訓：「{m}」', { a: F.head, m: F.motto[0] }); for (const a of ms) mem(w, a, '我們家的家訓是「{m}」。', { m: F.motto[0] }, 6); }
            let rep = 0; for (const a of ms) { const r = w.dark?.rep?.[a.agentId] || {}; rep += (r.helped || 0) + (r.forgave || 0) - (r.exposed || 0) * 2; try { rep += CLASS.level(w, a) - 1; } catch (e) {} } F.rep = rep; F.n = ms.length;
        }
        // 世仇:兩家人之間互相看不順眼的組合多了
        const names = Object.keys(L.families);
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
            const A = groups[names[i]] || [], B = groups[names[j]] || []; if (!A.length || !B.length) continue;
            let bad = 0, wed = false; for (const a of A) for (const b of B) { if (aff(a, b) <= -40) bad++; const st = a.relationships?.relationships?.[b.agentId]?.status; if (st === 'married') wed = true; }
            const key = [names[i], names[j]].sort().join('|'); const ex = L.feuds.find(f => f.key === key && !f.ended);
            if (!ex && bad >= 2 && !wed) { const ha = L.families[names[i]]?.head || A[0].name, hb = L.families[names[j]]?.head || B[0].name; L.feuds.push({ key, a: names[i], b: names[j], ha, hb, since: day(w), ended: false }); log(w, 'social', '⚔️ {a}一家和{b}一家結下了世仇。', { a: ha, b: hb }); for (const x of [...A, ...B]) mem(w, x, '我們家跟{o}一家是世仇。', { o: A.includes(x) ? hb : ha }, 7); }
            if (ex && wed) { ex.ended = true; log(w, 'social', '💞 {a}一家和{b}一家聯姻，化解了多年的世仇。', { a: ex.ha || names[i], b: ex.hb || names[j] }); }
            if (ex && !ex.ended) for (const a of A) for (const b of B) if (Math.random() < 0.1) { a.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(-1); }
        }
    }
    // v9.7.0 雕像名登記英文；舊存檔裡存成 {k,p} 模板物件的地標名修回文字
    function statueName(sn, of) { try { I18N.registerName(sn, `Statue of ${I18N.localizeNames(of, true)}`); } catch (e) {} }
    function fixLandmarks(w) {
        for (const x of (w?.proposals?.landmarks || [])) {
            if (x && x.name && typeof x.name === 'object') { const p = x.name.p || {}; x.of = x.of || p.a; x.name = String(x.name.k || '').replace(/\{(\w+)\}/g, (m, k) => p[k] ?? m); }
            if (x && x.of && typeof x.name === 'string') statueName(x.name, x.of);
        }
    }
    async function daily(w) {
        const L = S(w), d = day(w); if (L.lastDay === d) return; L.lastDay = d;
        register(w, L); legends(w, L, d); try { loreDaily(w, d); } catch (e) { console.warn('[Lore] daily', e); }
        if (d % 5 === 0) families(w, L);
        const si = Math.floor((d - 1) / 15); if (L.lastSeason === null) L.lastSeason = si;
        if (si > L.lastSeason) { const prevIdx = L.lastSeason; L.lastSeason = si; const year = Math.floor(prevIdx / 4) + 1, season = SEASONS[prevIdx % 4]; await chapter(w, L, year, season); }
    }
    function famOf(w, a) { const L = w.legacy; return L ? L.families[surname(a)] || null : null; }
    function brief(w, a) {
        const L = w.legacy; if (!L) return ''; const F = famOf(w, a); const out = [];
        if (F) { out.push(`${t('你是{f}一家的人').replace('{f}', t(F.head || a.name))}${F.motto ? `${t('，')}${t('家訓')}${t('「')}${t(F.motto[0])}${t('」')}` : ''}`); const fe = L.feuds.filter(x => !x.ended && (x.a === F.name || x.b === F.name)).map(x => (x.a === F.name ? (x.hb || x.b) : (x.ha || x.a))); if (fe.length) out.push(t('跟{o}一家是世仇').replace('{o}', fe.map(n => t(n)).join(t('、')))); }
        try { const lb = loreBrief(w, a); if (lb) out.push(lb); } catch (e) {}
        return out.join(t('；'));
    }
    function townBrief(w) { const L = w.legacy; if (!L || !L.legends.length) return ''; return `${t('鎮上的傳說人物')}${t('：')}${L.legends.slice(-3).map(l => `${t(l.name)}${t('（')}${t(l.role)}${t('）')}`).join(t('、'))}`; }
    function view(w) { const L = S(w); return { chapters: L.chapters.slice(-4).reverse().map(c => ({ title: Memory.render(c.title.k, c.title.p), text: Memory.render(c.text.k, c.text.p), by: t(c.by) })), legends: L.legends.slice(-5).reverse().map(l => ({ name: t(l.name), role: t(l.role), statue: l.statue })), families: Object.values(L.families).filter(f => f.motto).sort((a, b) => (b.rep || 0) - (a.rep || 0)).slice(0, 5).map(f => ({ name: en() ? `${t(f.head || '')}'s family` : `${f.name}家`, motto: t(f.motto[0]), rep: f.rep || 0, n: f.n || 0 })), feuds: L.feuds.filter(f => !f.ended).map(f => en() ? `${t(f.ha || f.a)}'s family ⚔️ ${t(f.hb || f.b)}'s family` : `${f.a}家 ⚔️ ${f.b}家`), lore: loreView(w) }; }
    // ---------- v9.9.2 傳說與迷信 ----------
    // 大事過後留下一個說法(失火的地方「不乾淨」、天災是「老天發怒」、過世的名人越傳越神),村民口耳相傳,每轉述一次可能更誇張;
    // 信的人會改變去處、湊錢做法事或獻祭、敬重傳奇人物的家人;不信邪的人會闢謠;同一處再出事就「應驗」,信的人更多
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
    const LORE = {
        curse: { icon: '👻', v: ['{p}前陣子失過火。', '聽說{p}那邊不太乾淨，晚上最好別去。', '{p}被詛咒了，去過的人都會倒楣。', '{p}底下壓著冤魂，半夜還聽得到哭聲。'] },
        wrath: { icon: '⛈️', v: ['{x}來得又急又兇。', '老人說{x}是老天在發怒。', '要是不獻上供品，{x}還會再來。', '有人看到天上裂開一道縫，說下一次{x}會帶走一個孩子。'] },
        hero: { icon: '🌟', v: ['{a}生前是鎮上的{r}。', '{a}一個人扛起了整個小鎮。', '聽說{a}當年徒手擋下過洪水。', '有人說{a}其實沒死，月圓的晚上會回來看看小鎮。'] },
    };
    const loreT = (Lo, v) => ({ k: LORE[Lo.kind].v[Math.max(0, Math.min(3, v ?? Lo.max))], p: Lo.p });
    const loreS = (w) => { const L = S(w); if (!Array.isArray(L.lore)) L.lore = []; return L.lore; };
    // 容不容易信:虔誠、年紀大、愛講八卦的容易信;重視知識、研究員醫生、相信科技的人不容易信
    function prior(w, a) {
        let p = 0.1;
        try { if (typeof FAITH !== 'undefined' && w.faith && FAITH.relOf(w, a)) p += FAITH.pietyOf(w, a) / 200; } catch (e) {}
        p -= (w.mind?.op?.[a.agentId]?.tech || 0) * 0.12;
        if (has(a, 'gossip')) p += 0.12; if ((a.age || 30) >= 60) p += 0.1; if ((a.age || 30) < 14) p += 0.15;
        if ((a.personality?.values || []).some(v => v === '知識' || v === t('知識'))) p -= 0.35;
        if (['researcher', 'doctor', 'teacher'].includes(a.job?.key)) p -= 0.25;
        return clamp(p, -0.7, 0.8);
    }
    function hear(w, Lo, a, v, from) {
        if (!a || a.isDead) return; const h = Lo.hd[a.agentId];
        const b0 = clamp(prior(w, a) + v * 0.12 + Lo.hit * 0.1 + (from ? (Lo.hd[from.agentId]?.[1] || 0) * 0.25 + Math.max(0, aff(a, from)) / 400 : 0));
        if (h) { h[1] = clamp(h[1] * 0.7 + b0 * 0.3 + 0.04); if (v > h[0]) h[0] = v; return; }
        Lo.hd[a.agentId] = [v, b0, 0]; mem(w, a, b0 >= 0.15 ? '我聽說「{x}」。' : '有人說「{x}」，我才不信。', { x: loreT(Lo, v) }, 5);
    }
    const heard = (w, Lo) => Object.entries(Lo.hd).map(([id, h]) => [w.agents[id], h]).filter(([a]) => a && !a.isDead);
    const believers = (w, Lo, th = 0.45) => heard(w, Lo).filter(([, h]) => h[1] >= th).map(([a]) => a);
    // 出事:同一處/同一種災再出事就應驗;否則留下新的說法
    function incident(w, kind, key, p) {
        try {
            if (!w.observerMode) return null; const LL = loreS(w), d = day(w);
            const ex = LL.find(x => !x.done && x.kind === kind && x.key === key);
            if (ex) {
                ex.hit++; ex.last = d; const was = ex.max; ex.max = Math.min(3, ex.max + 1); if (p) Object.assign(ex.p, p);
                for (const [, h] of heard(w, ex)) { h[1] = clamp(h[1] + 0.25); h[0] = Math.max(h[0], ex.max); }
                if (kind !== 'hero') log(w, 'social', '😨 「{x}」應驗了！又出事了，信的人更多了。', { x: loreT(ex, was) });
                return ex;
            }
            if (LL.filter(x => !x.done).length >= 5) return null;
            const L0 = S(w); L0.loreN = (L0.loreN || 0) + 1; const Lo = { id: 'LO' + L0.loreN, kind, key, p: Object.assign({}, p || {}), day: d, last: d, max: 1, hit: 0, hd: {}, rite: null, av: 0, deb: 0 };
            LL.push(Lo); while (LL.length > 10) { const i = LL.findIndex(x => x.done); LL.splice(i >= 0 ? i : 0, 1); }
            const seeds = npcs(w).sort((x, y) => prior(w, y) - prior(w, x) + (Math.random() - 0.5) * 0.3).slice(0, 3);
            for (const a of seeds) hear(w, Lo, a, 1, null);
            log(w, 'social', '{i} 出事之後，鎮上開始有人說：「{x}」', { i: LORE[kind].icon, x: loreT(Lo, 1) }, seeds[0]?.name || '');
            return Lo;
        } catch (e) { console.warn('[Lore] incident', e); return null; }
    }
    const friendOf = (w, a) => { const R = a.relationships?.relationships || {}; const ids = Object.keys(R).filter(id => (R[id].affinity || 0) >= 10 && w.agents[id] && !w.agents[id].isDead && !w.agents[id].isPlayer); return ids.length ? w.agents[ids[Math.floor(Math.random() * ids.length)]] : null; };
    // 口耳相傳:信的人講給朋友聽,愛八卦、有創意的人講得更誇張;不信的人闢謠
    function spread(w, Lo, d) {
        let told = 0;
        for (const [a, h] of heard(w, Lo).sort(() => Math.random() - 0.5)) {
            if (told >= 8) break; const b = h[1];
            if (b >= 0.15 && Math.random() < 0.12 + (has(a, 'gossip') ? 0.15 : 0) + (has(a, 'charismatic') ? 0.05 : 0)) {
                const o = friendOf(w, a); if (!o) continue; told++; Lo.last = d;
                let v = h[0]; if (v < 3 && Math.random() < 0.15 + (has(a, 'gossip') || has(a, 'creative') ? 0.17 : 0)) v++;
                hear(w, Lo, o, v, a); if (v > h[0]) h[0] = v; // 講的人也記得自己加油添醋的版本
                if (v > Lo.max) { Lo.max = v; log(w, 'social', '🗯️ 傳說越傳越走樣：現在鎮上說「{x}」', { x: loreT(Lo, v) }, a.name); }
            } else if (b <= -0.25 && Math.random() < 0.15) {
                const o = friendOf(w, a); const oh = o && Lo.hd[o.agentId]; if (!oh || oh[1] < 0.15) continue; told++;
                oh[1] = clamp(oh[1] - 0.2 - (a.job?.key === 'researcher' || a.job?.key === 'doctor' ? 0.1 : 0));
                mem(w, o, '{a}說「{x}」根本是迷信。', { a: a.name, x: loreT(Lo, oh[0]) }, 4);
                if (d - (Lo.deb ?? -99) >= 12) { Lo.deb = d; log(w, 'social', '🧐 {a}說「{x}」根本是迷信，勸{b}別當真。', { a: a.name, b: o.name, x: loreT(Lo, oh[0]) }, a.name); }
            }
        }
    }
    // 做法事(凶地)/獻祭(天災):信的人夠多就湊錢,錢進宗教基金(沒有宗教就進公庫);晚上一起去
    function rite(w, Lo, d) {
        if (Lo.kind === 'hero' || Lo.rite || Lo.max < (Lo.kind === 'curse' ? 1 : 2)) return;
        const bs = believers(w, Lo, 0.45); if (bs.length < 3) return;
        let R = null, host = null;
        try { if (typeof FAITH !== 'undefined' && w.faith) { const cnt = {}; for (const a of bs) { const r = FAITH.relOf(w, a); if (r) cnt[r.id] = (cnt[r.id] || 0) + 1; } const top = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]; R = top && w.faith.rels.find(r => r.id === top[0]); if (R && typeof FAITH2 !== 'undefined') host = FAITH2.headOf(w, R); } } catch (e) {}
        host = host || bs.slice().sort((x, y) => (Lo.hd[y.agentId][1] - Lo.hd[x.agentId][1]) || ((y.age || 0) - (x.age || 0)))[0];
        let sum = 0; for (const a of bs) { if (typeof WALLET === 'undefined' || !w.wallet) break; const n = Math.round(Math.min(3, WALLET.get(w, a) * 0.05) * 100) / 100; if (n >= 0.5 && WALLET.take(w, a, n)) sum += n; }
        sum = Math.round(sum * 100) / 100; if (sum > 0) { if (R) R.fund = Math.round(((R.fund || 0) + sum) * 100) / 100; else w.stockpile?.add?.('silver', sum, w.tickCount, t('祭祀供品')); }
        const locs = w.townMap?.locations || {}; const place = Lo.kind === 'curse' && locs[Lo.key] ? Lo.key : locs.chapel ? 'chapel' : 'town_square';
        const h0 = w.clock?.hour ?? 0, m0 = w.clock?.minute ?? 0; const base = w.tickCount - h0 * 4 - Math.floor(m0 / 15);
        for (const a of new Set([host, ...bs])) { if (!a._ceremony) a._thingGo = { place, from: base + 19 * 4, until: base + 21 * 4, why: 'rite', id: Lo.id }; a.moodModifier = (a.moodModifier || 0) + 3; }
        Lo.rite = { day: d, n: bs.length, sum, host: host?.name || '' };
        if (Lo.kind === 'curse') {
            for (const a of bs) { const h = Lo.hd[a.agentId]; h[1] = clamp(h[1] * 0.4); }
            log(w, 'social', '🕯️ {h}帶著{n}個人湊了{m}銀幣，在{p}做法事驅邪；信的人說那裡乾淨了。', { h: host?.name || '', n: bs.length, m: sum, p: Lo.p.p }, host?.name || '');
        } else {
            log(w, 'social', '🙏 {h}帶著{n}個村民湊了{m}銀幣獻上供品，求{x}別再來。', { h: host?.name || '', n: bs.length, m: sum, x: Lo.p.x }, host?.name || '');
        }
        for (const [a, h] of heard(w, Lo)) if (h[1] <= -0.25 && Math.random() < 0.3) mem(w, a, '他們湊錢做那些儀式，真是迷信。', {}, 4);
    }
    // 信的人怎麼做:凶地不去(工作照去但心裡發毛);傳奇人物的家人受敬重
    function act(w, Lo, d) {
        if (Lo.kind === 'curse') {
            for (const [a, h] of heard(w, Lo)) if (h[1] >= 0.55 && a.job?.workplace === Lo.key) { a.moodModifier = (a.moodModifier || 0) - 1; if (!(h[2] & 2)) { h[2] |= 2; mem(w, a, '每天在{p}上工都心裡發毛。', { p: Lo.p.p }, 5); } }
        } else if (Lo.kind === 'hero') {
            const fam = npcs(w).filter(o => surname(o) === Lo.p.f);
            for (const [a, h] of heard(w, Lo)) if (h[1] >= 0.4 && !(h[2] & 4)) { h[2] |= 4; for (const o of fam) if (o !== a) { try { a.relationships.getOrCreate(o.agentId, o.name).modifyAffinity(3); } catch (e) {} } }
        } else if (Lo.kind === 'wrath' && Lo.rite && !Lo.rite.out && d - Lo.rite.day >= 45) {
            Lo.rite.out = 'calm'; for (const [, h] of heard(w, Lo)) if (h[1] > 0) h[1] = clamp(h[1] + 0.15);
            log(w, 'social', '☀️ 獻祭之後{x}沒有再來，信的人說老天息怒了。', { x: Lo.p.x }); Lo.done = true;
        }
    }
    // 天災又來:獻過祭的,虔誠的人說心不夠誠(更誇張),其他人開始不信
    function wrathAgain(w, Lo) {
        if (!Lo.rite || Lo.rite.out) return false; Lo.rite.out = 'again';
        for (const [, h] of heard(w, Lo)) { if (h[1] >= 0.6) { h[1] = clamp(h[1] + 0.1); h[0] = 3; } else h[1] = clamp(h[1] - 0.35); }
        Lo.max = 3; log(w, 'social', '😟 獻了供品，{x}還是來了；有人說心不夠誠，有人開始不信了。', { x: Lo.p.x }); return true;
    }
    function loreDaily(w, d) {
        const LL = loreS(w); const cur = {};
        for (const Lo of LL) {
            if (Lo.done) continue;
            for (const id of Object.keys(Lo.hd)) { if (!w.agents[id]) { delete Lo.hd[id]; continue; } Lo.hd[id][1] *= 0.992; }
            spread(w, Lo, d); rite(w, Lo, d); act(w, Lo, d);
            if (!Lo.done && d - Lo.last > 30 && d - Lo.day > 45) { Lo.done = true; if (Lo.max >= 2 && Lo.kind !== 'hero') log(w, 'social', '🍂 「{x}」漸漸沒人提了。', { x: loreT(Lo) }); }
            if (!Lo.done && Lo.kind === 'curse') cur[Lo.key] = Lo;
        }
        S(w)._cur = cur;
    }
    // 給 _decideLocation 用:這個人信不信那裡不乾淨(工作、回家不算)
    function avoid(w, a, place) {
        const Lo = w.legacy?._cur?.[place]; if (!Lo) return false; const h = Lo.hd[a.agentId]; if (!h || h[1] < 0.45) return false;
        if (place === a.job?.workplace || place === a.homeLocation) return false;
        Lo.av = (Lo.av || 0) + 1; if (!(h[2] & 1)) { h[2] |= 1; mem(w, a, '我不敢去{p}，聽說那裡不乾淨。', { p: Lo.p.p }, 5); }
        return true;
    }
    function loreBrief(w, a) {
        const LL = w.legacy?.lore; if (!LL) return ''; const out = [];
        for (const Lo of LL.slice().reverse()) { if (Lo.done) continue; const h = Lo.hd[a.agentId]; if (!h) continue; out.push(`${t('你聽人說')}${t('「')}${Memory.render(LORE[Lo.kind].v[h[0]], Lo.p)}${t('」')}${t('（')}${t(h[1] >= 0.5 ? '你深信不疑' : h[1] >= 0.15 ? '你半信半疑' : '你覺得是迷信')}${t('）')}`); if (out.length >= 2) break; }
        return out.join(t('；'));
    }
    function loreView(w) {
        return (w.legacy?.lore || []).filter(Lo => !Lo.done || day(w) - Lo.last <= 20).slice(-5).reverse().map(Lo => { const H = heard(w, Lo); return { icon: LORE[Lo.kind].icon, text: Memory.render(LORE[Lo.kind].v[Lo.max], Lo.p), believe: H.filter(([, h]) => h[1] >= 0.45).length, doubt: H.filter(([, h]) => h[1] <= -0.25).length, heard: H.length, rite: Lo.rite ? Lo.rite.n : 0, hit: Lo.hit, done: !!Lo.done }; });
    }
    return { S, chapter, roleOf, register, legends, families, daily, famOf, brief, townBrief, view, surname, MOTTO, fixLandmarks, incident, wrathAgain, avoid, loreBrief, loreView, prior, LORE };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) LEGACY.daily(w); } catch (e) { console.warn('[Legacy] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief, _tb = CE._townBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = world.legacy && LEGACY.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    CE._townBrief = function (world) { const s = _tb.call(this, world); try { const b = LEGACY.townBrief(world); return b ? `${s}${t('；')}${b}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.legacy = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.legacy) d.legacy = this.legacy; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.legacy = (data?.legacy && Array.isArray(data.legacy.chapters)) ? data.legacy : null; } catch (e) {} try { if (r) LEGACY.fixLandmarks(this); } catch (e) {} return r; };
}
// v9.9.2 傳說:天災留下「老天發怒」的說法;信凶地的人不去那裡閒晃
if (typeof WeatherSystem !== 'undefined') {
    const _sd = WeatherSystem.prototype._startDisaster;
    WeatherSystem.prototype._startDisaster = function (type, world, ...rest) {
        const r = _sd.call(this, type, world, ...rest);
        try { if (world?.observerMode && this.activeDisaster) { const ex = (world.legacy?.lore || []).find(x => !x.done && x.kind === 'wrath' && x.key === type); if (!(ex && LEGACY.wrathAgain(world, ex))) LEGACY.incident(world, 'wrath', type, { x: this.activeDisaster.name }); } } catch (e) {}
        return r;
    };
}
if (typeof Agent !== 'undefined') {
    const AP = Agent.prototype; const _dl = AP._decideLocation;
    AP._decideLocation = function (...args) {
        const r = _dl.apply(this, args);
        try { const w = typeof window !== 'undefined' ? window.rimtownApp?.world : null; const tg = this.targetLocation;
            if (w?.legacy?._cur && tg && w.legacy._cur[tg] && !this._thingAt && !this._ceremony && !['working', 'commuting', 'sleeping', 'heading_home'].includes(this.activity) && LEGACY.avoid(w, this, tg)) this.targetLocation = tg === 'town_square' ? 'park' : 'town_square'; } catch (e) {}
        return r;
    };
}
if (typeof globalThis !== 'undefined') globalThis.LEGACY = LEGACY;
