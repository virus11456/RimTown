// RimTown - sim-repeal.js（v10.4.0）：表決出來的規定，可以再表決改掉；改掉的也可以再表決恢復
// 以前：禁賭、生物安全法、清潔空氣法這些規定，一通過就是永久的，程式裡沒有任何地方能把它們拿掉。
// 現在：規定只是「上一次表決的結果」。任何一條表決通過的規定都可以被提案廢除，被廢除的也可以被提案恢復，
//       兩個方向走的都是原本的提案流程（全鎮投票 → 大事送議會 → 首長裁決），沒有另外一套機制。
// 誰來提：規則版——夠多人（三成）站在另一邊時，會有人站出來提；完整智能體模式——村民自己發想提案時，
//       看得到現行規定與被廢除的規定，可以自己決定要提「廢除某條」或「恢復某條」（效果 repeal／restore）。
// 誰贊成：恢復案＝當初表決這條規定時每個人的立場；廢除案＝把那個立場反過來。理由沿用。
// 涵蓋：下面 LAWS 表裡的規定，加上村民提案立下的「本鎮規矩與傳統」（每一條都算一條規定）。
//       新系統要加一條規定，只要在 LAWS 加一筆（on／since／off／set／vote）。
// 冷卻：實施滿 60 天才能提廢除；廢除滿 60 天才能提恢復（也不能用原本的提案再立）；同一案被否決後 90 天內不再提；兩案至少隔 20 天。
// 本來就能雙向改的不在這裡：稅率、關稅、核安法、基因編輯禁令、宗教課稅、防疫措施、鎮長（選舉與罷免）。
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
            why: '賭場關了以後，想試手氣的人沒地方去，鎮上也少了一門生意。', after: '廢除以後，有本錢的人可以再開賭場；要不要開、去不去賭，各人自己決定。',
            set: (w) => CASINO.enact(w, {}), back: '有人擔心賭場回來以後，又會有人把家產輸光。' },
        bio_safety: { icon: '📋', name: '生物安全法', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).law, since: (w) => BIO.S(w).law, off: (w) => { const B = BIO.S(w); B.law = 0; B.lastLaw = day(w); },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_safety' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 3 : 0) + (has(a, 'ambitious') ? 1 : 0),
            why: '研究院已經好一陣子沒出事，層層上鎖和消毒只是讓研究變慢。', after: '廢除以後，研究恢復原本的速度，樣本外洩的機會也回到原本那麼高。',
            set: (w) => BIO.setLaw(w, 'bio_safety'), back: '有人擔心研究院少了這些規矩，樣本遲早會外洩。' },
        bio_price: { icon: '💊', name: '藥價管制', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).price, since: (w) => BIO.S(w).price, off: (w) => { BIO.S(w).price = 0; },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_price' }, a), lead: (w, a) => (a.job?.key === 'doctor' ? 3 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '看診和賣藥的人說，價錢被壓著，藥都快做不下去了。', after: '廢除以後，看診和買藥恢復原價。',
            set: (w) => BIO.setLaw(w, 'bio_price'), back: '付不起醫藥費的人說，藥價放開以後看病更難了。' },
        bio_gmban: { icon: '🌾', name: '禁止基因作物', cat: 'economy', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).gmban, since: (w) => BIO.S(w).gmban, off: (w) => { const B = BIO.S(w); B.gmban = 0; B.lastGm = day(w); fx(w); },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_gmban' }, a), lead: (w, a) => (a.job?.key === 'farmer' ? 2.5 : 0) + (a.job?.key === 'researcher' ? 1.5 : 0),
            why: '田裡改回老品種以後收成少了一截，種田的人撐得很辛苦。', after: '廢除以後，田裡可以再種基因作物，產量回到禁種之前。',
            set: (w) => BIO.setLaw(w, 'bio_gmban'), back: '有人還是不放心田裡種基因作物。' },
        bio_halt: { icon: '✋', name: '停止人體實驗', cat: 'culture', ok: () => typeof BIO !== 'undefined',
            on: (w) => !!BIO.S(w).halt, since: (w) => BIO.S(w).halt, off: (w) => { BIO.S(w).halt = 0; },
            vote: (w, a) => BIO.vote(w, { kind: 'bio_halt' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 3 : 0) + (a.job?.key === 'doctor' ? 1 : 0),
            why: '研究停擺這麼久，本來治得好的病也沒人去研究了。', after: '廢除以後，基因編輯、延壽、合成生命的研究可以重新開始。',
            set: (w) => BIO.setLaw(w, 'bio_halt'), back: '有人覺得拿人做實驗這條線不該再跨過去。' },
        steam_air: { icon: '🌫️', name: '清潔空氣法', cat: 'economy', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).air, since: (w) => STEAM.S(w).air, off: (w) => { const X = STEAM.S(w); X.air = 0; X.lastAirProp = day(w); fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_air' }, a), lead: (w, a) => (['builder', 'blacksmith', 'miner'].includes(a.job?.key) ? 2 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '乾淨的燃料太貴、濾網又拖慢工期，蓋東西比以前慢多了。', after: '廢除以後，工坊照原本的方式燒，蓋東西變快，煤煙也回到原本那麼多。',
            set: (w) => STEAM.setLaw(w, 'steam_air'), back: '有人說少了這條規定，煤煙又多了起來，咳嗽的人也多了。' },
        steam_factory: { icon: '🏭', name: '工廠法', cat: 'economy', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).factory, since: (w) => STEAM.S(w).factory, off: (w) => { STEAM.S(w).factory = 0; fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_factory' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0) + (has(a, 'greedy') ? 1 : 0); } catch (e) { return 0; } },
            why: '東家們說，一天只能做十個鐘頭、鍋爐每月停下來檢查，工坊根本趕不出貨。', after: '廢除以後，工時不再有上限、鍋爐不必每月檢查，孩子也可以再進工坊。',
            set: (w) => STEAM.setLaw(w, 'steam_factory'), back: '做工的人說，少了這條規定，工時又沒有上限了。' },
        steam_homun: { icon: '🧪', name: '禁造人造人', cat: 'culture', ok: () => typeof STEAM !== 'undefined',
            on: (w) => !!STEAM.S(w).homunban, since: (w) => STEAM.S(w).homunban, off: (w) => { STEAM.S(w).homunban = 0; fx(w); },
            vote: (w, a) => STEAM.vote(w, { kind: 'steam_homun' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 2 : 0) + (a.job?.key === 'farmer' || a.job?.key === 'builder' ? 1.5 : 0),
            why: '舊的人造人一個一個做壞了，田裡和工地的人手越來越不夠。', after: '廢除以後，可以再造新的人造人來做工。',
            set: (w) => STEAM.setLaw(w, 'steam_homun'), back: '有人還是覺得人造人不該再造。' },
        sh_audit: { icon: '📒', name: '產業帳本公開', cat: 'economy', ok: () => typeof SHARES !== 'undefined',
            on: (w) => !!SHARES.S(w).sh?.law?.audit, since: (w) => SHARES.S(w).sh.law.audit, off: (w) => { SHARES.S(w).sh.law.audit = 0; },
            vote: (w, a) => SHARES.vote(w, { kind: 'sh_audit' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0); } catch (e) { return 0; } },
            why: '當家的說，每季攤開帳本是在防賊，生意上的事不該給全鎮看。', after: '廢除以後，各產業的帳本不必再公開，做假帳比較不容易被抓到。',
            set: (w) => SHARES.enact(w, { kind: 'sh_audit' }), back: '小股東說，帳本不公開，被坑了也不知道。' },
        sh_staff: { icon: '👷', name: '員工認股', cat: 'economy', ok: () => typeof SHARES !== 'undefined',
            on: (w) => !!SHARES.S(w).sh?.law?.staff, since: (w) => SHARES.S(w).sh.law.staff, off: (w) => { SHARES.S(w).sh.law.staff = 0; },
            vote: (w, a) => SHARES.vote(w, { kind: 'sh_staff' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0); } catch (e) { return 0; } },
            why: '當家的說，股份越分越散，連自己的店都快作不了主。', after: '廢除以後，做工的人不能再認購自家產業的股份；已經買到手的照留。',
            set: (w) => SHARES.enact(w, { kind: 'sh_staff' }), back: '做工的人說，想認購自家產業的股份卻沒有門路。' },
        medaid: { icon: '🏥', name: '公費醫療補助', cat: 'economy', ok: () => typeof HEALTH !== 'undefined',
            on: (w) => !!w.health?.medaid, since: (w) => w.health?.medaidDay ?? null, off: (w) => { w.health.medaid = false; w.health.medaidDay = null; w.health.lastProp = day(w); },
            vote: (w, a) => HEALTH.vote(w, { kind: 'medaid' }, a), lead: (w, a) => (cash(w, a) > 250 ? 2.5 : 0) + (has(a, 'greedy') ? 1 : 0),
            why: '公庫的錢一直往醫藥費上貼，有人覺得該省下來做別的事。', after: '廢除以後，公庫不再幫付不起醫藥費的人出一半。',
            set: (w) => HEALTH.setAid(w), back: '付不起醫藥費的人說，沒了補助只能拖著不看病。' },
        gene_rights: { icon: '🤝', name: '神裔平權令', cat: 'culture', ok: () => typeof MYTHSOC !== 'undefined',
            on: (w) => !!w.mythsoc?.rights, since: (w) => w.mythsoc?.rightsAt ?? null, off: (w) => { const X = w.mythsoc; X.rights = false; X.rightsAt = null; X.lastRights = day(w); },
            vote: (w, a) => MYTHSOC.vote(w, { kind: 'gene_rights' }, a), lead: (w, a) => { try { return (MYTHSOC.isPure(w, a) ? 3 : 0) + (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 1 : 0); } catch (e) { return 0; } },
            why: '純人派說，老闆要用誰是老闆自己的事，這條規定管太多。', after: '廢除以後，老闆可以因為基因辭退人，獵人隊抓到人也不必先交給守衛。',
            set: (w) => MYTHSOC.rights(w), back: '神裔說，少了這條規定，又有人因為基因丟了工作。' },
        antitrust_cap: { icon: '⚖️', name: '一人最多兩家店', cat: 'economy', ok: () => typeof COMPETE !== 'undefined' && typeof CYCLE !== 'undefined',
            on: (w) => !!w.cycle?.law && (w.cycle.cap || 3) <= 2, since: () => null, off: (w) => { w.cycle.cap = 3; w.cycle.lastCap = day(w); },
            vote: (w, a) => CYCLE.antitrustVote(w, { kind: 'antitrust_cap' }, a), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' ? MARKET.ownedBy(w, a.agentId).length * 1.5 : 0) + (has(a, 'greedy') ? 1 : 0); } catch (e) { return 0; } },
            why: '開店的人說，一個人只能有兩家店，想把生意做大都不行。', after: '廢除以後，一個人名下可以有三家店。',
            set: (w) => COMPETE.enactCap(w, {}), back: '有人覺得店又慢慢集中到少數人手上。' },
    };

    function S(w) {
        if (!w.repeal || typeof w.repeal !== 'object') w.repeal = { last: {}, seen: {}, done: [], lastAny: -99 };
        const R = w.repeal; R.last = R.last || {}; R.lastBack = R.lastBack || {}; R.seen = R.seen || {}; R.done = R.done || []; R.shelf = R.shelf || {}; if (!Number.isFinite(R.lastAny)) R.lastAny = -99; return R;
    }
    // ---- 村民提案立下的規矩與傳統：每一條都算一條規定（代碼 trad:<提案編號>）----
    const tkey = (x) => 'trad:' + (x.id || ('t' + Array.from(String(x.text || '')).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 99991, 7)));
    const trads = (w) => (Array.isArray(w.proposals?.traditions) ? w.proposals.traditions : []);
    // 這條規矩留不留：提的人自己、跟他要好的人想留；跟他處不來的想拿掉；其他人看個性，多數人懶得改（維持現狀佔一點便宜）
    function tradVote(w, a, x) {
        const by = Object.values(w.agents || {}).find(o => o.name === x.by); const mine = by && by.agentId === a.agentId;
        const r = by && !mine ? (a.relationships?.relationships?.[by.agentId]?.affinity || 0) : 0;
        const s = (mine ? 4 : 0) + r / 30 + (has(a, 'stoic') || has(a, 'perfectionist') ? 0.6 : 0) - (has(a, 'creative') || has(a, 'lazy') ? 0.6 : 0) + 0.3 + (Math.random() - 0.5) * 2;
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (mine || r >= 30 ? 'trad_friend' : 'trad_keep') : (r <= -30 ? 'trad_foe' : 'trad_drop') };
    }
    function trad(w, id) {
        const R = S(w); const x = trads(w).find(o => tkey(o) === id) || null; const src = x || R.shelf[id]; if (!src) return null;
        return { icon: '📜', name: src.text, free: true, cat: 'culture', ok: () => true, on: () => !!trads(w).find(o => tkey(o) === id), since: () => (trads(w).find(o => tkey(o) === id) || {}).day ?? null,
            off: (w) => { const L = w.proposals.traditions; const i = L.findIndex(o => tkey(o) === id); if (i >= 0) { R.shelf[id] = L[i]; L.splice(i, 1); } const ks = Object.keys(R.shelf); if (ks.length > 8) delete R.shelf[ks[0]]; },
            set: (w) => { const o = R.shelf[id]; if (!o) return ''; const L = w.proposals.traditions || (w.proposals.traditions = []); L.push(Object.assign({}, o, { day: day(w) })); if (L.length > 6) L.splice(0, L.length - 6); delete R.shelf[id]; return t('老規矩恢復了'); },
            vote: (w, a) => tradVote(w, a, src), lead: () => 0,
            why: '有人覺得這條規矩已經不合時宜。', after: '廢除以後，大家不必再照這條規矩做。', back: '有人懷念這條老規矩。' };
    }
    const law = (w, id) => LAWS[id] || (String(id || '').startsWith('trad:') ? trad(w, id) : null);
    const nameOf = (L) => L.name;
    const lawOk = (w, id) => { const L = law(w, id); try { return !!L && L.ok() && !!L.on(w); } catch (e) { return false; } };
    const liveIds = (w) => [...Object.keys(LAWS), ...trads(w).map(tkey)].filter(id => lawOk(w, id));
    // 被表決廢除、現在還沒恢復的規定（每條只看最近一次）
    function goneList(w) { const R = S(w); const seen = new Set(); const out = []; for (const x of R.done.slice().reverse()) { if (seen.has(x.id)) continue; seen.add(x.id); const L = law(w, x.id); let ok = false; try { ok = !!L && L.ok() && !L.on(w) && typeof L.set === 'function'; } catch (e) {} if (ok && !x.back) out.push(x); } return out; }
    // 這條規定哪一天開始的。舊存檔沒記日期的，從第一次看到它那天算起
    function since(w, id) {
        const R = S(w); let d = null; try { d = law(w, id).since(w); } catch (e) {}
        if (Number.isFinite(d) && d > 0) return d;
        if (!Number.isFinite(R.seen[id])) R.seen[id] = day(w);
        return R.seen[id];
    }
    // 立場：恢復案＝當初表決這條規定時的立場；廢除案＝把它反過來。理由沿用
    function vote(w, p, a) {
        const L = law(w, p.refKey); let r = null;
        try { r = L ? L.vote(w, a) : null; } catch (e) { r = null; }
        if (!r || !r.v) return { v: Math.random() < 0.45 ? 'for' : 'against', why: 'gut' };
        if (p.kind === 'law_restore') return { v: r.v, why: r.why || 'gut' };
        return { v: r.v === 'for' ? 'against' : 'for', why: r.why || 'gut' };
    }
    const KINDS = ['law_repeal', 'law_restore'];
    const busy = (w) => (w.proposals?.items || []).some(p => KINDS.includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status));
    const openFor = (w, id, kind) => (w.proposals?.items || []).some(p => p.kind === kind && p.refKey === id && ['open', 'shelved'].includes(p.status));
    // 現在鎮上有幾成的人會贊成這一案（問一遍每個人的立場；只用來決定「會不會有人想提」）
    function support(w, id, kind) { const A = adults(w); if (!A.length) return { f: 0, pro: [] }; const pro = A.filter(a => vote(w, { refKey: id, kind: kind || 'law_repeal' }, a).v === 'for'); return { f: pro.length / A.length, pro }; }
    // 還要等幾天才能提（0＝現在就能提）
    function waitRepeal(w, id) { const R = S(w); const d = day(w); return Math.max(MIN - (d - since(w, id)), RETRY - (d - (R.last[id] ?? -999)), 0); }
    function waitBack(w, x) { const R = S(w); const d = day(w); return Math.max(QUIET - (d - x.d), RETRY - (d - (R.lastBack[x.id] ?? -999)), 0); }
    function propose(w, id, who, kind) {
        const L = law(w, id); if (!L || typeof TECH === 'undefined' || !who) return null; const d = day(w); const R = S(w); const nm = nameOf(L);
        if (kind === 'law_restore') {
            const x = goneList(w).find(o => o.id === id); if (!x) return null;
            const p = TECH.propose(w, 'law_restore', id, who, '恢復「{law}」', '{who}說「{law}」被廢除 {n} 天了。{why}提議把這條規定恢復。', { law: nm, n: Math.max(1, d - x.d), why: L.back || '' }, L.cat, { law: nm });
            if (p) { R.lastBack[id] = d; R.lastAny = d; }
            return p;
        }
        if (!lawOk(w, id)) return null;
        const p = TECH.propose(w, 'law_repeal', id, who, '廢除「{law}」', '{who}說「{law}」已經實施 {n} 天了。{why}提議把這條規定廢除。{after}', { law: nm, n: Math.max(1, d - since(w, id)), why: L.why, after: L.after }, L.cat, { law: nm });
        if (p) { R.last[id] = d; R.lastAny = d; }
        return p;
    }
    const leader = (w, L, pro) => pro.slice().sort((x, y) => ((L.lead ? L.lead(w, y) : 0) + (has(y, 'charismatic') ? 0.5 : 0)) - ((L.lead ? L.lead(w, x) : 0) + (has(x, 'charismatic') ? 0.5 : 0)))[0];
    // 規則版：夠多人站在另一邊，就會有人站出來提（兩個方向都一樣）
    function daily(w) {
        if (!w?.proposals || typeof TECH === 'undefined') return; const R = S(w); const d = day(w);
        if (R.lastDay === d) return; R.lastDay = d;
        const live = liveIds(w); for (const id of Object.keys(R.seen)) if (!live.includes(id)) delete R.seen[id]; // 規定不在了，下次再立要重新算日子
        for (const id of live) since(w, id);
        const gone = goneList(w); if (!live.length && !gone.length) return;
        if (busy(w) || d - R.lastAny < GAP) return;
        const jobs = [...live.map(id => ({ id, kind: 'law_repeal', wait: waitRepeal(w, id) })), ...gone.map(x => ({ id: x.id, kind: 'law_restore', wait: waitBack(w, x) }))].filter(j => j.wait <= 0).sort(() => Math.random() - 0.5);
        for (const j of jobs) {
            const sp = support(w, j.id, j.kind); if (sp.f < 0.3 || !sp.pro.length) continue;          // 沒什麼人站在另一邊：不會有人提
            if (Math.random() > 0.03 + 0.2 * (sp.f - 0.3)) continue;                                    // 越多人想改，越快有人站出來
            const L = law(w, j.id); const who = j.kind === 'law_restore' ? sp.pro[Math.floor(Math.random() * sp.pro.length)] : leader(w, L, sp.pro);
            if (propose(w, j.id, who, j.kind)) return;
        }
    }
    function enact(w, p) {
        const id = p?.refKey; const L = law(w, id); if (!L) return ''; const R = S(w); const d = day(w); const nm = nameOf(L);
        if (p.kind === 'law_restore') {
            const x = goneList(w).find(o => o.id === id); if (!x) return '';
            let r = ''; try { r = L.set(w); } catch (e) { console.warn('[Repeal] set', id, e); return ''; } if (!r) return '';
            x.back = d; R.lastBack[id] = d;
            log(w, '🗳️ 小鎮表決恢復了「{law}」（廢除了 {n} 天）。', { law: nm, n: Math.max(0, d - x.d) });
            news(w, `🗳️ ${t('小鎮恢復了')}${t('「')}${t(nm)}${t('」')}`, 8);
            return t('「{law}」恢復了').replace('{law}', t(nm));
        }
        if (!lawOk(w, id)) return '';
        const n = Math.max(0, d - since(w, id));
        try { L.off(w); } catch (e) { console.warn('[Repeal] off', id, e); return ''; }
        delete R.seen[id]; R.last[id] = d; R.done.push({ id, d, n, name: L.free ? L.name : undefined }); if (R.done.length > 16) R.done.shift();
        log(w, '🗳️ 小鎮表決廢除了「{law}」（實施了 {n} 天）。{after}', { law: nm, n, after: L.after });
        news(w, `🗳️ ${t('小鎮廢除了')}${t('「')}${t(nm)}${t('」')}`, 8);
        return t('「{law}」廢除了').replace('{law}', t(nm));
    }
    // 剛廢除的規定，短時間內不能用原本的提案馬上再立（要恢復，60 天後走「恢復」案）
    const quiet = (w, kind) => { if (!LAWS[kind]) return false; const x = (w.repeal?.done || []).filter(r => r.id === kind).pop(); return !!x && !x.back && day(w) - x.d < QUIET; };
    // 給介面：現在實施中的規定、被廢除還沒恢復的規定，各自還要幾天才能提
    function view(w) {
        const d = day(w);
        const live = liveIds(w).map(id => { const L = law(w, id); return { id, icon: L.icon, name: t(nameOf(L)), free: !!L.free, days: Math.max(0, d - since(w, id)), wait: waitRepeal(w, id), open: openFor(w, id, 'law_repeal') }; });
        const done = goneList(w).map(x => { const L = law(w, x.id); return { id: x.id, icon: L?.icon || '🗳️', name: t(L ? nameOf(L) : (x.name || x.id)), free: !!L?.free, ago: d - x.d, days: x.n, wait: waitBack(w, x), open: openFor(w, x.id, 'law_restore') }; });
        return { live, done };
    }
    // ---- 完整智能體：村民自己發想提案時，看得到這兩張清單，可以自己決定要廢除或恢復哪一條 ----
    function promptBlock(w) {
        try {
            if (busy(w)) return ''; const v = view(w); const a = v.live.filter(x => x.wait <= 0).slice(0, 8), b = v.done.filter(x => x.wait <= 0).slice(0, 6); if (!a.length && !b.length) return '';
            const row = (x, k) => `${x.id}${t('＝')}${x.name}${t('（')}${t(k).replace('{n}', k === '已實施 {n} 天' ? x.days : x.ago)}${t('）')}`;
            return (a.length ? `${t('【鎮上現行的規定（都是表決通過的；你真心覺得哪一條不該留，可以提案廢除，全鎮再投一次票）】')}${a.map(x => row(x, '已實施 {n} 天')).join(t('、'))}\n` : '')
                + (b.length ? `${t('【被表決廢除的規定（你真心覺得哪一條該回來，可以提案恢復，全鎮再投一次票）】')}${b.map(x => row(x, '已廢除 {n} 天')).join(t('、'))}\n` : '')
                + `${t('要廢除或恢復規定時，effects 只放這一個：')}{"type":"repeal","law":"${t('規定代碼')}"} ${t('或')} {"type":"restore","law":"${t('規定代碼')}"}\n`;
        } catch (e) { return ''; }
    }
    function fromAI(w, a, j) {
        try {
            const e = (Array.isArray(j?.effects) ? j.effects : []).find(x => x && typeof x === 'object' && ['repeal', 'restore'].includes(String(x.type || '').toLowerCase())); if (!e || busy(w)) return null;
            const id = String(e.law || '').trim(); const kind = String(e.type).toLowerCase() === 'restore' ? 'law_restore' : 'law_repeal'; const v = view(w);
            const ok = kind === 'law_repeal' ? v.live.some(x => x.id === id && x.wait <= 0) : v.done.some(x => x.id === id && x.wait <= 0); if (!ok) return null;
            return propose(w, id, a, kind);
        } catch (err) { console.warn('[Repeal] fromAI', err); return null; }
    }
    return { S, LAWS, MIN, RETRY, GAP, QUIET, daily, vote, enact, propose, support, since, quiet, view, law, promptBlock, fromAI, goneList };
})();

// ---------- 接上其他系統 ----------
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { law_repeal: { icon: '🗳️', label: '廢除規定' }, law_restore: { icon: '🗳️', label: '恢復規定' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { trad_keep: '習慣了這條規矩', trad_drop: '覺得這條規矩不合時宜', trad_friend: '跟立這條規矩的人交情好', trad_foe: '跟立這條規矩的人處不來' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { REPEAL.daily(w); } catch (e) { console.warn('[Repeal] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'law_repeal' || p.kind === 'law_restore') { const r = REPEAL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
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
