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
        { const cy = typeof CYCLE !== 'undefined' ? CYCLE.c(w) : 0; if (cy) for (const k of KEYS) tg[k] = clamp(tg[k] * (1 + 0.12 * cy)); } // v7.2.0 繁榮時物價略漲、衰退時略跌
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
        // v7.2.0 景氣好私人產業多招人、景氣差少招;公庫很有錢時公職(守衛、醫生、研究員)多開缺
        const cy = typeof CYCLE !== 'undefined' ? CYCLE.c(w) : 0; const rich = (w.stockpile?.get?.('silver') || 0) > n * 60 ? 1.2 : 1;
        const PUBLICJ = ['guard', 'doctor', 'researcher', 'priest'];
        for (const [k, r] of Object.entries(RATIO)) out[k] = Math.max(1, Math.ceil(n * r * (k === 'farmer' && foodHot ? 1.2 : 1) * (PUBLICJ.includes(k) ? rich : 1 + 0.1 * cy) * (typeof TECH !== 'undefined' ? TECH.jobMult(w, k) : 1))); // v7.8.0 機器搶工作:生產線／機器人／AI 讓職缺變少
        return out;
    }
    function filled(all) { const c = {}; for (const a of all) { const k = a.job?.key; if (k && RATIO[k] !== undefined) c[k] = (c[k] || 0) + 1; } return c; }
    const skillOf = (a, k) => { try { const s = a.skills?.get?.(PRIMARY[k]); if (!s) return 0; return (s.level || 0) + ({ '狂熱': 5, '大': 3, '微': 1 }[s.passion] || 0) - (s.isIncapable ? 20 : 0); } catch (e) { return 0; } };
    const wage = (k) => (typeof WALLET !== 'undefined' && WALLET.WAGE?.[k]) || 4;
    function setJob(w, a, k) { if (typeof Job === 'undefined' || typeof JOB_DEFINITIONS === 'undefined' || !JOB_DEFINITIONS[k]) return false; a.job = new Job(k); return true; }
    // 一位沒工作的人挑最適合的職缺(擅長＋興趣＋工資)
    function bestOpening(a, open) { let best = null, bs = -1e9; for (const [k, n] of Object.entries(open)) { if (n <= 0) continue; const s = skillOf(a, k) + wage(k) * 0.6 + Math.random() * 2 + (typeof HEALTH !== 'undefined' ? (HEALTH.jobFit(a, k) - 1) * 6 : 0); if (s > bs) { bs = s; best = k; } } return best; }
    function weekly(w) {
        const L = S(w), d = day(w), wk = Math.floor(d / 7); if (L.lastWeek === wk) return; L.lastWeek = wk;
        const all = npcs(w).filter(a => !(w.isAway?.(a.agentId))); const sl = slots(w, all); let fl = filled(all);
        // 1) 裁員:人比職缺多出兩成以上的行業,裁掉最不擅長的人(老闆本人、工會領袖不裁),每週最多 2 人
        let cut = 0;
        for (const k of Object.keys(RATIO).sort((x, y) => ((fl[y] || 0) - sl[y]) - ((fl[x] || 0) - sl[x]))) {
            if (cut >= 2) break; const n = fl[k] || 0; if (n <= sl[k] + 1 || n <= sl[k] * 1.2) continue;
            const fit = (a) => (typeof HEALTH !== 'undefined' ? HEALTH.jobFit(a, k) : 1); const pool = all.filter(a => a.job?.key === k && !isBoss(w, a) && w.union?.leader !== a.agentId).sort((x, y) => skillOf(x, k) * fit(x) - skillOf(y, k) * fit(y)); // v7.4.0 身體不適合的先被裁
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

// ── v7.1.0 貿易與關稅 TRADE(盡量簡化、金流守恆)──
// - 商行有私人老闆時,由老闆做進出口:本地價(原價 × 物價指數)比商人賣價＋關稅高才進口(付商人的錢流出鎮外、關稅進公庫、貨賣給鎮上倉庫賺差價);
//   商人收購價比本地價高才出口(老闆向鎮上買貨、賣給商人,外地的錢流進來)。商行公營就照舊由公庫直接跟商人買賣
// - 進口多→倉裡貨多→物價跌(本地生產者賺少);出口多→貨變少→物價漲
// - 關稅預設 0。便宜進口貨一多,農夫、裁縫、木匠這些本地生產者會提案課 15% 關稅;關稅期間物價太高,窮人與商人會提案取消
// - 商人開價也會看鎮上缺不缺(物價越高開價越高)
const TRADE = (() => {
    const GROUP = { food: 'food', wheat: 'food', rice: 'food', corn: 'food', potato: 'food', meals: 'food', bread: 'food', cloth: 'cloth', cotton: 'cloth', clothing: 'cloth', wood: 'fuel', plank: 'fuel' };
    const PRODUCERS = { food: ['farmer', 'cook'], cloth: ['tailor'], fuel: ['carpenter'] };
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const log = (w, k, p, who) => { try { w.logMessageT?.('trade', k, p || {}, who || ''); } catch (e) {} };
    const rn = (r) => (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[r]) ? t(RESOURCE_NAMES_ZH[r]) : (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[r]) ? SHOP_ITEMS[r].name() : t(r);
    function S(w) {
        if (!w.tradeX || typeof w.tradeX !== 'object') w.tradeX = { tariff: 0, imp: 0, exp: 0, duty: 0, profit: 0, hist: [], lastProp: -99, setDay: 0 };
        const X = w.tradeX; for (const k of ['imp', 'exp', 'duty', 'profit']) if (typeof X[k] !== 'number') X[k] = 0; X.hist = X.hist || []; return X;
    }
    const tariff = (w) => (w.tradeX ? S(w).tariff || 0 : 0);
    const groupIdx = (w, r) => { const g = GROUP[r]; return g && typeof PRICES !== 'undefined' ? PRICES.idx(w, g) : null; };
    // 本地價:民生物資看物價指數;其他貨看倉裡缺不缺(缺就貴、多就便宜)
    function localPrice(w, r) {
        const base = (typeof BASE_PRICES !== 'undefined' && BASE_PRICES[r]) || 3; const g = groupIdx(w, r); if (g != null) return base * g;
        const have = w.stockpile?.get?.(r) || 0; return base * (have < 8 ? 1.8 : have > 80 ? 0.7 : 1);
    }
    const W = (w) => (typeof WALLET !== 'undefined' && w.wallet) ? WALLET : null;
    const owner = (w) => { try { return typeof MARKET !== 'undefined' && w.market ? MARKET.ownerOf(w, 'trade') : null; } catch (e) { return null; } };
    const rec = (w, kind, r, qty, value) => { const X = S(w); X[kind] = Math.round((X[kind] + value) * 100) / 100; X.hist.push([day(w), kind === 'imp' ? 1 : 0, r, qty, Math.round(value)]); if (X.hist.length > 60) X.hist.splice(0, X.hist.length - 60); };
    // 私人商行老闆做進出口(一天一次;每樣最多 25 份;老闆的現金與公庫都要付得起)
    function privateTrade(w) {
        const m = w.trade?.merchant; const id = owner(w); const Wl = W(w); if (!m || !m.offers?.length || !id || !Wl) return false;
        const boss = w.agents[id]; if (!boss) return false; const sp = w.stockpile; const rate = tariff(w); const deals = [];
        for (const o of m.offers) {
            if (!o || o.amount < 1) continue; const loc = localPrice(w, o.resource);
            if (!o.isBuying) { // 商人在賣 → 進口
                const landed = o.price * (1 + rate); if (loc < landed * 1.12) continue;
                const g = GROUP[o.resource]; const scarce = g ? PRICES.idx(w, g) >= 1.05 : (sp.get(o.resource) || 0) < 15; if (!scarce) continue;
                const cash = Wl.get(w, boss), tr = sp.get('silver') || 0;
                const qty = Math.floor(Math.min(o.amount, 25, cash / landed, Math.max(0, tr - 60) / loc)); if (qty < 2) continue;
                const pay = Math.round(o.price * qty * 100) / 100, duty = Math.round(o.price * qty * rate * 100) / 100, sale = Math.round(loc * qty * 100) / 100;
                if (!Wl.take(w, boss, pay + duty)) continue; // 付商人(流出鎮外)＋關稅
                if (duty > 0) { sp.add('silver', duty, w.tickCount, t('進口關稅')); S(w).duty = Math.round((S(w).duty + duty) * 100) / 100; }
                sp.add(o.resource, qty, w.tickCount, t('商行進口')); sp.consume('silver', sale, w.tickCount, t('向商行買進口貨')); Wl.add(w, boss, sale); // 鎮上倉庫照本地價買下
                o.amount -= qty; rec(w, 'imp', o.resource, qty, pay); S(w).profit += sale - pay - duty; deals.push(['imp', o.resource, qty, Math.round(sale - pay - duty)]);
            } else { // 商人在收 → 出口
                if (o.price < loc * 1.12) continue; const have = sp.get(o.resource) || 0;
                const g = GROUP[o.resource]; const plenty = g ? PRICES.idx(w, g) <= 0.95 : have > 40; if (!plenty) continue;
                const cash = Wl.get(w, boss); const qty = Math.floor(Math.min(o.amount, 25, (have - (g === 'food' ? npcs(w).length * 6 : 15)) * 0.5, cash / loc)); if (qty < 2) continue;
                const buy = Math.round(loc * qty * 100) / 100, earn = Math.round(o.price * qty * 100) / 100;
                if (!Wl.take(w, boss, buy)) continue; if (!sp.consume(o.resource, qty, w.tickCount, t('商行出口'))) { Wl.add(w, boss, buy); continue; }
                sp.add('silver', buy, w.tickCount, t('賣貨給商行')); Wl.add(w, boss, earn); // 外地商人付的錢流進鎮上
                o.amount -= qty; rec(w, 'exp', o.resource, qty, earn); S(w).profit += earn - buy; deals.push(['exp', o.resource, qty, Math.round(earn - buy)]);
            }
        }
        if (deals.length) {
            const imp = deals.filter(d => d[0] === 'imp'), exp = deals.filter(d => d[0] === 'exp'); const parts = [];
            if (imp.length) parts.push(t('進口') + ' ' + imp.map(d => `${rn(d[1])}×${d[2]}`).join(t('、'))); if (exp.length) parts.push(t('出口') + ' ' + exp.map(d => `${rn(d[1])}×${d[2]}`).join(t('、')));
            log(w, '🚢 {a}的商行跟{m}做了生意：{d}（賺了 {p} 銀幣）。', { a: boss.name, m: m.name, d: parts.join(t('；')), p: deals.reduce((s, d) => s + d[3], 0) }, boss.name);
        }
        return true;
    }
    // 公營時公庫直接跟商人交易:只記進出口統計
    function recordPublic(w, before) {
        try { const m = w.trade?.merchant; if (!m || !before) return; m.offers.forEach((o, i) => { const d = (before[i] || 0) - (o.amount || 0); if (d > 0) rec(w, o.isBuying ? 'exp' : 'imp', o.resource, d, d * o.price); }); } catch (e) {}
    }
    // 商人開價看鎮上缺不缺
    function adjustOffers(w) { try { const m = w.trade?.merchant; if (!m || m._v71) return; m._v71 = true; for (const o of m.offers || []) { const g = groupIdx(w, o.resource); if (g != null) o.price = Math.round(o.price * (0.9 + 0.1 * g) * 10) / 10; } } catch (e) {} }
    // 關稅提案
    function proposal(w) {
        const P = w.proposals, X = S(w), d = day(w); if (!P?._createWith || !w.wallet || d - X.lastProp < 25) return;
        if ((P.items || []).some(p => p.kind === 'tariff' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const recent = X.hist.filter(h => h[0] >= d - 30); const impOf = (g) => recent.filter(h => h[1] === 1 && GROUP[h[2]] === g).reduce((s, h) => s + h[4], 0);
        // 便宜是因為外地貨進來:那一類近 30 天進口 50 銀幣以上、價格又跌到 0.9 以下;關稅只管得到私人商行,所以商行要有老闆
        const cheap = ['food', 'cloth', 'fuel'].filter(g => PRICES.idx(w, g) <= 0.9 && impOf(g) >= 50); const dear = ['food', 'cloth', 'fuel'].filter(g => PRICES.idx(w, g) >= 1.4);
        let rate = null, who = null; const all = npcs(w);
        if (!X.tariff && owner(w) && cheap.length) { rate = 0.15; const jobs = cheap.flatMap(g => PRODUCERS[g]); who = all.filter(a => jobs.includes(a.job?.key)).sort((x, y) => (MARKET.ownedBy?.(w, y.agentId)?.length || 0) - (MARKET.ownedBy?.(w, x.agentId)?.length || 0))[0]; }
        else if (X.tariff && dear.length && d - (X.setDay || 0) >= 20) { rate = 0; who = all.filter(a => a.job?.key === 'trader' || (W(w) && W(w).get(w, a) < 15))[0]; }
        if (rate == null || !who) return; X.lastProp = d;
        const cand = { kind: 'tariff', key: 'tariff:' + d, jobs: [], make: () => rate > 0
            ? { kind: 'tariff', key: 'tariff:' + d, newRate: rate, tk: '進口貨課 {n}% 關稅', tp: { n: Math.round(rate * 100) }, dk: '{who}說外地便宜的貨一直進來，本地做的賣不出好價錢。提議進口貨課 {n}% 關稅，保護鎮上的生計。', dp: { who: who.name, n: Math.round(rate * 100) }, cost: {}, category: 'economy' }
            : { kind: 'tariff', key: 'tariff:' + d, newRate: 0, tk: '取消進口關稅', tp: {}, dk: '{who}說東西越來越貴，關稅讓外地貨進不來，苦的是大家。提議取消進口關稅。', dp: { who: who.name }, cost: {}, category: 'economy' } };
        const p = P._createWith(w, d, cand, who); if (p) p.newRate = rate; return p;
    }
    // 投票:本地生產者(被便宜貨搶生意的)支持課稅;商人、商行老闆、手頭緊的人反對(要便宜貨)
    function vote(w, p, a) {
        const up = (p.newRate || 0) > 0; const k = a.job?.key; let s = 0; const cash = W(w) ? W(w).get(w, a) : 50;
        if (['farmer', 'cook', 'tailor', 'carpenter', 'miner', 'blacksmith'].includes(k)) s += 1.5; if (k === 'trader' || owner(w) === a.agentId) s -= 3; if (cash < 15) s -= 1.5;
        if ((MARKET.ownedBy?.(w, a.agentId) || []).some(x => ['farm', 'textile', 'timber'].includes(x))) s += 2; s += (Math.random() - 0.5) * 1.6;
        if (!up) s = -s; return { v: s > 0 ? 'for' : 'against', why: k === 'trader' || cash < 15 ? 'purse' : 'job' };
    }
    function setTariff(w, rate) { const X = S(w); const old = X.tariff || 0; X.tariff = Math.max(0, Math.min(0.5, rate)); X.setDay = day(w); return X.tariff > 0 ? t('進口關稅從 {a}% 調成 {n}%').replace('{a}', Math.round(old * 100)).replace('{n}', Math.round(X.tariff * 100)) : t('進口關稅取消了'); }
    function view(w) { const X = S(w), d = day(w); const r30 = X.hist.filter(h => h[0] >= d - 30); const imp = Math.round(r30.filter(h => h[1] === 1).reduce((s, h) => s + h[4], 0)), exp = Math.round(r30.filter(h => h[1] === 0).reduce((s, h) => s + h[4], 0)); return { tariff: Math.round((X.tariff || 0) * 100), imp, exp, bal: exp - imp, duty: Math.round(X.duty), private: !!owner(w) }; }
    function brief(w) { if (!w.tradeX) return ''; const v = view(w); return `${t('關稅')} ${v.tariff}%${t('；')}${t('近 30 天進口')} ${v.imp}${t('、')}${t('出口')} ${v.exp} ${t('銀幣')}`; }
    return { S, rec, GROUP, localPrice, privateTrade, recordPublic, adjustOffers, proposal, vote, setTariff, view, brief, tariff };
})();
if (typeof VillagerAutonomy !== 'undefined' && VillagerAutonomy.prototype._merchant) {
    const _m = VillagerAutonomy.prototype._merchant;
    VillagerAutonomy.prototype._merchant = function (w, ...rest) {
        try { if (w.observerMode && w.wallet && w.trade?.merchant) { TRADE.adjustOffers(w); if (TRADE.privateTrade(w)) return; } } catch (e) { console.warn('[Trade] private', e); }
        const before = (w.trade?.merchant?.offers || []).map(o => o.amount); const r = _m.call(this, w, ...rest); try { if (w.observerMode) TRADE.recordPublic(w, before); } catch (e) {} return r;
    };
}
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.tariff = { icon: '🚢', label: '關稅' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.wallet && (w._absDay?.() ?? 0) % 3 === 1) TRADE.proposal(w); } catch (e) { console.warn('[Trade] proposal', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'tariff') { const r = TRADE.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = TRADE.brief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.tradeX = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.tradeX) d.tradeX = this.tradeX; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.tradeX = (data?.tradeX && typeof data.tradeX === 'object') ? data.tradeX : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.TRADE = TRADE;

// ── v7.2.0 景氣循環、公共支出、反壟斷 CYCLE(盡量簡化、金流守恆)──
// - 景氣指數 -1(衰退)～+1(繁榮):看村民消費成長、進出口順逆差,加上偶爾的外來衝擊(外地豐收、戰事謠言、商路中斷…),每天慢慢移動
// - 繁榮:物價略漲、私人產業多招人、銀行願意多借;衰退:職缺變少(會裁員)、產業出事的風險變高、銀行縮手
// - 公庫存太多(超過每人 40 銀幣):每週撥一部分做公共工程,付給本地木作坊、礦場、鐵鋪(衰退時撥更多,逆景氣);也會有人提案減稅
// - 反壟斷:有人同時擁有 3 家以上產業,工會領袖或窮工人會提案拆分——最值錢的一家照市價賣給別人(沒人買得起就由公庫照市價買下),錢照算不會憑空出現
const CYCLE = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const SHOCKS = [['外地大豐收，商隊搶著來收貨', 0.5], ['鄰近城鎮景氣大好', 0.45], ['新商路開通', 0.5], ['傳出外地戰事，商人不敢上路', -0.55], ['外地錢莊倒閉，人心惶惶', -0.5], ['遠方鬧旱災，貨價亂跳', -0.4]];
    function S(w) {
        if (!w.cycle || typeof w.cycle !== 'object') w.cycle = { c: 0, target: 0, spent: [], lastSpent: null, lastDay: null, phase: 0, shock: null, works: 0, worksN: 0, split: 0, hist: [], lastProp: -99, lastTaxProp: -99 };
        const C = w.cycle; C.spent = C.spent || []; C.hist = C.hist || []; return C;
    }
    const c = (w) => (w.cycle ? S(w).c || 0 : 0);
    const phaseOf = (v) => v >= 0.35 ? 1 : v <= -0.35 ? -1 : 0;
    const word = (v) => t(phaseOf(v) > 0 ? '繁榮' : phaseOf(v) < 0 ? '衰退' : '平穩');
    function daily(w) {
        const C = S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        const pop = Math.max(1, npcs(w).length);
        const spentTot = w.wallet?.stats?.spent || 0; if (C.lastSpent != null) { C.spent.push(Math.max(0, spentTot - C.lastSpent) / pop); if (C.spent.length > 28) C.spent.shift(); } C.lastSpent = spentTot; // 每人每天的消費(人口變多不算景氣變好)
        // 外來衝擊:約三個月一次,持續 20～40 天
        if (C.shock && d >= C.shock.until) { C.shock = null; }
        if (!C.shock && Math.random() < 1 / 90 && d > 20) { const s = SHOCKS[Math.floor(Math.random() * SHOCKS.length)]; C.shock = { k: s[0], amt: s[1], until: d + 20 + Math.floor(Math.random() * 20) }; log(w, s[1] > 0 ? '📰 {k}。' : '📰 {k}。', { k: t(s[0]) }); try { w.dailyNews?.collectEvent?.('economy', t(s[0]), 6, []); } catch (e) {} }
        // 目標:消費成長(近 7 天對前 21 天)＋順逆差＋衝擊
        let g = 0; if (C.spent.length >= 14) { const last = C.spent.slice(-7).reduce((s, v) => s + v, 0); const prev = C.spent.slice(0, -7); const base = prev.reduce((s, v) => s + v, 0) / prev.length * 7; g = base > 0 ? last / base - 1 : 0; }
        let bal = 0; try { bal = typeof TRADE !== 'undefined' && w.tradeX ? TRADE.view(w).bal : 0; } catch (e) {}
        C.target = clamp(g * 1.5 + Math.tanh(bal / (pop * 25)) * 0.3 + (C.shock?.amt || 0));
        C.c = Math.round(clamp(C.c + (C.target - C.c) * 0.06) * 1000) / 1000;
        const ph = phaseOf(C.c); if (ph !== C.phase) { log(w, ph > 0 ? '📈 景氣轉好，鎮上生意興隆。' : ph < 0 ? '📉 景氣變差，進入衰退。' : '⚖️ 景氣回到平穩。', {}); try { w.dailyNews?.collectEvent?.('economy', t(ph > 0 ? '景氣轉好' : ph < 0 ? '景氣衰退' : '景氣平穩'), 6, []); } catch (e) {} C.phase = ph; }
        if (d % 3 === 0) { C.hist.push([d, C.c]); if (C.hist.length > 40) C.hist.shift(); }
        if (ph < 0) for (const a of npcs(w)) if (!a.job || (typeof WALLET !== 'undefined' && w.wallet && WALLET.get(w, a) < 15)) a.addThought?.('hard_times', w);
        if (d % 7 === 5) { publicWorks(w, C, pop); taxCut(w, C, pop, d); antitrust(w, C, d); try { if (C.c < -0.3 && Math.random() < -C.c * 0.6 && typeof MARKET !== 'undefined' && w.market) MARKET.risk(w, npcs(w)); } catch (e) {} } // 衰退時產業多一次出事的機會
    }
    // 公共工程:公庫超過「每人 40 銀幣＋200」的部分,每週撥 8%(衰退時 15%),付給本地木作坊、礦場、鐵鋪(依工人數分;公營的錢回到公庫)
    function publicWorks(w, C, pop) {
        if (typeof MARKET === 'undefined' || !w.market) return; const sp = w.stockpile; const silver = sp.get('silver') || 0; const excess = silver - (pop * 25 + 150); if (excess <= 0) return; // v8.9.0 門檻放低(以前 40/人＋200),公庫的錢更常拿去蓋公共建設
        const n = Math.round(excess * (C.c < -0.2 ? 0.2 : 0.12)); if (n < 20) return; /* v8.9.0 8%→12%:公庫錢多就多蓋公共建設 */ const all = npcs(w);
        const parts = [['timber', 0.4], ['mine', 0.3], ['forge', 0.3]].map(([k, f]) => [k, f * (MARKET.workersOf(w, k, all).length ? 1 : 0)]); const tot = parts.reduce((s, [, f]) => s + f, 0); if (!tot) return;
        if (typeof WORKS !== 'undefined') { try { if (WORKS.tender(w, n, parts, tot, all, C)) return; } catch (e) { console.warn('[Works] tender', e); } } // v8.9.0 改成村民競標承包
        if (!sp.consume('silver', n, w.tickCount, t('公共工程'))) return;
        for (const [k, f] of parts) if (f) MARKET.sell(w, k, n * f / tot, t('公共工程款'));
        C.works = Math.round((C.works || 0) + n); C.worksN = (C.worksN || 0) + 1; for (const a of all) a.moodModifier = (a.moodModifier || 0) + 0.5;
        log(w, '🏗️ 鎮公所撥了 {n} 銀幣修路、修橋、整修公共設施{x}。', { n, x: C.c < -0.2 ? t('（景氣不好，多撥一點讓大家有工作）') : '' });
    }
    // 公庫太多:有人提案減稅(用原本的稅率提案,投票照舊)
    function taxCut(w, C, pop, d) {
        const P = w.proposals; if (!P?._createWith || !w.wallet || d - (C.lastTaxProp || -99) < 60) return; const tax = w.wallet.tax ?? 0.1; const silver = w.stockpile.get('silver') || 0;
        if (silver < pop * 80 || tax <= 0.06) return; // 公庫超過每人 80 銀幣才提;這條路最多降到 6% if ((P.items || []).some(p => p.kind === 'tax' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const who = npcs(w).filter(a => (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 0) >= 60).sort(() => Math.random() - 0.5)[0]; if (!who) return; C.lastTaxProp = d;
        const nt = Math.round((tax - 0.05) * 100) / 100;
        const cand = { kind: 'tax', key: 'tax:' + d, jobs: [], make: () => ({ kind: 'tax', key: 'tax:' + d, newTax: nt, dir: 'down', tk: '減稅到 {n}%', tp: { n: Math.round(nt * 100) }, dk: '{who}說公庫存了 {s} 銀幣用不完，提議把稅從 {a}% 降到 {n}%，錢還給大家。', dp: { who: who.name, s: Math.round(silver), a: Math.round(tax * 100), n: Math.round(nt * 100) }, cost: {}, category: 'economy' }) };
        const p = P._createWith(w, d, cand, who); if (p) { p.newTax = nt; p.dir = 'down'; }
    }
    // 反壟斷
    function monopolist(w) { if (typeof MARKET === 'undefined' || !w.market) return null; const cnt = {}; for (const [k, id] of Object.entries(w.market.owners || {})) if (id && w.agents[id] && !w.agents[id].isDead) cnt[id] = (cnt[id] || 0) + 1; const top = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]; return top && top[1] >= 3 ? { id: top[0], n: top[1] } : null; }
    function antitrust(w, C, d) {
        const P = w.proposals; const m = monopolist(w); if (!P?._createWith || !m || d - (C.lastProp || -99) < 45) return;
        if ((P.items || []).some(p => p.kind === 'antitrust' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const mono = w.agents[m.id]; const U = w.union; const all = npcs(w);
        const who = (U?.on && U.leader && U.leader !== m.id && w.agents[U.leader]) || all.filter(a => a.agentId !== m.id && a.job && (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 99) < 40).sort((x, y) => ((y.personality?.traits || []).includes('charismatic') ? 1 : 0) - ((x.personality?.traits || []).includes('charismatic') ? 1 : 0))[0]; if (!who) return;
        C.lastProp = d;
        const names = MARKET.ownedBy(w, m.id).map(k => MARKET.name(k)).join(t('、'));
        const cand = { kind: 'antitrust', key: 'antitrust:' + d, refKey: m.id, jobs: [], make: () => ({ kind: 'antitrust', key: 'antitrust:' + d, refKey: m.id, tk: '拆分{name}的產業', tp: { name: mono.name }, dk: '{who}說{name}一個人就握有{list}，工資、價錢全由他說了算。提議讓他照市價賣掉其中最大的一家。', dp: { who: who.name, name: mono.name, list: names }, cost: {}, category: 'economy' }) };
        const p = P._createWith(w, d, cand, who); if (p) p.refKey = m.id; return p;
    }
    function antitrustVote(w, p, a) {
        const id = p.refKey; let s = 0; const cash = typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 50;
        if (a.agentId === id) s -= 10; if (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length) s -= 2.5; if (w.union?.members?.[a.agentId]) s += 3;
        if (a.job && cash < 50) s += 1.5; if ((a.personality?.traits || []).includes('greedy')) s -= 1; try { if ((w.power?.inf?.[a.agentId] || {})[id]) s -= 4; } catch (e) {} // 收過他獻金的人
        const r = a.relationships?.relationships?.[id]?.affinity || 0; s -= r / 30; s += (Math.random() - 0.5) * 1.6;
        return { v: s > 0 ? 'for' : 'against', why: (w.power?.inf?.[a.agentId] || {})[id] ? 'donor' : w.union?.members?.[a.agentId] ? 'union' : cash < 50 ? 'needy' : 'boss' };
    }
    function split(w, p) {
        if (typeof MARKET === 'undefined' || !w.market || typeof WALLET === 'undefined') return ''; const id = p.refKey; const owner = w.agents[id]; if (!owner || owner.isDead) return t('他已經不在鎮上了');
        const ks = MARKET.ownedBy(w, id); if (ks.length < 2) return t('他手上已經沒有那麼多產業了');
        const all = npcs(w); const k = ks.map(k => [k, MARKET.value(w, k, all)]).sort((x, y) => y[1] - x[1])[0]; const price = Math.round(k[1]);
        const buyer = all.filter(a => a.agentId !== id && WALLET.get(w, a) >= price && MARKET.ownedBy(w, a.agentId).length < 2).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0];
        if (!S(w).law) { S(w).law = true; log(w, '⚖️ 鎮上從此有了反壟斷法：擁有三家以上產業的人不能再買。', {}); }
        if (buyer && WALLET.take(w, buyer, price)) { WALLET.add(w, owner, price); w.market.owners[k[0]] = buyer.agentId; S(w).split = (S(w).split || 0) + 1; log(w, '⚖️ 反壟斷：{o}把{s}以 {n} 銀幣賣給了{b}。', { o: owner.name, s: MARKET.name(k[0]), n: price, b: buyer.name }, owner.name); return t('{s}賣給了{b}').replace('{s}', MARKET.name(k[0])).replace('{b}', buyer.name); }
        const sp = w.stockpile; if (sp.consume('silver', price, w.tickCount, t('公庫收購產業'))) { WALLET.add(w, owner, price); delete w.market.owners[k[0]]; S(w).split = (S(w).split || 0) + 1; log(w, '⚖️ 反壟斷：沒人買得起，公庫以 {n} 銀幣收購了{o}的{s}，改為公營。', { o: owner.name, s: MARKET.name(k[0]), n: price }, owner.name); return t('{s}由公庫收購，改為公營').replace('{s}', MARKET.name(k[0])); }
        return t('沒人買得起，公庫也買不起，只好作罷');
    }
    function view(w) { const C = S(w); return { c: C.c, word: word(C.c), shock: C.shock ? t(C.shock.k) : '', works: C.works || 0, worksN: C.worksN || 0, split: C.split || 0, mono: (() => { const m = monopolist(w); return m ? { name: t(w.agents[m.id]?.name || ''), n: m.n } : null; })() }; }
    function brief(w) { if (!w.cycle) return ''; const v = view(w); return `${t('景氣')}${t('：')}${v.word}${v.shock ? `${t('（')}${v.shock}${t('）')}` : ''}`; }
    return { S, c, daily, publicWorks, monopolist, antitrust, antitrustVote, split, view, brief, word };
})();
if (typeof THOUGHT_DEFS !== 'undefined') THOUGHT_DEFS.hard_times = { mood: -2, opinion: 0, days: 2, label: t('景氣不好，日子難過') };
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.antitrust = { icon: '⚖️', label: '反壟斷' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode && w.wallet) CYCLE.daily(w); } catch (e) { console.warn('[Cycle] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'antitrust') { const r = CYCLE.antitrustVote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
// 景氣影響:銀行放款意願(產業出事的風險在 CYCLE.daily 裡處理)
if (typeof BANK !== 'undefined' && BANK.lend) { const _lend = BANK.lend; BANK.lend = function (w, B, a, n, ...rest) { try { n = n * (1 + 0.35 * CYCLE.c(w)); } catch (e) {} return _lend.call(this, w, B, a, n, ...rest); }; }
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = CYCLE.brief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.cycle = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.cycle) { const C = this.cycle; d.cycle = { ...C, spent: C.spent.slice(-28), hist: C.hist.slice(-40) }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.cycle = (data?.cycle && typeof data.cycle === 'object') ? data.cycle : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.CYCLE = CYCLE;
