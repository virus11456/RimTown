// v9.16.0 鎮與鎮的競爭:鄰鎮裡挑一個「對手鎮」,兩鎮一起發展、互相比較
// - 對手鎮有自己的繁榮度,會慢慢變;我們領先太多它會拚命追,落後太多它也會走下坡
// - 大約每週一件事(看兩鎮的實力、關係、鎮上的人):
//   搶生意(賣得比我們便宜,商人跑過去/或我們的貨守住了)、挖角(開高薪挖我們的好手,有家有業、心情好的比較不會走)、
//   人才投奔(我們比較興旺時,對手鎮的人搬過來)、互通有無(我們缺的物資,關係好就拿我們多的去換;關係差就趁機抬價)、
//   友誼賽(豐收節、市集評比、手藝大賽…派鎮上最強的人去比)、遭災時送糧
// - 每件事都會讓兩鎮關係變好或變壞(接上外交);關係好是「良性競爭」,關係差變「死對頭」
// - 看得到:動態、日報、村民記得、AI 知道對手鎮是誰、閒聊會提;鎮況的外交區塊有兩鎮比較
// - 錢:挖角走的人帶走自己的錢(照原本離鄉的金流帳);換貨是物資對物資,不動銀幣
'use strict';

const RIVAL = (() => {
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const rnd = (L) => L[Math.floor(Math.random() * L.length)];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const val = (y) => (typeof y === 'string' ? t(y) : String(y ?? ''));
    function R(k, p) { let s = t(k); for (const [x, y] of Object.entries(p || {})) s = s.split('{' + x + '}').join(val(y)); return s; }
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const RES = { food: '食物', wood: '木材', stone: '石材', metal: '金屬', cloth: '布料', herbs: '草藥', tools: '工具' };
    const CONTEST = [['豐收節比賽', '種植'], ['市集評比', '社交'], ['手藝大賽', '工藝'], ['學問比試', '智識'], ['廚藝大賽', '烹飪']];
    const places = (w) => (w.tidings?.places || []).filter(p => p.kind === 'town');
    const pname = (p) => p?.name?.[0] || '';
    const usOf = (w) => Math.round(w.prosperity?.prosperity ?? 50);
    const tierOf = (w) => { try { return typeof TIERS !== 'undefined' ? (TIERS.S(w).lv || 0) : 0; } catch (e) { return 0; } };
    const relOf = (w, pid) => { try { return typeof DIPLO !== 'undefined' ? Math.round(DIPLO.S(w).rel[pid] || 0) : 0; } catch (e) { return 0; } };
    const bump = (w, pid, n) => { try { if (typeof DIPLO !== 'undefined') DIPLO.bump(w, pid, n); } catch (e) {} };
    const leaderIds = (w) => { const s = new Set(); try { const m = w.election?.currentMayor?.(w); if (m) s.add(m.agentId || m); } catch (e) {} try { const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; if (k) s.add(k.agentId || k); } catch (e) {} return s; };
    const topSkill = (a) => { let best = null; for (const s of Object.values(a?.skills?.skills || {})) if (!best || s.level > best.level) best = s; return best; };
    const lvlOf = (a, cat) => a?.skills?.get?.(cat)?.level || 0;

    function S(w) {
        if (!w.rival || typeof w.rival !== 'object') w.rival = { pid: null, them: null, log: [], lastDay: null, lastEv: null, n: 0, mods: [], st: { tw: 0, tl: 0, lost: 0, kept: 0, gained: 0, cw: 0, cl: 0, swap: 0, gouge: 0, aid: 0 } };
        const V = w.rival; V.st = V.st || {}; V.mods = V.mods || []; V.log = V.log || [];
        return V;
    }
    // 挑對手:等級跟我們最接近、路最近的鄰鎮
    function pick(w) {
        const ps = places(w); if (!ps.length) return null; const lv = tierOf(w);
        return ps.slice().sort((a, b) => (Math.abs((a.lv ?? 1) - lv) * 3 + (a.dist || 3)) - (Math.abs((b.lv ?? 1) - lv) * 3 + (b.dist || 3)))[0];
    }
    const placeOf = (w) => { const V = S(w); return places(w).find(p => p.id === V.pid) || null; };
    function ensure(w) {
        const V = S(w); let p = placeOf(w);
        if (!p) { p = pick(w); if (!p) return null; V.pid = p.id; V.them = clamp(usOf(w) + (Math.random() * 16 - 8), 10, 90); V.since = day(w); V.lastEv = day(w) - 3; }
        if (typeof V.them !== 'number') V.them = usOf(w);
        return p;
    }
    function note(w, V, kind, k, p, good, who) {
        V.log.push({ d: day(w), kind, k, p, good }); if (V.log.length > 10) V.log.splice(0, V.log.length - 10); V.n++;
        try { w.logMessageT?.('event', k, p, who || ''); } catch (e) {}
        try { w.dailyNews?.collectEvent?.('event', R(k, p), good ? 6 : 7, who ? [who] : []); } catch (e) {}
        try { w.events?.conversationTopics?.push(R('跟{p}的競爭', { p: p.p })); if (w.events) w.events.conversationTopics = w.events.conversationTopics.slice(-5); } catch (e) {}
    }
    const addMod = (w, V, m, days) => { V.mods.push({ until: day(w) + days, m }); if (V.mods.length > 6) V.mods.shift(); effects(w, V); };
    // 兩鎮競爭帶來的經濟影響(跟外交一樣放進一則新聞修正值)
    function effects(w, V) {
        if (!w.news?.bulletins) return; const d = day(w); V.mods = V.mods.filter(x => x.until >= d);
        const m = {}; for (const x of V.mods) for (const [k, v] of Object.entries(x.m)) m[k] = Math.round(((m[k] || 0) + v) * 100) / 100;
        const nd = w.clock.year * 60 + (['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15) + w.clock.day;
        w.news.bulletins = w.news.bulletins.filter(b => !b.rival);
        if (Object.keys(m).length) w.news.bulletins.push({ headline: t('鄰鎮競爭'), category: 'remote', severity: 'info', flavor: [], modifiers: m, expiresDay: nd + 2, publishedDay: nd, rival: true });
        w.news._rebuildModifiers?.(nd);
    }

    // ---------- 一件一件的事 ----------
    // ---------- 挖角的結算(留下／被挖走) ----------
    // v9.22.0 被挖角時走不走，交給本人決定(sim-decide-life.js「別鎮開高薪來挖角」)
    const here = (w, a) => !!a && !a.isDead && w.agents?.[a.agentId] === a && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId);
    const canLeave = (w) => npcs(w).length >= 12; // 人太少的小村不會真的被挖空
    function poachStay(w, V, p, a, skill) {
        a.moodModifier = (a.moodModifier || 0) + 3; mem(w, a, '{p}開高薪找我過去，我沒答應——這裡是我的家。', { p: pname(p) }, 8); a.currentThought = R('{p}開的價是不錯，但我不走。', { p: pname(p) });
        for (const o of npcs(w).filter(o => o !== a && Math.random() < 0.4)) mem(w, o, '{p}想挖走{a}，{a}婉拒了。', { p: pname(p), a: a.name }, 4);
        V.st.kept++; bump(w, p.id, -3); note(w, V, 'talent', '🙅 {p}開高薪想挖走{a}（{s}好手），{a}婉拒了。', { p: pname(p), a: a.name, s: skill }, true, a.name);
    }
    function poachGo(w, V, p, a, skill) {
        const name = a.name; V.st.lost++; V.them = clamp(V.them + 2, 5, 95); bump(w, p.id, -6);
        for (const o of npcs(w).filter(o => o !== a)) { const close = (o._parentNames || []).includes(name) || (a._parentNames || []).includes(o.name) || (o.relationships?.relationships?.[a.agentId]?.affinity || 0) >= 40; mem(w, o, '{a}被{p}高薪挖走了。', { a: name, p: pname(p) }, close ? 8 : 4); if (close) o.moodModifier = (o.moodModifier || 0) - 3; }
        note(w, V, 'talent', '💼 {p}開高薪挖走了{a}（{s}好手）。', { p: pname(p), a: name, s: skill }, false, name);
        try { w.leaveTown?.(a.agentId, R('被{p}高薪挖走', { p: pname(p) })); } catch (e) {}
    }
    // 給決策核心：來挖角的是哪個鎮、兩邊誰比較興旺、他走不走得了
    function poachInfo(w, pid) { const V = w.rival; const p = V && placeOf(w); if (!p || p.id !== pid) return null; return { p, name: pname(p), us: usOf(w), them: Math.round(V.them), rel: relOf(w, p.id), canLeave: canLeave(w) }; }
    // 本人拿了主意。回傳 'stay'／'gone'
    function poachAnswer(w, a, pid, skill, go) { const I = poachInfo(w, pid); if (!I || !here(w, a)) return null; const V = S(w); if (go && I.canLeave) { poachGo(w, V, I.p, a, skill); return 'gone'; } poachStay(w, V, I.p, a, skill); return 'stay'; }

    const EV = {
        // 搶生意:我們最多的那樣貨,對手賣得比較便宜
        trade(w, V, p) {
            const keys = Object.keys(RES); const res = keys.sort((a, b) => (w.stockpile.get(b) || 0) - (w.stockpile.get(a) || 0))[0];
            const traders = npcs(w).filter(a => ['trader', 'merchant'].includes(a.job?.key) || (typeof MARKET !== 'undefined' && MARKET.ownedBy?.(w, a.agentId)?.length));
            const edge = (usOf(w) - V.them) + (Math.random() * 30 - 15) + (traders.some(a => has(a, 'charismatic')) ? 5 : 0);
            if (edge >= 0) {
                addMod(w, V, { sell_bonus: 0.04, merchant_chance: 0.04 }, 7); V.them = clamp(V.them - 1, 5, 95); V.st.tw++; bump(w, p.id, -2);
                for (const a of traders.slice(0, 4)) { a.moodModifier = (a.moodModifier || 0) + 2; mem(w, a, '{p}想用低價搶我們的{r}生意，客人還是認我們的貨。', { p: pname(p), r: RES[res] }, 6); }
                note(w, V, 'trade', '🏪 {p}想用低價搶我們的{r}生意，結果客人還是認我們的貨。', { p: pname(p), r: RES[res] }, true);
            } else {
                addMod(w, V, { sell_bonus: -0.07, merchant_chance: -0.05 }, 7); V.them = clamp(V.them + 1.5, 5, 95); V.st.tl++; bump(w, p.id, -4);
                for (const a of traders.slice(0, 4)) { a.moodModifier = (a.moodModifier || 0) - 3; mem(w, a, '{p}的{r}賣得比我們便宜，生意被搶走了，得想辦法。', { p: pname(p), r: RES[res] }, 7); }
                note(w, V, 'trade', '📉 {p}的{r}賣得比我們便宜，商人都往那邊跑了。', { p: pname(p), r: RES[res] }, false);
            }
            return true;
        },
        // 挖角:開高薪挖我們最厲害的人
        talent(w, V, p) {
            const lead = leaderIds(w); const pool = adults(w).filter(a => !lead.has(a.agentId) && (a.age ?? 30) <= 60);
            const tgt = pool.map(a => ({ a, s: topSkill(a) })).filter(x => x.s && x.s.level >= 2).sort((x, y) => y.s.level - x.s.level)[0]; if (!tgt) return false;
            const a = tgt.a, skill = tgt.s.category; const rel = relOf(w, p.id);
            // 走不走由本人決定：先記下「有人來挖角」，他拿了主意再結算；人不在鎮上問不到時，才照他的處境推一個結果
            if (here(w, a)) { try { DECIDE.enqueue(w, a, 'poach', { pid: p.id, skill }); V.st.asked = (V.st.asked || 0) + 1; return true; } catch (e) {} }
            let stay = 0.5 + (a.relationships?.getPartner?.() ? 0.2 : 0) + ((a.mood ?? 50) >= 60 ? 0.12 : 0) - ((a.mood ?? 50) < 35 ? 0.2 : 0) + (rel <= -30 ? 0.15 : 0) - (V.them > usOf(w) + 10 ? 0.12 : 0) + (has(a, 'stoic') ? 0.1 : 0) - (has(a, 'jealous') ? 0.08 : 0);
            if (!canLeave(w)) stay = 1; // 人太少的小村不會真的被挖空
            if (Math.random() < stay) poachStay(w, V, p, a, skill); else poachGo(w, V, p, a, skill);
            return true;
        },
        // 人才投奔:我們比較興旺,對手鎮的人搬過來
        gain(w, V, p) {
            const before = new Set(Object.keys(w.agents)); try { w.events?._spawnImmigrant?.(w); } catch (e) {}
            const id = Object.keys(w.agents).find(k => !before.has(k)); const a = id ? w.agents[id] : null; if (!a) return false;
            mem(w, a, '我從{p}搬來這裡，聽說這邊比較有前途。', { p: pname(p) }, 8); a.currentThought = R('{p}那邊越來越不行了，還是這裡好。', { p: pname(p) }); a._from = pname(p);
            V.st.gained++; V.them = clamp(V.them - 1.5, 5, 95); bump(w, p.id, -3);
            note(w, V, 'gain', '🧳 {a}從{p}搬過來了：「這裡比較有前途。」', { p: pname(p), a: a.name }, true, a.name);
            return true;
        },
        // 互通有無:我們缺的東西,關係好就拿多的去換;關係差就被抬價
        dep(w, V, p) {
            const pop = Math.max(1, npcs(w).length); const keys = ['food', 'wood', 'stone', 'metal', 'cloth'];
            const per = (r) => (w.stockpile.get(r) || 0) / pop; const lack = keys.slice().sort((a, b) => per(a) - per(b))[0], much = keys.slice().sort((a, b) => per(b) - per(a))[0];
            if (lack === much || per(much) < 3) return false; const rel = relOf(w, p.id);
            if (rel >= 0) {
                const n = Math.min(40, Math.floor((w.stockpile.get(much) || 0) * 0.15)); if (n < 8) return false;
                w.stockpile.consume(much, n, w.tickCount, t('跟鄰鎮換貨'), 'event'); w.stockpile.add(lack, n, w.tickCount, t('跟鄰鎮換貨'), 'event');
                V.st.swap++; V.dep = (V.dep || 0) + 1; bump(w, p.id, 4);
                note(w, V, 'dep', '🔁 我們缺{x}，{p}拿{x}換了我們的{y}——兩鎮越來越離不開彼此。', { p: pname(p), x: RES[lack], y: RES[much] }, true);
            } else {
                addMod(w, V, { buy_bonus: -0.06 }, 7); V.st.gouge++; bump(w, p.id, -2);
                for (const a of npcs(w)) if (Math.random() < 0.5) a.moodModifier = (a.moodModifier || 0) - 1;
                note(w, V, 'dep', '⛔ 我們缺{x}，{p}趁機抬價、不肯好好賣。', { p: pname(p), x: RES[lack] }, false);
            }
            return true;
        },
        // 友誼賽:派鎮上最強的人去比
        contest(w, V, p) {
            const [c, cat] = rnd(CONTEST); const champ = adults(w).sort((a, b) => lvlOf(b, cat) - lvlOf(a, cat))[0]; if (!champ) return false;
            const ours = lvlOf(champ, cat) * 4 + usOf(w) * 0.3 + Math.random() * 25, theirs = V.them * 0.3 + 12 + Math.random() * 25;
            bump(w, p.id, 4);
            if (ours >= theirs) {
                champ.moodModifier = (champ.moodModifier || 0) + 6; champ.currentThought = R('贏了{p}！', { p: pname(p) }); mem(w, champ, '我代表鎮上參加{c}，贏了{p}！', { c, p: pname(p) }, 9);
                for (const a of npcs(w)) if (a !== champ) { a.moodModifier = (a.moodModifier || 0) + 1; if (Math.random() < 0.5) mem(w, a, '{a}在{c}贏了{p}，大家都很驕傲。', { a: champ.name, c, p: pname(p) }, 5); }
                V.st.cw++; V.them = clamp(V.them - 0.5, 5, 95); note(w, V, 'contest', '🏆 兩鎮辦{c}，{a}替鎮上贏了{p}！', { p: pname(p), a: champ.name, c }, true, champ.name);
            } else {
                champ.moodModifier = (champ.moodModifier || 0) - 2; champ.currentThought = R('明年再來，{p}等著。', { p: pname(p) }); mem(w, champ, '我在{c}輸給了{p}，明年再來。', { c, p: pname(p) }, 7);
                V.st.cl++; note(w, V, 'contest', '🥈 兩鎮辦{c}，{a}輸給了{p}，約好明年再比。', { p: pname(p), a: champ.name, c }, false, champ.name);
            }
            return true;
        },
        // 對手鎮遭災、關係又好:鎮上湊糧送過去
        aid(w, V, p) {
            const food = w.stockpile.get('food') || 0; if (food < npcs(w).length * 6) return false;
            w.stockpile.consume('food', 40, w.tickCount, t('送糧給鄰鎮'), 'event'); V.them = clamp(V.them + 3, 5, 95); V.st.aid++; bump(w, p.id, 12);
            for (const a of npcs(w)) if (has(a, 'kind') || Math.random() < 0.2) mem(w, a, '{p}遭了災，我們湊了一車糧送過去。', { p: pname(p) }, 5);
            note(w, V, 'aid', '🤝 {p}遭了災，鎮上湊了一車糧送過去——再怎麼競爭也是鄰居。', { p: pname(p) }, true);
            return true;
        },
    };
    function choose(w, V, p) {
        const us = usOf(w), rel = relOf(w, p.id); const L = [['trade', 3], ['talent', 2], ['dep', 1.5], ['contest', 1.5 + (rel >= 30 ? 1 : 0)]];
        if (us > V.them + 8) L.push(['gain', 2]);
        if (V.them < 30 && rel >= 25) L.push(['aid', 2.5]);
        const sum = L.reduce((s, x) => s + x[1], 0); let r = Math.random() * sum; for (const [k, wt] of L) { r -= wt; if (r <= 0) return k; } return 'trade';
    }
    function event(w, kind) {
        const V = S(w); const p = ensure(w); if (!p) return null;
        const k = kind || choose(w, V, p); let ok = false; try { ok = EV[k]?.(w, V, p); } catch (e) { console.warn('[Rival]', k, e); }
        if (!ok && !kind) { try { ok = EV.contest(w, V, p); } catch (e) {} return ok ? 'contest' : null; }
        return ok ? k : null;
    }
    function daily(w) {
        const V = S(w), d = day(w); if (V.lastDay === d) return; V.lastDay = d;
        const p = ensure(w); if (!p) return;
        // 對手鎮自己的發展:落後會拚命追、領先太多會鬆懈
        const gap = usOf(w) - V.them; V.them = clamp(V.them + (Math.random() - 0.5) * 1.2 + gap * 0.04, 5, 95);
        if (d - (V.lastEv ?? d) >= 7) { V.lastEv = d - Math.floor(Math.random() * 2); event(w, undefined); }
        effects(w, V);
    }

    // ---------- 給 AI、閒聊、畫面 ----------
    const stanceOf = (rel) => rel >= 40 ? '良性競爭' : rel <= -30 ? '死對頭' : '互相較勁';
    function townBrief(w) {
        const V = w.rival; const p = V && placeOf(w); if (!p) return '';
        const last = V.log.slice(-1)[0]; const rel = relOf(w, p.id);
        return R('對手鎮是{p}（我們繁榮 {u}、他們 {h}，{s}）', { p: pname(p), u: usOf(w), h: Math.round(V.them), s: stanceOf(rel) }) + (last ? t('；') + R('最近') + t('：') + R(last.k, last.p).replace(/^\S+\s/, '') : '');
    }
    function talk(w, a, b, push) {
        const V = w.rival; const p = V && placeOf(w); if (!p || !V.log.length || Math.random() > 0.08) return;
        const us = usOf(w), rel = relOf(w, p.id), last = V.log.slice(-1)[0];
        if (last && Math.random() < 0.5) { push(a, R('你聽說了嗎？{x}', { x: R(last.k, last.p).replace(/^\S+\s/, '') })); push(b, last.good ? R('我們可不能輸給{p}。', { p: pname(p) }) : R('{p}這招太狠了，我們得想辦法。', { p: pname(p) })); return; }
        if (rel >= 40) { push(a, R('{p}的人其實不壞，有缺的還會跟我們換。', { p: pname(p) })); push(b, R('競爭歸競爭，鄰居還是鄰居。')); return; }
        if (us >= V.them) { push(a, R('{p}最近被我們比下去了吧。', { p: pname(p) })); push(b, R('別得意，他們追得很緊。')); }
        else { push(a, R('{p}發展得比我們好，人都往那邊跑。', { p: pname(p) })); push(b, R('我們得加把勁了。')); }
    }
    function view(w) {
        const V = w.rival; const p = V && placeOf(w); if (!p) return null; const rel = relOf(w, p.id);
        const L = (typeof TIERS !== 'undefined' && TIERS.LV) ? TIERS.LV : [{ icon: '🏡' }, { icon: '🏘️' }, { icon: '🏙️' }, { icon: '🏰' }];
        return { name: t(pname(p)), icon: L[p.lv ?? 1]?.icon || '🏘️', us: usOf(w), them: Math.round(V.them), rel, stance: t(stanceOf(rel)), st: V.st, dep: V.dep || 0, log: V.log.slice(-4).reverse().map(x => ({ text: R(x.k, x.p), good: x.good, ago: day(w) - x.d })) };
    }
    return { S, ensure, pick, daily, event, effects, townBrief, talk, view, EV, stanceOf, poachInfo, poachAnswer };
})();

if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) RIVAL.daily(w); } catch (e) { console.warn('[Rival] daily', e); } return r; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _fb = CE._fallbackConversation;
    CE._fallbackConversation = function (a, b, world, relA, relB) {
        const r = _fb.call(this, a, b, world, relA, relB);
        try {
            if (world.observerMode && world.rival) {
                const L = this.npcConversationLog?.[this.npcConversationLog.length - 1];
                const target = (L && L.agentA === a.name && L.agentB === b.name && Array.isArray(L.dialogue)) ? L.dialogue : (r && Array.isArray(r.dialogue) ? r.dialogue : null);
                if (target) RIVAL.talk(world, a, b, (who, text) => { target.push({ speaker: who.name, text }); if (r && Array.isArray(r.dialogue) && r.dialogue !== target) r.dialogue.push({ speaker: who.name, text }); });
            }
        } catch (e) { console.warn('[Rival] talk', e); }
        return r;
    };
    if (CE._townBrief) { const _tb = CE._townBrief; CE._townBrief = function (world, ...rest) { const base = _tb.call(this, world, ...rest); try { const x = RIVAL.townBrief(world); if (x && typeof base === 'string') return base ? `${base}${t('；')}${x}` : x; } catch (e) {} return base; }; }
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset; World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.rival = null; return r; };
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.rival) d.rival = this.rival; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.rival = (data?.rival && typeof data.rival === 'object' && Array.isArray(data.rival.log)) ? data.rival : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.RIVAL = RIVAL;
