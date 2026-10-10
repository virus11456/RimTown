// RimTown - sim-town.js：從 simulation.js 拆出的 地點與城鎮主題、跨鎮親緣、TownMap、事件池與 EventSystem、選舉 ElectionSystem（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。
// --- Town Map ---
const CORE_LOCATIONS = [
    ['town_square',[t('城鎮廣場'),t('中央廣場'),t('市集廣場'),t('村莊綠地')],t('聚落的核心'),'social',[15,25]],
    ['tavern',[t('鏽鶴酒館'),t('龍憩客棧'),t('金壺酒館'),t('月光酒館'),t('旅人之家')],t('飲食與社交'),'social',[10,18]],
    ['town_hall',[t('鎮公所'),t('議事廳'),t('鎮長辦公室'),t('長老會所')],t('小鎮的治理中心'),'work',[5,10]],
];
const WORK_LOCATIONS = [
    ['farm',[t('晴陽農場'),t('綠畝田園'),t('秋月農莊')],t('肥沃的農田'),'work',[4,8]],
    ['quarry',[t('深岩礦場'),t('鐵嶺礦坑'),t('石匠坑')],t('豐富的礦藏'),'work',[4,8]],
    ['workshop',[t('工匠工坊'),t('鍛造與砧'),t('修補工房')],t('製造商品之處'),'work',[5,10]],
    ['general_store',[t('雜貨店'),t('交易站'),t('商人角落')],t('交易與補給'),'work',[4,8]],
    ['clinic',[t('鎮醫院'),t('治療小屋'),t('藥房')],t('醫療照護'),'work',[3,6]],
    ['library',[t('古老圖書館'),t('學者典藏'),t('書塔')],t('知識與研究'),'work',[4,8]],
    ['guardpost',[t('守衛哨站'),t('瞭望塔'),t('民兵營房')],t('守護小鎮'),'work',[3,5]],
];
const SOCIAL_LOCATIONS = [
    ['chapel',[t('光明教堂'),t('石造神殿'),t('和諧聖壇')],t('平靜與沉思'),'social',[8,15]],
    ['park',[t('鎮公園'),t('花園'),t('日光草地')],t('寧靜的綠地'),'social',[10,18]],
    ['well',[t('鎮井'),t('泉水噴泉'),t('水車坊')],t('清澈的水源'),'social',[3,6]],
];
const RESIDENTIAL_LOCATIONS = [
    ['residential_north',[t('北區'),t('山丘住宅'),t('上城區')],t('住宅區'),'residential',[8,12]],
    ['residential_south',[t('南區'),t('河畔住宅'),t('下城區')],t('住宅區'),'residential',[8,12]],
    ['residential_east',[t('東區'),t('朝陽住宅'),t('花園區')],t('住宅區'),'residential',[8,12]],
];
const NATURE_LOCATIONS = [
    ['forest',[t('低語林'),t('幽暗松林'),t('長老樹林')],t('茂密的森林'),'nature',[6,10]],
    ['river',[t('水晶河'),t('銀溪'),t('急流溪')],t('平靜的河流'),'nature',[4,8]],
    ['hill',[t('瞭望丘'),t('風嘯嶺'),t('鷹巢峰')],t('高地'),'nature',[3,6]],
    ['cave',[t('暗影洞穴'),t('迴音岩洞'),t('舊礦坑')],t('神秘的洞穴'),'nature',[2,5]],
    ['lake',[t('鏡湖'),t('蓮花池'),t('深潭')],t('靜水'),'nature',[4,7]],
    ['meadow',[t('野花草原'),t('起伏田野'),t('三葉草坪')],t('開闊的草原'),'nature',[5,10]],
];
const TERRAIN_TYPES = [
    {name:'plains',nature_bonus:['meadow','river'],nature_remove:['cave']},
    {name:'forest',nature_bonus:['forest','cave'],nature_remove:['meadow']},
    {name:'mountain',nature_bonus:['cave','hill'],nature_remove:['lake']},
    {name:'riverside',nature_bonus:['river','lake'],nature_remove:['cave']},
    {name:'coastal',nature_bonus:['lake','hill'],nature_remove:['forest']},
];

// v5.55.0 主題城鎮:每個主題有自己的地點皮膚、開局物資性格與專屬名冊
// frontier = 邊境鎮(現況,一切照舊);harbor = 海風鎮(漁村:討海文化、鹽場、燈塔)
const TOWN_THEMES = {
    frontier: { key: 'frontier', townName: '邊境鎮', exports: ['food', 'wood'], imports: ['stone', 'metal'] },
    harbor: {
        key: 'harbor',
        townName: '海風鎮',
        terrain: 'coastal',
        exports: ['food', 'cloth'], imports: ['wood', 'herbs'], // v5.80.0 跨鎮商隊:賣漁獲帆布、買木材草藥
        locationNames: {
            town_hall: t('港務所'), tavern: t('海味居'), clinic: t('海風診療所'), workshop: t('修船工房'),
            farm: t('蚵田菜畦'), quarry: t('鹽場'), general_store: t('南北雜貨行'), library: t('燈塔書房'),
            guardpost: t('望潮哨'), chapel: t('海神小廟'), park: t('曬網場'), well: t('淡水井'),
            town_square: t('碼頭廣場'),
            residential_north: t('崖上人家'), residential_south: t('沙灘木屋'), residential_east: t('漁港街'),
            forest: t('防風林'), river: t('外海碼頭'), hill: t('燈塔崖'), meadow: t('鹽灘'), cave: t('海蝕洞'), lake: t('潟湖'),
        },
        // 漁獲豐、帆布多;無林缺木、草藥少——與邊境鎮天然互補,為跨鎮貿易鋪路
        stockpile: { food: 320, cloth: 90, wood: 45, herbs: 10 },
    },
    // v5.76.0 礦山鎮:山壁下的礦業小鎮——礦坑、熔爐、吊橋、山泉;石材金屬多、食物布料缺
    mountain: {
        key: 'mountain',
        townName: '礦山鎮',
        terrain: 'mountain',
        exports: ['stone', 'metal'], imports: ['food', 'cloth'],
        unlockProsperity: 40,
        locationNames: {
            town_hall: '礦務所', tavern: '礦燈酒館', clinic: '坑口醫站', workshop: '熔爐鍛坊',
            farm: '山腰梯田', quarry: '主礦坑', general_store: '礦山雜貨', library: '礦圖室',
            guardpost: '坑道哨', chapel: '山神祠', park: '山泉浴場', well: '山泉井',
            town_square: '礦車廣場',
            residential_north: '山腰宿舍', residential_south: '礦工村', residential_east: '工頭街',
            forest: '針葉林', river: '冰溪', hill: '鷹嘴峰', meadow: '高山草甸', cave: '廢礦坑', lake: '礦湖',
        },
        stockpile: { stone: 320, metal: 140, food: 60, cloth: 15, wood: 60, herbs: 8 },
    },
    // v5.77.0 林間村:密林裡的獵戶與樵夫村——古樹祭壇、篝火場、伐木場、藥草小屋;木材草藥多、石材金屬缺
    forest: {
        key: 'forest',
        townName: '林間村',
        terrain: 'forest',
        exports: ['wood', 'herbs'], imports: ['stone', 'metal'],
        unlockProsperity: 60,
        locationNames: {
            town_hall: '村長木屋', tavern: '松脂酒館', clinic: '藥草小屋', workshop: '木工坊',
            farm: '林間菜園', quarry: '伐木場', general_store: '獵戶雜貨', library: '林語書屋',
            guardpost: '守林哨塔', chapel: '古樹祭壇', park: '林中空地', well: '苔泉',
            town_square: '篝火場',
            residential_north: '樹冠木屋', residential_south: '獵人小屋', residential_east: '伐木工寮',
            forest: '千年古林', river: '清溪', hill: '鹿角丘', meadow: '蕨原', cave: '熊洞', lake: '鏡池',
        },
        stockpile: { wood: 340, herbs: 120, food: 150, stone: 20, metal: 10, cloth: 30 },
    },
    // v5.78.0 市集城:平原交通樞紐——城牆城門、大市集廣場、商會、書院、商隊營地;銀幣布料多、原料缺,跨鎮貿易的中心
    market: {
        key: 'market',
        townName: '市集城',
        terrain: 'plains',
        exports: ['silver', 'cloth'], imports: ['wood', 'stone', 'food'],
        unlockProsperity: 80,
        locationNames: {
            town_hall: '商會大樓', tavern: '金馬車客棧', clinic: '杏林藥堂', workshop: '百工坊',
            farm: '城郊農莊', quarry: '磚窯', general_store: '大市集', library: '書院',
            guardpost: '城門衛所', chapel: '財神廟', park: '噴泉花園', well: '大噴泉',
            town_square: '大市集廣場',
            residential_north: '商賈宅邸', residential_south: '工匠巷', residential_east: '商隊客棧街',
            forest: '城郊小林', river: '運河', hill: '城外高地', meadow: '牧場草地', cave: '舊地窖', lake: '荷塘',
        },
        stockpile: { silver: 600, cloth: 150, tools: 40, food: 120, wood: 40, stone: 40, metal: 30, herbs: 30 },
    },
};

