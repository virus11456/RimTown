// RimTown - sim-bio.js：v7.9.0 科技路線 🧬 基因生物
// 三個時代：🌾 育種（選種育種、藥理學、發酵工程、流行病學、疫苗量產）→ 💉 生技（細菌學、抗生素、免疫學、義肢工學、遺傳學、再生醫學、基因作物）
// → 🧬 基因（專屬：基因編輯、神話基因譜、基因穩定劑、延壽療法、合成生命）。第四、五時代大家都能研究，第六時代只有走基因生物的小鎮能研究。
// 生技要研究院、神話基因要基因實驗室（沿用 v7.4／v7.5 的門檻）。新建築：育種場、藥廠、種子庫。
// 社會問題跟著科技走（不看路線）：🟡 藥廠排污、實驗動物逃跑、基因檢測歧視、新藥副作用、育種失敗、長壽偏方騙子、生不出孩子的傳聞；
// 🟠 基因階級衝突、黑市改造出事、藥價風暴、抗藥性病菌；🔴 實驗室外洩（用災厄引擎自動跑一場疫情，不花神力）。
// 法律：生物安全法（外洩少三分之二、研究慢一成）、藥價管制（看診費打七五折，醫生少賺）、禁止基因作物、停止人體實驗（外洩後才會提，第六時代停擺）。
// 金流守恆：騙子收的錢從受害者錢包轉到騙子錢包；藥價管制只是看診時少付。存在 world.tech.bio。
'use strict';

