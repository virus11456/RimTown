// ============================================================
// RimTown - Prosperity Engine (繁榮度系統)
// ============================================================
// 繁榮度 (0-100) = 7 維度加權平均
// 影響：商人來訪頻率、移民速度、NPC 心情、事件觸發

class ProsperityEngine {
    constructor() {
        this.dimensions = {
            economy:    { weight: 0.25, value: 0 },  // 經濟：資源充足度、貿易、工廠產出
            buildings:  { weight: 0.20, value: 0 },  // 建設：建築數量、城鎮等級
            population: { weight: 0.15, value: 0 },  // 人口：人數、增長
            happiness:  { weight: 0.15, value: 0 },  // 幸福：NPC 平均心情
            culture:    { weight: 0.10, value: 0 },  // 文化：節慶、選舉、信仰
            defense:    { weight: 0.10, value: 0 },  // 防禦：守衛數量、城牆、入侵抵禦
            beauty:     { weight: 0.05, value: 0 },  // 美觀：花園、裝飾、花卉種植
        };
        this.prosperity = 0;           // 總繁榮度
        this.level = t('荒涼');            // 繁榮等級名稱
        this._lastUpdateDay = -1;
    }

    // ============================================================
    // 每日更新（在 World.tick() 的 new_day 區塊呼叫）
    // ============================================================
    dailyUpdate(world) {
        if (this._lastUpdateDay === world.clock.day && this._lastUpdateYear === world.clock.year) return;
        this._lastUpdateDay = world.clock.day;
        this._lastUpdateYear = world.clock.year;

        this._calcEconomy(world);
        this._calcBuildings(world);
        this._calcPopulation(world);
        this._calcHappiness(world);
        this._calcCulture(world);
        this._calcDefense(world);
        this._calcBeauty(world);

        // 計算總繁榮度（加權平均）
        let total = 0;
        for (const dim of Object.values(this.dimensions)) {
            total += dim.value * dim.weight;
        }
        this.prosperity = Math.round(Math.max(0, Math.min(100, total)));
        this.level = this._getLevel();

        // 繁榮度效果
        this._applyEffects(world);
    }

    // ============================================================
    // 各維度計算
    // ============================================================

    _calcEconomy(world) {
        let score = 0;
        const stockpile = world.stockpile;
        if (!stockpile) { this.dimensions.economy.value = 0; return; }

        // 資源充足度 (0-30)
        const food = stockpile.get('food') || 0;
        const silver = stockpile.get('silver') || 0;
        const wood = stockpile.get('wood') || 0;
        score += Math.min(15, food / 10);        // 150 food = 15分
        score += Math.min(10, silver / 30);       // 300 silver = 10分
        score += Math.min(5, wood / 20);          // 100 wood = 5分

        // 產業等級 (0-40)
        if (world.industry) {
            const industries = Object.values(world.industry.industries);
            const indCount = industries.length;
            score += indCount * 5;                // 每個產業 5 分，最多 20
            const avgLevel = indCount > 0 ? industries.reduce((s, i) => s + (i.level || 1), 0) / indCount : 0;
            score += Math.min(20, avgLevel * 4);  // 平均 Lv5 = 20分
        }

        // 工廠運作 (0-15)
        if (world.processing) {
            const activeFactories = Object.values(world.processing.builtFactories || {}).filter(f => f.status === 'active').length;
            score += Math.min(15, activeFactories * 5);
        }

        // 貿易活躍度 (0-15)
        if (world.questSystem) {
            score += Math.min(15, (world.questSystem.tradeCount || 0) * 1.5);
        }

        this.dimensions.economy.value = Math.min(100, score);
    }

    _calcBuildings(world) {
        let score = 0;
        // 建築數量 (0-40)
        const buildCount = world.buildings?.completed?.length || 0;
        score += Math.min(40, buildCount * 3);

        // 城鎮等級 (0-60)
        const townLevel = world.industry?.townLevel || 1;
        score += Math.min(60, townLevel * 8.5);   // Lv7 ≈ 60

        this.dimensions.buildings.value = Math.min(100, score);
    }

