// ============================================================
// RimTown - Farm System (農場種植系統)
// ============================================================

const CROPS = {
    wheat:        { name:'小麥',     icon:'🌾', seasons:['春季','秋季'], growDays:8,  yield:15, sellPrice:2,  category:'grain',     reqLevel:1 },
    potato:       { name:'馬鈴薯',   icon:'🥔', seasons:['春季','秋季'], growDays:7,  yield:20, sellPrice:1,  category:'vegetable',  reqLevel:1 },
    rice:         { name:'稻米',     icon:'🌾', seasons:['夏季'],       growDays:12, yield:20, sellPrice:3,  category:'grain',     reqLevel:2 },
    corn:         { name:'玉米',     icon:'🌽', seasons:['夏季','秋季'], growDays:10, yield:18, sellPrice:2,  category:'grain',     reqLevel:2 },
    cotton:       { name:'棉花',     icon:'🌸', seasons:['夏季','秋季'], growDays:10, yield:10, sellPrice:4,  category:'fiber',     reqLevel:2 },
    flowers:      { name:'花卉',     icon:'🌺', seasons:['春季','夏季'], growDays:5,  yield:12, sellPrice:3,  category:'flower',    reqLevel:2 },
    herbs:        { name:'草藥',     icon:'🌿', seasons:['春季','夏季'], growDays:6,  yield:8,  sellPrice:5,  category:'herb',      reqLevel:3 },
    mushroom:     { name:'蘑菇',     icon:'🍄', seasons:['秋季','冬季'], growDays:4,  yield:10, sellPrice:4,  category:'vegetable',  reqLevel:3 },
    sugarcane:    { name:'甘蔗',     icon:'🎋', seasons:['夏季'],       growDays:12, yield:14, sellPrice:3,  category:'sugar',     reqLevel:3 },
    tea:          { name:'茶葉',     icon:'🍵', seasons:['春季'],       growDays:10, yield:6,  sellPrice:8,  category:'luxury',    reqLevel:4 },
    grapes:       { name:'葡萄',     icon:'🍇', seasons:['秋季'],       growDays:14, yield:8,  sellPrice:6,  category:'fruit',     reqLevel:4 },
    golden_wheat: { name:'金色小麥', icon:'✨', seasons:['秋季'],       growDays:15, yield:10, sellPrice:15, category:'legendary',  reqLevel:5 },
    dragon_fruit: { name:'火龍果',   icon:'🐉', seasons:['夏季'],       growDays:12, yield:6,  sellPrice:20, category:'legendary',  reqLevel:5 },
};

const QUALITY_NAMES = { normal:'普通', good:'優良', excellent:'極品' };
const QUALITY_MULT = { normal:1, good:1.5, excellent:2.5 };

class FarmSystem {
    constructor() {
        this.plots = [];
        this.maxPlots = 0;       // Set by industry level
        this.harvestLog = [];
        this.totalHarvested = {};
        this.moodPenalty = null; // { agentId, days, penalty }
        this._plotCounter = 0;
    }

    // Initialize plots to match max
    _ensurePlots() {
        while (this.plots.length < this.maxPlots) {
            this._plotCounter++;
            this.plots.push({
                id: this._plotCounter,
                state: 'empty',
                crop: null,
                plantedDay: 0,
                growthProgress: 0,
                quality: 'normal',
                waterLevel: 100,
                fertilized: false,
                lastCrop: null,
            });
        }
    }

    getAvailableCrops(farmLevel) {
        return Object.entries(CROPS)
            .filter(([, c]) => c.reqLevel <= farmLevel)
            .map(([key, c]) => ({ key, ...c }));
    }

