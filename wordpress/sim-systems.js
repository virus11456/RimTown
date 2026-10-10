// RimTown - sim-systems.js：從 simulation.js 拆出的 聲望、天氣與災難、議會、每日決策、商店、事件選擇、村民求助（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。
// ============================================================
// v4.0 - Reputation System (聲望系統)
// ============================================================
const REPUTATION_TIERS = [
    { min: 0,   name:()=>t('無名之輩'), icon:'👤', desc:()=>t('剛來的外地人，沒人認識你') },
    { min: 15,  name:()=>t('新面孔'),   icon:'🙂', desc:()=>t('居民開始記住你的名字了') },
    { min: 40,  name:()=>t('可靠鄰人'), icon:'🤝', desc:()=>t('大家覺得你是可以信賴的人') },
    { min: 70,  name:()=>t('鎮之棟樑'), icon:'⭐', desc:()=>t('你已經是小鎮不可或缺的一份子') },
    { min: 100, name:()=>t('邊境英雄'), icon:'🏆', desc:()=>t('你的事蹟在邊境廣為流傳') },
    { min: 150, name:()=>t('傳奇人物'), icon:'👑', desc:()=>t('後人會在書裡讀到你的故事') },
];

class ReputationSystem {
    constructor() {
        this.reputation = 0;        // Total reputation points (synced with questSystem)
        this.sources = {};          // Track where reputation came from: { quests, decisions, help, trade, events }
        this._lastEffectTier = -1;
        this._dailyActionPoints = 0; // Track daily actions for passive rep gain
    }

    // Get current tier info
    get tier() {
        let current = REPUTATION_TIERS[0];
        for (const tier of REPUTATION_TIERS) {
            if (this.reputation >= tier.min) current = tier;
            else break;
        }
        return current;
    }

    get tierIndex() {
        let idx = 0;
        for (let i = 0; i < REPUTATION_TIERS.length; i++) {
            if (this.reputation >= REPUTATION_TIERS[i].min) idx = i;
            else break;
        }
        return idx;
    }

    get nextTier() {
        const idx = this.tierIndex;
        return idx < REPUTATION_TIERS.length - 1 ? REPUTATION_TIERS[idx + 1] : null;
    }

    // Add reputation from a specific source
    addReputation(amount, source, world) {
        if (amount === 0) return;
        this.reputation = Math.max(0, this.reputation + amount);
        if (!this.sources[source]) this.sources[source] = 0;
        this.sources[source] += amount;

        // Sync with quest system
        if (world?.questSystem) {
            world.questSystem.reputation = this.reputation;
        }

        // Check for tier up
        const newTierIdx = this.tierIndex;
        if (newTierIdx > this._lastEffectTier && this._lastEffectTier >= 0) {
            const tier = this.tier;
            world?.logMessage?.('reputation', `⭐ ${t('聲望提升！你現在是')}「${tier.icon} ${tier.name()}」— ${tier.desc()}`);
            if (world?.dailyNews) {
                world.dailyNews.collectEvent('social', `${playerTitle(world)}${t('的聲望提升為')}「${tier.name()}」！`, 7);
            }
            // Tier-up mood boost
            Object.values(world?.agents || {}).forEach(a => {
                if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 3;
            });
        }
        this._lastEffectTier = newTierIdx;
    }

    // Daily update: passive reputation & apply effects
    dailyUpdate(world) {
        // Sync FROM quest system (quests add rep directly to questSystem)
        if (world.questSystem && world.questSystem.reputation !== this.reputation) {
            const diff = world.questSystem.reputation - this.reputation;
            if (diff > 0) {
                this.reputation = world.questSystem.reputation;
                if (!this.sources['quests']) this.sources['quests'] = 0;
                this.sources['quests'] += diff;
            }
        }

        // Passive reputation from daily good deeds
        this._dailyActionPoints = 0;
        const player = world.agents?.['player'];
        if (player) {
            // Working consistently
            if (player.job) this._dailyActionPoints += 1;
            // High average affinity
            const rels = Object.values(player.relationships?.relationships || {});
            if (rels.length > 0) {
                const avgAff = rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length;
                if (avgAff > 30) this._dailyActionPoints += 1;
                if (avgAff > 60) this._dailyActionPoints += 1;
            }
        }

        // Convert daily action points to small reputation gains (slow passive growth)
        if (this._dailyActionPoints >= 2 && Math.random() < 0.3) {
            this.addReputation(1, 'daily', world);
        }

        // Apply reputation effects to game systems
        this._applyEffects(world);
    }

    // Reputation effects on game mechanics —
    // 全部效果由各系統透過 getModifier() 讀取:
    // 1. npc_initial_trust → EventSystem._spawnImmigrant(新居民初始信任)
    // 2. trade_price_bonus → TradeSystem._spawnMerchant(商人買賣價)
    // 3. immigration_bonus → EventSystem._managePopulation(移民機率)
    // 4. npc_mood_bonus   → Agent 心情計算(simulation.js Agent.update)
    // 5. event_shield     → EventSystem._rollDailyEvent(負面事件機率)
    //    shop_discount    → ShopSystem(商店折扣)
    _applyEffects(world) {}

    // Modifiers for other systems to query
    getModifier(key) {
        const tierIdx = this.tierIndex;
        switch (key) {
            case 'trade_price_bonus':
                return [0, 0.03, 0.05, 0.08, 0.12, 0.15][tierIdx] || 0;
            case 'npc_initial_trust':
                return [0, 2, 5, 8, 12, 15][tierIdx] || 0;
            case 'npc_mood_bonus':
                return [0, 0, 1, 2, 3, 5][tierIdx] || 0;
            case 'immigration_bonus':
                return [0, 0.02, 0.05, 0.08, 0.12, 0.15][tierIdx] || 0;
            case 'event_shield':
                return tierIdx >= 3 ? 0.15 : tierIdx >= 2 ? 0.08 : 0;
            case 'shop_discount':
                return [0, 0, 0.05, 0.08, 0.10, 0.15][tierIdx] || 0;
            default:
                return 0;
        }
    }

    toDict() {
        const tier = this.tier;
        const nextTier = this.nextTier;
        return {
            reputation: this.reputation,
            tierName: tier.name(),
            tierIcon: tier.icon,
            tierDesc: tier.desc(),
            tierIndex: this.tierIndex,
            nextTierName: nextTier ? nextTier.name() : null,
            nextTierMin: nextTier ? nextTier.min : null,
            progressToNext: nextTier ? Math.round(((this.reputation - tier.min) / (nextTier.min - tier.min)) * 100) : 100,
            sources: { ...this.sources },
            effects: {
                trade_bonus: `+${Math.round(this.getModifier('trade_price_bonus') * 100)}%`,
                npc_trust: `+${this.getModifier('npc_initial_trust')}`,
                mood_bonus: `+${this.getModifier('npc_mood_bonus')}`,
                shop_discount: `${Math.round(this.getModifier('shop_discount') * 100)}%`,
                event_shield: `${Math.round(this.getModifier('event_shield') * 100)}%`,
            },
        };
    }

    serialize() {
        return {
            reputation: this.reputation,
            sources: { ...this.sources },
            _lastEffectTier: this._lastEffectTier,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.reputation = data.reputation || 0;
        this.sources = data.sources || {};
        this._lastEffectTier = data._lastEffectTier ?? -1;
    }
}

// ============================================================
// v4.0 - Weather System (動態天氣引擎)
// ============================================================
const WEATHER_TYPES = {
    clear:    { name:()=>t('晴天'),   icon:'☀️', farm:0.1,  mood:2,  desc:()=>t('萬里無雲，適合工作'),     visual:'clear' },
    cloudy:   { name:()=>t('多雲'),   icon:'☁️', farm:0,    mood:0,  desc:()=>t('雲層遮住了部分陽光'),     visual:'cloudy' },
    rain:     { name:()=>t('下雨'),   icon:'🌧️', farm:0.2,  mood:-2, desc:()=>t('雨水滋潤了大地'),         visual:'rain' },
    storm:    { name:()=>t('暴風雨'), icon:'⛈️', farm:-0.2, mood:-8, desc:()=>t('狂風暴雨肆虐小鎮'),       visual:'storm' },
    snow:     { name:()=>t('下雪'),   icon:'❄️', farm:-0.3, mood:-3, desc:()=>t('白雪覆蓋了田野'),         visual:'snow' },
    blizzard: { name:()=>t('暴風雪'), icon:'🌨️', farm:-0.5, mood:-12,desc:()=>t('猛烈暴風雪，出門危險'),   visual:'blizzard' },
    fog:      { name:()=>t('大霧'),   icon:'🌫️', farm:-0.05,mood:-1, desc:()=>t('濃霧籠罩，能見度極低'),   visual:'fog' },
    heatwave: { name:()=>t('熱浪'),   icon:'🔥', farm:-0.3, mood:-10,desc:()=>t('酷熱難耐，人畜疲憊'),     visual:'heatwave' },
    drought:  { name:()=>t('乾旱'),   icon:'🏜️', farm:-0.4, mood:-8, desc:()=>t('水源枯竭，作物乾枯'),     visual:'drought' },
    wind:     { name:()=>t('強風'),   icon:'💨', farm:-0.1, mood:-3, desc:()=>t('大風不斷吹拂'),           visual:'wind' },
};

// Season → weighted weather pools: [type, weight]
const SEASON_WEATHER = {
    '春季': [['clear',3],['cloudy',3],['rain',4],['fog',2],['wind',1],['storm',0.5]],
    '夏季': [['clear',4],['cloudy',2],['rain',2],['heatwave',2],['drought',1.5],['storm',1]],
    '秋季': [['clear',2],['cloudy',3],['rain',3],['fog',3],['wind',2],['storm',1.5]],
    '冬季': [['clear',1],['cloudy',3],['snow',3],['blizzard',1],['fog',2],['wind',2],['storm',0.5]],
};

// v5.85.0 災難名稱表(任務鏈 scheduleDisaster 用)與資源中文名(損失訊息用)
const DISASTER_LABELS = { drought_severe: () => t('嚴重乾旱'), blizzard_severe: () => t('極端暴風雪'), flood: () => t('洪水'), tunnel_collapse: () => t('坑道塌方'), wildfire: () => t('山火'), caravan_raid: () => t('商隊劫案') };
const RESOURCE_NAMES_ZH = { food: '食物', wood: '木材', stone: '石材', metal: '金屬', cloth: '布料', herbs: '草藥', silver: '銀幣', tools: '工具' };

class WeatherSystem {
    constructor() {
        this.current = 'clear';       // Current weather type key
        this.duration = 1;            // How many more days this weather lasts
        this.forecast = [];           // Next 3 days forecast: [{type, day}]
        this.streak = 0;              // Consecutive days of same weather category (for drought/heatwave escalation)
        this._temperature = 20;       // Abstract temperature (affects comfort)
        this._humidity = 50;          // Affects crop water, fog chance
        this._windSpeed = 0;          // 0-100, affects storm severity
        this.disasterWarning = null;  // {type, severity, daysUntil} or null
        this.activeDisaster = null;   // {type, severity, daysLeft, effects} or null
        this._daysSinceDisaster = 10;
    }