    _calcPopulation(world) {
        let score = 0;
        const pop = Object.keys(world.agents || {}).length;

        // 人口數 (0-70)
        score += Math.min(70, pop * 3);           // 23人 ≈ 70

        // 有伴侶的 NPC 比例 (0-15)
        const npcs = Object.values(world.agents || {}).filter(a => !a.isPlayer);
        const partnered = npcs.filter(a => {
            const rels = Object.values(a.relationships?.relationships || {});
            return rels.some(r => r.status === 'dating' || r.status === 'married');
        }).length;
        if (npcs.length > 0) score += Math.min(15, (partnered / npcs.length) * 30);

        // 嬰兒/新成員 (0-15)
        if (world.lifecycle) {
            score += Math.min(15, (world.lifecycle.totalBirths || 0) * 5);
        }

        this.dimensions.population.value = Math.min(100, score);
    }

    _calcHappiness(world) {
        const npcs = Object.values(world.agents || {}).filter(a => !a.isPlayer);
        if (npcs.length === 0) { this.dimensions.happiness.value = 0; return; }

        // NPC 平均心情 (mood 範圍 -100~100，映射到 0-100)
        const avgMood = npcs.reduce((s, a) => s + (a.mood || 0), 0) / npcs.length;
        let score = Math.max(0, Math.min(100, (avgMood + 50) * 1.0));   // mood 50 = score 100

        // 全鎮平均好感度加成
        const player = world.agents?.player;
        if (player?.relationships?.relationships) {
            const rels = Object.values(player.relationships.relationships);
            if (rels.length > 0) {
                const avgAff = rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length;
                score += Math.min(20, Math.max(0, avgAff * 0.5));
            }
        }

        this.dimensions.happiness.value = Math.min(100, score);
    }

    _calcCulture(world) {
        let score = 0;

        // 選舉舉行次數 (0-30)
        if (world.questSystem) {
            score += Math.min(30, (world.questSystem.electionsHeld || 0) * 15);
        }

        // 節慶 (0-30)
        if (world.festivals) {
            score += Math.min(30, (world.festivals.completedFestivals?.length || 0) * 10);
        }

        // 有牧師 (0-20)
        const hasPriest = Object.values(world.agents || {}).some(a => a.job?.key === 'priest');
        if (hasPriest) score += 20;

        // 有研究員 (0-20)
        const hasResearcher = Object.values(world.agents || {}).some(a => a.job?.key === 'researcher');
        if (hasResearcher) score += 20;

        this.dimensions.culture.value = Math.min(100, score);
    }

    _calcDefense(world) {
        let score = 0;

        // 守衛數量 (0-30)
        const guards = Object.values(world.agents || {}).filter(a => a.job?.key === 'guard').length;
        score += Math.min(30, guards * 15);

        // 入侵成功抵禦 (0-30)
        if (world.questSystem) {
            score += Math.min(30, (world.questSystem.raidsSurvived || 0) * 10);
        }

        // 城牆等防禦建築 (0-40)
        const defenseBuildings = (world.buildings?.completed || []).filter(b =>
            b.key === 'wall' || b.key === 'watchtower' || b.key === 'barracks'
        ).length;
        score += Math.min(40, defenseBuildings * 13);

        this.dimensions.defense.value = Math.min(100, score);
    }

