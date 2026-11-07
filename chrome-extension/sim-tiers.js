// v6.56.0 城鎮四級:村莊 → 城鎮 → 城市 → 王都
// - 每天依人口、繁榮度、科技時代判定;連續 3 天達標才升格,連續 10 天跌破才降級(不會忽上忽下)
// - 首長稱號跟著等級:村長／鎮長／市長(王都的國王在第二批加入);議會席次 3／5／7／9
// - 從政資歷:城鎮以上要當過下一級首長,或在本級議會當過一季議員,才能參選首長;沒人有資格就現任續任
// - 官職標籤:現任首長、議員、前任首長
// - 暫停的城鎮:回來時用公式補上離開期間的變化
const TIERS = (() => {
    const LV = [
        { key: 'village', zh: '村莊', en: 'Village', icon: '🏡', leader: '村長', leaderEn: 'Village Chief', council: '長老會', councilEn: 'Council of Elders', member: '長老', memberEn: 'Elder', seats: 3 },
        { key: 'town', zh: '城鎮', en: 'Town', icon: '🏘️', leader: '鎮長', leaderEn: 'Mayor', council: '鎮議會', councilEn: 'Town Council', member: '鎮議員', memberEn: 'Councillor', seats: 5, pop: 30, pros: 50, era: 1 },
        { key: 'city', zh: '城市', en: 'City', icon: '🏙️', leader: '市長', leaderEn: 'Lord Mayor', council: '市議會', councilEn: 'City Council', member: '市議員', memberEn: 'City Councillor', seats: 7, pop: 60, pros: 65, era: 2 },
        { key: 'capital', zh: '王都', en: 'Royal Capital', icon: '🏰', leader: '市長', leaderEn: 'Lord Mayor', council: '王都議會', councilEn: 'Capital Assembly', member: '議員', memberEn: 'Assembly Member', seats: 9, pop: 100, pros: 80, era: 3 },
    ];
    const UP_DAYS = 3, DOWN_DAYS = 10, COUNCIL_TERM = 15;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    function S(w) {
        if (!w.tierState || typeof w.tierState.lv !== 'number') {
            w.tierState = { lv: 0, up: 0, down: 0, since: day(w), history: [], career: {}, leaderId: null, council: [] };
            w.tierState.lv = Math.max(0, met(w)); // 第一次就直接定在目前條件(不放升格慶典)
        }
        const T = w.tierState; T.career = T.career || {}; T.history = T.history || []; T.council = T.council || [];
        return T;
    }
    const pros = (w) => w.prosperity?.prosperity ?? 0;
    const era = (w) => { try { return w.research?.currentEra?.() || 1; } catch (e) { return 1; } };
    // 目前條件最高能到哪一級
    function met(w) { const p = npcs(w).length, pr = pros(w), e = era(w); let lv = 0; for (let i = 1; i < LV.length; i++) { const L = LV[i]; if (p >= L.pop && pr >= L.pros && e >= L.era) lv = i; else break; } return lv; }
    const level = (w) => (w && w.tierState ? w.tierState.lv : 0);
    const info = (w) => LV[level(w)];
    const leaderTitle = (w, lv) => { const L = LV[lv ?? level(w)]; return en() ? L.leaderEn : L.leader; };
    const memberTitle = (w, lv) => { const L = LV[lv ?? level(w)]; return en() ? L.memberEn : L.member; };
    const name = (w, lv) => { const L = LV[lv ?? level(w)]; return en() ? L.en : L.zh; };
    const seats = (w) => LV[level(w)].seats;
    const leaderOf = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    // ---------- 從政紀錄 ----------
    // v6.84.0 每段任期多記:w 當選次數、init 開鎮首任、e 怎麼卸任、a/v 任內批准／否決幾案、b 任內大案(最多 4 件)
    //   首長(leader)只記正式掛職的人(出遠門、探險期間仍算任內);代理首長另記 acting,不算資歷、不掛「前首長」
    function open(T, id, role, lv, d, cont) {
        const c = T.career[id] || (T.career[id] = []);
        const dup = openOf(T, id, role); if (dup) { if (dup.lv === lv) return; close(T, id, role, d, 'promo'); cont = true; } // v6.84.0 同一職位不會同時開兩段
        const x = { role, lv, from: d, to: null };
        if (role === 'leader') { x.w = 0; if (cont) x.cont = 1; else if (!T._inElec) x.init = 1; const pw = T.pendWin?.[id]; if (pw) { x.w += pw; delete T.pendWin[id]; } }
        c.push(x); if (c.length > 16) c.splice(0, c.length - 16);
    }
    function close(T, id, role, d, e) { const c = T.career[id]; if (!c) return; for (let i = c.length - 1; i >= 0; i--) if (c[i].role === role && c[i].to === null) { c[i].to = d; if (e) c[i].e = e; break; } }
    function endWhy(w, T, id) {
        const h = T.endHint?.[id]; if (h) { delete T.endHint[id]; return h; }
        const a = w.agents?.[id]; if (a?.isDead) return 'died';
        if (!a) { const g = w.lifecycle?.graveyard || []; return g.some(x => x.agentId === id) ? 'died' : 'left'; }
        return 'ended';
    }
    function holderOf(w) {
        const E = w.election; if (!E || typeof E._officeHolder !== 'function') return leaderOf(w)?.agentId || null;
        try { return E._officeHolder(w)?.agentId || E._mayorTravelling?.(w)?.agentData?.agentId || null; } catch (e) { return null; }
    }
    function track(w, T) {
        const d = day(w), L = leaderOf(w), lid = L?.agentId || null, hid = holderOf(w), aid = (lid && lid !== hid) ? lid : null;
        if (T.holderId === undefined) T.holderId = T.leaderId ?? null; // v6.84.0 舊存檔:原本開著的首長紀錄屬於 leaderId
        if (hid !== T.holderId) { if (T.holderId) close(T, T.holderId, 'leader', d, endWhy(w, T, T.holderId)); if (hid) open(T, hid, 'leader', T.lv, d); T.holderId = hid; }
        if (aid !== (T.actingId || null)) { if (T.actingId) close(T, T.actingId, 'acting', d, 'ended'); if (aid) open(T, aid, 'acting', T.lv, d); T.actingId = aid; }
        T.leaderId = lid;
        const now = (w.council?.members || []).slice(); const prev = new Set(T.council); const cur = new Set(now);
        for (const id of prev) if (!cur.has(id)) close(T, id, 'council', d, endWhy(w, T, id));
        for (const id of cur) if (!prev.has(id)) open(T, id, 'council', T.lv, d);
        T.council = now;
    }
    function openOf(T, id, role) { const c = T.career[id] || []; for (let i = c.length - 1; i >= 0; i--) if (c[i].to === null && (!role || c[i].role === role)) return c[i]; return null; }
    function addWin(w, id) { if (!id) return; const T = S(w); const x = openOf(T, id, 'leader'); if (x) x.w = (x.w || 0) + 1; else { T.pendWin = T.pendWin || {}; T.pendWin[id] = (T.pendWin[id] || 0) + 1; } }
    // 任內拍板:記在當下拍板的人(正式首長或代理)那段任期上
    function onDecide(w, p, ok) {
        const T = S(w); const L = leaderOf(w); if (!L) return;
        const x = openOf(T, L.agentId, L.agentId === T.holderId ? 'leader' : 'acting') || openOf(T, L.agentId, 'leader'); if (!x) return;
        if (ok) x.a = (x.a || 0) + 1; else x.v = (x.v || 0) + 1;
        let major = !!p.council; try { if (!major && typeof ASSEMBLY !== 'undefined') major = ASSEMBLY.isMajor(w, p); } catch (e) {}
        if (major && p.tk) { x.b = x.b || []; x.b.push({ id: p.id, tk: p.tk, tp: p.tp || {}, ok: ok ? 1 : 0 }); if (x.b.length > 4) x.b.shift(); }
    }
    const terms = (x) => Math.max(1, (x.w || 0) + (x.init || x.cont ? 1 : 0));
    const SEAS = ['春季', '夏季', '秋季', '冬季'], SEAS_EN = ['Spring', 'Summer', 'Autumn', 'Winter'];
    function dateText(d) { const n = Math.max(0, (d || 1) - 1), y = Math.floor(n / 60) + 1, si = Math.floor((n % 60) / 15); return en() ? `Y${y} ${SEAS_EN[si]}` : `第${y}年${SEAS[si]}`; }
    const titleOf = (w, x) => x.role === 'council' ? memberTitle(w, x.lv) : x.role === 'acting' ? (en() ? 'Acting ' : '代理') + leaderTitle(w, x.lv) : leaderTitle(w, x.lv);
    const END = { lost: ['落選下台', 'lost re-election'], stepdown: ['沒有再參選，交棒', 'stepped down'], died: ['在任內過世', 'died in office'], left: ['離開了小鎮', 'left town'], promo: ['小鎮升降級，改任新職', 'office renamed when the town changed level'], ended: ['卸任', 'left office'] };
    const endText = (e) => { const z = END[e] || END.ended; return en() ? z[1] : t(z[0]); };
    function leaderNote(x) {
        const w = x.w || 0;
        if (x.init || x.cont) { const head = x.init ? (en() ? 'first in office when the town began' : t('開鎮首任')) : (en() ? 'stayed on after the town changed level' : t('小鎮升降級後續任'));
            return w ? (en() ? `${head}, then re-elected ${w} time(s)` : `${head}${t('，')}${t('之後連任')} ${w} ${t('次')}`) : head; }
        return w <= 1 ? (en() ? 'won the election' : t('選舉當選')) : (en() ? `won ${w} elections (${w} terms)` : `${t('當選')} ${w} ${t('次')}${t('（')}${w} ${t('屆')}${t('）')}`);
    }
    // 完整履歷(村民詳情):新的在前
    function resume(w, a) {
        const c = S(w).career[a?.agentId] || []; const nowD = day(w); const P = w.proposals;
        return c.filter(x => x.role !== 'acting' || ((x.to ?? nowD) - x.from) >= 2).slice().reverse().map(x => {
            const notes = [];
            if (x.role === 'leader') notes.push(leaderNote(x));
            if (x.a || x.v) notes.push(en() ? `approved ${x.a || 0}, vetoed ${x.v || 0}` : `${t('批准')} ${x.a || 0} ${t('案')}${t('、')}${t('否決')} ${x.v || 0} ${t('案')}`);
            if (x.to !== null) notes.push(endText(x.e));
            const bills = (x.b || []).slice().reverse().map(b => { let tt = b.tk; try { tt = P ? P._fill(b.tk, b.tp) : t(b.tk); } catch (e) {} return en() ? `${b.id} "${tt}" (${b.ok ? 'passed' : 'vetoed'})` : `${b.id}${t('「')}${tt}${t('」')}${t('（')}${b.ok ? t('通過') : t('否決')}${t('）')}`; });
            return { role: x.role, title: titleOf(w, x), period: `${dateText(x.from)} ～ ${x.to === null ? t('至今') : dateText(x.to)}`, current: x.to === null, notes, bills };
        });
    }
    // 摘要:同職位合併屆數(給 AI 與小卡)
    function summary(w, a) {
        const c = (S(w).career[a?.agentId] || []); if (!c.length) return [];
        const g = new Map(); const nowD = day(w);
        for (const x of c) { if (x.role === 'acting' && ((x.to ?? nowD) - x.from) < 2) continue; if (x.role === 'council' && x.to !== null && (x.to - x.from) < 5) continue;
            const k = x.role + x.lv; const o = g.get(k) || { role: x.role, lv: x.lv, n: 0, cur: false, last: 0, e: '' }; o.n += x.role === 'leader' ? terms(x) : 1; o.cur = o.cur || x.to === null; if (x.from >= o.last) { o.last = x.from; o.e = x.e || ''; } g.set(k, o); }
        return [...g.values()].sort((p, q) => (q.cur - p.cur) || (q.last - p.last));
    }
    function careerText(w, a) {
        return summary(w, a).slice(0, 3).map(o => { const ti = titleOf(w, o); const n = o.role === 'leader' && o.n > 1 ? (en() ? ` ×${o.n}` : `${t('（')}${o.n} ${t('屆')}${t('）')}`) : ''; return (o.cur ? (en() ? 'current ' : '現任') : (en() ? 'former ' : '前')) + ti + n; }).join(en() ? ', ' : '、');
    }
    // 給 AI 的一句話:讓他一直記得自己當過什麼
    function careerBrief(w, a) {
        const s = summary(w, a); if (!s.length) return '';
        const bits = s.slice(0, 3).map(o => { const ti = titleOf(w, o); if (en()) return `${o.cur ? 'currently ' : 'formerly '}${ti}${o.role === 'leader' ? ` (${o.n} term${o.n > 1 ? 's' : ''}${!o.cur && o.e ? ', ' + endText(o.e) : ''})` : ''}`;
            const n = o.role === 'leader' && o.n > 1 ? o.n : 0;
            if (o.cur) return `${t('現任')}${ti}${n ? `${t('（')}${t('第')} ${n} ${t('屆')}${t('）')}` : ''}`;
            return `${t('當過')}${n ? ` ${n} ${t('屆')}` : ''}${ti}${o.role === 'leader' && o.e ? `${t('（')}${endText(o.e)}${t('）')}` : ''}`; });
        return en() ? `Your political career: ${bits.join('; ')}.` : `${t('你的從政經歷')}${t('：')}${bits.join(t('；'))}${t('。')}`;
    }
    // 墓誌銘用:最高的官職
    function topOffice(w, a) {
        const s = summary(w, a).filter(o => o.role !== 'acting'); if (!s.length) return null;
        s.sort((p, q) => ((q.role === 'leader') - (p.role === 'leader')) || (q.lv - p.lv) || (q.n - p.n)); const o = s[0];
        return { title: titleOf(w, o), n: o.role === 'leader' ? o.n : 0 };
    }
    // 參選首長的資格
    function qualified(w, a) {
        const T = S(w); if (!a || T.lv === 0) return true;
        if (a.job?.key === 'mayor') return true;
        const c = T.career[a.agentId] || [], d = day(w);
        return c.some(x => (x.role === 'leader' && x.lv >= T.lv - 1) || (x.role === 'council' && x.lv >= T.lv && ((x.to ?? d) - x.from) >= COUNCIL_TERM));
    }
    // 角色卡／名牌上的官職標籤
    function badge(w, a) {
        if (!w || !a) return null; const T = S(w);
        if (T.leaderId === a.agentId) return { cls: 'leader', icon: '🎖️', text: (T.actingId === a.agentId ? (en() ? 'Acting ' : '代理') : '') + leaderTitle(w) };
        if ((w.council?.members || []).includes(a.agentId)) return { cls: 'council', icon: '🏛️', text: memberTitle(w) };
        const c = T.career[a.agentId] || []; const fl = c.filter(x => x.role === 'leader' && x.to !== null).sort((x, y) => y.lv - x.lv)[0];
        if (fl) return { cls: 'former', icon: '📜', text: (en() ? 'Former ' : '前') + leaderTitle(w, fl.lv) };
        return null;
    }
    // 職業欄的「鎮長」也跟著等級改(角色卡、名單、AI 角色資料都讀這個)
    function syncTitles(w) { const title = leaderTitle(w); for (const a of npcs(w)) if (a.job?.key === 'mayor' && a.job.title !== title) { if (a.job === (typeof JOB_DEFS !== 'undefined' ? JOB_DEFS.mayor : null)) a.job = Object.assign({}, a.job); a.job.title = title; } }
    // ---------- 每天 ----------
    function daily(w) {
        const T = S(w); track(w, T); syncTitles(w);
        const target = (typeof TIERS !== 'undefined' ? TIERS.met : met)(w), d = day(w);
        if (target > T.lv) { T.up++; T.down = 0; if (T.up >= UP_DAYS) {
            T.up = UP_DAYS;
            // v6.77.0 升格要擴建鎮公所:木材、石材(城市以上加金屬)不夠就先等,連續達標的天數留著
            const mat = (typeof ECON !== 'undefined') ? ECON.tierMat(T.lv + 1) : null;
            const canMat = !mat || (typeof FLOW !== 'undefined' ? FLOW.canPay(w, mat) : w.stockpile?.canAfford?.(mat));
            if (T.readySince == null) T.readySince = d;
            if (!canMat) { if (!T.waitMat || d - T.waitMat >= 5) { T.waitMat = d; try { w.logMessageT?.('event', '🏗️ 已經夠格升格為{n}，但擴建鎮公所的{m}還不夠，得先備料。', { n: LV[T.lv + 1].zh, m: ECON.matText(ECON.lack(w, mat)) }); } catch (e) {} } }
            // v6.81.0 升格要村民提案、投票、首長批准(觀察者模式);太久都沒升(60 天)才直接升,免得卡死
            else if (!needsVote(w) || d - T.readySince >= 60) { if (needsVote(w)) { try { w.logMessageT?.('event', '🏛️ 升格案拖了好久，鎮公所決定直接擴建、正式升格。', {}); } catch (e) {} } promote(w); }
        } }
        else if (target < T.lv) { T.down++; T.up = 0; if (T.down >= DOWN_DAYS) change(w, T, T.lv - 1); }
        else { T.up = 0; T.down = 0; T.readySince = null; }
    }
    // v6.81.0 觀察者模式下升格要走提案(有提案系統時)
    function needsVote(w) { return !!(w && w.observerMode && w.proposals); }
    const metNow = (w) => (typeof TIERS !== 'undefined' ? TIERS.met : met)(w);
    function ready(w) { const T = S(w); return T.up >= UP_DAYS && metNow(w) > T.lv; }
    // 提案通過後執行升格:再確認一次還夠格、付建材
    function promote(w) {
        const T = S(w); if (!(metNow(w) > T.lv)) return { ok: false, error: '現在不夠格了' };
        const mat = (typeof ECON !== 'undefined') ? ECON.tierMat(T.lv + 1) : null;
        if (mat && !(typeof FLOW !== 'undefined' ? FLOW.canPay(w, mat) : w.stockpile?.canAfford?.(mat))) return { ok: false, error: '擴建鎮公所的建材不夠' };
        if (mat) { if (typeof FLOW !== 'undefined') FLOW.pay(w, mat, t('擴建鎮公所')); else w.stockpile.pay(mat, w.tickCount, t('擴建鎮公所')); }
        T.waitMat = null; T.readySince = null; change(w, T, T.lv + 1); return { ok: true };
    }
    function change(w, T, nl) {
        const old = T.lv, d = day(w); T.lv = nl; T.up = 0; T.down = 0; T.since = d; T.history.push({ lv: nl, day: d }); if (T.history.length > 20) T.history.shift();
        // 首長換稱號:現任直接接任升格後的職位
        if (T.holderId === undefined) T.holderId = T.leaderId ?? null;
        if (T.holderId) { close(T, T.holderId, 'leader', d, 'promo'); open(T, T.holderId, 'leader', nl, d, true); } // v6.84.0 升降級改稱:新稱號記成「續任」
        if (T.actingId) { close(T, T.actingId, 'acting', d, 'promo'); open(T, T.actingId, 'acting', nl, d); }
        for (const id of T.council) close(T, id, 'council', d, 'promo');
        let reformed = false; try { if (w.council?._formed) { w.council._formCouncil(w); T.council = []; track(w, T); reformed = true; } } catch (e) {}
        if (!reformed) for (const id of T.council) open(T, id, 'council', nl, d);
        const up = nl > old, L = LV[nl], Lo = LV[old];
        const p = { from: Lo.zh, to: L.zh, icon: L.icon };
        try { w.logMessageT?.('event', up ? '{icon} 鎮上人口和繁榮都夠了，正式從{from}升格為{to}！' : '{icon} 人口和繁榮掉下來，{from}降回了{to}。', p); } catch (e) {}
        try { w.dailyNews?.collectEvent?.('politics', up ? `${t(Lo.zh)}→${t(L.zh)}${t('：正式升格')}` : `${t(Lo.zh)}→${t(L.zh)}${t('：降級')}`, 9, []); } catch (e) {}
        for (const a of npcs(w)) { a.moodModifier = (a.moodModifier || 0) + (up ? 6 : -6); mem(w, a, up ? '我們這裡從{from}升格成{to}了，以後會越來越熱鬧。' : '我們這裡從{from}降回{to}了，人越來越少……', p, up ? 6 : 5); }
        syncTitles(w);
        try { w.onTierChange?.(nl, old); } catch (e) {}
    }
    // 進度(下一級還差什麼)
    function progress(w) {
        const T = S(w); const nx = LV[T.lv + 1]; if (!nx) return null;
        const mat = (typeof ECON !== 'undefined') ? ECON.tierMat(T.lv + 1) : null; // v6.77.0 擴建鎮公所的建材
        return { next: nx, pop: [npcs(w).length, nx.pop], pros: [Math.round(pros(w)), nx.pros], era: [era(w), nx.era], streak: T.up, need: UP_DAYS, mat, matLack: mat ? ECON.lack(w, mat) : {} };
    }
    // ---------- 稱號換字(介面、紀錄、記憶、AI 提示詞都走 t()) ----------
    const RE_EN = /(?<![Ll]ord )\b(Acting )?([Mm])ayor\b/g; // 「Lord Mayor」本身不再換(避免換兩次)
    function retitle(s) {
        if (typeof s !== 'string' || !s) return s;
        const w = typeof window !== 'undefined' && window.rimtownApp?.world; const lv = w?.tierState?.lv;
        if (lv === undefined || lv === 1) return s;
        const L = LV[lv];
        if (s.indexOf('鎮長') >= 0) s = s.split('鎮長').join(L.leader);
        if (s.indexOf('ayor') >= 0) s = s.replace(RE_EN, (m, acting, M) => (acting || '') + (M === 'M' ? L.leaderEn : L.leaderEn.toLowerCase()));
        return s;
    }
    // ---------- 暫停城鎮回來補變化 ----------
    function catchUp(w, days) {
        if (!(days >= 2) || !w.prosperity) return null;
        const n = Math.min(days, 60); const p0 = w.prosperity.prosperity || 0;
        const drift = Math.max(-12, Math.min(12, (50 - p0) * Math.min(0.6, n * 0.02) + (Math.random() - 0.5) * Math.min(8, n * 0.4)));
        w.prosperity.prosperity = Math.max(0, Math.min(100, p0 + drift));
        const notes = [];
        notes.push(drift >= 1 ? '繁榮度慢慢回升了一些' : drift <= -1 ? '少了外人走動，繁榮度掉了一些' : '日子大致照舊');
        const pool = ['辦了一場小小的市集', '下過幾場大雨', '有旅人路過留下了傳聞', '幾對年輕人走得很近', '鎮民湊錢修了路'];
        notes.push(pool[Math.floor(Math.random() * pool.length)]);
        try { w.logMessageT?.('event', '🕰️ 你不在的 {n} 天裡，鎮上{a}，也{b}。', { n, a: notes[0], b: notes[1] }); } catch (e) {}
        for (const a of npcs(w).slice(0, 6)) mem(w, a, '這{n}天鎮上{a}。', { n, a: notes[1] }, 3);
        return { days: n, drift: Math.round(drift) };
    }
    return { LV, S, syncTitles, met, level, info, name, leaderTitle, memberTitle, seats, qualified, careerText, careerBrief, resume, summary, topOffice, dateText, addWin, onDecide, track: (w) => track(w, S(w)), badge, daily, progress, retitle, catchUp, UP_DAYS, DOWN_DAYS, promote, ready, needsVote };
})();

