// RimTown - sim-tech.js：v7.8.0 科技路線（⚙️ 電子機械）；v7.9.0 加上 🧬 基因生物（sim-bio.js）、路線大辯論（多選一）
// v7.9.0 規則：每條路線分三個時代（第四～六時代）。第四、五時代是「基礎」——不管有沒有選路線、選哪條，大家都能用原價研究；
// 第六時代才是路線「專屬」，只有走那條路線的小鎮能研究。主線工坊時代研究到 75% 時開「路線大辯論」：所有路線＋維持傳統一起投票（多選一）。
// 電子機械：機械 → 電力（核分裂、微電子、精密製造、機器人、核融合）→ 太空（專屬：火箭、核子武器、衛星、太空站、量子電腦、AI 全智能體）。
// 時代門檻：該路線上一個時代研究到 75%，第五時代要城市、第六時代要王都。研究點不再空等（沒在研究時先存著，下一項開始時補進去）。
// 學者自己挑研究時先挑最早的時代、自己路線的科技；全部研究完開放可以一直研究的「精進改良」。
// 路線帶來的社會問題分三級：🟡 小事（一年六到八次：機器夾傷、停電、老師傅跟不上、工廠廢水…）、
// 🟠 中事（一年一兩次：自動化裁員、砸機器、輻射外洩、AI 監控爭議）、🔴 大災（核災：基本 3%／年，徵兆越多越危險，核安法降到三分之一）。
// 機器搶工作：生產線、機器人、AI 讓部分職業的職缺變少（就業市場每週照這個裁員、不再補人）。
// 核災之後鎮民會提「廢核」公投；核安法通過會讓研究慢一點，老闆與研究員反對、醫生與顧家的人支持。
// v7.9.0 社會問題跟著科技走、不跟路線走：任何小鎮蓋了核電廠都可能核災。
// 存在 world.tech；不動銀幣（銀幣守恆），損失都是物資、建築、人命與搬走的人。
'use strict';

