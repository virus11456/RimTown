// v8.4.0「神之書」：事件卡大改版＋神力統一
// - 卡牌分四級：⚪ 普通、🔵 稀有、🟡 傳說、🟣 禁忌；打牌、託夢、災厄工坊都花同一份「神力」。
// - 神之書：普通卡一開始就有；稀有、傳說、禁忌要小鎮發生過某些事才會「寫進書裡」（帳號共用，換鎮也還在）。
// - 新卡都接上現有系統，村民照真實的方式反應（人情世故、冷戰、說一套做一套、銀行、信仰、科技…），每張都有後續反饋。
// - 神力：每天累積（小鎮興旺、虔誠的人多，累積得快）、上限 100；沙盒模式無限。災難多的時候祈禱的人多，神力也多——樹大招風。
// 必須在 sim-events.js、sim-calamity.js、sim-ways.js、sim-dream.js 之後載入。
const GODBOOK = (function () {
    if (typeof EVENT_CARDS === 'undefined' || typeof EventCardSystem === 'undefined') return null;
    const RAR = { common: { icon: '⚪', label: '普通', cost: 3 }, rare: { icon: '🔵', label: '稀有', cost: 6 }, legend: { icon: '🟡', label: '傳說', cost: 15 }, forbid: { icon: '🟣', label: '禁忌', cost: 30 } };
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && a.currentLocation !== 'exploration');
    const adults = (w) => npcs(w).filter(a => (a.age ?? 30) >= 16);
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const aff = (a, b) => a?.relationships?.relationships?.[b?.agentId]?.affinity || 0;
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp || 6, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who); } catch (e) {} };
    const W8 = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const researched = (w) => Object.values(w.research?.projects || {}).filter(p => p.status === 'complete').length;

    // ---------- 舊卡的稀有度 ----------
    const OLD = { plague: 'rare', locusts: 'rare', quake: 'rare', flood: 'rare', raid: 'rare', scandal: 'rare', gold_rumor: 'rare', grand_caravan: 'rare', bequest: 'rare', prodigy: 'rare', inheritance: 'rare', hero_return: 'rare' };
    for (const c of EVENT_CARDS) c.rar = c.rar || OLD[c.id] || 'common';

    // ---------- 新卡 ----------
    const NEW = [
        // ⚪ 普通:日常小事
        { id: 'lost_pet', cat: 'mishap', rar: 'common', icon: '🐈', name: '寵物走失', desc: '一隻貓（或狗）一早就不見了，主人急得到處問。', effect: '主人心情變差；常一起碰面的街坊幫忙找，感情變好，主人欠下人情', cd: 8,
          need: (w) => (w.pets?.list || []).some(p => p.owner && w.agents[p.owner] && !w.agents[p.owner].isDead),
          play(w, S) { const p = rnd((w.pets.list || []).filter(x => x.owner && w.agents[x.owner] && !w.agents[x.owner].isDead)); const o = w.agents[p.owner]; o.moodModifier = (o.moodModifier || 0) - 4;
            const r = W8()?.routineOf?.(w, o); const helpers = adults(w).filter(a => a !== o && (r ? W8().routineOf(w, a)?.s === r.s : true)).sort(() => Math.random() - 0.5).slice(0, 3);
            for (const h of helpers) { S._aff(o, h, 5); S._aff(h, o, 3); W8()?.owe?.(w, o, h, 1); mem(w, h, '{o}的寵物{p}走失了，我陪著到處找。', { o: o.name, p: p.name }, 5); }
            const found = Math.random() < 0.75; mem(w, o, found ? '{p}走失了一整天，傍晚才在柴堆後面找到，大家都幫了忙。' : '{p}走失了，找了一整天都沒找到。', { p: p.name }, 7);
            if (found) o.moodModifier += 5; return { names: `${o.name}${helpers.length ? t('、') + helpers.map(h => h.name).join(t('、')) : ''}`, n: found ? t('找到了') : t('還沒找到'), affected: [o.agentId, ...helpers.map(h => h.agentId)] }; } },
        { id: 'misheard', cat: 'social', rar: 'common', icon: '👂', name: '聽錯一句話', desc: '一句玩笑話被聽成了壞話，在井邊越傳越難聽。', effect: '一對朋友可能開始冷戰；朋友被迫選邊', cd: 8,
          play(w, S) { const a = rnd(adults(w)); if (!a) return {}; const b = adults(w).filter(x => x !== a).sort((x, y) => aff(a, y) - aff(a, x))[0]; if (!b) return {};
            S._aff(a, b, -6); S._aff(b, a, -8); mem(w, b, '聽說{a}在背後說我壞話，氣死我了。', { a: a.name }, 7); mem(w, a, '我只是開個玩笑，怎麼傳到{b}耳裡變成那樣。', { b: b.name }, 6);
            W8()?.quarrel?.(w, a, b); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
        { id: 'treat', cat: 'fortune', rar: 'common', icon: '🍻', name: '有人請客', desc: '有人心情好，把常碰面的街坊全請去喝一杯。', effect: '一群人感情變好，被請的人欠請客的一份人情', cd: 6,
          play(w, S) { const host = adults(w).sort((x, y) => (hasT(y, 'kind') || hasT(y, 'charismatic') ? 1 : 0) - (hasT(x, 'kind') || hasT(x, 'charismatic') ? 1 : 0) || Math.random() - 0.5)[0]; if (!host) return {};
            const r = W8()?.routineOf?.(w, host); const guests = adults(w).filter(a => a !== host && (!r || W8().routineOf(w, a)?.s === r.s)).slice(0, 5);
            for (const g of guests) { S._aff(g, host, 4); S._aff(host, g, 2); W8()?.owe?.(w, g, host, 1); g.moodModifier = (g.moodModifier || 0) + 2; }
            mem(w, host, '今天心情好，請大家喝了一杯。', {}, 5); return { names: host.name, n: t('請了 {n} 個人').replace('{n}', guests.length), affected: [host.agentId, ...guests.map(g => g.agentId)] }; } },
        { id: 'blunder', cat: 'social', rar: 'common', icon: '🫣', name: '當眾出糗', desc: '有人在大家面前跌了一跤，還把一整籃雞蛋摔破。', effect: '那個人丟臉；常有朋友出面打圓場（欠人情）', cd: 6,
          play(w, S) { const a = rnd(adults(w)); if (!a) return {}; W8()?.loseFace?.(w, a, 12); a.moodModifier = (a.moodModifier || 0) - 3; mem(w, a, '今天在大家面前摔了一跤，丟臉死了。', {}, 6);
            const f = adults(w).filter(x => x !== a && aff(x, a) >= 25).sort((x, y) => aff(y, a) - aff(x, a))[0];
            if (f && Math.random() < 0.6) { S._aff(a, f, 6); W8()?.owe?.(w, a, f, 2); a.moodModifier += 2; mem(w, a, '還好{f}笑著扶我起來，說誰沒摔過。', { f: f.name }, 6); return { names: `${a.name}${t('、')}${f.name}`, n: t('有人打圓場'), affected: [a.agentId, f.agentId] }; }
            return { names: a.name, affected: [a.agentId] }; } },
        { id: 'crush_out', cat: 'social', rar: 'common', icon: '💘', name: '暗戀被發現', desc: '一張藏在書裡的紙條被翻了出來，上面寫著另一個人的名字。', effect: '對方也有好感就拉近，否則兩人都尷尬一陣子', cd: 10,
          play(w, S) { const ppl = adults(w).filter(a => !['married', 'dating'].some(st => Object.values(a.relationships?.relationships || {}).some(r => r.status === st))); const a = rnd(ppl); if (!a) return {};
            const b = ppl.filter(x => x !== a && x.gender !== a.gender).sort((x, y) => aff(a, y) - aff(a, x))[0] || ppl.find(x => x !== a); if (!b) return {};
            const mutual = aff(b, a) >= 25 || Math.random() < 0.3; const d = mutual ? 12 : -4; S._aff(a, b, mutual ? 10 : -2); S._aff(b, a, d);
            mem(w, a, mutual ? '暗戀{b}的紙條被翻出來了……沒想到對方也對我笑了。' : '暗戀{b}的紙條被翻出來了，現在見面好尷尬。', { b: b.name }, 7);
            return { names: `${a.name}${t('、')}${b.name}`, n: mutual ? t('兩情相悅') : t('有點尷尬'), affected: [a.agentId, b.agentId] }; } },
        { id: 'noisy_neighbor', cat: 'mishap', rar: 'common', icon: '📢', name: '吵鬧的鄰居', desc: '隔壁天天半夜敲敲打打，終於有人受不了去敲門。', effect: '兩個鄰居交惡；之後可能有人提案調解', cd: 8,
          play(w, S) { const by = {}; for (const a of adults(w)) { const h = a.homeLocation || '_'; (by[h] = by[h] || []).push(a); } const homes = Object.values(by).filter(x => x.length >= 1); const a = rnd(adults(w)); if (!a) return {};
            const b = adults(w).filter(x => x !== a && x.homeLocation !== a.homeLocation)[0] || adults(w).find(x => x !== a); if (!b) return {};
            S._aff(a, b, -8); S._aff(b, a, -5); mem(w, a, '{b}家每天半夜都在敲敲打打，我去敲門抗議了。', { b: b.name }, 6); return { names: `${a.name}${t('、')}${b.name}`, affected: [a.agentId, b.agentId] }; } },
        // 🔵 稀有
        { id: 'bank_rumor', cat: 'mishap', rar: 'rare', icon: '🏦', name: '銀行要倒的謠言', desc: '有人在酒館說，銀行的金庫其實早就空了。', effect: '銀行擠兌：存戶搶著領錢，銀行家要想辦法撐住', cd: 30,
          need: (w) => typeof BANK !== 'undefined' && !!w.bank && !!w.bank.open && (w.bank.status || 'ok') === 'ok',
          play(w, S) { const by = rnd(adults(w)); try { BANK.startRun(w, BANK.S(w), day(w), by); } catch (e) {} return { names: by?.name || '', affected: by ? [by.agentId] : [] }; } },
        { id: 'slip', cat: 'social', rar: 'rare', icon: '🤐', name: '說溜嘴', desc: '有人喝多了，把一個藏了很久的秘密說了出來。', effect: '一個還沒被拆穿的秘密曝光（陷害、說謊、搶功…），當事人和受害者的關係大翻轉', cd: 14,
          need: (w) => typeof DARK !== 'undefined' && (DARK.S(w).secrets || []).some(s => !s.found),
          play(w, S) { const s = rnd((DARK.S(w).secrets || []).filter(x => !x.found)); const by = rnd(adults(w).filter(a => a.agentId !== s.culprit)); try { DARK.reveal(w, s, by); } catch (e) {} const c = w.agents[s.culprit]; return { names: c?.name || '', affected: [s.culprit, s.victim].filter(Boolean) }; } },
        { id: 'unmask', cat: 'social', rar: 'rare', icon: '🎭', name: '偽君子現形', desc: '一個口口聲聲說要守規矩的人，被人撞見自己偷偷不守。', effect: '說一套做一套的人被拆穿：丟臉、全鎮對提案更多疑', cd: 20,
          need: (w) => (w.ways?.hyp || []).some(h => !h.exp && w.agents[h.a] && !w.agents[h.a].isDead),
          play(w, S) { const h = rnd(w.ways.hyp.filter(x => !x.exp && w.agents[x.a] && !w.agents[x.a].isDead)); W8()?.expose?.(w, h); return { names: w.agents[h.a]?.name || '', affected: [h.a] }; } },
        { id: 'reconcile', cat: 'social', rar: 'rare', icon: '🕊️', name: '世紀和解', desc: '冷戰最久的兩個人在婚禮上被排在同一桌，終於開口了。', effect: '冷戰中的兩人和好（感情大增）；共同的朋友也鬆一口氣', cd: 20,
          need: (w) => Object.values(w.ways?.cold || {}).some(c => c.until > day(w)),
          play(w, S) { const d = day(w); const [k, c] = rnd(Object.entries(w.ways.cold).filter(([, c]) => c.until > d)); const [x, y] = k.split('|').map(id => w.agents[id]); if (!x || !y) return {};
            c.until = d; c.done = 1; S._aff(x, y, 18); S._aff(y, x, 18); mem(w, x, '跟{b}冷戰了那麼久，今天終於說開了。', { b: y.name }, 8); mem(w, y, '跟{b}冷戰了那麼久，今天終於說開了。', { b: x.name }, 8);
            for (const f of adults(w)) if (f !== x && f !== y && aff(f, x) >= 25 && aff(f, y) >= 25) f.moodModifier = (f.moodModifier || 0) + 2;
            return { names: `${x.name}${t('、')}${y.name}`, affected: [x.agentId, y.agentId] }; } },
        { id: 'kind_chain', cat: 'fortune', rar: 'rare', icon: '🫶', name: '善意接力', desc: '有人幫了一個陌生人，那個人又去幫了下一個……', effect: '一串人輪流幫忙，彼此欠下人情、感情變好，心情也好', cd: 14,
          play(w, S) { const chain = adults(w).sort(() => Math.random() - 0.5).slice(0, 4); for (let i = 0; i < chain.length - 1; i++) { const a = chain[i], b = chain[i + 1]; S._aff(b, a, 8); W8()?.owe?.(w, b, a, 2); b.moodModifier = (b.moodModifier || 0) + 3; mem(w, b, '{a}今天幫了我一個大忙，我也想去幫別人。', { a: a.name }, 6); }
            return { names: chain.map(a => a.name).join(' → '), affected: chain.map(a => a.agentId) }; } },
        { id: 'heirloom', cat: 'fortune', rar: 'rare', icon: '🏺', name: '傳家寶出土', desc: '有人修屋頂時，在樑上找到祖父藏的一個陶罐。', effect: '那個人多了一筆錢（神給的）；鄰居眼紅，善良的人會捐一部分給公庫', cd: 20,
          need: (w) => typeof WALLET !== 'undefined',
          play(w, S) { const a = rnd(adults(w)); if (!a) return {}; const n = 40 + Math.floor(Math.random() * 41); WALLET.add(w, a, n); try { MONEY.flow(w, 'event', n); } catch (e) {}
            mem(w, a, '在屋樑上找到祖父藏的陶罐，裡面有 {n} 銀幣！', { n }, 8); const nb = adults(w).filter(x => x !== a).sort(() => Math.random() - 0.5).slice(0, 2); for (const x of nb) { S._aff(x, a, -2); mem(w, x, '{a}挖到寶了，運氣怎麼這麼好。', { a: a.name }, 4); }
            let gave = 0; if (hasT(a, 'kind') && Math.random() < 0.7) { gave = Math.round(n * 0.3); WALLET.pay(w, a, null, gave, t('捐給公庫')); for (const x of adults(w)) if (x !== a) S._aff(x, a, 1); }
            return { names: a.name, n: gave ? t('{n} 銀幣，捐了 {g}').replace('{n}', n).replace('{g}', gave) : t('{n} 銀幣').replace('{n}', n), affected: [a.agentId] }; } },
        { id: 'town_meeting', cat: 'social', rar: 'rare', icon: '🫖', name: '鄰里茶會', desc: '有人在廣場擺了幾張桌子和一壺茶，說今天什麼都可以聊。', effect: '不敢開口的人又敢提事情了；面子回來一點、全鎮信任上升', cd: 30,
          need: (w) => !!W8() && !!w.ways,
          play(w, S) { try { W8().forum(w); } catch (e) {} return { names: '', affected: [] }; } },
        // 🟡 傳說
        { id: 'golden_age', cat: 'fortune', rar: 'legend', icon: '🌅', name: '黃金時代', desc: '一連好幾天風和日麗，田裡、工坊、市集什麼都順。', effect: '全鎮心情大好、繁榮度上升；接下來半個月做事特別順', cd: 60,
          play(w, S) { S._moodAll(w, 6); if (w.prosperity) w.prosperity.prosperity = Math.min(100, (w.prosperity.prosperity || 0) + 10); w.godbook.golden = day(w) + 15; return { names: '', n: t('全鎮'), affected: [] }; } },
        { id: 'comet', cat: 'disaster', rar: 'legend', icon: '☄️', name: '彗星', desc: '夜空裡出現一顆拖著長尾巴的星，一連亮了七個晚上。', effect: '迷信的人心慌、虔誠的人更虔誠；讀書人熬夜觀測，研究大進', cd: 60,
          play(w, S) { let scared = 0; for (const a of npcs(w)) { if (hasT(a, 'pessimist') || hasT(a, 'neurotic')) { a.moodModifier = (a.moodModifier || 0) - 3; scared++; } try { if (typeof FAITH !== 'undefined' && w.faith && FAITH.relOf(w, a)) FAITH.bumpP(w, a, 6); } catch (e) {} }
            const cur = w.research?.projects?.[w.research.current]; if (cur) cur.progress = Math.min(cur.cost, (cur.progress || 0) + Math.round(cur.cost * 0.3));
            return { names: '', n: t('{n} 人心慌').replace('{n}', scared), affected: [] }; } },
        { id: 'eureka', cat: 'fortune', rar: 'legend', icon: '💡', name: '大發明', desc: '有個研究員半夜大叫一聲，衝出屋子說他想通了。', effect: '目前的研究立刻完成', cd: 60,
          need: (w) => !!w.research?.current && !!w.research.projects?.[w.research.current],
          play(w, S) { const p = w.research.projects[w.research.current]; const who = npcs(w).find(a => a.job?.key === 'researcher') || rnd(adults(w)); p.progress = p.cost; try { w.research.dailyUpdate?.(w); } catch (e) {} if (who) mem(w, who, '半夜突然想通了「{p}」，太痛快了！', { p: p.name }, 9); return { names: who?.name || '', n: t(p.name), affected: who ? [who.agentId] : [] }; } },
        { id: 'prophet', cat: 'social', rar: 'legend', icon: '📿', name: '先知', desc: '一個平常不起眼的人，突然開始說出會應驗的話。', effect: '信仰的人更虔誠；有人跟隨、有人說他瘋了', cd: 60,
          need: (w) => typeof FAITH !== 'undefined' && !!w.faith && (w.faith.rels || []).length > 0,
          play(w, S) { const p = rnd(adults(w)); if (!p) return {}; let follow = 0, doubt = 0; for (const a of adults(w)) { if (a === p) continue; if (Math.random() < 0.4 || FAITH.pietyOf(w, a) >= 50) { try { FAITH.bumpP(w, a, 10); } catch (e) {} S._aff(a, p, 6); follow++; } else if (hasT(a, 'stubborn') || Math.random() < 0.25) { S._aff(a, p, -6); doubt++; } }
            mem(w, p, '我最近總是看見一些畫面，說出口的事都應驗了。', {}, 9); return { names: p.name, n: t('{f} 人跟隨、{d} 人說他瘋了').replace('{f}', follow).replace('{d}', doubt), affected: [p.agentId] }; } },
        { id: 'bountiful', cat: 'fortune', rar: 'legend', icon: '🎑', name: '神賜豐年', desc: '倉庫怎麼堆都堆不滿，連老人都說沒見過這種年頭。', effect: '食物 +300，全鎮心情變好，鎮上辦起慶典', cd: 60,
          play(w, S) { try { w.stockpile.add('food', 300, w.tickCount, t('神賜豐年')); } catch (e) {} S._moodAll(w, 4); return { names: '', n: t('食物 +300'), affected: [] }; } },
        // 🟣 禁忌
        { id: 'truth_rain', cat: 'disaster', rar: 'forbid', icon: '🌧️', name: '真話雨', desc: '下了一整天奇怪的雨，淋到的人一開口就只能說真話。', effect: '所有秘密曝光、所有說一套做一套的人被拆穿；鎮上大亂，冷戰四起', cd: 90,
          play(w, S) { let n = 0; try { if (typeof DARK !== 'undefined') for (const s of (DARK.S(w).secrets || []).filter(x => !x.found)) { DARK.reveal(w, s, null); n++; } } catch (e) {}
            try { for (const h of (w.ways?.hyp || []).filter(x => !x.exp)) { W8()?.expose?.(w, h); n++; } } catch (e) {}
            const pairs = adults(w).sort(() => Math.random() - 0.5).slice(0, 4); for (let i = 0; i + 1 < pairs.length; i += 2) W8()?.quarrel?.(w, pairs[i], pairs[i + 1]); S._moodAll(w, -3);
            return { names: '', n: t('{n} 件事曝光').replace('{n}', n), affected: [] }; } },
        { id: 'mind_flip', cat: 'social', rar: 'forbid', icon: '🔄', name: '顛倒人心', desc: '一覺醒來，最要好的兩個人互看不順眼，死對頭卻突然很想見面。', effect: '最好的一對變仇人、最差的一對變朋友（真的會這樣）', cd: 90,
          play(w, S) { const [a, b] = S._bestPair(w); const [c, d] = S._worstPair(w); if (!a || !c) return {}; const ab = aff(a, b), cd = aff(c, d); S._aff(a, b, cd - ab); S._aff(b, a, cd - aff(b, a)); S._aff(c, d, ab - cd); S._aff(d, c, ab - aff(d, c));
            for (const [x, y, k] of [[a, b, '不知道為什麼，今天看到{b}就一肚子火。'], [c, d, '不知道為什麼，今天突然很想跟{b}說說話。']]) mem(w, x, k, { b: y.name }, 8);
            return { names: `${a.name}${t('、')}${b.name} ⇄ ${c.name}${t('、')}${d.name}`, affected: [a, b, c, d].map(x => x.agentId) }; } },
        { id: 'golden_touch', cat: 'fortune', rar: 'forbid', icon: '👑', name: '點石成金', desc: '公庫的銅板一夜之間全變成了銀子，而且越看越多。', effect: '公庫 +1000 銀幣（神給的）；但有幾個人從此變得貪心', cd: 90,
          play(w, S) { try { w.stockpile.add('silver', 1000, w.tickCount, t('點石成金')); } catch (e) {} const g = adults(w).filter(a => !hasT(a, 'greedy')).sort(() => Math.random() - 0.5).slice(0, 3);
            for (const a of g) { a.personality.traits = [...(a.personality.traits || []).filter(x => x !== 'kind'), 'greedy']; mem(w, a, '看著公庫那堆銀子，我心裡開始盤算怎麼也分一點。', {}, 7); }
            return { names: g.map(a => a.name).join(t('、')), n: t('公庫 +1000'), affected: g.map(a => a.agentId) }; } },
        { id: 'forget', cat: 'disaster', rar: 'forbid', icon: '🌫️', name: '集體失憶', desc: '一陣白霧飄過，大家醒來都忘了最近發生的事。', effect: '仇恨和愛情都淡了一半，冷戰全部結束——包括相愛的人', cd: 90,
          play(w, S) { for (const a of npcs(w)) for (const r of Object.values(a.relationships?.relationships || {})) { r.affinity = Math.round((r.affinity || 0) / 2); } if (w.ways?.cold) w.ways.cold = {}; S._moodAll(w, -2);
            return { names: '', n: t('全鎮'), affected: [] }; } },
    ];
    for (const c of NEW) if (!EVENT_CARDS.some(x => x.id === c.id)) EVENT_CARDS.push(c);

    // ---------- 神之書:什麼時候寫進書裡 ----------
    const hist = (w) => w.calamity?.hist || [];
    const UNLOCK = {
        plague: ['災厄工坊放過一次病原體，或小鎮滿 60 天', (w) => (w.calamity?.st?.released || 0) >= 1 || day(w) >= 60],
        locusts: ['小鎮滿 30 天', (w) => day(w) >= 30], quake: ['小鎮滿 30 天', (w) => day(w) >= 30], flood: ['小鎮滿 30 天', (w) => day(w) >= 30], raid: ['小鎮滿 30 天', (w) => day(w) >= 30],
        scandal: ['小鎮舉行過選舉', (w) => (w.election?.electionHistory || []).length >= 1],
        gold_rumor: ['發現第一個探索區域', (w) => Object.keys(w.exploration?.discoveredZones || {}).length >= 1],
        grand_caravan: ['商隊來交易過', (w) => (w.trade?.tradeHistory || []).length >= 1],
        bequest: ['鎮上有人過世', (w) => (w.lifecycle?.graveyard || []).length >= 1], inheritance: ['鎮上有人過世', (w) => (w.lifecycle?.graveyard || []).length >= 1],
        prodigy: ['完成 5 項研究', (w) => researched(w) >= 5], hero_return: ['小鎮滿 45 天', (w) => day(w) >= 45],
        bank_rumor: ['鎮上開了銀行', (w) => !!w.bank?.open], slip: ['有人的秘密被拆穿過', (w) => (w.dark?.secrets || []).some(s => s.found)],
        unmask: ['有人說一套做一套被撞見', (w) => (w.ways?.st?.hyp || 0) >= 1], reconcile: ['鎮上有人冷戰過', (w) => (w.ways?.st?.cold || 0) >= 1],
        kind_chain: ['有人欠下第一份人情', (w) => Object.keys(w.ways?.owe || {}).length >= 1], heirloom: ['小鎮滿 45 天', (w) => day(w) >= 45], town_meeting: ['鎮上辦過一次鄰里茶會', (w) => (w.ways?.st?.forum || 0) >= 1],
        golden_age: ['小鎮升格為城市', (w) => { try { return typeof TIERS !== 'undefined' && TIERS.level(w) >= 2; } catch (e) { return false; } }],
        comet: ['研究進入第四時代', (w) => (w.research?.currentEra?.() || 1) >= 4], eureka: ['完成 30 項研究', (w) => researched(w) >= 30],
        prophet: ['鎮上有宗教，小鎮滿一年', (w) => (w.faith?.rels || []).length > 0 && day(w) >= 360], bountiful: ['小鎮撐過一場災厄（災厄工坊或天災）', (w) => hist(w).length >= 1 || (w.godbook?.disDay != null && day(w) - w.godbook.disDay >= 7)],
        truth_rain: ['說一套做一套被撞見 3 次', (w) => (w.ways?.st?.hyp || 0) >= 3], mind_flip: ['有人冷戰到最後再也不往來', (w) => (w.ways?.st?.apart || 0) >= 1],
        golden_touch: ['銀行撐過擠兌，或公庫超過 3000 銀幣', (w) => w.bank?.lastRunEnd != null || (w.stockpile?.get?.('silver') || 0) >= 3000],
        forget: ['一場災厄死了 5 個人以上', (w) => hist(w).some(h => (h.died || 0) >= 5)],
    };
    const LS = 'rimtown_godbook';
    const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
    const lsAdd = (id) => { try { const s = new Set(lsGet()); const had = s.has(id); s.add(id); localStorage.setItem(LS, JSON.stringify([...s])); if (!had && typeof window !== 'undefined') window.dispatchEvent?.(new Event('rimtown-unlock')); } catch (e) {} }; // v9.2.0 新解鎖 → 推上帳號
    function S(w) { if (!w.godbook || typeof w.godbook !== 'object') w.godbook = { pages: {} }; w.godbook.pages = w.godbook.pages || {}; return w.godbook; }
    const card = (id) => EVENT_CARDS.find(c => c.id === id) || null;
    function unlocked(w, id) { const c = card(id); if (!c) return false; if (c.rar === 'common') return true; return !!S(w).pages[id] || lsGet().includes(id); }
    function check(w) {
        const B = S(w); const out = [];
        for (const [id, [, fn]] of Object.entries(UNLOCK)) { if (unlocked(w, id)) { if (!B.pages[id]) B.pages[id] = day(w); continue; } let ok = false; try { ok = !!fn(w); } catch (e) {} if (!ok) continue;
            B.pages[id] = day(w); lsAdd(id); const c = card(id); if (!c) continue; out.push(c);
            log(w, '📖 神之書多了一頁：{r}{icon}「{name}」', { r: RAR[c.rar].icon, icon: c.icon, name: c.name });
            try { w.onGodbook?.(c); } catch (e) {} }
        return out;
    }
    const cost = (c) => RAR[c?.rar || 'common'].cost;
    const powerOf = (w) => (typeof CALAMITY !== 'undefined' ? CALAMITY.power(w) : Infinity);
    const spend = (w, n) => (typeof CALAMITY !== 'undefined' ? CALAMITY.spend(w, n) : true);
    function book(w) {
        const order = ['common', 'rare', 'legend', 'forbid'];
        return order.map(r => ({ rar: r, icon: RAR[r].icon, label: t(RAR[r].label), cost: RAR[r].cost, cards: EVENT_CARDS.filter(c => c.rar === r).map(c => ({ id: c.id, icon: c.icon, name: t(c.name), desc: t(c.desc), effect: t(c.effect), cat: c.cat, on: unlocked(w, c.id), hint: UNLOCK[c.id] ? t(UNLOCK[c.id][0]) : '' })) }));
    }

    // ---------- 接上事件卡系統 ----------
    EventCardSystem.MAX_PER_DAY = 3; // 每天最多三張(神力才是真正的限制)
    const P = EventCardSystem.prototype;
    const _can = P.canPlay; P.canPlay = function (w, id) {
        const c = this.card(id); if (!c) return { ok: false, why: 'unknown' };
        if (!unlocked(w, id)) return { ok: false, why: 'locked', hint: UNLOCK[id] ? t(UNLOCK[id][0]) : '' };
        if (c.need) { let ok = false; try { ok = !!c.need(w); } catch (e) {} if (!ok) return { ok: false, why: 'context' }; }
        const r = _can.call(this, w, id); if (!r.ok) return r;
        if (powerOf(w) < cost(c)) return { ok: false, why: 'power', cost: cost(c) };
        return r;
    };
    const _play = P.play; P.play = function (w, id) {
        const can = this.canPlay(w, id); if (!can.ok) return { ok: false, why: can.why, days: can.days, cost: can.cost };
        const r = _play.call(this, w, id); if (r?.ok) { spend(w, cost(this.card(id))); const C = S(w); C.spent = (C.spent || 0) + cost(this.card(id)); if (this.card(id).cat === 'disaster' && C.disDay == null) C.disDay = day(w); } // 天災過了一週還撐著,也算撐過一場災厄
        return r;
    };
    const _hand = P.hand; P.hand = function (w) {
        const h = _hand.call(this, w); const pw = powerOf(w);
        const RO = { common: 0, rare: 1, legend: 2, forbid: 3 };
        return h.filter(x => unlocked(w, x.id)).map(x => { const c = this.card(x.id); let ctx = true; if (c.need) { try { ctx = !!c.need(w); } catch (e) { ctx = false; } } return Object.assign(x, { rar: c.rar, rarIcon: RAR[c.rar].icon, rarLabel: t(RAR[c.rar].label), cost: cost(c), noPower: pw < cost(c), noCtx: !ctx }); })
            .sort((a, b) => RO[a.rar] - RO[b.rar]);
    };
    const _dict = P.toDict; P.toDict = function (w) { const d = _dict.call(this, w); const pw = powerOf(w); d.power = Number.isFinite(pw) ? Math.floor(pw) : null; d.powerCap = typeof CALAMITY !== 'undefined' ? CALAMITY.CAP : 100; d.sandbox = !Number.isFinite(pw); d.book = { have: EVENT_CARDS.filter(c => unlocked(w, c.id)).length, total: EVENT_CARDS.length }; return d; };

    // 打牌造成的公庫／錢包增減（神給的、天災拿走的）都記進金流帳，銀幣才對得上
    try { if (typeof MONEY !== 'undefined' && MONEY.track) MONEY.track(P, 'play', 'event'); } catch (e) {}

    // 託夢也花神力
    if (typeof DREAM !== 'undefined' && DREAM.send && !DREAM.send.__gb) {
        const _send = DREAM.send; const g = async function (w, agentId, text) { if (powerOf(w) < 3) return { ok: false, why: 'power' }; const r = await _send.call(this, w, agentId, text); if (r?.ok) spend(w, 3); return r; }; g.__gb = true; DREAM.send = g;
    }

    return { RAR, UNLOCK, NEW, S, unlocked, check, cost, book, card, DREAM_COST: 3 };
})();
if (GODBOOK && typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _d = PS.daily;
    PS.daily = function (w, ...rest) { const r = _d.call(this, w, ...rest); try { if (w.observerMode) { GODBOOK.check(w); const g = w.godbook?.golden; if (g && g > (w._absDay?.() ?? 0)) for (const a of Object.values(w.agents || {})) if (!a.isDead && !a.isPlayer) a.moodModifier = Math.max(a.moodModifier || 0, 1); } } catch (e) { console.warn('[Godbook]', e); } return r; };
}
if (GODBOOK && typeof World !== 'undefined') {
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.godbook) d.godbook = this.godbook; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.godbook = (data?.godbook && typeof data.godbook === 'object') ? data.godbook : null; } catch (e) {} return r; };
    const _reset = World.prototype.reset; World.prototype.reset = function (...a) { const r = _reset.apply(this, a); this.godbook = null; return r; };
}
if (typeof window !== 'undefined') window.GODBOOK = GODBOOK;
