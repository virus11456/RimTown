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
        // 下面三條本來就各有自己的「立／解」提案（看事故、看信仰），規則版照舊；放進表裡是讓智能體也能自己提
        gene_ban: { icon: '🚫', name: '基因編輯禁令', cat: 'culture', own: true, ok: () => typeof MYTH !== 'undefined' && typeof MYTHSOC !== 'undefined',
            on: (w) => !!w.myth?.ban, since: () => null, off: (w) => { MYTHSOC.unban(w); },
            vote: (w, a) => MYTH.vote(w, { kind: 'gene_ban' }, a), lead: () => 0,
            why: '有人說禁令只是把人逼去更危險的地下診所。', after: '廢除以後，基因編輯改回由基因實驗室管理。',
            set: (w) => MYTH.ban(w), back: '有人擔心基因編輯放開以後，鎮上的人會越分越開。' },
        tech_safety: { icon: '☢️', name: '核安法', cat: 'economy', own: true, ok: () => typeof TECH !== 'undefined' && !!TECH.unsetLaw,
            on: (w) => !!w.tech?.law, since: (w) => w.tech?.law, off: (w) => { TECH.unsetLaw(w); },
            vote: (w, a) => TECH.voteRule(w, { kind: 'tech_safety' }, a), lead: () => 0,
            why: '工廠的人說，核電廠三天兩頭停機檢查，事情都做不完。', after: '廢除以後，核電廠不必定期停機，出大事的機會也回到原本那麼高。',
            set: (w) => TECH.setLaw(w), back: '有人擔心核電廠少了定期檢查，遲早出大事。' },
        faith_tax: { icon: '⛪', name: '宗教捐獻稅', cat: 'economy', own: true, ok: () => typeof FAITH !== 'undefined' && !!FAITH.setTax,
            on: (w) => !!w.faith?.tax, since: (w) => w.faith?.taxDay ?? null, off: (w) => { FAITH.setTax(w, false); },
            vote: (w, a) => FAITH.taxVote(w, { kind: 'faith_tax' }, a), lead: () => 0,
            why: '信徒說，奉獻給神的錢不該被抽稅。', after: '廢除以後，宗教捐獻不再抽稅。',
            set: (w) => FAITH.setTax(w, true), back: '有人覺得教團收了那麼多捐獻，該繳一份給公庫。' },
        tech_nonuke: { icon: '🌿', name: '廢核', cat: 'nature', ok: () => typeof TECH !== 'undefined' && !!TECH.abandon,
            on: (w) => !!w.tech?.noNuke, since: (w) => w.tech?.noNuke, off: (w) => { w.tech.noNuke = 0; },
            vote: (w, a) => TECH.voteRule(w, { kind: 'tech_abandon' }, a), lead: (w, a) => (a.job?.key === 'researcher' ? 2 : 0) + (has(a, 'ambitious') ? 1 : 0),
            why: '有人說沒有核電以後，工廠和研究都慢了下來。', after: '廢除以後，鎮上可以再提案蓋核電廠。',
            set: (w) => { w.tech.noNuke = 0; return TECH.abandon(w); }, back: '有人還是不放心鎮上再有核電廠。' },
        minwage: { icon: '💰', name: '最低工資', cat: 'welfare', ok: () => typeof WALLET !== 'undefined',
            on: (w) => (w.wallet?.minWage || 0) > 0, since: (w) => w.wallet?.minWageDay ?? null, off: (w) => { w.wallet.minWage = 0; w.wallet.minWageDay = null; },
            vote: (w, a) => viaKind(w, a, 'minwage'), lead: (w, a) => { try { return (typeof MARKET !== 'undefined' && MARKET.ownedBy(w, a.agentId).length ? 3 : 0) + (has(a, 'greedy') ? 1 : 0); } catch (e) { return 0; } },
            why: '東家們說，工資有了下限以後，請不起那麼多人。', after: '廢除以後，工資照市價走，沒有下限。',
            set: (w) => { w.wallet.minWage = Math.round(WALLET.FLOOR * (typeof INFL !== 'undefined' ? INFL.p(w) : 1) * 100) / 100; w.wallet.minWageDay = day(w); return t('最低工資恢復了'); }, back: '做工的人說，沒了下限，做滿一天也吃不飽。' },
    };

    function viaKind(w, a, kind) {
        const P = w.proposals; if (!P?._ruleVote) return null;
        const fake = { id: '_x', kind, votes: {}, why: {}, proposerId: '', proposerName: '', category: 'welfare', cost: {}, tp: {}, dp: {}, effects: {} };
        P._ruleVote(w, fake, a); const v = fake.votes[a.agentId]; return v ? { v, why: fake.why[a.agentId] || 'gut' } : null;
    }
    function S(w) {
        if (!w.repeal || typeof w.repeal !== 'object') w.repeal = { last: {}, seen: {}, done: [], lastAny: -99 };
        const R = w.repeal; R.last = R.last || {}; R.lastBack = R.lastBack || {}; R.seen = R.seen || {}; R.done = R.done || []; R.shelf = R.shelf || {}; if (!Number.isFinite(R.lastAny)) R.lastAny = -99; return R;
    }
    // ---- 不在表裡、隨提案產生的規定（代碼＝種類:編號）----
    //   trad:  村民提案立下的規矩與傳統        mark: 村民提案立的地標（廢除＝拆掉）      decree: 還在生效的政令（提前取消；本來就會到期，所以沒有「恢復」）
    const hsh = (x) => 't' + Array.from(String(x || '')).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 99991, 7);
    const KEEP = { trad: { list: (w) => w.proposals?.traditions, name: (x) => x.text, icon: () => '📜', max: 6, why: '有人覺得這條規矩已經不合時宜。', after: '廢除以後，大家不必再照這條規矩做。', back: '有人懷念這條老規矩。', ok: '老規矩恢復了' },
        mark: { list: (w) => w.proposals?.landmarks, name: (x) => (typeof x.name === 'string' ? x.name : ''), icon: (x) => x.icon || '🗿', max: 6, why: '有人覺得這個地標已經沒有意義，還佔地方。', after: '廢除以後，這個地標會拆掉。', back: '有人懷念那個地標。', ok: '地標重新立起來了' } };
    const kkey = (k, x) => k + ':' + (x.id || hsh(KEEP[k].name(x)));
    const tkey = (x) => kkey('trad', x);
    const voted = (x) => !!x && !x.fad && /^L\d+/.test(String(x.id || '')); // 編號是提案編號（L001…）才是表決出來的；流行變成的習俗、神蹟、公庫收藏的工藝品、紀念雕像不算
    const kept = (w, k) => { const L = KEEP[k].list(w); return Array.isArray(L) ? L.filter(voted) : []; };
    const trads = (w) => kept(w, 'trad');
    const decrees = (w) => { const d = day(w); return (Array.isArray(w.council?.activeDecrees) ? w.council.activeDecrees : []).filter(x => x && x.id && x.title && (x.expiresDay ?? d) >= d); };
    // 這條規矩留不留：提的人自己、跟他要好的人想留；跟他處不來的想拿掉；其他人看個性，多數人懶得改（維持現狀佔一點便宜）
    function tradVote(w, a, x) {
        const by = x.by ? Object.values(w.agents || {}).find(o => o.name === x.by) : null; const mine = by && by.agentId === a.agentId;
        const r = by && !mine ? (a.relationships?.relationships?.[by.agentId]?.affinity || 0) : 0;
        const s = (mine ? 4 : 0) + r / 30 + (has(a, 'stoic') || has(a, 'perfectionist') ? 0.6 : 0) - (has(a, 'creative') || has(a, 'lazy') ? 0.6 : 0) + 0.3 + (Math.random() - 0.5) * 2;
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (mine || r >= 30 ? 'trad_friend' : 'trad_keep') : (r <= -30 ? 'trad_foe' : 'trad_drop') };
    }
    function dyn(w, id) {
        const R = S(w); const k = String(id || '').split(':')[0];
        if (KEEP[k]) {
            const K = KEEP[k]; const find = () => kept(w, k).find(o => kkey(k, o) === id) || null; const src = find() || R.shelf[id]; if (!src) return null;
            return { icon: K.icon(src), name: K.name(src), free: true, cat: 'culture', ok: () => true, on: () => !!find(), since: () => (find() || {}).day ?? null,
                off: (w) => { const L = K.list(w); const i = L.findIndex(o => voted(o) && kkey(k, o) === id); if (i >= 0) { R.shelf[id] = L[i]; L.splice(i, 1); } const ks = Object.keys(R.shelf); if (ks.length > 10) delete R.shelf[ks[0]]; },
                set: (w) => { const o = R.shelf[id]; if (!o) return ''; const P = w.proposals; const L = K.list(w) || (k === 'trad' ? (P.traditions = []) : (P.landmarks = [])); L.push(Object.assign({}, o, { day: day(w) })); if (L.length > K.max) L.splice(0, L.length - K.max); delete R.shelf[id]; return t(K.ok); },
                vote: (w, a) => tradVote(w, a, src), lead: () => 0, why: K.why, after: K.after, back: K.back };
        }
        if (k === 'decree') {
            const key = id.slice(7); const find = () => decrees(w).find(o => String(o.id) === key) || null; const src = find(); if (!src) return null;
            return { icon: '📜', name: src.title, free: true, short: true, cat: 'economy', ok: () => true, on: () => !!find(), since: () => null,
                off: (w) => { const C = w.council; C.activeDecrees = (C.activeDecrees || []).filter(o => String(o.id) !== key); try { C._aggregateDecrees?.(w); } catch (e) {} },
                vote: (w, a) => { const s = 0.4 + (has(a, 'optimist') ? 0.4 : 0) - (has(a, 'pessimist') ? 0.4 : 0) + (Math.random() - 0.5) * 2; return { v: s > 0 ? 'for' : 'against', why: s > 0 ? 'trad_keep' : 'decree_drop' }; }, lead: () => 0,
                why: '有人覺得這道政令弊大於利。', after: '廢除以後，這道政令的效果馬上停止。' };
        }
        return null;
    }
    const law = (w, id) => LAWS[id] || dyn(w, id);
    const nameOf = (L) => L.name;
    const lawOk = (w, id) => { const L = law(w, id); try { return !!L && L.ok() && !!L.on(w); } catch (e) { return false; } };
    const liveIds = (w) => [...Object.keys(LAWS), ...kept(w, 'trad').map(x => kkey('trad', x)), ...kept(w, 'mark').map(x => kkey('mark', x)), ...decrees(w).map(x => 'decree:' + x.id)].filter(id => lawOk(w, id));
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
        try { for (const x of punished(w)) { if (!x.ex || !pardonOk(w, x)) continue; const A = adults(w).filter(a => a.agentId !== x.a.agentId); const pro = A.filter(a => pardonVote(w, { refKey: x.a.agentId }, a).v === 'for'); if (A.length && pro.length / A.length >= 0.3 && Math.random() < 0.25) { const who = pro.sort((p, q) => (q.relationships?.relationships?.[x.a.agentId]?.affinity || 0) - (p.relationships?.relationships?.[x.a.agentId]?.affinity || 0))[0]; if (pardonPropose(w, who, x.a)) break; } } } catch (e) { console.warn('[Repeal] pardon', e); }
        const gone = goneList(w); if (!live.length && !gone.length) return;
        if (busy(w) || d - R.lastAny < GAP) return;
        const jobs = [...live.map(id => ({ id, kind: 'law_repeal', wait: waitRepeal(w, id) })), ...gone.map(x => ({ id: x.id, kind: 'law_restore', wait: waitBack(w, x) }))].filter(j => j.wait <= 0 && !law(w, j.id)?.own).sort(() => Math.random() - 0.5);
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
        const d = day(w); const R = S(w); const ai = !!w.fullAgentMode; // 開了完整智能體：村民隨時可以提，只看 5 天內有沒有提過
        const aiWait = (id) => anyOpen(w, id) ? 0 : Math.max(0, AIGAP - (d - Math.max(R.last[id] ?? -999, R.lastBack[id] ?? -999)));
        const live = liveIds(w).map(id => { const L = law(w, id); return { id, icon: L.icon, name: t(nameOf(L)), free: !!L.free, short: !!L.short, days: Math.max(0, d - since(w, id)), wait: ai ? aiWait(id) : waitRepeal(w, id), open: openFor(w, id, 'law_repeal') }; }).filter(x => ai || !x.short); // 政令 20 天就到期，規則版等不到 60 天，不列
        const done = goneList(w).map(x => { const L = law(w, x.id); return { id: x.id, icon: L?.icon || '🗳️', name: t(L ? nameOf(L) : (x.name || x.id)), free: !!L?.free, ago: d - x.d, days: x.n, wait: ai ? aiWait(x.id) : waitBack(w, x), open: openFor(w, x.id, 'law_restore') }; });
        let recall = null; try { const I = recallInfo(w, null); if (I.L) recall = { name: I.L.name, title: titleOf(w), ok: I.ok, why: I.ok ? '' : I.why, signers: I.signers, need: I.need }; } catch (e) {}
        return { live, done, recall, ai };
    }
    // ---- 完整智能體：最大的權限 ----
    // 規則版的 60／90 天是「沒有人在想」時的節奏；智能體自己會想，所以不受那些天數限制：任何一條現行規定都可以提廢除、
    // 任何一條被廢除的規定都可以提恢復，可以同時有好幾件在表決。只擋兩件事（不然每天都是同一案）：同一條規定正在表決、同一條規定 10 天內才剛提過。
    const AIGAP = 5; // v10.5.0 放寬：同一條規定、稅率、關稅，智能體 5 天內不重提（以前 10 天）
    const anyOpen = (w, id) => (w.proposals?.items || []).some(p => KINDS.includes(p.kind) && p.refKey === id && ['open', 'shelved', 'approved'].includes(p.status));
    const aiOk = (w, id) => { const R = S(w); return !anyOpen(w, id) && day(w) - Math.max(R.last[id] ?? -999, R.lastBack[id] ?? -999) >= AIGAP; };
    // 罷免首長：也是一個提案，可是門檻高，不能想罷免就罷免。平常以正常選舉為主（一任兩年＝120 天）
    //   什麼時候能提：上任滿 30 天、離下次選舉還有 30 天以上、上一次罷免案過了 45 天（v10.5.0 以前是一個任期只能提一次）
    //   成案：全鎮至少四分之一的人願意連署（真的對他不滿的人；至少 3 人）
    //   通過：贊成票要有六成，而且贊成的人數超過全鎮四成（不能靠大家沒來投票混過去）。全鎮投票決定，不送議會，首長自己不能裁決
    //   沒過：45 天內不能再提；提的人跟首長的關係變差
    const RC = { settle: 30, tail: 30, sign: 0.25, yes: 0.6, turnout: 0.4, minSign: 3, again: 45 };
    const holder = (w) => { try { return w.election?._officeHolder?.(w) || null; } catch (e) { return null; } };
    const titleOf = (w) => { try { return (typeof TIERS !== 'undefined') ? TIERS.leaderTitle(w) : t('鎮長'); } catch (e) { return t('鎮長'); } };
    const nextElection = (w) => { if (typeof ELECT !== 'undefined') return ELECT.nextMayorDay(w); const d = day(w); let c = Math.floor((d - 1) / 60) * 60 + 31; if (c <= d) c += 60; return c; }; // 單數年秋季第 1 天
    // <0＝不滿。醜聞只會讓人更容易不滿，不會讓不認識他的人直接變成反對者：最多扣 0.45（三樁以上算滿）
    // v10.4.1 原本每 1 分醜聞扣 0.6，首長被揭發一次就是 2 分，跟他沒交情的人全被算成願意連署（115 人的鎮連署 100 人，實際討厭他的只有 21 人）
    const dislike = (w, a, L) => (a.relationships?.relationships?.[L.agentId]?.affinity || 0) / 25 - Math.min(3, w.power?.scandal?.[L.agentId] || 0) * 0.15 + 0.3;
    const signers = (w, L) => adults(w).filter(a => a.agentId !== L.agentId && dislike(w, a, L) < -0.5); // 連署要真的不滿：沒醜聞時好感低於 -20，有一樁醜聞（2 分）低於 -12.5，醜聞纏身（3 分以上）低於 -8.75
    function recallInfo(w, a) {
        const E = w.election; const L = holder(w); const R = S(w); const d = day(w); if (!L || !E) return { ok: false, why: 'none' };
        const term = E.lastElectionDay || 0; const sg = signers(w, L); const need = Math.max(RC.minSign, Math.ceil((adults(w).length - 1) * RC.sign));
        const base = { L, term, signers: sg.length, need, inOffice: d - term, toVote: nextElection(w) - d };
        const no = (why) => Object.assign(base, { ok: false, why });
        if (E.active) return no('electing'); if (a && L.agentId === a.agentId) return no('self');
        if ((w.proposals?.items || []).some(p => p.kind === 'recall' && ['open', 'shelved', 'approved'].includes(p.status))) return no('open');
        if (d - (R.recallDay ?? -999) < RC.again) return no('once'); // v10.5.0 放寬：沒過的 45 天後可以再提（一任 120 天裡最多兩次）；連署、六成贊成、四成門檻都不變
        if (d - term < RC.settle) return no('settle'); if (nextElection(w) - d < RC.tail) return no('tail');
        if (sg.length < need) return no('sign');
        return Object.assign(base, { ok: true });
    }
    const recallOk = (w, a) => { const I = recallInfo(w, a); return I.ok ? I.L : null; };
    function recallPropose(w, a) {
        const I = recallInfo(w, a); if (!I.ok || typeof TECH === 'undefined') return null; const L = I.L;
        const p = TECH.propose(w, 'recall', L.agentId, a, '罷免{m}', '{who}說{m}不適合再當{o}，提議罷免、提前改選。已經有 {n} 個人連署。這一案由全鎮投票決定：要六成贊成、而且贊成的人超過全鎮四成才算通過；{m}自己不能裁決。', { m: L.name, o: titleOf(w), n: I.signers }, 'freedom', { m: L.name });
        if (p) { const R = S(w); R.recallDay = day(w); R.recallTerm = I.term; try { L.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '{who}帶頭連署要罷免我。', { who: a.name }, 8, [a.name]); } catch (e) {} }
        return p;
    }
    // 沒有 AI 投票時的立場：跟首長的交情、他身上的醜聞
    function recallVote(w, p, a) {
        const id = p.refKey; if (a.agentId === id) return { v: 'against', why: 'recall_self' };
        const L = w.agents[id]; const sc = w.power?.scandal?.[id] || 0; const s = (L ? dislike(w, a, L) : 0.3) + (Math.random() - 0.5) * 1.5;
        return { v: s < 0 ? 'for' : 'against', why: s < 0 ? (sc >= 2 ? 'recall_scandal' : 'recall_bad') : 'recall_fine' };
    }
    // 開票：六成贊成＋贊成的人超過全鎮四成
    function recallTally(w, P, p) { const f = P._count(p, 'for'), ag = P._count(p, 'against'); const n = adults(w).length; return { f, ag, n, pass: f + ag > 0 && f >= (f + ag) * RC.yes && f >= n * RC.turnout }; }
    function recallFail(w, p) {
        const L = w.agents?.[p.refKey], a = w.agents?.[p.proposerId]; p.result = '贊成沒過門檻（要六成贊成，而且超過全鎮四成）';
        try { if (L && a) { a.relationships?.getOrCreate?.(L.agentId, L.name)?.modifyAffinity?.(-15); L.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(-20); L.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '{who}想罷免我，沒有成功。這筆我記住了。', { who: a.name }, 8, [a.name]); a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '罷免{m}沒過，45 天內不能再提了。', { m: L.name }, 7, [L.name]); } } catch (e) {}
        try { w.logMessageT?.('event', '📢 罷免{m}沒有通過，45 天內不能再提。', { m: L?.name || '' }, L?.name || ''); } catch (e) {}
    }
    function recallEnact(w, p) {
        const E = w.election; const L = w.agents?.[p.refKey]; const d = day(w); if (!L || L.isDead || L.job?.key !== 'mayor' || !E || E.active) return '';
        try { if (typeof POWER !== 'undefined') { const P = POWER.S(w); P.recallDay = d; P.stats.recalls = (P.stats.recalls || 0) + 1; P.recalled = L.agentId; P.recalledDay = d; } } catch (e) {} // 被罷免的人這次不能再選
        try { w.logMessageT?.('event', '📢 全鎮表決通過罷免{m}，提前改選！', { m: L.name }, L.name); } catch (e) {}
        try { L.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '全鎮投票罷免了我，要提前改選了。', {}, 9, []); L.moodModifier = (L.moodModifier || 0) - 10; } catch (e) {}
        try { if (typeof TIERS !== 'undefined') TIERS.hint(w, L.agentId, 'recall'); } catch (e) {} // v11.10.1 從政履歷記下是被罷免的
        try { E.triggerElection(w); } catch (e) { console.warn('[Repeal] recall', e); }
        if (!E.active && L.job?.key === 'mayor') { try { w.logMessageT?.('event', '📢 {m}被罷免下台，等待補選。', { m: L.name }, L.name); } catch (e) {} // v11.11.0 跟選輸、被迫下台同一套：先照慣例改當商人，再由本人決定之後做什麼（sim-decide-home.js）
            if (typeof HOME !== 'undefined' && HOME.outOfOffice) { try { HOME.outOfOffice(w, L, 'recall'); } catch (e) { console.warn('[Repeal] after office', e); } } else L.job = (typeof JOB_DEFINITIONS !== 'undefined' && JOB_DEFINITIONS.trader && typeof Job !== 'undefined') ? new Job('trader') : null; }
        news(w, `📢 ${t('全鎮表決罷免了')}${t(L.name)}`, 9);
        return t('罷免通過，提前改選');
    }
    // ---- 赦免：判決也是表決出來的，可以再表決翻案 ----
    // 還沒執行完的才撤得回來：限期離開的驅逐令（判決或神裔驅逐）、剩下的勞役、還沒繳清的罰款。已經繳的錢、已經變賣的家當、已經離開的人回不來
    const fam = (w, a) => { try { return (typeof MONEY !== 'undefined' && MONEY.familyOf) ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    function punished(w) {
        const out = []; const d = day(w);
        for (const a of Object.values(w.agents || {})) { if (!a || a.isPlayer || a.isDead) continue; const ex = w.exile?.pending?.[a.agentId] || null; let lab = false, owe = 0;
            try { if (typeof MONEY !== 'undefined') { lab = !!MONEY.inLabor(w, a); owe = MONEY.owedOf(w, a) || 0; } } catch (e) {}
            if (ex || lab || owe > 0.01) out.push({ a, ex, lab, owe, what: ex ? t('被逐出小鎮，還有 {n} 天就得走').replace('{n}', Math.max(0, (ex.until ?? d) - d)) : lab ? t('正在服公共勞役') : t('還欠公庫 {n} 銀幣罰款').replace('{n}', Math.ceil(owe)) }); }
        return out;
    }
    const pardonOpen = (w, id) => (w.proposals?.items || []).some(p => p.kind === 'pardon' && p.refKey === id && ['open', 'shelved', 'approved'].includes(p.status));
    const pardonOk = (w, x) => !pardonOpen(w, x.a.agentId) && day(w) - (S(w).pardon?.[x.a.agentId] ?? -999) >= 20;
    function pardonPropose(w, who, target) {
        const x = punished(w).find(o => o.a.agentId === target?.agentId); if (!x || !pardonOk(w, x) || typeof TECH === 'undefined') return null;
        const p = TECH.propose(w, 'pardon', x.a.agentId, who, '赦免{m}', '{who}說{m}受的處置太重了（{what}），提議赦免：撤銷還沒執行完的驅逐、勞役和罰款欠款。已經繳的、已經變賣的不退。', { m: x.a.name, what: x.what }, 'freedom', { m: x.a.name });
        if (p) { const R = S(w); R.pardon = R.pardon || {}; R.pardon[x.a.agentId] = day(w); }
        return p;
    }
    function pardonVote(w, p, a) {
        const id = p.refKey; const c = w.agents[id]; if (!c) return { v: 'against', why: 'gut' }; if (a.agentId === id) return { v: 'for', why: 'pardon_self' };
        const kin = fam(w, c).some(o => o.agentId === a.agentId); const r = a.relationships?.relationships?.[id]?.affinity || 0;
        const s = (kin ? 3 : 0) + r / 25 + (has(a, 'kind') ? 0.8 : 0) - (a.job?.key === 'guard' ? 0.8 : 0) - 0.4 + (Math.random() - 0.5) * 1.6;
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (kin ? 'pardon_kin' : r >= 30 ? 'pardon_friend' : 'pardon_pity') : 'pardon_no' };
    }
    function pardonEnact(w, p) {
        const c = w.agents?.[p.refKey]; if (!c || c.isDead) return ''; const id = c.agentId; const did = [];
        try { if (w.exile?.pending?.[id]) { delete w.exile.pending[id]; did.push(t('撤銷驅逐')); } } catch (e) {}
        try { const D = (typeof DARK !== 'undefined') ? DARK.S(w) : w.dark; if (D?.labor?.some(x => x.id === id)) { D.labor = D.labor.filter(x => x.id !== id); did.push(t('免除勞役')); } } catch (e) {}
        try { if (w.money?.fines?.[id]) { delete w.money.fines[id]; did.push(t('欠的罰款一筆勾銷')); } } catch (e) {}
        if (!did.length) return '';
        c.moodModifier = (c.moodModifier || 0) + 12; try { c.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', '全鎮投票赦免了我。', {}, 9, []); } catch (e) {}
        log(w, '🕊️ 小鎮表決赦免了{m}：{x}。', { m: c.name, x: did.join(t('、')) });
        news(w, `🕊️ ${t('小鎮表決赦免了')}${t(c.name)}`, 7);
        return t('赦免了{m}').replace('{m}', t(c.name));
    }
    // ---- 稅率、關稅：本來只有規則會提（公庫見底、大家活不下去）；智能體覺得該調就能提 ----
    function ratePropose(w, a, e) {
        const P = w.proposals; if (!P?._createWith) return null; const d = day(w); const R = S(w); const busyK = (k) => (P.items || []).some(p => p.kind === k && ['open', 'shelved', 'approved'].includes(p.status));
        const pct = Math.round(Number(e.rate)); if (!Number.isFinite(pct)) return null;
        if (e.type === 'tax') {
            if (!w.wallet || typeof CIVIC === 'undefined' || busyK('tax') || d - (R.taxDay ?? -999) < AIGAP) return null; const tax = w.wallet.tax || 0; const nt = Math.max(0.02, Math.min(0.3, pct / 100)); if (Math.abs(nt - tax) < 0.005) return null; const dir = nt > tax ? 'up' : 'down';
            const p = P._createWith(w, d, { kind: 'tax', key: 'tax:' + d, jobs: [], make: () => ({ kind: 'tax', key: 'tax:' + d, newTax: nt, dir, tk: dir === 'up' ? '加稅到 {n}%' : '減稅到 {n}%', tp: { n: Math.round(nt * 100) }, dk: '{who}提議把稅從 {a}% 調到 {n}%。', dp: { who: a.name, a: Math.round(tax * 100), n: Math.round(nt * 100) }, cost: {}, category: 'economy', jobBias: ['mayor', 'trader'] }) }, a);
            if (p) R.taxDay = d; return p;
        }
        if (typeof TRADE === 'undefined' || !TRADE.setTariff || busyK('tariff') || d - (R.tariffDay ?? -999) < AIGAP) return null; let old = 0; try { old = TRADE.S(w).tariff || 0; } catch (err) { return null; }
        const nr = Math.max(0, Math.min(0.5, pct / 100)); if (Math.abs(nr - old) < 0.005) return null;
        const p = P._createWith(w, d, { kind: 'tariff', key: 'tariff:' + d, jobs: [], make: () => ({ kind: 'tariff', key: 'tariff:' + d, newRate: nr, tk: '進口關稅調成 {n}%', tp: { n: Math.round(nr * 100) }, dk: '{who}提議把進口關稅從 {a}% 調成 {n}%。', dp: { who: a.name, a: Math.round(old * 100), n: Math.round(nr * 100) }, cost: {}, category: 'economy' }) }, a);
        if (p) R.tariffDay = d; return p;
    }
    const viewAll = (w) => { const f = w.fullAgentMode; w.fullAgentMode = true; try { return view(w); } finally { w.fullAgentMode = f; } };
    const nm = (x) => (typeof I18N !== 'undefined' && I18N.localizeNames && typeof LLM_LANG !== 'undefined' && LLM_LANG.get() === 'en') ? I18N.localizeNames(x, true) : x;
    // 給智能體看的分兩段：ctx＝鎮上現在的狀況（放在鎮況後面）；fx＝可以用的效果（要放進「提案的效果只能用下面幾種」那張清單裡，不然模型會照字面不用）
    function promptParts(w, who) {
        try {
            const v = viewAll(w); const R = S(w); const d = day(w); const cap = (L, pre, n) => { let c = 0; return L.filter(x => !x.id.startsWith(pre) || c++ < n); };
            const a = cap(cap(cap(v.live.filter(x => aiOk(w, x.id)), 'trad:', 3), 'mark:', 3), 'decree:', 3), b = v.done.filter(x => aiOk(w, x.id)).slice(0, 6); const I = recallInfo(w, who);
            const row = (x, k) => `${x.id}${t('＝')}${x.name}${t('（')}${t(k).replace('{n}', k === '已實施 {n} 天' ? x.days : x.ago)}${t('）')}`;
            const pun = punished(w).filter(x => pardonOk(w, x)).slice(0, 5); let tax = null, tariff = null;
            try { if (w.wallet && typeof CIVIC !== 'undefined' && d - (R.taxDay ?? -999) >= AIGAP && !(w.proposals?.items || []).some(p => p.kind === 'tax' && ['open', 'shelved', 'approved'].includes(p.status))) tax = Math.round((w.wallet.tax || 0) * 100); } catch (e) {}
            try { if (typeof TRADE !== 'undefined' && TRADE.setTariff && w.wallet && d - (R.tariffDay ?? -999) >= AIGAP && !(w.proposals?.items || []).some(p => p.kind === 'tariff' && ['open', 'shelved', 'approved'].includes(p.status))) tariff = Math.round((TRADE.S(w).tariff || 0) * 100); } catch (e) {}
            let ctx = '', fx = '';
            // 跟這個人切身有關的（照他自己的處境與交情算；連問三次立場都一樣才算「一直這麼想」）。真模型實測：只列清單時沒有人會去用，連自己看不起病的人都另外發明一個基金
            const sure = (fn) => { for (let i = 0; i < 3; i++) { try { if (!fn()) return false; } catch (e) { return false; } } return true; }; const mine = [];
            if (who) {
                for (const x of pun) { const kin = fam(w, x.a).some(o => o.agentId === who.agentId); const r = who.relationships?.relationships?.[x.a.agentId]?.affinity || 0; if (x.a.agentId === who.agentId) mine.push(t('你自己正在受處置（{what}）').replace('{what}', x.what)); else if (kin || r >= 50) mine.push(t('{m}是你親近的人，他{what}').replace('{m}', nm(x.a.name)).replace('{what}', x.what)); }
                for (const x of b) if (sure(() => vote(w, { refKey: x.id, kind: 'law_restore' }, who).v === 'for')) mine.push(t('「{law}」被廢除以後，你覺得日子變差了').replace('{law}', x.name));
                for (const x of a) if (!x.id.startsWith('decree:') && sure(() => vote(w, { refKey: x.id, kind: 'law_repeal' }, who).v === 'for')) mine.push(t('你一直覺得「{law}」不該留').replace('{law}', x.name));
                if (I.ok && dislike(w, who, I.L) < -1) mine.push(t('你對{m}很不滿').replace('{m}', nm(I.L.name)));
            }
            if (a.length) ctx += `${t('【鎮上現行的規定（都是表決通過的）】')}${a.map(x => row(x, '已實施 {n} 天')).join(t('、'))}\n`;
            if (b.length) ctx += `${t('【被表決廢除的規定】')}${b.map(x => row(x, '已廢除 {n} 天')).join(t('、'))}\n`;
            if (pun.length) ctx += `${t('【正在受處置的人】')}${pun.map(x => `${nm(x.a.name)}${t('（')}${x.what}${t('）')}`).join(t('、'))}\n`;
            if (tax != null || tariff != null) ctx += `${t('【稅與關稅】')}${[tax != null ? t('稅率現在 {n}%').replace('{n}', tax) : '', tariff != null ? t('進口關稅現在 {n}%').replace('{n}', tariff) : ''].filter(Boolean).join(t('、'))}\n`;
            if (I.ok) ctx += `${t('【現任{o}】').replace('{o}', titleOf(w))}${nm(I.L.name)}${t('（現在有 {n} 個人對他不滿，夠連署罷免）').replace('{n}', I.signers)}\n`;
            if (mine.length) ctx += `${t('【跟你切身有關的】')}${mine.slice(0, 3).join(t('；'))}\n`;
            if (a.length) fx += `{"type":"repeal","law":"${t('規定代碼')}"}${t('（廢除一條現行規定）')} `;
            if (b.length) fx += `{"type":"restore","law":"${t('規定代碼')}"}${t('（恢復一條被廢除的規定）')} `;
            if (pun.length) fx += `{"type":"pardon","name":"${t('名字')}"}${t('（赦免正在受處置的人，撤銷還沒執行完的部分）')} `;
            if (tax != null) fx += `{"type":"tax","rate":2~30}${t('（把稅率調成這個百分比）')} `;
            if (tariff != null) fx += `{"type":"tariff","rate":0~50}${t('（把進口關稅調成這個百分比）')} `;
            if (I.ok) fx += `{"type":"recall"}${t('（罷免現任{o}。這是大事：全鎮投票要六成贊成、而且贊成的人超過全鎮四成才通過；沒過的話 45 天內不能再提，他也會記住是誰提的）').replace('{o}', titleOf(w))}`;
            if (fx) fx = `${t('鎮上已經表決過的事，也可以再表決改掉。你真心覺得該改才提；用了下面任何一種，effects 就只放它一個：')}\n${fx.trim()}\n`;
            return { ctx, fx };
        } catch (e) { return { ctx: '', fx: '' }; }
    }
    const promptBlock = (w, who) => { const p = promptParts(w, who); return p.ctx + p.fx; };
    function fromAI(w, a, j) {
        try {
            const fx = (Array.isArray(j?.effects) ? j.effects : []).filter(x => x && typeof x === 'object').map(x => Object.assign({}, x, { type: String(x.type || '').toLowerCase() }));
            if (fx.some(x => x.type === 'recall')) return recallPropose(w, a);
            const pd = fx.find(x => x.type === 'pardon'); if (pd) { const n = String(pd.name || '').trim(); const L = (x) => (typeof I18N !== 'undefined' && I18N.delocalizeNames) ? I18N.delocalizeNames(x) : x; const tg = Object.values(w.agents || {}).find(o => !o.isDead && (o.name === n || o.name === L(n) || nm(o.name) === n)); return tg ? pardonPropose(w, a, tg) : null; }
            const rt = fx.find(x => x.type === 'tax' || x.type === 'tariff'); if (rt) return ratePropose(w, a, rt);
            const e = fx.find(x => ['repeal', 'restore'].includes(x.type)); if (!e) return null;
            const id = String(e.law || '').trim(); const kind = e.type === 'restore' ? 'law_restore' : 'law_repeal'; const v = viewAll(w);
            const ok = (kind === 'law_repeal' ? v.live : v.done).some(x => x.id === id) && aiOk(w, id); if (!ok) return null;
            return propose(w, id, a, kind);
        } catch (err) { console.warn('[Repeal] fromAI', err); return null; }
    }
    return { S, LAWS, MIN, RETRY, GAP, QUIET, AIGAP, daily, vote, enact, propose, support, since, quiet, view, law, promptBlock, promptParts, fromAI, goneList, RC, recallInfo, recallOk, recallPropose, recallVote, recallEnact, recallTally, recallFail, punished, pardonPropose, pardonVote, pardonEnact, ratePropose };
})();