const BIO = (function () {
    const X = () => TECH; // sim-tech.js 先載入
    const S = (w) => { const T = TECH.S(w); if (!T.bio || typeof T.bio !== 'object') T.bio = {}; const B = T.bio; B.risk = B.risk ?? 1; return B; };
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const T_ = () => TECH;
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const day = (w) => TECH.day(w);
    const lab = (w) => TECH.built(w, 'institute');
    const shock = (w, o) => { try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, o); } catch (e) {} };

    // ---------- 門檻:生技要研究院;神話基因要基因實驗室;停止人體實驗後第六時代停擺 ----------
    TECH.GATES.bio = (w, p, e) => {
        if (e === 5) return lab(w);
        if (e >= 6) { if (S(w).halt) return false; if (['myth_genome', 'gene_stabilizer'].includes(p.key)) return typeof MYTH === 'undefined' || MYTH.labOpen(w); }
        return true;
    };

    // ---------- 🟡🟠🔴 社會問題 ----------
    const ad = (w) => TECH.adults(w);
    const pick = (w, f) => TECH.pick(w, f); const pickN = (w, n, f) => TECH.pickN(w, n, f);
    const aff = (a, b, n) => TECH.aff(a, b, n);
    const mem = (w, a, k, p, imp) => TECH.mem(w, a, k, p, imp);
    const names = (arr) => TECH.names(arr);
    const owner = (w, a) => TECH.owner(w, a);
    const EVENTS = [
        { id: 'pharma_waste', path: 'bio', lv: 'minor', icon: '🧪', need: (w) => TECH.built(w, 'pharma_works'), run(w) {
            const f = pick(w, x => ['farmer', 'fisher'].includes(x.job?.key)); const o = pick(w, x => owner(w, x) && x !== f); if (!f) return null;
            f.moodModifier = (f.moodModifier || 0) - 4; if (o) { aff(f, o, -10); aff(o, f, -3); } mem(w, f, '藥廠的廢水流進河裡，魚都翻肚了。', {}, 6);
            return { k: o ? '🧪 藥廠排出的廢水把下游的河染成了綠色，{a}跑去找{b}理論。' : '🧪 藥廠排出的廢水把下游的河染成了綠色，{a}氣得直跺腳。', p: { a: f.name, b: o?.name || '' }, who: o ? [f, o] : [f] }; } },
        { id: 'lab_escape', path: 'bio', lv: 'minor', icon: '🐑', need: (w) => done(w, 'selective_breeding') && (lab(w) || TECH.built(w, 'breeding_farm')), run(w) {
            const f = pick(w, x => x.job?.key === 'farmer'); const r = pick(w, x => x.job?.key === 'researcher' && x !== f); if (!f) return null;
            const pl = (w.farm?.plots || []).find(p => p.state === 'growing'); if (pl) pl.state = 'withered'; if (r) aff(f, r, -8);
            const kid = TECH.npcs(w).find(x => (x.age ?? 30) < 12); if (kid) kid.moodModifier = (kid.moodModifier || 0) - 3;
            return { k: r ? '🐑 育種場的實驗羊跑了出來，把{a}的田吃掉一大片。{a}說都是{b}沒把柵欄關好。' : '🐑 育種場的實驗羊跑了出來，把{a}的田吃掉一大片。', p: { a: f.name, b: r?.name || '' }, who: r ? [f, r] : [f] }; } },
        { id: 'gene_discrim', path: 'bio', lv: 'minor', icon: '📋', need: (w) => done(w, 'genetics'), run(w) {
            for (const a of ad(w)) { for (const [id, rel] of Object.entries(a.relationships?.relationships || a.relationships?.map || {})) { const b = w.agents[id]; if (!b || b.isDead || (rel.romanticInterest || 0) < 30) continue; if (a.relationships?.getSpouse?.() === id) continue;
                try { a.relationships.getOrCreate(b.agentId, b.name).modifyRomantic?.(-30); } catch (e) {} b.moodModifier = (b.moodModifier || 0) - 5; aff(b, a, -12);
                mem(w, b, '{a}看了我的遺傳檢查報告之後，就不再跟我說話了。', { a: a.name }, 8); mem(w, a, '遺傳檢查說{b}家族有病，我不敢再往下走了。', { b: b.name }, 6);
                return { k: '📋 {a}看了{b}的遺傳檢查報告，說{b}家族有遺傳病，兩人的感情就這樣斷了。', p: { a: a.name, b: b.name }, who: [a, b] }; } }
            return null; } },
        { id: 'side_effect', path: 'bio', lv: 'minor', icon: '💊', need: (w) => done(w, 'pharmacology'), run(w) {
            const a = pick(w, () => true); if (!a) return null; const d = pick(w, x => x.job?.key === 'doctor' && x !== a);
            TECH.addAil(w, a, { p: 'e', k: 'disease', s: 1, dmg: 4 }, '新藥副作用'); if (d) aff(a, d, -5); mem(w, a, '吃了新藥頭暈眼花，以後不敢亂吃了。', {}, 5);
            return { k: d ? '💊 {a}吃了{b}開的新藥，頭暈眼花了一整天。' : '💊 {a}吃了新藥，頭暈眼花了一整天。', p: { a: a.name, b: d?.name || '' }, who: d ? [a, d] : [a] }; } },
        { id: 'breed_fail', path: 'bio', lv: 'minor', icon: '🥀', need: (w) => done(w, 'selective_breeding'), run(w) {
            const food = w.stockpile?.get?.('food') || 0; const n = Math.round(food * 0.06); if (n > 0) w.stockpile.consume('food', n, w.tickCount, t('育種失敗'), 'event');
            const f = pick(w, x => x.job?.key === 'farmer'); if (f) f.moodModifier = (f.moodModifier || 0) - 3;
            return { k: '🥀 一批新品種的作物全部枯死，存糧少了一些，農夫們搖頭說還是老品種可靠。', p: {}, who: f ? [f] : [] }; } },
        { id: 'quack', path: 'bio', lv: 'minor', icon: '🧴', need: (w) => done(w, 'genetics') || done(w, 'life_extension'), run(w) {
            if (typeof WALLET === 'undefined') return null; const v = pick(w, x => (x.age ?? 30) >= 55 && WALLET.get(w, x) >= 12); const q = pick(w, x => x !== v && (hasT(x, 'lazy') || hasT(x, 'abrasive') || hasT(x, 'charismatic')) && (x.age ?? 30) < 55); if (!v || !q) return null;
            const n = Math.min(15, Math.max(5, Math.round(WALLET.get(w, v) * 0.2))); if (!WALLET.pay(w, v, q, n, t('延壽藥'))) return null; S(w).quack = { v: v.agentId, q: q.agentId, d: day(w) };
            mem(w, v, '跟{q}買了延壽藥，花了 {n} 銀幣，希望有效。', { q: q.name, n }, 5); mem(w, q, '把染色的糖水當延壽藥賣給{v}。', { v: v.name }, 6);
            return { k: '🧴 {q}在市集賣「延壽祕藥」，{v}花了 {n} 銀幣買了一瓶。', p: { q: q.name, v: v.name, n }, who: [q, v] }; } },
        { id: 'omen', path: 'bio', lv: 'minor', icon: '🍼', need: (w) => done(w, 'synthetic_life'), run(w) {
            TECH.moodAll(w, -1); const m = pick(w, x => x.job?.key === 'doctor') || pick(w, () => true); if (m) mem(w, m, '這陣子出生的孩子少得奇怪。', {}, 6);
            return { k: '🍼 接生婆說這陣子出生的孩子少得奇怪，鎮上開始有人小聲議論。', p: {}, who: m ? [m] : [] }; } },
        // 🟠 中事
        { id: 'caste', path: 'bio', lv: 'mid', icon: '⚔️', need: (w) => done(w, 'gene_editing') && Object.keys(w.myth?.g || {}).length > 0, run(w) {
            const g = pick(w, x => !!w.myth?.g?.[x.agentId]); const p = pick(w, x => x !== g && !w.myth?.g?.[x.agentId] && (TECH.mythGroup(w, x) === 'pure' || TECH.devoutA(w, x) || hasT(x, 'abrasive'))) || pick(w, x => x !== g && !w.myth?.g?.[x.agentId]); if (!g || !p) return null;
            aff(g, p, -20); aff(p, g, -20); const loser = Math.random() < 0.5 ? g : p; TECH.addAil(w, loser, { p: 'h', k: 'injury', s: 1, dmg: 8 }, '打架受傷');
            for (const x of ad(w)) { if (x === g || x === p) continue; if (TECH.mythGroup(w, x) === 'pure') aff(x, g, -4); else if (TECH.mythGroup(w, x) === 'guild') aff(x, p, -4); }
            return { k: '⚔️ 改造過基因的{a}和{b}在市集吵起來，最後動手打架，{c}受了傷。鎮上分成兩邊，各自說對方先挑釁。', p: { a: g.name, b: p.name, c: loser.name }, who: [g, p] }; } },
        { id: 'black_clinic', path: 'bio', lv: 'mid', icon: '🩸', need: (w) => done(w, 'gene_editing'), run(w) {
            const a = pick(w, x => (x.age ?? 30) < 45 && (hasT(x, 'romantic') || hasT(x, 'jealous') || hasV(x, '冒險') || hasT(x, 'optimist'))) || pick(w, x => (x.age ?? 30) < 45); if (!a) return null;
            TECH.addAil(w, a, { p: Math.random() < 0.5 ? 'c' : 'e', k: 'disease', s: 2, dmg: 14 }, '黑市基因改造失敗'); const fam = (typeof MONEY !== 'undefined' ? MONEY.familyOf(w, a) : []).filter(f => f !== a);
            for (const f of fam) { mem(w, f, '{a}偷偷跑去地下診所改基因，差點沒命。', { a: a.name }, 8); aff(f, a, -3); } mem(w, a, '我想變得更好看、更強壯，結果在地下診所差點丟了命。', {}, 9);
            return { k: '🩸 {a}偷偷跑去地下診所改基因，手術失敗被抬了出來。家人又急又氣。', p: { a: a.name }, who: [a] }; } },
        { id: 'price_storm', path: 'bio', lv: 'mid', icon: '💸', need: (w) => TECH.built(w, 'pharma_works') && !S(w).price, run(w) {
            const poor = ad(w).filter(x => typeof WALLET !== 'undefined' && WALLET.get(w, x) < 20); for (const x of poor) x.moodModifier = (x.moodModifier || 0) - 4;
            const o = pick(w, x => owner(w, x)); if (o) for (const x of poor) aff(x, o, -8); S(w).pendPrice = day(w) + 1;
            return { k: '💸 藥廠一口氣把藥價漲了一倍，{n}這些窮人生了病也買不起藥。', p: { n: poor.length ? names(poor.slice(0, 3)) : t('不少人') }, who: poor.slice(0, 3) }; } },
        { id: 'superbug', path: 'bio', lv: 'mid', icon: '🦠', need: (w) => done(w, 'antibiotics'), run(w) {
            const hit = pickN(w, 2 + Math.floor(Math.random() * 2), () => true); if (!hit.length) return null; for (const a of hit) TECH.addAil(w, a, { p: 'l', k: 'disease', s: 2, dmg: 10 }, '抗藥性病菌');
            const d = pick(w, x => x.job?.key === 'doctor'); if (d) for (const a of hit) aff(a, d, -4); S(w).risk = Math.min(3, S(w).risk + 0.2);
            return { k: d ? '🦠 {n}得了一種抗生素治不好的病。有人說是{d}平常藥開太兇，才養出這種病菌。' : '🦠 {n}得了一種抗生素治不好的病。', p: { n: names(hit), d: d?.name || '' }, who: hit }; } },
        // 🔴 大災:實驗室外洩(自己的機率:一年 3%,徵兆越多越危險,生物安全法降到三分之一)
        { id: 'lableak', path: 'bio', lv: 'big', icon: '☣️', own: (w) => { const B = S(w); if (day(w) - (B.lastLeak ?? -999) < 120 || typeof CALAMITY === 'undefined' || CALAMITY.S(w).cur) return 0; return 0.03 / 60 * B.risk * (B.law ? 0.33 : 1); },
            need: (w) => lab(w) && (done(w, 'microbiology') || done(w, 'genetics')), run(w) { return leak(w); } },
    ];
    for (const e of EVENTS) TECH.EVENTS.push(e);
    function leak(w) {
        if (typeof CALAMITY === 'undefined') return null; const B = S(w); const d = day(w);
        const lv = done(w, 'gene_editing') ? 3 : done(w, 'genetics') ? 2 : 1;
        const sym = ['cough', 'fever', 'rash', 'delirium', 'joint', 'sleepy'].sort(() => Math.random() - 0.5).slice(0, 1 + lv);
        const spec = { name: t(rnd(['研究院熱', '綠疹病', '實驗室咳', '灰霧熱'])), route: lv >= 2 ? ['droplet', 'contact'] : ['contact'], sym, latency: 'mid', speed: lv >= 3 ? 'fast' : 'mid', length: 'mid', lethal: lv >= 3 ? 'high' : lv >= 2 ? 'mid' : 'low', resist: lv >= 2 ? 'on' : 'off' };
        const zero = TECH.pick(w, x => x.job?.key === 'researcher') || TECH.pick(w, () => true); if (!zero) return null;
        const r = CALAMITY.release(w, spec, zero.agentId, { natural: true, cause: t('實驗室外洩') }); if (!r?.ok) return null;
        B.lastLeak = d; B.risk = 1; B.st = B.st || {}; B.st.leak = (B.st.leak || 0) + 1; if (Math.random() < 0.6) B.pendHalt = d + 6;
        const T = TECH.S(w); T.lastBig = Math.max(T.lastBig ?? -999, d - 60); // 外洩不擋核災的冷卻太久
        T.mk[zero.agentId] = 'leak0';
        mem(w, zero, '研究院的樣本管破了，是我手上的那一管。', {}, 9);
        return { k: '☣️ 研究院的樣本管破裂，{n}流了出來！第一個發病的是研究員{a}。', p: { n: spec.name, a: zero.name }, who: [zero], imp: 10, blame: zero, sev: 2 };
    }

    // ---------- 法律 ----------
    const LAW = { bio_safety: { icon: '📋', label: '生物安全法' }, bio_price: { icon: '💊', label: '藥價管制' }, bio_gmban: { icon: '🌾', label: '禁止基因作物' }, bio_halt: { icon: '✋', label: '停止人體實驗' } };
    function lawDaily(w) {
        const B = S(w); const T = TECH.S(w); const d = day(w); const A = ad(w); if (!A.length) return;
        const recent = T.inc.some(x => d - x[0] <= 25 && x[1] !== 'minor' && TECH.EVENTS.find(e => e.id === x[2])?.path === 'bio');
        const top = (f) => A.slice().sort((x, y) => f(y) - f(x))[0];
        if (!B.law && done(w, 'microbiology') && !TECH.busy(w, 'bio_safety') && d - (B.lastLaw ?? -99) >= 25 && (B.risk >= 1.4 || recent)) {
            B.lastLaw = d; TECH.propose(w, 'bio_safety', 'bio', top(a => (a.job?.key === 'doctor' ? 3 : 0) + (TECH.famHurt(w, a) ? 2 : 0) + (hasT(a, 'pessimist') ? 1 : 0)), '制定生物安全法', '{who}說研究院最近狀況不斷，提議訂生物安全法：危險樣本雙人上鎖、研究員出入要消毒。研究會慢一點，但外洩的機會降到三分之一。', {}, 'welfare');
        }
        if (B.pendPrice && d >= B.pendPrice && !B.price && !TECH.busy(w, 'bio_price')) {
            B.pendPrice = null; const who = top(a => (typeof WALLET !== 'undefined' && WALLET.get(w, a) < 20 ? 2 : 0) + (TECH.sickish(w, a) ? 2 : 0) + (hasT(a, 'kind') ? 1 : 0));
            TECH.propose(w, 'bio_price', 'bio', who, '藥價管制', '{who}說藥價貴到窮人生病只能硬撐，提議管制藥價：看診和買藥一律打七五折，藥廠和醫生少賺一點。', {}, 'welfare');
        }
        if (done(w, 'gm_crops') && !B.gmban && !TECH.busy(w, 'bio_gmban') && d - (B.lastGm ?? -99) >= 40 && Math.random() < 0.04) {
            const who = A.find(a => hasV(a, '自然')) || A.find(a => TECH.devoutA(w, a)); if (who) { B.lastGm = d; TECH.propose(w, 'bio_gmban', 'bio', who, '禁止基因作物', '{who}說基因作物違反自然、天曉得吃了會怎樣，提議全面禁種。產量會掉回去，但大家吃得安心。', {}, 'welfare'); }
        }
        if (B.pendHalt && d >= B.pendHalt && !B.halt && !TECH.busy(w, 'bio_halt') && !(typeof CALAMITY !== 'undefined' && CALAMITY.S(w).cur && CALAMITY.S(w).cur.day > d - 3)) {
            B.pendHalt = null; const who = A.find(a => a._calLoss && d - a._calLoss < 60) || A.find(a => TECH.devoutA(w, a)) || A.find(a => a.job?.key === 'doctor');
            if (who) TECH.propose(w, 'bio_halt', 'bio', who, '停止人體實驗', '{who}說研究院外洩害了這麼多人，提議停止所有基因編輯和人體實驗：第六時代的研究全部停擺。研究出來的東西照留。', {}, 'welfare');
        }
    }
    function setLaw(w, kind) {
        const B = S(w); const d = day(w);
        if (kind === 'bio_safety') { B.law = d; TECH.log(w, '📋 生物安全法上路：危險樣本雙人上鎖，外洩的機會降到三分之一，研究也慢了一點。', {}); TECH.news(w, '📋 生物安全法上路', {}, 7, []); return t('生物安全法上路'); }
        if (kind === 'bio_price') { B.price = d; TECH.log(w, '💊 藥價管制上路：看診和買藥一律打七五折。', {}); TECH.news(w, '💊 藥價管制上路', {}, 7, []); return t('藥價管制上路'); }
        if (kind === 'bio_gmban') { B.gmban = d; try { w.buildings?.recomputeEffects?.(w); } catch (e) {} TECH.log(w, '🌾 禁止基因作物：田裡改回種老品種，產量掉了一些。', {}); TECH.news(w, '🌾 小鎮禁種基因作物', {}, 7, []); return t('禁種基因作物'); }
        if (kind === 'bio_halt') { B.halt = d; const R = w.research; if (R?.current && TECH.onPath(R.current, 'bio') && (R.projects[R.current]?.era || 1) >= 6) { R.projects[R.current].status = 'available'; R.current = null; } TECH.log(w, '✋ 停止人體實驗：基因編輯、延壽、合成生命的研究全部停擺。', {}); TECH.news(w, '✋ 小鎮停止人體實驗', {}, 8, []); for (const a of ad(w)) { if (a.job?.key === 'researcher') mem(w, a, '人體實驗被禁了，研究院裡一半的計畫都停了。', {}, 6); } return t('第六時代的研究停擺了'); }
        return '';
    }
    function vote(w, p, a) {
        const B = S(w); const k = a.job?.key; const rich = typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 50; let s = 0, why = 'gut';
        const fam = TECH.famHurt(w, a); const leakHurt = TECH.S(w).mk[a.agentId] === 'leak0' || (a._calLoss && day(w) - a._calLoss < 90);
        if (p.kind === 'bio_safety') { s = 0.3 + (k === 'doctor' ? 2 : 0) + (fam ? 2 : 0) + (hasT(a, 'pessimist') ? 1 : 0) + (hasV(a, '家庭') ? 1 : 0) - (k === 'researcher' ? 1.2 : 0) - (owner(w, a) ? 1 : 0) - (TECH.S(w).path === 'bio' && TECH.prefer(w, a, 'bio') > 2 ? 0.6 : 0); why = s > 0 ? (fam ? 'tech_victim' : 'path_fear') : (k === 'researcher' ? 'tech_slow' : 'growth'); }
        else if (p.kind === 'bio_price') { s = (rich < 20 ? 2 : rich < 50 ? 0.6 : -0.8) + (TECH.sickish(w, a) ? 1.5 : 0) + (hasT(a, 'kind') ? 0.5 : 0) - (k === 'doctor' ? 1.5 : 0) - (owner(w, a) ? 1.2 : 0) - (hasT(a, 'greedy') ? 1 : 0); why = s > 0 ? (rich < 20 ? 'bio_poor' : 'kind') : (k === 'doctor' || owner(w, a) ? 'boss' : 'gut'); }
        else if (p.kind === 'bio_gmban') { const food = w.stockpile?.get?.('food') || 0; s = (hasV(a, '自然') ? 2 : 0) + (TECH.devoutA(w, a) ? 1.5 : 0) + (TECH.S(w) && a.techStance === 'conservative' ? 1 : 0) - (k === 'farmer' ? 2 : 0) - (k === 'researcher' ? 1 : 0) - (food < ad(w).length * 3 ? 1.5 : 0) - 0.3; why = s > 0 ? (TECH.devoutA(w, a) ? 'bio_god' : 'bio_nature') : (k === 'farmer' ? 'path_fit' : 'bio_hunger'); }
        else if (p.kind === 'bio_halt') { s = (leakHurt ? 4 : 0) + (TECH.devoutA(w, a) ? 1.5 : 0) + (k === 'doctor' ? 0.5 : 0) + (hasT(a, 'pessimist') ? 0.5 : 0) - (k === 'researcher' ? 2 : 0) - (TECH.mythGroup(w, a) === 'guild' ? 2 : 0) - (TECH.sickish(w, a) ? 1.5 : 0) - 0.5; why = s > 0 ? (leakHurt ? 'tech_victim' : TECH.devoutA(w, a) ? 'bio_god' : 'path_fear') : (TECH.sickish(w, a) ? 'bio_cure' : k === 'researcher' ? 'tech_slow' : 'growth'); }
        s += Math.random() - 0.5; return { v: s > 0 ? 'for' : 'against', why };
    }

    // ---------- 每天:法律、藥廠做藥 ----------
    function daily(w) {
        if (!w?.research) return; const B = S(w); lawDaily(w);
        if (TECH.built(w, 'pharma_works') && (w.stockpile?.get?.('herbs') || 0) >= 2) { w.stockpile.consume('herbs', 2, w.tickCount, t('藥廠'), 'production'); w.stockpile.add('medicine', 1, w.tickCount, t('藥廠')); }
        // 騙子被拆穿(過了幾天,受害者發現沒效)
        const q = B.quack; if (q && day(w) - q.d >= 4) { B.quack = null; const v = w.agents[q.v], k = w.agents[q.q]; if (v && k && !v.isDead && !k.isDead && Math.random() < 0.6) { aff(v, k, -25); mem(w, v, '{q}賣的延壽藥根本是糖水，我被騙了。', { q: k.name }, 8); for (const x of ad(w)) if (x !== v && x !== k && Math.random() < 0.3) aff(x, k, -6); TECH.log(w, '🧴 {v}發現{q}賣的延壽藥是染色的糖水，氣得到處跟人說。', { v: v.name, q: k.name }, v.name); } }
    }
    function brief(w, a) { const m = TECH.S(w).mk?.[a.agentId]; if (m === 'leak0') return t('研究院外洩那天，第一個發病的是我'); return ''; }
    return { S, EVENTS, leak, LAW, setLaw, vote, daily, brief };
})();

