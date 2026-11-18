// v6.67.0 城鎮治理補完:治安、稅率提案、地價房租、王都大事件、依等級吸引移民
// - 治安:手頭緊、不老實的人會偷有錢人的錢;衛兵越多越容易抓到,抓到就關進牢裡幾天、錢還回去;沒抓到就成了真相頁的祕密
//   窮人太多(三成以上)連續十天 → 出現貧民區,偷竊更常見、大家心情差
// - 稅率提案:公庫見底時有人提加稅、窮人太多時有人提減稅;村民依自己的荷包投票,通過就改稅率
// - 地價房租:地價跟著城鎮等級與繁榮;同住但不是一家人的房客每七天付房租給房東(屋裡最有錢的人)
// - 王都大事件:國王的壽宴(每年一次)、皇家婚禮(國王單身時迎娶貴族)
// - 移民:城鎮等級越高越吸引外地人
const CIVIC = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, type, k, p, who) => { try { w.logMessageT?.(type, k, p || {}, who || ''); } catch (e) {} };
    const W = () => typeof WALLET !== 'undefined';
    const cash = (w, a) => (W() && w.wallet ? WALLET.get(w, a) : 0);
    const tierLv = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const newsDay = (w) => w.clock.year * 60 + (['春季', '夏季', '秋季', '冬季'].indexOf(w.clock.season) * 15) + w.clock.day;
    function S(w) { if (!w.civic || typeof w.civic.jail !== 'object') w.civic = { jail: {}, slum: false, poorDays: 0, thefts: 0, caught: 0, rentDay: null, lastTax: -99, feastYear: null, lastDay: null }; return w.civic; }
    const jailed = (w, a) => !!(w.civic?.jail?.[a?.agentId] > day(w));
    // ---------- 治安 ----------
    function crime(w, C, d) {
        const all = npcs(w).filter(a => !jailed(w, a)); if (all.length < 4) return;
        const guards = all.filter(a => a.job?.key === 'guard').length;
        const thieves = all.filter(a => cash(w, a) < 5 && (has(a, 'lazy') || has(a, 'jealous') || has(a, 'abrasive') || (() => { try { return DARK.honesty(a) < 2.5; } catch (e) { return false; } })()));
        const p = (C.slum ? 0.12 : 0.05);
        for (const th of thieves) {
            if (Math.random() > p) continue;
            const vic = all.filter(a => a !== th && cash(w, a) >= 60).sort(() => Math.random() - 0.5)[0]; if (!vic) continue;
            const n = Math.min(Math.floor(cash(w, vic) * 0.2), 30); if (n < 5 || !WALLET.take(w, vic, n)) continue; WALLET.add(w, th, n); C.thefts++;
            (C.tlog || (C.tlog = [])).push(d); C.tlog = C.tlog.filter(x => d - x < 14); // v11.8.0 最近兩週的竊案（給抓到人的守衛看）
            const catchP = Math.min(0.85, 0.15 + guards * 0.2);
            if (Math.random() < catchP) {
                C.caught++;
                try { if (typeof HOME !== 'undefined' && HOME.stolen) HOME.stolen(w, th, vic, n); } catch (e) {} // v11.9.0 記下誰被偷過（偷竊罰則的提案由被偷過的人提）
                // v11.9.0 罰則可以由全鎮提案改：從輕（不關，罰錢給公庫；days 是 0）／照舊（關 3 天）／從重（關 5 天）（sim-decide-home.js）
                const law = (typeof HOME !== 'undefined' && HOME.theftLaw) ? HOME.theftLaw(w) : 'normal';
                const days = law === 'light' ? 0 : (law === 'harsh' ? 5 : 3) + ((C.tlog || []).length > 5 ? 2 : 0); // 「偷太多就多關兩天」看最近兩週的竊案；以前看的是開局以來的總數，開局沒多久之後每個小偷都多關兩天
                // v11.8.0 抓不抓得到照舊看天；抓到之後照不照規矩辦、放不放、收不收錢，由抓到人的那位守衛自己決定（sim-decide-order.js caught）
                if (typeof ORDER !== 'undefined' && ORDER.on(w) && ORDER.caught(w, { src: 'theft', th: th.agentId, vic: vic.agentId, n, days, d, c0: Math.round(cash(w, th) - n) })) continue;
                jailDo(w, C, th, vic, n, days, d);
            } else { unseen(w, th, vic, n); try { if (typeof HOME !== 'undefined' && HOME.stolen) HOME.stolen(w, null, vic, n); } catch (e) {} }
        }
        // 牢裡的人
        for (const [id, until] of Object.entries(C.jail)) { const a = w.agents[id]; if (!a && w.isAway?.(id)) continue; if (!a || a.isDead) { delete C.jail[id]; continue; } if (until <= d) { delete C.jail[id]; log(w, 'event', '🔓 {a}出獄了。', { a: a.name }, a.name); mem(w, a, '終於出來了，我得重新做人。', {}, 6); } else a.moodModifier = (a.moodModifier || 0) - 2; }
        // 貧民區
        const poor = all.filter(a => cash(w, a) < 10).length; C.poorDays = poor >= all.length * 0.3 ? (C.poorDays || 0) + 1 : 0;
        if (!C.slum && C.poorDays >= 10) { C.slum = true; log(w, 'event', '🏚️ 窮人越來越多，鎮邊形成了貧民區，治安變差了。', {}); }
        if (C.slum && C.poorDays === 0) { C.slum = false; log(w, 'event', '🏘️ 大家的日子好轉，貧民區慢慢消失了。', {}); }
        if (C.slum) for (const a of all) if (cash(w, a) < 10) a.moodModifier = (a.moodModifier || 0) - 1;
    }
    // v11.8.0 抓到小偷：還錢、關幾天（原本 crime 裡的那一段，給「守衛自己決定關他」那條路共用；效果一模一樣）
    function jailDo(w, C, th, vic, n, days, d) {
        { const back = Math.min(n, cash(w, th)); if (back > 0 && WALLET.take(w, th, back)) WALLET.add(w, vic, back); } /* v7.6.0 只還得回小偷身上還有的錢 */
        // v11.9.0 全鎮表決把偷竊罰則改成從輕時（days 是 0）：不關，罰最多 10 銀幣給公庫
        if (!(days > 0)) { const fine = Math.min(10, Math.floor(cash(w, th))); if (fine > 0) WALLET.pay(w, th, null, fine, t('偷竊罰款')); log(w, 'event', '👮 衛兵抓到{a}偷了{v}的 {n} 銀幣。照鎮上的規定不關，罰了 {f} 銀幣。', { a: th.name, v: vic.name, n, f: fine }, th.name);
            mem(w, th, '我偷錢被抓了，罰了 {f} 銀幣。', { f: fine }, 7); mem(w, vic, '{a}偷了我的錢，抓到了只罰點錢就放了。', { a: th.name }, 7); vic.relationships.getOrCreate(th.agentId, th.name).modifyAffinity(-25); try { DARK.bump(w, th, 'exposed'); } catch (e) {} return; }
        C.jail[th.agentId] = d + days;
        log(w, 'event', '👮 衛兵抓到{a}偷了{v}的 {n} 銀幣，關進牢裡 {d} 天。', { a: th.name, v: vic.name, n, d: days }, th.name);
        mem(w, th, '我偷錢被抓了，要在牢裡待 {d} 天。', { d: days }, 8); mem(w, vic, '{a}偷了我的錢，還好衛兵抓到了。', { a: th.name }, 7);
        vic.relationships.getOrCreate(th.agentId, th.name).modifyAffinity(-25); try { DARK.bump(w, th, 'exposed'); } catch (e) {}
    }
    // 沒被抓到（或被放走）：失主不知道是誰，成了真相頁的祕密
    function unseen(w, th, vic, n) {
        mem(w, vic, '我的錢包少了 {n} 銀幣，不知道是誰偷的。', { n }, 6);
        try { return DARK.secret(w, { kind: 'scheme', culprit: th.agentId, victim: vic.agentId, k: '{a}偷了{v}的 {n} 銀幣', p: { a: th.name, v: vic.name, n } }); } catch (e) { return null; }
    }
    // ---------- 稅率提案 ----------
    function taxProposal(w, C, d) {
        const P = w.proposals; if (!P?._createWith || !w.wallet || d - C.lastTax < 15) return;
        if ((P.items || []).some(p => p.kind === 'tax' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const tr = w.stockpile?.get?.('silver') || 0, all = npcs(w), tax = w.wallet.tax ?? 0.1;
        const poor = all.filter(a => cash(w, a) < 10).length;
        // v9.6.0 公庫見底(付不出公職薪水、或剩不到每人 4 銀幣)先加稅;公庫還算寬裕(每人 8 銀幣以上)才因為窮人多而減稅
        // 以前只要四分之一的人窮就一直減稅,稅率卡在 2%,公庫空了也沒人提加稅
        const short = (w.wallet.shortDay ?? -99) >= d - 7;
        // v10.7.0 門檻改成「公庫夠付幾天的固定支出」：不夠 10 天先加稅，夠 45 天以上而且窮人多才減稅（以前是每人 4／8 銀幣，百人的鎮每人 8 銀幣只夠花一天半，稅率一路被減到 2%）
        const TR = (typeof TREASURY !== 'undefined' && w.observerMode) ? TREASURY : null;
        let dir = null; if (((TR ? TR.needTax(w) : tr < Math.max(60, all.length * 4)) || short) && tax < 0.25) dir = 'up'; else if (poor >= all.length * 0.25 && tax > 0.04 && (TR ? TR.high(w) : tr >= all.length * 8)) dir = 'down';
        if (!dir) return;
        const who = dir === 'up' ? (all.find(a => a.job?.key === 'mayor') || all.find(a => has(a, 'hardworking'))) : (all.filter(a => cash(w, a) < 10).sort((x, y) => (has(y, 'charismatic') ? 1 : 0) - (has(x, 'charismatic') ? 1 : 0))[0]);
        if (!who) return; C.lastTax = d;
        const nt = Math.round((dir === 'up' ? tax + 0.05 : tax - 0.05) * 100) / 100;
        const cand = { kind: 'tax', key: 'tax:' + d, jobs: [], make: () => ({ kind: 'tax', key: 'tax:' + d, newTax: nt, dir, tk: dir === 'up' ? '加稅到 {n}%' : '減稅到 {n}%', tp: { n: Math.round(nt * 100) }, dk: dir === 'up' ? (TR ? '{who}說公庫只夠付 {d} 天的薪水與維護，提議把稅從 {a}% 調到 {n}%。' : '{who}說公庫快見底了，提議把稅從 {a}% 調到 {n}%。') : '{who}說大家快活不下去了，提議把稅從 {a}% 降到 {n}%。', dp: { who: who.name, a: Math.round(tax * 100), n: Math.round(nt * 100), d: TR ? Math.floor(TR.days(w)) : 0 }, cost: {}, category: 'economy', jobBias: ['mayor', 'trader'] }) };
        const p = P._createWith(w, d, cand, who); if (p) { p.newTax = nt; p.dir = dir; }
        return p;
    }
    function applyTax(w, p) { if (!w.wallet || typeof p.newTax !== 'number') return ''; const old = w.wallet.tax; w.wallet.tax = Math.round(Math.max(0.02, Math.min(0.3, p.newTax)) * 100) / 100; return t('稅率從 {a}% 調成 {n}%').replace('{a}', Math.round(old * 100)).replace('{n}', Math.round(w.wallet.tax * 100)); } // v9.18.0 以前回傳 tpl 物件，提案卡顯示成 [object Object]
    function taxVote(w, p, a) {
        const c = cash(w, a), tr = w.stockpile?.get?.('silver') || 0;
        const TR = (typeof TREASURY !== 'undefined' && w.observerMode) ? TREASURY : null;
        const civic = a.job?.key === 'mayor' || has(a, 'hardworking') || has(a, 'stoic');
        if (TR) { // v10.7.0 領公庫薪水的人知道公庫空了自己就領不到：公庫吃緊時他們贊成加稅、反對減稅
            const pub = typeof MARKET !== 'undefined' && MARKET.PUBLIC.includes(a.job?.key) && !MARKET.privatePaid?.(w, a) && !(typeof CLERGY !== 'undefined' && CLERGY.paidBy(w, a)); const tight = TR.low(w) || (w.wallet?.shortDay ?? -99) >= day(w) - 7;
            if (p.dir === 'down') { if (tight && (pub || civic)) return 'against'; return (c < 50 || c > 200 || Math.random() < 0.4) ? 'for' : 'against'; }
            if (tight && (pub || (civic && c >= 20))) return 'for';
            return Math.random() < (tight ? (c < 20 ? 0.15 : c > 300 ? 0.2 : 0.45) : 0.15) ? 'for' : 'against';
        }
        if (p.dir === 'down') return (c < 50 || c > 200 || Math.random() < 0.4) ? 'for' : 'against';
        return (tr < 60 && civic && c >= 20) || Math.random() < 0.2 ? 'for' : 'against';
    }
    // ---------- 地價房租 ----------
    const landPrice = (w) => Math.round(50 * (1 + tierLv(w) * 0.6) * (0.6 + (w.prosperity?.prosperity || 50) / 100));
    function rent(w, C, d) {
        if (!W() || !w.wallet || typeof HOUSING === 'undefined' || d % 7 !== 0 || C.rentDay === d) return; C.rentDay = d;
        if (typeof ESTATE !== 'undefined' && w.estate) return; // v6.90.0 改由住宅市場收租(房東、欠租、驅逐)
        const byHome = {}; for (const a of npcs(w)) { const h = HOUSING.houseOf(w, a); if (h) (byHome[h] || (byHome[h] = [])).push(a); }
        let total = 0;
        for (const [h, people] of Object.entries(byHome)) {
            if (people.length < 2) continue; const owner = people.slice().sort((x, y) => cash(w, y) - cash(w, x))[0];
            const lv = w.housing?.lv?.[h] || 0; const r = Math.round(2 + lv * 2 + tierLv(w) + landPrice(w) / 50);
            for (const x of people) {
                if (x === owner) continue; const fam = (x._parentNames || []).includes(owner.name) || (owner._parentNames || []).includes(x.name) || x.relationships?.relationships?.[owner.agentId]?.status === 'married'; if (fam) continue;
                if (WALLET.pay(w, x, owner, Math.min(r, Math.floor(cash(w, x))))) { total += r; if (cash(w, x) < 5) mem(w, x, '付完房租就沒剩幾個錢了。', {}, 5); }
            }
        }
        C.lastRent = total;
    }
    // ---------- 王都大事件 ----------
    function grand(w, C, d) {
        const k = typeof CROWN !== 'undefined' ? CROWN.king(w) : null; if (!k || tierLv(w) < 3) return;
        if (C.feastYear !== w.clock.year && w.clock.season === '夏季' && w.clock.day === 8) {
            C.feastYear = w.clock.year; let cost = Math.min(120, w.stockpile?.get?.('silver') || 0); if (cost && typeof MARKET !== 'undefined' && w.market && w.stockpile.consume('silver', cost, w.tickCount, t('國王壽宴'))) { MARKET.sell(w, 'kitchen', cost * 0.6, t('國王壽宴')); MARKET.sell(w, 'farm', cost * 0.4, t('國王壽宴')); } else cost = 0; /* v7.6.0 壽宴的錢付給食堂與農莊 */
            for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + 5; if (w.crown) w.crown.legit = Math.min(100, w.crown.legit + 3);
            log(w, 'event', '🎂 國王{k}的壽宴！全城張燈結綵，花了 {n} 銀幣。', { k: k.name, n: cost }, k.name);
            try { w.dailyNews?.collectEvent?.('event', `${t('國王壽宴')}`, 9, [k.name]); } catch (e) {}
        }
        if (!k.relationships?.getPartner?.() && Math.random() < 0.02) {
            const list = brides(w, k); if (!list.length) return;
            // v11.9.0 什麼時候想成婚照舊看天；對象由國王自己從幾位人選裡挑，被挑上的人可以答應或拒絕（sim-decide-home.js）。問不到國王時照原本娶階層最高的
            try { if (typeof HOME !== 'undefined' && HOME.royalAsk && HOME.royalAsk(w, k, list)) return; } catch (e) { console.warn('[Civic] royal ask', e); }
            royalWed(w, k, list[0]);
        }
    }
    // v9.4.0 不娶自己的親人:父母子女、兄弟姊妹(同父或同母)、王室成員(多半是國王的家人)都排除；階層高的排前面
    function brides(w, k) {
        const kp = k._parentNames || []; const kin = (a) => kp.includes(a.name) || (a._parentNames || []).includes(k.name) || (a._parentNames || []).some(n => kp.includes(n)) || (() => { try { return !!CLASS.S(w).titles[a.agentId]?.royal; } catch (e) { return false; } })();
        return npcs(w).filter(a => a !== k && a.gender !== k.gender && a.age >= 18 && Math.abs(a.age - k.age) <= 15 && !a.relationships?.getPartner?.() && !kin(a)).sort((x, y) => { try { return CLASS.level(w, y) - CLASS.level(w, x); } catch (e) { return 0; } });
    }
    function royalWed(w, k, bride) {
        if (!k || !bride || k.relationships?.getPartner?.() || bride.relationships?.getPartner?.()) return false;
        const r1 = k.relationships.getOrCreate(bride.agentId, bride.name), r2 = bride.relationships.getOrCreate(k.agentId, k.name); r1.status = 'married'; r2.status = 'married'; r1.affinity = Math.max(r1.affinity, 50); r2.affinity = Math.max(r2.affinity, 50);
        try { const Cc = CLASS.S(w); Cc.titles[bride.agentId] = Object.assign(Cc.titles[bride.agentId] || {}, { royal: true }); Cc.lv[bride.agentId] = 5; } catch (e) {}
        for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + 6; if (w.crown) w.crown.legit = Math.min(100, w.crown.legit + 6);
        log(w, 'event', '👑💍 皇家婚禮！國王{k}迎娶{b}，全城歡慶。', { k: k.name, b: bride.name }, k.name);
        mem(w, bride, '我嫁給了國王，從今以後是王族了。', {}, 10); mem(w, k, '我娶了{b}。', { b: bride.name }, 9);
        try { w.dailyNews?.collectEvent?.('event', t('皇家婚禮'), 10, [k.name, bride.name]); } catch (e) {}
        return true;
    }
    // ---------- 移民(等級越高越吸引人) ----------
    function migration(w) {
        if (!w.news?.bulletins) return; const nd = newsDay(w); const lv = tierLv(w);
        w.news.bulletins = w.news.bulletins.filter(b => !b.civic);
        const m = {}; if (lv > 0) m.immigration_chance = lv * 0.05; if (w.civic?.slum) m.mood_modifier = -1;
        if (Object.keys(m).length) w.news.bulletins.push({ headline: t('城鎮吸引力'), category: 'remote', severity: 'info', flavor: [], modifiers: m, expiresDay: nd + 2, publishedDay: nd, civic: true });
        w.news._rebuildModifiers?.(nd);
    }
    function daily(w) {
        const C = S(w), d = day(w); if (C.lastDay === d) return; C.lastDay = d;
        if (W() && w.wallet) { crime(w, C, d); taxProposal(w, C, d); rent(w, C, d); }
        grand(w, C, d); migration(w);
    }
    function view(w) { const C = S(w); return { slum: C.slum, thefts: C.thefts, caught: C.caught, jailed: Object.entries(C.jail).filter(([id, u]) => u > day(w) && w.agents[id]).map(([id]) => t(w.agents[id].name)), guards: npcs(w).filter(a => a.job?.key === 'guard').length, land: landPrice(w), rent: C.lastRent || 0, tax: Math.round((w.wallet?.tax ?? 0.1) * 100) }; }
    const chip = (w, a) => (jailed(w, a) ? `⛓️ ${t('坐牢中')}` : '');
    return { S, daily, crime, taxProposal, applyTax, taxVote, rent, grand, brides, royalWed, migration, landPrice, jailed, view, chip, jailDo, unseen };
})();
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.tax = { icon: '💰', label: '稅率' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) CIVIC.daily(w); } catch (e) { console.warn('[Civic] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'tax') { const v = CIVIC.taxVote(w, p, a); p.votes[a.agentId] = v; (p.why || (p.why = {}))[a.agentId] = 'purse'; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.civic = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.civic) d.civic = this.civic; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.civic = (data?.civic && typeof data.civic.jail === 'object') ? data.civic : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.CIVIC = CIVIC;
