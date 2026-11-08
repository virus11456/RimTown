// RimTown - sim-health.js(v7.4.0 身體與醫療＋生技時代)
// 每個村民五個部位:眼(視力→研究／手藝效率)、手(工作效率)、腳(走路速度、農夫守衛商人效率)、心(壽命)、肺(睡眠)。
// 病痛從哪來:老化、職業病(礦工的肺、鐵匠的眼)、冬天沒錢沒柴染風寒(會傳染)、富裕或壓力大的心臟病、工傷(工具差更容易)、仇人打架。
// 怎麼治:輕症看醫生吃藥;重症要醫院＋外科醫學才能開刀(成功率看醫生、科技、病情、年紀;可能失敗留下殘疾或死在手術台);
// 部位壞到底排隊等移植(過世村民生前同意或家屬同意捐贈;眼手腳要外科＋解剖,心肺要免疫學;會排斥);便宜的替代:眼鏡、拐杖、義肢。
// 金流守恆:診金與手術費付給看診的醫生(六成)和公庫(醫院公營,四成);藥品從公庫庫存出、錢進公庫;自己付不起→家人→工會互助金→銀行借→
// 公費醫療補助(提案通過才有,公庫出一半);插隊塞給醫生的紅包是村民之間轉手。第五時代「生技」要城市＋機械時代全研究＋研究院。
'use strict';
const HEALTH = (() => {
    const PARTS = ['e', 'h', 'f', 'c', 'l'];
    const PN = { e: '眼睛', h: '手', f: '腳', c: '心臟', l: '肺' };
    const PI = { e: '👁️', h: '✋', f: '🦶', c: '❤️', l: '🫁' };
    const KN = { injury: '受傷', disease: '病', fever: '風寒' };
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const log = (w, k, p, who) => { try { w.logMessageT?.('health', k, p, who); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'daily', k, p || {}, imp || 5, []); } catch (e) {} };
    const trait = (a, k) => (a.personality?.traits || []).includes(k);
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k || b.name === (typeof BUILDING_TEMPLATES !== 'undefined' ? BUILDING_TEMPLATES[k]?.name : ''));
    function S(w) {
        if (!w.health || typeof w.health !== 'object') w.health = {};
        const H = w.health; H.b = H.b || {}; H.a = H.a || {}; H.aid = H.aid || {}; H.q = H.q || []; H.bank = H.bank || []; H.log = H.log || []; H.st = H.st || { treat: 0, ops: 0, ok: 0, fail: 0, died: 0, tx: 0, fights: 0, owed: 0, bribes: 0 };
        HEALTH.W = w; return H;
    }
    // ---------- 身體數值 ----------
    function body(w, a) { const H = S(w); const b = H.b[a.agentId]; return b ? { e: b[0], h: b[1], f: b[2], c: b[3], l: b[4] } : { e: 100, h: 100, f: 100, c: 100, l: 100 }; }
    function setPart(w, a, p, v) {
        const H = S(w); const id = a.agentId; const b = H.b[id] || (H.b[id] = [100, 100, 100, 100, 100]);
        b[PARTS.indexOf(p)] = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
        if (b.every(x => x >= 100)) delete H.b[id];
    }
    function hurt(w, a, p, n) { setPart(w, a, p, body(w, a)[p] - n); }
    // 有輔具時的有效值(眼鏡、拐杖、義肢、人工心肺)
    const AID = { glasses: { p: 'e', add: 25, cap: 85 }, crutch: { p: 'f', add: 18, cap: 65 }, arm: { p: 'h', set: 80 }, leg: { p: 'f', set: 80 }, heart: { p: 'c', set: 75 }, lung: { p: 'l', set: 75 } };
    function eff(w, a, p) {
        let v = body(w, a)[p]; const ax = S(w).aid[a.agentId] || [];
        for (const k of ax) { const d = AID[k]; if (!d || d.p !== p) continue; v = d.set ? Math.max(v, d.set) : Math.min(Math.max(v, d.cap), v + d.add); }
        return v;
    }
    const ails = (w, a) => S(w).a[a.agentId] || [];
    const sickToday = (w, a) => ails(w, a).some(x => x.k === 'fever' || x.s >= 3);
    // ---------- 對工作、走路、睡眠、壽命的影響 ----------
    const EYE_JOBS = { researcher: 1, tailor: 1, blacksmith: 1, carpenter: 1, doctor: 1 };
    const FOOT_JOBS = { farmer: 1, guard: 1, trader: 1, miner: 1 };
    function workMult(w, a) {
        if (!w.health) return 1; const k = a.job?.key;
        let m = 0.4 + 0.6 * eff(w, a, 'h') / 100;
        if (EYE_JOBS[k]) m *= 0.5 + 0.5 * eff(w, a, 'e') / 100;
        if (FOOT_JOBS[k]) m *= 0.6 + 0.4 * eff(w, a, 'f') / 100;
        if (sickToday(w, a)) m *= 0.3; // 病倒了只能躺著
        return m;
    }
    function speed(aid) { const w = HEALTH.W; if (!w?.health?.b?.[aid] && !w?.health?.aid?.[aid]) return 1; const a = w.agents[aid]; return a ? 0.4 + 0.6 * eff(w, a, 'f') / 100 : 1; }
    function sleepMult(w, a) { if (!w.health) return 1; return 0.4 + 0.6 * eff(w, a, 'l') / 100; }
    function deathMult(w, a) { if (!w.health) return 1; return 1 + (100 - eff(w, a, 'c')) / 25; }
    // 找工作、裁員時看身體適不適合(手腳壞的人當不了礦工)
    function jobFit(a, k) { const w = HEALTH.W; if (!w?.health) return 1; const h = eff(w, a, 'h') / 100, f = eff(w, a, 'f') / 100, e = eff(w, a, 'e') / 100; let m = 0.5 + 0.5 * h; if (EYE_JOBS[k]) m *= 0.6 + 0.4 * e; if (FOOT_JOBS[k]) m *= 0.6 + 0.4 * f; return m; }
    // ---------- 生病受傷 ----------
    function addAil(w, a, x, why) {
        const H = S(w); const list = H.a[a.agentId] || (H.a[a.agentId] = []);
        const same = list.find(y => y.p === x.p && y.k === x.k); if (same) { same.s = Math.min(3, same.s + 1); return same; }
        if (list.length >= 2) list.sort((p, q) => p.s - q.s).shift(); // 最多記兩樣,輕的讓位
        const it = { p: x.p, k: x.k, s: x.s, d: day(w) }; list.push(it);
        if (x.dmg) HEALTH.hurt(w, a, x.p, x.dmg);
        a.addThought?.(x.k === 'injury' ? 'hurt' : 'ill', w);
        mem(w, a, x.k === 'injury' ? '我的{p}受傷了（{why}），很痛。' : '我的{p}出了毛病（{why}），渾身不對勁。', { p: t(PN[x.p]), why: t(why) }, 6);
        return it;
    }
    function natural(w, a, d, winter, H) {
        const age = a.age || 30, b = body(w, a), k = a.job?.key, cash = WL() ? WL().get(w, a) : 50;
        // 老化
        if (age >= 55) { const r = age >= 70 ? 2 : 1; HEALTH.hurt(w, a, 'e', 0.03 * r); HEALTH.hurt(w, a, 'c', 0.025 * r); HEALTH.hurt(w, a, 'l', 0.02 * r); }
        // 職業病
        if (k === 'miner') HEALTH.hurt(w, a, 'l', 0.03); if (k === 'blacksmith') HEALTH.hurt(w, a, 'e', 0.02);
        if (b.l < 70 && Math.random() < 0.003) addAil(w, a, { p: 'l', k: 'disease', s: 1 }, '肺病');
        // 心臟:年紀、吃太好、壓力
        if (age >= 45) { let p = 0.0004 + (cash > 300 ? 0.0006 : 0) + (trait(a, 'glutton') ? 0.0006 : 0) + ((a.mood || 50) < 20 ? 0.0006 : 0) - (trait(a, 'ascetic') ? 0.0003 : 0); if (Math.random() < p) addAil(w, a, { p: 'c', k: 'disease', s: 1 }, '心臟病'); }
        if (age >= 60 && b.e < 75 && Math.random() < 0.002) addAil(w, a, { p: 'e', k: 'disease', s: 1 }, '眼疾');
        // 冬天沒錢沒柴:風寒(會傳染)
        if (winter && (cash < 10 || (w.market?.hungry?.[a.agentId] || 0) > 0) && Math.random() < 0.012) addAil(w, a, { p: 'l', k: 'fever', s: 1 }, '風寒');
        // 工傷:礦工、木匠、農夫、鐵匠;工具不夠更容易
        if ({ miner: 1, carpenter: 1, farmer: 1, blacksmith: 1 }[k]) { const tf = (typeof ECON !== 'undefined' && ECON.toolFactor) ? ECON.toolFactor(w) : 1; if (Math.random() < 0.0015 * (tf < 0.95 ? 2 : 1)) { const p = Math.random() < 0.6 ? 'h' : 'f'; const s = Math.random() < 0.25 ? 2 : 1; addAil(w, a, { p, k: 'injury', s, dmg: 10 + s * 10 }, '工作時出意外'); log(w, '🩹 {a}工作時出了意外，{p}受傷了。', { a: a.name, p: t(PN[p]) }, a.name); } }
    }
    function contagion(w, all, H) {
        const sick = all.filter(a => ails(w, a).some(x => x.k === 'fever')); if (!sick.length) return;
        let guard = 1 - (done(w, 'sanitation') ? 0.3 : 0) - (done(w, 'vaccination') ? 0.45 : 0) - (built(w, 'sewers') ? 0.1 : 0) - (built(w, 'bathhouse') ? 0.05 : 0);
        if (w.events?.activeEffects?.disease) guard *= 2;
        let n = 0; for (const s of sick) { if (n >= 3) break; if (Math.random() < 0.05 * guard) { const o = all[Math.floor(Math.random() * all.length)]; if (o !== s && !ails(w, o).some(x => x.k === 'fever')) { addAil(w, o, { p: 'l', k: 'fever', s: 1 }, '被傳染了風寒'); n++; } } }
        if (sick.length >= 4 && !H.flu) { H.flu = day(w); log(w, '🤧 風寒在鎮上傳開了，已經有 {n} 個人病倒。', { n: sick.length }); }
        if (sick.length < 2) H.flu = 0;
    }
    // 仇人打架:互相討厭到極點,脾氣差的更容易動手;輸的那個受傷
    function fights(w, all, H) {
        if (Math.random() > 0.35) return;
        for (const a of all) {
            const R = a.relationships?.relationships || {}; if ((a.age || 30) < 14) continue;
            for (const id in R) { const r = R[id]; const o = w.agents[id]; if (!o || o.isDead || o.isPlayer || (o.age || 30) < 14 || (r.affinity || 0) > -55) continue;
                let p = 0.01 + (trait(a, 'abrasive') ? 0.015 : 0) + (trait(a, 'jealous') ? 0.008 : 0) + (trait(a, 'neurotic') ? 0.006 : 0) - (trait(a, 'stoic') ? 0.008 : 0) - (trait(a, 'kind') ? 0.008 : 0);
                if (Math.random() >= p) continue;
                const sa = (a.skills?.get?.('近戰')?.level || 0) + Math.random() * 6, so = (o.skills?.get?.('近戰')?.level || 0) + Math.random() * 6;
                const loser = sa >= so ? o : a, winner = loser === a ? o : a; const part = ['h', 'f', 'e'][Math.floor(Math.random() * 3)]; const s = Math.random() < 0.3 ? 2 : 1;
                addAil(w, loser, { p: part, k: 'injury', s, dmg: 8 + s * 10 }, '打架');
                if (Math.random() < 0.4) addAil(w, winner, { p: 'h', k: 'injury', s: 1, dmg: 5 }, '打架');
                r.affinity = Math.max(-100, (r.affinity || 0) - 10); const r2 = o.relationships?.getOrCreate?.(a.agentId, a.name); if (r2) r2.affinity = Math.max(-100, (r2.affinity || 0) - 10);
                H.st.fights++; mem(w, loser, '跟{x}打了一架，{p}被打傷了。', { x: winner.name, p: t(PN[part]) }, 7); mem(w, winner, '跟{x}打了一架，把他打傷了。', { x: loser.name }, 6);
                log(w, '👊 {a}跟{b}打起來了，{l}的{p}受了傷。', { a: a.name, b: o.name, l: loser.name, p: t(PN[part]) }, a.name);
                return; // 一天最多一場
            }
        }
    }
    // ---------- 付錢:自己 → 家人 → 工會互助 → 銀行借 → 公費補助(提案通過才有) ----------
    function family(w, a) { const out = new Set(); const R = a.relationships?.relationships || {}; for (const id in R) { const r = R[id]; const o = w.agents[id]; if (o && !o.isDead && (r.status === 'married' || r.status === 'dating')) out.add(o); } for (const o of npcs(w)) if (o !== a && ((a._parentNames || []).includes(o.name) || (o._parentNames || []).includes(a.name))) out.add(o); return [...out]; }
    function pay(w, a, cost, why, doctor) {
        const Wl = WL(); const sp = w.stockpile; if (!Wl || cost <= 0) return { ok: true, by: [] };
        let need = cost; const got = []; // 每一筆是誰出的,湊不齊就原路退回
        const take = (who, n, kind) => { n = Math.min(n, Math.floor(Wl.get(w, who) * 100) / 100); if (n > 0.009 && Wl.take(w, who, n)) { need = Math.round((need - n) * 100) / 100; got.push({ kind, who, n }); return n; } return 0; };
        take(a, need, 'self');
        if (need > 0.01) for (const f of family(w, a).sort((x, y) => Wl.get(w, y) - Wl.get(w, x))) { const room = Wl.get(w, f) - 10; if (room < need * 0.5) continue; take(f, Math.min(need, room), 'family'); if (need <= 0.01) break; }
        const U = w.union; if (need > 0.01 && U?.on && U.members?.[a.agentId] && (U.fund || 0) > 5) { const n = Math.min(need, cost * 0.5, U.fund - 2); if (n > 0) { U.fund = Math.round((U.fund - n) * 100) / 100; need = Math.round((need - n) * 100) / 100; got.push({ kind: 'union', n }); } } // 工會互助金(會員繳的會費)
        const H = S(w);
        if (need > 0.01 && H.medaid && sp) { const n = Math.min(need, cost * 0.5, sp.get('silver') - 50); if (n > 0 && sp.consume('silver', n, w.tickCount, t('公費醫療補助'), 'medical')) { need = Math.round((need - n) * 100) / 100; got.push({ kind: 'aid', n }); } }
        if (need > 0.01 && typeof BANK !== 'undefined' && w.bank) { const B = BANK.S(w); if (B.open && !B.loans?.[a.agentId]) { const lent = BANK.lend(w, B, a, Math.ceil(need) + 1, t('看病')); if (lent >= need) take(a, need, 'loan'); } }
        if (need > 0.01) { // 湊不齊:原路退回(借到的錢留在身上,照樣要還)
            for (const g of got) { if (g.who) Wl.add(w, g.who, g.n); else if (g.kind === 'union') U.fund = Math.round((U.fund + g.n) * 100) / 100; else if (g.kind === 'aid') sp.add('silver', g.n, w.tickCount, t('公費醫療補助'), 'medical'); }
            return { ok: false, short: need };
        }
        for (const g of got) { if (g.kind === 'family') mem(w, g.who, '{a}看病要錢，我幫忙出了 {n} 銀幣。', { a: a.name, n: Math.round(g.n) }, 5); if (g.kind === 'aid') H.st.aid = Math.round(((H.st.aid || 0) + g.n) * 100) / 100; }
        // 收錢的人:看診醫生六成,其餘進公庫(醫院公營)。都在鎮內轉手
        const docCut = doctor && !doctor.isDead ? Math.round(cost * 0.6 * 100) / 100 : 0;
        if (docCut) Wl.add(w, doctor, docCut); if (sp) sp.add('silver', Math.round((cost - docCut) * 100) / 100, w.tickCount, `${t('醫療收入')}${t('：')}${t(why)}`, 'medical');
        return { ok: true, by: got.map(g => g.kind) };
    }
    // ---------- 治療 ----------
    function successRate(w, a, doc, sev) {
        const age = a.age || 30; const sk = doc?.skills?.get?.('醫療')?.level || 0;
        let p = 0.42 + sk * 0.02 + (done(w, 'anatomy') ? 0.1 : 0) + (done(w, 'sanitation') ? 0.05 : 0) + (done(w, 'chemistry') ? 0.1 : 0) + (done(w, 'antibiotics') ? 0.1 : 0) + (built(w, 'hospital') ? 0.05 : 0) - sev * 0.08 - (age >= 60 ? 0.1 : 0) - (age >= 75 ? 0.1 : 0);
        return Math.max(0.1, Math.min(0.95, p));
    }
    function deathRisk(w, sev) { return Math.max(0.005, (0.12 - (done(w, 'chemistry') ? 0.07 : 0) - (done(w, 'antibiotics') ? 0.03 : 0)) * sev / 3); }
    const canSurgery = (w) => done(w, 'surgery') && built(w, 'hospital');
    const transplantable = (w, p) => canSurgery(w) && (p === 'c' || p === 'l' ? done(w, 'immunology') : done(w, 'anatomy'));
    function refuses(w, a) { try { if (typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 75) return Math.random() < 0.3; } catch (e) {} return false; }
    function die(w, a, why) { a._deathCause = t(why); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {} }
    function treat(w, all, H, d) {
        const docs = all.filter(a => a.job?.key === 'doctor' && !sickToday(w, a)); let slots = docs.length * 3; if (!slots) return;
        const med = 6;
        const patients = all.filter(a => ails(w, a).length).sort((x, y) => Math.max(...ails(w, y).map(z => z.s)) - Math.max(...ails(w, x).map(z => z.s)));
        for (const a of patients) {
            if (slots <= 0) break; const list = ails(w, a); const x = list.slice().sort((p, q) => q.s - p.s)[0]; if (!x) continue;
            const doc = docs[slots % docs.length]; slots--;
            if (x.s === 1) { // 輕症:看診＋吃藥
                const r = pay(w, a, 4 + med, '看診', doc); if (!r.ok) { x.owed = (x.owed || 0) + 1; H.st.owed++; (H.ob = H.ob || {})[a.agentId] = day(w); continue; }
                const hasMed = !!w.stockpile?.consume?.('medicine', 1, w.tickCount, t('看病'), 'medical'); H.st.treat++;
                const cure = (hasMed ? 1 : 0.5) * 0.35 + (done(w, 'medicine_research') ? 0.1 : 0) + (done(w, 'herbalism') ? 0.1 : 0) + (x.p === 'l' && done(w, 'microbiology') ? 0.15 : 0) + (x.p === 'l' && done(w, 'antibiotics') ? 0.2 : 0) + (built(w, 'clinic_upgrade') ? 0.05 : 0);
                if (Math.random() < cure) { list.splice(list.indexOf(x), 1); if (x.k === 'injury') setPart(w, a, x.p, body(w, a)[x.p] + 8); mem(w, a, '{d}幫我看好了{p}的毛病。', { d: doc.name, p: t(PN[x.p]) }, 4); }
                continue;
            }
            // 重症:開刀
            if (!canSurgery(w)) { x.wait = (x.wait || 0) + 1; continue; }
            if (refuses(w, a)) { if (!x.pray) { x.pray = 1; mem(w, a, '神會保佑我，我不想開刀。', {}, 6); log(w, '🙏 {a}篤信神明，拒絕開刀，改去祈福。', { a: a.name }, a.name); } continue; }
            const fee = x.s >= 3 ? 120 : 60; const r = pay(w, a, fee, '手術', doc); if (!r.ok) { x.owed = (x.owed || 0) + 1; H.st.owed++; (H.ob = H.ob || {})[a.agentId] = day(w); if (x.owed === 3) log(w, '💸 {a}要開刀，但湊不出 {n} 銀幣，只能拖著。', { a: a.name, n: fee }, a.name); continue; }
            surgery(w, a, x, doc, H, fee);
        }
    }
    function surgery(w, a, x, doc, H, fee) {
        H.st.ops++; const list = ails(w, a);
        if (Math.random() < deathRisk(w, x.s)) { H.st.died++; rec(w, H, a, 'died', x.p); log(w, '⚰️ {a}的{p}手術失敗，沒能救回來。', { a: a.name, p: t(PN[x.p]) }, a.name); malpractice(w, a, doc); die(w, a, '手術失敗'); return; }
        const p = HEALTH.successRate(w, a, doc, x.s); const roll = Math.random();
        if (roll < p) { list.splice(list.indexOf(x), 1); setPart(w, a, x.p, Math.max(body(w, a)[x.p], 85)); H.st.ok++; rec(w, H, a, 'ok', x.p); a.addThought?.('cured', w); mem(w, a, '{d}幫我開刀，{p}好了！', { d: doc.name, p: t(PN[x.p]) }, 7); log(w, '🏥 {d}幫{a}動了{p}手術，很成功。', { d: doc.name, a: a.name, p: t(PN[x.p]) }, a.name); }
        else if (roll < p + (1 - p) / 2) { list.splice(list.indexOf(x), 1); setPart(w, a, x.p, Math.max(body(w, a)[x.p], 60)); H.st.ok++; rec(w, H, a, 'part', x.p); log(w, '🏥 {a}的{p}手術算是成功，但沒辦法完全恢復。', { a: a.name, p: t(PN[x.p]) }, a.name); }
        else { HEALTH.hurt(w, a, x.p, 15); H.st.fail++; rec(w, H, a, 'fail', x.p); mem(w, a, '手術失敗了，我的{p}更糟了。', { p: t(PN[x.p]) }, 8); log(w, '😞 {a}的{p}手術失敗，留下了後遺症。', { a: a.name, p: t(PN[x.p]) }, a.name); malpractice(w, a, doc); }
    }
    // 手術失敗:家屬可能怪醫生(好感大跌,醫生心情差;被告上法庭的戲份交給既有的審判提案)
    function malpractice(w, a, doc) { if (!doc) return; for (const f of family(w, a)) { const r = f.relationships?.getOrCreate?.(doc.agentId, doc.name); if (r) r.affinity = Math.max(-100, (r.affinity || 0) - 20); } doc.moodModifier = (doc.moodModifier || 0) - 6; mem(w, doc, '{a}的手術沒成功，家屬很不諒解。', { a: a.name }, 7); }
    function rec(w, H, a, r, p) { H.log.push([day(w), a.name, r, p]); if (H.log.length > 12) H.log.splice(0, H.log.length - 12); }
    // ---------- 器官壞到底:排隊等移植;過世的村民可能捐出器官 ----------
    function queue(w, all, H, d) {
        for (const a of all) for (const p of PARTS) { if (body(w, a)[p] > 25 || !transplantable(w, p)) continue; if (H.q.some(q => q.id === a.agentId && q.p === p)) continue; H.q.push({ id: a.agentId, p, d }); mem(w, a, '醫生說我的{p}要換，只能排隊等人捐。', { p: t(PN[p]) }, 7); }
        H.q = H.q.filter(q => { const a = w.agents[q.id]; return a && !a.isDead && body(w, a)[q.p] <= 40; });
        H.bank = H.bank.filter(o => d - o.d <= 3); // 器官放不久
        // 插隊:有錢人塞紅包給醫生
        const docs = all.filter(a => a.job?.key === 'doctor');
        if (H.q.length > 1 && docs.length && Math.random() < 0.15) {
            const rich = H.q.slice(1).map(q => [q, w.agents[q.id]]).filter(([, a]) => a && WL() && WL().get(w, a) >= 300).sort((x, y) => WL().get(w, y[1]) - WL().get(w, x[1]))[0];
            const doc = docs.find(x => !trait(x, 'kind')) ; if (rich && doc && WL().take(w, rich[1], 80)) { WL().add(w, doc, 80); H.q.splice(H.q.indexOf(rich[0]), 1); H.q.unshift(rich[0]); H.st.bribes++; mem(w, rich[1], '塞了紅包給{d}，移植排到最前面了。', { d: doc.name }, 6);
                if (typeof PRESS !== 'undefined' && w.press && Math.random() < 0.35) { log(w, '📰 報社揭發：{a}塞紅包給醫生{d}插隊等移植！', { a: rich[1].name, d: doc.name }, rich[1].name); w.dailyNews?.collectEvent?.('politics', `${t('醫療插隊醜聞')}${t('：')}${rich[1].name}`, 7, [rich[1].name, doc.name]); for (const o of all) { if (o === rich[1]) continue; const r = o.relationships?.getOrCreate?.(rich[1].agentId, rich[1].name); if (r) r.affinity = Math.max(-100, (r.affinity || 0) - 6); } doc.moodModifier = (doc.moodModifier || 0) - 8; } } }
        // 配對:捐贈器官或培養器官
        for (const q of H.q.slice()) {
            const a = w.agents[q.id]; if (!a) continue; let src = H.bank.find(o => o.p === q.p);
            let fee = 150; if (!src && done(w, 'regen_medicine') && WL() && WL().get(w, a) >= 420) { src = { p: q.p, grown: true }; fee = 400; }
            if (!src) continue; const doc = docs[0]; if (!doc) break;
            if (refuses(w, a)) continue;
            const r = pay(w, a, fee, '移植手術', doc); if (!r.ok) continue;
            if (!src.grown) H.bank.splice(H.bank.indexOf(src), 1); H.q.splice(H.q.indexOf(q), 1); H.st.tx++;
            const reject = Math.max(0.03, 0.3 - (done(w, 'immunology') ? 0.18 : 0) - (done(w, 'vaccination') ? 0.04 : 0) - (src.grown ? 0.1 : 0));
            if (Math.random() < deathRisk(w, 3) * 0.8) { rec(w, H, a, 'died', q.p); log(w, '⚰️ {a}的{p}移植手術沒能撐過去。', { a: a.name, p: t(PN[q.p]) }, a.name); die(w, a, '移植手術失敗'); continue; }
            if (Math.random() < reject) { rec(w, H, a, 'reject', q.p); log(w, '😞 {a}移植的{p}被身體排斥了。', { a: a.name, p: t(PN[q.p]) }, a.name); continue; }
            setPart(w, a, q.p, 90); const al = ails(w, a); for (let i = al.length - 1; i >= 0; i--) if (al[i].p === q.p) al.splice(i, 1);
            rec(w, H, a, 'tx', q.p); a.addThought?.('cured', w); mem(w, a, '{src}，我換了新的{p}，重獲新生。', { src: src.grown ? t('醫院培養的器官') : t('有人捐了器官給我') , p: t(PN[q.p]) }, 9);
            log(w, src.grown ? '🧬 {a}用醫院培養的{p}完成移植。' : '🫀 {a}接受了{who}捐贈的{p}，移植成功。', { a: a.name, who: src.from || '', p: t(PN[q.p]) }, a.name);
        }
    }
    function onDeath(w, a) {
        if (!w.health || a.isPlayer) return; const H = S(w); const d = day(w);
        let p = 0.3 + (trait(a, 'kind') ? 0.2 : 0) - (refuses(w, a) ? 0.3 : 0);
        if ((a.age || 30) < 75 && Math.random() < p) { const b = body(w, a); for (const k of PARTS) if (b[k] >= 60) H.bank.push({ p: k, d, from: a.name }); if (H.bank.length) log(w, '🕊️ {a}生前同意捐贈器官，可以幫到等移植的人。', { a: a.name }, a.name); }
        delete H.b[a.agentId]; delete H.a[a.agentId]; delete H.aid[a.agentId]; H.q = H.q.filter(q => q.id !== a.agentId);
    }
    // ---------- 輔具:眼鏡、拐杖、義肢、人工心肺(錢付給鐵舖／木作坊的老闆或公庫) ----------
    function aids(w, all, H) {
        const Wl = WL(); if (!Wl) return;
        for (const a of all) {
            const b = body(w, a), ax = H.aid[a.agentId] || []; const buy = (k, price, sector, why) => { if (ax.includes(k) || Wl.get(w, a) < price + 10) return false; if (!Wl.take(w, a, price)) return false; if (typeof MARKET !== 'undefined' && w.market) MARKET.sell(w, sector, price, t(why)); else w.stockpile?.add?.('silver', price, w.tickCount, t(why), 'medical'); (H.aid[a.agentId] = ax).push(k); return true; };
            if (b.e < 60 && buy('glasses', 20, 'forge', '配眼鏡')) mem(w, a, '配了一副眼鏡，看得清楚多了。', {}, 5);
            if (b.f < 50 && !ax.includes('leg') && buy('crutch', 8, 'timber', '買拐杖')) mem(w, a, '拄著拐杖，走路總算方便一點。', {}, 5);
            if (done(w, 'prosthetics')) {
                if (b.h < 35 && buy('arm', 250, 'forge', '裝義肢')) log(w, '🦾 {a}裝了機械義手。', { a: a.name }, a.name);
                if (b.f < 35 && buy('leg', 250, 'forge', '裝義肢')) log(w, '🦿 {a}裝了機械義腿。', { a: a.name }, a.name);
                if (b.c < 25 && buy('heart', 500, 'forge', '裝人工心臟')) log(w, '❤️‍🔥 {a}裝了人工心臟。', { a: a.name }, a.name);
                if (b.l < 25 && buy('lung', 500, 'forge', '裝人工肺')) log(w, '🫁 {a}裝了人工肺。', { a: a.name }, a.name);
            }
        }
    }
    // ---------- 病情惡化、器官衰竭 ----------
    function progress(w, all, H, d) {
        for (const a of all) {
            const list = ails(w, a); for (let i = list.length - 1; i >= 0; i--) { const x = list[i];
                if (x.k === 'fever') { HEALTH.hurt(w, a, 'l', 0.6); if (d - x.d >= 6 && Math.random() < 0.25) { list.splice(i, 1); continue; } if (d - x.d >= 10 && Math.random() < 0.04) x.s = Math.min(3, x.s + 1); }
                else if (x.k === 'disease') { HEALTH.hurt(w, a, x.p, 0.4 * x.s); if (d - x.d >= 15 && Math.random() < 0.03) x.s = Math.min(3, x.s + 1); }
                else if (x.k === 'injury') { if (x.s === 1 && d - x.d >= 8 && Math.random() < 0.15) { list.splice(i, 1); setPart(w, a, x.p, body(w, a)[x.p] + 5); continue; } if (x.s >= 2 && d - x.d >= 20 && !canSurgery(w)) { list.splice(i, 1); mem(w, a, '{p}的傷一直沒好好治，留下了殘疾。', { p: t(PN[x.p]) }, 7); continue; } }
            }
            if (!list.length) delete H.a[a.agentId];
            const c = eff(w, a, 'c'), l = eff(w, a, 'l');
            if (c < 20 && Math.random() < 0.03 * (1 - c / 25)) { rec(w, H, a, 'died', 'c'); log(w, '💔 {a}心臟病發，走了。', { a: a.name }, a.name); die(w, a, '心臟病發'); continue; }
            if (l < 15 && Math.random() < 0.02) { rec(w, H, a, 'died', 'l'); log(w, '😮‍💨 {a}的肺撐不下去了。', { a: a.name }, a.name); die(w, a, '肺衰竭'); continue; }
            if (list.some(x => x.s >= 3 && x.k !== 'injury') && Math.random() < 0.01) { die(w, a, '久病不癒'); continue; }
        }
    }
    // 遺傳:剛出生的孩子帶著爸媽的心肺體質(研究遺傳學後做遺傳諮詢,影響減半)
    function heredity(w, all, H) {
        H.seen = H.seen || {}; for (const a of all) { if (H.seen[a.agentId]) continue; H.seen[a.agentId] = 1; if ((a.age ?? 30) > 1 || !(a._parentNames || []).length) continue;
            const ps = all.filter(o => a._parentNames.includes(o.name)); if (!ps.length) continue; const k = done(w, 'genetics') ? 0.25 : 0.5;
            for (const p of ['c', 'l', 'e']) { const worst = Math.min(...ps.map(o => body(w, o)[p])); if (worst < 70) setPart(w, a, p, 100 - (100 - worst) * k); } }
        if (Object.keys(H.seen).length > 400) H.seen = {};
    }
    // ---------- 公費醫療補助提案 ----------
    function proposal(w, H, d) {
        const P = w.proposals; const ob = H.ob || {}; for (const k in ob) if (d - ob[k] > 30) delete ob[k]; if (!P?._createWith || H.medaid || d - (H.lastProp || -99) < 30 || Object.keys(ob).length < 3) return; // 近 30 天有三個以上的人付不起
        if ((P.items || []).some(p => p.kind === 'medaid' && ['open', 'shelved', 'approved'].includes(p.status))) return;
        if ((w.stockpile?.get?.('silver') || 0) < 300) return;
        const all = npcs(w); const who = all.find(a => a.job?.key === 'doctor') || all.find(a => ails(w, a).some(x => x.owed)); if (!who) return;
        H.lastProp = d;
        const cand = { kind: 'medaid', key: 'medaid:' + d, jobs: [], make: () => ({ kind: 'medaid', key: 'medaid:' + d, tk: '公費醫療補助', tp: {}, dk: '{who}說最近好幾個人病了卻付不起醫藥費，只能拖著。提議公庫幫付不起的人出一半醫藥費。', dp: { who: who.name }, cost: {}, category: 'welfare', jobBias: ['doctor'] }) };
        return P._createWith(w, d, cand, who);
    }
    function vote(w, p, a) { const cash = WL() ? WL().get(w, a) : 50; let s = (cash < 40 ? 2 : 0) - (cash > 250 ? 2 : 0) + (a.job?.key === 'doctor' ? 2 : 0) + (ails(w, a).length ? 2 : 0) + (trait(a, 'kind') ? 1 : 0) + (Math.random() - 0.5) * 2; return { v: s > 0 ? 'for' : 'against', why: cash > 250 ? 'purse' : 'welfare' }; }
    function setAid(w) { S(w).medaid = true; log(w, '🏥 公費醫療補助上路：付不起醫藥費的人，公庫幫出一半。', {}); return t('公費醫療補助上路'); }
    // ---------- 每天 ----------
    function daily(w) {
        if (!w.observerMode) return; const H = S(w), d = day(w); if (H.lastDay === d) return; H.lastDay = d;
        const all = npcs(w); const winter = w.clock?.season === '冬季' || w.clock?.season === 'winter';
        heredity(w, all, H);
        for (const a of all) natural(w, a, d, winter, H);
        contagion(w, all, H); fights(w, all, H); progress(w, all, H, d);
        const alive = npcs(w); treat(w, alive, H, d); queue(w, alive, H, d); aids(w, alive, H); proposal(w, H, d);
    }
    // ---------- 給畫面與 AI ----------
    function view(w) {
        const H = S(w); const all = npcs(w);
        const patients = all.filter(a => ails(w, a).length).map(a => ({ id: a.agentId, name: t(a.name), ails: ails(w, a).map(x => ({ p: x.p, k: x.k, s: x.s })) }));
        const disabled = all.filter(a => PARTS.some(p => eff(w, a, p) < 50)).length;
        const avgLife = (() => { const g = (w.lifecycle?.graveyard || []).slice(-20); return g.length ? Math.round(g.reduce((s, x) => s + (x.age || 0), 0) / g.length) : null; })();
        return { patients, disabled, queue: H.q.map(q => ({ name: t(w.agents[q.id]?.name || ''), p: q.p })), bank: H.bank.length, medaid: !!H.medaid, st: H.st, log: H.log.slice().reverse().slice(0, 6), avgLife, surgery: canSurgery(w), tx: { limb: transplantable(w, 'h'), organ: transplantable(w, 'c') }, flu: !!H.flu };
    }
    function agentView(w, a) { const b = body(w, a); return { parts: PARTS.map(p => ({ p, v: Math.round(b[p]), eff: Math.round(eff(w, a, p)) })), ails: ails(w, a).map(x => ({ p: x.p, k: x.k, s: x.s })), aids: (S(w).aid[a.agentId] || []).slice(), queued: S(w).q.some(q => q.id === a.agentId) }; }
    function brief(w, a) {
        if (!w.health) return ''; const b = body(w, a); const bad = PARTS.filter(p => b[p] < 70).map(p => `${t(PN[p])}${b[p] < 40 ? t('很差') : t('不太好')}`); const al = ails(w, a).map(x => `${t(PN[x.p])}${t(KN[x.k])}`);
        if (!bad.length && !al.length) return ''; return `${t('身體')}${t('：')}${[...al, ...bad].join(t('、'))}`;
    }
    function townBrief(w) { if (!w.health) return ''; const v = view(w); const n = v.patients.length; if (!n && !v.queue.length) return ''; return `${t('鎮上有 {n} 個病人').replace('{n}', n)}${v.queue.length ? t('，{n} 人等移植').replace('{n}', v.queue.length) : ''}${v.flu ? t('，風寒正在流行') : ''}`; }
    return { W: null, PARTS, PN, PI, KN, S, body, setPart, hurt, eff, ails, addAil, workMult, speed, sleepMult, deathMult, jobFit, pay, successRate, deathRisk, canSurgery, transplantable, surgery, onDeath, daily, view, agentView, brief, townBrief, vote, setAid, proposal, family };
})();

