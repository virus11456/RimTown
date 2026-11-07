// sim-flow.js — v6.79.0 物資流通：每樣東西都有來源、有路徑、有用處，數量要平衡
// 1. 需求導向生產：每樣成品有「鎮上該備多少」的目標量(依人口)；存量超過目標，工匠、工坊、產業就放慢(只做一點給商隊)，
//    原料因此省下來(以前木匠無限做家具把木頭吃光、工具堆到上千)
// 2. 作物有出路：收成的小麥、稻米、玉米、馬鈴薯、蘑菇、葡萄、甘蔗、金色小麥、火龍果，扣掉工坊要用的份量後進糧倉；
//    棉花沒有紡織廠就在家紡成布；花拿來布置小鎮；茶葉沒有茶坊就直接泡來喝
// 3. 加工品有用處：麵包、糕點、果醬當正餐吃；啤酒、葡萄酒、精製茶、養生茶在酒館與茶館喝掉(喝的人心情變好)；
//    香水約會用；精裝家具、木板、硬木、磚、大理石、鋼鐵可以代替原料翻修房子與擴建鎮公所(比原料省)；黃金送去鑄成銀幣
// 4. 工坊依需求換配方(以前永遠只做第一個配方，糕點、葡萄酒、香水、果醬、硬木、大理石、精裝家具都做不出來)
'use strict';