    dailyUpdate(world) {
        const season = world.clock.season;
        this._daysSinceDisaster++;

        // Advance duration
        this.duration--;
        if (this.duration <= 0) {
            this._advanceWeather(season);
        }

        // Update environmental vars
        this._updateEnvironment(season);

        // Check for extreme weather escalation → disaster
        this._checkDisasterEscalation(world);

        // Progress active disaster
        if (this.activeDisaster) {
            this.activeDisaster.daysLeft--;
            if (this.activeDisaster.daysLeft <= 0) {
                this._endDisaster(world);
            }
        }

        // Generate forecast if empty
        while (this.forecast.length < 3) {
            this.forecast.push({ type: this._rollWeather(season), day: world.clock.day + this.forecast.length + 1 });
        }

        // Apply weather effects to game systems
        this._applyEffects(world);

        // Broadcast to daily news (significant weather only)
        this._reportWeather(world);
    }

    _rollWeather(season) {
        const pool = SEASON_WEATHER[season] || SEASON_WEATHER['春季'];
        const types = pool.map(p => p[0]);
        const weights = pool.map(p => p[1]);
        return weightedChoice(types, weights);
    }

    _advanceWeather(season) {
        // Use forecast if available, otherwise roll new
        if (this.forecast.length > 0) {
            const next = this.forecast.shift();
            const prev = this.current;
            this.current = next.type;
            // Track streak for same-category weather
            if (this.current === prev || (this._isHot(this.current) && this._isHot(prev)) || (this._isWet(this.current) && this._isWet(prev))) {
                this.streak++;
            } else {
                this.streak = 0;
            }
        } else {
            this.current = this._rollWeather(season);
            this.streak = 0;
        }
        // Duration: 1-3 days, storms and extreme weather are shorter
        const w = WEATHER_TYPES[this.current];
        if (['storm','blizzard','heatwave'].includes(this.current)) {
            this.duration = Math.random() < 0.3 ? 2 : 1;
        } else if (['drought'].includes(this.current)) {
            this.duration = 2 + Math.floor(Math.random() * 2); // 2-3 days
        } else {
            this.duration = 1 + Math.floor(Math.random() * 3); // 1-3 days
        }
    }

    _isHot(type) { return ['heatwave','drought','clear'].includes(type) && type !== 'clear'; }
    _isWet(type) { return ['rain','storm'].includes(type); }

    _updateEnvironment(season) {
        // Base temperature by season
        const seasonTemp = { '春季':18, '夏季':30, '秋季':15, '冬季':2 };
        const base = seasonTemp[season] || 18;
        const weatherMod = { clear:3, cloudy:0, rain:-2, storm:-5, snow:-8, blizzard:-15, fog:-1, heatwave:12, drought:8, wind:-3 };
        this._temperature = base + (weatherMod[this.current] || 0) + (Math.random() * 4 - 2);

        // Humidity
        const humidityMap = { clear:30, cloudy:50, rain:85, storm:90, snow:60, blizzard:55, fog:95, heatwave:15, drought:10, wind:35 };
        this._humidity = humidityMap[this.current] || 50;

        // Wind
        const windMap = { clear:10, cloudy:15, rain:30, storm:80, snow:25, blizzard:90, fog:5, heatwave:10, drought:5, wind:70 };
        this._windSpeed = windMap[this.current] || 10;
    }

    _checkDisasterEscalation(world) {
        // Drought escalation: 3+ consecutive hot days in summer
        if (this.streak >= 3 && this._isHot(this.current) && world.clock.season === '夏季' && !this.activeDisaster && this._daysSinceDisaster > 8) {
            if (world.townTheme === 'forest') { // v5.86.0 林間村:連日高溫→山火
                this.disasterWarning = { type: 'wildfire', severity: 'major', daysUntil: 1 };
                world.logMessage('weather', `⚠️ ${t('山火警報：連日高溫，伐木場的乾枝一點就著！')}`);
                this._offerPrepChoice(world, t('山火'));
            } else {
                this.disasterWarning = { type: 'drought_severe', severity: 'major', daysUntil: 1 };
                world.logMessage('weather', `⚠️ ${t('乾旱警報：連續高溫，水源告急！')}`);
                this._offerPrepChoice(world, t('嚴重乾旱'));
            }
        }
        // Blizzard escalation: extended cold in winter
        if (this.streak >= 2 && this.current === 'snow' && world.clock.season === '冬季' && !this.activeDisaster && this._daysSinceDisaster > 8) {
            this.disasterWarning = { type: 'blizzard_severe', severity: 'major', daysUntil: 1 };
            world.logMessage('weather', `⚠️ ${t('暴風雪警報：氣溫持續下降，請準備取暖物資！')}`);
            this._offerPrepChoice(world, t('猛烈暴風雪'));
        }
        // Storm escalation chance
        if (this.current === 'storm' && Math.random() < 0.3 && !this.activeDisaster && this._daysSinceDisaster > 6) {
            if (world.townTheme === 'mountain') { // v5.85.0 礦山鎮:暴雨滲水→坑道塌方
                this.disasterWarning = { type: 'tunnel_collapse', severity: 'major', daysUntil: 1 };
                world.logMessage('weather', `⚠️ ${t('塌方警報：暴雨滲進坑道，支架開始吃水！')}`);
                this._offerPrepChoice(world, t('坑道塌方'));
            } else {
                this.disasterWarning = { type: 'flood', severity: 'major', daysUntil: 0 };
                world.logMessage('weather', `⚠️ ${t('洪水警報：暴風雨導致河水暴漲！')}`);
            }
        }

        // v5.87.0 市集城:濃霧藏馬賊→商隊劫案
        if (this.current === 'fog' && world.townTheme === 'market' && Math.random() < 0.2 && !this.activeDisaster && !this.disasterWarning && this._daysSinceDisaster > 8) {
            this.disasterWarning = { type: 'caravan_raid', severity: 'major', daysUntil: 1 };
            world.logMessage('weather', `⚠️ ${t('劫案警報：濃霧裡有馬賊出沒，城外的商隊危險！')}`);
            this._offerPrepChoice(world, t('商隊劫案'));
        }

        // Trigger disaster from warning
        if (this.disasterWarning && this.disasterWarning.daysUntil <= 0) {
            this._startDisaster(this.disasterWarning.type, world);
            this.disasterWarning = null;
        } else if (this.disasterWarning) {
            this.disasterWarning.daysUntil--;
        }
    }

    // v5.85.0 任務鏈劇情觸發的主題災難:排進預警(明天來襲),一樣可以事前防災
    scheduleDisaster(type, daysUntil, world) {
        if (this.activeDisaster || !DISASTER_LABELS[type]) return false;
        this.disasterWarning = { type, severity: 'major', daysUntil: Math.max(0, daysUntil | 0) };
        world.logMessage('weather', `⚠️ ${t('災害預警：')}${DISASTER_LABELS[type]()}`);
        this._offerPrepChoice(world, DISASTER_LABELS[type]());
        return true;
    }
    // v5.85.0 任務路線化解災難:災害進行中就提前結束;還在預警就視為全面防災
    resolveDisaster(type, world) {
        if (this.activeDisaster?.type === type) { this._endDisaster(world); return true; }
        if (this.disasterWarning?.type === type) { this._prepLevel = 2; return true; }
        return false;
    }

    // v4.5.0 災害預警:給玩家防災準備選擇(明天災害來襲前)
    _offerPrepChoice(world, disasterName) {
        if (!world.eventChoice || world.eventChoice.pendingEvent) return;
        world.eventChoice.pendingEvent = {
            eventName: `${t('災害預警：')}${disasterName}`,
            description: `${disasterName}${t('預計明天來襲！現在做準備還來得及——要怎麼應對？')}`,
            severity: 'major',
            choices: [
                { label: t('全面防災'), icon: '🏗️', desc: t('花費 30 木材 + 20 食物：災害效果減半、提早一天結束'),
                  effects: { wood: -30, food: -20, disaster_prep: 2 } },
                { label: t('基本準備'), icon: '🧰', desc: t('花費 10 木材：災害效果減輕 25%'),
                  effects: { wood: -10, disaster_prep: 1 } },
                { label: t('聽天由命'), icon: '🤷', desc: t('不做任何準備'),
                  effects: { disaster_prep: 0 } },
            ],
            timestamp: world.tickCount,
        };
        world.logMessage('event_choice', `⚡ ${t('災害預警——你需要決定如何防災！')}`);
    }

