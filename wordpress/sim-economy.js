// RimTown - sim-economy.js：從 simulation.js 拆出的 倉庫、每日生產、建築、貿易、科技、工單、新聞（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。
// --- Economy: Stockpile ---
const DEFAULT_STOCKPILE = { food:200, wood:100, stone:80, metal:30, cloth:40, herbs:20, silver:150, meals:50, tools:10, clothing:15, medicine:5, furniture:5, research_points:0,
    // New resources (industry + processing)
    plank:0, hardwood:0, brick:0, marble:0, steel:0, gold:0,
    // Crop resources
    wheat:0, rice:0, corn:0, potato:0, cotton:0, flowers:0, mushroom:0, sugarcane:0, tea:0, grapes:0, golden_wheat:0, dragon_fruit:0,
    // Processed goods
    bread:0, pastry:0, beer:0, wine:0, perfume:0, fine_tea:0, herbal_tea:0, sugar:0, jam:0, luxury_furniture:0,
};

class Stockpile {
    constructor() { this.resources = {...DEFAULT_STOCKPILE}; this.history = []; }
    get(r) { return this.resources[r] || 0; }
    add(r, amount, tick=0, reason='', source='') {
        this.resources[r] = (this.resources[r]||0) + amount;
        this.history.push({tick,resource:r,amount,reason,source});
        if (this.history.length > 600) this.history = this.history.slice(-600); // v5.99.0 B12(讀取端只用最近 50 筆)
    }
    consume(r, amount, tick=0, reason='', source='') {
        if ((this.resources[r]||0) < amount) return false;
        this.resources[r] -= amount;
        this.history.push({tick,resource:r,amount:-amount,reason,source});
        if (this.history.length > 600) this.history = this.history.slice(-600); // v5.99.0 B12(讀取端只用最近 50 筆)
        return true;
    }
    has(r, amount) { return (this.resources[r]||0) >= amount; }
    canAfford(costs) { return Object.entries(costs).every(([r,a]) => this.has(r,a)); }
    pay(costs, tick=0, reason='', source='') {
        if (!this.canAfford(costs)) return false;
        Object.entries(costs).forEach(([r,a]) => this.consume(r,a,tick,reason,source));
        return true;
    }
    toDict() { return { resources:{...this.resources}, recent_changes:this.history.slice(-10) }; }
}

// --- Economy: Production ---
const JOB_PRODUCTION = {
    farmer: {inputs:{},outputs:{food:12},skill:t('種植')},
    miner: {inputs:{tools:0.1},outputs:{stone:6,metal:3},skill:t('採礦')},
    cook: {inputs:{food:8},outputs:{meals:9},skill:t('烹飪')}, // v5.53.0 12→9:預設3廚師產能3.3倍於需求,收斂
    blacksmith: {inputs:{metal:3,wood:1},outputs:{tools:3},skill:t('工藝')},
    carpenter: {inputs:{wood:4},outputs:{furniture:2},skill:t('建造')},
    tailor: {inputs:{cloth:3},outputs:{clothing:2},skill:t('工藝')},
    doctor: {inputs:{herbs:2},outputs:{medicine:2},skill:t('醫療')},
    researcher: {inputs:{},outputs:{research_points:5},skill:t('智識')},
    trader: {inputs:{},outputs:{silver:5},skill:t('社交')}, // v5.52.0 銀幣水龍頭收緊(8→5)
    guard: {inputs:{},outputs:{},skill:t('射擊')},
    priest: {inputs:{},outputs:{},skill:t('社交')},
    mayor: {inputs:{},outputs:{silver:2},skill:t('社交')}, // v5.52.0 銀幣水龍頭收緊(3→2)
};
const SEASON_FARM_MOD = {'春季':1.2,'夏季':1.5,'秋季':0.8,'冬季':0.4};
const NATURE_GATHERING = {forest:{wood:3},river:{food:2},meadow:{herbs:1,cloth:0.5},cave:{stone:2,metal:1},lake:{food:1.5}};
// v5.51.0 經濟B波:加工職業 → 加工品 對照(勞動力排班的單位)
const CRAFT_JOB_GOOD = { cook:'meals', blacksmith:'tools', tailor:'clothing', doctor:'medicine', carpenter:'furniture' };
const RAW_MATERIALS = ['wood','stone','metal','cloth','herbs'];

