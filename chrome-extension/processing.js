// ============================================================
// RimTown - Processing System (工廠加工系統)
// ============================================================

const FACTORIES = {
    bakery: {
        name: t('麵包坊'), icon: '🍞',
        cost: { wood:20, stone:15, silver:80 }, buildDays: 5,
        recipes: [
            { id:'bread',   input:{wheat:5},          output:{bread:8},    time:1, outputPrice:4,  label:t('小麥→麵包')   },
            { id:'pastry',  input:{wheat:3, sugar:2},  output:{pastry:4},   time:2, outputPrice:8,  label:t('小麥+糖→糕點') },
        ],
        workerSlots: 1, preferredJob: 'cook',
    },
    textile_mill: {
        name: t('紡織廠'), icon: '🧵',
        cost: { wood:25, metal:10, silver:100 }, buildDays: 7,
        recipes: [
            { id:'cloth',    input:{cotton:6},   output:{cloth:10},   time:1, outputPrice:5,  label:t('棉花→布料') },
            { id:'clothing', input:{cloth:4},     output:{clothing:3}, time:2, outputPrice:12, label:t('布料→衣服') },
        ],
        workerSlots: 2, preferredJob: 'tailor',
    },
    brewery: {
        name: t('釀酒廠'), icon: '🍺',
        cost: { wood:15, metal:5, silver:60 }, buildDays: 4,
        recipes: [
            { id:'beer', input:{wheat:4},   output:{beer:6}, time:2, outputPrice:5,  label:t('小麥→啤酒')   },
            { id:'wine', input:{grapes:6},  output:{wine:3}, time:4, outputPrice:15, label:t('葡萄→葡萄酒') },
        ],
        workerSlots: 1, preferredJob: 'cook',
    },
    herbal_workshop: {
        name: t('草藥工坊'), icon: '⚗️',
        cost: { wood:15, stone:10, silver:70 }, buildDays: 5,
        recipes: [
            { id:'medicine', input:{herbs:4},            output:{medicine:3}, time:2, outputPrice:14, label:t('草藥→藥品') },
            { id:'perfume',  input:{herbs:2, flowers:3}, output:{perfume:2},  time:3, outputPrice:20, label:t('草藥+花→香水') },
        ],
        workerSlots: 1, preferredJob: 'doctor',
    },
    tea_house: {
        name: t('茶坊'), icon: '🍵',
        cost: { wood:20, silver:120 }, buildDays: 6,
        recipes: [
            { id:'fine_tea',   input:{tea:4},          output:{fine_tea:3},   time:2, outputPrice:18, label:t('茶葉→精製茶') },
            { id:'herbal_tea', input:{tea:2, herbs:2}, output:{herbal_tea:4}, time:1, outputPrice:10, label:t('茶+草藥→養生茶') },
        ],
        workerSlots: 1, preferredJob: 'trader',
    },
    sugar_refinery: {
        name: t('製糖廠'), icon: '🍬',
        cost: { wood:15, metal:8, silver:90 }, buildDays: 5,
        recipes: [
            { id:'sugar', input:{sugarcane:6}, output:{sugar:8}, time:1, outputPrice:5,  label:t('甘蔗→糖') },
            { id:'jam',   input:{sugar:3},     output:{jam:4},   time:2, outputPrice:10, label:t('糖→果醬') },
        ],
        workerSlots: 1, preferredJob: 'cook',
    },
    furniture_workshop: {
        name: t('家具工坊'), icon: '🪑',
        cost: { wood:30, metal:10, tools:5, silver:150 }, buildDays: 8,
        recipes: [
            { id:'furniture',        input:{wood:8},          output:{furniture:4},        time:2, outputPrice:10, label:t('木材→家具') },
            { id:'luxury_furniture', input:{wood:5, cloth:3}, output:{luxury_furniture:2}, time:3, outputPrice:25, label:t('木材+布→精裝家具') },
        ],
        workerSlots: 2, preferredJob: 'carpenter',
    },
};

class ProcessingSystem {
    constructor() {
        this.builtFactories = {};  // { bakery: { key, status:'building'|'active', buildProgress, recipe, productionProgress, workers:[], warehouse:{} } }
        this.orders = [];          // Special orders
        this.recentOutput = [];
        this._orderCounter = 0;
    }

    getAvailableFactories(world) {
        return Object.entries(FACTORIES)
            .filter(([key]) => !this.builtFactories[key])
            .map(([key, f]) => ({
                key, ...f,
                canAfford: world.stockpile.canAfford(f.cost),
            }));
    }

