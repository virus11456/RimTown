# 原始碼完整檔案掃描與方法索引

此為機器掃描索引，並非逐方法語意驗證。移植時仍须以原碼和 golden 為準。

## app.js
SHA256 `6cf395b4f9739898db3bcc5c3c961d7d9a0028f0289756616c060202bbf59267` · 9351 lines

### RimTownAuth · L126
Methods: `constructor`, `_initFromWP`, `_fetch`, `_persistToken`, `register`, `login`, `logout`, `repairAccount`, `checkLogin`, `adminListUsers`, `adminAction`, `listSaves`, `cloudSave`, `cloudLoad`, `cloudDelete`, `getCloudSettings`, `saveCloudSettings`, `getAchievements`, `unlockAchievement`

World dependencies: 

### RimTownApp · L292
Methods: `constructor`, `init`, `setupAuthListeners`, `_doLogin`, `_closeAuthModal`, `_enterGuestMode`, `_hideGuestBanner`, `_checkDailyReward`, `_startLastSeenTracker`, `_processOfflineProgress`, `_chapterDefs`, `currentChapter`, `_unlockDefs`, `_isTabLocked`, `_checkUnlocks`, `_updateTabLocks`, `_lockedAlert`, `_decorDefs`, `_enterDecorMode`, `_exitDecorMode`, `_decorTap`, `_enterSiteMode`, `_exitSiteMode`, `_siteValid`, `_siteTap`, `_flashSiteHint`, `_giftDefs`, `_giftPref`, `_showGiftPicker`, `_giveGift`, `_submitLeaderboard`, `_showLeaderboard`, `_gameAlert`, `_gameConfirm`, `_doRegister`, `_doResetPassword`, `setupTutorial`, `_tutorialNext`, `_tutorialPrev`, `_dismissTutorial`, `_firstDaySteps`, `_initFirstDay`, `_saveFirstDay`, `_firstDayActive`, `_renderFirstDayGuide`, `_firstDayMark`, `_dismissFirstDay`, `_completeFirstDay`, `_updateQuestGuidance`, `_showAccountMenu`, `_updateAccountButton`, `_syncToCloud`, `_repairAccountFlow`, `_pullCloudSettings`, `_pushCloudSettings`, `_applySettingsFromStorage`, `_syncFromCloud`, `_getCurrentTownName`, `_loadAchievementsFromCloud`, `_unlockAchievement`, `_showAchievementToast`, `_setupGlobalDismiss`, `_startAchievementChecker`, `_checkV4Notifications`, `_showMilestoneCard`, `_showWeeklyDigest`, `_showDramaScene`, `_showHeartEventCard`, `_showDecisionCard`, `_showRogueCard`, `_showEventChoiceCard`, `_showNPCHelpCard`, `_showCouncilCard`, `_isPlayerBusy`, `_queueNotifDeferred`, `_dequeueNotif`, `_showNotifBadgeToast`, `_showNextQueuedNotif`, `_startNotifFlusher`, `_showInteractiveNotification`, `_checkStoryEventDisplay`, `_showStoryEventToast`, `_showCornerNotice`, `_showCenterNotification`, `_checkNewspaperNotification`, `_checkAchievements`, `_makeConversationEngine`, `_hookConversationBubbles`, `_doLogout`, `_showCloudSaves`, `_loadCloudSave`, `_deleteCloudSave`, `_showAchievementsTab`, `renderAchievements`, `_shopBuy`, `_shopSell`, `_newsReaction`, `_councilVote`, `_showRunForMayorModal`, `_confirmRunForMayor`, `_playerVote`, `_playerFlirt`, `_playerPropose`, `_coachPixelSvg`, `_showCoachDialog`, `_coachTravelTo`, `_adminLoadUsers`, `_adminMigrate`, `_adminDo`, `_syncHousing`, `_visitorMailboxKey`, `_returnMailboxKey`, `_pushMailbox`, `_ensureNeighborTown`, `_visitorMailboxTick`, `_getTownList`, `_saveTownList`, `_dedupeTownList`, `_newerSave`, `_loadTownById`, `_saveCurrentTown`, `showTownManager`, `_renderTownList`, `_renderCloudTownList`, `switchTown`, `_generateTownId`, `createNewTown`, `_showBusyOverlay`, `_hideBusyOverlay`, `renameTownPrompt`, `deleteTownConfirm`, `setupTileMap`, `_updateHeaderTownName`, `_generateTileMapLayout`, `_startRenderLoop`, `loadSettings`, `saveSettings`, `_saveSettingsFromTab`, `_updateLLMStatus`, `startSimulation`, `restartSimulation`, `setupTabListeners`, `setupMobileSidebar`, `setupMobileInputFix`, `setupMobileHeader`, `setupEventDelegation`, `_setPaused`, `setupControlListeners`, `setupSettingsListeners`, `setupBGM`, `_updateBGMPhase`, `saveGame`, `tryLoadGame`, `deleteSave`, `setupAutoSave`, `_flushSaveOnExit`, `exportSave`, `importSave`, `_getArchiveKey`, `_getArchives`, `_saveArchives`, `archiveChatHistory`, `getChatArchives`, `deleteChatArchive`, `exportChatLog`, `assignAgentColor`, `playerMoveTo`, `_handleMovementKey`, `_handleMovementKeyUp`, `_syncPlayerInput`, `_interactNearby`, `_getAdjacentLocation`, `playerSendMessage`, `_renderChatMessages`, `_updateChatContactsInPlace`, `_showTypingIndicator`, `_hideTypingIndicator`, `startChatWith`, `render`, `_dayPhaseIcon`, `renderClock`, `renderMap`, `onAgentClick`, `_walkToAndChat`, `_setupKairoUI`, `_openKairoTab`, `_dismissKairoPanels`, `_syncKairoLayout`, `_setupTownOverlays`, `_setupVirtualJoystick`, `_heartsFor`, `_updateTownOverlays`, `_updateKairoStatus`, `_updateInteractPrompt`, `_updateAgentEmotes`, `_updateDramaTicker`, `_showNpcCard`, `_hideNpcCard`, `_nudgeDream`, `renderSidebar`, `_renderTabContent`, `renderRelationMap`, `_relmapEdges`, `_drawRelationMap`, `_renderGossipDigest`, `_renderMobileGroupTabs`, `renderChat`, `renderTownFeed`, `_feedLike`, `_feedCommentSend`, `_showRumorPicker`, `_rumorPickTone`, `_sendRumor`, `showChatArchives`, `renderChatArchiveList`, `viewArchive`, `renderChatArchiveView`, `manualArchiveChat`, `exportArchivedChat`, `deleteArchivedChat`, `_sendFromInput`, `playerWhisper`, `_chatIntents`, `_sendIntent`, `_applyChatIntent`, `_showChatEffect`, `_scrollChatToBottom`, `_appendChatBubble`, `_updateChatBadge`, `_renderSkills`, `_showCustomNPCModal`, `_createCustomNPC`, `_showEndingOverlay`, `_startNewGamePlus`, `_showTownIdentity`, `_newsCatIcon`, `_renderDailyFocus`, `_focusGo`, `_showRelTimeline`, `_followSet`, `_toggleFollow`, `_checkFollowedNpcs`, `_renderDailyEcho`, `_renderStoryFeed`, `_computeStorylines`, `_computeTeasers`, `_renderTownHeadlines`, `_newsGoto`, `renderResidentsList`, `renderAgentDetail`, `_renderHouseDetail`, `renderSettings`, `renderLog`, `renderEvents`, `_getExplorationZone`, `_resName`, `_econDailyFlow`, `renderEconomy`, `executeTrade`, `startBuilding`, `startBuildingUpgrade`, `startResearch`, `_renderAgentFactions`, `sendExpedition`, `selectAgent`, `renderIndustryAndFarm`, `renderIndustry`, `_chooseIndustry`, `_upgradeIndustry`, `renderFarm`, `_tillPlot`, `_plantCrop`, `_waterPlot`, `_fertilizePlot`, `_harvestPlot`, `_clearWithered`, `renderFactory`, `_buildFactory`, `_setRecipe`, `_assignWorker`, `_collectProduct`, `_sellProduct`, `_fulfillOrder`, `renderRecords`, `_chronicleDb`, `_chronicleSeq`, `_chronicleLabel`, `_chroniclePut`, `_chronicleAll`, `_chronicleGet`, `_chronicleClear`, `_downloadFile`, `_csvCell`, `_chronicleExportJSON`, `_chronicleExportConvoCSV`, `_chronicleExportScheduleCSV`, `_renderChronicleSection`, `renderNewspaper`, `_viewNewspaper`, `renderQuest`, `_locationLabel`, `_escapeHtml`

