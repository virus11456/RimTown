// ============================================================
// RimTown - Main Quest System v2 (主線任務系統 — 多路線版)
// ============================================================
// 升級重點：每個任務支援多條完成路線（搜集/社交/建設）
// 任何一條路線完成即可過關，NPC 好感度直接影響任務進展

// v6.34.0 任務鏈資料（CHAPTER_NAMES／MAIN_QUESTS／SIDE_QUESTS／DAILY_OBJECTIVES／STORY_EVENTS 與四個主題鎮的對應表）移到 quest-data.js，
// 觀察者模式不載；沒載入時 questChainFor 回 null、QuestSystem 用空鏈（沒有任務、不會爆）。
const EMPTY_QUEST_CHAIN = { chapters: {}, main: [], side: [], daily: [], story: [], startQuest: null };
function questChainFor(theme) { const Q = (typeof window !== 'undefined' && window.RIMTOWN_QUEST_CHAINS) || null; return Q ? (Q[theme || 'frontier'] || null) : null; }

class QuestSystem {
    constructor() {
        this.theme = 'frontier';   // v5.83.0 任務鏈主題(依 world.townTheme)
        this.chatWith = {};        // v5.83.0 {npcId: 次數}
        this.giftsTo = {};         // v5.83.0 {npcId: 次數}
        this.visitedLocations = []; // v5.83.0 玩家到過的地點 id
        this.quests = {};           // { questId: { status, objectives, routes, completedRoute } }
        this.completedOrder = [];
        this.tradeCount = 0;
        this.harvestCount = 0;
        this.chatCount = 0;
        this.raidsSurvived = 0;
        this.electionsHeld = 0;
        this.reputation = 0;        // 聲望值
        this.storyFlags = {};       // 劇情旗標
        this.activeCrisis = null;   // 第三章危機類型
        this._initialized = false;
        // Side quest & daily objective tracking
        this.sideQuests = {};       // { sideQuestId: { status, objectives } }
        this.sideCompletedOrder = [];
        this.dailyObjective = null; // { id, startValue, completed }
        this.dailyCompletedIds = []; // Prevent repeats
        this.triggeredStoryEvents = []; // Story event IDs already shown
        this._pendingStoryEvent = null; // Event waiting to be displayed
    }

