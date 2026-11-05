// v6.61.0 宗教第二部:神職、加冕、分裂與異端、科技與信仰衝突
// - 每個宗教有一位領袖(優先祭司,其次最虔誠的信徒),稱號依骨架與城鎮等級(住持→方丈、神父→大主教…);領袖算士紳,城市以上算貴族
// - 加冕:國王由信徒最多的宗教領袖主持,不同信仰給不同正當性(聖油加冕、天命所歸、祖靈占卜…);領袖跟新王不合會拒絕主持
// - 分裂:有魅力或有主見的虔誠信徒跟領袖不合,可能自立新教派、帶走朋友;聖堂型與禮教型的領袖會指控他是異端,交付審判
// - 科技:新研究完成時,虔誠的保守信徒反對、領袖公開表態;越虔誠越難接受新觀念
const FAITH2 = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const reg = (zh, e) => { try { if (typeof I18N !== 'undefined') I18N.registerName(zh, e); } catch (x) {} };
    const tierLv = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const TITLE = { xiu: [['觀主', 'Abbot'], ['大真人', 'Grand Master']], chan: [['住持', 'Abbot'], ['方丈', 'Grand Abbot']], ling: [['巫者', 'Seer'], ['大巫', 'High Seer']], sheng: [['神父', 'Priest'], ['大主教', 'Archbishop']], zu: [['族老', 'Clan Elder'], ['大族長', 'Grand Elder']], li: [['講師', 'Lecturer'], ['山長', 'Headmaster']] };
    const RITE = { sheng: [10, '聖油加冕', 'anointed with holy oil'], li: [8, '依古禮登基', 'enthroned by the ancient rites'], xiu: [6, '天命所歸', 'the Mandate of Heaven'], ling: [5, '祖靈占卜得吉兆', 'a favorable spirit omen'], zu: [4, '告慰列祖列宗', 'announced to the ancestors'], chan: [3, '誦經祈福', 'blessed with sutras'] };
    for (const v of Object.values(TITLE)) for (const p of v) reg(p[0], p[1]); for (const v of Object.values(RITE)) reg(v[1], v[2]);
    const F = (w) => (typeof FAITH !== 'undefined' ? FAITH.S(w) : null);
    const title = (w, R) => TITLE[R.sk][tierLv(w) >= 2 ? 1 : 0];
    function headOf(w, R) { const f = w.faith; const id = f?.heads?.[R.id]; const a = id ? w.agents[id] : null; return a && !a.isDead && f.of[a.agentId]?.rel === R.id ? a : null; }
    function headRel(w, a) { const f = w.faith; if (!f?.heads || !a) return null; for (const R of f.rels) if (f.heads[R.id] === a.agentId && headOf(w, R) === a) return R; return null; }
    function pickHeads(w) {
        const f = F(w); if (!f) return; f.heads = f.heads || {};
        for (const R of f.rels) {
            if (headOf(w, R) && f.of[f.heads[R.id]]?.piety >= 40) continue;
            const bs = FAITH.believers(w, R); if (!bs.length) { delete f.heads[R.id]; continue; }
            const c = bs.filter(a => a.job?.key === 'priest').sort((x, y) => FAITH.pietyOf(w, y) - FAITH.pietyOf(w, x))[0] || bs.filter(a => FAITH.pietyOf(w, a) >= 70 && a.age >= 25).sort((x, y) => FAITH.pietyOf(w, y) - FAITH.pietyOf(w, x))[0];
            if (!c) { delete f.heads[R.id]; continue; }
            f.heads[R.id] = c.agentId; const tt = title(w, R);
            log(w, '⛪ {a}成為{r}的{t}。', { a: c.name, r: R.name[0], t: tt[0] }, c.name);
            mem(w, c, '我成了{r}的{t}，信徒們都看著我。', { r: R.name[0], t: tt[0] }, 8);
        }
    }
    // 分裂與異端
    function schism(w, d) {
        const f = F(w); if (!f || f.rels.length >= 5) return;
        for (const R of f.rels.slice()) {
            const h = headOf(w, R); if (!h) continue; const bs = FAITH.believers(w, R); if (bs.length < 4) continue;
            const c = bs.filter(a => a !== h && FAITH.pietyOf(w, a) >= 60 && (has(a, 'charismatic') || has(a, 'creative') || has(a, 'abrasive')) && aff(a, h) < -10)[0];
            if (!c || Math.random() > 0.03) continue;
            const R2 = FAITH.makeReligion(FAITH.rng(FAITH.hash(c.name + d + R.id)), R.sk, f.rels.length); R2.id = 'R' + (Math.max(...f.rels.map(x => +String(x.id).slice(1) || 0)) + 1); R2.parent = R.id; R2.founder = c.name; R2.color = R.color;
            f.rels.push(R2); f.of[c.agentId] = { rel: R2.id, piety: Math.max(70, FAITH.pietyOf(w, c)) }; f.heads[R2.id] = c.agentId;
            const followers = bs.filter(a => a !== c && a !== h && aff(a, c) >= 30 && FAITH.pietyOf(w, a) < 85).slice(0, 3);
            for (const a of followers) { f.of[a.agentId] = { rel: R2.id, piety: 60 }; mem(w, a, '我跟著{c}離開了{r}，加入{n}。', { c: c.name, r: R.name[0], n: R2.name[0] }, 7); a.relationships.getOrCreate(h.agentId, h.name).modifyAffinity(-10); }
            log(w, '⚡ {a}與{r}決裂，自立{n}，帶走 {k} 名信徒。', { a: c.name, r: R.name[0], n: R2.name[0], k: followers.length }, c.name);
            mem(w, c, '我再也受不了{h}，決定自立{n}。', { h: h.name, n: R2.name[0] }, 9);
            try { w.dailyNews?.collectEvent?.('event', `${t(R.name[0])}${t('分裂')}${t('：')}${t(R2.name[0])}`, 8, [c.name]); } catch (e) {}
            if ((R.sk === 'sheng' || R.sk === 'li') && typeof DARK !== 'undefined') {
                log(w, '🔥 {h}指控{a}是異端。', { h: h.name, a: c.name }, h.name);
                try { const sc = DARK.secret(w, { kind: 'scheme', culprit: c.agentId, victim: h.agentId, k: '{a}散布異端、分裂{r}', p: { a: c.name, r: R.name[0] } }); sc.found = true; DARK.proposeVerdict(w, sc, c, h, h); } catch (e) { console.warn('[Faith2] heresy', e); }
            }
            return;
        }
    }
    // 新研究完成:虔誠的保守信徒反對
    function onResearch(w, key) {
        const f = F(w); if (!f) return; const name = w.research?.projects?.[key]?.name || key; let n = 0;
        for (const a of npcs(w)) {
            const R = FAITH.relOf(w, a); if (!R || FAITH.pietyOf(w, a) < 70 || has(a, 'creative') || a.job?.key === 'researcher') continue;
            if (Math.random() > 0.4) continue; n++;
            a.moodModifier = (a.moodModifier || 0) - 2; mem(w, a, '「{tech}」違背了{r}的教誨，我不贊成。', { tech: name, r: R.name[0] }, 6);
        }
        for (const R of f.rels) { const h = headOf(w, R); if (h && Math.random() < 0.5) { log(w, '⛪ {h}公開反對新研究「{tech}」。', { h: h.name, tech: name }, h.name); mem(w, h, '我公開反對「{tech}」，信徒會聽我的。', { tech: name }, 6); } }
        for (const a of npcs(w)) if (a.job?.key === 'researcher' && FAITH.relOf(w, a) && FAITH.pietyOf(w, a) >= 50) { FAITH.bumpP(w, a, -5); }
        return n;
    }
    // 加冕:由信徒最多的宗教領袖主持
    function coronation(w, king, how) {
        const f = F(w); if (!f || !w.crown || !king) return null;
        const R = f.rels.slice().sort((x, y) => FAITH.believers(w, y).length - FAITH.believers(w, x).length)[0]; if (!R) return null;
        const h = headOf(w, R); if (!h || h === king) return null;
        if (aff(h, king) < -20 || (how === 'coup' && FAITH.pietyOf(w, h) >= 80 && Math.random() < 0.5)) {
            w.crown.legit = Math.max(0, w.crown.legit - 8);
            log(w, '⛪ {h}拒絕為{a}加冕，{r}的信徒議論紛紛。', { h: h.name, a: king.name, r: R.name[0] }, h.name);
            for (const a of FAITH.believers(w, R)) if (Math.random() < 0.3) mem(w, a, '{h}不肯替新王加冕，這個王位靠得住嗎？', { h: h.name }, 6);
            return { refused: true, rel: R.id };
        }
        const rite = RITE[R.sk]; w.crown.legit = Math.min(100, w.crown.legit + rite[0]); w.crown.rite = { rel: R.id, by: h.name, way: rite[1] };
        log(w, '⛪ {h}以{r}之名為{a}加冕：{way}。', { h: h.name, r: R.name[0], a: king.name, way: rite[1] }, h.name);
        for (const a of FAITH.believers(w, R)) a.relationships.getOrCreate(king.agentId, king.name).modifyAffinity(5);
        mem(w, king, '{h}以{r}之名替我加冕。', { h: h.name, r: R.name[0] }, 8);
        return { refused: false, rel: R.id, bonus: rite[0] };
    }
    function daily(w) {
        const f = F(w); if (!f) return; const d = day(w); if (f._d2 === d) return; f._d2 = d;
        if (!f.heads || d % 7 === 0) pickHeads(w);
        schism(w, d);
    }
    const headTitle = (w, a) => { const R = headRel(w, a); if (!R) return null; const tt = title(w, R); return { R, zh: tt[0], en: tt[1], high: tierLv(w) >= 2 }; };
    return { TITLE, RITE, pickHeads, headOf, headRel, headTitle, schism, onResearch, coronation, daily };
})();
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.faith) FAITH2.daily(w); } catch (e) { console.warn('[Faith2] daily', e); } return r; };
}
// 宗教領袖的官職標籤(沒有其他官職時才顯示);城市以上算貴族
if (typeof TIERS !== 'undefined') {
    const _badge = TIERS.badge;
    TIERS.badge = function (w, a) { const b = _badge.call(this, w, a); if (b && b.cls !== 'former') return b; try { const h = w?.faith && FAITH2.headTitle(w, a); if (h) return { cls: 'clergy', icon: '⛪', text: `${t(h.R.name[0])}${(typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? ' ' : ''}${t(h.zh)}`, high: h.high }; } catch (e) {} return b; };
}
if (typeof World !== 'undefined') World.prototype.onCrown = function (a, how) { try { if (this.faith) FAITH2.coronation(this, a, how); } catch (e) { console.warn('[Faith2] crown', e); } };
if (typeof IdeaSystem !== 'undefined') {
    const IP = IdeaSystem.prototype; const _open = IP.openness, _done = IP.onResearchComplete;
    IP.openness = function (w, a, key) { let o = _open.call(this, w, a, key); try { if (w.faith) { const p = FAITH.pietyOf(w, a); if (p >= 70) o -= 0.6; if (FAITH2.headRel(w, a)) o -= 0.4; } } catch (e) {} return o; };
    IP.onResearchComplete = function (w, key, ...rest) { const r = _done.call(this, w, key, ...rest); try { if (w.observerMode && w.faith) FAITH2.onResearch(w, key); } catch (e) {} return r; };
}
if (typeof FAITH !== 'undefined') {
    const _brief = FAITH.brief;
    FAITH.brief = function (w, a) { const s = _brief.call(this, w, a); try { const h = FAITH2.headTitle(w, a); if (h) return `${s}${t('；')}${t('你是{r}的{t}').replace('{r}', t(h.R.name[0])).replace('{t}', t(h.zh))}`; } catch (e) {} return s; };
    const _view = FAITH.view;
    FAITH.view = function (w) { const v = _view.call(this, w); try { for (const x of v) { const R = w.faith.rels.find(r => r.id === x.id); const h = R && FAITH2.headOf(w, R); if (h) { const tt = FAITH2.TITLE[R.sk][(typeof TIERS !== 'undefined' && TIERS.level(w) >= 2) ? 1 : 0]; x.head = `${t(tt[0])} ${t(h.name)}`; } if (R?.founder) x.founder = t(R.founder); } } catch (e) {} return v; };
}
if (typeof globalThis !== 'undefined') globalThis.FAITH2 = FAITH2;
