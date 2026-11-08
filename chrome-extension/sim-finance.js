// v7.0.0 金融改版第一階段(盡量簡化、金流守恆)
// ── 浮動物價 PRICES ──
// - 三種民生物價:糧(三餐)、衣(衣服)、柴(柴火)。各有一個指數,1 = 原價,上下限 0.6～2.5
// - 每天看「倉裡還夠用幾天」決定目標價(越少越貴),指數每天往目標移 6%,不會一夕暴漲暴跌
// - 村民買三餐、衣服、柴火照指數付錢;多付的錢照舊付給農莊、食堂、布莊、木作坊的老闆(或公庫),鎮上的銀幣總數不變
// - 工資不會自動跟著漲:物價一漲,最先吃不消的是窮人;漲過門檻會上日報、窮人心情變差,救濟、最低工資的提案變多
// ── 就業市場 LABOR ──
// - 每種職業的職缺 = 成年人口 × 比例(農夫最多、神職最少;糧價高時農夫缺多兩成),首長不算
// - 每週一次:人太多的行業先裁掉最不擅長的人(每週最多 2 人)→ 沒工作的人挑一個職缺(看擅長的技能、興趣、工資)→ 人太多的行業有一人轉行
// - 沒有職缺就失業:沒工資,只能靠存款、家人或救濟;鎮上出生的孩子滿 16 歲也要自己找工作
// - 移民優先補鎮上缺的職業
const PRICES = (() => {
    const KEYS = ['food', 'cloth', 'fuel'];
    const MIN = 0.6, MAX = 2.5, STEP = 0.06;
    const ZH = { food: '糧價', cloth: '衣價', fuel: '柴價' }, ICON = { food: '🍚', cloth: '👕', fuel: '🔥' };
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const clamp = (v) => Math.max(MIN, Math.min(MAX, v));
    const log = (w, k, p) => { try { w.logMessageT?.('economy', k, p || {}); } catch (e) {} };
    function S(w) {
        if (!w.prices || typeof w.prices.idx !== 'object') w.prices = { idx: { food: 1, cloth: 1, fuel: 1 }, lastDay: null, band: { food: 0, cloth: 0, fuel: 0 }, hist: [] };
        const P = w.prices; for (const k of KEYS) { if (typeof P.idx[k] !== 'number') P.idx[k] = 1; if (typeof P.band?.[k] !== 'number') (P.band = P.band || {})[k] = 0; } P.hist = P.hist || [];
        return P;
    }
    const idx = (w, k) => { try { return w.prices ? (S(w).idx[k] || 1) : 1; } catch (e) { return 1; } };
    // 倉裡還夠用幾天(各自的日常用量);目標價 = √(參考天數 ÷ 夠用天數)
    function stockDays(w) {
        const sp = w.stockpile; if (!sp) return null; const pop = Math.max(1, npcs(w).length);
        const winter = w.clock?.season === '冬季';
        return {
            food: ((sp.get('food') || 0) + (sp.get('meals') || 0)) / (pop * 1.5),
            cloth: ((sp.get('clothing') || 0) + (sp.get('cloth') || 0) * 0.5) / (pop * (winter ? 0.06 : 0.03)),
            fuel: (sp.get('wood') || 0) / (pop * (winter ? 0.3 : 0.08)),
        };
    }
    const REF = { food: 25, cloth: 40, fuel: 8 }; // 參考天數:夠用這麼多天時是原價
    function target(days) { const o = {}; for (const k of KEYS) o[k] = clamp(Math.sqrt(REF[k] / Math.max(0.4, days[k]))); return o; }
    function daily(w) {
        const P = S(w), d = day(w); if (P.lastDay === d) return; P.lastDay = d;
        const days = stockDays(w); if (!days) return; const tg = target(days);
        for (const k of KEYS) {
            const old = P.idx[k]; const gap = tg[k] - old; let dv = gap * STEP; if (Math.abs(dv) < 0.004) dv = Math.sign(gap) * Math.min(Math.abs(gap), 0.004); // 每天往目標移 6%,最少 0.004(不然尾巴永遠到不了)
            const v = clamp(old + dv); P.idx[k] = Math.round(v * 1000) / 1000;
            // 跨過門檻才報:1.3、1.6、2.0 倍上漲,回到 1.15 以下算回穩
            const band = v >= 2 ? 3 : v >= 1.6 ? 2 : v >= 1.3 ? 1 : 0;
            if (band > P.band[k]) { log(w, '📈 {i}{p}漲到原本的 {x} 倍。', { i: ICON[k], p: t(ZH[k]), x: P.idx[k].toFixed(1) }); try { w.dailyNews?.collectEvent?.('economy', `${t(ZH[k])}${t('上漲')} ${P.idx[k].toFixed(1)}×`, 5 + band, []); } catch (e) {} P.band[k] = band; }
            else if (P.band[k] > 0 && v < 1.15) { log(w, '📉 {i}{p}回穩了。', { i: ICON[k], p: t(ZH[k]) }); P.band[k] = 0; }
            else if (band < P.band[k] - 1) P.band[k] = band + 1;
        }
        if (d % 3 === 0) { P.hist.push([d, P.idx.food, P.idx.cloth, P.idx.fuel]); if (P.hist.length > 40) P.hist.splice(0, P.hist.length - 40); }
        // 物價高,窮人先吃不消
        if (P.idx.food >= 1.4 || (P.idx.fuel >= 1.6 && w.clock?.season === '冬季')) for (const a of npcs(w)) { const b = typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 50; if (b < 20) a.addThought?.('prices_high', w); }
    }
    const word = (v) => v >= 1.6 ? t('很貴') : v >= 1.2 ? t('偏貴') : v <= 0.8 ? t('便宜') : t('平穩');
    function brief(w) { if (!w.prices) return ''; const P = S(w); return `${t('物價')}${t('：')}${KEYS.map(k => `${t(ZH[k])} ${P.idx[k].toFixed(1)}×${t('（')}${word(P.idx[k])}${t('）')}`).join(t('、'))}`; }
    function view(w) { const P = S(w); return KEYS.map(k => ({ k, icon: ICON[k], name: t(ZH[k]), v: P.idx[k], word: word(P.idx[k]), trend: (() => { const h = P.hist; if (h.length < 2) return 0; const i = KEYS.indexOf(k) + 1; const dv = h[h.length - 1][i] - h[Math.max(0, h.length - 4)][i]; return dv > 0.04 ? 1 : dv < -0.04 ? -1 : 0; })() })); }
    return { S, KEYS, MIN, MAX, idx, daily, stockDays, target, brief, view, word };
})();

