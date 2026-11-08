// v6.86.0 典禮:葬禮與婚禮是真的辦一場,不是一行字
// 葬禮:有人過世 → 家屬(配偶、子女、父母,沒有就最好的朋友;都沒有就鎮公所)安排兩天後上午在墓園辦,依人緣與財力分小／中;
//       名人(當過首長或議員、人緣很廣)會有人提案「公費辦隆重葬禮」,要投票(錢多時還要議會)與首長批准,過了就辦成全鎮送行;
//       當天認識的人走去墓園,主辦人(或首長)致悼詞(規則版,有 AI 時換成 AI 寫的),送行的人記得、沒來的至親心裡過意不去;
//       墓碑記下幾個人送行;每年忌日家屬回墓園祭拜
// 婚禮:兩人決定結婚(關係已是已婚)後,婚禮訂在 3～5 天後傍晚在廣場辦,依兩人存款分小／中／大;當天朋友與家人到場、
//       有人致詞(AI 或規則版)、賓客包禮金、前任或死對頭可能來鬧場;取代以前「全鎮舉辦了盛大的婚禮」一行字
// 資料存在 world.ceremony,存讀檔保留、新城鎮清空
const CEREMONY = (() => {
    const FUN_START = 9, FUN_END = 12, WED_START = 16, WED_END = 19;
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (w._absDay ? w._absDay() : 0);
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const log = (w, cat, k, p, ...who) => { try { w.logMessageT?.(cat, k, p || {}, ...who); } catch (e) {} };
    const mem = (w, a, k, p, imp, who) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, who || []); } catch (e) {} };
    const news = (w, s, imp, who) => { try { w.dailyNews?.collectEvent?.('relationship', s, imp, who || []); } catch (e) {} };
    const W = () => (typeof WALLET !== 'undefined' ? WALLET : null);
    function S(w) {
        if (!w.ceremony || !Array.isArray(w.ceremony.list)) w.ceremony = { list: [], anniv: [], n: 0, lastDay: null };
        const C = w.ceremony; C.anniv = C.anniv || []; return C;
    }
    const rel = (a, b) => a?.relationships?.relationships?.[b?.agentId] || null;
    const aff = (a, b) => rel(a, b)?.affinity || 0;
    function isFamily(a, d) {
        const r = rel(a, d); if (r && (r.status === 'married' || r.status === 'dating')) return true;
        return !!((a._parentNames || []).includes(d.name) || (d._parentNames || []).includes(a.name));
    }
    const whenText = (w, d, h) => { const diff = d - day(w); const dd = diff <= 0 ? t('今天') : diff === 1 ? t('明天') : diff === 2 ? t('後天') : t('{n} 天後').replace('{n}', diff); return en() ? `${dd} at ${h}:00` : `${dd} ${h} 點`; };
    const locName = (w, loc) => { try { return t(w.townMap?.locations?.[loc]?.name || ({ graveyard: '墓園', town_square: '廣場', chapel: '教堂' })[loc] || loc); } catch (e) { return loc; } };
    const eulogy = (d, kind) => {
        const tr = d.traits || [];
        const bits = kind === 'grand' ? ['他為這個鎮付出了大半輩子，我們今天走得到這裡，是因為他先替我們鋪了路。', '鎮上很多決定都有他的影子，願他安息。']
            : tr.includes('kind') ? ['他總是先想到別人，誰家缺什麼他都記得。', '他對誰都好，我們會想念他的笑。']
            : tr.includes('hardworking') ? ['他一輩子沒閒過，今天終於可以好好休息了。', '每天天沒亮就看到他在忙，鎮上少了他會很安靜。']
            : tr.includes('creative') ? ['他總有新點子，鎮上很多小東西都是他想出來的。']
            : tr.includes('charismatic') ? ['只要他在，場子就不會冷。', '大家都喜歡聽他說話，今天換我們說給他聽。']
            : ['謝謝你陪我們走過這些年，一路好走。', '我們會照顧好你放心不下的人。'];
        return bits[Math.floor(Math.random() * bits.length)];
    };
    const toast = () => { const b = ['祝你們吵架永遠吵不過三句，和好永遠快過一頓飯。', '願你們把日子過成大家羨慕的樣子。', '以後有什麼事，別忘了我們這些朋友都在。', '今天的酒我先乾了，祝白頭偕老！']; return b[Math.floor(Math.random() * b.length)]; };
    // AI 寫悼詞／致詞(有額度才寫;先用規則版,AI 回來就換掉)
    function askAI(w, c, prompt) {
        try {
            const llm = w.conversationEngine?.llm; if (!llm || !llm._canMakeRequest?.(false)) return;
            llm.generate(prompt, 160, 0.85, false).then(txt => {
                const s = String(txt || '').replace(/^[「"『\s]+|[」"』\s]+$/g, '').split('\n')[0].slice(0, 80);
                if (s && c.status !== 'held') { c.speech = s; c.ai = 1; }
            }).catch(() => {});
        } catch (e) {}
    }

    // ---------- 葬禮 ----------
    // pre:過世前就記下的配偶(原本的過世流程會先把配偶關係改成前任)
    function onDeath(w, d, pre) {
        if (!d || d.isPlayer) return null;
        const C = S(w);
        const alive = npcs(w).filter(a => a.agentId !== d.agentId);
        const sp = new Set((pre && pre.spouses) || []);
        const fam = alive.filter(a => sp.has(a.agentId) || isFamily(a, d));
        const close = alive.filter(a => !fam.includes(a) && aff(a, d) > 50).sort((p, q) => aff(q, d) - aff(p, d));
        const known = alive.filter(a => aff(a, d) > 20).length;
        let host = fam.sort((p, q) => (sp.has(q.agentId) - sp.has(p.agentId)) || q.age - p.age)[0] || close[0] || null;
        let career = []; try { career = (typeof TIERS !== 'undefined' ? TIERS.S(w).career[d.agentId] : null) || []; } catch (e) {}
        const wasLeader = career.some(x => x.role === 'leader'), wasCouncil = career.some(x => x.role === 'council');
        let scale = known >= 6 ? 2 : 1; let paid = 0;
        const cost = scale === 2 ? 30 : 10;
        if (host && W()) { if (W().take(w, host, cost)) paid = cost; else if (scale === 2 && W().take(w, host, 10)) { scale = 1; paid = 10; } }
        if (paid && typeof MARKET !== 'undefined' && w.market) { const pr = Object.values(w.agents).find(a => !a.isDead && a.job?.key === 'priest'); if (pr) W().add(w, pr, paid * 0.4); MARKET.sale(w, 'meal', paid * (pr ? 0.6 : 1)); } // v6.89.0 葬禮費付給神職與辦桌的食堂,不再憑空消失
        else if (paid) { try { w.stockpile.add('silver', paid, w.tickCount, t('葬禮')); } catch (e) {} } // v8.0.0 還沒有市集的小鎮:葬禮費交給鎮公所(以前會憑空消失)
        const c = { id: 'C' + (++C.n), kind: 'funeral', of: d.agentId, name: d.name, age: d.age, traits: (d.personality?.traits || []).slice(0, 3), job: d.job?.title || '',
            host: host?.agentId || null, hostName: host?.name || '', day: day(w) + 2, hour: FUN_START, end: FUN_END, loc: 'graveyard', scale, paid, status: 'planned',
            leader: wasLeader ? 1 : 0, family: fam.map(a => a.agentId), close: close.slice(0, 6).map(a => a.agentId), speech: eulogy({ traits: d.personality?.traits || [] }, 'normal') };
        C.list.push(c); trim(C);
        if (host) log(w, 'death', '⚱️ {host}為{name}安排了葬禮，{when}在{loc}舉行。', { host: host.name, name: d.name, when: whenText(w, c.day, c.hour), loc: locName(w, c.loc) }, host.name);
        else log(w, 'death', '⚱️ {name}沒有家人，鎮公所替他安排了簡單的葬禮，{when}在{loc}。', { name: d.name, when: whenText(w, c.day, c.hour), loc: locName(w, c.loc) }, d.name);
        // 名人:等人提案公費辦隆重葬禮
        if (wasLeader || wasCouncil || known >= 10) c.pub = { cost: wasLeader ? 120 : 60, why: wasLeader ? 'leader' : wasCouncil ? 'council' : 'loved' };
        // 忌日
        const si = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock?.season);
        C.anniv.push({ name: d.name, doy: Math.max(0, si) * 15 + (w.clock?.day || 1), year: w.clock?.year || 1, fam: fam.map(a => a.agentId) }); if (C.anniv.length > 40) C.anniv.shift();
        return c;
    }
    // 提案通過:公費辦隆重葬禮(還沒辦就升級;已經辦完就隔天辦追思會)
    function publicFuneral(w, p) {
        const C = S(w); const c = C.list.find(x => x.id === p.refKey); if (!c) return { ok: false, msg: '找不到這場葬禮' };
        if (!w.stockpile?.consume?.('silver', c.pub?.cost || 60, w.tickCount, t('公費葬禮'), 'proposal')) return { ok: false, msg: '公庫不夠' };
        c.scale = 3; c.public = 1; c.pubBy = p.proposerName;
        if (c.status === 'held') { c.status = 'planned'; c.day = day(w) + 1; c.memorial = 1; c.held = null; }
        c.speech = eulogy({ traits: c.traits }, 'grand');
        log(w, 'death', '🏛️ 全鎮會為{name}辦一場隆重的葬禮，{when}在{loc}，大家都可以去送他。', { name: c.name, when: whenText(w, c.day, c.hour), loc: locName(w, c.loc) }, c.name);
        return { ok: true, msg: c.memorial ? '葬禮已辦完，改辦全鎮追思會' : '葬禮改成全鎮送行' };
    }

    // ---------- 婚禮 ----------
    function planWedding(w, a, b) {
        if (!a || !b || a.isDead || b.isDead || !w.agents[a.agentId] || !w.agents[b.agentId]) return null; const C = S(w);
        if (C.list.some(c => c.kind === 'wedding' && c.status === 'planned' && [c.a, c.b].includes(a.agentId))) return null;
        const wal = W(); const money = wal ? wal.get(w, a) + wal.get(w, b) : 60;
        const scale = money >= 150 ? 3 : money >= 50 ? 2 : 1;
        const loc = w.townMap?.locations?.chapel && (a.personality?.values || []).concat(b.personality?.values || []).some(v => /信仰|faith/.test(v)) ? 'chapel' : 'town_square';
        const c = { id: 'C' + (++C.n), kind: 'wedding', a: a.agentId, b: b.agentId, name: a.name, name2: b.name, day: day(w) + 3 + Math.floor(Math.random() * 3), hour: WED_START, end: WED_END, loc, scale, status: 'planned', speech: toast() };
        C.list.push(c); trim(C);
        log(w, 'relationship', '💍 {a}和{b}決定結婚了！婚期訂在{when}，地點在{loc}。', { a: a.name, b: b.name, when: whenText(w, c.day, c.hour), loc: locName(w, loc) }, a.name, b.name);
        news(w, `${a.name}${t('和')}${b.name}${t('訂了婚期')}`, 7, [a.name, b.name]);
        return c;
    }

    // ---------- 當天 ----------
    function guestsFor(w, c) {
        const cap = [0, 12, 25, 60][c.scale] || 12;
        if (c.kind === 'funeral') {
            const d = { agentId: c.of, name: c.name };
            const fam = new Set(c.family || []);
            const thr = c.scale >= 3 ? -999 : c.scale === 2 ? 20 : 40;
            const list = npcs(w).filter(a => a.agentId !== c.of && (fam.has(a.agentId) || aff(a, d) > thr || a.agentId === c.host || (c.scale >= 3 && a.job?.key === 'mayor')))
                .sort((p, q) => (fam.has(q.agentId) - fam.has(p.agentId)) || (aff(q, d) - aff(p, d))).slice(0, cap);
            // 沒什麼交情的人過世也不會冷清:首長、神職和幾位鄰居會來送一程
            if (list.length < 3) { const extra = npcs(w).filter(a => a.agentId !== c.of && !list.includes(a)); const pick = [...extra.filter(a => a.job?.key === 'mayor' || a.job?.key === 'priest'), ...extra.sort(() => Math.random() - 0.5)];
                for (const a of pick) { if (list.length >= 4) break; if (!list.includes(a)) list.push(a); } }
            return list;
        }
        const A = w.agents[c.a], B = w.agents[c.b];
        const thr = c.scale >= 3 ? 10 : c.scale === 2 ? 25 : 40;
        return npcs(w).filter(x => x !== A && x !== B && !(c.boycott || []).includes(x.agentId) /* v7.6.0 反對神裔婚事的家人不來 */ && (Math.max(aff(x, A), aff(x, B)) > thr || isFamily(x, A) || isFamily(x, B)))
            .sort((p, q) => Math.max(aff(q, A), aff(q, B)) - Math.max(aff(p, A), aff(p, B))).slice(0, cap);
    }
    const away = (w, a) => !a || a.isDead || !w.agents[a.agentId] || a.currentLocation === 'exploration' || a.activity === 'exploring';
    function start(w, c) {
        const g = guestsFor(w, c).filter(a => !away(w, a));
        if (c.kind === 'wedding') { const A = w.agents[c.a], B = w.agents[c.b]; if (away(w, A) || away(w, B)) { c.status = 'cancelled'; log(w, 'relationship', '💔 {a}和{b}的婚禮因為有人不在鎮上，延期了。', { a: c.name, b: c.name2 }); return; } g.unshift(A, B); }
        c.status = 'ongoing'; c.guests = g.map(a => a.agentId);
        const act = c.kind === 'funeral' ? 'mourning' : 'socializing';
        for (const a of g) a._ceremony = { loc: c.loc, act, id: c.id };
        if (c.kind === 'funeral') {
            const kin = new Set([...(c.family || []), ...(c.close || [])]); // 主辦人出遠門或不在,就由到場的家屬好友致詞
            const sp = (w.agents[c.host] && !away(w, w.agents[c.host]) ? w.agents[c.host] : null) || g.find(a => kin.has(a.agentId)) || (c.scale >= 3 ? npcs(w).find(a => a.job?.key === 'mayor') : null) || g[0] || null;
            c.speaker = sp?.name || ''; c.speakerId = sp?.agentId || null;
            if (sp) askAI(w, c, `${t('你是')}${sp.name}${t('，在')}${c.name}${t('的葬禮上說一兩句悼詞（30 字內，口語、真誠，不要客套）。')}${c.name}${t('生前是')}${c.job || t('鎮民')}${c.leader ? t('，當過首長') : ''}${t('。只輸出悼詞本身。')}`);
            log(w, 'death', c.memorial ? '🕯️ {name}的追思會開始了，{n} 人聚在{loc}。' : '🕯️ {name}的葬禮開始了，{n} 人聚在{loc}送他最後一程。', { name: c.name, n: g.length, loc: locName(w, c.loc) }, c.name);
        } else {
            const A = w.agents[c.a], B = w.agents[c.b];
            const fr = g.filter(x => x !== A && x !== B).sort((p, q) => Math.max(aff(q, A), aff(q, B)) - Math.max(aff(p, A), aff(p, B)))[0];
            c.speaker = fr?.name || ''; c.speakerId = fr?.agentId || null;
            if (fr) askAI(w, c, `${t('你是')}${fr.name}${t('，在好朋友')}${c.name}${t('和')}${c.name2}${t('的婚宴上舉杯致詞（30 字內，口語、溫暖、可以帶點玩笑）。只輸出致詞本身。')}`);
            log(w, 'relationship', '🎊 {a}和{b}的婚禮開始了！{n} 位賓客聚在{loc}。', { a: c.name, b: c.name2, n: g.length - 2, loc: locName(w, c.loc) }, c.name, c.name2);
        }
    }
    function finish(w, c) {
        const g = (c.guests || []).map(id => w.agents[id]).filter(Boolean);
        for (const a of g) if (a._ceremony?.id === c.id) delete a._ceremony;
        c.status = 'held'; c.held = day(w);
        if (c.kind === 'funeral') {
            const d = { agentId: c.of, name: c.name }; const fam = new Set(c.family || []);
            for (const a of g) {
                const isF = fam.has(a.agentId);
                a.moodModifier = (a.moodModifier || 0) + (isF ? 6 : 3); // 一起送別,心裡比較放得下
                mem(w, a, c.memorial ? '參加了{name}的追思會。{sp}說：「{s}」' : '參加了{name}的葬禮。{sp}說：「{s}」', { name: c.name, sp: c.speaker || t('大家'), s: c.speech }, isF ? 8 : 6, [c.name]);
            }
            const here = new Set(g.map(a => a.agentId)); const host = w.agents[c.host];
            for (const id of [...(c.family || []), ...(c.close || [])]) {
                const a = w.agents[id]; if (!a || here.has(id) || away(w, a)) continue;
                mem(w, a, '沒去{name}的葬禮，心裡一直過意不去。', { name: c.name }, 6, [c.name]); a.moodModifier = (a.moodModifier || 0) - 3;
                if (host && host !== a) rel(host, a)?.modifyAffinity?.(-5);
            }
            if (c.scale >= 3) for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + 1;
            const gv = (w.lifecycle?.graveyard || []).slice().reverse().find(x => x.name === c.name); if (gv) gv.farewell = g.length;
            try { if (typeof WAYS !== 'undefined') WAYS.onFuneral(w, g, w.agents[c.host]); } catch (e) {} // v8.1.0 來送行的人,喪家記一份情
            log(w, 'death', '⚱️ {name}的{what}辦完了，{n} 人到場送行。{sp}說：「{s}」', { name: c.name, what: c.memorial ? t('追思會') : t('葬禮'), n: g.length, sp: c.speaker || t('大家'), s: c.speech }, c.name);
            news(w, `${c.name}${t('的葬禮')}${t('：')}${g.length} ${t('人送行')}`, c.scale >= 3 ? 9 : 6, [c.name]);
        } else {
            const A = w.agents[c.a], B = w.agents[c.b]; if (!A || !B) return;
            let gifts = 0; const wal = W();
            const guests = g.filter(x => x !== A && x !== B); try { if (typeof WAYS !== 'undefined') WAYS.weddingGuests(w, guests, c); } catch (e) {} // v8.1.0 冷戰的兩人被排在同一桌
            for (const x of guests) {
                x.moodModifier = (x.moodModifier || 0) + 4;
                if (wal && wal.get(w, x) > 20) { const n = typeof WAYS !== 'undefined' ? WAYS.giftAmount(w, x, A, B) : 2 + Math.floor(Math.random() * 7); if (wal.take(w, x, n)) { wal.add(w, A, n / 2); wal.add(w, B, n / 2); gifts += n; try { if (typeof WAYS !== 'undefined') WAYS.onGift(w, x, A, B, n); } catch (e) {} } } // v8.1.0 收過的禮要包回去
                mem(w, x, '參加了{a}和{b}的婚禮。{sp}舉杯說：「{s}」', { a: c.name, b: c.name2, sp: c.speaker || t('大家'), s: c.speech }, 6, [c.name, c.name2]);
                rel(x, A)?.modifyAffinity?.(2); rel(x, B)?.modifyAffinity?.(2);
            }
            const cost = [0, 10, 30, 60][c.scale] || 10; if (wal) { const half = cost / 2; let paid = 0; if (wal.take(w, A, half)) paid += half; if (wal.take(w, B, half)) paid += half; if (paid && typeof MARKET !== 'undefined' && w.market) MARKET.sale(w, 'meal', paid); } // v6.89.0 喜宴的錢付給食堂與農莊
            A.moodModifier = (A.moodModifier || 0) + 15; B.moodModifier = (B.moodModifier || 0) + 15;
            mem(w, A, '今天和{o}辦了婚禮，{n} 位朋友來祝福，收到 {g} 銀幣禮金。', { o: B.name, n: guests.length, g: Math.round(gifts) }, 10, [B.name]);
            mem(w, B, '今天和{o}辦了婚禮，{n} 位朋友來祝福，收到 {g} 銀幣禮金。', { o: A.name, n: guests.length, g: Math.round(gifts) }, 10, [A.name]);
            // 前任或死對頭來鬧場
            const foe = npcs(w).find(x => x !== A && x !== B && !away(w, x) && ([rel(x, A), rel(x, B)].some(r => r && (r.status === 'ex' || r.affinity < -40))));
            if (foe && Math.random() < 0.3) {
                c.scene = foe.name; for (const x of [A, B]) { x.moodModifier = (x.moodModifier || 0) - 6; rel(x, foe)?.modifyAffinity?.(-10); }
                mem(w, foe, '跑去{a}和{b}的婚禮鬧了一場。', { a: c.name, b: c.name2 }, 7, [c.name, c.name2]);
                log(w, 'relationship', '😤 {foe}在{a}和{b}的婚禮上鬧場，被賓客勸了出去。', { foe: foe.name, a: c.name, b: c.name2 }, foe.name);
            }
            if (c.scale >= 3) for (const x of npcs(w)) x.moodModifier = (x.moodModifier || 0) + 2;
            c.gifts = Math.round(gifts);
            try { w.queueDramaScene?.('wedding', A, B); } catch (e) {}
            log(w, 'relationship', '💒 {a}和{b}的婚禮辦完了，{n} 位賓客到場、禮金 {g} 銀幣。{sp}舉杯說：「{s}」', { a: c.name, b: c.name2, n: guests.length, g: c.gifts, sp: c.speaker || t('大家'), s: c.speech }, c.name, c.name2);
            news(w, `${c.name}${t('和')}${c.name2}${t('的婚禮')}${t('：')}${guests.length} ${t('位賓客')}`, c.scale >= 3 ? 9 : 7, [c.name, c.name2]);
        }
    }
    function trim(C) { if (C.list.length > 30) C.list = C.list.filter(c => c.status === 'planned' || c.status === 'ongoing').concat(C.list.filter(c => c.status !== 'planned' && c.status !== 'ongoing').slice(-15)); }
    // 每格檢查(很便宜):到時間開始、結束;換日處理忌日
    function tick(w) {
        const C = w.ceremony; const d = day(w), h = w.clock?.hour ?? 0;
        if (C && C.list.length) for (const c of C.list) {
            if (c.status === 'planned' && (d > c.day || (d === c.day && h >= c.hour))) { if (c.kind === 'wedding' && (!w.agents[c.a] || !w.agents[c.b] || w.agents[c.a].isDead || w.agents[c.b].isDead)) { c.status = 'cancelled'; continue; } start(w, c); }
            if (c.status === 'ongoing' && (d > c.day || h >= c.end)) finish(w, c);
        }
        if (C && C.lastDay !== d) { C.lastDay = d; anniversary(w, C); }
    }
    function anniversary(w, C) {
        const si = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock?.season); const doy = Math.max(0, si) * 15 + (w.clock?.day || 1); const y = w.clock?.year || 1;
        for (const x of C.anniv) {
            if (x.doy !== doy || y <= x.year) continue;
            const fam = (x.fam || []).map(id => w.agents[id]).filter(a => a && !a.isDead);
            if (!fam.length) continue;
            for (const a of fam) { a._mourningTargets = a._mourningTargets || []; if (!a._mourningTargets.some(m => m.name === x.name)) a._mourningTargets.push({ name: x.name, deathTick: w.tickCount, isFamily: true }); }
            log(w, 'mourning', '🕯️ 今天是{name}的忌日（過世 {n} 年），{who}到墓園祭拜。', { name: x.name, n: y - x.year, who: fam.slice(0, 3).map(a => a.name).join(t('、')) }, fam[0].name);
        }
    }
    // 介面:某個地點最近的典禮(地點卡用)
    function at(w, loc) {
        const C = w.ceremony; if (!C) return []; const d = day(w);
        return C.list.filter(c => c.loc === loc && (c.status === 'ongoing' || (c.status === 'planned' && c.day - d <= 3)) || (c.loc === loc && c.status === 'held' && c.held === d))
            .map(c => ({ kind: c.kind, status: c.status, title: c.kind === 'funeral' ? (c.memorial ? t('{name}的追思會') : t('{name}的葬禮')).replace('{name}', c.name) : t('{a}和{b}的婚禮').replace('{a}', c.name).replace('{b}', c.name2), when: c.status === 'held' ? t('今天已辦完') : c.status === 'ongoing' ? t('進行中') : whenText(w, c.day, c.hour), host: c.hostName || '', n: (c.guests || []).length, scale: c.scale }));
    }
    return { S, onDeath, publicFuneral, planWedding, tick, at, start, finish, guestsFor, FUN_START, FUN_END, WED_START, WED_END };
})();
if (typeof globalThis !== 'undefined') globalThis.CEREMONY = CEREMONY;