const TECH = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 18 && !(w.isAway?.(a.agentId)));
    const log = (w, k, p, who) => { try { w.logMessageT?.('research', k, p || {}, who); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('event', fill(k, p), imp || 7, names || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp || 5, []); } catch (e) {} };
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const W = () => (typeof window !== 'undefined' && window.rimtownApp?.world) || TECH.W;
    const tierOf = (w) => { try { return typeof TIERS === 'undefined' ? 3 : TIERS.level(w); } catch (e) { return 3; } };
    const BT = () => (typeof BUILDING_TEMPLATES !== 'undefined' ? BUILDING_TEMPLATES : {});
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k || b.name === BT()[k]?.name);
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const wal = (w, a) => (typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 50);
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const stance = (w, a) => a.techStance || (w.ideaSystem?.stanceLabel ? w.ideaSystem.stanceLabel(w, a) : 'moderate');

    // ---------- 路線 ----------
    const PATHS = {
        electro: {
            icon: '⚙️', name: '電子機械', short: '工廠、電力、核能，最後飛向太空',
            pro: '生產力最高：機器替人做粗活，研究越來越快',
            con: '機器會搶走工作，核電一出事就是大災',
            stages: { 4: { name: '機械', icon: '🏭' }, 5: { name: '電力', icon: '⚡' }, 6: { name: '太空', icon: '🚀' } },
        },
        // v7.9.0 基因生物(科技、事件、法律在 sim-bio.js)
        bio: {
            icon: '🧬', name: '基因生物', short: '育種、醫藥、生命工程',
            pro: '人比較健康長壽、糧食大增產，醫生和農夫最吃香',
            con: '貧富差距變成基因差距、跟信仰衝突，實驗室可能外洩',
            stages: { 4: { name: '育種', icon: '🌾' }, 5: { name: '生技', icon: '💉' }, 6: { name: '基因', icon: '🧬' } },
        },
    };
    const PATH_KEYS = () => Object.keys(PATHS);
    const REFINE = 'refine';
    const pathsOf = (key) => { const d = (typeof RESEARCH_TREE !== 'undefined') ? RESEARCH_TREE[key] : null; const p = d?.path; return !p ? [] : Array.isArray(p) ? p : [p]; };
    const onPath = (key, P) => pathsOf(key).includes(P);
    // 某時代(主線:沒有路線的科技)研究完的比例
    function ratio(R, pred) { let n = 0, d = 0; for (const p of Object.values(R?.projects || {})) { if (p.key === REFINE || !pred(p)) continue; n++; if (p.status === 'complete') d++; } return n ? d / n : 0; }
    const mainRatio = (R, era) => ratio(R, p => (p.era || 1) === era && !pathsOf(p.key).length);
    const stageRatio = (R, P, st) => ratio(R, p => (p.era || 1) === st && onPath(p.key, P));
    const GATE = 0.75;

    function S(w) {
        if (!w.tech || typeof w.tech !== 'object') w.tech = {};
        const T = w.tech; T.inc = T.inc || []; T.st = T.st || { minor: 0, mid: 0, big: 0, laid: 0, died: 0, left: 0 }; T.mk = T.mk || {}; T.risk = T.risk ?? 1; T.ref = T.ref || 0; T.tries = T.tries || 0;
        TECH.W = w; return T;
    }
    const pathOf = (w) => w?.tech?.path || null;

    // ---------- 研究:門檻、成本、自動挑選 ----------
    // v7.9.0 第四、五時代:誰都能研究(看該路線上一個時代的進度與城鎮等級);第六時代:只有走這條路線的小鎮
    const GATES = {}; // 路線自己的額外門檻(基因生物:第五時代要研究院、神話基因要基因實驗室)
    function gateOk(w, p) {
        const ps = pathsOf(p.key); if (p.key === REFINE) return true; if (!ps.length || !w) return true;
        const P = pathOf(w); const R = w.research; const e = p.era || 1;
        const own = P && ps.includes(P) ? P : ps[0];
        if (e >= 6 && !(P && ps.includes(P))) return false; // 專屬
        let ok = e <= 4 ? mainRatio(R, 3) >= GATE : e === 5 ? stageRatio(R, own, 4) >= GATE && tierOf(w) >= 2 : stageRatio(R, own, 5) >= GATE && tierOf(w) >= 3;
        if (ok && GATES[own]) ok = GATES[own](w, p, e);
        return ok;
    }
    const exclusive = (key) => { const d = (typeof RESEARCH_TREE !== 'undefined') ? RESEARCH_TREE[key] : null; return !!d?.path && (d.era || 1) === 6; };
    // v7.9.0 基礎科技大家都是原價(以前別條路線要兩倍以上);專屬科技別的路線根本不能研究
    function costOf(w, key) {
        const base = (typeof RESEARCH_TREE !== 'undefined' ? RESEARCH_TREE[key]?.cost : 0) || 0;
        if (key === REFINE) return Math.round(20000 * Math.pow(1.25, S(w).ref));
        return base;
    }
    function recost(w) { const R = w?.research; if (!R) return; for (const p of Object.values(R.projects)) if (p.status !== 'complete') p.cost = costOf(w, p.key); }
    // 學者自己挑:最早的時代、自己路線優先(以前完全隨機,工坊時代都開始了還有拓荒的沒研究)
    function autoPick(R, w) {
        const av = R.getAvailable(); if (!av.length) return null; const P = pathOf(w);
        const score = (p) => (p.key === REFINE ? 99 : (p.era || 1) * 10) + (pathsOf(p.key).length && P && !onPath(p.key, P) ? 6 : 0) + Math.random() * 3; // 自己路線的先研究
        return av.slice().sort((a, b) => score(a) - score(b))[0];
    }
    // 提案權重:別條路線的少提、早期的多提
    function pickWeight(w, p) { const P = pathOf(w); if (p.key === REFINE) return 0.4; if (pathsOf(p.key).length && P && !onPath(p.key, P)) return 0.6; return 1; }
    // 核安法:電子機械的高階研究慢一成;生物安全法:基因生物的高階研究慢一成
    function speedOf(w, p) { const T = w?.tech; if (!T || !p || (p.era || 1) < 5) return 1; let m = 1; if (T.law && onPath(p.key, 'electro')) m *= 0.9; if (T.bio?.law && onPath(p.key, 'bio')) m *= 0.9; return m; }

    // ---------- 機器搶工作:職缺倍率 ----------
    const AUTO = { mechanized_farming: { farmer: 0.9 }, assembly_line: { tailor: 0.8, blacksmith: 0.85, carpenter: 0.9 }, robotics: { farmer: 0.9, miner: 0.9, cook: 0.9 }, ai_agent: { trader: 0.85 } };
    function jobMult(w, k) { let m = 1; for (const [tk, map] of Object.entries(AUTO)) if (map[k] && done(w, tk)) m *= map[k]; return Math.max(0.5, m); }
    const automatable = (w) => { const out = new Set(); for (const [tk, map] of Object.entries(AUTO)) if (done(w, tk)) for (const k of Object.keys(map)) out.add(k); return out; };

    // ---------- 路線投票 ----------
    // v7.9.0 家人生病、殘疾,或在疫情裡失去家人
    const sickish = (w, b) => { try { if (typeof HEALTH === 'undefined' || !w.health) return false; if ((HEALTH.ails(w, b) || []).length) return true; const B = HEALTH.body(w, b); return Object.values(B).some(v => v < 45); } catch (e) { return false; } };
    function famHurt(w, a) { if (a._calLoss && day(w) - a._calLoss < 240) return true; try { const fam = typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; return fam.some(f => f !== a && sickish(w, f)); } catch (e) { return false; } }
    const devoutA = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const mythGroup = (w, a) => { try { return typeof MYTHSOC !== 'undefined' ? MYTHSOC.groupOf(w, a) : null; } catch (e) { return null; } };
    function preferBio(w, a) {
        let s = 0; const k = a.job?.key;
        s += ({ doctor: 2, farmer: 1, researcher: 1, cook: 0.3, priest: -2 })[k] || 0;
        const st = stance(w, a); s += st === 'progressive' ? 1 : st === 'conservative' ? -1.5 : 0;
        if (famHurt(w, a)) s += 1.5; if (sickish(w, a)) s += 1;
        if (hasV(a, '健康')) s += 1; if (hasV(a, '家庭')) s += 1; if (hasV(a, '傳統')) s -= 1; if (hasV(a, '自然')) s -= 0.5;
        if (devoutA(w, a)) s -= 1.5; const g = mythGroup(w, a); if (g === 'pure') s -= 2.5; else if (g === 'guild') s += 2;
        if (hasT(a, 'kind')) s += 0.3; if (hasT(a, 'pessimist')) s -= 0.3;
        const age = a.age ?? 30; if (age >= 55) s += 1; // 想活久一點(跟電子機械相反)
        return s;
    }
    function prefer(w, a, P) {
        if (P === 'bio') return preferBio(w, a);
        if (P !== 'electro') return 0;
        let s = 0; const k = a.job?.key;
        s += ({ researcher: 2, blacksmith: 1.5, trader: 1, carpenter: 0.5, miner: 0.5, guard: 0.5, mayor: 0.5, tailor: -1.2, priest: -1, farmer: -0.3 })[k] || 0;
        const st = stance(w, a); s += st === 'progressive' ? 2 : st === 'conservative' ? -2.5 : 0;
        if (hasV(a, '知識')) s += 1; if (hasV(a, '財富')) s += 1; if (hasV(a, '冒險')) s += 0.5; if (hasV(a, '自然')) s -= 1.5; if (hasV(a, '傳統')) s -= 1;
        if (hasT(a, 'optimist')) s += 0.5; if (hasT(a, 'pessimist')) s -= 0.5; if (hasT(a, 'hardworking') || hasT(a, 'lazy')) s += 0.4; if (hasT(a, 'ascetic')) s -= 0.5;
        const age = a.age ?? 30; if (age >= 55) s -= 1; else if (age < 30) s += 0.5;
        return s;
    }
    function busy(w, kind) { return (w.proposals?.items || []).some(p => p.kind === kind && ['open', 'shelved', 'approved'].includes(p.status)); }
    function propose(w, kind, key, who, tk, dk, dp, cat, tp, extra) {
        const P = w.proposals; if (!P?._createWith || !who) return null;
        const d = P._abs ? P._abs(w) : day(w);
        const cand = { kind, key: kind + ':' + d, jobs: [], make: () => Object.assign({ kind, key: kind + ':' + d, refKey: key, tk, tp: tp || {}, dk, dp: Object.assign({ who: who.name }, dp || {}), cost: {}, category: cat || 'culture', jobBias: [] }, extra || {}) };
        try { return P._createWith(w, d, cand, who); } catch (e) { console.warn('[Tech] propose', e); return null; }
    }
    // ---------- v7.9.0 路線大辯論:小鎮的吸引力(村民平均傾向+小鎮狀況) ----------
    const builtAny = (w, ks) => ks.filter(k => built(w, k)).length;
    function appeal(w, P) {
        const ad = adults(w); if (!ad.length) return 0;
        let s = ad.reduce((t2, a) => t2 + prefer(w, a, P), 0) / ad.length;
        const share = (f) => ad.filter(f).length / ad.length;
        if (P === 'electro') {
            if (share(a => a.job?.key === 'researcher') >= 0.08) s += 0.3; if ((w.prosperity?.prosperity || 0) >= 60) s += 0.3;
            if (share(a => owner(w, a)) >= 0.15) s += 0.2;
        } else if (P === 'bio') {
            try { const h = (w.calamity?.hist || [])[0]; if (h && day(w) - (h.end || 0) <= 180) s += h.died >= 3 ? 1 : h.died >= 1 ? 0.6 : 0.2; } catch (e) {}
            s += 0.25 * builtAny(w, ['clinic', 'hospital', 'institute']);
            if (share(a => sickish(w, a)) >= 0.15) s += 0.5;
            const food = w.stockpile?.get?.('food') || 0; if (food < ad.length * 3) s += 0.5;
            if (share(a => a.job?.key === 'farmer') >= 0.25) s += 0.3; if (share(a => (a.age ?? 30) >= 55) >= 0.25) s += 0.3;
        }
        return Math.round(s * 100) / 100;
    }
    const appeals = (w) => Object.fromEntries(PATH_KEYS().map(P => [P, appeal(w, P)]));
    // 這張提案的選項裡,這個村民最想走哪條(都不想走就是維持傳統)
    function bestOpt(w, a, opts) { let best = null, bs = -99; for (const P of opts || []) { const v = prefer(w, a, P); if (v > bs) { bs = v; best = P; } } return { P: best, s: bs }; }
    function tally(p) { const out = {}; for (const P of (p.opts || [p.refKey])) out[P] = 0; let keep = 0; for (const [id, v] of Object.entries(p.votes || {})) { if (v === 'for') { const P = p.pick?.[id] || p.refKey; if (P in out) out[P]++; } else keep++; } return { paths: out, keep }; }
    function pathDaily(w, T, d) {
        if (T.path) return;
        // 舊存檔、背景發展的城鎮:已經研究了某條路線的專屬科技 → 就是走這條路
        for (const P of PATH_KEYS()) if (Object.values(w.research?.projects || {}).some(p => onPath(p.key, P) && exclusive(p.key) && (p.status === 'complete' || p.status === 'researching'))) { choose(w, P, null, true); return; }
        if (mainRatio(w.research, 3) < GATE) return;
        for (const p of (w.proposals?.items || [])) if (p.kind === 'tech_path' && !p._counted && ['rejected', 'expired', 'failed'].includes(p.status)) { p._counted = true; T.tries++; T.nextDebate = d + 30; T.app0 = appeals(w); }
        if (busy(w, 'tech_path')) return;
        // 維持傳統之後 30 天再辯論;遇到大事(某條路線的吸引力大漲)可以提早(至少隔 10 天)
        const A = appeals(w);
        if (T.nextDebate != null && d < T.nextDebate) { const jump = T.app0 && PATH_KEYS().some(P => (A[P] || 0) - (T.app0[P] || 0) >= 0.8); if (!(jump && d - (T.lastProp ?? -99) >= 10)) return; }
        if (d - (T.lastProp ?? -99) < 8) return;
        const ranked = PATH_KEYS().sort((x, y) => A[y] - A[x]); const opts = ranked.filter((P, i) => i === 0 || A[P] >= -0.5);
        const top = ranked[0]; const who = adults(w).map(a => [a, prefer(w, a, top) + (a.job?.key === 'researcher' ? 0.5 : 0)]).sort((x, y) => y[1] - x[1])[0]?.[0]; if (!who) return; T.lastProp = d;
        const list = opts.map(P => `${PATHS[P].icon}${t(PATHS[P].name)}`).join(t('、'));
        const Pd = PATHS[top];
        const p = propose(w, 'tech_path', top, who, '科技路線大辯論：{list}，還是維持傳統？', T.tries ? '{who}又提了一次：小鎮該決定往後的路了。{who}最想走{name}——{short}。每個人投給自己想走的路線；都不想走就投反對，維持傳統。' : '{who}說工坊時代快研究完了，該決定小鎮往後的路。{who}最想走{name}——{short}。選項有：{list}。每個人投給自己想走的路線；都不想走就投反對，維持傳統。', { name: Pd.name, short: Pd.short, list }, 'economy', { list }, { opts, pick: {}, app: A });
        if (p) { T.debate = d; log(w, '🗳️ 鎮上開始辯論科技路線：{who}提議走「{name}」，選項還有：{list}。', { who: who.name, name: Pd.name, list }, who.name); news(w, '🗳️ 科技路線大辯論：{list}，還是維持傳統？', { list }, 8, [who.name]); }
    }
    function winnerOf(w, prop) {
        if (!prop?.opts?.length) return prop?.refKey || null;
        // 投贊成卻沒選路線的(AI 投票):照他自己的傾向補上
        for (const [id, v] of Object.entries(prop.votes || {})) if (v === 'for' && !prop.pick?.[id]) { const a = w.agents[id]; if (a) (prop.pick || (prop.pick = {}))[id] = bestOpt(w, a, prop.opts).P; }
        const T2 = tally(prop).paths; const A = prop.app || {}; return Object.keys(T2).sort((x, y) => (T2[y] - T2[x]) || ((A[y] || 0) - (A[x] || 0)))[0];
    }
    function choose(w, P, prop, silent) {
        const T = S(w); if (T.path) return ''; if (prop?.opts) P = winnerOf(w, prop); const Pd = PATHS[P]; if (!Pd) return '';
        T.path = P; T.since = day(w); T.nextDebate = null;
        if (prop) { const tl = tally(prop); T.yes = tl.paths[P] || 0; T.no = tl.keep; T.tally = tl.paths; T.against = Object.entries(prop.votes || {}).filter(([id, v]) => v === 'against' || (prop.pick?.[id] && prop.pick[id] !== P)).map(([id]) => id).slice(0, 40); }
        recost(w);
        if (!silent) {
            const k = '{icon} 小鎮決定走「{name}」路線：{short}。';
            log(w, k, { icon: Pd.icon, name: Pd.name, short: Pd.short }); news(w, k, { icon: Pd.icon, name: Pd.name, short: Pd.short }, 9, []);
            for (const a of npcs(w)) { const s = prefer(w, a, P); const mine = prop?.pick?.[a.agentId]; mem(w, a, s > 0 ? '小鎮決定走{name}路線，我覺得這是對的。' : mine && mine !== P ? '小鎮決定走{name}路線，不是我投的那條，有點不甘心。' : '小鎮決定走{name}路線，我擔心以後的日子會變。', { name: Pd.name }, 6); }
        }
        return t('小鎮走上{name}路線').replace('{name}', t(Pd.name));
    }
    function voteRule(w, p, a) {
        let s = 0, why = 'gut';
        if (p.kind === 'tech_path') {
            const b = p.opts ? bestOpt(w, a, p.opts) : { P: p.refKey, s: prefer(w, a, p.refKey) }; s = b.s + (Math.random() - 0.5); const k = a.job?.key;
            if (s > 0 && p.opts) (p.pick || (p.pick = {}))[a.agentId] = b.P;
            why = s > 0 ? (b.P === 'bio' ? (famHurt(w, a) ? 'bio_family' : ({ doctor: 'path_fit', farmer: 'path_fit', researcher: 'path_fit' }[k] || 'bio_life')) : ({ researcher: 'path_fit', blacksmith: 'path_fit', trader: 'path_fit' }[k] || 'growth'))
                : (devoutA(w, a) && (p.opts || []).includes('bio') ? 'bio_god' : automatable(w).has(k) || k === 'tailor' ? 'path_job' : stance(w, a) === 'conservative' ? 'oldways' : 'path_fear');
        }
        else if (p.kind === 'tech_safety' || p.kind === 'tech_abandon') {
            const T = S(w); const hurt = T.mk[a.agentId]; const fam = hurt === 'bereaved' || hurt === 'rad';
            s = 0.3 + (a.job?.key === 'doctor' ? 2 : 0) + (hasT(a, 'pessimist') ? 1.5 : 0) + (hasV(a, '家庭') ? 1.2 : 0) + (hasV(a, '和平') || hasV(a, '自然') ? 1 : 0) + (fam ? 4 : 0)
                - (owner(w, a) ? 1.5 : 0) - (a.job?.key === 'researcher' ? 1.2 : 0) - (hasT(a, 'greedy') ? 1 : 0) - (stance(w, a) === 'progressive' ? 0.8 : 0) - (hasT(a, 'optimist') ? 0.5 : 0);
            if (p.kind === 'tech_abandon') s -= 0.6; // 廢核代價大
            const recent = T.inc.some(x => d0(w) - x[0] <= 30 && x[1] !== 'minor'); if (recent) s += 1;
            s += Math.random() - 0.5;
            why = s > 0 ? (fam ? 'tech_victim' : 'path_fear') : (owner(w, a) ? 'boss' : a.job?.key === 'researcher' ? 'tech_slow' : 'growth');
        } else if (p.kind === 'tech_unsafe') {
            s = (owner(w, a) ? 1.5 : 0) + (a.job?.key === 'researcher' ? 1.2 : 0) + (hasT(a, 'greedy') ? 0.8 : 0) - (a.job?.key === 'doctor' ? 1.5 : 0) - (hasT(a, 'pessimist') ? 1 : 0) - (S(w).mk[a.agentId] ? 3 : 0) + (Math.random() - 0.5) - 0.3;
            why = s > 0 ? (owner(w, a) ? 'boss' : 'tech_slow') : 'path_fear';
        }
        return { v: s > 0 ? 'for' : 'against', why };
    }
    const d0 = (w) => day(w);

    // ---------- 核安法、廢核 ----------
    const nukeOn = (w) => built(w, 'nuclear_plant') && !w.tech?.noNuke;
    function lawDaily(w, T, d) {
        const recentMid = T.inc.some(x => d - x[0] <= 20 && (x[1] === 'mid' || x[1] === 'big'));
        // 核安法:核分裂研究出來、出現徵兆或中事
        if (!T.law && done(w, 'nuclear_fission') && !T.noNuke && !busy(w, 'tech_safety') && d - (T.lastLaw ?? -99) >= 25 && (T.risk >= 1.5 || recentMid)) {
            const who = adults(w).sort((x, y) => ((y.job?.key === 'doctor' ? 3 : 0) + (hasT(y, 'pessimist') ? 2 : 0) + (hasV(y, '家庭') ? 1 : 0)) - ((x.job?.key === 'doctor' ? 3 : 0) + (hasT(x, 'pessimist') ? 2 : 0) + (hasV(x, '家庭') ? 1 : 0)))[0];
            T.lastLaw = d; propose(w, 'tech_safety', 'nuke', who, '制定核安法', '{who}說核電廠最近狀況不斷，提議訂核安法：定期停機檢查、外圍不准住人。工廠得常停工、研究也會慢一點，但出大事的機會會降到三分之一。', {}, 'welfare');
        }
        // 放寬核安法:兩個月平安無事,老闆或研究員嫌麻煩
        if (T.law && !busy(w, 'tech_unsafe') && d - T.law >= 90 && !T.inc.some(x => d - x[0] <= 60 && x[1] !== 'minor') && d - (T.lastUnsafe ?? -99) >= 45 && Math.random() < 0.05) {
            const who = adults(w).find(a => owner(w, a)) || adults(w).find(a => a.job?.key === 'researcher'); if (who) { T.lastUnsafe = d; propose(w, 'tech_unsafe', 'nuke', who, '放寬核安法', '{who}說核電廠已經好幾個月平安無事，停機檢查讓工廠少賺、研究變慢，提議放寬核安法。', {}, 'economy'); }
        }
        // 廢核:核災後(七成)或輻射外洩後(兩成),由受害者家屬或醫生提
        if (T.pendAbandon && !T.noNuke && !busy(w, 'tech_abandon') && d >= T.pendAbandon) {
            T.pendAbandon = null; const fam = adults(w).filter(a => T.mk[a.agentId] === 'bereaved'); const who = fam[0] || adults(w).find(a => T.mk[a.agentId] === 'rad') || adults(w).find(a => a.job?.key === 'doctor') || adults(w).find(a => hasT(a, 'pessimist'));
            if (who) propose(w, 'tech_abandon', 'nuke', who, '廢核：關閉核電廠', fam.length ? '{who}在核災裡失去了家人。提議關閉核電廠、以後不准再蓋，研究出來的東西照留，但核電帶來的好處就沒了。' : '{who}說輻射外洩的人還在咳，提議趁早關閉核電廠、以後不准再蓋。', {}, 'welfare');
        }
    }
    function setLaw(w) { const T = S(w); T.law = day(w); log(w, '📋 核安法上路：核電廠定期停機檢查，出大事的機會降到三分之一，研究也慢了一點。', {}); news(w, '📋 核安法上路', {}, 7, []); return t('核安法上路'); }
    function unsetLaw(w) { const T = S(w); T.law = 0; log(w, '📋 核安法放寬了：工廠不再常停工，研究快一點——但風險也回來了。', {}); news(w, '📋 核安法放寬', {}, 6, []); return t('核安法放寬了'); }
    function abandon(w) {
        const T = S(w); if (T.noNuke) return ''; T.noNuke = day(w); T.risk = 1;
        const c = w.buildings?.completed || []; const i = c.findIndex(b => (b.buildingKey || b.key) === 'nuclear_plant' || b.name === BT().nuclear_plant?.name);
        if (i >= 0) { c.splice(i, 1); try { w.buildings.recomputeEffects(w); } catch (e) {} }
        log(w, '🌿 廢核通過：核電廠關閉，以後不再蓋核電廠。', {}); news(w, '🌿 小鎮廢核：核電廠關閉', {}, 8, []);
        for (const a of npcs(w)) { const s = T.mk[a.agentId] ? 1 : prefer(w, a, 'electro') > 1 ? -1 : 0; if (s) mem(w, a, s > 0 ? '核電廠終於關了，晚上睡得比較安心。' : '核電廠就這樣關了，鎮上的研究要慢下來了。', {}, 5); }
        return t('核電廠關閉了');
    }

    // ---------- 路線上的社會問題(三級) ----------
    const WORKJ = ['farmer', 'blacksmith', 'carpenter', 'miner', 'tailor', 'cook'];
    const addAil = (w, a, x, why) => { try { if (typeof HEALTH !== 'undefined') HEALTH.addAil(w, a, x, why); } catch (e) {} };
    const pick = (w, pred) => { const pool = adults(w).filter(pred); return pool.length ? rnd(pool) : null; };
    const pickN = (w, n, pred) => { const pool = adults(w).filter(pred); const out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; };
    const aff = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const moodAll = (w, n) => { for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + n; };
    const names = (arr) => arr.map(a => t(a.name)).join(t('、'));
    const EVENTS = [
        // 🟡 小事
        { id: 'injury', lv: 'minor', icon: '⚙️', need: (w) => done(w, 'steam_power') || done(w, 'machine_tools'), run(w) { const a = pick(w, x => WORKJ.includes(x.job?.key)); if (!a) return null; const s = Math.random() < 0.25 ? 2 : 1; addAil(w, a, { p: 'h', k: 'injury', s, dmg: 8 + s * 8 }, '被機器夾傷'); return { k: '⚙️ {a}的手被機器夾到，送去給醫生看。', p: { a: a.name }, who: [a] }; } },
        { id: 'blackout', lv: 'minor', icon: '⚡', need: (w) => done(w, 'electricity'), run(w) { moodAll(w, -2); return { k: '⚡ 全鎮停電了一整晚，大家摸黑吃飯，工坊也停了。', p: {}, who: [] }; } },
        { id: 'oldhand', lv: 'minor', icon: '👴', need: (w) => done(w, 'electricity') || done(w, 'assembly_line'), run(w) { const a = pick(w, x => (x.age ?? 30) >= 50 && x.job?.key && x.job.key !== 'mayor'); if (!a) return null; a.addThought?.('left_behind', w); mem(w, a, '新機器我怎麼學都學不會，年輕人一下就上手了。', {}, 6); return { k: '👴 老師傅{a}怎麼學都學不會新機器，被年輕人搶了位置，悶悶不樂。', p: { a: a.name }, who: [a] }; } },
        { id: 'waste', lv: 'minor', icon: '🏭', need: (w) => done(w, 'assembly_line') || done(w, 'internal_combustion'), run(w) { const f = pick(w, x => x.job?.key === 'farmer'); const o = pick(w, x => owner(w, x) && x !== f); if (!f) return null; f.moodModifier = (f.moodModifier || 0) - 4; if (o) { aff(f, o, -10); aff(o, f, -4); } return { k: o ? '🏭 工坊排出的廢水流進田裡，農夫{a}氣得跑去找{b}理論。' : '🏭 工坊排出的廢水流進田裡，農夫{a}氣得直跺腳。', p: { a: f.name, b: o?.name || '' }, who: o ? [f, o] : [f] }; } },
        { id: 'radio', lv: 'minor', icon: '📻', need: (w) => done(w, 'radio'), run(w) { const y = pick(w, x => (x.age ?? 30) < 30); const o = pick(w, x => (x.age ?? 30) >= 50); if (!y || !o) return null; aff(o, y, -5); return { k: '📻 {a}整天守著收音機，{b}嫌年輕人不做正事。', p: { a: y.name, b: o.name }, who: [y, o] }; } },
        { id: 'alarm', lv: 'minor', icon: '☢️', warn: true, need: (w) => nukeOn(w), run(w) { const T = S(w); T.risk = Math.min(3, T.risk + (T.law ? 0.1 : 0.25)); moodAll(w, -1); return { k: '☢️ 核電廠的警報響了一陣，工程師說只是小故障。', p: {}, who: [] }; } },
        // 🟠 中事
        { id: 'layoff', lv: 'mid', icon: '🤖', need: (w) => done(w, 'assembly_line') || done(w, 'robotics'), run(w) {
            const auto = automatable(w); const n = done(w, 'robotics') ? 1 + (Math.random() < 0.5 ? 1 : 0) : 1; // 每次一兩個人(職缺本身也會因機器變少)
            const hit = pickN(w, n, x => auto.has(x.job?.key) && !owner(w, x) && w.union?.leader !== x.agentId); if (!hit.length) return null; const T = S(w); const L = typeof LABOR !== 'undefined' ? LABOR.S(w) : null;
            for (const a of hit) { const j = a.job?.key; a.job = null; if (L) { L.jobless[a.agentId] = day(w); L.stats.laidOff = (L.stats.laidOff || 0) + 1; } T.mk[a.agentId] = T.mk[a.agentId] || 'laid'; T.st.laid++; a.addThought?.('laid_off', w); mem(w, a, '工坊換了新機器，我的活兒機器就做得來，我被裁掉了。', {}, 8); }
            return { k: '🤖 工坊換上新機器，{n}被裁員了——機器一台頂好幾個人。', p: { n: names(hit) }, who: hit };
        } },
        { id: 'smash', lv: 'mid', icon: '🔨', need: (w) => done(w, 'assembly_line') && Object.keys(S(w).mk).some(id => S(w).mk[id] === 'laid' && w.agents[id] && !w.agents[id].isDead), run(w) {
            const a = adults(w).find(x => S(w).mk[x.agentId] === 'laid' && !x.job) || adults(w).find(x => S(w).mk[x.agentId] === 'laid'); if (!a) return null;
            for (const [r, n] of [['tools', 4], ['steel', 6]]) { const have = w.stockpile?.get?.(r) || 0; const k = Math.min(have, n); if (k > 0) w.stockpile.consume(r, k, w.tickCount, t('機器被砸'), 'event'); }
            for (const o of adults(w).filter(x => owner(w, x))) aff(o, a, -25); mem(w, a, '我半夜跑去把搶走我飯碗的機器砸了。', {}, 8);
            return { k: '🔨 被機器搶了工作的{a}，半夜闖進工坊把機器砸了，老闆們氣炸了。', p: { a: a.name }, who: [a] };
        } },
        { id: 'leak', lv: 'mid', icon: '☢️', warn: true, need: (w) => nukeOn(w), run(w) {
            const T = S(w); T.risk = Math.min(3, T.risk + (T.law ? 0.15 : 0.4)); const hit = pickN(w, 2 + Math.floor(Math.random() * 3), () => true);
            for (const a of hit) { addAil(w, a, { p: 'l', k: 'disease', s: 1 + (Math.random() < 0.3 ? 1 : 0), dmg: 10 }, '吸到外洩的輻射'); T.mk[a.agentId] = T.mk[a.agentId] || 'rad'; }
            moodAll(w, -4); if (Math.random() < 0.2) T.pendAbandon = day(w) + 2;
            return { k: '☢️ 核電廠管線破裂，輻射外洩！{n}咳個不停，被送去看醫生。', p: { n: names(hit) }, who: hit };
        } },
        { id: 'watch', lv: 'mid', icon: '👁️', need: (w) => done(w, 'ai_agent'), run(w) {
            const free = adults(w).filter(x => hasV(x, '自由')); const g = adults(w).filter(x => x.job?.key === 'guard'); for (const a of free) a.moodModifier = (a.moodModifier || 0) - 4; for (const a of g) a.moodModifier = (a.moodModifier || 0) + 2;
            return { k: '👁️ AI 全智能體把每個人的行蹤都記下來了。守衛說這樣才安全，{n}說這是在監視人。', p: { n: free.length ? names(free.slice(0, 3)) : t('有人') }, who: free.slice(0, 3) };
        } },
        // 🔴 大災
        { id: 'meltdown', lv: 'big', icon: '☢️', need: (w) => nukeOn(w), run(w) { return meltdown(w); } },
    ];
    function meltdown(w) {
        const T = S(w); const d = day(w); const all = adults(w); if (all.length < 4) return null; const pop0 = npcs(w).length;
        // 死亡:在核電廠附近工作的人先
        const nD = 1 + Math.floor(Math.random() * 3); const dead = pickN(w, nD, x => ['miner', 'blacksmith', 'researcher', 'carpenter'].includes(x.job?.key)); while (dead.length < nD) { const x = pick(w, y => !dead.includes(y)); if (!x) break; dead.push(x); }
        const fam = new Set(); for (const a of dead) { for (const f of (typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : [])) fam.add(f); }
        for (const a of dead) { a._deathCause = t('核災'); try { w.lifecycle?._killNpc?.(w, a); } catch (e) {} T.st.died++; }
        for (const f of fam) if (!f.isDead) { T.mk[f.agentId] = 'bereaved'; f.addThought?.('meltdown_grief', w); mem(w, f, '核災奪走了我的家人。', {}, 9); }
        // 輻射病
        const rest = adults(w); const sick = pickN(w, Math.max(2, Math.round(rest.length * (0.25 + Math.random() * 0.15))), () => true);
        for (const a of sick) { addAil(w, a, { p: 'l', k: 'disease', s: 2, dmg: 15 }, '輻射病'); if (!T.mk[a.agentId]) T.mk[a.agentId] = 'rad'; }
        // 核電廠毀了、田地被污染、存糧不能吃
        const c = w.buildings?.completed || []; const i = c.findIndex(b => (b.buildingKey || b.key) === 'nuclear_plant' || b.name === BT().nuclear_plant?.name); if (i >= 0) { c.splice(i, 1); try { w.buildings.recomputeEffects(w); } catch (e) {} }
        for (const p of (w.farm?.plots || [])) if (p.state === 'growing' || p.state === 'ready') p.state = 'withered';
        const food = w.stockpile?.get?.('food') || 0; if (food > 0) w.stockpile.consume('food', Math.round(food * 0.3), w.tickCount, t('核災'), 'event');
        moodAll(w, -20); for (const a of npcs(w)) { a.addThought?.('meltdown_fear', w); if (!fam.has(a)) mem(w, a, '核電廠爆炸了，整個小鎮都籠罩在恐懼裡。', {}, 8); }
        // 搬走:有錢、有孩子的先走(窮人走不了)
        const alive = rest.filter(a => !dead.includes(a) && !a.isDead).sort((x, y) => wal(w, y) - wal(w, x)); const leave = alive.slice(0, Math.ceil(alive.length / 2)).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(alive.length * (0.08 + Math.random() * 0.1)))); // 比較有錢的那一半才走得了
        for (const a of leave) { try { if (w.leaveTown?.(a.agentId, t('核災之後不敢住了'))) T.st.left++; } catch (e) {} }
        // 當初反對核安法的人被怪罪
        for (const f of fam) for (const id of (T.lawNo || [])) { const o = w.agents[id]; if (o && !o.isDead && o !== f) aff(f, o, -15); }
        // 大災之後的文明倒退(核電廠毀了算十五分,死的、走的佔人口越多越嚴重)
        try { if (typeof CALAMITY !== 'undefined' && CALAMITY.regress) CALAMITY.regress(w, t('核災'), 15 + (dead.length / Math.max(1, pop0)) * 200 + (leave.length / Math.max(1, pop0)) * 80); } catch (e) {}
        T.lastBig = d; T.risk = 1; T.pendAbandon = Math.random() < 0.75 ? d + 1 + Math.floor(Math.random() * 3) : null;
        const blame = (T.lawNo || []).map(id => w.agents[id]).find(o => o && !o.isDead && owner(w, o)) || null;
        return { k: '☢️ 核災！核電廠爆炸，{dead}罹難，{s}人得了輻射病，{l}人連夜搬離小鎮。', p: { dead: names(dead), s: sick.length, l: leave.length }, who: dead, imp: 10, blame };
    }
    const RATE = { minor: 0.11, mid: 0.022 }; // 一天的機率(一年 60 天:小事約 6～7 次、中事約 1.3 次)
    const BIG = 0.03 / 60; // 大災:一年 3%
    const BIG_FX = {}; // 各種大災自己的機率(sim-bio.js 的實驗室外洩)
    function bigChance(w) { const T = S(w); if (d0(w) - (T.lastBig ?? -999) < 120) return 0; return nukeOn(w) ? BIG * T.risk * (T.law ? 0.33 : 1) : 0; }
    function fire(w, ev) {
        const r = ev.run(w); if (!r) return null; const T = S(w); const d = day(w);
        T.inc.push([d, ev.lv, ev.id]); if (T.inc.length > 30) T.inc = T.inc.slice(-30); T.st[ev.lv]++;
        log(w, r.k, r.p, r.who?.[0]?.name); news(w, r.k, r.p, r.imp || (ev.lv === 'big' ? 10 : ev.lv === 'mid' ? 8 : 5), (r.who || []).map(a => a.name));
        if (ev.lv !== 'minor') for (const a of (r.who || [])) if (!a.isDead) a.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', r.k, r.p, 7, []);
        try { w.onTechIncident?.(ev, r); } catch (e) {}
        // v7.9.0 中事、大災都是衝擊:村民各自反應(sim-aftermath.js)
        try { if (ev.lv !== 'minor' && typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: ev.id, sev: r.sev || (ev.lv === 'big' ? 3 : ev.id === 'leak' ? 2 : 1), cause: t(AFTERMATH.CAUSE[ev.id] || ''), who: r.who || [], blame: r.blame || null }); } catch (e) {}
        return r;
    }
    function incidents(w) {
        const T = S(w); // v7.9.0 社會問題跟著科技走(有核電廠就可能核災),不看走哪條路線
        const pool = (lv) => EVENTS.filter(e => e.lv === lv && e.need(w));
        if (Math.random() < bigChance(w)) { const b = pool('big').filter(e => !e.own); if (b.length) { fire(w, rnd(b)); return; } }
        for (const e of pool('big').filter(e => e.own)) if (Math.random() < e.own(w)) { fire(w, e); return; }
        if (Math.random() < RATE.mid) { const m = pool('mid'); if (m.length && fire(w, rnd(m))) return; }
        if (Math.random() < RATE.minor) { const m = pool('minor'); if (m.length) fire(w, rnd(m)); }
    }

    // ---------- 每天 ----------
    function daily(w) {
        if (!w?.research) return; const T = S(w); const d = day(w); if (T.lastDay === d) return; T.lastDay = d;
        pathDaily(w, T, d); lawDaily(w, T, d); incidents(w);
        // 投票反對核安法的人記下來(出事時被怪)
        for (const p of (w.proposals?.items || [])) if (p.kind === 'tech_safety' && !p._noted && p.status !== 'open' && p.status !== 'shelved') { p._noted = true; T.lawNo = Object.entries(p.votes || {}).filter(([, v]) => v === 'against').map(([id]) => id).slice(0, 40); }
        for (const id of Object.keys(T.mk)) if (!w.agents[id] || w.agents[id].isDead) delete T.mk[id];
    }
    // 精進改良:做完一級就再開下一級(效果在 recomputeEffects 照等級加)
    function onComplete(w, key) {
        if (key === REFINE) { const T = S(w); T.ref++; const p = w.research.projects[REFINE]; if (p) { p.status = 'available'; p.progress = 0; p.cost = costOf(w, REFINE); p.name = t('精進改良') + ' Lv.' + (T.ref + 1); } try { w.buildings?.recomputeEffects?.(w); } catch (e) {} }
        recost(w);
    }
    const REF_FX = { farm_bonus: 0.02, build_speed: 0.02, healing_bonus: 0.02, research_bonus: 0.02, trade_bonus: 0.01 };

    // ---------- 時代與介面 ----------
    function eraName(w, era, P) {
        const ERAS = typeof RESEARCH_ERAS !== 'undefined' ? RESEARCH_ERAS : {}; P = P || pathOf(w);
        if (era >= 4 && P && PATHS[P]?.stages[era]) return PATHS[P].stages[era];
        return ERAS[era] || { name: '', icon: '' };
    }
    function riskWord(w) { const T = S(w); if (!nukeOn(w)) return null; const r = T.risk * (T.law ? 0.33 : 1); return r >= 1.8 ? 'high' : r >= 0.9 ? 'mid' : 'low'; }
    function view(w) {
        const T = S(w); const R = w.research; const P = T.path; const Pd = P ? PATHS[P] : null;
        const open = (w.proposals?.items || []).find(p => p.kind === 'tech_path' && ['open', 'shelved', 'approved'].includes(p.status)); const A = appeals(w);
        const inc = T.inc.slice(-8).reverse().map(x => { const e = EVENTS.find(y => y.id === x[2]); return { day: x[0], lv: x[1], id: x[2], icon: e?.icon || '', ago: day(w) - x[0] }; });
        return { path: P, pathName: Pd ? t(Pd.name) : '', icon: Pd?.icon || '', short: Pd ? t(Pd.short) : '', pro: Pd ? t(Pd.pro) : '', con: Pd ? t(Pd.con) : '', since: T.since, yes: T.yes, no: T.no, tries: T.tries,
            main3: Math.round(mainRatio(R, 3) * 100), gate: Math.round(GATE * 100), debate: open ? { id: open.id, status: open.status, f: Object.values(open.votes || {}).filter(v => v === 'for').length, a: Object.values(open.votes || {}).filter(v => v === 'against').length, tally: tally(open) } : null,
            stage: { 4: Math.round(stageRatio(R, P || 'electro', 4) * 100), 5: Math.round(stageRatio(R, P || 'electro', 5) * 100), 6: Math.round(stageRatio(R, P || 'electro', 6) * 100) },
            stages: Object.fromEntries(PATH_KEYS().map(Q => [Q, { 4: Math.round(stageRatio(R, Q, 4) * 100), 5: Math.round(stageRatio(R, Q, 5) * 100), 6: Math.round(stageRatio(R, Q, 6) * 100) }])),
            paths: PATH_KEYS().map(Q => ({ key: Q, icon: PATHS[Q].icon, name: t(PATHS[Q].name), short: t(PATHS[Q].short), pro: t(PATHS[Q].pro), con: t(PATHS[Q].con), appeal: A[Q] })), nextDebate: T.nextDebate != null ? Math.max(0, T.nextDebate - day(w)) : null, tally: T.tally || null, bio: T.bio || null,
            law: !!T.law, noNuke: !!T.noNuke, nuke: nukeOn(w), risk: riskWord(w), st: T.st, inc, ref: T.ref, tier: tierOf(w), jobs: [...automatable(w)] };
    }
    function brief(w, a) {
        const T = w.tech; if (!T?.path) return '';
        const m = T.mk?.[a.agentId]; if (m === 'bereaved') return t('核災奪走了我的家人'); if (m === 'rad') return t('我吸過核電廠外洩的輻射，到現在還在咳'); if (m === 'laid') return t('我的工作被機器取代了');
        return '';
    }
    function townBrief(w) {
        const T = w.tech; if (!T?.path) { const n = w.tech?.inc?.find?.(x => x[1] === 'big' && day(w) - x[0] <= 60); return n ? (n[2] === 'lableak' ? t('不久前實驗室外洩') : t('不久前出過核災')) : ''; } const Pd = PATHS[T.path]; const R = w.research; const era = R?.currentEra?.() || 4; const en = eraName(w, era, T.path);
        let s = t('小鎮走{name}路線，現在是「{era}」時代').replace('{name}', t(Pd.name)).replace('{era}', t(en.name));
        const big = T.inc.find(x => x[1] === 'big' && day(w) - x[0] <= 60); if (big) s += big[2] === 'lableak' ? t('，不久前實驗室外洩') : t('，不久前出過核災');
        if (T.law) s += t('，有核安法'); if (T.noNuke) s += t('，已經廢核');
        return s;
    }
    return { W: null, PATHS, PATH_KEYS, GATES, BIG_FX, exclusive, appeal, appeals, tally, winnerOf, bestOpt, sickish, famHurt, devoutA, mythGroup, propose, busy, log, news, mem, pick, pickN, aff, moodAll, names, addAil, adults, npcs, built, done, owner, wal, day, REFINE, S, pathOf, pathsOf, onPath, mainRatio, stageRatio, GATE, gateOk, costOf, recost, autoPick, pickWeight, speedOf, jobMult, automatable, prefer, choose, voteRule, setLaw, unsetLaw, abandon, EVENTS, fire, meltdown, bigChance, incidents, daily, onComplete, REF_FX, eraName, riskWord, view, brief, townBrief, nukeOn };
})();

