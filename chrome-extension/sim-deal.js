// v11.0.0 市場與第四權（第一段）：老闆的經營手法——漲價、偷工減料、跟同行講好
// 每一件事都照「有人做 → 有人知道 → 知道的人自己決定怎麼辦」走。這個檔只管兩件事：這個人看得到什麼、他做的事造成什麼結果。
// 決定本身在 sim-decide-deal.js（走決策核心，開了智能體由 AI 決定，沒開照個性推估，選項相同）。
// - 範圍：賣給村民的三樣東西。三餐→食堂、衣服→布莊、柴火→木作坊；有對手店時兩家各管各的。公營（沒有老闆）的不會有這些事。
// - 漲價：客人多付的錢進老闆口袋（照樣繳營業稅）。有對手店時客人會流到另一家。
// - 偷工減料：把該付給上游農莊的錢留下一部分（柴火是濕柴充好柴，客人得多買）。客人有機會出事，做越久越容易出重症，會死人。
// - 講好一起漲：兩家都知道；有一方可以假裝答應、偷偷不漲。
// - 每件事記成一筆「事」，附上知道的人。錢守恆：客人付的＝各家收的。
const DEAL = (() => {
    const RETAIL = { meal: 'kitchen', clothes: 'textile', firewood: 'timber' };
    const GOOD = { kitchen: 'meal', textile: 'clothes', timber: 'firewood' };
    const GNAME = { meal: '三餐', clothes: '衣服', firewood: '柴火' };
    const UPS = [0.1, 0.2, 0.3, 0.5], SKIM = [0, 0.25, 0.5], FUEL = [0, 0.1, 0.2], PACT_UP = 0.2;
    const FACT_CAP = 60, HARM_CAP = 80, PREF_DAYS = 21;
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : Math.floor((w.tickCount || 0) / 96));
    const r2 = (x) => Math.round(x * 100) / 100;
    const has = (a, x) => (a?.personality?.traits || []).includes(x);
    const log = (w, k, p, who) => { try { w.logMessageT?.('economy', k, p || {}, who || ''); } catch (e) {} };
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'economy', k, p || {}, imp, []); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const on = (w) => !!(w && w.observerMode && w.wallet && w.market && typeof MARKET !== 'undefined' && typeof WALLET !== 'undefined');
    function S(w) {
        if (!w.deal || typeof w.deal !== 'object') w.deal = { f: {}, facts: [], n: 0, pref: {}, harm: [], seen: {}, asked: {}, lastDay: null, st: { extra: 0, skim: 0, sick: 0, dead: 0, hikes: 0, cuts: 0, pacts: 0 } };
        const D = w.deal; D.f = D.f || {}; D.facts = D.facts || []; D.pref = D.pref || {}; D.harm = D.harm || []; D.seen = D.seen || {}; D.asked = D.asked || {}; D.st = D.st || {}; return D;
    }
    // ---------- 店 ----------
    const kOf = (key) => String(key).split('#')[0];
    const isRiv = (key) => String(key).endsWith('#r');
    const ownerId = (w, key) => { const k = kOf(key); try { return isRiv(key) ? (MARKET.rivalOf(w, k)?.owner || null) : MARKET.ownerOf(w, k); } catch (e) { return null; } };
    const owner = (w, key) => w.agents[ownerId(w, key)] || null;
    const other = (w, key) => { const k = kOf(key); const o = isRiv(key) ? k : k + '#r'; return ownerId(w, o) ? o : null; };
    const firms = (w) => { const out = []; for (const k of Object.keys(GOOD)) { if (ownerId(w, k)) out.push(k); if (ownerId(w, k + '#r')) out.push(k + '#r'); } return out; };
    const firmsOf = (w, id) => firms(w).filter(key => ownerId(w, key) === id);
    // 這家店的狀態；換了老闆就從頭算
    function F(w, key) {
        const D = S(w); const id = ownerId(w, key); let st = D.f[key];
        if (!st || st.by !== id) st = D.f[key] = { by: id, up: 0, cut: 0, upD: 0, cutD: 0, v: (st?.v || 0) + 1, gain: 0, pact: null, caught: 0 };
        return st;
    }
    const sname = (k) => { const s = MARKET.SECTORS[kOf(k)]; return s ? s.zh : k; };
    // 員工：在這家店做事的人（對手店的人算對手店的）
    function staff(w, key, all) {
        const k = kOf(key); const R = MARKET.rivalOf(w, k); const ws = MARKET.workersOf(w, k, all || npcs(w)); const id = ownerId(w, key);
        return ws.filter(a => a.agentId !== id && (isRiv(key) ? !!R?.emp?.[a.agentId] : !R?.emp?.[a.agentId]));
    }
    const dirty = (w, k) => { const D = S(w); for (const key of [k, k + '#r']) { const st = D.f[key]; if (st && (st.up > 0 || st.cut > 0) && ownerId(w, key) === st.by) return true; } return !!D.prefN?.[k]; };
    // ---------- 客人去哪一家、付多少 ----------
    function prefOf(w, a, k) { const p = S(w).pref[a.agentId]?.[k]; return p && p.until >= day(w) ? p : null; }
    function setPref(w, a, k, f, why) { const D = S(w); (D.pref[a.agentId] || (D.pref[a.agentId] = {}))[k] = { f, until: day(w) + PREF_DAYS, why: why || '' }; countPref(w); }
    function countPref(w) { const D = S(w), d = day(w); const n = {}; for (const [id, m] of Object.entries(D.pref)) { for (const [k, p] of Object.entries(m)) { if (p.until < d || !w.agents[id] || w.agents[id].isDead) delete m[k]; else n[k] = (n[k] || 0) + 1; } if (!Object.keys(m).length) delete D.pref[id]; } D.prefN = n; }
    // 兩家都在時，對手店拿到幾成客人：原本的市占，再照兩家各自漲了多少調整
    function rivalShare(w, k) { let s = MARKET.shareOf(w, k); const ui = 1 + F(w, k).up, ur = 1 + F(w, k + '#r').up; const a = s * ui * ui, b = (1 - s) * ur * ur; return a + b > 0 ? a / (a + b) : s; }
    function choose(w, a, k) {
        const hasI = !!ownerId(w, k), hasR = !!ownerId(w, k + '#r'); if (!hasI) return null; if (!hasR) return k;
        const p = prefOf(w, a, k); if (p?.f === 'r') return k + '#r'; if (p?.f === 'i') return k;
        return Math.random() < rivalShare(w, k) ? k + '#r' : k;
    }
    // 這位客人這次要付多少。回傳 { p: 價錢, key: 哪一家, skip: 這次不買 }
    function price(w, a, kind, P) {
        const k = RETAIL[kind]; if (!k || !on(w) || !a) return { p: P }; if (!dirty(w, k)) return { p: P };
        const pf = prefOf(w, a, k);
        if (pf?.f === 'none') { if (kind !== 'meal' || Math.random() < 0.34) return { p: P, skip: true, k }; } // 抵制又沒有別家：衣服柴火不買，飯三天少吃一天
        const key = choose(w, a, k); if (!key) return { p: P }; const st = F(w, key);
        return { p: r2(P * (1 + st.up + (kind === 'firewood' ? FUEL[st.cut] : 0))), key };
    }
    // 客人付了錢以後分給各家。P 是沒漲以前的價錢，q 是 price() 的結果
    function sale(w, a, kind, P, q) {
        if (!q || !q.key) return MARKET.sale(w, kind, q ? q.p : P);
        const D = S(w); const k = RETAIL[kind]; const st = F(w, q.key); const parts = MARKET.SPLIT[kind] || [[k, 1]];
        let left = r2(P), retail = 0, skim = 0;
        parts.forEach(([kk, f], i) => { const v = i === parts.length - 1 ? left : r2(P * f); left = r2(left - v); if (kk === k) retail = r2(retail + v); else { const s = r2(v * SKIM[st.cut]); skim = r2(skim + s); MARKET.sell(w, kk, r2(v - s), t('村民消費')); } });
        const extra = r2(q.p - P); MARKET.sellFirm(w, k, r2(retail + skim + extra), t('村民消費'), isRiv(q.key));
        if (extra > 0 || skim > 0) { st.gain = r2((st.gain || 0) + extra + skim); D.st.extra = r2((D.st.extra || 0) + extra); D.st.skim = r2((D.st.skim || 0) + skim); }
        if (st.up > 0) notice(w, a, q.key, st, kind);
        if (st.cut > 0) harm(w, a, kind, q.key, st);
    }
    // 客人發現變貴了（每次調價只記一次），之後由 daily 挑幾位問他們要怎麼辦
    function notice(w, a, key, st, kind) {
        const D = S(w); const tag = a.agentId + '|' + key; if (D.seen[tag] === st.v) return; D.seen[tag] = st.v;
        const o = owner(w, key); if (!o || o === a) return;
        mem(w, a, '{s}的{g}貴了 {p}%，是{o}自己漲的。', { s: sname(key), g: GNAME[kind], p: Math.round(st.up * 100), o: o.name }, 4);
        rel(a, o)?.modifyAffinity?.(-Math.round(st.up * 12));
    }
    // ---------- 事：誰做了什麼、誰知道 ----------
    function fact(w, o) {
        const D = S(w); const f = Object.assign({ id: 'F' + (++D.n), d: day(w), end: null, knows: {}, open: false, tipped: 0, pub: 0, harm: 0, dead: 0 }, o); D.facts.push(f);
        if (D.facts.length > FACT_CAP) { const i = D.facts.findIndex(x => x.end != null); D.facts.splice(i >= 0 ? i : 0, 1); }
        return f;
    }
    const liveFact = (w, key, kind) => S(w).facts.find(f => f.key === key && f.kind === kind && f.end == null) || null;
    const factOf = (w, id) => S(w).facts.find(f => f.id === id) || null;
    // 讓某人知道一件事。回傳他是不是剛知道
    function learn(w, f, a, how) { if (!f || !a || a.agentId === f.by) return false; if (f.knows[a.agentId]) return false; f.knows[a.agentId] = how; return true; }
    const knowers = (w, f) => Object.keys(f.knows).map(id => w.agents[id]).filter(a => a && !a.isDead && !a.isPlayer);
    const knownBy = (w, a) => S(w).facts.filter(f => f.knows[a.agentId] || (f.open && f.end == null));
    // ---------- 老闆的手法（由決策核心呼叫） ----------
    function setUp(w, key, up) {
        const st = F(w, key); const o = owner(w, key); if (!o) return null; up = Math.max(0, Math.min(0.5, up)); if (up === st.up) return st;
        const old = liveFact(w, key, 'hike'); if (old) old.end = day(w);
        st.up = up; st.upD = day(w); st.v++;
        if (up > 0) { fact(w, { kind: 'hike', key, k: kOf(key), by: o.agentId, lv: up, open: true }); S(w).st.hikes = (S(w).st.hikes || 0) + 1; log(w, '🏷️ {o}把{s}的價錢漲了 {p}%。', { o: o.name, s: sname(key), p: Math.round(up * 100) }, o.name); }
        else { st.pact = null; log(w, '🏷️ {o}把{s}的價錢調回原本的樣子。', { o: o.name, s: sname(key) }, o.name); }
        return st;
    }
    function setCut(w, key, lv) {
        const st = F(w, key); const o = owner(w, key); if (!o) return null; lv = Math.max(0, Math.min(2, lv | 0)); if (lv === st.cut) return st;
        const old = liveFact(w, key, 'cut'); st.cut = lv; st.cutD = day(w);
        if (lv > 0) { const f = old || fact(w, { kind: 'cut', key, k: kOf(key), by: o.agentId, lv }); f.lv = Math.max(f.lv || 0, lv); for (const a of staff(w, key)) learn(w, f, a, 'staff'); if (!old) S(w).st.cuts = (S(w).st.cuts || 0) + 1; }
        else if (old) old.end = day(w);
        return st;
    }
    // 兩家講好一起漲。fake＝對方假裝答應、其實不漲
    function pact(w, key, fake) {
        const ok = other(w, key); const a = owner(w, key), b = owner(w, ok); if (!ok || !a || !b) return null;
        const f = fact(w, { kind: 'pact', key, k: kOf(key), by: a.agentId, with: b.agentId, lv: PACT_UP, fake: !!fake }); learn(w, f, b, 'party');
        S(w).st.pacts = (S(w).st.pacts || 0) + 1; setUp(w, key, Math.max(F(w, key).up, PACT_UP)); F(w, key).pact = f.id;
        if (!fake) { setUp(w, ok, Math.max(F(w, ok).up, PACT_UP)); F(w, ok).pact = f.id; }
        return f;
    }
    function endPact(w, f, why) { if (!f || f.end != null) return; f.end = day(w); f.why = why || ''; for (const key of [f.key, other(w, f.key)]) { if (key && S(w).f[key]?.pact === f.id) S(w).f[key].pact = null; } }
    // ---------- 出事 ----------
    const isFrail = (w, a) => { try { return (a.age ?? 30) >= 60 || (a.age ?? 30) < 12 || (HEALTH.ails(w, a) || []).length > 0; } catch (e) { return (a.age ?? 30) >= 60 || (a.age ?? 30) < 12; } };
    const HARM = {
        meal: { mild: 0.006, bad: 0.0005, text: ['吃了{s}的東西，上吐下瀉。', '吃了{s}的東西，上吐下瀉，病得很重。'], dead: '食物中毒' },
        clothes: { mild: 0.03, bad: 0.004, slow: 30, text: ['穿了{s}的衣服，身上一直發癢發疹。', '穿了{s}的衣服，身上一直發癢發疹，病得很重。'], dead: '劣質染料中毒' },
        firewood: { mild: 0.006, bad: 0.0006, text: ['燒了{s}的濕柴，屋裡悶了一夜的煙。', '燒了{s}的濕柴，屋裡悶了一夜的煙，病得很重。'], dead: '悶燒中毒' },
    };
    function harm(w, a, kind, key, st) {
        const H = HARM[kind]; if (!H) return; const D = S(w), d = day(w); const days = Math.max(0, d - (st.cutD || d)); const L = st.cut;
        const weak = isFrail(w, a); let sev = 0;
        const pBad = (days >= (H.slow || 0) ? H.bad : 0) * L * (1 + Math.min(3, days / 30)) * (weak ? 4 : 1);
        if (Math.random() < pBad) sev = 2; else if (Math.random() < H.mild * L) sev = 1; if (!sev) return;
        const f = liveFact(w, key, 'cut'); const rec = { id: a.agentId, name: a.name, key, kind, d, sev, fid: f?.id || null }; let died = false;
        if (sev === 2) {
            if (weak && Math.random() < 0.6) died = true;
            else { try { HEALTH.addAil(w, a, { p: kind === 'meal' ? 'c' : 'l', k: 'disease', s: 2 }, H.dead); } catch (e) {} }
        } else {
            a.moodModifier = (a.moodModifier || 0) - 3; if (a.needs) a.needs.rest = Math.max(0, (a.needs.rest ?? 50) - 20);
            if (kind !== 'meal') { try { HEALTH.addAil(w, a, { p: 'l', k: 'fever', s: 1 }, kind === 'clothes' ? '衣服不保暖' : '濕柴悶煙'); } catch (e) {} }
        }
        mem(w, a, H.text[sev - 1], { s: sname(key) }, sev === 2 ? 8 : 5);
        rec.dead = died; D.harm.push(rec); if (D.harm.length > HARM_CAP) D.harm.splice(0, D.harm.length - HARM_CAP);
        D.st.sick = (D.st.sick || 0) + 1; if (f) f.harm = (f.harm || 0) + 1;
        suspect(w, a, rec, f);
        if (died) { D.st.dead = (D.st.dead || 0) + 1; if (f) f.dead = (f.dead || 0) + 1; rec.cause = H.dead; D.deaths = D.deaths || []; D.deaths.push({ id: a.agentId, name: a.name, key, kind, d, fid: f?.id || null, cause: H.dead, linked: false }); try { a._deathCause = t(H.dead); a._dealDeath = { key, fid: f?.id || null }; w.lifecycle._killNpc(w, a); } catch (e) { console.warn('[Deal] death', e); } }
    }
    // 受害的人起不起疑：同一家出事兩次，或親近的人也在同一家中了
    function suspect(w, a, rec, f) {
        if (!f || a.isDead) return; const D = S(w); const mine = D.harm.filter(h => h.id === a.agentId && h.key === rec.key && rec.d - h.d <= 30).length;
        const near = D.harm.some(h => h.id !== a.agentId && h.key === rec.key && rec.d - h.d <= 30 && (a.relationships?.relationships?.[h.id]?.affinity || 0) >= 30);
        if (mine >= 2 || near || rec.sev === 2) { if (learn(w, f, a, 'victim')) { mem(w, a, '我覺得{s}的東西有問題，不只我一個人出事。', { s: sname(rec.key) }, 6); D.newKnow = D.newKnow || []; D.newKnow.push([f.id, a.agentId]); } }
    }
    // ---------- 每天 ----------
    function daily(w) {
        if (!on(w)) return; const D = S(w), d = day(w); if (D.lastDay === d) return; D.lastDay = d;
        countPref(w);
        // 老闆換人、店收掉：手法跟著結束
        for (const [key, st] of Object.entries(D.f)) { if (ownerId(w, key) !== st.by) { for (const f of D.facts) if (f.key === key && f.end == null) f.end = d; delete D.f[key]; } }
        for (const f of D.facts) { if (f.end != null) continue; if (f.kind === 'pact' && (!other(w, f.key) || (S(w).f[f.key]?.up || 0) < PACT_UP)) endPact(w, f, 'broken'); if (f.kind === 'cut') for (const a of staff(w, f.key)) if (learn(w, f, a, 'staff')) { D.newKnow = D.newKnow || []; D.newKnow.push([f.id, a.agentId]); } }
        for (const tag of Object.keys(D.seen)) { const key = tag.split('|')[1]; if (!D.f[key]) delete D.seen[tag]; }
        for (const id of Object.keys(D.asked)) if (d - D.asked[id] > 70) delete D.asked[id];
        try { if (typeof DEALASK !== 'undefined' && DEALASK) DEALASK.daily(w, D, d); } catch (e) { console.warn('[Deal] ask', e); }
        D.newKnow = [];
    }
    // ---------- 給畫面與帳本 ----------
    function firmView(w, key) {
        const st = F(w, key); const o = owner(w, key); const k = kOf(key);
        return { key, k, name: sname(key), icon: MARKET.SECTORS[k]?.icon || '', owner: o?.name || '', ownerId: o?.agentId || null, rival: isRiv(key), up: st.up, cut: st.cut, upDays: st.up ? day(w) - st.upD : 0, cutDays: st.cut ? day(w) - st.cutD : 0, gain: Math.round(st.gain || 0), pact: st.pact, staff: staff(w, key).length };
    }
    function view(w) {
        if (!on(w)) return null; const D = S(w), d = day(w);
        return { firms: firms(w).map(key => firmView(w, key)),
            facts: D.facts.slice(-20).reverse().map(f => ({ id: f.id, kind: f.kind, key: f.key, name: sname(f.key), by: w.agents[f.by]?.name || '', lv: f.lv, ago: d - f.d, live: f.end == null, open: !!f.open, knows: knowers(w, f).map(a => a.name), harm: f.harm || 0, dead: f.dead || 0, fake: !!f.fake, withName: f.with ? (w.agents[f.with]?.name || '') : '' })),
            boycott: Object.assign({}, D.prefN || {}), st: Object.assign({}, D.st) };
    }
    return { S, on, RETAIL, GOOD, GNAME, UPS, PACT_UP, price, sale, choose, rivalShare, F, firms, firmsOf, ownerId, owner, other, staff, sname, kOf, isRiv, setUp, setCut, pact, endPact, fact, liveFact, factOf, learn, knowers, knownBy, prefOf, setPref, countPref, harm, daily, view, firmView, isFrail };
})();
if (typeof globalThis !== 'undefined') globalThis.DEAL = DEAL;
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { DEAL.daily(w); } catch (e) { console.warn('[Deal] daily', e); } return r; };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype;
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.deal = null; return r; };
    const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.deal) { const { newKnow, ...rest } = this.deal; d.deal = rest; } return d; };
    const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.deal = (data?.deal && typeof data.deal === 'object') ? data.deal : null; } catch (e) {} return r; };
}