    _calcBeauty(world) {
        let score = 0;

        // 花卉種植 (0-40)
        if (world.farm) {
            const flowerPlots = world.farm.plots.filter(p =>
                p.state === 'growing' && p.crop === 'flowers' ||
                p.state === 'ready' && p.crop === 'flowers'
            ).length;
            score += Math.min(40, flowerPlots * 10);
        }

        // 裝飾性建築 (0-30)
        const beautyBuildings = (world.buildings?.completed || []).filter(b =>
            b.key === 'garden' || b.key === 'fountain' || b.key === 'statue' || b.key === 'park'
        ).length;
        score += Math.min(30, beautyBuildings * 10);

        // v4.8.0 玩家擺放的裝飾 (0-35)
        const decos = world.decorations || [];
        const decoScore = decos.reduce((sum, d) => sum + ({ flowerbed: 2, bench: 2, lamp: 3, statue: 6, fountain: 8 }[d.type] || 2), 0);
        score += Math.min(35, decoScore);

        // 小鎮等級基底分 (0-30)
        const townLevel = world.industry?.townLevel || 1;
        score += Math.min(30, townLevel * 4);

        this.dimensions.beauty.value = Math.min(100, score);
    }

    // ============================================================
    // 繁榮等級
    // ============================================================
    _getLevel() {
        if (this.prosperity >= 80) return t('傳奇');
        if (this.prosperity >= 60) return t('繁榮');
        if (this.prosperity >= 40) return t('發展中');
        if (this.prosperity >= 20) return t('起步');
        return t('荒涼');
    }

    // ============================================================
    // 繁榮度效果（影響遊戲系統）
    // ============================================================
    _applyEffects(world) {
        // 影響目標人口（移民速率）
        if (world.events) {
            if (this.prosperity >= 80) {
                world.events.TARGET_POPULATION = 30;
            } else if (this.prosperity >= 60) {
                world.events.TARGET_POPULATION = 22;
            } else if (this.prosperity >= 40) {
                world.events.TARGET_POPULATION = 17;
            } else if (this.prosperity >= 20) {
                world.events.TARGET_POPULATION = 14;
            } else {
                world.events.TARGET_POPULATION = 10;
            }
        }
    }

    // 供其他系統查詢
    getModifier(key) {
        switch (key) {
            case 'trade_price_bonus':
                // 繁榮度影響交易價格
                if (this.prosperity >= 80) return 0.15;
                if (this.prosperity >= 60) return 0.10;
                if (this.prosperity >= 40) return 0.05;
                return 0;
            case 'mood_bonus':
                // 繁榮度影響 NPC 基礎心情
                if (this.prosperity >= 80) return 10;
                if (this.prosperity >= 60) return 5;
                if (this.prosperity >= 40) return 2;
                return 0;
            case 'merchant_frequency':
                // 繁榮度影響商人來訪頻率（加成值）
                if (this.prosperity >= 80) return 0.3;
                if (this.prosperity >= 60) return 0.15;
                if (this.prosperity >= 40) return 0.05;
                return -0.05;
            default:
                return 0;
        }
    }

    // ============================================================
    // Serialization
    // ============================================================
    toDict() {
        const dims = {};
        for (const [key, dim] of Object.entries(this.dimensions)) {
            dims[key] = { value: Math.round(dim.value), weight: dim.weight };
        }
        return {
            prosperity: this.prosperity,
            level: this.level,
            dimensions: dims,
        };
    }

    serialize() {
        return {
            dimensions: JSON.parse(JSON.stringify(this.dimensions)),
            prosperity: this.prosperity,
            level: this.level,
            _lastUpdateDay: this._lastUpdateDay,
            _lastUpdateYear: this._lastUpdateYear,
        };
    }

    loadFrom(data) {
        if (!data) return;
        if (data.dimensions) {
            for (const [key, dim] of Object.entries(data.dimensions)) {
                if (this.dimensions[key]) {
                    this.dimensions[key].value = dim.value || 0;
                    // Keep default weights
                }
            }
        }
        this.prosperity = data.prosperity || 0;
        this.level = data.level || t('荒涼');
        this._lastUpdateDay = data._lastUpdateDay ?? -1;
        this._lastUpdateYear = data._lastUpdateYear ?? undefined;
    }
}