// ---------- 科技樹:機械時代歸到電子機械路線,加上電力、太空時代 ----------
(function () {
    if (typeof RESEARCH_TREE === 'undefined') return;
    const T = RESEARCH_TREE;
    for (const k of ['steam_power', 'mechanized_farming', 'railways', 'steel_frame']) if (T[k]) T[k].path = 'electro';
    Object.assign(T, {
        machine_tools: { era: 4, path: 'electro', name: t('工作母機'), description: t('會做機器的機器：車床、銑床，零件不再靠手磨'), cost: 6000, prerequisites: ['steam_power', 'toolmaking'], effects: { smithing_bonus: 1.1, build_speed: 1.05 }, unlocks: [] },
        internal_combustion: { era: 4, path: 'electro', name: t('內燃機'), description: t('燒油的引擎：貨車跑得比馬快'), cost: 6600, prerequisites: ['steam_power', 'chemistry'], effects: { merchant_frequency: 0.15, farm_bonus: 1.05 }, unlocks: [] },
        // ---- 電力 ----
        electricity: { era: 5, path: 'electro', name: t('電力'), description: t('發電、送電：可以蓋發電廠，工坊夜裡也能開工'), cost: 11000, prerequisites: ['machine_tools', 'steel_frame'], effects: { build_speed: 1.1, research_bonus: 0.05 }, unlocks: ['power_plant'] },
        telegraph: { era: 5, path: 'electro', name: t('電報'), description: t('一條電線，鄰鎮的消息當天就到'), cost: 11500, prerequisites: ['electricity', 'railways'], effects: { merchant_frequency: 0.2, trade_bonus: 0.05 }, unlocks: [] },
        electric_light: { era: 5, path: 'electro', name: t('電燈'), description: t('夜晚亮了起來，讀書做工都不必看天色'), cost: 12000, prerequisites: ['electricity'], effects: { xp_bonus: 1.05, beauty_bonus: 3, recreation_bonus: 3 }, unlocks: [] },
        assembly_line: { era: 5, path: 'electro', name: t('生產線'), description: t('一人一道工序，產量翻倍——裁縫、鐵匠、木匠的缺變少'), cost: 13000, prerequisites: ['electricity', 'mechanized_farming'], effects: { smithing_bonus: 1.2, storage_bonus: 1.1 }, unlocks: [] },
        radio: { era: 5, path: 'electro', name: t('無線電'), description: t('收音機裡有新聞、有音樂，也有吵不完的節目'), cost: 13500, prerequisites: ['telegraph'], effects: { culture_bonus: 8, research_bonus: 0.03 }, unlocks: [] },
        nuclear_fission: { era: 5, path: 'electro', name: t('核分裂'), description: t('一小塊鈾抵一座煤山：可以蓋核電廠，但一出事就是大災'), cost: 15000, prerequisites: ['electricity', 'chemistry'], effects: { research_bonus: 0.05 }, unlocks: ['nuclear_plant'] },
        // v7.9.0 微電子、精密製造、機器人、核融合改成第五時代(大家都能研究);機器人變弱
        microelectronics: { era: 5, path: 'electro', name: t('微電子學'), description: t('指甲大的晶片，裝得下一整間計算室'), cost: 15500, prerequisites: ['radio', 'assembly_line'], effects: { research_bonus: 0.08 }, unlocks: [] },
        precision_mfg: { era: 5, path: 'electro', name: t('精密製造'), description: t('誤差比頭髮還細的零件'), cost: 16000, prerequisites: ['microelectronics'], effects: { smithing_bonus: 1.15, build_speed: 1.05 }, unlocks: [] },
        robotics: { era: 5, path: 'electro', name: t('機器人工程學'), description: t('不吃不睡的工人——農夫、礦工、廚師的缺少一些'), cost: 17000, prerequisites: ['precision_mfg'], effects: { farm_bonus: 1.1, stone_efficiency: 1.1 }, unlocks: [] },
        fusion: { era: 5, path: 'electro', name: t('核融合'), description: t('像太陽一樣發電，乾淨又安全'), cost: 18000, prerequisites: ['nuclear_fission', 'precision_mfg'], effects: { build_speed: 1.1, research_bonus: 0.05 }, unlocks: [] },
        // ---- 太空(電子機械專屬) ----
        rocketry: { era: 6, path: 'electro', name: t('火箭'), description: t('把東西送出天空：可以蓋發射場；也是核子武器的運載工具'), cost: 23000, prerequisites: ['precision_mfg', 'nuclear_fission'], effects: { discover_bonus: 0.05, culture_bonus: 5 }, unlocks: ['launch_site'] },
        nuclear_weapons: { era: 6, path: 'electro', name: t('核子武器'), description: t('火箭裝上核彈頭：沒有人敢來犯，但世界從此活在毀滅的陰影下'), cost: 26000, prerequisites: ['rocketry', 'nuclear_fission'], effects: { defense_bonus: 5 }, unlocks: [] },
        satellite: { era: 6, path: 'electro', name: t('衛星'), description: t('從天上看路、看天氣，商隊不再迷路'), cost: 25000, prerequisites: ['rocketry', 'microelectronics'], effects: { merchant_frequency: 0.2, defense_bonus: 2 }, unlocks: [] },
        space_station: { era: 6, path: 'electro', name: t('太空站'), description: t('住在天上的研究室：研究更快，遠方的消息更快傳到'), cost: 27000, prerequisites: ['satellite'], effects: { research_bonus: 0.1 }, unlocks: [] },
        quantum_computer: { era: 6, path: 'electro', name: t('量子電腦'), description: t('一秒算完一百年的題目：AI 的大腦'), cost: 28000, prerequisites: ['microelectronics', 'satellite'], effects: { research_bonus: 0.08 }, unlocks: [] },
        ai_agent: { era: 6, path: 'electro', name: t('AI 全智能體'), description: t('會思考的機器：研究飛快，但它看得見每個人在做什麼'), cost: 32000, prerequisites: ['robotics', 'quantum_computer'], effects: { research_bonus: 0.15, xp_bonus: 1.1 }, unlocks: [] },
        // ---- 全部研究完之後可以一直研究 ----
        refine: { era: 7, name: t('精進改良') + ' Lv.1', description: t('把現有的技術磨得更好：每一級農業、建造、醫療、研究、買賣都再好一點'), cost: 20000, prerequisites: [], effects: {}, unlocks: [] },
    });
    if (typeof RESEARCH_ERAS !== 'undefined') RESEARCH_ERAS[7] = { name: '精進', icon: '♾️' };
    if (typeof RESEARCH_UNLOCKED_BY !== 'undefined') { RESEARCH_UNLOCKED_BY.power_plant = ['electricity']; RESEARCH_UNLOCKED_BY.nuclear_plant = ['nuclear_fission']; RESEARCH_UNLOCKED_BY.launch_site = ['rocketry']; }
    if (typeof BUILDING_TEMPLATES !== 'undefined') Object.assign(BUILDING_TEMPLATES, {
        power_plant: { name: t('發電廠'), description: t('燒煤發電，全鎮通電，蓋東西、做研究都快一點'), costs: { steel: 30, brick: 30, stone: 40, silver: 400 }, work: 50, effects: { build_speed: 0.1, research_bonus: 0.05 } },
        nuclear_plant: { name: t('核電廠'), description: t('電多到用不完，研究大躍進；出事的話就是核災'), costs: { steel: 60, brick: 50, stone: 60, paper: 30, silver: 1200 }, work: 90, effects: { build_speed: 0.15, research_bonus: 0.1, research_cap: 20 } },
        launch_site: { name: t('發射場'), description: t('火箭從這裡升空，全鎮都跑出來看'), costs: { steel: 80, brick: 40, paper: 40, silver: 1500 }, work: 100, effects: { research_bonus: 0.1, culture_bonus: 10 } },
    });
    if (typeof PROPOSAL_JOB_BUILDINGS !== 'undefined') { const add = (j, ks) => { PROPOSAL_JOB_BUILDINGS[j] = [...(PROPOSAL_JOB_BUILDINGS[j] || []), ...ks]; }; add('researcher', ['power_plant', 'nuclear_plant', 'launch_site']); add('blacksmith', ['power_plant']); add('mayor', ['power_plant', 'launch_site']); }
    if (typeof TECH_IDEAS !== 'undefined') Object.assign(TECH_IDEAS, {
        electricity: { idea: '有了電，夜晚也能做事', c: 0.4 },
        assembly_line: { idea: '一人一道工序，比一個師傅從頭做到尾快', c: 0.8, threat: ['tailor', 'blacksmith', 'carpenter'] },
        nuclear_fission: { idea: '核電是最便宜的電', c: 0.9 },
        robotics: { idea: '粗活就交給機器人', c: 0.9, threat: ['farmer', 'miner', 'cook'] },
        ai_agent: { idea: '讓 AI 幫大家做決定比較公平', c: 1.0, threat: ['trader'] },
    });
})();