World dependencies: _feedUnread, _lastRumorDay, _legacyGeneration, _pendingComboNotifs, _pendingDramaScenes, _pendingHeartEvents, _pendingMilestones, _pendingWeeklyDigest, agents, buildings, checkCombos, checkHeartEvents, clock, conversationEngine, council, customNPC, dailyDecision, dailyFocus, dailyNews, decorations, election, eventChoice, exploration, farm, generateDailyFocus, getState, gossipNetwork, industry, lifeGoals, loadSave, logMessage, mediations, messageLog, multiEnding, npcHelp, onDayArchive, otherTowns, paused, processing, questSystem, queueDramaScene, recordPlayerAction, reputationSystem, research, reset, rogueCards, rosterMode, sendVisitorTo, serialize, shop, startNewGamePlus, stockpile, tick, tickCount, townFeed, townName, townTheme, trade, weather, workPolicy

## chiptune.js
SHA256 `213afbc17a1f99e6ece2a738d045ba5ca79c619db98df1e96146977ddd844c16` · 443 lines

### ChiptuneEngine · L5
Methods: `constructor`, `init`, `sfx`, `setVolume`, `toggleMute`, `loadSettings`, `play`, `stop`, `loadCustomTrack`, `_playCustom`, `_scheduleNotes`, `_playStep`, `_playPulse`, `_playTriangle`, `_playKick`, `_playSnare`, `_playHiHat`, `_getTrackData`, `_dayTrack`, `_nightTrack`, `_dawnTrack`, `_eveningTrack`