    _startDisaster(type, world) {
        const disasters = {
            drought_severe: {
                name: ()=>t('嚴重乾旱'), severity:'major', daysLeft:4,
                effects: { farm:-0.5, mood:-10, water:-30, wood_consumption:0.5 },
                desc: ()=>t('水井乾涸，作物大面積枯死，居民飲水困難。'),
            },
            blizzard_severe: {
                name: ()=>t('極端暴風雪'), severity:'major', daysLeft:3,
                effects: { farm:-0.6, mood:-15, comfort:-20, wood_consumption:2.0 },
                desc: ()=>t('暴風雪封路，木材消耗加倍，居民被困室內。'),
            },
            flood: {
                name: ()=>t('洪水'), severity:'major', daysLeft:3,
                effects: { farm:-0.4, mood:-12, food_loss:0.1 },
                desc: ()=>t('河水氾濫，部分農田被淹，儲備糧食受損。'),
            },
            // v5.87.0 市集城主題災難(商隊停擺見 _caravanDaily)
            caravan_raid: {
                name: ()=>t('商隊劫案'), severity:'major', daysLeft:3,
                effects: { mood:-12, comfort:-6, resource_loss: { silver: 0.06, cloth: 0.05 }, caravan_halt: 1 },
                desc: ()=>t('駝隊在城外十里被馬賊劫了，城門緊閉、商隊停擺，市集的銀貨一天天少。'),
            },
            // v5.86.0 林間村主題災難
            wildfire: {
                name: ()=>t('山火'), severity:'major', daysLeft:3,
                effects: { farm:-0.3, mood:-15, comfort:-10, resource_loss: { wood: 0.10, herbs: 0.08 } },
                desc: ()=>t('火從伐木場的乾枝燒起，風一吹就往千年古林去，木料和藥草一天天燒掉。'),
            },
            // v5.85.0 礦山鎮主題災難
            tunnel_collapse: {
                name: ()=>t('坑道塌方'), severity:'major', daysLeft:3,
                effects: { mood:-14, comfort:-12, resource_loss: { stone: 0.08, metal: 0.06 } },
                desc: ()=>t('主礦坑第三層支架斷裂，礦車進不去，堆在坑口的礦石一車車埋進土裡。'),
            },
        };
        const d = disasters[type];
        if (!d) return;
        this.activeDisaster = { type, name: d.name(), severity: d.severity, daysLeft: d.daysLeft, effects: d.effects, desc: d.desc() };
        this._daysSinceDisaster = 0;
        world.logMessage('weather', `🚨 ${t('天災發生！')}${d.name()}：${d.desc()}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('disaster', `${d.name()}${t('來襲')}：${d.desc()}`, 10);
        }
        // 深井/淨水系統的 drought_resistance 效果:依累積抗旱值減輕乾旱(Lv1 深井 0.5 → +0.2,Lv2 淨水再 +0.3 → +0.3)
        const droughtRes = world.buildings?.getEffect?.('drought_resistance', 0) || 0;
        if (type === 'drought_severe' && droughtRes > 0) {
            world.logMessage('weather', `💧 ${t('深井發揮作用，減輕了乾旱影響！')}`);
            this.activeDisaster.effects.farm = Math.max(-0.3, this.activeDisaster.effects.farm + Math.min(0.3, droughtRes * 0.4));
        }
        // v4.5.0 玩家事前防災準備的減災效果
        const prep = this._prepLevel || 0;
        if (prep > 0) {
            const factor = prep === 2 ? 0.5 : 0.75;
            for (const k of Object.keys(this.activeDisaster.effects)) {
                if (typeof this.activeDisaster.effects[k] === 'number') this.activeDisaster.effects[k] *= factor;
            }
            if (prep === 2) this.activeDisaster.daysLeft = Math.max(1, this.activeDisaster.daysLeft - 1);
            world.logMessage('weather', prep === 2
                ? `🏗️ ${t('事前的全面防災大幅減輕了災害衝擊！')}`
                : `🧰 ${t('基本準備發揮了作用，災損有所減輕。')}`);
        }
        this._prepLevel = 0;
    }

    _endDisaster(world) {
        const name = this.activeDisaster.name;
        world.logMessage('weather', `✅ ${name}${t('已經結束，小鎮開始恢復。')}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('recovery', `${name}${t('結束，開始重建')}`, 7);
        }
        // Recovery mood boost
        Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 5; });
        this.activeDisaster = null;
    }

    _applyEffects(world) {
        const w = WEATHER_TYPES[this.current];
        if (!w) return;

        // 1. Farm bonus/penalty via news modifier system (stacks with existing)
        if (world.news) {
            // Set weather modifier (overwrites previous weather modifier)
            world.news.activeModifiers['weather_farm_bonus'] = w.farm + (this.activeDisaster?.effects?.farm || 0);
            world.news.activeModifiers['weather_mood'] = w.mood + (this.activeDisaster?.effects?.mood || 0);
        }

        // 2. Comfort penalty from extreme temperatures
        if (this._temperature < 0 || this._temperature > 38) {
            Object.values(world.agents).forEach(a => {
                if (a.needs) a.needs.comfort = Math.max(0, a.needs.comfort - (this.activeDisaster ? 8 : 3));
            });
        }

        // 3. Disaster-specific: extra wood consumption
        if (this.activeDisaster?.effects?.wood_consumption) {
            const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
            const extraWood = Math.ceil(npcCount * this.activeDisaster.effects.wood_consumption);
            if (!world.stockpile.consume('wood', extraWood, world.tickCount, this.activeDisaster.name)) {
                world.logMessage('weather', `🪵 ${t('木材嚴重不足！')}${this.activeDisaster.name}${t('讓居民受凍。')}`);
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) - 5; });
            }
        }

        // 4. Disaster-specific: food loss (flood)
        if (this.activeDisaster?.effects?.food_loss) {
            const foodLost = Math.floor(world.stockpile.get('food') * this.activeDisaster.effects.food_loss);
            if (foodLost > 0) {
                world.stockpile.consume('food', foodLost, world.tickCount, this.activeDisaster.name);
                world.logMessage('weather', `🍖 ${t('洪水沖走了')} ${foodLost} ${t('食物！')}`);
            }
        }

        // v5.85.0 Disaster-specific: themed resource loss (cave-in buries ore, …)
        if (this.activeDisaster?.effects?.resource_loss) {
            for (const [res, frac] of Object.entries(this.activeDisaster.effects.resource_loss)) {
                const lost = Math.floor((world.stockpile.get(res) || 0) * frac);
                if (lost > 0) {
                    world.stockpile.consume(res, lost, world.tickCount, this.activeDisaster.name);
                    world.logMessage('weather', `📉 ${this.activeDisaster.name}${t('損失了')} ${lost} ${t(RESOURCE_NAMES_ZH[res] || res)}`);
                }
            }
        }

        // 5. NPC activity disruption: storms/blizzards keep NPCs indoors
        if (['storm','blizzard'].includes(this.current) || this.activeDisaster) {
            Object.values(world.agents).forEach(a => {
                if (!a.isPlayer && a.activity === 'working' && Math.random() < 0.3) {
                    a.activity = 'idle';
                }
            });
        }
    }

    _reportWeather(world) {
        const w = WEATHER_TYPES[this.current];
        if (!w) return;
        // Only report significant weather changes to news
        if (['storm','blizzard','heatwave','drought','snow'].includes(this.current)) {
            if (world.dailyNews) {
                world.dailyNews.collectEvent('weather', `${w.icon} ${w.name()}：${w.desc()}`, 6);
            }
        }
    }

    // Public API for other systems
    get weatherType() { return WEATHER_TYPES[this.current]; }
    get temperature() { return Math.round(this._temperature); }
    get humidity() { return Math.round(this._humidity); }
    get windSpeed() { return Math.round(this._windSpeed); }
    get farmModifier() {
        const w = WEATHER_TYPES[this.current];
        return (w?.farm || 0) + (this.activeDisaster?.effects?.farm || 0);
    }
    get moodModifier() {
        const w = WEATHER_TYPES[this.current];
        return (w?.mood || 0) + (this.activeDisaster?.effects?.mood || 0);
    }
    get isExtreme() { return ['storm','blizzard','heatwave','drought'].includes(this.current) || !!this.activeDisaster; }

    toDict() {
        const w = WEATHER_TYPES[this.current];
        return {
            current: this.current,
            name: w?.name() || this.current,
            icon: w?.icon || '?',
            desc: w?.desc() || '',
            duration: this.duration,
            temperature: this.temperature,
            humidity: this.humidity,
            windSpeed: this.windSpeed,
            forecast: this.forecast.map(f => {
                const fw = WEATHER_TYPES[f.type];
                return { type: f.type, name: fw?.name() || f.type, icon: fw?.icon || '?' };
            }),
            farmModifier: this.farmModifier,
            moodModifier: this.moodModifier,
            isExtreme: this.isExtreme,
            disasterWarning: this.disasterWarning ? { type: this.disasterWarning.type, severity: this.disasterWarning.severity, daysUntil: this.disasterWarning.daysUntil } : null,
            activeDisaster: this.activeDisaster ? { type: this.activeDisaster.type, name: this.activeDisaster.name, desc: this.activeDisaster.desc, daysLeft: this.activeDisaster.daysLeft, severity: this.activeDisaster.severity } : null,
        };
    }

    serialize() {
        return {
            current: this.current, duration: this.duration, streak: this.streak,
            forecast: this.forecast, _temperature: this._temperature,
            _humidity: this._humidity, _windSpeed: this._windSpeed,
            disasterWarning: this.disasterWarning, activeDisaster: this.activeDisaster,
            _daysSinceDisaster: this._daysSinceDisaster,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.current = data.current || 'clear';
        this.duration = data.duration || 1;
        this.streak = data.streak || 0;
        this.forecast = data.forecast || [];
        this._temperature = data._temperature ?? 20;
        this._humidity = data._humidity ?? 50;
        this._windSpeed = data._windSpeed ?? 0;
        this.disasterWarning = data.disasterWarning || null;
        this.activeDisaster = data.activeDisaster || null;
        this._daysSinceDisaster = data._daysSinceDisaster ?? 10;
    }
}