function processDailyProduction(world) {
    const sp = world.stockpile;
    // v5.51.0 原料層自動供給,v5.53.0 改為「補滿到安全線」:
    // 固定 +12 補不上木材這種高需求原料(建築+家具線+冬季取暖),紅燈會卡死;直接補到 40
    RAW_MATERIALS.forEach(r => {
        const gap = 40 - sp.get(r);
        if (gap > 0) sp.add(r, gap, world.tickCount, t('原料自動補給'));
    });
    if (!world.workPolicy) world.workPolicy = {};
    // Check which NPC jobs are covered by the industry system to avoid double production
    const industryJobs = {};
    if (world.industry) {
        for (const [key] of Object.entries(world.industry.industries)) {
            const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
            if (def) industryJobs[def.npcJob] = true;
        }
    }
    Object.values(world.agents).forEach(agent => {
        if (agent.isPlayer || !agent.job) return;
        const recipe = JOB_PRODUCTION[agent.job.key]; if (!recipe) return;
        // v5.51.0 勞動力排班:鎮長(玩家)可對加工線下休工/正常/加班指令,產能 vs 生活的取捨
        const craftGood = CRAFT_JOB_GOOD[agent.job.key];
        const policy = craftGood ? (world.workPolicy[craftGood] || 'normal') : 'normal';
        if (policy === 'off') {
            agent.moodModifier = (agent.moodModifier || 0) + 4;
            agent.memory?.add?.(world.tickCount, world.clock.timeStr, 'daily', t('今天工坊休工，難得清閒，多了些時間陪伴身邊的人。'), 3, []);
            return;
        }
        // If this job's production is handled by industry system, reduce to 30% (NPC still does ancillary work)
        const isIndustryHandled = industryJobs[agent.job.key];
        const skill = agent.skills.get(recipe.skill);
        let eff = 0.5 + ((skill?skill.level:0)/20)*2.0;
        if (isIndustryHandled) eff *= 0.5;
        if (policy === 'extra') {
            // v5.52.0 加班要付津貼(銀幣 sink),v5.53.0 3→8:試玩回饋 3 銀幣在流水裡無感
            if (sp.consume('silver', 8, world.tickCount, `${agent.name}${t('的加班津貼')}`)) {
                eff *= 1.5;
                agent.moodModifier = (agent.moodModifier || 0) - 3;
                if (Math.random() < 0.3) agent.memory?.add?.(world.tickCount, world.clock.timeStr, 'daily', t('連日加班，身體有點吃不消，但訂單堆著總得有人做。'), 4, []);
            } else {
                world.logMessage('economy', `${t('銀庫不足，付不出')}${agent.name}${t('的加班津貼，今日照常排班。')}`);
            }
        }
        if (agent.job.key === 'farmer') { eff *= SEASON_FARM_MOD[world.clock.season] || 1; eff *= 1 + (world.news?world.news.getModifier('farm_bonus',0):0) + (world.weather?world.weather.farmModifier:0) + (world.harborFlags?.granary ? 0.2 : 0); } // v5.93.0 大糧倉 +20%
        if (agent.job.key === 'miner') eff *= 1 + (world.news?world.news.getModifier('mining_bonus',0):0);
        eff *= 1 + (agent.mood - 50)/500;
        eff *= 0.9 + Math.random()*0.2;
        // v5.51.0 材料不足不再罷工:改為就地取材、產能打四折(原料層有自動補給,此情況應少見)
        let canProduce = true;
        for (const [r,a] of Object.entries(recipe.inputs)) { if (!sp.has(r,a)) { canProduce=false; break; } }
        if (!canProduce) {
            eff *= 0.4;
            world.logMessage('economy',`${agent.name}${t('材料短缺，用邊角料將就趕工。')}`,agent.name);
        } else {
            for (const [r,a] of Object.entries(recipe.inputs)) sp.consume(r,a,world.tickCount,`${agent.name}${t('的生產')}`,agent.name);
        }
        for (const [r,a] of Object.entries(recipe.outputs)) sp.add(r,Math.round(a*eff*10)/10,world.tickCount,`${agent.name}${t('（')}${agent.job.title}${t('）')}`,agent.name);
        if (agent.job.key === 'priest') Object.values(world.agents).forEach(o => { if(o.agentId!==agent.agentId) o.moodModifier=(o.moodModifier||0)+1; });
    });
    const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
    const mealsNeeded = 1.5*npcCount;
    const mealsAvailable = sp.get('meals');
    if (mealsAvailable >= mealsNeeded) {
        sp.consume('meals',mealsNeeded,world.tickCount,'daily consumption');
    } else {
        if (mealsAvailable > 0) sp.consume('meals',mealsAvailable,world.tickCount,'daily consumption');
        const deficit = mealsNeeded - mealsAvailable;
        if (sp.consume('food',deficit*2,world.tickCount,t('緊急食物'))) world.logMessage('economy',t('餐食不夠！居民正在吃生食。'));
        else { world.logMessage('economy',t('糧食短缺！居民正在挨餓！')); Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-10; a.needs.hunger=Math.max(0,a.needs.hunger-20); }); }
    }
    if (world.townMap) { for (const [locId,gather] of Object.entries(NATURE_GATHERING)) { if (world.townMap.locations[locId]) { for (const [r,a] of Object.entries(gather)) sp.add(r,a*0.5,world.tickCount,`natural (${locId})`); } } }
    sp.consume('tools',npcCount*0.05,world.tickCount,'tool wear');
    // v5.51.0 需求波動:天冷要衣(冬季衣物耗損翻倍)
    sp.consume('clothing',npcCount*(world.clock.season==='冬季'?0.06:0.03),world.tickCount,'clothing wear');
    // v5.51.0 需求波動:心情低落的村民找醫生拿藥(每天最多 3 人),藥品因此有了用處
    const downcast = Object.values(world.agents).filter(a => !a.isPlayer && a.mood < 30).slice(0, 3);
    downcast.forEach(a => {
        if (sp.consume('medicine', 1, world.tickCount, `${a.name}${t('的診療')}`)) {
            a.moodModifier = (a.moodModifier || 0) + 6;
            a.memory?.add?.(world.tickCount, world.clock.timeStr, 'daily', t('去找醫生拿了藥，人舒服多了。'), 3, []);
        }
    });
    if (world.clock.season === '冬季' && !sp.consume('wood',npcCount*0.3,world.tickCount,'冬季取暖')) {
        world.logMessage('economy',t('木材不夠取暖！'));
        Object.values(world.agents).forEach(a => { a.moodModifier=(a.moodModifier||0)-8; a.needs.comfort=Math.max(0,a.needs.comfort-15); });
    }
    // v5.53.0 餐食也會過期(試玩回饋:餐食只漲不跌會變新的死資源):超過三天需求量的部分每日 8% 倒掉
    const mealsCap = Math.ceil(npcCount * 4.5);
    const excessMeals = sp.get('meals') - mealsCap;
    if (excessMeals > 0) {
        const wasted = Math.floor(excessMeals * 0.08);
        if (wasted > 0) {
            sp.consume('meals', wasted, world.tickCount, t('餐食放到過期'));
            world.logMessage('economy', `${wasted}${t('份餐食放到過期倒掉了——考慮讓廚房排休。')}`);
        }
    }
    // v5.52.0 食物稀缺曲線:超過糧倉容量的存糧會腐壞(穀倉擴容、冷藏穀庫減緩腐壞),避免食物爆量失去取捨
    const foodCap = 400 + (world.buildings?.getEffect?.('food_capacity', 0) || 0);
    const decayMod = Math.max(0, 1 + (world.buildings?.getEffect?.('food_decay', 0) || 0));
    const excessFood = sp.get('food') - foodCap;
    if (excessFood > 0) {
        const spoiled = Math.floor(excessFood * 0.05 * decayMod);
        if (spoiled > 0) {
            sp.consume('food', spoiled, world.tickCount, t('存糧過多腐壞'));
            world.logMessage('economy', `${t('糧倉滿了，')}${spoiled}${t('份食物腐壞——可辦慶典或賣給商人消化存糧。')}`);
        }
    }
}