// v5.80.0 鎮名 → 主題(舊檔可能把鎮名存成英文,一併認得)
const TOWN_NAME_THEME = [
    ['harbor', /海風鎮|Seabreeze/i], ['mountain', /礦山鎮|Mine Ridge/i], ['forest', /林間村|Greenwood/i],
    ['market', /市集城|Market City/i], ['frontier', /邊境鎮|Frontier Town/i],
];
function themeKeyOfTownName(name) {
    const n = String(name || '');
    const hit = TOWN_NAME_THEME.find(([, re]) => re.test(n));
    return hit ? hit[0] : null;
}

// v5.58.0 跨鎮親緣網:兩鎮從第一天就織在同一張關係網裡,只是沿海道路還沒通
// 邊境鎮居民會想起海那頭的親友,海風鎮的人也記掛著這頭——世界觀在通車前就開始呼吸
const CROSS_TOWN_TIES = {
    // 邊境鎮 → 海風鎮
    wang_li:   { other: '海嬤', thoughts: [t('姑婆又從海風鎮寄魚乾來了，她醃的魚誰都比不上。'), t('我這手醃魚的功夫，是海風鎮的姑婆海嬤教的。')] },
    wu_da:     { other: '石叔', thoughts: [t('老石那傢伙去海邊曬鹽也二十年了，礦上的日子他還記得嗎。'), t('當年跟老石同一條坑道，現在一個挖礦一個曬鹽。')] },
    zhao_xia:  { other: '浪叔', thoughts: [t('浪叔的船這批貨怎麼還沒到，別又在哪個港口喝茫了。'), t('我店裡的異國貨，一半是海風鎮浪叔的船捎回來的。')] },
    zhou_ming: { other: '小鷗', thoughts: [t('在海味居駐唱那陣子，掌杓姑娘的海鮮麵配我的歌，絕了。'), t('那首關於海的歌，是在海風鎮寫的。')] },
    sun_yu:    { other: '燈爺', thoughts: [t('燈爺的信裡說，航海日誌裡有段記載跟遺跡對得上…'), t('海風鎮的燈爺是我通信多年的筆友，他懂的比書還多。')] },
    lin_mei:   { other: '阿汐', thoughts: [t('同期的阿汐在海風鎮當醫師，海女出身的她潛得比誰都深。'), t('好想跟阿汐當面討論那個病例，可惜路還封著，只能寫信。')] },
    // 海風鎮 → 邊境鎮
    hb_haima:  { other: '王麗', thoughts: [t('邊境鎮的姪孫女王麗，醃魚的手藝是我教的，不知道長進了沒。')] },
    hb_shishu: { other: '吳達', thoughts: [t('礦上的老吳還在挖嗎…當年說好老了一起釣魚的。')] },
    hb_langshu:{ other: '趙霞', thoughts: [t('邊境鎮的趙老闆娘又下了一批訂單，這趟得跑快點。')] },
    hb_xiaoou: { other: '周明', thoughts: [t('那個彈吉他的流浪商人，唱的那首海歌我現在還會哼。')] },
    hb_dengye: { other: '孫雨', thoughts: [t('邊境鎮那位孫姑娘的信又到了，她問的遺跡我日誌裡正好有記載。')] },
    hb_axi:    { other: '林美', thoughts: [t('同期的林美在邊境鎮行醫，她的信裡總夾著新藥方。')] },
    // v5.76.0 礦山鎮 ↔ 邊境鎮／海風鎮
    mt_laochui: { other: '吳達', thoughts: [t('邊境鎮的吳達當年跟我同一條坑道，他的腰現在還好嗎。'), t('塌方那天要不是吳達拉我一把，我早埋在第三層了。')] },
    mt_aqing:   { other: '趙霞', thoughts: [t('邊境鎮趙老闆娘的訂單又來了，礦石換布料，這條線我跑了五年。')] },
    mt_baigu:   { other: '林美', thoughts: [t('邊境鎮的林醫師回信了，她說願意幫忙看那些塵肺的病例。')] },
    mt_kuangye: { other: '海伯', thoughts: [t('海風鎮那個老船長海伯，年輕時我們在同一家礦業公司跑過貨，現在一個管港一個管坑。')] },
    mt_ayan:    { other: '珊珊', thoughts: [t('海風鎮研究潮汐的珊珊是我書信往來的同行，她的洋流圖和我的礦脈圖竟然對得上。')] },
    zhang_hao:  { other: '鐵柱', thoughts: [t('礦山鎮的鐵柱打的鎬頭最耐用，下次商隊來一定要買一把。')] },
    ma_qiang:   { other: '牛叔', thoughts: [t('礦山鎮那個工頭牛叔，當年跟我在同一支護衛隊，脾氣一樣臭。')] },
    // v5.77.0 林間村 ↔ 邊境鎮／海風鎮
    fv_linlao:  { other: '海嬤', thoughts: [t('海風鎮的海嬤，年輕時我們一起在邊境鎮的市集賣過草藥和魚乾，她的信每年春天都到。')] },
    fv_ahu:     { other: '趙霞', thoughts: [t('邊境鎮趙老闆娘又來要皮毛了，這批貂皮她肯出多少，得好好談。')] },
    fv_mushu:   { other: '木蝦', thoughts: [t('海風鎮那個船木匠木蝦，當年是我這裡學的徒，手藝不錯就是懶。')] },
    fv_aye:     { other: '林美', thoughts: [t('邊境鎮的林醫師寫信問我林子裡的止血草，我寄了一包過去。')] },
    fv_daxiong: { other: '楊鋒', thoughts: [t('邊境鎮的楊鋒上回進林子打獵，差點被我當成熊射了。')] },
    he_chang:   { other: '阿狐', thoughts: [t('林間村那個賣皮毛的阿狐，嘴甜得很，但他的皮毛確實好。')] },
    ling_bo:    { other: '阿苔', thoughts: [t('林間村的阿苔寄來她畫的蘑菇圖譜，夜裡觀星之餘翻一翻，倒也有趣。')] },
    // v5.78.0 市集城 ↔ 四鎮
    mk_tuojie:  { other: '浪叔', thoughts: [t('海風鎮浪叔的船貨這批又晚了，他的船到底是跑貨還是跑酒館。'), t('跑了五個鎮，還是邊境鎮的路最難走。')] },
    mk_jinlaoye:{ other: '礦爺', thoughts: [t('礦山鎮那個礦爺又來信壓價，石材金屬他有，但銀子在我手上。')] },
    mk_feishu:  { other: '周明', thoughts: [t('那個彈吉他的周明上回在我店裡唱了一整夜，酒錢到現在還欠著。')] },
    mk_xinggu:  { other: '白姑', thoughts: [t('礦山鎮的白醫師信裡說塵肺的事，市集城也該有間像樣的醫館了。')] },
    mk_caigu:   { other: '秀姑', thoughts: [t('海風鎮的秀姑補帆的針法跟我做戲服的是同一路，她的信裡總夾著一小塊布。')] },
    chen_wei:   { other: '金老爺', thoughts: [t('市集城那個金會長排場大得很，不過他的商會確實把五個鎮的貨都接起來了。')] },
    liu_jun:    { other: '門叔', thoughts: [t('市集城城門那個門叔，盤問起商隊來比我還兇。')] },
};