    // v5.83.0 依主題取任務表(沒有表就退回邊境鎮的,避免舊呼叫點爆掉)
    _chain() { return questChainFor(this.theme) || EMPTY_QUEST_CHAIN; } // v6.34.0 資料沒載就是空鏈
    _main() { return this._chain().main; }
    _side() { return this._chain().side; }
    _daily() { return this._chain().daily; }
    _story() { return this._chain().story; }
    chapterNames() { return this._chain().chapters; }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        for (const q of this._main()) {
            if (this.quests[q.id]) continue;
            const state = {
                status: q.id === this._chain().startQuest ? 'active' : 'locked',
                completedRoute: null,
            };
            // Old-style objectives
            if (q.objectives) {
                state.objectives = {};
                for (const obj of q.objectives) {
                    state.objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            // Multi-route
            if (q.routes) {
                state.routes = {};
                for (const route of q.routes) {
                    state.routes[route.id] = {};
                    for (const cond of route.conditions) {
                        const condId = cond.label; // use label as key for simplicity
                        state.routes[route.id][condId] = { progress: 0, completed: false };
                    }
                }
            }
            this.quests[q.id] = state;
        }
        // Initialize side quests (all start as 'locked')
        for (const sq of this._side()) {
            if (this.sideQuests[sq.id]) continue;
            const state = { status: 'locked', objectives: {} };
            if (sq.objectives) {
                for (const obj of sq.objectives) {
                    state.objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            this.sideQuests[sq.id] = state;
        }
    }

    // ============================================================
    // Progress checking — 每 tick 呼叫
    // ============================================================
    checkProgress(world) {
        this.init();
        for (const questDef of this._main()) {
            const quest = this.quests[questDef.id];
            if (!quest || quest.status !== 'active') continue;

            // Multi-route quests
            if (questDef.routes) {
                for (const routeDef of questDef.routes) {
                    let routeComplete = true;
                    for (const condDef of routeDef.conditions) {
                        const condId = condDef.label;
                        const condState = quest.routes?.[routeDef.id]?.[condId];
                        if (!condState) { routeComplete = false; continue; }
                        if (condState.completed) continue;

                        const current = this._evaluateCondition(condDef, world);
                        condState.progress = Math.min(current, condDef.target);
                        if (condState.progress >= condDef.target) {
                            condState.completed = true;
                        } else {
                            routeComplete = false;
                        }
                    }
                    if (routeComplete) {
                        quest.completedRoute = routeDef.id;
                        this._completeQuest(questDef, world, routeDef);
                        break;
                    }
                }
                continue;
            }

            // Legacy single-objective quests
            if (questDef.objectives) {
                let allDone = true;
                for (const objDef of questDef.objectives) {
                    const obj = quest.objectives[objDef.id];
                    if (obj.completed) continue;
                    const current = this._evaluateCondition(objDef, world);
                    obj.progress = Math.min(current, objDef.target);
                    if (obj.progress >= objDef.target) {
                        obj.completed = true;
                    } else {
                        allDone = false;
                    }
                }
                if (allDone) {
                    this._completeQuest(questDef, world, null);
                }
            }
        }

        // Check side quests
        this._checkSideQuests(world);

        // Check daily objectives
        this._checkDailyObjective(world);

        // Check story events
        this._checkStoryEvents(world);
    }

    // ============================================================
    // Side quest management
    // ============================================================
    _checkSideQuests(world) {
        for (const sqDef of this._side()) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq) continue;

            // Check if locked side quest should be activated
            if (sq.status === 'locked') {
                if (this._checkSideQuestTrigger(sqDef, world)) {
                    sq.status = 'active';
                    world.logMessageT?.('quest', '📜 支線任務解鎖：「{title}」', { title: sqDef.title });
                    if (sqDef.story) {
                        world.logMessage?.('quest', `📖 ${sqDef.story}`);
                    }
                }
                continue;
            }

            // Check active side quest progress
            if (sq.status === 'active' && sqDef.objectives) {
                let allDone = true;
                for (const objDef of sqDef.objectives) {
                    const obj = sq.objectives[objDef.id];
                    if (!obj) { allDone = false; continue; }
                    if (obj.completed) continue;
                    const current = this._evaluateCondition(objDef, world);
                    obj.progress = Math.min(current, objDef.target);
                    if (obj.progress >= objDef.target) {
                        obj.completed = true;
                    } else {
                        allDone = false;
                    }
                }
                if (allDone) {
                    this._completeSideQuest(sqDef, world);
                }
            }
        }
    }

    _checkSideQuestTrigger(sqDef, world) {
        const trigger = sqDef.trigger;
        if (!trigger) return false;
        // Must have main quest completed or active
        if (trigger.mainQuest) {
            const mq = this.quests[trigger.mainQuest];
            if (!mq || (mq.status !== 'active' && mq.status !== 'completed')) return false;
        }
        // NPC affinity gates
        if (trigger.npcAffinity) {
            const player = world.agents?.player;
            for (const [npcId, minAff] of Object.entries(trigger.npcAffinity)) {
                const rel = player?.relationships?.relationships?.[npcId];
                if (!rel || (rel.affinity || 0) < minAff) return false;
            }
        }
        return true;
    }

    _completeSideQuest(sqDef, world) {
        const sq = this.sideQuests[sqDef.id];
        sq.status = 'completed';
        this.sideCompletedOrder.push(sqDef.id);
        // Give rewards
        if (sqDef.rewards) {
            for (const [res, amount] of Object.entries(sqDef.rewards)) {
                if (res === 'reputation') {
                    this.reputation += amount;
                } else {
                    world.stockpile?.add?.(res, amount, world.tickCount, `${t('支線獎勵')}${t('：')}${sqDef.title}`);
                }
            }
        }
        try { this._applyEffects(sqDef.effects, world); } catch (e) {} // v5.84.0
        try { world.growth?.addXp(15, 'side_quest', world); } catch (e) {} // v5.94.0 經驗
        world.logMessageT?.('quest', '✨ 支線任務完成：「{title}」！', { title: sqDef.title });
        if (sqDef.onComplete) {
            world.logMessage?.('quest', `📖 ${sqDef.onComplete}`);
        }
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `${t('支線任務')}${t('「')}${sqDef.title}${t('」')}${t('完成')}${t('！')}`, 6);
        }
    }

    // ============================================================
    // Daily objective management
    // ============================================================
    _checkDailyObjective(world) {
        const chapter = this.getCurrentChapter();

        // Assign a new daily objective if none active
        if (!this.dailyObjective || this.dailyObjective.completed) {
            this._assignDailyObjective(world, chapter);
            return;
        }

        // Check current daily objective progress
        const objDef = this._daily().find(d => d.id === this.dailyObjective.id);
        if (!objDef) return;

        const current = this._evaluateCondition(objDef.condition, world);
        const gained = current - (this.dailyObjective.startValue || 0);
        if (gained >= objDef.condition.target) {
            this.dailyObjective.completed = true;
            this.dailyCompletedIds.push(objDef.id);
            // Give reward
            if (objDef.reward) {
                for (const [res, amount] of Object.entries(objDef.reward)) {
                    if (res === 'reputation') {
                        this.reputation += amount;
                    } else {
                        world.stockpile?.add?.(res, amount, world.tickCount, t('每日目標獎勵'));
                    }
                }
            }
            world.logMessageT?.('quest', '⭐ 每日目標完成：{icon} {text}！', { icon: objDef.icon, text: objDef.text });
        }
    }

    _assignDailyObjective(world, chapter) {
        // Find objectives matching current chapter (or earlier)
        const candidates = this._daily().filter(d =>
            d.chapter <= chapter && !this.dailyCompletedIds.includes(d.id)
        );
        if (candidates.length === 0) {
            // Reset completed list to allow repeating
            this.dailyCompletedIds = [];
            return;
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const startValue = this._evaluateCondition(pick.condition, world);
        this.dailyObjective = { id: pick.id, startValue, completed: false };
    }

    // ============================================================
    // Story event management
    // ============================================================
    _checkStoryEvents(world) {
        for (const event of this._story()) {
            if (this.triggeredStoryEvents.includes(event.id)) continue;
            if (this._checkStoryEventTrigger(event, world)) {
                this.triggeredStoryEvents.push(event.id);
                this._pendingStoryEvent = event;
                world.logMessageT?.('event', '{icon} 【{title}】{text}', { icon: event.icon, title: event.title, text: event.text });
                break; // Only one story event per tick
            }
        }
    }

    _checkStoryEventTrigger(event, world) {
        const trigger = event.trigger;
        if (!trigger) return false;
        if (trigger.tickCount && world.tickCount >= trigger.tickCount) return true;
        if (trigger.population) {
            const pop = Object.keys(world.agents || {}).length;
            if (pop >= trigger.population) return true;
        }
        if (trigger.max_affinity) {
            if (world.observerMode) { if (this._obsRel(world).max >= trigger.max_affinity) return true; } // v6.25.0 觀察者:看村民之間
            const player = world.agents?.player;
            if (!world.observerMode && player?.relationships?.relationships) {
                const max = Math.max(0, ...Object.values(player.relationships.relationships).map(r => r.affinity || 0));
                if (max >= trigger.max_affinity) return true;
            }
        }
        if (trigger.harvestCount && this.harvestCount >= trigger.harvestCount) return true;
        if (trigger.storyFlag && this.storyFlags[trigger.storyFlag]) return true;
        return false;
    }

    getPendingStoryEvent() {
        const event = this._pendingStoryEvent;
        this._pendingStoryEvent = null;
        return event;
    }

    // ============================================================
    // Condition evaluation — 統一評估各種條件
    // ============================================================
    // v6.25.0 觀察者沙盒:主線條件裡「玩家好感／拜訪／送禮」改看村民之間的關係與行蹤
    _obsRel(world) {
        const per = {}; let sum = 0, n = 0, max = 0, friends = 0;
        for (const a of Object.values(world.agents || {})) {
            if (a.isPlayer || a.isDead) continue;
            let s = 0, k = 0, hasFriend = false;
            for (const [tid, r] of Object.entries(a.relationships?.relationships || {})) {
                if (tid === 'player') continue;
                const v = r.affinity || 0; s += v; k++; sum += v; n++; if (v > max) max = v; if (v > 20) hasFriend = true;
            }
            per[a.agentId] = k ? Math.round(s / k) : 0; if (hasFriend) friends++;
        }
        return { per, avg: n ? Math.round(sum / n) : 0, max, friends };
    }
    _obsVisited(world) {
        this.visitedLocations = this.visitedLocations || [];
        for (const a of Object.values(world.agents || {})) { if (a.isPlayer || !a.currentLocation) continue; if (!this.visitedLocations.includes(a.currentLocation)) this.visitedLocations.push(a.currentLocation); }
        return this.visitedLocations;
    }
    _evaluateCondition(cond, world) {
        if (world?.observerMode) {
            switch (cond.type) {
                case 'max_affinity': return this._obsRel(world).max;
                case 'npc_affinity': return this._obsRel(world).per[cond.npcId] || 0;
                case 'avg_affinity': return this._obsRel(world).avg;
                case 'friends_count': return this._obsRel(world).friends;
                case 'gift_to': return this.chatWith?.[cond.npcId] || 0;
                case 'visit_location': return this._obsVisited(world).includes(cond.location) ? 1 : 0;
                case 'visited': { const v = this._obsVisited(world); return (cond.locations || []).filter(l => v.includes(l)).length; }
            }
        }
        switch (cond.type) {
            case 'chat_count':
                return this.chatCount;
            case 'resource':
            case 'resource_reach':
                return world.stockpile?.get?.(cond.resource) || 0;
            case 'industry_count':
                return Object.keys(world.industry?.industries || {}).length;
            case 'industry_specific':
                return world.industry?.industries?.[cond.industry] ? 1 : 0;
            case 'building_count':
                return world.buildings?.completed?.length || 0;
            case 'population':
                return Object.keys(world.agents || {}).length;
            case 'harvest_count':
                return this.harvestCount;
            case 'trade_count':
                return this.tradeCount;
            case 'factory_count':
                return Object.values(world.processing?.builtFactories || {}).filter(f => f.status === 'active').length;
            case 'town_level':
                return world.industry?.townLevel || 1;
            case 'election_count':
                return this.electionsHeld;
            case 'raid_survived':
                return this.raidsSurvived;
            case 'reputation':
                return this.reputation;
            case 'max_affinity': {
                const player = world.agents?.player;
                if (player?.relationships?.relationships) {
                    return Math.max(0, ...Object.values(player.relationships.relationships).map(r => r.affinity || 0));
                }
                return 0;
            }
            case 'npc_affinity': {
                const player = world.agents?.player;
                const rel = player?.relationships?.relationships?.[cond.npcId];
                return rel?.affinity || 0;
            }
            case 'avg_affinity': {
                const player = world.agents?.player;
                if (!player?.relationships?.relationships) return 0;
                const rels = Object.values(player.relationships.relationships);
                if (rels.length === 0) return 0;
                return Math.round(rels.reduce((s, r) => s + (r.affinity || 0), 0) / rels.length);
            }
            case 'friends_count': {
                const player = world.agents?.player;
                if (!player?.relationships?.relationships) return 0;
                return Object.values(player.relationships.relationships).filter(r => (r.affinity || 0) > 20).length;
            }
            // v5.83.0 主題任務鏈用的條件
            case 'talk_to':
                return this.chatWith?.[cond.npcId] || 0;
            case 'gift_to':
                return this.giftsTo?.[cond.npcId] || 0;
            case 'visit_location':
                return (this.visitedLocations || []).includes(cond.location) ? 1 : 0;
            case 'visited':
                return (cond.locations || []).filter(l => (this.visitedLocations || []).includes(l)).length;
            case 'season':
                return world.clock?.season === cond.season ? 1 : 0;
            case 'prosperity':
                return world.prosperity?.prosperity || 0;
            case 'caravan_count':
                return world.caravanCount || 0;
            case 'neighbor_town':
                return (Array.isArray(world.otherTowns) && typeof themeKeyOfTownName === 'function' && world.otherTowns.some(tw => themeKeyOfTownName(tw.name) === cond.theme)) ? 1 : 0;
            case 'npc_pair_affinity': {
                const a = world.agents?.[cond.a];
                const rel = a?.relationships?.relationships?.[cond.b];
                return rel?.affinity || 0;
            }
            default:
                return 0;
        }
    }

    // ============================================================
    // Quest completion
    // ============================================================
    _completeQuest(questDef, world, completedRoute) {
        const quest = this.quests[questDef.id];
        quest.status = 'completed';
        this.completedOrder.push(questDef.id);

        // Give rewards
        if (questDef.rewards) {
            for (const [res, amount] of Object.entries(questDef.rewards)) {
                if (res === 'reputation') {
                    this.reputation += amount;
                } else {
                    world.stockpile?.add?.(res, amount, world.tickCount, `${t('任務獎勵')}${t('：')}${questDef.title}`);
                }
            }
        }

        // Set story flags
        const routeLabel = completedRoute ? completedRoute.label : '';
        this.storyFlags[questDef.id] = {
            completedRoute: completedRoute?.id || 'default',
            day: world.clock.day,
            year: world.clock.year,
        };

        // v5.83.0 路線/任務的劇情後果(改村民之間的好感/信任/心動、玩家好感)
        try { this._applyEffects(completedRoute?.effects, world); this._applyEffects(questDef.effects, world); } catch (e) {}
        try { world.growth?.addXp(30, 'quest', world); } catch (e) {} // v5.94.0 經驗
        const doneText = completedRoute?.onComplete || questDef.onComplete || '';

        // Log
        const routeMsg = completedRoute ? `${t('（')}${completedRoute.label}${t('）')}` : '';
        world.logMessage?.('quest', `⚔️ ${t('主線任務完成')}${t('：')}${t('「')}${questDef.title}${t('」')}${routeMsg}${t('！')}${doneText}`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent?.('quest', `${t('主線任務')}${t('「')}${questDef.title}${t('」')}${routeMsg}${t('完成')}${t('！')}${doneText}`, 8);
        }

        // Multi-ending trigger (when finale quest completes)
        if (questDef.isFinale && world.multiEnding) {
            const endingRouteId = completedRoute?.id || 'prosper';
            world.multiEnding.checkEnding(world, endingRouteId);
        }

        // Unlock next quests (supports array or string)
        const unlocks = questDef.unlocks;
        if (unlocks) {
            const unlockList = Array.isArray(unlocks) ? unlocks : [unlocks];
            for (const nextId of unlockList) {
                const next = this.quests[nextId];
                if (next && next.status === 'locked') {
                    next.status = 'active';
                    const nextDef = this._main().find(q => q.id === nextId);
                    if (nextDef) {
                        world.logMessageT?.('quest', '📜 新任務解鎖：「{title}」', { title: nextDef.title });
                    }

                    // If crisis quest, roll crisis type
                    if (nextDef?.isCrisis && !this.activeCrisis) {
                        const types = nextDef.crisisTypes || ['locust', 'bandit', 'plague'];
                        this.activeCrisis = types[Math.floor(Math.random() * types.length)];
                        const crisisNames = { locust: t('蝗災'), bandit: t('盜匪圍城'), plague: t('瘟疫') };
                        world.logMessage?.('quest', `⚠️ ${t('危機降臨')}${t('：')}${crisisNames[this.activeCrisis] || this.activeCrisis}${t('！')}`);
                        if (world.dailyNews) {
                            world.dailyNews.collectEvent?.('crisis', `${t('重大危機')}${t('！')}${crisisNames[this.activeCrisis]}${t('威脅著小鎮的生存')}${t('！')}`, 10);
                        }
                    }
                }
            }
        }
    }

    // v5.83.0 任務後果:pairAffinity/pairTrust/pairRomance [[from, to, delta]]、playerAffinity [[npc, delta]]
    _applyEffects(effects, world) {
        if (!effects || !world?.agents) return;
        const relOf = (fromId, toId) => {
            const a = world.agents[fromId], b = world.agents[toId];
            if (!a || !b || !a.relationships?.getOrCreate) return null;
            return a.relationships.getOrCreate(b.agentId, b.name);
        };
        for (const [a, b, d] of (effects.pairAffinity || [])) { const r = relOf(a, b); if (r) r.affinity = Math.max(-100, Math.min(100, (r.affinity || 0) + d)); }
        for (const [a, b, d] of (effects.pairTrust || [])) { const r = relOf(a, b); if (r) r.trust = Math.max(-100, Math.min(100, (r.trust || 0) + d)); }
        for (const [a, b, d] of (effects.pairRomance || [])) { const r = relOf(a, b); if (r) r.romanticInterest = Math.max(0, Math.min(100, (r.romanticInterest || 0) + d)); }
        for (const [npcId, d] of (effects.playerAffinity || [])) { const r = relOf(npcId, 'player'); if (r) r.affinity = Math.max(-100, Math.min(100, (r.affinity || 0) + d)); }
        // v5.84.0 物資增減、繁榮度加成(持久、進存檔)、世界旗標(燈塔升級、海路開通…)
        for (const [res, d] of Object.entries(effects.stockpile || {})) {
            if (!world.stockpile) break;
            if (d >= 0) world.stockpile.add(res, d, world.tickCount, t('任務'), 'player');
            else world.stockpile.consume?.(res, Math.min(world.stockpile.get(res) || 0, -d), world.tickCount, t('任務'));
        }
        if (effects.prosperity && world.prosperity) world.prosperity.questBonus = (world.prosperity.questBonus || 0) + effects.prosperity;
        if (effects.flags) { world.harborFlags = world.harborFlags || {}; Object.assign(world.harborFlags, effects.flags); }
        // v5.85.0 主題災難:劇情排程災害(明天來襲)/路線化解災害
        if (effects.disaster && world.weather?.scheduleDisaster) world.weather.scheduleDisaster(effects.disaster.type, effects.disaster.daysUntil ?? 1, world);
        if (effects.endDisaster && world.weather?.resolveDisaster) world.weather.resolveDisaster(effects.endDisaster, world);
    }

    // ============================================================
    // NPC 對話提示 — 供 ConversationEngine 使用
    // ============================================================
    getQuestHintsForNPC(npcId, playerAffinity) {
        const hints = [];
        for (const questDef of this._main()) {
            const quest = this.quests[questDef.id];
            if (!quest || quest.status !== 'active') continue;
            if (!questDef.npcHints || !questDef.npcHints[npcId]) continue;
            const hintDef = questDef.npcHints[npcId];
            if (playerAffinity >= (hintDef.minAffinity || 0)) {
                hints.push({
                    questTitle: questDef.title,
                    hint: hintDef.hint,
                });
            }
        }
        // Also check side quest hints
        for (const sqDef of this._side()) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq || sq.status !== 'active') continue;
            if (!sqDef.npcHints || !sqDef.npcHints[npcId]) continue;
            const hintDef = sqDef.npcHints[npcId];
            if (playerAffinity >= (hintDef.minAffinity || 0)) {
                hints.push({
                    questTitle: `[${t('支線')}] ${sqDef.title}`,
                    hint: hintDef.hint,
                });
            }
        }
        return hints;
    }

    // Get active quest context for prompt injection
    getActiveQuestContext() {
        const active = this.getActiveQuests();
        if (active.length === 0) return '';
        const parts = active.map(q => {
            let s = `${t('任務')}${t('「')}${q.title}${t('」')}${t('：')}${q.description}`;
            if (q.routes) {
                const routeLabels = q.routes.map(r => r.label).join(t('、'));
                s += `${t('（')}${t('可選路線')}${t('：')}${routeLabels}${t('）')}`;
            }
            return s;
        });
        return `${t('玩家正在進行的任務')}${t('：')}${parts.join('；')}`;
    }

    // Get crisis description for prompt injection
    getCrisisContext() {
        if (!this.activeCrisis) return '';
        const desc = {
            locust: t('蝗災正在侵襲小鎮，農作物受到嚴重威脅。大家都很擔心糧食問題。'),
            bandit: t('盜匪在小鎮附近出沒，安全受到威脅。居民們人心惶惶。'),
            plague: t('一種神秘的疾病在小鎮蔓延，已有多人生病。大家急需醫療資源。'),
        };
        return desc[this.activeCrisis] || '';
    }

    // ============================================================
    // Event hooks
    // ============================================================
    onChat(npcId) { this.chatCount++; if (npcId) this.chatWith[npcId] = (this.chatWith[npcId] || 0) + 1; } // v5.83.0 記下跟誰聊
    onGift(npcId) { if (npcId) this.giftsTo[npcId] = (this.giftsTo[npcId] || 0) + 1; } // v5.83.0
    onVisit(locId) { if (locId && !this.visitedLocations.includes(locId)) this.visitedLocations.push(locId); } // v5.83.0
    onTrade() { this.tradeCount++; }
    onHarvest() { this.harvestCount++; }
    onRaidSurvived() { this.raidsSurvived++; }
    onElection() { this.electionsHeld++; }

    // ============================================================
    // Getters
    // ============================================================
    getActiveQuests() {
        return this._main().filter(q => this.quests[q.id]?.status === 'active');
    }

    getCompletedQuests() {
        return this.completedOrder.map(id => this._main().find(q => q.id === id)).filter(Boolean);
    }

    getCurrentChapter() {
        const active = this.getActiveQuests();
        if (active.length > 0) return active[0].chapter;
        const completed = this.getCompletedQuests();
        if (completed.length > 0) return completed[completed.length - 1].chapter;
        return 1;
    }

    // ============================================================
    // Serialization (UI state)
    // ============================================================
    toDict() {
        const active = this.getActiveQuests();
        const result = {
            quests: {},
            currentChapter: this.getCurrentChapter(),
            activeCount: active.length,
            completedCount: this.completedOrder.length,
            totalCount: this._main().length,
            reputation: this.reputation,
            activeCrisis: this.activeCrisis,
            theme: this.theme, // v5.83.0
            chapterNames: this.chapterNames(),
        };
        for (const questDef of this._main()) {
            const quest = this.quests[questDef.id];
            if (!quest) continue;

            const qData = {
                id: questDef.id,
                chapter: questDef.chapter,
                title: questDef.title,
                description: questDef.description,
                status: quest.status,
                rewards: questDef.rewards,
                onComplete: questDef.onComplete,
                completedRoute: quest.completedRoute,
                isCrisis: questDef.isCrisis || false,
                isFinale: questDef.isFinale || false,
            };

            // Multi-route data
            if (questDef.routes) {
                qData.routes = questDef.routes.map(routeDef => ({
                    id: routeDef.id,
                    label: routeDef.label,
                    icon: routeDef.icon,
                    description: routeDef.description,
                    conditions: routeDef.conditions.map(condDef => {
                        const condState = quest.routes?.[routeDef.id]?.[condDef.label] || {};
                        return {
                            ...condDef,
                            progress: condState.progress || 0,
                            completed: condState.completed || false,
                        };
                    }),
                    isComplete: quest.completedRoute === routeDef.id,
                }));
            }

            // Legacy objectives
            if (questDef.objectives) {
                qData.objectives = questDef.objectives.map(objDef => ({
                    ...objDef,
                    progress: quest.objectives?.[objDef.id]?.progress || 0,
                    completed: quest.objectives?.[objDef.id]?.completed || false,
                }));
            }

            result.quests[questDef.id] = qData;
        }

        // Side quests
        result.sideQuests = {};
        for (const sqDef of this._side()) {
            const sq = this.sideQuests[sqDef.id];
            if (!sq || sq.status === 'locked') continue; // Only show active/completed
            result.sideQuests[sqDef.id] = {
                id: sqDef.id,
                chapter: sqDef.chapter,
                title: sqDef.title,
                description: sqDef.description,
                story: sqDef.story,
                status: sq.status,
                rewards: sqDef.rewards,
                onComplete: sqDef.onComplete,
                objectives: (sqDef.objectives || []).map(objDef => ({
                    ...objDef,
                    progress: sq.objectives?.[objDef.id]?.progress || 0,
                    completed: sq.objectives?.[objDef.id]?.completed || false,
                })),
            };
        }
        result.sideQuestCount = Object.keys(result.sideQuests).length;
        result.sideCompletedCount = this.sideCompletedOrder.length;

        // Daily objective
        if (this.dailyObjective && !this.dailyObjective.completed) {
            const objDef = this._daily().find(d => d.id === this.dailyObjective.id);
            if (objDef) {
                result.dailyObjective = {
                    text: objDef.text,
                    icon: objDef.icon,
                    reward: objDef.reward,
                };
            }
        }

        return result;
    }

    // ============================================================
    // Serialization (save/load)
    // ============================================================
    serialize() {
        return {
            quests: JSON.parse(JSON.stringify(this.quests)),
            completedOrder: [...this.completedOrder],
            tradeCount: this.tradeCount,
            harvestCount: this.harvestCount,
            chatCount: this.chatCount,
            raidsSurvived: this.raidsSurvived,
            electionsHeld: this.electionsHeld,
            reputation: this.reputation,
            storyFlags: { ...this.storyFlags },
            activeCrisis: this.activeCrisis,
            // Side quests & daily objectives
            sideQuests: JSON.parse(JSON.stringify(this.sideQuests)),
            sideCompletedOrder: [...this.sideCompletedOrder],
            dailyObjective: this.dailyObjective ? { ...this.dailyObjective } : null,
            dailyCompletedIds: [...this.dailyCompletedIds],
            triggeredStoryEvents: [...this.triggeredStoryEvents],
            chatWith: { ...this.chatWith }, giftsTo: { ...this.giftsTo }, visitedLocations: [...this.visitedLocations], // v5.83.0
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.quests = data.quests || {};
        this.completedOrder = data.completedOrder || [];
        this.tradeCount = data.tradeCount || 0;
        this.harvestCount = data.harvestCount || 0;
        this.chatCount = data.chatCount || 0;
        this.raidsSurvived = data.raidsSurvived || 0;
        this.electionsHeld = data.electionsHeld || 0;
        this.reputation = data.reputation || 0;
        this.storyFlags = data.storyFlags || {};
        this.activeCrisis = data.activeCrisis || null;
        // Side quests & daily objectives
        this.sideQuests = data.sideQuests || {};
        this.sideCompletedOrder = data.sideCompletedOrder || [];
        this.dailyObjective = data.dailyObjective || null;
        this.dailyCompletedIds = data.dailyCompletedIds || [];
        this.triggeredStoryEvents = data.triggeredStoryEvents || [];
        this.chatWith = data.chatWith || {}; this.giftsTo = data.giftsTo || {}; this.visitedLocations = data.visitedLocations || []; // v5.83.0
        this._initialized = Object.keys(this.quests).length > 0;

        // Migrate: if old save has quests but no routes, reinitialize new quests
        this._migrateIfNeeded();
    }

    _migrateIfNeeded() {
        // Add any new quests that don't exist in save data
        for (const q of this._main()) {
            if (this.quests[q.id]) {
                // Ensure routes exist for multi-route quests
                if (q.routes && !this.quests[q.id].routes) {
                    this.quests[q.id].routes = {};
                    for (const route of q.routes) {
                        this.quests[q.id].routes[route.id] = {};
                        for (const cond of route.conditions) {
                            this.quests[q.id].routes[route.id][cond.label] = { progress: 0, completed: false };
                        }
                    }
                }
                continue;
            }
            // New quest not in save — determine status
            this.quests[q.id] = {
                status: 'locked',
                completedRoute: null,
            };
            if (q.objectives) {
                this.quests[q.id].objectives = {};
                for (const obj of q.objectives) {
                    this.quests[q.id].objectives[obj.id] = { progress: 0, completed: false };
                }
            }
            if (q.routes) {
                this.quests[q.id].routes = {};
                for (const route of q.routes) {
                    this.quests[q.id].routes[route.id] = {};
                    for (const cond of route.conditions) {
                        this.quests[q.id].routes[route.id][cond.label] = { progress: 0, completed: false };
                    }
                }
            }
        }

        // v5.83.0 主題鏈:只保證起始任務至少是 active
        if (this.theme !== 'frontier') {
            const st = this._chain().startQuest;
            const anyStarted = this._main().some(q => this.quests[q.id] && this.quests[q.id].status !== 'locked');
            if (this.quests[st] && !anyStarted) this.quests[st].status = 'active';
            return;
        }
        // Migrate old quest IDs to new structure
        // Old: ch1_food → merged into ch1_survive
        // Old: ch2_build, ch2_pop → merged into ch2_economy, ch2_community
        const oldToNew = {
            'ch1_food': 'ch1_survive',
            'ch2_build': 'ch2_economy',
            'ch2_pop': 'ch2_community',
            'ch3_trade': 'ch3_crisis',
            'ch3_factory': 'ch3_rebuild',
            'ch3_townlv': 'ch3_rebuild',
            'ch4_friendship': 'ch4_bonds',
            'ch4_defense': 'ch4_bonds',
            'ch5_prosper': 'ch5_legacy',
        };

        for (const [oldId, newId] of Object.entries(oldToNew)) {
            if (this.quests[oldId]?.status === 'completed' && this.quests[newId]?.status === 'locked') {
                this.quests[newId].status = 'active';
            }
        }

        // Ensure ch1_settle is always at least 'active' — this is the starting quest
        if (this.quests['ch1_settle'] && this.quests['ch1_settle'].status === 'locked') {
            this.quests['ch1_settle'].status = 'active';
        }
        // If ch1_settle is completed but ch1_survive doesn't exist as active, activate it
        if (this.quests['ch1_settle']?.status === 'completed' && this.quests['ch1_survive']?.status === 'locked') {
            this.quests['ch1_survive'].status = 'active';
        }
        if (this.quests['ch1_industry']?.status === 'completed' && this.quests['ch2_economy']?.status === 'locked') {
            this.quests['ch2_economy'].status = 'active';
        }
    }
}