World dependencies: 

## custom-npc.js
SHA256 `a98fddcb046ee72512d1ccc8cb4bf0c7e1db6df9caec0d54c65915d74a2892c0` · 702 lines

### CustomNPCSystem · L49
Methods: `constructor`, `createCustomNPC`, `_validate`, `canCreate`, `getRemainingSlots`, `toDict`, `serialize`, `loadFrom`

World dependencies: addAgent, agents, clock, dailyNews, logMessage, stockpile, tickCount

### MultiEndingSystem · L250
Methods: `constructor`, `checkEnding`, `_collectStats`, `_buildTownHistory`, `_chartBar`, `_generateLifeSummary`, `renderEndingHTML`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, clock, customNPC, dailyNews, industry, lifecycle, logMessage, npcQuests, prosperity, questSystem, stockpile

## daily-news.js
SHA256 `92b8d0be8f3c8099e8e29136fe1793fe6a343bf1f4a28162995224c9e181ba56` · 257 lines

### DailyNewsEngine · L6
Methods: `constructor`, `collectEvent`, `generateNewspaper`, `_generateWithLLM`, `_generateTemplate`, `getLatestNewspaper`, `getNewspaper`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, conversationEngine, election, gossipNetwork, industry, news, stockpile, tickCount

## farm.js
SHA256 `d49dbef745cb7663ebcddd7151b1f9634a462c1ee18ac521272b18b070a89eb4` · 280 lines

### FarmSystem · L24
Methods: `constructor`, `_ensurePlots`, `getAvailableCrops`, `tillPlot`, `plantCrop`, `waterPlot`, `fertilizePlot`, `harvestPlot`, `dailyUpdate`, `clearWithered`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, dailyNews, industry, logMessage, stockpile, tickCount