// ============================================================
// v4.0 - Council System (NPC 議會治理系統)
// ============================================================
const COUNCIL_PROPOSALS = [
    { id:'tax_trade', title:()=>t('提高商人稅收'), desc:()=>t('對來往商人收取更高稅金，增加收入但減少商人到訪。'),
      effects:{ silver:20, merchant_chance:-0.1, mood_traders:-5 }, category:'economy', minRep:15 },
    { id:'food_reserve', title:()=>t('建立糧食儲備制度'), desc:()=>t('每日扣留部分糧食作為儲備，減少消耗但降低滿意度。'),
      effects:{ food_save:0.1, mood_all:-2 }, category:'welfare', minRep:0 },
    { id:'festival_fund', title:()=>t('設立慶典基金'), desc:()=>t('每季撥銀幣舉辦慶典，提升全鎮心情。'),
      effects:{ silver:-30, mood_all:10, festival_chance:0.3 }, category:'culture', minRep:20 },
    { id:'night_patrol', title:()=>t('夜間巡邏制度'), desc:()=>t('安排守衛夜間巡邏，降低突襲機率但守衛更疲勞。'),
      effects:{ raid_chance:-0.08, guard_fatigue:true }, category:'defense', minRep:15 },
    { id:'open_borders', title:()=>t('開放邊境政策'), desc:()=>t('歡迎外來移民，加速人口增長但可能帶來衝突。'),
      effects:{ immigration_chance:0.2, mood_all:-3, chain_chance:0.03 }, category:'welfare', minRep:30 },
    { id:'research_grant', title:()=>t('學術研究補助'), desc:()=>t('投入資源支持研究，加速科技發展。'),
      effects:{ silver:-20, research_bonus:0.25 }, category:'culture', minRep:25 },
    { id:'trade_route', title:()=>t('開拓新貿易路線'), desc:()=>t('派商人探索新路線，短期花費大但長期增加貿易機會。'),
      effects:{ silver:-40, merchant_chance:0.2, sell_bonus:0.1 }, category:'economy', minRep:40 },
    { id:'herb_garden_public', title:()=>t('公共藥草園'), desc:()=>t('開闢公共藥草園，增加草藥產量。'),
      effects:{ herbs:5, mood_all:2 }, category:'welfare', minRep:10 },
    { id:'military_training', title:()=>t('全民防禦訓練'), desc:()=>t('所有居民接受基本防禦訓練，提升防禦但耗費時間。'),
      effects:{ defense_bonus:3, mood_all:-4 }, category:'defense', minRep:35 },
    { id:'nature_preserve', title:()=>t('自然保護區'), desc:()=>t('劃設保護區，提升採集效率和居民心情。'),
      effects:{ gathering_bonus:0.2, mood_all:3, farm_bonus:-0.05 }, category:'nature', minRep:20 },
    { id:'artisan_market', title:()=>t('工匠市集日'), desc:()=>t('每季舉辦工匠市集，促進手工業發展。'),
      effects:{ silver:15, mood_all:5, tools:3 }, category:'economy', minRep:30 },
    { id:'water_management', title:()=>t('水利工程'), desc:()=>t('修建灌溉水渠，大幅提升農業產量。'),
      effects:{ wood:-20, stone:-15, farm_bonus:0.25 }, category:'economy', minRep:50 },
];

class CouncilSystem {
    constructor() {
        this.members = [];          // agentId[] — council NPCs (3-5 members)
        this.pendingProposal = null; // {proposal, proposerId, proposerName, votes:{agentId:'for'|'against'}, daysLeft}
        this.activeDecrees = [];    // [{id, title, effects, expiresDay}]
        this.proposalLog = [];      // past proposals
        this._daysSinceProposal = 0;
        this._daysSinceCouncilCheck = 0;
        this._formed = false;
    }

    dailyUpdate(world) {
        this._daysSinceProposal++;
        this._daysSinceCouncilCheck++;

        // Try to form council if not yet formed (requires 6+ NPCs)
        if (!this._formed) {
            const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
            if (npcCount >= 6 && this._daysSinceCouncilCheck >= 5) {
                this._formCouncil(world);
                this._daysSinceCouncilCheck = 0;
            }
            if (!this._formed) return;
        }

        // Expire old decrees
        const currentDay = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;
        this.activeDecrees = this.activeDecrees.filter(d => d.expiresDay > currentDay);

        // Apply active decree effects
        this._applyDecreeEffects(world);

        // Clean up members who left the town
        this.members = this.members.filter(id => world.agents[id]);
        if (this.members.length < 2) {
            this._formed = false;
            this.pendingProposal = null;
            return;
        }

        // Process pending proposal voting
        if (this.pendingProposal) {
            this.pendingProposal.daysLeft--;
            this._processVotes(world);
            if (this.pendingProposal.daysLeft <= 0) {
                this._resolveProposal(world);
            }
            return;
        }

        // Generate new proposal every 7-12 days
        if (this._daysSinceProposal >= 7 + Math.floor(Math.random() * 6)) {
            this._generateProposal(world);
        }
    }