// ---------- 研究系統:門檻、成本、自動挑選、時代、精進改良 ----------
if (typeof ResearchManager !== 'undefined') {
    const RM = ResearchManager.prototype; const W = () => (typeof window !== 'undefined' && window.rimtownApp?.world) || TECH.W;
    const _ga = RM.getAvailable;
    RM.getAvailable = function () {
        const w = W(); const out = _ga.call(this).filter(p => TECH.gateOk(w, p));
        const rest = out.filter(p => p.key !== TECH.REFINE); return rest.length ? rest : out; // 精進改良只在沒有別的可研究時開放
    };
    const _sr = RM.startResearch;
    RM.startResearch = function (key) { const w = W(); const p = this.projects[key]; if (p && w && !TECH.gateOk(w, p)) return false; if (key === TECH.REFINE && w && this.getAvailable().some(q => q.key !== TECH.REFINE)) return false; return _sr.call(this, key); };
    const _ce = RM.currentEra;
    RM.currentEra = function () { const base = _ce.call(this); if (base < 4) return base; const w = W(); const P = w?.tech?.path; let e = 4; const tl = w ? (typeof TIERS === 'undefined' ? 3 : TIERS.level(w)) : 3; for (const s of [4, 5]) { const r = P ? TECH.stageRatio(this, P, s) : Math.max(...TECH.PATH_KEYS().map(Q => TECH.stageRatio(this, Q, s))); if (r >= TECH.GATE && tl >= s - 2 && (s < 5 || P)) e = s + 1; else break; } return e; }; // 第五時代要城市;第六時代要王都、而且要選了路線
    const _iu = RM.isUnlocked;
    RM.isUnlocked = function (key) { const w = W(); if (key === 'nuclear_plant' && w?.tech?.noNuke) return false; return _iu.call(this, key); };
    const _td = RM.toDict;
    RM.toDict = function () { const d = _td.call(this); try { const w = W(); if (w) d.tech = TECH.view(w); } catch (e) {} return d; };
}
if (typeof BuildingManager !== 'undefined') {
    const BM = BuildingManager.prototype; const _rc = BM.recomputeEffects;
    BM.recomputeEffects = function (world) { const eff = _rc.call(this, world); const n = world?.tech?.ref || 0; if (n > 0) for (const [k, v] of Object.entries(TECH.REF_FX)) eff[k] = (eff[k] || 0) + v * n; this.activeEffects = eff; return eff; };
}
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    left_behind: { mood: -5, opinion: 0, days: 4, label: t('跟不上新機器') },
    meltdown_fear: { mood: -8, opinion: 0, days: 10, label: t('核災之後一直很害怕') },
    meltdown_grief: { mood: -15, opinion: 0, days: 20, label: t('家人死在核災裡') },
});
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, {
    tech_path: { icon: '🧭', label: '科技路線' }, tech_safety: { icon: '📋', label: '核安法' }, tech_unsafe: { icon: '📋', label: '放寬核安法' }, tech_abandon: { icon: '🌿', label: '廢核' },
});
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { path_fit: '這條路對自己這行有利', path_job: '怕機器搶了飯碗', path_fear: '怕新東西出大事', tech_victim: '自己或家人受過害', tech_slow: '不想拖慢研究' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) TECH.daily(w); } catch (e) { console.warn('[Tech] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (['tech_path', 'tech_safety', 'tech_unsafe', 'tech_abandon'].includes(p.kind)) { const r = TECH.voteRule(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = TECH.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = TECH.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.tech = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () {
        const d = _ser.call(this);
        if (d && this.tech) { const T = this.tech; d.tech = { path: T.path || null, since: T.since ?? null, yes: T.yes || 0, no: T.no || 0, tries: T.tries || 0, lastProp: T.lastProp ?? null, risk: T.risk ?? 1, law: T.law || 0, lastLaw: T.lastLaw ?? null, lastUnsafe: T.lastUnsafe ?? null, noNuke: T.noNuke || 0, pendAbandon: T.pendAbandon ?? null, lastBig: T.lastBig ?? null, inc: T.inc, st: T.st, mk: T.mk, ref: T.ref || 0, lawNo: T.lawNo || [], carry: this.research?._carry || 0, nextDebate: T.nextDebate ?? null, app0: T.app0 || null, tally: T.tally || null, bio: T.bio || null, v79: T.v79 || 0 }; }
        return d;
    };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) {
        const r = _load.call(this, data);
        try { if (r) { this.tech = (data?.tech && typeof data.tech === 'object') ? data.tech : null; TECH.W = this; const T = TECH.S(this);
            // v7.9.0 v7.8 時因為研究過機械時代就被自動判定走電子機械(沒投過票)、也還沒研究專屬科技的小鎮:路線重新空出來,讓大家辯論
            if (T.path && !T.yes && !T.no && !T.tries && !T.v79 && !Object.values(this.research?.projects || {}).some(p => TECH.exclusive(p.key) && TECH.onPath(p.key, T.path) && (p.status === 'complete' || p.status === 'researching'))) { T.path = null; T.since = null; } T.v79 = 1; if (this.research) { this.research._carry = T.carry || 0; const rp = this.research.projects[TECH.REFINE]; if (rp && T.ref) rp.name = t('精進改良') + ' Lv.' + (T.ref + 1); if (rp && rp.status === 'complete') rp.status = 'available'; this.research.refreshLocks?.(); } TECH.recost(this); this.buildings?.recomputeEffects?.(this); } } catch (e) { console.warn('[Tech] load', e); }
        return r;
    };
}
if (typeof window !== 'undefined') window.TECH = TECH;