// ---------- 研究:第五時代「生技」(城市以上＋機械時代全部研究完＋研究院) ----------
(function () {
    if (typeof RESEARCH_TREE === 'undefined') return;
    if (typeof RESEARCH_ERAS !== 'undefined') RESEARCH_ERAS[5] = { name: '生技', icon: '🧬' };
    const ERA4 = Object.entries(RESEARCH_TREE).filter(([, d]) => d.era === 4).map(([k]) => k);
    Object.assign(RESEARCH_TREE, {
        microbiology: { era: 5, name: t('細菌學'), description: t('看見讓人生病的小東西，肺病與感染更好治'), cost: 10000, prerequisites: ERA4.slice(), effects: { healing_bonus: 1.1 }, unlocks: [] },
        antibiotics: { era: 5, name: t('抗生素'), description: t('術後感染幾乎消失，肺炎不再致命'), cost: 11000, prerequisites: ['microbiology'], effects: { healing_bonus: 1.15 }, unlocks: [] },
        immunology: { era: 5, name: t('免疫學'), description: t('讓身體接受別人的器官：心臟、肺也能移植'), cost: 12000, prerequisites: ['microbiology'], effects: {}, unlocks: [] },
        prosthetics: { era: 5, name: t('義肢工學'), description: t('機械義手義腳、人工心臟與人工肺'), cost: 12000, prerequisites: ['microbiology'], effects: {}, unlocks: [] },
        genetics: { era: 5, name: t('遺傳學'), description: t('看懂爸媽傳給孩子的體質，做遺傳諮詢'), cost: 13000, prerequisites: ['immunology'], effects: {}, unlocks: [] },
        regen_medicine: { era: 5, name: t('再生醫學'), description: t('在醫院培養器官，不必等人捐贈（很貴）'), cost: 14000, prerequisites: ['immunology', 'antibiotics'], effects: {}, unlocks: [] },
    });
    // 研究院:城市以上、研究完公立學校才能蓋;每天能用的研究點上限 40 → 80
    if (typeof BUILDING_TEMPLATES !== 'undefined') BUILDING_TEMPLATES.institute = { name: t('研究院'), description: t('高等學者的研究所，生技研究從這裡開始'), costs: { steel: 20, brick: 30, paper: 40, silver: 600 }, work: 60, effects: { research_cap: 40, research_bonus: 0.2 } };
    if (typeof RESEARCH_UNLOCKED_BY !== 'undefined') RESEARCH_UNLOCKED_BY.institute = ['public_schooling'];
    const tierOk = (w) => { try { return typeof TIERS === 'undefined' || TIERS.level(w) >= 2; } catch (e) { return true; } };
    const hasInst = (w) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === 'institute' || b.name === BUILDING_TEMPLATES?.institute?.name);
    HEALTH.bioOpen = (w) => !!w && tierOk(w) && hasInst(w);
    HEALTH.canBuild = (w, key) => key !== 'institute' || tierOk(w);
    if (typeof ResearchManager !== 'undefined') {
        const RM = ResearchManager.prototype; const _ga = RM.getAvailable;
        RM.getAvailable = function () { const out = _ga.call(this); const w = (typeof window !== 'undefined' && window.rimtownApp?.world) || HEALTH.W; if (!w || HEALTH.bioOpen(w)) return out; return out.filter(p => (p.era || 1) < 5 || (p.era || 1) >= 7 || !!RESEARCH_TREE[p.key]?.path); }; // v7.8.0 路線科技有自己的門檻
        const _sr = RM.startResearch;
        RM.startResearch = function (key) { const w = (typeof window !== 'undefined' && window.rimtownApp?.world) || HEALTH.W; const pe = this.projects[key]?.era || 1; if (pe >= 5 && pe < 7 && !RESEARCH_TREE[key]?.path && w && !HEALTH.bioOpen(w)) return false; return _sr.call(this, key); };
    }
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    hurt: { mood: -6, opinion: 0, days: 4, label: t('受傷了，很痛') },
    ill: { mood: -5, opinion: 0, days: 4, label: t('生病了，渾身不舒服') },
    cured: { mood: 8, opinion: 0, days: 5, label: t('病治好了') },
});
if (typeof PROPOSAL_KINDS !== 'undefined') PROPOSAL_KINDS.medaid = { icon: '🏥', label: '公費醫療' };
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) HEALTH.daily(w); } catch (e) { console.warn('[Health] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (p.kind === 'medaid') { const r = HEALTH.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) { try { HEALTH.onDeath(world, npc); } catch (e) {} return _kill.call(this, world, npc, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = HEALTH.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = HEALTH.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.health = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.health) { const H = this.health; d.health = { b: H.b, a: H.a, aid: H.aid, q: H.q, bank: H.bank, log: H.log, st: H.st, medaid: H.medaid || false, lastProp: H.lastProp || 0, flu: H.flu || 0, ob: H.ob || {} }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.health = (data?.health && typeof data.health === 'object') ? data.health : null; } catch (e) {} return r; };
}