## i18n.js
SHA256 `d83f9b380680b3df6d7fb809bb0c865563161a940a11c961be20e8c930dc39fe` · 2929 lines

## industry.js
SHA256 `2d10334fd18e7ac08b06e37c8b1435216beb85972199e96c1bdfca907ce25cd4` · 253 lines

### IndustryManager · L82
Methods: `constructor`, `chooseIndustry`, `upgradeIndustry`, `getCurrentLevel`, `getNextLevel`, `getAvailableIndustries`, `canUnlockNew`, `dailyUpdate`, `_checkTownLevelUp`, `_updateSynergies`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, dailyNews, logMessage, stockpile, tickCount

## npc-events.js
SHA256 `4f2cadeeced38ef018b09f6b275e5fef188dfa96025672bdc64620b2c88628ec` · 269 lines

### NPCEventSystem · L5
Methods: `constructor`, `dailyUpdate`, `_processHospitalized`, `_processMissing`, `_checkFights`, `_checkSabotage`, `_checkCollaboration`, `handleCheatingDiscovery`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, dailyNews, farm, gossipNetwork, logMessage, processing, removeAgent, stockpile, tickCount

## npc-quests.js
SHA256 `a53c67fea5dd0f08b527411d9fd29f258dc72332da7bfbae8f93497ec36b61c0` · 1127 lines

### NPCQuestSystem · L703
Methods: `constructor`, `dailyUpdate`, `_checkTriggers`, `_checkProgress`, `_evaluateCondition`, `_completeQuest`, `_updateIndustryBonuses`, `getIndustryBonus`, `getPersonalQuestHints`, `getIndustryBindingContext`, `_getQuestDef`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, clock, dailyNews, industry, logMessage, questSystem, stockpile, tickCount

## processing.js
SHA256 `3bf4e388dd853f5c2bfa063203bf7b8fc3f03a4f9f92db1573403b9525baa8bb` · 379 lines

### ProcessingSystem · L71
Methods: `constructor`, `getAvailableFactories`, `buildFactory`, `setRecipe`, `assignWorker`, `removeWorker`, `collectProduct`, `sellProduct`, `_autoStaff`, `dailyUpdate`, `_generateOrders`, `fulfillOrder`, `_checkOrderExpiry`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, clock, dailyNews, logMessage, stockpile, tickCount

## prosperity.js
SHA256 `30630cf1dcc225e254053e2fb14f1cba920f77bd5fb84ae735d7825279704b4d` · 334 lines

### ProsperityEngine · L7
Methods: `constructor`, `dailyUpdate`, `_calcEconomy`, `_calcBuildings`, `_calcPopulation`, `_calcHappiness`, `_calcCulture`, `_calcDefense`, `_calcBeauty`, `_getLevel`, `_applyEffects`, `getModifier`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, clock, decorations, events, farm, festivals, getActiveCombos, industry, lifecycle, processing, questSystem, stockpile

## quest-system.js
SHA256 `6e821377421304e1b71dfd83d823e566041c36269ad76cefdf593252948d80e9` · 1475 lines

### QuestSystem · L734
Methods: `constructor`, `init`, `checkProgress`, `_checkSideQuests`, `_checkSideQuestTrigger`, `_completeSideQuest`, `_checkDailyObjective`, `_assignDailyObjective`, `_checkStoryEvents`, `_checkStoryEventTrigger`, `getPendingStoryEvent`, `_evaluateCondition`, `_completeQuest`, `getQuestHintsForNPC`, `getActiveQuestContext`, `getCrisisContext`, `onChat`, `onTrade`, `onHarvest`, `onRaidSurvived`, `onElection`, `getActiveQuests`, `getCompletedQuests`, `getCurrentChapter`, `toDict`, `serialize`, `loadFrom`, `_migrateIfNeeded`

World dependencies: agents, buildings, clock, dailyNews, industry, logMessage, multiEnding, processing, stockpile, tickCount