    _formCouncil(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (npcs.length < 6) return;

        // Select council members: prefer older, higher-skilled, higher-affinity NPCs
        const scored = npcs.map(a => {
            let score = 0;
            if (a.age >= 35) score += 3;
            if (a.age >= 45) score += 2;
            score += (a.skills?.skills?.社交?.level || 0) * 2;
            score += (a.mood + 50) / 25;
            if (a.personality.traits.includes('hardworking')) score += 2;
            if (a.personality.traits.includes('kind')) score += 2;
            if (a.personality.traits.includes('lazy')) score -= 3;
            if (a.personality.traits.includes('abrasive')) score -= 2;
            if (a.job?.key === 'mayor') score += 5;
            score += Math.random() * 4;
            return { agent: a, score };
        }).sort((a, b) => b.score - a.score);

        const size = Math.min(5, Math.max(3, Math.floor(npcs.length / 3)));
        this.members = scored.slice(0, size).map(s => s.agent.agentId);
        this._formed = true;

        const names = this.members.map(id => world.agents[id]?.name).filter(Boolean).join(t('、'));
        world.logMessage('council', `🏛️ ${t('議會成立！成員：')}${names}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('小鎮議會正式成立，成員有')}${names}`, 8);
        }
    }

    _generateProposal(world) {
        const rep = world.reputationSystem?.reputation || 0;
        const eligible = COUNCIL_PROPOSALS.filter(p => {
            // Check reputation requirement
            if (p.minRep > rep) return false;
            // Don't repeat recently passed proposals
            const recent = this.proposalLog.slice(-10);
            if (recent.some(r => r.id === p.id && r.passed)) return false;
            return true;
        });
        if (!eligible.length) return;

        const proposal = pickRandom(eligible);
        const proposer = pickRandom(this.members);
        const proposerAgent = world.agents[proposer];

        this.pendingProposal = {
            id: proposal.id,
            title: proposal.title(),
            desc: proposal.desc(),
            effects: proposal.effects,
            category: proposal.category,
            proposerId: proposer,
            proposerName: proposerAgent?.name || '?',
            votes: {},  // agentId → 'for' | 'against'
            daysLeft: 3,
            playerVoted: false,
        };
        this._daysSinceProposal = 0;

        world.logMessage('council', `🏛️ ${proposerAgent?.name || '?'}${t('提出議案：')}${proposal.title()}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('議會提案：')}${proposal.title()}`, 6);
        }
    }

    _processVotes(world) {
        if (!this.pendingProposal) return;
        for (const memberId of this.members) {
            if (this.pendingProposal.votes[memberId]) continue; // Already voted
            if (Math.random() > 0.5) continue; // Not voting today
            const agent = world.agents[memberId];
            if (!agent) continue;

            // NPC voting logic based on personality
            let forScore = 0;
            const effects = this.pendingProposal.effects;
            const cat = this.pendingProposal.category;

            // Policy alignment from election policies
            for (const policy of ELECTION_POLICIES) {
                if (policy.id === cat) {
                    for (const v of agent.personality.values) { if (policy.values.includes(v)) forScore += 3; }
                    for (const tr of agent.personality.traits) { if (policy.traits.includes(tr)) forScore += 2; }
                }
            }

            // React to negative effects
            if (effects.mood_all && effects.mood_all < 0) forScore -= 2;
            if (effects.mood_all && effects.mood_all > 0) forScore += 2;
            if (effects.silver && effects.silver < 0) forScore -= 1;
            if (effects.silver && effects.silver > 0) forScore += 1;

            // Proposer affinity matters
            const rel = agent.relationships?.relationships?.[this.pendingProposal.proposerId];
            if (rel) forScore += (rel.affinity / 100) * 5;

            // Random factor
            forScore += (Math.random() - 0.3) * 4;

            this.pendingProposal.votes[memberId] = forScore >= 0 ? 'for' : 'against';
        }
    }

    // Player votes on the current proposal
    playerVote(choice) {
        if (!this.pendingProposal || this.pendingProposal.playerVoted) return false;
        this.pendingProposal.votes['player'] = choice; // 'for' or 'against'
        this.pendingProposal.playerVoted = true;
        return true;
    }

    _resolveProposal(world) {
        if (!this.pendingProposal) return;
        const p = this.pendingProposal;

        // Count votes
        const forVotes = Object.values(p.votes).filter(v => v === 'for').length;
        const againstVotes = Object.values(p.votes).filter(v => v === 'against').length;
        const totalVotes = forVotes + againstVotes;
        const passed = forVotes > againstVotes;

        if (passed) {
            // Apply immediate resource effects
            const sp = world.stockpile;
            if (p.effects.silver && p.effects.silver > 0) sp.add('silver', p.effects.silver, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.silver && p.effects.silver < 0) sp.consume('silver', Math.abs(p.effects.silver), world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.food_save) { /* passive effect via decree */ }
            if (p.effects.herbs) sp.add('herbs', p.effects.herbs, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.tools) sp.add('tools', p.effects.tools, world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.wood && p.effects.wood < 0) sp.consume('wood', Math.abs(p.effects.wood), world.tickCount, `${t('議會決議')}：${p.title}`);
            if (p.effects.stone && p.effects.stone < 0) sp.consume('stone', Math.abs(p.effects.stone), world.tickCount, `${t('議會決議')}：${p.title}`);

            // Mood effects
            if (p.effects.mood_all) {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + p.effects.mood_all; });
            }

            // Register as active decree (modifier effects last 20 days)
            const currentDay = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;
            this.activeDecrees.push({
                id: p.id, title: p.title, effects: p.effects, expiresDay: currentDay + 20,
            });

            // Reputation gain for passing proposals
            if (world.reputationSystem) world.reputationSystem.addReputation(3, 'council', world);

            world.logMessage('council', `✅ ${t('議會通過：')}${p.title}（${forVotes}${t(' 票贊成 / ')}${againstVotes}${t(' 票反對）')}`);
        } else {
            world.logMessage('council', `❌ ${t('議會否決：')}${p.title}（${forVotes}${t(' 票贊成 / ')}${againstVotes}${t(' 票反對）')}`);
        }

        if (world.dailyNews) {
            world.dailyNews.collectEvent('politics', `${t('議會')}${passed ? t('通過') : t('否決')}${t('了')}「${p.title}」（${forVotes}:${againstVotes}）`, 7);
        }

        this.proposalLog.push({ id: p.id, title: p.title, passed, forVotes, againstVotes, totalVotes });
        if (this.proposalLog.length > 30) this.proposalLog = this.proposalLog.slice(-30);
        this.pendingProposal = null;
    }

    _applyDecreeEffects(world) {
        // Aggregate all active decree modifiers into news system
        for (const decree of this.activeDecrees) {
            const e = decree.effects;
            if (e.merchant_chance && world.news) world.news.activeModifiers['council_merchant'] = (world.news.activeModifiers['council_merchant'] || 0) + e.merchant_chance;
            if (e.raid_chance && world.news) world.news.activeModifiers['council_raid'] = (world.news.activeModifiers['council_raid'] || 0) + e.raid_chance;
            if (e.immigration_chance && world.news) world.news.activeModifiers['council_immigration'] = (world.news.activeModifiers['council_immigration'] || 0) + e.immigration_chance;
            if (e.research_bonus && world.news) world.news.activeModifiers['council_research'] = (world.news.activeModifiers['council_research'] || 0) + e.research_bonus;
            if (e.farm_bonus && world.news) world.news.activeModifiers['council_farm'] = (world.news.activeModifiers['council_farm'] || 0) + e.farm_bonus;
            if (e.gathering_bonus && world.news) world.news.activeModifiers['council_gathering'] = (world.news.activeModifiers['council_gathering'] || 0) + e.gathering_bonus;
            if (e.sell_bonus && world.news) world.news.activeModifiers['council_sell'] = (world.news.activeModifiers['council_sell'] || 0) + e.sell_bonus;
            if (e.defense_bonus && world.news) world.news.activeModifiers['council_defense'] = (world.news.activeModifiers['council_defense'] || 0) + e.defense_bonus;
            if (e.festival_chance && world.news) world.news.activeModifiers['council_festival'] = (world.news.activeModifiers['council_festival'] || 0) + e.festival_chance;
        }
    }

    toDict() {
        return {
            formed: this._formed,
            members: [...this.members],
            memberNames: [], // populated in getState
            pendingProposal: this.pendingProposal ? {
                id: this.pendingProposal.id, title: this.pendingProposal.title,
                desc: this.pendingProposal.desc, category: this.pendingProposal.category,
                proposerName: this.pendingProposal.proposerName,
                votes: { ...this.pendingProposal.votes },
                daysLeft: this.pendingProposal.daysLeft,
                playerVoted: this.pendingProposal.playerVoted,
                forCount: Object.values(this.pendingProposal.votes).filter(v => v === 'for').length,
                againstCount: Object.values(this.pendingProposal.votes).filter(v => v === 'against').length,
            } : null,
            activeDecrees: this.activeDecrees.map(d => ({ id:d.id, title:d.title })),
            proposalLog: this.proposalLog.slice(-10),
        };
    }

    serialize() {
        return {
            members: [...this.members],
            pendingProposal: this.pendingProposal,
            activeDecrees: this.activeDecrees,
            proposalLog: this.proposalLog,
            _daysSinceProposal: this._daysSinceProposal,
            _daysSinceCouncilCheck: this._daysSinceCouncilCheck,
            _formed: this._formed,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.members = data.members || [];
        this.pendingProposal = data.pendingProposal || null;
        this.activeDecrees = data.activeDecrees || [];
        this.proposalLog = data.proposalLog || [];
        this._daysSinceProposal = data._daysSinceProposal || 0;
        this._daysSinceCouncilCheck = data._daysSinceCouncilCheck || 0;
        this._formed = data._formed || false;
    }
}