    tillPlot(plotId) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'empty') return { ok: false, error: '無法翻土' };
        plot.state = 'tilled';
        return { ok: true };
    }

    plantCrop(plotId, cropKey, world) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'tilled') return { ok: false, error: '需先翻土' };
        const crop = CROPS[cropKey];
        if (!crop) return { ok: false, error: '未知作物' };

        // Check farm level
        const farmInd = world.industry?.industries?.farming;
        if (!farmInd || crop.reqLevel > farmInd.level) return { ok: false, error: `需要農業 Lv${crop.reqLevel}` };

        // Check season
        if (!crop.seasons.includes(world.clock.season)) return { ok: false, error: '非當季作物' };

        // Seed cost
        const seedCost = crop.sellPrice * 2;
        if (!world.stockpile.has('silver', seedCost)) return { ok: false, error: `需要 ${seedCost} 銀幣買種子` };
        world.stockpile.consume('silver', seedCost, world.tickCount, `${crop.name}種子`);

        plot.state = 'growing';
        plot.crop = cropKey;
        plot.plantedDay = world.clock.day + (world.clock.year - 1) * 60;
        plot.growthProgress = 0;
        plot.waterLevel = 100;
        plot.fertilized = false;
        return { ok: true };
    }

    waterPlot(plotId) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'growing') return { ok: false };
        plot.waterLevel = Math.min(100, plot.waterLevel + 30);
        return { ok: true };
    }

    fertilizePlot(plotId, world) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'growing' || plot.fertilized) return { ok: false, error: '無法施肥' };
        if (!world.stockpile.has('herbs', 2)) return { ok: false, error: '需要 2 草藥' };
        world.stockpile.consume('herbs', 2, world.tickCount, '製作肥料');
        plot.fertilized = true;
        return { ok: true };
    }

    harvestPlot(plotId, world) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'ready') return { ok: false, error: '未成熟' };

        const crop = CROPS[plot.crop];
        if (!crop) return { ok: false, error: '作物錯誤' };

        // Calculate quality
        let qualityScore = 0;
        if (plot.waterLevel > 80) qualityScore++;
        if (plot.fertilized) qualityScore++;
        if (plot.lastCrop && plot.lastCrop !== plot.crop) qualityScore++; // Rotation bonus

        // NPC farmer help
        const farmer = world ? Object.values(world.agents).find(a =>
            !a.isPlayer && a.job?.key === 'farmer'
        ) : null;
        if (farmer) {
            const rel = farmer.relationships?.relationships?.['player'];
            if (rel && rel.affinity >= 40) qualityScore++;
        }

        const quality = qualityScore >= 3 ? 'excellent' : qualityScore >= 1 ? 'good' : 'normal';
        const mult = QUALITY_MULT[quality];
        const amount = Math.round(crop.yield * mult);

        // Add to stockpile based on category
        const resourceMap = {
            grain: 'food', vegetable: 'food', fruit: 'food',
            fiber: 'cloth', herb: 'herbs', flower: 'flowers',
            sugar: 'sugarcane', luxury: crop.category === 'luxury' ? 'tea' : crop.name,
            legendary: 'food',
        };
        // For special crops, add as the crop key directly
        const resource = ['wheat','rice','corn','potato','cotton','herbs','sugarcane','tea','grapes','flowers','mushroom','golden_wheat','dragon_fruit'].includes(plot.crop)
            ? plot.crop : (resourceMap[crop.category] || 'food');

        world.stockpile.add(resource, amount, world.tickCount, `收穫${crop.name}(${QUALITY_NAMES[quality]})`, 'farm');

        const entry = {
            crop: plot.crop, cropName: crop.name, amount, quality,
            sellValue: Math.round(crop.sellPrice * amount),
            day: world.clock.day, season: world.clock.season, year: world.clock.year,
        };
        this.harvestLog.push(entry);
        if (this.harvestLog.length > 100) this.harvestLog = this.harvestLog.slice(-100);
        this.totalHarvested[plot.crop] = (this.totalHarvested[plot.crop] || 0) + amount;

        // Notify daily news
        if (world.dailyNews) {
            world.dailyNews.collectEvent('farm', `收穫了 ${amount} 單位${crop.name}（${QUALITY_NAMES[quality]}品質）！`, 5);
        }

        // Reset plot
        plot.lastCrop = plot.crop;
        plot.state = 'empty';
        plot.crop = null;
        plot.growthProgress = 0;
        plot.fertilized = false;

        return { ok: true, ...entry };
    }

    dailyUpdate(world) {
        // Sync max plots with farming industry level
        const farmInd = world.industry?.industries?.farming;
        if (farmInd) {
            const levelDef = INDUSTRIES.farming.levels.find(l => l.lv === farmInd.level);
            this.maxPlots = levelDef?.plots || 4;
            this._ensurePlots();
        } else {
            this.maxPlots = 0;
        }

        // Mood penalty countdown
        if (this.moodPenalty) {
            this.moodPenalty.days--;
            if (this.moodPenalty.days <= 0) this.moodPenalty = null;
        }

        // Grow crops
        for (const plot of this.plots) {
            if (plot.state !== 'growing') continue;
            const crop = CROPS[plot.crop];
            if (!crop) continue;

            // Check season
            if (!crop.seasons.includes(world.clock.season)) {
                plot.state = 'withered';
                world.logMessage('farm', `${crop.icon} ${crop.name}因為季節不對而枯萎了！`);
                continue;
            }

            // Water decreases daily
            plot.waterLevel = Math.max(0, plot.waterLevel - 8);

            // Growth rate
            let growthRate = 100 / crop.growDays;
            if (plot.waterLevel > 60) growthRate *= 1.1;
            else if (plot.waterLevel < 30) growthRate *= 0.5;
            if (plot.fertilized) growthRate *= 1.2;

            // Industry bonus (Lv3 irrigation)
            if (farmInd && farmInd.level >= 3) {
                growthRate *= 1.3;
                plot.waterLevel = Math.min(100, plot.waterLevel + 5); // Irrigation keeps water up
            }

            // Mood penalty from drama
            if (this.moodPenalty) growthRate *= (1 + this.moodPenalty.penalty);

            plot.growthProgress = Math.min(100, plot.growthProgress + growthRate);

            if (plot.growthProgress >= 100) {
                plot.state = 'ready';
                world.logMessage('farm', `${crop.icon} ${crop.name}成熟了！可以收穫。`);
            }
        }

        // Wither check: ready crops left unharvested for 3+ days
        for (const plot of this.plots) {
            if (plot.state === 'ready') {
                plot._readyDays = (plot._readyDays || 0) + 1;
                if (plot._readyDays > 3) {
                    plot.state = 'withered';
                    const crop = CROPS[plot.crop];
                    world.logMessage('farm', `${crop?.icon || '🥀'} ${crop?.name || '作物'}因太久沒收穫而枯萎了。`);
                }
            } else {
                plot._readyDays = 0;
            }
        }
    }

    clearWithered(plotId) {
        const plot = this.plots.find(p => p.id === plotId);
        if (!plot || plot.state !== 'withered') return false;
        plot.state = 'empty';
        plot.crop = null;
        plot.growthProgress = 0;
        return true;
    }

    toDict() {
        return {
            plots: this.plots.map(p => ({ ...p })),
            maxPlots: this.maxPlots,
            harvestLog: this.harvestLog.slice(-20),
            totalHarvested: { ...this.totalHarvested },
        };
    }

    serialize() {
        return {
            plots: this.plots.map(p => ({ ...p })),
            maxPlots: this.maxPlots,
            harvestLog: this.harvestLog,
            totalHarvested: { ...this.totalHarvested },
            moodPenalty: this.moodPenalty,
            _plotCounter: this._plotCounter,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.plots = data.plots || [];
        this.maxPlots = data.maxPlots || 0;
        this.harvestLog = data.harvestLog || [];
        this.totalHarvested = data.totalHarvested || {};
        this.moodPenalty = data.moodPenalty || null;
        this._plotCounter = data._plotCounter || this.plots.length;
    }
}
