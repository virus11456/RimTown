// RimTown - sim-repeal.js（v10.4.0）：投票通過的規定，可以再投票廢除
// 以前：禁賭、生物安全法、清潔空氣法這些規定，一通過就是永久的，程式裡沒有任何地方能把它們拿掉。
//       禁了賭的鎮永遠不會再有賭場，換了鎮長、換了一批居民也一樣。這不像民主：表決出來的規定，應該可以再表決改掉。
// 現在：一條規定實施滿 60 天後，鎮上只要有夠多人覺得它不該留，就會有人提「廢除某某規定」，走跟其他提案一樣的流程
//       （全鎮投票 → 大事送議會 → 首長裁決）。通過就廢除；沒通過，90 天內不再提同一條。廢除後 60 天內不能馬上再立同一條。
// 誰贊成、誰反對：把當初表決這條規定時每個人的立場反過來看（當初會投贊成的，現在反對廢除；理由也沿用），
//       所以立場跟著人的處境走：賭場關久了，被害的記憶淡了、想去試手氣的人還在，票數就可能翻過來。
// 本來就能改的不在這裡：稅率、關稅（可以再提案調）、核安法（可以放寬）、基因編輯禁令（可以解除）、宗教課稅（可以取消）、防疫措施（會解除）。
'use strict';