// ============================================================
// v4.0 - Daily Decision System (每日決策卡片)
// ============================================================
const DAILY_DECISIONS = [
    // 請託型框架：村民來找你商量、求助、請你幫忙
    { id:'water_dispute', title:()=>t('農夫的煩惱'), desc:()=>t('農夫氣沖沖地跑來找你抱怨：「工坊把水都搶走了，我的田快乾死了！你能幫我跟鐵匠說說嗎？」'),
      optionA:{label:()=>t('幫農夫說情'), effects:{food:15,moodTarget:'farmer',moodAmt:5,moodOther:'blacksmith',moodOtherAmt:-3}, desc:()=>t('+15食物，農夫開心，鐵匠不滿')},
      optionB:{label:()=>t('勸他體諒工坊'), effects:{tools:5,moodTarget:'blacksmith',moodAmt:5,moodOther:'farmer',moodOtherAmt:-3}, desc:()=>t('+5工具，鐵匠開心，農夫不滿')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='farmer') && Object.values(w.agents).some(a=>a.job?.key==='blacksmith') },
    { id:'food_surplus', title:()=>t('吃不完的食物'), desc:()=>t('你經過倉庫，發現食物堆得滿出來了。鄰居湊過來問：「這麼多吃的，要不要辦個聚餐啊？」'),
      optionA:{label:()=>t('張羅聚餐'), effects:{food:-30,mood_all:8}, desc:()=>t('-30食物，全鎮心情+8')},
      optionB:{label:()=>t('建議拿去賣'), effects:{food:0,silver:20}, desc:()=>t('賣掉多餘的食物，+20銀幣')},
      condition: w => w.stockpile.get('food') > 100 },
    { id:'traveler_arrived', title:()=>t('路邊的旅人'), desc:()=>t('你在鎮口遇到一個疲憊的旅人，他向你搭話：「請問⋯⋯這裡能找到吃的和住的地方嗎？」'),
      optionA:{label:()=>t('帶他去安頓'), effects:{food:-10,silver:-5,mood_all:5,reputation:3}, desc:()=>t('-10食物-5銀幣，全鎮心情+5，聲望+3')},
      optionB:{label:()=>t('指個方向就好'), effects:{mood_all:-2}, desc:()=>t('全鎮心情-2，但保住資源')},
      condition: w => w.stockpile.get('food') > 20 },
    { id:'mine_danger', title:()=>t('礦工的擔憂'), desc:()=>t('礦工下工後攔住你：「裡面的支架裂了好幾根，我怕再挖下去會塌⋯⋯你覺得該跟上面說嗎？」'),
      optionA:{label:()=>t('陪他去反映'), effects:{wood:-15,stone:-10,moodTarget:'miner',moodAmt:8}, desc:()=>t('-15木材-10石材，礦工安心')},
      optionB:{label:()=>t('安慰他沒事的'), effects:{metal:10,moodTarget:'miner',moodAmt:-10}, desc:()=>t('+10金屬，但礦工士氣低落')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='miner') },
    { id:'merchant_deal', title:()=>t('商人的暗示'), desc:()=>t('商人趙霞悄悄拉你到一旁：「我手上有批好東西，算你便宜，有興趣嗎？」'),
      optionA:{label:()=>t('掏錢買下'), effects:{silver:-30,random_reward:true}, desc:()=>t('-30銀幣，有機會獲得稀有物資')},
      optionB:{label:()=>t('搖頭婉拒'), effects:{moodTarget:'trader',moodAmt:-3}, desc:()=>t('商人略顯失望')},
      condition: w => w.stockpile.get('silver') >= 30 },
    { id:'sick_npc', title:()=>t('鄰居的求助'), desc:()=>t('隔壁鄰居敲你的門，滿臉焦急：「我家人發燒了，你手邊有草藥嗎？拜託幫幫忙⋯⋯」'),
      optionA:{label:()=>t('拿草藥過去'), effects:{herbs:-5,mood_all:3,moodTarget:'doctor',moodAmt:5}, desc:()=>t('-5草藥，醫生有成就感')},
      optionB:{label:()=>t('建議多休息就好'), effects:{mood_all:-3}, desc:()=>t('全鎮有點擔心')},
      condition: w => w.stockpile.get('herbs') >= 5 && Object.values(w.agents).some(a=>a.job?.key==='doctor') },
    { id:'festival_plan', title:()=>t('酒館裡的提議'), desc:()=>t('你在酒館喝酒時，有人站起來喊：「最近大家太悶了，一起辦個慶典吧！」所有人看向你等你表態。'),
      optionA:{label:()=>t('舉手贊成'), effects:{food:-20,silver:-10,mood_all:12}, desc:()=>t('-20食物-10銀幣，全鎮大幅開心')},
      optionB:{label:()=>t('搖搖頭算了'), effects:{mood_all:-2}, desc:()=>t('居民有些失望')},
      condition: w => w.stockpile.get('food') > 40 && w.stockpile.get('silver') > 10 },
    { id:'guard_patrol', title:()=>t('守衛的商量'), desc:()=>t('守衛巡邏經過你家門口，停下來跟你聊：「最近夜裡不太平，我想多巡幾圈，你覺得呢？」'),
      optionA:{label:()=>t('主動幫忙望風'), effects:{moodTarget:'guard',moodAmt:5,mood_all:3,defense:2}, desc:()=>t('守衛積極，全鎮安心+3')},
      optionB:{label:()=>t('覺得還好吧'), effects:{moodTarget:'guard',moodAmt:-3}, desc:()=>t('守衛有些不滿')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='guard') },
    { id:'library_debate', title:()=>t('書房裡的爭執'), desc:()=>t('你路過書房，研究員和牧師正為一本古書吵得面紅耳赤。看到你進來，兩人同時問：「你說，到底誰說得對？」'),
      optionA:{label:()=>t('覺得研究員有理'), effects:{research_points:10,moodTarget:'researcher',moodAmt:8,moodOther:'priest',moodOtherAmt:-5}, desc:()=>t('+10研究點，研究員開心')},
      optionB:{label:()=>t('覺得牧師有理'), effects:{mood_all:3,moodTarget:'priest',moodAmt:8,moodOther:'researcher',moodOtherAmt:-5}, desc:()=>t('全鎮心情+3，牧師開心')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='researcher') && Object.values(w.agents).some(a=>a.job?.key==='priest') },
    { id:'crop_choice', title:()=>t('田邊的閒聊'), desc:()=>t('農夫蹲在田邊嘆氣，看到你走過來就問：「這季不知道該種什麼，你覺得種值錢的好還是種糧食穩？」'),
      optionA:{label:()=>t('建議種經濟作物'), effects:{silver:15,food:-5}, desc:()=>t('+15銀幣，但食物稍減')},
      optionB:{label:()=>t('建議種糧食'), effects:{food:20}, desc:()=>t('+20食物，穩扎穩打')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='farmer') },
    { id:'npc_conflict', title:()=>t('街上的吵架'), desc:()=>t('兩個居民在街上吵了起來，越吵越兇。旁邊的人推了推你：「你跟他們都熟，去勸勸唄？」'),
      optionA:{label:()=>t('上前調解'), effects:{mood_all:3,social_boost:5}, desc:()=>t('全鎮關係改善')},
      optionB:{label:()=>t('假裝沒看到'), effects:{mood_all:-2}, desc:()=>t('有人覺得你太冷漠')},
      condition: w => true },
    { id:'woodcutter_rest', title:()=>t('木匠的訴苦'), desc:()=>t('木匠拎著酒壺坐在你旁邊嘆氣：「最近累得不行，真想休一天⋯⋯但又怕木材不夠用。你說我該怎麼辦？」'),
      optionA:{label:()=>t('叫他好好休息'), effects:{moodTarget:'carpenter',moodAmt:10,wood:-5}, desc:()=>t('木匠感激，但今天少產木材')},
      optionB:{label:()=>t('鼓勵他再撐一下'), effects:{wood:5,moodTarget:'carpenter',moodAmt:-5}, desc:()=>t('+5木材，但木匠累了')},
      condition: w => Object.values(w.agents).some(a=>a.job?.key==='carpenter') },
];

class DailyDecisionSystem {
    constructor() {
        this.pendingDecision = null;  // Current decision waiting for player
        this.decisionLog = [];        // Past decisions
        this._lastDecisionDay = 0;
    }

    dailyUpdate(world) {
        const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        if (this._lastDecisionDay === dayKey) return;
        if (this.pendingDecision) return; // Don't generate new if one is pending

        this._lastDecisionDay = dayKey;

        // Filter eligible decisions
        const eligible = DAILY_DECISIONS.filter(d => !d.condition || d.condition(world));
        if (eligible.length === 0) return;

        // Avoid repeating recent decisions
        const recentIds = this.decisionLog.slice(-5).map(d => d.id);
        const fresh = eligible.filter(d => !recentIds.includes(d.id));
        const pool = fresh.length > 0 ? fresh : eligible;

        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.pendingDecision = {
            id: chosen.id,
            title: chosen.title(),
            desc: chosen.desc(),
            optionA: { label: chosen.optionA.label(), desc: chosen.optionA.desc(), effects: chosen.optionA.effects },
            optionB: { label: chosen.optionB.label(), desc: chosen.optionB.desc(), effects: chosen.optionB.effects },
            dayKey: dayKey,
        };

        world.logMessage('decision', `💬 ${t('有人找你商量')}：${this.pendingDecision.title}`);
    }

    resolveDecision(choice, world) {
        if (!this.pendingDecision) return null;
        const decision = this.pendingDecision;
        const effects = choice === 'A' ? decision.optionA.effects : decision.optionB.effects;
        const label = choice === 'A' ? decision.optionA.label : decision.optionB.label;

        // Apply effects
        const sp = world.stockpile;
        const resourceKeys = ['food','wood','stone','metal','silver','tools','herbs','cloth','research_points'];
        for (const key of resourceKeys) {
            if (effects[key]) {
                if (effects[key] > 0) sp.add(key, effects[key], world.tickCount, `${t('決策')}：${decision.title}`);
                else sp.consume(key, Math.abs(effects[key]), world.tickCount, `${t('決策')}：${decision.title}`);
            }
        }

        // Mood effects
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }
        if (effects.moodTarget) {
            const targets = Object.values(world.agents).filter(a => a.job?.key === effects.moodTarget);
            targets.forEach(a => { a.moodModifier = (a.moodModifier || 0) + (effects.moodAmt || 0); });
        }
        if (effects.moodOther) {
            const others = Object.values(world.agents).filter(a => a.job?.key === effects.moodOther);
            others.forEach(a => { a.moodModifier = (a.moodModifier || 0) + (effects.moodOtherAmt || 0); });
        }

        // Random reward
        if (effects.random_reward) {
            const rewards = [{r:'metal',a:15},{r:'cloth',a:10},{r:'herbs',a:10},{r:'silver',a:40},{r:'tools',a:8}];
            const reward = rewards[Math.floor(Math.random() * rewards.length)];
            sp.add(reward.r, reward.a, world.tickCount, t('商人交易'));
            world.logMessage('decision', `💰 ${t('交易獲得了')} ${reward.a} ${t(reward.r)}！`);
        }

        // Social boost
        if (effects.social_boost) {
            Object.values(world.agents).forEach(a => { a.needs.social = Math.min(100, a.needs.social + effects.social_boost); });
        }

        // Reputation effects
        if (effects.reputation && world.reputationSystem) {
            world.reputationSystem.addReputation(effects.reputation, 'decisions', world);
        }

        world.logMessage('decision', `💬 ${t('你決定')}「${label}」`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('social', `${decision.title} → ${label}`, 4);
        }

        this.decisionLog.push({ id: decision.id, choice, dayKey: decision.dayKey, title: decision.title });
        if (this.decisionLog.length > 100) this.decisionLog = this.decisionLog.slice(-100);