// --- Economy: Buildings ---
const BUILDING_TEMPLATES = {
    watchtower:{name:t('瞭望塔'),description:t('提升防禦與襲擊預警'),costs:{wood:40,stone:30},work:20,effects:{defense_bonus:3}},
    granary:{name:t('穀倉'),description:t('增加食物儲存，減少腐壞'),costs:{wood:30,stone:20},work:15,effects:{food_capacity:500}},
    marketplace:{name:t('市集'),description:t('更好的交易與更多商人'),costs:{wood:25,stone:15,silver:50},work:18,effects:{trade_bonus:0.2,merchant_frequency:1.5}},
    well_upgrade:{name:t('深井'),description:t('改善供水'),costs:{stone:25,tools:3},work:12,effects:{drought_resistance:0.5}},
    training_ground:{name:t('訓練場'),description:t('守衛訓練更快'),costs:{wood:20,stone:10,tools:2},work:10,effects:{defense_bonus:2}},
    brewery:{name:t('釀酒坊'),description:t('生產啤酒，提升娛樂'),costs:{wood:15,metal:5,silver:30},work:14,effects:{recreation_bonus:10}},
    garden:{name:t('藥草園'),description:t('生產藥草用於醫療'),costs:{wood:10,silver:15},work:8,effects:{herbs_production:2}},
    school:{name:t('學堂'),description:t('提升所有技能經驗獲取'),costs:{wood:30,stone:20,silver:40},work:22,effects:{xp_bonus:1.2}},
    farm_irrigation:{name:t('農田灌溉'),description:t('提升作物產量'),costs:{stone:15,wood:10,tools:2},work:12,effects:{farm_bonus:1.3}},
    forge_bellows:{name:t('鍛造風箱'),description:t('加速金屬加工'),costs:{metal:10,stone:5},work:10,effects:{smithing_bonus:1.3}},
    clinic_upgrade:{name:t('醫療病房'),description:t('更好的治療效果'),costs:{wood:15,cloth:10,silver:25},work:14,effects:{healing_bonus:1.5}},
    town_walls:{name:t('城牆'),description:t('大幅提升防禦'),costs:{stone:80,wood:30,tools:5},work:40,effects:{defense_bonus:8}},
};

// --- Building Upgrades ---
const BUILDING_UPGRADES = {
    watchtower:{
        2:{name:t('強化瞭望塔'),description:t('石製加固，視野更遠'),costs:{stone:50,wood:20,metal:10},work:30,effects:{defense_bonus:2}},
        3:{name:t('哨兵高塔'),description:t('頂層弩砲，全天候警戒'),costs:{stone:80,metal:30,tools:5},work:50,effects:{defense_bonus:4,raid_chance:-0.05}},
    },
    granary:{
        2:{name:t('大型穀倉'),description:t('雙倍容量，通風防潮'),costs:{wood:50,stone:30,tools:3},work:25,effects:{food_capacity:500}},
        3:{name:t('冷藏穀庫'),description:t('地下冷藏，食物永不腐壞'),costs:{stone:60,metal:20,silver:40},work:40,effects:{food_capacity:800,food_decay:-0.5}},
    },
    marketplace:{
        2:{name:t('商業廣場'),description:t('更多攤位，吸引遠方商人'),costs:{wood:30,stone:25,silver:80},work:28,effects:{trade_bonus:0.15,merchant_frequency:0.5}},
        3:{name:t('國際商港'),description:t('稀有商品與異國商隊'),costs:{stone:50,metal:15,silver:150},work:45,effects:{trade_bonus:0.2,merchant_frequency:1.0}},
    },
    well_upgrade:{
        2:{name:t('淨水系統'),description:t('過濾雜質，提升健康'),costs:{stone:35,metal:10,tools:4},work:20,effects:{drought_resistance:0.3,healing_bonus:0.2}},
        3:{name:t('水渠網路'),description:t('全鎮供水，農田灌溉加成'),costs:{stone:60,metal:20,tools:6},work:35,effects:{drought_resistance:0.5,farm_bonus:0.2}},
    },
    training_ground:{
        2:{name:t('演武場'),description:t('專業訓練設施'),costs:{wood:30,stone:20,metal:10},work:18,effects:{defense_bonus:2}},
        3:{name:t('軍事學院'),description:t('培養精英守衛'),costs:{stone:40,metal:20,silver:50},work:35,effects:{defense_bonus:3,guard_xp_bonus:0.5}},
    },
    brewery:{
        2:{name:t('精釀酒坊'),description:t('釀造高級酒類'),costs:{wood:20,metal:10,silver:50},work:20,effects:{recreation_bonus:8}},
        3:{name:t('酒莊'),description:t('頂級佳釀，商業價值倍增'),costs:{wood:30,metal:15,silver:80},work:32,effects:{recreation_bonus:12,trade_bonus:0.1}},
    },
    garden:{
        2:{name:t('藥圃'),description:t('多樣藥草，產量加倍'),costs:{wood:15,silver:25,cloth:5},work:14,effects:{herbs_production:2}},
        3:{name:t('百草園'),description:t('珍稀藥材，治療奇效'),costs:{wood:20,silver:50,tools:3},work:24,effects:{herbs_production:3,healing_bonus:0.3}},
    },
    school:{
        2:{name:t('書院'),description:t('藏書豐富，學者雲集'),costs:{wood:40,stone:30,silver:60},work:30,effects:{xp_bonus:0.3}},
        3:{name:t('學府'),description:t('最高學府，研究加速'),costs:{stone:50,silver:100,tools:5},work:45,effects:{xp_bonus:0.4,research_bonus:0.2}},
    },
    farm_irrigation:{
        2:{name:t('水車灌溉'),description:t('自動化灌溉，省時省力'),costs:{wood:20,stone:15,metal:10},work:18,effects:{farm_bonus:0.3}},
        3:{name:t('精耕系統'),description:t('科學農法，產量大增'),costs:{stone:25,metal:15,tools:5},work:30,effects:{farm_bonus:0.5}},
    },
    forge_bellows:{
        2:{name:t('雙室鍛爐'),description:t('同時冶煉，效率翻倍'),costs:{metal:20,stone:15,tools:3},work:18,effects:{smithing_bonus:0.3}},
        3:{name:t('大師鍛造坊'),description:t('鍛造大師級裝備'),costs:{metal:35,stone:20,silver:40},work:30,effects:{smithing_bonus:0.5,tool_quality:0.3}},
    },
    clinic_upgrade:{
        2:{name:t('診療所'),description:t('專業醫療設備'),costs:{wood:20,cloth:15,silver:40,tools:3},work:22,effects:{healing_bonus:0.5}},
        3:{name:t('醫院'),description:t('全科醫療，起死回生'),costs:{stone:30,cloth:20,silver:80,tools:5},work:38,effects:{healing_bonus:0.8,mood_modifier:2}},
    },
    town_walls:{
        2:{name:t('加固城牆'),description:t('護城河與箭塔'),costs:{stone:120,wood:40,metal:20},work:55,effects:{defense_bonus:6}},
        3:{name:t('堅城堡壘'),description:t('銅牆鐵壁，固若金湯'),costs:{stone:180,metal:50,tools:10},work:80,effects:{defense_bonus:10,raid_chance:-0.1}},
    },
};

