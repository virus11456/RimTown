// RimTown - app-economy.js：從 app.js 拆出的 經濟分頁：倉庫／建築／科技／貿易、產業、農田、工廠（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    _getExplorationZone(id) {
        const zones = {
            deep_forest: { icon:'🌲', name:t('幽深森林'), difficulty:2, description:t('城鎮外的茂密森林，傳說中有稀有草藥和野生動物。') },
            ancient_ruins: { icon:'🏛️', name:t('古代遺跡'), difficulty:4, description:t('神秘的古代建築遺址，可能藏有珍貴的知識和寶物。') },
            abandoned_mine: { icon:'⛏️', name:t('廢棄礦坑'), difficulty:3, description:t('一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。') },
            mountain_pass: { icon:'⛰️', name:t('山間隘口'), difficulty:5, description:t('通往外界的危險山路，但可能找到貿易路線和珍稀資源。') },
            riverside_cave: { icon:'🕳️', name:t('河畔洞窟'), difficulty:2, description:t('河邊的一個神秘洞穴，經常有奇怪的回音。') },
            cursed_swamp: { icon:'🌿', name:t('詛咒沼澤'), difficulty:4, description:t('傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。') },
        };
        return zones[id] || null;
    },

    // --- Economy Tab (with factory sub-tab) ---
    // v5.53.2 資源 key → 在地化名稱(跨分頁共用,修工廠/產業成本露出英文 key 的問題)
    _resName(r) {
        if (!this._resNameMap) this._resNameMap = { food:t('食物'), wood:t('木材'), stone:t('石材'), metal:t('金屬'), cloth:t('布料'), herbs:t('草藥'), silver:t('銀幣'), meals:t('餐食'), tools:t('工具'), clothing:t('衣物'), medicine:t('藥品'), furniture:t('家具'), research_points:t('研究'),
            plank:t('木板'), hardwood:t('硬木'), brick:t('磚塊'), marble:t('大理石'), steel:t('鋼鐵'), gold:t('黃金'),
            wheat:t('小麥'), rice:t('稻米'), corn:t('玉米'), potato:t('馬鈴薯'), cotton:t('棉花'), flowers:t('花卉'), mushroom:t('蘑菇'), sugarcane:t('甘蔗'), tea:t('茶葉'), grapes:t('葡萄'), golden_wheat:t('金色小麥'), dragon_fruit:t('火龍果'),
            bread:t('麵包'), pastry:t('糕點'), beer:t('啤酒'), wine:t('葡萄酒'), perfume:t('香水'), fine_tea:t('精品茶'), herbal_tea:t('草本茶'), sugar:t('砂糖'), jam:t('果醬'), luxury_furniture:t('高級家具') };
        return this._resNameMap[r] || r;
    },

    // v5.50.0 經濟A波:從 stockpile 歷史計算「今日」各資源的產出/消耗流量(顯示層,不動模擬)
    _econDailyFlow(keys) {
        const out = {};
        keys.forEach(k => { out[k] = { produced: 0, consumed: 0 }; });
        const hist = this.world?.stockpile?.history;
        if (!hist) return out;
        const dayStart = Math.floor((this.world.tickCount || 0) / 96) * 96;
        for (let i = hist.length - 1; i >= 0; i--) {
            const e = hist[i];
            if (e.tick < dayStart) break;
            const rec = out[e.resource];
            if (!rec) continue;
            if (e.amount > 0) rec.produced += e.amount; else rec.consumed -= e.amount;
        }
        return out;
    },

    renderEconomy(container) {
        if (!this.state) return;
        if (!this._economySubTab) this._economySubTab = 'resources';

        let html = '<div class="economy-panel">';
        html += this._renderPlayerCaravan(); // v5.92.0 押商隊

        // Prosperity summary
        const prosp = this.state.prosperity;
        if (prosp) {
            // v4.6.0 排行榜入口(在繁榮度摘要上方)
            if (!this._lbBtnHtml) this._lbBtnHtml = `<div style="margin:4px 0 8px"><button class="trade-btn" data-action="show-leaderboard" style="width:100%">🏆 ${t('全球繁榮排行榜')}</button></div>`;
            html += this._lbBtnHtml;
            const pColor = prosp.prosperity >= 80 ? '#ffd700' : prosp.prosperity >= 60 ? 'var(--positive)' : prosp.prosperity >= 40 ? 'var(--accent)' : prosp.prosperity >= 20 ? 'var(--text-secondary)' : 'var(--negative)';
            html += `<div class="econ-section" style="padding:8px 12px">`;
            const popCount = Object.keys(this.state.agents || {}).length;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
            html += `${t('<span style="font-weight:bold;font-size:0.85rem">🏛️ 繁榮度 <span style="font-weight:normal;font-size:0.75rem;color:var(--text-muted)">👤 ')}${popCount}${t(' 人</span></span>')}`;
            html += `<span style="color:${pColor};font-weight:bold">${prosp.prosperity} — ${prosp.level}</span>`;
            html += `</div>`;
            html += `<div class="progress-bar" style="height:8px;margin-bottom:6px"><div class="progress-fill" style="width:${prosp.prosperity}%;background:${pColor}"></div></div>`;
            // Dimension bars
            const dimLabels = { economy:t('💰經濟'), buildings:t('🏗️建設'), population:t('👥人口'), happiness:t('😊幸福'), culture:t('🎭文化'), defense:t('🛡️防禦'), beauty:t('🌺美觀') };
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:0.7rem">`;
            for (const [key, dim] of Object.entries(prosp.dimensions || {})) {
                const label = dimLabels[key] || key;
                html += `<div style="display:flex;align-items:center;gap:4px">`;
                html += `<span style="width:52px;flex-shrink:0">${label}</span>`;
                html += `<div class="progress-bar" style="height:4px;flex:1"><div class="progress-fill" style="width:${dim.value}%;background:var(--accent)"></div></div>`;
                html += `<span style="width:20px;text-align:right;color:var(--text-muted)">${dim.value}</span>`;
                html += `</div>`;
            }
            html += `</div></div>`;
        }

        // Sub-tab navigation
        html += '<div class="sub-tab-bar">';
        const subTabs = [
            { key:'resources', label:t('資源'), icon:'📦' },
            { key:'tech', label:t('科技'), icon:'🔬' }, // v5.52.0 研究獨立入口(價值層)
            { key:'shop', label:t('商店'), icon:'🛒' },
            { key:'building', label:t('建築'), icon:'🏗️' },
            { key:'factory', label:t('工廠'), icon:'🔧' },
        ];
        subTabs.forEach(_tw => {
            const active = this._economySubTab === _tw.key ? ' class="active"' : '';
            html += `<button${active} data-action="economy-subtab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
        });
        html += '</div>';

        const sp = this.state.stockpile || {};
        const res = sp.resources || {};
        const icons = {food:'🌾',wood:'🪵',stone:'🪨',metal:'⚙️',cloth:'🧵',herbs:'🌿',silver:'💰',meals:'🍲',tools:'🔧',clothing:'👕',medicine:'💊',furniture:'🪑',research_points:'📚',
            plank:'🪵',hardwood:'🪓',brick:'🧱',marble:'🏛️',steel:'⚔️',gold:'🥇',
            wheat:'🌾',rice:'🍚',corn:'🌽',potato:'🥔',cotton:'🧶',flowers:'🌸',mushroom:'🍄',sugarcane:'🎋',tea:'🍵',grapes:'🍇',golden_wheat:'✨',dragon_fruit:'🐉',
            bread:'🍞',pastry:'🧁',beer:'🍺',wine:'🍷',perfume:'🌹',fine_tea:'🫖',herbal_tea:'🍃',sugar:'🍬',jam:'🫙',luxury_furniture:'🛋️'};
        const labels = {food:t('食物'),wood:t('木材'),stone:t('石材'),metal:t('金屬'),cloth:t('布料'),herbs:t('草藥'),silver:t('銀幣'),meals:t('餐食'),tools:t('工具'),clothing:t('衣物'),medicine:t('藥品'),furniture:t('家具'),research_points:t('研究'),
            plank:t('木板'),hardwood:t('硬木'),brick:t('磚塊'),marble:t('大理石'),steel:t('鋼鐵'),gold:t('黃金'),
            wheat:t('小麥'),rice:t('稻米'),corn:t('玉米'),potato:t('馬鈴薯'),cotton:t('棉花'),flowers:t('花卉'),mushroom:t('蘑菇'),sugarcane:t('甘蔗'),tea:t('茶葉'),grapes:t('葡萄'),golden_wheat:t('金色小麥'),dragon_fruit:t('火龍果'),
            bread:t('麵包'),pastry:t('糕點'),beer:t('啤酒'),wine:t('葡萄酒'),perfume:t('香水'),fine_tea:t('精品茶'),herbal_tea:t('草本茶'),sugar:t('砂糖'),jam:t('果醬'),luxury_furniture:t('高級家具')};

        if (this._economySubTab === 'resources') {
            // v5.50.0 經濟A波:三層資源結構 —— 關鍵資源 / 加工產能(看流量) / 原料倉庫(燈號)
            const npcCount = Math.max(1, Object.keys(this.state.agents || {}).length - 1);
            // ① 關鍵資源:食物+銀幣,唯二要玩家盯的存量
            // v5.53.0 食物顯示 /糧倉容量(400+穀倉擴容),玩家才知道離腐壞多遠
            const foodAmt = Math.round(res.food || 0), silverAmt = Math.round(res.silver || 0);
            const foodCap = 400 + (this.world?.buildings?.getEffect?.('food_capacity', 0) || 0);
            const overCap = foodAmt > foodCap;
            const foodClr = foodAmt < 50 ? 'var(--negative)' : foodAmt < 200 || overCap ? '#e8b030' : 'var(--positive)';
            const silverClr = silverAmt < 50 ? 'var(--negative)' : silverAmt < 300 ? '#e8b030' : 'var(--positive)';
            html += `<div class="econ-section"><h3>💎 ${t('關鍵資源')}</h3>
                <div style="display:flex;gap:8px">
                    <div style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
                        <div style="font-size:1.3rem">🌾</div><div style="font-size:0.72rem;color:var(--text-secondary)">${t('食物')}</div>
                        <div style="font-size:1.15rem;font-weight:bold;color:${foodClr}">${foodAmt}<span style="font-size:0.68rem;font-weight:normal;color:var(--text-muted)">/${foodCap}</span></div>
                        ${overCap ? `<div style="font-size:0.62rem;color:#e8b030">⚠ ${t('超過糧倉容量，每日腐壞5%')}</div>` : ''}</div>
                    <div style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
                        <div style="font-size:1.3rem">💰</div><div style="font-size:0.72rem;color:var(--text-secondary)">${t('銀幣')}</div>
                        <div style="font-size:1.15rem;font-weight:bold;color:${silverClr}">${silverAmt}</div></div>
                </div></div>`;
            // ② 加工產能:看今日流量(做了幾個/用掉幾個),不是純庫存
            const PROCESSED = ['meals','tools','clothing','medicine','furniture'];
            const flow = this._econDailyFlow(PROCESSED);
            const demandNote = {
                meals: `${t('每日需')} ${Math.round(npcCount * 1.5)}`,
                tools: `${t('每日耗損')} ${(npcCount * 0.05).toFixed(1)}`,
                clothing: `${t('每日耗損')} ${(npcCount * 0.03).toFixed(1)}`,
                medicine: t('生病時消耗'),
                furniture: t('建設與新居用'),
            };
            // v5.51.0 經濟B波:每條加工線顯示「誰在做」+ 排班三態(休工/正常/加班)——經濟＝排人,不是囤貨
            const GOOD_JOB = { meals:'cook', tools:'blacksmith', clothing:'tailor', medicine:'doctor', furniture:'carpenter' };
            const workPolicy = this.world?.workPolicy || {};
            html += `<div class="econ-section"><h3>⚒️ ${t('加工產能')}<span style="font-weight:normal;font-size:0.68rem;color:var(--text-muted);margin-left:6px">${t('今日產出／消耗，點按排班')}</span></h3>`;
            PROCESSED.forEach(k => {
                const f = flow[k];
                const stock = Math.round(res[k] || 0);
                const prod = Math.round(f.produced * 10) / 10, cons = Math.round(f.consumed * 10) / 10;
                const flowClr = prod >= cons ? 'var(--positive)' : 'var(--negative)';
                const makers = Object.values(this.state.agents || {}).filter(a => a.job?.key === GOOD_JOB[k]).map(a => a.name);
                const policy = workPolicy[k] || 'normal';
                // v5.53.0 產出在午夜結算,白天顯示「預估日產」避免 +0 被誤讀成排班沒生效
                const RECIPE_OUT = { meals: 9, tools: 3, clothing: 2, medicine: 2, furniture: 2 };
                const est = Math.round(makers.length * (RECIPE_OUT[k] || 0) * (policy === 'off' ? 0 : policy === 'extra' ? 1.5 : 1));
                const prodHtml = prod > 0 ? `＋${prod}` : `${t('預估日產')} ＋${est}<span style="color:var(--text-muted)">（${t('午夜結算')}）</span>`;
                const polBtn = (mode, icon, tip) => `<button data-action="work-policy" data-val="${k},${mode}" title="${tip}" style="width:26px;height:22px;border-radius:5px;border:1px solid var(--border);cursor:pointer;font-size:0.7rem;line-height:1;${policy === mode ? 'background:var(--accent);color:#fff' : 'background:var(--bg-card);color:var(--text-secondary)'}">${icon}</button>`;
                html += `<div style="padding:6px 2px;border-bottom:1px solid var(--border);font-size:0.78rem">
                    <div style="display:flex;align-items:center;gap:6px">
                        <span>${icons[k]}</span><span style="font-weight:bold">${labels[k]}</span>
                        <span style="color:var(--text-muted);font-size:0.66rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${makers.length ? '👤 ' + makers.join('、') : t('（無人手）')}</span>
                        <span style="color:var(--text-secondary);font-size:0.7rem">${t('庫存')} ${stock}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;margin-top:3px">
                        <span style="flex:1;font-size:0.7rem;color:${flowClr}">${prodHtml}${cons ? ` <span style="color:var(--negative)">−${cons}</span>` : ''} <span style="color:var(--text-muted)">· ${demandNote[k]}</span></span>
                        ${polBtn('off', '⏸', t('休工：不生產，村民心情變好、多時間社交'))}
                        ${polBtn('normal', '▶', t('正常排班'))}
                        ${polBtn('extra', '⏫', t('加班：產量+50%，但村民會累、心情變差'))}
                    </div>
                </div>`;
            });
            html += '</div>';
            // ③ 原料倉庫:收成一顆燈,細目摺疊
            const RAWS = ['wood','stone','metal','cloth','herbs'];
            const short = RAWS.filter(k => (res[k] || 0) < 10);
            const tight = RAWS.filter(k => (res[k] || 0) >= 10 && (res[k] || 0) < 40);
            const light = short.length ? '🔴' : tight.length ? '🟡' : '🟢';
            const lightText = short.length ? `${t('短缺')}：${short.map(k => labels[k]).join('、')}`
                : tight.length ? `${t('吃緊')}：${tight.map(k => labels[k]).join('、')}`
                : t('原料充足，工坊無虞');
            const detailKeys = Object.keys(res).filter(k => !PROCESSED.includes(k) && k !== 'food' && k !== 'silver' && k !== 'research_points' && Math.round(res[k]) > 0);
            html += `<div class="econ-section"><h3>📦 ${t('原料倉庫')}</h3>
                <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem">${light}<span>${lightText}</span></div>
                <details style="margin-top:6px"><summary style="cursor:pointer;font-size:0.72rem;color:var(--text-muted)">${t('展開明細')}</summary>
                <div class="resource-grid" style="margin-top:6px">`;
            detailKeys.forEach(k => {
                const amount = res[k];
                const cls = amount < 10 ? 'res-low' : amount > 100 ? 'res-high' : '';
                html += `<div class="resource-item ${cls}"><span class="res-icon">${icons[k] || '📦'}</span><span class="res-label">${labels[k] || k}</span><span class="res-amount">${Math.round(amount)}</span></div>`;
            });
            html += '</div></details></div>';
            // Trade
            const trade = this.state.trade || {};
            html += t('<div class="econ-section"><h3>交易</h3>');
            if (trade.merchant) {
                html += `<div class="merchant-card"><div class="merchant-name">${t(trade.merchant.name)}</div>
                    <div class="merchant-info">${t('專長：')}${trade.merchant.specialty} | ${trade.merchant.daysRemaining}${t('天後離開')}</div>
                    <div class="trade-offers">`;
                trade.merchant.offers.forEach((offer, idx) => {
                    const icon = icons[offer.resource] || '📦';
                    const resLabel = labels[offer.resource] || offer.resource;
                    const action = offer.isBuying ? t('賣出') : t('買入');
                    const actionCls = offer.isBuying ? 'trade-sell' : 'trade-buy';
                    html += `<div class="trade-offer ${actionCls}">
                        <span>${icon} ${resLabel}</span>
                        <span>×${Math.round(offer.amount)}</span>
                        <span>${offer.price}/${t('個')}</span>
                        <button class="trade-btn" data-action="trade" data-val="${idx},${Math.min(5, offer.amount)}">${action}5</button>
                        <button class="trade-btn" data-action="trade" data-val="${idx},${offer.amount}${t('">全')}${action}</button></div>`;
                });
                html += '</div></div>';
            } else {
                html += t('<p class="muted-text">鎮上沒有商人，可能很快就會來一位。</p>');
            }
            html += '</div>';
        } else if (this._economySubTab === 'tech') {
            // v5.52.0 經濟C波:研究移出資源分頁,獨立成「科技」入口(價值層長線投資)
            const research = this.state.research || {};
            html += `<div class="econ-section"><h3>🔬 ${t('研究')}<span style="font-weight:normal;font-size:0.72rem;color:var(--text-secondary);margin-left:6px">📚 ${t('研究點')} ${Math.round(res.research_points || 0)}</span></h3>`;
            const projects = research.projects || {};
            const currentKey = research.current_research;
            if (currentKey && projects[currentKey]) {
                const cur = projects[currentKey];
                const pct = Math.round((cur.progress / cur.cost) * 100);
                html += `${t('<div class="research-current">研究中：<strong>')}${t(cur.name)}</strong>
                    <div class="progress-bar"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span></div>`;
            }
            const availableResearch = Object.values(projects).filter(p => p.status === 'available');
            if (availableResearch.length) {
                html += t('<div class="research-available"><div class="build-label">可研究：</div>');
                availableResearch.forEach(p => {
                    const isCurrent = p.key === currentKey;
                    html += `<div class="research-option ${isCurrent ? 'active' : ''}">
                        <div class="build-name">${t(p.name)}</div>
                        <div class="build-desc">${p.description}${t('（消耗：')}${p.cost}）</div>
                        <button class="build-btn" data-action="research" data-val="${p.key}" ${isCurrent?'disabled':''}${t('>研究</button></div>')}`;
                });
                html += '</div>';
            }
            const completedResearch = Object.values(projects).filter(p => p.status === 'complete');
            if (completedResearch.length) {
                html += `${t('<div class="completed-buildings">已完成：')}${completedResearch.map(p => p.name).join('、')}</div>`;
            }
            html += '</div>';
        } else if (this._economySubTab === 'shop') {
            // v4.0: Shop system — card grid layout
            html += t('<div class="econ-section"><h3>🛒 商店</h3>');
            const silverAmount = Math.round(res['silver'] || 0);
            html += `<div style="margin-bottom:8px;font-size:0.85rem">${t('💰 你的銀幣：')}<strong>${silverAmount}</strong></div>`;
            const shopItems = this.world?.shop?.getAvailableItems(this.world) || [];
            const categories = { basic: t('基本物資'), craft: t('工藝品'), processed: t('加工品'), luxury: t('奢侈品') };
            for (const [catKey, catName] of Object.entries(categories)) {
                const catItems = shopItems.filter(i => i.category === catKey);
                if (catItems.length === 0) continue;
                html += `<div style="font-weight:bold;font-size:0.78rem;margin:8px 0 4px;color:var(--text-secondary)">${catName}</div>`;
                html += '<div class="shop-grid">';
                for (const item of catItems) {
                    html += `<div class="shop-card">`;
                    html += `<div class="shop-card-icon">${item.icon}</div>`;
                    html += `<div class="shop-card-name">${t(item.name)}</div>`;
                    html += `<div class="shop-card-stock">${t('庫存')}:${Math.round(item.stock)}</div>`;
                    html += `<button class="shop-card-btn shop-buy" data-action="shop-buy" data-val="${item.key},1" ${item.canBuy?'':'disabled'}>${t('買')}${item.buyPrice}💰</button>`;
                    html += `<button class="shop-card-btn shop-sell" data-action="shop-sell" data-val="${item.key},1" ${item.canSell?'':'disabled'}>${t('賣')}${item.sellPrice}💰</button>`;
                    html += `</div>`;
                }
                html += '</div>';
            }
            html += '</div>';
        } else if (this._economySubTab === 'building') {
            // Buildings
            const buildings = this.state.buildings || {};
            html += t('<div class="econ-section"><h3>建築</h3>');
            if (buildings.in_progress?.length) {
                html += '<div class="building-progress">';
                buildings.in_progress.forEach(p => {
                    const pct = Math.round((p.workDone / p.workRequired) * 100);
                    html += `<div class="building-item"><span>${t(p.name)}</span>
                        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                        <span class="progress-text">${pct}%</span></div>`;
                });
                html += '</div>';
            }
            if (buildings.completed?.length) {
                html += t('<div class="completed-buildings"><div class="build-label">已完成：</div>');
                buildings.completed.forEach(p => {
                    const lvl = p.level || 1;
                    const stars = '⭐'.repeat(lvl);
                    html += `<div class="completed-building-item"><span>${t(p.name)}</span><span class="building-level">${stars} Lv.${lvl}</span></div>`;
                });
                html += '</div>';
            }
            // Upgradeable buildings
            const upgradeable = this.world.buildings.getUpgradeable(this.world);
            if (upgradeable.length) {
                html += t('<div class="available-buildings"><div class="build-label">🔨 升級：</div>');
                upgradeable.forEach(u => {
                    const costStr = Object.entries(u.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                    const effStr = Object.entries(u.effects).map(([k,v]) => `${k}:${v>0?'+':''}${v}`).join(' ');
                    html += `<div class="build-option ${u.can_afford ? '' : 'cant-afford'}">
                        <div class="build-name">${t(u.name)} <span class="building-level">Lv.${u.currentLevel}→${u.nextLevel}</span></div>
                        <div class="build-desc">${u.description}</div>
                        <div class="build-cost">${costStr}</div>
                        <div class="build-effects" style="font-size:0.75rem;color:var(--accent-gold)">${effStr}</div>
                        <button class="build-btn" ${u.can_afford ? '' : 'disabled'} data-action="upgrade-building" data-val="${u.buildingKey}">${t('升級')}</button></div>`;
                });
                html += '</div>';
            }
            const available = this.world.buildings.getAvailable(this.world);
            if (available.length) {
                html += t('<div class="available-buildings"><div class="build-label">建造：</div>');
                available.forEach(p => {
                    const costStr = Object.entries(p.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                    html += `<div class="build-option ${p.can_afford ? '' : 'cant-afford'}">
                        <div class="build-name">${t(p.name)}</div>
                        <div class="build-desc">${p.description}</div>
                        <div class="build-cost">${costStr}</div>
                        <button class="build-btn" ${p.can_afford ? '' : 'disabled'} data-action="build" data-val="${p.key}">${t('建造')}</button></div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            // v4.8.0 裝飾擺放目錄
            html += `<div class="econ-section"><h3>🌸 ${t('裝飾小鎮')}</h3>
                <div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:6px">${t('選一樣裝飾,然後點地圖上的空地擺放。裝飾提升小鎮美觀度,路燈晚上會亮!')}</div>`;
            const decoCount = (this.world?.decorations || []).length;
            html += `<div style="font-size:0.7rem;color:var(--accent);margin-bottom:6px">${t('已擺放')}:${decoCount} ${t('件')}</div>`;
            for (const d of this._decorDefs()) {
                const costStr = Object.entries(d.cost).map(([k, v]) => `${{silver:'💰',wood:'🪵',stone:'🪨',metal:'⚙️'}[k] || k}${v}`).join(' ');
                const afford = Object.entries(d.cost).every(([k, v]) => (this.world?.stockpile?.get(k) || 0) >= v);
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:5px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px">
                    <span style="font-size:0.82rem">${d.icon} ${t(d.name)} <span style="font-size:0.68rem;color:var(--text-secondary)">${t('美觀')}+${d.beauty}</span></span>
                    <span style="display:flex;gap:8px;align-items:center">
                        <span style="font-size:0.7rem;color:var(--text-secondary)">${costStr}</span>
                        <button class="trade-btn" data-action="decor-place" data-val="${d.type}" ${afford ? '' : 'disabled style="opacity:0.4"'}>${t('擺放')}</button>
                    </span></div>`;
            }
            html += `<div style="font-size:0.66rem;color:var(--text-secondary);margin-top:4px">${t('擺放模式中點到已有的裝飾 = 移除(退回一半材料)')}</div></div>`;
            // v4.9.0 相鄰組合圖鑑(開羅式:未發現的顯示 ???)
            if (typeof COMBO_DEFS !== 'undefined') {
                const found = new Set(this.world?.combosFound || []);
                html += `<div class="econ-section"><h3>✨ ${t('相鄰組合')} (${found.size}/${COMBO_DEFS.length})</h3>
                    <div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:6px">${t('把相配的建築和裝飾放在附近(4格內)會觸發組合,提升美觀與繁榮!組合配方要自己摸索')}</div>`;
                for (const c of COMBO_DEFS) {
                    const isFound = found.has(c.id);
                    html += `<div style="display:flex;justify-content:space-between;padding:5px 10px;margin-bottom:4px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:0.75rem;${isFound ? '' : 'opacity:0.5'}">
                        <span>${isFound ? c.icon + ' ' + c.name : '❓ ???'}</span>
                        <span style="color:var(--text-secondary);font-size:0.68rem">${isFound ? c.desc : t('尚未發現')}</span></div>`;
                }
                html += '</div>';
            }
        } else if (this._economySubTab === 'factory') {
            // Factory (merged from old factory tab)
            const proc = this.state.processing || {};
            const factories = proc.builtFactories || {};
            html += t('<div class="econ-section"><h3>🏭 工廠加工</h3></div>');
            for (const [key, factory] of Object.entries(factories)) {
                const def = typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
                if (!def) continue;
                html += `<div class="econ-section"><h3>${def.icon} ${t(def.name)}`;
                if (factory.status === 'building') html += `${t(' (建造中 ')}${Math.round(factory.buildProgress / factory.buildRequired * 100)}%)`;
                html += '</h3>';
                if (factory.status === 'active') {
                    html += t('<div style="margin:4px 0"><strong>配方：</strong>');
                    def.recipes.forEach(r => {
                        const active = factory.recipe === r.id ? ' style="background:var(--accent-gold);color:#000"' : '';
                        html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem"${active} data-action="set-recipe" data-val="${key},${r.id}">${r.label}</button>`;
                    });
                    html += '</div>';
                    html += `${t('<div style="margin:4px 0;font-size:0.8rem"><strong>工人：</strong>')}${factory.workers.length}/${def.workerSlots}${factory.workers.length < def.workerSlots ? ` <span style="color:var(--text-muted);font-size:0.68rem">${t('（村民明早會自動上工）')}</span>` : ''}`;
                    factory.workers.forEach(wId => {
                        const a = this.state.agents[wId];
                        html += ` <span style="color:var(--accent-gold)">${a?.name || wId}</span>`;
                    });
                    if (factory.workers.length < def.workerSlots) {
                        const avail = Object.entries(this.state.agents).filter(([id, a]) =>
                            id !== 'player' && !factory.workers.includes(id) && (!a.status_text || a.status_text === 'normal')
                        );
                        if (avail.length > 0) {
                            html += '<br>';
                            avail.slice(0, 5).forEach(([id, a]) => {
                                html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="assign-worker" data-val="${key},${id}">+${t(a.name)}</button>`;
                            });
                        }
                    }
                    html += '</div>';
                    if (factory.recipe) {
                        const recipe = def.recipes.find(r => r.id === factory.recipe);
                        if (recipe) {
                            const pct = Math.round(factory.productionProgress / recipe.time * 100);
                            html += `${t('<div style="font-size:0.75rem;margin:4px 0">生產進度：')}${pct}%</div>`;
                        }
                    }
                    const wh = factory.warehouse || {};
                    if (Object.keys(wh).length > 0) {
                        html += t('<div style="margin:4px 0;font-size:0.8rem"><strong>倉庫：</strong>');
                        for (const [r, amt] of Object.entries(wh)) {
                            html += `<span style="margin-right:8px">${icons[r] || '📦'}${labels[r] || r}: ${amt}`;
                            html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="collect-product" data-val="${key},${r},${amt}${t('">收</button>')}`;
                            html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="sell-product" data-val="${key},${r},${amt}${t('">賣</button></span>')}`;
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';
            }
            // Available to build
            const availFac = this.world.processing.getAvailableFactories(this.world);
            if (availFac.length > 0) {
                html += t('<div class="econ-section"><h3>可建造工廠</h3>');
                availFac.forEach(f => {
                    // v5.53.2 工廠成本在地化:接上與全站一致的資源名稱,不再露出英文 key
                    const costStr = Object.entries(f.cost).map(([r,a]) => `${icons[r] || '📦'}${labels[r] || r}×${a}`).join(' ');
                    const canBuild = f.canAfford ? '' : ' disabled';
                    html += `<div class="build-card"><div><strong>${f.icon} ${t(f.name)}</strong>
                        <br><span style="font-size:0.7rem">${costStr}${t(' | 建造天數：')}${f.buildDays}</span></div>
                        <button class="trade-btn"${canBuild} data-action="build-factory" data-val="${f.key}${t('">建造</button></div>')}`;
                });
                html += '</div>';
            }
            // Active orders
            const orders = (proc.orders || []).filter(o => o.status === 'active');
            if (orders.length > 0) {
                html += t('<div class="econ-section"><h3>📋 訂單</h3>');
                orders.forEach(o => {
                    html += `<div class="build-card"><div><strong>${o.description}</strong>
                        <br><span style="font-size:0.7rem">${t('獎勵：')}${o.reward}${t('銀幣 | 剩餘')}${o.daysLeft}${t('天')}</span></div>
                        <button class="trade-btn" data-action="fulfill-order" data-val="${o.id}${t('">完成</button></div>')}`;
                });
                html += '</div>';
            }
        }
        html += '</div>';
        container.innerHTML = html;
    },

    executeTrade(offerIdx, qty) {
        const result = this.world.trade.executeTrade(offerIdx, qty, this.world);
        if (result.error) console.warn('Trade failed:', result.error);
        else if (this.world.questSystem) this.world.questSystem.onTrade();
        this.state = this.world.getState();
        this.renderSidebar();
    },

    startBuilding(key) {
        // v4.9.0 建築選址制:先讓玩家點地圖挑位置,再開工
        this._enterSiteMode(key);
    },

    startBuildingUpgrade(buildingKey) {
        this.world.buildings.startUpgrade(buildingKey, this.world);
        this.state = this.world.getState();
        this.renderSidebar();
    },

    startResearch(key) {
        this.world.research.startResearch(key);
        this.state = this.world.getState();
        this.renderSidebar();
    },

    _renderAgentFactions(agentId) {
        const factionData = this.state?.factions || {};
        const factions = Object.values(factionData.factions || {}).filter(f => f.members.includes(agentId));
        if (!factions.length) return '';
        let html = t('<div class="detail-section"><h3>社交圈</h3>');
        factions.forEach(f => {
            const others = f.members.filter(id => id !== agentId).map(id => {
                const a = this.state.agents[id]; return a ? a.name : '?';
            }).join('、');
            html += `<div class="faction-mini">${f.icon} <strong>${t(f.name)}${t('</strong> <span style="font-size:0.7rem;color:var(--text-secondary)">同伴：')}${others}</span></div>`;
        });
        html += '</div>';
        return html;
    },

    sendExpedition(zoneId) {
        const selectEl = document.getElementById(`explore-select-${zoneId}`);
        if (!selectEl) return;
        const selectedIds = Array.from(selectEl.selectedOptions).map(o => o.value);
        if (selectedIds.length === 0) { this._gameAlert(t('請選擇至少一名居民！'), '👥'); return; }
        const result = this.world.exploration.sendExpedition(this.world, zoneId, selectedIds);
        if (!result) { this._gameAlert(t('無法派遣探險隊。'), '❌'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    },

    selectAgent(agentId) {
        this.selectedAgent = agentId;
        this.activeTab = 'detail';
        if (this._updateTabHighlight) this._updateTabHighlight('detail');
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('mobile-collapsed');
        this.render();
    },

    // ============================================================
    // Industry Tab
    // ============================================================
    // ============================================================
    // Merged Industry + Farm Tab (產業總覽)
    // ============================================================
    renderIndustryAndFarm(container) {
        if (!this.state) return;
        const ind = this.state.industry || {};
        const farm = this.state.farm || {};
        const plots = farm.plots || [];
        // Sub-tab state
        if (!this._industrySubTab) this._industrySubTab = 'overview';
        let html = '<div class="economy-panel">';
        // Sub-tab navigation
        html += '<div class="sub-tab-bar">';
        const subTabs = [
            { key:'overview', label:t('總覽'), icon:'🏘️' },
            { key:'farm', label:t('農場'), icon:'🌾' },
        ];
        subTabs.forEach(_tw => {
            const active = this._industrySubTab === _tw.key ? ' class="active"' : '';
            html += `<button${active} data-action="industry-subtab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
        });
        html += '</div>';
        if (this._industrySubTab === 'overview') {
            // Town level
            html += `${t('<div class="econ-section"><h3>🏘️ 小鎮等級：')}${ind.townLevelName || t('荒村')} (Lv${ind.townLevel || 1})</h3>`;
            html += `${t('<div style="font-size:0.8rem;color:var(--text-secondary)">產業上限：')}${ind.maxIndustries || 1}${t(' | 已開啟：')}${Object.keys(ind.industries || {}).length}</div></div>`;
            // Needs initial industry choice
            if (ind.needsIndustryChoice) {
                html += t('<div class="econ-section"><h3>選擇你的第一個產業</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">選擇</button></div>')}`;
                });
                html += '</div>';
            }
            // Active industries
            if (ind.industries && Object.keys(ind.industries).length > 0) {
                html += t('<div class="econ-section"><h3>產業列表</h3>');
                for (const [key, data] of Object.entries(ind.industries)) {
                    const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
                    const lvDef = def?.levels?.find(l => l.lv === data.level);
                    const nextLv = def?.levels?.find(l => l.lv === data.level + 1);
                    html += `<div class="build-card"><div><strong>${def?.icon || '?'} ${def?.name || key} Lv${data.level}</strong>`;
                    if (lvDef) html += `<br><span style="font-size:0.75rem">${lvDef.bonus || lvDef.name}</span>`;
                    html += `${t('<br><span style="font-size:0.75rem;color:var(--text-secondary)">工人：')}${Array.isArray(data.workers) ? data.workers.length : data.workers}/${lvDef?.workers || '?'}</span>`;
                    if (data.dailyOutput && Object.keys(data.dailyOutput).length) {
                        const outputStr = Object.entries(data.dailyOutput).map(([r,a]) => `${this._resName(r)}×${Math.round(a*10)/10}`).join(' ');
                        html += `<br><span style="font-size:0.7rem;color:var(--accent-gold)">📦 ${outputStr}</span>`;
                    }
                    html += '</div>';
                    if (nextLv) {
                        const costStr = Object.entries(nextLv.cost).map(([r,a]) => `${this._resName(r)}×${a}`).join(' ');
                        html += `<div><button class="trade-btn" data-action="upgrade-industry" data-val="${key}${t('">升級 Lv')}${nextLv.lv}</button>
                            <div style="font-size:0.75rem;color:var(--text-secondary)">${costStr}</div></div>`;
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            // Pending unlock
            if (ind._pendingUnlock) {
                html += t('<div class="econ-section"><h3>可開啟新產業！</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">開啟</button></div>')}`;
                });
                html += '</div>';
            }
            // Synergies
            if (ind.activeSynergies && ind.activeSynergies.length > 0) {
                html += t('<div class="econ-section"><h3>產業加成</h3>');
                ind.activeSynergies.forEach(s => {
                    html += `<div style="font-size:0.8rem;margin:4px 0">${s.icon} ${t(s.name)}</div>`;
                });
                html += '</div>';
            }
        } else if (this._industrySubTab === 'farm') {
            // Farm sub-tab content
            const stateIcons = { empty:'🟫', tilled:'🟤', growing:'🌱', ready:'✅', withered:'🥀' };
            const stateLabels = { empty:t('空地'), tilled:t('已翻土'), growing:t('生長中'), ready:t('可收穫'), withered:t('枯萎') };
            html += `${t('<div class="econ-section"><h3>🌾 農場（')}${plots.length}/${farm.maxPlots || 0}${t(' 塊田）</h3></div>')}`;
            if (plots.length === 0) {
                html += t('<div class="econ-section"><p class="muted-text">需要先開啟農業產業才能使用農場。</p></div>');
            }
            for (const plot of plots) {
                const crop = plot.crop ? (typeof CROPS !== 'undefined' ? CROPS[plot.crop] : null) : null;
                html += `<div class="build-card"><div>`;
                html += `<strong>${stateIcons[plot.state] || '?'}${t(' 田地 #')}${plot.id}</strong> — ${stateLabels[plot.state] || plot.state}`;
                if (crop && plot.state === 'growing') {
                    html += `<br><span style="font-size:0.75rem">${crop.icon} ${t(crop.name)}${t(' | 進度：')}${Math.round(plot.growthProgress)}${t('% | 水分：')}${Math.round(plot.waterLevel)}%</span>`;
                    if (plot.fertilized) html += ' 🧪';
                } else if (crop && plot.state === 'ready') {
                    html += `<br><span style="font-size:0.75rem">${crop.icon} ${t(crop.name)}${t(' — 可收穫！</span>')}`;
                }
                html += '</div><div>';
                if (plot.state === 'empty') {
                    html += `<button class="trade-btn" data-action="till-plot" data-val="${plot.id}${t('">翻土</button>')}`;
                } else if (plot.state === 'tilled') {
                    const farmInd = this.world.industry?.industries?.farming;
                    const farmLevel = farmInd?.level || 1;
                    const crops = this.world.farm.getAvailableCrops(farmLevel);
                    const seasonCrops = crops.filter(c => c.seasons.includes(this.world.clock.season));
                    if (seasonCrops.length > 0) {
                        html += '<div style="font-size:0.7rem">';
                        seasonCrops.forEach(c => {
                            html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="plant-crop" data-val="${plot.id},${c.key}">${c.icon}${t(c.name)}</button>`;
                        });
                        html += '</div>';
                    } else {
                        html += t('<span style="font-size:0.7rem;color:var(--text-secondary)">本季無可種作物</span>');
                    }
                } else if (plot.state === 'growing') {
                    html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="water-plot" data-val="${plot.id}${t('">💧澆水</button>')}`;
                    if (!plot.fertilized) html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="fertilize-plot" data-val="${plot.id}${t('">🧪施肥</button>')}`;
                } else if (plot.state === 'ready') {
                    html += `<button class="trade-btn" data-action="harvest-plot" data-val="${plot.id}${t('">🌾收穫</button>')}`;
                } else if (plot.state === 'withered') {
                    html += `<button class="trade-btn" data-action="clear-withered" data-val="${plot.id}${t('">清除</button>')}`;
                }
                html += '</div></div>';
            }
            // Recent harvests
            const log = farm.harvestLog || [];
            if (log.length > 0) {
                html += t('<div class="econ-section"><h3>收穫紀錄</h3>');
                log.slice(-5).reverse().forEach(h => {
                    html += `<div style="font-size:0.75rem;margin:2px 0">${h.cropName} x${h.amount}（${h.quality}）— ${t(h.season)}${t(' 第')}${h.day}${t('天</div>')}`;
                });
                html += '</div>';
            }
        }
        html += '</div>';
        container.innerHTML = html;
    },

    renderIndustry(container) {
        if (!this.state) return;
        const ind = this.state.industry || {};
        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>🏘️ 小鎮等級：')}${ind.townLevelName || t('荒村')} (Lv${ind.townLevel || 1})</h3>`;
        html += `${t('<div style="font-size:0.8rem;color:var(--text-secondary)">產業上限：')}${ind.maxIndustries || 1}${t(' | 已開啟：')}${Object.keys(ind.industries || {}).length}</div></div>`;

        // Needs initial industry choice
        if (ind.needsIndustryChoice) {
            html += t('<div class="econ-section"><h3>選擇你的第一個產業</h3>');
            const available = this.world.industry.getAvailableIndustries(this.world);
            available.forEach(i => {
                html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                    <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">選擇</button></div>')}`;
            });
            html += '</div>';
        }

        // Active industries
        if (ind.industries && Object.keys(ind.industries).length > 0) {
            html += t('<div class="econ-section"><h3>產業列表</h3>');
            for (const [key, data] of Object.entries(ind.industries)) {
                const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[key] : null;
                const lvDef = def?.levels?.find(l => l.lv === data.level);
                const nextLv = def?.levels?.find(l => l.lv === data.level + 1);
                html += `<div class="build-card"><div><strong>${def?.icon || '?'} ${def?.name || key} Lv${data.level}</strong>`;
                if (lvDef) html += `<br><span style="font-size:0.75rem">${lvDef.bonus || lvDef.name}</span>`;
                html += `${t('<br><span style="font-size:0.75rem;color:var(--text-secondary)">工人：')}${Array.isArray(data.workers) ? data.workers.length : data.workers}/${lvDef?.workers || '?'}</span>`;
                if (data.dailyOutput && Object.keys(data.dailyOutput).length) {
                    const outputStr = Object.entries(data.dailyOutput).map(([r,a]) => `${this._resName(r)}×${Math.round(a*10)/10}`).join(' ');
                    html += `<br><span style="font-size:0.7rem;color:var(--accent-gold)">📦 ${outputStr}</span>`;
                }
                html += '</div>';
                if (nextLv) {
                    const costStr = Object.entries(nextLv.cost).map(([r,a]) => `${this._resName(r)}×${a}`).join(' ');
                    html += `<div><button class="trade-btn" data-action="upgrade-industry" data-val="${key}${t('">升級 Lv')}${nextLv.lv}</button>
                        <div style="font-size:0.75rem;color:var(--text-secondary)">${costStr}</div></div>`;
                }
                html += '</div>';
            }
            html += '</div>';
        }

        // Pending unlock
        if (ind._pendingUnlock) {
            html += t('<div class="econ-section"><h3>可開啟新產業！</h3>');
            const available = this.world.industry.getAvailableIndustries(this.world);
            available.forEach(i => {
                html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                    <button class="trade-btn" data-action="choose-industry" data-val="${i.key}${t('">開啟</button></div>')}`;
            });
            html += '</div>';
        }

        // Synergies
        if (ind.activeSynergies && ind.activeSynergies.length > 0) {
            html += t('<div class="econ-section"><h3>產業加成</h3>');
            ind.activeSynergies.forEach(s => {
                html += `<div style="font-size:0.8rem;margin:4px 0">${s.icon} ${t(s.name)}</div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    },

    _chooseIndustry(key) {
        const result = this.world.industry.chooseIndustry(key, this.world);
        if (!result.ok) { this._gameAlert(result.error, '⚠️'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    },
    _upgradeIndustry(key) {
        const result = this.world.industry.upgradeIndustry(key, this.world);
        if (!result.ok) { this._gameAlert(result.error, '⚠️'); return; }
        this.state = this.world.getState();
        this.renderSidebar();
    },

    // ============================================================
    // Farm Tab
    // ============================================================
    renderFarm(container) {
        if (!this.state) return;
        const farm = this.state.farm || {};
        const plots = farm.plots || [];
        const stateIcons = { empty:'🟫', tilled:'🟤', growing:'🌱', ready:'✅', withered:'🥀' };
        const stateLabels = { empty:t('空地'), tilled:t('已翻土'), growing:t('生長中'), ready:t('可收穫'), withered:t('枯萎') };

        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>🌾 農場（')}${plots.length}/${farm.maxPlots || 0}${t(' 塊田）</h3></div>')}`;

        if (plots.length === 0) {
            html += t('<div class="econ-section"><p class="muted-text">需要先開啟農業產業才能使用農場。</p></div>');
        }

        // Plots
        for (const plot of plots) {
            const crop = plot.crop ? (typeof CROPS !== 'undefined' ? CROPS[plot.crop] : null) : null;
            html += `<div class="build-card"><div>`;
            html += `<strong>${stateIcons[plot.state] || '?'}${t(' 田地 #')}${plot.id}</strong> — ${stateLabels[plot.state] || plot.state}`;
            if (crop && plot.state === 'growing') {
                html += `<br><span style="font-size:0.75rem">${crop.icon} ${t(crop.name)}${t(' | 進度：')}${Math.round(plot.growthProgress)}${t('% | 水分：')}${Math.round(plot.waterLevel)}%</span>`;
                if (plot.fertilized) html += ' 🧪';
            } else if (crop && plot.state === 'ready') {
                html += `<br><span style="font-size:0.75rem">${crop.icon} ${t(crop.name)}${t(' — 可收穫！</span>')}`;
            }
            html += '</div><div>';
            if (plot.state === 'empty') {
                html += `<button class="trade-btn" data-action="till-plot" data-val="${plot.id}${t('">翻土</button>')}`;
            } else if (plot.state === 'tilled') {
                // Show crop selection
                const farmInd = this.world.industry?.industries?.farming;
                const farmLevel = farmInd?.level || 1;
                const crops = this.world.farm.getAvailableCrops(farmLevel);
                const seasonCrops = crops.filter(c => c.seasons.includes(this.world.clock.season));
                if (seasonCrops.length > 0) {
                    html += '<div style="font-size:0.7rem">';
                    seasonCrops.forEach(c => {
                        html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="plant-crop" data-val="${plot.id},${c.key}">${c.icon}${t(c.name)}</button>`;
                    });
                    html += '</div>';
                } else {
                    html += t('<span style="font-size:0.7rem;color:var(--text-secondary)">本季無可種作物</span>');
                }
            } else if (plot.state === 'growing') {
                html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="water-plot" data-val="${plot.id}${t('">💧澆水</button>')}`;
                if (!plot.fertilized) html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem" data-action="fertilize-plot" data-val="${plot.id}${t('">🧪施肥</button>')}`;
            } else if (plot.state === 'ready') {
                html += `<button class="trade-btn" data-action="harvest-plot" data-val="${plot.id}${t('">🌾收穫</button>')}`;
            } else if (plot.state === 'withered') {
                html += `<button class="trade-btn" data-action="clear-withered" data-val="${plot.id}${t('">清除</button>')}`;
            }
            html += '</div></div>';
        }

        // Recent harvests
        const log = farm.harvestLog || [];
        if (log.length > 0) {
            html += t('<div class="econ-section"><h3>收穫紀錄</h3>');
            log.slice(-5).reverse().forEach(h => {
                html += `<div style="font-size:0.75rem;margin:2px 0">${h.cropName} x${h.amount}（${h.quality}）— ${h.season}${t(' 第')}${h.day}${t('天</div>')}`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    },

    _tillPlot(plotId) {
        const r = this.world.farm.tillPlot(plotId);
        if (!r.ok) { this._gameAlert(r.error || t('無法翻土'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    },
    _plantCrop(plotId, cropKey) {
        const r = this.world.farm.plantCrop(plotId, cropKey, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法種植'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    },
    _waterPlot(plotId) {
        this.world.farm.waterPlot(plotId);
        this.state = this.world.getState(); this.renderSidebar();
    },
    _fertilizePlot(plotId) {
        const r = this.world.farm.fertilizePlot(plotId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法施肥'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    },
    _harvestPlot(plotId) {
        const r = this.world.farm.harvestPlot(plotId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法收穫'), '⚠️'); return; }
        if (this.world.questSystem) this.world.questSystem.onHarvest();
        this.state = this.world.getState(); this.renderSidebar();
    },
    _clearWithered(plotId) {
        this.world.farm.clearWithered(plotId);
        this.state = this.world.getState(); this.renderSidebar();
    },

    // ============================================================
    // Factory Tab
    // ============================================================
    renderFactory(container) {
        if (!this.state) return;
        const proc = this.state.processing || {};
        const factories = proc.builtFactories || {};

        let html = '<div class="economy-panel">';
        html += t('<div class="econ-section"><h3>🏭 工廠加工</h3></div>');

        // Built factories
        for (const [key, factory] of Object.entries(factories)) {
            const def = typeof FACTORIES !== 'undefined' ? FACTORIES[key] : null;
            if (!def) continue;
            html += `<div class="econ-section"><h3>${def.icon} ${t(def.name)}`;
            if (factory.status === 'building') {
                html += `${t(' (建造中 ')}${Math.round(factory.buildProgress / factory.buildRequired * 100)}%)`;
            }
            html += '</h3>';

            if (factory.status === 'active') {
                // Recipe selection
                html += t('<div style="margin:4px 0"><strong>配方：</strong>');
                def.recipes.forEach(r => {
                    const active = factory.recipe === r.id ? ' style="background:var(--accent-gold);color:#000"' : '';
                    html += `<button class="trade-btn" style="margin:2px;font-size:0.7rem"${active} data-action="set-recipe" data-val="${key},${r.id}">${r.label}</button>`;
                });
                html += '</div>';

                // Workers
                html += `${t('<div style="margin:4px 0;font-size:0.8rem"><strong>工人：</strong>')}${factory.workers.length}/${def.workerSlots}${factory.workers.length < def.workerSlots ? ` <span style="color:var(--text-muted);font-size:0.68rem">${t('（村民明早會自動上工）')}</span>` : ''}`;
                factory.workers.forEach(wId => {
                    const a = this.state.agents[wId];
                    html += ` <span style="color:var(--accent-gold)">${a?.name || wId}</span>`;
                });
                if (factory.workers.length < def.workerSlots) {
                    // Show assignable NPCs
                    const available = Object.entries(this.state.agents).filter(([id, a]) =>
                        id !== 'player' && !factory.workers.includes(id) &&
                        (!a.status_text || a.status_text === 'normal')
                    );
                    if (available.length > 0) {
                        html += '<br>';
                        available.slice(0, 5).forEach(([id, a]) => {
                            html += `<button class="trade-btn" style="margin:2px;font-size:0.75rem" data-action="assign-worker" data-val="${key},${id}">+${t(a.name)}</button>`;
                        });
                    }
                }
                html += '</div>';

                // Production progress
                if (factory.recipe) {
                    const recipe = def.recipes.find(r => r.id === factory.recipe);
                    if (recipe) {
                        const pct = Math.round(factory.productionProgress / recipe.time * 100);
                        html += `${t('<div style="font-size:0.75rem;margin:4px 0">生產進度：')}${pct}%</div>`;
                    }
                }

                // Warehouse
                const wh = factory.warehouse || {};
                if (Object.keys(wh).length > 0) {
                    html += t('<div style="margin:4px 0;font-size:0.8rem"><strong>倉庫：</strong>');
                    for (const [res, amt] of Object.entries(wh)) {
                        html += `<span style="margin-right:8px">${res}: ${amt}`;
                        html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="collect-product" data-val="${key},${res},${amt}${t('">收</button>')}`;
                        html += ` <button class="trade-btn" style="font-size:0.6rem;padding:1px 4px" data-action="sell-product" data-val="${key},${res},${amt}${t('">賣</button>')}`;
                        html += '</span>';
                    }
                    html += '</div>';
                }
            }
            html += '</div>';
        }

        // Available to build
        const available = this.world.processing.getAvailableFactories(this.world);
        if (available.length > 0) {
            html += t('<div class="econ-section"><h3>可建造工廠</h3>');
            available.forEach(f => {
                const costStr = Object.entries(f.cost).map(([r,a]) => `${this._resName(r)}×${a}`).join(' ');
                const canBuild = f.canAfford ? '' : ' disabled';
                html += `<div class="build-card"><div><strong>${f.icon} ${t(f.name)}</strong>
                    <br><span style="font-size:0.7rem">${costStr}${t(' | 建造天數：')}${f.buildDays}</span></div>
                    <button class="trade-btn"${canBuild} data-action="build-factory" data-val="${f.key}${t('">建造</button></div>')}`;
            });
            html += '</div>';
        }

        // Active orders
        const orders = (proc.orders || []).filter(o => o.status === 'active');
        if (orders.length > 0) {
            html += t('<div class="econ-section"><h3>📋 訂單</h3>');
            orders.forEach(o => {
                html += `<div class="build-card"><div><strong>${o.description}</strong>
                    <br><span style="font-size:0.7rem">${t('獎勵：')}${o.reward}${t('銀幣 | 剩餘')}${o.daysLeft}${t('天')}</span></div>
                    <button class="trade-btn" data-action="fulfill-order" data-val="${o.id}${t('">完成</button></div>')}`;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    },

    _buildFactory(key) {
        const r = this.world.processing.buildFactory(key, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法建造'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    },
    _setRecipe(factoryKey, recipeId) {
        this.world.processing.setRecipe(factoryKey, recipeId);
        this.state = this.world.getState(); this.renderSidebar();
    },
    _assignWorker(factoryKey, agentId) {
        this.world.processing.assignWorker(factoryKey, agentId);
        this.state = this.world.getState(); this.renderSidebar();
    },
    _collectProduct(factoryKey, resource, amount) {
        this.world.processing.collectProduct(factoryKey, resource, amount, this.world);
        this.state = this.world.getState(); this.renderSidebar();
    },
    _sellProduct(factoryKey, resource, amount) {
        this.world.processing.sellProduct(factoryKey, resource, amount, this.world);
        this.state = this.world.getState(); this.renderSidebar();
    },
    _fulfillOrder(orderId) {
        const r = this.world.processing.fulfillOrder(orderId, this.world);
        if (!r.ok) { this._gameAlert(r.error || t('無法完成訂單'), '⚠️'); return; }
        this.state = this.world.getState(); this.renderSidebar();
    },
});