    buildFactory(key, world) {
        if (this.builtFactories[key]) return { ok: false, error: t('已建造') };
        const def = FACTORIES[key];
        if (!def) return { ok: false, error: t('未知工廠') };
        if (!world.stockpile.pay(def.cost, world.tickCount, `${t('建造')}${def.name}`)) return { ok: false, error: t('資源不足') };

        this.builtFactories[key] = {
            key, status: 'building',
            buildProgress: 0, buildRequired: def.buildDays,
            recipe: null, productionProgress: 0,
            workers: [], warehouse: {},
        };
        world.logMessage('factory', `${def.icon} ${t('開始建造')}${def.name}${t('！')}`);
        return { ok: true };
    }

    setRecipe(factoryKey, recipeId) {
        const factory = this.builtFactories[factoryKey];
        if (!factory || factory.status !== 'active') return false;
        const def = FACTORIES[factoryKey];
        const recipe = def.recipes.find(r => r.id === recipeId);
        if (!recipe) return false;
        factory.recipe = recipeId;
        factory.productionProgress = 0;
        return true;
    }

    assignWorker(factoryKey, agentId) {
        const factory = this.builtFactories[factoryKey];
        if (!factory || factory.status !== 'active') return false;
        const def = FACTORIES[factoryKey];
        if (factory.workers.length >= def.workerSlots) return false;
        if (factory.workers.includes(agentId)) return false;
        // Remove from other factories first
        for (const f of Object.values(this.builtFactories)) {
            f.workers = f.workers.filter(w => w !== agentId);
        }
        factory.workers.push(agentId);
        return true;
    }

    removeWorker(agentId) {
        for (const f of Object.values(this.builtFactories)) {
            f.workers = f.workers.filter(w => w !== agentId);
        }
    }

    collectProduct(factoryKey, resource, amount, world) {
        const factory = this.builtFactories[factoryKey];
        if (!factory) return false;
        const available = factory.warehouse[resource] || 0;
        const take = Math.min(amount, available);
        if (take <= 0) return false;
        factory.warehouse[resource] -= take;
        if (factory.warehouse[resource] <= 0) delete factory.warehouse[resource];
        world.stockpile.add(resource, take, world.tickCount, `${FACTORIES[factoryKey].name}${t('出貨')}`);
        return true;
    }

    sellProduct(factoryKey, resource, amount, world) {
        const factory = this.builtFactories[factoryKey];
        if (!factory) return false;
        const available = factory.warehouse[resource] || 0;
        const sell = Math.min(amount, available);
        if (sell <= 0) return false;

        // Find price from recipe outputs
        const def = FACTORIES[factoryKey];
        let price = 5; // default
        for (const recipe of def.recipes) {
            if (recipe.output[resource]) {
                price = recipe.outputPrice;
                break;
            }
        }

        factory.warehouse[resource] -= sell;
        if (factory.warehouse[resource] <= 0) delete factory.warehouse[resource];
        const silver = Math.round(sell * price);
        world.stockpile.add('silver', silver, world.tickCount, `${t('賣出')}${resource}`, def.name);
        world.logMessage('factory', `${def.icon} ${t('賣出')} ${sell} ${resource}${t('，獲得')} ${silver} ${t('銀幣')}`);
        return true;
    }

    dailyUpdate(world) {
        // Construction progress
        for (const [key, factory] of Object.entries(this.builtFactories)) {
            if (factory.status === 'building') {
                // Construction workers help
                const builders = Object.values(world.agents).filter(a =>
                    !a.isPlayer && ['carpenter','miner','blacksmith'].includes(a.job?.key)
                );
                factory.buildProgress += 1 + Math.floor(builders.length * 0.3);
                if (factory.buildProgress >= factory.buildRequired) {
                    factory.status = 'active';
                    const def = FACTORIES[key];
                    world.logMessage('factory', `${def.icon} ${def.name}${t('建造完成！')}`);
                }
                continue;
            }

            // Production
            if (factory.status !== 'active' || !factory.recipe) continue;
            const def = FACTORIES[key];
            const recipe = def.recipes.find(r => r.id === factory.recipe);
            if (!recipe) continue;

            // Check workers
            const workerCount = factory.workers.filter(wId =>
                world.agents[wId] && (!world.agents[wId].status || world.agents[wId].status === 'normal')
            ).length;
            if (workerCount === 0) continue;

            // Worker efficiency
            let efficiency = workerCount / def.workerSlots;
            factory.workers.forEach(wId => {
                const agent = world.agents[wId];
                if (!agent || (agent.status && agent.status !== 'normal')) return;
                if (agent.job?.key === def.preferredJob) efficiency += 0.1;
                if (agent.mood > 50) efficiency += 0.05;
            });

            // Check if we have inputs
            let canProduce = true;
            for (const [r, a] of Object.entries(recipe.input)) {
                if (!world.stockpile.has(r, a)) { canProduce = false; break; }
            }
            if (!canProduce) continue;

            factory.productionProgress += efficiency;
            if (factory.productionProgress >= recipe.time) {
                // Verify all inputs are available before consuming any
                let hasAllInputs = true;
                for (const [r, a] of Object.entries(recipe.input)) {
                    if (!world.stockpile.has(r, a)) { hasAllInputs = false; break; }
                }
                if (!hasAllInputs) continue;
                // Consume inputs
                for (const [r, a] of Object.entries(recipe.input)) {
                    world.stockpile.consume(r, a, world.tickCount, `${def.name}${t('生產')}`);
                }

                // Produce outputs to warehouse
                for (const [r, a] of Object.entries(recipe.output)) {
                    factory.warehouse[r] = (factory.warehouse[r] || 0) + a;
                }
                factory.productionProgress -= recipe.time;

                const outputStr = Object.entries(recipe.output).map(([r, a]) => `${a} ${r}`).join(', ');
                this.recentOutput.push({ factory: key, recipe: recipe.id, output: recipe.output, day: world.clock.day });
                if (this.recentOutput.length > 50) this.recentOutput = this.recentOutput.slice(-50);

                if (world.dailyNews) {
                    world.dailyNews.collectEvent('factory', `${def.name}${t('產出了')} ${outputStr}`, 3);
                }
            }
        }

        // Special orders
        this._generateOrders(world);
        this._checkOrderExpiry(world);

        // Auto-sell at marketplace (if built)
        const hasMarket = world.buildings.completed.some(b => b.name === t('市集'));
        if (hasMarket) {
            for (const [key, factory] of Object.entries(this.builtFactories)) {
                if (factory.status !== 'active') continue;
                for (const [r, amount] of Object.entries(factory.warehouse)) {
                    if (amount >= 3) {
                        const sellAmount = Math.min(2, amount); // Sell up to 2 per day at market
                        this.sellProduct(key, r, sellAmount, world);
                    }
                }
            }
        }
    }