class TownMap {
    constructor(seed = null) {
        this.locations = {};
        this.width = 800; this.height = 600;
        this.seed = seed ?? Math.floor(Math.random()*999999);
        this.terrain = 'plains';
    }
    addLocation(loc) { this.locations[loc.id] = loc; }
    toDict() {
        const locs = {};
        for (const [id, loc] of Object.entries(this.locations)) locs[id] = loc;
        return { width:this.width, height:this.height, seed:this.seed, terrain:this.terrain, locations:locs };
    }
}

function generateRandomTown(seed = null, themeKey = 'frontier') {
    const rng = new SeededRandom(seed);
    const town = new TownMap(seed ?? rng.nextInt(0, 999999));
    const theme = TOWN_THEMES[themeKey] || TOWN_THEMES.frontier;
    // v5.55.0 主題地形:海風鎮固定海岸地形
    const terrain = theme.terrain
        ? (TERRAIN_TYPES.find(tt => tt.name === theme.terrain) || TERRAIN_TYPES[rng.nextInt(0, TERRAIN_TYPES.length-1)])
        : TERRAIN_TYPES[rng.nextInt(0, TERRAIN_TYPES.length-1)];
    town.terrain = terrain.name;
    const allLocs = [];
    const makeLoc = ([id, names, desc, cat, capRange]) => ({
        id, name: theme.locationNames?.[id] || names[rng.nextInt(0,names.length-1)], description: desc,
        x:0, y:0, category: cat, capacity: rng.nextInt(capRange[0], capRange[1]),
    });

    CORE_LOCATIONS.forEach(l => allLocs.push(makeLoc(l)));
    const workPool = shuffle(WORK_LOCATIONS, rng);
    workPool.slice(0, rng.nextInt(4, Math.min(6, workPool.length))).forEach(l => allLocs.push(makeLoc(l)));
    const socPool = shuffle(SOCIAL_LOCATIONS, rng);
    socPool.slice(0, rng.nextInt(2, Math.min(3, socPool.length))).forEach(l => allLocs.push(makeLoc(l)));
    RESIDENTIAL_LOCATIONS.forEach(l => allLocs.push(makeLoc(l)));

    let naturePool = [...NATURE_LOCATIONS];
    const removeIds = new Set(terrain.nature_remove || []);
    naturePool = naturePool.filter(n => !removeIds.has(n[0]));
    naturePool = shuffle(naturePool, rng);
    const seen = new Set(); const uniqNature = [];
    naturePool.forEach(n => { if(!seen.has(n[0])){seen.add(n[0]);uniqNature.push(n);} });
    uniqNature.slice(0, rng.nextInt(2, Math.min(4, uniqNature.length))).forEach(l => allLocs.push(makeLoc(l)));

    placeLocations(allLocs, town.width, town.height, rng);
    allLocs.forEach(l => town.addLocation(l));
    return town;
}

function placeLocations(locations, width, height, rng) {
    const cx = width/2, cy = height/2, margin = 60;
    locations.forEach(loc => {
        if (loc.category === 'social') { loc.x = rng.nextInt(cx-150,cx+150); loc.y = rng.nextInt(cy-100,cy+100); }
        else if (loc.category === 'work') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(80,250); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
        else if (loc.category === 'residential') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(120,220); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
        else if (loc.category === 'nature') { const a=rng.nextFloat()*Math.PI*2, d=rng.nextInt(200,350); loc.x=Math.floor(cx+Math.cos(a)*d); loc.y=Math.floor(cy+Math.sin(a)*d); }
    });
    for (let iter=0;iter<50;iter++) {
        for (let i=0;i<locations.length;i++) {
            for (let j=i+1;j<locations.length;j++) {
                const a=locations[i], b=locations[j];
                const dx=b.x-a.x, dy=b.y-a.y;
                const dist = Math.max(1, Math.sqrt(dx*dx+dy*dy));
                if (dist < 90) {
                    const force=(90-dist)/2, nx=dx/dist, ny=dy/dist;
                    a.x-=Math.floor(nx*force); a.y-=Math.floor(ny*force);
                    b.x+=Math.floor(nx*force); b.y+=Math.floor(ny*force);
                }
            }
        }
    }
    locations.forEach(l => { l.x=Math.max(margin,Math.min(width-margin,l.x)); l.y=Math.max(margin,Math.min(height-margin,l.y)); });
}