        // v4.5.0 延遲後果:3 天後村民回來道謝或抱怨(依選項效果傾向加權)
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        if (npcs.length) {
            const follow = npcs[Math.floor(Math.random() * npcs.length)];
            const positive = (effects.mood_all || 0) > 0 || (effects.reputation || 0) > 0 || effects.social_boost;
            this.followups = this.followups || [];
            this.followups.push({
                dueTick: world.tickCount + 288, // 3 遊戲日
                npc: follow.name,
                title: decision.title,
                choiceLabel: label,
                good: Math.random() < (positive ? 0.78 : 0.45),
            });
        }
        this.pendingDecision = null;
        return { title: decision.title, choice: label };
    }

    // v4.5.0 每日結算延遲後果(由 World.tick 的 dailyUpdate 呼叫)
    processFollowups(world) {
        if (!this.followups?.length) return;
        this.followups = this.followups.filter(f => {
            if (world.tickCount < f.dueTick) return true;
            if (f.good) {
                world.stockpile.add('silver', 15, world.tickCount, t('村民答謝'), 'player');
                if (world.reputationSystem) world.reputationSystem.addReputation(2, 'decisions', world);
                world.logMessage('relationship', `💝 ${f.npc}${t('特地回來道謝：「上次「')}${f.title}${t('」的事，多虧你決定「')}${f.choiceLabel}${t('」，現在順利多了！」(+15 銀幣、+2 聲望)')}`, f.npc);
                if (world.dailyNews) world.dailyNews.collectEvent('social', `${f.npc}${t('公開感謝')}${playerTitle(world)}${t('當初的決定')}`, 6, [f.npc]);
            } else {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) - 2; });
                world.logMessage('drama', `😤 ${f.npc}${t('抱怨：「上次「')}${f.title}${t('」你決定「')}${f.choiceLabel}${t('」，結果根本沒解決問題…」(全鎮心情 -2)')}`, f.npc);
                if (world.dailyNews) world.dailyNews.collectEvent('social', `${f.npc}${t('對')}${playerTitle(world)}${t('先前的決策表達不滿')}`, 5, [f.npc]);
            }
            return false;
        });
    }

    toDict() {
        return {
            pendingDecision: this.pendingDecision,
            recentDecisions: this.decisionLog.slice(-10),
        };
    }

    serialize() {
        return {
            pendingDecision: this.pendingDecision,
            decisionLog: this.decisionLog,
            _lastDecisionDay: this._lastDecisionDay,
            followups: this.followups || [],
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.pendingDecision = data.pendingDecision || null;
        this.decisionLog = data.decisionLog || [];
        this.followups = data.followups || [];
        this._lastDecisionDay = data._lastDecisionDay || 0;
    }
}

// ============================================================
// v4.0 - Shop System (商店系統)
// ============================================================
const SHOP_ITEMS = {
    food:       { name:()=>t('食物'), icon:'🍖', buyPrice:3,  sellPrice:1, category:'basic' },
    meals:      { name:()=>t('餐食'), icon:'🍲', buyPrice:5,  sellPrice:2, category:'basic' },
    wood:       { name:()=>t('木材'), icon:'🪵', buyPrice:4,  sellPrice:2, category:'basic' },
    stone:      { name:()=>t('石材'), icon:'🪨', buyPrice:5,  sellPrice:2, category:'basic' },
    metal:      { name:()=>t('金屬'), icon:'⛓️', buyPrice:8,  sellPrice:4, category:'basic' },
    tools:      { name:()=>t('工具'), icon:'🔧', buyPrice:12, sellPrice:6, category:'craft' },
    herbs:      { name:()=>t('草藥'), icon:'🌿', buyPrice:6,  sellPrice:3, category:'craft' },
    cloth:      { name:()=>t('布料'), icon:'🧵', buyPrice:7,  sellPrice:3, category:'craft' },
    medicine:   { name:()=>t('藥品'), icon:'💊', buyPrice:15, sellPrice:8, category:'craft' },
    clothing:   { name:()=>t('衣物'), icon:'👕', buyPrice:10, sellPrice:5, category:'craft' },
    furniture:  { name:()=>t('傢俱'), icon:'🪑', buyPrice:14, sellPrice:7, category:'luxury' },
    bread:      { name:()=>t('麵包'), icon:'🍞', buyPrice:6,  sellPrice:3, category:'processed' },
    beer:       { name:()=>t('啤酒'), icon:'🍺', buyPrice:8,  sellPrice:4, category:'processed' },
    wine:       { name:()=>t('葡萄酒'), icon:'🍷', buyPrice:15, sellPrice:8, category:'luxury' },
};

class ShopSystem {
    constructor() {
        this.transactionLog = [];
    }

    getAvailableItems(world) {
        return Object.entries(SHOP_ITEMS).map(([key, item]) => ({
            key, name: item.name(), icon: item.icon,
            buyPrice: item.buyPrice, sellPrice: item.sellPrice,
            category: item.category,
            stock: world.stockpile.get(key),
            canBuy: world.stockpile.get('silver') >= item.buyPrice,
            canSell: world.stockpile.get(key) >= 1,
        }));
    }

    buy(itemKey, amount, world) {
        const item = SHOP_ITEMS[itemKey];
        if (!item) return { success: false, msg: t('商品不存在') };
        // Apply reputation shop discount
        const discount = world.reputationSystem ? world.reputationSystem.getModifier('shop_discount') : 0;
        const discountedPrice = Math.max(1, Math.round(item.buyPrice * (1 - discount)));
        const totalCost = discountedPrice * amount;
        if (!world.stockpile.has('silver', totalCost)) return { success: false, msg: t('銀幣不足') };
        world.stockpile.consume('silver', totalCost, world.tickCount, `${t('購買')}${item.name()}`);
        world.stockpile.add(itemKey, amount, world.tickCount, `${t('商店購買')}`, 'player');
        this.transactionLog.push({ type: 'buy', item: itemKey, amount, cost: totalCost, tick: world.tickCount });
        const discountText = discount > 0 ? ` (${t('聲望折扣')} ${Math.round(discount*100)}%)` : '';
        world.logMessage('economy', `🛒 ${t('購買了')} ${amount} ${item.name()}${t('，花費')} ${totalCost} ${t('銀幣')}${discountText}`);
        return { success: true, msg: `${t('購買成功')}！` };
    }

    sell(itemKey, amount, world) {
        const item = SHOP_ITEMS[itemKey];
        if (!item) return { success: false, msg: t('商品不存在') };
        if (!world.stockpile.has(itemKey, amount)) return { success: false, msg: t('庫存不足') };
        const totalIncome = item.sellPrice * amount;
        world.stockpile.consume(itemKey, amount, world.tickCount, `${t('出售')}${item.name()}`);
        world.stockpile.add('silver', totalIncome, world.tickCount, `${t('商店出售')}`, 'player');
        this.transactionLog.push({ type: 'sell', item: itemKey, amount, income: totalIncome, tick: world.tickCount });
        world.logMessage('economy', `💰 ${t('出售了')} ${amount} ${item.name()}${t('，獲得')} ${totalIncome} ${t('銀幣')}`);
        return { success: true, msg: `${t('出售成功')}！` };
    }

    toDict() {
        return { recentTransactions: this.transactionLog.slice(-20) };
    }

    serialize() { return { transactionLog: this.transactionLog }; }
    loadFrom(data) { if (data) this.transactionLog = data.transactionLog || []; }
}

// ============================================================
// v4.0 - Event Choice System (事件選擇分支)
// ============================================================
class EventChoiceSystem {
    constructor() {
        this.pendingEvent = null;
        this.eventLog = [];
    }

    // Called when an event fires — wraps it with player choices
    offerChoice(event, world) {
        if (this.pendingEvent) return; // One at a time

        const choices = this._generateChoices(event, world);
        if (!choices) return; // No choices for this event type

        // v5.36.0 敘事修正:玩家是旅人不是鎮長——全鎮大事改為「現任鎮長來徵詢你的意見」
        // v5.38.0 若玩家已當選鎮長,改回鎮長視角:鎮民等你拿主意
        const playerIsMayor = world.agents['player']?.job?.key === 'mayor';
        if (playerIsMayor) {
            this.pendingEvent = {
                eventName: event.name,
                description: `${event.description}${t('身為鎮長,全鎮都在等你拿主意。')}`,
                severity: event.severity,
                choices: choices,
                timestamp: world.tickCount,
            };
            world.logMessage('event_choice', `⚡ ${event.name}${t('——鎮民都在等鎮長的決定!')}`);
            return;
        }
        const mayor = Object.values(world.agents).find(a => !a.isPlayer && !a.isDead && a.job?.key === 'mayor');
        const asker = mayor ? mayor.name : t('鎮長');
        // v5.47.0 BUG-04:徵詢開場加入變體池,乾旱/風暴/寒流等事件不再逐字重複
        const framing = pickRandom([
            { pre: t('急匆匆找到你：「'), post: t('你見多識廣，幫我拿個主意！」') },
            { pre: t('皺著眉頭把你拉到一旁：「'), post: t('鎮上的人都慌了，你說該怎麼辦？」') },
            { pre: t('深夜還亮著燈,見你經過連忙招手：「'), post: t('我想聽聽你的看法,再晚就來不及了。」') },
            { pre: t('在廣場上攔住你,壓低聲音：「'), post: t('這件事我拿不定主意...你幫我想想。」') },
        ]);
        this.pendingEvent = {
            eventName: event.name,
            description: `${asker}${framing.pre}${event.description}${framing.post}`,
            severity: event.severity,
            choices: choices,
            timestamp: world.tickCount,
        };
        world.logMessage('event_choice', `⚡ ${event.name}${t('——')}${asker}${t('來徵詢你的意見！')}`);
    }

    _generateChoices(event, world) {
        // Generate contextual choices based on event type
        if (event.severity === 'minor') return null; // Minor events don't need choices

        if (event.threat_level) {
            // Raid/attack events
            return [
                { label: t('全力防禦'), icon: '🛡️', desc: t('派出所有守衛迎戰'),
                  effects: { defense_bonus: 3, mood_all: -3, guard_mood: 10 } },
                { label: t('談判求和'), icon: '🕊️', desc: t('嘗試用銀幣買和平'),
                  effects: { silver: -(event.threat_level * 15), mood_all: 2 } },
                { label: t('疏散居民'), icon: '🏃', desc: t('優先保護居民安全'),
                  effects: { mood_all: 5, resource_loss: true } },
            ];
        }

        if (event.effects?.mood_all < -5) {
            // Negative events (disaster, famine, etc.)
            return [
                { label: t('團結面對'), icon: '💪', desc: t('號召全鎮一起渡過難關'),
                  effects: { mood_all: 5, social_boost: 3 } },
                { label: t('祈禱平安'), icon: '🙏', desc: t('到教堂為大家祈禱'),
                  effects: { mood_all: 3, moodTarget: 'priest', moodAmt: 8 } },
            ];
        }

        return null;
    }