// --- v4.9.0 開羅式相鄰組合(建築+裝飾放在一起觸發加成,玩家自行發現) ---
const COMBO_DEFS = [
    {id:'romantic_corner', icon:'💞', name:t('浪漫街角'), parts:['flowerbed','bench','lamp'], desc:t('花圃+長椅+路燈')},
    {id:'plaza_oasis',     icon:'🌿', name:t('綠意廣場'), parts:['fountain','flowerbed'],     desc:t('小噴泉+花圃')},
    {id:'statue_square',   icon:'🗿', name:t('雕像廣場'), parts:['statue','bench'],           desc:t('雕像+長椅')},
    {id:'market_buzz',     icon:'🎪', name:t('市集人氣'), parts:['marketplace','lamp'],       desc:t('市集+路燈')},
    {id:'tavern_night',    icon:'🍺', name:t('酒香夜色'), parts:['brewery','lamp'],           desc:t('釀酒坊+路燈')},
    {id:'scholar_path',    icon:'📚', name:t('書香步道'), parts:['school','bench'],           desc:t('學堂+長椅')},
    {id:'iron_bastion',    icon:'🛡️', name:t('銅牆鐵壁'), parts:['watchtower','town_walls'],  desc:t('瞭望塔+城牆')},
    {id:'healing_garden',  icon:'🌼', name:t('靜心藥園'), parts:['garden','fountain'],        desc:t('藥草園+小噴泉')},
];

// --- v5.0.0 心動事件(礦石鎮式):與玩家的關係到達門檻時,NPC 用 AI 說出專屬真心話 ---
const HEART_EVENTS = [
    {id:'friend',   icon:'🌱', name:t('初識之誼'), min:{affinity:25},  scenario:t('你發現自己已經把旅人當朋友了。想跟他說說這段時間認識下來的感受,可以提起你們之間的某件小事')},
    {id:'close',    icon:'💛', name:t('知心好友'), min:{affinity:55},  scenario:t('旅人已是你的知心好友。你想跟他分享一件你從沒告訴過別人的心事或秘密')},
    {id:'soulmate', icon:'🌟', name:t('莫逆之交'), min:{affinity:80},  scenario:t('旅人是你此生難得的摯友。你想認真地告訴他,他對你有多重要')},
    {id:'crush',    icon:'💗', name:t('心動時刻'), min:{romantic:50},  scenario:t('你發現自己對旅人心動了。你鼓起勇氣,想含蓄地(或依你的性格直白地)透露你的感覺'), romance:true},
];