// ---------- 接上其他系統 ----------
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { law_repeal: { icon: '🗳️', label: '廢除規定' }, law_restore: { icon: '🗳️', label: '恢復規定' }, recall: { icon: '📢', label: '罷免首長' }, pardon: { icon: '🕊️', label: '赦免' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { trad_keep: '習慣了這條規矩', trad_drop: '覺得這條規矩不合時宜', trad_friend: '跟立這條規矩的人交情好', trad_foe: '跟立這條規矩的人處不來', recall_self: '這是在罷免我自己', recall_scandal: '他身上的醜聞太多', recall_bad: '對他不滿', recall_fine: '覺得他做得還可以', decree_drop: '覺得這道政令弊大於利', pardon_self: '這是在替我自己求情', pardon_kin: '是自己家裡的人', pardon_friend: '跟他交情好', pardon_pity: '覺得罰得太重', pardon_no: '覺得他罪有應得' });
if (typeof VOTE_WHY !== 'undefined') { if (!VOTE_WHY.faith) VOTE_WHY.faith = '信仰不允許'; if (!VOTE_WHY.safety) VOTE_WHY.safety = '怕出事'; } // 基因編輯禁令／驅逐案的兩個理由代號以前沒有文字，一律顯示「憑直覺」
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype;
    const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); if (w.observerMode) { try { REPEAL.daily(w); } catch (e) { console.warn('[Repeal] daily', e); } } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'recall' || p.kind === 'pardon') { const r = p.kind === 'recall' ? REPEAL.recallVote(w, p, a) : REPEAL.pardonVote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; }
        if (p.kind === 'law_repeal' || p.kind === 'law_restore') { const r = REPEAL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
    // 罷免案由全鎮投票決定：不送議會、首長（他自己）也不能裁決
    const _mr = PS._mayorRule;
    PS._mayorRule = function (w, p, d, final, ...rest) { if (p.kind === 'recall') { if (p.status !== 'open' && p.status !== 'shelved') return; const T = REPEAL.recallTally(w, this, p); p.mayorName = ''; p.mayorWhy = ''; p.tally = { f: T.f, a: T.ag, n: T.n }; this._decide(w, p, T.pass ? 'approve' : 'reject', 'vote'); if (!T.pass) REPEAL.recallFail(w, p); return; } return _mr.call(this, w, p, d, final, ...rest); };
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