// ============================================================
// v5.91.0 委託板與行動點(README H1):村民每天發出有時限的具體委託,旅人每天只有幾點行動
// 掛在既有 questSystem.onChat/onGift/onVisit 的呼叫點旁;交付/調解要走到委託人身邊(同地點)
// ============================================================
const REQUEST_AP_BASE = 5, REQUEST_AP_BUY_COST = 30, REQUEST_AP_BUY_MAX = 2;
const REQUEST_JOB_RES = { farmer: 'tools', miner: 'tools', carpenter: 'wood', blacksmith: 'metal', cook: 'food', doctor: 'herbs', researcher: 'herbs', priest: 'herbs', tailor: 'cloth', guard: 'food', trader: 'cloth', mayor: 'food' };
const REQUEST_FETCH_LOCS = ['tavern', 'well', 'chapel', 'park', 'library', 'general_store', 'quarry', 'farm', 'workshop', 'clinic', 'guardpost', 'town_square'];
const REQUEST_LOC_FALLBACK = { tavern: '酒館', well: '水井', chapel: '教堂', park: '公園', library: '圖書館', general_store: '雜貨店', quarry: '採石場', farm: '農場', workshop: '工坊', clinic: '診所', guardpost: '哨站', town_square: '鎮中心廣場' };
const REQUEST_RES_NAMES = { food: '食物', wood: '木材', stone: '石材', metal: '金屬', cloth: '布料', herbs: '草藥', tools: '工具', silver: '銀幣' };

