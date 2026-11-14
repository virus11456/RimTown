// RimTown - sim-myth2.js(v7.6.0 神裔社會)
// 神話基因出現以後,小鎮怎麼看帶因者:
// - 每個人對神裔有自己的看法(個性、年紀、職業、信仰、家裡有沒有神裔);出事、報紙、朋友講的話、親眼看到神裔幫忙都會改變看法
// - 怕神裔的人多了會組「純人派」,神裔多了會抱團成「神裔會」;派系裡互相拉近、兩派互看不順眼,投票、選舉一起行動
// - 宗教:各宗教隨機認定神話基因是「褻瀆神明」或「神選之人」;褻瀆派的領袖會把帶因信徒逐出教門;被排擠的神裔可能創立崇拜神裔的新神教
// - 婚姻:神裔跟一般人結婚,怕神裔的家人會反對、不來婚禮;混血孩子只有一半的能力和副作用
// - 獵人:出了事又不知道是誰,純人派會組獵人隊連夜搜捕,一半機率抓錯人;冤案揭曉後帶頭的人會被提案審判
// - 報紙:保守、八卦的報紙炒作恐慌,革新、中立的報紙替神裔平反,讀者的看法跟著變
// - 基因階級:天生帶著基因、家裡又有錢的「神裔世家」算士紳;老闆照基因挑人(吸血鬼適合守夜、巨人做粗活、夜梟當學者),
//   怕神裔的老闆會辭退神裔;守夜的吸血鬼、狼人由公庫發夜班津貼(公庫→錢包,守恆)
// - 神裔會可以提案「神裔平權令」(不准歧視雇用、抓人要經過守衛)與「解除基因禁令」
'use strict';
const MYTHSOC = (() => {
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const rel = (a, b) => (a && b && a !== b ? a.relationships?.getOrCreate?.(b.agentId, b.name) : null);
    const WL = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    const log = (w, k, p, who) => { try { w.logMessageT?.('myth', k, p || {}, who); } catch (e) {} };
    const news = (w, s, imp, who) => { try { w.dailyNews?.collectEvent?.('event', s, imp, who || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp || 6, []); } catch (e) {} };
    const fill = (k, p) => { let s = t(k); for (const [x, v] of Object.entries(p || {})) s = s.split('{' + x + '}').join(typeof v === 'string' ? t(v) : String(v)); return s; };
    const pick = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
    const clamp = (v) => Math.max(-100, Math.min(100, v));
    const gene = (w, a) => (a && typeof MYTH !== 'undefined' ? MYTH.geneOf(w, a) : null);
    const gname = (k) => MYTH.GENES[k]?.name || ''; // 原文,顯示時才翻譯
    const fam = (w, a) => { try { return typeof HEALTH !== 'undefined' ? HEALTH.family(w, a) : []; } catch (e) { return []; } };
    const relOf = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith ? FAITH.relOf(w, a) : null; } catch (e) { return null; } };
    const piety = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith ? FAITH.pietyOf(w, a) : 0; } catch (e) { return 0; } };
    function S(w) {
        if (!w.mythsoc || typeof w.mythsoc !== 'object') w.mythsoc = {};
        const X = w.mythsoc; X.att = X.att || {}; X.rel = X.rel || {}; X.grp = X.grp || {}; X.hunts = X.hunts || []; X.jobs = X.jobs || {}; X.pd = X.pd || {};
        X.st = Object.assign({ badmouth: 0, hunts: 0, wrongful: 0, caught: 0, outcast: 0, boycott: 0, mixed: 0, half: 0, fired: 0, night: 0, cult: 0, panic: 0, fair: 0, deeds: 0 }, X.st || {});
        return X;
    }
    const active = (w) => !!w?.myth && Object.keys(w.myth.g || {}).length > 0;
    // ---------- 宗教立場 ----------
    const STANCE_P = { sheng: [0.6, 0.15], li: [0.55, 0.15], zu: [0.4, 0.2], xiu: [0.25, 0.3], chan: [0.2, 0.3], ling: [0.15, 0.5] }; // [褻瀆, 神選]
    function stanceOf(w, R) {
        if (!R) return null; if (R.myth) return 'chosen'; const X = S(w);
        if (!X.rel[R.id]) { const r = typeof FAITH !== 'undefined' ? FAITH.rng(FAITH.hash(String(R.name?.[0] || R.id) + 'gene')) : Math.random; const [b, c] = STANCE_P[R.sk] || [0.3, 0.3]; const x = r(); X.rel[R.id] = x < b ? 'blas' : x < b + c ? 'chosen' : 'neutral'; }
        return X.rel[R.id];
    }
    // ---------- 看法 ----------
    function initAtt(w, a, carriers) {
        let s = (Math.random() - 0.5) * 30 - 10; // 對神的血本能地有點戒心
        if (has(a, 'kind')) s += 15; if (has(a, 'creative') || has(a, 'optimist')) s += 10; if (has(a, 'abrasive') || has(a, 'pessimist') || has(a, 'neurotic')) s -= 12;
        if ((a.age ?? 30) >= 55) s -= 10; if (a.job?.key === 'researcher' || a.job?.key === 'doctor') s += 10;
        const R = relOf(w, a); if (R && piety(w, a) >= 50) { const st = stanceOf(w, R); s += st === 'blas' ? -30 : st === 'chosen' ? 25 : 0; }
        const F = fam(w, a); if (carriers.some(c => F.includes(c))) s += 40;
        return clamp(Math.round(s));
    }
    function att(w, a) { if (!a) return 0; if (gene(w, a)) return 100; const v = w.mythsoc?.att?.[a.agentId]; return typeof v === 'number' ? v : 0; }
    const bump = (w, a, n) => { if (!a || gene(w, a)) return; const X = S(w); X.att[a.agentId] = clamp(Math.round(((X.att[a.agentId] || 0) + n) * 10) / 10); };
    const ATT_L = [[-60, '把神裔當成怪物'], [-25, '怕神裔'], [25, '對神裔沒什麼意見'], [60, '能接受神裔'], [999, '站在神裔這邊']];
    const attLabel = (v) => ATT_L.find(x => v <= x[0])[1];
    const groupOf = (w, a) => { const G = w.mythsoc?.grp; if (!a || !G) return null; if (G.pure?.members?.includes(a.agentId)) return 'pure'; if (G.guild?.members?.includes(a.agentId)) return 'guild'; return null; };
    const isPure = (w, a) => !!a && !gene(w, a) && (groupOf(w, a) === 'pure' || att(w, a) <= -60);
    // ---------- 派系 ----------
    function groups(w, X, d, all, carriers) {
        const G = X.grp; const score = (a, sgn) => (has(a, 'charismatic') ? 40 : 0) + (has(a, 'abrasive') && sgn < 0 ? 10 : 0) + sgn * att(w, a) + (WL()?.get(w, a) || 0) / 100;
        const pure = all.filter(a => !gene(w, a) && att(w, a) <= -40 && (a.age ?? 30) >= 16).sort((x, y) => score(y, -1) - score(x, -1)).slice(0, 14);
        if (carriers.length >= 2 && pure.length >= 3) {
            const fresh = !G.pure; if (fresh) G.pure = { since: d };
            G.pure.members = pure.map(a => a.agentId); if (!G.pure.members.includes(G.pure.leader)) G.pure.leader = pure[0].agentId;
            if (fresh) { const L = w.agents[G.pure.leader]; log(w, '🛡️ {a}號召怕神裔的人成立了「純人派」，說要守住人的血統。', { a: L.name }, L.name); news(w, fill('{a}成立純人派', { a: L.name }), 7, [L.name]); mem(w, L, '我成立了純人派，絕不讓怪物的血在鎮上擴散。', {}, 8); }
        } else if (G.pure && pure.length < 2) { log(w, '🕊️ 純人派散了，怕神裔的人越來越少。', {}); delete G.pure; }
        const allies = all.filter(a => !gene(w, a) && att(w, a) >= 60 && (a.age ?? 30) >= 16);
        if (carriers.length >= 3) {
            const fresh = !G.guild; if (fresh) G.guild = { since: d };
            const cs = carriers.slice().sort((x, y) => score(y, 0) - score(x, 0));
            G.guild.members = cs.concat(allies).slice(0, 20).map(a => a.agentId); if (!cs.some(c => c.agentId === G.guild.leader)) G.guild.leader = cs[0].agentId;
            if (fresh) { const L = w.agents[G.guild.leader]; log(w, '🧬 {a}把鎮上的神裔聚在一起，成立了「神裔會」，彼此照應。', { a: L.name }, L.name); news(w, fill('{a}成立神裔會', { a: L.name }), 7, [L.name]); mem(w, L, '我們成立了神裔會，神裔要團結才不會被欺負。', {}, 8); }
        } else if (G.guild && carriers.length < 2) { delete G.guild; }
    }
    function dynamics(w, X, d, all, carriers) {
        const list = (g) => (g?.members || []).map(id => w.agents[id]).filter(a => a && !a.isDead);
        const pm = list(X.grp.pure), gm = list(X.grp.guild);
        for (const g of [pm, gm]) for (let i = 0; i < Math.min(3, g.length); i++) { const x = pick(g), y = pick(g); if (x && y && x !== y) { rel(x, y)?.modifyAffinity?.(1); rel(y, x)?.modifyAffinity?.(1); } }
        if (pm.length && gm.length) for (let i = 0; i < 2; i++) { const x = pick(pm), y = pick(gm); rel(x, y)?.modifyAffinity?.(-1); rel(y, x)?.modifyAffinity?.(-1); }
        // 純人派在背後講神裔壞話
        if (pm.length && carriers.length && Math.random() < 0.3) {
            const sp = pick(pm), tg = pick(carriers); const li = pick(all.filter(a => a !== sp && a !== tg && !gene(w, a) && groupOf(w, a) !== 'pure'));
            if (li) { bump(w, li, aff(li, sp) >= 20 ? -7 : -4); rel(li, tg)?.modifyAffinity?.(-3); X.st.badmouth++; mem(w, li, '{a}跟我說{b}身上流著怪物的血，叫我離遠一點。', { a: sp.name, b: tg.name }, 5); if (Math.random() < 0.3) log(w, '🗣️ 純人派的{a}在{b}面前說{c}的壞話。', { a: sp.name, b: li.name, c: tg.name }, sp.name); }
        }
        // 神裔會私下拉近關係
        const gc = gm.filter(a => gene(w, a));
        if (gc.length && Math.random() < 0.25) { const c = pick(gc); const li = pick(all.filter(a => !gene(w, a) && att(w, a) > -40 && aff(a, c) >= 10)); if (li) { bump(w, li, 4); mem(w, li, '{a}跟我聊了很久，神裔其實也只是想好好過日子。', { a: c.name }, 4); } }
        // 親眼看到神裔的能力幫上忙
        const DEED = { sun: '{a}用太陽神之血治好了好多病人', giant: '{a}一個人扛起了整面牆', owl: '{a}一晚就解開了學者們卡了好久的難題', thunder: '{a}幫大家把整片田的大石頭搬走了', wolf: '{a}半夜巡邏抓到了小偷', phoenix: '{a}衝進火場把孩子救了出來' };
        for (const c of carriers) {
            const k = DEED[gene(w, c)]; if (!k || Math.random() > 0.02) continue;
            const seen = all.filter(a => a !== c && !gene(w, a) && aff(a, c) >= 0).sort(() => Math.random() - 0.5).slice(0, 3); if (!seen.length) continue;
            for (const o of seen) { bump(w, o, 4); rel(o, c)?.modifyAffinity?.(3); mem(w, o, '親眼看到{x}，神裔好像也沒那麼可怕。', { x: { k, p: { a: c.name } } }, 5); }
            X.st.deeds++; log(w, '🌟 {x}。', { x: { k, p: { a: c.name } } }, c.name);
            if (Math.random() < 0.4) press(w, X, 'fair', k, { a: c.name }, all);
            break;
        }
        // 看法慢慢淡化
        for (const id in X.att) { if (!w.agents[id] || w.agents[id].isDead) { delete X.att[id]; continue; } X.att[id] = Math.round(X.att[id] * 0.995 * 10) / 10; }
    }
    // ---------- 報紙 ----------
    function press(w, X, mode, k, p, all) {
        if (typeof PRESS === 'undefined' || !w.press?.papers) return 0; const R = w.press, d = day(w); let n = 0;
        for (const P of R.papers) {
            if (P.closed || P.banned || (X.pd[P.id] ?? -99) > d - 3) continue;
            const ja = att(w, w.agents[P.journo]);
            const panicky = ['gossip', 'cons', 'crown'].includes(P.st) && ja < 30; const fair = (['prog', 'town', 'board'].includes(P.st) && ja > -30) || ja >= 60;
            if ((mode === 'panic' && !panicky) || (mode === 'fair' && !fair) || Math.random() > 0.7) continue;
            X.pd[P.id] = d; n++; X.st[mode]++;
            try { PRESS.story(w, P, mode === 'panic' ? 'myth_panic' : 'myth_fair', k, p); } catch (e) {}
            for (const o of all) if (R.reads?.[o.agentId] === P.id) bump(w, o, (mode === 'panic' ? -6 : 6) * (PRESS.trust?.(w, o, P) ?? 0.5));
        }
        return n;
    }
    // ---------- 出事與獵人隊 ----------
    function injure(w, v, why) { if (typeof HEALTH === 'undefined' || !w.health) return; HEALTH.S(w); try { HEALTH.addAil(w, v, { p: pick(['h', 'f', 'e']), k: 'injury', s: Math.random() < 0.4 ? 2 : 1, dmg: 15 }, why); } catch (e) {} }
    function incidents(w, X, d, all) {
        const since = typeof X.incDay === 'number' ? X.incDay : d - 1; X.incDay = d;
        for (const x of (w.myth.inc || []).filter(x => x[0] > since && x[0] <= d)) {
            const c = w.agents[x[2]];
            if (x[3]) { for (const o of all) if (o !== c && !gene(w, o)) bump(w, o, aff(o, c) >= 40 ? -3 : -8); if (c) press(w, X, 'panic', '神裔又出事了！{a}身上的{g}害人受傷，晚上最好別出門', { a: c.name, g: gname(x[1]) }, all); }
            else { for (const o of all) if (!gene(w, o)) bump(w, o, -3); /* 不知道是誰幹的,大家都怕 */ if (x[1] === 'wolf' || x[1] === 'night') askHunt(w, X, d, c, x[1]); } // v9.27.0 有決策核心時,搜不搜由純人派帶頭的人決定
        }
    }
    const byCrowd = (w) => { try { return typeof DECIDE !== 'undefined' && !!DECIDE.crowd && !!DECIDE.on?.(w); } catch (e) { return false; } };
    const huntOk = (X) => { const P = X.grp.pure; return !!P && (P.members || []).length >= 2 && !X.hunts.some(h => !h.done); };
    const huntLead = (w, X) => { const P = X.grp.pure; const hs = (P?.members || []).map(id => w.agents[id]).filter(a => a && !a.isDead).slice(0, 4); return { hs, lead: w.agents[P?.leader] || hs[0] || null }; };
    // v9.27.0 給決策核心:出了不知道是誰幹的事,純人派帶頭的人自己決定要不要帶隊搜捕(抓到誰、抓得對不對仍然看運氣)
    function askHunt(w, X, d, culprit, kind) { if (!huntOk(X)) return; const { hs, lead } = huntLead(w, X); if (!lead || !hs.length) return; try { DECIDE.enqueue(w, lead, 'hunt', { cul: culprit?.agentId || null, kind, d }); } catch (e) {} }
    function huntInfo(w, a, c) {
        if (!a || !c || !active(w)) return null; const X = S(w); if (!huntOk(X) || day(w) - (c.d ?? -99) > 2) return null; const { hs, lead } = huntLead(w, X); if (lead !== a || !hs.length) return null;
        return { n: hs.length, kind: c.kind, rights: !!X.rights, wrongful: X.st.wrongful || 0, caught: X.st.caught || 0 };
    }
    function huntBy(w, a, c) { if (!huntInfo(w, a, c)) return null; return huntDo(w, S(w), day(w), npcs(w), w.agents[c.cul] || null, c.kind); }
    function huntDo(w, X, d, all, culprit, kind) {
        const P = X.grp.pure;
        const hunters = P.members.map(id => w.agents[id]).filter(a => a && !a.isDead).slice(0, 4); const lead = w.agents[P.leader] || hunters[0]; if (!lead || !hunters.length) return null;
        const pool = all.filter(a => !hunters.includes(a) && (a.age ?? 30) >= 16);
        const sc = (a) => (gene(w, a) ? 25 : 0) + (has(a, 'shy') || has(a, 'ascetic') ? 10 : 0) - hunters.reduce((s, h) => s + aff(h, a), 0) / hunters.length + Math.random() * 10;
        const sus = culprit && pool.includes(culprit) && Math.random() < 0.5 ? culprit : pool.slice().sort((x, y) => sc(y) - sc(x))[0]; if (!sus) return null;
        const right = sus === culprit; const kn = kind === 'wolf' ? '狼人' : '吸血鬼'; X.st.hunts++;
        const h = { d, lead: lead.agentId, sus: sus.agentId, cul: culprit?.agentId || null, right, kind, done: false, beat: !X.rights, reveal: d + 2 + Math.floor(Math.random() * 4) };
        for (const o of hunters) mem(w, o, '跟著{l}連夜搜捕{k}，抓到了{s}。', { l: lead.name, k: kn, s: sus.name }, 6);
        rel(sus, lead)?.modifyAffinity?.(-25); for (const o of hunters) rel(sus, o)?.modifyAffinity?.(-10);
        if (X.rights) { log(w, '🔦 純人派的{a}帶隊追查{k}，把{s}交給守衛問話（平權令禁止私刑）。', { a: lead.name, k: kn, s: sus.name }, lead.name); mem(w, sus, '被當成{k}帶去守衛那裡問話，好屈辱。', { k: kn }, 7); }
        else { injure(w, sus, '被獵人隊毒打'); sus.addThought?.('myth_hated', w); mem(w, sus, '純人派半夜衝進我家，說我是{k}，把我拖出去打。', { k: kn }, 9); log(w, '🔥 純人派的{a}帶著 {n} 個人連夜搜捕，把{s}當成{k}拖出來痛打一頓。', { a: lead.name, n: hunters.length, s: sus.name, k: kn }, lead.name); news(w, fill('獵人隊把{s}當成{k}痛打', { s: sus.name, k: kn }), 7, [sus.name, lead.name]); }
        if (right) {
            h.done = true; X.st.caught++; try { MYTH.incident(w, culprit, kind, null, true); } catch (e) {}
            log(w, '🎯 {s}身上真的有{g}，大家說獵人隊立了大功。', { s: sus.name, g: gname(kind) }, sus.name);
            for (const o of hunters) try { if (typeof DARK !== 'undefined') DARK.bump(w, o, 'helped'); } catch (e) {}
        }
        X.hunts.push(h); if (X.hunts.length > 12) X.hunts.splice(0, X.hunts.length - 12);
        return h;
    }
    function reveal(w, X, d, all) {
        for (const h of X.hunts) {
            if (h.done || d < h.reveal) continue; h.done = true; h.wrong = true; X.st.wrongful++;
            const sus = w.agents[h.sus], lead = w.agents[h.lead], cul = w.agents[h.cul]; const kn = h.kind === 'wolf' ? '狼人' : '吸血鬼';
            log(w, '⚖️ 冤案：{s}根本不是{k}，{c}。', { s: sus?.name || '', k: kn, c: cul ? { k: '真正的{k}是{c}', p: { k: kn, c: cul.name } } : '真兇另有其人' }, sus?.name);
            news(w, fill('冤案：{s}不是{k}', { s: sus?.name || '', k: kn }), 8, [sus?.name, lead?.name].filter(Boolean));
            if (cul) try { MYTH.incident(w, cul, h.kind, null, true); } catch (e) {}
            for (const o of all) if (o !== lead && !gene(w, o)) bump(w, o, 5);
            if (lead) for (const o of all) if (o !== lead) rel(o, lead)?.modifyAffinity?.(-3);
            if (sus) { sus.addThought?.('vindicated', w); mem(w, sus, '大家終於知道我是被冤枉的。', {}, 8); press(w, X, 'fair', '冤案！{s}被純人派當成怪物毒打，真兇另有其人', { s: sus.name }, all); }
            // 被冤枉、被打的人提案處置帶頭的人
            if (h.beat && lead && sus && !lead.isDead && typeof DARK !== 'undefined') try { const s = DARK.secret(w, { kind: 'frame', culprit: lead.agentId, victim: sus.agentId, k: '{a}帶頭把{b}當成怪物毒打', p: { a: lead.name, b: sus.name } }); s.found = true; DARK.proposeVerdict(w, s, lead, sus, sus); } catch (e) {}
        }
    }
    // ---------- 宗教 ----------
    const CULT = { sun: ['烈陽聖會', 'Order of the Blazing Sun'], phoenix: ['浴火聖會', 'Order of the Rising Flame'], hades: ['冥河聖會', 'Order of the Styx'], thunder: ['雷霆聖會', 'Order of the Thunder'], owl: ['明眸聖會', 'Order of the Clear Eye'] };
    function faith(w, X, d, all, carriers) {
        if (typeof FAITH === 'undefined' || !w.faith?.rels) return; const F = w.faith;
        for (const a of all) { if (gene(w, a)) continue; const R = relOf(w, a); if (!R || piety(w, a) < 60) continue; const st = stanceOf(w, R); if (st === 'blas' && att(w, a) > -50) bump(w, a, -0.4); else if (st === 'chosen' && att(w, a) < 40) bump(w, a, 0.3); }
        // 褻瀆派的領袖把帶因信徒逐出教門
        for (const c of carriers) {
            const R = relOf(w, c); if (!R || stanceOf(w, R) !== 'blas' || Math.random() > 0.05) continue;
            const h = typeof FAITH2 !== 'undefined' ? FAITH2.headOf(w, R) : null; if (!h || h === c || gene(w, h)) continue;
            const f = F.of[c.agentId]; if (!f) continue; f.rel = null; f.piety = Math.max(0, (f.piety || 0) - 30); X.st.outcast++;
            c.addThought?.('myth_cast_out', w); rel(c, h)?.modifyAffinity?.(-20); mem(w, c, '{h}說我身上流著邪物的血，把我逐出了{r}。', { h: h.name, r: R.name[0] }, 9);
            log(w, '⛔ {h}宣布{c}身上流著邪物的血，把{c}逐出{r}。', { h: h.name, c: c.name, r: R.name[0] }, h.name); news(w, fill('{c}被逐出{r}', { c: c.name, r: R.name[0] }), 7, [c.name]);
        }
        // 被排擠的神裔創立崇拜神裔的新神教
        if (F.rels.some(R => R.myth) || F.rels.length >= 5 || carriers.length < 2) return;
        if (!(X.st.outcast > 0 || !F.rels.some(R => stanceOf(w, R) === 'chosen')) || Math.random() > 0.02) return;
        const prophet = carriers.filter(c => CULT[gene(w, c)] && (c.age ?? 30) >= 18).sort((x, y) => (has(y, 'charismatic') - has(x, 'charismatic')) || (piety(w, y) - piety(w, x)))[0]; if (!prophet) return;
        const g = gene(w, prophet); const R2 = FAITH.makeReligion(FAITH.rng(FAITH.hash(prophet.name + d)), 'ling', F.rels.length);
        R2.id = 'R' + (Math.max(0, ...F.rels.map(x => +String(x.id).slice(1) || 0)) + 1); R2.name = CULT[g].slice(); R2.myth = g; R2.saint = prophet.agentId; R2.founder = prophet.name; R2.color = '#B0413E';
        try { if (typeof I18N !== 'undefined') I18N.registerName(R2.name[0], R2.name[1]); } catch (e) {}
        F.rels.push(R2); F.of[prophet.agentId] = { rel: R2.id, piety: 90 }; F.heads = F.heads || {}; F.heads[R2.id] = prophet.agentId;
        const fol = all.filter(a => a !== prophet && (att(w, a) >= 50 || (gene(w, a) && !relOf(w, a))) && piety(w, a) < 80).slice(0, 5);
        for (const a of fol) { F.of[a.agentId] = { rel: R2.id, piety: 60 }; mem(w, a, '我加入了{n}，{p}是神在人間的化身。', { n: R2.name[0], p: prophet.name }, 7); }
        X.st.cult++; X.cult = R2.id;
        log(w, '✨ {a}創立了{n}，信徒說{a}身上的{g}是神的化身，{k} 人跟著入教。', { a: prophet.name, n: R2.name[0], g: gname(g), k: fol.length }, prophet.name);
        news(w, fill('{a}創立{n}', { a: prophet.name, n: R2.name[0] }), 8, [prophet.name]);
        mem(w, prophet, '我創立了{n}。他們不收我，我就讓神裔有自己的信仰。', { n: R2.name[0] }, 9);
    }
    // ---------- 婚姻 ----------
    function onWedding(w, c, a, b) {
        if (!active(w) || !c) return; const ga = gene(w, a), gb = gene(w, b); if (!!ga === !!gb) return;
        const X = S(w); const car = ga ? a : b, other = ga ? b : a; c.mixed = 1; X.st.mixed++;
        const fs = [...new Set(fam(w, other).concat(fam(w, car)))].filter(x => x !== a && x !== b && !gene(w, x));
        const no = fs.filter(x => att(w, x) <= -30); c.boycott = no.map(x => x.agentId);
        if (!no.length) { if (Math.random() < 0.5) log(w, '💞 {o}要跟神裔{c}結婚，家人都送上了祝福。', { o: other.name, c: car.name }, other.name); return; }
        X.st.boycott += no.length;
        for (const x of no) { mem(w, x, '我反對{o}跟神裔{c}結婚，婚禮我不會去。', { o: other.name, c: car.name }, 7); rel(x, car)?.modifyAffinity?.(-10); rel(x, other)?.modifyAffinity?.(-8); rel(other, x)?.modifyAffinity?.(-8); }
        for (const y of [a, b]) { y.moodModifier = (y.moodModifier || 0) - 5; y.addThought?.('wed_boycott', w); }
        const one = no.length === 1; const wp = { who: no[0].name, n: no.length, c: car.name, o: other.name };
        mem(w, other, one ? '{who}反對我跟{c}結婚，說不會來婚禮。' : '{who}等 {n} 位家人反對我跟{c}結婚，說不會來婚禮。', wp, 8);
        log(w, one ? '💔 {o}要跟神裔{c}結婚，{who}堅決反對，說不會出席婚禮。' : '💔 {o}要跟神裔{c}結婚，{who}等 {n} 位家人堅決反對，說不會出席婚禮。', wp, other.name);
        news(w, fill('{o}和神裔{c}的婚事遭家人反對', { o: other.name, c: car.name }), 6, [other.name, car.name]);
    }
    // 混血:天生帶著基因,但爸媽只有一個是神裔 → 能力與副作用都只有一半
    function heredity(w, X, all) {
        const M = w.myth;
        for (const [id, e] of Object.entries(M.g)) {
            if (!e.born || e.hv) continue; e.hv = 1; const a = w.agents[id]; if (!a) continue;
            const ps = all.filter(o => (a._parentNames || []).includes(o.name)); const cs = ps.filter(o => M.g[o.agentId]);
            if (cs.length && (ps.length < 2 || cs.length < ps.length)) { e.half = 1; X.st.half++; log(w, '👶 {a}是混血神裔，{g}的能力和副作用都只有一半。', { a: a.name, g: gname(e.k) }, a.name); }
        }
    }
    // ---------- 工作:照基因挑人、歧視辭退、夜班津貼 ----------
    const FIT = { wolf: { guard: 1.5 }, night: { guard: 1.6, _: 0.75 }, thunder: { blacksmith: 1.4, miner: 1.4 }, owl: { researcher: 1.8 }, sun: { doctor: 1.6 }, giant: { carpenter: 1.6, miner: 1.6, farmer: 1.4 }, phoenix: { blacksmith: 1.3 }, hades: { doctor: 0.7, priest: 0.7 } };
    const PUBLICJ = ['guard', 'doctor', 'researcher', 'priest'];
    function bossOf(w, k) {
        try {
            if (PUBLICJ.includes(k)) return npcs(w).find(a => a.job?.key === 'mayor') || null;
            if (typeof MARKET === 'undefined' || !w.market) return null; const sec = MARKET.JOB2S?.[k]; const id = sec ? MARKET.ownerOf(w, sec) : null; return id ? w.agents[id] || null : null;
        } catch (e) { return null; }
    }
    function geneFit(w, a, k) {
        if (!active(w)) return 1; const g = gene(w, a); if (!g) return 1; const F = FIT[g] || {}; let f = F[k] ?? F._ ?? 1;
        if (w.myth.g[a.agentId]?.half) f = 1 + (f - 1) / 2;
        if (!w.mythsoc?.rights) { const b = bossOf(w, k); if (b && b !== a) { if (isPure(w, b)) f *= 0.3; else if (gene(w, b)) f *= 1.3; } }
        return f;
    }
    function work(w, X, d, carriers) {
        const Wl = WL(), sp = w.stockpile;
        for (const c of carriers) {
            const g = gene(w, c), prev = X.jobs[c.agentId], now = c.job?.key || null;
            if (prev && !now && !X.rights) { const b = bossOf(w, prev); if (b && b !== c && isPure(w, b)) { X.st.fired++; c.addThought?.('myth_hated', w); rel(c, b)?.modifyAffinity?.(-15); mem(w, c, '{b}說怕我嚇到客人，把我辭退了。', { b: b.name }, 7); log(w, '🚪 {c}是神裔，被{b}以「怕嚇到客人」為由辭退了。', { c: c.name, b: b.name }, c.name); } }
            X.jobs[c.agentId] = now;
            if ((g === 'night' || g === 'wolf') && now === 'guard' && Wl && sp && (sp.get('silver') || 0) >= 100) { const n = g === 'night' ? 3 : 2; if (sp.consume('silver', n, w.tickCount, t('夜班津貼'), 'myth')) { Wl.add(w, c, n); X.st.night = Math.round((X.st.night + n) * 100) / 100; } }
        }
        for (const id of Object.keys(X.jobs)) if (!w.myth.g[id]) delete X.jobs[id];
    }
    // 神裔世家:天生帶著基因、家裡有錢 → 士紳
    function elite(w, a) { const e = w?.myth?.g?.[a?.agentId]; if (!e?.born) return false; return (WL()?.get(w, a) || 0) >= 100 || all2(w).some(o => (a._parentNames || []).includes(o.name) && (WL()?.get(w, o) || 0) >= 300); }
    const all2 = (w) => npcs(w);
    // ---------- 提案 ----------
    function proposals(w, X, d) {
        const P = w.proposals; if (!P?._createWith) return; const busy = (k) => (P.items || []).some(p => p.kind === k && ['open', 'shelved', 'approved'].includes(p.status));
        if (!w.myth?.ban) X.banSince = null; else if (X.banSince == null) X.banSince = d;
        const G = X.grp.guild; const L = G && w.agents[G.leader]; if (!L || L.isDead) return;
        const hurt = X.st.fired + X.st.wrongful + X.st.outcast + X.st.boycott + X.st.hunts;
        if (!X.rights && hurt > 0 && !busy('gene_rights') && d - (X.lastRights ?? -99) >= 30) { X.lastRights = d;
            P._createWith(w, d, { kind: 'gene_rights', key: 'gene_rights:' + d, jobs: [], make: () => ({ kind: 'gene_rights', key: 'gene_rights:' + d, tk: '神裔平權令', tp: {}, dk: '{p}說神裔一再被辭退、被私刑、被趕出教門，提議立法：不准因為基因歧視雇用，抓人要先交給守衛。', dp: { p: L.name }, cost: {}, category: 'people', jobBias: ['doctor', 'researcher'] }) }, L); }
        if (w.myth?.ban && d - X.banSince >= 30 && (G.members || []).length >= 3 && !busy('gene_unban') && d - (X.lastUnban ?? -99) >= 30) { X.lastUnban = d;
            P._createWith(w, d, { kind: 'gene_unban', key: 'gene_unban:' + d, jobs: [], make: () => ({ kind: 'gene_unban', key: 'gene_unban:' + d, tk: '解除基因編輯禁令', tp: {}, dk: '{p}說禁令只是把人逼去更危險的地下診所，提議解除禁令，改回基因實驗室管理。', dp: { p: L.name }, cost: {}, category: 'people', jobBias: ['researcher'] }) }, L); }
    }
    function vote(w, p, a) {
        const g = !!gene(w, a); let s = att(w, a) / 25 + (Math.random() - 0.5) * 2; if (g) s += 4; if (has(a, 'kind')) s += 1; if (groupOf(w, a) === 'pure') s -= 3;
        if (p.kind === 'gene_unban') { const R = relOf(w, a); if (R && stanceOf(w, R) === 'blas' && piety(w, a) >= 60) s -= 2; if ((w.myth?.inc || []).some(x => x[3] && day(w) - x[0] <= 30)) s -= 1; }
        return { v: s > 0 ? 'for' : 'against', why: s > 0 ? (g ? 'myally' : 'kind') : 'myfear' };
    }
    function groupVote(w, p, a) {
        const mine = groupOf(w, a); if (!mine) return null;
        if (p.kind === 'gene_ban' || p.kind === 'myth_exile') return mine === 'pure' ? 'for' : 'against';
        const pg = groupOf(w, w.agents[p.proposerId]); if (!pg || p.proposerId === a.agentId) return null; return pg === mine ? 'for' : 'against';
    }
    function rights(w) { const X = S(w); X.rights = true; X.rightsAt = day(w); log(w, '🤝 神裔平權令通過了：老闆不准因為基因辭退人，抓人要先交給守衛。', {}); return t('神裔平權令生效'); }
    function unban(w) { if (!w.myth) return ''; w.myth.ban = false; log(w, '🔓 基因編輯禁令解除了，地下診所的生意一落千丈。', {}); return t('基因編輯禁令解除了'); }
    // 選舉:候選人是神裔或神裔會的人 → 支持神裔的人加分、怕神裔的人扣分;純人派候選人反過來
    function bias(w, voter, cid) {
        if (!w.mythsoc || !active(w)) return 0; const c = w.agents[cid]; if (!c || !voter) return 0;
        const cg = groupOf(w, c) || (gene(w, c) ? 'guild' : null); if (!cg) return 0; const va = att(w, voter);
        return Math.max(-12, Math.min(12, cg === 'guild' ? va / 8 : -va / 8));
    }
    // ---------- 每天 ----------
    function daily(w) {
        if (!w.observerMode || !active(w)) return; const X = S(w), d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        const all = npcs(w); const carriers = all.filter(a => gene(w, a));
        for (const a of all) if (!gene(w, a) && typeof X.att[a.agentId] !== 'number') X.att[a.agentId] = initAtt(w, a, carriers);
        heredity(w, X, all); incidents(w, X, d, all); reveal(w, X, d, all); faith(w, X, d, all, carriers);
        groups(w, X, d, all, carriers); dynamics(w, X, d, all, carriers); work(w, X, d, carriers); proposals(w, X, d);
    }
    // ---------- 顯示與 AI ----------
    function view(w) {
        const X = S(w), all = npcs(w); const carriers = all.filter(a => gene(w, a)); const others = all.filter(a => !gene(w, a));
        const dist = { fear: 0, mid: 0, ok: 0 }; for (const a of others) { const v = att(w, a); if (v <= -25) dist.fear++; else if (v >= 25) dist.ok++; else dist.mid++; }
        const G = (k) => { const g = X.grp[k]; if (!g) return null; const L = w.agents[g.leader]; return { n: (g.members || []).filter(id => w.agents[id] && !w.agents[id].isDead).length, leader: L ? t(L.name) : '', lid: g.leader }; };
        const rels = (w.faith?.rels || []).map(R => ({ name: t(R.name[0]), st: stanceOf(w, R), cult: !!R.myth, saint: R.saint && w.agents[R.saint] ? t(w.agents[R.saint].name) : '' })).filter(r => r.st !== 'neutral');
        const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, a) => s + (WL()?.get(w, a) || 0), 0) / xs.length) : 0);
        const lv = (a) => { try { return typeof CLASS !== 'undefined' && w.classes ? CLASS.level(w, a) : 1; } catch (e) { return 1; } };
        const jobs = {}; for (const c of carriers) { const k = c.job?.key; if (k) jobs[k] = (jobs[k] || 0) + 1; }
        const hunts = X.hunts.slice(-4).reverse().map(h => ({ sus: w.agents[h.sus] ? t(w.agents[h.sus].name) : '', right: !!h.right, wrong: !!h.wrong, k: h.kind }));
        return { dist, pure: G('pure'), guild: G('guild'), rels, rights: !!X.rights, st: X.st, wealth: { c: avg(carriers), o: avg(others) }, gentry: { c: carriers.filter(a => lv(a) >= 3).length, cn: carriers.length, o: others.filter(a => lv(a) >= 3).length, on: others.length }, elite: carriers.filter(a => elite(w, a)).length, half: carriers.filter(a => w.myth.g[a.agentId]?.half).length, jobs, hunts };
    }
    function agentView(w, a) { if (!active(w) || !a) return null; const g = gene(w, a); return { att: att(w, a), label: g ? '' : attLabel(att(w, a)), group: groupOf(w, a), half: !!(g && w.myth.g[a.agentId]?.half), elite: elite(w, a) }; }
    function brief(w, a) {
        if (!active(w) || !w.mythsoc) return ''; const parts = []; const g = gene(w, a);
        if (!g) parts.push(t('你對神裔的看法') + t('：') + t(attLabel(att(w, a))));
        const gp = groupOf(w, a); if (gp) { const L = w.agents[w.mythsoc.grp[gp]?.leader]; parts.push(fill(gp === 'pure' ? '你是純人派的一員（帶頭的是{l}）' : '你是神裔會的一員（帶頭的是{l}）', { l: L?.name || '' })); }
        const R = relOf(w, a); if (R) { const st = stanceOf(w, R); if (st !== 'neutral') parts.push(fill(st === 'blas' ? '你的宗教{r}認為神話基因是褻瀆神明' : '你的宗教{r}認為神裔是神選之人', { r: R.name[0] })); }
        if (g && w.myth.g[a.agentId]?.half) parts.push(t('你是混血神裔，能力和副作用都只有一半'));
        if (elite(w, a)) parts.push(t('你出身神裔世家'));
        return parts.join(t('；'));
    }
    function townBrief(w) {
        if (!active(w) || !w.mythsoc) return ''; const v = view(w); const out = [];
        if (v.pure) out.push(fill('純人派 {n} 人（{l}帶頭）', { n: v.pure.n, l: v.pure.leader })); if (v.guild) out.push(fill('神裔會 {n} 人（{l}帶頭）', { n: v.guild.n, l: v.guild.leader }));
        if (v.rights) out.push(t('神裔平權令已通過')); if (v.st.wrongful) out.push(fill('獵人隊冤案 {n} 件', { n: v.st.wrongful }));
        return out.join(t('；'));
    }
    return { S, active, att, initAtt, attLabel, stanceOf, groupOf, isPure, bump, huntInfo, huntBy, reveal, onWedding, geneFit, bossOf, elite, vote, groupVote, rights, unban, bias, daily, view, agentView, brief, townBrief, press, FIT, CULT };
})();