## simulation.js
SHA256 `088315ef72ee334cae1f546191e85a4ffe4121adf85e1c008cbfbe5f877b7762` · 9772 lines

### GameClock · L6
Methods: `constructor`, `tick`, `timeOfDay`, `timeStr`, `shortTime`, `totalDays`, `reset`, `toDict`

World dependencies: 

### Needs · L58
Methods: `constructor`, `tickDecay`, `moodContribution`, `mostUrgent`, `toDict`

World dependencies: 

### MemoryEntry · L103
Methods: `constructor`, `toDict`

World dependencies: 

### Memory · L114
Methods: `constructor`, `add`, `getRecent`, `getAboutAgent`, `getImportant`, `_bigrams`, `retrieve`, `getThoughts`, `summarizeRecent`, `toDict`

World dependencies: 

### Relationship · L170
Methods: `constructor`, `type`, `statusLabel`, `modifyAffinity`, `modifyTrust`, `modifyRomantic`, `recordInteraction`, `addSharedMemory`, `toDict`

World dependencies: 

### RelationshipManager · L215
Methods: `constructor`, `getOrCreate`, `getFriends`, `getRomanticInterests`, `getBestFriend`, `getPartner`, `getSpouse`, `toDict`

World dependencies: 

### Personality · L256
Methods: `constructor`, `random`, `compatibility`, `socialModifier`, `workModifier`, `moodBase`, `describe`, `toDict`

World dependencies: 

### Skill · L305
Methods: `constructor`, `level`, `xpToNext`, `levelProgress`, `isIncapable`, `addXp`, `toDict`

World dependencies: 

### SkillSet · L329
Methods: `constructor`, `get`, `addXp`, `bestSkill`, `passions`, `totalLevel`, `toDict`

World dependencies: 

### Job · L402
Methods: `constructor`, `toDict`

World dependencies: 

### Agent · L438
Methods: `constructor`, `moodDescription`, `moodLabel`, `activityLabel`, `genderLabel`, `guessGender`, `rollAttributes`, `ATTR_META`, `attr`, `addThought`, `thoughtMoodTotal`, `activityReason`, `nextIntent`, `townConcern`, `update`, `_recordTrace`, `_perceiveSurroundings`, `_getStayDuration`, `_gainSkillXp`, `_decideActivity`, `_shouldMourn`, `_decideNightOwlActivity`, `_decideNightActivity`, `_decideLocation`, `_trySocialInteraction`, `_doStargazing`, `_doNightMischief`, `_doMourning`, `_generateThought`, `getLifestyleText`, `getPersonaStatus`, `generateDailyPlan`, `getCurrentPlanStep`, `getTodayTimeline`, `toDict`

World dependencies: agents, buildings, clock, conversationEngine, election, events, festivals, getAgentsAtLocation, gossipNetwork, logMessage, news, reputationSystem, stockpile, tickCount, townName, trade, weather

### PlayerAgent · L1210
Methods: `constructor`, `update`, `_autoManageActivity`, `moveTo`, `toDict`

World dependencies: clock, logMessage, tickCount, townMap

### TownFeedSystem · L1272
Methods: `constructor`, `addPost`, `serialize`, `load`

World dependencies: _feedUnread, clock, tickCount

### GossipNetwork · L1291
Methods: `constructor`, `createRelGossip`, `createGossip`, `spreadGossip`, `_handleGossipReachesSubject`, `playerSeedGossip`

World dependencies: agents, clock, conversationEngine, dailyNews, logMessage, tickCount, townFeed

### ConversationEngine · L1441
Methods: `constructor`, `npcLlmDailyBudget`, `_npcLlmAllowed`, `_countNpcLlmUse`, `queueDailyPlans`, `tickPlanQueue`, `_generatePlansBatchLLM`, `_canReplan`, `replanRestOfDay`, `_applyPlanData`, `dailyReflection`, `plantWhisper`, `tickProactiveMessages`, `narrateLifeMilestone`, `generateFeedPost`, `generateDramaScene`, `fireHeartEvent`, `sendEventComment`, `_buildCharacterProfile`, `_buildRelContext`, `_buildEconomicContext`, `_buildQuestContext`, `generateConversation`, `_llmConversation`, `_parseConversation`, `_fallbackConversation`, `_generatePersonalityDialogue`, `_personalityGreeting`, `_addConflictEscalation`, `generatePlayerReply`, `_parsePlayerReply`, `_fallbackPlayerReply`