// ---------- 科技樹 ----------
(function () {
    if (typeof RESEARCH_TREE === 'undefined') return;
    const T = RESEARCH_TREE;
    // 現有的生技(v7.4)改成基因生物第五時代(大家都能研究);神話基因(v7.5)改成第六時代(基因生物專屬)
    for (const k of ['microbiology', 'antibiotics', 'immunology', 'prosthetics', 'genetics', 'regen_medicine']) if (T[k]) T[k].path = 'bio';
    for (const k of ['gene_editing', 'myth_genome', 'gene_stabilizer']) if (T[k]) T[k].path = 'bio';
    if (T.microbiology) T.microbiology.prerequisites = ['pharmacology', 'epidemiology']; // 以前要整個第四時代(含電子機械的機械科技)
    const has = (k) => !!T[k]; const pre = (...ks) => ks; // v8.0.0 先照寫的保留,整批加進去之後才濾掉不存在的(以前同一批裡互相依賴的前置會被濾掉)
    const ADD = {
        // ---- 🌾 育種(第四時代) ----
        selective_breeding: { era: 4, path: 'bio', name: t('選種育種'), description: t('一代一代挑最好的種子和牲口：作物、牲畜產量 +15%；可以蓋育種場'), cost: 5200, prerequisites: pre('crop_rotation', 'animal_husbandry'), effects: { farm_bonus: 1.15 }, unlocks: ['breeding_farm'] },
        pharmacology: { era: 4, path: 'bio', name: t('藥理學'), description: t('知道藥為什麼有效：藥效 +15%；可以蓋藥廠'), cost: 5600, prerequisites: pre('herbalism', 'chemistry'), effects: { healing_bonus: 1.15 }, unlocks: ['pharma_works'] },
        fermentation: { era: 4, path: 'bio', name: t('發酵工程'), description: t('酵母和菌種聽人使喚：存糧壞得比較慢、倉庫多放一些'), cost: 5000, prerequisites: pre('brewing'), effects: { food_decay: -0.15, storage_bonus: 1.1 }, unlocks: [] },
        epidemiology: { era: 4, path: 'bio', name: t('流行病學'), description: t('從病人的分布找出病源：疫情比較早被發現，隔離也比較有效'), cost: 6000, prerequisites: pre('sanitation', 'scientific_method'), effects: { healing_bonus: 1.05 }, unlocks: [] },
        mass_vaccine: { era: 4, path: 'bio', name: t('疫苗量產'), description: t('疫苗不再一劑一劑手工做：發生疫情時，研究疫苗快三成'), cost: 6600, prerequisites: pre('vaccination', 'pharmacology'), effects: { healing_bonus: 1.05 }, unlocks: [] },
        // ---- 💉 生技(第五時代) ----
        gm_crops: { era: 5, path: 'bio', name: t('基因作物'), description: t('改寫作物的基因：糧食 +25%、不怕乾旱；可以蓋種子庫。重視自然的人會反對'), cost: 12500, prerequisites: pre('genetics', 'selective_breeding'), effects: { farm_bonus: 1.25, drought_resistance: 0.5 }, unlocks: ['seed_vault'] },
        // ---- 🧬 基因(第六時代,專屬) ----
        life_extension: { era: 6, path: 'bio', name: t('延壽療法'), description: t('修補老化的細胞：老死的年紀晚十五歲，老人還能做事；但人口變老、遺產晚交'), cost: 21000, prerequisites: pre('regen_medicine', 'gene_editing'), effects: { healing_bonus: 1.1 }, unlocks: [] },
        synthetic_life: { era: 6, path: 'bio', name: t('合成生命'), description: t('從零寫出一個生命：生產力達到頂點……但有人說，自然開始不聽話了'), cost: 26000, prerequisites: pre('gene_stabilizer', 'life_extension'), effects: { farm_bonus: 1.1, research_bonus: 0.1, healing_bonus: 1.1 }, unlocks: [] },
    };
    Object.assign(T, ADD); for (const k of Object.keys(ADD)) T[k].prerequisites = T[k].prerequisites.filter(has);
    if (typeof RESEARCH_UNLOCKED_BY !== 'undefined') { RESEARCH_UNLOCKED_BY.breeding_farm = ['selective_breeding']; RESEARCH_UNLOCKED_BY.pharma_works = ['pharmacology']; RESEARCH_UNLOCKED_BY.seed_vault = ['gm_crops']; }
    if (typeof BUILDING_TEMPLATES !== 'undefined') Object.assign(BUILDING_TEMPLATES, {
        breeding_farm: { name: t('育種場'), description: t('挑種、配種的地方，田裡收成更好'), costs: { wood: 40, stone: 20, silver: 250 }, work: 35, effects: { farm_bonus: 0.1 } },
        pharma_works: { name: t('藥廠'), description: t('把藥草做成藥（每天兩份藥草換一份藥）；廢水會流進河裡'), costs: { brick: 30, steel: 10, stone: 20, silver: 450 }, work: 45, effects: { healing_bonus: 0.1 } },
        seed_vault: { name: t('種子庫'), description: t('把每一種作物的種子封存起來：抵擋饑荒；大災之後農業的學問也保得住'), costs: { stone: 60, brick: 20, silver: 350 }, work: 40, effects: { food_capacity: 50, drought_resistance: 0.2 } },
    });
    if (typeof PROPOSAL_JOB_BUILDINGS !== 'undefined') { const add = (j, ks) => { PROPOSAL_JOB_BUILDINGS[j] = [...(PROPOSAL_JOB_BUILDINGS[j] || []), ...ks]; }; add('farmer', ['breeding_farm', 'seed_vault']); add('doctor', ['pharma_works']); add('researcher', ['breeding_farm']); }
    if (typeof TECH_IDEAS !== 'undefined') Object.assign(TECH_IDEAS, {
        selective_breeding: { idea: '好種子配好種子，下一代更好', c: 0.3 },
        gm_crops: { idea: '改了基因的作物也能吃', c: 0.8 },
        gene_editing: { idea: '人的基因也可以改', c: 1.0 },
        life_extension: { idea: '人不一定要老', c: 0.9 },
    });
})();

if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, BIO.LAW);
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { bio_family: '家人生病，想要更好的醫藥', bio_life: '想活得更久、更健康', bio_god: '這是在扮演神', bio_poor: '自己買不起藥', bio_nature: '違反自然', bio_hunger: '糧食會不夠', bio_cure: '還指望新療法治病' });
// 基因作物被禁:效果不算
if (typeof BuildingManager !== 'undefined') {
    const BM = BuildingManager.prototype; const _rc = BM.recomputeEffects;
    BM.recomputeEffects = function (world) { const eff = _rc.call(this, world); if (world?.tech?.bio?.gmban && world.research?.projects?.gm_crops?.status === 'complete') { eff.farm_bonus = (eff.farm_bonus || 0) - 0.25; eff.drought_resistance = (eff.drought_resistance || 0) - 0.5; } this.activeEffects = eff; return eff; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) BIO.daily(w); } catch (e) { console.warn('[Bio] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (BIO.LAW[p.kind]) { const r = BIO.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = BIO.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
}
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {});
if (typeof window !== 'undefined') window.BIO = BIO;