// --- Event System (raids, chains, travel, immigration) ---
const EVENT_CHAINS = {
    drought_famine_riot: [
        {name:t('乾旱'),description:t('水井乾涸，作物枯萎。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('可怕的乾旱')},seasons:['夏季'],duration_days:3},
        {name:t('饑荒'),description:t('糧食供應嚴重不足。'),severity:'major',effects:{mood_all:-15,conversation_topic:t('惡化的饑荒')},delay_days:3,duration_days:4},
        {name:t('暴動'),description:t('絕望的居民為了物資大打出手！'),severity:'major',effects:{mood_all:-20,conversation_topic:t('暴動')},delay_days:4,duration_days:2},
    ],
    plague_quarantine_recovery: [
        {name:t('神秘疾病'),description:t('多名居民出現奇怪的病症。'),severity:'moderate',effects:{mood_all:-10,conversation_topic:t('神秘疾病')},duration_days:2},
        {name:t('隔離'),description:t('醫生下令進行隔離。'),severity:'major',effects:{mood_all:-15,conversation_topic:t('隔離措施')},delay_days:2,duration_days:3},
        {name:t('康復'),description:t('疾病已經過去！大家一起慶祝。'),severity:'minor',effects:{mood_all:15,conversation_topic:t('康復')},delay_days:3,duration_days:1},
    ],
    storm_damage_rebuild: [
        {name:t('大風暴'),description:t('可怕的風暴正在侵襲小鎮！'),severity:'major',effects:{mood_all:-12,conversation_topic:t('毀滅性的風暴')},seasons:['秋季','冬季'],duration_days:1},
        {name:t('風暴損害'),description:t('風暴造成了嚴重的損壞。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('風暴損害')},delay_days:1,duration_days:3},
        {name:t('社區重建'),description:t('大家齊心協力重建。'),severity:'minor',effects:{mood_all:10,conversation_topic:t('重建工作')},delay_days:3,duration_days:2},
    ],
};
const RAID_POOL = [
    {name:t('盜匪來襲'),description:t('一群盜匪正在逼近！'),severity:'major',threat_level:3,attacker:t('盜匪'),effects:{mood_all:-15,conversation_topic:t('盜匪襲擊')}},
    {name:t('野獸攻擊'),description:t('一群狼從山上下來了！'),severity:'moderate',threat_level:2,attacker:t('狼群'),effects:{mood_all:-10,conversation_topic:t('狼群攻擊')}},
    {name:t('掠奪者入侵'),description:t('武裝掠奪者正在襲擊！'),severity:'major',threat_level:4,attacker:t('掠奪者'),effects:{mood_all:-18,conversation_topic:t('掠奪者')}},
    {name:t('野豬暴走'),description:t('暴怒的野豬衝進鎮上！'),severity:'moderate',threat_level:2,attacker:t('野豬'),effects:{mood_all:-8,conversation_topic:t('野豬暴走')}},
];
const EVENT_POOL = [
    {name:t('豐收'),description:t('作物長得特別好！'),severity:'minor',effects:{mood_all:5},seasons:['春季','夏季']},
    {name:t('寒流'),description:t('突如其來的寒流襲擊小鎮。'),severity:'moderate',effects:{mood_all:-10},seasons:['冬季','秋季']},
    {name:t('慶典日'),description:t('小鎮舉辦慶典！大家一起慶祝。'),severity:'minor',effects:{mood_all:15}},
    {name:t('物資短缺'),description:t('貿易路線中斷，物資不足。'),severity:'moderate',effects:{mood_all:-5}},
    {name:t('奇異光芒'),description:t('天空出現奇怪的光。'),severity:'minor',effects:{mood_all:-3,conversation_topic:t('奇異光芒')}},
    {name:t('旅行商人'),description:t('一位商人帶著稀有貨物到來。'),severity:'minor',effects:{mood_all:5,conversation_topic:t('商人的異國貨品')}},
    {name:t('美麗極光'),description:t('壯麗的極光照亮夜空。'),severity:'minor',effects:{mood_all:10},seasons:['冬季']},
    {name:t('熱浪'),description:t('酷熱讓戶外工作難以忍受。'),severity:'moderate',effects:{mood_all:-8},seasons:['夏季']},
    {name:t('幸運發現'),description:t('有人發現了珍貴的材料！'),severity:'minor',effects:{mood_all:8,conversation_topic:t('幸運的發現')}},
    {name:t('觀星之夜'),description:t('今晚的星空特別清澈，許多居民出門看星星。'),severity:'minor',effects:{mood_all:8,conversation_topic:t('美麗的星空')},night_event:true},
    {name:t('月蝕'),description:t('罕見的月蝕！月亮變成了血紅色。'),severity:'minor',effects:{mood_all:-3,conversation_topic:t('血色月蝕')},night_event:true},
    {name:t('螢火蟲之夜'),description:t('成千上萬的螢火蟲在鎮上飛舞！'),severity:'minor',effects:{mood_all:12,conversation_topic:t('螢火蟲奇觀')},seasons:['夏季','春季'],night_event:true},
    {name:t('夜間竊盜'),description:t('有人趁夜偷走了倉庫的物資。'),severity:'moderate',effects:{mood_all:-8,conversation_topic:t('神秘竊賊')},night_event:true},
    {name:t('極光出現'),description:t('天空中出現了壯麗的極光！'),severity:'minor',effects:{mood_all:15,conversation_topic:t('不可思議的極光')},seasons:['冬季','秋季'],night_event:true},
    {name:t('夜半歌聲'),description:t('深夜從森林傳來神秘的歌聲。'),severity:'minor',effects:{mood_all:-2,conversation_topic:t('森林裡的歌聲')},night_event:true},
];
const DEPARTURE_REASONS = [
    t('決定出發去進行貿易遠征'),t('離開去城裡探望家人'),t('踏上朝聖之旅'),
    t('出發去探索荒野'),t('離開去遠方的學院進修'),
    t('前往首都尋求發展'),t('出門旅行增廣見聞'),
];
const IMMIGRANT_POOL = [
    {name:'周明',age:27,gender:'male',traits:['hardworking','optimist'],job:'farmer',background:'來自鄰村的開朗年輕農夫。'},
    {name:'李雪',age:31,gender:'female',traits:['kind','perfectionist'],job:'tailor',background:'聽說邊境鎮需要她的手藝的熟練裁縫。'},
    {name:'鄭強',age:35,gender:'male',traits:['stoic','hardworking'],job:'miner',background:'來自本地區的資深礦工。'},
    {name:'何芳',age:24,gender:'female',traits:['charismatic','romantic'],job:'cook',background:'懷抱遠大夢想的熱情廚師。'},
    {name:'蔡文',age:42,gender:'male',traits:['creative','neurotic'],job:'researcher',background:'被古代遺跡吸引而來的古怪學者。'},
    {name:'呂嵐',age:29,gender:'female',traits:['shy','early_bird'],job:'carpenter',background:'讓手藝說話的沉靜木匠。'},
    {name:'丁傑',age:38,gender:'male',traits:['abrasive','hardworking'],job:'blacksmith',background:'言語粗獷但手藝精湛的鐵匠。'},
    {name:'蕭瑜',age:23,gender:'female',traits:['optimist','gossip'],job:'trader',background:'善於議價的年輕商人。'},
    {name:'唐琳',age:33,gender:'female',traits:['kind','night_owl'],job:'doctor',background:'四處行醫的慈悲醫者。'},
    {name:'曹峰',age:44,gender:'male',traits:['stoic','pessimist'],job:'guard',background:'尋求平靜生活的資深戰士。'},
    {name:'邱雅',age:21,gender:'female',traits:['creative','shy'],job:'tailor',background:'擁有刺繡天賦的年輕工匠。'},
    {name:'范浩',age:36,gender:'male',traits:['lazy','charismatic'],job:'priest',background:'悠哉的精神導師。'},
];

class EventSystem {
    constructor() {
        this.eventLog = []; this.activeEffects = {}; this.conversationTopics = [];
        this._activeChains = []; this._travellingAgents = [];
        this._daysSinceRaid = 5; this._daysSinceChain = 5; this._daysSinceDeparture = 3;
        this._usedImmigrantNames = new Set();
        this.TARGET_POPULATION = 12;
    }
    dailyUpdate(world) {
        this._daysSinceRaid++; this._daysSinceChain++; this._daysSinceDeparture++;
        this._progressChains(world);
        this._checkReturningTravellers(world);
        const event = this._rollDailyEvent(world);
        this._managePopulation(world);
        return event;
    }
    _rollDailyEvent(world) {
        const roll = Math.random();
        // News modifiers affect event probabilities
        const nm = world.news ? world.news : {getModifier:(k,d)=>d};
        // 聲望事件護盾:高聲望降低負面事件(襲擊/事件鏈)機率
        const eventShield = world.reputationSystem ? world.reputationSystem.getModifier('event_shield') : 0;
        const raidChance = Math.max(0, Math.min(0.5, (0.10 + nm.getModifier('raid_chance', 0)) * (1 - eventShield) * (world.harborFlags?.watchtower ? 0.7 : 1))); // v5.93.0 守望塔 −30%
        const chainChance = Math.max(0, Math.min(0.4, (0.08 + nm.getModifier('chain_chance', 0)) * (1 - eventShield)));
        const festivalBoost = nm.getModifier('festival_chance', 0);
        const departureBoost = nm.getModifier('departure_chance', 0);

        if (roll < raidChance && this._daysSinceRaid >= 5) return this._triggerRaid(world);
        if (roll < raidChance + chainChance && this._daysSinceChain >= 7 && !this._activeChains.length) return this._startEventChain(world);
        if (roll < 0.38 + festivalBoost) return this._triggerRandomEvent(world);
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        if (roll < 0.43 + departureBoost && this._daysSinceDeparture >= 4 && npcCount > this.TARGET_POPULATION) this._triggerDeparture(world);
        return null;
    }
    _triggerRandomEvent(world) {
        const season = world.clock.season;
        let eligible = EVENT_POOL.filter(e => !e.seasons || e.seasons.includes(season));
        if (!eligible.length) return null;
        // News can boost festival/specific events
        const nm = world.news ? world.news : {getModifier:(k,d)=>d};
        const festivalBoost = nm.getModifier('festival_chance', 0);
        if (festivalBoost > 0.2) {
            const festival = eligible.find(e => e.name === t('慶典日'));
            if (festival && Math.random() < festivalBoost) {
                const event = {name:festival.name,description:festival.description,severity:festival.severity,effects:festival.effects||{},event_type:'random'};
                this.eventLog.push([world.clock.timeStr, event]);
                this._applyEffects(event, world);
                return event;
            }
        }
        // Drought/storm boost from news
        const droughtChance = nm.getModifier('drought_chance', 0);
        if (droughtChance > 0 && Math.random() < droughtChance && !this._activeChains.length) {
            return this._startEventChain(world, 'drought_famine_riot');
        }
        const stormChance = nm.getModifier('storm_chance', 0);
        if (stormChance > 0 && Math.random() < stormChance && !this._activeChains.length) {
            return this._startEventChain(world, 'storm_damage_rebuild');
        }
        const plagueChance = nm.getModifier('plague_chance', 0);
        if (plagueChance > 0 && Math.random() < plagueChance && !this._activeChains.length) {
            return this._startEventChain(world, 'plague_quarantine_recovery');
        }
        const ed = pickRandom(eligible);
        const event = {name:ed.name,description:ed.description,severity:ed.severity,effects:ed.effects||{},event_type:'random'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        return event;
    }
    _triggerRaid(world) {
        this._daysSinceRaid = 0;
        const rd = pickRandom(RAID_POOL);
        const event = {name:rd.name,description:rd.description,severity:rd.severity,effects:rd.effects||{},event_type:'raid'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        const guards = Object.values(world.agents).filter(a => a.job?.key==='guard' && !a.isPlayer);
        const buildingDefense = world.buildings ? (world.buildings.getEffect('defense_bonus',0)||0) : 0;
        const defense = guards.length * 2 + randInt(1,3) + buildingDefense;
        if (defense >= rd.threat_level) {
            world.logMessage('raid', `${t('小鎮成功抵禦了')}${rd.attacker}${t('！')}`);
            if (world.questSystem) world.questSystem.onRaidSurvived();
            guards.forEach(g => { g.moodModifier = (g.moodModifier || 0) + 10; g.memory.add(world.tickCount, world.clock.timeStr,'raid',`${t('協助抵禦了')}${rd.attacker}${t('！')}`,8); });
        } else {
            world.logMessage('raid', `${rd.attacker}${t('突破了我們的防線！')}`);
            if (world.stockpile) {
                const stolenFood = Math.min(world.stockpile.get('food'), randInt(10,30));
                const stolenSilver = Math.min(world.stockpile.get('silver'), randInt(5,20));
                if(stolenFood>0) world.stockpile.consume('food',stolenFood,world.tickCount,`${t('被')}${rd.attacker}${t('搶走')}`);
                if(stolenSilver>0) world.stockpile.consume('silver',stolenSilver,world.tickCount,`${t('被')}${rd.attacker}${t('搶走')}`);
                world.logMessage('raid',`${rd.attacker}${t('搶走了')}${stolenFood}${t('食物和')}${stolenSilver}${t('銀幣！')}`);
            }
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.job?.key !== 'guard');
            if (npcs.length && Math.random() < 0.4) {
                const fleeing = pickRandom(npcs);
                this._sendAgentTravelling(world, fleeing, `${t('在')}${rd.attacker}${t('襲擊後逃離')}`, 3);
            }
        }
        return event;
    }
    _startEventChain(world, forceChainId = null) {
        let chainId, stages;
        if (forceChainId && EVENT_CHAINS[forceChainId]) {
            chainId = forceChainId; stages = EVENT_CHAINS[forceChainId];
        } else {
            const season = world.clock.season;
            const eligible = Object.entries(EVENT_CHAINS).filter(([,s]) => {
                const first = s[0]; return !first.seasons || first.seasons.includes(season);
            });
            if (!eligible.length) return null;
            [chainId, stages] = pickRandom(eligible);
        }
        this._daysSinceChain = 0;
        this._activeChains.push({chainId, stage:0, daysUntilNext: stages[0].duration_days||2});
        const first = stages[0];
        const event = {name:first.name,description:first.description,severity:first.severity,effects:first.effects||{},event_type:'chain'};
        this.eventLog.push([world.clock.timeStr, event]);
        this._applyEffects(event, world);
        world.logMessage('chain_event', `${t('事件鏈開始：')}${first.name}`);
        return event;
    }
    _progressChains(world) {
        const completed = [];
        this._activeChains.forEach(chain => {
            chain.daysUntilNext--;
            if (chain.daysUntilNext <= 0) {
                const stages = EVENT_CHAINS[chain.chainId];
                const nextIdx = chain.stage + 1;
                if (nextIdx >= stages.length) { completed.push(chain); world.logMessage('chain_event',`${t('事件鏈「')}${chain.chainId}${t('」已結束。')}`); }
                else {
                    const stage = stages[nextIdx];
                    chain.stage = nextIdx; chain.daysUntilNext = stage.duration_days || 2;
                    const event = {name:stage.name,description:stage.description,severity:stage.severity,effects:stage.effects||{},event_type:'chain'};
                    this.eventLog.push([world.clock.timeStr, event]);
                    this._applyEffects(event, world);
                    world.logMessage('chain_event', `[${event.severity.toUpperCase()}] ${event.name}${t('：')}${event.description}`);
                }
            }
        });
        completed.forEach(c => { this._activeChains = this._activeChains.filter(x=>x!==c); });
    }
    _triggerDeparture(world) {
        this._daysSinceDeparture = 0;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (!npcs.length) return;
        const traveller = pickRandom(npcs);
        this._sendAgentTravelling(world, traveller, pickRandom(DEPARTURE_REASONS), randInt(3,7));
    }
    _sendAgentTravelling(world, agent, reason, travelDays) {
        // v5.56.0 外鎮訪客不會被抽去「旅行」——他們的家在別的鎮,期滿自然返鄉
        if (agent.agentId && agent.agentId.startsWith('visit_')) return;
        const data = { agentId:agent.agentId, name:agent.name, age:agent.age, jobKey:agent.job?.key,
            traits:agent.personality.traits, values:agent.personality.values, background:agent.personality.background,
            homeLocation:agent.homeLocation, gender:agent.gender, look:agent.look||null, // v5.90.0 外觀跟著旅行
            skills:agent.skills.toDict(), relationships:agent.relationships.toDict(),
            memories:agent.memory.toDict(), mood:agent.mood, moodModifier:agent.moodModifier||0 };
        this._travellingAgents.push({agentData:data, returnTick:world.tickCount+(travelDays*96), reason});
        world.logMessage('departure', `${agent.name}${reason}。${t('過幾天就會回來。')}`, agent.name);
        const event = {name:t('居民出行'),description:`${agent.name}${reason}。`,severity:'minor',effects:{conversation_topic:`${agent.name}${t('離開了小鎮')}`},event_type:'departure'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${agent.name}${t('離開了小鎮')}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'departure',`${agent.name}${reason}。`,5,[agent.name]);
        });
        delete world.agents[agent.agentId];
    }
    _checkReturningTravellers(world) {
        const returned = this._travellingAgents.filter(t => world.tickCount >= t.returnTick);
        returned.forEach(travel => {
            this._travellingAgents = this._travellingAgents.filter(t => t !== travel);
            this._returnAgent(world, travel);
        });
    }
    _returnAgent(world, travel) {
        const d = travel.agentData;
        const personality = new Personality(d.traits, d.background || '', d.values || []);
        const job = d.jobKey ? new Job(d.jobKey) : null;
        const agent = new Agent(d.agentId, d.name, d.age, personality, job, d.homeLocation || 'residential_north');
        if (d.gender) agent.gender = d.gender;
        if (d.look && typeof d.look === 'object') agent.look = { ...d.look }; // v5.90.0
        agent.mood = d.mood ?? agent.mood;
        agent.moodModifier = d.moodModifier || 0;
        // Restore skills
        if (d.skills) {
            for (const [sk,sv] of Object.entries(d.skills)) {
                const s = agent.skills.get(sk);
                if (s && sv) { s.xp = sv.xp; s.passion = sv.passion; }
            }
        }
        // Restore relationships
        // v5.47.0 BUG-01 修復:relationships 以陣列(toDict)序列化,舊碼用 Object.entries 迭代,
        // 鍵變成 "0","1" 且欄位名不符(target_name),導致返鄉村民的關係全被建成「名字=索引」→「該去找 0 敘敘舊了」
        if (d.relationships) {
            const list = Array.isArray(d.relationships) ? d.relationships : Object.values(d.relationships);
            for (const rd of list) {
                if (!rd) continue;
                const rid = rd.targetId || rd.target_id || rd.id;
                const rname = rd.targetName || rd.target_name || rd.name;
                if (!rid || !rname || /^\d+$/.test(String(rname))) continue; // 斷掉的引用直接略過,絕不把索引當名字
                const r = agent.relationships.getOrCreate(rid, rname);
                Object.assign(r, { affinity:rd.affinity||0, trust:rd.trust||0,
                    romanticInterest:rd.romanticInterest ?? rd.romantic_interest ?? 0,
                    interactionCount:rd.interactionCount ?? rd.interaction_count ?? 0,
                    status:rd.status||null, statusSince:rd.statusSince ?? rd.status_since ?? 0 });
            }
        }
        // Restore memories
        if (d.memories && Array.isArray(d.memories)) {
            d.memories.forEach(m => agent.memory.add(m.tick, m.time, m.category, m.content ?? m.text ?? '', m.importance, m.related_agents || m.relatedAgents || []));
        }
        world.agents[agent.agentId] = agent;
        world.logMessage('arrival', `${agent.name}${t('旅行歸來了！')}`, agent.name);
        const event = {name:t('居民歸來'),description:`${agent.name}${t('帶著故事回來了！')}`,severity:'minor',effects:{mood_all:3,conversation_topic:`${agent.name}${t('的旅行故事')}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'arrival',`${agent.name}${t('旅行回來了！')}`,4,[agent.name]);
        });
    }
    _managePopulation(world) {
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const total = npcCount + this._travellingAgents.length;
        const repImmigration = world.reputationSystem ? world.reputationSystem.getModifier('immigration_bonus') : 0;
        const immigrationBoost = (world.news ? world.news.getModifier('immigration_chance', 0) : 0) + repImmigration;
        if (total < this.TARGET_POPULATION) {
            for (let i = 0; i < this.TARGET_POPULATION - total; i++) this._spawnImmigrant(world);
        } else if (immigrationBoost > 0 && Math.random() < immigrationBoost && total < this.TARGET_POPULATION + 3) {
            this._spawnImmigrant(world);
        }
    }
    _spawnImmigrant(world) {
        let available = IMMIGRANT_POOL.filter(p => !this._usedImmigrantNames.has(p.name));
        if (!available.length) { this._usedImmigrantNames.clear(); available = [...IMMIGRANT_POOL]; }
        // v5.19.0 城鎮身分:成形的路線會吸引「氣味相投」的移民(依職業軸加權挑選)
        let imm;
        const routeAxis = world.townIdentity?.routeAxis?.();
        if (routeAxis && Math.random() < 0.7) {
            const weights = available.map(p => JOB_AXIS[p.job] === routeAxis ? 4 : 1);
            imm = weightedChoice(available, weights);
        }
        if (!imm) imm = pickRandom(available);
        this._usedImmigrantNames.add(imm.name);
        const id = `imm_${imm.name}_${world.tickCount}`;
        const personality = new Personality(imm.traits, imm.background);
        personality.values = shuffle([t('家庭'),t('自由'),t('知識'),t('財富'),t('權力'),t('藝術'),t('自然'),t('社群'),t('冒險'),t('和平')]).slice(0, 1+Math.floor(Math.random()*3));
        const job = new Job(imm.job);
        const home = pickRandom(['residential_north','residential_south','residential_east']);
        const agent = new Agent(id, imm.name, imm.age, personality, job, home, imm.gender);
        world.agents[agent.agentId] = agent;
        // 聲望效果:高聲望的鎮長讓新居民帶著初始信任到來
        const initTrust = world.reputationSystem ? world.reputationSystem.getModifier('npc_initial_trust') : 0;
        if (initTrust > 0) {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (player) {
                const rel = agent.relationships.getOrCreate(player.agentId, player.name);
                rel.trust += initTrust;
                rel.affinity += Math.round(initTrust / 2);
            }
        }
        world.logMessage('immigration', `${t('新居民到來：')}${agent.name}${t('，')}${job.title}${t('！')}`, agent.name);
        const event = {name:t('新居民'),description:`${agent.name}${t('以')}${job.title}${t('身分到來！')}`,severity:'minor',effects:{mood_all:5,conversation_topic:`${t('新居民')}${agent.name}`},event_type:'arrival'};
        this.eventLog.push([world.clock.timeStr, event]);
        this.conversationTopics.push(`${t('新居民')}${agent.name}`);
        Object.values(world.agents).forEach(o => {
            if(o.agentId!==agent.agentId) o.memory.add(world.tickCount,world.clock.timeStr,'immigration',`${t('新居民')}${agent.name}${t('到來了！')}`,5,[agent.name]);
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${t('新居民')}${agent.name}${t('以')}${job.title}${t('身分來到鎮上！')}`, 6, [agent.name]);
    }
    _applyEffects(event, world) {
        if (event.effects.conversation_topic) {
            this.conversationTopics.push(event.effects.conversation_topic);
            this.conversationTopics = this.conversationTopics.slice(-5);
        }
        if (event.effects.mood_all != null) this.activeEffects.mood_modifier = event.effects.mood_all;
    }
    getRecentEvents(n=10) { return this.eventLog.slice(-n); }
    getGossipTopics() {
        const topics = [...this.conversationTopics];
        this.eventLog.slice(-3).forEach(([,e]) => topics.push(e.description));
        return topics;
    }
    getTravellingAgents() { return this._travellingAgents.map(t => ({agentId:t.agentData.agentId,name:t.agentData.name,reason:t.reason,return_tick:t.returnTick})); }
    getActiveChains() {
        return this._activeChains.map(c => {
            const stages = EVENT_CHAINS[c.chainId]; const cur = stages[c.stage];
            return {chain:c.chainId, current_event:cur.name, stage:c.stage+1, total_stages:stages.length};
        });
    }
}

// --- Election System ---
// 選舉制度：每個居民根據自身個性、價值觀、關係來投票選出鎮長
const ELECTION_POLICIES = [
    { id:'economy',    label:t('經濟發展'), icon:'💰', values:[t('財富'),t('冒險')],     traits:['hardworking','perfectionist'] },
    { id:'welfare',    label:t('社會福利'), icon:'🤝', values:[t('家庭'),t('社群'),t('和平')], traits:['kind','optimist'] },
    { id:'defense',    label:t('軍事防禦'), icon:'🛡️', values:[t('權力'),t('冒險')],      traits:['stoic','hardworking'] },
    { id:'culture',    label:t('文化教育'), icon:'📚', values:[t('知識'),t('藝術')],      traits:['creative','perfectionist'] },
    { id:'nature',     label:t('自然保育'), icon:'🌿', values:[t('自然'),t('和平')],      traits:['ascetic','romantic'] },
    { id:'freedom',    label:t('個人自由'), icon:'🕊️', values:[t('自由'),t('冒險')],      traits:['creative','night_owl'] },
];

class ElectionSystem {
    constructor() {
        this.active = false;
        this.phase = 'none';
        this.candidates = [];
        this.votes = {};
        this.campaignDaysLeft = 0;
        this.votingDaysLeft = 0;
        this.resultsDaysLeft = 0;
        this.lastElectionDay = 0;
        this.electionHistory = [];
        this._electionCooldown = 60;
    }

    dailyUpdate(world) {
        const day = world.clock.day + (world.clock.year - 1) * 60;
        if (this.phase === 'campaign') {
            this.campaignDaysLeft--;
            if (this.campaignDaysLeft <= 0) this._startVoting(world);
            return null;
        }
        if (this.phase === 'voting') {
            this.votingDaysLeft--;
            this._processVotes(world);
            if (this.votingDaysLeft <= 0) return this._announceResults(world);
            return null;
        }
        if (this.phase === 'results') {
            this.resultsDaysLeft--;
            if (this.resultsDaysLeft <= 0) { this.phase = 'none'; this.active = false; }
            return null;
        }
        // v5.30.1 固定每年秋季第 1 天開選(競選3天→投票2天→公布);防止同年重複
        if (!this.active && world.clock.season === '秋季' && world.clock.day === 1
            && (day - this.lastElectionDay) >= 20) {
            this._startElection(world);
        }
        return null;
    }

    triggerElection(world) { if (this.active) return; this._startElection(world); }

    // v5.38.0 旅人參選鎮長 ----------------------------------------------------
    // 參選資格:第二章(繁榮 20)起,且至少 3 位村民好感 ≥ 40(有人願意聯署)
    playerEligibility(world) {
        const player = world.agents['player'];
        if (!player) return { ok: false, msg: '' };
        if ((world.prosperity?.prosperity || 0) < 20) return { ok: false, msg: t('小鎮還不夠認識你——進入第二章(小鎮成長 20)後才能參選。') };
        const backers = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && (a.relationships?.relationships?.['player']?.affinity || 0) >= 40);
        if (backers.length < 3) return { ok: false, msg: `${t('參選需要 3 位好感 40 以上的村民聯署(目前')} ${backers.length}/3${t(')。先去多交幾個朋友吧!')}` };
        return { ok: true, backers };
    }

    registerPlayerCandidate(world, policyId) {
        if (!this.active || this.phase !== 'campaign') return { ok: false, msg: t('現在不是競選登記期間(每年秋季第 1 天開選,登記期 3 天)。') };
        if (this.candidates.some(c => c.agentId === 'player')) return { ok: false, msg: t('你已經登記參選了。') };
        const elig = this.playerEligibility(world);
        if (!elig.ok) return elig;
        const player = world.agents['player'];
        const policy = ELECTION_POLICIES.find(p => p.id === policyId) || ELECTION_POLICIES[1];
        this.candidates.push({ agentId: 'player', name: player.name, policy: policy.id, policyLabel: policy.label, policyIcon: policy.icon, votes: 0, speech: `${t('我雖是旅人,但這裡早已是我的家。我主張')}${policy.label}${t(',請把你的一票交給我!')}`, isPlayer: true });
        this.playerCanvassed = {};
        world.logMessage('event', `📢 ${t('旅人')} ${player.name} ${t('宣布參選鎮長!主張')}${policy.icon}${policy.label}`);
        player.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我登記參選鎮長,主張')}${policy.label}${t('。聯署的朋友們都在為我加油。')}`, 9, []);
        // 全鎮都會知道旅人出馬了——寫進每個人的記憶流,之後的對話會自然聊到
        Object.values(world.agents).forEach(a => {
            if (a.isPlayer || a.isDead) return;
            a.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('鎮上的旅人')}${player.name}${t('宣布參選鎮長,主張')}${policy.label}`, 6, [player.name]);
        });
        if (world.dailyNews) world.dailyNews.collectEvent('politics', `${t('旅人')}${player.name}${t('投入鎮長選戰,主張')}${policy.label}`, 9, [player.name]);
        return { ok: true };
    }

    // 拉票:每位村民每屆一次;由聊天「說服」意圖觸發
    canvassNpc(world, npc) {
        if (!this.candidates.some(c => c.agentId === 'player')) return { ok: false };
        if (this.phase !== 'campaign' && this.phase !== 'voting') return { ok: false };
        this.playerCanvassed = this.playerCanvassed || {};
        if (this.playerCanvassed[npc.agentId]) return { ok: false, dup: true };
        this.playerCanvassed[npc.agentId] = true;
        const me = this.candidates.find(c => c.agentId === 'player');
        npc.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${world.agents['player']?.name || t('旅人')}${t('親自來拉票,認真談了他對')}${me?.policyLabel || ''}${t('的想法')}`, 5, []);
        return { ok: true };
    }

    _startElection(world) {
        const eligible = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        if (eligible.length < 2) return;
        this.active = true; this.phase = 'campaign'; this.campaignDaysLeft = 3; this.votingDaysLeft = 0; this.votes = {};
        const scored = eligible.map(a => {
            let score = (a.skills?.skills?.社交?.level || 0) * 2;
            score += (a.personality.socialModifier || 0) * 3;
            score += (a.mood + 50) / 20;
            if (a.personality.traits.includes('charismatic')) score += 8;
            if (a.personality.traits.includes('shy')) score -= 5;
            if (a.job?.key === 'mayor') score += 5;
            score += Math.random() * 6;
            return { agent: a, score };
        }).sort((a, b) => b.score - a.score);
        const numCandidates = Math.min(eligible.length, 2 + (eligible.length >= 8 ? 1 : 0) + (eligible.length >= 12 ? 1 : 0));
        this.candidates = scored.slice(0, numCandidates).map(({ agent }) => {
            const policy = this._pickPolicy(agent);
            return { agentId: agent.agentId, name: agent.name, policy: policy.id, policyLabel: policy.label, policyIcon: policy.icon, votes: 0, speech: this._generateSpeech(agent, policy) };
        });
        world.logMessage('event', `📢 ${t('選舉開始！')}${this.candidates.map(c => c.name).join(t('、'))} ${t('宣布參選鎮長')}`);
        world.logMessage('event', `📋 ${t('競選期間為')} ${this.campaignDaysLeft} ${t('天，之後進行投票')}`);
        this.candidates.forEach(c => {
            const agent = world.agents[c.agentId];
            if (agent?.memory) agent.memory.add(world.tickCount, world.clock.timeStr, 'election', `${t('我宣布參選鎮長，主張')}${c.policyLabel}`, 8, []);
        });
    }

    _pickPolicy(agent) {
        let best = ELECTION_POLICIES[0], bestScore = -Infinity;
        for (const policy of ELECTION_POLICIES) {
            let score = 0;
            for (const v of agent.personality.values) { if (policy.values.includes(v)) score += 3; }
            for (const t of agent.personality.traits) { if (policy.traits.includes(t)) score += 2; }
            score += Math.random() * 1.5;
            if (score > bestScore) { bestScore = score; best = policy; }
        }
        return best;
    }

    _generateSpeech(agent, policy) {
        const speeches = {
            economy: [`${t('身為')}${agent.name}${t('，我承諾帶領邊境鎮走向繁榮！')}`, `${t('我會讓每個人都能豐衣足食！')}`, `${t('加強貿易、開拓資源，讓鎮民富裕起來！')}`],
            welfare: [`${t('我會照顧好每一位居民！')}`, `${t('社區的和諧是我最重視的事。')}`, `${t('讓大家都能安居樂業！')}`],
            defense: [`${t('我會讓邊境鎮固若金湯！')}`, `${t('加強防禦，不再讓突襲得逞！')}`, `${t('保護家園是我的首要任務！')}`],
            culture: [`${t('教育和文化才是小鎮的未來！')}`, `${t('我要建立學院，讓知識傳承下去。')}`, `${t('藝術與智慧將使我們偉大！')}`],
            nature:  [`${t('我們必須與自然和諧共處。')}`, `${t('永續發展才是正道！')}`, `${t('保護環境就是保護我們自己。')}`],
            freedom: [`${t('每個人都應該有選擇的自由！')}`, `${t('減少管束，讓大家自由發展。')}`, `${t('尊重個人，成就集體！')}`],
        };
        return pickRandom(speeches[policy.id] || speeches.economy);
    }

    _startVoting(world) { this.phase = 'voting'; this.votingDaysLeft = 2; this.votes = {}; world.logMessage('event', `🗳️ ${t('投票開始！居民們正在投下神聖的一票')}`); }

    _processVotes(world) {
        const voters = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !this.votes[a.agentId] && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        for (const voter of voters) {
            if (Math.random() > 0.6) continue;
            const chosen = this._calculateVote(voter, world);
            if (chosen) { this.votes[voter.agentId] = chosen.agentId; chosen.votes++; }
        }
    }

    _calculateVote(voter, world) {
        if (!this.candidates.length) return null;
        const scores = this.candidates.map(c => {
            let score = 0;
            const candidate = world.agents[c.agentId];
            if (!candidate) return { candidate: c, score: 0 };
            const rel = voter.relationships?.relationships?.[c.agentId];
            if (rel) { score += (rel.affinity / 100) * 40; score += (rel.trust / 100) * 10; }
            const policy = ELECTION_POLICIES.find(p => p.id === c.policy);
            if (policy) { for (const v of voter.personality.values) { if (policy.values.includes(v)) score += 10; } }
            if (candidate.personality.traits.includes('charismatic')) score += 8;
            if (candidate.personality.traits.includes('kind')) score += 4;
            if (candidate.personality.traits.includes('abrasive')) score -= 6;
            if (candidate.personality.traits.includes('lazy')) score -= 4;
            score += (candidate.skills?.skills?.社交?.level || 0) * 1;
            score += (Math.random() - 0.3) * 10;
            if (voter.personality.traits.includes('pessimist') && c.policy === 'defense') score += 3;
            if (voter.personality.traits.includes('optimist') && c.policy === 'welfare') score += 3;
            if (voter.personality.traits.includes('creative') && c.policy === 'culture') score += 3;
            if (voter.personality.traits.includes('hardworking') && c.policy === 'economy') score += 3;
            if (voter.personality.traits.includes('ascetic') && c.policy === 'nature') score += 3;
            // v5.38.0 玩家候選人:聲望與親自拉票會左右選情;旅人資歷淺,起步略居劣勢
            if (c.agentId === 'player') {
                score -= 6;
                score += Math.max(-10, Math.min(15, (world.reputationSystem?.reputation || 0) / 15));
                if (this.playerCanvassed?.[voter.agentId]) score += 8;
            }
            return { candidate: c, score };
        });
        scores.sort((a, b) => b.score - a.score);
        return scores[0]?.candidate || null;
    }

    _announceResults(world) {
        const remaining = Object.values(world.agents).filter(a => !a.isPlayer && a.agentId !== 'player' && !this.votes[a.agentId] && !world.events.getTravellingAgents().some(t => t.agentId === a.agentId));
        for (const voter of remaining) { const chosen = this._calculateVote(voter, world); if (chosen) { this.votes[voter.agentId] = chosen.agentId; chosen.votes++; } }
        this.candidates.sort((a, b) => b.votes - a.votes);
        const winner = this.candidates[0];
        const totalVotes = this.candidates.reduce((s, c) => s + c.votes, 0);
        if (!winner) { this.phase = 'none'; this.active = false; return null; }
        const oldMayor = Object.values(world.agents).find(a => a.job?.key === 'mayor' && a.agentId !== winner.agentId);
        const newMayorAgent = world.agents[winner.agentId];
        if (oldMayor && oldMayor.agentId !== winner.agentId) {
            const fallbackJobs = ['farmer','guard','trader','researcher'];
            const newJobKey = fallbackJobs[Math.floor(Math.random() * fallbackJobs.length)];
            oldMayor.job = JOB_DEFINITIONS[newJobKey] ? new Job(newJobKey) : null;
            oldMayor.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我在選舉中落敗，不再擔任鎮長')}`, 9, [winner.name]);
        }
        if (newMayorAgent) {
            newMayorAgent.job = new Job('mayor');
            newMayorAgent.moodModifier = (newMayorAgent.moodModifier || 0) + 20;
            newMayorAgent.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我贏得了鎮長選舉！得到')} ${winner.votes} ${t('票')}`, 10, []);
        }
        const resultMsg = this.candidates.map(c => `${c.name}${t('（')}${c.policyIcon}${c.policyLabel}${t('）：')}${c.votes} ${t('票')}`).join(t('、'));
        world.logMessage('event', `🏆 ${t('選舉結果：')}${winner.name} ${t('當選新鎮長！主張：')}${winner.policyIcon}${winner.policyLabel}`);
        world.logMessage('event', `📊 ${t('得票：')}${resultMsg}${t('（共')} ${totalVotes} ${t('票）')}`);
        if (world.questSystem) world.questSystem.onElection();
        this._applyPolicyEffects(winner.policy, world);
        const day = world.clock.day + (world.clock.year - 1) * 60;
        this.lastElectionDay = day;
        this.electionHistory.push({ day, year: world.clock.year, season: world.clock.season, winner: { agentId: winner.agentId, name: winner.name, policy: winner.policy, votes: winner.votes }, candidates: this.candidates.map(c => ({ agentId: c.agentId, name: c.name, policy: c.policy, votes: c.votes })), totalVotes });
        Object.values(world.agents).forEach(a => {
            if (a.isPlayer) return;
            const votedFor = this.votes[a.agentId];
            if (votedFor === winner.agentId) a.moodModifier = (a.moodModifier || 0) + 8;
            else if (votedFor) a.moodModifier = (a.moodModifier || 0) - 3;
        });
        // v5.38.0 玩家參選的結局
        const playerCand = this.candidates.find(c => c.agentId === 'player');
        if (playerCand) {
            const playerA = world.agents['player'];
            if (winner.agentId === 'player') {
                world.logMessage('event', `👑 ${t('你當選鎮長了!從今天起,全鎮大小事都等你拿主意。')}`);
                playerA?.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我贏得鎮長選舉(')}${playerCand.votes}${t('票),旅人成了邊境鎮的鎮長!')}`, 10, []);
            } else {
                world.logMessage('event', `🗳️ ${t('你以')} ${playerCand.votes} ${t('票落選,雖敗猶榮——村民記住了你的名字,下屆秋季再來!')}`);
                playerA?.memory?.add(world.tickCount, world.clock.timeStr, 'election', `${t('我在鎮長選舉中落敗(')}${playerCand.votes}${t('票)。')}${winner.name}${t('當選了,但我不會就此放棄。')}`, 8, [winner.name]);
            }
        }
        this.playerCanvassed = {};
        this.phase = 'results'; this.resultsDaysLeft = 3;
        return { name: t('鎮長選舉'), description: `${winner.name} ${t('以')} ${winner.votes}/${totalVotes} ${t('票當選新鎮長')}`, severity: 'major', event_type: 'election', effects: {} };
    }

    _applyPolicyEffects(policyId, world) {
        const effects = {
            economy: { headline:t('新鎮長推動經濟改革'), modifiers:{farm_bonus:0.15, trade_bonus:0.1}, severity:'good' },
            welfare: { headline:t('新鎮長推行社會福利'), modifiers:{mood_modifier:5, immigration_chance:0.1}, severity:'good' },
            defense: { headline:t('新鎮長加強防禦部署'), modifiers:{raid_chance:-0.05, guard_bonus:0.2}, severity:'info' },
            culture: { headline:t('新鎮長重視文化教育'), modifiers:{research_bonus:0.2, skill_bonus:0.1}, severity:'info' },
            nature:  { headline:t('新鎮長推動自然保育'), modifiers:{gathering_bonus:0.2, mood_modifier:3}, severity:'good' },
            freedom: { headline:t('新鎮長放寬政策管制'), modifiers:{mood_modifier:3, immigration_chance:0.15}, severity:'info' },
        };
        const effect = effects[policyId];
        if (effect && world.news) {
            world.news.bulletins.push({ id: 'election_policy_' + Date.now(), headline: effect.headline, headline_en: '', category: t('政治'), severity: effect.severity, flavor: `${this.candidates[0]?.name || t('新鎮長')}${t('的施政方針開始影響小鎮')}`, modifiers: effect.modifiers, publishedDay: world.clock.day, expiresDay: world.clock.day + 30, daysRemaining: 30 });
            world.news._rebuildModifiers(world.clock.day + (world.clock.year - 1) * 60);
        }
    }

    toDict() {
        return { active: this.active, phase: this.phase, candidates: this.candidates.map(c => ({...c})), votes: {...this.votes}, campaignDaysLeft: this.campaignDaysLeft, votingDaysLeft: this.votingDaysLeft, resultsDaysLeft: this.resultsDaysLeft, lastElectionDay: this.lastElectionDay, electionHistory: this.electionHistory.slice(-10), playerCanvassed: { ...(this.playerCanvassed || {}) } };
    }

    loadFrom(data) {
        if (!data) return;
        this.active = data.active || false; this.phase = data.phase || 'none';
        this.candidates = (data.candidates || []).map(c => ({...c})); this.votes = data.votes || {};
        this.campaignDaysLeft = data.campaignDaysLeft || 0; this.votingDaysLeft = data.votingDaysLeft || 0;
        this.resultsDaysLeft = data.resultsDaysLeft || 0; this.lastElectionDay = data.lastElectionDay || 0;
        this.electionHistory = (data.electionHistory || []).slice(-10);
        this.playerCanvassed = data.playerCanvassed || {};
    }
}