// ---------- 接上其他系統 ----------
if (typeof MYTH !== 'undefined') {
    const _wm = MYTH.workMult; // 混血:好處只有一半(發瘋 0.1 不變)
    MYTH.workMult = (w, a) => { const m = _wm(w, a); const e = w?.myth?.g?.[a?.agentId]; return e?.half && m !== 0.1 ? 1 + (m - 1) / 2 : m; };
}
if (typeof HEALTH !== 'undefined') {
    const _jf = HEALTH.jobFit; HEALTH.jobFit = (a, k) => { const base = _jf(a, k); try { const w = HEALTH.W || MYTH?.W; return w ? base * MYTHSOC.geneFit(w, a, k) : base; } catch (e) { return base; } };
}
if (typeof CEREMONY !== 'undefined') {
    const _pw = CEREMONY.planWedding; CEREMONY.planWedding = function (w, a, b, ...rest) { const c = _pw.call(this, w, a, b, ...rest); try { MYTHSOC.onWedding(w, c, a, b); } catch (e) { console.warn('[MythSoc] wedding', e); } return c; };
}
if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    myth_hated: { mood: -6, opinion: 0, days: 5, label: t('被當成怪物對待') },
    myth_cast_out: { mood: -8, opinion: 0, days: 7, label: t('被逐出教門') },
    wed_boycott: { mood: -5, opinion: 0, days: 5, label: t('家人不肯來婚禮') },
});
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { myfear: '怕神裔', myally: '神裔要互相照應', mygroup: '派系的立場' });
if (typeof PROPOSAL_KINDS !== 'undefined') { PROPOSAL_KINDS.gene_rights = { icon: '🤝', label: '神裔平權令' }; PROPOSAL_KINDS.gene_unban = { icon: '🔓', label: '解除基因禁令' }; }
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) MYTHSOC.daily(w); } catch (e) { console.warn('[MythSoc] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) {
        if (p.kind === 'gene_rights' || p.kind === 'gene_unban') { const r = MYTHSOC.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; }
        const out = _rv.call(this, w, p, a, ...rest);
        try { if (w.mythsoc && MYTHSOC.active(w)) { const v = MYTHSOC.groupVote(w, p, a); if (v && Math.random() < 0.6) { p.votes[a.agentId] = v; (p.why || (p.why = {}))[a.agentId] = 'mygroup'; } } } catch (e) {}
        return out;
    };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = MYTHSOC.brief(world, a); if (s) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = MYTHSOC.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.mythsoc = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.mythsoc) { const X = this.mythsoc; d.mythsoc = { att: X.att, rel: X.rel, grp: X.grp, hunts: X.hunts, jobs: X.jobs, pd: X.pd, st: X.st, rights: X.rights || false, rightsAt: X.rightsAt || 0, incDay: X.incDay, lastRights: X.lastRights, lastUnban: X.lastUnban, banSince: X.banSince ?? null, cult: X.cult || null }; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.mythsoc = (data?.mythsoc && typeof data.mythsoc === 'object') ? data.mythsoc : null; } catch (e) {} return r; };
}