class BuildingManager {
    constructor() { this.projects=[]; this.completed=[]; this.activeEffects={}; this._counter=0; }
    getAvailable(world) {
        const done=new Set(this.completed.map(p=>p.name)), prog=new Set(this.projects.map(p=>p.name));
        return Object.entries(BUILDING_TEMPLATES).filter(([,t])=>!done.has(t.name)&&!prog.has(t.name)).map(([key,t])=>({key,...t,can_afford:world.stockpile.canAfford(t.costs)}));
    }
    getUpgradeable(world) {
        const upgrading=new Set(this.projects.filter(p=>p.upgradeKey).map(p=>p.upgradeKey));
        return this.completed.filter(b => {
            const key=b.buildingKey;
            if(!key||!BUILDING_UPGRADES[key]) return false;
            const lvl=b.level||1;
            if(lvl>=3) return false;
            if(upgrading.has(key)) return false;
            return !!BUILDING_UPGRADES[key][lvl+1];
        }).map(b => {
            const key=b.buildingKey;
            const nextLvl=(b.level||1)+1;
            const upg=BUILDING_UPGRADES[key][nextLvl];
            return { buildingKey:key, currentLevel:b.level||1, nextLevel:nextLvl, name:upg.name, description:upg.description, costs:upg.costs, work:upg.work, effects:upg.effects, can_afford:world.stockpile.canAfford(upg.costs), baseName:b.name };
        });
    }
    startUpgrade(buildingKey, world) {
        const b=this.completed.find(p=>p.buildingKey===buildingKey);
        if(!b) return null;
        const lvl=b.level||1;
        if(lvl>=3) return null;
        const upg=BUILDING_UPGRADES[buildingKey]?.[lvl+1];
        if(!upg) return null;
        if(this.projects.some(p=>p.upgradeKey===buildingKey)) return null;
        if(!world.stockpile.pay(upg.costs,world.tickCount,`${t('升級：')}${upg.name}`)) return null;
        this._counter++;
        const p={id:`build_${this._counter}`,name:upg.name,description:upg.description,costs:upg.costs,workRequired:upg.work,workDone:0,effects:upg.effects||{},status:'building',upgradeKey:buildingKey,targetLevel:lvl+1};
        this.projects.push(p);
        world.logMessage('building',`${t('開始升級：')}${upg.name}${t('！')}`);
        return p;
    }
    startProject(key, world, site) {
        const tmpl=BUILDING_TEMPLATES[key]; if(!tmpl) return null;
        const names=new Set([...this.completed,...this.projects].map(p=>p.name));
        if(names.has(tmpl.name)) return null;
        if(!world.stockpile.pay(tmpl.costs,world.tickCount,`Building: ${tmpl.name}`)) return null;
        this._counter++;
        const p={id:`build_${this._counter}`,name:tmpl.name,description:tmpl.description,costs:tmpl.costs,workRequired:tmpl.work,workDone:0,effects:tmpl.effects||{},status:'building',buildingKey:key};
        if (site && Number.isFinite(site.x)) { p.siteX = site.x; p.siteY = site.y; }
        this.projects.push(p); world.logMessage('building',`${t('開始建造：')}${tmpl.name}${t('！')}`); return p;
    }
    dailyConstruction(world) {
        const done=[];
        this.projects.forEach(p => {
            if(p.status!=='building') return;
            Object.values(world.agents).forEach(a => {
                if(a.isPlayer||!a.job) return;
                if(['carpenter','miner','blacksmith'].includes(a.job.key)) { const sk=a.skills.get('建造'); p.workDone+=1+Math.floor((sk?sk.level:0)/5); }
            });
            if(p.workDone>=p.workRequired) { p.status='complete'; done.push(p); }
        });
        done.forEach(p => {
            this.projects=this.projects.filter(x=>x!==p);
            if(p.upgradeKey) {
                // Upgrade: update existing completed building
                const existing=this.completed.find(b=>b.buildingKey===p.upgradeKey);
                if(existing) {
                    existing.level=p.targetLevel;
                    existing.name=p.name;
                    existing.description=p.description;
                }
                Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
                world.logMessage('building',`${t('升級完成：')}${p.name}${t('！')}`);
                if (world.dailyNews) world.dailyNews.collectEvent('building', `${p.name}${t('升級完成了！')}`, 7);
                Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+8; });
            } else {
                // New building
                p.buildingKey=p.buildingKey||null;
                p.level=1;
                this.completed.push(p);
                Object.entries(p.effects).forEach(([k,v])=>{ this.activeEffects[k]=(this.activeEffects[k]||0)+(typeof v==='number'?v:0); if(typeof v!=='number') this.activeEffects[k]=v; });
                world.logMessage('building',`${t('建造完成：')}${p.name}${t('！')}`);
                if (world.dailyNews) world.dailyNews.collectEvent('building', `${p.name}${t('建造完成了！')}`, 6);
                Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+5; });
                // v4.9.0: 建築完工 → 檢查相鄰組合 + 相關職業 NPC 發表 AI 評論
                world.checkCombos?.();
                const commentJobs = {brewery:['cook'],school:['researcher'],marketplace:['trader'],garden:['doctor'],clinic_upgrade:['doctor'],watchtower:['guard'],town_walls:['guard'],training_ground:['guard'],granary:['farmer'],farm_irrigation:['farmer'],forge_bellows:['blacksmith'],well_upgrade:['carpenter']};
                world.conversationEngine?.sendEventComment?.(world, `${t('小鎮蓋好了新的「')}${p.name}${t('」')}`, commentJobs[p.buildingKey] || []);
            }
        });
    }
    getEffect(key, def=0) { return this.activeEffects[key]??def; }
    toDict() { return {in_progress:this.projects,completed:this.completed,active_effects:{...this.activeEffects},completed_count:this.completed.length,_counter:this._counter}; }
}

// --- Economy: Trade ---
const BASE_PRICES = {food:1,wood:1.5,stone:2,metal:4,cloth:3,herbs:3.5,meals:2.5,tools:8,clothing:6,medicine:10,furniture:7,
    plank:3,hardwood:5,brick:5,marble:8,steel:10,gold:15,
    wheat:2,rice:3,corn:2,potato:1,cotton:4,flowers:3,mushroom:4,sugarcane:3,tea:8,grapes:6,golden_wheat:15,dragon_fruit:20,
    bread:4,pastry:8,beer:5,wine:15,perfume:20,fine_tea:18,herbal_tea:10,sugar:5,jam:10,luxury_furniture:25,
};
// v5.52.0 經濟C波:商人改以「收購加工品」為主(價值層 sink)——原料有自動補給,買賣原料已無意義
const MERCHANT_TYPES = [
    {names:[t('張商人 (Zhang the Trader)'),t('老趙商隊 (Old Zhao\'s Caravan)')],specialty:'general',sells:['food','herbs'],buys:['meals','furniture','clothing','tools']},
    {names:[t('礦商老李 (Li the Ore Dealer)')],specialty:'metals',sells:['metal','tools'],buys:['meals','medicine']},
    {names:[t('藥師小雪 (Xue the Herbalist)')],specialty:'medicine',sells:['herbs','medicine'],buys:['meals','clothing']},
    {names:[t('絲綢商人 (The Silk Trader)')],specialty:'textiles',sells:['cloth','clothing'],buys:['furniture','medicine','meals']},
    {names:[t('異國商隊 (Exotic Caravan)')],specialty:'exotic',sells:['herbs','food'],buys:['meals','clothing','furniture','tools','medicine']},
];