// ---- 接上:過世、結婚、出席、提案、每格檢查、存讀檔
if (typeof LifecycleSystem !== 'undefined') {
    const LS = LifecycleSystem.prototype; const _kill = LS._killNpc;
    LS._killNpc = function (world, npc, ...rest) {
        let pre = null; try { pre = { spouses: Object.values(world.agents || {}).filter(a => a !== npc && ['married', 'dating'].includes(a.relationships?.relationships?.[npc?.agentId]?.status)).map(a => a.agentId) }; } catch (e) {}
        const r = _kill.call(this, world, npc, ...rest); try { CEREMONY.onDeath(world, npc, pre); } catch (e) { console.warn('[Ceremony] death', e); } return r;
    };
}
if (typeof Agent !== 'undefined') {
    const AP = Agent.prototype; const _dl = AP._decideLocation;
    AP._decideLocation = function (...args) { const r = _dl.apply(this, args); const c = this._ceremony; if (c && !this.isDead) { this.targetLocation = c.loc; this.activity = c.act; } return r; };
}
if (typeof World !== 'undefined') {
    const WP = World.prototype; const _tick = WP.tick;
    WP.tick = function (...args) { const r = _tick.apply(this, args); try { if (this.ceremony) CEREMONY.tick(this); } catch (e) { console.warn('[Ceremony] tick', e); } return r; };
    const _reset = WP.reset; WP.reset = function (...args) { const r = _reset.apply(this, args); this.ceremony = null; return r; };
    const _ser = WP.serialize; WP.serialize = function () { const d = _ser.call(this); if (d && this.ceremony) d.ceremony = this.ceremony; return d; };
    const _load = WP.loadSave; WP.loadSave = function (data) { const r = _load.call(this, data); try { if (r) { this.ceremony = (data?.ceremony && Array.isArray(data.ceremony.list)) ? data.ceremony : null; for (const a of Object.values(this.agents || {})) if (a._ceremony && !(this.ceremony?.list || []).some(c => c.id === a._ceremony.id && c.status === 'ongoing')) delete a._ceremony; } } catch (e) {} return r; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _cand = PS._candidates;
    // 名人過世:家屬、好友或議員提案「公費辦隆重葬禮」
    PS._candidates = function (w, day, ...rest) {
        const out = _cand.call(this, w, day, ...rest) || [];
        try {
            const C = w.ceremony; if (!C) return out;
            for (const c of C.list) {
                if (c.kind !== 'funeral' || !c.pub || c.public || c.pubAsked || !(c.status === 'planned' || (c.status === 'held' && day - (c.held || 0) <= 2))) continue;
                if (this.items.some(p => p.kind === 'funeral' && p.refKey === c.id)) { c.pubAsked = 1; continue; }
                const fam = new Set([...(c.family || []), ...(c.close || [])]); const seated = new Set((w.council?.members || []));
                const pred = (a) => fam.has(a.agentId) || seated.has(a.agentId) || a.job?.key === 'priest' || (a.relationships?.relationships?.[c.of]?.affinity || 0) > 30;
                // 沒有合適的人(家屬好友、議員、神職、跟他有交情的人)能提就不提,不會由不相干的人代提
                if (!this._npcs(w).some(a => pred(a) && (day - (this.proposerCooldown?.[a.agentId] ?? -99)) >= 5)) continue;
                const whyK = c.pub.why === 'leader' ? '當過首長，為鎮上做了很多事' : c.pub.why === 'council' ? '當過議員' : '人緣很好，全鎮都認識他';
                out.push({ kind: 'funeral', key: 'funeral:' + c.id, weight: 6, jobs: ['priest'], pred, // 家屬好友、議員、神職或有交情的人提
                    make: () => ({ kind: 'funeral', key: 'funeral:' + c.id, refKey: c.id, tk: '以公費為{name}辦隆重的葬禮', tp: { name: c.name }, dk: '{name}{why}。從公庫撥 {n} 銀幣辦一場全鎮送行的葬禮，大家可以一起到墓園道別。', dp: { name: c.name, why: whyK, n: c.pub.cost }, cost: { silver: c.pub.cost }, effects: { mood_all: 1 }, category: 'social' }) });
            }
        } catch (e) {}
        return out;
    };
}
