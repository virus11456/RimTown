// RimTown - app-economy.js：從 app.js 拆出的 經濟分頁：倉庫／建築／科技／貿易、產業、農田、工廠（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／sw.js 都要列）。
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
    // v9.7.0 建築升級效果 key → 中文說明(之前直接露出 drought_resistance:+0.3 這種英文)
    _upEffText(k, v) {
        const L = { defense_bonus: ['防禦', 0], raid_chance: ['被襲擊機率', 1], guard_xp_bonus: ['守衛經驗', 1], drought_resistance: ['抗旱', 1], healing_bonus: ['治療效果', 1], farm_bonus: ['農作產量', 1], food_capacity: ['糧倉容量', 0], food_decay: ['食物腐壞', 1], mood_modifier: ['心情', 0], mood_bonus: ['心情', 0], herbs_production: ['每天藥草', 0], recreation_bonus: ['娛樂', 0], trade_bonus: ['交易收益', 1], smithing_bonus: ['打鐵效率', 1], tool_quality: ['工具品質', 1], merchant_frequency: ['商人來訪', 1], xp_bonus: ['技能成長', 1], research_bonus: ['研究速度', 1] };
        const d = L[k]; if (typeof v !== 'number') return `${d ? t(d[0]) : k.replace(/_/g, ' ')}`;
        const pct = d ? d[1] : (Math.abs(v) < 1 && !Number.isInteger(v));
        const n = pct ? `${Math.round(v * 100)}%` : `${Math.round(v * 10) / 10}`;
        return `${d ? t(d[0]) : k.replace(/_/g, ' ')} ${v > 0 ? '+' : ''}${n}`;
    },
    // v5.53.2 資源 key → 在地化名稱(跨分頁共用,修工廠/產業成本露出英文 key 的問題)
    _resName(r) {
        if (!this._resNameMap) this._resNameMap = { salt:t('鹽'), paper:t('紙'), food:t('食物'), wood:t('木材'), stone:t('石材'), metal:t('金屬'), cloth:t('布料'), herbs:t('草藥'), silver:t('銀幣'), meals:t('餐食'), tools:t('工具'), clothing:t('衣物'), medicine:t('藥品'), furniture:t('家具'), research_points:t('研究'),
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

    // v6.14.0 工程捐款 / 鎮公所捐款
    _fundProject(id) {
        const w = this.world; if (!w?.buildings?.fund) return;
        const r = w.buildings.fund(id, w);
        this._showCornerNotice({ icon: r.ok ? '🔨' : '⚠️', title: t('捐建'), name: '', desc: r.msg || '' });
        this.state = w.getState(); try { this.renderSidebar(); } catch (e) {}
    },
    _donateTown() {
        const w = this.world; if (!w?.buildings?.donate) return;
        const r = w.buildings.donate(w);
        this._showCornerNotice({ icon: r.ok ? '🏛️' : '⚠️', title: t('捐給鎮公所'), name: '', desc: r.msg || '' });
        this.state = w.getState(); try { this.renderSidebar(); } catch (e) {}
    },
    // v6.15.0 贊助節慶(節慶前夕到結束之間一次 150 銀幣);經濟分頁與事件分頁共用同一列
    _sponsorFestival() {
        const w = this.world; if (!w?.festivals?.sponsor) return;
        const r = w.festivals.sponsor(w);
        this._showCornerNotice({ icon: r.ok ? '🎪' : '⚠️', title: t('贊助節慶'), name: '', desc: r.msg || '' });
        this.state = w.getState(); try { this.renderSidebar(); } catch (e) {}
    },
    _festivalSponsorHtml() {
        return ''; // v6.37.0 上帝視角:觀察者不贊助;節慶贊助由村民提案(kind festival)
        // eslint-disable-next-line no-unreachable
        const st = this.state?.festivals?.sponsor_status; if (!st?.open) return '';
        const silverNow = this.state?.stockpile?.resources?.silver || 0;
        const when = st.phase === 'eve' ? t('明天開始') : t('進行中');
        const desc = st.sponsored ? t('你已贊助這屆節慶，村民都記得你的大方') : (st.phase === 'eve' ? t('贊助：籌備進度 +50、節慶心情 ×1.5、村民更常聊開、聲望 +10、繁榮 +3') : t('贊助：全鎮心情 +8、村民更常聊開、聲望 +10、繁榮 +3'));
        const btn = st.sponsored ? `<button class="trade-btn" disabled style="padding:3px 10px;font-size:0.72rem;white-space:nowrap">🎪 ${t('已贊助')}</button>`
            : ``;
        return `<div class="festival-sponsor-row" style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.72rem;color:var(--text-secondary)"><span style="flex:1">${st.icon || '🎪'} ${t(st.name)}${t('（')}${when}${t('）')}· ${desc}</span>${btn}</div>`;
    },
    renderEconomy(container) {
        if (!this.state) return;
        // v7.3.0 小鎮分頁只剩一層子分頁:概況／物資／建設／產業(以前「動態」裡還有第二層 資源／科技／商店／建築／工廠)
        const S = { economy: 'overview', 'econ-goods': 'goods', 'econ-build': 'build', 'econ-tech': 'tech', industry: 'industry' }[this.activeTab] || 'overview';
        let html = '<div class="economy-panel">';
        if (S === 'overview') html += this._renderPlayerCaravan(); // v5.92.0 押商隊
        if (S === 'overview' && this._overviewCards && this.world?.observerMode) { container.innerHTML = html + this._overviewCards() + '</div>'; return; } // v9.17.0 概況改成資訊卡

        // Prosperity summary
        const prosp = this.state.prosperity;
        if (prosp && S === 'overview') {
            // v4.6.0 排行榜入口(在繁榮度摘要上方)
            if (!this._lbBtnHtml) this._lbBtnHtml = `<div style="margin:4px 0 8px"><button class="trade-btn" data-action="show-leaderboard" style="width:100%">🏆 ${t('全球繁榮排行榜')}</button></div>`;
            html += this._lbBtnHtml;
            const pColor = prosp.prosperity >= 80 ? '#ffd700' : prosp.prosperity >= 60 ? 'var(--positive)' : prosp.prosperity >= 40 ? 'var(--accent)' : prosp.prosperity >= 20 ? 'var(--text-secondary)' : 'var(--negative)';
            html += `<div class="econ-section" style="padding:8px 12px">`;
            const popCount = Object.keys(this.state.agents || {}).filter(id => id !== 'player').length; // v6.25.0
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
            html += `</div>`; // 關掉維度格子,捐款列放在格子下方(v6.14.1:之前被塞進格子裡)
            // v6.14.0 鎮公所捐款:銀幣的去處之一(繁榮 +1、全鎮心情 +2、聲望 +2,每天三次)
            const bd = this.state.buildings || {}; const left = Number.isFinite(bd.donations_left) ? bd.donations_left : (bd.donate_per_day || 3); const dcost = bd.donate_cost || 100; const silverNow = this.state.stockpile?.resources?.silver || 0;
            html += this._festivalSponsorHtml(); // v6.15.0 節慶前夕到結束之間才出現
            // v6.37.0 上帝視角:觀察者不投錢,捐款列移除
            html += `</div>`;
        }


        if (S === 'overview') { const E = this._eventPieces(['festival', 'weather', 'mods']); html += E.festival + E.weather + E.mods + (this._moneyCardHtml ? this._moneyCardHtml() : '') + this._healthCardHtml() + (this._mythCardHtml ? this._mythCardHtml() : ''); } // v7.3.0 天氣、節慶、生效中的影響從舊「事件」分頁搬來
        const sp = this.state.stockpile || {};
        const res = sp.resources || {};
        const icons = {salt:'🧂',paper:'📄',food:'🌾',wood:'🪵',stone:'🪨',metal:'⚙️',cloth:'🧵',herbs:'🌿',silver:'💰',meals:'🍲',tools:'🔧',clothing:'👕',medicine:'💊',furniture:'🪑',research_points:'📚',
            plank:'🪵',hardwood:'🪓',brick:'🧱',marble:'🏛️',steel:'⚔️',gold:'🥇',
            wheat:'🌾',rice:'🍚',corn:'🌽',potato:'🥔',cotton:'🧶',flowers:'🌸',mushroom:'🍄',sugarcane:'🎋',tea:'🍵',grapes:'🍇',golden_wheat:'✨',dragon_fruit:'🐉',
            bread:'🍞',pastry:'🧁',beer:'🍺',wine:'🍷',perfume:'🌹',fine_tea:'🫖',herbal_tea:'🍃',sugar:'🍬',jam:'🫙',luxury_furniture:'🛋️'};
        const labels = {salt:t('鹽'),paper:t('紙'),food:t('食物'),wood:t('木材'),stone:t('石材'),metal:t('金屬'),cloth:t('布料'),herbs:t('草藥'),silver:t('銀幣'),meals:t('餐食'),tools:t('工具'),clothing:t('衣物'),medicine:t('藥品'),furniture:t('家具'),research_points:t('研究'),
            plank:t('木板'),hardwood:t('硬木'),brick:t('磚塊'),marble:t('大理石'),steel:t('鋼鐵'),gold:t('黃金'),
            wheat:t('小麥'),rice:t('稻米'),corn:t('玉米'),potato:t('馬鈴薯'),cotton:t('棉花'),flowers:t('花卉'),mushroom:t('蘑菇'),sugarcane:t('甘蔗'),tea:t('茶葉'),grapes:t('葡萄'),golden_wheat:t('金色小麥'),dragon_fruit:t('火龍果'),
            bread:t('麵包'),pastry:t('糕點'),beer:t('啤酒'),wine:t('葡萄酒'),perfume:t('香水'),fine_tea:t('精品茶'),herbal_tea:t('草本茶'),sugar:t('砂糖'),jam:t('果醬'),luxury_furniture:t('高級家具')};

        if (S === 'overview' || S === 'goods' || S === 'industry') {
            if (S === 'overview') {
                // v6.54.0 公庫 vs 村民荷包
                try { const ws = typeof WALLET !== 'undefined' && this.world?.wallet ? WALLET.summary(this.world) : null;
                    if (ws) html += `<div class="econ-section"><h3>👛 ${t('村民荷包')}</h3><div style="font-size:0.78rem;line-height:1.6">${t('大家身上合計')} ${ws.total} ${t('銀幣')} · ${t('最有錢')}${t('：')}${this._escapeHtml(t(ws.rich.a.name))} ${Math.round(ws.rich.n)} · ${t('最窮')}${t('：')}${this._escapeHtml(t(ws.poor.a.name))} ${Math.round(ws.poor.n)}${ws.broke ? ` · <span style="color:var(--danger,#E04848)">${t('{n} 人吃不起三餐').replace('{n}', ws.broke)}</span>` : ''}</div><div style="font-size:0.7rem;color:var(--text-muted)">${t('公庫發薪水（先扣 {p}% 稅）；村民自己付三餐、衣服、冬天的柴。提案可以自己出錢、找朋友湊，或請公庫出。').replace('{p}', Math.round(ws.tax * 100))}</div>${ws.bizRate ? `<div style="font-size:0.7rem;color:var(--text-muted)">🏪 ${t('做生意的人（開店、廚師賣餐、裁縫賣衣）收入先繳 {p}% 營業稅，至今繳了 {n} 銀幣').replace('{p}', Math.round(ws.bizRate * 100)).replace('{n}', ws.bizTax)}</div>` : ''}</div>`; } catch (e) {}
                // v7.0.0 物價與就業
                try { if (typeof PRICES !== 'undefined' && this.world?.prices) { const pv = PRICES.view(this.world); const lv = typeof LABOR !== 'undefined' && this.world.labor ? LABOR.view(this.world) : null;
                    html += `<div class="econ-section price-section"><h3>📊 ${t('物價與就業')}</h3><div class="market-meta price-meta">${pv.map(x => `${x.icon} ${x.name} <b>${x.v.toFixed(2)}×</b>${x.trend > 0 ? ' ↑' : x.trend < 0 ? ' ↓' : ''}${t('（')}${x.word}${t('）')}`).join(' · ')}</div>`
                        + (lv ? `<div class="market-meta labor-meta">💼 ${t('失業')} ${lv.unemployed} ${t('人')}${t('（')}${lv.rate}%${t('）')} · ${t('找到工作')} ${lv.stats.hired} · ${t('被裁員')} ${lv.stats.laidOff} · ${t('轉行')} ${lv.stats.switched}${lv.stats.grads ? ` · ${t('成年後第一份工作')} ${lv.stats.grads}` : ''}</div><div class="labor-jobs">${lv.jobs.map(j => `<span class="labor-job${j.filled > j.slots ? ' over' : j.filled < j.slots ? ' open' : ''}">${this._escapeHtml ? this._escapeHtml(j.title) : j.title} ${j.filled}/${j.slots}</span>`).join('')}</div>` : '')
                        + ((typeof CYCLE !== 'undefined' && this.world.cycle) ? (() => { const cv = CYCLE.view(this.world); return `<div class="market-meta cycle-meta">${cv.c >= 0.35 ? '📈' : cv.c <= -0.35 ? '📉' : '⚖️'} ${t('景氣')} <b>${cv.word}</b> ${cv.c >= 0 ? '+' : ''}${cv.c.toFixed(2)}${cv.shock ? ` · ${this._escapeHtml ? this._escapeHtml(cv.shock) : cv.shock}` : ''} · ${t('公共工程')} ${cv.worksN} ${t('次')}${t('（')}${cv.works} ${t('銀幣')}${t('）')}${cv.mono ? ` · ⚠️ ${t('壟斷')}${t('：')}${this._escapeHtml ? this._escapeHtml(cv.mono.name) : cv.mono.name} ${cv.mono.n} ${t('家')}` : ''}${cv.split ? ` · ${t('拆分')} ${cv.split}` : ''}${this.world.cycle?.law ? ` · ${t('反壟斷法生效中')}` : ''}</div>`; })() : '')
                        + ((typeof TRADE !== 'undefined') ? (() => { const tv = TRADE.view(this.world); return `<div class="market-meta trade-meta">🚢 ${t('近 30 天進口')} ${tv.imp} · ${t('出口')} ${tv.exp} · ${tv.bal >= 0 ? t('順差') : t('逆差')} ${Math.abs(tv.bal)} · ${t('進口關稅')} ${tv.tariff}%${tv.duty ? `${t('（')}${t('已收')} ${tv.duty}${t('）')}` : ''} · ${tv.private ? t('商行老闆做進出口') : t('公庫直接跟商人交易')}</div>`; })() : '')
                        + (() => { try { const E = (x) => (this._escapeHtml ? this._escapeHtml(String(x)) : String(x)); let h = '';
                            // v8.9.0 通膨、花錢的去處、公共建設承包
                            if (typeof INFL !== 'undefined' && this.world.infl) { const iv = INFL.view(this.world); h += `<div class="market-meta infl-meta">💹 ${t('物價水準')} <b>${iv.p.toFixed(2)}×</b> · ${t('工資')} <b>${iv.wage.toFixed(2)}×</b>${iv.p / iv.wage >= 1.08 ? ` <span style="color:var(--warn,#e0a040)">${t('（工資跟不上物價）')}</span>` : ''} · ${t('一頓飯')} ${iv.meal} ${t('銀幣')}${iv.raises ? ` · ${t('調薪')} ${iv.raises} ${t('次')}` : ''}</div>`; }
                            if (typeof SPEND !== 'undefined' && this.world.spend) { const sv = SPEND.view(this.world); const bits = [sv.showN ? `🎭 ${t('看戲')} ${sv.showN}` : '', sv.feastN ? `🍷 ${t('宴客')} ${sv.feastN}` : '', sv.artN ? `🖼️ ${t('畫像')} ${sv.artN}` : '', sv.tripN ? `🧳 ${t('外地旅遊')} ${sv.tripN}${t('（')}${Math.round(sv.trip)} ${t('銀幣')}${t('）')}` : '', (sv.feeN || sv.edu) ? `🎓 ${t('外地讀書')} ${sv.feeN || 0}${sv.edu ? ` · ${t('讀完回來')} ${sv.edu}` : ''}` : ''].filter(Boolean); if (bits.length) h += `<div class="market-meta spend-meta">${t('花錢的去處')}${t('：')}${bits.join(' · ')}</div>`; }
                            if (typeof CASINO !== 'undefined') { const cv = CASINO.view(this.world); if (cv) h += `<div class="market-meta casino-meta">🎰 ${cv.ban ? t('全鎮禁賭') : cv.open ? t('賭場「{s}」（老闆 {o}）').replace('{s}', E(cv.name)).replace('{o}', E(cv.owner)) : t('賭場關門了')}${t('：')}${t('累計')} ${cv.st.visits || 0} ${t('人次')} · ${t('莊家淨賺')} ${Math.round((cv.st.house || 0) - (cv.st.paid || 0))} ${t('銀幣')}${cv.st.jack ? ` · 🎉 ${t('一夕致富')} ${cv.st.jack}` : ''}${cv.st.ruin ? ` · 💔 ${t('家破人亡')} ${cv.st.ruin}` : ''}${cv.st.fled ? ` · 🌙 ${t('跑路')} ${cv.st.fled}` : ''}${cv.st.tourists ? ` · 🧳 ${t('外地賭客')} ${cv.st.tourists}${t('（')}${Math.round(cv.st.tour)} ${t('銀幣')}${t('）')}` : ''}</div>`; }
                            if (typeof WORKS !== 'undefined' && this.world.cycle?.wk) { const kv = WORKS.view(this.world); if (kv.list.length) h += `<div class="market-meta works-meta">🏗️ ${t('承包工程')}${t('：')}${kv.list.map(x => `${x.icon} ${E(x.name)} ${x.n} ${t('銀幣')}${t('（')}${E(x.by)}${x.fell ? ' · 💥 ' + t('出事') : ''}${x.crony ? ' · ' + t('跟鎮長很熟') : ''}${t('）')}`).join(' · ')}${kv.st.caught ? ` · ⚖️ ${t('偷工減料被抓')} ${kv.st.caught}` : ''}</div>`; }
                            return h; } catch (e) { return ''; } })()
                        + `<div class="muted-text" style="font-size:0.7rem">${t('倉裡存貨越少越貴（0.6～2.5 倍）；大家手上的錢越多，所有東西都越貴（物價水準），工資會慢慢跟上，但比物價慢。職缺跟著人口走，人太多的行業會裁員。')}</div></div>`; } } catch (e) {}
            }
            if (S === 'industry') {
                // v6.89.0 產業與老闆
                try { if (typeof MARKET !== 'undefined' && this.world?.market) { const rows = MARKET.view(this.world); const hung = Object.values(this.world.market.hungry || {}).filter(n => n >= 1).length;
                    html += `<div class="econ-section market-section"><h3>🏭 ${t('產業與老闆')}</h3><div class="market-meta">${t('產業是大家每天都要買的民生行業（三餐、衣服、柴火、建材），一行一家，老闆會換，行業一直都在。')}</div><div class="market-meta">${t('貧富差距（吉尼係數）')} ${MARKET.gini(this.world)} · ${t('今天沒飯吃')} ${hung} ${t('人')}${this.world.market.deaths ? ` · ${t('餓死')} ${this.world.market.deaths}` : ''}</div>`
                        + ((typeof ESTATE !== 'undefined' && this.world.estate) ? (() => { const e = ESTATE.view(this.world); const B = this.world.bank; return `<div class="market-meta">🏠 ${t('房屋')} ${e.units} ${t('棟')}${t('（')}${t('空屋')} ${e.vacant}${t('、')}${t('公有')} ${e.townOwned}${t('）')} · ${t('房東')} ${e.landlords} ${t('人')} · ${t('平均週租')} ${e.rent} · ${t('無家可歸')} ${e.homelessPeople} ${t('人')} · ${t('傭人')} ${e.servants} ${t('人')}${e.stats.foreclosed ? ` · ${t('被銀行收走')} ${e.stats.foreclosed}` : ''}${(this.world.market.strikes) ? ` · ${t('罷工')} ${this.world.market.strikes} ${t('次')}` : ''}${B?.bankerProfit ? ` · ${t('銀行家利潤')} ${Math.round(B.bankerProfit)}` : ''}</div>`; })() : '')
                        + ((typeof POWER !== 'undefined' && this.world.power) ? (() => { const v = POWER.view(this.world); if (!v.gifts && !v.exposed && !v.spiked && !v.bought && !v.refused) return ''; return `<div class="market-meta power-meta">💰 ${t('政治獻金')} ${v.gifts} ${t('筆')}${t('（')}${v.donated} ${t('銀幣')}${t('）')} · ${t('拒收')} ${v.refused} · 📰 ${t('揭弊')} ${v.exposed} · ${t('新聞被壓下')} ${v.spiked}${v.fired ? ` · ${t('記者被開除')} ${v.fired}` : ''}${v.raised ? ` · ${t('報導後加薪')} ${v.raised}` : ''}${v.recalls ? ` · ${t('罷免改選')} ${v.recalls}` : ''}</div>${v.owned.length ? `<div class="pg-owners"><span class="pg-owners-h">📰 ${t('報社老闆')}</span>${this._icPills(v.owned.map(x => `${this._escapeHtml(x[0])} <b>${this._escapeHtml(x[1])}</b>`))}</div>` : ''}`; /* v9.18.1 報社老闆單獨一列，每家報社一格 */ })() : '')
                        + ((typeof UNION !== 'undefined' && this.world.union?.on) ? (() => { const u = UNION.view(this.world); return `<div class="market-meta union-meta">✊ ${this._escapeHtml ? this._escapeHtml(u.name) : u.name}${t('：')}${t('領袖')} ${this._escapeHtml ? this._escapeHtml(t(u.leader)) : t(u.leader)} · ${t('會員')} ${u.members} ${t('人')} · ${t('罷工基金')} ${u.fund} · ${t('談成加薪')} ${u.won} ${t('次')} · ${t('罷工失敗')} ${u.lost} ${t('次')}${u.fired ? ` · ${t('被開除')} ${u.fired} ${t('人')}` : ''}${u.striking ? ` · ${t('罷工中')}` : ''}</div>`; })() : '')
                        + (rows.length ? rows.map(r => `<div class="market-row"><span class="market-name">${r.icon} ${this._escapeHtml(r.name)}</span><span class="market-owner">${r.owner ? this._escapeHtml(r.owner) : t('公營')}</span><span class="market-num">${t('{n} 人').replace('{n}', r.workers)} · ${t('工資')} ${r.pay}% · ${t('七天營收')} ${r.rev7}／${t('薪水')} ${r.cost7}</span>${r.holders ? `<span class="market-holders">🤝 ${t('股東')}${t('：')}${this._escapeHtml(r.holders)}</span>` : ''}${r.rival ? `<span class="market-rival">⚔️ ${t('對手')}${t('：')}${this._escapeHtml(r.rival.owner)} · ${t('搶到 {p}% 客人').replace('{p}', r.rival.share)} · ${t('價格')} ${r.rival.incPrice}% ${t('對')} ${r.rival.price}% · ${t('{n} 人').replace('{n}', r.rival.staff)} · ${t('工資')} ${r.rival.pay}%${r.rival.partners ? ` · 🤝 ${t('合夥')}${t('：')}${this._escapeHtml(r.rival.partners)}` : ''}</span>` : ''}</div>`).join('')
                            + ((typeof COMPETE !== 'undefined') ? (() => { const v = COMPETE.view(this.world); const c = v.st; if (!c.opened && !v.cap && !c.mgr) return ''; return `<div class="market-meta compete-meta">⚔️ ${t('新開對手店')} ${c.opened} · ${t('收攤')} ${c.closed} · ${t('併購')} ${c.merged} · ${t('價格戰')} ${c.wars} · ${t('跳槽')} ${c.poach}${v.saved ? ` · ${t('村民省下')} ${v.saved} ${t('銀幣')}` : ''}${c.mgr ? ` · 👔 ${t('請掌櫃')} ${c.mgr}${c.caught ? `${t('（')}${t('抓到揩油')} ${c.caught}${t('）')}` : ''}` : ''}${v.cap ? ` · ⚖️ ${t('反壟斷：一人最多 {n} 家').replace('{n}', v.cap)}` : ''}${c.lobby ? ` · 💰 ${t('遊說')} ${c.lobby}${c.exposed ? `${t('（')}${t('被揭發')} ${c.exposed}${t('）')}` : ''}` : ''}</div>`; })() : '')
                            + ((typeof INVEST !== 'undefined') ? (() => { const v = INVEST.view(this.world); const st = v.st; if (!st.buy && !st.out && !st.coop && !v.bank) return ''; return `<div class="market-meta invest-meta">📊 ${t('銀行存款一週')} ${v.bank}%${v.best.length ? ` · ${t('每 1% 股份一週分紅')}${t('：')}${v.best.map(b => this._escapeHtml(b.s) + ' ' + b.y).join(t('、'))}` : ''}${st.buy ? ` · ${t('看利息入股')} ${st.buy}` : ''}${st.out ? ` · ${t('退股存銀行')} ${st.out}` : ''}${st.coop ? ` · 🤝 ${t('合夥開店')} ${st.coop}${st.coopDiv ? `${t('（')}${t('分紅')} ${Math.round(st.coopDiv)}${t('）')}` : ''}` : ''}</div>`; })() : '')
                            + ((typeof EXILE !== 'undefined' && this.world.exile) ? (() => { const v = EXILE.view(this.world); if (!v || (!v.pending.length && !v.hist.length)) return ''; return `<div class="market-meta exile-meta">⏳ ${v.pending.length ? `${t('限期離鎮')}${t('：')}${v.pending.map(p => `${this._escapeHtml(p.name)}${t('（')}${t('剩 {n} 天').replace('{n}', p.left)}${p.n ? `${t('、')}${t('{n} 樣家當待處理').replace('{n}', p.n)}` : ''}${t('）')}`).join(t('、'))}` : ''}${v.hist.length ? `${v.pending.length ? ' · ' : ''}${t('最近離鎮')}${t('：')}${v.hist.slice(0, 3).map(h => `${this._escapeHtml(h.name)}${h.crime ? '⚖️' : ''}${t('（')}${t('帶走 {n} 銀幣').replace('{n}', h.carried)}${t('）')}`).join(t('、'))}` : ''}</div>`; })() : '') // v9.9.4
                            + ((typeof SHARES !== 'undefined') ? (() => { const v = SHARES.view(this.world); const st = v.st; if (!st.syn && !st.sold && !st.buy && !st.out && !st.caught && !st.split && !st.inh) return ''; return `<div class="market-meta shares-meta">📜 ${t('合股買下')} ${st.syn} · ${t('賣股')} ${st.sold} · ${t('入股')} ${st.buy} · ${t('分紅累計')} ${Math.round(st.div)}${st.caught ? ` · ${t('抓到做假帳')} ${st.caught}` : ''}${st.out ? ` · ${t('股東會奪權')} ${st.out}` : ''}${st.split ? ` · ${t('拆夥')} ${st.split}` : ''}</div>` + (v.hist.length ? `<div class="shares-hist">${v.hist.slice(0, 4).map(h => `<span>${this._escapeHtml(h.s)}${t('：')}${this._escapeHtml(h.txt)}${h.a ? `${t('（')}${this._escapeHtml(h.a)}${h.b ? ' / ' + this._escapeHtml(h.b) : ''}${t('）')}` : ''}</span>`).join('')}</div>` : ''); })() : '') : `<div class="muted-text" style="font-size:0.72rem">${t('還沒有人經營產業。')}</div>`) + `</div>`; } } catch (e) {}
            }
            if (S === 'overview') {
                // v6.37.0 上帝視角:村民自己做的事(種收、出貨、談生意、補貨)
                const alog = (this.state.autonomy?.log || []).slice(-6).reverse();
                html += `<div class="econ-section"><h3>👐 ${t('村民自己做的事')}</h3>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${t('農夫種收、工坊出貨、商人談生意、缺什麼去補——都不用你操心。要蓋什麼、研究什麼、買賣大宗，看「提案」。')}</div>
                    ${alog.length ? alog.map(e => `<div style="font-size:0.74rem;padding:3px 0;border-bottom:1px dashed var(--border)">${this._escapeHtml(e.text || '')}</div>`).join('') : `<div class="muted-text" style="font-size:0.72rem">${t('今天還沒有紀錄，村民通常在換日時動手。')}</div>`}
                </div>`;
            }
            // v5.50.0 經濟A波:三層資源結構 —— 關鍵資源 / 加工產能(看流量) / 原料倉庫(燈號)
            const npcCount = Math.max(1, Object.keys(this.state.agents || {}).length - 1);
            // ① 關鍵資源:食物+銀幣,唯二要玩家盯的存量
            // v5.53.0 食物顯示 /糧倉容量(400+穀倉擴容),玩家才知道離腐壞多遠
            const foodAmt = Math.round(res.food || 0), silverAmt = Math.round(res.silver || 0);
            const foodCap = 400 + (this.world?.buildings?.getEffect?.('food_capacity', 0) || 0);
            const overCap = foodAmt > foodCap;
            const foodClr = foodAmt < 50 ? 'var(--negative)' : foodAmt < 200 || overCap ? '#e8b030' : 'var(--positive)';
            const silverClr = silverAmt < 50 ? 'var(--negative)' : silverAmt < 300 ? '#e8b030' : 'var(--positive)';
            if (S === 'overview') {
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
            }
            if (S === 'goods') {
                // v6.77.0 本鎮物產:存糧是什麼(穀物／魚／肉)、誰在種田捕魚打獵、工具、鹽、紙、本鎮擅長與要靠貿易的
                try { if (typeof ECON !== 'undefined' && this.world) {
                    const V = ECON.view(this.world); const tot = Math.max(1, V.food); const esc = (x) => this._escapeHtml ? this._escapeHtml(String(x)) : String(x);
                    const bar = ECON.KINDS.map(k => { const pct = Math.round(V.pantry[k] / tot * 100); return pct > 0 ? `<span class="ec-kind ec-${k}" style="flex:${Math.max(4, pct)}" title="${esc(t(ECON.KIND_ZH[k]))} ${pct}%">${ECON.KIND_ICON[k]}</span>` : ''; }).join('');
                    const kinds = ECON.KINDS.map(k => `${ECON.KIND_ICON[k]} ${t(ECON.KIND_ZH[k])} ${Math.round(V.pantry[k])}`).join(' · ');
                    const roles = `${t('農夫')} ${V.roles.grain} · ${t('漁夫')} ${V.roles.fish} · ${t('獵人')} ${V.roles.meat}`;
                    const diet = V.variety == null ? '' : V.variety >= 3 ? `😋 ${t('飲食多樣，大家心情好')}` : V.variety <= 1 ? `😒 ${t('天天吃一樣的，大家吃膩了')}` : `🙂 ${t('飲食還算有變化')}`;
                    // v6.80.0 吃得好：飲食多樣／麵包糕點果醬／好酒好茶甜點，湊齊兩樣就算；隔天少吃一成正餐，連續三天心情加
                    let eatWell = ''; if (typeof FLOW !== 'undefined') { const D = FLOW.diet(this.world);
                        eatWell = D.good ? `<div class="ec-line">🍰 ${t('昨天吃得好：今天少吃一成正餐')}${D.streak >= 3 ? `${t('（')}${t('已連續 {n} 天，大家心情變好').replace('{n}', D.streak)}${t('）')}` : ''}</div>`
                            : `<div class="ec-line ec-muted">🍽️ ${t('吃得普通')}${t('：')}${[['variety', '飲食多樣'], ['snack', '麵包糕點果醬'], ['fine', '好酒好茶甜點']].map(([k, l]) => `${D.parts?.[k] ? '✓' : '✗'}${t(l)}`).join(' ')}${t('（')}${t('湊齊兩樣就算吃得好')}${t('）')}</div>`; }
                    const toolPct = Math.round(V.toolF * 100);
                    const toolTxt = V.toolF >= 1.05 ? `🔧 ${t('工具充裕')}${t('：')}${t('工作效率')} ${toolPct}%` : V.toolF >= 1 ? `🔧 ${t('工具夠用')}` : `🔧 ${t('工具不夠')}${t('：')}${t('工作效率')} ${toolPct}%${t('（')}${t('需要')} ${V.toolNeed}${t('）')}`;
                    const saltTxt = V.salted ? `🧂 ${t('有鹽醃漬：存糧腐壞減半')} (${Math.round(V.salt)})` : `🧂 ${V.canSalt ? t('鹽還在曬，今天不夠用') : t('缺鹽：只有靠海的鎮曬得出鹽，要靠商隊買')}`;
                    const paperTxt = V.paperShort ? `📄 ${t('缺紙：報社可能停刊、研究變慢')}` : `📄 ${t('紙')} ${Math.round(V.paper)}`;
                    const good = V.spec.good.map(x => t(x)).join(t('、')), bad = V.spec.bad.map(x => t(x)).join(t('、'));
                    // v9.18.0 改成資訊卡:三種存糧大數字、人手與狀態一項一列(有顏色)、擅長／要靠貿易用小標籤
                    const lines = [];
                    if (diet) lines.push([diet, V.variety >= 3 ? 'g' : V.variety <= 1 ? 'r' : '']);
                    if (typeof FLOW !== 'undefined') { const D = FLOW.diet(this.world);
                        lines.push([D.good ? `🍰 ${t('昨天吃得好：今天少吃一成正餐')}${D.streak >= 3 ? `${t('（')}${t('已連續 {n} 天，大家心情變好').replace('{n}', D.streak)}${t('）')}` : ''}`
                            : `🍽️ ${t('吃得普通')} <span class="ic-pills pg-inl">${[['variety', '飲食多樣'], ['snack', '麵包糕點果醬'], ['fine', '好酒好茶甜點']].map(([k, l]) => `<span class="ic-pill${D.parts?.[k] ? ' pg-g' : ''}">${D.parts?.[k] ? '✓' : '✗'} ${t(l)}</span>`).join('')}</span><small class="pg-sm">${t('湊齊兩樣就算吃得好')}</small>`, D.good ? 'g' : '']); }
                    lines.push([toolTxt, V.toolF >= 1 ? 'g' : 'r'], [saltTxt, V.salted ? 'g' : 'y'], [paperTxt, V.paperShort ? 'r' : '']);
                    const probs = [V.toolF < 1 ? t('工具不夠') : '', !V.salted && !V.canSalt ? t('缺鹽') : '', V.paperShort ? t('缺紙') : ''].filter(Boolean);
                    html += this._ic({ id: 'gd-local', cls: 'ec-local', icon: '🗺️', title: t('本鎮物產'), defOpen: true, chip: probs.length ? { t: probs.join(t('、')), tone: 'y' } : null,
                        kpis: ECON.KINDS.map(k => ({ v: Math.round(V.pantry[k]), l: `${ECON.KIND_ICON[k]} ${t(ECON.KIND_ZH[k])}` })),
                        body: `<div class="ec-bar">${bar}</div>`
                            + `<div class="pg-kv"><span>${t('人手')}</span><span class="ic-pills">${[[t('農夫'), V.roles.grain], [t('漁夫'), V.roles.fish], [t('獵人'), V.roles.meat]].map(([l, n]) => `<span class="ic-pill">${l} <b>${n}</b></span>`).join('')}${V.canFish ? '' : `<span class="ic-pill">${t('不靠水，不能捕魚')}</span>`}</span></div>`
                            + `<div class="pg-stat">${lines.map(([x, tone]) => `<div class="pg-stat-row${tone ? ' ic-t-' + tone : ''}"><i class="ic-dot ${tone || 'n'}"></i><span>${x}</span></div>`).join('')}</div>`
                            + (good ? `<div class="pg-kv"><span>💪 ${t('本鎮擅長')}</span><span class="ic-pills">${V.spec.good.map(x => `<span class="ic-pill pg-g">${esc(t(x))}</span>`).join('')}</span></div>` : '')
                            + (bad ? `<div class="pg-kv"><span>🐪 ${t('得靠貿易')}</span><span class="ic-pills">${V.spec.bad.map(x => `<span class="ic-pill pg-y">${esc(t(x))}</span>`).join('')}</span></div>` : '') });
                } } catch (e) { console.warn('[Econ] panel', e); }
                // ② 加工產能:看今日流量(做了幾個/用掉幾個),不是純庫存
                const PROCESSED = ['meals','tools','clothing','medicine','furniture'];
                const flow = this._econDailyFlow(PROCESSED);
                const demandNote = {
                    meals: `${t('每日需')} ${Math.round(npcCount * 1.5)}`,
                    tools: `${t('每日耗損')} ${(npcCount * 0.05 * (typeof FLOW !== 'undefined' && this.world ? FLOW.wearRate(this.world, 'tools') : 1)).toFixed(1)}`, // v6.80.0 精製品壞得慢
                    clothing: `${t('每日耗損')} ${(npcCount * 0.03 * (typeof FLOW !== 'undefined' && this.world ? FLOW.wearRate(this.world, 'clothing') : 1)).toFixed(1)}`,
                    medicine: t('生病時消耗'),
                    furniture: t('建設與新居用'),
                };
                // v5.51.0 經濟B波:每條加工線顯示「誰在做」+ 排班三態(休工/正常/加班)——經濟＝排人,不是囤貨
                const GOOD_JOB = { meals:'cook', tools:'blacksmith', clothing:'tailor', medicine:'doctor', furniture:'carpenter' };
                const workPolicy = this.world?.workPolicy || {};
                // v9.18.0 加工產能改成一品一列:左邊誰在做、中間今天做了／用了多少、右邊庫存大數字
                let fRows = ''; let fShort = 0;
                PROCESSED.forEach(k => {
                    const f = flow[k];
                    const stock = Math.round(res[k] || 0);
                    const fineN = (typeof FLOW !== 'undefined' && this.world && FLOW.FINE_FROM[k]) ? Math.floor(FLOW.fine(this.world, k)) : 0; // v6.80.0
                    const prod = Math.round(f.produced * 10) / 10, cons = Math.round(f.consumed * 10) / 10;
                    const makers = Object.values(this.state.agents || {}).filter(a => a.job?.key === GOOD_JOB[k]).map(a => a.name);
                    const policy = workPolicy[k] || 'normal';
                    const RECIPE_OUT = { meals: 9, tools: 3, clothing: 2, medicine: 2, furniture: 2 };
                    const est = Math.round(makers.length * (RECIPE_OUT[k] || 0) * (policy === 'off' ? 0 : policy === 'extra' ? 1.5 : 1));
                    const down = prod < cons; if (down || !makers.length) fShort++;
                    fRows += `<div class="pg-flow${down ? ' down' : ''}">
                        <span class="pg-flow-ic">${icons[k]}</span>
                        <div class="pg-flow-m"><div class="pg-flow-t"><b>${labels[k]}</b><small>${makers.length ? '👤 ' + makers.map(n => this._escapeHtml(t(n))).join(t('、')) : t('（無人手）')}</small></div>
                            <div class="pg-flow-n">${prod > 0 ? `<span class="ic-t-g"><b class="ic-t-g">＋${prod}</b></span>` : `<span>${t('預估日產')} <b>＋${est}</b> <small>${t('（')}${t('午夜結算')}${t('）')}</small></span>`}${cons ? `<span class="ic-t-r"><b class="ic-t-r">−${cons}</b></span>` : ''}<small>${demandNote[k]}</small></div></div>
                        <div class="pg-flow-s"><b>${stock}</b><small>${t('庫存')}</small>${fineN >= 1 ? `<span class="ec-fine" title="${t('工坊做的精製品，耗損只有一半')}">✨${t('精製')} ${fineN}</span>` : ''}</div></div>`;
                });
                html += this._ic({ id: 'gd-proc', icon: '⚒️', title: t('加工產能'), defOpen: true, chip: fShort ? { t: t('{n} 項入不敷出或沒人做').replace('{n}', fShort), tone: 'y' } : { t: t('供應穩定'), tone: 'g' }, body: `<div class="ic-note" style="margin-bottom:4px">${t('今日產出／消耗（村民自己排班）')}</div>${fRows}` });
                // ③ 原料倉庫:收成一顆燈,細目摺疊
                const RAWS = ['wood','stone','metal','cloth','herbs','salt','paper']; // v6.77.0 鹽、紙
                const short = RAWS.filter(k => (res[k] || 0) < 10);
                const tight = RAWS.filter(k => (res[k] || 0) >= 10 && (res[k] || 0) < 40);
                const light = short.length ? '🔴' : tight.length ? '🟡' : '🟢';
                const lightText = short.length ? `${t('短缺')}${t('：')}${short.map(k => labels[k]).join(t('、'))}`
                    : tight.length ? `${t('吃緊')}${t('：')}${tight.map(k => labels[k]).join(t('、'))}`
                    : t('原料充足，工坊無虞');
                const detailKeys = Object.keys(res).filter(k => !PROCESSED.includes(k) && k !== 'food' && k !== 'silver' && k !== 'research_points' && Math.round(res[k]) > 0);
                // v9.18.0 原料倉庫:燈號放標題、七種原料直接看得到(缺的紅、緊的黃)，其他庫存收進展開詳細
                const rawTile = (k) => { const amount = res[k] || 0; const isRaw = RAWS.includes(k); const tone = !isRaw ? "" : amount < 10 ? 'r' : amount < 40 ? 'y' : ''; return `<div class="resource-item ${isRaw && amount < 10 ? "res-low" : amount > 100 ? 'res-high' : ''}${tone ? ' ic-t-' + tone : ''}"><span class="res-icon">${icons[k] || '📦'}</span><span class="res-label">${labels[k] || k}</span><span class="res-amount">${Math.round(amount)}</span></div>`; };
                const CROPS = (typeof FLOW !== 'undefined' && FLOW.CROP_FOOD) ? Object.keys(FLOW.CROP_FOOD) : ['wheat', 'rice', 'corn', 'potato', 'mushroom', 'grapes', 'sugarcane', 'golden_wheat', 'dragon_fruit'];
                const others = detailKeys.filter(k => !RAWS.includes(k));
                html += this._ic({ id: 'gd-raw', icon: '📦', title: t('原料倉庫'), defOpen: true, chip: { t: short.length ? t('短缺') : tight.length ? t('吃緊') : t('充足'), tone: short.length ? 'r' : tight.length ? 'y' : 'g' },
                    alert: short.length ? { t: lightText, tone: 'r' } : tight.length ? { t: lightText, tone: 'y' } : null,
                    body: `<div class="resource-grid">${RAWS.map(rawTile).join('')}</div>${short.length || tight.length ? '' : `<div class="ic-note" style="margin-top:6px">🟢 ${lightText}</div>`}`,
                    detail: others.length ? `<div class="ic-sub-h">${t('其他庫存')}</div><div class="resource-grid">${others.map(rawTile).join('')}</div>${others.some(k => CROPS.includes(k)) ? `<div class="ic-note" style="margin-top:6px">🌾 ${t('田裡收成的作物會直接存進糧倉（算在食物裡），這裡只留工坊要用的一點，數字小是正常的。')}</div>` : ''}` : '' });
                // v9.18.0 交易:商人卡(專長、還剩幾天)、每筆報價一格(買／賣用顏色分)、誰去談、最近成交
                const trade = this.state.trade || {};
                const SPEC = { general: t('雜貨'), metals: t('金屬'), medicine: t('藥材'), textiles: t('布料'), exotic: t('異國貨') };
                let tb = '';
                if (trade.merchant) {
                    const m = trade.merchant;
                    tb += `<div class="ic-kpis n3"><div class="ic-kpi"><b>${this._escapeHtml(t(m.name))}</b><span>${t('商人')}</span></div><div class="ic-kpi"><b>${SPEC[m.specialty] || this._escapeHtml(t(m.specialty || ''))}</b><span>${t('專長')}</span></div><div class="ic-kpi${m.daysRemaining <= 1 ? ' ic-t-y' : ''}"><b>${m.daysRemaining}<small>${t('天')}</small></b><span>${t('後離開')}</span></div></div>`;
                    tb += `<div class="pg-offers">${m.offers.map(offer => `<div class="pg-offer ${offer.isBuying ? 'sell' : 'buy'}"><span class="pg-offer-a">${offer.isBuying ? t('他收購') : t('他在賣')}</span><span class="pg-offer-r">${icons[offer.resource] || '📦'} ${labels[offer.resource] || offer.resource}</span><span class="pg-offer-n">×${Math.round(offer.amount)}</span><b>${offer.price}<small>/${t('個')}</small></b></div>`).join('')}</div>`;
                    const traderNames = Object.values(this.state.agents || {}).filter(a => a.job?.key === 'trader').map(a => t(a.name));
                    tb += `<div class="ic-note" style="margin-top:6px">${traderNames.length ? t('{who} 每天會去跟商人談，多的賣、缺的買。').replace('{who}', traderNames.join(t('、'))) : t('鎮上沒有商人職業的村民，鎮長或其他人會代為去談。')}</div>`;
                } else tb += `<div class="ic-note">${t('鎮上沒有商人，可能很快就會來一位。')}</div>`;
                const th = (this.world?.trade?.tradeHistory || []).slice(-3).reverse();
                if (th.length) tb += this._icSub(t('最近成交'), `<div class="ic-rows">${th.map(h => `<div class="ic-row"><span>${this._escapeHtml(t(h.who || ''))} ↔ ${this._escapeHtml(t(h.merchant || ''))}</span><small>${this._escapeHtml((h.deals || []).map(d => `${d.type === 'sell' ? t('賣') : t('買')} ${this._resName(d.r)}×${d.qty}`).join(t('、')))}</small></div>`).join('')}</div>`);
                html += this._ic({ id: 'gd-trade', icon: '🤝', title: t('交易'), defOpen: true, chip: trade.merchant ? { t: t('商人在鎮上'), tone: 'g' } : { t: t('沒有商人') }, body: tb });
            }
        } if (S === 'tech') {
            // v5.52.0 研究獨立入口;v6.40.0 三個時代的科技樹;v7.8.0 獨立成「科技」分頁:科技路線、路線時代、路線帶來的問題
            const research = this.state.research || {};
            const projects = research.projects || {};
            const currentKey = research.current_research;
            const TV = research.tech || null; const TX = typeof TECH !== 'undefined' ? TECH : null;
            const ERAS = (typeof RESEARCH_ERAS !== 'undefined') ? RESEARCH_ERAS : { 1: { name: '拓荒', icon: '🪓' }, 2: { name: '手工', icon: '🔨' }, 3: { name: '工坊', icon: '⚙️' } };
            const eraN = (e, P) => (TX && this.world) ? TX.eraName(this.world, e, P) : (ERAS[e] || { name: '', icon: '' });
            const BT = (typeof BUILDING_TEMPLATES !== 'undefined') ? BUILDING_TEMPLATES : {}; const FT = (typeof FACTORIES !== 'undefined') ? FACTORIES : {};
            const unlockName = (u) => u.startsWith('factory:') ? (FT[u.slice(8)] ? `${FT[u.slice(8)].icon} ${t(FT[u.slice(8)].name)}` : u) : (BT[u] ? `🏗️ ${t(BT[u].name)}` : u);
            const curEra = eraN(research.era || 1);
            // v9.18.0 研究改成資訊卡:正在研究什麼(大字＋進度條)、研究點、現在的時代、研究員;規則收進 ⓘ。科技樹另成一區
            const scholars = Object.values(this.state.agents || {}).filter(a => a.job?.key === 'researcher').map(a => t(a.name));
            const curP = currentKey && projects[currentKey] ? projects[currentKey] : null; const cpct = curP ? Math.min(100, Math.round((curP.progress / curP.cost) * 100)) : 0;
            html += this._ic({ id: 'tc-now', cls: 'research-card', icon: '🔬', title: t('研究'), defOpen: true, chip: curP ? { t: t('研究中'), tone: 'g' } : { t: t('目前沒在研究'), tone: 'y' },
                top: curP ? `<div class="research-current pg-rc"><span>${t('研究中：')}</span><strong>${t(curP.name)}</strong><b class="progress-text">${cpct}%</b></div><div class="ic-bar big"><i class="research-fill" style="width:${Math.max(2, cpct)}%"></i></div>` : `<div class="ic-note">${t('目前沒在研究：研究員做的進度先存著，等村民提「研究」提案（兩天沒人提，學者會自己挑最早時代的）')}</div>`,
                kpis: [{ v: Math.round(res.research_points || 0), l: '📚 ' + t('研究點') }, { v: `${curEra.icon || ''}${t(curEra.name || '')}`, l: t('現在的時代') }, { v: scholars.length, u: t('人'), l: t('研究員'), tone: scholars.length ? '' : 'y' }],
                body: scholars.length ? `<div class="pg-kv"><span>${t('研究員：').replace(/[：:]$/, '')}</span><span class="ic-pills">${scholars.map(n => `<span class="ic-pill">${this._escapeHtml(n)}</span>`).join('')}</span></div>` : `<div class="ic-note">${t('鎮上還沒有研究員，研究進度只靠研究點。')}</div>`,
                info: t('建築與工坊要先研究到才蓋得了（穀倉、深井除外）；哪一項先研究由村民提案、投票、鎮長裁決。') });
            html += `<div class="econ-section tech-tree"><h3>🌳 ${t('科技樹')}</h3>`;
            // ---- v7.8.0 科技路線;v7.9.0 多條路線、路線大辯論、第六時代專屬 ----
            if (TV) {
                const esc = (x) => this._escapeHtml(String(x ?? ''));
                const PD = Object.fromEntries((TV.paths || []).map(x => [x.key, x]));
                html += `<div class="tech-era tech-path"><div class="tech-era-head">🧭 ${t('科技路線')}${TV.path ? ` <span>${TV.icon} ${esc(TV.pathName)}</span>` : ''}</div>`;
                html += `<div class="tech-desc" style="color:var(--text-muted)">${t('每條路線的第四、五時代大家都能研究；第六時代只有走那條路線的小鎮才能研究。')}</div>`;
                if (!TV.path) {
                    const tl = TV.debate?.tally;
                    html += `<div class="tech-desc">${TV.debate ? `🗳️ ${t('鎮上正在辯論科技路線')}${t('：')}${TV.debate.id}` : TV.nextDebate ? `🏡 ${t('上次辯論決定維持傳統，{n} 天後再辯論（遇到大事可能提早）').replace('{n}', TV.nextDebate)}` : TV.main3 >= TV.gate ? `🗳️ ${t('工坊時代研究到 {n}%，鎮上很快會開始辯論科技路線').replace('{n}', TV.main3)}` : `🔒 ${t('工坊時代研究到 {g}% 時，鎮上會辯論往後走哪條科技路線（現在 {n}%）').replace('{g}', TV.gate).replace('{n}', TV.main3)}`}</div>`;
                    if (TV.debate && tl) html += `<div class="ic-sub-h">🗳️ ${t('目前票數')}</div>` + this._icGrid(Object.entries(tl.paths).map(([k, v]) => ({ v, u: t(' 票'), l: `${PD[k]?.icon || ''} ${PD[k]?.name || k}` })).concat([{ v: tl.keep, u: t(' 票'), l: `🏡 ${t('維持傳統')}` }])); // v9.18.1 辯論中的票數改成格子
                    if (TV.lean) html += `<div class="tech-desc">🏘️ ${t('小鎮的風氣')}${t('：')}${t('比較偏向{p}').replace('{p}', `${TV.lean.icon}${esc(TV.lean.name)}`)}${TV.lean.why ? `${t('（')}${esc(TV.lean.why)}${t('）')}` : ''}</div>`;
                    html += `<div class="pg-paths">${(TV.paths || []).map(x => `<div class="pg-path${TV.lean?.key === x.key ? ' lean' : ''}"><div class="pg-path-h"><span>${x.icon}</span><b>${esc(x.name)}</b><span class="pg-st${x.appeal < 0 ? '' : ''}"><b>${x.appeal >= 0 ? '+' : ''}${x.appeal}</b><span>${t('吸引力')}</span></span></div><div class="pg-path-d">${esc(x.short)}</div><div class="pg-path-pc"><span class="pg-g">👍 ${esc(x.pro)}</span><span class="pg-y">👎 ${esc(x.con)}</span></div></div>`).join('')}</div>`; // v9.18.0 三條路線並排成卡
                } else {
                    // v9.18.1 決定的路線：說明、哪天決定、當年辯論的票數（以前數字沒寫是票數，看不懂）
                    html += `<div class="tech-desc">${esc(TV.short)}${t('。')}</div>`;
                    if (TV.since != null) html += `<div class="ic-note">📅 ${t('第 {d} 天決定').replace('{d}', TV.since)}</div>`;
                    if (TV.tally) html += `<div class="ic-sub-h">🗳️ ${t('當年辯論的票數')}</div>` + this._icGrid(Object.entries(TV.tally).map(([k, v]) => ({ v, u: t(' 票'), l: `${PD[k]?.icon || ''} ${PD[k]?.name || k}`, tone: k === TV.path ? 'g' : '' })).concat([{ v: TV.no || 0, u: t(' 票'), l: `🏡 ${t('維持傳統')}` }]));
                    html += `<div class="pg-path-pc"><span class="pg-g">👍 ${esc(TV.pro)}</span><span class="pg-y">👎 ${esc(TV.con)}</span></div>`; // v9.18.1 好處／壞處各一列
                    html += `<div class="pg-stages">${[4, 5, 6].map(e => { const en = eraN(e, TV.path); return `<div class="pg-stage"><span>${en.icon} ${t(en.name)}</span><div class="ic-bar"><i style="width:${Math.max(2, TV.stage[e] || 0)}%"></i></div><b>${TV.stage[e]}%</b></div>`; }).join('')}</div>`; // v9.18.0 路線三個時代的進度條
                }
                // 核電(跟路線無關:蓋了核電廠就有風險)
                if (TV.nuke || TV.noNuke || TV.law) { const rk = TV.risk ? { low: t('低'), mid: t('中'), high: t('高') }[TV.risk] : null; html += `<div class="tech-desc">☢️ ${TV.noNuke ? t('已經廢核') : TV.nuke ? `${t('核災風險')}${t('：')}<b class="tech-risk-${TV.risk}">${rk}</b>${TV.law ? ` · 📋 ${t('有核安法')}` : ` · ${t('沒有核安法')}`}` : t('還沒有核電廠')}</div>`; }
                if (TV.jobs?.length) html += `<div class="tech-desc">🤖 ${t('機器搶走的職缺')}${t('：')}${TV.jobs.map(k => t(JOB_DEFINITIONS?.[k]?.title || k)).join(t('、'))}</div>`;
                const B = TV.bio; if (B && (B.law || B.price || B.gmban || B.halt || B.st?.leak)) html += `<div class="tech-desc">🧬 ${[B.law ? `📋 ${t('生物安全法')}` : '', B.price ? `💊 ${t('藥價管制')}` : '', B.gmban ? `🌾 ${t('禁止基因作物')}` : '', B.halt ? `✋ ${t('停止人體實驗')}` : '', B.st?.leak ? `☣️ ${t('實驗室外洩')} ${B.st.leak}` : ''].filter(Boolean).join(' · ')}</div>`;
                // v8.0.0 蒸汽煉金:煤煙(跟路線無關:有鍋爐、工坊就會冒煙)與法律
                const SX = TV.steam; if (SX && (SX.smog >= 3 || SX.air || SX.factory || SX.homunban)) {
                    const L = [SX.smog >= 3 ? `🏭 ${t('煤煙')} <b class="tech-risk-${SX.lv === 'black' ? 'high' : SX.lv === 'grey' ? 'mid' : 'low'}">${SX.smog}</b>${t('（')}${esc(SX.word)}${t('）')}` : '', SX.air ? `🌫️ ${t('清潔空氣法')}` : '', SX.factory ? `🏭 ${t('工廠法')}` : '', SX.homunban ? `🧪 ${t('禁造人造人')}` : '', SX.st?.great ? `🌑 ${t('大黑霧')} ${SX.st.great}` : '', ''].filter(Boolean);
                    html += `<div class="tech-desc">${L.join(' · ')}</div>`;
                }
                // v8.7.0 長生:賢者之石(以太)與延壽療程
                if (typeof LONGEV !== 'undefined') { const V = LONGEV.view(this.world); const parts = [];
                    if (V.mine) parts.push(`✨ ${t('以太')} <b>${V.ae}</b>/${V.cap}${V.need ? ` · ${t('造物')}（${esc(V.wonders.join(t('、')))}）${t('供應')} ${V.pw}%` : ''}${V.canStone ? ` · ${t(V.prio === 'stone' ? '大家決定存起來煉賢者之石' : '大家決定先拿來過生活')}` : ''}${V.stone ? ` · 💎 ${V.holder ? t('{a}戴著賢者之石（能量 {c}%，少老了 {n} 年）').replace('{a}', esc(V.holder)).replace('{c}', V.charge).replace('{n}', V.heldYears) : V.ready ? t('完整的賢者之石已經煉成，還沒決定給誰') : t('賢者之石存了 {p}%').replace('{p}', V.gw)}` : ''}`);
                    if (V.gene) parts.push(`🧬 ${t('做過延壽療程')} ${V.treated} ${t('人')}${V.st.disorder ? ` · ${t('基因失調')} ${V.st.disorder}` : ''}${V.st.blocked ? ` · ${t('沒能懷上')} ${V.st.blocked}` : ''}${V.st.refused ? ` · ${t('拒絕療程')} ${V.st.refused}` : ''}`);
                    if (V.past.length) parts.push(`⏳ ${V.past.slice(-3).map(x => `${esc(x.name)}${t('（')}${t('多活')} ${x.years} ${t('年')}${t('）')}`).join(t('、'))}`);
                    if (parts.length) html += `<div class="tech-desc longev-line">${parts.join('<br>')}</div>`; }
                const st = TV.st || {};
                if ((st.minor || 0) + (st.mid || 0) + (st.big || 0) > 0) html += `<div class="tech-desc" style="color:var(--text-muted)">🟡 ${t('小事')} ${st.minor || 0} · 🟠 ${t('中事')} ${st.mid || 0} · 🔴 ${t('大災')} ${st.big || 0}${st.laid ? ` · ${t('被機器裁員')} ${st.laid}` : ''}${st.died ? ` · ${t('罹難')} ${st.died}` : ''}${st.left ? ` · ${t('搬走')} ${st.left}` : ''}</div>`;
                html += '</div>';
            }
            // ---- v8.5.0 世界級災厄 ----
            { const wc = this._wcBlock?.('tech') || ''; if (wc) html += `<div class="tech-era wc-era"><div class="tech-era-head">🌍 ${t('世界級災厄')}</div>${wc}</div>`; }
            // ---- v7.9.0 大災之後的文明倒退:失傳的科技(殘卷)、停擺的建築 ----
            const LOST = this.world?.calamity?.lost || {};
            if (Object.keys(LOST).length && typeof CALAMITY !== 'undefined') {
                const esc = (x) => this._escapeHtml(String(x ?? '')); const dorm = CALAMITY.dormant(this.world);
                html += `<div class="tech-era tech-lost"><div class="tech-era-head">📜 ${t('失傳的科技')} <span>${Object.keys(LOST).length}</span></div>`;
                html += `<div class="tech-desc">${Object.keys(LOST).map(k => esc(t(projects[k]?.name || k))).join(t('、'))}</div>`;
                html += `<div class="tech-desc" style="color:var(--text-muted)">${t('大災之後學問失傳了，只剩殘卷：保留三到六成的進度，重新研究會快一些。')}</div>`;
                if (dorm.length) html += `<div class="tech-desc">🏚️ ${t('停擺的建築')}${t('：')}${dorm.map(b => esc(t(b.name))).join(t('、'))}${t('（重新研究出來才會恢復）')}</div>`;
                html += '</div>';
            }
            const P = TV?.path || null; const PK = (TV?.paths || []).map(x => x.key).sort((x, y) => (x === P ? -1 : y === P ? 1 : 0)); const PI = Object.fromEntries((TV?.paths || []).map(x => [x.key, x]));
            const onP = (p, k) => (Array.isArray(p.path) ? p.path.includes(k) : p.path === k);
            const groups = [
                { e: 1, f: p => (p.era || 1) === 1 }, { e: 2, f: p => (p.era || 1) === 2 }, { e: 3, f: p => (p.era || 1) === 3 },
                { e: 4, f: p => (p.era || 1) === 4 && !p.path, en: ERAS[4] },
            ];
            for (const k of PK) {
                const st = TV.stages?.[k] || {}; const nm = PI[k]?.name || k; const ic = PI[k]?.icon || '';
                groups.push({ e: 4, f: p => (p.era || 1) === 4 && onP(p, k), en: eraN(4, k), pk: k, lock: TV.main3 < TV.gate ? t('{p}的第四時代要：工坊時代研究到 75%').replace('{p}', `${ic}${nm}`) : '' });
                groups.push({ e: 5, f: p => p.era === 5 && onP(p, k), en: eraN(5, k), pk: k, lock: (st[4] || 0) < TV.gate || TV.tier < 2 ? t('{p}的第五時代要：第四時代研究到 75%、城鎮升到城市').replace('{p}', `${ic}${nm}`) + (k === 'bio' ? t('、蓋好研究院') : k === 'steam' ? t('、蓋好齒輪工坊') : '') : '' });
                groups.push({ e: 6, f: p => p.era === 6 && onP(p, k), en: eraN(6, k), pk: k, excl: 1, lock: P !== k ? t('專屬：只有走{p}路線的小鎮才能研究').replace('{p}', `${ic}${nm}`) : ((st[5] || 0) < TV.gate || TV.tier < 3) ? t('第六時代要：第五時代研究到 75%、城鎮升到王都') + (k === 'bio' ? t('；神話基因還要蓋基因實驗室') : k === 'steam' ? t('；賢者之石、人造人還要蓋煉金工坊') : '') : '' });
            }
            groups.push({ e: 7, f: p => p.era === 7, en: ERAS[7] });
            for (const g of groups) {
                const list = Object.values(projects).filter(g.f);
                if (!list.length) continue;
                const era = g.e; const en = g.en || ERAS[era] || {};
                const done = list.filter(p => p.status === 'complete').length;
                if (era === 7) { // 精進改良:只顯示一張
                    const p = list[0]; const now = p.key === currentKey; const pct = p.cost ? Math.min(100, Math.round((p.progress || 0) / p.cost * 100)) : 0;
                    html += `<div class="tech-era"><div class="tech-era-head">${en.icon || ''} ${t(en.name || '')} <span>Lv.${(TV?.ref || 0)}</span></div><div class="tech-node tech-${now ? 'now' : 'open'}"><div class="tech-node-head"><span>${now ? '🔬' : '♾️'} <b>${t(p.name)}</b></span><span class="tech-cost">${now ? pct + '%' : `${p.cost} ${t('點')}`}</span></div><div class="tech-desc">${this._escapeHtml(p.description || '')}</div><div class="tech-need">${t('其他科技都研究完了才會開始研究')}</div></div></div>`;
                    continue;
                }
                const head = `${g.pk ? `${PI[g.pk]?.icon || ''} ` : ''}${t('第 {n} 時代').replace('{n}', t(['', '一', '二', '三', '四', '五', '六'][era]))}${t('・')}${t(en.name || '')}${g.excl ? ` 🔐` : ''}`;
                // v8.2.0 研究完的時代折疊起來(點標題展開,刷新時記得開關)
                const fold = list.length > 0 && done === list.length && !g.lock; const fk = `${g.pk || ''}${era}`; const fOpen = !!(this._techOpen || {})[fk];
                html += fold ? `<details class="tech-era tech-era-fold" data-era="${fk}"${fOpen ? ' open' : ''}><summary class="tech-era-head"><span class="tech-era-name">${en.icon || ''} ${head}</span><span>✅ ${done}/${list.length} <i class="tech-fold-ic" aria-hidden="true">▸</i></span></summary>`
                    : `<div class="tech-era"><div class="tech-era-head">${en.icon || ''} ${head} <span>${done}/${list.length}</span></div>`;
                if (g.lock) html += `<div class="tech-desc" style="color:var(--text-muted)">🔒 ${g.lock}</div>`;
                for (const p of list) {
                    const st = p.status === 'complete' ? 'done' : p.key === currentKey || p.status === 'researching' ? 'now' : p.status === 'available' ? 'open' : 'locked';
                    const icon = { done: '✅', now: '🔬', open: '🟢', locked: '🔒' }[st];
                    const pct = p.cost ? Math.min(100, Math.round((p.progress || 0) / p.cost * 100)) : 0;
                    const need = (p.prerequisites || []).filter(k => projects[k]?.status !== 'complete').map(k => t(projects[k]?.name || k));
                    html += `<div class="tech-node tech-${st}">
                        <div class="tech-node-head"><span>${icon} <b>${t(p.name)}</b></span><span class="tech-cost">${st === 'done' ? t('已完成') : st === 'now' ? `${pct}%` : `${p.cost} ${t('點')}`}</span></div>
                        <div class="tech-desc">${this._escapeHtml(p.description || '')}</div>
                        ${(p.unlocks || []).length ? `<div class="tech-unlocks">${t('解鎖')}${t('：')}${p.unlocks.map(unlockName).join(t('、'))}</div>` : ''}
                        ${LOST[p.key] ? `<div class="tech-need tech-scroll">📜 ${t('殘卷')}${t('：')}${t('在{c}之後失傳，留下 {n}% 的進度').replace('{c}', this._escapeHtml(t(LOST[p.key].c || ''))).replace('{n}', pct)}</div>` : ''}
                        ${st === 'locked' && need.length ? `<div class="tech-need">${t('需要先研究')}${t('：')}${need.join(t('、'))}</div>` : ''}
                        ${(() => { const sm = st === 'done' && this.world?.ideaSystem?.summary?.(this.world, p.key); if (!sm) return ''; const und = Math.max(0, sm.total - sm.adopt - sm.resist); const pa = sm.total ? Math.round(sm.adopt / sm.total * 100) : 0, pr = sm.total ? Math.round(sm.resist / sm.total * 100) : 0; return `<div class="tech-idea">💡 ${t(sm.idea)}<div class="idea-bar"><span class="idea-a" style="width:${pa}%"></span><span class="idea-r" style="width:${pr}%"></span></div><div class="idea-legend">${t('接受')} ${sm.adopt} · ${t('反對')} ${sm.resist} · ${t('還沒聽說')} ${und}</div></div>`; })()}
                        ${st === 'now' ? `<div class="progress-bar" style="height:4px;margin-top:4px"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>` : ''}
                    </div>`;
                }
                html += fold ? '</details>' : '</div>';
            }
            // v7.8.0 路線帶來的問題(最近)
            if (TV?.inc?.length) {
                const LV = { minor: '🟡', mid: '🟠', big: '🔴' }; const EVN = { injury: '機器夾傷', blackout: '停電', oldhand: '老師傅跟不上', waste: '工坊廢水', radio: '收音機吵架', alarm: '核電廠警報', layoff: '自動化裁員', smash: '砸機器', leak: '輻射外洩', watch: 'AI 監控爭議', meltdown: '核災', /* v9.20.1 基因生物、蒸汽煉金路線的事件也要有名稱(以前直接顯示代碼 breed_fail、scald…) */ pharma_waste: '藥廠廢水', lab_escape: '實驗動物跑出來', gene_discrim: '遺傳檢查惹出的歧視', side_effect: '新藥副作用', breed_fail: '育種失敗', quack: '延壽祕藥騙局', omen: '新生兒變少', caste: '基因階級衝突', black_clinic: '地下診所出事', price_storm: '藥價飆漲', superbug: '抗藥性病菌', lableak: '實驗室外洩', scald: '蒸汽燙傷', soot: '煤灰弄髒衣服', cough: '煤煙咳嗽', tube_mix: '氣動管道送錯信', child_labor: '童工', alch_smell: '煉金工坊的臭煙', airship_ride: '飛艇試乘', boiler_burst: '鍋爐爆炸', smog_week: '煤煙罩鎮一星期', gold_fever: '點鉛成銀騙局', mech_rampage: '機甲失控', homun_ask: '人造人想要名字', great_smog: '大煙霧' };
                html += `<div class="tech-era"><div class="tech-era-head">⚠️ ${t('新技術帶來的問題')}</div>` + TV.inc.map(x => `<div class="tech-desc">${LV[x.lv] || ''} ${x.icon} ${t(EVN[x.id] || x.id)} · ${x.ago ? t('{n} 天前').replace('{n}', x.ago) : t('今天')}</div>`).join('') + '</div>';
            }
            // v6.46.0 革新派／保守派、發明名人堂
            const IS = this.world?.ideaSystem; let ideaCards = '';
            if (IS && this.world?.observerMode && this._techIdeaCards) { try { ideaCards = this._techIdeaCards(IS, projects); } catch (e) { console.warn('[tech] ideas', e); } } // v9.19.1 支持與反對、發明名人堂改成資訊卡(放在科技樹後面)
            if (IS && !ideaCards) {
                const fx = IS.factions(this.world); const nm = (arr) => arr.map(n => t(n)).join(t('、')) || t('（沒有）');
                html += `<div class="tech-era"><div class="tech-era-head">⚖️ ${t('新技術的支持與反對')}</div>
                    <div class="tech-desc">🚀 ${t('革新派')} ${fx.progressive.length}${t('：')}${nm(fx.progressive)}</div>
                    <div class="tech-desc">🤔 ${t('中間派')} ${fx.moderate.length}</div>
                    <div class="tech-desc">🏺 ${t('保守派')} ${fx.conservative.length}${t('：')}${nm(fx.conservative)}</div>
                    <div class="tech-desc" style="color:var(--text-muted)">${t('研究完成會帶來新觀念，靠村民聊天傳開；個性、年紀、職業和鎮上民風決定誰接受、誰反對。立場會影響競選政見，被新工坊搶了飯碗的匠人可能提案抗議。')}</div></div>`;
                const inv = (IS.inventions || []).slice(-8).reverse();
                html += `<div class="tech-era"><div class="tech-era-head">✨ ${t('發明名人堂')} <span>${(IS.inventions || []).length}</span></div>` + (inv.length ? inv.map(v => `<div class="tech-desc">${t('「')}${t('{name}式{thing}').replace('{name}', t(v.by)).replace('{thing}', t(v.thing))}${t('」')}${v.tech && projects[v.tech] ? ` · ${t('推進了')}${t(projects[v.tech].name)}` : ''}${v.disputedBy ? ` · 😤 ${t('{who}說是他先想到的').replace('{who}', t(v.disputedBy))}` : ''}</div>`).join('') : `<div class="tech-desc" style="color:var(--text-muted)">${t('還沒有人靈光一閃。有創意、勤快的村民工作時偶爾會想出新東西。')}</div>`) + '</div>';
            }
            html += '</div>' + ideaCards;
        } if (S === 'goods') {
            // v4.0: Shop system — card grid layout
            // v9.18.0 商店:公庫銀幣大數字、最近買賣一列一筆、物價板依類別成格
            const silverAmount = Math.round(res['silver'] || 0);
            const slog = (this.world?.shop?.transactionLog || []).slice(-6).reverse();
            const shopItems = this.world?.shop?.getAvailableItems(this.world) || [];
            const categories = { basic: t('基本物資'), craft: t('工藝品'), processed: t('加工品'), luxury: t('奢侈品') };
            let sb = '';
            for (const [catKey, catName] of Object.entries(categories)) {
                const catItems = shopItems.filter(i => i.category === catKey); if (!catItems.length) continue;
                sb += `<div class="ic-sub-h">${catName}</div><div class="shop-grid">${catItems.map(item => `<div class="shop-card"><div class="shop-card-icon">${item.icon}</div><div class="shop-card-name">${t(item.name)}</div><div class="shop-card-stock">${t('庫存')} ${Math.round(item.stock)}</div><div class="pg-bs"><span>${t('買')} <b>${item.buyPrice}</b></span><span>${t('賣')} <b>${item.sellPrice}</b></span></div></div>`).join('')}</div>`;
            }
            html += this._ic({ id: 'gd-shop', icon: '🛒', title: t('商店'), defOpen: false, sum: `💰 <b>${silverAmount}</b>`,
                kpis: [{ v: this._icNum(silverAmount), u: '💰', l: t('公庫銀幣') }, { v: slog.length, l: t('最近買賣') }],
                info: t('物價板。小量補貨與拋售由村民每天自己做，大宗進貨／拋售走「提案」。'),
                body: (slog.length ? `<div class="ic-rows" style="margin-bottom:8px">${slog.map(x => { const nm = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[x.item]) ? SHOP_ITEMS[x.item].name() : x.item; return `<div class="ic-row"><span>${x.type === 'buy' ? '🛒 ' + t('買進') : '💰 ' + t('賣出')} ${this._escapeHtml(nm)}×${x.amount}</span><b class="${x.type === 'buy' ? 'ic-t-r' : 'ic-t-g'}">${x.type === 'buy' ? '−' + x.cost : '＋' + x.income}</b></div>`; }).join('')}</div>` : '') + sb });
        } if (S === 'build') {
            // Buildings
            const buildings = this.state.buildings || {};
            html += t('<div class="econ-section"><h3>建築</h3>');
            if (buildings.in_progress?.length) {
                html += '<div class="building-progress">';
                const silver = this.state.stockpile?.resources?.silver || 0; const fundCost = buildings.fund_cost || 40;
                buildings.in_progress.forEach(p => {
                    const pct = Math.round((p.workDone / p.workRequired) * 100);
                    const fundedToday = p.status === 'building' && p.can_fund_today === false; const can = !!p.can_fund_today && silver >= fundCost;
                    html += `<div class="building-item"><span>${t(p.name)}</span>
                        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                        <span class="progress-text">${pct}%</span>
                        </div>`; // v6.14.0 工程捐款
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
                html += t('<div class="available-buildings"><div class="build-label">🔨 可升級（等村民提案）：</div>');
                upgradeable.forEach(u => {
                    const costStr = Object.entries(u.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                    const effStr = Object.entries(u.effects).map(([k,v]) => this._upEffText(k, v)).join(' · ');
                    html += `<div class="build-option ${u.can_afford ? '' : 'cant-afford'}">
                        <div class="build-name">${t(u.name)} <span class="building-level">Lv.${u.currentLevel}→${u.nextLevel}</span></div>
                        <div class="build-desc">${u.description}</div>
                        <div class="build-cost">${costStr}</div>
                        <div class="build-effects" style="font-size:0.75rem;color:var(--accent-gold)">${effStr}</div>
                        </div>`;
                });
                html += '</div>';
            }
            const available = this.world.buildings.getAvailable(this.world);
            if (available.length) {
                html += t('<div class="available-buildings"><div class="build-label">可建造（等村民提案）：</div>');
                available.forEach(p => {
                    const costStr = Object.entries(p.costs).map(([r,a]) => `${icons[r]||''}${a}`).join(' ');
                    html += `<div class="build-option ${p.can_afford ? '' : 'cant-afford'}">
                        <div class="build-name">${t(p.name)}</div>
                        <div class="build-desc">${p.description}</div>
                        <div class="build-cost">${costStr}</div>
                        </div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            // v6.37.0 上帝視角:裝飾擺放目錄移除(觀察者不花錢);相鄰組合圖鑑保留為圖鑑
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
        } if (S === 'industry') {
            // Factory (merged from old factory tab)
            const proc = this.state.processing || {};
            const factories = proc.builtFactories || {};
            html += `<div class="econ-section"><h3>🏭 ${t('工廠加工')}</h3>${Object.keys(factories).length ? `<div class="ic-note">${t('鎮上的工廠：{n} 座，各自的配方與工人在下面。').replace('{n}', Object.keys(factories).length)}</div>` : `<div class="ic-note">${t('鎮上還沒有工廠。要蓋哪一座，看下面「可建造工廠」，等村民提案。')}</div>`}</div>`; // v9.18.0 沒工廠時不再只剩一個空標題
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
                        html += ``;
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
                                html += ``;
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
                            html += ` ${t('')}`;
                            html += ` ${t('</span>')}`;
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';
            }
            // Available to build
            const availFac = this.world.processing.getAvailableFactories(this.world);
            if (availFac.length > 0) {
                html += t('<div class="econ-section"><h3>可建造工廠（等村民提案）</h3>');
                availFac.forEach(f => {
                    // v5.53.2 工廠成本在地化:接上與全站一致的資源名稱,不再露出英文 key
                    // v9.18.0 材料一格一格、建造天數單獨一格（原本一整行用「|」接起來）
                    html += `<div class="build-card pg-fac${f.canAfford ? '' : ' short'}"><div><strong>${f.icon} ${t(f.name)}</strong>
                        ${this._icPills([...Object.entries(f.cost).map(([r, a]) => `${icons[r] || '📦'} ${labels[r] || r} <b>×${a}</b>`), `⏱️ ${t('建造天數：')}<b>${f.buildDays}</b>`])}</div>
                        </div>`;
                });
                html += '</div>';
            }
            // Active orders
            const orders = (proc.orders || []).filter(o => o.status === 'active');
            if (orders.length > 0) {
                html += t('<div class="econ-section"><h3>📋 訂單（有貨時村民自己交）</h3>');
                orders.forEach(o => {
                    html += `<div class="build-card"><div><strong>${o.description}</strong>
                        <br><span style="font-size:0.7rem">${t('獎勵：')}${o.reward}${t('銀幣 | 剩餘')}${o.daysLeft}${t('天')}</span></div>
                        </div>`;
                });
                html += '</div>';
            }
        }
        if (S === 'industry') { const B = this._townBlocks(null, ['biz', 'bank']); html += B.biz + B.bank; const tmp = document.createElement('div'); this.renderIndustryAndFarm(tmp); html += tmp.innerHTML; } // v7.3.0 店、銀行(原在鎮況)、產業等級與農場(原本獨立的「產業」頁)
        html += '</div>';
        container.innerHTML = html;
        if (!container._techFold) { container._techFold = 1; container.addEventListener('toggle', (e) => { const d = e.target; if (d?.classList?.contains('tech-era-fold')) (this._techOpen || (this._techOpen = {}))[d.dataset.era] = d.open; }, true); } // v8.2.0 記住時代折疊的開關
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

    // v6.84.0 從政履歷:每段任期(新的在前)、屆數、怎麼卸任、任內批准／否決幾案與大案
    _renderCareer(agentId) {
        const w = this.world, a = w?.agents?.[agentId];
        if (!a || typeof TIERS === 'undefined' || !TIERS.resume) return '';
        let rows = []; try { rows = TIERS.resume(w, a); } catch (e) { return ''; }
        if (!rows.length) return '';
        const esc = (x) => this._escapeHtml(String(x));
        const items = rows.slice(0, 8).map(r => `<div class="career-item${r.current ? ' is-current' : ''}">
            <div class="career-head"><span class="career-title">${r.role === 'council' ? '🏛️' : r.role === 'acting' ? '🪑' : '🎖️'} ${esc(r.title)}${r.current ? ` <span class="career-now">${t('任職中')}</span>` : ''}</span><span class="career-period">${esc(r.period)}</span></div>
            ${r.notes.length ? `<div class="career-notes">${r.notes.map(esc).join(t('；'))}</div>` : ''}
            ${r.bills.length ? `<div class="career-bills">${t('任內大案')}${t('：')}${r.bills.map(esc).join(t('、'))}</div>` : ''}
        </div>`).join('');
        return `<div class="detail-section career-section"><h3>🗂️ ${t('從政履歷')}</h3>${items}</div>`;
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
        let html = '<div class="economy-panel">'; // v7.3.0 總覽與農場不再分兩頁
        {
            // Town level
            html += `${t('<div class="econ-section"><h3>🏘️ 小鎮等級：')}${ind.townLevelName || t('荒村')} (Lv${ind.townLevel || 1})</h3>`;
            html += `${this._icGrid([{ v: ind.maxIndustries || 1, l: t('產業上限') }, { v: Object.keys(ind.industries || {}).length, l: t('已開啟') }])}</div>`; // v9.18.0 兩個數字改成格子
            // Needs initial industry choice
            if (ind.needsIndustryChoice) {
                html += t('<div class="econ-section"><h3>第一個產業（等村民提案）</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        </div>`;
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
                        html += `<div>
                            <div style="font-size:0.75rem;color:var(--text-secondary)">${costStr}</div></div>`;
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            // Pending unlock
            if (ind._pendingUnlock) {
                html += t('<div class="econ-section"><h3>可開啟新產業（等村民提案）</h3>');
                const available = this.world.industry.getAvailableIndustries(this.world);
                available.forEach(i => {
                    html += `<div class="build-card"><div><strong>${i.icon} ${t(i.name)}</strong><br><span style="font-size:0.75rem">${i.desc}</span></div>
                        </div>`;
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
        } if ((this.state.farm?.plots || []).length || this.state.industry?.industries?.agriculture) {
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
                    html += `${t('')}`;
                } else if (plot.state === 'tilled') {
                    const farmInd = this.world.industry?.industries?.farming;
                    const farmLevel = farmInd?.level || 1;
                    const crops = this.world.farm.getAvailableCrops(farmLevel);
                    const seasonCrops = crops.filter(c => c.seasons.includes(this.world.clock.season));
                    if (seasonCrops.length > 0) {
                        html += '<div style="font-size:0.7rem">';
                        seasonCrops.forEach(c => {
                            html += ``;
                        });
                        html += '</div>';
                    } else {
                        html += t('<span style="font-size:0.7rem;color:var(--text-secondary)">本季無可種作物</span>');
                    }
                } else if (plot.state === 'growing') {
                    html += `${t('')}`;
                    if (!plot.fertilized) html += `${t('')}`;
                } else if (plot.state === 'ready') {
                    html += `${t('')}`;
                } else if (plot.state === 'withered') {
                    html += `${t('')}`;
                }
                html += '</div></div>';
            }
            // Recent harvests
            const log = farm.harvestLog || [];
            if (log.length > 0) {
                html += t('<div class="econ-section"><h3>收穫紀錄</h3>');
                log.slice(-5).reverse().forEach(h => {
                    html += `<div style="font-size:0.75rem;margin:2px 0">${h.cropName} x${h.amount}${t('（')}${h.quality}${t('）')}— ${t(h.season)}${t(' 第')}${h.day}${t('天</div>')}`;
                });
                html += '</div>';
            }
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
