// RimTown - sim-towngen.js（v6.45.0）：種子隨機城鎮。
// 每個人的第一個鎮固定是邊境鎮，四個手寫鄰鎮（海風鎮／礦山鎮／林間村／市集城）照舊；第五個鎮起由「種子」組合生成：
// 同一個種子永遠產生同一個鎮（鎮名、地形、特色、經濟、科技、政治、民風、人口），存檔只要記種子。
// 「活著」的鎮（有完整存檔、馬車到得了）最多 10 個；再遠的只留城鎮卡（約 1KB），在背景慢慢變化、上日報跨鎮專欄。
// 載入順序：放在 sim-systems.js 之後（只在執行期用到 TOWN_THEMES／RESEARCH_TREE／I18N，不依賴頂層順序）。

const TOWNGEN_MAX_LIVE = 10;   // 同時「活著」的鎮(含邊境鎮與四個鄰鎮)
const TOWNGEN_MAX_CARDS = 100; // 城鎮卡上限(每張約 1KB)

const TownGen = (() => {
    // 小型可重現亂數(mulberry32);同一個種子永遠同一串數字
    function rng(seed) {
        let a = seed >>> 0;
        const next = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
        return { f: next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p,
            shuffle: (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; },
            weighted: (pairs) => { const tot = pairs.reduce((s, p) => s + p[1], 0); let r = next() * tot; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[pairs.length - 1][0]; } };
    }
    function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
    const isEn = () => { try { return typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en'; } catch (e) { return false; } };
    // 中文句子用單引號樣板＋{鍵}代入(英文句子另外寫;兩種語言各自一句,不經過 t())
    const zf = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? ''));
    const L = (p) => (p && typeof p === 'object') ? (isEn() ? (p.en || p.zh) : p.zh) : p;

    // ---- 地形底圖(沿用現有五種 3D 版面,畫面才有對應的樣子) ----
    const BASES = {
        harbor:   { terrain: 'coastal',  sfx: [['灣', 'Bay'], ['港', 'Harbor'], ['渡', 'Ferry'], ['汀', 'Shoals'], ['澳', 'Cove']], exp: [['food', 4], ['cloth', 3], ['silver', 2], ['herbs', 1]], pop: [10, 24] },
        mountain: { terrain: 'mountain', sfx: [['嶺', 'Ridge'], ['坡', 'Slope'], ['岩', 'Crag'], ['峰', 'Peak'], ['坳', 'Hollow']], exp: [['stone', 4], ['metal', 4], ['tools', 2], ['herbs', 1]], pop: [8, 20] },
        forest:   { terrain: 'forest',   sfx: [['林', 'Wood'], ['谷', 'Vale'], ['寨', 'Stockade'], ['蔭', 'Shade'], ['莊', 'Grove']], exp: [['wood', 4], ['herbs', 4], ['furniture', 2], ['food', 1]], pop: [8, 18] },
        market:   { terrain: 'plains',   sfx: [['集', 'Market'], ['城', 'City'], ['墟', 'Fair'], ['驛', 'Post'], ['市', 'Mart']], exp: [['silver', 4], ['cloth', 3], ['tools', 2], ['clothing', 2]], pop: [16, 30] },
        frontier: { terrain: null,       sfx: [['原', 'Plain'], ['屯', 'Stead'], ['堡', 'Fort'], ['田', 'Fields'], ['橋', 'Bridge']], exp: [['food', 4], ['wood', 3], ['stone', 1], ['herbs', 1]], pop: [10, 22] },
    };
    const RES = ['food', 'wood', 'stone', 'metal', 'cloth', 'herbs', 'silver', 'tools', 'clothing', 'furniture'];
    const RES_NAME = { food: ['食物', 'food'], wood: ['木材', 'wood'], stone: ['石材', 'stone'], metal: ['金屬', 'metal'], cloth: ['布料', 'cloth'], herbs: ['草藥', 'herbs'], silver: ['銀幣', 'silver'], tools: ['工具', 'tools'], clothing: ['衣物', 'clothing'], furniture: ['家具', 'furniture'] };
    const PREFIX = [['霧', 'Mist'], ['赤', 'Red'], ['銀', 'Silver'], ['柳', 'Willow'], ['鷺', 'Heron'], ['楓', 'Maple'], ['青', 'Azure'], ['白', 'White'], ['金', 'Gold'], ['墨', 'Ink'], ['松', 'Pine'], ['梅', 'Plum'],
        ['雲', 'Cloud'], ['月', 'Moon'], ['星', 'Star'], ['風', 'Wind'], ['鐵', 'Iron'], ['鹿', 'Deer'], ['狐', 'Fox'], ['鷹', 'Hawk'], ['龜', 'Turtle'], ['桃', 'Peach'], ['竹', 'Bamboo'], ['蘆', 'Reed'],
        ['苔', 'Moss'], ['琥珀', 'Amber'], ['翠', 'Jade'], ['曉', 'Dawn'], ['暮', 'Dusk'], ['霜', 'Frost'], ['雪', 'Snow'], ['雷', 'Thunder'], ['泉', 'Spring'], ['燕', 'Swallow'], ['鶴', 'Crane'], ['蓮', 'Lotus'],
        ['杏', 'Apricot'], ['槐', 'Locust'], ['藍', 'Blue'], ['紫', 'Violet'], ['朱', 'Vermilion'], ['長', 'Long'], ['古', 'Old'], ['南', 'South'], ['北', 'North'], ['東', 'East'], ['西', 'West'], ['蜂', 'Bee']];
    const ROOFS = ['#C9533D', '#B9473A', '#8C5A3C', '#A85A3A', '#D28A3D', '#7A6F5C', '#5B7F8E', '#3C7E71', '#4F6F93', '#6B6F78', '#5B6E7A', '#4E5A66', '#5E7F4A', '#6B8F5A', '#8C4FA0', '#D2B23D', '#9C3D54', '#3D5C9C', '#B07A3D', '#4A7A8C'];

    // ---- 特色(每鎮抽 1～2 個) ----
    const TRAITS = {
        hot_spring:  { zh: '溫泉', en: 'hot springs', d: ['山腳下冒著熱氣的溫泉，旅人都說泡完百病全消', 'steaming springs at the foot of the hills that travellers swear cure everything'], stock: { herbs: 20 }, temper: 'merry' },
        ruins:       { zh: '古代遺跡', en: 'ancient ruins', d: ['鎮外有座沒人讀得懂碑文的古代遺跡', 'ancient ruins outside town whose inscriptions nobody can read'], stock: { research_points: 30 }, temper: 'dreamy' },
        haunted:     { zh: '鬧鬼傳說', en: 'a ghost story', d: ['老人說夜裡鐘樓會自己響', 'the old folk say the bell tower rings by itself at night'], temper: 'gossipy' },
        plague:      { zh: '瘟疫後重建', en: 'rebuilt after a plague', d: ['十幾年前一場瘟疫帶走半個鎮，倖存者咬牙重建', 'a plague took half the town a decade ago and the survivors rebuilt'], stock: { medicine: 15, herbs: 20 }, pop: -4, temper: 'devout' },
        immigrants:  { zh: '移民潮', en: 'a wave of newcomers', d: ['這幾年湧進大批外地人，老居民和新住戶還在磨合', 'newcomers have poured in, and old and new residents are still finding their footing'], pop: 6, temper: 'gossipy' },
        monastery:   { zh: '山中修院', en: 'a hillside monastery', d: ['半山腰的修院每天清晨傳來誦經聲', 'chanting drifts down from the hillside monastery every dawn'], temper: 'devout' },
        horses:      { zh: '馬場', en: 'horse ranches', d: ['四周都是牧場，鎮上人人都會騎馬', 'ranches all around, and everyone in town can ride'], stock: { food: 40 }, temper: 'industrious' },
        festivals:   { zh: '祭典之鄉', en: 'endless festivals', d: ['一年到頭都在辦祭典，鎮民最愛熱鬧', 'there is a festival nearly every month, and the townsfolk love a crowd'], temper: 'merry' },
        smugglers:   { zh: '走私客', en: 'smugglers', d: ['碼頭和山道上常有來路不明的貨', 'goods of uncertain origin turn up on the docks and mountain paths'], stock: { silver: 120 }, temper: 'brawler' },
        scholars:    { zh: '學者之城', en: 'scholars', d: ['鎮上讀書人特別多，酒館裡也在辯論', 'the town is full of scholars who argue even in the tavern'], stock: { research_points: 40 }, temper: 'dreamy' },
        floods:      { zh: '年年水患', en: 'yearly floods', d: ['每年雨季河水都會漫進低窪的街道', 'every rainy season the river spills into the low streets'], stock: { wood: -20 }, temper: 'industrious' },
        battlefield: { zh: '舊戰場', en: 'an old battlefield', d: ['鎮外的舊戰場至今還挖得到生鏽的箭頭', 'rusty arrowheads still turn up on the old battlefield outside town'], stock: { tools: 10, metal: 20 }, temper: 'brawler' },
        silk:        { zh: '絲綢', en: 'silk weaving', d: ['家家戶戶養蠶織布，布料遠近馳名', 'every household raises silkworms, and the cloth is famous far and wide'], stock: { cloth: 80 }, temper: 'industrious' },
        salt:        { zh: '鹽井', en: 'salt wells', d: ['鎮中央的鹽井養活了整個鎮', 'the salt wells in the middle of town keep everyone fed'], stock: { food: 30, silver: 60 } },
        bees:        { zh: '養蜂', en: 'beekeeping', d: ['春天整個鎮都是蜂鳴和花香', 'in spring the whole town hums with bees and smells of flowers'], stock: { food: 30 }, temper: 'merry' },
        clocks:      { zh: '鐘錶匠', en: 'clockmakers', d: ['鐘錶匠們做的機關連城裡人都來訂', 'the clockmakers build mechanisms that even city folk order'], stock: { tools: 15, metal: 15 }, temper: 'industrious' },
    };
    // 民風 → 撒在村民身上的個性
    const TEMPERS = {
        merry:       { zh: '愛熱鬧', en: 'lively', traits: ['optimist', 'charismatic'] },
        devout:      { zh: '虔誠', en: 'devout', traits: ['kind', 'stoic', 'ascetic'] },
        brawler:     { zh: '火爆', en: 'hot-tempered', traits: ['abrasive', 'jealous'] },
        industrious: { zh: '勤快', en: 'hard-working', traits: ['hardworking', 'perfectionist', 'early_bird'] },
        dreamy:      { zh: '愛做夢', en: 'dreamy', traits: ['creative', 'romantic', 'night_owl'] },
        gossipy:     { zh: '愛聊八卦', en: 'chatty', traits: ['gossip', 'neurotic'] },
    };
    const POLICIES = ['economy', 'welfare', 'defense', 'culture', 'nature', 'freedom'];
    const POLICY_NAME = { economy: ['經濟發展', 'the economy'], welfare: ['社會福利', 'welfare'], defense: ['軍事防禦', 'defence'], culture: ['文化教育', 'culture and education'], nature: ['自然保育', 'nature'], freedom: ['個人自由', 'personal freedom'] };
    const RELATIONS = { friendly: ['友好', 'friendly'], rival: ['世仇', 'rivals'], trade: ['貿易夥伴', 'trade partners'] };
    const FESTIVALS = [['燈籠節', 'Lantern Festival'], ['豐收祭', 'Harvest Fair'], ['漁火節', 'Fishing-Light Night'], ['霜月祭', 'Frost Moon Rite'], ['花朝節', 'Flower Day'], ['鐵砧節', 'Anvil Day'],
        ['風箏會', 'Kite Meet'], ['星夜祭', 'Starlit Vigil'], ['新酒節', 'New Wine Feast'], ['雪橇賽', 'Sled Race'], ['龍舟賽', 'Dragon Boat Race'], ['燭光遊行', 'Candle Parade']];
    const BIAS = { farming: ['農業', 'farming'], medicine: ['醫學', 'medicine'], industry: ['工藝', 'craft and industry'], culture: ['學問', 'learning'] };
    // 地點名:鎮名字首＋地點(讓每個鎮的酒館、公所都有自己的名字)
    const LOC_PAT = {
        town_hall: [['{p}公所', '{P} Town Hall'], ['{p}議事廳', '{P} Council Hall']],
        tavern: [['{p}酒館', 'The {P} Tavern'], ['{p}客棧', '{P} Inn'], ['醉{p}樓', 'Tipsy {P} House']],
        town_square: [['{p}廣場', '{P} Square'], ['{p}市口', '{P} Crossing']],
        general_store: [['{p}雜貨', '{P} General Store'], ['{p}商行', '{P} Trading House']],
        chapel: [['{p}神社', '{P} Shrine'], ['{p}小廟', '{P} Temple']],
        park: [['{p}花園', '{P} Gardens'], ['{p}綠地', '{P} Green']],
    };

    function sig(c) { return [c.base, ...c.traits.slice().sort(), ...c.exports.slice().sort(), 'e' + c.era, c.policy, c.temper, 'p' + Math.floor(c.pop / 6)]; }
    function similar(a, b) { const sa = sig(a), sb = new Set(sig(b)); let n = 0; for (const x of sa) if (sb.has(x)) n++; return n >= 6; }

    // 一個種子 → 一張城鎮卡(純函式,不讀任何外部狀態)
    function card(seed) {
        const r = rng(seed);
        const base = r.weighted([['harbor', 2], ['mountain', 2], ['forest', 2], ['market', 1.5], ['frontier', 2]]);
        const B = BASES[base];
        const pre = r.pick(PREFIX), suf = r.pick(B.sfx);
        const withTown = r.chance(0.45);
        const tSuffix = base === 'market' ? ['城', 'City'] : r.chance(0.5) ? ['鎮', 'Town'] : ['村', 'Village'];
        const name = pre[0] + suf[0] + (withTown && suf[0] !== '城' && suf[0] !== '市' ? tSuffix[0] : '');
        const nameEn = pre[1] + ' ' + suf[1] + (withTown && suf[0] !== '城' && suf[0] !== '市' && tSuffix[1] !== 'City' ? ' ' + tSuffix[1] : '');
        const traitKeys = r.shuffle(Object.keys(TRAITS)).slice(0, r.chance(0.55) ? 2 : 1);
        const exp1 = r.weighted(B.exp); let exp2 = r.weighted(B.exp.filter(([k]) => k !== exp1)); if (!exp2 || exp2 === exp1) exp2 = r.pick(RES.filter(k => k !== exp1));
        const imports = r.shuffle(RES.filter(k => k !== exp1 && k !== exp2 && k !== 'silver')).slice(0, 2);
        const wealth = r.weighted([['poor', 3], ['modest', 5], ['rich', 2]]);
        let pop = r.int(B.pop[0], B.pop[1]); for (const k of traitKeys) pop += TRAITS[k].pop || 0; pop = Math.max(8, Math.min(30, pop));
        const era = r.weighted([[1, traitKeys.includes('scholars') || traitKeys.includes('ruins') ? 2 : 5], [2, 3], [3, traitKeys.includes('scholars') ? 3 : 1]]);
        const temperFromTrait = traitKeys.map(k => TRAITS[k].temper).filter(Boolean);
        const temper = temperFromTrait.length && r.chance(0.7) ? r.pick(temperFromTrait) : r.pick(Object.keys(TEMPERS));
        const policy = r.weighted(POLICIES.map(p => [p, (temper === 'brawler' && p === 'defense') || (temper === 'devout' && p === 'welfare') || (temper === 'industrious' && p === 'economy') || (temper === 'dreamy' && p === 'culture') || (temper === 'merry' && p === 'freedom') ? 4 : 1]));
        const bias = r.weighted([['farming', base === 'frontier' || base === 'harbor' ? 3 : 1], ['medicine', traitKeys.includes('plague') || traitKeys.includes('hot_spring') ? 4 : 1], ['industry', base === 'mountain' || base === 'market' ? 3 : 1], ['culture', traitKeys.includes('scholars') || traitKeys.includes('ruins') ? 4 : 1]]);
        const relation = r.weighted([['friendly', 3], ['trade', 3], ['rival', traitKeys.includes('smugglers') || temper === 'brawler' ? 3 : 1]]);
        const festival = r.pick(FESTIVALS);
        const founded = r.int(12, 260);
        const roof = r.shuffle(ROOFS).slice(0, 6);
        // 已研究完的科技:依時代照前置條件往前推
        const techDone = [];
        try {
            if (typeof RESEARCH_TREE !== 'undefined') {
                const want = era === 1 ? r.int(0, 3) : era === 2 ? r.int(6, 10) : r.int(12, 17);
                const done = new Set();
                for (let i = 0; i < want; i++) {
                    const avail = Object.entries(RESEARCH_TREE).filter(([k, d]) => !done.has(k) && (d.prerequisites || []).every(p => done.has(p)) && (d.era || 1) <= era).map(([k]) => k);
                    if (!avail.length) break; const k = r.pick(avail); done.add(k); techDone.push(k);
                }
            }
        } catch (e) {}
        const locNames = {}, locEn = {};
        const stem = pre;
        for (const [loc, pats] of Object.entries(LOC_PAT)) { if (!r.chance(0.75)) continue; const p = r.pick(pats); locNames[loc] = p[0].replace('{p}', stem[0]); locEn[locNames[loc]] = p[1].replace('{P}', stem[1]); }
        const c = { v: 1, seed: seed >>> 0, key: 'g' + (seed >>> 0).toString(36), name, nameEn, base, terrain: B.terrain || r.pick(['plains', 'riverside']), traits: traitKeys, exports: [exp1, exp2], imports, wealth, pop, era, techDone, bias, policy, temper, relation,
            festival: { zh: festival[0], en: festival[1] }, founded, roof, locNames, locEn };
        return c;
    }

    // 文字:城鎮簡介(依語言)
    function blurb(c) {
        const en = isEn();
        const tr = c.traits.map(k => TRAITS[k]);
        const ex = c.exports.map(k => RES_NAME[k][en ? 1 : 0]).join(en ? ' and ' : '、');
        const im = c.imports.map(k => RES_NAME[k][en ? 1 : 0]).join(en ? ' and ' : '、');
        const era = typeof RESEARCH_ERAS !== 'undefined' ? RESEARCH_ERAS[c.era] : null;
        if (en) return `Founded ${c.founded} years ago, ${c.nameEn} is known for ${tr.map(x => x.en).join(' and ')}: ${tr[0].d[1]}. About ${c.pop} people live there; they produce ${ex} but are short of ${im}. The townsfolk are ${TEMPERS[c.temper].en}, care most about ${POLICY_NAME[c.policy][1]}, and celebrate the ${c.festival.en}. Relations with us: ${RELATIONS[c.relation][1]}.`;
        return zf('{n}建鎮 {f} 年，以{tr}聞名：{d}。約 {p} 人，盛產{ex}，缺{im}；{era}民風{tm}，最在乎{po}，每年辦{fe}。和我們的關係：{re}。', { n: c.name, f: c.founded, tr: tr.map(x => x.zh).join('和'), d: tr[0].d[0], p: c.pop, ex, im, era: era ? zf('科技在「{e}」時代，', { e: era.name }) : '', tm: TEMPERS[c.temper].zh, po: POLICY_NAME[c.policy][0], fe: c.festival.zh, re: RELATIONS[c.relation][0] });
    }
    function tags(c) {
        const en = isEn();
        return [...c.traits.map(k => en ? TRAITS[k].en : TRAITS[k].zh), en ? TEMPERS[c.temper].en : TEMPERS[c.temper].zh, (en ? 'exports ' : '產') + c.exports.map(k => RES_NAME[k][en ? 1 : 0]).join('/'), (en ? 'pop. ' : '人口 ') + (c.state?.pop || c.pop)];
    }
    function displayName(c) { return isEn() ? c.nameEn : c.name; }

    // 把一張卡登記成可用的主題(TOWN_THEMES、鎮名→主題、英文名);存檔只記種子,讀檔時再登記一次
    function register(c) {
        if (!c || typeof TOWN_THEMES === 'undefined') return null;
        if (TOWN_THEMES[c.key]) return TOWN_THEMES[c.key];
        TOWN_THEMES[c.key] = { key: c.key, townName: c.name, terrain: c.terrain, exports: c.exports.slice(), imports: c.imports.slice(), locationNames: Object.assign({}, c.locNames), stockpile: stockOf(c), generated: true, base: c.base, roof: c.roof, pop: c.pop, card: c };
        if (typeof TOWN_NAME_THEME !== 'undefined') { const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); TOWN_NAME_THEME.unshift([c.key, new RegExp(esc(c.name) + '|' + esc(c.nameEn))]); }
        try { if (typeof I18N !== 'undefined' && I18N.registerName) { I18N.registerName(c.name, c.nameEn); for (const [zh, en] of Object.entries(c.locEn || {})) I18N.registerName(zh, en); I18N.registerName(c.festival.zh, c.festival.en); } } catch (e) {}
        return TOWN_THEMES[c.key];
    }
    function stockOf(c) { const r = rng(c.seed ^ 0x9e3779b9); const mult = { poor: 0.7, modest: 1, rich: 1.5 }[c.wealth] || 1; const s = { silver: { poor: 70, modest: 150, rich: 380 }[c.wealth] || 150 };
        for (const k of c.exports) s[k] = Math.round((k === 'silver' ? s.silver * 1.6 : 200 + r.int(0, 140)) * mult);
        for (const k of c.imports) s[k] = r.int(5, 25);
        for (const k of c.traits) for (const [rk, v] of Object.entries(TRAITS[k]?.stock || {})) s[rk] = Math.max(0, (s[rk] ?? 60) + v);
        s.food = Math.max(s.food ?? 0, 60 + c.pop * 6); // 缺糧的鎮也要撐得過開頭幾天(以前缺食物的礦山型鎮開局只有 9 份)
        return s; }
    function bySeed(seed) { const c = card(seed); register(c); return c; }

    // 開新鎮後把卡上的設定套進世界:科技、民風個性、政治偏好、文化(給 AI 對話與日報用)
    function applyToWorld(world, c) {
        if (!world || !c) return;
        world.genSeed = c.seed;
        world.townCulture = { temper: c.temper, policy: c.policy, festival: c.festival, traits: c.traits.slice(), bias: c.bias, relation: c.relation, founded: c.founded };
        try {
            const R = world.research; if (R && R.projects) { for (const k of c.techDone) if (R.projects[k]) { R.projects[k].status = 'complete'; R.projects[k].progress = R.projects[k].cost; } R.refreshLocks?.(); }
        } catch (e) {}
        try {
            const tps = TEMPERS[c.temper]?.traits || []; const r = rng(c.seed ^ 0x1234567);
            for (const a of Object.values(world.agents || {})) {
                if (a.isPlayer || !a.personality || !Array.isArray(a.personality.traits) || !r.chance(0.45)) continue;
                const tr = r.pick(tps); if (!tr || a.personality.traits.includes(tr)) continue;
                const bad = (typeof INCOMPATIBLE !== 'undefined' ? INCOMPATIBLE : []).some(([x, y]) => (x === tr && a.personality.traits.includes(y)) || (y === tr && a.personality.traits.includes(x)));
                if (bad) continue;
                if (a.personality.traits.length >= 3) a.personality.traits[a.personality.traits.length - 1] = tr; else a.personality.traits.push(tr);
            }
        } catch (e) {}
    }
    // 給 AI 提示詞的一句話民風(依語言)
    function cultureLine(world) {
        const k = world?.townCulture; if (!k) return '';
        const en = isEn();
        const tr = (k.traits || []).map(x => TRAITS[x] ? (en ? TRAITS[x].en : TRAITS[x].zh) : '').filter(Boolean).join(en ? ', ' : '、');
        return en ? `This town is known for ${tr}; people here are ${TEMPERS[k.temper]?.en || ''}, care most about ${POLICY_NAME[k.policy]?.[1] || ''} and celebrate the ${k.festival?.en || ''}.`
            : zf('本鎮以{tr}聞名，民風{tm}，大家最在乎{po}，每年辦{fe}。', { tr, tm: TEMPERS[k.temper]?.zh || '', po: POLICY_NAME[k.policy]?.[0] || '', fe: k.festival?.zh || '' });
    }

    // 背景發展:沒去過、只有城鎮卡的鎮每天慢慢變(人口、繁榮、時代、傳聞),上日報跨鎮專欄
    const NEWS = [
        (c, r) => ({ zh: zf('{n}的{f}熱鬧登場，鄰近村落都有人去湊熱鬧', { n: c.name, f: c.festival.zh }), en: `The ${c.festival.en} was held in ${c.nameEn}, drawing visitors from nearby villages` }),
        (c, r) => { const d = r.pick([['暴風雨', 'a storm'], ['乾旱', 'a drought'], ['大雪', 'heavy snow'], ['山洪', 'a flash flood']]); c.state.prosperity = Math.max(0, c.state.prosperity - 4); return { zh: zf('{n}遭遇{d}，鎮民正忙著善後', { n: c.name, d: d[0] }), en: `${c.nameEn} was hit by ${d[1]}; residents are cleaning up` }; },
        (c, r) => ({ zh: zf('{n}選出新鎮長，新官上任先談{p}', { n: c.name, p: POLICY_NAME[c.policy][0] }), en: `${c.nameEn} elected a new mayor, who is starting with ${POLICY_NAME[c.policy][1]}` }),
        (c, r) => { const tr = TRAITS[r.pick(c.traits)]; return { zh: `聽說${c.name}的${tr.zh}吸引了不少旅人`, en: `Word is that the ${tr.en} of ${c.nameEn} are drawing plenty of travellers` }; },
        (c, r) => { const k = r.pick(c.exports); return { zh: zf('{n}今年的{r}大豐收，商人搶著去收貨', { n: c.name, r: RES_NAME[k][0] }), en: `${c.nameEn} had a bumper year for ${RES_NAME[k][1]}, and traders are rushing to buy` }; },
    ];
    function drift(c, day) {
        if (!c) return null;
        const st = c.state || (c.state = { pop: c.pop, prosperity: { poor: 25, modest: 45, rich: 65 }[c.wealth] || 40, era: c.era, news: [], day: day });
        if (st.day >= day) return null;
        const r = rng((c.seed ^ Math.imul(day + 1, 2654435761)) >>> 0);
        let news = null;
        for (let d = st.day + 1; d <= day && d <= st.day + 30; d++) {
            const target = { poor: 30, modest: 50, rich: 70 }[c.wealth] || 50;
            st.prosperity = Math.max(0, Math.min(100, st.prosperity + (target - st.prosperity) * 0.05 + (r.f() - 0.5) * 3));
            if (r.chance(0.06)) { const before = st.pop; st.pop = Math.max(6, Math.min(40, st.pop + (st.prosperity > 50 ? 1 : r.chance(0.5) ? 1 : -1))); if (st.pop > before && r.chance(0.4)) news = { zh: `${c.name}人口增加到 ${st.pop} 人`, en: `${c.nameEn} has grown to ${st.pop} people` }; }
            if (st.era < 3 && r.chance(c.traits.includes('scholars') ? 0.012 : 0.005)) { st.era++; const en = typeof RESEARCH_ERAS !== 'undefined' ? RESEARCH_ERAS[st.era] : null; news = { zh: zf('{n}研究出新技術，進入「{e}」時代', { n: c.name, e: en ? en.name : st.era }), en: `${c.nameEn} made a breakthrough and entered era ${st.era}` }; }
            if (!news && r.chance(0.12)) news = r.pick(NEWS)(c, r);
            if (news) { news.day = d; st.news.push(news); st.news = st.news.slice(-3); news = null; }
        }
        st.day = day;
        return st.news[st.news.length - 1] || null;
    }

    // ---- 登記簿:這個玩家發現過哪些鎮(只存種子＋狀態,卡片內容隨時可由種子重算) ----
    const KEY = 'rimtown_gen_towns';
    const WK = (k) => (typeof rimtownWorldKey === 'function' ? rimtownWorldKey(k) : k); // v6.75.0 每個世界各有一本登記簿
    function _load() { try { const o = JSON.parse(localStorage.getItem(WK(KEY)) || 'null'); if (o && Array.isArray(o.list)) return o; } catch (e) {} return { v: 1, base: null, list: [], n: 0, since: 0, seenExp: 0 }; }
    function _save(o) { try { localStorage.setItem(WK(KEY), JSON.stringify(o)); } catch (e) {} }
    function registry() { return _load(); }
    function cards() { const o = _load(); return o.list.map(e => { const c = bySeed(e.seed); c.found = e.found; c.via = e.via; c.by = e.by; c.reachable = !!e.r; c.townId = e.id || null; c.state = e.st || null; return c; }); }
    function liveCount(app) {
        let n = 1; try { for (const d of (typeof NEIGHBOR_TOWNS !== 'undefined' ? NEIGHBOR_TOWNS : [])) if (localStorage.getItem(WK(d.key)) === '1') n++; } catch (e) {}
        return n + _load().list.filter(e => e.r).length;
    }
    // 發現一個新鎮:種子由玩家(帳號)＋序號決定,換裝置也算得出同一串;太像既有鎮或撞名就換下一個種子
    function discover(playerKey, opts = {}) {
        const o = _load(); if (o.list.length >= TOWNGEN_MAX_CARDS) return null;
        if (!o.base) o.base = String(playerKey || 'guest');
        const existing = o.list.map(e => card(e.seed));
        const taken = new Set(['邊境鎮', '海風鎮', '礦山鎮', '林間村', '市集城', ...existing.map(c => c.name), ...(opts.names || [])]);
        let pick = null;
        for (let attempt = 0; attempt < 40 && !pick; attempt++) {
            const seed = hash(o.base + ':' + o.n + ':' + attempt) || 1;
            const c = card(seed);
            if (taken.has(c.name)) continue;
            if (attempt < 30 && existing.some(x => similar(x, c))) continue;
            pick = c;
        }
        o.n++;
        if (!pick) { _save(o); return null; }
        const reachable = liveCount() < TOWNGEN_MAX_LIVE;
        o.list.push({ seed: pick.seed, found: opts.day || 0, via: opts.via || 'rumor', by: opts.by || '', r: reachable ? 1 : 0, id: null, st: null });
        o.since = 0;
        _save(o);
        register(pick); pick.reachable = reachable; pick.via = opts.via || 'rumor'; pick.by = opts.by || '';
        return pick;
    }
    function update(seed, patch) { const o = _load(); const e = o.list.find(x => x.seed === seed); if (!e) return; Object.assign(e, patch); _save(o); }
    function setState(seed, st) { update(seed, { st }); }
    function bump(field, v) { const o = _load(); o[field] = v; _save(o); }
    // 跨裝置:存檔裡帶一份精簡登記簿,讀檔時合併(取較多的那份,同種子保留有存檔 id 的)
    function exportCompact() { const o = _load(); return { base: o.base, n: o.n, list: o.list.map(e => ({ seed: e.seed, found: e.found, via: e.via, by: e.by, r: e.r, id: e.id })) }; }
    function mergeCompact(x) {
        if (!x || !Array.isArray(x.list)) return; const o = _load(); let changed = false;
        if (!o.base && x.base) { o.base = x.base; changed = true; }
        if ((x.n || 0) > (o.n || 0)) { o.n = x.n; changed = true; }
        for (const e of x.list) { const mine = o.list.find(y => y.seed === e.seed); if (!mine) { if (o.list.length < TOWNGEN_MAX_CARDS) { o.list.push({ ...e, st: null }); changed = true; } } else if (!mine.id && e.id) { mine.id = e.id; mine.r = 1; changed = true; } }
        if (_capLive(o)) changed = true;
        if (changed) _save(o);
    }
    // v6.48.1 兩台裝置各自開通的路線合併後可能超過 10 座:超過的先降回「只有傳聞」(已經有存檔的鎮不降,後發現的先降)
    function _capLive(o) {
        let fixed = 1; try { for (const d of (typeof NEIGHBOR_TOWNS !== 'undefined' ? NEIGHBOR_TOWNS : [])) if (localStorage.getItem(WK(d.key)) === '1') fixed++; } catch (e) {}
        let live = fixed + o.list.filter(e => e.r).length; let changed = false;
        for (const e of o.list.slice().sort((a, b) => (b.found || 0) - (a.found || 0))) { if (live <= TOWNGEN_MAX_LIVE) break; if (e.r && !e.id) { e.r = 0; live--; changed = true; } }
        return changed;
    }
    function normalize() { const o = _load(); if (_capLive(o)) _save(o); }
    function registerAll() { try { for (const e of _load().list) bySeed(e.seed); } catch (e) {} }

    return { normalize, card, bySeed, register, applyToWorld, cultureLine, blurb, tags, displayName, drift, discover, registry, cards, liveCount, update, setState, bump, exportCompact, mergeCompact, registerAll, similar, hash, L, TRAITS, TEMPERS };
})();
if (typeof globalThis !== 'undefined') globalThis.TownGen = TownGen;
try { TownGen.registerAll(); TownGen.normalize(); } catch (e) {}
