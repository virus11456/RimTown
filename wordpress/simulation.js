// ============================================================
// RimTown Simulation Engine - Complete JS Port
// ============================================================
// v6.1.0 B14：村民／對話／城鎮事件／經濟／社會系統搬到 sim-agent／sim-conversation／sim-town／sim-economy／sim-society.js（在本檔之前載入），
// 聲望／天氣／議會／決策／商店／事件選擇／求助搬到 sim-systems.js（在本檔之後載入）；本檔只剩 World 與工具函式。

// --- World ---
class World {
    constructor() {
        this.clock = new GameClock();
        this.events = new EventSystem();
        this.election = new ElectionSystem();
        this.agents = {};
        this.townMap = null;
        this.tickCount = 0;
        this.paused = false;
        this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
        this.conversationEngine = new ConversationEngine();
        // Economy
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
        // New systems
        this.factions = new FactionSystem();
        this.festivals = new FestivalSystem();
        this.lifecycle = new LifecycleSystem();
        this.exploration = new ExplorationSystem();
        // v3 systems
        this.industry = new IndustryManager();
        this.farm = new FarmSystem();
        this.processing = new ProcessingSystem();
        this.dailyNews = new DailyNewsEngine();
        this.requests = (typeof RequestBoard !== 'undefined') ? new RequestBoard() : null; // v5.91.0 委託板
        this.playerCaravan = { active: null, history: [], pendingInjury: null }; // v5.92.0 押商隊
        this.trials = (typeof SeasonTrials !== 'undefined') ? new SeasonTrials() : null; // v5.93.0 季度考驗
        this.growth = (typeof TravellerGrowth !== 'undefined') ? new TravellerGrowth() : null; // v5.94.0 旅人成長
        this.recap = (typeof SeasonRecap !== 'undefined') ? new SeasonRecap() : null; // v5.98.0 季末回顧
        this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
        this.lifeGoals = new LifeGoalSystem(); // v5.4.0 人生故事線
        this.customNPC = typeof CustomNPCSystem !== 'undefined' ? new CustomNPCSystem() : null;
        this.multiEnding = typeof MultiEndingSystem !== 'undefined' ? new MultiEndingSystem() : null;
        // v4.0 systems
        this.dailyDecision = new DailyDecisionSystem();
        this.shop = new ShopSystem();
        this.eventChoice = new EventChoiceSystem();
        this.npcHelp = new NPCHelpSystem();
        this.reputationSystem = new ReputationSystem();
        this.weather = new WeatherSystem();
        this.council = new CouncilSystem();
    }
    addAgent(agent) { this.agents[agent.agentId] = agent; }
    removeAgent(id) { delete this.agents[id]; }
    getAgent(id) { return this.agents[id] || null; }
    getAgentByName(name) { return Object.values(this.agents).find(a => a.name === name) || null; }
    getAgentsAtLocation(locId) { return Object.values(this.agents).filter(a => a.currentLocation === locId); }
    logMessage(type, content, agentName = '', targetName = '') {
        this.messageLog.push({ time:this.clock.timeStr, tick:this.tickCount, type, content, agent:agentName, target:targetName });
        if (this.messageLog.length > 1000) this.messageLog = this.messageLog.slice(-1000); // v5.99.0 B12
    }
    tick() {
        if (this.paused) return;
        this.tickCount++;
        // v5.43.0 編年史:記下「今天」的身分,換日瞬間把這一天完整打包歸檔
        const prevDayIds = { year: this.clock.year, season: this.clock.season, day: this.clock.day };
        const timeEvents = this.clock.tick();
        if (timeEvents.includes('new_day')) {
            // v5.43.0 小鎮編年史:趁足跡/行程還沒被新的一天覆蓋,先打包昨天交給 UI 存進資料庫
            if (this.onDayArchive) { try { this.onDayArchive(this._buildDayArchive(prevDayIds)); } catch (e) { console.warn('[RimTown] chronicle error:', e); } }
            // v5.34.0 逾時代選:互動選擇放超過一個遊戲日沒人理,小鎮自行決定,避免卡住事件線
            this._autoResolveStaleChoices();
            const event = this.events.dailyUpdate(this);
            if (event) {
                this.logMessage('event', `[${event.severity.toUpperCase()}] ${event.name}: ${event.description}`);
                // v4.0: Offer player a choice for significant events
                // v5.32.0 第二章(繁榮 20)起才把事件應對交給玩家,第一章自動結算不打擾
                if (event.severity !== 'minor' && this.eventChoice && (this.prosperity?.prosperity || 0) >= 20) {
                    this.eventChoice.offerChoice(event, this);
                }
                // Only auto-apply mood if no choice was offered
                if (!this.eventChoice?.pendingEvent && event.effects.mood_all != null) {
                    Object.values(this.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + event.effects.mood_all; });
                }
                if (this.dailyNews) this.dailyNews.collectEvent('event', `${event.name}${t('：')}${event.description}`, event.severity === 'critical' ? 10 : event.severity === 'major' ? 8 : 5);
            }
            // Relationship progression (dating, marriage, breakup, etc.)
            this._processRelationships();
            // v5.42.0 衝突敘事:絕交偵測 + 廣場對嗆 + 圍觀選邊站
            try { this._processFeuds(); } catch (e) { console.warn('[RimTown] feud error:', e); }
            // v5.49.0 戲劇導演:小鎮太平靜時在後台輕推一把,確保戲一直有得看
            try { this._dramaDirector(); } catch (e) { console.warn('[RimTown] director error:', e); }
            try { this._visitorDaily(); } catch (e) { console.warn('[RimTown] visitor error:', e); } // v5.56.0 跨鎮互訪
            try { this._caravanDaily(); } catch (e) { console.warn('[RimTown] caravan error:', e); } // v5.80.0 跨鎮商隊
            try { this.requests?.dailyRoll(this); } catch (e) { console.warn('[RimTown] request error:', e); } // v5.91.0 委託板:結算昨天、發今天
            try { this._playerCaravanDaily(); } catch (e) { console.warn('[RimTown] player caravan error:', e); } // v5.92.0 押商隊回報
            try { this.trials?.daily(this); } catch (e) { console.warn('[RimTown] trial error:', e); } // v5.93.0 季度考驗:第 5 天公布、季末結算
            try { this.recap?.daily(this); } catch (e) { console.warn('[RimTown] recap error:', e); } // v5.98.0 季末回顧:換季那天結算上一季
            // Daily news (before economy/events so modifiers apply)
            this.news.dailyUpdate(this);
            // Daily economy
            processDailyProduction(this);
            this.stockpile.history.filter(h=>h.amount>0).slice(-50).forEach(h=>this.workOrders.updateProgress(h.resource,h.amount));
            this.buildings.dailyConstruction(this);
            this.trade.dailyUpdate(this);
            this.research.dailyUpdate(this);
            this.workOrders.cleanup();
            // Election system
            const electionEvent = this.election.dailyUpdate(this);
            if (electionEvent) {
                this.logMessage('event', `[${electionEvent.severity.toUpperCase()}] ${electionEvent.name}: ${electionEvent.description}`);
                if (this.dailyNews) this.dailyNews.collectEvent('politics', `${electionEvent.name}${t('：')}${electionEvent.description}`, 8);
            }
            // New systems daily updates
            this.factions.dailyUpdate(this);
            this.festivals.dailyUpdate(this);
            this.townIdentity.dailyUpdate(this); // v5.19.0 城鎮身分逐日累積並結晶
            this.checkHeartEvents(); // v5.0.0 每日掃描心動事件門檻
            this._processThoughts(); // v5.15.0 記憶想法:清過期 + 對特定對象的好感漂移
            // v5.29.0 記憶流每日反思(規則式 + 每天至多 1 次 LLM),並重置 NPC 對話 LLM 額度
            this.conversationEngine.dailyReflection(this).catch(e => console.warn('[RimTown] reflection error:', e));
            this.npcLlmUsedToday = 0;
            // v5.30.0 每天早上為每位村民生成今日目標(規則式,依性格+人際+夢想+事件)
            Object.values(this.agents).forEach(a => { if (!a.isPlayer && !a.isDead && a.generateDailyPlan) { try { a.generateDailyPlan(this); } catch (e) {} } });
            // v5.39.1 LLM 行程佇列改由下方的每日檢查統一觸發(換日與讀檔中途都涵蓋)
            this.generateDailyFeedPosts(); // v5.2.0 鎮民動態每日發文
            if (this.clock.day % 7 === 0) this.generateWeeklyDigest(); // v5.3.0 每 7 天小鎮頭條
            this.lifecycle.dailyUpdate(this);
            this.exploration.dailyUpdate(this);
            // v3 systems daily updates
            this.industry.dailyUpdate(this);
            this.farm.dailyUpdate(this);
            this.processing.dailyUpdate(this);
            this.npcEvents.dailyUpdate(this);
            if (this.prosperity) this.prosperity.dailyUpdate(this);
            if (this.npcQuests) this.npcQuests.dailyUpdate(this);
            if (this.lifeGoals) this.lifeGoals.dailyUpdate(this); // v5.4.0
            // v5.58.0 邊境鎮主線任務不在海風鎮跑(任務卡司是邊境鎮居民;海風鎮主題任務鏈待後續)
            if (this.questSystem && typeof questChainFor === 'function' && questChainFor(this.townTheme)) { this.questSystem.theme = this.townTheme || 'frontier'; this.questSystem.checkProgress(this); } // v5.83.0 依主題跑對應任務鏈
            // v4.0 systems
            // v5.32.0 章節門檻:互動卡片第二章(繁榮 20)起、議會第四章(繁榮 70)起才啟動
            const chapterPros = this.prosperity?.prosperity || 0;
            if (chapterPros >= 20) this.dailyDecision.dailyUpdate(this);
            // v5.49.0 際遇卡停止每日抽;v5.82.0 整個系統移除
            this.dailyDecision.processFollowups(this);
            if (chapterPros >= 20) this.npcHelp.dailyUpdate(this);
            this.reputationSystem.dailyUpdate(this);
            this.weather.dailyUpdate(this);
            if (chapterPros >= 70) this.council.dailyUpdate(this);
            // AI Daily News (async, fire-and-forget)
            this.dailyNews.generateNewspaper(this).catch(e => console.warn('[DailyNews] Error:', e));
            // v5.31.0 今日焦點:回答「我現在該做什麼、為什麼」(放最後,讓它讀得到當日 pending 狀態)
            try { this.generateDailyFocus(); } catch (e) { console.warn('[RimTown] daily focus error:', e); }
            // v5.45.0 昨日回響:你昨天的舉動在小鎮發酵了什麼
            try { this._generateDailyEcho(prevDayIds); } catch (e) { console.warn('[RimTown] daily echo error:', e); }
        }
        Object.values(this.agents).forEach(agent => {
            if (agent.currentLocation === 'exploration') return; // Skip agents on expedition
            agent.update(this);
        });
        // NPC proactive messaging to player
        this.conversationEngine.tickProactiveMessages(this).catch(e => console.warn('[RimTown] Proactive msg error:', e));
        // v5.39.1 每個遊戲日補排一次 LLM 行程佇列:換日觸發之外,讀檔/開頁在一天中途也會立刻補生成
        // (queueDailyPlans 只收「今天還沒有 AI 行程」的村民,已完成的不會重做)
        const planDayKey = `${this.clock.year}-${this.clock.season}-${this.clock.day}`;
        if (this._planQueueDay !== planDayKey && this.conversationEngine?.llm) {
            this._planQueueDay = planDayKey;
            try { this.conversationEngine.queueDailyPlans(this); } catch (e) {}
        }
        // v5.37.0 每個 tick 處理一批排隊中的村民 LLM 行程(避免瞬間打爆 API)
        this.conversationEngine.tickPlanQueue(this).catch(e => console.warn('[RimTown] plan queue error:', e));
    }
    // v5.45.0 蝴蝶效應:記下你的社交行動與當下的關係快照,隔天對照「發酵了什麼」
    // ============================================================
    // v5.56.0 雙城P1:村民跨鎮互訪
    // 兩鎮存檔獨立,交流靠「信箱」:出訪時把完整人格打包寫進對方鎮的
    // 訪客信箱(app 層負責讀寫 localStorage),玩家切到那個鎮時實體化;
    // 期滿返鄉,見聞寫進回鄉信箱,原鎮的本尊回來後收到這些記憶
    // ============================================================
    _absDay() {
        const si = ['春季','夏季','秋季','冬季'].indexOf(this.clock.season);
        return ((this.clock.year - 1) * 4 + Math.max(0, si)) * 15 + this.clock.day;
    }
    // v5.80.0 跨鎮商隊:每 3 天從某個已通車的鎮來一隊商隊,用本鎮多的東西換對方多的東西
    // (五鎮各有所長:漁獲帆布／石材金屬／木材草藥／銀幣布料),市集城經手的交易多兩成
    _caravanDaily() {
        if (!Array.isArray(this.otherTowns) || !this.otherTowns.length) return;
        if (this.weather?.activeDisaster?.effects?.caravan_halt) return; // v5.87.0 商隊劫案期間城門緊閉,商隊不來
        const day = this._absDay();
        const route = !!(this.harborFlags?.seaRoute || this.harborFlags?.tradeRoute); // v5.85.0 海路／商路(各鎮任務鏈終章)
        const every = route ? 2 : 3; // v5.84.0 海路開通:兩天一趟
        if (this.lastCaravanDay != null && day - this.lastCaravanDay < every) return;
        const myKey = this.townTheme || 'frontier';
        const mine = TOWN_THEMES[myKey] || TOWN_THEMES.frontier;
        const cands = this.otherTowns.map(tw => ({ tw, key: themeKeyOfTownName(tw.name) })).filter(c => c.key && c.key !== myKey && TOWN_THEMES[c.key]);
        if (!cands.length) return;
        const pick = pickRandom(cands);
        const other = TOWN_THEMES[pick.key];
        const give = (mine.exports || []).find(rs => (other.imports || []).includes(rs)) || (mine.exports || [])[0];
        const recv = (other.exports || []).find(rs => (mine.imports || []).includes(rs)) || (other.exports || [])[0];
        if (!give || !recv) return;
        const giveAmt = Math.min(40, Math.floor((this.stockpile.get(give) || 0) * 0.12));
        if (giveAmt < 5) return; // 本鎮也沒餘貨,商隊空手而回,過兩天再試
        const hub = ((myKey === 'market' || pick.key === 'market') ? Math.ceil(giveAmt * 0.2) : 0) + (route ? Math.ceil(giveAmt * 0.2) : 0); // v5.84.0 海路加成
        const recvAmt = giveAmt + hub;
        this.stockpile.add(give, -giveAmt, this.tickCount, t('跨鎮商隊'), pick.tw.name);
        this.stockpile.add(recv, recvAmt, this.tickCount, t('跨鎮商隊'), pick.tw.name);
        this.lastCaravanDay = day;
        this.caravanCount = (this.caravanCount || 0) + 1; // v5.84.0 任務條件
        const label = (rs) => (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[rs]?.name) ? SHOP_ITEMS[rs].name() : (rs === 'silver' ? t('銀幣') : rs);
        const msg = `${t(pick.tw.name)}${t('的商隊來了：用')} ${giveAmt} ${label(give)} ${t('換到')} ${recvAmt} ${label(recv)}${hub ? t('（市集城經手，多兩成）') : ''}`;
        this.logMessage('trade', `🐪 ${msg}`);
        if (this.events?.conversationTopics) this.events.conversationTopics.push(`${t(pick.tw.name)}${t('的商隊帶來了')}${label(recv)}`);
        this.onCaravan?.({ fromName: pick.tw.name, fromTheme: pick.key, give, giveAmt, recv, recvAmt, hub });
    }

    // ============================================================
    // v5.95.0 有目的的對話(README H5):每種意圖先用規則算成功率(屬性+好感+對方性格),按下去擲骰
    // ============================================================
    chatOdds(npc, key) {
        const player = this.agents?.player; if (!npc || !player) return { p: 0.5, factors: [] };
        const rel = npc.relationships?.relationships?.player || { affinity: 0, trust: 0 };
        const g = this.growth; const at = (k) => g ? g.attr(this, k) : ((player.attributes || {})[k] || 5);
        const traits = npc.personality?.traits || [];
        const BASE = { comfort: 0.8, gossip: 0.7, persuade: 0.55, mediate: 0.5, flirt: 0.5, threaten: 0.6, request: 0.5, help: 0.5, bargain: 0.5, 'invite-town': 0.6 };
        let p = BASE[key] ?? 0.6; const f = [];
        const add = (v, label) => { if (!v) return; p += v; f.push({ v, label }); };
        if (['comfort', 'flirt', 'persuade', 'invite-town', 'request'].includes(key)) add((at('charm') - 5) * 0.03, t('魅力'));
        if (['gossip', 'bargain', 'mediate'].includes(key)) add((at('wit') - 5) * 0.03, t('機智'));
        if (['threaten', 'help'].includes(key)) add((at('grit') - 5) * 0.03, t('毅力'));
        add(Math.max(-0.25, Math.min(0.25, (rel.affinity || 0) / 200)), t('好感'));
        if (['request', 'help', 'bargain', 'invite-town'].includes(key)) add(Math.max(-0.15, Math.min(0.15, (rel.trust || 0) / 300)), t('信任'));
        const T = (tr, keys, v, label) => { if (traits.includes(tr) && keys.includes(key)) add(v, label); };
        T('shy', ['gossip', 'flirt', 'invite-town'], -0.1, t('害羞')); T('gossip', ['gossip'], 0.15, t('愛八卦')); T('abrasive', ['persuade', 'mediate', 'comfort'], -0.1, t('刻薄'));
        T('kind', ['help', 'request', 'comfort'], 0.1, t('善良')); T('stoic', ['comfort', 'threaten'], -0.1, t('堅忍')); T('charismatic', ['persuade', 'bargain'], -0.05, t('有主見'));
        T('romantic', ['flirt'], 0.1, t('浪漫')); T('jealous', ['flirt'], -0.1, t('善妒')); T('optimist', ['invite-town', 'help'], 0.05, t('樂觀')); T('pessimist', ['comfort'], -0.05, t('悲觀'));
        if (key === 'bargain') add(npc.job?.key === 'trader' ? 0.15 : (npc.job?.key === 'mayor' || npc.job?.key === 'cook') ? 0.05 : -0.15, t('職業'));
        if (key === 'help' && npc._lastHelpDay === `${this.clock.year}-${this.clock.season}-${this.clock.day}`) add(-0.3, t('今天幫過了'));
        if (g?.has('silvertongue') && ['persuade', 'mediate'].includes(key)) add(0.08, t('巧舌'));
        p = Math.max(0.1, Math.min(0.95, p));
        return { p, factors: f };
    }
    // ============================================================
    // v5.92.0 押商隊(README H2):自己選貨、目的鎮、護衛、路線;兩天後回報賺或遇劫
    // ============================================================
    playerCaravanQuote(toTheme, res, amount, guard, route) {
        const item = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[res]) || null;
        const unit = res === 'silver' ? 1 : (item?.sellPrice || 2);
        const dest = (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[toTheme]) || null;
        let margin = 0.2;
        if (dest && (dest.imports || []).includes(res)) margin += 0.2;        // 對方缺的貨
        if (this.harborFlags?.tradeRoute || this.harborFlags?.seaRoute) margin += 0.2; // 本鎮開通商路
        if (this.harborFlags?.guildSeal) margin += 0.1; // v5.93.0 商會印信
        if (this.growth?.has('shrewd')) margin += 0.05; // v5.94.0 天賦:精算
        if (this.bargainUntilAbsDay && this._absDay() <= this.bargainUntilAbsDay) margin += 0.05; // v5.95.0 談條件:談成後兩天內 +5%
        const base = unit * amount;
        const value = Math.round(base * (1 + margin));
        let risk = route === 'mountain' ? 0.25 : 0.10;
        if (guard) risk *= 0.5;
        if (this.harborFlags?.cityGuard) risk *= 0.7;
        if (this.growth?.has('pathfinder')) risk *= 0.8; // v5.94.0 天賦:識途
        const days = route === 'mountain' ? 1 : 2;
        return { base, value, margin, risk, days, fee: guard ? 20 : 0, wanted: !!(dest && (dest.imports || []).includes(res)) };
    }
    availableGuards() {
        return Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead && a.job?.key === 'guard' && !String(a.agentId).startsWith('visit_'));
    }
    launchPlayerCaravan(opt) {
        const pc = this.playerCaravan || (this.playerCaravan = { active: null, history: [], pendingInjury: null });
        if (pc.active) return { ok: false, msg: t('已經有一隊商隊在路上') };
        const res = opt.res, amount = Math.floor(opt.amount || 0);
        if (!res || amount < 10) return { ok: false, msg: t('至少要押 10 份貨') };
        if ((this.stockpile.get(res) || 0) < amount) return { ok: false, msg: t('物資不足') };
        const guard = opt.guardId ? this.agents[opt.guardId] : null;
        if (opt.guardId && (!guard || guard.job?.key !== 'guard')) return { ok: false, msg: t('這位守衛現在不在鎮上') };
        const q = this.playerCaravanQuote(opt.toTheme, res, amount, !!guard, opt.route);
        if (guard && (this.stockpile.get('silver') || 0) < q.fee) return { ok: false, msg: t('銀幣不足，付不出護衛費') };
        this.stockpile.consume(res, amount, this.tickCount, `${t('押商隊去')}${t(opt.toTownName)}`);
        if (guard) {
            this.stockpile.consume('silver', q.fee, this.tickCount, t('護衛費'));
            this.events._sendAgentTravelling(this, guard, `${t('押商隊去')}${opt.toTownName}`, q.days);
        }
        pc.active = { id: 'pc' + Date.now(), toTownId: opt.toTownId, toTownName: opt.toTownName, toTheme: opt.toTheme, res, amount, guardId: guard?.agentId || null, guardName: guard?.name || '',
            route: opt.route === 'mountain' ? 'mountain' : 'road', departAbsDay: this._absDay(), returnAbsDay: this._absDay() + q.days, quote: q };
        const label = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[res]?.name) ? SHOP_ITEMS[res].name() : res;
        this.logMessage('trade', `🐪 ${t('你的商隊出發了：')}${amount} ${label} → ${t(opt.toTownName)}${guard ? `（${guard.name}${t('押車')}）` : ''}`);
        this.events?.conversationTopics?.push(`${t('旅人押了一隊商隊去')}${t(opt.toTownName)}`);
        try { this.requests?.onCaravanLaunch?.(this); } catch (e) {} // v5.97.0 委託:押商隊
        return { ok: true, msg: `${t('商隊出發，預計')} ${q.days} ${t('天後回報')}` };
    }
    _playerCaravanDaily() {
        const pc = this.playerCaravan; if (!pc) return;
        if (pc.pendingInjury) { const g = this.agents[pc.pendingInjury]; if (g) { g.moodModifier = (g.moodModifier || 0) - 15; if (g.needs) g.needs.rest = Math.max(0, (g.needs.rest || 50) - 30); g.memory?.add?.(this.tickCount, this.clock.timeStr, 'incident', t('押車時遇上馬賊，挨了一棍。'), 8, []); pc.pendingInjury = null; } }
        const a = pc.active; if (!a || this._absDay() < a.returnAbsDay) return;
        const q = a.quote || this.playerCaravanQuote(a.toTheme, a.res, a.amount, !!a.guardId, a.route);
        const raided = Math.random() < q.risk;
        const label = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[a.res]?.name) ? SHOP_ITEMS[a.res].name() : a.res;
        let silver = 0, lost = 0;
        if (raided) {
            const lostFrac = 0.6 + Math.random() * 0.4; lost = Math.round(a.amount * lostFrac);
            silver = Math.round((a.amount - lost) * (q.base / a.amount) * 1.2);
            if (a.guardId) pc.pendingInjury = a.guardId;
        } else silver = q.value;
        if (silver > 0) this.stockpile.add('silver', silver, this.tickCount, `${t('商隊回報')}：${t(a.toTownName)}`);
        const result = { ...a, raided, lost, silver, resolvedAbsDay: this._absDay() };
        this.growth?.addXp(raided ? 5 : 15, 'caravan', this); // v5.94.0 經驗
        pc.history = (pc.history || []).concat([result]).slice(-10); pc.active = null;
        pc.totals = pc.totals || { runs: 0, silver: 0, raids: 0 }; pc.totals.runs++; pc.totals.silver += silver; if (raided) pc.totals.raids++; // v5.98.0 季末回顧用的累計
        const line = raided
            ? `${t('你的商隊在去')}${t(a.toTownName)}${t('的路上遇劫，損失')} ${lost} ${label}${silver ? `${t('，剩下的賣了')} ${silver} ${t('銀幣')}` : ''}${a.guardName ? `${t('；')}${a.guardName}${t('受了傷')}` : ''}`
            : `${t('你的商隊從')}${t(a.toTownName)}${t('回來了：')}${a.amount} ${label} ${t('賣了')} ${silver} ${t('銀幣')}（+${Math.round(q.margin * 100)}%）`;
        this.logMessage('trade', `${raided ? '🏴' : '💰'} ${line}`);
        this.dailyNews?.collectEvent?.('economy', line, raided ? 9 : 7, a.guardName ? [a.guardName] : []);
        this.events?.conversationTopics?.push(raided ? t('旅人的商隊遇劫了') : t('旅人的商隊賺了一筆'));
        this.onPlayerCaravanReturn?.(result, line);
    }
    playerCaravanState() {
        const pc = this.playerCaravan; if (!pc) return null;
        const a = pc.active ? { ...pc.active, daysLeft: Math.max(0, pc.active.returnAbsDay - this._absDay()) } : null;
        return { active: a, history: (pc.history || []).slice(-5).reverse() };
    }

    _visitorDaily() {
        this.visitors = this.visitors || {};
        const today = this._absDay();
        // v5.90.0 搬家提案三天沒選就依兩人意願自動定案
        const pe = this.eventChoice?.pendingEvent;
        if (pe?.autoResolve && today >= pe.autoResolve.absDay) { try { this.eventChoice.resolveChoice(pe.autoResolve.choice, this); } catch (e) {} }
        // 1) 到期訪客返鄉,帶走在本鎮最重要的三則見聞
        for (const [aid, meta] of Object.entries(this.visitors)) {
            const ag = this.agents[aid];
            if (!ag) { delete this.visitors[aid]; continue; }
            if (today >= meta.expireAbsDay) {
                const notes = (ag.memory?.entries || []).filter(m => m.tick >= meta.arriveTick)
                    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3).map(m => m.content);
                const romance = this._visitorRomance(ag, meta); // v5.90.0 作客期間的戀情→回鄉後觸發搬家提案
                this.onVisitorReturn?.({ ...meta, notes, romance });
                this.logMessage('departure', `${ag.name}${t('搭上回程的車，返回')}${meta.fromTownName}${t('了。')}`);
                Object.values(this.agents).forEach(o => { if (o.agentId !== aid && !o.isPlayer) o.memory?.add?.(this.tickCount, this.clock.timeStr, 'departure', `${ag.name}${t('回家鄉去了，說好還會再來。')}`, 4, [ag.name]); });
                delete this.visitors[aid];
                delete this.agents[aid];
            }
        }
        // 2) 全自動出訪:有別的鎮就派人去作客(同時最多 2 人在外)
        if (!Array.isArray(this.otherTowns) || !this.otherTowns.length) return;
        const away = (this.events._travellingAgents || []).filter(tr => tr.visitTownId).length;
        if (away >= 2 || Math.random() > 0.25) return;
        const target = pickRandom(this.otherTowns);
        const cands = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead
            && a.job?.key !== 'mayor' && !a.agentId.startsWith('visit_') && (a.mood || 50) > 40);
        if (!cands.length) return;
        this.sendVisitorTo(pickRandom(cands), target, randInt(3, 5));
    }
    sendVisitorTo(agent, town, stayDays = 4) {
        if (!agent || agent.isPlayer || agent.agentId.startsWith('visit_') || !town?.id) return false;
        const data = { agentId: agent.agentId, name: agent.name, age: agent.age, jobKey: agent.job?.key,
            traits: agent.personality.traits, values: agent.personality.values, background: agent.personality.background,
            homeLocation: agent.homeLocation, gender: agent.gender, look: agent.look || null, // v5.89.0 外觀跟著出門
            skills: agent.skills.toDict(), relationships: agent.relationships.toDict(),
            memories: agent.memory.toDict(), mood: agent.mood, moodModifier: agent.moodModifier || 0 };
        this.onSendVisitor?.(data, town, stayDays);
        this.events._sendAgentTravelling(this, agent, `${t('去')}${town.name}${t('作客')}`, stayDays + 2);
        const tr = this.events._travellingAgents[this.events._travellingAgents.length - 1];
        if (tr) tr.visitTownId = town.id;
        return true;
    }
    // v5.90.0 村民快照(出訪/旅行/搬家共用一種格式)
    _agentSnapshot(agent) {
        return { agentId: agent.agentId, name: agent.name, age: agent.age, jobKey: agent.job?.key, nameEn: agent.nameEn || undefined,
            traits: agent.personality.traits, values: agent.personality.values, background: agent.personality.background,
            homeLocation: agent.homeLocation, gender: agent.gender, look: agent.look || null,
            skills: agent.skills.toDict(), relationships: agent.relationships.toDict(),
            memories: agent.memory.toDict(), mood: agent.mood, moodModifier: agent.moodModifier || 0 };
    }
    // v5.90.0 訪客到期時檢查:和本鎮某位居民兩情相悅(雙方心動 ≥60、好感 ≥50)且至少來作客過 2 次→回鄉後由對方鎮發「搬家提案」
    _visitorRomance(visitor, meta) {
        try {
            const key = `${meta.fromTownId}:${meta.origId}`;
            if (((this.visitCounts || {})[key] || 0) < 2) return null;
            let best = null;
            for (const loc of Object.values(this.agents)) {
                if (loc.isPlayer || loc.agentId === visitor.agentId || loc.agentId.startsWith('visit_') || loc.isDead) continue;
                const rv = visitor.relationships?.relationships?.[loc.agentId], rl = loc.relationships?.relationships?.[visitor.agentId];
                if (!rv || !rl) continue;
                if ((rv.romanticInterest || 0) < 60 || (rl.romanticInterest || 0) < 60 || (rv.affinity || 0) < 50 || (rl.affinity || 0) < 50) continue;
                const partner = Object.values(loc.relationships.relationships).find(r => r.status === 'married' || r.status === 'dating');
                if (partner) continue; // 有伴的不拆
                const score = rv.romanticInterest + rl.romanticInterest;
                if (!best || score > best.score) best = { score, loc, rv, rl };
            }
            if (!best) return null;
            const loc = best.loc;
            loc.memory?.add?.(this.tickCount, this.clock.timeStr, 'romance', `${visitor.name}${t('回鄉了，心裡空了一塊。')}`, 8, [visitor.name]);
            this.logMessage('romance', `💌 ${visitor.name}${t('與')}${loc.name}${t('在作客期間互生情愫，分別時依依不捨。')}`);
            return { localId: loc.agentId, localName: loc.name, localData: this._agentSnapshot(loc), townName: this.townName,
                visitorOrigId: meta.origId, visitorName: meta.origName, romance: Math.round(best.score / 2) };
        } catch (e) { return null; }
    }
    // v5.90.0 從快照建立常住居民(跨鎮搬來):新 id、與伴侶直接成為交往狀態
    spawnResident(d, opts = {}) {
        if (!d || !d.name) return null;
        const id = opts.newId || `mv_${opts.fromTownId || 'x'}_${d.agentId || Date.now()}`;
        if (this.agents[id]) return this.agents[id];
        if (Object.values(this.agents).filter(a => !a.isPlayer).length >= 30) return null; // 人口上限 30(v5.79.0)
        const personality = new Personality(d.traits || [], d.background || '', d.values || []);
        const job = d.jobKey ? new Job(d.jobKey) : null;
        const homes = ['residential_north', 'residential_south', 'residential_east'];
        const agent = new Agent(id, d.name, d.age || 30, personality, job, homes.includes(d.homeLocation) ? d.homeLocation : pickRandom(homes), d.gender);
        if (d.nameEn) { agent.nameEn = d.nameEn; if (typeof I18N !== 'undefined' && I18N.registerName) I18N.registerName(d.name, d.nameEn); }
        if (d.look && typeof d.look === 'object') agent.look = { ...d.look };
        agent.mood = Math.max(60, d.mood ?? 60);
        if (d.skills) for (const [sk, sv] of Object.entries(d.skills)) { const sl = agent.skills.get(sk); if (sl && sv) { sl.xp = sv.xp; sl.passion = sv.passion; } }
        if (Array.isArray(d.memories)) d.memories.slice(-40).forEach(m => agent.memory.add(m.tick, m.time, m.category, m.content ?? '', m.importance, m.related_agents || []));
        agent.movedFrom = opts.fromTownName || '';
        this.addAgent(agent);
        const partner = opts.partnerId ? this.agents[opts.partnerId] : null;
        if (partner) {
            const a = agent.relationships.getOrCreate(partner.agentId, partner.name), b = partner.relationships.getOrCreate(agent.agentId, agent.name);
            for (const r of [a, b]) { r.affinity = Math.max(r.affinity || 0, 70); r.romanticInterest = Math.max(r.romanticInterest || 0, 70); r.trust = Math.max(r.trust || 0, 50); r.status = 'dating'; r.statusSince = this.tickCount; r.interactionCount = Math.max(r.interactionCount || 0, 8); }
            partner.memory?.add?.(this.tickCount, this.clock.timeStr, 'romance', `${agent.name}${t('為了我從')}${opts.fromTownName || ''}${t('搬來了。')}`, 10, [agent.name]);
        }
        const line = `${agent.name}${t('從')}${opts.fromTownName || ''}${t('搬來定居')}${partner ? `${t('，和')}${partner.name}${t('在一起了')}` : ''}${t('。')}`;
        this.logMessage('arrival', `🏡 ${line}`);
        this.dailyNews?.collectEvent?.('relationship', line, 9, partner ? [agent.name, partner.name] : [agent.name]);
        this.events?.conversationTopics?.push(`${agent.name}${t('為了愛情搬來鎮上')}`);
        Object.values(this.agents).forEach(o => { if (o.agentId !== id && !o.isPlayer) o.memory?.add?.(this.tickCount, this.clock.timeStr, 'arrival', line, 5, [agent.name]); });
        return agent;
    }
    // v5.93.0 村民因為日子過不下去離開(季度考驗失敗):移除、記在 movedOut、全鎮記得
    leaveTown(agentId, reason = '') {
        const agent = this.agents[agentId];
        if (!agent || agent.isPlayer) return false;
        delete this.agents[agentId];
        this.movedOut = this.movedOut || [];
        this.movedOut.push({ id: agentId, name: agent.name, toTownName: t('外地'), partnerName: '', reason, absDay: this._absDay() });
        if (this.movedOut.length > 20) this.movedOut = this.movedOut.slice(-20);
        const line = `${agent.name}${t('收拾行李離開了鎮上')}${reason ? `（${reason}）` : ''}${t('。')}`;
        this.logMessage('departure', `🧳 ${line}`);
        Object.values(this.agents).forEach(o => { if (!o.isPlayer) o.memory?.add?.(this.tickCount, this.clock.timeStr, 'departure', line, 7, [agent.name]); });
        this.events?.conversationTopics?.push(`${agent.name}${t('離開鎮上了')}`);
        return true;
    }
    // v5.90.0 村民搬去別的鎮:留下快照、從本鎮移除、記在 movedOut(日報與聊天會提到)
    relocateOut(agentId, opts = {}) {
        const agent = this.agents[agentId];
        if (!agent || agent.isPlayer) return null;
        const snap = this._agentSnapshot(agent);
        delete this.agents[agentId];
        this.movedOut = this.movedOut || [];
        this.movedOut.push({ id: agentId, name: agent.name, toTownName: opts.toTownName || '', partnerName: opts.partnerName || '', absDay: this._absDay() });
        if (this.movedOut.length > 20) this.movedOut = this.movedOut.slice(-20);
        const line = `${agent.name}${t('為了')}${opts.partnerName || t('愛情')}${t('搬去')}${opts.toTownName || ''}${t('了。')}`;
        this.logMessage('departure', `🧳 ${line}`);
        this.dailyNews?.collectEvent?.('relationship', line, 9, [agent.name]);
        this.events?.conversationTopics?.push(`${agent.name}${t('搬去')}${opts.toTownName || ''}${t('了')}`);
        Object.values(this.agents).forEach(o => { if (!o.isPlayer) o.memory?.add?.(this.tickCount, this.clock.timeStr, 'departure', line, 6, [agent.name]); });
        return snap;
    }
    spawnVisitor(entry) {
        const d = entry?.agentData || {};
        if (!d.agentId || !d.name) return null;
        const vid = `visit_${entry.fromTownId}_${d.agentId}`;
        if (this.agents[vid]) return null;
        const personality = new Personality(d.traits || [], d.background || '', d.values || []);
        const agent = new Agent(vid, `${d.name}（${entry.fromTownName}）`, d.age || 30, personality, null, 'residential_north', d.gender);
        agent.mood = d.mood ?? 60;
        if (d.look && typeof d.look === 'object') agent.look = { ...d.look }; // v5.89.0
        if (Array.isArray(d.memories)) d.memories.forEach(m => agent.memory.add(m.tick, m.time, m.category, m.content ?? '', m.importance, m.related_agents || []));
        agent.currently = t('從') + entry.fromTownName + t('來作客的旅人');
        this.addAgent(agent);
        this.visitors = this.visitors || {};
        this.visitCounts = this.visitCounts || {}; this.visitCounts[`${entry.fromTownId}:${d.agentId}`] = (this.visitCounts[`${entry.fromTownId}:${d.agentId}`] || 0) + 1; // v5.90.0 來過幾次
        this.visitors[vid] = { fromTownId: entry.fromTownId, fromTownName: entry.fromTownName,
            origId: d.agentId, origName: d.name, arriveTick: this.tickCount,
            expireAbsDay: this._absDay() + (entry.stayDays || 4) };
        this.logMessage('arrival', `🚌 ${d.name}${t('（')}${entry.fromTownName}${t('）來到鎮上作客，會住上幾天。')}`);
        Object.values(this.agents).forEach(o => { if (o.agentId !== vid && !o.isPlayer) o.memory?.add?.(this.tickCount, this.clock.timeStr, 'arrival', `${entry.fromTownName}${t('來的')}${d.name}${t('到鎮上作客了，聽說那裡的事真新鮮。')}`, 5, [agent.name]); });
        this.events.conversationTopics.push(`${entry.fromTownName}${t('來的訪客')}${d.name}`);
        return agent;
    }

    recordPlayerAction(type, text, npc, target) {
        try {
            this.playerActions = this.playerActions || [];
            const entry = {
                tick: this.tickCount,
                dayKey: `${this.clock.year}-${this.clock.season}-${this.clock.day}`,
                type, text: String(text || '').slice(0, 60),
                npcId: npc?.agentId || null, npcName: npc?.name || '',
                targetId: target?.agentId || null, targetName: target?.name || '',
            };
            if (npc) {
                entry.aff0 = npc.relationships?.relationships?.['player']?.affinity ?? null;
                if (target) entry.tAff0 = npc.relationships?.relationships?.[target.agentId]?.affinity ?? null;
            }
            this.playerActions.push(entry);
            if (this.playerActions.length > 60) this.playerActions = this.playerActions.slice(-60);
        } catch (e) {}
    }

    // v5.45.0 昨日回響:把「你昨天的舉動 → 今天世界的變化」翻譯成看得懂的因果句(零成本規則式)
    _generateDailyEcho(ids) {
        const yKey = `${ids.year}-${ids.season}-${ids.day}`;
        const acts = (this.playerActions || []).filter(a => a.dayKey === yKey);
        const lines = [];
        const usedNpc = new Set();
        const typeLabel = { whisper: t('耳語'), comfort: t('安慰'), flirt: t('示好'), threaten: t('威脅'), mediate: t('調解'), persuade: t('說服'), gossip: t('打聽'), request: t('委託'), gift: t('送禮') };
        const playerName = this.agents['player']?.name || '';
        for (const a of acts) {
            if (lines.length >= 3) break;
            const npc = a.npcId ? this.agents[a.npcId] : null;
            if (!npc || npc.isDead || usedNpc.has(npc.agentId)) continue;
            // 耳語:念頭有沒有發酵(對第三者的態度位移 / 行程被改)
            if (a.type === 'whisper' && a.targetId != null && a.tAff0 != null) {
                const cur = npc.relationships?.relationships?.[a.targetId]?.affinity;
                if (cur != null && Math.abs(cur - a.tAff0) >= 3) {
                    lines.push(`${t('你種在')}${a.npcName}${t('心裡的念頭發酵了——他對')}${a.targetName}${t('的態度')}${cur > a.tAff0 ? t('明顯軟化') : t('更差了')}`);
                    usedNpc.add(npc.agentId); continue;
                }
            }
            // 一般行動:對你的好感有沒有「後續」位移(行動當下的加成已含在快照裡)
            if (a.aff0 != null) {
                const cur = npc.relationships?.relationships?.['player']?.affinity;
                if (cur != null && cur - a.aff0 >= 4) { lines.push(`${t('昨天對')}${a.npcName}${t('的')}${typeLabel[a.type] || a.type}${t('留下了好印象——他對你更親近了')}`); usedNpc.add(npc.agentId); continue; }
                if (cur != null && cur - a.aff0 <= -4) { lines.push(`${t('昨天對')}${a.npcName}${t('的')}${typeLabel[a.type] || a.type}${t('起了反效果——他對你起了戒心')}`); usedNpc.add(npc.agentId); continue; }
            }
            // 你出現在他的心事/計畫裡:昨天互動過的村民,今天想起了你
            const mem = (npc.memory?.entries || []).slice(-8).find(m => m.tick > a.tick && (m.relatedAgents || []).includes(playerName) && (m.category === 'reflection' || m.category === 'plan'));
            if (mem) { lines.push(`${a.npcName}${t('把你放在心上了：「')}${String(mem.content).slice(0, 42)}${t('」')}`); usedNpc.add(npc.agentId); }
        }
        this.dailyEcho = lines.slice(0, 3);
    }

    // v5.43.0 小鎮編年史:把一天的作息/行程/足跡/對話打包成可歸檔的紀錄(UI 存進 IndexedDB,可匯出調閱)
    _buildDayArchive(ids) {
        const dayTag = `${ids.year}-${ids.season}-${ids.day}`;
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead).map(a => ({
            id: a.agentId, name: a.name, job: a.job?.title || '',
            currently: a.currently || '',
            lifestyle: a.getLifestyleText ? a.getLifestyleText() : '',
            plan: a.dailyPlan ? [...(a.dailyPlan.goals || [])] : [],
            planLlm: !!a.dailyPlan?.llm,
            replanned: !!a.dailyPlan?.replanned,
            trace: (a.todayTrace || []).map(e => ({ m: e.m, text: e.text, loc: e.loc })),
        }));
        const convos = (this.conversationEngine?.npcConversationLog || [])
            .filter(c => c.dayTag === dayTag)
            .map(c => ({ time: c.time, a: c.agentA, b: c.agentB, llm: !!c.llm, summary: c.summary || '', dialogue: (c.dialogue || []).map(d => `${d.speaker}: ${d.text}`) }));
        // 玩家對話:自上次歸檔以來的增量
        const player = this.agents['player'];
        const idx = this._chronicleChatIdx || 0;
        const playerChats = (player?.chatHistory || []).slice(idx).map(m => ({ time: m.time, speaker: m.speaker, target: m.target, text: m.text }));
        this._chronicleChatIdx = player?.chatHistory?.length || 0;
        return { year: ids.year, season: ids.season, day: ids.day, npcs, convos, playerChats, savedAt: Date.now() };
    }

    // v5.42.0 衝突敘事:把村民間的敵意做成有戲劇張力的事件鏈
    // (a) 積怨爆發:雙方好感都 <= -60 → 正式「絕交」名場面(isFeud 標記,等玩家來當和事佬)
    // (b) 廣場對嗆:互相仇視(<= -35)的兩人偶爾當眾大吵,交情好的旁觀者會選邊站
    _processFeuds() {
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead);
        this._feudCooldown = this._feudCooldown || {};
        const day = this.clock.day + (this.clock.year - 1) * 60;
        const seen = new Set();
        for (const a of npcs) {
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                const b = this.agents[tid];
                if (!b || b.isPlayer || b.isDead) continue;
                const key = [a.agentId, tid].sort().join('|');
                if (seen.has(key)) continue;
                seen.add(key);
                const relB = b.relationships.relationships[a.agentId];
                if (!relB) continue;
                // (a) 絕交
                if (rel.affinity <= -60 && relB.affinity <= -60 && !rel.isFeud) {
                    rel.isFeud = true; relB.isFeud = true;
                    this._feudCooldown[key] = day;
                    a.moodModifier = (a.moodModifier || 0) - 10;
                    b.moodModifier = (b.moodModifier || 0) - 10;
                    a.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${b.name}${t('徹底鬧翻,絕交了。這口氣嚥不下去。')}`, 9, [b.name]);
                    b.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${a.name}${t('徹底鬧翻,絕交了。這口氣嚥不下去。')}`, 9, [a.name]);
                    this.logMessage('event', `💢 ${a.name}${t('和')}${b.name}${t('積怨徹底爆發,當眾撂下重話,正式絕交!')}`);
                    this.dailyNews?.collectEvent('social', `${a.name}${t('與')}${b.name}${t('公開絕交,兩人再不相往來')}`, 8, [a.name, b.name]);
                    this.queueDramaScene('severance', a, b);
                    continue;
                }
                // (b) 廣場對嗆(每對至少隔 5 天)
                if (rel.affinity <= -35 && relB.affinity <= -35
                    && (day - (this._feudCooldown[key] || -99)) >= 5 && Math.random() < 0.15) {
                    this._feudCooldown[key] = day;
                    rel.modifyAffinity(-4); relB.modifyAffinity(-4);
                    a.moodModifier = (a.moodModifier || 0) - 6;
                    b.moodModifier = (b.moodModifier || 0) - 6;
                    this.logMessage('event', `🗯️ ${a.name}${t('和')}${b.name}${t('在眾目睽睽下大吵一架,火藥味十足!')}`);
                    this.dailyNews?.collectEvent('social', `${a.name}${t('與')}${b.name}${t('當眾對嗆,鎮上議論紛紛')}`, 7, [a.name, b.name]);
                    // 圍觀選邊站:交情好的替朋友抱不平,對另一方觀感變差
                    for (const w of npcs) {
                        if (w === a || w === b) continue;
                        const wa = w.relationships.relationships[a.agentId]?.affinity || 0;
                        const wb = w.relationships.relationships[b.agentId]?.affinity || 0;
                        if (wa >= 40 && wb < 40) {
                            w.relationships.getOrCreate(b.agentId, b.name).modifyAffinity(-3);
                            w.memory.add(this.tickCount, this.clock.timeStr, 'observation', `${t('目睹')}${a.name}${t('和')}${b.name}${t('當眾大吵——我當然站')}${a.name}${t('這邊。')}`, 4, [a.name, b.name]);
                        } else if (wb >= 40 && wa < 40) {
                            w.relationships.getOrCreate(a.agentId, a.name).modifyAffinity(-3);
                            w.memory.add(this.tickCount, this.clock.timeStr, 'observation', `${t('目睹')}${a.name}${t('和')}${b.name}${t('當眾大吵——我當然站')}${b.name}${t('這邊。')}`, 4, [a.name, b.name]);
                        } else if ((wa || wb) && Math.random() < 0.3) {
                            w.memory.add(this.tickCount, this.clock.timeStr, 'observation', `${t('看到')}${a.name}${t('和')}${b.name}${t('當眾大吵,小鎮的氣氛有點僵。')}`, 3, [a.name, b.name]);
                        }
                    }
                    this.queueDramaScene('feud', a, b);
                }
            }
        }
    }

    // v5.49.0 戲劇導演(張力保底):湧現式模擬偶爾會風平浪靜好幾天——
    // 連續 4 天沒有名場面時,從三種手法挑一種在後台「輕推」,像編劇埋伏筆,而不是硬寫死劇本:
    // a) 暗戀萌芽:合得來的單身村民之間種下心動  b) 舊怨復發:交惡的兩人再往絕交推一步  c) 嫉妒:單戀有主之人者情緒升溫
    _dramaDirector() {
        const absDay = this.clock.day + (this.clock.year - 1) * 60;
        // 距上一場名場面幾天
        const lastScene = (this.dramaArchive || []).slice(-1)[0];
        const lastSceneDay = lastScene ? (lastScene.day + ((lastScene.year || 1) - 1) * 60) : (this._townFoundedDay || 0);
        if (absDay - lastSceneDay < 4) return;
        if (absDay - (this._directorLastDay || -99) < 3) return; // 導演出手後至少醞釀 3 天
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead);
        if (npcs.length < 4) return;
        const strategies = shuffle(['crush', 'grudge', 'jealousy']);
        for (const strat of strategies) {
            if (strat === 'crush') {
                // 找一對單身、互有基本好感、還沒心動的
                const singles = npcs.filter(a => !a.relationships.getPartner());
                for (const a of shuffle(singles)) {
                    const cand = Object.values(a.relationships.relationships).find(r => {
                        const b = this.agents[r.targetId];
                        return b && !b.isPlayer && !b.isDead && !b.relationships.getPartner()
                            && r.affinity >= 20 && (r.romanticInterest || 0) < 20 && !r.status;
                    });
                    if (cand) {
                        cand.modifyRomantic(12 + randInt(0, 5));
                        a.memory.add(this.tickCount, this.clock.timeStr, 'reflection', `${t('奇怪...最近看')}${cand.targetName}${t('的眼神,好像跟以前不一樣了。')}`, 7, [cand.targetName]);
                        this._directorLastDay = absDay;
                        return;
                    }
                }
            } else if (strat === 'grudge') {
                // 交惡但還沒仇視的兩人,舊帳重翻
                for (const a of shuffle(npcs)) {
                    const foe = Object.values(a.relationships.relationships).find(r => {
                        const b = this.agents[r.targetId];
                        return b && !b.isPlayer && !b.isDead && r.affinity <= -18 && r.affinity > -34 && !r.isFeud;
                    });
                    if (foe) {
                        const b = this.agents[foe.targetId];
                        foe.modifyAffinity(-(6 + randInt(0, 4)));
                        b.relationships.getOrCreate(a.agentId, a.name).modifyAffinity(-(6 + randInt(0, 4)));
                        a.memory.add(this.tickCount, this.clock.timeStr, 'reflection', `${t('本來想算了,但一想到')}${foe.targetName}${t('那件事,火又上來了。')}`, 7, [foe.targetName]);
                        b.memory.add(this.tickCount, this.clock.timeStr, 'reflection', `${t('聽說')}${a.name}${t('又在背後提那件事...是不打算善了了?')}`, 7, [a.name]);
                        this._directorLastDay = absDay;
                        return;
                    }
                }
            } else {
                // 嫉妒:單戀有主之人者,情緒升溫(對情敵觀感變差)
                for (const c of shuffle(npcs)) {
                    const crush = c.relationships.getRomanticInterests().find(r => !r.status && (r.romanticInterest || 0) >= 25);
                    if (!crush) continue;
                    const b = this.agents[crush.targetId];
                    const partner = b && !b.isDead ? b.relationships.getPartner?.() : null;
                    if (!partner) continue;
                    const rival = this.agents[partner.targetId];
                    if (!rival || rival.isDead || rival.isPlayer) continue;
                    crush.modifyRomantic(8);
                    c.relationships.getOrCreate(rival.agentId, rival.name).modifyAffinity(-(5 + randInt(0, 4)));
                    c.memory.add(this.tickCount, this.clock.timeStr, 'reflection', `${t('看到')}${b.name}${t('和')}${rival.name}${t('走在一起,心口悶得發疼。憑什麼是他。')}`, 8, [b.name, rival.name]);
                    this._directorLastDay = absDay;
                    return;
                }
            }
        }
    }

    // v5.34.0 逾時代選:pending 的互動選擇滿一個遊戲日(96 ticks)沒人處理就隨機結算
    _autoResolveStaleChoices() {
        const DAY = 96;
        const pickLog = (what, label) => this.logMessage('event_choice', `⏳ ${t('你遲遲沒有決定,小鎮自行處理了「')}${what}${t('」:')}${label}`);
        try {
            const ev = this.eventChoice?.pendingEvent;
            if (ev && this.tickCount - (ev.timestamp || 0) >= DAY) {
                const i = randInt(0, ev.choices.length - 1);
                const label = ev.choices[i]?.label || '';
                this.eventChoice.resolveChoice(i, this);
                pickLog(ev.eventName, label);
            }
        } catch (e) {}
        try {
            const dd = this.dailyDecision?.pendingDecision;
            const todayKey = `${this.clock.year}-${this.clock.season}-${this.clock.day}`;
            if (dd && dd.dayKey !== todayKey) {
                const c = Math.random() < 0.5 ? 'A' : 'B';
                const label = (c === 'A' ? dd.optionA : dd.optionB)?.label || '';
                this.dailyDecision.resolveDecision(c, this);
                pickLog(dd.title, label);
            }
        } catch (e) {}
        try {
            const hq = this.npcHelp?.pendingRequest;
            if (hq && hq.tick != null && this.tickCount - hq.tick >= DAY) {
                const c = Math.random() < 0.5 ? 'A' : 'B';
                const label = (c === 'A' ? hq.optionA : hq.optionB)?.label || '';
                this.npcHelp.resolveRequest(c, this);
                pickLog(`${hq.npcName}${t('的請求')}`, label);
            }
        } catch (e) {}
    }

    // v5.31.0 今日焦點:每天從小鎮當前狀態挑 2-3 個「有理由的具體行動」
    // 每項 { icon, text, reason, npcId?|tab? } — npcId 點了開資訊卡,tab 點了跳分頁
    generateDailyFocus() {
        const items = [];
        const player = this.agents['player'];
        const npcOf = (name) => Object.values(this.agents).find(a => !a.isPlayer && !a.isDead && a.name === name);
        // 1) 有人在等你的回應(最高優先)
        if (this.npcHelp?.pendingRequest) {
            const req = this.npcHelp.pendingRequest;
            items.push({ icon: '🙏', text: `${req.npcName || t('有村民')}${t('正在等你幫忙')}`, reason: t('回應會直接影響他對你的信任'), npcId: req.npcId || null, tab: req.npcId ? null : 'events' });
        }
        if (this.eventChoice?.pendingEvent) {
            items.push({ icon: '⚠️', text: `${t('「')}${this.eventChoice.pendingEvent.name || t('重大事件')}${t('」需要你決定怎麼應對')}`, reason: t('放著不管會自動發展,後果未必是你要的'), tab: 'events' });
        }
        if (this.dailyDecision?.pendingDecision && items.length < 2) {
            items.push({ icon: '🗂️', text: t('有村民來找你商量一件事'), reason: t('今天的選擇會留下長期影響'), tab: 'events' });
        }
        // 2) 選舉期(v5.38.0 玩家可以親自參選)
        if (this.election?.phase === 'campaign') {
            const isCand = this.election.candidates?.some(c => c.agentId === 'player');
            if (isCand) {
                items.push({ icon: '👑', text: t('你正在競選鎮長!去找村民聊天,用「說服」為自己拉票'), reason: `${t('競選只剩')} ${this.election.campaignDaysLeft} ${t('天,每位村民只能拉一次票')}`, tab: 'events' });
            } else if (this.election.playerEligibility?.(this)?.ok) {
                items.push({ icon: '🗳️', text: t('選舉開跑了!你已符合參選資格——要不要自己出馬選鎮長?'), reason: t('到「事件」分頁登記參選,錯過要再等一年'), tab: 'events' });
            } else {
                items.push({ icon: '🗳️', text: t('選舉開跑了!去跟村民聊聊,用「說服」幫你支持的人拉票'), reason: `${t('競選只剩')} ${this.election.campaignDaysLeft} ${t('天')}`, tab: 'events' });
            }
        } else if (this.election?.phase === 'voting') {
            const isCand = this.election.candidates?.some(c => c.agentId === 'player');
            items.push({ icon: '🗳️', text: isCand ? t('投票進行中!你也在選票上——把握最後機會拉票') : t('投票中!去投下你的一票'), reason: t('你的一票可能改變小鎮未來的政策'), tab: 'events' });
        }
        // 3) 昨天的劇情餘波:名場面當事人值得關心
        const arc = (this.dramaArchive || []).slice(-1)[0];
        if (arc && items.length < 3) {
            const sameYear = arc.year === this.clock.year && arc.season === this.clock.season;
            const dayDiff = sameYear ? this.clock.day - arc.day : 99;
            if (dayDiff >= 0 && dayDiff <= 1) {
                const who = npcOf(arc.aName) || npcOf(arc.bName);
                if (who) items.push({ icon: '🎭', text: `${arc.aName}${t('和')}${arc.bName}${t('之間剛發生大事(')}${arc.title}${t('),去關心一下')}${who.name}`, reason: t('這時候的陪伴最能改變關係'), npcId: who.agentId });
            }
        }
        // 4) 祭典
        const fest = this.festivals?.activeFestival;
        if (fest && items.length < 3) {
            items.push({ icon: fest.icon || '🎪', text: `${t('今天有')}${fest.name}${t('!去會場逛逛、玩攤位')}`, reason: t('祭典期間村民好感更容易提升'), tab: 'events' });
        }
        // 4.5) v5.42.0 和解線:鎮上有人絕交了,你可以當和事佬
        if (player && items.length < 3) {
            let feudPair = null;
            for (const a of Object.values(this.agents)) {
                if (a.isPlayer || a.isDead || feudPair) break;
                for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                    if (!rel.isFeud) continue;
                    const b = this.agents[tid];
                    if (!b || b.isDead) continue;
                    feudPair = { a, b };
                    break;
                }
            }
            if (feudPair) {
                const done = this.mediations?.[[feudPair.a.agentId, feudPair.b.agentId].sort().join('|')]?.sides || {};
                const doneCount = Object.keys(done).length;
                items.push({
                    icon: '🕊️',
                    text: doneCount === 1
                        ? `${t('和解只差一步!再去用「調解」勸勸')}${done[feudPair.a.agentId] ? feudPair.b.name : feudPair.a.name}`
                        : `${feudPair.a.name}${t('和')}${feudPair.b.name}${t('鬧到絕交了——分別找兩人用「調解」勸和')}`,
                    reason: t('促成世紀大和解:兩人好感大增、聲望 +15、成就「和事佬」'),
                    npcId: doneCount === 1 ? (done[feudPair.a.agentId] ? feudPair.b.agentId : feudPair.a.agentId) : feudPair.a.agentId,
                });
            }
        }
        // 5) 好感度接近心動門檻的村民:再推一把
        if (player && items.length < 3) {
            const thresholds = [25, 55, 80];
            let best = null;
            for (const a of Object.values(this.agents)) {
                if (a.isPlayer || a.isDead) continue;
                const aff = a.relationships.relationships['player']?.affinity || 0;
                for (const th of thresholds) {
                    if (aff >= th - 6 && aff < th) {
                        if (!best || aff > best.aff) best = { a, aff, th };
                    }
                }
            }
            if (best) items.push({ icon: '💗', text: `${t('和')}${best.a.name}${t('的關係就差一點點了,去聊聊天或送個小禮物')}`, reason: t('關係更近時,他會對你說出真心話'), npcId: best.a.agentId });
        }
        // 6) 保底:找最好的朋友敘舊
        if (player && !items.length) {
            const bf = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead)
                .sort((x, y) => (y.relationships.relationships['player']?.affinity || 0) - (x.relationships.relationships['player']?.affinity || 0))[0];
            if (bf) items.push({ icon: '💬', text: `${t('今天挺平靜的,去找')}${bf.name}${t('聊聊天吧')}`, reason: t('常聊天他會記得你、跟你越來越熟'), npcId: bf.agentId });
        }
        this.dailyFocus = { key: `${this.clock.year}-${this.clock.season}-${this.clock.day}`, items: items.slice(0, 3) };
        return this.dailyFocus;
    }

    getState() {
        return {
            clock: this.clock.toDict(), tick: this.tickCount, paused: this.paused,
            agents: Object.fromEntries(Object.entries(this.agents).map(([id,a]) => [id, a.toDict()])),
            locations: this.townMap?.toDict() || {},
            recent_events: this.events.getRecentEvents().map(([t,e]) => ({time:t, name:e.name, description:e.description, severity:e.severity, event_type:e.event_type})),
            recent_messages: this.messageLog.slice(-500), // v5.99.0 紀錄分頁只畫最近 500 條
            travelling_agents: this.events.getTravellingAgents(),
            active_chains: this.events.getActiveChains(),
            stockpile: this.stockpile.toDict(),
            buildings: this.buildings.toDict(),
            trade: this.trade.toDict(),
            research: this.research.toDict(),
            work_orders: this.workOrders.toDict(),
            news: this.news.toDict(),
            npc_conversations: this.conversationEngine.npcConversationLog.slice(-250), // v5.99.0 介面只顯示最近的(成就 gossip_200 仍可達)
            election: this.election.toDict(),
            factions: this.factions.toDict(),
            festivals: this.festivals.toDict(),
            lifecycle: this.lifecycle.toDict(),
            exploration: this.exploration.toDict(),
            industry: this.industry.toDict(),
            farm: this.farm.toDict(),
            processing: this.processing.toDict(),
            dailyNews: this.dailyNews.toDict(),
            townIdentity: this.townIdentity.toDict(),
            dramaArchive: (this.dramaArchive || []).slice(-40),
            npcEvents: this.npcEvents.toDict(),
            questSystem: this.questSystem ? this.questSystem.toDict() : null,
            requests: this.requests ? this.requests.toDict(this) : null, // v5.91.0
            playerCaravan: this.playerCaravanState(), // v5.92.0
            trials: this.trials ? this.trials.toDict(this) : null, // v5.93.0
            growth: this.growth ? this.growth.toDict(this) : null, // v5.94.0
            recap: this.recap ? this.recap.toDict(this) : null, // v5.98.0
            prosperity: this.prosperity ? this.prosperity.toDict() : null,
            npcQuests: this.npcQuests ? this.npcQuests.toDict() : null,
            customNPC: this.customNPC ? this.customNPC.toDict() : null,
            multiEnding: this.multiEnding ? this.multiEnding.toDict() : null,
            // v4.0
            dailyDecision: this.dailyDecision.toDict(),
            shop: this.shop.toDict(),
            eventChoice: this.eventChoice.toDict(),
            npcHelp: this.npcHelp.toDict(),
            reputationSystem: this.reputationSystem.toDict(),
            weather: this.weather.toDict(),
            council: (() => { const cd = this.council.toDict(); cd.memberNames = this.council.members.map(id => this.agents[id]?.name || '?'); return cd; })(),
            lifeGoals: (() => { const m = {}; if (this.lifeGoals) for (const a of Object.values(this.agents)) { if (a.isPlayer) continue; const d = this.lifeGoals.describe(a.agentId); if (d) m[a.agentId] = d; } return m; })(),
        };
    }
    reset(seed = null) {
        this.clock.reset(); this.events = new EventSystem(); this.election = new ElectionSystem();
        this.agents = {}; this.tickCount = 0; this.paused = false; this.messageLog = [];
        this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
        this.stockpile = new Stockpile();
        this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
        this.trade = new TradeManager();
        this.research = new ResearchManager();
        this.workOrders = new WorkOrderManager();
        this.news = new NewsSystem();
        this.factions = new FactionSystem();
        this.festivals = new FestivalSystem();
        this.lifecycle = new LifecycleSystem();
        this.exploration = new ExplorationSystem();
        this.industry = new IndustryManager();
        this.farm = new FarmSystem();
        this.processing = new ProcessingSystem();
        this.dailyNews = new DailyNewsEngine();
        this.requests = (typeof RequestBoard !== 'undefined') ? new RequestBoard() : null; // v5.91.0 委託板
        this.playerCaravan = { active: null, history: [], pendingInjury: null }; // v5.92.0 押商隊
        this.trials = (typeof SeasonTrials !== 'undefined') ? new SeasonTrials() : null; // v5.93.0 季度考驗
        this.growth = (typeof TravellerGrowth !== 'undefined') ? new TravellerGrowth() : null; // v5.94.0 旅人成長
        this.recap = (typeof SeasonRecap !== 'undefined') ? new SeasonRecap() : null; // v5.98.0 季末回顧
        this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
        this.npcEvents = new NPCEventSystem();
        this.questSystem = typeof QuestSystem !== 'undefined' ? new QuestSystem() : null;
        this.prosperity = typeof ProsperityEngine !== 'undefined' ? new ProsperityEngine() : null;
        this.npcQuests = typeof NPCQuestSystem !== 'undefined' ? new NPCQuestSystem() : null;
        this.lifeGoals = new LifeGoalSystem(); // v5.4.0 人生故事線
        this.customNPC = typeof CustomNPCSystem !== 'undefined' ? new CustomNPCSystem() : null;
        this.multiEnding = typeof MultiEndingSystem !== 'undefined' ? new MultiEndingSystem() : null;
        // v4.0 systems
        this.dailyDecision = new DailyDecisionSystem();
        this.shop = new ShopSystem();
        this.eventChoice = new EventChoiceSystem();
        this.npcHelp = new NPCHelpSystem();
        this.reputationSystem = new ReputationSystem();
        this.weather = new WeatherSystem();
        this.council = new CouncilSystem();
        this.conversationEngine = new ConversationEngine(this.conversationEngine?.llm);
        // v5.58.0 清掉上一個世界的敘事殘留:換鎮後「今日焦點還在講陳偉」這類跨鎮鬼影的根源
        this.dailyFocus = null;
        this.dailyEcho = [];
        this.playerActions = [];
        this.dramaArchive = [];
        this.mediations = {};
        this._feudCooldown = {};
        this.workPolicy = {};
        this.visitors = {};
        this.npcLlmUsedToday = 0;
        // v5.55.0 主題城鎮:地圖/物資/名冊都跟著主題走
        this.townTheme = this.townTheme || 'frontier';
        const theme = TOWN_THEMES[this.townTheme] || TOWN_THEMES.frontier;
        // v5.58.0 鎮名跟著世界走(序列化保存),UI 標題不再永遠寫死邊境鎮
        this.townName = this.townName || theme.townName || '邊境鎮';
        this.townMap = generateRandomTown(seed, this.townTheme);
        if (theme.stockpile) Object.assign(this.stockpile.resources, theme.stockpile);
        // v5.27.0 肉鴿:隨機開局模式(rosterMode='random')抽全新村民,否則用劇本卡司
        if (this.questSystem) this.questSystem.theme = this.townTheme || 'frontier'; // v5.83.0
        if (this.townTheme === 'harbor') this._loadHarborResidents();
        else if (this.townTheme === 'mountain') this._loadMountainResidents(); // v5.76.0
        else if (this.townTheme === 'forest') this._loadForestResidents(); // v5.77.0
        else if (this.townTheme === 'market') this._loadMarketResidents(); // v5.78.0
        else if (this.rosterMode === 'random') this._loadRandomResidents(15);
        else this._loadDefaultResidents();
        const player = new PlayerAgent();
        this.addAgent(player);
    }
    startNewGamePlus() {
        // Collect legacy from current world state
        const legacy = LegacySystem.collectLegacy(this);
        // Reset the world
        this.reset();
        // Apply legacy data to the fresh world
        LegacySystem.applyLegacy(this, legacy);
        return legacy;
    }
    _processRelationships() {
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer);
        for (const agent of npcs) {
            for (const rel of Object.values(agent.relationships.relationships)) {
                const other = this.agents[rel.targetId];
                if (!other || other.isPlayer) continue;
                // Only process each pair once (avoid duplicate events)
                if (agent.agentId > rel.targetId) continue;
                const otherRel = other.relationships.getOrCreate(agent.agentId, agent.name);

                // --- Relationship decay: affinity drifts toward 0 without interaction ---
                const ticksSinceLast = this.tickCount - (rel.lastInteractionTick || 0);
                if (ticksSinceLast > 50) {
                    // Married/dating couples decay slower
                    const isCouple = rel.status === 'married' || rel.status === 'dating';
                    const decayRate = isCouple ? 0.3 : 0.8;
                    if (rel.affinity > 5) { rel.modifyAffinity(-decayRate); otherRel.modifyAffinity(-decayRate); }
                    // v5.3.0: 心動只在感情疏遠(好感低於30)時才衰退。親密的人會持續累積心動,
                    // 這是原本戀愛談不成的根因——心動被固定衰退壓在門檻下
                    if (rel.romanticInterest > 5 && !isCouple && rel.affinity < 30) { rel.modifyRomantic(-0.5); otherRel.modifyRomantic(-0.5); }
                }

                // --- Natural romantic attraction growth (v5.3.0 大幅加速) ---
                // 只要有基本好感與幾次互動,相配的人就會慢慢心動
                if (!rel.status && rel.affinity > 20 && rel.interactionCount > 3) {
                    const tA = agent.personality.traits;
                    const tB = other.personality.traits;
                    let compat = 1; // v5.3.0 基礎相容度 1(讓一般人也有機會),而非 0
                    if (tA.includes('romantic') || tB.includes('romantic')) compat += 2;
                    if (tA.includes('romantic') && tB.includes('romantic')) compat += 1;
                    if (tA.includes('shy') && tB.includes('kind')) compat += 1;
                    if (tA.includes('kind') && tB.includes('shy')) compat += 1;
                    if (tA.includes('charismatic') || tB.includes('charismatic')) compat += 1;
                    if (tA.includes('creative') && tB.includes('creative')) compat += 1;
                    if (tA.includes('optimist') && tB.includes('optimist')) compat += 1;
                    if (tA.includes('abrasive') && tB.includes('abrasive')) compat -= 2;
                    if (tA.includes('jealous') || tB.includes('jealous')) compat -= 1;
                    const affinityBonus = Math.floor(rel.affinity / 20); // v5.3.0 每20好感 +1(原25)
                    const charmBonus = Math.floor((other.attr('charm') - 5) / 2); // v5.26.0 對方越有魅力越讓人心動
                    const growth = Math.max(0, affinityBonus + compat + charmBonus);
                    // v5.3.0: 機率 0.45(原0.25)、增量最高 5(原3),讓心動能追過衰退、跨過門檻
                    if (growth > 0 && Math.random() < 0.45) {
                        rel.modifyRomantic(randInt(1, Math.min(growth + 1, 5)));
                    }
                    // v5.3.0 來電火花:高好感+高相容,偶爾一次大跳躍(命中注定的感覺)
                    if (rel.affinity > 45 && compat >= 3 && rel.romanticInterest > 15 && Math.random() < 0.06) {
                        const spark = randInt(8, 16);
                        rel.modifyRomantic(spark);
                        this.logMessage('relationship', `💓 ${agent.name}${t('對')}${other.name}${t('的心動,好像悄悄加深了...')}`, agent.name, other.name);
                        if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'crush', agent, other);
                    }
                    // v5.3.0 日久生情的回應:agent 對 other 明顯有意,若 other 對 agent 也親近且沒別的對象,
                    // other 有機會回應這份心動——這是讓「單戀」有機會變「兩情相悅」的關鍵
                    if (rel.romanticInterest > 40 && otherRel.affinity > 30 && !otherRel.status &&
                        otherRel.romanticInterest < rel.romanticInterest) {
                        const otherPartner = other.relationships.getPartner();
                        const otherCrush = Object.values(other.relationships.relationships).find(r => r.romanticInterest > 55 && r.targetId !== agent.agentId);
                        if (!otherPartner && !otherCrush && Math.random() < 0.3) {
                            otherRel.modifyRomantic(randInt(2, 5));
                        }
                    }
                }

                // --- v5.3.0 單戀受挫 & 情敵嫉妒 ---
                // agent 深深暗戀 other,但 other 已經名花有主 → agent 心碎,並嫉妒那個「幸運兒」
                if (!rel.status && rel.romanticInterest > 45) {
                    const otherPartner = other.relationships.getPartner();
                    if (otherPartner && otherPartner.targetId !== agent.agentId) {
                        const luckyOne = this.agents[otherPartner.targetId];
                        if (luckyOne && !luckyOne.isPlayer && Math.random() < 0.13) { // v5.22.0 加溫:單戀嫉妒更常燒起來
                            const jealousRel = agent.relationships.getOrCreate(luckyOne.agentId, luckyOne.name);
                            // 心動越深恨越重;已經在恨了就繼續往下探(讓三角戀燒成真正的仇敵)
                            const bite = jealousRel.affinity < 0 ? randInt(8, 16) : randInt(6, 12);
                            jealousRel.modifyAffinity(-bite);
                            agent.addThought('jealous', this, luckyOne.agentId, luckyOne.name); // v5.15.0 嫉妒的煎熬
                            agent.moodModifier = (agent.moodModifier || 0) - 6;
                            rel.modifyRomantic(-randInt(2, 5)); // 慢慢死心
                            this.logMessage('relationship', `💔 ${agent.name}${t('看著')}${other.name}${t('和')}${luckyOne.name}${t(',心裡很不是滋味...')}`, agent.name, luckyOne.name);
                            if (this.gossipNetwork && Math.random() < 0.4) this.gossipNetwork.createRelGossip(this, 'jealous', agent, luckyOne, other.name);
                        }
                    } else {
                        // other 還單身,但另有他人也強烈喜歡 other → 情敵!agent 對情敵生恨
                        for (const rival of npcs) {
                            if (rival === agent || rival === other || rival.isPlayer) continue;
                            const rivalCrush = rival.relationships.relationships[other.agentId];
                            if (rivalCrush && rivalCrush.romanticInterest > 40 && Math.random() < 0.20) { // v5.22.0 加溫:情敵更容易結樑子
                                const feud = agent.relationships.getOrCreate(rival.agentId, rival.name);
                                const feudBack = rival.relationships.getOrCreate(agent.agentId, agent.name);
                                // 情敵之恨蓋過友情:已在敵對就繼續探底,直到真正水火不容
                                const bite = feud.affinity < -10 ? randInt(10, 20) : randInt(8, 15);
                                feud.modifyAffinity(-bite); feudBack.modifyAffinity(-bite);
                                feud.modifyTrust(-5); feudBack.modifyTrust(-5);
                                if (!feud._rivalGossiped && feud.affinity <= -25) {
                                    feud._rivalGossiped = true;
                                    agent.addThought('rival_formed', this, rival.agentId, rival.name); // v5.15.0 結了樑子
                                    rival.addThought('rival_formed', this, agent.agentId, agent.name);
                                    this.logMessage('relationship', `⚡ ${agent.name}${t('和')}${rival.name}${t('為了')}${other.name}${t('暗自較勁,關係越來越僵...')}`, agent.name, rival.name);
                                    if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'rivalry', agent, rival);
                                }
                                break;
                            }
                        }
                    }
                }

                // --- v5.3.0 個性摩擦:合不來的人偶爾會起口角,好感下滑(製造仇敵的土壤) ---
                if (rel.interactionCount > 3 && !rel.status) {
                    const tA = agent.personality.traits, tB = other.personality.traits;
                    let friction = 0;
                    for (const [x, y] of INCOMPATIBLE) {
                        if ((tA.includes(x) && tB.includes(y)) || (tA.includes(y) && tB.includes(x))) friction += 2;
                    }
                    if (tA.includes('abrasive') || tB.includes('abrasive')) friction += 1;
                    if (tA.includes('jealous') && tB.includes('charismatic')) friction += 1;
                    if (friction > 0 && Math.random() < 0.16) { // v5.22.0 加溫:合不來的人更常起口角
                        rel.modifyAffinity(-randInt(2, friction + 2));
                        otherRel.modifyAffinity(-randInt(2, friction + 2));
                    }
                }
                // v5.3.0 剛剛跌破仇敵線 → 生成仇敵八卦(一次)
                if (rel.affinity <= -40 && !rel._rivalGossiped) {
                    rel._rivalGossiped = true;
                    agent.moodModifier = (agent.moodModifier || 0) - 4;
                    if (this.gossipNetwork) this.gossipNetwork.createRelGossip(this, 'rivalry', agent, other);
                }

                // --- Start Dating ---
                if (!rel.status && !otherRel.status) {
                    const agentHasPartner = agent.relationships.getPartner();
                    const otherHasPartner = other.relationships.getPartner();
                    if (!agentHasPartner && !otherHasPartner &&
                        rel.romanticInterest > 50 && otherRel.romanticInterest > 35 &&
                        rel.affinity > 30 && otherRel.affinity > 20 && Math.random() < 0.2) {
                        rel.status = 'dating'; rel.statusSince = this.tickCount;
                        otherRel.status = 'dating'; otherRel.statusSince = this.tickCount;
                        this.queueDramaScene('confession', agent, other); // v5.1.0 名場面
                        agent.addThought('got_together', this, other.agentId, other.name); other.addThought('got_together', this, agent.agentId, agent.name);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('開始交往了！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('開始交往了！')}`, 9, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('開始交往了！')}`, 9, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) + 20;
                        other.moodModifier = (other.moodModifier || 0) + 20;
                        this.gossipNetwork.createRelGossip(this, 'newCouple', agent, other); // v5.3.0 有內容八卦
                    }
                }

                // --- Proposal / Marriage (from dating) ---
                if (rel.status === 'dating' && otherRel.status === 'dating') {
                    const datingDuration = this.tickCount - rel.statusSince;
                    // Need to have been dating for a while, high affinity and romantic
                    if (datingDuration > 300 && rel.affinity > 50 && rel.romanticInterest > 55 &&
                        otherRel.affinity > 45 && otherRel.romanticInterest > 45 && Math.random() < 0.10) {
                        rel.status = 'married'; rel.statusSince = this.tickCount;
                        otherRel.status = 'married'; otherRel.statusSince = this.tickCount;
                        this.queueDramaScene('wedding', agent, other); // v5.1.0 名場面
                        agent.addThought('married', this, other.agentId, other.name); other.addThought('married', this, agent.agentId, agent.name);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('結婚了！全鎮舉辦了盛大的婚禮！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('結婚了！這是我人生中最幸福的一天。')}`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('結婚了！太開心了。')}`, 10, [agent.name]);
                        // Wedding boosts mood for everyone
                        Object.values(this.agents).forEach(a => {
                            a.moodModifier = (a.moodModifier || 0) + 8;
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.memory.add(this.tickCount, this.clock.timeStr, 'social', `${t('參加了')}${agent.name}${t('和')}${other.name}${t('的婚禮！')}`, 6, [agent.name, other.name]);
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('結婚了！婚禮好浪漫！')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}${t('和')}${other.name}${t('結婚了！全鎮舉辦了盛大的婚禮！')}`, 10, [agent.name, other.name]);
                    }
                }

                // --- Cheating ---
                if ((rel.status === 'dating' || rel.status === 'married') && !rel.isCheating) {
                    // Check if agent has high romantic interest in someone else
                    for (const otherRel2 of Object.values(agent.relationships.relationships)) {
                        if (otherRel2.targetId === rel.targetId) continue;
                        const third = this.agents[otherRel2.targetId];
                        if (!third || third.isPlayer) continue;
                        const thirdRel = third.relationships.getOrCreate(agent.agentId, agent.name);
                        // Both need romantic interest, and agent has low affinity with partner or is neurotic/romantic
                        const isVulnerable = rel.affinity < 20 || agent.personality.traits.includes('romantic') || agent.personality.traits.includes('neurotic');
                        if (isVulnerable && otherRel2.romanticInterest > 50 && thirdRel.romanticInterest > 40 &&
                            otherRel2.affinity > 30 && Math.random() < 0.06) { // v5.22.0 加溫:偷情更容易發生(修羅場的火種)
                            otherRel2.isCheating = true;
                            thirdRel.isCheating = true;
                            this.logMessage('relationship', `${agent.name}${t('背著')}${other.name}${t('和')}${third.name}${t('有了秘密關係⋯⋯')}`, agent.name, third.name);
                            agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我背著')}${other.name}${t('和')}${third.name}${t('在一起了⋯⋯我知道這不對。')}`, 9, [other.name, third.name]);
                            third.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('開始了秘密關係。')}`, 8, [agent.name]);
                            this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${t('有人看到')}${agent.name}${t('和')}${third.name}${t('偷偷在一起⋯⋯')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                            if (this.dailyNews) this.dailyNews.collectEvent('drama', `${t('有人看到')}${agent.name}${t('和')}${third.name}${t('偷偷在一起⋯⋯')}`, 8, [agent.name, third.name]);
                            break; // Only one affair at a time
                        }
                    }
                }

                // --- Discovery of cheating leads to breakup/divorce ---
                if ((rel.status === 'dating' || rel.status === 'married') && !rel.isCheating) {
                    // Check if partner is cheating
                    const partnerCheating = Object.values(other.relationships.relationships).find(r => r.isCheating && r.targetId !== agent.agentId);
                    if (partnerCheating && Math.random() < 0.15) { // v5.22.0 加溫:劈腿更容易東窗事發 → 修羅場
                        // Discovered!
                        const thirdParty = this.agents[partnerCheating.targetId];
                        const thirdName = thirdParty?.name || t('某人');
                        const wasMariage = rel.status === 'married';
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-40); rel.modifyTrust(-50);
                        otherRel.modifyAffinity(-20);
                        // End the affair too
                        partnerCheating.isCheating = false; partnerCheating.status = null;
                        if (thirdParty) {
                            const thirdBack = thirdParty.relationships.getOrCreate(other.agentId, other.name);
                            thirdBack.isCheating = false; thirdBack.status = null;
                        }
                        const action = wasMariage ? t('離婚') : t('分手');
                        this.queueDramaScene('busted', agent, other, thirdName); // v5.1.0 名場面
                        agent.addThought('betrayed', this, other.agentId, other.name);
                        this.logMessage('relationship', `${agent.name}${t('發現')}${other.name}${t('劈腿')}${thirdName}${t('，兩人')}${action}${t('了！')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('發現')}${other.name}${t('背著我和')}${thirdName}${t('在一起。我們')}${action}${t('了。')}`, 10, [other.name, thirdName]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${agent.name}${t('發現了我的事情。我們')}${action}${t('了。')}`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 30;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:other.name, content:`${other.name}${t('劈腿被')}${agent.name}${t('發現了！兩人')}${action}${t('了！')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${other.name}${t('劈腿被')}${agent.name}${t('發現！兩人')}${action}${t('了！')}`, 10, [agent.name, other.name, thirdName]);
                        // Trigger NPC event chain for cheating discovery
                        if (this.npcEvents && thirdParty) this.npcEvents.handleCheatingDiscovery(this, other, agent, thirdParty);
                    }
                }

                // --- Natural breakup (dating, low affinity) ---
                if (rel.status === 'dating' && otherRel.status === 'dating') {
                    const duration = this.tickCount - rel.statusSince;
                    if (duration > 100 && (rel.affinity < -10 || otherRel.affinity < -10 || (rel.romanticInterest < 15 && otherRel.romanticInterest < 15)) && Math.random() < 0.1) {
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-10); otherRel.modifyAffinity(-10);
                        this.queueDramaScene('breakup', agent, other); // v5.1.0 名場面
                        agent.addThought('broke_up', this); other.addThought('broke_up', this);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('分手了。')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('分手了。')}`, 8, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('分手了。')}`, 8, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 15;
                        other.moodModifier = (other.moodModifier || 0) - 15;
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('分手了⋯⋯')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('relationship', `${agent.name}${t('和')}${other.name}${t('分手了⋯⋯')}`, 6, [agent.name, other.name]);
                    }
                }

                // --- Divorce (married, very low affinity for a long time) ---
                if (rel.status === 'married' && otherRel.status === 'married') {
                    const duration = this.tickCount - rel.statusSince;
                    if (duration > 300 && rel.affinity < -30 && otherRel.affinity < -20 && Math.random() < 0.05) {
                        rel.status = 'ex'; rel.statusSince = this.tickCount;
                        otherRel.status = 'ex'; otherRel.statusSince = this.tickCount;
                        rel.modifyAffinity(-15); otherRel.modifyAffinity(-15);
                        this.queueDramaScene('divorce', agent, other); // v5.1.0 名場面
                        agent.addThought('divorced', this); other.addThought('divorced', this);
                        this.logMessage('relationship', `${agent.name}${t('和')}${other.name}${t('離婚了。')}`, agent.name, other.name);
                        agent.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${other.name}${t('離婚了。')}`, 10, [other.name]);
                        other.memory.add(this.tickCount, this.clock.timeStr, 'relationship', `${t('我和')}${agent.name}${t('離婚了。')}`, 10, [agent.name]);
                        agent.moodModifier = (agent.moodModifier || 0) - 25;
                        other.moodModifier = (other.moodModifier || 0) - 25;
                        Object.values(this.agents).forEach(a => {
                            if (a.agentId !== agent.agentId && a.agentId !== other.agentId) {
                                a.moodModifier = (a.moodModifier || 0) - 3;
                            }
                        });
                        this.gossipNetwork.activeGossip.push({ about:agent.name, content:`${agent.name}${t('和')}${other.name}${t('離婚了⋯⋯好可惜。')}`, source:t('鎮民'), spreadCount:0, tickCreated:this.tickCount, isTrue:true });
                        if (this.dailyNews) this.dailyNews.collectEvent('drama', `${agent.name}${t('和')}${other.name}${t('離婚了⋯⋯全鎮不勝唏噓。')}`, 9, [agent.name, other.name]);
                    }
                }
            }
        }
    }

    _loadDefaultResidents() {
        const residents = [
            {id:'chen_wei',name:'陳偉',age:45,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','hardworking','optimist'],values:['社群','和平'],background:'曾是軍官，二十年前定居邊境鎮。他深愛這個社區，把全鎮的安危視為自己的責任。'},
            {id:'lin_mei',name:'林美',age:32,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','night_owl'],values:['知識','家庭'],background:'才華洋溢的醫生，離開城裡的大醫院來到邊境鎮行醫。經常工作到深夜。'},
            {id:'zhang_hao',name:'張豪',age:28,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','shy','stoic'],values:['藝術','自由'],background:'沉默寡言但技藝精湛的鐵匠，用金屬表達自己的情感。私下喜歡寫詩。'},
            {id:'wang_li',name:'王麗',age:38,gender:'female',job:'cook',home:'residential_south',traits:['gossip','kind','glutton'],values:['社群','家庭'],background:'酒館的靈魂人物，認識鎮上每一個人，也知道所有人的八卦。煮的菜讓人回味無窮。'},
            {id:'liu_jun',name:'劉俊',age:22,gender:'male',job:'farmer',home:'residential_east',traits:['early_bird','romantic','creative'],values:['自然','冒險'],background:'有著遠大夢想的年輕農夫。偷偷寫情書但從未寄出，心中暗戀著某人。'},
            {id:'zhao_xia',name:'趙霞',age:35,gender:'female',job:'trader',home:'residential_east',traits:['charismatic','creative','pessimist'],values:['財富','冒險'],background:'精明的女商人，與外面的世界有廣泛的聯繫。表面開朗但內心悲觀。'},
            {id:'yang_feng',name:'楊鋒',age:40,gender:'male',job:'guard',home:'residential_north',traits:['stoic','hardworking','jealous'],values:['權力','家庭'],background:'前傭兵，在邊境鎮找到了平靜。但嫉妒心很重，尤其在感情方面。'},
            {id:'sun_yu',name:'孫雨',age:26,gender:'female',job:'researcher',home:'residential_east',traits:['creative','neurotic','night_owl'],values:['知識','自由'],background:'聰明但容易焦慮的年輕學者，正在研究小鎮附近的古代遺跡。'},
            {id:'wu_da',name:'吳達',age:50,gender:'male',job:'miner',home:'residential_south',traits:['hardworking','pessimist','abrasive'],values:['財富','自由'],background:'從十六歲就開始挖礦的老礦工。說話粗魯但非常可靠。'},
            {id:'huang_li',name:'黃莉',age:29,gender:'female',job:'priest',home:'residential_north',traits:['kind','optimist','romantic'],values:['和平','社群','藝術'],background:'溫柔的牧師，照顧禮拜堂和居民的心靈。有一副動人的歌喉，經常在教堂唱歌。'},
            {id:'ma_qiang',name:'馬強',age:33,gender:'male',job:'carpenter',home:'residential_south',traits:['lazy','charismatic','gossip'],values:['自由','冒險'],background:'迷人的懶鬼，比起幹活更喜歡講故事。但只要認真起來手藝一流。'},
            {id:'xu_ying',name:'許瑩',age:20,gender:'female',job:'tailor',home:'residential_east',traits:['shy','perfectionist','early_bird'],values:['藝術','家庭'],background:'鎮上最年輕的居民。天賦異稟的裁縫師，但太害羞不敢接受別人的誇獎。'},
            // v5.5.0 新村民包(自帶戲劇鉤子)
            {id:'zhou_ming',name:'周明',age:27,gender:'male',job:'trader',home:'residential_east',traits:['charismatic','romantic','creative'],values:['冒險','藝術'],background:'從遠方來的遊唱商人，帶著一把舊吉他和說不完的故事。走到哪都是焦點，也走到哪都留下心碎的人。'},
            {id:'he_chang',name:'何昌',age:44,gender:'male',job:'carpenter',home:'residential_north',traits:['hardworking','kind','stoic'],values:['家庭','社群'],background:'沉穩可靠的老木匠，和妻子何秀結縭二十年。話不多，但眼裡總有妻子的身影。'},
            {id:'he_xiu',name:'何秀',age:41,gender:'female',job:'cook',home:'residential_north',traits:['kind','gossip','optimist'],values:['家庭','社群'],background:'何昌的妻子，開朗愛笑。和王麗是廚房裡的死黨，兩人湊在一起整條街的八卦都藏不住。'},
            {id:'zheng_wei',name:'鄭薇',age:23,gender:'female',job:'researcher',home:'residential_east',traits:['shy','creative','perfectionist'],values:['知識','藝術'],background:'孤僻的年輕天才，總是埋首書堆。最近卻常常為了一個人心神不寧，連公式都算錯。'},
            // v5.25.0 新村民包(新的三角、派系與同性甜蜜線)
            {id:'su_qing',name:'蘇晴',age:24,gender:'female',job:'cook',home:'residential_east',traits:['optimist','charismatic','early_bird'],values:['社群','冒險'],background:'剛搬來的糕點師傅，笑起來像陽光。她的甜點總在清晨飄香，也悄悄記住了某個早起農夫的身影。'},
            {id:'gao_lang',name:'高朗',age:31,gender:'male',job:'guard',home:'residential_north',traits:['hardworking','stoic','abrasive'],values:['權力','社群'],background:'吳達的舊袍澤，退伍後追隨老友來到邊境鎮。剛硬耿直,看不慣楊鋒的作風,卻對禮拜堂的歌聲莫名心軟。'},
            {id:'ke_wei',name:'柯薇',age:27,gender:'female',job:'tailor',home:'residential_south',traits:['creative','romantic','night_owl'],values:['藝術','自由'],background:'遊歷各地的繡藝師，指尖有星光。愛自由不受拘束，卻在遇見一位安靜的星象學者後,第一次想為誰停下腳步。'},
            {id:'ling_bo',name:'凌波',age:25,gender:'female',job:'researcher',home:'residential_south',traits:['shy','creative','perfectionist'],values:['知識','自然'],background:'沉靜的星象研究者，總在夜裡觀測。話不多,但每次抬頭看見那位繡藝師,筆記本上的星圖就會多幾筆走神的線條。'},
            // v5.79.0 邊境鎮擴編 +5:新人各自帶著關係鉤子進來(師徒、寡婦、老棋手、話癆學徒)
            {id:'du_juan',name:'杜鵑',age:30,gender:'female',job:'farmer',home:'residential_south',traits:['hardworking','kind','stoic'],values:['家庭','自然'],background:'從市集城嫁過來的農婦，一手養雞的本事讓邊境鎮的早餐多了雞蛋。嫁的那個人三年前走了，她留了下來，雞圈越養越大。'},
            {id:'shi_lei',name:'石磊',age:36,gender:'male',job:'miner',home:'residential_south',traits:['hardworking','optimist','abrasive'],values:['財富','權力'],background:'吳達帶出來的徒弟，現在礦場一半的活是他扛的。崇拜師父也想超越師父，常為了礦場的安全跟護衛隊吵架。對埋首書堆的鄭薇，有說不出口的在意。'},
            {id:'bai_lu',name:'白露',age:21,gender:'female',job:'doctor',home:'residential_north',traits:['shy','perfectionist','kind'],values:['知識','社群'],background:'林美從城裡帶回來的學徒，膽子小但針扎得準。偷偷把楊鋒送給林美的花插進了診所的花瓶，自己卻假裝沒看見。'},
            {id:'lao_xie',name:'老謝',age:62,gender:'male',job:'guard',home:'residential_north',traits:['stoic','gossip','perfectionist'],values:['社群','和平'],background:'退休的老守衛，鎮上最會下棋的人。嘴上說不管事，鎮公所每一條決議他都有意見。年輕時和何秀的姐姐有過婚約，沒人敢問後來怎麼了。'},
            {id:'xiao_man',name:'小滿',age:24,gender:'female',job:'blacksmith',home:'residential_south',traits:['charismatic','gossip','hardworking'],values:['藝術','冒險'],background:'張豪收的徒弟，打鐵的聲音比師父還響。愛熱鬧、愛講話，跟沉默的師父剛好是兩個極端。偷偷把師父寫的詩抄了一份，塞給了禮拜堂的黃莉。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        this._seedRelationships(); // v5.5.0 開局關係網,讓小鎮一開始就有戲
        this._seedCrossTownMemories(); // v5.58.0 海那頭的親友,從第一天就在記憶裡
    }

    // v5.58.0 依親緣網為在場居民種下「海那頭的親友」記憶,閒聊/對話/反思自然會提起
    _seedCrossTownMemories() {
        if (typeof CROSS_TOWN_TIES === 'undefined') return;
        for (const [aid, tie] of Object.entries(CROSS_TOWN_TIES)) {
            const ag = this.agents[aid];
            if (ag && tie.thoughts?.length) ag.memory.add(0, '08:00', 'family', tie.thoughts[0], 6, [tie.other]);
        }
    }

    // v5.55.0 海風鎮名冊:漁村暱稱式人名、討海人的早起文化、自帶戲劇鉤子
    _loadHarborResidents() {
        const residents = [
            {id:'hb_haibo',name:'海伯',age:58,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','stoic','early_bird'],values:['社群','和平'],background:'跑了四十年船的老船長，退下來當港務長。嗓門大心腸軟，全鎮的船都經過他的手。年輕時和廟祝雲姨有過一段沒說完的故事。'},
            {id:'hb_achao',name:'阿潮',age:26,gender:'male',job:'farmer',home:'residential_east',traits:['early_bird','romantic','hardworking'],values:['自然','家庭'],background:'天不亮就出海的討海青年，蚵田和漁獲都靠他。曬得黝黑，笑起來一口白牙。每天收工都繞去海味居，只為看掌杓的小鷗一眼。'},
            {id:'hb_xiaoou',name:'小鷗',age:22,gender:'female',job:'cook',home:'residential_south',traits:['optimist','early_bird','charismatic'],values:['社群','冒險'],background:'海味居的掌杓姑娘，一手海鮮料理讓過路商人特地繞港。開朗愛笑，渾然不覺兩個男人都在偷偷看她。'},
            {id:'hb_langshu',name:'浪叔',age:49,gender:'male',job:'trader',home:'residential_east',traits:['gossip','charismatic','glutton'],values:['財富','社群'],background:'跑船帶貨的老江湖，南北雜貨行的貨都是他捎回來的。嘴上沒把門，外地的八卦比報紙還快。和補帆的秀姑是老夫老妻。'},
            {id:'hb_xiugu',name:'秀姑',age:45,gender:'female',job:'tailor',home:'residential_east',traits:['kind','gossip','perfectionist'],values:['家庭','藝術'],background:'補了三十年帆的巧手，鎮上人的衣裳也全是她做的。和浪叔鬥了半輩子嘴，針線一拿起來誰都不理。'},
            {id:'hb_shishu',name:'石叔',age:52,gender:'male',job:'miner',home:'residential_south',traits:['stoic','pessimist','hardworking'],values:['財富','自由'],background:'鹽場的老鹽工，沉默得像塊礁石。二十年前一場船難後，就和燈塔的燈爺再沒說過一句話——沒人知道那晚發生了什麼。'},
            {id:'hb_dengye',name:'燈爺',age:60,gender:'male',job:'researcher',home:'residential_north',traits:['night_owl','stoic','creative'],values:['知識','和平'],background:'守了半輩子燈塔的老人，夜裡點燈、白天睡覺，和全鎮作息相反。書房堆滿航海日誌。提到石叔，他只會把燈芯撥得更亮。'},
            {id:'hb_axi',name:'阿汐',age:30,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','early_bird'],values:['知識','社群'],background:'海女出身的醫師，潛得比誰都深，也把診療所打理得一塵不染。誰家被海膽扎了、被日頭曬昏了，都是她救的。和小鷗是無話不談的手帕交。'},
            {id:'hb_amao',name:'阿錨',age:33,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','shy','stoic'],values:['藝術','家庭'],background:'修船工房的鐵匠，錨鏈和船釘都出自他的爐子。話少手巧，打鐵的節奏永遠穩。只有小鷗送飯來的時候，鎚子才會敲歪。'},
            {id:'hb_yunyi',name:'雲姨',age:47,gender:'female',job:'priest',home:'residential_north',traits:['kind','optimist','romantic'],values:['和平','社群'],background:'海神小廟的廟祝，出海的人都來求她一炷平安香。溫柔健談，只有海伯經過廟前時，她會突然想不起下一句經文。'},
            {id:'hb_aduo',name:'阿舵',age:36,gender:'male',job:'guard',home:'residential_south',traits:['abrasive','jealous','hardworking'],values:['權力','家庭'],background:'望潮哨的哨長，颱風天全鎮聽他的哨音行動。責任感重但佔有慾也重，看誰跟阿汐多說兩句話都不順眼。'},
            {id:'hb_muxia',name:'木蝦',age:28,gender:'male',job:'carpenter',home:'residential_south',traits:['lazy','charismatic','gossip'],values:['自由','冒險'],background:'船木匠，手藝一流但三天打魚兩天曬網——字面意義上的。最愛躺在曬網場講他「差點抓到人魚」的故事。'},
            {id:'hb_shanshan',name:'珊珊',age:24,gender:'female',job:'researcher',home:'residential_east',traits:['creative','neurotic','night_owl'],values:['知識','自然'],background:'研究潮汐與洋流的年輕學者，筆記本永遠算不完。緊張起來會語無倫次，只有看海的時候是平靜的。'},
            {id:'hb_afu',name:'阿浮',age:21,gender:'male',job:'farmer',home:'residential_east',traits:['shy','early_bird','kind'],values:['自然','家庭'],background:'蚵田的少年，話少得像蚵殼。每天默默把最好的海菜留在珊珊的窗台上，從來不敢署名。'},
            {id:'hb_haima',name:'海嬤',age:66,gender:'female',job:'cook',home:'residential_south',traits:['kind','gossip','optimist'],values:['家庭','社群'],background:'鎮上最老的海女退休後在海味居幫廚，醃的魚乾是傳家手藝。誰家的曾祖父年輕時暗戀過誰，她都記得。'},
            // v5.79.0 海風鎮擴編 +5
            {id:'hb_afan',name:'阿帆',age:25,gender:'male',job:'guard',home:'residential_south',traits:['early_bird','optimist','romantic'],values:['冒險','社群'],background:'望潮哨的年輕哨兵，阿舵帶出來的。眼睛好，颱風來之前總是他第一個看見。喜歡珊珊，可惜阿浮的海菜天天在她窗台上。'},
            {id:'hb_kesao',name:'蚵嫂',age:46,gender:'female',job:'farmer',home:'residential_east',traits:['gossip','kind','abrasive'],values:['家庭','社群'],background:'蚵田的大嬸，阿浮的母親，嗓門比海浪大。覺得兒子太悶，天天替他找話題，反而把他嚇得更不敢開口。'},
            {id:'hb_ayan',name:'阿鹽',age:31,gender:'male',job:'miner',home:'residential_south',traits:['hardworking','creative','pessimist'],values:['財富','自由'],background:'鹽場的年輕鹽工，石叔的徒弟。一心想把海風鎮的鹽賣到礦山鎮去，石叔只說一句「鹽不過山」。'},
            {id:'hb_arong',name:'阿蓉',age:23,gender:'female',job:'tailor',home:'residential_east',traits:['creative','perfectionist','shy'],values:['藝術','自由'],background:'秀姑的徒弟，補帆之外還會繡花。想去市集城開繡坊，秀姑說走了就別回來，其實比誰都捨不得。'},
            {id:'hb_laoyu',name:'老漁',age:67,gender:'male',job:'trader',home:'residential_north',traits:['gossip','stoic','night_owl'],values:['和平','社群'],background:'退休的老漁夫，現在在碼頭賣魚乾和故事。海伯的老船員，當年那場船難他也在船上——他比誰都清楚石叔和燈爺之間發生了什麼，只是從來不說。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        // 開局關係網:老夫妻/世仇/三角/無名暗戀/手帕交/未完的舊情
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        pair('hb_langshu', 'hb_xiugu', { aff: 66, rom: 48, trust: 60, status: 'married' }, { aff: 62, rom: 45, trust: 58, status: 'married' }); // 鬥嘴老夫妻
        pair('hb_shishu', 'hb_dengye', { aff: -46, rom: 0, trust: -20 }, { aff: -44, rom: 0, trust: -18 }); // 船難舊怨
        pair('hb_achao', 'hb_xiaoou', { aff: 40, rom: 46 }, { aff: 28, rom: 10 }); // 三角:阿潮→小鷗
        pair('hb_amao', 'hb_xiaoou', { aff: 36, rom: 42 }, { aff: 24, rom: 8 });  // 三角:阿錨→小鷗
        pair('hb_afu', 'hb_shanshan', { aff: 30, rom: 44 }, { aff: 12, rom: 4 }); // 無名的海菜
        pair('hb_axi', 'hb_xiaoou', { aff: 58, rom: 0, trust: 52 }, { aff: 56, rom: 0, trust: 50 }); // 手帕交
        pair('hb_yunyi', 'hb_haibo', { aff: 34, rom: 26, status: 'ex' }, { aff: 30, rom: 22, status: 'ex' }); // 未完的舊情
        pair('hb_aduo', 'hb_axi', { aff: 26, rom: 34 }, { aff: 18, rom: 6 }); // 哨長的佔有慾
        // v5.79.0 擴編新人的鉤子
        pair('hb_afan', 'hb_aduo', { aff: 40, rom: 0, trust: 34 }, { aff: 36, rom: 0, trust: 30 }); // 哨長帶出來的兵
        pair('hb_afan', 'hb_shanshan', { aff: 32, rom: 36 }, { aff: 18, rom: 6 }); // 窗台之爭的第二人
        pair('hb_afan', 'hb_afu', { aff: -10, rom: 0, trust: -8 }, { aff: -6, rom: 0, trust: -4 }); // 情敵
        pair('hb_kesao', 'hb_afu', { aff: 62, rom: 0, trust: 50 }, { aff: 48, rom: 0, trust: 40 }); // 母子
        pair('hb_kesao', 'hb_haima', { aff: 52, rom: 0, trust: 46 }, { aff: 50, rom: 0, trust: 44 }); // 蚵田與灶腳的老姐妹
        pair('hb_ayan', 'hb_shishu', { aff: 38, rom: 0, trust: 30 }, { aff: 30, rom: 0, trust: 24 }); // 鹽不過山
        pair('hb_arong', 'hb_xiugu', { aff: 48, rom: 0, trust: 42 }, { aff: 46, rom: 0, trust: 40 }); // 捨不得的師徒
        pair('hb_muxia', 'hb_arong', { aff: 28, rom: 26 }, { aff: 16, rom: 4 }); // 船木匠的心事
        pair('hb_laoyu', 'hb_haibo', { aff: 54, rom: 0, trust: 48 }, { aff: 50, rom: 0, trust: 44 }); // 老船長與老船員
        pair('hb_laoyu', 'hb_shishu', { aff: 30, rom: 0, trust: 22 }, { aff: 24, rom: 0, trust: 16 }); // 船難那夜的另一個人
        pair('hb_laoyu', 'hb_dengye', { aff: 30, rom: 0, trust: 20 }, { aff: 22, rom: 0, trust: 14 });
        this._seedCrossTownMemories(); // v5.58.0 海風鎮這頭也記掛著邊境鎮的親友
    }

    // v5.76.0 礦山鎮名冊:礦業小鎮的粗獷人名、下坑文化、塌方舊事與接班暗流
    _loadMountainResidents() {
        const residents = [
            {id:'mt_kuangye',name:'礦爺',age:61,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','stoic','hardworking'],values:['權力','社群'],background:'礦山鎮的礦務長，當年第一鏟挖開主礦坑的人。說一不二，全鎮的工資都經他的手。膝蓋在坑裡壞了，雨天走路一瘸一瘸，但沒人敢扶。'},
            {id:'mt_tiezhu',name:'鐵柱',age:38,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','abrasive','stoic'],values:['財富','家庭'],background:'熔爐鍛坊的鐵匠，手臂比別人大腿還粗。脾氣跟爐火一樣旺，但打出來的鎬頭全鎮最耐用。和妻子阿杏是在坑口定情的。'},
            {id:'mt_axing',name:'阿杏',age:34,gender:'female',job:'cook',home:'residential_south',traits:['kind','optimist','gossip'],values:['家庭','社群'],background:'礦燈酒館的老闆娘，一鍋熱湯撐起全礦山的早班。嘴快心熱，鐵柱的脾氣只有她壓得住。'},
            {id:'mt_laochui',name:'老錘',age:55,gender:'male',job:'miner',home:'residential_south',traits:['stoic','pessimist','hardworking'],values:['自由','財富'],background:'下了三十年坑的老礦工，肺不好但從不請假。二十年前坑道塌方時他是最後一個爬出來的，從此不信任何人嘴裡的「安全」。'},
            {id:'mt_xiaozuan',name:'小鑽',age:23,gender:'male',job:'miner',home:'residential_south',traits:['optimist','romantic','early_bird'],values:['冒險','財富'],background:'礦山最年輕的礦工，堅信坑道深處一定有金脈。愛上了礦圖室的阿岩，可惜她眼裡只有地圖。'},
            {id:'mt_ayan',name:'阿岩',age:27,gender:'female',job:'researcher',home:'residential_north',traits:['perfectionist','neurotic','creative'],values:['知識','自然'],background:'礦圖室的地質學者，畫礦脈圖比畫自己還熟。她算出主礦坑第七層有金，但礦爺不肯批准往下挖。'},
            {id:'mt_baigu',name:'白姑',age:44,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','night_owl'],values:['知識','和平'],background:'坑口醫站的醫師，救過的礦工比全鎮人口還多。夜裡總在整理塵肺病例，想寫一封信把礦山的真相寄出去。'},
            {id:'mt_niushu',name:'牛叔',age:47,gender:'male',job:'guard',home:'residential_east',traits:['abrasive','jealous','hardworking'],values:['權力','財富'],background:'坑道哨的工頭，礦爺的左右手。嗓門大、手段硬，暗地裡盤算著礦爺退了之後誰來接班。'},
            {id:'mt_aqing',name:'阿晴',age:29,gender:'female',job:'trader',home:'residential_east',traits:['charismatic','gossip','glutton'],values:['財富','冒險'],background:'礦山雜貨的老闆，礦石換銀子的門路全靠她。常跑邊境鎮進貨，鎮上的八卦也是她一併捎回來的。'},
            {id:'mt_mugen',name:'木根',age:40,gender:'male',job:'carpenter',home:'residential_east',traits:['hardworking','shy','stoic'],values:['藝術','家庭'],background:'專做坑道支架的木匠，坑裡每一根撐木都是他量的。不說話的時候就在刻木頭小礦車，送給鎮上的小孩。'},
            {id:'mt_cipo',name:'祠婆',age:63,gender:'female',job:'priest',home:'residential_north',traits:['kind','stoic','romantic'],values:['和平','社群'],background:'山神祠的守祠人，每次下坑前礦工都來她這兒摸一下護身符。年輕時和老錘有過一段，塌方那年斷了。'},
            {id:'mt_ati',name:'阿梯',age:31,gender:'male',job:'farmer',home:'residential_east',traits:['early_bird','kind','hardworking'],values:['自然','家庭'],background:'守著山腰梯田的農夫，山上長不出什麼，他硬是種出了全鎮的蘿蔔。每天把最醜的那顆留給自己。'},
            {id:'mt_xiugu',name:'繡姑',age:50,gender:'female',job:'tailor',home:'residential_east',traits:['perfectionist','gossip','kind'],values:['家庭','藝術'],background:'縫礦工工裝的裁縫，補過的膝蓋補丁數不清。和阿晴是茶友，鎮上沒有她們兩個不知道的事。'},
            {id:'mt_aling',name:'阿鈴',age:20,gender:'female',job:'miner',home:'residential_south',traits:['shy','creative','early_bird'],values:['自由','知識'],background:'礦山第一個女礦工，進坑那天全鎮都在看。白天挖礦，夜裡偷偷跟阿岩學看礦脈圖。'},
            {id:'mt_youbo',name:'油伯',age:58,gender:'male',job:'miner',home:'residential_south',traits:['night_owl','gossip','optimist'],values:['社群','自由'],background:'坑道燈伕，每天提早一小時進坑把油燈點亮。礦山所有的故事，都是他在燈光下講給新人聽的。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        pair('mt_tiezhu', 'mt_axing', { aff: 70, rom: 52, trust: 62, status: 'married' }, { aff: 72, rom: 50, trust: 64, status: 'married' }); // 爐火夫妻
        pair('mt_laochui', 'mt_cipo', { aff: 36, rom: 28, status: 'ex' }, { aff: 40, rom: 30, status: 'ex' }); // 塌方那年斷掉的舊情
        pair('mt_laochui', 'mt_niushu', { aff: -50, rom: 0, trust: -30 }, { aff: -40, rom: 0, trust: -22 }); // 老錘怪工頭催工釀成塌方
        pair('mt_xiaozuan', 'mt_ayan', { aff: 38, rom: 48 }, { aff: 20, rom: 6 }); // 小鑽的單戀
        pair('mt_aling', 'mt_ayan', { aff: 44, rom: 0, trust: 40 }, { aff: 34, rom: 0, trust: 30 }); // 師徒
        pair('mt_mugen', 'mt_aling', { aff: 26, rom: 32 }, { aff: 14, rom: 4 }); // 木匠的靦腆心事
        pair('mt_niushu', 'mt_kuangye', { aff: 30, rom: 0, trust: -12 }, { aff: 42, rom: 0, trust: 26 }); // 左右手的野心
        pair('mt_baigu', 'mt_kuangye', { aff: -22, rom: 0, trust: -16 }, { aff: -10, rom: 0, trust: 8 }); // 塵肺真相之爭
        pair('mt_aqing', 'mt_xiugu', { aff: 60, rom: 0, trust: 54 }, { aff: 58, rom: 0, trust: 52 }); // 茶友
        pair('mt_youbo', 'mt_laochui', { aff: 52, rom: 0, trust: 48 }, { aff: 50, rom: 0, trust: 46 }); // 同坑老兄弟
        pair('mt_ati', 'mt_axing', { aff: 30, rom: 18 }, { aff: 26, rom: 0 }); // 送蘿蔔的農夫
        this._seedCrossTownMemories();
    }

    // v5.77.0 林間村名冊:獵戶、樵夫、藥草師、守林人——護林與伐木的拉扯、古樹的傳說、林子深處的舊事
    _loadForestResidents() {
        const residents = [
            {id:'fv_linlao',name:'林姥',age:64,gender:'female',job:'mayor',home:'residential_north',traits:['kind','stoic','early_bird'],values:['社群','自然'],background:'林間村的村長，據說能聽懂樹說話。年輕時一個人在林子深處住了十年，村裡每一棵樹都是她看著長大的。'},
            {id:'fv_daxiong',name:'大熊',age:42,gender:'male',job:'guard',home:'residential_south',traits:['stoic','hardworking','abrasive'],values:['家庭','自由'],background:'村裡最好的獵人，背上有熊爪留下的三道疤。話少，但雪夜裡迷路的人，都是他找回來的。'},
            {id:'fv_aye',name:'阿葉',age:26,gender:'female',job:'doctor',home:'residential_north',traits:['kind','creative','neurotic'],values:['知識','自然'],background:'藥草小屋的藥草師，林子裡每一株草她都叫得出名字。總擔心哪天認錯一株就害死人，所以夜裡還在對圖譜。'},
            {id:'fv_mushu',name:'木叔',age:50,gender:'male',job:'carpenter',home:'residential_east',traits:['perfectionist','stoic','hardworking'],values:['藝術','財富'],background:'木工坊的老木匠，一把斧頭用了三十年。嫌年輕人砍樹不看紋理，但徒弟阿松的手藝已經快追上他了。'},
            {id:'fv_asong',name:'阿松',age:24,gender:'male',job:'carpenter',home:'residential_east',traits:['optimist','romantic','charismatic'],values:['冒險','藝術'],background:'木叔的徒弟，雕的木雕在村裡搶手。暗戀藥草師阿葉，每個月送她一隻新雕的小動物，已經送了十四隻。'},
            {id:'fv_juge',name:'鋸哥',age:36,gender:'male',job:'miner',home:'residential_east',traits:['hardworking','glutton','gossip'],values:['財富','社群'],background:'伐木場的工頭，嗓門能震落松針。一頓能吃三人份，村裡誰家煮了什麼他都知道。'},
            {id:'fv_luniang',name:'鹿娘',age:33,gender:'female',job:'farmer',home:'residential_south',traits:['early_bird','kind','shy'],values:['自然','家庭'],background:'林間菜園的農婦，養了一群半野的鹿。丈夫大熊打獵、她護鹿，兩人為此吵了十年還是沒分開。'},
            {id:'fv_laoqiao',name:'老樵',age:59,gender:'male',job:'miner',home:'residential_south',traits:['pessimist','stoic','night_owl'],values:['自由','和平'],background:'退了休的老樵夫，說林子深處有一棵不能砍的樹。年輕時砍倒過一棵千年古木，從此每晚做同一個夢。'},
            {id:'fv_atai',name:'阿苔',age:22,gender:'female',job:'researcher',home:'residential_north',traits:['creative','night_owl','shy'],values:['知識','藝術'],background:'林語書屋的年輕抄書人，記錄林子裡的每一種蘑菇。她懷疑老樵說的那棵樹真的存在，想找到它。'},
            {id:'fv_guishen',name:'桂嬸',age:48,gender:'female',job:'cook',home:'residential_south',traits:['optimist','gossip','charismatic'],values:['社群','家庭'],background:'松脂酒館的老闆娘，一鍋蘑菇湯是全村的靈魂。鋸哥的每一頓三人份都是她煮的，帳一次也沒收過。'},
            {id:'fv_ashao',name:'阿哨',age:29,gender:'male',job:'guard',home:'residential_north',traits:['perfectionist','jealous','early_bird'],values:['權力','自然'],background:'守林哨塔的守林人，誰砍了哪棵樹他都記在本子上。看鋸哥不順眼，覺得伐木場砍得太多了。'},
            {id:'fv_shupo',name:'樹婆',age:61,gender:'female',job:'priest',home:'residential_north',traits:['kind','romantic','stoic'],values:['和平','自然'],background:'古樹祭壇的祭司，每年春天帶全村繞古樹走一圈。和林姥是五十年的手帕交，也是唯一知道林姥年輕時為什麼進林子的人。'},
            {id:'fv_ahu',name:'阿狐',age:38,gender:'male',job:'trader',home:'residential_east',traits:['charismatic','gossip','lazy'],values:['財富','冒險'],background:'獵戶雜貨的老闆，皮毛和藥草換銀子的門路全靠他。常跑邊境鎮，嘴上說要搬去城裡，十年了還沒搬。'},
            {id:'fv_pigu',name:'皮姑',age:45,gender:'female',job:'tailor',home:'residential_south',traits:['perfectionist','kind','gossip'],values:['家庭','藝術'],background:'鞣皮做衣的裁縫，大熊帶回來的每一張皮都經她的手。總在替阿松打聽阿葉的心意。'},
            {id:'fv_ashi',name:'阿矢',age:19,gender:'male',job:'guard',home:'residential_south',traits:['early_bird','optimist','abrasive'],values:['冒險','權力'],background:'大熊的獵人學徒，箭法已經比師父準，脾氣也比師父衝。一心想獵到老樵口中那頭不該獵的巨鹿。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        pair('fv_daxiong', 'fv_luniang', { aff: 56, rom: 40, trust: 32, status: 'married' }, { aff: 54, rom: 38, trust: 30, status: 'married' }); // 打獵與護鹿的夫妻
        pair('fv_asong', 'fv_aye', { aff: 40, rom: 50 }, { aff: 26, rom: 10 }); // 十四隻木雕
        pair('fv_aye', 'fv_ashao', { aff: 22, rom: 14 }, { aff: 18, rom: 6 }); // 藥草師其實多看了守林人一眼
        pair('fv_ashao', 'fv_juge', { aff: -42, rom: 0, trust: -26 }, { aff: -30, rom: 0, trust: -14 }); // 護林 vs 伐木
        pair('fv_linlao', 'fv_shupo', { aff: 68, rom: 0, trust: 66 }, { aff: 66, rom: 0, trust: 64 }); // 五十年手帕交
        pair('fv_mushu', 'fv_asong', { aff: 48, rom: 0, trust: 42 }, { aff: 44, rom: 0, trust: 36 }); // 師徒
        pair('fv_laoqiao', 'fv_atai', { aff: 28, rom: 0, trust: 16 }, { aff: 20, rom: 0, trust: 8 }); // 傳說與懷疑
        pair('fv_laoqiao', 'fv_linlao', { aff: 32, rom: 20, status: 'ex' }, { aff: 26, rom: 14, status: 'ex' }); // 林子深處的舊事
        pair('fv_ahu', 'fv_guishen', { aff: 30, rom: 24 }, { aff: 24, rom: 10 }); // 商人對老闆娘的嘴甜
        pair('fv_ashi', 'fv_daxiong', { aff: 36, rom: 0, trust: 30 }, { aff: 34, rom: 0, trust: 24 }); // 獵人師徒
        pair('fv_juge', 'fv_guishen', { aff: 46, rom: 8, trust: 40 }, { aff: 40, rom: 0, trust: 36 }); // 三人份的帳
        pair('fv_pigu', 'fv_asong', { aff: 34, rom: 0, trust: 26 }, { aff: 30, rom: 0, trust: 22 }); // 幫忙打聽的裁縫
        this._seedCrossTownMemories();
    }

    // v5.78.0 市集城名冊:商會與市集的人——金錢、排場、帳本裡的秘密、等人的裁縫、跑遍五鎮的商隊領隊
    _loadMarketResidents() {
        const residents = [
            {id:'mk_jinlaoye',name:'金老爺',age:57,gender:'male',job:'mayor',home:'residential_north',traits:['charismatic','perfectionist','glutton'],values:['財富','權力'],background:'商會會長兼市集城的市長，一句話能讓整座城的物價漲三成。排場大、胃口也大，但真正怕的只有夫人鳳姨。'},
            {id:'mk_fengyi',name:'鳳姨',age:52,gender:'female',job:'trader',home:'residential_north',traits:['gossip','charismatic','jealous'],values:['財富','家庭'],background:'金老爺的夫人，大市集一半的攤位租約在她手裡。笑裡藏刀，誰家的生意她都要分一杯羹。'},
            {id:'mk_laozhang',name:'老帳',age:60,gender:'male',job:'researcher',home:'residential_north',traits:['perfectionist','stoic','night_owl'],values:['知識','和平'],background:'商會的老帳房，四十年來一分錢沒算錯。夜裡對帳時發現了一筆不該存在的款項，還不知道該不該說。'},
            {id:'mk_asuan',name:'阿算',age:23,gender:'male',job:'trader',home:'residential_south',traits:['optimist','creative','early_bird'],values:['財富','冒險'],background:'大市集最年輕的攤主，什麼都賣、什麼都想試。暗戀書院的書儀，為了跟她說上話把整本《算經》背了一遍。'},
            {id:'mk_shuyi',name:'書儀',age:25,gender:'female',job:'researcher',home:'residential_north',traits:['shy','perfectionist','kind'],values:['知識','藝術'],background:'書院的講師，教商人子弟讀書寫字。嘴上嫌阿算吵，但他交來的算題總是第一個批。'},
            {id:'mk_caishu',name:'財叔',age:55,gender:'male',job:'priest',home:'residential_south',traits:['optimist','gossip','kind'],values:['財富','和平'],background:'財神廟的廟祝，香火錢比商會的稅還多。誰來求財他都笑著說「會發會發」，自己卻窮得只剩一件長衫。'},
            {id:'mk_caigu',name:'綵姑',age:36,gender:'female',job:'tailor',home:'residential_south',traits:['creative','romantic','charismatic'],values:['藝術','自由'],background:'戲班出身的裁縫，戲服、嫁衣都是她的手筆。戲班散了之後她留在市集城，等一個說好要回來的人。'},
            {id:'mk_menshu',name:'門叔',age:44,gender:'male',job:'guard',home:'residential_east',traits:['stoic','hardworking','abrasive'],values:['權力','社群'],background:'城門衛所的衛隊長，每一支進城的商隊都要經他盤問。鐵面無私，但經過綵姑的戲服攤總是多看兩眼。'},
            {id:'mk_yaoshu',name:'窯叔',age:48,gender:'male',job:'miner',home:'residential_east',traits:['hardworking','pessimist','glutton'],values:['財富','家庭'],background:'磚窯的窯主，市集城每一棟樓的磚都出自他的窯。嫌金老爺壓價、嫌阿算吵、嫌所有事，但窯火從沒熄過。'},
            {id:'mk_agang',name:'阿鋼',age:30,gender:'male',job:'blacksmith',home:'residential_south',traits:['hardworking','shy','perfectionist'],values:['藝術','財富'],background:'百工坊的鐵匠，做的秤砣全城公認最準。話少、秤準，連鳳姨都挑不出毛病。'},
            {id:'mk_xinggu',name:'杏姑',age:39,gender:'female',job:'doctor',home:'residential_north',traits:['kind','perfectionist','neurotic'],values:['知識','社群'],background:'杏林藥堂的大夫，商隊帶進城的怪病她都見過。擔心市集城人多病多，一直想勸商會蓋一間像樣的醫館。'},
            {id:'mk_feishu',name:'肥叔',age:50,gender:'male',job:'cook',home:'residential_east',traits:['glutton','charismatic','lazy'],values:['社群','財富'],background:'金馬車客棧的老闆，商隊的消息都在他的酒桌上流轉。胖、懶、好客，欠他酒錢的人比他的客人還多。'},
            {id:'mk_amiao',name:'阿苗',age:27,gender:'female',job:'farmer',home:'residential_east',traits:['early_bird','kind','hardworking'],values:['自然','家庭'],background:'城郊農莊的農婦，一個人供應半個市集的菜。覺得城裡人什麼都用買的，不懂一顆菜要長多久。'},
            {id:'mk_asun',name:'阿榫',age:34,gender:'male',job:'carpenter',home:'residential_south',traits:['perfectionist','optimist','gossip'],values:['藝術','社群'],background:'百工坊的木匠，大市集的攤棚全是他搭的。愛打聽，攤主們的八卦他比鳳姨還早知道。'},
            {id:'mk_tuojie',name:'駝姐',age:41,gender:'female',job:'trader',home:'residential_east',traits:['charismatic','abrasive','early_bird'],values:['冒險','自由'],background:'商隊的領隊，一年有大半在路上，跑遍邊境鎮、海風鎮、礦山鎮、林間村。嘴硬，但每個鎮的人都記得她帶來的貨。'},
        ];
        residents.forEach(r => {
            const personality = new Personality(r.traits, r.background, r.values);
            const job = r.job ? new Job(r.job) : null;
            const agent = new Agent(r.id, r.name, r.age, personality, job, r.home, r.gender);
            this.addAgent(agent);
        });
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        pair('mk_jinlaoye', 'mk_fengyi', { aff: 50, rom: 30, trust: 38, status: 'married' }, { aff: 54, rom: 32, trust: 44, status: 'married' }); // 怕老婆的會長
        pair('mk_asuan', 'mk_shuyi', { aff: 40, rom: 50 }, { aff: 24, rom: 12 }); // 背了整本算經
        pair('mk_menshu', 'mk_caigu', { aff: 28, rom: 30 }, { aff: 16, rom: 4 }); // 多看兩眼的衛隊長
        pair('mk_laozhang', 'mk_jinlaoye', { aff: 20, rom: 0, trust: -14 }, { aff: 36, rom: 0, trust: 40 }); // 帳本裡的秘密
        pair('mk_yaoshu', 'mk_jinlaoye', { aff: -34, rom: 0, trust: -20 }, { aff: -12, rom: 0, trust: 6 }); // 壓價之怨
        pair('mk_fengyi', 'mk_xinggu', { aff: -22, rom: 0, trust: -10 }, { aff: -18, rom: 0, trust: -6 }); // 醫館該不該蓋
        pair('mk_feishu', 'mk_tuojie', { aff: 52, rom: 0, trust: 46 }, { aff: 48, rom: 0, trust: 42 }); // 酒桌上的消息
        pair('mk_asun', 'mk_asuan', { aff: 50, rom: 0, trust: 44 }, { aff: 48, rom: 0, trust: 40 }); // 攤棚與攤主
        pair('mk_caishu', 'mk_feishu', { aff: 30, rom: 0, trust: -8 }, { aff: 26, rom: 0, trust: -12 }); // 欠著的酒錢
        pair('mk_xinggu', 'mk_shuyi', { aff: 42, rom: 0, trust: 36 }, { aff: 40, rom: 0, trust: 34 }); // 書院與藥堂
        pair('mk_tuojie', 'mk_menshu', { aff: 30, rom: 16 }, { aff: 22, rom: 6 }); // 進城盤問三十次
        pair('mk_amiao', 'mk_asuan', { aff: 26, rom: 0, trust: 20 }, { aff: 28, rom: 8, trust: 18 }); // 菜攤的供貨
        this._seedCrossTownMemories();
    }

    // v5.27.0 肉鴿:隨機開局 —— 每一局抽一批全新村民 + 隨機愛恨關係網
    _loadRandomResidents(count = 15) {
        const usedNames = new Set();
        const rollName = (gender) => {
            const givens = gender === 'male' ? RANDOM_GIVEN_MALE : RANDOM_GIVEN_FEMALE;
            for (let tryN = 0; tryN < 40; tryN++) {
                const nm = pickRandom(RANDOM_SURNAMES) + pickRandom(givens);
                if (!usedNames.has(nm) && !RESERVED_NAMES.has(nm)) { usedNames.add(nm); return nm; } // v5.79.0 避開五鎮既有人名
            }
            return pickRandom(RANDOM_SURNAMES) + pickRandom(givens) + randInt(1, 9);
        };
        const homes = ['residential_north', 'residential_south', 'residential_east'];
        const jobKeys = Object.keys(JOB_DEFINITIONS).filter(k => k !== 'mayor');
        const bgPool = RANDOM_BG();
        const ids = [];
        for (let i = 0; i < count; i++) {
            const gender = Math.random() < 0.5 ? 'male' : 'female';
            const name = rollName(gender);
            const jobKey = i === 0 ? 'mayor' : pickRandom(jobKeys); // 第一位當鎮長,其餘隨機
            const age = i === 0 ? randInt(38, 55) : randInt(20, 52);
            const personality = Personality.random(3);
            personality.background = pickRandom(bgPool);
            const job = new Job(jobKey);
            const id = `rand_${i}`;
            const agent = new Agent(id, name, age, personality, job, pickRandom(homes), gender);
            this.addAgent(agent);
            ids.push(id);
        }
        this._seedRandomRelationships(ids);
    }

    // 隨機愛恨關係網:夫妻 / 前任 / 暗戀(含三角) / 世仇 / 摯友,一律不分性別
    _seedRandomRelationships(ids) {
        const A = this.agents;
        const pool = shuffle(ids.filter(id => A[id]));
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2 || from === to) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6); r.lastInteractionTick = 0;
        };
        const pair = (x, y, ox, oy) => { set(x, y, ox); set(y, x, oy); };
        let idx = 0;
        const take = (n = 1) => pool.slice(idx, idx += n);
        const gossips = [];
        // 💍 1 對恩愛夫妻
        if (pool.length >= 2) { const [a, b] = take(2); pair(a, b, { aff: 70, rom: 54, trust: 58, status: 'married' }, { aff: 68, rom: 52, trust: 56, status: 'married' }); }
        // 💔 1 對藕斷絲連的前任
        if (pool.length - idx >= 2) { const [a, b] = take(2); pair(a, b, { aff: 18, rom: 20, status: 'ex' }, { aff: 26, rom: 22, status: 'ex' }); gossips.push({ about: A[a].name, content: `${A[a].name}${t('和')}${A[b].name}${t('明明分了,見面卻還是躲躲閃閃...是還沒放下嗎?')}`, kind: 'crush' }); }
        // 💘 2~3 段暗戀,其中一段做成三角(兩人搶一人)
        const crushN = Math.min(3, Math.max(1, Math.floor((pool.length - idx) / 3)));
        for (let c = 0; c < crushN && pool.length - idx >= 2; c++) {
            const [a, b] = take(2);
            pair(a, b, { aff: 34 + randInt(0, 8), rom: 42 + randInt(0, 8) }, { aff: 20 + randInt(0, 10), rom: randInt(2, 14) });
            if (c === 0 && pool.length - idx >= 1) { // 三角:再找一人也暗戀 b
                const [rivalC] = take(1);
                set(rivalC, b, { aff: 30, rom: 44 });
                gossips.push({ about: A[b].name, content: `${A[a].name}${t('和')}${A[rivalC].name}${t('好像都對')}${A[b].name}${t('有意思,這下有得瞧了。')}`, kind: 'crush' });
            } else {
                gossips.push({ about: A[a].name, content: `${t('聽說')}${A[a].name}${t('偷偷喜歡著')}${A[b].name}${t('...')}`, kind: 'crush' });
            }
        }
        // ⚔️ 1~2 對世仇
        const feudN = Math.min(2, Math.max(1, Math.floor((pool.length - idx) / 4)));
        for (let f = 0; f < feudN && pool.length - idx >= 2; f++) {
            const [a, b] = take(2);
            pair(a, b, { aff: -42 - randInt(0, 12), trust: -28 }, { aff: -40 - randInt(0, 12), trust: -26 });
            gossips.push({ about: A[a].name, content: `${A[a].name}${t('和')}${A[b].name}${t('的樑子結很久了,一見面就火藥味十足。')}`, kind: 'rivalry' });
        }
        // 👯 剩下的隨機配幾對摯友
        while (pool.length - idx >= 2 && Math.random() < 0.7) {
            const [a, b] = take(2);
            pair(a, b, { aff: 58 + randInt(0, 12), trust: 40 }, { aff: 56 + randInt(0, 12), trust: 38 });
        }
        // 開局八卦頭條
        if (this.gossipNetwork) {
            for (const g of gossips.slice(0, 3)) {
                this.gossipNetwork.activeGossip.push({ about: g.about, content: g.content, source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: g.kind });
            }
        }
    }

    // v5.5.0 預設關係網:開局就種下暗戀/前任/世仇/摯友/夫妻,不必空等 30 天才有戲
    _seedRelationships() {
        const A = this.agents;
        const set = (from, to, { aff = 0, rom = 0, trust = 0, status = null } = {}) => {
            const f = A[from], t2 = A[to]; if (!f || !t2) return;
            const r = f.relationships.getOrCreate(t2.agentId, t2.name);
            r.affinity = aff; r.romanticInterest = rom; r.trust = trust;
            if (status) { r.status = status; r.statusSince = 0; }
            r.interactionCount = Math.max(r.interactionCount, 6);
            r.lastInteractionTick = 0;
        };
        const pair = (x, y, opts) => { set(x, y, opts.x); set(y, x, opts.y); };

        // 💌 劉俊 暗戀 許瑩(那些從沒寄出的情書)——單戀
        pair('liu_jun', 'xu_ying', { x: { aff: 42, rom: 48 }, y: { aff: 26, rom: 8 } });
        // 💗 張豪 暗戀 黃莉(害羞詩人愛上歌聲牧師)——微微雙向
        pair('zhang_hao', 'huang_li', { x: { aff: 38, rom: 44 }, y: { aff: 32, rom: 18 } });
        // 🛡️ 楊鋒 暗戀 林美(嫉妒守衛的心事),林美埋首工作
        pair('yang_feng', 'lin_mei', { x: { aff: 36, rom: 43 }, y: { aff: 22, rom: 6 } });
        // ⚔️ 吳達 vs 楊鋒(老礦工與前傭兵的舊怨)——世仇
        pair('wu_da', 'yang_feng', { x: { aff: -46, trust: -30 }, y: { aff: -44, trust: -28 } });
        // 👯 王麗 & 何秀 廚房八卦死黨;王麗 & 黃莉 摯友
        pair('wang_li', 'he_xiu', { x: { aff: 66 }, y: { aff: 66 } });
        pair('wang_li', 'huang_li', { x: { aff: 62 }, y: { aff: 58 } });
        // 💔 趙霞 & 馬強 前任(藕斷絲連)
        pair('zhao_xia', 'ma_qiang', { x: { aff: 16, rom: 18, status: 'ex' }, y: { aff: 28, rom: 24, status: 'ex' } });
        // 💍 何昌 & 何秀 恩愛老夫妻
        pair('he_chang', 'he_xiu', { x: { aff: 72, rom: 56, status: 'married', trust: 60 }, y: { aff: 70, rom: 54, status: 'married', trust: 58 } });
        // 🎸 周明 迷上 趙霞(威脅到馬強)——催化五角戀
        pair('zhou_ming', 'zhao_xia', { x: { aff: 34, rom: 40 }, y: { aff: 30, rom: 20 } });
        // 📚 鄭薇 暗戀 周明(算錯公式的原因)——單戀
        pair('zheng_wei', 'zhou_ming', { x: { aff: 30, rom: 46 }, y: { aff: 18, rom: 4 } });
        // 🌙 孫雨 傾心 林美(兩個夜貓子,焦慮學者與沉靜醫生)——雙向漸濃,且與楊鋒形成三角
        pair('sun_yu', 'lin_mei', { x: { aff: 40, rom: 46 }, y: { aff: 30, rom: 24 } });
        // 🎸 馬強 對周明又恨又迷(周明搶了他前任趙霞,偏偏那股魅力也讓他動搖)——愛恨交織
        pair('ma_qiang', 'zhou_ming', { x: { aff: -8, rom: 30 }, y: { aff: 10, rom: 4 } });
        // 🤝 陳偉(鎮長) & 楊鋒 老戰友互敬
        pair('chen_wei', 'yang_feng', { x: { aff: 54, trust: 40 }, y: { aff: 52, trust: 38 } });
        // v5.25.0 新村民包的開局鉤子 ——
        // 🧁 蘇晴 傾心 劉俊(早起農夫與糕點師傅),劉俊 心裡卻還有許瑩 → 新三角
        pair('su_qing', 'liu_jun', { x: { aff: 36, rom: 42 }, y: { aff: 30, rom: 20 } });
        // 🪖 高朗 & 吳達 生死之交(結盟對抗楊鋒,把舊怨燒成兩派)
        pair('gao_lang', 'wu_da', { x: { aff: 60, trust: 46 }, y: { aff: 58, trust: 44 } });
        // ⚔️ 高朗 看不慣楊鋒(袍澤情義使然)——開局微敵意
        pair('gao_lang', 'yang_feng', { x: { aff: -24, trust: -12 }, y: { aff: -18, trust: -10 } });
        // 🎶 高朗 暗戀 黃莉(鐵漢被歌聲融化),張豪也暗戀黃莉 → 情敵
        pair('gao_lang', 'huang_li', { x: { aff: 34, rom: 40 }, y: { aff: 20, rom: 4 } });
        // 🌌 柯薇 & 凌波 互相傾心(繡藝師與星象學者,夜裡最懂彼此)——雙向漸濃,likely 成雙
        pair('ke_wei', 'ling_bo', { x: { aff: 42, rom: 46 }, y: { aff: 38, rom: 40 } });
        // v5.79.0 擴編新人的鉤子
        pair('shi_lei', 'wu_da', { x: { aff: 52, trust: 44 }, y: { aff: 46, trust: 40 } });      // ⛏️ 師徒
        pair('shi_lei', 'zheng_wei', { x: { aff: 30, rom: 34 }, y: { aff: 14, rom: 2 } });      // 💭 礦工對學者的在意
        pair('shi_lei', 'gao_lang', { x: { aff: -18, trust: -10 }, y: { aff: -12, trust: -8 } }); // ⚔️ 礦場安全之爭
        pair('bai_lu', 'lin_mei', { x: { aff: 50, trust: 46 }, y: { aff: 44, trust: 40 } });    // 🩺 師徒
        pair('bai_lu', 'sun_yu', { x: { aff: 36, trust: 24 }, y: { aff: 32, trust: 20 } });     // 🌙 兩個怕事的年輕人
        pair('lao_xie', 'chen_wei', { x: { aff: 40, trust: 44 }, y: { aff: 38, trust: 36 } });  // ♟️ 老守衛與鎮長
        pair('lao_xie', 'he_xiu', { x: { aff: 30, rom: 0, trust: 20 }, y: { aff: 26, trust: 18 } }); // 🕰️ 沒人敢問的往事
        pair('xiao_man', 'zhang_hao', { x: { aff: 46, trust: 40 }, y: { aff: 40, trust: 34 } }); // 🔨 師徒
        pair('xiao_man', 'su_qing', { x: { aff: 44 }, y: { aff: 42 } });                          // 🧁 話癆與陽光
        pair('du_juan', 'wu_da', { x: { aff: 34, trust: 30 }, y: { aff: 40, trust: 28 } });     // 🐔 老礦工照看寡婦
        pair('ma_qiang', 'du_juan', { x: { aff: 24, rom: 22 }, y: { aff: 12, rom: 0 } });       // 😏 懶鬼的新目標
        // 開局八卦頭條:讓玩家一進來就嗅到戲
        if (this.gossipNetwork) {
            this.gossipNetwork.activeGossip.push(
                { about: A['zhou_ming']?.name, content: t('聽說新來的周明,好像跟趙霞走得很近...而馬強的臉色可不太好看。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
                { about: A['wu_da']?.name, content: t('吳達和楊鋒又在酒館互看不順眼了,他們的樑子結很久了。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'rivalry' },
                { about: A['lin_mei']?.name, content: t('聽說孫雨最近老往診所跑,林美醫生好像也不排斥她的陪伴...倒是守衛楊鋒的臉色越來越難看。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
                { about: A['gao_lang']?.name, content: t('新來的高朗是吳達的老袍澤,一來就跟楊鋒針鋒相對...酒館的火藥味濃得化不開。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'rivalry' },
                { about: A['su_qing']?.name, content: t('糕點師傅蘇晴的早餐總幫劉俊多留一份,可劉俊的心思好像還在許瑩身上...這下有得瞧了。'), source: t('鎮民'), spreadCount: 0, tickCreated: 0, isTrue: true, juicy: true, kind: 'crush' },
            );
        }
    }

    // --- v4.9.0 相鄰組合(開羅式):裝飾與有座標的建築放在一起觸發 ---
    getActiveCombos() {
        const items = (this.decorations || []).map(d => ({ kind: d.type, x: d.x, y: d.y }));
        for (const b of (this.buildings?.completed || [])) {
            if (b.buildingKey && Number.isFinite(b.siteX)) items.push({ kind: b.buildingKey, x: b.siteX + 1, y: b.siteY + 1 });
        }
        if (!items.length) return [];
        const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 4;
        return COMBO_DEFS.filter(c => {
            const anchors = items.filter(i => i.kind === c.parts[0]);
            return anchors.some(a => c.parts.slice(1).every(pk => items.some(i => i !== a && i.kind === pk && near(i, a))));
        });
    }
    checkCombos() {
        this.combosFound = this.combosFound || [];
        const newly = this.getActiveCombos().filter(c => !this.combosFound.includes(c.id));
        for (const c of newly) {
            this.combosFound.push(c.id);
            this.logMessage('building', `✨ ${t('發現相鄰組合：')}${c.icon}${c.name}(${c.desc})${t('！全鎮心情大好')}`);
            this.dailyNews?.collectEvent('building', `${t('小鎮出現了「')}${c.name}${t('」組合！')}`, 7);
            Object.values(this.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 6; });
            this.conversationEngine?.sendEventComment?.(this, `${t('小鎮出現了新組合「')}${c.name}${t('」(')}${c.desc})`);
        }
        if (newly.length) this._pendingComboNotifs = (this._pendingComboNotifs || []).concat(newly);
        return newly;
    }

    // --- v5.1.0 名場面直播:NPC 感情大事件時生成 AI 對話劇,推播給玩家吃瓜 ---
    queueDramaScene(kind, agentA, agentB, thirdName) {
        const meta = {
            confession: { icon: '💘', title: t('告白成功') },
            wedding:    { icon: '💍', title: t('婚禮現場') },
            busted:     { icon: '🔥', title: t('修羅場') },
            breakup:    { icon: '💔', title: t('分手現場') },
            divorce:    { icon: '⚡', title: t('離婚風暴') },
            // v5.42.0 衝突敘事
            feud:       { icon: '🗯️', title: t('廣場對嗆') },
            severance:  { icon: '💢', title: t('絕交現場') },
            reconcile:  { icon: '🕊️', title: t('世紀大和解') },
        }[kind];
        if (!meta || !agentA || !agentB) return;
        Promise.resolve(this.conversationEngine?.generateDramaScene?.(this, kind, meta, agentA, agentB, thirdName)).catch(() => {});
    }

    // --- v5.3.0 本週小鎮頭條:把浮現的愛恨糾葛整理成可讀摘要,每 7 天推播 ---
    generateWeeklyDigest() {
        const couples = [], newCouples = [], crushes = [], rivals = [], triangles = [];
        const seen = new Set();
        const prevCouples = new Set(this._lastDigestCouples || []);
        const nowCouples = new Set();
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead) continue;
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                const other = this.agents[tid];
                if (!other || other.isPlayer || other.isDead) continue;
                const key = [a.agentId, tid].sort().join('|');
                if (rel.status === 'married' || rel.status === 'dating') {
                    nowCouples.add(key);
                    if (!seen.has(key)) {
                        seen.add(key);
                        const icon = rel.status === 'married' ? '💍' : '💗';
                        const line = `${icon} ${a.name} × ${other.name}`;
                        if (!prevCouples.has(key)) newCouples.push(line); else couples.push(line);
                    }
                } else if (rel.romanticInterest > 45 && a.agentId < tid) {
                    crushes.push(`💘 ${a.name} ${t('暗戀著')} ${other.name}`);
                } else if (rel.affinity <= -25 && a.agentId < tid) {
                    rivals.push(`⚔️ ${a.name} ${t('與')} ${other.name} ${t('勢不兩立')}`);
                }
            }
        }
        // 三角戀:兩人暗戀同一人
        const crushMap = {};
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead) continue;
            for (const [tid, rel] of Object.entries(a.relationships.relationships)) {
                if (rel.romanticInterest > 40) { (crushMap[tid] = crushMap[tid] || []).push(a.name); }
            }
        }
        for (const [tid, admirers] of Object.entries(crushMap)) {
            if (admirers.length >= 2) {
                const target = this.agents[tid];
                if (target && !target.isPlayer) triangles.push(`🔺 ${admirers.slice(0,3).join(t('、'))} ${t('都喜歡')} ${target.name}`);
            }
        }
        this._lastDigestCouples = [...nowCouples];
        // v5.4.0 夢想進行中:挑最接近實現夢想的村民(階段最高、未完成)
        const dreams = [];
        if (this.lifeGoals) {
            const arr = [];
            for (const a of Object.values(this.agents)) {
                if (a.isPlayer || a.isDead) continue;
                const d = this.lifeGoals.describe(a.agentId);
                if (d && !d.done && d.stage > 0) arr.push({ name: a.name, d });
            }
            arr.sort((x, y) => y.d.stage - x.d.stage);
            for (const { name, d } of arr.slice(0, 3)) dreams.push(`${d.icon} ${name} ${t('正在追逐「')}${d.name}${t('」:')}${d.stageName}`);
        }
        const hasContent = newCouples.length || crushes.length || rivals.length || triangles.length || couples.length || dreams.length;
        if (!hasContent) return null;
        const digest = {
            week: `${this.clock.year}-${this.clock.season}-${this.clock.day}`,
            newCouples, couples: couples.slice(0, 4), crushes: crushes.slice(0, 5),
            rivals: rivals.slice(0, 4), triangles: triangles.slice(0, 3), dreams,
        };
        this._pendingWeeklyDigest = digest;
        return digest;
    }

    // --- v5.2.0 鎮民動態:每天挑 2 位村民發文(第 1 篇嘗試 AI,其餘模板) ---
    generateDailyFeedPosts() {
        if (!this.townFeed) return;
        const npcs = Object.values(this.agents).filter(a => !a.isPlayer && !a.isDead);
        if (!npcs.length) return;
        const posters = [...npcs].sort(() => Math.random() - 0.5).slice(0, 2);
        posters.forEach((npc, i) => {
            Promise.resolve(this.conversationEngine?.generateFeedPost?.(this, npc, i === 0)).catch(() => {});
        });
    }

    // v5.15.0 每日處理記憶想法:過期清除 + 對特定對象的好感每天漂移(RimWorld 式持久 opinion)
    _processThoughts() {
        const today = this.clock.totalDays || 0;
        for (const a of Object.values(this.agents)) {
            if (a.isPlayer || a.isDead || !a.thoughts?.length) continue;
            a.thoughts = a.thoughts.filter(th => (today - th.start) < th.days); // 清過期
            for (const th of a.thoughts) {
                if (th.opinion && th.targetId) {
                    const rel = a.relationships.relationships[th.targetId];
                    if (rel) rel.modifyAffinity(th.opinion); // 記憶還在→每天持續影響好感
                }
            }
        }
    }

    // --- v5.0.0 心動事件:每個 NPC 每個門檻只觸發一次,一次只發一件 ---
    checkHeartEvents() {
        if (this._heartEventBusy) return;
        this.heartEventsFired = this.heartEventsFired || {};
        const player = Object.values(this.agents).find(a => a.isPlayer);
        if (!player || !this.conversationEngine?.fireHeartEvent) return;
        for (const npc of Object.values(this.agents)) {
            if (npc.isPlayer || npc.isDead) continue;
            const rel = npc.relationships.relationships[player.agentId];
            if (!rel) continue;
            const fired = this.heartEventsFired[npc.agentId] = this.heartEventsFired[npc.agentId] || [];
            for (const ev of HEART_EVENTS) {
                if (fired.includes(ev.id)) continue;
                if (ev.min.affinity !== undefined && rel.affinity < ev.min.affinity) continue;
                if (ev.min.romantic !== undefined && rel.romanticInterest < ev.min.romantic) continue;
                fired.push(ev.id);
                this._heartEventBusy = true;
                Promise.resolve(this.conversationEngine.fireHeartEvent(this, npc, ev))
                    .catch(() => {})
                    .finally(() => { this._heartEventBusy = false; });
                return; // 一次只觸發一件,避免轟炸
            }
        }
    }

    // --- Save / Load ---
    serialize() {
        const serializeAgent = (a) => ({
            id:a.agentId, name:a.name, age:a.age, gender:a.gender, isPlayer:a.isPlayer,
            _isPlayerChild: a._isPlayerChild || false, _parentNames: a._parentNames || null,
            jobKey: a.job?.key || null,
            nameEn: a.nameEn || undefined, // v5.81.0 自訂村民英文名
            look: a.look || undefined, // v5.89.0 自訂外觀
            homeLocation: a.homeLocation, currentLocation: a.currentLocation,
            mood: a.mood, activity: a.activity, currentThought: a.currentThought,
            personality: { traits:a.personality.traits, background:a.personality.background, values:a.personality.values },
            needs: { hunger:a.needs.hunger, rest:a.needs.rest, social:a.needs.social, comfort:a.needs.comfort, recreation:a.needs.recreation, beauty:a.needs.beauty },
            skills: Object.fromEntries(Object.entries(a.skills.skills).map(([k,s])=>[k,{xp:s.xp,passion:s.passion}])),
            relationships: Object.fromEntries(Object.entries(a.relationships.relationships).map(([k,r])=>[k,{
                targetId:r.targetId, targetName:r.targetName, affinity:r.affinity, trust:r.trust,
                romanticInterest:r.romanticInterest, interactionCount:r.interactionCount,
                lastInteractionTick:r.lastInteractionTick, sharedMemories:r.sharedMemories.slice(-10000),
                status:r.status, statusSince:r.statusSince, isCheating:r.isCheating, isFeud:r.isFeud || undefined
            }])),
            memory: a.memory.entries.slice(-10000).map(m=>({tick:m.tick,timeStr:m.timeStr,category:m.category,content:m.content,importance:m.importance,relatedAgents:m.relatedAgents})),
            chatHistory: a.isPlayer ? (a.chatHistory||[]).slice(-10000) : undefined,
            _lastInteractionTick: a._lastInteractionTick,
            _locationStayRemaining: a._locationStayRemaining || 0,
            _mourningTargets: a._mourningTargets || [],
            _annualMourning: a._annualMourning || [],
            thoughts: (a.thoughts || []).map(t2 => ({ ...t2 })), // v5.15.0 記憶想法
            attributes: { ...(a.attributes || {}) }, // v5.26.0 核心屬性
            dailyPlan: a.dailyPlan ? { key: a.dailyPlan.key, goals: [...a.dailyPlan.goals], blocks: a.dailyPlan.blocks ? a.dailyPlan.blocks.map(b => ({ time: b.time, text: b.text, steps: [...(b.steps || [])] })) : undefined, llm: a.dailyPlan.llm || undefined } : null, // v5.30.0 今日目標 / v5.37.0 LLM 分解行程
            currently: a.currently || undefined, // v5.37.0 LLM 每日修訂的近況
            todayTrace: (a.todayTrace && a.todayTrace.length) ? a.todayTrace.slice(-160).map(e => ({ ...e })) : undefined, // v5.40.0 今日足跡
            _traceDay: a._traceDay || undefined,
        });
        return {
            version: 2,
            _legacyGeneration: this._legacyGeneration || 1,
            savedAt: new Date().toISOString(),
            clock: { day:this.clock.day, hour:this.clock.hour, minute:this.clock.minute, season:this.clock.season, year:this.clock.year },
            tickCount: this.tickCount,
            paused: this.paused,
            messageLog: this.messageLog.slice(-1000),
            townMap: this.townMap ? { seed:this.townMap.seed, terrain:this.townMap.terrain, width:this.townMap.width, height:this.townMap.height,
                locations: Object.fromEntries(Object.entries(this.townMap.locations).map(([k,v])=>[k,{id:v.id,name:v.name,description:v.description,x:v.x,y:v.y,category:v.category,capacity:v.capacity}])) } : null,
            agents: Object.fromEntries(Object.entries(this.agents).map(([k,a])=>[k,serializeAgent(a)])),
            // v5.29.0 AI 對話紀錄以文字形式持久化(含每則對話全文),反思則隨 agent.memory 一起存
            npcConversationLog: this.conversationEngine.npcConversationLog.slice(-400).map(c => ({ ...c, dialogue: (c.dialogue || []).map(d => ({ ...d })) })),
            npcLlmUsedToday: this.npcLlmUsedToday || 0,
            feudCooldown: { ...(this._feudCooldown || {}) }, // v5.42.0 對嗆冷卻
            mediations: JSON.parse(JSON.stringify(this.mediations || {})), // v5.42.0 和解進度
            workPolicy: { ...(this.workPolicy || {}) }, // v5.51.0 勞動力排班
            townTheme: this.townTheme || 'frontier', // v5.55.0 主題城鎮
            visitors: JSON.parse(JSON.stringify(this.visitors || {})), // v5.56.0 在鎮訪客名單
            townName: this.townName || '', // v5.58.0 鎮名
            lastCaravanDay: this.lastCaravanDay ?? null, // v5.80.0 跨鎮商隊
            caravanCount: this.caravanCount || 0, harborFlags: { ...(this.harborFlags || {}) }, // v5.84.0
            visitCounts: { ...(this.visitCounts || {}) }, movedOut: (this.movedOut || []).slice(-20), // v5.90.0
            bargainUntilAbsDay: this.bargainUntilAbsDay || 0, // v5.95.0

            playerActions: (this.playerActions || []).slice(-60).map(a => ({ ...a })), // v5.45.0 蝴蝶效應
            dailyEcho: [...(this.dailyEcho || [])], // v5.45.0 昨日回響
            dailyFocus: this.dailyFocus ? { key: this.dailyFocus.key, items: this.dailyFocus.items.map(i => ({ ...i })) } : null, // v5.31.0 今日焦點
            gossip: this.gossipNetwork.activeGossip.slice(-10000),
            townFeed: this.townFeed ? this.townFeed.serialize() : null,
            events: {
                eventLog: this.events.eventLog.slice(-10000),
                activeEffects: {...this.events.activeEffects},
                conversationTopics: [...this.events.conversationTopics],
                _activeChains: this.events._activeChains.map(c=>({...c})),
                _travellingAgents: this.events._travellingAgents.map(t=>({agentData:{...t.agentData},returnTick:t.returnTick,reason:t.reason})),
                _daysSinceRaid: this.events._daysSinceRaid,
                _daysSinceChain: this.events._daysSinceChain,
                _daysSinceDeparture: this.events._daysSinceDeparture,
                _usedImmigrantNames: [...this.events._usedImmigrantNames],
            },
            stockpile: { resources:{...this.stockpile.resources}, history:this.stockpile.history.slice(-600) },
            buildings: { projects:this.buildings.projects.map(p=>({...p})), completed:this.buildings.completed.map(p=>({...p})), activeEffects:{...this.buildings.activeEffects}, _counter:this.buildings._counter },
            trade: { merchant:this.trade.merchant?{...this.trade.merchant,offers:this.trade.merchant.offers.map(o=>({...o}))}:null, _daysSince:this.trade._daysSince, tradeHistory:this.trade.tradeHistory.slice(-10) },
            research: { projects:Object.fromEntries(Object.entries(this.research.projects).map(([k,p])=>[k,{...p}])), current:this.research.current },
            workOrders: { orders:this.workOrders.orders.map(o=>({...o})), _counter:this.workOrders._counter },
            news: { bulletins:this.news.bulletins.map(b=>({...b})), activeModifiers:{...this.news.activeModifiers}, _lastPublishDay:this.news._lastPublishDay },
            election: this.election.toDict(),
            factions: this.factions.toDict(),
            festivals: this.festivals.toDict(),
            lifecycle: this.lifecycle.toDict(),
            exploration: this.exploration.toDict(),
            decorations: this.decorations || [],
            combosFound: this.combosFound || [],
            heartEventsFired: this.heartEventsFired || {},
            industry: this.industry.serialize(),
            farm: this.farm.serialize(),
            processing: this.processing.serialize(),
            dailyNews: this.dailyNews.serialize(),
            townIdentity: this.townIdentity.serialize(),
            dramaArchive: (this.dramaArchive || []).slice(-40),
            npcEvents: this.npcEvents.serialize(),
            questSystem: this.questSystem ? this.questSystem.serialize() : null,
            requests: this.requests ? this.requests.serialize() : null, // v5.91.0
            playerCaravan: this.playerCaravan ? { active: this.playerCaravan.active, history: (this.playerCaravan.history || []).slice(-10), pendingInjury: this.playerCaravan.pendingInjury || null, totals: this.playerCaravan.totals || null } : null, // v5.92.0
            trials: this.trials ? this.trials.serialize() : null, // v5.93.0
            growth: this.growth ? this.growth.serialize() : null, // v5.94.0
            recap: this.recap ? this.recap.serialize() : null, // v5.98.0
            prosperity: this.prosperity ? this.prosperity.serialize() : null,
            npcQuests: this.npcQuests ? this.npcQuests.serialize() : null,
            lifeGoals: this.lifeGoals ? this.lifeGoals.serialize() : null,
            customNPC: this.customNPC ? this.customNPC.serialize() : null,
            multiEnding: this.multiEnding ? this.multiEnding.serialize() : null,
            // v4.0
            dailyDecision: this.dailyDecision.serialize(),
            shop: this.shop.serialize(),
            eventChoice: this.eventChoice.serialize(),
            npcHelp: this.npcHelp.serialize(),
            reputationSystem: this.reputationSystem.serialize(),
            weather: this.weather.serialize(),
            council: this.council.serialize(),
        };
    }

    // v5.67.4 全存檔清理:AI 中繼曾把「I'm Kiro, an AI development environment…」這類拒絕/自報身分的句子
    // 當成村民台詞回來,已經寫進聊天紀錄、村民對話、記憶、行程、名場面、新聞。載入時深度掃描整份存檔,
    // 命中的字串/條目移除,回傳清掉的筆數。伺服器端(/api/chat)自 v5.67.2 起已擋新產生的,這裡清舊的。
    static looksLikeAssistantLeak(text) {
        const s = String(text || '').trim();
        if (!s || s.length < 8) return false;
        const re = /\b(I'?m|I am) (Kiro|Claude|ChatGPT|an AI|a language model|an assistant)\b|AI (development environment|assistant|language model)|not designed for (roleplay|role-play|fictional)|can'?t (take on|engage in|roleplay|role-play) |fictional character personas?|I can'?t do this|I'?m (here|designed) to help with (coding|software|technical)|我是(一個)?(AI|人工智慧|語言模型|程式開發)|無法(進行|扮演)角色|不能扮演/i;
        if (!re.test(s)) return false;
        const ascii = (s.match(/[A-Za-z]/g) || []).length;
        return ascii / s.length > 0.5 || /Kiro|AI (development|assistant)|roleplay|role-play/i.test(s) || /我是(一個)?(AI|人工智慧|語言模型)/.test(s);
    }
    static scrubAssistantLeaks(root) {
        let removed = 0;
        const leak = World.looksLikeAssistantLeak;
        // v5.67.5 順便把 AI 回成簡體的台詞轉成繁體(台灣用字);只轉偵測為簡體的字串
        const S2T = (typeof RIMTOWN_S2T !== 'undefined') ? RIMTOWN_S2T : null;
        const fixCn = (s) => (S2T && S2T.looksSimplified(s)) ? (World._s2tCount = (World._s2tCount || 0) + 1, S2T.convert(s)) : s;
        const walk = (node, depth) => {
            if (!node || typeof node !== 'object' || depth > 12) return node;
            if (Array.isArray(node)) {
                const out = [];
                for (const item of node) {
                    if (typeof item === 'string') { if (leak(item)) { removed++; continue; } out.push(fixCn(item)); continue; }
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        // 條目型物件:任一文字欄位命中就整條丟掉(台詞/記憶/新聞/名場面/行程區塊)
                        const textKeys = ['text', 'content', 'summary', 'reply', 'message', 'line', 'title', 'body', 'desc', 'description', 'thought', 'reflection', 'headline'];
                        if (textKeys.some(k => typeof item[k] === 'string' && leak(item[k]))) { removed++; continue; }
                    }
                    out.push(walk(item, depth + 1));
                }
                return out;
            }
            for (const k of Object.keys(node)) {
                const v = node[k];
                if (typeof v === 'string') { if (leak(v)) { node[k] = ''; removed++; } else node[k] = fixCn(v); }
                else if (v && typeof v === 'object') node[k] = walk(v, depth + 1);
            }
            return node;
        };
        walk(root, 0);
        return removed;
    }

    loadSave(data) {
        if (!data || !data.version) return false;
        try {
            try {
                World._s2tCount = 0;
                const n = World.scrubAssistantLeaks(data);
                if (n) { this._scrubbedLeaks = n; console.warn('[RimTown] 已清除', n, '則 AI 助理漏出的錯誤回覆'); }
                if (World._s2tCount) { this._s2tFixed = World._s2tCount; console.warn('[RimTown] 已把', World._s2tCount, '段簡體字轉成繁體'); }
            } catch (e) {}
            // Clock
            this.clock.day=data.clock.day; this.clock.hour=data.clock.hour; this.clock.minute=data.clock.minute;
            this.clock.season=data.clock.season; this.clock.year=data.clock.year;
            this.tickCount = data.tickCount;
            this._legacyGeneration = data._legacyGeneration || 1;
            this.paused = data.paused || false;
            this.messageLog = (data.messageLog || []).slice(-1000); // v5.99.0

            // Town map
            if (data.townMap) {
                this.townMap = new TownMap(data.townMap.seed);
                this.townMap.terrain = data.townMap.terrain;
                this.townMap.width = data.townMap.width; this.townMap.height = data.townMap.height;
                for (const [k,v] of Object.entries(data.townMap.locations)) this.townMap.addLocation(v);
            }

            // Agents
            this.agents = {};
            for (const [id, ad] of Object.entries(data.agents)) {
                const personality = new Personality(ad.personality.traits, ad.personality.background, ad.personality.values);
                const job = ad.jobKey ? new Job(ad.jobKey) : null;
                let agent;
                if (ad.isPlayer) {
                    agent = new PlayerAgent(ad.name, ad.age);
                    agent.personality = personality;
                    if (job) agent.job = job;
                    agent.chatHistory = ad.chatHistory || [];
                } else {
                    agent = new Agent(id, ad.name, ad.age, personality, job, ad.homeLocation);
                }
                agent.currentLocation = ad.currentLocation;
                if (ad.nameEn) { agent.nameEn = ad.nameEn; if (typeof I18N !== 'undefined' && I18N.registerName) I18N.registerName(ad.name, ad.nameEn); } // v5.81.0
                if (ad.look && typeof ad.look === 'object') agent.look = { ...ad.look }; // v5.89.0
                if (ad.gender) agent.gender = ad.gender;
                if (ad._isPlayerChild) { agent._isPlayerChild = true; agent._parentNames = ad._parentNames; }
                agent.mood = ad.mood; agent.activity = ad.activity;
                agent.moodModifier = ad.moodModifier || 0;
                agent.currentThought = ad.currentThought || '';
                agent._lastInteractionTick = ad._lastInteractionTick || 0;
                agent._locationStayRemaining = ad._locationStayRemaining || 0;
                agent._mourningTargets = ad._mourningTargets || [];
                agent._annualMourning = ad._annualMourning || [];
                agent.thoughts = Array.isArray(ad.thoughts) ? ad.thoughts : []; // v5.15.0 記憶想法
                if (ad.attributes && Object.keys(ad.attributes).length) agent.attributes = { ...ad.attributes }; // v5.26.0 核心屬性
                if (ad.dailyPlan) agent.dailyPlan = ad.dailyPlan; // v5.30.0 今日目標(v5.37.0 含 LLM blocks)
                if (ad.currently) agent.currently = ad.currently; // v5.37.0 近況
                if (Array.isArray(ad.todayTrace)) { agent.todayTrace = ad.todayTrace; agent._traceDay = ad._traceDay || ''; } // v5.40.0 今日足跡

                // Needs
                if (ad.needs) { Object.assign(agent.needs, ad.needs); }
                // Skills
                if (ad.skills) {
                    for (const [sk,sv] of Object.entries(ad.skills)) {
                        const s = agent.skills.get(sk);
                        if (s) { s.xp = sv.xp; s.passion = sv.passion; }
                    }
                }
                // Relationships
                if (ad.relationships) {
                    for (const [rk,rv] of Object.entries(ad.relationships)) {
                        const rel = agent.relationships.getOrCreate(rv.targetId, rv.targetName);
                        rel.affinity = rv.affinity; rel.trust = rv.trust;
                        rel.romanticInterest = rv.romanticInterest;
                        rel.interactionCount = rv.interactionCount;
                        rel.lastInteractionTick = rv.lastInteractionTick;
                        rel.sharedMemories = rv.sharedMemories || [];
                        rel.status = rv.status || null;
                        rel.statusSince = rv.statusSince || 0;
                        rel.isCheating = rv.isCheating || false;
                        rel.isFeud = rv.isFeud || false; // v5.42.0 絕交標記
                    }
                }
                // Memory
                if (ad.memory) {
                    ad.memory.forEach(m => agent.memory.add(m.tick, m.timeStr, m.category, m.content, m.importance, m.relatedAgents));
                }
                this.agents[id] = agent;
            }

            // v5.29.0 AI 對話紀錄還原(文字形式持久化)
            if (Array.isArray(data.npcConversationLog)) this.conversationEngine.npcConversationLog = data.npcConversationLog.slice(-400); // v5.99.0 舊檔讀入即收斂
            this.npcLlmUsedToday = data.npcLlmUsedToday || 0;
            this._feudCooldown = data.feudCooldown || {}; // v5.42.0
            this.mediations = data.mediations || {}; // v5.42.0
            this.workPolicy = data.workPolicy || {}; // v5.51.0
            this.townTheme = data.townTheme || 'frontier'; // v5.55.0 主題城鎮
            this.visitors = data.visitors || {}; // v5.56.0 在鎮訪客
            this.lastCaravanDay = data.lastCaravanDay ?? null; // v5.80.0
            this.caravanCount = data.caravanCount || 0; this.harborFlags = data.harborFlags || {}; // v5.84.0
            this.visitCounts = data.visitCounts || {}; this.movedOut = Array.isArray(data.movedOut) ? data.movedOut : []; // v5.90.0
            this.bargainUntilAbsDay = data.bargainUntilAbsDay || 0; // v5.95.0
            this.townName = data.townName || (TOWN_THEMES[this.townTheme]?.townName) || '邊境鎮'; // v5.59.5 舊檔沒鎮名時依主題補上,不再殘留上一鎮的名字
            this._chronicleChatIdx = (this.agents['player']?.chatHistory || []).length; // v5.43.0 讀檔後從當下開始記
            this.playerActions = data.playerActions || []; // v5.45.0
            this.dailyEcho = data.dailyEcho || []; // v5.45.0
            // v5.47.0 BUG-01 舊檔修復:清除「名字=索引」的壞關係(返鄉還原 bug 產生的 targetName "0"/"1")
            try {
                for (const a of Object.values(this.agents)) {
                    for (const [rid, r] of Object.entries(a.relationships?.relationships || {})) {
                        if (/^\d+$/.test(String(r.targetName || '')) || /^\d+$/.test(String(rid))) {
                            delete a.relationships.relationships[rid];
                        }
                    }
                }
            } catch (e) {}
            // v5.59.1 存檔沒有焦點就清空——原本的 if 會讓上一個鎮的焦點(「去找陳偉聊聊天」)殘留到新鎮
            this.dailyFocus = data.dailyFocus || null; // v5.31.0 今日焦點

            // Gossip
            this.gossipNetwork = new GossipNetwork();
        this.townFeed = new TownFeedSystem(); // v5.2.0 鎮民動態
            this.gossipNetwork.activeGossip = data.gossip || [];
            if (this.townFeed) this.townFeed.load(data.townFeed);

            // Events
            this.events = new EventSystem();
            if (data.events) {
                this.events.eventLog = data.events.eventLog || [];
                this.events.activeEffects = data.events.activeEffects || {};
                this.events.conversationTopics = data.events.conversationTopics || [];
                this.events._activeChains = data.events._activeChains || [];
                this.events._travellingAgents = data.events._travellingAgents || [];
                this.events._daysSinceRaid = data.events._daysSinceRaid ?? 5;
                this.events._daysSinceChain = data.events._daysSinceChain ?? 5;
                this.events._daysSinceDeparture = data.events._daysSinceDeparture ?? 3;
                this.events._usedImmigrantNames = new Set(data.events._usedImmigrantNames || []);
            }

            // Stockpile
            this.stockpile = new Stockpile();
            if (data.stockpile) { this.stockpile.resources = {...data.stockpile.resources}; this.stockpile.history = (data.stockpile.history || []).slice(-600); }

            // Buildings
            this.buildings = new BuildingManager();
        this.decorations = this.decorations || []; // v4.8.0 玩家擺放的裝飾 [{type,x,y}]
        this.combosFound = this.combosFound || []; // v4.9.0 已發現的相鄰組合 id
        this.heartEventsFired = this.heartEventsFired || {}; // v5.0.0 已觸發的心動事件 {npcId:[eventId]}
            if (data.buildings) {
                this.buildings.projects = data.buildings.projects || [];
                this.buildings.completed = (data.buildings.completed || []).map(b => {
                    if (!b.buildingKey) {
                        // Legacy save: resolve buildingKey from name
                        for (const [key, tmpl] of Object.entries(BUILDING_TEMPLATES)) {
                            if (tmpl.name === b.name) { b.buildingKey = key; break; }
                        }
                    }
                    if (!b.level) b.level = 1;
                    return b;
                });
                this.buildings.activeEffects = data.buildings.activeEffects || {};
                this.buildings._counter = data.buildings._counter || 0;
            }

            // Trade
            this.trade = new TradeManager();
            if (data.trade) {
                this.trade.merchant = data.trade.merchant;
                this.trade._daysSince = data.trade._daysSince || 0;
                this.trade.tradeHistory = data.trade.tradeHistory || [];
            }

            // Research
            this.research = new ResearchManager();
            if (data.research) {
                for (const [k,p] of Object.entries(data.research.projects)) {
                    if (this.research.projects[k]) Object.assign(this.research.projects[k], p);
                }
                this.research.current = data.research.current;
            }

            // Work orders
            this.workOrders = new WorkOrderManager();
            if (data.workOrders) { this.workOrders.orders = data.workOrders.orders || []; this.workOrders._counter = data.workOrders._counter || 0; }

            // News
            this.news = new NewsSystem();
            if (data.news) {
                this.news.bulletins = data.news.bulletins || [];
                this.news.activeModifiers = data.news.activeModifiers || {};
                this.news._lastPublishDay = data.news._lastPublishDay || 0;
            }

            // Election
            this.election = new ElectionSystem();
            if (data.election) this.election.loadFrom(data.election);

            // Factions
            this.factions = new FactionSystem();
            if (data.factions) {
                this.factions._counter = data.factions._counter || 0;
                this.factions._daysSinceCheck = data.factions._daysSinceCheck || 0;
                if (data.factions.factions) {
                    for (const [id, fd] of Object.entries(data.factions.factions)) {
                        const f = new Faction(fd.id, fd.type, fd.founderName);
                        f.name = fd.name; f.icon = fd.icon;
                        f.members = fd.members || [];
                        f.formedTick = fd.formedTick || 0;
                        f.cohesion = fd.cohesion ?? 50;
                        f.rivalFactionId = fd.rivalFactionId || null;
                        f.allyFactionId = fd.allyFactionId || null;
                        this.factions.factions[id] = f;
                    }
                }
            }

            // Festivals
            this.festivals = new FestivalSystem();
            if (data.festivals) {
                this.festivals.activeFestival = data.festivals.activeFestival || null;
                this.festivals.festivalLog = data.festivals.festivalLog || [];
                this.festivals.activeQuest = data.festivals.activeQuest || null;
                this.festivals._lastFestivalSeason = data.festivals._lastFestivalSeason || null;
                this.festivals._gameRewardKey = data.festivals._gameRewardKey || null;
            }

            // Lifecycle
            this.lifecycle = new LifecycleSystem();
            if (data.lifecycle) {
                this.lifecycle.graveyard = data.lifecycle.graveyard || [];
                this.lifecycle.births = data.lifecycle.births || [];
                this.lifecycle.playerChildren = data.lifecycle.playerChildren || [];
                this.lifecycle._daysSinceCheck = data.lifecycle._daysSinceCheck || 0;
            }

            // Exploration
            this.exploration = new ExplorationSystem();
            if (data.exploration) {
                this.exploration.discoveredZones = data.exploration.discoveredZones || {};
                this.exploration.activeExpeditions = data.exploration.activeExpeditions || [];
                this.exploration.expeditionLog = data.exploration.expeditionLog || [];
                this.exploration._counter = data.exploration._counter || 0;
            }

            // v3 systems
            this.industry = new IndustryManager();
            if (data.industry) this.industry.loadFrom(data.industry);
            this.farm = new FarmSystem();
            if (data.farm) this.farm.loadFrom(data.farm);
            this.processing = new ProcessingSystem();
            if (data.processing) this.processing.loadFrom(data.processing);
            this.dailyNews = new DailyNewsEngine();
            this.requests = (typeof RequestBoard !== 'undefined') ? new RequestBoard() : null; // v5.91.0 委託板
            this.playerCaravan = { active: null, history: [], pendingInjury: null }; // v5.92.0 押商隊
            this.trials = (typeof SeasonTrials !== 'undefined') ? new SeasonTrials() : null; // v5.93.0 季度考驗
            this.growth = (typeof TravellerGrowth !== 'undefined') ? new TravellerGrowth() : null; // v5.94.0 旅人成長
            this.recap = (typeof SeasonRecap !== 'undefined') ? new SeasonRecap() : null; // v5.98.0 季末回顧
            this.townIdentity = new TownIdentitySystem(); // v5.19.0 城鎮身分/路線
            if (data.dailyNews) this.dailyNews.loadFrom(data.dailyNews);
            if (data.townIdentity) this.townIdentity.load(data.townIdentity);
            this.dramaArchive = Array.isArray(data.dramaArchive) ? data.dramaArchive : [];
            this.npcEvents = new NPCEventSystem();
            if (data.npcEvents) this.npcEvents.loadFrom(data.npcEvents);
            // v5.63.0 任務系統一律重建再讀:存檔沒任務資料時不再殘留上一鎮的任務狀態
            if (typeof QuestSystem !== 'undefined') this.questSystem = new QuestSystem();
            if (this.questSystem) this.questSystem.theme = this.townTheme || 'frontier'; // v5.83.0 先定主題再讀進度
            if (this.questSystem && data.questSystem) this.questSystem.loadFrom(data.questSystem);
            if (this.requests && data.requests) this.requests.loadFrom(data.requests); // v5.91.0
            if (this.trials && data.trials) this.trials.loadFrom(data.trials); // v5.93.0
            if (this.growth && data.growth) this.growth.loadFrom(data.growth); // v5.94.0
            if (this.recap && data.recap) this.recap.loadFrom(data.recap); // v5.98.0
            if (data.playerCaravan) this.playerCaravan = { active: data.playerCaravan.active || null, history: Array.isArray(data.playerCaravan.history) ? data.playerCaravan.history : [], pendingInjury: data.playerCaravan.pendingInjury || null, totals: data.playerCaravan.totals || null }; // v5.92.0
            if (this.prosperity && data.prosperity) this.prosperity.loadFrom(data.prosperity);
            if (this.npcQuests && data.npcQuests) this.npcQuests.loadFrom(data.npcQuests);
            if (this.lifeGoals && data.lifeGoals) this.lifeGoals.load(data.lifeGoals);
            if (this.customNPC && data.customNPC) this.customNPC.loadFrom(data.customNPC);
            if (this.multiEnding && data.multiEnding) this.multiEnding.loadFrom(data.multiEnding);
            // v4.0 systems
            if (data.dailyDecision) this.dailyDecision.loadFrom(data.dailyDecision);
            this.decorations = Array.isArray(data.decorations) ? data.decorations : [];
            this.combosFound = Array.isArray(data.combosFound) ? data.combosFound : [];
            this.heartEventsFired = (data.heartEventsFired && typeof data.heartEventsFired === 'object') ? data.heartEventsFired : {};
            if (data.shop) this.shop.loadFrom(data.shop);
            if (data.eventChoice) this.eventChoice.loadFrom(data.eventChoice);
            // v5.82.0 際遇卡已移除:舊檔的 rogueCards 欄位直接忽略
            if (data.npcHelp) this.npcHelp.loadFrom(data.npcHelp);
            if (data.reputationSystem) this.reputationSystem.loadFrom(data.reputationSystem);
            if (data.weather) this.weather.loadFrom(data.weather);
            if (data.council) this.council.loadFrom(data.council);

            this.logMessage('system', t('遊戲讀取成功！'));
            return true;
        } catch(e) {
            console.error('Failed to load save:', e);
            return false;
        }
    }
}

// --- Utility Functions ---
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
// v5.67.6 玩家稱謂:玩家是旅人,只有當選(job.key === 'mayor')才是鎮長。所有提到玩家身分的文案一律用這個,
// 不再寫死「鎮長」——寫死的句子進了村民記憶,AI 對話就會跟著叫旅人「鎮長」。
function playerTitle(world) {
    const p = world && world.agents && (world.agents['player'] || Object.values(world.agents).find(a => a && a.isPlayer));
    return (p && p.job && p.job.key === 'mayor') ? t('鎮長') : t('旅人');
}
function mayorNameOf(world) {
    const m = world && world.agents && Object.values(world.agents).find(a => a && !a.isPlayer && !a.isDead && a.job && a.job.key === 'mayor');
    return m ? m.name : '';
}
if (typeof globalThis !== 'undefined') { globalThis.playerTitle = playerTitle; globalThis.mayorNameOf = mayorNameOf; }
function shuffle(arr, rng = null) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
        const j = rng ? rng.nextInt(0, i) : Math.floor(Math.random() * (i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function weightedChoice(items, weights) {
    const total = weights.reduce((s,w) => s+w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length-1];
}

// Seeded random for reproducible map generation
class SeededRandom {
    constructor(seed) { this.seed = seed || Math.floor(Math.random() * 2147483647); }
    _next() { this.seed = (this.seed * 16807) % 2147483647; return this.seed; }
    nextFloat() { return (this._next() - 1) / 2147483646; }
    nextInt(min, max) { return Math.floor(this.nextFloat() * (max - min + 1)) + min; }
}
