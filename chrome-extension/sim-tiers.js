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
    function open(T, id, role, lv, d) { const c = T.career[id] || (T.career[id] = []); c.push({ role, lv, from: d, to: null }); if (c.length > 12) c.splice(0, c.length - 12); }
    function close(T, id, role, d) { const c = T.career[id]; if (!c) return; for (let i = c.length - 1; i >= 0; i--) if (c[i].role === role && c[i].to === null) { c[i].to = d; break; } }
    function track(w, T) {
        const d = day(w), L = leaderOf(w), lid = L?.agentId || null;
        if (lid !== T.leaderId) { if (T.leaderId) close(T, T.leaderId, 'leader', d); if (lid) open(T, lid, 'leader', T.lv, d); T.leaderId = lid; }
        const now = (w.council?.members || []).slice(); const prev = new Set(T.council); const cur = new Set(now);
        for (const id of prev) if (!cur.has(id)) close(T, id, 'council', d);
        for (const id of cur) if (!prev.has(id)) open(T, id, 'council', T.lv, d);
        T.council = now;
    }
    // 參選首長的資格
    function qualified(w, a) {
        const T = S(w); if (!a || T.lv === 0) return true;
        if (a.job?.key === 'mayor') return true;
        const c = T.career[a.agentId] || [], d = day(w);
        return c.some(x => (x.role === 'leader' && x.lv >= T.lv - 1) || (x.role === 'council' && x.lv >= T.lv && ((x.to ?? d) - x.from) >= COUNCIL_TERM));
    }
    function careerText(w, a) {
        const c = (S(w).career[a?.agentId] || []).filter(x => x.role === 'leader' || ((x.to ?? day(w)) - x.from) >= 5);
        if (!c.length) return '';
        const seen = new Set(); const out = [];
        for (const x of c.slice().reverse()) { const k = x.role + x.lv; if (seen.has(k)) continue; seen.add(k); out.push((x.to === null ? '' : (en() ? 'former ' : '前')) + (x.role === 'leader' ? leaderTitle(w, x.lv) : memberTitle(w, x.lv))); }
        return out.slice(0, 3).join(en() ? ', ' : '、');
    }
    // 角色卡／名牌上的官職標籤
    function badge(w, a) {
        if (!w || !a) return null; const T = S(w);
        if (T.leaderId === a.agentId) return { cls: 'leader', icon: '🎖️', text: leaderTitle(w) };
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
        if (T.leaderId) { close(T, T.leaderId, 'leader', d); open(T, T.leaderId, 'leader', nl, d); }
        for (const id of T.council) { close(T, id, 'council', d); open(T, id, 'council', nl, d); }
        try { if (w.council?._formed) { w.council._formCouncil(w); T.council = []; track(w, T); } } catch (e) {}
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
    return { LV, S, syncTitles, met, level, info, name, leaderTitle, memberTitle, seats, qualified, careerText, badge, daily, progress, retitle, catchUp, UP_DAYS, DOWN_DAYS, promote, ready, needsVote };
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
    CS._refillSeats = function (world, occupied = 0) {
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
                this._refillSeats(world, awayMembers.length);
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
            return;
        }
        try { world.logMessageT('event', '📢 鎮上還沒有人有足夠資歷，這一屆開放所有人參選。', {}); } catch (e) {}
        return _start.call(this, world, opts);
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
