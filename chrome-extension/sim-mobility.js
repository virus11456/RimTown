// v9.10.0 階層流動:出身 → 現在,看得到誰爬上去、誰掉下來,以及怎麼爬、怎麼掉
// - 出身:小孩的階層跟著家裡(爸媽裡最高的);16 歲那天定下來,之後就是他的「出身」
// - 往上爬的路:存錢(原本就有)、拜師學手藝(學一個月出師換到工匠的工作)、做生意(有店算工匠商人、有產業算士紳)、
//   嫁娶(配偶的階層會拉你一把,最多到配偶的下一階)、立功受封／買爵位(原本就有)
// - 往下掉的路:生意垮、被罰被逐(原本就有)、敗家(出身好又懶散的人愛揮霍,錢付給鎮上的店家,不會憑空消失)
// - 爬上兩階以上、到士紳以上 =「白手起家」(窮人以他為榜樣、老派士紳嫌他暴發戶);從士紳以上掉兩階 =「家道中落」;爸媽白手起家、孩子敗光 =「富不過三代」
// - 觀察者:鎮況「社會階層」下面一行流動統計＋最近的故事;村民卡標籤;AI 知道自己的出身
const MOBILITY = (() => {
    const CRAFT = ['blacksmith', 'carpenter', 'tailor', 'cook', 'trader', 'doctor', 'researcher'];
    const APPR_DAYS = 30, APPR_XP = 70, ADULT = 16, YOUNG = 25, STEADY = 7;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const money = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const mem = (w, a, k, p, imp = 7) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const news = (w, s, who) => { try { w.dailyNews?.collectEvent?.('social', s, 7, who); } catch (e) {} };
    const rel = (a, b) => a?.relationships?.relationships?.[b?.agentId];
    const lvOf = (w, a) => (typeof CLASS !== 'undefined' && a ? CLASS.level(w, a) : 1);
    const cname = (i) => (typeof CLASS !== 'undefined' ? CLASS.NAMES[Math.max(0, Math.min(5, i))].zh : '');
    const jt = (k) => { try { return (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[k]?.title) || k; } catch (e) { return k; } };
    const has = (a, ...tr) => (a.personality?.traits || []).some(x => tr.includes(x));
    function S(w) {
        if (!w.mobility || typeof w.mobility !== 'object') w.mobility = { o: {}, pk: {}, h: {}, told: {}, ap: {}, done: {}, hist: [], st: { rise: 0, fall: 0, appr: 0, grad: 0, spree: 0, three: 0 } };
        const M = w.mobility; for (const k of ['o', 'pk', 'told', 'ap', 'done', 'h']) M[k] = M[k] || {}; M.hist = M.hist || []; M.st = M.st || {}; return M;
    }
    // 名字 → 人(每天建一次)
    let _nm = null, _nmKey = '';
    function byName(w, n) { const key = w.tickCount + ':' + Object.keys(w.agents || {}).length; if (_nmKey !== key) { _nm = {}; for (const a of npcs(w)) _nm[a.name] = a; _nmKey = key; } return _nm[n] || null; }
    const parentsOf = (w, a) => (a._parentNames || []).map(n => byName(w, n)).filter(Boolean);
    function spouseOf(w, a) { for (const [id, r] of Object.entries(a.relationships?.relationships || {})) if (r?.status === 'married') { const o = w.agents[id]; if (o && !o.isDead) return o; } return null; }
    function ownsFirm(w, a) { try { return typeof MARKET !== 'undefined' && w.market && (MARKET.ownedBy(w, a.agentId).length > 0 || Object.values(w.market.rival || {}).some(R => R?.owner === a.agentId)); } catch (e) { return false; } }
    function ownsShop(w, a) { try { return typeof BIZ !== 'undefined' && w.biz && !!BIZ.shopOf(w, a); } catch (e) { return false; } }

    // ---------- 階層加成(CLASS.compute 最後呼叫;用的是前一天算好的家人階層,不會互相遞迴) ----------
    function adjust(w, a, lv) {
        if (!w || !a || !w.observerMode) return lv;
        if (ownsFirm(w, a)) lv = Math.max(lv, 3); else if (ownsShop(w, a)) lv = Math.max(lv, 2); // 做生意
        const C = typeof CLASS !== 'undefined' ? CLASS.S(w) : null; if (!C) return lv;
        const sp = spouseOf(w, a); if (sp && C.lv[sp.agentId] != null) lv = Math.max(lv, Math.min(4, C.lv[sp.agentId]) - 1); // 嫁娶:配偶拉一把,最多到配偶的下一階
        const age = a.age ?? 30;
        if (age < YOUNG) { const pl = parentsOf(w, a).map(p => C.lv[p.agentId] ?? 0); if (pl.length) { const top = Math.min(4, Math.max(...pl)); lv = Math.max(lv, age < ADULT ? top : top - 1); } } // 還沒成家立業的孩子跟著家裡
        return lv;
    }

    // ---------- 每天:記出身、看誰爬上去／掉下來、拜師、敗家 ----------
    function daily(w) {
        if (!w.observerMode || typeof CLASS === 'undefined') return; const M = S(w), d = day(w); if (M.day === d) return; M.day = d;
        const all = npcs(w); let told = 0;
        for (const a of all) {
            const id = a.agentId, age = a.age ?? 30, cur = lvOf(w, a);
            if (age < ADULT || M.o[id] == null) { M.o[id] = cur; if (age < ADULT) continue; } // 小孩的出身每天跟著家裡;大人第一次看到就記
            const H = M.h[id]; if (!H || H[0] !== cur) { M.h[id] = [cur, d]; continue; } if (d - H[1] < STEADY) continue; // 新的階層要穩住一週才算(錢在門檻上下晃不算爬上去或掉下來)
            M.pk[id] = Math.max(M.pk[id] ?? cur, cur);
            if (told >= 2) continue; const o = M.o[id], T = M.told[id];
            if (cur >= o + 2 && cur >= 3 && T !== 'rise') { rise(w, a, o, cur); M.told[id] = 'rise'; told++; }
            else if ((M.pk[id] || 0) >= 3 && cur <= M.pk[id] - 2 && T !== 'fall') { fall(w, a, M.pk[id], cur); M.told[id] = 'fall'; told++; }
        }
        for (const id of Object.keys(M.o)) if (!w.agents[id] && !w.isAway?.(id)) { delete M.o[id]; delete M.pk[id]; delete M.h[id]; delete M.told[id]; delete M.ap[id]; delete M.done[id]; }
        apprentice(w, all, d);
        if (d % 3 === 0) spree(w, all, d);
    }
    function how(w, a) {
        const sp = spouseOf(w, a), C = CLASS.S(w), T = C.titles?.[a.agentId], M = S(w);
        if (T?.bought) return '花錢買了頭銜'; if (T) return '立功受封';
        if (ownsFirm(w, a) || ownsShop(w, a)) return '做生意';
        if (M.done[a.agentId]) return '拜師學了一身手藝';
        if (sp && (C.lv[sp.agentId] ?? 0) >= lvOf(w, a)) return '嫁娶進了好人家';
        return '一點一滴攢錢';
    }
    function hist(w, x) { const M = S(w); M.hist.unshift({ ...x, d: day(w) }); M.hist = M.hist.slice(0, 8); }
    function rise(w, a, from, to) {
        const M = S(w), by = how(w, a); M.st.rise = (M.st.rise || 0) + 1;
        log(w, '🌱 {a}出身{f}，靠{h}，如今成了{t}。', { a: a.name, f: cname(from), h: by, t: cname(to) }, a.name);
        news(w, `${a.name}${t('白手起家')}`, [a.name]); hist(w, { k: 'rise', name: a.name, from, to, how: by });
        mem(w, a, '我出身{f}，靠{h}走到今天，成了{t}。', { f: cname(from), h: by, t: cname(to) }, 9); a.moodModifier = (a.moodModifier || 0) + 8;
        for (const o of npcs(w)) { if (o === a || (o.age ?? 30) < ADULT) continue; const ol = lvOf(w, o), r = rel(o, a);
            if (ol <= 1 && r && Math.random() < 0.3) { r.modifyAffinity?.(3); mem(w, o, '{a}也是苦過來的，現在成了{t}，我也可以。', { a: a.name, t: cname(to) }, 5); } // 窮人的榜樣
            else if (ol >= 3 && (M.o[o.agentId] ?? 0) >= 3 && Math.random() < 0.25) { o.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(-3); mem(w, o, '{a}不過是個暴發戶。', { a: a.name }, 4); } } // 老派士紳嫌暴發戶
    }
    function fall(w, a, from, to) {
        const M = S(w); M.st.fall = (M.st.fall || 0) + 1; a.moodModifier = (a.moodModifier || 0) - 12;
        const self = parentsOf(w, a).find(p => M.told[p.agentId] === 'rise') || (a._parentNames || []).find(n => M.hist.some(h => h.k === 'rise' && h.name === n));
        const founder = self ? (typeof self === 'string' ? self : self.name) : '';
        if (founder) { M.st.three = (M.st.three || 0) + 1; log(w, '🍂 {p}白手起家攢下的家業，到了{a}這一代就敗光了，從{f}跌成了{t}。', { p: founder, a: a.name, f: cname(from), t: cname(to) }, a.name); }
        else log(w, '🍂 {a}家道中落，從{f}跌成了{t}。', { a: a.name, f: cname(from), t: cname(to) }, a.name);
        news(w, `${a.name}${t('家道中落')}`, [a.name]); hist(w, { k: founder ? 'three' : 'fall', name: a.name, from, to, founder });
        mem(w, a, '我從{f}跌成了{t}，以前那些朋友都不太來往了。', { f: cname(from), t: cname(to) }, 9);
        const sp = spouseOf(w, a); if (sp) mem(w, sp, '家裡的日子大不如前了。', {}, 6);
    }
    // 拜師:沒什麼出路的年輕人跟熟識的師傅學一個月手藝,出師就換到工匠的工作(工資高 → 慢慢存錢往上爬)
    function apprentice(w, all, d) {
        const M = S(w);
        for (const [id, P] of Object.entries(M.ap)) {
            const a = w.agents[id], m = w.agents[P.m]; if (!a) { if (!w.isAway?.(id)) delete M.ap[id]; continue; }
            if (!m || m.isDead) { delete M.ap[id]; mem(w, a, '師父不在了，我的學徒生涯就這樣斷了。', {}, 6); continue; }
            if (w.isAway?.(P.m)) continue; // 師父出遠門:先停課
            const sk = (typeof JOB_SKILL_MAP !== 'undefined' && JOB_SKILL_MAP[P.k]?.primary?.[0]) || null; if (sk) a.skills?.addXp?.(sk, APPR_XP);
            if (d - P.d0 >= APPR_DAYS) { delete M.ap[id]; M.done[id] = P.k; M.st.grad = (M.st.grad || 0) + 1;
                if (a.job?.key !== P.k && typeof Job !== 'undefined') { try { a.job = new Job(P.k); } catch (e) {} }
                a.relationships?.getOrCreate?.(m.agentId, m.name)?.modifyAffinity?.(10); m.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(6);
                log(w, '🎓 {a}跟著{m}學了一個月，出師當上了{j}。', { a: a.name, m: m.name, j: t(jt(P.k)) }, a.name);
                mem(w, a, '我跟{m}學成出師，以後就是{j}了。', { m: m.name, j: t(jt(P.k)) }, 8); mem(w, m, '我帶出來的徒弟{a}出師了。', { a: a.name }, 6); }
        }
        if (d % 7 !== 0 || Object.keys(M.ap).length >= 2 || Math.random() > 0.4) return;
        const free = (a) => !M.ap[a.agentId] && !Object.values(M.ap).some(P => P.m === a.agentId) && !w.isAway?.(a.agentId) && !w.exile?.pending?.[a.agentId];
        const cand = all.filter(a => free(a) && (a.age ?? 30) >= ADULT && (a.age ?? 30) <= 35 && lvOf(w, a) <= 1 && !CRAFT.includes(a.job?.key) && a.job?.key !== 'mayor' && !M.done[a.agentId] && (has(a, 'hardworking', 'creative', 'perfectionist') || Math.random() < 0.3));
        for (const a of cand.sort(() => Math.random() - 0.5)) {
            const m = all.filter(o => o !== a && free(o) && CRAFT.includes(o.job?.key) && lvOf(w, o) >= 2 && (rel(o, a)?.affinity ?? -1) >= 0).sort((x, y) => (rel(y, a)?.affinity || 0) - (rel(x, a)?.affinity || 0))[0];
            if (!m) continue;
            const fee = Math.min(15, Math.floor(money(w, a) * 0.2)); if (fee > 0 && typeof WALLET !== 'undefined') WALLET.pay(w, a, m, fee, t('拜師'));
            M.ap[a.agentId] = { m: m.agentId, k: m.job.key, d0: d }; M.st.appr = (M.st.appr || 0) + 1;
            log(w, '🧑‍🏫 {a}拜{m}為師，要學當{j}。', { a: a.name, m: m.name, j: t(jt(m.job.key)) }, a.name);
            mem(w, a, '我拜了{m}為師，想學一門手藝，不要一輩子這樣過。', { m: m.name }, 8); mem(w, m, '{a}來拜我為師，我收下了。', { a: a.name }, 5);
            return; // 一週最多一個
        }
    }
    // 敗家:出身好、手頭寬、又懶散愛玩的人隔三差五揮霍,錢付給鎮上的店家(沒有店家就進公庫)
    function spree(w, all, d) {
        if (typeof WALLET === 'undefined' || !w.wallet) return; const M = S(w);
        const owners = (() => { try { return Object.values(MARKET.S(w).owners || {}).map(id => w.agents[id]).filter(Boolean); } catch (e) { return []; } })();
        for (const a of all) {
            if ((a.age ?? 30) < ADULT || (M.o[a.agentId] ?? 0) < 3 || !has(a, 'lazy', 'glutton', 'romantic') || has(a, 'ascetic', 'hardworking')) continue;
            const c = money(w, a); if (c < 150 || Math.random() > 0.12) continue;
            const amt = Math.round(c * (0.12 + Math.random() * 0.13)); const pool = owners.filter(o => o !== a); const to = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
            if (!WALLET.pay(w, a, to, amt, t('揮霍'))) continue; M.st.spree = (M.st.spree || 0) + 1; M.st.spent = Math.round((M.st.spent || 0) + amt);
            if (Math.random() < 0.4) log(w, '🍾 {a}又一擲千金，請客、買了一堆用不到的東西，花掉 {n} 銀幣。', { a: a.name, n: amt }, a.name);
            for (const p of parentsOf(w, a)) if (Math.random() < 0.3) mem(w, p, '{a}花錢像流水，家業遲早被敗光。', { a: a.name }, 5);
        }
    }

    // ---------- 給觀察者與 AI ----------
    function tag(w, a) {
        if (!w.mobility || !a) return null; const M = w.mobility, id = a.agentId;
        if (M.ap?.[id]) { const m = w.agents[M.ap[id].m]; return { text: `🧑‍🏫 ${t('學徒')}${m ? t('（') + t('師父') + t('：') + t(m.name) + t('）') : ''}`, cls: 'nqc-appr' }; }
        if (M.told?.[id] === 'rise') return { text: `🌱 ${t('白手起家')}`, cls: 'nqc-rise' };
        if (M.told?.[id] === 'fall') return { text: `🍂 ${t('家道中落')}`, cls: 'nqc-fall' };
        return null;
    }
    function brief(w, a) {
        if (!w.mobility || !a || (a.age ?? 30) < ADULT) return ''; const M = w.mobility, id = a.agentId, o = M.o?.[id], cur = lvOf(w, a);
        if (M.ap?.[id]) { const m = w.agents[M.ap[id].m]; return t('你正在跟{m}當學徒，學當{j}').replace('{m}', m ? t(m.name) : '').replace('{j}', t(jt(M.ap[id].k))); }
        if (o == null || o === cur) return '';
        return (cur > o ? t('你出身{f}，靠自己成了{t}') : t('你出身{f}，現在家道中落成了{t}')).replace('{f}', t(cname(o))).replace('{t}', t(cname(cur)));
    }
    function view(w) {
        const M = w.mobility; if (!M) return null; const all = npcs(w).filter(a => (a.age ?? 30) >= ADULT);
        let up = 0, down = 0; for (const a of all) { const o = M.o?.[a.agentId]; if (o == null) continue; const c = lvOf(w, a); if (c > o) up++; else if (c < o) down++; }
        return { up, down, n: all.length, appr: Object.keys(M.ap || {}).length, st: M.st || {}, hist: (M.hist || []).slice(0, 3) };
    }
    return { S, CRAFT, APPR_DAYS, adjust, daily, apprentice, spree, tag, brief, view, how };
})();

if (typeof CLASS !== 'undefined') { const _d = CLASS.daily; CLASS.daily = function (w, ...rest) { const r = _d.call(this, w, ...rest); try { MOBILITY.daily(w); } catch (e) { console.warn('[Mobility] daily', e); } return r; }; }
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.mobility = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.mobility) d.mobility = this.mobility; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.mobility = (data?.mobility && typeof data.mobility === 'object') ? data.mobility : null; } catch (e) {} return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = MOBILITY.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof globalThis !== 'undefined') globalThis.MOBILITY = MOBILITY;