// v6.5.0 委託鏈:完成一件委託後,村民有機會開一段三天的小故事(每天一件、各用既有委託類型),三步全完成有大獎,任何一步過期就斷
const REQUEST_CHAINS = {
    old_letter: { title: '一封舊信', steps: [
        { type: 'fetch', loc: 'town_square', pack: null, text: '{npc} 說有封舊信落在{loc}，幫他找回來' },
        { type: 'visit', text: '{npc} 想找個人陪他把那封信讀完' },
        { type: 'deliver', res: 'cloth', amount: 12, text: '{npc} 要做件像樣的衣服去見寫信的人，缺 {n} 布料' },
    ], finale: '{npc} 穿著新衣出門了，回來時眼睛紅紅的，說「謝謝你陪我走這一趟」', reward: { silver: 60, aff: 15, rep: 5 } },
    leaky_roof: { title: '漏水的屋頂', steps: [
        { type: 'deliver', res: 'wood', amount: 15, text: '{npc} 家的屋頂漏了，先要 {n} 木材撐著' },
        { type: 'fetch', loc: 'quarry', text: '{npc} 說{loc}有合用的石片，去搬一趟' },
        { type: 'visit', text: '屋頂修好了，{npc} 想請你坐坐，喝杯熱的' },
    ], finale: '{npc} 家不漏了；他說以後下雨天都會想起你', reward: { silver: 50, aff: 12, rep: 4 } },
    birthday: { title: '偷偷準備的生日', steps: [
        { type: 'fetch', loc: 'general_store', text: '{npc} 想偷偷替人準備生日，要你去{loc}拿東西' },
        { type: 'deliver', res: 'food', amount: 15, text: '{npc} 要辦一桌，缺 {n} 食物' },
        { type: 'gift', text: '壽星的禮物還沒著落，{npc} 請你送份心意' },
    ], finale: '生日宴上大家都笑了，{npc} 說這是今年最好的一天', reward: { silver: 45, aff: 14, rep: 4 } },
    grudge: { title: '放不下的心結', needsEnemy: true, steps: [
        { type: 'rumor', text: '{npc} 嘴硬不問，卻想知道 {target} 最近過得怎樣（去跟他「打聽」）' },
        { type: 'mediate', text: '{npc} 鬆口了，願意讓你在中間說和' },
        { type: 'gift', giftTo: 'target', text: '{npc} 不好意思出面，請你替他送份禮給 {target}' },
    ], finale: '{npc} 和 {target} 在廣場點了頭；這件事全鎮都在說', reward: { silver: 70, aff: 16, rep: 8 } },
};
class RequestBoard {
    constructor() {
        this.board = [];                 // 今日(含未到期)委託
        this.dayKey = null;              // 最近一次 roll 的日期鍵
        this.ap = { left: REQUEST_AP_BASE, max: REQUEST_AP_BASE, bought: 0 };
        this.stats = { done: 0, failed: 0, streak: 0, bestStreak: 0, days: 0, chainsDone: 0 };
        this._seq = 0;
        this.chain = null;               // v6.5.0 進行中的委託鏈 { key, npcId, npcName, targetId, targetName, step, startedAbsDay }
        this._chainCooldown = {};        // npcId → 下次可開鏈的 absDay
        this._lastNoticeDay = null;      // app 用:今天的「新委託」通知發過沒
    }
    _dayKey(w) { return `${w.clock.year}-${w.clock.season}-${w.clock.day}`; }
    _absDay(w) { return typeof w._absDay === 'function' ? w._absDay() : (w.clock.year * 1000 + w.clock.day); }
    _rand(n) { return Math.floor(Math.random() * n); }
    _pick(arr) { return arr.length ? arr[this._rand(arr.length)] : null; }
    _player(w) { return w.agents?.player || null; }
    _playerName(w) { return this._player(w)?.name || t('旅人'); }
    _villagers(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_')); }
    resName(res) { return t(REQUEST_RES_NAMES[res] || res); }
    // --- 每天早上:結算昨天、重設行動點、發新委託 ---
    dailyRoll(world) {
        const key = this._dayKey(world);
        if (this.dayKey === key) return;
        const today = this._absDay(world);
        // 昨天沒完成的到期委託 → 失敗(調解有兩天)
        let allDone = this.board.length > 0;
        let expired = 0;
        for (const r of this.board) {
            if (r.status === 'open' && today >= r.expiresAbsDay) this._fail(r, world, expired++);
            if (r.status !== 'done') allDone = false;
        }
        if (this.dayKey) { // 不是第一天
            this.lastDay = { dayKey: this.dayKey, done: this.board.filter(r => r.status === 'done').length, failed: this.board.filter(r => r.status === 'failed').length, total: this.board.length }; // v5.97.0 昨日結算
            this.stats.days++;
            if (allDone) { this.stats.streak++; this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak); }
            else if (this.board.some(r => r.status === 'failed')) this.stats.streak = 0;
        }
        this.board = this.board.filter(r => r.status === 'open'); // 只留還沒到期的(調解)
        this.dayKey = key;
        const g = world.growth; const vigor = g ? g.attr(world, 'vigor') : (this._player(world)?.attributes?.vigor || 5);
        this.ap.max = REQUEST_AP_BASE + (vigor >= 7 ? 1 : 0) + (this.stats.streak >= 3 ? 1 : 0) + (g?.has('stride') ? 1 : 0); // v5.94.0 天賦:健步
        this.ap.freeFirst = !!g?.has('earlybird'); // v5.94.0 天賦:早起
        this.ap.left = this.ap.max; this.ap.bought = 0;
        this._generate(world);
        world.logMessageT?.('quest', '📋 今日委託：{n} 件，行動點 {ap}', { n: this.board.filter(r => r.status === 'open').length, ap: this.ap.left }); // v6.19.0
    }
    _generate(world) {
        const vs = this._villagers(world); if (vs.length < 3) return;
        const used = new Set(this.board.map(r => r.npcId));
        const prosperity = world.prosperity?.prosperity || 0;
        const want = Math.min(5, 3 + (prosperity >= 50 ? 1 : 0) + ((this.stats?.streak || 0) >= 2 ? 1 : (Math.random() < 0.25 ? 1 : 0))) - this.board.length; // v6.2.0 連續全數完成才多一件
        const today = this._absDay(world);
        this._pushChainStep(world, today, used); // v6.5.0 委託鏈的下一步先上板
        const makers = [
            () => { // 送貨
                const cands = vs.filter(a => !used.has(a.agentId) && REQUEST_JOB_RES[a.job?.key]);
                const npc = this._pick(cands); if (!npc) return null;
                const res = REQUEST_JOB_RES[npc.job.key]; const stock = world.stockpile?.get?.(res) || 0;
                const amount = Math.max(10, Math.min(30, 10 + this._rand(21), Math.floor(stock * 0.5)));
                return { type: 'deliver', npcId: npc.agentId, npcName: npc.name, res, amount, apCost: 1, reward: { silver: amount * 2, aff: 8, rep: 2 } };
            },
            () => { // 陪伴
                const cands = vs.filter(a => !used.has(a.agentId) && ((a.mood || 50) < 45 || (a.needs?.social ?? 60) < 40));
                const npc = this._pick(cands.length ? cands : vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                return { type: 'visit', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 15, aff: 6, rep: 2 } };
            },
            () => { // 調解
                const pairs = [];
                for (const a of vs) for (const b of vs) {
                    if (a.agentId >= b.agentId || used.has(a.agentId) || used.has(b.agentId)) continue;
                    const ra = a.relationships?.relationships?.[b.agentId], rb = b.relationships?.relationships?.[a.agentId];
                    if (ra && rb && (ra.affinity || 0) < -20 && (rb.affinity || 0) < -20) pairs.push([a, b]);
                }
                const pr = this._pick(pairs); if (!pr) return null;
                return { type: 'mediate', npcId: pr[0].agentId, npcName: pr[0].name, otherId: pr[1].agentId, otherName: pr[1].name, talked: [], apCost: 2, reward: { silver: 40, aff: 8, rep: 4 }, days: 2 };
            },
            () => { // 跑腿
                const npc = this._pick(vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                const locs = REQUEST_FETCH_LOCS.filter(l => l !== npc.currentLocation && l !== npc.homeLocation);
                const loc = this._pick(locs); if (!loc) return null;
                const packRes = this._pick(['food', 'wood', 'herbs', 'cloth', 'stone']);
                const locName = (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[world.townTheme || 'frontier']?.locationNames?.[loc]) || REQUEST_LOC_FALLBACK[loc] || loc;
                return { type: 'fetch', npcId: npc.agentId, npcName: npc.name, loc, locName, visited: false, apCost: 2, reward: { silver: 30, aff: 8, rep: 3, pack: { res: packRes, amount: 10 + this._rand(11) } } };
            },
            () => { // 送禮
                const cands = vs.filter(a => !used.has(a.agentId) && (a.mood || 50) < 50);
                const npc = this._pick(cands); if (!npc) return null;
                return { type: 'gift', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 20, aff: 6, rep: 2 } };
            },
            // v5.97.0 接通其他系統的委託
            () => { // 押商隊(商人/鎮長發):有鄰鎮、沒有商隊在路上
                if (!Array.isArray(world.otherTowns) || !world.otherTowns.length || world.playerCaravan?.active) return null;
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && (a.job?.key === 'trader' || a.job?.key === 'mayor'))); if (!npc) return null;
                return { type: 'caravan', npcId: npc.agentId, npcName: npc.name, apCost: 1, reward: { silver: 30, aff: 6, rep: 3 } };
            },
            () => { // 打聽(愛八卦的人發):去跟某人打聽
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && (a.personality?.traits || []).includes('gossip'))); if (!npc) return null;
                const target = this._pick(vs.filter(a => a.agentId !== npc.agentId)); if (!target) return null;
                return { type: 'rumor', npcId: npc.agentId, npcName: npc.name, targetId: target.agentId, targetName: target.name, apCost: 1, reward: { silver: 20, aff: 6, rep: 2 } };
            },
            () => { // 考驗衝刺(鎮長發):本季考驗還沒達標時,把指標再推高一截
                const tr = world.trials?.current; if (!tr || tr.status !== 'active') return null;
                const value = world.trials.value(tr.type, world); if (value >= tr.target) return null;
                const npc = this._pick(vs.filter(a => !used.has(a.agentId) && a.job?.key === 'mayor')) || this._pick(vs.filter(a => !used.has(a.agentId))); if (!npc) return null;
                const delta = Math.max(5, Math.round((tr.target - value) * 0.3));
                return { type: 'trial', npcId: npc.agentId, npcName: npc.name, trialType: tr.type, baseValue: value, delta, apCost: 0, reward: { silver: 40, aff: 4, rep: 4 } };
            },
            () => { // 拉票(選舉期間、候選人發):替他去說服某人
                const el = world.election; if (!el?.active || (el.phase !== 'campaign' && el.phase !== 'voting')) return null;
                const cands = (el.candidates || []).filter(c => c.agentId !== 'player' && world.agents[c.agentId] && !used.has(c.agentId)); const c = this._pick(cands); if (!c) return null;
                const target = this._pick(vs.filter(a => a.agentId !== c.agentId)); if (!target) return null;
                return { type: 'canvass', npcId: c.agentId, npcName: world.agents[c.agentId].name, targetId: target.agentId, targetName: target.name, apCost: 1, reward: { silver: 25, aff: 8, rep: 3 } };
            },
        ];
        const order = [0, 1, 3, 2, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
        let made = 0, guard = 0;
        while (made < want && guard++ < 30) {
            const mk = makers[order[guard % order.length]];
            const r = mk(); if (!r) continue;
            if (used.has(r.npcId)) continue;
            used.add(r.npcId); if (r.otherId) used.add(r.otherId);
            this.board.push({ id: 'rq' + (++this._seq) + '_' + today, status: 'open', createdAbsDay: today, expiresAbsDay: today + (r.days || 1), ...r });
            made++;
        }
    }
    // --- 文案(顯示時才翻譯,存檔只存結構) ---
    describe(r) { const d = this.describeT(r); return Memory.render(d.k, d.p); } // v6.20.0 字串版(UI/通知);模板版給日誌與記憶
    describeT(r) {
        if (r.chainText) return tpl(r.chainText, { npc: r.chainNpcName || r.npcName, target: r.targetName || r.otherName || '', loc: r.locName || '', n: r.amount || '' }); // v6.5.0
        switch (r.type) {
            case 'deliver': return tpl('把 {n} {res} 送到 {npc} 手上', { n: r.amount, res: this.resName(r.res), npc: r.npcName });
            case 'visit': return tpl('{npc} 今天心情差，去陪他聊聊', { npc: r.npcName });
            case 'mediate': return tpl('勸 {a} 和 {b} 和好（先各聊一次，再按「調解」）', { a: r.npcName, b: r.otherName });
            case 'fetch': return tpl('幫 {npc} 去 {loc} 拿東西回來', { npc: r.npcName, loc: r.locName || r.loc });
            case 'gift': return tpl('{npc} 今天過得不好，送他一份禮', { npc: r.npcName });
            case 'caravan': return tpl('{npc} 想看鎮上的貨出去走走：押一趟商隊去鄰鎮', { npc: r.npcName });
            case 'rumor': return tpl('{npc} 想知道 {target} 的近況：去跟他打聽（用「打聽」）', { npc: r.npcName, target: r.targetName });
            case 'trial': return tpl('{npc} 請你為本季考驗出力：把{unit}再推高 {n}', { npc: r.npcName, unit: { famine: '食物', plague: '草藥', bandits: '防衛值', pricewar: '銀幣' }[r.trialType] || '', n: r.delta });
            case 'canvass': return tpl('{npc} 請你替他拉票：去說服 {target}（用「說服」）', { npc: r.npcName, target: r.targetName });
        }
        return tpl(r.type);
    }
    icon(r) { return { deliver: '📦', visit: '🫂', mediate: '🤝', fetch: '🏃', gift: '🎁', caravan: '🐪', rumor: '👂', trial: '⚖️', canvass: '🗳️' }[r.type] || '📋'; }
    _trialUnit(type) { return { famine: t('食物'), plague: t('草藥'), bandits: t('防衛值'), pricewar: t('銀幣') }[type] || ''; }
    // 進度說明(給 UI)
    progress(r, world) {
        if (r.status === 'done') return r.outcome === 'partial' ? t('已嘗試（沒完全成功）') : t('已完成');
        if (r.status === 'failed') return t('已過期');
        if (r.type === 'mediate') { const n = (r.talked || []).length; return n < 2 ? `${t('已聊過')} ${n}/2` : t('兩人都聊過了，去找其中一位按「調解」'); }
        if (r.type === 'fetch') return r.visited ? t('東西拿到了，回去交給他') : t('先到指定地點');
        if (r.type === 'deliver') { const have = Math.floor(world?.stockpile?.get?.(r.res) || 0); return `${t('倉庫')} ${have}/${r.amount}`; } // v6.11.0 取整(之前會出現 161.50000000000006)
        if (r.type === 'trial' && world?.trials) { const v = world.trials.value(r.trialType, world) - (r.baseValue || 0); return `${t('已推高')} ${Math.max(0, v)}/${r.delta}`; }
        if (r.type === 'caravan') return world?.playerCaravan?.active ? t('商隊在路上了，回報就算') : t('到馬車站押一隊');
        return '';
    }
    // 哪些需要「同地點」按鈕
    needsButton(r) { return r.status === 'open' && (r.type === 'deliver' || r.type === 'mediate' || r.type === 'fetch'); }
    canAct(r, world) {
        if (!r || r.status !== 'open') return { ok: false, reason: '' };
        if (this.ap.left < this._cost(r)) return { ok: false, reason: t('行動點不足') };
        const player = this._player(world);
        if (r.type === 'deliver') {
            if ((world.stockpile?.get?.(r.res) || 0) < r.amount) return { ok: false, reason: t('物資不足') };
            const npc = world.agents[r.npcId]; if (!npc || npc.currentLocation !== player?.currentLocation) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('身邊')}` };
            return { ok: true };
        }
        if (r.type === 'fetch') {
            if (!r.visited) return { ok: false, reason: t('先到指定地點') };
            const npc = world.agents[r.npcId]; if (!npc || npc.currentLocation !== player?.currentLocation) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('身邊')}` };
            return { ok: true };
        }
        if (r.type === 'mediate') {
            if ((r.talked || []).length < 2) return { ok: false, reason: t('先跟兩人各聊一次') };
            const a = world.agents[r.npcId], b = world.agents[r.otherId];
            if (!(a && a.currentLocation === player?.currentLocation) && !(b && b.currentLocation === player?.currentLocation)) return { ok: false, reason: `${t('走到')} ${t(r.npcName)} ${t('或')} ${t(r.otherName)} ${t('身邊')}` };
            return { ok: true };
        }
        return { ok: false, reason: '' };
    }
    // v5.94.0 行動點花費(天賦「早起」:每天第一件免費)
    _cost(r) { return this.ap.freeFirst ? 0 : r.apCost; }
    _spend(r) { const c = this._cost(r); if (this.ap.freeFirst) this.ap.freeFirst = false; return c; }
    // v5.97.0 其他系統的掛鉤:聊天意圖成功、押商隊出發、考驗指標被動達標
    onIntent(npcId, key, ok, world) {
        if (!ok) return;
        for (const r of this.board) {
            if (r.status !== 'open') continue;
            if (r.type === 'rumor' && key === 'gossip' && r.targetId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
            if (r.type === 'canvass' && key === 'persuade' && r.targetId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
        }
    }
    onCaravanLaunch(world) {
        for (const r of this.board) { if (r.status === 'open' && r.type === 'caravan' && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); } }
    }
    checkPassive(world) {
        for (const r of this.board) {
            if (r.status !== 'open' || r.type !== 'trial' || !world?.trials) continue;
            const v = world.trials.value(r.trialType, world) - (r.baseValue || 0);
            if (v >= r.delta) this._complete(r, world);
        }
    }
    // --- 掛鉤 ---
    onChat(npcId, world) {
        for (const r of this.board) {
            if (r.status !== 'open') continue;
            if (r.type === 'visit' && r.npcId === npcId) { if (this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); const npc = world.agents[npcId]; if (npc) npc.moodModifier = (npc.moodModifier || 0) + 8; this._complete(r, world); } }
            if (r.type === 'mediate' && (r.npcId === npcId || r.otherId === npcId)) { r.talked = r.talked || []; if (!r.talked.includes(npcId)) r.talked.push(npcId); }
        }
    }
    onGift(npcId, world) {
        for (const r of this.board) {
            if (r.status === 'open' && r.type === 'gift' && r.npcId === npcId && this.ap.left >= this._cost(r)) { this.ap.left -= this._spend(r); this._complete(r, world); }
        }
    }
    onVisit(locId, world) {
        for (const r of this.board) { if (r.status === 'open' && r.type === 'fetch' && r.loc === locId && !r.visited) { r.visited = true; world.logMessage?.('quest', `🏃 ${t('拿到了')} ${t(r.npcName)} ${t('要的東西，回去交給他')}`); } }
    }
    act(reqId, world) {
        const r = this.board.find(x => x.id === reqId); if (!r) return { ok: false, msg: '' };
        const c = this.canAct(r, world); if (!c.ok) return { ok: false, msg: c.reason };
        this.ap.left -= this._spend(r);
        if (r.type === 'deliver') {
            world.stockpile.consume?.(r.res, r.amount, world.tickCount, `${t('委託')}${t('：')}${t(r.npcName)}`);
            this._complete(r, world); return { ok: true, msg: `${t('交付完成')}${t('：')}${this.describe(r)}` };
        }
        if (r.type === 'fetch') { this._complete(r, world); return { ok: true, msg: `${t('交付完成')}${t('：')}${this.describe(r)}` }; }
        if (r.type === 'mediate') {
            const a = world.agents[r.npcId], b = world.agents[r.otherId]; const pl = this._player(world);
            const at = pl?.attributes || {}; const affA = a?.relationships?.relationships?.player?.affinity || 0, affB = b?.relationships?.relationships?.player?.affinity || 0;
            const g = world.growth; const charm = g ? g.attr(world, 'charm') : (at.charm || 5), wit = g ? g.attr(world, 'wit') : (at.wit || 5);
            const pSucc = Math.max(0.2, Math.min(0.95, 0.5 + charm * 0.04 + wit * 0.02 + (affA + affB) / 400 + (g?.has('silvertongue') ? 0.08 : 0))); // v5.94.0 天賦:巧舌
            const ok = Math.random() < pSucc;
            const bump = (x, y, d) => { if (!x || !y) return; const rel = x.relationships.getOrCreate(y.agentId, y.name); rel.affinity = Math.max(-100, Math.min(100, (rel.affinity || 0) + d)); if (ok) rel.trust = Math.min(100, (rel.trust || 0) + 5); };
            bump(a, b, ok ? 15 : 3); bump(b, a, ok ? 15 : 3);
            if (ok) { this._complete(r, world); return { ok: true, msg: `${t('調解成功')}${t('：')}${t(r.npcName)} ${t('與')} ${t(r.otherName)} ${t('握手言和')}` }; }
            const loser = Math.random() < 0.5 ? a : b; if (loser) { const rel = loser.relationships.getOrCreate('player', this._playerName(world)); rel.modifyAffinity?.(-3); }
            r.status = 'done'; r.outcome = 'partial'; this.stats.done++; world.growth?.addXp(5, 'request_partial', world);
            if (r.chainKey) this._chainAdvance(r, world); // v6.10.1 半成功也算走完這一步,鏈不會卡住
            const half = { silver: Math.round(r.reward.silver / 2), aff: 0, rep: 1 }; this._reward(r, world, half);
            world.logMessage?.('quest', `🤝 ${t('調解沒成')}${t('：')}${t(r.npcName)} ${t('與')} ${t(r.otherName)} ${t('只肯各退一步')}`);
            return { ok: true, msg: `${t('調解沒成')}${t('（')}${Math.round(pSucc * 100)}%${t('）')}${t('：')}${t('兩人只肯各退一步')}` };
        }
        return { ok: false, msg: '' };
    }
    buyAP(world) {
        if (this.ap.bought >= REQUEST_AP_BUY_MAX) return { ok: false, msg: t('今天買的行動點已達上限') };
        if ((world.stockpile?.get?.('silver') || 0) < REQUEST_AP_BUY_COST) return { ok: false, msg: t('銀幣不足') };
        world.stockpile.consume?.('silver', REQUEST_AP_BUY_COST, world.tickCount, t('買行動點'));
        this.ap.bought++; this.ap.left++; this.ap.max++;
        return { ok: true, msg: `${t('行動點')} +1` };
    }
    _reward(r, world, rw) {
        const npc = world.agents[r.npcId]; const pname = this._playerName(world);
        if (rw.silver) world.stockpile?.add?.('silver', rw.silver, world.tickCount, `${t('委託獎勵')}${t('：')}${t(r.npcName)}`, 'player');
        if (rw.pack) world.stockpile?.add?.(rw.pack.res, rw.pack.amount, world.tickCount, `${t('委託獎勵')}${t('：')}${t(r.npcName)}`, 'player');
        if (rw.rep && world.questSystem) world.questSystem.reputation = (world.questSystem.reputation || 0) + rw.rep;
        if (npc && rw.aff) { const rel = npc.relationships.getOrCreate('player', pname); rel.modifyAffinity?.(rw.aff + (world.growth?.has('charmer') ? 3 : 0)); } // v5.94.0 天賦:人緣
    }
    _complete(r, world) {
        r.status = 'done'; r.outcome = 'ok'; this.stats.done++;
        world.growth?.addXp(r.type === 'mediate' ? 15 : 10, 'request', world); // v5.94.0 經驗
        this._reward(r, world, r.reward || {});
        const npc = world.agents[r.npcId]; const pname = this._playerName(world); const desc = this.describe(r);
        npc?.memory?.addT?.(world.tickCount, world.clock.timeStr, 'help', '{p}幫了我：{d}', { p: pname, d: this.describeT(r) }, 7, [pname]); // v6.20.0 模板
        world.logMessageT?.('quest', '✅ 委託完成：{d}（行動點剩 {ap}）', { d: this.describeT(r), ap: this.ap.left });
        world.dailyNews?.collectEvent?.('social', `${pname}${t('替')}${t(r.npcName)}${t('辦妥了一件事：')}${desc}`, 6, [r.npcName]);
        world.events?.conversationTopics?.push(`${pname}${t('幫')}${t(r.npcName)}${t('的忙')}`);
        if (r.chainKey) this._chainAdvance(r, world); else this._maybeStartChain(r, world); // v6.5.0
    }
    _fail(r, world, idx = 0) { // v6.2.0 同一天第一件過期 −3(硬頸 −2),其餘每件 −1、不另記在心上
        r.status = 'failed'; this.stats.failed++;
        const npc = world.agents[r.npcId]; const pname = this._playerName(world);
        if (npc) { const rel = npc.relationships.getOrCreate('player', pname); rel.modifyAffinity?.(idx > 0 ? -1 : (world.growth?.has('grit') ? -2 : -3)); if (idx === 0) npc.memory?.addT?.(world.tickCount, world.clock.timeStr, 'neglect', '拜託{p}的事沒有下文：{d}', { p: pname, d: this.describeT(r) }, 5, [pname]); }
        world.logMessageT?.('quest', '⌛ 委託過期：{d}', { d: this.describeT(r) }); // v6.19.0;v6.20.0 模板
        if (r.chainKey && this.chain && this.chain.key === r.chainKey && (r.chainStep ?? this.chain.step) === this.chain.step) this._chainBreak(world); // v6.5.0;v6.10.1 心結鏈第三步的 npcId 是對方,改比 key＋step
    }
    // ===== v6.5.0 委託鏈 =====
    _maybeStartChain(r, world) {
        if (this.chain || r.type === 'trial' || r.type === 'caravan') return;
        const npc = world.agents[r.npcId]; if (!npc) return;
        const today = this._absDay(world);
        if ((this._chainCooldown[r.npcId] || 0) > today) return;
        const aff = npc.relationships?.relationships?.player?.affinity || 0;
        if (aff < 15 || Math.random() > (world.growth?.has('storyteller') ? 0.5 : 0.3)) return; // v6.9.0 天賦:說書
        const enemy = this._villagers(world).find(b => b.agentId !== npc.agentId && (npc.relationships?.relationships?.[b.agentId]?.affinity || 0) < -20);
        const keys = Object.keys(REQUEST_CHAINS).filter(k => !REQUEST_CHAINS[k].needsEnemy || enemy);
        const key = this._pick(keys); if (!key) return;
        this.chain = { key, npcId: npc.agentId, npcName: npc.name, targetId: enemy?.agentId || null, targetName: enemy?.name || '', step: 0, startedAbsDay: today };
        this._chainCooldown[r.npcId] = today + 30;
        world.logMessage?.('quest', `📖 ${t(npc.name)}${t('欲言又止，好像還有件事想拜託你——明天再來看看委託板')}`);
        world.onChainEvent?.('start', npc.name, t(REQUEST_CHAINS[key].title));
    }
    chainScript(c, world) { const tpl = REQUEST_CHAINS[c?.key]; if (!tpl) return null; const locName = (loc) => (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[world?.townTheme || 'frontier']?.locationNames?.[loc]) || REQUEST_LOC_FALLBACK[loc] || loc || ''; const fill = (x, st) => Object.entries({ npc: t(c.npcName), target: t(c.targetName || ''), loc: st?.loc ? locName(st.loc) : '', n: st?.amount || '' }).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(v), t(x)); return { title: t(tpl.title), steps: tpl.steps.map(st => fill(st.text, st)), finale: fill(tpl.finale) }; } // v6.8.0 給 AI 改寫口吻用
    _pushChainStep(world, today, used) {
        const c = this.chain; if (!c) return;
        const tpl = REQUEST_CHAINS[c.key]; const st = tpl?.steps?.[c.step]; if (!st) { this.chain = null; return; }
        if (this.board.some(r => r.chainKey === c.key && r.npcId === c.npcId && r.status === 'open')) return;
        const npc = world.agents[c.npcId]; if (!npc) { this.chain = null; return; }
        const target = c.targetId ? world.agents[c.targetId] : null;
        if (tpl.needsEnemy && !target) { this.chain = null; return; }
        const base = { chainKey: c.key, chainStep: c.step, chainTitle: tpl.title, chainText: st.text, chainNpcName: c.npcName, chainQuote: (c.quotes && c.quotes[c.step]) || '', npcId: c.npcId, npcName: c.npcName, apCost: 1, reward: { silver: 20, aff: 6, rep: 2 }, days: 1 };
        let r = null;
        if (st.type === 'deliver') r = { ...base, type: 'deliver', res: st.res, amount: st.amount };
        else if (st.type === 'fetch') { const loc = st.loc; const locName = (typeof TOWN_THEMES !== 'undefined' && TOWN_THEMES[world.townTheme || 'frontier']?.locationNames?.[loc]) || REQUEST_LOC_FALLBACK[loc] || loc; r = { ...base, type: 'fetch', loc, locName, visited: false, apCost: 2, reward: { silver: 25, aff: 6, rep: 2, pack: st.pack || null } }; }
        else if (st.type === 'visit') r = { ...base, type: 'visit' };
        else if (st.type === 'gift') r = { ...base, type: 'gift', npcId: st.giftTo === 'target' && target ? target.agentId : c.npcId, npcName: st.giftTo === 'target' && target ? target.name : c.npcName, targetName: c.targetName };
        else if (st.type === 'rumor') r = { ...base, type: 'rumor', targetId: target?.agentId, targetName: target?.name };
        else if (st.type === 'mediate') r = { ...base, type: 'mediate', otherId: target?.agentId, otherName: target?.name, talked: [], apCost: 2, days: 2 };
        if (!r) return;
        if (r.reward && !r.reward.pack) delete r.reward.pack;
        this.board.unshift({ id: 'rq' + (++this._seq) + '_' + today, status: 'open', createdAbsDay: today, expiresAbsDay: today + (r.days || 1), ...r });
        used.add(r.npcId); used.add(c.npcId); if (r.otherId) used.add(r.otherId); if (r.targetId) used.add(r.targetId); // v6.10.1 鏈裡牽涉到的人當天不再接別的委託
    }
    _chainAdvance(r, world) {
        const c = this.chain; if (!c || c.key !== r.chainKey) return;
        const tpl = REQUEST_CHAINS[c.key]; c.step++;
        if (c.step < tpl.steps.length) { world.logMessage?.('quest', `📖 ${t(tpl.title)}${t('（')}${c.step}/${tpl.steps.length}${t('）')}${t('——明天還有下一步')}`); return; }
        // 結局
        const fill = (s, m) => Object.entries(m).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(v), s);
        const text = fill(t(tpl.finale), { npc: t(c.npcName), target: t(c.targetName || '') }) + ((c.quotes && c.quotes[3]) ? t('「{q}」').replace('{q}', c.quotes[3]) : ''); // v6.8.0 AI 口吻;v6.22.0 英文用直引號
        const rw0 = tpl.reward || {}; const rw = world.growth?.has('storyteller') ? { ...rw0, silver: Math.round((rw0.silver || 0) * 1.25), aff: Math.round((rw0.aff || 0) * 1.25) } : rw0; this.stats.chainsDone++; // v6.9.0 天賦:說書
        this._reward({ npcId: c.npcId, npcName: c.npcName }, world, rw);
        if (c.targetId && world.agents[c.targetId]) { const rel2 = world.agents[c.targetId].relationships?.getOrCreate?.('player', this._playerName(world)); rel2?.modifyAffinity?.(10); const n1 = world.agents[c.npcId], n2 = world.agents[c.targetId]; if (n1 && n2) { n1.relationships?.getOrCreate?.(n2.agentId, n2.name)?.modifyAffinity?.(25); n2.relationships?.getOrCreate?.(n1.agentId, n1.name)?.modifyAffinity?.(25); } }
        const npc = world.agents[c.npcId]; const pname = this._playerName(world);
        npc?.memory?.add?.(world.tickCount, world.clock.timeStr, 'help', `${pname}${t('陪我走完了')}${t('「')}${t(tpl.title)}${t('」')}`, 9, [pname]);
        world.growth?.addXp(25, 'chain', world);
        world.logMessage?.('quest', `🏅 ${t('委託鏈完成')}${t('「')}${t(tpl.title)}${t('」')}${t('：')}${text}`);
        world.dailyNews?.collectEvent?.('social', text, 9, [c.npcName].concat(c.targetName ? [c.targetName] : []));
        world.onChainEvent?.('done', c.npcName, t(tpl.title), text);
        this.chain = null;
    }
    _chainBreak(world) {
        const c = this.chain; if (!c) return; const tpl = REQUEST_CHAINS[c.key];
        const npc = world.agents[c.npcId]; const pname = this._playerName(world);
        npc?.memory?.add?.(world.tickCount, world.clock.timeStr, 'neglect', `${pname}${t('沒把')}${t('「')}${t(tpl.title)}${t('」')}${t('的事放在心上')}`, 7, [pname]);
        world.logMessage?.('quest', `💔 ${t('委託鏈中斷')}${t('「')}${t(tpl.title)}${t('」')}${t('：')}${t(c.npcName)}${t('沒再提起這件事')}`);
        world.onChainEvent?.('broken', c.npcName, t(tpl.title));
        this._chainCooldown[c.npcId] = this._absDay(world) + 15;
        this.chain = null;
    }
    openCount() { return this.board.filter(r => r.status === 'open').length; }
    firstOpen() { return this.board.find(r => r.status === 'open') || null; }
    toDict(world) { return { board: this.board.map(r => ({ ...r, text: this.describe(r), icon: this.icon(r), progress: this.progress(r, world), can: this.canAct(r, world), chainLabel: r.chainKey ? `${t(r.chainTitle)} ${(r.chainStep || 0) + 1}/${REQUEST_CHAINS[r.chainKey]?.steps?.length || 3}` : '' })), ap: { ...this.ap }, stats: { ...this.stats }, dayKey: this.dayKey, lastDay: this.lastDay || null, chain: this.chain ? { title: t(REQUEST_CHAINS[this.chain.key]?.title || ''), npcName: t(this.chain.npcName), step: this.chain.step, total: REQUEST_CHAINS[this.chain.key]?.steps?.length || 3 } : null }; }
    serialize() { return { board: this.board, dayKey: this.dayKey, ap: this.ap, stats: this.stats, _seq: this._seq, lastDay: this.lastDay || null, chain: this.chain || null, chainCooldown: this._chainCooldown || {} }; }
    loadFrom(d) { if (!d) return; this.board = Array.isArray(d.board) ? d.board : []; this.dayKey = d.dayKey || null; this.ap = { left: REQUEST_AP_BASE, max: REQUEST_AP_BASE, bought: 0, ...(d.ap || {}) }; this.stats = { done: 0, failed: 0, streak: 0, bestStreak: 0, days: 0, chainsDone: 0, ...(d.stats || {}) }; this._seq = d._seq || 0; this.lastDay = d.lastDay || null; this.chain = d.chain || null; this._chainCooldown = d.chainCooldown || {}; }
}