class TradeManager {
    constructor() { this.merchant=null; this._daysSince=0; this.tradeHistory=[]; }
    dailyUpdate(world) {
        this._daysSince++;
        if (this.merchant) { this.merchant.daysRemaining--; if(this.merchant.daysRemaining<=0){ world.logMessage('trade',`${t('商人')}${this.merchant.name}${t('已離開。')}`); this.merchant=null; } return; }
        const freq=world.buildings.getEffect('merchant_frequency',1);
        const newsBoost=world.news?world.news.getModifier('merchant_chance',0):0;
        const chance=Math.min(0.6, 0.15*freq+(this._daysSince-3)*0.05+newsBoost);
        if(Math.random()<chance) this._spawnMerchant(world);
    }
    _spawnMerchant(world) {
        this._daysSince=0;
        const mt=pickRandom(MERCHANT_TYPES);
        const tradeBonus=world.buildings.getEffect('trade_bonus',0);
        const sellBonus=world.news?world.news.getModifier('sell_bonus',0):0;
        const buyBonus=world.news?world.news.getModifier('buy_bonus',0):0;
        const repTradeBonus=world.reputationSystem?world.reputationSystem.getModifier('trade_price_bonus'):0;
        const offers=[];
        mt.sells.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(10,30),price:Math.round(bp*(1.2+Math.random()*0.6)*(1-tradeBonus-buyBonus-repTradeBonus)*10)/10,isBuying:false}); });
        mt.buys.forEach(r=>{ const bp=BASE_PRICES[r]||5; offers.push({resource:r,amount:randInt(15,40),price:Math.round(bp*(0.5+Math.random()*0.3)*(1+tradeBonus+sellBonus+repTradeBonus)*10)/10,isBuying:true}); });
        this.merchant={name:pickRandom(mt.names),specialty:mt.specialty,offers,daysRemaining:randInt(2,4)};
        world.logMessage('trade',`${t('商人')}${this.merchant.name}${t('到了！專長：')}${mt.specialty}。`);
    }
    executeTrade(offerIdx, qty, world) {
        if(!this.merchant) return {error:t('沒有商人')};
        const offer=this.merchant.offers[offerIdx]; if(!offer) return {error:t('無效交易')};
        qty=Math.min(qty,offer.amount); if(qty<=0) return {error:t('無效數量')};
        const total=qty*offer.price;
        if(offer.isBuying) {
            if(!world.stockpile.has(offer.resource,qty)) return {error:`${offer.resource}${t('不足')}`};
            world.stockpile.consume(offer.resource,qty,world.tickCount,`${t('賣給')}${this.merchant.name}`);
            world.stockpile.add('silver',total,world.tickCount,`${t('與')}${this.merchant.name}${t('交易')}`);
        } else {
            if(!world.stockpile.has('silver',total)) return {error:t('銀幣不足')};
            world.stockpile.consume('silver',total,world.tickCount,`${t('向')}${this.merchant.name}${t('購買')}`);
            world.stockpile.add(offer.resource,qty,world.tickCount,`${t('與')}${this.merchant.name}${t('交易')}`);
        }
        offer.amount-=qty;
        this.merchant.offers=this.merchant.offers.filter(o=>o.amount>0.5);
        world.logMessage('trade',`${offer.isBuying?t('賣出'):t('買入')} ${qty} ${offer.resource}${t('，')}${Math.round(total)}${t('銀幣。')}`);
        return {ok:true};
    }
    toDict() { return {merchant:this.merchant,days_since_merchant:this._daysSince}; }
}

// --- Economy: Research ---
const RESEARCH_TREE = {
    agriculture:{name:t('進階農業'),description:t('更好的農耕（+30%食物）'),cost:50,prerequisites:[],effects:{farm_bonus:1.3},unlocks:['farm_irrigation','garden']},
    metallurgy:{name:t('冶金術'),description:t('更好的金屬冶煉'),cost:60,prerequisites:[],effects:{smithing_bonus:1.2},unlocks:['forge_bellows']},
    medicine_research:{name:t('草藥醫學'),description:t('更好的療癒草藥'),cost:55,prerequisites:[],effects:{healing_bonus:1.3},unlocks:['clinic_upgrade','garden']},
    fortification:{name:t('防禦工事'),description:t('防禦性建築'),cost:70,prerequisites:[],effects:{defense_bonus:2},unlocks:['watchtower','training_ground','town_walls']},
    commerce:{name:t('商業'),description:t('更好的貿易方式'),cost:45,prerequisites:[],effects:{trade_bonus:0.15},unlocks:['marketplace']},
    architecture:{name:t('建築學'),description:t('進階建造'),cost:65,prerequisites:['metallurgy'],effects:{build_speed:1.3},unlocks:['school','town_walls']},
    brewing:{name:t('釀造術'),description:t('發酵的藝術'),cost:35,prerequisites:['agriculture'],effects:{recreation_bonus:5},unlocks:['brewery']},
    logistics:{name:t('後勤學'),description:t('更好的儲存'),cost:50,prerequisites:['commerce'],effects:{storage_bonus:1.5},unlocks:['granary']},
    education:{name:t('教育'),description:t('正式教育（+15%經驗）'),cost:80,prerequisites:['architecture'],effects:{xp_bonus:1.15},unlocks:['school']},
    masonry:{name:t('石匠術'),description:t('進階石工'),cost:55,prerequisites:['fortification'],effects:{stone_efficiency:1.3},unlocks:['town_walls','well_upgrade']},
};

class ResearchManager {
    constructor() {
        this.projects={}; this.current=null;
        for(const [key,d] of Object.entries(RESEARCH_TREE)) {
            this.projects[key]={key,name:d.name,description:d.description,cost:d.cost,progress:0,prerequisites:d.prerequisites||[],effects:d.effects||{},unlocks:d.unlocks||[],
                status:d.prerequisites.length===0?'available':'locked'};
        }
    }
    getAvailable() { return Object.values(this.projects).filter(p=>p.status==='available'); }
    startResearch(key) {
        const p=this.projects[key]; if(!p||p.status!=='available') return false;
        if(this.current&&this.projects[this.current]?.status==='researching') this.projects[this.current].status='available';
        p.status='researching'; this.current=key; return true;
    }
    dailyUpdate(world) {
        if(!this.current) { const av=this.getAvailable(); if(av.length) this.startResearch(av[0].key); return; }
        let pts=0;
        Object.values(world.agents).forEach(a=>{ if(!a.isPlayer&&a.job?.title===t('研究員')){ const sk=a.skills.get('智識'); pts+=3+(sk?sk.level:0)*0.5; } });
        pts *= 1 + (world.news?world.news.getModifier('research_bonus',0):0);
        const rp=world.stockpile.get('research_points'), bonus=Math.min(rp,5);
        if(bonus>0) world.stockpile.consume('research_points',bonus,world.tickCount,'research');
        if(pts+bonus<=0) return;
        const p=this.projects[this.current]; if(!p||p.status!=='researching') return;
        p.progress+=pts+bonus;
        if(p.progress>=p.cost) {
            p.status='complete'; this.current=null;
            Object.entries(p.effects).forEach(([k,v])=>{ world.buildings.activeEffects[k]=(world.buildings.activeEffects[k]||0)+(typeof v==='number'?v:0); });
            for(const op of Object.values(this.projects)) {
                if(op.status==='locked'&&op.prerequisites.every(pre=>this.projects[pre]?.status==='complete')) op.status='available';
            }
            world.logMessage('research',`${t('研究完成：')}${p.name}${t('！')}`);
            Object.values(world.agents).forEach(a=>{ a.moodModifier=(a.moodModifier||0)+3; });
        }
    }
    toDict() { return {current_research:this.current,projects:{...this.projects}}; }
}