const REPEAL = (() => {
    const MIN = 60;    // 實施滿這麼多天才能提廢除
    const RETRY = 90;  // 同一條被否決後，隔這麼多天才能再提
    const GAP = 20;    // 兩件廢除案之間至少隔這麼多天
    const QUIET = 60;  // 剛廢除的規定，這麼多天內不能再立
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const adults = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && (a.age ?? 30) >= 16 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId));
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 50);
    const fx = (w) => { try { w.buildings?.recomputeEffects?.(w); } catch (e) {} };
    const log = (w, k, p) => { try { w.logMessageT?.('social', k, p || {}, ''); } catch (e) {} };
    const news = (w, s, imp) => { try { w.dailyNews?.collectEvent?.('social', s, imp || 7, []); } catch (e) {} };

    // 每一條可以廢除的規定：on 現在有沒有在實施、since 哪一天開始的、off 廢除時做什麼、vote 當初表決它時這個人的立場、
    // why 提案人說為什麼該廢、after 廢除後會怎樣（都會寫在提案上，AI 投票時也看得到）、lead 誰最可能帶頭
    const LAWS = {
        casino_ban: { icon: '🎰', name: '禁賭', cat: 'economy', ok: () => typeof CASINO !== 'undefined',
            on: (w) => !!w.casino?.ban,
            since: (w) => w.casino?.banDay ?? w.things?.list?.[w.casino?.thing]?.goneDay ?? null,
            off: (w) => { const C = w.casino; C.ban = false; C.banDay = null; },
            vote: (w, a) => CASINO.vote(w, { kind: 'casino_ban' }, a),
            lead: (w, a) => (cash(w, a) >= 250 ? 2 : 0) + (has(a, 'greedy') || has(a, 'ambitious') ? 1.5 : 0) + ((w.casino?.v?.[a.agentId] || 0) >= 3 ? 1.5 : 0),
            why: '賭場關了以後，想試手氣的人沒地方去，鎮上也少了一門生意。', after: '廢除以後，有本錢的人可以再開賭場；要不要開、去不去賭，各人自己決定。' },
        bio_safety: { icon: '📋', name: '生物安全法', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).law, since: (w) => BIO.S(w).law, off: (w) => { const B = BIO.S(w); B.law = 0; B.lastLaw = day(w); },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_safety' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 3 : 0) + (has(a, 'ambitious') ? 1 : 0),
            why: '研究院已經好一陣子沒出事，層層上鎖和消毒只是讓研究變慢。', after: '廢除以後，研究恢復原本的速度，樣本外洩的機會也回到原本那麼高。' },
        bio_price: { icon: '💊', name: '藥價管制', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).price, since: (w) => BIO.S(w).price, off: (w) => { BIO.S(w).price = 0; },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_price' }, a), lead: (w, a) => (a.job?.key === 'doctor' ? 3 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '看診和賣藥的人說，價錢被壓著，藥都快做不下去了。', after: '廢除以後，看診和買藥恢復原價。' },
        bio_gmban: { icon: '🌾', name: '禁止基因作物', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).gmban, since: (w) => BIO.S(w).gmban, off: (w) => { const B = BIO.S(w); B.gmban = 0; B.lastGm = day(w); fx(w); },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_gmban' }, a), lead: (w, a) => (a.job?.key === 'farmer' ? 2.5 : 0) + (a.job?.key === 'researcher' ? 1.5 : 0),
            why: '田裡改回老品種以後收成少了一截，種田的人撐得很辛苦。', after: '廢除以後，田裡可以再種基因作物，產量回到禁種之前。' },
        bio_halt: { icon: '✋', name: '停止人體實驗', cat: 'culture', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).halt, since: (w) => BIO.S(w).halt, off: (w) => { BIO.S(w).halt = 0; },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_halt' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 3 : 0) + (a.job?.key === 'doctor' ? 1 : 0),
            why: '研究停擺這麼久，本來治得好的病也沒人去研究了。', after: '廢除以後，基因編輯、延壽、合成生命的研究可以重新開始。' },
        steam_air: { icon: '🌫️', name: '清潔空氣法', cat: 'economy', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).air, since: (w) => STEAM.S(w).air, off: (w) => { const X = STEAM.S(w); X.air = 0; X.lastAirProp = day(w); fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_air' }, a), lead: (w, a) => (['builder', 'blacksmith', 'miner'].includes(a.job?.key) ? 2 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '乾淨的燃料太貴、濾網又拖慢工期，蓋東西比以前慢多了。', after: '廢除以後，工坊照原本的方式燒，蓋東西變快，煤煙也回到原本那麼多。' },
        steam_factory: { icon: '🏭', name: '工廠法', cat: 'economy', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).factory, since: (w) => STEAM.S(w).factory, off: (w) => { STEAM.S(w).factory = 0; fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_factory' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0) + (has(a, 'greedy') ? 1 : 0); } catch (e) { return 0; } },
            why: '東家們說，一天只能做十個鐘頭、鍋爐每月停下來檢查，工坊根本趕不出貨。', after: '廢除以後，工時不再有上限、鍋爐不必每月檢查，孩子也可以再進工坊。' },
        steam_homun: { icon: '🧪', name: '禁造人造人', cat: 'culture', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).homunban, since: (w) => STEAM.S(w).homunban, off: (w) => { STEAM.S(w).homunban = 0; fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_homun' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 2 : 0) + (a.job?.key === 'farmer' || a.job?.key === 'builder' ? 1.5 : 0),
            why: '舊的人造人一個一個做壞了，田裡和工地的人手越來越不夠。', after: '廢除以後，可以再造新的人造人來做工。' },
        sh_audit: { icon: '📒', name: '產業帳本公開', cat: 'economy', ok: () => typeof SHARES !== 'undefined',
            on: (w) => !!SHARES.S(w).sh?.law?.audit, since: (w) => SHARES.S(w).sh.law.audit, off: (w) => { SHARES.S(w).sh.law.audit = 0; },
            vote: (w, a) => SHARES.vote(w, { kind: 'sh_audit' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0); } catch (e) { return 0; } },
            why: '當家的說，每季攤開帳本是在防賊，生意上的事不該給全鎮看。', after: '廢除以後，各產業的帳本不必再公開，做假帳比較不容易被抓到。' },
        sh_staff: { icon: '👷', name: '員工認股', cat: 'economy', ok: () => typeof SHARES !== 'undefined',
            on: (w) => !!SHARES.S(w).sh?.law?.staff, since: (w) => SHARES.S(w).sh.law.staff, off: (w) => { SHARES.S(w).sh.law.staff = 0; },
            vote: (w, a) => SHARES.vote(w, { kind: 'sh_staff' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0); } catch (e) { return 0; } },
            why: '當家的說，股份越分越散，連自己的店都快作不了主。', after: '廢除以後，做工的人不能再認購自家產業的股份；已經買到手的照留。' },
        medaid: { icon: '🏥', name: '公費醫療補助', cat: 'economy', ok: () => typeof HEALTH !== 'undefined',
            on: (w) => !!w.health?.medaid, since: (w) => w.health?.medaidDay ?? null, off: (w) => { w.health.medaid = false; w.health.medaidDay = null; w.health.lastProp = day(w); },
            vote: (w, a) => HEALTH.vote(w, { kind: 'medaid' }, a), lead: (w, a) => (cash(w, a) > 250 ? 2.5 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '公庫的錢一直往醫藥費上貼，有人覺得該省下來做別的事。', after: '廢除以後，公庫不再幫付不起醫藥費的人出一半。' },
    };

    function S(w) {
        if (!w.repeal || typeof w.repeal !== 'object') w.repeal = { last: {}, seen: {}, done: [], lastAny: -99 };
        const R = w.repeal; R.last = R.last || {}; R.seen = R.seen || {}; R.done = R.done || []; if (!Number.isFinite(R.lastAny)) R.lastAny = -99; return R;
    }
    const lawOk = (w, id) => { const L = LAWS[id]; try { return !!L && L.ok() && !!L.on(w); } catch (e) { return false; } };
    // 這條規定哪一天開始的。舊存檔沒記日期的，從第一次看到它那天算起
    function since(w, id) {
        const R = S(w); let d = null; try { d = LAWS[id].since(w); } catch (e) {}
        if (Number.isFinite(d) && d > 0) return d;
        if (!Number.isFinite(R.seen[id])) R.seen[id] = day(w);
        return R.seen[id];
    }
    // 把當初表決這條規定的立場反過來：當初贊成立法的，現在反對廢除
    function vote(w, p, a) {
        const L = LAWS[p.refKey]; let r = null;
        try { r = L ? L.vote(w, a) : null; } catch (e) { r = null; }
        if (!r || !r.v) return { v: Math.random() < 0.45 ? 'for' : 'against', why: 'gut' };
        return { v: r.v === 'for' ? 'against' : 'for', why: r.why || 'gut' };
    }
    const busy = (w) => (w.proposals?.items || []).some(p => p.kind === 'law_repeal' && ['open', 'shelved', 'approved'].includes(p.status));
    // 現在鎮上有幾成的人會贊成廢除（問一遍每個人的立場；只用來決定「會不會有人想提」）
    function support(w, id) { const A = adults(w); if (!A.length) return { f: 0, pro: [] }; const pro = A.filter(a => vote(w, { refKey: id }, a).v === 'for'); return { f: pro.length / A.length, pro }; }
    function propose(w, id, who) {
        const L = LAWS[id]; if (!L || typeof TECH === 'undefined' || !who) return null; const d = day(w); const R = S(w);
        const p = TECH.propose(w, 'law_repeal', id, who, '廢除「{law}」', '{who}說「{law}」已經實施 {n} 天了。{why}提議把這條規定廢除。{after}', { law: L.name, n: Math.max(1, d - since(w, id)), why: L.why, after: L.after }, L.cat, { law: L.name });
        if (p) { R.last[id] = d; R.lastAny = d; }
        return p;
    }
    function daily(w) {
        if (!w?.proposals || typeof TECH === 'undefined') return; const R = S(w); const d = day(w);
        if (R.lastDay === d) return; R.lastDay = d;
        for (const id of Object.keys(R.seen)) if (!lawOk(w, id)) delete R.seen[id]; // 規定不在了，下次再立要重新算日子
        const live = Object.keys(LAWS).filter(id => lawOk(w, id)); for (const id of live) since(w, id);
        if (busy(w) || d - R.lastAny < GAP) return;
        for (const id of live.sort(() => Math.random() - 0.5)) {
            if (d - since(w, id) < MIN || d - (R.last[id] ?? -999) < RETRY) continue;
            const sp = support(w, id); if (sp.f < 0.3 || !sp.pro.length) continue;          // 沒什麼人想廢：不會有人提
            if (Math.random() > 0.03 + 0.2 * (sp.f - 0.3)) continue;                         // 越多人想廢，越快有人站出來
            const L = LAWS[id]; const who = sp.pro.slice().sort((x, y) => ((L.lead ? L.lead(w, y) : 0) + (has(y, 'charismatic') ? 0.5 : 0)) - ((L.lead ? L.lead(w, x) : 0) + (has(x, 'charismatic') ? 0.5 : 0)))[0];
            if (propose(w, id, who)) return;
        }
    }
    function enact(w, p) {
        const id = p?.refKey; const L = LAWS[id]; if (!L || !lawOk(w, id)) return ''; const R = S(w); const d = day(w);
        const n = Math.max(0, d - since(w, id));
        try { L.off(w); } catch (e) { console.warn('[Repeal] off', id, e); return ''; }
        delete R.seen[id]; R.last[id] = d; R.done.push({ id, d, n }); if (R.done.length > 12) R.done.shift();
        log(w, '🗳️ 小鎮表決廢除了「{law}」（實施了 {n} 天）。{after}', { law: L.name, n, after: L.after });
        news(w, `🗳️ ${t('小鎮廢除了')}${t('「')}${t(L.name)}${t('」')}`, 8);
        return t('「{law}」廢除了').replace('{law}', t(L.name));
    }
    // 剛廢除的規定，短時間內不能馬上再立（給「廢除後的日子」一點時間；不然兩派可以每個月互相翻案）
    const quiet = (w, kind) => { if (!LAWS[kind]) return false; const x = (w.repeal?.done || []).filter(r => r.id === kind).pop(); return !!x && day(w) - x.d < QUIET; };
    // 給介面：現在實施中的規定、還要幾天才能提廢除、最近廢除了哪些
    function view(w) {
        const R = S(w); const d = day(w);
        const live = Object.keys(LAWS).filter(id => lawOk(w, id)).map(id => { const L = LAWS[id]; const n = Math.max(0, d - since(w, id)); const wait = Math.max(MIN - n, RETRY - (d - (R.last[id] ?? -999)), 0); return { id, icon: L.icon, name: t(L.name), days: n, wait, open: (w.proposals?.items || []).some(p => p.kind === 'law_repeal' && p.refKey === id && ['open', 'shelved'].includes(p.status)) }; });
        const done = R.done.slice().reverse().map(r => ({ id: r.id, icon: LAWS[r.id]?.icon || '🗳️', name: t(LAWS[r.id]?.name || r.id), ago: d - r.d, days: r.n }));
        return { live, done };
    }
    return { S, LAWS, MIN, RETRY, GAP, QUIET, daily, vote, enact, propose, support, since, quiet, view };
})();

// ---------- 接上其他系統 ----------
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { law_repeal: { icon: '🗳️', label: '廢除規定' } });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { REPEAL.daily(w); } catch (e) { console.warn('[Repeal] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'law_repeal') { const r = REPEAL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
    const _cw = PS._createWith;
    PS._createWith = function (w, d, cand, who, ...rest) { try { if (cand && REPEAL.quiet(w, cand.kind)) return null; } catch (e) {} return _cw.call(this, w, d, cand, who, ...rest); };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.repeal = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.repeal) d.repeal = this.repeal; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.repeal = (data?.repeal && typeof data.repeal === 'object') ? data.repeal : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.REPEAL = REPEAL;