    resolveChoice(choiceIndex, world) {
        if (!this.pendingEvent || !this.pendingEvent.choices[choiceIndex]) return null;
        const choice = this.pendingEvent.choices[choiceIndex];
        const effects = choice.effects;

        // Apply effects
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }
        if (effects.silver) {
            if (effects.silver > 0) world.stockpile.add('silver', effects.silver, world.tickCount, t('事件決策'), 'player');
            else world.stockpile.consume('silver', Math.abs(effects.silver), world.tickCount, t('事件決策'));
        }
        // v4.5.0 一般資源消耗/獲得 + 防災準備等級
        for (const rk of ['food','wood','stone','metal','tools','herbs','cloth']) {
            if (effects[rk]) {
                if (effects[rk] > 0) world.stockpile.add(rk, effects[rk], world.tickCount, t('事件決策'), 'player');
                else world.stockpile.consume(rk, Math.abs(effects[rk]), world.tickCount, t('事件決策'));
            }
        }
        if ('disaster_prep' in effects && world.weather) {
            world.weather._prepLevel = effects.disaster_prep;
        }
        if (effects.social_boost) {
            Object.values(world.agents).forEach(a => { a.needs.social = Math.min(100, a.needs.social + effects.social_boost); });
        }
        if (effects.moodTarget) {
            Object.values(world.agents).filter(a => a.job?.key === effects.moodTarget).forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + (effects.moodAmt || 0);
            });
        }
        if (effects.guard_mood) {
            Object.values(world.agents).filter(a => a.job?.key === 'guard').forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + effects.guard_mood;
            });
        }
        if (effects.resource_loss) {
            // Lose some random resources from the raid
            ['food','wood','stone'].forEach(r => {
                const loss = Math.floor(world.stockpile.get(r) * 0.15);
                if (loss > 0) world.stockpile.consume(r, loss, world.tickCount, t('入侵損失'));
            });
        }

        if (effects.relocate) { try { world.onRelocate?.(effects.relocate, world); } catch (e) { console.warn('[relocate]', e); } } // v5.90.0 跨鎮搬家(由 app 處理信箱)

        world.logMessage('event_choice', `⚡ ${t('你選擇了')}「${choice.label}」${t('來應對')}${this.pendingEvent.eventName}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('event', `${t('面對')}${this.pendingEvent.eventName}${t('，')}${playerTitle(world)}${t('選擇了')}「${choice.label}」`, 7);
        }

        this.eventLog.push({ event: this.pendingEvent.eventName, choice: choice.label, tick: world.tickCount });
        if (this.eventLog.length > 50) this.eventLog = this.eventLog.slice(-50);
        const result = { event: this.pendingEvent.eventName, choice: choice.label };
        this.pendingEvent = null;
        return result;
    }

    toDict() {
        return {
            pendingEvent: this.pendingEvent,
            recentChoices: this.eventLog.slice(-10),
        };
    }

    serialize() { return { pendingEvent: this.pendingEvent, eventLog: this.eventLog }; }
    loadFrom(data) {
        if (!data) return;
        this.pendingEvent = data.pendingEvent || null;
        this.eventLog = data.eventLog || [];
    }
}

// ============================================================
// v4.0 - NPC Help Request System (NPC 求助系統)
// ============================================================
class NPCHelpSystem {
    constructor() {
        this.pendingRequest = null;
        this.requestLog = [];
        this._daysSinceRequest = 0;
    }

    dailyUpdate(world) {
        this._daysSinceRequest++;
        if (this._daysSinceRequest < 3) return; // Every 3 days max
        if (this.pendingRequest) return;

        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.status !== 'hospitalized');
        if (npcs.length === 0) return;

        // Find NPCs with issues
        const candidates = [];

        for (const npc of npcs) {
            // Low mood NPC
            if (npc.mood < 20) {
                candidates.push({ npc, type: 'low_mood',
                    title: `${npc.name}${t('看起來很沮喪')}`,
                    desc: `${npc.name}${t('：「最近什麼事都不太順利...你能聽我說說嗎？」')}`,
                    optionA: { label: t('陪他聊聊'), effects: { targetMood: 15, playerSocial: 10, affinity: 10 } },
                    optionB: { label: t('給他空間'), effects: { targetMood: -3, affinity: -5 } },
                });
            }
            // Hungry NPC
            if (npc.needs.hunger < 20) {
                candidates.push({ npc, type: 'hungry',
                    title: `${npc.name}${t('肚子餓了')}`,
                    desc: `${npc.name}${t('：「你有沒有多餘的食物？我快餓扁了...」')}`,
                    optionA: { label: t('分享食物'), effects: { food: -5, targetHunger: 40, affinity: 8 } },
                    optionB: { label: t('抱歉沒有'), effects: { affinity: -3 } },
                });
            }
            // Relationship conflict
            const enemies = Object.values(npc.relationships?.relationships || {}).filter(r => r.affinity < -30);
            if (enemies.length > 0) {
                const enemy = world.agents[enemies[0].targetId];
                if (enemy && !enemy.isPlayer) {
                    candidates.push({ npc, type: 'conflict',
                        title: `${npc.name}${t('和')}${enemy.name}${t('鬧矛盾')}`,
                        desc: `${npc.name}${t('：「我跟')}${enemy.name}${t('吵了一架...你覺得誰對？」')}`,
                        optionA: { label: `${t('支持')}${npc.name}`, effects: { affinity: 12, enemyAffinity: -8 }, enemyId: enemy.agentId },
                        optionB: { label: t('勸他們和好'), effects: { affinity: 3, enemyAffinity: 5, mood_all: 2 }, enemyId: enemy.agentId },
                    });
                }
            }
            // Overworked NPC
            if (npc.needs.rest < 25 && npc.job) {
                candidates.push({ npc, type: 'tired',
                    title: `${npc.name}${t('太累了')}`,
                    desc: `${npc.name}${t('：「我已經連續工作好幾天了...能不能給我放個假？」')}`,
                    optionA: { label: t('批准休假'), effects: { targetRest: 40, targetMood: 10, affinity: 5 } },
                    optionB: { label: t('鼓勵堅持'), effects: { targetMood: -5, affinity: -3 } },
                });
            }
        }

        if (candidates.length === 0) return;

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        this._daysSinceRequest = 0;
        this.pendingRequest = {
            tick: world.tickCount, // v5.34.0 供逾時代選判斷
            npcId: chosen.npc.agentId,
            npcName: chosen.npc.name,
            type: chosen.type,
            title: chosen.title,
            desc: chosen.desc,
            optionA: chosen.optionA,
            optionB: chosen.optionB,
            enemyId: chosen.optionA.enemyId || chosen.optionB.enemyId || null,
            timestamp: world.tickCount,
        };

        world.logMessage('npc_help', `💬 ${chosen.npc.name}${t('需要你的幫助！')}`);
    }

    resolveRequest(choice, world) {
        if (!this.pendingRequest) return null;
        const req = this.pendingRequest;
        const effects = choice === 'A' ? req.optionA.effects : req.optionB.effects;
        const label = choice === 'A' ? req.optionA.label : req.optionB.label;

        const npc = world.agents[req.npcId];
        const player = world.agents['player'];

        if (npc) {
            if (effects.targetMood) npc.moodModifier = (npc.moodModifier || 0) + effects.targetMood;
            if (effects.targetHunger) npc.needs.hunger = Math.min(100, npc.needs.hunger + effects.targetHunger);
            if (effects.targetRest) npc.needs.rest = Math.min(100, npc.needs.rest + effects.targetRest);
            if (effects.affinity && player) {
                const rel = npc.relationships.getOrCreate('player', player.name);
                rel.modifyAffinity(effects.affinity);
            }
        }

        if (effects.enemyAffinity && req.enemyId) {
            const enemy = world.agents[req.enemyId];
            if (enemy && player) {
                const rel = enemy.relationships.getOrCreate('player', player.name);
                rel.modifyAffinity(effects.enemyAffinity);
            }
        }

        if (effects.food && effects.food < 0) {
            world.stockpile.consume('food', Math.abs(effects.food), world.tickCount, `${t('幫助')}${req.npcName}`);
        }
        if (effects.playerSocial && player) {
            player.needs.social = Math.min(100, player.needs.social + effects.playerSocial);
        }
        if (effects.mood_all) {
            Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + effects.mood_all; });
        }

        // Reputation for helping NPCs (option A is always the helpful choice)
        if (choice === 'A' && world.reputationSystem) {
            world.reputationSystem.addReputation(2, 'help', world);
        }

        world.logMessage('npc_help', `💬 ${t('你對')}${req.npcName}${t('說')}：「${label}」`);

        this.requestLog.push({ npcName: req.npcName, type: req.type, choice: label, tick: world.tickCount });
        if (this.requestLog.length > 50) this.requestLog = this.requestLog.slice(-50);
        const result = { npcName: req.npcName, choice: label };
        this.pendingRequest = null;
        return result;
    }

    toDict() {
        return {
            pendingRequest: this.pendingRequest,
            recentRequests: this.requestLog.slice(-10),
        };
    }

    serialize() { return { pendingRequest: this.pendingRequest, requestLog: this.requestLog, _daysSinceRequest: this._daysSinceRequest }; }
    loadFrom(data) {
        if (!data) return;
        this.pendingRequest = data.pendingRequest || null;
        this.requestLog = data.requestLog || [];
        this._daysSinceRequest = data._daysSinceRequest || 0;
    }
}