// --- Economy: Work Orders ---
class WorkOrderManager {
    constructor() { this.orders=[]; this._counter=0; }
    createOrder(type,resource,amount,priority='normal',tick=0) {
        this._counter++;
        const o={id:`order_${this._counter}`,title:`${type}: ${amount} ${resource}`,type,resource,amount,current:0,priority,status:'queued',created:tick};
        this.orders.push(o); return o;
    }
    cancelOrder(id) { this.orders=this.orders.filter(o=>o.id!==id); }
    updateProgress(resource, amount) {
        this.orders.forEach(o=>{ if(o.status==='complete') return; if(o.resource===resource){ o.current+=amount; if(o.status==='queued') o.status='in_progress'; if(o.current>=o.amount) o.status='complete'; } });
    }
    cleanup() { const active=this.orders.filter(o=>o.status!=='complete'); const done=this.orders.filter(o=>o.status==='complete').slice(-10); this.orders=[...active,...done]; }
    toDict() { return {active:this.orders.filter(o=>o.status!=='complete'),all_orders:this.orders.slice(-20)}; }
}

// --- News System ---
const NEWS_TEMPLATES = [
    // Security/Raid related
    {headline:t('邊境偵察報告：發現可疑蹤跡'),headline_en:'Border scouts report suspicious tracks',category:'security',
     conditions:w=>true, weight:3, severity:'warning',
     modifiers:{raid_chance:0.15}, duration:3, flavor:[t('偵察兵在北方隘口發現營火殘跡。'),t('貿易路線發現不明足跡。')]},
    {headline:t('山賊集團在鄰近地區活動'),headline_en:'Bandit group active in nearby regions',category:'security',
     conditions:w=>w.clock.day>5, weight:2, severity:'danger',
     modifiers:{raid_chance:0.25,raid_severity:1}, duration:4, flavor:[t('鄰村難民警告有組織的盜匪。'),t('商人回報在主要道路遭遇伏擊。')]},
    {headline:t('附近村莊遭受襲擊'),headline_en:'Nearby village attacked',category:'security',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{raid_chance:0.30,chain_chance:0.1,mood_modifier:-5}, duration:3, flavor:[t('倖存者正逃向邊境鎮尋求安全。')]},
    {headline:t('邊境巡邏隊回報一切平靜'),headline_en:'Border patrols report all clear',category:'security',
     conditions:w=>true, weight:4, severity:'good',
     modifiers:{raid_chance:-0.05}, duration:2, flavor:[t('周邊地區目前看來很平靜。'),t('沒有偵測到敵對活動的跡象。')]},

    // Trade/Economy related
    {headline:t('商路暢通，大型商隊正在途中'),headline_en:'Trade routes clear, large caravan en route',category:'trade',
     conditions:w=>!w.trade?.merchant, weight:3, severity:'good',
     modifiers:{merchant_chance:0.3,trade_bonus:0.1}, duration:3, flavor:[t('好幾位商人帶著異國商品正朝我們而來。'),t('主要貿易道路已經修復。')]},
    {headline:t('貿易路線遭到封鎖'),headline_en:'Trade routes blocked',category:'trade',
     conditions:w=>true, weight:2, severity:'warning',
     modifiers:{merchant_chance:-0.15,supply_shortage:true}, duration:4, flavor:[t('山崩擋住了山間隘口。'),t('主要貿易道路的橋樑倒塌。')]},
    {headline:t('鄰國需求大增，物價上漲'),headline_en:'Neighboring demand surges, prices rising',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{sell_bonus:0.2}, duration:3, flavor:[t('區域對工藝品的需求急增。'),t('首都的大型建設工程需要材料。')]},
    {headline:t('市場供過於求，物價下跌'),headline_en:'Market oversupply, prices falling',category:'trade',
     conditions:w=>true, weight:2, severity:'info',
     modifiers:{buy_bonus:0.15,sell_bonus:-0.1}, duration:3, flavor:[t('太多商品湧入區域市場。')]},

    // Weather/Nature related
    {headline:t('農夫預測：近日天氣適宜耕作'),headline_en:'Farmers predict: good weather for crops',category:'weather',
     conditions:w=>['春季','夏季'].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.2,mood_modifier:3}, duration:2, flavor:[t('預計晴空萬里並有微雨。'),t('完美的播種條件。')]},
    {headline:t('異常天象：暴風雨可能來襲'),headline_en:'Unusual signs: storms may approach',category:'weather',
     conditions:w=>['秋季','冬季'].includes(w.clock.season), weight:3, severity:'warning',
     modifiers:{storm_chance:0.2,farm_bonus:-0.15,mood_modifier:-3}, duration:3, flavor:[t('地平線上烏雲聚集。'),t('動物舉止異常。')]},
    {headline:t('乾旱警報：水源開始減少'),headline_en:'Drought warning: water sources declining',category:'weather',
     conditions:w=>w.clock.season==='夏季', weight:2, severity:'danger',
     modifiers:{drought_chance:0.25,farm_bonus:-0.3,mood_modifier:-5}, duration:4, flavor:[t('河水水位下降很快。'),t('水井比平時更低。')]},
    {headline:t('豐沛雨水帶來好收成的希望'),headline_en:'Abundant rain brings hope for harvest',category:'weather',
     conditions:w=>['春季','夏季'].includes(w.clock.season), weight:3, severity:'good',
     modifiers:{farm_bonus:0.3}, duration:2, flavor:[t('這個季節的雨量恰到好處。')]},

    // Social/Political
    {headline:t('居民對鎮長的支持度創新高'),headline_en:'Mayor approval rating hits new high',category:'social',
     conditions:w=>{ const mayor=Object.values(w.agents).find(a=>a.job?.title===t('鎮長')); return mayor&&mayor.mood>40; }, weight:2, severity:'good',
     modifiers:{mood_modifier:5,immigration_chance:0.1}, duration:2, flavor:[t('鎮議會合作良好。')]},
    {headline:t('不滿情緒蔓延，居民要求改善'),headline_en:'Discontent spreading, residents demand change',category:'social',
     conditions:w=>{ const avg=Object.values(w.agents).filter(a=>!a.isPlayer).reduce((s,a)=>s+a.mood,0)/(Object.values(w.agents).length||1); return avg<30; }, weight:3, severity:'warning',
     modifiers:{mood_modifier:-5,departure_chance:0.15,chain_chance:0.1}, duration:3, flavor:[t('好幾位居民大聲抱怨。'),t('酒館裡的氣氛很緊張。')]},
    {headline:t('有人目擊鄰近地區的疫病'),headline_en:'Plague spotted in neighboring area',category:'health',
     conditions:w=>true, weight:1, severity:'danger',
     modifiers:{plague_chance:0.2,mood_modifier:-8,merchant_chance:-0.1}, duration:4, flavor:[t('旅人回報東方聚落正在蔓延疾病。')]},
    {headline:t('學者發現了古代遺跡的新線索'),headline_en:'Scholar discovers clues to ancient ruins',category:'discovery',
     conditions:w=>Object.values(w.agents).some(a=>a.job?.key==='researcher'), weight:2, severity:'good',
     modifiers:{research_bonus:0.3,mood_modifier:3}, duration:3, flavor:[t('古籍暗示附近藏有寶藏。'),t('破解古手稿取得突破。')]},
    {headline:t('野生動物出沒增加'),headline_en:'Wild animal sightings increasing',category:'nature',
     conditions:w=>true, weight:3, severity:'info',
     modifiers:{animal_raid_chance:0.1,gathering_bonus:0.15}, duration:2, flavor:[t('森林附近發現更多鹿和兔子。'),t('獵人回報獵物豐富。')]},
    {headline:t('遠方傳來戰爭的消息'),headline_en:'News of war from distant lands',category:'political',
     conditions:w=>w.clock.year>=1&&w.clock.day>10, weight:1, severity:'warning',
     modifiers:{raid_chance:0.1,merchant_chance:0.1,immigration_chance:0.15,mood_modifier:-3}, duration:5, flavor:[t('難民可能會來此避難。'),t('戰爭帶來危險也帶來機會。')]},
    {headline:t('節慶將至，居民期待歡慶'),headline_en:'Festival approaching, residents look forward',category:'social',
     conditions:w=>w.clock.day>=12&&w.clock.day<=14, weight:4, severity:'good',
     modifiers:{mood_modifier:8,festival_chance:0.4}, duration:2, flavor:[t('季節慶典的準備工作正在進行中。'),t('大家都很期待即將到來的慶祝活動。')]},
    {headline:t('礦坑發現新的礦脈'),headline_en:'New ore vein discovered in quarry',category:'discovery',
     conditions:w=>w.townMap?.locations?.['quarry'], weight:2, severity:'good',
     modifiers:{mining_bonus:0.25}, duration:3, flavor:[t('礦工對豐富的礦藏感到興奮。'),t('新礦脈含有高品質的金屬礦石。')]},
    {headline:t('城鎮名聲遠播，吸引新居民'),headline_en:'Town reputation grows, attracting settlers',category:'social',
     conditions:w=>Object.values(w.agents).filter(a=>!a.isPlayer).length<=10, weight:2, severity:'good',
     modifiers:{immigration_chance:0.25,mood_modifier:3}, duration:3, flavor:[t('邊境鎮繁榮的消息正在傳播。')]},
];