// ============================================================
// v5.93.0 季度考驗與軟性失敗(README H3):每季第 5 天公布一個鎮級考驗,季末結算
// 撐過→永久加成(世界旗標);失敗→2–3 名村民搬走、繁榮 −10、士氣 −10;連續兩季失敗→衰敗結局(可繼續玩)
// ============================================================
const TRIAL_TYPES = {
    famine:   { icon: '🌾', title: '糧荒', perk: 'granary', perkName: '大糧倉', perkDesc: '農田產量 +20%、之後的糧荒目標 −20%', weights: { mountain: 3, market: 3, frontier: 1, harbor: 1, forest: 1 } },
    plague:   { icon: '🤒', title: '瘟疫', perk: 'apothecary', perkName: '藥局', perkDesc: '全鎮心情 +10、之後的瘟疫目標 −30%', weights: { market: 3, mountain: 2, frontier: 2, harbor: 1, forest: 1 } },
    bandits:  { icon: '🏴', title: '匪患', perk: 'watchtower', perkName: '守望塔', perkDesc: '襲擊機率 −30%', weights: { frontier: 3, market: 2, mountain: 2, harbor: 1, forest: 2 } },
    pricewar: { icon: '📉', title: '商會壓價', perk: 'guildSeal', perkName: '商會印信', perkDesc: '押商隊利潤 +10%', weights: { market: 3, harbor: 3, forest: 1, frontier: 1, mountain: 1 } },
};
class SeasonTrials {
    constructor() { this.current = null; this.failStreak = 0; this.passStreak = 0; this.history = []; this.lastType = null; this.penalty = 0; } // v6.13.0 passStreak:衰敗後連續撐過兩季就復興;v6.22.0 penalty:考驗失敗累計扣的繁榮(有底)
    static PENALTY_FLOOR = -20; // v6.22.0 B23:連續失敗的繁榮扣分最多累計 −20(之前每季 −10 無底,idle 四季就把繁榮扣到 0,回來玩也補不回來)
    static POP_FLOOR = 8;       // v6.22.0 B23:人口剩 8 人就不再有人搬走
    static DECLINED_LEAVERS = 1; // v6.22.0 B23:已經衰敗後每季最多再走 1 人(之前照 12% 走,60 天 idle 25→14)
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_')); }
    _seasonKey(w) { return `${w.clock.year}-${w.clock.season}`; }
    _flags(w) { return w.harborFlags || (w.harborFlags = {}); }
    // v6.2.0 糧荒/瘟疫/壓價的目標與進度都只算「玩家親手帶進」的量(求助、收成、買進、委託與任務報酬、押商隊、賣貨、事件決策):
    // 只看不玩一定過不了,動手就過得了,也不受倉庫自然膨脹影響;匪患仍看防衛值(守衛、防禦建築)
    onPlayerGain(res, amount) {
        const c = this.current; if (!c || c.status !== 'active') return;
        c.contrib = c.contrib || { food: 0, herb: 0, silver: 0 };
        if (res === 'food') c.contrib.food += amount; else if (res === 'herbs') c.contrib.herb += amount; else if (res === 'medicine') c.contrib.herb += amount * 3; else if (res === 'silver') c.contrib.silver += amount;
    }
    target(type, w) {
        const n = Math.max(8, this._npcs(w).length); const f = this._flags(w);
        const pv = w.growth?.has('provident') ? 0.9 : 1; // v5.94.0 天賦:未雨
        // v6.30.0 觀察者模式算的是全鎮進帳(收成、買進、商隊都算),不是玩家親手帶進的量:目標跟著放大,讓健康的小鎮大約 1.5–2 倍過關、衰退的小鎮會過不了
        // (35 天 soak 實測:糧荒 737 vs 舊目標 125、瘟疫 646 vs 36、壓價 392 vs 262;重調後瘟疫 704/300、壓價 434/246)
        const ob = w.observerMode ? { famine: 3.5, plague: 10, pricewar: 1 } : { famine: 1, plague: 1, pricewar: 1 };
        if (type === 'famine') return Math.round(n * 5 * ob.famine * (f.granary ? 0.8 : 1) * pv);
        if (type === 'plague') return Math.round(n * 1.5 * ob.plague * (f.apothecary ? 0.7 : 1) * pv);
        if (type === 'bandits') return Math.max(4, this.value('bandits', w) + (pv < 1 ? 1 : 2));
        return Math.round((150 + n * 8) * ob.pricewar * pv);
    }
    value(type, w) {
        const c = this.current; const k = (c && c.type === type && c.contrib) ? c.contrib : { food: 0, herb: 0, silver: 0 };
        if (type === 'famine') return Math.round(k.food);
        if (type === 'plague') return Math.round(k.herb);
        if (type === 'bandits') { const guards = this._npcs(w).filter(a => a.job?.key === 'guard').length; const building = (w.buildings?.projects || []).reduce((acc, p) => acc + (p.effects?.defense_bonus || 0) * Math.min(1, (p.workDone || 0) / Math.max(1, p.workRequired || 1)), 0); return guards * 2 + Math.round((w.buildings?.getEffect?.('defense_bonus', 0) || 0) + (w.news?.getModifier?.('defense_bonus', 0) || 0) + building) + (this._flags(w).cityGuard ? 3 : 0) + (this._flags(w).watchtower ? 2 : 0); } // v6.2.0 蓋到一半的防禦建築按進度計
        if (type === 'pricewar') return Math.round(k.silver);
        return 0;
    }
    unit(type) { if (this._obsText) return { famine: t('全鎮進帳的食物'), plague: t('全鎮進帳的草藥（藥品算 3）'), bandits: t('防衛值'), pricewar: t('全鎮賺進的銀幣') }[type] || ''; return { famine: t('帶進的食物'), plague: t('帶進的草藥（藥品算 3）'), bandits: t('防衛值'), pricewar: t('賺進的銀幣') }[type] || ''; }
    goalTextT(type, target) { // v6.22.0 模板版(日誌用)
        if (this._obsText) { const k2 = { famine: '季末前全鎮為公庫帶進 {n} 份食物（收成、買進、商隊都算）', plague: '季末前全鎮帶進 {n} 份草藥（藥品一份算三份；採藥、買進、商隊都算）', bandits: '季末前把防衛值撐到 {n}（守衛每人 2、防禦建築、市集城加強守衛 3）', pricewar: '季末前全鎮賺進 {n} 銀幣（賣貨、商隊、外銷都算）' }[type]; if (k2) return tpl(k2, { n: target }); } // v6.30.0 觀察者措辭:不再是「親手」
        const k = { famine: '季末前親手為鎮上帶進 {n} 份食物（求助、收成、買進、委託報酬都算）', plague: '季末前親手帶進 {n} 份草藥（藥品一份算三份；求助、買進、委託報酬都算）', bandits: '季末前把防衛值撐到 {n}（守衛每人 2、防禦建築、市集城加強守衛 3）', pricewar: '季末前親手賺進 {n} 銀幣（委託報酬、押商隊、賣貨都算）' }[type] || '{n}';
        return tpl(k, { n: target });
    }
    goalText(type, target) { const g = this.goalTextT(type, target); return Memory.render(g.k, g.p); }
    _pick(w) {
        const theme = w.townTheme || 'frontier';
        const pool = Object.entries(TRIAL_TYPES).filter(([k]) => k !== this.lastType).map(([k, d]) => [k, d.weights[theme] || 1]);
        let total = pool.reduce((a, [, wgt]) => a + wgt, 0), r = Math.random() * total;
        for (const [k, wgt] of pool) { r -= wgt; if (r <= 0) return k; }
        return pool[0][0];
    }
    daily(world) {
        this._obsText = !!world.observerMode; // v6.30.0
        const key = this._seasonKey(world); const day = world.clock.day; const last = world.clock.DAYS_PER_SEASON || 15;
        // 跨季還掛著(錯過季末那天):先結算
        if (this.current && this.current.status === 'active' && this.current.seasonKey !== key) this._resolve(world, false);
        if (!this.current && day >= 5 && day < last && this.lastSeasonKey !== key) this._announce(world, key);
        if (this.current && this.current.status === 'active' && this.current.seasonKey === key && day >= last) this._resolve(world, true);
    }
    // v6.38.0 事件卡:直接開一場指定考驗(已有進行中的就不開)
    force(world, type) { if (!TRIAL_TYPES[type] || (this.current && this.current.status === 'active')) return false; this._obsText = !!world.observerMode; this._announce(world, this._seasonKey(world), type); return true; }
    _announce(world, key, forcedType = null) {
        const type = forcedType || this._pick(world); const d = TRIAL_TYPES[type];
        this.lastSeasonKey = key; this.lastType = type;
        this.current = { type, seasonKey: key, status: 'active', target: this.target(type, world), startAbsDay: world._absDay?.() || 0, dueDay: world.clock.DAYS_PER_SEASON || 15, silverAtStart: world.stockpile?.get?.('silver') || 0 };
        const text = `${t('本季考驗')}${t('「')}${t(d.title)}${t('」')}${t('：')}${this.goalText(type, this.current.target)}`;
        world.logMessageT?.('event', '⚖️ 本季考驗「{title}」：{goal}', { title: d.title, goal: this.goalTextT(type, this.current.target) }); // v6.22.0 模板
        world.dailyNews?.collectEvent?.('event', text, 9);
        world.events?.conversationTopics?.push(`${t('這一季的考驗是')}${t(d.title)}`);
        world.onTrialEvent?.('announce', `${d.icon} ${t('本季考驗')}${t('：')}${t(d.title)}`, this.goalText(type, this.current.target));
    }
    _resolve(world, onTime) {
        const c = this.current; if (!c || c.status !== 'active') return;
        const d = TRIAL_TYPES[c.type]; const v = this.value(c.type, world); const passed = v >= c.target;
        c.status = passed ? 'passed' : 'failed'; c.finalValue = v;
        world.growth?.addXp(passed ? 40 : 10, 'trial', world); // v5.94.0 經驗
        const f = this._flags(world);
        if (passed) {
            this.failStreak = 0; this.passStreak = (this.passStreak || 0) + 1; f[d.perk] = true;
            if (c.type === 'plague') Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 10; });
            Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) + 5; });
            if (world.questSystem) world.questSystem.reputation = (world.questSystem.reputation || 0) + 10;
            const back = Math.min(10, -(this.penalty || 0)); this.penalty = (this.penalty || 0) + back; // v6.22.0 撐過一季:先補回最多 10 的考驗扣分,再 +5
            if (world.prosperity) { world.prosperity.trialBonus = (world.prosperity.trialBonus || 0) + back; world.prosperity.questBonus = (world.prosperity.questBonus || 0) + 5; world.prosperity.recalcTotal?.(); } // v6.87.0 扣分帳另記(不消退),+5 是一時的
            const text = `${t('撐過了')}${t('「')}${t(d.title)}${t('」')}${t('的考驗！全鎮得到')}${t('「')}${t(d.perkName)}${t('」')}${t('：')}${t(d.perkDesc)}`;
            world.logMessage?.('event', `🏅 ${text}`); world.dailyNews?.collectEvent?.('event', text, 10);
            world.onTrialEvent?.('passed', `🏅 ${t('考驗通過')}${t('：')}${t(d.title)}`, `${t(d.perkName)} — ${t(d.perkDesc)}`);
            if (world.multiEnding?.endingTriggered === 'decline' && this.passStreak >= 2) world.multiEnding.revive?.(world); // v6.13.0 復興
        } else {
            this.failStreak++; this.passStreak = 0;
            const declinedNow = world.multiEnding?.endingTriggered === 'decline'; const popNow = this._npcs(world).length; // v6.22.0 B23
            const maxLeave = popNow <= SeasonTrials.POP_FLOOR ? 0 : declinedNow ? SeasonTrials.DECLINED_LEAVERS : Math.min(Math.max(1, Math.round(popNow * 0.12)), Math.max(1, 2 + (this.failStreak >= 2 ? 1 : 0) - (world.growth?.has('grit') ? 1 : 0))); // v5.94.0 天賦:硬頸;v6.2.0 小鎮最多走 12%;v6.22.0 人口下限 8、衰敗後每季最多 1 人
            const leavers = this._npcs(world).filter(a => (a.age ?? 30) >= 16 /* v9.9.4 小孩不會自己離鎮 */ && a.job?.key !== 'mayor' && !(a.relationships?.relationships?.player?.status === 'married')).sort((a, b) => (a.mood || 50) - (b.mood || 50)).slice(0, Math.min(maxLeave, popNow - SeasonTrials.POP_FLOOR));
            const names = leavers.map(a => a.name);
            leavers.forEach(a => world.leaveTown?.(a.agentId, t('鎮上的日子過不下去')));
            Object.values(world.agents).forEach(a => { if (!a.isPlayer) a.moodModifier = (a.moodModifier || 0) - 10; });
            const cut = Math.max(SeasonTrials.PENALTY_FLOOR - (this.penalty || 0), -10); this.penalty = (this.penalty || 0) + cut; // v6.22.0 扣分有底:累計最多 −20
            if (world.prosperity && cut < 0) { world.prosperity.trialBonus = (world.prosperity.trialBonus || 0) + cut; world.prosperity.recalcTotal?.(); }
            const text = names.length
                ? `${t('沒撐過「{t}」的考驗：').replace('{t}', t(d.title))}${names.join(t('、'))}${cut < 0 ? t('搬走了，繁榮 −10、全鎮士氣低落') : t('搬走了，全鎮士氣低落')}`
                : `${t('沒撐過「{t}」的考驗：').replace('{t}', t(d.title))}${cut < 0 ? t('繁榮 −10、全鎮士氣低落') : t('全鎮士氣低落')}`;
            world.logMessage?.('event', `💔 ${text}`); world.dailyNews?.collectEvent?.('event', text, 10, names);
            world.onTrialEvent?.('failed', `💔 ${t('考驗失敗')}${t('：')}${t(d.title)}`, text); // v6.22.2 英文冒號
            if (this.failStreak >= 2) world.multiEnding?.triggerDecline?.(world);
        }
        this.history = this.history.concat([{ type: c.type, seasonKey: c.seasonKey, status: c.status, value: v, target: c.target }]).slice(-8);
        this.current = null;
    }
    toDict(world) {
        const c = this.current; const d = c ? TRIAL_TYPES[c.type] : null;
        const f = this._flags(world);
        return {
            current: c ? { ...c, icon: d.icon, title: t(d.title), goal: this.goalText(c.type, c.target), value: this.value(c.type, world), unit: this.unit(c.type), pct: Math.min(100, Math.round(this.value(c.type, world) / Math.max(1, c.target) * 100)), daysLeft: Math.max(0, (c.dueDay || 15) - world.clock.day), perkName: t(d.perkName), perkDesc: t(d.perkDesc) } : null,
            failStreak: this.failStreak, passStreak: this.passStreak || 0, declined: world?.multiEnding?.endingTriggered === 'decline', revivals: world?.multiEnding?.revivals || 0, // v6.13.0
            perks: Object.values(TRIAL_TYPES).filter(x => f[x.perk]).map(x => ({ name: t(x.perkName), desc: t(x.perkDesc) })),
            history: this.history.slice(-4).reverse().map(h => ({ ...h, title: t(TRIAL_TYPES[h.type]?.title || h.type), icon: TRIAL_TYPES[h.type]?.icon || '⚖️' })),
            nextAnnounceDay: c ? null : 5,
        };
    }
    serialize() { return { current: this.current, failStreak: this.failStreak, passStreak: this.passStreak || 0, penalty: this.penalty || 0, history: this.history, lastType: this.lastType, lastSeasonKey: this.lastSeasonKey || null, }; }
    loadFrom(d) { if (!d) return; this.current = d.current || null; this.failStreak = d.failStreak || 0; this.passStreak = d.passStreak || 0; this.penalty = d.penalty || 0; this.history = Array.isArray(d.history) ? d.history : []; this.lastType = d.lastType || null; this.lastSeasonKey = d.lastSeasonKey || null; }
}