const FLOW = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => (typeof w._absDay === 'function' ? w._absDay() : 0);
    const sp = (w) => w.stockpile;
    const get = (w, r) => sp(w)?.get?.(r) || 0;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // ---------- 目標存量 ----------
    function want(w, r) {
        const all = npcs(w), pop = Math.max(1, all.length), workers = all.filter(a => a.job?.key).length;
        switch (r) {
            case 'meals': return pop * 3;
            case 'food': return (400 + (w.buildings?.getEffect?.('food_capacity', 0) || 0)) * 1.3; // 糧倉容量多三成當冬天的底
            case 'tools': return Math.max(12, workers * 0.5);
            case 'clothing': return pop * 0.8 + 8;
            case 'furniture': return pop * 0.4 + 8;
            case 'medicine': return pop * 0.3 + 6;
            case 'stone': return 300 + pop * 5;
            case 'metal': return 150 + pop * 2;
            case 'wood': return 200 + pop * 3;
            case 'research_points': return 250;
            case 'bread': return pop * 0.8;
            case 'pastry': return pop * 0.4;
            case 'jam': return pop * 0.3;
            case 'beer': return pop * 0.6;
            case 'wine': return pop * 0.3;
            case 'fine_tea': case 'herbal_tea': return pop * 0.3;
            case 'perfume': return pop * 0.1 + 2;
            case 'luxury_furniture': return pop * 0.08 + 2;
            case 'sugar': return 20;
            case 'cloth': return 60;
            case 'plank': return 40;
            case 'hardwood': return 25;
            case 'brick': return 50;
            case 'marble': return 20;
            case 'steel': return 25;
            case 'gold': return 0;
            default: return 30;
        }
    }
    // 還缺多少(0 = 夠了，1 = 完全沒有)
    function need(w, r) { const T = want(w, r); if (T <= 0) return 0; return Math.max(0, Math.min(1, 1 - get(w, r) / T)); }
    // 生產倍率：存量在目標六成以下全力做，到目標時只剩 15%(給商隊與意外)
    function demandMult(w, r) {
        const T = want(w, r); const lo = r === 'food' ? 0.35 : 0.15; if (T <= 0) return lo; // 糧食最少留三成五(季節與災害的緩衝)
        const s = get(w, r);
        if (s <= T * 0.6) return 1;
        if (s >= T) return lo;
        return lo + (1 - lo) * (T - s) / (T * 0.4);
    }
    const JOB_GOOD = { farmer: ['food'], cook: ['meals'], blacksmith: ['tools'], carpenter: ['furniture'], tailor: ['clothing'], doctor: ['medicine'], miner: ['stone', 'metal'], researcher: ['research_points'] };
    function jobDemand(w, jobKey) { const goods = JOB_GOOD[jobKey]; if (!goods) return 1; return Math.max(...goods.map(r => demandMult(w, r))); }
    const multiOut = (jobKey) => (JOB_GOOD[jobKey] || []).length > 1;

    // ---------- 精製建材可以代替原料(比原料省)，各留一些給一定要用它的建築 ----------
    const SUB = { wood: [['hardwood', 3], ['plank', 2]], stone: [['marble', 3], ['brick', 2]], metal: [['steel', 2]], furniture: [['luxury_furniture', 3]] };
    const KEEP = { hardwood: 0, plank: 15, marble: 0, brick: 20, steel: 10, luxury_furniture: 0 };
    const spare = (w, r) => Math.max(0, get(w, r) - (KEEP[r] || 0));
    function effective(w, r) { let v = get(w, r); for (const [s, k] of (SUB[r] || [])) v += spare(w, s) * k; return v; }
    function lack(w, mat) { const out = {}; if (!mat) return out; for (const [r, n] of Object.entries(mat)) { const h = effective(w, r); if (h < n) out[r] = Math.ceil(n - h); } return out; }
    function canPay(w, mat) { return !Object.keys(lack(w, mat)).length; }
    function pay(w, mat, reason) {
        if (!mat || !canPay(w, mat)) return false;
        const S = sp(w), tick = w.tickCount || 0;
        for (const [r, n] of Object.entries(mat)) {
            let left = n;
            for (const [s, k] of (SUB[r] || [])) { if (left <= 0) break; const use = Math.min(spare(w, s), Math.ceil(left / k)); if (use > 0) { S.consume(s, use, tick, reason); left -= use * k; } }
            if (left > 0) S.consume(r, left, tick, reason);
        }
        return true;
    }

    // ---------- 作物 ----------
    const CROP_FOOD = { wheat: 1, rice: 1, corn: 1, potato: 1, mushroom: 1, golden_wheat: 2, dragon_fruit: 1.5, grapes: 0.8, sugarcane: 0.6 };
    const activeFactories = (w) => Object.entries(w.processing?.builtFactories || {}).filter(([, f]) => f.status === 'active').map(([k]) => k);
    // 工坊要用的作物先留三天份
    function reserveFor(w, crop) {
        if (typeof FACTORIES === 'undefined') return 0;
        let n = 0;
        for (const k of activeFactories(w)) for (const rc of (FACTORIES[k]?.recipes || [])) if (rc.input?.[crop]) n = Math.max(n, rc.input[crop] * 3);
        return n;
    }
    function cropScore(w, c) {
        const all = npcs(w), pop = Math.max(1, all.length), food = get(w, 'food');
        const short = food < pop * 12 ? 2 : food < pop * 25 ? 1.2 : food < want(w, 'food') ? 0.5 : 0; // 糧倉滿了就不種糧食,改種別的或休耕
        let s = 0;
        if (CROP_FOOD[c.key]) s += short * CROP_FOOD[c.key] * (c.yield || 10) / 15;
        if (reserveFor(w, c.key) && get(w, c.key) < reserveFor(w, c.key) * 2) s += 1.5;
        if (c.key === 'cotton') s += need(w, 'cloth') * 1.5 + 0.3;
        if (c.key === 'flowers') s += 0.5 + (reserveFor(w, 'flowers') ? 0.6 : 0);
        if (c.key === 'tea') s += 0.6 + need(w, 'fine_tea');
        if (c.key === 'herbs') s += need(w, 'medicine') + 0.4;
        // v6.89.0 糧食夠了,農夫改種賣得到錢的經濟作物(棉花、茶、葡萄、甘蔗、火龍果、金色小麥…),不再一直休耕
        if (short === 0) s += Math.min(1.2, (c.sellPrice || 1) / 12) * (get(w, c.key) > pop * 2 ? 0.2 : 1);
        return s + (c.reqLevel || 1) * 0.05;
    }

    // ---------- 工坊配方：做最缺的那樣；什麼都不缺就休息 ----------
    // v6.79.1 鎮上有在產、卻還沒有工坊用的原料 → 村民比較會提案蓋對應的工坊(例如收了小麥卻沒有麵包坊)
    function noteSupply(w) { const F = S(w), d = day(w); for (const r of [...CROP_LIKE, 'herbs']) if (get(w, r) >= 1) F.notes['seen:' + r] = d; }
    function supplied(w, r, a) { const s = S(w).notes['seen:' + r]; return get(w, r) >= a * 2 || (s != null && day(w) - s <= 20); }
    function factoryFit(w, def) { return (def?.recipes || []).some(rc => Object.entries(rc.input || {}).every(([r, a]) => supplied(w, r, a)) && Object.keys(rc.output || {}).some(o => need(w, o) > 0.2)); }

    // v6.79.1 原料夠時優先做比較精緻的那樣(茶葉夠就先做精製茶)
    const PREFER = { fine_tea: 0.1 };
    function pickRecipe(w, def, factory) {
        const recipes = def?.recipes || []; if (!recipes.length) return null;
        const fk = factory?.key || (typeof FACTORIES !== 'undefined' ? (Object.entries(FACTORIES).find(([, v]) => v === def) || [])[0] : null);
        let best = null, bestScore = 0.05; const turn = day(w) % recipes.length;
        for (const [i, rc] of recipes.entries()) {
            const ok = Object.entries(rc.input || {}).every(([r, a]) => get(w, r) >= a);
            if (!ok) continue;
            const sc = Math.max(...Object.keys(rc.output || {}).map(r => Math.max(need(w, r), FINE_FROM[r] === fk ? fineNeed(w, r) * 0.8 : 0))) + (i === turn ? 0.03 : 0) + (PREFER[rc.id] || 0); // 一樣缺就輪流做;v6.80.0 精製品還不夠時工坊也會做(優先度低一點)
            if (sc > bestScore) { best = rc.id; bestScore = sc; }
        }
        return best;
    }

    // ---------- v6.80.0 精製品：工坊做的工具(煉鋼坊)、衣服(紡織廠)、家具(家具工坊)比較耐用，耗損減半 ----------
    // 倉庫總數照舊；另外記其中有幾件是精製的。賣掉、蓋房子等其他用途先用普通的，精製的留著自己用
    const FINE_FROM = { tools: 'steelworks', clothing: 'textile_mill', furniture: 'furniture_workshop' };
    const FINE_WEAR = 0.5;
    function fineMap(w) { const F = S(w); if (!F.fine || typeof F.fine !== 'object') F.fine = {}; return F.fine; }
    function fine(w, r) { const m = fineMap(w); const n = Math.max(0, Math.min(m[r] || 0, get(w, r))); m[r] = n; return n; }
    function addFine(w, factoryKey, r, n) { if (FINE_FROM[r] !== factoryKey || !(n > 0)) return 0; const m = fineMap(w); m[r] = (m[r] || 0) + n; return n; }
    // 每天的耗損：用到精製品的那部分只壞一半
    function wear(w, r, base, reason) {
        const total = get(w, r); if (!(total > 0) || !(base > 0)) return 0;
        const f = fine(w, r), share = f / total;
        const fromFine = Math.min(f, base * share * FINE_WEAR), fromNormal = Math.min(total - f, base * (1 - share));
        const n = Math.round((fromFine + fromNormal) * 100) / 100; if (n <= 0) return 0;
        if (!sp(w).consume(r, Math.min(n, total), w.tickCount || 0, reason)) return 0;
        fineMap(w)[r] = Math.max(0, f - fromFine); fine(w, r);
        return n;
    }
    function fineNeed(w, r) { const T = want(w, r); return T > 0 ? Math.max(0, Math.min(1, 1 - fine(w, r) / T)) : 0; }
    function wearRate(w, r) { const total = get(w, r); if (!(total > 0)) return 1; const share = fine(w, r) / total; return 1 - share + share * FINE_WEAR; }

    // ---------- v6.80.0 吃得好：飲食多樣、有麵包糕點果醬、有好酒好茶甜點，三樣裡有兩樣就算「吃得好」 ----------
    // 吃得好的隔天比較耐餓(少吃一成正餐)；連續吃得好三天全鎮心情 +1、七天 +2
    function diet(w) { const F = S(w); if (!F.diet || typeof F.diet !== 'object') F.diet = { streak: 0, good: false, score: 0, today: {} }; if (!F.diet.today) F.diet.today = {}; return F.diet; }
    function dietNote(w, kind, n) { const T = diet(w).today; T[kind] = (T[kind] || 0) + (n || 0); }
    function mealFactor(w) { return diet(w).good ? 0.9 : 1; }
    function dietParts(w, pop) { const T = diet(w).today; return { variety: w.econ?.variety >= 3, snack: (T.snack || 0) >= pop * 0.1, fine: (T.fine || 0) >= Math.max(1.5, pop * 0.05) }; }
    function dietScore(w, pop) { const P = dietParts(w, pop); return (P.variety ? 1 : 0) + (P.snack ? 1 : 0) + (P.fine ? 1 : 0); }
    function dietSettle(w, pop) {
        const D = diet(w), sc = dietScore(w, pop);
        D.parts = dietParts(w, pop); D.raw = { variety: w.econ?.variety ?? 0, snack: Math.round((D.today.snack || 0) * 10) / 10, fine: Math.round((D.today.fine || 0) * 10) / 10 };
        D.score = sc; D.good = sc >= 2; D.streak = D.good ? (D.streak || 0) + 1 : 0; D.today = {};
        const bonus = D.streak >= 7 ? 2 : D.streak >= 3 ? 1 : 0;
        if (bonus) for (const a of npcs(w)) a.moodModifier = (a.moodModifier || 0) + bonus;
        if (D.streak === 3) log(w, '🍰 鎮上連著三天都吃得很好，大家心情跟著好起來。', {});
        else if (D.streak === 7) log(w, '🍰 鎮上已經連續一週吃得很好，大家都說這是最好過的日子。', {});
        return D;
    }

    // ---------- 正餐以外的吃法：麵包、糕點、果醬可以代替正餐 ----------
    function eatSnacks(w, maxN) {
        const S = sp(w), tick = w.tickCount || 0, all = npcs(w); let eaten = 0;
        for (const [r, per, mood] of [['bread', 1, 0], ['pastry', 1, 1], ['jam', 0.5, 1]]) {
            if (eaten >= maxN) break;
            const have = get(w, r); if (have < 1) continue;
            const use = Math.min(have, Math.ceil((maxN - eaten) / per));
            if (use > 0 && S.consume(r, use, tick, t('當正餐吃'))) {
                eaten += use * per; dietNote(w, 'snack', use * per); if (mood) dietNote(w, 'fine', use); // v6.80.0 記下今天吃得好不好
                if (mood) for (let i = 0; i < Math.min(use, all.length); i++) { const a = pick(all); a.moodModifier = (a.moodModifier || 0) + mood; }
            }
        }
        return eaten;
    }

    function S(w) { if (!w.flow || typeof w.flow !== 'object') w.flow = { notes: {} }; if (!w.flow.notes) w.flow.notes = {}; return w.flow; }
    function once(w, key, every, fn) { const F = S(w), d = day(w); if (F.notes[key] != null && d - F.notes[key] < every) return; F.notes[key] = d; fn(); }
    function log(w, k, p) { try { w.logMessageT?.('economy', k, p || {}); } catch (e) {} }
    // 喝掉／用掉 n 份，每份讓一位村民心情 +mood
    function enjoy(w, r, n, mood, reason) {
        const have = get(w, r); const use = Math.min(have, n); if (use < 0.5) return 0;
        const u = Math.round(use * 10) / 10;
        if (!sp(w).consume(r, u, w.tickCount || 0, reason)) return 0;
        const all = npcs(w); for (let i = 0; i < Math.min(Math.ceil(u), all.length); i++) { const a = pick(all); a.moodModifier = (a.moodModifier || 0) + mood; }
        return u;
    }

    function daily(w) {
        const F = S(w), d = day(w), Sp = sp(w); if (!Sp || F.lastDay === d) return; F.lastDay = d;
        const all = npcs(w), pop = Math.max(1, all.length), tick = w.tickCount || 0;
        const facts = activeFactories(w);
        noteSupply(w); // v6.79.1 記下鎮上有哪些原料(收成馬上進糧倉，存量看不出來)
        // 1) 收成進糧倉(工坊要用的先留著)
        let toFood = 0;
        for (const [c, val] of Object.entries(CROP_FOOD)) {
            const extra = get(w, c) - reserveFor(w, c); if (extra < 1) continue;
            const n = Math.floor(extra);
            if (Sp.consume(c, n, tick, t('收成進糧倉'))) { Sp.add('food', Math.round(n * val * 10) / 10, tick, t('收成進糧倉')); toFood += n; }
        }
        if (toFood >= 10) once(w, 'harvest', 5, () => log(w, '🌾 田裡收成的作物有 {n} 份進了糧倉。', { n: toFood }));
        // 2) 棉花：有紡織廠就留給工廠，沒有就在家紡成布(2 棉 → 1 布)
        { const extra = get(w, 'cotton') - reserveFor(w, 'cotton'); if (extra >= 2 && need(w, 'cloth') > 0) { const n = Math.floor(extra / 2) * 2; if (Sp.consume('cotton', n, tick, t('在家紡紗'))) Sp.add('cloth', n / 2, tick, t('在家紡紗')); } }
        // 3) 花：布置小鎮(香水坊要用的先留著)
        { const extra = get(w, 'flowers') - reserveFor(w, 'flowers'); const n = Math.min(extra, Math.max(1, pop * 0.1)); if (n >= 1 && Sp.consume('flowers', Math.floor(n), tick, t('插花布置'))) for (const a of all) a.moodModifier = (a.moodModifier || 0) + 0.3; }
        // 4) 糖：廚師拿來做菜(留 10 給糕點與果醬)
        { const cooks = all.filter(a => a.job?.key === 'cook').length; const n = Math.min(cooks, Math.floor(get(w, 'sugar') - 10)); if (n >= 1 && Sp.consume('sugar', n, tick, t('做菜用糖'))) dietNote(w, 'fine', n), Sp.add('meals', n * 2, tick, t('甜點與好菜')); }
        // 5) 酒館與茶館：喝的人心情變好
        let drinks = 0;
        { const a = enjoy(w, 'beer', pop * 0.12, 1, t('酒館的啤酒')); drinks += a; dietNote(w, 'fine', a * 0.5); } // v6.80.0 啤酒算半份好酒
        { const a = enjoy(w, 'wine', pop * 0.05, 1.5, t('酒館的葡萄酒')), b = enjoy(w, 'fine_tea', pop * 0.04, 1, t('茶館的好茶')); drinks += a + b; dietNote(w, 'fine', a + b); } // v6.80.0 好酒好茶算吃得好
        { const a = enjoy(w, 'herbal_tea', pop * 0.04, 1, t('養生茶')); drinks += a; dietNote(w, 'fine', a * 0.5); }
        { const extra = get(w, 'tea') - reserveFor(w, 'tea'); if (extra >= 1) { const a = enjoy(w, 'tea', Math.min(extra, pop * 0.04), 0.8, t('泡茶喝')); drinks += a; dietNote(w, 'fine', a * 0.5); } }
        if (drinks >= 3) once(w, 'drinks', 7, () => log(w, '🍻 晚上酒館與茶館很熱鬧，今天喝掉了 {n} 份酒和茶。', { n: Math.round(drinks) }));
        // 6) 香水：約會時用
        enjoy(w, 'perfume', Math.max(0.5, pop * 0.02), 2, t('約會擦香水'));
        // 7) 家具會舊、精裝家具給講究的人家
        wear(w, 'furniture', pop * 0.01, t('家具用舊了')); // v6.80.0 家具工坊做的精製家具壞得慢一半
        enjoy(w, 'luxury_furniture', pop * 0.004, 2, t('添購精裝家具'));
        // 8) 黃金送去鑄成銀幣(一天最多 5 兩)
        { const g = Math.min(5, Math.floor(get(w, 'gold'))); if (g >= 1 && Sp.consume('gold', g, tick, t('鑄幣'))) { Sp.add('silver', g * 20, tick, t('黃金鑄成銀幣')); once(w, 'mint', 10, () => log(w, '🪙 鎮上把 {g} 兩黃金鑄成了銀幣。', { g })); } }
        // 9) 廚房人手：連三天餐食不夠、糧食又很多，就請一位最會煮的農夫改當廚師(十天最多一次)
        { const cooks = all.filter(a => a.job?.key === 'cook').length, farmers = all.filter(a => a.job?.key === 'farmer');
          F.mealShort = (get(w, 'meals') < pop * 0.5 && get(w, 'food') > pop * 20) ? (F.mealShort || 0) + 1 : 0;
          if (F.mealShort >= 3 && farmers.length >= 3 && cooks * 9 < pop * 1.5 && (F.lastHire == null || d - F.lastHire >= 10) && typeof Job !== 'undefined') {
              const cand = farmers.filter(a => (a.foodRole || w.econ?.roles?.[a.agentId]) !== 'fish').sort((x, y) => (y.skills?.get?.('烹飪')?.level || 0) - (x.skills?.get?.('烹飪')?.level || 0))[0];
              if (cand) { cand.job = new Job('cook'); F.lastHire = d; F.mealShort = 0; try { cand.memory?.addT?.(tick, w.clock?.timeStr || '', 'social', '鎮上的廚房忙不過來，我放下鋤頭改去當廚師了。', {}, 6, []); } catch (e) {} log(w, '🍳 廚房人手不夠、糧倉卻很滿：{who}改行當廚師了。', { who: cand.name }); }
          } }
        F.facts = facts.length;
        dietSettle(w, pop); // v6.80.0 今天吃得好不好，影響明天要吃多少正餐
    }

    const CROP_LIKE = new Set([...Object.keys(CROP_FOOD), 'cotton', 'flowers', 'tea', 'sugar']);
    // 跟商人買作物：只買工坊要用的、缺糧時的糧食、一點茶葉、缺布時的棉花
    function buyLow(w, r) {
        if (!CROP_LIKE.has(r)) return null;
        const pop = Math.max(1, npcs(w).length);
        let n = reserveFor(w, r);
        if (CROP_FOOD[r] && get(w, 'food') < pop * 12) n = Math.max(n, 10);
        if (r === 'tea') n = Math.max(n, 5);
        if (r === 'cotton' && need(w, 'cloth') > 0.5) n = Math.max(n, 10);
        return n;
    }
    return { want, need, demandMult, jobDemand, multiOut, inputNeed: reserveFor, buyLow, effective, lack, canPay, pay, cropScore, pickRecipe, factoryFit, eatSnacks, fine, addFine, wear, wearRate, FINE_FROM, FINE_WEAR, diet, mealFactor, dietScore, daily, CROP_FOOD, SUB, KEEP };
})();
if (typeof window !== 'undefined') window.FLOW = FLOW;