World dependencies: _pendingDramaScenes, _pendingHeartEvents, _pendingMilestones, agents, checkHeartEvents, clock, dailyNews, dramaArchive, election, events, farm, festivals, gossipNetwork, industry, lifeGoals, logMessage, npcLlmUsedToday, npcQuests, processing, prosperity, questSystem, recordPlayerAction, tickCount, townFeed, weather

### LLMClient · L3367
Methods: `constructor`, `setFallbackGroqKey`, `testConnection`, `_canMakeRequest`, `_recordRequest`, `_handleRateLimit`, `generate`, `_stripThinkTags`, `_generateWithGroqFallback`, `_resolveGroqModel`, `_callProvider`

World dependencies: 

### TownMap · L3721
Methods: `constructor`, `addLocation`, `toDict`, `placeLocations`, `t`, `t`, `t`

World dependencies: 

### EventSystem · L3857
Methods: `constructor`, `dailyUpdate`, `_rollDailyEvent`, `_triggerRandomEvent`, `_triggerRaid`, `_startEventChain`, `_progressChains`, `_triggerDeparture`, `_sendAgentTravelling`, `_checkReturningTravellers`, `_returnAgent`, `_managePopulation`, `_spawnImmigrant`, `_applyEffects`, `getRecentEvents`, `getGossipTopics`, `getTravellingAgents`, `getActiveChains`

World dependencies: agents, buildings, clock, dailyNews, logMessage, news, questSystem, reputationSystem, stockpile, tickCount, townIdentity

### ElectionSystem · L4155
Methods: `constructor`, `dailyUpdate`, `triggerElection`, `playerEligibility`, `registerPlayerCandidate`, `canvassNpc`, `_startElection`, `_pickPolicy`, `_generateSpeech`, `_startVoting`, `_processVotes`, `_calculateVote`, `_announceResults`, `_applyPolicyEffects`, `toDict`, `loadFrom`

World dependencies: agents, clock, dailyNews, events, logMessage, news, prosperity, questSystem, reputationSystem, tickCount

### Stockpile · L4427
Methods: `constructor`, `get`, `add`, `consume`, `has`, `canAfford`, `pay`, `toDict`

World dependencies: agents, buildings, clock, industry, logMessage, news, stockpile, tickCount, townMap, weather, workPolicy

### BuildingManager · L4670
Methods: `constructor`, `getAvailable`, `getUpgradeable`, `startUpgrade`, `startProject`, `dailyConstruction`, `getEffect`, `toDict`

World dependencies: agents, checkCombos, conversationEngine, dailyNews, logMessage, stockpile, tickCount

### TradeManager · L4776
Methods: `constructor`, `dailyUpdate`, `_spawnMerchant`, `executeTrade`, `toDict`

World dependencies: buildings, logMessage, news, reputationSystem, stockpile, tickCount

### ResearchManager · L4835
Methods: `constructor`, `getAvailable`, `startResearch`, `dailyUpdate`, `toDict`

World dependencies: agents, buildings, logMessage, news, stockpile, tickCount

### WorkOrderManager · L4873
Methods: `constructor`, `createOrder`, `cancelOrder`, `updateProgress`, `cleanup`, `toDict`

World dependencies: 

### NewsSystem · L4962
Methods: `constructor`, `dailyUpdate`, `_generateBulletin`, `_rebuildModifiers`, `getModifier`, `getActiveBulletins`, `toDict`

World dependencies: agents, clock, events, logMessage

### Faction · L5075
Methods: `constructor`, `addMember`, `removeMember`, `hasMember`, `size`

World dependencies: 