class NewsSystem {
    constructor() {
        this.bulletins = []; // {headline, headline_en, category, severity, flavor, modifiers, expiresDay, publishedDay, publishedTime}
        this.activeModifiers = {}; // aggregated from all active bulletins
        this._lastPublishDay = 0;
    }

    dailyUpdate(world) {
        // Expire old bulletins
        const currentDay = world.clock.year * 60 + ((['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15) + world.clock.day;
        this.bulletins = this.bulletins.filter(b => b.expiresDay > currentDay);

        // Publish 1-2 new bulletins per day
        const numNews = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < numNews; i++) {
            const bulletin = this._generateBulletin(world, currentDay);
            if (bulletin) {
                this.bulletins.push(bulletin);
                world.logMessage('news', `📰 ${bulletin.headline}`, '', '');
                // News also becomes gossip topic
                world.events.conversationTopics.push(bulletin.headline);
                if (world.events.conversationTopics.length > 8) world.events.conversationTopics = world.events.conversationTopics.slice(-8);
                // Mood effects from news
                if (bulletin.modifiers.mood_modifier) {
                    Object.values(world.agents).forEach(a => {
                        if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + Math.round(bulletin.modifiers.mood_modifier * 0.5);
                    });
                }
            }
        }

        // Rebuild active modifiers
        this._rebuildModifiers(currentDay);
        this._lastPublishDay = currentDay;
    }

    _generateBulletin(world, currentDay) {
        // Filter by conditions
        const eligible = NEWS_TEMPLATES.filter(t => {
            try { return t.conditions(world); } catch(e) { return true; }
        });
        if (!eligible.length) return null;

        // Weighted random selection
        const weights = eligible.map(t => t.weight);
        const template = weightedChoice(eligible, weights);

        const bulletin = {
            headline: template.headline,
            headline_en: template.headline_en,
            category: template.category,
            severity: template.severity,
            flavor: pickRandom(template.flavor),
            modifiers: {...template.modifiers},
            publishedDay: currentDay,
            publishedTime: world.clock.timeStr,
            expiresDay: currentDay + template.duration,
            daysRemaining: template.duration,
        };
        return bulletin;
    }

    _rebuildModifiers(currentDay) {
        this.activeModifiers = {};
        this.bulletins.forEach(b => {
            if (b.expiresDay <= currentDay) return;
            b.daysRemaining = b.expiresDay - currentDay;
            for (const [key, val] of Object.entries(b.modifiers)) {
                if (typeof val === 'number') {
                    this.activeModifiers[key] = (this.activeModifiers[key] || 0) + val;
                } else if (typeof val === 'boolean' && val) {
                    this.activeModifiers[key] = true;
                }
            }
        });
    }

    getModifier(key, defaultVal = 0) {
        return this.activeModifiers[key] ?? defaultVal;
    }

    getActiveBulletins() {
        return this.bulletins.slice().reverse();
    }

    toDict() {
        return {
            bulletins: this.bulletins.map(b => ({
                headline: b.headline,
                headline_en: b.headline_en,
                category: b.category,
                severity: b.severity,
                flavor: b.flavor,
                published_time: b.publishedTime,
                days_remaining: b.daysRemaining,
            })),
            active_modifiers: {...this.activeModifiers},
        };
    }
}
