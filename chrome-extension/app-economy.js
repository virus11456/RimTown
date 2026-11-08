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
                        + `<div class="muted-text" style="font-size:0.7rem">${t('倉裡存貨越少越貴（0.6～2.5 倍），每天慢慢調整；工資不會自動跟著漲。職缺跟著人口走，人太多的行業會裁員。')}</div></div>`; } } catch (e) {}
            }
            if (S === 'industry') {
                // v6.89.0 產業與老闆
                try { if (typeof MARKET !== 'undefined' && this.world?.market) { const rows = MARKET.view(this.world); const hung = Object.values(this.world.market.hungry || {}).filter(n => n >= 1).length;
                    html += `<div class="econ-section market-section"><h3>🏭 ${t('產業與老闆')}</h3><div class="market-meta">${t('貧富差距（吉尼係數）')} ${MARKET.gini(this.world)} · ${t('今天沒飯吃')} ${hung} ${t('人')}${this.world.market.deaths ? ` · ${t('餓死')} ${this.world.market.deaths}` : ''}</div>`
                        + ((typeof ESTATE !== 'undefined' && this.world.estate) ? (() => { const e = ESTATE.view(this.world); const B = this.world.bank; return `<div class="market-meta">🏠 ${t('房屋')} ${e.units} ${t('棟')}${t('（')}${t('空屋')} ${e.vacant}${t('、')}${t('公有')} ${e.townOwned}${t('）')} · ${t('房東')} ${e.landlords} ${t('人')} · ${t('平均週租')} ${e.rent} · ${t('無家可歸')} ${e.homelessPeople} ${t('人')} · ${t('傭人')} ${e.servants} ${t('人')}${e.stats.foreclosed ? ` · ${t('被銀行收走')} ${e.stats.foreclosed}` : ''}${(this.world.market.strikes) ? ` · ${t('罷工')} ${this.world.market.strikes} ${t('次')}` : ''}${B?.bankerProfit ? ` · ${t('銀行家利潤')} ${Math.round(B.bankerProfit)}` : ''}</div>`; })() : '')
                        + ((typeof POWER !== 'undefined' && this.world.power) ? (() => { const v = POWER.view(this.world); if (!v.gifts && !v.exposed && !v.spiked && !v.bought && !v.refused) return ''; return `<div class="market-meta power-meta">💰 ${t('政治獻金')} ${v.gifts} ${t('筆')}${t('（')}${v.donated} ${t('銀幣')}${t('）')} · ${t('拒收')} ${v.refused} · 📰 ${t('揭弊')} ${v.exposed} · ${t('新聞被壓下')} ${v.spiked}${v.fired ? ` · ${t('記者被開除')} ${v.fired}` : ''}${v.raised ? ` · ${t('報導後加薪')} ${v.raised}` : ''}${v.recalls ? ` · ${t('罷免改選')} ${v.recalls}` : ''}${v.owned.length ? ` · ${t('報社老闆')}${t('：')}${v.owned.map(x => this._escapeHtml ? this._escapeHtml(x[0] + t('（') + x[1] + t('）')) : x[0]).join(t('、'))}` : ''}</div>`; })() : '')
                        + ((typeof UNION !== 'undefined' && this.world.union?.on) ? (() => { const u = UNION.view(this.world); return `<div class="market-meta union-meta">✊ ${this._escapeHtml ? this._escapeHtml(u.name) : u.name}${t('：')}${t('領袖')} ${this._escapeHtml ? this._escapeHtml(t(u.leader)) : t(u.leader)} · ${t('會員')} ${u.members} ${t('人')} · ${t('罷工基金')} ${u.fund} · ${t('談成加薪')} ${u.won} ${t('次')} · ${t('罷工失敗')} ${u.lost} ${t('次')}${u.fired ? ` · ${t('被開除')} ${u.fired} ${t('人')}` : ''}${u.striking ? ` · ${t('罷工中')}` : ''}</div>`; })() : '')
                        + (rows.length ? rows.map(r => `<div class="market-row"><span class="market-name">${r.icon} ${this._escapeHtml(r.name)}</span><span class="market-owner">${r.owner ? this._escapeHtml(r.owner) : t('公營')}</span><span class="market-num">${t('{n} 人').replace('{n}', r.workers)} · ${t('工資')} ${r.pay}% · ${t('七天營收')} ${r.rev7}／${t('薪水')} ${r.cost7}</span></div>`).join('') : `<div class="muted-text" style="font-size:0.72rem">${t('還沒有人經營產業。')}</div>`) + `</div>`; } } catch (e) {}
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
                    html += `<div class="econ-section ec-local"><h3>🗺️ ${t('本鎮物產')}</h3>
                        <div class="ec-bar">${bar}</div>
                        <div class="ec-line">${kinds}</div>
                        <div class="ec-line ec-muted">${roles}${V.canFish ? '' : ` · ${t('不靠水，不能捕魚')}`}</div>
                        ${diet ? `<div class="ec-line">${diet}</div>` : ''}${eatWell}
                        <div class="ec-line">${toolTxt}</div><div class="ec-line">${saltTxt}</div><div class="ec-line">${paperTxt}</div>
                        ${good ? `<div class="ec-line">💪 ${t('本鎮擅長')}${t('：')}${esc(good)}</div>` : ''}${bad ? `<div class="ec-line ec-muted">🐪 ${t('得靠貿易')}${t('：')}${esc(bad)}</div>` : ''}
                    </div>`;
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
                html += `<div class="econ-section"><h3>⚒️ ${t('加工產能')}<span style="font-weight:normal;font-size:0.68rem;color:var(--text-muted);margin-left:6px">${t('今日產出／消耗（村民自己排班）')}</span></h3>`;
                PROCESSED.forEach(k => {
                    const f = flow[k];
                    const stock = Math.round(res[k] || 0);
                    const fineN = (typeof FLOW !== 'undefined' && this.world && FLOW.FINE_FROM[k]) ? Math.floor(FLOW.fine(this.world, k)) : 0; // v6.80.0
                    const prod = Math.round(f.produced * 10) / 10, cons = Math.round(f.consumed * 10) / 10;
                    const flowClr = prod >= cons ? 'var(--positive)' : 'var(--negative)';
                    const makers = Object.values(this.state.agents || {}).filter(a => a.job?.key === GOOD_JOB[k]).map(a => a.name);
                    const policy = workPolicy[k] || 'normal';
                    // v5.53.0 產出在午夜結算,白天顯示「預估日產」避免 +0 被誤讀成排班沒生效
                    const RECIPE_OUT = { meals: 9, tools: 3, clothing: 2, medicine: 2, furniture: 2 };
                    const est = Math.round(makers.length * (RECIPE_OUT[k] || 0) * (policy === 'off' ? 0 : policy === 'extra' ? 1.5 : 1));
                    const prodHtml = prod > 0 ? `＋${prod}` : `${t('預估日產')} ＋${est}<span style="color:var(--text-muted)">${t('（')}${t('午夜結算')}${t('）')}</span>`;
                    const polBtn = (mode, icon, tip) => ``;
                    html += `<div style="padding:6px 2px;border-bottom:1px solid var(--border);font-size:0.78rem">
                        <div style="display:flex;align-items:center;gap:6px">
                            <span>${icons[k]}</span><span style="font-weight:bold">${labels[k]}</span>
                            <span style="color:var(--text-muted);font-size:0.66rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${makers.length ? '👤 ' + makers.join('、') : t('（無人手）')}</span>
                            <span style="color:var(--text-secondary);font-size:0.7rem">${t('庫存')} ${stock}${fineN >= 1 ? `<span class="ec-fine" title="${t('工坊做的精製品，耗損只有一半')}">${t('（')}✨${t('精製')} ${fineN}${t('）')}</span>` : ''}</span>
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
                const RAWS = ['wood','stone','metal','cloth','herbs','salt','paper']; // v6.77.0 鹽、紙
                const short = RAWS.filter(k => (res[k] || 0) < 10);
                const tight = RAWS.filter(k => (res[k] || 0) >= 10 && (res[k] || 0) < 40);
                const light = short.length ? '🔴' : tight.length ? '🟡' : '🟢';
                const lightText = short.length ? `${t('短缺')}${t('：')}${short.map(k => labels[k]).join(t('、'))}`
                    : tight.length ? `${t('吃緊')}${t('：')}${tight.map(k => labels[k]).join(t('、'))}`
                    : t('原料充足，工坊無虞');
                const detailKeys = Object.keys(res).filter(k => !PROCESSED.includes(k) && k !== 'food' && k !== 'silver' && k !== 'research_points' && Math.round(res[k]) > 0);
                html += `<div class="econ-section"><h3>📦 ${t('原料倉庫')}</h3>
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem">${light}<span>${lightText}</span></div>
                    <details style="margin-top:6px"><summary style="cursor:pointer;font-size:0.72rem;color:var(--text-muted)">${t('展開明細')}</summary>
                    <div class="resource-grid" style="margin-top:6px">`;
                // v6.81.0 作物收成會直接進糧倉(算在食物裡),這裡只留工坊要用的一點:不要標成短缺的紅色,免得以為鎮上缺糧
                const CROPS = (typeof FLOW !== 'undefined' && FLOW.CROP_FOOD) ? Object.keys(FLOW.CROP_FOOD) : ['wheat', 'rice', 'corn', 'potato', 'mushroom', 'grapes', 'sugarcane', 'golden_wheat', 'dragon_fruit'];
                detailKeys.forEach(k => {
                    const amount = res[k];
                    const cls = (amount < 10 && RAWS.includes(k)) ? 'res-low' : amount > 100 ? 'res-high' : '';
                    html += `<div class="resource-item ${cls}"><span class="res-icon">${icons[k] || '📦'}</span><span class="res-label">${labels[k] || k}</span><span class="res-amount">${Math.round(amount)}</span></div>`;
                });
                html += '</div>';
                if (detailKeys.some(k => CROPS.includes(k))) html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">🌾 ${t('田裡收成的作物會直接存進糧倉（算在食物裡），這裡只留工坊要用的一點，數字小是正常的。')}</div>`;
                html += '</details></div>';
                // Trade
                const trade = this.state.trade || {};
                html += `<div class="econ-section"><h3>🤝 ${t('交易')}</h3>`;
                if (trade.merchant) {
                    html += `<div class="merchant-card"><div class="merchant-name">${t(trade.merchant.name)}</div>
                        <div class="merchant-info">${t('專長：')}${({ general: t('雜貨'), metals: t('金屬'), medicine: t('藥材'), textiles: t('布料'), exotic: t('異國貨') })[trade.merchant.specialty] || t(trade.merchant.specialty || '')} | ${trade.merchant.daysRemaining}${t('天後離開')}</div>
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
                        
                            </div>`;
                    });
                    html += '</div></div>';
                    const traderNames = Object.values(this.state.agents || {}).filter(a => a.job?.key === 'trader').map(a => t(a.name));
                    html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">${traderNames.length ? t('{who} 每天會去跟商人談，多的賣、缺的買。').replace('{who}', traderNames.join(t('、'))) : t('鎮上沒有商人職業的村民，鎮長或其他人會代為去談。')}</div>`;
                } else {
                    html += t('<p class="muted-text">鎮上沒有商人，可能很快就會來一位。</p>');
                }
                const th = (this.world?.trade?.tradeHistory || []).slice(-3).reverse();
                if (th.length) { html += `<div style="margin-top:6px;font-size:0.72rem;color:var(--text-secondary)">${t('最近成交')}</div>`; th.forEach(h => { const parts = (h.deals || []).map(d => `${d.type === 'sell' ? t('賣') : t('買')} ${this._resName(d.r)}×${d.qty}`).join(t('、')); html += `<div style="font-size:0.72rem;padding:2px 0">${this._escapeHtml(t(h.who || ''))} ↔ ${this._escapeHtml(t(h.merchant || ''))}${t('：')}${this._escapeHtml(parts)}</div>`; }); }
                html += '</div>';
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
            html += `<div class="econ-section"><h3>🔬 ${t('研究')}<span style="font-weight:normal;font-size:0.72rem;color:var(--text-secondary);margin-left:6px">📚 ${t('研究點')} ${Math.round(res.research_points || 0)} · ${t('現在的時代')}${t('：')}${curEra.icon || ''} ${t(curEra.name || '')}</span></h3>`;
            if (currentKey && projects[currentKey]) {
                const cur = projects[currentKey];
                const pct = Math.round((cur.progress / cur.cost) * 100);
                html += `${t('<div class="research-current">研究中：<strong>')}${t(cur.name)}</strong>
                    <div class="progress-bar"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>
                    <span class="progress-text">${pct}%</span></div>`;
            }
            const scholars = Object.values(this.state.agents || {}).filter(a => a.job?.key === 'researcher').map(a => t(a.name));
            html += `<div style="font-size:0.7rem;color:var(--text-muted);margin:4px 0 6px">${scholars.length ? t('研究員：') + scholars.join(t('、')) : t('鎮上還沒有研究員，研究進度只靠研究點。')}${!currentKey ? ' · ' + t('目前沒在研究：研究員做的進度先存著，等村民提「研究」提案（兩天沒人提，學者會自己挑最早時代的）') : ''}</div>`;
            html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">${t('建築與工坊要先研究到才蓋得了（穀倉、深井除外）；哪一項先研究由村民提案、投票、鎮長裁決。')}</div>`;
            // ---- v7.8.0 科技路線 ----
            if (TV) {
                const esc = (x) => this._escapeHtml(String(x ?? ''));
                html += `<div class="tech-era tech-path"><div class="tech-era-head">🧭 ${t('科技路線')}${TV.path ? ` <span>${TV.icon} ${esc(TV.pathName)}</span>` : ''}</div>`;
                if (!TV.path) {
                    html += `<div class="tech-desc">${TV.debate ? `🗳️ ${t('鎮上正在辯論要不要走「{name}」路線').replace('{name}', t('電子機械'))}${t('：')}${TV.debate.id} · ${t('贊成')} ${TV.debate.f} · ${t('反對')} ${TV.debate.a}` : TV.main3 >= TV.gate ? `🗳️ ${t('工坊時代研究到 {n}%，鎮上很快會開始辯論科技路線').replace('{n}', TV.main3)}` : `🔒 ${t('工坊時代研究到 {g}% 時，鎮上會辯論往後走哪條科技路線（現在 {n}%）').replace('{g}', TV.gate).replace('{n}', TV.main3)}`}${TV.tries ? ` · ${t('被否決過 {n} 次').replace('{n}', TV.tries)}` : ''}</div>`;
                    html += `<div class="tech-desc" style="color:var(--text-muted)">⚙️ ${t('電子機械')}${t('：')}${t('工廠、電力、核能，最後飛向太空')}${t('。')}${t('生產力最高：機器替人做粗活，研究越來越快')}${t('；')}${t('機器會搶走工作，核電一出事就是大災')}${t('。')}</div>`;
                    html += `<div class="tech-desc" style="color:var(--text-muted)">🧬 ${t('基因生物')}${t('、')}🚂 ${t('蒸汽龐克')}${t('：')}${t('之後的版本開放')}</div>`;
                } else {
                    html += `<div class="tech-desc">${esc(TV.short)}${t('。')}${TV.since != null ? ` ${t('第 {d} 天決定').replace('{d}', TV.since)}` : ''}${TV.yes || TV.no ? ` · ${t('贊成')} ${TV.yes} · ${t('反對')} ${TV.no}` : ''}</div>`;
                    html += `<div class="tech-desc">👍 ${esc(TV.pro)} · 👎 ${esc(TV.con)}</div>`;
                    const stg = [4, 5, 6].map(e => { const en = eraN(e, TV.path); return `${en.icon} ${t(en.name)} ${TV.stage[e]}%`; }).join(' → ');
                    html += `<div class="tech-desc">${stg}</div>`;
                    const rk = TV.risk ? { low: t('低'), mid: t('中'), high: t('高') }[TV.risk] : null;
                    html += `<div class="tech-desc">☢️ ${TV.noNuke ? t('已經廢核') : TV.nuke ? `${t('核災風險')}${t('：')}<b class="tech-risk-${TV.risk}">${rk}</b>${TV.law ? ` · 📋 ${t('有核安法')}` : ` · ${t('沒有核安法')}`}` : t('還沒有核電廠')}</div>`;
                    if (TV.jobs?.length) html += `<div class="tech-desc">🤖 ${t('機器搶走的職缺')}${t('：')}${TV.jobs.map(k => t(JOB_DEFINITIONS?.[k]?.title || k)).join(t('、'))}</div>`;
                    const st = TV.st || {};
                    html += `<div class="tech-desc" style="color:var(--text-muted)">🟡 ${t('小事')} ${st.minor || 0} · 🟠 ${t('中事')} ${st.mid || 0} · 🔴 ${t('大災')} ${st.big || 0}${st.laid ? ` · ${t('被機器裁員')} ${st.laid}` : ''}${st.died ? ` · ${t('罹難')} ${st.died}` : ''}${st.left ? ` · ${t('搬走')} ${st.left}` : ''}</div>`;
                }
                html += '</div>';
            }
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
            const P = TV?.path || null;
            const groups = [
                { e: 1, f: p => (p.era || 1) === 1 }, { e: 2, f: p => (p.era || 1) === 2 }, { e: 3, f: p => (p.era || 1) === 3 },
                { e: 4, f: p => (p.era || 1) === 4, en: eraN(4, P) },
                { e: 5, f: p => p.era === 5 && p.path === 'electro', en: eraN(5, 'electro'), lock: TV && (!P || TV.stage[4] < TV.gate || TV.tier < 2) ? t('電力時代要：先決定走電子機械路線、機械時代研究到 75%、城鎮升到城市') : '' },
                { e: 6, f: p => p.era === 6 && p.path === 'electro', en: eraN(6, 'electro'), lock: TV && (!P || TV.stage[5] < TV.gate || TV.tier < 3) ? t('太空時代要：電力時代研究到 75%、城鎮升到王都') : '' },
                { e: 5, f: p => p.era === 5 && !p.path, en: ERAS[5], bio: 5 }, { e: 6, f: p => p.era === 6 && !p.path, en: ERAS[6], bio: 6 },
                { e: 7, f: p => p.era === 7, en: ERAS[7] },
            ];
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
                const head = `${era >= 4 && !g.bio && (P || era > 4) ? '⚙️ ' : ''}${t('第 {n} 時代').replace('{n}', t(['', '一', '二', '三', '四', '五', '六'][era]))}${t('・')}${t(en.name || '')}`;
                html += `<div class="tech-era"><div class="tech-era-head">${en.icon || ''} ${head} <span>${done}/${list.length}</span></div>`;
                if (g.lock) html += `<div class="tech-desc" style="color:var(--text-muted)">🔒 ${g.lock}</div>`;
                if (era === 4 && TV && !P) html += `<div class="tech-desc" style="color:var(--text-muted)">🔒 ${t('標 ⚙️ 的是電子機械路線的科技，決定走這條路之後才能研究')}</div>`;
                if (g.bio === 6 && typeof MYTH !== 'undefined' && this.world && !MYTH.eraOpen(this.world)) html += `<div class="tech-desc" style="color:var(--text-muted)">🔒 ${t('神話基因研究要：生技全部研究完、城鎮升到王都；之後還要蓋基因實驗室')}</div>`; // v7.5.0
                if (g.bio === 5 && typeof HEALTH !== 'undefined' && this.world && !HEALTH.bioOpen(this.world)) html += `<div class="tech-desc" style="color:var(--text-muted)">🔒 ${t('生技研究要：機械時代全部研究完、城鎮升到城市、蓋好研究院')}</div>`; // v7.4.0
                for (const p of list) {
                    const st = p.status === 'complete' ? 'done' : p.key === currentKey || p.status === 'researching' ? 'now' : p.status === 'available' ? 'open' : 'locked';
                    const icon = { done: '✅', now: '🔬', open: '🟢', locked: '🔒' }[st];
                    const pct = p.cost ? Math.min(100, Math.round((p.progress || 0) / p.cost * 100)) : 0;
                    const need = (p.prerequisites || []).filter(k => projects[k]?.status !== 'complete').map(k => t(projects[k]?.name || k));
                    html += `<div class="tech-node tech-${st}">
                        <div class="tech-node-head"><span>${icon} ${p.path && era === 4 ? '⚙️' : ''}<b>${t(p.name)}</b></span><span class="tech-cost">${st === 'done' ? t('已完成') : st === 'now' ? `${pct}%` : `${p.cost} ${t('點')}`}</span></div>
                        <div class="tech-desc">${this._escapeHtml(p.description || '')}</div>
                        ${(p.unlocks || []).length ? `<div class="tech-unlocks">${t('解鎖')}${t('：')}${p.unlocks.map(unlockName).join(t('、'))}</div>` : ''}
                        ${LOST[p.key] ? `<div class="tech-need tech-scroll">📜 ${t('殘卷')}${t('：')}${t('在{c}之後失傳，留下 {n}% 的進度').replace('{c}', this._escapeHtml(t(LOST[p.key].c || ''))).replace('{n}', pct)}</div>` : ''}
                        ${st === 'locked' && need.length ? `<div class="tech-need">${t('需要先研究')}${t('：')}${need.join(t('、'))}</div>` : ''}
                        ${(() => { const sm = st === 'done' && this.world?.ideaSystem?.summary?.(this.world, p.key); if (!sm) return ''; const und = Math.max(0, sm.total - sm.adopt - sm.resist); const pa = sm.total ? Math.round(sm.adopt / sm.total * 100) : 0, pr = sm.total ? Math.round(sm.resist / sm.total * 100) : 0; return `<div class="tech-idea">💡 ${t(sm.idea)}<div class="idea-bar"><span class="idea-a" style="width:${pa}%"></span><span class="idea-r" style="width:${pr}%"></span></div><div class="idea-legend">${t('接受')} ${sm.adopt} · ${t('反對')} ${sm.resist} · ${t('還沒聽說')} ${und}</div></div>`; })()}
                        ${st === 'now' ? `<div class="progress-bar" style="height:4px;margin-top:4px"><div class="progress-fill research-fill" style="width:${pct}%"></div></div>` : ''}
                    </div>`;
                }
                html += '</div>';
            }
            // v7.8.0 路線帶來的問題(最近)
            if (TV?.inc?.length) {
                const LV = { minor: '🟡', mid: '🟠', big: '🔴' }; const EVN = { injury: '機器夾傷', blackout: '停電', oldhand: '老師傅跟不上', waste: '工坊廢水', radio: '收音機吵架', alarm: '核電廠警報', layoff: '自動化裁員', smash: '砸機器', leak: '輻射外洩', watch: 'AI 監控爭議', meltdown: '核災' };
                html += `<div class="tech-era"><div class="tech-era-head">⚠️ ${t('新技術帶來的問題')}</div>` + TV.inc.map(x => `<div class="tech-desc">${LV[x.lv] || ''} ${x.icon} ${t(EVN[x.id] || x.id)} · ${x.ago ? t('{n} 天前').replace('{n}', x.ago) : t('今天')}</div>`).join('') + '</div>';
            }
            // v6.46.0 革新派／保守派、發明名人堂
            const IS = this.world?.ideaSystem;
            if (IS) {
                const fx = IS.factions(this.world); const nm = (arr) => arr.map(n => t(n)).join(t('、')) || t('（沒有）');
                html += `<div class="tech-era"><div class="tech-era-head">⚖️ ${t('新技術的支持與反對')}</div>
                    <div class="tech-desc">🚀 ${t('革新派')} ${fx.progressive.length}${t('：')}${nm(fx.progressive)}</div>
                    <div class="tech-desc">🤔 ${t('中間派')} ${fx.moderate.length}</div>
                    <div class="tech-desc">🏺 ${t('保守派')} ${fx.conservative.length}${t('：')}${nm(fx.conservative)}</div>
                    <div class="tech-desc" style="color:var(--text-muted)">${t('研究完成會帶來新觀念，靠村民聊天傳開；個性、年紀、職業和鎮上民風決定誰接受、誰反對。立場會影響競選政見，被新工坊搶了飯碗的匠人可能提案抗議。')}</div></div>`;
                const inv = (IS.inventions || []).slice(-8).reverse();
                html += `<div class="tech-era"><div class="tech-era-head">✨ ${t('發明名人堂')} <span>${(IS.inventions || []).length}</span></div>` + (inv.length ? inv.map(v => `<div class="tech-desc">${t('「')}${t('{name}式{thing}').replace('{name}', t(v.by)).replace('{thing}', t(v.thing))}${t('」')}${v.tech && projects[v.tech] ? ` · ${t('推進了')}${t(projects[v.tech].name)}` : ''}${v.disputedBy ? ` · 😤 ${t('{who}說是他先想到的').replace('{who}', t(v.disputedBy))}` : ''}</div>`).join('') : `<div class="tech-desc" style="color:var(--text-muted)">${t('還沒有人靈光一閃。有創意、勤快的村民工作時偶爾會想出新東西。')}</div>`) + '</div>';
            }
            html += '</div>';
        } if (S === 'goods') {
            // v4.0: Shop system — card grid layout
            html += t('<div class="econ-section"><h3>🛒 商店</h3>');
            const silverAmount = Math.round(res['silver'] || 0);
            html += `<div style="margin-bottom:8px;font-size:0.85rem">${t('💰 公庫銀幣：')}<strong>${silverAmount}</strong></div>`;
            const slog = (this.world?.shop?.transactionLog || []).slice(-6).reverse();
            html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">${t('物價板。小量補貨與拋售由村民每天自己做，大宗進貨／拋售走「提案」。')}</div>`;
            if (slog.length) { html += `<div style="margin-bottom:8px"><div style="font-size:0.72rem;color:var(--text-secondary)">${t('最近買賣')}</div>`; slog.forEach(x => { const nm = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[x.item]) ? SHOP_ITEMS[x.item].name() : x.item; html += `<div style="font-size:0.72rem;padding:2px 0">${x.type === 'buy' ? '🛒 ' + t('買進') : '💰 ' + t('賣出')} ${this._escapeHtml(nm)}×${x.amount} · ${x.type === 'buy' ? x.cost : x.income} ${t('銀幣')}</div>`; }); html += '</div>'; }
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
                    html += `<div class="shop-card-stock">${t('買')} ${item.buyPrice}💰 · ${t('賣')} ${item.sellPrice}💰</div>`;
                    html += ``;
                    html += ``;
                    html += `</div>`;
                }
                html += '</div>';
            }
            html += '</div>';
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
                    const effStr = Object.entries(u.effects).map(([k,v]) => `${k}:${v>0?'+':''}${v}`).join(' ');
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
                    const costStr = Object.entries(f.cost).map(([r,a]) => `${icons[r] || '📦'}${labels[r] || r}×${a}`).join(' ');
                    const canBuild = f.canAfford ? '' : ' disabled';
                    html += `<div class="build-card"><div><strong>${f.icon} ${t(f.name)}</strong>
                        <br><span style="font-size:0.7rem">${costStr}${t(' | 建造天數：')}${f.buildDays}</span></div>
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
            html += `${t('<div style="font-size:0.8rem;color:var(--text-secondary)">產業上限：')}${ind.maxIndustries || 1}${t(' | 已開啟：')}${Object.keys(ind.industries || {}).length}</div></div>`;
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