### FactionSystem · L5098
Methods: `constructor`, `dailyUpdate`, `_dedupeFactions`, `_tryFormFactions`, `_updateCohesion`, `_tryFactionEvents`, `_cleanupDeadFactions`, `getAgentFactions`, `toDict`

World dependencies: agents, clock, events, gossipNetwork, logMessage, tickCount

### LifeGoalSystem · L5453
Methods: `constructor`, `_pickGoal`, `ensureAssigned`, `dailyUpdate`, `getGoal`, `describe`, `nudge`, `serialize`, `load`

World dependencies: agents, clock, conversationEngine

### TownIdentitySystem · L5552
Methods: `constructor`, `dailyUpdate`, `_evaluate`, `currentRoute`, `routeAxis`, `toDict`, `serialize`, `load`

World dependencies: agents, clock, dailyNews, election, logMessage, research, stockpile

### FestivalSystem · L5615
Methods: `constructor`, `dailyUpdate`, `toDict`, `t`, `t`, `t`, `t`, `t`, `t`, `t`, `t`, `t`

World dependencies: agents, clock, conversationEngine, events, gossipNetwork, logMessage, stockpile, tickCount

### LifecycleSystem · L5777
Methods: `constructor`, `dailyUpdate`, `_processAging`, `_checkDeaths`, `_killNpc`, `_checkBirths`, `_birthChild`, `_generateEpitaph`, `toDict`

World dependencies: addAgent, agents, clock, dailyNews, events, factions, gossipNetwork, logMessage, processing, removeAgent, tickCount

### ExplorationSystem · L6086
Methods: `constructor`, `dailyUpdate`, `_autoDiscoverZones`, `canSendExpedition`, `sendExpedition`, `_checkReturningExpeditions`, `toDict`

World dependencies: agents, clock, dailyNews, events, logMessage, stockpile, tickCount

### LegacySystem · L6250
Methods: `collectLegacy`, `applyLegacy`

World dependencies: _legacyGeneration, agents, buildings, farm, industry, logMessage, multiEnding, prosperity, research, stockpile

### World · L6457
Methods: `constructor`, `addAgent`, `removeAgent`, `getAgent`, `getAgentByName`, `getAgentsAtLocation`, `logMessage`, `tick`, `_absDay`, `_visitorDaily`, `sendVisitorTo`, `spawnVisitor`, `recordPlayerAction`, `_generateDailyEcho`, `_buildDayArchive`, `_processFeuds`, `_dramaDirector`, `_autoResolveStaleChoices`, `generateDailyFocus`, `getState`, `reset`, `startNewGamePlus`, `_processRelationships`, `_loadDefaultResidents`, `_seedCrossTownMemories`, `_loadHarborResidents`, `_loadRandomResidents`, `_seedRandomRelationships`, `_seedRelationships`, `getActiveCombos`, `checkCombos`, `queueDramaScene`, `generateWeeklyDigest`, `generateDailyFeedPosts`, `_processThoughts`, `checkHeartEvents`, `serialize`, `loadSave`

World dependencies: 

### ReputationSystem · L8216
Methods: `constructor`, `tier`, `tierIndex`, `nextTier`, `addReputation`, `dailyUpdate`, `_applyEffects`, `getModifier`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, dailyNews, questSystem

### WeatherSystem · L8406
Methods: `constructor`, `dailyUpdate`, `_rollWeather`, `_advanceWeather`, `_isHot`, `_isWet`, `_updateEnvironment`, `_checkDisasterEscalation`, `_offerPrepChoice`, `_startDisaster`, `_endDisaster`, `_applyEffects`, `_reportWeather`, `weatherType`, `temperature`, `humidity`, `windSpeed`, `farmModifier`, `moodModifier`, `isExtreme`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, buildings, clock, dailyNews, eventChoice, logMessage, news, stockpile, tickCount

### CouncilSystem · L8766
Methods: `constructor`, `dailyUpdate`, `_formCouncil`, `_generateProposal`, `_processVotes`, `playerVote`, `_resolveProposal`, `_applyDecreeEffects`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, dailyNews, logMessage, news, reputationSystem, stockpile, tickCount