// ---- 每天跑(跟其他模組一樣掛在提案系統的每日更新)
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) {
        const r = _daily.call(this, w, ...rest);
        try { const d = this._abs(w); if (this._tierDay !== d) { this._tierDay = d; TIERS.daily(w); } } catch (e) { console.warn('[Tiers] daily', e); }
        return r;
    };
}
// ---- 議會席次跟著等級
if (typeof CouncilSystem !== 'undefined') {
    const CS = CouncilSystem.prototype; const _form = CS._formCouncil;
    CS._formCouncil = function (world) {
        _form.call(this, world);
        try {
            const want = Math.min(TIERS.seats(world), Math.max(3, Math.floor(Object.values(world.agents).filter(a => !a.isPlayer).length / 3)));
            if (this.members.length && this.members.length !== want) {
                const have = new Set(this.members);
                const extra = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && !have.has(a.agentId)).sort((x, y) => (y.age || 0) - (x.age || 0) + (Math.random() - 0.5) * 20);
                this.members = this.members.slice(0, want); while (this.members.length < want && extra.length) this.members.push(extra.shift().agentId);
            }
        } catch (e) {}
    };
}
// ---- v6.81.0 議員出缺就遞補:以前有人搬走、過世或只是出遠門,席次就空著,要等議會少到剩一人才整個重組
if (typeof CouncilSystem !== 'undefined') {
    const CS = CouncilSystem.prototype; const _du = CS.dailyUpdate;
    const seatScore = (world, a) => { let s = 0; if (a.age >= 35) s += 3; if (a.age >= 45) s += 2; s += (a.skills?.skills?.社交?.level || 0) * 2; s += ((a.mood || 50) + 50) / 25; const tr = a.personality?.traits || []; if (tr.includes('hardworking')) s += 2; if (tr.includes('kind')) s += 2; if (tr.includes('charismatic')) s += 2; if (tr.includes('lazy')) s -= 3; if (tr.includes('abrasive')) s -= 2; try { s += (TIERS.S(world).career[a.agentId] || []).length * 1.5; } catch (e) {} return s + Math.random() * 3; };
    const refillSeats = function (world, occupied = 0) {
        const all = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead);
        const want = Math.min(TIERS.seats(world), Math.max(3, Math.floor(all.length / 3)));
        if (this.members.length + occupied >= want) return 0;
        const have = new Set(this.members); const leaderId = world.election?._officeHolder?.(world)?.agentId;
        const cands = all.filter(a => !have.has(a.agentId) && a.agentId !== leaderId && (a.age || 0) >= 18).map(a => [a, seatScore(world, a)]).sort((x, y) => y[1] - x[1]);
        let n = 0; const lv = TIERS.level(world), L = TIERS.LV[lv];
        while (this.members.length + occupied < want && cands.length) { const [a] = cands.shift(); this.members.push(a.agentId); n++;
            try { world.logMessageT('council', '🏛️ {council}有空位，大家推舉{name}遞補為{member}。', { council: L.council, name: a.name, member: L.member }, a.name); } catch (e) {}
            try { a.memory?.addT?.(world.tickCount, world.clock?.timeStr || '', 'social', '大家推舉我進{council}，我得好好做。', { council: L.council }, 7, []); } catch (e) {} }
        return n;
    };
    CS.dailyUpdate = function (world) {
        let awayMembers = [];
        try {
            if (this._formed) {
                // 先處理席次再讓原本的流程跑(原本有人離開就只刪不補,剩一人時整個議會解散)
                const away = new Set((world.events?._travellingAgents || []).map(x => x?.agentData?.agentId).filter(Boolean));
                awayMembers = (this.members || []).filter(id => !world.agents[id] && away.has(id)); // 出遠門的人保留席次
                this.members = (this.members || []).filter(id => world.agents[id]);
                refillSeats.call(this, world, awayMembers.length);
            }
        } catch (e) { console.warn('[Council] refill', e); }
        const r = _du.call(this, world);
        try { if (this._formed) for (const id of awayMembers) if (!this.members.includes(id)) this.members.push(id); } catch (e) {}
        return r;
    };
}
// ---- 選舉:城鎮以上要有資歷才能參選
if (typeof ElectionSystem !== 'undefined') {
    const ES = ElectionSystem.prototype; const _start = ES._startElection;
    ES._startElection = function (world, opts = {}) {
        let T; try { T = TIERS.S(world); } catch (e) { return _start.call(this, world, opts); }
        if (!T.lv) return _start.call(this, world, opts);
        const base = ES._residents; const all = base.call(this, world); const ok = all.filter(a => TIERS.qualified(world, a));
        if (ok.length >= 2) { this._residents = () => ok; try { return _start.call(this, world, opts); } finally { delete this._residents; } }
        if (ok.length === 1 && !opts.byElection) {
            const a = ok[0]; try { world.logMessageT('event', '🎖️ 只有{name}有資歷參選{title}，不用選舉，直接續任。', { name: a.name, title: TIERS.leaderTitle(world) }, a.name); } catch (e) {}
            try { a.memory?.addT?.(world.tickCount, world.clock.timeStr, 'election', '沒有人有資格跟我競爭，我直接續任了。', {}, 7, []); } catch (e) {}
            try { if (T.holderId === a.agentId) TIERS.addWin(world, a.agentId); } catch (e) {} // v6.84.0 直接續任也算一屆
            return;
        }
        try { world.logMessageT('event', '📢 鎮上還沒有人有足夠資歷，這一屆開放所有人參選。', {}); } catch (e) {}
        return _start.call(this, world, opts);
    };
}
// ---- v6.84.0 從政履歷:開票記當選／落選、任內拍板記批准／否決與大案、AI 記得自己的官職、墓誌銘寫最高官職
if (typeof ElectionSystem !== 'undefined') {
    const ES = ElectionSystem.prototype; const _ar = ES._announceResults;
    ES._announceResults = function (world, ...rest) {
        let T = null, before = null, cands = null; const n0 = (this.electionHistory || []).length;
        try { T = TIERS.S(world); TIERS.track(world); before = T.holderId || null; cands = new Set((this.candidates || []).map(c => c.agentId)); T._inElec = true; } catch (e) {}
        let r;
        try {
            r = _ar.call(this, world, ...rest);
            try {
                const H = this.electionHistory || [];
                if (T && H.length > n0) {
                    const wid = H[H.length - 1]?.winner?.agentId || null;
                    if (before && wid && before !== wid) { T.endHint = T.endHint || {}; T.endHint[before] = cands.has(before) ? 'lost' : 'stepdown'; }
                    TIERS.track(world); TIERS.addWin(world, wid);
                }
            } catch (e) { console.warn('[Career] election', e); }
        } finally { if (T) T._inElec = false; }
        return r;
    };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _dc = PS._decide;
    PS._decide = function (w, p, action, by, ...rest) {
        const r = _dc.call(this, w, p, action, by, ...rest);
        try { if (by === 'mayor' && (p.status === 'approved' || p.status === 'rejected' || p.status === 'done' || p.status === 'failed')) TIERS.onDecide(w, p, p.status !== 'rejected'); } catch (e) {}
        return r;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief, _cp = CE._buildCharacterProfile;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = TIERS.careerBrief(world, a); if (s) { const m = b.mem || []; b.mem = [...m.slice(0, 1), s, ...m.slice(1)]; } } catch (e) {} return b; };
    CE._buildCharacterProfile = function (agent) { const p = _cp.call(this, agent); try { const w = this._world || (typeof window !== 'undefined' && window.rimtownApp?.world); const s = w && TIERS.careerBrief(w, agent); if (s) p.status = `${p.status}${t('；')}${s}`; } catch (e) {} return p; };
}
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _ep = LS._generateEpitaph;
    LS._generateEpitaph = function (npc, ...rest) {
        const s = _ep.call(this, npc, ...rest);
        try {
            const w = (typeof window !== 'undefined' && window.rimtownApp?.world) || null; const o = w && TIERS.topOffice(w, npc); if (!o) return s;
            const isEn = typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
            const head = isEn ? `Served ${o.n > 1 ? o.n + ' terms ' : ''}as ${o.title}` : `曾任${o.n > 1 ? `${o.n} 屆` : ''}${o.title}`;
            const job = npc.job ? `${t('曾任')}${npc.job.title}` : '';
            if (job && s.startsWith(job)) return head + s.slice(job.length);
            return head + (isEn ? '. ' : '，') + s;
        } catch (e) { return s; }
    };
}
// ---- 存讀檔、新城鎮清空、回來補變化
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.tierState = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () {
        const d = _ser.call(this);
        if (d && this.tierState) d.tierState = this.tierState;
        try { if (d && typeof TownGen !== 'undefined') d.savedGlobalDay = TownGen.registry().days || 0; } catch (e) {}
        return d;
    };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) {
        const r = _load.call(this, data);
        try {
            if (r) {
                this.tierState = (data?.tierState && typeof data.tierState.lv === 'number') ? data.tierState : null;
                TIERS.S(this); TIERS.syncTitles(this);
                if (typeof TownGen !== 'undefined' && Number.isFinite(data?.savedGlobalDay)) { const now = TownGen.registry().days || 0; this._catchUp = TIERS.catchUp(this, now - data.savedGlobalDay); }
            }
        } catch (e) {}
        return r;
    };
}
// ---- 稱號換字:包住全域 t()
if (typeof window !== 'undefined' && typeof window.t === 'function' && !window.t._tiers) {
    // v6.76.2 換字結果快取:城鎮等級或語言(I18N._ver)一變就整批作廢;長段落不進快取
    const _t = window.t; const _rc = new Map(); let _rk = '';
    const wrapped = function (x) {
        if (typeof x !== 'string' || x.length > 400 || arguments.length > 1) return TIERS.retitle(_t.apply(this, arguments));
        const lv = window.rimtownApp?.world?.tierState?.lv; const k = (window.I18N?._ver || 0) + ':' + lv; // lv 從 0 起算(0=村莊),不能用 || 合併
        if (k !== _rk) { _rc.clear(); _rk = k; }
        let r = _rc.get(x);
        if (r === undefined) { r = TIERS.retitle(_t(x)); if (_rc.size >= 20000) _rc.clear(); _rc.set(x, r); }
        return r;
    };
    wrapped._tiers = true; window.t = wrapped;
}
if (typeof globalThis !== 'undefined') globalThis.TIERS = TIERS;