    _generateOrders(world) {
        if (this.orders.filter(o => o.status === 'active').length >= 3) return;
        if (Math.random() > 0.1) return; // 10% chance per day

        const activeFactories = Object.entries(this.builtFactories).filter(([, f]) => f.status === 'active');
        if (activeFactories.length === 0) return;

        const [factoryKey] = pickRandom(activeFactories);
        const def = FACTORIES[factoryKey];
        const recipe = pickRandom(def.recipes);
        const product = Object.keys(recipe.output)[0];
        const amount = randInt(5, 20);
        const priceMult = 1.5 + Math.random();

        this._orderCounter++;
        this.orders.push({
            id: `order_${this._orderCounter}`,
            product, amount,
            reward: Math.round(recipe.outputPrice * amount * priceMult),
            daysLeft: randInt(3, 7),
            factoryKey,
            description: `${t('需要')} ${amount} ${t('個')}${product}`,
            status: 'active',
        });
        world.logMessage('order', `📋 ${t('新訂單')}：${t('需要')} ${amount} ${t('個')}${product}！（${Math.round(priceMult * 100)}% ${t('價格')}）`);
    }

    fulfillOrder(orderId, world) {
        const order = this.orders.find(o => o.id === orderId && o.status === 'active');
        if (!order) return { ok: false, error: t('訂單不存在') };

        // Check warehouse of relevant factory
        const factory = this.builtFactories[order.factoryKey];
        if (!factory) return { ok: false, error: t('工廠不存在') };
        const available = factory.warehouse[order.product] || 0;
        if (available < order.amount) return { ok: false, error: `${t('庫存不足')}（${t('需要')}${order.amount}，${t('有')}${available}）` };

        factory.warehouse[order.product] -= order.amount;
        world.stockpile.add('silver', order.reward, world.tickCount, `${t('訂單完成')}：${order.product}`);
        order.status = 'completed';
        world.logMessage('order', `✅ ${t('訂單完成')}！${t('獲得')} ${order.reward} ${t('銀幣')}`);
        return { ok: true };
    }

    _checkOrderExpiry(world) {
        for (const order of this.orders) {
            if (order.status !== 'active') continue;
            order.daysLeft--;
            if (order.daysLeft <= 0) {
                order.status = 'expired';
                world.logMessage('order', `❌ ${t('訂單過期')}：${order.description}`);
            }
        }
        // Clean old orders
        const active = this.orders.filter(o => o.status === 'active');
        const done = this.orders.filter(o => o.status !== 'active').slice(-20);
        this.orders = [...active, ...done];
    }

    toDict() {
        return {
            builtFactories: JSON.parse(JSON.stringify(this.builtFactories)),
            orders: this.orders.filter(o => o.status === 'active'),
            recentOutput: this.recentOutput.slice(-10),
        };
    }

    serialize() {
        return {
            builtFactories: JSON.parse(JSON.stringify(this.builtFactories)),
            orders: this.orders,
            recentOutput: this.recentOutput,
            _orderCounter: this._orderCounter,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.builtFactories = data.builtFactories || {};
        this.orders = data.orders || [];
        this.recentOutput = data.recentOutput || [];
        this._orderCounter = data._orderCounter || 0;
    }
}