### DailyDecisionSystem · L9099
Methods: `constructor`, `dailyUpdate`, `resolveDecision`, `processFollowups`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, dailyNews, logMessage, reputationSystem, stockpile, tickCount

### ShopSystem · L9272
Methods: `constructor`, `getAvailableItems`, `buy`, `sell`, `toDict`, `serialize`, `loadFrom`

World dependencies: logMessage, reputationSystem, stockpile, tickCount

### EventChoiceSystem · L9327
Methods: `constructor`, `offerChoice`, `_generateChoices`, `resolveChoice`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, dailyNews, logMessage, stockpile, tickCount, weather

### RogueCardSystem · L9476
Methods: `constructor`, `_npcs`, `_singles`, `_bumpAttr`, `_moodAll`, `_res`, `_spark`, `_deck`, `dailyUpdate`, `resolve`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, clock, dailyNews, logMessage, stockpile, tickCount

### NPCHelpSystem · L9600
Methods: `constructor`, `dailyUpdate`, `resolveRequest`, `toDict`, `serialize`, `loadFrom`

World dependencies: agents, logMessage, reputationSystem, stockpile, tickCount

### SeededRandom · L9767
Methods: `constructor`, `_next`, `nextFloat`, `nextInt`

World dependencies: 

## sw.js
SHA256 `145e2a57bc2dd186b695536f462a622b4454e79a8d30b39258262f7380c0f21c` · 74 lines

## tilemap.js
SHA256 `c5f19421d240e083ed3fd1f2eab1a51a63aea79a9834163974d8442f0f105337` · 5001 lines

### PixelTileMap · L225
Methods: `constructor`, `_setupCanvas`, `_checkResize`, `_clampCamera`, `_screenToMap`, `_setupInteraction`, `_handleTap`, `_postProcessArt`, `_buildStaticLayer`, `_drawBuildingGroundShadows`, `_postProcessStaticLayer`, `_drawWaterAnim`, `_drawDecorations`, `_renderWindowGlow`, `_buildTileCache`, `_drawTileOverlays`, `_drawTile`, `generateLayout`, `_placeBuilding`, `_placeHouseCluster`, `_placeFarm`, `_placeMine`, `_placeSquare`, `_placeWell`, `_placeForest`, `_placeRiver`, `_placeHill`, `_placeCave`, `_placeLake`, `_placeMeadow`, `_placeNatureArea`, `_connectToRoad`, `getAgentHouseId`, `ensureHouseCapacity`, `_placeExtraHouse`, `getHouseResidents`, `getLocationCenter`, `_drawCompletedBuildings`, `_drawConstructionSites`, `_drawBuildingIcon`, `_drawFarmOverlay`, `_drawCoachStation`, `_siteSnap`, `_siteValidCached`, `_drawSitePreview`, `_getFactoryPlots`, `_drawFactoryOverlay`, `_drawIndustryBadges`, `addConversationBubble`, `_isInsideBuilding`, `_getDoorPosition`, `_isWalkableTile`, `_findWalkableTarget`, `_isTileWalkable`, `_findPath`, `_simplifyPath`, `_updateManualPlayer`, `_followCamera`, `getLocationAt`, `getNearbyNPC`, `updateAgents`, `_shadeHex`, `_variedColors`, `_drawAgent`, `_drawChibiHair`, `_drawJobAccessory`, `renderAvatarDataURL`, `_drawFarmAction`, `render`, `_renderScreenVignette`, `_updateAndDrawParticles`, `spawnFloatFx`, `spawnFxOnAgent`, `_updateAndDrawFloatFx`, `_drawExplorationMarkers`, `_drawGraveyardMarkers`, `_drawFestivalDecorations`, `_renderDayNightOverlay`, `_renderCampfires`, `_drawCampfire`, `_drawTorch`, `_renderStars`, `_renderMoon`, `_renderNightVignette`, `_renderWindowLights`, `renderAvatarDataURL`

World dependencies: 