// ============================================================
// v5.94.0 旅人成長(README H4):委託/考驗/商隊/任務給經驗,升級三選一天賦;天賦接進既有系統
// ============================================================
// v6.12.1 四項屬性與顯示名,成長系統與介面共用
const GROWTH_ATTRS = ['charm', 'vigor', 'wit', 'grit'];
const GROWTH_ATTR_LABEL = { charm: '魅力值', vigor: '體力值', wit: '機智值', grit: '毅力值' };
function growthAttrLabel(k) { return t(GROWTH_ATTR_LABEL[k] || k); }
function growthZeroAttrs() { return Object.fromEntries(GROWTH_ATTRS.map(k => [k, 0])); }
const GROWTH_PERKS = {
    stride:      { icon: '🥾', name: '健步', desc: '每天行動點 +1', attr: { vigor: 1 } },
    silvertongue:{ icon: '🗣️', name: '巧舌', desc: '調解成功率 +8%，魅力 +2', attr: { charm: 2 } },
    shrewd:      { icon: '🧮', name: '精算', desc: '押商隊利潤 +5%，機智 +2', attr: { wit: 2 } },
    grit:        { icon: '🪨', name: '硬頸', desc: '委託過期只扣一半好感；考驗失敗少走一人，毅力 +2', attr: { grit: 2 } },
    charmer:     { icon: '🤝', name: '人緣', desc: '完成委託時委託人好感再 +3', attr: {} },
    pathfinder:  { icon: '🧭', name: '識途', desc: '押商隊遇劫率 ×0.8', attr: {} },
    provident:   { icon: '🌾', name: '未雨', desc: '季度考驗目標 −10%', attr: {} },
    earlybird:   { icon: '🌅', name: '早起', desc: '每天第一件委託不扣行動點', attr: {} },
    storyteller: { icon: '📖', name: '說書', desc: '村民更常找你走小故事（三成→五成），走完的獎勵 +25%', attr: {} }, // v6.9.0
    empath:      { icon: '💞', name: '知心', desc: '「用你的話說」AI 判定每級 ±12%、每天多 10 次，魅力 +1', attr: { charm: 1 } }, // v6.9.0
};
class TravellerGrowth {
    // v6.12.1 每升一級恰好得到一份獎勵:池裡還有天賦就排一次三選一,學完就 +1 隨機屬性;unspent 記還沒兌現的升級數
    constructor() { this.xp = 0; this.level = 1; this.perks = []; this.pending = null; this.log = []; this.total = 0; this.extra = growthZeroAttrs(); this.unspent = 0; }
    xpToNext() { return 60 + this.level * 45; } // v5.96.0 浸泡測試 35 天就 Lv.10 學完八種天賦,放慢
    has(perk) { return this.perks.includes(perk); }
    attrBonus() { const b = growthZeroAttrs(); for (const k of this.perks) for (const [a, v] of Object.entries(GROWTH_PERKS[k]?.attr || {})) b[a] += v; for (const a of GROWTH_ATTRS) b[a] += (this.extra?.[a] || 0); return b; }
    attr(world, key) { return ((world?.agents?.player?.attributes || {})[key] || 5) + this.attrBonus()[key]; }
    _pool() { return Object.keys(GROWTH_PERKS).filter(k => !this.has(k)); }
    addXp(n, reason, world) {
        if (!n || world?.observerMode) return; // v6.83.0 旅人等級是玩家時代的系統,觀察者模式不累積(以前會一直提示去選天賦)
        this.xp += n; this.total = (this.total || 0) + n; this.log = this.log.concat([{ n, reason, day: world?.clock?.day }]).slice(-20);
        let gained = 0;
        while (this.xp >= this.xpToNext()) { this.xp -= this.xpToNext(); this.level++; gained++; }
        if (!gained) return;
        this.unspent = (this.unspent || 0) + gained;
        this._settle(world, true);
    }
    // 把還沒兌現的升級換成獎勵:有天賦可學就開一次三選一等玩家挑(一次只開一份),池空了就直接 +1 隨機屬性
    _settle(world, announce) {
        let guard = 0;
        while ((this.unspent || 0) > 0 && guard++ < 50) {
            if (this._pool().length) {
                if (!this.pending) this._offer();
                if (announce) { world?.logMessage?.('quest', `⬆️ ${t('旅人升到')} ${this.level} ${t('級，去「故事」分頁選一個天賦')}`); world?.onGrowthEvent?.('level', this.level); }
                return; // 等玩家選完(choose 會再呼叫 _settle)
            }
            const k = GROWTH_ATTRS[Math.floor(Math.random() * GROWTH_ATTRS.length)]; this.extra = this.extra || growthZeroAttrs(); this.extra[k] = (this.extra[k] || 0) + 1; this.unspent--;
            if (announce) { world?.logMessage?.('quest', `⬆️ ${t('旅人升到')} ${this.level} ${t('級，天賦都學完了：')}${growthAttrLabel(k)} +1`); world?.onGrowthEvent?.('attr', k); }
        }
    }
    _offer() {
        const pool = this._pool();
        if (!pool.length) { this.pending = null; return; }
        const pick = []; while (pick.length < Math.min(3, pool.length)) { const k = pool[Math.floor(Math.random() * pool.length)]; if (!pick.includes(k)) pick.push(k); }
        this.pending = pick;
    }
    pendingLevels() { return this.pending ? Math.max(0, this.unspent || 0) : 0; } // 還有幾級等著選天賦
    choose(perk, world) {
        if (!this.pending || !this.pending.includes(perk) || this.has(perk)) return { ok: false };
        this.perks.push(perk); this.pending = null; this.unspent = Math.max(0, (this.unspent || 0) - 1);
        const d = GROWTH_PERKS[perk];
        world?.logMessage?.('quest', `✨ ${t('旅人學會了')}${t('「')}${t(d.name)}${t('」')}${t('：')}${t(d.desc)}`);
        world?.onGrowthEvent?.('perk', perk);
        this._settle(world, false);
        return { ok: true, perk };
    }
    toDict(world) {
        const b = this.attrBonus(); const base = (world?.agents?.player?.attributes) || { charm: 5, vigor: 5, wit: 5, grit: 5 };
        return { xp: this.xp, level: this.level, next: this.xpToNext(), pct: Math.round(this.xp / this.xpToNext() * 100),
            perks: this.perks.map(k => ({ id: k, icon: GROWTH_PERKS[k].icon, name: t(GROWTH_PERKS[k].name), desc: t(GROWTH_PERKS[k].desc) })),
            pending: (this.pending || []).map(k => ({ id: k, icon: GROWTH_PERKS[k].icon, name: t(GROWTH_PERKS[k].name), desc: t(GROWTH_PERKS[k].desc) })),
            pendingLevels: this.pendingLevels(),
            attrs: ['charm', 'vigor', 'wit', 'grit'].map(k => ({ key: k, base: base[k] || 5, bonus: b[k] })), log: this.log.slice(-5).reverse() };
    }
    serialize() { return { xp: this.xp, level: this.level, perks: this.perks, pending: this.pending, log: this.log, total: this.total || 0, extra: this.extra || null, unspent: this.unspent || 0 }; }
    loadFrom(d) {
        if (!d) return; this.xp = d.xp || 0; this.total = d.total || 0; this.level = d.level || 1; this.perks = Array.isArray(d.perks) ? d.perks : []; this.pending = Array.isArray(d.pending) ? d.pending : null; this.log = Array.isArray(d.log) ? d.log : [];
        this.extra = (d.extra && typeof d.extra === 'object') ? { ...growthZeroAttrs(), ...d.extra } : growthZeroAttrs();
        // 舊檔沒有 unspent:用等級推回還沒兌現的升級數(含 6.12 前就超過 Lv.11 的檔),再靜默結算
        const extraSum = GROWTH_ATTRS.reduce((a, k) => a + (this.extra[k] || 0), 0);
        this.unspent = (typeof d.unspent === 'number') ? d.unspent : Math.max(0, this.level - 1 - this.perks.length - extraSum);
        if (this.pending && !this.pending.every(k => GROWTH_PERKS[k] && !this.has(k))) this.pending = null;
        this._settle(null, false);
    }
}