// v6.81.0 給 AI 的鎮況多一句糧倉狀態(以前 AI 看到小麥只剩幾份，就在提案裡說糧倉見底)
if (typeof ConversationEngine !== 'undefined' && !ConversationEngine.prototype._flowBrief) {
    const CE = ConversationEngine.prototype; CE._flowBrief = true; const _tb = CE._townBrief;
    CE._townBrief = function (world) {
        const s = _tb.call(this, world);
        try {
            const food = Math.round(world.stockpile?.get?.('food') || 0), cap = 400 + (world.buildings?.getEffect?.('food_capacity', 0) || 0);
            const pop = Math.max(1, Object.values(world.agents || {}).filter(a => !a.isPlayer && !a.isDead).length);
            const st = food >= cap ? t('糧倉滿了') : food >= pop * 15 ? t('存糧充足') : food >= pop * 4 ? t('存糧還夠') : t('存糧快見底');
            return `${s}${t('；')}${t('糧倉')} ${food}/${cap}${t('（')}${st}${t('）')}${t('；')}${t('作物收成會直接存進糧倉，小麥等作物存量少是正常的')}`;
        } catch (e) { return s; }
    };
}

// 存讀檔：每日提示的冷卻、精製品數量(v6.80.0)、吃得好的連續天數(v6.80.0)
if (typeof World !== 'undefined' && !World.prototype._flowHooked) {
    World.prototype._flowHooked = true;
    const _ser = World.prototype.serialize, _load = World.prototype.loadSave, _reset = World.prototype.reset;
    World.prototype.serialize = function () { const d = _ser.call(this); try { if (d && this.flow) d.flow = { notes: this.flow.notes || {}, lastDay: this.flow.lastDay ?? null, fine: this.flow.fine || {}, diet: this.flow.diet ? { streak: this.flow.diet.streak || 0, good: !!this.flow.diet.good, score: this.flow.diet.score || 0, today: this.flow.diet.today || {} } : null }; } catch (e) {} return d; };
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.flow = (data && data.flow && typeof data.flow === 'object') ? { notes: { ...(data.flow.notes || {}) }, lastDay: data.flow.lastDay ?? null, fine: { ...(data.flow.fine || {}) }, diet: data.flow.diet && typeof data.flow.diet === 'object' ? { streak: data.flow.diet.streak || 0, good: !!data.flow.diet.good, score: data.flow.diet.score || 0, today: { ...(data.flow.diet.today || {}) } } : null } : null; } catch (e) {} return r; };
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.flow = null; return r; };
}