const LABOR = (() => {
    // 每種職業的職缺比例(成年人口的幾成);首長由選舉決定,不在這裡
    const RATIO = { farmer: 0.24, cook: 0.08, tailor: 0.06, carpenter: 0.08, miner: 0.08, blacksmith: 0.06, trader: 0.08, guard: 0.07, doctor: 0.05, researcher: 0.07, priest: 0.04 };
    const PRIMARY = { farmer: '種植', cook: '烹飪', tailor: '工藝', carpenter: '建造', miner: '採礦', blacksmith: '工藝', trader: '社交', guard: '射擊', doctor: '醫療', researcher: '智識', priest: '社交' };
    const ADULT = 16;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const jt = (k) => { try { return (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS[k]?.title) || k; } catch (e) { return k; } };
    const adult = (a) => (a.age ?? 30) >= ADULT;
    const isBoss = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    function S(w) {
        if (!w.labor || typeof w.labor !== 'object') w.labor = { lastWeek: null, jobless: {}, stats: { hired: 0, laidOff: 0, switched: 0, grads: 0 } };
        const L = w.labor; L.jobless = L.jobless || {}; L.stats = L.stats || { hired: 0, laidOff: 0, switched: 0, grads: 0 }; return L;
    }
    function slots(w, all) {
        const n = (all || npcs(w)).filter(a => adult(a) && a.job?.key !== 'mayor').length; const out = {};
        const foodHot = typeof PRICES !== 'undefined' && PRICES.idx(w, 'food') >= 1.3;
        for (const [k, r] of Object.entries(RATIO)) out[k] = Math.max(1, Math.ceil(n * r * (k === 'farmer' && foodHot ? 1.2 : 1)));
        return out;
    }
    function filled(all) { const c = {}; for (const a of all) { const k = a.job?.key; if (k && RATIO[k] !== undefined) c[k] = (c[k] || 0) + 1; } return c; }
    const skillOf = (a, k) => { try { const s = a.skills?.get?.(PRIMARY[k]); if (!s) return 0; return (s.level || 0) + ({ '狂熱': 5, '大': 3, '微': 1 }[s.passion] || 0) - (s.isIncapable ? 20 : 0); } catch (e) { return 0; } };
    const wage = (k) => (typeof WALLET !== 'undefined' && WALLET.WAGE?.[k]) || 4;
    function setJob(w, a, k) { if (typeof Job === 'undefined' || typeof JOB_DEFINITIONS === 'undefined' || !JOB_DEFINITIONS[k]) return false; a.job = new Job(k); return true; }
    // 一位沒工作的人挑最適合的職缺(擅長＋興趣＋工資)
    function bestOpening(a, open) { let best = null, bs = -1e9; for (const [k, n] of Object.entries(open)) { if (n <= 0) continue; const s = skillOf(a, k) + wage(k) * 0.6 + Math.random() * 2; if (s > bs) { bs = s; best = k; } } return best; }
    function weekly(w) {
        const L = S(w), d = day(w), wk = Math.floor(d / 7); if (L.lastWeek === wk) return; L.lastWeek = wk;
        const all = npcs(w).filter(a => !(w.isAway?.(a.agentId))); const sl = slots(w, all); let fl = filled(all);
        // 1) 裁員:人比職缺多出兩成以上的行業,裁掉最不擅長的人(老闆本人、工會領袖不裁),每週最多 2 人
        let cut = 0;
        for (const k of Object.keys(RATIO).sort((x, y) => ((fl[y] || 0) - sl[y]) - ((fl[x] || 0) - sl[x]))) {
            if (cut >= 2) break; const n = fl[k] || 0; if (n <= sl[k] + 1 || n <= sl[k] * 1.2) continue;
            const pool = all.filter(a => a.job?.key === k && !isBoss(w, a) && w.union?.leader !== a.agentId).sort((x, y) => skillOf(x, k) - skillOf(y, k));
            const a = pool[0]; if (!a) continue; a.job = null; L.jobless[a.agentId] = d; L.stats.laidOff++; cut++; fl[k] = n - 1;
            a.addThought?.('laid_off', w); mem(w, a, '{j}的人太多了，我被裁掉了，得重新找工作。', { j: t(jt(k)) }, 7);
            log(w, '📉 {j}的人手過剩，{a}被裁員了。', { j: t(jt(k)), a: a.name }, a.name);
        }
        // 2) 求職:沒工作的成年人照擅長、興趣、工資挑職缺;滿 16 歲的孩子也在這裡第一次找工作
        const open = {}; for (const k of Object.keys(RATIO)) open[k] = sl[k] - (fl[k] || 0);
        const seekers = all.filter(a => adult(a) && !a.job).sort(() => Math.random() - 0.5);
        for (const a of seekers) {
            const k = bestOpening(a, open);
            if (!k) { if (L.jobless[a.agentId] == null) L.jobless[a.agentId] = d; a.addThought?.('jobless', w); continue; }
            const first = L.jobless[a.agentId] == null && (a.age ?? 30) < ADULT + 4; // 第一次找工作
            if (!setJob(w, a, k)) continue; open[k]--; fl[k] = (fl[k] || 0) + 1; delete L.jobless[a.agentId]; L.stats.hired++; if (first) L.stats.grads++;
            mem(w, a, first ? '我找到第一份工作了：當{j}。' : '總算找到工作了，以後當{j}。', { j: t(jt(k)) }, 7);
            log(w, first ? '🎓 {a}成年了，找到第一份工作：{j}。' : '💼 {a}找到工作，當上了{j}。', { a: a.name, j: t(jt(k)) }, a.name);
        }
        // 3) 轉行:人太多的行業有一人轉到職缺最多的行業
        const over = Object.keys(RATIO).filter(k => (fl[k] || 0) > sl[k]); const best = Object.entries(open).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])[0];
        if (over.length && best) {
            const k0 = over[Math.floor(Math.random() * over.length)]; const a = all.filter(x => x.job?.key === k0 && !isBoss(w, x) && w.union?.leader !== x.agentId).sort((x, y) => skillOf(y, best[0]) - skillOf(x, best[0]))[0];
            if (a && setJob(w, a, best[0])) { L.stats.switched++; mem(w, a, '做{a}的人太多了，我改行當{b}。', { a: t(jt(k0)), b: t(jt(best[0])) }, 6); log(w, '🔁 {n}從{a}改行當{b}。', { n: a.name, a: t(jt(k0)), b: t(jt(best[0])) }, a.name); }
        }
        for (const id of Object.keys(L.jobless)) { const a = w.agents[id]; if (!a || a.isDead || a.job) delete L.jobless[id]; }
    }
    // 移民:優先補鎮上缺的職業
    function fitImmigrant(w, a) {
        try { if (!a || !a.job || a.job.key === 'mayor') return; const all = npcs(w); const sl = slots(w, all), fl = filled(all); const k = a.job.key;
            if ((fl[k] || 0) <= sl[k]) return; const open = Object.entries(sl).map(([j, n]) => [j, n - (fl[j] || 0)]).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
            if (open.length && Math.random() < 0.75) setJob(w, a, open[0][0]); } catch (e) {}
    }
    function unemployed(w) { return npcs(w).filter(a => adult(a) && !a.job && !(w.isAway?.(a.agentId))); }
    function view(w) { const all = npcs(w); const sl = slots(w, all), fl = filled(all); const L = S(w); const u = unemployed(w).length; const adults = all.filter(a => adult(a)).length;
        return { jobs: Object.keys(RATIO).map(k => ({ k, title: t(jt(k)), slots: sl[k], filled: fl[k] || 0 })), unemployed: u, rate: adults ? Math.round(u / adults * 100) : 0, stats: L.stats }; }
    function brief(w, a) { if (!w.labor || !a || a.isPlayer) return ''; if (adult(a) && !a.job) { const since = S(w).jobless[a.agentId]; return since != null ? t('我現在沒有工作（已經 {n} 天）').replace('{n}', Math.max(0, day(w) - since)) : t('我現在沒有工作'); } return ''; }
    function townBrief(w) { if (!w.labor) return ''; const v = view(w); return v.unemployed ? `${t('失業')} ${v.unemployed} ${t('人')}${t('（')}${v.rate}%${t('）')}` : ''; }
    return { S, RATIO, slots, filled, weekly, fitImmigrant, unemployed, view, brief, townBrief, skillOf };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    prices_high: { mood: -3, opinion: 0, days: 2, label: t('東西越來越貴，快買不起了') },
    laid_off:    { mood: -8, opinion: 0, days: 5, label: t('被裁員了') },
    jobless:     { mood: -4, opinion: 0, days: 2, label: t('找不到工作') },
});
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) {
        const r = _daily.call(this, w, ...rest);
        try { if (w.observerMode && w.wallet) { PRICES.daily(w); LABOR.weekly(w); } } catch (e) { console.warn('[Finance] daily', e); }
        return r;
    };
    // 物價高、失業多:救濟、生活補助、最低工資的提案更常出現
    const _cands = PS._candidates;
    if (_cands) PS._candidates = function (w, day, ...rest) {
        const out = _cands.call(this, w, day, ...rest);
        try { const hot = w.prices ? Math.max(PRICES.idx(w, 'food'), PRICES.idx(w, 'fuel')) : 1; const u = w.labor ? LABOR.unemployed(w).length : 0;
            // 公庫存很多、窮人又多:大家會要求把錢拿出來用(補助、救濟提案變多;要不要發還是投票決定)
            const all = Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead); const silver = w.stockpile?.get?.('silver') || 0;
            const poor = typeof WALLET !== 'undefined' && w.wallet ? all.filter(a => WALLET.get(w, a) < 8).length : 0;
            const hoard = all.length && poor >= all.length * 0.1 ? Math.min(3, Math.max(0, silver / (all.length * 30) - 1)) : 0;
            const k = 1 + Math.max(0, hot - 1.2) * 2 + Math.min(1.5, u * 0.15) + hoard;
            if (k > 1) for (const c of out || []) if (c.kind === 'relief' || c.kind === 'stipend' || c.kind === 'minwage') c.weight = (c.weight || 1) * k; } catch (e) {}
        return out;
    };
}
// 移民優先補缺
if (typeof EventSystem !== 'undefined' && EventSystem.prototype._spawnImmigrant) {
    const _sp = EventSystem.prototype._spawnImmigrant;
    EventSystem.prototype._spawnImmigrant = function (world, ...rest) {
        const before = new Set(Object.keys(world.agents || {})); const r = _sp.call(this, world, ...rest);
        try { if (world.observerMode && world.wallet) for (const id of Object.keys(world.agents || {})) if (!before.has(id)) LABOR.fitImmigrant(world, world.agents[id]); } catch (e) {}
        return r;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = LABOR.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = [world.prices ? PRICES.brief(world) : '', LABOR.townBrief(world)].filter(Boolean).join(t('；')); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.prices = null; this.labor = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d) { if (this.prices) d.prices = this.prices; if (this.labor) d.labor = this.labor; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.prices = (data?.prices && typeof data.prices.idx === 'object') ? data.prices : null; this.labor = (data?.labor && typeof data.labor === 'object') ? data.labor : null; } } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') { globalThis.PRICES = PRICES; globalThis.LABOR = LABOR; }