// v5.98.0 季末回顧:季初快照、季末差分,換季那天彈一頁回顧;最多留 4 季
class SeasonRecap {
    constructor() { this.start = null; this.last = null; this.history = []; this.pendingShow = false; }
    _key(w) { return `${w.clock.year}-${w.clock.season}`; }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer); }
    _snap(w) {
        const aff = {}; for (const a of this._npcs(w)) aff[a.agentId] = a.relationships?.relationships?.player?.affinity || 0;
        return {
            key: this._key(w), year: w.clock.year, season: w.clock.season, absDay: w._absDay?.() || 0,
            silver: w.stockpile?.get?.('silver') || 0, pop: this._npcs(w).length, level: w.growth?.level || 1, xpTotal: w.growth?.total || 0,
            chainsDone: w.requests?.stats?.chainsDone || 0, reqDone: w.requests?.stats?.done || 0, reqFailed: w.requests?.stats?.failed || 0, bestStreak: w.requests?.stats?.bestStreak || 0,
            carRuns: w.playerCaravan?.totals?.runs || 0, carSilver: w.playerCaravan?.totals?.silver || 0, carRaids: w.playerCaravan?.totals?.raids || 0,
            rep: w.questSystem?.reputation || 0, prosperity: w.prosperity?.prosperity || 0, revivals: w.multiEnding?.revivals || 0, // v6.13.0
            questsDone: Object.values(w.questSystem?.quests || {}).filter(q => q.status === 'completed').length, aff,
        };
    }
    // 每天叫一次(在 trials.daily 之後):第一次只拍快照;換季就結算上一季
    daily(w) {
        this._obs = !!w.observerMode; // v6.25.0
        if (!w?.clock) return;
        const key = this._key(w);
        if (!this.start) { this.start = this._snap(w); return; }
        if (this.start.key === key) return;
        const s = this.start, now = this._snap(w);
        const gains = w.observerMode ? [] : this._npcs(w).map(a => ({ id: a.agentId, name: a.name, delta: (now.aff[a.agentId] || 0) - (a.agentId in s.aff ? s.aff[a.agentId] : (now.aff[a.agentId] || 0)) })).filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
        const left = (w.movedOut || []).filter(m => m.absDay >= s.absDay && m.absDay < now.absDay).map(m => m.name);
        const joined = this._npcs(w).filter(a => !(a.agentId in s.aff)).map(a => a.name);
        // v6.11.0 考驗結算後 trials.current 會清空,要從 history 找本季那筆(之前永遠顯示「本季沒有考驗」、評等也少算)
        const tr = w.trials?.current; const th = (w.trials?.history || []).slice().reverse().find(h => h.seasonKey === s.key);
        const trial = (tr && tr.seasonKey === s.key && tr.status !== 'active') ? { type: tr.type, status: tr.status, value: tr.finalValue ?? 0, target: tr.target } : th ? { type: th.type, status: th.status, value: th.value ?? 0, target: th.target } : null;
        const r = {
            key: s.key, year: s.year, season: s.season, trial,
            chainsDone: now.chainsDone - (s.chainsDone || 0), reqDone: now.reqDone - s.reqDone, reqFailed: now.reqFailed - s.reqFailed, bestStreak: now.bestStreak,
            carRuns: now.carRuns - s.carRuns, carSilver: now.carSilver - s.carSilver, carRaids: now.carRaids - s.carRaids,
            xp: now.xpTotal - s.xpTotal, levelFrom: s.level, levelTo: now.level,
            silverFrom: Math.round(s.silver), silverTo: Math.round(now.silver), popFrom: s.pop, popTo: now.pop, rep: now.rep - s.rep, prosperity: now.prosperity - s.prosperity, questsDone: now.questsDone - s.questsDone,
            gains, left, joined, revived: (now.revivals || 0) > (s.revivals || 0), grade: '', // v6.13.0 這季復興了
            prop: w.proposals?.periodStats ? w.proposals.periodStats(w, s.absDay, now.absDay) : null, // v6.30.0 本季提案統計
        };
        r.grade = this._grade(r);
        this.last = r; this.history = this.history.concat([r]).slice(-4); this.start = now; this.pendingShow = true;
        const line = this.headline(r);
        w.logMessage?.('event', `📜 ${line}`); w.dailyNews?.collectEvent?.('event', line, 9);
        if (typeof w.onSeasonRecap === 'function') { this.pendingShow = false; try { w.onSeasonRecap(r); } catch (e) {} }
    }
    _grade(r) {
        let s = 0;
        if (r.trial?.status === 'passed') s += 2; else if (r.trial?.status === 'failed') s -= 2;
        if (r.revived) s += 2; // v6.13.0
        if (!this._obs) { s += Math.min(2, Math.floor(r.reqDone / 10)); if (r.reqFailed > r.reqDone) s -= 1; }
        if (r.silverTo > r.silverFrom) s += 1; if (r.popTo < r.popFrom) s -= 1; if (!this._obs && r.carSilver >= 100) s += 1; if (r.questsDone > 0) s += 1;
        if (this._obs && r.popTo > r.popFrom) s += 1; // v6.25.0 觀察者:人口成長加分
        if (this._obs && (r.prop?.done || 0) >= 3) s += 1; // v6.30.0 觀察者:這季落實三件以上提案加分
        return s >= 5 ? 'S' : s >= 3 ? 'A' : s >= 0 ? 'B' : 'C';
    }
    _fill(tpl, m) { return Object.entries(m).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(String(v)), tpl); }
    title(r) { return this._fill(t('第 {y} 年{s}'), { y: r.year, s: t(r.season) }); }
    gradeText(g) { return { S: t('這一季漂亮'), A: t('穩穩的一季'), B: t('平平的一季'), C: t('難熬的一季') }[g] || ''; }
    headline(r) {
        const tr = r.trial ? (r.trial.status === 'passed' ? t('撐過了考驗') : t('考驗沒撐過')) : t('沒有考驗');
        if (this._obs) return this._fill(t('{name}回顧：{tr}，評等 {g}'), { name: this.title(r), tr, g: r.grade }); // v6.25.0
        return this._fill(t('{name}回顧：{tr}，委託完成 {n} 件，商隊 {c} 趟，評等 {g}'), { name: this.title(r), tr, n: r.reqDone, c: r.carRuns, g: r.grade });
    }
    // 給介面用的文字版(顯示時才翻譯)
    lines(r) {
        if (!r) return [];
        const T = (typeof TRIAL_TYPES !== 'undefined') ? TRIAL_TYPES : {};
        const out = [];
        if (r.trial) { const d = T[r.trial.type] || {}; out.push({ icon: r.trial.status === 'passed' ? '🏅' : '💔', text: `${this._fill(r.trial.status === 'passed' ? t('撐過了「{t}」') : t('沒撐過「{t}」'), { t: t(d.title || r.trial.type) })} ${r.trial.value}/${r.trial.target}` }); }
        else out.push({ icon: '⚖️', text: t('本季沒有考驗') });
        if (!this._obs) out.push({ icon: '📋', text: this._fill(t('完成 {a} 件、過期 {b} 件、最佳連勝 {c} 天'), { a: r.reqDone, b: r.reqFailed, c: r.bestStreak }) });
        if (r.carRuns && !this._obs) out.push({ icon: '🐪', text: this._fill(t('{n} 趟、賺 {s} 銀幣、遇劫 {r} 次'), { n: r.carRuns, s: r.carSilver, r: r.carRaids }) });
        if (!this._obs) out.push({ icon: '🧭', text: this._fill(t('經驗 +{x}，Lv.{a} → Lv.{b}'), { x: r.xp, a: r.levelFrom, b: r.levelTo }) });
        { const a = Math.round(r.silverFrom), b = Math.round(r.silverTo); out.push({ icon: '💰', text: this._fill(t('銀幣 {a} → {b}（{d}）'), { a, b, d: (b - a >= 0 ? '+' : '') + (b - a) }) }); } // v6.22.0 英文半形括號 // v6.11.0 取整,不再出現 895.5999999
        out.push({ icon: '👥', text: this._fill(t('人口 {a} → {b}'), { a: r.popFrom, b: r.popTo }) + ` · ${this._fill(t('聲望 {d}'), { d: (r.rep >= 0 ? '+' : '') + r.rep })} · ${this._fill(t('繁榮 {d}'), { d: (r.prosperity >= 0 ? '+' : '') + r.prosperity })}` });
        if (r.revived) out.push({ icon: '🌅', text: t('小鎮復興了：連續撐過兩季考驗，搬走的人開始回望這裡') }); // v6.13.0
        if (r.chainsDone) out.push({ icon: '📖', text: this._fill(t('走完 {n} 段村民的小故事'), { n: r.chainsDone }) });
        if (r.questsDone) out.push({ icon: '⚔️', text: this._fill(t('任務完成 {n} 件'), { n: r.questsDone }) });
        if (r.gains?.length) out.push({ icon: '💞', text: `${t('好感升最多：')}${r.gains.map(g => `${t(g.name)} +${g.delta}`).join(t('、'))}` });
        if (r.left?.length) out.push({ icon: '🚪', text: `${t('搬走了：')}${r.left.map(n => t(n)).join(t('、'))}` });
        if (r.joined?.length) out.push({ icon: '🏠', text: `${t('新住民：')}${r.joined.map(n => t(n)).join(t('、'))}` });
        if (r.prop && (r.prop.made || r.prop.done)) out.push({ icon: '📜', text: this._fill(t('提案 {m} 件：批准 {a}、否決 {r}、落實 {d}'), { m: r.prop.made, a: r.prop.approved, r: r.prop.rejected, d: r.prop.done }) + (r.prop.top ? this._fill(t('，最愛提案的是 {name}（{n} 件）'), { name: t(r.prop.top.name), n: r.prop.top.n }) : '') }); // v6.30.0
        return out;
    }
    // v6.4.0 下一季怎麼打:依上一季的弱項挑最多三條具體行動(考驗失敗 → 對症;委託過期多;沒押過商隊;沒人好感上升;人口流失;沒升級)
    advice(r, w) {
        if (!r || w?.observerMode) return []; // v6.25.0 觀察者沒有「下一季怎麼打」(v6.26 由提案系統接手)
        const tips = [];
        const vs = w ? this._npcs(w).filter(a => !a.isDead && !String(a.agentId).startsWith('visit_')) : []; // v6.10.1 不推薦死者與訪客
        const byJob = (jobs) => vs.find(a => jobs.includes(a.job?.key)) || vs[0];
        const chatGo = (key, npc) => npc ? { go: `chat:${key}:${npc.agentId}`, goLabel: this._fill(t('找 {name} 聊'), { name: t(npc.name) }) } : {};
        if (r.trial && r.trial.status === 'failed') {
            const by = { famine: { text: t('糧荒靠親手帶進食物：每天跟一兩位務農或廚子「求助」，或到田裡收成、向商人買進'), ...chatGo('help', byJob(['farmer', 'cook'])) }, plague: { text: t('瘟疫找醫生、學者、牧師「求助」，藥品一份算三份；委託報酬的草藥也算'), ...chatGo('help', byJob(['doctor', 'researcher', 'priest'])) }, bandits: { text: t('匪患要蓋防禦：訓練場（木 20、石 10、工具 2）或瞭望塔，蓋到一半也按進度計'), go: 'tab:economy', goLabel: t('去蓋防禦') }, pricewar: { text: t('商會壓價靠自己賺：多押幾趟商隊、交付委託拿銀幣、把多的貨賣掉'), go: 'caravan', goLabel: t('去馬車站') } };
            if (by[r.trial.type]) tips.push({ icon: '⚖️', ...by[r.trial.type] });
        } else if (!r.trial) tips.push({ icon: '⚖️', text: t('每季第 5 天公布考驗，前四天先囤好感和物資，公布後再對症下手'), go: 'tab:quest', goLabel: t('看委託板') });
        if (r.reqFailed > r.reqDone) tips.push({ icon: '📋', text: t('委託先挑一次對話就能完成的（陪伴、送禮），同一天第一件過期扣 3 好感、其餘每件扣 1'), go: 'tab:quest', goLabel: t('看委託板') });
        // v6.11.0 有沒有鄰鎮:先看 app 同步的 otherTowns,沒有就看解鎖旗標(存檔剛載入 otherTowns 可能還沒算)
        const theme = w?.townTheme || 'frontier'; let flag = () => false; try { flag = (k) => localStorage.getItem(typeof rimtownWorldKey === 'function' ? rimtownWorldKey(k) : k) === '1'; } catch (e) {}
        const NT = (typeof NEIGHBOR_TOWNS !== 'undefined') ? NEIGHBOR_TOWNS : [];
        const hasTowns = !!(w && ((Array.isArray(w.otherTowns) && w.otherTowns.length) || NT.some(d => d.theme !== theme && flag(d.key))));
        const nx = NT.find(d => d.theme !== theme && !flag(d.key)) || null;
        if (!r.carRuns && hasTowns) tips.push({ icon: '🐪', text: t('到馬車站押一趟商隊試試：30 份木材走大路，風險約一成、賣價多兩成'), go: 'caravan', goLabel: t('去馬車站') });
        else if (!r.carRuns && w && nx) tips.push({ icon: '🏘️', text: this._fill(t('把小鎮繁榮推到 {p}，往{town}的路就通了：可以押商隊、互訪、跨鎮戀愛；也可以到城鎮列表自己再建一座'), { p: nx.prosperity, town: t(nx.name) }), go: 'towns', goLabel: t('城鎮列表') });
        else if (!r.carRuns && w) tips.push({ icon: '🏘️', text: t('鄰鎮的存檔不在這台裝置上：到「城鎮列表」打開它，或再建一座城鎮，馬車站就會通車。'), go: 'towns', goLabel: t('城鎮列表') });
        if (!(r.gains || []).length) { const npc = vs.slice().sort((a, b) => ((b.relationships?.relationships?.player?.affinity || 0) - (a.relationships?.relationships?.player?.affinity || 0)))[0]; tips.push({ icon: '💬', text: t('每天用「用你的話說」跟一位村民聊，說到他在乎的事成功率 +16%，好感跟著漲'), ...chatGo('persuade', npc) }); }
        if (r.popTo < r.popFrom) { const low = vs.slice().sort((a, b) => (a.mood || 50) - (b.mood || 50))[0]; tips.push({ icon: '👥', text: t('人口在流失：撐過考驗，心情低的人多去「安慰」，有空房就留得住人'), ...chatGo('comfort', low) }); }
        if (r.levelTo <= r.levelFrom && r.xp < 60) tips.push({ icon: '🧭', text: t('經驗來自委託、考驗、商隊和主線任務；推進一章主線的經驗最多'), go: 'tab:quest', goLabel: t('看任務') });
        if (r.grade === 'S' || r.grade === 'A') tips.push({ icon: '🏅', text: t('這季打得不錯：下一季試著連續全清委託板，連清兩天每天會多一件'), go: 'tab:quest', goLabel: t('看委託板') });
        return tips.slice(0, 3);
    }
    toDict(w) {
        this._obs = !!w?.observerMode;
        const fmt = (r, withAdvice) => r ? { key: r.key, grade: r.grade, title: this.title(r), gradeText: this.gradeText(r.grade), headline: this.headline(r), lines: this.lines(r), advice: withAdvice ? this.advice(r, w) : [] } : null;
        return { last: fmt(this.last, true), history: this.history.slice().reverse().map(r => fmt(r, false)), pendingShow: this.pendingShow }; // v6.10.1 建議只算 last
    }
    serialize() { return { start: this.start, last: this.last, history: this.history, pendingShow: this.pendingShow }; }
    loadFrom(d) { if (!d) return; this.start = d.start || null; this.last = d.last || null; this.history = Array.isArray(d.history) ? d.history : []; this.pendingShow = !!d.pendingShow; }
}
