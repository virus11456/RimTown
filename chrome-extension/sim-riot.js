// v11.0.0 市場與第四權（第一段）之七：出人命之後——死因怎麼連到店、人群、暴動
// - 有人用了店裡的東西死了，鎮上的人一開始不一定知道為什麼。死因連到店的四條路：報上登出來、家屬本來就知道這家店有問題、
//   醫生看出來並且說了（riotDoctor，他自己決定跟家屬說、跟報社說、還是不說）、同一家接連出事讓家屬起疑。
// - 連上之後才會燒起來：接上所有災難共用的災後反應（AFTERMATH.shock），家屬、出過事的客人、跟死者親近的人各自決定（riotAct）：
//   守靈／到店門口／砸店搶錢櫃／找東家算帳／要賠命錢／提案審判／勸大家冷靜。
// - 東家自己決定（riotOwner）：出面道歉賠錢／躲起來／逃出鎮／雇人守店／怪到夥計頭上／找首長求保護。
// - 人到齊的那天（有葬禮就是出殯那天，隊伍直接走到店門口）：衛兵隊長（riotGuard）擋住／站到一邊／跟著人群；
//   首長（riotMayor）當場抓人查辦／叫衛兵鎮壓／出面安撫答應立法／躲著。
// - 結果是真的：店被砸要停業修理、錢櫃被搶（錢到搶的人手上）、東家被打傷或打死。處理不好，氣會轉到首長身上（接民怨與罷免）。
// - 只有一個人死、沒人知道原因，不會鬧。針對的是一家店和它的東家，不是推翻政府。
// 必須在 sim-camps.js 之後載入。
'use strict';
const RIOT = (() => {
    if (typeof DECIDE === 'undefined' || typeof DEAL === 'undefined') return null;
    const WRECK_DAYS = 7, REPAIR = 30, BLOOD = 40, HIRE = 20, KEEP = 30;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const honesty = (a) => { try { return DARK.honesty(a); } catch (e) { return 2; } };
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const REF = 1, G = 'deal';
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => a && !a.isPlayer && !a.isDead);
    const live = (w, id) => { const a = w.agents[id]; return a && !a.isDead && !(w.isAway?.(id)) ? a : null; };
    const mem = (w, a, k, p, imp = 6) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('politics', k, p || {}, who || ''); } catch (e) {} };
    const rel = (a, b) => { try { return a.relationships.getOrCreate(b.agentId, b.name); } catch (e) { return null; } };
    const mayor = (w) => { try { return w.election?.currentMayor?.(w) || null; } catch (e) { return null; } };
    const LW = () => (typeof DEALLAW !== 'undefined' && DEALLAW ? DEALLAW : null);
    const UN = () => (typeof UNREST !== 'undefined' && UNREST ? UNREST : null);
    const on = (w) => { try { return DECIDE.on(w) && DEAL.on(w); } catch (e) { return false; } };
    const guards = (w) => npcs(w).filter(a => a.job?.key === 'guard' && !(w.isAway?.(a.agentId))).sort((x, y) => (y.age ?? 30) - (x.age ?? 30));
    const sname = (key) => DEAL.sname(key);
    function S(w) {
        if (!w.riot || typeof w.riot !== 'object') w.riot = { cases: {}, n: 0, hist: [], lastDay: null, st: { deaths: 0, linked: 0, riots: 0, wrecked: 0, looted: 0, beaten: 0, killed: 0, quiet: 0, sorry: 0, fled: 0, arrests: 0 } };
        const R = w.riot; R.cases = R.cases || {}; R.hist = R.hist || []; R.st = R.st || {}; return R;
    }
    // 死者的家人與最親近的人（要在人還沒從名單上拿掉之前算）
    function kinIds(w, a) {
        const out = new Set(); try { for (const f of (MONEY.familyOf(w, a) || [])) if (f !== a && !f.isDead) out.add(f.agentId); } catch (e) {}
        const close = npcs(w).filter(x => x !== a && aff(x, a) >= 60).sort((x, y) => aff(y, a) - aff(x, a)).slice(0, 3); for (const x of close) out.add(x.agentId);
        return [...out];
    }
    const note = (w, C, k, p) => { C.log.push({ d: day(w), k, p: p || {} }); if (C.log.length > 24) C.log.shift(); };
    const kinOf = (w, C) => [...new Set(C.dead.flatMap(x => x.kin || []))].map(id => live(w, id)).filter(Boolean);
    const isKin = (C, a) => C.dead.some(x => (x.kin || []).includes(a.agentId));
    const hurtAt = (w, C, a) => DEAL.S(w).harm.some(h => h.id === a.agentId && h.key === C.key && !h.dead);
    const crowdOf = (w, C) => C.who.map(x => live(w, x.id)).filter(Boolean);
    const place = (w) => (w.townMap?.locations?.market ? 'market' : 'town_square');
    // 把死因連到店
    function link(w, C, how) {
        if (C.linkedD != null) return false; const R = S(w), d = day(w); const o = live(w, C.oid); C.linkedD = d; C.how = how; C.stage = 'anger'; R.st.linked = (R.st.linked || 0) + 1;
        for (const dd of (DEAL.S(w).deaths || [])) if (dd.key === C.key) dd.linked = true;
        const kin = kinOf(w, C); const f = C.fid ? DEAL.factOf(w, C.fid) : null; for (const a of kin) { if (f) DEAL.learn(w, f, a, 'victim'); mem(w, a, '{n}是用了{s}的東西才走的。', { n: C.dead[C.dead.length - 1].name, s: sname(C.key) }, 9); if (o) rel(a, o)?.modifyAffinity?.(-30); }
        note(w, C, how === 'paper' ? '報上登出來，大家才知道人是怎麼死的' : how === 'doctor' ? '醫生告訴家屬：人是吃用了店裡的東西才死的' : how === 'kin' ? '家屬本來就覺得這家店有問題' : '同一家接連出事，家屬起了疑', {});
        log(w, '🕯️ 鎮上傳開了：{n}是用了{s}的東西才死的。', { n: C.dead.map(x => t(x.name)).join(t('、')), s: sname(C.key) }, o?.name || '');
        try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: 'shopdeath', cause: fill('{s}的東西害死了人', { s: sname(C.key) }), sev: clampN(C.dead.length, 1, 3), who: kin, blame: o || null }); } catch (e) { console.warn('[Riot] shock', e); }
        // 人到齊的那天：有還沒辦的葬禮就是出殯那天
        let fd = null; try { for (const c of (w.ceremony?.list || [])) if (c.kind === 'funeral' && c.status === 'planned' && C.dead.some(x => x.id === c.of) && c.day >= d) fd = fd == null ? c.day : Math.min(fd, c.day); } catch (e) {}
        C.day = fd != null ? Math.max(fd, d + 1) : d + 1; C.funeral = fd != null;
        if (o) DECIDE.enqueue(w, o, 'riotOwner', { key: C.key });
        ask(w, C); return true;
    }
    // 問哪些人：家屬、在這家出過事的、讀到報導的、跟死者要好的。一個人只問一次
    function ask(w, C) {
        const D = DEAL.S(w); const f = C.fid ? DEAL.factOf(w, C.fid) : null; const seen = new Set(C.asked); const out = []; const add = (a) => { if (a && !seen.has(a.agentId) && a.agentId !== C.oid && (a.age ?? 30) >= 16) { seen.add(a.agentId); out.push(a); } };
        for (const a of kinOf(w, C)) add(a); for (const h of D.harm) if (h.key === C.key && !h.dead) add(live(w, h.id));
        if (f) for (const a of DEAL.knowers(w, f)) add(a);
        const cap = C.how === 'paper' ? 16 : 10; for (const a of out.slice(0, cap)) { C.asked.push(a.agentId); DECIDE.enqueue(w, a, 'riotAct', { key: C.key }); }
    }
    function caseFor(w, key, dd) {
        const R = S(w); let C = R.cases[key]; const o = DEAL.owner(w, key);
        if (!C || C.stage === 'after') { C = R.cases[key] = { id: 'R' + (++R.n), key, oid: o?.agentId || null, oname: o?.name || '', fid: dd.fid || null, d0: day(w), dead: [], linkedD: null, how: null, stage: 'grief', day: null, funeral: false, asked: [], who: [], claims: [], calm: 0, owner: null, guard: null, mayor: null, hired: 0, blamed: null, log: [] }; }
        return C;
    }
    // ---------- 每天 ----------
    function daily(w) {
        if (!on(w)) return; const R = S(w), d = day(w); if (R.lastDay === d) return; R.lastDay = d; const D = DEAL.S(w);
        for (const dd of (D.deaths || [])) {
            if (dd.rx) continue; dd.rx = 1; if (!DEAL.owner(w, dd.key)) continue; const C = caseFor(w, dd.key, dd); C.dead.push({ id: dd.id, name: dd.name, d: dd.d, kin: dd.kin || [] }); if (!C.fid && dd.fid) C.fid = dd.fid; R.st.deaths = (R.st.deaths || 0) + 1;
            note(w, C, '{n}死了（{c}）', { n: dd.name, c: dd.cause || '' });
            if (C.linkedD != null) { ask(w, C); continue; }
            const doc = npcs(w).find(a => a.job?.key === 'doctor' && !(w.isAway?.(a.agentId))); if (doc && !C.doc) { C.doc = doc.agentId; DECIDE.enqueue(w, doc, 'riotDoctor', { key: dd.key }); }
        }
        for (const C of Object.values(R.cases)) {
            if (C.stage === 'grief') {
                const f = C.fid ? DEAL.factOf(w, C.fid) : null; const kin = kinOf(w, C);
                if ((D.deaths || []).some(x => x.key === C.key && x.linked && C.dead.some(y => y.id === x.id)) || f?.pub) link(w, C, 'paper'); // 只看這一次的死者（同一家店以前的事不算）
                else if (C.docSaid) link(w, C, 'doctor');
                else if (f && kin.some(a => f.knows[a.agentId])) link(w, C, 'kin');
                else if ((C.dead.length >= 2 || D.harm.filter(h => h.key === C.key && !h.dead && d - h.d <= 30).length >= 2) && Math.random() < 0.5) link(w, C, 'pattern');
                else if (d - C.d0 > KEEP) { C.stage = 'after'; R.st.quiet = (R.st.quiet || 0) + 1; note(w, C, '沒有人知道為什麼，日子照舊過', {}); finish(w, C, 'unknown'); }
            } else if (C.stage === 'anger' && d >= C.day) gatherDay(w, C);
            else if (C.stage === 'riot' && d > C.day) resolve(w, C);
        }
        for (const [key, C] of Object.entries(R.cases)) if (C.stage === 'after' && d - (C.endD ?? d) > KEEP) delete R.cases[key];
        try { DECIDE.drain(w, DECIDE.S(w), d); } catch (e) {}
    }
    // 人到齊的那天
    function gatherDay(w, C) {
        const R = S(w), d = day(w); const o = live(w, C.oid); const M = mayor(w);
        if (C.owner === 'fled' && o) { try { if (w.leaveTown?.(o.agentId, fill('{s}出了人命，連夜逃走', { s: sname(C.key) }))) { R.st.fled = (R.st.fled || 0) + 1; note(w, C, '{o}連夜逃出了鎮', { o: C.oname }); log(w, '🌙 {o}連夜逃出了鎮。', { o: C.oname }, C.oname); } else C.owner = 'hid'; } catch (e) { C.owner = 'hid'; } }
        for (const id of C.claims) if (C.owner !== 'sorry' && !C.who.some(x => x.id === id)) C.who.push({ id, act: 'gather' }); // 要不到賠命錢的人也到場
        const crowd = crowdOf(w, C);
        if (crowd.length < 3) { C.stage = 'after'; R.st.quiet = (R.st.quiet || 0) + 1; note(w, C, C.owner === 'sorry' ? '東家道了歉、賠了錢，沒有鬧起來' : '只有 {n} 個人到場，沒有鬧起來', { n: crowd.length }); return finish(w, C, 'quiet'); }
        C.stage = 'riot'; R.st.riots = (R.st.riots || 0) + 1; const now = w.tickCount; const pl = place(w); for (const a of crowd) if (!a._ceremony || !C.funeral) a._thingGo = { place: pl, from: now + (C.funeral ? 8 : 0), until: now + 28, why: 'protest', id: C.id };
        note(w, C, C.funeral ? '出殯那天，送葬的隊伍 {n} 人直接走到{s}門口' : '{n} 人聚到{s}門口', { n: crowd.length, s: sname(C.key) });
        log(w, C.funeral ? '⚱️ 出殯的隊伍沒有散，{n} 人直接走到{s}門口，要{o}出來。' : '🔥 {n} 人聚到{s}門口，要{o}出來。', { n: crowd.length, s: sname(C.key), o: C.oname }, C.oname);
        try { w.dailyNews?.collectEvent?.('politics', fill('{n} 人圍住{s}', { n: crowd.length, s: sname(C.key) }), 8, [C.oname]); } catch (e) {}
        const gs = guards(w); if (gs.length) DECIDE.enqueue(w, gs[0], 'riotGuard', { key: C.key });
        if (M && M.agentId !== C.oid) DECIDE.enqueue(w, M, 'riotMayor', { key: C.key });
    }
    // 隔天：算結果
    function resolve(w, C) {
        const R = S(w), d = day(w); const o = live(w, C.oid); const M = mayor(w); const crowd = crowdOf(w, C); const gs = guards(w);
        let smash = C.who.filter(x => x.act === 'smash' && live(w, x.id)).length, beat = C.who.filter(x => x.act === 'beat' && live(w, x.id)).length;
        const soft = (C.owner === 'sorry' ? 0.3 : 1) * (C.mayor === 'arrest' ? 0.2 : C.mayor === 'calm' ? 0.5 : 1); smash = Math.floor(smash * soft + 1e-9); beat = Math.floor(beat * soft + 1e-9); // 東家認了錯、首長抓了人：零星幾個想動手的會被旁人拉住
        let calm = C.calm || 0; while (calm > 0 && smash + beat > 0) { if (smash >= beat) smash--; else beat--; calm--; }
        if (C.guard === 'join') smash += 2;
        const def = (C.guard === 'block' ? gs.length * 2 : 0) + (C.hired || 0); let out = 'held';
        if (smash + beat > def && smash + beat > 0) {
            out = 'wrecked'; R.st.wrecked = (R.st.wrecked || 0) + 1; let looted = 0;
            try { if (LW()) { LW().S(w).closed[C.key] = d + WRECK_DAYS; } } catch (e) {} C.wreckUntil = d + WRECK_DAYS;
            if (o) { const pay = Math.min(REPAIR, Math.floor(cash(w, o))); if (pay > 0 && WALLET.take(w, o, pay)) { const cp = npcs(w).find(a => a.job?.key === 'carpenter' && a !== o); if (cp) WALLET.add(w, cp, pay); else w.stockpile?.add?.('silver', pay, w.tickCount, t('店面修理')); }
                const looters = C.who.filter(x => x.act === 'smash').map(x => live(w, x.id)).filter(Boolean); for (const a of looters) { const n = Math.min(15, Math.floor(cash(w, o) * 0.5 / Math.max(1, looters.length))); if (n > 0 && WALLET.pay(w, o, a, n)) { looted += n; mem(w, a, '我跟著砸了{s}，從錢櫃拿了 {n} 銀幣。', { s: sname(C.key), n }, 8); } }
                R.st.looted = Math.round(((R.st.looted || 0) + looted) * 100) / 100;
                if (beat > 0 && C.owner !== 'fled' && !(w.civic?.jail?.[o.agentId] > d)) { R.st.beaten = (R.st.beaten || 0) + 1; C.beaten = true; try { HEALTH.hurt(w, o, 'h', 0.4); HEALTH.hurt(w, o, 'f', 0.3); } catch (e) {} o.moodModifier = (o.moodModifier || 0) - 15; mem(w, o, '人群衝進店裡，把我打了一頓。', {}, 10);
                    if (beat >= 3 && Math.random() < 0.15) { C.killed = true; R.st.killed = (R.st.killed || 0) + 1; try { o._deathCause = t('被憤怒的人群打死'); w.lifecycle._killNpc(w, o); } catch (e) { console.warn('[Riot] kill', e); } } } }
            if (C.guard === 'block') for (const g of gs) if (Math.random() < 0.3) { try { HEALTH.hurt(w, g, 'h', 0.2); } catch (e) {} }
            note(w, C, C.killed ? '人群衝進店裡：店被砸了、錢櫃被搶走 {n} 銀幣，{o}被打死' : C.beaten ? '人群衝進店裡：店被砸了、錢櫃被搶走 {n} 銀幣，{o}被打傷' : '人群衝進店裡：店被砸了、錢櫃被搶走 {n} 銀幣', { n: looted, o: C.oname });
            log(w, C.killed ? '🔥 人群衝進{s}：店被砸了，{o}被活活打死。' : '🔥 人群衝進{s}：店被砸了、錢櫃被搶，要修理 {d} 天，這幾天由公所臨時代賣。', { s: sname(C.key), o: C.oname, d: WRECK_DAYS }, C.oname);
            try { w.dailyNews?.collectEvent?.('politics', fill('{s}被憤怒的人群砸了', { s: sname(C.key) }), 9, [C.oname]); } catch (e) {}
        } else {
            note(w, C, C.guard === 'block' ? '衛兵擋在店門口，人群沒有衝進去' : C.mayor === 'arrest' ? '首長當場把{o}抓了起來，人群散了' : C.hired ? '東家雇的人守在門口，人群沒有衝進去' : '人群在店門口站了一天，沒有動手', { o: C.oname });
            log(w, '🕯️ {s}門口的人群到天黑才散，沒有動手。', { s: sname(C.key) }, C.oname);
        }
        // 之後：招牌臭了、立規定更容易、處理不好的首長被記上一筆
        if (o && !o.isDead) for (const a of npcs(w)) if (a !== o && (crowd.includes(a) || Math.random() < 0.4)) rel(a, o)?.modifyAffinity?.(-10);
        try { if (LW()) { const L = LW().S(w); delete L.last.deal_check; } } catch (e) {}
        if (M && (C.mayor === 'hid' || C.mayor === 'suppress' || C.mayor == null)) for (const a of kinOf(w, C).concat(crowd).slice(0, 12)) UN()?.anger(w, a, M, C.mayor === 'suppress' ? 2 : 1, 'death');
        C.stage = 'after'; finish(w, C, out);
    }
    function finish(w, C, out) { const R = S(w); C.out = out; C.endD = day(w); R.hist.push({ id: C.id, key: C.key, d: day(w), owner: C.oname, dead: C.dead.length, crowd: C.who.length, out, how: C.how, log: C.log.slice() }); if (R.hist.length > 10) R.hist.shift(); }

    // ================= 醫生看出來了 =================
    DECIDE.kind('riotDoctor', {
        title: '你看得出這個人是怎麼死的', scan: false, pri: 1.5, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const C = S(w).cases[c.key]; const o = live(w, C?.oid); if (!C || !o || !C.dead.length) return ''; const dd = C.dead[C.dead.length - 1];
            return fill('{n}死了。你是醫生，看得出來是吃用了{s}的東西才出的事。家屬還不知道。東家是{o}{fr}。', { n: dd.name, s: sname(C.key), o: o.name, fr: aff(a, o) >= 40 ? '，你跟他有交情' : { raw: '' } }); },
        options(w, a, c) {
            const C = S(w).cases[c.key]; const o = live(w, C?.oid); if (!C || C.stage !== 'grief' || !o || a.job?.key !== 'doctor') return []; const hon = honesty(a); const fr = aff(a, o) >= 40 ? 0.3 : 1; const f = C.fid ? DEAL.factOf(w, C.fid) : null; const paper = typeof TIPS !== 'undefined' && TIPS && TIPS.papers(w).length > 0;
            const out = [
                { id: 'quiet', quiet: true, mute: true, text: '不說，死因寫成急病', say: '沒有多說死因', why: '說了，這個鎮要出大事', base: REF + (fr < 1 ? 0.5 : 0), lean: { safe: 0.4 }, run: (w2) => { note(w2, C, '醫生看出來了，沒有說', {}); return null; } },
                { id: 'family', text: '把實情告訴家屬', say: '把死因告訴了家屬', why: '人是怎麼走的，家裡的人該知道', base: REF + tilt(clampN(0.45 * (hon >= 4 ? 1.5 : hon <= 1.5 ? 0.5 : 1) * fr, 0.03, 0.97)), lean: { bond: 0.3, safe: -0.3 }, run: (w2) => { C.docSaid = true; return { k: '告訴了家屬' }; } },
            ];
            if (paper && f) out.push({ id: 'paper', quiet: true, mute: true, text: '不具名寫信給報社', say: '私下把死因告訴了報社', why: '不能讓更多人出事', base: REF + tilt(clampN(0.15 * (hon >= 4 ? 1.6 : 1) * fr, 0.01, 0.8)), lean: { face: 0.1, safe: -0.1 }, run: (w2, a2) => { DEAL.learn(w2, f, a2, 'victim'); return DEALASK.tip(w2, a2, f, true) ? { k: '寫信給報社了' } : null; } });
            return out;
        },
    });
    // ================= 家屬、出過事的人、跟死者要好的人 =================
    DECIDE.kind('riotAct', {
        title: '人是用了那家店的東西才死的', scan: false, pri: 1.7, aiGroup: G, aiKind: 10,
        when() { return null; },
        facts(w, a, c) { const C = S(w).cases[c.key]; const o = w.agents[C?.oid]; if (!C || C.stage !== 'anger') return ''; const kin = isKin(C, a); const hurt = hurtAt(w, C, a);
            return fill('{n}是用了{s}的東西才死的{m}。{me}東家{o}{ow}。{fu}現在有 {k} 個人說要去店門口。', { n: { raw: C.dead.map(x => t(x.name)).join(t('、')) }, s: sname(C.key), m: C.dead.length >= 2 ? { k: '，前後 {n} 條人命', p: { n: C.dead.length } } : { raw: '' },
                me: kin ? '走的是你的親人。' : hurt ? '你自己也在這家出過事。' : { raw: '' }, o: C.oname, ow: C.owner === 'sorry' ? '已經出面道歉、賠了錢' : C.owner === 'fled' ? '聽說想跑' : C.owner === 'guarded' ? '雇了人守在店門口' : C.owner === 'blamed' ? '說都是夥計做的' : '到現在沒有一句話',
                fu: C.funeral ? '出殯就在這幾天。' : { raw: '' }, k: C.who.length }); },
        options(w, a, c) {
            const C = S(w).cases[c.key]; if (!C || C.stage !== 'anger' || C.who.some(x => x.id === a.agentId) || !C.asked.includes(a.agentId)) return []; const o = live(w, C.oid); const kin = isKin(C, a); const hurt = hurtAt(w, C, a); const f = C.fid ? DEAL.factOf(w, C.fid) : null;
            const m = (kin ? 2.5 : hurt ? 1.5 : 1) * (1 + 0.5 * (C.dead.length - 1)) * (C.owner === 'sorry' ? 0.3 : 1) * (C.how === 'paper' ? 1.3 : 1) * (C.funeral ? 1.4 : 1) * (o && aff(a, o) >= 40 ? 0.3 : 1); const hot = has(a, 'abrasive') ? 2 : has(a, 'kind') ? 0.3 : 1; const shy = has(a, 'shy') ? 0.5 : 1;
            const join = (act) => (w2, a2) => { C.who.push({ id: a2.agentId, act }); return { k: '說好要去' }; };
            const out = [
                { id: 'mourn', quiet: true, text: '守靈，不去鬧', say: '留在家裡守靈', why: '人走了，鬧也回不來', base: REF + (has(a, 'stoic') ? 0.4 : 0), lean: { safe: 0.3, bond: 0.1 }, run: () => null },
                { id: 'gather', text: '到店門口，要東家出來', say: { k: '說要去{s}門口', p: { s: sname(C.key) } }, why: '要他當面講清楚', base: REF + tilt(clampN(0.3 * m * shy, 0.03, 0.97)), lean: { bond: 0.3, safe: -0.2 }, run: join('gather') },
            ];
            if (kin || C.dead.length >= 2) {
                out.push({ id: 'smash', text: '砸了那家店', say: { k: '說要去砸了{s}', p: { s: sname(C.key) } }, why: '這種店不能再開下去', base: REF + tilt(clampN(0.06 * m * hot * shy, 0.004, 0.9)), lean: { face: 0.2, safe: -0.6 }, run: join('smash') });
                out.push({ id: 'beat', text: '找東家算帳', say: { k: '說要找{o}算帳', p: { o: C.oname } }, why: '一命要有一命的交代', base: REF + tilt(clampN(0.04 * m * hot * (kin ? 2 : 1), 0.004, 0.9)), lean: { face: 0.2, safe: -0.7 }, run: join('beat') });
            }
            if (kin && o && !C.claims.includes(a.agentId)) out.push({ id: 'pay', text: '要東家賠命錢', say: { k: '去找{o}要賠命錢', p: { o: C.oname } }, why: '人沒了，一家子還要過日子', base: REF + tilt(clampN(0.25 * (cash(w, a) < 40 ? 1.6 : 1), 0.03, 0.9)), lean: { gain: 0.4 }, run: (w2, a2) => { C.claims.push(a2.agentId); note(w2, C, '{a}去要賠命錢', { a: a2.name }); return { k: '開口要了' }; } });
            if (LW() && f && !f.tried && o) out.push({ id: 'trial', text: { k: '提案審判{o}', p: { o: C.oname } }, say: { k: '提案審判{o}', p: { o: C.oname } }, why: '照規矩來，讓全鎮評理', base: REF + tilt(clampN(0.15 * m * (honesty(a) >= 4 ? 1.5 : 1), 0.02, 0.9)), lean: { face: 0.3 }, run: (w2, a2) => (LW().trial(w2, f, a2) ? { k: '提案送出去了' } : { k: '已經有人提了' }) });
            if (!kin) out.push({ id: 'calm', quiet: true, text: '勸大家冷靜，不要動手', say: '到處勸大家別動手', why: '再出一條人命，誰都不好過', base: REF + tilt(clampN(0.12 * (has(a, 'kind') ? 2 : 1) * (has(a, 'stoic') ? 1.5 : 1) * (hurt ? 0.5 : 1), 0.01, 0.8)), lean: { bond: 0.2, safe: 0.1 }, run: (w2, a2) => { C.calm = (C.calm || 0) + 1; note(w2, C, '{a}到處勸大家別動手', { a: a2.name }); return { k: '去勸了' }; } });
            return out;
        },
    });
    // ================= 東家 =================
    DECIDE.kind('riotOwner', {
        title: '鎮上都說人是你害死的', scan: false, pri: 2, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const C = S(w).cases[c.key]; if (!C) return ''; const M = mayor(w); const st = DEAL.staff(w, C.key).filter(x => x !== a);
            return fill('鎮上傳開了：{n}是用了你{s}的東西才死的{m}。{fu}你手上有 {c} 銀幣。{st}{my}', { n: { raw: C.dead.map(x => t(x.name)).join(t('、')) }, s: sname(C.key), m: C.dead.length >= 2 ? { k: '，前後 {n} 條人命', p: { n: C.dead.length } } : { raw: '' }, fu: C.funeral ? '出殯就在這幾天，到時候人會很多。' : { raw: '' }, c: Math.floor(cash(w, a)),
                st: st.length ? { k: '店裡做事的有{x}。', p: { x: { raw: st.slice(0, 3).map(x => t(x.name)).join(t('、')) } } } : { raw: '' }, my: M && M !== a ? { k: '首長是{o}（你跟他{r}）。', p: { o: M.name, r: (() => { try { return (POWER.S(w).inf[M.agentId]?.[a.agentId] || 0) >= 20 ? '有金錢往來' : aff(a, M) >= 30 ? '彼此有交情' : '不熟'; } catch (e) { return '不熟'; } })() } } : { raw: '' } }); },
        options(w, a, c) {
            const C = S(w).cases[c.key]; if (!C || C.oid !== a.agentId || C.owner || C.stage !== 'anger') return []; const kin = kinOf(w, C); const soft = has(a, 'kind') || has(a, 'generous'), hard = has(a, 'abrasive') || has(a, 'greedy'); const st = DEAL.staff(w, C.key).filter(x => x !== a); const M = mayor(w); const need = Math.max(BLOOD, kin.length ? BLOOD : 0);
            const out = [{ id: 'hide', quiet: true, mute: true, text: '躲著不出面', say: '關起門來不見人', why: '這時候出去只會挨打', base: REF + 0.1, lean: { safe: 0.3, face: -0.3 }, run: (w2, a2) => { C.owner = 'hid'; note(w2, C, '{o}躲著不出面', { o: a2.name }); return { k: '躲起來了' }; } }];
            if (cash(w, a) >= need) out.push({ id: 'sorry', text: '出面道歉，賠錢給家屬，把做法改回來', say: '出面道歉並賠錢', why: '人命關天，躲不掉的', base: REF + tilt(clampN(0.25 * (soft ? 2.2 : 1) * (hard ? 0.3 : 1) * (C.dead.length >= 2 ? 1.3 : 1), 0.02, 0.95)), lean: { bond: 0.4, gain: -0.5 },
                run: (w2, a2) => { C.owner = 'sorry'; S(w2).st.sorry = (S(w2).st.sorry || 0) + 1; let paid = 0; const ks = kin.length ? kin : []; const each = ks.length ? Math.min(BLOOD, Math.floor(cash(w2, a2) * 0.6 / ks.length)) : 0; for (const k of ks) if (each > 0 && WALLET.pay(w2, a2, k, each)) { paid += each; rel(k, a2)?.modifyAffinity?.(8); mem(w2, k, '{o}來道歉，賠了 {n} 銀幣。', { o: a2.name, n: each }, 8); }
                    try { DEAL.setCut(w2, C.key, 0); } catch (e) {} note(w2, C, '{o}出面道歉，賠了 {n} 銀幣', { o: a2.name, n: paid }); log(w2, '🙇 {o}出面道歉，賠了家屬 {n} 銀幣。', { o: a2.name, n: paid }, a2.name); return { k: '道歉並賠了 {n} 銀幣', p: { n: paid } }; } });
            out.push({ id: 'flee', quiet: true, mute: true, text: '連夜逃出鎮', say: '收拾了細軟', why: '留下來會沒命', base: REF + tilt(clampN(0.05 * (C.dead.length >= 2 ? 2.5 : 1) * (has(a, 'neurotic') ? 2 : 1) * (soft ? 0.5 : 1), 0.004, 0.7)), lean: { safe: 0.5, face: -0.6 }, run: (w2, a2) => { C.owner = 'fled'; note(w2, C, '{o}打算連夜逃走', { o: a2.name }); return { k: '準備逃走' }; } });
            if (cash(w, a) >= HIRE) out.push({ id: 'hire', quiet: true, text: { k: '花 {n} 銀幣雇人守店', p: { n: HIRE } }, say: '雇了人守在店門口', why: '店是我的命根子', base: REF + tilt(clampN(0.2 * (hard ? 1.8 : 1), 0.02, 0.9)), lean: { safe: 0.2, gain: -0.1 },
                run: (w2, a2) => { const hs = npcs(w2).filter(x => x !== a2 && (x.age ?? 30) >= 18 && !isKin(C, x) && !C.asked.includes(x.agentId)).sort((x, y) => cash(w2, x) - cash(w2, y)).slice(0, 2); let n = 0; for (const h of hs) if (WALLET.pay(w2, a2, h, HIRE / 2)) n++; C.hired = n; C.owner = 'guarded'; note(w2, C, '{o}雇了 {n} 個人守店', { o: a2.name, n }); return { k: '雇了 {n} 個人', p: { n } }; } });
            if (st.length) out.push({ id: 'blame', text: { k: '說都是{x}自作主張', p: { x: st[0].name } }, say: { k: '說是{x}自作主張', p: { x: st[0].name } }, why: '總要有人扛', base: REF + tilt(clampN(0.1 * (hard ? 2.2 : 1) * (soft ? 0.2 : 1) * (honesty(a) >= 4 ? 0.2 : 1), 0.004, 0.8)), lean: { safe: 0.2, bond: -0.5 },
                run: (w2, a2) => { const s = st[0]; C.owner = 'blamed'; C.blamed = s.agentId; rel(s, a2)?.modifyAffinity?.(-40); mem(w2, s, '{o}把人命的事推到我頭上。', { o: a2.name }, 10); for (const k of kin) if (Math.random() < 0.4) rel(k, s)?.modifyAffinity?.(-15); const f = C.fid ? DEAL.factOf(w2, C.fid) : null; if (f) { DEAL.learn(w2, f, s, 'staff'); try { DEALASK.S(w2).angry = DEALASK.S(w2).angry || {}; DEALASK.S(w2).angry[s.agentId + '|' + f.id] = 1; if (typeof TIPS !== 'undefined' && TIPS && TIPS.papers(w2).length && Math.random() < 0.5) DEALASK.tip(w2, s, f, false); } catch (e) {} } note(w2, C, '{o}說都是{x}自作主張', { o: a2.name, x: s.name }); return { k: '推給了夥計' }; } });
            if (M && M !== a) out.push({ id: 'protect', quiet: true, mute: true, text: { k: '去找{o}求保護', p: { o: M.name } }, say: { k: '去找了{o}', p: { o: M.name } }, why: '平常沒少照顧他', base: REF + tilt(clampN(0.1 * ((() => { try { return (POWER.S(w).inf[M.agentId]?.[a.agentId] || 0) >= 20 ? 3 : 1; } catch (e) { return 1; } })()) * (aff(a, M) >= 30 ? 1.8 : 1), 0.004, 0.8)), lean: { safe: 0.2 }, run: (w2, a2) => { C.owner = 'protect'; C.begged = true; note(w2, C, '{o}去找首長求保護', { o: a2.name }); return { k: '去找首長了' }; } });
            return out;
        },
    });
    // ================= 衛兵隊長 =================
    DECIDE.kind('riotGuard', {
        title: '店門口聚了一群人', scan: false, pri: 1.9, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const C = S(w).cases[c.key]; if (!C) return ''; const cr = crowdOf(w, C); const kin = cr.filter(x => aff(a, x) >= 40).length; const mine = isKin(C, a) || hurtAt(w, C, a);
            return fill('{n} 人聚在{s}門口，有人喊著要砸店。人是用了這家的東西才死的。{kin}{mine}', { n: cr.length, s: sname(C.key), kin: kin ? { k: '人群裡有 {n} 個是你的親友。', p: { n: kin } } : { raw: '' }, mine: mine ? '你自己家裡也有人在這家出過事。' : { raw: '' } }); },
        options(w, a, c) {
            const C = S(w).cases[c.key]; if (!C || C.stage !== 'riot' || C.guard || !guards(w).includes(a)) return []; const cr = crowdOf(w, C); const kin = cr.filter(x => aff(a, x) >= 40).length; const mine = isKin(C, a) || hurtAt(w, C, a); const o = w.agents[C.oid];
            const out = [
                { id: 'block', text: '帶人擋在店門口', say: '帶人擋在店門口', why: '不能讓人動私刑', base: REF + tilt(clampN(0.45 * (kin ? 0.5 : 1) * (mine ? 0.3 : 1) * (honesty(a) >= 4 ? 1.3 : 1), 0.03, 0.95)), lean: { face: 0.2, safe: -0.2 }, run: (w2, a2) => { C.guard = 'block'; note(w2, C, '衛兵隊長{g}帶人擋在店門口', { g: a2.name }); return { k: '擋在門口' }; } },
                { id: 'aside', quiet: true, text: '站到一邊，不管', say: '站在一邊沒有管', why: '這是他自己造的孽', base: REF + tilt(clampN(0.3 * (kin ? 1.6 : 1) * (mine ? 1.8 : 1) * (o && aff(a, o) >= 40 ? 0.3 : 1), 0.03, 0.95)), lean: { safe: 0.3, face: -0.2 }, run: (w2, a2) => { C.guard = 'aside'; note(w2, C, '衛兵站在一邊，沒有管', {}); return { k: '沒有管' }; } },
            ];
            if (mine || kin >= 2) out.push({ id: 'join', text: '跟著人群一起', say: '站到了人群裡', why: '我家也有人吃過那家的東西', base: REF + tilt(clampN(0.1 * (mine ? 2.5 : 1) * (kin >= 2 ? 1.5 : 1), 0.01, 0.8)), lean: { bond: 0.3, safe: -0.5 }, run: (w2, a2) => { C.guard = 'join'; note(w2, C, '衛兵隊長{g}站到了人群裡', { g: a2.name }); return { k: '站到人群裡' }; } });
            return out;
        },
    });
    // ================= 首長 =================
    DECIDE.kind('riotMayor', {
        title: '鎮上出了人命，人群圍住了店', scan: false, pri: 2, aiGroup: G,
        when() { return null; },
        facts(w, a, c) { const C = S(w).cases[c.key]; const o = w.agents[C?.oid]; if (!C || !o) return ''; const cr = crowdOf(w, C); let inf = 0; try { inf = POWER.S(w).inf[a.agentId]?.[o.agentId] || 0; } catch (e) {}
            return fill('{n} 人圍住了{s}。前後 {m} 個人是用了這家的東西才死的，東家是{o}。{beg}{inf}{g}', { n: cr.length, s: sname(C.key), m: C.dead.length, o: o.name, beg: C.begged ? '他來求過你保護他。' : { raw: '' }, inf: inf >= 20 ? { k: '他前後給過你 {n} 銀幣。', p: { n: Math.round(inf) } } : { raw: '' }, g: guards(w).length ? { k: '鎮上有 {n} 名衛兵。', p: { n: guards(w).length } } : '鎮上沒有衛兵。' }); },
        options(w, a, c) {
            const C = S(w).cases[c.key]; const o = live(w, C?.oid); if (!C || C.stage !== 'riot' || C.mayor || mayor(w) !== a) return []; let inf = 0; try { inf = o ? POWER.S(w).inf[a.agentId]?.[o.agentId] || 0 : 0; } catch (e) {} const tie = (inf >= 20 ? 0.35 : 1) * (o && aff(a, o) >= 40 ? 0.5 : 1); const hon = honesty(a); const f = C.fid ? DEAL.factOf(w, C.fid) : null; const gs = guards(w);
            const out = [{ id: 'hide', quiet: true, mute: true, text: '躲著不出面', say: '沒有出面', why: '這種時候說什麼都錯', base: REF + (has(a, 'lazy') ? 0.3 : 0), lean: { safe: 0.4, face: -0.4 }, run: (w2, a2) => { C.mayor = 'hid'; note(w2, C, '{m}沒有出面', { m: a2.name }); return { k: '沒有出面' }; } }];
            if (o) out.push({ id: 'arrest', text: { k: '當場把{o}抓起來，交付審判', p: { o: o.name } }, say: { k: '下令把{o}抓起來查辦', p: { o: o.name } }, why: '給大家一個交代，才不會出更大的事', base: REF + tilt(clampN(0.4 * tie * (hon >= 4 ? 1.4 : 1) * (C.dead.length >= 2 ? 1.3 : 1), 0.03, 0.97)), lean: { face: 0.4, bond: -0.1 },
                run: (w2, a2) => { C.mayor = 'arrest'; S(w2).st.arrests = (S(w2).st.arrests || 0) + 1; try { if (w2.civic?.jail) w2.civic.jail[o.agentId] = day(w2) + 3; } catch (e) {} let tr = false; try { tr = !!(LW() && f && !f.tried && LW().trial(w2, f, a2)); } catch (e) {} rel(o, a2)?.modifyAffinity?.(-25); for (const x of crowdOf(w2, C)) rel(x, a2)?.modifyAffinity?.(5); note(w2, C, tr ? '{m}當場把{o}抓了起來，交付審判' : '{m}當場把{o}抓了起來', { m: a2.name, o: o.name }); log(w2, '⛓️ {m}下令把{o}抓起來查辦。', { m: a2.name, o: o.name }, o.name); return { k: '抓起來了' }; } });
            if (gs.length) out.push({ id: 'suppress', text: '叫衛兵把人趕走', say: '下令衛兵驅散人群', why: '不能讓人動私刑', base: REF + tilt(clampN(0.12 * (inf >= 20 ? 2.5 : 1) * (C.begged ? 1.5 : 1) * (has(a, 'abrasive') ? 1.8 : 1) * (has(a, 'kind') ? 0.4 : 1), 0.01, 0.9)), lean: { safe: 0.1, bond: -0.4 },
                run: (w2, a2) => { C.mayor = 'suppress'; if (!C.guard) C.guard = 'block'; for (const x of crowdOf(w2, C)) rel(x, a2)?.modifyAffinity?.(-10); note(w2, C, '{m}下令衛兵把人趕走', { m: a2.name }); return { k: '下了命令' }; } });
            out.push({ id: 'calm', text: '出面安撫，答應立規定管店家', say: '出面安撫大家', why: '先把場面穩下來', base: REF + tilt(clampN(0.3 * (has(a, 'charismatic') ? 1.5 : 1) * (has(a, 'kind') ? 1.3 : 1), 0.03, 0.95)), lean: { bond: 0.3 },
                run: (w2, a2) => { C.mayor = 'calm'; let law = null; try { if (LW()) { delete LW().S(w2).last.deal_check; law = ['deal_check', 'deal_cap', 'deal_cartel'].find(k => LW().okNow(w2, k, true)); if (law && !LW().propose(w2, law, a2, '')) law = null; } } catch (e) {} for (const x of crowdOf(w2, C)) rel(x, a2)?.modifyAffinity?.(3); note(w2, C, law ? '{m}出面安撫，答應立規定：{t}' : '{m}出面安撫大家', { m: a2.name, t: law ? LW().TITLE[law] : { raw: '' } }); return { k: '出面安撫' }; } });
            return out;
        },
    });
    const OUT = { wrecked: '店被砸了', held: '人群沒有動手', quiet: '沒有鬧起來', unknown: '沒有人知道原因' };
    function view(w) {
        if (!w.riot) return null; const R = S(w), d = day(w);
        const cur = Object.values(R.cases).filter(C => C.stage !== 'after').map(C => ({ id: C.id, key: C.key, shop: t(sname(C.key)), owner: C.oname, dead: C.dead.map(x => x.name), stage: C.stage, linked: C.linkedD != null, crowd: C.who.length, inDays: C.day != null ? Math.max(0, C.day - d) : null, funeral: !!C.funeral, log: C.log.map(l => ({ ago: d - l.d, text: fill(l.k, l.p) })) }));
        return { cur, hist: R.hist.slice().reverse().map(h => ({ id: h.id, shop: t(sname(h.key)), owner: h.owner, dead: h.dead, crowd: h.crowd, out: t(OUT[h.out] || h.out), ago: d - h.d, log: h.log.map(l => ({ ago: d - l.d, text: fill(l.k, l.p) })) })), st: Object.assign({}, R.st) };
    }
    return { S, on, kinIds, link, ask, caseFor, gatherDay, resolve, daily, view, guards, WRECK_DAYS, BLOOD };
})();
if (typeof globalThis !== 'undefined') globalThis.RIOT = RIOT;
if (RIOT) {
    if (typeof ProposalSystem !== 'undefined') { const PS = ProposalSystem.prototype; const _daily = PS.daily; if (typeof _daily === 'function') PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { RIOT.daily(w); } catch (e) { console.warn('[Riot] daily', e); } return r; }; }
    if (typeof World !== 'undefined') {
        const WP = World.prototype;
        const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.riot = null; return r; };
        const _ser = WP.serialize; WP.serialize = function (...a) { const d = _ser.apply(this, a); if (d && this.riot) d.riot = this.riot; return d; };
        const _load = WP.loadSave; WP.loadSave = function (data, ...a) { const r = _load.call(this, data, ...a); try { this.riot = (data?.riot && typeof data.riot === 'object') ? data.riot : null; } catch (e) {} return r; };
    }
}
